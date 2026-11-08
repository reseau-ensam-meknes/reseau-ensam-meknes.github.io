// Lien d'invitation par promo, à coller dans les groupes WhatsApp : reseau-ensam-meknes.github.io/?promo=2027
// Le lien ouvre directement « Créer mon compte » et, à l'étape suivante, la promo (et le rôle) sont déjà remplis.
// La promo est gardée dans ce navigateur jusqu'à la fin de l'inscription, puis oubliée.
import { html, useState, useEffect } from './vendor/preact-htm.js';
import { Icon, toast, injectCSS, lienWhatsApp } from './ui.js';
import { addAR, getLang, arCount } from './i18n.js';
import { NIVEAUX, niveauOf, seasonOf, lienPromo, messageCamarade, inscritsDeLaPromo, ecoleDe, lienAvecCode, codeInvitationValide, ligneInvites, nomsAPartager, NOMS_MEKNES, deLEcoleNommee, ecoleDesTextes } from './logic.js';
import { roleDePromo, promoValide as valide } from './regles-entree.js';

// Lire le lien, garder la promo et le rôle choisi : la page d'entrée s'en charge (elle s'affiche avant le reste du site)
export { lireInvitation, promoInvitee, ecoleInvitee, oublierInvitation, retenirRole, roleRetenu } from './entree.js';
export { roleDePromo };

// Lien d'une promo : sa petite page d'aperçu (page = true) nomme la promo dans WhatsApp, puis ouvre le site avec ?promo=
// ecole : celle du membre qui partage, ou celle que regarde la console ; une autre que l'ENSAM Meknès est dite dans le lien
export const lienInvitation = (promo, langue = 'fr', page = true, ecole) => lienPromo(promo, langue, page, location.href, ecole);

// Invitation nommée : le lien de promo d'un membre porte son code (&de=…, la page d'aperçu le transmet). La page d'entrée
// dit « Invitation de Nadia · promo 2019 », et l'inscription retient qui a invité. Sans code (base pas encore à jour,
// pas de réseau, administration), le lien part sans : il marche pareil.
export const lienDeMembre = (promo, langue, code, page = true, ecole) => lienAvecCode(lienInvitation(promo, langue, page, ecole), code);
export function useCodeInvitation(ctx) {
  const { store, me } = ctx;
  const [code, setCode] = useState(() => (codeInvitationValide(me?.code_invitation) ? me.code_invitation : null));
  useEffect(() => {
    if (!me?.id || me.role === 'admin' || !store?.monCodeInvitation) return;
    let vivant = true;
    store.monCodeInvitation().then(c => { if (vivant) setCode(codeInvitationValide(c) ? c : null); }, () => {});
    return () => { vivant = false; };
  }, [me?.id]);
  return code;
}
// Les camarades arrivés grâce au membre (mes_invites) : combien, et leurs prénoms. Un chiffre, jamais un classement.
function useInvites(ctx) {
  const { store, me, data } = ctx;
  const [x, setX] = useState(null);
  useEffect(() => {
    if (!me?.id || !store?.mesInvites) return;
    let vivant = true;
    store.mesInvites().then(v => { if (vivant) setX(v); }, () => {});
    return () => { vivant = false; };
  }, [me?.id, store?.mode === 'live' ? null : data?.profiles]);
  return x;
}

