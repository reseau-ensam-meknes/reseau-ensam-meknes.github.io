// Offres : liste compacte, fiche détaillée, candidature, gestion des candidats par le lauréat.
import { html, useState, useMemo, useEffect, useRef } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Avatar, CompanyLogo, TYPE_ICON, toast, RoleLine, celebrate, injectCSS, PartagerWhatsApp, lienWhatsApp, lienDirect, allerAuChamp, Bouclier } from './ui.js';
import { useBrouillon } from './ui.js';
import { proposerPrevenir } from './pwa.js';
import { getLang, addAR, arCount } from './i18n.js';
import { TYPES, titreOffre, FILIERES, PARCOURS, FILIERES_INFO, NIVEAUX, OBJECTIFS, niveauOf, timeAgo, daysUntil, placementOf, offerMatch, talentsFor, resumeFilieres, filiereSousTitre, offrePour, peutPostulerA, typesDemande, manquesOffre, peutRecommander, porteApresRefus, demandesPour, typeForNiveau } from './logic.js';
import { RelanceBanner, PasteOffer, sujetPris } from './recrutement.js';
import { CvButton } from './cv.js';
import { SignalerBtn } from './confiance.js';
import { EntrepriseResume } from './entreprises.js';
import { recherche } from './geo.js';
import { MessageBtn } from './messages.js';
import { DemandesTab } from './demandes.js';
import { estPortee, estPartagee, partageExpire, trierOffres, lienValide } from './origine.js';
import { BadgePortee, PartageCard, SectionPartages, EngagementPortee, NotePartage, PiedPartage, ChoixOrigine, CasePortee, SourcePartage } from './partages.js';
import { Reactions } from './reactions.js';
// Le message WhatsApp d'une offre, dans la langue de l'interface : de quoi il s'agit, et le lien qui l'ouvre directement.
// Le type n'est ajouté que si le titre ne le dit pas déjà (« Stage : Stage PFE… »), et l'auteur n'est jamais nommé.
const TYPES_AR = { stage: 'تدريب', pfe: 'مشروع نهاية الدراسة', etranger: 'تدريب بالخارج', emploi: 'وظيفة' };
const sansAccent = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const titreDit = o => sansAccent(o.titre).startsWith(sansAccent(TYPES[o.type]?.label.split(' ')[0] || '-'));
const texteOffre = o => getLang() === 'ar'
  ? `${titreDit(o) ? '' : `${TYPES_AR[o.type] || 'عرض'}: `}${o.titre} · ${o.entreprise}\nعرض منشور على شبكة ENSAM مكناس. افتحه هنا: ${lienDirect('offre/' + o.id)}`
  : `${titreDit(o) ? '' : `${TYPES[o.type]?.label || 'Offre'} : `}${o.titre} · ${o.entreprise}\nOffre partagée sur le Réseau ENSAM Meknès. Ouvre-la ici : ${lienDirect('offre/' + o.id)}`;

const ANNEES_OPTS = [[3, '3A'], [4, '4A'], [5, '5A'], [6, 'Jeunes diplômés']];
export const APP_STATUS = { postule: 'Envoyée', entretien: 'Entretien', retenu: 'Retenue', refuse: 'Pas retenue' };

export const matchesMe = offrePour;
const forLaureats = o => o.audience === 'laureats';

// Filières visées par une offre : un parcours entier en un geste, ou ses filières une à une.
// Une ancienne appellation déjà choisie (offre publiée avant la nouvelle liste) reste affichée, et se retire d'un clic.
function FilieresPick({ value, onChange, cls = '', style }) {
  const has = v => value.includes(v);
  const toggle = v => onChange(has(v) ? value.filter(x => x !== v) : [...value, v]);
  const anciennes = value.filter(v => !FILIERES.includes(v));
  return html`<div class=${'fil-pick' + cls} style=${style}>${PARCOURS.map(p => {
    const fs = FILIERES_INFO.filter(x => x.parcours === p.code).map(x => x.nom);
    const tout = fs.every(has);
    return html`<div class="fil-groupe" key=${p.code}>
      <button type="button" class=${'chip fil-parc' + (tout ? ' on' : '')} aria-pressed=${tout} onClick=${() => onChange(tout ? value.filter(x => !fs.includes(x)) : [...new Set([...value, ...fs])])}>${`Parcours ${p.nom}`}</button>
      ${fs.length > 1 ? html`<span class="chips">${fs.map(v => html`<button type="button" class=${'chip' + (has(v) ? ' on' : '')} aria-pressed=${has(v)} title=${v} onClick=${() => toggle(v)}>${filiereSousTitre(v)}</button>`)}</span>` : null}
    </div>`;
  })}
  ${anciennes.length ? html`<div class="fil-groupe"><span class="small muted">Ancienne appellation</span><span class="chips">${anciennes.map(v => html`<button type="button" class="chip on" aria-pressed="true" onClick=${() => toggle(v)}>${v}</button>`)}</span></div>` : null}</div>`;
}
injectCSS('fil-pick', `
.fil-pick { display: flex; flex-direction: column; gap: .6rem; }
.fil-groupe { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem .5rem; }
.fil-groupe .chips { display: contents; }
.chip.fil-parc { font-weight: 650; }
`);

// Un seul segment « Offres · Demandes (n) » ; sous les offres, une seule rangée de puces : les types, la banque de sujets
// (puce PFE), « Entre lauréats » et « Mes offres » pour les lauréats, « Mises de côté » pour les étudiants.
// Les anciennes adresses ouvrent le bon filtre : #offres/sujets la puce PFE, #offres/laureats « Entre lauréats ».
const LIENS = { sujets: 'pfe', laureats: 'laureats' };
const presetDe = f => (f === 'laureats' ? { audience: 'laureats', type: 'emploi', annees: [] } : f === 'pfe' ? { type: 'pfe', annees: [5] } : {});
// Le chiffre du segment : les demandes ouvertes que la personne peut voir (les siennes pour un étudiant)
function demandesOuvertes(data, me, store) {
  if (me.role === 'laureat') return demandesPour(data, me, id => store.byId('profiles', id)).length;
  return (data.demandes || []).filter(d => d.status === 'ouverte' && (me.role === 'admin' || d.auteur_id === me.id)).length;
}

export function OffersPage(ctx) {
  const { me, saison, sub, go, data, store } = ctx;
  const isStudent = me.role === 'etudiant';
  const avecDemandes = !isStudent || typesDemande(me, saison).length > 0;
  const demandes = avecDemandes && sub === 'demandes';
  const lien = LIENS[sub] || '';
  const [filtre, setFiltre] = useState(lien || 'tous');
  useEffect(() => { if (lien) setFiltre(lien); }, [lien]);
  const choisir = k => { setFiltre(k); if (lien) go('offres', { remplacer: true }); };
  const nDem = avecDemandes ? demandesOuvertes(data, me, store) : 0;
  const [compose, setCompose] = useState(null);
  // Partager une offre vue ailleurs (LinkedIn…) : tout membre, étudiants compris, dès que la base le permet
  const partager = store.peutOrigine?.() ? () => setCompose({ mode: 'partage' }) : null;
  return html`<section class="page offres-page">
    <header class="page-head">
      <div>${demandes ? null : html`<p class="eyebrow">${isStudent ? NIVEAUX[niveauOf(me, saison)]?.label || 'Pour toi' : 'Par les lauréats'}</p>`}<h1>${demandes ? (isStudent ? 'Demandes' : 'Demandes des étudiants') : 'Offres'}</h1></div>
      ${!isStudent && !demandes ? html`<button class=${'btn primary' + (filtre === 'pfe' ? '' : ' publier-offre')} id="of-publier" onClick=${() => setCompose(presetDe(filtre))}><${Icon} name="plus"/> ${filtre === 'pfe' ? 'Déposer un sujet' : 'Publier une offre'}</button>` : null}
      ${isStudent && !demandes && partager ? html`<button class="btn tonal" id="of-partager" onClick=${partager}><${Icon} name="share"/> Partager une offre</button>` : null}
    </header>
    ${avecDemandes ? html`<div class="seg offres-seg" role="tablist" aria-label="Offres ou demandes">
      <button role="tab" aria-selected=${!demandes} class=${demandes ? '' : 'on'} onClick=${() => go('offres', { remplacer: true })}>Offres</button>
      <button role="tab" aria-selected=${demandes} class=${demandes ? 'on' : ''} onClick=${() => go('offres/demandes', { remplacer: true })}>Demandes${nDem ? html` <span class="count">${nDem}</span>` : null}</button>
    </div>` : null}
    ${demandes ? html`<${DemandesTab} ctx=${isStudent ? ctx : { ...ctx, publierOffre: () => setCompose({}) }}/>` : html`<${OfferList} ctx=${ctx} filtre=${filtre} setFiltre=${choisir} onPropose=${() => setCompose(presetDe(filtre))} onPartager=${partager}/>`}
    ${compose ? html`<${OfferComposer} ctx=${ctx} preset=${compose} onClose=${() => setCompose(null)}/>` : null}
  </section>`;
}

// Ce que le membre a écrit lui-même (titre, entreprise, ville, message) porte translate="no" dir="auto" : jamais traduit.
const prenom = p => (p?.full_name || '').split(' ')[0];
// Raisons d'une recommandation : « Ta filière » est un texte de l'interface, le reste vient du profil (compétence, ville)
// Une seule raison en couleur (la filière) ; les autres restent neutres
const Pourquoi = ({ why }) => html`<span class="why">${why.map(w => (w === 'Ta filière' ? html`<span class="mini good">${w}</span>` : html`<span class="mini" translate="no" dir="auto">${w}</span>`))}</span>`;
const doux = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

