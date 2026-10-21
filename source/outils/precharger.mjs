// Après build.sh : chargement plus rapide en 3G pour le site en ligne (dist/).
//  1. Précharge en parallèle tous les modules importés au démarrage (au lieu de les découvrir
//     niveau par niveau, un aller-retour réseau à chaque fois), et Supabase.
//  2. Donne au service worker une version et la liste des fichiers à garder : l'application
//     s'ouvre ensuite depuis le téléphone, sans attendre le réseau, puis se met à jour en arrière-plan.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const dist = path.resolve(process.argv[2] || 'dist');

// Graphe des imports statiques depuis app.js (les import() dynamiques restent à la demande)
const vus = new Set();
function parcourir(f) {
  if (vus.has(f)) return; vus.add(f);
  const src = fs.readFileSync(path.join(dist, f), 'utf8');
  for (const m of src.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s*['"](\.\/[^'"]+)['"]/gm)) parcourir(path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])));
}
parcourir('app.js');
const modules = [...vus].filter(f => f !== 'app.js');
const liens = [...modules.map(f => `<link rel="modulepreload" href="${f}">`), '<link rel="preload" href="vendor/supabase.js" as="script">'].join('\n');
const index = path.join(dist, 'index.html');
let html = fs.readFileSync(index, 'utf8');
if (!html.includes('rel="modulepreload"')) html = html.replace('</head>', liens + '\n</head>');
fs.writeFileSync(index, html);

// Fichiers gardés par le service worker (la carte Leaflet et les grandes images restent à la demande)
const tous = [];
(function lister(d) { for (const e of fs.readdirSync(path.join(dist, d), { withFileTypes: true })) { const r = d ? `${d}/${e.name}` : e.name; if (e.isDirectory()) lister(r); else tous.push(r); } })('');
const garder = tous.filter(f => f !== 'sw.js' && !/^vendor\/leaflet\.|^img\/|-512\.png$|apple-touch-icon|^seed|^config\.example/.test(f)).sort();
const version = crypto.createHash('sha256').update(tous.filter(f => f !== 'sw.js').sort().map(f => f + '\0' + fs.readFileSync(path.join(dist, f), 'latin1')).join('\0')).digest('hex').slice(0, 12);
const sw = path.join(dist, 'sw.js');
const code = fs.readFileSync(sw, 'utf8').replace("/*VERSION*/'dev'", `'${version}'`).replace('/*FICHIERS*/[]', JSON.stringify(['./', ...garder.filter(f => f !== 'index.html')]));
if (!code.includes(`'${version}'`)) throw new Error('sw.js : repère de version introuvable');
fs.writeFileSync(sw, code);
console.log(`précharge : ${modules.length} modules · service worker ${version} · ${garder.length} fichiers`);
