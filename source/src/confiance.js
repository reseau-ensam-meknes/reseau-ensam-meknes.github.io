// Confiance : signaler, coordonnées après accord, visibilité du profil, vérification par les pairs.
import { html, useState, useEffect } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Person, toast, injectCSS, useLocal } from './ui.js';
import { addAR } from './i18n.js';
import { VIS_DEFAUT } from './store.js';
import { timeAgo } from './logic.js';

// ---------------------------------------------------------------------------
// Signaler un contenu ou un profil
// ---------------------------------------------------------------------------
export const MOTIFS = [
  ['spam', 'Spam ou publicité'], ['arnaque', 'Arnaque ou offre douteuse'], ['faux', 'Faux profil ou fausse information'],
  ['inapproprie', 'Propos déplacés ou offensants'], ['harcelement', 'Harcèlement'], ['donnees', 'Données personnelles exposées'], ['autre', 'Autre chose'],
];
const CIBLES = { offre: 'cette offre', commentaire: 'ce commentaire', question: 'cette question', reponse: 'cette réponse', message: 'ce message', profil: 'ce profil', entretien: 'ce témoignage d’entretien', avis: 'cet avis', guide: 'cette rubrique', cafe: 'ce café', startup: 'cette startup', relecture: 'cette relecture', prive: 'ce message' };

// type : offre, commentaire, question, reponse, message, profil, entretien, avis, guide, cafe, startup, relecture
export function SignalerBtn({ ctx, type, id, small }) {
  const [open, setOpen] = useState(false);
  const { me, data } = ctx || {};
  if (!me || !id || me.role === 'admin' || (type === 'profil' && id === me.id)) return null;
  const done = (data.signalements || []).some(s => s.auteur_id === me.id && s.cible_type === type && s.cible_id === id);
  if (done) return html`<span class=${'cf-signale' + (small ? ' small' : '')} title="Tu as signalé ce contenu. Merci !"><${Icon} name="flag" size=${13}/>${small ? null : html`<span>Signalé</span>`}</span>`;
  return html`<button type="button" class=${'cf-signal' + (small ? ' small' : '')} aria-label="Signaler" title="Signaler" onClick=${e => { e.stopPropagation(); setOpen(true); }}>
      <${Icon} name="flag" size=${small ? 14 : 15}/>${small ? null : html`<span>Signaler</span>`}</button>
    ${open ? html`<${SignalerModal} ctx=${ctx} type=${type} id=${id} onClose=${() => setOpen(false)}/>` : null}`;
}

function SignalerModal({ ctx, type, id, onClose }) {
  const { store, me, act } = ctx;
  const [motif, setMotif] = useState('');
  const [details, setDetails] = useState('');
  const send = e => {
    e.preventDefault(); if (!motif) return;
    act(async () => {
      await store.insert('signalements', { auteur_id: me.id, cible_type: type, cible_id: id, motif, details: details.trim() || null });
      toast('Merci. L’administration va regarder.'); onClose();
    });
  };
  return html`<${Modal} title="Signaler" onClose=${onClose}>
    <form class="form" onSubmit=${send} onClick=${e => e.stopPropagation()}>
      <p>Qu’est-ce qui ne va pas avec ${CIBLES[type] || 'ce contenu'} ?</p>
      <div class="cf-motifs" role="radiogroup" aria-label="Motif">${MOTIFS.map(([k, l]) => html`<label class=${'cf-motif' + (motif === k ? ' on' : '')} key=${k}>
        <input type="radio" name="cf-motif" id=${'cf-motif-' + k} value=${k} checked=${motif === k} onChange=${() => setMotif(k)}/><span>${l}</span></label>`)}</div>
      <${Field} label="Un détail pour l’administration (facultatif)"><textarea id="cf-details" rows="3" maxlength="600" value=${details} onInput=${e => setDetails(e.target.value)} placeholder="Ce que tu as remarqué…"></textarea><//>
      <p class="small hint-box"><${Icon} name="lock" size=${15}/> <span>Seule l’administration voit ton signalement. La personne concernée ne sait pas qui l’a fait.</span></p>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" id="cf-send" disabled=${!motif}>Envoyer</button></div>
    </form>
  <//>`;
}

