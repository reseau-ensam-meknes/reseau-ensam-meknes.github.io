// Mesure du premier chargement de la page d'entrée par un visiteur (sans compte, cache vide), comme sur un téléphone en 3G :
// le site construit (dist/) servi compressé (gzip) en HTTP/2, comme GitHub Pages, le faux Supabase derrière /sb
// (même chemin que l'ancien), le réseau bridé par Chromium (CDP : 400 ms d'aller-retour, 50 Ko/s dans chaque sens)
// et un processeur 4 fois plus lent. Rien n'est envoyé ailleurs.
//
//   cd source/tests && PLAYWRIGHT_BROWSERS_PATH=/tmp/pwb node e2e/mesure-entree.mjs [--langue ar] [--duree 30] [--fois 3] [--rapide]
//
// Ce qui est relevé (temps depuis le début de la navigation) :
//  - premier affichage (first-contentful-paint) et plus grand affichage (largest-contentful-paint) ;
//  - formulaire prêt : le formulaire est à l'écran et la tâche qui l'a dessiné est finie (un toucher est traité) ;
//  - page calme : le formulaire est là et plus aucune tâche longue (> 50 ms) pendant 3 s (comme le « TTI » de Lighthouse) ;
//  - requêtes et octets reçus avant « formulaire prêt », avant le départ du magasin (store.js, Supabase : ce que coûte
//    la page d'entrée seule), puis sur toute la durée observée (dont les fichiers JavaScript).
// --rapide : sans bridage (pour vérifier l'outil). Sans openssl, le serveur reste en HTTP/1.1 (signalé).
import http from 'node:http';
import http2 from 'node:http2';
import zlib from 'node:zlib';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fauxSite } from './faux-supabase.mjs';

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const COMPRESSES = /^(text\/|application\/(json|manifest\+json)|image\/svg)/;
const ENTRE_SAUTS = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection', 'host']);

// Le site comme sur GitHub Pages (HTTP/2, gzip, max-age=600) ; /sb/* part vers le faux Supabase
export async function serveurMesure(SITE, options = {}) {
  const faux = await fauxSite(SITE, options);
  const portFaux = new URL(faux.adresse).port;
  let cle = null, cert = null;
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesure-entree-'));
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'cle.pem'), '-out', path.join(dir, 'cert.pem'), '-days', '2', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' });
    cle = fs.readFileSync(path.join(dir, 'cle.pem')); cert = fs.readFileSync(path.join(dir, 'cert.pem'));
  } catch { /* pas d'openssl : HTTP/1.1 */ }
  let adresse = '';
  const repondre = (q, r) => {
    const u = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (u.startsWith('/sb/')) {
      const entetes = Object.fromEntries(Object.entries(q.headers).filter(([k]) => !k.startsWith(':') && !ENTRE_SAUTS.has(k)));
      const p = http.request({ host: '127.0.0.1', port: portFaux, method: q.method, path: q.url, headers: entetes }, rep => {
        r.writeHead(rep.statusCode, Object.fromEntries(Object.entries(rep.headers).filter(([k]) => !ENTRE_SAUTS.has(k))));
        rep.pipe(r);
      });
      p.on('error', () => { r.writeHead(502); r.end(); });
      return q.pipe(p);
    }
    const f = u.endsWith('/') ? u + 'index.html' : u;
    if (f === '/config.js') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(`window.ENSAM_CONFIG = { supabaseUrl: '${adresse}sb', supabaseAnonKey: 'cle' };`); }
    const fichier = path.join(SITE, path.normalize(f));
    if (!fichier.startsWith(SITE)) { r.writeHead(403); return r.end(); }
    fs.readFile(fichier, (e, b) => {
      if (e) { r.writeHead(404); return r.end(); }
      const type = TYPES[path.extname(f)] || 'application/octet-stream';
      const gz = COMPRESSES.test(type) && /gzip/.test(q.headers['accept-encoding'] || '');
      r.writeHead(200, { 'content-type': type, 'cache-control': 'max-age=600', ...(gz ? { 'content-encoding': 'gzip', vary: 'Accept-Encoding' } : {}) });
      r.end(gz ? zlib.gzipSync(b, { level: 6 }) : b);
    });
  };
  const srv = cle ? http2.createSecureServer({ key: cle, cert, allowHTTP1: true }, repondre) : http.createServer(repondre);
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  adresse = `${cle ? 'https' : 'http'}://127.0.0.1:${srv.address().port}/`;
  return { adresse, h2: !!cle, faux, fermer: () => { srv.close(); faux.fermer(); } };
}

