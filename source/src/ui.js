// Composants partagés de l'interface.
import { html, useState, useEffect, useLayoutEffect, useRef, useMemo } from './vendor/preact-htm.js';
import { initials, levelOf, NIVEAUX, niveauOf, seasonOf, PARCOURS, FILIERES_INFO, timeAgo, logoEntreprise, monogramme, PREFIXE_BROUILLON } from './logic.js';
import { Icon, Field, BrandLogo, SchoolScene, TYPE_ICON, ajouterIcones } from './entree.js';
import { getLang } from './i18n.js';
import { avecLangue } from './regles-entree.js';

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
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.6 14c.9 1.3 2 1.9 3.4 1.9s2.5-.6 3.4-1.9"/><path d="M9.2 9.6h.01M14.8 9.6h.01" stroke-width="2.4"/>',
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

// Neuf teintes douces accordées au bleu, à l'orange et au bleu nuit de l'école (pas un arc-en-ciel) : [teinte, saturation].
// Le jour, un fond très pâle et des lettres foncées de la même teinte ; la nuit, un fond sombre désaturé et des lettres claires (AA partout).
const TEINTES = [[205, 62], [28, 78], [222, 32], [176, 46], [150, 34], [244, 42], [350, 52], [42, 66], [290, 28]];
const hacher = (id = '') => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
export const teinteDe = id => hacher(id) % TEINTES.length;
export const hueOf = id => TEINTES[teinteDe(id)][0];
const styleTeinte = t => { const [h, s] = TEINTES[t % TEINTES.length]; return `--h:${h};--s:${s}%;--s2:${Math.min(s + 8, 70)}%`; };

// Photo de profil : le site branche ici la recherche du lien (store.photo). Sans photo, ou tant qu'elle charge, les initiales.
// Sous 28 px (et dans une pile, où le voisin couvre le bord), une seule lettre ; jamais de texte sous 12 px.
// teinte : imposée par une pile (deux voisins jamais pareils).
let lienPhoto = () => null;
export function brancherPhotos(fn) { lienPhoto = fn; }
export function Avatar({ p, size = 36, teinte, une = false }) {
  const url = p?.photo_path ? lienPhoto(p.photo_path) : null;
  const un = une || size < 28;
  const ini = initials(p?.full_name);
  return html`<span class=${'avatar' + (url ? ' a-photo' : '')} style=${`${styleTeinte(teinte ?? teinteDe(p?.id))};width:${size}px;height:${size}px;font-size:${Math.max(12, Math.round(size * (un ? 0.5 : 0.38)))}px`} aria-hidden="true"><span class="av-ini">${[...ini][0] || ''}${!un && [...ini].length > 1 ? html`<span class="av-l2">${[...ini].slice(1).join('')}</span>` : null}</span>${url ? html`<img src=${url} alt="" width=${size} height=${size} loading="lazy" decoding="async" onError=${e => { e.currentTarget.hidden = true; }}/>` : null}</span>`;
}

// Pile de visages : trois au plus puis « +N » (N vrai : passé par reste, sinon ceux de la liste qu'on ne montre pas),
// 6 px de recouvrement, un anneau de la couleur du fond, et jamais deux teintes identiques côte à côte
export function AvatarPile({ gens = [], size = 28, max = 3, reste, cls = '' }) {
  const vus = gens.filter(Boolean).slice(0, max);
  const plus = reste ?? Math.max(0, gens.filter(Boolean).length - vus.length);
  let avant = -1;
  const teintes = vus.map(p => { let t = teinteDe(p.id); if (t === avant) t = (t + 1) % TEINTES.length; avant = t; return t; });
  return html`<span class=${'av-pile' + (cls ? ' ' + cls : '')} aria-hidden="true">${vus.map((p, i) => html`<${Avatar} key=${p.id} p=${p} size=${size} teinte=${teintes[i]} une=${size < 40}/>`)}${plus > 0 ? html`<span class="av-plus" dir="ltr" style=${`height:${size}px;min-width:${size}px;font-size:${Math.max(12, Math.round(size * 0.4))}px`}>${'+' + plus}</span>` : null}</span>`;
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
// Un vrai toucher dans cette page compte, pas l'activation que le navigateur donne à une adresse ouverte depuis une autre appli
// (lien WhatsApp) : sinon la fiche ouverte par le lien prendrait une entrée avant le premier geste, et l'accueil ne passerait plus dessous
let touche = false;
if (typeof document !== 'undefined') for (const t of ['pointerdown', 'keydown', 'click']) document.addEventListener(t, () => { touche = true; }, true);
const geste = () => touche && (!navigator.userActivation || navigator.userActivation.isActive);
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

// ---------------------------------------------------------------------------
// Lot mouvement · B : les feuilles du bas se manipulent au doigt.
//  - La page derrière ne défile plus tant qu'une feuille est ouverte (sans saut : la position reste, scrollY aussi).
//  - Sur téléphone, on la ferme en glissant la poignée (ou le contenu tout en haut) vers le bas : elle suit le doigt,
//    résiste vers le haut ; au-delà de 30 % de sa hauteur ou d'un geste vif elle part, sinon elle revient en ressort.
//  - Elle repart en douceur : une copie inerte finit le mouvement, le contenu (état, focus, historique) est déjà fermé.
// ---------------------------------------------------------------------------
export const mouvementReduit = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } };
const surTelephone = () => { try { return matchMedia('(max-width: 760px)').matches; } catch { return false; } };
const verrous = [];               // fonds des feuilles ouvertes, de bas en haut
let doigt = null;                 // dernière position du doigt (pour le sens du geste)
const noterDoigt = e => { const t = e.touches[0]; doigt = t ? { x: t.clientX, y: t.clientY } : null; };
// Un geste qui ferait défiler la page derrière est retenu ; dans la feuille, ce qui peut encore défiler défile
// (iPhone compris, où overflow: hidden ne suffit pas toujours), le pincement pour zoomer reste libre
function retenirDoigt(e) {
  const fond = verrous[verrous.length - 1], t = e.touches[0];
  if (!fond || e.touches.length > 1 || !t) return;
  const dx = doigt ? t.clientX - doigt.x : 0, dy = doigt ? t.clientY - doigt.y : 0;
  doigt = { x: t.clientX, y: t.clientY };
  if (!e.cancelable) return;
  for (let el = e.target; el && el.nodeType === 1 && fond.contains(el); el = el.parentElement) {
    if (el.matches('input, textarea, select, [contenteditable="true"], .leaflet-container')) return;
    const st = getComputedStyle(el);
    if (Math.abs(dx) > Math.abs(dy)) { if (/auto|scroll/.test(st.overflowX) && el.scrollWidth > el.clientWidth + 1) return; }
    else if (/auto|scroll/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 1
      && ((dy > 0 && el.scrollTop > 0) || (dy < 0 && Math.ceil(el.scrollTop + el.clientHeight) < el.scrollHeight))) return;
  }
  e.preventDefault();
}
// Plusieurs feuilles empilées : la page ne se libère qu'à la fermeture de la dernière
function verrouiller(fond) {
  const de = document.documentElement;
  if (!verrous.length) {
    if (innerWidth - de.clientWidth > 0) de.classList.add('defil-gouttiere');   // la barre de défilement garde sa place : rien ne bouge
    de.classList.add('defil-bloque');
    document.addEventListener('touchstart', noterDoigt, { capture: true, passive: true });
    document.addEventListener('touchmove', retenirDoigt, { capture: true, passive: false });
  }
  verrous.push(fond);
  return () => {
    const i = verrous.lastIndexOf(fond);
    if (i >= 0) verrous.splice(i, 1);
    if (verrous.length) return;
    de.classList.remove('defil-bloque', 'defil-gouttiere');
    document.removeEventListener('touchstart', noterDoigt, { capture: true });
    document.removeEventListener('touchmove', retenirDoigt, { capture: true });
  };
}
export const pageVerrouillee = () => verrous.length > 0;

