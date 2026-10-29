// Application installable (écran d'accueil du téléphone) et notifications sur le téléphone.
// Le service worker n'est enregistré que sur le vrai site (dist/), qui déclare un manifeste.
import { html, useState, useEffect, useRef } from './vendor/preact-htm.js';
import { Icon, Modal, toast, ensuite, feteOuverte, quandFete } from './ui.js';
import { addAR } from './i18n.js';
import { prevenirVariante, ouvertureNotif, pushChoix, PUSH_CATEGORIES } from './logic.js';
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
export const swReady = (() => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !document.querySelector('link[rel="manifest"]')) return Promise.resolve(null);
  return new Promise(ok => auRepos(ok)).then(() => navigator.serviceWorker.register('sw.js')).then(reg => { suivreMisesAJour(reg); return navigator.serviceWorker.ready; }).catch(() => null);
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
// « Installer l'application » (menu du compte et pastille) : visible quand l'installation est possible.
// { prompt } : le navigateur installe en un toucher ; { ios } / { android } : les gestes à faire, montrés dans une feuille
// (Android sans proposition du navigateur : Firefox, Samsung Internet, ou Chrome qui ne l'a pas encore proposée)
export function useInstall() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set(x => x + 1); listeners.add(f); return () => listeners.delete(f); }, []);
  if (!hasManifest() || isStandalone()) return null;
  if (installEvt) return { prompt: async () => { const e = installEvt; installEvt = null; notify(); e.prompt(); await e.userChoice.catch(() => null); } };
  if (isIOS()) return { ios: true };
  if (isAndroid() && !dejaInstallee()) return { android: true };
  return null;
}

const EtapesIos = () => html`<ol class="ios-steps">
    <li><span class="g-ico"><${Icon} name="share" size=${18}/></span> Dans Safari, touche le bouton Partager en bas de l’écran.</li>
    <li><span class="g-ico"><${Icon} name="plus" size=${18}/></span> Choisis « Sur l’écran d’accueil ».</li>
    <li><span class="g-ico"><${Icon} name="check" size=${18}/></span> Ouvre le Réseau ENSAM depuis son icône, puis active les notifications dans « Mon profil ».</li>
  </ol>`;
const EtapesAndroid = () => html`<ol class="ios-steps">
    <li><span class="g-ico debout"><${Icon} name="more" size=${18}/></span> Touche le menu ⋮ du navigateur, en haut à droite.</li>
    <li><span class="g-ico"><${Icon} name="plus" size=${18}/></span> Choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ».</li>
    <li><span class="g-ico"><${Icon} name="check" size=${18}/></span> Ouvre le Réseau ENSAM depuis son icône : les notifications arrivent même quand il est fermé.</li>
  </ol>`;
const POURQUOI_INSTALLER = 'Une icône sur ton écran d’accueil, et les notifications qui arrivent même quand l’application est fermée.';
export function IosInstallHelp({ onClose, android }) {
  return html`<${Modal} title="Installer l’application" onClose=${onClose}><p>${POURQUOI_INSTALLER}</p>${android ? html`<${EtapesAndroid}/>` : html`<${EtapesIos}/>`}<//>`;
}

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
    if (!sub) return;
    const key = await store.pushKey();
    if (key && !memeCle(sub.options?.applicationServerKey, key)) {
      await sub.unsubscribe().catch(() => {});
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
    }
    await store.abonnerPush(sub);
  } catch { /* hors ligne, ou navigateur qui veut un geste : à la prochaine ouverture */ }
}