function OfferList({ ctx, filtre, setFiltre, onPropose, onPartager }) {
  const { data, me, saison, openOffer, go } = ctx;
  const isStudent = me.role === 'etudiant';
  const niveau = niveauOf(me, saison);
  const myTypes = isStudent ? (OBJECTIFS[niveau]?.types || []) : Object.keys(TYPES);
  const [q, setQ] = useState('');
  // Une puce à la fois : Tout, les types de l'année, puis ce qui est propre à chacun
  const puces = [['tous', 'Tout'], ...(myTypes.length > 1 ? myTypes.map(k => [k, TYPES[k].label, TYPE_ICON[k]]) : []),
    ...(isStudent ? [['sauvees', 'Mises de côté', 'bookmark']] : [['laureats', 'Entre lauréats', 'briefcase'], ['miennes', 'Mes offres', 'user']])];
  const sep = puces.findIndex(([k]) => k === 'sauvees' || k === 'laureats');
  const f = puces.some(([k]) => k === filtre) ? filtre : 'tous';
  const tout = useMemo(() => {
    const trouve = recherche(q); // « مكناس » trouve Meknès, accents et casse ignorés
    return data.offers.filter(o => {
      if (f === 'miennes') { if (o.author_id !== me.id) return false; }
      else if (partageExpire(o)) return false; // un partage de plus de 45 jours (ou dont la date limite est passée) se ferme seul
      else if (f === 'sauvees') { if (!data.reactions.some(r => r.offer_id === o.id && r.user_id === me.id && r.kind === 'save')) return false; }
      else if (o.status !== 'ouverte' || (f === 'laureats' ? !forLaureats(o) : TYPES[f] && o.type !== f)) return false;
      if (isStudent && (forLaureats(o) || !(o.annees || []).includes(niveau))) return false; // un étudiant ne voit que les offres de son année
      if (trouve && !trouve(`${o.titre} ${o.entreprise} ${(o.filieres || []).join(' ')} ${resumeFilieres(o.filieres).join(' ')}`, o.ville, o.pays)) return false;
      return true;
    });
  }, [data, q, f]);
  // D'abord les offres portées par un lauréat, puis les classiques ; les partages (vus ailleurs) dans une section à part, plus bas
  const tri = trierOffres(tout);
  const list = tri.filter(o => !estPartagee(o));
  const partagees = tri.filter(estPartagee);
  const plain = f === 'tous' && !q.trim();
  // Les recommandées passent en tête et ne sont pas répétées dans la liste en dessous
  const avecReco = isStudent && plain && list.length > 5;
  const reco = avecReco ? recoFor(ctx, 3) : [];
  const dejaVues = new Set(reco.map(x => x.o.id));
  const reste = avecReco ? list.filter(o => !dejaVues.has(o.id)) : list;
  // Liste vide : une phrase et une seule action pour repartir
  const versToutes = { label: 'Voir toutes les offres', icon: 'feed', onClick: () => setFiltre('tous') };
  const conseil = { label: 'Demander un conseil', icon: 'mentor', onClick: () => go('mentorat') };
  const effacer = !plain && f !== 'sauvees' ? { label: 'Effacer les filtres', icon: 'x', onClick: () => { setQ(''); setFiltre('tous'); } } : null;
  const vide = f === 'sauvees'
    ? html`<${Empty} icon="bookmark" title="Aucune offre mise de côté" action=${versToutes}>Clique sur le marque-page d’une offre pour la mettre de côté ici.<//>`
    : f === 'laureats' ? html`<${Empty} icon="briefcase" title="Aucune offre ici">Ton équipe cherche un profil expérimenté ? Publie le poste ici : seuls les lauréats le voient.<//>`
    : f === 'pfe' && !q.trim() ? (isStudent
      ? html`<${Empty} icon="cap" title="Aucun sujet disponible pour l’instant" action=${conseil}>Pas encore de sujet déposé. Un lauréat de ta filière peut déjà t’aider à choisir ton sujet, en visio.<//>`
      : html`<${Empty} icon="cap" title="Aucun sujet disponible pour l’instant">Dépose le premier : un problème réel de ton équipe, que tu pourrais encadrer.<//>`)
    // Le réseau qui démarre : pas de promesse, une vraie action (sa demande, ou un conseil)
    : plain && isStudent ? (typesDemande(me, saison).length
      ? html`<${Empty} icon="feed" title=${NIVEAUX[niveau]?.short ? `Pas encore d’offre pour ta ${NIVEAUX[niveau].short}` : 'Pas encore d’offre pour ton année'} action=${{ label: 'Publier ma demande', icon: 'send', onClick: () => go('offres/demandes/nouvelle') }}>Le réseau vient d’ouvrir. Dis aux lauréats ce que tu cherches : ils te répondent ici.<//>`
      : html`<${Empty} icon="feed" title=${NIVEAUX[niveau]?.short ? `Pas encore d’offre pour ta ${NIVEAUX[niveau].short}` : 'Pas encore d’offre pour ton année'} action=${{ label: 'Demander un conseil', icon: 'mentor', onClick: () => go('mentorat') }}>Le réseau vient d’ouvrir. Un lauréat peut déjà te conseiller en visio.<//>`)
    : html`<${Empty} icon="feed" title="Aucune offre ici" action=${effacer}>${plain ? 'Le réseau vient d’ouvrir : la première offre peut être la tienne.' : 'Change la recherche ou les filtres.'}<//>`;

  return html`<div class="sub-page">
    <label class="search"><${Icon} name="search" size=${16}/><input id="f-q" placeholder="Entreprise, ville, filière…" value=${q} onInput=${e => setQ(e.target.value)}/></label>
    ${puces.length > 1 ? html`<div class="chips offres-chips" role="group" aria-label="Filtrer les offres">${puces.map(([k, l, ic], i) => html`${i === sep && sep > 1 ? html`<span class="chips-sep" aria-hidden="true"></span>` : null}<button class=${'chip' + (TYPES[k] ? ' t-' + k : '') + (f === k ? ' on' : '')} aria-pressed=${f === k} onClick=${() => setFiltre(f === k && k !== 'tous' ? 'tous' : k)}>${ic ? html`<${Icon} name=${ic} size=${15}/>` : null}${l}</button>`)}</div>` : null}
    ${avecReco ? html`<${RecoOffers} ctx=${ctx} reco=${reco} inOffres/>` : null}
    ${avecReco && reste.length ? html`<div class="section-head"><h2>${NIVEAUX[niveau]?.short ? `Les autres offres de ${NIVEAUX[niveau].short}` : 'Les autres offres'}</h2><span class="count">${reste.length}</span></div>` : null}
    <div class="offer-grid">
      ${reste.length ? reste.map(o => html`<${OfferCard} key=${o.id} o=${o} ctx=${ctx} sujets=${f === 'pfe'} onOpen=${() => openOffer(o.id)}/>`) : avecReco || partagees.length ? null : vide}
    </div>
    ${f === 'sauvees' ? null : html`<${SectionPartages} ctx=${ctx} list=${partagees} onPartager=${plain ? onPartager : null}/>`}
  </div>`;
}

// Offres recommandées à un étudiant : sa filière, ses compétences retrouvées dans l'offre, sa ville
function recoFor(ctx, max) {
  const { data, me, saison } = ctx;
  const n = niveauOf(me, saison);
  // Les partages (à postuler ailleurs) n'y sont pas ; une offre portée par un lauréat, qui encadre, passe devant
  return data.offers.filter(o => o.status === 'ouverte' && !estPartagee(o) && !forLaureats(o) && (o.annees || []).includes(n) && !data.applications.some(a => a.offer_id === o.id && a.student_id === me.id))
    .map(o => { const m = offerMatch(o, me); return { o, ...m, score: m.score + (estPortee(o) ? 3 : 0) }; }).sort((a, b) => b.score - a.score || new Date(b.o.created_at) - new Date(a.o.created_at)).slice(0, max);
}

export function RecoOffers({ ctx, max = 3, inOffres = false, reco, exclure }) {
  const { openOffer, go } = ctx;
  // Une offre déjà montrée plus haut (prochaine étape, « Cette semaine ») n'est pas redite ici
  const liste = reco || recoFor(ctx, max + (exclure?.size || 0)).filter(x => !exclure?.has(x.o.id)).slice(0, max);
  if (!liste.length) return null;  // rien à recommander : pas de bloc vide ni de promesse
  return html`<div class="reco">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="spark"/> Recommandé pour toi</h2>${inOffres ? null : html`<button class="btn tiny ghost" onClick=${() => go('offres')}>Toutes les offres <${Icon} name="arrow" size=${14}/></button>`}</div>
    <div class="offer-grid one">${liste.map(({ o, why }) => html`<${OfferCard} key=${o.id} o=${o} ctx=${ctx} why=${why} onOpen=${() => openOffer(o.id)}/>`)}</div>
  </div>`;
}

