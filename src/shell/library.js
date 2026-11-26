/* ---------- 当前工作区 ---------- */
function currentWS(){ return WS.find(w => w.id === S.wsId) || null; }
function cats(){ const w = currentWS(); return w ? w.cats : []; }

function findCat(id){ return cats().find(c => c.id === id) || null; }
function findCard(id){
  for(const cat of cats()){
    const i = cat.cards.findIndex(c => c.id === id);
    if(i >= 0) return { cat, card: cat.cards[i], index: i, list: cat.cards };
    for(const f of cat.cards){
      if(f.type === 'folder' && f.cards){
        const j = f.cards.findIndex(c => c.id === id);
        if(j >= 0) return { cat, folder: f, card: f.cards[j], index: j, list: f.cards };
      }
    }
  }
  return null;
}
function currentFolder(){
  if(!S.folder) return null;
  const cat = findCat(S.folder.catId);
  if(!cat){ S.folder = null; return null; }
  const f = cat.cards.find(c => c.id === S.folder.cardId);
  if(!f || !f.cards){ S.folder = null; return null; }
  return { cat, folder: f };
}
function catOpen(cat){ return S.query.trim() ? true : cat.open !== false; }
function cardCount(w){ return w.cats.reduce((n, c) => n + c.cards.length, 0); }

function sortCards(arr){
  if(S.sort === 'name') arr.sort((a,b) => a.name.localeCompare(b.name, 'zh'));
  else if(S.sort === 'type') arr.sort((a,b) => (a.badge || '').localeCompare(b.badge || ''));
  return arr;
}
function filterCards(list){
  let arr = list.slice();
  if(S.query.trim()){
    const q = S.query.trim().toLowerCase();
    arr = arr.filter(c => (c.name + ' ' + (c.badge || '')).toLowerCase().includes(q));
  }
  return sortCards(arr);
}
function catCards(cat){ return filterCards(cat.cards); }
function visibleCount(){ return cats().reduce((n, c) => n + catCards(c).length, 0); }

/* ---------------- 多选 ---------------- */
function pickCount(){ return S.picked ? S.picked.size : 0; }
function clearPicks(){
  if(S.picked) S.picked.clear();
  S.selectMode = false;
}
function setSelectMode(on){
  S.selectMode = !!on;
  if(!S.selectMode && S.picked) S.picked.clear();
  if(S.selectMode){
    const t = activeTab();
    if(!t || t.kind !== 'home') goHome();
  }
  renderContent();
  renderStatus();
  if(S.selectMode) toast('点作品多选 · 再点一次取消');
}
function togglePick(id){
  if(!S.picked) S.picked = new Set();
  if(S.picked.has(id)) S.picked.delete(id); else S.picked.add(id);
  $$('#catList .card[data-card]').forEach(el => {
    if(el.dataset.card === id){
      el.classList.toggle('picked', S.picked.has(id));
      const box = el.querySelector('.pickbox');
      if(box) box.classList.toggle('on', S.picked.has(id));
    }
  });
  updateSelBar();
  renderStatus();
}
function visiblePickIds(){
  const out = [];
  if(currentFolder()){
    filterCards(currentFolder().folder.cards).forEach(c => { if(c.type !== 'folder') out.push(c.id); });
  } else {
    cats().forEach(cat => filterCards(cat.cards).forEach(c => {
      if(c.type === 'folder'){
        if(c.cards) c.cards.forEach(x => out.push(x.id));
      } else out.push(c.id);
    }));
  }
  return out;
}
function updateSelBar(){
  const n = pickCount();
  const cnt = $('#msCount');
  if(cnt) cnt.textContent = String(n);
  const go = $('#msExport');
  if(go) go.disabled = n === 0;
  const all = $('#msAll');
  if(all) all.textContent = '全选';
}


/* ---------- 左栏工作区列表 ---------- */
function renderWorkspaces(){
  const tc = $('#trashCount');
  if(tc) tc.textContent = TRASH.length ? String(TRASH.length) : '';
  const projects = projectWorkspaces();
  const wc = $('#wsCount');
  if(wc) wc.textContent = projects.length ? String(projects.length) : '';
  const box = $('#wsList'); if(!box) return;
  box.innerHTML = projects.length ? projects.map(w => `
    <button class="nav ${w.id === S.wsId ? 'on' : ''}" data-ws="${w.id}">
      <span class="ico">${iconSVG('folder', 16)}</span>
      <span class="ws-name">${esc(w.name)}</span>
      <span class="ws-count">${cardCount(w)}</span>
    </button>`).join('') : '<div class="rail-empty">还没有工作区<br>点右上角 ＋ 新建一个</div>';
  if(typeof renderQuickRail === 'function') renderQuickRail();
}

