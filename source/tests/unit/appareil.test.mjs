// Chaque téléphone abonnable : navigateurs intégrés des applications, lien « Ouvrir dans Chrome », feuille d'ouverture
// selon l'appareil (iPhone, administration), lien « Active tes notifications », échecs passagers de l'abonnement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navigateurIntegre, lienChrome, ouvertureSorte, OUVERTURE_IOS_ECART, ouvertureNotif, sorteLienNotifs, parametresLien, noterEchecPush, echecDefinitif, bandeauPush } from '../../src/logic.js';
import * as logique from '../../src/logic.js';
import { SupabaseStore } from '../../src/store.js';
import { langueDuLien } from '../../src/regles-entree.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const NOW = Date.UTC(2026, 10, 1, 12);
const J = 864e5;

// De vrais user-agents (téléphones de 2025-2026)
const UA = {
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36',
  safariIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1',
  ordinateur: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  instagramAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.43 Mobile Safari/537.36 Instagram 400.0.0.40.79 Android (34/14; 450dpi; 1080x2340; samsung; SM-A546B; a54x; s5e8835; fr_FR; 812345678)',
  instagramIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 400.0.0.30.75 (iPhone15,3; iOS 18_6; fr_FR; fr; scale=3.00; 1290x2796; 812345678)',
  facebookAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240905.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.43 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/490.0.0.46.79;]',
  facebookIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/490.0.0.38.107;FBBV/700000000;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/18.6;FBSS/3;FBCR/;FBID/phone;FBLC/fr_FR;FBOP/80]',
  messengerAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240905.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.43 Mobile Safari/537.36 [FB_IAB/MESSENGER;FBAV/480.0.0.49.108;]',
  messengerIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/480.0.0.41.108;FBBV/680000000;FBDV/iPhone15,3]',
  linkedin: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.31.1820',
  tiktok: 'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.43 Mobile Safari/537.36 musical_ly_2024100030 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/41.0.3 ByteLocale/fr ByteFullLocale/fr Region/MA BytedanceWebview/d8a21c6',
  snapchat: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/13.60.0.43 (like Safari/8618.1.15.10.15, panda)',
  vueWeb: 'Mozilla/5.0 (Linux; Android 13; M2101K6G Build/TKQ1.221013.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.43 Mobile Safari/537.36',
};

test('navigateur intégré : Instagram, Facebook, Messenger, LinkedIn, TikTok, Snapchat et la vue web Android, sur Android et sur iPhone', () => {
  assert.deepEqual(navigateurIntegre(UA.instagramAndroid), { nom: 'Instagram', systeme: 'android' });
  assert.deepEqual(navigateurIntegre(UA.instagramIos), { nom: 'Instagram', systeme: 'ios' });
  assert.deepEqual(navigateurIntegre(UA.facebookAndroid), { nom: 'Facebook', systeme: 'android' });
  assert.deepEqual(navigateurIntegre(UA.facebookIos), { nom: 'Facebook', systeme: 'ios' });
  assert.deepEqual(navigateurIntegre(UA.messengerAndroid), { nom: 'Messenger', systeme: 'android' }, 'Messenger avant Facebook');
  assert.deepEqual(navigateurIntegre(UA.messengerIos), { nom: 'Messenger', systeme: 'ios' });
  assert.deepEqual(navigateurIntegre(UA.linkedin), { nom: 'LinkedIn', systeme: 'ios' });
  assert.deepEqual(navigateurIntegre(UA.tiktok), { nom: 'TikTok', systeme: 'android' });
  assert.deepEqual(navigateurIntegre(UA.snapchat), { nom: 'Snapchat', systeme: 'ios' });
  assert.deepEqual(navigateurIntegre(UA.vueWeb), { nom: null, systeme: 'android' }, 'une vue web Android quelconque');
});

test('navigateur intégré : jamais pour un vrai navigateur (Chrome, Samsung Internet, Safari, Chrome sur iPhone, ordinateur)', () => {
  for (const k of ['chromeAndroid', 'samsung', 'safariIos', 'chromeIos', 'ordinateur']) assert.equal(navigateurIntegre(UA[k]), null, k);
  assert.equal(navigateurIntegre(''), null);
  assert.equal(navigateurIntegre(undefined), null);
});

