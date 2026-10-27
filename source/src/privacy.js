// Confidentialité (loi 09-08) : page publique, accord des anciens membres, « Mes données », désabonnement.
import { html, useState, useEffect, useRef } from './vendor/preact-htm.js';
import { Icon, Modal, BrandLogo, toast } from './ui.js';
import { PushToggle } from './pwa.js';
import { PUSH_CATEGORIES, pushChoix } from './logic.js';
import { addAR } from './i18n.js';
import { adresseContact } from './regles-entree.js';
import { FondateurPublicCase } from './fondateurs.js';
import { RAPPELS_NOTIF, PHRASE_VISITE, DesaboRappels } from './rappels.js';

// Arabe : textes ajoutés en Phase 3 (le reste est dans i18n-ar.js)
addAR({
  'La semaine de ton inscription, le résumé par email peut citer ton nom et ta promo (ou ton année) aux membres de ta promo ou de ta filière, comme le fait l’annuaire.': 'في أسبوع تسجيلك، قد يذكر الملخص الأسبوعي اسمك ودفعتك (أو سنتك) لأعضاء دفعتك أو شعبتك، كما يفعل الدليل.',
  'Tes messages privés : textes, photos, messages vocaux et réactions échangés avec un autre membre.': 'رسائلك الخاصة: النصوص والصور والرسائل الصوتية والتفاعلات المتبادلة مع عضو آخر.',
  'Un message privé n’est visible que par toi et la personne à qui tu écris. Ses photos et vocaux sont dans un espace privé et s’ouvrent par un lien temporaire. L’administration ne voit un message que si l’un de vous deux le signale.': 'لا يرى الرسالة الخاصة إلا أنت والشخص الذي تراسله. صورها وتسجيلاتها الصوتية محفوظة في فضاء خاص وتُفتح برابط مؤقت. لا ترى الإدارة رسالةً إلا إذا بلّغ عنها أحدكما.',
  'Tu peux bloquer un membre à tout moment : vous ne pouvez plus vous écrire.': 'يمكنك حظر عضو في أي وقت: لن يعود بإمكانكما المراسلة.',
  'Un message que tu supprimes est effacé pour vous deux, avec sa photo ou son vocal et ses réactions.': 'الرسالة التي تحذفها تُمحى لديكما معًا، مع صورتها أو تسجيلها الصوتي وتفاعلاتها.',
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
  'Suivre chaque promo jusqu’au premier emploi, avec des chiffres globaux par promo et par filière, utiles aux étudiants et aux promos suivantes.': 'تتبع كل دفعة حتى أول عمل، بأرقام إجمالية حسب الدفعة والشعبة، تفيد الطلبة والدفعات القادمة.',
  'T’envoyer les emails utiles : rendez-vous, alertes d’offres, enquête d’insertion, et un résumé par semaine si tu le gardes activé.': 'إرسال الرسائل المفيدة إليك: المواعيد، تنبيهات العروض، استبيان الإدماج، وملخص أسبوعي إن أبقيته مفعّلًا.',
  'Garder la plateforme sûre : vérification des lauréats, signalements, limites contre le spam.': 'الحفاظ على أمان المنصة: التحقق من الخريجين، البلاغات، وحدود ضد الرسائل المزعجة.',
  'Tu choisis qui voit ton entreprise, ta ville, ton LinkedIn, ta présentation et ton CV : tous les membres, seulement les lauréats, ou seulement tes contacts.': 'أنت تختار من يرى شركتك ومدينتك وحساب LinkedIn ونبذتك وسيرتك الذاتية: كل الأعضاء، أو الخريجون فقط، أو جهات اتصالك فقط.',
  'Tes coordonnées ne sont visibles que par tes contacts (les membres avec qui tu les partages, l’auteur d’une offre où tu postules, la personne qu’une demande a réunie avec toi) et par l’administration. Tu peux retirer ton accord à tout moment.': 'لا يرى معلومات اتصالك إلا جهات اتصالك (الأعضاء الذين تتبادلها معهم، وصاحب عرض ترشحت له، والشخص الذي جمعك به طلب) والإدارة. ويمكنك سحب موافقتك في أي وقت.',
  'Ton CV en PDF est rangé dans un espace privé. Il s’ouvre par un lien valable 10 minutes, et seulement pour : les membres que tu choisis dans « Qui voit quoi », tes contacts (dont l’auteur d’une offre où tu postules), les lauréats quand tu as une demande ouverte, le lauréat qui relit ton CV (ou tous les lauréats tant que personne ne l’a pris), le lauréat avec qui tu as un match, et l’administration.': 'تُحفظ سيرتك الذاتية (PDF) في مساحة خاصة، وتُفتح برابط صالح لمدة 10 دقائق، وفقط لـ: الأعضاء الذين تختارهم في «من يرى ماذا»، وجهات اتصالك (ومنهم صاحب عرض ترشحت له)، والخريجين حين يكون لديك طلب مفتوح، والخريج الذي يراجع سيرتك (أو كل الخريجين ما دام لم يتكفل بها أحد)، والخريج الذي جمعك به توافق، والإدارة.',
  'Un avis de stage ou un entretien publié en anonyme n’affiche pas ton nom aux membres.': 'الرأي حول تدريب أو المقابلة المنشورة دون اسم لا تُظهر اسمك للأعضاء.',
  'Sécurité et modération': 'الأمان والإشراف',
  'Chacun peut signaler un contenu ou un profil. Seule l’administration voit le signalement ; la personne concernée ne sait pas qui l’a fait.': 'يمكن لكل عضو الإبلاغ عن محتوى أو ملف. الإدارة وحدها ترى البلاغ، ولا يعرف الشخص المعني من قام به.',
  'L’administration examine chaque signalement et peut retirer un contenu qui ne respecte pas la communauté.': 'تفحص الإدارة كل بلاغ ويمكنها حذف أي محتوى لا يحترم المجتمع.',
  'Pour éviter le spam, chaque compte a des limites par jour : candidatures, messages, publications et coordonnées demandées.': 'لتفادي الرسائل المزعجة، لكل حساب حدود يومية: الترشيحات، الرسائل، المنشورات، ومعلومات الاتصال المطلوبة.',
  'Un lauréat reçoit son badge « vérifié » par l’administration, ou quand deux lauréats déjà vérifiés de sa promo le confirment.': 'يحصل الخريج على شارة «موثَّق» من الإدارة، أو عندما يؤكده خريجان موثَّقان من دفعته.',
  'L’équipe du réseau peut importer la liste officielle des étudiants (nom, promo, filière, email de l’école). Elle sert seulement à vérifier les inscriptions et seule l’équipe du réseau la voit.': 'يمكن لفريق الشبكة استيراد اللائحة الرسمية للطلبة (الاسم، الدفعة، الشعبة، بريد المدرسة). تُستعمل فقط للتحقق من التسجيلات، ولا يراها إلا فريق الشبكة.',
  'Enquête d’insertion': 'استطلاع الإدماج المهني',
  'Six mois puis douze mois après le diplôme, un court questionnaire te demande ta situation (emploi, recherche, études…).': 'بعد ستة أشهر ثم اثني عشر شهرًا من التخرج، يسألك استبيان قصير عن وضعيتك (عمل، بحث، دراسة…).',
  'Les réponses sont publiées seulement en chiffres globaux par promo et par filière, jamais en dessous de 5 réponses. Seule l’administration voit les réponses individuelles.': 'لا تُنشر الأجوبة إلا كأرقام إجمالية حسب الدفعة والشعبة، ولا تُنشر أبدًا إذا قلّت عن 5 أجوبة. الإدارة وحدها ترى الأجوبة الفردية.',
  'Répondre est facultatif.': 'الإجابة اختيارية.',
  'Logos des entreprises : ceux gardés sur le site, sinon l’icône du site de l’entreprise, demandée à DuckDuckGo sans ton nom ni l’adresse de la page.': 'شعارات الشركات: المحفوظة على الموقع، وإلا فأيقونة موقع الشركة، تُطلب من DuckDuckGo دون اسمك ولا عنوان الصفحة.',
  'Base de données, comptes et CV : Supabase, serveurs à Paris (Union européenne).': 'قاعدة البيانات والحسابات والسير الذاتية: Supabase، خوادم في باريس (الاتحاد الأوروبي).',
  'Site : GitHub Pages. Emails : le compte Gmail de la plateforme (Google) et Brevo (Union européenne). Visio : Jitsi Meet, quand tu rejoins un rendez-vous.': 'الموقع: GitHub Pages. الرسائل: حساب Gmail الخاص بالمنصة (Google) وBrevo (الاتحاد الأوروبي). المكالمات المرئية: Jitsi Meet عند انضمامك إلى موعد.',
  'Tant que ton compte existe. Quand tu le supprimes, ton profil, ton CV et tout ce qui t’est lié sont effacés tout de suite. Seuls restent des chiffres globaux sans nom.': 'ما دام حسابك موجودًا. عند حذفه، يُمحى ملفك وسيرتك الذاتية وكل ما يرتبط بك فورًا، ولا تبقى إلا أرقام إجمالية بدون أسماء.',
  'Quand tu remplaces ou retires ton CV, l’ancien fichier est effacé, sauf s’il est encore lié à une relecture.': 'عندما تستبدل سيرتك الذاتية أو تحذفها، يُمحى الملف القديم، إلا إذا كان مرتبطًا بمراجعة.',
  'Opposition : désactive les emails, les alertes d’offres ou les notifications en un clic. Le résumé et les alertes par email ont chacun un lien pour se désabonner.': 'الاعتراض: أوقف الرسائل أو تنبيهات العروض أو الإشعارات بنقرة واحدة. ويحتوي الملخص وتنبيهات البريد على رابط لإلغاء الاشتراك.',
  'M’alerter dès qu’une offre de mon année et de ma filière est publiée': 'نبّهني فور نشر عرض يخص سنتي وشعبتي',
  'Aussi par email (3 au plus par jour)': 'أيضًا عبر البريد (3 على الأكثر في اليوم)',
  'On t’alerte dès qu’une offre pour toi est publiée.': 'سيصلك تنبيه فور نشر عرض يخصك.', 'Plus d’alertes d’offres.': 'لا مزيد من تنبيهات العروض.',
  'Alertes d’offres par email': 'تنبيهات العروض عبر البريد',
  'Tu ne veux plus recevoir les alertes d’offres par email ?': 'ألا تريد تلقي تنبيهات العروض عبر البريد بعد الآن؟',
  'Tu ne recevras plus les alertes d’offres par email.': 'لن تصلك بعد الآن تنبيهات العروض عبر البريد.',
  'Les notifications sur le téléphone et le résumé de la semaine ne changent pas. Tu peux les réactiver dans « Mon profil ».': 'إشعارات الهاتف والملخص الأسبوعي لا تتغير. ويمكنك إعادة تفعيل التنبيهات من «ملفي الشخصي».',
  'Tes données': 'بياناتك',
  'Ce lien n’est plus valable. Connecte-toi et désactive les alertes dans « Mon profil ».': 'هذا الرابط لم يعد صالحًا. سجّل الدخول وأوقف التنبيهات من «ملفي الشخصي».',
});