// La copie qui s'en va : mêmes classes (même allure), sans id, inerte, cachée aux lecteurs d'écran
function sortieDouce(fond, feuille) {
  if (!fond?.isConnected || mouvementReduit()) return;
  const i = [...fond.children].indexOf(feuille);
  const c = fond.cloneNode(true);
  for (const x of [c, ...c.querySelectorAll('[id]')]) x.removeAttribute('id');
  for (const x of c.querySelectorAll('[role="dialog"]')) { x.removeAttribute('role'); x.removeAttribute('aria-modal'); }
  const avant = fond.querySelectorAll('input, textarea, select'), apres = c.querySelectorAll('input, textarea, select');
  avant.forEach((x, k) => { if (apres[k] && x.type !== 'file') { try { apres[k].value = x.value; apres[k].checked = x.checked; } catch { /* */ } } });
  c.setAttribute('aria-hidden', 'true'); c.inert = true;
  c.classList.add('sortie');
  document.body.appendChild(c);
  const f = c.children[i];
  if (f) f.scrollTop = feuille.scrollTop;
  const fin = () => c.remove();
  c.addEventListener('animationend', e => { if (e.target === f) fin(); });
  setTimeout(fin, 600);
}

// Le ressort : un léger dépassement, puis la feuille se pose
const RESSORT = 'transform .46s cubic-bezier(.22, 1.25, .36, 1)';
function useFeuilleDuBas(ref, onClose, poignee) {
  const fermer = useRef(onClose);
  fermer.current = onClose;
  useLayoutEffect(() => {
    const feuille = ref.current;
    if (!feuille) return;
    const fond = feuille.parentElement;
    const liberer = verrouiller(fond);
    let g = null;      // geste en cours : { y0, dy, h, pts, id }
    let cand = null;   // un toucher dans le contenu, peut-être un glisser
    const commencer = (y, t, id) => {
      g = { y0: y, dy: 0, h: feuille.getBoundingClientRect().height || 1, pts: [[t, y]], id };
      feuille.style.transition = 'none';
      feuille.classList.add('glisse');
    };
    const suivre = (y, t) => {
      const dy = y - g.y0;
      g.dy = dy;
      g.pts.push([t, y]); while (g.pts.length > 2 && t - g.pts[0][0] > 90) g.pts.shift();
      // Vers le haut, la feuille résiste (24 px au plus) ; vers le bas, elle suit le doigt
      const v = dy >= 0 ? dy : -24 * (1 - Math.exp(dy / 60));
      feuille.style.transform = `translate3d(0, ${v.toFixed(1)}px, 0)`;
      fond.style.setProperty('--voile', Math.max(0, 1 - Math.max(0, dy) / g.h).toFixed(3));
    };
    const lacher = () => {
      if (!g) return;
      const { dy, h, pts } = g; g = null;
      const [t0, y0] = pts[0], [t1, y1] = pts[pts.length - 1];
      const vitesse = t1 > t0 ? (y1 - y0) / (t1 - t0) : 0;      // px/ms, vers le bas > 0
      if (dy > h * .3 || (vitesse > .5 && dy > 12)) {
        // Elle part à la vitesse du doigt (ni plus lente, ni brutale)
        const d = Math.round(Math.min(300, Math.max(140, (h - dy) / Math.max(vitesse, 1.2))));
        fond.style.setProperty('--sortie-d', d + 'ms');
        fond.style.setProperty('--sortie-e', 'cubic-bezier(.25, .25, .6, 1)');   // part de la vitesse du doigt
        fermer.current?.();
        // Une feuille qui ne se ferme pas (rien à fermer, action en cours) revient à sa place
        setTimeout(() => { if (feuille.isConnected && !g) revenir(); }, 150);
        return;
      }
      revenir();
    };
    const revenir = () => {
      feuille.style.transition = RESSORT + ', box-shadow .3s';
      feuille.style.transform = '';
      fond.style.setProperty('--voile', '1');
      const poser = e => { if (e && e.target !== feuille) return; feuille.removeEventListener('transitionend', poser); if (!g) { feuille.style.transition = ''; feuille.classList.remove('glisse'); } };
      feuille.addEventListener('transitionend', poser);
      setTimeout(poser, 520);
    };
    // La poignée (en-tête) : souris, stylet ou doigt, avec capture du pointeur
    const interactif = el => el.closest('button, a, input, select, textarea, label, [role="tab"], [contenteditable="true"]');
    const pd = e => {
      if (g || cand || !surTelephone() || (e.pointerType === 'mouse' && e.button !== 0) || !e.target.closest(poignee) || interactif(e.target)) return;
      const y0 = e.clientY, id = e.pointerId;
      const pm = ev => {
        if (ev.pointerId !== id) return;
        if (!g) { if (Math.abs(ev.clientY - y0) < 4) return; commencer(y0, ev.timeStamp, id); try { feuille.setPointerCapture(id); } catch { /* */ } }
        suivre(ev.clientY, ev.timeStamp);
      };
      const pu = ev => { if (ev.pointerId !== id) return; off(); lacher(); };
      const off = () => { feuille.removeEventListener('pointermove', pm); feuille.removeEventListener('pointerup', pu); feuille.removeEventListener('pointercancel', pu); };
      feuille.addEventListener('pointermove', pm); feuille.addEventListener('pointerup', pu); feuille.addEventListener('pointercancel', pu);
    };
    // Le contenu : tiré vers le bas quand il est déjà tout en haut, la feuille descend au lieu de rebondir
    const peutRemonter = el => { for (; el && el !== feuille; el = el.parentElement) if (el.scrollTop > 0 && /auto|scroll/.test(getComputedStyle(el).overflowY)) return true; return false; };
    const ts = e => {
      cand = null;
      if (g || e.touches.length !== 1 || !surTelephone() || e.target.closest(poignee) || e.target.closest('input, textarea, select, [contenteditable="true"], .leaflet-container')) return;
      const t = e.touches[0];
      cand = { x: t.clientX, y: t.clientY };
    };
    const tm = e => {
      const t = e.touches[0];
      if (g && g.id === 'doigt') { if (e.cancelable) e.preventDefault(); suivre(t.clientY, e.timeStamp); return; }
      if (!cand || !t) return;
      const dx = t.clientX - cand.x, dy = t.clientY - cand.y;
      if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
      const ok = dy > 0 && Math.abs(dy) > Math.abs(dx) && feuille.scrollTop <= 0 && !peutRemonter(e.target);
      cand = null;
      if (!ok || !e.cancelable) return;
      e.preventDefault();
      commencer(t.clientY, e.timeStamp, 'doigt');
    };
    const te = () => { cand = null; if (g && g.id === 'doigt') lacher(); };
    feuille.addEventListener('pointerdown', pd);
    feuille.addEventListener('touchstart', ts, { passive: true });
    feuille.addEventListener('touchmove', tm, { passive: false });
    feuille.addEventListener('touchend', te);
    feuille.addEventListener('touchcancel', te);
    return () => {
      feuille.removeEventListener('pointerdown', pd);
      feuille.removeEventListener('touchstart', ts);
      feuille.removeEventListener('touchmove', tm);
      feuille.removeEventListener('touchend', te);
      feuille.removeEventListener('touchcancel', te);
      liberer();
      sortieDouce(fond, feuille);
    };
  }, []);
}