// ---------------------------------------------------------------------------
// Visibilité du profil : qui voit quoi
// ---------------------------------------------------------------------------
export const VIS_CHOIX = [['tous', 'Tous les membres'], ['laureats', 'Les lauréats'], ['contacts', 'Mes contacts']];
export const VIS_LABELS = { travail: 'Entreprise et poste', lieu: 'Ville', linkedin: 'LinkedIn', presentation: 'Bio, compétences, disponibilité', cv: 'CV' };
export const visGroupes = role => role === 'etudiant' ? ['lieu', 'linkedin', 'presentation', 'cv'] : role === 'laureat' ? ['travail', 'lieu', 'linkedin', 'presentation', 'cv'] : [];
const remplis = { travail: p => p.entreprise || p.poste, lieu: p => p.ville, linkedin: p => p.linkedin, presentation: p => p.bio || (p.competences || []).length || p.disponibilite, cv: p => p.cv_path || p.cv_url };
// Ce que ce membre a rempli mais que je ne peux pas voir (en démo ; en ligne la base l'a déjà retiré)
export const groupesMasques = (store, p) => Object.keys(VIS_LABELS).filter(g => remplis[g](p) && !store.voitChamp(p, g));

export function VisibiliteFields({ role, value = {}, onChange }) {
  const groupes = visGroupes(role);
  if (!groupes.length) return null;
  return html`<fieldset class="cf-vis">
    <legend class="h-ico"><${Icon} name="eye" size=${17}/> Qui voit quoi</legend>
    <p class="small muted">Ton profil n’est jamais public. « Mes contacts » : les membres dont tu acceptes la demande, et le lauréat à qui tu envoies une candidature.</p>
    ${groupes.map(g => { const v = value[g] || VIS_DEFAUT[g]; const label = g === 'presentation' && role !== 'etudiant' ? 'Bio et compétences' : VIS_LABELS[g]; return html`<div class="cf-vis-row" key=${g}>
      <span class="cf-vis-label">${label}</span>
      <div class="seg cf-vis-seg" role="radiogroup" aria-label=${label}>${VIS_CHOIX.map(([k, l]) => html`<button type="button" role="radio" id=${`vis-${g}-${k}`} aria-checked=${v === k} class=${v === k ? 'on' : ''} onClick=${() => onChange({ ...value, [g]: k })}>${l}</button>`)}</div>
    </div>`; })}
  </fieldset>`;
}

// ---------------------------------------------------------------------------
// Coordonnées (téléphone, email…) : visibles après accord
// ---------------------------------------------------------------------------
const rechargees = new Set();
// En ligne, un accord change ce que la base laisse voir : on recharge une fois les coordonnées et les profils
function useRechargeContact(store, d, coord) {
  useEffect(() => {
    if (store.mode !== 'live' || !d || d.status !== 'acceptee' || coord || !store.loadTable) return;
    const k = d.id + d.status; if (rechargees.has(k)) return; rechargees.add(k);
    Promise.all([store.loadTable('coordonnees'), store.loadTable('profiles')])
      .then(() => { store.me = store.byId('profiles', store.userId) || store.me; store.emit(); }).catch(() => {});
  }, [d?.id, d?.status, !!coord]);
}

const prenom = p => (p?.full_name || 'Ce membre').split(' ')[0];

