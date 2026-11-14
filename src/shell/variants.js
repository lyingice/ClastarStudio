/* ============================================================
   变种工坊：母版明度 → 材质色阶 → 批量变种
   ============================================================ */
const VARIANT_PRESETS = [
  {id:'iron',     name:'铁',     colors:['#2b3037','#6a727d','#b6bec8','#f2f6fb']},
  {id:'steel',    name:'钢',     colors:['#252d39','#566679','#9bacc1','#e7f0fb']},
  {id:'copper',   name:'铜',     colors:['#3a1710','#8f3f25','#d17143','#ffc79e']},
  {id:'bronze',   name:'青铜',   colors:['#33240f','#76511e','#b88635','#ead39a']},
  {id:'gold',     name:'金',     colors:['#3e2a05','#a2720c','#dfb338','#fff0a6']},
  {id:'silver',   name:'银',     colors:['#303841','#7d8b99','#c6d1dc','#ffffff']},
  {id:'amethyst', name:'紫水晶', colors:['#211333','#5b2d8e','#9b6bd1','#eadcff']},
  {id:'emerald',  name:'绿宝石', colors:['#04251a','#0a6240','#23a268','#b9ffd8']},
  {id:'ruby',     name:'红宝石', colors:['#31070d','#811426','#cc3045','#ffbcc4']},
  {id:'lapis',    name:'青金石', colors:['#0b1738','#163b82','#2d68c4','#a9c9ff']},
  {id:'wood',     name:'木头',   colors:['#24160c','#5c3a1d','#9b6736','#dfb47a']},
  {id:'obsidian', name:'黑曜石', colors:['#09080f','#211b31','#443866','#9183bb']},
  {id:'ice',      name:'冰',     colors:['#17303f','#39708c','#83bad0','#e7fbff']},
  {id:'toxic',    name:'剧毒',   colors:['#122607','#2f6610','#6bb52a','#d9ff8f']}
];
const VARIANT_LS_OPTIONS = 'pixelWorkshop_variantOptions_v1';
const VARIANT_LS_CUSTOMS = 'pixelWorkshop_variantCustoms_v1';
const VARIANT_LS_OVERRIDES = 'pixelWorkshop_variantOverrides_v1';
const VARIANT_DEFAULT_OPTIONS = {
  autoStretch:true, protectEdge:true, preserveBlack:true, invert:false,
  contrast:1, gamma:1, pattern:'{name}_{ramp}', output:'flat'
};
const VARIANT_MAX_SOURCES = 24;

function variantOptions(){
  const o = Object.assign({}, VARIANT_DEFAULT_OPTIONS);
  try{
    const saved = JSON.parse(localStorage.getItem(VARIANT_LS_OPTIONS) || '{}');
    if(saved && typeof saved === 'object') Object.assign(o, saved);
  }catch(_){}
  return o;
}
function variantSaveOptions(o){
  try{ localStorage.setItem(VARIANT_LS_OPTIONS, JSON.stringify(o)); }catch(_){}
}
function variantLoadCustoms(){
  try{
    const a = JSON.parse(localStorage.getItem(VARIANT_LS_CUSTOMS) || '[]');
    return Array.isArray(a) ? a.filter(x => x && x.id && Array.isArray(x.colors)).map(x => ({
      id:String(x.id), name:String(x.name || '自定义色阶'), colors:x.colors.slice(0,4), custom:true
    })) : [];
  }catch(_){ return []; }
}
function variantLoadOverrides(){
  try{
    const o = JSON.parse(localStorage.getItem(VARIANT_LS_OVERRIDES) || '{}');
    return (o && typeof o === 'object') ? o : {};
  }catch(_){ return {}; }
}
function variantSaveCustoms(list){
  try{ localStorage.setItem(VARIANT_LS_CUSTOMS, JSON.stringify(list)); }catch(_){}
  VARIANT_CUSTOMS = list;
}
function variantSaveOverrides(map){
  try{ localStorage.setItem(VARIANT_LS_OVERRIDES, JSON.stringify(map)); }catch(_){}
  VARIANT_OVERRIDES = map;
}
let VARIANT_CUSTOMS = variantLoadCustoms();
let VARIANT_OVERRIDES = variantLoadOverrides();

function variantRamps(){
  const builtins = VARIANT_PRESETS.map(p => Object.assign({}, p, {
    colors:(VARIANT_OVERRIDES[p.id] || p.colors).slice(0,4),
    builtin:true
  }));
  return builtins.concat(VARIANT_CUSTOMS.map(x => Object.assign({}, x, {builtin:false})));
}
function variantRamp(id){
  return variantRamps().find(r => r.id === id) || variantRamps()[0];
}
function variantHexRgb(hex){
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if(!m) return {r:128,g:128,b:128};
  const n = parseInt(m[1], 16);
  return {r:(n>>16)&255, g:(n>>8)&255, b:n&255};
}
function variantRgbHex(r,g,b){
  return '#' + [r,g,b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2,'0')).join('');
}
function variantLum(r,g,b){ return 0.2126*r + 0.7152*g + 0.0722*b; }
function variantClamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function variantSampleRamp(colors, t){
  const stops = colors.map(variantHexRgb);
  if(!stops.length) return {r:128,g:128,b:128};
  if(stops.length === 1) return stops[0];
  t = variantClamp(t, 0, 1) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  const f = t - i;
  const a = stops[i], b = stops[i+1];
  return {
    r:a.r + (b.r - a.r) * f,
    g:a.g + (b.g - a.g) * f,
    b:a.b + (b.b - a.b) * f
  };
}