test('« Ouvrir dans Chrome » : un lien intent:// vers la même page, la route en ?r=, la feuille d’activation demandée, la même adresse en secours', () => {
  const l = lienChrome('https://reseau-ensam-meknes.github.io/#offres/demandes/abc', 'offres/demandes/abc');
  assert.equal(l, 'intent://reseau-ensam-meknes.github.io/?r=offres%2Fdemandes%2Fabc&notifs=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url='
    + encodeURIComponent('https://reseau-ensam-meknes.github.io/?r=offres%2Fdemandes%2Fabc&notifs=1') + ';end');
  // L'accueil n'a pas besoin de route ; les autres paramètres restent ; un ancien r, notifs ou depuis ne se répète pas
  assert.equal(lienChrome('https://reseau-ensam-meknes.github.io/?lang=ar&r=x&depuis=ancienne#accueil', 'accueil'),
    'intent://reseau-ensam-meknes.github.io/?lang=ar&notifs=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent('https://reseau-ensam-meknes.github.io/?lang=ar&notifs=1') + ';end');
  assert.match(lienChrome('http://127.0.0.1:4312/', ''), /^intent:\/\/127\.0\.0\.1:4312\/\?notifs=1#Intent;scheme=http;package=com\.android\.chrome;/);
  // L'adresse de secours se relit : la route et la demande d'activation reviennent telles quelles
  const secours = decodeURIComponent(l.match(/S\.browser_fallback_url=([^;]+);/)[1]);
  assert.deepEqual(parametresLien(new URL(secours).search), { r: 'offres/demandes/abc', notifs: true, depuis: '', search: '', aucun: false });
});

test('paramètres d’adresse : r, notifs=1 et depuis=ancienne lus puis retirés, le reste gardé ; une route bizarre est ignorée', () => {
  assert.deepEqual(parametresLien(''), { r: '', notifs: false, depuis: '', search: '', aucun: true });
  assert.deepEqual(parametresLien('?promo=2019&lang=ar'), { r: '', notifs: false, depuis: '', search: '?promo=2019&lang=ar', aucun: true });
  assert.deepEqual(parametresLien('?notifs=1'), { r: '', notifs: true, depuis: '', search: '', aucun: false });
  assert.deepEqual(parametresLien('?depuis=ancienne&lang=ar'), { r: '', notifs: false, depuis: 'ancienne', search: '?lang=ar', aucun: false });
  assert.deepEqual(parametresLien('?r=messages%2F42&notifs=1'), { r: 'messages/42', notifs: true, depuis: '', search: '', aucun: false });
  assert.equal(parametresLien('?r=%23mentorat').r, 'mentorat');
  for (const x of ['javascript:alert(1)', '<b>', 'a b', 'x'.repeat(201)]) assert.equal(parametresLien('?r=' + encodeURIComponent(x)).r, '', x);
  assert.equal(parametresLien('?notifs=0').notifs, false);
  assert.equal(parametresLien('?depuis=ailleurs').depuis, '');
  assert.equal(parametresLien('?depuis=ailleurs').aucun, false, 'retiré quand même');
});

const s = x => ouvertureSorte({ etat: 'off', now: NOW, ...x });

test('feuille d’ouverture : l’administration aussi (les signalements ne partent que vers un appareil abonné)', () => {
  assert.equal(ouvertureNotif({ etat: 'off', role: 'admin', now: NOW }), true);
  assert.equal(s({ role: 'admin' }), 'push');
  assert.equal(s({}), 'push');
  assert.equal(s({ memo: { fait: 1 } }), null);
  assert.equal(s({ memo: { n: 1, at: NOW - J } }), null, 'pas avant 2 jours');
  assert.equal(s({ memo: { n: 1, at: NOW - 2 * J } }), 'push');
  for (const etat of ['on', 'absent', 'refuse', 'demo', '…']) assert.equal(s({ etat }), null, etat);
});

test('feuille d’ouverture sur iPhone dans Safari : une fois, puis une seule autre fois 14 jours après', () => {
  assert.equal(OUVERTURE_IOS_ECART, 14 * J);
  assert.equal(s({ etat: 'ios' }), 'ios');
  assert.equal(s({ etat: 'ios', memo: { ios: { n: 1, at: NOW - 13 * J } } }), null);
  assert.equal(s({ etat: 'ios', memo: { ios: { n: 1, at: NOW - 14 * J } } }), 'ios');
  assert.equal(s({ etat: 'ios', memo: { ios: { n: 2, at: NOW - 60 * J } } }), null, 'deux fois en tout');
  // Son mémo est à part : « Plus tard » sur la feuille ordinaire ou « Me prévenir » ne la retiennent pas
  assert.equal(s({ etat: 'ios', memo: { n: 3, at: NOW - J } }), 'ios');
  assert.equal(s({ etat: 'ios', memo: { coupe: 1 } }), null, 'coupées dans Mon profil');
  assert.equal(s({ etat: 'ios', voulu: false }), null, 'rien de coché');
  assert.equal(s({ etat: 'ios', memo: { differe: 'demande' } }), null, '« Me prévenir » remis à cette visite passe avant');
});

test('feuille d’ouverture dans le navigateur d’une application : une fois par visite au plus', () => {
  assert.equal(s({ etat: 'appli' }), 'appli');
  assert.equal(s({ etat: 'appli', appliVue: true }), null);
  assert.equal(s({ etat: 'appli', memo: { n: 5, at: NOW, fait: 1 } }), 'appli', 'le mémo des autres feuilles n’y change rien');
  assert.equal(s({ etat: 'appli', memo: { coupe: 1 } }), null);
  assert.equal(s({ etat: 'appli', voulu: false }), null);
});

test('lien « Active tes notifications » : la feuille de cet appareil tout de suite, sauf déjà activées ou coupées par le membre', () => {
  const l = x => sorteLienNotifs({ memo: {}, ...x });
  assert.equal(l({ etat: 'off' }), 'push');
  assert.equal(l({ etat: 'off', memo: { fait: 1, n: 4, at: NOW } }), 'push', 'un lien touché exprès passe outre les refus d’avant');
  assert.equal(l({ etat: 'on' }), 'deja');
  assert.equal(l({ etat: 'ios' }), 'ios');
  assert.equal(l({ etat: 'appli' }), 'appli');
  assert.equal(l({ etat: 'refuse' }), 'debloquer');
  assert.equal(l({ etat: 'absent' }), 'absent');
  assert.equal(l({ etat: 'off', memo: { coupe: 1 } }), null);
  for (const etat of ['…', 'demo', undefined]) assert.equal(l({ etat }), null, String(etat));
});

test('bandeau de l’accueil : le navigateur d’une application aussi', () => {
  assert.equal(bandeauPush({ etat: 'appli', role: 'etudiant', now: NOW }), 'appli');
  assert.equal(bandeauPush({ etat: 'appli', role: 'etudiant', now: NOW, memo: { bandeau: NOW - J } }), null);
  assert.equal(bandeauPush({ etat: 'appli', role: 'etudiant', now: NOW, memo: { coupe: 1 } }), null);
});

test('échec passager de l’abonnement : noté par jour, arrêt seulement au deuxième jour différent', () => {
  const midi = NOW, soir = NOW + 6 * 3600e3, lendemain = NOW + J;
  const a = noterEchecPush({}, midi);
  assert.equal(a.arret, false); assert.equal(a.echecs.length, 1);
  const b = noterEchecPush({ echecs: a.echecs }, soir);
  assert.equal(b.arret, false, 'deux échecs le même jour : on réessaiera'); assert.deepEqual(b.echecs, a.echecs);
  const c = noterEchecPush({ echecs: b.echecs }, lendemain);
  assert.equal(c.arret, true); assert.equal(c.echecs.length, 2);
  // Seuls les deux derniers jours sont gardés ; un mémo abîmé ne casse rien
  assert.equal(noterEchecPush({ echecs: c.echecs }, NOW + 5 * J).echecs.length, 2);
  assert.deepEqual(noterEchecPush({ echecs: 'x' }, midi).echecs, a.echecs);
  assert.deepEqual(noterEchecPush({ echecs: [1, null] }, midi).echecs, a.echecs);
});

test('erreur définitive ou passagère : NotSupportedError, NotAllowedError et Brave arrêtent ; AbortError et le réseau passent', () => {
  assert.equal(echecDefinitif({ name: 'NotSupportedError' }), true);
  assert.equal(echecDefinitif({ name: 'NotAllowedError' }), true);
  assert.equal(echecDefinitif({ name: 'AbortError' }, { brave: true }), true);
  assert.equal(echecDefinitif({ name: 'AbortError' }), false);
  assert.equal(echecDefinitif(new TypeError('Failed to fetch')), false);
  assert.equal(echecDefinitif({ name: 'InvalidStateError' }), false);
  assert.equal(echecDefinitif(undefined), false);
});

// Se déconnecter : cet appareil ne reçoit plus les notifications de ce compte (son abonnement est retiré de la base pendant
// que la session le permet encore) ; celui du navigateur reste, pour le prochain compte connecté ici.
function deconnexion({ registration, effacer } = {}) {
  const appels = [];
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', unsubscribe: async () => { appels.push('navigateur désabonné'); return true; } };
  const reg = { pushManager: { getSubscription: async () => sub } };
  const avant = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serviceWorker: { getRegistration: registration || (async () => reg) } } });
  const s = new SupabaseStore({});
  s.session = { user: { id: 'moi' } };
  s.sb = {
    from: table => ({ delete: () => ({ eq: (col, val) => { appels.push(`${table} : ${col} = ${val}`); return effacer ? effacer() : Promise.resolve({ error: null }); } }) }),
    auth: { signOut: async () => { appels.push('session fermée'); return { error: null }; } },
  };
  const remettre = () => { if (avant) Object.defineProperty(globalThis, 'navigator', avant); else delete globalThis.navigator; };
  return { s, appels, remettre };
}
const vider = () => new Promise(ok => setImmediate(ok));

test('déconnexion : l’abonnement de cet appareil retiré de la base d’abord, puis la session ; celui du navigateur reste', async () => {
  const { s, appels, remettre } = deconnexion();
  try {
    await s.signOut();
    assert.deepEqual(appels, ['push_subscriptions : endpoint = https://fcm.googleapis.com/fcm/send/abc', 'session fermée']);
  } finally { remettre(); }
});

test('déconnexion hors ligne ou service worker muet : quelques secondes au plus, la session se ferme quand même', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  // Le service worker ne répond pas : 1,5 s
  let d = deconnexion({ registration: () => new Promise(() => {}) });
  try {
    let fini = false; d.s.signOut().then(() => { fini = true; });
    await vider(); assert.equal(fini, false);
    t.mock.timers.tick(1500); await vider();
    assert.equal(fini, true); assert.deepEqual(d.appels, ['session fermée']);
  } finally { d.remettre(); }
  // La base ne répond pas : 3 s
  d = deconnexion({ effacer: () => new Promise(() => {}) });
  try {
    let fini = false; d.s.signOut().then(() => { fini = true; });
    await vider(); t.mock.timers.tick(2999); await vider(); assert.equal(fini, false);
    t.mock.timers.tick(1); await vider();
    assert.equal(fini, true); assert.equal(d.appels.at(-1), 'session fermée');
  } finally { d.remettre(); }
  // Une erreur de la base n'empêche rien
  d = deconnexion({ effacer: () => Promise.reject(new Error('réseau')) });
  try { await d.s.signOut(); assert.equal(d.appels.at(-1), 'session fermée'); } finally { d.remettre(); }
});