export function ContactBlock({ ctx, p }) {
  const { store, me, act } = ctx;
  const [ask, setAsk] = useState(false);
  const coord = store.coordonneesDe(p.id);
  const d = store.contactAvec(p.id);
  useRechargeContact(store, d, coord);
  const mine = p.id === me.id;
  const c = coord || (p.contact ? { contact: p.contact } : null); // avant la mise à jour de la base : l'ancien champ public
  const has = c && (c.telephone || c.email || c.contact);
  const entrant = d && d.demandeur_id === p.id;
  const repondre = status => act(async () => { await store.update('demandes_contact', d.id, { status }); toast(status === 'acceptee' ? 'Accepté : vous voyez maintenant vos coordonnées.' : 'C’est noté.'); });
  let body;
  if (has) body = html`<ul class="cf-coord">
      ${c.telephone ? html`<li><${Icon} name="phone" size=${15}/><a href=${'tel:' + c.telephone.replace(/[^\d+]/g, '')} dir="ltr" translate="no">${c.telephone}</a></li>` : null}
      ${c.email ? html`<li><${Icon} name="mail" size=${15}/><a href=${'mailto:' + c.email} dir="ltr" translate="no">${c.email}</a></li>` : null}
      ${c.contact ? html`<li><${Icon} name="comment" size=${15}/><span class="sel" translate="no" dir="auto">${c.contact}</span></li>` : null}
    </ul>${mine ? html`<p class="small muted">Visibles seulement par tes contacts. Modifie-les dans « Mon profil ».</p>` : null}`;
  else if (mine) body = html`<p class="small muted">Tu n’as pas encore renseigné de coordonnées. Ajoute-les dans « Mon profil » : elles restent privées.</p>`;
  else if (me.role === 'admin' || p.role === 'admin') body = html`<p class="small muted">Aucune coordonnée renseignée.</p>`;
  else if (!d) body = html`<p class="small muted">Ses coordonnées restent privées tant que la personne n’a pas accepté.</p>
      <div><button class="btn small" id="cf-ask" onClick=${() => setAsk(true)}><${Icon} name="phone" size=${15}/> Demander ses coordonnées</button></div>`;
  else if (entrant && d.status === 'envoyee') body = html`<div class="cf-in">
      <p><strong>${prenom(p)} aimerait avoir tes coordonnées.</strong></p>
      ${d.message ? html`<p class="cf-msg small" translate="no" dir="auto">« ${d.message} »</p>` : null}
      <p class="small muted">Si tu acceptes, vous voyez les coordonnées l’un de l’autre.</p>
      <div class="row-end"><button class="btn small ghost" id="cf-refuse" onClick=${() => repondre('refusee')}>Refuser</button><button class="btn small primary" id="cf-accept" onClick=${() => repondre('acceptee')}><${Icon} name="check" size=${15}/> Accepter</button></div></div>`;
  else if (entrant && d.status === 'acceptee') body = html`<p class="small muted">Tu as accepté sa demande, mais ${prenom(p)} n’a pas encore renseigné de coordonnées.</p>`;
  else if (entrant) body = html`<p class="small muted">Tu as refusé sa demande.</p><div><button class="btn tiny ghost" onClick=${() => repondre('acceptee')}>Accepter finalement</button></div>`;
  else if (d.status === 'envoyee') body = html`<p class="small"><${Icon} name="clock" size=${14}/> Demande envoyée, en attente de sa réponse. <span class="muted">${timeAgo(d.created_at)}</span></p>
      <div><button class="btn tiny ghost" onClick=${() => act(async () => { await store.remove('demandes_contact', d.id); toast('Demande annulée.'); })}>Annuler la demande</button></div>`;
  else if (d.status === 'acceptee') body = html`<p class="small muted">${prenom(p)} a accepté, mais n’a pas encore renseigné de coordonnées.</p>`;
  else body = html`<p class="small muted">${prenom(p)} préfère garder ses coordonnées pour l’instant. Pour un conseil, passe par le mentorat ou l’entraide.</p>`;
  const accord = entrant && d.status === 'acceptee' && has;
  return html`<div class="cf-box" id="cf-contact">
    <div class="cf-box-head"><h3 class="h-ico"><${Icon} name="lock" size=${16}/> Coordonnées</h3>
      ${accord ? html`<button class="btn tiny ghost" onClick=${() => repondre('refusee')}>Retirer mon accord</button>` : null}</div>
    ${body}
    ${ask ? html`<${DemandeContact} ctx=${ctx} p=${p} onClose=${() => setAsk(false)}/>` : null}
  </div>`;
}

