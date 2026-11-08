// Page d'entrée d'un visiteur (sans compte) : elle s'affiche en environ une seconde en 3G, avant le reste du site.
// Ce module ne dépend que de Preact, de la traduction, du logo et de la scène dessinée. Le magasin (Supabase)
// se charge ensuite, puis l'application, qui « adopte » l'entrée déjà à l'écran : rien ne clignote,
// et ce qui a été tapé reste en place. Un membre déjà connecté ne voit jamais cette page.
import { html, render, useState, useLayoutEffect, useEffect, useRef } from './vendor/preact-htm.js';
import { getLang, setLang, chargerAR, addAR, arCount, t } from './i18n.js';
import { glyph, TUILE_DEFS, TUILE } from './logo.js';
import { roleDePromo, promoValide, lignesChiffres, estEmailEcole, chiffresCode, adresseContact, VERSION_ACCORD, lienPartage, lienEncoreBon, estUuid, phraseLien, suiteLien, offreFermeePour } from './regles-entree.js';

// La page d'entrée en arabe n'attend pas le grand dictionnaire (i18n-ar.js) : ses phrases sont ici
// (mêmes traductions que dans i18n-ar.js, vérifié par un test).
const LAU = ['خريج واحد', 'خريجان', 'خريجين', 'خريجًا'];
addAR({
  'Réseau ENSAM Meknès': 'شبكة ENSAM مكناس',
  'Les lauréats ouvrent la porte aux étudiants.': 'الخريجون يفتحون الباب أمام الطلبة.',
  'Stage, PFE, premier emploi : les étudiants demandent, les lauréats aident et recrutent.': 'تدريب، مشروع نهاية الدراسة، أول عمل: الطلبة يطلبون، والخريجون يساعدون ويوظّفون.',
  'Ta situation': 'وضعيتك', 'Je suis à l’école': 'أدرس في المدرسة', 'J’ai mon diplôme': 'حصلت على شهادتي',
  'De la 1re à la 5e année à l’ENSAM Meknès': 'من السنة الأولى إلى الخامسة في ENSAM مكناس',
  'De l’ENSAM Meknès, en poste ou en recherche d’emploi': 'من ENSAM مكناس، في وظيفة أو في بحث عن عمل',
  '1re à 5e année': 'من السنة الأولى إلى الخامسة', 'Diplôme ENSAM': 'شهادة ENSAM',
  'Choisis d’abord ta situation.': 'اختر أولًا وضعيتك.',
  'Pour les lauréats': 'للخريجين', 'Pour les étudiants': 'للطلبة',
  'Recrute tes stagiaires parmi les étudiants de ton école': 'وظّف متدرّبيك من بين طلبة مدرستك',
  'Aide un étudiant en 20 minutes de visio, quand tu as le temps': 'ساعد طالبًا في 20 دقيقة عبر الفيديو، متى توفّر لك الوقت',
  'Les mercis des étudiants que tu aides, et une attestation à ajouter sur LinkedIn': 'كلمات شكر من الطلبة الذين تساعدهم، وشهادة تضيفها إلى LinkedIn',
  'Dis aux lauréats le stage que tu cherches, CV joint : ils te répondent': 'قل للخريجين أي تدريب تبحث عنه، مع سيرتك الذاتية: سيجيبونك',
  'Un lauréat te conseille : CV, entretien, départ à l’étranger': 'خريج ينصحك: السيرة الذاتية، المقابلة، الانطلاق إلى الخارج',
  'Les offres de stage, de PFE et d’emploi publiées par les lauréats': 'عروض التدريب ومشاريع نهاية الدراسة والعمل التي ينشرها الخريجون',
  'Ta promo est déjà indiquée : crée ton compte, puis vérifie tes informations.': 'دفعتك محدَّدة مسبقًا: أنشئ حسابك، ثم تحقق من معلوماتك.',
  'Créer mon compte': 'إنشاء حسابي', 'Se connecter': 'تسجيل الدخول', 'Nouveau mot de passe': 'كلمة مرور جديدة',
  'Ta session a expiré. Reconnecte-toi : ce que tu étais en train d’écrire est gardé.': 'انتهت جلستك. سجّل الدخول من جديد: ما كنت تكتبه محفوظ.',
  'Ta session a expiré. Reconnecte-toi pour continuer.': 'انتهت جلستك. سجّل الدخول من جديد للمتابعة.',
  'Email': 'البريد الإلكتروني', 'Mot de passe': 'كلمة المرور', '6 caractères minimum': '6 أحرف على الأقل',
  'Le résumé de la semaine par email': 'ملخص الأسبوع بالبريد الإلكتروني',
  'J’ai 18 ans ou plus et j’accepte la': 'عمري 18 سنة أو أكثر وأوافق على', ', y compris l’envoi de mes données aux États-Unis (emails, notifications)': '، بما فيها إرسال بياناتي إلى الولايات المتحدة (الرسائل والإشعارات)', 'Confidentialité': 'الخصوصية',
  'Recevoir mon code': 'إرسال الرمز', 'Continuer': 'متابعة', 'Connexion…': 'جارٍ الدخول…', 'Enregistrer': 'حفظ',
  'Pas de mot de passe : on t’envoie un code à 6 chiffres par email.': 'بدون كلمة مرور: نرسل إليك رمزًا من 6 أرقام عبر البريد الإلكتروني.',
  'Email de l’école reconnu : ton profil étudiant sera vérifié tout de suite.': 'تم التعرّف على بريد المدرسة: سيُوثَّق ملفك كطالب فورًا.',
  'Email de l’école reconnu.': 'تم التعرّف على بريد المدرسة.',
  'Ton code est parti': 'رمزك في الطريق', 'Entre le code à 6 chiffres envoyé à': 'أدخل الرمز المكوّن من 6 أرقام المرسل إلى',
  'Changer d’email': 'تغيير البريد الإلكتروني', 'Changer': 'تغيير', 'Code à 6 chiffres': 'الرمز المكوّن من 6 أرقام',
  'Rien reçu ? Regarde dans tes spams.': 'لم يصلك شيء؟ ابحث في الرسائل غير المرغوب فيها (Spam).', 'Renvoyer le code': 'إعادة إرسال الرمز',
  'Entre les 6 chiffres du code.': 'أدخل أرقام الرمز الستة.',
  'Nouveau code envoyé. Seul le dernier code reçu marche.': 'أُرسل رمز جديد. وحده آخر رمز يصلك يعمل.',
  'Un code t’a déjà été envoyé il y a moins d’une minute : entre-le ici.': 'أُرسل إليك رمز قبل أقل من دقيقة: أدخله هنا.',
  'Pas encore de compte avec cet email : crée-le ici en une minute.': 'لا يوجد حساب بهذا البريد بعد: أنشئه هنا في دقيقة.',
  'J’ai déjà un compte': 'لدي حساب', 'Créer un compte': 'إنشاء حساب', 'J’ai un mot de passe': 'لدي كلمة مرور', 'Recevoir un code à la place': 'استلام رمز بدلًا من ذلك',
  'Initiative de lauréats, indépendante de l’administration de l’école': 'مبادرة من الخريجين، مستقلة عن إدارة المدرسة', 'Contact': 'التواصل',
  'Pas de connexion pour l’instant': 'لا يوجد اتصال حاليًا', 'Vérifie ton réseau, puis réessaie.': 'تحقق من شبكتك، ثم أعد المحاولة.', 'Réessayer': 'أعد المحاولة',
  'Mot de passe changé.': 'تم تغيير كلمة المرور.', 'Inscris-toi avec ton email de l’école.': 'سجّل باستعمال بريد المدرسة.',
  'Connexion trop lente : réessaie dans un instant.': 'الاتصال بطيء جدًا: أعد المحاولة بعد لحظة.',
  // Réponses de la base pendant l'inscription (store.js, frError)
  'Pas de réseau pour l’instant. Réessaie dans un instant.': 'لا توجد شبكة حاليًا. أعد المحاولة بعد لحظة.',
  'Ce code ne marche pas. Vérifie les 6 chiffres, ou demande un nouveau code.': 'هذا الرمز لا يعمل. تحقّق من الأرقام الستة، أو اطلب رمزًا جديدًا.',
  'Un code vient de partir. Attends une minute avant d’en demander un autre.': 'أُرسل رمز للتو. انتظر دقيقة قبل طلب رمز آخر.',
  'Beaucoup de codes sont partis cette heure-ci. Réessaie dans un moment.': 'أُرسلت رموز كثيرة خلال هذه الساعة. أعد المحاولة بعد قليل.',
  'Les inscriptions sont en pause pour l’instant. Réessaie plus tard.': 'التسجيل متوقف مؤقتًا. أعد المحاولة لاحقًا.',
  'L’email n’a pas pu partir. Vérifie l’adresse, ou réessaie dans un instant.': 'تعذّر إرسال البريد. تحقّق من العنوان، أو أعد المحاولة بعد لحظة.',
  'Cette adresse email ne semble pas valide. Vérifie-la.': 'يبدو أن هذا البريد الإلكتروني غير صالح. تحقّق منه.',
  'Trop de tentatives. Réessaie dans quelques minutes.': 'محاولات كثيرة. أعد المحاولة بعد بضع دقائق.',
  'Email ou mot de passe incorrect.': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  'Erreur inconnue.': 'خطأ غير معروف.',
  // Lien partagé : ce qui attend le visiteur
  'On t’a partagé une offre : crée ton compte pour la voir.': 'شارك أحدهم معك عرضًا: أنشئ حسابك لتطّلع عليه.',
  'Une offre de stage t’attend : crée ton compte pour la voir.': 'عرض تدريب في انتظارك: أنشئ حسابك لتطّلع عليه.',
  'Une offre de PFE t’attend : crée ton compte pour la voir.': 'عرض مشروع نهاية الدراسة في انتظارك: أنشئ حسابك لتطّلع عليه.',
  'Une offre de stage à l’étranger t’attend : crée ton compte pour la voir.': 'عرض تدريب بالخارج في انتظارك: أنشئ حسابك لتطّلع عليه.',
  'Une offre d’emploi t’attend : crée ton compte pour la voir.': 'عرض وظيفة في انتظارك: أنشئ حسابك لتطّلع عليه.',
  'Une offre entre lauréats t’attend : crée ton compte pour la voir.': 'عرض بين الخريجين في انتظارك: أنشئ حسابك لتطّلع عليه.',
  'On t’a partagé une offre : connecte-toi pour la voir.': 'شارك أحدهم معك عرضًا: سجّل الدخول لتطّلع عليه.',
  'Une offre de stage t’attend : connecte-toi pour la voir.': 'عرض تدريب في انتظارك: سجّل الدخول لتطّلع عليه.',
  'Une offre de PFE t’attend : connecte-toi pour la voir.': 'عرض مشروع نهاية الدراسة في انتظارك: سجّل الدخول لتطّلع عليه.',
  'Une offre de stage à l’étranger t’attend : connecte-toi pour la voir.': 'عرض تدريب بالخارج في انتظارك: سجّل الدخول لتطّلع عليه.',
  'Une offre d’emploi t’attend : connecte-toi pour la voir.': 'عرض وظيفة في انتظارك: سجّل الدخول لتطّلع عليه.',
  'Une offre entre lauréats t’attend : connecte-toi pour la voir.': 'عرض بين الخريجين في انتظارك: سجّل الدخول لتطّلع عليه.',
  'Une question t’attend : crée ton compte pour y répondre.': 'سؤال في انتظارك: أنشئ حسابك لتجيب عنه.',
  'Une question t’attend : connecte-toi pour y répondre.': 'سؤال في انتظارك: سجّل الدخول لتجيب عنه.',
  'Connecte-toi pour voir la demande de l’étudiant.': 'سجّل الدخول لترى طلب الطالب.',
  'Cette offre n’est plus en ligne.': 'هذا العرض لم يعد منشورًا.',
  'Cette offre n’accepte plus de candidatures.': 'هذا العرض لم يعد يقبل ترشيحات.',
  'Cette offre est réservée aux lauréats.': 'هذا العرض مخصّص للخريجين.',
  'Ça n’a pas marché. Réessaie dans un instant.': 'لم ينجح ذلك. أعد المحاولة بعد لحظة.',
  'Après cette étape, l’offre qu’on t’a partagée s’ouvre.': 'بعد هذه الخطوة، سيُفتح العرض الذي وصلك.',
  'Après cette étape, la question qu’on t’a partagée s’ouvre.': 'بعد هذه الخطوة، سيُفتح السؤال الذي وصلك.',
  'Après cette étape, la demande de l’étudiant s’ouvre.': 'بعد هذه الخطوة، سيُفتح طلب الطالب.',
}, [
  [/^(\d+) lauréats?$/, n => arCount(n, LAU)],
  [/^(\d+) entreprises?$/, n => arCount(n, ['شركة واحدة', 'شركتان', 'شركات', 'شركة'])],
  [/^(\d+) promos?$/, n => arCount(n, ['دفعة واحدة', 'دفعتان', 'دفعات', 'دفعة'])],
  [/^Renvoyer le code dans (\d+) s$/, n => `يمكنك طلب رمز جديد بعد ${arCount(n, ['ثانية واحدة', 'ثانيتين', 'ثوانٍ', 'ثانية'])}`],
  [/^Bienvenue, promo (\d{4}) !$/, y => `مرحبا بك، دفعة ${y}!`],
  [/^Côté étudiants : (inscris-toi|de préférence) avec ton email de l’école \((.+)\)\. Ton compte est alors vérifié tout de suite\.$/, (m, d) => m === 'inscris-toi' ? `للطلبة: التسجيل ببريد المدرسة (${d}). يُوثَّق الحساب فورًا.` : `للطلبة: يُفضَّل التسجيل ببريد المدرسة (${d}). يُوثَّق الحساب فورًا.`],
]);