// Fenêtres ouvertes, la plus récente à la fin : seule celle du dessus réagit au clavier
const ouvertes = [];
const FOCUSABLES = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
// Sur téléphone, chaque fenêtre arrive par le bas comme une feuille (voir le CSS). « footer » reste collé
// en bas, à portée du pouce : c'est là que va l'action principale.
export function Modal({ title, onClose, children, wide, footer, cls, historique = true }) {
  const ref = useRef();
  useFeuille(onClose, historique);
  useFeuilleDuBas(ref, onClose, '.modal-head');
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
    const moi = { ref };
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
      // On rend le focus au bouton qui avait ouvert la fenêtre, s'il est toujours là ; sinon à la fenêtre restée dessous
      if (avant?.isConnected && avant !== document.body) avant.focus?.();
      else ouvertes[ouvertes.length - 1]?.ref.current?.querySelector(FOCUSABLES)?.focus();
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

let toastAjout = null, nToast = 0;
// pts : les points d'impact gagnés, en petite pastille après la phrase (jamais montrés à un étudiant)
// kind : ok (coche), envoi (un envoi réussi : la coche se trace, « C’est noté »), win (étoile), err (point d'exclamation), info
// annuler : une fonction ; le message montre alors « Annuler » et reste 6 s (le temps de changer d'avis)
export function toast(msg, kind = 'ok', pts = 0, { annuler } = {}) { toastAjout?.({ msg, kind, pts, annuler, t: ++nToast }); }
const DUREE_TOAST = 3800, DUREE_ANNULER = 6000;
const COCHE = '<circle cx="12" cy="12" r="9"/><path class="toast-trace" pathLength="1" d="M8 12.3l2.8 2.8 5.3-5.6"/>';
const ICO_TOAST = {
  ok: COCHE, envoi: COCHE,
  win: '<path d="M12 3.5l2.5 5.2 5.6.8-4 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-4 5.6-.8z"/>',
  err: '<circle cx="12" cy="12" r="9"/><path d="M12 7.6v5.2M12 16.3v.2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11.2v5.2M12 7.7v.2"/>',
};
export function Toaster() {
  const [liste, setListe] = useState([]);
  // Un nouveau message pousse le précédent, qui s'en va en douceur (mouvement réduit : il laisse simplement la place).
  // Celui qui porte « Annuler » reste jusqu'à son échéance (ou un autre « Annuler », qui vaut pour le dernier geste) :
  // les messages ordinaires s'affichent au-dessus de lui, dans leur propre rangée, sans le cacher.
  toastAjout = t => setListe(l => {
    const garde = x => !t.annuler && x.annuler && !x.sortie;
    const reste = mouvementReduit() ? l.filter(garde) : l.filter(x => garde(x) || !x.sortie).map(x => (garde(x) ? x : { ...x, sortie: true }));
    return [...reste, t];
  });
  const partir = id => setListe(l => (mouvementReduit() ? l.filter(x => x.t !== id) : l.map(x => (x.t === id ? { ...x, sortie: true } : x))));
  const retirer = id => setListe(l => l.filter(x => x.t !== id));
  // La zone reste toujours là (vide entre deux messages) pour que les lecteurs d'écran annoncent chaque message
  return html`<div class="toast-zone" role="status" aria-live="polite">${liste.map(t => html`<${Toast} key=${t.t} t=${t} partir=${partir} retirer=${retirer}/>`)}</div>`;
}
function Toast({ t, partir, retirer }) {
  // Le doigt, la souris ou le clavier dessus : le message attend
  const [retenu, setRetenu] = useState(false);
  useEffect(() => { if (t.sortie || retenu) return; const h = setTimeout(() => partir(t.t), t.annuler ? DUREE_ANNULER : DUREE_TOAST); return () => clearTimeout(h); }, [t.sortie, retenu]);
  useEffect(() => { if (!t.sortie) return; const h = setTimeout(() => retirer(t.t), 260); return () => clearTimeout(h); }, [t.sortie]);
  const fait = useRef(false);
  const annuler = () => { if (fait.current) return; fait.current = true; partir(t.t); t.annuler(); };
  const kind = ICO_TOAST[t.kind] ? t.kind : 'ok';
  return html`<div class=${'toast ' + kind + (t.annuler ? ' avec-action' : '') + (t.sortie ? ' sortie' : '')} aria-hidden=${t.sortie ? 'true' : null} style=${t.annuler ? 'grid-row:2' : null}
    onPointerEnter=${e => e.pointerType === 'mouse' && setRetenu(true)} onPointerLeave=${() => setRetenu(false)} onFocusIn=${() => setRetenu(true)} onFocusOut=${() => setRetenu(false)}>
    <svg class="toast-ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: ICO_TOAST[kind] }}></svg>
    <span class="toast-txt">${kind === 'envoi' ? html`<strong class="toast-titre">C’est noté</strong>` : null}<span>${t.msg}<${Pastille} n=${t.pts}/></span></span>
    ${t.annuler ? html`<button type="button" class="toast-annuler" disabled=${t.sortie} onClick=${annuler}>${getLang() === 'ar' ? 'تراجع' : 'Annuler'}</button>` : null}
  </div>`;
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
  return html`<li><button type="button" class="notif" onClick=${() => onGo(n)}><span class=${'n-ico ' + (n.tone || '')} aria-hidden="true"><${Icon} name=${n.icon} size=${16}/></span><span>${n.text}<${Pastille} n=${n.pts}/>${n.rappel ? null : html`<span class="muted small">${timeAgo(n.at)}</span>`}</span></button></li>`;
}

// Écran vide : une phrase chaleureuse et, si possible, une seule action pour avancer.
// action = { label, onClick, icon } ; scene = 'demandes' | 'messages' | 'candidatures' : une petite scène dessinée
// (tirée de l'entrée de l'école) à la place de l'icône, de jour en thème clair et de nuit en thème sombre.
export function Empty({ icon = 'spark', title, children, action, scene }) {
  const dessin = scene && SCENES_VIDES[scene];
  if (dessin) injectCSS('empty-scene', CSS_SCENES);
  return html`<div class=${'empty' + (dessin ? ' a-scene' : '')}>${dessin ? html`<span class=${'es sky es-' + scene} aria-hidden="true" dangerouslySetInnerHTML=${{ __html: dessin }}></span>` : html`<span class="empty-ico"><${Icon} name=${icon} size=${26}/></span>`}<strong>${title}</strong><div>${children}</div>
    ${action ? html`<button type="button" class="btn primary small empty-act" onClick=${action.onClick}>${action.icon ? html`<${Icon} name=${action.icon} size=${15}/> ` : null}${action.label}</button>` : null}</div>`;
}

// Les scènes des écrans vides (240 × 120) : le ciel, le soleil ou la lune, la colline et la pelouse, puis le sujet.
// Les couleurs sont celles de l'entrée dessinée (.sky) : elles passent à la nuit avec le thème sombre.
const FOND_VIDE = '<svg viewBox="0 0 240 120" focusable="false"><defs><radialGradient id="es-lueur"><stop offset="0" class="es-st" stop-opacity=".55"/><stop offset="1" class="es-st" stop-opacity="0"/></radialGradient><radialGradient id="es-lampe"><stop offset="0" stop-color="#FFD98A" stop-opacity=".85"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/></radialGradient></defs><g class="es-etoiles"><circle cx="22" cy="18" r="1"/><circle cx="58" cy="9" r="1.2"/><circle cx="132" cy="14" r=".9"/><circle cx="164" cy="30" r="1"/><circle cx="226" cy="54" r="1.1"/><circle cx="96" cy="26" r=".8"/></g>'
  + '<g class="es-astre"><circle cx="206" cy="24" r="22" fill="url(#es-lueur)"/><circle class="es-soleil" cx="206" cy="24" r="9.5"/><circle class="es-cratere" cx="203" cy="21" r="2"/><circle class="es-cratere" cx="209" cy="28" r="1.4"/></g>'
  + '<path class="es-nuage" d="M30 40c-1-5 5-8 9-6 2-6 11-7 14-1 4-2 9 0 9 4 4 0 6 3 4 5H31c-2 0-2-2-1-2z"/>'
  + '<path class="es-colline" d="M0 84C34 74 70 80 104 77S176 70 240 80V120H0Z"/><path class="es-pelouse" d="M0 95C60 90 170 90 240 95V120H0Z"/>';
const SCENES_VIDES = {
  // La porte triangulaire de l'école, l'allée, et un avion de papier qui attend de partir
  demandes: FOND_VIDE
    + '<path class="es-allee" d="M77 95H93L116 120H54Z"/>'
    + '<g class="es-porte"><polygon class="es-cadre" points="85,24 55,66 115,66"/><polygon class="es-dedans" points="85,34 64,62 106,62"/><rect class="es-dedans es-trait" x="58" y="64" width="54" height="7"/>'
    + '<rect class="es-cadre" x="63" y="71" width="6" height="24"/><rect class="es-cadre" x="101" y="71" width="6" height="24"/>'
    + '<path class="es-fer" d="M69 76h32M69 92h32M73 76v16M78 76v16M83 76v16M88 76v16M93 76v16M98 76v16"/><path class="es-orange" d="M80 49l5-9 5 9z"/><path class="es-bleu" d="M86 55l4-7 5 9h-9z"/></g>'
    + '<g class="es-fleurs"><circle class="es-f1" cx="58" cy="99" r="2.2"/><circle class="es-f2" cx="51" cy="102" r="2.4"/><circle class="es-f3" cx="45" cy="99" r="2"/><circle class="es-f1" cx="40" cy="104" r="2.6"/><circle class="es-f2" cx="113" cy="99" r="2.2"/><circle class="es-f1" cx="120" cy="102" r="2.4"/><circle class="es-f3" cx="126" cy="99" r="2"/><circle class="es-f2" cx="131" cy="104" r="2.6"/></g>'
    + '<path class="es-sillage" d="M108 46C126 32 142 62 160 55"/>'
    + '<g class="es-avion"><path class="es-papier" d="M162 54l30-12-10 25-7-8z"/><path class="es-pli" d="M175 59l17-17"/></g></svg>',
  // Un banc sous un arbre, un réverbère, et une bulle qui attend le premier mot
  messages: FOND_VIDE
    + '<g class="es-arbre"><rect class="es-tronc" x="56" y="70" width="5" height="26"/><circle class="es-t2" cx="47" cy="66" r="12"/><circle class="es-t2" cx="70" cy="65" r="12"/><circle class="es-t1" cx="58" cy="56" r="16"/><circle class="es-lumiere" cx="53" cy="50" r="5"/></g>'
    + '<g class="es-banc"><rect class="es-bois" x="84" y="79" width="52" height="4" rx="2"/><rect class="es-bois" x="84" y="86" width="52" height="4" rx="2"/><path class="es-fer" d="M90 90v7M130 90v7M88 83v7M132 83v7"/></g>'
    + '<g class="es-lampe"><circle class="es-lueur" cx="176" cy="46" r="20" fill="url(#es-lampe)"/><rect class="es-fer-p" x="174.5" y="48" width="3" height="48"/><path class="es-fer-p" d="M170 48h12l-2-5h-8z"/><rect class="es-ampoule" x="173.5" y="43" width="5" height="4" rx="1.2"/></g>'
    + '<g class="es-bulle"><path class="es-bulle-fond" d="M98 30h34a11 11 0 0 1 0 22h-24l-8 7 1-7a11 11 0 0 1-3-22z"/><circle class="es-point" cx="105" cy="41" r="2.4"/><circle class="es-point" cx="114" cy="41" r="2.4"/><circle class="es-point" cx="123" cy="41" r="2.4"/></g></svg>',
  // Un bâtiment blanc de l'école aux fenêtres en arc, et une boîte aux lettres, drapeau baissé
  candidatures: FOND_VIDE
    + '<g class="es-batiment"><rect class="es-mur" x="34" y="50" width="104" height="46"/><rect class="es-ombre" x="128" y="50" width="10" height="46"/><rect class="es-toit" x="31" y="45" width="110" height="6" rx="1"/>'
    + '<path class="es-fenetre" d="M44 70v-9a4 4 0 0 1 8 0v9zM60 70v-9a4 4 0 0 1 8 0v9zM104 70v-9a4 4 0 0 1 8 0v9zM120 70v-9a4 4 0 0 1 8 0v9zM44 90v-9a4 4 0 0 1 8 0v9zM60 90v-9a4 4 0 0 1 8 0v9zM104 90v-9a4 4 0 0 1 8 0v9zM120 90v-9a4 4 0 0 1 8 0v9z"/>'
    + '<path class="es-porte-b" d="M78 96V74a8 8 0 0 1 16 0v22z"/></g>'
    + '<g class="es-cypres"><rect class="es-tronc" x="213" y="88" width="3" height="8"/><ellipse class="es-t2" cx="214.5" cy="70" rx="6" ry="19"/></g>'
    + '<g class="es-boite"><rect class="es-fer-p" x="179" y="72" width="4" height="24"/><path class="es-boite-fond" d="M166 74V62a9 9 0 0 1 9-9h12a9 9 0 0 1 9 9v12z"/><path class="es-boite-face" d="M166 74V62a9 9 0 0 1 18 0v12z"/><rect class="es-fente" x="169" y="63" width="12" height="2.4" rx="1.2"/>'
    + '<g class="es-drapeau"><rect class="es-fer-p" x="194" y="57" width="2" height="15"/><path class="es-orange" d="M196 66h8l-2 3 2 3h-8z"/></g></g></svg>',
};
const CSS_SCENES = `
.empty.a-scene { gap: .45rem; }
.es { display: block; inline-size: min(240px, 78%); aspect-ratio: 2 / 1; margin-block-end: .35rem; border-radius: var(--r-lg); overflow: hidden;
  -webkit-mask: radial-gradient(120% 120% at 50% 40%, #000 62%, transparent 71%); mask: radial-gradient(120% 120% at 50% 40%, #000 62%, transparent 71%); }
.es svg { display: block; inline-size: 100%; block-size: 100%; }
[dir="rtl"] .es svg { transform: scaleX(-1); }
.es .es-etoiles { fill: #FFFFFF; opacity: var(--stars); }
.es .es-soleil { fill: var(--sun); } .es .es-st { stop-color: var(--sun); } .es .es-cratere { fill: #9C9480; opacity: var(--crater); }
.es .es-nuage { fill: var(--cloud); } .es .es-colline { fill: var(--hill); } .es .es-pelouse { fill: var(--lawn-2); }
.es .es-allee { fill: var(--walk); }
.es .es-cadre { fill: var(--gate); } .es .es-dedans { fill: var(--gate-in); } .es .es-trait { stroke: var(--gate); stroke-width: 1.4; }
.es .es-fer { fill: none; stroke: var(--iron); stroke-width: 1.6; stroke-linecap: round; } .es .es-fer-p { fill: var(--iron); }
.es .es-orange { fill: var(--fl-2); } .es .es-bleu { fill: var(--w-body-1); }
.es .es-f1 { fill: var(--fl-1); } .es .es-f2 { fill: var(--fl-2); } .es .es-f3 { fill: var(--fl-3); }
.es .es-sillage { fill: none; stroke: var(--gate); stroke-width: 1.6; stroke-linecap: round; stroke-dasharray: 1 5; opacity: .45; }
.es .es-papier { fill: var(--gate-in); stroke: var(--gate); stroke-width: 1.6; stroke-linejoin: round; } .es .es-pli { fill: none; stroke: var(--gate); stroke-width: 1.4; stroke-linecap: round; }
.es .es-tronc { fill: var(--trunk); } .es .es-t1 { fill: var(--tree-1); } .es .es-t2 { fill: var(--tree-2); } .es .es-lumiere { fill: var(--tree-hi); opacity: .55; }
.es .es-bois { fill: var(--trunk); }
.es .es-lueur { opacity: var(--lamp); } .es .es-ampoule { fill: #FFE7A8; }
.es .es-bulle-fond { fill: var(--bldg); stroke: var(--bldg-top); stroke-width: 1.4; stroke-linejoin: round; } .es .es-point { fill: var(--win); }
.es .es-mur { fill: var(--bldg); } .es .es-ombre { fill: var(--bldg-shade); } .es .es-toit { fill: var(--bldg-top); } .es .es-fenetre { fill: var(--win); } .es .es-porte-b { fill: var(--gate); }
.es .es-boite-fond { fill: var(--gate); } .es .es-boite-face { fill: color-mix(in srgb, var(--gate) 78%, #000); } .es .es-fente { fill: var(--gate-in); opacity: .8; }
/* Un seul mouvement, à l'arrivée, puis la scène se pose */
@media (prefers-reduced-motion: no-preference) {
  .es { animation: es-in .5s var(--ease) backwards; }
  .es .es-avion { animation: es-vol 1.1s cubic-bezier(.22, .8, .3, 1) .25s backwards; }
  .es .es-sillage { animation: es-fondu .9s ease .55s backwards; }
  .es .es-bulle { transform-box: fill-box; transform-origin: 10% 100%; animation: es-bulle .55s cubic-bezier(.3, 1.4, .5, 1) .3s backwards; }
  .es .es-point { animation: es-point 1.2s ease-in-out .85s 2; }
  .es .es-point:nth-of-type(2) { animation-delay: 1s; } .es .es-point:nth-of-type(3) { animation-delay: 1.15s; }
  .es .es-drapeau { transform-box: fill-box; transform-origin: 0 100%; animation: es-drapeau .9s cubic-bezier(.3, 1.3, .5, 1) .45s backwards; }
  .es .es-fenetre { animation: es-fondu .8s ease .3s backwards; }
}
@keyframes es-in { from { opacity: 0; transform: translateY(6px) scale(.98); } }
@keyframes es-vol { from { opacity: 0; transform: translate(-26px, 12px) rotate(-8deg); } }
@keyframes es-fondu { from { opacity: 0; } }
@keyframes es-bulle { from { opacity: 0; transform: scale(.6); } }
@keyframes es-point { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
@keyframes es-drapeau { from { transform: rotate(-70deg); } }
`;

// ---------------------------------------------------------------------------
// Les grands moments : première candidature, rendez-vous fixé, recrutement confirmé, premier merci…
// Une seule fois chacun (cle), avec une phrase chaleureuse et une seule prochaine étape.
// ---------------------------------------------------------------------------
let feteSet = null, feteActive = false;
const surFete = new Set();
// visages = [p1, p2] : la fête « match », les deux visages glissent l'un vers l'autre et se rejoignent sous un cœur.
// citation = { txt, de } : un merci cité en entier, avec le visage et le prénom de qui l'a écrit. ok : le libellé du bouton seul.
export function celebrate({ cle, titre, texte, action, icon = 'trophy', pts = 0, visages, citation, ok }) {
  if (cle) { try { if (localStorage.getItem('fete-' + cle)) return false; localStorage.setItem('fete-' + cle, '1'); } catch { /* pas de stockage : on fête quand même */ } }
  if (!feteSet) return false;
  feteSet({ titre, texte, action, icon, pts, visages: visages?.length === 2 && visages.every(Boolean) ? visages : null, citation: citation?.txt ? citation : null, ok, t: Date.now() });
  feteActive = true;
  for (const fn of surFete) fn();
  return true;
}
// Une fenêtre déjà ouverte qui doit laisser la place à une fête qui arrive après elle
export const quandFete = fn => { surFete.add(fn); return () => surFete.delete(fn); };
// Une fête est à l'écran : rien d'autre ne s'ouvre par-dessus (la feuille « Me prévenir » attend la prochaine visite)
export const feteOuverte = () => feteActive;
// Rien d'ouvert par-dessus l'écran (feuille, fenêtre ou fête ; une copie qui s'en va ne compte pas) : une fête peut venir
export const ecranLibre = () => !document.querySelector('.modal-back:not(.sortie), .fete-back:not(.sortie)') && !feteActive;
export function Celebration() {
  const [f, setF] = useState(null);
  feteSet = setF;
  return f ? html`<${Fete} f=${f} key=${f.t} onClose=${() => { feteActive = false; setF(null); }}/>` : null;
}
const COULEURS_FETE = ['var(--em-o)', 'var(--em-b)', 'var(--orange)', 'var(--accent)', 'var(--good)', '#FFD166'];
// Le match : les couleurs de l'école seulement (bleu, orange, bleu nuit), et la pluie part quand le cœur apparaît
const COULEURS_MATCH = ['var(--accent)', 'var(--orange)', 'var(--navy)'];
const COEUR = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 20.7l-1.2-1.1C6.4 15.6 3.5 13 3.5 9.7A4.7 4.7 0 0 1 8.3 5c1.5 0 2.9.7 3.7 1.8A4.7 4.7 0 0 1 15.7 5a4.7 4.7 0 0 1 4.8 4.7c0 3.3-2.9 5.9-7.3 9.9z"/></svg>';
function Fete({ f, onClose }) {
  const ref = useRef();
  useFeuille(onClose);   // Retour la ferme ; changer d'écran aussi
  useFeuilleDuBas(ref, onClose, '.sheet-grip');   // Lot mouvement · B : sur téléphone, une feuille du bas qu'on glisse pour fermer
  const match = !!f.visages;
  const morceaux = useMemo(() => { const c = match ? COULEURS_MATCH : COULEURS_FETE; return Array.from({ length: match ? 36 : 34 }, (_, i) => ({ x: Math.round(Math.random() * 100), dx: Math.round(Math.random() * 120 - 60), d: (1.1 + Math.random() * .9).toFixed(2), w: ((match ? .7 : 0) + Math.random() * .35).toFixed(2), r: Math.round(Math.random() * 720 - 360), c: c[i % c.length], rond: i % 3 === 0 })); }, []);
  useEffect(() => {
    const avant = document.activeElement;
    ref.current?.querySelector('button')?.focus();
    const k = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('keydown', k); if (avant?.isConnected) avant.focus?.(); };
  }, []);
  const cite = f.citation, prenomCite = cite?.de?.full_name?.split(' ')[0];
  if (match || cite) injectCSS('fete-match', CSS_FETE_MATCH);
  return html`<div class="fete-back" onClick=${e => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="fete-pluie" aria-hidden="true">${morceaux.map(m => html`<i class=${m.rond ? 'rond' : ''} style=${`--x:${m.x}%;--dx:${m.dx}px;--d:${m.d}s;--w:${m.w}s;--r:${m.r}deg;--c:${m.c}`}></i>`)}</div>
    <div class=${'fete' + (match ? ' fete-match' : '') + (cite ? ' fete-merci' : '')} role="dialog" aria-modal="true" aria-labelledby="fete-titre" ref=${ref}>
      <span class="sheet-grip" aria-hidden="true"></span>
      ${match ? html`<div class="fm-duo" aria-hidden="true"><span class="fm-v fm-a"><${Avatar} p=${f.visages[0]} size=${76}/></span><span class="fm-coeur" dangerouslySetInnerHTML=${{ __html: COEUR }}></span><span class="fm-v fm-b"><${Avatar} p=${f.visages[1]} size=${76}/></span></div>`
        : html`<span class="fete-ico"><${Icon} name=${f.icon} size=${34}/></span>`}
      <h2 id="fete-titre">${f.titre}</h2>
      ${f.texte ? html`<p>${f.texte}</p>` : null}
      ${cite ? html`<blockquote class="fete-cite"><p translate="no" dir="auto">${`« ${cite.txt.trim()} »`}</p>
        <footer><${Avatar} p=${cite.de} size=${28}/>${prenomCite ? html`<b translate="no" dir="auto">${prenomCite}</b>` : html`<b>Un étudiant</b>`}</footer></blockquote>` : null}
      ${f.pts && rangsVisibles ? html`<p class="fete-pts"><${Pastille} n=${f.pts}/></p>` : null}
      <div class="fete-acts">
        ${f.action ? html`<button type="button" class="btn primary" onClick=${() => { onClose(); f.action.onClick(); }}>${f.action.icon ? html`<${Icon} name=${f.action.icon} size=${16}/> ` : null}${f.action.label}</button>` : null}
        <button type="button" class=${'btn ' + (f.action ? 'ghost' : 'primary')} onClick=${onClose}>${f.action ? 'Plus tard' : f.ok || 'Merci !'}</button>
      </div>
    </div>
  </div>`;
}
// Les deux visages partent chacun de son côté, glissent l'un vers l'autre et se touchent ; le cœur naît à leur rencontre.
// --sens suit le sens de lecture (en arabe, le premier visage est à droite).
const CSS_FETE_MATCH = `
.fm-duo { --sens: 1; position: relative; display: flex; align-items: center; justify-content: center; padding-block: .3rem .55rem; margin-block-end: .15rem; }
[dir="rtl"] .fm-duo { --sens: -1; }
.fm-v { position: relative; display: block; border-radius: 50%; box-shadow: 0 0 0 4px var(--surface), 0 10px 24px -10px rgb(10 20 40 / .45); }
.fm-a { z-index: 1; margin-inline-end: -12px; } .fm-b { margin-inline-start: -12px; }
.fm-v .avatar { display: grid; }
.fm-coeur { position: absolute; z-index: 2; inset-block-end: -2px; inset-inline-start: 50%; translate: calc(-50% * var(--sens)) 0; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%;
  background: var(--surface); color: var(--em-o); box-shadow: 0 6px 16px -6px rgb(243 146 0 / .6), inset 0 0 0 2px color-mix(in srgb, var(--em-o) 28%, transparent); }
@media (prefers-reduced-motion: no-preference) {
  .fm-a { animation: fm-a .62s cubic-bezier(.2, .85, .25, 1) .12s backwards; }
  .fm-b { animation: fm-b .62s cubic-bezier(.2, .85, .25, 1) .12s backwards; }
  .fm-coeur { animation: fm-coeur .5s cubic-bezier(.3, 1.5, .5, 1) .62s backwards; }
  .fm-coeur::after { content: ""; position: absolute; inset: 0; border-radius: 50%; box-shadow: 0 0 0 2px var(--em-o); opacity: 0; animation: fm-onde .7s ease-out .8s 1; }
}
@keyframes fm-a { from { opacity: 0; transform: translateX(calc(-46px * var(--sens))) rotate(calc(-8deg * var(--sens))); } 60% { opacity: 1; } }
@keyframes fm-b { from { opacity: 0; transform: translateX(calc(46px * var(--sens))) rotate(calc(8deg * var(--sens))); } 60% { opacity: 1; } }
@keyframes fm-coeur { from { opacity: 0; transform: scale(.2); } }
@keyframes fm-onde { from { opacity: .7; transform: scale(1); } to { opacity: 0; transform: scale(1.7); } }
.fete-cite { margin: .2rem 0 .1rem; padding: .8rem .95rem .7rem; inline-size: 100%; border-radius: var(--r-lg); background: color-mix(in srgb, var(--em-o) 9%, var(--surface)); text-align: start; }
.fete .fete-cite p { margin: 0; max-width: none; color: var(--ink); font-size: var(--fs-4); line-height: 1.5; overflow-wrap: anywhere; white-space: pre-line; }
.fete-cite footer { display: flex; align-items: center; gap: .45rem; margin-block-start: .55rem; color: var(--ink-2); font-size: var(--fs-2); }
.fete-merci .fete-ico { color: var(--em-o); }
`;

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
// Les points d'impact en petite pastille après la phrase : la personne d'abord, les points ensuite ; jamais pour un étudiant
export const Pastille = ({ n }) => (n > 0 && rangsVisibles ? html`<span class="pastille-pts">${`+${n} points`}</span>` : null);

