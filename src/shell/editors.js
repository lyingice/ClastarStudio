/* ---------------- 内嵌编辑器（真实工具） ---------------- */
const EMBED_ID = { anim:'src-anim', color:'src-color', block:'src-block', composite:'src-composite', entity:'src-entity', ctex:'src-ctex' };

function b64utf8(b64){
  const bin = atob(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}
const EMBED_DECODED = Object.create(null);
function embedSource(kind){
  const key = EMBED_ID[kind] ? kind : 'anim';
  let raw = window.EMBEDDED_SOURCES && window.EMBEDDED_SOURCES[key];
  if(raw == null){
    const el = document.getElementById(EMBED_ID[key]);
    raw = el && el.textContent || '';
  }
  if(EMBED_DECODED[key] === undefined) EMBED_DECODED[key] = raw.trim() ? b64utf8(raw) : '';
  return EMBED_DECODED[key] || null;
}
function themeVars(){
  const cs = getComputedStyle(document.documentElement);
  return {
    a:  (cs.getPropertyValue('--accent').trim()  || '#4c9a2a'),
    a2: (cs.getPropertyValue('--accent2').trim() || '#6fc244'),
    d:  (cs.getPropertyValue('--accentd').trim() || '#2f6b1a')
  };
}
/* 让内嵌工具看起来像外壳的一部分：去掉自己的标题栏，整套控件换成 Ore UI 样式 */
function skinCSS(){
  const v = themeVars();
  return `
    html,body{height:100%!important}
    body>header{display:none!important}

    :root{
      --bg:#1a1a1a; --bg2:#262626; --bg3:#333333; --bg4:#3d3d3d;
      --line:#101010; --line-hi:#5a5a5a; --line-lo:#050505;
      --ore:${v.a}; --ore-hi:${v.a2}; --ore-lo:${v.d};
      --accent:${v.a}; --accent2:${v.a2};
      --fg:#f2f2f2; --fg2:#bdbdbd;
    }

    /* ---------- Ore UI 统一 ---------- */
    body{
      background:#1a1a1a!important;color:#f2f2f2!important;
      font-family:"Segoe UI",system-ui,-apple-system,"Microsoft YaHei","PingFang SC",sans-serif!important;
    }
    *{border-radius:0!important}
    ::-webkit-scrollbar{width:11px;height:11px}
    ::-webkit-scrollbar-track{background:#141414!important}
    ::-webkit-scrollbar-thumb{background:#4a4a4a!important;border:2px solid #141414!important}

    /* 分区 / 面板 */
    aside{background:#2a2a2a!important;border-color:#101010!important}
    .toolbar{background:#1f1f1f!important;border-bottom:2px solid #101010!important}
    .tb-row{background:#262626!important;border:2px solid #101010!important;box-shadow:none!important}
    .panel{background:transparent!important}
    .panel>.ph,.dlg-title{background:#333!important;border-color:#101010!important;box-shadow:none!important}
    .card,.rcard,.warnbox,pre,.todo,.selbar,.opseg{
      background:#3a3a3a!important;border:2px solid #151515!important;box-shadow:none!important}
    .tex-mode .panel.tex-off{display:none!important}
    .box{border:2px solid #101010!important;box-shadow:none!important;background-color:#232323!important;
      background-image:
        linear-gradient(45deg,#2d2d2d 25%,transparent 25%,transparent 75%,#2d2d2d 75%),
        linear-gradient(45deg,#2d2d2d 25%,transparent 25%,transparent 75%,#2d2d2d 75%)!important;
      background-size:16px 16px!important;background-position:0 0,8px 8px!important}
    .box.dark{background-image:none!important;background-color:#131313!important}
    .box.light{background-image:none!important;background-color:#d8dbe0!important}
    .dlg{background:#3f3f3f!important;border:2px solid #101010!important}
    .layers{background:#222!important;border:2px solid #131313!important}

    /* 按钮：灰底 + 2px 黑边 + 底部压边；选中/主要 = 主题色 */
    button{
      background:linear-gradient(180deg,#4d4d4d,#454545)!important;
      border:2px solid #101010!important;color:#eee!important;
      box-shadow:inset 0 -3px 0 #00000038, inset 0 1px 0 #ffffff16!important;
      font-family:inherit!important;
    }
    button:hover{background:linear-gradient(180deg,#5a5a5a,#4f4f4f)!important;color:#fff!important}
    button:active{transform:translateY(1px)!important}
    button.on,button.pri{
      background:${v.a}!important;border-color:#101010!important;color:#fff!important;
      box-shadow:inset 0 -3px 0 ${v.d}, inset 0 1px 0 #ffffff33!important;
    }
    button.on:hover,button.pri:hover{background:${v.a2}!important}
    button:disabled{opacity:.4!important}
    .panel>.ph button{background:none!important;border:none!important;box-shadow:none!important}

    /* 输入控件 */
    input[type=number],input[type=text],textarea,select{
      background:#2b2b2b!important;border:2px solid #101010!important;color:#f0f0f0!important;
      box-shadow:inset 0 2px 0 #00000055!important;font-family:inherit!important;
    }
    input:focus,select:focus,textarea:focus{outline:none!important;border-color:${v.a}!important}
    input[type=checkbox]{accent-color:${v.a}!important}
    input[type=color]{background:#2b2b2b!important;border:2px solid #101010!important}
    input[type=range]{
      height:9px!important;border-radius:0!important;
      background:linear-gradient(180deg,#0b0d11,#191d24)!important;border:1px solid #05060a!important;
    }
    input[type=range]::-webkit-slider-thumb{
      width:13px!important;height:17px!important;border-radius:0!important;
      background:linear-gradient(180deg,#eef0f4,#b6bdc9)!important;border:1px solid #08090c!important;
    }

    /* 列表 / 帧 / 色块 */
    .lrow{background:#333!important;border-color:#1b1b1b!important;color:#dcdcdc!important}
    .lrow.on{background:#474747!important;box-shadow:inset 3px 0 0 ${v.a}!important}
    .fcell{border:2px solid #151515!important;background:#2b2b2b!important}
    .fcell.on{border-color:${v.a}!important;background:#3a3a3a!important;box-shadow:none!important}
    .pal div,.recent div,.cur2 .sw{border:1px solid #000000!important}
    .hint,.mini,.lbl{color:#a9a9a9!important}

    /* 分区标题：和外壳一样，前面一条主色竖块 */
    .grp>h2{position:relative!important;padding-left:10px!important;letter-spacing:1.2px!important}
    .grp>h2::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);
      width:4px;height:12px;background:${v.a}}

    /* 快捷键提示徽标（由外壳 PWShortcuts 注入） */
    .pw-kbd{
      display:inline-grid!important;place-items:center!important;min-width:14px!important;
      height:14px!important;margin-left:5px!important;padding:0 3px!important;
      background:#1d1d1d!important;border:1px solid #0b0b0b!important;
      color:#bdbdbd!important;font:9px/1 ui-monospace,Consolas,monospace!important;
      vertical-align:1px!important;box-shadow:none!important;letter-spacing:0!important;
    }
  `;
}
function rethemeFrame(fr){
  try{
    const st = fr.contentDocument && fr.contentDocument.getElementById('shell-skin');
    if(st) st.textContent = skinCSS();
  }catch(e){}
}
function rethemeFrames(){
  S.tabs.forEach(t => { if(t._frame) rethemeFrame(t._frame); });
}

/* 内嵌编辑器里的原生 <input type="color"> 在部分桌面 / PWA 环境会弹出
   到窗口外。注入一个同源小取色器，所有内嵌工具共用。 */
function embeddedColorPickerBootstrap(){
  if(window.__pwEmbeddedColorPicker) return;
  window.__pwEmbeddedColorPicker = true;
  const RECENT_KEY = 'pixelWorkshop_recentColors_v1';
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  const hex2rgb = h => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim());
    if(!m) return null;
    const n = parseInt(m[1], 16);
    return [(n>>16)&255, (n>>8)&255, n&255];
  };
  const rgb2hex = c => '#' + c.map(v => clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');
  const rgb2hsv = (r,g,b) => {
    r/=255; g/=255; b/=255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
    let h=0;
    if(d){
      if(max===r) h=((g-b)/d)%6;
      else if(max===g) h=(b-r)/d+2;
      else h=(r-g)/d+4;
      h*=60; if(h<0) h+=360;
    }
    return {h, s:max?d/max:0, v:max};
  };
  const hsv2rgb = (h,s,v) => {
    h=((h%360)+360)%360; s=clamp(s,0,1); v=clamp(v,0,1);
    const c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c;
    let r=0,g=0,b=0;
    if(h<60){r=c;g=x;} else if(h<120){r=x;g=c;} else if(h<180){g=c;b=x;}
    else if(h<240){g=x;b=c;} else if(h<300){r=x;b=c;} else {r=c;b=x;}
    return [(r+m)*255,(g+m)*255,(b+m)*255];
  };
  const style = document.createElement('style');
  style.textContent = `
  .epc-pop{position:fixed;z-index:99999;width:232px;padding:8px;background:linear-gradient(180deg,#242424,#191919);
    border:2px solid #0a0a0a;color:#e8e8e8;box-shadow:0 16px 44px #000c,inset 0 1px 0 #ffffff14;
    font:12px/1.2 "Microsoft YaHei",system-ui,sans-serif;user-select:none}
  .epc-head{display:flex;align-items:center;gap:6px;min-height:18px}
  .epc-prev{width:17px;height:17px;border:2px solid #0a0a0a;outline:1px solid #666;box-sizing:border-box}
  .epc-title{flex:1;font-size:11px;font-weight:700;color:#eee}
  .epc-x{width:22px;height:22px;padding:0;display:grid;place-items:center;background:#333;border:2px solid #101010;
    color:#bbb;font:14px/1 inherit;cursor:pointer}
  .epc-x:hover{background:#494949;color:#fff}
  .epc-picker{display:flex;gap:5px;height:122px;margin-top:7px}
  .epc-sv{position:relative;flex:1;min-width:0;border:2px solid #0a0a0a;cursor:crosshair;touch-action:none;background:#f00}
  .epc-sv i{position:absolute;width:11px;height:11px;border:2px solid #fff;outline:1px solid #000;border-radius:50%;
    transform:translate(-50%,-50%);pointer-events:none;box-shadow:0 0 4px #000a}
  .epc-hue{position:relative;width:17px;flex:0 0 auto;border:2px solid #0a0a0a;cursor:ns-resize;touch-action:none;
    background:linear-gradient(to bottom,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)}
  .epc-hue i{position:absolute;left:50%;width:13px;height:4px;background:#fff;border:1px solid #000;
    transform:translate(-50%,-50%);pointer-events:none}
  .epc-hex{display:grid;grid-template-columns:32px minmax(0,1fr);gap:5px;align-items:center;margin-top:6px}
  .epc-hex span{font-size:9.5px;color:#8c8c8c;letter-spacing:.5px}
  .epc-hex input,.epc-rgb input{width:100%;min-width:0;height:24px;padding:1px 4px;background:#2b2b2b;
    border:2px solid #101010;color:#f0f0f0;font:600 10.5px/1 ui-monospace,Consolas,monospace;outline:none;box-sizing:border-box}
  .epc-hex input:focus,.epc-rgb input:focus{border-color:#4c9a2a}
  .epc-rgb{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:4px}
  .epc-rgb label{display:flex;align-items:center;gap:2px;background:#262626;border:2px solid #101010;
    padding:1px 2px;font-size:9px;color:#929292;box-sizing:border-box}
  .epc-rgb input{height:20px;padding:0 1px;border:0;background:transparent;text-align:right}
  .epc-recent{display:flex;align-items:flex-start;gap:5px;margin-top:6px;min-height:17px}
  .epc-recent>span{font-size:9px;color:#858585;padding-top:3px}
  .epc-chips{flex:1;display:flex;flex-wrap:wrap;gap:3px;min-width:0}
  .epc-chip{width:16px;height:16px;padding:0;border:1px solid #0b0b0b;box-shadow:inset 0 0 0 1px #ffffff20;cursor:pointer}
  .epc-chip:hover{outline:1px solid #fff;outline-offset:1px}`;
  document.head.appendChild(style);

  function readRecent(){
    try{
      const arr = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(arr) ? arr.filter(h => hex2rgb(h)).slice(0,12) : [];
    }catch(_){ return []; }
  }
  function remember(hex){
    if(!hex2rgb(hex)) return;
    const key = hex.toLowerCase();
    const list = [key, ...readRecent().filter(h => h.toLowerCase() !== key)].slice(0,12);
    try{ localStorage.setItem(RECENT_KEY, JSON.stringify(list)); }catch(_){}
  }
  let live = null;
  function close(){
    if(!live) return;
    const old = live; live = null;
    document.removeEventListener('pointerdown', old.onDown, true);
    document.removeEventListener('keydown', old.onKey, true);
    window.removeEventListener('scroll', old.place, true);
    window.removeEventListener('resize', old.place);
    try{ old.pop.remove(); }catch(_){}
  }
  function inputSelector(inp){
    if(inp.id) return 'input[type="color"]#' + (window.CSS && CSS.escape ? CSS.escape(inp.id) : inp.id);
    if(inp.dataset.gcolor !== undefined) return 'input[type="color"][data-gcolor="' + inp.dataset.gcolor + '"]';
    if(inp.dataset.set) return 'input[type="color"][data-set="' + inp.dataset.set + '"]';
    return null;
  }
  function open(anchor){
    if(!anchor || !anchor.isConnected) return;
    close();
    const sel = inputSelector(anchor);
    let inp = anchor;
    const rgb0 = hex2rgb(inp.value) || [255,255,255];
    let rgb = rgb0.slice();
    let hsv = rgb2hsv(rgb[0], rgb[1], rgb[2]);
    const pop = document.createElement('div');
    pop.className = 'epc-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', '选择颜色');
    pop.innerHTML = `
      <div class="epc-head"><span class="epc-prev"></span><b class="epc-title">选择颜色</b><button type="button" class="epc-x" aria-label="关闭">×</button></div>
      <div class="epc-picker"><div class="epc-sv"><i></i></div><div class="epc-hue"><i></i></div></div>
      <div class="epc-hex"><span>HEX</span><input type="text" maxlength="7" spellcheck="false"></div>
      <div class="epc-rgb">
        <label>R<input type="number" min="0" max="255"></label>
        <label>G<input type="number" min="0" max="255"></label>
        <label>B<input type="number" min="0" max="255"></label>
      </div>
      <div class="epc-recent"><span>最近</span><div class="epc-chips"></div></div>`;
    document.body.appendChild(pop);
    const q = s => pop.querySelector(s);
    const sv = q('.epc-sv'), svDot = sv.querySelector('i');
    const hue = q('.epc-hue'), hueDot = hue.querySelector('i');
    const hexIn = q('.epc-hex input');
    const rgs = pop.querySelectorAll('.epc-rgb input');
    const rr = rgs[0], gg = rgs[1], bb = rgs[2];
    const prev = q('.epc-prev');
    const chips = q('.epc-chips');
    if(!rr || !gg || !bb) return;
    function currentInput(){
      if(sel){
        const n = document.querySelector(sel);
        if(n && n.type === 'color'){ inp = n; return n; }
      }
      return inp;
    }
    function apply(hex, rememberNow){
      if(!hex2rgb(hex)) return;
      let target = currentInput();
      try{ target.value = hex; }catch(_){}
      target.dispatchEvent(new Event('input', {bubbles:true}));
      const after = currentInput();
      if(after !== target && after.isConnected){
        try{ after.value = hex; }catch(_){}
        target = after;
      }
      target.dispatchEvent(new Event('change', {bubbles:true}));
      if(rememberNow) remember(hex);
      renderChips();
    }
    function currentHex(){ return rgb2hex(rgb); }
    function render(){
      const hex = currentHex();
      prev.style.background = hex;
      if(document.activeElement !== hexIn) hexIn.value = hex;
      if(document.activeElement !== rr) rr.value = rgb[0];
      if(document.activeElement !== gg) gg.value = rgb[1];
      if(document.activeElement !== bb) bb.value = rgb[2];
      sv.style.background = 'linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(' + hsv.h + ',100%,50%))';
      svDot.style.left = (hsv.s*100) + '%';
      svDot.style.top = ((1-hsv.v)*100) + '%';
      hueDot.style.top = (hsv.h/360*100) + '%';
    }
    function renderChips(){
      const list = readRecent();
      chips.innerHTML = list.length ? list.map(h => '<button type="button" class="epc-chip" style="background:' + h + '" title="' + h.toUpperCase() + '" data-h="' + h + '"></button>').join('') : '';
    }
    function setRgb(next, rememberNow){
      rgb = next.map(v => clamp(Math.round(v),0,255));
      const nh = rgb2hsv(rgb[0],rgb[1],rgb[2]);
      if(nh.s > .001 && nh.v > .001) hsv.h = nh.h;
      hsv.s = nh.s; hsv.v = nh.v;
      render(); apply(currentHex(), rememberNow);
    }
    function setHsv(h,s,v,rememberNow){
      hsv.h=((h%360)+360)%360; hsv.s=clamp(s,0,1); hsv.v=clamp(v,0,1);
      rgb = hsv2rgb(hsv.h,hsv.s,hsv.v).map(v => clamp(Math.round(v),0,255));
      render(); apply(currentHex(), rememberNow);
    }
    function bindDrag(el, fn){
      let id = null;
      el.addEventListener('pointerdown', e => {
        e.preventDefault(); id = e.pointerId;
        try{ el.setPointerCapture(id); }catch(_){}
        fn(e);
      });
      el.addEventListener('pointermove', e => { if(e.pointerId === id) fn(e); });
      const end = e => {
        if(e.pointerId !== id) return;
        id = null;
        remember(currentHex());
        renderChips();
        try{ el.releasePointerCapture(e.pointerId); }catch(_){}
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    }
    bindDrag(sv, e => {
      const r = sv.getBoundingClientRect();
      setHsv(hsv.h, (e.clientX-r.left)/r.width, 1-(e.clientY-r.top)/r.height);
    });
    bindDrag(hue, e => {
      const r = hue.getBoundingClientRect();
      setHsv((e.clientY-r.top)/r.height*360, hsv.s, hsv.v);
    });
    hexIn.addEventListener('input', () => {
      let h = hexIn.value.trim().replace(/^#/,'');
      if(/^[0-9a-f]{3}$/i.test(h)) h = h.replace(/./g,'$&$&');
      const c = hex2rgb(h);
      if(c) setRgb(c);
    });
    hexIn.addEventListener('change', () => {
      let h = hexIn.value.trim().replace(/^#/,'');
      if(/^[0-9a-f]{3}$/i.test(h)) h = h.replace(/./g,'$&$&');
      const c = hex2rgb(h);
      if(c) setRgb(c, true); else render();
    });
    hexIn.addEventListener('blur', () => { hexIn.value = currentHex(); });
    [[rr,0],[gg,1],[bb,2]].forEach(([el,i]) => {
      el.addEventListener('input', () => setRgb([+rr.value||0,+gg.value||0,+bb.value||0]));
      el.addEventListener('change', () => setRgb([+rr.value||0,+gg.value||0,+bb.value||0], true));
    });
    chips.addEventListener('click', e => {
      const b = e.target.closest('[data-h]');
      if(b){
        const c = hex2rgb(b.dataset.h);
        if(c) setRgb(c, true);
      }
    });
    q('.epc-x').onclick = close;
    function place(){
      if(!live) return;
      let target = currentInput();
      let r;
      try{ r = target.getBoundingClientRect(); }catch(_){ return; }
      if(!target.isConnected && (!r.width || !r.height)) return;
      const pr = pop.getBoundingClientRect();
      const gap=7, pad=8;
      let left=r.left, top=r.bottom+gap;
      if(left+pr.width>innerWidth-pad) left=innerWidth-pr.width-pad;
      if(left<pad) left=pad;
      if(top+pr.height>innerHeight-pad) top=r.top-pr.height-gap;
      if(top<pad) top=Math.max(pad, innerHeight-pr.height-pad);
      pop.style.left=Math.round(left)+'px'; pop.style.top=Math.round(top)+'px';
    }
    const onDown = e => {
      if(pop.contains(e.target)) return;
      if(e.target === inp || (sel && e.target.closest && e.target.closest(sel))) return;
      close();
    };
    const onKey = e => { if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(); } };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    live = { pop, onDown, onKey, place };
    renderChips(); render();
    pop.style.visibility='hidden';
    place();
    pop.style.visibility='';
  }
  document.addEventListener('pointerdown', e => {
    const inp = e.target && e.target.closest && e.target.closest('input[type="color"]');
    if(!inp) return;
    e.preventDefault(); e.stopPropagation();
    open(inp);
  }, true);
  document.addEventListener('click', e => {
    const inp = e.target && e.target.closest && e.target.closest('input[type="color"]');
    if(inp){ e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('keydown', e => {
    if(e.key !== 'Enter' && e.key !== ' ') return;
    const inp = e.target && e.target.closest && e.target.closest('input[type="color"]');
    if(!inp) return;
    e.preventDefault(); open(inp);
  }, true);
}
function embeddedColorPickerScript(){
  return '<script>(' + embeddedColorPickerBootstrap.toString() + ')();<\/script>';
}

function mountEditor(t, host){
  /* 传统纹理与自定义纹理统一使用新版可停靠纹理编辑器；动画使用动画工作室 */
  const kind = t.kind === 'color' ? 'color' : t.kind === 'block' ? 'block'
    : t.kind === 'composite' ? 'composite' : t.kind === 'entity' ? 'entity'
    : (t.kind === 'ctex' || t.kind === 'tex') ? 'ctex' : 'anim';
  const pane = document.createElement('div');
  pane.className = 'ed-pane on';
  pane.dataset.tab = t.id;
  const src = embedSource(kind);
  if(!src){
    pane.innerHTML = '<div class="embed-missing">内嵌编辑器数据缺失：请重新生成 shell（见 README）。</div>';
    host.appendChild(pane);
    return;
  }
  let html = src.replace(/<\/head>/i, '<style id="shell-skin">' + skinCSS() + '</style></head>');
  html = /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, embeddedColorPickerScript() + '</body>')
    : html + embeddedColorPickerScript();
  const fr = document.createElement('iframe');
  fr.className = 'ed-frame';
  fr.setAttribute('title', t.title);
  fr.srcdoc = html;
  pane.appendChild(fr);
  host.appendChild(pane);
  t._pane = pane; t._frame = fr;
  fr.addEventListener('load', () => {
    rethemeFrame(fr);
    if(t.kind === 'color') return;   // 色彩拓展：独立工具，不接仓库保存
    try{
      const w = fr.contentWindow;
      ['pushUndoDoc','pushUndoCell'].forEach(fn => {
        const orig = w[fn];
        if(typeof orig === 'function' && !orig._wrapDirty){
          const wrapped = function(){ markDirty(t); return orig.apply(this, arguments); };
          wrapped._wrapDirty = true;
          w[fn] = wrapped;
        }
      });
    }catch(e){}
    clearDirty(t);
    injectEditorActions(fr, t);
    if(typeof PWExtensions !== 'undefined') PWExtensions.sendToFrame(fr);
    if(typeof PWShortcuts !== 'undefined'){ PWShortcuts.sendToFrame(fr); PWShortcuts.decorateFrame(fr, t); PWShortcuts.bindFrame(fr, t); }
    if(t.kind === 'tex') setupTextureMode(fr, t);
    if(t.kind === 'block'){
      try{ fr.contentWindow.BS.load(t.payload && t.payload.block); }catch(e){}
    }
    if(t.kind === 'composite'){
      try{ fr.contentWindow.CS.load(t.payload && t.payload.composite); }catch(e){}
    }
    if(t.kind === 'entity'){
      try{ fr.contentWindow.ES.load(t.payload && t.payload.armor); }catch(e){}
    }
    if(t.kind === 'ctex'){
      try{
        fr.contentWindow.CT.load(Object.assign({full:t.payload && t.payload.full, guide:t.payload && t.payload.guide},
          (t.payload && t.payload.ctex) || {}));
      }catch(e){}
    }
    if(t.kind === 'anim' && t.payload && t.payload.full){
      try{
        const im = new Image();
        im.onload = () => {
          try{ fr.contentWindow.importStrip(im, t.payload.texSize); clearDirty(t); }catch(e){}
        };
        im.src = t.payload.full;
      }catch(e){}
    }
  });
}

/* ---------------- 编辑器内「加载图像」弹窗动作桥 ---------------- */
window.addEventListener('message', e => {
  const d = e.data;
  if(!d || d.__pwAnim !== 1 || d.type !== 'load-image-action') return;
  if(typeof handleEditorLoadImageAction === 'function'){
    handleEditorLoadImageAction(d);
  }
});

/* ---------------- 色彩拓展 ↔ 编辑器 桥 ---------------- */
function colorTabFrame(){
  const t = S.tabs.find(x => x.kind === 'color');
  return t && t._frame;
}
function replyColor(msg){
  const fr = colorTabFrame();
  try{ if(fr && fr.contentWindow) fr.contentWindow.postMessage(Object.assign({__pwShell:1}, msg), '*'); }catch(e){}
}
function bridgeEditor(){
  let t = S.tabs.find(x => x.id === S.lastEditor && x._frame);
  if(!t) t = S.tabs.slice().reverse().find(x => x._frame && (x.kind === 'tex' || x.kind === 'anim' || x.kind === 'ctex'));
  if(!t) return null;
  try{ return t._frame.contentWindow.PW || null; }catch(e){ return null; }
}
window.addEventListener('message', e => {
  const d = e.data;
  if(!d || d.__pwColor !== 1) return;
  const pw = bridgeEditor();
  if(d.type === 'brush-get'){
    let hex = null;
    try{ hex = pw ? pw.getBrush() : null; }catch(err){}
    replyColor({type:'brush', hex});
  } else if(d.type === 'brush-set'){
    let ok = false;
    try{ if(pw){ pw.setBrush(d.hex); ok = true; } }catch(err){}
    replyColor(ok ? {type:'brush-set-result', ok:true} : {type:'no-editor', for:'brush'});
  } else if(d.type === 'palette-add'){
    let n = 0;
    try{ if(pw) n = pw.addColors(d.colors) || 0; }catch(err){}
    replyColor(pw ? {type:'palette-added', count:n} : {type:'no-editor', for:'palette'});
  }
});

window.addEventListener('message', e => {
  const d = e.data;
  if(!d || d.__pwCtex !== 1) return;
  if(d.type === 'dirty'){
    const ct = S.tabs.find(x => (x.kind === 'ctex' || x.kind === 'tex') && x._frame && x._frame.contentWindow === e.source);
    if(ct) markDirty(ct);
  }
});
window.addEventListener('message', e => {
  const d = e.data;
  if(!d || d.__pwBlock !== 1) return;
  if(d.type === 'dirty' && d.__pwCtex){
    const ct = S.tabs.find(x => (x.kind === 'ctex' || x.kind === 'tex') && x._frame && x._frame.contentWindow === e.source);
    if(ct) markDirty(ct);
    return;
  }
  if(d.type === 'dirty'){
    const t = S.tabs.find(x => x.kind === 'block' && x._frame && x._frame.contentWindow === e.source);
    if(t) markDirty(t);
  } else if(d.type === 'paint'){
    const bt = S.tabs.find(x => x.kind === 'block' && x._frame && x._frame.contentWindow === e.source);
    if(bt) openBlockPaint(bt, d);
  } else if(d.type === 'thumb'){
    /* 预览窗口的默认视角大图：直接持久化到卡片，顺手把旧的小图升级掉 */
    if(pvFrame && pvCardId && e.source === pvFrame.contentWindow && d.data){
      const hit = findCardAnywhere(pvCardId);
      if(hit && hit.card){
        hit.card.thumb = d.data;
        saveData();
        if($('#catList')) refreshList();
      }
    }
    const bt = S.tabs.find(x => x.kind === 'block' && x._frame && x._frame.contentWindow === e.source);
    if(bt && bt.payload && d.data){
      const hit = findCardAnywhere(bt.payload.id);
      if(hit && hit.card) hit.card.thumb = d.data;
    }
  }
});
window.addEventListener('message', e => {
  const d = e.data;
  if(!d || d.__pwArmor !== 1) return;
  if(d.type === 'dirty'){
    const t = S.tabs.find(x => x.kind === 'entity' && x._frame && x._frame.contentWindow === e.source);
    if(t) markDirty(t);
  } else if(d.type === 'paint'){
    const et = S.tabs.find(x => x.kind === 'entity' && x._frame && x._frame.contentWindow === e.source);
    if(et) openArmorPaint(et, d);
  } else if(d.type === 'thumb'){
    if(pvFrame && pvKind === 'entity' && pvCardId && e.source === pvFrame.contentWindow && d.data){
      const hit = findCardAnywhere(pvCardId);
      if(hit && hit.card){
        hit.card.thumb = d.data;
        saveData();
        if($('#catList')) refreshList();
      }
    }
    const et = S.tabs.find(x => x.kind === 'entity' && x._frame && x._frame.contentWindow === e.source);
    if(et && et.payload && d.data){
      const hit = findCardAnywhere(et.payload.id);
      if(hit && hit.card) hit.card.thumb = d.data;
    }
  }
});
window.addEventListener('message', e => {
  const d = e.data;
  if(!d || d.__pwComposite !== 1) return;
  if(d.type === 'case'){
    if(pvFrame && pvKind === 'composite' && pvCardId && e.source === pvFrame.contentWindow){
      const hit = findCardAnywhere(pvCardId);
      if(hit && hit.card && hit.card.composite){
        const cs = Math.max(1, Math.min(3, +d.case || 1));
        hit.card.composite.caseSize = cs;
        const sub = $('#pvSub');
        if(sub) sub.textContent = '方块 · 复合纹理 · ' + cs + '×' + cs + '×1';
        saveData();
        if($('#catList')) refreshList();
      }
    }
  } else if(d.type === 'dirty'){
    const t = S.tabs.find(x => x.kind === 'composite' && x._frame && x._frame.contentWindow === e.source);
    if(t) markDirty(t);
  } else if(d.type === 'paint'){
    const ct = S.tabs.find(x => x.kind === 'composite' && x._frame && x._frame.contentWindow === e.source);
    if(ct) openCompositePaint(ct, d);
  } else if(d.type === 'thumb'){
    if(pvFrame && pvKind === 'composite' && pvCardId && e.source === pvFrame.contentWindow && d.data){
      const hit = findCardAnywhere(pvCardId);
      if(hit && hit.card){
        hit.card.thumb = d.data;
        saveData();
        if($('#catList')) refreshList();
      }
    }
    const ct = S.tabs.find(x => x.kind === 'composite' && x._frame && x._frame.contentWindow === e.source);
    if(ct && ct.payload && d.data){
      const hit = findCardAnywhere(ct.payload.id);
      if(hit && hit.card) hit.card.thumb = d.data;
    }
  }
});

/* 卡片对应的 16×16 图片（导入的用真图，示例卡片现场生成） */
function cardImage(c){
  if(!c) return null;
  if(c.full) return c.full;
  if(c.thumb) return c.thumb;
  if(!c.colors) return null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 16;
  paintSwatch(cv, c.colors, c.style || 'noise', hash(c.id));
  return cv.toDataURL();
}

/* 把「还原 / 保存回仓库」塞进工具自己工具栏的「文件」那一行（导入 PNG 旁边） */
function shellImageSize(url){
  return new Promise(resolve => {
    const im = new Image();
    im.onload = () => resolve({w:im.naturalWidth, h:im.naturalHeight});
    im.onerror = () => resolve({w:0, h:0});
    im.src = url;
  });
}
async function assetFileInFrame(w, asset){
  const res = await fetch(asset.url);
  const blob = await res.blob();
  const name = (asset.name || 'texture').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) + '.png';
  return new w.File([blob], name, {type:'image/png'});
}
async function applyLibraryAsset(fr, t, asset){
  const w = fr.contentWindow;
  if(!w || !asset || !asset.url) return;
  if(t.kind === 'anim'){
    const f = await assetFileInFrame(w, asset);
    if(typeof w.loadImageFile === 'function') w.loadImageFile(f, w.doImport);
    return;
  }
  if(t.kind === 'ctex' || t.kind === 'tex'){
    const f = await assetFileInFrame(w, asset);
    if(typeof w.loadImage === 'function') w.loadImage(f);
    return;
  }
  if(t.kind === 'composite'){
    const size = await shellImageSize(asset.url);
    if(size.w === 128 && size.h === 128 && w.CS && w.CS.importWholeData){
      w.CS.importWholeData(asset.url, asset.name);
      return;
    }
    const f = await assetFileInFrame(w, asset);
    if(typeof w.importTexture === 'function') w.importTexture(f);
    return;
  }
  if(t.kind === 'entity'){
    const f = await assetFileInFrame(w, asset);
    if(typeof w.importTexture === 'function') w.importTexture(f);
    return;
  }
  if(t.kind === 'block'){
    const f = await assetFileInFrame(w, asset);
    if(typeof w.importTexture === 'function') w.importTexture(f);
    return;
  }
}
function openEditorLibrary(fr, t){
  if(typeof PWImport === 'undefined' || !PWImport.openLibraryPicker){ toast('仓库选择器未加载'); return; }
  PWImport.openLibraryPicker({
    title:'从仓库选择素材',
    onPick: asset => {
      applyLibraryAsset(fr, t, asset).catch(err => {
        console.error(err);
        toast('导入失败：' + (err && err.message ? err.message : err));
      });
    }
  });
}
function openReferenceLibrary(fr){
  if(typeof PWImport === 'undefined' || !PWImport.openLibraryPicker){ toast('仓库选择器未加载'); return; }
  PWImport.openLibraryPicker({
    title:'从仓库选择参考图',
    onPick: async asset => {
      const w = fr.contentWindow;
      if(!w || !asset.url) return;
      const f = await assetFileInFrame(w, asset);
      if(typeof w.rpImportFile === 'function') w.rpImportFile(f);
      else toast('当前编辑器不支持参考图');
    }
  });
}

function injectEditorActions(fr, t){
  try{
    const d = fr.contentDocument;
    if(!d) return;
    const imp = d.getElementById('tbImport');
    const row = imp ? imp.parentElement : d.querySelector('.tb');
    if(!row) return;
    if(row.querySelector('[data-shell="save"]')) return;
    const isBlockPaint = !!(t.payload && t.payload.blockPaint);
    const isArmorPaint = !!(t.payload && t.payload.armorPaint);
    const isCompositePaint = !!(t.payload && t.payload.compositePaint);
    const isCreatePaint = !!(t.payload && t.payload.createPaint);
    const isPaint = isBlockPaint || isArmorPaint || isCompositePaint || isCreatePaint;
    const paintLabel = isCreatePaint ? '机械动力' : isCompositePaint ? '复合纹理' : isArmorPaint ? '盔甲' : '方块';
    const applyPaint = tt => {
      if(isCreatePaint) applyPaintToCreate(tt);
      else if(isCompositePaint) applyPaintToComposite(tt);
      else if(isArmorPaint) applyPaintToArmor(tt);
      else applyPaintToBlock(tt);
    };
    const mk = (label, cls, act) => {
      const b = d.createElement('button');
      b.textContent = label;
      if(cls) b.className = cls;
      b.dataset.shell = act;
      b.title = act === 'save' ? (isPaint ? '把绘画结果应用回' + paintLabel + '材质' : '把编辑器里的内容写回这张卡')
        : act === 'color' ? '用当前画笔色打开色彩拓展'
        : act === 'recolor' ? '打开一键换色，自动替换这张卡里的颜色'
        : act === 'library' ? '从仓库里选择一张已有纹理导入当前编辑器'
        : '丢弃修改，重新载入';
      b.addEventListener('click', () => {
        if(act === 'save'){ if(isPaint) applyPaint(t); else saveEditorTab(t); }
        else if(act === 'color'){
          if(typeof PWExtensions !== 'undefined' && !PWExtensions.isEnabled('color-studio')){ toast('「色彩拓展」已在设置里关闭'); return; }
          openColorStudio();
        }
        else if(act === 'recolor'){
          if(typeof PWExtensions !== 'undefined' && !PWExtensions.isEnabled('recolor')){ toast('「一键换色」已在设置里关闭'); return; }
          openRecolorTool(t.payload.id);
        }
        else if(act === 'library') openEditorLibrary(fr, t);
        else revertEditorTab(t);
      });
      return b;
    };
    if(!isPaint && t.kind !== 'color' && t.payload && t.payload.id
      && (typeof PWExtensions === 'undefined' || PWExtensions.isEnabled('recolor'))){
      row.appendChild(mk('一键换色', '', 'recolor'));
    }
    if(t.kind !== 'color' && (typeof PWExtensions === 'undefined' || PWExtensions.isEnabled('color-studio'))){
      row.appendChild(mk('色彩拓展', '', 'color'));
    }
    if(t.kind !== 'color') row.appendChild(mk('仓库素材', '', 'library'));
    row.appendChild(mk('还原', '', 'revert'));
    row.appendChild(mk(isPaint ? '应用回' + paintLabel : '保存回仓库', 'pri', 'save'));
    /* 手机端：底部栏直接放一个应用按钮 */
    if(isPaint){
      const mb = d.getElementById('mbar');
      if(mb && !mb.querySelector('[data-shell="apply-mobile"]')){
        const bm = d.createElement('button');
        bm.textContent = '应用回' + paintLabel;
        bm.className = 'pri';
        bm.dataset.shell = 'apply-mobile';
        bm.title = '把绘画结果应用回' + paintLabel + '材质';
        bm.addEventListener('click', () => applyPaint(t));
        mb.appendChild(bm);
      }
    }
    /* 参考图面板：从仓库选一张参考图 */
    const rpImp = d.getElementById('rpImport');
    if(rpImp && rpImp.parentElement && !rpImp.parentElement.querySelector('[data-shell="ref-lib"]')){
      const br = d.createElement('button');
      br.textContent = '仓库';
      br.dataset.shell = 'ref-lib';
      br.title = '从仓库选择一张纹理作为参考图';
      br.style.flex = '0 0 auto';
      br.addEventListener('click', () => openReferenceLibrary(fr));
      rpImp.parentElement.insertBefore(br, rpImp.nextSibling);
    }
  }catch(e){}
}

/* 在工作区里找卡（跨工作区） */
function findCardAnywhere(id){
  for(const w of WS){
    for(const cat of w.cats){
      const i = cat.cards.findIndex(c => c.id === id);
      if(i >= 0) return { ws:w, cat, card:cat.cards[i], index:i, list:cat.cards };
      for(const f of cat.cards){
        if(f.type === 'folder' && f.cards){
          const j = f.cards.findIndex(c => c.id === id);
          if(j >= 0) return { ws:w, cat, folder:f, card:f.cards[j], index:j, list:f.cards };
        }
      }
    }
  }
  return null;
}

function markDirty(t){
  t._dirty = true;
  const el = document.querySelector('.tab[data-tab="' + t.id + '"]');
  if(el) el.classList.add('dirty');
}
function clearDirty(t){
  t._dirty = false;
  const el = document.querySelector('.tab[data-tab="' + t.id + '"]');
  if(el) el.classList.remove('dirty');
}

/* 把编辑器当前画面（或整条动画）写回仓库里的那张卡 */
/* ---------------- 3D 预览窗口（方块 / 实体） ---------------- */
let pvCardId = null, pvFrame = null, pvKind = null;
function openModelPreview(card, kind){
  if(!card) return;
  const data = kind === 'entity' ? card.armor : kind === 'composite' ? card.composite : card.block;
  if(!data){
    if(kind === 'entity') openEntityEditor(card);
    else if(kind === 'composite') openCompositeEditor(card);
    else openBlockEditor(card);
    return;
  }
  const src = embedSource(kind);
  if(!src){ toast((kind === 'entity' ? '实体' : '方块') + '预览数据缺失，请重新打包'); return; }
  pvCardId = card.id;
  pvKind = kind;
  $('#pvTitle').textContent = card.name;
  const sub = $('#pvSub');
  if(kind === 'composite'){
    const cs = Math.max(1, Math.min(3, +(card.composite && card.composite.caseSize) || 1));
    if(sub) sub.textContent = '方块 · 复合纹理 · ' + cs + '×' + cs + '×1';
  } else if(sub){
    sub.textContent = kind === 'entity' ? '实体 · 原版盔甲 · 64×32' : '方块 · 正常展示';
  }
  const host = $('#pvHost');
  host.innerHTML = '';
  const fr = document.createElement('iframe');
  fr.setAttribute('title', '预览：' + card.name);
  fr.srcdoc = src.replace(/<\/head>/i, '<style id="shell-skin">' + skinCSS() + '</style></head>');
  host.appendChild(fr);
  pvFrame = fr;
  fr.addEventListener('load', () => {
    try{
      const w = fr.contentWindow;
      if(kind === 'entity'){
        w.ES.load(card.armor);
        w.ES.setPreview(true);
        w.ES.resetView();
      } else if(kind === 'composite'){
        w.CS.load(card.composite);
        w.CS.setPreview(true);
        w.CS.resetView();
      } else {
        w.BS.load(card.block);
        w.BS.setPreview(true);
        w.BS.resetView();
      }
    }catch(e){}
  });
  $('#pvModal').classList.add('on');
  document.body.classList.add('pv-open');
}
function openBlockPreview(card){ openModelPreview(card, 'block'); }
function openArmorPreview(card){ openModelPreview(card, 'entity'); }
function openCompositePreview(card){ openModelPreview(card, 'composite'); }
function closePreview(){
  const modal = $('#pvModal');
  if(modal) modal.classList.remove('on');
  document.body.classList.remove('pv-open');
  const host = $('#pvHost');
  if(host) host.innerHTML = '';
  pvFrame = null; pvCardId = null; pvKind = null;
}
function closeBlockPreview(){ closePreview(); }
function openBlockEditor(card){
  closePreview();
  if(!card) return;
  const hit = findCardAnywhere(card.id);
  if(hit) card = hit.card;
  const exist = S.tabs.find(t => t.kind === 'block' && t.payload && t.payload.id === card.id);
  if(exist) activateTab(exist.id);
  else newTab('block', card.name, card);
}
function openEntityEditor(card){
  closePreview();
  if(!card) return;
  const hit = findCardAnywhere(card.id);
  if(hit) card = hit.card;
  const exist = S.tabs.find(t => t.kind === 'entity' && t.payload && t.payload.id === card.id);
  if(exist) activateTab(exist.id);
  else newTab('entity', card.name, card);
}
function openCompositeEditor(card){
  closePreview();
  if(!card) return;
  const hit = findCardAnywhere(card.id);
  if(hit) card = hit.card;
  const exist = S.tabs.find(t => t.kind === 'composite' && t.payload && t.payload.id === card.id);
  if(exist) activateTab(exist.id);
  else newTab('composite', card.name, card);
}
function bindBlockPreview(){
  const modal = $('#pvModal');
  if(!modal) return;
  $('#pvClose').onclick = closePreview;
  $('#pvReset').onclick = () => {
    try{
      if(!pvFrame) return;
      if(pvKind === 'entity') pvFrame.contentWindow.ES.resetView();
      else if(pvKind === 'composite') pvFrame.contentWindow.CS.resetView();
      else pvFrame.contentWindow.BS.resetView();
    }catch(e){}
  };
  $('#pvEdit').onclick = () => {
    const hit = pvCardId ? findCardAnywhere(pvCardId) : null;
    if(!hit){ closePreview(); return; }
    if(pvKind === 'entity') openEntityEditor(hit.card);
    else if(pvKind === 'composite') openCompositeEditor(hit.card);
    else openBlockEditor(hit.card);
  };
  modal.addEventListener('click', e => { if(e.target === modal) closePreview(); });
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && modal.classList.contains('on')) closePreview();
  });
}