function variantAssetsAll(){
  if(typeof recolorAllAssets !== 'function') return [];
  return recolorAllAssets().filter(a => a && typeof a.data === 'string' && a.data.startsWith('data:image'));
}
function variantAssetTitle(asset){
  if(!asset) return '纹理';
  const slot = asset.slot === 'full' ? '' : ' · ' + (asset.label || asset.slot);
  return asset.cardName + slot;
}
function variantAssetBase(asset){
  const raw = String(asset.cardName || 'texture') + (asset.slot === 'full' ? '' : '_' + String(asset.slot || '').replace(/[:]/g, '_'));
  const ascii = raw.replace(/[^\x20-\x7e]/g, '').trim();
  const tail = String(asset.cardId || '').replace(/[^a-z0-9]/gi, '').slice(-8);
  return PWArchive.slug(ascii || tail, 'texture');
}
function variantAssetDimsLabel(asset){
  return asset.wsName ? asset.wsName : '';
}
function variantOptsKey(o){
  return [o.autoStretch,o.protectEdge,o.preserveBlack,o.invert,o.contrast,o.gamma].join('|');
}

/* ---------------- 图像处理 ---------------- */
function variantLoadImage(state, asset){
  if(state.images.has(asset.id)) return state.images.get(asset.id);
  const p = new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('图片读取失败'));
    im.src = asset.data;
  });
  state.images.set(asset.id, p);
  return p;
}
async function variantRender(asset, ramp, opts, state){
  const st = state || { images:new Map() };
  const im = await variantLoadImage(st, asset);
  const w = im.naturalWidth, h = im.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', {willReadFrequently:true});
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0,0,w,h);
  ctx.drawImage(im,0,0);
  const src = ctx.getImageData(0,0,w,h);
  const d = src.data;
  const n = w * h;
  const lums = new Float32Array(n);
  let min = 255, max = 0;
  for(let i=0;i<n;i++){
    const p = i*4;
    if(d[p+3] < 8){ lums[i] = -1; continue; }
    const l = variantLum(d[p],d[p+1],d[p+2]);
    lums[i] = l;
    if(l < min) min = l;
    if(l > max) max = l;
  }
  const range = max - min;
  const stretch = opts.autoStretch && range > 3;
  /* 中位亮度用于区分深色描边和内层亮面 */
  const opaque = [];
  for(let i=0;i<n;i++) if(lums[i] >= 0) opaque.push(lums[i]);
  opaque.sort((a,b) => a-b);
  const median = opaque.length ? opaque[Math.floor(opaque.length * .55)] : 128;
  const out = ctx.createImageData(w,h);
  const od = out.data;
  const c0 = variantHexRgb(ramp.colors[0]);
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const i = y*w+x, p = i*4;
      if(d[p+3] < 8){ od[p+3] = 0; continue; }
      let l = lums[i];
      if(stretch) l = (l - min) / range * 255;
      const isBlack = d[p] < 20 && d[p+1] < 20 && d[p+2] < 20;
      if(opts.preserveBlack && isBlack){
        od[p] = 0; od[p+1] = 0; od[p+2] = 0; od[p+3] = d[p+3];
        continue;
      }
      let edge = false;
      if(opts.protectEdge){
        const aAt = (xx, yy) => (xx < 0 || yy < 0 || xx >= w || yy >= h) ? 0 : d[(yy*w+xx)*4+3];
        edge = aAt(x-1,y) < 16 || aAt(x+1,y) < 16 || aAt(x,y-1) < 16 || aAt(x,y+1) < 16;
      }
      if(edge && l <= median * .96){
        od[p] = c0.r; od[p+1] = c0.g; od[p+2] = c0.b; od[p+3] = d[p+3];
        continue;
      }
      let t = variantClamp(l / 255, 0, 1);
      if(opts.contrast !== 1) t = variantClamp((t - .5) * opts.contrast + .5, 0, 1);
      if(opts.gamma !== 1) t = Math.pow(t, opts.gamma);
      if(opts.invert) t = 1 - t;
      const c = variantSampleRamp(ramp.colors, t);
      od[p] = c.r; od[p+1] = c.g; od[p+2] = c.b; od[p+3] = d[p+3];
    }
  }
  ctx.putImageData(out,0,0);
  return cv;
}
function variantDrawPreview(canvas, src, label){
  if(!canvas || !src) return;
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  g.clearRect(0,0,w,h);
  for(let y=0;y<h;y+=8) for(let x=0;x<w;x+=8){
    g.fillStyle = ((x/8|0)+(y/8|0)) % 2 ? '#2d2d2d' : '#232323';
    g.fillRect(x,y,8,8);
  }
  const iw = src.naturalWidth || src.width, ih = src.naturalHeight || src.height;
  const s = Math.min((w-4)/iw, (h-4)/ih);
  g.imageSmoothingEnabled = false;
  g.drawImage(src, (w-iw*s)/2, (h-ih*s)/2, iw*s, ih*s);
}
function variantThumb(cv){
  const t = document.createElement('canvas'); t.width = t.height = 16;
  const g = t.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(cv, 0, 0, 16, 16);
  return t.toDataURL('image/png');
}
function variantFullData(cv){
  const cap = 256;
  const s = Math.min(1, cap / Math.max(cv.width, cv.height));
  if(s >= 1) return cv.toDataURL('image/png');
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(cv.width*s));
  c.height = Math.max(1, Math.round(cv.height*s));
  c.getContext('2d').drawImage(cv,0,0,c.width,c.height);
  return c.toDataURL('image/png');
}