// ---------------------------------------------------------------------------
// Briques d'interface partagées avec tout le site (ui.js les réexporte)
// ---------------------------------------------------------------------------
// L'icône de chaque type d'offre (page d'entrée d'un lien partagé, listes d'offres)
export const TYPE_ICON = { stage: 'wrench', pfe: 'cap', etranger: 'globe', emploi: 'briefcase' };
// Trois tailles seulement : toute taille demandée se range sur 16, 20 ou 24 px ; les grandes illustrations (états vides, fêtes)
// gardent la leur. Le trait reste de 1,75 px à l'écran quelle que soit la taille (vector-effect, dans page.html).
export const tailleIcone = s => { const n = Number(s) || 20; return n > 28 ? n : n < 18 ? 16 : n < 22 ? 20 : 24; };
export function Icon({ name, size = 18 }) {
  const P = ICONS[name] || '';
  const t = tailleIcone(size);
  return html`<svg class=${`ico ico-${name}`} width=${t} height=${t} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: P }}></svg>`;
}

const ICONS = {
  feed: '<rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/>',
  mentor: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3 3 0 0 1 0 6M18 14c2 .8 3 2.8 3 6"/>',
  qa: '<path d="M4 5h11v8H8l-4 3z"/><path d="M15 9h5v8l-3-2h-6v-2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  send: '<path d="M4 12l16-8-6 17-3-7z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5"/><path d="M14.5 6.5 17 4l3 3-2.5 2.5"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v6"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M12 6.5l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 8.6l2-.3z"/><path d="M8.6 13.9 7 21l5-2.6 5 2.6-1.6-7.1"/>',
  chat: '<path d="M20.5 11.5a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1.4-4.4A8.5 8.5 0 1 1 20.5 11.5z"/><path d="M8.5 10h7M8.5 13.5h4.5"/>',
};
// Les autres icônes arrivent avec le reste du site (ui.js) : la page d'entrée n'en a pas besoin
export const ajouterIcones = o => Object.assign(ICONS, o);

// err : un champ obligatoire encore vide, signalé seulement après un essai de publication (jamais à l'ouverture)
export function Field({ label, hint, children, err, errId }) {
  return html`<label class=${'field' + (err ? ' manque' : '')}><span class="field-label">${label}</span>${children}${err ? html`<span class="field-err" id=${errId} aria-hidden="true">${err}</span>` : null}${hint ? html`<span class="field-hint">${hint}</span>` : null}</label>`;
}

// Logo de la plateforme : la tuile bleu nuit avec la roue et la toque (voir logo.js). « draw » l'anime à l'arrivée.
// Chaque logo a son propre dégradé : avec un id partagé, la tuile disparaît quand le premier logo
// de la page est caché (le menu de gauche sur téléphone).
const LOGO_SVG = `${TUILE_DEFS}${TUILE}<g class="lg-glyph">${glyph()}</g>`;
let logoN = 0;
export function BrandLogo({ size = 38, draw = false }) {
  const [svg] = useState(() => LOGO_SVG.replaceAll('lg-tuile', `lg-tuile-${++logoN}`));
  return html`<svg class=${'brand-logo' + (draw ? ' draw' : '')} width=${size} height=${size} viewBox="0 0 512 512" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: svg }}></svg>`;
}

// L'entrée de l'école dessinée. La porte s'ouvre une seule fois par visite ; les animations
// s'arrêtent quand l'image sort de l'écran. « pose » (ms) : à l'accueil, l'entrée s'anime à l'arrivée puis se pose.
// Le dessin (scene.js) arrive à part, juste après le formulaire de la page d'entrée : le ciel est déjà là (fond .sky),
// l'illustration s'y pose dès qu'elle est chargée. Ensuite (accueil, autres écrans), elle est là tout de suite.
let gateOpened = false, scene = null, sceneP = null;
export const chargerScene = () => sceneP ||= import('./scene.js').then(m => (scene = m), e => { sceneP = null; throw e; });
export function SchoolScene({ align = 'xMidYMax', fit = 'meet', pose = 0 }) {
  const ref = useRef();
  const [pret, setPret] = useState(!!scene);
  // Le dessin est attendu d'après pret, pas d'après scene : arrivé entre l'affichage et cet effet (sans images, l'effet passe
  // 100 ms après), il ne se posait jamais.
  useEffect(() => { if (!pret) chargerScene().then(() => setPret(true), () => {}); }, []);
  const [opening] = useState(() => { const o = !gateOpened; gateOpened = true; return o; });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => el.toggleAttribute('data-paused', !e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => { const el = ref.current; if (!el || !pose) return; const t = setTimeout(() => el.setAttribute('data-pose', ''), pose); return () => clearTimeout(t); }, [pose]);
  return html`<div ref=${ref} class=${'scene' + (opening ? ' opening' : '')} aria-hidden="true" dangerouslySetInnerHTML=${{ __html: pret && scene ? scene.sceneMarkup(align, fit) : '' }}></div>`;
}

// Message d'erreur en dehors d'un formulaire (l'application branche ici ses petits messages en bas de l'écran)
let signaler = () => {};
export const brancherSignal = f => { signaler = f; };

// Bouton français / arabe, en haut à côté des notifications
export function LangToggle({ onChange, store, me, aussitot = false }) {
  const ar = getLang() === 'ar';
  const save = l => { if (store?.mode === 'live' && me && me.langue !== l && 'langue' in me) store.update('profiles', me.id, { langue: l }).catch(() => {}); };
  return html`<button class="lang-btn" translate="no" onClick=${async () => {
    try { await setLang(ar ? 'fr' : 'ar', { attendre: !aussitot }); } catch { signaler('Connexion trop lente : réessaie dans un instant.'); return; }
    save(ar ? 'fr' : 'ar'); onChange?.();
    if (aussitot && !ar) chargerAR().then(() => onChange?.(), () => {});
  }} aria-label=${ar ? 'Passer en français' : 'التبديل إلى العربية'} lang=${ar ? 'fr' : 'ar'}>
    <${Icon} name="globe" size=${16}/><span translate="no">${ar ? 'FR' : 'ع'}</span><span class="lang-long" translate="no">${ar ? 'Français' : 'العربية'}</span></button>`;
}

// ---------------------------------------------------------------------------
// Lien d'invitation par promo, à coller dans les groupes WhatsApp : reseau-ensam-meknes.github.io/?promo=2027
// Le lien ouvre directement « Créer mon compte » et, à l'étape suivante, la promo (et le rôle) sont déjà remplis.
// La promo et le rôle choisi sont gardés dans ce navigateur jusqu'à la fin de l'inscription, puis oubliés.
// ---------------------------------------------------------------------------
const CLE = 'ensam-invite-promo', CLE_ROLE = 'ensam-role-choisi', CLE_ECOLE = 'ensam-invite-ecole';
// Lien d'une école : ?ecole=<slug> (« ensam-meknes » ou le nom court d'une autre école ouverte), gardé jusqu'à l'inscription
const ecoleValide = e => typeof e === 'string' && /^[a-z0-9-]{2,40}$/.test(e);
// Invitation nommée : &de=… est le code du membre qui a envoyé le lien (8 caractères), gardé comme la promo
const CLE_DE = 'ensam-invite-de', CODE_DE = /^[a-z0-9]{8}$/;
const valide = promoValide;
const lire = k => { try { return localStorage.getItem(k); } catch { return null; } };
const ecrire = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* navigation privée */ } };

