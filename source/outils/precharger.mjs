// Après build.sh : chargement plus rapide en 3G pour le site en ligne (dist/).
//  1. Précharge en parallèle les modules de la page d'entrée (au lieu de les découvrir niveau par
//     niveau, un aller-retour réseau à chaque fois), et donne à la page la liste du magasin et de l'application.
//  2. Donne au service worker une version et la liste des fichiers à garder : l'application
//     s'ouvre ensuite depuis le téléphone, sans attendre le réseau, puis se met à jour en arrière-plan.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const dist = path.resolve(process.argv[2] || 'dist');

// Graphe des imports statiques d'un module (les import() dynamiques restent à la demande), dans l'ordre de découverte
function graphe(depart) {
  const vus = new Set();
  (function parcourir(f) {
    if (vus.has(f)) return; vus.add(f);
    const src = fs.readFileSync(path.join(dist, f), 'utf8');
    for (const m of src.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s*['"](\.\/[^'"]+)['"]/gm)) parcourir(path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])));
  })(depart);
  return [...vus];
}
// Trois temps : la page d'entrée (préchargée dans <head>), le magasin (Supabase), puis le reste de l'application.
// Un membre déjà connecté précharge les deux derniers dès <head> (script de tête de page.html).
const entree = graphe('entree.js');
const magasin = ['vendor/supabase.js', ...graphe('store.js').filter(f => !entree.includes(f))];
const appli = graphe('app.js').filter(f => !entree.includes(f) && !magasin.includes(f));
const config = fs.readFileSync(path.join(dist, 'config.js'), 'utf8');
const url = (config.match(/supabaseUrl:\s*'(https:[^']+)'/) || [])[1];
const liens = ['<link rel="preload" href="config.js" as="script">', url && `<link rel="preconnect" href="${new URL(url).origin}" crossorigin>`, ...entree.map(f => `<link rel="modulepreload" href="${f}">`)].filter(Boolean).join('\n');
const index = path.join(dist, 'index.html');
let html = fs.readFileSync(index, 'utf8');
for (const r of ['<!--PRECHARGE-->', '/*MAGASIN*/[]', '/*MODULES*/[]']) if (!html.includes(r)) throw new Error(`index.html : repère ${r} introuvable`);
html = html.replace('<!--PRECHARGE-->', liens).replace('/*MAGASIN*/[]', JSON.stringify(magasin)).replace('/*MODULES*/[]', JSON.stringify(appli));
fs.writeFileSync(index, html);

// Fichiers gardés par le service worker (la carte Leaflet, le lecteur de PDF et les grandes images restent à la demande ;
// les pages d'aperçu des promos aussi : le service worker les remplace par l'application)
const tous = [];
(function lister(d) { for (const e of fs.readdirSync(path.join(dist, d), { withFileTypes: true })) { const r = d ? `${d}/${e.name}` : e.name; if (e.isDirectory()) lister(r); else tous.push(r); } })('');
const garder = tous.filter(f => f !== 'sw.js' && !/^vendor\/(?:leaflet|pdf)\.|^img\/|^promo\/|-512\.png$|apple-touch-icon|^seed|^config\.example/.test(f)).sort();
const version = crypto.createHash('sha256').update(tous.filter(f => f !== 'sw.js').sort().map(f => f + '\0' + fs.readFileSync(path.join(dist, f), 'latin1')).join('\0')).digest('hex').slice(0, 12);
const sw = path.join(dist, 'sw.js');
const code = fs.readFileSync(sw, 'utf8').replace("/*VERSION*/'dev'", `'${version}'`).replace('/*FICHIERS*/[]', JSON.stringify(['./', ...garder.filter(f => f !== 'index.html')]));
if (!code.includes(`'${version}'`)) throw new Error('sw.js : repère de version introuvable');
fs.writeFileSync(sw, code);
console.log(`précharge : entrée ${entree.length} · magasin ${magasin.length} · application ${appli.length} modules · service worker ${version} · ${garder.length} fichiers`);
