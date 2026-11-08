import { html, render, useState, useLayoutEffect, useEffect, useRef } from './vendor/preact-htm.js';
import { getLang, setLang, chargerAR, addAR, arCount, t } from './i18n.js';
import { glyph, TUILE_DEFS, TUILE } from './logo.js';
import { roleDePromo, promoValide, lignesChiffres, estEmailEcole, chiffresCode, adresseContact, VERSION_ACCORD, lienPartage, lienEncoreBon, estUuid, phraseLien, suiteLien, offreFermeePour, ecoleValide, adresseAvecContexte } from './regles-entree.js';

const LAU = ['خريج واحد', 'خريجان', 'خريجين', 'خريجًا'];
addAR({
  'Réseau ENSAM Meknès': 'شبكة ENSAM مكناس', 'Réseau ENSAM': 'شبكة ENSAM', 'Twiza': 'تويزة',
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

export const TYPE_ICON = { stage: 'wrench', pfe: 'cap', etranger: 'globe', emploi: 'briefcase' };
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
export const ajouterIcones = o => Object.assign(ICONS, o);

export function Field({ label, hint, children, err, errId }) {
  return html`<label class=${'field' + (err ? ' manque' : '')}><span class="field-label">${label}</span>${children}${err ? html`<span class="field-err" id=${errId} aria-hidden="true">${err}</span>` : null}${hint ? html`<span class="field-hint">${hint}</span>` : null}</label>`;
}

const LOGO_SVG = `${TUILE_DEFS}${TUILE}<g class="lg-glyph">${glyph()}</g>`;
let logoN = 0;
export function BrandLogo({ size = 38, draw = false }) {
  const [svg] = useState(() => LOGO_SVG.replaceAll('lg-tuile', `lg-tuile-${++logoN}`));
  return html`<svg class=${'brand-logo' + (draw ? ' draw' : '')} width=${size} height=${size} viewBox="0 0 512 512" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: svg }}></svg>`;
}

let gateOpened = false, scene = null, sceneP = null;
export const chargerScene = () => sceneP ||= import('./scene.js').then(m => (scene = m), e => { sceneP = null; throw e; });
export function SchoolScene({ align = 'xMidYMax', fit = 'meet', pose = 0, bande }) {
  const ref = useRef();
  const [pret, setPret] = useState(!!scene);
  useEffect(() => { if (!pret) chargerScene().then(() => setPret(true), () => {}); }, []);
  useLayoutEffect(() => {
    const t = ref.current?.querySelector('.g-txt');
    if (!t || (!bande && t.__b == null)) return;
    t.__b ??= t.textContent; const b = bande || t.__b; t.textContent = b; if (!bande) t.__b = null;
    for (const [k, v] of [['textLength', 212], ['lengthAdjust', 'spacingAndGlyphs']]) if (b.length > 20) t.setAttribute(k, v); else t.removeAttribute(k);
  }, [pret, bande, align, fit]);
  const [opening] = useState(() => { const o = !gateOpened; gateOpened = true; return o; });
  const [cadre] = useState([align, fit]);
  useLayoutEffect(() => { ref.current?.querySelector('svg')?.setAttribute('preserveAspectRatio', `${align} ${fit}`); }, [align, fit, pret]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => el.toggleAttribute('data-paused', !e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => { const el = ref.current; if (!el || !pose) return; const t = setTimeout(() => el.setAttribute('data-pose', ''), pose); return () => clearTimeout(t); }, [pose]);
  return html`<div ref=${ref} class=${'scene' + (opening ? ' opening' : '')} aria-hidden="true" dangerouslySetInnerHTML=${{ __html: pret && scene ? scene.sceneMarkup(...cadre) : '' }}></div>`;
}

let signaler = () => {};
export const brancherSignal = f => { signaler = f; };

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

const CLE = 'ensam-invite-promo', CLE_ROLE = 'ensam-role-choisi', CLE_ECOLE = 'ensam-invite-ecole';
const CLE_DE = 'ensam-invite-de', CODE_DE = /^[a-z0-9]{8}$/;
const CLE_MEKNES = 'ensam-invite-meknes';
const valide = promoValide;
const lire = k => { try { return localStorage.getItem(k); } catch { return null; } };
const ecrire = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* navigation privée */ } };

export function lireInvitation() {
  try {
    const u = new URL(location.href), q = u.searchParams, de = q.get('de'), e = q.get('ecole'), promo = q.has('promo');
    if (CODE_DE.test(de)) ecrire(CLE_DE, de);
    if (e === null) { if (de !== null || promo) { ecrire(CLE_ECOLE); ecrire(CLE_MEKNES, '1'); } } else if (ecoleValide(e)) { ecrire(CLE_ECOLE, e); ecrire(CLE_MEKNES); }
    q.delete('de'); q.delete('ecole');
    if (!promo) { if (de !== null || e !== null) history.replaceState(history.state, '', u.pathname + u.search + u.hash); return null; }
    const n = Number(q.get('promo'));
    if (valide(n)) localStorage.setItem(CLE, String(n));
    const ar = q.get('lang') === 'ar' && !localStorage.getItem('ensam-lang');
    q.delete('promo'); q.delete('lang');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    return ar ? 'ar' : null;
  } catch { return null; /* stockage ou historique indisponible : le lien marche quand même, sans promo pré-remplie */ }
}
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
    history.replaceState(history.state, '', location.pathname + a.search + (a.lien ? '#' + a.lien.r : location.hash));
  } catch { /* historique ou stockage indisponible : la page s'ouvre sans ce contexte */ }
}
export function promoInvitee() { const n = Number(lire(CLE)); return valide(n) ? n : null; }
export function ecoleInvitee() { const e = lire(CLE_ECOLE); return ecoleValide(e) ? e : null; }
export const ecoleRetenue = () => ecoleInvitee() || (lire(CLE_MEKNES) ? 'ensam-meknes' : null);
export const argsEcole = () => { const e = ecoleInvitee(); return e && e !== 'ensam-meknes' ? { p_ecole: e } : {}; };
export const retenirRole = r => ecrire(CLE_ROLE, r === 'etudiant' || r === 'laureat' ? r : null);
export const roleRetenu = () => { const r = lire(CLE_ROLE); return r === 'etudiant' || r === 'laureat' ? r : null; };
export function oublierInvitation() { ecrire(CLE, null); ecrire(CLE_ROLE, null); ecrire(CLE_ECOLE, null); ecrire(CLE_MEKNES, null); ecrire(CLE_DE, null); adresseIci(null); }
const codeInvite = () => { const c = lire(CLE_DE); return c && CODE_DE.test(c) ? c : null; };
function adresseIci(mode) {
  if (APPLI_ICI !== 'ios' || mode === 'nouveau') return;
  try { history.replaceState(history.state, '', adresseAvecContexte(location.href, mode && { promo: promoInvitee(), de: codeInvite(), ecole: ecoleInvitee(), role: roleRetenu(), mode: mode === 'inscription' ? mode : 'connexion' }, getLang())); } catch { /* historique indisponible */ }
}