// Au chargement : lit ?promo= (et &lang=ar, et &de= : le code de qui invite) dans l'adresse, garde la promo et le code,
// puis les enlève de la barre d'adresse. Renvoie 'ar' pour un lien arabe, sauf si ce navigateur a déjà choisi sa langue.
export function lireInvitation() {
  try {
    const u = new URL(location.href);
    const de = u.searchParams.get('de');
    if (de !== null) {
      if (CODE_DE.test(de)) ecrire(CLE_DE, de);
      u.searchParams.delete('de');
      if (!u.searchParams.has('promo')) history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    }
    if (u.searchParams.has('ecole')) {
      const e = u.searchParams.get('ecole');
      if (ecoleValide(e)) localStorage.setItem(CLE_ECOLE, e);
      u.searchParams.delete('ecole');
      if (!u.searchParams.has('promo')) { history.replaceState(history.state, '', u.pathname + u.search + u.hash); return null; }
    }
    if (!u.searchParams.has('promo')) return null;
    const n = Number(u.searchParams.get('promo'));
    if (valide(n)) localStorage.setItem(CLE, String(n));
    const ar = u.searchParams.get('lang') === 'ar' && !localStorage.getItem('ensam-lang');
    u.searchParams.delete('promo'); u.searchParams.delete('lang');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    return ar ? 'ar' : null;
  } catch { return null; /* stockage ou historique indisponible : le lien marche quand même, sans promo pré-remplie */ }
}
// Arrivée par « Ouvrir dans Chrome » depuis la page d'entrée d'un navigateur d'application (lienChrome, appareil.js) : le rôle
// choisi, l'étape (créer un compte ou se connecter) et le lien partagé (?r=offre/…) reprennent leur place ; la promo et la
// langue ont déjà la leur (lireInvitation, i18n.js), notifs=1 reste pour l'application. Une autre route en ?r= aussi (celle
// d'un membre, app.js). ici : revenu par l'adresse de secours (pas de Chrome), dite par l'adresse même (sans stockage aussi).
// search : l'adresse sans eux ; aucun : rien de tout cela.
export function contexteArrivee(search = '') {
  const p = new URLSearchParams(search);
  const role = p.get('role'), mode = p.get('mode'), ici = p.get('ici') === '1';
  const lien = p.has('r') ? lienPartage(p.get('r')) : null;
  const aucun = !p.has('role') && !p.has('mode') && !p.has('ici') && !lien;
  p.delete('role'); p.delete('mode'); p.delete('ici'); if (lien) p.delete('r');
  const reste = p.toString();
  return { role: role === 'etudiant' || role === 'laureat' ? role : null, mode: mode === 'inscription' || mode === 'connexion' ? mode : null, lien, ici, search: reste ? '?' + reste : '', aucun };
}
let modeArrivee = null, retourIci = false;
function reprendreArrivee() {
  try {
    const a = contexteArrivee(location.search);
    if (a.aucun) return;
    if (a.role) retenirRole(a.role);
    modeArrivee = a.mode; retourIci = a.ici;
    // Le lien partagé redevient l'adresse de la page, comme s'il avait été ouvert ici (retenirLien le garde ensuite)
    history.replaceState(history.state, '', location.pathname + a.search + (a.lien ? '#' + a.lien.r : location.hash));
  } catch { /* historique ou stockage indisponible : la page s'ouvre sans ce contexte */ }
}
export function promoInvitee() { const n = Number(lire(CLE)); return valide(n) ? n : null; }
export function ecoleInvitee() { const e = lire(CLE_ECOLE); return ecoleValide(e) ? e : null; }
// L'école de la page d'entrée pour les fonctions publiques (invitation nommée, visages, réussites) : celle du lien d'une
// école ; sans lien, ou pour l'ENSAM Meknès, rien (la base prend l'ENSAM Meknès)
export const argsEcole = () => { const e = ecoleInvitee(); return e && e !== 'ensam-meknes' ? { p_ecole: e } : {}; };
export const retenirRole = r => ecrire(CLE_ROLE, r === 'etudiant' || r === 'laureat' ? r : null);
export const roleRetenu = () => { const r = lire(CLE_ROLE); return r === 'etudiant' || r === 'laureat' ? r : null; };
export function oublierInvitation() { ecrire(CLE, null); ecrire(CLE_ROLE, null); ecrire(CLE_ECOLE, null); ecrire(CLE_DE, null); }
const codeInvite = () => { const c = lire(CLE_DE); return c && CODE_DE.test(c) ? c : null; };

// L'accord donné sur CET appareil (case cochée à l'inscription), pour cette adresse. Un compte créé par la demande de
// code de quelqu'un d'autre (adresse mal tapée) ne reprend jamais l'accord ni le rôle de cette personne-là.
const CLE_ACCORD = 'ensam-accord-ici';
const adresse = e => String(e || '').trim().toLowerCase();
// Le rôle envoyé avec la demande de code est gardé avec l'adresse (même pré-choisi par le lien d'une promo, sans toucher)
const noterAccord = (e, r) => ecrire(CLE_ACCORD, JSON.stringify({ e: adresse(e), r: r || null, t: Date.now() }));
function lireAccord(e) { try { const a = JSON.parse(lire(CLE_ACCORD) || 'null'); return a && adresse(e) && a.e === adresse(e) ? a : null; } catch { return null; } }
export function accordIci(e) { return !!lireAccord(e); }
export function roleAccord(e) { const r = lireAccord(e)?.r; return r === 'etudiant' || r === 'laureat' ? r : null; }

// Le lien partagé (offre, question, « Je peux aider ») est gardé 24 h : un détour par la messagerie ou une adresse
// nettoyée ne le perd pas, et il s'ouvre dès la fin de l'inscription. Gardé aussi pour la page ouverte (sans stockage)
const CLE_LIEN = 'ensam-lien-partage';
let lienGarde = null;
export function retenirLien(hash) { const l = lienPartage(hash); if (l) ecrire(CLE_LIEN, JSON.stringify(lienGarde = { r: l.r, t: Date.now() })); }
export function lienRetenu() { try { return lienEncoreBon(JSON.parse(lire(CLE_LIEN) || 'null') || lienGarde); } catch { return null; } }
export const oublierLien = () => { lienGarde = null; ecrire(CLE_LIEN, null); };
export { suiteLien };

// ---------------------------------------------------------------------------
// « Ta situation » : à l'école ou diplômé, choisi une seule fois (page d'entrée, puis rappelé à l'étape suivante)
// ---------------------------------------------------------------------------
const ROLES = [
  ['etudiant', 'cap', 'Je suis à l’école', 'De la 1re à la 5e année à l’ENSAM Meknès', '1re à 5e année'],
  ['laureat', 'briefcase', 'J’ai mon diplôme', 'De l’ENSAM Meknès, en poste ou en recherche d’emploi', 'Diplôme ENSAM'],
];
export function ChoixRole({ value, onChange, idPrefix = 'pf-je-', compact = false }) {
  return html`<fieldset class=${'je-suis' + (compact ? ' compact' : '')}><legend>Ta situation</legend><div class="je-suis-choix">
    ${ROLES.map(([r, ico, t, long, court]) => html`<button type="button" id=${idPrefix + r} class=${'je-carte' + (value === r ? ' on' : '')} aria-pressed=${value === r ? 'true' : 'false'} onClick=${() => onChange(r)}>
      <span class="je-ico"><${Icon} name=${ico} size=${compact ? 18 : 22}/></span><strong>${t}</strong><span class="small muted">${compact ? court : long}</span><span class="je-coche"><${Icon} name="check" size=${16}/></span></button>`)}</div></fieldset>`;
}