// Notifications sur le téléphone, par catégorie : les mots de chacun (étudiant ; lauréat, qui cherche un emploi ou non ;
// administration)
const CATS_NOTIF = {
  etudiant: {
    messages: ['Messages', 'Les messages qu’on t’envoie, entretiens proposés compris.'],
    match: ['Match', 'Un lauréat qui s’intéresse à ton profil, et tes nouveaux matchs.'],
    demandes: ['Mes demandes : les propositions d’aide', 'Un lauréat te propose son aide pour ta demande.'],
    candidatures: ['Mes candidatures', 'Une candidature qui avance, une invitation à postuler, un recrutement à confirmer.'],
    mentorat: ['Mentorat et rendez-vous', 'Rendez-vous et rappels, relectures de CV, partage de coordonnées, parrainage.'],
    offres: ['Nouvelles offres pour moi', 'Les offres de ton année et de ta filière, dès leur publication.'],
    reseau: ['Réponses à mes questions et vie du réseau', 'Réponses à tes questions et sous les offres où tu as écrit, nouveaux membres de ta promo, annonces et événements de l’école, cafés de ta ville.'],
    rappels: RAPPELS_NOTIF.etudiant,
  },
  laureat: {
    messages: ['Messages', 'Les messages qu’on t’envoie, entretiens proposés compris.'],
    match: ['Match', 'Un étudiant qui s’intéresse à ton offre, et tes nouveaux matchs.'],
    demandes: ['Demandes des étudiants', 'Celles de ta filière dès leur publication, celles des autres filières quand elles s’ouvrent à tous les lauréats, et la suite de tes propositions d’aide.'],
    // Tout lauréat peut postuler aux offres entre lauréats
    candidatures: ['Candidatures reçues sur mes offres', 'Et les recrutements confirmés ; si tu postules, la suite de tes candidatures.'],
    mentorat: ['Mentorat et rendez-vous', 'Mentorats à accepter ou ouverts à tous, coordonnées à partager, rappels de rendez-vous, CV à relire, parrainage, mercis.'],
    // Toute nouvelle offre de sa filière arrive à un lauréat (alerte_offre dans schema.sql), même une offre de stage :
    // il peut la faire suivre
    offres: ['Nouvelles offres de ma filière', 'Toutes les offres publiées pour ta filière, dès leur publication : celles qui te visent, et celles des étudiants, que tu peux faire suivre.'],
    // Un lauréat pose aussi des questions : les réponses passent par cette case
    reseau: ['Questions et vie du réseau', 'Réponses à tes questions, questions sur ton entreprise ou ton pays, commentaires sur tes offres, nouveaux membres et camarades de promo à confirmer, annonces et événements de l’école, enquête d’insertion, cafés de ta ville.'],
    rappels: RAPPELS_NOTIF.laureat,
  },
  // Un lauréat qui cherche un emploi publie sa demande d'emploi et postule : ces cases couvrent aussi les siennes
  recherche: {
    demandes: ['Mes demandes et celles des étudiants', 'Les réponses à ta demande d’emploi, les étudiants de ta filière qui cherchent de l’aide (puis ceux des autres filières, après 24 h sans aide), et la suite de tes propositions d’aide.'],
    candidatures: ['Candidatures', 'La suite des tiennes (entretien, recrutement à confirmer) et les candidatures reçues sur tes offres.'],
    offres: ['Nouvelles offres de ma filière', 'Offres « Jeunes diplômés », offres entre lauréats et offres des étudiants de ta filière, dès leur publication.'],
  },
  // L'équipe du réseau ne postule pas, et les questions sur une entreprise ou un pays ne vont qu'aux lauréats
  admin: {
    candidatures: ['Candidatures reçues sur mes offres', 'Et les recrutements confirmés.'],
    reseau: ['Réponses à mes questions et vie du réseau', 'Réponses à tes questions, commentaires sur tes offres, événements de l’école, cafés de ta ville.'],
  },
};
const motsNotif = me => (me.role === 'etudiant' ? CATS_NOTIF.etudiant
  : { ...CATS_NOTIF.laureat, ...(me.role === 'admin' ? CATS_NOTIF.admin : me.en_recherche ? CATS_NOTIF.recherche : {}) });
