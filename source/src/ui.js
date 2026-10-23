// Composants partagés de l'interface.
import { html, useState, useEffect, useLayoutEffect, useRef, useMemo } from './vendor/preact-htm.js';
import { initials, levelOf, NIVEAUX, niveauOf, seasonOf, PARCOURS, FILIERES_INFO, timeAgo } from './logic.js';
import { Icon, Field, BrandLogo, SchoolScene, TYPE_ICON, ajouterIcones } from './entree.js';

export { html, Icon, Field, BrandLogo, SchoolScene, TYPE_ICON };

// Les icônes du site (la page d'entrée n'a que les siennes)
ajouterIcones({
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  people: '<circle cx="8" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M2.5 20c.5-3 2.8-5 5.5-5s5 2 5.5 5M14 15.5c2.6-.6 6 .6 6.5 4.5"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  thumb: '<path d="M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.2 2.6L12.6 10H19a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7"/>',
  comment: '<path d="M4 5h16v11H9l-5 4z"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4.5a3.5 3.5 0 0 0 4 4M16 6h3.5a3.5 3.5 0 0 1-4 4M12 13v4M8 21h8M9 17h6v4H9z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  network: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M10.8 7.2 6.3 15.8M13.2 7.2l4.5 8.6M7.5 18h9"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
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
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  play: '<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  block: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  checks: '<path d="M2.5 12.5 7 17l9.5-9.5"/><path d="M12.5 16.5l.5.5 9-9"/>',
  reply: '<path d="M9 7l-5 5 5 5"/><path d="M4 12h10a6 6 0 0 1 6 6v1"/>',
});

const HUES = [352, 18, 38, 145, 172, 200, 222, 262, 290, 320];
export function hueOf(id = '') { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return HUES[h % HUES.length]; }

// Photo de profil : le site branche ici la recherche du lien (store.photo). Sans photo, ou tant qu'elle charge, les initiales.
let lienPhoto = () => null;
export function brancherPhotos(fn) { lienPhoto = fn; }
export function Avatar({ p, size = 36 }) {
  const hue = hueOf(p?.id);
  const url = p?.photo_path ? lienPhoto(p.photo_path) : null;
  return html`<span class=${'avatar' + (url ? ' a-photo' : '')} style=${`--h:${hue};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px`} aria-hidden="true">${initials(p?.full_name)}${url ? html`<img src=${url} alt="" width=${size} height=${size} loading="lazy" decoding="async" onError=${e => { e.currentTarget.hidden = true; }}/>` : null}</span>`;
}


// ---------------------------------------------------------------------------
// Retour (bouton du téléphone, flèche du navigateur, geste de l'iPhone) : il ferme la feuille ouverte,
// sinon il revient à l'écran précédent, à la même place dans la liste. Il ne fait plus quitter le site.
// Chaque écran a son entrée d'historique ; chaque feuille ouverte en ajoute une, retirée à sa fermeture.
// État d'une entrée : { app, k: clé, i: rang depuis l'arrivée, r: route, prev: route de l'entrée du dessous,
//   b: route de la toute première entrée, o: atteinte par un onglet, f: feuilles comptées, y: défilement }
// ---------------------------------------------------------------------------
const feuilles = [];            // feuilles ouvertes, de bas en haut : { fermer, entree }
const positions = new Map();    // défilement de chaque entrée quittée, par clé
let courante = null;            // état de l'entrée affichée
let versRoute = null;           // (route, { y, doux }) : fourni par App au branchement
let attendus = [];              // nos history.go() pas encore arrivés : { synchro }
let apres = [];                 // ce qui attend leur arrivée
let dansRetour = false;         // des feuilles se ferment à cause de Retour (ou d'un changement d'écran)
let prevu = false;
let base = null;                // rang dans l'onglet de la première entrée de l'appli (Navigation API, si le navigateur l'a)
const cle = () => Math.random().toString(36).slice(2, 10);
const rang = () => { try { return window.navigation?.currentEntry?.index ?? null; } catch { return null; } };
const lireEtat = () => (history.state && history.state.app ? history.state : null);
const entrees = () => feuilles.filter(f => f.entree).length;
const ecran = st => st.kr || st.k;   // une entrée de feuille garde la clé de son écran : une seule position par écran
// Chrome saute, au Retour, les entrées ajoutées sans geste du membre : on n'empile que juste après un toucher
const geste = () => !navigator.userActivation || navigator.userActivation.isActive;
function ecrire(st, route, empiler) {
  try { history[empiler ? 'pushState' : 'replaceState'](st, '', route == null ? undefined : '#' + route); courante = st; } catch { /* cadre sans historique, Safari trop sollicité */ }
}
// Dans l'ordre ; si l'une relance une navigation (aller vers l'écran d'avant = un Retour), les suivantes attendent qu'elle finisse
const vider = () => { while (apres.length && !attendus.length) apres.shift()(); };
const plusTard = fn => (attendus.length ? apres.push(fn) : fn());
// Ce qui doit suivre un changement d'écran en cours (ouvrir une feuille sur l'écran d'arrivée), sinon tout de suite
export const ensuite = plusTard;
// synchro : l'arrivée change d'écran (comme un Retour du membre) ; sinon c'est un simple retrait d'entrées
function traverser(n, synchro = false) {
  if (!n) return;
  attendus.push({ synchro });
  try { history.go(n); } catch { attendus.pop(); return; }
  // Filet : un navigateur qui ne répond pas (historique plus court que prévu) ne bloque rien
  setTimeout(() => { if (attendus.length) { attendus = []; vider(); } }, 700);
}
function fermerJusqua(n, tout = false) {
  dansRetour = true;
  try { while (feuilles.length && (tout || entrees() > n)) feuilles.pop().fermer(); } finally { dansRetour = false; }
}
function relacher() {
  if (prevu) return;
  prevu = true;
  queueMicrotask(() => { prevu = false; plusTard(() => { const trop = (courante?.f || 0) - entrees(); if (trop > 0) traverser(-trop); }); });
}

