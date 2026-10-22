// Lire un CV en PDF dans le navigateur : le texte (pdf.js, chargé seulement à ce moment-là), puis le profil qu'il décrit.
// Sert à l'inscription (tout se remplit depuis le CV) et au contrôle des profils (le CV contredit-il le rôle ou la promo ?).
import { parseLinkedin } from './parse-linkedin.js';
import { proximiteFiliere, filieresPour, niveauOf, seasonOf } from './logic.js';

let pdfjs = null;
const chargerPdf = () => (pdfjs ||= import('./vendor/pdf.min.mjs').then(m => {
  m.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
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
