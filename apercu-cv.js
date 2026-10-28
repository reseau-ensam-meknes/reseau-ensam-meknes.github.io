// Le CV d'un étudiant dans Match : la première page en grand sur sa carte, puis la lecture page par page dans une
// fenêtre, avec « Plus tard » et « Intéressé » au pied. Le lauréat choisit en connaissant le parcours, pas un visage.
// pdf.js (lire-cv.js) n'arrive qu'au premier CV montré ; un CV déjà vu ne se télécharge ni ne se redessine.
import { html, useState, useEffect, useRef } from './vendor/preact-htm.js';
import { Icon, Modal } from './ui.js';
import { OuvrirCV } from './cv.js';
import { addAR } from './i18n.js';

let lecture = null;
const lireCv = () => (lecture ||= import('./lire-cv.js').catch(e => { lecture = null; throw e; }));

// Les CV ouverts (6 au plus) et les pages déjà dessinées (24 au plus) ; le plus ancien part le premier
const PDFS = new Map(), IMAGES = new Map();
function garder(m, k, v, max, oublier) {
  m.set(k, v);
  while (m.size > max) { const [k0, v0] = m.entries().next().value; m.delete(k0); v0.then(oublier, () => {}); }
  return v;
}
function pdfDe(store, path) {
  if (PDFS.has(path)) return PDFS.get(path);
  const p = (async () => {
    const lien = await store.lienCV(path);
    const r = await fetch(lien);
    if (!r.ok) throw new Error('CV introuvable');
    const pdf = await (await lireCv()).ouvrirPdf(await r.arrayBuffer());
    if (lien.startsWith('blob:')) URL.revokeObjectURL(lien);
    return pdf;
  })();
  p.catch(() => PDFS.delete(path));
  return garder(PDFS, path, p, 6, d => d.fermer());
}
// Une page en image : { url, w, h, pages }. La largeur (pixels de l'écran) va par paliers, pour resservir la même image.
export const palier = px => Math.min(1800, Math.max(480, Math.ceil(px / 160) * 160));
export function imageCV(store, path, n, largeur) {
  const k = `${path}#${n}@${largeur}`;
  if (IMAGES.has(k)) return IMAGES.get(k);
  const p = pdfDe(store, path).then(d => d.image(n, largeur).then(im => ({ ...im, pages: d.pages })));
  p.catch(() => IMAGES.delete(k));
  return garder(IMAGES, k, p, 24, im => URL.revokeObjectURL(im.url));
}
const densite = () => Math.min(2, window.devicePixelRatio || 1);

// L'aperçu sur la carte : le haut de la première page (nom, formation, premières expériences), comme une feuille posée
export function ApercuCV({ store, path, nom, onLire }) {
  const ref = useRef();
  const [im, setIm] = useState(null); const [rate, setRate] = useState(false);
  useEffect(() => {
    let vivant = true;
    setIm(null); setRate(false);
    imageCV(store, path, 1, palier((ref.current?.clientWidth || 360) * densite())).then(x => vivant && setIm(x), () => vivant && setRate(true));
    return () => { vivant = false; };
  }, [path]);
  if (rate) return html`<div class="mx-cv-apercu rate" ref=${ref}>
    <span class="mx-cv-rate"><${Icon} name="file" size=${26}/><span>Aperçu indisponible sur cet appareil</span></span>
    <${OuvrirCV} store=${store} path=${path} label="Ouvrir le CV" cls="btn small ghost"/>
  </div>`;
  return html`<div class=${'mx-cv-apercu' + (im ? ' pret' : '')} ref=${ref} data-lire="">
    ${im ? html`<img src=${im.url} alt=${`Première page du CV de ${nom}`} draggable="false"/>`
      : html`<span class="mx-cv-attente" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>`}
    <span class="mx-cv-bas">
      <span class="mx-cv-etiquette"><${Icon} name="file" size=${14}/> <span>${im ? (im.pages > 1 ? `${im.pages} pages` : '1 page') : 'CV'}</span></span>
      <button type="button" class="mx-cv-lire" onClick=${onLire}><${Icon} name="eye" size=${16}/> Lire le CV</button>
    </span>
  </div>`;
}