const CLE_ACCORD = 'ensam-accord-ici';
const adresse = e => String(e || '').trim().toLowerCase();
const noterAccord = (e, r) => ecrire(CLE_ACCORD, JSON.stringify({ e: adresse(e), r: r || null, t: Date.now() }));
function lireAccord(e) { try { const a = JSON.parse(lire(CLE_ACCORD) || 'null'); return a && adresse(e) && a.e === adresse(e) ? a : null; } catch { return null; } }
export function accordIci(e) { return !!lireAccord(e); }
export function roleAccord(e) { const r = lireAccord(e)?.r; return r === 'etudiant' || r === 'laureat' ? r : null; }

const CLE_LIEN = 'ensam-lien-partage';
let lienGarde = null;
export function retenirLien(hash) { const l = lienPartage(hash); if (l) ecrire(CLE_LIEN, JSON.stringify(lienGarde = { r: l.r, t: Date.now() })); }
export function lienRetenu() { try { return lienEncoreBon(JSON.parse(lire(CLE_LIEN) || 'null') || lienGarde); } catch { return null; } }
export const oublierLien = () => { lienGarde = null; ecrire(CLE_LIEN, null); };
export { suiteLien };

const ROLES = [
  ['etudiant', 'cap', 'Je suis à l’école', 'De la 1re à la 5e année à l’ENSAM Meknès', '1re à 5e année'],
  ['laureat', 'briefcase', 'J’ai mon diplôme', 'De l’ENSAM Meknès, en poste ou en recherche d’emploi', 'Diplôme ENSAM'],
];
export function ChoixRole({ value, onChange, idPrefix = 'pf-je-', compact = false, noms }) {
  return html`<fieldset class=${'je-suis' + (compact ? ' compact' : '')}><legend>Ta situation</legend><div class="je-suis-choix">
    ${ROLES.map(([r, ico, t, long, court]) => html`<button type="button" id=${idPrefix + r} class=${'je-carte' + (value === r ? ' on' : '')} aria-pressed=${value === r ? 'true' : 'false'} onClick=${() => onChange(r)}>
      <span class="je-ico"><${Icon} name=${ico} size=${compact ? 18 : 22}/></span><strong>${t}</strong><span class="small muted">${compact ? (noms && r === 'laureat' ? noms.diplome : court) : noms ? noms[r] : long}</span><span class="je-coche"><${Icon} name="check" size=${16}/></span></button>`)}</div></fieldset>`;
}

