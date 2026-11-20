/* ============================================================
   模型库 / Blockbench 桥接
   ------------------------------------------------------------
   - .bbmodel 与纹理放在 IndexedDB，localStorage 不再承担大文件
   - 一个“模型集”包含多个部件：静态 / 动态 / 物品 / 覆盖
   - 通过 postMessage 与 Blockbench 伴生插件交换工程，不 iframe 嵌入
   ============================================================ */
const PWModels = (() => {
  const DB_NAME = 'pixelWorkshopModels_v1';
  const DB_STORE = 'sets';
  const BRIDGE_ORIGIN = 'https://web.blockbench.net';
  const BRIDGE_URL = BRIDGE_ORIGIN + '/';
  const BRIDGE_PLUGIN = 'integrations/blockbench/clastar-bridge.js';
  const MAX_FILE = 28 * 1024 * 1024;
  const ROLE_LABEL = { static:'静态', dynamic:'动态', item:'物品', overlay:'覆盖' };
  const ROLE_ORDER = ['static','dynamic','item','overlay'];
  const AXIS_LABEL = { y:'Y 轴', x:'X 轴', z:'Z 轴', none:'不旋转' };
  const FORMAT_LABEL = {
    java_block:'Java 方块 / 物品', free:'通用模型', bedrock:'基岩实体', bedrock_block:'基岩方块',
    bedrock_old:'基岩旧版', modded_entity:'模组实体', optifine_entity:'OptiFine 实体',
    optifine_part:'OptiFine Part', skin:'皮肤', image:'图像', display_animation_sequence:'逐帧显示'
  };

  let page = null;
  let sets = [];
  let loaded = false;
  let storageError = '';
  let dbPromise = null;
  let pendingTarget = null;
  let pendingTexture = null;
  let state = { query:'', role:'all', sort:'recent', selected:null, angle:0, cam:{yaw:-35,pitch:26,zoom:1} };
  let bridge = { win:null, origin:BRIDGE_ORIGIN, nonce:'', ready:false, pending:null, ping:null, last:'' };
  let previewView = null;
  let mdPreviewDrag = null;
  let mdPreviewRaf = null;
  let mdPreviewObs = null;
  let createScan = null;
  let createSelected = new Set();
  let createQuery = '';

  /* ---------------- IndexedDB ---------------- */
  function openDB(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if(!('indexedDB' in window)){ reject(new Error('浏览器不支持 IndexedDB')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if(!db.objectStoreNames.contains(DB_STORE)){
          const st = db.createObjectStore(DB_STORE, { keyPath:'id' });
          st.createIndex('updatedAt', 'updatedAt');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB 打开失败'));
    });
    return dbPromise;
  }
  async function dbAll(){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const r = tx.objectStore(DB_STORE).getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error || new Error('读取模型失败'));
    });
  }
  async function dbPut(set){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(set);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('保存模型失败'));
    });
  }
  async function dbDelete(id){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('删除模型失败'));
    });
  }
  async function ensureLoaded(){
    if(loaded) return;
    try{
      sets = await dbAll();
      storageError = '';
    }catch(err){
      storageError = err && err.message ? err.message : String(err);
      sets = [];
    }
    sets.sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    loaded = true;
  }
  async function saveSet(set){
    set.updatedAt = Date.now();
    const i = sets.findIndex(x => x.id === set.id);
    if(i >= 0) sets[i] = set; else sets.push(set);
    try{ await dbPut(set); storageError = ''; }
    catch(err){ storageError = err && err.message ? err.message : String(err); }
  }
  async function removeSet(id){
    sets = sets.filter(x => x.id !== id);
    try{ await dbDelete(id); }catch(_){}
  }

  /* ---------------- 工具 ---------------- */
  function uid(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function makeNonce(){
    try{
      const a = new Uint8Array(16);
      crypto.getRandomValues(a);
      return [...a].map(n => n.toString(16).padStart(2,'0')).join('');
    }catch(_){ return Date.now().toString(36) + Math.random().toString(36).slice(2); }
  }
  function safeImage(src){ return /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(String(src || '')); }
  function formatLabel(f){ return FORMAT_LABEL[f] || f || '通用模型'; }
  function roleLabel(r){ return ROLE_LABEL[r] || '静态'; }
  function safeName(s, fallback){
    return (typeof PWArchive !== 'undefined' && PWArchive.safeName)
      ? PWArchive.safeName(s, fallback)
      : String(s || fallback || 'model').replace(/[\\/:*?"<>|]/g, '_');
  }
  function fmtBytes(n){
    n = Number(n) || 0;
    if(n < 1024) return n + ' B';
    if(n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
    return (n/1024/1024).toFixed(1) + ' MB';
  }
  function countGroups(list){
    let n = 0;
    (list || []).forEach(x => {
      if(x && Array.isArray(x.children)){
        n++;
        n += countGroups(x.children.filter(c => c && typeof c === 'object'));
      }
    });
    return n;
  }
  function modelMeta(raw, bytes){
    const res = raw.resolution || {};
    const textures = (raw.textures || []).filter(t => t && safeImage(t.source));
    return {
      format: (raw.meta && raw.meta.model_format) || 'free',
      formatVersion: (raw.meta && raw.meta.format_version) || '',
      width: +res.width || 16,
      height: +res.height || 16,
      elements: (raw.elements || []).length,
      groups: countGroups(raw.outliner || []),
      animations: (raw.animations || []).length,
      textures: textures.length,
      bytes: bytes || JSON.stringify(raw).length
    };
  }
  function firstTexture(raw){
    const t = ((raw && raw.textures) || []).find(x => x && safeImage(x.source));
    return t ? t.source : null;
  }
  function partTextures(part){
    return ((part && part.raw && part.raw.textures) || [])
      .map((t, index) => ({ index, name:t.name || 'texture.png', source:t.source || '' }))
      .filter(t => safeImage(t.source));
  }
  function textureCount(set){ return (set.parts || []).reduce((n,p) => n + (p.meta && p.meta.textures || 0), 0); }
  function setBytes(set){ return (set.parts || []).reduce((n,p) => n + (p.meta && p.meta.bytes || 0), 0); }
  function firstTextureOfSet(set){
    if(set.thumb && safeImage(set.thumb)) return set.thumb;
    for(const p of (set.parts || [])){
      const t = firstTexture(p.raw);
      if(t) return t;
    }
    return null;
  }
  function setById(id){ return sets.find(x => x.id === id) || null; }
  function findPart(id){
    for(const s of sets){
      const p = (s.parts || []).find(x => x.id === id);
      if(p) return { set:s, part:p };
    }
    return null;
  }
  function guessRole(name){
    const s = String(name || '').toLowerCase();
    if(/item|icon|gui|inventory/.test(s)) return 'item';
    if(/overlay|glow|emissive|mask/.test(s)) return 'overlay';
    if(/shaft|cog|gear|wheel|rotate|spin|fan|drill|saw|piston|belt|chain|dynamic|moving|flywheel|kinetic|移动|旋转|动态|齿轮|传动/.test(s)) return 'dynamic';
    return 'static';
  }

  /* ---------------- 导入 ---------------- */
  function readText(file){
    return new Promise((resolve, reject) => {
      if(file.size > MAX_FILE){ reject(new Error('文件超过 ' + fmtBytes(MAX_FILE))); return; }
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.onerror = () => reject(fr.error || new Error('读取文件失败'));
      fr.readAsText(file);
    });
  }
  function readDataURL(file){
    return new Promise((resolve, reject) => {
      if(file.size > MAX_FILE){ reject(new Error('文件超过 ' + fmtBytes(MAX_FILE))); return; }
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.onerror = () => reject(fr.error || new Error('读取纹理失败'));
      fr.readAsDataURL(file);
    });
  }
  function parseModel(text, filename){
    let raw;
    try{ raw = JSON.parse(text); }
    catch(_){ throw new Error('不是有效的 JSON / .bbmodel'); }
    if(!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('模型根节点必须是对象');
    if(!raw.meta || typeof raw.meta !== 'object') raw.meta = { format_version:'4.10', model_format:'free' };
    if(!Array.isArray(raw.elements)) raw.elements = [];
    if(!Array.isArray(raw.outliner)) raw.outliner = [];
    if(!Array.isArray(raw.textures)) raw.textures = [];
    const name = String(raw.name || String(filename || 'model').replace(/\.bbmodel$/i, '') || 'model').trim() || 'model';
    return { raw, name, meta: modelMeta(raw, text.length) };
  }
  async function partFromFile(file){
    const text = await readText(file);
    const m = parseModel(text, file.name);
    return {
      id: uid('p'),
      name: m.name,
      role: guessRole(file.name),
      axis: 'y',
      raw: m.raw,
      meta: m.meta,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: file.name
    };
  }
  async function importFiles(files, targetSetId){
    const list = [...(files || [])].filter(f => f && (/\.bbmodel$/i.test(f.name) || /\.json$/i.test(f.name) || /json/i.test(f.type || '')));
    if(!list.length){ toast('请选择 .bbmodel 文件'); return; }
    if(targetSetId && !setById(targetSetId)){ toast('模型集不存在'); return; }
    showBusy(true, targetSetId ? '正在添加部件…' : '正在导入模型…');
    let ok = 0, fail = 0, lastId = null;
    try{
      if(targetSetId){
        const set = setById(targetSetId);
        for(const f of list){
          try{
            const part = await partFromFile(f);
            if(set.parts.length >= 64) throw new Error('单个模型集最多 64 个部件');
            set.parts.push(part);
            ok++; lastId = set.id;
          }catch(err){ fail++; console.warn('模型部件导入失败', f.name, err); }
        }
        if(ok){
          set.updatedAt = Date.now();
          if(!set.thumb){
            const t = firstTextureOfSet(set);
            if(t) set.thumb = t;
          }
          await saveSet(set);
        }
      }else{
        for(const f of list){
          try{
            const part = await partFromFile(f);
            const set = {
              id: uid('s'), name: part.name, createdAt: Date.now(), updatedAt: Date.now(),
              thumb: firstTexture(part.raw), source: f.name, parts: [part]
            };
            await saveSet(set);
            ok++; lastId = set.id;
          }catch(err){ fail++; console.warn('模型导入失败', f.name, err); }
        }
      }
    }finally{ showBusy(false); }
    if(lastId) state.selected = lastId;
    if(page) render(page);
    toast(fail
      ? `模型库：成功 ${ok}，失败 ${fail}${ok ? '' : '（查看控制台了解原因）'}`
      : `模型库：已导入 ${ok} 个${targetSetId ? '部件' : '模型'}`);
  }
  async function addPartFiles(files){
    const target = pendingTarget;
    pendingTarget = null;
    await importFiles(files, target || null);
  }

  /* ---------------- Create 模型集导入 ---------------- */
  function createFiltered(){
    const all = createScan ? createScan.families : [];
    const q = createQuery.trim().toLowerCase();
    if(!q) return all;
    return all.filter(f => (f.id + ' ' + f.modelKey).toLowerCase().includes(q));
  }
  function updatePickCount(){
    const el = page && page.querySelector('#mdPickCount');
    if(el) el.textContent = `已选 ${createSelected.size} / 当前 ${createFiltered().length} · 共 ${createScan ? createScan.families.length : 0}`;
  }
  function renderPicker(){
    if(!page || !createScan) return;
    const box = page.querySelector('#mdPicker');
    if(!box) return;
    box.hidden = false;
    const info = page.querySelector('#mdPickInfo');
    if(info) info.textContent = `${createScan.fileName} · ${createScan.families.length} 个方块族 · ${createScan.textureEntries.size} 张纹理`;
    const list = page.querySelector('#mdPickList');
    const items = createFiltered();
    if(list){
      list.innerHTML = items.length ? items.map(f => `<label class="md-pick-row">
        <input type="checkbox" data-family="${esc(f.id)}"${createSelected.has(f.id) ? ' checked' : ''}>
        <span class="md-pick-name"><b>${esc(f.id)}</b><i>${esc(f.modelKey)} · ${f.elementCount} 元素${f.dynamicCount ? ' · ' + f.dynamicCount + ' 动态' : ''}</i></span>
        <em class="${f.dynamicCount ? 'dyn' : 'static'}">${f.dynamicCount ? '动静' : '静态'}</em>
      </label>`).join('') : '<div class="md-pick-empty">没有匹配的方块族</div>';
    }
    updatePickCount();
  }
  async function scanCreate(file){
    if(typeof PWCreateModels === 'undefined'){ toast('Create 扫描器没有加载'); return; }
    showBusy(true, `读取 ${file.name}…`);
    try{
      const scan = await PWCreateModels.scan(file, (done, total) => busyText(`扫描 Create 模型 ${done}/${total}`));
      createScan = scan;
      createSelected = new Set();
      createQuery = '';
      const search = page && page.querySelector('#mdPickSearch');
      if(search) search.value = '';
      showBusy(false);
      if(!scan.families.length){ toast('没有找到可导入的 Create 方块族'); return; }
      renderPicker();
    }catch(err){
      showBusy(false);
      toast('Create 扫描失败：' + (err.message || err));
    }
  }
  async function importCreateSelected(){
    if(!createScan || !createSelected.size){ toast('先勾选要导入的方块族'); return; }
    const scan = createScan;
    const families = scan.families.filter(f => createSelected.has(f.id));
    const picker = page && page.querySelector('#mdPicker');
    if(picker) picker.hidden = true;
    showBusy(true, `导入 ${families.length} 个 Create 模型集…`);
    const cache = new Map();
    let done = 0, fail = 0, lastId = null;
    for(const family of families){
      try{
        const parts = await PWCreateModels.buildParts(family, scan.textureEntries, scan.fileName, cache);
        parts.forEach(part => { part.meta = modelMeta(part.raw, JSON.stringify(part.raw).length); part.updatedAt = Date.now(); });
        if(parts.length){
          const set = {
            id:uid('s'), name:family.id, createdAt:Date.now(), updatedAt:Date.now(),
            thumb:null, source:`${scan.fileName} · ${family.modelKey}`,
            create:{ blockstateId:family.id, modelKey:family.modelKey, refs:family.refs },
            parts
          };
          const t = firstTextureOfSet(set); if(t) set.thumb = t;
          await saveSet(set);
          lastId = set.id;
        }else{
          fail++;
        }
      }catch(err){
        fail++;
        console.warn('Create 模型集导入失败', family.id, err);
      }
      done++;
      busyText(`导入 ${done}/${families.length} · ${family.id}`);
      if(done % 4 === 0) await new Promise(r => setTimeout(r, 0));
    }
    showBusy(false);
    if(lastId) state.selected = lastId;
    if(page) render(page);
    toast(`Create 导入：成功 ${done - fail}，失败 ${fail}`);
  }

  /* ---------------- 渲染 ---------------- */
  function allRoles(set){
    const out = [];
    (set.parts || []).forEach(p => { if(!out.includes(p.role)) out.push(p.role); });
    return ROLE_ORDER.filter(r => out.includes(r));
  }
  function filteredSets(){
    const q = state.query.trim().toLowerCase();
    return sets.filter(set => {
      if(state.role !== 'all' && !(set.parts || []).some(p => p.role === state.role)) return false;
      if(q){
        const hay = [set.name, ...(set.parts || []).map(p => p.name), ...(set.parts || []).map(p => p.meta && p.meta.format)]
          .join(' ').toLowerCase();
        if(!hay.includes(q)) return false;
      }
      return true;
    }).sort((a,b) => {
      if(state.sort === 'name') return String(a.name).localeCompare(String(b.name), 'zh');
      if(state.sort === 'parts') return (b.parts || []).length - (a.parts || []).length;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }
  function bridgeStateText(){
    if(bridge.ready) return '已连接';
    if(bridge.win && !bridge.win.closed) return bridge.last === 'no-plugin' ? '等待插件' : '连接中…';
    return '未连接';
  }
  function bridgeHTML(){
    const cls = bridge.ready ? ' on' : (bridge.win && !bridge.win.closed ? ' pending' : '');
    return `<div class="md-bridge${cls}" id="mdBridge">
      <div class="md-bridge-head"><b>Blockbench 桥接</b><span>${esc(bridgeStateText())}</span></div>
      <p>${bridge.ready ? '已连接。点击部件的「BB 编辑」，改完在 Blockbench 里执行「同步回像素工坊」。' : '首次使用：下载插件并拖入 Blockbench，再点连接。'}</p>
      <div class="md-bridge-actions">
        <button class="btn sm" data-md-act="connect">${bridge.ready ? '重新连接' : '连接'}</button>
        <button class="btn sm" data-md-act="plugin">下载插件</button>
      </div>
    </div>`;
  }
  function pageHTML(){
    return `<div class="model-page">
      <div class="content-head rec-head">
        <div class="crumbs"><b>模型库</b><span>Blockbench 模型 · 静态 / 动态部件 · 纹理分离</span></div>
        <div class="tools">
          <button class="btn sm" id="mdImport">导入 .bbmodel</button>
          <button class="btn sm" id="mdCreateImport" title="从 Create jar / 资源包生成静态/动态部件">导入 Create</button>
          <button class="btn sm" id="mdLocalHelp" title="本地 Create 内容包说明">本地内容包说明</button>
          <button class="btn sm" id="mdRefresh">刷新</button>
        </div>
      </div>
      <div class="scroll md-scroll">
        <div class="md-layout">
          <aside class="md-side">
            <div class="md-summary" id="mdSummary"></div>
            <div class="md-block">
              <h3>部件类型</h3>
              <div class="md-filters" id="mdFilters"></div>
            </div>
            <div class="md-block md-bridge-wrap" id="mdBridgeWrap">${bridgeHTML()}</div>
            <div class="md-tip">
              模型与纹理保存在浏览器 IndexedDB，不占工作区；<code>.bbmodel</code> 只是编辑中间格式。
            </div>
          </aside>
          <main class="md-main">
            <div class="md-toolbar">
              <label class="search md-search">${iconSVG('search',12)}<input id="mdSearch" placeholder="搜索模型 / 部件 / 格式…" autocomplete="off"></label>
              <select class="md-sort" id="mdSort">
                <option value="recent">最近更新</option>
                <option value="name">名称</option>
                <option value="parts">部件数</option>
              </select>
              <span class="md-count" id="mdCount"></span>
            </div>
            <div class="md-grid" id="mdGrid"></div>
          </main>
          <aside class="md-detail" id="mdDetail"></aside>
        </div>
      </div>
      <div class="md-importing" id="mdImporting" hidden>
        <div><b>正在处理模型…</b><span id="mdProgress">准备中</span></div>
      </div>
      <input type="file" id="mdFile" accept=".bbmodel,.json,application/json" multiple hidden>
      <input type="file" id="mdCreateFile" accept=".jar,.zip,application/zip,application/java-archive" hidden>
      <input type="file" id="mdTexFile" accept="image/png,image/jpeg,image/webp" hidden>
      <div class="md-picker" id="mdPicker" hidden>
        <div class="md-picker-box">
          <div class="md-picker-head"><b>Create 模型集导入</b><button class="icon-btn" data-pick-close="1" title="关闭">×</button></div>
          <div class="md-picker-info" id="mdPickInfo"></div>
          <div class="md-picker-note">按元素名称粗分静态 / 动态；复杂模型导入后可手动改部件类型。</div>
          <div class="md-picker-tools">
            <label class="search md-pick-search">${iconSVG('search',12)}<input id="mdPickSearch" placeholder="搜索方块 ID…" autocomplete="off"></label>
            <button class="btn sm" id="mdPickAll">全选当前</button>
            <button class="btn sm" id="mdPickNone">清空</button>
          </div>
          <div class="md-picker-list" id="mdPickList"></div>
          <div class="md-picker-foot">
            <span id="mdPickCount"></span>
            <button class="btn sm" id="mdPickCancel">取消</button>
            <button class="btn pri" id="mdPickGo">导入选中</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function render(pane){
    if(!pane) return;
    if(state.selected && !setById(state.selected)) state.selected = null;
    if(!state.selected && sets.length) state.selected = sets[0].id;
    const totalParts = sets.reduce((n,s) => n + (s.parts || []).length, 0);
    const totalTex = sets.reduce((n,s) => n + textureCount(s), 0);
    const totalBytes = sets.reduce((n,s) => n + setBytes(s), 0);
    const summary = pane.querySelector('#mdSummary');
    if(summary) summary.innerHTML = `<b>${sets.length}</b> 个模型集<span>${totalParts} 部件 · ${totalTex} 纹理 · ${fmtBytes(totalBytes)}</span>`;

    const filters = pane.querySelector('#mdFilters');
    if(filters){
      const counts = { all:sets.length, static:0, dynamic:0, item:0, overlay:0 };
      sets.forEach(s => { const rs = allRoles(s); rs.forEach(r => { if(counts[r] != null) counts[r]++; }); });
      filters.innerHTML = [
        ['all','全部'], ['static','静态'], ['dynamic','动态'], ['item','物品'], ['overlay','覆盖']
      ].map(([k,label]) => `<button class="md-filter${state.role===k?' on':''}" data-role-filter="${k}">${label}<em>${counts[k] || 0}</em></button>`).join('');
    }

    const list = filteredSets();
    const grid = pane.querySelector('#mdGrid');
    const count = pane.querySelector('#mdCount');
    if(count) count.textContent = sets.length ? `${list.length} / ${sets.length}` : '';
    if(grid){
      if(!list.length){
        grid.innerHTML = `<div class="md-empty"><b>${sets.length ? '没有符合条件的模型' : '模型库还是空的'}</b>
          <span>${sets.length ? '换一个部件类型或搜索词。' : '导入 .bbmodel，或把多个模型作为静态/动态部件加入同一个模型集。'}</span>
          ${sets.length ? '' : '<button class="btn pri" data-md-act="import">导入第一个模型</button>'}</div>`;
      }else{
        grid.innerHTML = list.map(set => {
          const th = firstTextureOfSet(set);
          const roles = allRoles(set).map(r => `<i class="md-role ${r}">${roleLabel(r)}</i>`).join('');
          return `<button class="md-card${state.selected===set.id?' on':''}" data-model="${esc(set.id)}" title="${esc(set.name)}">
            <span class="md-thumb">${th ? `<img src="${esc(th)}" alt="" loading="lazy">` : `<span class="md-thumb-empty">${iconSVG('box',24)}<b>BB</b></span>`}</span>
            <span class="md-name">${esc(set.name)}</span>
            <span class="md-meta">${(set.parts || []).length} 部件 · ${textureCount(set)} 纹理</span>
            <span class="md-roles">${roles}</span>
          </button>`;
        }).join('');
      }
    }
    renderDetail(pane);
    if(storageError){
      const tip = pane.querySelector('.md-tip');
      if(tip && !tip.dataset.warned){
        tip.dataset.warned = '1';
        tip.innerHTML = '<span style="color:var(--warn)">IndexedDB 不可用：' + esc(storageError) + '。本次模型只保存在内存，刷新会丢失。</span>';
      }
    }
    paintIcons(pane);
  }

  function renderDetail(pane){
    const box = pane && pane.querySelector('#mdDetail');
    if(!box) return;
    const set = state.selected ? setById(state.selected) : null;
    if(!set){
      box.innerHTML = '<div class="md-detail-empty">选一个模型集查看详情<br><span>支持在 Blockbench 中打开并回存</span></div>';
      return;
    }
    const parts = set.parts || [];
    const hasDynamic = parts.some(p => p.role === 'dynamic' && (p.axis || 'y') !== 'none');
    const roles = allRoles(set).map(r => `<i class="md-role ${r}">${roleLabel(r)}</i>`).join('');
    box.innerHTML = `
      <div class="md-preview" id="mdPreviewWrap">${parts.length ? '<canvas id="mdPreviewCanvas"></canvas>' : `<span class="md-preview-empty">${iconSVG('box',36)}<b>Blockbench 模型</b></span>`}</div>
      ${parts.length ? `<div class="md-preview-tools"><span>拖动旋转 · Ctrl+滚轮缩放</span><button class="btn sm" data-md-preview-reset>重置视角</button><button class="btn sm" data-md-preview-expand>放大</button></div>` : ''}
      ${hasDynamic ? `<div class="md-angle-row"><span>动态角度</span><input type="range" id="mdAngle" min="0" max="360" value="${state.angle || 0}"><b id="mdAngleV">${state.angle || 0}°</b></div>` : ''}
      <h3>${esc(set.name)}</h3>
      <div class="md-meta-list">
        <div><span>部件</span><b>${parts.length}</b></div>
        <div><span>纹理</span><b>${textureCount(set)}</b></div>
        <div><span>大小</span><b>${fmtBytes(setBytes(set))}</b></div>
        <div><span>类型</span><b>${roles || '—'}</b></div>
        <div><span>更新</span><b>${set.updatedAt ? new Date(set.updatedAt).toLocaleString() : '—'}</b></div>
        ${set.source ? `<div><span>来源</span><b title="${esc(set.source)}">${esc(set.source)}</b></div>` : ''}
      </div>
      <div class="md-actions">
        <button class="btn pri" data-md-act="edit"${parts.length ? '' : ' disabled'}>在 Blockbench 编辑</button>
        <button class="btn" data-md-act="add">添加部件</button>
        <button class="btn sm" data-md-act="export">导出模型集 ZIP</button>
        <button class="btn sm" data-md-act="rename">重命名</button>
        <button class="btn sm danger" data-md-act="delete">删除</button>
      </div>
      <div class="md-parts">
        <div class="md-section-head"><b>部件</b><span>静态外壳 / 动态机构 / 物品 / 覆盖层</span></div>
        ${parts.length ? parts.map(part => {
          const tex = partTextures(part);
          const texHtml = tex.map(t => `<button class="md-tex" data-tex-index="${t.index}" title="替换纹理：${esc(t.name)}"><img src="${esc(t.source)}" alt="${esc(t.name)}"></button>`).join('');
          return `<div class="md-part" data-part="${esc(part.id)}">
            <div class="md-part-head">
              <b title="${esc(part.name)}">${esc(part.name)}</b>
              <span class="md-role ${esc(part.role)}">${roleLabel(part.role)}</span>
            </div>
            <div class="md-part-meta">${esc(formatLabel(part.meta.format))} · ${part.meta.elements} 立方体 · ${part.meta.groups} 组 · ${part.meta.textures} 纹理</div>
            <div class="md-part-controls">
              <label>类型<select data-part-role>${ROLE_ORDER.map(r => `<option value="${r}"${part.role===r?' selected':''}>${roleLabel(r)}</option>`).join('')}</select></label>
              ${part.role === 'dynamic' ? `<label>旋转轴<select data-part-axis>${Object.keys(AXIS_LABEL).map(a => `<option value="${a}"${(part.axis||'y')===a?' selected':''}>${AXIS_LABEL[a]}</option>`).join('')}</select></label>` : ''}
            </div>
            <div class="md-part-textures">${texHtml || '<span class="md-no-tex">没有内嵌纹理</span>'}</div>
            ${tex.length ? '<div class="md-tex-hint">点纹理可单独替换</div>' : ''}
            <div class="md-part-actions">
              <button class="btn sm" data-part-act="edit">BB 编辑</button>
              <button class="btn sm" data-part-act="export">导出 .bbmodel</button>
              <button class="btn sm danger" data-part-act="remove">移除</button>
            </div>
          </div>`;
        }).join('') : '<div class="md-part-empty">还没有部件。点「添加部件」导入静态或动态模型。</div>'}
      </div>
      <p class="md-detail-tip">动态部件的旋转轴会写入模型集清单；预览是等距近似，不做 Create/Flywheel 的运行时模拟。</p>`;
    drawPreview(box, set);
  }

  function redrawMdPreview(){
    if(mdPreviewRaf) cancelAnimationFrame(mdPreviewRaf);
    mdPreviewRaf = requestAnimationFrame(() => {
      mdPreviewRaf = null;
      const set = state.selected ? setById(state.selected) : null;
      if(set && page) drawPreview(page.querySelector('#mdDetail'), set);
    });
  }
  function observeMdPreview(){
    if(mdPreviewObs){ try{ mdPreviewObs.disconnect(); }catch(_){} mdPreviewObs = null; }
    const wrap = page && page.querySelector('#mdPreviewWrap');
    if(wrap && typeof ResizeObserver !== 'undefined'){
      mdPreviewObs = new ResizeObserver(() => redrawMdPreview());
      mdPreviewObs.observe(wrap);
    }
  }
  function bindMdPreview(pane){
    const detail = pane.querySelector('#mdDetail');
    if(!detail) return;
    detail.addEventListener('pointerdown', e => {
      const cv = e.target.closest('#mdPreviewCanvas');
      if(!cv || e.button !== 0) return;
      mdPreviewDrag = { id:e.pointerId, x:e.clientX, y:e.clientY, yaw:state.cam.yaw, pitch:state.cam.pitch };
      try{ cv.setPointerCapture(e.pointerId); }catch(_){}
      cv.classList.add('dragging');
      e.preventDefault();
    });
    detail.addEventListener('pointermove', e => {
      if(!mdPreviewDrag || e.pointerId !== mdPreviewDrag.id) return;
      state.cam.yaw = mdPreviewDrag.yaw - (e.clientX - mdPreviewDrag.x) * 0.65;
      state.cam.pitch = Math.max(-85, Math.min(85, mdPreviewDrag.pitch + (e.clientY - mdPreviewDrag.y) * 0.55));
      redrawMdPreview();
    });
    const end = e => {
      if(!mdPreviewDrag || (e.pointerId != null && e.pointerId !== mdPreviewDrag.id)) return;
      const cv = e.target.closest && e.target.closest('#mdPreviewCanvas');
      if(cv) cv.classList.remove('dragging');
      mdPreviewDrag = null;
    };
    detail.addEventListener('pointerup', end);
    detail.addEventListener('pointercancel', end);
    detail.addEventListener('wheel', e => {
      const cv = e.target.closest('#mdPreviewCanvas');
      if(!cv || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      state.cam.zoom = Math.max(0.35, Math.min(4, state.cam.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
      redrawMdPreview();
    }, { passive:false });
    detail.addEventListener('click', e => {
      if(e.target.closest('[data-md-preview-reset]')){
        state.cam = { yaw:-35, pitch:26, zoom:1 };
        redrawMdPreview();
      }else if(e.target.closest('[data-md-preview-expand]')){
        const wrap = detail.querySelector('#mdPreviewWrap');
        if(!wrap) return;
        wrap.classList.toggle('expanded');
        const btn = e.target.closest('[data-md-preview-expand]');
        if(btn) btn.textContent = wrap.classList.contains('expanded') ? '还原' : '放大';
        setTimeout(redrawMdPreview, 80);
      }
    });
  }
  function drawPreview(box, set){
    if(previewView){ try{ previewView.destroy(); }catch(_){} previewView = null; }
    const canvas = box && box.querySelector('#mdPreviewCanvas');
    if(!canvas || typeof PWModelView === 'undefined') return;
    try{
      previewView = PWModelView.render(canvas, set, {
        angle:state.angle || 0,
        yaw:state.cam.yaw, pitch:state.cam.pitch, zoom:state.cam.zoom
      });
      observeMdPreview();
    }catch(err){ console.warn('模型预览失败', err); }
  }

  function refreshBridge(){
    if(!page) return;
    const wrap = page.querySelector('#mdBridgeWrap');
    if(wrap) wrap.innerHTML = bridgeHTML();
    paintIcons(page);
  }

  /* ---------------- 交互 ---------------- */
  function bind(pane){
    const q = s => pane.querySelector(s);
    q('#mdImport').onclick = () => { pendingTarget = null; q('#mdFile').click(); };
    q('#mdLocalHelp').onclick = () => showLocalPackHelp('create');
    q('#mdRefresh').onclick = async () => {
      loaded = false;
      await ensureLoaded();
      render(pane);
      toast('模型库已刷新');
    };
    q('#mdFile').onchange = async e => {
      const files = [...(e.target.files || [])];
      e.target.value = '';
      if(files.length) await addPartFiles(files);
    };
    q('#mdCreateImport').onclick = () => q('#mdCreateFile').click();
    q('#mdCreateFile').onchange = async e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if(file) await scanCreate(file);
    };
    q('#mdPickSearch').addEventListener('input', e => { createQuery = e.target.value; renderPicker(); });
    q('#mdPickList').addEventListener('change', e => {
      const cb = e.target.closest('[data-family]');
      if(!cb) return;
      if(cb.checked) createSelected.add(cb.dataset.family);
      else createSelected.delete(cb.dataset.family);
      updatePickCount();
    });
    q('#mdPickAll').onclick = () => { createFiltered().forEach(f => createSelected.add(f.id)); renderPicker(); };
    q('#mdPickNone').onclick = () => { createSelected.clear(); renderPicker(); };
    q('#mdPickCancel').onclick = () => { q('#mdPicker').hidden = true; };
    q('#mdPickGo').onclick = importCreateSelected;
    q('#mdPicker').addEventListener('click', e => { if(e.target.closest('[data-pick-close]')) q('#mdPicker').hidden = true; });
    q('#mdTexFile').onchange = async e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      const target = pendingTexture;
      pendingTexture = null;
      if(file && target) await replaceTexture(target, file);
    };
    q('#mdSearch').addEventListener('input', e => { state.query = e.target.value; render(pane); });
    q('#mdSort').addEventListener('change', e => { state.sort = e.target.value; render(pane); });
    q('#mdFilters').addEventListener('click', e => {
      const b = e.target.closest('[data-role-filter]');
      if(!b) return;
      state.role = b.dataset.roleFilter;
      render(pane);
    });
    q('#mdGrid').addEventListener('click', e => {
      const c = e.target.closest('[data-model]');
      if(!c) return;
      state.selected = c.dataset.model;
      render(pane);
    });
    q('#mdGrid').addEventListener('dblclick', e => {
      const c = e.target.closest('[data-model]');
      if(!c) return;
      state.selected = c.dataset.model;
      const set = setById(c.dataset.model);
      if(set && set.parts && set.parts[0]) openInBlockbench(set, set.parts[0]);
    });
    pane.addEventListener('click', e => {
      const b = e.target.closest('[data-md-act]');
      if(!b) return;
      handleAction(b.dataset.mdAct);
    });
    q('#mdDetail').addEventListener('click', e => {
      const texBtn = e.target.closest('[data-tex-index]');
      if(texBtn){
        const partEl = texBtn.closest('[data-part]');
        if(!partEl) return;
        pendingTexture = { partId:partEl.dataset.part, index:+texBtn.dataset.texIndex };
        page.querySelector('#mdTexFile').click();
        return;
      }
      const b = e.target.closest('[data-part-act]');
      if(!b) return;
      const partEl = b.closest('[data-part]');
      if(!partEl) return;
      handlePartAction(b.dataset.partAct, partEl.dataset.part);
    });
    q('#mdDetail').addEventListener('input', e => {
      if(e.target.id !== 'mdAngle') return;
      state.angle = +e.target.value || 0;
      const v = page.querySelector('#mdAngleV'); if(v) v.textContent = state.angle + '°';
      const set = state.selected ? setById(state.selected) : null;
      if(set) drawPreview(page.querySelector('#mdDetail'), set);
    });
    q('#mdDetail').addEventListener('change', e => {
      const roleSel = e.target.closest('[data-part-role]');
      const axisSel = e.target.closest('[data-part-axis]');
      if(!roleSel && !axisSel) return;
      const partEl = e.target.closest('[data-part]');
      if(!partEl) return;
      const hit = findPart(partEl.dataset.part);
      if(!hit) return;
      if(roleSel) hit.part.role = roleSel.value;
      if(axisSel) hit.part.axis = axisSel.value;
      hit.part.updatedAt = Date.now();
      saveSet(hit.set).then(() => render(pane));
    });
    bindMdPreview(pane);
    pane.addEventListener('dragover', e => {
      if(e.dataTransfer && [...e.dataTransfer.types].includes('Files')){ e.preventDefault(); pane.classList.add('md-drop'); }
    }, true);
    pane.addEventListener('dragleave', e => { if(e.target === pane) pane.classList.remove('md-drop'); }, true);
    pane.addEventListener('drop', async e => {
      if(!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault(); e.stopPropagation(); pane.classList.remove('md-drop');
      await importFiles([...e.dataTransfer.files], null);
    }, true);
  }

  async function handleAction(act){
    const set = state.selected ? setById(state.selected) : null;
    if(act === 'import'){
      pendingTarget = null;
      if(page) page.querySelector('#mdFile').click();
    }else if(act === 'connect'){
      connect();
    }else if(act === 'plugin'){
      downloadBridge();
    }else if(act === 'add'){
      if(!set) return;
      pendingTarget = set.id;
      if(page) page.querySelector('#mdFile').click();
    }else if(act === 'edit'){
      if(set && set.parts && set.parts[0]) openInBlockbench(set, set.parts[0]);
    }else if(act === 'export'){
      if(set) exportSet(set);
    }else if(act === 'rename'){
      if(!set) return;
      askName('重命名模型集', set.name, async v => {
        set.name = v;
        await saveSet(set);
        render(page);
      });
    }else if(act === 'delete'){
      if(!set) return;
      confirmDialog('删除模型集', '「' + set.name + '」将从模型库移除，包含 ' + (set.parts || []).length + ' 个部件。', '删除', async () => {
        await removeSet(set.id);
        state.selected = null;
        render(page);
      });
    }
  }

  function handlePartAction(act, partId){
    const hit = findPart(partId);
    if(!hit) return;
    const { set, part } = hit;
    if(act === 'edit') openInBlockbench(set, part);
    else if(act === 'export') exportPart(part);
    else if(act === 'remove'){
      confirmDialog('移除部件', '从「' + set.name + '」移除「' + part.name + '」？', '移除', async () => {
        set.parts = set.parts.filter(p => p.id !== part.id);
        if(!set.parts.length){
          await removeSet(set.id);
          state.selected = null;
        }else{
          if(set.thumb && !safeImage(set.thumb)) set.thumb = null;
          await saveSet(set);
        }
        render(page);
      });
    }
  }

  async function replaceTexture(target, file){
    const hit = findPart(target.partId);
    if(!hit) return;
    const list = hit.part.raw && hit.part.raw.textures;
    const tex = Array.isArray(list) ? list[target.index] : null;
    if(!tex){ toast('纹理槽不存在'); return; }
    try{
      const dataURL = await readDataURL(file);
      if(!safeImage(dataURL)){ toast('请选择 PNG / JPEG / WebP 纹理'); return; }
      const old = tex.source;
      tex.source = dataURL;
      if(file.name) tex.name = file.name;
      hit.part.meta = modelMeta(hit.part.raw, JSON.stringify(hit.part.raw).length);
      hit.part.updatedAt = Date.now();
      hit.set.updatedAt = Date.now();
      if(!hit.set.thumb || hit.set.thumb === old) hit.set.thumb = dataURL;
      await saveSet(hit.set);
      if(page) render(page);
      toast('已替换纹理：' + (file.name || 'texture.png'));
    }catch(err){ toast('替换纹理失败：' + (err.message || err)); }
  }

  /* ---------------- 导出 ---------------- */
  function exportPart(part){
    const blob = new Blob([JSON.stringify(part.raw, null, 2)], { type:'application/json' });
    PWArchive.download(blob, safeName(part.name, 'model') + '.bbmodel');
  }
  function exportSet(set){
    const files = (set.parts || []).map((p, i) => ({
      name: safeName(p.name || ('part_' + (i+1)), 'part') + '.bbmodel',
      data: JSON.stringify(p.raw, null, 2)
    }));
    files.push({
      name:'model-set.json',
      data: JSON.stringify({
        format:'clastar-model-set@1',
        name:set.name,
        exportedAt:new Date().toISOString(),
        parts:(set.parts || []).map(p => ({
          name:p.name, role:p.role, axis:p.axis || 'y',
          format:p.meta && p.meta.format, resolution:p.meta ? [p.meta.width, p.meta.height] : null
        }))
      }, null, 2)
    });
    PWArchive.download(PWArchive.create(files), safeName(set.name, 'model_set') + '.zip');
  }

  /* ---------------- Blockbench 桥接 ---------------- */
  function targetOrigin(){
    return /^https?:/i.test(bridge.origin || '') ? bridge.origin : '*';
  }
  function stopPing(){
    if(bridge.ping){ clearInterval(bridge.ping); bridge.ping = null; }
  }
  function startPing(){
    stopPing();
    let n = 0;
    bridge.last = '';
    bridge.ping = setInterval(() => {
      if(bridge.ready){ stopPing(); return; }
      if(!bridge.win || bridge.win.closed){
        stopPing();
        bridge.win = null;
        refreshBridge();
        return;
      }
      try{
        bridge.win.postMessage({ __clastar:1, type:'clastar:hello', nonce:bridge.nonce, origin:location.origin }, BRIDGE_ORIGIN);
      }catch(_){}
      if(++n > 24){
        stopPing();
        bridge.last = 'no-plugin';
        refreshBridge();
        toast('还没连上 Blockbench：确认已安装「Clastar Bridge」插件');
      }
    }, 600);
  }
  function connect(){
    if(bridge.ready && bridge.win && !bridge.win.closed){
      try{ bridge.win.focus(); }catch(_){}
      toast('Blockbench 已连接');
      return;
    }
    if(bridge.win && !bridge.win.closed && bridge.nonce){
      try{ bridge.win.focus(); }catch(_){}
      startPing();
      refreshBridge();
      toast('正在等待 Blockbench 插件连接…');
      return;
    }
    bridge.nonce = makeNonce();
    bridge.ready = false;
    bridge.origin = BRIDGE_ORIGIN;
    let win = null;
    try{ win = window.open(BRIDGE_URL, 'clastar-bb', 'width=1280,height=820'); }catch(_){}
    if(!win){
      toast('浏览器拦截了 Blockbench 窗口，请允许弹窗后重试');
      refreshBridge();
      return;
    }
    bridge.win = win;
    refreshBridge();
    startPing();
    toast('正在连接 Blockbench；首次使用请先安装桥接插件');
  }
  function openInBlockbench(set, part){
    if(!set || !part) return;
    const item = { setId:set.id, partId:part.id };
    if(!bridge.ready || !bridge.win || bridge.win.closed){
      bridge.pending = item;
      connect();
      return;
    }
    sendLoad(item);
  }
  function sendLoad(item){
    const hit = findPart(item.partId);
    if(!hit || !bridge.win){
      bridge.pending = item;
      return;
    }
    const { set, part } = hit;
    try{
      bridge.win.postMessage({
        __clastar:1, type:'clastar:load', nonce:bridge.nonce,
        id:part.id, name:set.name + ' / ' + part.name, project:part.raw
      }, targetOrigin());
      bridge.pending = item;
      toast('已发送到 Blockbench：' + part.name);
    }catch(err){
      toast('发送到 Blockbench 失败：' + (err.message || err));
    }
  }
  async function applyBridgeSave(d){
    let item = bridge.pending;
    if(!item || (d.id && item.partId !== d.id)) item = d.id ? findPart(d.id) : null;
    if(!item){
      toast('收到 Blockbench 工程，但找不到对应部件');
      return;
    }
    const hit = item.set ? item : findPart(item.partId);
    if(!hit){ toast('对应部件已被删除'); return; }
    let raw = d.project;
    if(typeof raw === 'string'){
      try{ raw = JSON.parse(raw); }catch(_){ toast('Blockbench 回传的工程不是有效 JSON'); return; }
    }
    if(!raw || typeof raw !== 'object'){ toast('Blockbench 回传的工程为空'); return; }
    const { set, part } = hit;
    part.raw = raw;
    part.meta = modelMeta(raw, JSON.stringify(raw).length);
    if(d.name) part.name = String(d.name).slice(0, 120);
    part.updatedAt = Date.now();
    set.updatedAt = Date.now();
    if(safeImage(d.thumbnail)) set.thumb = d.thumbnail;
    await saveSet(set);
    bridge.pending = { setId:set.id, partId:part.id };
    if(page) render(page);
    toast('已从 Blockbench 同步：' + part.name);
  }
  function onMessage(event){
    const d = event.data;
    if(!d || typeof d !== 'object' || d.__clastar !== 1) return;
    if(d.nonce !== bridge.nonce) return;
    if(d.type === 'bb:ready'){
      if(bridge.win && event.source !== bridge.win) return;
      if(bridge.ready) return;
      bridge.win = bridge.win || event.source;
      bridge.origin = event.origin || bridge.origin;
      bridge.ready = true;
      bridge.last = 'ready';
      stopPing();
      refreshBridge();
      toast('Blockbench 已连接');
      if(bridge.pending){
        const item = bridge.pending;
        bridge.pending = null;
        sendLoad(item);
      }
      return;
    }
    if(d.type === 'bb:save'){
      if(bridge.win && event.source !== bridge.win) return;
      applyBridgeSave(d);
      return;
    }
    if(d.type === 'bb:error'){
      toast('Blockbench：' + (d.message || '操作失败'));
    }
  }
  async function downloadBridge(){
    try{
      const res = await fetch(BRIDGE_PLUGIN, { cache:'no-store' });
      if(!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      PWArchive.download(blob, 'clastar-bridge.js');
      toast('插件已下载：拖进 Blockbench 即可安装');
    }catch(err){
      toast('插件下载失败：' + (err.message || err));
    }
  }
  function init(){
    window.addEventListener('message', onMessage);
    /* 由 Blockbench 插件反向打开 / 同源嵌入时，像素工坊主动发握手 */
    try{
      const params = new URLSearchParams(location.search);
      if(params.get('bb') === '1'){
        const opener = window.opener;
        const parent = window.parent && window.parent !== window ? window.parent : null;
        const target = opener || parent;
        if(target){
          bridge.nonce = makeNonce();
          bridge.origin = BRIDGE_ORIGIN;
          const targetOrigin = opener ? BRIDGE_ORIGIN : location.origin;
          const hello = () => {
            if(bridge.ready) return;
            try{
              target.postMessage({ __clastar:1, type:'clastar:hello', nonce:bridge.nonce, origin:location.origin }, targetOrigin);
            }catch(_){}
          };
          setTimeout(hello, 300);
          setTimeout(hello, 1200);
        }
      }
    }catch(_){}
  }

  /* ---------------- 入口 ---------------- */
  function open(){
    if(typeof PWExtensions !== 'undefined' && !PWExtensions.isEnabled('model-library')){
      toast('「模型库」已在设置里关闭'); return;
    }
    const exist = S.tabs.find(t => t.kind === 'models');
    if(exist){ activateTab(exist.id); return; }
    newTab('models', '模型库');
  }
  function mount(t, host){
    const pane = document.createElement('div');
    pane.className = 'ed-pane model-pane on';
    pane.dataset.tab = t.id;
    pane.innerHTML = pageHTML();
    host.appendChild(pane);
    t._pane = pane;
    page = pane;
    bind(pane);
    render(pane);
    ensureLoaded().then(() => render(pane));
  }
  function busyText(text){
    const t = page && page.querySelector('#mdProgress');
    if(t) t.textContent = text;
  }
  function showBusy(on, text){
    const el = page && page.querySelector('#mdImporting');
    if(!el) return;
    el.hidden = !on;
    if(text) busyText(text);
  }

  return { open, mount, init, importFiles, exportSet, openInBlockbench, connect, _state: state, _bridge: bridge, _applySave: applyBridgeSave, _getSets: () => sets };
})();