/* ---------------- 方块材质的绘画标签 ---------------- */
function openBlockPaint(bt, d){
  if(!bt || !d) return;
  const iw = Math.max(1, +d.width || 16);
  const ih = Math.max(1, +d.height || 16);
  /* 竖向条带（16×16×N）自动进动画编辑器，避免整条被压进单帧画布 */
  const guessFrames = (ih > iw && ih % iw === 0) ? Math.round(ih / iw) : 1;
  const frames = Math.max(1, +d.frames || guessFrames);
  const isAnim = frames > 1 && ih === iw * frames;
  const paintName = d.name || d.slot;
  if(isAnim){
    const existAnim = S.tabs.find(t => t.kind === 'anim' && t.payload && t.payload.blockPaint &&
      t.payload.blockPaint.blockTab === bt.id && t.payload.blockPaint.slot === d.slot);
    if(existAnim){ activateTab(existAnim.id); return; }
    const payload = {
      id:'paint' + Date.now().toString(36),
      name:'绘画 · ' + paintName,
      full:d.data,
      texSize:{ w:iw, h:iw, frames },
      blockPaint:{ blockTab:bt.id, slot:d.slot, name:paintName, size:iw, anim:true, frames }
    };
    newTab('anim', payload.name, payload);
    return;
  }
  const exist = S.tabs.find(t => t.kind === 'tex' && t.payload && t.payload.blockPaint &&
    t.payload.blockPaint.blockTab === bt.id && t.payload.blockPaint.slot === d.slot);
  if(exist){ activateTab(exist.id); return; }
  const size = (iw === ih && iw >= 8 && iw <= 256) ? iw : 16;
  const payload = {
    id:'paint' + Date.now().toString(36),
    name:'绘画 · ' + paintName,
    full:d.data,
    blockPaint:{ blockTab:bt.id, slot:d.slot, name:paintName, size }
  };
  newTab('tex', payload.name, payload);
}
function applyPaintToBlock(t){
  const fr = t._frame;
  const bp = t.payload && t.payload.blockPaint;
  if(!fr || !bp) return;
  const bt = S.tabs.find(x => x.id === bp.blockTab);
  if(!bt || !bt._frame){ toast('方块标签已经关闭，贴图没有应用'); return; }
  try{
    const cv = fr.contentWindow.buildStripCanvas();
    if(!cv) throw new Error('no canvas');
    const url = cv.toDataURL();
    bt._frame.contentWindow.postMessage({__pwBlock:1, type:'set-texture', slot:bp.slot, data:url}, '*');
    clearDirty(t);
    activateTab(bt.id);
    closeTab(t.id, true);
    toast('已应用回方块：' + bp.name);
  }catch(e){ toast('应用失败：' + (e && e.message || '未知错误')); }
}

