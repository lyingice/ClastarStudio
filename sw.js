/* 像素工坊 PWA：离线缓存。发布新版本时把 CACHE 的版本号一起改掉。 */
const CACHE = 'pixel-workshop-v1.0.0';
const ASSETS = [
  './index.html',
  './styles/shell.css',
  './styles/recolor.css',
  './styles/color-picker.css',
  './styles/sidebar.css',
  './styles/variants.css',
  './styles/shortcuts.css',
  './styles/plugins.css',
  './styles/assets.css',
  './styles/models.css',
  './styles/agent.css',
  './styles/tutorial.css',
  './src/embedded/anim.js',
  './src/embedded/block.js',
  './src/embedded/color.js',
  './src/embedded/composite.js',
  './src/embedded/ctex.js',
  './src/embedded/entity.js',
  './src/shell/archive.js',
  './src/shell/core.js',
  './src/shell/library.js',
  './src/shell/importer.js',
  './src/shell/exporter.js',
  './src/shell/extensions.js',
  './src/shell/shortcuts.js',
  './src/shell/plugins.js',
  './src/shell/assets.js',
  './src/shell/models-create.js',
  './src/shell/model-view.js',
  './src/shell/models.js',
  './src/shell/updates.js',
  './src/shell/variants.js',
  './src/shell/editors.js',
  './src/shell/color-picker.js',
  './src/shell/recolor.js',
  './src/shell/agent-texture.js',
  './src/shell/agent-model.js',
  './src/shell/agent.js',
  './src/shell/agent-ui.js',
  './src/shell/dsh-bridge.js',
  './src/shell/tutorial.js',
  './src/shell/sidebar.js',
  './src/shell/init.js',
  './plugin.json',
  './plugins/catalog.json',
  './plugins/create-texture/manifest.json',
  './plugins/create-texture/plugin.html',
  './plugins/gif-export/manifest.json',
  './plugins/gif-export/plugin.html',
  './plugins/block-library/manifest.json',
  './plugins/block-library/plugin.html',
  './integrations/blockbench/clastar-bridge.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      /* 只清理本应用旧版本缓存，不误删同域名下其他项目的 Cache Storage */
      keys.filter(k => k.startsWith('pixel-workshop-') && k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  /* local/ 素材包与 /api/ 代理不走 SW：前者是运行时可选内容，后者是动态接口 */
  const path = new URL(event.request.url).pathname;
  if(/\/(local|api)\//.test(path)) return;
  /* 页面导航走网络优先，避免开发时被旧缓存挡住；离线再回退缓存 */
  if(event.request.mode === 'navigate'){
    event.respondWith(
      fetch(event.request).then(resp => {
        if(!resp.ok) return resp;
        try{ const copy = resp.clone(); caches.open(CACHE).then(c => c.put(event.request, copy)); }catch(e){}
        return resp;
      }).catch(() => caches.match(event.request).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }
  /* 代码 / 样式 / 页面走网络优先：开发时改脚本不会被旧缓存锁死；离线再回退 */
  let sameOrigin = false;
  try{ sameOrigin = new URL(event.request.url).origin === location.origin; }catch(e){}
  if(sameOrigin && /\.(?:js|css|html|json)$/i.test(path)){
    event.respondWith(
      fetch(event.request).then(resp => {
        if(!resp.ok) return resp;
        try{ const copy = resp.clone(); caches.open(CACHE).then(c => c.put(event.request, copy)); }catch(e){}
        return resp;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(hit => {
      if(hit) return hit;
      return fetch(event.request).then(resp => {
        if(!resp.ok) return resp;
        try{
          if(sameOrigin){
            const copy = resp.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
        }catch(e){}
        return resp;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
