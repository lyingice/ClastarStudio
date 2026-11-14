/* ============================================================
   智能 ZIP 导入 / 仓库素材选择器
   ============================================================ */
const PWImport = (() => {
  const CAT_ORDER = [
    '方块纹理', '物品纹理', '实体装备', '实体纹理', '盔甲',
    '界面纹理', '粒子', '画', '环境', '字体', '杂项', '其他图片'
  ];
  const ENTITY_EQUIP = {
    humanoid: {profile:'humanoid', slot:'layer1', label:'人形盔甲'},
    humanoid_leggings: {profile:'humanoid', slot:'layer2', label:'人形盔甲'},
    wolf_body: {profile:'wolf', slot:'body', label:'狼铠'},
    horse_body: {profile:'horse', slot:'body', label:'马铠'},
    nautilus_body: {profile:'nautilus', slot:'body', label:'鹦鹉螺铠'},
    happy_ghast_body: {profile:'ghast', slot:'body', label:'快乐恶魂挽具'},
    wings: {profile:'elytra', slot:'body', label:'鞘翅'}
  };
  const PROFILE_LABEL = {humanoid:'人形盔甲', wolf:'狼铠', horse:'马铠', nautilus:'鹦鹉螺铠', ghast:'快乐恶魂挽具', elytra:'鞘翅'};

  function extName(p){ return String(p).split('/').pop().replace(/\.[^.]+$/, ''); }
  function dirOf(p){ const a = String(p).split('/'); a.pop(); return a.join('/'); }
  function joinPath(a, b){ return [a, b].filter(Boolean).join('/'); }

  function classify(path){
    let p = String(path).replace(/\\/g, '/');
    let ns = '';
    let rel = p;
    const m = p.match(/^assets\/([^/]+)\/textures\/(.+)$/i);
    if(m){ ns = m[1]; rel = m[2]; }
    const parts = rel.split('/');
    const file = parts[parts.length - 1];
    const base = file.replace(/\.png$/i, '');
    const dirs = parts.slice(0, -1);
    let cat = '其他图片', sub = dirs.join('/'), badge = '纹理', kind = 'texture';

    if(dirs[0] === 'entity' && dirs[1] === 'equipment' && ENTITY_EQUIP[dirs[2]]){
      cat = '实体装备';
      sub = dirs.slice(3).join('/');
      badge = ENTITY_EQUIP[dirs[2]].label;
      kind = 'equipment';
    } else if(dirs[0] === 'models' && dirs[1] === 'armor'){
      cat = '盔甲';
      sub = dirs.slice(2).join('/');
      badge = '人形盔甲';
      kind = 'legacy_armor';
    } else if(dirs[0] === 'entity' && dirs[1] === 'equipment'){
      cat = '实体装备'; sub = dirs.slice(2).join('/'); badge = '实体装备';
    } else if(dirs[0] === 'entity'){
      cat = '实体纹理'; sub = dirs.slice(1).join('/'); badge = '实体';
    } else if(dirs[0] === 'block'){
      cat = '方块纹理'; sub = dirs.slice(1).join('/'); badge = '方块';
    } else if(dirs[0] === 'item'){
      cat = '物品纹理'; sub = dirs.slice(1).join('/'); badge = '物品';
    } else if(dirs[0] === 'gui' || dirs[0] === 'container'){
      cat = '界面纹理'; sub = dirs.slice(1).join('/'); badge = '界面';
    } else if(dirs[0] === 'particle'){
      cat = '粒子'; sub = dirs.slice(1).join('/'); badge = '粒子';
    } else if(dirs[0] === 'painting'){
      cat = '画'; sub = dirs.slice(1).join('/'); badge = '画';
    } else if(dirs[0] === 'environment' || dirs[0] === 'colormap'){
      cat = '环境'; sub = dirs.slice(1).join('/'); badge = '环境';
    } else if(dirs[0] === 'font'){
      cat = '字体'; sub = dirs.slice(1).join('/'); badge = '字体';
    } else if(dirs[0] === 'misc' || dirs[0] === 'effect'){
      cat = '杂项'; sub = dirs.slice(1).join('/'); badge = '杂项';
    } else if(m){
      cat = '其他图片'; sub = dirs.join('/'); badge = '纹理';
    }
    return {cat, sub, badge, ns, rel, base, kind, orig:path};
  }

  function armorInfo(path){
    let p = String(path).replace(/\\/g, '/');
    let m = p.match(/^assets\/([^/]+)\/textures\/entity\/equipment\/(humanoid|humanoid_leggings|wolf_body|horse_body|nautilus_body|happy_ghast_body|wings)\/(.+)\.png$/i);
    if(m){
      const map = ENTITY_EQUIP[m[2]];
      const base = m[3].split('/').pop();
      return {profile:map.profile, slot:map.slot, base, ns:m[1], path:p, kind:'equipment',
        cat:'实体装备', sub:m[3].split('/').slice(0,-1).join('/'), sourceDir:m[2]};
    }
    m = p.match(/^assets\/([^/]+)\/textures\/models\/armor\/(.+)\.png$/i);
    if(m){
      let base = m[2].split('/').pop();
      let slot = null;
      const lm = base.match(/^(.*?)_layer_([12])$/i);
      if(lm){ base = lm[1]; slot = lm[2] === '2' ? 'layer2' : 'layer1'; }
      return {profile:'humanoid', slot:slot || 'layer1', base, ns:m[1], path:p, kind:'legacy_armor',
        cat:'盔甲', sub:m[2].split('/').slice(0,-1).join('/'), sourceDir:'models/armor'};
    }
    return null;
  }

  function readImage(blob){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const im = new Image();
      im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片读取失败')); };
      im.src = url;
    });
  }
  function encodeImage(img, cap){
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const thumbCv = document.createElement('canvas');
    thumbCv.width = thumbCv.height = 16;
    const tg = thumbCv.getContext('2d');
    tg.imageSmoothingEnabled = false;
    tg.drawImage(img, 0, 0, 16, 16);
    const thumb = thumbCv.toDataURL('image/png');
    const sc = Math.min(1, cap / Math.max(w, h));
    const fc = document.createElement('canvas');
    fc.width = Math.max(1, Math.round(w * sc));
    fc.height = Math.max(1, Math.round(h * sc));
    const fg = fc.getContext('2d');
    fg.imageSmoothingEnabled = false;
    fg.drawImage(img, 0, 0, fc.width, fc.height);
    return {thumb, full:fc.toDataURL('image/png'), w, h};
  }
  async function mapLimit(items, limit, fn){
    const out = new Array(items.length);
    let i = 0;
    async function worker(){
      while(i < items.length){
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }
    await Promise.all(Array.from({length:Math.min(limit, items.length)}, worker));
    return out;
  }

  function ensureWs(name){
    const w = {id:uidWs(), name, cats:[]};
    WS.push(w);
    S.wsId = w.id; S.folder = null; S.query = ''; S.sel = null;
    clearPicks();
    return w;
  }
  function getCat(ws, name){
    let c = ws.cats.find(x => x.name === name);
    if(!c){ c = {id:uidWs(), name, open:true, cards:[]}; ws.cats.push(c); }
    return c;
  }
  function getFolder(cat, sub){
    if(!sub) return null;
    const label = sub.split('/').filter(Boolean).join(' / ');
    if(!label) return null;
    let f = cat.cards.find(c => c.type === 'folder' && c.name === label);
    if(!f){ f = {id:'f' + Date.now().toString(36) + Math.random().toString(36).slice(2,4), name:label, type:'folder', badge:'文件夹', meta:'文件夹 · 0 项', cards:[]}; cat.cards.push(f); }
    return f;
  }
  function placeCard(ws, card, catName, sub){
    const cat = getCat(ws, catName);
    const folder = getFolder(cat, sub);
    if(folder) folder.cards.push(card); else cat.cards.push(card);
  }

  async function importZip(file){
    let entries;
    try{ entries = await PWArchive.read(file); }
    catch(err){ toast('ZIP 解析失败：' + (err.message || err)); return; }
    const pngs = entries.filter(e => !e.dir && /\.png$/i.test(e.name) && !/^__MACOSX\//i.test(e.name)
      && !/(^|\/)pack\.png$/i.test(e.name) && !/(^|\/)\._/.test(e.name));
    if(!pngs.length){ toast('这个 ZIP 里没有 PNG 纹理'); return; }

    const metaEntries = new Map();
    for(const e of entries){
      if(e.dir || !/\.png\.mcmeta$/i.test(e.name)) continue;
      try{
        const text = new TextDecoder('utf-8').decode(await e.data()).replace(/^\uFEFF/, '');
        metaEntries.set(e.name.replace(/\.mcmeta$/i, ''), JSON.parse(text));
      }
      catch(_){}
    }
    if(pngs.length > 500) toast('这个包有 ' + pngs.length + ' 张 PNG，可能需要一点时间…');
    else toast('正在解析 ' + pngs.length + ' 张 PNG…');

    const infos = await mapLimit(pngs, 10, async e => {
      const path = e.name.replace(/\\/g, '/');
      try{
        const blob = new Blob([await e.data()], {type:'image/png'});
        const img = await readImage(blob);
        const cap = img.naturalHeight > img.naturalWidth
          ? Math.min(512, Math.max(128, img.naturalHeight))
          : 128;
        const enc = encodeImage(img, cap);
        return {path, ...enc, meta:metaEntries.get(path) || metaEntries.get(path.replace(/\.png$/i, '')) || null};
      }catch(err){ return {path, error:err.message || String(err)}; }
    });
    const good = infos.filter(x => !x.error);
    if(!good.length){ toast('PNG 都读取失败了'); return; }

    const zipName = file.name.replace(/\.zip$/i, '').trim() || '导入资源包';
    const ws = ensureWs(zipName);
    const armorGroups = new Map();
    const counts = {};
    let imported = 0, failed = infos.length - good.length;

    for(const info of good){
      const ai = armorInfo(info.path);
      if(ai){
        const key = [ai.cat, ai.sub, ai.profile, ai.base, ai.ns].join('|');
        let g = armorGroups.get(key);
        if(!g){
          g = {profile:ai.profile, base:ai.base, cat:ai.cat, sub:ai.sub, ns:ai.ns, textures:{}, paths:{}, first:info};
          armorGroups.set(key, g);
        }
        g.textures[ai.slot] = info.full;
        g.paths[ai.slot] = info.path;
        continue;
      }
      const cls = classify(info.path);
      const meta = info.meta;
      const frames = info.h > info.w ? Math.round(info.h / info.w) : 1;
      const isAnim = !!(meta && meta.animation) || frames > 1;
      const card = {
        id:'i' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
        name:info.path.split('/').pop().replace(/\.png$/i, ''),
        meta:info.w + '×' + info.h + (frames > 1 ? ' · ' + frames + ' 帧' : '') + ' · ZIP',
        badge:isAnim ? '动画' : cls.badge,
        anim:isAnim,
        type:'item',
        thumb:info.thumb,
        full:info.full,
        packPath:info.path,
        packNs:cls.ns
      };
      if(meta && typeof meta === 'object') card.mcmeta = meta;
      if(cls.kind === 'equipment') card.badge = cls.badge;
      placeCard(ws, card, cls.cat, cls.sub);
      counts[cls.cat] = (counts[cls.cat] || 0) + 1;
      imported++;
    }

    for(const g of armorGroups.values()){
      const slots = Object.keys(g.textures);
      if(!slots.length) continue;
      const label = PROFILE_LABEL[g.profile] || '实体装备';
      const card = {
        id:'i' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
        name:g.base,
        meta:label + (g.profile === 'humanoid' ? ' · 64×32 · ' + slots.length + ' 层' : ' · 实体装备'),
        badge:label,
        type:'item',
        thumb:g.first.thumb,
        armor:{
          kind:g.profile === 'humanoid' ? 'vanilla_armor' : 'entity_equipment',
          profile:g.profile,
          textures:g.textures,
          paths:g.paths
        }
      };
      /* 用第一张纹理生成 3D 缩略图会依赖编辑器；这里先用纹理本身做卡片图 */
      card.thumb = g.textures.layer1 || g.textures.body || g.first.thumb;
      placeCard(ws, card, g.cat, g.sub);
      counts[g.cat] = (counts[g.cat] || 0) + 1;
      imported++;
    }

    /* 大类别按固定顺序排列 */
    ws.cats.sort((a, b) => {
      const ia = CAT_ORDER.indexOf(a.name), ib = CAT_ORDER.indexOf(b.name);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    if(!ws.cats.length) getCat(ws, '其他图片');
    S.wsId = ws.id; S.folder = null; S.query = '';
    saveData();
    renderWorkspaces();
    const t = activeTab();
    if(!t || t.kind !== 'home') newTab('home', '首页'); else renderContent();
    renderStatus();

    const cats = ws.cats.filter(c => c.cards.length).map(c => c.name + ' ' + countCards(c)).join(' · ');
    toast('已导入 ' + imported + ' 项到「' + ws.name + '」' + (failed ? '，失败 ' + failed : ''));
    if(cats) setTimeout(() => toast(cats), 700);
  }

  function countCards(cat){
    return cat.cards.reduce((n, c) => n + (c.type === 'folder' ? (c.cards ? c.cards.length : 0) : 1), 0);
  }

  /* ============================================================
     仓库素材选择器
     ============================================================ */
  function collectAssets(){
    const out = [];
    WS.forEach(w => {
      w.cats.forEach(cat => {
        const visit = (c, folder) => {
          if(!c) return;
          if(c.type === 'folder' && Array.isArray(c.cards)){ c.cards.forEach(x => visit(x, c)); return; }
          const push = (url, kind, slot, label) => {
            if(!url) return;
            out.push({url, kind, slot, label, card:c, ws:w, cat, folder, name:c.name + (label ? ' · ' + label : '')});
          };
          if(c.armor){
            const t = c.armor.textures || {};
            const order = c.armor.profile === 'humanoid' ? ['layer1','layer2'] : ['body'];
            order.forEach(s => { if(t[s]) push(t[s], 'armor', s, s === 'layer1' ? '层 1' : s === 'layer2' ? '层 2' : '主体'); });
          } else if(c.composite){
            const t = c.composite.sources || [];
            t.forEach((url, i) => { if(url) push(url, 'composite', i, '面 ' + (i + 1)); });
            out.push({url:null, kind:'atlas', slot:null, label:'整图', card:c, ws:w, cat, folder,
              name:c.name + ' · 整图 128×128',
              makeUrl:() => PWPack.compositeCanvas(c).then(cv => cv.toDataURL('image/png'))});
          } else if(c.block){
            const t = c.block.textures || {};
            Object.keys(t).forEach(k => { if(t[k]) push(t[k], 'block', k, k); });
          } else {
            const url = c.full || c.thumb;
            if(url) push(url, 'texture', null, '');
          }
        };
        cat.cards.forEach(c => visit(c, null));
      });
    });
    return out;
  }

  function openLibraryPicker(opts){
    opts = opts || {};
    const all = collectAssets();
    const old = document.getElementById('libPicker');
    if(old) old.remove();
    const mask = document.createElement('div');
    mask.className = 'pack-modal lib-picker';
    mask.id = 'libPicker';
    mask.innerHTML =
      '<div class="pack-dlg picker-dlg" role="dialog" aria-label="从仓库选择素材">' +
        '<div class="pack-head"><div><h3>' + esc(opts.title || '从仓库选择素材') + '</h3>' +
          '<p>共 <b>' + all.length + '</b> 张可用图片 · 点一张即可导入</p></div>' +
          '<button class="pack-x" data-close title="关闭">✕</button></div>' +
        '<div class="picker-search"><input id="libPickQ" placeholder="搜索作品 / 工作区…" autocomplete="off"></div>' +
        '<div class="picker-grid" id="libPickGrid"></div>' +
        '<div class="pack-foot"><span class="picker-hint">只显示仓库里已经有图片的纹理 / 材质 / 盔甲层</span>' +
          '<button class="btn light" data-close>取消</button></div>' +
      '</div>';
    document.body.appendChild(mask);
    const close = () => mask.remove();
    mask.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
    mask.addEventListener('pointerdown', e => { if(e.target === mask) close(); });
    const grid = mask.querySelector('#libPickGrid');
    const input = mask.querySelector('#libPickQ');
    let query = '';
    if(!all.length){
      grid.innerHTML = '<div class="picker-empty">仓库里还没有可用图片。<br>先导入 PNG，或新建一张纹理。</div>';
    }
    function render(){
      const q = query.trim().toLowerCase();
      const list = all.filter(a => !q || (a.name + ' ' + a.ws.name + ' ' + a.cat.name + ' ' + (a.label || '')).toLowerCase().includes(q));
      if(!list.length){
        grid.innerHTML = '<div class="picker-empty">没有匹配的图片</div>';
        return;
      }
      grid.innerHTML = list.slice(0, 300).map((a, i) =>
        '<button type="button" class="pick-item" data-i="' + all.indexOf(a) + '" title="' + esc(a.ws.name + ' / ' + a.name) + '">' +
          '<span class="pick-thumb"><img src="' + (a.card.thumb || a.url) + '" alt="" loading="lazy"></span>' +
          '<span class="pick-info"><b>' + esc(a.name) + '</b><span>' + esc(a.ws.name) + ' · ' + esc(a.cat.name) + '</span></span>' +
          '<span class="pick-kind">' + esc(a.kind === 'armor' ? '盔甲层' : a.kind === 'composite' ? '复合面' : a.kind === 'atlas' ? '复合整图' : a.kind === 'block' ? '方块材质' : '纹理') + '</span>' +
        '</button>').join('');
      if(list.length > 300) grid.insertAdjacentHTML('beforeend', '<div class="picker-empty">只显示前 300 张，请用搜索缩小范围</div>');
    }
    render();
    input.addEventListener('input', () => { query = input.value; render(); });
    grid.addEventListener('click', async e => {
      const b = e.target.closest('[data-i]');
      if(!b) return;
      const asset = all[+b.dataset.i];
      if(!asset) return;
      try{
        if(!asset.url && asset.makeUrl){
          b.disabled = true;
          asset.url = await asset.makeUrl();
        }
        if(!asset.url) throw new Error('这张图还没有可用的图片');
        close();
        opts.onPick && opts.onPick(asset);
      }catch(err){
        console.error(err);
        b.disabled = false;
        toast('读取失败：' + (err.message || err));
      }
    });
    setTimeout(() => input.focus(), 30);
  }

  function bindGlobal(){
    const zip = document.getElementById('zipPick');
    if(zip){
      zip.addEventListener('change', e => {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if(f) importZip(f);
      });
    }
    /* 拖入 ZIP 或一次拖入多张 PNG */
    window.addEventListener('drop', e => {
      if(!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      const files = [...e.dataTransfer.files];
      const zips = files.filter(f => /\.zip$/i.test(f.name) || f.type === 'application/zip');
      if(zips.length){
        e.preventDefault(); e.stopPropagation();
        try{ if(typeof showDrop === 'function') showDrop(false); dragDepth = 0; }catch(_){}
        importZip(zips[0]);
        return;
      }
      if(files.length > 1 && files.some(f => /^image\//.test(f.type))){
        e.preventDefault(); e.stopPropagation();
        try{ if(typeof showDrop === 'function') showDrop(false); dragDepth = 0; }catch(_){}
        if(!currentWS()){ toast('先新建一个工作区'); return; }
        files.filter(f => /^image\//.test(f.type)).forEach(f => importImage(f));
      }
    }, true);
  }

  return {importZip, openLibraryPicker, collectAssets, classify, encodeImage, bindGlobal};
})();
document.addEventListener('DOMContentLoaded', () => { try{ PWImport.bindGlobal(); }catch(e){} });
