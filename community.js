// Entraide, Communauté (classement, annuaire, vitrine des talents) et profils.
import { html, useState, useMemo, useRef } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Avatar, toast, LevelChip, RoleLine, injectCSS } from './ui.js';
import { getLang } from './i18n.js';
import { FILIERES, PREPA, filieresPour, filiereCourte, seasonOf, NIVEAUX, CATEGORIES_Q, SECTEURS, niveauOf, statutOf, timeAgo, computeScores, badgesOf, levelOf, seasonLabel, routedTo } from './logic.js';
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
import { VIS_CHAMPS, CV_MAX } from './store.js';
import { addAR } from './i18n.js';
import { oublierInvitation } from './invitation.js';
import { parseLinkedin } from './parse-linkedin.js';
import { lireCV } from './lire-cv.js';

// Arabe : textes du profil ajoutés en Phase 3
addAR({
  // Profil en une minute depuis LinkedIn
  'Remplir depuis LinkedIn': 'الملء من LinkedIn', 'Remplir mon profil': 'املأ ملفي', 'Bio': 'نبذة',
  'Sur LinkedIn (ordinateur), ouvre ton profil, puis « Plus » › « Enregistrer au format PDF ».': 'على LinkedIn (من الحاسوب)، افتح ملفك، ثم «المزيد» › «حفظ بصيغة PDF».',
  'Ouvre le PDF, sélectionne tout (Ctrl+A), copie, puis colle ici. Sur téléphone, colle simplement ta section Infos.': 'افتح ملف PDF، حدّد الكل (Ctrl+A)، انسخ ثم الصق هنا. على الهاتف، الصق فقط قسم «نبذة».',
  'Colle ici le texte de ton profil LinkedIn': 'الصق هنا نص ملفك على LinkedIn',
  'Rempli :': 'تم ملء:', 'Vérifie avant d’enregistrer.': 'تحقق قبل الحفظ.',
  'Rien de reconnu : colle tout le texte du PDF LinkedIn.': 'لم يتم التعرف على شيء: الصق كل نص ملف PDF من LinkedIn.',
  'Rien de nouveau : les champs étaient déjà remplis.': 'لا جديد: الحقول كانت معبأة من قبل.',
  'Inscris-toi avec ton email de l’école.': 'سجّل باستعمال بريد المدرسة.',
  'Les comptes étudiants utilisent l’email de l’école :': 'تستعمل حسابات الطلبة بريد المدرسة:',
  'Ton compte actuel n’en fait pas partie :': 'حسابك الحالي ليس منها:',
  'Me déconnecter et recommencer': 'تسجيل الخروج وإعادة التسجيل',
  'Ou un lien vers ton CV (facultatif)': 'أو رابط سيرتك الذاتية (اختياري)', 'Google Drive ou autre, si tu n’as pas déposé de PDF.': 'Google Drive أو غيره، إن لم ترفع ملف PDF.',
  'Mes coordonnées (privées)': 'معلومات اتصالي (خاصة)',
  'Visibles seulement par les membres que tu acceptes, et par le lauréat à qui tu envoies une candidature.': 'لا يراها إلا الأعضاء الذين تقبلهم، والخريج الذي ترسل إليه ترشيحك.',
  'Téléphone': 'الهاتف', 'Email de contact': 'بريد التواصل', 'Autre (facultatif)': 'وسيلة أخرى (اختياري)', 'Ex. WhatsApp, plutôt le soir': 'مثال: واتساب، في المساء أفضل',
  'prenom.nom@…': 'prenom.nom@…', 'https://…': 'https://…',
  'Ton badge « Lauréat vérifié » arrive quand l’administration, ou deux lauréats vérifiés de ta promo, confirment ton profil.': 'تحصل على شارة «خريج موثَّق» عندما تؤكد الإدارة ملفك، أو خريجان موثَّقان من دفعتك.',
  'Voir le CV': 'عرض السيرة الذاتية',
});


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
  if (q) return html`<${QuestionView} ctx=${ctx} q=${q} onBack=${() => go('reseau/entraide')}/>`;
  return html`<div class="sub-page">
    <div class="toolbar"><p class="muted small grow">Les questions des étudiants, les réponses des anciens. Une question sur une entreprise ou un pays arrive directement aux lauréats concernés.</p><button class="btn primary small" onClick=${() => setAsk(true)}><${Icon} name="plus" size=${16}/> Poser une question</button></div>
    <div class="chips">${pourMoi.length ? html`<button class=${'chip' + (cat === 'moi' ? ' on' : '')} onClick=${() => setCat(cat === 'moi' ? '' : 'moi')}><${Icon} name="send" size=${13}/> Pour toi <span class="count">${pourMoi.length}</span></button>` : null}${['', ...CATEGORIES_Q].map(c => html`<button class=${'chip' + (cat === c ? ' on' : '')} onClick=${() => setCat(c)}>${c || 'Toutes'}</button>`)}</div>
    <div class="list">${qs.length ? qs.map(q => {
      const ans = data.answers.filter(a => a.question_id === q.id); const au = store.byId('profiles', q.author_id);
      return html`<button class="qrow" key=${q.id} onClick=${() => open(q.id)}>
        <span class=${'qcount' + (q.best_answer_id ? ' solved' : ans.length ? '' : ' none')}><b class="mono">${ans.length}</b><span>réponse${ans.length > 1 ? 's' : ''}</span></span>
        <span class="qtxt"><span class="mini">${q.categorie}</span>${q.entreprise || q.pays ? html`<span class="mini hit"><${Icon} name=${q.entreprise ? 'briefcase' : 'globe'} size=${11}/> ${q.entreprise || q.pays}</span>` : null} <strong>${q.titre}</strong><span class="muted small">${au?.full_name || 'Membre'} · ${timeAgo(q.created_at)}${q.best_answer_id ? ' · Résolue' : ''}</span></span>
        <${Icon} name="arrow"/></button>`;
    }) : html`<${Empty} icon="qa" title="Pas encore de question ici">Pose la première, les lauréats sont notifiés.<//>`}</div>
    ${ask ? html`<${AskQuestion} ctx=${ctx} onClose=${() => setAsk(false)} onDone=${id => { setAsk(false); open(id); }}/>` : null}
  </div>`;
}

function QuestionView({ ctx, q, onBack }) {
  const { data, store, me, act, openProfile, scores } = ctx;
  const [txt, setTxt] = useState('');
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
    <form class="form answer-form" onSubmit=${e => { e.preventDefault(); act(async () => { await store.insert('answers', { question_id: q.id, author_id: me.id, body: txt.trim() }); setTxt(''); toast('Réponse publiée. +5 points'); }); }}>
      <${Field} label="Ta réponse"><textarea id="ans-txt" rows="4" value=${txt} onInput=${e => setTxt(e.target.value)} placeholder="Partage ton expérience concrète…" maxlength="3000"></textarea><//>
      <div class="row-end"><button class="btn primary" disabled=${!txt.trim()}>Répondre</button></div>
    </form>
  </div>`;
}

