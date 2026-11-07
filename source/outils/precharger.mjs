// Après build.sh : chargement plus rapide en 3G pour le site en ligne (dist/).
//  1. Précharge en parallèle les modules de la page d'entrée (au lieu de les découvrir niveau par
//     niveau, un aller-retour réseau à chaque fois), et donne à la page la liste du magasin et de l'application.
//  2. Donne au service worker une version et la liste des fichiers à garder : l'application
//     s'ouvre ensuite depuis le téléphone, sans attendre le réseau, puis se met à jour en arrière-plan.
//  3. Le CSS : page.html le garde en entier, avec ses commentaires. Le site en ligne ne met dans la page que ce que la
//     page d'entrée (et la forme de l'accueil d'un membre) peut utiliser, tiré automatiquement du CSS complet
//     (outils/css-critique.mjs) ; le CSS complet, raccourci (outils/minifier-css.mjs), part dans site.css, que l'application
//     attend avant son premier affichage (entree.js, chargerCss). En 3G, la page d'entrée s'affiche bien plus tôt.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { minifierCss } from './minifier-css.mjs';
import { cssCritique, motsDe } from './css-critique.mjs';
const dist = path.resolve(process.argv[2] || 'dist');
const lire = f => fs.readFileSync(path.join(dist, f), 'utf8');