function DemandeContact({ ctx, p, onClose }) {
  const { store, me, act } = ctx;
  const [msg, setMsg] = useState('');
  return html`<${Modal} title="Demander ses coordonnées" onClose=${onClose}>
    <form class="form" onSubmit=${e => { e.preventDefault(); act(async () => { await store.insert('demandes_contact', { demandeur_id: me.id, cible_id: p.id, message: msg.trim() || null }); toast('Demande envoyée.'); onClose(); }); }}>
      <p>${p.full_name} reçoit ta demande et choisit d’accepter ou non. En cas d’accord, vous voyez les coordonnées l’un de l’autre.</p>
      <${Field} label="Un mot pour te présenter (facultatif)"><textarea id="cf-ask-msg" rows="3" maxlength="300" value=${msg} onInput=${e => setMsg(e.target.value)} placeholder=${me.role === 'etudiant' ? 'Ex. Je suis en 5A, j’aimerais vous poser deux questions sur votre métier.' : 'Ex. Même promo, je serais ravi(e) d’échanger.'}></textarea><//>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" id="cf-ask-send">Envoyer la demande</button></div>
    </form>
  <//>`;
}

// ---------------------------------------------------------------------------
// Vérification d'un lauréat par deux lauréats vérifiés de sa promo
// ---------------------------------------------------------------------------
export const confirmations = (data, p) => (data.verifications_pairs || []).filter(v => v.laureat_id === p.id)
  .map(v => data.profiles.find(x => x.id === v.verificateur_id)).filter(x => x && x.role === 'laureat' && x.verified && x.promo === p.promo).length;
const peutConfirmer = (me, p) => me.role === 'laureat' && me.verified && p.role === 'laureat' && !p.verified && p.id !== me.id && p.promo === me.promo;

export function PairVerify({ ctx, p }) {
  const { data, me, store, act } = ctx;
  if (!peutConfirmer(me, p)) return null;
  const n = confirmations(data, p);
  const moi = (data.verifications_pairs || []).find(v => v.laureat_id === p.id && v.verificateur_id === me.id);
  return html`<div class="cf-box cf-pair" id="cf-pair">
    <div class="cf-box-head"><h3 class="h-ico"><${Icon} name="shield" size=${16}/> ${prenom(p)} est de ta promo ?</h3><span class="mini mono">${n}/2</span></div>
    ${moi ? html`<p class="small"><${Icon} name="check" size=${14}/> Tu as confirmé. Encore ${Math.max(0, 2 - n)} confirmation${2 - n > 1 ? 's' : ''} et son badge arrive.</p>
        <div><button class="btn tiny ghost" onClick=${() => act(() => store.remove('verifications_pairs', moi.id))}>Annuler ma confirmation</button></div>`
      : html`<p class="small muted">Deux lauréats vérifiés de la promo ${p.promo} suffisent pour lui donner son badge. Confirme seulement si tu le ou la connais.</p>
        <div><button class="btn small primary" id="cf-pair-ok" onClick=${() => act(async () => { await store.insert('verifications_pairs', { laureat_id: p.id, verificateur_id: me.id }); toast('Merci, ta confirmation est enregistrée.'); })}><${Icon} name="check" size=${15}/> Je confirme : promo ${p.promo}, comme moi</button></div>`}
  </div>`;
}