// Qui est ce membre, en une ligne : « 5A · Génie Industriel », « Promo 2019 · Capgemini », « Équipe du réseau »
// (le compte qui anime le réseau n'est jamais « Administration », qu'on confondrait avec celle de l'école)
// sansEntreprise : l'entreprise est déjà écrite juste à côté (annuaire, fiche), on ne la répète pas
export function roleTexte(p, sansEntreprise = false) {
  if (!p) return '';
  if (p.role === 'etudiant') return `${NIVEAUX[niveauOf(p, seasonOf())]?.short || ''} · ${p.filiere}`;
  if (p.role === 'admin') return 'Équipe du réseau';
  return `Promo ${p.promo}${p.entreprise && !sansEntreprise ? ' · ' + p.entreprise : ''}`;
}

// Le bouclier « vérifié » se met juste après le nom (Bouclier), plus dans cette ligne
export function RoleLine({ p, score, sansEntreprise }) {
  if (!p) return null;
  return html`<span class="role-line">${roleTexte(p, sansEntreprise)}
    ${p.role === 'laureat' && score && rangsVisibles ? html` <${LevelChip} points=${score.points}/>` : null}
    ${p.role === 'laureat' && score && !rangsVisibles && aides(score) ? html` <span class="mini aide-chip"><${Icon} name="heart" size=${11}/> ${aides(score) > 1 ? `A aidé ${aides(score)} étudiants` : 'A aidé 1 étudiant'}</span>` : null}</span>`;
}