/* ---------------- 盔甲材质的绘画标签（64×32，用自定义画布编辑） ---------------- */
function openArmorPaint(et, d){
  if(!et || !d) return;
  const exist = S.tabs.find(t => t.kind === 'ctex' && t.payload && t.payload.armorPaint &&
    t.payload.armorPaint.entityTab === et.id && t.payload.armorPaint.slot === d.slot);
  if(exist){ activateTab(exist.id); return; }
  const payload = {
    id:'paint' + Date.now().toString(36),
    name:'绘画 · ' + (d.name || d.slot),
    full:d.data,
    ctex:{w:Math.max(1, Math.min(512, +d.width || 64)), h:Math.max(1, Math.min(512, +d.height || 32))},
    guide:d.guide || null,
    armorPaint:{ entityTab:et.id, slot:d.slot, name:d.name || d.slot }
  };
  newTab('ctex', payload.name, payload);
}
function applyPaintToArmor(t){
  const fr = t._frame;
  const ap = t.payload && t.payload.armorPaint;
  if(!fr || !ap) return;
  const et = S.tabs.find(x => x.id === ap.entityTab);
  if(!et || !et._frame){ toast('盔甲标签已经关闭，贴图没有应用'); return; }
  try{
    const cv = fr.contentWindow.CT.buildStripCanvas();
    if(!cv) throw new Error('no canvas');
    const url = cv.toDataURL();
    et._frame.contentWindow.postMessage({__pwArmor:1, type:'set-texture', slot:ap.slot, data:url}, '*');
    clearDirty(t);
    activateTab(et.id);
    closeTab(t.id, true);
    toast('已应用回盔甲：' + ap.name);
  }catch(e){ toast('应用失败：' + (e && e.message || '未知错误')); }
}

