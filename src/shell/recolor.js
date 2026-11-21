/* ============================================================
   一键换色
   移植自 Blockbench 插件 color_replacer 1.2.0（精确换色 / 聚类换色）
   Clastar 版改造：
   - 菜鸟化：三步流程、自动配色、按明暗套用色卡、实时预览
   - 现代化：Ore UI 深色布局、并排预览、逐行取色、撤销、导出 PNG
   ============================================================ */

const RECOLOR_PREFS_KEY = 'pixelWorkshop_recolor_v1';
const RECOLOR_BASE_PALETTE = [
  '#ffffff','#c0cbdc','#8b9bb4','#5a6988','#3a4466','#262b44','#1a1c2c','#000000',
  '#ffcd75','#ef7d57','#b13e53','#5d275d','#38b764','#257179','#41a6f6','#73eff7',
  '#a7f070','#3b5dc9','#ffd479','#e8a33d','#b86f2d','#8b4a2b','#94b0c2','#566c86'
];
/* Blockbench 内置默认色板（40 色）与 Endesga 64，适合像素纹理创作 */
const RECOLOR_BB_DEFAULT = [
  '#1a1a1b','#353637','#464849','#5d5f60','#757677','#868788','#979b9d','#b8bdbe','#dadedf','#ffffff',
  '#9a080f','#b40a1a','#d21129','#ef2142','#ff5774',
  '#bb7907','#cc9104','#edb508','#fcd720','#fef364',
  '#0d7e36','#12933d','#11aa38','#1cc93d','#29e64d',
  '#044b8f','#0955a8','#126bc3','#1782db','#339afc',
  '#cd3e00','#e65b00','#f37800','#f89520','#fdaf40',
  '#02a8c1','#0cc3ca','#17d1c7','#38debd','#5be9b7'
];
const RECOLOR_BB_ENDESGA = [
  '#ff0040','#131313','#1b1b1b','#272727','#3d3d3d','#5d5d5d','#858585','#b4b4b4','#ffffff',
  '#c7cfdd','#92a1b9','#657392','#424c6e','#2a2f4e','#1a1932','#0e071b',
  '#1c121c','#391f21','#5d2c28','#8a4836','#bf6f4a','#e69c69','#f6ca9f','#f9e6cf',
  '#edab50','#e07438','#c64524','#8e251d','#ff5000','#ed7614','#ffa214','#ffc825','#ffeb57',
  '#d3fc7e','#99e65f','#5ac54f','#33984b','#1e6f50','#134c4c','#0c2e44',
  '#00396d','#0069aa','#0098dc','#00cdf9','#0cf1ff','#94fdff',
  '#fdd2ed','#f389f5','#db3ffd','#7a09fa','#3003d9','#0c0293',
  '#03193f','#3b1443','#622461','#93388f','#ca52c9','#c85086',
  '#f68187','#f5555d','#ea323c','#c42430','#891e2b','#571c27'
];
const RECOLOR_PRESETS = [
  { id:'theme',   name:'主题单色', hint:'用当前主题色统一整张纹理，保留原来的明暗。' },
  { id:'lighten', name:'提亮',     hint:'整体变亮，适合做高光或浅色版本。' },
  { id:'darken',  name:'压暗',     hint:'整体变暗，适合做阴影或深色版本。' },
  { id:'swap',    name:'冷暖反转', hint:'色相旋转 180°，暖色变冷、冷色变暖。' },
  { id:'gray',    name:'灰阶',     hint:'去掉颜色，保留明暗，适合做灰模。' },
  { id:'random',  name:'随机配色', hint:'随机生成一组同明暗的彩色方案。' },
  { id:'invert',  name:'反相',     hint:'RGB 取反，快速得到负片效果。' }
];
const RECOLOR_ROLE_NAMES = ['独立 / 四边','左右连接','上下连接','内角 / 交叉','内部填充'];
const RECOLOR_ARMOR_NAMES = { layer1:'层 1 · 头盔 / 胸甲 / 靴子', layer2:'层 2 · 护腿' };
const RECOLOR_SLOT_NAMES = {
  all:'全部六面', north:'北面', south:'南面', east:'东面', west:'西面', up:'顶面', down:'底面',
  top:'顶面', side:'侧面', bottom:'底面', cross:'交叉平面', crop:'作物', plant:'植物',
  particle:'粒子', texture:'纹理'
};
let recolorRandomSeed = 0x51ed270b;
const RECOLOR_WRITE_SEQ = new WeakMap();

function recolorBeginWrite(card){
  const n = (RECOLOR_WRITE_SEQ.get(card) || 0) + 1;
  RECOLOR_WRITE_SEQ.set(card, n);
  return n;
}
function recolorIsCurrentWrite(card, seq){
  return RECOLOR_WRITE_SEQ.get(card) === seq;
}

function recolorLoadPrefs(){
  const defaults = { preset:'theme', mode:'exact', tolerance:5, clusterCount:6, viewMode:'side' };
  try{
    const saved = JSON.parse(localStorage.getItem(RECOLOR_PREFS_KEY) || 'null');
    if(!saved || typeof saved !== 'object') return defaults;
    return {
      preset: RECOLOR_PRESETS.some(p => p.id === saved.preset) ? saved.preset : defaults.preset,
      mode: saved.mode === 'cluster' ? 'cluster' : 'exact',
      tolerance: Math.max(0, Math.min(50, +saved.tolerance || defaults.tolerance)),
      clusterCount: Math.max(2, Math.min(16, +saved.clusterCount || defaults.clusterCount)),
      viewMode: ['side','after','before'].includes(saved.viewMode) ? saved.viewMode : defaults.viewMode
    };
  }catch(e){ return defaults; }
}
function recolorSavePrefs(patch){
  try{
    const now = Object.assign(recolorLoadPrefs(), patch || {});
    localStorage.setItem(RECOLOR_PREFS_KEY, JSON.stringify(now));
  }catch(e){}
}

