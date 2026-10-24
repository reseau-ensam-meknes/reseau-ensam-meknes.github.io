// Version arabe : le texte français de l'interface sert de clé. Un crochet Preact traduit le texte
// des éléments au moment du rendu, ce qui évite de toucher chaque écran. Les contenus écrits par
// les membres (offres, messages, noms) restent tels quels.
import { options } from './vendor/preact-htm.js';
import { langueDuLien } from './regles-entree.js';

// Le dictionnaire arabe (le plus gros fichier du site) n'est chargé que pour l'arabe : plus rapide en 3G
let AR = {}; let AR_PATTERNS = []; let arPret = null;
export function chargerAR() {
  return arPret ||= import('./i18n-ar.js').then(m => { AR = m.AR; AR_PATTERNS = m.AR_PATTERNS; memo.clear(); }, e => { arPret = null; throw e; });
}

// Accord des noms avec les nombres en arabe : 1, 2, 3 à 10, 11 et plus
export function arCount(n, [one, two, few, many]) {
  n = +n;
  if (n === 0) return `0 ${many}`;
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

const KEY = 'ensam-lang', VISITE = 'ensam-lang-visite';
let lang = 'fr';
// Le choix gardé (bouton de langue) ; sinon la langue d'un lien ouvert pendant cette visite (lien arabe d'une promo,
// d'une offre, d'une question… : ?lang=ar), gardée pour les rechargements de cette visite seulement
let choix = null, visite = null;
try { choix = localStorage.getItem(KEY); } catch { /* stockage indisponible */ }
const duLien = typeof location !== 'undefined' ? langueDuLien(location.search, choix) : null;
try { if (duLien) sessionStorage.setItem(VISITE, duLien); visite = sessionStorage.getItem(VISITE); } catch { /* stockage indisponible */ }
lang = choix === 'ar' || (!choix && (duLien || visite) === 'ar') ? 'ar' : 'fr';

export const getLang = () => lang;
// Passe à l'arabe une fois le dictionnaire chargé (sinon l'écran basculerait à droite encore en français).
// attendre: false (page d'entrée, dont les phrases arabes sont déjà là) : tout de suite, le dictionnaire suit en fond.
// garder: false : seulement pour cette visite (la langue d'un lien), jamais comme un choix du visiteur
export async function setLang(l, { attendre = true, garder = true } = {}) {
  const v = l === 'ar' ? 'ar' : 'fr';
  if (v === 'ar') { if (attendre) await chargerAR(); else chargerAR().catch(() => {}); }
  lang = v;
  try { if (garder) localStorage.setItem(KEY, lang); else sessionStorage.setItem(VISITE, lang); } catch { /* stockage indisponible */ }
  applyDir();
}
function applyDir() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}
applyDir();

const MONTHS = { janvier: 'يناير', février: 'فبراير', mars: 'مارس', avril: 'أبريل', mai: 'ماي', juin: 'يونيو', juillet: 'يوليوز', août: 'غشت', septembre: 'شتنبر', octobre: 'أكتوبر', novembre: 'نونبر', décembre: 'دجنبر' };
const SHORT_MONTHS = { 'janv': 'يناير', 'févr': 'فبراير', 'mars': 'مارس', 'avr': 'أبريل', 'mai': 'ماي', 'juin': 'يونيو', 'juil': 'يوليوز', 'août': 'غشت', 'sept': 'شتنبر', 'oct': 'أكتوبر', 'nov': 'نونبر', 'déc': 'دجنبر' };
const PLURAL_BITS = new Set(['s', 'e', 'x', 'es', '(e)', '(s)']);

export const missing = new Set(); // textes non traduits, pour compléter le dictionnaire
if (typeof window !== 'undefined') window.__ensamMissing = missing;