async function appelPublic(nom, corps, cfg) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000);
  try {
    const r = await fetch(`${cfg.supabaseUrl}/rest/v1/${corps ? 'rpc/' : ''}${nom}`, { method: corps ? 'POST' : 'GET', headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, 'Content-Type': 'application/json' }, body: corps ? JSON.stringify(corps) : null, signal: c.signal });
    return r.ok ? { ok: true, x: await r.json() } : { ok: false };
  } catch { return { ok: false }; } finally { clearTimeout(t); }
}
const enLigneCfg = cfg => !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
const chiffresP = new Map();
export function chiffresPublics(cfg = window.ENSAM_CONFIG || {}) {
  if (!enLigneCfg(cfg)) return Promise.resolve(null);
  const args = argsEcole(), cle = args.p_ecole || '';
  if (!chiffresP.has(cle)) chiffresP.set(cle, appelPublic('chiffres_publics', args, cfg).then(r => { if (!r.ok) chiffresP.delete(cle); return r.ok ? r.x : null; }));
  return chiffresP.get(cle);
}
const mots = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
const nomsVus = new WeakMap();
export function nomsDeLigne(l) {
  if (l?.ouverte !== true || !ecoleValide(l.slug) || l.slug === 'ensam-meknes') return null;
  if (nomsVus.has(l)) return nomsVus.get(l);
  const ville = mots(l.ville, 60), court = mots(l.nom_court, 40), nom = mots(l.nom, 120) || [court || 'ENSAM', ville].filter(Boolean).join(' ');
  const ar = mots(l.nom_ar, 120) || nom, dip = court || nom, ec = /^[aeiouyàâäéèêëîïôöûüÿæœ]/i.test(nom) ? '' : 'école ';
  const n = { nom, marque: `Réseau ${nom}`, etudiant: `De la 1re à la 5e année à l’${ec}${nom}`, laureat: `De l’${ec}${nom}, en poste ou en recherche d’emploi`, diplome: `Diplôme ${dip}`,
    bande: (court && ville ? `${court} · ${ville}` : dip).toUpperCase(), domaines: Array.isArray(l.domaines) ? l.domaines.filter(d => typeof d === 'string' && d) : [], obligatoire: l.email_obligatoire === true };
  addAR({ [n.marque]: `شبكة ${ar}`, [n.etudiant]: `من السنة الأولى إلى الخامسة في ${ar}`, [n.laureat]: `من ${ar}، في وظيفة أو في بحث عن عمل`, [n.diplome]: `شهادة ${dip}` });
  nomsVus.set(l, n);
  return n;
}
const lignesP = new Map(), lus = new Map();
export function ecoleDuLien(cfg = window.ENSAM_CONFIG || {}) {
  const e = argsEcole().p_ecole;
  if (!e || !enLigneCfg(cfg)) return Promise.resolve(null);
  if (!lignesP.has(e)) lignesP.set(e, appelPublic(`ecoles?select=*&slug=eq.${e}&ouverte=is.true`, null, cfg).then(r => { if (!r.ok) return void lignesP.delete(e); const n = Array.isArray(r.x) ? nomsDeLigne(r.x.find(x => x?.slug === e)) : null; lus.set(e, n); return n; }));
  return lignesP.get(e);
}
export async function offrePartagee(id, cfg = window.ENSAM_CONFIG || {}) {
  if (!estUuid(id) || !enLigneCfg(cfg)) return undefined;
  const { ok, x } = await appelPublic('offre_partagee', { p_id: id }, cfg);
  if (!ok) return undefined;
  if (x === null) return null;
  return ['stage', 'pfe', 'etranger', 'emploi'].includes(x?.type) ? { type: x.type, audience: x.audience === 'laureats' ? 'laureats' : 'etudiants', ouverte: x.ouverte !== false } : undefined;
}