// Carte compacte : toute la carte ouvre la fiche. En pied, qui la partage et, s'il peut recommander, on le dit simplement.
export function OfferCard({ o, ctx, onOpen, why, sujets = false }) {
  // Une offre partagée (vue ailleurs) : la carte compacte, avec le lien vers le site d'origine
  if (estPartagee(o)) return html`<${PartageCard} o=${o} ctx=${ctx} onOpen=${onOpen}/>`;
  const { data, me, store, act } = ctx;
  const author = store.byId('profiles', o.author_id);
  const saved = data.reactions.find(r => r.offer_id === o.id && r.user_id === me.id && r.kind === 'save');
  const apps = data.applications.filter(a => a.offer_id === o.id);
  const myApp = apps.find(a => a.student_id === me.id);
  const dl = daysUntil(o.deadline);
  const mine = o.author_id === me.id;
  const pourMoi = peutPostulerA(o, me, ctx.saison);
  const pris = sujetPris(data, o);
  const canApply = !myApp && pourMoi && o.status === 'ouverte' && !pris;
  // « peut te recommander » seulement s'il travaille dans l'entreprise de l'offre (et la montre) ; déjà postulé :
  // l'état de la candidature compte davantage
  const coopt = canApply && !!author && store.voitChamp(author, 'travail') && peutRecommander(o, author);
  const lieu = [o.ville, o.pays !== 'Maroc' ? o.pays : ''].filter(Boolean).join(', ');
  return html`<article class=${'ocard' + (o.status !== 'ouverte' ? ' closed' : '') + (estPortee(o) ? ' portee' : '')}>
    <button class="ocard-main" onClick=${onOpen} aria-label=${`Ouvrir : ${titreOffre(o)}`}>
      <${CompanyLogo} name=${o.entreprise}/>
      <span class="ocard-txt">
        <span class="ocard-tags">${estPortee(o) ? html`<${BadgePortee}/>` : null}<span class=${'tag t-' + o.type}><${Icon} name=${TYPE_ICON[o.type]} size=${13}/>${TYPES[o.type]?.label}</span>
          ${o.status === 'ouverte' && dl !== null && dl >= 0 && dl <= 7 ? html`<span class="tag urgent">${dl === 0 ? 'Dernier jour' : `J-${dl}`}</span>` : null}
          ${o.status !== 'ouverte' ? html`<span class="tag done">${o.status === 'pourvue' ? 'Pourvue' : 'Fermée'}</span>` : null}
          ${forLaureats(o) ? html`<span class="tag entre">Entre lauréats</span>` : null}</span>
        <strong class="ocard-title" translate="no" dir="auto">${titreOffre(o)}</strong>
        <span class="ocard-meta" translate="no" dir="auto">${o.entreprise}${lieu ? ` · ${lieu}` : ''}</span>
        ${why?.length ? html`<${Pourquoi} why=${why}/>` : null}
      </span>
    </button>
    <${Reactions} ctx=${ctx} cible=${{ offer_id: o.id }} compact cls="ocard-rx"/>
    <footer class="ocard-foot">
      ${author ? html`<span class=${'ocard-author' + (coopt ? ' coopt' : '')}><${Avatar} p=${author} size=${coopt ? 28 : 22}/><span class="oa-txt"><span class="oa-nom">${prenom(author)} · promo ${author.promo}</span>${coopt ? html`<span class="oa-coopt">peut te recommander</span>` : null}</span></span>` : null}
      <span class="spacer"></span>
      ${myApp ? html`<span class=${'state-pill a-' + myApp.status}>${APP_STATUS[myApp.status]}</span>` : pris ? html`<span class="state-pill s-trouve">Pris</span>` : mine ? html`<span class="muted small">${apps.length} candidat${apps.length > 1 ? 's' : ''}</span>`
        : sujets && o.type === 'pfe' && !canApply && o.status === 'ouverte' ? html`<span class="state-pill s-recherche">Disponible</span>` : canApply ? null : html`<span class="muted small nowrap">${timeAgo(o.created_at)}</span>`}
      ${canApply ? html`<button class="btn tiny tonal ocard-apply" onClick=${() => ctx.openOffer(o.id, true)}>Postuler</button>` : null}
      ${!mine ? html`<button class=${'icon-btn small' + (saved ? ' on' : '')} aria-pressed=${!!saved} aria-label=${saved ? 'Ne plus mettre de côté' : 'Mettre de côté'} onClick=${() => act(() => saved ? store.remove('reactions', saved.id) : store.insert('reactions', { offer_id: o.id, user_id: me.id, kind: 'save' }))}><${Icon} name="bookmark" size=${16}/></button>` : null}
    </footer>
  </article>`;
}

// Qui partage l'offre, juste sous le titre : c'est souvent la vraie raison de postuler
function AuteurOffre({ ctx, o, author, candidat }) {
  const p = prenom(author);
  const coopt = candidat && o.status === 'ouverte' && ctx.store.voitChamp(author, 'travail') && peutRecommander(o, author);
  const phrase = !candidat ? `Partagée par ${p}` : coopt ? `Partagée par ${p}, qui peut te recommander` : `Partagée par ${p}, qui reçoit ta candidature et te répond ici`;
  return html`<button type="button" class=${'od-author' + (coopt ? ' coopt' : '')} onClick=${() => ctx.openProfile(author)}>
    <${Avatar} p=${author} size=${40}/>
    <span class="od-author-txt"><span class="od-author-line">${phrase}<${Bouclier} p=${author}/></span><${RoleLine} p=${author} score=${ctx.scores.get(author.id)}/></span>
    <span class="od-author-ico" aria-hidden="true"><${Icon} name="arrow" size=${16}/></span>
  </button>`;
}

