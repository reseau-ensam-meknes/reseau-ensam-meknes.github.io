// « Mon parcours » (étudiants) et « Mon espace » (lauréats).
import { html, useState } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Avatar, Bar, toast, LevelChip, CompanyLogo, TYPE_ICON, Num, celebrate, injectCSS } from './ui.js';
import { addAR, arCount } from './i18n.js';
import { PoulsReseau } from './pouls.js';
import { OBJECTIFS, NIVEAUX, TYPES, niveauOf, statutOf, typeForNiveau, seasonLabel, timeAgo, levelOf, BADGES, badgesOf, BAREME, computeScores, NIVEAUX_IMPACT, mentorState } from './logic.js';
import { APP_STATUS, OfferComposer } from './offers.js';
import { AttestationCard, ShareModal } from './growth.js';
import { Filleuls, ParrainCard } from './saison.js';
import { BilanCard } from './recrutement.js';
import { SlotDate } from './mentorat.js';

// Étapes vues par l'étudiant : il postule, le lauréat fait avancer, l'étudiant confirme.
const JOURNEY = [['send', 'Je postule'], ['people', 'Entretien'], ['briefcase', 'Recruté(e)'], ['check', 'Confirmé']];
export function journeyStep(st, apps) {
  if (st.key === 'trouve') return 4;
  if (st.key === 'validation') return 3;
  if (apps.some(a => a.status === 'entretien')) return 2;
  if (apps.some(a => a.status !== 'refuse')) return 1;
  return 0;
}

export function Journey({ step }) {
  return html`<ol class="journey">${JOURNEY.map(([ic, l], i) => html`<li class=${i < step ? 'done' : i === step ? 'next' : ''}><span class="j-dot"><${Icon} name=${i < step ? 'check' : ic} size=${16}/></span><span class="j-lbl">${l}</span></li>`)}</ol>`;
}