export async function invitationDe(code, cfg = window.ENSAM_CONFIG || {}) {
  if (!CODE_DE.test(code || '') || !enLigneCfg(cfg)) return undefined;
  const { ok, x } = await appelPublic('invitation_de', { p_code: code, ...argsEcole() }, cfg);
  if (!ok) return undefined;
  const prenom = typeof x?.prenom === 'string' ? x.prenom.trim().slice(0, 40) : '';
  return prenom ? { prenom, promo: promoValide(Number(x.promo)) ? Number(x.promo) : null } : null;
}
export const ligneInvitation = (x, ar = getLang() === 'ar') => (!x ? '' : ar
  ? `دعوة من \u2068${x.prenom}\u2069${x.promo ? ` · دفعة ${x.promo}` : ''}`
  : `Invitation de ${x.prenom}${x.promo ? ` · promo ${x.promo}` : ''}`);

const DEJA_MEMBRE = 'ensam-deja-membre';
export const marquerMembre = () => ecrire(DEJA_MEMBRE, '1');
const dejaMembre = () => lire(DEJA_MEMBRE) === '1';
const CLE_CODE = 'ensam-code-attendu';
const lireAttente = () => { try { const a = JSON.parse(lire(CLE_CODE)); return a?.email && Date.now() - a.t < 3600e3 ? a : null; } catch { return null; } };
const noterAttente = a => ecrire(CLE_CODE, a ? JSON.stringify(a) : null);
const focus = id => setTimeout(() => document.getElementById(id)?.focus());

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

function Fondateurs() {
  const [M, setM] = useState(null);
  useEffect(() => { import('./fondateurs-public.js').then(m => setM(() => m.FondateursPublics), () => {}); }, []);
  return M ? html`<${M}/>` : null;
}
function Vitrine() {
  const [M, setM] = useState(null);
  useEffect(() => { import('./entree-vitrine.js').then(m => setM(() => m.VitrineEntree), () => {}); }, []);
  return M ? html`<${M}/>` : null;
}

