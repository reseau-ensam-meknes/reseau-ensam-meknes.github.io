// Lire un CV en PDF dans le navigateur : le texte (pdf.js, chargé seulement à ce moment-là), puis le profil qu'il décrit.
// Sert à l'inscription (tout se remplit depuis le CV) et au contrôle des profils (le CV contredit-il le rôle ou la promo ?).
import { parseLinkedin } from './parse-linkedin.js';
import { proximiteFiliere, filieresPour, niveauOf, seasonOf } from './logic.js';

let pdfjs = null;
const chargerPdf = () => (pdfjs ||= import('./vendor/pdf.min.mjs').then(m => {
  m.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
  return m;
}).catch(e => { pdfjs = null; throw e; }));

// Texte des trois premières pages, ligne par ligne (les morceaux d'une même ligne sont recollés d'après leur position)
export async function texteDuCV(source) {
  const lib = await chargerPdf();
  const data = new Uint8Array(source instanceof ArrayBuffer ? source : await source.arrayBuffer());
  const tache = lib.getDocument({ data, isEvalSupported: false });
  const lignes = [];
  try {
    const doc = await tache.promise;
    for (let n = 1; n <= Math.min(doc.numPages, 3); n++) {
      const { items } = await (await doc.getPage(n)).getTextContent();
      let ligne = '', y = null, fin = null;
      for (const it of items) {
        if (typeof it.str !== 'string') continue;
        const [, , , , x, yy] = it.transform, h = it.height || 10;
        if (y !== null && Math.abs(yy - y) > h * 0.6) { lignes.push(ligne); ligne = ''; fin = null; }
        if (ligne && fin !== null && x - fin > h * 0.15 && !/\s$/.test(ligne) && !/^\s/.test(it.str)) ligne += ' ';
        ligne += it.str; y = yy; fin = x + (it.width || 0);
        if (it.hasEOL) { lignes.push(ligne); ligne = ''; y = null; fin = null; }
      }
      if (ligne) lignes.push(ligne);
    }
  } finally { tache.destroy(); }
  return lignes.map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

// Le profil décrit par un CV ; {} si le PDF n'a pas de texte (CV scanné en image)
export async function lireCV(source, now = new Date()) {
  const texte = await texteDuCV(source);
  return texte.length < 40 ? {} : parseLinkedin(texte, now);
}

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