test('clé publique de la plateforme : demandée une fois pour la visite, même par deux feuilles à la fois ; un échec n’est pas gardé', async () => {
  const s = new SupabaseStore({});
  let n = 0, rep = { data: null, error: { message: 'injoignable' } };
  s.sb = { functions: { invoke: async (nom, { body }) => { n++; assert.equal(nom, 'notifier'); assert.equal(body.job, 'cle'); return rep; } } };
  assert.equal(await s.pushKey(), null);
  rep = { data: { publicKey: 'BEl62' }, error: null };
  assert.deepEqual(await Promise.all([s.pushKey(), s.pushKey()]), ['BEl62', 'BEl62']);
  assert.equal(await s.pushKey(), 'BEl62');
  assert.equal(n, 2, 'redemandée après l’échec, puis gardée');
});

test('« Ouvrir dans Chrome » en arabe : la langue de la page suit (?lang=ar, lue pour la visite) ; en français, Chrome garde son choix', () => {
  const ar = lienChrome('https://reseau-ensam-meknes.github.io/#mentorat', 'mentorat', { lang: 'ar' });
  assert.match(ar, /^intent:\/\/reseau-ensam-meknes\.github\.io\/\?lang=ar&r=mentorat&notifs=1#Intent;scheme=https;package=com\.android\.chrome;/);
  const secours = new URL(decodeURIComponent(ar.match(/S\.browser_fallback_url=([^;]+);/)[1]));
  assert.equal(langueDuLien(secours.search, null), 'ar', 'Chrome ouvre la page en arabe');
  assert.deepEqual(parametresLien(secours.search), { r: 'mentorat', notifs: true, depuis: '', search: '?lang=ar', aucun: false }, 'la langue reste dans l’adresse');
  // Un ?lang=ar resté dans l'adresse d'une page lue en français ne fait pas passer Chrome à l'arabe
  assert.match(lienChrome('https://reseau-ensam-meknes.github.io/?lang=ar', '', { lang: 'fr' }), /^intent:\/\/reseau-ensam-meknes\.github\.io\/\?notifs=1#Intent;/);
  assert.match(lienChrome('https://reseau-ensam-meknes.github.io/?promo=2019', '', { lang: 'fr' }), /\?promo=2019&notifs=1#Intent;/);
});

test('abonnement impossible pour de bon sur ce navigateur (memo.sans) : ni bandeau ni feuille d’ouverture ; le lien touché exprès réessaie', () => {
  const sans = { fait: 1, sans: 1 };
  assert.equal(bandeauPush({ etat: 'off', role: 'etudiant', now: NOW, memo: sans }), null);
  assert.equal(bandeauPush({ etat: 'off', role: 'etudiant', now: NOW, memo: { fait: 1 } }), 'off', 'activées puis perdues : le bandeau le redit');
  assert.equal(bandeauPush({ etat: 'refuse', role: 'etudiant', now: NOW, memo: sans }), 'refuse', 'bloquées depuis : les gestes pour débloquer');
  assert.equal(bandeauPush({ etat: 'appli', role: 'etudiant', now: NOW, memo: sans }), 'appli');
  assert.equal(s({ memo: sans }), null);
  assert.equal(sorteLienNotifs({ etat: 'off', memo: sans }), 'push');
});

// Le service worker : chargé tel quel, avec un faux navigateur autour (fenêtres de l'application, barre de notifications, chiffre)
const SW = readFileSync(new URL('../../src/sw.js', import.meta.url), 'utf8');
const SCOPE = 'https://reseau-ensam-meknes.github.io/';
function travailleur({ fenetres = [], chiffre = true, ouvrir = async url => ({ url }) } = {}) {
  const ecoute = {}, journal = [], barre = [];
  const self = {
    addEventListener: (type, f) => { ecoute[type] = f; },
    registration: {
      scope: SCOPE,
      showNotification: async (titre, o) => { barre.push({ titre, ...o }); },
      getNotifications: async () => barre.slice(),
      pushManager: { getSubscription: async () => null },
    },
    clients: { matchAll: async () => fenetres, openWindow: async url => { journal.push('ouverte ' + url); return ouvrir(url); } },
    navigator: chiffre ? { setAppBadge: async n => { journal.push('chiffre ' + n); }, clearAppBadge: async () => { journal.push('chiffre effacé'); } } : {},
  };
  vm.runInNewContext(SW, { self, URL, console });
  const lancer = async (type, ev = {}) => { let fin; ecoute[type]({ ...ev, waitUntil: p => { fin = p; } }); await fin; };
  const pousser = d => lancer('push', { data: { json: () => d, text: () => JSON.stringify(d) } });
  // Touchée, elle se ferme d'elle-même (close) ; écartée, elle a déjà quitté la barre
  const toucher = (url, type = 'notificationclick') => { if (type === 'notificationclose') barre.shift(); return lancer(type, { notification: { data: { url }, close: () => { barre.shift(); } } }); };
  return { lancer, pousser, toucher, journal, barre };
}
const fenetre = (journal, { visible = false, focused = false, url = SCOPE + '#accueil', naviguer = true } = {}) => {
  const w = {
    url, focused, visibilityState: visible ? 'visible' : 'hidden',
    focus: async () => { journal.push('devant'); w.visibilityState = 'visible'; w.focused = true; return w; },
    navigate: async u => { if (!naviguer) throw new TypeError('page pas contrôlée'); journal.push('va ' + u); return w; },
    postMessage: m => { journal.push(typeof m === 'string' ? m : 'message ' + JSON.stringify(m)); },
  };
  return w;
};

test('service worker : application fermée, la notification sonne, garde l’heure de l’évènement, et le chiffre compte la barre', async () => {
  const t = travailleur();
  await t.pousser({ title: 'Nouveau message', body: 'Salma : bonjour', tag: 'message:42', url: '#messages/42', at: '2026-10-31T08:00:00Z' });
  const n = t.barre[0];
  assert.equal(n.titre, 'Nouveau message');
  assert.equal(n.silent, false); assert.equal(n.renotify, true); assert.deepEqual(Array.from(n.vibrate), [120, 60, 120]);
  assert.equal(n.timestamp, Date.parse('2026-10-31T08:00:00Z'));
  assert.deepEqual({ ...n.data }, { url: '#messages/42' });
  assert.deepEqual(t.journal, ['chiffre 1']);
  await t.pousser({ title: 'Offre', body: '…' });
  assert.deepEqual(t.journal, ['chiffre 1', 'chiffre 2']);
  assert.ok(Math.abs(t.barre[1].timestamp - Date.now()) < 5000, 'sans heure : l’arrivée');
  assert.equal(t.barre[1].renotify, false, 'sans tag, rien à renouveler');
  // Un contenu illisible : le texte brut, sous le nom du Réseau
  await t.lancer('push', { data: { json: () => { throw new SyntaxError('x'); }, text: () => 'Bonjour' } });
  assert.equal(t.barre[2].titre, 'Twiza'); assert.equal(t.barre[2].body, 'Bonjour');
});

test('service worker : application regardée, la notification se range sans bruit ; une page visible garde son chiffre', async () => {
  const journal = [];
  // Au premier plan : sans son ni vibration, et le chiffre de la page reste
  let t = travailleur({ fenetres: [fenetre(journal, { visible: true, focused: true })] });
  await t.pousser({ title: 'Nouveau message', tag: 'message:42' });
  assert.equal(t.barre[0].silent, true); assert.equal(t.barre[0].renotify, false); assert.equal(t.barre[0].vibrate, undefined);
  assert.deepEqual(t.journal, []);
  // Visible mais une autre fenêtre devant (ordinateur) : elle sonne, la page garde son chiffre
  t = travailleur({ fenetres: [fenetre(journal, { visible: true })] });
  await t.pousser({ title: 'Nouveau message' });
  assert.equal(t.barre[0].silent, false); assert.deepEqual(t.journal, []);
  // Cachée (un autre onglet, l'écran éteint) : elle sonne, et le chiffre compte la barre
  t = travailleur({ fenetres: [fenetre(journal)] });
  await t.pousser({ title: 'Nouveau message' });
  assert.equal(t.barre[0].silent, false); assert.deepEqual(t.journal, ['chiffre 1']);
  // Demandée calme par la plateforme (rappel du soir) : sans bruit même application fermée
  t = travailleur();
  await t.pousser({ title: 'Rappel', calme: true });
  assert.equal(t.barre[0].silent, true);
  // Une fenêtre d'un autre site n'est pas l'application
  t = travailleur({ fenetres: [fenetre(journal, { visible: true, focused: true, url: 'https://exemple.org/' })] });
  await t.pousser({ title: 'Nouveau message' });
  assert.equal(t.barre[0].silent, false); assert.deepEqual(t.journal, ['chiffre 1']);
});

test('service worker : toucher la notification ouvre sa page ; écartée, le chiffre suit la barre sauf si une page visible tient le sien', async () => {
  // Aucune fenêtre : une nouvelle, et le chiffre suit la barre (la page ouverte mettra le sien)
  let t = travailleur();
  await t.pousser({ title: 'A', url: '#messages/1' }); await t.pousser({ title: 'B' });
  t.journal.length = 0;
  await t.toucher('#messages/1');
  assert.deepEqual(t.journal.sort(), ['chiffre 1', 'ouverte ' + SCOPE + '#messages/1'].sort());
  // Une page cachée : devant, elle va à l'adresse ; visible, c'est elle qui remet son chiffre (rien d'ici)
  let journal = [];
  t = travailleur({ fenetres: [fenetre(journal)] });
  await t.pousser({ title: 'A' }); journal.length = 0; t.journal.length = 0;
  await t.toucher('#mentorat');
  assert.deepEqual(journal, ['devant', 'va ' + SCOPE + '#mentorat']);
  assert.deepEqual(t.journal, []);
  // Page pas encore contrôlée par ce service worker : elle reçoit l'adresse et y va elle-même ; la fenêtre devant d'abord
  journal = [];
  const cachee = fenetre(journal, { url: SCOPE + '#offres' }), devant = fenetre(journal, { visible: true, focused: true, naviguer: false });
  t = travailleur({ fenetres: [cachee, devant] });
  await t.toucher('#offres');
  assert.deepEqual(journal, ['devant', 'message {"aller":"' + SCOPE + '#offres"}']);
  assert.equal(cachee.focused, false, 'pas la fenêtre cachée');
  // Le navigateur refuse de la mettre devant : elle reste cachée, le chiffre suit la barre
  journal = [];
  const tetue = fenetre(journal); tetue.focus = async () => { throw new Error('pas permis'); };
  t = travailleur({ fenetres: [tetue] });
  await t.pousser({ title: 'A' }); await t.pousser({ title: 'B' }); t.journal.length = 0;
  await t.toucher('#accueil');
  assert.deepEqual(t.journal, ['chiffre 1']);
  // Écartée sans l'ouvrir : le chiffre suit la barre (0 : effacé)…
  t = travailleur();
  await t.pousser({ title: 'A' }); t.journal.length = 0;
  await t.toucher('#accueil', 'notificationclose');
  assert.deepEqual(t.journal, ['chiffre effacé']);
  // … sauf quand une page visible tient le sien
  t = travailleur({ fenetres: [fenetre([], { visible: true })] });
  await t.pousser({ title: 'A' });
  await t.toucher('#accueil', 'notificationclose');
  assert.deepEqual(t.journal, []);
  // Un système sans chiffre sur les icônes : rien ne casse
  t = travailleur({ chiffre: false });
  await t.pousser({ title: 'A' }); await t.toucher('#accueil');
  assert.deepEqual(t.journal, ['ouverte ' + SCOPE + '#accueil']);
});

// Toutes les portes : la page d'entrée dans le navigateur d'une application (sa carte, « Ouvrir dans Chrome » avec ce que le
// visiteur avait déjà choisi), Telegram, l'iPad, et le lien « Active tes notifications » quand tout est décoché.
// appareil.js : le module que la page d'entrée charge à part (sans logic.js), que logic.js réexporte.
const appareil = () => import('../../src/appareil.js');
const UA2 = {
  telegram: 'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.43 Mobile Safari/537.36 Telegram-Android/12.1.1 (Samsung SM-A546B; Android 14; SDK 34; HIGH)',
  telegramBot: 'TelegramBot (like TwitterBot)',
  // iPadOS se présente comme un Mac : seul l'écran tactile (navigator.maxTouchPoints) le distingue
  safariIPadOS: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
  safariIPad: 'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  instagramIPad: 'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 400.0.0.30.75 (iPad13,18; iPadOS 18_6; fr_FR; fr; scale=2.00; 1640x2360; 812345678)',
  linkedinIPadOS: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) [LinkedInApp]/9.31.1820',
};

test('navigateur intégré : Telegram aussi (jamais son robot d’aperçu des liens) ; logic.js réexporte les règles d’appareil.js', async () => {
  const a = await appareil();
  assert.deepEqual(navigateurIntegre(UA2.telegram), { nom: 'Telegram', systeme: 'android' });
  assert.equal(navigateurIntegre(UA2.telegramBot), null);
  assert.ok(a.APPLIS.some(([nom]) => nom === 'Telegram'));
  for (const k of ['APPLIS', 'estIPad', 'navigateurIntegre', 'contexteEntree', 'lienChrome', 'parametresLien', 'CLE_APPLI_VUE']) assert.equal(logique[k], a[k], k);
});

test('iPad : son nom, ou iPadOS (un « Mac » à écran tactile) ; un vrai Mac ou un iPhone n’en sont pas', async () => {
  const { estIPad } = await appareil();
  assert.equal(estIPad(UA2.safariIPad), true);
  assert.equal(estIPad(UA2.instagramIPad, 5), true);
  assert.equal(estIPad(UA2.safariIPadOS, 5), true);
  assert.equal(estIPad(UA2.safariIPadOS, 0), false, 'un Mac');
  assert.equal(estIPad(UA2.safariIPadOS, 1), false);
  assert.equal(estIPad(UA.safariIos, 5), false, 'un iPhone');
  assert.equal(estIPad(UA.chromeAndroid, 5), false);
  assert.equal(estIPad(undefined, undefined), false);
});

test('navigateur intégré sur iPadOS : reconnu comme iOS grâce à l’écran tactile ; Safari sur iPad reste un vrai navigateur', () => {
  assert.deepEqual(navigateurIntegre(UA2.linkedinIPadOS, 5), { nom: 'LinkedIn', systeme: 'ios' });
  assert.deepEqual(navigateurIntegre(UA2.linkedinIPadOS, 0), { nom: 'LinkedIn', systeme: 'autre' }, 'sans écran tactile : un ordinateur');
  assert.deepEqual(navigateurIntegre(UA2.instagramIPad), { nom: 'Instagram', systeme: 'ios' });
  assert.equal(navigateurIntegre(UA2.safariIPadOS, 5), null);
  assert.equal(navigateurIntegre(UA2.safariIPad, 5), null);
});

test('contexte emporté dans Chrome : une promo valable, un rôle, une étape ; rien d’autre (ni email, ni valeur bizarre)', () => {
  const c = x => logique.contexteEntree(x);
  assert.deepEqual(c({ promo: 2019, role: 'laureat', mode: 'connexion' }), { promo: '2019', role: 'laureat', mode: 'connexion' });
  assert.deepEqual(c({ promo: '2027', role: 'etudiant', mode: 'inscription' }), { promo: '2027', role: 'etudiant', mode: 'inscription' });
  assert.deepEqual(c({ promo: 1989 }), {}, 'avant la première promo');
  for (const promo of [2041, '2019x', 2019.5, '', null]) assert.deepEqual(c({ promo }), {}, String(promo));
  assert.deepEqual(c({ role: 'admin', mode: 'motdepasse' }), {}, 'ni l’admin, ni l’étape du mot de passe');
  assert.deepEqual(c({ email: 'salma@ensam-umi.ac.ma', accord: true }), {}, 'jamais l’email ni l’accord');
  assert.deepEqual(c(undefined), {});
  assert.deepEqual(c(null), {});
});

test('« Ouvrir dans Chrome » depuis la page d’entrée : la langue, la promo du lien, le rôle choisi et l’étape partent avec la page', () => {
  const l = lienChrome('https://reseau-ensam-meknes.github.io/', '', { lang: 'ar', contexte: { promo: 2019, role: 'laureat', mode: 'connexion' } });
  const cible = 'https://reseau-ensam-meknes.github.io/?lang=ar&promo=2019&role=laureat&mode=connexion&notifs=1';
  assert.equal(l, `intent://${cible.slice(8)}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(cible)};end`);
  // Un lien partagé (une offre) passe en ?r= comme une route ; une valeur qui ne va pas reste en dehors
  assert.match(lienChrome('https://reseau-ensam-meknes.github.io/#offre/abc-123', 'offre/abc-123', { lang: 'fr', contexte: { role: 'pirate', mode: 'inscription' } }),
    /^intent:\/\/reseau-ensam-meknes\.github\.io\/\?mode=inscription&r=offre%2Fabc-123&notifs=1#Intent;/);
  // Une promo déjà dans l'adresse n'est pas répétée
  assert.match(lienChrome('https://reseau-ensam-meknes.github.io/?promo=2019', '', { contexte: { promo: 2019 } }), /^intent:\/\/reseau-ensam-meknes\.github\.io\/\?promo=2019&notifs=1#Intent;/);
});

test('contexte emporté dans Chrome : le code de qui invite et l’école du lien, seulement bien formés', () => {
  const c = x => logique.contexteEntree(x);
  assert.deepEqual(c({ promo: 2019, de: 'nadia219', ecole: 'ensam-casa', role: 'laureat', mode: 'inscription' }), { promo: '2019', de: 'nadia219', ecole: 'ensam-casa', role: 'laureat', mode: 'inscription' });
  for (const de of ['Nadia219', 'nadia21', 'nadia2190', 'nadia<b>', '', null, 12345678]) assert.deepEqual(c({ de }), {}, String(de));
  for (const ecole of ['ENSAM Casa', 'e', '../x', 'a'.repeat(41), '', null]) assert.deepEqual(c({ ecole }), {}, String(ecole));
  assert.match(lienChrome('https://reseau-ensam-meknes.github.io/', '', { contexte: { promo: 2019, de: 'nadia219', ecole: 'ensam-casa', mode: 'inscription' } }),
    /^intent:\/\/reseau-ensam-meknes\.github\.io\/\?promo=2019&de=nadia219&ecole=ensam-casa&mode=inscription&notifs=1#Intent;/);
});

// entree.js se charge ici sans navigateur : son démarrage ne tourne pas (window.ENSAM_ENTREE déjà posé)
async function pageEntree() {
  const avant = { window: globalThis.window, document: globalThis.document };
  globalThis.window = { ENSAM_ENTREE: true };
  globalThis.document ??= { documentElement: {} };
  try { return await import('../../src/entree.js'); } finally {
    for (const [k, v] of Object.entries(avant)) if (v === undefined) delete globalThis[k]; else globalThis[k] = v;
  }
}

test('arrivée dans Chrome : la page d’entrée relit le rôle, l’étape et le lien partagé, laisse la promo, la langue et notifs=1 à leur lecteur', async () => {
  const { contexteArrivee } = await pageEntree();
  const l = lienChrome('https://reseau-ensam-meknes.github.io/#offre/abc-123', 'offre/abc-123', { lang: 'ar', contexte: { promo: 2027, role: 'etudiant', mode: 'connexion' } });
  const secours = new URL(decodeURIComponent(l.match(/S\.browser_fallback_url=([^;]+);/)[1]));
  const a = contexteArrivee(secours.search);
  assert.deepEqual(a, { role: 'etudiant', mode: 'connexion', lien: { k: 'offre', id: 'abc-123', r: 'offre/abc-123' }, ici: false, search: '?lang=ar&promo=2027&notifs=1', aucun: false });
  // Ce qui reste : la promo (lireInvitation), l'arabe pour la visite (i18n.js), la feuille d'activation après la connexion (app.js)
  const reste = new URLSearchParams(a.search);
  assert.equal(reste.get('promo'), '2027');
  assert.equal(langueDuLien(a.search, null), 'ar');
  assert.deepEqual(parametresLien(a.search), { r: '', notifs: true, depuis: '', search: '?lang=ar&promo=2027', aucun: false });
  // Une route de membre (pas un lien partagé) reste pour app.js ; une valeur bizarre ne compte pas
  assert.deepEqual(contexteArrivee('?r=mentorat&notifs=1'), { role: null, mode: null, lien: null, ici: false, search: '?r=mentorat&notifs=1', aucun: true });
  assert.deepEqual(contexteArrivee('?role=admin&mode=motdepasse'), { role: null, mode: null, lien: null, ici: false, search: '', aucun: false }, 'retirés quand même');
  assert.equal(contexteArrivee('').aucun, true);
  assert.equal(contexteArrivee('?promo=2019&lang=ar').aucun, true, 'un lien de promo ordinaire : l’adresse ne change pas ici');
});

// La page d'entrée sait tout de suite si une carte viendra (appliIci, sans attendre appareil.js) : même réponse que
// navigateurIntegre pour chaque user-agent, chaque nom d'application (toutes ses formes, en majuscules ou minuscules), sur
// Android, iPhone, iPadOS et ordinateur
test('page d’entrée : la carte prévue dès le premier affichage (appliIci) dit toujours la même chose que navigateurIntegre', async () => {
  const { appliIci } = await pageEntree();
  const { APPLIS } = await appareil();
  const bases = [UA.chromeAndroid, UA.vueWeb, UA.safariIos, UA.ordinateur, UA2.safariIPadOS, 'Mozilla/5.0 (Linux; Android 14; wv)', ''];
  const jetons = APPLIS.flatMap(([, re]) => re.source.split('|').map(x => x.replace(/\\b/g, '').replace(/\\\//g, '/')));
  assert.ok(jetons.length >= 15, jetons.join(' '));
  const corpus = [...Object.values(UA), ...Object.values(UA2)];
  for (const b of bases) for (const j of jetons) for (const f of [x => x, x => x.toLowerCase(), x => x.toUpperCase()]) corpus.push(`${b} ${f(j)}/1.0`, `${b} [${f(j)};]`);
  let cartes = 0;
  for (const ua of corpus) for (const toucher of [0, 1, 5, undefined]) {
    const n = navigateurIntegre(ua, toucher), attendu = n && ['android', 'ios'].includes(n.systeme) ? n.systeme : '';
    assert.equal(appliIci(ua, toucher), attendu, `${ua} (${toucher})`);
    if (attendu) cartes++;
  }
  assert.ok(cartes > 100, 'le corpus contient bien des navigateurs d’application');
  for (const ua of [undefined, null, 42]) assert.equal(appliIci(ua), '');
});

test('page d’entrée : la place gardée pour la carte ne grandit jamais avec la largeur de l’écran ; plus grande avec un texte agrandi', async () => {
  const { placeCarte } = await pageEntree();
  // Le bord (et sur Android, la ligne des boutons) en px, puis le texte en rem : rem() lit le texte, px() le tout à 16 px le rem
  const lire = x => x.match(/^calc\(([\d.]+)px \+ ([\d.]+)rem\)$/).slice(1).map(Number);
  const rem = x => lire(x)[1], px = x => lire(x)[0] + 16 * lire(x)[1];
  for (const sys of ['android', 'ios']) for (const lang of ['fr', 'ar']) {
    let avant = Infinity;
    for (let w = 300; w < 900; w += 2) { const h = rem(placeCarte(sys, lang, w)); assert.ok(h <= avant, `${sys} ${lang} ${w}`); avant = h; }
    assert.ok(rem(placeCarte(sys, lang, 360, 20)) >= rem(placeCarte(sys, lang, 360)), 'texte agrandi : au moins la même place');
    assert.ok(rem(placeCarte(sys, lang, 1280)) > 0, 'ordinateur');
  }
  assert.equal(placeCarte('android', 'fr', 360), 'calc(46.5px + 7.39rem)', 'Instagram à 360 px : quatre lignes et les deux gestes');
  // iPhone : un paragraphe (la phrase, le geste, « Continuer ici »), quatre lignes à 390 px et cinq à 375, sans ligne de boutons
  assert.equal(placeCarte('ios', 'fr', 390), 'calc(2px + 6.56rem)');
  assert.equal(placeCarte('ios', 'fr', 375), 'calc(2px + 7.89rem)');
  assert.ok(px(placeCarte('ios', 'fr', 390)) < px(placeCarte('android', 'fr', 390)), 'plus courte que la carte d’Android et ses boutons');
});

test('page d’entrée : la place de la ligne discrète (après « Continuer ici ») suit sa phrase, jamais moins de 44 px', async () => {
  const { placeMot } = await pageEntree();
  const px = x => (x.endsWith('rem') ? parseFloat(x) * 16 : parseFloat(x));
  // iPhone : le geste de Safari en trois lignes sur un petit écran, deux (dans 44 px) au-delà
  assert.equal(placeMot('ios', 'fr', 360), '3.44rem');
  assert.equal(placeMot('ios', 'fr', 390), '44px');
  // Android, après Chrome : « Rien ne s'ouvre ? » ; l'arabe, plus court, tient dans 44 px
  assert.equal(placeMot('android', 'fr', 360), '3.42rem');
  assert.equal(placeMot('android', 'ar', 360), '44px');
  for (const sys of ['android', 'ios']) for (const lang of ['fr', 'ar']) {
    let avant = Infinity;
    for (let w = 280; w < 900; w += 2) { const h = px(placeMot(sys, lang, w)); assert.ok(h >= 44 && h <= avant, `${sys} ${lang} ${w}`); avant = h; }
  }
});

// Sur téléphone, la carte ne vient que si « Recevoir mon code » tient encore avec elle au premier écran (e2e « Recevoir mon
// code au premier écran ») ; sinon sa ligne discrète. La fenêtre d'Instagram ou de Facebook : 360 × 640 sur la plupart des
// téléphones Android, 360 × 700 avec la navigation par gestes, 375 × 553 sur un iPhone SE, 390 × 664 sur un iPhone 13
test('page d’entrée : la carte du navigateur d’une application seulement si « Recevoir mon code » tient encore avec elle au premier écran', async () => {
  const { carteTient } = await pageEntree();
  for (const [sys, lang, largeur, hauteur] of [['android', 'fr', 360, 640], ['android', 'ar', 360, 640], ['android', 'fr', 360, 700], ['android', 'fr', 360, 740], ['android', 'fr', 390, 664],
    ['android', 'fr', 320, 740], ['ios', 'fr', 375, 553], ['ios', 'ar', 375, 553], ['ios', 'fr', 390, 664]]) assert.equal(carteTient(sys, lang, largeur, hauteur), false, `${sys} ${lang} ${largeur} × ${hauteur}`);
  for (const [sys, lang, largeur, hauteur] of [['android', 'fr', 360, 800], ['android', 'ar', 360, 740], ['android', 'fr', 412, 780], ['ios', 'fr', 393, 690], ['ios', 'ar', 375, 667],
    ['ios', 'fr', 390, 844]]) assert.equal(carteTient(sys, lang, largeur, hauteur), true, `${sys} ${lang} ${largeur} × ${hauteur}`);
  // Assez haut, elle tient toujours ; un texte agrandi demande plus de place, jamais moins
  for (const sys of ['android', 'ios']) for (const lang of ['fr', 'ar']) for (let w = 300; w < 900; w += 2) {
    assert.ok(carteTient(sys, lang, w, 900), `${sys} ${lang} ${w} × 900`);
    for (const h of [600, 700, 760, 820]) if (carteTient(sys, lang, w, h, 20)) assert.ok(carteTient(sys, lang, w, h), `${sys} ${lang} ${w} × ${h}, texte agrandi`);
  }
});

// pwa.js (lienIci) : « Ouvrir dans Chrome » n'est montré qu'à un membre connecté ; Chrome ne le connaît pas encore
test('« Ouvrir dans Chrome » d’un membre connecté : sa page et l’étape « Se connecter » partent avec le lien ; la page d’entrée de Chrome les relit', async () => {
  const { contexteArrivee } = await pageEntree();
  const l = lienChrome('https://reseau-ensam-meknes.github.io/#offres', 'offres', { lang: 'fr', contexte: { mode: 'connexion' } });
  assert.equal(l, 'intent://reseau-ensam-meknes.github.io/?mode=connexion&r=offres&notifs=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Freseau-ensam-meknes.github.io%2F%3Fmode%3Dconnexion%26r%3Doffres%26notifs%3D1;end');
  const secours = new URL(decodeURIComponent(l.match(/S\.browser_fallback_url=([^;]+);/)[1]));
  assert.deepEqual(contexteArrivee(secours.search), { role: null, mode: 'connexion', lien: null, ici: false, search: '?r=offres&notifs=1', aucun: false }, 'la page du membre reste pour app.js');
});

// Sans Chrome, l'application rouvre l'adresse de secours dans son propre navigateur. Sans stockage (vue web sans stockage
// DOM), seule l'adresse peut dire à la page qu'elle revient de là : ici=1, dans l'adresse de secours seulement
test('« Ouvrir dans Chrome » de la carte : l’adresse de secours porte ici=1 (jamais celle que Chrome ouvre) ; la page d’entrée le lit puis le retire', async () => {
  const { contexteArrivee } = await pageEntree();
  const l = lienChrome('https://reseau-ensam-meknes.github.io/?promo=2019&lang=ar#offre/abc-123', 'offre/abc-123', { lang: 'ar', contexte: { promo: 2019, mode: 'inscription' }, ici: true });
  const cible = 'https://reseau-ensam-meknes.github.io/?promo=2019&lang=ar&mode=inscription&r=offre%2Fabc-123&notifs=1';
  assert.equal(l, `intent://${cible.slice(8)}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(cible + '&ici=1')};end`);
  const secours = new URL(decodeURIComponent(l.match(/S\.browser_fallback_url=([^;]+);/)[1]));
  assert.deepEqual(contexteArrivee(secours.search), { role: null, mode: 'inscription', lien: { k: 'offre', id: 'abc-123', r: 'offre/abc-123' }, ici: true, search: '?promo=2019&lang=ar&notifs=1', aucun: false });
  assert.deepEqual(contexteArrivee('?ici=1'), { role: null, mode: null, lien: null, ici: true, search: '', aucun: false }, 'seule, la marque est lue et retirée');
  assert.equal(contexteArrivee('?ici=0').ici, false);
  // Une marque restée dans l'adresse ne part jamais vers Chrome ; sans ici, l'adresse de secours est celle de Chrome
  assert.doesNotMatch(lienChrome('https://reseau-ensam-meknes.github.io/?ici=1', '').split('#Intent')[0], /ici/);
  assert.doesNotMatch(lienChrome('https://reseau-ensam-meknes.github.io/', '', { lang: 'fr' }), /ici/);
});

test('carte de la page d’entrée : « d’Instagram », « de Facebook », « d’une application » ; ses phrases d’Android et d’iPhone', async () => {
  const { CARTE, APPLIS } = await appareil();
  assert.equal(CARTE.tuEs('Instagram'), 'Tu es dans le navigateur d’Instagram.');
  assert.equal(CARTE.tuEs('Facebook'), 'Tu es dans le navigateur de Facebook.');
  assert.equal(CARTE.tuEs('Messenger'), 'Tu es dans le navigateur de Messenger.');
  assert.equal(CARTE.tuEs(null), 'Tu es dans le navigateur d’une application.');
  for (const [nom] of APPLIS) assert.match(CARTE.tuEs(nom), new RegExp(`^Tu es dans le navigateur (d’|de )${nom}\\.$`), nom);
  assert.equal(CARTE.android, 'Ouvre le Réseau dans Chrome : tu y resteras connecté et tes notifications arriveront sur ce téléphone.');
  assert.equal(CARTE.geste, 'Touche ••• (en haut ou en bas de l’écran), puis « Ouvrir dans Safari » ou « Ouvrir dans le navigateur ».');
  assert.equal(CARTE.ios, 'Ouvre le Réseau dans Safari : tu y resteras connecté.');
  // Sur iPhone et iPad, la carte tient en un paragraphe : plus de ligne sur l'icône de l'écran d'accueil, que les feuilles de
  // l'application redisent au moment d'activer les notifications
  assert.equal(CARTE.icone, undefined);
  // Mêmes mots que la feuille de l'application (pwa.js), et même arabe
  const pwa = readFileSync(new URL('../../src/pwa.js', import.meta.url), 'utf8');
  assert.ok(pwa.includes(`const APPLI_RIEN = '${CARTE.rien}';`));
});

// Le geste pour passer dans Safari : une seule phrase, dans la carte de l'entrée (et son mot discret) comme dans les feuilles
// de l'application (pwa.js l'importe d'appareil.js), avec un seul arabe
test('le geste de Safari (iPhone, iPad) : le même dans la carte de l’entrée et dans les feuilles de l’application, avec un seul arabe', async () => {
  const { CARTE, CARTE_AR, GESTE_SAFARI } = await appareil();
  assert.equal(CARTE.geste, GESTE_SAFARI);
  const pwa = readFileSync(new URL('../../src/pwa.js', import.meta.url), 'utf8');
  assert.match(pwa, /^import \{[^}]*\bGESTE_SAFARI\b[^}]*\} from '\.\/appareil\.js';$/m);
  assert.match(pwa, /ios: \[\s*\['more', GESTE_SAFARI\],/, 'la première étape de la feuille (ETAPES_APPLI.ios) est cette phrase');
  assert.ok(!pwa.includes(GESTE_SAFARI.slice(0, 30)), 'pas de seconde copie dans pwa.js');
  assert.ok(pwa.includes('[GESTE_SAFARI]: CARTE_AR[GESTE_SAFARI],'), 'l’arabe de la carte, pas un second');
  assert.equal(CARTE_AR[GESTE_SAFARI], 'المس ••• (أعلى الشاشة أو أسفلها)، ثم «فتح في Safari» أو «فتح في المتصفح».');
});

// Le nom de l'application, Chrome et Safari, mis à part dans une phrase déjà traduite : la page d'entrée (CarteAppli) et les
// feuilles de l'application (avecNoms, pwa.js) entourent chacun d'un <span translate="no" dir="auto">
test('noms latins d’une phrase (l’application, Chrome, Safari, iPad) : mis à part pour leur <span translate="no" dir="auto">, sans l’isolant d’i18n.js', async () => {
  const { nomsLatins, CARTE, CARTE_AR, APPLIS } = await appareil();
  assert.deepEqual(nomsLatins('Tu es dans le navigateur d’Instagram.'), ['Tu es dans le navigateur d’', 'Instagram', '.']);
  assert.deepEqual(nomsLatins('أنت في متصفح ⁨Instagram⁩.'), ['أنت في متصفح ', 'Instagram', '.'], 'FSI…PDI partent avec le nom');
  assert.deepEqual(nomsLatins(CARTE_AR[CARTE.ouvrir]), ['فتح في ', 'Chrome', '']);
  assert.deepEqual(nomsLatins(CARTE.geste).filter((_, i) => i % 2), ['Safari']);
  assert.deepEqual(nomsLatins(CARTE_AR[CARTE.rien]).filter((_, i) => i % 2), ['Chrome']);
  for (const [nom] of APPLIS) assert.deepEqual(nomsLatins(CARTE.tuEs(nom)).filter((_, i) => i % 2), [nom], nom);
  assert.deepEqual(nomsLatins(CARTE.ici), ['Continuer ici'], 'sans nom : la phrase entière');
  assert.deepEqual(nomsLatins(CARTE.tuEs()), [CARTE.tuEs()]);
  assert.deepEqual(nomsLatins('Chromebook, Safarix'), ['Chromebook, Safarix'], 'des mots entiers');
  assert.deepEqual(nomsLatins(null), [null]);
  // L'iPad aussi (le titre de la feuille d'ouverture, Mon profil) ; iPadOS reste un mot entier
  assert.deepEqual(nomsLatins('Reçois l’essentiel sur ton iPad'), ['Reçois l’essentiel sur ton ', 'iPad', '']);
  assert.deepEqual(nomsLatins('يتلقى جهاز iPad هذا إشعارات هذا الحساب.'), ['يتلقى جهاز ', 'iPad', ' هذا إشعارات هذا الحساب.']);
  assert.deepEqual(nomsLatins('Safari sur iPadOS'), ['', 'Safari', ' sur iPadOS']);
  // Les deux pages s'en servent, avec un span qui garde translate="no" dans le DOM (Preact en ferait translate="yes")
  for (const f of ['entree.js', 'pwa.js']) {
    const src = readFileSync(new URL(`../../src/${f}`, import.meta.url), 'utf8');
    assert.match(src, /nomsLatins\(/, f);
    assert.match(src, /<span translate="no" dir="auto" ref=\$\{sansTraduction\}>/, f);
    assert.match(src, /const sansTraduction = el => el\?\.setAttribute\('translate', 'no'\);/, f);
  }
});

test('carte de la page d’entrée en arabe : chaque phrase, et le nom de chaque application gardé en lettres latines', async () => {
  const { CARTE, CARTE_AR, CARTE_MOTIFS, APPLIS } = await appareil();
  const avant = globalThis.document;
  globalThis.document ??= { documentElement: {} };
  const i18n = await import('../../src/i18n.js');
  try {
    i18n.addAR(CARTE_AR, CARTE_MOTIFS);
    await i18n.setLang('ar', { garder: false });
    const phrases = [CARTE.tuEs(), CARTE.android, CARTE.ios, CARTE.geste, CARTE.ouvrir, CARTE.ici, CARTE.ligne, CARTE.rien];
    i18n.missing.clear();
    for (const p of phrases) {
      const ar = i18n.t(p);
      assert.match(ar, /[؀-ۿ]/, p);
      assert.doesNotMatch(ar, /\b(Tu|tu|Ouvre|Ouvrir|Touche|Sur|Continuer|Rien|ou|puis|dans)\b/, p);
    }
    assert.equal(i18n.t(CARTE.tuEs()), 'أنت في متصفح أحد التطبيقات.', 'le dictionnaire passe avant le motif');
    for (const [nom] of APPLIS) assert.equal(i18n.t(CARTE.tuEs(nom)), `أنت في متصفح ⁨${nom}⁩.`, nom);
    assert.deepEqual([...i18n.missing], []);
    const pwa = readFileSync(new URL('../../src/pwa.js', import.meta.url), 'utf8');
    assert.ok(pwa.includes(`[APPLI_RIEN]: '${CARTE_AR[CARTE.rien]}'`), 'le même arabe que la feuille');
    assert.ok(pwa.includes(`'${CARTE.ouvrir}': '${CARTE_AR[CARTE.ouvrir]}'`));
  } finally {
    await i18n.setLang('fr', { garder: false });
    if (avant === undefined) delete globalThis.document; else globalThis.document = avant;
  }
});

test('appareil.js : sans logic.js, chargé à part par la page d’entrée (jamais dans ses fichiers préchargés)', async () => {
  const src = readFileSync(new URL('../../src/appareil.js', import.meta.url), 'utf8');
  assert.deepEqual([...src.matchAll(/^import [^;]* from '([^']+)';/gm)].map(m => m[1]), ['./regles-entree.js']);
  const entree = readFileSync(new URL('../../src/entree.js', import.meta.url), 'utf8');
  assert.match(entree, /import\('\.\/appareil\.js'\)/);
  assert.doesNotMatch(entree, /^import [^;]*'\.\/(appareil|logic)\.js';/m);
  const { CLE_APPLI_VUE } = await appareil();
  assert.equal(CLE_APPLI_VUE, 'ensam-appli-vue', 'la clé que la feuille du navigateur d’une application relit (pwa.js)');
});

test('lien « Active tes notifications » avec tout décoché dans Mon profil : la feuille le dit (choisir) ; les gestes à faire d’abord restent', () => {
  const l = x => sorteLienNotifs({ memo: {}, voulu: false, ...x });
  assert.equal(l({ etat: 'off' }), 'choisir');
  assert.equal(l({ etat: 'on' }), 'choisir', 'déjà activées : rien n’arrive pour autant');
  assert.equal(l({ etat: 'ios' }), 'ios');
  assert.equal(l({ etat: 'appli' }), 'appli');
  assert.equal(l({ etat: 'refuse' }), 'debloquer');
  assert.equal(l({ etat: 'absent' }), 'absent');
  assert.equal(l({ etat: 'off', memo: { coupe: 1 } }), null, 'coupées par le membre : on respecte');
  for (const etat of ['…', 'demo', undefined]) assert.equal(l({ etat }), null, String(etat));
  assert.equal(sorteLienNotifs({ etat: 'off', memo: {}, voulu: true }), 'push');
  assert.equal(sorteLienNotifs({ etat: 'on', memo: {} }), 'deja');
});

test('lien « Active tes notifications » avec seuls les rappels cochés : rien d’autre à proposer (choisir), et la feuille dit que « Rappels » reste cochée', () => {
  const { veutDesNotifs, choisirCas, PUSH_CATEGORIES } = logique;
  const seule = (c, role = 'etudiant') => ({ role, notif_push: Object.fromEntries(PUSH_CATEGORIES.map(x => [x, x === c])) });
  assert.equal(veutDesNotifs(seule('rappels')), false, 'les rappels seuls ne comptent pas');
  for (const etat of ['on', 'off']) assert.equal(sorteLienNotifs({ etat, memo: {}, voulu: veutDesNotifs(seule('rappels')) }), 'choisir', etat);
  assert.equal(choisirCas(seule('rappels')), 'rappels');
  assert.equal(choisirCas(seule(null)), 'rien', 'tout décoché');
  assert.equal(choisirCas(seule('rappels'), false), 'rien', 'base pas encore à jour : Mon profil ne montre pas la case « Rappels »');
  assert.equal(choisirCas({ role: 'laureat', notif_push: { messages: false } }), 'rappels', 'case jamais touchée : cochée par défaut');
  assert.equal(veutDesNotifs(seule('messages')), true);
  assert.equal(veutDesNotifs(seule('match')), true);
  assert.equal(veutDesNotifs({ role: 'etudiant' }), true, 'par défaut, tout est coché');
  assert.equal(veutDesNotifs(seule(null, 'admin')), true, 'l’administration reçoit toujours les signalements');
});

test('carte de la page d’entrée : espaces insécables du français (jamais « : » ni « » » seul en début de ligne) ; l’arabe tel quel', async () => {
  const { typo, CARTE } = await appareil();
  assert.equal(typo(CARTE.android, 'fr'), 'Ouvre le Réseau dans Chrome : tu y resteras connecté et tes notifications arriveront sur ce téléphone.');
  assert.equal(typo(CARTE.geste, 'fr'), 'Touche ••• (en haut ou en bas de l’écran), puis « Ouvrir dans Safari » ou « Ouvrir dans le navigateur ».');
  assert.equal(typo(CARTE.rien, 'fr'), 'Rien ne s’ouvre ? Touche ⋮ en haut à droite, puis « Ouvrir dans Chrome » ou « Ouvrir dans le navigateur ».');
  // En arabe, la phrase reste la clé du dictionnaire
  for (const s of [CARTE.android, CARTE.geste, CARTE.rien]) assert.equal(typo(s, 'ar'), s);
  assert.equal(typo(null, 'fr'), null);
});

test('page d’entrée dans le navigateur d’une application : la carte compte le bandeau d’un lien d’invitation', async () => {
  const { carteTient } = await pageEntree();
  // Android, 360 px, en français : sans bandeau, la carte tient à 800 px de haut ; avec, il en faut un peu plus
  assert.equal(carteTient('android', 'fr', 360, 800), true);
  assert.equal(carteTient('android', 'fr', 360, 800, 16, 'promo'), false);
  // Le code de qui invite : sous 23,4 rem de large, la place d'un prénom long (deux lignes) ; au-delà, une ligne
  assert.equal(carteTient('android', 'fr', 360, 815, 16, 'promo'), true);
  assert.equal(carteTient('android', 'fr', 360, 815, 16, 'de'), false);
  assert.equal(carteTient('android', 'fr', 412, 840, 16, 'de'), true);
  // En arabe, une ligne dans tous les cas
  assert.equal(carteTient('android', 'ar', 360, 800, 16, 'de'), carteTient('android', 'ar', 360, 800, 16, 'promo'));
  assert.equal(carteTient('ios', 'ar', 375, 667, 16, 'promo'), false);
});
