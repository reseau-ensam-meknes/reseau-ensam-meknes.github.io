// Banque d'entretiens et avis de stage, par entreprise (Phase 3) : ce que les promos précédentes
// ont vécu chez chaque entreprise, pour que la suivante se prépare mieux.
import { html, useState, useMemo } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, CompanyLogo, TYPE_ICON, toast, useLocal, injectCSS } from './ui.js';
import { addAR } from './i18n.js';
import { TYPES, FOUND, entKey, sameCompany, seasonOf, seasonLabel, timeAgo } from './logic.js';
import { companiesOf } from './pro.js';
import { OfferCard, matchesMe } from './offers.js';
import { SignalerBtn } from './confiance.js';

export const FORMATS = { presentiel: ['Sur place', 'briefcase'], visio: ['Visio', 'video'], telephone: ['Téléphone', 'phone'], test_ecrit: ['Test écrit', 'edit'], autre: ['Autre', 'more'] };
export const RESULTATS = { retenu: 'Retenu(e)', refuse: 'Pas retenu(e)', attente: 'En attente de réponse', inconnu: 'Je ne sais pas' };
export const GRATIFS = { non: 'Non rémunéré', symbolique: 'Symbolique', correcte: 'Correcte', bonne: 'Bonne' };
const DIFFS = ['', 'Facile', 'Abordable', 'Moyen', 'Difficile', 'Très difficile'];
const TYPE_CHIPS = [['stage', 'Stage'], ['pfe', 'PFE'], ['etranger', 'Étranger'], ['emploi', 'Emploi']];
const NOTES = [['note_encadrement', 'Encadrement'], ['note_apprentissage', 'Apprentissage'], ['note_ambiance', 'Ambiance']];

const keyOf = name => entKey(name) || (name || '').trim().toLowerCase();
const lienEntreprise = name => 'reseau/entreprises/' + encodeURIComponent(keyOf(name));
const moy = v => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
// Saison isolée en sens gauche-droite, pour que « 2026-2027 » ne s'inverse pas dans une phrase arabe
const saisonTxt = s => `\u2066${seasonLabel(s)}\u2069`;
const fmtNote = n => (n == null ? '' : (Math.round(n * 10) / 10).toFixed(1).replace('.', ','));
const pluriel = (n, un, plus) => `${n} ${n > 1 ? plus : un}`;
// L'auteur d'un partage anonyme ne s'affiche pas (en ligne, la base l'a déjà masqué)
const auteurVisible = (row, me) => !!row.author_id && (!row.anonyme || row.author_id === me.id || me.role === 'admin');
const estAMoi = (row, me) => !!row.author_id && row.author_id === me.id;

// ---------------------------------------------------------------------------
// Toutes les entreprises connues : lauréats, offres, recrues, entretiens et avis
// ---------------------------------------------------------------------------
export function entreprisesDe(data) {
  const m = new Map(companiesOf(data).map(c => [c.k, { ...c, names: new Map(c.names), entretiens: [], avis: [] }]));
  const add = (row, kind) => {
    const k = keyOf(row.entreprise); if (!k) return;
    let c = m.get(k);
    if (!c) { c = { k, names: new Map(), laureats: [], offres: [], recrues: [], entretiens: [], avis: [], nom: row.entreprise.trim() }; m.set(k, c); }
    c.names.set(row.entreprise.trim(), (c.names.get(row.entreprise.trim()) || 0) + 1);
    c[kind].push(row);
  };
  for (const e of data.entretiens || []) add(e, 'entretiens');
  for (const a of data.avis_stage || []) add(a, 'avis');
  return [...m.values()].map(c => {
    const nom = [...c.names.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0]?.[0] || c.nom;
    const lieux = [...c.avis.map(a => [a.ville, a.pays]), ...c.offres.map(o => [o.ville, o.pays]), ...c.laureats.map(p => [p.ville, p.pays])];
    const ville = lieux.map(l => l[0]).find(Boolean) || '';
    const pays = lieux.map(l => l[1]).find(x => x && x !== 'Maroc') || '';
    const types = new Set([...c.offres, ...c.recrues, ...c.avis, ...c.entretiens].map(x => x.type).filter(Boolean));
    const secteurs = [...new Set(c.laureats.map(p => p.secteur).filter(Boolean))];
    return { ...c, nom, note: moy(c.avis.map(a => a.note).filter(Boolean)), ville, pays, types, secteurs };
  });
}

// Moyennes d'une entreprise
function synthese(avis) {
  const r = { n: avis.length, note: moy(avis.map(a => a.note).filter(Boolean)) };
  for (const [k] of NOTES) r[k] = moy(avis.map(a => a[k]).filter(Boolean));
  const rec = avis.filter(a => a.recommande != null);
  r.recommande = rec.length ? rec.filter(a => a.recommande).length / rec.length : null;
  r.gratifs = Object.keys(GRATIFS).map(g => [g, avis.filter(a => a.gratification === g).length]).filter(x => x[1]);
  return r;
}

// Étoiles en lecture seule (arrondies à la demi-étoile)
function Etoiles({ note, size = 15 }) {
  if (note == null) return null;
  const r = Math.round(note * 2) / 2;
  return html`<span class="ent-stars" role="img" aria-label=${`${fmtNote(note)} sur 5`} style=${`--s:${size}px`}>${[1, 2, 3, 4, 5].map(i => html`<span class=${i <= r ? 'on' : i - 0.5 === r ? 'half' : ''}>★</span>`)}</span>`;
}

// Choix d'une note (1 à 5) ; un second clic sur la même étoile l'efface quand la note est facultative
function NoteInput({ id, value, onChange, label, optional }) {
  return html`<div class="ent-note-in"><span class="field-label">${label}</span>
    <span class="stars" role="group" aria-label=${label} id=${id}>${[1, 2, 3, 4, 5].map(v => html`<button type="button" class=${v <= (value || 0) ? 'on' : ''} aria-label=${v + ' sur 5'} aria-pressed=${v === value} onClick=${() => onChange(optional && v === value ? null : v)}>★</button>`)}</span></div>`;
}

