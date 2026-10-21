// Lien d'invitation par promo, à coller dans les groupes WhatsApp : reseau-ensam-meknes.github.io/?promo=2027
// Le lien ouvre directement « Créer mon compte » et, à l'étape suivante, la promo (et le rôle) sont déjà remplis.
// La promo est gardée dans ce navigateur jusqu'à la fin de l'inscription, puis oubliée.
import { html, useState } from './vendor/preact-htm.js';
import { Icon, toast, injectCSS } from './ui.js';
import { addAR, getLang } from './i18n.js';
import { NIVEAUX, niveauOf, seasonOf } from './logic.js';

const CLE = 'ensam-invite-promo';
const valide = n => Number.isInteger(n) && n >= 1990 && n <= 2040;

// Au chargement : lit ?promo= dans l'adresse, le garde, puis l'enlève de la barre d'adresse
export function lireInvitation() {
  try {
    const u = new URL(location.href);
    if (!u.searchParams.has('promo')) return;
    const n = Number(u.searchParams.get('promo'));
    if (valide(n)) localStorage.setItem(CLE, String(n));
    u.searchParams.delete('promo');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  } catch { /* stockage ou historique indisponible : le lien marche quand même, sans promo pré-remplie */ }
}
export function promoInvitee() {
  try { const n = Number(localStorage.getItem(CLE)); return valide(n) ? n : null; } catch { return null; }
}
export function oublierInvitation() { try { localStorage.removeItem(CLE); } catch { /* */ } }

// Rôle probable d'après la promo : diplôme pas encore obtenu = étudiant(e)
export const roleDePromo = (promo, saison = seasonOf()) => (promo > saison ? 'etudiant' : 'laureat');

export const lienInvitation = (promo, base = location.origin + location.pathname) => `${base}?promo=${promo}`;

// Message prêt à coller dans le groupe WhatsApp de la promo
export function messageInvitation(promo, langue, lien, saison = seasonOf()) {
  const etu = roleDePromo(promo, saison) === 'etudiant';
  const fr = etu
    ? `Salut la promo ${promo} 👋\nOn lance le Réseau ENSAM Meknès : une plateforme gratuite où les lauréats de l'école partagent des offres de stage, de PFE et d'emploi, et proposent du mentorat (CV, entretiens, stage à l'étranger).\nInscris-toi en une minute avec ce lien, ta promo est déjà remplie :\n${lien}\nPartage-le avec tes camarades 🙏`
    : `Salut la promo ${promo} 👋\nOn lance le Réseau ENSAM Meknès, la plateforme des lauréats et des étudiants de l'école.\nTu peux y partager une offre de stage ou d'emploi en 30 secondes, aider un étudiant (CV, entretien, PFE) et retrouver les lauréats de ta promo et de ta filière.\nInscris-toi avec ce lien, ta promo est déjà remplie :\n${lien}\nMerci de le faire passer aux lauréats de ta promo 🙏`;
  const ar = etu
    ? `مرحبا دفعة ${promo} 👋\nأطلقنا «شبكة ENSAM مكناس»: منصة مجانية يشارك فيها خريجو المدرسة عروض التداريب ومشاريع نهاية الدراسة والوظائف، ويقدمون الإرشاد (السيرة الذاتية، المقابلات، التدريب بالخارج).\nسجّل في دقيقة واحدة عبر هذا الرابط، دفعتك معبأة مسبقًا:\n${lien}\nشارك الرابط مع زملائك 🙏`
    : `مرحبا دفعة ${promo} 👋\nأطلقنا «شبكة ENSAM مكناس»، منصة خريجي المدرسة وطلبتها.\nيمكنك نشر عرض تدريب أو عمل في 30 ثانية، ومساعدة طالب (سيرة ذاتية، مقابلة، مشروع نهاية الدراسة)، والتواصل مع خريجي دفعتك وشعبتك.\nسجّل عبر هذا الرابط، دفعتك معبأة مسبقًا:\n${lien}\nشكرًا على مشاركته مع خريجي دفعتك 🙏`;
  return langue === 'ar' ? ar : langue === 'fr' ? fr : `${fr}\n\n${ar}`;
}

addAR({
  'Inviter': 'دعوة', 'Un lien par promo': 'رابط لكل دفعة',
  'Colle le message dans le groupe WhatsApp de la promo. Le lien ouvre la création de compte, avec la promo déjà remplie.': 'الصق الرسالة في مجموعة واتساب الخاصة بالدفعة. يفتح الرابط إنشاء الحساب، والدفعة معبأة مسبقًا.',
  'Langue du message': 'لغة الرسالة', 'Français': 'الفرنسية', 'Arabe': 'العربية', 'Les deux': 'الاثنتان',
  'Étudiants': 'الطلبة', 'Lauréats': 'الخريجون', 'Jeunes diplômés': 'الخريجون الجدد',
  'Copier le message': 'نسخ الرسالة', 'Envoyer sur WhatsApp': 'إرسال عبر واتساب', 'Aperçu': 'معاينة', 'Autre promo': 'دفعة أخرى', 'Ajouter': 'إضافة',
  'Lien copié.': 'تم نسخ الرابط.', 'Message copié : colle-le dans le groupe WhatsApp.': 'تم نسخ الرسالة: الصقها في مجموعة واتساب.',
  'Copie impossible ici : sélectionne le texte et copie-le.': 'النسخ غير ممكن هنا: حدّد النص وانسخه.',
  'Message pour la promo': 'رسالة للدفعة', 'Promo entre 1990 et 2040.': 'الدفعة بين 1990 و2040.',
  'Ta promo est déjà remplie : crée ton compte, puis vérifie tes informations.': 'دفعتك معبأة مسبقًا: أنشئ حسابك، ثم تحقق من معلوماتك.',
}, [
  [/^Bienvenue, promo (\d{4}) !$/, y => `مرحبا بك، دفعة ${y}!`],
]);

