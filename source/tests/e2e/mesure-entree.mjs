// Mesure du premier chargement de la page d'entrée par un visiteur (sans compte, cache vide), comme sur un téléphone en 3G :
// le site construit (dist/) servi compressé (gzip) en HTTP/2, comme GitHub Pages, le faux Supabase derrière /sb (chiffres,
// trois membres fondateurs dont deux avec leur photo), le réseau bridé par Chromium (CDP : 400 ms d'attente par requête,
// 50 Ko/s dans chaque sens) et un processeur 4 fois plus lent. Service worker bloqué (son installation télécharge tout le
// site en arrière-plan, sans bridage : elle fausserait la mesure). Rien n'est envoyé ailleurs.
//
//   cd source/tests && PLAYWRIGHT_BROWSERS_PATH=/tmp/pwb node e2e/mesure-entree.mjs [--site dist/ ...] [--langue ar]
//      [--fois 5] [--duree 30] [--parcours] [--membre] [--rapide] [--detail] [--json resultats.json]
//
// Plusieurs --site (par exemple la version de main construite à part, puis celle-ci) : les visites alternent d'un site à
// l'autre (A, B, A, B…), pour que la charge de la machine pèse pareil sur les deux. Chaque mesure : la médiane des visites.
//
// Ce qui est relevé (temps depuis le début de la navigation) :
//  - premier affichage (first-contentful-paint) et plus grand affichage (largest-contentful-paint) ;
//  - formulaire affiché : le bouton « Recevoir mon code » peint à l'écran (Element Timing) ;
//  - formulaire interactif : affiché, et aucune tâche longue (> 50 ms) en cours : un toucher est traité tout de suite ;
//  - page calme : comme le « TTI » de Lighthouse, la fin de la dernière tâche longue avant 5 s sans aucune ;
//  - temps bloqué (TBT) entre le premier affichage et la page calme ;
//  - polices du formulaire arrivées (document.fonts.ready) et photos des membres fondateurs affichées ;
//  - requêtes parties, terminées, et octets reçus (CDP, au fil de l'eau) avant « formulaire interactif », avant
//    « page calme », et sur toute la durée observée (dont JavaScript).
// --parcours : en plus, un visiteur pressé touche « Je suis à l'école » dès le formulaire interactif, tape son email,
// coche l'accord et touche « Recevoir mon code » : retard des touchers (Event Timing) et attente avant l'écran du code.
// --membre : à la place, un membre déjà connecté (mesurerMembre) : son accueil, au premier passage puis revenu.
import http from 'node:http';
import http2 from 'node:http2';
import zlib from 'node:zlib';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fauxSite, UID } from './faux-supabase.mjs';

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const COMPRESSES = /^(text\/|application\/(json|manifest\+json)|image\/svg)/;
const ENTRE_SAUTS = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection', 'host']);
// Trois fondateurs sur la page d'entrée, deux avec leur photo (une petite image de 11 Ko, comme une photo de profil)
const FONDATEURS = { max: 25, total: 3, places: 22, fondateurs: [
  { rang: 1, type: 'offre', at: '2026-10-23T09:12:00Z', nom: 'Abderrahman Hajeb', filiere: 'Génie Mécanique', promo: 2024, photo: 'a/photo-1.webp', verifie: true },
  { rang: 2, type: 'aide', at: '2026-10-23T11:40:00Z', nom: 'Hamza Sedki', filiere: 'Génie Électromécanique', promo: 2021, photo: 'b/photo-1.webp', verifie: true },
  { rang: 3, type: 'mentorat', at: '2026-10-24T08:05:00Z', nom: 'Salma Idrissi', filiere: 'Génie Industriel', promo: 2019, photo: null, verifie: false }] };

