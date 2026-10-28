// Entraide, Communauté (classement, annuaire, vitrine des talents) et profils.
import { html, useState, useMemo, useRef, useEffect } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Avatar, LogoEntreprise, toast, LevelChip, RoleLine, roleTexte, injectCSS, PartagerWhatsApp, lienDirect, allerAuChamp, Bouclier, Embleme } from './ui.js';
import { useBrouillon } from './ui.js';
import { PucesNav, useVoirPlus, VoirPlus } from './lignes.js';
import { proposerPrevenir } from './pwa.js';
import { ChoixRole, accordIci } from './entree.js';
import { getLang, setLang } from './i18n.js';
import { laureatCompte, FILIERES, PREPA, filieresPour, filiereCourte, seasonOf, NIVEAUX, CATEGORIES_Q, SECTEURS, niveauOf, statutOf, timeAgo, computeScores, badgesOf, levelOf, seasonLabel, routedTo, norm, incoherenceProfil, manquesProfil, estEmailEcole, chiffreReseau } from './logic.js';
import { villeAffichee } from './geo.js';
import { TalentPool } from './growth.js';
import { GroupesPage } from './groupes.js';
import { AnnuairePro } from './pro.js';
import { CoupePromos } from './saison.js';
import { EntreprisesPage } from './entreprises.js';
import { EtrangerPage } from './etranger.js';
import { AgendaPage } from './agenda.js';
import { MessageBtn } from './messages.js';
import { CvButton } from './cv.js';
import { SignalerBtn, ContactBlock, PairVerify, VisibiliteFields, groupesMasques, confirmations, VIS_LABELS, VIS_CHOIX } from './confiance.js';
import { VIS_CHAMPS, VIS_DEFAUT, CV_MAX } from './store.js';
import { addAR, arCount } from './i18n.js';
import { oublierInvitation } from './invitation.js';
import { photoPreteDuCV, PhotoTrouvee } from './photo.js';

// Arabe : textes du profil ajoutés en Phase 3
addAR({
  // Les onglets de « Mon profil » (Profil et Notifications sont déjà traduits ailleurs)
  'Parties du profil': 'أقسام الملف', 'Mes infos': 'معلوماتي', 'Mes données': 'بياناتي', 'Visibilité': 'الظهور', 'Données': 'البيانات',
  // Un seul réglage pour Match et la Vitrine des talents
  'Visible par les lauréats': 'ظاهر للخريجين',
  'Les lauréats te trouvent dans Match et dans la Vitrine des talents : ils voient ton année, ta filière, tes compétences et ce que tu cherches.':
    'يجدك الخريجون في صفحة التوافق وفي واجهة المواهب: يرون سنتك وشعبتك ومهاراتك وما تبحث عنه.',
  'Les lauréats te voient de nouveau dans Match et dans la Vitrine des talents.': 'يراك الخريجون من جديد في صفحة التوافق وفي واجهة المواهب.',
  'Les lauréats ne te voient plus dans Match ni dans la Vitrine des talents.': 'لم يعد الخريجون يرونك في صفحة التوافق ولا في واجهة المواهب.',
  // Profil en une minute depuis LinkedIn
  'Remplir depuis LinkedIn': 'الملء من LinkedIn', 'Remplir mon profil': 'املأ ملفي', 'Bio': 'نبذة',
  'Sur LinkedIn (ordinateur), ouvre ton profil, puis « Plus » › « Enregistrer au format PDF ».': 'على LinkedIn (من الحاسوب)، افتح ملفك، ثم «المزيد» › «حفظ بصيغة PDF».',
  'Ouvre le PDF, sélectionne tout (Ctrl+A), copie, puis colle ici. Sur téléphone, colle simplement ta section Infos.': 'افتح ملف PDF، حدّد الكل (Ctrl+A)، انسخ ثم الصق هنا. على الهاتف، الصق فقط قسم «نبذة».',
  'Colle ici le texte de ton profil LinkedIn': 'الصق هنا نص ملفك على LinkedIn',
  'Rempli :': 'تم ملء:', 'Vérifie avant d’enregistrer.': 'تحقق قبل الحفظ.',
  'Rien de reconnu : colle tout le texte du PDF LinkedIn.': 'لم يتم التعرف على شيء: الصق كل نص ملف PDF من LinkedIn.',
  'Rien de nouveau : les champs étaient déjà remplis.': 'لا جديد: الحقول كانت معبأة من قبل.',
  'Inscris-toi avec ton email de l’école.': 'سجّل باستعمال بريد المدرسة.', 'recruté': 'موظَّف',
  'Les comptes étudiants utilisent l’email de l’école :': 'تستعمل حسابات الطلبة بريد المدرسة:',
  'Ton compte actuel n’en fait pas partie :': 'حسابك الحالي ليس منها:',
  'Me déconnecter et recommencer': 'تسجيل الخروج وإعادة التسجيل',
  'Ou un lien vers ton CV (facultatif)': 'أو رابط سيرتك الذاتية (اختياري)', 'Google Drive ou autre, si tu n’as pas déposé de PDF.': 'Google Drive أو غيره، إن لم ترفع ملف PDF.',
  'Mes coordonnées (privées)': 'معلومات اتصالي (خاصة)',
  'Visibles seulement par les membres que tu acceptes, et par le lauréat à qui tu envoies une candidature.': 'لا يراها إلا الأعضاء الذين تقبلهم، والخريج الذي ترسل إليه ترشيحك.',
  'Téléphone': 'الهاتف', 'Email de contact': 'بريد التواصل', 'Autre (facultatif)': 'وسيلة أخرى (اختياري)', 'Ex. WhatsApp, plutôt le soir': 'مثال: واتساب، في المساء أفضل',
  'prenom.nom@…': 'prenom.nom@…', 'https://…': 'https://…',
  'Ton badge « Lauréat vérifié » arrive quand l’équipe du réseau, ou deux lauréats vérifiés de ta promo, confirment ton profil.': 'تحصل على شارة «خريج موثَّق» عندما يؤكد فريق الشبكة ملفك، أو خريجان موثَّقان من دفعتك.',
  'Voir le CV': 'عرض السيرة الذاتية',
  'Ta question est publiée.': 'تم نشر سؤالك.',
}, [
  [/^Question envoyée à (\d+) lauréats?\.$/, n => `أُرسل السؤال إلى ${arCount(n, ['خريج واحد', 'خريجَين', 'خريجين', 'خريجًا'])}.`],
]);


