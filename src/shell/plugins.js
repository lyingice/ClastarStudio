/* ============================================================
   可选插件框架
   ------------------------------------------------------------
   - 插件包：manifest + 单文件 HTML（沙箱 iframe）
   - 安装：GitHub raw / GitHub 仓库 / release ZIP / 本地 ZIP / 官方目录
   - 宿主 API：仓库读写、ZIP 读取、下载、存储、toast
   - 不把插件代码直接注入主页面；插件只能通过 postMessage 调用宿主。
   ============================================================ */
const PWPlugins = (() => {
  const LS_KEY = 'pixelWorkshop_plugins_v1';
  const OFFICIAL = [
    {
      id:'create-texture',
      name:'机械动力方块扩展',
      icon:'box',
      description:'扫描 Create 模组 jar / 资源包，按方块族组织多分支模型与纹理，支持 3D / 动态预览、OBJ / MTL 只读预览、物品模型和分支纹理拆分。',
      source:'plugin.json'
    },
    {
      id:'gif-export',
      name:'GIF 导出',
      icon:'anim',
      description:'把仓库里的动画纹理（或本地动画 PNG 条带）逐帧编码成 GIF，支持帧间隔、循环次数与整数倍缩放。',
      source:'plugins/gif-export/manifest.json'
    },
    {
      id:'block-library',
      name:'MC 方块素材库',
      icon:'grid',
      description:'读取本地原版资源或导入的 jar / ZIP，自动还原成等距 3D 方块，多选后导入工作区作为可编辑的方块卡片。',
      source:'plugins/block-library/manifest.json'
    }
  ];
  const ALLOWED_PERMISSIONS = new Set(['library.read','library.write','zip.read','download','network']);
  let officialCatalog = OFFICIAL.slice();
  let installed = {};          // id -> { manifest, html, source, enabled, installedAt }
  let archives = new Map();    // archiveId -> { entries, at }
  let archiveSeq = 0;
  let centerPane = null;

  function load(){
    try{
      const d = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      const raw = (d && (d.installed || d)) || {};
      if(raw && typeof raw === 'object'){
        for(const [id, p] of Object.entries(raw)){
          if(p && p.manifest && typeof p.html === 'string') installed[id] = p;
        }
      }
    }catch(_){ installed = {}; }
  }
  function save(){
    try{ localStorage.setItem(LS_KEY, JSON.stringify({ v:1, installed })); return true; }
    catch(err){ toast('插件体积超出本地存储，安装失败'); return false; }
  }
  function pluginOf(id){ return installed[id] || null; }
  function isEnabled(id){ const p = pluginOf(id); return !!(p && p.enabled !== false); }
  function list(){
    return Object.values(installed).map(p => ({
      manifest:p.manifest, source:p.source, enabled:p.enabled !== false, installedAt:p.installedAt
    })).sort((a,b) => String(a.manifest.name).localeCompare(String(b.manifest.name),'zh'));
  }
  function tools(){
    const out = [];
    Object.values(installed).forEach(p => {
      if(p.enabled === false) return;
      const m = p.manifest;
      (Array.isArray(m.tools) ? m.tools : []).forEach(tool => {
        out.push({
          pluginId:m.id, id:tool.id, key:m.id + '::' + tool.id,
          name:tool.name || m.name, title:tool.title || tool.name || m.name,
          icon:tool.icon || m.icon || 'box', desc:tool.description || m.description || ''
        });
      });
    });
    return out;
  }
  function tool(pluginId, toolId){
    const p = pluginOf(pluginId);
    if(!p || p.enabled === false) return null;
    return (p.manifest.tools || []).find(t => t.id === toolId) || null;
  }
  function refresh(){
    if(typeof PWExtensions !== 'undefined') PWExtensions.renderShell();
    document.dispatchEvent(new CustomEvent('pw-plugins-change'));
  }

  /* ---------------- 安装 ---------------- */
  function normalizeInstallUrl(input){
    let s = String(input || '').trim();
    if(!s) throw new Error('请输入插件地址');
    if(/^[\w.-]+\/[\w.-]+$/.test(s)) s = 'https://github.com/' + s;
    if(/^github\.com\//.test(s)) s = 'https://' + s;
    try{
      const u = new URL(s, location.href);
      if(u.hostname === 'github.com'){
        const parts = u.pathname.split('/').filter(Boolean);
        if(parts.length >= 2){
          if(parts[2] === 'blob' && parts.length >= 5){
            return { kind:'manifest', url:'https://raw.githubusercontent.com/' + parts[0] + '/' + parts[1] + '/' + parts[3] + '/' + parts.slice(4).join('/') };
          }
          if(parts[2] === 'raw' && parts.length >= 5){
            return { kind:'manifest', url:'https://raw.githubusercontent.com/' + parts[0] + '/' + parts[1] + '/' + parts[3] + '/' + parts.slice(4).join('/') };
          }
          return { kind:'github-repo', owner:parts[0], repo:parts[1] };
        }
      }
      if(/\.zip(?:$|\?)/i.test(u.pathname + u.search)) return { kind:'zip', url:u.href };
      return { kind:'manifest', url:u.href };
    }catch(_){
      throw new Error('地址格式不正确');
    }
  }
  async function fetchText(url){
    const res = await fetch(url, {cache:'no-store'});
    if(!res.ok) throw new Error('下载失败 HTTP ' + res.status);
    return await res.text();
  }
  async function fetchManifest(manifestUrl){
    const text = await fetchText(manifestUrl);
    let manifest;
    try{ manifest = JSON.parse(text); }catch(_){ throw new Error('manifest 不是有效 JSON'); }
    validateManifest(manifest);
    return { manifest, manifestUrl };
  }
  function validateManifest(m){
    if(!m || typeof m !== 'object') throw new Error('缺少 manifest');
    if(!/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(String(m.id || ''))) throw new Error('插件 id 不合法');
    if(!m.name) throw new Error('缺少插件名称');
    if(!m.version) throw new Error('缺少版本号');
    if(m.apiVersion && String(m.apiVersion) !== '1') throw new Error('插件 API 版本不兼容');
    if(!m.entry) throw new Error('缺少 entry');
    if(m.permissions && !Array.isArray(m.permissions)) throw new Error('permissions 必须是数组');
    (m.permissions || []).forEach(p => { if(!ALLOWED_PERMISSIONS.has(p)) throw new Error('未知权限：' + p); });
    if(m.tools && !Array.isArray(m.tools)) throw new Error('tools 必须是数组');
    (m.tools || []).forEach(t => { if(!t.id || !t.name) throw new Error('工具缺少 id / name'); });
    return true;
  }
  function pluginSummary(m){
    const perms = (m.permissions || []).map(p => ({
      'library.read':'读取仓库', 'library.write':'写入仓库', 'zip.read':'读取 ZIP / jar',
      'download':'下载文件', 'network':'访问网络'
    }[p] || p));
    return '扩展：' + m.name + ' v' + m.version + '\n' +
      '来源标签：' + (m.official ? '官方可选' : '第三方') + '\n' +
      (m.description ? m.description + '\n' : '') +
      '\n权限：' + (perms.length ? perms.join('、') : '无') + '\n' +
      '插件在独立沙箱中运行，只能通过宿主 API 访问仓库。';
  }
  function installPlugin(manifest, html, source){
    validateManifest(manifest);
    const old = installed[manifest.id];
    const doInstall = () => {
      const entry = {
        manifest, html, source:String(source || ''), enabled:true, installedAt:Date.now()
      };
      if(old) entry.enabled = old.enabled !== false;
      installed[manifest.id] = entry;
      if(!save()){ delete installed[manifest.id]; return; }
      refresh();
      toast('已安装扩展：' + manifest.name);
      if(centerPane) renderCenter(centerPane);
    };
    if(old){
      confirmDialog('更新扩展', '扩展「' + manifest.name + '」已经安装，是否覆盖安装？\n\n' + pluginSummary(manifest),
        '覆盖安装', doInstall);
    }else{
      confirmDialog('安装扩展', pluginSummary(manifest), '安装', doInstall);
    }
  }
  async function installFromManifestUrl(url, source){
    const absolute = new URL(url, location.href).href;
    const { manifest, manifestUrl } = await fetchManifest(absolute);
    const entryUrl = new URL(manifest.entry, manifestUrl).href;
    const html = await fetchText(entryUrl);
    installPlugin(manifest, html, source || manifestUrl);
  }
  async function installFromUrl(input){
    const target = normalizeInstallUrl(input);
    if(target.kind === 'zip'){
      const res = await fetch(target.url, {cache:'no-store'});
      if(!res.ok) throw new Error('下载 ZIP 失败 HTTP ' + res.status);
      await installFromZipBlob(await res.blob(), target.url);
      return;
    }
    if(target.kind === 'github-repo'){
      let lastErr = null;
      for(const branch of ['main','master']){
        try{
          const url = 'https://raw.githubusercontent.com/' + target.owner + '/' + target.repo + '/' + branch + '/plugin.json';
          await installFromManifestUrl(url, input);
          return;
        }catch(err){ lastErr = err; }
      }
      throw lastErr || new Error('仓库根目录没有 plugin.json');
    }
    await installFromManifestUrl(target.url, input);
  }
  async function installFromZipBlob(blob, source){
    const entries = await PWArchive.read(blob);
    const manifests = entries.filter(e => !e.dir && /(^|\/)(manifest|plugin)\.json$/i.test(e.name))
      .sort((a,b) => a.name.split('/').length - b.name.split('/').length);
    if(!manifests.length) throw new Error('ZIP 里没有 manifest.json / plugin.json');
    const mEntry = manifests[0];
    const text = new TextDecoder('utf-8').decode(await mEntry.data()).replace(/^\uFEFF/, '');
    let manifest;
    try{ manifest = JSON.parse(text); }catch(_){ throw new Error('manifest.json 不是有效 JSON'); }
    validateManifest(manifest);
    const dir = mEntry.name.replace(/[^/]*$/, '');
    let entryName = dir + manifest.entry.replace(/^\.?\//, '');
    let e = entries.find(x => x.name === entryName);
    if(!e) e = entries.find(x => x.name.endsWith('/' + manifest.entry) || x.name === manifest.entry);
    if(!e) throw new Error('ZIP 里找不到 entry：' + manifest.entry);
    const html = new TextDecoder('utf-8').decode(await e.data());
    installPlugin(manifest, html, source || '本地 ZIP');
  }

  /* ---------------- 插件页 ---------------- */
  function openPluginCenter(){
    const exist = S.tabs.find(t => t.kind === 'plugins');
    if(exist){ activateTab(exist.id); return; }
    newTab('plugins', '扩展中心');
  }
  function openTool(pluginId, toolId, payload){
    const p = pluginOf(pluginId);
    if(!p){ toast('这个扩展还没有安装'); return; }
    if(p.enabled === false){ toast('扩展「' + p.manifest.name + '」已在扩展中心禁用'); return; }
    const t = tool(pluginId, toolId);
    if(!t){ toast('扩展工具不存在'); return; }
    const cardId = payload && payload.cardId || null;
    const exist = S.tabs.find(x => x.kind === 'plugin' && x.payload &&
      x.payload.pluginId === pluginId && x.payload.toolId === toolId &&
      (cardId ? x.payload.cardId === cardId : !x.payload.cardId));
    if(exist){
      activateTab(exist.id);
      return;
    }
    const tabTitle = (payload && payload.title) || t.title || t.name;
    newTab('plugin', tabTitle, { pluginId, toolId, cardId });
  }

  function injectCSP(html){
    const csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob:; media-src data: blob:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; font-src data:; connect-src \'none\'; form-action \'none\'; base-uri \'none\';">';
    html = String(html || '');
    if(/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, m => m + csp);
    return csp + html;
  }
  function apiContext(t, p){
    const hit = t.payload && t.payload.cardId ? findCardAnywhere(t.payload.cardId) : null;
    return {
      plugin:{ id:p.manifest.id, name:p.manifest.name, version:p.manifest.version, official:!!p.manifest.official },
      apiVersion:1, theme:S.theme,
      workspace: currentWS() ? { id:currentWS().id, name:currentWS().name } : null,
      workspaces: WS.map(w => ({ id:w.id, name:w.name, count:cardCount(w) })),
      card: hit ? { id:hit.card.id, name:hit.card.name, badge:hit.card.badge, create:hit.card.create || null } : null
    };
  }
  function sendRaw(t, msg, transfer){
    try{ t._pluginFrame.contentWindow.postMessage(msg, '*', transfer || []); }catch(_){}
  }
  function sendEvent(t, type, data){
    sendRaw(t, { __pwPluginHost:1, type, data:data || {} });
  }
  function sendHostReady(t){
    const p = pluginOf(t.payload && t.payload.pluginId);
    const toolDef = t.payload ? tool(t.payload.pluginId, t.payload.toolId) : null;
    sendRaw(t, {
      __pwPluginHost:1, type:'host-ready',
      plugin:p ? { id:p.manifest.id, name:p.manifest.name, version:p.manifest.version, official:!!p.manifest.official } : null,
      tool:toolDef,
      payload:t.payload || {},
      context:apiContext(t, p || {manifest:{}})
    });
  }
  function mount(t, host){
    const p = pluginOf(t.payload && t.payload.pluginId);
    const pane = document.createElement('div');
    pane.className = 'ed-pane plugin-pane on';
    pane.dataset.tab = t.id;
    if(!p || !p.html){
      pane.innerHTML = '<div class="plugin-missing">扩展没有安装或已被删除。<br><button class="btn pri" onclick="PWPlugins.openPluginCenter()">打开扩展中心</button></div>';
      host.appendChild(pane);
      t._pane = pane;
      return;
    }
    const fr = document.createElement('iframe');
    fr.className = 'plugin-frame';
    fr.setAttribute('sandbox', 'allow-scripts allow-downloads');
    fr.setAttribute('title', p.manifest.name);
    fr.srcdoc = injectCSP(p.html);
    pane.appendChild(fr);
    host.appendChild(pane);
    t._pane = pane; t._frame = fr; t._pluginFrame = fr;
    fr.addEventListener('load', () => sendHostReady(t));
  }

  /* ---------------- 宿主 API ---------------- */
  function need(p, perm){
    const perms = (p && p.manifest && p.manifest.permissions) || [];
    if(!perms.includes(perm)) throw new Error('插件没有声明权限：' + perm);
  }
  function parseCardThumb(card){
    if(card.thumb) return card.thumb;
    if(card.full) return card.full;
    if(card.create && Array.isArray(card.create.slots)){
      const s = card.create.slots.find(x => x.data && !/connected|ct/i.test(x.kind || ''));
      if(s) return s.data;
      if(card.create.slots[0]) return card.create.slots[0].data;
    }
    return null;
  }
  function addCards(params){
    const cards = Array.isArray(params.cards) ? params.cards.slice(0, 500) : [];
    if(!cards.length) throw new Error('没有要导入的卡片');
    let payloadSize = 0;
    try{ payloadSize = JSON.stringify(cards).length; }catch(_){}
    if(payloadSize > 4 * 1024 * 1024) throw new Error('本次导入体积过大，请减少方块族/纹理数量后分批导入');
    let ws = params.workspaceId ? WS.find(w => w.id === params.workspaceId) : null;
    if(!ws && params.workspaceName){
      ws = WS.find(w => w.name === params.workspaceName);
      if(!ws){
        ws = { id:uidWs(), name:String(params.workspaceName).slice(0,60), cats:[] };
        WS.push(ws);
      }
    }
    if(!ws) ws = currentWS();
    if(!ws) throw new Error('没有可用工作区');
    S.wsId = ws.id; S.folder = null;
    let cat = ws.cats.find(c => c.name === (params.categoryName || '方块'));
    if(!cat){ cat = { id:uidWs(), name:String(params.categoryName || '方块').slice(0,60), open:true, cards:[] }; ws.cats.push(cat); }
    let folder = null;
    if(params.folderName){
      folder = cat.cards.find(c => c.type === 'folder' && c.name === params.folderName);
      if(!folder){
        folder = { id:'f'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), name:String(params.folderName).slice(0,60), type:'folder', badge:'文件夹', meta:'文件夹 · 0 项', cards:[] };
        cat.cards.push(folder);
      }
    }
    const ids = [];
    cards.forEach(raw => {
      if(!raw || !raw.name) return;
      const c = normCard(raw);
      const thumb = parseCardThumb(c);
      if(!c.thumb && thumb) c.thumb = thumb;
      if(!c.full && thumb) c.full = thumb;
      if(findCardAnywhere(c.id)) c.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
      (folder ? folder.cards : cat.cards).unshift(c);
      ids.push(c.id);
    });
    saveData();
    renderWorkspaces();
    if($('#catList')) refreshList();
    renderStatus();
    return { workspaceId:ws.id, categoryId:cat.id, added:ids.length, cards:ids };
  }
  function getCard(id){
    const hit = findCardAnywhere(id);
    if(!hit) return null;
    return { card:JSON.parse(JSON.stringify(hit.card)), workspace:{ id:hit.ws.id, name:hit.ws.name } };
  }
  function updateCard(params){
    const hit = params && params.id ? findCardAnywhere(params.id) : null;
    if(!hit || !hit.card) throw new Error('工作区里找不到这张卡片');
    const c = hit.card;
    if(params.thumb) c.thumb = params.thumb;
    if(params.full) c.full = params.full;
    if(params.meta) c.meta = params.meta;
    if(c.create && Array.isArray(params.slots)) c.create.slots = params.slots;
    if(c.create && Array.isArray(params.branches)) c.create.branches = params.branches;
    c.updatedAt = Date.now();
    saveData();
    renderWorkspaces();
    if($('#catList')) refreshList();
    renderStatus();
    return { ok:true, id:c.id };
  }
  function listCards(params){
    params = params || {};
    const only = String(params.only || '');
    const limit = Math.min(3000, Math.max(1, +params.limit || 1200));
    const withThumb = !!params.withThumb;
    const out = [];
    const wsList = params.workspaceId
      ? WS.filter(w => w.id === params.workspaceId)
      : params.current ? [currentWS()].filter(Boolean) : WS;
    const walk = (w, cat, cards) => {
      for(const c of (cards || [])){
        if(out.length >= limit) return;
        if(c.type === 'folder'){ if(Array.isArray(c.cards)) walk(w, cat, c.cards); continue; }
        if(only === 'anim' && !c.anim) continue;
        if(only === 'image' && !(c.full || c.thumb)) continue;
        if(only === 'create' && !c.create) continue;
        out.push({
          id:c.id, name:c.name, meta:c.meta || '', badge:c.badge || '',
          anim:!!c.anim, texSize:c.texSize || null,
          kind:c.create ? 'create' : c.armor ? 'armor' : c.composite ? 'composite' : c.block ? 'block' : c.ctex ? 'ctex' : c.anim ? 'anim' : 'tex',
          thumb:withThumb ? (c.thumb || null) : null,
          workspace:{ id:w.id, name:w.name }, category:cat.name
        });
      }
    };
    for(const w of wsList){
      for(const cat of (w.cats || [])) walk(w, cat, cat.cards);
    }
    return { total:out.length, truncated:out.length >= limit, cards:out };
  }
  function listLibrary(){
    return {
      current: currentWS() ? { id:currentWS().id, name:currentWS().name } : null,
      workspaces: WS.map(w => ({
        id:w.id, name:w.name, count:cardCount(w),
        cats:w.cats.map(c => ({ id:c.id, name:c.name, count:c.cards.length }))
      }))
    };
  }
  function ensureWorkspace(params){
    let ws = params.workspaceId ? WS.find(w => w.id === params.workspaceId) : null;
    if(!ws && params.name) ws = WS.find(w => w.name === params.name);
    if(!ws){
      ws = { id:uidWs(), name:String(params.name || '插件导入').slice(0,60), cats:[] };
      WS.push(ws);
      saveData(); renderWorkspaces();
    }
    return { id:ws.id, name:ws.name };
  }
  function zipRead(params){
    const input = params.buffer;
    if(!input) throw new Error('缺少 ZIP 数据');
    const blob = input instanceof ArrayBuffer ? new Blob([input]) : new Blob([input.buffer || input]);
    return PWArchive.read(blob).then(entries => {
      const id = 'a' + (++archiveSeq);
      archives.set(id, { entries, at:Date.now() });
      // 只保留最近 3 个包，避免内存堆积
      [...archives.keys()].slice(0, Math.max(0, archives.size - 3)).forEach(k => archives.delete(k));
      return {
        archiveId:id,
        entries:entries.filter(e => !e.dir).map(e => ({ name:e.name, size:e.size, method:e.method }))
      };
    });
  }
  function archiveOf(id){
    const a = archives.get(id);
    if(!a) throw new Error('ZIP 会话已过期，请重新打开插件');
    return a;
  }
  async function zipTextBatch(params){
    const a = archiveOf(params.archiveId);
    const names = Array.isArray(params.names) ? params.names.slice(0, 5000) : [];
    const out = {};
    const dec = new TextDecoder('utf-8');
    for(const name of names){
      const e = a.entries.find(x => x.name === name);
      if(!e) continue;
      try{ out[name] = dec.decode(await e.data()).replace(/^\uFEFF/, ''); }catch(_){}
    }
    return out;
  }
  async function zipDataURLs(params){
    const a = archiveOf(params.archiveId);
    const names = Array.isArray(params.names) ? params.names.slice(0, 500) : [];
    const out = {};
    for(const name of names){
      const e = a.entries.find(x => x.name === name);
      if(!e) continue;
      try{
        const bytes = await e.data();
        const mime = /\.png$/i.test(name) ? 'image/png' : /\.jpe?g$/i.test(name) ? 'image/jpeg' : 'application/octet-stream';
        out[name] = PWArchive.bytesDataURL(bytes, mime);
      }catch(_){}
    }
    return out;
  }
  async function netFetch(params){
    const raw = String(params.url || '').trim();
    if(!raw) throw new Error('缺少 URL');
    let url;
    try{ url = new URL(raw, location.href).href; }
    catch(_){ throw new Error('URL 格式不正确'); }
    if(!/^https?:/i.test(url)) throw new Error('只允许 http / https 地址');
    const max = Math.min(128 * 1024 * 1024, Math.max(1, +params.maxBytes || 64 * 1024 * 1024));
    const res = await fetch(url, { cache:'no-store' });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const buf = await res.arrayBuffer();
    if(buf.byteLength > max) throw new Error('文件超过大小限制');
    return { buffer:buf, size:buf.byteLength, url };
  }
  function storageKey(id){ return 'pixelWorkshop_plugin_' + id; }
  function storageGet(t){
    try{ return JSON.parse(localStorage.getItem(storageKey(t.payload.pluginId)) || 'null'); }
    catch(_){ return null; }
  }
  function storageSet(t, value){
    try{ localStorage.setItem(storageKey(t.payload.pluginId), JSON.stringify(value)); return true; }
    catch(_){ return false; }
  }
  async function apiCall(t, method, params){
    const p = pluginOf(t.payload.pluginId);
    if(!p) throw new Error('扩展不存在');
    if(method === 'context.get') return apiContext(t, p);
    if(method === 'toast'){ toast(String(params.message || '')); return true; }
    if(method === 'log'){ console.log('[plugin:' + p.manifest.id + ']', ...(params.args || [])); return true; }
    if(method === 'library.list'){ need(p, 'library.read'); return listLibrary(); }
    if(method === 'library.listCards'){ need(p, 'library.read'); return listCards(params); }
    if(method === 'library.getCard'){ need(p, 'library.read'); return getCard(params.id); }
    if(method === 'library.addCards'){ need(p, 'library.write'); return addCards(params); }
    if(method === 'library.updateCard'){ need(p, 'library.write'); return updateCard(params); }
    if(method === 'create.editTexture'){
      need(p, 'library.write');
      if(typeof openCreatePaint !== 'function') throw new Error('画布编辑接口不可用');
      openCreatePaint(t, params);
      return true;
    }
    if(method === 'plugins.openTool'){
      openTool(params.pluginId || p.manifest.id, params.toolId || 'create-blocks', params.payload || {});
      return true;
    }
    if(method === 'workspace.create'){ need(p, 'library.write'); return ensureWorkspace(params); }
    if(method === 'zip.read'){ need(p, 'zip.read'); return zipRead(params); }
    if(method === 'zip.textBatch'){ need(p, 'zip.read'); return zipTextBatch(params); }
    if(method === 'zip.dataURLs'){ need(p, 'zip.read'); return zipDataURLs(params); }
    if(method === 'net.fetch'){ need(p, 'network'); return netFetch(params); }
    if(method === 'assets.fetchTextures'){
      need(p, 'library.read');
      if(typeof PWAssets === 'undefined' || !PWAssets.resolveTextures) return { textures:{} };
      return { textures: await PWAssets.resolveTextures(params.paths || []) };
    }
    if(method === 'assets.syncTextures'){
      need(p, 'library.write');
      if(typeof PWAssets === 'undefined' || !PWAssets.importPluginTextures) throw new Error('素材库模块不可用');
      return await PWAssets.importPluginTextures(params.items || []);
    }
    if(method === 'assets.openLibrary'){
      if(typeof PWAssets !== 'undefined' && PWAssets.open) PWAssets.open();
      return true;
    }
    if(method === 'download'){
      need(p, 'download');
      const bytes = PWArchive.dataURLBytes('data:' + (params.mime || 'application/octet-stream') + ';base64,' + (params.base64 || ''));
      PWArchive.download(new Blob([bytes], {type:params.mime || 'application/octet-stream'}), params.filename || 'plugin-download');
      return true;
    }
    if(method === 'zip.create'){
      need(p, 'download');
      const list = Array.isArray(params.files) ? params.files.slice(0, 8000) : [];
      if(!list.length) throw new Error('没有要打包的文件');
      let total = 0;
      const files = list.map(f => {
        const bytes = PWArchive.dataURLBytes('data:application/octet-stream;base64,' + (f.base64 || ''));
        total += bytes.length;
        return { name:f.name, data:bytes };
      });
      if(total > 100 * 1024 * 1024) throw new Error('打包文件超过 100 MB');
      PWArchive.download(PWArchive.create(files), params.filename || 'plugin-bundle.zip');
      return { files:files.length, bytes:total };
    }
    if(method === 'storage.get') return storageGet(t);
    if(method === 'storage.set') return storageSet(t, params.value);
    throw new Error('未知 API：' + method);
  }
  async function handleApi(t, d){
    const respond = (ok, result, error) => sendRaw(t, {
      __pwPluginHost:1, type:'api-result', requestId:d.requestId, ok, result, error:error || null
    });
    try{
      const result = await apiCall(t, d.method, d.params || {});
      respond(true, result);
    }catch(err){
      respond(false, null, err && err.message ? err.message : String(err));
    }
  }
  window.addEventListener('message', e => {
    const d = e.data;
    if(!d || d.__pwPluginHost !== 1) return;
    const t = S.tabs.find(x => x.kind === 'plugin' && x._pluginFrame && x._pluginFrame.contentWindow === e.source);
    if(!t) return;
    if(d.type === 'ready'){ sendHostReady(t); return; }
    if(d.type === 'api'){ handleApi(t, d); }
  });

  /* ---------------- 扩展中心 ---------------- */
  function settingsRowHTML(){
    const all = list(), active = all.filter(p => p.enabled).length;
    return '<div class="opt" data-set="plugins"><div class="oi">' + iconSVG('box',16) + '</div>' +
      '<div class="ot"><b>扩展中心</b><span>已安装 ' + all.length + ' 个 · 已启用 ' + active + ' 个</span>' +
      '<i class="ost">官方可选扩展 / GitHub / 本地 ZIP</i></div><span class="sc-manage">管理 ›</span></div>';
  }
  function officialHTML(){
    return officialCatalog.map(item => {
      const p = installed[item.id];
      const state = p ? (p.enabled ? '已启用' : '已禁用') : '未安装';
      return `<div class="pl-row">
        <div class="pl-ico">${iconSVG(item.icon || 'box', 20)}</div>
        <div class="pl-info"><b>${esc(item.name)}<em class="pl-badge">官方可选</em></b><span>${esc(item.description)}</span></div>
        <div class="pl-state">${state}</div>
        <div class="pl-actions">
          ${p ? `<button class="btn sm" data-pl-open="${esc(item.id)}">打开</button>
                 <button class="btn sm" data-pl-toggle="${esc(item.id)}">${p.enabled ? '禁用' : '启用'}</button>
                 <button class="btn sm" data-pl-update="${esc(item.id)}">重装</button>
                 <button class="btn sm danger" data-pl-remove="${esc(item.id)}">卸载</button>`
              : `<button class="btn sm pri" data-pl-install-official="${esc(item.id)}">安装</button>`}
        </div>
      </div>`;
    }).join('');
  }
  function installedHTML(){
    const arr = list();
    if(!arr.length) return '<div class="pl-empty">还没有安装可选扩展。安装后会出现在左侧「工具」里。</div>';
    return arr.map(p => {
      const m = p.manifest;
      return `<div class="pl-row">
        <div class="pl-ico">${iconSVG(m.icon || 'box', 20)}</div>
        <div class="pl-info"><b>${esc(m.name)}<em class="pl-badge${m.official ? '' : ' third'}">${m.official ? '官方' : '第三方'}</em></b>
          <span>v${esc(m.version)} · ${esc(p.source || '本地')}</span></div>
        <div class="pl-state">${p.enabled ? '已启用' : '已禁用'}</div>
        <div class="pl-actions">
          <button class="btn sm" data-pl-open="${esc(m.id)}">打开</button>
          <button class="btn sm" data-pl-toggle="${esc(m.id)}">${p.enabled ? '禁用' : '启用'}</button>
          <button class="btn sm danger" data-pl-remove="${esc(m.id)}">卸载</button>
        </div>
      </div>`;
    }).join('');
  }
  function mountCenter(t, host){
    const pane = document.createElement('div');
    pane.className = 'ed-pane plugin-center-pane on';
    pane.dataset.tab = t.id;
    pane.innerHTML = `
    <div class="plugin-center-page">
      <div class="content-head rec-head">
        <div class="crumbs"><b>扩展中心</b><span>官方可选 · GitHub · 本地 ZIP · 沙箱运行</span></div>
        <div class="tools"><button class="btn sm" id="plLocal">导入本地 ZIP</button></div>
      </div>
      <div class="scroll pl-scroll">
        <section class="pl-install">
          <h3>从 GitHub 安装</h3>
          <div class="pl-url-row">
            <input id="plUrl" placeholder="https://github.com/owner/repo 或 raw plugin.json / .zip 地址" spellcheck="false">
            <button class="btn pri" id="plUrlGo">安装</button>
          </div>
          <p>支持仓库根目录的 <code>plugin.json</code>、raw 文件地址、release ZIP 或本地 ZIP。安装前会显示权限。</p>
        </section>
        <section class="pl-section"><div class="pl-section-head"><h3>官方可选扩展</h3><span>按需安装，不进入核心包</span></div><div id="plOfficial">${officialHTML()}</div></section>
        <section class="pl-section"><div class="pl-section-head"><h3>已安装</h3><span>可在左侧「工具」里打开</span></div><div id="plInstalled">${installedHTML()}</div></section>
        <p class="pl-note">插件运行在独立 sandbox iframe 中，不能直接操作主页面或 localStorage。扩展被禁用后，工具入口和插件标签页会同步关闭。</p>
      </div>
      <input type="file" id="plFile" accept=".zip,application/zip" hidden>
    </div>`;
    host.appendChild(pane);
    t._pane = pane; centerPane = pane;
    bindCenter(pane);
  }
  function renderCenter(pane){
    if(!pane) return;
    const o = pane.querySelector('#plOfficial'), i = pane.querySelector('#plInstalled');
    if(o) o.innerHTML = officialHTML();
    if(i) i.innerHTML = installedHTML();
    const row = document.querySelector('[data-set="plugins"] .ot span');
    if(row){
      const all = list(), active = all.filter(p => p.enabled).length;
      row.textContent = '已安装 ' + all.length + ' 个 · 已启用 ' + active + ' 个';
    }
  }
  function closePluginTabs(id){
    S.tabs.filter(t => t.kind === 'plugin' && t.payload && t.payload.pluginId === id)
      .forEach(t => closeTab(t.id, true));
  }
  function setEnabled(id, on){
    const p = pluginOf(id);
    if(!p) return;
    p.enabled = !!on;
    save();
    if(!on) closePluginTabs(id);
    refresh();
    if(centerPane) renderCenter(centerPane);
    toast(on ? '已启用扩展：' + p.manifest.name : '已禁用扩展：' + p.manifest.name);
  }
  function remove(id){
    const p = pluginOf(id);
    if(!p) return;
    confirmDialog('卸载扩展', '确定卸载「' + p.manifest.name + '」？不会删除插件导入的仓库内容。', '卸载', () => {
      delete installed[id];
      save();
      closePluginTabs(id);
      refresh();
      if(centerPane) renderCenter(centerPane);
      toast('已卸载扩展');
    });
  }
  function installOfficial(id){
    const item = officialCatalog.find(x => x.id === id);
    if(!item) return;
    installFromManifestUrl(item.source, item.source).catch(err => {
      toast('安装失败：' + err.message);
      console.error(err);
    });
  }
  function bindCenter(pane){
    const q = s => pane.querySelector(s);
    q('#plLocal').onclick = () => q('#plFile').click();
    q('#plFile').onchange = async e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if(!f) return;
      try{ await installFromZipBlob(f, '本地 ZIP'); if(centerPane) renderCenter(centerPane); }
      catch(err){ toast('安装失败：' + err.message); }
    };
    q('#plUrlGo').onclick = async () => {
      const input = q('#plUrl');
      const btn = q('#plUrlGo');
      btn.disabled = true; btn.textContent = '安装中…';
      try{ await installFromUrl(input.value); input.value = ''; }
      catch(err){ toast('安装失败：' + err.message); }
      finally{ btn.disabled = false; btn.textContent = '安装'; if(centerPane) renderCenter(centerPane); }
    };
    q('#plUrl').addEventListener('keydown', e => { if(e.key === 'Enter') q('#plUrlGo').click(); });
    pane.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if(!btn) return;
      const inst = btn.dataset.plInstallOfficial;
      const open = btn.dataset.plOpen;
      const tog = btn.dataset.plToggle;
      const upd = btn.dataset.plUpdate;
      const rem = btn.dataset.plRemove;
      if(inst){ installOfficial(inst); return; }
      if(open){
        const p = pluginOf(open);
        if(p && p.manifest.tools && p.manifest.tools[0]) openTool(open, p.manifest.tools[0].id);
        return;
      }
      if(tog){ setEnabled(tog, !isEnabled(tog)); return; }
      if(upd){
        const item = officialCatalog.find(x => x.id === upd);
        if(item) installFromManifestUrl(item.source, item.source).catch(err => toast('重装失败：' + err.message));
        return;
      }
      if(rem){ remove(rem); return; }
    });
  }

  async function syncOfficialUpdates(){
    for(const item of officialCatalog){
      const old = installed[item.id];
      if(!old) continue;
      if(old.source !== item.source && !(old.manifest && old.manifest.official)) continue;
      try{
        const absolute = new URL(item.source, location.href).href;
        const { manifest, manifestUrl } = await fetchManifest(absolute);
        if(String(manifest.version) === String(old.manifest && old.manifest.version || '')) continue;
        const entryUrl = new URL(manifest.entry, manifestUrl).href;
        const html = await fetchText(entryUrl);
        installed[item.id] = { manifest, html, source:item.source, enabled:old.enabled !== false, installedAt:Date.now() };
        save();
        refresh();
        if(centerPane && centerPane.isConnected) renderCenter(centerPane);
      }catch(_){}
    }
  }
  async function loadCatalog(){
    try{
      const res = await fetch('plugins/catalog.json', {cache:'no-store'});
      if(!res.ok) return;
      const d = await res.json();
      const list = Array.isArray(d) ? d : (d && d.plugins);
      if(Array.isArray(list) && list.length){
        officialCatalog = list.filter(x => x && x.id && x.name && x.source);
        if(centerPane) renderCenter(centerPane);
      }
    }catch(_){}
    syncOfficialUpdates();
  }

  /* ---------------- 启动 ---------------- */
  function init(){
    load();
    refresh();
    loadCatalog();
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-plugin-tool]');
      if(!b) return;
      const parts = String(b.dataset.pluginTool).split('::');
      if(parts.length === 2) openTool(parts[0], parts[1]);
    });
    document.addEventListener('pw-plugins-change', () => {
      if(centerPane && centerPane.isConnected) renderCenter(centerPane);
    });
  }

  return {
    init, list, tools, tool, pluginOf, isEnabled, openTool,
    openPluginCenter, mountCenter, mount, settingsRowHTML,
    installFromUrl, installFromManifestUrl, installFromZipBlob,
    setEnabled, remove, refresh
  };
})();
