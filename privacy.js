// Confidentialité (loi 09-08) : page publique, accord des anciens membres, « Mes données », désabonnement.
import { html, useState, useEffect } from './vendor/preact-htm.js';
import { Icon, Modal, BrandLogo, toast } from './ui.js';
import { PushToggle } from './pwa.js';
import { addAR } from './i18n.js';

// Arabe : textes ajoutés en Phase 3 (le reste est dans i18n-ar.js)
addAR({
  'Tes messages privés : textes, photos et messages vocaux échangés avec un autre membre.': 'رسائلك الخاصة: النصوص والصور والرسائل الصوتية المتبادلة مع عضو آخر.',
  'Un message privé n’est visible que par toi et la personne à qui tu écris. Ses photos et vocaux sont dans un espace privé et s’ouvrent par un lien temporaire. L’administration ne voit un message que si l’un de vous deux le signale.': 'لا يرى الرسالة الخاصة إلا أنت والشخص الذي تراسله. صورها وتسجيلاتها الصوتية محفوظة في فضاء خاص وتُفتح برابط مؤقت. لا ترى الإدارة رسالةً إلا إذا بلّغ عنها أحدكما.',
  'Tu peux bloquer un membre à tout moment : vous ne pouvez plus vous écrire.': 'يمكنك حظر عضو في أي وقت: لن يعود بإمكانكما المراسلة.',
  'Un message que tu supprimes est effacé pour vous deux, avec sa photo ou son vocal.': 'الرسالة التي تحذفها تُمحى لديكما معًا، مع صورتها أو تسجيلها الصوتي.',
  'Un email te prévient si un message attend depuis 30 minutes.': 'سيصلك بريد إذا انتظرتك رسالة 30 دقيقة.', 'Plus d’email pour les messages.': 'لا بريد بعد الآن للرسائل.',
  'M’envoyer un email quand un message m’attend (un toutes les 6 heures au plus)': 'أرسل لي بريدًا عندما تنتظرني رسالة (مرة كل 6 ساعات على الأكثر)',
  'Emails des messages': 'رسائل البريد الخاصة بالرسائل', 'Tu ne veux plus recevoir d’email quand un message t’attend ?': 'لا تريد تلقي بريد عندما تنتظرك رسالة؟',
  'C’est fait : plus d’email pour les messages.': 'تم: لا بريد بعد الآن للرسائل.',
  'Tes messages restent sur la plateforme, et les notifications sur le téléphone ne changent pas. Tu peux réactiver l’email dans « Mon profil ».': 'تبقى رسائلك على المنصة، ولا تتغير إشعارات الهاتف. يمكنك إعادة تفعيل البريد من «ملفي».',
  'Ce lien n’est plus valable. Connecte-toi et désactive l’email des messages dans « Mon profil ».': 'لم يعد هذا الرابط صالحًا. سجّل الدخول وألغِ بريد الرسائل من «ملفي».',
  'Ton profil : nom, rôle, filière, promo, et si tu les remplis : entreprise, poste, secteur, ville, pays, bio, compétences, LinkedIn, CV (fichier PDF ou lien), disponibilité.': 'ملفك الشخصي: الاسم، الدور، الشعبة، الدفعة، وإن ملأتها: الشركة، المنصب، القطاع، المدينة، البلد، النبذة، الكفاءات، LinkedIn، السيرة الذاتية (ملف PDF أو رابط)، التوفر.',
  'Tes coordonnées privées, si tu les donnes : téléphone, email de contact, autre moyen de te joindre.': 'معلومات اتصالك الخاصة إن قدمتها: الهاتف، بريد التواصل، أو وسيلة أخرى للوصول إليك.',
  'Ce que tu fais sur la plateforme : offres, candidatures, rendez-vous de mentorat, relectures de CV, questions et réponses, mercis, messages de groupe, cafés, inscriptions aux événements de l’école.': 'ما تقوم به على المنصة: العروض، الترشيحات، مواعيد الإرشاد، مراجعات السيرة الذاتية، الأسئلة والأجوبة، رسائل الشكر، رسائل المجموعات، اللقاءات، والتسجيل في أنشطة المدرسة.',
  'Ce que tu partages pour les suivants, si tu le fais : avis de stage, questions d’entretien, rubriques du guide de l’étranger, réponses à l’enquête d’insertion.': 'ما تشاركه لفائدة الدفعات القادمة إن فعلت: آراء التداريب، أسئلة المقابلات، أقسام دليل الخارج، وأجوبة استبيان الإدماج.',
  'Te proposer ce qui te correspond (ton année, ta filière, ta ville), et t’alerter quand une offre pour toi est publiée.': 'اقتراح ما يناسبك (سنتك، شعبتك، مدينتك)، وتنبيهك عند نشر عرض يخصك.',
  'Suivre chaque promo jusqu’au premier emploi, avec des chiffres globaux par promo et par filière, utiles aussi aux rapports officiels de l’école.': 'تتبع كل دفعة حتى أول عمل، بأرقام إجمالية حسب الدفعة والشعبة، تفيد أيضًا في التقارير الرسمية للمدرسة.',
  'T’envoyer les emails utiles : rendez-vous, alertes d’offres, enquête d’insertion, et un résumé par semaine si tu le gardes activé.': 'إرسال الرسائل المفيدة إليك: المواعيد، تنبيهات العروض، استبيان الإدماج، وملخص أسبوعي إن أبقيته مفعّلًا.',
  'Garder la plateforme sûre : vérification des lauréats, signalements, limites contre le spam.': 'الحفاظ على أمان المنصة: التحقق من الخريجين، البلاغات، وحدود ضد الرسائل المزعجة.',
  'Tu choisis qui voit ton entreprise, ta ville, ton LinkedIn, ta présentation et ton CV : tous les membres, seulement les lauréats, ou seulement tes contacts.': 'أنت تختار من يرى شركتك ومدينتك وحساب LinkedIn ونبذتك وسيرتك الذاتية: كل الأعضاء، أو الخريجون فقط، أو جهات اتصالك فقط.',
  'Tes coordonnées ne sont visibles que par les membres dont tu acceptes la demande, et par le lauréat à qui tu envoies une candidature. Tu peux retirer ton accord à tout moment.': 'لا يرى معلومات اتصالك إلا الأعضاء الذين تقبل طلبهم، والخريج الذي ترسل إليه ترشيحك. ويمكنك سحب موافقتك في أي وقت.',
  'Ton CV en PDF est rangé dans un espace privé. Il s’ouvre par un lien valable 10 minutes, et seulement pour les personnes autorisées : celles de ton choix, le lauréat à qui tu postules, le lauréat qui relit ton CV.': 'تُحفظ سيرتك الذاتية (PDF) في مساحة خاصة، وتُفتح برابط صالح لمدة 10 دقائق، وفقط للأشخاص المسموح لهم: من تختارهم، والخريج الذي تترشح لديه، والخريج الذي يراجع سيرتك.',
  'Un avis de stage ou un entretien publié en anonyme n’affiche pas ton nom aux membres.': 'الرأي حول تدريب أو المقابلة المنشورة دون اسم لا تُظهر اسمك للأعضاء.',
  'Sécurité et modération': 'الأمان والإشراف',
  'Chacun peut signaler un contenu ou un profil. Seule l’administration voit le signalement ; la personne concernée ne sait pas qui l’a fait.': 'يمكن لكل عضو الإبلاغ عن محتوى أو ملف. الإدارة وحدها ترى البلاغ، ولا يعرف الشخص المعني من قام به.',
  'L’administration examine chaque signalement et peut retirer un contenu qui ne respecte pas la communauté.': 'تفحص الإدارة كل بلاغ ويمكنها حذف أي محتوى لا يحترم المجتمع.',
  'Pour éviter le spam, chaque compte a des limites par jour : candidatures, messages, publications et demandes de contact.': 'لتفادي الرسائل المزعجة، لكل حساب حدود يومية: الترشيحات، الرسائل، المنشورات، وطلبات الاتصال.',
  'Un lauréat reçoit son badge « vérifié » par l’administration, ou quand deux lauréats déjà vérifiés de sa promo le confirment.': 'يحصل الخريج على شارة «موثَّق» من الإدارة، أو عندما يؤكده خريجان موثَّقان من دفعته.',
  'L’école peut importer sa liste officielle des étudiants (nom, promo, filière, email de l’école). Elle sert seulement à vérifier les inscriptions et seule l’administration la voit.': 'يمكن للمدرسة استيراد لائحتها الرسمية للطلبة (الاسم، الدفعة، الشعبة، بريد المدرسة). تُستعمل فقط للتحقق من التسجيلات، ولا تراها إلا الإدارة.',
  'Enquête d’insertion': 'استبيان الإدماج المهني',
  'Six mois puis douze mois après le diplôme, un court questionnaire te demande ta situation (emploi, recherche, études…).': 'بعد ستة أشهر ثم اثني عشر شهرًا من التخرج، يسألك استبيان قصير عن وضعيتك (عمل، بحث، دراسة…).',
  'Les réponses sont publiées seulement en chiffres globaux par promo et par filière, jamais en dessous de 5 réponses. Seule l’administration voit les réponses individuelles.': 'لا تُنشر الأجوبة إلا كأرقام إجمالية حسب الدفعة والشعبة، ولا تُنشر أبدًا إذا قلّت عن 5 أجوبة. الإدارة وحدها ترى الأجوبة الفردية.',
  'Répondre est facultatif.': 'الإجابة اختيارية.',
  'Base de données, comptes et CV : Supabase, serveurs à Paris (Union européenne).': 'قاعدة البيانات والحسابات والسير الذاتية: Supabase، خوادم في باريس (الاتحاد الأوروبي).',
  'Site : GitHub Pages. Emails : le compte Gmail de la plateforme (Google) et Brevo (Union européenne). Visio : Jitsi Meet, quand tu rejoins un rendez-vous.': 'الموقع: GitHub Pages. الرسائل: حساب Gmail الخاص بالمنصة (Google) وBrevo (الاتحاد الأوروبي). المكالمات المرئية: Jitsi Meet عند انضمامك إلى موعد.',
  'Tant que ton compte existe. Quand tu le supprimes, ton profil, ton CV et tout ce qui t’est lié sont effacés tout de suite. Seuls restent des chiffres globaux sans nom.': 'ما دام حسابك موجودًا. عند حذفه، يُمحى ملفك وسيرتك الذاتية وكل ما يرتبط بك فورًا، ولا تبقى إلا أرقام إجمالية بدون أسماء.',
  'Quand tu remplaces ou retires ton CV, l’ancien fichier est effacé, sauf s’il est encore lié à une relecture.': 'عندما تستبدل سيرتك الذاتية أو تحذفها، يُمحى الملف القديم، إلا إذا كان مرتبطًا بمراجعة.',
  'Opposition : désactive les emails, les alertes d’offres ou les notifications en un clic. Le résumé et les alertes par email ont chacun un lien pour se désabonner.': 'الاعتراض: أوقف الرسائل أو تنبيهات العروض أو الإشعارات بنقرة واحدة. ويحتوي الملخص وتنبيهات البريد على رابط لإلغاء الاشتراك.',
  'M’alerter dès qu’une offre de mon année et de ma filière est publiée': 'نبّهني فور نشر عرض يخص سنتي وشعبتي',
  'Aussi par email (3 au plus par jour)': 'أيضًا عبر البريد (3 على الأكثر في اليوم)',
  'Tu seras alerté(e) dès qu’une offre pour toi est publiée.': 'سيصلك تنبيه فور نشر عرض يخصك.', 'Plus d’alertes d’offres.': 'لا مزيد من تنبيهات العروض.',
  'Alertes d’offres par email': 'تنبيهات العروض عبر البريد',
  'Tu ne veux plus recevoir les alertes d’offres par email ?': 'ألا تريد تلقي تنبيهات العروض عبر البريد بعد الآن؟',
  'Tu ne recevras plus les alertes d’offres par email.': 'لن تصلك بعد الآن تنبيهات العروض عبر البريد.',
  'Les notifications sur le téléphone et le résumé de la semaine ne changent pas. Tu peux les réactiver dans « Mon profil ».': 'إشعارات الهاتف والملخص الأسبوعي لا تتغير. ويمكنك إعادة تفعيل التنبيهات من «ملفي الشخصي».',
  'Ce lien n’est plus valable. Connecte-toi et désactive les alertes dans « Mon profil ».': 'هذا الرابط لم يعد صالحًا. سجّل الدخول وأوقف التنبيهات من «ملفي الشخصي».',
});