function selectWorkspace(id){
  const w = WS.find(w => w.id === id);
  if(!w || w.assetLibrary) return;
  S.wsId = id; S.sel = null; S.folder = null; S.query = '';
  clearPicks();
  saveSoon(); renderWorkspaces();
  const t = activeTab();
  if(!t || t.kind !== 'home') goHome();
  else { renderContent(); renderStatus(); }
}
function newWorkspace(){
  askName('新建工作区', '新工作区 ' + (projectWorkspaces().length + 1), name => {
    const w = { id: uidWs(), name, cats: [{ id: uidWs(), name: '默认', open: true, cards: [] }] };
    WS.push(w);
    saveData();
    selectWorkspace(w.id);
    toast(`已新建工作区「${name}」`);
  });
}
function deleteWorkspace(w){
  confirmDialog('删除工作区', `「${w.name}」里的 ${cardCount(w)} 个内容会一起删掉，这个操作不能撤销。`, '删除', () => {
    WS = WS.filter(x => x.id !== w.id);
    if(S.wsId === w.id){ S.wsId = (projectWorkspaces()[0] || {}).id || null; clearPicks(); }
    saveData(); renderWorkspaces();
    const t = activeTab();
    if(t && t.kind === 'home') renderContent();
    renderStatus();
    toast('已删除工作区');
  });
}

/* ---------- 渲染 ---------- */
function homeHTML(){
  const ws = currentWS();
  if(!ws){
    return `<div class="welcome">
      <div class="wel-ico">${iconSVG('grid', 44)}</div>
      <h2>还没有工作区</h2>
      <p>工作区相当于一个项目 / 一个模组。建一个，然后在里面按大类别收纳贴图与动画。</p>
      <button class="btn pri" id="wsAddBig">＋ 新建工作区</button>
      ${(typeof PWExtensions === 'undefined' || PWExtensions.isEnabled('color-studio')) ? '<button class="btn" id="welColor" style="margin-left:8px">色彩拓展</button>' : ''}
    </div>`;
  }
  const list = S.query.trim() ? cats() : cats();
  return `
    <div class="content-head">
      <div class="crumbs">${currentFolder()
          ? `<a class="crumb-link" id="crumbRoot">${esc(ws.name)}</a> <span>/</span> <b>${esc(currentFolder().folder.name)}</b>`
          : `<b>${esc(ws.name)}</b>`}</div>
      <div class="tools">
        <label class="search">${iconSVG('search', 12)}
          <input id="q" placeholder="搜索…" value="${esc(S.query)}">
        </label>
        <button class="btn" id="btnSort">排序：${S.sort==='name'?'名称':S.sort==='type'?'类型':'默认'}</button>
        <button class="btn" id="btnMode">${S.mode==='grid'?'网格':'列表'}</button>
        <button class="btn ${S.selectMode?'pri':''}" id="btnSelect">${S.selectMode?'多选中':'多选'}</button>
      </div>
    </div>
    ${S.selectMode ? `<div class="ms-bar" id="msBar">
      <span class="ms-count"><b id="msCount">${pickCount()}</b> 已选</span>
      <button class="btn sm" id="msAll">全选</button>
      <button class="btn sm" id="msNone">清空</button>
      <button class="btn sm pri" id="msExport"${pickCount() ? '' : ' disabled'}>导出资源包</button>
      <button class="btn sm" id="msDone">完成</button>
    </div>` : ''}
    <div class="scroll">
      <div class="sect">
        ${currentFolder() ? '' : `<div class="cq-head">
          <h3>大类别<span class="count" id="totalCount">${cats().length}</span>
            <span class="cq-tip" id="catTip">${cardCount(ws)} 个内容</span>
          </h3>
          <button class="btn sm" id="catAdd" title="新建一个大类别">＋ 新建大类别</button>
        </div>`}
        <div id="catList">${currentFolder() ? folderHTML() : (cats().length ? cats().map(catHTML).join('') : emptyCatsHTML())}</div>
      </div>
    </div>`;
}

