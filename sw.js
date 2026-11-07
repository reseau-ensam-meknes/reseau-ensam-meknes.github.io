// Service worker du Réseau ENSAM : l'application s'ouvre depuis le téléphone, même sans réseau
// ou en 3G, et affiche les notifications envoyées par la fonction « notifier ».
// build.sh (outils/precharger.mjs) remplace la version et la liste des fichiers du site.
const VERSION = 'a9bff2620325';
const FICHIERS = ["./","admin-animer.js","admin-donnees.js","admin-ecoles.js","admin-outils.js","admin-partenaires.js","admin.js","agenda.js","ambassadeurs.js","apercu-cv.js","app.js","community.js","confiance.js","config.js","cv.js","dashboard.js","demandes.js","enquete.js","entree.js","entreprises.js","etranger.js","fondateurs-public.js","fondateurs.js","geo.js","groupes.js","growth.js","i18n.js","invitation.js","lignes.js","lire-cv.js","logic.js","logo.js","match.js","me.js","mentorat.js","messages.js","offers.js","origine.js","parse-linkedin.js","parse-offre.js","partages.js","pdf-compat.js","pdf-worker.js","photo.js","polices/texte.woff2","polices/titres.woff2","pouls.js","privacy.js","pro.js","pwa.js","pwa/badge-96.png","pwa/icon-192.png","pwa/manifest.webmanifest","rappels.js","reactions.js","recrutement.js","regles-entree.js","reseau-vivant.js","reussites.js","saison.js","scene.js","site.css","store.js","ui.js","vendor/591.supabase.js","vendor/preact-htm.js","vendor/supabase.js","vitrine-regles.js","vitrine.js"];
// L'arabe (dictionnaire, police) : gardé d'avance seulement pour qui l'avait déjà, sinon au premier usage
const FACULTATIFS = ["i18n-ar.js","polices/arabe-400.woff2","polices/arabe-500.woff2","polices/arabe-600.woff2","polices/arabe-700.woff2","polices/arabe-titres-600.woff2","polices/arabe-titres-700.woff2"];
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
  for (const k of await caches.keys()) if (k !== CACHE && k !== PHOTOS) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('message', e => { if (e.data === 'nouvelle-version') self.skipWaiting(); });

// Photos de profil (stockage « photos » de Supabase) : leurs liens signés changent à chaque visite, mais une photo ne change
// jamais sous le même nom (une nouvelle photo = un nouveau fichier). Elle est donc gardée sous son adresse sans le jeton,
// et rendue tout de suite les fois suivantes, même hors réseau. Seulement les photos (jamais les CV ni la messagerie),
// seulement des images reçues en entier ; les 300 dernières. Gardé d'une version du site à l'autre ; vidé à la déconnexion (store.js).
const PHOTOS = 'photos-v1', PHOTOS_MAX = 300;
function clePhoto(url) {
  let u; try { u = new URL(url); } catch { return null; }
  return /\/storage\/v1\/object\/sign\/photos\/./.test(u.pathname) ? u.origin + u.pathname : null;
}
self.addEventListener('fetch', e => {
  const cle = e.request.method === 'GET' ? clePhoto(e.request.url) : null;
  if (cle) e.respondWith(photoGardee(e.request, cle));
});
async function photoGardee(req, cle) {
  const c = await caches.open(PHOTOS).catch(() => null);
  const hit = c && await c.match(cle, { ignoreVary: true }).catch(() => null);
  if (hit) return hit;
  // Demandée en CORS (Supabase le permet) pour pouvoir vérifier ce qui est gardé ; sinon, comme la page l'avait demandée
  let res;
  try { res = await fetch(req.url, { mode: 'cors', credentials: 'omit' }); } catch { return fetch(req); }
  if (c && res.ok && /^image\//.test(res.headers.get('content-type') || '')) c.put(cle, res.clone()).then(() => taillerPhotos(c)).catch(() => {});
  return res;
}
// Les plus anciennes partent d'abord (ordre d'arrivée dans le cache)
async function taillerPhotos(c, max = PHOTOS_MAX) {
  const cles = await c.keys();
  for (const k of cles.slice(0, Math.max(0, cles.length - max))) await c.delete(k);
}

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
// réseau ne présente pas un vieux message comme tout frais. Une page visible garde son chiffre sur l'icône (ce qui attend
// le membre) ; sinon, le chiffre devient le nombre de notifications de la barre.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data?.text() }; }
  e.waitUntil((async () => {
    const vues = (await fenetres().catch(() => [])).filter(w => w.visibilityState === 'visible');
    const calme = !!d.calme || vues.some(w => w.focused);
    await Promise.all([self.registration.showNotification(d.title || 'Réseau ENSAM Meknès', {
      body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag && !calme, silent: calme,
      vibrate: calme ? undefined : [120, 60, 120], timestamp: Date.parse(d.at) || Date.now(),
      icon: 'pwa/icon-192.png', badge: 'pwa/badge-96.png', data: { url: d.url || './' },
    }).then(() => (vues.length ? undefined : compterBarre())), signalerRecu(d.ack)]);
  })());
});

// Les fenêtres de l'application ouvertes sur cet appareil (une page pas encore contrôlée par ce service worker comprise)
async function fenetres() {
  return (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter(w => w.url.startsWith(self.registration.scope));
}
const pageVisible = async () => (await fenetres().catch(() => [])).some(w => w.visibilityState === 'visible');

// Le chiffre sur l'icône de l'application, quand aucune page n'est visible : les notifications encore dans la barre (la page,
// visible, tient le sien : ce qui attend le membre, app.js). Un système qui n'en montre pas : rien.
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
// elle reçoit l'adresse et y va elle-même), sinon une nouvelle fenêtre. La page, devant, remet son chiffre sur l'icône
// (app.js) ; d'ici là, ou si elle reste cachée, le chiffre suit la barre.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await fenetres();
    const win = wins.find(w => w.focused) || wins.find(w => w.visibilityState === 'visible') || wins[0];
    if (win) {
      await win.focus().catch(() => {});
      if (!(await win.navigate(url).then(w => !!w, () => false))) win.postMessage({ aller: url });
      if (!(await pageVisible())) await compterBarre();
    } else await Promise.all([self.clients.openWindow(url).catch(() => null), compterBarre()]);
  })());
});
// Écartée de la barre sans l'ouvrir : le chiffre suit, sauf si une page visible tient le sien
self.addEventListener('notificationclose', e => e.waitUntil((async () => { if (!(await pageVisible())) await compterBarre(); })()));
