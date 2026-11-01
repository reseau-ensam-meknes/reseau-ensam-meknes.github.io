// Administration, par onglets : vue d'ensemble (chiffres, annonce, défis, parrains, recrutements, offres),
// modération des signalements, membres (rôle, vérification), liste officielle des étudiants,
// liens d'invitation par promo, agenda de l'école, cartes sponsorisées de Match et réglages (email de l'école).
import { html, useState, useEffect, useMemo, useRef } from './vendor/preact-htm.js';
import { Icon, Field, Person, Empty, Bar, Avatar, toast, injectCSS, EnTetePage, Compteur, Anneau, Squelette } from './ui.js';
import { PucesNav, useVoirPlus, VoirPlus } from './lignes.js';
import { addAR, arCount } from './i18n.js';
import { NIVEAUX, niveauOf, timeAgo, cleNom, norm, GUIDE_SECTIONS, pct, reponses48h, parcoursInscription, compteOuvert, codesSansSuite, PUBLICS, ANNONCE_JOURS, annonceVisible,
  SPONSO_PUBLICS, SPONSO_ANNEES, jourLocal, normaliserSponsorise, refusSponsorise, etatSponsorise, tauxClic, resumeFilieres, seasonLabel,
  santeResume, raisonsNotifs, raisonsAvecPertes, dureeAttente, etatCronNotifs } from './logic.js';
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

// Le menu du rôle (étiqueté « Rôle ») dit le rôle en un mot : sur téléphone, le nom du membre garde la place de se lire
const ROLES = [['etudiant', 'Étudiant'], ['laureat', 'Lauréat']];
const TABS = [['', 'Vue d’ensemble', 'chart'], ['moderation', 'Modération', 'flag'], ['membres', 'Membres', 'people'], ['liste', 'Liste officielle', 'file'], ['inviter', 'Inviter', 'send'], ['agenda', 'Agenda', 'calendar'], ['sponsorises', 'Sponsorisés', 'etiquette'], ['reglages', 'Réglages', 'wrench']];

// Comptes (emails, dernière connexion), lus une fois pour toute la page
function useComptes(store, n) {
  const [comptes, setComptes] = useState(null);
  useEffect(() => { let on = true; Promise.resolve(store.adminComptes?.()).then(r => on && setComptes(r || []), () => on && setComptes([])); return () => { on = false; }; }, [n]);
  return comptes;
}

export function AdminPage(ctx) {
  const { data, store, sub, go } = ctx;
  const comptes = useComptes(store, data.profiles.length);
  const tab = TABS.some(([k]) => k === sub) ? sub : '';
  const ouverts = (data.signalements || []).filter(s => s.status === 'ouvert');
  const toVerify = data.profiles.filter(p => p.role === 'laureat' && !p.verified);
  const dot = { moderation: ouverts.length, membres: toVerify.length };
  return html`<section class="page admin">
    <${EnTetePage} surTitre=${ctx.saison ? `Année ${seasonLabel(ctx.saison)}` : null} titre="Administration">
      <${PucesNav} cls="adm-tabs" label="Rubriques de l’administration" idPrefix="adm-tab-" items=${TABS.map(([k, l, i]) => ({ k, label: l, icon: i, n: dot[k] }))} actif=${tab} onChoisir=${k => go(k ? 'admin/' + k : 'admin')}/>
    <//>
    ${tab === '' ? html`<${VueEnsemble} ctx=${ctx} comptes=${comptes} ouverts=${ouverts} toVerify=${toVerify}/>` : null}
    ${tab === 'moderation' ? html`<${Moderation} ctx=${ctx}/>` : null}
    ${tab === 'membres' ? html`<${Membres} ctx=${ctx} comptes=${comptes} toVerify=${toVerify}/>` : null}
    ${tab === 'liste' ? html`<${ListeOfficielle} ctx=${ctx}/>` : null}
    ${tab === 'inviter' ? html`<${InvitationsAdmin} ctx=${ctx}/><${AmbassadeursAdmin} ctx=${ctx}/>` : null}
    ${tab === 'agenda' ? html`<${AgendaAdmin} ctx=${ctx}/>` : null}
    ${tab === 'sponsorises' ? html`<${SponsorisesAdmin} ctx=${ctx}/>` : null}
    ${tab === 'reglages' ? html`<${Reglages} ctx=${ctx}/>` : null}
  </section>`;
}