/* ---------------- 最近打开 / 回收站 ---------------- */
function libThumbHTML(c){
  if(c && c.thumb) return '<canvas width="16" height="16" data-swatch="1" data-src="' + c.thumb + '"></canvas>';
  return iconSVG('tex', 18);
}
function recentHTML(){
  const rows = [];
  RECENT.forEach(r => {
    const hit = findCardAnywhere(r.cardId);
    if(!hit) return;
    const c = hit.card;
    const ws = WS.find(w => w.id === r.wsId);
    rows.push('<div class="lib-row" data-open-ws="' + r.wsId + '" data-open-card="' + c.id + '">' +
      '<div class="lt">' + libThumbHTML(c) + '</div>' +
      '<div class="ln"><b>' + esc(c.name) + '</b><span>' + esc(ws ? ws.name : '（工作区已删除）') +
      ' · ' + esc(c.badge || '') + '</span></div></div>');
  });
  return '<div class="content-head"><div class="crumbs"><b>最近打开</b></div></div>' +
    '<div class="scroll"><div class="sect">' +
    (rows.length ? '<div class="lib-list">' + rows.join('') + '</div>'
                 : '<div class="lib-empty">还没有打开过任何内容</div>') +
    '</div></div>';
}
function trashHTML(){
  const rows = TRASH.map(r => {
    return '<div class="lib-row" data-trash="' + r.id + '">' +
      '<div class="lt">' + libThumbHTML(r) + '</div>' +
      '<div class="ln"><b>' + esc(r.name) + '</b><span>' + esc(r._wsName || '') +
      ' · ' + (r._at ? new Date(r._at).toLocaleDateString() : '') + '</span></div>' +
      '<div class="lb"><button class="btn sm" data-act="restore" data-id="' + r.id + '">还原</button>' +
      '<button class="btn sm" data-act="purge" data-id="' + r.id + '">彻底删除</button></div></div>';
  });
  return '<div class="content-head"><div class="crumbs"><b>回收站</b><span style="margin-left:10px;color:#7c7c7c">' + TRASH.length + ' 项</span></div></div>' +
    '<div class="scroll"><div class="sect">' +
    (rows.length ? '<div class="lib-list">' + rows.join('') + '</div>'
                 : '<div class="lib-empty">回收站是空的</div>') +
    '</div></div>';
}
function restoreTrash(id){
  const i = TRASH.findIndex(x => x.id === id); if(i < 0) return;
  const rec = TRASH[i];
  const ws = WS.find(w => w.id === rec._ws);
  if(!ws){ toast('原来的工作区已经删了，无法还原'); return; }
  let target = ws.cats.find(c => c.id === rec._cat);
  if(target && rec._folder){
    const f = target.cards.find(c => c.id === rec._folder && c.type === 'folder');
    if(f) target = f;
  }
  if(!target){
    if(!ws.cats.length) ws.cats.push({ id: uidWs(), name: '已还原', open: true, cards: [] });
    target = ws.cats[0];
  }
  const card = Object.assign({}, rec);
  delete card._ws; delete card._wsName; delete card._cat; delete card._folder; delete card._at;
  target.cards.unshift(card);
  TRASH.splice(i, 1);
  saveData();
  S.wsId = ws.id;
  renderWorkspaces(); renderContent(); renderStatus();
  toast('已还原「' + card.name + '」');
}
function purgeTrash(id){
  const i = TRASH.findIndex(x => x.id === id); if(i < 0) return;
  const name = TRASH[i].name;
  TRASH.splice(i, 1);
  saveData(); renderContent(); renderStatus();
  toast('已彻底删除「' + name + '」');
}
function bindLib(t){
  const root = $('#repoView');
  if(t.kind === 'recent'){
    root.querySelectorAll('[data-open-card]').forEach(el => el.onclick = () => {
      const wsId = el.dataset.openWs;
      if(wsId && wsId !== S.wsId){
        S.wsId = wsId; saveSoon(); renderWorkspaces();
      }
      const hit = findCardAnywhere(el.dataset.openCard);
      if(!hit){ toast('这张卡已经不在了'); renderContent(); return; }
      openCard(el.dataset.openCard);
    });
  } else {
    root.querySelectorAll('[data-act]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      if(b.dataset.act === 'restore') restoreTrash(b.dataset.id);
      else purgeTrash(b.dataset.id);
    });
  }
}

function emptyCatsHTML(){
  return `<div class="welcome small">
    <div class="wel-ico">${iconSVG('plus', 34)}</div>
    <h2>这个工作区还没有大类别</h2>
    <p>大类别可以按模组 / 用途分，比如「RPG 武器包」「建筑方块」。</p>
    <button class="btn pri" id="catAddBig">＋ 新建大类别</button>
  </div>`;
}

function folderHTML(){
  const cur = currentFolder();
  if(!cur) return '';
  const f = cur.folder;
  const cards = filterCards(f.cards);
  return `<section class="cat" data-cat="${cur.cat.id}">
    <div class="cat-head">
      <span class="cat-dot"></span>
      <span class="cat-name">${esc(f.name)}</span>
      <span class="count">${cards.length}</span>
      <span class="cat-crumb">${esc(cur.cat.name)}</span>
      <button class="cat-toggle" id="folderBack"><span>返回</span><i class="tri" style="transform:rotate(90deg)">▼</i></button>
    </div>
    <div class="grid ${S.mode==='list'?'list':''}" id="catList">
      ${cards.map(cardHTML).join('')}${S.selectMode ? '' : addCardHTML(cur.cat.id)}
    </div>
  </section>`;
}

function catHTML(cat){
  const cards = catCards(cat);
  const open = catOpen(cat);
  return `<section class="cat ${open ? '' : 'closed'}" data-cat="${cat.id}">
    <div class="cat-head">
      <span class="cat-dot"></span>
      <span class="cat-name">${esc(cat.name)}</span>
      <span class="count">${cards.length}</span>
      <button class="cat-toggle" data-cat-toggle="${cat.id}" title="展开 / 收纳">
        <span>${open ? '收起' : '展开'}</span><i class="tri">▼</i>
      </button>
    </div>
    <div class="grid ${S.mode==='list'?'list':''}">
      ${cards.map(cardHTML).join('')}${S.selectMode ? '' : addCardHTML(cat.id)}
    </div>
  </section>`;
}