// Fiche complète d'une offre. Sur téléphone, une feuille qui monte du bas ; l'action principale reste collée en bas.
export function OfferDetail({ ctx, id, onClose, apply }) {
  const { data, me, store, act } = ctx;
  const o = store.byId('offers', id);
  const mine = o?.author_id === me.id;
  const isAdmin = me.role === 'admin';
  const partage = estPartagee(o);
  // Un partage (vu ailleurs) n'a ni candidats ni suivi ici : seulement l'offre et ses questions
  const [tab, setTab] = useState(mine && !partage ? 'candidats' : 'offre');
  const [edit, setEdit] = useState(false);
  const [menu, setMenu] = useState(false);
  const [form, setForm] = useState(!!apply); // le formulaire de candidature est ouvert
  const versOffres = label => html`<div class="row-end"><button class="btn primary" onClick=${() => { onClose(); ctx.go('offres'); }}>${label}</button></div>`;
  if (!o) return html`<${Modal} title="Offre" onClose=${onClose}><p>Cette offre n’est plus disponible, ou elle ne t’est pas destinée.</p>${versOffres('Voir les offres')}<//>`;
  if (edit) return html`<${OfferComposer} ctx=${ctx} offer=${o} onClose=${() => setEdit(false)}/>`;
  const author = store.byId('profiles', o.author_id);
  const apps = data.applications.filter(a => a.offer_id === o.id);
  // Un lien partagé vers l'offre d'une autre année : un mot doux, et ses propres offres (un étudiant ne voit que son année)
  if (me.role === 'etudiant' && !mine && !apps.some(a => a.student_id === me.id)) {
    const n = niveauOf(me, ctx.saison);
    if (forLaureats(o) || !(o.annees || []).includes(n)) {
      const pour = forLaureats(o) ? 'Cette offre est réservée aux lauréats.' : `${`Cette offre est pour les ${(o.annees || []).map(a => NIVEAUX[a]?.short).filter(Boolean).join(', ') || 'autres années'}.`}`;
      const court = NIVEAUX[n]?.short;
      // « Voici celles de ta 3A » seulement s'il y en a : sinon, ce que l'étudiant peut faire tout de suite
      if (!court || data.offers.some(x => x.status === 'ouverte' && !forLaureats(x) && (x.annees || []).includes(n))) {
        return html`<${Modal} title="Offre" onClose=${onClose}><p>${pour}</p><p class="muted">${court ? `Voici celles de ta ${court}.` : 'Voici les tiennes.'}</p>${versOffres('Voir mes offres')}<//>`;
      }
      const dem = typesDemande(me, ctx.saison).length > 0;
      return html`<${Modal} title="Offre" onClose=${onClose}><p>${pour}</p><p class="muted">Pas encore d’offre pour ta ${court}.</p>
        <p class="muted">${dem ? 'Le réseau vient d’ouvrir. Dis aux lauréats ce que tu cherches : ils te répondent ici.' : 'Le réseau vient d’ouvrir. Un lauréat peut déjà te conseiller en visio.'}</p>
        <div class="row-end"><button class="btn primary" id="od-ensuite" onClick=${() => { onClose(); if (dem) ctx.go('offres/demandes/nouvelle'); else ctx.askHelp(); }}>${dem ? 'Publier ma demande' : 'Demander un conseil'}</button></div><//>`;
    }
  }
  const comments = data.comments.filter(c => c.offer_id === o.id);
  const candidat = peutPostulerA(o, me, ctx.saison);
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
    ['Pour', 'people', forLaureats(o) ? 'Lauréats' : [...(o.annees || []).map(a => NIVEAUX[a]?.short), ...(o.filieres?.length ? resumeFilieres(o.filieres) : ['toutes filières'])].join(' · ')],
  ].filter(Boolean);
  const auteurNom = prenom(author) || 'Le lauréat';

  // Pied collé : postuler (et garder l'offre), puis l'état de la candidature une fois envoyée
  const saveBtn = html`<button type="button" class=${'icon-btn od-save' + (saved ? ' on' : '')} aria-pressed=${!!saved} aria-label=${saved ? 'Ne plus mettre de côté' : 'Mettre de côté'} title=${saved ? 'Ne plus mettre de côté' : 'Mettre de côté'} onClick=${toggleSave}><${Icon} name="bookmark" size=${18}/></button>`;
  let footer = null;
  if (partage && tab === 'offre') footer = html`<${PiedPartage} o=${o}/>`;
  if (candidat && tab === 'offre') {
    if (myApp) {
      const pl = myApp.status === 'retenu' ? placementOf(data, me.id, ctx.saison) : null;
      const suite = { postule: `${auteurNom} te répond ici`, entretien: 'Bonne préparation pour l’entretien !', retenu: pl?.status === 'en_attente' ? 'Confirme ton recrutement dans « Mon parcours ».' : 'Bravo !' }[myApp.status];
      const porte = myApp.status === 'refuse' ? porteApresRefus(data, me, ctx.saison) : null;
      footer = html`<div class="od-foot"><span class=${'state-pill a-' + myApp.status}>${APP_STATUS[myApp.status]}</span><span class="small muted od-foot-txt">${porte ? porte.phrase : suite}</span>
        ${myApp.status === 'retenu' && pl?.status === 'en_attente' ? html`<button type="button" class="btn small" onClick=${() => { onClose(); ctx.go('parcours'); }}>Mon parcours</button>` : null}
        ${porte ? html`<button type="button" id="od-porte" class="btn small" onClick=${() => { onClose(); if (porte.conseil) ctx.askHelp(); else ctx.go(porte.to); }}>${porte.cta}</button>` : null}</div>`;
    } else if (o.status !== 'ouverte') footer = html`<div class="od-foot"><span class="small muted od-foot-txt">Cette offre n’accepte plus de candidatures.</span>${saveBtn}</div>`;
    else if (form) footer = html`<div class="od-foot"><button type="button" class="btn ghost" onClick=${() => setForm(false)}>Annuler</button><button class="btn primary" type="submit" form=${'apply-' + o.id}><${Icon} name="send" size=${16}/> Envoyer ma candidature</button></div>`;
    else footer = html`<div class="od-foot">${saveBtn}<button type="button" class="btn primary" onClick=${() => setForm(true)}><${Icon} name="send" size=${16}/> Postuler</button></div>`;
  }

  return html`<${Modal} title=${partage ? 'Offre partagée' : forLaureats(o) ? 'Offre entre lauréats' : TYPES[o.type]?.long || 'Offre'} onClose=${onClose} wide footer=${footer}>
    <div class="detail od">
      <div class="detail-head">
        <${CompanyLogo} name=${o.entreprise} size=${56}/>
        <div class="detail-title">
          ${o.status !== 'ouverte' ? html`<span class="tag done">${o.status === 'pourvue' ? 'Pourvue' : 'Fermée'}</span>` : null}
          <h2 translate="no" dir="auto">${titreOffre(o)}</h2>
          <p class="od-sub"><button type="button" class="linkish od-ent" onClick=${() => { onClose(); ctx.openEntreprise?.(o.entreprise); }}><span translate="no" dir="auto">${o.entreprise}</span></button><span class="od-dot" aria-hidden="true">·</span><span class="muted">Publiée ${timeAgo(o.created_at)}</span></p>
        </div>
        ${o.status === 'ouverte' ? html`<${PartagerWhatsApp} id="od-partage" texte=${texteOffre(o)}/>` : null}
        ${!mine && !isAdmin ? html`<${SignalerBtn} ctx=${ctx} type="offre" id=${o.id} small/>` : null}
        ${(mine || isAdmin) ? html`<div class="menu-wrap"><button class="icon-btn" aria-label="Gérer l’offre" aria-expanded=${menu} onClick=${() => setMenu(!menu)}><${Icon} name="more"/></button>
          ${menu ? html`<div class="menu-pop">
            ${mine ? html`<button onClick=${() => { setMenu(false); setEdit(true); }}><${Icon} name="edit" size=${16}/> Modifier</button>` : null}
            <button onClick=${() => { setMenu(false); act(() => store.update('offers', o.id, { status: o.status === 'ouverte' ? (partage ? 'fermee' : 'pourvue') : 'ouverte' })); }}><${Icon} name="check" size=${16}/> ${o.status === 'ouverte' ? (partage ? 'Fermer le partage' : 'Marquer pourvue') : 'Rouvrir l’offre'}</button>
            <button class="danger-t" onClick=${() => { setMenu(false); ctx.confirm('Supprimer définitivement cette offre ?', () => act(async () => { await store.remove('offers', o.id); onClose(); })); }}><${Icon} name="trash" size=${16}/> Supprimer</button>
          </div>` : null}</div>` : null}
      </div>
      ${author && !mine && tab === 'offre' ? html`<${AuteurOffre} ctx=${ctx} o=${o} author=${author} candidat=${candidat}/>` : null}
      ${estPortee(o) && tab === 'offre' ? html`<${EngagementPortee} auteur=${author}/>` : null}
      ${partage && tab === 'offre' ? html`<${NotePartage} o=${o} auteur=${author}/>` : null}
      <${RelanceBanner} ctx=${ctx} o=${o}/>
      ${mine && !partage ? html`<div class="seg" role="tablist" aria-label="Mon offre">${[['candidats', `Candidats (${apps.length})`], ['offre', 'L’offre'], ['questions', `Questions (${comments.length})`]].map(([k, l]) => html`<button role="tab" aria-selected=${tab === k} class=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}>${l}</button>`)}</div>` : null}

      ${tab === 'candidats' && mine ? html`<${Candidates} ctx=${ctx} o=${o} apps=${apps}/>` : null}

      ${tab === 'offre' ? html`
        <dl class="od-facts">${facts.map(([k, i, v]) => html`<div class=${k === 'Date limite' && urgent ? 'urgent' : ''}><dt><${Icon} name=${i} size=${14}/> ${k}</dt><dd>${v}</dd></div>`)}</dl>
        <${EntrepriseResume} ctx=${ctx} entreprise=${o.entreprise} onOpen=${onClose}/>
        <div class="prose"><p translate="no" dir="auto">${o.description}</p></div>
        ${o.lien && !partage ? html`<p><a href=${o.lien.startsWith('http') ? o.lien : 'https://' + o.lien} target="_blank" rel="noopener"><${Icon} name="link" size=${15}/> Voir l’annonce complète</a></p>` : null}
        ${candidat ? html`<${ApplyBox} ctx=${ctx} o=${o} form=${form} setForm=${setForm} onClose=${onClose}/>` : null}
        <${Reactions} ctx=${ctx} cible=${{ offer_id: o.id }} cls="od-rx"/>
        ${!mine || partage ? html`<${Questions} ctx=${ctx} o=${o} comments=${comments}/>` : null}` : null}

      ${tab === 'questions' && mine ? html`<${Questions} ctx=${ctx} o=${o} comments=${comments}/>` : null}
    </div>
  <//>`;
}