// ---------------------------------------------------------------------------
// Accueil : demandes de coordonnées reçues, lauréats de ma promo à confirmer
// ---------------------------------------------------------------------------
export function ConfianceHome({ ctx }) {
  const { data, me, store, act, openProfile } = ctx;
  const [ignores, setIgnores] = useLocal('cf-ignore-' + me.id, []);
  const demandes = (data.demandes_contact || []).filter(d => d.cible_id === me.id && d.status === 'envoyee')
    .map(d => ({ d, p: store.byId('profiles', d.demandeur_id) })).filter(x => x.p).sort((a, b) => new Date(b.d.created_at) - new Date(a.d.created_at));
  const pairs = data.profiles.filter(p => peutConfirmer(me, p) && !ignores.includes(p.id) && !(data.verifications_pairs || []).some(v => v.laureat_id === p.id && v.verificateur_id === me.id));
  if (!demandes.length && !pairs.length) return null;
  const repondre = (d, status) => act(async () => { await store.update('demandes_contact', d.id, { status }); toast(status === 'acceptee' ? 'Accepté : vous voyez maintenant vos coordonnées.' : 'C’est noté.'); });
  return html`<div class="panel cf-home">
    ${demandes.length ? html`<div class="section-head"><h2 class="h-ico"><${Icon} name="phone"/> Demandes de coordonnées <span class="count">${demandes.length}</span></h2></div>
      <ul class="people-list cf-list">${demandes.slice(0, 4).map(({ d, p }) => html`<li key=${d.id}>
        <div class="cf-who"><${Person} p=${p} onOpen=${openProfile} size=${34}/>${d.message ? html`<p class="cf-msg small" translate="no" dir="auto">« ${d.message} »</p>` : null}</div>
        <div class="cf-act"><button class="btn tiny ghost" onClick=${() => repondre(d, 'refusee')}>Refuser</button><button class="btn tiny primary" onClick=${() => repondre(d, 'acceptee')}><${Icon} name="check" size=${14}/> Accepter</button></div></li>`)}</ul>
      <p class="small muted">Si tu acceptes, vous voyez les coordonnées l’un de l’autre.</p>` : null}
    ${pairs.length ? html`<div class="section-head"><h2 class="h-ico"><${Icon} name="shield"/> De ta promo ${me.promo} ?</h2></div>
      <p class="small muted">Confirme ceux que tu connais : avec deux confirmations, leur badge « vérifié » arrive.</p>
      <ul class="people-list cf-list">${pairs.slice(0, 3).map(p => html`<li key=${p.id}>
        <div class="cf-who"><${Person} p=${p} onOpen=${openProfile} size=${34} sub=${`${p.filiere} · ${confirmations(data, p)}/2`}/></div>
        <div class="cf-act"><button class="btn tiny ghost" onClick=${() => setIgnores([...ignores, p.id])}>Je ne sais pas</button><button class="btn tiny primary" onClick=${() => act(async () => { await store.insert('verifications_pairs', { laureat_id: p.id, verificateur_id: me.id }); toast('Merci, ta confirmation est enregistrée.'); })}><${Icon} name="check" size=${14}/> Je confirme</button></div></li>`)}</ul>` : null}
  </div>`;
}

