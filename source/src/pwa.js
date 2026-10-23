// Application installable (écran d'accueil du téléphone) et notifications sur le téléphone.
// Le service worker n'est enregistré que sur le vrai site (dist/), qui déclare un manifeste.
import { html, useState, useEffect } from './vendor/preact-htm.js';
import { Icon, Modal, toast, ensuite, feteOuverte, quandFete } from './ui.js';
import { addAR } from './i18n.js';
import { prevenirVariante, proposerActivation, NOTIF_CATEGORIES, notifActive } from './logic.js';

let installEvt = null;
const listeners = new Set();
const notify = () => listeners.forEach(f => f());
if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; notify(); });
  addEventListener('appinstalled', () => { installEvt = null; notify(); toast('Application installée.'); });
}

// Enregistré au premier moment calme : son installation (tout le site gardé sur le téléphone) ne passe pas
// devant les données du membre en 3G
const ouverture = Date.now();
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
    if (document.visibilityState === 'hidden' || Date.now() - debut < 8000) location.reload();
  });
}

const isStandalone = () => matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const hasManifest = () => !!document.querySelector('link[rel="manifest"]');

// Entrée du menu « Installer l'application » : visible quand l'installation est possible
export function useInstall() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set(x => x + 1); listeners.add(f); return () => listeners.delete(f); }, []);
  if (!hasManifest() || isStandalone()) return null;
  if (installEvt) return { prompt: async () => { const e = installEvt; installEvt = null; notify(); e.prompt(); await e.userChoice.catch(() => null); } };
  if (isIOS()) return { ios: true };
  return null;
}

const EtapesIos = () => html`<ol class="ios-steps">
    <li><span class="g-ico"><${Icon} name="share" size=${18}/></span> Dans Safari, touche le bouton Partager en bas de l’écran.</li>
    <li><span class="g-ico"><${Icon} name="plus" size=${18}/></span> Choisis « Sur l’écran d’accueil ».</li>
    <li><span class="g-ico"><${Icon} name="check" size=${18}/></span> Ouvre le Réseau ENSAM depuis son icône, puis active les notifications dans « Mon profil ».</li>
  </ol>`;
export function IosInstallHelp({ onClose }) {
  return html`<${Modal} title="Installer l’application" onClose=${onClose}><${EtapesIos}/><//>`;
}

