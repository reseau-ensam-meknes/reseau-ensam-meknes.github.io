// Offres : liste compacte, fiche détaillée, candidature, gestion des candidats par le lauréat.
import { html, useState, useMemo, useEffect } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Avatar, CompanyLogo, TYPE_ICON, toast, RoleLine, celebrate, injectCSS } from './ui.js';
import { getLang, addAR } from './i18n.js';
import { TYPES, FILIERES, NIVEAUX, OBJECTIFS, niveauOf, timeAgo, daysUntil, placementOf, offerMatch, talentsFor } from './logic.js';
import { RelanceBanner, BanqueSujets, PasteOffer } from './recrutement.js';
import { CvButton } from './cv.js';
import { SignalerBtn } from './confiance.js';
import { EntrepriseResume } from './entreprises.js';
import { MessageBtn } from './messages.js';

const ANNEES_OPTS = [[3, '3A'], [4, '4A'], [5, '5A'], [6, 'Jeunes diplômés']];
export const APP_STATUS = { postule: 'Envoyée', entretien: 'Entretien', retenu: 'Retenu(e)', refuse: 'Pas retenu(e)' };

export function matchesMe(o, me, saison) {
  const n = niveauOf(me, saison);
  return (o.audience || 'etudiants') === 'etudiants' && (o.annees || []).includes(n) && (!o.filieres?.length || o.filieres.includes(me.filiere));
}
const forLaureats = o => o.audience === 'laureats';

// Trois onglets : les offres, la banque de sujets PFE (5A et lauréats), les offres entre lauréats
export function OffersPage(ctx) {
  const { me, saison, sub, go } = ctx;
  const isStudent = me.role === 'etudiant';
  const tabs = [['', 'Offres', 'feed']];
  if (!isStudent || niveauOf(me, saison) === 5) tabs.push(['sujets', 'Sujets PFE', 'cap']);
  if (!isStudent) tabs.push(['laureats', 'Entre lauréats', 'briefcase']);
  const tab = tabs.some(([k]) => k === sub) ? sub : '';
  const [compose, setCompose] = useState(null);
  return html`<section class="page">
    <header class="page-head">
      <div><p class="eyebrow">${tab === 'laureats' ? 'Postes pour lauréats expérimentés, visibles seulement par les lauréats' : tab === 'sujets' ? 'L’entreprise dépose un vrai problème, un étudiant le prend, le lauréat l’encadre' : isStudent ? `Pour ${NIVEAUX[niveauOf(me, saison)]?.label?.toLowerCase() || 'toi'} · partagées par les lauréats` : 'Partagées par les lauréats'}</p><h1>${tab === 'sujets' ? 'Banque de sujets PFE' : tab === 'laureats' ? 'Offres entre lauréats' : 'Offres'}</h1></div>
      ${!isStudent ? html`<button class="btn primary" onClick=${() => setCompose(tab === 'laureats' ? { audience: 'laureats', type: 'emploi', annees: [] } : tab === 'sujets' ? { type: 'pfe', annees: [5] } : {})}><${Icon} name="plus"/> ${tab === 'sujets' ? 'Déposer un sujet' : 'Publier une offre'}</button>` : null}
    </header>
    ${tabs.length > 1 ? html`<div class="seg" role="tablist">${tabs.map(([k, l, i]) => html`<button role="tab" aria-selected=${tab === k} class=${tab === k ? 'on' : ''} onClick=${() => go('offres' + (k ? '/' + k : ''))}><${Icon} name=${i} size=${15}/> ${l}</button>`)}</div>` : null}
    ${tab === 'sujets' ? html`<${BanqueSujets} ctx=${ctx} onPropose=${() => setCompose({ type: 'pfe', annees: [5] })}/>` : html`<${OfferList} ctx=${ctx} entre=${tab === 'laureats'} key=${tab}/>`}
    ${compose ? html`<${OfferComposer} ctx=${ctx} preset=${compose} onClose=${() => setCompose(null)}/>` : null}
  </section>`;
}

// Ce que le membre a écrit lui-même (titre, entreprise, ville, message) porte translate="no" dir="auto" : jamais traduit.
const prenom = p => (p?.full_name || '').split(' ')[0];
// Ce visiteur peut-il postuler à cette offre ? (étudiant : offres étudiantes ; lauréat : offres entre lauréats)
const peutPostuler = (o, me) => o.author_id !== me.id && (me.role === 'etudiant' ? !forLaureats(o) : me.role === 'laureat' && forLaureats(o));
// Raisons d'une recommandation : « Ta filière » est un texte de l'interface, le reste vient du profil (compétence, ville)
const Pourquoi = ({ why }) => html`<span class="why">${why.map(w => (w === 'Ta filière' ? html`<span class="mini good">${w}</span>` : html`<span class="mini good" translate="no" dir="auto">${w}</span>`))}</span>`;
const doux = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