const cfg = () => (typeof window !== 'undefined' && window.ENSAM_CONFIG) || {};

// Le texte est court et concret : ce qui est collecté, pourquoi, qui le voit, où il est stocké, combien de temps, les droits.
const SECTIONS = [
  ['user', 'Ce que nous collectons', [
    'Ton compte : ton email et ton mot de passe (chiffré, jamais visible, même par l’administration).',
    'Ton profil : nom, rôle, filière, promo, et si tu les remplis : entreprise, poste, secteur, ville, pays, bio, compétences, LinkedIn, CV (fichier PDF ou lien), disponibilité.',
    'Tes coordonnées privées, si tu les donnes : téléphone, email de contact, autre moyen de te joindre.',
    'Ce que tu fais sur la plateforme : offres, candidatures, rendez-vous de mentorat, relectures de CV, questions et réponses, mercis, messages de groupe, cafés, inscriptions aux événements de l’école.',
    'Tes messages privés : textes, photos et messages vocaux échangés avec un autre membre.',
    'Ce que tu partages pour les suivants, si tu le fais : avis de stage, questions d’entretien, rubriques du guide de l’étranger, réponses à l’enquête d’insertion.',
    'Si tu les actives : l’adresse technique de ton téléphone pour les notifications, et ta langue préférée pour les emails.',
  ]],
  ['spark', 'Pourquoi', [
    'Mettre en relation les étudiants et les lauréats de l’ENSAM Meknès : offres, mentorat, entraide.',
    'Te proposer ce qui te correspond (ton année, ta filière, ta ville), et t’alerter quand une offre pour toi est publiée.',
    'Suivre chaque promo jusqu’au premier emploi, avec des chiffres globaux par promo et par filière, utiles aussi aux rapports officiels de l’école.',
    'T’envoyer les emails utiles : rendez-vous, alertes d’offres, enquête d’insertion, et un résumé par semaine si tu le gardes activé.',
    'Garder la plateforme sûre : vérification des lauréats, signalements, limites contre le spam.',
  ]],
  ['people', 'Qui voit quoi', [
    'Ton profil est visible par les membres connectés, jamais par le public ni par les moteurs de recherche.',
    'Tu choisis qui voit ton entreprise, ta ville, ton LinkedIn, ta présentation et ton CV : tous les membres, seulement les lauréats, ou seulement tes contacts.',
    'Tes coordonnées ne sont visibles que par les membres dont tu acceptes la demande, et par le lauréat à qui tu envoies une candidature. Tu peux retirer ton accord à tout moment.',
    'Ton CV en PDF est rangé dans un espace privé. Il s’ouvre par un lien valable 10 minutes, et seulement pour les personnes autorisées : celles de ton choix, le lauréat à qui tu postules, le lauréat qui relit ton CV.',
    'Une candidature n’est visible que par toi et par le lauréat qui a publié l’offre.',
    'Un message privé n’est visible que par toi et la personne à qui tu écris. Ses photos et vocaux sont dans un espace privé et s’ouvrent par un lien temporaire. L’administration ne voit un message que si l’un de vous deux le signale.',
    'Un étudiant ne voit que les offres de son année ; les offres entre lauréats ne sont pas visibles par les étudiants.',
    'Un avis de stage ou un entretien publié en anonyme n’affiche pas ton nom aux membres.',
    'L’administration voit les emails des comptes, seulement pour vérifier les lauréats et aider en cas de problème.',
    'Une attestation de lauréat peut être vérifiée par un lien que son titulaire choisit de partager.',
  ]],
  ['flag', 'Sécurité et modération', [
    'Chacun peut signaler un contenu ou un profil. Seule l’administration voit le signalement ; la personne concernée ne sait pas qui l’a fait.',
    'L’administration examine chaque signalement et peut retirer un contenu qui ne respecte pas la communauté.',
    'Pour éviter le spam, chaque compte a des limites par jour : candidatures, messages, publications et demandes de contact.',
    'Tu peux bloquer un membre à tout moment : vous ne pouvez plus vous écrire.',
    'Un lauréat reçoit son badge « vérifié » par l’administration, ou quand deux lauréats déjà vérifiés de sa promo le confirment.',
    'L’école peut importer sa liste officielle des étudiants (nom, promo, filière, email de l’école). Elle sert seulement à vérifier les inscriptions et seule l’administration la voit.',
  ]],
  ['chart', 'Enquête d’insertion', [
    'Six mois puis douze mois après le diplôme, un court questionnaire te demande ta situation (emploi, recherche, études…).',
    'Les réponses sont publiées seulement en chiffres globaux par promo et par filière, jamais en dessous de 5 réponses. Seule l’administration voit les réponses individuelles.',
    'Répondre est facultatif.',
  ]],
  ['shield', 'Ce que nous ne faisons pas', [
    'Aucune vente ni location de données, aucune publicité, aucun traceur publicitaire.',
    'Le navigateur garde seulement ta langue et tes préférences d’affichage.',
  ]],
  ['globe', 'Où sont les données', [
    'Base de données, comptes et CV : Supabase, serveurs à Paris (Union européenne).',
    'Site : GitHub Pages. Emails : le compte Gmail de la plateforme (Google) et Brevo (Union européenne). Visio : Jitsi Meet, quand tu rejoins un rendez-vous.',
    'Carte : fonds OpenStreetMap et CARTO. Polices : Google Fonts. Notifications du téléphone : le service de ton navigateur (Google, Apple ou Mozilla), seulement si tu les actives.',
  ]],
  ['clock', 'Combien de temps', [
    'Tant que ton compte existe. Quand tu le supprimes, ton profil, ton CV et tout ce qui t’est lié sont effacés tout de suite. Seuls restent des chiffres globaux sans nom.',
    'Quand tu remplaces ou retires ton CV, l’ancien fichier est effacé, sauf s’il est encore lié à une relecture.',
    'Les notifications en attente sont effacées dès leur envoi.',
    'Un message que tu supprimes est effacé pour vous deux, avec sa photo ou son vocal.',
  ]],
  ['check', 'Tes droits (loi 09-08)', [
    'Accès : télécharge toutes tes données depuis « Mon profil ».',
    'Rectification : modifie ton profil à tout moment.',
    'Opposition : désactive les emails, les alertes d’offres ou les notifications en un clic. Le résumé et les alertes par email ont chacun un lien pour se désabonner.',
    'Suppression : supprime ton compte depuis « Mon profil », sans rien demander à personne.',
    'Tu peux aussi saisir la CNDP (Commission nationale de contrôle de la protection des données à caractère personnel) : cndp.ma.',
  ]],
];

