// Photo de profil : recadrée en carré et réduite dans le navigateur avant l'envoi (l'original ne part jamais),
// vue par les membres connectés seulement ; sans photo, les initiales restent.
import { html, useState, useRef, useEffect } from './vendor/preact-htm.js';
import { Icon, Avatar, toast, injectCSS } from './ui.js';
import { addAR } from './i18n.js';
import { photoDuCV } from './lire-cv.js';

const COTE = 320;

// Carré centré ; sur une photo en hauteur, un peu vers le haut (le visage y est le plus souvent). WebP, sinon JPEG.
export async function preparerPhoto(file) {
  if (!file || (file.type && !/^image\//.test(file.type))) throw new Error('Choisis une photo (JPEG, PNG ou WebP).');
  if (file.size > 20 * 1024 * 1024) throw new Error('Photo trop lourde (20 Mo au plus).');
  const img = await ouvrir(file);
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, c = Math.min(w, h);
  const cv = document.createElement('canvas'); cv.width = cv.height = COTE;
  const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.fillStyle = '#fff'; g.fillRect(0, 0, COTE, COTE);  // une photo détourée (coins transparents) garde un fond clair
  g.drawImage(img, (w - c) / 2, h > w ? (h - c) * 0.3 : 0, c, c, 0, 0, COTE, COTE);
  img.close?.();
  const webp = await enBlob(cv, 'image/webp');
  return webp?.type === 'image/webp' ? webp : enBlob(cv, 'image/jpeg');
}
const enBlob = (cv, type) => new Promise(ok => cv.toBlob(ok, type, 0.86));
async function ouvrir(file) {
  if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* on essaie autrement */ } }
  return new Promise((ok, ko) => {
    const u = URL.createObjectURL(file); const i = new Image();
    i.onload = () => { URL.revokeObjectURL(u); ok(i); };
    i.onerror = () => { URL.revokeObjectURL(u); ko(new Error('Cette image ne s’ouvre pas. Essaie une photo en JPEG ou PNG.')); };
    i.src = u;
  });
}

// La photo du CV, recadrée et prête à envoyer ; null si le CV n'en a pas (ou ne s'ouvre pas)
export const photoPreteDuCV = source => photoDuCV(source).then(b => (b ? preparerPhoto(b) : null)).catch(() => null);

// « Photo trouvée dans ton CV : l'utiliser ? » : rien n'est publié sans l'accord du membre
export function PhotoTrouvee({ blob, onUse, onOther, onNo, busy }) {
  const [url] = useState(() => URL.createObjectURL(blob));
  useEffect(() => () => URL.revokeObjectURL(url), []);
  return html`<div class="photo-trouvee" role="status" id="photo-cv">
    <img src=${url} alt="" width="64" height="64"/>
    <div class="photo-txt"><strong>Photo trouvée dans ton CV : l’utiliser ?</strong>
      <span class="small muted">Visible par les membres connectés seulement.</span></div>
    <div class="photo-acts"><button type="button" id="photo-cv-oui" class="btn small primary" disabled=${busy} onClick=${onUse}>Utiliser</button>
      ${onOther ? html`<button type="button" class="btn small ghost" disabled=${busy} onClick=${onOther}>Choisir une autre</button>` : null}
      <button type="button" id="photo-cv-non" class="btn small ghost" disabled=${busy} onClick=${onNo}>Non merci</button></div>
  </div>`;
}
// CV déjà regardés sur cet appareil (photo refusée, ou pas de photo dedans) : on ne les relit pas
const VU_CV = 'ensam-photo-cv-vu';
const cvVus = () => { try { return JSON.parse(localStorage.getItem(VU_CV) || '[]'); } catch { return []; } };
const marquerCV = path => { try { localStorage.setItem(VU_CV, JSON.stringify([...cvVus(), path].slice(-10))); } catch { /* stockage indisponible */ } };
const lus = new Map();  // CV → photo trouvée (ou null), le temps de la visite : l'accueil et Mon profil ne le lisent qu'une fois
const pretPhoto = (store, me) => !!me && !(store.mode === 'live' && !('photo_path' in me));
// Membre sans photo qui a déposé un CV (à l'inscription, ou avant que la photo existe) : la photo du CV, lue dans son navigateur
function usePhotoDuCV(store, me, delai = 0) {
  const cv = pretPhoto(store, me) && !me.photo_path ? me.cv_path : null;
  const [trouvee, setTrouvee] = useState(() => (cv && lus.get(cv)) || null);
  useEffect(() => {
    setTrouvee((cv && lus.get(cv)) || null);
    if (!cv || lus.has(cv) || cvVus().includes(cv)) return;
    let fini = false;
    const t = setTimeout(() => {
      store.lienCV(cv).then(u => fetch(u)).then(r => (r.ok ? r.arrayBuffer() : null)).then(b => (b ? photoPreteDuCV(b) : null))
        .then(b => { lus.set(cv, b); if (!b) marquerCV(cv); if (!fini && b) setTrouvee(b); }).catch(() => { /* pas de photo à proposer */ });
    }, delai);
    return () => { fini = true; clearTimeout(t); };
  }, [cv]);
  const oublier = () => { marquerCV(cv); lus.set(cv, null); setTrouvee(null); };
  return [trouvee, cv, oublier];
}

