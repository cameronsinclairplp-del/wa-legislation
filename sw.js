/* WA Legislation — service worker. Precaches the shell + full corpus for true
   offline; self-updating (old caches purged on activate). VER is stamped by build.py. */
const VER = 'wal-56d9ca34a9';
const SHELL = ['./','./index.html','./app.css','./app.js','./manifest.webmanifest',
  './icons/icon-192.png','./icons/icon-512.png','./icons/icon-180.png','./icons/icon-maskable-512.png'];
const SHARED = ['registry.json','search.json','defs.json','topics.json','study.json','ftext.json'];

self.addEventListener('install', e => e.waitUntil((async () => {
  const cache = await caches.open(VER);
  await cache.addAll(SHELL).catch(()=>{});
  try {
    const reg = await (await fetch('./data/registry.json', {cache:'no-store'})).json();
    const data = SHARED.concat(reg.sources.map(s => s.id + '.json')).map(f => './data/' + f);
    for (let i = 0; i < data.length; i += 6) {       // chunked so one failure can't abort all
      await cache.addAll(data.slice(i, i + 6)).catch(()=>{});
    }
  } catch (e) { /* offline install of data deferred to runtime caching */ }
  self.skipWaiting();
})()));

self.addEventListener('activate', e => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k !== VER).map(k => caches.delete(k)));
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const cache = await caches.open(VER);
    const hit = await cache.match(e.request, {ignoreSearch:true});
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      if (res && res.ok) cache.put(e.request, res.clone());
      return res;
    } catch (err) {
      if (e.request.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      return Response.error();
    }
  })());
});