export function ParcoursPage(ctx) {
  const { data, me, saison, store, act, openOffer } = ctx;
  const n = niveauOf(me, saison);
  const obj = OBJECTIFS[n];
  const st = statutOf(data, me, saison);
  const pl = st.pl;
  const [declare, setDeclare] = useState(false);
  const [addApp, setAddApp] = useState(false);
  const [share, setShare] = useState(false);
  const apps = data.applications.filter(a => a.student_id === me.id).sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  const history = data.placements.filter(p => p.student_id === me.id && p.saison !== saison && p.status !== 'refuse').sort((a, b) => b.saison - a.saison);
  const helper = pl?.laureat_id ? store.byId('profiles', pl.laureat_id) : null;
  const step = journeyStep(st, apps);
  // Une seule action principale visible : la carte du parrain (3A) ou la confirmation passent avant « Voir les offres »
  const parrain = me.role === 'etudiant' && n === 3 && data.parrainages?.some(x => x.filleul_id === me.id && x.saison === saison);
  const versOffres = obj && !pl && !parrain ? { label: 'Voir les offres pour moi', icon: 'search', onClick: () => ctx.go('offres') } : null;

  return html`<section class="page">
    <header class="page-head"><div><p class="eyebrow">Saison ${seasonLabel(saison)} · ${NIVEAUX[n]?.label}</p><h1>Mon parcours</h1></div></header>

    ${pl?.status === 'en_attente' ? html`<${ConfirmRecruit} ctx=${ctx} pl=${pl} helper=${helper}/>` : null}
    <${ParrainCard} ctx=${ctx}/>

    <div class=${'objective st-' + st.key}>
      <div class="objective-top">
        <span class="obj-ico"><${Icon} name=${obj ? TYPE_ICON[obj.types[0]] : 'cap'} size=${24}/></span>
        <div class="objective-main">
          <p class="eyebrow">Mon objectif cette saison</p>
          <h2>${obj ? obj.titre : 'Pas d’objectif de placement cette année'}</h2>
          ${obj ? html`<p class="muted small">Les lauréats sont là pour t’aider. Avance à ton rythme.</p>` : html`<p class="muted small">En cycle préparatoire, profite de l’Entraide et du mentorat pour préparer ton premier stage.</p>`}
        </div>
        <span class=${'state-pill s-' + st.key}>${st.label}</span>
      </div>
      ${obj ? html`<${Journey} step=${step}/>` : null}
      ${pl && pl.status !== 'en_attente' ? html`<div class="found-line"><${CompanyLogo} name=${pl.entreprise} size=${36}/><span class="grow"><strong translate="no">${pl.entreprise}</strong>${pl.ville ? html`, <span translate="no">${pl.ville}</span>` : ''}${pl.pays && pl.pays !== 'Maroc' ? ` (${pl.pays})` : ''}<br/><span class="muted small">${pl.status === 'confirme' ? `Vérifié : recruté(e) par ${helper?.full_name || 'un lauréat'}, confirmé par toi` : 'Trouvé en dehors de la plateforme'}</span></span>
        <button class="btn small ghost" onClick=${() => setShare(true)}><${Icon} name="share" size=${15}/> Partager</button></div>` : null}
      ${pl && pl.status === 'confirme' && helper ? html`<label class="check small consent"><input id="pl-partage" type="checkbox" checked=${!!pl.partage_ok} onChange=${e => act(() => store.update('placements', pl.id, { partage_ok: e.target.checked }))}/> ${helper.full_name.split(' ')[0]} peut citer mon nom s’il partage mon recrutement sur LinkedIn</label>` : null}
      ${!pl && obj && (apps.length || parrain) ? html`<div class="row"><button class=${'btn' + (parrain ? '' : ' primary')} onClick=${() => ctx.go('offres')}><${Icon} name="search" size=${16}/> Voir les offres pour moi</button></div>` : null}
    </div>

    ${pl && pl.laureat_id && pl.status === 'confirme' ? html`<${MerciBox} ctx=${ctx} pl=${pl} helper=${helper}/>` : null}

    <div class="section-head"><h2>Mes candidatures <span class="count">${apps.length}</span></h2><button class="btn small ghost" onClick=${() => setAddApp(true)}><${Icon} name="plus" size=${15}/> Candidature hors plateforme</button></div>
    ${apps.length ? html`<ul class="app-list">${apps.map(a => {
      const o = a.offer_id ? store.byId('offers', a.offer_id) : null;
      return html`<li class="app-row" key=${a.id}>
        <${CompanyLogo} name=${a.entreprise} size=${40}/>
        <span class="app-txt">${o ? html`<button class="linkish" onClick=${() => openOffer(o.id)}><span translate="no" dir="auto">${a.titre || o.titre}</span></button>` : a.titre ? html`<strong translate="no" dir="auto">${a.titre}</strong>` : html`<strong>Candidature</strong>`}<span class="muted small">${a.entreprise} · ${o ? 'via la plateforme' : 'hors plateforme'} · ${timeAgo(a.updated_at || a.created_at)}</span></span>
        ${o ? html`<span class=${'state-pill a-' + a.status}>${APP_STATUS[a.status]}</span>` : html`<span class="row nowrap">
          <select id=${'ap-' + a.id} aria-label="Statut" value=${a.status} onChange=${e => act(() => store.update('applications', a.id, { status: e.target.value, updated_at: new Date().toISOString() }))}>${Object.entries(APP_STATUS).map(([v, t]) => html`<option value=${v}>${t}</option>`)}</select>
          <button class="icon-btn small" aria-label="Supprimer" onClick=${() => act(() => store.remove('applications', a.id))}><${Icon} name="trash" size=${14}/></button></span>`}
      </li>`;
    })}</ul>
    <p class="small muted hint"><${Icon} name="shield" size=${14}/> Pour les offres de la plateforme, c’est le lauréat qui met à jour le statut. Quand il te marque « Recruté(e) », tu confirmes ici.</p>` : html`<${Empty} icon="send" title="Aucune candidature pour l’instant" action=${versOffres}>Ouvre une offre et clique sur « Postuler ». Le lauréat reçoit ton message et ton CV.<//>`}

    ${!pl && obj ? html`<p class="small muted center">Tu as trouvé sans passer par la plateforme ? <button class="linkish" onClick=${() => setDeclare(true)}>Indique-le ici</button> pour que ta promo soit bien suivie.</p>` : null}

    ${history.length ? html`<div class="section-head"><h2>Saisons précédentes</h2></div>
      <ul class="app-list">${history.map(h => html`<li class="app-row"><${CompanyLogo} name=${h.entreprise} size=${36}/><span class="app-txt"><strong>${TYPES[h.type]?.label} chez <span translate="no">${h.entreprise}</span></strong><span class="muted small">${seasonLabel(h.saison)}${h.pays && h.pays !== 'Maroc' ? ` · ${h.pays}` : ''}</span></span>${h.source === 'plateforme' ? html`<span class="state-pill s-trouve">Via la plateforme</span>` : null}</li>`)}</ul>` : null}

    ${declare ? html`<${DeclareOutside} ctx=${ctx} onClose=${() => setDeclare(false)}/>` : null}
    ${share && pl ? html`<${ShareModal} ctx=${ctx} pl=${pl} onClose=${() => setShare(false)}/>` : null}
    ${addApp ? html`<${AppModal} ctx=${ctx} onClose=${() => setAddApp(false)}/>` : null}
  </section>`;
}

// Le lauréat a déclaré le recrutement : l'étudiant confirme ou non.
export function ConfirmRecruit({ ctx, pl, helper }) {
  const { store, act } = ctx;
  const o = pl.offer_id ? store.byId('offers', pl.offer_id) : null;
  return html`<div class="confirm-card">
    <div class="confirm-top"><${CompanyLogo} name=${pl.entreprise} size=${48}/>
      <div><p class="eyebrow">À confirmer</p><h2>${helper?.full_name || 'Un lauréat'} indique t’avoir recruté(e) chez ${pl.entreprise}</h2>
        <p class="muted small">${o ? o.titre : TYPES[pl.type]?.long}. Une fois confirmé, ta réussite est vérifiée des deux côtés et compte dans le suivi de ta promo.</p></div></div>
    <div class="row-end">
      <button class="btn ghost" onClick=${() => act(async () => { await store.update('placements', pl.id, { status: 'refuse' }); toast('C’est noté. Le lauréat sera informé.'); })}>Ce n’est pas le cas</button>
      <button class="btn primary" onClick=${() => act(async () => {
        await store.update('placements', pl.id, { status: 'confirme' });
        const p = (helper?.full_name || '').split(' ')[0];
        const fete = celebrate({
          cle: 'recrutement-' + pl.id, icon: 'trophy', titre: 'Félicitations, c’est officiel !',
          texte: p ? `Ton recrutement chez ${pl.entreprise} est vérifié des deux côtés. Un petit mot fera très plaisir à ${p}.` : `Ton recrutement chez ${pl.entreprise} est vérifié des deux côtés.`,
          action: p ? { label: `Dire merci à ${p}`, icon: 'heart', onClick: () => versMerci(ctx) } : null,
        });
        if (!fete) toast('Félicitations ! Ta réussite est confirmée.', 'win');
      })}><${Icon} name="check" size=${16}/> Oui, je confirme</button>
    </div>
  </div>`;
}

// Après la fête : on ouvre « Mon parcours » et on place le curseur dans le mot de remerciement
function versMerci(ctx) {
  ctx.go('parcours');
  setTimeout(() => {
    const t = document.getElementById('merci-txt');
    if (!t) return;
    t.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    t.focus({ preventScroll: true });
  }, 450);
}

function MerciBox({ ctx, pl, helper }) {
  const { store, act } = ctx;
  const [merci, setMerci] = useState(pl.merci || '');
  const [note, setNote] = useState(pl.note || 5);
  const [edit, setEdit] = useState(!pl.merci);
  if (!edit) return html`<div class="merci-done"><${Icon} name="heart"/> <span>Ton merci à ${helper?.full_name} est affiché sur le mur des mercis.</span><button class="btn tiny ghost" onClick=${() => setEdit(true)}>Modifier</button></div>`;
  return html`<form class="merci-box" onSubmit=${e => { e.preventDefault(); act(async () => { await store.update('placements', pl.id, { merci: merci.trim(), note: +note }); setEdit(false); toast('Merci envoyé ! Il apparaît sur le mur des mercis.'); }); }}>
    <p><${Icon} name="heart" size=${16}/> <strong>Dis merci à ${helper?.full_name}.</strong> C’est ce qui donne envie aux lauréats de continuer à aider.</p>
    <textarea id="merci-txt" rows="2" maxlength="800" placeholder="Merci pour…" value=${merci} onInput=${e => setMerci(e.target.value)}></textarea>
    <div class="row"><span class="stars" role="group" aria-label="Aide reçue">${[1, 2, 3, 4, 5].map(v => html`<button type="button" class=${v <= note ? 'on' : ''} aria-label=${v + ' sur 5'} onClick=${() => setNote(v)}>★</button>`)}</span><span class="spacer"></span><button class="btn primary small" disabled=${!merci.trim()}>Envoyer mon merci</button></div>
  </form>`;
}

// Réussite trouvée hors plateforme : déclarée par l'étudiant, non vérifiée.
function DeclareOutside({ ctx, onClose }) {
  const { store, me, saison, act } = ctx;
  const n = Math.min(niveauOf(me, saison), 6);
  const [f, setF] = useState({ type: typeForNiveau(n), entreprise: '', ville: '', pays: 'Maroc' });
  const submit = e => {
    e.preventDefault();
    act(async () => {
      const pays = f.pays.trim() || 'Maroc';
      await store.insert('placements', { student_id: me.id, saison, niveau: n, type: pays !== 'Maroc' && f.type !== 'emploi' ? 'etranger' : f.type, entreprise: f.entreprise.trim(), ville: f.ville.trim(), pays, source: 'autre' });
      toast('Bravo ! C’est enregistré.', 'win'); onClose();
    });
  };
  return html`<${Modal} title="J’ai trouvé hors plateforme" onClose=${onClose}>
    <form class="form" onSubmit=${submit}>
      <p class="small muted">Pour une offre de la plateforme, pas besoin de remplir ceci : le lauréat te marque « Recruté(e) » et tu confirmes.</p>
      <${Field} label="Type"><select id="dc-type" value=${f.type} onChange=${e => setF({ ...f, type: e.target.value })}>${Object.entries(TYPES).map(([k, v]) => html`<option value=${k}>${v.long}</option>`)}</select><//>
      <${Field} label="Entreprise"><input id="dc-ent" value=${f.entreprise} onInput=${e => setF({ ...f, entreprise: e.target.value })} required/><//>
      <div class="grid2"><${Field} label="Ville"><input id="dc-ville" value=${f.ville} onInput=${e => setF({ ...f, ville: e.target.value })}/><//><${Field} label="Pays"><input id="dc-pays" value=${f.pays} onInput=${e => setF({ ...f, pays: e.target.value })}/><//></div>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" disabled=${!f.entreprise.trim()}>Enregistrer</button></div>
    </form>
  <//>`;
}