/* ---------------- 页面 ---------------- */
function openVariantLab(cardId){
  if(typeof PWExtensions !== 'undefined' && !PWExtensions.isEnabled('variant-lab')){
    toast('「变种工坊」已在设置里关闭');
    return;
  }
  let assetId = null;
  if(cardId && typeof recolorCardAssets === 'function'){
    const hit = findCardAnywhere(cardId);
    if(hit && hit.card){
      const assets = recolorCardAssets(hit.card, hit.ws);
      if(assets.length) assetId = assets[0].id;
    }
  }
  const exist = S.tabs.find(t => t.kind === 'variant');
  if(exist){
    if(assetId && exist._variant && !exist._variant.sources.has(assetId)){
      exist._variant.sources.add(assetId);
      if(exist._pane && exist._variant.assets.some(a => a.id === assetId)){
        variantRenderSources(exist, exist._pane);
        variantScheduleMatrix(exist, exist._pane);
      }
    }
    activateTab(exist.id);
    return;
  }
  newTab('variant', '变种工坊', assetId ? { assetId } : null);
}
function variantPageHTML(){
  return `
  <div class="variant-page">
    <div class="content-head rec-head var-head">
      <div class="crumbs"><b>变种工坊</b><span>母版明度 → 材质色阶 · 批量产出</span></div>
      <div class="tools">
        <button class="btn sm" id="varRefresh">刷新仓库</button>
        <button class="btn sm" id="varExport">导出 ZIP</button>
        <button class="btn pri" id="varSave">保存到仓库</button>
      </div>
    </div>
    <div class="scroll var-scroll">
      <div class="var-layout">
        <aside class="var-side var-left">
          <section class="var-block var-sources-block">
            <div class="var-block-head"><h3>母版纹理 <span id="varSrcCount">0</span></h3><button class="var-mini" id="varSrcClear">清空</button></div>
            <div class="var-src-search"><input id="varSearch" placeholder="搜索纹理 / 工作区…" autocomplete="off"><button class="var-mini" id="varSrcAll">全选</button></div>
            <div class="var-sources" id="varSources"></div>
          </section>
          <section class="var-block var-ramps-block">
            <div class="var-block-head"><h3>材质色阶 <span id="varRampCount">0</span></h3></div>
            <div class="var-ramps" id="varRamps"></div>
          </section>
        </aside>

        <section class="var-center">
          <div class="var-center-head">
            <div><h3>变种矩阵</h3><span id="varMatrixHint">勾选母版和色阶后自动生成</span></div>
            <div class="var-legend"><i class="ok"></i>导出 <i class="off"></i>跳过</div>
          </div>
          <div class="var-matrix" id="varMatrix"></div>
          <div class="var-progress" id="varProgress"></div>
        </section>

        <aside class="var-side var-right">
          <section class="var-block">
            <div class="var-block-head"><h3>编辑色阶</h3><span id="varActiveRampName">铁</span></div>
            <div class="var-ramp-editor" id="varRampEditor"></div>
          </section>
          <section class="var-block">
            <div class="var-block-head"><h3>当前对比</h3></div>
            <div class="var-compare">
              <figure><figcaption>原图</figcaption><canvas id="varCmpBefore" width="128" height="128"></canvas></figure>
              <figure><figcaption>变种</figcaption><canvas id="varCmpAfter" width="128" height="128"></canvas></figure>
            </div>
            <div class="var-compare-label" id="varCmpLabel">—</div>
          </section>
          <section class="var-block">
            <div class="var-block-head"><h3>处理选项</h3></div>
            <label class="var-check"><input type="checkbox" id="varAutoStretch"> 自动拉伸明度区间</label>
            <label class="var-check"><input type="checkbox" id="varProtectEdge"> 描边保护</label>
            <label class="var-check"><input type="checkbox" id="varPreserveBlack"> 保留纯黑描边</label>
            <label class="var-check"><input type="checkbox" id="varInvert"> 反转明暗</label>
            <div class="var-range"><label>对比</label><input type="range" id="varContrast" min="0.5" max="2" step="0.05" value="1"><output id="varContrastV">1.00</output></div>
            <div class="var-range"><label>Gamma</label><input type="range" id="varGamma" min="0.5" max="2" step="0.05" value="1"><output id="varGammaV">1.00</output></div>
          </section>
          <section class="var-block">
            <div class="var-block-head"><h3>命名与输出</h3></div>
            <label class="var-field">命名模板<input id="varPattern" value="{name}_{ramp}" spellcheck="false"></label>
            <label class="var-field">输出方式<select id="varOutput"><option value="flat">平铺 ZIP</option><option value="folders">按色阶分文件夹</option></select></label>
            <p class="var-hint">占位符：<code>{name}</code> 母版名 · <code>{ramp}</code> 色阶 ID · <code>{rampName}</code> 色阶名</p>
          </section>
        </aside>
      </div>
    </div>
    <div class="var-empty" id="varEmpty" hidden>
      <div class="var-empty-ico">${iconSVG('shape', 40)}</div>
      <b>还没有可处理的纹理</b>
      <p>先在内容库里新建或导入纹理，再回来刷新。</p>
      <button class="btn pri" id="varEmptyGo">去内容库</button>
    </div>
  </div>`;
}