// ---------------------------------------------------------------------------
// Entraide (questions / réponses)
// ---------------------------------------------------------------------------
export function EntraidePage(ctx) {
  const { data, store, me, go } = ctx;
  const [cat, setCat] = useState('');
  const [ask, setAsk] = useState(false);
  const pourMoi = data.questions.filter(q => routedTo(q, me) && !data.answers.some(a => a.question_id === q.id && a.author_id === me.id));
  const qs = (cat === 'moi' ? pourMoi : data.questions.filter(q => !cat || q.categorie === cat)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const q = ctx.sub2 && store.byId('questions', ctx.sub2);
  const open = id => go('reseau/entraide/' + id);
  if (q) return html`<${QuestionView} key=${q.id} ctx=${ctx} q=${q} onBack=${() => go('reseau/entraide', { remplacer: true })}/>`;
  return html`<div class="sub-page">
    <div class="toolbar"><p class="muted small grow">Les questions des étudiants, les réponses des lauréats.</p><button class="btn primary small" onClick=${() => setAsk(true)}><${Icon} name="plus" size=${16}/> Poser une question</button></div>
    <div class="chips rangee" role="group" aria-label="Catégorie">${pourMoi.length ? html`<button class=${'chip' + (cat === 'moi' ? ' on' : '')} aria-pressed=${cat === 'moi'} onClick=${() => setCat(cat === 'moi' ? '' : 'moi')}><${Icon} name="send" size=${13}/> Pour toi <span class="count">${pourMoi.length}</span></button>` : null}${['', ...CATEGORIES_Q].map(c => html`<button class=${'chip' + (cat === c ? ' on' : '')} aria-pressed=${cat === c} onClick=${() => setCat(c)}>${c || 'Toutes'}</button>`)}</div>
    <div class="list">${qs.length ? qs.map(q => {
      const ans = data.answers.filter(a => a.question_id === q.id); const au = store.byId('profiles', q.author_id);
      return html`<button class="qrow" key=${q.id} onClick=${() => open(q.id)}>
        <span class=${'qcount' + (q.best_answer_id ? ' solved' : ans.length ? '' : ' none')}><b>${ans.length}</b><span>réponse${ans.length > 1 ? 's' : ''}</span></span>
        <span class="qtxt"><span class="mini">${q.categorie}</span>${q.entreprise || q.pays ? html`<span class="mini hit"><${Icon} name=${q.entreprise ? 'briefcase' : 'globe'} size=${11}/> ${q.entreprise || q.pays}</span>` : null} <strong>${q.titre}</strong><span class="muted small">${au?.full_name || 'Membre'} · ${timeAgo(q.created_at)}${q.best_answer_id ? ' · Résolue' : ''}</span></span>
        <${Icon} name="arrow"/></button>`;
    }) : html`<${Empty} icon="qa" title="Pas encore de question ici">Pose la première, les lauréats sont notifiés.<//>`}</div>
    ${ask ? html`<${AskQuestion} ctx=${ctx} onClose=${() => setAsk(false)} onDone=${id => { setAsk(false); open(id); }}/>` : null}
  </div>`;
}

function QuestionView({ ctx, q, onBack }) {
  const { data, store, me, act, openProfile, scores } = ctx;
  const [txt, setTxt] = useBrouillon(me.id + ':reponse:' + q.id, '');
  const au = store.byId('profiles', q.author_id);
  const ans = data.answers.filter(a => a.question_id === q.id).map(a => ({ ...a, v: data.votes.filter(v => v.answer_id === a.id) }))
    .sort((a, b) => (b.id === q.best_answer_id) - (a.id === q.best_answer_id) || b.v.length - a.v.length);
  return html`<div class="sub-page">
    <button class="btn ghost small back" onClick=${onBack}>← Toutes les questions</button>
    <article class="qview">
      <span class="mini">${q.categorie}</span>${q.entreprise || q.pays ? html`<span class="mini hit"><${Icon} name=${q.entreprise ? 'briefcase' : 'globe'} size=${11}/> Pour les lauréats ${q.entreprise ? 'de ' + q.entreprise : 'en ' + q.pays}</span>` : null}
      <h2 class="q-title">${q.titre}</h2>
      ${q.body ? html`<p>${q.body}</p>` : null}
      <div class="row"><${Person} p=${au} onOpen=${openProfile} size=${30}/><span class="muted small">${timeAgo(q.created_at)}</span><span class="spacer"></span>
        <${PartagerWhatsApp} id="q-partage" texte=${getLang() === 'ar' ? `سؤال على شبكة ENSAM مكناس: « ${q.titre} »\nيمكنك الجواب هنا: ${lienDirect('reseau/entraide/' + q.id)}` : `Question sur le Réseau ENSAM Meknès : « ${q.titre} »\nTu peux y répondre ici : ${lienDirect('reseau/entraide/' + q.id)}`}/>
        ${(q.author_id === me.id || me.role === 'admin') ? html`<button class="btn tiny ghost danger-t" onClick=${() => ctx.confirm('Supprimer cette question et ses réponses ?', () => act(async () => { await store.remove('questions', q.id); onBack(); }))}>Supprimer</button>` : html`<${SignalerBtn} ctx=${ctx} type="question" id=${q.id}/>`}</div>
    </article>
    <h2 class="section-title">${ans.length} réponse${ans.length > 1 ? 's' : ''}</h2>
    <div class="list">${ans.map(a => { const p = store.byId('profiles', a.author_id); const mine = a.v.find(v => v.user_id === me.id); const best = a.id === q.best_answer_id; return html`<div class=${'answer' + (best ? ' best' : '')} key=${a.id}>
      <div class="vote"><button class=${'icon-btn' + (mine ? ' on' : '')} aria-pressed=${!!mine} aria-label="Cette réponse est utile" onClick=${() => act(() => mine ? store.remove('votes', mine.id) : store.insert('votes', { answer_id: a.id, user_id: me.id }))}><${Icon} name="thumb" size=${16}/></button><b class="mono">${a.v.length}</b></div>
      <div class="answer-body">${best ? html`<span class="best-tag"><${Icon} name="check" size=${14}/> Meilleure réponse</span>` : null}<p>${a.body}</p>
        <div class="row"><${Person} p=${p} score=${scores.get(p?.id)} onOpen=${openProfile} size=${26}/><span class="muted small">${timeAgo(a.created_at)}</span><span class="spacer"></span>
        ${q.author_id === me.id && !best && a.author_id !== me.id ? html`<button class="btn tiny ghost" onClick=${() => act(async () => { await store.update('questions', q.id, { best_answer_id: a.id }); toast('Meilleure réponse choisie. Merci pour le lauréat !'); })}>Choisir comme meilleure réponse</button>` : null}
        ${(a.author_id === me.id || me.role === 'admin') ? html`<button class="icon-btn small" aria-label="Supprimer" onClick=${() => act(() => store.remove('answers', a.id))}><${Icon} name="trash" size=${14}/></button>` : html`<${SignalerBtn} ctx=${ctx} type="reponse" id=${a.id} small/>`}</div></div>
    </div>`; })}</div>
    <form class="form answer-form" onSubmit=${e => { e.preventDefault(); act(async () => { await store.insert('answers', { question_id: q.id, author_id: me.id, body: txt.trim() }); setTxt(''); toast('Réponse publiée.', 'ok', 5); }); }}>
      <${Field} label="Ta réponse"><textarea id="ans-txt" rows="4" value=${txt} onInput=${e => setTxt(e.target.value)} placeholder="Partage ton expérience concrète…" maxlength="3000"></textarea><//>
      <div class="row-end"><button class="btn primary" disabled=${!txt.trim()}>Répondre</button></div>
    </form>
  </div>`;
}

export function AskQuestion({ ctx, onClose, onDone, initial = {} }) {
  const { store, me, act, data } = ctx;
  // La question en cours d'écriture reste sur l'appareil (session expirée, rechargement)
  const [f, setF, oublierBrouillon] = useBrouillon(initial.entreprise || initial.pays || initial.titre ? null : me.id + ':question', () => ({ categorie: initial.pays ? 'Étranger & visas' : CATEGORIES_Q[0], titre: '', body: '', entreprise: '', pays: '', ...initial }));
  const [cible, setCible] = useState(initial.entreprise || initial.pays ? true : false);
  // Combien de lauréats recevront la question
  const fake = { entreprise: cible ? f.entreprise.trim() : '', pays: cible ? f.pays.trim() : '', author_id: me.id };
  const n = cible && (fake.entreprise || fake.pays) ? data.profiles.filter(p => routedTo(fake, p)).length : 0;
  return html`<${Modal} title="Poser une question" onClose=${onClose}>
    <form class="form" onSubmit=${e => { e.preventDefault(); act(async () => { const row = { author_id: me.id, categorie: f.categorie, titre: f.titre.trim(), body: f.body.trim() }; if (fake.entreprise) row.entreprise = fake.entreprise; if (fake.pays) row.pays = fake.pays; const q = await store.insert('questions', row); oublierBrouillon(); onDone(q.id); const mot = n ? `Question envoyée à ${n} lauréat${n > 1 ? 's' : ''}.` : 'Ta question est publiée.'; if (!proposerPrevenir('question', mot) && n) toast(mot, 'envoi'); }); }}>
      <${Field} label="Catégorie"><select id="aq-cat" value=${f.categorie} onChange=${e => setF({ ...f, categorie: e.target.value })}>${CATEGORIES_Q.map(c => html`<option value=${c}>${c}</option>`)}</select><//>
      <${Field} label="Question"><input id="aq-titre" required value=${f.titre} onInput=${e => setF({ ...f, titre: e.target.value })} maxlength="160" placeholder="Ex. Comment obtenir un visa pour un stage au Canada ?"/><//>
      <${Field} label="Détails (facultatif)"><textarea id="aq-body" rows="4" value=${f.body} onInput=${e => setF({ ...f, body: e.target.value })} maxlength="3000"></textarea><//>
      <label class="check"><input id="aq-cible" type="checkbox" checked=${cible} onChange=${e => setCible(e.target.checked)}/> Elle concerne une entreprise ou un pays précis</label>
      ${cible ? html`<div class="grid2"><${Field} label="Entreprise"><input id="aq-ent" value=${f.entreprise} onInput=${e => setF({ ...f, entreprise: e.target.value })} placeholder="Ex. Renault, OCP…" maxlength="80"/><//><${Field} label="Pays"><input id="aq-pays" value=${f.pays} onInput=${e => setF({ ...f, pays: e.target.value })} placeholder="Ex. France, Canada…" maxlength="60"/><//></div>
        <p class="small muted">${n ? `${n} lauréat${n > 1 ? 's' : ''} recevr${n > 1 ? 'ont' : 'a'} ta question directement.` : 'Aucun lauréat inscrit ne correspond encore : la question reste visible par tous.'}</p>` : null}
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" disabled=${f.titre.trim().length < 5}>Publier</button></div>
    </form><//>`;
}

// ---------------------------------------------------------------------------
// Réseau : entraide, annuaire, classement et vitrine des talents (le mentorat a sa propre page)
// ---------------------------------------------------------------------------
const RESEAU_TABS = [['groupes', 'Groupes', 'people'], ['agenda', 'Agenda', 'calendar'], ['entraide', 'Entraide', 'qa'], ['entreprises', 'Entreprises', 'briefcase'], ['etranger', 'Étranger', 'flag'], ['annuaire', 'Annuaire', 'network'], ['classement', 'Classement', 'trophy'], ['talents', 'Talents', 'spark']];

export function ReseauPage(ctx) {
  const { data, me, sub, go } = ctx;
  // Une rubrique encore vide reste cachée jusqu'à son premier contenu (l'administration voit tout)
  const vide = {
    agenda: !(data.evenements || []).length,
    etranger: !(data.guide_pays || []).length && !data.profiles.some(p => p.role === 'laureat' && p.pays && norm(p.pays) !== 'maroc'),
    classement: ![...(ctx.scores?.values() || [])].some(x => x?.points > 0),
  };
  const tabs = RESEAU_TABS.filter(([k]) => (me.role !== 'etudiant' || !['classement', 'talents'].includes(k)) && (me.role === 'admin' || !vide[k]));
  const tab = tabs.some(([k]) => k === sub) ? sub : 'groupes';
  // Un seul chiffre par écran : l'annuaire, l'étranger et les entreprises ont déjà le leur
  const chiffre = ['annuaire', 'etranger', 'entreprises'].includes(tab) ? '' : chiffreReseau(data.profiles, me);
  return html`<section class="page">
    <header class="page-head"><div>${chiffre ? html`<p class="eyebrow">${chiffre}</p>` : null}<h1>Réseau</h1></div></header>
    <${PucesNav} label="Rubriques du réseau" items=${tabs.map(([k, l, i]) => ({ k, label: l, icon: i }))} actif=${tab} onChoisir=${k => go('reseau/' + k, { remplacer: true })}/>
    ${tab === 'groupes' ? html`<${GroupesPage} ctx=${ctx}/>` : null}
    ${tab === 'agenda' ? html`<${AgendaPage} ctx=${ctx}/>` : null}
    ${tab === 'entraide' ? html`<${EntraidePage} ...${ctx}/>` : null}
    ${tab === 'entreprises' ? html`<${EntreprisesPage} ctx=${ctx}/>` : null}
    ${tab === 'etranger' ? html`<${EtrangerPage} ctx=${ctx}/>` : null}
    ${tab === 'annuaire' ? html`<${AnnuairePro} ctx=${ctx}/>` : null}
    ${tab === 'classement' ? html`<${Classement} ctx=${ctx}/>` : null}
    ${tab === 'talents' ? html`<${TalentPool} ctx=${ctx}/>` : null}
  </section>`;
}

function Classement({ ctx }) {
  const promos = ctx.sub2 === 'promos';
  return html`<div class="sub-page">
    <div class="seg" role="tablist" aria-label="Classement">${[['', 'Lauréats'], ['promos', 'Coupe des promos']].map(([k, l]) => html`<button role="tab" aria-selected=${(ctx.sub2 || '') === k} class=${(ctx.sub2 || '') === k ? 'on' : ''} onClick=${() => ctx.go('reseau/classement' + (k ? '/' + k : ''), { remplacer: true })}>${l}</button>`)}</div>
    ${promos ? html`<${CoupePromos} ctx=${ctx}/>` : html`<${ClassementLaureats} ctx=${ctx}/>`}
  </div>`;
}

// Une ligne par lauréat : rang (médaille pour les trois premiers), visage, nom et ce qu'il a fait, points à droite.
// Le premier n'a plus de fond doré : sa médaille suffit.
const FAITS = [['recrutes', 'briefcase', 'Recrutés'], ['mentorats', 'mentor', 'Mentorats'], ['offres', 'feed', 'Offres']];
function ClassementLaureats({ ctx }) {
  const { data, scores, saison, openProfile, me } = ctx;
  const [period, setPeriod] = useState('mois');
  const periodScores = useMemo(() => period === 'tout' ? scores : computeScores(data, period === 'mois' ? new Date(Date.now() - 30 * 864e5) : new Date(saison, 8, 1)), [data, period]);
  const board = data.profiles.filter(laureatCompte).map(p => ({ p, pts: periodScores.get(p.id)?.points || 0 })).filter(x => x.pts > 0).sort((a, b) => b.pts - a.pts);
  const { vus, reste, plus } = useVoirPlus(board, 20, period);
  return html`<div class="sub-page">
    <p class="muted small">Les lauréats qui aident le plus : offres, recrutements confirmés, mentorats, réponses.</p>
    <div class="chips rangee" role="group" aria-label="Période">${[['mois', '30 jours'], ['saison', `Année ${seasonLabel(saison)}`], ['tout', 'Depuis le début']].map(([k, l]) => html`<button type="button" class=${'chip' + (period === k ? ' on' : '')} aria-pressed=${period === k} onClick=${() => setPeriod(k)}>${l}</button>`)}</div>
    ${board.length ? html`<ol class="lignes classement">${vus.map((x, i) => { const s = scores.get(x.p.id); const faits = FAITS.filter(([k]) => s?.[k] > 0); return html`<li key=${x.p.id} class=${'ligne rang' + (x.p.id === me.id ? ' me' : '')}>
      <span class="rang-n">${i < 3 ? html`<span class=${'medal m' + (i + 1)}>${i + 1}</span>` : i + 1}</span>
      <${Person} p=${x.p} onOpen=${openProfile} size=${40} sub=${html`<span class="rang-promo">${roleTexte(x.p, true)}</span>${faits.length ? html`<span class="rang-faits">${faits.map(([k, ic, t]) => html`<span title=${t}><${Icon} name=${ic} size=${13}/> ${s[k]}</span>`)}</span>` : null}`}/>
      <span class="ligne-chiffre">${x.pts}<small>pts</small></span></li>`; })}</ol>` : null}
    <${VoirPlus} reste=${reste} onPlus=${plus}/>
    ${!board.length ? html`<${Empty} icon="trophy" title="Personne n’a encore marqué de points sur cette période">Publie une offre ou réponds à une question pour ouvrir le classement.<//>` : null}
  </div>`;
}

// ---------------------------------------------------------------------------
// Profil (fiche d'un membre) et édition de mon profil
// ---------------------------------------------------------------------------
export function ProfileModal({ ctx, p: p0, onClose, onAskMentor }) {
  const { data, me, scores, saison, store } = ctx;
  const p1 = store.byId('profiles', p0.id) || p0;
  // En démo, les champs que la personne réserve à d'autres sont retirés ici (en ligne, la base l'a déjà fait)
  const masques = groupesMasques(store, p1);
  const p = masques.length ? { ...p1, ...Object.fromEntries(masques.flatMap(g => VIS_CHAMPS[g].map(c => [c, null]))) } : p1;
  const s = scores.get(p.id);
  // Un étudiant ne voit ni points ni classement : seulement les badges qui disent à qui il peut faire confiance.
  // « Vérifié » n'est pas un badge ici : c'est le bouclier, juste après le nom.
  const badges = badgesOf(s, p, { star: ctx.starId, fondateurs: ctx.fondateurs, ambassadeurs: ctx.ambassadeurs }).filter(b => b.id !== 'verifie' && (me.role !== 'etudiant' || ['fondateur', 'ambassadeur', 'mentor', 'reactif'].includes(b.id)));
  const helped = data.placements.filter(x => x.laureat_id === p.id && x.status === 'confirme').length;
  // Seulement les chiffres non nuls, accordés : un nouveau lauréat n'affiche pas une rangée de zéros
  const stats = [[s?.points, 'point'], [helped, 'recruté'], [s?.mentorats, 'mentorat'], [s?.offres, 'offre']]
    .filter(([n]) => n > 0).map(([n, mot]) => `${n} ${mot}${n > 1 ? 's' : ''}`);
  const st = p.role === 'etudiant' ? statutOf(data, p, saison) : null;
  return html`<${Modal} title="Profil" onClose=${onClose}>
    <div class="profile">
      <div class="profile-head"><${Avatar} p=${p} size=${64}/><div><div class="profile-l1"><h2>${p.full_name}</h2><${Bouclier} p=${p} explique/></div><${RoleLine} p=${p} score=${s} sansEntreprise=${!!p.entreprise}/>
        <p class="small muted">${p.role === 'laureat' ? p.filiere : p.role === 'etudiant' ? `${NIVEAUX[niveauOf(p, saison)]?.label} · promo ${p.promo}` : ''}${p.ville ? html` · <span translate="no">${villeAffichee(p.ville, getLang())}</span>` : ''}${p.pays && p.pays !== 'Maroc' ? `, ${p.pays}` : ''}</p></div></div>
      ${p.poste || p.entreprise ? html`<p class=${p.entreprise ? 'pm-travail' : ''}>${p.entreprise ? html`<${LogoEntreprise} nom=${p.entreprise} taille=${28}/>` : null}<span>${p.poste ? html`<strong>${p.poste}</strong>` : null}${p.entreprise ? html`${p.poste ? ' chez ' : ''}<button class="linkish" onClick=${() => { onClose(); ctx.openEntreprise?.(p.entreprise); }}>${p.entreprise}</button>` : null}${p.secteur ? html` <span class="mini">${p.secteur}</span>` : null}</span></p>` : null}
      ${st ? html`<p><span class=${'state-pill s-' + st.key}>${st.label}</span>${st.pl ? ` ${st.pl.entreprise}` : ''}</p>` : null}
      ${p.role === 'etudiant' && p.disponibilite ? html`<p class="small"><${Icon} name="calendar" size=${14}/> Disponibilité : <span translate="no" dir="auto">${p.disponibilite}</span></p>` : null}
      ${p.role === 'laureat' && p.en_recherche ? html`<p class="small"><span class="state-pill s-recherche">Cherche un emploi</span>${p.disponibilite ? html` <span translate="no" dir="auto">${p.disponibilite}</span>` : null}</p>` : null}
      ${p.bio ? html`<p>${p.bio}</p>` : null}
      ${(p.competences || []).length ? html`<p class="offer-target">${p.competences.map(c => html`<span class="mini">${c}</span>`)}</p>` : null}
      ${p.role !== 'etudiant' && me.role !== 'etudiant' && stats.length ? html`<div class="profile-stats">${stats.map(x => html`<span>${x}</span>`)}</div>` : null}
      ${badges.length ? html`<div class="badge-row">${badges.map(b => html`<span class="mini badge-mini" title=${b.desc}><${Embleme} id=${b.id} size=${16}/> ${b.nom}</span>`)}</div>` : null}
      ${(p.linkedin || p.cv_path || p.cv_url) ? html`<dl class="offer-more">${p.linkedin ? html`<div><dt>LinkedIn</dt><dd><a href=${p.linkedin.startsWith('http') ? p.linkedin : 'https://' + p.linkedin} target="_blank" rel="noopener" dir="ltr" translate="no">${p.linkedin}</a></dd></div>` : null}
        ${p.cv_path || p.cv_url ? html`<div><dt>CV</dt><dd><${CvButton} ctx=${ctx} p=${p} small/></dd></div>` : null}</dl>` : null}
      ${masques.length ? html`<p class="small muted cf-locked"><${Icon} name="lock" size=${14}/> Visible après accord : ${masques.map(g => html`<span class="mini">${VIS_LABELS[g]}</span>`)}</p>` : null}
      <${PairVerify} ctx=${ctx} p=${p}/>
      <${ContactBlock} ctx=${ctx} p=${p}/>
      <div class="profile-foot"><${SignalerBtn} ctx=${ctx} type="profil" id=${p.id}/><span class="spacer"></span>
        ${p.id !== me.id ? html`<${MessageBtn} ctx=${ctx} p=${p} cls=${p.mentor_dispo && p.role === 'laureat' && me.role !== 'admin' ? 'btn' : 'btn primary'}/>` : null}
        ${p.mentor_dispo && p.role === 'laureat' && p.id !== me.id && me.role !== 'admin' ? html`<button class="btn primary" onClick=${() => onAskMentor(p)}><${Icon} name="mentor" size=${16}/> Demander de l’aide</button>` : null}</div>
    </div>
  <//>`;
}

// « Profil en une minute » : le texte du profil LinkedIn collé remplit les champs encore vides
function LinkedinBox({ onFill }) {
  const [txt, setTxt] = useState('');
  const [faits, setFaits] = useState(null);
  // Le lecteur du texte LinkedIn n'est téléchargé qu'au premier usage
  const lire = async () => {
    try { const { parseLinkedin } = await import('./parse-linkedin.js'); setFaits(onFill(parseLinkedin(txt))); }
    catch { toast('Pas de réseau pour l’instant. Réessaie dans un instant.', 'err'); }
  };
  return html`<details class="li-box">
    <summary><${Icon} name="link" size=${16}/> Remplir depuis LinkedIn</summary>
    <ol class="small li-steps"><li>Sur LinkedIn (ordinateur), ouvre ton profil, puis « Plus » › « Enregistrer au format PDF ».</li><li>Ouvre le PDF, sélectionne tout (Ctrl+A), copie, puis colle ici. Sur téléphone, colle simplement ta section Infos.</li></ol>
    <textarea id="pf-litxt" rows="5" aria-label="Colle ici le texte de ton profil LinkedIn" placeholder="Colle ici le texte de ton profil LinkedIn" value=${txt} onInput=${e => setTxt(e.target.value)}></textarea>
    <div class="row"><button type="button" class="btn small" id="pf-lifill" disabled=${txt.trim().length < 20} onClick=${lire}><${Icon} name="spark" size=${15}/> Remplir mon profil</button></div>
    ${faits ? html`<p class="small li-faits" role="status">${faits.ok === false ? 'Rien de reconnu : colle tout le texte du PDF LinkedIn.' : !faits.length ? 'Rien de nouveau : les champs étaient déjà remplis.' : html`<span>Rempli :</span> ${faits.map(x => html`<span class="tag">${x}</span>`)} <span>Vérifie avant d’enregistrer.</span>`}</p>` : null}
  </details>`;
}

// Inscription : le CV en PDF remplit tout le profil (rôle, promo, filière, poste…), le membre vérifie puis valide.
// Une simple ligne : le formulaire reste la voie principale, le CV un raccourci.
function CvBox({ onLu, onPhoto }) {
  const input = useRef();
  const [etat, setEtat] = useState(null);
  // Photo trouvée dans le CV : proposée, gardée seulement si le membre dit oui (envoyée avec le profil)
  const [photo, setPhoto] = useState(null);
  const lire = async file => {
    if (!file) return;
    if (input.current) input.current.value = '';
    setPhoto(null); onPhoto?.(null);
    if (onPhoto && file.size <= CV_MAX) photoPreteDuCV(file).then(b => b && setPhoto({ blob: b, ok: false }));
    if (file.size > CV_MAX) return setEtat({ erreur: 'Le fichier dépasse 2 Mo. Exporte ton CV en PDF plus léger.' });
    if (file.type && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name || '')) return setEtat({ erreur: 'Choisis ton CV au format PDF.' });
    setEtat('lecture');
    try {
      const { lireCV } = await import('./lire-cv.js');
      const faits = onLu(await lireCV(file), file);
      setEtat(faits.ok === false ? { erreur: 'Ce CV ne se lit pas (scan en image ?). Remplis les champs à la main, ça prend une minute.' } : { faits });
    } catch { setEtat({ erreur: 'Ce PDF ne s’ouvre pas. Essaie un autre fichier, ou remplis les champs à la main.' }); }
  };
  return html`<div class="cv-box compact">
    <input ref=${input} id="pf-cvfile" type="file" accept="application/pdf,.pdf" hidden onChange=${e => lire(e.target.files[0])}/>
    <button type="button" class="btn small" id="pf-cv-choisir" aria-busy=${etat === 'lecture' ? 'true' : null} disabled=${etat === 'lecture'} onClick=${() => input.current?.click()}><${Icon} name="upload" size=${15}/> ${etat?.faits ? 'Un autre CV' : 'Choisir mon CV'}</button>
    <span class="small muted">On remplit ton profil depuis ton CV (PDF).</span>
    ${etat || photo ? html`<div class="cv-etat">
      ${etat === 'lecture' ? html`<span class="small" role="status">Lecture de ton CV…</span>`
        : etat?.erreur ? html`<span class="small warn-t" role="alert">${etat.erreur}</span>`
        : etat?.faits ? html`<span class="small cv-lu" role="status"><span>Lu dans ton CV :</span> ${etat.faits.map((x, i) => html`${i ? ' · ' : ''}<b>${x}</b>`)}</span>` : null}
      ${photo && !photo.ok ? html`<${PhotoTrouvee} key=${photo.blob.size} blob=${photo.blob} onUse=${() => { onPhoto(photo.blob); setPhoto({ ...photo, ok: true }); }} onNo=${() => { onPhoto(null); setPhoto(null); }}/>`
        : photo?.ok ? html`<span class="small good-t" role="status"><${Icon} name="check" size=${14}/> Photo gardée : elle sera sur ton profil.</span>` : null}
    </div>` : null}
  </div>`;
}

