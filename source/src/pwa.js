// Application installable (écran d'accueil du téléphone) et notifications sur le téléphone.
// Le service worker n'est enregistré que sur le vrai site (dist/), qui déclare un manifeste.
import { html, useState, useEffect, useRef } from './vendor/preact-htm.js';
import { Icon, Modal, toast, ensuite, feteOuverte, quandFete, injectCSS } from './ui.js';
import { addAR, getLang } from './i18n.js';
import { prevenirVariante, ouvertureSorte, sorteLienNotifs, bandeauPush, pushChoix, PUSH_CATEGORIES, navigateurIntegre, lienChrome, noterEchecPush, echecDefinitif } from './logic.js';
import { arriveeEnAttente } from './pouls.js';

let installEvt = null;
const listeners = new Set();
const notify = () => listeners.forEach(f => f());
if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; notify(); });
  addEventListener('appinstalled', () => { installEvt = null; marquerInstallee(); notify(); toast('Application installée.'); });
}
// Installée une fois sur cet appareil (le navigateur et l'application installée partagent ce stockage sur Android) :
// la pastille ne la propose plus dans le navigateur
const INSTALLEE = 'ensam-installee';
function marquerInstallee() { try { localStorage.setItem(INSTALLEE, '1'); } catch { /* navigation privée */ } }
const dejaInstallee = () => { try { return localStorage.getItem(INSTALLEE) === '1'; } catch { return false; } };

// Enregistré au premier moment calme : son installation (tout le site gardé sur le téléphone) ne passe pas
// devant les données du membre en 3G
const ouverture = Date.now();
// Une nouvelle version ne recharge la page visible que pendant ses premières secondes ; après, elle attend que la page soit cachée
const FENETRE_MAJ = 8000;
const auRepos = f => (typeof requestIdleCallback === 'function' ? requestIdleCallback(f, { timeout: 4000 }) : setTimeout(f, 1500));
// Le service worker n'a pas pu s'enregistrer (navigateur qui les refuse, navigation privée) : les notifications non plus,
// et ceux qui avaient cru pouvoir proposer « Activer » (etatPush) relisent l'état
let swEchec = false;
export const swReady = (() => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !document.querySelector('link[rel="manifest"]')) return Promise.resolve(null);
  return new Promise(ok => auRepos(ok)).then(() => navigator.serviceWorker.register('sw.js')).then(reg => { suivreMisesAJour(reg); return navigator.serviceWorker.ready; })
    .catch(() => { swEchec = true; setTimeout(() => dispatchEvent(new Event(PUSH_CHANGE))); return null; });
})();

// Nouvelle version du site : le téléphone la télécharge en arrière-plan, puis elle prend la main
// quand la page est cachée (ou tout de suite si la page vient de s'ouvrir), et la page se recharge
// sans que personne ne le voie. Jamais au milieu de ce que le membre est en train de faire.
function suivreMisesAJour(reg) {
  const debut = ouverture;
  const avait = !!navigator.serviceWorker.controller;
  const appliquer = w => {
    if (!w || !avait) return;
    if (Date.now() - debut < 5000 || document.visibilityState === 'hidden') w.postMessage('nouvelle-version');
    else document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') w.postMessage('nouvelle-version'); }, { once: true });
  };
  if (reg.waiting) appliquer(reg.waiting);
  reg.addEventListener('updatefound', () => { const w = reg.installing; w?.addEventListener('statechange', () => { if (w.state === 'installed') appliquer(w); }); });
  let fait = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (fait || !avait) return;
    fait = true;
    if (document.visibilityState === 'hidden' || Date.now() - debut < FENETRE_MAJ) location.reload();
  });
}

const isStandalone = () => matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
if (typeof window !== 'undefined' && isStandalone()) marquerInstallee();
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const hasManifest = () => !!document.querySelector('link[rel="manifest"]');

const isAndroid = () => /android/i.test(navigator.userAgent);
// Le navigateur intégré d'une application (lien ouvert dans Instagram, Facebook, LinkedIn…) : { nom, systeme } ou null.
// Ni notification ni installation n'y sont possibles : on propose de rouvrir la page dans Chrome ou Safari (état 'appli').
const integre = () => (typeof navigator === 'undefined' ? null : navigateurIntegre(navigator.userAgent));
// Le système de l'appareil, pour dire les bons gestes : android | ios | pc
const systeme = () => (isAndroid() ? 'android' : isIOS() ? 'ios' : 'pc');
// « Installer l'application » (menu du compte et pastille) : visible quand l'installation est possible.
// { prompt } : le navigateur installe en un toucher ; { ios } / { android } : les gestes à faire, montrés dans une feuille
// (Android sans proposition du navigateur : Firefox, Samsung Internet, ou Chrome qui ne l'a pas encore proposée).
// Jamais dans le navigateur d'une application, où ces gestes n'existent pas.
export function useInstall() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set(x => x + 1); listeners.add(f); return () => listeners.delete(f); }, []);
  if (!hasManifest() || isStandalone() || integre()) return null;
  if (installEvt) return { prompt: async () => { const e = installEvt; installEvt = null; notify(); e.prompt(); await e.userChoice.catch(() => null); } };
  if (isIOS()) return { ios: true };
  if (isAndroid() && !dejaInstallee()) return { android: true };
  return null;
}

// Typographie française des gestes : ni « ni : ? ! ; seul en début ou en fin de ligne (espace insécable). En arabe, la
// phrase française reste la clé du dictionnaire : elle passe telle quelle.
const fr = s => (typeof s !== 'string' || getLang() === 'ar' ? s : s.replace(/« /g, '«\u00a0').replace(/ ([»:;?!])/g, '\u00a0$1'));
// Des gestes numérotés, chacun avec son icône ; 'more-v' : le menu ⋮ d'Android (les trois points debout), 'more' : le ••• de l'iPhone
const Etapes = ({ liste }) => html`<ol class="ios-steps">${liste.map(([ico, txt]) => html`<li key=${txt}><span class=${'g-ico' + (ico === 'more-v' ? ' debout' : '')}><${Icon} name=${ico === 'more-v' ? 'more' : ico} size=${18}/></span> ${fr(txt)}</li>`)}</ol>`;
// iPhone : les notifications n'arrivent que dans l'application ajoutée à l'écran d'accueil, dont le stockage est à part
// (on s'y connecte une fois). Partager est en bas de Safari, ou dans son menu ••• ; dans Chrome ou Firefox, dans la barre d'adresse.
const PARTAGER = { safari: 'Dans Safari, touche Partager : en bas de l’écran, ou dans le menu •••.', autre: 'Touche Partager, dans la barre d’adresse ou dans le menu du navigateur.' };
const ETAPES_IOS = [
  ['plus', 'Choisis « Sur l’écran d’accueil », laisse « Ouvrir en tant qu’app web » activé, puis touche « Ajouter ».'],
  ['bell', 'Ouvre le Réseau ENSAM depuis sa nouvelle icône, connecte-toi une fois, puis touche « Activer ».'],
];
const etapesIos = () => [['share', /CriOS|FxiOS|EdgiOS/.test(navigator.userAgent) ? PARTAGER.autre : PARTAGER.safari], ...ETAPES_IOS];
const EtapesIos = () => html`<${Etapes} liste=${etapesIos()}/>`;
// Android : installer ne suffit pas, les notifications s'activent d'un toucher (dans le navigateur aussi, sans installer)
const ETAPES_ANDROID = [
  ['more-v', 'Touche le menu ⋮ du navigateur, en haut à droite.'],
  ['plus', 'Choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ».'],
  ['bell', 'Ouvre le Réseau ENSAM depuis son icône, puis touche « Activer les notifications » si ce n’est pas déjà fait.'],
];
const EtapesAndroid = () => html`<${Etapes} liste=${ETAPES_ANDROID}/>`;
const POURQUOI_INSTALLER = {
  android: 'Une icône sur ton écran d’accueil : le Réseau ENSAM s’ouvre en un toucher, comme une application.',
  ios: 'Sur iPhone, les notifications n’arrivent que dans l’application ajoutée à l’écran d’accueil. Trois gestes :',
};
export function IosInstallHelp({ onClose, android }) {
  return html`<${Modal} title="Installer l’application" cls="installer" onClose=${onClose}><p>${fr(android ? POURQUOI_INSTALLER.android : POURQUOI_INSTALLER.ios)}</p>${android ? html`<${EtapesAndroid}/>` : html`<${EtapesIos}/>`}<//>`;
}
addAR({
  [PARTAGER.safari]: 'في Safari، المس «مشاركة»: أسفل الشاشة، أو في قائمة •••.',
  [PARTAGER.autre]: 'المس «مشاركة»، في شريط العنوان أو في قائمة المتصفح.',
  [ETAPES_IOS[0][1]]: 'اختر «إضافة إلى الشاشة الرئيسية»، واترك «فتح كتطبيق ويب» مفعّلًا، ثم المس «إضافة».',
  [ETAPES_IOS[1][1]]: 'افتح شبكة ENSAM من أيقونتها الجديدة، وسجّل الدخول مرة واحدة، ثم المس «تفعيل».',
  [ETAPES_ANDROID[0][1]]: 'المس قائمة ⋮ في المتصفح، أعلى الشاشة.',
  [ETAPES_ANDROID[1][1]]: 'اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».',
  [ETAPES_ANDROID[2][1]]: 'افتح شبكة ENSAM من أيقونتها، ثم المس «فعّل الإشعارات» إن لم يتمّ ذلك بعد.',
  [POURQUOI_INSTALLER.android]: 'أيقونة على شاشتك الرئيسية: تُفتح شبكة ENSAM بلمسة واحدة، مثل تطبيق.',
  [POURQUOI_INSTALLER.ios]: 'على iPhone، لا تصل الإشعارات إلا داخل التطبيق المضاف إلى الشاشة الرئيسية. ثلاث خطوات:',
});

function b64ToBytes(b64) {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

// À chaque ouverture, une fois par compte : l'abonnement de cet appareil est redonné à la base. Elle a pu l'oublier (le
// téléphone a servi un autre compte, le service de push l'a refusé une fois) : Mon profil disait « Activées » alors que
// plus rien n'arrivait. Rien n'est demandé au membre. Si la clé de la plateforme a changé, l'appareil se réabonne avec elle.
const resynchronises = new Set();
const memeCle = (cle, b64) => {
  if (!cle) return true;
  const a = new Uint8Array(cle), b = b64ToBytes(b64);
  return a.length === b.length && a.every((x, i) => x === b[i]);
};
export async function resynchroniserPush(store) {
  const id = store.me?.id;
  if (store.mode !== 'live' || !id || resynchronises.has(id)) return;
  resynchronises.add(id);
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = await swReady;
    let sub = await reg?.pushManager?.getSubscription();
    const key = await store.pushKey();
    // Autorisées sur cet appareil mais plus d'abonnement (réinstallation, données effacées) : il se réabonne, sans rien demander
    if (!sub) {
      if (!key || lireMemo(id).coupe) return;
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
    } else if (key && !memeCle(sub.options?.applicationServerKey, key)) {
      await sub.unsubscribe().catch(() => {});
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
    }
    await store.abonnerPush(sub);
  } catch { /* hors ligne, ou navigateur qui veut un geste : à la prochaine ouverture */ }
}
if (typeof window !== 'undefined') {
  // Déconnexion (store.signOut) : cet appareil a été retiré du compte dans la base ; reconnecté sans recharger la page, il s'y
  // réinscrit (un autre compte aussi)
  addEventListener('ensam-deconnexion', () => resynchronises.clear());
  // Une notification touchée pendant que la page est ouverte, et que le service worker n'a pas pu y emmener : la page y va
  navigator.serviceWorker?.addEventListener('message', e => {
    const u = e.data && typeof e.data === 'object' ? e.data.aller : null;
    if (typeof u !== 'string') return;
    try {
      const c = new URL(u, location.href);
      if (c.origin !== location.origin) return;
      if (c.pathname === location.pathname && c.search === location.search) { if (c.hash !== location.hash) location.hash = c.hash; } else location.assign(c.href);
    } catch { /* adresse illisible */ }
  });
}