function AppModal({ ctx, onClose }) {
  const { store, me, act } = ctx;
  const [f, setF] = useState({ entreprise: '', titre: '', note: '' });
  return html`<${Modal} title="Candidature hors plateforme" onClose=${onClose}>
    <form class="form" onSubmit=${e => { e.preventDefault(); act(async () => { await store.insert('applications', { student_id: me.id, offer_id: null, entreprise: f.entreprise.trim(), titre: f.titre.trim(), note: f.note.trim(), status: 'postule' }); onClose(); }); }}>
      <p class="small muted">Pour garder toutes tes candidatures au même endroit. Tu mets toi-même le statut à jour.</p>
      <${Field} label="Entreprise"><input id="ap-ent" required value=${f.entreprise} onInput=${e => setF({ ...f, entreprise: e.target.value })}/><//>
      <${Field} label="Poste ou sujet"><input id="ap-titre" value=${f.titre} onInput=${e => setF({ ...f, titre: e.target.value })}/><//>
      <${Field} label="Note pour moi"><input id="ap-note" value=${f.note} onInput=${e => setF({ ...f, note: e.target.value })} placeholder="Relance prévue le…"/><//>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" disabled=${!f.entreprise.trim()}>Ajouter</button></div>
    </form>
  <//>`;
}

