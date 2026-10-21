// Administration, par onglets : vue d'ensemble (chiffres, annonce, défis, parrains, recrutements, offres),
// modération des signalements, membres (rôle, vérification), liste officielle des étudiants,
// liens d'invitation par promo, agenda de l'école et réglages (email de l'école).
import { html, useState, useEffect, useMemo } from './vendor/preact-htm.js';
import { Icon, Field, Person, Num, Empty, Bar, toast, injectCSS } from './ui.js';
import { addAR } from './i18n.js';
import { NIVEAUX, niveauOf, timeAgo, mentorState, cleNom, norm, GUIDE_SECTIONS, pct } from './logic.js';
import { DefisAdmin } from './saison.js';
import { AgendaAdmin } from './agenda.js';
import { InvitationsAdmin } from './invitation.js';

addAR({
  'Vue d’ensemble': 'نظرة عامة', 'Modération': 'الإشراف', 'Liste officielle': 'اللائحة الرسمية', 'Réglages': 'الإعدادات', 'Agenda': 'المفكرة',
  'À traiter': 'للمعالجة', 'Signalements': 'التبليغات', 'Tout est à jour.': 'كل شيء محيَّن.',
  // Modération
  'Offre': 'عرض', 'Commentaire': 'تعليق', 'Question': 'سؤال', 'Réponse': 'جواب', 'Message de groupe': 'رسالة في مجموعة', 'Message privé': 'رسالة خاصة', 'Voir la photo': 'عرض الصورة', 'Fichier indisponible.': 'الملف غير متاح.', 'Profil': 'ملف شخصي',
  'Entretien': 'مقابلة', 'Avis de stage': 'رأي حول تدريب', 'Guide de l’étranger': 'دليل الخارج', 'Café ENSAM': 'مقهى ENSAM', 'Startup': 'شركة ناشئة', 'Relecture de CV': 'مراجعة سيرة ذاتية',
  'Spam': 'رسائل مزعجة', 'Arnaque': 'احتيال', 'Inapproprié': 'غير لائق', 'Faux ou trompeur': 'خاطئ أو مضلل', 'Harcèlement': 'تحرش', 'Données personnelles': 'معطيات شخصية', 'Autre': 'آخر',
  'Rien à modérer': 'لا شيء للإشراف', 'Quand un membre signale un contenu, il apparaît ici. Tu décides de le retirer ou de le garder.': 'عندما يبلّغ عضو عن محتوى، يظهر هنا. تقرر حذفه أو إبقاءه.',
  'Contenu déjà supprimé': 'المحتوى حُذف من قبل', 'Clore': 'إغلاق', 'Classer sans suite': 'حفظ دون متابعة', 'Marquer traité': 'تحديد كمُعالج',
  'Masquer l’offre': 'إخفاء العرض', 'Supprimer l’offre': 'حذف العرض', 'Supprimer le commentaire': 'حذف التعليق', 'Supprimer la question': 'حذف السؤال',
  'Supprimer la réponse': 'حذف الجواب', 'Supprimer le message': 'حذف الرسالة', 'Retirer le badge vérifié': 'سحب شارة التحقق', 'Supprimer l’entretien': 'حذف المقابلة',
  'Supprimer l’avis': 'حذف الرأي', 'Supprimer la rubrique': 'حذف الفقرة', 'Annuler le café': 'إلغاء المقهى', 'Retirer la startup': 'سحب الشركة الناشئة', 'Annuler la relecture': 'إلغاء المراجعة',
  'Ouvrir': 'فتح', 'Voir le profil': 'عرض الملف', 'Voir la question': 'عرض السؤال', 'Historique': 'السجل', 'Traité': 'تمت معالجته', 'Sans suite': 'دون متابعة',
  'Contenu retiré et signalement clos.': 'حُذف المحتوى وأُغلق التبليغ.', 'Signalement classé sans suite.': 'حُفظ التبليغ دون متابعة.', 'Signalement marqué traité.': 'تم تحديد التبليغ كمُعالج.',
  'Le contenu sera retiré pour tout le monde. Continuer ?': 'سيُحذف المحتوى للجميع. هل تتابع؟',
  'Un membre anonyme': 'عضو مجهول', 'Auteur': 'الكاتب', 'Auteur :': 'الكاتب:', 'Signalé par': 'بلّغ عنه',
  // Membres
  'Vérifie que la personne est bien diplômée de l’ENSAM Meknès (promo, filière), puis valide. Le badge rassure les étudiants. Deux lauréats vérifiés de sa promo peuvent aussi le confirmer.': 'تحقق من أن الشخص خريج ENSAM مكناس (الدفعة، الشعبة)، ثم أكّد. الشارة تطمئن الطلبة. يمكن أيضًا لخريجَين متحقق منهما من دفعته تأكيد ذلك.',
  'Pas trouvé sur la liste officielle de sa promo': 'غير موجود في اللائحة الرسمية لدفعته', 'Sur la liste officielle': 'في اللائحة الرسمية', 'Aucune confirmation de sa promo': 'لا تأكيد من دفعته',
  // Liste officielle
  'Importer la liste': 'استيراد اللائحة', 'Fichier Excel (.xlsx) ou CSV exporté de la scolarité : une ligne par étudiant, avec au moins le nom et la promo.': 'ملف Excel (.xlsx) أو CSV من مصلحة الشؤون الطلابية: سطر لكل طالب، مع الاسم والدفعة على الأقل.',
  'Les inscrits qui figurent sur la liste (même nom et même promo, ou même email) sont vérifiés automatiquement.': 'المسجلون الموجودون في اللائحة (نفس الاسم ونفس الدفعة، أو نفس البريد) يتم التحقق منهم تلقائيًا.',
  'Choisir un fichier': 'اختيار ملف', 'Modèle CSV': 'نموذج CSV', 'Colonnes': 'الأعمدة', 'Nom complet': 'الاسم الكامل', 'Nom': 'الاسم العائلي', 'Prénom': 'الاسم الشخصي',
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
}, [
  [/^Signalé (\d+) fois$/, n => `بُلّغ عنه ${n} مرة`],
  [/^(\d+) signalements? à traiter$/, n => `${n} تبليغ للمعالجة`],
  [/^(\d+) lauréats? à vérifier$/, n => `${n} خريج للتحقق`],
  [/^(\d+)\/2 lauréats de sa promo ont confirmé$/, n => `${n}/2 من خريجي دفعته أكدوا`],
  [/^Importer (\d+) lignes?$/, n => `استيراد ${n} سطر`],
  [/^(\d+) lignes? lisibles? sur (\d+)$/, (a, b) => `${a} سطر صالح من أصل ${b}`],
  [/^(\d+) importées?, (\d+) rejetées?, (\d+) comptes? vérifiés?$/, (a, b, c) => `${a} مستورد، ${b} مرفوض، ${c} حساب تم التحقق منه`],
  [/^(\d+) inscrits sur (\d+)$/, (a, b) => `${a} مسجل من أصل ${b}`],
  [/^Colonne (\d+)$/, n => `العمود ${n}`],
  [/^(\d+) personnes? pas encore inscrites?$/, n => `${n} شخص غير مسجل بعد`],
  [/^Vider la liste de la promo (\d{4}) \? Les comptes déjà vérifiés le restent\.$/, y => `إفراغ لائحة دفعة ${y}؟ تبقى الحسابات المتحقق منها كما هي.`],
]);