// « Disponible pour aider » : un vrai choix (oui / pas pour l'instant), demandé une fois à l'inscription d'un lauréat
function ChoixAide({ value, onChange, err }) {
  return html`<fieldset class=${'pf-aide' + (err ? ' manque' : '')} id="pf-aide">
    <legend>Disponible pour aider les étudiants ?</legend>
    <div class="cf-motifs pf-aide-choix">${[[true, 'oui', 'Oui, avec plaisir'], [false, 'non', 'Pas pour l’instant']].map(([v, k, l]) => html`<label key=${k} class=${'cf-motif' + (value === v ? ' on' : '')}>
      <input type="radio" name="pf-aide" id=${'pf-aide-' + k} checked=${value === v} aria-invalid=${err ? 'true' : null} aria-describedby=${err ? 'pf-err-aide pf-aide-txt' : 'pf-aide-txt'} onChange=${() => onChange(v)}/><span>${l}</span></label>`)}</div>
    ${err ? html`<span class="field-err" id="pf-err-aide">${err}</span>` : null}
    <p class="small muted" id="pf-aide-txt">Les étudiants de ta filière pourront te demander 20 minutes de conseil en visio. Tu choisis parmi leurs horaires, ou tu réponds « Pas disponible cette fois ». Tu peux changer d’avis à tout moment.</p>
  </fieldset>`;
}
injectCSS('pf-collant', `
.pf-collant { position: sticky; bottom: .6rem; z-index: 5; flex-wrap: nowrap; align-items: center; justify-content: space-between; padding-block: .55rem; padding-inline: 1rem .6rem; border-radius: 16px; background: var(--surface); border: 1px solid var(--accent); box-shadow: var(--shadow-lift); animation: fade-in .2s ease; }
.pf-collant .small { color: var(--ink-2); font-weight: 500; min-width: 0; }
.pf-collant .btn { flex: none; }
@media (max-width: 760px) { .pf-collant { bottom: calc(70px + env(safe-area-inset-bottom, 0px)); } }
/* Le champ où arrive le focus (Tab) n'est jamais caché sous la barre */
html:has(.pf-collant) { scroll-padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px)); }
@media (max-width: 760px) { html:has(.pf-collant) { scroll-padding-bottom: calc(5rem + 70px + env(safe-area-inset-bottom, 0px)); } }
`);
injectCSS('cv-box', `
.cv-box { display: flex; align-items: center; gap: .8rem; padding: .9rem 1rem; border: 1px solid var(--accent); border-radius: 14px; background: color-mix(in srgb, var(--accent) 7%, transparent); }
.cv-box .grow { display: flex; flex-direction: column; gap: .2rem; min-width: 0; }
.cv-box-ico { flex: none; display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; background: var(--accent); color: var(--accent-ink); }
.cv-lu b { font-weight: 650; }
@media (max-width: 560px) { .cv-box { flex-wrap: wrap; } .cv-box .btn { width: 100%; justify-content: center; } }
`);
// Inscription courte : le rôle rappelé, trois champs, le bouton collé en bas qui dit ce qui manque
injectCSS('pf-court', `
.auth-card.wide.onb { overflow: visible; overflow: clip; }
.onb-tete { flex-wrap: nowrap; }
.onb-tete > div { min-width: 0; }
.onb-tete .lang-btn { margin-inline-start: auto; flex: none; }
@media (max-width: 560px) { .auth-card.wide.onb { padding: 1rem 0 0; border: 0; box-shadow: none; background: transparent; border-radius: 0; --pied: var(--bg); } .auth-card.wide.onb::before { display: none; } }
.pf-role { display: flex; align-items: baseline; gap: .6rem; flex-wrap: wrap; }
.pf-role p { margin: 0; }
.cv-box.compact { border: 0; background: none; padding: 0; gap: .4rem .6rem; flex-wrap: wrap; }
.cv-box.compact .btn { width: auto; }
.cv-box.compact .cv-etat { flex-basis: 100%; display: flex; flex-direction: column; gap: .3rem; min-width: 0; }
.pf-aide { border: 0; padding: 0; margin: 0; min-width: 0; display: flex; flex-direction: column; gap: .45rem; }
.pf-aide legend { font-weight: 650; padding: 0; margin-block-end: .45rem; }
.pf-aide .cf-motifs { grid-template-columns: 1fr 1fr; }
.pf-aide .cf-motif { min-height: 48px; font-weight: 600; }
.pf-aide.manque .cf-motif:not(.on) { border-color: var(--warn); }
.pf-aide p { margin: 0; }
.pf-facultatif { display: flex; align-items: center; gap: .5rem; width: 100%; min-height: 48px; padding: .7rem .9rem; border: 1px dashed var(--line); border-radius: 12px; background: none; font: inherit; color: var(--ink); text-align: start; cursor: pointer; }
.pf-facultatif .small { min-width: 0; }
.pf-facultatif .chev { display: inline-flex; margin-inline-start: auto; transition: transform .15s; }
.pf-facultatif[aria-expanded="true"] .chev { transform: rotate(45deg); }
#pf-facultatif:empty { display: none; }
#pf-facultatif { display: flex; flex-direction: column; gap: .9rem; }
.pf-pied { position: sticky; bottom: 0; z-index: 5; padding-block: .6rem calc(.6rem + env(safe-area-inset-bottom, 0px)); background: linear-gradient(to bottom, transparent, var(--pied, var(--surface)) 35%); }
.pf-pied .btn { width: 100%; justify-content: center; min-height: 48px; }
html:has(.pf-pied) { scroll-padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px)); }
@media (prefers-reduced-motion: reduce) { .pf-facultatif .chev { transition: none; } }
`);

