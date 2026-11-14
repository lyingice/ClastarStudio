/* ============================================================
   侧栏系统
   参考 Blockbench：面板组折叠、栏宽拖拽/复位、布局持久化、
   右侧快捷栏、移动端面板切换。
   ============================================================ */

const SIDEBAR_KEY = 'pixelWorkshop_sidebar_v1';
const SIDEBAR_DEFAULTS = {
  leftWidth: 216,
  rightWidth: 190,
  leftOff: false,
  rightOff: false,
  groups: {},
  mobileSection: 'workspaces'
};
let sidebarPrefs = null;

function sidebarLoadPrefs(){
  try{
    const saved = JSON.parse(localStorage.getItem(SIDEBAR_KEY) || 'null');
    const out = Object.assign({}, SIDEBAR_DEFAULTS, saved || {});
    out.groups = Object.assign({}, SIDEBAR_DEFAULTS.groups, (saved && saved.groups) || {});
    out.leftWidth = Math.max(176, Math.min(360, +out.leftWidth || SIDEBAR_DEFAULTS.leftWidth));
    out.rightWidth = Math.max(168, Math.min(300, +out.rightWidth || SIDEBAR_DEFAULTS.rightWidth));
    out.leftOff = !!out.leftOff;
    out.rightOff = !!out.rightOff;
    out.mobileSection = ['workspaces','tools','library'].includes(out.mobileSection) ? out.mobileSection : 'workspaces';
    return out;
  }catch(e){ return Object.assign({}, SIDEBAR_DEFAULTS, {groups:{}}); }
}
function sidebarSavePrefs(patch){
  sidebarPrefs = Object.assign({}, sidebarPrefs || sidebarLoadPrefs(), patch || {});
  try{ localStorage.setItem(SIDEBAR_KEY, JSON.stringify(sidebarPrefs)); }catch(e){}
}
function sidebarClamp(side, value){
  const max = side === 'left' ? Math.min(360, Math.max(220, innerWidth - 430)) : Math.min(300, Math.max(180, innerWidth - 360));
  const min = side === 'left' ? 176 : 168;
  return Math.max(min, Math.min(max, Math.round(value)));
}
function sidebarSnap(side, value){
  const def = side === 'left' ? SIDEBAR_DEFAULTS.leftWidth : SIDEBAR_DEFAULTS.rightWidth;
  let w = Math.round(value / 8) * 8;
  if(Math.abs(w - def) <= 8) w = def;
  return sidebarClamp(side, w);
}
function sidebarApplyWidths(){
  const ws = document.querySelector('.workspace');
  if(!ws) return;
  const prefs = sidebarPrefs || sidebarLoadPrefs();
  ws.style.setProperty('--left-rail-w', prefs.leftWidth + 'px');
  ws.style.setProperty('--right-rail-w', prefs.rightWidth + 'px');
}

function sidebarApplyPrefs(){
  sidebarPrefs = sidebarPrefs || sidebarLoadPrefs();
  const ws = document.querySelector('.workspace');
  if(!ws) return;
  sidebarApplyWidths();
  ws.classList.toggle('left-off', !!sidebarPrefs.leftOff);
  ws.classList.toggle('right-off', !!sidebarPrefs.rightOff);
  document.querySelectorAll('[data-rail-group]').forEach(group => {
    const key = group.dataset.railGroup;
    const folded = !!sidebarPrefs.groups[key];
    group.classList.toggle('folded', folded);
    const btn = group.querySelector('[data-rail-fold]');
    if(btn) btn.setAttribute('aria-expanded', String(!folded));
  });
  sidebarSetMobileSection(sidebarPrefs.mobileSection, false);
}

function sidebarToggleFold(key){
  if(!key) return;
  sidebarPrefs = sidebarPrefs || sidebarLoadPrefs();
  sidebarPrefs.groups = Object.assign({}, sidebarPrefs.groups);
  sidebarPrefs.groups[key] = !sidebarPrefs.groups[key];
  sidebarSavePrefs({ groups:sidebarPrefs.groups });
  const group = document.querySelector(`[data-rail-group="${key}"]`);
  if(group){
    group.classList.toggle('folded', !!sidebarPrefs.groups[key]);
    const btn = group.querySelector('[data-rail-fold]');
    if(btn) btn.setAttribute('aria-expanded', String(!sidebarPrefs.groups[key]));
  }
}

