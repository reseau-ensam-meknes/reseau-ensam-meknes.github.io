// Service worker du Réseau ENSAM : l'application s'ouvre depuis le téléphone, même sans réseau
// ou en 3G, et affiche les notifications envoyées par la fonction « notifier ».
// build.sh (outils/precharger.mjs) remplace la version et la liste des fichiers du site.
const VERSION = /*VERSION*/'dev';
const FICHIERS = /*FICHIERS*/[];
// L'arabe (dictionnaire, police) : gardé d'avance seulement pour qui l'avait déjà, sinon au premier usage
const FACULTATIFS = /*FACULTATIFS*/[];
const CACHE = 'ensam-' + VERSION;

// Chaque version du site est gardée en entier, d'un coup : une page n'utilise jamais un mélange
// d'anciens et de nouveaux fichiers. La nouvelle version prend la main quand la page est cachée.
self.addEventListener('install', e => e.waitUntil((async () => {
  if (!FICHIERS.length) return self.skipWaiting();
  const c = await caches.open(CACHE);
  // no-cache : le navigateur revalide ce qu'il vient de télécharger (réponse 304, presque rien en 3G)
  await c.addAll(FICHIERS.map(f => new Request(f, { cache: 'no-cache' })));
  const deja = [];
  for (const k of await caches.keys()) {
    if (k === CACHE) continue;
    const ancien = await caches.open(k);
    for (const f of FACULTATIFS) if (!deja.includes(f) && await ancien.match(f, { ignoreSearch: true })) deja.push(f);
  }
  if (deja.length) await c.addAll(deja.map(f => new Request(f, { cache: 'no-cache' }))).catch(() => {});
})()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('message', e => { if (e.data === 'nouvelle-version') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Lien d'une promo (promo/2019/, promo/2019/ar/) : sa page ne sert qu'à l'aperçu WhatsApp. Ici, l'application gardée s'ouvre tout de suite.
  const promo = req.mode === 'navigate' && new URL(req.url).pathname.match(/\/promo\/(\d{4})\/(ar\/)?(?:index\.html)?$/);
  if (promo) return e.respondWith(Response.redirect(new URL(`./?promo=${promo[1]}${promo[2] ? '&lang=ar' : ''}`, self.registration.scope).href, 302));
  e.respondWith(FICHIERS.length ? depuisCache(req) : reseauDabord(req));
});

// Version construite : la copie gardée d'abord (immédiat), le réseau pour le reste (carte, images)
async function depuisCache(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req.mode === 'navigate' ? './' : req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') c.put(req, res.clone()).catch(() => {});
    return res;
  } catch {
    return (req.mode === 'navigate' && await c.match('./')) || Response.error();
  }
}

// Sans liste (développement) : réseau d'abord, copie locale si la connexion manque
async function reseauDabord(req) {
  try {
    const res = await fetch(req);
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
    return res;
  } catch {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') return (await caches.match('./')) || (await caches.match('index.html')) || Response.error();
    return Response.error();
  }
}

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Réseau ENSAM Meknès', {
    body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag,
    icon: 'pwa/icon-192.png', badge: 'pwa/badge-96.png', data: { url: d.url || './' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find(w => w.url.startsWith(self.registration.scope));
    if (win) { await win.focus(); return win.navigate(url).catch(() => {}); }
    return self.clients.openWindow(url);
  })());
});
