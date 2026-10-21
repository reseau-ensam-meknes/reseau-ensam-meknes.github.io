// Application installable (écran d'accueil du téléphone) et notifications sur le téléphone.
// Le service worker n'est enregistré que sur le vrai site (dist/), qui déclare un manifeste.
import { html, useState, useEffect } from './vendor/preact-htm.js';
import { Icon, Modal, toast } from './ui.js';

let installEvt = null;
const listeners = new Set();
const notify = () => listeners.forEach(f => f());
if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; notify(); });
  addEventListener('appinstalled', () => { installEvt = null; notify(); toast('Application installée.'); });
}

export const swReady = (() => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !document.querySelector('link[rel="manifest"]')) return Promise.resolve(null);
  return navigator.serviceWorker.register('sw.js').then(reg => { suivreMisesAJour(reg); return navigator.serviceWorker.ready; }).catch(() => null);
})();

// Nouvelle version du site : le téléphone la télécharge en arrière-plan, puis elle prend la main
// quand la page est cachée (ou tout de suite si la page vient de s'ouvrir), et la page se recharge
// sans que personne ne le voie. Jamais au milieu de ce que le membre est en train de faire.
function suivreMisesAJour(reg) {
  const debut = Date.now();
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

export function IosInstallHelp({ onClose }) {
  return html`<${Modal} title="Installer l’application" onClose=${onClose}>
    <ol class="ios-steps">
      <li><span class="g-ico"><${Icon} name="share" size=${18}/></span> Dans Safari, touche le bouton Partager en bas de l’écran.</li>
      <li><span class="g-ico"><${Icon} name="plus" size=${18}/></span> Choisis « Sur l’écran d’accueil ».</li>
      <li><span class="g-ico"><${Icon} name="check" size=${18}/></span> Ouvre le Réseau ENSAM depuis son icône, puis active les notifications dans « Mon profil ».</li>
    </ol>
  <//>`;
}

function b64ToBytes(b64) {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

// Interrupteur « Notifications sur ce téléphone », dans Mon profil
export function PushToggle({ ctx }) {
  const { store } = ctx;
  const [st, setSt] = useState('…'); // … | absent | demo | ios | refuse | off | on
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const check = async () => {
    if (store.mode !== 'live') return setSt('demo');
    if (!('Notification' in window) || !('PushManager' in window) || !hasManifest()) return setSt(isIOS() && !isStandalone() ? 'ios' : 'absent');
    if (Notification.permission === 'denied') return setSt('refuse');
    const reg = await swReady;
    if (!reg) return setSt('absent');
    setSt((await reg.pushManager.getSubscription()) ? 'on' : 'off');
  };
  useEffect(() => { check(); }, []);
  const turnOn = async () => {
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== 'granted') { setSt('refuse'); return; }
      const key = await store.pushKey();
      if (!key) throw new Error('Les notifications ne sont pas encore prêtes sur la plateforme. Réessaie plus tard.');
      const reg = await swReady;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
      await store.abonnerPush(sub);
      setSt('on'); toast('Notifications activées sur cet appareil.');
    } catch (e) { toast(e.message || String(e), 'err'); } finally { setBusy(false); }
  };
  const turnOff = async () => {
    setBusy(true);
    try {
      const sub = await (await swReady)?.pushManager.getSubscription();
      if (sub) { await store.desabonnerPush(sub.endpoint).catch(() => {}); await sub.unsubscribe(); }
      setSt('off'); toast('Notifications désactivées sur cet appareil.');
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
