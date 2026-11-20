/* ============================================================
   Create 模型集扫描 / 转换
   ------------------------------------------------------------
   - 读取 Create jar / 资源包里的 blockstate、models/block、纹理
   - 解析 parent 继承，按元素名称粗分静态 / 动态部件
   - 转成 Blockbench .bbmodel 结构，交给模型库保存
   ============================================================ */
const PWCreateModels = (() => {
  const MODEL_JSON = /^assets\/create\/(blockstates|models\/block)\/.*\.json$/i;
  const TEXTURE_PNG = /^assets\/create\/textures\/(block|item)\/.*\.png$/i;
  const DYNAMIC_WORDS = /gear|cog|wheel|axis|shaft|rotor|fan|blade|saw|drill|piston|extension|crank|spring|clutch|roller|pulley|spinner|belt|chain|moving/i;
  const STATIC_WORDS = /case|housing|casing|frame|base|side|top|bottom|core|inner|outer|bracket|window|wall|pole|edge|mount|plate/i;
  let missingCache = null;

  function uid(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function isDynamicElementName(name){
    const s = String(name || '').toLowerCase();
    if(!s) return false;
    if(STATIC_WORDS.test(s)) return false;
    return DYNAMIC_WORDS.test(s);
  }
  function modelRefKey(ref){
    let s = String(ref || '').trim();
    if(!s) return '';
    s = s.replace(/^create:/, '').replace(/^minecraft:/, '');
    return s;
  }
  function collectModelRefs(bs){
    const refs = new Set();
    if(bs && bs.variants && typeof bs.variants === 'object'){
      Object.values(bs.variants).forEach(v => {
        (Array.isArray(v) ? v : [v]).forEach(x => { if(x && x.model) refs.add(x.model); });
      });
    }
    if(bs && Array.isArray(bs.multipart)){
      bs.multipart.forEach(part => { if(part && part.apply && part.apply.model) refs.add(part.apply.model); });
    }
    return [...refs].map(modelRefKey).filter(Boolean);
  }
  function resolveModel(key, models, seen){
    key = modelRefKey(key);
    seen = seen || new Set();
    if(!key || seen.has(key)) return { textures:{}, elements:[], textureSize:null, modelKey:key };
    seen.add(key);
    const m = models.get(key);
    if(!m) return { textures:{}, elements:[], textureSize:null, modelKey:key };
    const out = { textures:{}, elements:[], textureSize:null, modelKey:key };
    if(m.parent){
      const pk = modelRefKey(m.parent);
      if(pk && models.has(pk)){
        const p = resolveModel(pk, models, seen);
        out.textures = p.textures;
        out.elements = p.elements;
        out.textureSize = p.textureSize;
        out.modelKey = p.elements.length ? p.modelKey : key;
      }
    }
    if(m.textures && typeof m.textures === 'object') Object.assign(out.textures, m.textures);
    if(Array.isArray(m.elements) && m.elements.length){
      out.elements = m.elements;
      out.modelKey = key;
    }
    if(Array.isArray(m.texture_size) && m.texture_size.length >= 2) out.textureSize = m.texture_size;
    return out;
  }
  function resolveTextureRef(value, textures, depth){
    depth = depth || 0;
    if(depth > 6 || typeof value !== 'string') return null;
    if(value.startsWith('#')) return resolveTextureRef(textures[value.slice(1)], textures, depth + 1);
    return value;
  }
  function texturePath(ref){
    if(!ref) return null;
    let s = String(ref);
    if(s.startsWith('minecraft:')) return s;
    s = s.replace(/^create:/, '');
    if(s.startsWith('block/') || s.startsWith('item/')) s = 'textures/' + s;
    else if(!s.startsWith('textures/')) s = 'textures/block/' + s;
    if(!/\.png$/i.test(s)) s += '.png';
    return 'assets/create/' + s;
  }
  function missingTexture(){
    if(missingCache) return missingCache;
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const x = c.getContext('2d');
    x.fillStyle = '#ff00ff'; x.fillRect(0, 0, 16, 16);
    x.fillStyle = '#111111';
    for(let y=0; y<16; y+=4){
      for(let xx = (y/4)%2 ? 0 : 4; xx<16; xx+=8) x.fillRect(xx, y, 4, 4);
    }
    missingCache = c.toDataURL('image/png');
    return missingCache;
  }

  async function scan(file, onProgress){
    const entries = await PWArchive.read(file);
    const jsonEntries = entries.filter(e => !e.dir && MODEL_JSON.test(e.name));
    if(!jsonEntries.length) throw new Error('没有找到 assets/create/blockstates 或 models/block');
    const models = new Map();
    const blockstates = new Map();
    let done = 0;
    for(const e of jsonEntries){
      try{
        const text = new TextDecoder().decode(await e.data());
        const json = JSON.parse(text);
        if(e.name.includes('/models/block/')){
          const key = e.name.replace(/^assets\/create\/models\//, '').replace(/\.json$/i, '');
          models.set(key, json);
        }else if(e.name.includes('/blockstates/')){
          const id = e.name.split('/').pop().replace(/\.json$/i, '');
          blockstates.set(id, json);
        }
      }catch(_){}
      done++;
      if(onProgress && (done % 80 === 0 || done === jsonEntries.length)) onProgress(done, jsonEntries.length);
    }
    const textureEntries = new Map();
    for(const e of entries){
      if(!e.dir && TEXTURE_PNG.test(e.name)) textureEntries.set(e.name, e);
    }
    const families = [];
    for(const [id, bs] of blockstates){
      const refs = collectModelRefs(bs);
      if(!refs.length) continue;
      let best = null;
      for(const ref of refs){
        const resolved = resolveModel(ref, models);
        if(resolved.elements.length && (!best || resolved.elements.length > best.elements.length)) best = resolved;
      }
      if(!best) continue;
      const dynamicCount = best.elements.filter(el => isDynamicElementName(el.name)).length;
      families.push({
        id, refs, modelKey:best.modelKey, modelCount:refs.length,
        elementCount:best.elements.length, dynamicCount, resolved:best
      });
    }
    families.sort((a,b) => a.id.localeCompare(b.id, 'en'));
    return { families, textureEntries, fileName:file.name, entryCount:entries.length };
  }

  async function buildParts(family, textureEntries, sourceName, cache){
    const staticEls = [];
    const dynamicEls = [];
    (family.resolved.elements || []).forEach(el => {
      if(isDynamicElementName(el.name)) dynamicEls.push(el);
      else staticEls.push(el);
    });
    const groups = [];
    if(staticEls.length) groups.push({ role:'static', elements:staticEls });
    if(dynamicEls.length) groups.push({ role:'dynamic', elements:dynamicEls });
    const parts = [];
    for(const group of groups) parts.push(await buildPart(family, group, textureEntries, sourceName, cache));
    return parts;
  }

  async function buildPart(family, group, textureEntries, sourceName, cache){
    cache = cache || new Map();
    const size = family.resolved.textureSize || [16,16];
    const faceData = group.elements.map(el => {
      const out = {};
      const faces = el.faces && typeof el.faces === 'object' ? el.faces : {};
      Object.keys(faces).forEach(dir => {
        const face = faces[dir] || {};
        const ref = resolveTextureRef(face.texture, family.resolved.textures);
        out[dir] = { face, path: ref ? texturePath(ref) : 'missing' };
      });
      return out;
    });
    const paths = new Set();
    faceData.forEach(faces => Object.values(faces).forEach(x => paths.add(x.path || 'missing')));
    const texIndex = new Map();
    const textures = [];
    for(const path of paths){
      let dataURL = null;
      if(path && path !== 'missing' && !path.startsWith('minecraft:') && textureEntries.has(path)){
        if(cache.has(path)) dataURL = cache.get(path);
        else{
          const bytes = await textureEntries.get(path).data();
          dataURL = PWArchive.bytesDataURL(bytes, 'image/png');
          cache.set(path, dataURL);
        }
      }
      if(!dataURL) dataURL = missingTexture();
      const idx = textures.length;
      texIndex.set(path || 'missing', idx);
      textures.push({
        name:path && path !== 'missing' ? path.split('/').pop() : 'missing.png',
        id:String(idx), uuid:uid('t'), source:dataURL
      });
    }
    const elements = group.elements.map((el, i) => {
      const out = {
        name:el.name || '',
        from:Array.isArray(el.from) ? el.from.slice() : [0,0,0],
        to:Array.isArray(el.to) ? el.to.slice() : [16,16,16],
        uuid:uid('e'),
        faces:{}
      };
      if(el.rotation && typeof el.rotation === 'object' && !Array.isArray(el.rotation)){
        const angle = +el.rotation.angle || 0;
        const axis = String(el.rotation.axis || 'y').toLowerCase();
        out.rotation = [axis === 'x' ? angle : 0, axis === 'y' ? angle : 0, axis === 'z' ? angle : 0];
        out.origin = Array.isArray(el.rotation.origin) ? el.rotation.origin.slice() : [8,8,8];
        if(el.rotation.rescale) out.rescale = true;
      }else if(Array.isArray(el.rotation)){
        out.rotation = el.rotation.slice();
        if(Array.isArray(el.origin)) out.origin = el.origin.slice();
      }
      if(el.inflate) out.inflate = el.inflate;
      if(el.shade !== undefined) out.shade = el.shade;
      Object.keys(faceData[i] || {}).forEach(dir => {
        const hit = faceData[i][dir];
        const face = hit.face || {};
        const nf = {
          uv:Array.isArray(face.uv) ? face.uv.slice() : [0,0,+size[0] || 16,+size[1] || 16],
          texture:texIndex.get(hit.path || 'missing') || 0
        };
        if(face.rotation) nf.rotation = face.rotation;
        if(face.cullface) nf.cullface = face.cullface;
        if(face.tintindex !== undefined) nf.tintindex = face.tintindex;
        out.faces[dir] = nf;
      });
      return out;
    });
    const roleName = group.role === 'dynamic' ? 'dynamic' : 'static';
    const name = family.id + '_' + roleName;
    const raw = {
      meta:{ format_version:'4.10', model_format:'java_block', box_uv:false },
      name,
      resolution:{ width:+size[0] || 16, height:+size[1] || 16 },
      elements,
      outliner:[{
        name:family.id + ' · ' + (group.role === 'dynamic' ? '动态' : '静态'),
        origin:[8,8,8], uuid:uid('g'), children:elements.map((_, i) => i)
      }],
      textures
    };
    return {
      id:uid('p'), name, role:group.role, axis:'y',
      raw, createdAt:Date.now(), updatedAt:Date.now(), source:sourceName,
      create:{ blockstateId:family.id, modelKey:family.modelKey, modelRefs:family.refs }
    };
  }

  return { scan, buildParts, isDynamicElementName };
})();