injectCSS('confiance', `
.cf-signal { display: inline-flex; align-items: center; gap: .3rem; border: 0; background: none; color: var(--muted); font: inherit; font-size: .8rem; padding: .25rem .4rem; border-radius: 7px; cursor: pointer; }
.cf-signal:hover, .cf-signal:focus-visible { color: var(--bad); background: var(--bad-soft); }
.cf-signal.small { padding: .3rem; }
.cf-signale { display: inline-flex; align-items: center; gap: .3rem; color: var(--muted); font-size: .8rem; padding: .25rem .4rem; opacity: .75; }
.cf-motifs { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: .4rem; }
.cf-motif { display: flex; align-items: center; gap: .5rem; padding: .55rem .7rem; border: 1px solid var(--line); border-radius: 9px; cursor: pointer; font-size: .9rem; background: var(--surface); }
.cf-motif:hover { border-color: var(--ink-2); }
.cf-motif.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.cf-motif input { accent-color: var(--accent); margin: 0; }
.cf-box { border: 1px solid var(--line); border-radius: var(--r); padding: .75rem .9rem; display: flex; flex-direction: column; gap: .45rem; background: var(--surface); }
.cf-box p { margin: 0; }
.cf-box-head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
.cf-box-head h3 { margin: 0; font-size: .95rem; }
.cf-box-head .mini { margin: 0; }
.cf-pair { background: var(--accent-soft); border-color: transparent; }
.cf-pair h3 { color: var(--accent); }
.cf-coord { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .35rem; }
.cf-coord li { display: flex; align-items: center; gap: .5rem; min-width: 0; }
.cf-coord li svg { flex: none; color: var(--accent); }
.cf-coord a, .cf-coord span { overflow-wrap: anywhere; }
.cf-in { display: flex; flex-direction: column; gap: .4rem; }
.cf-msg { color: var(--ink-2); font-style: italic; margin: 0; overflow-wrap: anywhere; }
.cf-locked { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem; margin: 0; }
.cf-locked .mini { margin: 0; }
.cf-vis, .cf-private { border: 1px solid var(--line); border-radius: var(--r); padding: .8rem .9rem; margin: 0; display: flex; flex-direction: column; gap: .55rem; min-width: 0; }
.cf-vis legend, .cf-private legend { padding: 0 .35rem; font-weight: 600; }
.cf-vis p, .cf-private p { margin: 0; }
.cf-vis-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: .4rem .8rem; }
.cf-vis-label { font-size: .9rem; }
.cf-vis-seg { margin: 0; }
.cf-vis-seg button { font-size: .8rem; padding: .3rem .6rem; }
.cf-warn { background: var(--warn-soft); color: var(--ink); border-radius: var(--r); padding: .7rem .8rem; display: flex; flex-direction: column; gap: .45rem; }
.cf-warn p { margin: 0; }
.cf-list li { align-items: flex-start; }
.cf-who { display: flex; flex-direction: column; gap: .25rem; min-width: 0; flex: 1 1 220px; }
.cf-act { display: flex; gap: .35rem; align-items: center; margin-inline-start: auto; }
.profile-foot { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
.cf-alertes { display: flex; flex-direction: column; gap: .4rem; padding: .6rem 0; border-block: 1px solid var(--line); }
.cf-alertes .check.sub { padding-inline-start: 1.6rem; }
@media (max-width: 640px) {
  .cf-vis-row { grid-template-columns: minmax(0, 1fr); }
  .cf-vis-seg { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .cf-vis-seg button { padding: .35rem .2rem; }
  .cf-motifs { grid-template-columns: minmax(0, 1fr); }
}
`);