function cardHTML(c){
  const isFolder = c.type === 'folder';
  if(isFolder && c.cards) c.meta = '文件夹 · ' + c.cards.length + ' 项';
  const badge = c.badge ? `<span class="badge">${esc(c.badge)}</span>` : '';
  const picked = S.selectMode && S.picked && S.picked.has(c.id);
  const pickbox = S.selectMode ? `<span class="pickbox ${picked ? 'on' : ''}" aria-hidden="true">✓</span>` : '';
  if(c.block || c.armor || c.composite){
    const isArmor = !!c.armor;
    const img = c.thumb ? `<img src="${c.thumb}" alt="" draggable="false">` : '';
    const empty = c.thumb ? '' : `<span class="thumb-empty-ico">${iconSVG(isArmor ? 'entity' : 'box',40)}</span>`;
    return `<div class="card ${S.sel===c.id?'sel':''} ${picked ? 'picked' : ''} ${S.selectMode ? 'selecting' : ''}" data-card="${c.id}" data-type="${isArmor ? 'armor' : 'block'}">
      <div class="thumb block-thumb">${img}${empty}${badge}${pickbox}</div>
      <div class="cname">${esc(c.name)}</div>
      <div class="cmeta">${esc(c.meta || '')}</div>
    </div>`;
  }
  let thumb;
  if(isFolder){
    thumb = `<div class="thumb">${iconSVG('folder', 56)}${badge}${pickbox}</div>`;
  } else if(c.thumb){
    thumb = `<div class="thumb"><canvas width="16" height="16" data-swatch="1" data-src="${c.thumb}"></canvas>${badge}${pickbox}</div>`;
  } else if(c.colors){
    thumb = `<div class="thumb"><canvas width="16" height="16" data-swatch="1"
      data-colors='${JSON.stringify(c.colors)}' data-style="${c.style || 'noise'}"
      data-seed="${hash(c.id)}"></canvas>${badge}${pickbox}</div>`;
  } else {
    thumb = `<div class="thumb empty-thumb">${badge}${pickbox}</div>`;
  }
  return `<div class="card ${S.sel===c.id?'sel':''} ${picked ? 'picked' : ''} ${S.selectMode ? 'selecting' : ''}" data-card="${c.id}" data-type="${c.type||'item'}">
    ${thumb}
    <div class="cname">${esc(c.name)}</div>
    <div class="cmeta">${esc(c.meta || '')}</div>
  </div>`;
}
function addCardHTML(catId){
  return `<div class="card add" data-add="${catId || ''}">
    <div class="thumb"><span class="add-plus">＋</span></div>
    <div class="cname">新建内容</div>
    <div class="cmeta">或拖入 PNG</div>
  </div>`;
}
function hash(s){ let h = 2166136261; for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h>>>0) % 9999 + 1; }

/* 只重画列表：搜索 / 折叠时不重建输入框 */
function refreshList(){
  const list = $('#catList'); if(!list) return;
  list.innerHTML = currentFolder() ? folderHTML() : (cats().length ? cats().map(catHTML).join('') : emptyCatsHTML());
  hydrateThumbs(list); paintIcons(list);
  const tc = $('#totalCount'); if(tc) tc.textContent = cats().length;
  const tip = $('#catTip'); if(tip) tip.textContent = cardCount(currentWS()) + ' 个内容';
  renderWorkspaces();
  renderStatus();
  saveSoon();
}

