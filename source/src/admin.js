// Administration : la console. Sur ordinateur, les rubriques dans une colonne en groupes (Piloter, Animer, Gérer, Grandir) ;
// sur téléphone, une rangée de puces. Le tableau de bord (objectif du plan, chiffres, annonce, défis, parrains), ce qui est
// à traiter, l'animation du réseau, l'agenda, les invitations, les membres, les contenus, la modération des signalements,
// la liste officielle des étudiants, les écoles, les partenaires, les cartes sponsorisées de Match, les affiches et le rapport,
// et les réglages (email de l'école). Le cadre et les rubriques nouvelles sont dans admin-console*.js et admin-tableau.js.
import { html, useState, useEffect, useMemo, useRef } from './vendor/preact-htm.js';
import { Icon, Field, Person, Empty, Bar, Avatar, toast, injectCSS, EnTetePage, useLocal } from './ui.js';
import { addAR, arCount } from './i18n.js';
import { niveauOf, timeAgo, cleNom, norm, pct, parcoursInscription, codesSansSuite, PUBLICS, ANNONCE_JOURS, annonceVisible,
  SPONSO_PUBLICS, SPONSO_ANNEES, jourLocal, normaliserSponsorise, refusSponsorise, etatSponsorise, tauxClic, resumeFilieres, seasonLabel } from './logic.js';
import { DefisAdmin } from './saison.js';
import { AgendaAdmin } from './agenda.js';
import { InvitationsAdmin } from './invitation.js';
import { AmbassadeursAdmin } from './ambassadeurs.js';
import { lireCVDe, libellesCV, SignalerLecture, CvButton } from './cv.js';
import { MessageBtn } from './messages.js';
import { propositionCV, corrigeProfil, dejaSignalee } from './lire-cv.js';
import { ajouterIcones } from './entree.js';
import { FilieresPick } from './offers.js';
import { ApercuSponsorise } from './match.js';
import { getLang } from './i18n.js';
import { useEcoles } from './admin-donnees.js';
import { RUBRIQUES, useLarge, MenuConsole, PucesConsole, ChoixEcole, RechercheConsole, telecharger } from './admin-console.js';
// Les règles sans écran, importées d'ici aussi : le navigateur les découvre avec le reste (un aller-retour de moins au premier chargement)
import { donneesDeLEcole, elementsATraiter } from './admin-console-regles.js';
import { MOTIFS, TYPES_CIBLE, court, cible, demandeCV } from './admin-console-cibles.js';
import { ObjectifPlan, KpisPilotage, OuSontLesMembres, CeuxQuiAident, CeQuiSestPasse } from './admin-tableau.js';
import { CalloutATraiter, ATraiter } from './admin-console-traiter.js';
import { TableMembres } from './admin-console-membres.js';
import { Contenus } from './admin-console-contenus.js';
import { AnimerAdmin } from './admin-animer.js';
import { EcolesAdmin } from './admin-ecoles.js';
import { PartenairesAdmin } from './admin-partenaires.js';
import { OutilsAdmin } from './admin-outils.js';

// Une étiquette : l'onglet des cartes sponsorisées
ajouterIcones({ etiquette: '<path d="M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2a1.2 1.2 0 0 1 0 1.7l-7.6 7.6a1.2 1.2 0 0 1-1.7 0z"/><circle cx="8" cy="8" r="1.4"/>' });

addAR({
  'Vue d’ensemble': 'نظرة عامة', 'Modération': 'الإشراف', 'Liste officielle': 'اللائحة الرسمية', 'Réglages': 'الإعدادات', 'Agenda': 'المفكرة',
  'À traiter': 'للمعالجة', 'Signalements': 'التبليغات', 'Tout est à jour.': 'كل شيء محدَّث.',
  // Modération
  'Offre': 'عرض', 'Commentaire': 'تعليق', 'Question': 'سؤال', 'Réponse': 'جواب', 'Message de groupe': 'رسالة في مجموعة', 'Message privé': 'رسالة خاصة', 'Voir la photo': 'عرض الصورة', 'Fichier indisponible.': 'الملف غير متاح.', 'Profil': 'الملف الشخصي',
  'Entretien': 'مقابلة', 'Avis de stage': 'رأي حول تدريب', 'Guide de l’étranger': 'دليل الخارج', 'Café ENSAM': 'مقهى ENSAM', 'Startup': 'شركة ناشئة', 'Relecture de CV': 'مراجعة السيرة الذاتية',
  'Spam': 'رسائل مزعجة', 'Arnaque': 'احتيال', 'Inapproprié': 'غير لائق', 'Faux ou trompeur': 'خاطئ أو مضلل', 'Harcèlement': 'تحرش أو مضايقة', 'Données personnelles': 'معطيات شخصية', 'Autre': 'غير ذلك',
  'Aucun signalement': 'لا توجد تبليغات', 'Quand un membre signale un contenu, il apparaît ici. Tu décides de le retirer ou de le garder.': 'عندما يبلّغ عضو عن محتوى، يظهر هنا. تقرر حذفه أو إبقاءه.',
  'Contenu déjà supprimé': 'المحتوى حُذف من قبل', 'Clore': 'إغلاق', 'Classer sans suite': 'حفظ دون متابعة', 'Marquer traité': 'تحديد كمُعالج',
  'Masquer l’offre': 'إخفاء العرض', 'Supprimer l’offre': 'حذف العرض', 'Supprimer le commentaire': 'حذف التعليق', 'Réponse à une demande': 'رد على طلب', 'Supprimer la question': 'حذف السؤال',
  'Supprimer la réponse': 'حذف الجواب', 'Supprimer le message': 'حذف الرسالة', 'Retirer le badge vérifié': 'سحب شارة التحقق', 'Supprimer l’entretien': 'حذف المقابلة',
  'Supprimer l’avis': 'حذف الرأي', 'Supprimer la rubrique': 'حذف القسم', 'Annuler le café': 'إلغاء اللقاء', 'Retirer la startup': 'سحب الشركة الناشئة', 'Annuler la relecture': 'إلغاء المراجعة',
  'Demande d’étudiant': 'طلب طالب', 'Voir la demande': 'عرض الطلب', '1 demande d’étudiant sans proposition depuis plus de 24 h': 'طلب طالب واحد دون اقتراح منذ أكثر من 24 ساعة',
  'Ouvrir': 'فتح', 'Voir le profil': 'عرض الملف', 'Voir la question': 'عرض السؤال', 'Historique': 'السجل', 'Traité': 'تمت معالجته', 'Sans suite': 'دون متابعة',
  'Contenu retiré et signalement clos.': 'حُذف المحتوى وأُغلق التبليغ.', 'Signalement classé sans suite.': 'حُفظ التبليغ دون متابعة.', 'Signalement marqué traité.': 'تم تحديد التبليغ كمُعالج.',
  'Le contenu sera retiré pour tout le monde. Continuer ?': 'سيُحذف المحتوى للجميع. هل تتابع؟',
  'Un membre anonyme': 'عضو مجهول', 'Auteur': 'الكاتب', 'Auteur :': 'الكاتب:', 'Signalé par': 'بلّغ عنه',
  // Membres
  'Vérifie que la personne est bien diplômée de l’ENSAM Meknès (promo, filière), puis valide. Le badge rassure les étudiants. Deux lauréats vérifiés de sa promo peuvent aussi le confirmer.': 'تحقق من أن الشخص خريج ENSAM مكناس (الدفعة، الشعبة)، ثم أكّد. الشارة تطمئن الطلبة. يمكن أيضًا لخريجَين متحقق منهما من دفعته تأكيد ذلك.',
  'Pas trouvé sur la liste officielle de sa promo': 'غير موجود في اللائحة الرسمية لدفعته', 'Sur la liste officielle': 'في اللائحة الرسمية', 'Aucune confirmation de sa promo': 'لا تأكيد من الدفعة',
  // Liste officielle
  'Importer la liste': 'استيراد اللائحة', 'Fichier Excel (.xlsx) ou CSV exporté de la scolarité : une ligne par étudiant, avec au moins le nom et la promo.': 'ملف Excel (.xlsx) أو CSV من مصلحة الشؤون الطلابية: سطر لكل طالب، مع الاسم والدفعة على الأقل.',
  'Les inscrits qui figurent sur la liste (même nom et même promo, ou même email) sont vérifiés automatiquement.': 'المسجلون الموجودون في اللائحة (نفس الاسم ونفس الدفعة، أو نفس البريد) يتم التحقق منهم تلقائيًا.',
  'La liste est effacée chaque 1er septembre, à la fin de l’année universitaire : importe celle de la nouvelle année à la rentrée.': 'تُمحى اللائحة كل فاتح شتنبر، عند نهاية السنة الجامعية: استورد لائحة السنة الجديدة عند الدخول الجامعي.',
  'Choisir un fichier': 'اختيار ملف', 'Modèle CSV': 'نموذج CSV', 'Colonnes': 'الأعمدة', 'Nom complet': 'الاسم الكامل', 'Nom de famille': 'الاسم العائلي', 'Prénom': 'الاسم الشخصي',
  'Email': 'البريد الإلكتروني', 'Promo': 'الدفعة', 'Filière': 'الشعبة', 'Matricule': 'رقم التسجيل', '(aucune)': '(لا شيء)',
  'Promo pour toutes les lignes': 'الدفعة لكل الأسطر', 'Si le fichier n’a pas de colonne promo (un fichier par promo).': 'إذا لم يكن في الملف عمود للدفعة (ملف لكل دفعة).',
  'Aperçu': 'معاينة', 'Remplacer la liste de ces promos': 'استبدال لائحة هذه الدفعات', 'Sinon, les lignes sont ajoutées ou mises à jour.': 'وإلا تُضاف الأسطر أو تُحدَّث.',
  'Importé.': 'تم الاستيراد.', 'Couverture': 'التغطية', 'Inscrits sur la plateforme, par promo et filière.': 'المسجلون في المنصة، حسب الدفعة والشعبة.',
  'Aucune liste importée pour l’instant.': 'لم تُستورد أي لائحة بعد.', 'Qui manque ?': 'من ينقص؟', 'Voir qui manque': 'عرض من ينقص',
  'Copier les emails': 'نسخ عناوين البريد', 'Exporter en CSV': 'تصدير CSV', 'Vider la liste de cette promo': 'إفراغ لائحة هذه الدفعة',
  'Emails copiés.': 'تم نسخ عناوين البريد.', 'Liste vidée.': 'أُفرغت اللائحة.', 'Tout le monde est inscrit, bravo !': 'الجميع مسجلون، أحسنتم!',
  'Le fichier est vide ou illisible.': 'الملف فارغ أو غير مقروء.', 'Ce fichier Excel est illisible. Enregistre-le en .xlsx ou en CSV.': 'ملف Excel هذا غير مقروء. احفظه بصيغة .xlsx أو CSV.',
  'Ce navigateur ne sait pas lire les fichiers Excel. Enregistre-le en CSV.': 'هذا المتصفح لا يقرأ ملفات Excel. احفظه بصيغة CSV.',
  '5000 lignes au plus : coupe le fichier par promo.': '5000 سطر على الأكثر: قسّم الملف حسب الدفعة.',
  'Les invitations aux absents passent par les ambassadeurs de promo : copie les emails ou exporte la liste.': 'دعوة الغائبين تمر عبر سفراء الدفعات: انسخ العناوين أو صدّر اللائحة.',
  'Choisis la colonne du nom.': 'اختر عمود الاسم.',
  // Réglages
  'Email de l’école': 'بريد المدرسة', 'Domaines de l’email de l’école': 'نطاقات بريد المدرسة', 'Séparés par des virgules, sans @. Ex. ensam-umi.ac.ma': 'مفصولة بفواصل، بدون @. مثال: ensam-umi.ac.ma',
  'Un compte créé avec une adresse de ces domaines est vérifié tout de suite, sans action de ta part.': 'الحساب المُنشأ بعنوان من هذه النطاقات يُتحقق منه فورًا، دون تدخل منك.',
  'Obliger les étudiants à s’inscrire avec l’email de l’école': 'إلزام الطلبة بالتسجيل ببريد المدرسة',
  'Un étudiant qui s’inscrit avec une autre adresse (Gmail…) ne peut pas créer son profil. Les lauréats gardent leur adresse personnelle.': 'الطالب الذي يسجل بعنوان آخر (Gmail…) لا يمكنه إنشاء ملفه. يحتفظ الخريجون بعناوينهم الشخصية.',
  'Ajoute d’abord au moins un domaine.': 'أضف أولًا نطاقًا واحدًا على الأقل.', 'Réglage enregistré.': 'تم حفظ الإعداد.',
  'Domaine invalide :': 'نطاق غير صالح:', 'Aucun domaine pour l’instant : tout le monde s’inscrit avec son adresse habituelle.': 'لا نطاق حاليًا: الجميع يسجل بعنوانه المعتاد.',
  '280 caractères au plus. Elle s’affiche sur une ligne, sur l’accueil des membres choisis, pendant 14 jours, et remplace l’annonce en cours pour eux.': '280 حرفًا على الأكثر. يظهر في سطر واحد في الصفحة الرئيسية للأعضاء المختارين لمدة 14 يومًا، ويحلّ محلّ الإعلان الحالي الموجّه إليهم.',
  'Annonce publiée sur l’accueil des étudiants.': 'نُشر الإعلان في الصفحة الرئيسية للطلبة.', 'Annonce publiée sur l’accueil des lauréats.': 'نُشر الإعلان في الصفحة الرئيسية للخريجين.',
  'Profil étudiant': 'ملف طالب', 'Profil lauréat': 'ملف خريج', 'Passer côté étudiants': 'النقل إلى فضاء الطلبة', 'Passer côté lauréats': 'النقل إلى فضاء الخريجين',
  'cette année, via la plateforme': 'هذه السنة، عبر المنصة', '1 étudiant attend un horaire depuis plus de 24 h': 'طالب واحد ينتظر توقيتًا منذ أكثر من 24 ساعة',
}, [
  [/^(\d+) étudiants attendent un horaire depuis plus de 24 h$/, n => `${arCount(n, ['طالب واحد ينتظر', 'طالبان ينتظران', 'طلبة ينتظرون', 'طالبًا ينتظرون'])} توقيتًا منذ أكثر من 24 ساعة`],
  [/^Pas encore de demande d’étudiant ce mois-ci · toutes aides : (\d+)\s?%$/, t => `لا طلبات من الطلبة بعد هذا الشهر · كل أنواع المساعدة: ${t}%`],
  [/^(\d+) filleuls? cette année · (\d+) lauréats? volontaires? · (\d+) étudiants? de 3A sans parrain\. Chaque matin, la plateforme attribue aussi les parrains toute seule\.$/, (a, b, c) => `${arCount(a, ['طالب واحد في الرعاية', 'طالبان في الرعاية', 'طلبة في الرعاية', 'طالبًا في الرعاية'])} هذه السنة · ${arCount(b, ['خريج متطوع', 'خريجان متطوعان', 'خريجين متطوعين', 'خريجًا متطوعًا'])} · ${arCount(c, ['طالب واحد', 'طالبان', 'طلبة', 'طالبًا'])} من السنة الثالثة دون عرّاب. كل صباح تعيّن المنصة العرّابين تلقائيًا أيضًا.`],
  [/^Jusqu’au (\d{1,2}) (\S+)$/, (j, m) => `إلى غاية ${j} ${m}`],
  [/^Signalé (\d+) fois$/, n => `بُلّغ عنه ${n} مرة`],
  [/^Personnes qui ont demandé un code sans l’entrer : (\d+) \(code pas reçu, ou visite interrompue\)\.$/, n => `عدد من طلبوا رمزًا دون إدخاله: ${n} (لم يصلهم الرمز، أو انقطعت الزيارة).`],
  [/^(\d+) demandes d’étudiants sans proposition depuis plus de 24 h$/, n => `${n} طلبات طلبة دون اقتراح منذ أكثر من 24 ساعة`],
  [/^(\d+) signalements? à traiter$/, n => `${n} تبليغ للمعالجة`],
  [/^(\d+) lauréats? à vérifier$/, n => `${n} خريج للتحقق`],
  [/^(\d+)\/2 lauréats de sa promo ont confirmé$/, n => `${n}/2 تأكيدات من خريجي الدفعة`],
  [/^Importer (\d+) lignes?$/, n => `استيراد ${n} سطر`],
  [/^(\d+) lignes? lisibles? sur (\d+)$/, (a, b) => `${a} سطر صالح من أصل ${b}`],
  [/^(\d+) importées?, (\d+) rejetées?, (\d+) comptes? vérifiés?$/, (a, b, c) => `${a} مستورد، ${b} مرفوض، ${c} حساب تم التحقق منه`],
  [/^(\d+) inscrits sur (\d+)$/, (a, b) => `${a} مسجل من أصل ${b}`],
  [/^Colonne (\d+)$/, n => `العمود ${n}`],
  [/^(\d+) personnes? pas encore inscrites?$/, n => `${n} شخص غير مسجل بعد`],
  [/^Vider la liste de la promo (\d{4}) \? Les comptes déjà vérifiés le restent\.$/, y => `إفراغ لائحة دفعة ${y}؟ تبقى الحسابات المتحقق منها كما هي.`],
]);