// Message prêt à coller dans le groupe WhatsApp de la promo. Une seule chose à faire en arrivant :
// un étudiant de 3A à 5A dit aux lauréats ce qu'il cherche ; en 1re et 2e année, il demande un conseil ;
// un lauréat publie une offre ou aide un étudiant.
// noms : ceux de l'école du lien (nomsEcole) ; l'ENSAM Meknès par défaut, avec ses textes d'avant.
export function messageInvitation(promo, langue, lien, saison = seasonOf(), noms = NOMS_MEKNES) {
  const etu = roleDePromo(promo, saison) === 'etudiant';
  const demande = etu && niveauOf({ promo }, saison) >= 3;
  const { nom, nomAr } = noms, deL = deLEcoleNommee(nom, "'");
  const fr = !etu
    ? `Salut la promo ${promo} 👋\nLe Réseau ${nom} est ouvert : la plateforme gratuite des lauréats et des étudiants ${deL}.\nUn étudiant de ta filière cherche peut-être un stage ou un PFE chez toi : tu peux publier une offre en 30 secondes, ou lui donner 20 minutes de conseil, quand tu as le temps.\nInscris-toi avec ce lien, ta promo (${promo}) est déjà indiquée :\n${lien}\nMerci de le faire passer aux lauréats de ta promo 🙏`
    : demande
      ? `Salut la promo ${promo} 👋\nLe Réseau ${nom} est ouvert : une plateforme gratuite entre étudiants et lauréats ${deL}.\nTu cherches un stage ou un PFE ? Dis aux lauréats de ta filière ce que tu cherches, CV joint : ceux qui peuvent t'aider te répondent sur la plateforme. Tu peux aussi demander 20 minutes de conseil (CV, entretien, stage à l'étranger).\nInscris-toi en une minute avec ce lien, ta promo (${promo}) est déjà indiquée :\n${lien}\nPartage-le avec tes camarades 🙏`
      : `Salut la promo ${promo} 👋\nLe Réseau ${nom} est ouvert : une plateforme gratuite entre étudiants et lauréats ${deL}.\nUne question sur la filière à choisir, les stages ou la vie après l'école ? Un lauréat te répond en 20 minutes de visio.\nInscris-toi en une minute avec ce lien, ta promo (${promo}) est déjà indiquée :\n${lien}\nPartage-le avec tes camarades 🙏`;
  const ar = !etu
    ? `مرحبا دفعة ${promo} 👋\n«شبكة ${nomAr}» مفتوحة الآن: المنصة المجانية لخريجي وطلبة ${nomAr}.\nربما يبحث طالب من شعبتك عن تدريب أو مشروع نهاية الدراسة عندك: يمكنك نشر عرض في 30 ثانية، أو منحه 20 دقيقة من النصح متى توفّر لك الوقت.\nسجّل عبر هذا الرابط، دفعتك (${promo}) محدَّدة مسبقًا:\n${lien}\nشكرًا على مشاركته مع خريجي دفعتك 🙏`
    : demande
      ? `مرحبا دفعة ${promo} 👋\n«شبكة ${nomAr}» مفتوحة الآن: منصة مجانية تجمع طلبة وخريجي ${nomAr}.\nتبحث عن تدريب أو مشروع نهاية الدراسة؟ قل لخريجي شعبتك ما تبحث عنه مع سيرتك الذاتية: من يستطيع مساعدتك يجيبك على المنصة. يمكنك أيضًا طلب 20 دقيقة من النصح (السيرة الذاتية، المقابلة، التدريب بالخارج).\nسجّل في دقيقة واحدة عبر هذا الرابط، دفعتك (${promo}) محدَّدة مسبقًا:\n${lien}\nشارك الرابط مع زملائك 🙏`
      : `مرحبا دفعة ${promo} 👋\n«شبكة ${nomAr}» مفتوحة الآن: منصة مجانية تجمع طلبة وخريجي ${nomAr}.\nسؤال عن الشعبة التي ستختارها أو التداريب أو الحياة بعد المدرسة؟ يجيبك خريج في 20 دقيقة عبر الفيديو.\nسجّل في دقيقة واحدة عبر هذا الرابط، دفعتك (${promo}) محدَّدة مسبقًا:\n${lien}\nشارك الرابط مع زملائك 🙏`;
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
  '1 camarade est arrivé grâce à toi': 'انضمّ بفضلك زميل واحد',
  'Message prêt pour WhatsApp': 'الرسالة جاهزة لواتساب',
}, [
  [/^(\d+) camarades sont arrivés grâce à toi$/, n => `انضمّ بفضلك ${arCount(n, ['زميل واحد', 'زميلان', 'زملاء', 'زميلًا'])}`],
  [/^Bienvenue, promo (\d{4}) !$/, y => `مرحبا بك، دفعة ${y}!`],
  [/^Le message et le lien de la promo (\d{4}) sont prêts : envoie-les dans votre groupe WhatsApp\.$/, y => `الرسالة ورابط دفعة ${y} جاهزان: أرسلهما في مجموعة واتساب الخاصة بكم.`],
]);