// Les champs vides arrivent de la base à null : on garde alors la valeur par défaut du formulaire (texte vide…)
const sansVides = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v != null));
// Ce qui, enregistré ailleurs (CV appliqué, rôle corrigé…), doit se refléter dans « Mon profil »
export const cleFormulaire = (me, co) => JSON.stringify([me.id, me.role, me.promo, me.filiere, me.poste, me.entreprise, me.ville, me.linkedin, me.bio, me.competences, co?.telephone, co?.email]);
const DEFAUTS_PROFIL = { full_name: '', role: 'etudiant', filiere: FILIERES[0], entreprise: '', poste: '', ville: '', pays: 'Maroc', bio: '', competences: [], linkedin: '', contact: '', cv_url: '', disponibilite: '', mentor_dispo: false, mentor_sujets: '', vitrine: true, secteur: '', parrain_dispo: false };
const memeValeur = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
// « Qui voit quoi » : seulement les réglages connus ; deux réglages sont les mêmes quel que soit l'ordre des clés (jsonb)
const visPropre = v => Object.fromEntries(Object.entries(v || {}).filter(([k, x]) => VIS_LABELS[k] && VIS_CHOIX.some(c => c[0] === x)));
const memeVis = (a, b) => Object.keys(VIS_LABELS).every(k => ((a || {})[k] || VIS_DEFAUT[k]) === ((b || {})[k] || VIS_DEFAUT[k]));
const listeComp = txt => txt.split(',').map(x => x.trim()).filter(Boolean).slice(0, 15);
const DELAI_VIS = 20000;

// Ce qui manque encore : le bouton le dit, et y mène (jamais un bouton grisé sans raison)
const MANQUE = {
  role: ['Choisis ta situation', 'pf-je-etudiant'], ecole: ['Utilise l’email de l’école', 'pf-ecole'], nom: ['Ajoute ton nom', 'pf-name'],
  promo: ['Ajoute ta promo', 'pf-promo'], coherence: ['Vérifie ta promo', 'pf-incoherent'], filiere: ['Choisis ta filière', 'pf-fil'], aide: ['Dis si tu peux aider', 'pf-aide-oui'],
};
const ERR = { nom: 'Écris ton nom complet.', promo: 'Indique l’année de ton diplôme.', filiere: 'Choisis ta filière dans la liste.', aide: 'Choisis l’une des deux réponses.' };