// Le site comme sur GitHub Pages (HTTP/2, gzip, max-age=600) ; /sb/* part vers le faux Supabase
export async function serveurMesure(SITE, options = {}) {
  const photo = fs.readFileSync(fileURLToPath(new URL('../../src/img/logo-mail.png', import.meta.url)));
  const faux = await fauxSite(SITE, { fondateurs: FONDATEURS, photo, ...options });
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

// Relevés posés dans la page avant tout script : tâches longues, apparition et peinture du formulaire, plus grand affichage,
// retard des touchers
function sondes() {
  const m = window.__mesure = { form: null, peint: null, peintSecours: null, longues: [], lcp: 0, touchers: [], polices: null, photos: null };
  const observer = (type, f, o = {}) => { try { new PerformanceObserver(l => { for (const e of l.getEntries()) f(e); }).observe({ type, buffered: true, ...o }); } catch { /* */ } };
  observer('longtask', e => m.longues.push([e.startTime, e.startTime + e.duration]));
  observer('largest-contentful-paint', e => { m.lcp = e.renderTime || e.startTime; });
  observer('element', e => { if (e.identifier === 'formulaire' && !m.peint) m.peint = e.renderTime || e.startTime; });
  observer('event', e => { if (/^(pointerdown|pointerup|click|keydown|keyup|input)$/.test(e.name)) m.touchers.push({ nom: e.name, debut: e.startTime, retard: e.processingStart - e.startTime, duree: e.duration }); }, { durationThreshold: 16 });
  const mo = new MutationObserver(() => {
    const b = document.querySelector('#entree .entree-form button.btn.primary');
    if (!b || m.form) return;
    m.form = performance.now(); b.setAttribute('elementtiming', 'formulaire'); mo.disconnect();
    // Sans Element Timing : la première image dessinée après son apparition
    requestAnimationFrame(() => setTimeout(() => { m.peintSecours = performance.now(); }));
    // Les polices du formulaire (demandées quand il s'affiche), puis les photos des membres fondateurs, arrivées
    document.fonts?.ready.then(() => { m.polices = performance.now(); });
    const t = setInterval(() => {
      const im = [...document.querySelectorAll('.fd-public img')];
      if (im.length && im.every(i => i.complete && i.naturalWidth > 0)) { m.photos = performance.now(); clearInterval(t); }
    }, 50);
  });
  mo.observe(document, { childList: true, subtree: true });
}

// Une visite : temps (ms), requêtes et octets avant chaque étape
export async function mesurerVisite(navigateur, adresse, { langue = 'fr', duree = 30, brider = true, largeur = 390, hauteur = 844, parcours = false } = {}) {
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, ignoreHTTPSErrors: true, serviceWorkers: 'block', locale: langue === 'ar' ? 'ar-MA' : 'fr-FR', hasTouch: true });
  await ctx.addInitScript(sondes);
  await ctx.addInitScript(l => { if (!sessionStorage.getItem('__l')) { sessionStorage.setItem('__l', '1'); localStorage.setItem('ensam-lang', l); } }, langue);
  const page = await ctx.newPage();
  const erreurs = []; page.on('pageerror', e => erreurs.push(e.message));
  // Le réseau vu par Chromium : chaque requête (départ, fin) et chaque morceau reçu (horloge de CDP, en secondes)
  const cdp = await ctx.newCDPSession(page);
  // (sous bridage, Chromium ne compte pas les morceaux reçus : les octets d'une requête sont comptés à sa fin)
  const req = new Map(); let t0 = null;
  cdp.on('Network.requestWillBeSent', e => { if (!req.has(e.requestId)) req.set(e.requestId, { url: e.request.url, debut: e.timestamp, fin: null, octets: 0 }); if (t0 === null && e.type === 'Document') t0 = e.timestamp; });
  cdp.on('Network.loadingFinished', e => { const r = req.get(e.requestId); if (r) { r.fin = e.timestamp; r.octets = e.encodedDataLength; } });
  await cdp.send('Network.enable');
  if (brider) {
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 50 * 1024, uploadThroughput: 50 * 1024 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await page.goto(adresse, { waitUntil: 'commit' });
  await page.waitForSelector('#entree .entree-form button.btn.primary', { timeout: 120e3 });
  let flux = null;
  if (parcours) {
    // Un visiteur pressé : il touche dès que le formulaire répond (peint, plus de tâche longue en cours)
    await page.waitForFunction(() => { const m = window.__mesure; return m.peint || m.peintSecours; }, null, { timeout: 60e3, polling: 50 });
    const debut = await page.evaluate(() => performance.now());
    await page.tap('#au-je-etudiant');
    await page.waitForFunction(() => document.querySelector('#au-je-etudiant')?.getAttribute('aria-pressed') === 'true', null, { polling: 20 });
    const role = await page.evaluate(() => performance.now());
    await page.tap('#au-email');
    await page.keyboard.type('amine.benali@gmail.com', { delay: 90 });
    await page.tap('#au-ok');
    const envoi = await page.evaluate(() => performance.now());
    await page.tap('.entree-form button.btn.primary');
    await page.waitForSelector('#au-code', { timeout: 120e3 });
    const code = await page.evaluate(() => performance.now());
    flux = { debut, role, envoi, code };
  }
  await page.waitForTimeout(duree * 1000);
  const r = await page.evaluate(() => {
    const m = window.__mesure;
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0;
    return { fcp, lcp: m.lcp, form: m.form, peint: m.peint || m.peintSecours, longues: m.longues.sort((a, b) => a[0] - b[0]), touchers: m.touchers, polices: m.polices, photos: m.photos };
  });
  await ctx.close();
  // Formulaire interactif : peint, et la tâche longue en cours (s'il y en a une) finie
  let interactif = r.peint;
  for (const [a, b] of r.longues) if (a <= interactif && b > interactif) interactif = b;
  // Page calme (TTI) : 5 s sans tâche longue après le formulaire interactif
  let calme = interactif;
  for (const [a, b] of r.longues) { if (b <= calme) continue; if (a - calme >= 5000) break; calme = Math.max(calme, b); }
  const tbt = r.longues.filter(([a]) => a >= r.fcp && a < calme).reduce((s, [a, b]) => s + Math.max(0, b - a - 50), 0);
  // Réseau : horloge de CDP ramenée au début de la navigation (requête du document)
  const ms = t => (t - t0) * 1000;
  const liste = [...req.values()].filter(x => !x.url.startsWith('data:')).map(x => ({ ...x, debut: ms(x.debut), fin: x.fin === null ? Infinity : ms(x.fin) }));
  const nom = x => x.url.replace(/^https?:\/\/[^/]+/, '');
  const js = x => !!x && /\.m?js(\?|$)/.test(nom(x));
  const avant = t => {
    const parties = liste.filter(x => x.debut <= t), finies = parties.filter(x => x.fin <= t);
    return { parties: parties.length, finies: finies.length, js: parties.filter(js).length, octets: finies.reduce((s, x) => s + x.octets, 0), octetsJs: finies.filter(js).reduce((s, x) => s + x.octets, 0) };
  };
  const magasin = Math.min(...liste.filter(x => /\/(store|vendor\/supabase)\.js/.test(nom(x))).map(x => x.debut));
  const touchers = r.touchers.filter(t => /^(pointerdown|keydown|click)$/.test(t.nom));
  return {
    fcp: Math.round(r.fcp), lcp: Math.round(r.lcp), form: Math.round(r.form), peint: Math.round(r.peint), interactif: Math.round(interactif), calme: Math.round(calme), tbt: Math.round(tbt), magasin: Math.round(magasin),
    polices: Math.round(r.polices ?? NaN), photos: Math.round(r.photos ?? NaN),
    avantInteractif: avant(interactif), avantCalme: avant(calme), total: avant(Infinity),
    fin: Math.round(Math.max(...liste.map(x => (Number.isFinite(x.fin) ? x.fin : 0)))),
    flux: flux && { attenteRole: Math.round(flux.role - flux.debut), attenteCode: Math.round(flux.code - flux.envoi), retardMax: Math.round(Math.max(0, ...touchers.map(t => t.retard))), dureeMax: Math.round(Math.max(0, ...touchers.map(t => t.duree))) },
    fichiers: liste.sort((a, b) => a.debut - b.debut).map(x => `${String(Math.round(x.debut)).padStart(6)}→${String(Number.isFinite(x.fin) ? Math.round(x.fin) : '…').padStart(6)} ms ${String(x.octets).padStart(8)} o  ${nom(x)}`),
    erreurs,
  };
}

