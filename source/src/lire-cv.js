// Lire un CV en PDF dans le navigateur : le texte (pdf.js, chargé seulement à ce moment-là), puis le profil qu'il décrit.
// Sert à l'inscription (tout se remplit depuis le CV) et au contrôle des profils (le CV contredit-il le rôle ou la promo ?).
import { parseLinkedin } from './parse-linkedin.js';
import { proximiteFiliere, filieresPour, niveauOf, seasonOf } from './logic.js';

let pdfjs = null;
const chargerPdf = () => (pdfjs ||= import('./pdf-compat.js').then(() => import('./vendor/pdf.min.mjs')).then(m => {
  m.GlobalWorkerOptions.workerSrc = new URL('./pdf-worker.js', import.meta.url).href;
  return m;
}).catch(e => { pdfjs = null; throw e; }));

// Les morceaux d'une même ligne, recollés de gauche à droite : beaucoup de CV écrivent la colonne de droite
// (ville, dates) avant celle de gauche. Une ligne en arabe garde l'ordre du PDF.
function recoller(morceaux) {
  const m = morceaux.some(o => /[\u0600-\u06FF]/.test(o.s)) ? morceaux : [...morceaux].sort((a, b) => a.x - b.x);
  let ligne = '', fin = null;
  for (const o of m) {
    if (ligne && fin !== null && o.x - fin > o.h * 0.15 && !/\s$/.test(ligne) && !/^\s/.test(o.s)) ligne += ' ';
    ligne += o.s; fin = o.x + o.w;
  }
  return ligne;
}

// Texte des trois premières pages, ligne par ligne
export async function texteDuCV(source) {
  const lib = await chargerPdf();
  const data = new Uint8Array(source instanceof ArrayBuffer ? source : await source.arrayBuffer());
  const tache = lib.getDocument({ data, isEvalSupported: false });
  const lignes = [];
  try {
    const doc = await tache.promise;
    for (let n = 1; n <= Math.min(doc.numPages, 3); n++) {
      const { items } = await (await doc.getPage(n)).getTextContent();
      let morceaux = [], y = null;
      const finir = () => { if (morceaux.length) lignes.push(recoller(morceaux)); morceaux = []; };
      for (const it of items) {
        if (typeof it.str !== 'string') continue;
        const [, , , , x, yy] = it.transform, h = it.height || 10;
        if (y !== null && Math.abs(yy - y) > h * 0.6) finir();
        morceaux.push({ x, w: it.width || 0, h, s: it.str }); y = yy;
        if (it.hasEOL) { finir(); y = null; }
      }
      finir();
    }
  } finally { tache.destroy(); }
  return lignes.map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Photo d'identité d'un CV : sur la première page, l'image placée en haut, à peu près carrée, assez grande
// mais pas pleine page, qui ne ressemble pas à un logo. Rien ne part du navigateur : le membre choisit ensuite.
// ---------------------------------------------------------------------------
const fois = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
// Où une image est dessinée sur la page (le carré unité transformé), en unités PDF
function placer(m) {
  const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => [m[0] * u + m[2] * v + m[4], m[1] * u + m[3] * v + m[5]]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), lw: Math.max(...xs) - Math.min(...xs), lh: Math.max(...ys) - Math.min(...ys) };
}
// Images d'une page, à partir de la liste des opérations pdf.js : { ref, w, h (pixels), x, y, lw, lh (sur la page) }
export function imagesDeLaPage(ops, OPS) {
  const pile = [], out = []; let m = [1, 0, 0, 1, 0, 0];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], a = ops.argsArray[i] || [];
    if (fn === OPS.save) pile.push(m);
    else if (fn === OPS.restore) m = pile.pop() || m;
    else if (fn === OPS.transform) m = fois(m, Array.from(a));
    else if (fn === OPS.paintFormXObjectBegin) { pile.push(m); if (a[0]?.length === 6) m = fois(m, Array.from(a[0])); }
    else if (fn === OPS.paintFormXObjectEnd) m = pile.pop() || m;
    else if (fn === OPS.paintImageXObject) out.push({ ref: a[0], w: a[1], h: a[2], ...placer(m) });
    else if (fn === OPS.paintInlineImageXObject && a[0]) out.push({ ref: a[0], w: a[0].width, h: a[0].height, ...placer(m) });
  }
  return out;
}
// Les images qui peuvent être une photo de la personne, la plus grande d'abord. view : [x0, y0, x1, y1] de la page.
export function candidatsPhoto(images, view) {
  const pw = view[2] - view[0], ph = view[3] - view[1];
  const carre = r => r >= 0.6 && r <= 1.4;
  return images.filter(i => i.w >= 80 && i.h >= 80 && carre(i.w / i.h) && i.lh > 0 && carre(i.lw / i.lh)
      && i.lw >= pw * 0.06 && i.lw <= pw * 0.55 && (view[3] - (i.y + i.lh)) / ph <= 0.45)
    .sort((a, b) => b.lw * b.lh - a.lw * a.lh);
}
// Pixels RGBA d'une image réduite (48 × 48 par exemple) : une photo a beaucoup de nuances, un logo quelques aplats
export function ressemblePhoto(px) {
  const n = px.length / 4; let transparents = 0, blancs = 0;
  const nuances = new Map(), gris = new Set();  // couleurs à 16 niveaux par canal ; luminosité à 64 niveaux (photo en noir et blanc)
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 200) { transparents++; continue; }
    const r = px[i], g = px[i + 1], b = px[i + 2];
    if (r > 242 && g > 242 && b > 242) blancs++;
    const k = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
    nuances.set(k, (nuances.get(k) || 0) + 1);
    gris.add(Math.round((r * 3 + g * 6 + b) / 10) >> 2);
  }
  const opaques = n - transparents;
  if (!opaques || transparents > n * 0.35 || blancs > opaques * 0.7) return false;
  return (nuances.size >= 24 || gris.size >= 24) && Math.max(...nuances.values()) <= opaques * 0.6;
}