function synchroniser() {
  let st = lireEtat();
  if (st && courante && st.k === courante.k) return;          // déjà traité (popstate puis hashchange)
  const avant = courante;
  if (!st) {                                                  // un lien « #… » ou location.hash : on adopte la nouvelle entrée
    const r = location.hash.slice(1), n = rang();
    // Retour jusqu'à une entrée d'avant l'appli (page publique, écran de connexion) : l'appli repart d'elle,
    // pour qu'aucun raccourci (« l'accueil est tout en bas ») ne recule plus loin que l'appli
    if (n != null && base != null && n < base) { base = n; st = { app: 1, k: cle(), i: 0, r, prev: null, b: r, o: 0, f: 0 }; }
    else st = { app: 1, k: cle(), i: n != null && base != null ? n - base : (avant ? avant.i : -1) + 1, r, prev: avant ? avant.r : null, b: avant ? avant.b : r, o: 0, f: 0 };
    try { history.replaceState(st, ''); } catch { /* */ }
  }
  if (avant) positions.set(ecran(avant), scrollY);
  courante = st;
  const attendu = attendus.shift();
  if (attendu && !attendu.synchro) { if (!attendus.length) vider(); return; }   // notre propre retrait d'entrées
  const meme = avant && avant.r === st.r;
  // Même écran : Retour ferme les feuilles au-dessus de celles que l'entrée compte. Autre écran : toutes.
  fermerJusqua(meme ? st.f || 0 : 0, !meme);
  if (!meme) versRoute?.(st.r, { y: positions.get(ecran(st)) ?? st.y ?? 0 });
  // Entrée d'une feuille déjà fermée (bouton Suivant, lien « # » ouvert depuis une feuille) : on la saute
  if ((st.f || 0) > entrees()) traverser(entrees() - st.f);
  if (!attendus.length) vider();
}

// Arrivée directe sur un écran intérieur (lien partagé sur WhatsApp) : au premier toucher, l'accueil passe
// dessous, pour que Retour y mène. Les feuilles ouvertes avant tout geste reçoivent alors leur entrée.
function rattraper(e) {
  if (e.type === 'keydown' && e.key === 'Escape') return;
  if (!courante || attendus.length || !geste()) return;
  const c = courante;
  if (c.i === 0 && c.r !== 'accueil' && !c.f) {
    ecrire({ ...c, r: 'accueil', b: 'accueil', o: 0, y: 0 }, 'accueil', false);
    ecrire({ ...c, k: cle(), i: 1, prev: 'accueil', b: 'accueil' }, c.r, true);
  }
  for (const f of feuilles) if (!f.entree) { f.entree = true; ecrire({ ...courante, k: cle(), kr: ecran(courante), i: courante.i + 1, f: entrees() }, null, true); }
}

