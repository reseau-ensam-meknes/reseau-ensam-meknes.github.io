// Service worker du Réseau ENSAM : l'application s'ouvre depuis le téléphone, même sans réseau
// ou en 3G, et affiche les notifications envoyées par la fonction « notifier ».
// build.sh (outils/precharger.mjs) remplace la version et la liste des fichiers du site.
const VERSION = '7134609d3ea4';
const FICHIERS = ["./","admin-animer.js","admin-donnees.js","admin-ecoles.js","admin-outils.js","admin-partenaires.js","admin.js","agenda.js","ambassadeurs.js","apercu-cv.js","app.js","community.js","confiance.js","config.js","cv.js","dashboard.js","demandes.js","enquete.js","entree.js","entreprises.js","etranger.js","fondateurs-public.js","fondateurs.js","geo.js","groupes.js","growth.js","i18n.js","invitation.js","lignes.js","lire-cv.js","logic.js","logo.js","match.js","me.js","mentorat.js","messages.js","offers.js","origine.js","parse-linkedin.js","parse-offre.js","partages.js","pdf-compat.js","pdf-worker.js","photo.js","polices/texte.woff2","polices/titres.woff2","pouls.js","privacy.js","pro.js","pwa.js","pwa/badge-96.png","pwa/icon-192.png","pwa/manifest.webmanifest","rappels.js","reactions.js","recrutement.js","regles-entree.js","reseau-vivant.js","reussites.js","saison.js","scene.js","store.js","ui.js","vendor/591.supabase.js","vendor/preact-htm.js","vendor/supabase.js","vitrine-regles.js","vitrine.js"];
// L'arabe (dictionnaire, police) : gardé d'avance seulement pour qui l'avait déjà, sinon au premier usage
const FACULTATIFS = ["i18n-ar.js","polices/arabe-400.woff2","polices/arabe-500.woff2","polices/arabe-600.woff2","polices/arabe-700.woff2"];
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

// L'application ouverte et regardée sur cet appareil : la notification se range dans la barre sans sonner ni vibrer (la page
// montre déjà la nouveauté). Elle garde l'heure de l'évènement (d.at), pas celle de l'arrivée : un téléphone resté hors
// réseau ne présente pas un vieux message comme tout frais.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data?.text() }; }
  e.waitUntil((async () => {
    const calme = !!d.calme || await auPremierPlan().catch(() => false);
    await Promise.all([self.registration.showNotification(d.title || 'Réseau ENSAM Meknès', {
      body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag && !calme, silent: calme,
      vibrate: calme ? undefined : [120, 60, 120], timestamp: Date.parse(d.at) || Date.now(),
      icon: 'pwa/icon-192.png', badge: 'pwa/badge-96.png', data: { url: d.url || './' },
    }).then(compterBarre), signalerRecu(d.ack)]);
  })());
});

async function auPremierPlan() {
  const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return wins.some(w => w.url.startsWith(self.registration.scope) && w.visibilityState === 'visible' && w.focused);
}

// Le chiffre sur l'icône de l'application : les notifications encore dans la barre (la page, ouverte, met le sien : ce qui
// attend le membre). Un système qui n'en montre pas : rien.
async function compterBarre() {
  try {
    if (!('setAppBadge' in self.navigator)) return;
    const n = (await self.registration.getNotifications()).length;
    await (n ? self.navigator.setAppBadge(n) : self.navigator.clearAppBadge());
  } catch { /* chiffre non pris en charge */ }
}

// La preuve de réception : la base (push_recu) et la page ouverte (« Tester », Mon profil). Une erreur ne touche pas la notification.
async function signalerRecu(ack) {
  try {
    for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) c.postMessage('push-recu');
    const sub = ack && await self.registration.pushManager.getSubscription();
    if (sub) await fetch(ack.u, { method: 'POST', headers: { apikey: ack.k, Authorization: 'Bearer ' + ack.k, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_endpoint: sub.endpoint }) });
  } catch { /* hors ligne : la notification est là quand même */ }
}

// Abonnement renouvelé par le navigateur : l'appareil se réabonne tout de suite, et la page redonne le nouvel abonnement
// à la base à la prochaine ouverture (resynchroniserPush, pwa.js)
self.addEventListener('pushsubscriptionchange', e => {
  const cle = e.oldSubscription?.options?.applicationServerKey;
  if (e.newSubscription || !cle) return;
  e.waitUntil(self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cle }).catch(() => {}));
});

// Toucher la notification : la page déjà ouverte y va (navigate() refusé, page pas encore contrôlée par ce service worker :
// elle reçoit l'adresse et y va elle-même), sinon une nouvelle fenêtre
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find(w => w.url.startsWith(self.registration.scope));
    if (win) {
      await win.focus().catch(() => {});
      if (!(await win.navigate(url).then(w => !!w, () => false))) win.postMessage({ aller: url });
    } else await self.clients.openWindow(url);
    await compterBarre();
  })());
});
self.addEventListener('notificationclose', e => e.waitUntil(compterBarre()));
