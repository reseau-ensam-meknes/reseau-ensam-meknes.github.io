// Génère les images de l'application installée, à partir du site construit (dist/, en démo : données fictives) :
//  - src/pwa/demarrage/iphone-<largeur>x<hauteur>-<densité>x.png : l'écran de démarrage de l'iPhone
//    (apple-touch-startup-image), le logo au centre sur le bleu nuit de l'application, un par taille d'écran ;
//    build.sh en tire les balises de la page (largeur, hauteur et densité sont dans le nom du fichier) ;
//  - src/pwa/captures/telephone.jpg (1080 × 1920) et ordinateur.jpg (1920 × 1080) : les captures du manifeste,
//    montrées par Android et Chrome au moment d'installer ;
//  - src/pwa/captures/accueil-fr.jpg et accueil-ar.jpg : l'accueil dans le téléphone de la fiche « Installer
//    l'application » (installer.js).
// Lancer depuis le dossier source, puis reconstruire :
//   sh build.sh && node outils/generer-demarrage.mjs && sh build.sh
// Playwright vient des tests (cd tests && npm ci) ; PLAYWRIGHT_BROWSERS_PATH si son navigateur est ailleurs.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const { chromium } = createRequire(new URL('../tests/package.json', import.meta.url))('playwright');
const ici = p => new URL('../' + p, import.meta.url).pathname;
const DIST = ici('dist');
if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/ introuvable : lance d’abord sh build.sh');

// Les écrans d'iPhone (largeur et hauteur en points, densité), du plus ancien au plus récent
const ECRANS = [
  [320, 568, 2], // iPhone SE (1re génération) : 640 × 1136
  [375, 667, 2], // iPhone SE (2e et 3e), 6, 7, 8 : 750 × 1334
  [414, 896, 2], // iPhone XR, 11 : 828 × 1792
  [375, 812, 3], // iPhone X, XS, 11 Pro, 12 mini, 13 mini : 1125 × 2436
  [414, 896, 3], // iPhone XS Max, 11 Pro Max : 1242 × 2688
  [390, 844, 3], // iPhone 12, 13, 14, 16e : 1170 × 2532
  [428, 926, 3], // iPhone 12 Pro Max, 13 Pro Max, 14 Plus : 1284 × 2778
  [393, 852, 3], // iPhone 14 Pro, 15, 15 Pro, 16 : 1179 × 2556
  [430, 932, 3], // iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus : 1290 × 2796
  [402, 874, 3], // iPhone 16 Pro, 17, 17 Pro : 1206 × 2622
  [420, 912, 3], // iPhone Air : 1260 × 2736
  [440, 956, 3], // iPhone 16 Pro Max, 17 Pro Max : 1320 × 2868
];
const NUIT = '#0B1320';
const MAX_DEMARRAGE = 60 * 1024;

const nav = await chromium.launch();

// 1. Écrans de démarrage : le logo (128 points) au centre
const dossierDemarrage = ici('src/pwa/demarrage');
fs.rmSync(dossierDemarrage, { recursive: true, force: true });
fs.mkdirSync(dossierDemarrage, { recursive: true });
const logo = 'data:image/svg+xml;base64,' + fs.readFileSync(ici('src/img/logo-transparent.svg')).toString('base64');
for (const [l, h, d] of ECRANS) {
  const page = await nav.newPage({ viewport: { width: l, height: h }, deviceScaleFactor: d });
  await page.setContent(`<!doctype html><html><body style="margin:0;height:100vh;display:grid;place-items:center;background:${NUIT}"><img src="${logo}" width="128" height="128" alt=""></body></html>`);
  await page.waitForFunction(() => document.images[0].complete);
  const f = path.join(dossierDemarrage, `iphone-${l}x${h}-${d}x.png`);
  await page.screenshot({ path: f });
  const n = fs.statSync(f).size;
  if (n > MAX_DEMARRAGE) throw new Error(`${f} : ${n} octets, plus de 60 Ko`);
  console.log(`${path.basename(f)} : ${l * d} × ${h * d}, ${Math.round(n / 1024)} Ko`);
  await page.close();
}

// 2. Captures de la démo : le site construit, servi comme en ligne (config.js vide : la démo)
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const serveur = http.createServer((q, r) => {
  let u = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  if (u.endsWith('/')) u += 'index.html';
  if (u === '/config.js') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end("window.ENSAM_CONFIG = { supabaseUrl: '', supabaseAnonKey: '' };"); }
  const f = path.join(DIST, path.normalize(u));
  if (!f.startsWith(DIST)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b); });
});
await new Promise(ok => serveur.listen(0, '127.0.0.1', ok));
const adresse = `http://127.0.0.1:${serveur.address().port}/`;
const dossierCaptures = ici('src/pwa/captures');
fs.mkdirSync(dossierCaptures, { recursive: true });

// L'accueil de Salma (étudiante de la démo), au calme : ni pastille ni message passager
async function accueil({ largeur, hauteur, densite, langue = 'fr' }) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: densite, colorScheme: 'light', reducedMotion: 'reduce', serviceWorkers: 'block', locale: langue === 'ar' ? 'ar-MA' : 'fr-FR' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto(adresse); await page.waitForSelector('.hello');
  await page.evaluate(l => { localStorage.clear(); localStorage.setItem('ensam-lang', l); }, langue);
  await page.reload(); await page.waitForSelector('.hello');
  const salma = (await page.$$eval('#persona option', os => os.map(o => [o.value, o.textContent]))).find(([, t]) => t.includes('Salma'));
  await page.selectOption('#persona', salma[0]);
  await page.waitForTimeout(600);
  await page.addStyleTag({ content: '.pastille, .toaster, .toast, .modal-back { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; }' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return { ctx, page };
}
async function capture(nom, o, clip) {
  const { ctx, page } = await accueil(o);
  const f = path.join(dossierCaptures, nom);
  await page.screenshot({ path: f, type: 'jpeg', quality: o.qualite || 70, ...(clip ? { clip } : {}) });
  console.log(`${nom} : ${Math.round(fs.statSync(f).size / 1024)} Ko`);
  await ctx.close();
}
// Les captures du manifeste, assez nettes pour la fenêtre d'installation et légères (le dépôt les garde deux fois)
await capture('telephone.jpg', { largeur: 360, hauteur: 640, densite: 3 });
await capture('ordinateur.jpg', { largeur: 1280, hauteur: 720, densite: 1.5 });
for (const langue of ['fr', 'ar']) await capture(`accueil-${langue}.jpg`, { largeur: 390, hauteur: 844, densite: 1, langue, qualite: 78 }, { x: 0, y: 0, width: 390, height: 600 });

await nav.close();
serveur.close();
