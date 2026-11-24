/* ============================================================
   AI 纹理工具（无头）
   给 agent 调用的纹理枚举 / 取色 / 换色 / 变种 / 绘制 / 写回 / 导出
   不重写算法，全部复用换色、变种、素材库与资源包模块
   ============================================================ */
window.PWAgentTexture = (() => {
  const MAX_VARIANTS = 24;
  const MAX_PAINT_OPS = 2000;
  const MIN_CANVAS = 1;
  const MAX_CANVAS = 512;

  /* ---------------- 通用工具 ---------------- */
  function normalizeHex(hex){
    const rgb = recolorHexToRgb(hex);
    return rgb ? recolorRgbToHex(rgb.r, rgb.g, rgb.b) : null;
  }
  function assertDataURL(dataURL){
    if(typeof dataURL !== 'string' || !dataURL.startsWith('data:image'))
      throw new Error('dataURL 必须是 data:image 格式');
  }
  function numberOr(value, fallback){
    if(value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function clampInt(value, min, max, fallback){
    const n = Math.round(numberOr(value, fallback));
    return Math.max(min, Math.min(max, n));
  }
  function clampNumber(value, min, max, fallback){
    const n = numberOr(value, fallback);
    return Math.max(min, Math.min(max, n));
  }
  function loadImageElement(dataURL){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片读取失败'));
      img.src = dataURL;
    });
  }
  function imageSize(img){
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if(!w || !h) throw new Error('图片尺寸无效');
    return { w, h };
  }

  /* 读取为 ImageData：像素风纹理关闭平滑，保留原始尺寸 */
  async function loadImageData(dataURL){
    const img = await loadImageElement(dataURL);
    const { w, h } = imageSize(img);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d', { willReadFrequently:true });
    g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, 0);
    return g.getImageData(0, 0, w, h);
  }
  function canvasThumb(cv){
    if(!cv || typeof cv.toDataURL !== 'function') throw new Error('canvas 无效');
    return variantThumb(cv);
  }
  function canvasFull(cv){
    if(!cv || typeof cv.toDataURL !== 'function') throw new Error('canvas 无效');
    return variantFullData(cv);
  }

  /* ---------------- 只读枚举 ---------------- */
  function listTextures(opts){
    opts = opts || {};
    const q = String(opts.query || '').trim().toLowerCase();
    const limit = Math.max(0, Math.floor(numberOr(opts.limit, 50)));
    return recolorAllAssets().filter(asset => {
      if(opts.workspaceId && asset.wsId !== opts.workspaceId) return false;
      if(!q) return true;
      return [asset.cardName, asset.wsName, asset.label]
        .some(v => String(v || '').toLowerCase().includes(q));
    }).slice(0, limit).map(asset => ({
      id: asset.id,
      cardId: asset.cardId,
      cardName: asset.cardName,
      wsId: asset.wsId,
      wsName: asset.wsName,
      slot: asset.slot,
      kind: asset.kind,
      label: asset.label
    }));
  }

  async function getTexture(assetId){
    const asset = recolorAssetById(assetId);
    if(!asset) throw new Error('纹理不存在：' + assetId);
    const imageData = await loadImageData(asset.data);
    return {
      id: asset.id, cardId: asset.cardId, cardName: asset.cardName,
      wsName: asset.wsName, slot: asset.slot, kind: asset.kind, label: asset.label,
      width: imageData.width, height: imageData.height, dataURL: asset.data
    };
  }

  async function getTextureColors(assetId, opts){
    opts = opts || {};
    const mode = opts.mode === 'cluster' ? 'cluster' : 'exact';
    const clusterCount = clampInt(opts.clusterCount, 2, 16, 6);
    const imageData = await loadImageData(recolorAssetData(assetId));
    const res = recolorExtract(imageData, mode, clusterCount);
    return {
      width: imageData.width, height: imageData.height,
      colors: res.colors, unique: res.unique, opaque: res.opaque, truncated: res.truncated
    };
  }

  function recolorAssetData(assetId){
    const asset = recolorAssetById(assetId);
    if(!asset) throw new Error('纹理不存在：' + assetId);
    return asset.data;
  }

  function listRamps(){
    return variantRamps().map(r => ({
      id: r.id, name: r.name, colors: r.colors, builtin: !!r.builtin
    }));
  }
  function listPalettes(){
    return recolorBuiltinPalettes().map(p => ({
      id: p.id, group: p.group, name: p.name, colors: p.colors
    }));
  }

  async function searchAssets(opts){
    opts = opts || {};
    await PWAssets.ensureLocal();
    const q = String(opts.query || '').trim().toLowerCase();
    const limit = Math.max(0, Math.floor(numberOr(opts.limit, 40)));
    return PWAssets.allCards().filter(item => {
      const card = item && item.card;
      if(!card) return false;
      const ref = card.ref || {};
      if(opts.namespace && ref.namespace !== opts.namespace) return false;
      if(opts.category && ref.category !== opts.category) return false;
      if(!q) return true;
      return [card.name, ref.path, ref.namespace]
        .some(v => String(v || '').toLowerCase().includes(q));
    }).slice(0, limit).map(item => {
      const card = item.card, ref = card.ref || {};
      return {
        id: card.id, name: card.name,
        namespace: ref.namespace, category: ref.category, group: ref.group,
        width: ref.width, height: ref.height
      };
    });
  }

  /* ---------------- 预览操作（不写回） ---------------- */
  async function recolorPreview(assetId, opts){
    opts = opts || {};
    const mode = opts.mode === 'cluster' ? 'cluster' : 'exact';
    const tolerance = clampNumber(opts.tolerance, 0, 255, 5);
    const clusterCount = clampInt(opts.clusterCount, 2, 16, 6);
    const tex = await getTexture(assetId);
    const imageData = await loadImageData(tex.dataURL);

    let mapping;
    if(Array.isArray(opts.mapping)){
      /* 显式映射：逐项校验，非法项直接丢弃 */
      mapping = opts.mapping.map(item => {
        if(!item || typeof item !== 'object') return null;
        const source = normalizeHex(item.source);
        const target = normalizeHex(item.target);
        return source && target ? { source, target } : null;
      }).filter(Boolean);
    }else{
      const extract = recolorExtract(imageData, mode, clusterCount);
      let presetId = opts.preset || 'theme';
      let paletteColors = null;
      if(opts.paletteId){
        const palette = listPalettes().find(p => p.id === opts.paletteId);
        if(!palette) throw new Error('色卡不存在：' + opts.paletteId);
        paletteColors = palette.colors;
        presetId = 'palette';
      }
      const targets = recolorPresetTargets(extract.colors, presetId, paletteColors);
      mapping = extract.colors.map((color, i) => ({
        source: color.hex,
        target: targets[i]
      }));
    }

    /* 目标色非法时 recolorCompute 会跳过，这里先过滤并给出明确反馈 */
    mapping = mapping.filter(m => m && recolorHexToRgb(m.source) && recolorHexToRgb(m.target));
    if(!mapping.length) throw new Error('没有可用的换色映射');

    const result = recolorCompute({ imageData, mapping, mode, tolerance });
    const cv = document.createElement('canvas');
    cv.width = result.imageData.width;
    cv.height = result.imageData.height;
    cv.getContext('2d').putImageData(result.imageData, 0, 0);
    return {
      dataURL: cv.toDataURL('image/png'),
      thumb: canvasThumb(cv),
      width: cv.width,
      height: cv.height,
      changed: result.changed,
      mapping
    };
  }

  async function applyRamp(assetId, rampId, opts){
    const asset = recolorAssetById(assetId);
    if(!asset) throw new Error('纹理不存在：' + assetId);
    const ramp = variantRamp(rampId);
    if(!ramp) throw new Error('色阶不存在：' + rampId);
    const mergedOpts = Object.assign(variantOptions(), opts || {});
    const cv = await variantRender(asset, ramp, mergedOpts);
    return {
      dataURL: cv.toDataURL('image/png'),
      thumb: canvasThumb(cv),
      width: cv.width,
      height: cv.height,
      rampId: ramp.id,
      rampName: ramp.name
    };
  }

  async function generateVariants(assetId, rampIds, opts){
    if(!Array.isArray(rampIds) || !rampIds.length)
      throw new Error('rampIds 必须是非空数组');
    const asset = recolorAssetById(assetId);
    if(!asset) throw new Error('纹理不存在：' + assetId);
    const mergedOpts = Object.assign(variantOptions(), opts || {});
    /* 共享图片缓存，批量变种时只解码一次母版 */
    const state = { images:new Map() };
    const out = [];
    for(const id of rampIds.slice(0, MAX_VARIANTS)){
      const ramp = variantRamp(id);
      if(!ramp) continue;
      const cv = await variantRender(asset, ramp, mergedOpts, state);
      out.push({
        rampId: ramp.id,
        rampName: ramp.name,
        dataURL: cv.toDataURL('image/png'),
        thumb: canvasThumb(cv)
      });
    }
    return out;
  }

  /* 1px 直线：Bresenham，保证像素纹理不出现抗锯齿 */
  function paintLine(g, x0, y0, x1, y1){
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for(;;){
      g.fillRect(x0, y0, 1, 1);
      if(x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if(e2 >= dy){ err += dy; x0 += sx; }
      if(e2 <= dx){ err += dx; y0 += sy; }
    }
  }

  async function paintTexture(opts){
    opts = opts || {};
    const width = clampInt(opts.width, MIN_CANVAS, MAX_CANVAS, 16);
    const height = clampInt(opts.height, MIN_CANVAS, MAX_CANVAS, 16);
    const operations = opts.operations == null ? [] : opts.operations;
    if(!Array.isArray(operations)) throw new Error('operations 必须是数组');

    const cv = document.createElement('canvas');
    cv.width = width; cv.height = height;
    const g = cv.getContext('2d', { willReadFrequently:true });
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, width, height);

    const bg = normalizeHex(opts.background);
    if(bg){ g.fillStyle = bg; g.fillRect(0, 0, width, height); }

    operations.slice(0, MAX_PAINT_OPS).forEach(op => {
      if(!op || typeof op !== 'object') return;
      if(op.op === 'fill'){
        const color = normalizeHex(op.color);
        if(!color) return;
        g.fillStyle = color;
        g.fillRect(0, 0, width, height);
        return;
      }
      if(op.op === 'clear'){
        g.clearRect(0, 0, width, height);
        return;
      }
      if(op.op === 'pixel'){
        const color = normalizeHex(op.color);
        if(!color) return;
        const x = clampInt(op.x, 0, width - 1, 0);
        const y = clampInt(op.y, 0, height - 1, 0);
        g.fillStyle = color;
        g.fillRect(x, y, 1, 1);
        return;
      }
      if(op.op === 'line'){
        const color = normalizeHex(op.color);
        if(!color) return;
        const x1 = clampInt(op.x1, 0, width - 1, 0);
        const y1 = clampInt(op.y1, 0, height - 1, 0);
        const x2 = clampInt(op.x2, 0, width - 1, 0);
        const y2 = clampInt(op.y2, 0, height - 1, 0);
        g.fillStyle = color;
        paintLine(g, x1, y1, x2, y2);
        return;
      }
      if(op.op === 'rect'){
        const color = normalizeHex(op.color);
        if(!color) return;
        const x = clampInt(op.x, 0, width - 1, 0);
        const y = clampInt(op.y, 0, height - 1, 0);
        const rw = clampInt(op.w, 0, width, 0);
        const rh = clampInt(op.h, 0, height, 0);
        const x2 = Math.min(width, x + rw);
        const y2 = Math.min(height, y + rh);
        if(x2 <= x || y2 <= y) return;
        g.fillStyle = color;
        if(op.fill !== false){
          g.fillRect(x, y, x2 - x, y2 - y);
        }else{
          /* 用四条 1px 实心边描边，避免 strokeRect 的半像素模糊 */
          g.fillRect(x, y, x2 - x, 1);
          g.fillRect(x, y2 - 1, x2 - x, 1);
          g.fillRect(x, y, 1, y2 - y);
          g.fillRect(x2 - 1, y, 1, y2 - y);
        }
        return;
      }
      if(op.op === 'noise'){
        const color = normalizeHex(op.color);
        if(!color) return;
        const density = clampNumber(op.density, 0, 1, 0.1);
        const seed = Math.floor(numberOr(op.seed, 0x51ed270b)) >>> 0;
        let state = seed || 0x51ed270b;
        const rand = () => {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
          return state / 4294967296;
        };
        g.fillStyle = color;
        for(let y = 0; y < height; y++){
          for(let x = 0; x < width; x++){
            if(rand() < density) g.fillRect(x, y, 1, 1);
          }
        }
        return;
      }
      if(op.op === 'gradient'){
        const colors = (Array.isArray(op.colors) ? op.colors : []).map(normalizeHex).filter(Boolean);
        if(colors.length < 2) return;
        let grad;
        if(op.direction === 'vertical') grad = g.createLinearGradient(0, 0, 0, height);
        else if(op.direction === 'diagonal') grad = g.createLinearGradient(0, 0, width, height);
        else grad = g.createLinearGradient(0, 0, width, 0);
        colors.forEach((color, i) => grad.addColorStop(i / (colors.length - 1), color));
        g.fillStyle = grad;
        g.fillRect(0, 0, width, height);
      }
    });

    return {
      dataURL: cv.toDataURL('image/png'),
      thumb: canvasThumb(cv),
      width,
      height
    };
  }

  /* ---------------- 写回操作 ---------------- */
  async function writeTexture(assetId, dataURL){
    const asset = recolorAssetById(assetId);
    if(!asset) throw new Error('纹理不存在：' + assetId);
    assertDataURL(dataURL);
    const hit = recolorWriteAsset(asset, dataURL);
    if(!hit) throw new Error('写入失败：找不到目标卡片或纹理槽位');
    return { cardId: asset.cardId, cardName: asset.cardName, slot: asset.slot };
  }

  /* 优先指定工作区 → 当前工作区 → 第一个项目工作区 → 新建 AI 工作区 */
  function targetWorkspace(workspaceId){
    if(workspaceId){
      const picked = WS.find(w => w.id === workspaceId && !w.assetLibrary);
      if(picked) return picked;
    }
    let ws = currentWS();
    if(ws && !ws.assetLibrary) return ws;
    ws = WS.find(w => !w.assetLibrary);
    if(ws) return ws;
    ws = {
      id: uidWs(), name: 'AI 工作区',
      cats: [{ id: uidWs(), name: '默认', open: true, cards: [] }]
    };
    WS.push(ws);
    return ws;
  }

  async function createTextureCard(opts){
    opts = opts || {};
    const dataURL = opts.dataURL;
    assertDataURL(dataURL);
    const img = await loadImageElement(dataURL);
    const { w, h } = imageSize(img);

    const thumb = recolorMakeThumb(img, w, h, h > w);
    let full = dataURL;
    if(Math.max(w, h) > MAX_CANVAS){
      const scale = MAX_CANVAS / Math.max(w, h);
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));
      const cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(img, 0, 0, cw, ch);
      full = cv.toDataURL('image/png');
    }

    const ws = targetWorkspace(opts.workspaceId);
    const catName = String(opts.category || 'AI 生成').trim() || 'AI 生成';
    let cat = ws.cats.find(c => c.name === catName);
    if(!cat){
      cat = { id: uidWs(), name: catName, open: true, cards: [] };
      ws.cats.unshift(cat);
    }

    const card = {
      id: 'ai' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name: opts.name ? String(opts.name) : 'AI 纹理',
      meta: w + '×' + h + ' · AI 生成',
      badge: '纹理',
      type: 'item',
      thumb,
      full,
      aiGenerated: true
    };
    cat.cards.unshift(card);

    saveData();
    renderWorkspaces();
    if(document.querySelector('#catList')) refreshList();
    renderStatus();
    return { cardId: card.id, cardName: card.name, workspaceId: ws.id };
  }

  async function exportPack(opts){
    opts = opts || {};
    if(!Array.isArray(opts.cardIds) || !opts.cardIds.length)
      throw new Error('cardIds 必须是非空数组');
    const cards = opts.cardIds
      .map(id => findCardAnywhere(id))
      .filter(Boolean)
      .filter(hit => hit.card && hit.card.type !== 'folder')
      .map(hit => ({ card: hit.card, cat: hit.cat, folder: hit.folder }));
    if(!cards.length) throw new Error('没有可导出的卡片');

    const res = await PWPack.build(cards, {
      namespace: opts.namespace || 'pixel_workshop',
      format: opts.format == null ? 69 : opts.format,
      textureCategory: opts.textureCategory === 'block' ? 'block' : 'item',
      description: opts.description
    });
    const fname = PWArchive.safeName(opts.filename, 'resource_pack') + '.zip';
    PWArchive.download(res.blob, fname);
    return {
      pngCount: res.pngCount,
      fileCount: res.fileCount,
      filename: fname,
      namespace: res.namespace
    };
  }

  return {
    loadImageData,
    canvasThumb,
    canvasFull,
    listTextures,
    getTexture,
    getTextureColors,
    listRamps,
    listPalettes,
    searchAssets,
    recolor: recolorPreview,
    applyRamp,
    generateVariants,
    paintTexture,
    writeTexture,
    createTextureCard,
    exportPack
  };
})();