// ---------------------------------------------------------------------------
// Espace lauréat : d'abord merci, puis ce qu'il y a à traiter, puis ce qu'il a apporté.
// Un lauréat qui arrive n'a rien à rattraper : on lui propose une première aide facile, pas un tableau de zéros.
// ---------------------------------------------------------------------------
export function EspacePage(ctx) {
  const { data, me, store, scores, act, openProfile, openOffer } = ctx;
  const s = scores.get(me.id) || { points: 0, events: [], offres: 0, recrutes: 0, mentorats: 0, mercis: 0, reponses: 0 };
  const lvl = levelOf(s.points);
  const mine = badgesOf(s, me, { star: ctx.starId, fondateurs: ctx.fondateurs });
  const myOffers = data.offers.filter(o => o.author_id === me.id).sort((a, b) => (a.status === 'ouverte' ? 0 : 1) - (b.status === 'ouverte' ? 0 : 1) || new Date(b.created_at) - new Date(a.created_at));
  const myOfferIds = new Set(myOffers.map(o => o.id));
  const toTreat = data.applications.filter(a => myOfferIds.has(a.offer_id) && a.status === 'postule').sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const waiting = data.placements.filter(p => p.laureat_id === me.id && p.status === 'en_attente');
  const helped = data.placements.filter(p => p.laureat_id === me.id && p.status === 'confirme');
  const mercis = [
    ...helped.filter(p => p.merci).map(p => ({ who: p.student_id, txt: p.merci, at: p.confirmed_at || p.created_at, ctx: p.entreprise })),
    ...data.mentorships.filter(m => m.mentor_id === me.id && m.merci).map(m => ({ who: m.student_id, txt: m.merci, at: m.created_at, ctx: m.sujet })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  const month = computeScores(data, new Date(Date.now() - 30 * 864e5)).get(me.id)?.points || 0;
  const [bareme, setBareme] = useState(false);
  const [compose, setCompose] = useState(false);
  const [share, setShare] = useState(null);
  const rdv = data.mentorships.filter(m => m.mentor_id === me.id && mentorState(m) === 'rdv').sort((a, b) => new Date(a.rdv_at) - new Date(b.rdv_at));
  const recrues = helped.filter(p => p.saison === ctx.saison).sort((a, b) => new Date(b.confirmed_at || b.created_at) - new Date(a.confirmed_at || a.created_at));
  const events = [...(s.events || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
  const nouveau = !s.points && !myOffers.length && !helped.length && !waiting.length && !rdv.length && !mercis.length;

  return html`<section class="page espace">
    <header class="page-head"><div><p class="eyebrow">Promo ${me.promo}${me.entreprise ? ' · ' + me.entreprise : ''}</p><h1>Mon espace</h1></div>
      ${nouveau ? null : html`<button class="btn primary" onClick=${() => setCompose(true)}><${Icon} name="plus"/> Publier une offre</button>`}</header>

    ${nouveau ? html`<${PremiereAide} ctx=${ctx} onPublier=${() => setCompose(true)}/>` : html`<div class="impact-hero">
      <div class="impact-score">
        <span class="row"><${Icon} name="star" size=${20}/><span class="muted">Points d’impact</span></span>
        <span class="big mono"><${Num} v=${s.points}/></span>
        <div class="lvl-row"><${LevelChip} points=${s.points}/>${lvl.next ? html`<span class="muted small">encore ${lvl.next.min - s.points} pour ${lvl.next.nom}</span>` : html`<span class="muted small">Niveau maximum</span>`}</div>
        <${Bar} value=${lvl.progress} label="Progression vers le niveau suivant"/>
        <span class="row small muted">+${month} ces 30 jours<span class="spacer"></span><button class="linkish small on-dark" onClick=${() => setBareme(true)}>Comment gagner des points ?</button></span>
      </div>
      <div class="impact-facts">
        <div><span class="fact-ico"><${Icon} name="briefcase" size=${18}/></span><span class="big mono"><${Num} v=${helped.length}/></span><span>recruté${helped.length > 1 ? 's' : ''} grâce à toi</span></div>
        <div><span class="fact-ico"><${Icon} name="feed" size=${18}/></span><span class="big mono"><${Num} v=${myOffers.length}/></span><span>offre${myOffers.length > 1 ? 's' : ''} partagée${myOffers.length > 1 ? 's' : ''}</span></div>
        <div><span class="fact-ico"><${Icon} name="mentor" size=${18}/></span><span class="big mono"><${Num} v=${s.mentorats}/></span><span>mentorat${s.mentorats > 1 ? 's' : ''} terminé${s.mentorats > 1 ? 's' : ''}</span></div>
        <div><span class="fact-ico"><${Icon} name="heart" size=${18}/></span><span class="big mono"><${Num} v=${mercis.length}/></span><span>merci${mercis.length > 1 ? 's' : ''} reçu${mercis.length > 1 ? 's' : ''}</span></div>
      </div>
    </div>`}

    ${mercis.length ? html`<${MesMercis} ctx=${ctx} mercis=${mercis}/>` : null}

    ${toTreat.length ? html`<div class="panel accent-panel"><div class="section-head"><h2 class="h-ico"><${Icon} name="inbox"/> Nouvelles candidatures <span class="count">${toTreat.length}</span></h2></div>
      <ul class="app-list flat">${toTreat.slice(0, 6).map(a => { const p = store.byId('profiles', a.student_id); const o = store.byId('offers', a.offer_id); return html`<li class="app-row" key=${a.id}>
        <${Person} p=${p} onOpen=${openProfile} size=${36}/><span class="app-txt right"><span class="muted small">pour ${o?.titre}</span></span>
        <button class="btn small" onClick=${() => openOffer(o.id)}>Voir</button></li>`; })}</ul></div>` : null}

    ${waiting.length ? html`<div class="panel"><div class="section-head"><h2 class="h-ico"><${Icon} name="clock"/> En attente de confirmation <span class="count">${waiting.length}</span></h2></div>
      <p class="small muted">Tu as indiqué avoir recruté ces étudiants. Dès qu’ils confirment, leur réussite est vérifiée des deux côtés.</p>
      <ul class="app-list flat">${waiting.map(p => { const st = store.byId('profiles', p.student_id); return html`<li class="app-row" key=${p.id}>
        <${Person} p=${st} onOpen=${openProfile} size=${36}/><span class="app-txt right"><span class="muted small"><span translate="no">${p.entreprise}</span> · ${timeAgo(p.created_at)}</span></span>
        <button class="btn small ghost" onClick=${() => ctx.confirm('Annuler cette déclaration de recrutement ?', () => act(() => store.remove('placements', p.id)), 'Annuler la déclaration')}>Annuler</button></li>`; })}</ul></div>` : null}

    ${rdv.length ? html`<div class="panel"><div class="section-head"><h2 class="h-ico"><${Icon} name="video"/> Mes prochains rendez-vous <span class="count">${rdv.length}</span></h2><button class="btn tiny ghost" onClick=${() => ctx.go('mentorat')}>Mentorat <${Icon} name="arrow" size=${14}/></button></div>
      <ul class="slot-list">${rdv.slice(0, 3).map(m => html`<li class="slot-row" key=${m.id}><${SlotDate} iso=${m.rdv_at}/><span class="slot-main"><${Person} p=${store.byId('profiles', m.student_id)} onOpen=${openProfile} size=${30}/><span class="small" translate="no" dir="auto">${m.sujet}</span></span></li>`)}</ul></div>` : null}

    <${Filleuls} ctx=${ctx}/>

    ${recrues.length ? html`<div class="panel"><div class="section-head"><h2 class="h-ico"><${Icon} name="briefcase"/> Recrutés grâce à toi cette saison <span class="count">${recrues.length}</span></h2></div>
      <ul class="app-list flat">${recrues.slice(0, 5).map(p => html`<li class="app-row" key=${p.id}><${Person} p=${store.byId('profiles', p.student_id)} onOpen=${openProfile} size=${36}/><span class="app-txt right"><span class="muted small"><span translate="no">${p.entreprise}</span> · ${TYPES[p.type]?.label}</span></span>
        <button class="icon-btn small" aria-label="Partager sur LinkedIn" title="Partager sur LinkedIn" onClick=${() => setShare(p)}><${Icon} name="share" size=${16}/></button></li>`)}</ul></div>` : null}

    ${nouveau ? null : html`<div class="section-head"><h2>Mes offres</h2></div>
    ${myOffers.length ? html`<ul class="app-list">${myOffers.slice(0, 10).map(o => {
      const nApps = data.applications.filter(a => a.offer_id === o.id).length;
      const nRec = data.placements.filter(p => p.offer_id === o.id && p.status === 'confirme').length;
      return html`<li key=${o.id}><button class="app-row clickable" onClick=${() => openOffer(o.id)}>
        <span class=${'type-ico t-' + o.type}><${Icon} name=${TYPE_ICON[o.type]} size=${18}/></span>
        <span class="app-txt"><strong translate="no" dir="auto">${o.titre}</strong><span class="muted small">${o.status === 'ouverte' ? 'Ouverte' : o.status === 'pourvue' ? 'Pourvue' : 'Fermée'}${o.audience === 'laureats' ? ' · Entre lauréats' : ''} · ${timeAgo(o.created_at)}</span></span>
        <span class="mini-stats"><span title="Candidats"><${Icon} name="inbox" size=${15}/> ${nApps}</span><span title="Recrutés confirmés"><${Icon} name="check" size=${15}/> ${nRec}</span></span></button></li>`;
    })}</ul>` : html`<${Empty} icon="feed" title="Aucune offre publiée">Une offre partagée peut lancer une carrière : les étudiants concernés la voient tout de suite.<//>`}`}

    <${MesBadges} s=${s} mine=${mine}/>
    ${nouveau ? null : html`<${AttestationCard} ctx=${ctx}/><${BilanCard} ctx=${ctx}/>`}

    ${events.length ? html`<details class="ledger">
      <summary><${Icon} name="star" size=${16}/> Historique de mes points <span class="count">${events.length}</span></summary>
      <ul class="events">${events.slice(0, 12).map(e => html`<li><span class="mono pts">+${e.pts}</span> ${e.label} <span class="muted small">${timeAgo(e.at)}</span></li>`)}</ul>
    </details>` : null}
    ${bareme ? html`<${Modal} title="Points d’impact" onClose=${() => setBareme(false)}>
      <table class="tbl"><tbody>${BAREME.map(([l, p]) => html`<tr><td>${l}</td><td class="num mono">+${p}</td></tr>`)}</tbody></table>
      <p class="muted small">Niveaux : ${NIVEAUX_IMPACT.map(n => `${n.nom} (${n.min})`).join(' · ')}. Chaque mois, le lauréat qui a eu le plus d’impact est mis en avant sur l’accueil.</p>
    <//>` : null}
    ${compose ? html`<${OfferComposer} ctx=${ctx} onClose=${() => setCompose(false)}/>` : null}
    ${share ? html`<${ShareModal} ctx=${ctx} pl=${share} onClose=${() => setShare(null)}/>` : null}
  </section>`;
}

// Première visite d'un lauréat : trois gestes faciles, avec le temps qu'ils prennent. Aucun n'est obligatoire.
function PremiereAide({ ctx, onPublier }) {
  const { me, go } = ctx;
  const gestes = [
    ['file', 'Relire un CV', 'Ton regard de pro, quelques remarques suffisent.', '10 min', () => go('mentorat/cv')],
    ['calendar', 'Choisir un horaire pour un étudiant', 'Un appel en visio, au moment qui t’arrange.', '2 min', () => go('mentorat')],
    ['feed', 'Publier une offre', 'Colle l’annonce : les champs se remplissent seuls.', '5 min', onPublier],
  ];
  return html`<div class="premiere-aide">
    <div class="pa-head"><span class="pa-ico"><${Icon} name="heart" size=${22}/></span>
      <div><p class="eyebrow">Bienvenue, ${(me.full_name || '').split(' ')[0]}</p><h2>Ta première aide</h2>
        <p class="muted">Merci d’être là. Choisis ce qui te prend le moins de temps : un seul geste peut changer la saison d’un étudiant.</p></div></div>
    <ul class="pa-gestes">${gestes.map(([ic, t, sub, d, fn]) => html`<li key=${ic}><button type="button" class="pa-geste" onClick=${fn}>
      <span class="pa-geste-ico"><${Icon} name=${ic} size=${20}/></span>
      <span class="pa-geste-txt"><span class="pa-geste-titre"><strong>${t}</strong><span class="pa-duree">${d}</span></span><span class="small muted">${sub}</span></span>
      <span class="pa-geste-go" aria-hidden="true"><${Icon} name="arrow" size=${16}/></span></button></li>`)}</ul>
    <${PoulsReseau} ctx=${ctx}/>
  </div>`;
}

// Les mercis en haut de l'espace : le plus récent en grand, les autres repliés
function MerciQui({ ctx, m, size }) {
  const p = ctx.store.byId('profiles', m.who);
  return html`<footer class="merci-qui"><${Avatar} p=${p} size=${size}/><span><button class="linkish" onClick=${() => ctx.openProfile(p)}>${p ? html`<span translate="no" dir="auto">${p.full_name}</span>` : 'Un étudiant'}</button> <span class="muted small">· <span translate="no" dir="auto">${m.ctx}</span> · <span class="nowrap">${timeAgo(m.at)}</span></span></span></footer>`;
}

function MesMercis({ ctx, mercis }) {
  const [first, ...rest] = mercis;
  return html`<section class="mercis-top">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="heart"/> Mes mercis <span class="count">${mercis.length}</span></h2></div>
    <blockquote class="merci-hero"><p translate="no" dir="auto">« ${first.txt} »</p><${MerciQui} ctx=${ctx} m=${first} size=${30}/></blockquote>
    ${rest.length ? html`<details class="mercis-more"><summary>${rest.length > 1 ? `Lire les ${rest.length} autres mercis` : 'Lire l’autre merci'}</summary>
      <div class="mercis">${rest.slice(0, 8).map(m => html`<blockquote class="merci"><p translate="no" dir="auto">« ${m.txt} »</p><${MerciQui} ctx=${ctx} m=${m} size=${24}/></blockquote>`)}</div></details>` : null}
  </section>`;
}

// Le prochain badge à viser, dans l'ordre du chemin d'un lauréat (« vérifié » dépend de l'école, pas de lui)
const VERS_BADGE = {
  premier: ['Publie une première offre', s => [s.offres, 1]],
  mentor: ['Termine 3 mentorats', s => [s.mentorats, 3]],
  recruteur: ['Aide 3 étudiants à être recrutés', s => [s.recrutes, 3]],
  aime: ['Reçois 5 mercis d’étudiants', s => [s.mercis, 5]],
  passeport: ['Ouvre une porte à l’étranger', s => [s.etranger, 1]],
  sage: ['Donne 3 meilleures réponses dans l’Entraide', s => [s.meilleures, 3]],
  reactif: ['Accepte 3 demandes d’aide en moins de 24 h', s => [s.rapides, 3]],
  faiseur: ['Aide 10 étudiants à être recrutés', s => [s.recrutes, 10]],
  top: ['Atteins 300 points d’impact', s => [s.points, 300]],
};

function MesBadges({ s, mine }) {
  const has = new Set(mine.map(b => b.id));
  const next = Object.keys(VERS_BADGE).map(id => BADGES.find(b => b.id === id)).find(b => b && !has.has(b.id));
  // « Membre fondateur » ne s'obtient plus après les 25 premiers : on ne le montre qu'à ceux qui l'ont
  const possibles = BADGES.filter(b => b.id !== 'fondateur' || has.has(b.id));
  const autres = possibles.filter(b => !has.has(b.id) && b !== next);
  const tuile = (b, on) => html`<div class=${'badge' + (on ? ' has' : '')} title=${b.desc} key=${b.id}><span class="badge-medal"><${Icon} name=${on ? 'star' : 'spark'} size=${20}/></span><strong>${b.nom}</strong><span class="small muted">${b.desc}</span></div>`;
  let prochain = null;
  if (next) {
    const [quoi, f] = VERS_BADGE[next.id];
    const [cur, goal] = f(s).map(x => Number(x) || 0);
    prochain = html`<div class="badge-next">
      <span class="badge-medal"><${Icon} name="spark" size=${20}/></span>
      <div class="grow">${mine.length ? html`<p class="eyebrow">Prochain badge</p>` : null}<strong>${next.nom}</strong><span class="small muted">${quoi}</span>
        ${goal > 1 ? html`<div class="bn-prog"><${Bar} value=${Math.min(1, cur / goal)} label=${`${Math.min(cur, goal)} sur ${goal}`}/><span class="small mono">${Math.min(cur, goal)} sur ${goal}</span></div>` : null}</div>
    </div>`;
  }
  return html`<div class="section-head"><h2>${mine.length ? 'Mes badges' : 'Ton premier badge'}</h2>${mine.length ? html`<span class="muted small">${mine.length} sur ${possibles.length}</span>` : null}</div>
    ${mine.length ? html`<div class="badges">${mine.map(b => tuile(b, true))}</div>` : null}
    ${prochain}
    ${autres.length && mine.length ? html`<details class="badges-more"><summary>${autres.length > 1 ? `Voir les ${autres.length} autres badges` : 'Voir l’autre badge'}</summary><div class="badges">${autres.map(b => tuile(b, false))}</div></details>` : null}`;
}

// ---------------------------------------------------------------------------
// Passe UX de « Mon espace » et « Mon parcours »
// ---------------------------------------------------------------------------
injectCSS('me-ux', `
.premiere-aide { display: flex; flex-direction: column; gap: 1rem; padding: 1.2rem; border-radius: var(--r-xl); background: linear-gradient(160deg, color-mix(in srgb, var(--em-o) 10%, var(--surface)), var(--surface) 62%); border: 1px solid color-mix(in srgb, var(--brass) 22%, var(--line)); box-shadow: var(--shadow); }
.pa-head { display: flex; gap: .9rem; align-items: flex-start; }
.pa-head > div { display: flex; flex-direction: column; gap: .25rem; min-width: 0; }
.pa-head .eyebrow { margin: 0; color: var(--brass); }
.pa-head h2 { font-size: var(--fs-6); font-weight: 750; }
.pa-head p.muted { color: var(--ink-2); max-width: 52ch; }
.pa-ico { flex: none; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; background: var(--surface); color: var(--em-o); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--em-o) 32%, transparent), 0 6px 18px -8px color-mix(in srgb, var(--em-o) 60%, transparent); }
.pa-gestes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .5rem; }
.pa-geste { width: 100%; height: 100%; display: flex; align-items: center; gap: .8rem; padding: .8rem .9rem; border-radius: var(--r-lg); border: 1px solid var(--line); background: var(--surface); font: inherit; color: inherit; text-align: start; cursor: pointer; transition: border-color .2s, box-shadow .25s, transform .25s var(--ease); }
.pa-geste:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--line)); box-shadow: var(--shadow-lift); transform: translateY(-2px); }
.pa-geste:active { transform: scale(.985); }
.pa-geste-ico { flex: none; width: 42px; height: 42px; border-radius: var(--r-md); display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); }
.pa-geste-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .1rem; }
.pa-geste-titre { display: flex; align-items: baseline; flex-wrap: wrap; gap: .15rem .5rem; }
.pa-geste-txt strong { font-weight: 600; line-height: 1.3; }
.pa-duree { flex: none; font: 600 var(--fs-1)/1.4 var(--f-mono); padding: .05rem .5rem; border-radius: var(--r-pill); background: var(--good-soft); color: var(--good); white-space: nowrap; }
.pa-geste-go { flex: none; color: var(--muted); transition: color .2s, transform .25s var(--ease); }
.pa-geste:hover .pa-geste-go { color: var(--accent); transform: translateX(2px); }
[dir="rtl"] .pa-geste:hover .pa-geste-go { transform: translateX(-2px); }
@media (min-width: 900px) {
  .pa-gestes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .7rem; }
  .pa-geste { flex-direction: column; align-items: flex-start; gap: .6rem; padding: 1rem; }
  .pa-geste-txt { flex: 1; }
  .pa-geste-go { display: none; }
}