// Côté étudiant : écrire sa candidature (le bouton d'envoi est dans le pied de la fiche), puis suivre le statut
function ApplyBox({ ctx, o, form, setForm, onClose }) {
  const { data, me, store, act, saison } = ctx;
  const app = data.applications.find(a => a.offer_id === o.id && a.student_id === me.id);
  const [msg, setMsg, oublierBrouillon] = useBrouillon(me.id + ':candidature:' + o.id, '');
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
      ${app.status === 'refuse' ? null : html`
      <ol class="stepper">${steps.map((s, i) => html`<li class=${i <= idx ? 'done' : ''}><span class="step-dot">${i <= idx ? html`<${Icon} name="check" size=${13}/>` : i + 1}</span>${APP_STATUS[s]}</li>`)}</ol>`}
      <p class="small muted">${app.status === 'refuse' ? null : 'Le lauréat met à jour ce statut. '}${app.status === 'retenu' ? (pl?.status === 'en_attente' ? 'Confirme ton recrutement dans « Mon parcours ».' : '') : `Envoyée ${timeAgo(app.created_at)}.`}</p>
      ${app.status === 'postule' ? html`<button class="btn ghost small" onClick=${() => act(() => store.remove('applications', app.id))}>Retirer ma candidature</button>` : null}
    </div>`;
  }
  if (o.status !== 'ouverte') return null; // le pied de la fiche le dit déjà
  // Un lauréat a invité cet étudiant depuis le vivier de talents
  const inv = (data.invitations || []).find(i => i.offer_id === o.id && i.student_id === me.id && i.status === 'envoyee');
  const invite = inv ? html`<div class="invite-note"><${Icon} name="send" size=${16}/><div><p><strong translate="no">${store.byId('profiles', inv.laureat_id)?.full_name || 'Un lauréat'}</strong> t’invite à postuler.</p>
    ${inv.message ? html`<p class="quote small" translate="no" dir="auto">${inv.message}</p>` : null}
    <button class="linkish small" onClick=${() => act(async () => { await store.update('invitations', inv.id, { status: 'declinee' }); toast('C’est noté, merci d’avoir répondu.'); })}>Ça ne m’intéresse pas</button></div></div>` : null;
  if (!form) return invite;
  const hasCv = !!(me.cv_path || me.cv_url);
  const auteur = store.byId('profiles', o.author_id);
  const envoyer = e => {
    e.preventDefault();
    act(async () => {
      const premiere = me.role === 'etudiant' && !data.applications.some(a => a.student_id === me.id && a.offer_id);
      await store.insert('applications', { student_id: me.id, offer_id: o.id, entreprise: o.entreprise, titre: o.titre, message: msg.trim(), status: 'postule' });
      oublierBrouillon();
      // Première candidature : un vrai moment, avec la prochaine étape. Ensuite, un simple mot en bas de l'écran.
      const fete = premiere && celebrate({
        cle: 'premiere-candidature-' + me.id, icon: 'send', titre: 'Candidature envoyée !',
        texte: `${prenom(auteur) || 'Le lauréat'} reçoit ta candidature avec ton profil${hasCv ? ' et ton CV' : ''}. Tu suis sa réponse dans « Mon parcours ».`,
        action: { label: 'Voir mon parcours', icon: 'route', onClick: () => { onClose?.(); ctx.go('parcours'); } },
      });
      const mot = 'Candidature envoyée à ' + (auteur?.full_name || 'au lauréat') + '.';
      if (fete) proposerPrevenir('candidature'); else if (!proposerPrevenir('candidature', mot)) toast(mot, 'envoi');
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

// Le statut de la candidature juste avant « Recruter », pour le rétablir si le recrutement est annulé (sur cet appareil)
const AVANT = 'avant-recrutement:';
const statutAvant = {
  garder(id, s) { try { localStorage.setItem(AVANT + id, s); } catch {} },
  lire(id) { try { return localStorage.getItem(AVANT + id); } catch { return null; } },
  oublier(id) { try { localStorage.removeItem(AVANT + id); } catch {} },
};

// Un recrutement déclaré par erreur : on le retire tant que l'étudiant ne l'a pas confirmé, et sa candidature
// retrouve son statut d'avant (« Entretien », sinon « Reçue »), sans nouvelle notification
export function annulerRecrutement(ctx, p) {
  const { store, data, act } = ctx;
  const prenom = store.byId('profiles', p.student_id)?.full_name?.split(' ')[0];
  ctx.confirm(prenom ? `Annuler le recrutement de ${prenom} ? Il n’y aura plus rien à confirmer de son côté.` : 'Annuler ce recrutement ? Il n’y aura plus rien à confirmer.', () => act(async () => {
    // Si l'étudiant a confirmé entre-temps, rien n'est supprimé et la candidature ne bouge pas
    await store.remove('placements', p.id, { saufStatut: 'confirme', exiger: 'Ce recrutement vient d’être confirmé : il ne peut plus être annulé.' });
    const app = p.offer_id && data.applications.find(x => x.offer_id === p.offer_id && x.student_id === p.student_id && x.status === 'retenu');
    if (app) {
      const avant = statutAvant.lire(app.id);
      await store.update('applications', app.id, { status: ['postule', 'entretien', 'refuse'].includes(avant) ? avant : 'postule' });
      statutAvant.oublier(app.id);
    }
    toast('Recrutement annulé.');
  }), 'Annuler le recrutement', { non: 'Garder' });
}

// Côté lauréat : les candidats de son offre, et la déclaration de recrutement
function Candidates({ ctx, o, apps }) {
  const { data, store, act, openProfile, saison, me } = ctx;
  const [declare, setDeclare] = useState(false);
  const entre = forLaureats(o);
  const sorted = [...apps].sort((a, b) => ['postule', 'entretien', 'retenu', 'refuse'].indexOf(a.status) - ['postule', 'entretien', 'retenu', 'refuse'].indexOf(b.status));
  // Une confirmation avant de déclarer : un toucher de trop ne recrute personne
  const recruit = (studentId, app) => {
    const st = store.byId('profiles', studentId);
    const existing = placementOf(data, studentId, saison);
    if (existing && existing.status !== 'refuse') { toast(`${st.full_name} a déjà une réussite enregistrée cette année.`, 'err'); return; }
    const prenom = st.full_name.split(' ')[0];
    ctx.confirm(`Recruter ${prenom} ? ${prenom} recevra une demande de confirmation, et tu peux annuler tant que ce n’est pas confirmé.`, () => act(async () => {
      if (app) { if (app.status !== 'retenu') statutAvant.garder(app.id, app.status); await store.update('applications', app.id, { status: 'retenu' }); }
      await store.insert('placements', { student_id: studentId, offer_id: o.id, laureat_id: me.id, saison, niveau: Math.min(niveauOf(st, saison), 6), type: o.type, entreprise: o.entreprise, ville: o.ville, pays: o.pays || 'Maroc', source: 'plateforme' });
      toast(`${prenom} doit maintenant confirmer. Tes 50 points arrivent dès sa confirmation.`);
    }), 'Recruter', { non: 'Pas maintenant', cls: 'btn primary' });
  };
  return html`<div class="cands">
    ${sorted.length ? sorted.map(a => {
      const st = store.byId('profiles', a.student_id);
      const pl = data.placements.find(p => p.student_id === a.student_id && p.offer_id === o.id && p.status !== 'refuse');
      const invite = (data.invitations || []).some(i => i.offer_id === o.id && i.student_id === a.student_id);
      // Annulable par celui qui l'a déclaré (ou l'administration) tant que l'étudiant n'a pas confirmé
      const annulable = pl && pl.status !== 'confirme' && (pl.laureat_id === me.id || me.role === 'admin');
      return html`<div class="cand" key=${a.id}>
        <div class="cand-head"><${Person} p=${st} onOpen=${openProfile} size=${40}/><span class="muted small cand-quand">${timeAgo(a.created_at)}</span></div>
        ${pl || invite ? html`<div class="cand-etats">${pl ? html`<span class=${'state-pill ' + (pl.status === 'confirme' ? 's-trouve' : 's-validation')}>${pl.status === 'confirme' ? 'Recrutement confirmé par l’étudiant' : 'Recrutement déclaré · attend sa confirmation'}</span>` : null}${invite ? html`<span class="mini good">Invitation envoyée</span>` : null}</div>` : null}
        ${a.message ? html`<p class="quote" translate="no" dir="auto">${a.message}</p>` : null}
        <div class="cand-actions"><${MessageBtn} ctx=${ctx} p=${st} cls="btn small ghost"/><${CvButton} ctx=${ctx} p=${st}/>${annulable ? html`<button type="button" class="btn small ghost cand-annuler" onClick=${() => annulerRecrutement(ctx, pl)}><${Icon} name="x" size=${15}/> Annuler le recrutement</button>` : null}</div>
        ${pl ? null : html`<div class="cand-statut">
          <div class="seg small-seg" role="group" aria-label="Statut de la candidature">
            ${[['postule', 'Reçue'], ['entretien', 'Entretien'], ...(entre ? [['retenu', 'Retenue']] : []), ['refuse', 'Pas retenue']].map(([k, l]) => html`<button type="button" class=${a.status === k ? 'on' : ''} aria-pressed=${a.status === k ? 'true' : 'false'} onClick=${() => act(() => store.update('applications', a.id, { status: k }))}>${l}</button>`)}
          </div>
          ${entre ? null : html`<button type="button" class="btn small cand-recruter" onClick=${() => recruit(a.student_id, a)}><${Icon} name="check" size=${15}/> Recruter</button>`}
        </div>`}
      </div>`;
    }) : html`<${Empty} icon="inbox" scene="candidatures" title="Pas encore de candidat">${entre ? 'Les lauréats intéressés postulent ici. Partage aussi l’offre dans le groupe de ta ville.' : 'Les étudiants concernés la voient déjà dans leurs offres. Partage-la sur WhatsApp : un étudiant la fera circuler dans sa promo.'}<//>`}
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
      ${invited(p.id) ? html`<span class="state-pill s-validation">Invitation envoyée</span>` : html`<button class="btn small" onClick=${() => invite(p)}><${Icon} name="send" size=${14}/> Inviter à postuler</button>`}</li>`)}</ul></div>`;
}