// « Mon profil » en quatre onglets, une seule partie à l'écran : Profil (photo, CV, mes infos), Visibilité (coordonnées,
// qui voit quoi, visible par les lauréats), Notifications (cet appareil, ce que je reçois, emails), Données (télécharger,
// supprimer). L'onglet est dans l'adresse (#profil, #profil/visibilite, #profil/notifications, #profil/donnees) : un lien
// ouvre le bon onglet, et Retour quitte la page (changer d'onglet remplace l'entrée, comme les onglets du Suivi).
// Les quatre tiennent sur une ligne à 360 px, en français et en arabe : rien de coupé, rien qui défile.
export const ONGLETS_PROFIL = [['profil', 'Profil'], ['visibilite', 'Visibilité'], ['notifications', 'Notifications'], ['donnees', 'Données']];
export const ongletProfil = sub => (ONGLETS_PROFIL.some(([k]) => k === sub) ? sub : 'profil');
export const routeOnglet = k => (k === 'profil' ? 'profil' : 'profil/' + k);
export function OngletsProfil({ onglet, onChange }) {
  // Clavier : flèches (dans le sens de lecture), Début et Fin passent d'un onglet à l'autre
  const clavier = e => {
    const n = ONGLETS_PROFIL.length, i = ONGLETS_PROFIL.findIndex(([k]) => k === onglet);
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    const j = { ArrowRight: i + (rtl ? -1 : 1), ArrowLeft: i + (rtl ? 1 : -1), Home: 0, End: n - 1 }[e.key];
    if (j === undefined) return;
    e.preventDefault();
    const k = ONGLETS_PROFIL[(j + n) % n][0];
    if (k !== onglet) onChange(k);
    requestAnimationFrame(() => document.getElementById('pf-onglet-' + k)?.focus());
  };
  return html`<div class="seg pf-onglets" role="tablist" aria-label="Parties du profil" onKeyDown=${clavier}>
    ${ONGLETS_PROFIL.map(([k, l]) => html`<button type="button" role="tab" key=${k} id=${'pf-onglet-' + k} class=${onglet === k ? 'on' : ''} aria-selected=${onglet === k ? 'true' : 'false'}
      aria-controls="pf-panneau" tabindex=${onglet === k ? 0 : -1} onClick=${() => { if (k !== onglet) onChange(k); }}>${l}</button>`)}
  </div>`;
}
injectCSS('pf-onglets', `
/* La rangée de segments de l'appli ; sur téléphone, toute la largeur, chaque onglet entier (jamais rétréci sous son texte) */
.pf-onglets button { min-height: 40px; }
@media (max-width: 560px) {
  .pf-onglets { align-self: stretch; }
  .pf-onglets button { flex: 1 1 auto; min-height: 44px; padding-inline: .45rem; font-size: var(--fs-2); }
}
/* Une seule partie à l'écran : les autres restent montées (ce qui est tapé et pas encore enregistré survit au changement) */
.pf-page [hidden] { display: none !important; }
.pf-panneau { display: flex; flex-direction: column; gap: 1.25rem; min-width: 0; }
.pf-partie { display: contents; }
.pf-titre { margin: .25rem 0 0; font-size: var(--fs-4); }
/* Visibilité : pas de filet au-dessus du premier bloc, ni sous la carte « Visible par les lauréats » */
.pf-vis > :is(.cf-private, .cf-vis):first-child, .pf-visible + :is(.cf-private, .cf-vis) { border-top: 0; padding-top: 0; }
/* « Visible par les lauréats » : un seul interrupteur pour Match et la Vitrine des talents */
.pf-visible { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.1rem; border-radius: var(--r-lg); background: var(--surface); box-shadow: var(--sh1); }
.pf-visible-txt { flex: 1; min-width: 0; }
.pf-visible-txt h3 { display: flex; align-items: center; gap: .45rem; margin: 0 0 .25rem; font: 650 var(--fs-4)/1.3 var(--f-body); }
.pf-visible-txt p { margin: 0; }
/* Page d'entrée (membres fondateurs) : un bloc comme les autres réglages de l'onglet */
.pf-fondateur { display: flex; flex-direction: column; gap: .55rem; border-top: 1px solid var(--line); padding-top: .9rem; }
.pf-fondateur:empty { display: none; }
.pf-fondateur .md-titre { margin: 0; font: 650 var(--fs-3)/1.3 var(--f-display); }
`);