const ROLES = [['etudiant', 'Étudiant(e)'], ['laureat', 'Lauréat(e)']];
const TABS = [['', 'Vue d’ensemble', 'chart'], ['moderation', 'Modération', 'flag'], ['membres', 'Membres', 'people'], ['liste', 'Liste officielle', 'file'], ['inviter', 'Inviter', 'send'], ['agenda', 'Agenda', 'calendar'], ['reglages', 'Réglages', 'wrench']];

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
    <header class="page-head"><div><p class="eyebrow">Réservé à l’administration</p><h1>Administration</h1></div></header>
    <div class="icon-tabs adm-tabs" role="tablist" style=${`--n:${TABS.length}`}>${TABS.map(([k, l, i]) => html`<button role="tab" id=${'adm-tab-' + (k || 'vue')} aria-selected=${tab === k} class=${tab === k ? 'on' : ''} onClick=${() => go(k ? 'admin/' + k : 'admin')}><${Icon} name=${i} size=${20}/><span>${l}</span>${dot[k] ? html`<span class="adm-n mono">${dot[k]}</span>` : null}</button>`)}</div>
    ${tab === '' ? html`<${VueEnsemble} ctx=${ctx} comptes=${comptes} ouverts=${ouverts} toVerify=${toVerify}/>` : null}
    ${tab === 'moderation' ? html`<${Moderation} ctx=${ctx}/>` : null}
    ${tab === 'membres' ? html`<${Membres} ctx=${ctx} comptes=${comptes} toVerify=${toVerify}/>` : null}
    ${tab === 'liste' ? html`<${ListeOfficielle} ctx=${ctx}/>` : null}
    ${tab === 'inviter' ? html`<${InvitationsAdmin} ctx=${ctx}/>` : null}
    ${tab === 'agenda' ? html`<${AgendaAdmin} ctx=${ctx}/>` : null}
    ${tab === 'reglages' ? html`<${Reglages} ctx=${ctx}/>` : null}
  </section>`;
}

// ---------------------------------------------------------------------------
// Vue d'ensemble
// ---------------------------------------------------------------------------
function VueEnsemble({ ctx, comptes, ouverts, toVerify }) {
  const { data, store, act, openProfile, saison, go } = ctx;
  const sansProfil = (comptes || []).filter(c => !c.a_profil);
  const week = Date.now() - 7 * 864e5;
  const members = data.profiles.filter(p => p.role !== 'admin');
  const nouveaux = members.filter(p => new Date(p.created_at) > week);
  const openReq = data.mentorships.filter(m => m.status === 'demande');
  const rdv = data.mentorships.filter(m => mentorState(m) === 'rdv').length;
  const confirmes = data.placements.filter(p => p.saison === saison && p.status === 'confirme').length;
  const kpis = [
    ['Membres', members.length, `${members.filter(p => p.role === 'etudiant').length} étudiants · ${members.filter(p => p.role === 'laureat').length} lauréats`],
    ['Nouveaux cette semaine', nouveaux.length, sansProfil.length ? `+ ${sansProfil.length} sans profil` : 'inscriptions des 7 derniers jours'],
    ['Demandes d’aide', openReq.length, `en attente · ${rdv} rendez-vous à venir`],
    ['Recrutés et confirmés', confirmes, 'cette saison, via la plateforme'],
  ];
  const stale = data.placements.filter(p => p.status === 'en_attente').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const offers = [...data.offers].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);
  const todo = [
    ouverts.length ? ['flag', `${ouverts.length} signalement${ouverts.length > 1 ? 's' : ''} à traiter`, 'admin/moderation'] : null,
    toVerify.length ? ['shield', `${toVerify.length} lauréat${toVerify.length > 1 ? 's' : ''} à vérifier`, 'admin/membres'] : null,
  ].filter(Boolean);
  return html`
    <div class="kpis">${kpis.map(([l, v, sub]) => html`<div class="kpi"><span class="kpi-label">${l}</span><span class="kpi-val mono"><${Num} v=${v}/></span><span class="small muted">${sub}</span></div>`)}</div>
    ${todo.length ? html`<div class="callout today"><h2 class="h-ico"><${Icon} name="bell"/> À traiter</h2><ul class="todo">${todo.map(([i, t, r]) => html`<li><button class="notif act" onClick=${() => go(r)}><span class="n-ico accent"><${Icon} name=${i} size=${16}/></span><span>${t}</span><${Icon} name="arrow" size=${16}/></button></li>`)}</ul></div>` : null}

    <${AnnonceBox} ctx=${ctx}/>
    <${DefisAdmin} ctx=${ctx}/>
    <${ParrainsAdmin} ctx=${ctx}/>

    ${stale.length ? html`<div class="panel"><div class="section-head"><h2>Recrutements en attente de l’étudiant <span class="count">${stale.length}</span></h2></div>
      <p class="muted small">Le lauréat a déclaré ces recrutements. Si l’étudiant ne confirme pas, l’administration peut le faire après vérification.</p>
      <ul class="people-list">${stale.map(p => { const s = store.byId('profiles', p.student_id), l = store.byId('profiles', p.laureat_id); return html`<li key=${p.id}><${Person} p=${s} onOpen=${openProfile} sub=${`${p.entreprise} · déclaré par ${l?.full_name || '?'} · ${timeAgo(p.created_at)}`}/><span class="spacer"></span>
        <button class="btn small ghost" onClick=${() => act(() => store.update('placements', p.id, { status: 'refuse' }))}>Refuser</button><button class="btn small primary" onClick=${() => act(() => store.update('placements', p.id, { status: 'confirme' }))}>Confirmer</button></li>`; })}</ul></div>` : null}

    <div class="panel"><div class="section-head"><h2 class="h-ico"><${Icon} name="feed"/> Dernières offres</h2></div>
      <ul class="people-list">${offers.map(o => html`<li key=${o.id}><span class="grow"><button class="linkish strong" onClick=${() => ctx.openOffer(o.id)}>${o.titre}</button><br/><span class="muted small">${o.entreprise} · ${store.byId('profiles', o.author_id)?.full_name || ''} · ${timeAgo(o.created_at)}</span></span>
        ${o.status !== 'ouverte' ? html`<span class="tag done">${o.status === 'pourvue' ? 'Pourvue' : 'Fermée'}</span>` : null}
        <button class="btn tiny ghost" onClick=${() => act(() => store.update('offers', o.id, { status: o.status === 'ouverte' ? 'fermee' : 'ouverte' }))}>${o.status === 'ouverte' ? 'Masquer' : 'Rouvrir'}</button>
        <button class="btn tiny ghost danger-t" onClick=${() => ctx.confirm('Supprimer cette offre ?', () => act(() => store.remove('offers', o.id)))}>Supprimer</button></li>`)}</ul></div>`;
}

// ---------------------------------------------------------------------------
// Modération : les signalements, regroupés par contenu
// ---------------------------------------------------------------------------
export const MOTIFS = { spam: 'Spam', arnaque: 'Arnaque', inapproprie: 'Inapproprié', faux: 'Faux ou trompeur', harcelement: 'Harcèlement', donnees: 'Données personnelles', autre: 'Autre' };
const TYPES_CIBLE = { offre: ['Offre', 'feed'], commentaire: ['Commentaire', 'comment'], question: ['Question', 'qa'], reponse: ['Réponse', 'qa'], message: ['Message de groupe', 'people'], profil: ['Profil', 'user'], entretien: ['Entretien', 'briefcase'], avis: ['Avis de stage', 'star'], guide: ['Guide de l’étranger', 'flag'], cafe: ['Café ENSAM', 'clap'], startup: ['Startup', 'spark'], relecture: ['Relecture de CV', 'eye'], prive: ['Message privé', 'chat'] };
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
    case 'profil': { const r = by('profiles'); return r && { r, titre: r.full_name, texte: [r.role === 'laureat' ? `Promo ${r.promo}` : r.filiere, r.entreprise, r.bio].filter(Boolean).join(' · '), auteur: null, voir: ['Voir le profil', () => openProfile(r)], actions: r.role === 'laureat' && r.verified ? [['Retirer le badge vérifié', () => store.update('profiles', id, { verified: false }), true]] : [] }; }
    case 'entretien': { const r = by('entretiens'); return r && { r, titre: [r.entreprise, r.poste].filter(Boolean).join(' · '), texte: [...(r.questions || []), r.deroulement, r.conseils].filter(Boolean).join(' · '), auteur: r.author_id, actions: [['Supprimer l’entretien', rm('entretiens'), true]] }; }
    case 'avis': { const r = by('avis_stage'); return r && { r, titre: [r.entreprise, r.ville].filter(Boolean).join(' · '), texte: r.conseils, auteur: r.author_id, actions: [['Supprimer l’avis', rm('avis_stage'), true]] }; }
    case 'guide': { const r = by('guide_pays'); const s = r && GUIDE_SECTIONS.find(x => x[0] === r.section); return r && { r, titre: `${r.pays}${s ? ' · ' + s[1] : ''}`, texte: r.contenu, auteur: r.updated_by, actions: [['Supprimer la rubrique', rm('guide_pays'), true]] }; }
    case 'cafe': { const r = by('cafes'); return r && { r, titre: `${r.ville} · ${r.lieu}`, texte: r.message, auteur: r.organisateur_id, actions: r.annule ? [] : [['Annuler le café', () => store.update('cafes', id, { annule: true }), true]] }; }
    case 'startup': { const r = by('startups'); return r && { r, titre: r.nom, texte: r.pitch, auteur: r.fondateur_id, actions: [['Retirer la startup', rm('startups'), true]] }; }
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
      : html`<${Empty} icon="flag" title="Rien à modérer">Quand un membre signale un contenu, il apparaît ici. Tu décides de le retirer ou de le garder.<//>`}
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
      ${c.titre ? html`<strong class="mod-titre" translate="no" dir="auto">${court(c.titre, 120)}</strong>` : null}
      ${c.texte ? html`<p class="mod-texte" translate="no" dir="auto">${court(c.texte)}</p>` : null}
      ${auteur ? html`<span class="small muted">Auteur : <button class="linkish" onClick=${() => openProfile(auteur)} translate="no">${auteur.full_name}</button></span>` : c.auteur === null && s0.cible_type !== 'profil' ? html`<span class="small muted">Un membre anonyme</span>` : null}
    </div>` : html`<p class="small muted mod-cible">Contenu déjà supprimé</p>`}
    <ul class="mod-reports">${g.map(s => { const a = store.byId('profiles', s.auteur_id); return html`<li class="small"><span class="muted">Signalé par</span> ${a ? html`<button class="linkish" onClick=${() => openProfile(a)} translate="no">${a.full_name}</button>` : '?'} · <span class="muted">${MOTIFS[s.motif] || s.motif}</span>${s.details ? html` : <span translate="no" dir="auto">« ${s.details} »</span>` : null}</li>`; })}</ul>
    <div class="mod-act">
      ${c?.voir ? html`<button class="btn tiny ghost" onClick=${c.voir[1]}><${Icon} name="eye" size=${14}/> ${c.voir[0]}</button>` : null}
      <span class="spacer"></span>
      ${c ? c.actions.map(a => html`<button class=${'btn small ' + (a[2] ? 'danger' : '')} onClick=${() => agir(a)}>${a[0]}</button>`) : html`<button class="btn small primary" onClick=${() => act(async () => { await clore('traite'); toast('Signalement marqué traité.'); })}>Clore</button>`}
      ${c ? html`<button class="btn small ghost" onClick=${() => act(async () => { await clore('traite'); toast('Signalement marqué traité.'); })}>Marquer traité</button>` : null}
      <button class="btn small ghost" onClick=${() => act(async () => { await clore('rejete'); toast('Signalement classé sans suite.'); })}>Classer sans suite</button>
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

function Membres({ ctx, comptes, toVerify }) {
  const { data, store, act, openProfile, saison } = ctx;
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const liste = useListe(store, data);
  const compte = new Map((comptes || []).map(c => [c.id, c]));
  const sansProfil = (comptes || []).filter(c => !c.a_profil);
  const members = data.profiles.filter(p => p.role !== 'admin');
  const qq = q.trim().toLowerCase();
  const list = members.filter(p => !qq || `${p.full_name} ${p.filiere} ${p.promo} ${p.entreprise || ''} ${compte.get(p.id)?.email || ''}`.toLowerCase().includes(qq))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const shown = all || qq ? list.slice(0, 60) : list.slice(0, 8);
  const promosListe = new Set(liste.map(l => l.promo));
  const surListe = p => { const e = (compte.get(p.id)?.email || '').toLowerCase(); return liste.some(l => (l.promo === p.promo && cleNom(l.nom) === cleNom(p.full_name)) || (l.email && e && l.email === e)); };
  const pairs = p => (data.verifications_pairs || []).filter(v => v.laureat_id === p.id).map(v => store.byId('profiles', v.verificateur_id)).filter(x => x?.role === 'laureat' && x.verified && x.promo === p.promo);

  return html`
    ${toVerify.length ? html`<div class="panel accent-panel"><div class="section-head"><h2 class="h-ico"><${Icon} name="shield"/> Lauréats à vérifier <span class="count">${toVerify.length}</span></h2></div>
      <p class="muted small">Vérifie que la personne est bien diplômée de l’ENSAM Meknès (promo, filière), puis valide. Le badge rassure les étudiants. Deux lauréats vérifiés de sa promo peuvent aussi le confirmer.</p>
      <ul class="people-list verif-list">${toVerify.map(p => { const pr = pairs(p); return html`<li key=${p.id}><div class="verif-who"><${Person} p=${p} onOpen=${openProfile} sub=${`${p.filiere} · Promo ${p.promo}${p.entreprise ? ' · ' + p.entreprise : ''}`}/>
        <span class="verif-facts small">
          ${compte.get(p.id) ? html`<span class="mono muted" dir="ltr" translate="no">${compte.get(p.id).email}</span>` : null}
          <span class=${pr.length ? 'good-t' : 'muted'}><${Icon} name="people" size=${13}/> ${pr.length ? `${pr.length}/2 lauréats de sa promo ont confirmé` : 'Aucune confirmation de sa promo'}${pr.length ? html` <span translate="no">(${pr.map(x => x.full_name).join(', ')})</span>` : null}</span>
          ${promosListe.has(p.promo) ? html`<span class=${surListe(p) ? 'good-t' : 'warn-t'}><${Icon} name="file" size=${13}/> ${surListe(p) ? 'Sur la liste officielle' : 'Pas trouvé sur la liste officielle de sa promo'}</span>` : null}
        </span></div>
        <button class="btn small primary" onClick=${() => act(async () => { await store.update('profiles', p.id, { verified: true }); toast('Lauréat vérifié.'); })}><${Icon} name="shield" size=${15}/> Vérifier</button></li>`; })}</ul></div>` : null}

    <div class="panel">
      <div class="section-head"><h2 class="h-ico"><${Icon} name="people"/> Membres</h2>
        <label class="search"><${Icon} name="search" size=${16}/><input id="adm-q" placeholder="Nom, email, filière, promo…" value=${q} onInput=${e => setQ(e.target.value)}/></label></div>
      ${sansProfil.length ? html`<p class="small hint-box"><${Icon} name="user" size=${15}/> <span>${sansProfil.length} compte${sansProfil.length > 1 ? 's' : ''} créé${sansProfil.length > 1 ? 's' : ''} sans profil (inscription pas terminée) : <span class="mono" dir="ltr" translate="no">${sansProfil.slice(0, 5).map(c => c.email).join(', ')}</span></span></p>` : null}
      <ul class="people-list member-list">${shown.map(p => { const c = compte.get(p.id); return html`<li key=${p.id}>
        <${Person} p=${p} onOpen=${openProfile} sub=${p.role === 'etudiant' ? `${NIVEAUX[niveauOf(p, saison)]?.short || ''} · ${p.filiere} · promo ${p.promo}` : `${p.filiere} · Promo ${p.promo}`}/>
        <span class="small muted member-meta">${c ? html`<span class="mono" dir="ltr" translate="no">${c.email}</span>` : null}<span>Inscrit ${timeAgo(p.created_at)}</span>${c?.last_sign_in_at ? html`<span>Vu ${timeAgo(c.last_sign_in_at)}</span>` : null}</span>
        <span class="spacer"></span>
        <select id=${'role-' + p.id} aria-label="Rôle" value=${p.role} onChange=${e => act(async () => { await store.update('profiles', p.id, { role: e.target.value }); toast('Rôle modifié.'); })}>${ROLES.map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select>
        ${p.role === 'laureat' && !p.verified ? html`<button class="btn small" onClick=${() => act(() => store.update('profiles', p.id, { verified: true }))}><${Icon} name="shield" size=${14}/> Vérifier</button>` : null}
      </li>`; })}</ul>
      ${!qq && list.length > 8 ? html`<button class="linkish small" onClick=${() => setAll(!all)}>${all ? 'Voir moins' : `Voir tous les membres (${list.length})`}</button>` : null}
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