function PickStudent({ ctx, onClose, onPick }) {
  const { data, saison } = ctx;
  const [q, setQ] = useState('');
  const res = q.trim().length < 2 ? [] : data.profiles.filter(p => p.role !== 'admin' && (niveauOf(p, saison) <= 6 || p.en_recherche) && p.full_name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);
  return html`<${Modal} title="Qui as-tu recruté ?" onClose=${onClose}>
    <p class="muted small">On lui demandera de confirmer. Le recrutement compte une fois confirmé.</p>
    <label class="search"><${Icon} name="search" size=${16}/><input id="pick-q" placeholder="Son nom" value=${q} onInput=${e => setQ(e.target.value)}/></label>
    <ul class="people-list">${res.map(p => html`<li><${Person} p=${p}/><button class="btn small tonal" onClick=${() => onPick(p.id)}>Choisir</button></li>`)}</ul>
    ${q.trim().length >= 2 && !res.length ? html`<p class="muted small">Personne avec ce nom. La personne doit d’abord créer son compte.</p>` : null}
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

// Publier une offre : le bouton reste au pouce, en bas de la feuille. Rien n'est signalé avant d'appuyer
// (ou avant un collage) ; ensuite, seuls les champs obligatoires encore vides le sont, et « Publier » y mène.
const ORDRE = ['type', 'titre', 'entreprise', 'ville', 'pays', 'description', 'annees', 'filieres', 'duree', 'deadline', 'lien', 'cooptation', 'remunere'];
const DETAILS = ['filieres', 'duree', 'deadline', 'lien', 'cooptation', 'remunere'];
const ID_OF = { titre: 'of-titre', entreprise: 'of-ent', description: 'of-desc', annees: 'of-annees', lien: 'of-lien-p' };
const MSG_OF = { titre: f => (f.titre.trim() ? 'Un titre de 4 caractères au moins.' : 'Donne un titre à l’offre.'),
  lien: f => ((f.lien || '').trim() ? 'Un lien complet, qui commence par https://' : 'Colle le lien de l’offre (LinkedIn, site de l’entreprise…).'),
  entreprise: () => 'Indique l’entreprise.', description: () => 'Ajoute quelques lignes : missions, profil recherché.', annees: () => 'Choisis au moins une année.' };
const nChamps = n => `${n} champ${n > 1 ? 's' : ''}`;

export function OfferComposer({ ctx, offer, onClose, preset = {} }) {
  const { store, me, act, data } = ctx;
  const editing = !!offer?.id;
  // Origine (origine.js) : « une offre de mon entreprise » (case « je l'encadre » : portée) ou « une offre vue ailleurs »
  // (partage, lien obligatoire). Un étudiant ne fait que partager, pour son année par défaut. Base pas à jour : comme avant.
  const avecOrigine = !!store.peutOrigine?.();
  const etudiant = me.role === 'etudiant';
  const niv = niveauOf(me, ctx.saison);
  const pourEtudiant = etudiant && avecOrigine && !editing ? { mode: 'partage', entreprise: '', type: typeForNiveau(niv), annees: niv >= 3 && niv <= 6 ? [niv] : [3, 4] } : {};
  const deOffre = offer ? { mode: estPartagee(offer) ? 'partage' : 'entreprise', porte: estPortee(offer) } : {};
  // Une nouvelle offre en cours d'écriture reste sur l'appareil (session expirée, rechargement). Un brouillon par point de
  // départ (« Publier une offre », « Déposer un sujet », « Entre lauréats ») ; le public et le type choisis en ouvrant
  // passent par-dessus le brouillon : une offre ne part jamais vers un autre public que celui de l'onglet.
  const depart = preset.mode === 'partage' ? ':partage' : preset.audience === 'laureats' ? ':laureats' : preset.type === 'pfe' ? ':pfe' : '';
  const [f, setF, oublierBrouillon] = useBrouillon(editing ? null : me.id + ':offre' + depart, () => ({
    type: 'stage', titre: '', entreprise: me.entreprise || '', ville: me.ville || '', pays: me.pays || 'Maroc', filieres: [], annees: [3, 4], description: '', contact: '', lien: '', deadline: '', cooptation: false, remunere: false, duree: '', audience: 'etudiants', mode: 'entreprise', porte: false, ...pourEtudiant, ...preset, ...(offer || {}), ...deOffre,
  }), preset);
  const partage = avecOrigine && (f.mode === 'partage' || (etudiant && !editing));
  const [tente, setTente] = useState(false);   // rien n'est signalé avant « Publier » ou un collage
  const [eclat, setEclat] = useState(null);    // { keys } : ce que « Offre en 30 secondes » vient de remplir
  const plus = useRef();                       // <details> « Plus de détails »
  useEffect(() => { if (!eclat) return; const t = setTimeout(() => setEclat(null), 2400); return () => clearTimeout(t); }, [eclat]);
  const set = (k, v) => setF({ ...f, [k]: v });
  const toggleIn = (k, v) => set(k, f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v]);
  const entre = f.audience === 'laureats';
  const anneesDe = t => t === 'pfe' ? [5] : t === 'emploi' ? [6] : t === 'etranger' ? [4, 5] : [3, 4];
  // Un étudiant garde son année quand il change le type
  const setType = t => setF({ ...f, type: t, annees: etudiant ? f.annees : anneesDe(t) });
  // Partage : l'offre n'est pas celle de son entreprise (le champ prérempli s'efface) ; retour : on le remet
  const setMode = m => setF(m === 'partage' ? { ...f, mode: m, porte: false, cooptation: false, entreprise: f.entreprise === (me.entreprise || '') ? '' : f.entreprise }
    : { ...f, mode: m, entreprise: f.entreprise || me.entreprise || '' });
  const manquesDe = n => [...(partage && !lienValide(n.lien) ? ['lien'] : []), ...manquesOffre(n)];
  const setAudience = a => setF(a === 'laureats' ? { ...f, audience: a, type: 'emploi', annees: [] } : { ...f, audience: a, annees: f.annees.length ? f.annees : [6] });
  // Offre en 30 secondes : on remplit les champs reconnus, sans effacer ce qui n'a pas été trouvé
  const fusion = (cur, x) => {
    const n = { ...cur };
    for (const [k, v] of Object.entries(x)) if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)) n[k] = v;
    // Type reconnu sans années : on prend les années habituelles de ce type
    if (x.type && x.type !== cur.type && !(x.annees && x.annees.length) && !etudiant) n.annees = anneesDe(x.type);
    if (cur.audience === 'laureats') { n.type = 'emploi'; n.annees = []; }
    return n;
  };
  // … puis on éclaire ce qui a été rempli, et le chiffre annoncé est celui des champs éclairés
  const fill = (x, found = Object.keys(x)) => {
    const n = fusion(f, x); setF(n);
    const keys = ORDRE.filter(k => found.includes(k) && !(n.audience === 'laureats' && (k === 'type' || k === 'annees')));
    setEclat({ keys }); setTente(true);
    if (keys.some(k => DETAILS.includes(k)) && plus.current) plus.current.open = true;
    const m = manquesDe(n).length, c = keys.length;
    toast(m ? `${nChamps(c)} rempli${c > 1 ? 's' : ''}. Il reste ${nChamps(m)} à compléter.` : `${nChamps(c)} rempli${c > 1 ? 's' : ''}. Vérifie, puis publie.`);
  };
  const manques = manquesDe(f);
  const err = k => (tente && manques.includes(k) ? MSG_OF[k](f) : null);
  const aria = k => (err(k) ? { 'aria-invalid': 'true', 'aria-describedby': ID_OF[k] + '-err' } : {});
  const r = k => (eclat?.keys.includes(k) ? ' rempli' : '');
  const ri = k => (eclat?.keys.includes(k) ? `--i:${eclat.keys.indexOf(k)}` : null);
  const submit = e => {
    e.preventDefault();
    if (manques.length) { setTente(true); allerAuChamp(ID_OF[manques[0]]); return; }
    const row = { type: f.type, titre: f.titre.trim(), entreprise: f.entreprise.trim(), ville: (f.ville || '').trim(), pays: (f.pays || '').trim() || 'Maroc', filieres: f.filieres, annees: entre ? [] : f.annees, description: f.description.trim(), contact: (f.contact || '').trim(), lien: (f.lien || '').trim(), deadline: f.deadline || null, cooptation: f.cooptation, remunere: f.remunere, duree: (f.duree || '').trim() };
    if (entre || offer?.audience) row.audience = f.audience;
    if (avecOrigine) { row.origine = partage ? 'partagee' : f.porte ? 'portee' : null; if (partage) row.cooptation = false; }
    act(async () => {
      if (editing) { await store.update('offers', offer.id, row); toast('Offre mise à jour.'); }
      else {
        const premiere = me.role === 'laureat' && !partage && !(data || store.data).offers.some(x => x.author_id === me.id && !estPartagee(x));
        const neuve = await store.insert('offers', { ...row, author_id: me.id, status: 'ouverte' });
        oublierBrouillon();
        // Première offre d'un lauréat : on le remercie, une seule fois
        const fete = premiere && celebrate({
          cle: 'premiere-offre-' + me.id, icon: 'feed', titre: 'Ta première offre est en ligne !',
          texte: entre ? 'Les lauréats la voient déjà dans « Entre lauréats ». Merci !' : 'Les étudiants concernés la voient déjà dans leurs offres. Merci pour eux !',
          // La suite la plus utile : la faire circuler dans les groupes WhatsApp de promo
          action: neuve?.id ? { label: 'Partager sur WhatsApp', icon: 'share', onClick: () => window.open(lienWhatsApp(texteOffre(neuve)), '_blank', 'noopener') } : null,
        });
        if (partage) toast('Offre partagée. Elle apparaît dans « Offres partagées », avec son lien.', 'envoi');
        else if (!fete) toast(entre ? 'Offre publiée. Les lauréats la voient dans « Entre lauréats ».' : 'Offre publiée. Les étudiants concernés la voient dans leurs offres.', 'envoi');
      }
      onClose();
    });
  };
  const pied = html`<button class="btn primary" type="submit" form="of-form" id="of-publier">${editing ? 'Enregistrer' : 'Publier'}</button>`;
  return html`<${Modal} title=${editing ? 'Modifier l’offre' : partage ? 'Partager une offre' : 'Publier une offre'} onClose=${onClose} wide footer=${pied}>
    <form class="form" id="of-form" noValidate onSubmit=${submit}>
      ${avecOrigine && !editing && !etudiant ? html`<${ChoixOrigine} value=${partage ? 'partage' : 'entreprise'} onChange=${setMode}/>` : null}
      ${partage && etudiant && !editing ? html`<p class="small muted hint-box"><${Icon} name="share" size=${15}/> <span>Tu partages une offre vue ailleurs (LinkedIn, site d’entreprise…). Les étudiants de ton année la voient avec son lien, et postulent sur le site d’origine.</span></p>` : null}
      ${partage ? html`<${SourcePartage} me=${me} f=${f} set=${set} onFill=${fill} err=${err('lien')} aria=${aria('lien')}/>` : editing ? null : html`<${PasteOffer} me=${me} onFill=${fill}/>`}
      ${me.role === 'etudiant' ? null : html`<div class="seg" role="group" aria-label="Pour qui">${[['etudiants', 'Pour les étudiants'], ['laureats', 'Entre lauréats']].map(([k, l]) => html`<button type="button" class=${f.audience === k ? 'on' : ''} aria-pressed=${f.audience === k} onClick=${() => setAudience(k)}>${l}</button>`)}</div>`}
      ${entre ? html`<p class="small muted hint-box"><${Icon} name="briefcase" size=${15}/> <span>Un poste pour un profil expérimenté : seuls les lauréats le voient, les étudiants non.</span></p>` : html`
      <div class="type-pick" role="group" aria-label="Type">${Object.entries(TYPES).map(([k, v]) => html`<button type="button" class=${'type-opt t-' + k + (f.type === k ? ' on' + r('type') : '')} style=${f.type === k ? ri('type') : null} aria-pressed=${f.type === k} onClick=${() => setType(k)}><${Icon} name=${TYPE_ICON[k]} size=${22}/><span>${v.label}</span></button>`)}</div>`}
      <${Field} label="Titre de l’offre" err=${err('titre')} errId="of-titre-err"><input id="of-titre" dir="auto" class=${r('titre')} style=${ri('titre')} ...${aria('titre')} required value=${f.titre} onInput=${e => set('titre', e.target.value)} placeholder="Ex. Optimiser une ligne d’assemblage" maxlength="140"/><//>
      <div class="grid3">
        <${Field} label="Entreprise" err=${err('entreprise')} errId="of-ent-err"><input id="of-ent" dir="auto" class=${r('entreprise')} style=${ri('entreprise')} ...${aria('entreprise')} required value=${f.entreprise} onInput=${e => set('entreprise', e.target.value)}/><//>
        <${Field} label="Ville"><input id="of-ville" dir="auto" class=${r('ville')} style=${ri('ville')} value=${f.ville || ''} onInput=${e => set('ville', e.target.value)}/><//>
        <${Field} label="Pays"><input id="of-pays" dir="auto" class=${r('pays')} style=${ri('pays')} value=${f.pays || ''} onInput=${e => set('pays', e.target.value)}/><//>
      </div>
      <${Field} label="Description" err=${err('description')} errId="of-desc-err"><textarea id="of-desc" dir="auto" class=${r('description')} style=${ri('description')} ...${aria('description')} required rows="5" value=${f.description} onInput=${e => set('description', e.target.value)} placeholder="Missions, profil recherché, comment se passe la sélection…" maxlength="4000"></textarea><//>
      ${entre ? null : html`<div class=${'field' + (err('annees') ? ' manque' : '')}><span class="field-label" id="of-annees-l">Pour quelles années ?</span>
        <div id="of-annees" class=${'chips' + r('annees')} style=${ri('annees')} role="group" aria-labelledby="of-annees-l" aria-describedby=${err('annees') ? 'of-annees-err' : null}>${ANNEES_OPTS.map(([v, l]) => html`<button type="button" class=${'chip' + (f.annees.includes(v) ? ' on' : '')} aria-pressed=${f.annees.includes(v)} onClick=${() => toggleIn('annees', v)}>${l}</button>`)}</div>
        ${err('annees') ? html`<span class="field-err" id="of-annees-err">${err('annees')}</span>` : null}</div>`}
      ${avecOrigine && !partage && !etudiant ? html`<${CasePortee} checked=${!!f.porte} onChange=${v => set('porte', v)}/>` : null}
      <details class="more-fields" ref=${plus} open=${editing}>
        <summary>Plus de détails (facultatif)</summary>
        <div class="form">
          <div class="field"><span class="field-label" id="of-fil-l">Filières</span><div role="group" aria-labelledby="of-fil-l"><${FilieresPick} value=${f.filieres} onChange=${v => set('filieres', v)} cls=${r('filieres')} style=${ri('filieres')}/></div><span class="field-hint">Aucune sélection = toutes les filières. Le nom d’un parcours le sélectionne en entier.</span></div>
          <div class="grid3">
            <${Field} label="Durée"><input id="of-duree" class=${r('duree')} style=${ri('duree')} value=${f.duree || ''} onInput=${e => set('duree', e.target.value)} placeholder="6 mois, CDI…"/><//>
            <${Field} label="Date limite"><input id="of-dl" type="date" class=${r('deadline')} style=${ri('deadline')} value=${f.deadline || ''} onInput=${e => set('deadline', e.target.value)}/><//>
            ${partage ? null : html`<${Field} label="Lien vers l’annonce"><input id="of-lien" class=${r('lien')} style=${ri('lien')} value=${f.lien || ''} onInput=${e => set('lien', e.target.value)} placeholder="https://…"/><//>`}
          </div>
          ${partage ? null : html`<label class=${'check' + r('cooptation')} style=${ri('cooptation')}><input id="of-coopt" type="checkbox" checked=${f.cooptation} onChange=${e => set('cooptation', e.target.checked)}/> Je peux recommander (coopter) les bons profils</label>`}
          <label class=${'check' + r('remunere')} style=${ri('remunere')}><input id="of-rem" type="checkbox" checked=${f.remunere} onChange=${e => set('remunere', e.target.checked)}/> Rémunéré / gratifié</label>
        </div>
      </details>
      ${f.type === 'pfe' && !entre && !partage ? html`<p class="small muted"><${Icon} name="cap" size=${14}/> Les 5A le trouvent sous la puce PFE des offres : décris le vrai problème de l’équipe, tu pourras encadrer l’étudiant qui le prend.</p>` : null}
      ${partage ? html`<p class="small muted">Elle apparaît dans « Offres partagées », avec son lien. Elle se ferme seule après 45 jours, ou à sa date limite.</p>`
        : html`<p class="small muted">Les candidatures arrivent ici, dans l’onglet « Candidats » de ton offre. Tu n’as pas besoin de donner ton email.</p>`}
    </form>
  <//>`;
}