/* ---------------- 复合方块来源纹理的绘画标签 ---------------- */
function openCompositePaint(ct, d){
  if(!ct || !d) return;
  const exist = S.tabs.find(t => t.kind === 'tex' && t.payload && t.payload.compositePaint &&
    t.payload.compositePaint.compositeTab === ct.id && t.payload.compositePaint.slot === +d.slot);
  if(exist){ activateTab(exist.id); return; }
  const name = d.name || ('连接纹理 ' + (+d.slot + 1));
  const payload = {
    id:'paint' + Date.now().toString(36),
    name:'绘画 · ' + name,
    full:d.data,
    compositePaint:{ compositeTab:ct.id, slot:+d.slot, name }
  };
  newTab('tex', payload.name, payload);
}
function applyPaintToComposite(t){
  const fr = t._frame;
  const cp = t.payload && t.payload.compositePaint;
  if(!fr || !cp) return;
  const ct = S.tabs.find(x => x.id === cp.compositeTab);
  if(!ct || !ct._frame){ toast('复合方块标签已经关闭，贴图没有应用'); return; }
  try{
    const cv = fr.contentWindow.buildStripCanvas();
    if(!cv) throw new Error('no canvas');
    const url = cv.toDataURL();
    ct._frame.contentWindow.postMessage({__pwComposite:1, type:'set-texture', slot:cp.slot, data:url}, '*');
    clearDirty(t);
    activateTab(ct.id);
    closeTab(t.id, true);
    toast('已应用回复合方块：' + cp.name);
  }catch(e){ toast('应用失败：' + (e && e.message || '未知错误')); }
}