function b64ToBytes(b64) {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

// Les notifications sur cet appareil : demo | absent | ios | refuse | off | on
export async function etatPush(store) {
  if (store.mode !== 'live') return 'demo';
  if (!('Notification' in window) || !('PushManager' in window) || !hasManifest()) return isIOS() && !isStandalone() ? 'ios' : 'absent';
  if (Notification.permission === 'denied') return 'refuse';
  const reg = await swReady;
  if (!reg) return 'absent';
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
}
// Demande l'autorisation puis abonne cet appareil : 'on' ou 'refuse' (erreur levée si la plateforme n'est pas prête)
export async function activerPush(store) {
  if ((await Notification.requestPermission()) !== 'granted') return 'refuse';
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

// Interrupteur « Notifications sur ce téléphone », dans Mon profil
export function PushToggle({ ctx }) {
  const { store } = ctx;
  const [st, setSt] = useState('…'); // … | absent | demo | ios | refuse | off | on
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => { etatPush(store).then(setSt, () => setSt('absent')); }, []);
  const turnOn = async () => {
    setBusy(true);
    try {
      const r = await activerPush(store);
      setSt(r); etatConnu = r;
      if (r === 'on') toast('Notifications activées sur cet appareil.');
    } catch (e) { toast(e.message || String(e), 'err'); } finally { setBusy(false); }
  };
  const turnOff = async () => {
    setBusy(true);
    try {
      const sub = await (await swReady)?.pushManager.getSubscription();
      if (sub) { await store.desabonnerPush(sub.endpoint).catch(() => {}); await sub.unsubscribe(); }
      setSt('off'); etatConnu = 'off'; toast('Notifications désactivées sur cet appareil.');
    } catch (e) { toast(e.message || String(e), 'err'); } finally { setBusy(false); }
  };
  const test = async () => { setBusy(true); try { const n = await store.testPush(); toast(n ? 'Notification de test envoyée.' : 'Aucun appareil abonné pour l’instant.'); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const note = {
    demo: 'Sur la vraie plateforme : candidature reçue, rendez-vous, réponse à ta question… arrivent directement sur ton téléphone.',
    absent: 'Ce navigateur ne permet pas les notifications. Essaie Chrome, Edge, Firefox ou Safari récent.',
    refuse: 'Les notifications sont bloquées pour ce site. Autorise-les dans les réglages du navigateur, puis reviens ici.',
  }[st];
  return html`<div class="push-row">
    <label class="check"><input id="md-push" type="checkbox" checked=${st === 'on'} disabled=${busy || !['on', 'off'].includes(st)} onChange=${e => (e.target.checked ? turnOn() : turnOff())}/> Notifications sur ce téléphone ou cet ordinateur</label>
    ${st === 'on' ? html`<button class="btn tiny ghost" disabled=${busy} onClick=${test}>Tester</button>` : null}
    ${note ? html`<p class="small muted">${note}</p>` : null}
    ${st === 'ios' ? html`<p class="small muted">Sur iPhone, installe d’abord l’application sur l’écran d’accueil. <button class="linkish" onClick=${() => setHelp(true)}>Comment faire ?</button></p>` : null}
    ${help ? html`<${IosInstallHelp} onClose=${() => setHelp(false)}/>` : null}
  </div>`;
}

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
  try { const e = localStorage.getItem('ensam-prevenir-demo'); return ['off', 'ios', 'absent'].includes(e) ? e : null; } catch { return null; }
}
// Application ouverte depuis l'écran d'accueil (en démo, un test peut le simuler)
function installee(store) {
  if (store.mode !== 'live') { try { return localStorage.getItem('ensam-installee-demo') === '1'; } catch { return false; } }
  return isStandalone();
}
function variante(raison, memo) {
  const me = hote?.me;
  if (!me) return null;
  return prevenirVariante({ etat: etatConnu, raison, memo, now: Date.now(), role: me.role,
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
  hote = { me, store };
  useEffect(() => {
    // Une fête ouverte entre-temps : la feuille attend la prochaine visite
    const remettre = raison => { if (variante(raison, lireMemo(me.id))) ecrireMemo(me.id, { ...lireMemo(me.id), differe: raison }); };
    montrer = x => { if (feteOuverte()) { remettre(x.raison); return; } if (x.v === 'email') ecrireMemo(me.id, { ...lireMemo(me.id), mail: 1 }); setF(x); };
    // Une fête qui s'ouvre après la feuille passe devant : la feuille se range sans compter de refus
    const sansFete = quandFete(() => setF(x => { if (x) remettre(x.raison); return null; }));
    let vivant = true;
    const lire = () => { const d = etatDemo(store); if (d) { etatConnu = d; return Promise.resolve(); } return etatPush(store).then(e => { if (vivant) etatConnu = e; }, () => {}); };
    const vu = () => { if (document.visibilityState === 'visible') lire(); };
    document.addEventListener('visibilitychange', vu);
    // Une feuille remise à plus tard (une fête était à l'écran) : à la visite suivante, quand rien d'autre n'est ouvert
    let t = 0;
    const differe = lireMemo(me.id).differe;
    lire().then(() => {
      if (!vivant) return;
      // Application installée sans notifications sur cet appareil : on les propose à l'ouverture
      if (!differe) {
        if (!proposerActivation({ etat: etatConnu, installee: installee(store), memo: lireMemo(me.id) })) return;
        t = setTimeout(() => {
          if (bloque || document.querySelector('.modal-back, .fete-back')) return;
          montrer?.({ raison: 'installe', mot: null, v: 'push', t: Date.now() });
        }, 3000);
        return;
      }
      t = setTimeout(() => {
        const memo = lireMemo(me.id); delete memo.differe; ecrireMemo(me.id, memo);
        if (bloque || document.querySelector('.modal-back, .fete-back')) return;
        const v = variante(differe, memo);
        if (v) montrer({ raison: differe, mot: null, v, t: Date.now() });
      }, 2500);
    });
    return () => { vivant = false; clearTimeout(t); montrer = null; sansFete(); document.removeEventListener('visibilitychange', vu); };
  }, [me.id]);
  if (!f) return null;
  return html`<${FeuillePrevenir} ctx=${ctx} f=${f} key=${f.t} onClose=${() => setF(null)}/>`;
}

function FeuillePrevenir({ ctx, f, onClose }) {
  const { store, me } = ctx;
  const [busy, setBusy] = useState(false);
  const email = f.v === 'email', ios = f.v === 'ios', app = f.raison === 'installe';
  // Fermer sans accepter (Plus tard, ×, Retour, toucher à côté) compte comme un refus ; la variante email est déjà notée.
  // À l'ouverture de l'application, le refus a son propre compte (il ne retire pas « Me prévenir » après une action).
  const refuser = () => {
    const m = lireMemo(me.id);
    if (app) ecrireMemo(me.id, { ...m, app: { n: (m.app?.n || 0) + 1, at: Date.now() } });
    else if (!email) ecrireMemo(me.id, { ...m, n: (m.n || 0) + 1, at: Date.now() });
    onClose();
  };
  const accepter = async () => {
    if (email || ios) return refuser();
    if (store.mode !== 'live') { ecrireMemo(me.id, { ...lireMemo(me.id), fait: 1 }); toast(DEMO); onClose(); return; }
    setBusy(true);
    try {
      const r = await activerPush(store);
      etatConnu = r;
      ecrireMemo(me.id, { ...lireMemo(me.id), fait: 1 });
      if (r === 'on') toast('Notifications activées sur cet appareil.', 'win');
      onClose();
    } catch (e) {
      // Navigateur sans service de notifications (Brave, téléphone sans services Google…) : une phrase calme, et la feuille
      // ne revient plus sur ce navigateur ; le bouton de « Mon profil » reste là pour réessayer
      if (e?.plateforme) {
        etatConnu = 'absent';
        ecrireMemo(me.id, { ...lireMemo(me.id), fait: 1 });
        toast(SANS_NOTIF, 'err'); onClose();
      } else { setBusy(false); toast(e?.message || 'Pas de réseau pour l’instant. Réessaie dans un instant.', 'err'); } // réseau : la feuille reste, on peut réessayer
    }
  };
  const raison = f.raison === 'question' && me.role !== 'etudiant' ? 'questionMembre' : f.raison;
  const pied = html`${email || ios ? null : html`<button type="button" class="btn ghost" id="pv-tard" onClick=${refuser}>Plus tard</button>`}
    <button type="button" class="btn primary" id="pv-oui" disabled=${busy} onClick=${accepter}>${email || ios ? 'J’ai compris' : html`<${Icon} name="bell" size=${16}/> ${app ? 'Activer' : 'Me prévenir'}`}</button>`;
  return html`<${Modal} title=${app ? 'Active les notifications' : email ? 'Tu ne rateras pas la réponse' : 'Te prévenir de la réponse ?'} cls="prevenir" onClose=${refuser} footer=${pied}>
    ${f.mot ? html`<p class="verify-ok"><${Icon} name="check" size=${16}/> ${f.mot}</p>` : null}
    ${app ? html`<p>${me.role === 'etudiant' ? APP_ETUDIANT : APP_LAUREAT}</p><p class="small muted">Tu choisis lesquelles dans « Mon profil » › Notifications.</p>`
      : email ? html`<p>${PAR_EMAIL[f.raison]}</p>` : html`<p>${NOTIF_RAISON[raison]}</p>`}
    ${ios ? html`<p class="small muted">Sur iPhone, les notifications arrivent une fois le Réseau ENSAM ajouté à l’écran d’accueil :</p><${EtapesIos}/>`
      : email ? null : html`<p class="small muted">Rien d’autre : pas de publicité, et tu l’arrêtes quand tu veux dans « Mon profil ».</p>`}
  <//>`;
}

const APP_ETUDIANT = 'Tes messages, les propositions des lauréats à tes demandes, tes rendez-vous de mentorat et les nouvelles offres de ta filière arrivent directement sur ce téléphone.';
const APP_LAUREAT = 'Tes messages, les candidatures à tes offres, les demandes d’étudiants qui te concernent et tes rendez-vous de mentorat arrivent directement sur ce téléphone.';

// ---------------------------------------------------------------------------
// Mon profil › Notifications : ce qui arrive sur le téléphone, par catégorie (le même choix sur tous les appareils)
// ---------------------------------------------------------------------------
const LIBELLES_NOTIF = {
  etudiant: { messages: 'Messages', demandes: 'Propositions et réponses à mes demandes', mentorat: 'Mentorat et rendez-vous', candidatures: 'Mes candidatures',
    offres: 'Nouvelles offres pour moi', questions: 'Réponses à mes questions', reseau: 'Mon réseau : contacts, mercis, parrainage, relecture de CV' },
  laureat: { messages: 'Messages', demandes: 'Demandes d’étudiants qui me concernent', mentorat: 'Mentorat et rendez-vous', candidatures: 'Candidatures à mes offres',
    offres: 'Offres pour jeunes diplômés', questions: 'Questions qui me sont adressées', reseau: 'Mon réseau : contacts, mercis, parrainage, relecture de CV' },
};
export function ChoixNotifs({ ctx }) {
  const { me, store, act } = ctx;
  if (!me || (store.mode === 'live' && !('notif_prefs' in me))) return null;  // base pas encore à jour
  const libelles = LIBELLES_NOTIF[me.role === 'etudiant' ? 'etudiant' : 'laureat'];
  const changer = (cat, oui) => act(async () => {
    const push = { ...(me.notif_prefs?.push || {}), [cat]: oui };
    await store.update('profiles', me.id, { notif_prefs: { ...(me.notif_prefs || {}), push } });
  });
  return html`<fieldset class="choix-notifs" id="md-notifs"><legend class="small strong">Sur le téléphone, me prévenir pour :</legend>
    ${NOTIF_CATEGORIES.map(cat => html`<label class="check sub" key=${cat}><input type="checkbox" id=${'md-notif-' + cat} checked=${notifActive(me, cat)} onChange=${e => changer(cat, e.target.checked)}/> ${libelles[cat]}</label>`)}
    <p class="small muted">Le même choix vaut pour tous tes appareils. Les emails se règlent juste au-dessus.</p>
  </fieldset>`;
}

const SANS_NOTIF = 'Ce navigateur ne peut pas recevoir de notifications pour l’instant.';
addAR({
  'Active les notifications': 'فعّل الإشعارات', 'Activer': 'تفعيل', 'Tu choisis lesquelles dans « Mon profil » › Notifications.': 'تختار أيّها من «ملفي» › الإشعارات.',
  [APP_ETUDIANT]: 'رسائلك، واقتراحات الخريجين على طلباتك، ومواعيد المرافقة، والعروض الجديدة في شعبتك تصلك مباشرة على هذا الهاتف.',
  [APP_LAUREAT]: 'رسائلك، والترشيحات على عروضك، وطلبات الطلبة التي تخصك، ومواعيد المرافقة تصلك مباشرة على هذا الهاتف.',
  'Sur le téléphone, me prévenir pour :': 'على الهاتف، نبّهني عند:', 'Le même choix vaut pour tous tes appareils. Les emails se règlent juste au-dessus.': 'هذا الاختيار يسري على كل أجهزتك. إعدادات البريد الإلكتروني أعلاه.',
  'Propositions et réponses à mes demandes': 'الاقتراحات والردود على طلباتي', 'Mentorat et rendez-vous': 'المرافقة والمواعيد', 'Mes candidatures': 'ترشيحاتي',
  'Nouvelles offres pour moi': 'عروض جديدة تناسبني', 'Réponses à mes questions': 'الأجوبة على أسئلتي', 'Mon réseau : contacts, mercis, parrainage, relecture de CV': 'شبكتي: الاتصالات، الشكر، العرّاب، مراجعة السيرة الذاتية',
  'Demandes d’étudiants qui me concernent': 'طلبات الطلبة التي تخصني', 'Candidatures à mes offres': 'الترشيحات على عروضي', 'Offres pour jeunes diplômés': 'عروض للخريجين الجدد', 'Questions qui me sont adressées': 'الأسئلة الموجهة إلي',
  [SANS_NOTIF]: 'لا يستطيع هذا المتصفح استقبال الإشعارات حاليًا.',
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
});