function bindHome(){
  const back = $('#folderBack'); if(back) back.onclick = () => { S.folder = null; renderContent(); };
  const crumb = $('#crumbRoot'); if(crumb) crumb.onclick = () => { S.folder = null; renderContent(); };
  if($('#catAdd')) $('#catAdd').onclick = () => newCategory();
  if($('#catAddBig')) $('#catAddBig').onclick = () => newCategory();
  if($('#wsAddBig')) $('#wsAddBig').onclick = () => newWorkspace();
  if($('#welColor')) $('#welColor').onclick = openColorStudio;
  if($('#btnSelect')) $('#btnSelect').onclick = () => setSelectMode(!S.selectMode);
  if($('#msAll')) $('#msAll').onclick = () => {
    visiblePickIds().forEach(id => S.picked.add(id));
    $$('#catList .card[data-card]').forEach(el => {
      el.classList.add('picked');
      const box = el.querySelector('.pickbox'); if(box) box.classList.add('on');
    });
    updateSelBar(); renderStatus();
  };
  if($('#msNone')) $('#msNone').onclick = () => {
    S.picked.clear();
    $$('#catList .card[data-card]').forEach(el => {
      el.classList.remove('picked');
      const box = el.querySelector('.pickbox'); if(box) box.classList.remove('on');
    });
    updateSelBar(); renderStatus();
  };
  if($('#msExport')) $('#msExport').onclick = () => {
    if(!pickCount()){ toast('先选几个作品'); return; }
    PWPack.openDialog([...S.picked]);
  };
  if($('#msDone')) $('#msDone').onclick = () => setSelectMode(false);
  updateSelBar();

  const list = $('#catList');
  if(list){
    let pressTimer = null, pressStart = null, pressCard = null, longPressAt = 0;
    const cancelPress = () => {
      clearTimeout(pressTimer);
      pressTimer = null; pressStart = null; pressCard = null;
    };
    list.addEventListener('pointerdown', e => {
      if(e.pointerType !== 'touch') return;
      const card = e.target.closest('[data-card]');
      if(!card) return;
      cancelPress();
      pressStart = {x:e.clientX, y:e.clientY};
      pressCard = card;
      pressTimer = setTimeout(() => {
        if(!pressCard) return;
        longPressAt = Date.now();
        window._pwLongPressAt = longPressAt;
        try{ navigator.vibrate && navigator.vibrate(12); }catch(_){}
        openCtx(pressStart.x, pressStart.y, pressCard.dataset.card);
        pressTimer = null;
      }, 520);
    }, {passive:true});
    list.addEventListener('pointermove', e => {
      if(!pressStart || !pressTimer) return;
      if(Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > 9) cancelPress();
    }, {passive:true});
    ['pointerup','pointercancel','pointerleave'].forEach(ev => list.addEventListener(ev, cancelPress, {passive:true}));
    list.addEventListener('click', e => {
      if(longPressAt && Date.now() - longPressAt < 750){
        e.preventDefault(); e.stopPropagation();
        longPressAt = 0;
        return;
      }
      const tgl = e.target.closest('[data-cat-toggle]');
      if(tgl){
        const cat = findCat(tgl.dataset.catToggle);
        if(cat && !S.query.trim()){ cat.open = !(cat.open !== false); refreshList(); }
        return;
      }
      const card = e.target.closest('[data-card]');
      if(S.selectMode){
        if(card) togglePick(card.dataset.card);
        return;
      }
      const add = e.target.closest('[data-add]');
      if(add){ openNewDialog(add.dataset.add); return; }
      if(!card) return;
      S.sel = card.dataset.card;
      $$('#catList .card').forEach(x => x.classList.toggle('sel', x.dataset.card === S.sel));
      renderStatus();
      const hit = findCard(card.dataset.card);
      if(hit && hit.card.block && shellMobile()) openBlockPreview(hit.card);
      if(hit && hit.card.composite && shellMobile()) openCompositePreview(hit.card);
      if(hit && hit.card.armor && shellMobile()) openArmorPreview(hit.card);
    });

    list.addEventListener('dblclick', e => {
      const card = e.target.closest('[data-card]');
      if(!card) return;
      if(S.selectMode){
        const hit = findCard(card.dataset.card);
        if(hit && hit.card.type === 'folder'){ S.folder = { catId: hit.cat.id, cardId: hit.card.id }; renderContent(); }
        return;
      }
      openCard(card.dataset.card);
    });

    list.addEventListener('contextmenu', e => {
      const card = e.target.closest('[data-card]');
      if(card){
        e.preventDefault();
        if(window._pwLongPressAt && Date.now() - window._pwLongPressAt < 900) return;
        openCtx(e.clientX, e.clientY, card.dataset.card);
        return;
      }
      const head = e.target.closest('.cat-head');
      if(head){ e.preventDefault(); openCtxCat(e.clientX, e.clientY, head.closest('.cat').dataset.cat); }
    });
  }

  if($('#q')) $('#q').addEventListener('input', e => { S.query = e.target.value; refreshList(); });
  if($('#btnSort')) $('#btnSort').addEventListener('click', () => {
    S.sort = S.sort === 'custom' ? 'name' : S.sort === 'name' ? 'type' : 'custom';
    $('#btnSort').textContent = '排序：' + (S.sort === 'name' ? '名称' : S.sort === 'type' ? '类型' : '默认');
    refreshList();
  });
  if($('#btnMode')) $('#btnMode').addEventListener('click', () => {
    S.mode = S.mode === 'grid' ? 'list' : 'grid';
    $('#btnMode').textContent = S.mode === 'grid' ? '网格' : '列表';
    refreshList();
  });
}

/* ---------- 新建大类别 ---------- */
function newCategory(){
  if(!currentWS()){ toast('先新建一个工作区'); return; }
  askName('新建大类别', '新大类别 ' + (cats().length + 1), name => {
    cats().push({ id: uidWs(), name, open: true, cards: [] });
    saveData();
    refreshList();
    toast(`已新建大类别「${name}」`);
  });
}

/* ---------------- 右键菜单 ---------------- */
function placeCtx(x, y){
  const ctx = $('#ctx');
  ctx.classList.add('on');
  const r = ctx.getBoundingClientRect();
  ctx.style.left = Math.min(x, innerWidth - r.width - 6) + 'px';
  ctx.style.top  = Math.min(y, innerHeight - r.height - 6) + 'px';
  return ctx;
}