function sidebarSetMobileSection(name, save = true){
  if(!['workspaces','tools','library'].includes(name)) name = 'workspaces';
  if(sidebarPrefs) sidebarPrefs.mobileSection = name;
  document.querySelectorAll('[data-mobile-rail]').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.mobileRail === name);
  });
  document.querySelectorAll('.rail.left [data-rail-group]').forEach(group => {
    group.classList.toggle('active', group.dataset.railGroup === name);
  });
  if(save) sidebarSavePrefs({ mobileSection:name });
}

function sidebarSetupResizer(side){
  const handle = document.getElementById(side === 'left' ? 'railResizeLeft' : 'railResizeRight');
  if(!handle) return;
  const move = (startX, startWidth, event) => {
    const dx = event.clientX - startX;
    const raw = side === 'left' ? startWidth + dx : startWidth - dx;
    const width = sidebarSnap(side, raw);
    if(side === 'left') sidebarPrefs.leftWidth = width;
    else sidebarPrefs.rightWidth = width;
    sidebarApplyWidths();
  };
  handle.addEventListener('pointerdown', event => {
    if(shellMobile()) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = side === 'left' ? sidebarPrefs.leftWidth : sidebarPrefs.rightWidth;
    handle.classList.add('dragging');
    document.body.classList.add('rail-resizing');
    try{ handle.setPointerCapture(event.pointerId); }catch(e){}
    const onMove = e => move(startX, startWidth, e);
    const onUp = () => {
      handle.classList.remove('dragging');
      document.body.classList.remove('rail-resizing');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      sidebarSavePrefs(side === 'left' ? { leftWidth:sidebarPrefs.leftWidth } : { rightWidth:sidebarPrefs.rightWidth });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once:true });
    window.addEventListener('pointercancel', onUp, { once:true });
  });
  handle.addEventListener('dblclick', () => {
    if(side === 'left') sidebarPrefs.leftWidth = SIDEBAR_DEFAULTS.leftWidth;
    else sidebarPrefs.rightWidth = SIDEBAR_DEFAULTS.rightWidth;
    sidebarSavePrefs(side === 'left' ? { leftWidth:sidebarPrefs.leftWidth } : { rightWidth:sidebarPrefs.rightWidth });
    sidebarApplyWidths();
    toast('已恢复默认栏宽');
  });
}

function sidebarOpenCard(cardId){
  const hit = findCardAnywhere(cardId);
  if(!hit) return;
  S.wsId = hit.ws.id;
  S.folder = hit.folder ? { catId:hit.cat.id, cardId:hit.folder.id } : null;
  S.query = '';
  saveData();
  renderWorkspaces();
  closeDrawers();
  const existing = S.tabs.find(t => t.payload && t.payload.id === cardId &&
    ['tex','anim','ctex'].includes(t.kind));
  if(existing) activateTab(existing.id);
  else openCard(cardId);
  renderQuickRail();
}

function sidebarQuickNew(){
  if(!currentWS()){
    closeDrawers();
    newWorkspace();
    return;
  }
  openNewDialog();
  closeDrawers();
}
function sidebarQuickNewCategory(){
  if(!currentWS()){
    closeDrawers();
    toast('先新建一个工作区');
    newWorkspace();
    return;
  }
  newCategory();
  closeDrawers();
}
function sidebarQuickImport(){
  closeDrawers();
  if(!currentWS()){
    toast('先新建一个工作区，再导入 PNG');
    newWorkspace();
    return;
  }
  const input = $('#filePick');
  if(input) input.click();
}
function sidebarQuickRecolor(){
  closeDrawers();
  openRecolorTool();
}
function sidebarQuickZip(){
  closeDrawers();
  const input = $('#zipPick');
  if(input) input.click();
}
function sidebarQuickPack(){
  closeDrawers();
  if(!currentWS()){ toast('先新建工作区'); return; }
  if(!S.selectMode){
    const t = activeTab();
    if(!t || t.kind !== 'home') goHome();
    setSelectMode(true);
  } else if(!pickCount()) toast('点作品多选，再点「导出资源包」');
  else PWPack.openDialog([...S.picked]);
}
function sidebarOpenRecentView(){
  closeDrawers();
  const exist = S.tabs.find(t => t.kind === 'recent');
  if(exist) activateTab(exist.id);
  else newTab('recent', '最近打开');
}

