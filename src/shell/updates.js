/* ============================================================
   GitHub 版本检查
   - 读取公开 Release，不携带任何 token
   - 6 小时缓存，避免频繁请求 GitHub API
   ============================================================ */
const PWUpdates = (() => {
  const REPO = 'lyingice/ClastarStudio';
  const API = 'https://api.github.com/repos/' + REPO + '/releases/latest';
  const LS_KEY = 'pixelWorkshop_update_v1';
  const CACHE_MS = 6 * 60 * 60 * 1000;
  let cache = load();
  let checking = false;

  function load(){
    try{
      const d = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      return (d && typeof d === 'object') ? d : null;
    }catch(_){ return null; }
  }
  function save(){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(cache)); }catch(_){}
  }
  function parseVersion(v){
    const m = String(v || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }
  function compare(a, b){
    const x = parseVersion(a), y = parseVersion(b);
    if(!x || !y) return 0;
    for(let i=0;i<3;i++){
      if(x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
    }
    return 0;
  }
  function latestState(){
    if(!cache) return {kind:'idle', text:'点击检查 GitHub 最新版本'};
    if(cache.error) return {kind:'error', text:cache.error};
    const cmp = compare(cache.tag, APP_VERSION);
    if(cmp > 0) return {kind:'new', text:'发现新版本 ' + cache.tag + '（当前 v' + APP_VERSION + '）'};
    if(cmp === 0) return {kind:'latest', text:'已是最新版本 v' + APP_VERSION};
    return {kind:'ahead', text:'本地版本 v' + APP_VERSION + ' 高于 GitHub ' + cache.tag};
  }
  function rowHTML(){
    const st = latestState();
    const when = cache && cache.at ? new Date(cache.at).toLocaleString() : '';
    return '<div class="opt" data-set="update"' + (st.kind === 'new' ? ' data-update="new"' : '') + '>' +
      '<div class="oi">' + iconSVG('box',16) + '</div>' +
      '<div class="ot"><b>检查更新</b><span id="updStatus">' + esc(st.text) + '</span>' +
      '<i class="ost" id="updDetail">' + (when ? 'GitHub Release · ' + esc(when) : 'GitHub · ' + esc(REPO)) + '</i></div>' +
      '<span class="sc-manage">检查 ›</span></div>';
  }
  function refreshRow(){
    const row = document.querySelector('[data-set="update"]');
    if(!row) return;
    const st = latestState();
    row.dataset.update = st.kind === 'new' ? 'new' : '';
    const s = row.querySelector('#updStatus');
    if(s) s.textContent = st.text;
    const d = row.querySelector('#updDetail');
    if(d) d.textContent = cache && cache.at ? 'GitHub Release · ' + new Date(cache.at).toLocaleString() : 'GitHub · ' + REPO;
  }
  async function check(force){
    if(checking) return cache;
    if(!force && cache && !cache.error && Date.now() - (cache.at || 0) < CACHE_MS) return cache;
    checking = true;
    try{
      const res = await fetch(API, {
        cache:'no-store',
        headers:{'Accept':'application/vnd.github+json'}
      });
      if(res.status === 403){
        throw new Error('GitHub API 暂时限流，请稍后再试');
      }
      if(!res.ok) throw new Error('GitHub 返回 HTTP ' + res.status);
      const d = await res.json();
      const assets = Array.isArray(d.assets) ? d.assets : [];
      const zip = assets.find(a => /\.zip$/i.test(a.name || '') && /ClastarStudio/i.test(a.name || ''))
        || assets.find(a => /\.zip$/i.test(a.name || ''));
      cache = {
        at: Date.now(),
        tag: d.tag_name || d.name || '',
        name: d.name || d.tag_name || '',
        url: d.html_url || ('https://github.com/' + REPO + '/releases'),
        body: d.body || '',
        assetUrl: zip ? zip.browser_download_url : '',
        assetName: zip ? zip.name : '',
        error: null
      };
      save();
      return cache;
    }catch(err){
      cache = cache || { at:0 };
      cache.error = err && err.message ? err.message : String(err);
      cache.at = Date.now();
      save();
      throw err;
    }finally{
      checking = false;
      refreshRow();
    }
  }
  function openRelease(){
    const url = (cache && cache.url) || ('https://github.com/' + REPO + '/releases');
    try{ window.open(url, '_blank', 'noopener,noreferrer'); }
    catch(_){ location.href = url; }
  }
  async function checkAndShow(){
    const st = latestState();
    if(checking){ toast('正在检查 GitHub 更新…'); return; }
    if(!(cache && !cache.error && Date.now() - (cache.at || 0) < CACHE_MS)){
      toast('正在检查 GitHub 更新…');
      refreshRow();
    }
    try{
      const r = await check(true);
      const cmp = compare(r.tag, APP_VERSION);
      if(cmp > 0){
        const body = (r.body || '').replace(/\r/g,'').trim();
        const short = body.length > 900 ? body.slice(0,900) + '…' : body;
        confirmDialog('发现新版本 ' + r.tag,
          '当前版本：v' + APP_VERSION + '\n最新版本：' + r.tag + '\n\n' + (short || '打开 GitHub Release 查看更新内容。'),
          '打开下载页', openRelease);
      }else if(cmp === 0){
        toast('已是最新版本 v' + APP_VERSION);
      }else{
        toast('GitHub 最新版本是 ' + r.tag + '，本地版本更高');
      }
    }catch(err){
      toast('检查更新失败：' + (err.message || err));
      refreshRow();
    }
  }
  function init(){ refreshRow(); }
  return {init, rowHTML, refreshRow, check, checkAndShow, compare, openRelease};
})();