/* ---------------- 机械动力卡片纹理的画布绘画标签 ---------------- */
function openCreatePaint(pt, d){
  if(!pt || !d) return;
  const slotKey = String(d.slotKey || d.path || d.name || '');
  const exist = S.tabs.find(t => t.kind && t.payload && t.payload.createPaint &&
    t.payload.createPaint.pluginTab === pt.id && t.payload.createPaint.slotKey === slotKey);
  if(exist){ activateTab(exist.id); return; }
  const w = Math.max(1, Math.min(2048, +d.width || 16));
  const h = Math.max(1, Math.min(2048, +d.height || 16));
  const useCtex = (w !== 16 || h !== 16);
  const label = d.name || slotKey || '纹理';
  const payload = {
    id:'paint' + Date.now().toString(36),
    name:'绘画 · ' + label,
    full:d.data,
    createPaint:{ pluginTab:pt.id, cardId:d.cardId || null, slotKey, name:label, useCtex }
  };
  if(useCtex){
    payload.ctex = { w, h };
    newTab('ctex', payload.name, payload);
  }else{
    newTab('tex', payload.name, payload);
  }
}
function applyPaintToCreate(t){
  const fr = t._frame;
  const cp = t.payload && t.payload.createPaint;
  if(!fr || !cp) return;
  const pt = S.tabs.find(x => x.id === cp.pluginTab);
  if(!pt || !pt._pluginFrame){ toast('机械动力标签已经关闭，贴图没有应用'); return; }
  try{
    const cv = cp.useCtex ? fr.contentWindow.CT.buildStripCanvas() : fr.contentWindow.buildStripCanvas();
    if(!cv) throw new Error('no canvas');
    const url = cv.toDataURL('image/png');
    pt._pluginFrame.contentWindow.postMessage({
      __pwPluginHost:1, type:'create-texture-updated',
      data:{ cardId:cp.cardId, slotKey:cp.slotKey, data:url }
    }, '*');
    clearDirty(t);
    activateTab(pt.id);
    closeTab(t.id, true);
    toast('已应用回机械动力：' + cp.name);
  }catch(e){ toast('应用失败：' + (e && e.message || '未知错误')); }
}

function saveEditorTab(t){
  const fr = t._frame;
  if(!fr || !fr.contentWindow){ toast('编辑器还没准备好'); return; }
  if(t.kind === 'ctex'){
    try{
      const cv = fr.contentWindow.CT.buildStripCanvas();
      if(!cv) throw new Error('no canvas');
      const hit = findCardAnywhere(t.payload && t.payload.id);
      if(!hit){ toast('这张卡已经不在仓库里了'); return; }
      const c = hit.card;
      const fw = cv.width, fh = cv.height;
      c.thumb = (typeof makeThumbDataURL === 'function')
        ? makeThumbDataURL(cv, fw, fh)
        : (() => {
            const th = document.createElement('canvas'); th.width = th.height = 16;
            const tg = th.getContext('2d'); tg.imageSmoothingEnabled = false;
            tg.drawImage(cv, 0, 0, fw, fh, 0, 0, 16, 16);
            return th.toDataURL();
          })();
      const cap = 2048;
      const sc = Math.min(1, cap / Math.max(fw, fh));
      const fc = document.createElement('canvas');
      fc.width = Math.max(1, Math.round(fw * sc));
      fc.height = Math.max(1, Math.round(fh * sc));
      const fg = fc.getContext('2d'); fg.imageSmoothingEnabled = false;
      fg.drawImage(cv, 0, 0, fc.width, fc.height);
      c.full = fc.toDataURL();
      c.badge = '纹理'; c.anim = false;
      c.ctex = {w:fw, h:fh};
      c.meta = fw + '×' + fh + ' · 自定义';
      delete c.colors; delete c.block;
      saveData(); clearDirty(t);
      if($('#catList')) refreshList();
      toast('已保存回仓库');
    }catch(e){ toast('保存失败：' + (e && e.message || '未知错误')); }
    return;
  }
  if(t.kind === 'composite'){
    try{
      const snap = fr.contentWindow.CS.snapshot();
      const hit = findCardAnywhere(t.payload && t.payload.id);
      if(!hit){ toast('这张卡已经不在仓库里了'); return; }
      const c = hit.card;
      c.composite = snap.composite;
      c.thumb = snap.thumb;
      c.badge = '方块';
      c.meta = snap.meta + ' · 刚刚';
      c.anim = false;
      delete c.block; delete c.armor; delete c.full; delete c.colors; delete c.ctex;
      saveData();
      clearDirty(t);
      if($('#catList')) refreshList();
      toast('已保存回仓库');
    }catch(e){ toast('保存失败：' + (e && e.message || '未知错误')); }
    return;
  }
  if(t.kind === 'entity'){
    try{
      const snap = fr.contentWindow.ES.snapshot();
      const hit = findCardAnywhere(t.payload && t.payload.id);
      if(!hit){ toast('这张卡已经不在仓库里了'); return; }
      const c = hit.card;
      c.armor = snap.armor;
      c.thumb = snap.thumb;
      const entityBadge = {wolf:'狼铠', horse:'马铠', nautilus:'鹦鹉螺铠', ghast:'恶魂挽具', elytra:'鞘翅'};
      c.badge = entityBadge[snap.armor.profile] || '实体';
      c.meta = snap.meta + ' · 刚刚';
      c.anim = false;
      delete c.block; delete c.full; delete c.colors; delete c.ctex;
      saveData();
      clearDirty(t);
      if($('#catList')) refreshList();
      toast('已保存回仓库');
    }catch(e){ toast('保存失败：' + (e && e.message || '未知错误')); }
    return;
  }
  if(t.kind === 'block'){
    try{
      const snap = fr.contentWindow.BS.snapshot();
      const hit = findCardAnywhere(t.payload && t.payload.id);
      if(!hit){ toast('这张卡已经不在仓库里了'); return; }
      const c = hit.card;
      c.block = snap.block;
      c.thumb = snap.thumb;
      c.badge = '方块';
      c.meta = snap.meta + ' · 刚刚';
      delete c.full; delete c.colors;
      saveData();
      clearDirty(t);
      if($('#catList')) refreshList();
      toast('已保存回仓库');
    }catch(e){ toast('保存失败：' + (e && e.message || '未知错误')); }
    return;
  }
  try{
    const cv = fr.contentWindow.buildStripCanvas();
    if(!cv) throw new Error('no canvas');
    const hit = findCardAnywhere(t.payload && t.payload.id);
    if(!hit){ toast('这张卡已经不在仓库里了'); return; }
    const c = hit.card;
    const fw = cv.width, fh = cv.height;
    const edDoc = fr.contentWindow.doc;
    const frames = Math.max(1, (edDoc && edDoc.frames) || (fh > fw && fh % fw === 0 ? Math.round(fh / fw) : 1));
    const frameW = (edDoc && edDoc.w) || fw;
    const frameH = (edDoc && edDoc.h) || (frames > 1 ? Math.round(fh / frames) : fh);

    c.thumb = (typeof makeThumbDataURL === 'function')
      ? makeThumbDataURL(cv, frameW, frameH)
      : (() => {
          const th = document.createElement('canvas'); th.width = th.height = 16;
          const tg = th.getContext('2d'); tg.imageSmoothingEnabled = false;
          tg.drawImage(cv, 0, 0, frameW, frameH, 0, 0, 16, 16);
          return th.toDataURL();
        })();

    const cap = 2048;
    const sc = Math.min(1, cap / Math.max(fw, fh));
    const fc = document.createElement('canvas');
    fc.width = Math.max(1, Math.round(fw * sc));
    fc.height = Math.max(1, Math.round(fh * sc));
    const fg = fc.getContext('2d'); fg.imageSmoothingEnabled = false;
    fg.drawImage(cv, 0, 0, fc.width, fc.height);
    c.full = fc.toDataURL();

    c.texSize = { w: frameW, h: frameH, frames };
    c.anim = frames > 1;
    c.badge = c.anim ? '动画' : '纹理';
    c.meta = (frames > 1 ? (frameW + '×' + frameH + ' · ' + frames + ' 帧') : (fw + '×' + fh)) + ' · 刚刚';
    saveData();
    clearDirty(t);
    if($('#catList')) refreshList();
    toast('已保存回仓库');
  }catch(e){ toast('保存失败：' + (e && e.message || '未知错误')); }
}