export function AskQuestion({ ctx, onClose, onDone, initial = {} }) {
  const { store, me, act, data } = ctx;
  const [f, setF] = useState({ categorie: initial.pays ? 'Étranger & visas' : CATEGORIES_Q[0], titre: '', body: '', entreprise: '', pays: '', ...initial });
  const [cible, setCible] = useState(initial.entreprise || initial.pays ? true : false);
  // Combien de lauréats recevront la question
  const fake = { entreprise: cible ? f.entreprise.trim() : '', pays: cible ? f.pays.trim() : '', author_id: me.id };
  const n = cible && (fake.entreprise || fake.pays) ? data.profiles.filter(p => routedTo(fake, p)).length : 0;
  return html`<${Modal} title="Poser une question" onClose=${onClose}>
    <form class="form" onSubmit=${e => { e.preventDefault(); act(async () => { const row = { author_id: me.id, categorie: f.categorie, titre: f.titre.trim(), body: f.body.trim() }; if (fake.entreprise) row.entreprise = fake.entreprise; if (fake.pays) row.pays = fake.pays; const q = await store.insert('questions', row); if (n) toast(`Question envoyée à ${n} lauréat${n > 1 ? 's' : ''}.`); onDone(q.id); }); }}>
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
  const tabs = RESEAU_TABS.filter(([k]) => me.role !== 'etudiant' || !['classement', 'talents'].includes(k));
  const tab = tabs.some(([k]) => k === sub) ? sub : 'groupes';
  return html`<section class="page">
    <header class="page-head"><div><p class="eyebrow">${data.profiles.filter(p => p.role === 'laureat').length} lauréats · ${data.profiles.filter(p => p.role === 'etudiant').length} étudiants</p><h1>Réseau</h1></div></header>
    <div class="icon-tabs" role="tablist" style=${`--n:${tabs.length}`}>${tabs.map(([k, l, i]) => html`<button role="tab" aria-selected=${tab === k} class=${tab === k ? 'on' : ''} onClick=${() => go('reseau/' + k)}><${Icon} name=${i} size=${20}/><span>${l}</span></button>`)}</div>
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
    <div class="seg">${[['', 'Lauréats'], ['promos', 'Coupe des promos']].map(([k, l]) => html`<button class=${(ctx.sub2 || '') === k ? 'on' : ''} onClick=${() => ctx.go('reseau/classement' + (k ? '/' + k : ''))}>${l}</button>`)}</div>
    ${promos ? html`<${CoupePromos} ctx=${ctx}/>` : html`<${ClassementLaureats} ctx=${ctx}/>`}
  </div>`;
}

function ClassementLaureats({ ctx }) {
  const { data, scores, saison, openProfile } = ctx;
  const [period, setPeriod] = useState('mois');
  const periodScores = useMemo(() => period === 'tout' ? scores : computeScores(data, period === 'mois' ? new Date(Date.now() - 30 * 864e5) : new Date(saison, 8, 1)), [data, period]);
  const board = data.profiles.filter(p => p.role === 'laureat').map(p => ({ p, pts: periodScores.get(p.id)?.points || 0 })).filter(x => x.pts > 0).sort((a, b) => b.pts - a.pts).slice(0, 20);
  return html`<div class="sub-page">
    <p class="muted small">Les lauréats qui aident le plus : offres, recrutements confirmés, mentorats, réponses.</p>
    <div class="seg">${[['mois', '30 jours'], ['saison', `Saison ${seasonLabel(saison)}`], ['tout', 'Depuis le début']].map(([k, l]) => html`<button class=${period === k ? 'on' : ''} onClick=${() => setPeriod(k)}>${l}</button>`)}</div>
    <ol class="board">${board.map((x, i) => { const s = scores.get(x.p.id); return html`<li class=${i < 3 ? 'podium p' + (i + 1) : ''}>
      <span class="rank-n mono">${i < 3 ? html`<span class=${'medal m' + (i + 1)}>${i + 1}</span>` : i + 1}</span><${Person} p=${x.p} score=${s} onOpen=${openProfile}/>
      <span class="board-facts small muted"><span title="Recrutés"><${Icon} name="briefcase" size=${14}/> ${s?.recrutes || 0}</span><span title="Mentorats"><${Icon} name="mentor" size=${14}/> ${s?.mentorats || 0}</span><span title="Offres"><${Icon} name="feed" size=${14}/> ${s?.offres || 0}</span></span>
      <span class="mono pts">${x.pts} pts</span></li>`; })}</ol>
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
  const badges = badgesOf(s, p, { star: ctx.starId, fondateurs: ctx.fondateurs });
  const helped = data.placements.filter(x => x.laureat_id === p.id && x.status === 'confirme').length;
  const st = p.role === 'etudiant' ? statutOf(data, p, saison) : null;
  return html`<${Modal} title="Profil" onClose=${onClose}>
    <div class="profile">
      <div class="profile-head"><${Avatar} p=${p} size=${64}/><div><h2>${p.full_name}</h2><${RoleLine} p=${p} score=${s}/>
        <p class="small muted">${p.role === 'laureat' ? `${p.filiere} · Promo ${p.promo}` : p.role === 'etudiant' ? `${NIVEAUX[niveauOf(p, saison)]?.label} · promo ${p.promo}` : ''}${p.ville ? ` · ${p.ville}` : ''}${p.pays && p.pays !== 'Maroc' ? `, ${p.pays}` : ''}</p></div></div>
      ${p.poste || p.entreprise ? html`<p>${p.poste ? html`<strong>${p.poste}</strong>` : null}${p.entreprise ? html`${p.poste ? ' chez ' : ''}<button class="linkish" onClick=${() => { onClose(); ctx.openEntreprise?.(p.entreprise); }}>${p.entreprise}</button>` : null}${p.secteur ? html` <span class="mini">${p.secteur}</span>` : null}</p>` : null}
      ${st ? html`<p><span class=${'state-pill s-' + st.key}>${st.label}</span>${st.pl ? ` ${st.pl.entreprise}` : ''}</p>` : null}
      ${p.role === 'etudiant' && p.disponibilite ? html`<p class="small"><${Icon} name="calendar" size=${14}/> Disponibilité : <span translate="no" dir="auto">${p.disponibilite}</span></p>` : null}
      ${p.bio ? html`<p>${p.bio}</p>` : null}
      ${(p.competences || []).length ? html`<p class="offer-target">${p.competences.map(c => html`<span class="mini">${c}</span>`)}</p>` : null}
      ${p.role !== 'etudiant' ? html`<div class="profile-stats"><span><b class="mono">${s?.points || 0}</b> points</span><span><b class="mono">${helped}</b> recrutés</span><span><b class="mono">${s?.mentorats || 0}</b> mentorats</span><span><b class="mono">${s?.offres || 0}</b> offres</span></div>` : null}
      ${badges.length ? html`<div class="badge-row">${badges.map(b => html`<span class="mini badge-mini" title=${b.desc}><${Icon} name="star" size=${12}/> ${b.nom}</span>`)}</div>` : null}
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
  return html`<details class="li-box">
    <summary><${Icon} name="link" size=${16}/> Remplir depuis LinkedIn</summary>
    <ol class="small li-steps"><li>Sur LinkedIn (ordinateur), ouvre ton profil, puis « Plus » › « Enregistrer au format PDF ».</li><li>Ouvre le PDF, sélectionne tout (Ctrl+A), copie, puis colle ici. Sur téléphone, colle simplement ta section Infos.</li></ol>
    <textarea id="pf-litxt" rows="5" aria-label="Colle ici le texte de ton profil LinkedIn" placeholder="Colle ici le texte de ton profil LinkedIn" value=${txt} onInput=${e => setTxt(e.target.value)}></textarea>
    <div class="row"><button type="button" class="btn small" id="pf-lifill" disabled=${txt.trim().length < 20} onClick=${() => setFaits(onFill(txt))}><${Icon} name="spark" size=${15}/> Remplir mon profil</button></div>
    ${faits ? html`<p class="small li-faits" role="status">${faits.ok === false ? 'Rien de reconnu : colle tout le texte du PDF LinkedIn.' : !faits.length ? 'Rien de nouveau : les champs étaient déjà remplis.' : html`<span>Rempli :</span> ${faits.map(x => html`<span class="tag">${x}</span>`)} <span>Vérifie avant d’enregistrer.</span>`}</p>` : null}
  </details>`;
}

// Inscription : le CV en PDF remplit tout le profil (rôle, promo, filière, poste…), le membre vérifie puis valide
function CvBox({ onLu }) {
  const input = useRef();
  const [etat, setEtat] = useState(null);
  const lire = async file => {
    if (!file) return;
    if (input.current) input.current.value = '';
    if (file.size > CV_MAX) return setEtat({ erreur: 'Le fichier dépasse 2 Mo. Exporte ton CV en PDF plus léger.' });
    if (file.type && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name || '')) return setEtat({ erreur: 'Choisis ton CV au format PDF.' });
    setEtat('lecture');
    try {
      const faits = onLu(await lireCV(file), file);
      setEtat(faits.ok === false ? { erreur: 'Ce CV ne se lit pas (scan en image ?). Remplis les champs à la main, ça prend une minute.' } : { faits });
    } catch { setEtat({ erreur: 'Ce PDF ne s’ouvre pas. Essaie un autre fichier, ou remplis les champs à la main.' }); }
  };
  return html`<div class="cv-box">
    <input ref=${input} id="pf-cvfile" type="file" accept="application/pdf,.pdf" hidden onChange=${e => lire(e.target.files[0])}/>
    <span class="cv-box-ico"><${Icon} name="file" size=${22}/></span>
    <div class="grow"><strong>Le plus simple : ton CV</strong>
      <span class="small muted">On lit ton CV (PDF) et on remplit ton profil : étudiant(e) ou lauréat(e), promo, filière, poste… Tu vérifies, puis tu valides.</span>
      ${etat === 'lecture' ? html`<span class="small" role="status">Lecture de ton CV…</span>`
        : etat?.erreur ? html`<span class="small warn-t" role="alert">${etat.erreur}</span>`
        : etat?.faits ? html`<span class="small cv-lu" role="status"><span>Lu dans ton CV :</span> ${etat.faits.map((x, i) => html`${i ? ' · ' : ''}<b>${x}</b>`)}</span>` : null}
    </div>
    <button type="button" class=${'btn small' + (etat?.faits ? '' : ' primary')} id="pf-cv" aria-busy=${etat === 'lecture' ? 'true' : null} disabled=${etat === 'lecture'} onClick=${() => input.current?.click()}><${Icon} name="upload" size=${15}/> ${etat?.faits ? 'Un autre CV' : 'Choisir mon CV'}</button>
  </div>`;
}
injectCSS('je-suis', `
.je-suis { border: 0; padding: 0; margin: 0; min-width: 0; }
.je-suis legend { font-weight: 650; font-size: 1.05rem; margin-bottom: .55rem; padding: 0; }
.je-suis-choix { display: grid; grid-template-columns: 1fr 1fr; gap: .7rem; }
.je-carte { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: .25rem; padding: .95rem 1rem; text-align: start; font: inherit; color: inherit; background: var(--surface); border: 2px solid var(--line); border-radius: 14px; cursor: pointer; transition: border-color .15s, background-color .15s, transform .15s; }
.je-carte:hover { border-color: color-mix(in srgb, var(--accent) 55%, var(--line)); }
.je-carte:active { transform: scale(.985); }
.je-carte.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
.je-carte strong { font-size: 1.02rem; }
.je-ico { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 11px; background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent); margin-bottom: .2rem; }
.je-carte.on .je-ico { background: var(--accent); color: var(--accent-ink); }
.je-coche { position: absolute; top: .6rem; inset-inline-end: .6rem; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: var(--accent-ink); opacity: 0; transform: scale(.6); transition: opacity .15s, transform .15s; }
.je-carte.on .je-coche { opacity: 1; transform: none; }
@media (max-width: 380px) { .je-suis-choix { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .je-carte, .je-coche { transition: none; } }
`);
injectCSS('cv-box', `
.cv-box { display: flex; align-items: center; gap: .8rem; padding: .9rem 1rem; border: 1px solid var(--accent); border-radius: 14px; background: color-mix(in srgb, var(--accent) 7%, transparent); }
.cv-box .grow { display: flex; flex-direction: column; gap: .2rem; min-width: 0; }
.cv-box-ico { flex: none; display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; background: var(--accent); color: var(--accent-ink); }
.cv-lu b { font-weight: 650; }
@media (max-width: 560px) { .cv-box { flex-wrap: wrap; } .cv-box .btn { width: 100%; justify-content: center; } }
`);

// Les champs vides arrivent de la base à null : on garde alors la valeur par défaut du formulaire (texte vide…)
const sansVides = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v != null));

export function ProfileForm({ ctx, initial, preset, onDone, onboarding }) {
  const { store, act } = ctx;
  const [f, setF] = useState(() => ({ full_name: '', role: onboarding ? '' : 'etudiant', filiere: FILIERES[0], promo: new Date().getFullYear() + 1, entreprise: '', poste: '', ville: '', pays: 'Maroc', bio: '', competences: [], linkedin: '', contact: '', cv_url: '', disponibilite: '', mentor_dispo: false, mentor_sujets: '', vitrine: true, secteur: '', parrain_dispo: false, ...sansVides(preset), ...sansVides(initial) }));
  const set = (k, v) => setF({ ...f, [k]: v });
  const [comp, setComp] = useState((f.competences || []).join(', '));
  // Base à jour (Phase 3) : coordonnées privées et visibilité ; sinon l'ancien champ « contact » public
  const v3 = store.mode !== 'live' || 'visibilite' in (initial || store.data.profiles[0] || {});
  const coord0 = (initial && store.coordonneesDe(initial.id)) || {};
  const [co, setCo] = useState(() => ({ telephone: coord0.telephone || '', email: coord0.email || '', contact: coord0.contact || (v3 && initial?.contact) || '' }));
  const setC = (k, v) => setCo({ ...co, [k]: v });
  const [vis, setVis] = useState(() => ({ ...(initial?.visibilite || {}) }));
  const [cvFichier, setCvFichier] = useState(null);
  // Email de l'école obligatoire pour les étudiants (réglage de l'administration)
  const email = (store.session?.user?.email || '').toLowerCase();
  const domaines = store.domainesEcole?.() || [];
  const versEtudiant = !!onboarding || (!!initial && initial.role !== 'etudiant');
  const ecoleBloque = versEtudiant && f.role === 'etudiant' && store.reglages?.email_ecole_obligatoire === true && domaines.length > 0 && !!email && !domaines.some(d => email.endsWith('@' + d) || email.endsWith('.' + d));
  // Rôle et promo cohérents : un lauréat a déjà son diplôme, un étudiant l'aura entre la 5A et la 1re année de cette saison
  const S = ctx.saison ?? seasonOf(), promoN = +f.promo, an = new Date().getFullYear();
  const incoherent = f.role === 'laureat' && promoN > an ? 'futur' : f.role === 'etudiant' && promoN >= 1990 && promoN <= S ? 'diplome' : f.role === 'etudiant' && promoN > S + 5 ? 'loin' : null;
  const ok = !!f.role && f.full_name.trim().length >= 2 && f.promo >= 1990 && f.promo <= 2040 && !ecoleBloque && !incoherent;
  // Filières proposées selon le rôle et l'année : classes prépa en 1A-2A, maquette actuelle par parcours,
  // anciennes appellations pour les lauréats. Une valeur déjà enregistrée hors liste reste en tête tant qu'on n'en choisit pas une autre.
  const filPour = (role, promo) => filieresPour(role, role === 'etudiant' ? niveauOf({ promo: +promo }, ctx.saison ?? seasonOf()) : 7);
  const groupesFil = filPour(f.role, f.promo);
  const proposees = groupesFil.flatMap(g => g.options);
  const garde = initial?.filiere && !proposees.includes(initial.filiere) ? initial.filiere : null;
  const filiere = proposees.includes(f.filiere) || (garde && f.filiere === garde) ? f.filiere : proposees[0];
  const submit = e => {
    e.preventDefault(); if (!ok) return;
    const row = { full_name: f.full_name.trim(), role: f.role === 'admin' ? 'admin' : f.role, filiere, promo: +f.promo, entreprise: f.entreprise.trim() || null, poste: f.poste.trim() || null, ville: f.ville.trim() || null, pays: f.pays.trim() || 'Maroc', bio: f.bio.trim() || null, competences: comp.split(',').map(x => x.trim()).filter(Boolean).slice(0, 15), linkedin: f.linkedin.trim() || null, cv_url: f.cv_url.trim() || null, mentor_dispo: !!f.mentor_dispo, mentor_sujets: (f.mentor_sujets || '').trim() || null, vitrine: !!f.vitrine };
    if (!v3) row.contact = (f.contact || '').trim() || null;
    if (f.role === 'laureat') { row.secteur = f.secteur || null; row.parrain_dispo = !!f.parrain_dispo; }
    // Inscription : l'accord donné sur l'écran de création du compte, la langue et le choix pour les emails
    if (onboarding) {
      const meta = store.session?.user?.user_metadata || {};
      if (meta.consent_at) row.consent_at = meta.consent_at;
      row.emails_hebdo = meta.emails_hebdo !== false;
      row.langue = getLang();
    }
    // Colonne ajoutée par la mise à jour Phase 1 : envoyée seulement si la base la connaît déjà ou si elle est remplie
    if ((f.disponibilite || '').trim() || (initial && 'disponibilite' in initial)) row.disponibilite = (f.disponibilite || '').trim() || null;
    if (v3 && JSON.stringify(vis) !== JSON.stringify(initial?.visibilite || {})) row.visibilite = Object.fromEntries(Object.entries(vis).filter(([k, v]) => VIS_LABELS[k] && VIS_CHOIX.some(c => c[0] === v)));
    const champs = { telephone: co.telephone.trim() || null, email: co.email.trim() || null, contact: co.contact.trim() || null };
    const coordChange = v3 && ['telephone', 'email', 'contact'].some(k => (champs[k] || '') !== (coord0[k] || ''));
    act(async () => {
      if (onboarding) {
        await store.insert('profiles', { id: store.userId, ...row }); oublierInvitation();
        // Le CV lu à l'inscription est gardé comme CV du membre (joint aux candidatures, relu par un lauréat)
        if (cvFichier) await store.deposerCV(cvFichier).catch(() => toast('Ton CV n’a pas pu être gardé : ajoute-le depuis « Mon profil ».', 'err'));
      }
      else await store.update('profiles', initial.id, row);
      if (coordChange) await store.enregistrerCoordonnees(champs);
      toast(onboarding ? 'Bienvenue dans le réseau !' : 'Profil enregistré.');
      onDone?.();
    });
  };
  // Ne remplit que les champs vides (et, à l'inscription, la promo, la filière et le rôle).
  // Depuis le CV, le rôle, la promo et la filière viennent du CV, même avec un lien d'invitation.
  const remplir = (txt, { cv = false } = {}) => {
    const r = typeof txt === 'string' ? parseLinkedin(txt) : txt;
    if (!Object.keys(r).length) return Object.assign([], { ok: false });
    const n = { ...f }, faits = [];
    const vide = k => !String(f[k] ?? '').trim();
    const neuf = !initial;
    if (neuf && (!preset || cv) && r.role && f.role !== 'admin' && r.role !== f.role) { n.role = r.role; faits.push(r.role === 'laureat' ? 'Lauréat(e)' : 'Étudiant(e)'); }
    else if (cv && r.role) faits.push(r.role === 'laureat' ? 'Lauréat(e)' : 'Étudiant(e)');
    for (const [k, l] of [['full_name', 'Nom'], ['poste', 'Poste'], ['entreprise', 'Entreprise'], ['ville', 'Ville'], ['bio', 'Bio'], ['linkedin', 'LinkedIn']]) if (r[k] && vide(k)) { n[k] = r[k]; faits.push(l); }
    if (r.pays && r.pays !== f.pays && (vide('pays') || (neuf && f.pays === 'Maroc'))) { n.pays = r.pays; faits.push('Pays'); }
    if (neuf && (!preset?.promo || cv) && r.promo && r.promo !== +f.promo) { n.promo = r.promo; faits.push(cv ? `Promo ${r.promo}` : 'Promo'); }
    else if (cv && r.promo) faits.push(`Promo ${r.promo}`);
    if (neuf && r.filiere && filPour(n.role, n.promo).some(g => g.options.includes(r.filiere))) { if (r.filiere !== f.filiere) n.filiere = r.filiere; faits.push(cv ? filiereCourte(r.filiere) : 'Filière'); }
    setF(n);
    // Coordonnées privées trouvées dans le CV
    if (r.telephone || r.email) {
      const c = { ...co };
      if (r.telephone && !co.telephone) { c.telephone = r.telephone; faits.push('Téléphone'); }
      if (r.email && !co.email) { c.email = r.email; faits.push('Email'); }
      setCo(c);
    }
    if (r.competences?.length) {
      const deja = comp.split(',').map(x => x.trim()).filter(Boolean);
      const vu = new Set(deja.map(x => x.toLowerCase()));
      const plus = r.competences.filter(c => !vu.has(c.toLowerCase()));
      if (plus.length && deja.length < 15) { setComp([...deja, ...plus].slice(0, 15).join(', ')); faits.push('Compétences'); }
    }
    return faits;
  };
  const isStudent = f.role === 'etudiant';
  // À l'inscription, la promo proposée suit le rôle (on ne touche pas à une promo déjà enregistrée)
  const choisirRole = role => setF(x => ({ ...x, role, promo: initial ? x.promo : role === 'laureat' && +x.promo > an ? an : role === 'etudiant' && +x.promo <= S ? S + 1 : x.promo }));
  const n = !isStudent && initial && !initial.verified ? confirmations(store.data, initial) : 0;
  return html`<form class="form" onSubmit=${submit}>
    ${onboarding ? html`<fieldset class="je-suis"><legend>Tu es…</legend><div class="je-suis-choix">
      ${[['etudiant', 'cap', 'Étudiant(e)', 'De la 1re à la 5e année à l’ENSAM Meknès'], ['laureat', 'briefcase', 'Lauréat(e)', 'Diplômé(e) de l’ENSAM Meknès']].map(([r, ico, t, sous]) => html`<button type="button" id=${'pf-je-' + r} class=${'je-carte' + (f.role === r ? ' on' : '')} aria-pressed=${f.role === r ? 'true' : 'false'} onClick=${() => choisirRole(r)}>
        <span class="je-ico"><${Icon} name=${ico} size=${22}/></span><strong>${t}</strong><span class="small muted">${sous}</span><span class="je-coche"><${Icon} name="check" size=${16}/></span></button>`)}</div></fieldset>`
    : f.role !== 'admin' ? html`<div class="seg" role="group" aria-label="Je suis"><button type="button" class=${isStudent ? 'on' : ''} onClick=${() => choisirRole('etudiant')}>Je suis étudiant(e)</button><button type="button" class=${!isStudent ? 'on' : ''} onClick=${() => choisirRole('laureat')}>Je suis lauréat(e)</button></div>` : null}
    ${ecoleBloque ? html`<div class="cf-warn" role="alert"><p><strong>${onboarding ? 'Inscris-toi avec ton email de l’école.' : 'Un compte étudiant utilise l’email de l’école.'}</strong></p>
      <p class="small">Les comptes étudiants utilisent l’email de l’école : <span dir="ltr" translate="no">${domaines.map(d => '@' + d).join(', ')}</span></p>
      <p class="small">Ton compte actuel n’en fait pas partie : <span dir="ltr" translate="no">${email}</span></p>
      ${onboarding ? html`<p class="small">Tu as déjà ton diplôme ? Choisis « Lauréat(e) » : l’email de l’école n’est demandé qu’aux étudiants.</p>
        <div class="row"><button type="button" class="btn small primary" id="pf-plutot-laureat" onClick=${() => choisirRole('laureat')}>Je suis lauréat(e)</button><button type="button" class="btn small" id="pf-relog" onClick=${() => store.signOut()}><${Icon} name="logout" size=${15}/> Me déconnecter et recommencer</button></div>`
        : html`<p class="small">L’administration de la plateforme peut changer ton rôle si besoin.</p>`}</div>` : null}
    ${onboarding ? html`<${CvBox} onLu=${(r, file) => { setCvFichier(file); return remplir(r, { cv: true }); }}/>` : null}
    ${!f.role ? html`<p class="small muted center" id="pf-choisir">Choisis ci-dessus, ou dépose ton CV : on remplit tout pour toi.</p>` : html`
    ${f.role !== 'admin' ? html`<${LinkedinBox} onFill=${remplir}/>` : null}
    <div class="grid2">
      <${Field} label="Nom complet"><input id="pf-name" required value=${f.full_name} onInput=${e => set('full_name', e.target.value)} maxlength="80"/><//>
      <${Field} label=${isStudent ? 'Promo (année de diplôme prévue)' : 'Promo (année de diplôme)'} hint=${isStudent ? 'Ex. en 5A cette année : ' + (new Date().getMonth() >= 8 ? new Date().getFullYear() + 1 : new Date().getFullYear()) + '. Ton niveau se met à jour tout seul chaque année.' : ''}><input id="pf-promo" type="number" min="1990" max="2040" required value=${f.promo} onInput=${e => set('promo', e.target.value)}/><//>
    </div>
    ${incoherent ? html`<div class="cf-warn" role="alert" id="pf-incoherent"><p class="small">${incoherent === 'futur' ? `Promo ${promoN} : ton diplôme n’est pas encore là. Tu es étudiant(e) ?` : incoherent === 'diplome' ? `Promo ${promoN} : tu as déjà ton diplôme ? Alors tu es lauréat(e).` : `Vérifie ta promo : cette saison, la 1re année est la promo ${S + 5}.`}</p>
      ${incoherent === 'loin' ? null : html`<div><button type="button" class="btn small" id="pf-role-ok" onClick=${() => choisirRole(incoherent === 'futur' ? 'etudiant' : 'laureat')}>${incoherent === 'futur' ? 'Je suis étudiant(e)' : 'Je suis lauréat(e)'}</button></div>`}</div>` : null}
    <${Field} label="Filière" hint=${garde && filiere === garde ? 'Nouveau : choisis ta filière dans la liste officielle de l’école.' : filiere === PREPA ? 'La filière se choisit en 3e année.' : ''}><select id="pf-fil" value=${filiere} onChange=${e => set('filiere', e.target.value)}>
      ${garde ? html`<option value=${garde}>${garde}</option>` : null}
      ${groupesFil.map(g => html`<optgroup label=${g.label}>${g.options.map(x => html`<option value=${x}>${x}</option>`)}</optgroup>`)}</select><//>
    ${!isStudent ? html`<div class="grid3"><${Field} label="Entreprise"><input id="pf-ent" value=${f.entreprise || ''} onInput=${e => set('entreprise', e.target.value)}/><//><${Field} label="Poste"><input id="pf-poste" value=${f.poste || ''} onInput=${e => set('poste', e.target.value)}/><//>
      <${Field} label="Secteur"><select id="pf-sect" value=${f.secteur || ''} onChange=${e => set('secteur', e.target.value)}><option value="">—</option>${SECTEURS.map(x => html`<option value=${x}>${x}</option>`)}</select><//></div>` : null}
    <div class="grid2"><${Field} label="Ville"><input id="pf-ville" value=${f.ville || ''} onInput=${e => set('ville', e.target.value)}/><//><${Field} label="Pays"><input id="pf-pays" value=${f.pays || ''} onInput=${e => set('pays', e.target.value)}/><//></div>
    <${Field} label="Bio courte"><textarea id="pf-bio" rows="3" maxlength="600" value=${f.bio || ''} onInput=${e => set('bio', e.target.value)} placeholder=${isStudent ? 'Ce que tu cherches, tes projets…' : 'Ton parcours, comment tu peux aider…'}></textarea><//>
    <${Field} label="Compétences" hint="Séparées par des virgules"><input id="pf-comp" value=${comp} onInput=${e => setComp(e.target.value)} placeholder="Lean, CATIA, Python…"/><//>
    ${isStudent ? html`<div class="grid2"><${Field} label="LinkedIn"><input id="pf-li" value=${f.linkedin || ''} onInput=${e => set('linkedin', e.target.value)} placeholder="linkedin.com/in/…"/><//>
      <${Field} label="Disponibilité"><input id="pf-dispo" maxlength="80" value=${f.disponibilite || ''} onInput=${e => set('disponibilite', e.target.value)} placeholder="Ex. dès février, 6 mois"/><//></div>
      <${Field} label="Ou un lien vers ton CV (facultatif)" hint="Google Drive ou autre, si tu n’as pas déposé de PDF."><input id="pf-cv" value=${f.cv_url || ''} onInput=${e => set('cv_url', e.target.value)} placeholder="https://…"/><//>`
    : html`<${Field} label="LinkedIn"><input id="pf-li" value=${f.linkedin || ''} onInput=${e => set('linkedin', e.target.value)} placeholder="linkedin.com/in/…"/><//>`}
    ${!v3 ? html`<${Field} label="Contact visible par les membres"><input id="pf-contact" value=${f.contact || ''} onInput=${e => set('contact', e.target.value)} placeholder="Email ou téléphone"/><//>` : null}
    ${isStudent ? html`<label class="check"><input id="pf-vit" type="checkbox" checked=${f.vitrine} onChange=${e => set('vitrine', e.target.checked)}/> Apparaître dans la Vitrine des talents quand je cherche (visible par les lauréats)</label>` : html`
      <label class="check"><input id="pf-mentor" type="checkbox" checked=${f.mentor_dispo} onChange=${e => set('mentor_dispo', e.target.checked)}/> Je suis disponible pour du mentorat</label>
      ${f.mentor_dispo ? html`<${Field} label="Sujets sur lesquels je peux aider"><input id="pf-msuj" value=${f.mentor_sujets || ''} onInput=${e => set('mentor_sujets', e.target.value)} placeholder="Stages à l’étranger, entretiens, automobile…"/><//>` : null}
      ${f.role === 'laureat' ? html`<label class="check"><input id="pf-parrain" type="checkbox" checked=${f.parrain_dispo} onChange=${e => set('parrain_dispo', e.target.checked)}/> Je veux bien parrainer un à trois étudiants de 3A de ma filière</label>` : null}`}
    ${v3 ? html`<fieldset class="cf-private">
      <legend class="h-ico"><${Icon} name="lock" size=${17}/> Mes coordonnées (privées)</legend>
      <p class="small muted">Visibles seulement par les membres que tu acceptes, et par le lauréat à qui tu envoies une candidature.</p>
      <div class="grid2"><${Field} label="Téléphone"><input id="pf-tel" type="tel" maxlength="30" dir="ltr" value=${co.telephone} onInput=${e => setC('telephone', e.target.value)} placeholder="06 …"/><//>
        <${Field} label="Email de contact"><input id="pf-mail" type="email" maxlength="120" dir="ltr" value=${co.email} onInput=${e => setC('email', e.target.value)} placeholder="prenom.nom@…"/><//></div>
      <${Field} label="Autre (facultatif)"><input id="pf-contact" maxlength="200" value=${co.contact} onInput=${e => setC('contact', e.target.value)} placeholder="Ex. WhatsApp, plutôt le soir"/><//>
    </fieldset>
    <${VisibiliteFields} role=${f.role} value=${vis} onChange=${setVis}/>` : null}
    ${f.role === 'laureat' && !initial?.verified ? html`<p class="small muted">${v3 ? 'Ton badge « Lauréat vérifié » arrive quand l’administration, ou deux lauréats vérifiés de ta promo, confirment ton profil.' : 'Ton badge « Lauréat vérifié » sera ajouté par l’administration de l’école.'}${n ? html` <b>${n}/2</b>` : null}</p>` : null}`}
    <div class="row-end"><button class="btn primary" disabled=${!ok}>${onboarding ? 'Rejoindre la communauté' : 'Enregistrer'}</button></div>
  </form>`;
}

export { levelOf, LevelChip };