// Accueil : « Photo trouvée dans ton CV : l'utiliser ? », une fois, pour les membres déjà inscrits
export function PhotoProposee({ ctx, onTrouvee }) {
  const { me, store, act, go } = ctx;
  const [trouvee, cv, oublier] = usePhotoDuCV(store, me, 1200);
  const [busy, setBusy] = useState(false);
  useEffect(() => { onTrouvee?.(!!trouvee); }, [!!trouvee]);
  if (!trouvee) return null;
  const utiliser = () => { setBusy(true); act(async () => { await store.deposerPhoto(trouvee); oublier(); toast('Photo ajoutée.'); }).finally(() => setBusy(false)); };
  return html`<div class="photo-home"><${PhotoTrouvee} key=${cv} blob=${trouvee} busy=${busy} onUse=${utiliser} onOther=${() => go('profil')} onNo=${oublier}/></div>`;
}

// Mon profil : ajouter, changer ou retirer sa photo ; sans photo, celle du CV déposé est proposée
export function PhotoCard({ ctx }) {
  const { me, store, act } = ctx;
  const input = useRef(); const [busy, setBusy] = useState(false);
  const [trouvee, cv, oublier] = usePhotoDuCV(store, me);
  // Base pas encore à jour (pas de colonne photo) : la carte attend
  if (!pretPhoto(store, me)) return null;
  const a = !!me.photo_path;
  const envoyer = (blob, msg) => {
    setBusy(true);
    return act(async () => { await store.deposerPhoto(await blob); if (cv) oublier(); toast(msg); })
      .finally(() => { setBusy(false); if (input.current) input.current.value = ''; });
  };
  const choisir = file => { if (file) envoyer(preparerPhoto(file), a ? 'Photo changée.' : 'Photo ajoutée.'); };
  return html`<div class="panel photo-card">
    <button type="button" class=${'photo-pick' + (busy ? ' busy' : '')} disabled=${busy} aria-label=${a ? 'Changer ma photo' : 'Ajouter une photo'} onClick=${() => input.current?.click()}>
      <${Avatar} p=${me} size=${84}/><span class="photo-cam"><${Icon} name="camera" size=${15}/></span></button>
    <div class="photo-txt">
      <h2>${a ? 'Ta photo' : 'Ajoute ta photo'}</h2>
      <p class="small muted">${a ? 'Visible par les membres connectés seulement.' : 'Un visage inspire confiance : on te reconnaît tout de suite. Visible par les membres connectés seulement.'}</p>
      <input ref=${input} id="photo-file" type="file" accept="image/*" hidden onChange=${e => choisir(e.target.files[0])}/>
      <div class="photo-acts">
        <button type="button" class=${'btn small' + (a ? ' ghost' : ' tonal')} disabled=${busy} onClick=${() => input.current?.click()}>${busy ? 'Envoi en cours…' : a ? 'Changer' : 'Choisir une photo'}</button>
        ${a ? html`<button type="button" class="btn small ghost" disabled=${busy} onClick=${() => ctx.confirm('Retirer ta photo ? Tes initiales la remplacent.', () => act(async () => { await store.retirerPhoto(); toast('Photo retirée.'); }), 'Retirer')}>Retirer</button>` : null}
      </div>
    </div>
    ${trouvee && !a ? html`<${PhotoTrouvee} key=${cv} blob=${trouvee} busy=${busy} onUse=${() => envoyer(trouvee, 'Photo ajoutée.')}
      onOther=${() => input.current?.click()} onNo=${oublier}/>` : null}
  </div>`;
}

