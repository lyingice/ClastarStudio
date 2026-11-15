
/* ============================================================
   像素图标（8×8 点阵，SVG 输出，跟着 currentColor 走）
   ============================================================ */
const ICONS = {
  brush:  ["......##",".....##.","....##..","...##...","..##....",".##.....","##......","#......."],
  anim:   [".##.....",".####...",".#####..",".######.",".#####..",".####...",".##.....","........"],
  entity: ["..####..",".#....#.","..####..","...##...","..####..",".#.##.#.","..#..#..","..#..#.."],
  box:    ["..####..",".#....#.","#......#","#......#","#......#","#......#",".#....#.","..####.."],
  grid:   ["##..##..","##..##..","........","##..##..","##..##..","........","##..##..","##..##.."],
  folder: [".###....","#...###.","#......#","#......#","#......#","#......#",".######.","........"],
  plus:   ["...##...","...##...","...##...","########","########","...##...","...##...","........"],
  palette:["..####..",".#....#.","#..##..#","#..##..#","#......#",".#....#.","..####..","........"],
  trash:  ["..####..",".######.","........",".######.",".#.##.#.",".#.##.#.",".######.","........"],
  search: ["..###...",".#...#..",".#...#..",".#...#..","..###...","....##..",".....##.","........"],
  close:  ["#......#",".#....#.","..#..#..","...##...","...##...","..#..#..",".#....#.","#......#"],
  home:   ["...##...","..####..",".######.","########","#..##..#","#..##..#","#......#","........"],
  tex:    ["########","#......#","#.##...#","#.##...#","#......#","#..##..#","#......#","########"],
  eraser: ["....####","...#####","..######",".#######","########","#######.","######..","........"],
  bucket: ["...##...","...##...","..####..",".######.","########","########",".######.","..####.."],
  select: ["##....##","#......#","........","........","........","........","#......#","##....##"],
  shape:  ["..####..",".#....#.","#......#","#......#","#......#","#......#",".#....#.","..####.."],
  eye:    ["..####..",".#....#.","#..##..#","#..##..#","#......#",".#....#.","..####..","........"],
  keyboard:["........","########","#.#.#..#","########","#.#.#..#","########","........","........"]
};
function iconSVG(name, size){
  const art = ICONS[name] || ICONS.box;
  let r = '';
  art.forEach((row, y) => { [...row].forEach((ch, x) => { if(ch === '#') r += `<rect x="${x}" y="${y}" width="1" height="1"/>`; }); });
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 8 8" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
}
function paintIcons(root){
  (root || document).querySelectorAll('[data-icon]').forEach(el => {
    const n = el.dataset.icon;
    if(el.dataset.done === n) return;
    el.innerHTML = iconSVG(n, +el.dataset.size || 16);
    el.dataset.done = n;
  });
}

/* ============================================================
   数据
   ============================================================ */
const APP_VERSION = '0.14.1';
const THEMES = [
  {id:'grass',    name:'草原绿',  c:['#4c9a2a','#6fc244','#2f6b1a']},
  {id:'diamond',  name:'钻石蓝',  c:['#2fa8c9','#5fd2ee','#186f88']},
  {id:'gold',     name:'黄金',    c:['#c99a1e','#f0cd52','#8a6610']},
  {id:'redstone', name:'红石',    c:['#b63a2f','#e05a4a','#7a221a']},
  {id:'amethyst', name:'紫水晶',  c:['#8b5cf6','#b08bff','#5a34b0']},
  {id:'slate',    name:'青灰',    c:['#5b7f8f','#89b3c4','#33505c']}
];

/* ============================================================
   状态
   ============================================================ */
const S = {
  tabs: [], active: null, seq: 1, lastEditor: null,
  view: 'texture', theme: 'grass', query: '', sel: null,
  sort: 'name', mode: 'grid',
  selectMode: false, picked: new Set()
};

/* ============================================================
   工具
   ============================================================ */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
