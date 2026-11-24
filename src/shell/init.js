/* ---------------- 侧栏折叠 ---------------- */
function setRail(side, off){
  const ws = document.querySelector('.workspace');
  ws.classList.toggle(side + '-off', off);
  if(side === 'left') S.leftOff = off; else S.rightOff = off;
  if(typeof sidebarSavePrefs === 'function'){
    sidebarSavePrefs(side === 'left' ? { leftOff:!!off } : { rightOff:!!off });
  }
}
function shellMobile(){ return window.matchMedia('(max-width:900px)').matches; }
function closeDrawers(){ document.body.classList.remove('m-left', 'm-right'); }
function setupShellMobile(){
  const L = $('#mLeft'), R = $('#mRight'), H = $('#mHome'), SET = $('#mSet');
  if(!L) return;
  L.onclick = () => {
    const on = document.body.classList.contains('m-left');
    closeDrawers();
    const off = document.querySelector('.workspace').classList.contains('left-off');
    if(off) setRail('left', false);
    if(!on) document.body.classList.add('m-left');
  };
  if(R) R.onclick = () => {
    const on = document.body.classList.contains('m-right');
    closeDrawers();
    const off = document.querySelector('.workspace').classList.contains('right-off');
    if(off) setRail('right', false);
    if(!on) document.body.classList.add('m-right');
  };
  if(H) H.onclick = () => { closeDrawers(); goHome(); };
  if(SET) SET.onclick = () => { closeDrawers(); openSettings(); };
  $('#mMask').onclick = closeDrawers;
}
function bindRails(){
  $$('.rail-btn').forEach(b => b.onclick = () => {
    if(shellMobile()) closeDrawers();
    else setRail(b.dataset.rail, true);
  });
  const tl = $('#railTabLeft');
  if(tl) tl.onclick = () => setRail('left', false);
  const tr = $('#railTabRight');
  if(tr) tr.onclick = () => setRail('right', false);
}

/* ============================================================
   启动
   ============================================================ */
/* 小方块帮助：悬浮预览，点击固定 */
let helpPin = null, helpTimer = null;
function helpShow(el){
  const pop = $('#helpPop');
  const text = el && el.dataset && el.dataset.help;
  if(!pop || !text) return;
  pop.textContent = text;
  pop.classList.add('on');
  const r = el.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  let x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width/2 - w/2));
  let y = r.bottom + 6;
  if(y + h > innerHeight - 8) y = Math.max(8, r.top - h - 6);
  pop.style.left = x + 'px'; pop.style.top = y + 'px';
}
function helpHide(force){
  if(helpPin && !force) return;
  const pop = $('#helpPop'); if(pop) pop.classList.remove('on');
}
document.addEventListener('mouseover', e => {
  const el = e.target.closest('.hq');
  if(!el) return;
  clearTimeout(helpTimer);
  helpTimer = setTimeout(() => helpShow(el), 180);
});
document.addEventListener('mouseout', e => {
  if(e.target.closest('.hq')){ clearTimeout(helpTimer); helpHide(false); }
});
document.addEventListener('click', e => {
  const el = e.target.closest('.hq');
  if(el){
    e.preventDefault(); e.stopPropagation();
    helpPin = (helpPin === el) ? null : el;
    if(helpPin) helpShow(el); else helpHide(true);
    return;
  }
  if(!e.target.closest('#helpPop')){ helpPin = null; helpHide(true); }
}, true);
document.addEventListener('scroll', () => helpHide(true), true);

function init(){
  paintIcons();
  bindRails();            // 工作区折叠
  setupShellMobile();     // 手机端底部条
  loadData();             // 读本地存档（没有就是空）
  applyTheme(S.theme || 'grass');
  if(typeof PWExtensions !== 'undefined') PWExtensions.init();
  if(typeof PWShortcuts !== 'undefined') PWShortcuts.init();
  if(typeof PWPlugins !== 'undefined') PWPlugins.init();
  if(typeof PWAssets !== 'undefined') PWAssets.init();
  if(typeof PWModels !== 'undefined') PWModels.init();
  if(typeof PWUpdates !== 'undefined') PWUpdates.init();
  if(typeof PWAgent !== 'undefined') PWAgent.init();
  if(typeof setupSidebar === 'function') setupSidebar();
  renderWorkspaces();
  newTab('home', '首页');   // 默认首页标签
  renderStatus();
  const vc = $('#verChip'); if(vc) vc.textContent = 'v' + APP_VERSION;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window._installPrompt = e; });
  window.addEventListener('appinstalled', () => { window._installPrompt = null; toast('已添加到手机'); });
  if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  /* 标签页事件 */
  $('#tabs').addEventListener('click', e => {
    const x = e.target.closest('[data-close]');
    if(x){ e.stopPropagation(); closeTab(+x.dataset.close); return; }
    const tab = e.target.closest('[data-tab]');
    if(tab) activateTab(+tab.dataset.tab);
  });
  $('#tabAdd').onclick = () => { newTab('home', '首页'); toast('新建标签页'); };
  $('#stripHint').onclick = () => goHome();

  /* 左侧工作区 */
  $('#wsAdd').onclick = () => { closeDrawers(); newWorkspace(); };
  const openLib = kind => {
    const exist = S.tabs.find(t => t.kind === kind);
    if(exist) activateTab(exist.id);
    else newTab(kind, kind === 'recent' ? '最近打开' : '回收站');
    closeDrawers();
  };
  $('#navRecent').onclick = () => openLib('recent');
  $('#navTrash').onclick = () => openLib('trash');
  $('#wsList').addEventListener('click', e => {
    const b = e.target.closest('[data-ws]');
    if(b){ closeDrawers(); selectWorkspace(b.dataset.ws); }
  });
  $('#wsList').addEventListener('contextmenu', e => {
    const b = e.target.closest('[data-ws]');
    if(!b) return;
    e.preventDefault();
    openCtxWs(e.clientX, e.clientY, b.dataset.ws);
  });

  /* 弹窗 */
  $('#dlgCancel').onclick = closeDialog;
  $('#dlgOk').onclick = () => { if(dlgOkFn) dlgOkFn(); else closeDialog(); };
  $('#modal').addEventListener('click', e => { if(e.target.id === 'modal') closeDialog(); });
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && $('#modal').classList.contains('on')) closeDialog();
  });
  $('#filePick').onchange = e => {
    const f = e.target.files && e.target.files[0];
    if(f) importImage(f);
    e.target.value = '';
  };
  $('#btnSet').onclick = openSettings;
  bindBlockPreview();
  $('#btnInfo').onclick = openAbout;
  $('#dataPick').onchange = e => {
    const f = e.target.files && e.target.files[0];
    if(f) importData(f);
    e.target.value = '';
  };
  $('#stripHint').textContent = '新建标签页，或点这里回到首页';

}
init();