// ---------------------------------------------------------------------------
// Vue d'ensemble
// ---------------------------------------------------------------------------
function VueEnsemble({ ctx, comptes, ouverts, toVerify }) {
  const { data, store, act, openProfile, saison, go } = ctx;
  const sansProfil = (comptes || []).filter(c => !c.a_profil && compteOuvert(c));
  const week = Date.now() - 7 * 864e5;
  const members = data.profiles.filter(p => p.role !== 'admin');
  const nouveaux = members.filter(p => new Date(p.created_at) > week);
  const confirmes = data.placements.filter(p => p.saison === saison && p.status === 'confirme').length;
  // Le chiffre à suivre : chaque demande d'étudiant a une réponse d'un lauréat en moins de 48 h
  const r48 = reponses48h(data);
  const attenteM = r48.attente.filter(d => d.type === 'mentorat'), attenteQ = r48.attente.filter(d => d.type === 'question'), attenteD = r48.attente.filter(d => d.type === 'demande');
  const parcours = parcoursInscription(comptes, data);
  const dm = r48.parType.demande;
  const kpis = [
    ['Demandes aidées en 48 h', dm.taux === null ? '–' : pct(dm.taux), dm.total ? `${dm.a48} sur ${dm.total} en 30 jours · objectif 8 sur 10${r48.total > dm.total ? ` · toutes aides : ${pct(r48.taux)}` : ''}` : r48.total ? `Pas encore de demande d’étudiant ce mois-ci · toutes aides : ${pct(r48.taux)}` : 'Pas encore de demande d’étudiant ce mois-ci'],
    ['Membres', members.length, `${members.filter(p => p.role === 'etudiant').length} étudiants · ${members.filter(p => p.role === 'laureat').length} lauréats`],
    ['Actifs cette semaine', parcours.actifs, `${nouveaux.length} nouveau${nouveaux.length > 1 ? 'x' : ''} inscrit${nouveaux.length > 1 ? 's' : ''}${sansProfil.length ? ` · ${sansProfil.length} sans profil` : ''}`],
    ['Recrutés et confirmés', confirmes, 'cette année, via la plateforme'],
  ];
  const lecturesFausses = (data.retours_cv || []).filter(r => r.status === 'ouvert');
  const stale = data.placements.filter(p => p.status === 'en_attente').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const todo = [
    ouverts.length ? ['flag', `${ouverts.length} signalement${ouverts.length > 1 ? 's' : ''} à traiter`, 'admin/moderation'] : null,
    toVerify.length ? ['shield', `${toVerify.length} lauréat${toVerify.length > 1 ? 's' : ''} à vérifier`, 'admin/membres'] : null,
    attenteM.length ? ['clock', attenteM.length > 1 ? `${attenteM.length} étudiants attendent un horaire depuis plus de 24 h` : '1 étudiant attend un horaire depuis plus de 24 h', 'mentorat'] : null,
    attenteD.length ? ['send', attenteD.length > 1 ? `${attenteD.length} demandes d’étudiants sans proposition depuis plus de 24 h` : '1 demande d’étudiant sans proposition depuis plus de 24 h', 'offres/demandes/' + attenteD[0].id] : null,
    attenteQ.length ? ['qa', attenteQ.length > 1 ? `${attenteQ.length} questions d’étudiants sans réponse depuis plus de 24 h` : '1 question d’étudiant sans réponse depuis plus de 24 h', 'reseau/entraide/' + attenteQ[0].id] : null,
    lecturesFausses.length ? ['file', lecturesFausses.length > 1 ? `${lecturesFausses.length} erreurs de lecture de CV signalées` : '1 erreur de lecture de CV signalée', 'admin/membres'] : null,
  ].filter(Boolean);
  return html`
    ${todo.length ? html`<div class="callout today"><h2 class="h-ico"><${Icon} name="bell"/> À traiter</h2><ul class="todo">${todo.map(([i, t, r]) => html`<li><button class="notif act" onClick=${() => go(r)}><span class="n-ico accent"><${Icon} name=${i} size=${16}/></span><span>${t}</span><${Icon} name="arrow" size=${16}/></button></li>`)}</ul></div>` : null}
    <${SanteNotifs} store=${store}/>
    <div class="kpis">${kpis.map(([l, v, sub]) => html`<div class="kpi"><span class="kpi-label">${l}</span><span class="kpi-val">${typeof v === 'number' ? html`<${Compteur} v=${v}/>` : v}</span><span class="small muted">${sub}</span></div>`)}</div>

    <${ParcoursInscription} p=${parcours} sansSuite=${codesSansSuite(comptes, data.profiles)}/>

    <${AnnonceBox} ctx=${ctx}/>
    <${DefisAdmin} ctx=${ctx}/>
    <${ParrainsAdmin} ctx=${ctx}/>

    ${stale.length ? html`<div class="panel"><div class="section-head"><h2 class="h-ico"><${Icon} name="briefcase"/> <span>Recrutements en attente de l’étudiant <span class="count">${stale.length}</span></span></h2></div>
      <p class="muted small">Le lauréat a déclaré ces recrutements. Si l’étudiant ne confirme pas, l’administration peut le faire après vérification.</p>
      <ul class="people-list adm-gestes">${stale.map(p => { const s = store.byId('profiles', p.student_id), l = store.byId('profiles', p.laureat_id); return html`<li key=${p.id}><${Person} p=${s} onOpen=${openProfile} sub=${`${p.entreprise} · déclaré par ${l?.full_name || '?'} · ${timeAgo(p.created_at)}`}/><span class="spacer"></span>
        <button class="btn small ghost" onClick=${() => act(() => store.update('placements', p.id, { status: 'refuse' }))}>Refuser</button><button class="btn small tonal" onClick=${() => act(() => store.update('placements', p.id, { status: 'confirme' }))}>Confirmer</button></li>`; })}</ul></div>` : null}
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
// Santé des notifications : combien de membres les reçoivent, ce qui arrive sur les téléphones, ce qui se perd et
// pourquoi, en phrases simples. Des totaux seulement (admin_sante_notifs dans la base) : jamais un nom, une adresse ni un
// contenu. Lu à l'ouverture de la Vue d'ensemble et sur « Actualiser ». Base pas encore à jour : une phrase calme.
// ---------------------------------------------------------------------------
function useSanteNotifs(store) {
  const [n, setN] = useState(0);
  const [etat, setEtat] = useState({ charge: true, s: null, absent: false, err: null });
  useEffect(() => {
    let on = true;
    setEtat(e => ({ ...e, charge: true, err: null }));
    Promise.resolve(store.santeNotifs ? store.santeNotifs() : null).then(
      s => on && setEtat({ charge: false, s, absent: !s, err: null }),
      e => on && setEtat(x => ({ ...x, charge: false, err: e?.message || String(e) })));
    return () => { on = false; };
  }, [n]);
  return [etat, () => setN(x => x + 1)];
}
const ICONES_SN = { http: 'link', cron: 'clock', file: 'inbox', jetees: 'flag', sans_tel: 'phone', refusees: 'block', abandonnees: 'clock', muets: 'phone', coupees: 'bell', echecs: 'send', rien: 'check', vide: 'bell' };
const ROLES_SN = { etudiant: 'Étudiants', laureat: 'Lauréats', admin: 'Administration' };
const accordSN = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const CRON_SN = { ok: 'Passage réussi', echec: 'Passage échoué', en_cours: 'En cours', inconnu: 'Passage terminé' };
function texteCronSN(c) {
  const e = etatCronNotifs(c);
  if (!e) return 'Illisible ici (pg_cron absent ou fermé à la lecture)';
  if (e === 'absente') return 'Absente de la base';
  if (e === 'jamais') return 'Pas encore lancée';
  return `${CRON_SN[e]} · ${timeAgo(c.at)}`;
}
function texteHttpSN(h) {
  if (!h) return 'Pas encore appelée (ou pg_net illisible)';
  const quoi = h.delai ? 'Délai dépassé' : h.erreur || !h.code ? 'Pas de réponse (réseau)' : `Réponse ${h.code}`;
  return h.at ? `${quoi} · ${timeAgo(h.at)}` : quoi;
}

function SanteNotifs({ store }) {
  const [etat, relire] = useSanteNotifs(store);
  const r = useMemo(() => santeResume(etat.s), [etat.s]);
  const raisons = useMemo(() => raisonsNotifs(r), [r]);
  const [detail, setDetail] = useState(false);
  const tete = html`<div class="section-head"><h2 class="h-ico"><${Icon} name="bell"/> Santé des notifications</h2>
    ${r ? html`<button class="btn small ghost sn-relire" onClick=${relire} disabled=${etat.charge}>${etat.charge ? 'Actualisation…' : 'Actualiser'}</button>` : null}</div>`;
  if (!r && etat.charge) return html`<div class="panel sn" id="adm-notifs" aria-busy="true">${tete}
    <div class="sn-attente"><${Squelette} hauteur=${64}/><${Squelette} hauteur=${150}/></div><span class="sr-only">Chargement…</span></div>`;
  if (!r && etat.absent && !etat.err) return html`<div class="panel sn" id="adm-notifs">${tete}<p class="muted sn-absent">Ce panneau apparaît après la mise à jour du serveur.</p></div>`;
  if (!r) return html`<div class="panel sn" id="adm-notifs">${tete}<p class="muted sn-erreur">${etat.err}</p>
    <button class="btn small tonal sn-reessayer" onClick=${relire}>Réessayer</button></div>`;
  const s = r.semaine, envoi = s.arrivees + s.perdues, p = r.part === null ? null : Math.round(r.part * 100);
  return html`<div class="panel sn" id="adm-notifs">
    ${tete}
    <div class="sn-haut">
      ${p === null ? null : html`<div class="sn-stat sn-portee">
        <${Anneau} valeur=${p} max=${100} taille=${64} epaisseur=${6} decoratif><b class="sn-pct" dir="ltr">${p}<small>%</small></b><//>
        <div class="sn-stat-txt"><strong class="sn-phrase">${`${pct(r.part)} des membres reçoivent les notifications`}</strong>
          <span class="small muted">${`${accordSN(r.avecTel, 'membre', 'membres')} sur ${r.membres} ${r.avecTel > 1 ? 'ont' : 'a'} activé les notifications sur au moins un téléphone.`}</span></div>
      </div>`}
      <div class="sn-stat sn-semaine">
        <span class="sn-grand"><${Compteur} v=${s.arrivees}/></span>
        <div class="sn-stat-txt"><strong class="sn-phrase">${s.arrivees > 1 ? 'notifications reçues cette semaine' : 'notification reçue cette semaine'}</strong>
          <span class="small muted">${!envoi ? 'Aucune notification cette semaine' : s.perdues ? `${accordSN(s.perdues, 'perdue', 'perdues')} sur ${envoi}` : 'aucune perdue'}</span></div>
      </div>
    </div>
    <${GrapheNotifs} r=${r}/>
    <div class="sn-raisons">
      <h3>${raisonsAvecPertes(raisons) ? 'Pourquoi certaines n’arrivent pas' : 'Cette semaine'}</h3>
      <ul>${raisons.map(x => html`<li key=${x.cle} class=${'sn-r t-' + x.ton} data-cle=${x.cle}><span class="sn-r-ico" aria-hidden="true"><${Icon} name=${ICONES_SN[x.cle] || 'bell'} size=${16}/></span><span>${x.texte}</span></li>`)}</ul>
    </div>
    ${etat.err ? html`<p class="small muted sn-erreur">${etat.err}</p>` : null}
    <details class="sn-detail" open=${detail} onToggle=${e => setDetail(e.currentTarget.open)}>
      <summary>${detail ? 'Masquer le détail' : 'Voir le détail'} <${Icon} name="chevron" size=${16}/></summary>
      ${detail ? html`<${DetailNotifs} r=${r}/>` : null}
    </details>
    <p class="small muted sn-pied">Des totaux sur 7 jours, sans aucun nom ni contenu.</p>
  </div>`;
}

// Une colonne par jour, les perdues posées sur les arrivées ; au survol ou au clavier, le jour en clair.
// Les mêmes chiffres sont dans le tableau « Par jour » du détail.
function GrapheNotifs({ r }) {
  const vide = !r.jours.some(j => j.arrivees + j.perdues);
  const n = r.jours.length;
  return html`<figure class="sn-graphe">
    <figcaption class="sn-graphe-tete"><span class="sn-graphe-titre">Les 7 derniers jours</span>
      <span class="sn-legende" aria-hidden="true"><span class="sn-cle"><i class="sn-pastille"></i>Arrivées</span><span class="sn-cle"><i class="sn-pastille perdu"></i>Perdues</span></span></figcaption>
    ${vide ? html`<p class="small muted sn-vide">Aucune notification ces 7 derniers jours.</p>` : html`<div class="sn-plot">
      <span class="sn-echelle" aria-hidden="true">${r.max}</span>
      <div class="sn-cols">${r.jours.map((j, i) => {
        const tot = j.arrivees + j.perdues, bord = i < 2 ? ' debut' : i >= n - 2 ? ' fin' : '';
        const dit = `${accordSN(j.arrivees, 'arrivée', 'arrivées')} · ${accordSN(j.perdues, 'perdue', 'perdues')}`;
        return html`<div key=${j.jour} class=${'sn-col' + bord} tabindex="0" role="img" aria-label=${`${j.long} : ${accordSN(j.arrivees, 'arrivée', 'arrivées')}, ${accordSN(j.perdues, 'perdue', 'perdues')}`}>
          <span class="sn-pile" style=${`block-size:${(tot / r.max) * 100}%`}>
            ${j.perdues ? html`<span class="sn-seg perdu" style=${`flex-grow:${j.perdues}`}></span>` : null}${j.arrivees ? html`<span class="sn-seg" style=${`flex-grow:${j.arrivees}`}></span>` : null}
          </span>
          <span class="sn-bulle" aria-hidden="true"><b>${j.long}</b><span>${dit}</span></span>
        </div>`;
      })}</div>
    </div>
    <div class="sn-jours" aria-hidden="true">${r.jours.map(j => html`<span key=${j.jour}>${j.court}</span>`)}</div>`}
  </figure>`;
}

function DetailNotifs({ r }) {
  const t = r.telephones;
  const tel = [['Téléphones abonnés', t.total], ['Ont affiché une notification en 24 h', t.recus24h], ['Ont affiché une notification en 7 jours', t.recus7j],
    ['Sans confirmation', t.muets], ['En refus', t.enRefus], ['Retirés cette semaine', t.retires7j]];
  const fonct = [
    ['File d’attente', r.file.n ? `${r.file.n} en attente · la plus ancienne depuis ${dureeAttente(r.file.ageS)}` : 'Vide : tout est parti'],
    ['Tâche de chaque minute, dernier passage', texteCronSN(r.cron)],
    ['Fonction notifier, dernier appel', texteHttpSN(r.http)],
  ];
  return html`<div class="sn-detail-corps">
    <section class="sn-bloc"><h3>Par rôle</h3>
      <ul class="sn-roles">${r.roles.map(x => html`<li key=${x.role}><span class="sn-roles-l">${ROLES_SN[x.role] || x.role}</span><${Bar} value=${x.part || 0}/>
        <span class="small"><b>${x.part === null ? '–' : pct(x.part)}</b></span><span class="small muted">${`${x.avecTel} sur ${x.membres}`}</span></li>`)}</ul></section>
    <section class="sn-bloc"><h3>Téléphones</h3>
      <dl class="sn-chiffres">${tel.map(([k, v]) => html`<div key=${k}><dt>${k}</dt><dd>${v}</dd></div>`)}</dl></section>
    ${r.services.length ? html`<section class="sn-bloc"><h3>Services de notification</h3>
      <ul class="sn-services">${r.services.map(x => html`<li key=${x.cle}><span>${x.nom}</span><b>${x.n}</b></li>`)}</ul></section>` : null}
    <section class="sn-bloc"><h3>Par jour</h3>
      <table class="sn-table"><thead><tr><th scope="col">Jour</th><th scope="col">Arrivées</th><th scope="col">Perdues</th><th scope="col">Coupées</th></tr></thead>
        <tbody>${r.jours.map(j => html`<tr key=${j.jour}><th scope="row">${j.long}</th><td>${j.arrivees}</td><td>${j.perdues}</td><td>${j.coupees}</td></tr>`)}</tbody></table></section>
    ${r.types.length ? html`<section class="sn-bloc"><h3>Par type</h3>
      <table class="sn-table"><thead><tr><th scope="col">Type</th><th scope="col">Arrivées</th><th scope="col">Perdues</th><th scope="col">Coupées</th></tr></thead>
        <tbody>${r.types.map(x => html`<tr key=${x.kind}><th scope="row">${x.nom}${x.connu ? null : html` <span class="small muted" translate="no">${x.kind}</span>`}</th><td>${x.arrivees}</td><td>${x.perdues}</td><td>${x.coupees}</td></tr>`)}</tbody></table></section>` : null}
    <section class="sn-bloc"><h3>Fonctionnement</h3>
      <dl class="sn-fonct">${fonct.map(([k, v]) => html`<div key=${k}><dt>${k}</dt><dd>${v}</dd></div>`)}</dl></section>
  </div>`;
}

// Arabe : les nombres s'accordent (1, 2, 3 à 10, 11 et plus) ; au génitif après « إرسال », « منذ »… ; à l'accusatif en complément
const NOTIFS_N = ['إشعار واحد', 'إشعاران', 'إشعارات', 'إشعارًا'], NOTIFS_G = ['إشعار واحد', 'إشعارين', 'إشعارات', 'إشعارًا'];
const NOTIFS_A = ['إشعارًا واحدًا', 'إشعارين', 'إشعارات', 'إشعارًا']; // complément d'objet
const TELS_N = ['هاتف واحد', 'هاتفان', 'هواتف', 'هاتفًا'], MEMBRES_SN = ['عضو واحد', 'عضوان', 'أعضاء', 'عضوًا'];
const ENVOIS_N = ['محاولة إرسال واحدة', 'محاولتا إرسال', 'محاولات إرسال', 'محاولة إرسال'];
const DUREES_G = { min: ['دقيقة واحدة', 'دقيقتين', 'دقائق', 'دقيقة'], h: ['ساعة واحدة', 'ساعتين', 'ساعات', 'ساعة'], jours: ['يوم واحد', 'يومين', 'أيام', 'يومًا'] };
const depuisAR = (n, u) => `منذ ${arCount(n, DUREES_G[u] || DUREES_G.min)}`;
const TACHE_AR = 'المهمة الدورية (كل دقيقة)';
addAR({
  'Santé des notifications': 'صحة الإشعارات', 'Actualiser': 'تحديث', 'Actualisation…': 'جارٍ التحديث…',
  'Ce panneau apparaît après la mise à jour du serveur.': 'تظهر هذه اللوحة بعد تحديث الخادم.',
  'notifications reçues cette semaine': 'إشعارات وصلت هذا الأسبوع', 'notification reçue cette semaine': 'إشعار وصل هذا الأسبوع',
  'aucune perdue': 'لم يضع أي إشعار', 'Aucune notification cette semaine': 'لا إشعارات هذا الأسبوع',
  'Les 7 derniers jours': 'آخر 7 أيام', 'Arrivées': 'الواصلة', 'Perdues': 'الضائعة', 'Coupées': 'الموقوفة',
  'Aucune notification ces 7 derniers jours.': 'لا إشعارات خلال آخر 7 أيام.',
  'Pourquoi certaines n’arrivent pas': 'لماذا لا تصل بعض الإشعارات',
  'Des totaux sur 7 jours, sans aucun nom ni contenu.': 'مجاميع على مدى 7 أيام، دون أي اسم أو محتوى.',
  // Pourquoi (raisonsNotifs)
  'La fonction notifier refuse les appels de la base (erreur 401) : désactive « Verify JWT » dans Supabase (Edge Functions > notifier > Details).': 'ترفض دالة notifier طلبات قاعدة البيانات (الخطأ 401): عطّل «Verify JWT» في Supabase (Edge Functions > notifier > Details).',
  'La fonction notifier est introuvable (erreur 404) : déploie-la dans Supabase (Edge Functions).': 'دالة notifier غير موجودة (الخطأ 404): انشرها في Supabase (Edge Functions).',
  'Le dernier appel à la fonction notifier n’a pas abouti (délai dépassé ou réseau) : la base réessaie toute seule chaque minute.': 'لم يكتمل آخر طلب لدالة notifier (انتهت المهلة أو مشكلة في الشبكة): تعيد قاعدة البيانات المحاولة تلقائيًا كل دقيقة.',
  'La tâche de chaque minute n’existe pas dans la base : active pg_cron (Database > Extensions), puis relance supabase/mise-a-jour.sql.': `${TACHE_AR} غير موجودة في قاعدة البيانات: فعّل pg_cron (Database > Extensions)، ثم أعد تشغيل supabase/mise-a-jour.sql.`,
  'La tâche de chaque minute a échoué à son dernier passage : regarde Logs > Postgres dans Supabase.': `فشلت ${TACHE_AR} في آخر تشغيل لها: راجع Logs > Postgres في Supabase.`,
  'La tâche de chaque minute n’a encore jamais tourné : vérifie pg_cron dans Supabase (Database > Cron).': `لم تشتغل ${TACHE_AR} بعد: تحقّق من pg_cron في Supabase (Database > Cron).`,
  'Rien ne s’est perdu cette semaine.': 'لم يضع أي إشعار هذا الأسبوع.', 'Aucune notification n’est partie cette semaine.': 'لم يُرسَل أي إشعار هذا الأسبوع.',
  // Détail
  'Par rôle': 'حسب الدور', 'Téléphones': 'الهواتف', 'Téléphones abonnés': 'الهواتف المسجَّلة', 'Ont affiché une notification en 24 h': 'عرضت إشعارًا خلال 24 ساعة',
  'Ont affiché une notification en 7 jours': 'عرضت إشعارًا خلال 7 أيام', 'Sans confirmation': 'دون تأكيد', 'En refus': 'في حالة رفض', 'Retirés cette semaine': 'أُزيلت هذا الأسبوع',
  'Services de notification': 'خدمات الإشعارات', 'Chrome et Android (Google)': 'Chrome وAndroid (Google)', 'iPhone et Mac (Apple)': 'iPhone وMac (Apple)',
  'Firefox (Mozilla)': 'Firefox (Mozilla)', 'Edge (Windows)': 'Edge (Windows)', 'Autre service': 'خدمة أخرى',
  'Par jour': 'حسب اليوم', 'Par type': 'حسب النوع', 'Fonctionnement': 'طريقة العمل',
  'File d’attente': 'قائمة الانتظار', 'Vide : tout est parti': 'فارغة: أُرسل كل شيء',
  'Tâche de chaque minute, dernier passage': `${TACHE_AR}، آخر تشغيل`, 'Illisible ici (pg_cron absent ou fermé à la lecture)': 'غير مقروءة هنا (pg_cron غير موجود أو مغلق أمام القراءة)',
  'Absente de la base': 'غير موجودة في قاعدة البيانات', 'Pas encore lancée': 'لم تشتغل بعد',
  'Passage réussi': 'تشغيل ناجح', 'Passage échoué': 'تشغيل فاشل', 'Passage terminé': 'تشغيل منتهٍ',
  'Fonction notifier, dernier appel': 'دالة notifier، آخر طلب', 'Pas encore appelée (ou pg_net illisible)': 'لم تُستدعَ بعد (أو pg_net غير مقروء)',
  'Délai dépassé': 'انتهت المهلة', 'Pas de réponse (réseau)': 'لا رد (الشبكة)',
  // Les types de notification (NOMS_NOTIF) et leurs catégories
  'Réponse à un entretien': 'رد على مقابلة', 'Rappel d’entretien': 'تذكير بمقابلة',
  'Intérêt reçu': 'اهتمام وارد', 'Match du jour': 'توافق اليوم', 'Demande ouverte à tous': 'طلب مفتوح للجميع', 'Proposition d’aide': 'اقتراح مساعدة',
  'Aide acceptée': 'مساعدة مقبولة', 'Demande rouverte': 'طلب أُعيد فتحه', 'Suite d’une candidature': 'مستجدّ ترشيح',
  'Invitation à postuler': 'دعوة للترشح', 'Recrutement à confirmer': 'توظيف في انتظار التأكيد', 'Recrutement confirmé': 'توظيف مؤكَّد', 'Relance d’une offre': 'تذكير بعرض',
  'Demande de mentorat': 'طلب إرشاد', 'Mentorat ouvert à tous': 'إرشاد مفتوح للجميع', 'Mentorat déplacé': 'إرشاد بموعد جديد',
  'Mentorat annulé': 'إرشاد ملغى', 'Rappel de rendez-vous': 'تذكير بموعد', 'Merci reçu': 'شكر وارد',
  'Relecture de CV demandée': 'طلب مراجعة سيرة ذاتية', 'Relecture de CV prise': 'مراجعة سيرة ذاتية قيد الإنجاز', 'Relecture de CV rendue': 'مراجعة سيرة ذاتية منجزة',
  'Coordonnées demandées': 'طلب معلومات الاتصال', 'Coordonnées partagées': 'معلومات اتصال مشتركة', 'Nouveau filleul': 'طالب جديد في الرعاية', 'Nouveau parrain': 'عرّاب جديد',
  'Nouvelle offre': 'عرض جديد', 'Rappel du soir': 'تذكير المساء', 'Réponse à une question': 'جواب على سؤال', 'Question à toi': 'سؤال موجَّه إليك',
  'Événement annulé': 'حدث ملغى', 'Événement déplacé': 'حدث بموعد جديد',
  'Vérification par la promo': 'تحقق من طرف الدفعة', 'Camarade à confirmer': 'زميل في انتظار التأكيد', 'Réaction': 'تفاعل', 'Nouveau de la promo': 'عضو جديد في الدفعة',
  'Commentaire sur une offre': 'تعليق على عرض', 'Annonce': 'إعلان', 'Signalement': 'تبليغ', 'Essai (Tester)': 'تجربة (زر «تجربة»)',
  'Candidatures': 'الترشيحات', 'Vie du réseau': 'حياة الشبكة', 'Rappels': 'التذكيرات',
}, [
  [/^(\d+)\s?% des membres reçoivent les notifications$/, x => `${x}% من الأعضاء يتلقّون الإشعارات`],
  [/^(\d+) membres? sur (\d+) (?:a|ont) activé les notifications sur au moins un téléphone\.$/, (a, b) => `${arCount(a, MEMBRES_SN)} من أصل ${b} ${+a === 1 ? 'فعّل' : +a === 2 ? 'فعّلا' : 'فعّلوا'} الإشعارات على هاتف واحد على الأقل.`],
  [/^(\d+) perdues? sur (\d+)$/, (a, b) => `${a} ضائعة من أصل ${b}`],
  [/^(\d{1,2}) (\S+) : (\d+) arrivées?, (\d+) perdues?$/, (j, m, a, x) => `${j} ${m}: ${a} واصلة، ${x} ضائعة`],
  [/^(\d+) arrivées? · (\d+) perdues?$/, (a, x) => `${a} واصلة · ${x} ضائعة`],
  [/^La fonction notifier a répondu par une erreur au dernier appel \(erreur (\d+)\) : regarde ses Logs dans Supabase \(Edge Functions > notifier > Logs\)\.$/,
    c => `أجابت دالة notifier بخطأ في آخر طلب (الخطأ ${c}): راجع سجلاتها في Supabase (Edge Functions > notifier > Logs).`],
  [/^La tâche de chaque minute n’a pas tourné depuis (\d+) (min|h|jours) : vérifie pg_cron dans Supabase \(Database > Cron\)\.$/,
    (n, u) => `لم تشتغل ${TACHE_AR} ${depuisAR(n, u)}: تحقّق من pg_cron في Supabase (Database > Cron).`],
  [/^(\d+) notifications? attend(?:ent)? depuis (\d+) (min|h|jours) au lieu de partir tout de suite : la tâche de chaque minute ou la fonction notifier est bloquée \(voir Fonctionnement, dans le détail\)\.$/,
    (n, d, u) => `${arCount(n, NOTIFS_N)} في الانتظار ${depuisAR(d, u)} بدل الإرسال الفوري: ${TACHE_AR} أو دالة notifier متوقفة (انظر «طريقة العمل» في التفاصيل).`],
  [/^(\d+) notifications? (?:a|ont) été écartées? par le serveur \(type inconnu\) : un défaut à signaler\.$/, n => `استبعد الخادم ${arCount(n, NOTIFS_A)} (نوع غير معروف): خلل يجب التبليغ عنه.`],
  [/^(\d+) notifications? n’(?:a|ont) pas pu partir : le membre n’a activé les notifications sur aucun téléphone \(ses emails l’invitent à le faire\)\.$/,
    n => `تعذّر إرسال ${arCount(n, NOTIFS_G)}: لم يفعّل العضو الإشعارات على أي هاتف (رسائل البريد التي تصله تدعوه إلى ذلك).`],
  [/^(\d+) notifications? (?:a|ont) été refusées? par le téléphone \(application désinstallée, téléphone changé ou autorisation retirée\)\. Un téléphone qui refuse est retiré : le membre devra réactiver les notifications\.$/,
    n => `رفض الهاتف ${arCount(n, NOTIFS_A)} (تطبيق محذوف، أو هاتف جديد، أو إذن مسحوب). يُزال الهاتف الذي يرفض: سيحتاج العضو إلى إعادة تفعيل الإشعارات.`],
  [/^(\d+) notifications? (?:a|ont) été abandonnées? après 3 essais ou un jour d’attente : le service du téléphone ne répondait pas\.$/,
    n => `توقفت محاولة إرسال ${arCount(n, NOTIFS_G)} بعد 3 محاولات أو يوم من الانتظار: لم تكن خدمة الهاتف تستجيب.`],
  [/^(\d+) téléphones? accepte(?:nt)? les notifications sans confirmer les afficher : économie d’énergie, notifications du navigateur coupées, ou ancienne version de l’application\.$/,
    n => `${arCount(n, TELS_N)} ${+n === 1 ? 'يقبل' : +n === 2 ? 'يقبلان' : 'تقبل'} الإشعارات دون تأكيد عرضها: وضع توفير الطاقة، أو إشعارات المتصفح متوقفة، أو نسخة قديمة من التطبيق.`],
  [/^(\d+) notifications? n’(?:a|ont) pas été envoyées? : le membre a coupé ce type dans Mon profil\. C’est son choix\.$/,
    n => `لم يُرسَل ${arCount(n, NOTIFS_N)}: أوقف العضو هذا النوع في ملفه الشخصي. هذا اختياره.`],
  [/^(\d+) envois? (?:a|ont) échoué un moment \(service du téléphone injoignable\), puis (?:a|ont) été réessayés?\.$/,
    n => `فشلت ${arCount(n, ENVOIS_N)} مؤقتًا (خدمة الهاتف غير متاحة)، ثم أُعيدت المحاولة.`],
  [/^(\d+) en attente · la plus ancienne depuis (\d+) (min|h|jours)$/, (n, d, u) => `${n} في الانتظار · أقدمها ${depuisAR(d, u)}`],
  [/^Réponse (\d{3})$/, c => `الرد ${c}`],
]);

injectCSS('sante-notifs', `
/* Santé des notifications (Vue d'ensemble) : couleurs du graphique vérifiées (contraste, daltonisme), jour et nuit */
.sn { --sn-ok: #1670A8; --sn-perdu: #B0222E; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .sn { --sn-ok: #3A93CF; --sn-perdu: #D9555F; } }
:root[data-theme="dark"] .sn { --sn-ok: #3A93CF; --sn-perdu: #D9555F; }
.sn .section-head { flex-wrap: nowrap; }
.sn .section-head h2 { min-width: 0; }
.sn-relire { flex: none; }
.sn-attente { display: flex; flex-direction: column; gap: .75rem; }
.sn-attente .squelette { padding: 0; }
.sn-absent, .sn-erreur { margin: 0; }
.sn-reessayer { align-self: flex-start; }
.sn-haut { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap: .9rem 1.4rem; }
.sn-stat { display: flex; align-items: center; gap: .85rem; min-width: 0; }
.sn-stat-txt { display: flex; flex-direction: column; gap: .15rem; min-width: 0; }
.sn-phrase { font: 650 var(--fs-4)/1.3 var(--f-display); color: var(--ink); }
.sn-pct { font: 750 var(--fs-4)/1 var(--f-display); }
.sn-pct small { font-size: .68em; font-weight: 650; }
.sn-grand { flex: none; min-inline-size: 64px; text-align: center; font: 750 2rem/1 var(--f-display); font-variant-numeric: tabular-nums; letter-spacing: -.01em; color: var(--ink); }
/* Le graphique : la légende au-dessus, une colonne par jour (24 px au plus, coins ronds en haut, base droite) */
.sn-graphe { margin: 0; display: flex; flex-direction: column; gap: .45rem; padding: .8rem .9rem .55rem; border-radius: var(--r-md); background: var(--surface-2); }
.sn-graphe-tete { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .25rem .8rem; }
.sn-graphe-titre { font-weight: 600; font-size: var(--fs-2); color: var(--ink-2); }
.sn-legende { display: inline-flex; flex-wrap: wrap; gap: .2rem .8rem; font-size: var(--fs-2); color: var(--ink-2); }
.sn-cle { display: inline-flex; align-items: center; gap: .35rem; }
.sn-pastille { display: inline-block; inline-size: 10px; block-size: 10px; border-radius: 3px; background: var(--sn-ok); }
.sn-pastille.perdu { background: var(--sn-perdu); }
.sn-plot { position: relative; block-size: 116px; border-block-end: 1px solid var(--line-strong); }
.sn-plot::before { content: ""; position: absolute; inset-inline: 1.6rem 0; inset-block-start: 1.1rem; border-block-start: 1px solid var(--line); }
.sn-echelle { position: absolute; inset-block-start: calc(1.1rem - .45em); inset-inline-start: 0; font-size: var(--fs-1); line-height: 1; color: var(--muted); font-variant-numeric: tabular-nums; }
.sn-cols, .sn-jours { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; margin-inline-start: 1.6rem; }
.sn-cols { position: absolute; inset: 1.1rem 0 0; }
.sn-col { position: relative; display: flex; align-items: flex-end; justify-content: center; min-width: 0; border-radius: var(--r-sm) var(--r-sm) 0 0; outline: none; cursor: default; }
.sn-col:hover { background: color-mix(in srgb, var(--ink) 5%, transparent); }
.sn-col:focus-visible { box-shadow: var(--anneau-focus); }
.sn-pile { display: flex; flex-direction: column; gap: 2px; inline-size: min(24px, 64%); min-block-size: 2px; }
.sn-seg { flex: 1 1 0; min-block-size: 2px; background: var(--sn-ok); }
.sn-seg.perdu { background: var(--sn-perdu); }
.sn-pile > .sn-seg:first-child { border-start-start-radius: 4px; border-start-end-radius: 4px; }
.sn-jours { font-size: var(--fs-1); color: var(--muted); text-align: center; font-variant-numeric: tabular-nums; }
.sn-vide { margin: .2rem 0; }
/* L'infobulle : seulement au survol ou au clavier, jamais hors de l'écran (les colonnes du bord s'alignent sur le bord) */
.sn-bulle { display: none; position: absolute; z-index: 3; inset-block-end: calc(100% + 6px); left: 50%; transform: translateX(-50%);
  flex-direction: column; gap: .1rem; padding: .4rem .6rem; border-radius: var(--r-sm); background: var(--raised); box-shadow: var(--sh3);
  font-size: var(--fs-2); line-height: 1.35; color: var(--ink); white-space: nowrap; pointer-events: none; }
.sn-col.debut .sn-bulle { left: auto; right: auto; inset-inline-start: 0; transform: none; }
.sn-col.fin .sn-bulle { left: auto; right: auto; inset-inline-end: 0; transform: none; }
.sn-col:hover .sn-bulle, .sn-col:focus-visible .sn-bulle { display: flex; }
.sn-bulle b { font-weight: 650; }
/* Pourquoi : une phrase par cause, son icône teintée selon ce qu'elle demande (à régler, à surveiller, normal) */
.sn-raisons h3 { margin: 0 0 .4rem; font-size: var(--fs-3); }
.sn-raisons ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .55rem; }
.sn-r { display: flex; align-items: flex-start; gap: .6rem; font-size: var(--fs-3); line-height: 1.45; color: var(--ink); }
.sn-r > span:last-child { min-width: 0; overflow-wrap: anywhere; }
.sn-r-ico { flex: none; display: inline-grid; place-items: center; inline-size: 28px; block-size: 28px; border-radius: 9px; background: var(--surface-2); color: var(--muted); }
.sn-r.t-bad .sn-r-ico { background: var(--bad-soft); color: var(--bad); }
.sn-r.t-warn .sn-r-ico { background: var(--warn-soft); color: var(--warn); }
.sn-r.t-bien .sn-r-ico { background: var(--good-soft); color: var(--good); }
/* Ce qui n'est pas une perte (catégorie coupée par le membre, envoi réessayé) : plus discret */
.sn-r.t-note { font-size: var(--fs-2); color: var(--ink-2); }
.sn-r.t-note .sn-r-ico { inline-size: 24px; block-size: 24px; border-radius: 8px; margin-inline: 2px; background: transparent; }
/* Le détail, replié */
.sn-detail { border-top: 1px solid var(--line); padding-top: .2rem; }
.sn-detail > summary { display: inline-flex; align-items: center; gap: .35rem; min-height: 44px; padding: .3rem .1rem; cursor: pointer; list-style: none; font-weight: 600; color: var(--tonal-ink); }
.sn-detail > summary::-webkit-details-marker { display: none; }
.sn-detail > summary .ico { transition: transform .2s var(--ease); }
.sn-detail[open] > summary .ico { transform: rotate(180deg); }
@media (prefers-reduced-motion: reduce) { .sn-detail > summary .ico { transition: none; } }
.sn-detail-corps { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 1.1rem 1.6rem; padding: .4rem 0 .3rem; }
.sn-bloc { display: flex; flex-direction: column; gap: .45rem; min-width: 0; }
.sn-bloc h3 { margin: 0; font-size: var(--fs-3); }
.sn-roles { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: auto minmax(50px, 1fr) auto auto; gap: .45rem .7rem; align-items: center; }
.sn-roles li { display: contents; }
.sn-roles-l { font-weight: 600; font-size: var(--fs-2); }
.sn-chiffres, .sn-fonct { margin: 0; display: flex; flex-direction: column; }
.sn-chiffres > div, .sn-fonct > div { display: flex; justify-content: space-between; align-items: baseline; gap: .8rem; padding: .35rem 0; border-bottom: 1px solid var(--line); }
.sn-chiffres dt, .sn-fonct dt { font-size: var(--fs-2); color: var(--ink-2); min-width: 0; }
.sn-chiffres dd { margin: 0; font-weight: 650; font-variant-numeric: tabular-nums; }
.sn-fonct > div { flex-direction: column; align-items: stretch; gap: .1rem; }
.sn-fonct dd { margin: 0; font-size: var(--fs-3); }
.sn-services { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.sn-services li { display: flex; justify-content: space-between; gap: .8rem; padding: .35rem 0; border-bottom: 1px solid var(--line); font-size: var(--fs-2); }
.sn-services b { font-variant-numeric: tabular-nums; }
.sn-table { inline-size: 100%; border-collapse: collapse; font-size: var(--fs-2); }
.sn-table th, .sn-table td { padding: .32rem .4rem; border-bottom: 1px solid var(--line); text-align: end; }
.sn-table thead th { color: var(--muted); font-weight: 600; }
.sn-table th[scope="row"], .sn-table thead th:first-child { text-align: start; font-weight: 500; color: var(--ink); overflow-wrap: anywhere; }
.sn-table thead th:first-child { color: var(--muted); font-weight: 600; }
.sn-table td { font-variant-numeric: tabular-nums; white-space: nowrap; }
.sn-pied { margin: 0; }
`);

// ---------------------------------------------------------------------------
// Modération : les signalements, regroupés par contenu
// ---------------------------------------------------------------------------
export const MOTIFS = { spam: 'Spam', arnaque: 'Arnaque', inapproprie: 'Inapproprié', faux: 'Faux ou trompeur', harcelement: 'Harcèlement', donnees: 'Données personnelles', autre: 'Autre' };
const TYPES_CIBLE = { offre: ['Offre', 'feed'], commentaire: ['Commentaire', 'comment'], question: ['Question', 'qa'], reponse: ['Réponse', 'qa'], message: ['Message de groupe', 'people'], profil: ['Profil', 'user'], entretien: ['Entretien', 'briefcase'], avis: ['Avis de stage', 'star'], guide: ['Guide de l’étranger', 'flag'], cafe: ['Café ENSAM', 'clap'], startup: ['Startup', 'spark'], relecture: ['Relecture de CV', 'eye'], prive: ['Message privé', 'chat'], demande: ['Demande d’étudiant', 'send'], reponse_demande: ['Réponse à une demande', 'comment'] };
const court = (t, n = 220) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const nomGroupe = g => String(g || '').split(':').slice(1).join(':');

// Ce que l'administration voit du contenu signalé, et ce qu'elle peut en faire (selon les règles de la base)
function cible(ctx, type, id) {
  const { store, openOffer, openProfile, go } = ctx;
  const by = t => store.byId(t, id);
  const rm = t => () => store.remove(t, id);
  switch (type) {
    case 'offre': { const r = by('offers'); return r && { r, titre: `${r.titre} · ${r.entreprise}`, texte: r.description, auteur: r.author_id, voir: ['Ouvrir', () => openOffer(id)], actions: [r.status === 'ouverte' ? ['Masquer l’offre', () => store.update('offers', id, { status: 'fermee' })] : null, ['Supprimer l’offre', rm('offers'), true]].filter(Boolean) }; }
    case 'commentaire': { const r = by('comments'); const o = r && store.byId('offers', r.offer_id); return r && { r, titre: o ? `${o.titre} · ${o.entreprise}` : '', texte: r.body, auteur: r.author_id, voir: o ? ['Ouvrir', () => openOffer(o.id)] : null, actions: [['Supprimer le commentaire', rm('comments'), true]] }; }
    case 'question': { const r = by('questions'); return r && { r, titre: r.titre, texte: r.body, auteur: r.author_id, voir: ['Voir la question', () => go('reseau/entraide/' + id)], actions: [['Supprimer la question', rm('questions'), true]] }; }
    case 'reponse': { const r = by('answers'); const q = r && store.byId('questions', r.question_id); return r && { r, titre: q?.titre || '', texte: r.body, auteur: r.author_id, voir: q ? ['Voir la question', () => go('reseau/entraide/' + q.id)] : null, actions: [['Supprimer la réponse', rm('answers'), true]] }; }
    case 'message': { const r = by('groupe_messages'); return r && { r, titre: nomGroupe(r.groupe), texte: r.body, auteur: r.author_id, actions: [['Supprimer le message', rm('groupe_messages'), true]] }; }
    case 'profil': { const r = by('profiles'); return r && { r, photo: r.photo_path ? r : null, titre: r.full_name, texte: [r.role === 'laureat' ? `Promo ${r.promo}` : r.filiere, r.entreprise, r.bio].filter(Boolean).join(' · '), auteur: null, voir: ['Voir le profil', () => openProfile(r)],
      actions: [...(r.photo_path ? [['Retirer la photo', () => store.retirerPhoto(r), true]] : []), ...(r.role === 'laureat' && r.verified ? [['Retirer le badge vérifié', () => store.update('profiles', id, { verified: false }), true]] : [])] }; }
    case 'entretien': { const r = by('entretiens'); return r && { r, titre: [r.entreprise, r.poste].filter(Boolean).join(' · '), texte: [...(r.questions || []), r.deroulement, r.conseils].filter(Boolean).join(' · '), auteur: r.author_id, actions: [['Supprimer l’entretien', rm('entretiens'), true]] }; }
    case 'avis': { const r = by('avis_stage'); return r && { r, titre: [r.entreprise, r.ville].filter(Boolean).join(' · '), texte: r.conseils, auteur: r.author_id, actions: [['Supprimer l’avis', rm('avis_stage'), true]] }; }
    case 'guide': { const r = by('guide_pays'); const s = r && GUIDE_SECTIONS.find(x => x[0] === r.section); return r && { r, titre: `${r.pays}${s ? ' · ' + s[1] : ''}`, texte: r.contenu, auteur: r.updated_by, actions: [['Supprimer la rubrique', rm('guide_pays'), true]] }; }
    case 'cafe': { const r = by('cafes'); return r && { r, titre: `${r.ville} · ${r.lieu}`, texte: r.message, auteur: r.organisateur_id, actions: r.annule ? [] : [['Annuler le café', () => store.update('cafes', id, { annule: true }), true]] }; }
    case 'startup': { const r = by('startups'); return r && { r, titre: r.nom, texte: r.pitch, auteur: r.fondateur_id, actions: [['Retirer la startup', rm('startups'), true]] }; }
    case 'demande': { const r = by('demandes'); return r && { r, titre: r.titre, texte: r.details, auteur: r.auteur_id, voir: ['Voir la demande', () => go('offres/demandes/' + id)], actions: ['ouverte', 'match'].includes(r.status) ? [['Retirer la demande', () => store.update('demandes', id, { status: 'fermee' }), true]] : [] }; }
    case 'reponse_demande': { const r = by('reponses_demandes'); const d = r && store.byId('demandes', r.demande_id); return r && { r, titre: d?.titre || '', texte: r.body, auteur: r.author_id, voir: d ? ['Voir la demande', () => go('offres/demandes/' + d.id)] : null, actions: [['Supprimer la réponse', rm('reponses_demandes'), true]] }; }
    case 'relecture': { const r = by('relectures_cv'); const s = r && store.byId('profiles', r.student_id); return r && { r, titre: s?.full_name || '', texte: r.synthese || r.message, auteur: r.reviewer_id, actions: r.status === 'annulee' ? [] : [['Annuler la relecture', () => store.update('relectures_cv', id, { status: 'annulee' }), true]] }; }
    case 'prive': {
      const r = by('messages'); const nom = x => store.byId('profiles', x)?.full_name || '?';
      // L'onglet s'ouvre tout de suite (sinon le navigateur le bloque), le lien temporaire arrive ensuite
      const ouvrir = async () => { const w = window.open('', '_blank'); if (w) w.opener = null; const u = await store.lienChat(r.fichier).catch(() => null); if (u && w) w.location.href = u; else { w?.close(); toast('Fichier indisponible.', 'err'); } };
      return r && { r, titre: `${nom(r.author_id)} → ${nom(r.dest_id)}`, texte: r.body, auteur: r.author_id, voir: r.fichier ? [r.type === 'vocal' ? 'Écouter le message vocal' : 'Voir la photo', ouvrir] : null, actions: [['Supprimer le message', () => store.supprimerMessage(id), true]] };
    }
    default: return null;
  }
}

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
    <${DernieresOffres} ctx=${ctx}/>
  </div>`;
}

// Les dernières offres publiées, à relire d'un coup d'œil : les masquer ou les supprimer est de la modération
// (sans attendre un signalement), pas un chiffre de la Vue d'ensemble
function DernieresOffres({ ctx }) {
  const { data, store, act } = ctx;
  const offers = [...data.offers].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  if (!offers.length) return null;
  return html`<div class="panel" id="adm-offres"><div class="section-head"><h2 class="h-ico"><${Icon} name="feed"/> Dernières offres</h2></div>
      <ul class="people-list adm-gestes">${offers.map(o => html`<li key=${o.id}><span class="grow"><button class="linkish strong" onClick=${() => ctx.openOffer(o.id)}>${o.titre}</button><br/><span class="muted small">${o.entreprise} · ${store.byId('profiles', o.author_id)?.full_name || ''} · ${timeAgo(o.created_at)}</span></span>
        ${o.status !== 'ouverte' ? html`<span class="tag done">${o.status === 'pourvue' ? 'Pourvue' : 'Fermée'}</span>` : null}
        <button class="btn tiny ghost" onClick=${() => act(() => store.update('offers', o.id, { status: o.status === 'ouverte' ? 'fermee' : 'ouverte' }))}>${o.status === 'ouverte' ? 'Masquer' : 'Rouvrir'}</button>
        <button class="btn tiny ghost danger-t" onClick=${() => ctx.confirm('Supprimer cette offre ?', () => act(() => store.remove('offers', o.id)))}>Supprimer</button></li>`)}</ul></div>`;
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

// Message prêt à envoyer au lauréat sans CV, dans sa langue ; l'administration le relit avant d'envoyer
const demandeCV = p => {
  const prenom = (p.full_name || '').split(' ')[0];
  return p.langue === 'ar'
    ? `مرحبًا ${prenom}، أهلًا بك في شبكة ENSAM مكناس! للتحقق من ملفك، هل يمكنك رفع سيرتك الذاتية بصيغة PDF في « ملفي » (أو إضافة رابط LinkedIn)؟ لن يستغرق ذلك سوى دقيقة. شكرًا!`
    : `Bonjour ${prenom}, bienvenue sur le Réseau ENSAM Meknès ! Pour vérifier ton profil, peux-tu déposer ton CV en PDF dans « Mon profil » (ou ajouter ton lien LinkedIn) ? Ça prend une minute. Merci !`;
};

function Membres({ ctx, comptes, toVerify }) {
  const { data, store, act, openProfile, saison } = ctx;
  const [q, setQ] = useState('');
  const liste = useListe(store, data);
  const compte = new Map((comptes || []).map(c => [c.id, c]));
  const sansProfil = (comptes || []).filter(c => !c.a_profil && compteOuvert(c));
  const members = data.profiles.filter(p => p.role !== 'admin');
  const qq = q.trim().toLowerCase();
  const list = members.filter(p => !qq || `${p.full_name} ${p.filiere} ${p.promo} ${p.entreprise || ''} ${compte.get(p.id)?.email || ''}`.toLowerCase().includes(qq))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const { vus: shown, reste, plus } = useVoirPlus(list, 20, qq);
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

    <div class="panel">
      <div class="section-head"><h2 class="h-ico"><${Icon} name="people"/> Membres</h2>
        <label class="search"><${Icon} name="search" size=${16}/><input id="adm-q" placeholder="Nom, email, filière, promo…" value=${q} onInput=${e => setQ(e.target.value)}/></label></div>
      ${sansProfil.length ? html`<p class="small hint-box"><${Icon} name="user" size=${15}/> <span>${sansProfil.length} compte${sansProfil.length > 1 ? 's' : ''} créé${sansProfil.length > 1 ? 's' : ''} sans profil (inscription pas terminée) : <span class="mono" dir="ltr" translate="no">${sansProfil.slice(0, 5).map(c => c.email).join(', ')}</span></span></p>` : null}
      <p class="liste-tete">${qq ? `${list.length} sur ${members.length} membres` : `${members.length} membre${members.length > 1 ? 's' : ''}`}</p>
      <ul class="lignes member-list">${shown.map(p => { const c = compte.get(p.id); return html`<li key=${p.id} class="ligne">
        <${Person} p=${p} onOpen=${openProfile} size=${40} sub=${html`<span class="ligne-sub">${p.role === 'etudiant' ? `${NIVEAUX[niveauOf(p, saison)]?.short || ''} · ${p.filiere} · promo ${p.promo}` : `${p.filiere} · Promo ${p.promo}`}</span>
          <span class="ligne-sub member-meta">${c ? html`<span dir="ltr" translate="no">${c.email}</span> · ` : null}<span>Inscrit ${timeAgo(p.created_at)}</span>${c?.last_sign_in_at ? html` · <span>Vu ${timeAgo(c.last_sign_in_at)}</span>` : null}</span>`}/>
        <span class="ligne-act"><select id=${'role-' + p.id} aria-label="Rôle" value=${p.role} onChange=${e => act(async () => { await store.update('profiles', p.id, { role: e.target.value }); toast('Rôle modifié.'); })}>${ROLES.map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select></span>
      </li>`; })}</ul>
      <${VoirPlus} reste=${reste} onPlus=${plus}/>
    </div>`;
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

function telecharger(nom, lignes) {
  const q = v => (/[";\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + lignes.map(r => r.map(q).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = nom; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

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