.mercis-top { display: flex; flex-direction: column; gap: .6rem; }
.mercis-top .section-head { margin-top: .2rem; }
.merci-hero { margin: 0; padding: 1.1rem 1.2rem 1rem; border-radius: var(--r-xl); background: linear-gradient(150deg, color-mix(in srgb, var(--brass) 11%, var(--surface)), var(--surface) 72%); border: 1px solid color-mix(in srgb, var(--brass) 24%, var(--line)); display: flex; flex-direction: column; gap: .7rem; }
.merci-hero p { font-size: var(--fs-4); line-height: 1.5; font-style: italic; color: var(--ink); }
.merci-qui { display: flex; align-items: center; gap: .5rem; }
.merci-qui > span { min-width: 0; }
.mercis-more .mercis { padding-top: .3rem; }

.badge-next { display: flex; align-items: center; gap: .8rem; padding: .85rem 1rem; border-radius: var(--r-lg); border: 1px dashed color-mix(in srgb, var(--brass) 50%, var(--line)); background: color-mix(in srgb, var(--brass-soft) 45%, var(--surface)); }
.badge-next .badge-medal { flex: none; background: var(--surface); color: var(--brass); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--brass) 35%, transparent); }
.badge-next .grow { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .15rem; }
.badge-next .eyebrow { margin: 0; color: var(--brass); }
.bn-prog { display: flex; align-items: center; gap: .6rem; margin-top: .35rem; }
.bn-prog .bar { flex: 1; }