// ---------------------------------------------------------------------------
// Onglet Réseau > Entreprises
// ---------------------------------------------------------------------------
export function EntreprisesPage({ ctx }) {
  const { data, me, sub2 } = ctx;
  const [form, setForm] = useState(null); // { kind: 'entretien' | 'avis', initial }
  const all = useMemo(() => entreprisesDe(data), [data.profiles, data.offers, data.placements, data.entretiens, data.avis_stage]);
  const ouvrir = me.role !== 'admin' ? (kind, initial = {}) => setForm({ kind, initial }) : null;
  const c = sub2 ? all.find(x => x.k === sub2) || all.find(x => sameCompany(x.nom, sub2)) : null;
  return html`<div class="sub-page ent-page">
    ${!sub2 ? html`<${ListeEntreprises} ctx=${ctx} all=${all} ouvrir=${ouvrir}/>`
      : c ? html`<${FicheEntreprise} ctx=${ctx} c=${c} ouvrir=${ouvrir}/>`
      : html`<button class="linkish small ent-back" onClick=${() => ctx.go('reseau/entreprises')}><${Icon} name="arrow" size=${14}/> Toutes les entreprises</button>
        <${Empty} icon="briefcase" title="Entreprise introuvable">Elle n’a peut-être plus de lauréats ni d’avis sur la plateforme.<//>`}
    ${form?.kind === 'entretien' ? html`<${EntretienForm} ctx=${ctx} initial=${form.initial} onClose=${() => setForm(null)}/>` : null}
    ${form?.kind === 'avis' ? html`<${AvisForm} ctx=${ctx} initial=${form.initial} onClose=${() => setForm(null)}/>` : null}
  </div>`;
}

function ListeEntreprises({ ctx, all, ouvrir }) {
  const { me, saison } = ctx;
  const [q, setQ] = useState(''); const [type, setType] = useState(''); const [miens, setMiens] = useState(false);
  const qq = q.trim().toLowerCase();
  const ouverte = o => o.status === 'ouverte' && (me.role !== 'etudiant' || matchesMe(o, me, saison));
  const contribue = c => c.avis.some(a => estAMoi(a, me)) || c.entretiens.some(e => estAMoi(e, me));
  const poids = c => (c.avis.length + c.entretiens.length) * 3 + c.laureats.length + c.ouvertes * 2;
  const list = all
    .map(c => ({ ...c, ouvertes: c.offres.filter(ouverte).length }))
    .filter(c => c.laureats.length || c.ouvertes || c.recrues.length || c.avis.length || c.entretiens.length)
    .filter(c => !type || c.types.has(type))
    .filter(c => !miens || contribue(c))
    .filter(c => !qq || `${[...c.names.keys()].join(' ')} ${c.ville} ${c.pays} ${c.secteurs.join(' ')}`.toLowerCase().includes(qq))
    .sort((a, b) => poids(b) - poids(a) || a.nom.localeCompare(b.nom));
  const nbAvis = all.reduce((s, c) => s + c.avis.length, 0), nbEnt = all.reduce((s, c) => s + c.entretiens.length, 0);
  return html`<div class="sub-page">
    <div class="ent-hero">
      <div class="grow"><p class="eyebrow">${pluriel(nbAvis, 'avis', 'avis')} · ${pluriel(nbEnt, 'entretien partagé', 'entretiens partagés')}</p>
        <p class="ent-hero-txt">Les questions posées en entretien et les avis sur les stages, laissés par les promos précédentes. Prépare-toi avec leur expérience.</p></div>
      ${ouvrir ? html`<div class="ent-hero-actions">
        <button class="btn primary" id="ent-btn-entretien" onClick=${() => ouvrir('entretien')}><${Icon} name="qa" size=${16}/> Partager un entretien</button>
        <button class="btn primary" id="ent-btn-avis" onClick=${() => ouvrir('avis')}><${Icon} name="star" size=${16}/> Laisser un avis</button></div>` : null}
    </div>
    <label class="search"><${Icon} name="search" size=${16}/><input id="ent-q" dir="auto" placeholder="Entreprise, ville, secteur…" value=${q} onInput=${e => setQ(e.target.value)}/></label>
    <div class="chips"><button class=${'chip' + (!type ? ' on' : '')} aria-pressed=${!type} onClick=${() => setType('')}>Toutes</button>
      ${TYPE_CHIPS.map(([k, l]) => html`<button class=${'chip' + (type === k ? ' on' : '')} aria-pressed=${type === k} onClick=${() => setType(type === k ? '' : k)}><${Icon} name=${TYPE_ICON[k]} size=${14}/> ${l}</button>`)}
      ${all.some(contribue) ? html`<button class=${'chip' + (miens ? ' on' : '')} aria-pressed=${miens} onClick=${() => setMiens(!miens)}><${Icon} name="user" size=${14}/> Mes partages</button>` : null}</div>
    <ul class="ent-list">${list.slice(0, 80).map(c => html`<li key=${c.k}><button class="ent-row clickable" onClick=${() => ctx.go('reseau/entreprises/' + encodeURIComponent(c.k))}>
      <${CompanyLogo} name=${c.nom} size=${40}/>
      <span class="grow"><strong translate="no">${c.nom}</strong>
        <span class="ent-row-sub">${c.note != null ? html`<${Etoiles} note=${c.note} size=${13}/><b class="mono">${fmtNote(c.note)}</b>` : null}${c.ville || c.pays ? html`<span class="muted small" translate="no">${[c.ville, c.pays].filter(Boolean).join(', ')}</span>` : null}</span></span>
      <span class="mini-stats"><span title="Avis"><${Icon} name="star" size=${15}/> ${c.avis.length}</span><span title="Entretiens"><${Icon} name="qa" size=${15}/> ${c.entretiens.length}</span><span title="Lauréats" class="ent-hide-s"><${Icon} name="people" size=${15}/> ${c.laureats.length}</span></span>
    </button></li>`)}</ul>
    ${!list.length ? html`<${Empty} icon="briefcase" title="Aucune entreprise trouvée">${ouvrir ? 'Tu as passé un entretien ou fait un stage ? Sois le premier à partager.' : ''}<//>` : null}
    ${list.length > 80 ? html`<p class="muted small center">Affine la recherche pour voir les autres.</p>` : null}
  </div>`;
}

// ---------------------------------------------------------------------------
// Fiche d'une entreprise : avis, entretiens, lauréats et offres
// ---------------------------------------------------------------------------
function FicheEntreprise({ ctx, c, ouvrir }) {
  const { me, saison, openProfile, openOffer, store, act } = ctx;
  const s = useMemo(() => synthese(c.avis), [c.avis]);
  const avis = [...c.avis].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const entretiens = [...c.entretiens].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const offres = c.offres.filter(o => o.status === 'ouverte' && (me.role !== 'etudiant' || matchesMe(o, me, saison)));
  const tabs = [['avis', 'Avis', avis.length], ['entretiens', 'Entretiens', entretiens.length], ['equipe', 'Lauréats et offres', c.laureats.length + offres.length]];
  const [tab, setTab] = useState(avis.length || !entretiens.length ? 'avis' : 'entretiens');
  const base = { entreprise: c.nom, ville: c.ville || '', pays: c.pays || 'Maroc' };
  const lieu = [c.ville, c.pays].filter(Boolean).join(', ');
  const suppr = (table, row) => ctx.confirm(table === 'avis_stage' ? 'Supprimer cet avis ?' : 'Supprimer ce partage d’entretien ?', () => act(async () => { await store.remove(table, row.id); toast('Supprimé.'); }));
  return html`<div class="sub-page">
    <button class="linkish small ent-back" onClick=${() => ctx.go('reseau/entreprises')}><${Icon} name="arrow" size=${14}/> Toutes les entreprises</button>
    <div class="panel ent-head">
      <div class="detail-head"><${CompanyLogo} name=${c.nom} size=${56}/>
        <div class="detail-title grow"><h2 translate="no">${c.nom}</h2>
          <p class="muted small">${c.secteurs.slice(0, 2).join(' · ')}${c.secteurs.length && lieu ? ' · ' : ''}<span translate="no">${lieu}</span></p></div></div>
      ${s.n ? html`<div class="ent-synth">
        <div class="ent-big"><span class="ent-big-n mono">${fmtNote(s.note)}</span><${Etoiles} note=${s.note} size=${18}/><span class="muted small">${pluriel(s.n, 'avis', 'avis')}</span></div>
        <div class="ent-subnotes">${NOTES.map(([k, l]) => s[k] != null ? html`<div class="ent-subnote"><span class="small">${l}</span><span class="ent-gauge" aria-hidden="true"><span style=${`width:${(s[k] / 5) * 100}%`}></span></span><b class="mono small">${fmtNote(s[k])}</b></div>` : null)}</div>
        ${s.recommande != null || s.gratifs.length ? html`<div class="ent-facts">
          ${s.recommande != null ? html`<span class="ent-fact"><${Icon} name="thumb" size=${15}/> <span><b class="mono">${Math.round(s.recommande * 100)} %</b> recommandent</span></span>` : null}
          ${s.gratifs.length ? html`<span class="ent-fact"><${Icon} name="briefcase" size=${15}/> <span>Gratification :</span> ${s.gratifs.map(([g, n], i) => html`${i ? ' · ' : ''}<span>${GRATIFS[g]} (${n})</span>`)}</span>` : null}
        </div>` : null}
      </div>` : html`<p class="muted small">Pas encore d’avis sur cette entreprise.</p>`}
      ${ouvrir ? html`<div class="row ent-actions">
        <button class="btn small primary" id="ent-f-entretien" onClick=${() => ouvrir('entretien', base)}><${Icon} name="qa" size=${15}/> Partager un entretien</button>
        <button class="btn small primary" id="ent-f-avis" onClick=${() => ouvrir('avis', base)}><${Icon} name="star" size=${15}/> Laisser un avis</button>
        ${c.laureats.length && !c.laureats.some(p => p.id === me.id) ? html`<button class="btn small ghost" onClick=${() => ctx.askQuestion({ entreprise: c.nom })}><${Icon} name="comment" size=${15}/> Poser une question</button>` : null}
      </div>` : null}
    </div>

    <div class="seg" role="tablist">${tabs.map(([k, l, n]) => html`<button role="tab" aria-selected=${tab === k} class=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}>${l} <span class="count">${n}</span></button>`)}</div>

    ${tab === 'avis' ? html`<div class="list">${avis.length ? avis.map(a => html`<${AvisCard} key=${a.id} ctx=${ctx} a=${a} onEdit=${() => ouvrir?.('avis', a)} onDelete=${() => suppr('avis_stage', a)}/>`)
      : html`<${Empty} icon="star" title="Aucun avis pour l’instant">${ouvrir ? 'Tu y as fait un stage ? Ton avis aide la promo suivante à choisir.' : ''}<//>`}</div>` : null}
    ${tab === 'entretiens' ? html`<div class="list">${entretiens.length ? entretiens.map(e => html`<${EntretienCard} key=${e.id} ctx=${ctx} e=${e} onEdit=${() => ouvrir?.('entretien', e)} onDelete=${() => suppr('entretiens', e)}/>`)
      : html`<${Empty} icon="qa" title="Aucun entretien partagé">${ouvrir ? 'Tu as passé un entretien ici ? Partage les questions, même celles qui t’ont surpris.' : ''}<//>`}</div>` : null}
    ${tab === 'equipe' ? html`<div class="sub-page">
      ${c.laureats.length ? html`<div class="panel"><div class="section-head"><h2 class="h-ico"><${Icon} name="people"/> Lauréats chez <span translate="no">${c.nom}</span></h2></div>
        <ul class="people-list">${c.laureats.map(p => html`<li key=${p.id}><${Person} p=${p} onOpen=${openProfile} size=${32}/><span class="muted small" translate="no" dir="auto">${[p.poste, p.ville].filter(Boolean).join(' · ')}</span></li>`)}</ul></div>` : null}
      ${offres.length ? html`<div class="section-head"><h2 class="h-ico"><${Icon} name="feed"/> Offres ouvertes</h2></div><div class="offer-grid one">${offres.map(o => html`<${OfferCard} key=${o.id} o=${o} ctx=${ctx} onOpen=${() => openOffer(o.id)}/>`)}</div>` : null}
      ${!c.laureats.length && !offres.length ? html`<${Empty} icon="people" title="Aucun lauréat ni offre ouverte ici pour l’instant"/>` : null}
    </div>` : null}
  </div>`;
}

// Qui a écrit : le nom, ou une mention neutre si c'est anonyme
function Auteur({ ctx, row }) {
  const { me, store, openProfile } = ctx;
  const p = auteurVisible(row, me) ? store.byId('profiles', row.author_id) : null;
  const quand = `${TYPES[row.type]?.label || ''}${row.saison ? ' · ' + saisonTxt(row.saison) : ''}`;
  if (p) return html`<div class="ent-auteur"><${Person} p=${p} onOpen=${openProfile} size=${28} sub=${quand}/>
    ${row.anonyme ? html`<span class="mini" title=${estAMoi(row, me) ? 'Les autres membres ne voient pas ton nom' : 'Nom caché aux membres, visible par l’administration'}><${Icon} name="lock" size=${12}/> Anonyme</span>` : null}${estAMoi(row, me) ? html`<span class="mini good">Toi</span>` : null}</div>`;
  return html`<div class="ent-auteur"><span class="ent-anon" aria-hidden="true"><${Icon} name="user" size=${15}/></span><span class="ent-anon-txt"><b class="small">${row.type === 'emploi' ? 'Membre anonyme' : 'Étudiant(e) anonyme'}</b><span class="muted small">${quand}</span></span></div>`;
}

function Actions({ ctx, row, type, onEdit, onDelete }) {
  const { me } = ctx;
  const mien = estAMoi(row, me);
  return html`<span class="ent-acts">
    ${mien ? html`<button class="icon-btn small" aria-label="Modifier" onClick=${onEdit}><${Icon} name="edit" size=${15}/></button>` : null}
    ${mien || me.role === 'admin' ? html`<button class="icon-btn small" aria-label="Supprimer" onClick=${onDelete}><${Icon} name="trash" size=${15}/></button>` : null}
    ${!mien && me.role !== 'admin' ? html`<${SignalerBtn} ctx=${ctx} type=${type} id=${row.id} small/>` : null}
  </span>`;
}

function AvisCard({ ctx, a, onEdit, onDelete }) {
  return html`<article class="ent-card">
    <div class="ent-card-top"><${Auteur} ctx=${ctx} row=${a}/><span class="spacer"></span><${Actions} ctx=${ctx} row=${a} type="avis" onEdit=${onEdit} onDelete=${onDelete}/></div>
    <div class="ent-card-meta"><${Etoiles} note=${a.note} size=${16}/>
      ${a.verifie ? html`<span class="tag coopt" title="Ce stage a été confirmé par l’étudiant et le lauréat sur la plateforme"><${Icon} name="shield" size=${13}/> Stage vérifié</span>` : null}
      ${a.recommande === true ? html`<span class="good-t small"><${Icon} name="thumb" size=${14}/> Recommande</span>` : a.recommande === false ? html`<span class="muted small">Ne recommande pas</span>` : null}
      ${a.gratification ? html`<span class="mini">Gratification : ${GRATIFS[a.gratification]}</span>` : null}</div>
    ${a.poste || a.ville ? html`<p class="small muted ent-poste" translate="no" dir="auto">${[a.poste, a.ville, a.pays && a.pays !== 'Maroc' ? a.pays : ''].filter(Boolean).join(' · ')}</p>` : null}
    ${NOTES.some(([k]) => a[k]) ? html`<p class="ent-subline small">${NOTES.filter(([k]) => a[k]).map(([k, l]) => html`<span><span>${l}</span> <b class="mono">${a[k]}/5</b></span>`)}</p>` : null}
    ${a.conseils ? html`<p class="ent-txt" translate="no" dir="auto">${a.conseils}</p>` : null}
    <p class="muted small ent-when">${timeAgo(a.created_at)}</p>
  </article>`;
}

function EntretienCard({ ctx, e, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const f = FORMATS[e.format];
  const long = e.deroulement || e.conseils;
  return html`<article class="ent-card">
    <div class="ent-card-top"><${Auteur} ctx=${ctx} row=${e}/><span class="spacer"></span><${Actions} ctx=${ctx} row=${e} type="entretien" onEdit=${onEdit} onDelete=${onDelete}/></div>
    <div class="ent-card-meta">
      ${e.poste ? html`<strong class="ent-poste-t" translate="no" dir="auto">${e.poste}</strong>` : null}
      ${f ? html`<span class="mini"><${Icon} name=${f[1]} size=${12}/> ${f[0]}</span>` : null}
      ${e.difficulte ? html`<span class="ent-diff" title=${`Difficulté ${e.difficulte}/5`}><span class="ent-dots" aria-hidden="true">${[1, 2, 3, 4, 5].map(i => html`<i class=${i <= e.difficulte ? 'on' : ''}></i>`)}</span><span class="small">${DIFFS[e.difficulte]}</span></span>` : null}
      ${e.resultat && e.resultat !== 'inconnu' ? html`<span class=${'mini' + (e.resultat === 'retenu' ? ' good' : '')}>${RESULTATS[e.resultat]}</span>` : null}</div>
    <ol class="ent-questions">${(e.questions || []).map(q => html`<li><span translate="no" dir="auto">${q}</span></li>`)}</ol>
    ${long ? (open ? html`
      ${e.deroulement ? html`<div class="ent-bloc"><span class="field-label">Déroulement</span><p class="ent-txt" translate="no" dir="auto">${e.deroulement}</p></div>` : null}
      ${e.conseils ? html`<div class="ent-bloc"><span class="field-label">Conseils</span><p class="ent-txt" translate="no" dir="auto">${e.conseils}</p></div>` : null}
      <button class="linkish small ent-more" onClick=${() => setOpen(false)}>Voir moins</button>` : html`<button class="linkish small ent-more" onClick=${() => setOpen(true)}>Déroulement et conseils</button>`) : null}
    <p class="muted small ent-when">${timeAgo(e.created_at)}</p>
  </article>`;
}

// ---------------------------------------------------------------------------
// Formulaires
// ---------------------------------------------------------------------------
function nomsConnus(data) {
  return [...new Set(entreprisesDe(data).map(c => c.nom))].sort((a, b) => a.localeCompare(b)).slice(0, 300);
}
function saisonsOpts(courante, valeur) {
  const s = new Set([courante, courante - 1, courante - 2, courante - 3, courante - 4]); if (valeur) s.add(+valeur);
  return [...s].sort((a, b) => b - a);
}

function TypeSeg({ value, onChange, disabled }) {
  return html`<div class="seg ent-type-seg" role="group" aria-label="Type">${TYPE_CHIPS.map(([k, l]) => html`<button type="button" disabled=${disabled && value !== k} class=${value === k ? 'on' : ''} aria-pressed=${value === k} onClick=${() => !disabled && onChange(k)}><${Icon} name=${TYPE_ICON[k]} size=${14}/> ${l}</button>`)}</div>`;
}

export function EntretienForm({ ctx, initial = {}, onClose }) {
  const { data, me, store, act } = ctx;
  const S = seasonOf();
  const editing = !!initial.id;
  const [f, setF] = useState(() => ({ entreprise: '', poste: '', type: 'stage', saison: S, format: '', deroulement: '', conseils: '', difficulte: null, resultat: '', anonyme: false, offer_id: null, ...initial, questions: initial.questions?.length ? [...initial.questions] : ['', ''] }));
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const setQ = (i, v) => setF(x => ({ ...x, questions: x.questions.map((q, j) => (j === i ? v : q)) }));
  const qs = f.questions.map(q => q.trim()).filter(Boolean);
  const total = qs.join('').length;
  const ok = f.entreprise.trim().length >= 2 && qs.length >= 1 && total <= 4000;
  const noms = useMemo(() => nomsConnus(data), [data.entretiens, data.avis_stage, data.offers]);
  const submit = e => {
    e.preventDefault(); if (!ok) return;
    const row = { poste: (f.poste || '').trim() || null, format: f.format || null, questions: qs.map(q => q.slice(0, 300)).slice(0, 20), deroulement: (f.deroulement || '').trim() || null, conseils: (f.conseils || '').trim() || null, difficulte: f.difficulte || null, resultat: f.resultat || null, anonyme: !!f.anonyme };
    act(async () => {
      if (editing) await store.update('entretiens', initial.id, row);
      else await store.insert('entretiens', { ...row, entreprise: f.entreprise.trim().slice(0, 80), type: f.type, saison: +f.saison, offer_id: f.offer_id || null, author_id: me.id });
      toast(editing ? 'Entretien mis à jour.' : 'Merci ! Tes questions aideront la promo suivante.');
      onClose();
    });
  };
  return html`<${Modal} title=${editing ? 'Modifier mon entretien' : 'Partager un entretien'} onClose=${onClose} wide>
    <form class="form" onSubmit=${submit}>
      ${!editing ? html`<p class="hint-box small"><${Icon} name="qa" size=${16}/><span>Les questions qu’on t’a posées aident les suivants à se préparer. Pas de nom de recruteur ni d’information confidentielle.</span></p>` : null}
      <div class="grid2">
        <${Field} label="Entreprise" hint=${editing ? 'L’entreprise, le type et la saison ne changent plus.' : ''}><input id="en-ent" dir="auto" list="ent-noms" required maxlength="80" disabled=${editing} value=${f.entreprise} onInput=${e => set('entreprise', e.target.value)} translate="no"/><//>
        <${Field} label="Poste ou sujet"><input id="en-poste" dir="auto" maxlength="100" value=${f.poste || ''} onInput=${e => set('poste', e.target.value)} placeholder="Ex. PFE méthodes, ingénieur qualité…"/><//>
      </div>
      <datalist id="ent-noms">${noms.map(n => html`<option value=${n}/>`)}</datalist>
      <div class="ent-form-row"><${TypeSeg} value=${f.type} onChange=${v => set('type', v)} disabled=${editing}/>
        <label class="ent-inline"><span class="field-label">Saison</span><select id="en-saison" disabled=${editing} value=${f.saison} onChange=${e => set('saison', +e.target.value)}>${saisonsOpts(S, f.saison).map(s => html`<option value=${s}>${saisonTxt(s)}</option>`)}</select></label></div>
      <div class="grid2">
        <${Field} label="Format"><select id="en-format" value=${f.format || ''} onChange=${e => set('format', e.target.value)}><option value="">—</option>${Object.entries(FORMATS).map(([k, [l]]) => html`<option value=${k}>${l}</option>`)}</select><//>
        <${Field} label="Résultat"><select id="en-res" value=${f.resultat || ''} onChange=${e => set('resultat', e.target.value)}><option value="">—</option>${Object.entries(RESULTATS).map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select><//>
      </div>
      <div class="field"><span class="field-label">Les questions posées</span>
        <ol class="ent-q-edit">${f.questions.map((q, i) => html`<li key=${i}><input id=${'en-q' + i} dir="auto" maxlength="300" value=${q} onInput=${e => setQ(i, e.target.value)} placeholder=${i === 0 ? 'Ex. Présente un projet dont tu es fier(e).' : 'Une autre question…'} aria-label=${'Question ' + (i + 1)}/>
          ${f.questions.length > 1 ? html`<button type="button" class="icon-btn small" aria-label="Retirer cette question" onClick=${() => setF(x => ({ ...x, questions: x.questions.filter((_, j) => j !== i) }))}><${Icon} name="x" size=${14}/></button>` : null}</li>`)}</ol>
        ${f.questions.length < 20 ? html`<button type="button" class="btn tiny ghost ent-addq" id="en-addq" onClick=${() => setF(x => ({ ...x, questions: [...x.questions, ''] }))}><${Icon} name="plus" size=${14}/> Ajouter une question</button>` : null}
        ${total > 4000 ? html`<span class="field-hint danger-t">Les questions sont trop longues (4 000 caractères au total).</span>` : null}
      </div>
      <div class="field"><span class="field-label">Difficulté</span>
        <div class="seg ent-diff-seg" role="group" aria-label="Difficulté">${[1, 2, 3, 4, 5].map(v => html`<button type="button" class=${f.difficulte === v ? 'on' : ''} aria-pressed=${f.difficulte === v} onClick=${() => set('difficulte', f.difficulte === v ? null : v)}>${DIFFS[v]}</button>`)}</div></div>
      <${Field} label="Déroulement" hint="Durée, avec qui, étapes, test technique…"><textarea id="en-der" dir="auto" rows="3" maxlength="2000" value=${f.deroulement || ''} onInput=${e => set('deroulement', e.target.value)}></textarea><//>
      <${Field} label="Tes conseils pour bien le préparer"><textarea id="en-cons" dir="auto" rows="2" maxlength="1500" value=${f.conseils || ''} onInput=${e => set('conseils', e.target.value)}></textarea><//>
      <label class="check"><input id="en-anon" type="checkbox" checked=${f.anonyme} onChange=${e => set('anonyme', e.target.checked)}/> <span>Partager anonymement <span class="muted small">(ton nom n’apparaît pour aucun membre)</span></span></label>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" id="en-ok" disabled=${!ok}>${editing ? 'Enregistrer' : 'Partager'}</button></div>
    </form>
  <//>`;
}

export function AvisForm({ ctx, initial = {}, onClose }) {
  const { data, me, store, act } = ctx;
  const S = seasonOf();
  const editing = !!initial.id;
  const [f, setF] = useState(() => ({ entreprise: '', ville: '', pays: 'Maroc', type: 'stage', saison: S, poste: '', note: null, note_encadrement: null, note_apprentissage: null, note_ambiance: null, gratification: '', conseils: '', recommande: null, anonyme: true, placement_id: null, ...initial }));
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const ok = f.entreprise.trim().length >= 2 && f.note >= 1;
  const noms = useMemo(() => nomsConnus(data), [data.entretiens, data.avis_stage, data.offers]);
  const submit = e => {
    e.preventDefault(); if (!ok) return;
    const row = { ville: (f.ville || '').trim() || null, pays: (f.pays || '').trim() || 'Maroc', poste: (f.poste || '').trim() || null, note: f.note, note_encadrement: f.note_encadrement || null, note_apprentissage: f.note_apprentissage || null, note_ambiance: f.note_ambiance || null, gratification: f.gratification || null, conseils: (f.conseils || '').trim() || null, recommande: f.recommande, anonyme: !!f.anonyme };
    act(async () => {
      if (editing) await store.update('avis_stage', initial.id, row);
      else await store.insert('avis_stage', { ...row, entreprise: f.entreprise.trim().slice(0, 80), type: f.type, saison: +f.saison, placement_id: f.placement_id || null, author_id: me.id });
      toast(editing ? 'Avis mis à jour.' : 'Merci ! Ton avis aidera la promo suivante.');
      onClose();
    });
  };
  return html`<${Modal} title=${editing ? 'Modifier mon avis' : 'Laisser un avis'} onClose=${onClose} wide>
    <form class="form" onSubmit=${submit}>
      ${!editing ? html`<p class="hint-box small"><${Icon} name="star" size=${16}/><span>Comment s’est passé ce stage ? Ton avis aide les étudiants à choisir. Reste honnête et bienveillant(e).</span></p>` : null}
      <div class="grid2">
        <${Field} label="Entreprise" hint=${editing ? 'L’entreprise, le type et la saison ne changent plus.' : ''}><input id="av-ent" dir="auto" list="av-noms" required maxlength="80" disabled=${editing} value=${f.entreprise} onInput=${e => set('entreprise', e.target.value)} translate="no"/><//>
        <${Field} label="Poste ou sujet"><input id="av-poste" dir="auto" maxlength="100" value=${f.poste || ''} onInput=${e => set('poste', e.target.value)}/><//>
      </div>
      <datalist id="av-noms">${noms.map(n => html`<option value=${n}/>`)}</datalist>
      <div class="grid2"><${Field} label="Ville"><input id="av-ville" dir="auto" maxlength="60" value=${f.ville || ''} onInput=${e => set('ville', e.target.value)}/><//><${Field} label="Pays"><input id="av-pays" dir="auto" maxlength="60" value=${f.pays || ''} onInput=${e => set('pays', e.target.value)}/><//></div>
      <div class="ent-form-row"><${TypeSeg} value=${f.type} onChange=${v => set('type', v)} disabled=${editing}/>
        <label class="ent-inline"><span class="field-label">Saison</span><select id="av-saison" disabled=${editing} value=${f.saison} onChange=${e => set('saison', +e.target.value)}>${saisonsOpts(S, f.saison).map(s => html`<option value=${s}>${saisonTxt(s)}</option>`)}</select></label></div>
      <div class="ent-notes-grid">
        <${NoteInput} id="av-note" label="Note globale" value=${f.note} onChange=${v => set('note', v)}/>
        ${NOTES.map(([k, l]) => html`<${NoteInput} id=${'av-' + k} label=${l} value=${f[k]} optional onChange=${v => set(k, v)}/>`)}
      </div>
      <div class="field"><span class="field-label">Gratification</span>
        <div class="seg" role="group" aria-label="Gratification">${Object.entries(GRATIFS).map(([k, l]) => html`<button type="button" class=${f.gratification === k ? 'on' : ''} aria-pressed=${f.gratification === k} onClick=${() => set('gratification', f.gratification === k ? '' : k)}>${l}</button>`)}</div></div>
      <div class="field"><span class="field-label">Tu le recommandes à un(e) camarade ?</span>
        <div class="seg" role="group" aria-label="Recommandation">${[[true, 'Oui'], [false, 'Non']].map(([v, l]) => html`<button type="button" id=${'av-rec-' + (v ? 'oui' : 'non')} class=${f.recommande === v ? 'on' : ''} aria-pressed=${f.recommande === v} onClick=${() => set('recommande', f.recommande === v ? null : v)}>${l}</button>`)}</div></div>
      <${Field} label="Tes conseils" hint="Encadrement, missions, ambiance, transport, ce qu’il faut savoir avant d’y aller"><textarea id="av-cons" dir="auto" rows="3" maxlength="1500" value=${f.conseils || ''} onInput=${e => set('conseils', e.target.value)}></textarea><//>
      <label class="check"><input id="av-anon" type="checkbox" checked=${f.anonyme} onChange=${e => set('anonyme', e.target.checked)}/> <span>Rester anonyme <span class="muted small">(ton nom n’apparaît pour aucun membre)</span></span></label>
      ${!f.note ? html`<p class="small muted">Choisis au moins la note globale.</p>` : null}
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" id="av-ok" disabled=${!ok}>${editing ? 'Enregistrer' : 'Publier mon avis'}</button></div>
    </form>
  <//>`;
}

// ---------------------------------------------------------------------------
// Résumé compact, dans une offre ou une fiche entreprise. « onOpen » ferme la fenêtre
// qui l'affiche avant d'aller sur la page de l'entreprise (sinon : touche Échap simulée).
// ---------------------------------------------------------------------------
export function EntrepriseResume({ ctx, entreprise, onOpen }) {
  const { data } = ctx;
  const r = useMemo(() => {
    if (!entreprise) return null;
    const avis = (data.avis_stage || []).filter(a => sameCompany(a.entreprise, entreprise));
    const ent = (data.entretiens || []).filter(e => sameCompany(e.entreprise, entreprise));
    return avis.length || ent.length ? { avis: avis.length, ent: ent.length, note: moy(avis.map(a => a.note).filter(Boolean)) } : null;
  }, [data.avis_stage, data.entretiens, entreprise]);
  if (!r) return null;
  const voir = () => {
    if (onOpen) onOpen(); else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    ctx.go(lienEntreprise(entreprise));
  };
  return html`<div class="ent-resume">
    ${r.note != null ? html`<${Etoiles} note=${r.note} size=${14}/><b class="mono small">${fmtNote(r.note)}</b>` : html`<${Icon} name="qa" size=${15}/>`}
    <span class="small">${[r.avis ? pluriel(r.avis, 'avis', 'avis') : '', r.ent ? pluriel(r.ent, 'entretien partagé', 'entretiens partagés') : ''].filter(Boolean).join(' · ')}</span>
    <button type="button" class="linkish small" onClick=${voir}>Voir</button>
  </div>`;
}

// Les dernières questions posées dans cette entreprise
export function QuestionsRecentes({ ctx, entreprise, max = 3 }) {
  const qs = useMemo(() => (ctx.data.entretiens || []).filter(e => sameCompany(e.entreprise, entreprise)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).flatMap(e => e.questions || []).slice(0, max), [ctx.data.entretiens, entreprise]);
  if (!qs.length) return null;
  return html`<div class="ent-recent"><span class="field-label">Questions posées en entretien</span><ul class="ent-questions">${qs.map(q => html`<li><span translate="no" dir="auto">${q}</span></li>`)}</ul></div>`;
}

// ---------------------------------------------------------------------------
// Accueil : une invitation à la fois (avis sur son stage, ou questions de son entretien)
// ---------------------------------------------------------------------------
export function NudgeAvis({ ctx }) {
  const { data, me, store } = ctx;
  const [off, setOff] = useLocal('nudge-avis-' + me.id, []);
  const [form, setForm] = useState(null);
  const item = useMemo(() => {
    if (me.role === 'admin') return null;
    const S = seasonOf(); const now = Date.now();
    const mesAvis = (data.avis_stage || []).filter(a => a.author_id === me.id);
    const mesEnt = (data.entretiens || []).filter(e => e.author_id === me.id);
    const out = [];
    // Stage (ou premier emploi) terminé ou bien avancé, sans avis
    for (const p of data.placements) {
      if (p.student_id !== me.id || !FOUND.has(p.status) || !p.entreprise) continue;
      const depuis = new Date(p.confirmed_at || p.created_at).getTime();
      if (!(p.saison < S || now - depuis > 42 * 864e5)) continue;
      if (mesAvis.some(a => a.saison === p.saison && sameCompany(a.entreprise, p.entreprise))) continue;
      out.push({ key: 'av' + p.id, kind: 'avis', at: depuis, ent: p.entreprise, emploi: p.type === 'emploi', initial: { entreprise: p.entreprise, ville: p.ville || '', pays: p.pays || 'Maroc', type: p.type, saison: p.saison, placement_id: p.id } });
    }
    // Entretien passé ce mois-ci, sans questions partagées
    if (me.role === 'etudiant') for (const a of data.applications) {
      if (a.student_id !== me.id || !['entretien', 'retenu', 'refuse'].includes(a.status)) continue;
      const quand = new Date(a.updated_at || a.created_at).getTime();
      if (now - quand > 30 * 864e5) continue;
      const o = a.offer_id ? store.byId('offers', a.offer_id) : null;
      const ent = o?.entreprise || a.entreprise; if (!ent) continue;
      if (mesEnt.some(e => sameCompany(e.entreprise, ent)) || out.some(x => x.kind === 'entretien' && sameCompany(x.ent, ent))) continue;
      out.push({ key: 'en' + a.id, kind: 'entretien', at: quand, ent, initial: { entreprise: ent, poste: o?.titre || a.titre || '', type: o?.type || 'stage', saison: S, offer_id: a.offer_id || null, resultat: a.status === 'retenu' ? 'retenu' : a.status === 'refuse' ? 'refuse' : 'attente' } });
    }
    return out.filter(x => !off.includes(x.key)).sort((a, b) => b.at - a.at)[0] || null;
  }, [data.placements, data.applications, data.avis_stage, data.entretiens, off, me.id]);
  if (!item && !form) return null;
  return html`<div class="ent-nudge-wrap">
    ${item ? html`<div class="help-cta ent-nudge">
      <span class="obj-ico brass"><${Icon} name=${item.kind === 'avis' ? 'star' : 'qa'} size=${20}/></span>
      <div class="grow">${item.kind === 'avis'
        ? html`<strong>${item.emploi ? 'Comment se passent tes débuts chez' : 'Comment s’est passé ton stage chez'} <span translate="no">${item.ent}</span> ?</strong><span class="small muted">Ton avis, anonyme si tu veux, aide la promo suivante à choisir.</span>`
        : html`<strong>Partage les questions de ton entretien chez <span translate="no">${item.ent}</span></strong><span class="small muted">Même trois questions suffisent pour aider ceux qui passent après toi.</span>`}</div>
      <div class="ent-nudge-btns"><button class="btn ghost small" onClick=${() => setOff([...off, item.key])}>Plus tard</button>
        <button class="btn small" id="nudge-ent-go" onClick=${() => setForm(item)}>${item.kind === 'avis' ? 'Donner mon avis' : 'Partager mes questions'}</button></div>
    </div>` : null}
    ${form?.kind === 'avis' ? html`<${AvisForm} ctx=${ctx} initial=${form.initial} onClose=${() => setForm(null)}/>` : null}
    ${form?.kind === 'entretien' ? html`<${EntretienForm} ctx=${ctx} initial=${form.initial} onClose=${() => setForm(null)}/>` : null}
  </div>`;
}

// ---------------------------------------------------------------------------
injectCSS('entreprises', `
.ent-hero { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; padding: 1rem 1.1rem; border-radius: 14px; background: var(--accent-soft); }
.ent-hero .grow { flex: 1 1 280px; min-width: 0; }
.ent-hero .eyebrow { margin: 0 0 .2rem; }
.ent-hero-txt { margin: 0; color: var(--ink-2); font-size: .92rem; }
.ent-hero-actions { display: flex; gap: .5rem; flex-wrap: wrap; }
.ent-row .grow strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ent-row-sub { display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; min-height: 1.1rem; }
.ent-row-sub b { font-size: .8rem; color: var(--ink-2); }
.ent-stars { display: inline-flex; gap: 1px; font-size: var(--s, 15px); line-height: 1; color: color-mix(in srgb, var(--brass) 25%, transparent); }
.ent-stars .on { color: var(--brass); }
.ent-stars .half { background: linear-gradient(90deg, var(--brass) 50%, color-mix(in srgb, var(--brass) 25%, transparent) 50%); -webkit-background-clip: text; background-clip: text; color: transparent; }
:root[dir="rtl"] .ent-stars .half { background: linear-gradient(270deg, var(--brass) 50%, color-mix(in srgb, var(--brass) 25%, transparent) 50%); -webkit-background-clip: text; background-clip: text; }
.ent-back { display: inline-flex; align-items: center; gap: .3rem; align-self: flex-start; }
.ent-back svg { transform: scaleX(-1); }
:root[dir="rtl"] .ent-back svg { transform: none; }
.ent-head { display: flex; flex-direction: column; gap: .9rem; }
.ent-head h2 { margin: 0; }
.ent-head .detail-title p { margin: .15rem 0 0; }
.ent-synth { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: .7rem 1.4rem; align-items: center; }
.ent-big { display: flex; flex-direction: column; align-items: center; gap: .2rem; padding-inline-end: 1.3rem; border-inline-end: 1px solid var(--line); }
.ent-big-n { font-size: 2.1rem; font-weight: 600; line-height: 1; color: var(--ink); }
.ent-subnotes { display: flex; flex-direction: column; gap: .4rem; min-width: 0; max-width: 420px; }
.ent-subnote { display: grid; grid-template-columns: 7.5rem minmax(0, 1fr) 2rem; gap: .6rem; align-items: center; }
.ent-gauge { height: 7px; border-radius: 99px; background: var(--surface-2); overflow: hidden; }
.ent-gauge span { display: block; height: 100%; border-radius: inherit; background: var(--brass); }
.ent-facts { grid-column: 1 / -1; display: flex; gap: .4rem 1.4rem; flex-wrap: wrap; font-size: .88rem; color: var(--ink-2); }
.ent-fact { display: inline-flex; align-items: center; gap: .35rem; flex-wrap: wrap; }
.ent-fact svg { color: var(--brass); flex: none; }
.ent-actions { flex-wrap: wrap; gap: .5rem; }
.ent-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); padding: .9rem 1rem; display: flex; flex-direction: column; gap: .55rem; min-width: 0; }
.ent-card-top { display: flex; align-items: flex-start; gap: .5rem; }
.ent-auteur { display: flex; align-items: center; gap: .45rem; flex-wrap: wrap; min-width: 0; }
.ent-auteur .mini { margin: 0; }
.ent-anon { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--surface-2); color: var(--muted); flex: none; }
.ent-anon-txt { display: flex; flex-direction: column; line-height: 1.25; }
.ent-acts { display: inline-flex; align-items: center; gap: .15rem; flex: none; }
.ent-card-meta { display: flex; align-items: center; gap: .4rem .7rem; flex-wrap: wrap; }
.ent-card-meta .mini { margin: 0; display: inline-flex; align-items: center; gap: .25rem; }
.ent-poste, .ent-when { margin: 0; }
.ent-poste-t { font-size: .95rem; }
.ent-subline { display: flex; gap: .3rem 1rem; flex-wrap: wrap; margin: 0; color: var(--ink-2); }
.ent-txt { margin: 0; white-space: pre-line; overflow-wrap: anywhere; }
.ent-questions { margin: 0; padding-inline-start: 1.4rem; display: flex; flex-direction: column; gap: .3rem; }
.ent-questions li { overflow-wrap: anywhere; padding-inline-start: .15rem; }
.ent-questions li::marker { color: var(--accent); font-weight: 600; }
.ent-bloc { display: flex; flex-direction: column; gap: .2rem; }
.ent-more { align-self: flex-start; }
.ent-diff { display: inline-flex; align-items: center; gap: .35rem; color: var(--ink-2); }
.ent-dots { display: inline-flex; gap: 3px; }
.ent-dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--surface-2); border: 1px solid var(--line); }
.ent-dots i.on { background: var(--warn); border-color: var(--warn); }
.ent-form-row { display: flex; gap: .7rem 1rem; align-items: flex-end; flex-wrap: wrap; }
.ent-inline { display: flex; flex-direction: column; gap: .3rem; }
.ent-type-seg button { display: inline-flex; align-items: center; gap: .3rem; }
.ent-type-seg button:disabled { opacity: .45; cursor: default; }
.ent-q-edit { margin: 0; padding-inline-start: 1.4rem; display: flex; flex-direction: column; gap: .4rem; }
.ent-q-edit li { padding-inline-start: .15rem; }
.ent-q-edit li > * { vertical-align: middle; }
.ent-q-edit input { width: calc(100% - 2.4rem); }
.ent-q-edit li::marker { color: var(--muted); }
.ent-addq { align-self: flex-start; margin-top: .3rem; }
.ent-diff-seg button { font-size: .82rem; }
.ent-notes-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .6rem 1rem; }
.ent-note-in { display: flex; flex-direction: column; gap: .2rem; }
.ent-note-in .stars button { font-size: 1.55rem; }
.ent-resume { display: flex; align-items: center; gap: .45rem; flex-wrap: wrap; padding: .45rem .75rem; border-radius: 9px; background: var(--brass-soft); color: var(--ink-2); }
.ent-resume > svg { color: var(--brass); }
.ent-resume .linkish { margin-inline-start: auto; font-weight: 600; }
.ent-recent { display: flex; flex-direction: column; gap: .3rem; }
.ent-recent .ent-questions { font-size: .92rem; }
.ent-nudge-btns { display: flex; gap: .4rem; margin-inline-start: auto; }
@media (max-width: 640px) {
  .ent-hero-actions { width: 100%; }
  .ent-hero-actions .btn { flex: 1 1 0; justify-content: center; padding-inline: .5rem; }
  .ent-synth { grid-template-columns: minmax(0, 1fr); }
  .ent-big { flex-direction: row; justify-content: flex-start; gap: .6rem; padding: 0 0 .7rem; border-inline-end: 0; border-bottom: 1px solid var(--line); }
  .ent-subnote { grid-template-columns: 6.8rem minmax(0, 1fr) 2rem; }
  .ent-hide-s { display: none !important; }
  .ent-notes-grid { grid-template-columns: minmax(0, 1fr); }
  .ent-actions .btn { flex: 1 1 auto; justify-content: center; }
  .ent-nudge-btns { width: 100%; margin: 0; }
  .ent-nudge-btns .btn { flex: 1 1 0; justify-content: center; }
}
`);

// ---------------------------------------------------------------------------
addAR({
  'Sur place': 'حضوريا', 'Visio': 'عن بعد', 'Téléphone': 'الهاتف', 'Test écrit': 'اختبار كتابي',
  'En attente de réponse': 'في انتظار الجواب', 'Je ne sais pas': 'لا أعرف بعد',
  'Non rémunéré': 'بدون منحة', 'Symbolique': 'رمزية', 'Correcte': 'مقبولة', 'Bonne': 'جيدة',
  'Facile': 'سهلة', 'Abordable': 'في المتناول', 'Moyen': 'متوسطة', 'Difficile': 'صعبة', 'Très difficile': 'صعبة جدا',
  'Encadrement': 'التأطير', 'Apprentissage': 'التعلم', 'Ambiance': 'الأجواء',
  'Partager un entretien': 'شارك مقابلة', 'Laisser un avis': 'اترك رأيك', 'Mes partages': 'مشاركاتي',
  'Les questions posées en entretien et les avis sur les stages, laissés par les promos précédentes. Prépare-toi avec leur expérience.': 'أسئلة المقابلات وآراء حول التداريب، تركتها الدفعات السابقة. استعد بفضل تجربتها.',
  'Entreprise, ville, secteur…': 'شركة، مدينة، قطاع…',
  'Aucune entreprise trouvée': 'لم نجد أي شركة',
  'Tu as passé un entretien ou fait un stage ? Sois le premier à partager.': 'اجتزت مقابلة أو قمت بتدريب؟ كن أول من يشارك.',
  'Avis': 'الآراء', 'Entretiens': 'المقابلات', 'Lauréats et offres': 'الخريجون والعروض',
  'Toutes les entreprises': 'كل الشركات', 'Entreprise introuvable': 'الشركة غير موجودة',
  'Elle n’a peut-être plus de lauréats ni d’avis sur la plateforme.': 'ربما لم يعد لها خريجون ولا آراء على المنصة.',
  'Pas encore d’avis sur cette entreprise.': 'لا توجد آراء حول هذه الشركة بعد.',
  'recommandent': 'ينصحون بها', 'Gratification :': 'المنحة:',
  'Aucun avis pour l’instant': 'لا توجد آراء حاليا',
  'Tu y as fait un stage ? Ton avis aide la promo suivante à choisir.': 'قمت فيها بتدريب؟ رأيك يساعد الدفعة القادمة على الاختيار.',
  'Aucun entretien partagé': 'لم تتم مشاركة أي مقابلة بعد',
  'Tu as passé un entretien ici ? Partage les questions, même celles qui t’ont surpris.': 'اجتزت مقابلة هنا؟ شارك الأسئلة، حتى التي فاجأتك.',
  'Lauréats chez': 'الخريجون في', 'Aucun lauréat ni offre ouverte ici pour l’instant': 'لا يوجد خريجون ولا عروض مفتوحة هنا حاليا',
  'Anonyme': 'مجهول', 'Toi': 'أنت', 'Membre anonyme': 'عضو مجهول', 'Étudiant(e) anonyme': 'طالب(ة) مجهول(ة)',
  'Les autres membres ne voient pas ton nom': 'باقي الأعضاء لا يرون اسمك',
  'Nom caché aux membres, visible par l’administration': 'الاسم مخفي عن الأعضاء، وتراه الإدارة فقط',
  'Supprimer cet avis ?': 'حذف هذا الرأي؟', 'Supprimer ce partage d’entretien ?': 'حذف هذه المقابلة؟', 'Supprimé.': 'تم الحذف.',
  'Stage vérifié': 'تدريب موثق', 'Ce stage a été confirmé par l’étudiant et le lauréat sur la plateforme': 'أكد الطالب والخريج هذا التدريب على المنصة',
  'Recommande': 'ينصح به', 'Ne recommande pas': 'لا ينصح به',
  'Déroulement': 'سير المقابلة', 'Conseils': 'نصائح', 'Déroulement et conseils': 'سير المقابلة والنصائح',
  'Modifier mon entretien': 'تعديل مقابلتي', 'Modifier mon avis': 'تعديل رأيي',
  'Les questions qu’on t’a posées aident les suivants à se préparer. Pas de nom de recruteur ni d’information confidentielle.': 'الأسئلة التي طرحت عليك تساعد من يأتي بعدك على الاستعداد. بدون اسم المشغّل ولا معلومات سرية.',
  'L’entreprise, le type et la saison ne changent plus.': 'لم يعد ممكنا تغيير الشركة والنوع والموسم.',
  'Ex. PFE méthodes, ingénieur qualité…': 'مثال: مشروع نهاية الدراسة في المناهج، مهندس جودة…',
  'Format': 'الشكل', 'Résultat': 'النتيجة',
  'Les questions posées': 'الأسئلة المطروحة', 'Ex. Présente un projet dont tu es fier(e).': 'مثال: قدّم مشروعا تفتخر به.', 'Une autre question…': 'سؤال آخر…',
  'Retirer cette question': 'حذف هذا السؤال', 'Ajouter une question': 'أضف سؤالا',
  'Les questions sont trop longues (4 000 caractères au total).': 'الأسئلة طويلة جدا (4000 حرف في المجموع).',
  'Difficulté': 'الصعوبة', 'Durée, avec qui, étapes, test technique…': 'المدة، مع من، المراحل، اختبار تقني…',
  'Tes conseils pour bien le préparer': 'نصائحك للاستعداد الجيد',
  'Partager anonymement': 'شارك دون ذكر اسمك', '(ton nom n’apparaît pour aucun membre)': '(لن يظهر اسمك لأي عضو)',
  'Partager mes questions': 'شارك أسئلتي',
  'Entretien mis à jour.': 'تم تحديث المقابلة.', 'Merci ! Tes questions aideront la promo suivante.': 'شكرا! أسئلتك ستساعد الدفعة القادمة.',
  'Comment s’est passé ce stage ? Ton avis aide les étudiants à choisir. Reste honnête et bienveillant(e).': 'كيف مر هذا التدريب؟ رأيك يساعد الطلبة على الاختيار. كن صادقا ولطيفا.',
  'Note globale': 'التقييم العام', 'Gratification': 'المنحة',
  'Tu le recommandes à un(e) camarade ?': 'هل تنصح به زميلا(ة)؟', 'Oui': 'نعم', 'Non': 'لا', 'Recommandation': 'التوصية',
  'Tes conseils': 'نصائحك', 'Encadrement, missions, ambiance, transport, ce qu’il faut savoir avant d’y aller': 'التأطير، المهام، الأجواء، التنقل، وما يجب معرفته قبل الذهاب',
  'Rester anonyme': 'البقاء مجهولا',
  'Choisis au moins la note globale.': 'اختر على الأقل التقييم العام.', 'Publier mon avis': 'انشر رأيي',
  'Avis mis à jour.': 'تم تحديث الرأي.', 'Merci ! Ton avis aidera la promo suivante.': 'شكرا! رأيك سيساعد الدفعة القادمة.',
  'Questions posées en entretien': 'أسئلة طرحت في المقابلات', 'Voir les avis et entretiens': 'عرض الآراء والمقابلات',
  'Comment s’est passé ton stage chez': 'كيف مر تدريبك في', 'Comment se passent tes débuts chez': 'كيف تسير بداياتك في',
  'Partage les questions de ton entretien chez': 'شارك أسئلة مقابلتك في',
  'Ton avis, anonyme si tu veux, aide la promo suivante à choisir.': 'رأيك، دون ذكر اسمك إن أردت، يساعد الدفعة القادمة على الاختيار.',
  'Même trois questions suffisent pour aider ceux qui passent après toi.': 'حتى ثلاثة أسئلة تكفي لمساعدة من يأتي بعدك.',
  'Donner mon avis': 'أعط رأيي',
  'Tu as déjà donné ton avis sur cette entreprise pour cette saison.': 'سبق أن أعطيت رأيك في هذه الشركة لهذا الموسم.',
  'Ajoute au moins une question.': 'أضف سؤالا واحدا على الأقل.',
}, [
  [/^(\d+) avis$/, n => `${n} رأي`],
  [/^(\d+) entretiens? partagés?$/, n => `${n} مقابلة مشتركة`],
  [/^([\d,]+) sur 5$/, n => `${n} من 5`],
  [/^Difficulté (\d)\/5$/, n => `الصعوبة ${n}/5`],
  [/^Question (\d+)$/, n => `السؤال ${n}`],
  [/^Gratification : (.+)$/, g => `المنحة: ${{ 'Non rémunéré': 'بدون منحة', Symbolique: 'رمزية', Correcte: 'مقبولة', Bonne: 'جيدة' }[g] || g}`],
  [/^(Non rémunéré|Symbolique|Correcte|Bonne) \((\d+)\)$/, (g, n) => `${{ 'Non rémunéré': 'بدون منحة', Symbolique: 'رمزية', Correcte: 'مقبولة', Bonne: 'جيدة' }[g]} (${n})`],
]);
