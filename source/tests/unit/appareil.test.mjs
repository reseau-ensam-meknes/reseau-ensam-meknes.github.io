// Chaque téléphone abonnable : navigateurs intégrés des applications, lien « Ouvrir dans Chrome », feuille d'ouverture
// selon l'appareil (iPhone, administration), lien « Active tes notifications », échecs passagers de l'abonnement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navigateurIntegre, lienChrome, ouvertureSorte, OUVERTURE_IOS_ECART, ouvertureNotif, sorteLienNotifs, parametresLien, noterEchecPush, echecDefinitif, bandeauPush } from '../../src/logic.js';
import { SupabaseStore } from '../../src/store.js';
import { langueDuLien } from '../../src/regles-entree.js';

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
