/* ============================================================
   AI 模型工具（无头）
   - 直接构造合法的 Blockbench .bbmodel 工程（立方体 / 组 / 纹理 / UV）
   - 模型库 CRUD：复用 PWModels 的 IndexedDB 存储与桥接
   - 纹理可来自素材库 assetId、AI 预览 previewId 或纯色占位
   ============================================================ */
window.PWAgentModel = (() => {
  const MAX_DRAFTS = 24;
  const MAX_CUBES = 200;
  const MAX_TEXTURES = 32;
  const MAX_PARTS = 64;
  const FACES = ['north', 'south', 'east', 'west', 'up', 'down'];
  const ROLES = ['static', 'dynamic', 'item', 'overlay'];
  const AXES = ['y', 'x', 'z', 'none'];
  const FORMATS = [
    { id:'java_block', label:'Java 方块 / 物品' },
    { id:'free', label:'通用模型' },
    { id:'bedrock', label:'基岩实体' },
    { id:'bedrock_block', label:'基岩方块' },
    { id:'modded_entity', label:'模组实体' }
  ];
  const FORMAT_IDS = new Set(FORMATS.map(f => f.id));

  const drafts = new Map();   // draftId -> {raw,name,meta,thumb}
  let draftSeq = 0;

  function M(){
    /* PWModels 是脚本级 const（全局词法作用域，不挂 window），用裸名访问 */
    if(typeof PWModels === 'undefined') throw new Error('模型库尚未加载，请刷新页面后重试');
    return PWModels;
  }
  function clampNum(v, min, max, fb){
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fb;
  }
  function vec3(v, fb){
    if(!Array.isArray(v) || v.length < 3) throw new Error('坐标必须是 [x,y,z] 三个数字');
    return [clampNum(v[0], -128, 128, fb), clampNum(v[1], -128, 128, fb), clampNum(v[2], -128, 128, fb)];
  }
  function isDataURL(v){ return typeof v === 'string' && /^data:image\//i.test(v); }
  function solidTexture(color){
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#8c9b82';
    g.fillRect(0, 0, 16, 16);
    return c.toDataURL('image/png');
  }
  function imageDims(dataURL){
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve({ w:im.naturalWidth || 16, h:im.naturalHeight || 16 });
      im.onerror = () => reject(new Error('纹理图片读取失败'));
      im.src = dataURL;
    });
  }
  /* 纹理解析顺序：dataURL → previewId（AI 预览）→ assetId（素材库）→ 纯色占位 */
  async function resolveTexture(spec, idx, resW, resH){
    spec = spec || {};
    let dataURL = null;
    if(isDataURL(spec.dataURL)) dataURL = spec.dataURL;
    else if(spec.previewId && window.PWAgent && typeof PWAgent.getPreviewDataURL === 'function')
      dataURL = PWAgent.getPreviewDataURL(spec.previewId);
    else if(spec.assetId && typeof recolorAssetById === 'function'){
      const a = recolorAssetById(spec.assetId);
      if(a && isDataURL(a.data)) dataURL = a.data;
    }
    if(!isDataURL(dataURL)) dataURL = solidTexture(spec.color);
    const dims = await imageDims(dataURL);
    return {
      name:String(spec.name || ('texture_' + idx + '.png')),
      id:String(idx), uuid:M().uid('t'), source:dataURL,
      width:dims.w, height:dims.h, uv_width:resW, uv_height:resH,
      mode:'bitmap', folder:'block', particle:false
    };
  }
  function texIndex(value, textures, byName, fallback){
    if(typeof value === 'number') return Math.max(0, Math.min(textures.length - 1, Math.round(value)));
    if(typeof value === 'string' && byName.has(value)) return byName.get(value);
    return fallback;
  }

  /* ---------------- 构建（预览，不入库） ---------------- */
  async function buildModel(spec){
    spec = spec || {};
    const name = String(spec.name || 'AI 模型').slice(0, 120) || 'AI 模型';
    const format = FORMAT_IDS.has(spec.format) ? spec.format : 'java_block';
    const resArr = Array.isArray(spec.resolution) ? spec.resolution : [spec.resolution, spec.resolution];
    const resW = clampNum(resArr[0], 1, 512, 16);
    const resH = clampNum(resArr[1], 1, 512, 16);
    if(!Array.isArray(spec.cubes) || !spec.cubes.length) throw new Error('cubes 必须是非空数组');

    const texSpecs = (Array.isArray(spec.textures) ? spec.textures : []).slice(0, MAX_TEXTURES);
    if(!texSpecs.length) texSpecs.push({ color:'#8c9b82' });
    const textures = [];
    for(let i = 0; i < texSpecs.length; i++) textures.push(await resolveTexture(texSpecs[i], i, resW, resH));
    const byName = new Map(textures.map((t, i) => [t.name, i]));

    const cubes = spec.cubes.slice(0, MAX_CUBES);
    const elements = cubes.map((cube, i) => {
      if(!cube || typeof cube !== 'object') throw new Error('每个 cube 必须是对象');
      const from = vec3(cube.from, 0);
      const to = vec3(cube.to, 16);
      const baseTex = texIndex(cube.texture, textures, byName, 0);
      const faces = {};
      FACES.forEach(dir => {
        const override = (cube.faces && cube.faces[dir]) || {};
        const uv = Array.isArray(override.uv) && override.uv.length >= 4 ? override.uv.slice(0, 4) : [0, 0, resW, resH];
        faces[dir] = { uv, texture:texIndex(override.texture, textures, byName, baseTex) };
      });
      return {
        name:String(cube.name || ('cube_' + i)),
        type:'cube', uuid:M().uid('e'),
        from, to,
        origin:Array.isArray(cube.origin) ? vec3(cube.origin, 8) : [8, 8, 8],
        inflate:clampNum(cube.inflate, -16, 16, 0),
        faces
      };
    });

    /* outliner：children 用 element uuid 字符串（标准 .bbmodel，Blockbench 可载入） */
    let outliner = [];
    if(Array.isArray(spec.groups) && spec.groups.length){
      const used = new Set();
      spec.groups.forEach(g => {
        const idxs = (Array.isArray(g.cubes) ? g.cubes : []).filter(i => Number.isInteger(i) && i >= 0 && i < elements.length);
        idxs.forEach(i => used.add(i));
        if(idxs.length) outliner.push({ name:String(g.name || 'group'), uuid:M().uid('g'), origin:[8, 8, 8], isOpen:true, children:idxs.map(i => elements[i].uuid) });
      });
      const rest = elements.map((e, i) => i).filter(i => !used.has(i));
      if(rest.length) outliner.push({ name, uuid:M().uid('g'), origin:[8, 8, 8], isOpen:true, children:rest.map(i => elements[i].uuid) });
    }else{
      outliner = [{ name, uuid:M().uid('g'), origin:[8, 8, 8], isOpen:true, children:elements.map(e => e.uuid) }];
    }

    const raw = {
      meta:{ format_version:'4.10', model_format:format, box_uv:false, creation_tool:'ClastarStudio AI' },
      name,
      resolution:{ width:resW, height:resH },
      elements, outliner, textures,
      animations:[]
    };
    const meta = M().modelMeta(raw, JSON.stringify(raw).length);
    let thumb = null;
    try{
      if(typeof PWModelView !== 'undefined') thumb = await PWModelView.thumbnail({ parts:[{ raw, role:'static', axis:'y' }] }, 96);
    }catch(_){}
    const draftId = 'dr_' + (++draftSeq).toString(36) + '_' + Date.now().toString(36);
    drafts.set(draftId, { raw, name, meta, thumb });
    while(drafts.size > MAX_DRAFTS) drafts.delete(drafts.keys().next().value);
    return { draftId, name, raw, meta, thumb };
  }
  function getDraft(draftId){ return drafts.get(draftId) || null; }
  function listFormats(){ return FORMATS.map(f => Object.assign({}, f)); }

  /* ---------------- 模型库只读 ---------------- */
  async function listSets(opts){
    opts = opts || {};
    const m = M();
    await m.ensureLoaded();
    const q = String(opts.query || '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(200, Math.round(Number(opts.limit) || 50)));
    return m._getSets().filter(s => {
      if(!q) return true;
      const hay = [s.name, ...(s.parts || []).map(p => p.name)].join(' ').toLowerCase();
      return hay.includes(q);
    }).slice(0, limit).map(s => ({
      id:s.id, name:s.name, namespace:s.namespace || null,
      parts:(s.parts || []).length, updatedAt:s.updatedAt, source:s.source || null
    }));
  }
  async function getSet(setId){
    const m = M();
    await m.ensureLoaded();
    const s = m.getSet(setId);
    if(!s) throw new Error('模型集不存在：' + setId);
    return {
      id:s.id, name:s.name, namespace:s.namespace || null, updatedAt:s.updatedAt, source:s.source || null,
      parts:(s.parts || []).map(p => ({ id:p.id, name:p.name, role:p.role, axis:p.axis, meta:p.meta }))
    };
  }

  /* ---------------- 写回（破坏性，agent 层做同意门控） ---------------- */
  async function saveModel(opts){
    opts = opts || {};
    const m = M();
    let raw = null, draftName = null;
    if(opts.draftId && drafts.has(opts.draftId)){
      const d = drafts.get(opts.draftId);
      raw = d.raw; draftName = d.name;
    }else if(opts.raw && typeof opts.raw === 'object'){
      raw = opts.raw;
    }
    if(!raw || typeof raw !== 'object' || !raw.meta || !Array.isArray(raw.elements))
      throw new Error('没有可用的模型，请先调用 model_build 生成预览');
    const name = String(opts.name || draftName || raw.name || 'AI 模型').slice(0, 120);
    const role = ROLES.includes(opts.role) ? opts.role : 'static';
    const axis = AXES.includes(opts.axis) ? opts.axis : 'y';
    const part = {
      id:m.uid('p'), name, role, axis, raw,
      meta:m.modelMeta(raw, JSON.stringify(raw).length),
      createdAt:Date.now(), updatedAt:Date.now(), source:'ai-agent'
    };
    let set;
    if(opts.setId){
      await m.ensureLoaded();
      set = m.getSet(opts.setId);
      if(!set) throw new Error('模型集不存在：' + opts.setId);
      set.parts = set.parts || [];
      if(set.parts.length >= MAX_PARTS) throw new Error('单个模型集最多 ' + MAX_PARTS + ' 个部件');
      set.parts.push(part);
      if(opts.namespace) set.namespace = String(opts.namespace);
      if(!set.thumb) set.thumb = m.firstTextureOfSet(set);
    }else{
      set = {
        id:m.uid('s'), name, namespace:opts.namespace ? String(opts.namespace) : null,
        createdAt:Date.now(), updatedAt:Date.now(),
        thumb:m.firstTextureOfSet({ parts:[part] }), source:'ai-agent', parts:[part]
      };
    }
    await m.saveSet(set);
    return { setId:set.id, partId:part.id, name };
  }
  async function deleteSet(setId){
    const m = M();
    await m.ensureLoaded();
    if(!m.getSet(setId)) throw new Error('模型集不存在：' + setId);
    await m.removeSet(setId);
    return { deleted:true };
  }
  async function deletePart(partId){
    const m = M();
    await m.ensureLoaded();
    const hit = m.findPart(partId);
    if(!hit) throw new Error('部件不存在：' + partId);
    const { set, part } = hit;
    set.parts = (set.parts || []).filter(p => p.id !== part.id);
    if(!set.parts.length) await m.removeSet(set.id);
    else await m.saveSet(set);
    return { deleted:true };
  }
  async function exportPart(partId){
    const m = M();
    await m.ensureLoaded();
    const hit = m.findPart(partId);
    if(!hit) throw new Error('部件不存在：' + partId);
    m.exportPart(hit.part);
    return { filename:PWArchive.safeName(hit.part.name, 'model') + '.bbmodel' };
  }
  async function exportSet(setId){
    const m = M();
    await m.ensureLoaded();
    const s = m.getSet(setId);
    if(!s) throw new Error('模型集不存在：' + setId);
    m.exportSet(s);
    return { filename:PWArchive.safeName(s.name, 'model_set') + '.zip' };
  }
  async function exportLibrary(){ return M().exportLibrary(); }
  async function importLibrary(file){ return M().importLibrary(file); }

  /* ---------------- Blockbench 联动 ---------------- */
  async function openInBlockbench(opts){
    opts = opts || {};
    const m = M();
    await m.ensureLoaded();
    const hit = m.findPart(opts.partId);
    if(!hit) throw new Error('部件不存在：' + opts.partId);
    m.openInBlockbench(hit.set, hit.part);
    return { opened:true, name:hit.part.name };
  }

  return {
    buildModel, getDraft, listFormats,
    listSets, getSet,
    saveModel, deleteSet, deletePart,
    exportPart, exportSet, exportLibrary, importLibrary,
    openInBlockbench
  };
})();