// ---------------------------------------------------------------------------
// Passe UX des offres : liste calme (un seul bouton plein, dans la fiche), filtres sur une rangée,
// fiche en feuille avec l'action collée en bas, l'auteur juste sous le titre.
// ---------------------------------------------------------------------------
injectCSS('offres-ux', `
/* En-tête : le titre et « Publier une offre » (plein, l'action qui remplit la plateforme) sur la même ligne */
.offres-page .page-head { flex-wrap: nowrap; align-items: flex-end; }
.offres-page .page-head > div { min-width: 0; }
.offres-page .page-head .btn.primary { flex: none; width: auto; }
/* Offres · Demandes : un segment à deux choix, sur une ligne */
.offres-seg { display: flex; width: min(100%, 22rem); }
.offres-seg button { flex: 1 1 0; }
.offres-seg button.on, .offres-chips .chip.on { background: var(--sel-bg); color: var(--sel-ink); border-color: transparent; box-shadow: inset 0 0 0 1px var(--sel-ring); font-weight: 600; }
.offres-seg .count { margin-inline-start: .15rem; }
.offres-seg button.on .count { background: color-mix(in srgb, var(--sel-ink) 14%, transparent); color: var(--sel-ink); }
@media (max-width: 760px) { .offres-seg { width: 100%; } }
/* Une seule rangée de filtres avant la première offre */
.offres-chips { flex-wrap: nowrap; align-items: center; overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain; padding-block: 3px; }
.offres-chips::-webkit-scrollbar { display: none; }
.offres-chips .chip { flex: none; white-space: nowrap; min-height: 36px; }
.offres-chips .chip.on svg { color: var(--c, currentColor); }
.chips-sep { flex: none; width: 1px; height: 22px; background: var(--line); margin-inline: .15rem; }
@media (max-width: 760px) { .offres-chips { margin-inline: -16px; padding-inline: 16px; scroll-padding-inline: 16px; } }

.ocard-foot { gap: .45rem; }
.ocard-author { min-width: 0; }
.ocard-author .oa-txt { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
.ocard-author .oa-txt > span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ocard-author .oa-coopt { color: var(--good); font-weight: 600; font-size: var(--fs-1); }
[dir="rtl"] .ocard-txt [dir="auto"], [dir="rtl"] .od .detail-title [dir="auto"] { text-align: right; }

.od .detail-head { gap: .8rem; }
.od .detail-title { gap: .3rem; }
.od .detail-title h2 { font-size: var(--fs-5); line-height: 1.22; }
.od-sub { display: flex; align-items: center; flex-wrap: wrap; gap: .1rem .4rem; font-size: var(--fs-2); }
.od-ent { font-weight: 600; color: var(--ink-2); text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--ink-2) 35%, transparent); text-underline-offset: 3px; }
.od-ent:hover { color: var(--accent); }
.od-dot { color: var(--muted); }
.od-author { display: flex; align-items: center; gap: .75rem; width: 100%; padding: .7rem 0; border-radius: 0; border: 0; border-block: 1px solid var(--line); background: none; color: inherit; font: inherit; text-align: start; cursor: pointer; transition: border-color .2s, background .2s; }
.od-author:hover .od-author-line { color: var(--accent); }
.od-author.coopt .od-author-line { color: var(--good); }
.od-author-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .15rem; }
.od-author-line { font-weight: 600; color: var(--ink); line-height: 1.35; }
.od-author .role-line { font-size: var(--fs-1); }
.od-author-ico { flex: none; display: grid; place-items: center; color: var(--muted); }
.od-author:hover .od-author-ico { color: var(--accent); }
.od-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 1rem; margin: 0; }
.od-facts > div { padding: .55rem 0 .6rem; border-top: 1px solid var(--line); min-width: 0; }
.od-facts > div:last-child:nth-child(odd) { grid-column: 1 / -1; }
.od-facts dt { display: flex; align-items: center; gap: .3rem; font-size: var(--fs-1); color: var(--muted); font-weight: 600; }
[dir="rtl"] .od-facts dt { font-size: var(--fs-2); }
.od-facts dd { margin: .1rem 0 0; font-weight: 500; font-size: var(--fs-2); line-height: 1.4; overflow-wrap: anywhere; }
.od-facts dd .tag { margin-inline-start: .2rem; vertical-align: 1px; }
@media (min-width: 761px) {
  .od-facts { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
  .od-facts > div:last-child:nth-child(odd) { grid-column: auto; }
}

.modal-foot > .od-foot { flex: 1; min-width: 0; display: flex; align-items: center; gap: .6rem; }
.od-foot .btn.primary { flex: 1; min-height: 46px; }
.od-foot .btn.ghost { min-height: 46px; }
.od-save { flex: none; width: 46px; height: 46px; border: 1px solid var(--line-strong); border-radius: var(--r-md); }
.od-save.on { background: var(--sel-bg); color: var(--sel-ink); border-color: transparent; box-shadow: inset 0 0 0 1px var(--sel-ring); }
.od-foot-txt { flex: 1; min-width: 0; }
@media (min-width: 761px) { .od-foot .btn.primary { flex: 0 0 auto; min-width: 15rem; margin-inline-start: auto; } }
`);

