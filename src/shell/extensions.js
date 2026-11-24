/* ============================================================
   工具 / 扩展注册表
   ------------------------------------------------------------
   官方工具、编辑器内拓展、以后导入的 JS 插件都走同一套描述：
   { id, name, kind:'tool'|'editor', icon, desc, version, official, open }
   工具页由 shell 动态渲染；编辑器拓展通过 postMessage 同步启停。
   ============================================================ */
const PWExtensions = (() => {
  const LS_KEY = 'pixelWorkshop_extensions_v1';
  const BUILTINS = [
    {
      id:'color-studio', name:'色彩拓展', kind:'tool', icon:'palette', version:'1.0.0',
      desc:'色阶、材质球、调色板拓展',
      official:true,
      open:() => openColorStudio()
    },
    {
      id:'recolor', name:'一键换色', kind:'tool', icon:'brush', version:'1.1.0',
      desc:'自动配色、实时预览、换色保存',
      official:true,
      open:() => openRecolorTool()
    },
    {
      id:'variant-lab', name:'变种工坊', kind:'tool', icon:'shape', version:'1.0.0',
      desc:'灰度明度映射材质色阶，批量产出变种',
      official:true,
      open:() => openVariantLab()
    },
    {
      id:'asset-library', name:'素材库', kind:'tool', icon:'grid', version:'1.0.0',
      desc:'存放原版 / 模组纹理，作为参考图或复制到工作区',
      official:true,
      open:() => PWAssets.open()
    },
    {
      id:'model-library', name:'模型库', kind:'tool', icon:'box', version:'0.1.0',
      desc:'Blockbench .bbmodel / Create 动静部件 / 纹理分离',
      official:true,
      open:() => PWModels.open()
    },
    {
      id:'addon-light', name:'一键光源', kind:'editor', icon:'eye', version:'1.0.0',
      desc:'动画编辑器内的一键光源面板',
      official:true,
      panel:'light'
    },
    {
      id:'addon-gradient', name:'彩色渐变叠加', kind:'editor', icon:'palette', version:'1.0.0',
      desc:'动画编辑器内的彩色渐变面板',
      official:true,
      panel:'grad'
    }
  ];

  let defs = BUILTINS.map(x => Object.assign({}, x));
  let enabled = {};

  function load(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(raw){
        const d = JSON.parse(raw);
        if(d && typeof d === 'object') enabled = Object.assign({}, d.enabled || d);
      }
    }catch(_){ enabled = {}; }
  }
  function save(){
    try{ localStorage.setItem(LS_KEY, JSON.stringify({ v:1, enabled })); }catch(_){}
  }
  function find(id){ return defs.find(d => d.id === id) || null; }
  function isEnabled(id){
    const d = find(id);
    if(!d) return true;
    return enabled[id] !== false;
  }
  function list(kind){
    return defs.filter(d => !kind || d.kind === kind);
  }
  function tools(){ return list('tool'); }
  function editorAddons(){ return list('editor'); }
  function iconOf(d){
    return iconSVG(d.icon || 'box', 15);
  }
  function enabledTools(){ return tools().filter(d => isEnabled(d.id)); }

  function renderShell(){
    const box = document.getElementById('toolList');
    if(box){
      const list = enabledTools();
      let html = list.map(d => `
        <button class="nav sm" data-ext-tool="${esc(d.id)}" data-tip="${esc(d.desc || '')}">
          <span class="ico">${iconOf(d)}</span>${esc(d.name)}
        </button>`).join('');
      const pluginTools = (typeof PWPlugins !== 'undefined' && PWPlugins.tools) ? PWPlugins.tools() : [];
      if(pluginTools.length){
        html += pluginTools.map(t => `
          <button class="nav sm plugin-tool-nav" data-plugin-tool="${esc(t.pluginId + '::' + t.id)}" data-tip="${esc(t.desc || '可选扩展')}">
            <span class="ico">${iconSVG(t.icon || 'box', 15)}</span>${esc(t.name)}
            <em class="plugin-tool-mark">扩展</em>
          </button>`).join('');
      }
      box.innerHTML = html || '<div class="rail-empty">还没有启用的工具<br>在设置里开启扩展</div>';
    }
    document.querySelectorAll('[data-ext-tool]').forEach(b => {
      b.hidden = !isEnabled(b.dataset.extTool);
    });
  }

  function open(id){
    const d = find(id);
    if(!d){ toast('扩展不存在：' + id); return; }
    if(!isEnabled(id)){ toast('「' + d.name + '」已在设置里关闭'); return; }
    if(d.kind !== 'tool'){ toast('这是编辑器拓展，在绘画编辑器里生效'); return; }
    try{
      if(typeof d.open === 'function') d.open();
      else if(d.entry && typeof window[d.entry] === 'function') window[d.entry]();
      else toast('这个扩展还没有提供入口');
    }catch(err){
      console.error(err);
      toast('打开扩展失败：' + (err.message || err));
    }
  }

  function closeToolTab(id){
    const map = { 'color-studio':'color', 'recolor':'recolor', 'variant-lab':'variant', 'asset-library':'assets', 'model-library':'models', 'ai-assistant':'agent' };
    const kind = map[id];
    if(!kind) return;
    const t = activeTab();
    if(t && t.kind === kind) closeTab(t.id, true);
  }

  function setEnabled(id, on){
    const d = find(id);
    if(!d) return;
    enabled[id] = !!on;
    save();
    renderShell();
    if(!on) closeToolTab(id);
    if(d.kind === 'editor') broadcastAddons();
    try{
      if(on && typeof d.onEnable === 'function') d.onEnable();
      if(!on && typeof d.onDisable === 'function') d.onDisable();
    }catch(err){ console.error('扩展生命周期失败', err); }
    try{ document.dispatchEvent(new CustomEvent('pw-extensions-change', { detail:{ id, enabled:!!on } })); }catch(_){}
  }

  function addonPanels(){
    const out = {};
    editorAddons().forEach(d => { if(d.panel) out[d.panel] = isEnabled(d.id); });
    return out;
  }
  function sendToFrame(fr){
    if(!fr) return;
    try{ fr.contentWindow.postMessage({ __pwAddons:1, panels:addonPanels() }, '*'); }catch(_){}
  }
  function broadcastAddons(){
    const panels = addonPanels();
    (S.tabs || []).forEach(t => {
      if(!t._frame) return;
      try{ t._frame.contentWindow.postMessage({ __pwAddons:1, panels }, '*'); }catch(_){}
    });
  }

  function settingsHTML(){
    const group = (title, items) => items.length ? `
      <div class="ext-group">
        <div class="ext-group-title">${title}</div>
        ${items.map(d => `
          <label class="ext-row">
            <span class="ext-ico">${iconOf(d)}</span>
            <span class="ext-info">
              <b>${esc(d.name)}<em class="ext-badge">${d.official === false ? '外部' : '官方内置'}</em></b>
              <span>${esc(d.desc || '')} · v${esc(d.version || '1.0.0')}</span>
            </span>
            <span class="ext-switch">
              <input type="checkbox" data-ext-toggle="${esc(d.id)}"${isEnabled(d.id) ? ' checked' : ''}>
              <i></i>
            </span>
          </label>`).join('')}
      </div>` : '';
    return `
      <div class="ext-section">
        <div class="ext-section-head">
          <b>工具与扩展</b><span>模块化开启 / 禁用</span>
        </div>
        ${group('工具页', tools())}
        ${group('编辑器拓展', editorAddons())}
        <div class="ext-future"><b>可选插件</b><span>官方可选插件（如机械动力方块扩展）请在设置 →「扩展中心」安装；这里管理内置工具与编辑器拓展。</span></div>
        <div class="ext-note">关闭后入口会从工具栏和快捷栏隐藏；编辑器内的拓展面板也会同步隐藏。</div>
      </div>`;
  }

  function bindSettings(root){
    if(!root) return;
    root.querySelectorAll('[data-ext-toggle]').forEach(cb => {
      cb.addEventListener('change', () => setEnabled(cb.dataset.extToggle, cb.checked));
    });
  }

  /* 预留给以后导入 JS 扩展：插件调用 PWExtensions.register({...}) 即可。 */
  function register(def){
    if(!def || !def.id || !def.name) throw new Error('扩展需要 id 和 name');
    if(find(def.id)) return find(def.id);
    const d = Object.assign({ kind:'tool', official:false, version:'1.0.0' }, def);
    defs.push(d);
    if(Array.isArray(def.shortcuts) && typeof PWShortcuts !== 'undefined'){
      def.shortcuts.forEach(sc => PWShortcuts.registerAction(Object.assign({ extension:d.id }, sc)));
    }
    renderShell();
    return d;
  }
  function unregister(id){
    defs = defs.filter(d => d.id !== id);
    delete enabled[id];
    save();
    renderShell();
    broadcastAddons();
  }

  function init(){
    load();
    renderShell();
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-ext-tool]');
      if(!b || b.hidden) return;
      e.preventDefault();
      open(b.dataset.extTool);
    });
  }

  return {
    init, register, unregister, get:find, list, tools, editorAddons, isEnabled, setEnabled,
    open, renderShell, settingsHTML, bindSettings, sendToFrame, broadcastAddons, addonPanels
  };
})();