// L'équipe du réseau ne reçoit ni les nouvelles demandes d'étudiants (réservées aux lauréats) ni d'alertes d'offres :
// pas de case qui ne servirait à rien (les signalements, eux, arrivent toujours)
// (ni de rappels de visite : ils ne vont qu'aux étudiants et aux lauréats)
// Avant mise-a-jour.sql, la base refuse la clé « rappels » dans notif_push : pas de case (même migration que offers.origine)
// Match : ni pour l'équipe du réseau (elle n'y participe pas), ni avant mise-a-jour.sql (la base refuserait la clé « match » ;
// la colonne match_visible du profil arrive avec elle)
const matchPret = (me, store) => store?.mode !== 'live' || (!!me && 'match_visible' in me);
const catsNotif = (me, store) => PUSH_CATEGORIES.filter(c => (me.role !== 'admin' || (c !== 'demandes' && c !== 'offres' && c !== 'rappels' && c !== 'match'))
  && (c !== 'rappels' || !store?.peutOrigine || store.peutOrigine()) && (c !== 'match' || matchPret(me, store)));
const NOTES_NOTIF = {
  tous: 'Tes choix valent pour tous les appareils où les notifications sont activées.',
  admin: 'Les signalements arrivent toujours à l’équipe du réseau.',
};
addAR({
  'Par email': 'عبر البريد الإلكتروني', 'Sur tes appareils': 'على أجهزتك', 'Ce que je reçois': 'ما يصلني', 'Choix enregistré.': 'تم حفظ اختيارك.',
  'Recevoir par email les nouvelles offres de mon année et de ma filière (3 au plus par jour)': 'استلام العروض الجديدة الخاصة بسنتي وشعبتي عبر البريد (3 على الأكثر في اليوم)',
  [NOTES_NOTIF.tous]: 'تسري اختياراتك على كل الأجهزة التي فُعّلت فيها الإشعارات.',
  [NOTES_NOTIF.admin]: 'تصل البلاغات دائمًا إلى فريق الشبكة.',
  [CATS_NOTIF.etudiant.messages[1]]: 'الرسائل التي تُرسل إليك، بما فيها المقابلات المقترحة.',
  [CATS_NOTIF.etudiant.match[1]]: 'اهتمام أحد الخريجين بملفك، والتوافقات الجديدة.',
  [CATS_NOTIF.laureat.match[1]]: 'اهتمام أحد الطلبة بعرضك، والتوافقات الجديدة.',
  [CATS_NOTIF.etudiant.demandes[0]]: 'طلباتي: اقتراحات المساعدة',
  [CATS_NOTIF.etudiant.demandes[1]]: 'خريج يقترح عليك مساعدته في طلبك.',
  [CATS_NOTIF.etudiant.candidatures[1]]: 'ترشيح يتقدّم، دعوة للترشح، توظيف ينتظر تأكيدك.',
  [CATS_NOTIF.etudiant.mentorat[0]]: 'الإرشاد والمواعيد',
  [CATS_NOTIF.etudiant.mentorat[1]]: 'المواعيد والتذكير بها، مراجعات السيرة الذاتية، مشاركة معلومات الاتصال، الرعاية.',
  [CATS_NOTIF.etudiant.offres[0]]: 'عروض جديدة تخصني',
  [CATS_NOTIF.etudiant.offres[1]]: 'عروض سنتك وشعبتك، فور نشرها.',
  [CATS_NOTIF.etudiant.reseau[0]]: 'الأجوبة على أسئلتي وحياة الشبكة',
  [CATS_NOTIF.etudiant.reseau[1]]: 'الأجوبة على أسئلتك وتحت العروض التي علّقت عليها، الأعضاء الجدد في دفعتك، إعلانات المدرسة وأنشطتها، لقاءات المقهى في مدينتك.',
  [CATS_NOTIF.laureat.demandes[0]]: 'طلبات الطلبة',
  [CATS_NOTIF.laureat.demandes[1]]: 'طلبات الطلبة من شعبتك فور نشرها، ثم طلبات الطلبة من الشعب الأخرى حين تُفتح لكل الخريجين، ومآل اقتراحات مساعدتك.',
  [CATS_NOTIF.laureat.candidatures[0]]: 'الترشيحات التي تصل إلى عروضي',
  [CATS_NOTIF.laureat.candidatures[1]]: 'والتوظيفات المؤكَّدة؛ وإن ترشحت، مآل ترشيحاتك.',
  [CATS_NOTIF.admin.candidatures[1]]: 'والتوظيفات المؤكَّدة.',
  [CATS_NOTIF.laureat.mentorat[1]]: 'إرشادات تنتظر قبولك أو مفتوحة لكل الخريجين، معلومات اتصال للمشاركة، التذكير بالمواعيد، سير ذاتية للمراجعة، الرعاية، رسائل الشكر.',
  [CATS_NOTIF.laureat.offres[0]]: 'العروض الجديدة في شعبتي',
  [CATS_NOTIF.laureat.offres[1]]: 'كل العروض المنشورة لشعبتك، فور نشرها: العروض الموجهة إليك، وعروض الطلبة التي يمكنك إيصالها إلى غيرك.',
  [CATS_NOTIF.recherche.demandes[0]]: 'طلباتي وطلبات الطلبة',
  [CATS_NOTIF.recherche.demandes[1]]: 'الردود على طلبك للعمل، طلبة شعبتك الذين يبحثون عن مساعدة (ثم طلبة الشعب الأخرى بعد 24 ساعة دون مساعدة)، ومآل اقتراحات مساعدتك.',
  [CATS_NOTIF.recherche.candidatures[0]]: 'الترشيحات',
  [CATS_NOTIF.recherche.candidatures[1]]: 'مآل ترشيحاتك (مقابلة، توظيف ينتظر تأكيدك) والترشيحات التي تصل إلى عروضك.',
  [CATS_NOTIF.recherche.offres[1]]: 'عروض «الخريجون الجدد» والعروض بين الخريجين وعروض الطلبة في شعبتك، فور نشرها.',
  [CATS_NOTIF.laureat.reseau[0]]: 'الأسئلة وحياة الشبكة',
  [CATS_NOTIF.laureat.reseau[1]]: 'الأجوبة على أسئلتك، أسئلة حول شركتك أو بلدك، التعليقات على عروضك، الأعضاء الجدد في دفعتك وزملاء دفعتك لتأكيدهم، إعلانات المدرسة وأنشطتها، استطلاع الإدماج المهني، لقاءات المقهى في مدينتك.',
  [CATS_NOTIF.admin.reseau[1]]: 'الأجوبة على أسئلتك، التعليقات على عروضك، أنشطة المدرسة، لقاءات المقهى في مدينتك.',
});