function variantState(t){
  if(t._variant) return t._variant;
  const opts = variantOptions();
  const ramps = variantRamps();
  const st = {
    assets: [], sources:new Set(), rampOn:new Set(['iron','copper','gold','amethyst']),
    activeRamp: ramps[0] ? ramps[0].id : null, activeAsset:null,
    cellOn:new Map(), opts, images:new Map(), token:0, timer:null, busy:false
  };
  t._variant = st;
  return st;
}
function variantSelectedAssets(t){
  const st = variantState(t);
  return st.assets.filter(a => st.sources.has(a.id));
}
function variantSelectedRamps(t){
  const st = variantState(t);
  return variantRamps().filter(r => st.rampOn.has(r.id));
}
function variantRefreshAssets(t, pane, keep){
  const st = variantState(t);
  const all = variantAssetsAll();
  st.assets = all;
  const present = new Set(all.map(a => a.id));
  [...st.sources].forEach(id => { if(!present.has(id)) st.sources.delete(id); });
  const empty = pane.querySelector('#varEmpty');
  if(empty) empty.hidden = all.length > 0;
  if(!st.sources.size && t.payload && t.payload.assetId){
    const a = all.find(x => x.id === t.payload.assetId);
    if(a) st.sources.add(a.id);
  }
  if(!st.sources.size){
    const current = all.filter(a => a.wsId === S.wsId).slice(0, 6);
    (current.length ? current : all.slice(0, 6)).forEach(a => st.sources.add(a.id));
  }
  if(st.activeAsset && !all.some(a => a.id === st.activeAsset)) st.activeAsset = null;
  if(!st.activeAsset){
    const first = variantSelectedAssets(t)[0] || all[0];
    st.activeAsset = first ? first.id : null;
  }
  variantRenderSources(t, pane);
  variantRenderRamps(t, pane);
  variantRenderEditor(t, pane);
  variantUpdateCompare(t, pane);
  variantScheduleMatrix(t, pane);
}

function variantRenderSources(t, pane){
  const st = variantState(t);
  const box = pane.querySelector('#varSources');
  if(!box) return;
  const q = String((pane.querySelector('#varSearch')?.value) || '').trim().toLowerCase();
  const list = st.assets.filter(a => !q || (a.cardName + ' ' + a.wsName + ' ' + a.label).toLowerCase().includes(q));
  const count = pane.querySelector('#varSrcCount');
  if(count) count.textContent = st.sources.size + '/' + st.assets.length;
  if(!list.length){
    box.innerHTML = '<div class="var-empty-small">没有匹配的纹理</div>';
    return;
  }
  box.innerHTML = list.slice(0, 400).map(a => {
    const on = st.sources.has(a.id);
    return `<label class="var-src${on ? ' on' : ''}" title="${esc(a.cardName + ' · ' + (a.label || a.slot))}">
      <input type="checkbox" data-var-src="${esc(a.id)}"${on ? ' checked' : ''}>
      <span class="var-src-thumb"><img src="${a.data}" alt="" loading="lazy"></span>
      <span class="var-src-info"><b>${esc(a.cardName)}</b><span>${esc(a.label || a.slot)} · ${esc(a.wsName || '')}</span></span>
    </label>`;
  }).join('') + (list.length > 400 ? '<div class="var-empty-small">只显示前 400 张，请用搜索缩小范围</div>' : '');
}