const toile = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// Image pdf.js (déjà décodée) dessinée sur une toile ; null si le format ne peut pas être une photo (noir et blanc 1 bit)
function enToile(d) {
  const w = d?.width, h = d?.height;
  if (!w || !h) return null;
  const c = toile(w, h), g = c.getContext('2d');
  if (d.bitmap) g.drawImage(d.bitmap, 0, 0);
  else if (d.data && (d.kind === 2 || d.kind === 3)) {
    const n = w * h, rgba = new Uint8ClampedArray(n * 4);
    if (d.kind === 3) rgba.set(d.data.subarray(0, n * 4));
    else for (let i = 0; i < n; i++) { rgba[i * 4] = d.data[i * 3]; rgba[i * 4 + 1] = d.data[i * 3 + 1]; rgba[i * 4 + 2] = d.data[i * 3 + 2]; rgba[i * 4 + 3] = 255; }
    g.putImageData(new ImageData(rgba, w, h), 0, 0);
  } else if (typeof d.close === 'function' || d instanceof HTMLImageElement) g.drawImage(d, 0, 0);
  else return null;
  return c;
}
// Une image de la page, une fois décodée par pdf.js (les images partagées entre pages commencent par « g_ »)
const objetImage = (page, ref) => typeof ref !== 'string' ? Promise.resolve(ref) : new Promise(ok => {
  const t = setTimeout(() => ok(null), 4000);
  try { (ref.startsWith('g_') ? page.commonObjs : page.objs).get(ref, d => { clearTimeout(t); ok(d); }); } catch { clearTimeout(t); ok(null); }
});

// La photo trouvée dans le CV (image PNG, pas encore recadrée), ou null
export async function photoDuCV(source) {
  const lib = await chargerPdf();
  const data = new Uint8Array(source instanceof ArrayBuffer ? source : await source.arrayBuffer());
  const tache = lib.getDocument({ data, isEvalSupported: false });
  try {
    const page = await (await tache.promise).getPage(1);
    const ops = await page.getOperatorList();
    for (const c of candidatsPhoto(imagesDeLaPage(ops, lib.OPS), page.view).slice(0, 4)) {
      const t = enToile(await objetImage(page, c.ref));
      if (!t) continue;
      const mini = toile(48, 48), g = mini.getContext('2d');
      g.drawImage(t, 0, 0, 48, 48);
      if (!ressemblePhoto(g.getImageData(0, 0, 48, 48).data)) continue;
      return await new Promise(ok => t.toBlob(ok, 'image/png'));
    }
    return null;
  } finally { tache.destroy(); }
}