// Un membre déjà connecté (sa session gardée sur l'appareil) : d'abord sans copie de ses données (premier passage sur ce
// téléphone : tout vient du réseau), puis revenu (la copie de l'appareil, écrite 3 s après l'accueil, et les fichiers
// gardés par le navigateur) : temps jusqu'à son accueil dessiné, et requêtes parties avant
const MEMBRE = { id: UID, full_name: 'Salma Test', role: 'etudiant', filiere: 'Génie Industriel', promo: 2028, created_at: '2025-10-01T10:00:00Z', verified: true, consent_at: '2025-10-01T10:00:00Z' };
function sondesMembre() {
  const mo = new MutationObserver(() => { if (!window.__accueil && document.querySelector('.shell:not(.squelette) .home-grid')) { window.__accueil = performance.now(); mo.disconnect(); } });
  mo.observe(document, { childList: true, subtree: true });
}
export async function mesurerMembre(navigateur, serveur, { langue = 'fr', brider = true, largeur = 390, hauteur = 844 } = {}) {
  if (!serveur.faux.inscrits.some(p => p.id === UID)) serveur.faux.inscrits.push({ ...MEMBRE });
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, ignoreHTTPSErrors: true, serviceWorkers: 'block', locale: langue === 'ar' ? 'ar-MA' : 'fr-FR', hasTouch: true });
  await ctx.addInitScript(sondesMembre);
  await ctx.addInitScript(([uid, l]) => {
    if (sessionStorage.getItem('__m')) return; sessionStorage.setItem('__m', '1');
    localStorage.setItem('ensam-lang', l);
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'x.' + btoa(JSON.stringify({ sub: uid, exp: now + 7200 })) + '.y', token_type: 'bearer', expires_in: 7200, expires_at: now + 7200, refresh_token: 'r', user: { id: uid, aud: 'authenticated', email: 'membre@exemple.ma', user_metadata: {}, app_metadata: {} } }));
  }, [UID, langue]);
  const page = await ctx.newPage();
  const erreurs = []; page.on('pageerror', e => erreurs.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  const req = []; let t0 = null;
  cdp.on('Network.requestWillBeSent', e => { if (e.type === 'Document') t0 = e.timestamp; if (t0 !== null) req.push([e.timestamp, e.request.url]); });
  cdp.on('Network.requestServedFromCache', () => {});
  await cdp.send('Network.enable');
  if (brider) {
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 50 * 1024, uploadThroughput: 50 * 1024 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  const visite = async () => {
    req.length = 0; t0 = null;
    await page.goto(serveur.adresse, { waitUntil: 'commit' });
    await page.waitForFunction(() => window.__accueil, null, { timeout: 120e3, polling: 100 });
    const accueil = await page.evaluate(() => window.__accueil);
    const avant = req.filter(([t]) => (t - t0) * 1000 <= accueil);
    return { accueil: Math.round(accueil), requetes: avant.length, base: avant.filter(([, u]) => /\/sb\/rest\//.test(u)).length };
  };
  const premier = await visite();
  await page.waitForTimeout(6000);
  const revenu = await visite();
  await ctx.close();
  return { premier, revenu, erreurs };
}
export const resumeMembre = m => `membre, premier passage : accueil à ${m.premier.accueil} ms (${m.premier.requetes} requêtes avant, dont ${m.premier.base} à la base) · revenu (copie de l’appareil) : accueil à ${m.revenu.accueil} ms (${m.revenu.requetes} requêtes avant)`;

const ko = n => (n / 1024).toFixed(1) + ' Ko';
const ligne = (titre, x) => `${titre} : ${x.parties} requêtes parties (${x.js} JS), ${x.finies} terminées, ${ko(x.octets)} reçus par les terminées (JS ${ko(x.octetsJs)})`;
export function resume(m) {
  return [`premier affichage ${m.fcp} ms · plus grand affichage ${m.lcp} ms · formulaire affiché ${m.peint} ms · interactif ${m.interactif} ms · page calme ${m.calme} ms · TBT ${m.tbt} ms`,
    ligne('avant « formulaire interactif »', m.avantInteractif), ligne('avant « page calme »', m.avantCalme), ligne(`sur la durée (réseau calme à ${m.fin} ms)`, m.total),
    `polices du formulaire arrivées ${Number.isFinite(m.polices) ? m.polices + ' ms' : '?'} · photos des fondateurs affichées ${Number.isFinite(m.photos) ? m.photos + ' ms' : '?'}`,
    `départ du magasin (store.js, supabase.js) : ${Number.isFinite(m.magasin) ? m.magasin + ' ms' : 'jamais'}`,
    ...(m.flux ? [`parcours : rôle choisi ${m.flux.attenteRole} ms après le toucher · écran du code ${m.flux.attenteCode} ms après « Recevoir mon code » · retard max d’un toucher ${m.flux.retardMax} ms (durée max ${m.flux.dureeMax} ms)`] : [])].join('\n');
}
// La médiane de chaque nombre (récursivement), sur plusieurs visites
export function mediane(tous) {
  const med = v => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const fusion = l => (typeof l[0] === 'number' ? med(l) : l[0] && typeof l[0] === 'object' && !Array.isArray(l[0]) ? Object.fromEntries(Object.keys(l[0]).map(k => [k, fusion(l.map(x => x[k]))])) : l[0]);
  return fusion(tous);
}

// En ligne de commande : plusieurs visites par site, en alternance, puis la médiane de chaque mesure
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
  const sites = process.argv.flatMap((a, i) => (a === '--site' ? [path.resolve(process.argv[i + 1])] : []));
  if (!sites.length) sites.push(path.resolve(process.env.SITE_DIR || fileURLToPath(new URL('../../dist', import.meta.url))));
  const { chromium } = await import('playwright');
  const serveurs = [];
  for (const s of sites) serveurs.push(await serveurMesure(s));
  const nav = await chromium.launch();
  const fois = Number(arg('fois', 3)), langue = arg('langue', 'fr'), rapide = process.argv.includes('--rapide');
  console.log(`${serveurs[0].h2 ? 'HTTP/2 + gzip' : 'HTTP/1.1 + gzip (sans openssl)'} · ${rapide ? 'sans bridage' : '400 ms, 50 Ko/s, processeur ×4'} · ${langue} · ${fois} visites par site`);
  const tous = sites.map(() => []), membre = process.argv.includes('--membre'), dire = membre ? resumeMembre : resume;
  for (let i = 0; i < fois; i++) for (const [k, s] of serveurs.entries()) {
    const m = membre ? await mesurerMembre(nav, s, { langue, brider: !rapide })
      : await mesurerVisite(nav, s.adresse, { langue, duree: Number(arg('duree', 30)), brider: !rapide, parcours: process.argv.includes('--parcours') });
    tous[k].push(m); console.log(`\n${sites[k]} · visite ${i + 1}\n` + dire(m));
    if (process.argv.includes('--detail') && m.fichiers) console.log(m.fichiers.join('\n'));
    if (m.erreurs.length) console.log('erreurs :', m.erreurs);
  }
  const sans = l => l.map(({ fichiers, ...x }) => x);
  for (const [k, s] of sites.entries()) console.log(`\nMédiane · ${s}\n` + dire(mediane(sans(tous[k]))));
  if (arg('json')) fs.writeFileSync(arg('json'), JSON.stringify(sites.map((s, k) => ({ site: s, langue, visites: sans(tous[k]), mediane: mediane(sans(tous[k])) })), null, 1));
  await nav.close(); for (const s of serveurs) s.fermer();
}
