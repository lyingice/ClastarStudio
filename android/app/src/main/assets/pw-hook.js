/* 像素工坊 · Android 外壳注入脚本
   只做一件事：把 data:/blob: 的下载交给原生保存。
   WebView 的 DownloadListener 只接管 http(s)，导出资源包 / GIF 用的是
   a[download] + data:/blob:，不拦截就会静默失败。 */
(function () {
  if (window.__pwAndroidHooked) return;
  window.__pwAndroidHooked = 1;

  if (typeof PWAndroid === 'undefined') return;

  function saveBlobUrl(name, url) {
    fetch(url).then(function (r) { return r.blob(); }).then(function (b) {
      return new Promise(function (res, rej) {
        var fr = new FileReader();
        fr.onload = function () { res(fr.result); };
        fr.onerror = rej;
        fr.readAsDataURL(b);
      });
    }).then(function (dataUrl) {
      PWAndroid.saveDataUrl(name, dataUrl);
    }).catch(function (err) {
      PWAndroid.toastMsg('导出失败：' + (err && err.message ? err.message : err));
    });
  }

  function handle(name, href) {
    if (!href) return false;
    if (href.indexOf('data:') === 0) { PWAndroid.saveDataUrl(name, href); return true; }
    if (href.indexOf('blob:') === 0) { saveBlobUrl(name, href); return true; }
    return false;
  }

  /* 1) 程序化触发：a.click() */
  var rawClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    try {
      var name = this.getAttribute('download') || '';
      var href = this.getAttribute('href') || this.href || '';
      if (name && handle(name, href)) return;
    } catch (e) {}
    return rawClick.apply(this, arguments);
  };

  /* 2) 用户真点链接 */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (!a) return;
    var name = a.getAttribute('download') || '';
    var href = a.getAttribute('href') || a.href || '';
    if (name && handle(name, href)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
})();