// Lot mouvement · D : la seule exception au « jamais public », et seulement avec l'accord du membre
const PHRASE_FONDATEURS = 'Les membres fondateurs (les 25 premiers lauréats à aider les étudiants) peuvent apparaître en haut de la page d’entrée, visible sans compte : leur nom, leur filière, leur promo, leur photo et la date de leur première aide, seulement s’ils ont dit oui. Sans cet accord, la page n’en donne que le nombre. Tu changes d’avis quand tu veux dans « Mon profil ».';
addAR({ [PHRASE_FONDATEURS]: 'يمكن أن يظهر الأعضاء المؤسسون (أول 25 خريجًا ساعدوا الطلبة) في أعلى صفحة الدخول، المرئية دون حساب: الاسم والشعبة والدفعة والصورة وتاريخ أول مساعدة، وذلك فقط إن وافقوا. ودون هذه الموافقة، لا تعرض الصفحة إلا عددهم. يمكنك تغيير رأيك متى شئت من «ملفي الشخصي».' });
// Ambassadeurs de promo : ce que la plateforme regarde pour proposer le rôle, et ce qui sort du réseau
const PHRASE_AMBASSADEURS = 'Ambassadeurs de promo : la plateforme propose ce rôle au membre le plus actif de chaque promo et filière (offres, aides, mentorats, réponses, dernière connexion) ; tu peux refuser. Accepté, ton badge est visible des membres. Les réussites qu’un ambassadeur partage sur WhatsApp sont déjà vérifiées et annoncées dans le réseau, et ne citent le prénom que de qui a accepté d’être cité.';
addAR({ [PHRASE_AMBASSADEURS]: 'سفراء الدفعات: تقترح المنصة هذا الدور على العضو الأكثر نشاطًا في كل دفعة وشعبة (العروض، المساعدات، الإرشاد، الأجوبة، آخر دخول)؛ ويمكنك الرفض. وعند القبول، تظهر شارتك للأعضاء. أما النجاحات التي يشاركها السفير عبر واتساب فهي مؤكَّدة ومُعلنة في الشبكة مسبقًا، ولا تذكر إلا اسم من وافق على ذكره.' });
// Page Match : ce que les lauréats y voient d'un étudiant, le CV seulement après un match, et comment ne plus y apparaître
const PHRASE_MATCH = 'Match : les lauréats y voient ton profil résumé (année, filière, ce que tu cherches, compétences) ; ton CV, seulement après un match. Une carte remise à plus tard reste privée ; un intérêt est vu par la personne visée. Tu peux ne plus apparaître dans Match depuis « Mon profil ».';
addAR({ [PHRASE_MATCH]: 'التوافق (Match): يرى فيه الخريجون ملفك المختصر (السنة، الشعبة، الفرصة المنشودة، الكفاءات)؛ أما سيرتك الذاتية فلا يرونها إلا بعد حصول توافق. تبقى البطاقة المؤجلة خاصة، أما الاهتمام فيراه الشخص المعني. ويمكنك التوقف عن الظهور في Match من «ملفي الشخصي».' });