export function PrivacyPage({ onBack }) {
  const c = cfg();
  return html`<section class="page narrow privacy">
    <header class="page-head"><div class="row"><${BrandLogo} size=${44}/><div><p class="eyebrow">Réseau ENSAM Meknès</p><h1>Confidentialité</h1></div></div>
      ${onBack ? html`<button class="btn ghost" onClick=${onBack}>← Retour</button>` : null}</header>
    <p class="lead">Cette plateforme est faite par et pour la communauté de l’ENSAM Meknès. Tes données servent à une seule chose : t’aider à trouver ou à aider.</p>
    ${SECTIONS.map(([ic, h, items]) => html`<div class="panel priv-sec"><h2 class="h-ico"><${Icon} name=${ic}/> ${h}</h2><ul>${items.map(t => html`<li>${t}</li>`)}</ul></div>`)}
    <div class="panel priv-sec"><h2 class="h-ico"><${Icon} name="inbox"/> Contact</h2>
      <p>Responsable du traitement : l’équipe qui administre le Réseau ENSAM Meknès.</p>
      ${c.contactEmail ? html`<p>Pour toute question sur tes données : <a href=${'mailto:' + c.contactEmail} dir="ltr" translate="no">${c.contactEmail}</a></p>` : html`<p>Pour toute question sur tes données, écris à l’administration depuis la plateforme (Entraide ou profil d’un administrateur).</p>`}
      ${c.cndp ? html`<p class="small muted">Déclaration CNDP : <span dir="ltr" translate="no">${c.cndp}</span></p>` : null}
    </div>
    <p class="small muted">Dernière mise à jour : octobre 2026.</p>
  </section>`;
}