// ---------------------------------------------------------------------------
// Arabe
// ---------------------------------------------------------------------------
const CIBLES_AR = { 'cette offre': 'هذا العرض', 'ce commentaire': 'هذا التعليق', 'cette question': 'هذا السؤال', 'cette réponse': 'هذا الجواب', 'ce message': 'هذه الرسالة', 'ce profil': 'هذا الملف', 'ce témoignage d’entretien': 'شهادة المقابلة هذه', 'cet avis': 'هذا الرأي', 'cette rubrique': 'هذا القسم', 'ce café': 'هذا اللقاء', 'cette startup': 'هذه الشركة الناشئة', 'cette relecture': 'هذه المراجعة', 'ce contenu': 'هذا المحتوى' };
addAR({
  'Signaler': 'إبلاغ', 'Signalé': 'تم الإبلاغ', 'Tu as signalé ce contenu. Merci !': 'لقد أبلغت عن هذا المحتوى. شكرًا!',
  'Spam ou publicité': 'رسائل مزعجة أو إشهار', 'Arnaque ou offre douteuse': 'احتيال أو عرض مشبوه', 'Faux profil ou fausse information': 'ملف مزيف أو معلومة خاطئة',
  'Propos déplacés ou offensants': 'كلام غير لائق أو مسيء', 'Harcèlement': 'تحرش أو مضايقة', 'Données personnelles exposées': 'بيانات شخصية منشورة', 'Autre chose': 'شيء آخر',
  'Motif': 'السبب', 'Un détail pour l’administration (facultatif)': 'تفصيل للإدارة (اختياري)', 'Ce que tu as remarqué…': 'ما لاحظته…',
  'Seule l’administration voit ton signalement. La personne concernée ne sait pas qui l’a fait.': 'الإدارة وحدها ترى بلاغك، ولا يعرف الشخص المعني من قام به.',
  'Merci. L’administration va regarder.': 'شكرًا. ستطّلع الإدارة على الأمر.',
  'Qui voit quoi': 'من يرى ماذا', 'Tous les membres': 'كل الأعضاء', 'Les lauréats': 'الخريجون', 'Mes contacts': 'جهات اتصالي',
  'Ton profil n’est jamais public. « Mes contacts » : les membres dont tu acceptes la demande, et le lauréat à qui tu envoies une candidature.': 'ملفك ليس عموميًا أبدًا. «جهات اتصالي»: الأعضاء الذين تقبل طلبهم، والخريج الذي ترسل إليه ترشيحك.',
  'Entreprise et poste': 'الشركة والمنصب', 'Ville': 'المدينة', 'Bio, compétences, disponibilité': 'النبذة، الكفاءات، التوفر', 'Bio et compétences': 'النبذة والكفاءات', 'CV': 'السيرة الذاتية',
  'Coordonnées': 'معلومات الاتصال', 'Demander ses coordonnées': 'اطلب معلومات الاتصال',
  'Ses coordonnées restent privées tant que la personne n’a pas accepté.': 'تبقى معلومات الاتصال خاصة ما لم يقبل صاحبها.',
  'Visibles seulement par tes contacts. Modifie-les dans « Mon profil ».': 'لا تراها إلا جهات اتصالك. عدّلها في «ملفي الشخصي».',
  'Tu n’as pas encore renseigné de coordonnées. Ajoute-les dans « Mon profil » : elles restent privées.': 'لم تضف معلومات اتصالك بعد. أضفها في «ملفي الشخصي»، وستبقى خاصة.',
  'Aucune coordonnée renseignée.': 'لا توجد معلومات اتصال.', 'Si tu acceptes, vous voyez les coordonnées l’un de l’autre.': 'إذا قبلت، يرى كل منكما معلومات اتصال الآخر.',
  'Refuser': 'رفض', 'Accepter': 'قبول', 'Tu as refusé sa demande.': 'لقد رفضت طلبه.', 'Accepter finalement': 'القبول في النهاية',
  'Demande envoyée, en attente de sa réponse.': 'أُرسل الطلب، في انتظار الرد.',
  'Annuler la demande': 'إلغاء الطلب', 'Demande annulée.': 'أُلغي الطلب.', 'Retirer mon accord': 'سحب موافقتي',
  'Accepté : vous voyez maintenant vos coordonnées.': 'تم القبول: يمكنكما الآن رؤية معلومات الاتصال.', 'C’est noté.': 'تم التسجيل.',
  'Un mot pour te présenter (facultatif)': 'كلمة لتقديم نفسك (اختياري)', 'Envoyer la demande': 'إرسال الطلب', 'Demande envoyée.': 'أُرسل الطلب.',
  'Ex. Je suis en 5A, j’aimerais vous poser deux questions sur votre métier.': 'مثال: أنا في السنة الخامسة، وأود أن أطرح عليكم سؤالين حول مهنتكم.',
  'Ex. Même promo, je serais ravi(e) d’échanger.': 'مثال: من نفس الدفعة، يسعدني التواصل معك.',
  'Annuler ma confirmation': 'إلغاء تأكيدي', 'Merci, ta confirmation est enregistrée.': 'شكرًا، تم تسجيل تأكيدك.',
  'Demandes de coordonnées': 'طلبات معلومات الاتصال', 'Je ne sais pas': 'لا أعرف', 'Je confirme': 'أؤكد',
  'Confirme ceux que tu connais : avec deux confirmations, leur badge « vérifié » arrive.': 'أكّد من تعرفهم: بتأكيدين يحصلون على شارة «موثَّق».',
  'Visible après accord :': 'يظهر بعد الموافقة:',
}, [
  [/^Qu’est-ce qui ne va pas avec (.+) \?$/, x => `ما المشكل في ${CIBLES_AR[x] || x}؟`],
  [/^(.+?) aimerait avoir tes coordonnées\.$/, n => `يود ${n} الحصول على معلومات اتصالك.`],
  [/^(.+?) a accepté : ses coordonnées sont sur son profil\.$/, n => `قبل ${n}: معلومات اتصاله في ملفه الشخصي.`],
  [/^Tu as accepté sa demande, mais (.+?) n’a pas encore renseigné de coordonnées\.$/, n => `قبلت طلبه، لكن ${n} لم يضف معلومات اتصاله بعد.`],
  [/^(.+?) a accepté, mais n’a pas encore renseigné de coordonnées\.$/, n => `قبل ${n}، لكنه لم يضف معلومات اتصاله بعد.`],
  [/^(.+?) préfère garder ses coordonnées pour l’instant\. Pour un conseil, passe par le mentorat ou l’entraide\.$/, n => `يفضل ${n} الاحتفاظ بمعلومات اتصاله حاليًا. لطلب نصيحة، استعمل الإرشاد أو التعاون.`],
  [/^(.+?) reçoit ta demande et choisit d’accepter ou non\. En cas d’accord, vous voyez les coordonnées l’un de l’autre\.$/, n => `سيتوصل ${n} بطلبك ويختار القبول أو الرفض. في حال الموافقة، يرى كل منكما معلومات اتصال الآخر.`],
  [/^(.+?) est de ta promo \?$/, n => `هل ${n} من دفعتك؟`],
  [/^Tu as confirmé\. Encore (\d+) confirmations? et son badge arrive\.$/, n => `لقد أكدت. ${+n === 1 ? 'تأكيد واحد آخر' : `${n} تأكيدات أخرى`} ويحصل على شارته.`],
  [/^Deux lauréats vérifiés de la promo (\d{4}) suffisent pour lui donner son badge\. Confirme seulement si tu le ou la connais\.$/, y => `يكفي خريجان موثَّقان من دفعة ${y} لمنحه الشارة. لا تؤكد إلا إذا كنت تعرفه.`],
  [/^Je confirme : promo (\d{4}), comme moi$/, y => `أؤكد: دفعة ${y}، مثلي`],
  [/^De ta promo (\d{4}) \?$/, y => `من دفعتك ${y}؟`],
  // Notifications calculées dans app.js
  [/^(\d+) lauréats de ta promo attendent ta vérification\.$/, n => `${n} خريجين من دفعتك ينتظرون تأكيدك.`],
  [/^(.+?) \(promo (\d{4})\) attend ta vérification\.$/, (n, y) => `${n} (دفعة ${y}) ينتظر تأكيدك.`],
  [/^(.+?) a confirmé que tu es de la promo (\d{4})\.$/, (n, y) => `أكد ${n} أنك من دفعة ${y}.`],
  [/^(.+?) a confirmé que tu es de la promo (\d{4})\. Encore un lauréat et ton badge arrive\.$/, (n, y) => `أكد ${n} أنك من دفعة ${y}. تأكيد خريج آخر وتحصل على شارتك.`],
  [/^(\d+) signalements? à traiter\.$/, n => `بلاغات للمعالجة: ${n}`],
]);