function trashCardById(id){
  const hit = findCard(id); if(!hit) return;
  const c = hit.card;
  const rec = JSON.parse(JSON.stringify(c));
  rec._ws = currentWS() ? currentWS().id : null;
  rec._wsName = currentWS() ? currentWS().name : '';
  rec._cat = hit.cat.id;
  rec._folder = hit.folder ? hit.folder.id : null;
  rec._at = Date.now();
  TRASH.unshift(rec);
  (hit.list || hit.cat.cards).splice(hit.index, 1);
  if(S.sel === id) S.sel = null;
  if(S.picked){
    S.picked.delete(id);
    if(c.type === 'folder' && Array.isArray(c.cards)) c.cards.forEach(x => S.picked.delete(x.id));
  }
  saveData(); refreshList();
  toast(`已移入回收站：${c.name}`);
}
function openCtx(x, y, id){
  const hit = findCard(id); if(!hit) return;
  const c = hit.card;
  const ctx = $('#ctx');
  const canRecolor = (typeof PWExtensions === 'undefined' || PWExtensions.isEnabled('recolor'))
    && typeof recolorCardHasAssets === 'function' && recolorCardHasAssets(c);
  const canVariant = (typeof PWExtensions === 'undefined' || PWExtensions.isEnabled('variant-lab'))
    && typeof recolorCardHasAssets === 'function' && recolorCardHasAssets(c);
  ctx.innerHTML =
    '<button data-act="open">' + iconSVG('tex',13) + '打开</button>' +
    (canRecolor ? '<button data-act="recolor">' + iconSVG('brush',13) + '一键换色</button>' : '') +
    (canVariant ? '<button data-act="variant">' + iconSVG('shape',13) + '变种工坊</button>' : '') +
    '<button data-act="pick">' + iconSVG('select',13) + '加入多选</button>' +
    '<button data-act="ren">' + iconSVG('brush',13) + '重命名</button>' +
    '<button data-act="dup">' + iconSVG('plus',13) + '复制一份</button>' +
    '<div class="sep"></div>' +
    '<button data-act="del" class="danger">' + iconSVG('trash',13) + '删除</button>';
  placeCtx(x, y);
  ctx.onclick = e => {
    const btn = e.target.closest('[data-act]'); if(!btn) return;
    const act = btn.dataset.act;
    ctx.classList.remove('on');
    if(act === 'open') openCard(id);
    if(act === 'recolor') openRecolorTool(c.id);
    if(act === 'variant') openVariantLab(c.id);
    if(act === 'pick'){
      if(!S.selectMode) setSelectMode(true);
      if(!S.picked.has(c.id)) togglePick(c.id);
    }
    if(act === 'ren') askName('重命名', c.name, v => { c.name = v; saveData(); refreshList(); toast('已重命名'); });
    if(act === 'dup'){
      const copy = JSON.parse(JSON.stringify(c));
      copy.id = c.id + '_c' + Date.now();
      copy.name = c.name + ' 副本';
      copy.meta = '刚刚 · 副本';
      (hit.list || hit.cat.cards).splice(hit.index + 1, 0, copy);
      saveData(); refreshList(); toast('已复制一份');
    }
    if(act === 'del') trashCardById(id);
  };
}

function openCtxCat(x, y, id){
  const cat = findCat(id); if(!cat) return;
  const ctx = $('#ctx');
  ctx.innerHTML =
    '<button data-act="new">' + iconSVG('plus',13) + '在此新建</button>' +
    '<button data-act="ren">' + iconSVG('brush',13) + '重命名大类别</button>' +
    '<div class="sep"></div>' +
    '<button data-act="del" class="danger">' + iconSVG('trash',13) + '删除大类别</button>';
  placeCtx(x, y);
  ctx.onclick = e => {
    const btn = e.target.closest('[data-act]'); if(!btn) return;
    const act = btn.dataset.act;
    ctx.classList.remove('on');
    if(act === 'new') openNewDialog(cat.id);
    if(act === 'ren') askName('重命名大类别', cat.name, v => { cat.name = v; saveData(); refreshList(); });
    if(act === 'del'){
      const arr = cats();
      if(arr.length <= 1){ toast('至少留一个大类别'); return; }
      arr.splice(arr.indexOf(cat), 1);
      saveData(); refreshList(); toast(`已删除大类别「${cat.name}」`);
    }
  };
}

function openCtxWs(x, y, id){
  const w = WS.find(v => v.id === id); if(!w) return;
  const ctx = $('#ctx');
  ctx.innerHTML =
    '<button data-act="ren">' + iconSVG('brush',13) + '重命名工作区</button>' +
    '<button data-act="newcat">' + iconSVG('plus',13) + '新建大类别</button>' +
    '<div class="sep"></div>' +
    '<button data-act="del" class="danger">' + iconSVG('trash',13) + '删除工作区</button>';
  placeCtx(x, y);
  ctx.onclick = e => {
    const btn = e.target.closest('[data-act]'); if(!btn) return;
    const act = btn.dataset.act;
    ctx.classList.remove('on');
    if(act === 'ren') askName('重命名工作区', w.name, v => { w.name = v; saveData(); renderWorkspaces(); renderContent(); });
    if(act === 'newcat'){ selectWorkspace(w.id); newCategory(); }
    if(act === 'del') deleteWorkspace(w);
  };
}

document.addEventListener('click', e => {
  if(!e.target.closest('#ctx')) $('#ctx').classList.remove('on');
});

/* ---------------- 缩略图与图像入库 ---------------- */
function makeThumbDataURL(src, srcW, srcH){
  const iw = srcW || src.naturalWidth || src.width || 16;
  const ih = srcH || src.naturalHeight || src.height || 16;
  const tc = document.createElement('canvas'); tc.width = tc.height = 16;
  const tg = tc.getContext('2d'); tg.imageSmoothingEnabled = false;
  tg.clearRect(0, 0, 16, 16);
  const sc = Math.min(16 / Math.max(1, iw), 16 / Math.max(1, ih));
  const dw = Math.max(1, Math.round(iw * sc)), dh = Math.max(1, Math.round(ih * sc));
  tg.drawImage(src, 0, 0, iw, ih, Math.floor((16 - dw) / 2), Math.floor((16 - dh) / 2), dw, dh);
  return tc.toDataURL('image/png');
}