// Comptes (emails, dernière connexion), lus une fois pour toute la page
function useComptes(store, n) {
  const [comptes, setComptes] = useState(null);
  useEffect(() => { let on = true; Promise.resolve(store.adminComptes?.()).then(r => on && setComptes(r || []), () => on && setComptes([])); return () => { on = false; }; }, [n]);
  return comptes;
}

export function AdminPage(ctx) {
  const { data, store, me, sub, go } = ctx;
  const large = useLarge();
  const comptesTous = useComptes(store, data.profiles.length);
  // L'école regardée (seulement quand le réseau en compte au moins deux), gardée sur l'appareil pour cet admin
  const { ecoles, recharger: relireEcoles } = useEcoles(ctx);
  // La rubrique Écoles lit la table de son côté : en la quittant, la liste des écoles se relit (en ligne ; la démo suit déjà)
  const rubriqueAvant = useRef(sub);
  useEffect(() => { if (rubriqueAvant.current === 'ecoles' && sub !== 'ecoles') relireEcoles(); rubriqueAvant.current = sub; }, [sub]);
  const [choixEcole, setChoixEcole] = useLocal('ensam-admin-ecole:' + (me?.id || ''), '');
  const ecole = ecoles.length > 1 && ecoles.some(e => e.slug === choixEcole) ? choixEcole : '';
  const vue = donneesDeLEcole(data, ecole);
  const c = ecole ? { ...ctx, data: vue } : ctx;
  const ids = ecole ? new Set(vue.profiles.map(p => p.id)) : null;
  const comptes = ids && comptesTous ? comptesTous.filter(x => ids.has(x.id)) : comptesTous;
  const rubrique = RUBRIQUES.some(([k]) => k === sub) ? sub : '';
  const items = elementsATraiter(vue, comptes);
  const compte = {
    traiter: items.length,
    moderation: (vue.signalements || []).filter(s => s.status === 'ouvert').length,
    membres: vue.profiles.filter(p => p.role === 'laureat' && !p.verified).length,
  };
  const outils = html`<div class="cs-outils"><${ChoixEcole} ecoles=${ecoles} valeur=${ecole} onChange=${setChoixEcole}/><${RechercheConsole} ctx=${c} comptes=${comptes}/></div>`;
  return html`<section class="page admin">
    <${EnTetePage} surTitre=${ctx.saison ? `Année ${seasonLabel(ctx.saison)}` : null} titre="Administration" action=${large ? outils : null}>
      ${large ? null : html`${outils}<${PucesConsole} actif=${rubrique} compte=${compte} go=${go}/>`}
    <//>
    <div class="cs-corps">
      ${large ? html`<${MenuConsole} actif=${rubrique} compte=${compte} go=${go}/>` : null}
      <div class="cs-main">
        ${rubrique === '' ? html`<${TableauDeBord} ctx=${c} comptes=${comptes} items=${items}/>` : null}
        ${rubrique === 'traiter' ? html`<${ATraiter} ctx=${c} items=${items} comptes=${comptes}/>` : null}
        ${rubrique === 'animer' ? html`<${AnimerAdmin} ctx=${c}/>` : null}
        ${rubrique === 'agenda' ? html`<${AgendaAdmin} ctx=${c}/>` : null}
        ${rubrique === 'inviter' ? html`<${InvitationsAdmin} ctx=${c}/><${AmbassadeursAdmin} ctx=${c}/>` : null}
        ${rubrique === 'membres' ? html`<${Membres} ctx=${c} comptes=${comptes}/>` : null}
        ${rubrique === 'contenus' ? html`<${Contenus} ctx=${c}/>` : null}
        ${rubrique === 'moderation' ? html`<${Moderation} ctx=${c}/>` : null}
        ${rubrique === 'liste' ? html`<${ListeOfficielle} ctx=${c}/>` : null}
        ${rubrique === 'ecoles' ? html`<${EcolesAdmin} ctx=${c}/>` : null}
        ${rubrique === 'partenaires' ? html`<${PartenairesAdmin} ctx=${c}/>` : null}
        ${rubrique === 'sponsorises' ? html`<${SponsorisesAdmin} ctx=${c}/>` : null}
        ${rubrique === 'outils' ? html`<${OutilsAdmin} ctx=${c}/>` : null}
        ${rubrique === 'reglages' ? html`<${Reglages} ctx=${c}/>` : null}
      </div>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Tableau de bord : ce qui attend, l'objectif du plan, les chiffres de la semaine, puis l'animation (annonce, défis, parrains)
// ---------------------------------------------------------------------------
function TableauDeBord({ ctx, comptes, items }) {
  const { data, go } = ctx;
  return html`
    <${CalloutATraiter} items=${items} go=${go}/>
    <${ObjectifPlan} data=${data}/>
    <${KpisPilotage} ctx=${ctx} comptes=${comptes}/>
    <${OuSontLesMembres} ctx=${ctx}/>
    <div class="cs-deux"><${CeQuiSestPasse} ctx=${ctx}/><${CeuxQuiAident} ctx=${ctx}/></div>
    <${ParcoursInscription} p=${parcoursInscription(comptes, data)} sansSuite=${codesSansSuite(comptes, data.profiles)}/>
    <${AnnonceBox} ctx=${ctx}/>
    <${DefisAdmin} ctx=${ctx}/>
    <${ParrainsAdmin} ctx=${ctx}/>
  `;
}

// Où les inscriptions s'arrêtent : compte créé → profil rempli → première action
function ParcoursInscription({ p, sansSuite = 0 }) {
  if (!p.comptes) return null;
  const etapes = [
    ['Compte créé', p.comptes, 1, null],
    ['Profil rempli', p.profil, p.profil / p.comptes, `${pct(p.profil / p.comptes)} des comptes`],
    ['Première action', p.action, p.action / p.comptes, p.profil ? `${pct(p.action / p.profil)} des profils` : null],
  ];
  const avant = p.comptes - p.profil, apres = p.profil - p.action;
  const arret = !avant && !apres ? 'Personne ne s’arrête en route pour l’instant.'
    : avant >= apres ? `Le plus grand arrêt : avant le profil (${avant} compte${avant > 1 ? 's' : ''}).`
    : `Le plus grand arrêt : après le profil, avant la première action (${apres} membre${apres > 1 ? 's' : ''}).`;
  return html`<div class="panel" id="adm-parcours"><div class="section-head"><h2 class="h-ico"><${Icon} name="people"/> Inscriptions : où les gens s’arrêtent</h2></div>
    <ol class="parcours">${etapes.map(([l, n, v, sub]) => html`<li key=${l}><span class="parcours-l">${l}</span><${Bar} value=${v}/><span class="mono strong">${n}</span>${sub ? html`<span class="small muted">${sub}</span>` : html`<span></span>`}</li>`)}</ol>
    <p class="small"><strong>${arret}</strong> <span class="muted">Première action : publier, répondre, demander ou donner de l’aide, postuler, réagir. Un rappel par email part tout seul aux comptes restés sans profil 24 h après l’inscription.</span></p>
    ${sansSuite ? html`<p class="small muted" id="adm-codes">${`Personnes qui ont demandé un code sans l’entrer : ${sansSuite} (code pas reçu, ou visite interrompue).`}</p>` : null}
  </div>`;
}

// ---------------------------------------------------------------------------
// Modération : les signalements, regroupés par contenu
// ---------------------------------------------------------------------------
// Ce que l'administration voit du contenu signalé, et ce qu'elle peut en faire : admin-console-cibles.js (partagé avec « À traiter »)
export { MOTIFS };

function Moderation({ ctx }) {
  const { data } = ctx;
  const [hist, setHist] = useState(false);
  const all = data.signalements || [];
  const groupes = useMemo(() => {
    const m = new Map();
    for (const s of all.filter(x => x.status === 'ouvert')) { const k = s.cible_type + ':' + s.cible_id; if (!m.has(k)) m.set(k, []); m.get(k).push(s); }
    return [...m.values()].sort((a, b) => b.length - a.length || new Date(a[0].created_at) - new Date(b[0].created_at));
  }, [all]);
  const traites = all.filter(x => x.status !== 'ouvert').sort((a, b) => new Date(b.traite_at || b.created_at) - new Date(a.traite_at || a.created_at));
  return html`<div class="sub-page moderation">
    ${groupes.length ? html`<div class="list">${groupes.map(g => html`<${Signale} key=${g[0].cible_type + g[0].cible_id} ctx=${ctx} g=${g}/>`)}</div>`
      : html`<${Empty} icon="flag" title="Aucun signalement">Quand un membre signale un contenu, il apparaît ici. Tu décides de le retirer ou de le garder.<//>`}
    ${traites.length ? html`<button class="linkish small past-toggle" aria-expanded=${hist} onClick=${() => setHist(!hist)}>Historique <span class="count">${traites.length}</span></button>
      ${hist ? html`<ul class="people-list mod-hist">${traites.slice(0, 30).map(s => { const c = cible(ctx, s.cible_type, s.cible_id); const [tl, ti] = TYPES_CIBLE[s.cible_type] || ['', 'flag']; return html`<li key=${s.id}>
        <span class="mod-ico"><${Icon} name=${ti} size=${15}/></span>
        <span class="grow"><strong class="small">${tl}</strong>${c ? html` <span class="small muted" translate="no" dir="auto">${court(c.titre, 70)}</span>` : html` <span class="small muted">Contenu déjà supprimé</span>`}<br/>
          <span class="small muted">${MOTIFS[s.motif] || s.motif}</span> <span class="small muted">· ${timeAgo(s.traite_at || s.created_at)}</span></span>
        <span class=${'tag ' + (s.status === 'traite' ? 'coopt' : 'done')}>${s.status === 'traite' ? 'Traité' : 'Sans suite'}</span></li>`; })}</ul>` : null}` : null}
  </div>`;
}

function Signale({ ctx, g }) {
  const { store, act, confirm, openProfile } = ctx;
  const s0 = g[0]; const [tl, ti] = TYPES_CIBLE[s0.cible_type] || ['Contenu', 'flag'];
  const c = cible(ctx, s0.cible_type, s0.cible_id);
  const auteur = c?.auteur ? store.byId('profiles', c.auteur) : null;
  const motifs = {}; for (const s of g) motifs[s.motif] = (motifs[s.motif] || 0) + 1;
  const clore = status => Promise.all(g.map(s => store.update('signalements', s.id, { status })));
  const agir = ([label, run, danger]) => {
    const go = () => act(async () => { await run(); await clore('traite'); toast('Contenu retiré et signalement clos.'); });
    danger ? confirm('Le contenu sera retiré pour tout le monde. Continuer ?', go, label) : go();
  };
  return html`<article class="mod-card">
    <header class="mod-head"><span class="mod-ico"><${Icon} name=${ti} size=${17}/></span><strong>${tl}</strong>
      ${Object.entries(motifs).map(([m, n]) => html`<span class="tag urgent">${MOTIFS[m] || m}${n > 1 ? ` ×${n}` : ''}</span>`)}
      <span class="spacer"></span><span class="small muted">${g.length > 1 ? `Signalé ${g.length} fois` : timeAgo(s0.created_at)}</span></header>
    ${c ? html`<div class="mod-cible">
      ${c.photo ? html`<${Avatar} p=${c.photo} size=${72}/>` : null}
      ${c.titre ? html`<strong class="mod-titre" translate="no" dir="auto">${court(c.titre, 120)}</strong>` : null}
      ${c.texte ? html`<p class="mod-texte" translate="no" dir="auto">${court(c.texte)}</p>` : null}
      ${auteur ? html`<span class="small muted">Auteur : <button class="linkish" onClick=${() => openProfile(auteur)} translate="no">${auteur.full_name}</button></span>` : c.auteur === null && s0.cible_type !== 'profil' ? html`<span class="small muted">Un membre anonyme</span>` : null}
      ${c.voir ? html`<button type="button" class="linkish small mod-voir" onClick=${c.voir[1]}><${Icon} name="eye" size=${15}/> ${c.voir[0]}</button>` : null}
    </div>` : html`<p class="small muted mod-cible">Contenu déjà supprimé</p>`}
    <ul class="mod-reports">${g.map(s => { const a = store.byId('profiles', s.auteur_id); return html`<li class="small"><span class="muted">Signalé par</span> ${a ? html`<button class="linkish" onClick=${() => openProfile(a)} translate="no">${a.full_name}</button>` : '?'} · <span class="muted">${MOTIFS[s.motif] || s.motif}</span>${s.details ? html`<span class="mod-details" translate="no" dir="auto">« ${s.details} »</span>` : null}</li>`; })}</ul>
    <div class="mod-act">
      ${c?.actions.length ? html`<span class="mod-decider">${c.actions.map(a => html`<button class=${'btn small tonal' + (a[2] ? ' danger' : '')} onClick=${() => agir(a)}>${a[0]}</button>`)}</span>` : null}
      <span class="mod-clore">
        ${c ? html`<button class="btn small ghost" onClick=${() => act(async () => { await clore('traite'); toast('Signalement marqué traité.'); })}>Marquer traité</button>`
          : html`<button class="btn small tonal" onClick=${() => act(async () => { await clore('traite'); toast('Signalement marqué traité.'); })}>Clore</button>`}
        <button class="btn small ghost" onClick=${() => act(async () => { await clore('rejete'); toast('Signalement classé sans suite.'); })}>Classer sans suite</button>
      </span>
    </div>
  </article>`;
}

// ---------------------------------------------------------------------------
// Membres : lauréats à vérifier, puis tous les membres
// ---------------------------------------------------------------------------
// Liste officielle (noms, promos, emails) : en démo dans les données, en ligne lue par l'administration seule
function useListe(store, data) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (Array.isArray(data.liste_officielle)) return;
    let on = true;
    Promise.resolve(store.sb?.from('liste_officielle').select('nom, promo, email').limit(10000)).then(r => on && setRows(r?.data || []), () => on && setRows([]));
    return () => { on = false; };
  }, []);
  return Array.isArray(data.liste_officielle) ? data.liste_officielle : rows || [];
}

// Membres : profils à revoir, erreurs de lecture des CV, lauréats à vérifier, puis le tableau de tous les membres
// (admin-console-membres.js : filtres, tri, sélection, emails, CSV ; sur téléphone, la liste habituelle)
function Membres({ ctx, comptes }) {
  const { data, store, act, openProfile } = ctx;
  const toVerify = data.profiles.filter(p => p.role === 'laureat' && !p.verified);
  const liste = useListe(store, data);
  const compte = new Map((comptes || []).map(c => [c.id, c]));
  const members = data.profiles.filter(p => p.role !== 'admin');
  const promosListe = new Set(liste.map(l => l.promo));
  const surListe = p => { const e = (compte.get(p.id)?.email || '').toLowerCase(); return liste.some(l => (l.promo === p.promo && cleNom(l.nom) === cleNom(p.full_name)) || (l.email && e && l.email === e)); };
  const pairs = p => (data.verifications_pairs || []).filter(v => v.laureat_id === p.id).map(v => store.byId('profiles', v.verificateur_id)).filter(x => x?.role === 'laureat' && x.verified && x.promo === p.promo);

  return html`
    <${ProfilsARevoir} ctx=${ctx} members=${members}/>
    <${LecturesSignalees} ctx=${ctx}/>
    ${toVerify.length ? html`<div class="panel accent-panel"><div class="section-head"><h2 class="h-ico"><${Icon} name="shield"/> Lauréats à vérifier <span class="count">${toVerify.length}</span></h2></div>
      <p class="muted small">Vérifie que la personne est bien diplômée de l’ENSAM Meknès (promo, filière), puis valide. Le badge rassure les étudiants. Deux lauréats vérifiés de sa promo peuvent aussi le confirmer.</p>
      <ul class="people-list verif-list">${toVerify.map(p => { const pr = pairs(p); return html`<li key=${p.id}><div class="verif-who"><${Person} p=${p} onOpen=${openProfile} sub=${`${p.filiere} · Promo ${p.promo}${p.entreprise ? ' · ' + p.entreprise : ''}`}/>
        <span class="verif-facts small">
          ${compte.get(p.id) ? html`<span class="mono muted" dir="ltr" translate="no">${compte.get(p.id).email}</span>` : null}
          <span class=${pr.length ? 'good-t' : 'muted'}><${Icon} name="people" size=${13}/> ${pr.length ? `${pr.length}/2 lauréats de sa promo ont confirmé` : 'Aucune confirmation de sa promo'}${pr.length ? html` <span translate="no">(${pr.map(x => x.full_name).join(', ')})</span>` : null}</span>
          ${promosListe.has(p.promo) ? html`<span class=${surListe(p) ? 'good-t' : 'warn-t'}><${Icon} name="file" size=${13}/> ${surListe(p) ? 'Sur la liste officielle' : 'Pas trouvé sur la liste officielle de sa promo'}</span>` : null}
          <span class=${p.cv_path || p.cv_url ? 'good-t' : 'muted'}><${Icon} name="file" size=${13}/> ${p.cv_path || p.cv_url ? 'CV déposé' : 'Pas de CV déposé'}</span>
          ${p.linkedin ? html`<span><${Icon} name="link" size=${13}/> <a href=${p.linkedin.startsWith('http') ? p.linkedin : 'https://' + p.linkedin} target="_blank" rel="noopener">Son profil LinkedIn</a></span>` : html`<span class="muted"><${Icon} name="link" size=${13}/> Pas de LinkedIn</span>`}
        </span>
        <span class="verif-acts"><${CvButton} ctx=${ctx} p=${p} small/>
          ${!p.cv_path && !p.cv_url ? html`<${MessageBtn} ctx=${ctx} p=${p} cls="btn tiny ghost" label="Demander son CV" texte=${demandeCV(p)}/>` : null}</span></div>
        <button class="btn small tonal" onClick=${() => act(async () => { await store.update('profiles', p.id, { verified: true }); toast('Lauréat vérifié.'); })}><${Icon} name="shield" size=${15}/> Vérifier</button></li>`; })}</ul></div>` : null}

    <${TableMembres} ctx=${ctx} comptes=${comptes}/>`;
}

// Profils à revoir : rôle et promo qui ne vont pas ensemble (ex. « lauréat » de la promo 2027), et profils que leur CV
// contredit. L'administration lit les CV déposés depuis son navigateur, puis corrige en un clic.
function ProfilsARevoir({ ctx, members }) {
  const { store, act, openProfile, saison } = ctx;
  const [lecture, setLecture] = useState(null);
  const [cvs, setCvs] = useState(null);
  const [signaler, setSignaler] = useState(null);
  const an = new Date().getFullYear();
  const incoherents = members.filter(p => (p.role === 'laureat' && p.promo > an) || (p.role === 'etudiant' && p.promo <= saison));
  const avecCV = members.filter(p => p.cv_path);
  if (!incoherents.length && !avecCV.length) return null;
  const lireTous = async () => {
    const out = []; let illisibles = 0; setLecture({ fait: 0, total: avecCV.length });
    for (const [i, p] of avecCV.entries()) {
      try {
        const { cv, texte } = await lireCVDe(store, p.cv_path);
        if (!Object.keys(cv).length) illisibles++;
        // Une lecture déjà signalée comme fausse n'est plus proposée
        const e = propositionCV(p, cv); if (Object.keys(e).length && !dejaSignalee(store.data.retours_cv, p.id, p.cv_path, e)) out.push({ p, e, texte });
      } catch { illisibles++; }
      setLecture({ fait: i + 1, total: avecCV.length });
    }
    setCvs(Object.assign(out, { illisibles })); setLecture(null);
  };
  const retirer = ids => setCvs(l => l && Object.assign(l.filter(x => !ids.includes(x.p.id)), { illisibles: l.illisibles }));
  const corriger = (p, patch, msg) => act(async () => { await store.update('profiles', p.id, patch); retirer([p.id]); toast(msg); });
  // Tous les profils d'après leur CV, en une fois (corrections et champs vides), après un dernier coup d'œil
  const toutAppliquer = () => ctx.confirm(`Mettre à jour ${cvs.length} profils d’après leur CV ? Vérifie chaque ligne avant : si une lecture est fausse, signale-la au lieu de l’appliquer.`, () => act(async () => {
    const faits = [];
    for (const { p, e } of cvs) { await store.update('profiles', p.id, e); faits.push(p.id); }
    retirer(faits); toast(faits.length > 1 ? `${faits.length} profils mis à jour d’après leur CV.` : 'Profil mis à jour d’après son CV.');
  }), 'Tout mettre à jour');
  const lignes = [...incoherents.filter(p => !cvs?.some(x => x.p.id === p.id)).map(p => ({ p, e: p.role === 'laureat' ? { role: 'etudiant' } : { role: 'laureat' }, cv: false })), ...(cvs || []).map(x => ({ ...x, cv: true }))];
  const ligneSignalee = signaler && cvs?.find(x => x.p.id === signaler);
  return html`<div class="panel"><div class="section-head"><h2 class="h-ico"><${Icon} name="user"/> Profils à revoir ${lignes.length ? html`<span class="count">${lignes.length}</span>` : null}</h2>
      ${avecCV.length ? html`<button class="btn small" id="adm-lire-cv" disabled=${!!lecture} onClick=${lireTous}><${Icon} name="file" size=${15}/> ${lecture ? `CV lus : ${lecture.fait}/${lecture.total}` : `Lire les CV déposés (${avecCV.length})`}</button>` : null}</div>
    <p class="muted small">Rôle ou promo qui ne vont pas ensemble, et ce que le CV de chacun corrige ou complète. Le membre voit aussi la proposition sur son profil.</p>
    ${cvs?.length > 1 ? html`<div class="row"><button class="btn small primary" id="adm-cv-tout" onClick=${toutAppliquer}><${Icon} name="check" size=${15}/> Tout mettre à jour d’après les CV (${cvs.length})</button></div>` : null}
    ${lignes.length ? html`<ul class="people-list revoir-list">${lignes.map(({ p, e, cv }) => html`<li key=${p.id}>
      <${Person} p=${p} onOpen=${openProfile} sub=${`${p.role === 'laureat' ? 'Profil lauréat' : 'Profil étudiant'} · Promo ${p.promo} · ${p.filiere}`}/>
      <span class="small revoir-quoi">${cv ? html`<span>${corrigeProfil(e) ? 'Son CV indique :' : 'Son CV complète :'}</span> ${libellesCV(e).map((x, i) => html`${i ? ' · ' : ''}<b>${x}</b>`)}` : p.role === 'laureat' ? `Promo ${p.promo} pas encore diplômée` : `Promo ${p.promo} déjà diplômée`}</span>
      <span class="spacer"></span>
      ${cv ? html`<button class="icon-btn small" aria-label="Signaler une erreur de lecture" title="C’est mal lu : signaler" onClick=${() => setSignaler(p.id)}><${Icon} name="flag" size=${15}/></button>` : null}
      <button class="btn small" onClick=${() => corriger(p, e, 'Profil corrigé.')}>${cv ? 'Appliquer' : e.role === 'etudiant' ? 'Passer côté étudiants' : 'Passer côté lauréats'}</button>
    </li>`)}</ul>` : cvs && cvs.illisibles < avecCV.length ? html`<p class="small good-t"><${Icon} name="check" size=${14}/> Les CV lus confirment les profils.</p>` : null}
    ${ligneSignalee ? html`<${SignalerLecture} ctx=${ctx} profil=${ligneSignalee.p} prop=${ligneSignalee.e} texte=${ligneSignalee.texte} path=${ligneSignalee.p.cv_path} onClose=${() => setSignaler(null)} onDone=${() => retirer([ligneSignalee.p.id])}/>` : null}
    ${cvs?.illisibles ? html`<p class="small muted" id="adm-cv-illisibles">${cvs.illisibles === 1 ? '1 CV sans texte lisible (scan en image ?) : à vérifier à la main.' : `${cvs.illisibles} CV sans texte lisible (scans en image ?) : à vérifier à la main.`}</p>` : null}
  </div>`;
}
injectCSS('revoir', `.revoir-list li { flex-wrap: wrap; } .revoir-quoi b { font-weight: 650; }`);

// Erreurs de lecture des CV signalées : l'administration les copie pour Claude (sans nom ni coordonnées),
// qui corrige la lecture et ajoute un test pour chacune ; puis elle les classe
function LecturesSignalees({ ctx }) {
  const { data, store, act, openProfile } = ctx;
  const tous = data.retours_cv || [];
  const ouverts = tous.filter(r => r.status === 'ouvert');
  if (!tous.length) return null;
  const profil = id => store.byId('profiles', id);
  const qui = p => (p ? `${p.role === 'laureat' ? 'Profil lauréat' : 'Profil étudiant'} · Promo ${p.promo} · ${p.filiere}` : 'Profil supprimé');
  const copier = async () => {
    const txt = [`Erreurs de lecture des CV · Réseau ENSAM (${ouverts.length})`, ...ouverts.map((r, i) => [
      '', `${i + 1}. Profil : ${qui(profil(r.profil_id))}`, `Lu dans le CV : ${libellesCV(r.proposition || {}).join(' · ') || '?'}`, `Juste : ${r.juste || '(non précisé)'}`,
      'Lignes lues :', ...(r.extrait || '(aucune)').split('\n').map(l => '  | ' + l)].join('\n'))].join('\n');
    try { await navigator.clipboard.writeText(txt); toast('Copié : colle-le à Claude dans le fil du projet.'); } catch { toast('Copie impossible ici.', 'err'); }
  };
  const classer = r => act(async () => { await store.update('retours_cv', r.id, { status: 'corrige' }); toast('Classée.'); });
  return html`<div class="panel" id="adm-lectures"><div class="section-head"><h2 class="h-ico"><${Icon} name="flag"/> Erreurs de lecture des CV ${ouverts.length ? html`<span class="count">${ouverts.length}</span>` : null}</h2>
      ${ouverts.length ? html`<button class="btn small primary" id="adm-cv-copier" onClick=${copier}><${Icon} name="copy" size=${15}/> Copier pour Claude</button>` : null}</div>
    <p class="muted small">Chaque erreur signalée sert à corriger la lecture pour tous. Copie-les et colle-les à Claude : il corrige et ajoute un test, puis tu les classes.</p>
    ${ouverts.length ? html`<ul class="people-list revoir-list">${ouverts.map(r => { const p = profil(r.profil_id); return html`<li key=${r.id}>
      ${p ? html`<${Person} p=${p} onOpen=${openProfile} sub=${`${qui(p)} · ${timeAgo(r.created_at)}`}/>` : html`<span class="muted">Profil supprimé</span>`}
      <span class="small revoir-quoi"><span>Lu :</span> <b>${libellesCV(r.proposition || {}).join(' · ')}</b>${r.juste ? html` · <span>Juste :</span> <b dir="auto">${r.juste}</b>` : null}</span>
      <span class="spacer"></span>
      <button class="btn small ghost" onClick=${() => classer(r)}>Classer</button>
    </li>`; })}</ul>` : html`<p class="small good-t"><${Icon} name="check" size=${14}/> Toutes les erreurs signalées sont classées (${tous.length}).</p>`}
  </div>`;
}

// ---------------------------------------------------------------------------
// Liste officielle : import Excel ou CSV, couverture, absents
// ---------------------------------------------------------------------------
async function lireTexte(file) {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-1252').decode(buf); }
}

export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const n = c => first.split(c).length - 1;
  const sep = [';', ',', '\t'].reduce((a, c) => (n(c) > n(a) ? c : a), ';');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"' && !cell.trim()) { q = true; cell = ''; }
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(c => c.trim())).filter(r => r.some(Boolean));
}

// Fichier .xlsx : une archive zip ; on lit les textes partagés et la première feuille, sans bibliothèque
export async function parseXLSX(buf) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Ce navigateur ne sait pas lire les fichiers Excel. Enregistre-le en CSV.');
  const dv = new DataView(buf); const u8 = new Uint8Array(buf); const dec = new TextDecoder();
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65558); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Ce fichier Excel est illisible. Enregistre-le en .xlsx ou en CSV.');
  const files = {}; let off = dv.getUint32(eocd + 16, true);
  for (let k = dv.getUint16(eocd + 10, true); k > 0; k--) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), local = dv.getUint32(off + 42, true);
    files[dec.decode(u8.subarray(off + 46, off + 46 + nl))] = { method, csize, local };
    off += 46 + nl + el + cl;
  }
  const read = async name => {
    const f = files[name]; if (!f) return null;
    const start = f.local + 30 + dv.getUint16(f.local + 26, true) + dv.getUint16(f.local + 28, true);
    const raw = u8.subarray(start, start + f.csize);
    if (f.method === 0) return dec.decode(raw);
    if (f.method !== 8) throw new Error('Ce fichier Excel est illisible. Enregistre-le en .xlsx ou en CSV.');
    return dec.decode(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  };
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const tags = (node, name) => [...node.getElementsByTagName(name)];
  // Première feuille du classeur (ordre du classeur), sinon la première trouvée
  let sheet = null;
  try {
    const wb = xml(await read('xl/workbook.xml')); const rels = xml(await read('xl/_rels/workbook.xml.rels'));
    const rid = tags(wb, 'sheet')[0]?.getAttribute('r:id');
    const target = tags(rels, 'Relationship').find(r => r.getAttribute('Id') === rid)?.getAttribute('Target');
    if (target) sheet = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
  } catch { /* classeur sans relations lisibles */ }
  if (!sheet || !files[sheet]) sheet = Object.keys(files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)))[0];
  if (!sheet) throw new Error('Ce fichier Excel est illisible. Enregistre-le en .xlsx ou en CSV.');
  const ssTxt = await read('xl/sharedStrings.xml');
  const shared = ssTxt ? tags(xml(ssTxt), 'si').map(si => tags(si, 't').filter(t => t.parentNode.nodeName !== 'rPh').map(t => t.textContent).join('')) : [];
  const col = ref => { let n = 0; for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const rows = [];
  for (const r of tags(xml(await read(sheet)), 'row')) {
    const out = [];
    for (const c of tags(r, 'c')) {
      const t = c.getAttribute('t'); const v = tags(c, 'v')[0]?.textContent ?? '';
      let val = t === 's' ? shared[+v] ?? '' : t === 'inlineStr' ? tags(c, 't').map(x => x.textContent).join('') : v;
      if (!t && /^\d+\.0+$/.test(val)) val = val.replace(/\.0+$/, '');
      out[c.getAttribute('r') ? col(c.getAttribute('r')) : out.length] = String(val).trim();
    }
    rows.push(Array.from(out, x => x ?? ''));
  }
  return rows.filter(r => r.some(Boolean));
}

const CHAMPS = [['complet', 'Nom complet'], ['nom', 'Nom de famille'], ['prenom', 'Prénom'], ['email', 'Email'], ['promo', 'Promo'], ['filiere', 'Filière'], ['matricule', 'Matricule']];
const DETECT = {
  complet: /(nom (et |& )?prenom|prenom (et |& )?nom|nom complet|full ?name|etudiant|laureat|identite)/,
  nom: /^(nom|nom de famille|last ?name|surname|family ?name)$/,
  prenom: /^(prenoms?|first ?name|given ?name)$/,
  email: /(e-?mail|courriel|mail)/,
  promo: /(promo|annee|diplom|graduation|year)/,
  filiere: /(filiere|specialite|option|departement|branche|parcours)/,
  matricule: /(matricule|cne|apogee|code|numero|^n°|^id$)/,
};
const annee = v => { const m = String(v || '').match(/\b(19|20)\d{2}\b/); return m ? +m[0] : null; };

// En-têtes reconnus, ou devinés d'après le contenu si le fichier n'en a pas
function detecter(rows) {
  const h = (rows[0] || []).map(x => norm(x).trim());
  const aEntete = h.some(x => Object.values(DETECT).some(re => re.test(x))) && !rows[0].some(x => /@/.test(x) || /^(19|20)\d{2}$/.test(x));
  const map = Object.fromEntries(CHAMPS.map(([k]) => [k, -1]));
  const width = Math.max(...rows.slice(0, 50).map(r => r.length));
  if (aEntete) {
    for (const [k] of CHAMPS) map[k] = h.findIndex((x, i) => DETECT[k].test(x) && !Object.values(map).includes(i));
    if (map.complet >= 0 && map.nom >= 0) map.complet = -1;
  } else {
    const sample = rows.slice(0, 20);
    for (let i = 0; i < width; i++) {
      const vals = sample.map(r => r[i] || '');
      if (map.email < 0 && vals.some(v => /@/.test(v))) map.email = i;
      else if (map.promo < 0 && vals.filter(v => /^(19|20)\d{2}$/.test(v)).length >= sample.length / 2) map.promo = i;
      else if (map.complet < 0 && vals.filter(v => /[A-Za-zÀ-ÿ]{2}/.test(v) && !/@/.test(v)).length >= sample.length / 2) map.complet = i;
    }
  }
  return { aEntete, map, entetes: aEntete ? rows[0] : Array.from({ length: width }, (_, i) => `Colonne ${i + 1}`) };
}

function lignesDe(rows, aEntete, map, promoDefaut) {
  const cell = (r, k) => (map[k] >= 0 ? String(r[map[k]] || '').trim() : '');
  return rows.slice(aEntete ? 1 : 0).map(r => ({
    nom: (map.complet >= 0 ? cell(r, 'complet') : [cell(r, 'nom'), cell(r, 'prenom')].filter(Boolean).join(' ')).replace(/\s+/g, ' '),
    email: cell(r, 'email').toLowerCase() || null,
    promo: annee(cell(r, 'promo')) || (annee(promoDefaut) ?? null),
    filiere: cell(r, 'filiere') || null,
    matricule: cell(r, 'matricule') || null,
  }));
}
const valide = l => l.nom.length >= 2 && !!cleNom(l.nom) && l.promo >= 1990 && l.promo <= 2040;

function ListeOfficielle({ ctx }) {
  const { store, act, confirm, data } = ctx;
  const [fichier, setFichier] = useState(null); // { nom, rows, aEntete, entetes }
  const [map, setMap] = useState(null);
  const [promoDefaut, setPromoDefaut] = useState('');
  const [remplacer, setRemplacer] = useState(false);
  const [res, setRes] = useState(null);
  const [version, setVersion] = useState(0);
  const [couv, setCouv] = useState(null);
  const [promo, setPromo] = useState('');
  const [manquants, setManquants] = useState(null);
  const [erreur, setErreur] = useState(null);
  useEffect(() => { let on = true; store.couvertureListe().then(r => on && setCouv(r || []), () => on && setCouv([])); return () => { on = false; }; }, [version, data.profiles.length]);

  const charger = async e => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    setErreur(null); setRes(null);
    try {
      const rows = /\.xlsx$/i.test(f.name) ? await parseXLSX(await f.arrayBuffer()) : parseCSV(await lireTexte(f));
      if (!rows.length) throw new Error('Le fichier est vide ou illisible.');
      const d = detecter(rows);
      setFichier({ nom: f.name, rows, aEntete: d.aEntete, entetes: d.entetes }); setMap(d.map);
    } catch (err) { setFichier(null); setErreur(err.message || 'Le fichier est vide ou illisible.'); }
  };
  const lignes = fichier ? lignesDe(fichier.rows, fichier.aEntete, map, promoDefaut) : [];
  const bonnes = lignes.filter(valide);
  const sansNom = fichier && map.complet < 0 && map.nom < 0 && map.prenom < 0;
  const importer = () => act(async () => {
    if (bonnes.length > 5000) throw new Error('5000 lignes au plus : coupe le fichier par promo.');
    const r = await store.importerListe(bonnes, remplacer);
    setRes({ ...r, rejetes: (r.rejetes || 0) + (lignes.length - bonnes.length) }); setFichier(null); setVersion(v => v + 1); setManquants(null);
    toast('Importé.', 'win');
  });
  const promos = [...new Set((couv || []).map(c => c.promo))].sort((a, b) => b - a);
  const parPromo = promos.map(p => { const rows = couv.filter(c => c.promo === p); return { promo: p, rows, total: rows.reduce((a, c) => a + c.total, 0), inscrits: rows.reduce((a, c) => a + c.inscrits, 0) }; });
  const voir = () => act(async () => setManquants({ promo, rows: await store.manquantsListe(promo) }));

  return html`<div class="sub-page liste">
    <div class="panel">
      <div class="section-head"><h2 class="h-ico"><${Icon} name="upload"/> Importer la liste</h2>
        <button class="btn tiny ghost" onClick=${() => telecharger('modele-liste-officielle.csv', [['nom', 'prenom', 'email', 'promo', 'filiere', 'matricule'], ['EL AMRANI', 'Salma', 'salma.elamrani@exemple.ma', new Date().getFullYear() + 1, 'Génie Industriel', 'M0001']])}><${Icon} name="download" size=${14}/> Modèle CSV</button></div>
      <p class="small muted">Fichier Excel (.xlsx) ou CSV exporté de la scolarité : une ligne par étudiant, avec au moins le nom et la promo.</p>
      <p class="small muted">Les inscrits qui figurent sur la liste (même nom et même promo, ou même email) sont vérifiés automatiquement.</p>
      <p class="small muted">La liste est effacée chaque 1er septembre, à la fin de l’année universitaire : importe celle de la nouvelle année à la rentrée.</p>
      <label class="btn small file-btn"><${Icon} name="file" size=${15}/> Choisir un fichier<input id="lo-file" type="file" accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange=${charger}/></label>
      ${erreur ? html`<p class="auth-msg err" role="alert">${erreur}</p>` : null}
      ${res ? html`<p class="hint-box good-box small" role="status"><${Icon} name="check" size=${15}/> <span>${`${res.importes} importée${res.importes > 1 ? 's' : ''}, ${res.rejetes} rejetée${res.rejetes > 1 ? 's' : ''}, ${res.verifies} compte${res.verifies > 1 ? 's' : ''} vérifié${res.verifies > 1 ? 's' : ''}`}</span></p>` : null}
      ${fichier ? html`<div class="lo-import">
        <p class="small"><strong translate="no">${fichier.nom}</strong> · <span class="muted">${`${bonnes.length} ligne${bonnes.length > 1 ? 's' : ''} lisible${bonnes.length > 1 ? 's' : ''} sur ${lignes.length}`}</span></p>
        <div class="lo-map"><span class="field-label">Colonnes</span><div class="grid3">${CHAMPS.map(([k, l]) => html`<${Field} label=${l}><select id=${'lo-' + k} value=${map[k]} onChange=${e => setMap({ ...map, [k]: +e.target.value })}><option value="-1">(aucune)</option>${fichier.entetes.map((h, i) => h ? html`<option value=${i} translate="no">${h}</option>` : html`<option value=${i}>${`Colonne ${i + 1}`}</option>`)}</select><//>`)}</div></div>
        ${map.promo < 0 ? html`<${Field} label="Promo pour toutes les lignes" hint="Si le fichier n’a pas de colonne promo (un fichier par promo)."><input id="lo-promo" type="number" min="1990" max="2040" value=${promoDefaut} onInput=${e => setPromoDefaut(e.target.value)} placeholder=${String(new Date().getFullYear() + 1)}/><//>` : null}
        ${sansNom ? html`<p class="small warn-t">Choisis la colonne du nom.</p>` : null}
        <div class="lo-preview"><span class="field-label">Aperçu</span>
          <table class="lo-table"><thead><tr><th>Nom</th><th>Email</th><th>Promo</th><th>Filière</th></tr></thead>
            <tbody>${lignes.slice(0, 5).map(l => html`<tr class=${valide(l) ? '' : 'bad'}><td translate="no" dir="auto">${l.nom || '—'}</td><td class="mono" dir="ltr" translate="no">${l.email || '—'}</td><td class="mono">${l.promo || '—'}</td><td translate="no">${l.filiere || '—'}</td></tr>`)}</tbody></table></div>
        <label class="check small"><input id="lo-remplacer" type="checkbox" checked=${remplacer} onChange=${e => setRemplacer(e.target.checked)}/> <span>Remplacer la liste de ces promos <span class="muted">Sinon, les lignes sont ajoutées ou mises à jour.</span></span></label>
        <div class="row-end"><button class="btn ghost" onClick=${() => setFichier(null)}>Annuler</button><button class="btn primary" id="lo-go" disabled=${!bonnes.length} onClick=${importer}>${`Importer ${bonnes.length} ligne${bonnes.length > 1 ? 's' : ''}`}</button></div>
      </div>` : null}
    </div>

    <div class="panel">
      <div class="section-head"><h2 class="h-ico"><${Icon} name="chart"/> Couverture</h2></div>
      <p class="small muted">Inscrits sur la plateforme, par promo et filière.</p>
      ${couv === null ? null : !parPromo.length ? html`<p class="small muted">Aucune liste importée pour l’instant.</p>` : html`<div class="lo-couv">${parPromo.map(g => html`<div class="lo-promo">
        <div class="row"><strong>${`Promo ${g.promo}`}</strong><span class="mono small muted">${g.inscrits}/${g.total}</span><span class="spacer"></span><strong class="mono small">${pct(g.total ? g.inscrits / g.total : 0)}</strong></div>
        <${Bar} value=${g.total ? g.inscrits / g.total : 0}/>
        <ul class="lo-fil">${g.rows.map(c => html`<li class="small"><span class="grow" translate="no">${c.filiere || '—'}</span><span class="mono muted">${c.inscrits}/${c.total}</span><span class="lo-mini"><${Bar} value=${c.total ? c.inscrits / c.total : 0}/></span></li>`)}</ul>
      </div>`)}</div>`}
    </div>

    ${promos.length ? html`<div class="panel">
      <div class="section-head"><h2 class="h-ico"><${Icon} name="search"/> Qui manque ?</h2></div>
      <p class="small muted">Les invitations aux absents passent par les ambassadeurs de promo : copie les emails ou exporte la liste.</p>
      <div class="row"><select id="lo-manq-promo" aria-label="Promo" value=${promo} onChange=${e => { setPromo(e.target.value); setManquants(null); }}><option value="">Promo</option>${promos.map(p => html`<option value=${p}>${p}</option>`)}</select>
        <button class="btn small" id="lo-manq" disabled=${!promo} onClick=${voir}>Voir qui manque</button>
        <span class="spacer"></span>
        ${promo ? html`<button class="btn tiny ghost danger-t" onClick=${() => confirm(`Vider la liste de la promo ${promo} ? Les comptes déjà vérifiés le restent.`, () => act(async () => { await store.viderListe(promo); setManquants(null); setVersion(v => v + 1); toast('Liste vidée.'); }), 'Vider la liste de cette promo')}>Vider la liste de cette promo</button>` : null}</div>
      ${manquants ? manquants.rows.length ? html`<div class="lo-manquants">
        <div class="row"><span class="small"><strong>${`${manquants.rows.length} personne${manquants.rows.length > 1 ? 's' : ''} pas encore inscrite${manquants.rows.length > 1 ? 's' : ''}`}</strong></span><span class="spacer"></span>
          ${manquants.rows.some(r => r.email) ? html`<button class="btn tiny ghost" onClick=${() => act(async () => { await navigator.clipboard.writeText(manquants.rows.map(r => r.email).filter(Boolean).join(', ')); toast('Emails copiés.'); })}><${Icon} name="copy" size=${14}/> Copier les emails</button>` : null}
          <button class="btn tiny ghost" onClick=${() => telecharger(`manquants-promo-${manquants.promo}.csv`, [['nom', 'email', 'filiere'], ...manquants.rows.map(r => [r.nom, r.email || '', r.filiere || ''])])}><${Icon} name="download" size=${14}/> Exporter en CSV</button></div>
        <ul class="lo-list">${manquants.rows.slice(0, 200).map(r => html`<li class="small"><span translate="no" dir="auto">${r.nom}</span><span class="muted" translate="no">${r.filiere || ''}</span><span class="mono muted" dir="ltr" translate="no">${r.email || ''}</span></li>`)}</ul>
      </div>` : html`<p class="small good-t">Tout le monde est inscrit, bravo !</p>` : null}
    </div>` : null}
  </div>`;
}

// ---------------------------------------------------------------------------
// Réglages : email de l'école
// ---------------------------------------------------------------------------
function Reglages({ ctx }) {
  const { store, act } = ctx;
  const domaines = store.domainesEcole();
  const oblig = store.reglages?.email_ecole_obligatoire === true;
  const [txt, setTxt] = useState(domaines.join(', '));
  const liste = txt.split(/[,;\s]+/).map(d => d.trim().toLowerCase().replace(/^@+/, '')).filter(Boolean);
  const mauvais = liste.filter(d => !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(d));
  const change = liste.join(',') !== domaines.join(',');
  const save = e => { e.preventDefault(); if (mauvais.length) return; act(async () => { await store.enregistrerReglage('domaines_ecole', [...new Set(liste)]); setTxt([...new Set(liste)].join(', ')); if (!liste.length && oblig) await store.enregistrerReglage('email_ecole_obligatoire', false); toast('Réglage enregistré.'); }); };
  return html`<div class="sub-page">
    <form class="panel form" onSubmit=${save}>
      <div class="section-head"><h2 class="h-ico"><${Icon} name="mail"/> Email de l’école</h2></div>
      <p class="small muted">Un compte créé avec une adresse de ces domaines est vérifié tout de suite, sans action de ta part.</p>
      <${Field} label="Domaines de l’email de l’école" hint="Séparés par des virgules, sans @. Ex. ensam-umi.ac.ma"><input id="rg-domaines" dir="ltr" translate="no" value=${txt} onInput=${e => setTxt(e.target.value)} placeholder="ensam-umi.ac.ma"/><//>
      ${mauvais.length ? html`<p class="small warn-t">Domaine invalide : <span class="mono" dir="ltr" translate="no">${mauvais.join(', ')}</span></p>` : null}
      ${!domaines.length ? html`<p class="small muted">Aucun domaine pour l’instant : tout le monde s’inscrit avec son adresse habituelle.</p>` : html`<p class="chips">${domaines.map(d => html`<span class="mini mono" dir="ltr" translate="no">@${d}</span>`)}</p>`}
      <div class="row-end"><button class="btn primary" id="rg-save" disabled=${!change || mauvais.length > 0}>Enregistrer</button></div>
      <hr class="rg-sep"/>
      <label class="switch rg-switch"><input id="rg-oblig" type="checkbox" checked=${oblig} disabled=${!domaines.length} onChange=${e => act(async () => { await store.enregistrerReglage('email_ecole_obligatoire', e.target.checked); toast('Réglage enregistré.'); })}/>
        <span><strong>Obliger les étudiants à s’inscrire avec l’email de l’école</strong><br/><span class="small muted">Un étudiant qui s’inscrit avec une autre adresse (Gmail…) ne peut pas créer son profil. Les lauréats gardent leur adresse personnelle.</span></span></label>
      ${!domaines.length ? html`<p class="small muted">Ajoute d’abord au moins un domaine.</p>` : null}
    </form>
  </div>`;
}

// ---------------------------------------------------------------------------
// Vue d'ensemble : parrainage, annonce
// ---------------------------------------------------------------------------
// Parrainage : les 3A sans parrain reçoivent un lauréat volontaire de leur filière (la base le fait aussi chaque matin)
function ParrainsAdmin({ ctx }) {
  const { data, store, act, saison } = ctx;
  const sans = data.profiles.filter(p => p.role === 'etudiant' && niveauOf(p, saison) === 3 && !data.parrainages.some(x => x.filleul_id === p.id && x.saison === saison));
  const parrains = data.profiles.filter(p => p.role === 'laureat' && p.parrain_dispo).length;
  const n = data.parrainages.filter(x => x.saison === saison).length;
  return html`<div class="panel">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="heart"/> Parrainage des 3A</h2>
      <button class="btn small" disabled=${!sans.length} onClick=${() => act(async () => { const k = await store.attribuerParrains(); toast(k ? `${k} parrain${k > 1 ? 's' : ''} attribué${k > 1 ? 's' : ''}.` : 'Aucun parrain disponible dans ces filières pour l’instant.'); })}>Attribuer les parrains</button></div>
    <p class="small muted">${n} filleul${n > 1 ? 's' : ''} cette année · ${parrains} lauréat${parrains > 1 ? 's' : ''} volontaire${parrains > 1 ? 's' : ''} · ${sans.length} étudiant${sans.length > 1 ? 's' : ''} de 3A sans parrain. Chaque matin, la plateforme attribue aussi les parrains toute seule.</p>
  </div>`;
}

// Annonce sur l'accueil : une ligne, pour un public (tout le monde, les étudiants ou les lauréats), pendant 14 jours
const POUR_LABEL = { etudiants: 'Pour les étudiants', laureats: 'Pour les lauréats' };
const finAnnonce = a => new Date(new Date(a.created_at).getTime() + ANNONCE_JOURS * 864e5).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
function AnnonceBox({ ctx }) {
  const { data, store, me, act } = ctx;
  const visibles = data.annonces.filter(a => annonceVisible(a)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const [texte, setTexte] = useState(''); const [lien, setLien] = useState(''); const [pour, setPour] = useState('tous');
  // Une annonce en cours : le formulaire se range derrière « Nouvelle annonce », sous elle, et s'ouvre à sa place
  // (la Vue d'ensemble reste courte) ; aucune annonce, ou un brouillon commencé : il reste ouvert
  const [ecrire, setEcrire] = useState(false);
  const ouvert = ecrire || !visibles.length || !!texte.trim();
  // Le focus suit le geste : dans le champ à l'ouverture, sur « Nouvelle annonce » une fois rangé (publiée ou annulée)
  const focusApres = useRef(null);
  // (attendu jusqu'au rendu qui montre l'élément : celui d'une mise à jour des données peut passer avant)
  useEffect(() => { const el = focusApres.current && document.getElementById(focusApres.current); if (el) { focusApres.current = null; el.focus(); } });
  const ouvrir = () => { focusApres.current = 'ann-txt'; setEcrire(true); };
  const ranger = () => { focusApres.current = 'ann-nouvelle'; setEcrire(false); setTexte(''); setLien(''); setPour('tous'); };
  // Une nouvelle annonce remplace celles de son public (« Tout le monde » : toutes) ; les autres restent pour leur public
  const remplacee = (x, pour) => pour === 'tous' || x === pour;
  const publish = e => {
    e.preventDefault();
    act(async () => {
      if (lien.trim() && !/^https:\/\/\S+$/i.test(lien.trim())) throw new Error('Le lien doit commencer par https://');
      // La nouvelle d'abord : si elle échoue (base pas encore à jour…), l'annonce en cours reste
      const anciennes = data.annonces.filter(x => x.active && remplacee(x.public || 'tous', pour));
      await store.insert('annonces', { author_id: me.id, texte: texte.trim(), lien: lien.trim() || null, active: true, ...(pour === 'tous' ? {} : { public: pour }) });
      for (const a of anciennes) await store.update('annonces', a.id, { active: false });
      ranger();
      toast(pour === 'etudiants' ? 'Annonce publiée sur l’accueil des étudiants.' : pour === 'laureats' ? 'Annonce publiée sur l’accueil des lauréats.' : 'Annonce publiée sur l’accueil de tous les membres.', 'win');
    });
  };
  return html`<div class="panel">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="bell"/> Annonce sur l’accueil</h2></div>
    ${visibles.length ? visibles.map(a => html`<div class="annonce preview" key=${a.id}><${Icon} name="bell" size=${18}/><span class="grow"><span dir="auto" translate="no">${a.texte}</span><span class="annonce-meta"><span class="mini">${POUR_LABEL[a.public] || 'Tout le monde'}</span> <span class="small muted">${`Jusqu’au ${finAnnonce(a)}`}</span></span></span><button class="btn tiny ghost" onClick=${() => act(() => store.update('annonces', a.id, { active: false }))}>Retirer</button></div>`) : html`<p class="small muted">Aucune annonce en ce moment.</p>`}
    ${ouvert ? html`<form class="form" id="ann-form" onSubmit=${publish}>
      <${Field} label="Nouvelle annonce" hint="280 caractères au plus. Elle s’affiche sur une ligne, sur l’accueil des membres choisis, pendant 14 jours, et remplace l’annonce en cours pour eux."><textarea id="ann-txt" rows="2" maxlength="280" value=${texte} onInput=${e => setTexte(e.target.value)} placeholder="Ex. Forum entreprises jeudi à l’école : les lauréats sont les bienvenus."></textarea><//>
      <div class="field"><span class="field-label" id="ann-pour-l">Pour qui ?</span><div class="seg" role="radiogroup" aria-labelledby="ann-pour-l">${PUBLICS.map(([k, l]) => html`<button type="button" role="radio" id=${'ann-pour-' + k} aria-checked=${pour === k} class=${pour === k ? 'on' : ''} onClick=${() => setPour(k)}>${l}</button>`)}</div></div>
      <input id="ann-lien" dir="ltr" value=${lien} onInput=${e => setLien(e.target.value)} placeholder="Lien (facultatif) : https://…" aria-label="Lien (facultatif)"/>
      <div class="row ann-actions">${visibles.length ? html`<button type="button" class="btn ghost" onClick=${ranger}>Annuler</button>` : null}<button class="btn primary" disabled=${texte.trim().length < 3}>Publier</button></div>
    </form>` : html`<button type="button" class="btn small ann-nouvelle" id="ann-nouvelle" onClick=${ouvrir}><${Icon} name="plus" size=${15}/> Nouvelle annonce</button>`}
  </div>`;
}

// ---------------------------------------------------------------------------
// Cartes sponsorisées de Match : une entreprise paie le réseau directement (pas de régie, aucun traceur). L'administration
// écrit la carte, choisit qui la voit (public, années, filières) et quand, l'arrête ou la reprend, et suit ses totaux :
// vues (une par membre et par jour), clics sur « Voir », membres différents. Le bilan copié ne contient que ces totaux.
// Règles : sponsorisePour, avecSponsorises (logic.js) ; la base : sponsorises, compter_sponsorise, bilan_sponsorises.
// ---------------------------------------------------------------------------
const ETATS_SPONSO = { en_cours: ['En cours', 'coopt'], programmee: ['Programmée', ''], terminee: ['Terminée', 'done'], arretee: ['Arrêtée', 'done'] };
const dateFr = d => (d ? new Date(d + 'T12:00:00').toLocaleDateString('fr-FR') : '');
const plusJours = (j, n) => jourLocal(new Date(j + 'T12:00:00').getTime() + n * 864e5);
const vide = () => ({ entreprise: '', titre: '', texte: '', lien: '', domaine: '', public: 'tous', annees: [], filieres: [], debut: jourLocal(), fin: plusJours(jourLocal(), 30) });
// Pour qui, en une ligne : le public, les années, les filières (« Toutes les années », « Toutes les filières » quand rien n'est choisi)
const cibleSponso = s => [SPONSO_PUBLICS.find(([k]) => k === (s.public || 'tous'))?.[1],
  s.annees?.length ? s.annees.map(n => SPONSO_ANNEES.find(([k]) => k === Number(n))?.[1]).filter(Boolean).join(', ') : 'Toutes les années',
  s.filieres?.length ? resumeFilieres(s.filieres).join(', ') : 'Toutes les filières'].join(' · ');
// Le bilan à envoyer à l'entreprise : des totaux, jamais un nom ni un identifiant de membre (dans la langue de l'écran)
export function bilanSponso(s, t, aujourdhui = jourLocal()) {
  const v = t?.vues || 0, c = t?.clics || 0, m = t?.membres || 0, taux = tauxClic(c, v);
  return getLang() === 'ar'
    ? [`الحصيلة · شبكة ENSAM مكناس`, `البطاقة المموَّلة: «${s.titre}» (${s.entreprise})`, `الفترة: من ${dateFr(s.debut)} إلى ${dateFr(s.fin)}`,
      `المشاهدات: ${v} (مشاهدة واحدة لكل عضو في اليوم)`, `النقرات على «عرض»: ${c}`, `نسبة النقر: ${taux}`, `الأعضاء المختلفون: ${m}`,
      `أرقام إلى غاية ${dateFr(aujourdhui)}. مجاميع فقط: لا تنقل المنصة أبدًا من شاهد البطاقة أو نقر عليها.`].join('\n')
    : [`Bilan · Réseau ENSAM Meknès`, `Carte sponsorisée : « ${s.titre} » (${s.entreprise})`, `Période : du ${dateFr(s.debut)} au ${dateFr(s.fin)}`,
      `Vues : ${v} (une par membre et par jour)`, `Clics sur « Voir » : ${c}`, `Taux de clic : ${taux}`, `Membres différents : ${m}`,
      `Chiffres au ${dateFr(aujourdhui)}. Totaux seulement : la plateforme ne transmet jamais qui a vu ou cliqué.`].join('\n');
}

function SponsorisesAdmin({ ctx }) {
  const { data, store, act } = ctx;
  const liste = [...(data.sponsorises || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const [totaux, setTotaux] = useState(null);   // { [id]: { vues, clics, membres } }, lus à l'ouverture
  const [f, setF] = useState(null);             // le formulaire ouvert : { id?, ...champs }
  const cle = liste.map(s => s.id).join(',');
  useEffect(() => {
    let on = true;
    Promise.resolve(store.bilanSponsorises?.()).then(r => on && setTotaux(Object.fromEntries((r || []).map(x => [x.sponsorise_id, x]))), () => on && setTotaux({}));
    return () => { on = false; };
  }, [cle]);
  if (!store.peutSponso?.()) return html`<div class="panel"><p class="muted">La base n’a pas encore les cartes sponsorisées : lance supabase/mise-a-jour.sql dans Supabase.</p></div>`;
  const copier = async s => { try { await navigator.clipboard.writeText(bilanSponso(s, totaux?.[s.id])); toast('Bilan copié : il ne contient que des totaux.'); } catch { toast('Copie impossible ici : sélectionne le texte et copie-le.', 'err'); } };
  const basculer = s => act(async () => { await store.update('sponsorises', s.id, { actif: !s.actif }); toast(s.actif ? 'Carte arrêtée : elle ne paraît plus dans Match.' : 'Carte reprise : elle paraît de nouveau dans Match, entre ses dates.'); });
  const ouvrir = s => setF(s ? { id: s.id, entreprise: s.entreprise, titre: s.titre, texte: s.texte, lien: s.lien, domaine: s.domaine || '', public: s.public || 'tous', annees: s.annees || [], filieres: s.filieres || [], debut: s.debut, fin: s.fin } : vide());
  return html`<div class="sub-page sponso-admin">
    <div class="panel">
      <div class="section-head"><h2 class="h-ico"><${Icon} name="etiquette"/> Cartes sponsorisées <span class="count">${liste.length}</span></h2>
        ${f ? null : html`<button class="btn small primary" id="sp-nouvelle" onClick=${() => ouvrir(null)}><${Icon} name="plus" size=${15}/> Nouvelle carte</button>`}</div>
      <p class="muted small">Une carte « Sponsorisé » paraît dans Match après chaque 10 cartes, seulement pour le public, les années et les filières choisis, entre ses dates. L’entreprise paie le réseau directement. Elle reçoit seulement des totaux : jamais qui a vu ou cliqué.</p>
      ${f ? html`<${FormSponso} ctx=${ctx} f=${f} setF=${setF}/>` : null}
      ${liste.length ? html`<ul class="sp-liste">${liste.map(s => { const t = totaux?.[s.id] || { vues: 0, clics: 0, membres: 0 }; const [el, tc] = ETATS_SPONSO[etatSponsorise(s)]; return html`<li key=${s.id} class="sp-ligne" data-id=${s.id}>
        <div class="sp-tete"><span class="sp-noms"><strong translate="no" dir="auto">${s.titre}</strong><span class="small muted" translate="no" dir="auto">${s.entreprise}</span></span><span class=${'tag ' + tc}>${el}</span></div>
        <p class="small muted sp-quand">${`Du ${dateFr(s.debut)} au ${dateFr(s.fin)}`}</p>
        <p class="small sp-cible">${cibleSponso(s)}</p>
        <dl class="sp-chiffres">
          <div><dt>Vues</dt><dd class="sp-vues">${totaux ? t.vues : '…'}</dd></div>
          <div><dt>Clics</dt><dd class="sp-clics">${totaux ? t.clics : '…'}</dd></div>
          <div><dt>Taux de clic</dt><dd class="sp-taux">${totaux ? tauxClic(t.clics, t.vues) : '…'}</dd></div>
          <div><dt>Membres différents</dt><dd class="sp-membres">${totaux ? t.membres : '…'}</dd></div>
        </dl>
        <div class="sp-acts">
          <button class="btn tiny ghost sp-modifier" onClick=${() => ouvrir(s)}><${Icon} name="edit" size=${14}/> Modifier</button>
          <button class="btn tiny ghost sp-basculer" onClick=${() => basculer(s)}>${s.actif ? 'Arrêter' : 'Reprendre'}</button>
          <button class="btn tiny ghost sp-bilan" onClick=${() => copier(s)} disabled=${!totaux}><${Icon} name="copy" size=${14}/> Copier le bilan</button>
        </div></li>`; })}</ul>`
      : f ? null : html`<${Empty} icon="etiquette" title="Aucune carte sponsorisée">Quand une entreprise soutient le réseau, sa carte se prépare ici : qui la voit, quand, et ses chiffres.<//>`}
    </div>
  </div>`;
}

function FormSponso({ ctx, f, setF }) {
  const { store, act } = ctx;
  const set = (k, v) => setF({ ...f, [k]: v });
  const entree = k => e => set(k, e.target.value);
  const bascule = n => set('annees', f.annees.includes(n) ? f.annees.filter(x => x !== n) : [...f.annees, n]);
  const enregistrer = e => {
    e.preventDefault();
    act(async () => {
      const { id, ...champs } = f;
      const row = normaliserSponsorise(champs);
      const refus = refusSponsorise(row);
      if (refus) throw new Error(refus);
      if (id) await store.update('sponsorises', id, row); else await store.insert('sponsorises', { ...row, actif: true });
      setF(null);
      toast(id ? 'Carte modifiée.' : 'Carte enregistrée : elle paraît dans Match entre ses dates.', 'win');
    });
  };
  const apercu = { entreprise: f.entreprise.trim() || 'Entreprise', titre: f.titre.trim() || 'Titre de la carte', texte: f.texte.trim() || 'Deux ou trois phrases claires sur ce que l’entreprise propose aux membres.', lien: f.lien.trim() || 'https://', domaine: f.domaine.trim() || null };
  return html`<form class="form sp-form" onSubmit=${enregistrer} aria-labelledby="sp-form-t">
    <h3 id="sp-form-t">${f.id ? 'Modifier la carte' : 'Nouvelle carte sponsorisée'}</h3>
    <div class="grid2"><${Field} label="Entreprise"><input id="sp-ent" maxlength="80" value=${f.entreprise} onInput=${entree('entreprise')} placeholder="Ex. un centre de langues"/><//>
      <${Field} label="Titre"><input id="sp-titre" maxlength="90" value=${f.titre} onInput=${entree('titre')}/><//></div>
    <${Field} label="Texte" hint="280 caractères au plus. Des faits simples : ce que l’entreprise propose, pour qui, à quel prix s’il y en a un."><textarea id="sp-texte" rows="3" maxlength="280" value=${f.texte} onInput=${entree('texte')}></textarea><//>
    <div class="grid2"><${Field} label="Lien" hint="« Voir » l’ouvre dans un nouvel onglet."><input id="sp-lien" dir="ltr" type="url" maxlength="500" value=${f.lien} onInput=${entree('lien')} placeholder="https://…"/><//>
      <${Field} label="Site pour le logo (facultatif)" hint="Son icône sert de logo ; sinon, les initiales."><input id="sp-domaine" dir="ltr" maxlength="120" value=${f.domaine} onInput=${entree('domaine')} placeholder="exemple.ma"/><//></div>
    <div class="field"><span class="field-label" id="sp-pub-l">Pour qui ?</span><div class="seg" role="radiogroup" aria-labelledby="sp-pub-l">${SPONSO_PUBLICS.map(([k, l]) => html`<button type="button" role="radio" id=${'sp-pub-' + k} aria-checked=${f.public === k} class=${f.public === k ? 'on' : ''} onClick=${() => set('public', k)}>${l}</button>`)}</div></div>
    <div class="field"><span class="field-label" id="sp-annees-l">Années</span><div id="sp-annees" class="chips" role="group" aria-labelledby="sp-annees-l">${SPONSO_ANNEES.map(([n, l]) => html`<button type="button" class=${'chip' + (f.annees.includes(n) ? ' on' : '')} aria-pressed=${f.annees.includes(n)} onClick=${() => bascule(n)}>${l}</button>`)}</div><span class="field-hint">Aucune année choisie = toutes les années.</span></div>
    <div class="field"><span class="field-label" id="sp-fil-l">Filières</span><div role="group" aria-labelledby="sp-fil-l"><${FilieresPick} value=${f.filieres} onChange=${v => set('filieres', v)}/></div><span class="field-hint">Aucune sélection = toutes les filières. Une ancienne appellation suit son parcours.</span></div>
    <div class="grid2"><${Field} label="Début"><input id="sp-debut" type="date" required value=${f.debut} onInput=${entree('debut')}/><//><${Field} label="Fin"><input id="sp-fin" type="date" required min=${f.debut} value=${f.fin} onInput=${entree('fin')}/><//></div>
    <div class="field"><span class="field-label">Aperçu dans Match</span><${ApercuSponsorise} s=${apercu}/></div>
    <div class="row-end"><button type="button" class="btn ghost" onClick=${() => setF(null)}>Annuler</button><button class="btn primary" id="sp-enregistrer">Enregistrer</button></div>
  </form>`;
}

addAR({
  'Sponsorisés': 'المموَّلة', 'Cartes sponsorisées': 'البطاقات المموَّلة', 'Nouvelle carte': 'بطاقة جديدة', 'Nouvelle carte sponsorisée': 'بطاقة مموَّلة جديدة', 'Modifier la carte': 'تعديل البطاقة',
  'Une carte « Sponsorisé » paraît dans Match après chaque 10 cartes, seulement pour le public, les années et les filières choisis, entre ses dates. L’entreprise paie le réseau directement. Elle reçoit seulement des totaux : jamais qui a vu ou cliqué.': 'تظهر بطاقة «مُموَّل» في صفحة التوافق بعد كل 10 بطاقات، فقط للفئة والسنوات والشعب المختارة، وبين تاريخَي بدايتها ونهايتها. تدفع الشركة للشبكة مباشرة. ولا تتلقى إلا المجاميع: أبدًا من شاهد أو نقر.',
  'Aucune carte sponsorisée': 'لا توجد بطاقة مموَّلة', 'Quand une entreprise soutient le réseau, sa carte se prépare ici : qui la voit, quand, et ses chiffres.': 'عندما تدعم شركة الشبكة، تُحضَّر بطاقتها هنا: من يراها، ومتى، وأرقامها.',
  'La base n’a pas encore les cartes sponsorisées : lance supabase/mise-a-jour.sql dans Supabase.': 'قاعدة البيانات لا تضم البطاقات المموَّلة بعد: شغّل supabase/mise-a-jour.sql في Supabase.',
  'En cours': 'قيد الإنجاز', 'Programmée': 'مبرمجة', 'Arrêtée': 'متوقفة', 'Arrêter': 'إيقاف', 'Reprendre': 'استئناف',
  'Vues': 'المشاهدات', 'Clics': 'النقرات', 'Taux de clic': 'نسبة النقر', 'Membres différents': 'الأعضاء المختلفون', 'Copier le bilan': 'نسخ الحصيلة',
  'Bilan copié : il ne contient que des totaux.': 'نُسخت الحصيلة: لا تضم إلا المجاميع.',
  'Carte arrêtée : elle ne paraît plus dans Match.': 'أُوقفت البطاقة: لم تعد تظهر في صفحة التوافق.',
  'Carte reprise : elle paraît de nouveau dans Match, entre ses dates.': 'استُؤنفت البطاقة: تظهر من جديد في صفحة التوافق، بين تاريخَي بدايتها ونهايتها.',
  'Carte modifiée.': 'عُدّلت البطاقة.', 'Carte enregistrée : elle paraît dans Match entre ses dates.': 'حُفظت البطاقة: تظهر في صفحة التوافق بين تاريخَي بدايتها ونهايتها.',
  'Ex. un centre de langues': 'مثال: مركز للغات', 'Texte': 'النص', 'Lien': 'الرابط',
  '280 caractères au plus. Des faits simples : ce que l’entreprise propose, pour qui, à quel prix s’il y en a un.': '280 حرفًا على الأكثر. معلومات بسيطة: ما تقترحه الشركة، ولمن، وبأي ثمن إن وُجد.',
  '« Voir » l’ouvre dans un nouvel onglet.': 'يفتحه زر «عرض» في علامة تبويب جديدة.',
  'Site pour le logo (facultatif)': 'موقع للشعار (اختياري)', 'Son icône sert de logo ; sinon, les initiales.': 'تُستعمل أيقونته شعارًا؛ وإلا فالحروف الأولى.',
  'Années': 'السنوات', 'Aucune année choisie = toutes les années.': 'عدم اختيار أي سنة = كل السنوات.',
  'Aucune sélection = toutes les filières. Une ancienne appellation suit son parcours.': 'عدم الاختيار = كل الشعب. التسمية القديمة تتبع مسارها.',
  'Étudiants et lauréats': 'الطلبة والخريجون', 'Toutes les années': 'كل السنوات', 'Toutes les filières': 'كل الشعب',
  'Entreprise': 'الشركة', 'Titre de la carte': 'عنوان البطاقة', 'Deux ou trois phrases claires sur ce que l’entreprise propose aux membres.': 'جملتان أو ثلاث جمل واضحة عما تقترحه الشركة على الأعضاء.',
  // Refus (refusSponsorise, mêmes règles que la base)
  'Indique l’entreprise (80 caractères au plus).': 'أدخل اسم الشركة (80 حرفًا على الأكثر).', 'Le titre fait de 3 à 90 caractères.': 'يتكون العنوان من 3 إلى 90 حرفًا.',
  'Le texte fait de 10 à 280 caractères.': 'يتكون النص من 10 إلى 280 حرفًا.', 'Le domaine du logo s’écrit sans https:// (ex. exemple.ma).': 'يُكتب نطاق الشعار دون https:// (مثال: exemple.ma).',
  'Choisis un public.': 'اختر الفئة المعنية.', 'Choisis des années de la liste.': 'اختر سنوات من اللائحة.', 'Choisis les dates de début et de fin.': 'اختر تاريخَي البداية والنهاية.',
  'La fin vient après le début.': 'يأتي تاريخ النهاية بعد البداية.',
}, [
  [/^Du (\S+) au (\S+)$/, (a, b) => `من ${a} إلى ${b}`],
]);

injectCSS('admin', `
.adm-tabs { margin-bottom: .2rem; }
/* Téléphone : dans les listes à gestes (recrutements en attente, dernières offres), le texte garde toute la largeur et les gestes passent dessous */
@media (max-width: 640px) {
  .people-list.adm-gestes li { flex-wrap: wrap; row-gap: .35rem; padding-block: .7rem; }
  .people-list.adm-gestes li > :is(.person, .grow) { flex: 1 1 100%; }
  .people-list.adm-gestes li > .spacer { display: none; }
  .people-list.adm-gestes li > .btn:first-of-type { margin-inline-start: auto; }
}
/* Cartes sponsorisées : une ligne par carte, ses totaux en quatre chiffres, puis ses gestes */
.sp-liste { list-style: none; margin: .4rem 0 0; padding: 0; display: flex; flex-direction: column; gap: .6rem; }
.sp-ligne { display: flex; flex-direction: column; gap: .35rem; padding: .85rem .95rem; border-radius: var(--r-lg); background: var(--surface-2); }
.sp-tete { display: flex; align-items: flex-start; justify-content: space-between; gap: .6rem; }
.sp-noms { display: flex; flex-direction: column; min-width: 0; overflow-wrap: anywhere; }
.sp-tete .tag { flex: none; margin: 0; }
.sp-quand, .sp-cible { margin: 0; }
.sp-chiffres { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .4rem; margin: .2rem 0; }
.sp-chiffres > div { display: flex; flex-direction: column; gap: .1rem; padding: .45rem .55rem; border-radius: var(--r-md); background: var(--surface); }
.sp-chiffres dt { font-size: var(--fs-1); color: var(--muted); }
.sp-chiffres dd { margin: 0; font: 700 var(--fs-5)/1.2 var(--f-display); font-variant-numeric: tabular-nums; }
@media (max-width: 520px) { .sp-chiffres { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.sp-acts { display: flex; flex-wrap: wrap; gap: .3rem; }
.sp-form { margin: .4rem 0 .8rem; padding: .9rem 1rem; border-radius: var(--r-lg); background: var(--surface-2); }
.sp-form h3 { margin: 0; font-size: var(--fs-4); }
.mod-card { display: flex; flex-direction: column; gap: .55rem; padding: .95rem 1.05rem; border-radius: var(--r-lg); background: var(--surface); border: 0; box-shadow: var(--sh1), inset 3px 0 0 var(--brass); }
:root[dir="rtl"] .mod-card { box-shadow: var(--sh1), inset -3px 0 0 var(--brass); }
/* L'annonce en cours (Vue d'ensemble) : sa date reste lisible sur le fond teinté, de nuit aussi */
.annonce.preview { background: var(--surface-2); box-shadow: none; border-radius: var(--r-md); }
.annonce.preview .mini { background: var(--surface); }
.annonce.preview .annonce-meta .muted { color: var(--ink-2); }
/* « Nouvelle annonce » sous l'annonce en cours : le formulaire s'ouvre à sa place */
.ann-nouvelle { align-self: flex-start; }
/* Annuler et Publier sous le lien, au bout de la ligne : le champ du lien garde toute sa largeur, à 360 aussi */
.ann-actions { justify-content: flex-end; }
.mod-head { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem; }
.mod-ico { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: var(--brass-soft); color: var(--brass); flex: none; }
.mod-cible { display: flex; flex-direction: column; gap: .25rem; padding: 0; padding-inline-start: .75rem; border-inline-start: 2px solid var(--line); margin: 0; }
.mod-titre { font-size: .95rem; }
.mod-texte { margin: 0; font-size: .9rem; color: var(--ink-2); overflow-wrap: anywhere; }
.mod-reports { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .2rem; }
/* Les mots du membre qui signale, sur leur propre ligne : une citation qui ne se mêle pas au motif (ni à l'arabe) */
.mod-details { display: block; margin-top: .1rem; color: var(--ink-2); overflow-wrap: anywhere; }
.mod-act { display: flex; flex-wrap: wrap; gap: .5rem .8rem; align-items: center; justify-content: space-between; padding-top: .6rem; border-top: 1px solid var(--line); }
/* Ce qu'on fait du contenu (tonal ; rouge pour le retirer), puis ce qu'on fait du signalement (discret, au bout) :
   sur une ligne quand il y a la place, sinon l'un sous l'autre ; aucun aplat, la carte se répète */
.mod-decider, .mod-clore { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem; }
.mod-clore { margin-inline-start: auto; }
.mod-voir { display: inline-flex; align-items: center; gap: .3rem; align-self: flex-start; margin-top: .1rem; }
.member-list .ligne-act select { width: auto; padding-block: .35rem; font-size: var(--fs-2); }
/* L'e-mail et les dates sont dans le texte du membre, sous sa ligne : alignés sur elle (l'ancien retrait de la largeur
   du visage, prévu quand ils passaient sous toute la ligne, les décalait) */
.member-list .person .member-meta { margin-inline-start: 0; }
.mod-hist li { flex-wrap: nowrap; }
.mod-hist .grow { min-width: 0; }
.verif-list li { flex-wrap: nowrap; align-items: flex-start; }
.verif-who { display: flex; flex-direction: column; gap: .3rem; min-width: 0; flex: 1; }
.verif-facts { display: flex; flex-direction: column; gap: .15rem; min-width: 0; padding-inline-start: calc(36px + .6rem); }
/* L'icône reste devant son texte, qui passe à la ligne dessous (jamais une icône seule sur sa ligne) */
.verif-facts > span { display: block; overflow-wrap: anywhere; }
.verif-facts > span > svg { vertical-align: -2px; margin-inline-end: .3rem; }
.verif-acts { display: flex; gap: .4rem; flex-wrap: wrap; padding-inline-start: calc(36px + .6rem); }
.verif-acts:empty { display: none; }
.mod-cible > .avatar { margin-bottom: .2rem; }
.good-t { color: var(--good); } .warn-t { color: var(--warn); }
.parcours { list-style: none; margin: 0 0 .6rem; padding: 0; display: grid; grid-template-columns: auto minmax(60px, 1fr) auto auto; gap: .5rem .8rem; align-items: center; }
.parcours li { display: contents; }
.parcours .parcours-l { font-weight: 600; font-size: .9rem; }
@media (max-width: 520px) { .parcours { grid-template-columns: auto minmax(40px, 1fr) auto; } .parcours li > :last-child { display: none; } }
.good-box { background: var(--good-soft); color: var(--good); }
.file-btn { position: relative; overflow: hidden; align-self: flex-start; }
.file-btn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
/* Au doigt, le champ invisible déborde du bouton jusqu'à 44 px de haut : c'est lui qu'on touche (le bouton ne grandit pas) */
@media (pointer: coarse) { .file-btn { overflow: visible; } .file-btn input { inset-block: min(0px, calc(50% - 22px)); } }
/* Au clavier, le focus est sur le champ invisible : c'est le bouton qui le montre */
.file-btn:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
.lo-import { display: flex; flex-direction: column; gap: .8rem; padding-top: .6rem; border-top: 1px dashed var(--line); }
.lo-import p { margin: 0; }
.lo-map { display: flex; flex-direction: column; gap: .4rem; }
.lo-map .grid3 { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.lo-preview { display: flex; flex-direction: column; gap: .3rem; overflow-x: auto; }
.lo-table { border-collapse: collapse; font-size: .84rem; width: 100%; }
.lo-table th { text-align: start; font-weight: 600; color: var(--muted); padding: .3rem .5rem; border-bottom: 1px solid var(--line); white-space: nowrap; }
.lo-table td { padding: .3rem .5rem; border-bottom: 1px solid var(--line); white-space: nowrap; }
.lo-table tr.bad td { color: var(--bad); text-decoration: line-through; }
.lo-couv { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: .8rem; }
.lo-promo { display: flex; flex-direction: column; gap: .4rem; padding: .7rem 0 0; border: 0; border-top: 1px solid var(--line); border-radius: 0; }
.lo-fil { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .25rem; }
.lo-fil li { display: flex; align-items: center; gap: .5rem; }
.lo-fil .grow { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lo-mini { width: 70px; flex: none; }
.lo-manquants { display: flex; flex-direction: column; gap: .5rem; }
.lo-list { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow: auto; border-block: 1px solid var(--line); }
.lo-list li { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1.3fr); gap: .5rem; padding: .35rem .6rem; border-bottom: 1px solid var(--line); }
.lo-list li > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rg-sep { border: 0; border-top: 1px dashed var(--line); margin: .2rem 0; width: 100%; }
.rg-switch { align-items: flex-start; }
.rg-switch input { margin-top: .25rem; }
@media (max-width: 640px) {
  .lo-list li { grid-template-columns: minmax(0, 1fr); gap: 0; }
  .mod-hist li { flex-wrap: wrap; }
}
`);
