/* ============================================================
   ZIP 读写 / 下载（无第三方依赖）
   - 写：Store（不压缩），兼容所有资源包工具 / 系统解压
   - 读：Store + Deflate（DecompressionStream）
   ============================================================ */
const PWArchive = (() => {
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for(let n = 0; n < 256; n++){
      let c = n;
      for(let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes){
    let c = 0xFFFFFFFF;
    for(let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder('utf-8');

  function strBytes(s){ return enc.encode(String(s)); }
  function u16(v){ return new Uint8Array([v & 255, (v >>> 8) & 255]); }
  function u32(v){ return new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]); }
  function concat(parts){
    let n = 0;
    parts.forEach(p => n += p.length);
    const out = new Uint8Array(n);
    let o = 0;
    parts.forEach(p => { out.set(p, o); o += p.length; });
    return out;
  }
  function dosTime(d){
    d = d || new Date();
    const year = Math.max(1980, d.getFullYear());
    return {
      time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31),
      date: (((year - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31)
    };
  }
  function toBytes(data){
    if(data instanceof Uint8Array) return data;
    if(data instanceof ArrayBuffer) return new Uint8Array(data);
    if(data && data.buffer instanceof ArrayBuffer) return new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength);
    if(typeof data === 'string') return strBytes(data);
    return new Uint8Array(0);
  }

  /* files: [{name, data: Uint8Array|string, date?}] */
  function create(files){
    const locals = [];
    const centrals = [];
    let offset = 0;
    (files || []).forEach(f => {
      let name = String(f.name || '').replace(/\\/g, '/').replace(/^\/+/, '');
      if(!name || /\/$/.test(name)) return;
      const nameB = strBytes(name);
      const data = toBytes(f.data);
      const crc = crc32(data);
      const dt = dosTime(f.date);
      const local = concat([
        u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(dt.time), u16(dt.date),
        u32(crc), u32(data.length), u32(data.length), u16(nameB.length), u16(0),
        nameB, data
      ]);
      locals.push(local);
      const central = concat([
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(dt.time), u16(dt.date),
        u32(crc), u32(data.length), u32(data.length), u16(nameB.length), u16(0), u16(0),
        u16(0), u16(0), u32(0), u32(offset), nameB
      ]);
      centrals.push(central);
      offset += local.length;
    });
    const cd = concat(centrals);
    const eocd = concat([
      u32(0x06054b50), u16(0), u16(0), u16(centrals.length), u16(centrals.length),
      u32(cd.length), u32(offset), u16(0)
    ]);
    return new Blob([...locals, cd, eocd], {type:'application/zip'});
  }

  function findEOCD(view, len){
    const min = Math.max(0, len - 22 - 65535);
    for(let i = len - 22; i >= min; i--){
      if(view.getUint32(i, true) === 0x06054b50) return i;
    }
    return -1;
  }

  async function inflateRaw(bytes){
    if(typeof DecompressionStream === 'undefined') throw new Error('当前浏览器不支持解压 Deflate，请用 Chrome / Edge / Safari 新版本打开');
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /* blob / ArrayBuffer -> {name, dir, size, data():Promise<Uint8Array>}[] */
  async function read(input){
    const buf = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
    const view = new DataView(buf);
    const len = buf.byteLength;
    const eocd = findEOCD(view, len);
    if(eocd < 0) throw new Error('不是有效的 ZIP（找不到目录结尾）');
    const count = view.getUint16(eocd + 10, true);
    const cdSize = view.getUint32(eocd + 12, true);
    const cdOff = view.getUint32(eocd + 16, true);
    if(cdOff + cdSize > len) throw new Error('ZIP 目录损坏');
    const entries = [];
    let p = cdOff;
    for(let i = 0; i < count; i++){
      if(view.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP 目录项损坏');
      const flags = view.getUint16(p + 8, true);
      const method = view.getUint16(p + 10, true);
      const crc = view.getUint32(p + 16, true);
      const csize = view.getUint32(p + 20, true);
      const usize = view.getUint32(p + 24, true);
      const nameLen = view.getUint16(p + 28, true);
      const extraLen = view.getUint16(p + 30, true);
      const commentLen = view.getUint16(p + 32, true);
      const localOff = view.getUint32(p + 42, true);
      const nameBytes = new Uint8Array(buf, p + 46, nameLen);
      let name = dec.decode(nameBytes);
      if(!(flags & 0x800)){
        /* 无 UTF-8 标记：先按 UTF-8 严格解码，再尝试 GBK（中文 Windows 压缩包常见） */
        try{
          name = new TextDecoder('utf-8', {fatal:true}).decode(nameBytes);
        }catch(_){
          try{ name = new TextDecoder('gbk').decode(nameBytes); }
          catch(__){ name = new TextDecoder('iso-8859-1').decode(nameBytes); }
        }
      }
      name = name.replace(/\\/g, '/');
      if(view.getUint32(localOff, true) !== 0x04034b50) throw new Error('ZIP 文件头损坏：' + name);
      const lNameLen = view.getUint16(localOff + 26, true);
      const lExtraLen = view.getUint16(localOff + 28, true);
      const dataOff = localOff + 30 + lNameLen + lExtraLen;
      entries.push({
        name,
        dir: /\/$/.test(name),
        size: usize,
        compressedSize: csize,
        crc,
        method,
        async data(){
          const raw = new Uint8Array(buf, dataOff, csize);
          if(method === 0) return raw;
          if(method === 8) return inflateRaw(raw);
          throw new Error('不支持的 ZIP 压缩方式：' + method + '（' + name + '）');
        }
      });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  function dataURLBytes(url){
    const s = String(url || '');
    const comma = s.indexOf(',');
    if(comma < 0) return new Uint8Array(0);
    const meta = s.slice(0, comma), body = s.slice(comma + 1);
    if(/;base64/i.test(meta)){
      const bin = atob(body);
      const out = new Uint8Array(bin.length);
      for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return strBytes(decodeURIComponent(body));
  }
  function bytesDataURL(bytes, mime){
    let bin = '';
    const chunk = 0x8000;
    for(let i = 0; i < bytes.length; i += chunk){
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return 'data:' + (mime || 'application/octet-stream') + ';base64,' + btoa(bin);
  }
  function blobToDataURL(blob){
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = () => rej(fr.error || new Error('读取失败'));
      fr.readAsDataURL(blob);
    });
  }
  function download(blob, filename){
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = filename || 'download.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  function safeName(s, fallback){
    let n = String(s == null ? '' : s).trim();
    n = n.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').replace(/^\.+|\.+$/g, '');
    return n || fallback || 'untitled';
  }
  function slug(s, fallback){
    let n = String(s == null ? '' : s).trim().toLowerCase();
    n = n.replace(/['’]/g, '').replace(/[^a-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
    return n || fallback || 'texture';
  }
  return {create, read, crc32, dataURLBytes, bytesDataURL, blobToDataURL, download, safeName, slug};
})();