function hexA(hex, a){
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}
let toastT = null;
function toast(msg){
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), 2200);
}
/* 蓝色小提示气泡（Ore UI tooltip） */
const tipEl = $('#tip');
document.addEventListener('mouseover', e => {
  const el = e.target.closest('[data-tip]');
  if(!el){ tipEl.classList.remove('on'); return; }
  tipEl.textContent = el.dataset.tip;
  tipEl.classList.add('on');
  const r = el.getBoundingClientRect();
  const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
  let x = r.left + r.width/2 - tw/2;
  let y = r.bottom + 7;
  if(y + th > innerHeight - 4) y = r.top - th - 7;
  x = Math.max(4, Math.min(innerWidth - tw - 4, x));
  tipEl.style.left = x + 'px';
  tipEl.style.top = y + 'px';
});
document.addEventListener('mouseout', e => { if(e.target.closest('[data-tip]')) tipEl.classList.remove('on'); });

/* ============================================================
   主题
   ============================================================ */
function applyTheme(id){
  const th = THEMES.find(t => t.id === id) || THEMES[0];
  S.theme = th.id;
  const root = document.documentElement.style;
  root.setProperty('--accent',  th.c[0]);
  root.setProperty('--accent2', th.c[1]);
  root.setProperty('--accentd', th.c[2]);
  root.setProperty('--accent-a', hexA(th.c[0], .38));
  if($('#themeList')) renderThemePicker();
  rethemeFrames();
  saveData();
}

/* ============================================================
   标签页
   ============================================================ */
const TAB_ICON = { home:'home', tex:'tex', anim:'anim', ctex:'tex', block:'box', composite:'box', entity:'entity', color:'palette', recolor:'brush', variant:'shape', shortcuts:'keyboard', assets:'grid', plugin:'box', plugins:'grid', recent:'grid', trash:'trash' };
function newTab(kind, title, payload){
  const id = ++S.seq;
  const t = { id, kind, title: title || (kind === 'home' ? '首页' : '未命名'), payload: payload || null };
  S.tabs.push(t);
  activateTab(id);
  return t;
}
function activateTab(id){
  const t = S.tabs.find(x => x.id === id);
  if(!t) return;
  S.active = id; S.sel = null;
  if(t.kind === 'tex' || t.kind === 'anim') S.lastEditor = id;
  syncNav();
  renderTabs(); renderContent(); renderStatus();
}
function syncNav(){
  $$('#wsList .nav').forEach(x => x.classList.toggle('on', x.dataset.ws === S.wsId));
}
function closeTab(id, force){
  const target = S.tabs.find(t => t.id === id);
  if(target && target._dirty && !force){
    confirmDialog('关闭标签页', '「' + target.title + '」还有没保存的修改，关闭后这些修改会丢掉。', '仍然关闭',
      () => closeTab(id, true));
    return;
  }
  const i = S.tabs.findIndex(t => t.id === id);
  if(i < 0) return;
  const wasActive = S.active === id;
  const dead = S.tabs[i];
  if(dead && dead._pane) dead._pane.remove();
  S.tabs.splice(i, 1);
  if(wasActive){
    const next = S.tabs[i] || S.tabs[i-1] || null;
    S.active = next ? next.id : null;
  }
  renderTabs(); renderContent(); renderStatus();
}
function activeTab(){ return S.tabs.find(t => t.id === S.active) || null; }
function goHome(){
  const home = S.tabs.find(t => t.kind === 'home');
  if(home) activateTab(home.id);
  else newTab('home', '首页');
}
function openColorStudio(){
  if(typeof PWExtensions !== 'undefined' && !PWExtensions.isEnabled('color-studio')){
    toast('「色彩拓展」已在设置里关闭');
    return;
  }
  const exist = S.tabs.find(t => t.kind === 'color');
  if(exist) activateTab(exist.id);
  else newTab('color', '色彩拓展');
}
function renderTabs(){
  const box = $('#tabs');
  box.innerHTML = S.tabs.map(t => {
    const ic = iconSVG(TAB_ICON[t.kind] || 'box', 13);
    return `<div class="tab ${t.id===S.active?'on':''}" data-tab="${t.id}">
      ${ic}<span class="tab-name">${esc(t.title)}</span>
      <span class="x" data-close="${t.id}">${iconSVG('close', 11)}</span>
    </div>`;
  }).join('');
}
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ============================================================
   缩略图：16×16 程序化色块（像贴图预览）
   ============================================================ */
