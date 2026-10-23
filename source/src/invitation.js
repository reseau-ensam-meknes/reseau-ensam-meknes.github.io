// Lien d'invitation par promo, à coller dans les groupes WhatsApp : reseau-ensam-meknes.github.io/?promo=2027
// Le lien ouvre directement « Créer mon compte » et, à l'étape suivante, la promo (et le rôle) sont déjà remplis.
// La promo est gardée dans ce navigateur jusqu'à la fin de l'inscription, puis oubliée.
import { html, useState } from './vendor/preact-htm.js';
import { Icon, toast, injectCSS, lienWhatsApp } from './ui.js';
import { addAR, getLang } from './i18n.js';
import { NIVEAUX, niveauOf, seasonOf, lienPromo, messageCamarade, inscritsDeLaPromo } from './logic.js';
import { roleDePromo, promoValide as valide } from './regles-entree.js';

// Lire le lien, garder la promo et le rôle choisi : la page d'entrée s'en charge (elle s'affiche avant le reste du site)
export { lireInvitation, promoInvitee, oublierInvitation, retenirRole, roleRetenu } from './entree.js';
export { roleDePromo };

// Lien d'une promo : sa petite page d'aperçu (page = true) nomme la promo dans WhatsApp, puis ouvre le site avec ?promo=
export const lienInvitation = (promo, langue = 'fr', page = true) => lienPromo(promo, langue, page, location.href);

// Message prêt à coller dans le groupe WhatsApp de la promo. Une seule chose à faire en arrivant :
// un étudiant de 3A à 5A dit aux lauréats ce qu'il cherche ; en 1re et 2e année, il demande un conseil ;
// un lauréat publie une offre ou aide un étudiant.
export function messageInvitation(promo, langue, lien, saison = seasonOf()) {
  const etu = roleDePromo(promo, saison) === 'etudiant';
  const demande = etu && niveauOf({ promo }, saison) >= 3;
  const fr = !etu
    ? `Salut la promo ${promo} 👋\nLe Réseau ENSAM Meknès est ouvert : la plateforme gratuite des lauréats et des étudiants de l'ENSAM Meknès.\nUn étudiant de ta filière cherche peut-être un stage ou un PFE chez toi : tu peux publier une offre en 30 secondes, ou lui donner 20 minutes de conseil, quand tu as le temps.\nInscris-toi avec ce lien, ta promo (${promo}) est déjà indiquée :\n${lien}\nMerci de le faire passer aux lauréats de ta promo 🙏`
    : demande
      ? `Salut la promo ${promo} 👋\nLe Réseau ENSAM Meknès est ouvert : une plateforme gratuite entre étudiants et lauréats de l'ENSAM Meknès.\nTu cherches un stage ou un PFE ? Dis aux lauréats de ta filière ce que tu cherches, CV joint : ceux qui peuvent t'aider te répondent sur la plateforme. Tu peux aussi demander 20 minutes de conseil (CV, entretien, stage à l'étranger).\nInscris-toi en une minute avec ce lien, ta promo (${promo}) est déjà indiquée :\n${lien}\nPartage-le avec tes camarades 🙏`
      : `Salut la promo ${promo} 👋\nLe Réseau ENSAM Meknès est ouvert : une plateforme gratuite entre étudiants et lauréats de l'ENSAM Meknès.\nUne question sur la filière à choisir, les stages ou la vie après l'école ? Un lauréat te répond en 20 minutes de visio.\nInscris-toi en une minute avec ce lien, ta promo (${promo}) est déjà indiquée :\n${lien}\nPartage-le avec tes camarades 🙏`;
  const ar = !etu
    ? `مرحبا دفعة ${promo} 👋\n«شبكة ENSAM مكناس» مفتوحة الآن: المنصة المجانية لخريجي وطلبة ENSAM مكناس.\nربما يبحث طالب من شعبتك عن تدريب أو مشروع نهاية الدراسة عندك: يمكنك نشر عرض في 30 ثانية، أو منحه 20 دقيقة من النصح متى توفّر لك الوقت.\nسجّل عبر هذا الرابط، دفعتك (${promo}) محدَّدة مسبقًا:\n${lien}\nشكرًا على مشاركته مع خريجي دفعتك 🙏`
    : demande
      ? `مرحبا دفعة ${promo} 👋\n«شبكة ENSAM مكناس» مفتوحة الآن: منصة مجانية تجمع طلبة وخريجي ENSAM مكناس.\nتبحث عن تدريب أو مشروع نهاية الدراسة؟ قل لخريجي شعبتك ما تبحث عنه مع سيرتك الذاتية: من يستطيع مساعدتك يجيبك على المنصة. يمكنك أيضًا طلب 20 دقيقة من النصح (السيرة الذاتية، المقابلة، التدريب بالخارج).\nسجّل في دقيقة واحدة عبر هذا الرابط، دفعتك (${promo}) محدَّدة مسبقًا:\n${lien}\nشارك الرابط مع زملائك 🙏`
      : `مرحبا دفعة ${promo} 👋\n«شبكة ENSAM مكناس» مفتوحة الآن: منصة مجانية تجمع طلبة وخريجي ENSAM مكناس.\nسؤال عن الشعبة التي ستختارها أو التداريب أو الحياة بعد المدرسة؟ يجيبك خريج في 20 دقيقة عبر الفيديو.\nسجّل في دقيقة واحدة عبر هذا الرابط، دفعتك (${promo}) محدَّدة مسبقًا:\n${lien}\nشارك الرابط مع زملائك 🙏`;
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
  'Ta promo est déjà indiquée : crée ton compte, puis vérifie tes informations.': 'دفعتك محدَّدة مسبقًا: أنشئ حسابك، ثم تحقق من معلوماتك.',
  'Fais venir ta promo': 'ادعُ دفعتك', '30 s': '30 ثانية',
  'Le message et le lien de ta promo sont prêts pour votre groupe WhatsApp.': 'الرسالة ورابط دفعتك جاهزان لمجموعة واتساب الخاصة بكم.',
}, [
  [/^Bienvenue, promo (\d{4}) !$/, y => `مرحبا بك، دفعة ${y}!`],
  [/^Le message et le lien de la promo (\d{4}) sont prêts : envoie-les dans votre groupe WhatsApp\.$/, y => `الرسالة ورابط دفعة ${y} جاهزان: أرسلهما في مجموعة واتساب الخاصة بكم.`],
]);