const aides = s => (s?.recrutes || 0) + (s?.mentorats || 0);

export function Person({ p, score, onOpen, size = 36, sub, sansEntreprise }) {
  return html`<button class="person" onClick=${() => onOpen?.(p)} type="button">
    <${Avatar} p=${p} size=${size}/>
    <span class="person-txt"><span class="person-l1">${p?.full_name ? html`<span class="person-name" translate="no" dir="auto">${p.full_name}</span>` : html`<span class="person-name">Membre</span>`}<${Bouclier} p=${p}/></span>${sub !== undefined ? html`<span class="role-line">${sub}</span>` : html`<${RoleLine} p=${p} score=${score} sansEntreprise=${sansEntreprise}/>`}</span>
  </button>`;
}

// Bouclier « vérifié », teal, 16 px, juste après le nom. La vérification est réelle (store.js, schema.sql) :
// un lauréat est sur la liste officielle de sa promo, ou confirmé par deux lauréats vérifiés de la même promo ;
// un étudiant s'est inscrit avec l'e-mail de l'école, ou est sur la liste officielle de sa promo ; ou l'équipe du réseau l'a vérifié.
// Ce n'est ni un niveau ni un badge. Dans une ligne qui est déjà un bouton, c'est une image ; sur la fiche (explique),
// un appui ou Entrée ouvre l'explication, Échap ou un appui ailleurs la ferme.
export const estVerifie = p => !!p?.verified && (p.role === 'laureat' || p.role === 'etudiant');
export const sensVerifie = p => (p?.role === 'etudiant'
  ? 'Inscription confirmée : e-mail de l’école, nom sur la liste officielle de sa promo, ou confirmation par l’équipe du réseau.'
  : 'Diplôme confirmé : nom sur la liste officielle de sa promo, confirmation par deux lauréats vérifiés de la même promo, ou par l’équipe du réseau.');