async function copier(txt, fait) {
  try { await navigator.clipboard.writeText(txt); toast(fait); } catch { toast('Copie impossible ici : sélectionne le texte et copie-le.', 'err'); }
}

// Administration > Inviter : une ligne par promo, avec le lien, le message et le bouton WhatsApp
export function InvitationsAdmin({ ctx }) {
  const { saison } = ctx;
  const [langue, setLangue] = useState(getLang() === 'ar' ? 'ar' : 'fr');
  const [autres, setAutres] = useState([]);
  const [saisie, setSaisie] = useState('');
  const [apercu, setApercu] = useState(saison + 1);
  const etudiants = [saison + 3, saison + 2, saison + 1];
  const laureats = [...new Set([...autres, ...Array.from({ length: 6 }, (_, i) => saison - i)])].filter(p => p <= saison).sort((a, b) => b - a);
  const extra = autres.filter(p => p > saison + 3);
  const ajouter = e => {
    e.preventDefault();
    const n = Number(saisie);
    if (!valide(n)) return toast('Promo entre 1990 et 2040.', 'err');
    if (![...etudiants, ...laureats, ...extra].includes(n)) setAutres([...autres, n]);
    setApercu(n); setSaisie('');
  };
  const ligne = promo => {
    const lien = lienInvitation(promo);
    const msg = messageInvitation(promo, langue, lien, saison);
    const n = niveauOf({ promo }, saison);
    const qui = n <= 5 ? NIVEAUX[n].short : n === 6 ? 'Jeunes diplômés' : 'Lauréats';
    return html`<li class=${'inv-row' + (apercu === promo ? ' on' : '')} key=${promo}>
      <div class="grow"><strong>${`Promo ${promo} · ${qui}`}</strong><span class="mono small inv-link" dir="ltr" translate="no">${lien}</span></div>
      <div class="inv-act">
        <button class="btn tiny ghost" onClick=${() => setApercu(promo)} aria-pressed=${apercu === promo}><${Icon} name="eye" size=${14}/> Aperçu</button>
        <button class="btn tiny ghost" onClick=${() => copier(lien, 'Lien copié.')}><${Icon} name="link" size=${14}/> Copier le lien</button>
        <button class="btn tiny ghost" onClick=${() => copier(msg, 'Message copié : colle-le dans le groupe WhatsApp.')}><${Icon} name="copy" size=${14}/> Copier le message</button>
        <a class="btn tiny primary" href=${'https://wa.me/?text=' + encodeURIComponent(msg)} target="_blank" rel="noopener"><${Icon} name="send" size=${14}/> Envoyer sur WhatsApp</a>
      </div></li>`;
  };
  return html`<div class="panel">
      <div class="section-head"><h2 class="h-ico"><${Icon} name="send"/> Un lien par promo</h2></div>
      <p class="small muted">Colle le message dans le groupe WhatsApp de la promo. Le lien ouvre la création de compte, avec la promo déjà remplie.</p>
      <div class="row inv-opts">
        <div class="seg" role="group" aria-label="Langue du message">${[['fr', 'Français'], ['ar', 'Arabe'], ['fr+ar', 'Les deux']].map(([k, l]) => html`<button type="button" class=${langue === k ? 'on' : ''} aria-pressed=${langue === k} onClick=${() => setLangue(k)}>${l}</button>`)}</div>
        <form class="row inv-autre" onSubmit=${ajouter}><input id="inv-promo" type="number" min="1990" max="2040" placeholder="Autre promo" aria-label="Autre promo" value=${saisie} onInput=${e => setSaisie(e.target.value)}/><button class="btn tiny">Ajouter</button></form>
      </div>
      <h3 class="eyebrow">Étudiants</h3>
      <ul class="inv-list">${[...extra.sort((a, b) => b - a), ...etudiants].map(ligne)}</ul>
      <h3 class="eyebrow">Lauréats</h3>
      <ul class="inv-list">${laureats.map(ligne)}</ul>
    </div>
    <div class="panel">
      <div class="section-head"><h2 class="h-ico"><${Icon} name="eye"/> Message pour la promo <span class="mono">${apercu}</span></h2></div>
      <pre class="inv-msg" dir="auto" translate="no">${messageInvitation(apercu, langue, lienInvitation(apercu), saison)}</pre>
    </div>`;
}

injectCSS('invitation', `
.inv-opts { justify-content: space-between; gap: .6rem; margin: .3rem 0 .6rem; }
.inv-autre { gap: .4rem; flex-wrap: nowrap; }
.inv-autre input { width: 8.5rem; }
.inv-list { list-style: none; margin: .2rem 0 .8rem; padding: 0; display: flex; flex-direction: column; gap: .4rem; }
.inv-row { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem .8rem; padding: .6rem .75rem; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); }
.inv-row.on { border-color: var(--accent); }
.inv-row .grow { min-width: 0; flex: 1 1 220px; display: flex; flex-direction: column; gap: .15rem; }
.inv-link { color: var(--ink-2); overflow-wrap: anywhere; }
.inv-act { display: flex; flex-wrap: wrap; gap: .3rem; }
.inv-msg { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; font-size: .9rem; line-height: 1.55; padding: .8rem .9rem; border-radius: 10px; background: var(--surface-2); color: var(--ink); }
.invite-band { display: flex; gap: .5rem; align-items: flex-start; margin: 0; padding: .65rem .8rem; border-radius: 10px; background: var(--accent-soft); color: var(--ink); font-size: .9rem; }
.invite-band svg { color: var(--accent); flex: none; margin-top: .1rem; }
`);
