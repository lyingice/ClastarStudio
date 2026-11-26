/* ============================================================
   快捷键注册表 / 快捷键中心 / 速查卡
   ------------------------------------------------------------
   动作按作用域分组；编辑器动作通过 postMessage 同步到 iframe。
   以后外部扩展可在 manifest 里声明动作，由这里统一冲突检测。
   ============================================================ */
const PWShortcuts = (() => {
  const LS_KEY = 'pixelWorkshop_shortcuts_v1';
  const ACTIONS = [
    {id:'global.settings',    group:'全局',   scope:'global', label:'打开设置',            desc:'打开设置面板',                 def:'ctrl+,'},
    {id:'global.shortcuts',   group:'全局',   scope:'global', label:'快捷键速查',          desc:'打开当前快捷键速查卡',         def:'?'},
    {id:'global.toggleLeft',  group:'全局',   scope:'global', label:'收起 / 展开左侧栏',   desc:'切换左侧工作区栏',             def:'ctrl+b'},
    {id:'global.toggleRight', group:'全局',   scope:'global', label:'收起 / 展开右侧快捷栏', desc:'切换右侧快捷操作栏',         def:'ctrl+shift+b'},
    {id:'editor.brush',       group:'画布工具', scope:'editor', label:'画笔',   desc:'动画 / 自定义纹理编辑器', def:'b'},
    {id:'editor.eraser',      group:'画布工具', scope:'editor', label:'橡皮',   desc:'动画 / 自定义纹理编辑器', def:'e'},
    {id:'editor.bucket',      group:'画布工具', scope:'editor', label:'油漆桶', desc:'动画 / 自定义纹理编辑器', def:'g'},
    {id:'editor.picker',      group:'画布工具', scope:'editor', label:'吸管',   desc:'动画 / 自定义纹理编辑器', def:'i'},
    {id:'editor.line',        group:'画布工具', scope:'editor', label:'直线',   desc:'动画 / 自定义纹理编辑器', def:'l'},
    {id:'editor.rect',        group:'画布工具', scope:'editor', label:'矩形',   desc:'动画 / 自定义纹理编辑器', def:'r'},
    {id:'editor.ellipse',     group:'画布工具', scope:'editor', label:'椭圆',   desc:'动画 / 自定义纹理编辑器', def:'o'},
    {id:'editor.move',        group:'画布工具', scope:'editor', label:'移动',   desc:'动画 / 自定义纹理编辑器', def:'v'},
    {id:'editor.select',      group:'画布工具', scope:'editor', label:'选择',   desc:'动画 / 自定义纹理编辑器', def:'m'},
    {id:'editor.prevFrame',   group:'动画',     scope:'editor', label:'上一帧', desc:'动画编辑器',             def:','},
    {id:'editor.nextFrame',   group:'动画',     scope:'editor', label:'下一帧', desc:'动画编辑器',             def:'.'},
    {id:'editor.play',        group:'动画',     scope:'editor', label:'播放 / 暂停', desc:'动画编辑器',       def:'space'},
    {id:'editor.undo',        group:'编辑',     scope:'editor', label:'撤销', desc:'动画 / 自定义纹理编辑器', def:'ctrl+z'},
    {id:'editor.redo',        group:'编辑',     scope:'editor', label:'重做', desc:'动画 / 自定义纹理编辑器', def:'ctrl+y'}
  ];
  const RESERVED = new Set([
    'ctrl+w','ctrl+t','ctrl+n','ctrl+tab','ctrl+shift+tab','ctrl+l','ctrl+d',
    'ctrl+shift+t','ctrl+r','f5','alt+f4'
  ]);
  let values = {};
  let recording = null;
  let activePane = null;
  let filter = 'all';
  let query = '';
  let lastSheet = null;

  function load(){
    try{
      const d = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      const v = (d && (d.values || d)) || {};
      if(v && typeof v === 'object') values = Object.assign({}, v);
    }catch(_){ values = {}; }
  }
  function save(){
    try{ localStorage.setItem(LS_KEY, JSON.stringify({ v:1, values })); }catch(_){}
  }
  function actions(){ return ACTIONS.map(a => Object.assign({}, a)); }
  /* 外部扩展可以在注册时补充动作；后续由快捷键中心统一管理 */
  function registerAction(def){
    if(!def || !def.id || ACTIONS.some(a => a.id === def.id)) return false;
    ACTIONS.push({
      id:String(def.id), group:def.group || '扩展', scope:def.scope === 'editor' ? 'editor' : 'global',
      label:def.label || def.id, desc:def.desc || '', def:def.default || '', extension:def.extension || null,
      run:typeof def.run === 'function' ? def.run : null
    });
    return true;
  }
  function action(id){ return ACTIONS.find(a => a.id === id) || null; }
  function keyFor(id){
    if(Object.prototype.hasOwnProperty.call(values, id)) return values[id] || '';
    const a = action(id);
    return a ? a.def : '';
  }
  function isCustom(id){ return Object.prototype.hasOwnProperty.call(values, id); }
  function isRecording(){ return !!recording; }

  function comboFromEvent(e){
    if(!e || !e.key) return '';
    if(['Control','Shift','Alt','Meta'].includes(e.key)) return '';
    const mods = [];
    if(e.ctrlKey || e.metaKey) mods.push('ctrl');
    if(e.altKey) mods.push('alt');
    let key = e.key;
    if(key === ' ') key = 'space';
    else if(key.length === 1) key = key.toLowerCase();
    else key = key.toLowerCase();
    const letterOrDigit = key.length === 1 && /[a-z0-9]/i.test(key);
    if(e.shiftKey && (letterOrDigit || key.length > 1)) mods.push('shift');
    return mods.concat(key).join('+');
  }
  function formatCombo(combo){
    if(!combo) return '未设置';
    const map = { ctrl:'Ctrl', shift:'Shift', alt:'Alt', space:'Space', escape:'Esc',
      arrowleft:'←', arrowright:'→', arrowup:'↑', arrowdown:'↓', enter:'Enter', tab:'Tab',
      backspace:'Backspace', delete:'Delete', home:'Home', end:'End', pageup:'PgUp', pagedown:'PgDn' };
    return String(combo).split('+').map((p, i, arr) => {
      if(i < arr.length - 1) return map[p] || (p.charAt(0).toUpperCase() + p.slice(1));
      if(map[p]) return map[p];
      return p.length === 1 ? p.toUpperCase() : p;
    }).join('+');
  }
  function display(id){ return formatCombo(keyFor(id)); }

  function conflicts(){
    const by = new Map(), out = [];
    ACTIONS.forEach(a => {
      const c = keyFor(a.id);
      if(!c) return;
      const k = a.scope + '|' + c;
      if(by.has(k)){
        out.push({ key:c, scope:a.scope, a:by.get(k), b:a.id });
      }else by.set(k, a.id);
    });
    return out;
  }
  function conflictIds(){
    const s = new Set();
    conflicts().forEach(c => { s.add(c.a); s.add(c.b); });
    return s;
  }
  function summary(){
    const conf = conflicts();
    return { total:ACTIONS.length, custom:ACTIONS.filter(a => isCustom(a.id)).length, conflicts:conf.length };
  }
  function validate(id, combo){
    const a = action(id);
    if(!a) throw new Error('快捷键动作不存在');
    if(!combo) return true;
    if(RESERVED.has(combo)) throw new Error('这个组合被浏览器占用，不能可靠接管');
    const other = ACTIONS.find(x => x.id !== id && x.scope === a.scope && keyFor(x.id) === combo);
    if(other) throw new Error('与「' + other.label + '」的 ' + formatCombo(combo) + ' 冲突');
    return true;
  }
  function set(id, combo){
    const a = action(id);
    if(!a) throw new Error('快捷键动作不存在');
    validate(id, combo);
    if(combo === a.def) delete values[id];
    else values[id] = combo;
    save();
    refreshFrames();
    return true;
  }
  function reset(id){
    delete values[id];
    save();
    refreshFrames();
  }
  function resetAll(){
    values = {};
    save();
    refreshFrames();
  }
  function frameMap(){
    const map = {};
    ACTIONS.filter(a => a.scope === 'editor').forEach(a => { map[a.id] = keyFor(a.id); });
    return map;
  }
  function sendToFrame(fr){
    if(!fr) return;
    try{ fr.contentWindow.postMessage({ __pwShortcuts:1, map:frameMap() }, '*'); }catch(_){}
  }
  function editableTarget(t){
    if(!t) return false;
    const tag = (t.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!t.isContentEditable;
  }
  function executeGlobal(id){
    const ws = document.querySelector('.workspace');
    if(id === 'global.settings'){ openSettings(); return; }
    if(id === 'global.shortcuts'){ openShortcutSheet(); return; }
    if(id === 'global.toggleLeft' || id === 'global.toggleRight'){
      if(typeof shellMobile === 'function' && shellMobile()) return;
      if(id === 'global.toggleLeft') setRail('left', !(ws && ws.classList.contains('left-off')));
      else setRail('right', !(ws && ws.classList.contains('right-off')));
      return;
    }
    const a = action(id);
    if(a && typeof a.run === 'function') a.run();
  }
  function handleShellKey(e){
    if(recording || e.defaultPrevented || e.isComposing) return;
    if(editableTarget(e.target)) return;
    const combo = comboFromEvent(e);
    if(!combo) return;
    const a = ACTIONS.find(x => x.scope === 'global' && keyFor(x.id) === combo);
    if(!a) return;
    e.preventDefault();
    executeGlobal(a.id);
  }

  /* 让对应的编辑器按钮显示键位 */
  function decorateFrame(fr, t){
    try{
      if(!fr || !fr.contentDocument) return;
      const d = fr.contentDocument;
      const isTexUnified = (t.kind === 'ctex' || t.kind === 'tex');
      const map = isTexUnified
        ? { pencil:'editor.brush', eraser:'editor.eraser', fill:'editor.bucket', pick:'editor.picker',
            line:'editor.line', rect:'editor.rect', ellipse:'editor.ellipse', move:'editor.move', select:'editor.select' }
        : { pencil:'editor.brush', eraser:'editor.eraser', bucket:'editor.bucket', picker:'editor.picker',
            line:'editor.line', rect:'editor.rect', ellipse:'editor.ellipse', move:'editor.move', select:'editor.select' };
      const selector = isTexUnified ? '#tools [data-tool]' : '#toolSeg [data-v]';
      d.querySelectorAll(selector).forEach(btn => {
        const key = isTexUnified ? btn.dataset.tool : btn.dataset.v;
        const id = map[key];
        if(!id) return;
        const base = btn.dataset.pwBaseTitle !== undefined ? btn.dataset.pwBaseTitle : (btn.getAttribute('title') || btn.textContent.trim());
        if(btn.dataset.pwBaseTitle === undefined) btn.dataset.pwBaseTitle = base;
        let k = btn.querySelector('kbd.pw-kbd');
        if(!k){ k = d.createElement('kbd'); k.className = 'pw-kbd'; btn.appendChild(k); }
        const label = display(id);
        k.textContent = label === '未设置' ? '' : label;
        k.style.display = label === '未设置' ? 'none' : '';
        btn.title = base ? base + ' (' + label + ')' : '快捷键 ' + label;
      });
      const tip = (sel, id) => {
        const b = d.querySelector(sel); if(!b) return;
        const base = b.dataset.pwBaseTitle !== undefined ? b.dataset.pwBaseTitle : (b.getAttribute('title') || b.textContent.trim());
        if(b.dataset.pwBaseTitle === undefined) b.dataset.pwBaseTitle = base;
        b.title = base ? base + ' (' + display(id) + ')' : '快捷键 ' + display(id);
      };
      tip('#undo', 'editor.undo'); tip('#redo', 'editor.redo');
      tip('#btnUndo', 'editor.undo'); tip('#btnRedo', 'editor.redo');
    }catch(_){}
  }

  /* 为自定义纹理（及动画编辑器拓展工具）补充工具快捷键 */
  function bindFrame(fr, t){
    if(!fr || (t.kind !== 'ctex' && t.kind !== 'tex' && t.kind !== 'anim')) return;
    try{
      const w = fr.contentWindow;
      if(w.__pwShortcutBound) return;
      w.__pwShortcutBound = true;
      const isTexUnified = (t.kind === 'ctex' || t.kind === 'tex');
      const toolMap = isTexUnified
        ? { 'editor.brush':'pencil', 'editor.eraser':'eraser', 'editor.bucket':'fill', 'editor.picker':'pick',
            'editor.line':'line', 'editor.rect':'rect', 'editor.ellipse':'ellipse', 'editor.move':'move', 'editor.select':'select' }
        : { 'editor.line':'line', 'editor.rect':'rect', 'editor.ellipse':'ellipse', 'editor.move':'move', 'editor.select':'select' };
      const selFmt = isTexUnified ? '#tools [data-tool="' : '#toolSeg [data-v="';
      w.addEventListener('keydown', e => {
        if(e.defaultPrevented || editableTarget(e.target)) return;
        const combo = comboFromEvent(e);
        if(!combo) return;
        for(const [id, tool] of Object.entries(toolMap)){
          if(keyFor(id) === combo){
            const btn = w.document.querySelector(selFmt + tool + '"]');
            if(btn){ e.preventDefault(); btn.click(); }
            return;
          }
        }
      });
    }catch(_){}
  }
  function refreshFrames(){
    (S.tabs || []).forEach(t => {
      if(!t._frame) return;
      sendToFrame(t._frame);
      decorateFrame(t._frame, t);
      bindFrame(t._frame, t);
    });
  }

  /* ---------------- 快捷键中心 ---------------- */
  function openShortcutCenter(){
    const exist = S.tabs.find(t => t.kind === 'shortcuts');
    if(exist){ activateTab(exist.id); return; }
    newTab('shortcuts', '快捷键');
  }
  function pageHTML(){
    return `
    <div class="shortcut-page">
      <div class="content-head rec-head">
        <div class="crumbs"><b>快捷键</b><span>点击右侧按键开始录制 · Esc 取消 · Backspace 清除</span></div>
        <div class="tools">
          <button class="btn sm" id="scExport">导出配置</button>
          <button class="btn sm" id="scImport">导入配置</button>
          <button class="btn sm" id="scResetAll">全部恢复默认</button>
        </div>
      </div>
      <div class="scroll sc-scroll">
        <div class="sc-toolbar">
          <label class="search sc-search">${iconSVG('search', 12)}<input id="scSearch" placeholder="搜索动作 / 按键…" autocomplete="off"></label>
          <div class="sc-chips" id="scChips"></div>
        </div>
        <div class="sc-conflict" id="scConflict" hidden></div>
        <div class="sc-groups" id="scGroups"></div>
        <p class="sc-hint">同一上下文内不允许重复；不同上下文可以复用同一个键。输入框获得焦点时不会触发单键快捷键。</p>
      </div>
      <input type="file" id="scFile" accept=".json,application/json" hidden>
    </div>`;
  }
  function chipsHTML(){
    const groups = Array.from(new Set(ACTIONS.map(a => a.group)));
    return '<button type="button" class="sc-chip' + (filter === 'all' ? ' on' : '') + '" data-sc-filter="all">全部</button>' +
      groups.map(g => '<button type="button" class="sc-chip' + (filter === g ? ' on' : '') + '" data-sc-filter="' + esc(g) + '">' + esc(g) + '</button>').join('');
  }
  function renderCenter(pane){
    if(!pane) return;
    activePane = pane;
    const groupsBox = pane.querySelector('#scGroups');
    const chips = pane.querySelector('#scChips');
    if(chips) chips.innerHTML = chipsHTML();
    const q = query.trim().toLowerCase();
    const list = ACTIONS.filter(a => {
      if(filter !== 'all' && a.group !== filter) return false;
      if(!q) return true;
      return (a.label + ' ' + a.desc + ' ' + a.group + ' ' + display(a.id)).toLowerCase().includes(q);
    });
    const cids = conflictIds();
    const groups = [];
    list.forEach(a => {
      let g = groups.find(x => x.name === a.group);
      if(!g){ g = { name:a.group, items:[] }; groups.push(g); }
      g.items.push(a);
    });
    groupsBox.innerHTML = groups.length ? groups.map(g => `
      <section class="sc-group">
        <div class="sc-group-head"><b>${esc(g.name)}</b><span>${g.items.length} 个动作</span></div>
        <div class="sc-rows">
          ${g.items.map(a => {
            const key = display(a.id);
            const rec = recording === a.id;
            return `<div class="sc-row${cids.has(a.id) ? ' conflict' : ''}" data-sc-action="${esc(a.id)}">
              <div class="sc-info"><b>${esc(a.label)}</b><span>${esc(a.desc)}</span></div>
              <button type="button" class="sc-key${rec ? ' recording' : ''}" data-sc-key="${esc(a.id)}">
                ${rec ? '按下新快捷键…' : '<kbd>' + esc(key) + '</kbd>'}
              </button>
              <button type="button" class="sc-reset" data-sc-reset="${esc(a.id)}" title="恢复默认">↺</button>
            </div>`;
          }).join('')}
        </div>
      </section>`).join('') : '<div class="sc-empty">没有匹配的动作</div>';
    const banner = pane.querySelector('#scConflict');
    if(banner){
      const conf = conflicts();
      banner.hidden = !conf.length;
      banner.innerHTML = conf.length
        ? '<b>有 ' + conf.length + ' 处快捷键冲突</b><span>' + conf.map(c => {
            const a = action(c.a), b = action(c.b);
            return (a ? a.label : c.a) + ' / ' + (b ? b.label : c.b) + ' 都在使用 ' + esc(formatCombo(c.key));
          }).join(' · ') + '</span>'
        : '';
    }
  }
  function bindCenter(pane){
    activePane = pane;
    const q = s => pane.querySelector(s);
    q('#scSearch').addEventListener('input', e => { query = e.target.value; renderCenter(pane); });
    q('#scChips').addEventListener('click', e => {
      const b = e.target.closest('[data-sc-filter]');
      if(!b) return;
      filter = b.dataset.scFilter;
      renderCenter(pane);
    });
    q('#scGroups').addEventListener('click', e => {
      const key = e.target.closest('[data-sc-key]');
      if(key){ startRecord(key.dataset.scKey, pane); return; }
      const rst = e.target.closest('[data-sc-reset]');
      if(rst){ reset(rst.dataset.scReset); renderCenter(pane); toast('已恢复默认'); }
    });
    q('#scResetAll').onclick = () => {
      confirmDialog('恢复默认快捷键', '所有自定义快捷键都会恢复成默认值。', '恢复默认', () => {
        resetAll(); renderCenter(pane); toast('已恢复全部默认快捷键');
      });
    };
    q('#scExport').onclick = () => exportConfig();
    q('#scImport').onclick = () => q('#scFile').click();
    q('#scFile').onchange = e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if(!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        try{ importConfig(String(fr.result)); renderCenter(pane); toast('已导入快捷键配置'); }
        catch(err){ toast('导入失败：' + err.message); }
      };
      fr.readAsText(f);
    };
    renderCenter(pane);
  }
  function mountCenter(t, host){
    const pane = document.createElement('div');
    pane.className = 'ed-pane shortcut-pane on';
    pane.dataset.tab = t.id;
    pane.innerHTML = pageHTML();
    host.appendChild(pane);
    t._pane = pane; t._shortcutPane = pane;
    bindCenter(pane);
  }
  function startRecord(id, pane){
    recording = id;
    renderCenter(pane || activePane);
    toast('按下新的快捷键 · Esc 取消 · Backspace 清除');
  }
  function stopRecord(render){
    recording = null;
    if(render !== false) renderCenter(activePane);
  }
  function exportConfig(){
    const blob = new Blob([JSON.stringify({
      v:1, exportedAt:new Date().toISOString(),
      values:Object.assign({}, values),
      actions:ACTIONS.map(a => ({ id:a.id, label:a.label, default:a.def, current:keyFor(a.id) }))
    }, null, 2)], {type:'application/json'});
    PWArchive.download(blob, '像素工坊-快捷键-' + new Date().toISOString().slice(0,10) + '.json');
    toast('已导出快捷键配置');
  }
  function importConfig(text){
    let d;
    try{ d = JSON.parse(text); }catch(_){ throw new Error('不是有效的 JSON'); }
    const incoming = (d && (d.values || d.shortcuts)) || d;
    if(!incoming || typeof incoming !== 'object') throw new Error('配置里没有 values');
    const next = {};
    for(const [id, combo] of Object.entries(incoming)){
      const a = action(id);
      if(!a || typeof combo !== 'string') continue;
      const c = combo.trim().toLowerCase();
      if(c) validate(id, c);
      next[id] = c;
    }
    values = next;
    save();
    refreshFrames();
  }

  /* ---------------- 速查卡 ---------------- */
  function openShortcutSheet(){
    if(lastSheet){ lastSheet.remove(); lastSheet = null; return; }
    const mask = document.createElement('div');
    mask.className = 'sc-sheet-mask';
    const groups = [];
    ACTIONS.forEach(a => {
      let g = groups.find(x => x.name === a.group);
      if(!g){ g = { name:a.group, items:[] }; groups.push(g); }
      g.items.push(a);
    });
    mask.innerHTML = `
      <div class="sc-sheet" role="dialog" aria-label="快捷键速查">
        <div class="sc-sheet-head"><div><b>快捷键速查</b><span>当前版本 · 可自定义</span></div><button class="pack-x" data-sc-close>✕</button></div>
        <div class="sc-sheet-body">
          ${groups.map(g => `<section class="sc-sheet-group"><h4>${esc(g.name)}</h4>${g.items.map(a => `
            <div class="sc-sheet-row"><span>${esc(a.label)}</span><kbd>${esc(display(a.id))}</kbd></div>`).join('')}</section>`).join('')}
        </div>
        <div class="sc-sheet-foot"><span>按 Esc 关闭</span><button class="btn light" data-sc-close>关闭</button><button class="btn pri" data-sc-manage>管理快捷键</button></div>
      </div>`;
    document.body.appendChild(mask);
    lastSheet = mask;
    mask.querySelectorAll('[data-sc-close]').forEach(b => b.onclick = closeSheet);
    mask.querySelector('[data-sc-manage]').onclick = () => { closeSheet(); openShortcutCenter(); };
    mask.addEventListener('pointerdown', e => { if(e.target === mask) closeSheet(); });
    const onKey = e => { if(e.key === 'Escape'){ e.preventDefault(); closeSheet(); } };
    document.addEventListener('keydown', onKey, true);
    mask._onKey = onKey;
  }
  function closeSheet(){
    if(!lastSheet) return;
    if(lastSheet._onKey) document.removeEventListener('keydown', lastSheet._onKey, true);
    lastSheet.remove(); lastSheet = null;
  }

  function settingsRowHTML(){
    const s = summary();
    return `<div class="opt" data-set="shortcuts"><div class="oi">${iconSVG('keyboard',16)}</div>` +
      '<div class="ot"><b>快捷键</b><span>' + s.total + ' 个动作 · ' + s.custom + ' 个自定义' +
      (s.conflicts ? ' · ' + s.conflicts + ' 个冲突' : '') + '</span>' +
      '<i class="ost">录制 / 冲突检测 / 导入导出</i></div>' +
      '<span class="sc-manage">管理 ›</span></div>';
  }

  function init(){
    load();
    document.addEventListener('keydown', handleShellKey);
    document.addEventListener('keydown', e => {
      if(!recording) return;
      e.preventDefault();
      e.stopPropagation();
      if(e.key === 'Escape'){ stopRecord(); return; }
      if(e.key === 'Backspace' || e.key === 'Delete'){
        try{ set(recording, ''); stopRecord(); toast('已清除该快捷键'); }catch(err){ toast(err.message); }
        return;
      }
      const combo = comboFromEvent(e);
      if(!combo) return;
      const id = recording;
      try{
        set(id, combo);
        stopRecord();
        toast('快捷键已更新为 ' + formatCombo(combo));
      }catch(err){
        toast(err.message);
      }
    }, true);
  }

  return {
    init, registerAction, actions, action, keyFor, display, formatCombo, summary, conflicts,
    set, reset, resetAll, exportConfig, importConfig,
    openShortcutCenter, mountCenter, openShortcutSheet, settingsRowHTML,
    sendToFrame, decorateFrame, bindFrame, refreshFrames, isRecording
  };
})();