/* 丢掉编辑器里的修改，重新按仓库里的卡打开 */
function revertEditorTab(t){
  const eds = $('#editors');
  if(t._pane){ t._pane.remove(); }
  t._pane = null; t._frame = null;
  mountEditor(t, eds);
}

/* 纹理模式：用统一的可停靠纹理编辑器载入仓库贴图 / 模型彩绘数据 */
function setupTextureMode(fr, t){
  try{
    const w = fr.contentWindow;
    if(!w || !w.CT || typeof w.CT.load !== 'function') return;
    const bp = t.payload && t.payload.blockPaint;
    const ts = t.payload && t.payload.texSize;
    const img = cardImage(t.payload);
    const hasExplicitSize = !!((bp && bp.size) || (ts && ts.w && ts.h));
    const initW = (bp && bp.size) ? bp.size : (ts && ts.w) ? ts.w : (hasExplicitSize ? 16 : 0);
    const initH = (bp && bp.size) ? bp.size : (ts && ts.h) ? ts.h : (hasExplicitSize ? 16 : 0);
    w.CT.load({
      mode: 'tex',
      w: initW,
      h: initH,
      full: img || '',
      guide: t.payload && t.payload.guide,
      layerName: (t.payload && t.payload.name) || '底图',
      onLoad: () => clearDirty(t)
    });
    clearDirty(t);
  }catch(e){}
}

/* ============================================================
   弹窗：新建 / 重命名
   ============================================================ */
let dlgPick = 'tex', dlgCat = null, dlgOkFn = null, dlgNameTouched = false;

function askName(title, value, onOk){
  $('#dlgTitle').innerHTML = iconSVG('tex', 14) + esc(title);
  $('#dlgBody').innerHTML =
    '<input class="dlg-input" id="dlgName" maxlength="40" spellcheck="false" value="' + esc(value || '') + '">' +
    '<div class="hintline">回车确认 · Esc 取消</div>';
  dlgOkFn = () => {
    const v = (($('#dlgName') && $('#dlgName').value) || '').trim();
    if(!v){ toast('名字不能为空'); return; }
    closeDialog();
    onOk(v);
  };
  $('#dlgOk').textContent = '确定';
  $('#dlgCancel').style.display = '';
  $('#modal').classList.add('on');
  const inp = $('#dlgName');
  inp.focus(); inp.select();
  inp.onkeydown = e => {
    if(e.key === 'Enter'){ e.preventDefault(); dlgOkFn(); }
    if(e.key === 'Escape'){ e.preventDefault(); closeDialog(); }
  };
}

function showLocalPackHelp(kind){
  const create = kind === 'create';
  $('#dlgTitle').innerHTML = iconSVG('box', 14) + (create ? ' 本地 Create 内容包' : ' 本地原版素材');
  $('#dlgBody').innerHTML =
    '<div class="hintline" style="font-size:11.5px;line-height:1.9;text-align:left;margin:0">' +
    (create
      ? '<b>推荐方式：安装即用</b><br>' +
        '把 Create 模组 jar 或资源包 ZIP 放进 <code>local/inbox/</code>，双击项目根目录的 <code>准备本地素材.bat</code>。<br>' +
        '脚本会生成 <code>local/create-pack.zip</code>，机械动力扩展下次打开时自动读取，不需要再手动选 jar。<br><br>' +
        '<b>手动方式</b><br>' +
        '仍然可以在扩展里选择 Create jar / ZIP。GitHub 版只包含插件代码，不附带 Create 资产。<br><br>' +
        '<b>注意</b><br>' +
        'local 文件夹只在本机使用，不会上传到 GitHub、Pages 或发行包。'
      : '<b>推荐方式：安装即用</b><br>' +
        '把原版 Minecraft 客户端 jar 或资源包 ZIP 放进 <code>local/inbox/</code>，双击项目根目录的 <code>准备本地素材.bat</code>。<br>' +
        '脚本会生成 <code>local/vanilla/catalog.json</code> 和纹理目录，素材库打开时自动显示原版方块 / 物品 / 实体 / 界面等纹理。<br><br>' +
        '<b>手动方式</b><br>' +
        '也可以继续用「导入 PNG / 导入 ZIP / JAR」把需要的纹理单独导入素材库。<br><br>' +
        '<b>注意</b><br>' +
        'local 文件夹只在本机使用，不会上传到 GitHub、Pages 或发行包。') +
    '</div>';
  dlgOkFn = () => closeDialog();
  $('#dlgOk').textContent = '知道了';
  $('#dlgCancel').style.display = 'none';
  $('#modal').classList.add('on');
}
function confirmDialog(title, text, okText, onOk){
  $('#dlgTitle').innerHTML = iconSVG('trash', 14) + esc(title);
  $('#dlgBody').innerHTML = '<div class="hintline" style="font-size:12.5px;line-height:1.8;margin:0">' + esc(text) + '</div>';
  dlgOkFn = () => { closeDialog(); onOk(); };
  $('#dlgOk').textContent = okText || '确定';
  $('#dlgCancel').style.display = '';
  $('#modal').classList.add('on');
}

const ENTITY_PRESETS = {
  armor:    {profile:'humanoid', label:'人形盔甲', badge:'实体', meta:'人形盔甲 · 64×32 · 2 纹理', kind:'vanilla_armor'},
  wolf:     {profile:'wolf',     label:'狼铠', badge:'实体', meta:'狼铠 · 64×32 · 整张'},
  horse:    {profile:'horse',    label:'马铠', badge:'实体', meta:'马铠 · 64×64 · 整张'},
  nautilus: {profile:'nautilus', label:'鹦鹉螺铠', badge:'实体', meta:'鹦鹉螺铠 · 128×128 · 整张'},
  ghast:    {profile:'ghast',    label:'快乐恶魂挽具', badge:'实体', meta:'快乐恶魂挽具 · 128×128 · 整张'},
  elytra:   {profile:'elytra',   label:'鞘翅', badge:'实体', meta:'鞘翅 · 64×32 · 整张'}
};