// Relevés posés dans la page avant tout script : tâches longues, apparition du formulaire, plus grand affichage
function sondes() {
  const m = window.__mesure = { form: null, longues: [], lcp: 0 };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) m.longues.push([e.startTime, e.startTime + e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch { /* */ }
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch { /* */ }
  const mo = new MutationObserver(() => { if (!m.form && document.querySelector('#entree .entree-form button.btn.primary')) { m.form = performance.now(); mo.disconnect(); } });
  mo.observe(document, { childList: true, subtree: true });
}

// Une visite : { fcp, lcp, pret, calme, avant: { requetes, octets, js }, total: { … }, fin }
export async function mesurerVisite(navigateur, adresse, { langue = 'fr', duree = 30, brider = true, largeur = 390, hauteur = 844, apres } = {}) {
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, ignoreHTTPSErrors: true, serviceWorkers: 'block', locale: langue === 'ar' ? 'ar-MA' : 'fr-FR' });
  await ctx.addInitScript(sondes);
  await ctx.addInitScript(l => { if (!sessionStorage.getItem('__l')) { sessionStorage.setItem('__l', '1'); localStorage.setItem('ensam-lang', l); } }, langue);
  const page = await ctx.newPage();
  const erreurs = []; page.on('pageerror', e => erreurs.push(e.message));
  if (brider) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 50 * 1024, uploadThroughput: 50 * 1024 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await page.goto(adresse, { waitUntil: 'commit' });
  await page.waitForSelector('#entree .entree-form', { timeout: 120e3 });
  if (apres) await apres(page);
  await page.waitForTimeout(duree * 1000);
  const r = await page.evaluate(() => {
    const m = window.__mesure;
    const nav = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource').map(e => ({ nom: e.name.replace(location.origin, ''), debut: e.startTime, fin: e.responseEnd, octets: e.transferSize || 0, type: e.initiatorType }));
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0;
    // Formulaire prêt : la tâche longue en cours quand il est apparu (son dessin) est finie
    const enCours = m.longues.find(([a, b]) => a <= m.form && b >= m.form);
    const pret = enCours ? enCours[1] : m.form;
    // Page calme : 3 s sans tâche longue après le formulaire
    let calme = pret; for (const [a, b] of [...m.longues].sort((x, y) => x[0] - y[0])) { if (b <= calme) continue; if (a - calme >= 3000) break; calme = Math.max(calme, b); }
    return { fcp, lcp: m.lcp, form: m.form, pret, calme, doc: { octets: nav.transferSize, fin: nav.responseEnd }, res };
  });
  await ctx.close();
  const js = x => /\.m?js(\?|$)/.test(x.nom);
  const cumul = l => ({ requetes: l.length + 1, octets: l.reduce((s, x) => s + x.octets, r.doc.octets), js: l.filter(js).length, octetsJs: l.filter(js).reduce((s, x) => s + x.octets, 0) });
  const magasin = Math.min(...r.res.filter(x => /\/(store|vendor\/supabase)\.js$/.test(x.nom)).map(x => x.debut));
  return {
    fcp: Math.round(r.fcp), lcp: Math.round(r.lcp), form: Math.round(r.form), pret: Math.round(r.pret), calme: Math.round(r.calme), magasin: Math.round(magasin),
    avant: cumul(r.res.filter(x => x.fin <= r.pret)),
    avantMagasin: cumul(r.res.filter(x => x.debut < magasin)),
    total: cumul(r.res), fin: Math.round(Math.max(r.doc.fin, ...r.res.map(x => x.fin))),
    fichiers: r.res.map(x => `${Math.round(x.debut)}→${Math.round(x.fin)} ms  ${String(x.octets).padStart(7)} o  ${x.nom}`),
    erreurs,
  };
}

const ko = n => (n / 1024).toFixed(1) + ' Ko';
export function resume(m) {
  return [`premier affichage ${m.fcp} ms · plus grand affichage ${m.lcp} ms · formulaire prêt ${m.pret} ms · page calme ${m.calme} ms`,
    `avant « formulaire prêt » : ${m.avant.requetes} requêtes (${m.avant.js} JS), ${ko(m.avant.octets)} reçus (JS ${ko(m.avant.octetsJs)})`,
    `avant le départ du magasin (${Number.isFinite(m.magasin) ? m.magasin + ' ms' : 'jamais'}) : ${m.avantMagasin.requetes} requêtes (${m.avantMagasin.js} JS), ${ko(m.avantMagasin.octets)} (JS ${ko(m.avantMagasin.octetsJs)})`,
    `sur la durée : ${m.total.requetes} requêtes (${m.total.js} JS), ${ko(m.total.octets)} reçus (JS ${ko(m.total.octetsJs)}), réseau calme à ${m.fin} ms`].join('\n');
}

// En ligne de commande : plusieurs visites, la médiane de chaque mesure
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
  const { chromium } = await import('playwright');
  const SITE = path.resolve(process.env.SITE_DIR || fileURLToPath(new URL('../../dist', import.meta.url)));
  const s = await serveurMesure(SITE);
  const nav = await chromium.launch();
  const fois = Number(arg('fois', 3)), langue = arg('langue', 'fr');
  console.log(`Site : ${SITE} · ${s.h2 ? 'HTTP/2 + gzip' : 'HTTP/1.1 + gzip (sans openssl)'} · ${process.argv.includes('--rapide') ? 'sans bridage' : '400 ms, 50 Ko/s, processeur ×4'} · ${langue} · ${fois} visites`);
  const tous = [];
  for (let i = 0; i < fois; i++) {
    const m = await mesurerVisite(nav, s.adresse, { langue, duree: Number(arg('duree', 30)), brider: !process.argv.includes('--rapide') });
    tous.push(m); console.log(`\nVisite ${i + 1}\n` + resume(m));
    if (process.argv.includes('--detail')) console.log(m.fichiers.join('\n'));
    if (m.erreurs.length) console.log('erreurs :', m.erreurs);
  }
  const med = f => { const v = tous.map(f).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  const cles = o => Object.keys(o);
  const m = { ...Object.fromEntries(['fcp', 'lcp', 'form', 'pret', 'calme', 'magasin', 'fin'].map(k => [k, med(x => x[k])])), ...Object.fromEntries(['avant', 'avantMagasin', 'total'].map(g => [g, Object.fromEntries(cles(tous[0][g]).map(k => [k, med(x => x[g][k])]))])) };
  console.log('\nMédiane\n' + resume(m));
  await nav.close(); s.fermer();
}
