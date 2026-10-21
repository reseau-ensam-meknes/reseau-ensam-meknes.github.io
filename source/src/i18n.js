// Version arabe : le texte français de l'interface sert de clé. Un crochet Preact traduit le texte
// des éléments au moment du rendu, ce qui évite de toucher chaque écran. Les contenus écrits par
// les membres (offres, messages, noms) restent tels quels.
import { options } from './vendor/preact-htm.js';

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

const KEY = 'ensam-lang';
let lang = 'fr';
try { lang = localStorage.getItem(KEY) === 'ar' ? 'ar' : 'fr'; } catch { /* stockage indisponible */ }

export const getLang = () => lang;
// Passe à l'arabe une fois le dictionnaire chargé (sinon l'écran basculerait à droite encore en français)
export async function setLang(l) {
  const v = l === 'ar' ? 'ar' : 'fr';
  if (v === 'ar') await chargerAR();
  lang = v;
  try { localStorage.setItem(KEY, lang); } catch { /* stockage indisponible */ }
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

// Les noms et titres glissés dans une phrase arabe sont isolés (FSI…PDI) pour que leur ponctuation reste en place.
function isolate(out, groups) {
  for (const g of groups) if (g && /[A-Za-zÀ-ÿ]{2}/.test(g) && out.includes(g)) out = out.replace(g, `\u2068${g}\u2069`);
  return out;
}

// Traductions apportées par un module (ex. cv.js) : addAR({ 'Texte français': 'نص عربي' }, [[/^motif$/, fn]])
const EXTRA = {}; const EXTRA_PATTERNS = [];
export function addAR(dict = {}, patterns = []) { Object.assign(EXTRA, dict); EXTRA_PATTERNS.push(...patterns); memo.clear(); }

function lookup(core) {
  if (EXTRA[core] !== undefined) return EXTRA[core];
  if (AR[core] !== undefined) return AR[core];
  for (const [re, fn] of [...EXTRA_PATTERNS, ...AR_PATTERNS]) { const m = core.match(re); if (m) return isolate(dateFix(typeof fn === 'function' ? fn(...m.slice(1)) : core.replace(re, fn)), m.slice(1)); }
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
    let hit = false, prose = false;
    const out = parts.map(x => {
      const r = x && /[A-Za-zÀ-ÿ]/.test(x) ? lookup(x) ?? composite(x) : null;
      if (r !== null) hit = true; else if (x.split(/\s+/).length > 4) prose = true;
      return r ?? x;
    });
    if (hit && !prose) return out.join(sep); // une phrase écrite par un membre (« Bonjour, j’ai… ») reste telle quelle
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
  if (!m[2] || !/[A-Za-zÀ-ÿ]/.test(m[2]) || /[\u0600-\u06FF]/.test(m[2])) return s; // rien à traduire, ou déjà en arabe
  const t = lookup(m[2]) ?? composite(m[2]);
  if (t === null && !/[a-zà-ÿ]/.test(m[2])) return s; // sigles et initiales (SB, 5A, OCP)
  return t === null ? null : m[1] + t + m[3];
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
      const whole = /[A-Za-zÀ-ÿ]/.test(joined) ? trExact(joined) : joined;
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

const ATTRS = ['placeholder', 'title', 'aria-label'];
const prev = options.vnode;
options.vnode = vnode => {
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