function openNewDialog(catId){
  dlgPick = 'tex'; dlgNameTouched = false;
  dlgCat = catId || (cats()[0] && cats()[0].id) || null;
  $('#dlgTitle').innerHTML = iconSVG('plus', 14) + '新建内容';
  $('#dlgBody').innerHTML =
    '<input class="dlg-input" id="dlgName" maxlength="40" spellcheck="false" placeholder="名称" value="新建纹理">' +
    '<div class="opt on sub-open" data-pick="tex" data-type="tex"><div class="oi">' + iconSVG('tex',16) + '</div>' +
      '<div class="ot"><b>纹理</b><span>像素贴图</span></div><span class="caret">▾</span></div>' +
    '<div class="subopts on" id="texSub">' +
      '<div class="subopt on" data-pick="tex"><i class="sub-ico">' + iconSVG('tex', 16) + '</i><b>传统纹理</b><span>16×16 贴图</span></div>' +
      '<div class="subopt" data-pick="ctex"><i class="sub-ico">' + iconSVG('grid', 16) + '</i><b>自定义纹理</b><span>自定画布宽高</span></div>' +
      '<div class="shell-res-wrap" id="ctexSize">' +
        '<div class="custom-size"><label>宽 <input type="number" id="ctexW" min="1" max="2048" value="16"></label>' +
        '<label>高 <input type="number" id="ctexH" min="1" max="2048" value="16"></label><span class="hint">像素</span><span class="hq" data-help="自定义纹理的画布宽高，范围 1–2048 像素（支持 16×16 到 1920×1080 等任意尺寸）；创建后在编辑器内也可随时调整大小或旋转翻转。">?</span></div>' +
        '<div class="shell-presets" id="ctexPresets">' +
          '<button type="button" class="shell-pill on" data-w="16" data-h="16">16 × 16</button>' +
          '<button type="button" class="shell-pill" data-w="32" data-h="32">32 × 32</button>' +
          '<button type="button" class="shell-pill" data-w="64" data-h="64">64 × 64</button>' +
          '<button type="button" class="shell-pill" data-w="128" data-h="128">128 × 128</button>' +
          '<button type="button" class="shell-pill" data-w="256" data-h="256">256 × 256</button>' +
          '<button type="button" class="shell-pill" data-w="512" data-h="512">512 × 512</button>' +
          '<button type="button" class="shell-pill" data-w="1920" data-h="1080">1920 × 1080</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="opt" data-pick="anim"><div class="oi">' + iconSVG('anim',16) + '</div>' +
      '<div class="ot"><b>动画</b><span>16 帧（16×256），可改帧数</span></div></div>' +
    '<div class="opt" data-pick="block" data-type="block"><div class="oi">' + iconSVG('box',16) + '</div>' +
      '<div class="ot"><b>方块</b><span>MC 方块模型 · 材质列表 + 3D 预览</span></div><span class="caret">▾</span></div>' +
    '<div class="subopts" id="blockSub">' +
      '<div class="subopt on" data-pick="block"><i class="sub-ico">' + iconSVG('box', 16) + '</i><b>普通方块</b><span>模型 + 材质 + 3D</span></div>' +
      '<div class="subopt" data-pick="composite"><i class="sub-ico">' + iconSVG('grid', 16) + '</i><b>复合纹理方块</b><span>5 张连接纹理 8×8</span></div>' +
    '</div>' +
    '<div class="opt" data-pick="entity" data-type="entity"><div class="oi">' + iconSVG('entity',16) + '</div>' +
      '<div class="ot"><b>实体</b><span>装备 / 生物纹理</span></div><span class="caret">▾</span></div>' +
    '<div class="subopts" id="entitySub">' +
      '<div class="subopt on" data-pick="armor"><i class="sub-ico">' + iconSVG('entity', 15) + '</i><b>人形盔甲</b><span>64×32 · 2 张</span></div>' +
      '<div class="subopt" data-pick="wolf"><i class="sub-ico">' + iconSVG('entity', 15) + '</i><b>狼铠</b><span>64×32 · 整张</span></div>' +
      '<div class="subopt" data-pick="horse"><i class="sub-ico">' + iconSVG('entity', 15) + '</i><b>马铠</b><span>64×64 · 整张</span></div>' +
      '<div class="subopt" data-pick="nautilus"><i class="sub-ico">' + iconSVG('entity', 15) + '</i><b>鹦鹉螺铠</b><span>128×128 · 26.1+</span></div>' +
      '<div class="subopt" data-pick="ghast"><i class="sub-ico">' + iconSVG('entity', 15) + '</i><b>快乐恶魂挽具</b><span>128×128 · 整张</span></div>' +
      '<div class="subopt" data-pick="elytra"><i class="sub-ico">' + iconSVG('entity', 15) + '</i><b>鞘翅</b><span>64×32 · 整张</span></div>' +
    '</div>' +
    '<div class="opt" data-pick="folder"><div class="oi">' + iconSVG('folder',16) + '</div>' +
      '<div class="ot"><b>文件夹</b><span>在大类别里再分一层</span></div></div>' +
    '<div class="opt" data-pick="import"><div class="oi">' + iconSVG('box',16) + '</div>' +
      '<div class="ot"><b>导入 PNG</b><span>按 高÷宽 自动判定帧数</span></div></div>' +
    '<label class="checkline"><input type="checkbox" id="dlgOpen" checked>创建后立即打开</label>';
  const nameInp = $('#dlgName');
  if(nameInp) nameInp.addEventListener('input', () => { dlgNameTouched = true; });
  const setPick = pick => {
    dlgPick = pick;
    const isEntity = !!ENTITY_PRESETS[pick] || pick === 'entity';
    const parent = pick === 'ctex' ? 'tex' : isEntity ? 'entity' : pick === 'composite' ? 'block' : pick;
    $$('#dlgBody .opt').forEach(o => {
      const on = o.dataset.pick === pick || o.dataset.pick === parent;
      o.classList.toggle('on', on);
    });
    $$('#dlgBody .subopt').forEach(s => s.classList.toggle('on', s.dataset.pick === pick));
    const cs = $('#ctexSize');
    if(cs) cs.classList.toggle('on', pick === 'ctex');
    if(!dlgNameTouched && nameInp){
      const map = { tex:'新建纹理', ctex:'新建自定义纹理', anim:'新建动画', block:'新建方块',
        composite:'新建复合纹理方块', folder:'新建文件夹' };
      if(ENTITY_PRESETS[pick]) map[pick] = '新建' + ENTITY_PRESETS[pick].label;
      if(map[pick]) nameInp.value = map[pick];
    }
  };
  $$('#dlgBody .opt').forEach(o => o.onclick = () => {
    if(o.dataset.type){
      const sub = o.dataset.type === 'tex' ? $('#texSub')
        : o.dataset.type === 'block' ? $('#blockSub') : $('#entitySub');
      const open = !sub.classList.contains('on');
      $$('#dlgBody .subopts').forEach(s => s.classList.toggle('on', s === sub && open));
      $$('#dlgBody .opt[data-type]').forEach(x => x.classList.toggle('sub-open', x === o && open));
      if(open){
        if(o.dataset.type === 'tex') setPick(dlgPick === 'ctex' ? 'ctex' : 'tex');
        else if(o.dataset.type === 'block') setPick(dlgPick === 'composite' ? 'composite' : 'block');
        else setPick('armor');
      }
      return;
    }
    $$('#dlgBody .subopts').forEach(s => s.classList.remove('on'));
    $$('#dlgBody .opt[data-type]').forEach(x => x.classList.remove('sub-open'));
    setPick(o.dataset.pick);
  });
  $$('#dlgBody .subopt').forEach(s => s.onclick = e => { e.stopPropagation(); setPick(s.dataset.pick); });
  const syncCtexPills = () => {
    const w = +($('#ctexW') && $('#ctexW').value) || 0, h = +($('#ctexH') && $('#ctexH').value) || 0;
    $$('#ctexPresets .shell-pill').forEach(p => p.classList.toggle('on', +p.dataset.w === w && +p.dataset.h === h));
  };
  $$('#ctexPresets .shell-pill').forEach(p => p.onclick = () => {
    if($('#ctexW')) $('#ctexW').value = p.dataset.w;
    if($('#ctexH')) $('#ctexH').value = p.dataset.h;
    syncCtexPills();
  });
  if($('#ctexW')) $('#ctexW').addEventListener('input', syncCtexPills);
  if($('#ctexH')) $('#ctexH').addEventListener('input', syncCtexPills);
  setPick('tex');
  dlgOkFn = doCreate;
  $('#dlgOk').textContent = '创建';
  $('#dlgCancel').style.display = '';
  $('#modal').classList.add('on');
  paintIcons($('#modal'));
}
function closeDialog(){ $('#modal').classList.remove('on'); if($('#dlgOk')) $('#dlgOk').style.display = ''; if($('#dlgCancel')) $('#dlgCancel').textContent = '取消'; }

function doCreate(){
  const name = (($('#dlgName') && $('#dlgName').value.trim()) || '新建内容');
  const open = !!($('#dlgOpen') && $('#dlgOpen').checked);

  if(dlgPick === 'import'){ closeDialog(); $('#filePick').click(); return; }

  if(!currentWS()){ closeDialog(); toast('先新建一个工作区'); return; }
  if(!cats().length) cats().push({ id: uidWs(), name: '默认', open: true, cards: [] });

  const cat = findCat(dlgCat) || cats()[0];
  if(!cat){ closeDialog(); toast('先新建一个大类别'); return; }
  const cur = currentFolder();
  const target = (cur && cur.cat.id === cat.id) ? cur.folder : cat;

  let card;
  if(dlgPick === 'folder'){
    card = { id:'f' + Date.now().toString(36), name, meta:'文件夹 · 0 项', badge:'文件夹', type:'folder', cards:[] };
  } else if(dlgPick === 'ctex'){
    const w = Math.max(1, Math.min(2048, parseInt(($('#ctexW') && $('#ctexW').value) || '16', 10) || 16));
    const h = Math.max(1, Math.min(2048, parseInt(($('#ctexH') && $('#ctexH').value) || '16', 10) || 16));
    card = { id:'n' + Date.now().toString(36), name, meta:w + '×' + h + ' · 自定义',
      badge:'纹理', type:'item', ctex:{w, h} };
  } else {
    const isAnim = dlgPick === 'anim';
    const isBlock = dlgPick === 'block';
    const isComposite = dlgPick === 'composite';
    const preset = ENTITY_PRESETS[dlgPick] || null;
    card = { id:'n' + Date.now().toString(36), name,
      meta:preset ? preset.meta : isComposite ? '复合纹理 · 8×8 · 5 源' : '刚刚',
      badge: (isBlock || isComposite) ? '方块' : preset ? preset.badge : isAnim ? '动画' : '纹理',
      anim: isAnim, type:'item' };
    if(isBlock) card.block = {model:'cube_all', textures:{}};
    if(isComposite) card.composite = {kind:'sedna8', size:16, sources:[null,null,null,null,null]};
    if(preset){
      card.armor = {kind:preset.kind || 'entity_equipment', profile:preset.profile, textures:{}};
      card.badge = preset.profile === 'humanoid' ? '实体' : preset.label;
    }
  }
  target.cards.unshift(card);
  saveData();
  closeDialog();
  if(open && dlgPick !== 'folder'){
    touchRecent(card);
    newTab(card.ctex ? 'ctex' : card.composite ? 'composite' : card.block ? 'block'
      : card.armor ? 'entity' : card.anim ? 'anim' : 'tex', card.name, card);
    return;
  }
  refreshList();
  toast('已创建');
}