// La lecture : toutes les pages (6 au plus), nettes même agrandies ; « Plus tard » et « Intéressé » au pied
export function LecteurCV({ store, p, path, onClose, onChoix }) {
  const ref = useRef();
  const [pages, setPages] = useState([]); const [n, setN] = useState(0); const [rate, setRate] = useState(false);
  const [grand, setGrand] = useState(false);
  useEffect(() => {
    let vivant = true;
    const l = palier(Math.min(980, ref.current?.clientWidth || innerWidth) * densite() * 1.6);
    (async () => {
      const d = await pdfDe(store, path);
      if (!vivant) return;
      setN(d.pages);
      const vues = [];
      for (let i = 1; i <= Math.min(d.pages, 6); i++) {
        vues.push(await imageCV(store, path, i, l));
        if (!vivant) return;
        setPages([...vues]);
      }
    })().catch(() => vivant && setRate(true));
    return () => { vivant = false; };
  }, [path]);
  const pied = onChoix ? html`<div class="mx-lect-choix">
      <button type="button" class="btn ghost" onClick=${() => onChoix('plus_tard')}><${Icon} name="x" size=${18}/> Plus tard</button>
      <button type="button" class="btn primary" onClick=${() => onChoix('oui')}><${Icon} name="check" size=${18}/> Intéressé</button>
    </div>` : null;
  return html`<${Modal} title=${`CV de ${p.full_name}`} onClose=${onClose} wide cls="mx-lecteur" footer=${pied}>
    <div class="mx-lect-barre">
      <span class="small muted">${n ? (n > 1 ? `${n} pages` : '1 page') : 'Chargement du CV…'}${n > 6 ? ' · les 6 premières ici' : ''}</span>
      <span class="mx-lect-outils">
        <button type="button" class="btn tiny ghost" aria-pressed=${grand ? 'true' : 'false'} onClick=${() => setGrand(g => !g)} disabled=${!pages.length}><${Icon} name="search" size=${14}/> ${grand ? 'Taille normale' : 'Agrandir'}</button>
        <${OuvrirCV} store=${store} path=${path} label="PDF" cls="btn tiny ghost"/>
      </span>
    </div>
    <div class=${'mx-lect-pages' + (grand ? ' grand' : '')} ref=${ref}>
      ${rate ? html`<p class="mx-cv-rate"><${Icon} name="file" size=${26}/><span>Ce CV ne s’affiche pas ici. Ouvre le PDF.</span></p>`
        : pages.length ? pages.map((im, i) => html`<img key=${i} class="mx-lect-page" src=${im.url} width=${im.w} height=${im.h} alt=${`Page ${i + 1} sur ${n}`}/>`)
        : html`<span class="mx-lect-attente" aria-hidden="true"></span>`}
    </div>
  <//>`;
}

addAR({
  'Aperçu indisponible sur cet appareil': 'المعاينة غير متاحة على هذا الجهاز', 'Ouvrir le CV': 'فتح السيرة الذاتية', 'Lire le CV': 'قراءة السيرة الذاتية',
  'Chargement du CV…': 'جارٍ تحميل السيرة الذاتية…', '1 page': 'صفحة واحدة',
  'Taille normale': 'الحجم العادي', 'Agrandir': 'تكبير', ' · les 6 premières ici': ' · أول 6 صفحات هنا',
  'Ce CV ne s’affiche pas ici. Ouvre le PDF.': 'لا تظهر هذه السيرة الذاتية هنا. افتح ملف PDF.',
}, [
  [/^Première page du CV de (.+)$/, x => `الصفحة الأولى من السيرة الذاتية لـ${x}`],
  [/^CV de (.+)$/, x => `السيرة الذاتية لـ${x}`],
  [/^(\d+) pages$/, n => `${n} صفحات`],
  [/^Page (\d+) sur (\d+)$/, (a, b) => `الصفحة ${a} من ${b}`],
]);
