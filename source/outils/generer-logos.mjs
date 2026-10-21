// Génère les images du logo à partir de src/logo.js : src/img (emails, avatar), src/pwa (icônes de
// l'application) et le favicon de src/page.html. Lancer depuis le dossier plateforme-ensam :
//   node outils/generer-logos.mjs            (logo choisi dans src/logo.js)
//   node outils/generer-logos.mjs bab        (un autre dessin)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { LOGO, GLYPHS, SOMBRE, CLAIR, TUILE_DEFS, TUILE } from '../src/logo.js';

const nom = process.argv[2] || LOGO;
const g = GLYPHS[nom];
if (!g) throw new Error(`Logo inconnu : ${nom}`);
const BLANC = '--lg-o:#FFFFFF;--lg-b:#FFFFFF;--lg-k:#FFFFFF;--lg-in:transparent;--lg-cap:#FFFFFF;--lg-cap2:#FFFFFF;--lg-bg:transparent';

// echelle : taille du dessin dans le carré (1 = comme dans la tuile)
const svg = ({ taille = 512, fond, vars, echelle = 1 }) => {
  const t = echelle === 1 ? '' : ` transform="translate(${256 * (1 - echelle)} ${256 * (1 - echelle)}) scale(${echelle})"`;
  const tuile = fond === 'sombre' ? TUILE
    : fond === 'plein' ? '<rect width="512" height="512" fill="url(#lg-tuile)"/>'
    : fond === 'clair' ? '<rect x="4" y="4" width="504" height="504" rx="114" fill="#FFFFFF" stroke="#D7DFE9" stroke-width="8"/>'
    : fond === 'blanc' ? '<rect width="512" height="512" rx="112" fill="#FFFFFF"/>' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 512 512" style="${vars}">${TUILE_DEFS}${tuile}<g${t}>${g}</g></svg>`;
};

const fichiers = {
  'src/img/logo-carre': { fond: 'sombre', vars: SOMBRE },
  'src/img/logo-rond': { fond: 'plein', vars: SOMBRE, echelle: 0.84 },
  'src/img/logo-clair': { fond: 'clair', vars: CLAIR },
  'src/img/logo-transparent': { vars: CLAIR, echelle: 1.18 },
  'src/img/logo-mail': { taille: 104, fond: 'blanc', vars: CLAIR, echelle: 1.06 },
  'src/pwa/icon-512': { fond: 'sombre', vars: SOMBRE },
  'src/pwa/icon-192': { taille: 192, fond: 'sombre', vars: SOMBRE },
  'src/pwa/icon-maskable-512': { fond: 'plein', vars: SOMBRE, echelle: 0.72 },
  'src/pwa/apple-touch-icon': { taille: 180, fond: 'plein', vars: SOMBRE, echelle: 0.8 },
  'src/pwa/badge-96': { taille: 96, vars: BLANC, echelle: 1.1 },
};

const b = await chromium.launch();
const p = await b.newPage();
for (const [chemin, o] of Object.entries(fichiers)) {
  const s = svg(o), taille = o.taille || 512;
  if (chemin.startsWith('src/img/') && !o.taille) fs.writeFileSync(`${chemin}.svg`, s);
  await p.setViewportSize({ width: taille, height: taille });
  await p.setContent(`<html><body style="margin:0;background:transparent">${s}</body></html>`);
  await p.locator('svg').screenshot({ path: `${chemin}.png`, omitBackground: true });
}
await b.close();

// Favicon et logo de l'écran de chargement, intégrés dans la page
const fav = svg({ taille: 64, fond: 'sombre', vars: SOMBRE }).replace(/\s+/g, ' ');
const page = fs.readFileSync('src/page.html', 'utf8');
const lien = `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(fav).replace(/'/g, '%27')}">`;
const boot = `<svg class="brand-logo boot-logo" width="72" height="72" viewBox="0 0 512 512" aria-hidden="true">${TUILE_DEFS}${TUILE}<g class="lg-glyph">${g}</g></svg>`;
fs.writeFileSync('src/page.html', page.replace(/<link rel="icon"[^>]*>/, lien).replace(/<svg class="brand-logo boot-logo".*?<\/svg>/, boot));
console.log(`Logo « ${nom} » : ${Object.keys(fichiers).length} images et le favicon.`);