// Graphe des imports statiques d'un module (les import() dynamiques restent à la demande), dans l'ordre de découverte
function graphe(depart) {
  const vus = new Set();
  (function parcourir(f) {
    if (vus.has(f)) return; vus.add(f);
    for (const m of lire(f).matchAll(/^\s*(?:import|export)\s[^'"]*?from\s*['"](\.\/[^'"]+)['"]/gm)) parcourir(path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])));
  })(depart);
  return [...vus];
}
const dynamiques = f => [...lire(f).matchAll(/\bimport\(\s*['"](\.\/[^'"]+)['"]\s*\)/g)].map(m => path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])));
// Trois temps : la page d'entrée (préchargée dans <head>), le magasin (Supabase), puis le reste de l'application.
// Un membre déjà connecté précharge les deux derniers dès <head> (script de tête de page.html).
const entree = graphe('entree.js');
const magasin = ['vendor/supabase.js', ...graphe('store.js').filter(f => !entree.includes(f))];
// Ce que la page d'entrée charge elle-même, après s'être affichée (import()) : l'illustration de l'école (scene.js), les
// membres fondateurs, le dictionnaire arabe ; le magasin et l'application, eux, ont leur propre temps
const ensuite = [...new Set(entree.flatMap(dynamiques))].filter(f => !entree.includes(f) && !magasin.includes(f) && f !== 'app.js' && fs.existsSync(path.join(dist, f))).sort();
// Page d'entrée (et ce qu'elle charge ensuite, sauf le dictionnaire) : ses modules perdent leurs lignes de commentaire (environ
// 5 Ko compressés de moins en 3G). Seules les lignes entières qui commencent par // et hors d'un gabarit `…` (le texte d'une
// page) sont retirées.
for (const f of [...entree.filter(f => !f.startsWith('vendor/')), ...ensuite.filter(f => !/^i18n-/.test(f))]) {
  const lignes = lire(f).split('\n');
  let gabarit = false;
  const gardees = lignes.filter(l => {
    const commentaire = !gabarit && /^\s*\/\/(?!#)/.test(l);
    if (!commentaire && (l.replace(/\\./g, '').match(/`/g) || []).length % 2) gabarit = !gabarit;
    return !commentaire;
  });
  if (gabarit) throw new Error(`précharge : ${f}, gabarit non refermé, retrait des commentaires à vérifier`);
  fs.writeFileSync(path.join(dist, f), gardees.join('\n'));
}
// Un membre déjà connecté précharge avec l'application ce que l'entrée charge ensuite (l'illustration de l'accueil)
const appli0 = graphe('app.js').filter(f => !entree.includes(f) && !magasin.includes(f));
const appli = [...appli0, ...ensuite.filter(f => !appli0.includes(f) && !/^i18n-/.test(f))];
const config = lire('config.js');
const url = (config.match(/supabaseUrl:\s*'(https:[^']+)'/) || [])[1];
const liens = ['<link rel="preload" href="config.js" as="script">', url && `<link rel="preconnect" href="${new URL(url).origin}" crossorigin>`, ...entree.map(f => `<link rel="modulepreload" href="${f}">`)].filter(Boolean).join('\n');
const index = path.join(dist, 'index.html');
let html = fs.readFileSync(index, 'utf8');
for (const r of ['<!--PRECHARGE-->', '/*MAGASIN*/[]', '/*MODULES*/[]', "/*CSS*/''"]) if (!html.includes(r)) throw new Error(`index.html : repère ${r} introuvable`);

// CSS : deux <style> dans <head> (les polices, puis tout le site) ; le second devient celui de l'entrée, le complet part
// dans site.css (son adresse porte une empreinte : jamais un CSS d'une autre version gardé par le navigateur)
const fin = html.indexOf('</head>');
const styles = [...html.slice(0, fin).matchAll(/<style>([\s\S]*?)<\/style>/g)];
if (styles.length !== 2 || /<style[\s>]/.test(html.slice(fin))) throw new Error('index.html : deux <style> attendus dans <head> (polices, puis site), aucun ailleurs');
const complet = minifierCss(styles[1][1]);
// Les mots de la page d'entrée : ses modules, ce qu'elle charge ensuite, et le corps de la page (logo d'attente, forme de l'accueil)
const connu = motsDe([...entree, ...ensuite].filter(f => !f.startsWith('vendor/')).map(lire).concat(html.slice(fin)));
const critique = cssCritique(complet, connu);
fs.writeFileSync(path.join(dist, 'site.css'), complet + '\n');
const cssSite = `site.css?v=${crypto.createHash('sha256').update(complet).digest('hex').slice(0, 10)}`;
html = html.slice(0, styles[0].index) + `<style>${minifierCss(styles[0][1])}</style>` + html.slice(styles[0].index + styles[0][0].length, styles[1].index)
  + `<style id="css-entree">${critique}</style>` + html.slice(styles[1].index + styles[1][0].length);
html = html.replace('<!--PRECHARGE-->', liens).replace('/*MAGASIN*/[]', JSON.stringify(magasin)).replace('/*MODULES*/[]', JSON.stringify(appli)).replace("/*CSS*/''", `'${cssSite}'`);
fs.writeFileSync(index, html);

// Fichiers gardés par le service worker (la carte Leaflet, le lecteur de PDF et les grandes images restent à la demande ;
// les pages d'aperçu des promos aussi : le service worker les remplace par l'application ; les écrans de démarrage de
// l'iPhone et les captures de l'application, que l'iPhone ou le navigateur demandent eux-mêmes, aussi)
const tous = [];
(function lister(d) { for (const e of fs.readdirSync(path.join(dist, d), { withFileTypes: true })) { const r = d ? `${d}/${e.name}` : e.name; if (e.isDirectory()) lister(r); else tous.push(r); } })('');
// L'arabe (dictionnaire et police) n'est téléchargé que par qui le choisit : le service worker ne le garde d'avance
// que si la version précédente l'avait déjà (FACULTATIFS) ; sinon il le garde au premier usage.
const facultatifs = tous.filter(f => /^i18n-ar\.js$|^polices\/arabe-/.test(f)).sort();
const garder = tous.filter(f => f !== 'sw.js' && !facultatifs.includes(f) && !/^vendor\/(?:leaflet|pdf)\.|^img\/|^promo\/|^pwa\/(?:demarrage|captures)\/|-512\.png$|apple-touch-icon|^seed|^config\.example|\.txt$/.test(f)).sort();
const version = crypto.createHash('sha256').update(tous.filter(f => f !== 'sw.js').sort().map(f => f + '\0' + fs.readFileSync(path.join(dist, f), 'latin1')).join('\0')).digest('hex').slice(0, 12);
const sw = path.join(dist, 'sw.js');
const code = fs.readFileSync(sw, 'utf8').replace("/*VERSION*/'dev'", `'${version}'`).replace('/*FICHIERS*/[]', JSON.stringify(['./', ...garder.filter(f => f !== 'index.html')])).replace('/*FACULTATIFS*/[]', JSON.stringify(facultatifs));
if (!code.includes(`'${version}'`) || code.includes('/*FACULTATIFS*/')) throw new Error('sw.js : repère de version ou des fichiers facultatifs introuvable');
fs.writeFileSync(sw, code);
const ko = n => Math.round(n / 1024) + ' Ko';
console.log(`précharge : entrée ${entree.length} (+ ${ensuite.length} ensuite) · magasin ${magasin.length} · application ${appli.length} modules · CSS ${ko(critique.length)} dans la page, ${ko(complet.length)} dans site.css · service worker ${version} · ${garder.length} fichiers`);
