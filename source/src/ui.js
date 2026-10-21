// Composants partagés de l'interface.
import { html, useState, useEffect, useRef, useMemo } from './vendor/preact-htm.js';
import { initials, levelOf, NIVEAUX, niveauOf, seasonOf } from './logic.js';
import { sceneMarkup } from './scene.js';
import { glyph, TUILE_DEFS, TUILE } from './logo.js';

export { html };

const HUES = [352, 18, 38, 145, 172, 200, 222, 262, 290, 320];
export function hueOf(id = '') { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return HUES[h % HUES.length]; }

export function Avatar({ p, size = 36 }) {
  const hue = hueOf(p?.id);
  return html`<span class="avatar" style=${`--h:${hue};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px`} aria-hidden="true">${initials(p?.full_name)}</span>`;
}

export function Icon({ name, size = 18 }) {
  const P = ICONS[name] || '';
  return html`<svg class=${`ico ico-${name}`} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: P }}></svg>`;
}

const ICONS = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  feed: '<rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/>',
  route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  mentor: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3 3 0 0 1 0 6M18 14c2 .8 3 2.8 3 6"/>',
  qa: '<path d="M4 5h11v8H8l-4 3z"/><path d="M15 9h5v8l-3-2h-6v-2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  people: '<circle cx="8" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M2.5 20c.5-3 2.8-5 5.5-5s5 2 5.5 5M14 15.5c2.6-.6 6 .6 6.5 4.5"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  thumb: '<path d="M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.2 2.6L12.6 10H19a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7"/>',
  comment: '<path d="M4 5h16v11H9l-5 4z"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  send: '<path d="M4 12l16-8-6 17-3-7z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4.5a3.5 3.5 0 0 0 4 4M16 6h3.5a3.5 3.5 0 0 1-4 4M12 13v4M8 21h8M9 17h6v4H9z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5"/><path d="M14.5 6.5 17 4l3 3-2.5 2.5"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v6"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  network: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M10.8 7.2 6.3 15.8M13.2 7.2l4.5 8.6M7.5 18h9"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M12 6.5l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 8.6l2-.3z"/><path d="M8.6 13.9 7 21l5-2.6 5 2.6-1.6-7.1"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  clap: '<path d="M3.5 20.5 8 8l8 8z"/><path d="M6.2 13l4.8 4.8M14 3.5l.6 2.2M20.5 10l-2.2-.6M18.5 4.5 16 7M12 2.5c.8 1.5.6 3-.5 4M21.5 12c-1.5-.8-3-.6-4 .5"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  chat: '<path d="M20.5 11.5a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1.4-4.4A8.5 8.5 0 1 1 20.5 11.5z"/><path d="M8.5 10h7M8.5 13.5h4.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  play: '<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  block: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  checks: '<path d="M2.5 12.5 7 17l9.5-9.5"/><path d="M12.5 16.5l.5.5 9-9"/>',
};