// « Fais venir ta promo » : un seul bouton, qui ouvre WhatsApp avec le message et le lien de la promo déjà prêts.
// geste : une ligne de « Ta première aide » (me.js) ; sinon une petite carte (Mon espace, Mon parcours).
// Le lien porte le code du membre ; la ligne dit combien de camarades sont arrivés grâce à lui (à partir d'un).
export function FaisVenirPromo({ ctx, geste = false }) {
  const { data, me, saison } = ctx;
  const code = useCodeInvitation(ctx);
  const invites = useInvites(ctx);
  if (!['laureat', 'etudiant'].includes(me?.role) || !valide(Number(me.promo))) return null;
  const langue = getLang() === 'ar' ? 'ar' : 'fr';
  // Le lien et le message disent l'école du membre (l'ENSAM Meknès : ceux d'avant ; une école pas encore ouverte n'est pas nommée)
  const href = lienWhatsApp(messageCamarade(me, langue, lienDeMembre(me.promo, langue, code, true, ecoleDe(me)), inscritsDeLaPromo(data.profiles, me.promo), saison, nomsAPartager(data.ecoles, ecoleDe(me))));
  if (geste) return html`<a class="pa-geste" id="pa-promo" href=${href} target="_blank" rel="noopener">
      <span class="pa-geste-ico"><${Icon} name="people" size=${20}/></span>
      <span class="pa-geste-txt"><span class="pa-geste-titre"><strong>Fais venir ta promo</strong><span class="pa-duree">30 s</span></span><span class="small muted">Le message et le lien de ta promo sont prêts pour votre groupe WhatsApp.</span></span>
      <span class="pa-geste-go" aria-hidden="true"><${Icon} name="arrow" size=${16}/></span></a>`;
  // Une seule ligne : toute la ligne est le lien (une grande cible), comme les lignes de Mon espace
  return html`<div class="promo-card" id="promo-card">
    <a class="promo-lien" id="promo-wa" href=${href} target="_blank" rel="noopener">
      <span class="promo-ico" aria-hidden="true"><${Icon} name="people" size=${20}/></span>
      <span class="promo-txt"><strong>Fais venir ta promo</strong><span class="promo-sous">Message prêt pour WhatsApp</span>
        ${invites?.n > 0 ? html`<span class="promo-invites" id="promo-invites"><${Icon} name="heart" size=${14}/><span>${ligneInvites(invites.n)}</span>${invites.prenoms.length ? html`<span class="promo-prenoms" translate="no" dir="auto">${invites.prenoms.slice(0, 5).join(', ')}${invites.n > 5 ? '…' : ''}</span>` : null}</span>` : null}</span>
      <span class="promo-go" aria-hidden="true"><${Icon} name="arrow" size=${18}/></span>
    </a>
  </div>`;
}

async function copier(txt, fait) {
  try { await navigator.clipboard.writeText(txt); toast(fait); } catch { toast('Copie impossible ici : sélectionne le texte et copie-le.', 'err'); }
}

// Administration > Inviter : une ligne par promo, avec le lien, le message et le bouton WhatsApp
// Une promo sans aucun inscrit garde le lien simple ?promo= : son aperçu ne dirait pas « tes camarades sont sur le Réseau ».
// Les liens et les messages sont ceux de l'école que regarde la console quand elle est ouverte, sinon ceux de l'école de
// l'administration (ecoleDesTextes) : ses inscrits seuls comptent.
export function InvitationsAdmin({ ctx }) {
  const { saison } = ctx;
  const { slug: ecole, noms } = ecoleDesTextes(ctx);
  const inscrites = new Set(ctx.data.profiles.filter(p => ecoleDe(p) === ecole).map(p => Number(p.promo)));
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
    const lien = lienInvitation(promo, langue === 'ar' ? 'ar' : 'fr', inscrites.has(promo), ecole);
    const msg = messageInvitation(promo, langue, lien, saison, noms);
    const n = niveauOf({ promo }, saison);
    const qui = n <= 5 ? NIVEAUX[n].short : n === 6 ? 'Jeunes diplômés' : 'Lauréats';
    return html`<li class=${'inv-row' + (apercu === promo ? ' on' : '')} key=${promo}>
      <div class="grow"><strong>${`Promo ${promo} · ${qui}`}</strong><span class="mono small inv-link" dir="ltr" translate="no">${lien}</span></div>
      <div class="inv-act">
        <button class="btn tiny ghost" onClick=${() => setApercu(promo)} aria-pressed=${apercu === promo}><${Icon} name="eye" size=${14}/> Aperçu</button>
        <button class="btn tiny ghost" onClick=${() => copier(lien, 'Lien copié.')}><${Icon} name="link" size=${14}/> Copier le lien</button>
        <button class="btn tiny ghost" onClick=${() => copier(msg, 'Message copié : colle-le dans le groupe WhatsApp.')}><${Icon} name="copy" size=${14}/> Copier le message</button>
        <a class="btn tiny tonal" href=${'https://wa.me/?text=' + encodeURIComponent(msg)} target="_blank" rel="noopener"><${Icon} name="send" size=${14}/> Envoyer sur WhatsApp</a>
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
      <pre class="inv-msg" dir="auto" translate="no">${messageInvitation(apercu, langue, lienInvitation(apercu, langue === 'ar' ? 'ar' : 'fr', inscrites.has(apercu), ecole), saison, noms)}</pre>
    </div>`;
}