const PUSH_CHANGE = 'ensam-push';
// Les notifications sur cet appareil : demo | absent | ios | refuse | off | on
export async function etatPush(store) {
  if (store.mode !== 'live') return 'demo';
  if (!('Notification' in window) || !('PushManager' in window) || !hasManifest()) return isIOS() && !isStandalone() ? 'ios' : 'absent';
  if (Notification.permission === 'denied') return 'refuse';
  const reg = await swReady;
  if (!reg) return 'absent';
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
}
// Demande l'autorisation puis abonne cet appareil : 'on', 'refuse' (bloquées par le navigateur) ou 'off' (fenêtre du
// navigateur fermée sans choisir : rien n'est bloqué, on pourra redemander). Erreur levée si la plateforme n'est pas prête.
export async function activerPush(store) {
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'refuse';
  if (permission !== 'granted') return 'off';
  const key = await store.pushKey();
  if (!key) throw new Error('Les notifications ne sont pas encore prêtes sur la plateforme. Réessaie plus tard.');
  const reg = await swReady;
  // Le navigateur lui-même ne sait pas recevoir de notifications (pas de service de notifications) : « plateforme »
  let sub;
  try {
    if (!reg?.pushManager) throw new Error('pushManager absent');
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  } catch (e) { throw Object.assign(new Error(SANS_NOTIF), { plateforme: true, cause: e }); }
  // Pas enregistré par la plateforme (réseau) : l'abonnement du navigateur est retiré, sinon il paraîtrait actif
  try { await store.abonnerPush(sub); } catch (e) { await sub.unsubscribe().catch(() => {}); throw e; }
  return 'on';
}

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
  // Le bouton touché disparaît avec l'état qu'il change : le clavier continue sur le premier bouton du nouvel état
  const ici = useRef(null), garderFocus = useRef(false);
  useEffect(() => {
    if (!garderFocus.current) return;
    garderFocus.current = false;
    if (!ici.current?.contains(document.activeElement)) ici.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [st]);
  useEffect(() => {
    if (simule) return undefined;
    const lire = () => etatPush(store).then(setSt, () => setSt('absent'));
    lire();
    // Activées depuis une feuille pendant que Mon profil est ouvert : l'interrupteur suit
    addEventListener(PUSH_CHANGE, lire);
    return () => removeEventListener(PUSH_CHANGE, lire);
  }, []);
  // Simulé : rien n'est demandé au navigateur ni à la plateforme, le reste est le même
  const turnOn = async () => {
    setBusy(true); demandeEnCours = true;
    try {
      const r = simule ? 'on' : await activerPush(store);
      // Fenêtre du navigateur fermée sans choisir ('off') : la case reste à toucher, ce n'est pas une réponse
      setSt(r); etatConnu = r; if (r !== 'off') repondu();
      if (r === 'on') toast(simule ? DEMO : 'Notifications activées sur cet appareil.');
    } catch (e) { toast(e.message || String(e), 'err'); } finally { setBusy(false); demandeEnCours = false; }
  };
  const turnOff = async () => {
    setBusy(true); demandeEnCours = true;
    try {
      const sub = simule ? null : await (await swReady)?.pushManager.getSubscription();
      if (sub) { await store.desabonnerPush(sub.endpoint).catch(() => {}); await sub.unsubscribe(); }
      setSt('off'); etatConnu = 'off'; repondu(); toast('Notifications désactivées sur cet appareil.');
    } catch (e) { toast(e.message || String(e), 'err'); } finally { setBusy(false); demandeEnCours = false; }
  };
  const test = async () => { setBusy(true); try { const n = await store.testPush(); toast(n ? 'Notification de test envoyée.' : 'Aucun appareil abonné pour l’instant.'); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const note = {
    demo: 'Sur la vraie plateforme : candidature reçue, rendez-vous, réponse à ta question… arrivent directement sur ton téléphone.',
    absent: 'Ce navigateur ne permet pas les notifications. Essaie Chrome, Edge, Firefox ou Safari récent.',
    refuse: 'Les notifications sont bloquées pour ce site. Autorise-les dans les réglages du navigateur, puis reviens ici.',
  }[st];
  return html`<div class="push-etat" data-etat=${st} ref=${ici}>
    ${st === 'on' ? html`<p class="verify-ok push-ok" id="md-push-ok"><${Icon} name="check" size=${18}/> Activées sur cet appareil</p>
      <div class="push-acts">${simule ? null : html`<button type="button" class="btn small" id="md-push-test" disabled=${busy} onClick=${test}>Tester</button>`}
        <button type="button" class="btn small ghost" id="md-push-non" disabled=${busy} onClick=${() => { garderFocus.current = true; turnOff(); }}>Désactiver</button></div>`
    : st === 'off' ? html`<p class="small muted">${PUSH_POURQUOI}</p>
      <div class="push-acts"><button type="button" class="btn primary" id="md-push-oui" disabled=${busy} onClick=${() => { garderFocus.current = true; turnOn(); }}><${Icon} name="bell" size=${16}/> Activer</button></div>` : null}
    ${note ? html`<p class="small muted">${note}</p>` : null}
    ${st === 'refuse' ? html`<p class="small"><button type="button" class="linkish" id="md-push-debloquer" onClick=${() => setDebloquer(true)}>Comment les débloquer ?</button></p>` : null}
    ${st === 'ios' ? html`<p class="small muted">Sur iPhone, installe d’abord l’application sur l’écran d’accueil. <button class="linkish" onClick=${() => setHelp(true)}>Comment faire ?</button></p>` : null}
    ${help ? html`<${IosInstallHelp} onClose=${() => setHelp(false)}/>` : null}
    ${debloquer ? html`<${FeuilleDebloquer} ctx=${ctx} onClose=${() => setDebloquer(false)}/>` : null}
  </div>`;
}
const PUSH_POURQUOI = 'Messages, réponses, rendez-vous : ce qui te concerne arrive tout de suite, même quand l’application est fermée.';
addAR({
  [PUSH_POURQUOI]: 'الرسائل والأجوبة والمواعيد: ما يخصك يصلك فورًا، حتى والتطبيق مغلق.',
  'Activées sur cet appareil': 'مفعّلة على هذا الجهاز', 'Comment les débloquer ?': 'كيف ترفع الحظر عنها؟',
});

// ---------------------------------------------------------------------------
// « Me prévenir » : après une action qui attend une réponse (demande, mentorat, candidature, question…), une feuille
// propose une seule fois les notifications sur cet appareil, à la place du petit mot en bas de l'écran.
// Deux refus au plus, à 14 jours d'écart. Jamais par-dessus une fête : elle attend alors la prochaine visite.
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
// En démo, un test peut simuler l'état d'un vrai téléphone
function etatDemo(store) {
  if (store.mode === 'live') return null;
  try { const e = localStorage.getItem('ensam-prevenir-demo'); return ['off', 'ios', 'absent', 'refuse'].includes(e) ? e : null; } catch { return null; }
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
  const [ouv, setOuv] = useState(null);
  // La feuille d'ouverture à l'écran : le mémo d'avant son affichage (elle compte dès qu'elle s'affiche)
  const vue = useRef(null);
  hote = { me, store };
  useEffect(() => {
    // Une feuille « Me prévenir » ou une fête dans cette visite : pas de feuille d'ouverture en plus
    let demandee = false;
    // Une fête ouverte entre-temps : la feuille attend la prochaine visite
    const remettre = raison => { if (variante(raison, lireMemo(me.id))) ecrireMemo(me.id, { ...lireMemo(me.id), differe: raison }); };
    // La feuille d'ouverture rangée par une fête ou remplacée par « Me prévenir » : ce n'était pas une vraie présentation,
    // le compte d'avant revient (le reste du mémo, écrit entre-temps, est gardé)
    const rendre = () => {
      const v = vue.current; vue.current = null;
      if (!v) return;
      const { n, at, ...reste } = lireMemo(me.id);
      ecrireMemo(me.id, { ...reste, ...(v.n ? { n: v.n } : {}), ...(v.at ? { at: v.at } : {}) });
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
    // Rien de coché dans Mon profil : rien à proposer
    const ouvrable = () => {
      const m = hote?.me || me;
      return ouvertureNotif({ etat: etatConnu, memo: lireMemo(me.id), now: Date.now(), role: m.role, voulu: PUSH_CATEGORIES.some(c => c !== 'rappels' && pushChoix(c, m)) });
    };
    // Un écran calme : rien d'ouvert par-dessus (toute fenêtre modale, la photo agrandie d'un message comprise), pas en train
    // d'écrire, l'onglet au premier plan, pas de demande du navigateur en attente (lancée depuis Mon profil)
    const occupe = () => demandeEnCours || document.visibilityState !== 'visible' || !!document.querySelector('.modal-back:not(.sortie), .fete-back:not(.sortie), .menu-pop, [aria-modal="true"]') || ecrit(document.activeElement);
    const essayer = () => {
      // Quelque chose a déjà été demandé ou répondu pendant cette visite (mémo changé) : à la visite suivante
      if (!vivant || demandee || feteOuverte() || arriveeEnAttente(me.id) || JSON.stringify(lireMemo(me.id)) !== avant || !ouvrable()) return;
      // Une nouvelle version peut encore recharger la page : la feuille disparaîtrait sous les yeux du membre en comptant comme un refus
      const maj = attenteMaj();
      if (maj > 0) { t = setTimeout(essayer, maj); return; }
      if (occupe()) { if (Date.now() - debut < OUV_FIN) t = setTimeout(essayer, OUV_ESSAI); return; }
      // Comptée dès qu'elle s'affiche, comme « Plus tard » : quitter l'application sans répondre ne la ramène pas à chaque visite
      const m = lireMemo(me.id);
      vue.current = { n: m.n, at: m.at };
      ecrireMemo(me.id, { ...m, n: (m.n || 0) + 1, at: Date.now() });
      setOuv({ t: Date.now() });
    };
    // « Reçois l'essentiel sur ton téléphone », quelques secondes après le début de la visite
    // (l'état connu trop tard, téléphone lent à la première visite : à la visite suivante)
    const demarrer = depuis => {
      lancee = true; debut = depuis;
      if (!autreVisite && ouvrable() && Date.now() - debut < OUV_FIN) t = setTimeout(essayer, Math.max(0, OUV_DELAI - (Date.now() - debut), attenteMaj()));
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
        demandee = false; avant = JSON.stringify(lireMemo(me.id));
        autreVisite = (store.mode === 'live' && !(hote?.me || me).consent_at) || arriveeEnAttente(me.id);
        demarrer(Date.now());
      });
    };
    document.addEventListener('visibilitychange', vu);
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
    return () => { vivant = false; clearTimeout(t); montrer = null; sansFete(); vue.current = null; setOuv(null); document.removeEventListener('visibilitychange', vu); };
  }, [me.id]);
  if (f) return html`<${FeuillePrevenir} ctx=${ctx} f=${f} key=${f.t} onClose=${() => setF(null)}/>`;
  if (ouv) return html`<${FeuilleOuverture} ctx=${ctx} key=${ouv.t} onClose=${() => { vue.current = null; setOuv(null); }}/>`;
  return null;
}

// Le toucher sur « Me prévenir » ou « Activer » : c'est lui qui permet au navigateur de demander l'autorisation.
// true quand la feuille peut se fermer ; 'off' (fenêtre du navigateur fermée sans choisir) : elle se ferme comme
// « Plus tard », et la demande pourra revenir ; false (pas de réseau) : elle reste, on peut réessayer.
async function accepterNotif(store, me) {
  if (store.mode !== 'live') { ecrireMemo(me.id, { ...lireMemo(me.id), fait: 1 }); toast(DEMO); return true; }
  try {
    const r = await activerPush(store);
    etatConnu = r;
    dispatchEvent(new Event(PUSH_CHANGE));
    if (r === 'off') { toast(PAS_ACTIVEES); return 'off'; }
    ecrireMemo(me.id, { ...lireMemo(me.id), fait: 1 });
    if (r === 'on') toast('Notifications activées sur cet appareil.', 'win');
    return true;
  } catch (e) {
    // Navigateur sans service de notifications (Brave, téléphone sans services Google…) : une phrase calme, et la feuille
    // ne revient plus sur ce navigateur ; le bouton de « Mon profil » reste là pour réessayer
    if (e?.plateforme) {
      etatConnu = 'absent';
      ecrireMemo(me.id, { ...lireMemo(me.id), fait: 1 });
      toast(SANS_NOTIF, 'err');
      return true;
    }
    toast(e?.message || 'Pas de réseau pour l’instant. Réessaie dans un instant.', 'err');
    return false;
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
// l'appareil peut recevoir des notifications sans y être abonné (règle : ouvertureNotif). Quelques secondes après l'arrivée
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
};
const OUV_ICONES = { messages: 'chat', demandes: 'send', candidatures: 'briefcase', offres: 'feed', mentorat: 'mentor', reseau: 'qa' };
const OUV_INTRO = 'Ce qui te concerne arrive tout de suite, même quand l’application est fermée :';

function FeuilleOuverture({ ctx, onClose }) {
  const { store, me } = ctx;
  const [busy, setBusy] = useState(false);
  const mots = me.role === 'etudiant' ? OUV_POINTS.etudiant : me.en_recherche ? { ...OUV_POINTS.laureat, ...OUV_POINTS.recherche } : OUV_POINTS.laureat;
  const points = Object.entries(mots).filter(([cat]) => pushChoix(cat, me)).slice(0, 4);
  const activer = async () => { setBusy(true); if (await accepterNotif(store, me)) onClose(); else setBusy(false); };
  const pied = html`<button type="button" class="btn ghost" id="ouv-tard" onClick=${() => onClose()}>Plus tard</button>
    <button type="button" class="btn primary" id="ouv-oui" disabled=${busy} onClick=${activer}><${Icon} name="bell" size=${16}/> Activer</button>`;
  return html`<${Modal} title=${surTelephone() ? OUV_TITRE.tel : OUV_TITRE.pc} cls="prevenir ouverture" onClose=${onClose} footer=${pied}>
    <p>${OUV_INTRO}</p>
    ${points.length ? html`<ul class="ouv-points">${points.map(([cat, txt]) => html`<li key=${cat} data-cat=${cat}><span class="g-ico"><${Icon} name=${OUV_ICONES[cat]} size=${18}/></span> ${txt}</li>`)}</ul>` : null}
    <p class="small muted">Tu choisis quoi recevoir dans « Mon profil ». Pas de publicité.</p>
  <//>`;
}

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
// La pastille, en bas de l'écran : « Installer l'application » tant qu'elle ne l'est pas, puis « Activer les notifications »
// tant que cet appareil ne les reçoit pas (« Notifications bloquées » : comment les débloquer). Toujours là, sans rien
// couvrir : jamais pendant qu'on écrit ni dans les messages. × la range 3 jours (10 jours après trois fois).
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
  installer: ['Installer l’application', 'En un toucher, avec les notifications'],
  activer: ['Activer les notifications', 'Messages, offres, réponses : tout de suite'],
  debloquer: ['Notifications bloquées', 'Les débloquer en trois gestes'],
};
const PASTILLE_ICO = { installer: 'download', activer: 'bell', debloquer: 'lock' };
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
  const [aide, setAide] = useState(null); // ios | android | debloquer
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
  const voulu = PUSH_CATEGORIES.some(c => c !== 'rappels' && pushChoix(c, me));
  const sorte = install ? 'installer' : !voulu ? null : push === 'off' ? 'activer' : push === 'refuse' ? 'debloquer' : null;
  const agir = async () => {
    if (sorte === 'debloquer') { setAide('debloquer'); return; }
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
    : aide ? html`<${IosInstallHelp} android=${aide === 'android'} onClose=${fermerAide}/>` : null;
  if (!sorte || !pret || masque || cache || ecriture) return feuille;
  const [titre, sous] = PASTILLE[sorte];
  return html`<aside class="pastille" aria-label=${titre} data-sorte=${sorte}>
      <button type="button" class="pastille-go" id="pastille-go" disabled=${busy} onClick=${agir}>
        <span class="pastille-ico" aria-hidden="true"><${Icon} name=${PASTILLE_ICO[sorte]} size=${18}/></span>
        <span class="pastille-txt"><strong>${titre}</strong><span>${sous}</span></span>
      </button>
      <button type="button" class="pastille-x" id="pastille-x" aria-label="Masquer quelques jours" onClick=${masquer}><${Icon} name="x" size=${16}/></button>
    </aside>${feuille}`;
}

// Notifications bloquées par le navigateur : les gestes de cet appareil pour les rouvrir, puis « C'est fait »
const DEBLOQUER = {
  android: [['lock', 'Touche le cadenas à gauche de l’adresse du site.'], ['bell', 'Ouvre « Autorisations », puis « Notifications ».'], ['check', 'Choisis « Autoriser », puis reviens ici.']],
  appli: [['phone', 'Appuie longuement sur l’icône du Réseau ENSAM, puis sur « Infos sur l’appli ».'], ['bell', 'Ouvre « Notifications ».'], ['check', 'Active « Afficher les notifications », puis reviens ici.']],
  ios: [['phone', 'Ouvre les Réglages de l’iPhone, puis « Notifications ».'], ['bell', 'Choisis « Réseau ENSAM ».'], ['check', 'Active « Autoriser les notifications », puis reviens ici.']],
  pc: [['lock', 'Clique sur le cadenas à gauche de l’adresse du site.'], ['bell', 'À la ligne « Notifications », choisis « Autoriser ».'], ['check', 'Recharge la page, puis touche « C’est fait ».']],
};
const DEBLOQUER_INTRO = 'Ce navigateur a bloqué les notifications du Réseau ENSAM. Pour les recevoir :';
const TOUJOURS_BLOQUEES = 'Toujours bloquées. Suis les trois gestes, puis réessaie.';
function FeuilleDebloquer({ ctx, onClose }) {
  const { store, me } = ctx;
  const [busy, setBusy] = useState(false);
  const ou = isIOS() ? 'ios' : isAndroid() ? (isStandalone() ? 'appli' : 'android') : 'pc';
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
    <p>${DEBLOQUER_INTRO}</p>
    <ol class="ios-steps">${DEBLOQUER[ou].map(([ico, txt]) => html`<li key=${txt}><span class="g-ico"><${Icon} name=${ico} size=${18}/></span> ${txt}</li>`)}</ol>
  <//>`;
}

addAR({
  'Touche le menu ⋮ du navigateur, en haut à droite.': 'المس قائمة ⋮ في المتصفح، أعلى اليمين.',
  'Choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ».': 'اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».',
  'Ouvre le Réseau ENSAM depuis son icône : les notifications arrivent même quand il est fermé.': 'افتح شبكة ENSAM من أيقونتها: تصلك الإشعارات حتى وهو مغلق.',
  [POURQUOI_INSTALLER]: 'أيقونة على شاشتك الرئيسية، وإشعارات تصلك حتى والتطبيق مغلق.',
  [PASTILLE.installer[1]]: 'بلمسة واحدة، مع الإشعارات',
  [PASTILLE.activer[0]]: 'فعّل الإشعارات', [PASTILLE.activer[1]]: 'الرسائل والعروض والأجوبة: فورًا',
  [PASTILLE.debloquer[0]]: 'الإشعارات محظورة', [PASTILLE.debloquer[1]]: 'ارفع الحظر في ثلاث خطوات',
  'Masquer quelques jours': 'إخفاء لبضعة أيام',
  [DEMO_INSTALL]: 'على المنصة الحقيقية، يُثبَّت التطبيق هنا بلمسة واحدة.',
  'Débloquer les notifications': 'رفع الحظر عن الإشعارات', 'C’est fait': 'تمّ',
  [DEBLOQUER_INTRO]: 'حظر هذا المتصفح إشعارات شبكة ENSAM. لتصلك:',
  [TOUJOURS_BLOQUEES]: 'ما زالت محظورة. اتبع الخطوات الثلاث، ثم أعد المحاولة.',
  [DEBLOQUER.android[0][1]]: 'المس القفل على يسار عنوان الموقع.',
  [DEBLOQUER.android[1][1]]: 'افتح «الأذونات»، ثم «الإشعارات».',
  [DEBLOQUER.android[2][1]]: 'اختر «السماح»، ثم ارجع إلى هنا.',
  [DEBLOQUER.appli[0][1]]: 'اضغط مطوّلًا على أيقونة شبكة ENSAM، ثم على «معلومات التطبيق».',
  [DEBLOQUER.appli[1][1]]: 'افتح «الإشعارات».',
  [DEBLOQUER.appli[2][1]]: 'فعّل «إظهار الإشعارات»، ثم ارجع إلى هنا.',
  [DEBLOQUER.ios[0][1]]: 'افتح إعدادات iPhone، ثم «الإشعارات».',
  [DEBLOQUER.ios[1][1]]: 'اختر «شبكة ENSAM».',
  [DEBLOQUER.ios[2][1]]: 'فعّل «السماح بالإشعارات»، ثم ارجع إلى هنا.',
  [DEBLOQUER.pc[0][1]]: 'انقر على القفل على يسار عنوان الموقع.',
  [DEBLOQUER.pc[1][1]]: 'في سطر «الإشعارات»، اختر «السماح».',
  [DEBLOQUER.pc[2][1]]: 'أعد تحميل الصفحة، ثم المس «تمّ».',
});