// Fenêtres ouvertes, la plus récente à la fin : seule celle du dessus réagit au clavier
const ouvertes = [];
const FOCUSABLES = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
// Sur téléphone, chaque fenêtre arrive par le bas comme une feuille (voir le CSS). « footer » reste collé
// en bas, à portée du pouce : c'est là que va l'action principale.
export function Modal({ title, onClose, children, wide, footer }) {
  const ref = useRef();
  const fermer = useRef(onClose);
  fermer.current = onClose;
  useEffect(() => {
    const avant = document.activeElement;
    const moi = {};
    ouvertes.push(moi);
    const k = e => {
      if (ouvertes[ouvertes.length - 1] !== moi || !ref.current) return;
      if (e.key === 'Escape') { fermer.current(); return; }
      if (e.key !== 'Tab') return;
      // Tab et Maj+Tab tournent dans la fenêtre au lieu de repartir dans la page derrière
      const f = [...ref.current.querySelectorAll(FOCUSABLES)].filter(x => x.getClientRects().length);
      if (!f.length) return;
      const ici = document.activeElement, dedans = ref.current.contains(ici);
      if (e.shiftKey && (!dedans || ici === f[0])) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (!dedans || ici === f[f.length - 1])) { e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener('keydown', k);
    ref.current?.querySelector('input,textarea,select,button')?.focus();
    return () => {
      document.removeEventListener('keydown', k);
      ouvertes.splice(ouvertes.indexOf(moi), 1);
      // On rend le focus au bouton qui avait ouvert la fenêtre, s'il est toujours là
      if (avant?.isConnected) avant.focus?.();
    };
  }, []);
  return html`<div class="modal-back" onClick=${e => { if (e.target === e.currentTarget) onClose(); }}>
    <div class=${'modal' + (wide ? ' wide' : '') + (footer ? ' has-foot' : '')} role="dialog" aria-modal="true" aria-label=${title} ref=${ref}>
      <header class="modal-head"><span class="sheet-grip" aria-hidden="true"></span><h2>${title}</h2><button class="icon-btn" onClick=${onClose} aria-label="Fermer"><${Icon} name="x"/></button></header>
      <div class="modal-body">${children}</div>
      ${footer ? html`<footer class="modal-foot">${footer}</footer>` : null}
    </div>
  </div>`;
}

let toastSet = null;
export function toast(msg, kind = 'ok') { toastSet?.({ msg, kind, t: Date.now() }); }
export function Toaster() {
  const [t, setT] = useState(null);
  toastSet = setT;
  useEffect(() => { if (!t) return; const h = setTimeout(() => setT(null), 3800); return () => clearTimeout(h); }, [t]);
  // La zone reste toujours là (vide entre deux messages) pour que les lecteurs d'écran annoncent chaque message
  return html`<div class="toast-zone" role="status" aria-live="polite">${t ? html`<div class=${'toast ' + t.kind} key=${t.t}>${t.msg}</div>` : null}</div>`;
}

export function Field({ label, hint, children }) {
  return html`<label class="field"><span class="field-label">${label}</span>${children}${hint ? html`<span class="field-hint">${hint}</span>` : null}</label>`;
}

// Écran vide : une phrase chaleureuse et, si possible, une seule action pour avancer.
// action = { label, onClick, icon }
export function Empty({ icon = 'spark', title, children, action }) {
  return html`<div class="empty"><span class="empty-ico"><${Icon} name=${icon} size=${26}/></span><strong>${title}</strong><div>${children}</div>
    ${action ? html`<button type="button" class="btn primary small empty-act" onClick=${action.onClick}>${action.icon ? html`<${Icon} name=${action.icon} size=${15}/> ` : null}${action.label}</button>` : null}</div>`;
}

// ---------------------------------------------------------------------------
// Les grands moments : première candidature, rendez-vous fixé, recrutement confirmé, premier merci…
// Une seule fois chacun (cle), avec une phrase chaleureuse et une seule prochaine étape.
// ---------------------------------------------------------------------------
let feteSet = null;
export function celebrate({ cle, titre, texte, action, icon = 'trophy' }) {
  if (cle) { try { if (localStorage.getItem('fete-' + cle)) return false; localStorage.setItem('fete-' + cle, '1'); } catch { /* pas de stockage : on fête quand même */ } }
  if (!feteSet) return false;
  feteSet({ titre, texte, action, icon, t: Date.now() });
  return true;
}
export function Celebration() {
  const [f, setF] = useState(null);
  feteSet = setF;
  // On quitte l'écran (bouton retour) : la fête ne suit pas sur la page suivante
  useEffect(() => {
    if (!f) return;
    const k = () => { if (Date.now() - f.t > 800) setF(null); };
    window.addEventListener('hashchange', k);
    return () => window.removeEventListener('hashchange', k);
  }, [f]);
  return f ? html`<${Fete} f=${f} key=${f.t} onClose=${() => setF(null)}/>` : null;
}
const COULEURS_FETE = ['var(--em-o)', 'var(--em-b)', 'var(--orange)', 'var(--accent)', 'var(--good)', '#FFD166'];
function Fete({ f, onClose }) {
  const ref = useRef();
  const morceaux = useMemo(() => Array.from({ length: 34 }, (_, i) => ({ x: Math.round(Math.random() * 100), dx: Math.round(Math.random() * 120 - 60), d: (1.1 + Math.random() * .9).toFixed(2), w: (Math.random() * .35).toFixed(2), r: Math.round(Math.random() * 720 - 360), c: COULEURS_FETE[i % COULEURS_FETE.length], rond: i % 3 === 0 })), []);
  useEffect(() => {
    const avant = document.activeElement;
    ref.current?.querySelector('button')?.focus();
    const k = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('keydown', k); if (avant?.isConnected) avant.focus?.(); };
  }, []);
  return html`<div class="fete-back" onClick=${e => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="fete-pluie" aria-hidden="true">${morceaux.map(m => html`<i class=${m.rond ? 'rond' : ''} style=${`--x:${m.x}%;--dx:${m.dx}px;--d:${m.d}s;--w:${m.w}s;--r:${m.r}deg;--c:${m.c}`}></i>`)}</div>
    <div class="fete" role="dialog" aria-modal="true" aria-labelledby="fete-titre" ref=${ref}>
      <span class="fete-ico"><${Icon} name=${f.icon} size=${34}/></span>
      <h2 id="fete-titre">${f.titre}</h2>
      ${f.texte ? html`<p>${f.texte}</p>` : null}
      <div class="fete-acts">
        ${f.action ? html`<button type="button" class="btn primary" onClick=${() => { onClose(); f.action.onClick(); }}>${f.action.icon ? html`<${Icon} name=${f.action.icon} size=${16}/> ` : null}${f.action.label}</button>` : null}
        <button type="button" class=${'btn ' + (f.action ? 'ghost' : 'primary')} onClick=${onClose}>${f.action ? 'Plus tard' : 'Merci !'}</button>
      </div>
    </div>
  </div>`;
}

