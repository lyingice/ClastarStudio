/* ============================================================
   自定义取色器
   - 替代浏览器原生 <input type="color">：原生弹窗在部分桌面 /
     PWA 环境里会跑到窗口外，点不到也拖不动。
   - SVG 饱和度/明度方块 + 色相条 + HEX + RGB + 最近色 + 微调。
   - 挂在 body 上，fixed 定位，不会被侧栏的 overflow 裁切。
   ============================================================ */
(function(){
  const RECENT_KEY = 'pixelWorkshop_recentColors_v1';
  let live = null;

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function hexToRgb(hex){
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if(!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(rgb){
    return '#' + rgb.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  }
  function rgbToHsv(r, g, b){
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if(d){
      if(max === r) h = ((g - b) / d) % 6;
      else if(max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if(h < 0) h += 360;
    }
    return { h, s:max ? d / max : 0, v:max };
  }
  function hsvToRgb(h, s, v){
    h = ((h % 360) + 360) % 360;
    s = clamp(s, 0, 1); v = clamp(v, 0, 1);
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if(h < 60){ r = c; g = x; }
    else if(h < 120){ r = x; g = c; }
    else if(h < 180){ g = c; b = x; }
    else if(h < 240){ g = x; b = c; }
    else if(h < 300){ r = x; b = c; }
    else { r = c; b = x; }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }
  function readRecent(){
    try{
      const arr = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(arr) ? arr.filter(h => hexToRgb(h)).slice(0, 12) : [];
    }catch(_){ return []; }
  }
  function remember(hex){
    if(!hexToRgb(hex)) return;
    const key = hex.toLowerCase();
    const list = [key, ...readRecent().filter(h => h.toLowerCase() !== key)].slice(0, 12);
    try{ localStorage.setItem(RECENT_KEY, JSON.stringify(list)); }catch(_){}
  }

  function close(){
    if(!live) return;
    const old = live;
    live = null;
    document.removeEventListener('pointerdown', old.onDocDown, true);
    document.removeEventListener('keydown', old.onKey, true);
    window.removeEventListener('resize', old.place);
    window.removeEventListener('scroll', old.place, true);
    try{ old.pop.remove(); }catch(_){}
    if(old.anchor && old.anchor.isConnected){
      try{ old.anchor.focus({ preventScroll:true }); }catch(_){}
    }
    try{ old.opts.onClose && old.opts.onClose(); }catch(_){}
  }

  function open(anchor, options){
    if(!anchor || !anchor.isConnected) return null;
    close();
    const opts = Object.assign({}, options || {});
    const initial = hexToRgb(opts.color) || [255, 255, 255];
    let rgb = initial.slice();
    let hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
    let lastEmitted = rgbToHex(rgb);

    const pop = document.createElement('div');
    pop.className = 'pwc-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', opts.title || '颜色选择器');
    pop.innerHTML = `
      <div class="pwc-head">
        <span class="pwc-preview" data-pwc="preview"></span>
        <b class="pwc-title">${opts.title ? escapeHTML(opts.title) : '选择颜色'}</b>
        <button type="button" class="pwc-x" aria-label="关闭">×</button>
      </div>
      <div class="pwc-picker">
        <div class="pwc-sv" tabindex="0" role="slider" aria-label="饱和度与明度"><i></i></div>
        <div class="pwc-hue" tabindex="0" role="slider" aria-label="色相"><i></i></div>
      </div>
      <div class="pwc-hex"><span>HEX</span><input type="text" maxlength="7" spellcheck="false" aria-label="HEX 颜色"></div>
      <div class="pwc-rgb">
        <label>R<input type="number" min="0" max="255" step="1" aria-label="红色"></label>
        <label>G<input type="number" min="0" max="255" step="1" aria-label="绿色"></label>
        <label>B<input type="number" min="0" max="255" step="1" aria-label="蓝色"></label>
      </div>
      ${Array.isArray(opts.swatches) && opts.swatches.length ? '<div class="pwc-row"><span class="pwc-lbl">色卡</span><div class="pwc-swatches" data-pwc="swatches"></div></div>' : ''}
      <div class="pwc-row"><span class="pwc-lbl">最近</span><div class="pwc-swatches" data-pwc="recent"></div></div>
      <div class="pwc-tools">
        <button type="button" data-pwc="dark" title="降低明度">− 明</button>
        <button type="button" data-pwc="light" title="提高明度">＋ 明</button>
        <button type="button" data-pwc="desat" title="降低饱和度">− 艳</button>
        <button type="button" data-pwc="sat" title="提高饱和度">＋ 艳</button>
        <button type="button" data-pwc="eye" title="从屏幕取色">吸管</button>
      </div>`;
    document.body.appendChild(pop);

    const $ = s => pop.querySelector(s);
    const sv = $('.pwc-sv'), svDot = sv.querySelector('i');
    const hue = $('.pwc-hue'), hueDot = hue.querySelector('i');
    const hexIn = $('.pwc-hex input');
    const rgbInputs = pop.querySelectorAll('.pwc-rgb input');
    const rIn = rgbInputs[0], gIn = rgbInputs[1], bIn = rgbInputs[2];
    const preview = $('[data-pwc="preview"]');
    const swatchBox = $('[data-pwc="swatches"]');
    const recentBox = $('[data-pwc="recent"]');

    function currentHex(){ return rgbToHex(rgb); }
    function emit(){
      const hex = currentHex();
      if(hex === lastEmitted) return;
      lastEmitted = hex;
      try{ opts.onInput && opts.onInput(hex); }catch(err){ console.error(err); }
    }
    function render(){
      const hex = currentHex();
      preview.style.background = hex;
      if(document.activeElement !== hexIn) hexIn.value = hex;
      if(document.activeElement !== rIn) rIn.value = rgb[0];
      if(document.activeElement !== gIn) gIn.value = rgb[1];
      if(document.activeElement !== bIn) bIn.value = rgb[2];
      sv.style.background = `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(${hsv.h},100%,50%))`;
      svDot.style.left = (hsv.s * 100) + '%';
      svDot.style.top = ((1 - hsv.v) * 100) + '%';
      hueDot.style.top = (hsv.h / 360 * 100) + '%';
      sv.setAttribute('aria-valuetext', hex);
      hue.setAttribute('aria-valuetext', Math.round(hsv.h) + '°');
    }
    function setRgb(next, rememberNow){
      rgb = next.map(v => clamp(Math.round(v), 0, 255));
      const nextHsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
      if(nextHsv.s > 0.001 && nextHsv.v > 0.001) hsv.h = nextHsv.h;
      hsv.s = nextHsv.s; hsv.v = nextHsv.v;
      render();
      emit();
      if(rememberNow) remember(currentHex());
    }
    function setHsv(h, s, v, rememberNow){
      hsv.h = ((h % 360) + 360) % 360;
      hsv.s = clamp(s, 0, 1);
      hsv.v = clamp(v, 0, 1);
      rgb = hsvToRgb(hsv.h, hsv.s, hsv.v).map(v => clamp(Math.round(v), 0, 255));
      render();
      emit();
      if(rememberNow) remember(currentHex());
    }
    function svPoint(e){
      const r = sv.getBoundingClientRect();
      setHsv(hsv.h, (e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
    }
    function huePoint(e){
      const r = hue.getBoundingClientRect();
      setHsv((e.clientY - r.top) / r.height * 360, hsv.s, hsv.v);
    }
    function bindDrag(el, fn){
      let dragId = null;
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        dragId = e.pointerId;
        try{ el.setPointerCapture(dragId); }catch(_){}
        fn(e);
      });
      el.addEventListener('pointermove', e => { if(e.pointerId === dragId) fn(e); });
      const end = e => {
        if(e.pointerId !== dragId) return;
        dragId = null;
        remember(currentHex());
        renderSwatches();
        try{ el.releasePointerCapture(e.pointerId); }catch(_){}
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    }
    bindDrag(sv, svPoint);
    bindDrag(hue, huePoint);
    sv.addEventListener('keydown', e => {
      const step = e.shiftKey ? 0.1 : 0.02;
      if(e.key === 'ArrowLeft'){ e.preventDefault(); setHsv(hsv.h, hsv.s - step, hsv.v, true); }
      else if(e.key === 'ArrowRight'){ e.preventDefault(); setHsv(hsv.h, hsv.s + step, hsv.v, true); }
      else if(e.key === 'ArrowUp'){ e.preventDefault(); setHsv(hsv.h, hsv.s, hsv.v + step, true); }
      else if(e.key === 'ArrowDown'){ e.preventDefault(); setHsv(hsv.h, hsv.s, hsv.v - step, true); }
    });
    hue.addEventListener('keydown', e => {
      const step = e.shiftKey ? 15 : 3;
      if(e.key === 'ArrowUp'){ e.preventDefault(); setHsv(hsv.h - step, hsv.s, hsv.v, true); }
      else if(e.key === 'ArrowDown'){ e.preventDefault(); setHsv(hsv.h + step, hsv.s, hsv.v, true); }
    });

    function parseHex(v){
      let h = String(v || '').trim().replace(/^#/, '');
      if(/^[0-9a-f]{3}$/i.test(h)) h = h.replace(/./g, '$&$&');
      return /^[0-9a-f]{6}$/i.test(h) ? hexToRgb(h) : null;
    }
    hexIn.addEventListener('input', () => {
      const next = parseHex(hexIn.value);
      if(next) setRgb(next);
    });
    hexIn.addEventListener('change', () => {
      const next = parseHex(hexIn.value);
      if(next) setRgb(next, true);
      else render();
    });
    hexIn.addEventListener('blur', () => { hexIn.value = currentHex(); });
    [rIn, gIn, bIn].forEach(inp => {
      inp.addEventListener('input', () => {
        const next = [ +rIn.value || 0, +gIn.value || 0, +bIn.value || 0 ];
        setRgb(next);
      });
      inp.addEventListener('change', () => setRgb([ +rIn.value || 0, +gIn.value || 0, +bIn.value || 0 ], true));
    });

    function swatchHTML(hex, cls){
      return `<button type="button" class="${cls || 'pwc-chip'}" style="background:${hex}" title="${hex.toUpperCase()}" data-hex="${hex}"></button>`;
    }
    function renderSwatches(){
      const recent = readRecent();
      recentBox.innerHTML = recent.length ? recent.map(h => swatchHTML(h)).join('') : '<span class="pwc-none">还没有</span>';
      if(swatchBox){
        const list = (opts.swatches || []).map(h => hexToRgb(h) ? String(h).toLowerCase() : null)
          .filter((h, i, arr) => h && arr.indexOf(h) === i).slice(0, 24);
        swatchBox.innerHTML = list.length ? list.map(h => swatchHTML(h, 'pwc-chip small')).join('') : '<span class="pwc-none">—</span>';
      }
    }
    renderSwatches();
    pop.addEventListener('click', e => {
      const chip = e.target.closest('[data-hex]');
      if(chip){
        const next = hexToRgb(chip.dataset.hex);
        if(next){ setRgb(next, true); renderSwatches(); }
        return;
      }
      const btn = e.target.closest('[data-pwc]');
      if(!btn) return;
      const act = btn.dataset.pwc;
      if(act === 'dark') setHsv(hsv.h, hsv.s, hsv.v - 0.07, true);
      else if(act === 'light') setHsv(hsv.h, hsv.s, hsv.v + 0.07, true);
      else if(act === 'desat') setHsv(hsv.h, hsv.s - 0.08, hsv.v, true);
      else if(act === 'sat') setHsv(hsv.h, hsv.s + 0.08, hsv.v, true);
      else if(act === 'eye'){
        if(!window.EyeDropper){ btn.disabled = true; return; }
        new window.EyeDropper().open().then(res => {
          const next = hexToRgb(res && res.sRGBHex);
          if(next){ setRgb(next, true); renderSwatches(); }
        }).catch(() => {});
      }
    });
    $('.pwc-x').onclick = close;

    function place(){
      if(!live) return;
      if(!anchor.isConnected){ close(); return; }
      const a = anchor.getBoundingClientRect();
      const r = pop.getBoundingClientRect();
      const gap = 7, pad = 8;
      let left = a.left;
      let top = a.bottom + gap;
      if(left + r.width > innerWidth - pad) left = innerWidth - r.width - pad;
      if(left < pad) left = pad;
      if(top + r.height > innerHeight - pad) top = a.top - r.height - gap;
      if(top < pad) top = Math.max(pad, innerHeight - r.height - pad);
      pop.style.left = Math.round(left) + 'px';
      pop.style.top = Math.round(top) + 'px';
    }

    const onDocDown = e => {
      if(pop.contains(e.target) || anchor.contains(e.target)) return;
      close();
    };
    const onKey = e => {
      if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(); }
    };
    document.addEventListener('pointerdown', onDocDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);

    live = { pop, anchor, opts, onDocDown, onKey, place };
    render();
    place();
    const eyeBtn = $('[data-pwc="eye"]');
    if(eyeBtn && !window.EyeDropper) eyeBtn.style.display = 'none';
    try{ sv.focus({ preventScroll:true }); }catch(_){}
    return { close, setColor: hex => { const next = hexToRgb(hex); if(next) setRgb(next, true); } };
  }

  function escapeHTML(v){
    return String(v).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  }

  window.PWColorPicker = { open, close, readRecent };
})();