/* ---------------- 设置 / 关于 ---------------- */
function themeSectionHTML(){
  return '<div class="set-theme" id="setTheme">' +
    '<div class="set-theme-cur" id="themeCur"><span class="tchips"></span><b></b>' +
      '<span class="mini">主题</span><span class="hq" data-help="主题只改变界面的主色 / 选中色，不会改贴图或方块像素。设置会跟着本地数据一起保存。">?</span><span class="caret">▾</span></div>' +
    '<div class="theme-list" id="themeList"></div></div>';
}
function renderThemePicker(){
  const cur = THEMES.find(t => t.id === S.theme) || THEMES[0];
  const head = $('#themeCur');
  if(head){
    head.querySelector('.tchips').innerHTML = cur.c.map(c => `<i style="background:${c}"></i>`).join('');
    head.querySelector('b').textContent = cur.name;
  }
  const list = $('#themeList');
  if(!list) return;
  list.innerHTML = THEMES.map(t => `<div class="theme-row ${t.id === S.theme ? 'on' : ''}" data-th="${t.id}">
    <span class="tchips">${t.c.map(c => `<i style="background:${c}"></i>`).join('')}</span>
    <span class="tname">${t.name}</span>${t.id === S.theme ? '<span class="tick">✓</span>' : ''}</div>`).join('');
  list.querySelectorAll('[data-th]').forEach(el => el.onclick = () => {
    applyTheme(el.dataset.th);
    renderThemePicker();
    toast('已切换主题：' + THEMES.find(x => x.id === el.dataset.th).name);
  });
}
function installRowHTML(){
  const can = !!window._installPrompt;
  return '<div class="opt" data-set="install"><div class="oi">' + iconSVG('plus',16) + '</div>' +
    '<div class="ot"><b>添加到手机</b><span>' + (can ? '点击安装到主屏幕 / 桌面' : '需 https 或 localhost') + '</span>' +
    '<i class="ost">' + (can ? '浏览器已准备就绪' : 'Edge 菜单 → 添加到手机 / 安装应用') + '</i></div>' +
    '<span class="hq" data-help="安装需要 https 或 localhost，并且浏览器支持 PWA。手机 Edge / Chrome 打开后点菜单里的「添加到手机」或「安装应用」；桌面 Edge 可以用「发送到设备」。">?</span></div>';
}
function openSettings(){
  $('#dlgTitle').innerHTML = iconSVG('gear', 14) + '设置';
  $('#dlgBody').innerHTML = (typeof PWTutorial !== 'undefined' ? PWTutorial.settingsRowHTML() : '') +
    (typeof PWShortcuts !== 'undefined' ? PWShortcuts.settingsRowHTML() : '') +
    (typeof PWPlugins !== 'undefined' ? PWPlugins.settingsRowHTML() : '') +
    (typeof PWUpdates !== 'undefined' ? PWUpdates.rowHTML() : '') +
    (typeof PWAgent !== 'undefined' ? PWAgent.settingsRowHTML() : '') +
    (typeof PWExtensions !== 'undefined' ? PWExtensions.settingsHTML() : '') +
    themeSectionHTML() + installRowHTML() +
    '<div class="opt" data-set="export"><div class="oi">' + iconSVG('box',16) + '</div>' +
      '<div class="ot"><b>导出数据</b><span>把所有工作区 / 回收站存成 JSON 备份</span></div></div>' +
    '<div class="opt" data-set="import"><div class="oi">' + iconSVG('folder',16) + '</div>' +
      '<div class="ot"><b>导入数据</b><span>从备份 JSON 恢复（会覆盖当前数据）</span></div></div>' +
    '<div class="opt" data-set="empty"><div class="oi">' + iconSVG('trash',16) + '</div>' +
      '<div class="ot"><b>清空回收站</b><span>彻底删除回收站里的内容</span></div></div>';
  dlgOkFn = null;
  $('#dlgOk').textContent = '关闭';
  $('#dlgCancel').style.display = 'none';
  $('#modal').classList.add('on');
  renderThemePicker();
  if(typeof PWExtensions !== 'undefined') PWExtensions.bindSettings($('#dlgBody'));
  const body = $('#dlgBody');
  const tutRow = body.querySelector('[data-set="tutorial"]');
  if(tutRow && typeof PWTutorial !== 'undefined') tutRow.onclick = () => { closeDialog(); PWTutorial.openManual(); };
  const scRow = body.querySelector('[data-set="shortcuts"]');
  if(scRow && typeof PWShortcuts !== 'undefined') scRow.onclick = () => { closeDialog(); PWShortcuts.openShortcutCenter(); };
  const plRow = body.querySelector('[data-set="plugins"]');
  if(plRow && typeof PWPlugins !== 'undefined') plRow.onclick = () => { closeDialog(); PWPlugins.openPluginCenter(); };
  const upRow = body.querySelector('[data-set="update"]');
  if(upRow && typeof PWUpdates !== 'undefined') upRow.onclick = () => PWUpdates.checkAndShow();
  const agRow = body.querySelector('[data-set="agent"]');
  if(agRow && typeof PWAgent !== 'undefined') agRow.onclick = () => { closeDialog(); PWAgent.open(); PWAgent.openConfig(); };
  $('#themeCur').onclick = () => $('#setTheme').classList.toggle('open');
  body.querySelector('[data-set="export"]').onclick = () => { closeDialog(); exportData(); };
  body.querySelector('[data-set="import"]').onclick = () => { closeDialog(); $('#dataPick').click(); };
  body.querySelector('[data-set="empty"]').onclick = () => {
    closeDialog();
    confirmDialog('清空回收站', '回收站里的 ' + TRASH.length + ' 项会被彻底删除，不能恢复。', '清空', () => {
      TRASH = []; saveData(); renderWorkspaces();
      const t = activeTab();
      if(t && t.kind === 'trash') renderContent();
      renderStatus(); toast('回收站已清空');
    });
  };
  body.querySelector('[data-set="install"]').onclick = async () => {
    if(window._installPrompt){
      try{
        window._installPrompt.prompt();
        const r = await window._installPrompt.userChoice;
        if(r && r.outcome === 'accepted') toast('已添加到手机');
        else toast('已取消安装');
      }catch(e){}
      window._installPrompt = null;
      closeDialog();
    } else {
      closeDialog();
      confirmDialog('添加到手机',
        '用手机 Edge / Chrome 打开本页面（https 或 localhost），点右上菜单 →「添加到手机」或「安装应用」。\n\n桌面 Edge 可以用「发送到设备」把页面发到手机；需要 manifest 和 https 才能出现安装提示。',
        '知道了', () => {});
    }
  };
  paintIcons($('#modal'));
}
function openAbout(){
  $('#dlgTitle').innerHTML = iconSVG('home', 14) + '关于';
  $('#dlgBody').innerHTML =
    '<div class="hintline" style="font-size:12.5px;line-height:1.9;margin:0">' +
    '<b>像素工坊</b> v' + APP_VERSION + '<br>' +
    '纹理 / 动画贴图的收纳与绘制。数据保存在本机浏览器（localStorage），不上传。<br><br>' +
    '常用操作：双击卡片打开编辑器 · 右键重命名 / 删除 / 一键换色 · 拖入 PNG 直接导入 · 编辑器顶栏「保存回仓库」<br><br>' +
    '1.0.0：官方扩展「GIF 导出」「MC 方块素材库」· 方块编辑器支持动态纹理逐帧播放 · 原版方块 3D 化导入工作区 · 教程与首次启动引导<br>' +
    '0.18.0：传统纹理 / 自定义纹理 / 动画纹理统一可停靠编辑器布局 · 面板拖拽合并标签组 / 折叠 / 小窗口弹出缩放 · 画布绘画网格配置 · 顶栏 ⋯ 按钮显隐自定义 · 统一中性灰界面 · 桌面端（Tauri）<br>' +
    '0.17.0：AI 助手（接入你的大模型 API key）· 工具化换色 / 材质色阶变种 / 像素绘制 / 资源包导出 · 本地 LLM 代理与同意门控<br>' +
    '0.16.1：修复原生取色器弹窗 · Blockbench / Endesga 默认色板 · 变种工坊 6 色阶与自定义增删 · 一键换色材质色卡<br>' +
    '0.16.0：本地素材内容包（Create / 原版）· Create 多分支与 OBJ/MTL 3D 预览 · 旋转缩放与可拉伸预览 · 一键启动脚本<br>' +
    '0.15.0：彩色渐变叠加支持 2–8 个自定义色标并自动保存 · 设置新增 GitHub 检查更新<br>' +
    '0.14.1：动画播放插帧预览（相邻帧线性混合，跟随 .mcmeta interpolate）<br>' +
    '0.14.0：素材库（原版 / 模组纹理参考、ZIP/JAR 导入、参考图）<br>' +
    '0.13.0：可选插件框架 · 扩展中心 · GitHub / 本地 ZIP 安装 · 机械动力方块扩展<br>' +
    '0.12.0：快捷键注册表 · 独立快捷键中心 · 速查卡 · 编辑器键位徽标实时同步<br>' +
    '0.11.0：工具模块化注册表（内置扩展可启停）· 变种工坊（明度→材质色阶、批量矩阵、ZIP）<br>' +
    '0.10.1：资源包路径清理 · 多选删除边界 · 移动端安全区修正<br>' +
    '0.10.0：多选导出资源包 ZIP · 复合整图导入自动拆 5 面 · 狼铠/马铠/鹦鹉螺铠/恶魂挽具/鞘翅 · 智能 ZIP 导入 · 仓库素材选择器 · 安卓长按与安全区<br>' +
    '0.9.0：编辑器内部面板拖宽/跳转/拖动换栏 · 移除重复绘画右栏<br>' +
    '0.8.0：中央参照画布（并排对比 / 点击取色）· 画布底色改中性灰<br>' +
    '0.6.0：左右侧栏面板组 · 宽度拖拽/复位 · 快捷栏 · 手机面板切换 · Ctrl+B 快捷键<br>' +
    '0.5.0：新增「一键换色」工具（自动配色 / 实时预览 / 色卡 / 聚类 / 撤销 / 导出 PNG）<br>' +
    '0.4.2：修复尺寸切换按钮与设置 / 关于关闭按钮无响应<br>' +
    '0.4.1：复合方块 3D 改为外轮廓连接边框（1×1×1 / 2×2×1 / 3×3×1）<br>' +
    '0.4.0：方块新增复合纹理子类型（Sedna 8×8 拼接 + 3D）<br>' +
    '0.3.1：笔刷自由尺寸 · 纹理编辑器通用色卡<br>' +
    '0.3.0：新增实体内容类 · 原版盔甲（64×32 双层 3D 预览）<br>' +
    '0.2.1：帮助按钮样式统一 · 长说明收进「?」<br>' +
    '0.2.0：主题移入设置 · 颜色/调色板拆分 · 自定义纹理 · 手机安装 · 新内容变体' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:10px">' +
      '<button type="button" class="btn sm pri" id="aboutOpenTut">打开使用教程</button>' +
      '<button type="button" class="btn sm" id="aboutOpenTour">5 步简易引导</button>' +
    '</div>';
  dlgOkFn = null;
  $('#dlgOk').textContent = '知道了';
  $('#dlgCancel').style.display = 'none';
  $('#modal').classList.add('on');
  if($('#aboutOpenTut')) $('#aboutOpenTut').onclick = () => { closeDialog(); if(typeof PWTutorial !== 'undefined') PWTutorial.openManual(); };
  if($('#aboutOpenTour')) $('#aboutOpenTour').onclick = () => { closeDialog(); if(typeof PWTutorial !== 'undefined') PWTutorial.startTour(); };
}
function exportData(){
  try{
    const blob = new Blob([JSON.stringify({
      v:1, at:new Date().toISOString(), ws:WS, wsId:S.wsId, theme:S.theme, trash:TRASH, recent:RECENT
    }, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '像素工坊-备份-' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('已导出备份');
  }catch(e){ toast('导出失败'); }
}
function importData(file){
  const fr = new FileReader();
  fr.onload = () => {
    try{
      const d = JSON.parse(fr.result);
      if(!d || !Array.isArray(d.ws)) throw new Error('格式不对');
      WS = d.ws.map(w => ({
        id: w.id || uidWs(), name: w.name || '未命名工作区',
        cats: Array.isArray(w.cats) ? w.cats.map(c => ({
          id: c.id || uidWs(), name: c.name || '未命名大类别', open: c.open !== false,
          cards: Array.isArray(c.cards) ? c.cards.map(normCard) : []
        })) : []
      }));
      TRASH = Array.isArray(d.trash) ? d.trash : [];
      RECENT = Array.isArray(d.recent) ? d.recent : [];
      S.wsId = (d.wsId && WS.some(w => w.id === d.wsId)) ? d.wsId : (WS[0] ? WS[0].id : null);
      if(d.theme && THEMES.some(t => t.id === d.theme)) applyTheme(d.theme);
      saveData(); renderWorkspaces();
      const t = activeTab();
      if(t && t.kind === 'home') renderContent();
      renderStatus();
      toast('已导入 ' + WS.length + ' 个工作区');
    }catch(e){ toast('导入失败：' + (e.message || '文件格式不对')); }
  };
  fr.readAsText(file);
}

/* ============================================================
   状态栏
   ============================================================ */
function renderStatus(){
  const t = activeTab();
  const ws = currentWS();
  if(!t){
    $('#sbPath').textContent = ws ? esc(ws.name) : '没有打开的工作区';
    $('#sbSel').textContent = '';
    $('#sbCount').innerHTML = '<b>0</b> 项';
    return;
  }
  if(t.kind === 'home'){
    const curF = currentFolder();
    $('#sbPath').innerHTML = ws
      ? (curF ? `${esc(ws.name)} / <b>${esc(curF.folder.name)}</b>` : `<b>${esc(ws.name)}</b>`)
      : '没有工作区';
    const hit = S.sel ? findCard(S.sel) : null;
    $('#sbSel').textContent = S.selectMode
      ? `多选：${pickCount()} 项`
      : (hit ? `选中：${hit.card.name}` : '未选中');
    $('#sbCount').innerHTML = `<b>${visibleCount()}</b> 项`;
  } else {
    $('#sbPath').innerHTML = `${ws ? esc(ws.name) + ' / ' : ''}<b>${esc(t.title)}</b>`;
    $('#sbSel').textContent = t.kind === 'anim' ? '动画' : (t.kind === 'block' || t.kind === 'composite') ? '方块' : t.kind === 'entity' ? '实体' : t.kind === 'ctex' ? '自定义纹理' : t.kind === 'tutorial' ? '教程' : (t.kind === 'color' || t.kind === 'recolor' || t.kind === 'variant' || t.kind === 'shortcuts' || t.kind === 'assets' || t.kind === 'models' || t.kind === 'plugins' || t.kind === 'plugin' || t.kind === 'agent') ? '工具' : '纹理';
    $('#sbCount').innerHTML = t.kind === 'tutorial' ? '<b>10</b> 个章节' : (t.kind === 'color' || t.kind === 'recolor' || t.kind === 'variant' || t.kind === 'shortcuts' || t.kind === 'assets' || t.kind === 'models' || t.kind === 'plugins' || t.kind === 'plugin' || t.kind === 'agent') ? '<b>1</b> 个工具' : (t.kind === 'block' || t.kind === 'composite') ? '<b>1</b> 个方块' : t.kind === 'entity' ? '<b>1</b> 个实体' : '<b>1</b> 项';
  }
  if(typeof renderQuickRail === 'function') renderQuickRail();
}

/* ============================================================
   右侧主题
   ============================================================ */
/* 主题选择已收进设置弹窗（renderThemePicker） */