function variantRenderRamps(t, pane){
  const st = variantState(t);
  const box = pane.querySelector('#varRamps');
  if(!box) return;
  const ramps = variantRamps();
  const count = pane.querySelector('#varRampCount');
  if(count) count.textContent = st.rampOn.size + '/' + ramps.length;
  box.innerHTML = ramps.map(r => {
    const on = st.rampOn.has(r.id);
    const active = st.activeRamp === r.id;
    return `<div class="var-ramp${active ? ' active' : ''}">
      <input type="checkbox" data-var-ramp-toggle="${esc(r.id)}"${on ? ' checked' : ''} title="是否加入矩阵">
      <button type="button" class="var-ramp-main" data-var-ramp-edit="${esc(r.id)}">
        <span class="var-ramp-swatches">${r.colors.map(c => `<i style="background:${esc(c)}"></i>`).join('')}</span>
        <b>${esc(r.name)}</b>
        <span class="var-ramp-id">${esc(r.id)}</span>
      </button>
      ${r.builtin ? '' : `<button type="button" class="var-ramp-del" data-var-ramp-del="${esc(r.id)}" title="删除自定义色阶">×</button>`}
    </div>`;
  }).join('');
}
function variantRenderEditor(t, pane){
  const st = variantState(t);
  const box = pane.querySelector('#varRampEditor');
  if(!box) return;
  const ramp = variantRamp(st.activeRamp);
  if(!ramp){ box.innerHTML = ''; return; }
  const nameEl = pane.querySelector('#varActiveRampName');
  if(nameEl) nameEl.textContent = ramp.name;
  const labels = ['暗部','中暗','中亮','高光'];
  box.innerHTML = `
    <div class="var-ramp-name-row">
      <input id="varRampName" value="${esc(ramp.name)}" maxlength="18" spellcheck="false">
      <button class="var-mini" id="varRampSave">存为新色阶</button>
    </div>
    <div class="var-stops">
      ${ramp.colors.map((c,i) => `<label class="var-stop"><input type="color" data-var-color="${i}" value="${esc(c)}"><span>${labels[i] || ('色 '+(i+1))}</span><i style="background:${esc(c)}"></i></label>`).join('')}
    </div>
    <div class="var-ramp-preview" id="varRampPreview" style="background:linear-gradient(90deg,${ramp.colors.map(esc).join(',')})"></div>
    <div class="var-ramp-actions">
      ${ramp.builtin ? '<button class="var-mini" id="varRampReset">恢复预设</button>' : '<button class="var-mini" id="varRampDelete">删除此色阶</button>'}
      <span>${ramp.builtin ? '内置色阶' : '自定义色阶'}</span>
    </div>`;
  box.querySelectorAll('[data-var-color]').forEach(inp => {
    inp.addEventListener('input', () => {
      const r = variantRamp(st.activeRamp);
      if(!r) return;
      r.colors[+inp.dataset.varColor] = inp.value;
      variantPersistRamp(r);
      const prev = box.querySelector('#varRampPreview');
      if(prev) prev.style.background = 'linear-gradient(90deg,' + r.colors.join(',') + ')';
      const sw = box.querySelectorAll('.var-stop i');
      if(sw[+inp.dataset.varColor]) sw[+inp.dataset.varColor].style.background = inp.value;
      variantUpdateCompare(t, pane);
      variantScheduleMatrix(t, pane);
    });
    inp.addEventListener('change', () => {
      variantRenderRamps(t, pane);
      variantRenderEditor(t, pane);
    });
  });
  const nameInp = box.querySelector('#varRampName');
  if(nameInp) nameInp.addEventListener('input', () => {
    const r = variantRamp(st.activeRamp);
    if(!r || r.builtin) return;
    r.name = nameInp.value.trim() || '自定义色阶';
    const saved = VARIANT_CUSTOMS.find(x => x.id === r.id);
    if(saved) saved.name = r.name;
    variantSaveCustoms(VARIANT_CUSTOMS);
    variantRenderRamps(t, pane);
    const nameEl = pane.querySelector('#varActiveRampName');
    if(nameEl) nameEl.textContent = r.name;
  });
  const save = box.querySelector('#varRampSave');
  if(save) save.onclick = () => variantSaveCustomRamp(t, pane);
  const reset = box.querySelector('#varRampReset');
  if(reset) reset.onclick = () => {
    const r = variantRamp(st.activeRamp);
    if(!r || !r.builtin) return;
    if(VARIANT_OVERRIDES[r.id]){
      delete VARIANT_OVERRIDES[r.id];
      variantSaveOverrides(VARIANT_OVERRIDES);
      variantRenderRamps(t, pane);
      variantRenderEditor(t, pane);
      variantUpdateCompare(t, pane);
      variantScheduleMatrix(t, pane);
      toast('已恢复「' + r.name + '」预设');
    }
  };
  const del = box.querySelector('#varRampDelete');
  if(del) del.onclick = () => {
    const r = variantRamp(st.activeRamp);
    if(!r || r.builtin) return;
    VARIANT_CUSTOMS = VARIANT_CUSTOMS.filter(x => x.id !== r.id);
    variantSaveCustoms(VARIANT_CUSTOMS);
    st.rampOn.delete(r.id);
    if(st.activeRamp === r.id) st.activeRamp = (variantRamps()[0] || {}).id || null;
    variantRenderRamps(t, pane);
    variantRenderEditor(t, pane);
    variantScheduleMatrix(t, pane);
    toast('已删除自定义色阶');
  };
}
function variantPersistRamp(ramp){
  if(!ramp) return;
  if(ramp.builtin){
    VARIANT_OVERRIDES[ramp.id] = ramp.colors.slice(0,4);
    variantSaveOverrides(VARIANT_OVERRIDES);
  }else{
    const saved = VARIANT_CUSTOMS.find(x => x.id === ramp.id);
    if(saved){ saved.colors = ramp.colors.slice(0,4); saved.name = ramp.name; variantSaveCustoms(VARIANT_CUSTOMS); }
  }
}
function variantSaveCustomRamp(t, pane){
  const st = variantState(t);
  const r = variantRamp(st.activeRamp);
  if(!r) return;
  const nameEl = pane.querySelector('#varRampName');
  const name = (nameEl && nameEl.value.trim()) || (r.name + ' 副本');
  const id = 'custom_' + Date.now().toString(36);
  VARIANT_CUSTOMS.push({ id, name, colors:r.colors.slice(0,4), custom:true });
  variantSaveCustoms(VARIANT_CUSTOMS);
  st.activeRamp = id;
  st.rampOn.add(id);
  variantRenderRamps(t, pane);
  variantRenderEditor(t, pane);
  variantUpdateCompare(t, pane);
  variantScheduleMatrix(t, pane);
  toast('已新增色阶「' + name + '」');
}