// « Fais venir ta promo » : un seul bouton, qui ouvre WhatsApp avec le message et le lien de la promo déjà prêts.
// geste : une ligne de « Ta première aide » (me.js) ; sinon une petite carte (Mon espace, Mon parcours).
export function FaisVenirPromo({ ctx, geste = false }) {
  const { data, me, saison } = ctx;
  if (!['laureat', 'etudiant'].includes(me?.role) || !valide(Number(me.promo))) return null;
  const langue = getLang() === 'ar' ? 'ar' : 'fr';
  const href = lienWhatsApp(messageCamarade(me, langue, lienInvitation(me.promo, langue), inscritsDeLaPromo(data.profiles, me.promo), saison));
  if (geste) return html`<a class="pa-geste" id="pa-promo" href=${href} target="_blank" rel="noopener">
      <span class="pa-geste-ico"><${Icon} name="people" size=${20}/></span>
      <span class="pa-geste-txt"><span class="pa-geste-titre"><strong>Fais venir ta promo</strong><span class="pa-duree">30 s</span></span><span class="small muted">Le message et le lien de ta promo sont prêts pour votre groupe WhatsApp.</span></span>
      <span class="pa-geste-go" aria-hidden="true"><${Icon} name="arrow" size=${16}/></span></a>`;
  return html`<div class="promo-card" id="promo-card">
    <span class="promo-ico" aria-hidden="true"><${Icon} name="people" size=${22}/></span>
    <div class="grow"><strong>Fais venir ta promo</strong><span class="small muted">${`Le message et le lien de la promo ${me.promo} sont prêts : envoie-les dans votre groupe WhatsApp.`}</span></div>
    <a class="btn small" id="promo-wa" href=${href} target="_blank" rel="noopener"><${Icon} name="send" size=${16}/> Envoyer sur WhatsApp</a>
  </div>`;
}

async function copier(txt, fait) {
  try { await navigator.clipboard.writeText(txt); toast(fait); } catch { toast('Copie impossible ici : sélectionne le texte et copie-le.', 'err'); }
}

// Administration > Inviter : une ligne par promo, avec le lien, le message et le bouton WhatsApp
// Une promo sans aucun inscrit garde le lien simple ?promo= : son aperçu ne dirait pas « tes camarades sont sur le Réseau »
export function InvitationsAdmin({ ctx }) {
  const { saison } = ctx;
  const inscrites = new Set(ctx.data.profiles.map(p => Number(p.promo)));
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
    const lien = lienInvitation(promo, langue === 'ar' ? 'ar' : 'fr', inscrites.has(promo));
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
      <pre class="inv-msg" dir="auto" translate="no">${messageInvitation(apercu, langue, lienInvitation(apercu, langue === 'ar' ? 'ar' : 'fr', inscrites.has(apercu)), saison)}</pre>
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
a.pa-geste { text-decoration: none; }
.promo-card { display: flex; align-items: center; gap: .9rem; flex-wrap: wrap; padding: 1rem 1.1rem; margin-block-start: .8rem; border-radius: 14px; background: linear-gradient(120deg, var(--accent-soft), var(--surface) 75%); border: 1px solid var(--line); }
[dir="rtl"] .promo-card { background: linear-gradient(240deg, var(--accent-soft), var(--surface) 75%); }
.promo-card .grow { flex: 1 1 220px; min-width: 0; display: flex; flex-direction: column; gap: .15rem; }
.promo-ico { display: inline-grid; place-items: center; width: 46px; height: 46px; border-radius: 50%; background: var(--accent); color: var(--accent-ink); flex: none; }
.inv-msg { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; font-size: .9rem; line-height: 1.55; padding: .8rem .9rem; border-radius: 10px; background: var(--surface-2); color: var(--ink); }
`);