// Les membres inscrits avant cette page donnent leur accord une fois (mode réel uniquement).
export function ConsentModal({ ctx }) {
  const { me, store, act, go } = ctx;
  const [ok, setOk] = useState(false);
  const [mails, setMails] = useState(me.emails_hebdo !== false);
  return html`<div class="modal-back consent-back"><div class="modal" role="dialog" aria-modal="true" aria-label="Tes données">
    <header class="modal-head"><h2>Tes données, en clair</h2></header>
    <div class="modal-body form">
      <p>Nous avons écrit une page « Confidentialité » : ce que la plateforme garde sur toi, qui le voit, et comment tout supprimer. Lis-la et donne ton accord pour continuer.</p>
      <button class="linkish" onClick=${() => go('confidentialite')}><${Icon} name="shield" size=${15}/> Lire la page Confidentialité</button>
      <label class="check"><input id="cs-ok" type="checkbox" checked=${ok} onChange=${e => setOk(e.target.checked)}/> J’ai lu la page Confidentialité et j’accepte que mes données servent au réseau.</label>
      <label class="check"><input id="cs-mail" type="checkbox" checked=${mails} onChange=${e => setMails(e.target.checked)}/> Recevoir un résumé par email chaque semaine</label>
      <div class="row-end"><button class="btn ghost" onClick=${() => go('profil')}>Supprimer mon compte</button>
        <button class="btn primary" disabled=${!ok} onClick=${() => act(async () => { await store.update('profiles', me.id, { consent_at: new Date().toISOString(), emails_hebdo: mails }); toast('Merci, c’est enregistré.'); })}>Continuer</button></div>
    </div>
  </div></div>`;
}