function variantUpdateCompare(t, pane){
  const st = variantState(t);
  const asset = st.assets.find(a => a.id === st.activeAsset) || variantSelectedAssets(t)[0];
  const ramp = variantRamp(st.activeRamp);
  const before = pane.querySelector('#varCmpBefore');
  const after = pane.querySelector('#varCmpAfter');
  const label = pane.querySelector('#varCmpLabel');
  if(!asset || !ramp || !before || !after) return;
  if(label) label.textContent = asset.cardName + ' · ' + ramp.name;
  variantLoadImage(st, asset).then(im => variantDrawPreview(before, im))
    .catch(() => {});
  variantRender(asset, ramp, st.opts, st).then(cv => variantDrawPreview(after, cv))
    .catch(() => {});
}

function variantScheduleMatrix(t, pane){
  const st = variantState(t);
  clearTimeout(st.timer);
  st.timer = setTimeout(() => variantRenderMatrix(t, pane), 220);
}
async function variantRenderMatrix(t, pane){
  const st = variantState(t);
  const token = ++st.token;
  const assets = variantSelectedAssets(t);
  const ramps = variantSelectedRamps(t);
  const box = pane.querySelector('#varMatrix');
  const progress = pane.querySelector('#varProgress');
  const hint = pane.querySelector('#varMatrixHint');
  if(!box) return;
  if(!assets.length || !ramps.length){
    box.innerHTML = '<div class="var-empty-small">在左侧至少勾选一张母版和一个材质色阶</div>';
    if(progress) progress.textContent = '';
    if(hint) hint.textContent = '选择母版和色阶后自动生成';
    return;
  }
  if(hint) hint.textContent = assets.length + ' 张母版 × ' + ramps.length + ' 个色阶';
  box.innerHTML = assets.map(a => `
    <div class="var-row" data-var-row="${esc(a.id)}">
      <button type="button" class="var-row-head" data-var-active-asset="${esc(a.id)}">
        <span class="var-row-thumb"><img src="${a.data}" alt="" loading="lazy"></span>
        <span><b>${esc(a.cardName)}</b><span>${esc(a.label || a.slot)}</span></span>
      </button>
      <div class="var-cells">
        ${ramps.map(r => {
          const key = a.id + '::' + r.id;
          const on = st.cellOn.get(key) !== false;
          return `<button type="button" class="var-cell${on ? '' : ' off'}" data-var-cell="${esc(key)}" title="${esc(r.name)}">
            <canvas width="72" height="72" data-var-canvas="${esc(key)}"></canvas>
            <span>${esc(r.name)}</span>
          </button>`;
        }).join('')}
      </div>
    </div>`).join('');
  if(progress) progress.textContent = '正在生成 0 / ' + (assets.length * ramps.length);
  let done = 0;
  for(const a of assets){
    for(const r of ramps){
      if(token !== st.token) return;
      try{
        const cv = await variantRender(a, r, st.opts, st);
        const cvEl = box.querySelector('[data-var-canvas="' + cssEscape(a.id + '::' + r.id) + '"]');
        if(cvEl) variantDrawPreview(cvEl, cv);
      }catch(_){}
      done++;
      if(done % 3 === 0 && progress) progress.textContent = '正在生成 ' + done + ' / ' + (assets.length * ramps.length);
      if(done % 2 === 0) await new Promise(r => requestAnimationFrame(r));
    }
  }
  if(token === st.token && progress) progress.textContent = '已生成 ' + done + ' 个变种';
}
function cssEscape(s){ return String(s).replace(/["\\]/g, '\\$&'); }

/* ---------------- 导出 / 保存 ---------------- */
function variantCellItems(t){
  const st = variantState(t);
  const assets = variantSelectedAssets(t);
  const ramps = variantSelectedRamps(t);
  const out = [];
  assets.forEach(a => ramps.forEach(r => {
    if(st.cellOn.get(a.id + '::' + r.id) !== false) out.push({ asset:a, ramp:r });
  }));
  return out;
}
function variantFileName(asset, ramp, pattern){
  let name = String(pattern || '{name}_{ramp}')
    .replace(/\{name\}/g, variantAssetBase(asset))
    .replace(/\{rampName\}/g, PWArchive.slug(ramp.name, ramp.id))
    .replace(/\{ramp\}/g, ramp.id);
  name = PWArchive.safeName(name, 'variant').replace(/\s+/g, '_').replace(/\.png$/i, '');
  return name + '.png';
}
async function variantExport(t, pane){
  const st = variantState(t);
  if(st.busy) return;
  const items = variantCellItems(t);
  if(!items.length){ toast('矩阵里还没有要导出的变种'); return; }
  st.busy = true;
  const btn = pane.querySelector('#varExport');
  const saveBtn = pane.querySelector('#varSave');
  const progress = pane.querySelector('#varProgress');
  if(btn){ btn.disabled = true; btn.textContent = '打包中…'; }
  if(saveBtn) saveBtn.disabled = true;
  try{
    const files = [];
    const used = new Set();
    const manifest = [];
    let i = 0;
    for(const item of items){
      const cv = await variantRender(item.asset, item.ramp, st.opts, st);
      const raw = variantFileName(item.asset, item.ramp, st.opts.pattern);
      let name = raw;
      let n = 2;
      while(used.has(name.toLowerCase())){
        name = raw.replace(/\.png$/i, '_' + n + '.png');
        n++;
      }
      used.add(name.toLowerCase());
      const path = st.opts.output === 'folders' ? 'variants/' + item.ramp.id + '/' + name : name;
      const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
      if(blob) files.push({ name:path, data:new Uint8Array(await blob.arrayBuffer()) });
      manifest.push({
        source:item.asset.cardName, slot:item.asset.slot, sourceWorkspace:item.asset.wsName,
        ramp:item.ramp.id, rampName:item.ramp.name, colors:item.ramp.colors.slice(),
        file:path
      });
      i++;
      if(progress) progress.textContent = '正在打包 ' + i + ' / ' + items.length;
      if(i % 3 === 0) await new Promise(r => requestAnimationFrame(r));
    }
    files.push({ name:'variants.json', data:JSON.stringify({
      v:1, generatedAt:new Date().toISOString(), pattern:st.opts.pattern,
      options:st.opts, items:manifest
    }, null, 2) });
    const zip = PWArchive.create(files);
    PWArchive.download(zip, '变种纹理-' + new Date().toISOString().slice(0,10) + '.zip');
    toast('已导出 ' + items.length + ' 张变种 + variants.json');
    if(progress) progress.textContent = '已导出 ' + items.length + ' 张变种';
  }catch(err){
    console.error(err);
    toast('导出失败：' + (err.message || err));
  }finally{
    st.busy = false;
    if(btn){ btn.disabled = false; btn.textContent = '导出 ZIP'; }
    if(saveBtn) saveBtn.disabled = false;
  }
}
async function variantSaveToLibrary(t, pane){
  const st = variantState(t);
  if(st.busy) return;
  if(!currentWS()){ toast('先选一个工作区'); return; }
  const items = variantCellItems(t);
  if(!items.length){ toast('矩阵里还没有要保存的变种'); return; }
  st.busy = true;
  const btn = pane.querySelector('#varSave');
  const exp = pane.querySelector('#varExport');
  const progress = pane.querySelector('#varProgress');
  if(btn){ btn.disabled = true; btn.textContent = '保存中…'; }
  if(exp) exp.disabled = true;
  try{
    const ws = currentWS();
    let cat = ws.cats.find(c => c.name === '变种生成');
    if(!cat){ cat = { id:uidWs(), name:'变种生成', open:true, cards:[] }; ws.cats.unshift(cat); }
    let i = 0;
    for(const item of items){
      const cv = await variantRender(item.asset, item.ramp, st.opts, st);
      const name = variantFileName(item.asset, item.ramp, st.opts.pattern).replace(/\.png$/i, '');
      const full = variantFullData(cv);
      const thumb = variantThumb(cv);
      cat.cards.unshift({
        id:'v' + Date.now().toString(36) + Math.random().toString(36).slice(2,5),
        name,
        meta:cv.width + '×' + cv.height + ' · ' + item.ramp.name + ' · 变种',
        badge:'变种',
        type:'item',
        thumb, full,
        variant:{ source:item.asset.cardId, slot:item.asset.slot, ramp:item.ramp.id, colors:item.ramp.colors.slice() }
      });
      i++;
      if(progress) progress.textContent = '正在保存 ' + i + ' / ' + items.length;
      if(i % 3 === 0) await new Promise(r => requestAnimationFrame(r));
    }
    saveData(); renderWorkspaces();
    if($('#catList')) refreshList();
    renderStatus();
    toast('已保存 ' + items.length + ' 个变种到「变种生成」');
    if(progress) progress.textContent = '已保存 ' + items.length + ' 个变种到仓库';
  }catch(err){
    console.error(err);
    toast('保存失败：' + (err.message || err));
  }finally{
    st.busy = false;
    if(btn){ btn.disabled = false; btn.textContent = '保存到仓库'; }
    if(exp) exp.disabled = false;
  }
}

/* ---------------- 绑定 ---------------- */
function variantBind(t, pane){
  const q = s => pane.querySelector(s);
  const st = variantState(t);
  const on = (el, ev, fn) => { if(el) el.addEventListener(ev, fn); };

  on(q('#varRefresh'), 'click', () => { variantRefreshAssets(t, pane, true); toast('已刷新仓库纹理'); });
  on(q('#varExport'), 'click', () => variantExport(t, pane));
  on(q('#varSave'), 'click', () => variantSaveToLibrary(t, pane));
  on(q('#varEmptyGo'), 'click', goHome);
  on(q('#varSearch'), 'input', () => variantRenderSources(t, pane));
  on(q('#varSrcAll'), 'click', () => {
    st.assets.slice(0, VARIANT_MAX_SOURCES).forEach(a => st.sources.add(a.id));
    variantRenderSources(t, pane); variantScheduleMatrix(t, pane);
  });
  on(q('#varSrcClear'), 'click', () => {
    st.sources.clear(); variantRenderSources(t, pane); variantScheduleMatrix(t, pane);
  });
  on(q('#varSources'), 'change', e => {
    const cb = e.target.closest('[data-var-src]');
    if(!cb) return;
    const id = cb.dataset.varSrc;
    if(cb.checked){
      if(st.sources.size >= VARIANT_MAX_SOURCES){ cb.checked = false; toast('一次最多处理 ' + VARIANT_MAX_SOURCES + ' 张母版'); return; }
      st.sources.add(id);
    }else st.sources.delete(id);
    const row = cb.closest('.var-src'); if(row) row.classList.toggle('on', cb.checked);
    const count = q('#varSrcCount'); if(count) count.textContent = st.sources.size + '/' + st.assets.length;
    variantScheduleMatrix(t, pane);
  });
  on(q('#varSources'), 'click', e => {
    const row = e.target.closest('.var-src');
    if(!row || e.target.closest('input')) return;
    const id = row.querySelector('[data-var-src]')?.dataset.varSrc;
    if(id){ st.activeAsset = id; variantUpdateCompare(t, pane); }
  });
  on(q('#varRamps'), 'change', e => {
    const cb = e.target.closest('[data-var-ramp-toggle]');
    if(!cb) return;
    if(cb.checked) st.rampOn.add(cb.dataset.varRampToggle);
    else st.rampOn.delete(cb.dataset.varRampToggle);
    const count = q('#varRampCount'); if(count) count.textContent = st.rampOn.size + '/' + variantRamps().length;
    variantScheduleMatrix(t, pane);
  });
  on(q('#varRamps'), 'click', e => {
    const del = e.target.closest('[data-var-ramp-del]');
    if(del){ e.stopPropagation(); return; }
    const b = e.target.closest('[data-var-ramp-edit]');
    if(b){ st.activeRamp = b.dataset.varRampEdit; variantRenderRamps(t, pane); variantRenderEditor(t, pane); variantUpdateCompare(t, pane); }
  });
  on(q('#varMatrix'), 'click', e => {
    const cell = e.target.closest('[data-var-cell]');
    if(cell){
      const key = cell.dataset.varCell;
      const off = st.cellOn.get(key) === false;
      st.cellOn.set(key, off);
      cell.classList.toggle('off', !off);
      return;
    }
    const head = e.target.closest('[data-var-active-asset]');
    if(head){ st.activeAsset = head.dataset.varActiveAsset; variantUpdateCompare(t, pane); }
  });

  /* options */
  const bindCheck = (sel, key) => {
    const el = q(sel); if(!el) return;
    el.checked = !!st.opts[key];
    el.addEventListener('change', () => {
      st.opts[key] = el.checked; variantSaveOptions(st.opts);
      variantUpdateCompare(t, pane); variantScheduleMatrix(t, pane);
    });
  };
  bindCheck('#varAutoStretch','autoStretch');
  bindCheck('#varProtectEdge','protectEdge');
  bindCheck('#varPreserveBlack','preserveBlack');
  bindCheck('#varInvert','invert');
  const bindRange = (sel, out, key) => {
    const el = q(sel), o = q(out); if(!el) return;
    el.value = st.opts[key];
    if(o) o.textContent = (+st.opts[key]).toFixed(2);
    el.addEventListener('input', () => {
      st.opts[key] = +el.value;
      if(o) o.textContent = (+el.value).toFixed(2);
      variantSaveOptions(st.opts); variantUpdateCompare(t, pane); variantScheduleMatrix(t, pane);
    });
  };
  bindRange('#varContrast','#varContrastV','contrast');
  bindRange('#varGamma','#varGammaV','gamma');
  const pat = q('#varPattern');
  if(pat){ pat.value = st.opts.pattern; pat.addEventListener('input', () => { st.opts.pattern = pat.value || '{name}_{ramp}'; variantSaveOptions(st.opts); }); }
  const out = q('#varOutput');
  if(out){ out.value = st.opts.output; out.addEventListener('change', () => { st.opts.output = out.value; variantSaveOptions(st.opts); }); }

  /* 点击色阶的删除按钮 */
  on(q('#varRamps'), 'click', e => {
    const del = e.target.closest('[data-var-ramp-del]');
    if(!del) return;
    const id = del.dataset.varRampDel;
    VARIANT_CUSTOMS = VARIANT_CUSTOMS.filter(x => x.id !== id);
    variantSaveCustoms(VARIANT_CUSTOMS);
    st.rampOn.delete(id);
    if(st.activeRamp === id) st.activeRamp = (variantRamps()[0] || {}).id || null;
    variantRenderRamps(t, pane); variantRenderEditor(t, pane); variantScheduleMatrix(t, pane);
    toast('已删除自定义色阶');
  });
}

function mountVariantLab(t, host){
  const pane = document.createElement('div');
  pane.className = 'ed-pane variant-pane on';
  pane.dataset.tab = t.id;
  pane.innerHTML = variantPageHTML();
  host.appendChild(pane);
  t._pane = pane;
  variantBind(t, pane);
  variantRefreshAssets(t, pane, false);
}
