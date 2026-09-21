/* WA Legislation — service worker (v2).
   The whole library works with no signal, and an update only downloads what changed.

   - VER is stamped by build.py (hash of the shell + data/manifest.json), so any change to the app or the law gives a new worker.
   - Shell files live in a per-version cache (VER). Data files live in ONE shared cache, stored by content:
     ./data/<file>?v=<hash>. A new version fetches only the files whose hash changed; everything else is already there.
   - Install is all-or-nothing and every data file is checked against its hash before it is kept, so a half-deployed
     site (CDN still serving an old file) can never be mistaken for the new law. If install fails, the old version keeps serving.
   - A new version waits until the page says SKIP_WAITING (the app asks the user, or switches by itself at start-up). */
const VER = 'wal-8d716f7ed2';
const DATA_CACHE = 'wal-data';
const SHELL = ['./', './index.html', './app.css', './app.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png', './icons/icon-maskable-512.png'];
const dataKey = (name, hash) => './data/' + name + '?v=' + hash;

let manifestP = null;
function manifest() {
  if (!manifestP) manifestP = caches.open(VER).then(c => c.match('./data/manifest.json')).then(r => r ? r.json() : null).catch(() => null);
  return manifestP;
}
async function tell(msg) {
  const cs = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  cs.forEach(c => c.postMessage(msg));
}
async function sha12(buf) {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

self.addEventListener('install', e => e.waitUntil((async () => {
  try {
    const shell = await caches.open(VER);
    await shell.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })));
    const mres = await fetch('./data/manifest.json', { cache: 'no-store' });
    if (!mres.ok) throw new Error('manifest ' + mres.status);
    const man = await mres.clone().json();
    await shell.put('./data/manifest.json', mres);
    const data = await caches.open(DATA_CACHE);
    const names = Object.keys(man.files);
    const first = (await data.keys()).length === 0;
    let done = 0, next = 0, lastTold = 0;
    const one = async name => {
      const key = dataKey(name, man.files[name]);
      if (!(await data.match(key))) {
        const r = await fetch('./data/' + name, { cache: 'no-store' });
        if (!r.ok) throw new Error(name + ' ' + r.status);
        const buf = await r.arrayBuffer();
        if ((await sha12(buf)) !== man.files[name]) throw new Error(name + ' does not match its published hash yet');
        const h = new Headers(); h.set('Content-Type', r.headers.get('Content-Type') || 'application/octet-stream');
        await data.put(key, new Response(buf, { headers: h }));
      }
      done++;
      const now = Date.now();
      if (now - lastTold > 250 || done === names.length) { lastTold = now; tell({ type: 'PROGRESS', done, total: names.length }); }
    };
    const worker = async () => { while (next < names.length) await one(names[next++]); };
    await Promise.all([worker(), worker(), worker(), worker()]);
    tell({ type: 'READY', first, total: names.length });
  } catch (err) {
    await caches.delete(VER);          // leave nothing half-built behind; the browser retries on the next visit
    tell({ type: 'FAILED', reason: String(err && err.message || err) });
    throw err;
  }
})()));

self.addEventListener('activate', e => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k !== VER && k !== DATA_CACHE && k.startsWith('wal-')).map(k => caches.delete(k)));
  const man = await manifest();
  if (man) {                           // drop data files the current law no longer uses
    const keep = new Set(Object.keys(man.files).map(n => new URL(dataKey(n, man.files[n]), self.registration.scope).href));
    const data = await caches.open(DATA_CACHE);
    for (const req of await data.keys()) if (!keep.has(req.url)) await data.delete(req);
  }
  await self.clients.claim();
})()));

self.addEventListener('message', e => {
  const m = e.data || {};
  if (m.type === 'SKIP_WAITING') self.skipWaiting();
  if (m.type === 'STATUS' && e.ports && e.ports[0]) {
    (async () => {
      const man = await manifest(); if (!man) return e.ports[0].postMessage(null);
      const data = await caches.open(DATA_CACHE); let cached = 0; const names = Object.keys(man.files);
      for (const n of names) if (await data.match(dataKey(n, man.files[n]))) cached++;
      e.ports[0].postMessage({ ver: VER, built: man.built, cached, total: names.length });
    })();
  }
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  const scope = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(scope)) return;
  const rel = url.pathname.slice(scope.length);
  e.respondWith((async () => {
    const shell = await caches.open(VER);
    if (e.request.mode === 'navigate') return (await shell.match('./index.html')) || fetch(e.request);
    if (rel.startsWith('data/')) {
      const name = decodeURIComponent(rel.slice(5));
      if (name === 'manifest.json') return (await shell.match('./data/manifest.json')) || fetch(e.request);
      const man = await manifest(), hash = man && man.files[name];
      if (hash) {
        const hit = await (await caches.open(DATA_CACHE)).match(dataKey(name, hash));
        if (hit) return hit;
      }
      return fetch(e.request);        // not saved yet (first visit, still installing): straight from the network
    }
    const hit = await shell.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      if (res && res.ok && res.type === 'basic') shell.put(e.request, res.clone());
      return res;
    } catch (err) { return Response.error(); }
  })());
});