let nVerif = 0;
export function Bouclier({ p, explique = false }) {
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef();
  const id = useRef('');
  if (!id.current) id.current = 'verif-' + (++nVerif);
  useEffect(() => {
    if (!ouvert) return;
    const ailleurs = e => { if (!boite.current?.contains(e.target)) setOuvert(false); };
    document.addEventListener('pointerdown', ailleurs);
    return () => document.removeEventListener('pointerdown', ailleurs);
  }, [ouvert]);
  if (!estVerifie(p)) return null;
  if (!explique) return html`<span class="verif" role="img" aria-label="Profil vérifié" title="Profil vérifié"><${Icon} name="shield" size=${16}/></span>`;
  return html`<span class="verif-boite" ref=${boite}>
    <button type="button" class="verif verif-btn" aria-expanded=${ouvert} aria-controls=${id.current} aria-label="Profil vérifié : ce que ça veut dire"
      onClick=${() => setOuvert(!ouvert)} onKeyDown=${e => { if (e.key === 'Escape' && ouvert) { e.stopPropagation(); setOuvert(false); } }}><${Icon} name="shield" size=${16}/></button>
    <span class="verif-pop" id=${id.current} role="note" hidden=${!ouvert}><strong>Profil vérifié</strong><span>${sensVerifie(p)}</span></span>
  </span>`;
}