function createCardFromImageElement(fileName, img, opts){
  opts = opts || {};
  if(!currentWS()){ toast('先新建一个工作区'); return null; }
  const iw = img.naturalWidth || img.width || 16;
  const ih = img.naturalHeight || img.height || 16;
  const cap = 2048;
  const sc = Math.min(1, cap / Math.max(iw, ih));
  const fw = Math.max(1, Math.round(iw * sc));
  const fh = Math.max(1, Math.round(ih * sc));
  const fc = document.createElement('canvas');
  fc.width = fw; fc.height = fh;
  const fg = fc.getContext('2d'); fg.imageSmoothingEnabled = false;
  fg.drawImage(img, 0, 0, fw, fh);
  const full = fc.toDataURL('image/png');

  const isAnimStrip = (opts.anim !== false) && (fh > fw) && (fh % fw === 0) && (fw <= 256);
  const frames = isAnimStrip ? Math.round(fh / fw) : 1;
  const frameH = isAnimStrip ? fw : fh;
  const thumb = makeThumbDataURL(fc, fw, frameH);
  const baseName = String(fileName || '图像').replace(/\.[a-z0-9]+$/i, '') || '图像';
  const card = {
    id: 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2,5),
    name: baseName,
    meta: (frames > 1 ? (fw + '×' + frameH + ' · ' + frames + ' 帧') : (fw + '×' + fh)) + ' · 刚刚',
    badge: frames > 1 ? '动画' : '纹理',
    anim: frames > 1,
    texSize: { w: fw, h: frameH, frames },
    thumb, full
  };
  if(!cats().length) cats().push({ id: uidWs(), name: '默认', open: true, cards: [] });
  cats()[0].cards.unshift(card);
  if(!opts.stayCurrent){
    S.folder = null; S.query = '';
  }
  saveData();
  if($('#catList')) refreshList();
  if(opts.openEdit){
    touchRecent(card);
    newTab(card.anim ? 'anim' : 'tex', card.name, card);
  }
  return card;
}

function handleEditorLoadImageAction(d){
  if(!d || !d.dataURL) return;
  const img = new Image();
  img.onload = () => {
    const isEdit = d.action === 'edit';
    const card = createCardFromImageElement(d.name || 'image.png', img, {
      stayCurrent: !isEdit,
      openEdit: isEdit
    });
    if(card && !isEdit){
      toast('已增添到当前工作区：' + card.name);
    }
  };
  img.onerror = () => toast('图像读取失败');
  img.src = d.dataURL;
}

function findTargetTextureEditorTab(){
  const ok = x => x && x._frame && (x.kind === 'tex' || x.kind === 'ctex' || x.kind === 'anim');
  const a = activeTab();
  if(ok(a)) return a;
  if(typeof S !== 'undefined' && S.lastEditor){
    const last = S.tabs.find(x => x.id === S.lastEditor && ok(x));
    if(last) return last;
  }
  return (typeof S !== 'undefined' && Array.isArray(S.tabs))
    ? S.tabs.slice().reverse().find(ok)
    : null;
}