function renderQuickRail(){
  const workspaceBox = document.querySelector('#quickWorkspace');
  if(!workspaceBox) return;
  const ws = currentWS();
  if(!ws){
    workspaceBox.innerHTML = '<span class="rail-summary-empty">还没有工作区</span><span>先新建一个工作区，再把纹理、动画和方块收进去。</span>';
  }else{
    const catCount = ws.cats.length;
    const cardCount = ws.cats.reduce((n, cat) => n + cat.cards.length, 0);
    const folderCount = ws.cats.reduce((n, cat) => n + cat.cards.filter(c => c.type === 'folder').length, 0);
    workspaceBox.innerHTML = `<b>${esc(ws.name)}</b><span>${catCount} 个大类别 · ${cardCount} 项${folderCount ? ' · ' + folderCount + ' 个文件夹' : ''}</span>`;
  }
  const recentBox = document.querySelector('#quickRecent');
  if(recentBox){
    const rows = [];
    RECENT.slice(0, 4).forEach(rec => {
      const hit = findCardAnywhere(rec.cardId);
      if(!hit) return;
      const c = hit.card;
      const thumb = c.thumb || (typeof cardImage === 'function' ? cardImage(c) : null);
      rows.push(`<button type="button" class="quick-recent-item" data-quick-card="${esc(c.id)}" title="${esc(c.name)}">
        <span class="quick-recent-thumb">${thumb ? `<img src="${thumb}" alt="">` : '▦'}</span>
        <span class="quick-recent-info"><b>${esc(c.name)}</b><span>${esc(hit.ws.name)} · ${esc(c.badge || '内容')}</span></span>
      </button>`);
    });
    recentBox.innerHTML = rows.length ? rows.join('') : '<div class="quick-recent-empty">还没有打开过内容。</div>';
  }
  const count = document.querySelector('#wsCount');
  if(count) count.textContent = WS.length ? String(WS.length) : '';
  document.querySelectorAll('#wsList [data-ws]').forEach(btn => {
    const ws = WS.find(w => w.id === btn.dataset.ws);
    const node = btn.querySelector('.ws-count');
    if(ws && node && typeof cardCount === 'function') node.textContent = cardCount(ws);
  });
}

function sidebarBindQuick(){
  const bind = (id, fn) => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('click', e => { e.preventDefault(); fn(); });
  };
  bind('quickNew', sidebarQuickNew);
  bind('quickCat', sidebarQuickNewCategory);
  bind('quickImport', sidebarQuickImport);
  bind('quickZip', sidebarQuickZip);
  bind('quickPack', sidebarQuickPack);
  bind('quickRecentAll', sidebarOpenRecentView);
  const recent = document.getElementById('quickRecent');
  if(recent){
    recent.addEventListener('click', e => {
      const b = e.target.closest('[data-quick-card]');
      if(b) sidebarOpenCard(b.dataset.quickCard);
    });
  }
  document.querySelectorAll('[data-rail-fold]').forEach(btn => {
    btn.addEventListener('click', () => sidebarToggleFold(btn.dataset.railFold));
  });
  document.querySelectorAll('[data-mobile-rail]').forEach(btn => {
    btn.addEventListener('click', () => sidebarSetMobileSection(btn.dataset.mobileRail));
  });
}

function setupSidebar(){
  sidebarPrefs = sidebarLoadPrefs();
  sidebarApplyPrefs();
  sidebarSetupResizer('left');
  sidebarSetupResizer('right');
  sidebarBindQuick();
  renderQuickRail();
  window.addEventListener('resize', () => {
    if(!sidebarPrefs) return;
    const left = sidebarClamp('left', sidebarPrefs.leftWidth);
    const right = sidebarClamp('right', sidebarPrefs.rightWidth);
    if(left !== sidebarPrefs.leftWidth || right !== sidebarPrefs.rightWidth){
      sidebarPrefs.leftWidth = left;
      sidebarPrefs.rightWidth = right;
      sidebarApplyWidths();
    }
  });
}