injectCSS('invitation', `
.inv-opts { justify-content: space-between; gap: .6rem; margin: .3rem 0 .6rem; }
.inv-autre { gap: .4rem; flex-wrap: nowrap; }
.inv-autre input { width: 8.5rem; }
.inv-list { list-style: none; margin: .2rem 0 .8rem; padding: 0; display: flex; flex-direction: column; }
.inv-row { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem .8rem; padding: .7rem .6rem; border-radius: var(--r-md); }
.inv-row + .inv-row { border-top: 1px solid var(--line); }
.inv-row.on { background: var(--sel-bg); box-shadow: inset 0 0 0 1px var(--sel-ring); }
.inv-row.on, .inv-row.on + .inv-row { border-top-color: transparent; }
.inv-row .grow { min-width: 0; flex: 1 1 220px; display: flex; flex-direction: column; gap: .15rem; }
.inv-link { color: var(--ink-2); overflow-wrap: anywhere; font-size: var(--fs-2); }
.inv-act { display: flex; flex-wrap: wrap; gap: .3rem; }
a.pa-geste { text-decoration: none; }
/* « Fais venir ta promo » : une ligne, toute la ligne est le lien */
.promo-card { min-width: 0; }
.promo-lien { display: flex; align-items: center; gap: .85rem; min-height: 64px; padding: .7rem .8rem; padding-inline-start: 1rem; border-radius: var(--r-lg); background: var(--surface); box-shadow: var(--sh1);
  color: inherit; text-decoration: none; -webkit-tap-highlight-color: transparent; transition: transform .22s var(--ease), box-shadow .22s ease, background-color .2s; }
.promo-lien:active { transform: scale(.985); transition-duration: .08s; }
@media (hover: hover) and (pointer: fine) { .promo-lien:hover { box-shadow: var(--sh2); transform: translateY(-1px); } }
@media (prefers-reduced-motion: reduce) { .promo-lien:hover, .promo-lien:active { transform: none; } }
.promo-lien:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.promo-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .05rem; }
.promo-txt strong { font-weight: 650; line-height: 1.3; color: var(--ink); }
.promo-sous { font-size: var(--fs-2); line-height: 1.4; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Les camarades arrivés grâce au membre : sous « Message prêt pour WhatsApp », dans la même ligne (le cœur, le nombre, les prénoms) */
.promo-invites { display: flex; flex-wrap: wrap; align-items: center; gap: .1rem .4rem; margin-block-start: .2rem; font-size: var(--fs-2); line-height: 1.4; color: var(--ink-2); min-width: 0; }
.promo-invites > .ico { flex: none; color: var(--accent); }
.promo-invites > span:first-of-type { font-weight: 600; }
.promo-prenoms { min-width: 0; color: var(--muted); overflow-wrap: anywhere; }
.promo-ico { display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--tonal-bg); color: var(--tonal-ink); flex: none; }
.promo-go { flex: none; display: inline-grid; color: var(--muted); transition: transform .25s var(--ease), color .2s; }
.promo-lien:hover .promo-go { color: var(--accent); transform: translateX(2px); }
[dir="rtl"] .promo-lien:hover .promo-go { transform: translateX(-2px); }
.inv-msg { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; font-size: var(--fs-3); line-height: 1.55; padding: .8rem .9rem; border-radius: var(--r-md); background: var(--surface-2); color: var(--ink); }
`);
