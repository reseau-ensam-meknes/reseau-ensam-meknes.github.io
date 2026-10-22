// CV en PDF lu dans le navigateur : le texte est extrait par pdf.js (chargé seulement à ce moment-là),
// puis analysé comme un profil LinkedIn (nom, rôle, promo, filière, poste, compétences…), plus le téléphone et l'email.
// Rien n'est envoyé : la lecture se fait sur l'appareil du membre.
import { parseLinkedin } from './parse-linkedin.js';

let pdfjs = null;
async function chargerPdfjs() {
  if (!pdfjs) {
    pdfjs = await import('./vendor/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
  }
  return pdfjs;
}

// Texte du PDF, ligne par ligne (3 premières pages : un CV tient rarement sur plus)
export async function texteDuPdf(source) {
  const { getDocument } = await chargerPdfjs();
  const data = source instanceof ArrayBuffer ? new Uint8Array(source) : new Uint8Array(await source.arrayBuffer());
  const doc = await getDocument({ data, isEvalSupported: false }).promise;
  const lignes = [];
  try {
    for (let i = 1; i <= Math.min(doc.numPages, 3); i++) {
      const { items } = await (await doc.getPage(i)).getTextContent();
      let cur = '', y = null;
      for (const it of items) {
        const yy = Math.round(it.transform?.[5] ?? 0);
        if (y !== null && Math.abs(yy - y) > 2 && cur.trim()) { lignes.push(cur); cur = ''; }
        cur += (cur && !cur.endsWith(' ') && it.str && !it.str.startsWith(' ') ? ' ' : '') + it.str;
        y = yy;
        if (it.hasEOL) { lignes.push(cur); cur = ''; y = null; }
      }
      if (cur.trim()) lignes.push(cur);
    }
  } finally { doc.destroy(); }
  return lignes.map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

// Analyse du texte d'un CV : ce que parseLinkedin trouve, plus les coordonnées
export function analyserCV(texte, now = new Date()) {
  const r = parseLinkedin(texte, now);
  const email = String(texte).match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
  if (email) r.email = email[0].toLowerCase();
  const tel = String(texte).match(/(?:\+|00)212[\s.-]?\(?0?\)?[\s.-]?[5-7](?:[\s.-]?\d){8}|\b0[5-7](?:[\s.-]?\d){8}\b/);
  if (tel) r.telephone = tel[0].replace(/[^\d+]/g, '').replace(/^00/, '+').replace(/^\+2120/, '+212');
  return r;
}

export async function lireCV(file, now = new Date()) {
  const texte = await texteDuPdf(file);
  if (texte.replace(/\s/g, '').length < 40) throw new Error('Ce PDF ne contient pas de texte lisible (CV scanné en image ?). Remplis ton profil à la main.');
  return analyserCV(texte, now);
}
