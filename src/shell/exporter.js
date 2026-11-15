/* ============================================================
   仓库 → 资源包 ZIP
   ============================================================ */
const PWPack = (() => {
  /* Sedna 8×8 连接图：与复合纹理编辑器一致，用于把 5 张来源还原成 128×128 整图 */
  const SEDNA_MAP = [
    [[1,1,1,1],[2,2,1,1],[1,1,2,2],[2,2,2,2]],
    [[3,1,3,1],[4,2,3,1],[3,1,4,2],[4,2,4,2],[5,2,3,1],[3,1,5,2]],
    [[1,3,1,3],[2,4,1,3],[1,3,2,4],[2,4,2,4],[2,5,1,3],[1,3,2,5]],
    [[3,3,3,3],[4,4,3,3],[3,3,4,4],[4,4,4,4],[4,5,4,4],[5,4,4,4],[5,5,4,4]],
    [[4,2,5,2],[5,2,4,2],[5,2,5,2],[4,4,5,4],[4,5,5,4],[5,4,5,4],[5,5,5,4]],
    [[2,4,2,5],[2,5,2,4],[2,5,2,5],[4,4,4,5],[4,5,4,5],[5,4,4,5],[5,5,4,5]],
    [[5,4,3,3],[4,5,3,3],[5,5,3,3],[4,4,5,5],[4,5,5,5],[5,4,5,5],[5,5,5,5]],
    [[3,3,5,4],[3,3,4,5],[3,3,5,5]]
  ];
  const PROFILE_EQUIP = {
    humanoid: {body:'humanoid', legs:'humanoid_leggings'},
    wolf: {body:'wolf_body'},
    horse: {body:'horse_body'},
    nautilus: {body:'nautilus_body'},
    ghast: {body:'happy_ghast_body'},
    elytra: {body:'wings'}
  };

  function cardList(ids){
    const out = [];
    const seen = new Set();
    const push = (c, cat, folder) => {
      if(!c || seen.has(c.id)) return;
      seen.add(c.id);
      if(c.type === 'folder' && Array.isArray(c.cards)) c.cards.forEach(x => push(x, cat, c));
      else out.push({card:c, cat, folder});
    };
    (ids || []).forEach(id => {
      const hit = findCard(id);
      if(hit) push(hit.card, hit.cat, hit.folder);
    });
    return out;
  }

  function imageOf(c){
    if(!c) return null;
    if(c.full) return c.full;
    if(c.thumb) return c.thumb;
    return null;
  }

  function addFile(files, path, data, used){
    path = String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
    path = path.split('/').map(seg => {
      if(seg === '.' || seg === '..') return '_';
      return seg.replace(/[^a-z0-9._-]+/gi, '_').toLowerCase();
    }).filter(Boolean).join('/');
    if(!path) return;
    let p = path, i = 2;
    const lower = path.toLowerCase();
    while(used.has(lower)){
      const dot = path.lastIndexOf('.');
      p = dot > 0 ? path.slice(0, dot) + '_' + i + path.slice(dot) : path + '_' + i;
      i++;
      if(i > 999) break;
    }
    used.add(p.toLowerCase());
    files.push({name:p, data});
  }

  function sourcePath(c, ns, fallbackCat){
    if(c.packPath){
      let p = String(c.packPath).replace(/\\/g, '/').replace(/^\/+/, '');
      if(/^assets\//.test(p)) return p.replace(/\/[^/]+$/, '/');
      if(/^textures\//.test(p)) return 'assets/' + ns + '/' + p.replace(/\/[^/]+$/, '/');
      return 'assets/' + ns + '/textures/' + p.replace(/^.*?textures\//, '').replace(/\/[^/]+$/, '/');
    }
    return 'assets/' + ns + '/textures/' + (fallbackCat || 'item') + '/';
  }

  function baseName(c, fallback){
    const raw = String((c && c.name) || '');
    const ascii = raw.replace(/[^\x20-\x7e]/g, '').trim();
    const idTail = String((c && c.id) || '').replace(/[^a-z0-9]/gi, '').slice(-8);
    return PWArchive.slug(ascii || idTail, fallback || 'texture');
  }

  /* 把复合卡片的 5 张 16×16 来源按 Sedna 图还原为 128×128 整图 */
  function compositeCanvas(c){
    const srcs = (c.composite && Array.isArray(c.composite.sources)) ? c.composite.sources : [];
    return new Promise(resolve => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      let left = 0;
      const imgs = [];
      const finish = () => {
        for(let i = 0; i < 8; i++){
          for(let j = 0; j < 8; j++){
            const row = SEDNA_MAP[i] && SEDNA_MAP[i][j];
            if(!row) continue;
            row.forEach((idx, q) => {
              const im = imgs[idx - 1];
              if(!im) return;
              g.drawImage(im, (q % 2) * 8, Math.floor(q / 2) * 8, 8, 8,
                j * 16 + (q % 2) * 8, i * 16 + Math.floor(q / 2) * 8, 8, 8);
            });
          }
        }
        resolve(cv);
      };
      srcs.slice(0, 5).forEach((url, i) => {
        if(!url){ imgs[i] = null; return; }
        left++;
        const im = new Image();
        im.onload = () => { imgs[i] = im; if(--left <= 0) finish(); };
        im.onerror = () => { imgs[i] = null; if(--left <= 0) finish(); };
        im.src = url;
      });
      if(!left) finish();
    });
  }

  function armorPaths(c, ns, opts){
    const arm = c.armor || {};
    const profile = arm.profile || 'humanoid';
    const name = baseName(c, profile);
    const textures = arm.textures || {};
    const originals = arm.paths || {};
    const out = [];
    const add = (slot, fallbackPath) => {
      const url = textures[slot];
      if(!url) return;
      const path = originals[slot] || fallbackPath;
      if(path) out.push({path, url});
    };
    if(profile === 'humanoid'){
      add('layer1', 'assets/' + ns + '/textures/entity/equipment/humanoid/' + name + '.png');
      add('layer2', 'assets/' + ns + '/textures/entity/equipment/humanoid_leggings/' + name + '.png');
      if(opts.legacyArmor && !originals.layer1 && textures.layer1)
        out.push({path:'assets/' + ns + '/textures/models/armor/' + name + '_layer_1.png', url:textures.layer1});
      if(opts.legacyArmor && !originals.layer2 && textures.layer2)
        out.push({path:'assets/' + ns + '/textures/models/armor/' + name + '_layer_2.png', url:textures.layer2});
      return out;
    }
    const equip = PROFILE_EQUIP[profile];
    if(equip && equip.body) add('body', 'assets/' + ns + '/textures/entity/equipment/' + equip.body + '/' + name + '.png');
    return out;
  }

  async function build(cards, opts){
    const files = [];
    const used = new Set();
    const ns = PWArchive.slug(opts.namespace || 'pixel_workshop', 'pixel_workshop');
    const cat = opts.textureCategory === 'block' ? 'block' : 'item';
    let pngCount = 0;
    const report = [];

    for(const item of cards){
      const c = item.card;
      if(!c || c.type === 'folder') continue;
      const name = baseName(c, 'texture');

      if(c.armor){
        const paths = armorPaths(c, ns, opts);
        paths.forEach(p => {
          addFile(files, p.path, PWArchive.dataURLBytes(p.url), used);
          pngCount++;
        });
        report.push({name:c.name, paths:paths.map(p => p.path)});
        continue;
      }

      if(c.composite){
        const sources = (c.composite && Array.isArray(c.composite.sources)) ? c.composite.sources : [];
        sources.forEach((url, i) => {
          if(!url) return;
          addFile(files, 'assets/' + ns + '/textures/block/' + name + '_' + (i + 1) + '.png', PWArchive.dataURLBytes(url), used);
          pngCount++;
        });
        const atlas = await compositeCanvas(c);
        const atlasPath = sourcePath(c, ns, 'block') + name + '_composite.png';
        addFile(files, atlasPath, PWArchive.dataURLBytes(atlas.toDataURL('image/png')), used);
        pngCount++;
        report.push({name:c.name, paths:[atlasPath]});
        continue;
      }

      if(c.create && Array.isArray(c.create.slots)){
        const paths = [];
        c.create.slots.forEach(slot => {
          if(!slot || !slot.data || !slot.packPath) return;
          addFile(files, slot.packPath, PWArchive.dataURLBytes(slot.data), used);
          pngCount++; paths.push(slot.packPath);
          if(slot.mcmeta && typeof slot.mcmeta === 'object'){
            addFile(files, slot.packPath + '.mcmeta', JSON.stringify(slot.mcmeta, null, 2), used);
          }
        });
        report.push({name:c.name, paths});
        continue;
      }

      if(c.block){
        const textures = (c.block && c.block.textures) || {};
        const keys = Object.keys(textures).filter(k => textures[k] && k !== 'particle');
        const base = sourcePath(c, ns, 'block') + name;
        if(keys.length === 1 && (keys[0] === 'all' || keys[0] === 'texture')){
          const p = base + '.png';
          addFile(files, p, PWArchive.dataURLBytes(textures[keys[0]]), used);
          pngCount++; report.push({name:c.name, paths:[p]});
        } else if(keys.length){
          const paths = [];
          keys.forEach(k => {
            const p = base + '_' + PWArchive.slug(k, 'face') + '.png';
            addFile(files, p, PWArchive.dataURLBytes(textures[k]), used);
            pngCount++; paths.push(p);
          });
          report.push({name:c.name, paths});
        }
        continue;
      }

      const img = imageOf(c);
      if(!img) continue;
      let path = c.packPath
        ? String(c.packPath).replace(/\\/g, '/').replace(/^\/+/, '')
        : sourcePath(c, ns, cat) + name + '.png';
      if(c.ctex && c.ctex.path && !c.packPath) path = sourcePath(c, ns, cat) + name + '.png';
      addFile(files, path, PWArchive.dataURLBytes(img), used);
      pngCount++;
      if(c.anim || c.mcmeta){
        const meta = (c.mcmeta && typeof c.mcmeta === 'object') ? c.mcmeta : {animation:{frametime:1}};
        addFile(files, path + '.mcmeta', JSON.stringify(meta, null, 2), used);
      }
      report.push({name:c.name, paths:[path]});
    }

    const pack = {
      pack: {
        pack_format: Number(opts.format) || 69,
        description: (opts.description || '像素工坊导出的资源包') + '\nPixel Workshop · Clastar Studio'
      }
    };
    files.push({name:'pack.mcmeta', data:JSON.stringify(pack, null, 2)});

    /* pack.png：把第一张有图的卡片等比放大到 128，加棋盘底 */
    const iconCard = cards.map(x => x.card).find(c => imageOf(c) || c.armor || c.block || c.composite);
    if(iconCard){
      try{
        let src = imageOf(iconCard);
        if(!src && iconCard.armor){
          const t = iconCard.armor.textures || {};
          src = t.layer1 || t.body || t.layer2;
        }
        if(!src && iconCard.block){
          const t = iconCard.block.textures || {};
          src = t.all || Object.values(t)[0];
        }
        if(!src && iconCard.composite) src = (iconCard.composite.sources || [])[0];
        if(src){
          const icon = await new Promise((resolve, reject) => {
            const im = new Image();
            im.onload = () => {
              const cv = document.createElement('canvas');
              cv.width = cv.height = 128;
              const g = cv.getContext('2d');
              g.imageSmoothingEnabled = false;
              g.fillStyle = '#2b2b2b'; g.fillRect(0, 0, 128, 128);
              const s = Math.min(116 / im.naturalWidth, 116 / im.naturalHeight);
              const w = Math.max(1, Math.round(im.naturalWidth * s)), h = Math.max(1, Math.round(im.naturalHeight * s));
              g.drawImage(im, (128 - w) / 2, (128 - h) / 2, w, h);
              resolve(cv);
            };
            im.onerror = reject;
            im.src = src;
          });
          files.push({name:'pack.png', data:PWArchive.dataURLBytes(icon.toDataURL('image/png'))});
        }
      }catch(_){}
    }

    return {blob:PWArchive.create(files), pngCount, fileCount:files.length, report, namespace:ns};
  }

  function download(cards, opts){
    return build(cards, opts).then(res => {
      PWArchive.download(res.blob, PWArchive.safeName(opts.filename || 'resource_pack', 'resource_pack') + '.zip');
      return res;
    });
  }

  function openDialog(ids){
    const cards = cardList(ids);
    if(!cards.length){ toast('先选择至少一个作品'); return; }
    const ws = currentWS();
    const defaultName = (ws ? ws.name : '资源包') + ' 资源包';
    const old = document.getElementById('packModal');
    if(old) old.remove();
    const mask = document.createElement('div');
    mask.className = 'pack-modal';
    mask.id = 'packModal';
    mask.innerHTML =
      '<div class="pack-dlg" role="dialog" aria-label="导出资源包">' +
        '<div class="pack-head"><div><h3>导出资源包 ZIP</h3>' +
          '<p>已选择 <b>' + cards.length + '</b> 个作品 · 自动按类型整理路径</p></div>' +
          '<button class="pack-x" data-close title="关闭">✕</button></div>' +
        '<div class="pack-body">' +
          '<div class="pack-grid">' +
            '<label>资源包名称<input id="packName" value="' + esc(defaultName) + '" maxlength="60"></label>' +
            '<label>命名空间<input id="packNs" value="pixel_workshop" maxlength="48" spellcheck="false"></label>' +
            '<label>目标版本<select id="packFormat">' +
              '<option value="69">1.21.9 / 1.21.10（69）</option>' +
              '<option value="64">1.21.7 / 1.21.8（64）</option>' +
              '<option value="55">1.21.5（55）</option>' +
              '<option value="46">1.21.4（46）</option>' +
            '</select></label>' +
            '<label>普通纹理归类<select id="packCat">' +
              '<option value="item">物品 textures/item</option>' +
              '<option value="block">方块 textures/block</option>' +
            '</select></label>' +
          '</div>' +
          '<label class="pack-chk"><input type="checkbox" id="packLegacy" checked> 人形盔甲同时写入旧版 <code>models/armor</code> 路径</label>' +
          '<div class="pack-preview"><div class="pack-preview-head">内容一览 <span>' + cards.length + ' 项</span></div>' +
            '<div class="pack-paths" id="packPaths"></div></div>' +
          '<p class="pack-note">说明：资源包会写入 <code>pack.mcmeta</code> 与 <code>pack.png</code>；动画会自动带 <code>.png.mcmeta</code>。复合纹理额外导出 5 张来源和 1 张 128×128 整图。</p>' +
        '</div>' +
        '<div class="pack-foot"><button class="btn light" data-close>取消</button>' +
          '<button class="btn pri" id="packGo">导出 ZIP</button></div>' +
      '</div>';
    document.body.appendChild(mask);
    const close = () => mask.remove();
    mask.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
    mask.addEventListener('pointerdown', e => { if(e.target === mask) close(); });
    const paths = mask.querySelector('#packPaths');
    paths.innerHTML = cards.slice(0, 30).map(x => {
      const c = x.card;
      const kind = c.armor ? '实体装备' : c.composite ? '复合纹理' : c.block ? '方块材质'
        : c.anim ? '动画' : c.ctex ? '自定义纹理' : '纹理';
      return '<div><b>' + esc(c.name) + '</b><span>' + kind + (x.folder ? ' · ' + esc(x.folder.name) : '') + '</span></div>';
    }).join('') + (cards.length > 30 ? '<div class="more">… 另外 ' + (cards.length - 30) + ' 项</div>' : '');
    mask.querySelector('#packGo').onclick = async () => {
      const btn = mask.querySelector('#packGo');
      const opts = {
        namespace: mask.querySelector('#packNs').value,
        format: +mask.querySelector('#packFormat').value,
        textureCategory: mask.querySelector('#packCat').value,
        legacyArmor: mask.querySelector('#packLegacy').checked,
        description: mask.querySelector('#packName').value.trim() || defaultName,
        filename: mask.querySelector('#packName').value.trim() || defaultName
      };
      btn.disabled = true; btn.textContent = '打包中…';
      try{
        const res = await download(cards, opts);
        close();
        toast('已导出 ' + res.pngCount + ' 张 PNG · ' + res.fileCount + ' 个文件');
      }catch(err){
        console.error(err);
        btn.disabled = false; btn.textContent = '导出 ZIP';
        alert('打包失败：' + (err && err.message ? err.message : err));
      }
    };
  }

  return {openDialog, build, cardList, compositeCanvas};
})();