// Bouton qui attend la fin de son action : il se grise et montre un petit cercle, ce qui évite le double clic
export function useBusy() {
  const [busy, setBusy] = useState(false);
  const run = fn => async (...a) => { if (busy) return; setBusy(true); try { await fn(...a); } finally { setBusy(false); } };
  return [busy, run];
}

export function LevelChip({ points }) {
  const l = levelOf(points || 0);
  return html`<span class=${'lvl lvl-' + l.idx} title=${`${points || 0} points d’impact`}>${l.nom}</span>`;
}

let rangsVisibles = true;
export function voirRangs(v) { rangsVisibles = v; }

export function RoleLine({ p, score }) {
  if (!p) return null;
  const saison = seasonOf();
  const n = niveauOf(p, saison);
  const parts = [];
  if (p.role === 'etudiant') parts.push(`${NIVEAUX[n]?.short || ''} · ${p.filiere}`);
  else if (p.role === 'admin') parts.push(p.poste || 'Administration');
  else parts.push(`Promo ${p.promo}${p.entreprise ? ' · ' + p.entreprise : ''}`);
  return html`<span class="role-line">${parts.join(' ')}
    ${p.role === 'laureat' && p.verified ? html`<span class="verif" title="Lauréat vérifié par l’école"><${Icon} name="shield" size=${13}/></span>` : null}
    ${p.role === 'laureat' && score && rangsVisibles ? html` <${LevelChip} points=${score.points}/>` : null}
    ${p.role === 'laureat' && score && !rangsVisibles && aides(score) ? html` <span class="mini aide-chip"><${Icon} name="heart" size=${11}/> ${aides(score) > 1 ? `A aidé ${aides(score)} étudiants` : 'A aidé 1 étudiant'}</span>` : null}</span>`;
}

const aides = s => (s?.recrutes || 0) + (s?.mentorats || 0);

export function Person({ p, score, onOpen, size = 36, sub }) {
  return html`<button class="person" onClick=${() => onOpen?.(p)} type="button">
    <${Avatar} p=${p} size=${size}/>
    <span class="person-txt">${p?.full_name ? html`<span class="person-name" translate="no" dir="auto">${p.full_name}</span>` : html`<span class="person-name">Membre</span>`}${sub !== undefined ? html`<span class="role-line">${sub}</span>` : html`<${RoleLine} p=${p} score=${score}/>`}</span>
  </button>`;
}

export function Bar({ value, pace, label }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return html`<div class="bar" role="img" aria-label=${label || `${Math.round(v * 100)} %`}>
    <span class="bar-fill" style=${`width:${v * 100}%`}></span>
    ${pace !== undefined ? html`<span class="bar-pace" style=${`inset-inline-start:${Math.max(0, Math.min(1, pace)) * 100}%`} title="Rythme attendu à cette date"></span>` : null}
  </div>`;
}