// Emblèmes des badges : un dessin propre à chacun, au même trait que les icônes (24 × 24, 1,75 px)
const EMBLEMES = {
  fondateur: '<path d="M6 21V4"/><path d="M6 4.5h11l-2.4 3.75L17 12H6"/>',
  verifie: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  premier: '<path d="M7 11v9H4v-9z"/><path d="M7 11l3.6-6.4a1.6 1.6 0 0 1 2.9 1.1L13 10h5.3a2 2 0 0 1 2 2.4l-1.3 6A2 2 0 0 1 17 20H7"/>',
  recruteur: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2"/><path d="M8.5 13.5l2.3 2.3 4.7-4.6"/>',
  faiseur: '<path d="M3 20h5v-5h5v-5h5V5h3"/><path d="M15 5h3v3"/>',
  passeport: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="11" r="3.5"/><path d="M8.5 11h7M12 7.5c1.2 1 1.2 6 0 7M9 17.5h6"/>',
  mentor: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  reactif: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M10 2.5h4M19 5.5l1.5 1.5"/>',
  sage: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.2h5.2c0-.9.4-1.7 1-2.2A6 6 0 0 0 12 3z"/>',
  aime: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  top: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M10 17h4"/>',
  ambassadeur: '<path d="M4 10.5v3a1 1 0 0 0 1 1h2.5L13 19V5L7.5 9.5H5a1 1 0 0 0-1 1z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>',
  mois: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M12 11.6l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z"/>',
};
export function Embleme({ id, size = 20 }) {
  return html`<svg class=${'ico embleme em-' + id} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: EMBLEMES[id] || EMBLEMES.premier }}></svg>`;
}

export function Bar({ value, pace, label }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return html`<div class="bar" role="img" aria-label=${label || `${Math.round(v * 100)}%`}>
    <span class="bar-fill" style=${`width:${v * 100}%`}></span>
    ${pace !== undefined ? html`<span class="bar-pace" style=${`inset-inline-start:${Math.max(0, Math.min(1, pace)) * 100}%`} title="Rythme attendu à cette date"></span>` : null}
  </div>`;
}