// App le branche une fois, quand la coque de l'appli s'affiche (pas sur les pages publiques)
// r : la route affichée, déjà ramenée à « accueil » si l'adresse n'en est pas une (jeton de connexion…)
export function brancherHistorique(r, surRoute) {
  if (versRoute) return;
  versRoute = surRoute;
  try { history.scrollRestoration = 'manual'; } catch { /* */ }
  const st = lireEtat();
  if (!st) ecrire({ app: 1, k: cle(), i: 0, r, prev: null, b: r, o: 0, f: 0 }, location.hash.slice(1) === r ? null : r, false);
  else { courante = st; if (st.f) traverser(-st.f); }          // rechargée avec une feuille ouverte : on redescend
  const n = rang(); base = n == null ? null : n - (st ? st.i : 0);
  addEventListener('popstate', synchroniser);
  addEventListener('hashchange', synchroniser);
  document.addEventListener('click', rattraper, true);
  document.addEventListener('keydown', rattraper, true);
}
export const historiqueBranche = () => !!versRoute;

// Changer d'écran. remplacer : un onglet de la même page, une redirection, ou « ← Tous les … » (remonter).
// onglet : la barre du bas ou de côté ; passer d'un onglet à l'autre ne s'empile pas, Retour mène à l'accueil.
// exact : un lien direct (#offre, #aider) prend la place de son entrée telle quelle, sans raccourci vers l'écran d'avant,
// pour que la feuille qu'il ouvre dans le même temps ne soit pas refermée par un Retour simulé
export function aller(r, { remplacer = false, onglet = false, exact = false } = {}) {
  if (!versRoute || !courante) return false;
  if (dansRetour) return true;                                 // une feuille fermée par Retour ne relance pas une navigation
  const n = entrees();
  fermerJusqua(0, true);                                       // les feuilles ouvertes se ferment…
  if (n || attendus.length) { traverser(-n); plusTard(() => aller(r, { remplacer, onglet, exact })); return true; }   // …et leurs entrées partent d'abord
  const c = courante;
  if (onglet && r.split('/')[0] === c.r.split('/')[0]) remplacer = true;                      // l'onglet de la page où l'on est : on remonte à sa racine
  if (r === c.r) { versRoute(r, { y: 0 }); return true; }                                     // même écran : on remonte en haut
  if (exact) remplacer = true;
  else if (r === c.prev) { traverser(-1, true); return true; }                                // l'écran d'avant : comme Retour, à la même place
  else if (r === 'accueil' && c.b === 'accueil' && c.i > 0) { traverser(-c.i, true); return true; } // l'accueil est tout en bas
  positions.set(c.k, scrollY);
  if (remplacer || (onglet && c.o) || !geste()) ecrire({ ...c, k: cle(), r, b: c.i === 0 ? r : c.b, o: onglet ? 1 : c.o, f: 0, y: 0 }, r, false);
  else {
    try { history.replaceState({ ...c, y: scrollY }, ''); } catch { /* */ }
    ecrire({ app: 1, k: cle(), i: c.i + 1, r, prev: c.r, b: c.b, o: onglet ? 1 : 0, f: 0 }, r, true);
  }
  versRoute(r, { y: 0, doux: true });
  return true;
}

// Une feuille (Modal, fête, menu) : son entrée d'historique, que Retour referme
export function useFeuille(onClose, actif = true) {
  const fermer = useRef(onClose);
  fermer.current = onClose;
  useLayoutEffect(() => {
    if (!actif || !versRoute) return;
    const moi = { fermer: () => fermer.current?.(), entree: false };
    feuilles.push(moi);
    // Une feuille vient de se fermer pour laisser place à celle-ci (même geste) : elle reprend son entrée
    if (!attendus.length && (courante?.f || 0) > entrees()) moi.entree = true;
    else if (geste()) { moi.entree = true; plusTard(() => { if (feuilles.includes(moi)) ecrire({ ...courante, k: cle(), kr: ecran(courante), i: courante.i + 1, f: entrees() }, null, true); }); }
    return () => {
      const i = feuilles.indexOf(moi);
      if (i < 0) return;                                       // déjà fermée par Retour ou par un changement d'écran
      feuilles.splice(i, 1);
      if (moi.entree) relacher();                              // fermée par la croix, Échap, le fond ou le formulaire
    };
  }, []);
}
// Pour ce qui n'est pas une Modal (menu du compte) : la même entrée, sans rien afficher
export function Feuille({ onClose }) { useFeuille(onClose); return null; }

// Après un Retour : la page reprend sa place, même si la liste s'allonge encore un instant
export function rendrePosition(y) {
  let n = 0, stop = false;
  const arreter = () => { stop = true; };
  addEventListener('touchstart', arreter, { once: true, passive: true });
  addEventListener('wheel', arreter, { once: true, passive: true });
  const essai = () => {
    if (stop) return;
    window.scrollTo(0, y);
    if (Math.abs(scrollY - y) > 2 && n++ < 20) requestAnimationFrame(essai);
    else { removeEventListener('touchstart', arreter); removeEventListener('wheel', arreter); }
  };
  essai();
}