function OfferList({ ctx, entre }) {
  const { data, me, saison, openOffer } = ctx;
  const isStudent = me.role === 'etudiant';
  const niveau = niveauOf(me, saison);
  const myTypes = isStudent ? (OBJECTIFS[niveau]?.types || []) : Object.keys(TYPES);
  const [vue, setVue] = useState('toutes');
  const [type, setType] = useState('tous');
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return data.offers.filter(o => {
      if (forLaureats(o) !== entre) return false;
      if (vue === 'miennes') { if (o.author_id !== me.id) return false; }
      else if (o.status !== 'ouverte' && vue !== 'sauvees') return false;
      if (isStudent && !(o.annees || []).includes(niveau)) return false; // un étudiant ne voit que les offres de son année
      if (vue === 'sauvees' && !data.reactions.some(r => r.offer_id === o.id && r.user_id === me.id && r.kind === 'save')) return false;
      if (type !== 'tous' && o.type !== type) return false;
      if (qq && !`${o.titre} ${o.entreprise} ${o.ville} ${o.pays} ${(o.filieres || []).join(' ')}`.toLowerCase().includes(qq)) return false;
      return true;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [data, q, type, vue]);
  const plain = vue === 'toutes' && type === 'tous' && !q.trim();
  const chips = entre ? [] : [['tous', 'Tout'], ...myTypes.map(k => [k, TYPES[k].label])];
  // Les recommandées passent en tête et ne sont pas répétées dans la liste en dessous
  const avecReco = isStudent && plain && list.length > 5;
  const reco = avecReco ? recoFor(ctx, 3) : [];
  const dejaVues = new Set(reco.map(x => x.o.id));
  const reste = avecReco ? list.filter(o => !dejaVues.has(o.id)) : list;
  // Liste vide : une phrase et une seule action pour repartir
  const versToutes = { label: 'Voir toutes les offres', icon: 'feed', onClick: () => setVue('toutes') };
  const effacer = !plain && vue !== 'sauvees' ? { label: 'Effacer les filtres', icon: 'x', onClick: () => { setQ(''); setType('tous'); setVue('toutes'); } } : null;
  const vide = vue === 'sauvees'
    ? html`<${Empty} icon="bookmark" title="Aucune offre sauvegardée" action=${versToutes}>Clique sur le marque-page d’une offre pour la garder ici.<//>`
    : html`<${Empty} icon=${entre ? 'briefcase' : 'feed'} title="Aucune offre ici" action=${effacer}>${entre ? 'Ton équipe cherche un profil expérimenté ? Publie le poste ici : seuls les lauréats le voient.' : 'Change la recherche ou reviens bientôt : les lauréats publient régulièrement.'}<//>`;

  return html`<div class="sub-page">
    <div class="toolbar">
      <label class="search grow"><${Icon} name="search" size=${16}/><input id="f-q" placeholder="Entreprise, ville, filière…" value=${q} onInput=${e => setQ(e.target.value)}/></label>
      ${!isStudent ? html`<div class="seg" role="group" aria-label="Vue">${[['toutes', 'Toutes'], ['miennes', 'Mes offres']].map(([k, l]) => html`<button class=${vue === k ? 'on' : ''} onClick=${() => setVue(k)}>${l}</button>`)}</div>` : null}
    </div>
    ${chips.length > 2 || isStudent ? html`<div class="chips offres-chips" role="group" aria-label="Type d’offre">
      ${chips.length > 2 ? chips.map(([k, l]) => html`<button class=${'chip t-' + k + (type === k ? ' on' : '')} aria-pressed=${type === k} onClick=${() => setType(k)}>${k !== 'tous' ? html`<${Icon} name=${TYPE_ICON[k]} size=${15}/>` : null}${l}</button>`) : null}
      ${isStudent ? html`${chips.length > 2 ? html`<span class="chips-sep" aria-hidden="true"></span>` : null}<button class=${'chip' + (vue === 'sauvees' ? ' on' : '')} aria-pressed=${vue === 'sauvees'} onClick=${() => setVue(vue === 'sauvees' ? 'toutes' : 'sauvees')}><${Icon} name="bookmark" size=${14}/> Sauvegardées</button>` : null}
    </div>` : null}
    ${avecReco ? html`<${RecoOffers} ctx=${ctx} reco=${reco} inOffres/>` : null}
    ${avecReco && reste.length ? html`<div class="section-head"><h2>${NIVEAUX[niveau]?.short ? `Les autres offres de ${NIVEAUX[niveau].short}` : 'Les autres offres'}</h2><span class="count">${reste.length}</span></div>` : null}
    <div class="offer-grid">
      ${reste.length ? reste.map(o => html`<${OfferCard} key=${o.id} o=${o} ctx=${ctx} onOpen=${() => openOffer(o.id)}/>`) : avecReco ? null : vide}
    </div>
  </div>`;
}

// Offres recommandées à un étudiant : sa filière, ses compétences retrouvées dans l'offre, sa ville
function recoFor(ctx, max) {
  const { data, me, saison } = ctx;
  const n = niveauOf(me, saison);
  return data.offers.filter(o => o.status === 'ouverte' && !forLaureats(o) && (o.annees || []).includes(n) && !data.applications.some(a => a.offer_id === o.id && a.student_id === me.id))
    .map(o => ({ o, ...offerMatch(o, me) })).sort((a, b) => b.score - a.score || new Date(b.o.created_at) - new Date(a.o.created_at)).slice(0, max);
}

export function RecoOffers({ ctx, max = 3, inOffres = false, reco }) {
  const { openOffer, go } = ctx;
  const liste = reco || recoFor(ctx, max);
  return html`<div class="reco">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="spark"/> Recommandé pour toi</h2>${inOffres ? null : html`<button class="btn tiny ghost" onClick=${() => go('offres')}>Toutes les offres <${Icon} name="arrow" size=${14}/></button>`}</div>
    <div class="offer-grid one">${liste.length ? liste.map(({ o, why }) => html`<${OfferCard} key=${o.id} o=${o} ctx=${ctx} why=${why} onOpen=${() => openOffer(o.id)}/>`) : html`<${Empty} icon="feed" title="Pas encore d’offre pour ton niveau">Elles arrivent vite. En attendant, demande un conseil à un lauréat dans Mentorat.<//>`}</div>
  </div>`;
}

// Carte compacte : toute la carte ouvre la fiche. En pied, qui la partage et, s'il peut recommander, on le dit simplement.
export function OfferCard({ o, ctx, onOpen, why }) {
  const { data, me, store, act } = ctx;
  const author = store.byId('profiles', o.author_id);
  const saved = data.reactions.find(r => r.offer_id === o.id && r.user_id === me.id && r.kind === 'save');
  const apps = data.applications.filter(a => a.offer_id === o.id);
  const myApp = apps.find(a => a.student_id === me.id);
  const dl = daysUntil(o.deadline);
  const mine = o.author_id === me.id;
  const pourMoi = peutPostuler(o, me);
  const canApply = !myApp && pourMoi && o.status === 'ouverte';
  const coopt = author && o.cooptation && canApply; // déjà postulé : l'état de la candidature compte davantage
  const lieu = [o.ville, o.pays !== 'Maroc' ? o.pays : ''].filter(Boolean).join(', ');
  return html`<article class=${'ocard' + (o.status !== 'ouverte' ? ' closed' : '')}>
    <button class="ocard-main" onClick=${onOpen} aria-label=${`Ouvrir : ${o.titre}`}>
      <${CompanyLogo} name=${o.entreprise}/>
      <span class="ocard-txt">
        <span class="ocard-tags"><span class=${'tag t-' + o.type}><${Icon} name=${TYPE_ICON[o.type]} size=${13}/>${TYPES[o.type]?.label}</span>
          ${o.status === 'ouverte' && dl !== null && dl >= 0 && dl <= 7 ? html`<span class="tag urgent">${dl === 0 ? 'Dernier jour' : `J-${dl}`}</span>` : null}
          ${o.status !== 'ouverte' ? html`<span class="tag done">${o.status === 'pourvue' ? 'Pourvue' : 'Fermée'}</span>` : null}
          ${forLaureats(o) ? html`<span class="tag entre">Entre lauréats</span>` : null}</span>
        <strong class="ocard-title" translate="no" dir="auto">${o.titre}</strong>
        <span class="ocard-meta" translate="no" dir="auto">${o.entreprise}${lieu ? ` · ${lieu}` : ''}</span>
        ${why?.length ? html`<${Pourquoi} why=${why}/>` : null}
      </span>
    </button>
    <footer class="ocard-foot">
      ${author ? html`<span class=${'ocard-author' + (coopt ? ' coopt' : '')}><${Avatar} p=${author} size=${coopt ? 28 : 22}/><span class="oa-txt"><span class="oa-nom">${prenom(author)} · promo ${author.promo}</span>${coopt ? html`<span class="oa-coopt">peut te recommander</span>` : null}</span></span>` : null}
      <span class="spacer"></span>
      ${myApp ? html`<span class=${'state-pill a-' + myApp.status}>${APP_STATUS[myApp.status]}</span>` : mine ? html`<span class="muted small">${apps.length} candidat${apps.length > 1 ? 's' : ''}</span>` : canApply ? null : html`<span class="muted small nowrap">${timeAgo(o.created_at)}</span>`}
      ${canApply ? html`<button class="btn tiny ocard-apply" onClick=${() => ctx.openOffer(o.id, true)}>Postuler</button>` : null}
      ${!mine ? html`<button class=${'icon-btn small' + (saved ? ' on' : '')} aria-pressed=${!!saved} aria-label=${saved ? 'Retirer des sauvegardes' : 'Sauvegarder'} onClick=${() => act(() => saved ? store.remove('reactions', saved.id) : store.insert('reactions', { offer_id: o.id, user_id: me.id, kind: 'save' }))}><${Icon} name="bookmark" size=${16}/></button>` : null}
    </footer>
  </article>`;
}

// Qui partage l'offre, juste sous le titre : c'est souvent la vraie raison de postuler
function AuteurOffre({ ctx, o, author, candidat }) {
  const p = prenom(author);
  const coopt = candidat && o.cooptation && o.status === 'ouverte';
  const phrase = !candidat ? `Partagée par ${p}` : coopt ? `Partagée par ${p}, qui peut te recommander` : `Partagée par ${p}, qui reçoit ta candidature et te répond ici`;
  return html`<button type="button" class=${'od-author' + (coopt ? ' coopt' : '')} onClick=${() => ctx.openProfile(author)}>
    <${Avatar} p=${author} size=${40}/>
    <span class="od-author-txt"><span class="od-author-line">${phrase}</span><${RoleLine} p=${author} score=${ctx.scores.get(author.id)}/></span>
    <span class="od-author-ico" aria-hidden="true"><${Icon} name="arrow" size=${16}/></span>
  </button>`;
}

// Fiche complète d'une offre. Sur téléphone, une feuille qui monte du bas ; l'action principale reste collée en bas.
export function OfferDetail({ ctx, id, onClose, apply }) {
  const { data, me, store, act } = ctx;
  const o = store.byId('offers', id);
  const mine = o?.author_id === me.id;
  const isAdmin = me.role === 'admin';
  const [tab, setTab] = useState(mine ? 'candidats' : 'offre');
  const [edit, setEdit] = useState(false);
  const [menu, setMenu] = useState(false);
  const [form, setForm] = useState(!!apply); // le formulaire de candidature est ouvert
  if (!o) return html`<${Modal} title="Offre" onClose=${onClose}><p>Cette offre a été supprimée.</p><//>`;
  if (edit) return html`<${OfferComposer} ctx=${ctx} offer=${o} onClose=${() => setEdit(false)}/>`;
  const author = store.byId('profiles', o.author_id);
  const apps = data.applications.filter(a => a.offer_id === o.id);
  const comments = data.comments.filter(c => c.offer_id === o.id);
  const candidat = peutPostuler(o, me);
  const myApp = candidat ? apps.find(a => a.student_id === me.id) : null;
  const saved = data.reactions.find(r => r.offer_id === o.id && r.user_id === me.id && r.kind === 'save');
  const toggleSave = () => act(() => saved ? store.remove('reactions', saved.id) : store.insert('reactions', { offer_id: o.id, user_id: me.id, kind: 'save' }));
  const dl = o.deadline ? new Date(o.deadline + 'T12:00:00') : null;
  const jours = daysUntil(o.deadline);
  const urgent = o.status === 'ouverte' && jours !== null && jours >= 0 && jours <= 7;
  const dateTxt = dl ? dl.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', ...(dl.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) }) : '';
  // Les faits en petites tuiles (2 par ligne) ; le type est déjà dans le titre de la fenêtre
  const facts = [
    ['Lieu', 'pin', html`<span translate="no" dir="auto">${o.ville || ''}</span>${o.pays ? `${o.ville ? ', ' : ''}${o.pays}` : ''}`],
    o.duree ? ['Durée', 'clock', html`<span translate="no" dir="auto">${o.duree}</span>${o.remunere ? ' · rémunéré' : ''}`] : null,
    dl ? ['Date limite', 'calendar', html`${dateTxt}${urgent ? html` <span class="tag urgent">${jours === 0 ? 'Dernier jour' : `J-${jours}`}</span>` : null}`] : null,
    ['Pour', 'people', forLaureats(o) ? 'Lauréats' : [...(o.annees || []).map(a => NIVEAUX[a]?.short), ...(o.filieres?.length ? o.filieres : ['toutes filières'])].join(' · ')],
  ].filter(Boolean);
  const auteurNom = prenom(author) || 'Le lauréat';

  // Pied collé : postuler (et garder l'offre), puis l'état de la candidature une fois envoyée
  const saveBtn = html`<button type="button" class=${'icon-btn od-save' + (saved ? ' on' : '')} aria-pressed=${!!saved} aria-label=${saved ? 'Retirer des sauvegardes' : 'Sauvegarder'} title=${saved ? 'Retirer des sauvegardes' : 'Sauvegarder'} onClick=${toggleSave}><${Icon} name="bookmark" size=${18}/></button>`;
  let footer = null;
  if (candidat && tab === 'offre') {
    if (myApp) {
      const pl = myApp.status === 'retenu' ? placementOf(data, me.id, ctx.saison) : null;
      const suite = { postule: `${auteurNom} te répond ici`, entretien: 'Bonne préparation pour l’entretien !', retenu: pl?.status === 'en_attente' ? 'Confirme ton recrutement dans « Mon parcours ».' : 'Bravo !', refuse: 'D’autres offres t’attendent.' }[myApp.status];
      footer = html`<div class="od-foot"><span class=${'state-pill a-' + myApp.status}>${APP_STATUS[myApp.status]}</span><span class="small muted od-foot-txt">${suite}</span>
        ${myApp.status === 'retenu' && pl?.status === 'en_attente' ? html`<button type="button" class="btn small" onClick=${() => { onClose(); ctx.go('parcours'); }}>Mon parcours</button>` : null}</div>`;
    } else if (o.status !== 'ouverte') footer = html`<div class="od-foot"><span class="small muted od-foot-txt">Cette offre n’accepte plus de candidatures.</span>${saveBtn}</div>`;
    else if (form) footer = html`<div class="od-foot"><button type="button" class="btn ghost" onClick=${() => setForm(false)}>Annuler</button><button class="btn primary" type="submit" form=${'apply-' + o.id}><${Icon} name="send" size=${16}/> Envoyer ma candidature</button></div>`;
    else footer = html`<div class="od-foot">${saveBtn}<button type="button" class="btn primary" onClick=${() => setForm(true)}><${Icon} name="send" size=${16}/> Postuler</button></div>`;
  }

  return html`<${Modal} title=${forLaureats(o) ? 'Offre entre lauréats' : TYPES[o.type]?.long || 'Offre'} onClose=${onClose} wide footer=${footer}>
    <div class="detail od">
      <div class="detail-head">
        <${CompanyLogo} name=${o.entreprise} size=${56}/>
        <div class="detail-title">
          ${o.status !== 'ouverte' ? html`<span class="tag done">${o.status === 'pourvue' ? 'Pourvue' : 'Fermée'}</span>` : null}
          <h2 translate="no" dir="auto">${o.titre}</h2>
          <p class="od-sub"><button type="button" class="linkish od-ent" onClick=${() => { onClose(); ctx.openEntreprise?.(o.entreprise); }}><span translate="no" dir="auto">${o.entreprise}</span></button><span class="od-dot" aria-hidden="true">·</span><span class="muted">Publiée ${timeAgo(o.created_at)}</span></p>
        </div>
        ${!mine && !isAdmin ? html`<${SignalerBtn} ctx=${ctx} type="offre" id=${o.id} small/>` : null}
        ${(mine || isAdmin) ? html`<div class="menu-wrap"><button class="icon-btn" aria-label="Gérer l’offre" aria-expanded=${menu} onClick=${() => setMenu(!menu)}><${Icon} name="more"/></button>
          ${menu ? html`<div class="menu-pop">
            ${mine ? html`<button onClick=${() => { setMenu(false); setEdit(true); }}><${Icon} name="edit" size=${16}/> Modifier</button>` : null}
            <button onClick=${() => { setMenu(false); act(() => store.update('offers', o.id, { status: o.status === 'ouverte' ? 'pourvue' : 'ouverte' })); }}><${Icon} name="check" size=${16}/> ${o.status === 'ouverte' ? 'Marquer pourvue' : 'Rouvrir l’offre'}</button>
            <button class="danger-t" onClick=${() => { setMenu(false); ctx.confirm('Supprimer définitivement cette offre ?', () => act(async () => { await store.remove('offers', o.id); onClose(); })); }}><${Icon} name="trash" size=${16}/> Supprimer</button>
          </div>` : null}</div>` : null}
      </div>
      ${author && !mine && tab === 'offre' ? html`<${AuteurOffre} ctx=${ctx} o=${o} author=${author} candidat=${candidat}/>` : null}
      <${RelanceBanner} ctx=${ctx} o=${o}/>
      ${mine ? html`<div class="seg"><button class=${tab === 'candidats' ? 'on' : ''} onClick=${() => setTab('candidats')}>Candidats (${apps.length})</button><button class=${tab === 'offre' ? 'on' : ''} onClick=${() => setTab('offre')}>L’offre</button><button class=${tab === 'questions' ? 'on' : ''} onClick=${() => setTab('questions')}>Questions (${comments.length})</button></div>` : null}

      ${tab === 'candidats' && mine ? html`<${Candidates} ctx=${ctx} o=${o} apps=${apps}/>` : null}

      ${tab === 'offre' ? html`
        <dl class="od-facts">${facts.map(([k, i, v]) => html`<div class=${k === 'Date limite' && urgent ? 'urgent' : ''}><dt><${Icon} name=${i} size=${14}/> ${k}</dt><dd>${v}</dd></div>`)}</dl>
        <${EntrepriseResume} ctx=${ctx} entreprise=${o.entreprise} onOpen=${onClose}/>
        <div class="prose"><p translate="no" dir="auto">${o.description}</p></div>
        ${o.lien ? html`<p><a href=${o.lien.startsWith('http') ? o.lien : 'https://' + o.lien} target="_blank" rel="noopener"><${Icon} name="link" size=${15}/> Voir l’annonce complète</a></p>` : null}
        ${candidat ? html`<${ApplyBox} ctx=${ctx} o=${o} form=${form} setForm=${setForm} onClose=${onClose}/>` : null}
        ${!mine ? html`<${Questions} ctx=${ctx} o=${o} comments=${comments}/>` : null}` : null}

      ${tab === 'questions' && mine ? html`<${Questions} ctx=${ctx} o=${o} comments=${comments}/>` : null}
    </div>
  <//>`;
}

// Côté étudiant : écrire sa candidature (le bouton d'envoi est dans le pied de la fiche), puis suivre le statut
function ApplyBox({ ctx, o, form, setForm, onClose }) {
  const { data, me, store, act, saison } = ctx;
  const app = data.applications.find(a => a.offer_id === o.id && a.student_id === me.id);
  const [msg, setMsg] = useState('');
  const pl = placementOf(data, me.id, saison);
  // Formulaire ouvert : on l'amène sous les yeux et on place le curseur dans le message
  useEffect(() => {
    if (!form || app) return;
    const t = setTimeout(() => { const el = document.getElementById('ap-msg'); if (!el) return; el.scrollIntoView({ block: 'center', behavior: doux() }); el.focus({ preventScroll: true }); }, 90);
    return () => clearTimeout(t);
  }, [form]);
  if (app) {
    const steps = ['postule', 'entretien', 'retenu'];
    const idx = app.status === 'refuse' ? -1 : steps.indexOf(app.status);
    return html`<div class="apply-box">
      <p class="eyebrow">Ma candidature</p>
      ${app.status === 'refuse' ? html`<p><span class="state-pill a-refuse">Pas retenu(e)</span> <span class="small muted">Ce n’est pas pour cette fois. Les autres offres t’attendent.</span></p>` : html`
      <ol class="stepper">${steps.map((s, i) => html`<li class=${i <= idx ? 'done' : ''}><span class="step-dot">${i <= idx ? html`<${Icon} name="check" size=${13}/>` : i + 1}</span>${APP_STATUS[s]}</li>`)}</ol>`}
      <p class="small muted">Le lauréat met à jour ce statut. ${app.status === 'retenu' ? (pl?.status === 'en_attente' ? 'Confirme ton recrutement dans « Mon parcours ».' : '') : `Envoyée ${timeAgo(app.created_at)}.`}</p>
      ${app.status === 'postule' ? html`<button class="btn ghost small" onClick=${() => act(() => store.remove('applications', app.id))}>Retirer ma candidature</button>` : null}
    </div>`;
  }
  if (o.status !== 'ouverte') return null; // le pied de la fiche le dit déjà
  // Un lauréat a invité cet étudiant depuis le vivier de talents
  const inv = (data.invitations || []).find(i => i.offer_id === o.id && i.student_id === me.id && i.status === 'envoyee');
  const invite = inv ? html`<div class="invite-note"><${Icon} name="send" size=${16}/><div><p><strong translate="no">${store.byId('profiles', inv.laureat_id)?.full_name || 'Un lauréat'}</strong> t’a invité(e) à postuler.</p>
    ${inv.message ? html`<p class="quote small" translate="no" dir="auto">${inv.message}</p>` : null}
    <button class="linkish small" onClick=${() => act(async () => { await store.update('invitations', inv.id, { status: 'declinee' }); toast('C’est noté, merci d’avoir répondu.'); })}>Pas intéressé(e)</button></div></div>` : null;
  if (!form) return invite;
  const hasCv = !!(me.cv_path || me.cv_url);
  const auteur = store.byId('profiles', o.author_id);
  const envoyer = e => {
    e.preventDefault();
    act(async () => {
      const premiere = me.role === 'etudiant' && !data.applications.some(a => a.student_id === me.id && a.offer_id);
      await store.insert('applications', { student_id: me.id, offer_id: o.id, entreprise: o.entreprise, titre: o.titre, message: msg.trim(), status: 'postule' });
      // Première candidature : un vrai moment, avec la prochaine étape. Ensuite, un simple mot en bas de l'écran.
      const fete = premiere && celebrate({
        cle: 'premiere-candidature-' + me.id, icon: 'send', titre: 'Candidature envoyée !',
        texte: `${prenom(auteur) || 'Le lauréat'} reçoit ta candidature avec ton profil${hasCv ? ' et ton CV' : ''}. Tu suis sa réponse dans « Mon parcours ».`,
        action: { label: 'Voir mon parcours', icon: 'route', onClick: () => { onClose?.(); ctx.go('parcours'); } },
      });
      if (!fete) toast('Candidature envoyée à ' + (auteur?.full_name || 'au lauréat') + '.', 'win');
    });
  };
  return html`${invite}<form class="apply-box form" id=${'apply-' + o.id} onSubmit=${envoyer}>
    <p class="eyebrow">Ta candidature</p>
    <${Field} label="Message au lauréat" hint="Deux ou trois phrases : qui tu es, pourquoi cette offre."><textarea id="ap-msg" rows="3" maxlength="1500" value=${msg} onInput=${e => setMsg(e.target.value)} placeholder=${me.role === 'laureat' ? 'Bonjour, promo 2018, six ans en méthodes…' : 'Bonjour, je suis en 5A Génie Industriel…'}></textarea><//>
    ${me.role === 'laureat' && !hasCv ? null : !hasCv ? html`<p class="small warn-t apply-cv"><${Icon} name="file" size=${14}/> <span>Ajoute ton CV en PDF dans ton profil : le lauréat le verra avec ta candidature.</span> <button type="button" class="btn tiny" onClick=${() => { onClose?.(); ctx.go('profil'); }}><${Icon} name="upload" size=${13}/> Ajouter mon CV</button></p>`
      : me.cv_path ? html`<p class="small muted apply-cv"><${Icon} name="lock" size=${14}/> <span>${auteur ? `Ton CV PDF sera visible par ${auteur.full_name.split(' ')[0]}, l’auteur de l’offre.` : 'Ton CV PDF sera visible par l’auteur de l’offre.'}</span> <${CvButton} ctx=${ctx} p=${me} small/></p>`
      : html`<p class="small muted apply-cv"><${Icon} name="file" size=${14}/> Le lien vers ton CV sera joint.</p>`}
  </form>`;
}

// Côté lauréat : les candidats de son offre, et la déclaration de recrutement
function Candidates({ ctx, o, apps }) {
  const { data, store, act, openProfile, saison } = ctx;
  const [declare, setDeclare] = useState(false);
  const entre = forLaureats(o);
  const sorted = [...apps].sort((a, b) => ['postule', 'entretien', 'retenu', 'refuse'].indexOf(a.status) - ['postule', 'entretien', 'retenu', 'refuse'].indexOf(b.status));
  const recruit = (studentId, app) => act(async () => {
    const st = store.byId('profiles', studentId);
    const existing = placementOf(data, studentId, saison);
    if (existing && existing.status !== 'refuse') { toast(`${st.full_name} a déjà une réussite enregistrée cette saison.`, 'err'); return; }
    if (app) await store.update('applications', app.id, { status: 'retenu' });
    await store.insert('placements', { student_id: studentId, offer_id: o.id, laureat_id: ctx.me.id, saison, niveau: Math.min(niveauOf(st, saison), 6), type: o.type, entreprise: o.entreprise, ville: o.ville, pays: o.pays || 'Maroc', source: 'plateforme' });
    toast(`${st.full_name.split(' ')[0]} doit maintenant confirmer. Tes 50 points arrivent dès sa confirmation.`);
  });
  return html`<div class="cands">
    ${sorted.length ? sorted.map(a => {
      const st = store.byId('profiles', a.student_id);
      const pl = data.placements.find(p => p.student_id === a.student_id && p.offer_id === o.id && p.status !== 'refuse');
      return html`<div class="cand" key=${a.id}>
        <div class="cand-head"><${Person} p=${st} onOpen=${openProfile} size=${36}/><span class="spacer"></span>${(data.invitations || []).some(i => i.offer_id === o.id && i.student_id === a.student_id) ? html`<span class="mini good">Invité(e) par toi</span>` : null}<span class="muted small">${timeAgo(a.created_at)}</span><${MessageBtn} ctx=${ctx} p=${st} cls="btn tiny ghost"/></div>
        ${a.message ? html`<p class="quote" translate="no" dir="auto">${a.message}</p>` : null}
        ${st && (st.cv_path || st.cv_url) ? html`<div class="row"><${CvButton} ctx=${ctx} p=${st} small/></div>` : null}
        ${pl ? html`<p class=${'state-pill ' + (pl.status === 'confirme' ? 's-trouve' : 's-validation')}>${pl.status === 'confirme' ? 'Recrutement confirmé par l’étudiant' : 'Recruté(e) · attend sa confirmation'}</p>` : html`
        <div class="seg small-seg" role="group" aria-label="Statut de la candidature">
          ${[['postule', 'Reçue'], ['entretien', 'Entretien'], ...(entre ? [['retenu', 'Retenu(e)']] : []), ['refuse', 'Pas retenu(e)']].map(([k, l]) => html`<button class=${a.status === k ? 'on' : ''} onClick=${() => act(() => store.update('applications', a.id, { status: k }))}>${l}</button>`)}
          ${entre ? null : html`<button class="seg-accent" onClick=${() => recruit(a.student_id, a)}><${Icon} name="check" size=${14}/> Recruté(e)</button>`}
        </div>`}
      </div>`;
    }) : html`<${Empty} icon="inbox" title="Pas encore de candidat">${entre ? 'Les lauréats intéressés postulent ici. Partage aussi l’offre dans le groupe de ta ville.' : 'Partage l’offre dans les groupes de promo : les étudiants concernés la voient déjà dans « Pour moi ».'}<//>`}
    ${entre ? null : html`<${Matching} ctx=${ctx} o=${o}/>
    <button class="btn ghost small" onClick=${() => setDeclare(true)}><${Icon} name="plus" size=${15}/> J’ai recruté un étudiant qui n’a pas postulé ici</button>`}
    ${declare ? html`<${PickStudent} ctx=${ctx} onClose=${() => setDeclare(false)} onPick=${id => { setDeclare(false); recruit(id, null); }}/>` : null}
  </div>`;
}

// Profils en recherche qui correspondent à l'offre : une invitation à postuler en un clic
function Matching({ ctx, o }) {
  const { data, me, saison, store, act, openProfile } = ctx;
  if (o.status !== 'ouverte') return null;
  const list = talentsFor(data, o, saison);
  if (!list.length) return null;
  const invited = id => data.invitations.some(i => i.offer_id === o.id && i.student_id === id);
  const invite = p => act(async () => {
    const msg = getLang() === 'ar' ? `السلام ${p.full_name.split(' ')[0]}، ملفك يهمني لهذا العرض. ترشّح إذا أعجبك!` : `Bonjour ${p.full_name.split(' ')[0]}, ton profil m’intéresse pour cette offre. Postule si ça te parle !`;
    await store.insert('invitations', { laureat_id: me.id, student_id: p.id, offer_id: o.id, message: msg });
    toast(`Invitation envoyée à ${p.full_name.split(' ')[0]}.`);
  });
  return html`<div class="matching"><p class="small"><${Icon} name="spark" size=${14}/> <strong>Profils qui correspondent à ton offre</strong></p>
    <ul class="people-list">${list.map(({ p, why }) => html`<li key=${p.id}><${Person} p=${p} onOpen=${openProfile} size=${32}/><${Pourquoi} why=${why}/><span class="spacer"></span>
      ${invited(p.id) ? html`<span class="state-pill s-validation">Invité(e)</span>` : html`<button class="btn small" onClick=${() => invite(p)}><${Icon} name="send" size=${14}/> Inviter à postuler</button>`}</li>`)}</ul></div>`;
}

function PickStudent({ ctx, onClose, onPick }) {
  const { data, saison } = ctx;
  const [q, setQ] = useState('');
  const res = q.trim().length < 2 ? [] : data.profiles.filter(p => p.role !== 'admin' && niveauOf(p, saison) <= 6 && p.full_name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);
  return html`<${Modal} title="Quel étudiant as-tu recruté ?" onClose=${onClose}>
    <p class="muted small">Il ou elle recevra une demande de confirmation. Le recrutement compte une fois confirmé.</p>
    <label class="search"><${Icon} name="search" size=${16}/><input id="pick-q" placeholder="Nom de l’étudiant" value=${q} onInput=${e => setQ(e.target.value)}/></label>
    <ul class="people-list">${res.map(p => html`<li><${Person} p=${p}/><button class="btn small primary" onClick=${() => onPick(p.id)}>Choisir</button></li>`)}</ul>
    ${q.trim().length >= 2 && !res.length ? html`<p class="muted small">Personne avec ce nom. L’étudiant doit d’abord créer son compte.</p>` : null}
  <//>`;
}

function Questions({ ctx, o, comments }) {
  const { store, me, act, openProfile } = ctx;
  const [txt, setTxt] = useState('');
  const sorted = [...comments].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return html`<div class="comments">
    <h3>Questions publiques <span class="count">${comments.length}</span></h3>
    ${sorted.map(c => { const a = store.byId('profiles', c.author_id); return html`<div class="comment" key=${c.id}>
      <${Avatar} p=${a} size=${28}/>
      <div class="comment-body"><button class="linkish" onClick=${() => openProfile(a)}>${a ? html`<span translate="no" dir="auto">${a.full_name}</span>` : 'Membre'}</button>${a?.id === o.author_id ? html` <span class="mini">Auteur de l’offre</span>` : null} <span class="muted small">${timeAgo(c.created_at)}</span><p translate="no" dir="auto">${c.body}</p></div>
      ${(c.author_id === me.id || me.role === 'admin') ? html`<button class="icon-btn small" aria-label="Supprimer" onClick=${() => act(() => store.remove('comments', c.id))}><${Icon} name="x" size=${14}/></button>` : html`<${SignalerBtn} ctx=${ctx} type="commentaire" id=${c.id} small/>`}
    </div>`; })}
    <form class="comment-form" onSubmit=${e => { e.preventDefault(); if (!txt.trim()) return; act(async () => { await store.insert('comments', { offer_id: o.id, author_id: me.id, body: txt.trim() }); setTxt(''); }); }}>
      <input id=${'c-' + o.id} placeholder=${o.author_id === me.id ? 'Répondre…' : 'Une question sur l’offre ? Tout le monde verra la réponse.'} value=${txt} onInput=${e => setTxt(e.target.value)} maxlength="1500"/>
      <button class="btn small" type="submit" disabled=${!txt.trim()}>Envoyer</button>
    </form>
  </div>`;
}

export function OfferComposer({ ctx, offer, onClose, preset = {} }) {
  const { store, me, act, data } = ctx;
  const editing = !!offer?.id;
  const [f, setF] = useState(() => ({
    type: 'stage', titre: '', entreprise: me.entreprise || '', ville: me.ville || '', pays: me.pays || 'Maroc', filieres: [], annees: [3, 4], description: '', contact: '', lien: '', deadline: '', cooptation: false, remunere: false, duree: '', audience: 'etudiants', ...preset, ...(offer || {}),
  }));
  const set = (k, v) => setF({ ...f, [k]: v });
  const toggleIn = (k, v) => set(k, f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v]);
  const entre = f.audience === 'laureats';
  const anneesDe = t => t === 'pfe' ? [5] : t === 'emploi' ? [6] : t === 'etranger' ? [4, 5] : [3, 4];
  const setType = t => setF({ ...f, type: t, annees: anneesDe(t) });
  const setAudience = a => setF(a === 'laureats' ? { ...f, audience: a, type: 'emploi', annees: [] } : { ...f, audience: a, annees: f.annees.length ? f.annees : [6] });
  // Offre en 30 secondes : on remplit les champs reconnus, sans effacer ce qui n'a pas été trouvé
  const fill = x => setF(cur => {
    const n = { ...cur };
    for (const [k, v] of Object.entries(x)) if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)) n[k] = v;
    // Type reconnu sans années : on prend les années habituelles de ce type
    if (x.type && x.type !== cur.type && !(x.annees && x.annees.length)) n.annees = anneesDe(x.type);
    if (cur.audience === 'laureats') { n.type = 'emploi'; n.annees = []; }
    return n;
  });
  const valid = f.titre.trim().length >= 4 && f.entreprise.trim() && f.description.trim() && (entre || f.annees.length);
  const submit = e => {
    e.preventDefault(); if (!valid) return;
    const row = { type: f.type, titre: f.titre.trim(), entreprise: f.entreprise.trim(), ville: (f.ville || '').trim(), pays: (f.pays || '').trim() || 'Maroc', filieres: f.filieres, annees: entre ? [] : f.annees, description: f.description.trim(), contact: (f.contact || '').trim(), lien: (f.lien || '').trim(), deadline: f.deadline || null, cooptation: f.cooptation, remunere: f.remunere, duree: (f.duree || '').trim() };
    if (entre || offer?.audience) row.audience = f.audience;
    act(async () => {
      if (editing) { await store.update('offers', offer.id, row); toast('Offre mise à jour.'); }
      else {
        const premiere = me.role === 'laureat' && !(data || store.data).offers.some(x => x.author_id === me.id);
        const neuve = await store.insert('offers', { ...row, author_id: me.id, status: 'ouverte' });
        // Première offre d'un lauréat : on le remercie, une seule fois
        const fete = premiere && celebrate({
          cle: 'premiere-offre-' + me.id, icon: 'feed', titre: 'Ta première offre est en ligne !',
          texte: entre ? 'Les lauréats la voient déjà dans « Entre lauréats ». Merci d’ouvrir la porte !' : 'Les étudiants concernés la voient déjà dans « Pour moi ». Merci d’ouvrir la porte à un étudiant de l’école !',
          action: neuve?.id && ctx.openOffer ? { label: 'Voir mon offre', icon: 'arrow', onClick: () => ctx.openOffer(neuve.id) } : null,
        });
        if (!fete) toast(entre ? 'Offre publiée. Les lauréats la voient dans « Entre lauréats ».' : 'Offre publiée. Les étudiants concernés la voient dans « Pour moi ».');
      }
      onClose();
    });
  };
  return html`<${Modal} title=${editing ? 'Modifier l’offre' : 'Publier une offre'} onClose=${onClose} wide>
    <form class="form" onSubmit=${submit}>
      ${editing ? null : html`<${PasteOffer} me=${me} onFill=${fill}/>`}
      ${me.role === 'etudiant' ? null : html`<div class="seg" role="group" aria-label="Pour qui">${[['etudiants', 'Pour les étudiants'], ['laureats', 'Entre lauréats']].map(([k, l]) => html`<button type="button" class=${f.audience === k ? 'on' : ''} onClick=${() => setAudience(k)}>${l}</button>`)}</div>`}
      ${entre ? html`<p class="small muted hint-box"><${Icon} name="briefcase" size=${15}/> <span>Un poste pour un profil expérimenté : seuls les lauréats le voient, les étudiants non.</span></p>` : html`
      <div class="type-pick" role="group" aria-label="Type">${Object.entries(TYPES).map(([k, v]) => html`<button type="button" class=${'type-opt t-' + k + (f.type === k ? ' on' : '')} onClick=${() => setType(k)}><${Icon} name=${TYPE_ICON[k]} size=${22}/><span>${v.label}</span></button>`)}</div>`}
      <${Field} label="Intitulé"><input id="of-titre" required value=${f.titre} onInput=${e => set('titre', e.target.value)} placeholder="Ex. PFE : optimisation d’une ligne d’assemblage" maxlength="140"/><//>
      <div class="grid3">
        <${Field} label="Entreprise"><input id="of-ent" required value=${f.entreprise} onInput=${e => set('entreprise', e.target.value)}/><//>
        <${Field} label="Ville"><input id="of-ville" value=${f.ville || ''} onInput=${e => set('ville', e.target.value)}/><//>
        <${Field} label="Pays"><input id="of-pays" value=${f.pays || ''} onInput=${e => set('pays', e.target.value)}/><//>
      </div>
      <${Field} label="Description"><textarea id="of-desc" required rows="5" value=${f.description} onInput=${e => set('description', e.target.value)} placeholder="Missions, profil recherché, comment se passe la sélection…" maxlength="4000"></textarea><//>
      ${entre ? null : html`<${Field} label="Pour quels niveaux ?"><div class="chips">${ANNEES_OPTS.map(([v, l]) => html`<button type="button" class=${'chip' + (f.annees.includes(v) ? ' on' : '')} onClick=${() => toggleIn('annees', v)}>${l}</button>`)}</div><//>`}
      <details class="more-fields" open=${editing}>
        <summary>Plus de détails (facultatif)</summary>
        <div class="form">
          <${Field} label="Filières" hint="Aucune sélection = toutes les filières"><div class="chips">${FILIERES.map(v => html`<button type="button" class=${'chip' + (f.filieres.includes(v) ? ' on' : '')} onClick=${() => toggleIn('filieres', v)}>${v}</button>`)}</div><//>
          <div class="grid3">
            <${Field} label="Durée"><input id="of-duree" value=${f.duree || ''} onInput=${e => set('duree', e.target.value)} placeholder="6 mois, CDI…"/><//>
            <${Field} label="Date limite"><input id="of-dl" type="date" value=${f.deadline || ''} onInput=${e => set('deadline', e.target.value)}/><//>
            <${Field} label="Lien vers l’annonce"><input id="of-lien" value=${f.lien || ''} onInput=${e => set('lien', e.target.value)} placeholder="https://…"/><//>
          </div>
          <label class="check"><input id="of-coopt" type="checkbox" checked=${f.cooptation} onChange=${e => set('cooptation', e.target.checked)}/> Je peux recommander (coopter) les bons profils</label>
          <label class="check"><input id="of-rem" type="checkbox" checked=${f.remunere} onChange=${e => set('remunere', e.target.checked)}/> Rémunéré / gratifié</label>
        </div>
      </details>
      ${f.type === 'pfe' && !entre ? html`<p class="small muted"><${Icon} name="cap" size=${14}/> Un PFE apparaît aussi dans la Banque de sujets : décris le vrai problème de l’équipe, tu pourras encadrer l’étudiant qui le prend.</p>` : null}
      <p class="small muted">Les candidatures arrivent ici, dans l’onglet « Candidats » de ton offre. Tu n’as pas besoin de donner ton email.</p>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" type="submit" disabled=${!valid}>${editing ? 'Enregistrer' : 'Publier'}</button></div>
    </form>
  <//>`;
}