// ---------------------------------------------------------------------------
// Chiffres vrais pour un visiteur sans compte : trois totaux, jamais un nom (fonction chiffres_publics de la base).
// Un simple appel web : il part dès l'ouverture de la page, sans attendre Supabase.
// ---------------------------------------------------------------------------
// Une fonction publique de la base : { ok, x } ; ok faux si la base n'est pas à jour, sans réseau, ou après 8 s
async function appelPublic(nom, corps, cfg) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000);
  try {
    const r = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${nom}`, { method: 'POST', headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corps), signal: c.signal });
    return r.ok ? { ok: true, x: await r.json() } : { ok: false };
  } catch { return { ok: false }; } finally { clearTimeout(t); }
}
const enLigneCfg = cfg => !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
let chiffresP = null;
export function chiffresPublics(cfg = window.ENSAM_CONFIG || {}) {
  if (!enLigneCfg(cfg)) return Promise.resolve(null);
  return chiffresP ||= appelPublic('chiffres_publics', {}, cfg).then(r => { if (!r.ok) chiffresP = null; return r.ok ? r.x : null; });
}
// L'offre d'un lien partagé, sans compte : son type, son public et si elle est ouverte ; jamais son titre ni l'entreprise.
// null : elle n'existe plus ; undefined : on ne sait pas (démo, base pas encore à jour, réseau)
export async function offrePartagee(id, cfg = window.ENSAM_CONFIG || {}) {
  if (!estUuid(id) || !enLigneCfg(cfg)) return undefined;
  const { ok, x } = await appelPublic('offre_partagee', { p_id: id }, cfg);
  if (!ok) return undefined;
  if (x === null) return null;
  return ['stage', 'pfe', 'etranger', 'emploi'].includes(x?.type) ? { type: x.type, audience: x.audience === 'laureats' ? 'laureats' : 'etudiants', ouverte: x.ouverte !== false } : undefined;
}

// L'invitation nommée : le prénom (tel qu'écrit par le membre), la promo et le rôle de qui a envoyé le lien, rien d'autre
// (invitation_de, l'école de la page d'entrée). null : code inconnu ; undefined : on ne sait pas (démo, base pas encore à jour, réseau)
export async function invitationDe(code, cfg = window.ENSAM_CONFIG || {}) {
  if (!CODE_DE.test(code || '') || !enLigneCfg(cfg)) return undefined;
  const { ok, x } = await appelPublic('invitation_de', { p_code: code, ...argsEcole() }, cfg);
  if (!ok) return undefined;
  const prenom = typeof x?.prenom === 'string' ? x.prenom.trim().slice(0, 40) : '';
  return prenom ? { prenom, promo: promoValide(Number(x.promo)) ? Number(x.promo) : null } : null;
}
// « Invitation de Nadia · promo 2019 » : le prénom reste tel qu'il est écrit, même en arabe (il peut l'être en lettres arabes)
export const ligneInvitation = (x, ar = getLang() === 'ar') => (!x ? '' : ar
  ? `دعوة من \u2068${x.prenom}\u2069${x.promo ? ` · دفعة ${x.promo}` : ''}`
  : `Invitation de ${x.prenom}${x.promo ? ` · promo ${x.promo}` : ''}`);

// ---------------------------------------------------------------------------
// L'écran d'entrée : choisir son rôle, donner son email, taper le code à 6 chiffres reçu. Pas de mot de passe à inventer.
// Les comptes qui ont un mot de passe peuvent toujours s'en servir (« J'ai un mot de passe »).
// ---------------------------------------------------------------------------
// Ce téléphone a déjà servi à un membre : il retrouvera « Se connecter » en premier
const DEJA_MEMBRE = 'ensam-deja-membre';
export const marquerMembre = () => ecrire(DEJA_MEMBRE, '1');
const dejaMembre = () => lire(DEJA_MEMBRE) === '1';
// Un code attendu (valable 1 h) : l'onglet rechargé après un passage par la messagerie revient à l'étape du code
const CLE_CODE = 'ensam-code-attendu';
const lireAttente = () => { try { const a = JSON.parse(lire(CLE_CODE)); return a?.email && Date.now() - a.t < 3600e3 ? a : null; } catch { return null; } };
const noterAttente = a => ecrire(CLE_CODE, a ? JSON.stringify(a) : null);
const focus = id => setTimeout(() => document.getElementById(id)?.focus());

// « Renvoyer le code » : possible une minute après l'envoi (son propre minuteur : la scène n'est pas redessinée chaque seconde)
function Renvoi({ envoyeA, onRenvoyer, busy }) {
  const [, setT] = useState(0);
  const reste = Math.ceil((envoyeA + 60e3 - Date.now()) / 1000);
  useEffect(() => { if (reste <= 0) return; const i = setInterval(() => setT(t => t + 1), 1000); return () => clearInterval(i); }, [reste > 0]);
  return html`<button type="button" id="au-renvoyer" class="linkish" disabled=${reste > 0 || busy} onClick=${onRenvoyer}>${reste > 0 ? `Renvoyer le code dans ${reste} s` : 'Renvoyer le code'}</button>`;
}

const POUR = {
  laureat: ['Pour les lauréats', [['briefcase', 'Recrute tes stagiaires parmi les étudiants de ton école'], ['mentor', 'Aide un étudiant en 20 minutes de visio, quand tu as le temps'], ['award', 'Les mercis des étudiants que tu aides, et une attestation à ajouter sur LinkedIn']]],
  etudiant: ['Pour les étudiants', [['send', 'Dis aux lauréats le stage que tu cherches, CV joint : ils te répondent'], ['chat', 'Un lauréat te conseille : CV, entretien, départ à l’étranger'], ['feed', 'Les offres de stage, de PFE et d’emploi publiées par les lauréats']]],
};

// Lot mouvement · D : les membres fondateurs en haut de la page. Leur module arrive à part, après l'affichage
// (la page d'entrée garde ses six fichiers) ; sans base à jour ni réseau, rien ne s'affiche.
function Fondateurs() {
  const [M, setM] = useState(null);
  useEffect(() => { import('./fondateurs-public.js').then(m => setM(() => m.FondateursPublics), () => {}); }, []);
  return M ? html`<${M}/>` : null;
}
// Plan · partie membres : « Ils sont déjà dans le réseau » et « Réussites », ce que les membres ont accepté de montrer.
// Même chargement à part ; sans base à jour, sans réseau ou sans accord, rien ne s'affiche.
function Vitrine() {
  const [M, setM] = useState(null);
  useEffect(() => { import('./entree-vitrine.js').then(m => setM(() => m.VitrineEntree), () => {}); }, []);
  return M ? html`<${M}/>` : null;
}

// ---------------------------------------------------------------------------
// Le navigateur d'une application (lien ouvert dans Instagram, Facebook, Messenger, LinkedIn, TikTok, Snapchat, Telegram, ou
// une vue web Android) : on n'y reste pas connecté et les notifications n'y arrivent pas. Une carte calme, au-dessus du
// formulaire, propose Chrome (Android : un lien qui emporte la langue, la promo, le rôle choisi, l'étape et le lien partagé)
// ou Safari (iPhone, iPad : le geste). « Continuer ici » la range : l'inscription ici reste possible. Une fois par visite (cet
// onglet), puis une ligne discrète : sans Chrome, le lien rouvre la même page ici (browser_fallback_url), et la ligne dit
// alors quoi faire au lieu de reproposer le même lien. Elle compte pour la feuille du navigateur d'une application de cette
// visite (CLE_APPLI_VUE, pwa.js). Sur un téléphone où elle ne laisserait pas « Recevoir mon code » au premier écran
// (carteTient), la ligne discrète d'emblée, sous le titre sur un petit écran. La reconnaissance des applications, les
// phrases de la carte, leur arabe et son style arrivent à part (appareil.js), juste après le premier affichage : la page
// d'entrée garde ses six fichiers. Sa place, elle, est gardée dès le premier affichage : rien ne glisse sous le doigt quand la
// carte arrive.
// ---------------------------------------------------------------------------
// 'android', 'ios' ou '' : la règle de navigateurIntegre (appareil.js), sans les noms, pour savoir tout de suite si une carte
// viendra (le test unitaire vérifie que les deux disent toujours la même chose)
export function appliIci(ua = '', toucher = 0) {
  const s = String(ua || ''), sys = /android/i.test(s) ? 'android' : /iphone|ipad|ipod/i.test(s) || (/Macintosh/.test(s) && toucher > 1) ? 'ios' : '';
  return sys && (/FBAN\/|FBAV\/|FB_IAB|FBIOS|FB4A/.test(s) || /FB_IAB\/MESSENGER|FBAN\/Messenger|MessengerForiOS|MessengerLite|\bInstagram\b|LinkedInApp|musical_ly|BytedanceWebview|\bTikTok\b|\bSnapchat\b|\bTelegram\b/i.test(s) || (sys === 'android' && /; wv\)/.test(s))) ? sys : '';
}
// La place gardée : la plus haute carte, toutes applications confondues, mesurée à chaque largeur d'écran. Par système et
// langue : des paires (largeur d'écran en rem jusqu'à laquelle, hauteur en rem en plus du bord et des boutons), puis la hauteur
// sur ordinateur (900 px et plus). Une phrase ou un style de la carte qui change se reporte ici (e2e « appareil.js en retard »).
const PLACE = {
  androidfr: [21.5, 11.72, 22.4, 8.72, 25.9, 7.39, 37.5, 6.05, 99, 4.72, 6.05],
  androidar: [24.9, 6.05, 99, 4.72, 4.72],
  iosfr: [17.87, 10.56, 20.5, 9.22, 23.93, 7.89, 30.18, 6.56, 99, 5.22, 6.56],
  iosar: [17.56, 10.65, 17.62, 8.28, 21.25, 6.56, 28.25, 5.22, 99, 3.89, 3.89],
};
// Le bord et les boutons, en px : la ligne de « Ouvrir dans Chrome » sur Android ; sur iPhone, le bord seul
const BORD = { android: 46.5, ios: 2 };
const placeRem = (sys, lang, largeur, rem) => {
  const t = PLACE[sys + (lang === 'ar' ? 'ar' : 'fr')];
  let i = 0;
  if (largeur < 900) while (largeur / rem >= t[i]) i += 2; else i = t.length - 2;
  return t[i + 1];
};
export const placeCarte = (sys, lang, largeur, rem = 16) => `calc(${BORD[sys]}px + ${placeRem(sys, lang, largeur, rem)}rem)`;
// Sur téléphone, la carte ne vient que si « Recevoir mon code » tient encore avec elle au premier écran. Ce qu'il faut autour
// d'elle, en rem, du haut de la page au bas du bouton (la marque, le titre, les chiffres, l'écart, le rôle, l'email, l'accord),
// mesuré avec la carte de 320 à 899 px de large : le plus haut sous 23,4 rem de large (une ligne de plus), puis au-delà. Un
// texte ou un style de la page qui change cette hauteur se reporte ici (e2e « Recevoir mon code au premier écran »).
const SOUS_CARTE = { fr: [36.6, 35.15], ar: [37.05, 35.25] };
// Le bandeau d'un lien d'invitation (sur téléphone, sa première ligne seule) en plus, écart compris, en rem : 'promo'
// (« Bienvenue, promo 2019 ! ») ou 'de' (« Invitation de Nadia · promo 2019 », qui passe sur deux lignes sous 23,4 rem
// de large en français quand le prénom est long), mesuré de 320 à 899 px (e2e « lien d'invitation au premier écran »)
const BANDE = { fr: { promo: [3.4, 3.4], de: [4.8, 3.4] }, ar: { promo: [3.55, 3.55], de: [3.55, 3.55] } };
export function carteTient(sys, lang, largeur, hauteur, rem = 16, bande = '') {
  const l = lang === 'ar' ? 'ar' : 'fr', etroite = largeur / rem < 23.4;
  const [etroit, large] = SOUS_CARTE[l];
  const enPlus = bande ? BANDE[l][bande][etroite ? 0 : 1] : 0;
  return hauteur >= BORD[sys] + (placeRem(sys, lang, largeur, rem) + (etroite ? etroit : large) + enPlus) * rem;
}
// La ligne discrète qui remplace la carte dans la visite : 44 px, sauf là où sa phrase prend une ligne de plus (largeur en rem
// jusqu'à laquelle, hauteur en rem). Android : « Rien ne s'ouvre ? » (après Chrome) ; iPhone, iPad : le geste de Safari.
const MOT = { androidfr: [24, 3.42], iosfr: [23.25, 3.44], iosar: [17.56, 2.77] };
export function placeMot(sys, lang, largeur, rem = 16) {
  const m = MOT[sys + (lang === 'ar' ? 'ar' : 'fr')];
  return m && largeur / rem < m[0] ? `${m[1]}rem` : '44px';
}
const APPLI_ICI = appliIci(navigator.userAgent, navigator.maxTouchPoints);
const CLE_CARTE = 'ensam-entree-appli';
const lireVisite = k => { try { return sessionStorage.getItem(k); } catch { return null; } };
const ecrireVisite = (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* navigation privée */ } };
// Revenu par l'adresse de secours : la carte a déjà été touchée, même sans stockage pour s'en souvenir
const vueCarte = () => lireVisite(CLE_CARTE) || (retourIci ? 'chrome' : null);
const integreIci = m => m.navigateurIntegre(navigator.userAgent, navigator.maxTouchPoints);
let appareil = null, appareilP = null;
const chargerAppareil = () => (appareilP ||= import('./appareil.js').then(m => {
  if (integreIci(m)) {
    addAR(m.CARTE_AR, m.CARTE_MOTIFS);
    const st = document.createElement('style'); st.textContent = m.CARTE_CSS; document.head.appendChild(st);
  }
  return (appareil = m);
}, () => { appareilP = null; return null; }));
// Preact écrit translate comme une propriété (vrai ou faux) : « no » y deviendrait translate="yes". L'attribut est posé à la main
// une fois l'élément créé ; translate="no" reste dans ses props pour i18n.js, qui laisse alors le nom tel quel
const sansTraduction = el => el?.setAttribute('translate', 'no');
// ligne : la ligne discrète d'emblée, la carte ne laisserait pas « Recevoir mon code » au premier écran (elle ne compte alors
// pas pour la feuille du navigateur d'une application : celle-ci le redira, une fois, après l'inscription)
function CarteAppli({ mode, role, invite, ligne = false, onEchec }) {
  const [a, setA] = useState(() => appareil);
  // appareil.js n'a pas pu se charger (le réseau a lâché juste après la page) : sa place ne reste pas vide toute la visite,
  // le formulaire la reprend (le navigateur ne redemande pas un module en échec : pas de carte dans cette page)
  const [echec, setEchec] = useState(false);
  useEffect(() => { if (!a) chargerAppareil().then(m => { if (m) setA(m); else { setEchec(true); onEchec?.(); } }); }, []);
  const [vue] = useState(vueCarte);
  const [range, setRange] = useState(false), [rien, setRien] = useState(false);
  const mot = useRef(null);
  const app = a && integreIci(a), sys = !a ? APPLI_ICI : app && ['android', 'ios'].includes(app.systeme) ? app.systeme : null;
  const carte = !!sys && !vue && !range && !ligne;
  useEffect(() => { if (carte && a) { ecrireVisite(CLE_CARTE, 'vue'); ecrireVisite(a.CLE_APPLI_VUE, '1'); } }, [carte, a]);
  useEffect(() => { if (range || rien) mot.current?.focus(); }, [range, rien]);
  if (!sys || echec) return null;
  const largeur = document.documentElement.clientWidth || innerWidth, rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const place = carte ? placeCarte(sys, getLang(), largeur, rem) : '';
  // La ligne discrète a toujours la hauteur de sa plus longue phrase (« Rien ne s'ouvre ? » sur Android, le geste sur iPhone) :
  // cette phrase arrive sans rien déplacer
  const placeLigne = placeMot(sys, getLang(), largeur, rem);
  // Avant appareil.js : sa place (la carte, ou la ligne discrète). Sa propre clé : la carte arrive dans un élément neuf, sans
  // transition depuis la place vide (mouvement réduit)
  if (!a) return html`<div key="place" class="entree-appli-place" style=${{ minHeight: place || placeLigne }}></div>`;
  // Chaque phrase traduite d'abord (l'arabe passe tel quel), puis le nom de l'application, Chrome et Safari chacun dans son span.
  // Dans un lien ou un bouton en flex, la phrase reste dans un seul span : un seul morceau, les espaces gardés
  const T = a.CARTE, f = x => a.nomsLatins(a.typo(t(x), getLang())).map((p, i) => (i % 2 ? html`<span translate="no" dir="auto" ref=${sansTraduction}>${p}</span>` : p));
  // Relu au toucher : le rôle, l'étape ou le lien partagé ont pu changer depuis l'affichage. ici : l'adresse de secours le dit
  const lien = () => a.lienChrome(location.href, lienRetenu()?.r, { lang: getLang(), contexte: { promo: invite, de: codeInvite(), ecole: ecoleInvitee(), role, mode: mode === 'inscription' ? mode : 'connexion' }, ici: true });
  // Sans Chrome, l'adresse de secours recharge la page ici : ce qui est déjà tapé revient (lireSaisie). L'application peut
  // aussi ignorer le lien : la page toujours là et visible 1,5 s après (ni cachée ni quittée), la carte dit quoi faire, à la
  // place de sa phrase (même hauteur : rien ne glisse sous le doigt)
  const ouvrir = e => {
    e.currentTarget.href = lien(); ecrireVisite(CLE_CARTE, 'chrome'); try { garderSaisie(); } catch { /* stockage indisponible */ }
    let parti = false; const p = () => { parti = true; }, ev = ['pagehide', 'blur', 'visibilitychange'];
    ev.forEach(n => addEventListener(n, p));
    setTimeout(() => { ev.forEach(n => removeEventListener(n, p)); if (!parti && !document.hidden) setRien(true); }, 1500);
  };
  const ico = html`<${Icon} name="globe" size=${18}/>`;
  if (!carte) return html`<p class="entree-appli-mot" id="au-appli-mot" tabindex="-1" ref=${mot} style=${{ minHeight: placeLigne }}>${ico}${sys === 'ios' || vue === 'chrome' || rien
    ? html`<span>${f(sys === 'ios' ? T.geste : T.rien)}</span>` : html`<a href=${lien()} id="au-appli-chrome" onClick=${ouvrir}><span>${f(T.ligne)}</span></a>`}</p>`;
  const ici = html`<button type="button" class="linkish" id="au-appli-ici" onClick=${() => setRange(true)}>${T.ici}</button>`;
  // iPhone, iPad : pas de bouton à elle, rien qu'un geste à dire. Un seul paragraphe, « Continuer ici » au bout : le champ
  // Email reste au premier écran d'un iPhone SE, « Recevoir mon code » aussi sur un iPhone 13 (fenêtres de Facebook, Instagram)
  if (sys === 'ios') return html`<div class="entree-appli" id="au-appli" data-systeme="ios" style=${{ minHeight: place }}>${ico}<div class="entree-appli-txt">
    <p><span>${f(T.ios)}</span> <span>${f(T.geste)}</span> ${ici}</p></div>
  </div>`;
  return html`<div class="entree-appli" id="au-appli" data-systeme=${sys} style=${{ minHeight: place }}>${ico}<div class="entree-appli-txt">
    <p id="au-appli-dit" aria-live="polite">${rien ? f(T.rien) : html`<span>${f(T.tuEs(app.nom))}</span> <span>${f(T[sys])}</span>`}</p></div>
    <div class="entree-appli-acts"><a class="btn primary" id="au-appli-chrome" href=${lien()} onClick=${ouvrir}><span>${f(T.ouvrir)}</span></a>${ici}</div>
  </div>`;
}

export function AuthScreen({ store }) {
  const [, setTick] = useState(0); const relang = () => setTick(t => t + 1);
  const recovery = /type=recovery/.test(location.hash);
  const [attente] = useState(lireAttente);
  const [saisie] = useState(lireSaisie);
  // Quelqu'un qui découvre le réseau (lien partagé, invitation d'une promo) commence par « Créer mon compte »
  const invite = promoInvitee();
  // Un lien partagé (offre, question, « Je peux aider ») : la page dit ce qui attend le visiteur
  // Seulement le lien gardé à l'ouverture de la page par un visiteur : jamais l'adresse d'un membre qui se déconnecte
  const [lien] = useState(lienRetenu);
  const [infos, setInfos] = useState(undefined);
  useEffect(() => {
    if (lien?.k !== 'offre') return;
    let vivant = true;
    offrePartagee(lien.id).then(x => {
      if (!vivant) return;
      setInfos(x);
      // Plus rien à rouvrir après l'inscription
      if (x === null) { oublierLien(); try { location.replace('#accueil'); } catch { /* */ } }
    });
    return () => { vivant = false; };
  }, []);
  // L'étape apportée par l'adresse ne vaut que pour l'arrivée : lue une fois, jamais après une session perdue ou une déconnexion.
  // Un compte qui vient de partir (déconnexion, session perdue) passe aussi avant l'étape d'une saisie gardée : se reconnecter
  const [mode, setMode] = useState(() => {
    const arrivee = modeArrivee; modeArrivee = null;
    return recovery ? 'nouveau' : attente ? 'code' : store?.sessionPerdue || store?.compteParti ? 'connexion'
      : ['inscription', 'connexion', 'motdepasse'].includes(saisie?.mode) ? saisie.mode
      : arrivee || (lien?.k === 'aider' ? 'connexion' : invite || !dejaMembre() ? 'inscription' : 'connexion');
  });
  const [origine, setOrigine] = useState(attente ? (attente.creer ? 'inscription' : 'connexion') : 'inscription');
  const [role, setRoleEtat] = useState(() => roleRetenu() || (invite ? roleDePromo(invite) : ''));
  // Petit écran (moins de 680 px de haut) : le titre et les chiffres suffisent, la phrase d'explication laisse la place au
  // bouton. Décidé à l'ouverture : le clavier qui s'ouvre ensuite ne fait rien bouger.
  const [court] = useState(() => innerWidth < 900 && innerHeight < 680);
  // Le bandeau d'un lien d'invitation, sur téléphone : sa première ligne seule (« Bienvenue, promo 2019 ! », ou qui invite),
  // pour que le rôle, l'email, l'accord et « Recevoir mon code » restent au premier écran ; la phrase qui explique, sur
  // ordinateur. Décidé à l'ouverture, comme court.
  const [bandeCourte] = useState(() => innerWidth < 900);
  // Le navigateur d'une application sur téléphone : la carte seulement si « Recevoir mon code » tient encore avec elle au
  // premier écran ('carte') ; sinon sa ligne discrète au-dessus du formulaire ('ligne'), et sur un petit écran sous le titre, à
  // la place des chiffres ('haut'). Décidé à l'ouverture, comme court.
  const [appli] = useState(() => {
    if (!APPLI_ICI) return '';
    const largeur = document.documentElement.clientWidth || innerWidth, rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    // Le bandeau d'invitation à venir : la promo du lien (son bandeau, avec le rôle de sa promo), ou le code de qui invite
    const bande = mode !== 'inscription' ? '' : codeInvite() ? 'de' : invite && (!role || role === roleDePromo(invite)) ? 'promo' : '';
    return innerWidth >= 900 || carteTient(APPLI_ICI, getLang(), largeur, innerHeight, rem, bande) ? 'carte' : court ? 'haut' : 'ligne';
  });
  // appareil.js en échec : plus de ligne sous le titre, les chiffres reviennent
  const [appliKo, setAppliKo] = useState(false);
  const carteIci = mode === 'inscription' || mode === 'connexion' || mode === 'motdepasse';
  const enHaut = appli === 'haut' && carteIci && !appliKo;
  // Sur téléphone, la carte (ou sa ligne, quand elle ne tiendrait pas) prend la place de la phrase d'explication, dès le
  // premier affichage ; la ligne d'une carte déjà vue dans la visite la laisse, s'il y a la place
  const [sansSous] = useState(() => !!APPLI_ICI && innerWidth < 900 && (!vueCarte() || appli !== 'carte'));
  // Et sous le titre, un peu moins d'air (classe serre, page.html) : le rôle, l'email, l'accord et « Recevoir mon code » restent
  // au premier écran, même là où le texte se dessine un peu plus large et où l'accord prend une ligne de plus
  const serre = enHaut;
  // Session expirée sans l'avoir voulu : on redemande la connexion calmement, avec son adresse déjà là
  const perdue = !!store?.sessionPerdue;
  const [email, setEmail] = useState(attente?.email || saisie?.email || (perdue && store.emailPerdu) || ''); const [pw, setPw] = useState('');
  const [ok, setOk] = useState(!!saisie?.ok); const [mails, setMails] = useState(attente ? attente.mails !== false : saisie ? saisie.mails !== false : true);
  garderSaisie = () => sessionStorage.setItem(SAISIE, JSON.stringify({ email, mode, ok, mails, t: Date.now() }));
  useEffect(() => { if (mode === 'motdepasse' && saisie?.mode === 'motdepasse') focus('au-pw'); }, []);
  const [code, setCode] = useState(''); const essai = useRef('');
  const [envoyeA, setEnvoyeA] = useState(attente?.t || 0);
  const [msg, setMsg] = useState(null); const [roleMsg, setRoleMsg] = useState(false);
  const [busy, setBusy] = useState(false); const [entre, setEntre] = useState(false);
  const [lignes, setLignes] = useState(null);
  useEffect(() => { let vivant = true; chiffresPublics().then(c => { if (vivant) setLignes(lignesChiffres(c)); }); return () => { vivant = false; }; }, []);
  // Le lien venait d'un membre : qui invite (un code inconnu de cette école est oublié)
  const [deQui, setDeQui] = useState(null);
  useEffect(() => {
    const c = codeInvite(); if (!c) return;
    let vivant = true;
    invitationDe(c).then(x => { if (!vivant) return; if (x === null) ecrire(CLE_DE, null); else if (x) setDeQui(x); });
    return () => { vivant = false; };
  }, []);
  const setRole = r => { setRoleEtat(r); retenirRole(r); setRoleMsg(false); };
  // Un seul envoi à la fois, même pour deux touchers dans le même instant (l'écran n'a pas encore grisé le bouton)
  const occupe = useRef(false);
  const run = async fn => {
    if (occupe.current) return; occupe.current = true;
    setBusy(true); setMsg(null);
    try { await fn(store || await attendreMagasin(true).catch(e => { throw Object.assign(e, { magasin: true }); })); } catch (e) { setMsg({ err: true, t: await texteErreurEntree(e) }); }
    occupe.current = false; setBusy(false);
  };
  const ecole = store?.domainesEcole?.() || [];
  const deLEcole = estEmailEcole(email, ecole);
  // invite_par : le code de qui invite ; la base retrouve le membre (même école) en créant le profil
  const meta = () => { const de = codeInvite(); return { consent_at: new Date().toISOString(), consent_version: VERSION_ACCORD, emails_hebdo: mails, langue: getLang(), ...(role ? { role_choisi: role } : {}), ...(de ? { invite_par: de } : {}) }; };
  const vers = (m, cible = m === 'motdepasse' ? 'au-pw' : m === 'inscription' && !role ? 'au-je-etudiant' : 'au-email') => { setMode(m); setMsg(null); setRoleMsg(false); focus(cible); };

  // Demander un code : creer = la personne s'inscrit (un email déjà connu est simplement connecté)
  const envoyer = (creer, renvoi = false) => run(async s => {
    const e = email.trim();
    if (creer && role === 'etudiant' && s.reglages?.email_ecole_obligatoire === true && s.domainesEcole().length && !estEmailEcole(e, s.domainesEcole())) throw new Error('Inscris-toi avec ton email de l’école.');
    const attendu = t => { noterAttente({ email: e, t, creer, mails, langue: getLang() }); setEnvoyeA(t); setOrigine(creer ? 'inscription' : 'connexion'); setMode('code'); focus('au-code'); };
    if (creer) noterAccord(e, role);
    // Une offre entre lauréats ne s'ouvrira pas pour un étudiant : rien à promettre après l'inscription
    if (creer && offreFermeePour(infos, role)) oublierLien();
    try { await s.envoyerCode(e, { creer, meta: creer ? meta() : null }); } catch (err) {
      if (err.cas === 'pas_de_compte' && !creer) { setOrigine('inscription'); setMode('inscription'); setMsg({ t: 'Pas encore de compte avec cet email : crée-le ici en une minute.' }); return; }
      if (err.cas === 'trop_tot') { attendu(Date.now() - Math.max(0, 60 - err.attente) * 1000); setMsg({ t: 'Un code t’a déjà été envoyé il y a moins d’une minute : entre-le ici.' }); return; }
      throw err;
    }
    attendu(Date.now());
    if (renvoi) { setCode(''); essai.current = ''; const el = document.getElementById('au-code'); if (el) el.value = ''; setMsg({ t: 'Nouveau code envoyé. Seul le dernier code reçu marche.' }); }
  });
  const verifier = v => { essai.current = v; run(async s => {
    try { await s.verifierCode(email.trim(), v, origine === 'inscription' ? meta() : null); } catch (e) { setTimeout(() => document.getElementById('au-code')?.select()); throw e; }
    noterAttente(null); marquerMembre(); setEntre(true); apresConnexion();
  }); };
  const saisir = e => {
    const v = chiffresCode(e.target.value);
    if (e.target.value !== v) e.target.value = v;
    setCode(v);
    if (v.length === 6 && v !== essai.current && !busy && !entre) verifier(v);
  };
  const changerEmail = () => { noterAttente(null); setCode(''); essai.current = ''; vers(origine, 'au-email'); };

  const submit = e => {
    e.preventDefault();
    if (busy) return;
    if (mode === 'inscription') {
      if (!role) { setRoleMsg(true); document.getElementById('au-je-etudiant')?.focus(); return; }
      envoyer(true);
    } else if (mode === 'connexion') envoyer(false);
    else if (mode === 'code') { if (code.length < 6) { setMsg({ err: true, t: 'Entre les 6 chiffres du code.' }); document.getElementById('au-code')?.focus(); } else if (!entre) verifier(code); }
    else if (mode === 'motdepasse') run(async s => { await s.signIn(email.trim(), pw); marquerMembre(); setEntre(true); apresConnexion(); });
    else run(async s => { await s.setPassword(pw); setMsg({ t: 'Mot de passe changé.' }); });
  };

  const inscription = mode === 'inscription';
  const etuAvant = (role || (invite ? roleDePromo(invite) : '')) === 'etudiant';
  const bandeau = invite && inscription && (!role || role === roleDePromo(invite));
  // Qui invite (« Invitation de Nadia · promo 2019 ») prend la place de « Bienvenue, promo 2019 ! » quand c'est la même promo
  const deIci = deQui && inscription, memePromo = !!(deIci && bandeau && Number(deQui.promo) === invite);
  const ecoleOk = deLEcole && (inscription || mode === 'connexion') ? html`<span id="au-ecole" class="field-hint good-t" role="status"><${Icon} name="check" size=${14}/> ${role === 'laureat' || mode === 'connexion' ? 'Email de l’école reconnu.' : 'Email de l’école reconnu : ton profil étudiant sera vérifié tout de suite.'}</span>` : null;
  const indice = inscription && role === 'etudiant' && ecole.length && !deLEcole ? `Côté étudiants : ${store?.reglages?.email_ecole_obligatoire ? 'inscris-toi' : 'de préférence'} avec ton email de l’école (${ecole.map(d => '@' + d).join(', ')}). Ton compte est alors vérifié tout de suite.` : '';
  const champEmail = html`<${Field} label="Email" hint=${indice}><input id="au-email" type="email" required autocomplete="email" inputmode="email" dir="ltr" value=${email} onInput=${e => setEmail(e.target.value)}/>${ecoleOk}<//>`;
  const pourquoiCode = html`<p class="small muted au-sans-mdp">Pas de mot de passe : on t’envoie un code à 6 chiffres par email.</p>`;
  const pour = (etuAvant ? ['etudiant', 'laureat'] : ['laureat', 'etudiant']).map(r => POUR[r]);
  const inscrire = inscription || (mode === 'code' && origine === 'inscription');
  const icoLien = lien?.k === 'question' ? 'qa' : lien?.k === 'aider' ? 'send' : infos?.audience === 'laureats' ? 'briefcase' : TYPE_ICON[infos?.type] || 'feed';

  return html`<main class="auth entree">
    <div class="entree-ciel sky" aria-hidden="true"></div>
    <header class="entree-top"><span class="entree-marque"><${BrandLogo} size=${34} draw/><span>Réseau ENSAM Meknès</span></span><${LangToggle} onChange=${relang} aussitot/></header>
    <section class=${'entree-promesse' + (serre ? ' serre' : '')}>
      ${lien && mode !== 'nouveau' ? html`<p id="au-lien" class=${'lien-accueil' + (infos === null || infos?.ouverte === false || (inscrire && offreFermeePour(infos, role)) ? ' fini' : '')}><${Icon} name=${icoLien} size=${18}/><span>${phraseLien(lien, infos, inscrire, inscrire ? role : '')}</span></p>` : null}
      <${Fondateurs}/>
      <h1>Les lauréats ouvrent la porte aux étudiants.</h1>
      ${enHaut ? html`<${CarteAppli} mode=${mode} role=${role} invite=${invite} ligne onEchec=${() => setAppliKo(true)}/>` : html`<p class="auth-chiffres">${(lignes || []).map(l => html`<span>${l}</span>`)}</p>`}
      ${(lien && mode !== 'nouveau') || court || sansSous ? null : html`<p class="entree-sous">Stage, PFE, premier emploi : les étudiants demandent, les lauréats aident et recrutent.</p>`}
    </section>
    <form class=${'auth-card form entree-form' + (serre ? ' serre' : '')} onSubmit=${submit} aria-label=${inscription ? 'Créer mon compte' : null}>
      ${carteIci && appli !== 'haut' ? html`<${CarteAppli} mode=${mode} role=${role} invite=${invite} ligne=${appli === 'ligne'}/>` : null}
      ${inscription ? null : html`<h2>${{ connexion: 'Se connecter', code: 'Ton code est parti', motdepasse: 'Se connecter', nouveau: 'Nouveau mot de passe' }[mode]}</h2>`}
      ${perdue && mode === 'connexion' ? html`<p class="auth-msg" id="au-session" role="status">${store.brouillonsGardes ? 'Ta session a expiré. Reconnecte-toi : ce que tu étais en train d’écrire est gardé.' : 'Ta session a expiré. Reconnecte-toi pour continuer.'}</p>` : null}
      ${bandeau || deIci ? html`<p class="invite-band"><${Icon} name="send" size=${18}/><span>${deIci ? html`<span id="au-invite-de" style="display:block;font-weight:650">${ligneInvitation(deQui)}</span>` : null}${bandeau && !memePromo ? html`<strong>Bienvenue, promo ${invite} !</strong>${bandeCourte ? null : ' Ta promo est déjà indiquée : crée ton compte, puis vérifie tes informations.'}` : bandeau && !bandeCourte ? 'Ta promo est déjà indiquée : crée ton compte, puis vérifie tes informations.' : null}</span></p>` : null}
      ${inscription ? html`<${ChoixRole} value=${role} onChange=${setRole} idPrefix="au-je-" compact/>
        ${roleMsg ? html`<p id="au-role-msg" class="auth-msg err" role="alert">Choisis d’abord ta situation.</p>` : null}` : null}
      ${mode === 'code' ? html`
        <p id="au-code-envoye" class="muted">Entre le code à 6 chiffres envoyé à</p>
        <p class="au-adresse"><strong id="au-code-email" dir="ltr" translate="no">${email.trim()}</strong><button type="button" id="au-changer" class="linkish" aria-label="Changer d’email" onClick=${changerEmail}>Changer</button></p>
        <${Field} label="Code à 6 chiffres"><input id="au-code" class="code-otp" type="text" inputmode="numeric" autocomplete="one-time-code" enterkeyhint="go" dir="ltr" placeholder="······" aria-describedby="au-code-envoye au-code-email" value=${code} onInput=${saisir}/><//>`
      : mode === 'nouveau' ? null : champEmail}
      ${mode === 'motdepasse' || mode === 'nouveau' ? html`<${Field} label=${mode === 'nouveau' ? 'Nouveau mot de passe' : 'Mot de passe'} hint=${mode === 'nouveau' ? '6 caractères minimum' : ''}><input id="au-pw" type="password" required minlength="6" autocomplete=${mode === 'nouveau' ? 'new-password' : 'current-password'} value=${pw} onInput=${e => setPw(e.target.value)}/><//>` : null}
      ${inscription ? html`<label class="check small"><input id="au-mail" type="checkbox" checked=${mails} onChange=${e => setMails(e.target.checked)}/> Le résumé de la semaine par email</label>
        <label class="check small"><input id="au-ok" type="checkbox" required checked=${ok} onChange=${e => setOk(e.target.checked)}/> <span>J’ai 18 ans ou plus et j’accepte la <a href="#confidentialite">Confidentialité</a>, y compris l’envoi de mes données aux États-Unis (emails, notifications)</span></label>` : null}
      ${msg ? html`<p class=${'auth-msg' + (msg.err ? ' err' : '')} role="alert">${msg.t}</p>` : null}
      <button class="btn primary wide" aria-busy=${busy || entre ? 'true' : null} disabled=${entre}>${entre ? 'Connexion…' : { inscription: 'Recevoir mon code', connexion: 'Recevoir mon code', code: 'Continuer', motdepasse: 'Se connecter', nouveau: 'Enregistrer' }[mode]}</button>
      ${inscription || mode === 'connexion' ? pourquoiCode : null}
      ${mode === 'code' ? html`<div class="au-code-pied"><span class="muted">Rien reçu ? Regarde dans tes spams.</span><${Renvoi} envoyeA=${envoyeA} busy=${busy} onRenvoyer=${() => envoyer(origine === 'inscription', true)}/></div>` : null}
      <div class="auth-links">
        ${inscription ? html`<button type="button" class="linkish" onClick=${() => vers('connexion')}>J’ai déjà un compte</button>` : null}
        ${mode === 'connexion' ? html`<button type="button" class="linkish" onClick=${() => vers('inscription')}>Créer un compte</button><button type="button" class="linkish" id="au-mdp" onClick=${() => vers('motdepasse')}>J’ai un mot de passe</button>` : null}
        ${mode === 'motdepasse' ? html`<button type="button" class="linkish" onClick=${() => vers('connexion')}>Recevoir un code à la place</button>` : null}
      </div>
    </form>
    <div class="auth-pour">${pour.map(([t, items]) => html`<section><h2 class="eyebrow">${t}</h2><ul class="auth-points">${items.map(([i, x]) => html`<li><span class="sc-ico"><${Icon} name=${i}/></span> ${x}</li>`)}</ul></section>`)}<${Vitrine}/></div>
    <div class="entree-scene sky"><${SchoolScene} fit="slice"/></div>
    <footer class="auth-pied small"><span>Initiative de lauréats, indépendante de l’administration de l’école</span><span class="auth-pied-liens"><a href=${'mailto:' + adresseContact()}>Contact</a><a href="#confidentialite">Confidentialité</a></span></footer>
  </main>`;
}

// Le magasin (Supabase) n'est pas importé d'avance : la page d'entrée n'attend pas ses 30 Ko.
// Jamais de message technique : s'il n'a pas pu se charger, c'est le réseau.
const PAS_DE_RESEAU = 'Pas de réseau pour l’instant. Réessaie dans un instant.';
async function texteErreurEntree(e) {
  if (e?.magasin) return PAS_DE_RESEAU;
  let t;
  try { t = (await import('./store.js')).texteErreur(e); } catch { return PAS_DE_RESEAU; }
  // Une erreur du service d'authentification que rien n'a traduite (anglais, « {} ») : jamais montrée telle quelle
  return (e?.__isAuthError || /^Auth/.test(e?.name || '')) && t === e.message ? 'Ça n’a pas marché. Réessaie dans un instant.' : t;
}

// ---------------------------------------------------------------------------
// Démarrage : qui voit quoi, et dans quel ordre tout se charge
// ---------------------------------------------------------------------------
// Pages ouvertes sans compte (vérification d'attestation, désabonnement, confidentialité) et retours d'emails
const PUBLIQUE = /^#(verifier|desabo|confidentialite)\b|access_token=|type=recovery|error_description=/;
const precharger = fichiers => {
  for (const f of fichiers || []) {
    if (document.querySelector(`link[href="${f}"]`)) continue;
    const l = document.createElement('link');
    if (/supabase\.js$/.test(f)) { l.rel = 'preload'; l.as = 'script'; } else l.rel = 'modulepreload';
    l.href = f; document.head.appendChild(l);
  }
};

// Un module qui n'a pas pu se charger reste en échec dans cette page : le navigateur ne le redemande jamais.
// On recharge donc la page, mais seulement quand le réseau répond (sinon le navigateur afficherait sa propre erreur),
// et deux fois au plus en deux minutes : une panne qui dure ne fait jamais tourner la page en boucle.
// garder : ce qui a été tapé sur la page d'entrée revient après le rechargement (jamais le mot de passe).
const repond = async f => { try { return (await fetch(f, { cache: 'no-store' })).ok; } catch { return false; } };
const SAISIE = 'ensam-entree-saisie', RECHARGES = 'ensam-rechargements';
let garderSaisie = () => {};
function recharger(garder = true) {
  try {
    const r = JSON.parse(sessionStorage.getItem(RECHARGES) || 'null');
    const n = r && Date.now() - r.t < 120e3 ? r.n : 0;
    if (n >= 2) return false;
    sessionStorage.setItem(RECHARGES, JSON.stringify({ n: n + 1, t: n ? r.t : Date.now() }));
    if (garder) garderSaisie();
  } catch { return false; /* stockage indisponible : pas de rechargement automatique */ }
  location.reload(); return new Promise(() => {});
}
// L'accord (case cochée) ne revient que juste après le rechargement qui l'a interrompu
function lireSaisie() {
  try {
    const x = JSON.parse(sessionStorage.getItem(SAISIE) || 'null'); sessionStorage.removeItem(SAISIE);
    return x && Date.now() - x.t < 600e3 ? { ...x, ok: !!x.ok && Date.now() - x.t < 60e3 } : null;
  } catch { return null; }
}
// Plus de rechargement automatique : un écran calme, et la page se recharge au retour du réseau ou d'un toucher
function sansReprise() {
  cacherEntree(true);
  delete document.documentElement.dataset.entree;
  const app = document.getElementById('app'); if (!app) return;
  app.innerHTML = '';
  render(html`<div class="fatal" role="alert"><${BrandLogo} size=${56}/><h1>Pas de connexion pour l’instant</h1><p>Vérifie ton réseau, puis réessaie.</p><p><button class="btn primary" onClick=${() => location.reload()}>Réessayer</button></p></div>`, app);
  addEventListener('online', () => location.reload(), { once: true });
}

let magasin = null, magasinEchec = false;
// Le magasin, une seule fois ; s'il n'a pas pu se charger (réseau), le prochain geste recharge la page dès que le réseau répond.
// geste : un toucher qui attendait un chargement encore en cours, et qui le voit échouer, suit le même chemin
export function attendreMagasin(geste = false) {
  if (!magasin) {
    if (magasinEchec) return repond('./store.js').then(ok => (ok && recharger()) || Promise.reject(new Error(PAS_DE_RESEAU)));
    precharger(window.ENSAM_MAGASIN);
    magasin = import('./store.js').then(m => m.createStore(), e => { magasinEchec = true; throw e; })
      .then(s => { monter(s); chargerApp(); return s; }, e => { magasin = null; throw e; });
  }
  return geste ? magasin.catch(e => magasinEchec ? attendreMagasin() : Promise.reject(e)) : magasin;
}
export const magasinEntree = () => magasin;
// Membre déjà connecté : ses données partent tout de suite, pendant que l'application se télécharge (au lieu d'après).
// Sans page d'entrée ; un échec (réseau) est repris par l'application (écran calme « Pas de connexion »).
function magasinMembre() {
  if (magasin) return;
  precharger(window.ENSAM_MAGASIN);
  magasin = import('./store.js').then(m => m.createStore());
  magasin.catch(() => { magasin = null; });
}

// Le CSS complet du site (site.css, outils/precharger.mjs) : la page ne garde que celui de l'entrée et de la forme de l'accueil.
// L'application l'attend avant son premier affichage. Rangé à la place de celui de l'entrée (avant le style que des modules
// ajoutent en fin de <head>), qui part une fois le complet appliqué : le résultat est exactement celui d'avant. Sans adresse
// (démo publiée telle quelle) : tout est déjà dans la page. Un échec (réseau) : l'application n'est pas affichée sans son
// style, la page se recharge dès que le réseau répond (chargerApp, comme un module qui n'a pas pu se charger).
// Appliqué, son adresse (avec son empreinte) est notée : le navigateur le garde, un membre le précharge dès <head> (page.html).
const CSS_VU = 'ensam-css';
let cssP = null;
export function chargerCss() {
  const href = window.ENSAM_CSS;
  if (!href || typeof document === 'undefined') return Promise.resolve();
  return cssP ||= new Promise((ok, ko) => {
    const l = document.createElement('link'), ici = document.getElementById('css-entree');
    l.rel = 'stylesheet'; l.href = href; l.dataset.css = 'site';
    l.onload = () => { ici?.remove(); ecrire(CSS_VU, href); ok(); };
    l.onerror = () => { l.remove(); cssP = null; ko(new TypeError('Failed to fetch')); };
    if (ici) ici.after(l); else document.head.appendChild(l);
  });
}
export const cssPret = () => chargerCss().catch(() => new Promise(() => {}));

let appLancee = false, appEchec = false, relance = false, connecte = false;
// cssEnsuite : un membre dont l'appareil n'a pas encore ce CSS (page.html, ENSAM_CSS_APRES). Il part quand app.js le demande
// (cssPret), tout le code arrivé : en 3G, il ne prend plus le réseau au code qu'attendent les données, lues pendant qu'il arrive.
function chargerApp({ cssEnsuite = false } = {}) {
  if (appLancee) return; appLancee = true;
  if (getLang() === 'ar') chargerAR().catch(() => {});
  precharger(window.ENSAM_MODULES);
  const css = cssEnsuite ? null : chargerCss(); css?.catch(() => {});
  import('./app.js').then(() => css || chargerCss()).catch(e => {
    // Un service worker garde peut-être une version qui ne colle plus : on le remet à neuf (une fois par visite)
    if (/^(SyntaxError|TypeError|ReferenceError)$/.test(e?.name) && navigator.serviceWorker?.controller) window.ensamReprise?.();
    // Sans service worker : un membre connecté (ou la démo) attend le réseau, puis la page se recharge ;
    // un visiteur garde la page d'entrée, et la page se recharge dès qu'il est connecté (avant ou après cet échec)
    appEchec = true;
    if (!document.documentElement.dataset.entree || connecte) relancerApp();
  });
}
// L'application n'a pas pu se charger : la page se recharge dès que le réseau répond (la session, elle, est gardée).
// Ce qu'un visiteur a tapé revient ; après la connexion, plus rien à garder.
function relancerApp() {
  if (relance) return; relance = true;
  const essai = async (n = 0) => {
    if (!(await repond('./app.js'))) return setTimeout(() => essai(n + 1), Math.min(30e3, 3e3 * 2 ** n));
    if (recharger(!connecte)) return;
    if (!connecte) try { garderSaisie(); } catch { /* stockage indisponible */ }
    sansReprise();
  };
  essai();
}
// Connecté : ce que la page d'entrée avait gardé pour un rechargement (« Ouvrir dans Chrome » que l'application a ignoré,
// par exemple) ne sert plus, et ne doit pas revenir sur la page d'entrée d'une déconnexion ou d'une session perdue
const apresConnexion = () => {
  connecte = true;
  try { sessionStorage.removeItem(SAISIE); } catch { /* stockage indisponible */ }
  if (appEchec) relancerApp();
};

// L'entrée vit dans son propre conteneur, à côté de #app ; l'application la reprend telle quelle
let el = null;
function monter(store) {
  if (!el) { el = document.createElement('div'); el.id = 'entree'; }
  if (!el.isConnected) document.getElementById('app')?.before(el);
  el.hidden = false;
  render(html`<${AuthScreen} store=${store}/>`, el);
}
export function cacherEntree(fin) {
  if (!el) return;
  if (fin) { render(null, el); el.remove(); el = null; } else el.hidden = true;
}
// Dans l'application : affiche l'entrée (même composant, même conteneur : l'état est gardé)
export function Entree({ store }) {
  useLayoutEffect(() => { monter(store); return () => cacherEntree(!!store.session); }, [store]);
  return null;
}

if (!window.ENSAM_ENTREE) {
  window.ENSAM_ENTREE = true;
  // Une nouvelle version du site recharge la page (pwa.js, une fois la page cachée) : ce que le visiteur a tapé revient
  addEventListener('ensam-recharge', () => { if (!connecte) try { garderSaisie(); } catch { /* stockage indisponible */ } });
  const cfg = window.ENSAM_CONFIG || {};
  const enLigne = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  let jeton = false;
  try { jeton = enLigne && !!lire(`sb-${new URL(cfg.supabaseUrl).hostname.split('.')[0]}-auth-token`); } catch { /* adresse invalide */ }
  // Lien arabe d'une promo (promo/AAAA/ar/) : la page s'ouvre en arabe pour cette visite (pas un choix gardé),
  // le dictionnaire suit en fond. Même chose quand on revient entrer un code demandé en arabe (autre onglet, lien de l'email).
  // La promo et le lien partagé sont gardés jusqu'à la fin de l'inscription : l'application les oublie dès
  // qu'un membre a son profil (un compte sans « Dernière étape » n'est pas encore un membre).
  if (lireInvitation() === 'ar' || (!lire('ensam-lang') && lireAttente()?.langue === 'ar')) setLang('ar', { attendre: false, garder: false }).catch(() => {});
  reprendreArrivee();
  retenirLien(location.hash);
  const d = document.documentElement;
  if (!enLigne || jeton || PUBLIQUE.test(location.hash)) {
    // Démo, membre déjà connecté, ou page publique : l'application tout de suite (la forme de l'accueil, ou le logo, patiente)
    delete d.dataset.entree;
    if (enLigne && jeton) magasinMembre();
    chargerApp({ cssEnsuite: !!window.ENSAM_CSS_APRES });
    chargerScene().catch(() => {});
  } else {
    d.dataset.entree = 'visiteur';
    // Quelque chose à finir tout de suite : un code attendu, ce qui avait été tapé avant un rechargement, un lien
    // d'appareil (?r=, ?notifs=, ?depuis= : l'application les lit)
    let presse = !!lireAttente() || /[?&](r|notifs|depuis)=/.test(location.search);
    try { presse ||= !!sessionStorage.getItem(SAISIE) || !!sessionStorage.getItem(RECHARGES); } catch { /* stockage indisponible */ }
    chiffresPublics();
    // Le navigateur d'une application, reconnu dès que possible : sa carte vient juste après le premier affichage
    chargerAppareil();
    monter(null);
    chargerScene().catch(() => {});
    let parti = false; const go = () => { if (!parti) { parti = true; attendreMagasin().catch(() => addEventListener('online', () => attendreMagasin().catch(() => {}), { once: true })); } };
    if (presse) {
      // Le magasin juste après le premier affichage (onglet en arrière-plan : requestAnimationFrame est suspendu)
      requestAnimationFrame(() => setTimeout(go)); setTimeout(go, 200);
    } else {
      // Sinon, la page d'entrée garde le réseau pour elle (en 3G, ses polices et ses photos d'abord) : le magasin (Supabase)
      // et l'application partent au premier geste (toucher, clavier), ou une fois la page chargée et calme,
      // ou au plus tard après 12 s. Un envoi touché avant les attend simplement (run → attendreMagasin).
      for (const t of ['pointerdown', 'keydown', 'focusin']) addEventListener(t, go, { once: true, passive: true, capture: true });
      const auCalme = () => setTimeout(() => (typeof requestIdleCallback === 'function' ? requestIdleCallback(go, { timeout: 2000 }) : go()), 1000);
      const charge = document.readyState === 'complete' ? Promise.resolve() : new Promise(ok => addEventListener('load', ok, { once: true }));
      Promise.all([charge, document.fonts?.ready]).then(auCalme, auCalme);
      setTimeout(go, 12e3);
    }
    // Un lien public ouvert depuis l'entrée (Confidentialité) avant que l'application soit là : le logo patiente
    // à sa place, l'entrée attend cachée (ce qui a été tapé reste) ; ensuite, c'est l'application qui décide
    addEventListener('hashchange', () => {
      if (window.ENSAM_APP || !el) return;
      const pub = PUBLIQUE.test(location.hash);
      el.hidden = pub;
      if (pub) { delete d.dataset.entree; go(); } else d.dataset.entree = 'visiteur';
    });
  }
}