.espace details > summary { display: flex; align-items: center; gap: .45rem; cursor: pointer; list-style: none; font-weight: 600; font-size: var(--fs-2); color: var(--ink-2); padding: .5rem .15rem; min-height: 40px; border-radius: var(--r-sm); }
.espace details > summary::-webkit-details-marker { display: none; }
.espace details > summary::after { content: ""; width: 7px; height: 7px; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: translateY(-2px) rotate(45deg); margin-inline-start: .25rem; transition: transform .2s var(--ease); }
.espace details[open] > summary::after { transform: translateY(2px) rotate(-135deg); }
.espace details > summary:hover { color: var(--accent); }
.ledger { border-top: 1px solid var(--line); padding-top: .3rem; margin-top: .4rem; }
.ledger .events { padding: .2rem .15rem .6rem; }
.ledger summary .ico { color: var(--brass); }
@media (max-width: 760px) {
  .espace .app-row > .btn, .espace .app-row > .icon-btn { margin-inline-start: auto; }
  .espace .app-list.flat .app-txt.right { padding-inline-start: 48px; }
}
`);

addAR({
  'Félicitations, c’est officiel !': 'تهانينا، أصبح الأمر رسميًا!',
  'Tu as indiqué avoir recruté ces étudiants. Dès qu’ils confirment, leur réussite est vérifiée des deux côtés.': 'أشرت إلى أنك وظّفت هؤلاء الطلبة. بمجرد تأكيدهم، يصبح نجاحهم مؤكَّدًا من الطرفين.',
  'Une offre partagée peut lancer une carrière : les étudiants concernés la voient tout de suite.': 'عرض واحد قد يطلق مسارًا مهنيًا: يراه الطلبة المعنيون فورًا.',
  'Historique de mes points': 'سجل نقاطي',
  'Ta première aide': 'أول مساعدة لك',
  'Merci d’être là. Choisis ce qui te prend le moins de temps : un seul geste peut changer la saison d’un étudiant.': 'شكرًا لوجودك. اختر ما يأخذ منك أقل وقت: خطوة واحدة قد تغيّر موسم طالب.',
  'Relire un CV': 'مراجعة سيرة ذاتية',
  'Ton regard de pro, quelques remarques suffisent.': 'نظرتك المهنية، وبضع ملاحظات تكفي.',
  'Choisir un horaire pour un étudiant': 'اختيار موعد لطالب',
  'Un appel en visio, au moment qui t’arrange.': 'مكالمة فيديو في الوقت الذي يناسبك.',
  'Colle l’annonce : les champs se remplissent seuls.': 'الصق الإعلان: تُملأ الخانات تلقائيًا.',
  'Lire l’autre merci': 'قراءة رسالة الشكر الأخرى',
  'Mes badges': 'شاراتي',
  'Ton premier badge': 'شارتك الأولى',
  'Prochain badge': 'الشارة التالية',
  'Voir l’autre badge': 'عرض الشارة الأخرى',
  'Publie une première offre': 'انشر عرضك الأول',
  'Termine 3 mentorats': 'أنهِ 3 جلسات إرشاد',
  'Aide 3 étudiants à être recrutés': 'ساعد 3 طلبة على التوظيف',
  'Reçois 5 mercis d’étudiants': 'تلقَّ 5 رسائل شكر من الطلبة',
  'Ouvre une porte à l’étranger': 'افتح بابًا نحو الخارج',
  'Donne 3 meilleures réponses dans l’Entraide': 'قدّم 3 أفضل أجوبة في التعاون',
  'Accepte 3 demandes d’aide en moins de 24 h': 'اقبل 3 طلبات مساعدة في أقل من 24 ساعة',
  'Aide 10 étudiants à être recrutés': 'ساعد 10 طلبة على التوظيف',
  'Atteins 300 points d’impact': 'اجمع 300 نقطة أثر',
}, [
  [/^Ton recrutement chez (.+) est vérifié des deux côtés\. Un petit mot fera très plaisir à (.+)\.$/, (e, p) => `توظيفك في ${e} مؤكَّد من الطرفين. كلمة شكر صغيرة ستُسعد ${p} كثيرًا.`],
  [/^Ton recrutement chez (.+) est vérifié des deux côtés\.$/, e => `توظيفك في ${e} مؤكَّد من الطرفين.`],
  [/^Dire merci à (.+)$/, p => `قل شكرًا لـ${p}`],
  [/^Bienvenue, (.+)$/, n => `مرحبًا ${n}`],
  [/^(\d+) min$/, n => arCount(n, ['دقيقة', 'دقيقتان', 'دقائق', 'دقيقة'])],
  [/^Lire les (\d+) autres mercis$/, n => `قراءة ${arCount(n, ['رسالة شكر أخرى', 'رسالتي شكر أخريين', 'رسائل شكر أخرى', 'رسالة شكر أخرى'])}`],
  [/^Voir les (\d+) autres badges$/, n => `عرض ${arCount(n, ['شارة أخرى', 'شارتين أخريين', 'شارات أخرى', 'شارة أخرى'])}`],
]);