// Fenêtres ouvertes, la plus récente à la fin : seule celle du dessus réagit au clavier
const ouvertes = [];
const FOCUSABLES = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
// Sur téléphone, chaque fenêtre arrive par le bas comme une feuille (voir le CSS). « footer » reste collé
// en bas, à portée du pouce : c'est là que va l'action principale.
export function Modal({ title, onClose, children, wide, footer, cls, historique = true }) {
  const ref = useRef();
  useFeuille(onClose, historique);
  const fermer = useRef(onClose);
  fermer.current = onClose;
  // Téléphone, clavier ouvert : la feuille se loge au-dessus du clavier ; son pied (l'action principale) reste au pouce
  const [vv, setVv] = useState(null);
  const avecPied = !!footer;
  useEffect(() => {
    const v = window.visualViewport;
    if (!avecPied || !v) return;
    // Le champ suivi est ramené au-dessus du pied, puis encore une fois quand la feuille a fini de rapetisser
    let t = 0;
    const viser = () => { const a = document.activeElement; if (ref.current?.contains(a) && !a.closest('.modal-foot')) (a.closest('.field') || a).scrollIntoView({ block: 'nearest' }); };
    const f = () => {
      const clavier = innerWidth <= 760 && Math.abs(v.scale - 1) < .01 && innerHeight - v.height > 120;
      setVv(clavier ? { h: Math.round(v.height), t: Math.round(v.offsetTop) } : null);
      if (clavier) { requestAnimationFrame(viser); clearTimeout(t); t = setTimeout(viser, 220); }
    };
    v.addEventListener('resize', f); v.addEventListener('scroll', f);
    return () => { clearTimeout(t); v.removeEventListener('resize', f); v.removeEventListener('scroll', f); };
  }, [avecPied]);
  // Hauteur du titre et du pied collés, pour que le défilement s'arrête avant eux (scroll-padding)
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m || typeof ResizeObserver === 'undefined') return;
    const tete = m.querySelector(':scope > .modal-head'), pied = m.querySelector(':scope > .modal-foot');
    const mesurer = () => { m.style.setProperty('--tete', (tete?.offsetHeight || 0) + 'px'); m.style.setProperty('--pied', (pied?.offsetHeight || 0) + 'px'); };
    const ro = new ResizeObserver(mesurer);
    for (const x of [tete, pied]) if (x) ro.observe(x);
    mesurer();
    return () => ro.disconnect();
  }, [avecPied]);
  // Branché dès l'affichage (pas après) : un Échap tapé aussitôt la fenêtre ouverte la ferme
  useLayoutEffect(() => {
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
  return html`<div class=${'modal-back' + (vv ? ' clavier' : '')} style=${vv ? `--vvh:${vv.h}px;--vvt:${vv.t}px` : ''} onClick=${e => { if (e.target === e.currentTarget) onClose(); }}>
    <div class=${'modal' + (wide ? ' wide' : '') + (footer ? ' has-foot' : '') + (cls ? ' ' + cls : '')} role="dialog" aria-modal="true" aria-label=${title} ref=${ref}>
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

// Mène au premier champ à compléter : au milieu de la fenêtre (doux, sauf mouvement réduit), le curseur dedans
export function allerAuChamp(id) {
  const el = document.getElementById(id);
  if (!el) return;
  (el.closest('.field') || el).scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  (el.matches('input, textarea, select, button') ? el : el.querySelector('button, input'))?.focus({ preventScroll: true });
}

// Une chose à faire : le fait, puis UN bouton qui y mène, et depuis quand. Même ligne dans la cloche, Mon espace, Mon parcours.
export function LigneAFaire({ n, onGo }) {
  return html`<li class="af-row">
    <span class=${'n-ico ' + (n.tone || 'accent')} aria-hidden="true"><${Icon} name=${n.icon} size=${16}/></span>
    <span class="af-txt">${n.text}</span>
    <span class="af-bas"><button type="button" class="btn small af-go" onClick=${() => onGo(n)}>${n.geste}</button><span class="muted small">${timeAgo(n.at)}</span></span>
  </li>`;
}
// Une nouvelle : toute la ligne s'ouvre ; un rappel dit déjà quand, donc pas de « il y a »
export function LigneNouvelle({ n, onGo }) {
  return html`<li><button type="button" class="notif" onClick=${() => onGo(n)}><span class=${'n-ico ' + (n.tone || '')} aria-hidden="true"><${Icon} name=${n.icon} size=${16}/></span><span>${n.text}${n.rappel ? null : html`<span class="muted small">${timeAgo(n.at)}</span>`}</span></button></li>`;
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
let feteSet = null, feteActive = false;
export function celebrate({ cle, titre, texte, action, icon = 'trophy' }) {
  if (cle) { try { if (localStorage.getItem('fete-' + cle)) return false; localStorage.setItem('fete-' + cle, '1'); } catch { /* pas de stockage : on fête quand même */ } }
  if (!feteSet) return false;
  feteSet({ titre, texte, action, icon, t: Date.now() });
  feteActive = true;
  return true;
}
// Une fête est à l'écran : rien d'autre ne s'ouvre par-dessus (la feuille « Me prévenir » attend la prochaine visite)
export const feteOuverte = () => feteActive;
export function Celebration() {
  const [f, setF] = useState(null);
  feteSet = setF;
  return f ? html`<${Fete} f=${f} key=${f.t} onClose=${() => { feteActive = false; setF(null); }}/>` : null;
}
const COULEURS_FETE = ['var(--em-o)', 'var(--em-b)', 'var(--orange)', 'var(--accent)', 'var(--good)', '#FFD166'];
function Fete({ f, onClose }) {
  const ref = useRef();
  useFeuille(onClose);   // Retour la ferme ; changer d'écran aussi
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

// Qui est ce membre, en une ligne : « 5A · Génie Industriel », « Promo 2019 · Capgemini », « Équipe du réseau »
// (le compte qui anime le réseau n'est jamais « Administration », qu'on confondrait avec celle de l'école)
export function roleTexte(p) {
  if (!p) return '';
  if (p.role === 'etudiant') return `${NIVEAUX[niveauOf(p, seasonOf())]?.short || ''} · ${p.filiere}`;
  if (p.role === 'admin') return 'Équipe du réseau';
  return `Promo ${p.promo}${p.entreprise ? ' · ' + p.entreprise : ''}`;
}

export function RoleLine({ p, score }) {
  if (!p) return null;
  return html`<span class="role-line">${roleTexte(p)}
    ${p.role === 'laureat' && p.verified ? html`<span class="verif" title="Lauréat vérifié par le réseau"><${Icon} name="shield" size=${13}/></span>` : null}
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

// La fenêtre reste ouverte (bouton occupé) tant que l'action n'est pas finie : pas de double envoi
export function Confirm({ text, onYes, onClose, yes = 'Confirmer' }) {
  return html`<${Modal} title="Confirmation" onClose=${onClose}><p>${text}</p><div class="row-end"><button class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn danger" onClick=${async () => { try { await onYes(); } finally { onClose(); } }}>${yes}</button></div><//>`;
}

export function useLocal(key, init) {
  const [v, setV] = useState(() => { try { const x = localStorage.getItem(key); return x == null ? init : JSON.parse(x); } catch { return init; } });
  const set = x => { setV(x); try { localStorage.setItem(key, JSON.stringify(x)); } catch { /* pas de stockage */ } };
  return [v, set];
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


// Partage sur WhatsApp : un texte et le lien direct vers la page (offre, question), pour les groupes de promo
export const lienDirect = hash => location.origin + location.pathname + '#' + hash;
export const lienWhatsApp = texte => 'https://wa.me/?text=' + encodeURIComponent(texte);
export function PartagerWhatsApp({ texte, id }) {
  return html`<a class="icon-btn partage-wa" id=${id} href=${lienWhatsApp(texte)} target="_blank" rel="noopener" aria-label="Partager sur WhatsApp" title="Partager sur WhatsApp"><${Icon} name="share" size=${18}/></a>`;
}

// Styles propres à un module : ajoutés une seule fois dans la page, au premier rendu
const styled = new Set();
export function injectCSS(id, css) {
  if (styled.has(id) || typeof document === 'undefined') return;
  styled.add(id);
  const s = document.createElement('style'); s.dataset.module = id; s.textContent = css; document.head.appendChild(s);
}

// Filtre par filière : chaque parcours (en entier, puis ses filières). La valeur « parcours:PM » vise tout un parcours.
export function FiliereFiltre({ id, value, onChange }) {
  return html`<select id=${id} class="fil-filtre" value=${value} onChange=${e => onChange(e.target.value)} aria-label="Filière"><option value="">Toutes filières</option>
    ${PARCOURS.map(p => {
      const fs = FILIERES_INFO.filter(f => f.parcours === p.code);
      return html`<optgroup label=${`Parcours ${p.nom}`}>${fs.length > 1 ? html`<option value=${'parcours:' + p.code}>${`Tout le parcours ${p.nom}`}</option>` : null}${fs.map(f => html`<option value=${f.nom}>${f.nom}</option>`)}</optgroup>`;
    })}</select>`;
}