function paintSwatch(cv, colors, style, seed){
  const g = cv.getContext('2d');
  let s = (seed * 2654435761) >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0, s / 4294967296);
  for(let y=0;y<16;y++) for(let x=0;x<16;x++){
    let i;
    if(style === 'grass')      i = y < 5 ? (rnd() < .35 ? 1 : 0) : (rnd() < .3 ? 3 : 2);
    else if(style === 'stripe')i = (x % 4 < 2) ? (rnd() < .25 ? 1 : 0) : (rnd() < .3 ? 3 : 2);
    else if(style === 'checker')i = (((x>>1)+(y>>1)) % 2) ? (rnd() < .2 ? 3 : 2) : (rnd() < .2 ? 1 : 0);
    else                        i = Math.floor(rnd() * colors.length);
    g.fillStyle = colors[i % colors.length];
    g.fillRect(x, y, 1, 1);
  }
  /* 一点暗点，像贴图的噪点 */
  for(let k=0;k<10;k++){
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.fillRect(Math.floor(rnd()*16), Math.floor(rnd()*16), 1, 1);
  }
}
function hydrateThumbs(root){
  (root || document).querySelectorAll('canvas[data-swatch]').forEach(cv => {
    if(cv.dataset.done) return;
    cv.dataset.done = '1';
    if(cv.dataset.src){                      // 导入的真实图片：直接缩到 16×16
      const im = new Image();
      im.onload = () => {
        const g = cv.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.drawImage(im, 0, 0, 16, 16);
      };
      im.src = cv.dataset.src;
      return;
    }
    const c = JSON.parse(cv.dataset.colors || '["#888","#666","#aaa","#444"]');
    paintSwatch(cv, c, cv.dataset.style || 'noise', +cv.dataset.seed || 1);
  });
}

/* ============================================================
   主内容
   ============================================================ */
function renderContent(){
  const t = activeTab();
  const box = $('#content');

  /* 内容区外壳：仓库视图 + 常驻的编辑器容器（切标签不销毁 iframe） */
  if(!$('#repoView')){
    box.innerHTML = '<div class="view-pane" id="repoView"></div><div id="editors"></div>';
  }
  const repo = $('#repoView'), eds = $('#editors');

  if(!t){
    document.querySelector('.workspace').classList.remove('editing');
    document.body.classList.remove('editing');
    eds.classList.remove('on');
    repo.classList.add('on');
    repo.innerHTML = `<div class="empty" style="margin:auto;text-align:center">
      没有打开的标签页<br><br>
      <button class="btn pri" onclick="goHome()">回到首页</button></div>`;
    return;
  }

  if(t.kind === 'home' || t.kind === 'recent' || t.kind === 'trash'){
    document.querySelector('.workspace').classList.remove('editing');
    document.body.classList.remove('editing');
    eds.classList.remove('on');
    repo.classList.add('on');
    if(t.kind === 'home'){
      repo.innerHTML = homeHTML();
      bindHome();
      renderWorkspaces();
    } else if(t.kind === 'recent'){
      repo.innerHTML = recentHTML();
      bindLib(t);
    } else {
      repo.innerHTML = trashHTML();
      bindLib(t);
    }
    hydrateThumbs(repo);
    paintIcons(repo);
    return;
  }

  if(t.kind === 'recolor' || t.kind === 'variant' || t.kind === 'shortcuts' || t.kind === 'assets' || t.kind === 'plugins' || t.kind === 'plugin'){
    document.querySelector('.workspace').classList.add('editing');
    document.body.classList.add('editing');
    repo.classList.remove('on');
    repo.innerHTML = '';
    eds.classList.add('on');
    $$('#editors > .ed-pane').forEach(p => p.classList.toggle('on', +p.dataset.tab === t.id));
    if(!$('#editors > .ed-pane[data-tab="' + t.id + '"]')){
      if(t.kind === 'recolor') mountRecolor(t, eds);
      else if(t.kind === 'variant') mountVariantLab(t, eds);
      else if(t.kind === 'shortcuts') PWShortcuts.mountCenter(t, eds);
      else if(t.kind === 'assets') PWAssets.mount(t, eds);
      else if(t.kind === 'plugins') PWPlugins.mountCenter(t, eds);
      else PWPlugins.mount(t, eds);
    }
    return;
  }

  repo.classList.remove('on');
  repo.innerHTML = '';
  eds.classList.add('on');
  document.querySelector('.workspace').classList.add('editing');
  document.body.classList.add('editing');
  $$('#editors > .ed-pane').forEach(p => p.classList.toggle('on', +p.dataset.tab === t.id));
  if(!$('#editors > .ed-pane[data-tab="' + t.id + '"]')) mountEditor(t, eds);
}