export function appliIci(ua = '', toucher = 0) {
  const s = String(ua || ''), sys = /android/i.test(s) ? 'android' : /iphone|ipad|ipod/i.test(s) || (/Macintosh/.test(s) && toucher > 1) ? 'ios' : '';
  return sys && (/FBAN\/|FBAV\/|FB_IAB|FBIOS|FB4A/.test(s) || /FB_IAB\/MESSENGER|FBAN\/Messenger|MessengerForiOS|MessengerLite|\bInstagram\b|LinkedInApp|musical_ly|BytedanceWebview|\bTikTok\b|\bSnapchat\b|\bTelegram\b/i.test(s) || (sys === 'android' && /; wv\)/.test(s))) ? sys : '';
}
const PLACE = {
  androidfr: [21.5, 11.72, 22.4, 8.72, 25.9, 7.39, 37.5, 6.05, 99, 4.72, 6.05],
  androidar: [24.9, 6.05, 99, 4.72, 4.72],
  iosfr: [17.87, 10.56, 20.5, 9.22, 23.93, 7.89, 30.18, 6.56, 99, 5.22, 6.56],
  iosar: [17.56, 10.65, 17.62, 8.28, 21.25, 6.56, 28.25, 5.22, 99, 3.89, 3.89],
};
const BORD = { android: 46.5, ios: 2 };
const placeRem = (sys, lang, largeur, rem) => {
  const t = PLACE[sys + (lang === 'ar' ? 'ar' : 'fr')];
  let i = 0;
  if (largeur < 900) while (largeur / rem >= t[i]) i += 2; else i = t.length - 2;
  return t[i + 1];
};
export const placeCarte = (sys, lang, largeur, rem = 16) => `calc(${BORD[sys]}px + ${placeRem(sys, lang, largeur, rem)}rem)`;
const SOUS_CARTE = { fr: [36.6, 35.15], ar: [37.05, 35.25] };
const BANDE = { fr: { promo: [3.4, 3.4], de: [4.8, 3.4] }, ar: { promo: [3.55, 3.55], de: [3.55, 3.55] } };
export function carteTient(sys, lang, largeur, hauteur, rem = 16, bande = '') {
  const l = lang === 'ar' ? 'ar' : 'fr', etroite = largeur / rem < 23.4;
  const [etroit, large] = SOUS_CARTE[l];
  const enPlus = bande ? BANDE[l][bande][etroite ? 0 : 1] : 0;
  return hauteur >= BORD[sys] + (placeRem(sys, lang, largeur, rem) + (etroite ? etroit : large) + enPlus) * rem;
}
const MOT = { androidfr: [24, 3.42], iosfr: [23.25, 3.44], iosar: [17.56, 2.77] };
export function placeMot(sys, lang, largeur, rem = 16) {
  const m = MOT[sys + (lang === 'ar' ? 'ar' : 'fr')];
  return m && largeur / rem < m[0] ? `${m[1]}rem` : '44px';
}
const APPLI_ICI = appliIci(navigator.userAgent, navigator.maxTouchPoints);
const CLE_CARTE = 'ensam-entree-appli';
const lireVisite = k => { try { return sessionStorage.getItem(k); } catch { return null; } };
const ecrireVisite = (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* navigation privée */ } };
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
const sansTraduction = el => el?.setAttribute('translate', 'no');
function CarteAppli({ mode, role, invite, ligne = false, onEchec }) {
  const [a, setA] = useState(() => appareil);
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
  const placeLigne = placeMot(sys, getLang(), largeur, rem);
  if (!a) return html`<div key="place" class="entree-appli-place" style=${{ minHeight: place || placeLigne }}></div>`;
  const T = a.CARTE, f = x => a.nomsLatins(a.typo(t(x), getLang())).map((p, i) => (i % 2 ? html`<span translate="no" dir="auto" ref=${sansTraduction}>${p}</span>` : p));
  const lien = () => a.lienChrome(location.href, lienRetenu()?.r, { lang: getLang(), contexte: { promo: invite, de: codeInvite(), ecole: ecoleInvitee(), role, mode: mode === 'inscription' ? mode : 'connexion' }, ici: true });
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
  const invite = promoInvitee();
  const [lien] = useState(lienRetenu);
  const [infos, setInfos] = useState(undefined);
  useEffect(() => {
    if (lien?.k !== 'offre') return;
    let vivant = true;
    offrePartagee(lien.id).then(x => {
      if (!vivant) return;
      setInfos(x);
      if (x === null) { oublierLien(); try { location.replace('#accueil'); } catch { /* */ } }
    });
    return () => { vivant = false; };
  }, []);
  const [mode, setMode] = useState(() => {
    const arrivee = modeArrivee; modeArrivee = null;
    return recovery ? 'nouveau' : attente ? 'code' : store?.sessionPerdue || store?.compteParti ? 'connexion'
      : ['inscription', 'connexion', 'motdepasse'].includes(saisie?.mode) ? saisie.mode
      : arrivee || (lien?.k === 'aider' ? 'connexion' : invite || !dejaMembre() ? 'inscription' : 'connexion');
  });
  const [origine, setOrigine] = useState(attente ? (attente.creer ? 'inscription' : 'connexion') : 'inscription');
  const [role, setRoleEtat] = useState(() => roleRetenu() || (invite ? roleDePromo(invite) : ''));
  const [court] = useState(() => innerWidth < 900 && innerHeight < 680);
  const [bandeCourte] = useState(() => innerWidth < 900);
  const [appli] = useState(() => {
    if (!APPLI_ICI) return '';
    const largeur = document.documentElement.clientWidth || innerWidth, rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const bande = mode !== 'inscription' ? '' : codeInvite() ? 'de' : invite && (!role || role === roleDePromo(invite)) ? 'promo' : '';
    return innerWidth >= 900 || carteTient(APPLI_ICI, getLang(), largeur, innerHeight, rem, bande) ? 'carte' : court ? 'haut' : 'ligne';
  });
  const [appliKo, setAppliKo] = useState(false);
  const carteIci = mode === 'inscription' || mode === 'connexion' || mode === 'motdepasse';
  const enHaut = appli === 'haut' && carteIci && !appliKo;
  const [sansSous] = useState(() => !!APPLI_ICI && innerWidth < 900 && (!vueCarte() || appli !== 'carte'));
  const serre = enHaut;
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
  const autre = argsEcole().p_ecole;
  const [noms, setNoms] = useState(() => (!autre ? null : lus.has(autre) ? lus.get(autre) : undefined));
  useEffect(() => {
    if (!autre || noms !== undefined) return;
    let vivant = true; const relire = () => ecoleDuLien().then(n => { if (vivant && n !== undefined) setNoms(n); });
    relire(); addEventListener('online', relire);
    return () => { vivant = false; removeEventListener('online', relire); };
  }, [noms === undefined, !store]);
  const marqueFr = noms ? noms.marque : noms === undefined ? 'Réseau ENSAM' : 'Réseau ENSAM Meknès';
  useLayoutEffect(() => { if (autre) document.title = marqueFr; else if (!document.title.endsWith('Réseau ENSAM Meknès')) document.title = 'Réseau ENSAM Meknès'; }, [marqueFr]);
  const [deQui, setDeQui] = useState(null);
  useEffect(() => {
    const c = codeInvite(); if (!c) return;
    let vivant = true;
    invitationDe(c).then(x => { if (!vivant) return; if (x === null) { ecrire(CLE_DE, null); setDeQui(false); } else if (x) setDeQui(x); });
    return () => { vivant = false; };
  }, []);
  useEffect(() => { adresseIci(mode); }, [mode, deQui, getLang()]);
  const setRole = r => { setRoleEtat(r); retenirRole(r); setRoleMsg(false); adresseIci(mode); };
  const occupe = useRef(false);
  const run = async fn => {
    if (occupe.current) return; occupe.current = true;
    setBusy(true); setMsg(null);
    try { await fn(store || await attendreMagasin(true).catch(e => { throw Object.assign(e, { magasin: true }); })); } catch (e) { setMsg({ err: true, t: await texteErreurEntree(e) }); }
    occupe.current = false; setBusy(false);
  };
  const ecole = noms ? noms.domaines : noms === undefined ? [] : store?.domainesEcole?.() || [];
  const deLEcole = estEmailEcole(email, ecole);
  const meta = () => { const de = codeInvite(), e = argsEcole().p_ecole; return { consent_at: new Date().toISOString(), consent_version: VERSION_ACCORD, emails_hebdo: mails, langue: getLang(), ...(role ? { role_choisi: role } : {}), ...(de ? { invite_par: de } : {}), ...(e ? { ecole: e } : {}) }; };
  const vers = (m, cible = m === 'motdepasse' ? 'au-pw' : m === 'inscription' && !role ? 'au-je-etudiant' : 'au-email') => { setMode(m); setMsg(null); setRoleMsg(false); focus(cible); };

  const envoyer = (creer, renvoi = false) => run(async s => {
    const e = email.trim(), n = await ecoleDuLien(), doms = n ? n.domaines : n === undefined ? [] : s.domainesEcole();
    if (autre && n !== undefined) setNoms(n);
    if (creer && role === 'etudiant' && (n ? n.obligatoire : s.reglages?.email_ecole_obligatoire === true) && doms.length && !estEmailEcole(e, doms)) throw new Error('Inscris-toi avec ton email de l’école.');
    const attendu = t => { noterAttente({ email: e, t, creer, mails, langue: getLang() }); setEnvoyeA(t); setOrigine(creer ? 'inscription' : 'connexion'); setMode('code'); focus('au-code'); };
    if (creer) noterAccord(e, role);
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
    const ins = origine === 'inscription';
    try { await s.verifierCode(email.trim(), v, ins ? meta() : null, ins ? ecoleRetenue() : null); } catch (e) { setTimeout(() => document.getElementById('au-code')?.select()); throw e; }
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
  const deIci = deQui && inscription, memePromo = !!(deIci && bandeau && Number(deQui.promo) === invite);
  const ecoleOk = deLEcole && (inscription || mode === 'connexion') ? html`<span id="au-ecole" class="field-hint good-t" role="status"><${Icon} name="check" size=${14}/> ${role === 'laureat' || mode === 'connexion' ? 'Email de l’école reconnu.' : 'Email de l’école reconnu : ton profil étudiant sera vérifié tout de suite.'}</span>` : null;
  const indice = inscription && role === 'etudiant' && ecole.length && !deLEcole ? `Côté étudiants : ${(noms ? noms.obligatoire : store?.reglages?.email_ecole_obligatoire) ? 'inscris-toi' : 'de préférence'} avec ton email de l’école (${ecole.map(d => '@' + d).join(', ')}). Ton compte est alors vérifié tout de suite.` : '';
  const champEmail = html`<${Field} label="Email" hint=${indice}><input id="au-email" type="email" required autocomplete="email" inputmode="email" dir="ltr" value=${email} onInput=${e => setEmail(e.target.value)}/>${ecoleOk}<//>`;
  const pourquoiCode = html`<p class="small muted au-sans-mdp">Pas de mot de passe : on t’envoie un code à 6 chiffres par email.</p>`;
  const pour = (etuAvant ? ['etudiant', 'laureat'] : ['laureat', 'etudiant']).map(r => POUR[r]);
  const inscrire = inscription || (mode === 'code' && origine === 'inscription');
  const icoLien = lien?.k === 'question' ? 'qa' : lien?.k === 'aider' ? 'send' : infos?.audience === 'laureats' ? 'briefcase' : TYPE_ICON[infos?.type] || 'feed';

  return html`<main class="auth entree">
    <div class="entree-ciel sky" aria-hidden="true"></div>
    <header class="entree-top"><span class="entree-marque"><${BrandLogo} size=${34} draw/><span>${marqueFr}</span></span><${LangToggle} onChange=${relang} aussitot/></header>
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
      ${inscription ? html`<${ChoixRole} value=${role} onChange=${setRole} idPrefix="au-je-" compact noms=${noms}/>
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
    <div class="entree-scene sky"><${SchoolScene} fit="slice" bande=${noms ? noms.bande : noms === undefined ? 'ENSAM' : undefined}/></div>
    <footer class="auth-pied small"><strong class="auth-pied-marque">Twiza</strong><span>Initiative de lauréats, indépendante de l’administration de l’école</span><span class="auth-pied-liens"><a href=${'mailto:' + adresseContact()}>Contact</a><a href="#confidentialite">Confidentialité</a></span></footer>
  </main>`;
}

const PAS_DE_RESEAU = 'Pas de réseau pour l’instant. Réessaie dans un instant.';
async function texteErreurEntree(e) {
  if (e?.magasin) return PAS_DE_RESEAU;
  let t;
  try { t = (await import('./store.js')).texteErreur(e); } catch { return PAS_DE_RESEAU; }
  return (e?.__isAuthError || /^Auth/.test(e?.name || '')) && t === e.message ? 'Ça n’a pas marché. Réessaie dans un instant.' : t;
}

const PUBLIQUE = /^#(verifier|desabo|confidentialite)\b|access_token=|type=recovery|error_description=/;
const precharger = fichiers => {
  for (const f of fichiers || []) {
    if (document.querySelector(`link[href="${f}"]`)) continue;
    const l = document.createElement('link');
    if (/supabase\.js$/.test(f)) { l.rel = 'preload'; l.as = 'script'; } else l.rel = 'modulepreload';
    l.href = f; document.head.appendChild(l);
  }
};

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
function lireSaisie() {
  try {
    const x = JSON.parse(sessionStorage.getItem(SAISIE) || 'null'); sessionStorage.removeItem(SAISIE);
    return x && Date.now() - x.t < 600e3 ? { ...x, ok: !!x.ok && Date.now() - x.t < 60e3 } : null;
  } catch { return null; }
}
function sansReprise() {
  cacherEntree(true);
  delete document.documentElement.dataset.entree;
  const app = document.getElementById('app'); if (!app) return;
  app.innerHTML = '';
  render(html`<div class="fatal" role="alert"><${BrandLogo} size=${56}/><h1>Pas de connexion pour l’instant</h1><p>Vérifie ton réseau, puis réessaie.</p><p><button class="btn primary" onClick=${() => location.reload()}>Réessayer</button></p></div>`, app);
  addEventListener('online', () => location.reload(), { once: true });
}

let magasin = null, magasinEchec = false;
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
function magasinMembre() {
  if (magasin) return;
  precharger(window.ENSAM_MAGASIN);
  magasin = import('./store.js').then(m => m.createStore());
  magasin.catch(() => { magasin = null; });
}

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
function chargerApp({ cssEnsuite = false } = {}) {
  if (appLancee) return; appLancee = true;
  if (getLang() === 'ar') chargerAR().catch(() => {});
  precharger(window.ENSAM_MODULES);
  const css = cssEnsuite ? null : chargerCss(); css?.catch(() => {});
  import('./app.js').then(() => css || chargerCss()).catch(e => {
    if (/^(SyntaxError|TypeError|ReferenceError)$/.test(e?.name) && navigator.serviceWorker?.controller) window.ensamReprise?.();
    appEchec = true;
    if (!document.documentElement.dataset.entree || connecte) relancerApp();
  });
}
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
const apresConnexion = () => {
  connecte = true;
  try { sessionStorage.removeItem(SAISIE); } catch { /* stockage indisponible */ }
  if (appEchec) relancerApp();
};

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
export function Entree({ store }) {
  useLayoutEffect(() => { monter(store); return () => cacherEntree(!!store.session); }, [store]);
  return null;
}

if (!window.ENSAM_ENTREE) {
  window.ENSAM_ENTREE = true;
  addEventListener('ensam-recharge', () => { if (!connecte) try { garderSaisie(); } catch { /* stockage indisponible */ } });
  const cfg = window.ENSAM_CONFIG || {};
  const enLigne = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  let jeton = false;
  try { jeton = enLigne && !!lire(`sb-${new URL(cfg.supabaseUrl).hostname.split('.')[0]}-auth-token`); } catch { /* adresse invalide */ }
  if (lireInvitation() === 'ar' || (!lire('ensam-lang') && lireAttente()?.langue === 'ar')) setLang('ar', { attendre: false, garder: false }).catch(() => {});
  reprendreArrivee();
  retenirLien(location.hash);
  const d = document.documentElement;
  if (!enLigne || jeton || PUBLIQUE.test(location.hash)) {
    delete d.dataset.entree;
    if (enLigne && jeton) magasinMembre();
    chargerApp({ cssEnsuite: !!window.ENSAM_CSS_APRES });
    chargerScene().catch(() => {});
  } else {
    d.dataset.entree = 'visiteur';
    let presse = !!lireAttente() || /[?&](r|notifs|depuis)=/.test(location.search);
    try { presse ||= !!sessionStorage.getItem(SAISIE) || !!sessionStorage.getItem(RECHARGES); } catch { /* stockage indisponible */ }
    chiffresPublics(); ecoleDuLien();
    chargerAppareil();
    monter(null);
    chargerScene().catch(() => {});
    let parti = false; const go = () => { if (!parti) { parti = true; attendreMagasin().catch(() => addEventListener('online', () => attendreMagasin().catch(() => {}), { once: true })); } };
    if (presse) {
      requestAnimationFrame(() => setTimeout(go)); setTimeout(go, 200);
    } else {
      for (const t of ['pointerdown', 'keydown', 'focusin']) addEventListener(t, go, { once: true, passive: true, capture: true });
      const auCalme = () => setTimeout(() => (typeof requestIdleCallback === 'function' ? requestIdleCallback(go, { timeout: 2000 }) : go()), 1000);
      const charge = document.readyState === 'complete' ? Promise.resolve() : new Promise(ok => addEventListener('load', ok, { once: true }));
      Promise.all([charge, document.fonts?.ready]).then(auCalme, auCalme);
      setTimeout(go, 12e3);
    }
    addEventListener('hashchange', () => {
      if (window.ENSAM_APP || !el) return;
      const pub = PUBLIQUE.test(location.hash);
      el.hidden = pub;
      if (pub) { delete d.dataset.entree; go(); } else d.dataset.entree = 'visiteur';
    });
  }
}