// Lot mouvement · B : en changeant d'onglet, le trait (ou la pastille) glisse de l'ancien onglet au nouveau, et seul le
// contenu glisse, dans le sens du changement (inversé en arabe). Un seul écouteur pour toutes les rangées : Tabs, .seg
// (aussi les choix d'un formulaire, sans contenu qui glisse) et les puces de PucesNav. Mouvement réduit : rien ne glisse.
const RANGEES = '.tabs, .seg, .puces-nav';
const actifDans = l => [...l.children].find(b => b.matches('.on, [aria-selected="true"]'));
const boite = (l, el) => (l.classList.contains('tabs') ? { x: el.offsetLeft, y: el.offsetTop + el.offsetHeight - 2, w: el.offsetWidth, h: 2 } : { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
function glisserTrait(l, a, b) {
  clearTimeout(l._trait);
  const poser = r => { for (const [k, v] of [['--tx', r.x], ['--ty', r.y], ['--tw', r.w], ['--th', r.h]]) l.style.setProperty(k, v + 'px'); };
  poser(a);
  l.classList.add('trait-vol', 'trait-pose');
  getComputedStyle(l, '::after').transform;   // la pastille part de l'ancien onglet…
  l.classList.remove('trait-pose');
  poser(b);                                    // …et glisse jusqu'au nouveau
  l._trait = setTimeout(() => { l.classList.remove('trait-vol'); for (const k of ['--tx', '--ty', '--tw', '--th']) l.style.removeProperty(k); }, 420);
}
function glisserContenu(l, sens) {
  let hote = l;
  for (let k = 0; k < 3 && !hote.nextElementSibling && hote.parentElement && !hote.parentElement.matches('main, .page, .modal-body, body'); k++) hote = hote.parentElement;
  let n = 0;
  for (let el = hote.nextElementSibling; el && n < 6; el = el.nextElementSibling) {
    if (el.matches('.modal-back, .fete-back, .toast-zone, script, style') || getComputedStyle(el).position === 'fixed') continue;
    n++;
    el.animate?.([{ opacity: .2, transform: `translate3d(${sens * 28}px, 0, 0)` }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  }
}
function suivreOnglet(e) {
  const b = e.target.closest?.('button, [role="tab"]'), l = b?.parentElement;
  if (!l || !l.matches(RANGEES) || b.disabled || mouvementReduit()) return;
  const avant = actifDans(l);
  if (!avant || avant === b) return;
  const depart = boite(l, avant), iAvant = [...l.children].indexOf(avant);
  const onglets = l.getAttribute('role') === 'tablist' || l.classList.contains('tabs');
  let n = 0;
  // Le nouvel onglet s'affiche au rendu suivant (ou après un Retour simulé par l'historique) : on le guette quelques images
  const guetter = () => {
    if (!l.isConnected) return;
    const apres = actifDans(l);
    if (!apres || apres === avant) { if (++n < 30) requestAnimationFrame(guetter); return; }
    glisserTrait(l, depart, boite(l, apres));
    if (onglets) glisserContenu(l, ([...l.children].indexOf(apres) > iAvant ? 1 : -1) * (getComputedStyle(l).direction === 'rtl' ? -1 : 1));
  };
  requestAnimationFrame(guetter);
}
if (typeof document !== 'undefined') {
  document.addEventListener('click', suivreOnglet, true);
  // iPhone : sans un écouteur de toucher, :active (l'enfoncement sous le doigt) ne s'affiche pas
  document.addEventListener('touchstart', () => {}, { passive: true });
}

export function Tabs({ tabs, value, onChange }) {
  return html`<div class="tabs" role="tablist">${tabs.map(([k, l, c]) => html`<button role="tab" aria-selected=${value === k} class=${'tab' + (value === k ? ' on' : '')} onClick=${() => onChange(k)}>${l}${c ? html` <span class="count">${c}</span>` : null}</button>`)}</div>`;
}

// La fenêtre reste ouverte (bouton occupé) tant que l'action n'est pas finie : pas de double envoi
export function Confirm({ text, onYes, onClose, yes = 'Confirmer', non = 'Annuler', cls = 'btn danger' }) {
  return html`<${Modal} title="Confirmation" onClose=${onClose}><p>${text}</p><div class="row-end"><button class="btn ghost" onClick=${onClose}>${non}</button><button class=${cls} onClick=${async () => { try { await onYes(); } finally { onClose(); } }}>${yes}</button></div><//>`;
}

export function useLocal(key, init) {
  const [v, setV] = useState(() => { try { const x = localStorage.getItem(key); return x == null ? init : JSON.parse(x); } catch { return init; } });
  const set = x => { setV(x); try { localStorage.setItem(key, JSON.stringify(x)); } catch { /* pas de stockage */ } };
  return [v, set];
}

// Ce qui est en train d'être écrit (message, demande, offre, question…) : gardé sur l'appareil à chaque frappe, il revient
// après un rechargement ou une session expirée, pour ce compte seulement (cle commence par l'id du membre ; null : pas
// de brouillon). Gardé 14 jours ; oublier() une fois envoyé. S'utilise comme useState : [valeur, changer, oublier].
// La clé peut changer sans que l'écran soit refait (passer d'une question à une autre) : le brouillon de la nouvelle clé
// est alors relu avant toute écriture, jamais celui de l'ancienne recopié dessous. imposer : des champs qui passent
// par-dessus un brouillon d'objet (ex. le public choisi en ouvrant le formulaire).
const lireBrouillonObjet = (k, d, imposer) => {
  try {
    const x = k && JSON.parse(localStorage.getItem(k) || 'null');
    if (x && Date.now() - x.t < 14 * 864e5) return d && typeof d === 'object' && !Array.isArray(d) ? { ...d, ...x.v, ...imposer } : x.v;
  } catch { /* stockage indisponible */ }
  return d;
};
// Gardé tout de suite, à chaque frappe (pas après l'affichage) : un rechargement ou un téléphone qui coupe l'onglet juste
// après n'emporte rien ; un texte vide ou revenu à son état de départ n'est pas un brouillon.
const garderBrouillon = (k, v, d) => {
  try {
    if (v === '' || JSON.stringify(v) === JSON.stringify(d)) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify({ t: Date.now(), v }));
  } catch { /* stockage plein ou indisponible : le brouillon reste à l'écran */ }
};
export function useBrouillon(cle, init, imposer) {
  const k = cle ? PREFIXE_BROUILLON + cle : null;
  const etat = useRef(null), parti = useRef(false);
  if (!etat.current || etat.current.k !== k) {
    const d = typeof init === 'function' ? init() : init;
    etat.current = { k, d, v: lireBrouillonObjet(k, d, imposer) };
    parti.current = false;
  }
  const [, rendre] = useState(0);
  const changer = useRef(x => {
    const e = etat.current, v = typeof x === 'function' ? x(e.v) : x;
    if (v === e.v) return;
    etat.current = { ...e, v };
    if (e.k) { if (parti.current) parti.current = false; else garderBrouillon(e.k, v, e.d); } // envoyé : le champ vidé n'est pas un brouillon
    rendre(n => n + 1);
  }).current;
  // À l'ouverture (ou quand la clé change) : le brouillon relu est gardé de nouveau (il repart pour 14 jours)
  useEffect(() => { const e = etat.current; if (e.k) garderBrouillon(e.k, e.v, e.d); }, [k]);
  const oublier = () => { parti.current = true; oublierBrouillon(cle); };
  return [etat.current.v, changer, oublier];
}
export function oublierBrouillon(cle) { try { if (cle) localStorage.removeItem(PREFIXE_BROUILLON + cle); } catch { /* */ } }
// Lu et écrit tout de suite, même par un écran qui n'est plus affiché (un envoi qui échoue après une session perdue)
export function lireBrouillon(cle, init) {
  try { const x = JSON.parse(localStorage.getItem(PREFIXE_BROUILLON + cle) || 'null'); if (x && Date.now() - x.t < 14 * 864e5) return x.v; } catch { /* */ }
  return init;
}
export function ecrireBrouillon(cle, v) {
  try { if (v == null || v === '' || (Array.isArray(v) && !v.length)) localStorage.removeItem(PREFIXE_BROUILLON + cle); else localStorage.setItem(PREFIXE_BROUILLON + cle, JSON.stringify({ t: Date.now(), v })); } catch { /* */ }
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

// Logo d'entreprise : le vrai logo (gardé sur le site, img/logos/) sur une petite tuile blanche arrondie avec un filet,
// sinon un monogramme sur une teinte douce, stable pour un même nom (sigle entier, villes et « Groupe » ignorés)
// Logos en longueur (un mot écrit) : moins de marge, pour qu'ils restent lisibles à 40 px
const LOGOS_LARGES = /\/(airbus|safran)\.png$/;
export function CompanyLogo({ name = '', size = 44 }) {
  const src = logoEntreprise(name);
  const [rate, setRate] = useState(false);
  if (src && !rate) return html`<span class=${'clogo c-img' + (LOGOS_LARGES.test(src) ? ' c-large' : '')} style=${`width:${size}px;height:${size}px`} aria-hidden="true"><img src=${src} alt="" width=${size} height=${size} onError=${() => setRate(true)}/></span>`;
  const ini = monogramme(name);
  const n = [...ini].length;
  return html`<span class="clogo" style=${`${styleTeinte(teinteDe(name))};width:${size}px;height:${size}px;font-size:${Math.max(12, Math.round(size * [0.42, 0.42, 0.36, 0.3, 0.26][Math.min(n, 4)]))}px`} aria-hidden="true">${ini}</span>`;
}
// La phrase discrète sous une liste où paraissent de vrais logos
export const MentionLogos = ({ noms = [] }) => (noms.some(n => logoEntreprise(n)) ? html`<p class="mention-logos">Logos affichés pour reconnaître les entreprises, sans aucun partenariat.</p>` : null);


// Partage sur WhatsApp : un texte et le lien direct vers la page (offre, question), pour les groupes de promo.
// Partagé depuis l'interface arabe, le lien s'ouvre en arabe chez qui n'a pas encore choisi sa langue.
export const lienDirect = hash => avecLangue(location.origin + location.pathname, getLang()) + '#' + hash;
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
