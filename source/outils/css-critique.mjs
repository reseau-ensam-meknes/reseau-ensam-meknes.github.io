// Le CSS de la page d'entrée, tiré au build du CSS complet de page.html (outils/precharger.mjs) : jamais une copie écrite à la main.
// On garde, dans le même ordre, chaque règle qui PEUT toucher la page d'entrée : toutes ses classes et tous ses id (hors
// :not(), :is(), :has()… et hors attributs, qu'on suppose possibles) figurent parmi les mots de ses modules et du corps de
// page.html (logo d'attente, forme de l'accueil). Les règles sans classe ni id (html, body, :root et ses jetons, boutons,
// champs…), les @font-face, @property, @page et les @keyframes qu'une règle gardée cite restent aussi. Un doute : on garde.
// Le CSS complet (site.css) arrive ensuite, rangé juste après : il redonne toutes les règles dans leur ordre, après
// celles-ci, et le résultat est exactement celui du CSS complet seul (une règle répétée plus tôt ne change rien).
// Toujours le même résultat pour le même CSS et les mêmes modules (comparé à la racine par la CI).

// Le CSS (sans commentaires : minifier-css.mjs) en instructions de premier niveau : { prelude, corps } ; corps null pour
// « @charset …; ». Les chaînes et les parenthèses sont sautées en entier ({ ; } dedans ne coupent rien).
export function decouper(css) {
  const out = [];
  const sauter = (i, fin) => {
    // Avance jusqu'au premier caractère de « fin » hors chaîne et hors parenthèses
    let p = 0, q = null;
    for (; i < css.length; i++) {
      const c = css[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") q = c;
      else if (c === '(') p++;
      else if (c === ')') p--;
      else if (!p && fin.includes(c)) return i;
    }
    if (q) throw new Error('CSS : chaîne non refermée');
    return i;
  };
  let i = 0;
  while (i < css.length) {
    const j = sauter(i, '{;}');
    const prelude = css.slice(i, j).trim();
    if (j >= css.length || css[j] !== '{') {
      if (css[j] === '}') throw new Error('CSS : accolade fermante en trop');
      if (prelude) out.push({ prelude, corps: null });
      i = j + 1; continue;
    }
    // Le bloc, accolades équilibrées
    let k = j + 1, n = 1;
    while (k < css.length && n) { k = sauter(k, '{}'); if (k >= css.length) break; n += css[k] === '{' ? 1 : -1; k++; }
    if (n) throw new Error('CSS : bloc non refermé');
    out.push({ prelude, corps: css.slice(j + 1, k - 1) });
    i = k;
  }
  return out;
}

// Les mots de textes (modules, balisage) : identifiants de classes et d'id possibles. « ico-${nom} » donne le préfixe « ico- » :
// toute classe qui commence ainsi est possible. Les commentaires des modules ne comptent pas.
export function motsDe(textes) {
  const mots = new Set();
  for (const t of textes) {
    const sans = String(t).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
    for (const m of sans.match(/[A-Za-z_][\w-]*/g) || []) mots.add(m);
  }
  const prefixes = [...mots].filter(m => m.endsWith('-')).sort();
  return nom => mots.has(nom) || prefixes.some(p => nom.startsWith(p));
}

// Un sélecteur sans ses arguments de pseudo-classes (:not(.a), :is(.b, .c), :nth-child(2n of .d)…) ni ses attributs
// ([data-x="a.b"]) : ce qui reste doit être là pour qu'il touche quelque chose
function squelette(sel) {
  let out = '', p = 0, q = null, crochet = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '[') { crochet++; continue; }
    if (c === ']') { crochet--; continue; }
    if (crochet) continue;
    if (c === '(') { p++; continue; }
    if (c === ')') { p--; continue; }
    if (!p) out += c;
  }
  return out;
}
// Les sélecteurs d'une liste (« a, b:is(c, d) » : deux)
export function selecteurs(liste) {
  const out = []; let p = 0, q = null, b = '';
  for (let i = 0; i < liste.length; i++) {
    const c = liste[i];
    if (q) { b += c; if (c === '\\') b += liste[++i] ?? ''; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    if (c === '(' || c === '[') p++;
    if (c === ')' || c === ']') p--;
    if (c === ',' && !p) { out.push(b.trim()); b = ''; } else b += c;
  }
  out.push(b.trim());
  return out.filter(Boolean);
}
export function selecteurPossible(sel, connu) {
  const s = squelette(sel);
  for (const m of s.matchAll(/[.#](-?[_a-zA-Z][\w-]*)/g)) if (!connu(m[1])) return false;
  return true;
}

const OPAQUES = /^@(font-face|page|property|counter-style|font-feature-values|font-palette-values|view-transition)\b/i;
const IMBRIQUES = /^@(media|supports|container|layer|document|scope|starting-style)\b/i;
const IMAGES = /^@(-webkit-|-moz-)?keyframes\s+/i;

// Le CSS critique : les instructions gardées, dans leur ordre, chacune recopiée telle quelle
export function cssCritique(css, connu) {
  const trier = blocs => {
    const out = [];
    for (const b of blocs) {
      if (b.corps === null) out.push({ txt: b.prelude + ';' });
      else if (IMAGES.test(b.prelude)) out.push({ images: b.prelude.replace(IMAGES, '').trim(), txt: `${b.prelude}{${b.corps}}` });
      else if (OPAQUES.test(b.prelude)) out.push({ txt: `${b.prelude}{${b.corps}}` });
      else if (IMBRIQUES.test(b.prelude)) { const dedans = trier(decouper(b.corps)); if (dedans.length) out.push({ bloc: b.prelude, dedans }); }
      else if (b.prelude.startsWith('@')) out.push({ txt: `${b.prelude}{${b.corps}}` });
      else {
        // Une liste qui a un sélecteur préfixé (::-webkit-…, :-moz-…) : un navigateur qui n'en connaît qu'un ignore la
        // règle entière ; raccourcie, elle pourrait s'appliquer chez lui. Elle reste donc telle quelle, ou part entière.
        const tous = selecteurs(b.prelude), gardes = tous.filter(s => selecteurPossible(s, connu));
        if (gardes.length) out.push({ txt: `${tous.some(s => /:-[a-z]/i.test(s)) ? b.prelude : gardes.join(',')}{${b.corps}}` });
      }
    }
    return out;
  };
  const arbre = trier(decouper(css));
  const ecrire = (l, garderImages) => l.map(x => {
    if (!x.bloc) return x.images && !garderImages(x.images) ? '' : x.txt;
    const dedans = ecrire(x.dedans, garderImages);
    return dedans ? `${x.bloc}{${dedans}}` : '';
  }).join('');
  // Les @keyframes que cite une règle gardée (animation, animation-name), même si elle est dans un @media
  const sans = ecrire(arbre, () => false);
  const cites = new Set();
  for (const m of sans.matchAll(/animation(?:-name)?\s*:([^;}]*)/g)) for (const n of m[1].match(/[A-Za-z_][\w-]*/g) || []) cites.add(n);
  return ecrire(arbre, n => cites.has(n));
}