/* ============================================================
   工作区（持久化到 localStorage）
   ============================================================ */
const LS_DATA = 'pixelWorkshop_v1';
let WS = [];
let TRASH = [];      // 回收站
let RECENT = [];     // 最近打开
let saveTimer = null;

function uidWs(){ return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function isAssetWorkspace(w){ return !!(w && w.assetLibrary); }
function projectWorkspaces(){ return WS.filter(w => !w.assetLibrary); }
function normCard(c){
  const out = {
    id: c.id || ('c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)),
    name: c.name || '未命名',
    meta: c.meta || '',
    badge: c.badge || (c.block || c.composite ? '方块' : c.armor ? '实体' : c.anim ? '动画' : '纹理'),
    type: c.type === 'folder' ? 'folder' : 'item',
    anim: !!c.anim
  };
  if(c.block && typeof c.block === 'object') out.block = c.block;
  if(c.composite && typeof c.composite === 'object') out.composite = c.composite;
  if(c.create && typeof c.create === 'object') out.create = c.create;
  if(c.ref && typeof c.ref === 'object') out.ref = c.ref;
  if(c.pluginData && typeof c.pluginData === 'object') out.pluginData = c.pluginData;
  if(c.armor && typeof c.armor === 'object') out.armor = c.armor;
  if(c.ctex && typeof c.ctex === 'object') out.ctex = c.ctex;
  if(c.thumb) out.thumb = c.thumb;
  if(c.full) out.full = c.full;
  if(c.packPath) out.packPath = String(c.packPath);
  if(c.packNs) out.packNs = String(c.packNs);
  if(c.mcmeta && typeof c.mcmeta === 'object') out.mcmeta = c.mcmeta;
  if(c.sourcePath) out.sourcePath = String(c.sourcePath);
  if(c.colors) { out.style = c.style || 'noise'; out.colors = c.colors; }
  if(Array.isArray(c.cards)) out.cards = c.cards.map(normCard);
  return out;
}
function loadData(){
  try{
    const raw = localStorage.getItem(LS_DATA);
    if(!raw) return false;
    const d = JSON.parse(raw);
    if(!d || !Array.isArray(d.ws)) return false;
    WS = d.ws.map(w => ({
      id: w.id || uidWs(),
      name: w.name || '未命名工作区',
      assetLibrary: !!w.assetLibrary,
      cats: Array.isArray(w.cats) ? w.cats.map(c => ({
        id: c.id || uidWs(),
        name: c.name || '未命名大类别',
        open: c.open !== false,
        cards: Array.isArray(c.cards) ? c.cards.map(normCard) : []
      })) : []
    }));
    if(WS.length){
      const validWs = (id) => WS.some(w => w.id === id && !w.assetLibrary);
      S.wsId = (d.wsId && validWs(d.wsId)) ? d.wsId : (WS.find(w => !w.assetLibrary) || {}).id || null;
    }
    if(d.theme && THEMES.some(t => t.id === d.theme)) S.theme = d.theme;
    TRASH = Array.isArray(d.trash) ? d.trash : [];
    RECENT = Array.isArray(d.recent) ? d.recent : [];
    return true;
  }catch(e){ return false; }
}
let storageWarned = false;
function saveData(){
  try{
    localStorage.setItem(LS_DATA, JSON.stringify({ v:1, ws:WS, wsId:S.wsId, theme:S.theme, trash:TRASH, recent:RECENT }));
    return true;
  }catch(e){
    if(!storageWarned){
      storageWarned = true;
      try{ toast('本地空间不足，最新改动可能没有保存。请先导出 ZIP 备份。'); }catch(_){}
    }
    return false;
  }
}
function saveSoon(){ clearTimeout(saveTimer); saveTimer = setTimeout(saveData, 200); }