// « Mes données » dans Mon profil : emails, notifications, téléchargement, suppression
export function MesDonnees({ ctx }) {
  const { me, store, act, go, data } = ctx;
  const [del, setDel] = useState(false);
  const exportData = () => {
    const mine = {};
    const owner = { offers: ['author_id'], comments: ['author_id'], reactions: ['user_id'], applications: ['student_id'], placements: ['student_id', 'laureat_id'], mentorships: ['student_id', 'mentor_id'], questions: ['author_id'], answers: ['author_id'], votes: ['user_id'], shortlists: ['laureat_id', 'student_id'], invitations: ['laureat_id', 'student_id'], kudos: ['user_id'], attestations: ['laureat_id'], groupe_messages: ['author_id'], groupe_membres: ['user_id'], cafes: ['organisateur_id'], cafe_participants: ['user_id'], startups: ['fondateur_id'], parrainages: ['filleul_id', 'parrain_id'] };
    Object.assign(owner, { coordonnees: ['id'], demandes_contact: ['demandeur_id', 'cible_id'], relectures_cv: ['student_id', 'reviewer_id'], entretiens: ['author_id'], avis_stage: ['author_id'], enquetes_insertion: ['user_id'], signalements: ['auteur_id'], evenement_participants: ['user_id'], verifications_pairs: ['laureat_id', 'verificateur_id'], messages: ['author_id', 'dest_id'], blocages: ['user_id'] });
    for (const [t, cols] of Object.entries(owner)) mine[t] = (data[t] || []).filter(r => cols.some(c => r[c] === me.id));
    const relues = new Set(mine.relectures_cv.map(r => r.id));
    mine.relecture_commentaires = (data.relecture_commentaires || []).filter(c => c.author_id === me.id || relues.has(c.relecture_id));
    const out = { exporte_le: new Date().toISOString(), plateforme: 'Réseau ENSAM Meknès', email: store.session?.user?.email || null, profil: me, ...mine };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
    a.download = 'mes-donnees-reseau-ensam.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return html`<div class="panel" id="mes-donnees">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="shield"/> Mes données et notifications</h2><button class="btn tiny ghost" onClick=${() => go('confidentialite')}>Confidentialité <${Icon} name="arrow" size=${14}/></button></div>
    <label class="check"><input id="md-mail" type="checkbox" checked=${me.emails_hebdo !== false} onChange=${e => act(async () => { await store.update('profiles', me.id, { emails_hebdo: e.target.checked }); toast(e.target.checked ? 'Tu recevras un résumé chaque semaine.' : 'Plus de résumé par email.'); })}/> Recevoir un résumé par email chaque semaine</label>
    ${me.role === 'etudiant' && (store.mode !== 'live' || 'alertes_offres' in me) ? html`<div class="cf-alertes">
      <label class="check"><input id="md-alertes" type="checkbox" checked=${me.alertes_offres !== false} onChange=${e => act(async () => { await store.update('profiles', me.id, { alertes_offres: e.target.checked }); toast(e.target.checked ? 'Tu seras alerté(e) dès qu’une offre pour toi est publiée.' : 'Plus d’alertes d’offres.'); })}/> M’alerter dès qu’une offre de mon année et de ma filière est publiée</label>
      ${me.alertes_offres !== false ? html`<label class="check sub"><input id="md-alertes-mail" type="checkbox" checked=${me.alertes_email !== false} onChange=${e => act(() => store.update('profiles', me.id, { alertes_email: e.target.checked }))}/> Aussi par email (3 au plus par jour)</label>` : null}
    </div>` : null}
    ${store.mode !== 'live' || 'emails_messages' in me ? html`<label class="check"><input id="md-msg-mail" type="checkbox" checked=${me.emails_messages !== false} onChange=${e => act(async () => { await store.update('profiles', me.id, { emails_messages: e.target.checked }); toast(e.target.checked ? 'Un email te prévient si un message attend depuis 30 minutes.' : 'Plus d’email pour les messages.'); })}/> M’envoyer un email quand un message m’attend (un toutes les 6 heures au plus)</label>` : null}
    <${PushToggle} ctx=${ctx}/>
    <div class="row">
      <button class="btn small" onClick=${exportData}><${Icon} name="download" size=${15}/> Télécharger mes données</button>
      <span class="spacer"></span>
      <button class="btn small ghost danger-t" onClick=${() => setDel(true)}><${Icon} name="trash" size=${15}/> Supprimer mon compte</button>
    </div>
    ${del ? html`<${DeleteAccount} ctx=${ctx} onClose=${() => setDel(false)}/>` : null}
  </div>`;
}

function DeleteAccount({ ctx, onClose }) {
  const { store, act } = ctx;
  const [txt, setTxt] = useState('');
  const word = 'SUPPRIMER';
  return html`<${Modal} title="Supprimer mon compte" onClose=${onClose}>
    <div class="form">
      <p>Ton profil, tes offres, tes candidatures, tes messages et tes rendez-vous seront effacés tout de suite. Cette action est définitive.</p>
      <p class="small muted">Tu peux d’abord télécharger tes données.</p>
      <label class="field"><span class="field-label">Écris SUPPRIMER pour confirmer</span><input id="del-txt" value=${txt} onInput=${e => setTxt(e.target.value)} autocomplete="off" dir="ltr"/></label>
      <div class="row-end"><button class="btn ghost" onClick=${onClose}>Annuler</button>
        <button class="btn danger" disabled=${txt.trim().toUpperCase() !== word} onClick=${() => act(async () => { await store.supprimerCompte(); onClose(); toast('Ton compte a été supprimé. Au revoir et bonne route !'); })}>Supprimer définitivement</button></div>
    </div>
  <//>`;
}

// Lien « Se désabonner » des emails : page publique, un bouton, sans connexion.
// quoi = 'alertes' pour les alertes d'offres (#desabo/<jeton>/alertes), 'messages' pour les emails de messages,
// sinon le résumé de la semaine.
export function DesaboPage({ store, token, quoi }) {
  return quoi === 'messages' ? html`<${DesaboMessages} store=${store} token=${token}/>` : html`<${DesaboEmails} store=${store} token=${token} alertes=${quoi === 'alertes'} key=${quoi || 'hebdo'}/>`;
}
function DesaboEmails({ store, token, alertes }) {
  const [state, setState] = useState('ask'); // ask | busy | ok | ko
  useEffect(() => { if (!token) setState('ko'); }, [token]);
  const go = async () => { setState('busy'); setState(await (alertes ? store.seDesabonnerAlertes(token) : store.seDesabonner(token)).catch(() => false) ? 'ok' : 'ko'); };
  return html`<div class="auth-card desabo">
    <${BrandLogo} size=${52}/>
    <h1>${alertes ? 'Alertes d’offres par email' : 'Résumé par email'}</h1>
    ${state === 'ask' || state === 'busy' ? html`<p>${alertes ? 'Tu ne veux plus recevoir les alertes d’offres par email ?' : 'Tu ne veux plus recevoir le résumé de la semaine ?'}</p>
      <button class="btn primary" disabled=${state === 'busy'} onClick=${go}>${state === 'busy' ? '…' : 'Me désabonner'}</button>` : null}
    ${state === 'ok' && alertes ? html`<p class="verify-ok"><${Icon} name="check"/> Tu ne recevras plus les alertes d’offres par email.</p><p class="small muted">Les notifications sur le téléphone et le résumé de la semaine ne changent pas. Tu peux les réactiver dans « Mon profil ».</p>` : null}
    ${state === 'ok' && !alertes ? html`<p class="verify-ok"><${Icon} name="check"/> C’est fait : tu ne recevras plus le résumé par email.</p><p class="small muted">Tu peux le réactiver à tout moment dans « Mon profil ».</p>` : null}
    ${state === 'ko' ? html`<p class="verify-ko">${alertes ? 'Ce lien n’est plus valable. Connecte-toi et désactive les alertes dans « Mon profil ».' : 'Ce lien n’est plus valable. Connecte-toi et désactive le résumé dans « Mon profil ».'}</p>` : null}
    <a class="btn ghost" href="#accueil">Aller sur la plateforme</a>
  </div>`;
}

function DesaboMessages({ store, token }) {
  const [state, setState] = useState(token ? 'ask' : 'ko');
  const go = async () => { setState('busy'); setState(await store.seDesabonnerMessages(token).catch(() => false) ? 'ok' : 'ko'); };
  return html`<div class="auth-card desabo">
    <${BrandLogo} size=${52}/>
    <h1>Emails des messages</h1>
    ${state === 'ask' || state === 'busy' ? html`<p>Tu ne veux plus recevoir d’email quand un message t’attend ?</p>
      <button class="btn primary" disabled=${state === 'busy'} onClick=${go}>${state === 'busy' ? '…' : 'Me désabonner'}</button>` : null}
    ${state === 'ok' ? html`<p class="verify-ok"><${Icon} name="check"/> C’est fait : plus d’email pour les messages.</p><p class="small muted">Tes messages restent sur la plateforme, et les notifications sur le téléphone ne changent pas. Tu peux réactiver l’email dans « Mon profil ».</p>` : null}
    ${state === 'ko' ? html`<p class="verify-ko">Ce lien n’est plus valable. Connecte-toi et désactive l’email des messages dans « Mon profil ».</p>` : null}
    <a class="btn ghost" href="#accueil">Aller sur la plateforme</a>
  </div>`;
}
