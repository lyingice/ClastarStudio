/* ============================================================
   素材库：原版 / 模组纹理参考
   - 数据放在隐藏的 assetLibrary 工作区，不进入项目工作区列表
   - 现有仓库素材选择器会自动读取
   ============================================================ */
const PWAssets = (() => {
  const WS_NAME = '素材库';
  const GROUPS = ['原版', '模组', '本地'];
  const CAT_LABEL = {
    block:'方块', item:'物品', entity:'实体', equipment:'实体装备', gui:'界面',
    particle:'粒子', painting:'画', environment:'环境', font:'字体', effect:'效果',
    misc:'杂项', models:'模型', textures:'纹理', other:'其他',
    trims:'盔甲纹饰', mob_effect:'状态效果', map:'地图', colormap:'着色地图'
  };
  let page = null;
  let localCatalog = null;
  let localCache = null;
  let localPromise = null;
  const CAT_RANK = { block:0, item:1, entity:2, particle:3, trims:4, painting:5, environment:6, effect:7, mob_effect:8, gui:9, map:10, colormap:11, models:12, misc:13, font:14, other:15 };
  let state = { query:'', group:'全部', ns:'全部', cat:'全部', fav:false, sort:'name', selected:null };

  function ensureWorkspace(){
    let w = WS.find(x => x.assetLibrary);
    if(!w){
      w = { id:'assets-' + Date.now().toString(36), name:WS_NAME, assetLibrary:true, cats:[] };
      WS.push(w);
    }
    GROUPS.forEach(name => {
      if(!w.cats.some(c => c.name === name)) w.cats.push({ id:uidWs(), name, open:true, cards:[] });
    });
    return w;
  }
  function workspace(){ return ensureWorkspace(); }
  function localCards(){
    if(localCache) return localCache;
    const items = localCatalog && Array.isArray(localCatalog.items) ? localCatalog.items : [];
    localCache = items.map(item => ({
      card:{
        id:'vanilla:' + item.path,
        name:item.name,
        meta:'原版 · ' + item.width + '×' + item.height + ' · ' + (CAT_LABEL[item.category] || item.category),
        badge:'原版', type:'item', local:true,
        thumb:item.url, full:item.url,
        ref:{
          namespace:'minecraft', path:item.path, category:item.category, group:'原版',
          source:item.source || ('Minecraft ' + (localCatalog.version || '') + ' · 本地内容包'),
          width:item.width, height:item.height, addedAt:0, favorite:false,
          mcmeta:item.mcmeta || null, localURL:item.url
        }
      },
      cat:{ name:'原版' }
    }));
    return localCache;
  }
  function allCards(){
    const out = [];
    const w = WS.find(x => x.assetLibrary);
    if(w) w.cats.forEach(cat => cat.cards.forEach(c => { if(c && c.ref && c.type !== 'folder') out.push({ card:c, cat }); }));
    return out.concat(localCards());
  }
  async function ensureLocal(){
    if(localPromise) return localPromise;
    localPromise = fetch('local/vanilla/catalog.json', { cache:'no-store' })
      .then(res => {
        if(!res.ok) return null;
        return res.json();
      })
      .then(d => {
        if(d && Array.isArray(d.items)){
          localCatalog = d;
          localCache = null;
        }
        return localCatalog;
      })
      .catch(() => null)
      .finally(() => {
        if(page) render(page);
      });
    return localPromise;
  }
  function init(){ ensureLocal(); }
  function cardById(id){ return allCards().find(x => x.card.id === id) || null; }
  function groupOf(ref){ return ref.group || (ref.namespace === 'minecraft' ? '原版' : ref.namespace === 'local' ? '本地' : '模组'); }

  function open(){
    if(typeof PWExtensions !== 'undefined' && !PWExtensions.isEnabled('asset-library')){
      toast('「素材库」已在设置里关闭'); return;
    }
    ensureWorkspace();
    const exist = S.tabs.find(t => t.kind === 'assets');
    if(exist){ activateTab(exist.id); return; }
    newTab('assets', '素材库');
  }

  function pageHTML(){
    return `
    <div class="asset-page">
      <div class="content-head rec-head">
        <div class="crumbs"><b>素材库</b><span>原版 / 模组纹理 · 作为参考图或导入仓库</span></div>
        <div class="tools">
          <button class="btn sm" id="asPng">导入 PNG</button>
          <button class="btn sm" id="asZip">导入 ZIP / JAR</button>
          <button class="btn sm" id="asDir">导入文件夹</button>
          <button class="btn sm" id="asLocalHelp" title="本地原版内容包说明">本地素材说明</button>
        </div>
      </div>
      <div class="scroll as-scroll">
        <div class="as-layout">
          <aside class="as-side">
            <div class="as-summary" id="asSummary"></div>
            <div class="as-block">
              <h3>来源</h3>
              <div class="as-groups" id="asGroups"></div>
            </div>
            <div class="as-block">
              <label class="as-field">命名空间<select id="asNs"><option value="全部">全部</option></select></label>
              <label class="as-field">分类<select id="asCat"><option value="全部">全部</option></select></label>
              <label class="as-field">排序<select id="asSort">
                <option value="name">名称</option><option value="recent">最近导入</option><option value="size">尺寸</option>
              </select></label>
            </div>
            <div class="as-tip">导入 vanilla / mod 的 jar 或资源包 ZIP 后，会按 <code>assets/&lt;namespace&gt;/textures</code> 自动归类。素材库不会出现在项目工作区列表里。</div>
          </aside>
          <main class="as-main">
            <div class="as-toolbar">
              <label class="search as-search">${iconSVG('search',12)}<input id="asSearch" placeholder="搜索名称 / 路径 / 命名空间…" autocomplete="off"></label>
              <label class="as-fav"><input type="checkbox" id="asFav"> 只看收藏</label>
              <span id="asCount" class="as-count"></span>
            </div>
            <div class="as-grid" id="asGrid"></div>
          </main>
          <aside class="as-detail" id="asDetail">
            <div class="as-detail-empty">选一张素材查看详情<br><span>可直接设为编辑器参考图</span></div>
          </aside>
        </div>
      </div>
      <div class="as-importing" id="asImporting" hidden>
        <div><b>正在导入素材…</b><span id="asProgress">准备中</span><div class="as-bar"><i id="asBar"></i></div></div>
      </div>
      <input type="file" id="asFilePng" accept="image/*" multiple hidden>
      <input type="file" id="asFileZip" accept=".zip,.jar,application/zip,application/java-archive" hidden>
      <input type="file" id="asFileDir" webkitdirectory directory multiple accept="image/*" hidden>
    </div>`;
  }

  function mount(t, host){
    ensureWorkspace();
    const pane = document.createElement('div');
    pane.className = 'ed-pane asset-pane on';
    pane.dataset.tab = t.id;
    pane.innerHTML = pageHTML();
    host.appendChild(pane);
    t._pane = pane;
    page = pane;
    bind(pane);
    render(pane);
    ensureLocal().then(() => render(pane));
  }

  function bind(pane){
    const q = s => pane.querySelector(s);
    q('#asPng').onclick = () => q('#asFilePng').click();
    q('#asLocalHelp').onclick = () => showLocalPackHelp('vanilla');
    q('#asZip').onclick = () => q('#asFileZip').click();
    q('#asDir').onclick = () => q('#asFileDir').click();
    q('#asFilePng').onchange = async e => {
      const files = [...(e.target.files || [])];
      e.target.value = '';
      if(files.length) await importLoose(files);
    };
    q('#asFileZip').onchange = async e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if(f) await importArchive(f);
    };
    q('#asFileDir').onchange = async e => {
      const files = [...(e.target.files || [])].filter(f => /^image\//.test(f.type));
      e.target.value = '';
      if(files.length) await importLoose(files);
    };
    q('#asSearch').addEventListener('input', e => { state.query = e.target.value; render(pane); });
    q('#asFav').addEventListener('change', e => { state.fav = e.target.checked; render(pane); });
    q('#asNs').addEventListener('change', e => { state.ns = e.target.value; render(pane); });
    q('#asCat').addEventListener('change', e => { state.cat = e.target.value; render(pane); });
    q('#asSort').addEventListener('change', e => { state.sort = e.target.value; render(pane); });
    q('#asGroups').addEventListener('click', e => {
      const b = e.target.closest('[data-group]'); if(!b) return;
      state.group = b.dataset.group; render(pane);
    });
    q('#asGrid').addEventListener('click', e => {
      const c = e.target.closest('[data-asset]'); if(!c) return;
      state.selected = c.dataset.asset;
      renderDetail(pane);
      q('#asGrid').querySelectorAll('[data-asset]').forEach(x => x.classList.toggle('on', x.dataset.asset === state.selected));
    });
    q('#asGrid').addEventListener('dblclick', e => {
      const c = e.target.closest('[data-asset]'); if(!c) return;
      state.selected = c.dataset.asset; renderDetail(pane); useAsReference(c.dataset.asset);
    });
    q('#asDetail').addEventListener('click', e => {
      const b = e.target.closest('[data-as-act]'); if(!b) return;
      const act = b.dataset.asAct;
      if(act === 'ref') useAsReference(state.selected);
      else if(act === 'copy') copyToProject(state.selected);
      else if(act === 'path') copyPath(state.selected);
      else if(act === 'fav') toggleFavorite(state.selected, pane);
      else if(act === 'del') deleteAsset(state.selected, pane);
    });
    page.addEventListener('dragover', e => {
      if(e.dataTransfer && [...e.dataTransfer.types].includes('Files')){ e.preventDefault(); e.stopPropagation(); page.classList.add('drop-on'); }
    }, true);
    page.addEventListener('dragleave', e => { if(e.target === page) page.classList.remove('drop-on'); }, true);
    page.addEventListener('drop', async e => {
      if(!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault(); e.stopPropagation(); page.classList.remove('drop-on');
      const files=[...e.dataTransfer.files];
      const archives=files.filter(f => /\.(zip|jar)$/i.test(f.name) || /zip|java-archive/.test(f.type));
      const images=files.filter(f => /^image\//.test(f.type));
      for(const a of archives) await importArchive(a);
      if(images.length) await importLoose(images);
    }, true);
  }

  function render(pane){
    if(!pane) return;
    const cards = allCards();
    const q = pane.querySelector('#asSummary');
    const total = cards.length;
    const localCount = cards.filter(x => x.card.local).length;
    const bytes = cards.reduce((n,x) => n + (x.card.local ? 0 : (x.card.full ? x.card.full.length : 0)), 0);
    const summaryBits = [];
    if(localCount) summaryBits.push(localCount + ' 原版引用（本地）');
    if(bytes) summaryBits.push((bytes/1024/1024).toFixed(1) + ' MB 本地数据');
    if(q) q.innerHTML = `<b>${total}</b> 张素材<span>${summaryBits.join(' · ') || '本地素材库'}</span>`;
    const counts = {全部:total, 原版:0, 模组:0, 本地:0, 收藏:0};
    cards.forEach(x => {
      const g=groupOf(x.card.ref); counts[g]=(counts[g]||0)+1;
      if(x.card.ref.favorite) counts.收藏++;
    });
    const gb = pane.querySelector('#asGroups');
    if(gb) gb.innerHTML = ['全部','原版','模组','本地','收藏'].map(g =>
      `<button class="as-group${state.group===g?' on':''}" data-group="${g}">${g}<em>${counts[g]||0}</em></button>`).join('');
    const nsSel=pane.querySelector('#asNs'), catSel=pane.querySelector('#asCat');
    if(nsSel){
      const old=state.ns;
      const names=[...new Set(cards.map(x=>x.card.ref.namespace||'local'))].sort();
      nsSel.innerHTML='<option value="全部">全部</option>'+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
      nsSel.value = names.includes(old)||old==='全部'?old:'全部'; state.ns=nsSel.value;
    }
    if(catSel){
      const old=state.cat;
      const cs=[...new Set(cards.map(x=>x.card.ref.category||'other'))].sort();
      catSel.innerHTML='<option value="全部">全部</option>'+cs.map(c=>`<option value="${esc(c)}">${esc(CAT_LABEL[c]||c)}</option>`).join('');
      catSel.value = cs.includes(old)||old==='全部'?old:'全部'; state.cat=catSel.value;
    }
    const list=filtered(cards);
    const grid=pane.querySelector('#asGrid');
    const count=pane.querySelector('#asCount');
    if(count) count.textContent=cards.length ? `${list.length} / ${cards.length}` : '';
    if(grid){
      if(!list.length){
        grid.innerHTML = `<div class="as-empty"><b>素材库还是空的</b><span>拖入 PNG、vanilla / mod 的 jar，或资源包 ZIP。<br>导入后可以查看、收藏，或在编辑器里作为参考图。</span></div>`;
      }else{
        grid.innerHTML=list.map(x=>{
          const c=x.card, r=c.ref;
          const anim=r.mcmeta?'<i class="as-badge anim">动画</i>':'';
          const fav=r.favorite?'<i class="as-badge fav">★</i>':'';
          return `<button class="as-card${state.selected===c.id?' on':''}" data-asset="${c.id}" title="${esc(c.name+' · '+(r.namespace||'local')+'/'+(r.path||''))}">
            <span class="as-thumb"><img src="${c.full || c.thumb}" alt="" loading="lazy"></span>
            <span class="as-name">${esc(c.name)}</span>
            <span class="as-meta">${esc(r.namespace||'local')} · ${esc(CAT_LABEL[r.category]||r.category||'其他')}</span>
            ${anim}${fav}
          </button>`;
        }).join('');
      }
    }
    renderDetail(pane);
    paintIcons(page);
  }
  function filtered(cards){
    const q=state.query.trim().toLowerCase();
    return cards.map(x=>x).filter(x=>{
      const c=x.card, r=c.ref;
      if(state.group==='收藏' && !r.favorite) return false;
      if(state.group!=='全部' && state.group!=='收藏' && groupOf(r)!==state.group) return false;
      if(state.ns!=='全部' && (r.namespace||'local')!==state.ns) return false;
      if(state.cat!=='全部' && (r.category||'other')!==state.cat) return false;
      if(state.fav && !r.favorite) return false;
      if(q && !(c.name+' '+(r.path||'')+' '+(r.namespace||'')+' '+(CAT_LABEL[r.category]||r.category||'')).toLowerCase().includes(q)) return false;
      return true;
    }).sort((a,b)=>{
      if(state.sort==='recent') return (b.card.ref.addedAt||0)-(a.card.ref.addedAt||0);
      if(state.sort==='size') return (b.card.ref.width||0)*(b.card.ref.height||0)-(a.card.ref.width||0)*(a.card.ref.height||0);
      if(a.card.local || b.card.local){
        const ca=CAT_RANK[a.card.ref.category] ?? 99, cb=CAT_RANK[b.card.ref.category] ?? 99;
        if(ca !== cb) return ca-cb;
      }
      return String(a.card.name).localeCompare(String(b.card.name),'zh');
    });
  }
  function renderDetail(pane){
    const box=pane && pane.querySelector('#asDetail');
    if(!box) return;
    const hit=state.selected?cardById(state.selected):null;
    if(!hit){ box.innerHTML='<div class="as-detail-empty">选一张素材查看详情<br><span>可直接设为编辑器参考图</span></div>'; return; }
    const c=hit.card, r=c.ref;
    box.innerHTML = `
      <div class="as-preview"><img src="${c.full || c.thumb}" alt=""></div>
      <h3>${esc(c.name)}</h3>
      <div class="as-detail-meta">
        <div><span>来源</span><b>${esc(groupOf(r))}</b></div>
        <div><span>命名空间</span><b>${esc(r.namespace||'local')}</b></div>
        <div><span>分类</span><b>${esc(CAT_LABEL[r.category]||r.category||'其他')}</b></div>
        <div><span>尺寸</span><b>${r.width||'?'} × ${r.height||'?'}</b></div>
        <div><span>路径</span><b title="${esc(r.path||'')}">${esc(r.path||'')}</b></div>
        ${r.source?`<div><span>来源包</span><b title="${esc(r.source)}">${esc(r.source)}</b></div>`:''}
        ${r.mcmeta?'<div><span>动画</span><b>有 .mcmeta</b></div>':''}
      </div>
      <div class="as-detail-actions">
        <button class="btn pri" data-as-act="ref">设为参考图</button>
        <button class="btn" data-as-act="copy">复制到工作区</button>
        <button class="btn sm" data-as-act="path">复制路径</button>
        ${c.local ? '<span class="as-local-note">本地原版资产 · 不随 GitHub 上传</span>' : `<button class="btn sm" data-as-act="fav">${r.favorite?'取消收藏':'收藏'}</button><button class="btn sm danger" data-as-act="del">删除</button>`}
      </div>
      <p class="as-detail-tip">双击素材可直接设为参考图。参考图会进入当前/最近一次动画编辑器的「参考图」面板。</p>`;
  }

  /* ---------------- 导入 ---------------- */
  async function importLoose(files){
    const w=workspace();
    showImport(true, `准备导入 ${files.length} 张 PNG…`);
    let added=0, dup=0, failed=0, done=0;
    for(const file of files){
      try{
        const im=await imageOfFile(file);
        const rec=encodeImage(im, 256);
        const name=file.name.replace(/\.[^.]+$/,'');
        const path='local/'+file.name;
        if(exists(w,'local',path)){ dup++; }
        else{
          addCard(w,'本地',{
            id:'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
            name, meta:rec.w+'×'+rec.h+' · 本地', badge:'素材', type:'item',
            thumb:rec.thumb, full:rec.full,
            ref:{namespace:'local',path,category:'other',group:'本地',source:file.name,width:rec.w,height:rec.h,addedAt:Date.now(),favorite:false}
          });
          added++;
        }
      }catch(_){ failed++; }
      done++;
      updateImport(done, files.length, `已处理 ${done}/${files.length}`);
    }
    saveData();
    showImport(false);
    render(page);
    toast(`素材库：新增 ${added}，重复 ${dup}${failed?'，失败 '+failed:''}`);
  }

  async function importArchive(file){
    showImport(true, `读取 ${file.name}…`);
    let entries;
    try{ entries=await PWArchive.read(file); }
    catch(err){ showImport(false); toast('ZIP 读取失败：'+err.message); return; }
    const metaMap=new Map();
    for(const e of entries){
      if(e.dir || !/\.png\.mcmeta$/i.test(e.name)) continue;
      try{ metaMap.set(e.name.replace(/\.mcmeta$/i,''), JSON.parse(new TextDecoder().decode(await e.data()))); }catch(_){}
    }
    const images=entries.filter(e => !e.dir && /\.png$/i.test(e.name) && !/^__MACOSX\//i.test(e.name) && !/(^|\/)pack\.png$/i.test(e.name));
    if(!images.length){ showImport(false); toast('压缩包里没有 PNG 纹理'); return; }
    const cap=1200;
    if(images.length>cap) toast(`包里有 ${images.length} 张 PNG，本次只导入前 ${cap} 张`);
    const list=images.slice(0,cap);
    const w=workspace();
    let added=0,dup=0,failed=0,done=0;
    for(const e of list){
      try{
        const path=e.name.replace(/\\/g,'/');
        const cls=classify(path);
        if(exists(w,cls.namespace,path)){ dup++; }
        else{
          const blob=new Blob([await e.data()],{type:'image/png'});
          const im=await imageOfBlob(blob);
          const rec=encodeImage(im, 256);
          const card={
            id:'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
            name:path.split('/').pop().replace(/\.png$/i,''),
            meta:`${rec.w}×${rec.h} · ${cls.namespace} · ${CAT_LABEL[cls.category]||cls.category}`,
            badge:'素材', type:'item', thumb:rec.thumb, full:rec.full,
            ref:{namespace:cls.namespace,path,category:cls.category,group:cls.group,source:file.name,width:rec.w,height:rec.h,addedAt:Date.now(),favorite:false,mcmeta:metaMap.get(path)||null}
          };
          addCard(w,cls.group,card);
          added++;
        }
      }catch(_){ failed++; }
      done++;
      if(done%5===0 || done===list.length) updateImport(done,list.length,`正在导入 ${done}/${list.length}`);
      if(done%3===0) await new Promise(r=>requestAnimationFrame(r));
    }
    saveData();
    showImport(false);
    render(page);
    toast(`素材库：新增 ${added}，重复 ${dup}${failed?'，失败 '+failed:''}`);
  }

  function classify(path){
    const m=/^assets\/([^/]+)\/textures\/(.+)$/i.exec(path);
    if(m){
      const namespace=m[1], rel=m[2];
      const category=(rel.split('/')[0]||'other').toLowerCase();
      return {namespace,category,group:namespace==='minecraft'?'原版':'模组'};
    }
    return {namespace:'local',category:'other',group:'本地'};
  }
  function exists(w,namespace,path){
    return w.cats.some(cat => cat.cards.some(c => c.ref && c.ref.namespace===namespace && c.ref.path===path));
  }
  function addCard(w,groupName,card){
    let cat=w.cats.find(c=>c.name===groupName);
    if(!cat){ cat={id:uidWs(),name:groupName,open:true,cards:[]}; w.cats.push(cat); }
    cat.cards.unshift(card);
  }
  function imageOfFile(file){ return imageOfBlob(file); }
  function imageOfBlob(blob){
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(blob); const im=new Image();
      im.onload=()=>{ URL.revokeObjectURL(url); resolve(im); };
      im.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error('图片读取失败')); };
      im.src=url;
    });
  }
  function encodeImage(im,cap){
    const w=im.naturalWidth||im.width, h=im.naturalHeight||im.height;
    const tcap=96;
    const ts=Math.min(1, tcap/Math.max(w,h));
    const tw=Math.max(1,Math.round(w*ts)), th=Math.max(1,Math.round(h*ts));
    const tc=document.createElement('canvas'); tc.width=tw; tc.height=th;
    const tg=tc.getContext('2d'); tg.imageSmoothingEnabled=false; tg.drawImage(im,0,0,tw,th);
    const thumb=tc.toDataURL('image/png');
    const sc=Math.min(1, cap/Math.max(w,h));
    const fc=document.createElement('canvas');
    fc.width=Math.max(1,Math.round(w*sc)); fc.height=Math.max(1,Math.round(h*sc));
    const fg=fc.getContext('2d'); fg.imageSmoothingEnabled=false; fg.drawImage(im,0,0,fc.width,fc.height);
    return {thumb,full:fc.toDataURL('image/png'),w,h};
  }
  function showImport(on,msg){
    if(!page) return;
    const box=page.querySelector('#asImporting');
    if(box) box.hidden=!on;
    if(msg) updateImport(0,1,msg);
    if(!on && page) render(page);
  }
  function updateImport(current,total,msg){
    if(!page) return;
    const p=page.querySelector('#asProgress'), bar=page.querySelector('#asBar');
    if(p) p.textContent=msg||'';
    if(bar) bar.style.width=Math.round(current/Math.max(1,total)*100)+'%';
  }

  /* ---------------- 操作 ---------------- */
  function assetById(id){
    const hit=cardById(id); return hit?hit.card:null;
  }
  function editorForReference(){
    const active=activeTab();
    const isRefEditor = t => t && t._frame && (t.kind === 'anim' || t.kind === 'tex' || t.kind === 'ctex');
    if(isRefEditor(active)) return active;
    const last=S.tabs.find(t=>t.id===S.lastEditor && isRefEditor(t));
    if(isRefEditor(last)) return last;
    const any=S.tabs.slice().reverse().find(isRefEditor);
    return any||null;
  }
  async function useAsReference(id){
    const c=assetById(id); if(!c){ toast('先选一张素材'); return; }
    const t=editorForReference();
    if(!t || !t._frame){ toast('先打开一个纹理 / 动画编辑器，再点「设为参考图」'); return; }
    try{
      const w=t._frame.contentWindow;
      const res=await fetch(c.full || c.thumb);
      const blob=await res.blob();
      const file=new w.File([blob],(c.name||'reference')+'.png',{type:'image/png'});
      if(typeof w.rpImportFile!=='function') throw new Error('当前编辑器没有参考图面板');
      activateTab(t.id);
      w.rpImportFile(file);
      toast('已设为参考图：'+c.name);
    }catch(err){
      toast('设置参考图失败：'+err.message);
    }
  }
  async function copyPath(id){
    const c=assetById(id); if(!c) return;
    const text=c.ref.path||c.name;
    try{ await navigator.clipboard.writeText(text); toast('已复制路径：'+text); }
    catch(_){ toast('复制失败，路径：'+text); }
  }
  function toggleFavorite(id,pane){
    const c=assetById(id); if(!c) return;
    if(c.local){ toast('原版资产不支持收藏'); return; }
    c.ref.favorite=!c.ref.favorite;
    saveData(); render(pane||page);
    toast(c.ref.favorite?'已收藏':'已取消收藏');
  }
  async function copyToProject(id){
    const c=assetById(id); if(!c) return;
    const ws=currentWS();
    if(!ws){ toast('先新建一个项目工作区'); return; }
    if(!ws.cats.length) ws.cats.push({id:uidWs(),name:'默认',open:true,cards:[]});
    const copy=JSON.parse(JSON.stringify(c));
    if(c.local && c.ref && c.ref.localURL){
      try{
        const res=await fetch(c.ref.localURL);
        if(!res.ok) throw new Error('HTTP '+res.status);
        const im=await imageOfBlob(await res.blob());
        const rec=encodeImage(im,256);
        copy.thumb=rec.thumb; copy.full=rec.full;
        copy.ref.width=rec.w; copy.ref.height=rec.h;
        copy.ref.localURL=null;
      }catch(err){ toast('读取原版纹理失败：'+err.message); return; }
    }
    copy.local=false;
    copy.id='a'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    copy.badge='素材'; copy.meta=(copy.meta||'')+' · 来自素材库';
    ws.cats[0].cards.unshift(copy);
    saveData(); refreshList(); renderStatus();
    toast('已复制到工作区：'+ws.name);
  }
  function deleteAsset(id,pane){
    const c=assetById(id); if(!c) return;
    if(c.local){ toast('原版资产来自本地内容包，不能删除'); return; }
    confirmDialog('删除素材','确定从素材库删除「'+c.name+'」？','删除',()=>{
      for(const w of WS){
        if(!w.assetLibrary) continue;
        w.cats.forEach(cat=>{ cat.cards=cat.cards.filter(x=>x.id!==id); });
      }
      state.selected=null; saveData(); render(pane||page);
      toast('已删除素材');
    });
  }

  const pluginTexCache = new Map();
  async function blobToDataURL(blob){
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ''));
      fr.onerror = () => reject(fr.error || new Error('读取失败'));
      fr.readAsDataURL(blob);
    });
  }
  async function resolveTextures(paths){
    await ensureLocal();
    const want = [...new Set((Array.isArray(paths) ? paths : []).map(x => String(x || '').trim()).filter(Boolean))].slice(0, 400);
    const out = {};
    if(!want.length) return out;
    /* localCards() 返回 { card, cat } 包装，必须取 .card.ref（旧实现直接读 c.ref 导致永远匹配不到） */
    const localMap = new Map();
    localCards().forEach(entry => {
      const card = entry && entry.card;
      if(card && card.ref && card.ref.path && card.ref.localURL) localMap.set(card.ref.path, card);
    });
    const customMap = new Map();
    for(const w of WS){
      if(!w.assetLibrary) continue;
      for(const cat of (w.cats || [])){
        for(const c of (cat.cards || [])){
          if(c.ref && c.ref.path && !customMap.has(c.ref.path)) customMap.set(c.ref.path, c);
        }
      }
    }
    const pending = [];
    for(const p of want){
      if(pluginTexCache.has(p)){
        const cached = pluginTexCache.get(p);
        if(cached) out[p] = cached;
        continue;
      }
      const lc = localMap.get(p);
      if(lc && lc.ref && lc.ref.localURL){
        pending.push({ path:p, url:lc.ref.localURL });
        continue;
      }
      const cc = customMap.get(p);
      if(cc && (cc.full || cc.thumb)){
        const data = cc.full || cc.thumb;
        pluginTexCache.set(p, data);
        out[p] = data;
      }
    }
    await Promise.all(pending.map(async item => {
      try{
        const res = await fetch(item.url);
        if(!res.ok){ pluginTexCache.set(item.path, null); return; }
        const data = await blobToDataURL(await res.blob());
        pluginTexCache.set(item.path, data);
        out[item.path] = data;
      }catch(_){ pluginTexCache.set(item.path, null); }
    }));
    return out;
  }
  async function importPluginTextures(items){
    const list = Array.isArray(items) ? items.slice(0, 800) : [];
    const w = workspace();
    let added = 0, dup = 0, failed = 0;
    for(const item of list){
      if(!item || !item.path || !item.data) continue;
      try{
        const path = String(item.path).replace(/\\/g, '/');
        const cls = classify(path);
        const ns = item.namespace || cls.namespace || 'mod';
        if(exists(w, ns, path)){ dup++; continue; }
        let thumb = item.data, full = item.data, width = +item.width || 16, height = +item.height || 16;
        try{
          const blob = await (await fetch(item.data)).blob();
          const im = await imageOfBlob(blob);
          const rec = encodeImage(im, 256);
          thumb = rec.thumb; full = rec.full; width = rec.w; height = rec.h;
        }catch(_){}
        const name = item.name || path.split('/').pop().replace(/\.png$/i, '');
        const catSlug = item.category || cls.category || 'block';
        const card = {
          id:'a' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
          name,
          meta:`${width}×${height} · ${ns} · ${CAT_LABEL[catSlug] || catSlug}`,
          badge:'素材',
          type:'item',
          thumb, full,
          ref:{
            namespace:ns, path, category:catSlug, group:cls.group || '模组',
            source:item.source || '机械动力扩展', width, height,
            addedAt:Date.now(), favorite:false, mcmeta:item.mcmeta || null
          }
        };
        addCard(w, cls.group || '模组', card);
        added++;
      }catch(_){ failed++; }
    }
    if(added > 0){
      saveData();
      if(page && page.isConnected) render(page);
    }
    return { added, dup, failed, total:list.length };
  }

  return {open, mount, init, ensureLocal, localAssets: localCards, ensureWorkspace, allCards, useAsReference, importLoose, importArchive, resolveTextures, importPluginTextures};
})();