// Le profil décrit par un CV ; {} si le PDF n'a pas de texte (CV scanné en image)
export async function lireCVDetail(source, now = new Date()) {
  const texte = await texteDuCV(source);
  return { cv: texte.length < 40 ? {} : parseLinkedin(texte, now), texte };
}
export const lireCV = async (source, now) => (await lireCVDetail(source, now)).cv;

// Pour un signalement : les lignes de formation et de dates qui ont servi à la lecture, sans email ni téléphone
const LIGNE_UTILE = /ensam|arts\s*(?:et|&|and)\s*m[eé]tiers|arts and crafts|formation|education|dipl[oô]me|ing[eé]nieur|engineer|promo|(?:19|20)\d{2}|ann[eé]e|year/i;
export function extraitCV(texte) {
  const out = [];
  for (const l of String(texte || '').split('\n')) {
    if (!LIGNE_UTILE.test(l)) continue;
    const propre = l.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]').replace(/\+?\d[\d .-]{7,}\d/g, m => (/^(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}$/.test(m.trim()) ? m : '[tél]')).trim();
    if (propre && out.join('\n').length + propre.length < 1900) out.push(propre.slice(0, 200));
  }
  return out.slice(0, 16).join('\n');
}

// Ce qu'une proposition change, sans les coordonnées privées : sert à la reconnaître une fois signalée
export const propositionSansCoordonnees = ({ telephone, email, ...e }) => e;
const cle = e => JSON.stringify(Object.keys(propositionSansCoordonnees(e)).sort().map(k => [k, e[k]]));
export const dejaSignalee = (retours, profilId, path, e) => (retours || []).some(r => r.profil_id === profilId && r.cv_path === path && cle(r.proposition || {}) === cle(e));

// Ce que le CV dit autrement que le profil, pour les seuls champs qui décident de ce que le membre voit :
// rôle, promo (sauf promo devinée sans changement de rôle), filière d'un autre parcours.
export function ecartsCV(p, cv, now = new Date()) {
  const e = {};
  if (!p || !cv || p.role === 'admin') return e;
  const role = cv.role || p.role;
  if (cv.role && cv.role !== p.role) e.role = cv.role;
  if (cv.promo && cv.promo !== p.promo && (!cv.promoEstimee || e.role)) e.promo = cv.promo;
  const promo = e.promo || p.promo;
  const permises = filieresPour(role, role === 'etudiant' ? niveauOf({ promo }, seasonOf(now)) : 7).flatMap(g => g.options);
  if (cv.filiere && permises.includes(cv.filiere) && proximiteFiliere(cv.filiere, p.filiere) === 0) e.filiere = cv.filiere;
  return e;
}

// Les champs vides du profil que le CV peut remplir ; le poste et l'entreprise seulement pour un lauréat
// (chez un étudiant, ce sont ses stages).
const COMPLETABLES = ['poste', 'entreprise', 'ville', 'linkedin', 'bio'];
export function complementsCV(p, cv, role = p?.role) {
  const e = {};
  if (!p || !cv || p.role === 'admin') return e;
  const vide = v => !String(v ?? '').trim();
  for (const k of COMPLETABLES) if (cv[k] && vide(p[k]) && (role === 'laureat' || (k !== 'poste' && k !== 'entreprise'))) e[k] = k === 'bio' ? String(cv[k]).slice(0, 600) : cv[k];
  if (cv.competences?.length && !(p.competences || []).length) e.competences = cv.competences.slice(0, 15);
  return e;
}

// Tout ce que le CV propose pour un profil : corrections d'abord, puis champs vides à remplir
export function propositionCV(p, cv, now = new Date()) {
  const e = ecartsCV(p, cv, now);
  return { ...e, ...complementsCV(p, cv, e.role || p?.role) };
}
export const corrigeProfil = e => 'role' in e || 'promo' in e || 'filiere' in e;
