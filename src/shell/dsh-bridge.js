/* ============================================================
   DSH / MCP 资产索引与引用桥接
   ------------------------------------------------------------
   目标：让工作区定稿的纹理、方块材质、动画、装备、模型导出为
   确定性结构化索引 (index.json) 与实体文件，避免 AI 幻觉路径或
   重新捏造贴图。
   ============================================================ */
const PWBridge = (() => {
  const LS_NS = 'pw_dsh_namespace';
  const LS_LAST = 'pw_dsh_last_sync';
  const BRIDGE_SCHEMA = 'clastar.dsh.asset-index/v1';

  function getNamespace(){
    try{
      const saved = localStorage.getItem(LS_NS);
      if(saved && saved.trim()) return slugify(saved, 'pixel_workshop');
    }catch(_){}
    const ws = typeof currentWS === 'function' ? currentWS() : null;
    return slugify(ws && ws.name, 'pixel_workshop');
  }
  function setNamespace(ns){
    const clean = slugify(ns, 'pixel_workshop');
    try{ localStorage.setItem(LS_NS, clean); }catch(_){}
    return clean;
  }
  function slugify(s, fallback){
    if(typeof PWArchive !== 'undefined' && PWArchive.slug){
      return PWArchive.slug(s, fallback);
    }
    const clean = String(s || '').trim().toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return clean || fallback || 'asset';
  }
  function dataUrlToBase64(url){
    const s = String(url || '');
    const idx = s.indexOf(',');
    return idx >= 0 ? s.slice(idx + 1) : '';
  }
  function base64ToBytes(b64){
    if(!b64) return new Uint8Array(0);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function stripNsPrefix(path){
    return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
  }
  function dimsOf(c){
    if(c && c.ctex && c.ctex.w && c.ctex.h) return c.ctex.w + 'x' + c.ctex.h;
    if(c && c.anim && c.frames && c.frames.length){
      const w = c.anim.w || 16, h = c.anim.h || 16;
      return w + 'x' + h + ' (' + c.frames.length + 'f)';
    }
    if(c && c.composite) return '128x128 (composite)';
    if(c && c.w && c.h) return c.w + 'x' + c.h;
    return '';
  }
  function inferKind(card, cat){
    if(!card) return 'texture';
    if(card.armor) return 'armor';
    if(card.block || card.composite) return 'block';
    if(card.anim) return 'anim';
    const p = String(card.packPath || '');
    if(/\/textures\/block\//.test(p)) return 'block';
    if(/\/textures\/item\//.test(p)) return 'item';
    if(/\/textures\/entity\//.test(p) || card.profile === 'armor') return 'equip';
    const catName = String((cat && cat.name) || '');
    if(/方块|block/i.test(catName)) return 'block';
    if(/物品|武器|工具|道具|item/i.test(catName)) return 'item';
    if(/盔甲|护甲|实体|equip/i.test(catName)) return 'equip';
    return 'texture';
  }
  function uniqueKey(used, key){
    if(!used.has(key)){ used.add(key); return key; }
    let n = 2;
    while(used.has(key + '_' + n)) n++;
    const out = key + '_' + n;
    used.add(out);
    return out;
  }

  function armorEntries(c, ns, slug){
    const textures = (c.armor && c.armor.textures) || {};
    const profile = (c.armor && c.armor.profile) || 'armor';
    const out = [];
    const add = (role, path) => {
      const url = textures[role];
      if(!url) return;
      out.push({
        role,
        path,
        encoding: 'base64',
        mime: 'image/png',
        data: dataUrlToBase64(url)
      });
    };
    if(profile === 'armor'){
      add('layer1', 'assets/' + ns + '/textures/models/armor/' + slug + '_layer_1.png');
      add('layer2', 'assets/' + ns + '/textures/models/armor/' + slug + '_layer_2.png');
      add('body', 'assets/' + ns + '/textures/entity/equipment/humanoid/' + slug + '.png');
    } else {
      add('body', 'assets/' + ns + '/textures/entity/' + profile + '/' + slug + '.png');
    }
    return out;
  }

  async function extractCardFiles(c, cat, ns, slug){
    const files = [];
    const kind = inferKind(c, cat);

    if(c.armor){
      return { kind, files: armorEntries(c, ns, slug), blockFaces: null, mcmeta: null };
    }
    if(c.composite){
      const sources = (c.composite && Array.isArray(c.composite.sources)) ? c.composite.sources : [];
      sources.forEach((url, i) => {
        if(!url) return;
        files.push({
          role: 'source_' + (i + 1),
          path: 'assets/' + ns + '/textures/block/' + slug + '_' + (i + 1) + '.png',
          encoding: 'base64',
          mime: 'image/png',
          data: dataUrlToBase64(url)
        });
      });
      if(typeof PWPack !== 'undefined' && PWPack.compositeCanvas){
        try{
          const cv = await PWPack.compositeCanvas(c);
          files.push({
            role: 'composite',
            path: 'assets/' + ns + '/textures/block/' + slug + '_composite.png',
            encoding: 'base64',
            mime: 'image/png',
            data: dataUrlToBase64(cv.toDataURL('image/png'))
          });
        }catch(_){}
      }
      return { kind, files, blockFaces: null, mcmeta: null };
    }
    if(c.create && Array.isArray(c.create.slots)){
      let metaOut = null;
      c.create.slots.forEach(slot => {
        if(!slot || !slot.data || !slot.packPath) return;
        const p = stripNsPrefix(slot.packPath);
        files.push({
          role: slot.role || 'slot',
          path: p,
          encoding: 'base64',
          mime: 'image/png',
          data: dataUrlToBase64(slot.data)
        });
        if(slot.mcmeta && typeof slot.mcmeta === 'object'){
          metaOut = slot.mcmeta;
          files.push({
            role: 'mcmeta',
            path: p + '.mcmeta',
            encoding: 'utf8',
            mime: 'application/json',
            data: JSON.stringify(slot.mcmeta, null, 2)
          });
        }
      });
      return { kind, files, blockFaces: null, mcmeta: metaOut };
    }
    if(c.block){
      const textures = (c.block && c.block.textures) || {};
      const keys = Object.keys(textures).filter(k => textures[k] && k !== 'particle');
      const blockFaces = {};
      if(keys.length === 1 && (keys[0] === 'all' || keys[0] === 'texture')){
        const p = 'assets/' + ns + '/textures/block/' + slug + '.png';
        blockFaces.all = p;
        files.push({
          role: 'all',
          path: p,
          encoding: 'base64',
          mime: 'image/png',
          data: dataUrlToBase64(textures[keys[0]])
        });
      } else {
        keys.forEach(k => {
          const face = slugify(k, 'face');
          const p = 'assets/' + ns + '/textures/block/' + slug + '_' + face + '.png';
          blockFaces[k] = p;
          files.push({
            role: k,
            path: p,
            encoding: 'base64',
            mime: 'image/png',
            data: dataUrlToBase64(textures[k])
          });
        });
      }
      return { kind: 'block', files, blockFaces, mcmeta: null };
    }

    const img = typeof cardImage === 'function' ? cardImage(c) : (c.img || c.thumb || null);
    if(!img) return { kind, files, blockFaces: null, mcmeta: null };
    const subDir = kind === 'block' ? 'block' : kind === 'equip' ? 'entity' : 'item';
    const path = c.packPath
      ? stripNsPrefix(c.packPath)
      : 'assets/' + ns + '/textures/' + subDir + '/' + slug + '.png';
    files.push({
      role: 'primary',
      path,
      encoding: 'base64',
      mime: 'image/png',
      data: dataUrlToBase64(img)
    });
    let mcmeta = null;
    if(c.anim || c.mcmeta){
      mcmeta = (c.mcmeta && typeof c.mcmeta === 'object') ? c.mcmeta : { animation: { frametime: 1 } };
      files.push({
        role: 'mcmeta',
        path: path + '.mcmeta',
        encoding: 'utf8',
        mime: 'application/json',
        data: JSON.stringify(mcmeta, null, 2)
      });
    }
    return { kind, files, blockFaces: null, mcmeta };
  }

  function walkCards(wsList){
    const out = [];
    wsList.forEach(ws => {
      if(!ws || !Array.isArray(ws.cats)) return;
      ws.cats.forEach(cat => {
        (cat.cards || []).forEach(c => {
          if(c.type === 'folder'){
            (c.cards || []).forEach(sub => {
              if(sub && sub.type !== 'folder') out.push({ ws, cat, folder: c, card: sub });
            });
          } else {
            out.push({ ws, cat, folder: null, card: c });
          }
        });
      });
    });
    return out;
  }

  async function collectModels(ns, includeFiles){
    const models = [];
    const modelFiles = [];
    if(typeof PWModels === 'undefined' || !PWModels.ensureLoaded) return { models, modelFiles };
    await PWModels.ensureLoaded();
    const sets = PWModels._getSets ? PWModels._getSets() : [];
    const usedSetSlugs = new Set();
    for(const set of sets){
      if(!set) continue;
      const setSlug = uniqueKey(usedSetSlugs, slugify(set.name, 'model_set'));
      const setRef = 'clastar:model:' + ns + ':' + setSlug;
      const parts = [];
      const usedPartSlugs = new Set();
      for(const part of (set.parts || [])){
        if(!part) continue;
        const pSlug = uniqueKey(usedPartSlugs, slugify(part.name, 'part'));
        const partPath = 'models/' + setSlug + '/' + pSlug + '.bbmodel';
        const partRef = setRef + '/' + pSlug;
        const raw = part.raw || (part.model ? JSON.stringify(part.model, null, 2) : '');
        const entry = {
          id: part.id,
          ref: partRef,
          name: part.name || pSlug,
          role: part.role || 'static',
          format: part.format || set.format || 'free',
          cubes: part.cubes || 0,
          bones: part.bones || 0,
          path: partPath
        };
        parts.push(entry);
        if(includeFiles && raw){
          modelFiles.push({ path: partPath, encoding: 'utf8', mime: 'application/json', data: raw, ref: partRef });
        }
      }
      models.push({
        id: set.id,
        ref: setRef,
        name: set.name || setSlug,
        format: set.format || 'free',
        updatedAt: set.updatedAt || null,
        parts
      });
    }
    return { models, modelFiles };
  }

  async function buildSnapshot(opts){
    opts = opts || {};
    const ns = opts.namespace ? slugify(opts.namespace, 'pixel_workshop') : getNamespace();
    const scope = opts.scope === 'current' ? 'current' : 'all';
    const includeFiles = opts.includeFiles !== false;
    const activeWs = typeof currentWS === 'function' ? currentWS() : null;
    let wsList = [];
    if(scope === 'current'){
      if(activeWs) wsList = [activeWs];
    } else if(typeof projectWorkspaces === 'function'){
      wsList = projectWorkspaces();
    } else if(typeof WS !== 'undefined' && Array.isArray(WS)){
      wsList = WS;
    }

    const items = walkCards(wsList);
    const usedRefs = new Set();
    const assets = [];
    const files = [];

    for(const item of items){
      const c = item.card;
      const kind = inferKind(c, item.cat);
      const baseSlug = slugify(c.name, kind);
      const refSlug = uniqueKey(usedRefs, kind + '\0' + baseSlug).split('\0')[1];
      const ref = 'clastar:' + kind + ':' + ns + ':' + refSlug;
      const extracted = await extractCardFiles(c, item.cat, ns, refSlug);
      const fileRefs = extracted.files.map(f => {
        if(includeFiles && f.data){
          files.push({ path: f.path, encoding: f.encoding, mime: f.mime, data: f.data, ref });
        }
        return f.path;
      });
      assets.push({
        id: c.id,
        ref,
        slug: refSlug,
        kind: extracted.kind || kind,
        name: c.name || refSlug,
        badge: c.badge || '',
        dimensions: dimsOf(c),
        workspaceId: item.ws.id,
        workspace: item.ws.name,
        category: item.cat.name,
        folder: item.folder ? item.folder.name : null,
        blockFaces: extracted.blockFaces,
        mcmeta: extracted.mcmeta,
        paths: fileRefs
      });
    }

    const { models, modelFiles } = await collectModels(ns, includeFiles);
    modelFiles.forEach(f => files.push(f));

    const index = {
      schema: BRIDGE_SCHEMA,
      appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '1.0.0',
      generatedAt: new Date().toISOString(),
      namespace: ns,
      activeWorkspaceId: activeWs ? activeWs.id : null,
      activeWorkspaceName: activeWs ? activeWs.name : null,
      counts: { assets: assets.length, models: models.length, files: files.length },
      assets,
      models
    };
    return { index, files };
  }

  async function buildCardEntry(cardId, ns){
    const hit = typeof findCardAnywhere === 'function' ? findCardAnywhere(cardId) : null;
    if(!hit || !hit.card || hit.card.type === 'folder') return null;
    const c = hit.card;
    const cleanNs = slugify(ns || getNamespace(), 'pixel_workshop');
    const kind = inferKind(c, hit.cat);
    const slug = slugify(c.name, kind);
    const ref = 'clastar:' + kind + ':' + cleanNs + ':' + slug;
    const extracted = await extractCardFiles(c, hit.cat, cleanNs, slug);
    return {
      id: c.id,
      ref,
      kind: extracted.kind || kind,
      name: c.name || slug,
      dimensions: dimsOf(c),
      workspace: hit.ws ? hit.ws.name : '',
      category: hit.cat ? hit.cat.name : '',
      folder: hit.folder ? hit.folder.name : null,
      blockFaces: extracted.blockFaces,
      mcmeta: extracted.mcmeta,
      paths: extracted.files.map(f => f.path)
    };
  }

  async function copyText(text){
    if(navigator.clipboard && navigator.clipboard.writeText){
      try{ await navigator.clipboard.writeText(text); return true; }catch(_){}
    }
    try{
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return !!ok;
    }catch(_){ return false; }
  }

  function formatPromptSnippet(entry){
    const lines = [
      '[' + entry.ref + '] ' + entry.name + (entry.dimensions ? ' (' + entry.dimensions + ')' : ''),
      '```json',
      JSON.stringify({
        ref: entry.ref,
        kind: entry.kind,
        name: entry.name,
        dimensions: entry.dimensions || undefined,
        paths: entry.paths,
        blockFaces: entry.blockFaces || undefined,
        mcmeta: entry.mcmeta || undefined
      }, null, 2),
      '```'
    ];
    return lines.join('\n');
  }

  async function copyRef(cardId){
    const entry = await buildCardEntry(cardId);
    if(!entry){ toast('无法生成资产引用'); return null; }
    const text = formatPromptSnippet(entry);
    const ok = await copyText(text);
    if(ok){
      toast('已复制 DSH 引用：' + entry.ref);
    } else {
      openTextPreview('复制 DSH 引用', text);
    }
    return entry;
  }

  async function probeLocalBridge(){
    try{
      const resp = await fetch('/api/dsh/health', { cache: 'no-store' });
      if(!resp.ok) return { ok: false };
      return await resp.json();
    }catch(_){ return { ok: false }; }
  }

  async function exportBridgeZip(snapshot){
    if(typeof PWArchive === 'undefined' || !PWArchive.create){
      throw new Error('缺少压缩打包模块 PWArchive');
    }
    const zipEntries = [
      { name: 'index.json', data: JSON.stringify(snapshot.index, null, 2) }
    ];
    snapshot.files.forEach(f => {
      const bytes = f.encoding === 'base64' ? base64ToBytes(f.data) : String(f.data || '');
      zipEntries.push({ name: 'files/' + stripNsPrefix(f.path), data: bytes });
    });
    const blob = PWArchive.create(zipEntries);
    PWArchive.download(blob, 'clastar-dsh-assets-' + snapshot.index.namespace + '.zip');
    return { ok: true, mode: 'zip', count: snapshot.index.counts.assets, modelsCount: snapshot.index.counts.models };
  }

  async function syncToLocal(opts){
    opts = opts || {};
    const snapshot = await buildSnapshot(opts);
    const payload = {
      index: snapshot.index,
      files: snapshot.files,
      prune: opts.prune !== false
    };
    try{
      const resp = await fetch('/api/dsh/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if(resp.ok){
        const res = await resp.json();
        try{
          localStorage.setItem(LS_LAST, JSON.stringify({
            at: snapshot.index.generatedAt,
            dir: res.dir || '',
            assets: snapshot.index.counts.assets,
            models: snapshot.index.counts.models
          }));
        }catch(_){}
        if(!opts.silent){
          toast('已同步 ' + snapshot.index.counts.assets + ' 个资产、' + snapshot.index.counts.models + ' 个模型到 DSH 索引');
        }
        return Object.assign({ ok: true, mode: 'local', index: snapshot.index }, res);
      }
      if(resp.status !== 404 && resp.status !== 405 && resp.status !== 501){
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || ('HTTP ' + resp.status));
      }
    }catch(e){
      if(opts.noFallback) throw e;
    }

    if(opts.fallbackZip === false){
      return { ok: false, mode: 'static', index: snapshot.index };
    }
    const zipRes = await exportBridgeZip(snapshot);
    if(!opts.silent) toast('当前为纯静态页面，已导出 DSH 资产索引 ZIP');
    return Object.assign(zipRes, { index: snapshot.index });
  }

  function mcpConfigSnippet(){
    return JSON.stringify({
      mcpServers: {
        'clastar-studio-assets': {
          command: 'python',
          args: ['tools/clastar_mcp.py'],
          env: {
            CLASTAR_DSH_BRIDGE_DIR: '~/.clastar-studio/dsh-bridge'
          }
        }
      }
    }, null, 2);
  }

  function openTextPreview(title, text){
    const old = document.getElementById('dshTextModal');
    if(old) old.remove();
    const mask = document.createElement('div');
    mask.className = 'pack-modal';
    mask.id = 'dshTextModal';
    mask.innerHTML =
      '<div class="pack-dlg" role="dialog" style="width:min(540px,94vw)">' +
        '<div class="pack-head"><div><h3>' + esc(title) + '</h3></div>' +
          '<button class="pack-x" data-close>✕</button></div>' +
        '<div class="pack-body"><textarea class="dsh-code" readonly rows="10">' + esc(text) + '</textarea></div>' +
        '<div class="pack-foot"><button class="btn light" data-close>关闭</button>' +
          '<button class="btn pri" id="dshCopyAgain">复制内容</button></div>' +
      '</div>';
    document.body.appendChild(mask);
    const close = () => mask.remove();
    mask.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
    mask.querySelector('#dshCopyAgain').onclick = async () => {
      if(await copyText(text)) toast('已复制到剪贴板');
    };
  }

  async function openModal(){
    const old = document.getElementById('dshBridgeModal');
    if(old) old.remove();
    const mask = document.createElement('div');
    mask.className = 'pack-modal';
    mask.id = 'dshBridgeModal';
    const ns = getNamespace();
    mask.innerHTML =
      '<div class="pack-dlg" role="dialog" aria-label="DSH 资产索引与 MCP 桥接" style="width:min(640px,95vw)">' +
        '<div class="pack-head"><div><h3>DSH 资产索引与 MCP 桥接</h3>' +
          '<p>把工作区定稿纹理、方块材质、动画与模型索引给 AI / DSH，避免幻觉路径或重绘资产</p></div>' +
          '<button class="pack-x" data-close title="关闭">✕</button></div>' +
        '<div class="pack-body">' +
          '<div class="dsh-status" id="dshStatusBox">正在检测本地 DSH 桥接服务…</div>' +
          '<div class="pack-grid" style="margin-top:8px">' +
            '<label>默认命名空间<input id="dshNsInput" value="' + esc(ns) + '" maxlength="48" spellcheck="false"></label>' +
            '<label>索引范围<select id="dshScopeSelect">' +
              '<option value="all">全部工作区（不含回收站）</option>' +
              '<option value="current">仅当前工作区</option>' +
            '</select></label>' +
          '</div>' +
          '<div class="dsh-toolbar">' +
            '<input id="dshSearchInput" placeholder="筛选资产名、引用句柄或路径…" autocomplete="off">' +
            '<button class="btn sm" id="dshCopyMcpBtn" type="button">复制 MCP 配置</button>' +
          '</div>' +
          '<div class="pack-preview"><div class="pack-preview-head">已索引内容 <span id="dshCountTag">0 项</span></div>' +
            '<div class="pack-paths dsh-list" id="dshAssetList">正在整理…</div></div>' +
        '</div>' +
        '<div class="pack-foot">' +
          '<button class="btn light" data-close>关闭</button>' +
          '<button class="btn" id="dshExportZipBtn" type="button">导出桥接 ZIP</button>' +
          '<button class="btn pri" id="dshSyncBtn" type="button">同步到 DSH 索引</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(mask);
    const close = () => mask.remove();
    mask.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
    mask.addEventListener('pointerdown', e => { if(e.target === mask) close(); });

    const nsInput = mask.querySelector('#dshNsInput');
    const scopeSel = mask.querySelector('#dshScopeSelect');
    const searchEl = mask.querySelector('#dshSearchInput');
    const listEl = mask.querySelector('#dshAssetList');
    const countTag = mask.querySelector('#dshCountTag');
    const statusBox = mask.querySelector('#dshStatusBox');

    let curSnap = null;
    async function refreshPreview(){
      const cleanNs = setNamespace(nsInput.value);
      curSnap = await buildSnapshot({ scope: scopeSel.value, namespace: cleanNs, includeFiles: false });
      const q = searchEl.value.trim().toLowerCase();
      const rows = [];
      curSnap.index.assets.forEach(a => {
        const hay = (a.name + ' ' + a.ref + ' ' + a.kind + ' ' + (a.paths || []).join(' ')).toLowerCase();
        if(q && !hay.includes(q)) return;
        rows.push({
          title: a.name,
          ref: a.ref,
          sub: a.kind + (a.dimensions ? ' · ' + a.dimensions : '') + ' · ' + a.workspace,
          payload: a
        });
      });
      curSnap.index.models.forEach(m => {
        const hay = (m.name + ' ' + m.ref + ' model ' + (m.format || '')).toLowerCase();
        if(q && !hay.includes(q)) return;
        rows.push({
          title: m.name,
          ref: m.ref,
          sub: 'model · ' + (m.parts ? m.parts.length : 0) + ' 个部件 · ' + (m.format || 'free'),
          payload: { ref: m.ref, kind: 'model', name: m.name, paths: (m.parts || []).map(p => p.path) }
        });
      });
      countTag.textContent = curSnap.index.counts.assets + ' 资产 / ' + curSnap.index.counts.models + ' 模型组';
      if(!rows.length){
        listEl.innerHTML = '<div class="more">暂无可索引内容，先在工作区创作或导入素材。</div>';
        return;
      }
      listEl.innerHTML = rows.slice(0, 60).map((r, idx) =>
        '<div class="dsh-row">' +
          '<div class="dsh-row-meta"><b>' + esc(r.title) + '</b><code>' + esc(r.ref) + '</code><span>' + esc(r.sub) + '</span></div>' +
          '<button class="btn sm" type="button" data-copy-idx="' + idx + '">复制引用</button>' +
        '</div>'
      ).join('') + (rows.length > 60 ? '<div class="more">… 还有 ' + (rows.length - 60) + ' 项（可用搜索筛选）</div>' : '');

      listEl.querySelectorAll('[data-copy-idx]').forEach(btn => {
        btn.onclick = async () => {
          const item = rows[+btn.dataset.copyIdx];
          if(!item) return;
          const text = formatPromptSnippet(item.payload);
          if(await copyText(text)) toast('已复制引用：' + item.ref);
          else openTextPreview('复制 DSH 引用', text);
        };
      });
    }

    async function refreshStatus(){
      const st = await probeLocalBridge();
      if(st && st.ok){
        statusBox.className = 'dsh-status ok';
        statusBox.innerHTML = '<b>本地 DSH 桥接已就绪</b> · 目录：<code>' + esc(st.dir || '~/.clastar-studio/dsh-bridge') + '</code>' +
          (st.indexExists ? '（已同步 ' + (st.assetsCount || 0) + ' 资产 / ' + (st.modelsCount || 0) + ' 模型）' : '（尚未同步）');
      } else {
        statusBox.className = 'dsh-status static';
        statusBox.innerHTML = '<b>纯静态页面模式</b> · 未检测到本地写入端点，可使用「复制引用」或「导出桥接 ZIP」供 DSH / MCP 导入。';
      }
    }

    nsInput.addEventListener('change', refreshPreview);
    scopeSel.addEventListener('change', refreshPreview);
    searchEl.addEventListener('input', refreshPreview);
    mask.querySelector('#dshCopyMcpBtn').onclick = async () => {
      const cfg = mcpConfigSnippet();
      if(await copyText(cfg)) toast('已复制 MCP 配置 JSON（tools/clastar_mcp.py）');
      else openTextPreview('MCP 配置 JSON', cfg);
    };
    mask.querySelector('#dshExportZipBtn').onclick = async () => {
      const snap = await buildSnapshot({ scope: scopeSel.value, namespace: setNamespace(nsInput.value), includeFiles: true });
      await exportBridgeZip(snap);
      toast('已导出 DSH 桥接 ZIP');
    };
    mask.querySelector('#dshSyncBtn').onclick = async () => {
      const btn = mask.querySelector('#dshSyncBtn');
      btn.disabled = true; btn.textContent = '同步中…';
      try{
        await syncToLocal({ scope: scopeSel.value, namespace: setNamespace(nsInput.value), includeFiles: true });
        await refreshStatus();
      }catch(err){
        toast('同步失败：' + (err && err.message ? err.message : String(err)));
      }finally{
        btn.disabled = false; btn.textContent = '同步到 DSH 索引';
      }
    };

    refreshStatus();
    refreshPreview();
  }

  return {
    getNamespace,
    setNamespace,
    buildSnapshot,
    buildCardEntry,
    copyRef,
    syncToLocal,
    probeLocalBridge,
    mcpConfigSnippet,
    openModal
  };
})();
window.PWBridge = PWBridge;