export function Tabs({ tabs, value, onChange }) {
  return html`<div class="tabs" role="tablist">${tabs.map(([k, l, c]) => html`<button role="tab" aria-selected=${value === k} class=${'tab' + (value === k ? ' on' : '')} onClick=${() => onChange(k)}>${l}${c ? html` <span class="count">${c}</span>` : null}</button>`)}</div>`;
}

export function Confirm({ text, onYes, onClose, yes = 'Confirmer' }) {
  return html`<${Modal} title="Confirmation" onClose=${onClose}><p>${text}</p><div class="row-end"><button class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn danger" onClick=${() => { onYes(); onClose(); }}>${yes}</button></div><//>`;
}

export function useLocal(key, init) {
  const [v, setV] = useState(() => { try { const x = localStorage.getItem(key); return x == null ? init : JSON.parse(x); } catch { return init; } });
  const set = x => { setV(x); try { localStorage.setItem(key, JSON.stringify(x)); } catch { /* pas de stockage */ } };
  return [v, set];
}

// Logo de la plateforme : la tuile bleu nuit avec la roue et la toque (voir logo.js). « draw » l'anime à l'arrivée.
// Chaque logo a son propre dégradé : avec un id partagé, la tuile disparaît quand le premier logo
// de la page est caché (le menu de gauche sur téléphone).
const LOGO_SVG = `${TUILE_DEFS}${TUILE}<g class="lg-glyph">${glyph()}</g>`;
let logoN = 0;
export function BrandLogo({ size = 38, draw = false }) {
  const [svg] = useState(() => LOGO_SVG.replaceAll('lg-tuile', `lg-tuile-${++logoN}`));
  return html`<svg class=${'brand-logo' + (draw ? ' draw' : '')} width=${size} height=${size} viewBox="0 0 512 512" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: svg }}></svg>`;
}

// L'entrée de l'école dessinée. La porte s'ouvre une seule fois par visite ; les animations
// s'arrêtent quand l'image sort de l'écran.
let gateOpened = false;
export function SchoolScene({ align = 'xMidYMax', fit = 'meet' }) {
  const ref = useRef();
  const [opening] = useState(() => { const o = !gateOpened; gateOpened = true; return o; });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => el.toggleAttribute('data-paused', !e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return html`<div ref=${ref} class=${'scene' + (opening ? ' opening' : '')} aria-hidden="true" dangerouslySetInnerHTML=${{ __html: sceneMarkup(align, fit) }}></div>`;
}

// Nombre qui monte jusqu'à sa valeur à l'affichage
export function Num({ v }) {
  const n = Number(v) || 0;
  const ref = useRef();
  useEffect(() => {
    const t = ref.current?.firstChild;
    if (!t || n <= 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf, t0;
    const step = now => { t0 ??= now; const k = Math.min(1, (now - t0) / 900); t.data = String(Math.round(n * (1 - (1 - k) ** 3))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); t.data = String(n); };
  }, [n]);
  return html`<span ref=${ref}>${String(n)}</span>`;
}

// « Logo » d'entreprise : monogramme coloré, stable pour un même nom
export function CompanyLogo({ name = '', size = 44 }) {
  const words = name.replace(/\(.*?\)/g, '').split(/[\s\-–&]+/).filter(w => w && !/^(de|du|la|le|des|group|groupe|maroc|morocco|corporation|operations)$/i.test(w));
  const ini = (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] || name).slice(0, 2)).toUpperCase();
  return html`<span class="clogo" style=${`--h:${hueOf(name)};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.36)}px`} aria-hidden="true">${ini}</span>`;
}

export const TYPE_ICON = { stage: 'wrench', pfe: 'cap', etranger: 'globe', emploi: 'briefcase' };

// Styles propres à un module : ajoutés une seule fois dans la page, au premier rendu
const styled = new Set();
export function injectCSS(id, css) {
  if (styled.has(id) || typeof document === 'undefined') return;
  styled.add(id);
  const s = document.createElement('style'); s.dataset.module = id; s.textContent = css; document.head.appendChild(s);
}