// ---------------------------------------------------------------------------
// Passe UX des offres : liste calme (un seul bouton plein, dans la fiche), filtres sur une rangée,
// fiche en feuille avec l'action collée en bas, l'auteur juste sous le titre.
// ---------------------------------------------------------------------------
injectCSS('offres-ux', `
.offres-chips { flex-wrap: nowrap; align-items: center; overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain; padding-block: 3px; }
.offres-chips::-webkit-scrollbar { display: none; }
.offres-chips .chip { flex: none; white-space: nowrap; min-height: 36px; }
.chips-sep { flex: none; width: 1px; height: 22px; background: var(--line); margin-inline: .15rem; }
@media (max-width: 760px) { .offres-chips { margin-inline: -16px; padding-inline: 16px; scroll-padding-inline: 16px; } }

.ocard-foot { gap: .45rem; }
.ocard-author { min-width: 0; }
.ocard-author .oa-txt { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
.ocard-author .oa-txt > span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ocard-author .oa-coopt { color: var(--good); font-weight: 600; font-size: var(--fs-1); }
.ocard-apply { background: transparent; color: var(--accent); border-color: color-mix(in srgb, var(--accent) 38%, var(--line)); }
.ocard-apply:hover { background: var(--accent-soft); border-color: var(--accent); }
[dir="rtl"] .ocard-txt [dir="auto"], [dir="rtl"] .od .detail-title [dir="auto"] { text-align: right; }

.od .detail-head { gap: .8rem; }
.od .detail-title { gap: .3rem; }
.od .detail-title h2 { font-size: var(--fs-5); line-height: 1.22; }
.od-sub { display: flex; align-items: center; flex-wrap: wrap; gap: .1rem .4rem; font-size: var(--fs-2); }
.od-ent { font-weight: 600; color: var(--ink-2); text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--ink-2) 35%, transparent); text-underline-offset: 3px; }
.od-ent:hover { color: var(--accent); }
.od-dot { color: var(--muted); }
.od-author { display: flex; align-items: center; gap: .75rem; width: 100%; padding: .75rem .9rem; border-radius: var(--r-lg); border: 1px solid var(--line); background: var(--surface); color: inherit; font: inherit; text-align: start; cursor: pointer; transition: border-color .2s, background .2s; }
.od-author:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--line)); }
.od-author.coopt { background: color-mix(in srgb, var(--good-soft) 70%, var(--surface)); border-color: color-mix(in srgb, var(--good) 30%, var(--line)); }
.od-author-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .15rem; }
.od-author-line { font-weight: 600; color: var(--ink); line-height: 1.35; }
.od-author .role-line { font-size: var(--fs-1); }
.od-author-ico { flex: none; display: grid; place-items: center; color: var(--muted); }
.od-author:hover .od-author-ico { color: var(--accent); }
.od-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; margin: 0; }
.od-facts > div { padding: .5rem .7rem .55rem; border-radius: var(--r-md); background: var(--surface-2); min-width: 0; }
.od-facts > div:last-child:nth-child(odd) { grid-column: 1 / -1; }
.od-facts dt { display: flex; align-items: center; gap: .3rem; font-size: .7rem; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
[dir="rtl"] .od-facts dt { font-size: var(--fs-1); letter-spacing: 0; }
.od-facts dd { margin: .1rem 0 0; font-weight: 500; font-size: var(--fs-2); line-height: 1.4; overflow-wrap: anywhere; }
.od-facts dd .tag { margin-inline-start: .2rem; vertical-align: 1px; }
@media (min-width: 761px) {
  .od-facts { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
  .od-facts > div:last-child:nth-child(odd) { grid-column: auto; }
}

.modal-foot > .od-foot { flex: 1; min-width: 0; display: flex; align-items: center; gap: .6rem; }
.od-foot .btn.primary { flex: 1; min-height: 46px; }
.od-foot .btn.ghost { min-height: 46px; }
.od-save { flex: none; width: 46px; height: 46px; border: 1px solid var(--line); border-radius: var(--r-md); }
.od-save.on { background: var(--accent-soft); border-color: color-mix(in srgb, var(--accent) 40%, var(--line)); }
.od-foot-txt { flex: 1; min-width: 0; }
@media (min-width: 761px) { .od-foot .btn.primary { flex: 0 0 auto; min-width: 15rem; margin-inline-start: auto; } }
`);