const OFFRES_AR = ['عرض آخر', 'عرضان آخران', 'عروض أخرى', 'عرضًا آخر'];
const PORTE_DEMANDE = 'Dis aux lauréats ce que tu cherches : ils peuvent te proposer leur aide.';
const porteAR = p => p === 'Une autre offre t’attend.' ? 'عرض آخر في انتظارك.'
  : /^(\d+) autres offres t’attendent\.$/.test(p) ? `${arCount(+p.match(/^\d+/)[0], OFFRES_AR)} في انتظارك.`
  : p === PORTE_DEMANDE ? 'يمكنك نشر طلب يصف بحثك، ويمكن للخريجين أن يقترحوا مساعدتهم.'
  : p === 'Un lauréat peut te conseiller en visio.' ? 'يمكن لخريج أن ينصحك عبر الفيديو.' : null;
addAR({
  'Les autres offres': 'عروض أخرى',
  'Voir toutes les offres': 'عرض كل العروض',
  'Effacer les filtres': 'مسح عوامل التصفية',
  'Offre entre lauréats': 'عرض بين الخريجين',
  'Ta candidature': 'ترشيحك',
  'Bonne préparation pour l’entretien !': 'بالتوفيق في التحضير للمقابلة!',
  'Bravo !': 'رائع!',
  'Candidature envoyée !': 'تم إرسال ترشيحك!',
  'Voir mon parcours': 'عرض مساري',
  'Ta première offre est en ligne !': 'عرضك الأول منشور الآن!',
  'Les lauréats la voient déjà dans « Entre lauréats ». Merci !': 'يراه الخريجون الآن في «بين الخريجين». شكرًا!',
  'Les étudiants concernés la voient déjà dans leurs offres. Merci pour eux !': 'يراه الطلبة المعنيون الآن ضمن عروضهم. شكرًا من أجلهم!',
  'Voir mon offre': 'فتح عرضي',
  'peut te recommander': 'تزكية ممكنة',
  'Le réseau vient d’ouvrir. Dis aux lauréats ce que tu cherches : ils te répondent ici.': 'الشبكة فتحت للتو. قل للخريجين ما تبحث عنه: سيجيبونك هنا.',
  'Le réseau vient d’ouvrir. Un lauréat peut déjà te conseiller en visio.': 'الشبكة فتحت للتو. يمكن لخريج أن ينصحك منذ الآن عبر الفيديو.',
  'Le réseau vient d’ouvrir : la première offre peut être la tienne.': 'الشبكة فتحت للتو: يمكن أن يكون العرض الأول عرضك.',
  'Change la recherche ou les filtres.': 'غيّر البحث أو المرشحات.',
  'Cette offre n’est plus disponible, ou elle ne t’est pas destinée.': 'لم يعد هذا العرض متاحًا، أو أنه غير موجّه لك.',
  'Cette offre est réservée aux lauréats.': 'هذا العرض مخصّص للخريجين.', 'Voici les tiennes.': 'إليك عروضك.', 'Voir mes offres': 'عرض عروضي',
  'Donne un titre à l’offre.': 'أعطِ العرض عنوانًا.', 'Un titre de 4 caractères au moins.': 'عنوان من 4 أحرف على الأقل.',
  'Indique l’entreprise.': 'اذكر الشركة.', 'Ajoute quelques lignes : missions, profil recherché.': 'أضف بضعة أسطر: المهام والملف المطلوب.',
  'Choisis au moins une année.': 'اختر سنة واحدة على الأقل.', 'Pour quelles années ?': 'لأي سنوات؟', 'Titre de l’offre': 'عنوان العرض',
  'Ex. Optimiser une ligne d’assemblage': 'مثال: تحسين خط تجميع', 'Pas encore d’offre pour ton année': 'لا عروض بعد لسنتك',
  'Retenue': 'مقبول', 'Pas retenue': 'غير مقبول', 'Recruter': 'توظيف', 'Invitation envoyée': 'دعوة مُرسلة',
  'Recrutement déclaré · attend sa confirmation': 'توظيف مُصرَّح به · في انتظار التأكيد',
  'Annuler le recrutement': 'إلغاء التوظيف', 'Recrutement annulé.': 'أُلغي التوظيف.', 'Garder': 'إبقاء', 'Pas maintenant': 'ليس الآن',
  'Annuler ce recrutement ? Il n’y aura plus rien à confirmer.': 'إلغاء هذا التوظيف؟ لن يبقى ما يجب تأكيده.',
  'Ce recrutement vient d’être confirmé : il ne peut plus être annulé.': 'أُكِّد هذا التوظيف للتو، فلم يعد ممكنًا إلغاؤه.',
  't’invite à postuler.': ': دعوة لك للترشح.', 'Ça ne m’intéresse pas': 'لا يهمني',
  'Aucune offre mise de côté': 'لا عرض محفوظ', 'Clique sur le marque-page d’une offre pour la mettre de côté ici.': 'انقر على علامة الحفظ في عرض لتحفظه هنا.',
  'Mises de côté': 'المحفوظة', 'Mettre de côté': 'حفظ', 'Ne plus mettre de côté': 'إلغاء الحفظ',
  'Réservées aux lauréats': 'خاصة بالخريجين', 'Par les lauréats': 'من الخريجين',
  'Les étudiants concernés la voient déjà dans leurs offres. Partage-la sur WhatsApp : un étudiant la fera circuler dans sa promo.': 'يراه الطلبة المعنيون الآن ضمن عروضهم. شاركه على واتساب: سينشره طالب في دفعته.',
  'Offre publiée. Les étudiants concernés la voient dans leurs offres.': 'تم نشر العرض. يراه الطلبة المعنيون ضمن عروضهم.',
  'On lui demandera de confirmer. Le recrutement compte une fois confirmé.': 'سيُطلب تأكيد التوظيف من الشخص المعني. يُحتسب التوظيف بعد تأكيده.',
  // Après un refus, une porte vraie : le nombre réel d'autres offres, sinon sa demande ou un conseil
  'Une autre offre t’attend.': 'عرض آخر في انتظارك.', [PORTE_DEMANDE]: 'يمكنك نشر طلب يصف بحثك، ويمكن للخريجين أن يقترحوا مساعدتهم.',
  'Un lauréat peut te conseiller en visio.': 'يمكن لخريج أن ينصحك عبر الفيديو.',
  'Entreprise, ville, filière…': 'الشركة، المدينة، الشعبة…', 'Le lauréat': 'الخريج', 'Cette offre est pour les autres années.': 'هذا العرض موجّه لسنوات أخرى.',
}, [
  [/^(\d+) autres offres t’attendent\.$/, n => porteAR(`${n} autres offres t’attendent.`)],
  [/^Ta candidature « (.+) » : pas retenue cette fois\. (.+)$/, (t, p) => `لم يُقبل ترشيحك «${t}» هذه المرة. ${porteAR(p) || p}`],
  [/^(.+?) a déjà une réussite enregistrée cette année\.$/, n => `لدى ${n} نجاح مسجّل هذه السنة.`],
  [/^(\d+) champs? remplis?\. Il reste (\d+) champs? à compléter\.$/, (n, m) => { const F = ['حقل واحد', 'حقلين', 'حقول', 'حقلًا']; return `تم ملء ${arCount(n, F)}. بقي عليك إكمال ${arCount(m, F)}.`; }],
  [/^Pas encore d’offre pour ta (.+)$/, a => `لا عروض بعد لـ${a}`],
  [/^Cette offre est pour les (.+)\.$/, a => `هذا العرض موجّه لـ${a}.`],
  [/^Invitation envoyée à (.+)\.$/, n => `تم إرسال الدعوة إلى ${n}.`],
  [/^Voici celles de ta (.+)\.$/, a => `إليك عروض ${a}.`],
  [/^Les autres offres de (.+)$/, a => `عروض أخرى لـ${a}`],
  [/^Partagée par ([^,]+), qui peut te recommander$/, n => `عرض من ${n}، مع إمكانية التزكية`],
  [/^Partagée par ([^,]+), qui reçoit ta candidature et te répond ici$/, n => `عرض من ${n}، يصله ترشيحك ويأتيك الجواب هنا`],
  [/^Partagée par ([^,]+)$/, n => `عرض من ${n}`],
  [/^([^,]+) te répond ici$/, n => `الجواب من ${n} هنا`],
  [/^(.+) reçoit ta candidature avec ton profil( et ton CV)?\. Tu suis sa réponse dans « Mon parcours »\.$/, (n, cv) => `يصل ترشيحك إلى ${n === 'Le lauréat' ? 'الخريج' : n} مع ملفك${cv ? ' وسيرتك الذاتية' : ''}. تتابع الرد في «مساري».`],
  [/^Recruter (.+?) \? (.+?) recevra une demande de confirmation, et tu peux annuler tant que ce n’est pas confirmé\.$/, n => `توظيف ${n}؟ يصل طلب تأكيد إلى ${n}، ويمكنك الإلغاء ما دام لم يُؤكَّد بعد.`],
  [/^Annuler le recrutement de (.+?) \? Il n’y aura plus rien à confirmer de son côté\.$/, n => `إلغاء توظيف ${n}؟ لن يبقى ما يجب تأكيده.`],
]);