/* ---------------- 颜色工具 ---------------- */
function recolorHexToRgb(hex){
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  return m ? { r:parseInt(m[1],16), g:parseInt(m[2],16), b:parseInt(m[3],16) } : null;
}
function recolorRgbToHex(r,g,b){
  return '#' + [r,g,b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2,'0')).join('');
}
function recolorRgbToHsl(r,g,b){
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = 0;
  if(d){
    if(max === r) h = ((g - b) / d) % 6;
    else if(max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if(h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}
function recolorHslToRgb(h,s,l){
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if(h < 60){ r = c; g = x; }
  else if(h < 120){ r = x; g = c; }
  else if(h < 180){ g = c; b = x; }
  else if(h < 240){ g = x; b = c; }
  else if(h < 300){ r = x; b = c; }
  else { r = c; b = x; }
  return [ (r + m) * 255, (g + m) * 255, (b + m) * 255 ];
}
function recolorHslToHex(h,s,l){ return recolorRgbToHex(...recolorHslToRgb(h,s,l)); }
function recolorLum(rgb){ return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b; }
function recolorDist2(a,b){
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}
function recolorDist(a,b){ return Math.sqrt(recolorDist2(a,b)); }
function recolorAccentHex(){
  try{
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    return recolorHexToRgb(v) ? v : '#4c9a2a';
  }catch(e){ return '#4c9a2a'; }
}
function recolorTextColor(hex){
  const rgb = recolorHexToRgb(hex);
  return rgb && recolorLum(rgb) > 145 ? '#1b1b1b' : '#ffffff';
}

/* ---------------- 色卡 ---------------- */
function recolorBuiltinPalettes(){
  const rainbow = [];
  for(let i=0;i<12;i++){
    rainbow.push(recolorHslToHex(i * 30, .78, .62));
  }
  const list = [
    { id:'__bb_default__', group:'Blockbench', name:'默认 40', colors:RECOLOR_BB_DEFAULT.slice() },
    { id:'__bb_endesga__', group:'Blockbench', name:'Endesga 64', colors:RECOLOR_BB_ENDESGA.slice() },
    { id:'__bb_gray__', group:'Blockbench', name:'灰阶 10', colors:RECOLOR_BB_DEFAULT.slice(0,10) },
    { id:'__classic__', group:'经典', name:'基础 24', colors:RECOLOR_BASE_PALETTE.slice() },
    { id:'__classic_gray__', group:'经典', name:'灰阶 8', colors:['#ffffff','#c0cbdc','#8b9bb4','#5a6988','#3a4466','#262b44','#1a1c2c','#000000'] },
    { id:'__rainbow__', group:'经典', name:'彩虹 12', colors:rainbow },
    { id:'__metal__', group:'经典', name:'金属 6', colors:['#fbe6a2','#e8c46a','#c9a24a','#a07d33','#75591f','#4a3812'] }
  ];
  /* 变种工坊的材质色阶直接作为一键换色的色卡 */
  if(typeof variantRamps === 'function'){
    try{
      variantRamps().forEach(r => list.push({
        id:'__ramp_' + r.id, group:'材质色阶', name:r.name,
        colors:(r.colors || []).slice()
      }));
    }catch(_){}
  }
  return list.filter(p => p.colors.length);
}
function recolorLegacyDefaultColors(name){
  const sets = {
    '基础 24': RECOLOR_BASE_PALETTE,
    '灰阶 8': ['#ffffff','#c0cbdc','#8b9bb4','#5a6988','#3a4466','#262b44','#1a1c2c','#000000'],
    '彩虹 12': Array.from({length:12}, (_,i) => recolorHslToHex(i * 30, .78, .62)),
    '金属 6': ['#fbe6a2','#e8c46a','#c9a24a','#a07d33','#75591f','#4a3812']
  };
  return sets[name] || null;
}
function recolorIsLegacyDefaultPalette(p){
  if(!p || p.group !== '原版') return false;
  const sig = recolorLegacyDefaultColors(p.name);
  if(!sig) return false;
  const a = (p.colors || []).map(x => String(x).toLowerCase());
  const b = sig.map(x => String(x).toLowerCase());
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
function recolorPaletteState(){
  const builtins = recolorBuiltinPalettes();
  const list = builtins.slice();
  const seen = new Set(list.map(p => p.group + '/' + p.name));
  let active = '__bb_default__';
  try{
    const saved = JSON.parse(localStorage.getItem('animStudioPalettes_v1') || 'null');
    if(saved && Array.isArray(saved.list) && saved.list.length){
      const legacy = saved.v !== 2;
      saved.list.map(p => ({
        id:p.id || ('pal' + Math.random().toString(36).slice(2,8)),
        group:p.group || '未分类',
        name:p.name || '色卡',
        colors:(Array.isArray(p.colors) ? p.colors : []).filter(h => recolorHexToRgb(h)).slice()
      })).filter(p => p.colors.length).forEach(p => {
        /* 旧版「原版」默认色卡由新内置色板替代；玩家改过色的仍保留 */
        if(legacy && recolorIsLegacyDefaultPalette(p)) return;
        const key = p.group + '/' + p.name;
        if(seen.has(key)) return;
        seen.add(key);
        list.push(p);
      });
      const activeObj = saved.active && list.find(p => p.id === saved.active);
      if(activeObj && (!legacy || !['原版','经典','Blockbench'].includes(activeObj.group))){
        active = activeObj.id;
      }else if(saved.active){
        const savedPal = saved.list.find(p => p && p.id === saved.active);
        if(savedPal){
          const same = list.find(p => p.group === (savedPal.group || '未分类') && p.name === (savedPal.name || '色卡'));
          if(same && (!legacy || !['原版','经典','Blockbench'].includes(same.group))) active = same.id;
        }
      }
    }
  }catch(e){}
  return { list, active:list.some(p => p.id === active) ? active : (list[0] && list[0].id) };
}
function recolorRecentColors(){
  try{
    const arr = JSON.parse(localStorage.getItem('pixelWorkshop_recentColors_v1') || '[]');
    return Array.isArray(arr) ? arr.filter(h => recolorHexToRgb(h)).slice(0,12) : [];
  }catch(e){ return []; }
}

/* ---------------- 纹理资产 ---------------- */
function recolorCardAssets(card, ws){
  const list = [];
  if(!card || card.type === 'folder') return list;
  const add = (slot, label, data, kind) => {
    if(typeof data !== 'string' || !data.startsWith('data:image')) return;
    list.push({
      id: card.id + '::' + slot,
      cardId: card.id,
      wsId: ws ? ws.id : null,
      wsName: ws ? ws.name : '',
      cardName: card.name || '未命名',
      slot,
      kind,
      label,
      data
    });
  };
  if(card.full){
    add('full', card.anim ? '主纹理 · 动画条带' : card.ctex ? '主纹理 · 自定义纹理' : '主纹理', card.full, 'full');
  }
  if(card.block && card.block.textures && typeof card.block.textures === 'object'){
    Object.keys(card.block.textures).forEach(key => {
      add('block:' + key, '方块材质 · ' + (RECOLOR_SLOT_NAMES[key] || key), card.block.textures[key], 'block');
    });
  }
  if(card.composite && Array.isArray(card.composite.sources)){
    card.composite.sources.forEach((data, i) => {
      add('composite:' + i, '连接纹理 ' + (i + 1) + ' · ' + (RECOLOR_ROLE_NAMES[i] || '来源'), data, 'composite');
    });
  }
  if(card.armor && card.armor.textures && typeof card.armor.textures === 'object'){
    Object.keys(card.armor.textures).forEach(key => {
      add('armor:' + key, '盔甲 · ' + (RECOLOR_ARMOR_NAMES[key] || key), card.armor.textures[key], 'armor');
    });
  }
  return list;
}
function recolorWalkCards(fn){
  WS.forEach(ws => ws.cats.forEach(cat => {
    const walk = cards => cards.forEach(card => {
      fn(card, ws, cat);
      if(card.type === 'folder' && Array.isArray(card.cards)) walk(card.cards);
    });
    walk(cat.cards);
  }));
}
function recolorAllAssets(){
  const list = [];
  recolorWalkCards((card, ws, cat) => {
    recolorCardAssets(card, ws).forEach(asset => {
      asset.catId = cat.id;
      list.push(asset);
    });
  });
  return list.sort((a,b) =>
    String(a.wsName).localeCompare(String(b.wsName),'zh') ||
    String(a.cardName).localeCompare(String(b.cardName),'zh') ||
    a.slot.localeCompare(b.slot)
  );
}
function recolorAssetById(id){
  return recolorAllAssets().find(asset => asset.id === id) || null;
}
function recolorCardHasAssets(card){
  return recolorCardAssets(card, null).length > 0;
}

/* ---------------- 自动配色 ---------------- */
function recolorPresetTargets(colors, presetId, paletteColors){
  const accent = recolorHexToRgb(recolorAccentHex()) || { r:76, g:154, b:42 };
  const accentHsl = recolorRgbToHsl(accent.r, accent.g, accent.b);
  const pal = (paletteColors || []).map(recolorHexToRgb).filter(Boolean)
    .sort((a,b) => recolorLum(a) - recolorLum(b));
  const seedStart = recolorRandomSeed;
  return colors.map((color, i) => {
    const rgb = recolorHexToRgb(color.hex) || { r:128, g:128, b:128 };
    const hsl = recolorRgbToHsl(rgb.r, rgb.g, rgb.b);
    if(presetId === 'lighten') return recolorHslToHex(hsl.h, hsl.s, Math.min(.96, hsl.l + .14));
    if(presetId === 'darken') return recolorHslToHex(hsl.h, hsl.s, Math.max(.04, hsl.l - .14));
    if(presetId === 'swap') return recolorHslToHex(hsl.h + 180, hsl.s, hsl.l);
    if(presetId === 'gray') return recolorHslToHex(0, 0, hsl.l);
    if(presetId === 'invert') return recolorRgbToHex(255 - rgb.r, 255 - rgb.g, 255 - rgb.b);
    if(presetId === 'random'){
      let seed = (seedStart + i * 2654435761) >>> 0;
      const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
      return recolorHslToHex(rand() * 360, .42 + rand() * .36, Math.max(.18, Math.min(.86, hsl.l)));
    }
    if(presetId === 'palette' && pal.length){
      const idx = pal.length === 1 ? 0 : Math.round(i * (pal.length - 1) / Math.max(1, colors.length - 1));
      return recolorRgbToHex(pal[idx].r, pal[idx].g, pal[idx].b);
    }
    /* 默认主题单色：换色相，保留明暗；低饱和颜色也会明显变色 */
    return recolorHslToHex(
      accentHsl.h,
      Math.max(.3, Math.min(.78, accentHsl.s || .55)),
      Math.max(.1, Math.min(.92, hsl.l))
    );
  });
}

/* ---------------- 颜色提取（精确） ---------------- */
function recolorExtractExact(imageData){
  const data = imageData.data;
  const counts = new Map();
  let opaque = 0;
  for(let i=0;i<data.length;i+=4){
    if(data[i+3] < 128) continue;
    opaque++;
    const hex = recolorRgbToHex(data[i], data[i+1], data[i+2]);
    counts.set(hex, (counts.get(hex) || 0) + 1);
  }
  const groups = { gray:[], red:[], orange:[], yellow:[], green:[], blue:[], magenta:[] };
  counts.forEach((count, hex) => {
    const rgb = recolorHexToRgb(hex);
    const diff = Math.abs(rgb.r - rgb.g) + Math.abs(rgb.g - rgb.b) + Math.abs(rgb.r - rgb.b);
    if(diff < 74){ groups.gray.push(hex); return; }
    const distances = {
      red:     recolorDist(rgb, {r:250,g:0,b:0}),
      orange:  recolorDist(rgb, {r:240,g:127,b:0}) * 1.4,
      yellow:  recolorDist(rgb, {r:249,g:240,b:0}) * 1.4,
      green:   recolorDist(rgb, {r:0,g:255,b:0}),
      blue:    recolorDist(rgb, {r:0,g:50,b:240}),
      magenta: recolorDist(rgb, {r:255,g:0,b:255}) * 1.4
    };
    const closest = Object.keys(distances).reduce((a,b) => distances[a] < distances[b] ? a : b);
    groups[closest].push(hex);
  });
  const sorted = [];
  ['gray','red','orange','yellow','green','blue','magenta'].forEach(key => {
    groups[key].sort((a,b) => {
      const ra = recolorHexToRgb(a), rb = recolorHexToRgb(b);
      return recolorLum(ra) - recolorLum(rb);
    });
    sorted.push(...groups[key]);
  });
  const max = 30;
  return {
    colors: sorted.slice(0, max).map(hex => ({
      hex,
      count: counts.get(hex),
      share: opaque ? counts.get(hex) / opaque : 0
    })),
    unique: counts.size,
    opaque,
    truncated: sorted.length > max
  };
}

/* ---------------- 颜色提取（聚类） ---------------- */
function recolorKMeans(pixels, k, maxIterations){
  if(pixels.length <= k) return pixels.map(p => [p]);
  let seed = 0x9e3779b9;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0, seed / 4294967296);
  const centers = [];
  const used = new Set();
  while(centers.length < k){
    let idx = Math.floor(rnd() * pixels.length);
    if(used.has(idx)) continue;
    used.add(idx);
    centers.push(pixels[idx].slice());
  }
  const assignment = new Array(pixels.length).fill(0);
  for(let iter=0; iter<maxIterations; iter++){
    let changed = false;
    for(let i=0;i<pixels.length;i++){
      let best = 0, bestD = Infinity;
      for(let j=0;j<centers.length;j++){
        const dr = pixels[i][0] - centers[j][0];
        const dg = pixels[i][1] - centers[j][1];
        const db = pixels[i][2] - centers[j][2];
        const d = dr*dr + dg*dg + db*db;
        if(d < bestD){ bestD = d; best = j; }
      }
      if(assignment[i] !== best){ assignment[i] = best; changed = true; }
    }
    if(!changed) break;
    const sums = Array.from({length:k}, () => [0,0,0,0]);
    for(let i=0;i<pixels.length;i++){
      const c = assignment[i], p = pixels[i], s = sums[c];
      s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    }
    for(let j=0;j<k;j++){
      if(sums[j][3]) centers[j] = [sums[j][0]/sums[j][3], sums[j][1]/sums[j][3], sums[j][2]/sums[j][3]];
    }
  }
  const clusters = Array.from({length:k}, () => []);
  for(let i=0;i<pixels.length;i++) clusters[assignment[i]].push(pixels[i]);
  return clusters.filter(c => c.length);
}
function recolorExtractClusters(imageData, count){
  const data = imageData.data, w = imageData.width, h = imageData.height;
  const step = (w * h > 100000) ? 2 : 1;
  const pixels = [];
  for(let y=0;y<h;y+=step){
    for(let x=0;x<w;x+=step){
      const i = (y * w + x) * 4;
      if(data[i+3] >= 128) pixels.push([data[i], data[i+1], data[i+2]]);
    }
  }
  if(!pixels.length) return { colors:[], unique:0, opaque:0, truncated:false };
  const clusters = recolorKMeans(pixels, Math.max(2, Math.min(16, count)), 20);
  const total = pixels.length;
  const colors = clusters.map(pixelsInCluster => {
    let r = 0, g = 0, b = 0;
    pixelsInCluster.forEach(p => { r += p[0]; g += p[1]; b += p[2]; });
    r /= pixelsInCluster.length; g /= pixelsInCluster.length; b /= pixelsInCluster.length;
    return {
      hex: recolorRgbToHex(r,g,b),
      count: pixelsInCluster.length,
      share: pixelsInCluster.length / total
    };
  });
  colors.sort((a,b) => recolorLum(recolorHexToRgb(a.hex)) - recolorLum(recolorHexToRgb(b.hex)));
  return { colors, unique: colors.length, opaque: total, truncated:false };
}
function recolorExtract(imageData, mode, clusterCount){
  return mode === 'cluster' ? recolorExtractClusters(imageData, clusterCount) : recolorExtractExact(imageData);
}

/* ---------------- 页面 ---------------- */
function recolorPageHTML(){
  return `
  <div class="recolor-page">
    <div class="content-head rec-head">
      <div class="crumbs"><b>一键换色</b><span>三步完成 · 改完还能撤销</span></div>
      <div class="tools">
        <button class="btn sm" id="recUndo" disabled>撤销上次应用</button>
        <button class="btn pri" id="recApplyTop" disabled>应用并保存</button>
      </div>
    </div>
    <div class="scroll rec-scroll">
      <div class="rec-steps">
        <div class="rec-step on"><i>1</i><b>选纹理</b><span>自动读取全部颜色</span></div>
        <div class="rec-step on"><i>2</i><b>选配色</b><span>点预设就行，也能逐色微调</span></div>
        <div class="rec-step on"><i>3</i><b>保存</b><span>写入仓库，可撤销</span></div>
      </div>

      <div id="recEmpty" class="rec-empty" hidden>
        <div class="rec-empty-ico">${iconSVG('palette', 34)}</div>
        <b>还没有可换色的纹理</b>
        <p>先在内容库里新建一张纹理，或把 PNG 拖进窗口。已经有纹理时点“刷新”重新读取。</p>
        <button class="btn pri" id="recEmptyGo">去内容库</button>
      </div>

      <div id="recMain">
        <div class="rec-source-bar">
          <label for="recAsset">纹理来源</label>
          <select id="recAsset" class="rec-select"></select>
          <button class="btn sm" id="recRefresh">刷新</button>
          <span id="recSourceInfo" class="rec-muted"></span>
        </div>

        <div class="rec-grid">
          <section class="rec-panel rec-preview-panel">
            <div class="rec-panel-head">
              <h3>实时预览</h3>
              <div class="rec-seg" id="recViewSeg">
                <button type="button" data-rec-view="side" class="on">并排</button>
                <button type="button" data-rec-view="after">结果</button>
                <button type="button" data-rec-view="before">原图</button>
              </div>
            </div>
            <div class="rec-canvas-row" id="recCanvasRow" data-view="side">
              <figure data-view="before">
                <figcaption>原图</figcaption>
                <div class="rec-canvas-box"><canvas id="recBefore"></canvas></div>
              </figure>
              <figure data-view="after">
                <figcaption>换色后</figcaption>
                <div class="rec-canvas-box"><canvas id="recAfter"></canvas></div>
              </figure>
            </div>
            <div class="rec-statline">
              <span id="recStats">等待纹理…</span>
              <button type="button" class="btn sm rec-warn-btn" id="recUseCluster" hidden>颜色很多，改用合并相近色</button>
              <span id="recWarn" class="rec-warn"></span>
            </div>
            <div class="rec-preview-foot">
              <button class="btn sm" id="recExport" disabled>导出 PNG</button>
              <button class="btn sm" id="recClearTargets">清空目标色</button>
              <span>透明像素不会改变</span>
            </div>
          </section>

          <section class="rec-panel rec-settings-panel">
            <div class="rec-block">
              <div class="rec-block-head">
                <h3><i>2</i> 先自动配色</h3>
                <span>点一个预设，整张图立刻变</span>
              </div>
              <div class="rec-presets" id="recPresets">
                ${RECOLOR_PRESETS.map(p => `<button type="button" class="rec-preset${p.id==='theme'?' on':''}" data-preset="${p.id}" title="${esc(p.hint)}">${esc(p.name)}</button>`).join('')}
              </div>
              <div class="rec-auto-row">
                <button type="button" class="btn pri" id="recAuto">一键自动配色</button>
                <span id="recPresetHint" class="rec-muted"></span>
              </div>
            </div>

            <div class="rec-block">
              <div class="rec-block-head">
                <h3>颜色对应 <span id="recColorCount" class="rec-count"></span></h3>
                <span>点目标色打开取色器 · 可吸管 / 微调 · 只换几个先清空</span>
              </div>
              <div class="rec-rows" id="recRows"></div>
            </div>

            <div class="rec-block">
              <div class="rec-block-head">
                <h3>色卡</h3>
                <select id="recPalette" class="rec-select rec-select-sm"></select>
              </div>
              <div class="rec-swatches" id="recPaletteSwatches"></div>
              <div class="rec-swatch-actions">
                <button type="button" class="btn sm" id="recPaletteFill">按明暗套用整张色卡</button>
                <span class="rec-muted">点色块填入当前行</span>
              </div>
              <div class="rec-recent-wrap">
                <span class="rec-recent-label">最近颜色</span>
                <div class="rec-swatches rec-recent" id="recRecent"></div>
              </div>
            </div>

            <details class="rec-advanced">
              <summary>高级设置 <span>容差 / 合并相近色</span></summary>
              <div class="rec-advanced-body">
                <div class="rec-advanced-row">
                  <span>处理方式</span>
                  <div class="rec-seg" id="recModeSeg">
                    <button type="button" data-rec-mode="exact" class="on">逐个颜色</button>
                    <button type="button" data-rec-mode="cluster">合并相近色</button>
                  </div>
                </div>
                <div class="rec-range-row" id="recToleranceRow">
                  <label for="recTolerance">匹配容差</label>
                  <input type="range" id="recTolerance" min="0" max="50" step="1" value="5">
                  <output id="recToleranceVal">5</output>
                  <span class="hq" data-help="容差越大，越容易把相近颜色一起换掉。新手建议 3–8；做了渐变或抗锯齿的纹理可以调高。">?</span>
                </div>
                <div class="rec-range-row" id="recClusterRow" hidden>
                  <label for="recClusterCount">合并数量</label>
                  <input type="range" id="recClusterCount" min="2" max="16" step="1" value="6">
                  <output id="recClusterCountVal">6</output>
                  <span class="hq" data-help="把相近颜色合并成 2–16 个主色，适合颜色很多、想做整体换色的纹理。切换后会自动重新配色。">?</span>
                </div>
                <p class="rec-note" id="recTruncateNote"></p>
              </div>
            </details>
            <p class="rec-credit">换色算法来源：Blockbench 一键换色插件 · Lying_ice</p>
          </section>
        </div>

        <div class="rec-applybar">
          <div class="rec-apply-copy">
            <b><i>3</i> 应用并保存</b>
            <span id="recApplyHint">调整目标色后，这里会显示将要替换的像素数。</span>
          </div>
          <button class="btn pri rec-apply-big" id="recApplyBottom" disabled>应用并保存</button>
        </div>
      </div>
    </div>
  </div>`;
}

function recolorState(t){
  if(t._recolor) return t._recolor;
  const prefs = recolorLoadPrefs();
  const pal = recolorPaletteState();
  t._recolor = Object.assign({}, prefs, {
    assetId: t.payload && t.payload.assetId || null,
    assets: [],
    asset: null,
    image: null,
    imageData: null,
    width: 0,
    height: 0,
    colors: [],
    mapping: [],
    selected: -1,
    unique: 0,
    opaque: 0,
    truncated: false,
    changed: 0,
    result: null,
    palettes: pal.list,
    paletteId: pal.active,
    lastApply: null,
    loadSeq: 0
  });
  return t._recolor;
}

function recolorMarkDirty(t){
  try{ markDirty(t); }catch(e){}
}
function recolorClearDirty(t){
  try{ clearDirty(t); }catch(e){}
}

function mountRecolor(t, host){
  const pane = document.createElement('div');
  pane.className = 'ed-pane recolor-pane on';
  pane.dataset.tab = t.id;
  pane.innerHTML = recolorPageHTML();
  host.appendChild(pane);
  t._pane = pane;
  recolorBind(t, pane);
  recolorRefreshAssets(t, true);
}

function recolorBind(t, pane){
  const q = s => pane.querySelector(s);
  const on = (el, ev, fn) => { if(el) el.addEventListener(ev, fn); };

  on(q('#recAsset'), 'change', e => recolorLoadAsset(t, e.target.value, { auto:true }));
  on(q('#recRefresh'), 'click', () => {
    recolorRefreshAssets(t, true);
    toast('已刷新纹理列表');
  });
  on(q('#recEmptyGo'), 'click', () => { goHome(); toast('在内容库里新建纹理，或拖入 PNG'); });

  pane.querySelectorAll('[data-rec-view]').forEach(btn => {
    on(btn, 'click', () => {
      const st = recolorState(t);
      st.viewMode = btn.dataset.recView;
      recolorSavePrefs({ viewMode: st.viewMode });
      recolorRenderViewMode(t);
    });
  });
  pane.querySelectorAll('[data-preset]').forEach(btn => {
    on(btn, 'click', () => {
      const st = recolorState(t);
      st.preset = btn.dataset.preset;
      recolorApplyPreset(t, st.preset, true);
    });
  });
  on(q('#recAuto'), 'click', () => {
    const st = recolorState(t);
    recolorApplyPreset(t, st.preset, true);
  });
  on(q('#recClearTargets'), 'click', () => {
    const st = recolorState(t);
    st.mapping.forEach(m => { m.target = null; m.paletteIndex = null; });
    st.selected = -1;
    recolorMarkDirty(t);
    recolorRenderRows(t);
    recolorRenderPreview(t);
    toast('已清空目标色，可以重新选色');
  });
  on(q('#recApplyTop'), 'click', () => recolorApply(t));
  on(q('#recApplyBottom'), 'click', () => recolorApply(t));
  on(q('#recUndo'), 'click', () => recolorUndo(t));
  on(q('#recExport'), 'click', () => recolorExport(t));
  on(q('#recUseCluster'), 'click', () => {
    recolorSetMode(t, 'cluster');
    toast('已改为合并相近色，所有可见像素都会参与换色');
  });

  on(q('#recRows'), 'click', e => {
    const pick = e.target.closest('[data-rec-pick]');
    if(pick){
      e.preventDefault();
      e.stopPropagation();
      recolorOpenRowPicker(t, +pick.dataset.recPick, pick);
      return;
    }
    const reset = e.target.closest('[data-rec-reset]');
    if(reset){
      e.stopPropagation();
      const st = recolorState(t);
      const i = +reset.dataset.recReset;
      if(st.mapping[i]){
        st.mapping[i].target = st.mapping[i].source;
        st.mapping[i].paletteIndex = null;
        st.selected = i;
        recolorMarkDirty(t);
        recolorRenderRows(t);
        recolorRenderPreview(t);
        recolorPaintRow(t, i);
      }
      return;
    }
    const row = e.target.closest('[data-rec-row]');
    if(!row) return;
    const st = recolorState(t);
    st.selected = +row.dataset.recRow;
    recolorRenderRows(t);
  });

  on(q('#recPalette'), 'change', e => {
    const st = recolorState(t);
    st.paletteId = e.target.value;
    recolorRenderPalette(t);
  });
  on(q('#recPaletteSwatches'), 'click', e => {
    const b = e.target.closest('[data-rec-hex]');
    if(b) recolorPickPaletteColor(t, b.dataset.recHex);
  });
  on(q('#recRecent'), 'click', e => {
    const b = e.target.closest('[data-rec-hex]');
    if(b) recolorPickPaletteColor(t, b.dataset.recHex);
  });
  on(q('#recPaletteFill'), 'click', () => recolorFillFromPalette(t));

  pane.querySelectorAll('[data-rec-mode]').forEach(btn => {
    on(btn, 'click', () => recolorSetMode(t, btn.dataset.recMode));
  });
  on(q('#recTolerance'), 'input', e => {
    const st = recolorState(t);
    st.tolerance = +e.target.value;
    q('#recToleranceVal').textContent = String(st.tolerance);
    recolorSavePrefs({ tolerance: st.tolerance });
    recolorRenderPreview(t);
  });
  on(q('#recClusterCount'), 'input', e => {
    const st = recolorState(t);
    st.clusterCount = +e.target.value;
    q('#recClusterCountVal').textContent = String(st.clusterCount);
    recolorSavePrefs({ clusterCount: st.clusterCount });
  });
  on(q('#recClusterCount'), 'change', e => {
    const st = recolorState(t);
    st.clusterCount = +e.target.value;
    recolorReextract(t, true);
  });
}

function recolorRefreshAssets(t, initial){
  const st = recolorState(t);
  const pane = t._pane;
  if(!pane) return;
  const q = s => pane.querySelector(s);
  const assets = recolorAllAssets();
  st.assets = assets;
  const sel = q('#recAsset');
  if(!sel) return;
  sel.innerHTML = '';
  if(!assets.length){
    st.assetId = null;
    st.asset = null;
    st.imageData = null;
    q('#recEmpty').hidden = false;
    q('#recMain').hidden = true;
    q('#recApplyTop').disabled = true;
    q('#recApplyBottom').disabled = true;
    q('#recUndo').disabled = true;
    return;
  }
  q('#recEmpty').hidden = true;
  q('#recMain').hidden = false;

  const groups = new Map();
  assets.forEach(asset => {
    const key = asset.wsName || '工作区';
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(asset);
  });
  groups.forEach((list, wsName) => {
    const group = document.createElement('optgroup');
    group.label = wsName;
    list.forEach(asset => {
      const opt = document.createElement('option');
      opt.value = asset.id;
      opt.textContent = asset.cardName + ' · ' + asset.label;
      opt.dataset.data = asset.data;
      group.appendChild(opt);
    });
    sel.appendChild(group);
  });

  let id = st.assetId;
  if(initial && t.payload && t.payload.assetId && assets.some(a => a.id === t.payload.assetId)){
    id = t.payload.assetId;
  }
  if(!id || !assets.some(a => a.id === id)){
    const sameWs = assets.filter(a => a.wsId === S.wsId);
    id = (sameWs[0] || assets[0]).id;
  }
  const same = assets.find(a => a.id === id);
  const oldData = st.asset && st.asset.id === id ? st.asset.data : null;
  st.assetId = id;
  sel.value = id;
  if(initial || !st.asset || oldData !== (same && same.data)){
    recolorLoadAsset(t, id, { auto:true });
  }
}

function recolorLoadAsset(t, id, opts){
  const st = recolorState(t);
  const pane = t._pane;
  if(!pane) return;
  const q = s => pane.querySelector(s);
  const asset = recolorAssetById(id);
  if(!asset){
    recolorRefreshAssets(t, false);
    return;
  }
  const seq = ++st.loadSeq;
  st.assetId = id;
  st.asset = asset;
  st.selected = -1;
  st.lastApply = opts && opts.keepLast ? st.lastApply : null;
  q('#recSourceInfo').textContent = '读取中…';
  const img = new Image();
  img.onload = () => {
    if(seq !== st.loadSeq || !t._pane) return;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0);
    let imageData;
    try{ imageData = ctx.getImageData(0, 0, w, h); }
    catch(e){ toast('无法读取纹理像素：' + (e && e.message || e)); return; }
    st.image = img;
    st.imageData = imageData;
    st.width = w;
    st.height = h;
    const extracted = recolorExtract(imageData, st.mode, st.clusterCount);
    st.colors = extracted.colors;
    st.unique = extracted.unique;
    st.opaque = extracted.opaque;
    st.truncated = extracted.truncated;
    st.mapping = st.colors.map(color => ({
      source: color.hex,
      target: null,
      paletteIndex: null,
      count: color.count,
      share: color.share
    }));
    st.selected = -1;
    recolorClearDirty(t);
    recolorRenderAll(t);
    if(!opts || opts.auto !== false){
      recolorApplyPreset(t, st.preset, false);
    }else{
      recolorRenderPreview(t);
    }
    const frames = h > w && h % w === 0 ? h / w : 0;
    q('#recSourceInfo').textContent = `${asset.wsName} / ${asset.cardName} · ${w}×${h}${frames > 1 ? ' · ' + frames + ' 帧' : ''} · ${st.unique} 种颜色`;
  };
  img.onerror = () => {
    if(seq !== st.loadSeq || !t._pane) return;
    q('#recSourceInfo').textContent = '纹理读取失败';
    toast('纹理读取失败');
  };
  img.src = asset.data;
}

function recolorRenderAll(t){
  const st = recolorState(t);
  const pane = t._pane;
  if(!pane) return;
  const q = s => pane.querySelector(s);
  pane.querySelectorAll('[data-preset]').forEach(b => b.classList.toggle('on', b.dataset.preset === st.preset));
  const preset = RECOLOR_PRESETS.find(p => p.id === st.preset) || RECOLOR_PRESETS[0];
  q('#recPresetHint').textContent = preset.hint;
  q('#recColorCount').textContent = st.colors.length ? st.colors.length + ' 种' : '';
  pane.querySelectorAll('[data-rec-mode]').forEach(b => b.classList.toggle('on', b.dataset.recMode === st.mode));
  q('#recTolerance').value = String(st.tolerance);
  q('#recToleranceVal').textContent = String(st.tolerance);
  q('#recClusterCount').value = String(st.clusterCount);
  q('#recClusterCountVal').textContent = String(st.clusterCount);
  q('#recClusterRow').hidden = st.mode !== 'cluster';
  q('#recToleranceRow').hidden = st.mode === 'cluster';
  q('#recTruncateNote').textContent = st.mode === 'cluster'
    ? '合并相近色会把每个可见像素归到最近的主色；逐个颜色模式才使用容差。'
    : st.truncated
      ? '纹理颜色超过 30 种：这里只列出前 30 种，其余颜色保持原样。'
      : '';
  recolorRenderViewMode(t);
  recolorRenderRows(t);
  recolorRenderPalette(t);
  recolorRenderPreview(t);
  q('#recUndo').disabled = !(st.lastApply && st.lastApply.assetId === st.assetId);
}

function recolorRenderViewMode(t){
  const st = recolorState(t);
  const pane = t._pane;
  if(!pane) return;
  const row = pane.querySelector('#recCanvasRow');
  if(row) row.dataset.view = st.viewMode;
  pane.querySelectorAll('[data-rec-view]').forEach(b => b.classList.toggle('on', b.dataset.recView === st.viewMode));
}

function recolorRenderRows(t){
  const st = recolorState(t);
  const pane = t._pane;
  if(!pane) return;
  if(window.PWColorPicker) PWColorPicker.close();
  const box = pane.querySelector('#recRows');
  if(!st.mapping.length){
    box.innerHTML = '<div class="rec-rows-empty">这张纹理没有可处理的颜色。</div>';
    return;
  }
  box.innerHTML = st.mapping.map((m, i) => {
    const target = m.target;
    const text = target ? target.toUpperCase() : '选色';
    const style = target ? `background:${target};color:${recolorTextColor(target)}` : '';
    const share = (m.share * 100).toFixed(m.share < .1 ? 1 : 0);
    return `<div class="rec-row${st.selected === i ? ' sel' : ''}" data-rec-row="${i}">
      <span class="rec-idx">${String(i+1).padStart(2,'0')}</span>
      <span class="rec-source-swatch" style="background:${m.source}" title="${m.source.toUpperCase()}"></span>
      <span class="rec-source-hex">${m.source.toUpperCase()}</span>
      <span class="rec-share">${share}%</span>
      <span class="rec-arrow">→</span>
      <button type="button" class="rec-target${target ? ' has' : ''}" data-rec-pick="${i}" style="${style}" title="点击选择新颜色">${text}</button>
      <button type="button" class="rec-reset" data-rec-reset="${i}" title="恢复为本来的颜色">↺</button>
    </div>`;
  }).join('');
}

function recolorOpenRowPicker(t, i, anchor){
  const st = recolorState(t);
  const m = st.mapping[i];
  if(!m || !window.PWColorPicker) return;
  const current = st.palettes.find(p => p.id === st.paletteId) || st.palettes[0];
  const swatches = (current ? current.colors : []).concat(recolorRecentColors());
  st.selected = i;
  const pane = t._pane;
  if(pane) pane.querySelectorAll('.rec-row').forEach(r => r.classList.toggle('sel', +r.dataset.recRow === i));
  let previewRaf = 0;
  PWColorPicker.open(anchor, {
    title: `第 ${i + 1} 色 · 原色 ${m.source.toUpperCase()}`,
    color: m.target || m.source,
    swatches,
    onInput(hex){
      const mm = st.mapping[i];
      if(!mm) return;
      mm.target = hex;
      mm.paletteIndex = null;
      recolorMarkDirty(t);
      recolorPaintRow(t, i);
      if(!previewRaf) previewRaf = requestAnimationFrame(() => {
        previewRaf = 0;
        recolorRenderPreview(t);
      });
    },
    onClose(){
      if(t._pane) recolorRenderPreview(t);
    }
  });
}

function recolorPaintRow(t, i){
  const st = recolorState(t);
  const pane = t._pane;
  if(!pane) return;
  const row = pane.querySelector(`[data-rec-row="${i}"]`);
  if(!row) return;
  const m = st.mapping[i];
  const target = row.querySelector('.rec-target');
  if(!target || !m) return;
  if(m.target){
    target.classList.add('has');
    target.style.background = m.target;
    target.style.color = recolorTextColor(m.target);
    target.textContent = m.target.toUpperCase();
  }else{
    target.classList.remove('has');
    target.style.background = '';
    target.style.color = '';
    target.textContent = '选色';
  }
  pane.querySelectorAll('.rec-row').forEach(r => r.classList.toggle('sel', +r.dataset.recRow === st.selected));
}

function recolorRefreshPalettes(t){
  if(!t || t.kind !== 'recolor' || !t._pane) return;
  const st = recolorState(t);
  const pal = recolorPaletteState();
  st.palettes = pal.list;
  if(!st.palettes.some(p => p.id === st.paletteId)) st.paletteId = pal.active;
  recolorRenderPalette(t);
}
function recolorRenderPalette(t){
  const st = recolorState(t);
  const pane = t._pane;
  if(!pane) return;
  const sel = pane.querySelector('#recPalette');
  if(sel){
    sel.innerHTML = st.palettes.map(p =>
      `<option value="${esc(p.id)}">${esc(p.group)} / ${esc(p.name)} (${p.colors.length})</option>`
    ).join('');
    if(!st.palettes.some(p => p.id === st.paletteId)) st.paletteId = st.palettes[0] && st.palettes[0].id;
    sel.value = st.paletteId;
  }
  const current = st.palettes.find(p => p.id === st.paletteId) || st.palettes[0];
  const box = pane.querySelector('#recPaletteSwatches');
  if(box){
    box.classList.toggle('dense', !!(current && current.colors.length > 24));
    box.innerHTML = current ? current.colors.map(hex =>
      `<button type="button" class="rec-swatch" data-rec-hex="${hex}" style="background:${hex}" title="${hex.toUpperCase()}"></button>`
    ).join('') : '<span class="rec-muted">没有色卡颜色</span>';
  }
  const recent = recolorRecentColors();
  const rbox = pane.querySelector('#recRecent');
  if(rbox){
    rbox.innerHTML = recent.length ? recent.map(hex =>
      `<button type="button" class="rec-swatch small" data-rec-hex="${hex}" style="background:${hex}" title="${hex.toUpperCase()}"></button>`
    ).join('') : '<span class="rec-muted">还没有最近颜色</span>';
  }
}

function recolorApplyPreset(t, presetId, announce){
  const st = recolorState(t);
  if(!st.colors.length) return;
  if(announce) recolorMarkDirty(t);
  st.preset = presetId;
  if(presetId === 'random') recolorRandomSeed = (recolorRandomSeed * 1664525 + 1013904223) >>> 0;
  const current = st.palettes.find(p => p.id === st.paletteId) || st.palettes[0];
  const targets = recolorPresetTargets(st.colors, presetId, current ? current.colors : []);
  st.mapping.forEach((m, i) => {
    m.target = targets[i];
    m.paletteIndex = null;
  });
  st.selected = -1;
  recolorSavePrefs({ preset:presetId });
  recolorRenderAll(t);
  if(announce){
    const preset = RECOLOR_PRESETS.find(p => p.id === presetId) || RECOLOR_PRESETS[0];
    toast('已自动配色：' + preset.name);
  }
}

function recolorSetMode(t, mode){
  const st = recolorState(t);
  if(st.mode === mode) return;
  st.mode = mode;
  recolorSavePrefs({ mode });
  recolorReextract(t, true);
  toast(mode === 'cluster' ? '已切换为合并相近色' : '已切换为逐个颜色');
}

function recolorReextract(t, autoPreset){
  const st = recolorState(t);
  if(!st.imageData) return;
  const extracted = recolorExtract(st.imageData, st.mode, st.clusterCount);
  st.colors = extracted.colors;
  st.unique = extracted.unique;
  st.opaque = extracted.opaque;
  st.truncated = extracted.truncated;
  st.mapping = st.colors.map(color => ({
    source: color.hex,
    target: null,
    paletteIndex: null,
    count: color.count,
    share: color.share
  }));
  st.selected = -1;
  recolorRenderAll(t);
  if(autoPreset) recolorApplyPreset(t, st.preset, false);
}

function recolorPickPaletteColor(t, hex){
  const st = recolorState(t);
  if(!recolorHexToRgb(hex)) return;
  let row = st.selected;
  if(row < 0 || !st.mapping[row]) row = st.mapping.findIndex(m => !m.target);
  if(row < 0) row = 0;
  if(!st.mapping[row]) return;
  st.mapping[row].target = hex;
  st.mapping[row].paletteIndex = null;
  const next = st.mapping.findIndex((m, i) => i !== row && !m.target);
  st.selected = next >= 0 ? next : -1;
  recolorMarkDirty(t);
  recolorRenderRows(t);
  if(next >= 0) recolorPaintRow(t, next);
  recolorRenderPreview(t);
}

function recolorFillFromPalette(t){
  const st = recolorState(t);
  const current = st.palettes.find(p => p.id === st.paletteId) || st.palettes[0];
  if(!current || !current.colors.length){
    toast('当前色卡是空的');
    return;
  }
  const palette = current.colors.map(hex => ({ hex, lum:recolorLum(recolorHexToRgb(hex)) })).sort((a,b) => a.lum - b.lum);
  const order = st.mapping.map((m, i) => ({ i, lum:recolorLum(recolorHexToRgb(m.source)) })).sort((a,b) => a.lum - b.lum);
  order.forEach((entry, pos) => {
    const idx = palette.length === 1 ? 0 : Math.round(pos * (palette.length - 1) / Math.max(1, order.length - 1));
    st.mapping[entry.i].target = palette[idx].hex;
    st.mapping[entry.i].paletteIndex = idx + 1;
  });
  st.selected = -1;
  recolorMarkDirty(t);
  recolorRenderAll(t);
  toast('已按明暗套用色卡：' + current.name);
}

/* ---------------- 预览与替换 ---------------- */
function recolorCompute(st){
  const src = st.imageData;
  const out = new Uint8ClampedArray(src.data);
  const active = st.mapping
    .filter(m => m.target && recolorHexToRgb(m.target))
    .map(m => ({ from: recolorHexToRgb(m.source), to: recolorHexToRgb(m.target) }));
  if(!active.length) return { imageData:new ImageData(out, src.width, src.height), changed:0 };
  let changed = 0;
  const tol = st.mode === 'cluster' ? 255 : st.tolerance;
  const tol2 = tol * tol;
  for(let i=0;i<out.length;i+=4){
    if(out[i+3] < 128) continue;
    const px = { r:out[i], g:out[i+1], b:out[i+2] };
    if(st.mode === 'cluster'){
      let best = null, bestD = Infinity;
      for(let j=0;j<active.length;j++){
        const d = recolorDist2(px, active[j].from);
        if(d < bestD){ bestD = d; best = active[j]; }
      }
      if(best && bestD <= tol2){
        out[i] = best.to.r; out[i+1] = best.to.g; out[i+2] = best.to.b;
        changed++;
      }
    }else{
      for(let j=0;j<active.length;j++){
        if(recolorDist2(px, active[j].from) <= tol2){
          out[i] = active[j].to.r; out[i+1] = active[j].to.g; out[i+2] = active[j].to.b;
          changed++;
          break;
        }
      }
    }
  }
  return { imageData:new ImageData(out, src.width, src.height), changed };
}

function recolorCanvasScale(w, h){
  if(w <= 32 && h <= 32) return 8;
  if(w <= 64 && h <= 96) return 4;
  if(w <= 128) return 2;
  return 1;
}
function recolorSizeCanvas(canvas, w, h){
  const tall = h > w * 2;
  const scale = recolorCanvasScale(w, h);
  if(tall){
    canvas.style.width = 'auto';
    canvas.style.height = Math.min(360, Math.max(180, h * scale)) + 'px';
  }else{
    canvas.style.width = Math.min(520, Math.max(32, w * scale)) + 'px';
    canvas.style.height = 'auto';
  }
}
function recolorRenderPreview(t){
  const st = recolorState(t);
  const pane = t._pane;
  if(!pane || !st.imageData) return;
  const q = s => pane.querySelector(s);
  const before = q('#recBefore'), after = q('#recAfter');
  if(!before || !after) return;
  const result = recolorCompute(st);
  st.result = result.imageData;
  st.changed = result.changed;
  before.width = st.width; before.height = st.height;
  after.width = st.width; after.height = st.height;
  before.getContext('2d').putImageData(st.imageData, 0, 0);
  after.getContext('2d').putImageData(result.imageData, 0, 0);
  recolorSizeCanvas(before, st.width, st.height);
  recolorSizeCanvas(after, st.width, st.height);

  const hasTarget = st.mapping.some(m => m.target);
  const unset = st.mapping.filter(m => !m.target).length;
  const pct = st.opaque ? (result.changed / st.opaque * 100) : 0;
  q('#recStats').textContent = `${st.width}×${st.height} · ${st.colors.length} 种颜色 · 替换 ${result.changed} 像素 (${pct.toFixed(pct < 1 ? 1 : 0)}%)`;
  const warn = q('#recWarn');
  let warning = '';
  if(!hasTarget) warning = '还没有目标色：点一个预设，或点色卡颜色。';
  else if(!result.changed) warning = '当前容差下没有匹配像素，可以试试提高容差。';
  else if(unset) warning = `还有 ${unset} 种颜色没有目标色，会保持原样。`;
  else if(st.truncated) warning = '颜色超过 30 种，仅前 30 种参与本次换色。';
  warn.textContent = warning;
  const clusterBtn = q('#recUseCluster');
  if(clusterBtn) clusterBtn.hidden = !(st.truncated && st.mode === 'exact');
  const canApply = hasTarget && result.changed > 0;
  q('#recApplyTop').disabled = !canApply;
  q('#recApplyBottom').disabled = !canApply;
  q('#recExport').disabled = !st.imageData;
  q('#recApplyHint').textContent = canApply
    ? `将替换 ${result.changed} 个像素；点击后写入仓库，编辑器里的旧标签会自动关闭。`
    : (hasTarget ? '没有像素匹配，先调高容差或换个目标色。' : '选好目标色后即可应用。');
}

/* ---------------- 写入 / 应用 / 撤销 ---------------- */
function recolorWriteAsset(asset, dataUrl){
  const hit = findCardAnywhere(asset.cardId);
  if(!hit) return null;
  const card = hit.card;
  const seq = recolorBeginWrite(card);
  if(asset.kind === 'full'){
    card.full = dataUrl;
    if(card.ctex){
      const img = new Image();
      img.onload = () => {
        if(!recolorIsCurrentWrite(card, seq)) return;
        const w = img.naturalWidth, h = img.naturalHeight;
        card.ctex = { w, h };
        card.meta = w + '×' + h + ' · 自定义';
        card.thumb = recolorMakeThumb(img, w, h, false);
        saveData();
        if($('#catList')) refreshList();
      };
      img.src = dataUrl;
    }else{
      const img = new Image();
      img.onload = () => {
        if(!recolorIsCurrentWrite(card, seq)) return;
        const w = img.naturalWidth, h = img.naturalHeight;
        const frames = h > w && h % w === 0 ? h / w : 1;
        card.anim = frames > 1;
        card.badge = card.anim ? '动画' : '纹理';
        card.meta = w + '×' + h + (card.anim ? ' · ' + frames + ' 帧' : ' · 纹理');
        card.thumb = recolorMakeThumb(img, w, h, card.anim);
        saveData();
        if($('#catList')) refreshList();
      };
      img.src = dataUrl;
    }
  }else if(asset.kind === 'block'){
    if(!card.block) card.block = { model:'cube_all', textures:{} };
    if(!card.block.textures) card.block.textures = {};
    card.block.textures[asset.slot.slice(6)] = dataUrl;
  }else if(asset.kind === 'composite'){
    if(!card.composite) return null;
    const idx = +asset.slot.slice(10);
    if(!Array.isArray(card.composite.sources)) card.composite.sources = [null,null,null,null,null];
    card.composite.sources[idx] = dataUrl;
  }else if(asset.kind === 'armor'){
    if(!card.armor) card.armor = { kind:'vanilla_armor', textures:{} };
    if(!card.armor.textures) card.armor.textures = {};
    card.armor.textures[asset.slot.slice(6)] = dataUrl;
  }
  saveData();
  if($('#catList')) refreshList();
  if(asset.kind !== 'full') recolorRefresh3DThumb(card, asset.kind, seq);
  return { card, hit };
}

/* 方块 / 复合 / 盔甲：用一次性的隐藏编辑器重新生成 3D 缩略图 */
function recolorRefresh3DThumb(card, kind, seq){
  let done = false;
  let fr = null;
  const cleanup = () => {
    if(done) return;
    done = true;
    try{ if(fr && fr.parentNode) fr.remove(); }catch(e){}
  };
  try{
    const editorKind = kind === 'armor' ? 'entity' : kind;
    const src = embedSource(editorKind);
    if(!src) return;
    fr = document.createElement('iframe');
    fr.setAttribute('aria-hidden','true');
    fr.style.cssText = 'position:fixed;left:-12000px;top:0;width:360px;height:360px;border:0;visibility:hidden';
    fr.srcdoc = src;
    document.body.appendChild(fr);
    fr.addEventListener('load', () => {
      setTimeout(() => {
        try{
          const w = fr.contentWindow;
          if(editorKind === 'block') w.BS.load(card.block);
          else if(editorKind === 'composite') w.CS.load(card.composite);
          else w.ES.load(card.armor);
          setTimeout(() => {
            try{
              if(!recolorIsCurrentWrite(card, seq)){ cleanup(); return; }
              const snap = editorKind === 'block' ? w.BS.snapshot() : editorKind === 'composite' ? w.CS.snapshot() : w.ES.snapshot();
              if(snap && snap.thumb){
                card.thumb = snap.thumb;
                saveData();
                if($('#catList')) refreshList();
              }
            }catch(e){}
            cleanup();
          }, 600);
        }catch(e){ cleanup(); }
      }, 40);
    });
    setTimeout(cleanup, 6000);
  }catch(e){ cleanup(); }
}
function recolorMakeThumb(img, w, h, firstFrame){
  const cv = document.createElement('canvas');
  cv.width = cv.height = 16;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0,0,16,16);
  if(firstFrame && h > w) g.drawImage(img, 0, 0, w, w, 0, 0, 16, 16);
  else g.drawImage(img, 0, 0, 16, 16);
  return cv.toDataURL();
}
function recolorDirectTabs(cardId){
  return S.tabs.filter(t => t.kind !== 'recolor' && t.payload && t.payload.id === cardId &&
    ['tex','anim','ctex','block','composite','entity'].includes(t.kind));
}
function recolorPaintTabs(cardId){
  return S.tabs.filter(t => {
    const p = t.payload;
    if(!p) return false;
    if(p.blockPaint || p.compositePaint || p.armorPaint){
      const parentId = p.blockPaint ? p.blockPaint.blockTab : p.compositePaint ? p.compositePaint.compositeTab : p.armorPaint.entityTab;
      const parent = S.tabs.find(x => x.id === parentId);
      return parent && parent.payload && parent.payload.id === cardId;
    }
    return false;
  });
}
function recolorApply(t){
  const st = recolorState(t);
  if(!st.asset || !st.imageData){ toast('还没有加载纹理'); return; }
  if(!st.mapping.some(m => m.target)){ toast('先点一个预设，或选择目标色'); return; }
  if(!st.changed){
    toast('当前容差下没有像素被替换，试试提高容差');
    return;
  }
  const dirty = recolorDirectTabs(st.asset.cardId).filter(tab => tab._dirty);
  if(dirty.length){
    toast('这张卡还有未保存的编辑器修改，请先保存或还原再换色');
    return;
  }
  const paints = recolorPaintTabs(st.asset.cardId);
  if(paints.length){
    toast('这张卡还有绘画标签，请先应用或关闭再换色');
    return;
  }
  const result = recolorCompute(st);
  const cv = document.createElement('canvas');
  cv.width = st.width; cv.height = st.height;
  cv.getContext('2d').putImageData(result.imageData, 0, 0);
  const dataUrl = cv.toDataURL('image/png');
  const before = st.asset.data;
  const hit = recolorWriteAsset(st.asset, dataUrl);
  if(!hit){ toast('这张卡已经不在仓库里了'); return; }
  st.lastApply = { assetId:st.assetId, cardId:st.asset.cardId, before, after:dataUrl };
  recolorClearDirty(t);
  recolorDirectTabs(st.asset.cardId).forEach(tab => closeTab(tab.id, true));
  if(pvCardId === st.asset.cardId && $('#pvModal') && $('#pvModal').classList.contains('on')) closePreview();
  toast('已保存换色：' + st.asset.cardName + ' · ' + st.asset.label);
  recolorLoadAsset(t, st.assetId, { auto:false, keepLast:true });
}
function recolorUndo(t){
  const st = recolorState(t);
  if(!st.lastApply || st.lastApply.assetId !== st.assetId){ toast('没有可撤销的换色'); return; }
  const asset = recolorAssetById(st.lastApply.assetId);
  if(!asset){ toast('原来的纹理已经不在了'); return; }
  recolorWriteAsset(asset, st.lastApply.before);
  toast('已撤销上次换色');
  st.lastApply = null;
  recolorLoadAsset(t, st.assetId, { auto:false, keepLast:true });
}
function recolorExport(t){
  const st = recolorState(t);
  if(!st.imageData){ toast('还没有可导出的纹理'); return; }
  const result = recolorCompute(st);
  const cv = document.createElement('canvas');
  cv.width = st.width; cv.height = st.height;
  cv.getContext('2d').putImageData(result.imageData, 0, 0);
  const a = document.createElement('a');
  const name = st.asset ? st.asset.cardName.replace(/[\\/:*?"<>|]/g,'') : 'texture';
  a.download = name + '-换色.png';
  a.href = cv.toDataURL('image/png');
  a.click();
  toast('已导出 PNG');
}

/* ---------------- 入口 ---------------- */
function openRecolorTool(cardId, slot){
  if(typeof PWExtensions !== 'undefined' && !PWExtensions.isEnabled('recolor')){
    toast('「一键换色」已在设置里关闭');
    return;
  }
  let assetId = null;
  let card = null;
  if(cardId){
    const hit = findCardAnywhere(cardId);
    card = hit && hit.card;
    if(card){
      const assets = recolorCardAssets(card, hit.ws);
      if(!assets.length){
        toast('这张卡没有可换色的纹理');
        return;
      }
      assetId = slot ? cardId + '::' + slot : assets[0].id;
      if(!assets.some(a => a.id === assetId)) assetId = assets[0].id;
    }
  }
  const existing = S.tabs.find(t => t.kind === 'recolor' &&
    (assetId
      ? ((t.payload && t.payload.assetId === assetId) || (t._recolor && t._recolor.assetId === assetId))
      : !(t.payload && t.payload.assetId)));
  if(existing){ activateTab(existing.id); return; }
  const title = card ? '换色 · ' + card.name : '一键换色';
  newTab('recolor', title, assetId ? { assetId } : null);
}