// Dans « Mon profil », onglet dit la partie à l'écran ('profil' ou 'visibilite' ; une autre cache tout le formulaire) :
// les autres parties restent montées, rien de tapé ne se perd en changeant d'onglet. versOnglet(k) change d'onglet ;
// apresVisibilite s'affiche au bas de l'onglet Visibilité. À l'inscription (onboarding), tout est sur une seule page.
export function ProfileForm({ ctx, initial, preset, onDone, onInscrit, onboarding, onglet, versOnglet, apresVisibilite }) {
  const { store, act } = ctx;
  const voir = k => onboarding || !onglet || onglet === k;
  const S = ctx.saison ?? seasonOf(), an = new Date().getFullYear();
  // À l'inscription, rien n'est choisi d'avance (promo, filière, aide) : un « 2027 » ou une filière qu'on ne remarque pas mènerait à la mauvaise année
  const [f, setF] = useState(() => ({ ...DEFAUTS_PROFIL, role: onboarding ? '' : 'etudiant', ...(onboarding ? { filiere: '', mentor_dispo: null, promo: '' } : { promo: an + 1 }), ...sansVides(preset), ...sansVides(initial) }));
  // Le rôle choisi sur la page d'entrée n'est pas redemandé : il est rappelé, et reste corrigeable
  const [voirRole, setVoirRole] = useState(!(onboarding && preset?.role));
  // Les champs que le membre a changés sans enregistrer : une mise à jour venue d'ailleurs ne les écrase jamais
  const touches = useRef(new Set());
  const [, setSale] = useState(0);
  const toucher = (...ks) => { for (const k of ks) touches.current.add(k); setSale(n => n + 1); };
  const set = (k, v) => { toucher(k); setF(x => ({ ...x, [k]: v })); };
  const [comp, setComp] = useState((f.competences || []).join(', '));
  // Base à jour (Phase 3) : coordonnées privées et visibilité ; sinon l'ancien champ « contact » public
  const v3 = store.mode !== 'live' || 'visibilite' in (initial || store.data.profiles[0] || {});
  // « Je cherche un emploi » (lauréat) : envoyé seulement quand la base connaît la colonne
  const rechOk = store.mode !== 'live' || 'en_recherche' in (initial || store.data.profiles[0] || {});
  // Match (colonne match_visible) : en ligne, seulement quand la base la connaît (mise-a-jour.sql)
  const matchOk = store.mode !== 'live' || 'match_visible' in (initial || store.data.profiles[0] || {});
  // « Visible par les lauréats » (étudiant) : un seul réglage pour la Vitrine des talents (vitrine) et Match (match_visible),
  // allumé si l'un des deux l'est. Dans « Mon profil », il s'enregistre dès le geste et écrit les deux ; le choix reste
  // affiché le temps de l'envoi (pas enregistré : il revient à ce qui l'est). À l'inscription, il part avec le profil.
  const [visibleVoulu, setVisibleVoulu] = useState(null);
  const visible = onboarding || !initial ? f.vitrine !== false
    : visibleVoulu ?? (initial.vitrine !== false || (matchOk && initial.match_visible !== false));
  const changerVisible = v => {
    if (onboarding || !initial) return set('vitrine', v);
    setVisibleVoulu(v);
    act(async () => {
      try { await store.update('profiles', initial.id, { vitrine: v, ...(matchOk ? { match_visible: v } : {}) }); } finally { setVisibleVoulu(null); }
      toast(v ? 'Les lauréats te voient de nouveau dans Match et dans la Vitrine des talents.' : 'Les lauréats ne te voient plus dans Match ni dans la Vitrine des talents.');
    });
  };
  const coord0 = (initial && store.coordonneesDe(initial.id)) || {};
  const [co, setCo] = useState(() => ({ telephone: coord0.telephone || '', email: coord0.email || '', contact: coord0.contact || (v3 && initial?.contact) || '' }));
  const setC = (k, v) => { toucher('co.' + k); setCo(x => ({ ...x, [k]: v })); };
  const [vis, setVis] = useState(() => ({ ...(initial?.visibilite || {}) }));
  // « Mon profil » : ce qui change ailleurs (CV appliqué, rôle corrigé…) remplit les champs que le membre n'a pas touchés
  const cle = initial && !onboarding ? cleFormulaire(initial, store.coordonneesDe(initial.id)) : '';
  const premiereCle = useRef(cle);
  useEffect(() => {
    if (!cle || cle === premiereCle.current) return;
    premiereCle.current = cle;
    const t = touches.current, base = { ...DEFAUTS_PROFIL, ...sansVides(initial) };
    setF(x => { const n = { ...x }; for (const [k, v] of Object.entries(base)) if (!t.has(k)) n[k] = v; return n; });
    if (!t.has('competences')) setComp((initial.competences || []).join(', '));
    const c = store.coordonneesDe(initial.id) || {};
    setCo(x => ({ telephone: t.has('co.telephone') ? x.telephone : c.telephone || '', email: t.has('co.email') ? x.email : c.email || '', contact: t.has('co.contact') ? x.contact : c.contact || '' }));
  }, [cle]);
  // Qui voit quoi : enregistré dès le choix (dans « Mon profil »), comme un réglage. La ligne touchée dit où on en est.
  // Les envois partent strictement l'un après l'autre, chacun avec la grille voulue au moment où il part : le dernier
  // enregistré est toujours le dernier choix. Sans réponse après 20 s, la ligne le dit (l'envoi continue, et
  // « Enregistrer » reste possible) ; « Enregistré » ne s'affiche que quand plus rien n'attend.
  // Un « Enregistrer » réussi ouvre une nouvelle génération : ce que disent ensuite les envois d'avant ne compte plus.
  const [visOk, setVisOk] = useState(null);
  const fileVis = useRef(Promise.resolve());
  const enVol = useRef(0);
  const voulu = useRef(vis);
  const gen = useRef(0), derniereG = useRef(null);
  // La grille voulue est déjà celle de la base (un « Enregistrer » l'a envoyée) : un envoi lent ou en échec n'est pas une erreur.
  // Sauf si un envoi parti avec une autre grille peut encore arriver, ou a pu passer malgré son échec (réponse perdue).
  const partis = useRef([]), douteux = useRef(false);
  const dejaLa = () => !douteux.current && partis.current.every(x => memeVis(x, voulu.current)) && memeVis(voulu.current, store.byId('profiles', initial.id)?.visibilite);
  const envoyerVis = g => {
    const mien = gen.current; derniereG.current = g;
    setVisOk({ g, etat: 'envoi' }); enVol.current++;
    let envoye = null;
    const lent = setTimeout(() => { if (gen.current !== mien || dejaLa()) return; touches.current.add('visibilite'); setSale(n => n + 1); setVisOk({ g, etat: 'erreur' }); toast('Pas de réseau pour l’instant. Réessaie dans un instant.', 'err'); }, DELAI_VIS);
    fileVis.current = fileVis.current
      .then(() => { envoye = visPropre(voulu.current); partis.current.push(envoye); return store.update('profiles', initial.id, { visibilite: envoye }); })
      .then(() => { douteux.current = false; return null; }, e => { if (envoye && !memeVis(envoye, store.byId('profiles', initial.id)?.visibilite)) douteux.current = true; return e; })
      .then(e => {
        partis.current = partis.current.filter(x => x !== envoye);
        clearTimeout(lent); enVol.current--;
        if (gen.current === mien) {
          if (e && !dejaLa()) { touches.current.add('visibilite'); setVisOk({ g, etat: 'erreur' }); toast(e.message || String(e), 'err'); }
          else if (!enVol.current) { touches.current.delete('visibilite'); setVisOk(x => ({ g: x?.g ?? g, etat: 'ok' })); }
        }
        setSale(n => n + 1);
      });
  };
  const choisirVis = (v, g) => {
    setVis(v); voulu.current = v;
    if (onboarding || !initial || !v3) return;
    envoyerVis(g);
  };
  // Changé depuis un autre appareil : la grille suit ce qui est enregistré, sauf pendant un envoi ou un choix pas encore enregistré
  const visServeur = JSON.stringify(initial?.visibilite || {});
  useEffect(() => { if (initial && !onboarding && !enVol.current && !touches.current.has('visibilite')) { voulu.current = { ...(initial.visibilite || {}) }; setVis(voulu.current); } }, [visServeur]);
  // La barre « pas encore enregistrées » ne reste que si une valeur diffère vraiment de ce qui est enregistré
  const differe = () => {
    if (!initial) return false;
    const base = { ...DEFAUTS_PROFIL, ...sansVides(initial) };
    for (const k of touches.current) {
      if (k === 'visibilite') { if (!memeVis(vis, initial.visibilite)) return true; }
      else if (k === 'competences') { if (!memeValeur(listeComp(comp), initial.competences || [])) return true; }
      else if (k.startsWith('co.')) { const c = k.slice(3); if ((co[c] || '').trim() !== (coord0[c] || '')) return true; }
      else if (typeof f[k] === 'boolean' || typeof base[k] === 'boolean') { if (!!f[k] !== !!base[k]) return true; }
      else if (k === 'promo') { if (+f.promo !== +base.promo) return true; }
      else if (String(f[k] ?? '').trim() !== String(base[k] ?? '').trim()) return true;
    }
    return false;
  };
  const [cvFichier, setCvFichier] = useState(null);
  const [photoCV, setPhotoCV] = useState(null);
  // Inscription courte : rôle, nom, promo, filière (et, pour un lauréat, s'il peut aider) ; le reste est replié sous « Facultatif »
  const [details, setDetails] = useState(!onboarding);
  const plus = !onboarding || details;
  // Email de l'école obligatoire pour les étudiants (réglage de l'administration)
  const email = (store.session?.user?.email || '').toLowerCase();
  const domaines = store.domainesEcole?.() || [];
  const versEtudiant = !!onboarding || (!!initial && initial.role !== 'etudiant');
  const ecoleBloque = versEtudiant && f.role === 'etudiant' && store.reglages?.email_ecole_obligatoire === true && domaines.length > 0 && !!email && !estEmailEcole(email, domaines);
  // Rôle et promo cohérents : un lauréat a déjà son diplôme, un étudiant l'aura entre la 5A et la 1re année de cette saison
  const promoN = +f.promo;
  const incoherent = incoherenceProfil(f.role, f.promo, S, an);
  // Filières proposées selon le rôle et l'année : classes prépa en 1A-2A, maquette actuelle par parcours,
  // anciennes appellations pour les lauréats. Une valeur déjà enregistrée hors liste reste en tête tant qu'on n'en choisit pas une autre.
  // À l'inscription, rien n'est choisi tant qu'il y a plusieurs filières possibles.
  const filPour = (role, promo) => filieresPour(role, role === 'etudiant' ? niveauOf({ promo: +promo }, S) : 7);
  const groupesFil = filPour(f.role, f.promo);
  const proposees = groupesFil.flatMap(g => g.options);
  const garde = initial?.filiere && !proposees.includes(initial.filiere) ? initial.filiere : null;
  const filiere = proposees.includes(f.filiere) || (garde && f.filiere === garde) ? f.filiere : onboarding && proposees.length > 1 ? '' : proposees[0];
  const manques = manquesProfil({ ...f, filiere }, { onboarding, ecoleBloque, incoherent });
  const [tente, setTente] = useState(false);
  const err = k => (tente && manques.includes(k) ? ERR[k] : null);
  const aria = k => (err(k) ? { 'aria-invalid': 'true', 'aria-describedby': 'pf-err-' + k } : {});
  const libelle = manques.length ? MANQUE[manques[0]][0] : onboarding ? 'Rejoindre la communauté' : 'Enregistrer';
  // Ce qui manque est toujours dans l'onglet Profil : « Enregistrer » touché depuis l'onglet Visibilité y ramène d'abord,
  // puis mène au champ une fois l'onglet à l'écran
  const viser = useRef(null);
  useEffect(() => { const id = viser.current; if (id && voir('profil')) { viser.current = null; allerAuChamp(id); } }, [onglet]);
  const submit = e => {
    e.preventDefault();
    if (manques.length) {
      setTente(true);
      const m = manques[0];
      const id = m === 'coherence' && incoherent === 'loin' ? 'pf-promo' : MANQUE[m][1];
      if (voir('profil') || !versOnglet) allerAuChamp(id);
      else { viser.current = id; versOnglet('profil'); }
      return;
    }
    const row = { full_name: f.full_name.trim(), role: f.role === 'admin' ? 'admin' : f.role, filiere, promo: promoN, entreprise: f.entreprise.trim() || null, poste: f.poste.trim() || null, ville: f.ville.trim() || null, pays: f.pays.trim() || 'Maroc', bio: f.bio.trim() || null, competences: listeComp(comp), linkedin: f.linkedin.trim() || null, cv_url: f.cv_url.trim() || null, mentor_dispo: !!f.mentor_dispo, mentor_sujets: (f.mentor_sujets || '').trim() || null };
    // « Visible par les lauréats » : à l'inscription, il part avec le profil (Match seulement s'il est coupé, la base
    // l'allume d'office) ; dans « Mon profil », l'interrupteur l'a déjà enregistré
    if (onboarding || !initial) { row.vitrine = f.vitrine !== false; if (matchOk && !row.vitrine && f.role === 'etudiant') row.match_visible = false; }
    if (!v3) row.contact = (f.contact || '').trim() || null;
    if (f.role === 'laureat') { row.secteur = f.secteur || null; row.parrain_dispo = !!f.parrain_dispo; }
    if (rechOk && (f.role === 'laureat' || initial?.en_recherche)) row.en_recherche = f.role === 'laureat' && !!f.en_recherche;
    // Inscription : l'accord donné sur l'écran de création du compte, la langue et le choix pour les emails
    if (onboarding) {
      const meta = store.session?.user?.user_metadata || {};
      // L'accord vient de la case cochée sur cet appareil ; sinon la fenêtre « Tes données » le demande (emails compris)
      const ici = accordIci(store.session?.user?.email);
      if (ici) { if (meta.consent_at) row.consent_at = meta.consent_at; row.emails_hebdo = meta.emails_hebdo !== false; }
      // Sans accord donné ici, pas de résumé de la semaine tant que la fenêtre « Tes données » n'a pas eu de « oui »
      else row.emails_hebdo = false;
      row.langue = getLang();
    }
    // Colonne ajoutée par la mise à jour Phase 1 : envoyée seulement si la base la connaît déjà ou si elle est remplie
    if ((f.disponibilite || '').trim() || (initial && 'disponibilite' in initial)) row.disponibilite = (f.disponibilite || '').trim() || null;
    if (v3 && !memeVis(vis, initial?.visibilite)) row.visibilite = visPropre(vis);
    const champs = { telephone: co.telephone.trim() || null, email: co.email.trim() || null, contact: co.contact.trim() || null };
    const coordChange = v3 && ['telephone', 'email', 'contact'].some(k => (champs[k] || '') !== (coord0[k] || ''));
    act(async () => {
      if (onboarding) {
        await store.insert('profiles', { id: store.userId, ...row }); oublierInvitation();
        // L'accueil s'annonce tout de suite : CV, photo et coordonnées suivent sans le retarder
        onInscrit?.();
        // La langue de l'inscription (celle d'un lien arabe, par exemple) devient celle du membre sur cet appareil
        setLang(getLang(), { attendre: false }).catch(() => {});
        // Le CV lu à l'inscription est gardé comme CV du membre (joint aux candidatures, relu par un lauréat)
        if (cvFichier) await store.deposerCV(cvFichier).catch(() => toast('Ton CV n’a pas pu être gardé : ajoute-le depuis « Mon profil ».', 'err'));
        if (photoCV) await store.deposerPhoto(photoCV).catch(() => {});
      }
      else { await store.update('profiles', initial.id, row); gen.current++; if (row.visibilite) douteux.current = false; }
      if (coordChange) await store.enregistrerCoordonnees(champs);
      touches.current.clear(); setSale(n => n + 1); setVisOk(null);
      // Un envoi « Qui voit quoi » encore en route ne doit pas arriver en dernier : la grille voulue repart derrière lui
      if (!onboarding && enVol.current) envoyerVis(derniereG.current);
      // À l'inscription, c'est la feuille d'accueil qui souhaite la bienvenue
      if (!onboarding) toast('Profil enregistré.', 'envoi');
      onDone?.();
    });
  };
  // Ne remplit que les champs vides (et, à l'inscription, la promo, la filière et le rôle).
  // Depuis le CV, le rôle, la promo et la filière viennent du CV, même avec un lien d'invitation.
  const remplir = (r, { cv = false } = {}) => {
    if (!Object.keys(r).length) return Object.assign([], { ok: false });
    const n = { ...f }, faits = [];
    const vide = k => !String(f[k] ?? '').trim();
    const neuf = !initial;
    if (neuf && (!preset || cv) && r.role && f.role !== 'admin' && r.role !== f.role) { n.role = r.role; faits.push(r.role === 'laureat' ? 'Profil lauréat' : 'Profil étudiant'); }
    else if (cv && r.role) faits.push(r.role === 'laureat' ? 'Profil lauréat' : 'Profil étudiant');
    for (const [k, l] of [['full_name', 'Nom'], ['poste', 'Poste'], ['entreprise', 'Entreprise'], ['ville', 'Ville'], ['bio', 'Bio'], ['linkedin', 'LinkedIn']]) if (r[k] && vide(k)) { n[k] = r[k]; faits.push(l); }
    if (r.pays && r.pays !== f.pays && (vide('pays') || (neuf && f.pays === 'Maroc'))) { n.pays = r.pays; faits.push('Pays'); }
    if (neuf && (!preset?.promo || cv) && r.promo && r.promo !== +f.promo) { n.promo = r.promo; faits.push(cv ? `Promo ${r.promo}` : 'Promo'); }
    else if (cv && r.promo) faits.push(`Promo ${r.promo}`);
    if (neuf && r.filiere && filPour(n.role, n.promo).some(g => g.options.includes(r.filiere))) { if (r.filiere !== f.filiere) n.filiere = r.filiere; faits.push(cv ? filiereCourte(r.filiere) : 'Filière'); }
    toucher(...Object.keys(n).filter(k => !memeValeur(n[k], f[k])));
    setF(n);
    // Coordonnées privées trouvées dans le CV
    if (r.telephone || r.email) {
      const c = { ...co };
      if (r.telephone && !co.telephone) { c.telephone = r.telephone; faits.push('Téléphone'); toucher('co.telephone'); }
      if (r.email && !co.email) { c.email = r.email; faits.push('Email'); toucher('co.email'); }
      setCo(c);
    }
    if (r.competences?.length) {
      const deja = comp.split(',').map(x => x.trim()).filter(Boolean);
      const vu = new Set(deja.map(x => x.toLowerCase()));
      const plusC = r.competences.filter(c => !vu.has(c.toLowerCase()));
      if (plusC.length && deja.length < 15) { setComp([...deja, ...plusC].slice(0, 15).join(', ')); faits.push('Compétences'); toucher('competences'); }
    }
    return faits;
  };
  const isStudent = f.role === 'etudiant';
  // La promo proposée suit le rôle, seulement à l'inscription et seulement si une promo est déjà écrite
  // (une promo enregistrée ne bouge pas ; une promo vide reste vide)
  // Un rôle changé ne réécrit jamais la promo tapée : l'avertissement de cohérence (et son bouton) s'en charge
  const choisirRole = role => { toucher('role'); setF(x => ({ ...x, role })); };
  const changerRole = () => { setVoirRole(true); requestAnimationFrame(() => document.getElementById('pf-je-' + f.role)?.focus()); };
  const promoValide = f.promo !== '' && Number.isInteger(promoN) && promoN >= 1990 && promoN <= 2040;
  const hintPromo = !isStudent ? '' : promoValide && !incoherent ? `En ${seasonLabel(S)}, tu es en ${NIVEAUX[niveauOf({ promo: promoN }, S)].label}.`
    : 'Ex. en 5A cette année : ' + (S + 1) + '. Ton année d’études avance toute seule chaque septembre.';
  const n = !isStudent && initial && !initial.verified ? confirmations(store.data, initial) : 0;
  const aide = html`<${ChoixAide} value=${f.mentor_dispo} onChange=${v => set('mentor_dispo', v)} err=${err('aide')}/>`;
  const bouton = html`<button class="btn primary" data-manque=${manques[0] || null}>${libelle}</button>`;
  // Le reste du profil (replié sous « Facultatif » à l'inscription)
  const plusProfil = html`
    ${onboarding && f.role !== 'admin' ? html`<${LinkedinBox} onFill=${remplir}/>` : null}
    ${f.role === 'laureat' && rechOk ? html`<label class="check"><input id="pf-recherche" type="checkbox" checked=${!!f.en_recherche} onChange=${e => set('en_recherche', e.target.checked)}/> Je cherche un emploi en ce moment</label>
      ${f.en_recherche ? html`<p class="small muted">Les lauréats qui recrutent te verront dans la Vitrine des talents, et tu recevras les offres « Jeunes diplômés » et entre lauréats de ta filière. Ton expérience de PFE aide déjà les étudiants.</p>` : null}` : null}
    ${!isStudent ? html`<div class="grid3"><${Field} label="Entreprise"><input id="pf-ent" value=${f.entreprise || ''} onInput=${e => set('entreprise', e.target.value)}/><//><${Field} label="Poste"><input id="pf-poste" value=${f.poste || ''} onInput=${e => set('poste', e.target.value)}/><//>
      <${Field} label="Secteur"><select id="pf-sect" value=${f.secteur || ''} onChange=${e => set('secteur', e.target.value)}><option value="">—</option>${SECTEURS.map(x => html`<option value=${x}>${x}</option>`)}</select><//></div>` : null}
    <div class="grid2"><${Field} label="Ville"><input id="pf-ville" value=${f.ville || ''} onInput=${e => set('ville', e.target.value)}/><//><${Field} label="Pays"><input id="pf-pays" value=${f.pays || ''} onInput=${e => set('pays', e.target.value)}/><//></div>
    <${Field} label="Bio courte"><textarea id="pf-bio" rows="3" maxlength="600" value=${f.bio || ''} onInput=${e => set('bio', e.target.value)} placeholder=${isStudent ? 'Ce que tu cherches, tes projets…' : 'Ton parcours, comment tu peux aider…'}></textarea><//>
    <${Field} label="Compétences" hint="Séparées par des virgules"><input id="pf-comp" value=${comp} onInput=${e => { toucher('competences'); setComp(e.target.value); }} placeholder="Lean, CATIA, Python…"/><//>
    ${isStudent ? html`<div class="grid2"><${Field} label="LinkedIn"><input id="pf-li" value=${f.linkedin || ''} onInput=${e => set('linkedin', e.target.value)} placeholder="linkedin.com/in/…"/><//>
      <${Field} label="Disponibilité"><input id="pf-dispo" maxlength="80" value=${f.disponibilite || ''} onInput=${e => set('disponibilite', e.target.value)} placeholder="Ex. dès février, 6 mois"/><//></div>
      <${Field} label="Ou un lien vers ton CV (facultatif)" hint="Google Drive ou autre, si tu n’as pas déposé de PDF."><input id="pf-cv" value=${f.cv_url || ''} onInput=${e => set('cv_url', e.target.value)} placeholder="https://…"/><//>`
    : html`<${Field} label="LinkedIn"><input id="pf-li" value=${f.linkedin || ''} onInput=${e => set('linkedin', e.target.value)} placeholder="linkedin.com/in/…"/><//>
      ${f.role === 'laureat' && f.en_recherche ? html`<${Field} label="Le poste que je cherche"><input id="pf-dispo" maxlength="80" value=${f.disponibilite || ''} onInput=${e => set('disponibilite', e.target.value)} placeholder="Ex. ingénieur méthodes, Casablanca ou Tanger"/><//>` : null}
      ${onboarding ? null : aide}
      ${f.mentor_dispo ? html`<${Field} label="Sujets sur lesquels je peux aider"><input id="pf-msuj" value=${f.mentor_sujets || ''} onInput=${e => set('mentor_sujets', e.target.value)} placeholder="Stages à l’étranger, entretiens, automobile…"/><//>` : null}
      ${f.role === 'laureat' ? html`<label class="check"><input id="pf-parrain" type="checkbox" checked=${f.parrain_dispo} onChange=${e => set('parrain_dispo', e.target.checked)}/> Je veux bien parrainer un à trois étudiants de 3A de ma filière</label>` : null}`}
    ${f.role === 'laureat' && !initial?.verified ? html`<p class="small muted">${v3 ? 'Ton badge « Lauréat vérifié » arrive quand l’équipe du réseau, ou deux lauréats vérifiés de ta promo, confirment ton profil.' : 'Ton badge « Lauréat vérifié » sera ajouté par l’équipe du réseau.'}${n ? html` <b>${n}/2</b>` : null}</p>` : null}`;
  // Qui me voit et comment me joindre (l'onglet Visibilité de « Mon profil »)
  const partieVis = html`
    ${isStudent ? html`<${VisibleLaureats} on=${visible} onChange=${changerVisible}/>` : null}
    ${!v3 ? html`<${Field} label="Contact visible par les membres"><input id="pf-contact" value=${f.contact || ''} onInput=${e => set('contact', e.target.value)} placeholder="Email ou téléphone"/><//>` : null}
    ${v3 ? html`<fieldset class="cf-private" id="profil-coordonnees">
      <legend class="h-ico"><${Icon} name="lock" size=${17}/> Mes coordonnées (privées)</legend>
      <p class="small muted">Visibles seulement par les membres que tu acceptes, et par le lauréat à qui tu envoies une candidature.</p>
      <div class="grid2"><${Field} label="Téléphone"><input id="pf-tel" type="tel" maxlength="30" dir="ltr" value=${co.telephone} onInput=${e => setC('telephone', e.target.value)} placeholder="06 …"/><//>
        <${Field} label="Email de contact"><input id="pf-mail" type="email" maxlength="120" dir="ltr" value=${co.email} onInput=${e => setC('email', e.target.value)} placeholder="prenom.nom@…"/><//></div>
      <${Field} label="Autre (facultatif)"><input id="pf-contact" maxlength="200" value=${co.contact} onInput=${e => setC('contact', e.target.value)} placeholder="Ex. WhatsApp, plutôt le soir"/><//>
    </fieldset>
    <${VisibiliteFields} role=${f.role} value=${vis} onChange=${choisirVis} etat=${onboarding ? undefined : visOk} id="profil-visibilite"/>` : null}
    ${onboarding || !apresVisibilite ? null : html`<div class="pf-fondateur">${apresVisibilite}</div>`}`;
  return html`<form class="form" id=${onboarding ? undefined : 'profil-infos'} hidden=${!voir('profil') && !voir('visibilite')} onSubmit=${submit}>
    <div class="pf-partie pf-infos" hidden=${!voir('profil')}>
    ${onboarding ? null : html`<h2 class="pf-titre">Mes infos</h2>`}
    ${onboarding ? (voirRole || !f.role ? html`<${ChoixRole} value=${f.role} onChange=${choisirRole}/>`
      : html`<div class="pf-role"><p class="small" id="pf-role-rappel">${f.role === 'laureat' ? 'Tu t’inscris côté lauréats.' : 'Tu t’inscris côté étudiants.'}</p><button type="button" class="linkish small" id="pf-role-changer" onClick=${changerRole}>Changer</button></div>`)
    : f.role !== 'admin' ? html`<div class="seg" role="group" aria-label="Ta situation"><button type="button" class=${isStudent ? 'on' : ''} onClick=${() => choisirRole('etudiant')}>Je suis à l’école</button><button type="button" class=${!isStudent ? 'on' : ''} onClick=${() => choisirRole('laureat')}>J’ai mon diplôme</button></div>` : null}
    ${ecoleBloque ? html`<div class="cf-warn" role="alert" id="pf-ecole"><p><strong>${onboarding ? 'Inscris-toi avec ton email de l’école.' : 'Un compte étudiant utilise l’email de l’école.'}</strong></p>
      <p class="small">Les comptes étudiants utilisent l’email de l’école : <span dir="ltr" translate="no">${domaines.map(d => '@' + d).join(', ')}</span></p>
      <p class="small">Ton compte actuel n’en fait pas partie : <span dir="ltr" translate="no">${email}</span></p>
      ${onboarding ? html`<p class="small">Tu as déjà ton diplôme ? Choisis « J’ai mon diplôme » : l’email de l’école n’est demandé qu’aux étudiants.</p>
        <div class="row"><button type="button" class="btn small primary" id="pf-plutot-laureat" onClick=${() => choisirRole('laureat')}>J’ai mon diplôme</button><button type="button" class="btn small" id="pf-relog" onClick=${() => store.signOut()}><${Icon} name="logout" size=${15}/> Me déconnecter et recommencer</button></div>`
        : html`<p class="small">L’administration de la plateforme peut changer ton rôle si besoin.</p>`}</div>` : null}
    ${onboarding ? html`<${CvBox} onLu=${(r, file) => { setCvFichier(file); return remplir(r, { cv: true }); }} onPhoto=${setPhotoCV}/>` : null}
    ${!f.role ? html`<p class="small muted center" id="pf-choisir">Choisis ci-dessus, ou dépose ton CV : on remplit tout pour toi.</p>` : html`
    ${!onboarding && f.role !== 'admin' ? html`<${LinkedinBox} onFill=${remplir}/>` : null}
    <div class="grid2">
      <${Field} label="Nom complet" err=${err('nom')} errId="pf-err-nom"><input id="pf-name" autocomplete="name" value=${f.full_name} onInput=${e => set('full_name', e.target.value)} maxlength="80" ...${aria('nom')}/><//>
      <${Field} label=${isStudent ? 'Promo (année de diplôme prévue)' : 'Promo (année de diplôme)'} hint=${hintPromo} err=${err('promo')} errId="pf-err-promo"><input id="pf-promo" type="number" inputmode="numeric" placeholder=${onboarding && !isStudent ? 'Ex. 2019' : null} value=${f.promo} onInput=${e => set('promo', e.target.value)} ...${aria('promo')}/><//>
    </div>
    ${incoherent ? html`<div class="cf-warn" role="alert" id="pf-incoherent"><p class="small">${incoherent === 'futur' ? `Promo ${promoN} : ton diplôme n’est pas encore là. Tu es encore à l’école ?` : incoherent === 'diplome' ? `Promo ${promoN} : tu as déjà ton diplôme ? Passe côté lauréats.` : `Vérifie ta promo : en ${seasonLabel(S)}, la 1re année est la promo ${S + 5}.`}</p>
      ${incoherent === 'loin' ? null : html`<div><button type="button" class="btn small" id="pf-role-ok" onClick=${() => choisirRole(incoherent === 'futur' ? 'etudiant' : 'laureat')}>${incoherent === 'futur' ? 'Je suis à l’école' : 'J’ai mon diplôme'}</button></div>`}</div>` : null}
    <${Field} label="Filière" hint=${garde && filiere === garde ? 'Nouveau : choisis ta filière dans la liste officielle de l’école.' : filiere === PREPA ? 'La filière se choisit en 3e année.' : ''} err=${err('filiere')} errId="pf-err-filiere"><select id="pf-fil" value=${filiere} onChange=${e => set('filiere', e.target.value)} ...${aria('filiere')}>
      ${filiere === '' ? html`<option value="">Choisis ta filière</option>` : null}
      ${garde ? html`<option value=${garde}>${garde}</option>` : null}
      ${groupesFil.map(g => html`<optgroup label=${g.label}>${g.options.map(x => html`<option value=${x}>${x}</option>`)}</optgroup>`)}</select><//>
    ${onboarding && f.role === 'laureat' ? aide : null}
    ${onboarding ? html`<button type="button" class="pf-facultatif" id="pf-plus" aria-expanded=${details ? 'true' : 'false'} aria-controls="pf-facultatif" onClick=${() => setDetails(d => !d)}>
      <strong>Facultatif</strong><span class="small muted">${isStudent ? 'ville, LinkedIn, compétences…' : 'entreprise, poste, ville, LinkedIn…'}</span><span class="chev"><${Icon} name="plus" size=${16}/></span></button>
      <div id="pf-facultatif">${plus ? html`${plusProfil}${partieVis}` : null}</div>` : plusProfil}`}
    </div>
    ${onboarding || !f.role ? null : html`<div class="pf-partie pf-vis" hidden=${!voir('visibilite')}>${partieVis}</div>`}
    ${onboarding ? html`<div class="row-end pf-pied">${bouton}</div>`
      : differe() ? html`<div class="row-end pf-collant" role="status"><span class="small">Modifications pas encore enregistrées</span>${bouton}</div>`
      : html`<div class="row-end">${bouton}</div>`}
  </form>`;
}

// « Visible par les lauréats » : un interrupteur, ce qu'il change en une phrase
function VisibleLaureats({ on, onChange }) {
  return html`<div class="pf-visible">
    <div class="pf-visible-txt"><h3 id="pf-h-visible"><${Icon} name="eye" size=${19}/> Visible par les lauréats</h3>
      <p class="small muted" id="pf-visible-d">Les lauréats te trouvent dans Match et dans la Vitrine des talents : ils voient ton année, ta filière, tes compétences et ce que tu cherches.</p></div>
    <label class="mx-switch"><input type="checkbox" role="switch" id="pf-visible" checked=${on} aria-labelledby="pf-h-visible" aria-describedby="pf-visible-d" onChange=${e => onChange(e.target.checked)}/><span class="mx-switch-piste" aria-hidden="true"></span></label>
  </div>`;
}

// « Dernière étape » courte : rôle rappelé, bouton qui dit ce qui manque, choix « aider », réglages « Qui voit quoi » ligne par ligne
const NIV_AR = { '1re année (cycle prépa)': 'السنة الأولى (السلك التحضيري)', '2e année (cycle prépa)': 'السنة الثانية (السلك التحضيري)', '3e année': 'السنة الثالثة', '4e année': 'السنة الرابعة', '5e année': 'السنة الخامسة' };
addAR({
  'Quelques secondes, et tu es dans le réseau.': 'بضع ثوانٍ، وتصبح في الشبكة.',
  'On remplit ton profil depuis ton CV (PDF).': 'نملأ ملفك انطلاقًا من سيرتك الذاتية (PDF).',
  'Facultatif': 'اختياري', 'entreprise, poste, ville, LinkedIn…': 'الشركة، المنصب، المدينة، LinkedIn…', 'ville, LinkedIn, compétences…': 'المدينة، LinkedIn، المهارات…',
  'Choisis ta filière': 'اختر شعبتك', 'Disponible pour aider les étudiants ?': 'هل تودّ مساعدة الطلبة؟',
  'Oui, avec plaisir': 'نعم، بكل سرور', 'Pas pour l’instant': 'ليس الآن',
  'Les étudiants de ta filière pourront te demander 20 minutes de conseil en visio. Tu choisis parmi leurs horaires, ou tu réponds « Pas disponible cette fois ». Tu peux changer d’avis à tout moment.':
    'سيتمكن طلبة شعبتك من طلب 20 دقيقة من النصح عبر الفيديو. تختار من بين المواعيد التي يقترحونها، أو تجيب « غير متاح هذه المرة ». يمكنك تغيير رأيك في أي وقت.',
  'Choisis ta situation': 'اختر وضعيتك', 'Utilise l’email de l’école': 'استعمل بريد المدرسة',
  'Ajoute ton nom': 'أضف اسمك', 'Ajoute ta promo': 'أضف دفعتك', 'Vérifie ta promo': 'تحقّق من دفعتك', 'Dis si tu peux aider': 'أخبرنا إن كنت تستطيع المساعدة',
  'Écris ton nom complet.': 'اكتب اسمك الكامل.', 'Indique l’année de ton diplôme.': 'اذكر سنة تخرّجك.',
  'Choisis ta filière dans la liste.': 'اختر شعبتك من القائمة.', 'Choisis l’une des deux réponses.': 'اختر أحد الجوابين.',
  'Tu t’inscris côté lauréats.': 'تسجيلك في فضاء الخريجين.', 'Tu t’inscris côté étudiants.': 'تسجيلك في فضاء الطلبة.',
  'Ta situation': 'وضعيتك', 'Je suis à l’école': 'أدرس في المدرسة', 'J’ai mon diplôme': 'حصلت على شهادتي', 'Profil étudiant': 'ملف طالب', 'Profil lauréat': 'ملف خريج',
  'Tu as déjà ton diplôme ? Choisis « J’ai mon diplôme » : l’email de l’école n’est demandé qu’aux étudiants.': 'حصلت على شهادتك؟ اختر «حصلت على شهادتي»: بريد المدرسة مطلوب من الطلبة فقط.',
  'Ex. 2019': 'مثال: 2019', 'Enregistrement…': 'جارٍ الحفظ…',
}, [
  [/^En (\d{4}-\d{4}), tu es en (.+)\.$/, (y, l) => `في ${y}، أنت في ${NIV_AR[l] || l}.`],
  [/^Ex\. en 5A cette année : (\d{4})\. Ton année d’études avance toute seule chaque septembre\.$/, y => `مثال: في 5A هذه السنة: ${y}. تتقدّم سنتك الدراسية تلقائيًا كل شتنبر.`],
  [/^Promo (\d{4}) : ton diplôme n’est pas encore là\. Tu es encore à l’école \?$/, p => `دفعة ${p}: لم تحصل على شهادتك بعد. هل ما زلت تدرس في المدرسة؟`],
  [/^Promo (\d{4}) : tu as déjà ton diplôme \? Passe côté lauréats\.$/, p => `دفعة ${p}: هل حصلت على شهادتك؟ انتقل إلى فضاء الخريجين.`],
  [/^Vérifie ta promo : en (\d{4}-\d{4}), la 1re année est la promo (\d{4})\.$/, (y, p) => `تحقق من دفعتك: في ${y}، السنة الأولى هي دفعة ${p}.`],
]);

export { levelOf, LevelChip };

// Lauréats qui cherchent un emploi, vérification des lauréats (CV, LinkedIn), photo de profil
addAR({
  'Modifications pas encore enregistrées': 'تعديلات لم تُحفظ بعد',
  'De l’ENSAM Meknès, en poste ou en recherche d’emploi': 'من ENSAM مكناس، في وظيفة أو في بحث عن عمل',
  'Je cherche un emploi en ce moment': 'أبحث عن عمل حاليًا',
  'Les lauréats qui recrutent te verront dans la Vitrine des talents, et tu recevras les offres « Jeunes diplômés » et entre lauréats de ta filière. Ton expérience de PFE aide déjà les étudiants.':
    'سيراك الخريجون الذين يوظّفون في واجهة المواهب، وستصلك عروض « الخريجون الجدد » والعروض بين الخريجين في شعبتك. وتجربتك في مشروع نهاية الدراسة تساعد الطلبة منذ الآن.',
  'Le poste que je cherche': 'الوظيفة التي أبحث عنها', 'Ex. ingénieur méthodes, Casablanca ou Tanger': 'مثال: مهندس طرق، الدار البيضاء أو طنجة',
  'Cherche un emploi': 'بحث عن عمل', 'un emploi': 'عمل', 'Lauréats en recherche': 'خريجون يبحثون عن عمل',
  'Étudiants en recherche qui ont choisi d’être visibles par les lauréats, et lauréats qui cherchent un emploi. Garde les profils intéressants et invite-les à postuler à tes offres.':
    'طلبة يبحثون عن فرصة واختاروا أن يظهروا للخريجين، وخريجون يبحثون عن عمل. احتفظ بالملفات المهمة وادعهم للترشح لعروضك.',
  'Offres pour toi': 'عروض لك', 'Le réseau t’aide à trouver ton poste, et ton expérience aide déjà les étudiants.': 'الشبكة تساعدك على إيجاد وظيفتك، وتجربتك تساعد الطلبة منذ الآن.',
  'Tu cherches un emploi ?': 'تبحث عن عمل؟', 'Un lauréat plus expérimenté peut relire ton CV, te préparer à un entretien ou te parler salaire.': 'خريج أكثر خبرة يمكنه مراجعة سيرتك الذاتية، أو تحضيرك لمقابلة، أو الحديث معك عن الراتب.',
  'Demander conseil': 'طلب نصيحة', 'Qui as-tu recruté ?': 'من وظّفت؟', 'Son nom': 'الاسم',
  'Personne avec ce nom. La personne doit d’abord créer son compte.': 'لا أحد بهذا الاسم. يجب على الشخص أن ينشئ حسابه أولًا.',
  'CV déposé': 'السيرة الذاتية مرفوعة', 'Pas de CV déposé': 'لا سيرة ذاتية مرفوعة', 'Son profil LinkedIn': 'الملف على LinkedIn', 'Pas de LinkedIn': 'لا يوجد LinkedIn',
  'Demander son CV': 'طلب السيرة الذاتية', 'Retirer la photo': 'إزالة الصورة',
});