addAR({
  'Les autres offres': 'عروض أخرى',
  'Voir toutes les offres': 'عرض كل العروض',
  'Effacer les filtres': 'مسح عوامل التصفية',
  'Offre entre lauréats': 'عرض بين الخريجين',
  'Ta candidature': 'ترشيحك',
  'Bonne préparation pour l’entretien !': 'بالتوفيق في التحضير للمقابلة!',
  'D’autres offres t’attendent.': 'عروض أخرى في انتظارك.',
  'Bravo !': 'برافو!',
  'Candidature envoyée !': 'تم إرسال ترشيحك!',
  'Voir mon parcours': 'عرض مساري',
  'Ta première offre est en ligne !': 'عرضك الأول منشور الآن!',
  'Les lauréats la voient déjà dans « Entre lauréats ». Merci d’ouvrir la porte !': 'يراه الخريجون الآن في «بين الخريجين». شكرًا لأنك تفتح الباب!',
  'Les étudiants concernés la voient déjà dans « Pour moi ». Merci d’ouvrir la porte à un étudiant de l’école !': 'يراه الطلبة المعنيون الآن في «لي». شكرًا لأنك تفتح الباب لطالب من المدرسة!',
  'Voir mon offre': 'مشاهدة عرضي',
  'peut te recommander': 'يمكنه أن يزكّيك',
}, [
  [/^Les autres offres de (.+)$/, a => `عروض أخرى لـ${a}`],
  [/^Partagée par ([^,]+), qui peut te recommander$/, n => `نشره ${n}، ويمكنه أن يزكّيك`],
  [/^Partagée par ([^,]+), qui reçoit ta candidature et te répond ici$/, n => `نشره ${n}، وهو من يتلقى ترشيحك ويجيبك هنا`],
  [/^Partagée par ([^,]+)$/, n => `نشره ${n}`],
  [/^([^,]+) te répond ici$/, n => `${n} يجيبك هنا`],
  [/^(.+) reçoit ta candidature avec ton profil( et ton CV)?\. Tu suis sa réponse dans « Mon parcours »\.$/, (n, cv) => `${n === 'Le lauréat' ? 'الخريج' : n} يتلقى ترشيحك مع ملفك${cv ? ' وسيرتك الذاتية' : ''}. تتابع ردّه في «مساري».`],
]);