const dateFix = s => s.replace(/\b(\d{1,2}) (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/g, (_, j, mo) => `${j} ${MONTHS[mo]}`);

// Nombres qui doivent se lire pareil en arabe et en français : « 93% », « +258 », « 2026-2027 ».
// Dans une phrase arabe, l'algorithme bidi retournerait le signe, le % ou la plage d'années : on les isole de gauche à droite (LRI…PDI).
const NOMBRES = /[+\u2212]?\d+(?:[.,]\d+)?\s?%|[+\u2212]\d+(?:[.,]\d+)?|\d{4}\s?[-–]\s?\d{4}/g;
export function nombresLTR(s) {
  if (typeof s !== 'string' || !/\d/.test(s)) return s;
  return s.replace(NOMBRES, (m, i) => (s[i - 1] === '\u2066' ? m : `\u2066${m.replace(/\s?%$/, '%').replace(/\s?[-–]\s?/, '-')}\u2069`));
}

// Les noms et titres glissés dans une phrase arabe sont isolés (FSI…PDI) pour que leur ponctuation reste en place.
// Chacun une seule fois, à chaque endroit où il paraît : un motif qui capture deux fois le même prénom, ou un nom déjà
// isolé, ne donne jamais deux isolants de suite (le nom pouvait disparaître à l'écran).
const echapper = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function isolate(out, groups) {
  const gs = [...new Set(groups.filter(g => g && /[A-Za-zÀ-ÿ]{2}/.test(g) && out.includes(g)))].sort((a, b) => b.length - a.length);
  if (!gs.length) return out;
  return out.replace(new RegExp(gs.map(echapper).join('|'), 'g'), (m, i, s) => (/[\u2066-\u2068]/.test(s[i - 1] || '') && s[i + m.length] === '\u2069' ? m : `\u2068${m}\u2069`));
}

// Traductions apportées par un module (ex. cv.js) : addAR({ 'Texte français': 'نص عربي' }, [[/^motif$/, fn]])
const EXTRA = {}; const EXTRA_PATTERNS = [];
export function addAR(dict = {}, patterns = []) { Object.assign(EXTRA, dict); EXTRA_PATTERNS.push(...patterns); memo.clear(); }

// Les noms de repli (« Un lauréat » quand le profil n'existe plus) : un motif qui les prend pour un nom les traduit
const REPLIS = new Set(['Un lauréat', 'Un membre', 'Un étudiant']);
const nomRepli = x => (x && REPLIS.has(x) ? EXTRA[x] ?? AR[x] ?? x : x);

function lookup(core) {
  if (EXTRA[core] !== undefined) return EXTRA[core];
  if (AR[core] !== undefined) return AR[core];
  for (const [re, fn] of [...EXTRA_PATTERNS, ...AR_PATTERNS]) {
    const m = core.match(re); if (!m) continue;
    const g = m.slice(1).map(nomRepli);
    return isolate(dateFix(typeof fn === 'function' ? fn(...g) : core.replace(re, fn)), g);
  }
  const d = dateFix(core);
  if (d !== core && !/[a-zà-ÿ]/i.test(d)) return d;
  if (MONTHS[core] || SHORT_MONTHS[core.replace('.', '')]) return MONTHS[core] || SHORT_MONTHS[core.replace('.', '')];
  return null;
}

// Texte composé (« Génie Mécanique · Promo 2021 ») : on traduit chaque morceau et on garde le reste.
function composite(core) {
  for (const [re, sep] of [[/\s*·\s*/, ' · '], [/,\s+/, '، ']]) {
    const parts = core.split(re);
    if (parts.length < 2) continue;
    let hit = false, prose = false; const reste = [];
    const out = parts.map(x => {
      const r = x && /[A-Za-zÀ-ÿ]/.test(x) ? lookup(x) ?? composite(x) : null;
      if (r !== null) hit = true; else if (x.split(/\s+/).length > 4) prose = true; else if (/[a-zà-ÿ]/.test(x)) reste.push(x.trim());
      return r ?? x;
    });
    if (hit && !prose) { for (const x of reste) missing.add(x); return out.join(sep); } // un morceau resté en français est signalé (window.__ensamMissing) ; une phrase écrite par un membre (« Bonjour, j’ai… ») reste telle quelle
  }
  return null;
}

// Traduit une chaîne en gardant ses espaces de début et de fin ; null si inconnue.
// htm est configuré sans cache des parties statiques (vendor/preact-htm.js), pour que ce crochet
// repasse sur tout le texte à chaque rendu et que la bascule de langue s'applique partout.
const memo = new Map();
function trExact(s) {
  if (memo.has(s)) return memo.get(s);
  const r = trCore(s);
  memo.set(s, r);
  return r;
}
function trCore(s) {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  if (!m[2] || !/[A-Za-zÀ-ÿ]/.test(m[2]) || /[\u0600-\u06FF]/.test(m[2])) return nombresLTR(s); // rien à traduire, ou déjà en arabe
  const t = lookup(m[2]) ?? composite(m[2]);
  if (t === null && !/[a-zà-ÿ]/.test(m[2])) return nombresLTR(s); // sigles et initiales (SB, 5A, OCP)
  return t === null ? null : m[1] + nombresLTR(t) + m[3];
}

let foreign = false; // l'élément en cours contient un texte non traduit (contenu écrit par un membre)
export function t(s) {
  if (lang !== 'ar' || typeof s !== 'string') return s;
  const r = trExact(s);
  if (r === null) { missing.add(s.trim()); foreign = true; return dateFix(s); } // texte inconnu : au moins les dates en arabe
  return r;
}

// Traduit une suite d'enfants : d'abord la phrase entière (ex. « 3 recrutés grâce à toi »),
// sinon morceau par morceau.
function trChildren(ch) {
  if (typeof ch === 'string') return t(ch);
  if (!Array.isArray(ch)) return ch;
  const out = []; let run = [];
  const flush = () => {
    if (!run.length) return;
    if (run.some(x => typeof x === 'string')) {
      const joined = run.join('');
      const whole = /[A-Za-zÀ-ÿ]/.test(joined) ? trExact(joined) : nombresLTR(joined);
      if (whole !== null) out.push(whole);
      else for (const x of run) {
        if (typeof x !== 'string') out.push(x);
        else if (PLURAL_BITS.has(x)) continue;
        else out.push(t(x));
      }
    } else out.push(...run);
    run = [];
  };
  for (const x of ch) {
    if (typeof x === 'string' || typeof x === 'number') run.push(x);
    else { flush(); out.push(Array.isArray(x) ? trChildren(x) : x); }
  }
  flush();
  return out;
}

const ATTRS = ['placeholder', 'title', 'aria-label', 'label']; // label : titres des groupes d'options (optgroup)
const SAISIE_LIBRE = new Set([undefined, 'text', 'search']);
const prev = options.vnode;
options.vnode = vnode => {
  // Ce qu'on tape suit sa langue, ponctuation comprise (« Tu es dispo ? » en arabe comme « مرحبا! » en français)
  if ((vnode.type === 'textarea' || vnode.type === 'input' && SAISIE_LIBRE.has(vnode.props?.type)) && vnode.props && vnode.props.dir === undefined) vnode.props.dir = 'auto';
  // translate="no" : texte libre d'un membre (ex. sa disponibilité), laissé tel quel
  if (lang === 'ar' && typeof vnode.type === 'string' && vnode.props && vnode.props.translate !== 'no') {
    const p = vnode.props;
    foreign = false;
    if (p.children !== undefined && p.children !== null && typeof p.children !== 'object' || Array.isArray(p.children)) p.children = trChildren(p.children);
    // Texte d'un membre (souvent en français) : sens de lecture selon son contenu, pour garder la ponctuation à sa place.
    if (foreign && p.dir === undefined) p.dir = 'auto';
    for (const a of ATTRS) if (typeof p[a] === 'string') p[a] = t(p[a]);
  }
  if (prev) prev(vnode);
};