// Rien n'arrive malgré l'abonnement : le jeton du service de push est refait
async function reparerPush(store) {
  const reg = await swReady, key = await store.pushKey(), ancien = await reg?.pushManager?.getSubscription();
  if (!key || !ancien) return;
  await store.desabonnerPush(ancien.endpoint).catch(() => {});
  await ancien.unsubscribe().catch(() => {});
  await store.abonnerPush(await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
}
// Le service worker de cet appareil a-t-il reçu quelque chose dans le délai ?
const attendreRecu = ms => new Promise(ok => {
  const sw = navigator.serviceWorker;
  if (!sw) return ok(false);
  const fin = v => { clearTimeout(t); sw.removeEventListener('message', f); ok(v); };
  const f = e => { if (e.data === 'push-recu') fin(true); };
  const t = setTimeout(() => fin(false), ms);
  sw.addEventListener('message', f);
});

const PUSH_CHANGE = 'ensam-push';
// La clé publique de la plateforme, demandée dès qu'une feuille qui propose « Activer » s'affiche (store.pushKey la garde
// pour la visite) : l'abonnement suit tout de suite la réponse du navigateur, sans un aller-retour de plus en 3G
const cleAPrete = store => { if (store.mode === 'live') Promise.resolve(store.pushKey?.()).catch(() => {}); };
// Les notifications sur cet appareil : demo | absent | ios | appli | refuse | off | on
export async function etatPush(store) {
  if (store.mode !== 'live') return 'demo';
  const possible = 'Notification' in window && 'PushManager' in window;
  if (!possible && integre()) return 'appli';
  if (!possible || !hasManifest()) return isIOS() && !isStandalone() ? 'ios' : 'absent';
  if (Notification.permission === 'denied') return 'refuse';
  // Pas encore d'autorisation : aucun abonnement ne peut exister, inutile d'attendre que le service worker ait gardé tout
  // le site (2 Mo, longues secondes en 3G à la première visite) pour proposer « Activer »
  if (Notification.permission === 'default' && 'serviceWorker' in navigator && !swEchec) return 'off';
  const reg = await swReady;
  if (!reg) return 'absent';
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
}
// Demande l'autorisation puis abonne cet appareil : 'on', 'refuse' (bloquées par le navigateur) ou 'off' (fenêtre du
// navigateur fermée sans choisir : rien n'est bloqué, on pourra redemander). Erreur levée si la plateforme n'est pas prête :
// plateforme (ce navigateur ne peut pas : NotSupportedError, NotAllowedError, Brave sans les services de Google) ou passager
// (le service de notifications n'a pas répondu, le réseau a coupé : on pourra réessayer).
export async function activerPush(store) {
  // Demandée avant la fenêtre du navigateur (sans l'attendre : la demande reste dans le geste du membre), déjà là d'habitude
  const cle = Promise.resolve(store.pushKey()).catch(() => null);
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'refuse';
  if (permission !== 'granted') return 'off';
  const key = await cle;
  if (!key) throw new Error('Les notifications ne sont pas encore prêtes sur la plateforme. Réessaie plus tard.');
  const reg = await swReady;
  let sub;
  try {
    if (!reg) throw Object.assign(new Error('service worker absent'), { name: 'AbortError' });
    if (!reg.pushManager) throw Object.assign(new Error('pushManager absent'), { name: 'NotSupportedError' });
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  } catch (e) {
    const definitif = echecDefinitif(e, { brave: !!navigator.brave });
    throw Object.assign(new Error(definitif ? SANS_NOTIF : SERVICE_LENT), { plateforme: definitif, passager: !definitif, cause: e });
  }
  // Pas enregistré par la plateforme (réseau) : l'abonnement du navigateur est retiré, sinon il paraîtrait actif
  try { await store.abonnerPush(sub); } catch (e) { await sub.unsubscribe().catch(() => {}); throw e; }
  return 'on';
}

// L'abonnement n'a pas pu se faire. Navigateur qui ne peut pas : une phrase calme, et les feuilles ne reviennent plus sur ce
// navigateur (le bouton de « Mon profil » reste là pour réessayer). Erreur passagère : notée par jour, et l'appareil n'est
// classé « sans notifications » qu'au deuxième jour différent (noterEchecPush). true : la feuille peut se fermer ;
// 'off' : elle se ferme comme « Plus tard » (elle reviendra) ; false : elle reste (pas de réseau : on peut réessayer).
function apresEchec(me, e) {
  const memo = lireMemo(me.id);
  if (e?.plateforme || e?.passager) {
    const { echecs, arret } = e.plateforme ? { echecs: memo.echecs, arret: true } : noterEchecPush(memo);
    if (arret) {
      etatConnu = 'absent';
      // sans : la pastille et le bandeau ne proposent plus « Activer » sur ce navigateur (une activation réussie l'efface)
      ecrireMemo(me.id, { ...memo, ...(echecs ? { echecs } : {}), fait: 1, sans: 1 });
      toast(SANS_NOTIF, 'err');
      return true;
    }
    ecrireMemo(me.id, { ...memo, echecs });
    toast(SERVICE_LENT, 'err');
    return 'off';
  }
  toast(e?.message || 'Pas de réseau pour l’instant. Réessaie dans un instant.', 'err');
  return false;
}

// Juste après une activation réussie : la notification d'essai part toute seule, pour qu'une première notification arrive
// tout de suite dans la barre (et prouve toute la chaîne, de la plateforme au téléphone). Rien n'est parti : l'abonnement
// est refait et l'essai repart une fois ; toujours rien, une phrase calme. La fonction qui ne répond pas (pas encore à jour,
// coupure) : rien à dire, « Tester » reste dans Mon profil. diag (Mon profil) : reçue ou non par cet appareil dans les 20 s
// (non : l'abonnement est refait, comme après « Tester »). En démo, rien n'est envoyé : le petit mot de la démo suffit.
async function premiereNotif(store, diag) {
  if (store.mode !== 'live') return;
  try {
    let recu = attendreRecu(ATTENTE_TEST);
    if (!(await store.testPush())) {
      await reparerPush(store);
      recu = attendreRecu(ATTENTE_TEST);
      if (!(await store.testPush())) { toast(PREMIERE_RATEE); return; }
    }
    if (!diag) return;
    const ok = await recu;
    if (!ok) await reparerPush(store).catch(() => {});
    diag(ok ? 'recue' : 'perdue');
  } catch { /* « Tester » dans Mon profil */ }
}
const SERVICE_LENT = 'Le service de notifications ne répond pas, réessaie dans un moment.';
const PREMIERE_RATEE = 'La notification d’essai n’est pas partie. Cet appareil vient d’être réabonné : touche « Tester » dans « Mon profil » pour vérifier.';
addAR({
  [SERVICE_LENT]: 'خدمة الإشعارات لا تستجيب، أعد المحاولة بعد قليل.',
  [PREMIERE_RATEE]: 'لم يُرسَل الإشعار التجريبي. أعدنا تسجيل هذا الجهاز: اضغط على «تجربة» في «ملفي الشخصي» للتحقق.',
});

// Une demande du navigateur lancée depuis Mon profil attend sa réponse : pas de feuille d'ouverture par-dessus
let demandeEnCours = false;

// « Notifications sur ce téléphone ou cet ordinateur », dans Mon profil (onglet Notifications) : coupées, une phrase et
// un bouton « Activer » ; activées, « Activées sur cet appareil », « Tester » (pas en démo) et « Désactiver ». Ce que
// l'appareil ne permet pas (navigateur, iPhone sans l'application, notifications bloquées) est dit en une phrase.
export function PushToggle({ ctx }) {
  const { store, me } = ctx;
  // Activées ou coupées ici : c'est une réponse, ni la feuille d'ouverture ni « Me prévenir » ne reviennent la demander
  const repondu = () => { if (me?.id) ecrireMemo(me.id, { ...lireMemo(me.id), fait: 1 }); };
  // En démo, un test peut simuler un vrai téléphone (comme pour la feuille d'ouverture) : l'interrupteur répond sans rien abonner
  const simule = etatDemo(store);
  const [st, setSt] = useState(simule || '…'); // … | absent | demo | ios | refuse | off | on
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const [debloquer, setDebloquer] = useState(false);
  const [diag, setDiag] = useState(null);   // après « Tester » : recue | perdue
  // Le bouton touché disparaît avec l'état qu'il change : le clavier continue sur le premier bouton du nouvel état
  const ici = useRef(null), garderFocus = useRef(false);
  // Ce que cet interrupteur vient de faire, il l'annonce aux autres (pastille, bandeau, feuilles) sans se relire lui-même :
  // la réponse du navigateur fait foi
  const annonce = useRef(false);
  const annoncer = () => { annonce.current = true; try { dispatchEvent(new Event(PUSH_CHANGE)); } finally { annonce.current = false; } };
  useEffect(() => {
    if (!garderFocus.current) return;
    garderFocus.current = false;
    if (!ici.current?.contains(document.activeElement)) ici.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [st]);
  useEffect(() => {
    if (simule) return undefined;
    const lire = () => (annonce.current ? undefined : etatPush(store).then(setSt, () => setSt('absent')));
    lire();
    // Activées depuis une feuille pendant que Mon profil est ouvert : l'interrupteur suit
    addEventListener(PUSH_CHANGE, lire);
    return () => removeEventListener(PUSH_CHANGE, lire);
  }, []);
  // « Activer » à toucher : la clé de la plateforme est demandée dès maintenant
  useEffect(() => { if (st === 'off' || st === 'refuse') cleAPrete(store); }, [st]);
  // Simulé : rien n'est demandé au navigateur ni à la plateforme, le reste est le même
  const turnOn = async () => {
    setBusy(true); demandeEnCours = true;
    try {
      const r = simule ? 'on' : await activerPush(store);
      // Fenêtre du navigateur fermée sans choisir ('off') : la case reste à toucher, ce n'est pas une réponse
      setSt(r); etatConnu = r; if (r !== 'off') repondu();
      if (r === 'on' && me?.id) { const { coupe, echecs, sans, ...m } = lireMemo(me.id); ecrireMemo(me.id, m); }
      // La pastille et le bandeau suivent (« Activer » n'y reste pas)
      annoncer();
      if (r === 'on') { toast(simule ? DEMO : 'Notifications activées sur cet appareil.'); setDiag(null); premiereNotif(store, setDiag); }
    } catch (e) { if (me?.id) apresEchec(me, e); else toast(e.message || String(e), 'err'); } finally { setBusy(false); demandeEnCours = false; }
  };
  const turnOff = async () => {
    setBusy(true); demandeEnCours = true;
    try {
      const sub = simule ? null : await (await swReady)?.pushManager.getSubscription();
      if (sub) { await store.desabonnerPush(sub.endpoint).catch(() => {}); await sub.unsubscribe(); }
      setSt('off'); etatConnu = 'off'; ecrireMemo(me.id, { ...lireMemo(me.id), fait: 1, coupe: 1 }); toast('Notifications désactivées sur cet appareil.');
      annoncer();
    } catch (e) { toast(e.message || String(e), 'err'); } finally { setBusy(false); demandeEnCours = false; }
  };
  const test = async () => {
    setBusy(true); setDiag(null);
    try {
      const recu = attendreRecu(ATTENTE_TEST);
      const n = await store.testPush();
      if (!n) { toast('Aucun appareil abonné pour l’instant.'); return; }
      toast('Notification de test envoyée.');
      if (await recu) { setDiag('recue'); return; }
      await reparerPush(store).catch(() => {});
      setDiag('perdue');
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const note = {
    demo: 'Sur la vraie plateforme : candidature reçue, rendez-vous, réponse à ta question… arrivent directement sur ton téléphone.',
    absent: NOTE_ABSENT,
    refuse: 'Les notifications sont bloquées pour ce site. Autorise-les dans les réglages du navigateur, puis reviens ici.',
  }[st];
  return html`<div class="push-etat" data-etat=${st} ref=${ici}>
    ${st === 'on' ? html`<p class="verify-ok push-ok" id="md-push-ok"><${Icon} name="check" size=${18}/> Activées sur cet appareil</p>
      <p class="small muted" id="md-push-compte">${surTelephone() ? UN_COMPTE.tel : UN_COMPTE.pc}</p>
      <div class="push-acts">${simule ? null : html`<button type="button" class="btn small" id="md-push-test" disabled=${busy} onClick=${test}>Tester</button>`}
        <button type="button" class="btn small ghost" id="md-push-non" disabled=${busy} onClick=${() => { garderFocus.current = true; turnOff(); }}>Désactiver</button></div>`
    : st === 'off' ? html`<p class="small muted">${PUSH_POURQUOI}</p>
      <div class="push-acts"><button type="button" class="btn primary" id="md-push-oui" disabled=${busy} onClick=${() => { garderFocus.current = true; turnOn(); }}><${Icon} name="bell" size=${16}/> Activer</button></div>`
    : st === 'appli' ? html`<${AppliDit} ctx=${ctx}/>` : null}
    ${note ? html`<p class="small muted">${note}</p>` : null}
    ${st === 'on' && diag ? html`<p class="small muted" id="md-push-diag">${diag === 'recue' ? DIAG_RECUE : DIAG_PERDUE}</p>` : null}
    ${st === 'refuse' ? html`<p class="small"><button type="button" class="linkish" id="md-push-debloquer" onClick=${() => setDebloquer(true)}>Comment les débloquer ?</button></p>` : null}
    ${st === 'ios' ? html`<p class="small muted">Sur iPhone, installe d’abord l’application sur l’écran d’accueil. <button class="linkish" onClick=${() => setHelp(true)}>Comment faire ?</button></p>` : null}
    ${help ? html`<${IosInstallHelp} onClose=${() => setHelp(false)}/>` : null}
    ${debloquer ? html`<${FeuilleDebloquer} ctx=${ctx} onClose=${() => setDebloquer(false)}/>` : null}
  </div>`;
}
const ATTENTE_TEST = 20000;
const NOTE_ABSENT = 'Ce navigateur ne permet pas les notifications. Essaie Chrome, Edge, Firefox ou Safari récent.';
// Un téléphone ne sert qu'un compte : le dernier connecté (abonner_push). Se déconnecter le retire de ce compte.
const UN_COMPTE = {
  tel: 'Ce téléphone reçoit les notifications de ce compte. Si un autre compte s’y connecte, c’est lui qui les recevra.',
  pc: 'Cet ordinateur reçoit les notifications de ce compte. Si un autre compte s’y connecte, c’est lui qui les recevra.',
};
addAR({
  [UN_COMPTE.tel]: 'يتلقى هذا الهاتف إشعارات هذا الحساب. إذا سُجّل الدخول عليه بحساب آخر، فهو من سيتلقاها.',
  [UN_COMPTE.pc]: 'يتلقى هذا الحاسوب إشعارات هذا الحساب. إذا سُجّل الدخول عليه بحساب آخر، فهو من سيتلقاها.',
});
const DIAG_RECUE = 'Reçue par cet appareil. Rien dans la barre de notifications ? Dans les réglages du téléphone, autorise les notifications de ton navigateur et retire-le de l’économie de batterie.';
const DIAG_PERDUE = 'Pas arrivée. L’abonnement de cet appareil vient d’être refait : touche « Tester » de nouveau.';
const PUSH_POURQUOI = 'Messages, réponses, rendez-vous : ce qui te concerne arrive tout de suite, même quand l’application est fermée.';
addAR({
  [PUSH_POURQUOI]: 'الرسائل والأجوبة والمواعيد: ما يخصك يصلك فورًا، حتى والتطبيق مغلق.',
  [DIAG_RECUE]: 'وصل الإشعار إلى هذا الجهاز. لا يظهر شيء في شريط الإشعارات؟ من إعدادات الهاتف، اسمح بإشعارات المتصفح وأزله من توفير البطارية.',
  [DIAG_PERDUE]: 'لم يصل الإشعار. أعدنا تسجيل هذا الجهاز: اضغط على «تجربة» مرة أخرى.',
  'Activées sur cet appareil': 'مفعّلة على هذا الجهاز', 'Comment les débloquer ?': 'كيف ترفع الحظر عنها؟',
});

// ---------------------------------------------------------------------------
// Bandeau de l'accueil : cet appareil ne reçoit rien. Une phrase, un bouton, et « plus tard » pour trois jours (bandeauPush, logic.js).
// ---------------------------------------------------------------------------
const BANDEAU = {
  off: ['Active tes notifications', 'Sans elles, tu rates tes matchs, tes messages et les réponses des lauréats.', 'Activer'],
  ios: ['Ajoute l’application à ton écran d’accueil', 'Sur iPhone, c’est la seule façon de recevoir tes matchs et tes messages.', 'Comment faire ?'],
  refuse: ['Tes notifications sont bloquées', 'Tes matchs et tes messages n’arrivent pas sur cet appareil.', 'Les débloquer'],
};
export function BandeauPush({ ctx }) {
  const { store, me } = ctx;
  const [etat, setEtat] = useState('…');
  const [, relire] = useState(0);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const [debloquer, setDebloquer] = useState(false);
  useEffect(() => {
    const lire = () => { const d = etatDemo(store); return d ? setEtat(d) : etatPush(store).then(setEtat, () => {}); };
    lire();
    addEventListener(PUSH_CHANGE, lire);
    return () => removeEventListener(PUSH_CHANGE, lire);
  }, []);
  const v = bandeauPush({ etat, memo: lireMemo(me.id), role: me.role, voulu: PUSH_CATEGORIES.some(c => c !== 'rappels' && pushChoix(c, me)) });
  // « Activer » à l'écran : la clé de la plateforme est demandée dès maintenant
  useEffect(() => { if (v === 'off') cleAPrete(store); }, [v]);
  const feuilles = html`${help === 'appli' ? html`<${FeuilleAppli} ctx=${ctx} onClose=${() => setHelp(false)}/>` : help ? html`<${IosInstallHelp} onClose=${() => setHelp(false)}/>` : null}${debloquer ? html`<${FeuilleDebloquer} ctx=${ctx} onClose=${() => setDebloquer(false)}/>` : null}`;
  if (!v) return feuilles;
  const sys = systeme();
  const [titre, texte, action] = v === 'appli' ? [APPLI_TITRE[sys], appliIci(integre()?.nom), 'Comment faire ?'] : BANDEAU[v];
  const agir = async () => {
    if (v === 'ios' || v === 'appli') return setHelp(v);
    if (v === 'refuse') return setDebloquer(true);
    setBusy(true); await accepterNotif(store, me); setBusy(false); relire(x => x + 1);
  };
  const plusTard = () => { ecrireMemo(me.id, { ...lireMemo(me.id), bandeau: Date.now() }); relire(x => x + 1); };
  // Le navigateur d'une application sur Android : le lien qui rouvre la page dans Chrome, en un toucher
  const bouton = v === 'appli' && sys === 'android' ? html`<${OuvrirChrome} store=${store} cls="btn small primary" id="push-b-oui"/>`
    : html`<button type="button" class="btn small primary" id="push-b-oui" disabled=${busy} onClick=${agir}>${action}</button>`;
  return html`<section class="push-bandeau" aria-label=${titre} data-etat=${v}>
    <span class="push-b-ico" aria-hidden="true"><${Icon} name="bell" size=${22}/></span>
    <div class="push-b-txt"><strong>${titre}</strong><span>${fr(texte)}</span>
      <div class="push-b-acts">${bouton}
        <button type="button" class="linkish small" id="push-b-tard" onClick=${plusTard}>Plus tard</button></div></div>
    ${feuilles}
  </section>`;
}
injectCSS('push-bandeau', `
.push-bandeau { display: flex; gap: .8rem; padding: .95rem 1rem; border-radius: var(--r-3, 16px); background: var(--orange); color: #2a1300; box-shadow: var(--sh1); }
.push-b-ico { flex: none; inline-size: 42px; block-size: 42px; display: grid; place-items: center; border-radius: 50%; background: rgba(255, 255, 255, .42); animation: push-b-son 2.6s ease-in-out infinite; transform-origin: 50% 20%; }
.push-b-txt { display: grid; gap: .2rem; min-width: 0; font-size: var(--fs-2); line-height: 1.4; }
.push-b-txt strong { font-size: var(--fs-3); }
.push-b-acts { display: flex; align-items: center; gap: .9rem; margin-block-start: .45rem; }
.push-b-acts .linkish { color: inherit; }
@keyframes push-b-son { 0%, 82%, 100% { transform: rotate(0); } 86% { transform: rotate(10deg); } 90% { transform: rotate(-9deg); } 94% { transform: rotate(5deg); } }
@media (prefers-reduced-motion: reduce) { .push-b-ico { animation: none; } }
`);
addAR({
  [BANDEAU.off[0]]: 'فعّل إشعاراتك', [BANDEAU.off[1]]: 'بدونها تفوتك التوافقات والرسائل وأجوبة الخريجين.', [BANDEAU.off[2]]: 'تفعيل',
  [BANDEAU.ios[0]]: 'أضف التطبيق إلى شاشتك الرئيسية', [BANDEAU.ios[1]]: 'على iPhone، هذه هي الطريقة الوحيدة لتلقي التوافقات والرسائل.', [BANDEAU.ios[2]]: 'كيف أفعل ذلك؟',
  [BANDEAU.refuse[0]]: 'إشعاراتك محظورة', [BANDEAU.refuse[1]]: 'توافقاتك ورسائلك لا تصل إلى هذا الجهاز.', [BANDEAU.refuse[2]]: 'رفع الحظر',
});

// ---------------------------------------------------------------------------
// Le navigateur intégré d'une application (lien ouvert dans Instagram, Facebook, Messenger, LinkedIn, TikTok, Snapchat…) :
// les notifications n'y arrivent pas et rien ne s'installe. Sur Android, un lien rouvre la même page dans Chrome (intent://,
// la route en ?r=, l'activation demandée en arrivant) ; sur iPhone, les gestes pour passer dans Safari puis à l'écran d'accueil.
// Dit dans la pastille, Mon profil, le bandeau de l'accueil, et à l'ouverture (une fois par visite au plus).
// En démo, on le simule (ensam-prevenir-demo = appli, ou le user-agent d'une application) ; le lien n'y ouvre rien.
// ---------------------------------------------------------------------------
const APPLI_TITRE = { android: 'Ouvre le Réseau ENSAM dans Chrome', ios: 'Ouvre le Réseau ENSAM dans Safari', pc: 'Ouvre le Réseau ENSAM dans ton navigateur' };
const APPLI_INCONNUE = 'Ce lien s’est ouvert dans une application : ici, les notifications ne peuvent pas arriver.';
const appliIci = nom => (nom ? `Ce lien s’est ouvert dans ${nom} : ici, les notifications ne peuvent pas arriver.` : APPLI_INCONNUE);
const APPLI_CHROME = 'Dans Chrome, ce qui te concerne arrive tout de suite, même quand l’application est fermée.';
const APPLI_RIEN = 'Rien ne s’ouvre ? Touche ⋮ en haut à droite, puis « Ouvrir dans Chrome » ou « Ouvrir dans le navigateur ».';
const ETAPES_APPLI = {
  ios: [
    ['more', 'Touche ••• (en haut ou en bas de l’écran), puis « Ouvrir dans Safari » ou « Ouvrir dans le navigateur ».'],
    ['share', 'Dans Safari : Partager, puis « Sur l’écran d’accueil ».'],
    ['bell', 'Ouvre la nouvelle icône, connecte-toi une fois, puis touche « Activer ».'],
  ],
  pc: [['more', 'Ouvre le menu de l’application, puis « Ouvrir dans le navigateur ».'], ['bell', 'Dans le navigateur, touche « Activer ».']],
};
const DEMO_CHROME = 'Sur la vraie plateforme, ce bouton rouvre la page dans Chrome, où les notifications arrivent.';
// Le lien « Ouvrir dans Chrome » : la page où l'on est (relue au toucher), la feuille d'activation en arrivant
// La langue de la page suit dans Chrome (l'arabe choisi ici, Chrome ne le connaît pas)
const lienIci = () => lienChrome(location.href, (location.hash || '').slice(1), { lang: getLang() });
function OuvrirChrome({ store, cls = 'btn primary', id, onOuvert, children }) {
  const clic = e => {
    if (store.mode !== 'live') { e.preventDefault(); toast(DEMO_CHROME); } else e.currentTarget.href = lienIci();
    onOuvert?.();
  };
  return html`<a class=${cls} id=${id} href=${lienIci()} onClick=${clic}>${children || html`<${Icon} name="globe" size=${16}/> Ouvrir dans Chrome`}</a>`;
}
// Mon profil › Notifications : la phrase et le geste
function AppliDit({ ctx }) {
  const sys = systeme();
  return html`<p class="small muted">${fr(appliIci(integre()?.nom))}</p>
    ${sys === 'android' ? html`<div class="push-acts"><${OuvrirChrome} store=${ctx.store} id="md-push-chrome"/></div><p class="small muted">${fr(APPLI_RIEN)}</p>`
      : html`<${Etapes} liste=${ETAPES_APPLI[sys]}/>`}`;
}
function FeuilleAppli({ ctx, onClose }) {
  const sys = systeme();
  const pied = sys === 'android'
    ? html`<button type="button" class="btn ghost" id="appli-tard" onClick=${() => onClose()}>Plus tard</button>
      <${OuvrirChrome} store=${ctx.store} id="appli-chrome" onOuvert=${() => setTimeout(() => onClose(), 0)}/>`
    : html`<button type="button" class="btn primary" id="appli-ok" onClick=${() => onClose()}>J’ai compris</button>`;
  return html`<${Modal} title=${APPLI_TITRE[sys]} cls="appareil appli" onClose=${onClose} footer=${pied}>
    <p>${fr(appliIci(integre()?.nom))}</p>
    ${sys === 'android' ? html`<p>${fr(APPLI_CHROME)}</p><p class="small muted">${fr(APPLI_RIEN)}</p>` : html`<${Etapes} liste=${ETAPES_APPLI[sys]}/>`}
  <//>`;
}
injectCSS('pwa-appareil', `
a.pastille-go { text-decoration: none; }
.push-b-acts a.btn, .push-acts a.btn, .modal-foot a.btn { text-decoration: none; }
.modal.appli .modal-body > p, .modal.ancienne .modal-body > p, .modal.ouverture-ios .modal-body > p { margin: 0; }
.modal.appli .modal-body, .modal.ancienne .modal-body, .modal.ouverture-ios .modal-body { display: flex; flex-direction: column; gap: .8rem; }
.debloquer-plus { margin: .2rem 0 0; }
`);
const NOMS_APPLIS = 'Instagram|Facebook|Messenger|LinkedIn|TikTok|Snapchat';
addAR({
  [APPLI_TITRE.android]: 'افتح شبكة ENSAM في Chrome', [APPLI_TITRE.ios]: 'افتح شبكة ENSAM في Safari', [APPLI_TITRE.pc]: 'افتح شبكة ENSAM في متصفحك',
  [APPLI_INCONNUE]: 'فُتح هذا الرابط داخل تطبيق: هنا لا يمكن أن تصلك الإشعارات.',
  [APPLI_CHROME]: 'في Chrome، يصلك ما يخصك فورًا، حتى والتطبيق مغلق.',
  [APPLI_RIEN]: 'لا يُفتح شيء؟ المس ⋮ في أعلى الشاشة، ثم «فتح في Chrome» أو «فتح في المتصفح».',
  [ETAPES_APPLI.ios[0][1]]: 'المس ••• (أعلى الشاشة أو أسفلها)، ثم «فتح في Safari» أو «فتح في المتصفح».',
  [ETAPES_APPLI.ios[1][1]]: 'في Safari: «مشاركة»، ثم «إضافة إلى الشاشة الرئيسية».',
  [ETAPES_APPLI.ios[2][1]]: 'افتح الأيقونة الجديدة، وسجّل الدخول مرة واحدة، ثم المس «تفعيل».',
  [ETAPES_APPLI.pc[0][1]]: 'افتح قائمة التطبيق، ثم «فتح في المتصفح».',
  [ETAPES_APPLI.pc[1][1]]: 'في المتصفح، المس «تفعيل».',
  [DEMO_CHROME]: 'على المنصة الحقيقية، يعيد هذا الزر فتح الصفحة في Chrome، حيث تصل الإشعارات.',
  'Ouvrir dans Chrome': 'فتح في Chrome',
}, [[new RegExp(`^Ce lien s’est ouvert dans (${NOMS_APPLIS}) : ici, les notifications ne peuvent pas arriver\\.$`), n => `فُتح هذا الرابط داخل ${n}: هنا لا يمكن أن تصلك الإشعارات.`]]);

// ---------------------------------------------------------------------------
// « Me prévenir » : après une action qui attend une réponse (demande, mentorat, candidature, question…), une feuille
// propose les notifications sur cet appareil, à la place du petit mot en bas de l'écran.
// Elle revient 3 jours après un refus. Jamais par-dessus une fête : elle attend alors la prochaine visite.
// ---------------------------------------------------------------------------
const NOTIF_RAISON = {
  demande: 'Dès qu’un lauréat te propose son aide, une notification arrive sur cet appareil.',
  mentorat: 'Dès qu’un lauréat choisit un horaire, une notification arrive sur cet appareil.',
  candidature: 'Dès que ta candidature avance, une notification arrive sur cet appareil.',
  proposition: 'Si ton aide est acceptée, une notification arrive sur cet appareil.',
  question: 'Dès qu’un lauréat répond à ta question, une notification arrive sur cet appareil.',
  questionMembre: 'Dès qu’un membre du réseau répond à ta question, une notification arrive sur cet appareil.',
  relecture: 'Dès qu’un lauréat relit ton CV, une notification arrive sur cet appareil.',
};
const PAR_EMAIL = {
  demande: 'Ce navigateur ne peut pas te notifier pour l’instant. Chaque proposition arrive aussi dans tes messages, et un email te prévient si tu ne l’as pas lue.',
  question: 'Ce navigateur ne peut pas te notifier pour l’instant. Les réponses à ta question figurent dans ton résumé de la semaine, par email.',
};
const DEMO = 'Sur la vraie plateforme : candidature reçue, rendez-vous, réponse à ta question… arrivent directement sur ton téléphone.';

let etatConnu = '…', hote = null, montrer = null;
const cleMemo = id => 'ensam-prevenir-' + id;
function lireMemo(id) { try { return JSON.parse(localStorage.getItem(cleMemo(id)) || '{}') || {}; } catch { return {}; } }
function ecrireMemo(id, m) { try { localStorage.setItem(cleMemo(id), JSON.stringify(m)); } catch { /* navigation privée : la feuille pourra revenir */ } }
// En démo, un test peut simuler l'état d'un vrai téléphone ; le navigateur d'une application (son user-agent) se voit aussi
function etatDemo(store) {
  if (store.mode === 'live') return null;
  try { const e = localStorage.getItem('ensam-prevenir-demo'); if (['off', 'ios', 'absent', 'refuse', 'appli'].includes(e)) return e; } catch { /* stockage indisponible */ }
  return integre() ? 'appli' : null;
}
// La catégorie de Mon profil dont dépend la réponse attendue : décochée, « Me prévenir » ne promet pas de notification
const CAT_RAISON = { demande: 'demandes', proposition: 'demandes', mentorat: 'mentorat', relecture: 'mentorat', candidature: 'candidatures', question: 'reseau', questionMembre: 'reseau' };
function variante(raison, memo) {
  const me = hote?.me;
  if (!me) return null;
  return prevenirVariante({ etat: etatConnu, raison, memo, now: Date.now(), role: me.role, voulu: pushChoix(CAT_RAISON[raison] || 'reseau', me),
    emailsMessages: me.emails_messages !== false && 'emails_messages' in me, emailsHebdo: me.emails_hebdo !== false });
}

// Après l'action : true si la feuille s'en charge (ou la fête déjà à l'écran), false si l'appelant montre son petit mot
export function proposerPrevenir(raison, mot) {
  const me = hote?.me;
  if (!me || !montrer) return false;
  const memo = lireMemo(me.id);
  const v = variante(raison, memo);
  if (feteOuverte()) { if (v) ecrireMemo(me.id, { ...memo, differe: raison }); return true; }
  if (!v) return false;
  ensuite(() => montrer({ raison, mot, v, t: Date.now() }));
  return true;
}

export function PrevenirHote({ ctx, bloque }) {
  const { store, me } = ctx;
  const [f, setF] = useState(null);
  // La feuille d'ouverture à l'écran : { t, sorte (push | ios | appli | ancienne | debloquer), etat, lien }
  const [ouv, setOuv] = useState(null);
  // La feuille d'ouverture à l'écran : le mémo d'avant son affichage (elle compte dès qu'elle s'affiche)
  const vue = useRef(null);
  // Une feuille ouverte par un lien d'appareil pendant cette visite : pas de feuille d'ouverture en plus
  const lienVu = useRef(false);
  hote = { me, store };
  // Le lien « Active tes notifications » (?notifs=1) ou l'arrivée par l'ancienne adresse (?depuis=ancienne), lus au
  // démarrage (app.js) : leur feuille tout de suite, dès que l'écran est calme (jamais avant l'accord à donner, ni par-dessus
  // la bienvenue, une fête ou ce que le membre écrit). Gardé pour l'onglet jusqu'à ce que la feuille soit fermée.
  useEffect(() => {
    if (bloque || !lienAppareil()) return undefined;
    let vivant = true, t = 0;
    const debut = Date.now();
    const tenter = async () => {
      const l = lienAppareil();
      if (!vivant || !l) return;
      if (feteOuverte() || arriveeEnAttente(me.id) || occupe()) {
        if (Date.now() - debut < LIEN_FIN) t = setTimeout(tenter, OUV_ESSAI); else oublierLienAppareil();
        return;
      }
      const etat = etatDemo(store) || (store.mode === 'live' ? await etatPush(store).catch(() => 'absent') : 'demo');
      if (!vivant) return;
      etatConnu = etat;
      // Le navigateur d'une application : sa feuille une fois par visite, même quand le lien revient. « Ouvrir dans Chrome »
      // sur un téléphone sans Chrome rouvre la même adresse (?notifs=1) ici même : la même feuille tournerait en boucle.
      // l.vu : la feuille était déjà à l'écran quand une nouvelle version a rechargé la page : elle revient, comptée une fois.
      const sorte = etat === 'appli' ? (appliVue() && !l.vu ? null : 'appli') : l.depuis === 'ancienne' && !isStandalone() ? 'ancienne'
        : l.notifs ? sorteLienNotifs({ etat, memo: lireMemo(me.id) }) : null;
      if (!['push', 'ios', 'appli', 'ancienne', 'debloquer'].includes(sorte)) {
        oublierLienAppareil();
        if (sorte === 'deja') toast(DEJA_ACTIVEES);
        else if (sorte === 'absent') toast(NOTE_ABSENT);
        return;
      }
      lienVu.current = true;
      // La feuille de l'ancienne adresse demande aussi l'activation (ou montre les gestes de l'iPhone) : comptée comme elles
      const compte = sorte !== 'ancienne' ? sorte : etat === 'ios' ? 'ios' : etat === 'off' ? 'push' : null;
      if (compte && !l.vu) compterOuverture(me.id, compte);
      lienAffiche(l);
      setOuv({ t: Date.now(), sorte, etat, lien: true });
    };
    t = setTimeout(tenter, LIEN_DELAI);
    return () => { vivant = false; clearTimeout(t); };
  }, [me.id, bloque]);
  useEffect(() => {
    // Une feuille « Me prévenir » ou une fête dans cette visite : pas de feuille d'ouverture en plus
    let demandee = false;
    // Une fête ouverte entre-temps : la feuille attend la prochaine visite
    const remettre = raison => { if (variante(raison, lireMemo(me.id))) ecrireMemo(me.id, { ...lireMemo(me.id), differe: raison }); };
    // La feuille d'ouverture rangée par une fête ou remplacée par « Me prévenir » : ce n'était pas une vraie présentation,
    // le compte d'avant revient (le reste du mémo, écrit entre-temps, est gardé)
    const rendre = () => {
      const v = vue.current; vue.current = null;
      if (v) rendreOuverture(me.id, v);
    };
    montrer = x => { if (feteOuverte()) { remettre(x.raison); return; } demandee = true; rendre(); setOuv(null); if (x.v === 'email') ecrireMemo(me.id, { ...lireMemo(me.id), mail: 1 }); setF(x); };
    // Une fête qui s'ouvre après la feuille passe devant : la feuille se range sans compter de refus
    const sansFete = quandFete(() => { demandee = true; setF(x => { if (x) remettre(x.raison); return null; }); rendre(); setOuv(null); });
    let vivant = true, pret = false, lancee = false, t = 0;
    const lire = () => { const d = etatDemo(store); if (d) { etatConnu = d; return Promise.resolve(); } return etatPush(store).then(e => { if (vivant) etatConnu = e; }, () => {}); };
    const montage = Date.now();
    let debut = montage;
    const memo0 = lireMemo(me.id);
    let avant = JSON.stringify(memo0);
    // La bienvenue d'un nouveau membre, ou l'accord à donner : la feuille d'ouverture attend la visite suivante
    let autreVisite = bloque || arriveeEnAttente(me.id);
    // La feuille qui convient à cet appareil (ouvertureSorte) ; rien de coché dans Mon profil : rien à proposer
    // (l'administration reçoit toujours les signalements)
    const sorteOuverture = () => {
      const m = hote?.me || me;
      const voulu = m.role === 'admin' || PUSH_CATEGORIES.some(c => c !== 'rappels' && pushChoix(c, m));
      return ouvertureSorte({ etat: etatConnu, memo: lireMemo(me.id), now: Date.now(), voulu, appliVue: appliVue() });
    };
    const essayer = () => {
      // Quelque chose a déjà été demandé ou répondu pendant cette visite (mémo changé, lien d'appareil) : à la visite suivante
      const sorte = sorteOuverture();
      if (!vivant || demandee || lienVu.current || lienAppareil() || feteOuverte() || arriveeEnAttente(me.id) || JSON.stringify(lireMemo(me.id)) !== avant || !sorte) return;
      // Une nouvelle version peut encore recharger la page : la feuille disparaîtrait sous les yeux du membre en comptant comme un refus
      const maj = attenteMaj();
      if (maj > 0) { t = setTimeout(essayer, maj); return; }
      if (occupe()) { if (Date.now() - debut < OUV_FIN) t = setTimeout(essayer, OUV_ESSAI); return; }
      vue.current = compterOuverture(me.id, sorte);
      setOuv({ t: Date.now(), sorte, etat: etatConnu });
    };
    // « Reçois l'essentiel sur ton téléphone », quelques secondes après le début de la visite
    // (l'état connu trop tard, téléphone lent à la première visite : à la visite suivante)
    const demarrer = depuis => {
      lancee = true; debut = depuis;
      if (!autreVisite && sorteOuverture() && Date.now() - debut < OUV_FIN) t = setTimeout(essayer, Math.max(0, OUV_DELAI - (Date.now() - debut), attenteMaj()));
    };
    // La visite commence au premier moment où l'écran est visible : une application installée se recharge souvent cachée
    // (nouvelle version), et le membre la retrouve plus tard. Revenu après une longue absence : c'est une nouvelle visite.
    let visibleDepuis = document.visibilityState === 'visible' ? montage : 0, cacheeDepuis = visibleDepuis ? 0 : montage;
    const vu = () => {
      if (document.visibilityState !== 'visible') { cacheeDepuis = cacheeDepuis || Date.now(); return; }
      const absence = cacheeDepuis ? Date.now() - cacheeDepuis : 0;
      cacheeDepuis = 0; visibleDepuis = visibleDepuis || Date.now();
      lire().then(() => {
        if (!vivant || !pret || document.visibilityState !== 'visible') return;
        if (!lancee) { demarrer(visibleDepuis); return; }
        if (absence < OUV_ABSENCE) return;
        clearTimeout(t);
        demandee = false; lienVu.current = false; avant = JSON.stringify(lireMemo(me.id));
        autreVisite = (store.mode === 'live' && !(hote?.me || me).consent_at) || arriveeEnAttente(me.id);
        demarrer(Date.now());
      });
    };
    document.addEventListener('visibilitychange', vu);
    addEventListener(PUSH_CHANGE, lire);
    lire().then(() => {
      if (!vivant) return;
      pret = true;
      // Une feuille remise à plus tard (une fête était à l'écran) : à la visite suivante, quand rien d'autre n'est ouvert
      if (memo0.differe) {
        lancee = true;
        t = setTimeout(() => {
          const memo = lireMemo(me.id); delete memo.differe; ecrireMemo(me.id, memo);
          if (bloque || document.querySelector('.modal-back:not(.sortie), .fete-back:not(.sortie)')) return;
          const v = variante(memo0.differe, memo);
          if (v) montrer({ raison: memo0.differe, mot: null, v, t: Date.now() });
        }, 2500);
        return;
      }
      if (document.visibilityState === 'visible') demarrer(visibleDepuis || Date.now());
    });
    return () => { vivant = false; clearTimeout(t); montrer = null; sansFete(); vue.current = null; setOuv(null); document.removeEventListener('visibilitychange', vu); removeEventListener(PUSH_CHANGE, lire); };
  }, [me.id]);
  if (f) return html`<${FeuillePrevenir} ctx=${ctx} f=${f} key=${f.t} onClose=${() => setF(null)}/>`;
  if (ouv) {
    const fermer = () => { vue.current = null; if (ouv.lien) oublierLienAppareil(); setOuv(null); };
    const Feuille = { ios: FeuilleIos, appli: FeuilleAppli, ancienne: FeuilleAncienne, debloquer: FeuilleDebloquer }[ouv.sorte] || FeuilleOuverture;
    return html`<${Feuille} ctx=${ctx} etat=${ouv.etat} key=${ouv.t} onClose=${fermer}/>`;
  }
  return null;
}

// Comptée dès qu'elle s'affiche, comme « Plus tard » : quitter l'application sans répondre ne la ramène pas à chaque visite.
// push : le compte partagé avec « Me prévenir » (n, at) ; ios : le sien (memo.ios, 14 jours), et « Me prévenir » attend
// 3 jours (at) ; appli : une fois par visite. Renvoie ce qu'il faut pour la rendre si une fête la range aussitôt.
function compterOuverture(id, sorte) {
  if (sorte === 'appli') { marquerAppliVue(); return { sorte }; }
  const m = lireMemo(id), now = Date.now();
  if (sorte === 'push') ecrireMemo(id, { ...m, n: (m.n || 0) + 1, at: now });
  else if (sorte === 'ios') ecrireMemo(id, { ...m, at: now, ios: { n: ((m.ios || {}).n || 0) + 1, at: now } });
  return { sorte, n: m.n, at: m.at, ios: m.ios };
}
// Rangée par une fête ou remplacée par « Me prévenir » : ce n'était pas une vraie présentation, le compte d'avant revient
// (le reste du mémo, écrit entre-temps, est gardé)
function rendreOuverture(id, v) {
  if (v.sorte === 'appli') { oublierAppliVue(); return; }
  const m = lireMemo(id);
  for (const k of v.sorte === 'ios' ? ['n', 'at', 'ios'] : ['n', 'at']) { if (v[k]) m[k] = v[k]; else delete m[k]; }
  ecrireMemo(id, m);
}

// Un écran calme : rien d'ouvert par-dessus (toute fenêtre modale, la photo agrandie d'un message comprise), pas en train
// d'écrire, l'onglet au premier plan, pas de demande du navigateur en attente (lancée depuis Mon profil)
const occupe = () => demandeEnCours || document.visibilityState !== 'visible' || !!document.querySelector('.modal-back:not(.sortie), .fete-back:not(.sortie), .menu-pop, [aria-modal="true"]') || ecrit(document.activeElement);

// Liens d'appareil, lus au démarrage par app.js (parametresLien) puis retirés de l'adresse : gardés pour cet onglet (une
// nouvelle version peut recharger la page) jusqu'à ce que leur feuille soit fermée
const CLE_LIEN_APPAREIL = 'ensam-lien-appareil', CLE_APPLI_VUE = 'ensam-appli-vue';
const LIEN_DELAI = 900, LIEN_FIN = 60000;
const lienAppareil = () => { try { return JSON.parse(sessionStorage.getItem(CLE_LIEN_APPAREIL) || 'null'); } catch { return null; } };
const oublierLienAppareil = () => { try { sessionStorage.removeItem(CLE_LIEN_APPAREIL); } catch { /* */ } };
// Sa feuille à l'écran (vu) : une nouvelle version qui recharge la page la remontre aussitôt, sans la compter une deuxième fois
const lienAffiche = l => { try { sessionStorage.setItem(CLE_LIEN_APPAREIL, JSON.stringify({ ...l, vu: 1 })); } catch { /* */ } };
export function retenirLienAppareil({ notifs = false, depuis = '' } = {}) {
  if (!notifs && !depuis) return;
  const avant = lienAppareil() || {};
  try { sessionStorage.setItem(CLE_LIEN_APPAREIL, JSON.stringify({ notifs: !!(notifs || avant.notifs), depuis: depuis || avant.depuis || '' })); } catch { /* navigation privée : le lien ouvre seulement la page */ }
}
// La feuille du navigateur d'une application : une fois par visite (cet onglet)
const appliVue = () => { try { return sessionStorage.getItem(CLE_APPLI_VUE) === '1'; } catch { return false; } };
const marquerAppliVue = () => { try { sessionStorage.setItem(CLE_APPLI_VUE, '1'); } catch { /* */ } };
const oublierAppliVue = () => { try { sessionStorage.removeItem(CLE_APPLI_VUE); } catch { /* */ } };
const DEJA_ACTIVEES = 'Les notifications sont déjà activées sur cet appareil.';
addAR({ [DEJA_ACTIVEES]: 'الإشعارات مفعّلة من قبل على هذا الجهاز.' });

// Le toucher sur « Me prévenir » ou « Activer » : c'est lui qui permet au navigateur de demander l'autorisation.
// true quand la feuille peut se fermer ; 'off' (fenêtre du navigateur fermée sans choisir, ou service de notifications
// qui n'a pas répondu) : elle se ferme comme « Plus tard », et la demande pourra revenir ; false (pas de réseau) : elle
// reste, on peut réessayer. Activées : la notification d'essai part toute seule (premiereNotif).
async function accepterNotif(store, me) {
  if (store.mode !== 'live') { ecrireMemo(me.id, { ...lireMemo(me.id), fait: 1 }); toast(DEMO); return true; }
  try {
    const r = await activerPush(store);
    etatConnu = r;
    dispatchEvent(new Event(PUSH_CHANGE));
    if (r === 'off') { toast(PAS_ACTIVEES); return 'off'; }
    // Activées (même après les avoir coupées dans Mon profil : le membre a changé d'avis) : les échecs d'avant sont oubliés
    const { coupe, echecs, sans, ...m } = lireMemo(me.id);
    ecrireMemo(me.id, r === 'on' ? { ...m, fait: 1 } : { ...m, ...(coupe ? { coupe } : {}), ...(echecs ? { echecs } : {}), ...(sans ? { sans } : {}), fait: 1 });
    if (r === 'on') { toast('Notifications activées sur cet appareil.', 'win'); premiereNotif(store); }
    return true;
  } catch (e) {
    // Navigateur sans service de notifications (Brave, téléphone sans services Google…) : une phrase calme, et la feuille
    // ne revient plus sur ce navigateur ; le bouton de « Mon profil » reste là pour réessayer. Service qui n'a pas répondu :
    // au deuxième jour seulement (apresEchec)
    return apresEchec(me, e);
  }
}

function FeuillePrevenir({ ctx, f, onClose }) {
  const { store, me } = ctx;
  const [busy, setBusy] = useState(false);
  const email = f.v === 'email', ios = f.v === 'ios';
  // Fermer sans accepter (Plus tard, ×, Retour, toucher à côté) compte comme un refus ; la variante email est déjà notée
  const refuser = () => { if (!email) { const m = lireMemo(me.id); ecrireMemo(me.id, { ...m, n: (m.n || 0) + 1, at: Date.now() }); } onClose(); };
  const accepter = async () => {
    if (email || ios) return refuser();
    setBusy(true);
    const r = await accepterNotif(store, me);
    if (r === 'off') refuser(); else if (r) onClose(); else setBusy(false);
  };
  const raison = f.raison === 'question' && me.role !== 'etudiant' ? 'questionMembre' : f.raison;
  const pied = html`${email || ios ? null : html`<button type="button" class="btn ghost" id="pv-tard" onClick=${refuser}>Plus tard</button>`}
    <button type="button" class="btn primary" id="pv-oui" disabled=${busy} onClick=${accepter}>${email || ios ? 'J’ai compris' : html`<${Icon} name="bell" size=${16}/> Me prévenir`}</button>`;
  return html`<${Modal} title=${email ? 'Tu ne rateras pas la réponse' : 'Te prévenir de la réponse ?'} cls="prevenir" onClose=${refuser} footer=${pied}>
    ${f.mot ? html`<p class="verify-ok"><${Icon} name="check" size=${16}/> ${f.mot}</p>` : null}
    ${email ? html`<p>${PAR_EMAIL[f.raison]}</p>` : html`<p>${NOTIF_RAISON[raison]}</p>`}
    ${ios ? html`<p class="small muted">Sur iPhone, les notifications arrivent une fois le Réseau ENSAM ajouté à l’écran d’accueil :</p><${EtapesIos}/>`
      : email ? null : html`<p class="small muted">Rien d’autre : pas de publicité, et tu l’arrêtes quand tu veux dans « Mon profil ».</p>`}
  <//>`;
}

// ---------------------------------------------------------------------------
// À l'ouverture : « Reçois l'essentiel sur ton téléphone » (« sur cet ordinateur » sur un ordinateur), pour un membre dont
// l'appareil peut recevoir des notifications sans y être abonné (règle : ouvertureNotif), l'administration comprise (ses
// signalements). L'iPhone dans Safari a la sienne (les gestes pour l'écran d'accueil), le navigateur d'une application aussi
// (« Ouvrir dans Chrome ») : ouvertureSorte. Quelques secondes après l'arrivée
// (le premier moment où l'écran est visible ; pas tant qu'une nouvelle version peut recharger la page), sur un écran calme ;
// sinon la visite suivante. Revenir après une heure ou plus est une nouvelle visite. Jamais la même
// visite que la bienvenue, l'accord à donner, une fête ou une feuille « Me prévenir ». Elle compte comme un refus dès
// qu'elle s'affiche (« Plus tard », fermer, ou quitter l'application sans répondre), dans le même mémo que « Me prévenir ».
// ---------------------------------------------------------------------------
const OUV_DELAI = 3000, OUV_ESSAI = 2500, OUV_FIN = 30000, OUV_ABSENCE = 3600e3;
// Page servie par le service worker : une nouvelle version peut la recharger pendant ses premières secondes
// (suivreMisesAJour) ; la feuille attend la fin de cette fenêtre. Ce qu'il reste à attendre, en millisecondes.
const attenteMaj = () => (navigator.serviceWorker?.controller ? FENETRE_MAJ + 500 - (Date.now() - ouverture) : 0);
// Un téléphone ou une tablette : la feuille parle de « ton téléphone » ; sur un ordinateur, de cet ordinateur (c'est lui
// qu'« Activer » abonne)
const surTelephone = () => isIOS() || /android|mobile/i.test(navigator.userAgent);
const OUV_TITRE = { tel: 'Reçois l’essentiel sur ton téléphone', pc: 'Reçois l’essentiel sur cet ordinateur' };
// En train d'écrire (un champ de texte a le curseur) : la feuille attend
const ecrit = el => !!el && (el.isContentEditable || el.tagName === 'TEXTAREA'
  || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image'].includes(el.type)));
// Ce que chacun reçoit, dans l'ordre où le dire ; la feuille en montre quatre au plus, parmi ses catégories activées
const OUV_POINTS = {
  etudiant: {
    messages: 'Tes messages',
    demandes: 'Les lauréats qui te proposent leur aide',
    candidatures: 'Tes candidatures qui avancent',
    offres: 'Les nouvelles offres de ton année et de ta filière',
    mentorat: 'Tes rendez-vous de mentorat et relectures de CV',
    reseau: 'Les réponses à tes questions',
  },
  laureat: {
    messages: 'Tes messages',
    demandes: 'Les nouvelles demandes d’étudiants de ta filière',
    offres: 'Les nouvelles offres de ta filière',
    candidatures: 'Les candidatures reçues sur tes offres',
    mentorat: 'Les demandes de mentorat et tes rendez-vous',
    reseau: 'Les questions qui te sont adressées',
  },
  // Un lauréat qui cherche un emploi publie sa demande et postule : la suite des siennes d'abord
  recherche: {
    demandes: 'Les réponses à ta demande d’emploi',
    candidatures: 'Tes candidatures qui avancent',
  },
  // L'administration : les signalements ne partent que vers un appareil abonné
  admin: {
    admin: 'Les signalements à traiter',
    messages: 'Tes messages',
  },
};
const OUV_ICONES = { admin: 'flag', messages: 'chat', demandes: 'send', candidatures: 'briefcase', offres: 'feed', mentorat: 'mentor', reseau: 'qa' };
const OUV_INTRO = 'Ce qui te concerne arrive tout de suite, même quand l’application est fermée :';
const OUV_CHOIX = 'Tu choisis quoi recevoir dans « Mon profil ». Pas de publicité.';

function FeuilleOuverture({ ctx, onClose }) {
  const { store, me } = ctx;
  const [busy, setBusy] = useState(false);
  // « Activer » à l'écran : la clé de la plateforme est demandée dès maintenant
  useEffect(() => { cleAPrete(store); }, []);
  const mots = me.role === 'admin' ? OUV_POINTS.admin : me.role === 'etudiant' ? OUV_POINTS.etudiant : me.en_recherche ? { ...OUV_POINTS.laureat, ...OUV_POINTS.recherche } : OUV_POINTS.laureat;
  const points = Object.entries(mots).filter(([cat]) => pushChoix(cat, me)).slice(0, 4);
  const activer = async () => { setBusy(true); if (await accepterNotif(store, me)) onClose(); else setBusy(false); };
  const pied = html`<button type="button" class="btn ghost" id="ouv-tard" onClick=${() => onClose()}>Plus tard</button>
    <button type="button" class="btn primary" id="ouv-oui" disabled=${busy} onClick=${activer}><${Icon} name="bell" size=${16}/> Activer</button>`;
  return html`<${Modal} title=${surTelephone() ? OUV_TITRE.tel : OUV_TITRE.pc} cls="prevenir ouverture" onClose=${onClose} footer=${pied}>
    <p>${OUV_INTRO}</p>
    ${points.length ? html`<ul class="ouv-points">${points.map(([cat, txt]) => html`<li key=${cat} data-cat=${cat}><span class="g-ico"><${Icon} name=${OUV_ICONES[cat]} size=${18}/></span> ${txt}</li>`)}</ul>` : null}
    <p class="small muted">${OUV_CHOIX}</p>
  <//>`;
}

// iPhone dans Safari : les notifications n'arrivent que dans l'application ajoutée à l'écran d'accueil. À l'ouverture, une
// fois, puis une seule autre fois 14 jours après (ouvertureSorte) ; « J'ai compris » ou fermer : rien d'autre à faire ici.
const IOS_TITRE = 'Reçois l’essentiel sur ton iPhone';
const IOS_INTRO = 'Sur iPhone, les notifications n’arrivent que dans l’application ajoutée à l’écran d’accueil. Une minute, une seule fois :';
function FeuilleIos({ onClose }) {
  const pied = html`<button type="button" class="btn primary" id="ios-ok" onClick=${() => onClose()}>J’ai compris</button>`;
  return html`<${Modal} title=${IOS_TITRE} cls="appareil ouverture-ios" onClose=${onClose} footer=${pied}>
    <p>${fr(IOS_INTRO)}</p>
    <${EtapesIos}/>
    <p class="small muted">${fr(OUV_CHOIX)}</p>
  <//>`;
}

// Arrivée par l'ancienne adresse du Réseau (?depuis=ancienne, ajouté par sa redirection) : une seule feuille, avec les gestes
// de cet appareil. Notifications possibles ici sans rien installer (Android, ordinateur) : « Activer » tout de suite.
const ANCIENNE_TITRE = 'Le Réseau ENSAM a une nouvelle adresse';
const ANCIENNE_INTRO = 'Supprime l’ancienne icône, installe celle-ci, puis active les notifications :';
const ANCIENNE_SUPPRIMER = {
  android: 'Appuie longuement sur l’ancienne icône du Réseau ENSAM, puis touche « Désinstaller » ou « Supprimer ».',
  ios: 'Appuie longuement sur l’ancienne icône du Réseau ENSAM, puis touche « Supprimer l’app ».',
  pc: 'Si l’ancienne version est installée sur cet ordinateur, désinstalle-la depuis le menu de sa fenêtre.',
};
const ANCIENNE_ACTIVER = 'Ouvre la nouvelle icône, puis touche « Activer » : sans ce toucher, aucune notification n’arrive.';
const ETAPES_ANCIENNE = {
  android: () => [['trash', ANCIENNE_SUPPRIMER.android], ['more-v', 'Ici, touche le menu ⋮ du navigateur, puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».'], ['bell', ANCIENNE_ACTIVER]],
  ios: () => [['trash', ANCIENNE_SUPPRIMER.ios], ...etapesIos()],
  pc: () => [['trash', ANCIENNE_SUPPRIMER.pc], ['download', 'Installe celle-ci : l’icône d’installation dans la barre d’adresse, ou le menu du navigateur.'], ['bell', 'Puis touche « Activer » : sans ce toucher, aucune notification n’arrive.']],
};
function FeuilleAncienne({ ctx, etat, onClose }) {
  const { store, me } = ctx;
  const [busy, setBusy] = useState(false);
  // État 'ios' : iPhone dans Safari (en démo, simulé sur n'importe quel téléphone)
  const sys = etat === 'ios' ? 'ios' : systeme();
  const activable = etat === 'off' && sys !== 'ios';
  useEffect(() => { if (activable) cleAPrete(store); }, []);
  const etapes = ETAPES_ANCIENNE[sys]();
  if (etat === 'on') etapes[etapes.length - 1] = ['check', DEJA_ACTIVEES];
  const activer = async () => { setBusy(true); if (await accepterNotif(store, me)) onClose(); else setBusy(false); };
  const pied = activable
    ? html`<button type="button" class="btn ghost" id="anc-tard" onClick=${() => onClose()}>Plus tard</button>
      <button type="button" class="btn primary" id="anc-oui" disabled=${busy} onClick=${activer}><${Icon} name="bell" size=${16}/> Activer</button>`
    : html`<button type="button" class="btn primary" id="anc-ok" onClick=${() => onClose()}>J’ai compris</button>`;
  return html`<${Modal} title=${ANCIENNE_TITRE} cls="appareil ancienne" onClose=${onClose} footer=${pied}>
    <p>${fr(ANCIENNE_INTRO)}</p>
    <${Etapes} liste=${etapes}/>
  <//>`;
}
addAR({
  [OUV_POINTS.admin.admin]: 'البلاغات التي تنتظر المعالجة',
  [IOS_TITRE]: 'الأهم يصلك على iPhone الخاص بك',
  [IOS_INTRO]: 'على iPhone، لا تصل الإشعارات إلا داخل التطبيق المضاف إلى الشاشة الرئيسية. دقيقة واحدة، ومرة واحدة فقط:',
  [ANCIENNE_TITRE]: 'لشبكة ENSAM عنوان جديد',
  [ANCIENNE_INTRO]: 'احذف الأيقونة القديمة، وثبّت هذه، ثم فعّل الإشعارات:',
  [ANCIENNE_SUPPRIMER.android]: 'اضغط مطوّلًا على الأيقونة القديمة لشبكة ENSAM، ثم المس «إلغاء التثبيت» أو «حذف».',
  [ANCIENNE_SUPPRIMER.ios]: 'اضغط مطوّلًا على الأيقونة القديمة لشبكة ENSAM، ثم المس «حذف التطبيق».',
  [ANCIENNE_SUPPRIMER.pc]: 'إذا كانت النسخة القديمة مثبّتة على هذا الحاسوب، فألغِ تثبيتها من قائمة نافذتها.',
  [ANCIENNE_ACTIVER]: 'افتح الأيقونة الجديدة، ثم المس «تفعيل»: بدون هذه اللمسة لا يصلك أي إشعار.',
  'Ici, touche le menu ⋮ du navigateur, puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».': 'هنا، المس قائمة ⋮ في المتصفح، ثم «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».',
  'Installe celle-ci : l’icône d’installation dans la barre d’adresse, ou le menu du navigateur.': 'ثبّت هذه النسخة: أيقونة التثبيت في شريط العنوان، أو قائمة المتصفح.',
  'Puis touche « Activer » : sans ce toucher, aucune notification n’arrive.': 'ثم المس «تفعيل»: بدون هذه اللمسة لا يصلك أي إشعار.',
});

const SANS_NOTIF = 'Ce navigateur ne peut pas recevoir de notifications pour l’instant.';
const PAS_ACTIVEES = 'Pas activées pour l’instant. Tu pourras le faire quand tu veux dans « Mon profil ».';
addAR({
  [SANS_NOTIF]: 'لا يستطيع هذا المتصفح استقبال الإشعارات حاليًا.',
  [PAS_ACTIVEES]: 'لم تُفعَّل الآن. يمكنك تفعيلها متى شئت من «ملفي الشخصي».',
  'Te prévenir de la réponse ?': 'هل نُعلمك عند وصول الرد؟', 'Me prévenir': 'أعلِمني', 'J’ai compris': 'فهمت', 'Plus tard': 'لاحقًا',
  'Tu ne rateras pas la réponse': 'لن تفوتك الإجابة',
  'Rien d’autre : pas de publicité, et tu l’arrêtes quand tu veux dans « Mon profil ».': 'لا شيء غير ذلك: لا إعلانات، ويمكنك إيقافه متى شئت من «ملفي الشخصي».',
  'Sur iPhone, les notifications arrivent une fois le Réseau ENSAM ajouté à l’écran d’accueil :': 'على iPhone، تصل الإشعارات بعد إضافة شبكة ENSAM إلى الشاشة الرئيسية:',
  [PAR_EMAIL.demande]: 'لا يستطيع هذا المتصفح إرسال إشعار إليك حاليًا. يصلك كل اقتراح في رسائلك أيضًا، ويُنبّهك بريد إلكتروني إن لم تقرأه.',
  [PAR_EMAIL.question]: 'لا يستطيع هذا المتصفح إرسال إشعار إليك حاليًا. تجد الأجوبة على سؤالك في ملخصك الأسبوعي بالبريد الإلكتروني.',
  [NOTIF_RAISON.demande]: 'بمجرد أن يقترح عليك أحد الخريجين مساعدته، يصلك إشعار على هذا الجهاز.',
  [NOTIF_RAISON.mentorat]: 'بمجرد أن يختار أحد الخريجين موعدًا، يصلك إشعار على هذا الجهاز.',
  [NOTIF_RAISON.candidature]: 'بمجرد أن يتقدّم ترشيحك، يصلك إشعار على هذا الجهاز.',
  [NOTIF_RAISON.proposition]: 'إذا قُبلت مساعدتك، يصلك إشعار على هذا الجهاز.',
  [NOTIF_RAISON.question]: 'بمجرد أن يجيب أحد الخريجين عن سؤالك، يصلك إشعار على هذا الجهاز.',
  [NOTIF_RAISON.questionMembre]: 'بمجرد أن يجيب أحد أعضاء الشبكة عن سؤالك، يصلك إشعار على هذا الجهاز.',
  [NOTIF_RAISON.relecture]: 'بمجرد أن يراجع أحد الخريجين سيرتك الذاتية، يصلك إشعار على هذا الجهاز.',
  // Feuille d'ouverture
  [OUV_TITRE.tel]: 'الأهم يصلك على هاتفك',
  [OUV_TITRE.pc]: 'الأهم يصلك على هذا الحاسوب',
  'Tu choisis quoi recevoir dans « Mon profil ». Pas de publicité.': 'تختار ما يصلك من «ملفي الشخصي». لا إعلانات.',
  [OUV_INTRO]: 'ما يخصك يصلك فورًا، حتى والتطبيق مغلق:',
  [OUV_POINTS.etudiant.messages]: 'رسائلك',
  [OUV_POINTS.etudiant.demandes]: 'الخريجون الذين يقترحون عليك مساعدتهم',
  [OUV_POINTS.etudiant.candidatures]: 'تقدّم ترشيحاتك',
  [OUV_POINTS.etudiant.offres]: 'العروض الجديدة الخاصة بسنتك وشعبتك',
  [OUV_POINTS.etudiant.mentorat]: 'مواعيد الإرشاد ومراجعات سيرتك الذاتية',
  [OUV_POINTS.etudiant.reseau]: 'الأجوبة على أسئلتك',
  [OUV_POINTS.laureat.demandes]: 'الطلبات الجديدة لطلبة شعبتك',
  [OUV_POINTS.laureat.offres]: 'العروض الجديدة في شعبتك',
  [OUV_POINTS.laureat.candidatures]: 'الترشيحات التي تصل إلى عروضك',
  [OUV_POINTS.laureat.mentorat]: 'طلبات الإرشاد ومواعيدك',
  [OUV_POINTS.laureat.reseau]: 'الأسئلة الموجّهة إليك',
  [OUV_POINTS.recherche.demandes]: 'الردود على طلب العمل الخاص بك',
});

// ---------------------------------------------------------------------------
// La pastille, en bas de l'écran : tant que cet appareil ne reçoit pas les notifications, « Activer les notifications »
// (« Notifications bloquées » : comment les débloquer), puis « Installer l'application » tant qu'elle ne l'est pas.
// Sur iPhone dans Safari, l'installation d'abord : c'est le seul chemin vers les notifications. Dans le navigateur d'une
// application, « Ouvrir dans Chrome » (ou Safari). Rien de ce que le membre a coupé dans Mon profil n'y revient. Toujours
// là, sans rien couvrir : jamais pendant qu'on écrit ni dans les messages. × la range 3 jours (10 jours après trois fois).
// En démo, un test simule un vrai téléphone : ensam-install-demo (android | ios | prompt), ensam-prevenir-demo (off…).
// ---------------------------------------------------------------------------
const JOUR = 864e5;
const clePastille = id => 'ensam-pastille-' + id;
function lirePastille(id) { try { return JSON.parse(localStorage.getItem(clePastille(id)) || '{}') || {}; } catch { return {}; } }
function ecrirePastille(id, m) { try { localStorage.setItem(clePastille(id), JSON.stringify(m)); } catch { /* navigation privée */ } }
function installDemo(store) {
  if (store.mode === 'live') return null;
  try { const e = localStorage.getItem('ensam-install-demo'); return ['android', 'ios', 'prompt'].includes(e) ? e : null; } catch { return null; }
}
export const PASTILLE = {
  installer: ['Installer l’application', 'Une icône sur ton écran d’accueil'],
  activer: ['Activer les notifications', 'Messages, offres, réponses : tout de suite'],
  debloquer: ['Notifications bloquées', 'Les débloquer en trois gestes'],
  appli: ['Ouvrir dans Chrome', 'Ici, les notifications n’arrivent pas'],
};
// iPhone dans Safari : l'installation est le chemin vers les notifications ; le navigateur d'une application : le bon navigateur
const PASTILLE_IOS = 'Pour recevoir tes notifications sur iPhone';
const PASTILLE_APPLI = { android: 'Ouvrir dans Chrome', ios: 'Ouvrir dans Safari', pc: 'Ouvrir dans le navigateur' };
const PASTILLE_ICO = { installer: 'download', activer: 'bell', debloquer: 'lock', appli: 'globe' };
const DEMO_INSTALL = 'Sur la vraie plateforme, l’application s’installe ici en un toucher.';

export function PastilleApp({ ctx, cache }) {
  const { store, me } = ctx;
  const vraie = useInstall();
  const [simI, setSimI] = useState(() => installDemo(store));
  const install = store.mode === 'live' ? vraie : simI ? { [simI]: true } : null;
  const [push, setPush] = useState(() => etatDemo(store) || '…');
  const [masque, setMasque] = useState(() => (lirePastille(me.id).jusqua || 0) > Date.now());
  const [pret, setPret] = useState(false);
  const [ecriture, setEcriture] = useState(false);
  const [aide, setAide] = useState(null); // ios | android | debloquer | appli
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let vivant = true;
    const lire = () => { const d = etatDemo(store); if (d) { setPush(d); return; } etatPush(store).then(e => { if (vivant) setPush(e); }, () => {}); };
    lire();
    // Revenu des réglages du téléphone (notifications débloquées) : la pastille suit
    const vu = () => { if (document.visibilityState === 'visible') lire(); };
    const f = () => setTimeout(() => setEcriture(ecrit(document.activeElement)), 0);
    addEventListener(PUSH_CHANGE, lire);
    document.addEventListener('visibilitychange', vu);
    document.addEventListener('focusin', f); document.addEventListener('focusout', f);
    // Quelques secondes après l'arrivée : l'écran d'abord
    const t = setTimeout(() => setPret(true), 2000);
    return () => { vivant = false; clearTimeout(t); removeEventListener(PUSH_CHANGE, lire); document.removeEventListener('visibilitychange', vu); document.removeEventListener('focusin', f); document.removeEventListener('focusout', f); };
  }, [me.id]);
  // L'administration reçoit toujours les signalements ; coupées dans Mon profil : la pastille ne les redemande pas
  const memo = lireMemo(me.id);
  const voulu = (me.role === 'admin' || PUSH_CATEGORIES.some(c => c !== 'rappels' && pushChoix(c, me))) && !memo.coupe;
  // L'abonnement a déjà échoué pour de bon sur ce navigateur (memo.sans) : « Activer » n'y servirait à rien
  const notif = !voulu ? null : push === 'off' ? (memo.sans ? null : 'activer') : push === 'refuse' ? 'debloquer' : null;
  // Installer ne suffit pas à recevoir les notifications (il faut toucher « Activer ») : elles passent d'abord, sauf sur
  // iPhone dans Safari où l'icône de l'écran d'accueil est le seul chemin vers elles
  const sorte = push === 'appli' ? (voulu ? 'appli' : null) : install?.ios ? 'installer' : notif || (install ? 'installer' : null);
  const sys = systeme();
  // « Activer » à toucher : la clé de la plateforme est demandée dès maintenant
  useEffect(() => { if (pret && (sorte === 'activer' || sorte === 'debloquer')) cleAPrete(store); }, [pret, sorte]);
  const agir = async () => {
    if (sorte === 'debloquer' || sorte === 'appli') { setAide(sorte); return; }
    if (sorte === 'installer') {
      if (install.ios || install.android) { setAide(install.ios ? 'ios' : 'android'); return; }
      if (simI) { try { localStorage.removeItem('ensam-install-demo'); } catch { /* rien */ } setSimI(null); toast(DEMO_INSTALL); return; }
      setBusy(true); try { await install.prompt(); } finally { setBusy(false); }
      return;
    }
    setBusy(true);
    const r = await accepterNotif(store, me);
    setBusy(false);
    if (r === true && store.mode !== 'live') setPush('on');
  };
  const masquer = () => {
    const m = lirePastille(me.id), n = (m.n || 0) + 1;
    ecrirePastille(me.id, { n, jusqua: Date.now() + (n < 3 ? 3 : 10) * JOUR });
    setMasque(true);
  };
  const fermerAide = () => setAide(null);
  const feuille = aide === 'debloquer' ? html`<${FeuilleDebloquer} ctx=${ctx} onClose=${fermerAide}/>`
    : aide === 'appli' ? html`<${FeuilleAppli} ctx=${ctx} onClose=${fermerAide}/>`
    : aide ? html`<${IosInstallHelp} android=${aide === 'android'} onClose=${fermerAide}/>` : null;
  if (!sorte || !pret || masque || cache || ecriture) return feuille;
  const titre = sorte === 'appli' ? PASTILLE_APPLI[sys] : PASTILLE[sorte][0];
  // « Pour recevoir tes notifications » : seulement à qui les veut (coupées dans Mon profil, ou rien de coché : une icône, sans promesse)
  const sous = sorte === 'installer' && install.ios && voulu ? PASTILLE_IOS : PASTILLE[sorte][1];
  const dedans = html`<span class="pastille-ico" aria-hidden="true"><${Icon} name=${PASTILLE_ICO[sorte]} size=${18}/></span>
    <span class="pastille-txt"><strong>${titre}</strong><span>${sous}</span></span>`;
  // Sur Android, le navigateur d'une application : le lien rouvre la page dans Chrome, en un toucher
  const go = sorte === 'appli' && sys === 'android' ? html`<${OuvrirChrome} store=${store} cls="pastille-go" id="pastille-go">${dedans}<//>`
    : html`<button type="button" class="pastille-go" id="pastille-go" disabled=${busy} onClick=${agir}>${dedans}</button>`;
  return html`<aside class="pastille" aria-label=${titre} data-sorte=${sorte}>
      ${go}
      <button type="button" class="pastille-x" id="pastille-x" aria-label="Masquer quelques jours" onClick=${masquer}><${Icon} name="x" size=${16}/></button>
    </aside>${feuille}`;
}

// Notifications bloquées par le navigateur : les gestes de cet appareil pour les rouvrir, puis « C'est fait ». Sur Android,
// Chrome montre à gauche de l'adresse un cadenas ou l'icône des réglages ; si le téléphone lui-même bloque Chrome, une ligne de plus.
const DEBLOQUER = {
  android: [['lock', 'Touche l’icône à gauche de l’adresse (cadenas ou réglages).'], ['bell', 'Ouvre « Autorisations », puis « Notifications ».'], ['check', 'Choisis « Autoriser », puis reviens ici.']],
  appli: [['phone', 'Appuie longuement sur l’icône du Réseau ENSAM, puis sur « Infos sur l’appli ».'], ['bell', 'Ouvre « Notifications ».'], ['check', 'Active « Afficher les notifications », puis reviens ici.']],
  ios: [['phone', 'Ouvre les Réglages de l’iPhone, puis « Notifications ».'], ['bell', 'Choisis « Réseau ENSAM ».'], ['check', 'Active « Autoriser les notifications », puis reviens ici.']],
  pc: [['lock', 'Clique sur le cadenas à gauche de l’adresse du site.'], ['bell', 'À la ligne « Notifications », choisis « Autoriser ».'], ['check', 'Recharge la page, puis touche « C’est fait ».']],
};
const DEBLOQUER_PLUS = 'Toujours rien ? Réglages du téléphone › Applications › Chrome › Notifications : autorise-les.';
const DEBLOQUER_INTRO = 'Ce navigateur a bloqué les notifications du Réseau ENSAM. Pour les recevoir :';
const TOUJOURS_BLOQUEES = 'Toujours bloquées. Suis les trois gestes, puis réessaie.';
function FeuilleDebloquer({ ctx, onClose }) {
  const { store, me } = ctx;
  const [busy, setBusy] = useState(false);
  const ou = isIOS() ? 'ios' : isAndroid() ? (isStandalone() ? 'appli' : 'android') : 'pc';
  // « C'est fait » à toucher : la clé de la plateforme est demandée dès maintenant
  useEffect(() => { cleAPrete(store); }, []);
  const fait = async () => {
    if (store.mode === 'live' && 'Notification' in window && Notification.permission === 'denied') { toast(TOUJOURS_BLOQUEES, 'err'); return; }
    setBusy(true);
    const r = await accepterNotif(store, me);
    setBusy(false);
    if (r) onClose();
  };
  const pied = html`<button type="button" class="btn ghost" onClick=${onClose}>Plus tard</button>
    <button type="button" class="btn primary" id="debloquer-ok" disabled=${busy} onClick=${fait}><${Icon} name="check" size=${16}/> C’est fait</button>`;
  return html`<${Modal} title="Débloquer les notifications" cls="prevenir" onClose=${onClose} footer=${pied}>
    <p>${fr(DEBLOQUER_INTRO)}</p>
    <ol class="ios-steps">${DEBLOQUER[ou].map(([ico, txt]) => html`<li key=${txt}><span class="g-ico"><${Icon} name=${ico} size=${18}/></span> ${fr(txt)}</li>`)}</ol>
    ${ou === 'android' || ou === 'appli' ? html`<p class="small muted debloquer-plus" id="debloquer-plus">${fr(DEBLOQUER_PLUS)}</p>` : null}
  <//>`;
}

addAR({
  [PASTILLE.installer[1]]: 'أيقونة على شاشتك الرئيسية',
  [PASTILLE.activer[0]]: 'فعّل الإشعارات', [PASTILLE.activer[1]]: 'الرسائل والعروض والأجوبة: فورًا',
  [PASTILLE.debloquer[0]]: 'الإشعارات محظورة', [PASTILLE.debloquer[1]]: 'ارفع الحظر في ثلاث خطوات',
  [PASTILLE.appli[1]]: 'هنا لا تصل الإشعارات',
  [PASTILLE_IOS]: 'لتصلك إشعاراتك على iPhone',
  [PASTILLE_APPLI.ios]: 'فتح في Safari', [PASTILLE_APPLI.pc]: 'فتح في المتصفح',
  'Masquer quelques jours': 'إخفاء لبضعة أيام',
  [DEMO_INSTALL]: 'على المنصة الحقيقية، يُثبَّت التطبيق هنا بلمسة واحدة.',
  'Débloquer les notifications': 'رفع الحظر عن الإشعارات', 'C’est fait': 'تمّ',
  [DEBLOQUER_INTRO]: 'حظر هذا المتصفح إشعارات شبكة ENSAM. لتصلك:',
  [TOUJOURS_BLOQUEES]: 'ما زالت محظورة. اتبع الخطوات الثلاث، ثم أعد المحاولة.',
  [DEBLOQUER_PLUS]: 'ما زال لا شيء؟ إعدادات الهاتف › التطبيقات › Chrome › الإشعارات: اسمح بها.',
  [DEBLOQUER.android[0][1]]: 'المس الأيقونة بجانب عنوان الموقع (القفل أو الإعدادات).',
  [DEBLOQUER.android[1][1]]: 'افتح «الأذونات»، ثم «الإشعارات».',
  [DEBLOQUER.android[2][1]]: 'اختر «السماح»، ثم ارجع إلى هنا.',
  [DEBLOQUER.appli[0][1]]: 'اضغط مطوّلًا على أيقونة شبكة ENSAM، ثم على «معلومات التطبيق».',
  [DEBLOQUER.appli[1][1]]: 'افتح «الإشعارات».',
  [DEBLOQUER.appli[2][1]]: 'فعّل «إظهار الإشعارات»، ثم ارجع إلى هنا.',
  [DEBLOQUER.ios[0][1]]: 'افتح إعدادات iPhone، ثم «الإشعارات».',
  [DEBLOQUER.ios[1][1]]: 'اختر «شبكة ENSAM».',
  [DEBLOQUER.ios[2][1]]: 'فعّل «السماح بالإشعارات»، ثم ارجع إلى هنا.',
  [DEBLOQUER.pc[0][1]]: 'انقر على القفل بجانب عنوان الموقع.',
  [DEBLOQUER.pc[1][1]]: 'في سطر «الإشعارات»، اختر «السماح».',
  [DEBLOQUER.pc[2][1]]: 'أعد تحميل الصفحة، ثم المس «تمّ».',
});
