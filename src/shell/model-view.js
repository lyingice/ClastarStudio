/* ============================================================
   模型集预览
   ------------------------------------------------------------
   轻量 Canvas 2D 等距渲染，只读 .bbmodel 的 cuboid / group / 纹理。
   不是完整 Blockbench：不支持 mesh、UV 旋转、动画时间轴。
   ============================================================ */
const PWModelView = (() => {
  const FACE_ORDER = ['north','south','east','west','up','down'];
  const BOX_FACES = {
    north:[[0,1,0],[1,1,0],[1,0,0],[0,0,0]],
    south:[[1,1,1],[0,1,1],[0,0,1],[1,0,1]],
    west: [[0,1,1],[0,1,0],[0,0,0],[0,0,1]],
    east: [[1,1,0],[1,1,1],[1,0,1],[1,0,0]],
    up:   [[0,1,0],[0,1,1],[1,1,1],[1,1,0]],
    down: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]]
  };
  const ROLE_COLOR = { static:'#8c9b82', dynamic:'#c08352', item:'#5f8fae', overlay:'#8f6aa6' };
  const texCache = new Map();

  function safeImage(src){ return /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(String(src || '')); }
  function euler(rot){
    if(Array.isArray(rot)) return [+rot[0] || 0, +rot[1] || 0, +rot[2] || 0];
    if(rot && typeof rot === 'object') return [+rot.x || 0, +rot.y || 0, +rot.z || 0];
    return [0,0,0];
  }
  function rotateAxis(p, axis, deg, pivot){
    if(!deg || axis === 'none') return p;
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    let x = p[0] - pivot[0], y = p[1] - pivot[1], z = p[2] - pivot[2];
    if(axis === 'x'){
      const y2 = y*c - z*s, z2 = y*s + z*c; y = y2; z = z2;
    }else if(axis === 'z'){
      const x2 = x*c - y*s, y2 = x*s + y*c; x = x2; y = y2;
    }else{
      const x2 = x*c + z*s, z2 = -x*s + z*c; x = x2; z = z2;
    }
    return [x + pivot[0], y + pivot[1], z + pivot[2]];
  }
  function rotateEuler(p, rot, origin){
    const [rx, ry, rz] = euler(rot);
    if(!rx && !ry && !rz) return p;
    const o = origin || [8,8,8];
    let x = p[0] - o[0], y = p[1] - o[1], z = p[2] - o[2];
    if(rx){
      const a = rx * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      const y2 = y*c - z*s, z2 = y*s + z*c; y = y2; z = z2;
    }
    if(ry){
      const a = ry * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      const x2 = x*c + z*s, z2 = -x*s + z*c; x = x2; z = z2;
    }
    if(rz){
      const a = rz * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      const x2 = x*c - y*s, y2 = x*s + y*c; x = x2; y = y2;
    }
    return [x + o[0], y + o[1], z + o[2]];
  }
  function cross(a, b){
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  }
  function faceBright(pts){
    const a = [pts[1][0]-pts[0][0], pts[1][1]-pts[0][1], pts[1][2]-pts[0][2]];
    const b = [pts[3][0]-pts[0][0], pts[3][1]-pts[0][1], pts[3][2]-pts[0][2]];
    const n = cross(a, b);
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    const ny = n[1]/len, nx = n[0]/len;
    if(Math.abs(ny) > 0.5) return ny > 0 ? 1 : 0.55;
    if(Math.abs(nx) > 0.5) return 0.68;
    return 0.82;
  }
  function loadTexture(src){
    if(!safeImage(src)) return null;
    let rec = texCache.get(src);
    if(!rec){
      rec = { img:new Image(), ready:false, failed:false, hooks:[] };
      rec.img.onload = () => { rec.ready = true; const hs = rec.hooks; rec.hooks = []; hs.forEach(fn => { try{ fn(); }catch(_){} }); };
      rec.img.onerror = () => { rec.failed = true; const hs = rec.hooks; rec.hooks = []; hs.forEach(fn => { try{ fn(); }catch(_){} }); };
      rec.img.src = src;
      texCache.set(src, rec);
    }
    return rec;
  }

  function collectCubes(raw){
    const elements = Array.isArray(raw.elements) ? raw.elements : [];
    const out = [], seen = new Set();
    function walk(items, groups){
      (items || []).forEach(item => {
        if(typeof item === 'number'){
          const el = elements[item];
          if(el){ out.push({ el, groups }); seen.add(item); }
        }else if(item && Array.isArray(item.children)){
          const g = { origin:item.origin || [8,8,8], rotation:item.rotation || [0,0,0] };
          walk(item.children, groups.concat([g]));
        }else if(item && item.from && item.to){
          out.push({ el:item, groups });
        }
      });
    }
    walk(raw.outliner || [], []);
    elements.forEach((el, i) => { if(!seen.has(i) && el && el.from && el.to) out.push({ el, groups:[] }); });
    return out;
  }

  function resolveTexture(raw, face){
    const list = Array.isArray(raw.textures) ? raw.textures : [];
    let tex = null;
    if(typeof face.texture === 'number') tex = list[face.texture] || null;
    else if(typeof face.texture === 'string'){
      const key = face.texture.startsWith('#') ? face.texture.slice(1) : face.texture;
      tex = list.find(t => String(t.id) === key || t.name === key || t.uuid === key) || null;
    }
    return tex ? loadTexture(tex.source) : null;
  }

  function render(canvas, set, opts){
    opts = opts || {};
    const parts = (set.parts || []).filter(p => p && p.raw);
    const angle = +opts.angle || 0;
    const yaw = opts.yaw == null ? -35 : opts.yaw;
    const pitch = opts.pitch == null ? 26 : opts.pitch;
    const zoom = opts.zoom || 1;
    const roleThis = opts.roles === false ? false : true;

    const W = Math.max(1, +opts.width || canvas.clientWidth || 320);
    const H = Math.max(1, +opts.height || canvas.clientHeight || 220);
    const DPR = Math.min(2, +opts.dpr || window.devicePixelRatio || 1);
    if(canvas.width !== Math.round(W*DPR) || canvas.height !== Math.round(H*DPR)){
      canvas.width = Math.round(W*DPR); canvas.height = Math.round(H*DPR);
    }
    const ctx = canvas.getContext('2d');
    let dead = false;

    const rawFaces = [];
    parts.forEach(part => {
      const raw = part.raw || {};
      const uvW = +(raw.resolution && raw.resolution.width) || 16;
      const uvH = +(raw.resolution && raw.resolution.height) || 16;
      collectCubes(raw).forEach(({ el, groups }) => {
        const from = el.from || [0,0,0], to = el.to || [16,16,16];
        const inf = +el.inflate || 0;
        const a = [from[0]-inf, from[1]-inf, from[2]-inf];
        const b = [to[0]+inf, to[1]+inf, to[2]+inf];
        FACE_ORDER.forEach(dir => {
          const f = el.faces && el.faces[dir];
          if(!f) return;
          const pts = BOX_FACES[dir].map(([rx,ry,rz]) => {
            let p = [a[0]+(b[0]-a[0])*rx, a[1]+(b[1]-a[1])*ry, a[2]+(b[2]-a[2])*rz];
            p = rotateEuler(p, el.rotation, el.origin || [8,8,8]);
            for(let i = groups.length-1; i >= 0; i--) p = rotateEuler(p, groups[i].rotation, groups[i].origin);
            if(part.role === 'dynamic' && angle && (part.axis || 'y') !== 'none'){
              p = rotateAxis(p, part.axis || 'y', angle, part.pivot || [8,8,8]);
            }
            return p;
          });
          let uv = Array.isArray(f.uv) && f.uv.length >= 4 ? f.uv : [0,0,uvW,uvH];
          rawFaces.push({ pts, uv, uvW, uvH, tex:resolveTexture(raw, f), role:part.role || 'static' });
        });
      });
    });
    if(!rawFaces.length){
      ctx.setTransform(DPR,0,0,DPR,0,0);
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle = '#7f8a78';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('模型没有可预览的立方体', W/2, H/2);
      return { redraw(){}, destroy(){ dead = true; } };
    }

    const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
    rawFaces.forEach(f => f.pts.forEach(p => {
      for(let i=0;i<3;i++){ if(p[i] < min[i]) min[i] = p[i]; if(p[i] > max[i]) max[i] = p[i]; }
    }));
    const center = [(min[0]+max[0])/2, (min[1]+max[1])/2, (min[2]+max[2])/2];
    const cy = Math.cos(yaw*Math.PI/180), sy = Math.sin(yaw*Math.PI/180);
    const cp = Math.cos(pitch*Math.PI/180), sp = Math.sin(pitch*Math.PI/180);
    function viewPoint(p){
      const x = p[0]-center[0], y = p[1]-center[1], z = p[2]-center[2];
      const X = x*cy + z*sy, Z = -x*sy + z*cy;
      return [X, y*cp - Z*sp, y*sp + Z*cp];
    }
    let vMinX = Infinity, vMaxX = -Infinity, vMinY = Infinity, vMaxY = -Infinity;
    rawFaces.forEach(f => f.pts.forEach(p => {
      const v = viewPoint(p);
      if(v[0] < vMinX) vMinX = v[0]; if(v[0] > vMaxX) vMaxX = v[0];
      if(v[1] < vMinY) vMinY = v[1]; if(v[1] > vMaxY) vMaxY = v[1];
    }));
    const spanX = Math.max(0.001, vMaxX - vMinX), spanY = Math.max(0.001, vMaxY - vMinY);
    const pad = 18;
    const scale = Math.min((W-pad*2)/spanX, (H-pad*2)/spanY) * zoom;
    function proj(v){ return [W/2 + v[0]*scale, H/2 - v[1]*scale, v[2]]; }

    function drawQuad(poly, img, uv, uvW, uvH){
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      if(!iw || !ih) return false;
      const u1 = Math.min(uv[0],uv[2])/uvW, u2 = Math.max(uv[0],uv[2])/uvW;
      const v1 = Math.min(uv[1],uv[3])/uvH, v2 = Math.max(uv[1],uv[3])/uvH;
      const sx = u1*iw, sy = v1*ih, sw = (u2-u1)*iw, sh = (v2-v1)*ih;
      if(sw < 0.4 || sh < 0.4) return false;
      const s0 = [sx,sy], s1 = [sx+sw,sy], s2 = [sx,sy+sh];
      const d0 = poly[0], d1 = poly[1], d2 = poly[3];
      const den = (s1[0]-s0[0])*(s2[1]-s0[1]) - (s2[0]-s0[0])*(s1[1]-s0[1]);
      if(Math.abs(den) < 1e-6) return false;
      const a = ((d1[0]-d0[0])*(s2[1]-s0[1]) - (d2[0]-d0[0])*(s1[1]-s0[1]))/den;
      const b = ((d1[1]-d0[1])*(s2[1]-s0[1]) - (d2[1]-d0[1])*(s1[1]-s0[1]))/den;
      const c = ((d2[0]-d0[0])*(s1[0]-s0[0]) - (d1[0]-d0[0])*(s2[0]-s0[0]))/den;
      const d = ((d2[1]-d0[1])*(s1[0]-s0[0]) - (d1[1]-d0[1])*(s2[0]-s0[0]))/den;
      ctx.save();
      pathPoly(poly);
      ctx.clip();
      ctx.transform(a,b,c,d,d0[0]-a*s0[0]-c*s0[1], d0[1]-b*s0[0]-d*s0[1]);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img,0,0);
      ctx.restore();
      return true;
    }
    function pathPoly(poly){
      ctx.beginPath();
      ctx.moveTo(poly[0][0], poly[0][1]);
      for(let i=1;i<4;i++) ctx.lineTo(poly[i][0], poly[i][1]);
      ctx.closePath();
    }
    function shade(poly, bright, color){
      if(bright < 0.999){
        ctx.save(); pathPoly(poly); ctx.fillStyle = 'rgba(0,0,0,' + ((1-bright)*0.52).toFixed(3) + ')'; ctx.fill(); ctx.restore();
      }
      if(color){
        ctx.save(); pathPoly(poly); ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      }
    }

    function draw(){
      if(dead) return;
      ctx.setTransform(DPR,0,0,DPR,0,0);
      ctx.clearRect(0,0,W,H);
      const drawable = [];
      rawFaces.forEach(f => {
        const n = cross(
          [f.pts[1][0]-f.pts[0][0], f.pts[1][1]-f.pts[0][1], f.pts[1][2]-f.pts[0][2]],
          [f.pts[3][0]-f.pts[0][0], f.pts[3][1]-f.pts[0][1], f.pts[3][2]-f.pts[0][2]]
        );
        const X = n[0]*cy + n[2]*sy, Z = -n[0]*sy + n[2]*cy;
        const Z2 = n[1]*sp + Z*cp;
        if(Z2 > -1e-4) return;
        const pp = f.pts.map(p => proj(viewPoint(p)));
        const z = (pp[0][2]+pp[1][2]+pp[2][2]+pp[3][2])/4;
        drawable.push({ poly:pp, uv:f.uv, uvW:f.uvW, uvH:f.uvH, tex:f.tex, role:f.role, bright:faceBright(f.pts), z });
      });
      drawable.sort((a,b) => b.z - a.z);
      drawable.forEach(f => {
        const img = f.tex && f.tex.ready ? f.tex.img : null;
        let textured = false;
        if(img) textured = drawQuad(f.poly, img, f.uv, f.uvW, f.uvH);
        if(!textured){
          ctx.save(); pathPoly(f.poly); ctx.fillStyle = ROLE_COLOR[f.role] || ROLE_COLOR.static; ctx.fill(); ctx.restore();
        }
        shade(f.poly, f.bright, !textured);
        if(f.tex && !f.tex.ready && !f.tex.failed){
          if(!f.tex.hooks.includes(schedule)) f.tex.hooks.push(schedule);
        }
      });
    }
    let pending = false;
    function schedule(){
      if(dead || pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; draw(); });
    }
    draw();
    return { redraw:draw, destroy(){ dead = true; } };
  }

  function thumbnail(set, size){
    const c = document.createElement('canvas');
    const dpr = 1;
    return new Promise(resolve => {
      let done = false, view = null;
      const finish = () => {
        if(done) return;
        done = true;
        try{ resolve(c.toDataURL('image/png')); }catch(_){ resolve(null); }
        if(view) view.destroy();
      };
      view = render(c, set, { width:size, height:size, dpr, yaw:-35, pitch:26, angle:0 });
      setTimeout(finish, 900);
    });
  }

  return { render, thumbnail };
})();