injectCSS('photo', `
.photo-card { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 1rem; }
.photo-card > .photo-txt { flex: 1 1 12rem; }
.photo-card > .photo-trouvee { flex: 1 1 100%; margin: 0; }
.photo-txt { min-width: 0; display: flex; flex-direction: column; gap: .3rem; }
.photo-txt h2 { margin: 0; font-size: var(--fs-4); }
.photo-txt p { margin: 0; }
.photo-acts { display: flex; gap: .4rem; flex-wrap: wrap; margin-top: .2rem; }
.photo-home .photo-trouvee { margin: 0; background: var(--surface); box-shadow: var(--sh1); }
.photo-trouvee { display: grid; grid-template-columns: 64px 1fr; align-items: center; gap: .6rem .75rem; margin-top: .5rem; padding: .8rem .9rem; border-radius: var(--r-lg); background: var(--surface-2); }
.photo-trouvee .photo-acts { grid-column: 1 / -1; margin: 0; }
.photo-trouvee img { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; flex: none; box-shadow: 0 0 0 3px var(--surface); }
.photo-pick { position: relative; flex: none; padding: 0; border: 0; background: none; border-radius: 50%; cursor: pointer; }
.photo-pick .avatar { box-shadow: 0 0 0 3px var(--surface), 0 0 0 5px var(--accent-soft); transition: transform .2s; }
.photo-pick:hover .avatar { transform: scale(1.03); }
.photo-pick.busy .avatar { opacity: .55; }
.photo-cam { position: absolute; inset-inline-end: -2px; bottom: -2px; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--accent); color: var(--accent-ink); box-shadow: 0 0 0 3px var(--surface); }
@media (prefers-reduced-motion: reduce) { .photo-pick .avatar { transition: none; } }
`);

addAR({
  'Ta photo': 'صورتك', 'Ajoute ta photo': 'أضف صورتك', 'Changer ma photo': 'تغيير صورتي', 'Ajouter une photo': 'إضافة صورة',
  'Visible par les membres connectés seulement.': 'لا يراها إلا الأعضاء المسجَّلون.',
  'Un visage inspire confiance : on te reconnaît tout de suite. Visible par les membres connectés seulement.': 'الوجه يبعث على الثقة: يتعرّف عليك الجميع فورًا. لا يراها إلا الأعضاء المسجَّلون.',
  'Choisir une photo': 'اختيار صورة', 'Changer': 'تغيير',
  'Retirer ta photo ? Tes initiales la remplacent.': 'إزالة صورتك؟ ستظهر الأحرف الأولى من اسمك مكانها.',
  'Photo ajoutée.': 'تمت إضافة الصورة.', 'Photo changée.': 'تم تغيير الصورة.', 'Photo retirée.': 'تمت إزالة الصورة.',
  'Choisis une photo (JPEG, PNG ou WebP).': 'اختر صورة (JPEG أو PNG أو WebP).', 'Photo trop lourde (20 Mo au plus).': 'الصورة كبيرة جدًا (20 ميغابايت كحد أقصى).',
  'Photo trop lourde (1 Mo au plus).': 'الصورة كبيرة جدًا (1 ميغابايت كحد أقصى).',
  'Cette image ne s’ouvre pas. Essaie une photo en JPEG ou PNG.': 'تعذّر فتح هذه الصورة. جرّب صورة بصيغة JPEG أو PNG.',
  'La photo de profil arrive bientôt : la base est en cours de mise à jour.': 'صورة الملف قادمة قريبًا: قاعدة البيانات قيد التحديث.',
  'Envoi de la photo impossible. Vérifie ta connexion et réessaie.': 'تعذّر إرسال الصورة. تحقّق من اتصالك وأعد المحاولة.',
  'Photo trouvée dans ton CV : l’utiliser ?': 'وجدنا صورة في سيرتك الذاتية: هل تستعملها؟', 'Utiliser': 'استعمالها', 'Choisir une autre': 'اختيار صورة أخرى', 'Non merci': 'لا، شكرًا',
  'Photo gardée : elle sera sur ton profil.': 'تم الاحتفاظ بالصورة: ستظهر في ملفك.',
});