const cfg = () => (typeof window !== 'undefined' && window.ENSAM_CONFIG) || {};

// Le texte est court et concret : ce qui est collecté, pourquoi, qui le voit, où il est stocké, combien de temps, les droits.
const SECTIONS = [
  ['user', 'Ce que nous collectons', [
    'Ton compte : ton email (et ton mot de passe si tu en as un : chiffré, jamais visible, même par l’équipe du Réseau).',
    'Ton profil : nom, rôle, filière, promo, et si tu les remplis : entreprise, poste, secteur, ville, pays, bio, compétences, LinkedIn, CV (fichier PDF ou lien), disponibilité.',
    'Tes coordonnées privées, si tu les donnes : téléphone, email de contact, autre moyen de te joindre.',
    'Ce que tu fais sur la plateforme : offres, candidatures, rendez-vous de mentorat, relectures de CV, questions et réponses, mercis, messages de groupe, cafés, inscriptions aux événements de l’école.',
    'Tes messages privés : textes, photos, messages vocaux et réactions échangés avec un autre membre.',
    'Ce que tu partages pour les suivants, si tu le fais : avis de stage, questions d’entretien, rubriques du guide de l’étranger, réponses à l’enquête d’insertion.',
    'Si tu les actives : l’adresse technique de ton téléphone pour les notifications, et ta langue préférée pour les emails.',
    PHRASE_VISITE,
  ]],
  ['spark', 'Pourquoi', [
    'Mettre en relation les étudiants et les lauréats de l’ENSAM Meknès : offres, mentorat, entraide.',
    'Te proposer ce qui te correspond (ton année, ta filière, ta ville), et t’alerter quand une offre pour toi est publiée.',
    'Suivre chaque promo jusqu’au premier emploi, avec des chiffres globaux par promo et par filière, utiles aux étudiants et aux promos suivantes.',
    'T’envoyer les emails utiles : rendez-vous, alertes d’offres, enquête d’insertion, et un résumé par semaine si tu le gardes activé.',
    'Garder la plateforme sûre : vérification des lauréats, signalements, limites contre le spam.',
  ]],
  ['people', 'Qui voit quoi', [
    'Ton profil est visible par les membres connectés, jamais par le public ni par les moteurs de recherche.',
    PHRASE_FONDATEURS,
    PHRASE_AMBASSADEURS,
    PHRASE_MATCH,
    'Tu choisis qui voit ton entreprise, ta ville, ton LinkedIn, ta présentation et ton CV : tous les membres, seulement les lauréats, ou seulement tes contacts.',
    'Tes coordonnées ne sont visibles que par tes contacts (les membres avec qui tu les partages, l’auteur d’une offre où tu postules, la personne qu’une demande a réunie avec toi) et par l’administration. Tu peux retirer ton accord à tout moment.',
    'Ton CV en PDF est rangé dans un espace privé. Il s’ouvre par un lien valable 10 minutes, et seulement pour : les membres que tu choisis dans « Qui voit quoi », tes contacts (dont l’auteur d’une offre où tu postules), les lauréats quand tu as une demande ouverte, le lauréat qui relit ton CV (ou tous les lauréats tant que personne ne l’a pris), le lauréat avec qui tu as un match, et l’administration.',
    'Une candidature n’est visible que par toi et par le lauréat qui a publié l’offre.',
    'Un message privé n’est visible que par toi et la personne à qui tu écris. Ses photos et vocaux sont dans un espace privé et s’ouvrent par un lien temporaire. L’administration ne voit un message que si l’un de vous deux le signale.',
    'Un étudiant ne voit que les offres de son année ; les offres entre lauréats ne sont pas visibles par les étudiants.',
    'La semaine de ton inscription, le résumé par email peut citer ton nom et ta promo (ou ton année) aux membres de ta promo ou de ta filière, comme le fait l’annuaire.',
    'Un avis de stage ou un entretien publié en anonyme n’affiche pas ton nom aux membres.',
    'L’administration voit les emails des comptes, seulement pour vérifier les lauréats et aider en cas de problème.',
    'Une attestation de lauréat peut être vérifiée par un lien que son titulaire choisit de partager.',
  ]],
  ['flag', 'Sécurité et modération', [
    'Chacun peut signaler un contenu ou un profil. Seule l’administration voit le signalement ; la personne concernée ne sait pas qui l’a fait.',
    'L’administration examine chaque signalement et peut retirer un contenu qui ne respecte pas la communauté.',
    'Pour éviter le spam, chaque compte a des limites par jour : candidatures, messages, publications et coordonnées demandées.',
    'Tu peux bloquer un membre à tout moment : vous ne pouvez plus vous écrire.',
    'Un lauréat reçoit son badge « vérifié » par l’administration, ou quand deux lauréats déjà vérifiés de sa promo le confirment.',
    'L’équipe du réseau peut importer la liste officielle des étudiants (nom, promo, filière, email de l’école). Elle sert seulement à vérifier les inscriptions et seule l’équipe du réseau la voit.',
  ]],
  ['chart', 'Enquête d’insertion', [
    'Six mois puis douze mois après le diplôme, un court questionnaire te demande ta situation (emploi, recherche, études…).',
    'Les réponses sont publiées seulement en chiffres globaux par promo et par filière, jamais en dessous de 5 réponses. Seule l’administration voit les réponses individuelles.',
    'Répondre est facultatif.',
  ]],
  ['shield', 'Ce que nous ne faisons pas', [
    'Aucune vente ni location de données, aucune publicité, aucun traceur publicitaire.',
    'Le navigateur garde ta langue, tes préférences d’affichage, ce que tu es en train d’écrire et une copie de ton accueil pour l’ouvrir tout de suite. Cette copie est effacée quand tu te déconnectes, tes brouillons aussi.',
  ]],
  ['globe', 'Où sont les données', [
    'Base de données, comptes et CV : Supabase, serveurs à Paris (Union européenne).',
    'Site : GitHub Pages. Emails : le compte Gmail de la plateforme (Google) et Brevo (Union européenne). Visio : Jitsi Meet, quand tu rejoins un rendez-vous.',
    'Carte : fonds OpenStreetMap et CARTO. Notifications du téléphone : le service de ton navigateur (Google, Apple ou Mozilla), seulement si tu les actives.',
    'Logos des entreprises : ceux gardés sur le site, sinon l’icône du site de l’entreprise, demandée à DuckDuckGo sans ton nom ni l’adresse de la page.',
  ]],
  ['clock', 'Combien de temps', [
    'Tant que ton compte existe. Quand tu le supprimes, ton profil, ton CV et tout ce qui t’est lié sont effacés tout de suite. Seuls restent des chiffres globaux sans nom.',
    'Quand tu remplaces ou retires ton CV, l’ancien fichier est effacé, sauf s’il est encore lié à une relecture.',
    'Les notifications en attente sont effacées dès leur envoi.',
    'Un message que tu supprimes est effacé pour vous deux, avec sa photo ou son vocal et ses réactions.',
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
      ${adresseContact(c) ? html`<p>Pour toute question sur tes données : <a href=${'mailto:' + adresseContact(c)} dir="ltr" translate="no">${adresseContact(c)}</a></p>` : html`<p>Pour toute question sur tes données, écris à l’administration depuis la plateforme (Entraide ou profil d’un administrateur).</p>`}
      ${c.cndp ? html`<p class="small muted">Déclaration CNDP : <span dir="ltr" translate="no">${c.cndp}</span></p>` : null}
    </div>
    <p class="small muted">Dernière mise à jour : octobre 2026.</p>
  </section>`;
}

// Les membres inscrits avant cette page donnent leur accord une fois (mode réel uniquement).
export function ConsentModal({ ctx }) {
  const { me, store, act, go } = ctx;
  const [ok, setOk] = useState(false);
  // Résumé de la semaine : coché d'avance si le membre le reçoit déjà, ou s'il l'a laissé coché en créant son compte
  // (il n'est envoyé qu'après « Continuer », la case reste à décocher)
  const [mails, setMails] = useState(me.emails_hebdo !== false || (!me.consent_at && store.session?.user?.user_metadata?.emails_hebdo === true));
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
    Object.assign(owner, { coordonnees: ['id'], demandes_contact: ['demandeur_id', 'cible_id'], relectures_cv: ['student_id', 'reviewer_id'], entretiens: ['author_id'], avis_stage: ['author_id'], enquetes_insertion: ['user_id'], signalements: ['auteur_id'], evenement_participants: ['user_id'], verifications_pairs: ['laureat_id', 'verificateur_id'], messages: ['author_id', 'dest_id'], blocages: ['user_id'], reactions_messages: ['user_id'] });
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
  // Notifications par catégorie : en ligne, seulement une fois la base à jour (colonne notif_push). Avant, l'étudiant garde
  // sa case « M'alerter… » ; après, elle devient « Nouvelles offres pour moi » (téléphone) et la case email à part.
  // Les titres « Par email » / « Sur tes appareils » aussi : avant, « M'alerter… » (le téléphone) se retrouverait sous « Par email ».
  const cats = store.mode !== 'live' || 'notif_push' in me;
  return html`<div class="panel" id="mes-donnees">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="shield"/> Mes données et notifications</h2><button class="btn tiny ghost" onClick=${() => go('confidentialite')}>Confidentialité <${Icon} name="arrow" size=${14}/></button></div>
    ${cats ? html`<h3 class="md-titre">Par email</h3>` : null}
    <label class="check"><input id="md-mail" type="checkbox" checked=${me.emails_hebdo !== false} onChange=${e => act(async () => { await store.update('profiles', me.id, { emails_hebdo: e.target.checked }); toast(e.target.checked ? 'Tu recevras un résumé chaque semaine.' : 'Plus de résumé par email.'); })}/> Recevoir un résumé par email chaque semaine</label>
    ${me.role === 'etudiant' && cats && (store.mode !== 'live' || 'alertes_email' in me) ? html`<label class="check"><input id="md-alertes-mail" type="checkbox" checked=${me.alertes_email !== false} onChange=${e => act(() => store.update('profiles', me.id, { alertes_email: e.target.checked }))}/> Recevoir par email les nouvelles offres de mon année et de ma filière (3 au plus par jour)</label>` : null}
    ${me.role === 'etudiant' && !cats && (store.mode !== 'live' || 'alertes_offres' in me) ? html`<div class="cf-alertes">
      <label class="check"><input id="md-alertes" type="checkbox" checked=${me.alertes_offres !== false} onChange=${e => act(async () => { await store.update('profiles', me.id, { alertes_offres: e.target.checked }); toast(e.target.checked ? 'On t’alerte dès qu’une offre pour toi est publiée.' : 'Plus d’alertes d’offres.'); })}/> M’alerter dès qu’une offre de mon année et de ma filière est publiée</label>
      ${me.alertes_offres !== false ? html`<label class="check sub"><input id="md-alertes-mail" type="checkbox" checked=${me.alertes_email !== false} onChange=${e => act(() => store.update('profiles', me.id, { alertes_email: e.target.checked }))}/> Aussi par email (3 au plus par jour)</label>` : null}
    </div>` : null}
    ${store.mode !== 'live' || 'emails_messages' in me ? html`<label class="check"><input id="md-msg-mail" type="checkbox" checked=${me.emails_messages !== false} onChange=${e => act(async () => { await store.update('profiles', me.id, { emails_messages: e.target.checked }); toast(e.target.checked ? 'Un email te prévient si un message attend depuis 30 minutes.' : 'Plus d’email pour les messages.'); })}/> M’envoyer un email quand un message m’attend (un toutes les 6 heures au plus)</label>` : null}
    ${cats ? html`<h3 class="md-titre" id="md-notifs">Sur tes appareils</h3>` : null}
    <${PushToggle} ctx=${ctx}/>
    ${cats ? html`<${ChoixNotifs} ctx=${ctx}/>` : null}
    <${FondateurPublicCase} ctx=${ctx}/>
    <div class="row">
      <button class="btn small" onClick=${exportData}><${Icon} name="download" size=${15}/> Télécharger mes données</button>
      <span class="spacer"></span>
      <button class="btn small ghost danger-t" onClick=${() => setDel(true)}><${Icon} name="trash" size=${15}/> Supprimer mon compte</button>
    </div>
    ${del ? html`<${DeleteAccount} ctx=${ctx} onClose=${() => setDel(false)}/>` : null}
  </div>`;
}

// Ce que chacun reçoit sur ses appareils, par catégorie. me.notif_push ne garde que ses choix ; une case jamais touchée
// suit le défaut de son rôle (pushChoix, mêmes règles que la base). Les choix valent pour tous ses appareils.
function ChoixNotifs({ ctx }) {
  const { me, store, act } = ctx;
  const mots = motsNotif(me);
  // Deux cases touchées coup sur coup : la seconde garde la première
  const enCours = useRef({});
  // Pas enregistré (réseau) : la case est redessinée, elle revient à ce qui est enregistré (Preact la compare à la page)
  const [, redessiner] = useState(0);
  const changer = (cat, v) => {
    enCours.current = { ...enCours.current, [cat]: v };
    act(async () => {
      try { await store.update('profiles', me.id, { notif_push: { ...(store.me?.notif_push || me.notif_push || {}), ...enCours.current } }); }
      catch (e) { const { [cat]: _, ...reste } = enCours.current; enCours.current = reste; redessiner(n => n + 1); throw e; }
      toast('Choix enregistré.');
    });
  };
  return html`<fieldset class="md-cats" aria-describedby="md-cats-note">
    <legend>Ce que je reçois</legend>
    ${catsNotif(me, store).map(cat => html`<label class="check" key=${cat}><input type="checkbox" id=${'np-' + cat} checked=${pushChoix(cat, me)} onChange=${e => changer(cat, e.target.checked)}/><span class="cat-txt"><span class="cat-t">${mots[cat][0]}</span><span class="cat-d">${mots[cat][1]}</span></span></label>`)}
    <p class="small muted" id="md-cats-note">${NOTES_NOTIF.tous}</p>
    ${me.role === 'admin' ? html`<p class="small muted">${NOTES_NOTIF.admin}</p>` : null}
  </fieldset>`;
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
// 'rappels' pour les rappels de visite, sinon le résumé de la semaine.
export function DesaboPage({ store, token, quoi }) {
  if (quoi === 'rappels') return html`<${DesaboRappels} store=${store} token=${token}/>`;
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