function openShellLoadImageModal(fileName, dataURL, img){
  const iw = img.naturalWidth || img.width || 16;
  const ih = img.naturalHeight || img.height || 16;
  const edTab = findTargetTextureEditorTab();
  $('#dlgTitle').innerHTML = iconSVG('tex', 14) + '加载图像';
  $('#dlgBody').innerHTML =
    '<div class="li-head">' +
      '<div class="li-thumb"><canvas id="shLiThumb" width="50" height="50"></canvas></div>' +
      '<div class="li-meta">' +
        '<div class="li-name">' + esc(fileName || 'image.png') + '</div>' +
        '<div class="li-dim">' + iw + ' × ' + ih + ' 像素</div>' +
      '</div>' +
    '</div>' +
    '<div class="li-sec">添加到项目</div>' +
    '<div class="li-list">' +
      '<button type="button" class="li-item" id="shLiLayer"' + (edTab ? '' : ' disabled') + '>' +
        '<span class="li-ico">' + iconSVG('tex', 15) + '</span>' +
        '<span class="li-txt"><b>作为图层添加</b><span>' + (edTab ? '添加到已打开的「' + esc(edTab.title) + '」新图层' : '需先打开一个纹理或动画标签页') + '</span></span>' +
        '<span class="li-arr">›</span>' +
      '</button>' +
      '<button type="button" class="li-item" id="shLiRef"' + (edTab ? '' : ' disabled') + '>' +
        '<span class="li-ico">' + iconSVG('shape', 15) + '</span>' +
        '<span class="li-txt"><b>参考图像</b><span>' + (edTab ? '载入「' + esc(edTab.title) + '」的参考画布与调色盘' : '需先打开一个纹理或动画标签页') + '</span></span>' +
        '<span class="li-arr">›</span>' +
      '</button>' +
      '<button type="button" class="li-item" id="shLiAdd">' +
        '<span class="li-ico">' + iconSVG('plus', 15) + '</span>' +
        '<span class="li-txt"><b>增添图像</b><span>作为新卡片存入当前工作区仓库（留在当前视图）</span></span>' +
        '<span class="li-arr">›</span>' +
      '</button>' +
    '</div>' +
    '<div class="li-sec">新建项目</div>' +
    '<div class="li-list">' +
      '<button type="button" class="li-item" id="shLiEdit">' +
        '<span class="li-ico">' + iconSVG('brush', 15) + '</span>' +
        '<span class="li-txt"><b>编辑图像</b><span>按原始尺寸创建新卡片并立即打开编辑</span></span>' +
        '<span class="li-arr">›</span>' +
      '</button>' +
    '</div>';

  const tc = $('#shLiThumb');
  if(tc){
    const tg = tc.getContext('2d'); tg.imageSmoothingEnabled = false;
    const sc = Math.min(tc.width / Math.max(1, iw), tc.height / Math.max(1, ih));
    const dw = Math.max(1, Math.round(iw * sc)), dh = Math.max(1, Math.round(ih * sc));
    tg.drawImage(img, Math.floor((tc.width - dw) / 2), Math.floor((tc.height - dh) / 2), dw, dh);
  }
  dlgOkFn = null;
  if($('#dlgOk')) $('#dlgOk').style.display = 'none';
  if($('#dlgCancel')){ $('#dlgCancel').style.display = ''; $('#dlgCancel').textContent = '关闭'; }
  $('#modal').classList.add('on');
  paintIcons($('#modal'));

  if($('#shLiLayer') && edTab){
    $('#shLiLayer').onclick = () => {
      closeDialog();
      try{
        const w = edTab._frame.contentWindow;
        const im = new w.Image();
        im.onload = () => {
          w.importAsLayer(im, { fitMode: (iw > w.doc.w || ih > w.doc.h) ? 'expand' : 'keep', allFrames: true, name: String(fileName || '导入图层').replace(/\.[a-z0-9]+$/i, '') });
          activateTab(edTab.id);
          toast('已作为图层添加到「' + edTab.title + '」');
        };
        im.src = dataURL;
      }catch(e){ toast('添加图层失败'); }
    };
  }
  if($('#shLiRef') && edTab){
    $('#shLiRef').onclick = () => {
      closeDialog();
      try{
        const w = edTab._frame.contentWindow;
        if(typeof w.rpLoadImage === 'function'){
          w.rpLoadImage(dataURL, fileName || '参考图', null, { w: iw, h: ih });
          if(typeof w.rpCenterShow === 'function') w.rpCenterShow(true);
          activateTab(edTab.id);
          toast('已载入为参考图像：' + fileName);
        }
      }catch(e){ toast('载入参考图失败'); }
    };
  }
  if($('#shLiAdd')){
    $('#shLiAdd').onclick = () => {
      closeDialog();
      const card = createCardFromImageElement(fileName, img, { stayCurrent: true, openEdit: false });
      if(card){
        const t = activeTab();
        if(t && t.kind === 'home') renderContent();
        toast('已增添到当前工作区：' + card.name + '（' + iw + '×' + ih + '）');
      }
    };
  }
  if($('#shLiEdit')){
    $('#shLiEdit').onclick = () => {
      closeDialog();
      createCardFromImageElement(fileName, img, { stayCurrent: false, openEdit: true });
    };
  }
}

/* ---------------- 导入图片 ---------------- */
function importImage(file){
  if(!file || (!/^image\//.test(file.type) && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name || ''))){ toast('只支持图片文件'); return; }
  if(!currentWS()){ toast('先新建一个工作区'); return; }
  const fr = new FileReader();
  fr.onload = () => {
    const dataURL = String(fr.result || '');
    const img = new Image();
    img.onload = () => openShellLoadImageModal(file.name || 'image.png', dataURL, img);
    img.onerror = () => toast('这个文件读不出来');
    img.src = dataURL;
  };
  fr.onerror = () => toast('文件读取失败');
  fr.readAsDataURL(file);
}

/* ---------------- 拖拽 ---------------- */
let dragDepth = 0;
function showDrop(on){ $('#drop').classList.toggle('on', on); }
window.addEventListener('dragenter', e => {
  if(!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
  dragDepth++; showDrop(true);
});
window.addEventListener('dragover', e => {
  if(e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault();
});
window.addEventListener('dragleave', e => {
  if(!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if(!dragDepth) showDrop(false);
});
window.addEventListener('drop', e => {
  if(!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
  e.preventDefault(); dragDepth = 0; showDrop(false);
  importImage(e.dataTransfer.files[0]);
});

function touchRecent(card){
  if(!card) return;
  RECENT = RECENT.filter(r => !(r.wsId === S.wsId && r.cardId === card.id));
  RECENT.unshift({ wsId:S.wsId, cardId:card.id, at:Date.now() });
  if(RECENT.length > 40) RECENT.length = 40;
  saveSoon();
}

function openCard(id){
  const hit = findCard(id); if(!hit) return;
  const c = hit.card;
  if(S.selectMode) clearPicks();
  touchRecent(c);
  if(typeof renderQuickRail === 'function') renderQuickRail();
  if(c.type === 'folder'){
    S.folder = { catId: hit.cat.id, cardId: c.id };
    S.query = '';
    renderContent();
    return;
  }
  if(c.model){ toast('模型编辑器已经移除（原型保留在 model_studio.html）'); return; }
  if(c.create && typeof PWPlugins !== 'undefined'){
    PWPlugins.openTool(c.create.pluginId || 'create-texture', c.create.toolId || 'create-blocks', { cardId:c.id });
    return;
  }
  if(c.composite){ openCompositePreview(c); return; }
  if(c.block){ openBlockPreview(c); return; }
  if(c.armor){ openArmorPreview(c); return; }
  if(c.ctex){ newTab('ctex', c.name, c); return; }
  newTab(c.anim ? 'anim' : 'tex', c.name, c);
}