const CHAMPS = [['complet', 'Nom complet'], ['nom', 'Nom'], ['prenom', 'Prénom'], ['email', 'Email'], ['promo', 'Promo'], ['filiere', 'Filière'], ['matricule', 'Matricule']];
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
    <p class="small muted">${n} filleul${n > 1 ? 's' : ''} cette saison · ${parrains} lauréat${parrains > 1 ? 's' : ''} volontaire${parrains > 1 ? 's' : ''} · ${sans.length} étudiant${sans.length > 1 ? 's' : ''} de 3A sans parrain. Chaque matin, la plateforme attribue aussi les parrains toute seule.</p>
  </div>`;
}

// Annonce affichée en haut de l'accueil de tous les membres
function AnnonceBox({ ctx }) {
  const { data, store, me, act } = ctx;
  const current = data.annonces.filter(a => a.active).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const [texte, setTexte] = useState(''); const [lien, setLien] = useState('');
  const publish = e => {
    e.preventDefault();
    act(async () => {
      if (lien.trim() && !/^https:\/\/\S+$/i.test(lien.trim())) throw new Error('Le lien doit commencer par https://');
      for (const a of data.annonces.filter(x => x.active)) await store.update('annonces', a.id, { active: false });
      await store.insert('annonces', { author_id: me.id, texte: texte.trim(), lien: lien.trim() || null, active: true });
      setTexte(''); setLien(''); toast('Annonce publiée sur l’accueil de tous les membres.', 'win');
    });
  };
  return html`<div class="panel">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="bell"/> Annonce sur l’accueil</h2></div>
    ${current ? html`<div class="annonce preview"><${Icon} name="bell" size=${18}/><span class="grow">${current.texte}</span><button class="btn tiny ghost" onClick=${() => act(() => store.update('annonces', current.id, { active: false }))}>Retirer</button></div>` : html`<p class="small muted">Aucune annonce en ce moment.</p>`}
    <form class="form" onSubmit=${publish}>
      <${Field} label=${current ? 'Remplacer par une nouvelle annonce' : 'Nouvelle annonce'} hint="280 caractères au plus. Elle s’affiche en haut de l’accueil de tout le monde."><textarea id="ann-txt" rows="2" maxlength="280" value=${texte} onInput=${e => setTexte(e.target.value)} placeholder="Ex. Forum entreprises jeudi à l’école : les lauréats sont les bienvenus."></textarea><//>
      <div class="row"><input id="ann-lien" class="grow" dir="ltr" value=${lien} onInput=${e => setLien(e.target.value)} placeholder="Lien (facultatif) : https://…"/><button class="btn primary" disabled=${texte.trim().length < 3}>Publier</button></div>
    </form>
  </div>`;
}

// Bandeau de l'accueil, que chacun peut masquer pour lui
export function AnnonceBanner({ ctx }) {
  const { data } = ctx;
  const a = data.annonces.filter(x => x.active).sort((x, y) => new Date(y.created_at) - new Date(x.created_at))[0];
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem('annonce-off') || ''; } catch { return ''; } });
  const [lire, setLire] = useState(false);
  if (!a || hidden === a.id) return null;
  const hide = () => { setHidden(a.id); try { localStorage.setItem('annonce-off', a.id); } catch { /* */ } };
  const long = (a.texte || '').length > 140;
  return html`<div class="annonce" role="status"><${Icon} name="spark" size=${18}/><span class="grow"><span class=${'annonce-txt' + (long && !lire ? ' clamp' : '')} dir="auto" translate="no">${a.texte}</span>${long ? html` <button class="linkish small" onClick=${() => setLire(!lire)}>${lire ? 'Réduire' : 'Lire la suite'}</button>` : null}${a.lien && /^https:\/\//i.test(a.lien) ? html` <a href=${a.lien} target="_blank" rel="noopener">En savoir plus</a>` : null}</span>
    <button class="icon-btn small" aria-label="Masquer l’annonce" onClick=${hide}><${Icon} name="x" size=${15}/></button></div>`;
}

injectCSS('admin', `
.adm-tabs { margin-bottom: .2rem; }
.adm-tabs .adm-n { position: absolute; top: 5px; inset-inline-end: 6px; min-width: 1.25rem; height: 1.25rem; padding: 0 .3rem; border-radius: 999px; background: var(--brass); color: var(--surface); font-size: .7rem; line-height: 1.25rem; text-align: center; }
.mod-card { display: flex; flex-direction: column; gap: .55rem; padding: .9rem 1rem; border-radius: 14px; background: var(--surface); border: 1px solid var(--line); border-inline-start: 4px solid var(--brass); }
.mod-head { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem; }
.mod-ico { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: var(--brass-soft); color: var(--brass); flex: none; }
.mod-cible { display: flex; flex-direction: column; gap: .25rem; padding: .6rem .75rem; border-radius: 10px; background: var(--surface-2); margin: 0; }
.mod-titre { font-size: .95rem; }
.mod-texte { margin: 0; font-size: .9rem; color: var(--ink-2); overflow-wrap: anywhere; }
.mod-reports { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .2rem; }
.mod-act { display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; padding-top: .5rem; border-top: 1px dashed var(--line); }
.mod-hist li { flex-wrap: nowrap; }
.mod-hist .grow { min-width: 0; }
.verif-list li { flex-wrap: nowrap; align-items: flex-start; }
.verif-who { display: flex; flex-direction: column; gap: .3rem; min-width: 0; flex: 1; }
.verif-facts { display: flex; flex-direction: column; gap: .15rem; min-width: 0; padding-inline-start: calc(36px + .6rem); }
.verif-facts > span { display: inline-flex; align-items: center; gap: .3rem; flex-wrap: wrap; }
.good-t { color: var(--good); } .warn-t { color: var(--warn); }
.good-box { background: var(--good-soft); color: var(--good); }
.file-btn { position: relative; overflow: hidden; align-self: flex-start; }
.file-btn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
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
.lo-promo { display: flex; flex-direction: column; gap: .4rem; padding: .7rem .8rem; border: 1px solid var(--line); border-radius: 12px; }
.lo-fil { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .25rem; }
.lo-fil li { display: flex; align-items: center; gap: .5rem; }
.lo-fil .grow { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lo-mini { width: 70px; flex: none; }
.lo-manquants { display: flex; flex-direction: column; gap: .5rem; }
.lo-list { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow: auto; border: 1px solid var(--line); border-radius: 10px; }
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
