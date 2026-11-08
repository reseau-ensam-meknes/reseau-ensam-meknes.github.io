// Offres : liste compacte, fiche détaillée, candidature, gestion des candidats par le lauréat.
import { html, useState, useMemo, useEffect, useRef } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Avatar, LogoEntreprise, MentionLogos, styleEntreprise, TYPE_ICON, toast, RoleLine, celebrate, injectCSS, PartagerWhatsApp, lienWhatsApp, lienDirect, allerAuChamp, Bouclier } from './ui.js';
import { useBrouillon, EnTetePage, Compteur, Rangee, vibrer, Coche, mouvementReduit } from './ui.js';
import { proposerPrevenir } from './pwa.js';
import { getLang, addAR, arCount, t as tr } from './i18n.js';
import { TYPES, titreOffre, FILIERES, PARCOURS, FILIERES_INFO, NIVEAUX, OBJECTIFS, niveauOf, timeAgo, daysUntil, placementOf, offerMatch, talentsFor, resumeFilieres, filiereSousTitre, offrePour, peutPostulerA, typesDemande, manquesOffre, peutRecommander, porteApresRefus, demandesPour, typeForNiveau, ecoleDuContenu, ecoleDe, nomsAPartager } from './logic.js';
import { RelanceBanner, PasteOffer, sujetPris } from './recrutement.js';
import { CvButton } from './cv.js';
import { SignalerBtn } from './confiance.js';
import { EntrepriseResume } from './entreprises.js';
import { recherche } from './geo.js';
import { MessageBtn } from './messages.js';
import { DemandesTab, usePucesEntieres } from './demandes.js';
import { estPortee, estPartagee, partageExpire, trierOffres, lienValide } from './origine.js';
import { BadgePortee, PartageCard, SectionPartages, EngagementPortee, NotePartage, PiedPartage, ChoixOrigine, CasePortee, SourcePartage } from './partages.js';
import { Reactions } from './reactions.js';
import { preuvesOffre, phraseSauvees, phraseCandidatures } from './vitrine-regles.js';
import { ouvrirEnDouceur, SqCartes, lieuOffre } from './vitrine.js';
import { ajouterIcones } from './entree.js';
// Le message WhatsApp d'une offre, dans la langue de l'interface : de quoi il s'agit, et le lien qui l'ouvre directement.
// Le type n'est ajouté que si le titre ne le dit pas déjà (« Stage : Stage PFE… »), et l'auteur n'est jamais nommé.
// Son école : celle de l'offre, sinon celle du membre ; le lien la dit, le texte la nomme (nomsAPartager : une école pas
// encore ouverte, « ENSAM » sans ville). ctx : data (ou store.data, juste après la publication) et me.
const TYPES_AR = { stage: 'تدريب', pfe: 'مشروع نهاية الدراسة', etranger: 'تدريب بالخارج', emploi: 'وظيفة' };
const sansAccent = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const titreDit = o => sansAccent(o.titre).startsWith(sansAccent(TYPES[o.type]?.label.split(' ')[0] || '-'));
export function texteOffre(o, { data, store, me } = {}) {
  const ecole = o.ecole || ecoleDe(me), n = nomsAPartager((data || store?.data)?.ecoles, ecole), lien = lienDirect('offre/' + o.id, ecole);
  return getLang() === 'ar'
    ? `${titreDit(o) ? '' : `${TYPES_AR[o.type] || 'عرض'}: `}${o.titre} · ${o.entreprise}\nعرض منشور على شبكة ${n.nomAr}. افتحه هنا: ${lien}`
    : `${titreDit(o) ? '' : `${TYPES[o.type]?.label || 'Offre'} : `}${o.titre} · ${o.entreprise}\nOffre partagée sur le Réseau ${n.nom}. Ouvre-la ici : ${lien}`;
}

const ANNEES_OPTS = [[3, '3A'], [4, '4A'], [5, '5A'], [6, 'Jeunes diplômés']];
export const APP_STATUS = { postule: 'Envoyée', entretien: 'Entretien', retenu: 'Retenue', refuse: 'Pas retenue' };

export const matchesMe = offrePour;
const forLaureats = o => o.audience === 'laureats';

// Filières visées par une offre : un parcours entier en un geste, ou ses filières une à une.
// Une ancienne appellation déjà choisie (offre publiée avant la nouvelle liste) reste affichée, et se retire d'un clic.
export function FilieresPick({ value, onChange, cls = '', style }) {
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
/* Le formulaire d'une offre sur un téléphone : une puce au nom long (« Conception et Industrialisation des Systèmes
   Mécaniques ») revient à la ligne dans sa puce, alignée comme les autres, au lieu de pousser le formulaire hors de
   l'écran ; sur ordinateur, comme avant */
@media (max-width: 600px) {
  #of-form .chip { white-space: normal; max-width: 100%; text-align: start; }
}
`);

// En-tête compact (EnTetePage du Socle) : un seul chiffre en sur-titre, le titre et son bouton sur une ligne, le segment
// Offres · Demandes (n) dessous. Un lauréat : « Publier une offre », le seul bouton plein de l'écran. Un étudiant vient
// trouver et postuler : « Partager une offre » reste tonal (« Postuler », dans la fiche, garde le seul bouton plein).
// Sous les offres, une seule rangée de puces, collée en haut en défilant : les types, la banque de sujets (puce PFE),
// « Entre lauréats » et « Mes offres » pour les lauréats, « Mises de côté » pour les étudiants.
// Les anciennes adresses ouvrent le bon filtre : #offres/sujets la puce PFE, #offres/laureats « Entre lauréats ».
const LIENS = { sujets: 'pfe', laureats: 'laureats' };
const presetDe = f => (f === 'laureats' ? { audience: 'laureats', type: 'emploi', annees: [] } : f === 'pfe' ? { type: 'pfe', annees: [5] } : {});
// Le chiffre du segment : les demandes ouvertes que la personne peut voir (les siennes pour un étudiant)
function demandesOuvertes(data, me, store) {
  if (me.role === 'laureat') return demandesPour(data, me, id => store.byId('profiles', id)).length;
  return (data.demandes || []).filter(d => d.status === 'ouverte' && (me.role === 'admin' || d.auteur_id === me.id)).length;
}
// Le chiffre du sur-titre, un seul et vrai : pour un étudiant, les offres ouvertes de son année ; pour un lauréat, les
// candidatures qui attendent sa réponse sur ses offres, sinon les offres ouvertes du réseau. Rien plutôt que « 0 ».
const pl = (n, un, plus) => (n > 1 ? plus : un);
function chiffreOffres({ data, me, saison }) {
  const ouvertes = data.offers.filter(o => o.status === 'ouverte' && !partageExpire(o));
  if (me.role === 'etudiant') {
    const n = niveauOf(me, saison), court = NIVEAUX[n]?.short;
    const k = ouvertes.filter(o => !forLaureats(o) && (o.annees || []).includes(n)).length;
    return k ? { v: k, f: x => tr(`${x} ${pl(x, 'offre', 'offres')} ${court ? `pour ta ${court}` : 'pour toi'}`) } : null;
  }
  if (me.role === 'laureat') {
    const miennes = new Set(data.offers.filter(o => o.author_id === me.id && o.status === 'ouverte').map(o => o.id));
    const attente = data.applications.filter(a => miennes.has(a.offer_id) && a.status === 'postule');
    const offres = [...new Set(attente.map(a => a.offer_id))];
    // Le chiffre mène aux candidatures : la fiche de l'offre s'il n'y en a qu'une, sinon « Mes offres »
    if (attente.length) return { v: attente.length, f: x => tr(`${x} ${pl(x, 'candidature', 'candidatures')} à traiter`), vers: offres.length === 1 ? { offre: offres[0] } : { filtre: 'miennes' } };
  }
  return ouvertes.length ? { v: ouvertes.length, f: x => tr(`${x} ${pl(x, 'offre ouverte', 'offres ouvertes')}`) } : null;
}

// La dernière visite de la page Offres, gardée par membre sur cet appareil : ce qui est arrivé depuis est « Nouveau ».
// Lue une fois par membre (au premier affichage de la page), réécrite en arrivant et en repartant. Passer aux demandes
// et revenir ne la remet pas à zéro : elle vit avec la page, pas avec la liste.
const CLE_VU = 'offres-vu:';
const lireVu = id => { try { return Number(localStorage.getItem(CLE_VU + id)) || 0; } catch { return 0; } };
const ecrireVu = id => { try { localStorage.setItem(CLE_VU + id, String(Date.now())); } catch { /* stockage refusé */ } };
function useDerniereVisite(id) {
  const vu = useMemo(() => lireVu(id), [id]);
  useEffect(() => { ecrireVu(id); return () => ecrireVu(id); }, [id]);
  return vu;
}

// La rangée de filtres collée sous la barre du haut : on mesure la barre, et l'on sait quand la rangée s'y colle
// (son fond de verre paraît alors, et la loupe qui ramène à la recherche)
function useCollee(ref) {
  const [colle, setColle] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const haut = document.querySelector('.top');
    let raf = 0;
    const mesurer = () => el.style.setProperty('--of-haut', (haut?.offsetHeight || 56) + 'px');
    const voir = () => { raf = 0; const pos = parseFloat(getComputedStyle(el).top) || 0; setColle(scrollY > 4 && el.getBoundingClientRect().top <= pos + .5); };
    const plusTard = () => { raf ||= requestAnimationFrame(voir); };
    mesurer(); voir();
    addEventListener('scroll', plusTard, { passive: true });
    const ro = haut && typeof ResizeObserver === 'function' ? new ResizeObserver(() => { mesurer(); plusTard(); }) : null;
    ro?.observe(haut);
    return () => { removeEventListener('scroll', plusTard); ro?.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return colle;
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
  const vu = useDerniereVisite(me.id);
  // Partager une offre vue ailleurs (LinkedIn…) : tout membre, étudiants compris, dès que la base le permet.
  // Un étudiant a le bouton en haut de la page : la section « Offres partagées » ne le répète pas en bas.
  const partager = store.peutOrigine?.() ? () => setCompose({ mode: 'partage' }) : null;
  const chiffre = demandes ? null : chiffreOffres(ctx);
  // Jusqu'à 410 px, le libellé se resserre (« Publier ») : le chiffre du sur-titre reste entier à côté ; le nom pour les
  // lecteurs d'écran reste le libellé complet, qui commence par le mot visible
  const pub = filtre === 'pfe' ? ['Déposer un sujet', 'Déposer'] : ['Publier une offre', 'Publier'];
  const bouton = demandes ? null
    : !isStudent ? html`<button class=${'btn primary' + (filtre === 'pfe' ? '' : ' publier-offre')} id="of-publier" aria-label=${pub[0]} onClick=${() => setCompose(presetDe(filtre))}><${Icon} name="plus"/> <span class="of-long">${pub[0]}</span><span class="of-court" aria-hidden="true">${pub[1]}</span></button>`
    : partager ? html`<button class="btn tonal" id="of-partager" onClick=${partager}><${Icon} name="share"/> Partager une offre</button>` : null;
  // Le titre ne bouge pas d'un onglet à l'autre : la place du sur-titre et celle du bouton restent gardées
  return html`<section class="page offres-page">
    <${EnTetePage} garderPlace titre=${demandes ? 'Demandes' : 'Offres'}
      surTitre=${chiffre ? (chiffre.vers ? html`<button type="button" class="of-chiffre" onClick=${() => (chiffre.vers.offre ? ctx.openOffer(chiffre.vers.offre) : choisir(chiffre.vers.filtre))}><${Compteur} v=${chiffre.v} format=${chiffre.f}/><${Icon} name="arrow" size=${14}/></button>`
        : html`<${Compteur} v=${chiffre.v} format=${chiffre.f}/>`) : demandes && !isStudent ? 'Par les étudiants' : null}
      action=${bouton || html`<span class="of-place" aria-hidden="true"></span>`}>
      ${avecDemandes ? html`<div class="of-onglets en-tete-onglets"><div class="seg seg-page offres-seg" role="tablist" aria-label="Offres ou demandes">
        <button role="tab" aria-selected=${!demandes} class=${demandes ? '' : 'on'} onClick=${() => go('offres', { remplacer: true })}>Offres</button>
        <button role="tab" aria-selected=${demandes} class=${demandes ? 'on' : ''} onClick=${() => go('offres/demandes', { remplacer: true })}>Demandes${nDem ? html` <span class="count">${nDem}</span>` : null}</button>
      </div></div>` : null}
    <//>
    ${demandes ? html`<${DemandesTab} ctx=${isStudent ? ctx : { ...ctx, publierOffre: () => setCompose({}) }}/>` : html`<${OfferList} ctx=${ctx} vu=${vu} filtre=${filtre} setFiltre=${choisir} onPropose=${() => setCompose(presetDe(filtre))} onPartager=${isStudent ? null : partager}/>`}
    ${compose ? html`<${OfferComposer} ctx=${ctx} preset=${compose} onClose=${() => setCompose(null)}/>` : null}
  </section>`;
}

// Ce que le membre a écrit lui-même (titre, entreprise, ville, message) porte translate="no" dir="auto" : jamais traduit.
const prenom = p => (p?.full_name || '').split(' ')[0];
// Raisons d'une recommandation : « Ta filière » est un texte de l'interface, le reste vient du profil (compétence, ville)
// Une seule raison en couleur (la filière) ; les autres restent neutres
const Pourquoi = ({ why }) => html`<span class="why">${why.map(w => (w === 'Ta filière' ? html`<span class="mini good">${w}</span>` : html`<span class="mini" translate="no" dir="auto">${w}</span>`))}</span>`;
const doux = () => (mouvementReduit() ? 'auto' : 'smooth');   // défilement doux, sauf en mouvement réduit (Socle)
// Une offre arrivée depuis la dernière visite : ouverte, d'un autre membre, publiée après
const arriveeDepuis = (o, me, vu) => !!vu && o.status === 'ouverte' && o.author_id !== me.id && new Date(o.created_at).getTime() > vu;

function OfferList({ ctx, vu, filtre, setFiltre, onPropose, onPartager }) {
  const { data, me, saison, openOffer, go } = ctx;
  const isStudent = me.role === 'etudiant';
  const niveau = niveauOf(me, saison);
  const myTypes = isStudent ? (OBJECTIFS[niveau]?.types || []) : Object.keys(TYPES);
  const [q, setQ] = useState('');
  const barre = useRef(), rangee = useRef();
  const colle = useCollee(barre);
  usePucesEntieres(rangee);
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
  // « Pour toi » passe en tête (3 à 6 grandes cartes) ; ses offres ne sont pas répétées dans la liste en dessous
  const avecReco = isStudent && plain && list.length > 5;
  const reco = avecReco ? choisirPourToi(recoFor(ctx, 6)) : [];
  const dejaVues = new Set(reco.map(x => x.o.id));
  const reste = avecReco ? list.filter(o => !dejaVues.has(o.id)) : list;
  // « Nouveau » : ce qui est arrivé depuis la dernière visite, puis le reste
  const nouveaux = f === 'miennes' || f === 'sauvees' ? [] : reste.filter(o => arriveeDepuis(o, me, vu));
  const anciens = nouveaux.length ? reste.filter(o => !nouveaux.includes(o)) : reste;
  const titreReste = avecReco && NIVEAUX[niveau]?.short ? `Les autres offres de ${NIVEAUX[niveau].short}` : 'Les autres offres';
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
  // La loupe de la rangée collée : retour en haut, le curseur dans la recherche
  // Une puce choisie : elle reste en vue dans sa rangée ; si la rangée est collée, la liste repart juste sous elle
  const filtrer = k => {
    setFiltre(k);
    requestAnimationFrame(() => {
      const r = rangee.current, b = barre.current, on = r?.querySelector('.chip.on');
      if (r && on) {
        const rr = r.getBoundingClientRect(), ro = on.getBoundingClientRect();
        if (ro.left < rr.left + 24 || ro.right > rr.right - 24) r.scrollBy({ left: (ro.left + ro.width / 2) - (rr.left + rr.width / 2), behavior: doux() });
      }
      const ancre = b?.previousElementSibling;
      if (b?.classList.contains('colle') && ancre) {
        const ecart = parseFloat(getComputedStyle(b.parentElement).rowGap) || 0, haut = parseFloat(getComputedStyle(b).top) || 0;
        scrollTo({ top: Math.max(0, scrollY + ancre.getBoundingClientRect().bottom + ecart - haut), behavior: doux() });
      }
    });
  };
  const chercher = () => { const c = document.getElementById('f-q'); if (!c) return; c.focus({ preventScroll: true }); scrollTo({ top: 0, behavior: doux() }); };
  const carte = (o, i) => html`<${OfferCard} key=${o.id} o=${o} ctx=${ctx} i=${i} sujets=${f === 'pfe'} onOpen=${() => openOffer(o.id)}/>`;

  return html`<div class="sub-page">
    <label class="search"><${Icon} name="search" size=${16}/><input id="f-q" type="search" enterkeyhint="search" placeholder="Entreprise, ville, filière…" aria-label="Rechercher une offre" value=${q} onInput=${e => setQ(e.target.value)}/></label>
    ${puces.length > 1 ? html`<div class=${'of-filtres' + (colle ? ' colle' : '')} ref=${barre}>
      <button type="button" class="of-loupe" aria-label="Rechercher une offre" onClick=${chercher}><${Icon} name="search" size=${18}/></button>
      <div class="chips offres-chips" role="group" aria-label="Filtrer les offres" ref=${rangee}>${puces.map(([k, l, ic], i) => html`${i === sep && sep > 1 ? html`<span class="chips-sep" aria-hidden="true"></span>` : null}<button class=${'chip' + (TYPES[k] ? ' t-' + k : '') + (f === k ? ' on' : '')} aria-pressed=${f === k} onClick=${() => filtrer(f === k && k !== 'tous' ? 'tous' : k)}>${ic ? html`<${Icon} name=${ic} size=${15}/>` : null}${l}</button>`)}</div>
    </div>` : null}
    ${reco.length ? html`<${PourToi} ctx=${ctx} reco=${reco} vu=${vu}/>` : null}
    ${nouveaux.length ? html`<div class="section-head of-nouveau"><h2>Nouveau <span class="of-depuis">depuis ta dernière visite</span></h2><span class="count">${nouveaux.length}</span></div>
      <div class="offer-grid">${nouveaux.map(carte)}</div>` : null}
    ${(avecReco || nouveaux.length) && anciens.length ? html`<div class="section-head"><h2>${titreReste}</h2><span class="count">${anciens.length}</span></div>` : null}
    <div class="offer-grid">
      ${anciens.length ? anciens.map((o, i) => carte(o, i + nouveaux.length))
        : nouveaux.length ? null : ctx.store.enAttente && !data.offers.length ? html`<${SqCartes}/>` : avecReco || partagees.length ? null : vide}
    </div>
    ${f === 'sauvees' ? null : html`<${SectionPartages} ctx=${ctx} list=${partagees} onPartager=${plain ? onPartager : null}/>`}
    <${MentionLogos} noms=${[...reste, ...reco.map(x => x.o), ...(f === 'sauvees' ? [] : partagees)].map(o => o.entreprise)}/>
  </div>`;
}

// Offres recommandées à un étudiant : sa filière, ses compétences retrouvées dans l'offre, sa ville
export function recoFor(ctx, max) {
  const { data, me, saison } = ctx;
  const n = niveauOf(me, saison);
  // Les partages (à postuler ailleurs) n'y sont pas ; une offre portée par un lauréat, qui encadre, passe devant
  return data.offers.filter(o => o.status === 'ouverte' && !estPartagee(o) && !forLaureats(o) && (o.annees || []).includes(n) && !data.applications.some(a => a.offer_id === o.id && a.student_id === me.id))
    .map(o => { const m = offerMatch(o, me); return { o, ...m, score: m.score + (estPortee(o) ? 3 : 0) }; }).sort((a, b) => b.score - a.score || new Date(b.o.created_at) - new Date(a.o.created_at)).slice(0, max);
}
// « Pour toi » : de 3 à 6 offres. Celles qui ont une vraie raison (sa filière, une compétence, sa ville, un lauréat qui
// encadre) ; s'il y en a moins de trois, les trois premières du classement.
const choisirPourToi = r => { const fortes = r.filter(x => x.why.length || estPortee(x.o)); return fortes.length >= 3 ? fortes : r.slice(0, 3); };

// « Pour toi » : une rangée de grandes cartes qui défile (Rangee du Socle), aimantée, flèches à la souris
function PourToi({ ctx, reco, vu }) {
  return html`<${Rangee} titre="Pour toi" sousTitre="Choisies d’après ta filière et ton profil" cls="reco pt-rangee">
    ${reco.map(({ o, why }, i) => html`<${CartePourToi} key=${o.id} o=${o} why=${why} ctx=${ctx} i=${i} nouveau=${arriveeDepuis(o, ctx.me, vu)}/>`)}
  <//>`;
}

// Une grande carte « Pour toi » : le logo en grand sur un voile aux couleurs de l'entreprise,
// le poste, l'entreprise et la ville, trois puces au plus, la raison vraie (« Ta filière »), puis qui la propose.
// Toute la carte ouvre la fiche (le logo et le titre y glissent) ; le marque-page reste à part, en haut.
function CartePourToi({ o, why, ctx, i, nouveau }) {
  const { data, me, store } = ctx;
  const author = store.byId('profiles', o.author_id);
  const saved = data.reactions.find(r => r.offer_id === o.id && r.user_id === me.id && r.kind === 'save');
  const dl = daysUntil(o.deadline);
  const urgent = o.status === 'ouverte' && dl !== null && dl >= 0 && dl <= 7;
  const lieu = lieuOffre(o);
  const coopt = peutPostulerA(o, me, ctx.saison) && !sujetPris(data, o) && !!author && store.voitChamp(author, 'travail') && peutRecommander(o, author);
  const pv = preuvesOffre(data, o, me);
  const tags = pucesOffre(o).slice(0, 3);
  const pop = Date.now() - (vientDeSauver.get(o.id) || 0) < 900;
  return html`<article class=${'pt-carte' + (estPortee(o) ? ' portee' : '')} style=${`${styleEntreprise(o.entreprise)};--i:${i}`}>
    <button type="button" class="pt-main" onClick=${e => ouvrirEnDouceur(e.currentTarget.closest('.pt-carte'), () => ctx.openOffer(o.id))} aria-label=${`Ouvrir : ${titreOffre(o)}`}>
      <span class="pt-voile" aria-hidden="true"></span>
      <span class="pt-corps">
        <span class="pt-tete"><${LogoEntreprise} nom=${o.entreprise} lien=${o.lien} taille=${60}/>${why.includes('Ta filière') ? html`<span class="pt-signal"><${Icon} name="check" size=${14}/>Ta filière</span>` : null}</span>
        <strong class="ocard-title" translate="no" dir="auto">${titreOffre(o)}</strong>
        <span class="ocard-meta"><span class="oc-ent"><bdi translate="no">${o.entreprise}</bdi></span>${lieu ? html`<span class="oc-lieu"><bdi translate="no">${lieu}</bdi></span>` : null}</span>
        <span class="ocard-tags">${tags}</span>
        <span class="pt-bas">
          ${pv.sauvees ? html`<span class="oc-preuve"><${Icon} name="bookmark" size=${16}/><span>${phraseSauvees(pv.sauvees, pv.public)}</span></span>` : null}
          ${author ? html`<span class=${'pt-visage' + (coopt ? ' coopt' : '')}><${Avatar} p=${author} size=${24}/>${coopt ? html`<span class="pt-qui">${`${prenom(author)} peut te recommander`}</span>` : html`<span class="pt-qui"><span>Proposée par</span> <span translate="no" dir="auto">${prenom(author)}</span></span>`}</span>` : null}
        </span>
      </span>
    </button>
    ${urgent ? html`<span class="tag urgent pt-coin">${dl === 0 ? 'Dernier jour' : `J-${dl}`}</span>` : nouveau ? html`<span class="tag nouvelle pt-coin">Nouveau</span>` : null}
    ${o.author_id !== me.id ? html`<${Garder} ctx=${ctx} o=${o} saved=${saved} pop=${pop} cls="pt-garder" taille=${18}/>` : null}
  </article>`;
}

// Les puces d'une offre, dans l'ordre : le type (toujours en tête), fermée, portée, entre lauréats, durée, rémunéré
function pucesOffre(o) {
  return [
    html`<span class=${'tag t-' + o.type} key="t"><${Icon} name=${TYPE_ICON[o.type]} size=${13}/>${TYPES[o.type]?.label}</span>`,
    o.status !== 'ouverte' ? html`<span class="tag done" key="d">${o.status === 'pourvue' ? 'Pourvue' : 'Fermée'}</span>` : null,
    estPortee(o) ? html`<${BadgePortee} key="p"/>` : null,
    forLaureats(o) ? html`<span class="tag entre" key="e">Entre lauréats</span>` : null,
    o.duree ? html`<span class="tag neutre" key="u"><${Icon} name="clock" size=${13}/><span translate="no" dir="auto">${o.duree}</span></span>` : null,
    o.remunere ? html`<span class="tag paye" key="r">Rémunéré</span>` : null,
  ].filter(Boolean);
}

// Le marque-page : il se remplit et fait un petit bond, avec une vibration légère (si l'appareil le permet)
const vientDeSauver = new Map();   // offre → moment où elle vient d'être mise de côté ici
function Garder({ ctx, o, saved, pop, cls = '', taille = 16 }) {
  const { me, store, act } = ctx;
  // La vibration attend que l'offre soit vraiment mise de côté (un vrai succès, jamais un échec)
  const sauver = () => {
    if (!saved) vientDeSauver.set(o.id, Date.now());
    act(async () => { if (saved) await store.remove('reactions', saved.id); else { await store.insert('reactions', { offer_id: o.id, user_id: me.id, kind: 'save', ...ecoleDuContenu(me, o) }); vibrer(10); } });
  };
  return html`<button type="button" class=${'icon-btn small ocard-garder ' + cls + (saved ? ' on' : '') + (saved && pop ? ' pop' : '')} aria-pressed=${!!saved} aria-label=${saved ? 'Ne plus mettre de côté' : 'Mettre de côté'} onClick=${sauver}><${Icon} name="bookmark" size=${taille}/></button>`;
}

// Carte d'une offre, compacte : toute la carte ouvre la fiche. Le logo, le poste (trois lignes au plus : un titre long
// reste lisible sur 360 px, « autoconsommation solaire » n'est pas coupé), puis
// « Entreprise · Ville · il y a 3 j » sur une ligne, trois puces sobres au plus, et ce qui est vrai autour (il peut te
// recommander, en vert ; mises de côté, candidatures pour son auteur). Un seul pied, sur une ligne : le visage du
// lauréat qui la partage (« Ton offre » pour la sienne), les réactions, Postuler (ou l'état), le marque-page.
// L'échéance proche (« J-4 », « بقي 4 أيام ») ouvre la rangée des puces : à côté du titre, elle lui prendrait sa largeur
// (en arabe à 360 px, un titre de trois lignes en demandait quatre).
export function OfferCard({ o, ctx, onOpen, why, sujets = false, i = 0 }) {
  // Une offre partagée (vue ailleurs) : la carte compacte, avec le lien vers le site d'origine
  if (estPartagee(o)) return html`<${PartageCard} o=${o} ctx=${ctx} onOpen=${onOpen} i=${i}/>`;
  const { data, me, store } = ctx;
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
  const lieu = lieuOffre(o);
  const urgent = o.status === 'ouverte' && dl !== null && dl >= 0 && dl <= 7;
  const pv = preuvesOffre(data, o, me);
  // Une seule preuve, vraie : ses candidatures pour l'auteur (jamais « 0 »), sinon combien l'ont mise de côté (2 au moins)
  const preuve = pv.candidatures ? ['inbox', phraseCandidatures(pv.candidatures)] : pv.sauvees ? ['bookmark', phraseSauvees(pv.sauvees, pv.public)] : null;
  const pop = Date.now() - (vientDeSauver.get(o.id) || 0) < 900;
  // « il y a 3 j » dit qu'elle est fraîche ; au-delà d'un mois, la date reste dans la fiche
  const quand = Date.now() - new Date(o.created_at) < 30 * 864e5 ? timeAgo(o.created_at) : null;
  // Où en est-on : sa candidature, un sujet pris ou libre
  const etat = myApp ? html`<span class=${'state-pill a-' + myApp.status}>${APP_STATUS[myApp.status]}</span>` : pris ? html`<span class="state-pill s-trouve">Pris</span>`
    : sujets && o.type === 'pfe' && !canApply && o.status === 'ouverte' && !mine ? html`<span class="state-pill s-recherche">Disponible</span>` : null;
  return html`<article class=${'ocard' + (o.status !== 'ouverte' ? ' closed' : '') + (estPortee(o) ? ' portee' : '')} style=${`${styleEntreprise(o.entreprise)};--i:${i}`}>
    <button class="ocard-main" onClick=${e => ouvrirEnDouceur(e.currentTarget.closest('.ocard'), onOpen)} aria-label=${`Ouvrir : ${titreOffre(o)}`}>
      <span class="oc-tete">
        <${LogoEntreprise} nom=${o.entreprise} lien=${o.lien} taille=${44}/>
        <span class="oc-corps">
          <strong class="ocard-title" translate="no" dir="auto">${titreOffre(o)}</strong>
          <span class="ocard-meta"><span class="oc-ent"><bdi translate="no">${o.entreprise}</bdi></span>${lieu ? html`<span class="oc-lieu"><bdi translate="no">${lieu}</bdi></span>` : null}${quand ? html`<span class="oc-quand">${quand}</span>` : null}</span>
        </span>
      </span>
      <span class="ocard-tags">${urgent ? html`<span class="tag urgent oc-echeance" key="echeance">${dl === 0 ? 'Dernier jour' : `J-${dl}`}</span>` : null}${pucesOffre(o).slice(0, 3)}</span>
      ${why?.length ? html`<${Pourquoi} why=${why}/>` : null}
      ${coopt ? html`<span class="oc-preuve oa-coopt"><${Icon} name="thumb" size=${16}/><span>${`${prenom(author)} peut te recommander`}</span></span>` : null}
      ${preuve ? html`<span class="oc-preuve"><${Icon} name=${preuve[0]} size=${16}/><span>${preuve[1]}</span></span>` : null}
    </button>
    <footer class="ocard-foot">
      ${author ? html`<span class=${'ocard-author' + (coopt ? ' coopt' : '')}><${Avatar} p=${author} size=${28}/><span class="oa-txt"><span class="oa-nom">${mine ? html`<span>Ton offre</span>` : html`<span translate="no" dir="auto">${prenom(author)}</span><span class="oa-promo">${`promo ${author.promo}`}</span>`}</span></span></span>` : html`<span class="spacer"></span>`}
      <${Reactions} ctx=${ctx} cible=${{ offer_id: o.id }} cls="ocard-rx" court/>
      ${etat}
      ${canApply ? html`<button class="btn tiny tonal ocard-apply" onClick=${() => ctx.openOffer(o.id, true)}>Postuler</button>` : null}
      ${!mine ? html`<${Garder} ctx=${ctx} o=${o} saved=${saved} pop=${pop}/>` : null}
    </footer>
  </article>`;
}

// « Proposée par » : le visage, le nom, ce qu'il fait ; puis ce qui compte pour qui postule (il répond ici, ou il peut recommander)
function AuteurOffre({ ctx, o, author, candidat }) {
  const coopt = candidat && o.status === 'ouverte' && ctx.store.voitChamp(author, 'travail') && peutRecommander(o, author);
  const note = !candidat ? null : coopt ? `${prenom(author)} peut te recommander` : 'Reçoit ta candidature et te répond ici';
  return html`<button type="button" class=${'od-author' + (coopt ? ' coopt' : '')} onClick=${() => ctx.openProfile(author)}>
    <${Avatar} p=${author} size=${52}/>
    <span class="od-author-txt">
      <span class="od-author-line"><span translate="no" dir="auto">${author.full_name}</span><${Bouclier} p=${author}/></span>
      <${RoleLine} p=${author} score=${ctx.scores.get(author.id)}/>
      ${note ? html`<span class="od-author-note"><${Icon} name=${coopt ? 'check' : 'chat'} size=${14}/><span>${note}</span></span>` : null}
    </span>
    <span class="od-author-ico" aria-hidden="true"><${Icon} name="arrow" size=${16}/></span>
  </button>`;
}

// Le titre de la fenêtre flotte sur les couleurs de l'entreprise, puis se pose en verre dès que la fiche défile
function useHautEnVerre(ref, deps) {
  useEffect(() => {
    const m = ref.current?.closest('.modal');
    if (!m) return;
    let raf = 0;
    const regler = () => { raf = 0; m.classList.toggle('defile', m.scrollTop > 6); };
    const bientot = () => { raf ||= requestAnimationFrame(regler); };
    m.addEventListener('scroll', bientot, { passive: true });
    regler();
    return () => { cancelAnimationFrame(raf); m.removeEventListener('scroll', bientot); };
  }, deps);
}

const TITRE_DESC = { pfe: 'Le sujet', emploi: 'Le poste' };

// Fiche complète d'une offre. Téléphone : une feuille qui monte du bas ; grand écran : un panneau à côté de la liste.
// En haut, les couleurs de l'entreprise derrière le logo, le poste et l'entreprise ; puis les faits en tuiles, la
// description, qui la propose. « Postuler » reste collé en bas, et devient une coche quand la candidature part.
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
  const [envoyee, setEnvoyee] = useState(false); // la candidature vient de partir d'ici : la coche se dessine
  const [pop, setPop] = useState(false); // le marque-page vient d'être posé : il fait un petit bond
  const racine = useRef();
  useHautEnVerre(racine, [!!o, edit]);
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
  const toggleSave = () => {
    if (!saved) setPop(true);
    act(async () => { if (saved) await store.remove('reactions', saved.id); else { await store.insert('reactions', { offer_id: o.id, user_id: me.id, kind: 'save', ...ecoleDuContenu(me, o) }); vibrer(10); } });
  };
  const dl = o.deadline ? new Date(o.deadline + 'T12:00:00') : null;
  const jours = daysUntil(o.deadline);
  const urgent = o.status === 'ouverte' && jours !== null && jours >= 0 && jours <= 7;
  const dateTxt = dl ? dl.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', ...(dl.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) }) : '';
  const lieu = lieuOffre(o);
  // À qui elle s'adresse : chaque morceau reste entier (« GE-MCI » ne se coupe pas) ; le point qui les sépare est porté par
  // le morceau suivant, dans une marge masquée : aucune ligne ne commence ni ne finit par « · » (comme la méta des cartes)
  const pour = forLaureats(o) ? ['Lauréats'] : [...(o.annees || []).map(a => NIVEAUX[a]?.short).filter(Boolean), ...(o.filieres?.length ? resumeFilieres(o.filieres) : ['toutes filières'])];
  // Les faits en tuiles : ce qu'on regarde d'abord (durée, lieu, rémunéré, date limite), puis à qui elle s'adresse.
  // Le type n'a sa tuile que si le titre de la fenêtre ne le dit pas déjà (« Projet de fin d'études », « Stage à l'étranger »…) :
  // une offre partagée ou entre lauréats.
  const titreDitType = !partage && !forLaureats(o) && !!TYPES[o.type]?.long;
  const faits = [
    titreDitType ? null : ['Type', TYPE_ICON[o.type] || 'briefcase', TYPES[o.type]?.label || 'Offre'],
    o.duree ? ['Durée', 'clock', html`<span translate="no" dir="auto">${o.duree}</span>`] : null,
    lieu ? ['Lieu', 'pin', html`<span translate="no" dir="auto">${lieu}</span>`] : null,
    o.remunere ? ['Rémunéré', 'remunere', 'Oui'] : null,
    dl ? ['Date limite', 'calendar', dateTxt, urgent] : null,
    ['Pour', 'people', html`<span class="od-pour">${pour.map(x => html`<span key=${x} class=${/\s/.test(x) ? null : 'od-entier'}>${x}</span>`)}</span>`],
  ].filter(Boolean);
  // Sous le titre, seulement ce qui est vrai et utile : fermée, l'échéance proche, sa filière, un lauréat qui encadre
  const saFiliere = candidat && o.status === 'ouverte' && !forLaureats(o) && offerMatch(o, me).why.includes('Ta filière');
  const signaux = [
    o.status !== 'ouverte' ? html`<span class="tag done" key="s">${o.status === 'pourvue' ? 'Pourvue' : 'Fermée'}</span>` : null,
    urgent ? html`<span class="tag urgent" key="u"><${Icon} name="clock" size=${13}/>${jours === 0 ? 'Dernier jour' : `J-${jours}`}</span>` : null,
    saFiliere ? html`<span class="od-signal" key="f"><${Icon} name="check" size=${14}/>Ta filière</span>` : null,
    estPortee(o) ? html`<${BadgePortee} key="p"/>` : null,
  ].filter(Boolean);
  const auteurNom = prenom(author) || 'Le lauréat';

  // Pied collé : garder l'offre et postuler ; une fois la candidature partie, une coche et la suite
  const saveBtn = html`<button type="button" key="garder" class=${'icon-btn od-save' + (saved ? ' on' : '') + (pop ? ' pop' : '')} aria-pressed=${!!saved} aria-label=${saved ? 'Ne plus mettre de côté' : 'Mettre de côté'} title=${saved ? 'Ne plus mettre de côté' : 'Mettre de côté'} onClick=${toggleSave} onAnimationEnd=${() => setPop(false)}><${Icon} name="bookmark" size=${20}/></button>`;
  let footer = null;
  if (partage && tab === 'offre') footer = html`<${PiedPartage} o=${o}/>`;
  if (candidat && tab === 'offre') {
    if (myApp) {
      const pl = myApp.status === 'retenu' ? placementOf(data, me.id, ctx.saison) : null;
      const suite = { postule: `${auteurNom} te répond ici`, entretien: 'Bonne préparation pour l’entretien !', retenu: pl?.status === 'en_attente' ? 'Confirme ton recrutement dans « Mon parcours ».' : 'Bravo !' }[myApp.status];
      const porte = myApp.status === 'refuse' ? porteApresRefus(data, me, ctx.saison) : null;
      footer = myApp.status === 'postule'
        ? html`<div class=${'od-foot od-envoyee' + (envoyee ? ' vient' : '')}><${Coche} taille=${38} pose=${!envoyee}/><span class="od-foot-txt"><strong>Candidature envoyée</strong><span class="small muted">${suite}</span></span></div>`
        : html`<div class="od-foot"><span class=${'state-pill a-' + myApp.status}>${APP_STATUS[myApp.status]}</span><span class="small muted od-foot-txt">${porte ? porte.phrase : suite}</span>
        ${myApp.status === 'retenu' && pl?.status === 'en_attente' ? html`<button type="button" class="btn small" onClick=${() => { onClose(); ctx.go('parcours'); }}>Mon parcours</button>` : null}
        ${porte ? html`<button type="button" id="od-porte" class="btn small" onClick=${() => { onClose(); if (porte.conseil) ctx.askHelp(); else ctx.go(porte.to); }}>${porte.cta}</button>` : null}</div>`;
    } else if (o.status !== 'ouverte') footer = html`<div class="od-foot"><span class="small muted od-foot-txt">Cette offre n’accepte plus de candidatures.</span>${saveBtn}</div>`;
    // Des clés distinctes : « Envoyer » est un nouveau bouton, jamais « Postuler » recyclé (le même clic l'enverrait aussitôt)
    else if (form) footer = html`<div class="od-foot"><button type="button" key="annuler" class="btn ghost" onClick=${() => setForm(false)}>Annuler</button><button key="envoyer" class="btn primary" type="submit" form=${'apply-' + o.id}><${Icon} name="send" size=${16}/> Envoyer ma candidature</button></div>`;
    else footer = html`<div class="od-foot">${saveBtn}<button type="button" key="postuler" class="btn primary od-postuler" onClick=${() => setForm(true)}><${Icon} name="send" size=${16}/> Postuler</button></div>`;
  }

  return html`<${Modal} title=${partage ? 'Offre partagée' : forLaureats(o) ? 'Offre entre lauréats' : TYPES[o.type]?.long || 'Offre'} onClose=${onClose} wide cls="fiche-offre" footer=${footer}>
    <div class="detail od" ref=${racine} style=${styleEntreprise(o.entreprise)}>
      <div class="od-hero">
        <span class="od-voile" aria-hidden="true"></span>
        <div class="detail-head">
          <${LogoEntreprise} nom=${o.entreprise} lien=${o.lien} taille=${64}/>
          <span class="od-outils">
            ${o.status === 'ouverte' ? html`<${PartagerWhatsApp} id="od-partage" texte=${texteOffre(o, ctx)}/>` : null}
            ${!mine && !isAdmin ? html`<${SignalerBtn} ctx=${ctx} type="offre" id=${o.id} small/>` : null}
            ${(mine || isAdmin) ? html`<div class="menu-wrap"><button class="icon-btn" aria-label="Gérer l’offre" aria-expanded=${menu} onClick=${() => setMenu(!menu)}><${Icon} name="more"/></button>
              ${menu ? html`<div class="menu-pop">
                ${mine ? html`<button onClick=${() => { setMenu(false); setEdit(true); }}><${Icon} name="edit" size=${16}/> Modifier</button>` : null}
                <button onClick=${() => { setMenu(false); act(() => store.update('offers', o.id, { status: o.status === 'ouverte' ? (partage ? 'fermee' : 'pourvue') : 'ouverte' })); }}><${Icon} name="check" size=${16}/> ${o.status === 'ouverte' ? (partage ? 'Fermer le partage' : 'Marquer pourvue') : 'Rouvrir l’offre'}</button>
                <button class="danger-t" onClick=${() => { setMenu(false); ctx.confirm('Supprimer définitivement cette offre ?', () => act(async () => { await store.remove('offers', o.id); onClose(); })); }}><${Icon} name="trash" size=${16}/> Supprimer</button>
              </div>` : null}</div>` : null}
          </span>
        </div>
        <div class="detail-title">
          <h2 translate="no" dir="auto">${titreOffre(o)}</h2>
          <p class="od-sub"><button type="button" class="linkish od-ent" onClick=${() => { onClose(); ctx.openEntreprise?.(o.entreprise); }}><span translate="no" dir="auto">${o.entreprise}</span></button><span class="od-dot" aria-hidden="true">·</span><span class="od-quand">Publiée ${timeAgo(o.created_at)}</span></p>
        </div>
        ${signaux.length ? html`<div class="od-signaux">${signaux}</div>` : null}
      </div>
      ${partage && tab === 'offre' ? html`<${NotePartage} o=${o} auteur=${author} moi=${mine}/>` : null}
      <${RelanceBanner} ctx=${ctx} o=${o}/>
      ${mine && !partage ? html`<div class="seg od-onglets" role="tablist" aria-label="Mon offre">${[['candidats', `Candidats (${apps.length})`], ['offre', 'L’offre'], ['questions', `Questions (${comments.length})`]].map(([k, l]) => html`<button role="tab" aria-selected=${tab === k} class=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}>${l}</button>`)}</div>` : null}

      ${tab === 'candidats' && mine ? html`<${Candidates} ctx=${ctx} o=${o} apps=${apps}/>` : null}

      ${tab === 'offre' ? html`
        <dl class="od-facts">${faits.map(([k, i, v, chaud]) => html`<div class=${chaud ? 'urgent' : ''}><dt><span class="od-fait-ico" aria-hidden="true"><${Icon} name=${i} size=${17}/></span>${k}</dt><dd>${v}</dd></div>`)}</dl>
        <${EntrepriseResume} ctx=${ctx} entreprise=${o.entreprise} onOpen=${onClose}/>
        <div class="od-bloc od-desc">
          <h3>${partage ? 'L’annonce' : TITRE_DESC[o.type] || 'La mission'}</h3>
          <div class="prose"><p translate="no" dir="auto">${o.description}</p></div>
          ${o.lien && !partage ? html`<a class="od-lien" href=${o.lien.startsWith('http') ? o.lien : 'https://' + o.lien} target="_blank" rel="noopener"><${Icon} name="link" size=${15}/> Voir l’annonce complète</a>` : null}
        </div>
        ${author && !mine ? html`<div class="od-bloc od-par">
          <h3>${partage ? 'Partagée par' : 'Proposée par'}</h3>
          <${AuteurOffre} ctx=${ctx} o=${o} author=${author} candidat=${candidat}/>
          ${estPortee(o) ? html`<${EngagementPortee} auteur=${author}/>` : null}
        </div>` : estPortee(o) ? html`<${EngagementPortee} auteur=${author}/>` : null}
        ${candidat ? html`<${ApplyBox} ctx=${ctx} o=${o} form=${form} setForm=${setForm} onClose=${onClose} onEnvoyee=${() => { setEnvoyee(true); vibrer(12); }}/>` : null}
        <${Reactions} ctx=${ctx} cible=${{ offer_id: o.id }} cls="od-rx" court/>
        ${!mine || partage ? html`<${Questions} ctx=${ctx} o=${o} comments=${comments}/>` : null}` : null}

      ${tab === 'questions' && mine ? html`<${Questions} ctx=${ctx} o=${o} comments=${comments}/>` : null}
    </div>
  <//>`;
}

// Côté étudiant : écrire sa candidature (le bouton d'envoi est dans le pied de la fiche), puis suivre le statut
function ApplyBox({ ctx, o, form, setForm, onClose, onEnvoyee }) {
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
      onEnvoyee?.();
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
      await store.update('applications', app.id, { status: ['postule', 'entretien', 'refuse'].includes(avant) ? avant : 'postule', updated_at: new Date().toISOString() });
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
      if (app) { if (app.status !== 'retenu') statutAvant.garder(app.id, app.status); await store.update('applications', app.id, { status: 'retenu', updated_at: new Date().toISOString() }); }
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
            ${[['postule', 'Reçue'], ['entretien', 'Entretien'], ...(entre ? [['retenu', 'Retenue']] : []), ['refuse', 'Pas retenue']].map(([k, l]) => html`<button type="button" data-s=${k} class=${a.status === k ? 'on' : ''} aria-pressed=${a.status === k ? 'true' : 'false'} onClick=${() => act(() => store.update('applications', a.id, { status: k, updated_at: new Date().toISOString() }))}>${l}</button>`)}
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
  // Une ligne par profil : le visage et le nom en entier, puis la raison et l'invitation (tonale : elle se répète)
  return html`<section class="matching" aria-labelledby=${'match-' + o.id}><h3 id=${'match-' + o.id} class="matching-titre"><${Icon} name="spark" size=${16}/> Profils qui correspondent à ton offre</h3>
    <ul class="people-list">${list.map(({ p, why }) => html`<li key=${p.id}><${Person} p=${p} onOpen=${openProfile} size=${40}/>${why.length ? html`<${Pourquoi} why=${why}/>` : html`<span class="spacer"></span>`}
      ${invited(p.id) ? html`<span class="state-pill s-validation">Invitation envoyée</span>` : html`<button type="button" class="btn small tonal" onClick=${() => invite(p)}><${Icon} name="send" size=${14}/> Inviter à postuler</button>`}</li>`)}</ul></section>`;
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

// Questions publiques : le titre dit déjà que tout le monde les voit ; le champ garde une invite courte, entière à 360 px
function Questions({ ctx, o, comments }) {
  const { store, me, act, openProfile } = ctx;
  const [txt, setTxt] = useState('');
  const sorted = [...comments].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return html`<div class="comments">
    <h3>Questions publiques <span class="count">${comments.length}</span></h3>
    ${sorted.map(c => { const a = store.byId('profiles', c.author_id); return html`<div class="comment" key=${c.id}>
      <${Avatar} p=${a} size=${28}/>
      <div class="comment-body"><button class="linkish" onClick=${() => openProfile(a)}>${a ? html`<span translate="no" dir="auto">${a.full_name}</span>` : 'Membre'}</button>${a?.id === o.author_id ? html` <span class="mini">Auteur de l’offre</span>` : null} <span class="muted small q-quand">${timeAgo(c.created_at)}</span><p translate="no" dir="auto">${c.body}</p></div>
      ${(c.author_id === me.id || me.role === 'admin') ? html`<button class="icon-btn small" aria-label="Supprimer" onClick=${() => act(() => store.remove('comments', c.id))}><${Icon} name="x" size=${14}/></button>` : html`<${SignalerBtn} ctx=${ctx} type="commentaire" id=${c.id} small/>`}
    </div>`; })}
    <form class="comment-form" onSubmit=${e => { e.preventDefault(); if (!txt.trim()) return; act(async () => { await store.insert('comments', { offer_id: o.id, author_id: me.id, body: txt.trim() }); setTxt(''); }); }}>
      <input id=${'c-' + o.id} aria-label=${o.author_id === me.id ? 'Ta réponse' : 'Ta question sur l’offre'} placeholder=${o.author_id === me.id ? 'Répondre…' : 'Pose ta question…'} value=${txt} onInput=${e => setTxt(e.target.value)} maxlength="1500"/>
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
          action: neuve?.id ? { label: 'Partager sur WhatsApp', icon: 'share', onClick: () => window.open(lienWhatsApp(texteOffre(neuve, ctx)), '_blank', 'noopener') } : null,
        });
        if (partage) toast('Offre partagée. Elle apparaît dans « Offres partagées », avec son lien.', 'envoi');
        else {
          // L'offre d'un lauréat attend ses candidatures (et l'intérêt des étudiants, dans Match) : « Me prévenir » remplace le
          // petit mot, juste après la fête s'il y en a une ; la fenêtre se ferme d'abord
          const mot = entre ? 'Offre publiée. Les lauréats la voient dans « Entre lauréats ».' : 'Offre publiée. Les étudiants concernés la voient dans leurs offres.';
          const raison = me.role === 'laureat' ? (entre ? 'offreLaureats' : 'offre') : null;
          onClose();
          if (fete) { if (raison) proposerPrevenir(raison); } else if (!raison || !proposerPrevenir(raison, mot)) toast(mot, 'envoi');
          return;
        }
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
injectCSS('offres-liste', `
/* ---------- En-tête : un chiffre en sur-titre, le titre et le seul bouton plein sur une ligne, le segment dessous ---------- */
.offres-page .en-tete { row-gap: .85rem; }
.offres-page .en-tete-txt { flex: 1 1 0; }
.offres-page .en-tete-act { min-height: 44px; }
.offres-page .en-tete-act .btn { flex: none; width: auto; min-height: 44px; }
/* Le libellé court du bouton (« Publier ») sur un téléphone : le chiffre du sur-titre (« 12 candidatures à traiter → »)
   garde sa place, entier, jusqu'à 410 px ; au-delà, le libellé complet */
.offres-page .of-court { display: none; }
@media (max-width: 410px) { .offres-page .of-long { display: none; } .offres-page .of-court { display: inline; } }
/* Le chiffre est un lien vers les candidatures : rien ne rogne ni son texte ni sa cible au doigt (44 px de haut) */
.offres-page .en-tete .eyebrow:has(> .of-chiffre) { overflow: visible; }
.of-chiffre { display: inline-flex; align-items: center; gap: .3rem; max-width: 100%; padding: 0; border: 0; background: none; color: inherit; font: inherit; cursor: pointer; text-align: start; }
.of-chiffre > .compteur { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.of-chiffre > svg { flex: none; transition: transform .2s var(--ease); }
.of-chiffre:hover { text-decoration: underline; text-underline-offset: 3px; }
.of-chiffre:hover > svg { transform: translateX(2px); }
[dir="rtl"] .of-chiffre > svg { transform: scaleX(-1); }
[dir="rtl"] .of-chiffre:hover > svg { transform: scaleX(-1) translateX(2px); }
@media (pointer: coarse) { .of-chiffre { position: relative; } .of-chiffre::after { content: ""; position: absolute; inset: -14px -8px; } }
@media (prefers-reduced-motion: reduce) { .of-chiffre > svg { transition: none; } }
.of-place { display: block; width: 0; height: 44px; }
/* Le segment Offres | Demandes : le dessin commun des onglets de page (.seg-page, ui.js) */
.offres-chips .chip.on { background: var(--sel-bg); color: var(--sel-ink); border-color: transparent; box-shadow: inset 0 0 0 1px var(--sel-ring); font-weight: 600; }

/* ---------- Recherche : une pastille douce, l'anneau de focus autour de toute la pastille ---------- */
.offres-page .sub-page > .search { min-height: 46px; padding-inline: 1rem .5rem; border-radius: var(--r-pill); border-color: transparent; background: var(--surface); box-shadow: var(--sh1); }
.offres-page .sub-page > .search:focus-within { border-color: var(--accent); box-shadow: var(--anneau-focus); }
.offres-page .sub-page > .search input { min-height: 44px; border: 0; box-shadow: none; background: transparent; }

/* ---------- Une seule rangée de puces, collée sous la barre du haut en défilant (fond de verre une fois collée) ---------- */
.offres-chips { flex-wrap: nowrap; align-items: center; overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain; padding-block: 3px; }
.offres-chips::-webkit-scrollbar { display: none; }
.offres-chips .chip { flex: none; white-space: nowrap; min-height: 36px; }
.offres-chips .chip.on svg { color: var(--c, currentColor); }
.chips-sep { flex: none; width: 1px; height: 22px; background: var(--line); margin-inline: .15rem; }
@media (max-width: 760px) { .offres-chips { margin-inline: -16px; padding-inline: 16px; scroll-padding-inline: 16px; } }
/* Jamais un mot coupé : le fondu se pose sur la puce coupée (usePucesEntieres, demandes.js) ; sans mesure, celui du Socle */
.offres-chips:is(.fondu-debut, .fondu-fin) { --m-cd: 0px; --m-rd: 0px; --m-cf: 0px; --m-rf: 0px;
  -webkit-mask-image: linear-gradient(var(--fondu-sens), transparent 0, transparent var(--m-cd), #000 calc(var(--m-cd) + var(--m-rd)), #000 calc(100% - var(--m-cf) - var(--m-rf)), transparent calc(100% - var(--m-cf)), transparent 100%);
  mask-image: linear-gradient(var(--fondu-sens), transparent 0, transparent var(--m-cd), #000 calc(var(--m-cd) + var(--m-rd)), #000 calc(100% - var(--m-cf) - var(--m-rf)), transparent calc(100% - var(--m-cf)), transparent 100%); }
.offres-chips.fondu-debut { --m-cd: var(--of-cache-d, 0px); --m-rd: var(--of-rampe-d, 2.25rem); }
.offres-chips.fondu-fin { --m-cf: var(--of-cache-f, 0px); --m-rf: var(--of-rampe-f, 2.25rem); }
.of-filtres { position: sticky; top: calc(env(safe-area-inset-top, 0px) + var(--of-haut, 56px)); z-index: 6; display: flex; align-items: center; isolation: isolate; margin-block: -.4rem; padding-block: .4rem; }
.of-filtres::before { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: 0; transition: opacity .2s ease;
  background: var(--verre); -webkit-backdrop-filter: saturate(1.6) blur(16px); backdrop-filter: saturate(1.6) blur(16px); box-shadow: 0 1px 0 var(--filet-verre); }
.of-filtres.colle::before { opacity: 1; }
.of-filtres > .offres-chips { flex: 1 1 auto; min-width: 0; }
/* La loupe paraît quand la rangée se colle : elle ramène à la recherche */
.of-loupe { position: relative; flex: none; display: grid; place-items: center; width: 0; height: 38px; margin: 0; padding: 0; border: 0; border-radius: 50%; overflow: hidden;
  background: var(--surface); box-shadow: var(--sh1); color: var(--ink-2); cursor: pointer; opacity: 0; visibility: hidden;
  transition: width .24s var(--ease), margin .24s var(--ease), opacity .16s ease, visibility 0s linear .24s; }
.of-filtres.colle .of-loupe { width: 38px; overflow: visible; opacity: 1; visibility: visible; transition: width .24s var(--ease), margin .24s var(--ease), opacity .2s ease .06s, visibility 0s; }
.of-loupe:hover { color: var(--ink); box-shadow: var(--sh2); }
.of-loupe:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (pointer: coarse) { .of-loupe::after { content: ""; position: absolute; inset: -4px; } }
@media (max-width: 760px) {
  .of-filtres { margin-inline: -16px; }
  .of-filtres > .offres-chips { margin-inline: 0; }
  .of-filtres.colle .of-loupe { margin-inline-start: 16px; }
  .of-filtres.colle > .offres-chips { padding-inline-start: 8px; scroll-padding-inline-start: 8px; }
}
@media (min-width: 761px) {
  .of-filtres { top: calc(env(safe-area-inset-top, 0px) + var(--of-haut, 60px) + 8px); margin-inline: -10px; padding-inline: 10px; }
  .of-filtres::before { border-radius: var(--r-pill); background: color-mix(in srgb, var(--surface) 86%, transparent); box-shadow: var(--sh2); }
  .of-filtres.colle .of-loupe { margin-inline-end: 8px; }
}
@media (prefers-reduced-motion: reduce) { .of-filtres::before, .of-loupe, .of-filtres.colle .of-loupe { transition: none; } }

/* ---------- Titres des parties : « Pour toi », « Nouveau depuis ta dernière visite », « Les autres offres de 5A » ---------- */
.offres-page .sub-page > .section-head h2 { font: 750 var(--fs-5)/1.25 var(--f-display); letter-spacing: -.015em; }
.of-nouveau h2 { display: flex; align-items: baseline; flex-wrap: wrap; gap: .1rem .5rem; }
.of-nouveau h2::before { content: ""; align-self: center; flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.of-depuis { font: 500 var(--fs-2)/1.3 var(--f-body); letter-spacing: 0; color: var(--muted); }
.offres-page .offer-grid + .section-head { margin-top: 1rem; }

/* ---------- « Pour toi » : de grandes cartes qui défilent ---------- */
.pt-rangee { --rangee-l: min(84%, 19.5rem); --rangee-gap: .8rem; }
.pt-rangee .rangee-cartes { padding-block: 4px 16px; margin-block: -4px -16px; }
/* Le voile : trois lueurs douces de la teinte de l'entreprise (et de ses voisines) sur un fond clair, plus sombres la nuit */
.pt-carte { position: relative; display: flex; min-width: 0; border-radius: var(--r-xl); background: var(--surface); box-shadow: var(--sh1); overflow: hidden; isolation: isolate;
  --v-fond: hsl(var(--h, 205) calc(var(--s, 50%) * .8) 95%); --v-1: hsl(var(--h, 205) calc(var(--s, 50%) + 14%) 81%);
  --v-2: hsl(calc(var(--h, 205) + 38) calc(var(--s, 50%) + 6%) 86%); --v-3: hsl(calc(var(--h, 205) - 28) var(--s, 50%) 88%); }
:root[data-theme="dark"] .pt-carte { --v-fond: hsl(var(--h, 205) 22% 15%); --v-1: hsl(var(--h, 205) 42% 30%); --v-2: hsl(calc(var(--h, 205) + 38) 34% 25%); --v-3: hsl(calc(var(--h, 205) - 28) 32% 21%); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .pt-carte { --v-fond: hsl(var(--h, 205) 22% 15%); --v-1: hsl(var(--h, 205) 42% 30%); --v-2: hsl(calc(var(--h, 205) + 38) 34% 25%); --v-3: hsl(calc(var(--h, 205) - 28) 32% 21%); } }
.pt-main { flex: 1; display: flex; flex-direction: column; min-width: 0; padding: 0; border: 0; border-radius: inherit; background: none; color: inherit; font: inherit; text-align: start; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.pt-main:focus-visible { outline: none; }
.pt-carte:has(> .pt-main:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
.pt-voile { position: relative; display: block; flex: none; height: 96px; overflow: hidden;
  background: radial-gradient(65% 95% at 14% 12%, var(--v-1), transparent 72%), radial-gradient(55% 110% at 90% 0%, var(--v-2), transparent 70%),
    radial-gradient(70% 90% at 62% 125%, var(--v-3), transparent 72%), var(--v-fond); }
[dir="rtl"] .pt-voile { transform: scaleX(-1); }
.pt-corps { flex: 1; display: flex; flex-direction: column; gap: .35rem; min-width: 0; padding: 0 1.05rem 1rem; }
.pt-tete { display: flex; align-items: flex-end; justify-content: space-between; gap: .6rem; min-width: 0; margin: -32px 0 .3rem; }
.pt-tete > .clogo { position: relative; border-radius: 18px; box-shadow: 0 0 0 3px var(--surface), 0 8px 18px -8px rgb(10 20 40 / .35); }
.pt-signal { display: inline-flex; align-items: center; gap: .3rem; flex: none; min-height: 26px; padding: 0 .6rem 0 .45rem; border-radius: var(--r-pill); background: var(--good-soft); color: var(--good); font-size: var(--fs-2); font-weight: 650; }
.pt-carte .ocard-title { font: 700 var(--fs-5)/1.25 var(--f-display); letter-spacing: -.015em; color: var(--ink); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; text-wrap: balance; }
.pt-carte .ocard-tags { display: flex; flex-wrap: wrap; gap: .3rem; margin-top: .25rem; }
.pt-carte .ocard-tags { margin-bottom: .45rem; }
.pt-bas { margin-top: auto; display: flex; flex-direction: column; gap: .45rem; }
.pt-bas:not(:empty) { padding-top: .7rem; border-top: 1px solid var(--line); }
.pt-visage { display: flex; align-items: center; gap: .45rem; min-width: 0; font-size: var(--fs-2); color: var(--ink-2); }
.pt-visage .avatar { flex: none; }
.pt-visage.coopt { color: var(--good); font-weight: 600; }
.pt-qui { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pt-coin { position: absolute; top: .75rem; inset-inline-start: .8rem; z-index: 1; box-shadow: 0 1px 2px rgb(16 32 64 / .08); }
.pt-carte .pt-garder { position: absolute; top: .55rem; inset-inline-end: .55rem; z-index: 1; width: 40px; height: 40px; border-radius: 50%; color: var(--ink-2);
  background: color-mix(in srgb, var(--surface) 80%, transparent); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); box-shadow: 0 1px 3px rgb(16 32 64 / .1); }
.pt-carte .pt-garder:hover { color: var(--ink); background: var(--surface); }
.pt-carte .pt-garder.on { color: var(--sel-ink); background: var(--sel-bg); }
.pt-carte { transition: transform .22s var(--ease), box-shadow .22s ease; }
.pt-carte:has(> .pt-main:active) { transform: scale(.985); transition-duration: .08s; }
@media (hover: hover) and (pointer: fine) { .pt-carte:hover { transform: translateY(-2px); box-shadow: var(--sh2); } }
@media (prefers-reduced-motion: reduce) { .pt-carte, .pt-carte:hover, .pt-carte:has(> .pt-main:active) { transform: none; transition: none; } }

/* ---------- La liste : des cartes compactes ---------- */
.offer-grid { gap: .65rem; }
.ocard-main { gap: .5rem; padding: .85rem .9rem .55rem; }
.ocard .oc-tete { align-items: flex-start; gap: .75rem; }
.oc-corps { flex: 1; display: flex; flex-direction: column; gap: .2rem; min-width: 0; }
.ocard .ocard-title { font: 700 var(--fs-4)/1.3 var(--f-display); letter-spacing: -.01em; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; text-wrap: pretty; }
/* L'entreprise et le lieu en entier (« Airbus Operations · Toulouse, France ») : la ligne passe à la suivante
   plutôt que de couper un nom. Chaque morceau porte son point devant lui et la ligne commence 1em plus tôt,
   dans une marge masquée : aucune ligne ne commence par « · ». Le nom, isolé (bdi), garde son sens de lecture. */
:is(.ocard, .pt-carte) .ocard-meta { display: flex; flex-flow: row wrap; align-items: baseline; gap: 0; min-width: 0; margin-inline-start: -1em;
  clip-path: inset(-3px -3px -3px 1em); font-size: var(--fs-2); line-height: 1.35; color: var(--muted); }
[dir="rtl"] :is(.ocard, .pt-carte) .ocard-meta { clip-path: inset(-3px 1em -3px -3px); }
.ocard-meta > * { min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ocard-meta > .oc-ent { flex: 0 1 auto; font-size: inherit; font-weight: 600; color: var(--ink-2); }
.ocard-meta > .oc-lieu { flex: 0 1 auto; font-size: inherit; }
.ocard-meta > .oc-quand { flex: none; }
:is(.ocard, .pt-carte) .ocard-meta > *::before { content: "·"; display: inline-block; width: 1em; text-align: center; font-weight: 400; color: var(--muted); }
.ocard .ocard-tags { gap: .3rem; }
.ocard .ocard-tags .tag, .pt-carte .ocard-tags .tag { padding: .2rem .5rem; }
.ocard .oc-preuve { font-size: var(--fs-2); }
/* « Nour peut te recommander » : une ligne verte dans la carte, au-dessus des autres preuves */
.oc-preuve.oa-coopt { color: var(--good); font-weight: 600; }
.oc-preuve.oa-coopt .ico { color: currentColor; }
/* Le pied, une seule ligne : le lauréat qui la partage (prénom et promo), les réactions, l'état ou « Postuler », le
   marque-page. Rien ne passe à la ligne : s'il manque de la place, la promo s'efface d'un bloc (elle est dans la fiche),
   puis le prénom se resserre ; trop étroit, le visage reste seul. */
.ocard-foot { gap: .35rem; padding: .25rem .5rem .25rem .9rem; min-height: 46px; }
.ocard-foot > :not(.ocard-author):not(.spacer) { flex: none; }
.ocard-foot > .ocard-author { flex: 1 1 0; min-width: 0; }
.ocard-author .oa-txt { flex: 1 1 0; display: flex; flex-direction: column; min-width: 0; line-height: 1.25; container-type: inline-size; }
@container (max-width: 3.5rem) { .oa-txt > * { display: none; } }
.ocard-author .oa-txt > span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ocard-author .oa-txt > .oa-nom { display: flex; flex-wrap: wrap; column-gap: .3em; height: 1.25em; }
.oa-nom > span { min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.oa-promo::before { content: "· "; }
.oa-promo { color: var(--muted); }
/* Une feuille ouverte depuis une carte (« Réactions » : qui a réagi) est en position fixe : tant qu'elle est là, la carte
   ne porte aucune transformation (l'élévation au survol l'enfermerait dans la carte). Au doigt, pas d'élévation
   « au survol » qui resterait collée après un toucher. */
.ocard:has(.modal-back) { transform: none !important; transition: none; }
@media (hover: none), (pointer: coarse) { .ocard:hover { transform: none; box-shadow: var(--sh1); } }
/* Pied étroit (moins de 320 px utiles : téléphone de 360 px, deux colonnes juste au-dessus de 760 px) : le résumé des
   réactions garde un seul émoji et tout se resserre d'un cran, pour que le prénom reste entier plutôt que « You… ».
   Une requête d'écran, pas de conteneur : un conteneur enfermerait la feuille « Réactions » (position fixe) dans le pied. */
@media (max-width: 374px), (min-width: 761px) and (max-width: 815px) {
  .ocard-foot .rx-pile > span + span { display: none; }
  .ocard-foot .rx-resume { gap: .2rem; padding-inline: .45rem; }
  .ocard-foot > .ocard-author { gap: .3rem; }
}
[dir="rtl"] .ocard-txt [dir="auto"], [dir="rtl"] .od .detail-title [dir="auto"], [dir="rtl"] .pt-main [dir="auto"] { text-align: right; }
/* Ordinateur : deux colonnes de cartes */
@media (min-width: 761px) { .offres-page .offer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`);

injectCSS('offres-ux', `
/* ===== Fiche d'une offre : le haut aux couleurs de l'entreprise, les faits en tuiles, « Postuler » collé ===== */
.od { --v-fond: hsl(var(--h, 205) calc(var(--s, 50%) * .8) 95%); --v-1: hsl(var(--h, 205) calc(var(--s, 50%) + 14%) 82%);
  --v-2: hsl(calc(var(--h, 205) + 38) calc(var(--s, 50%) + 6%) 87%); --v-3: hsl(calc(var(--h, 205) - 28) var(--s, 50%) 89%);
  --f-fond: hsl(var(--h, 205) calc(var(--s, 50%) * .9) 93%); --f-ink: hsl(var(--h, 205) 50% 30%); }
:root[data-theme="dark"] .od { --v-fond: hsl(var(--h, 205) 24% 16%); --v-1: hsl(var(--h, 205) 42% 29%); --v-2: hsl(calc(var(--h, 205) + 38) 34% 24%); --v-3: hsl(calc(var(--h, 205) - 28) 32% 21%); --f-fond: hsl(var(--h, 205) 26% 21%); --f-ink: hsl(var(--h, 205) 62% 80%); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .od { --v-fond: hsl(var(--h, 205) 24% 16%); --v-1: hsl(var(--h, 205) 42% 29%); --v-2: hsl(calc(var(--h, 205) + 38) 34% 24%); --v-3: hsl(calc(var(--h, 205) - 28) 32% 21%); --f-fond: hsl(var(--h, 205) 26% 21%); --f-ink: hsl(var(--h, 205) 62% 80%); } }

/* La fenêtre : son titre flotte sur le voile, puis se pose en verre dès que la fiche défile */
.modal.fiche-offre > .modal-body { --od-px: 1.2rem; padding: 0 var(--od-px) 1.6rem; }
.modal.fiche-offre:not(.has-foot) > .modal-body { padding-bottom: calc(1.6rem + env(safe-area-inset-bottom, 0px)); }
.modal.fiche-offre > .modal-head { background: transparent; border-bottom-color: transparent; transition: background-color .25s ease, border-color .25s ease; }
.modal.fiche-offre > .modal-head h2 { min-width: 0; font: 650 var(--fs-3)/1.3 var(--f-body); letter-spacing: 0; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.modal.fiche-offre > .modal-head .icon-btn { background: color-mix(in srgb, var(--surface) 72%, transparent); box-shadow: 0 1px 3px rgb(10 20 40 / .12); }
.modal.fiche-offre.defile > .modal-head { background: color-mix(in srgb, var(--surface) 84%, transparent); -webkit-backdrop-filter: blur(18px) saturate(1.6); backdrop-filter: blur(18px) saturate(1.6); border-bottom-color: var(--line); }
.modal.fiche-offre.defile > .modal-head .icon-btn { box-shadow: none; background: color-mix(in srgb, var(--ink) 5%, transparent); }

.od.detail { gap: 1.15rem; }
.od-hero { position: relative; display: flex; flex-direction: column; gap: .7rem; margin: calc(-1 * var(--tete, 0px)) calc(-1 * var(--od-px, 1.2rem)) 0; padding: calc(var(--tete, 0px) + .4rem) var(--od-px, 1.2rem) .6rem; }
.od-pour { display: flex; flex-wrap: wrap; margin-inline-start: -1em; clip-path: inset(-3px -3px -3px 1em); }
[dir="rtl"] .od-pour { clip-path: inset(-3px 1em -3px -3px); }
/* Le point pend devant chaque morceau, hors de sa boîte : un morceau qui passe à la ligne (« toutes / filières ») reste aligné */
.od-pour > span { position: relative; min-width: 0; margin-inline-start: 1em; }
.od-pour > .od-entier { white-space: nowrap; }   /* un code (« GE-MCI ») reste entier ; « toutes filières » peut passer à la ligne */
.od-pour > span::before { content: "·"; position: absolute; inset-inline-start: -1em; width: 1em; text-align: center; font-weight: 400; color: var(--muted); }
.od-hero > :not(.od-voile) { position: relative; }
.od-voile { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(70% 75% at 10% 6%, var(--v-1), transparent 70%), radial-gradient(60% 85% at 94% 0%, var(--v-2), transparent 70%),
    radial-gradient(80% 70% at 62% 100%, var(--v-3), transparent 75%), var(--v-fond);
  -webkit-mask-image: linear-gradient(to bottom, #000 52%, transparent); mask-image: linear-gradient(to bottom, #000 52%, transparent); }
[dir="rtl"] .od-voile { transform: scaleX(-1); }
.od-hero .detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: .6rem; }
.od-hero .detail-head > .clogo { width: 64px !important; height: 64px !important; border-radius: 20px; box-shadow: 0 0 0 4px var(--surface), 0 14px 30px -14px rgb(10 20 40 / .5); }
.od-outils { display: flex; align-items: center; gap: .4rem; margin-inline-start: auto; }
.od-outils > :is(.icon-btn, .cf-signal, .cf-signale), .od-outils .menu-wrap > .icon-btn { display: inline-grid; place-items: center; width: 40px; height: 40px; padding: 0; border-radius: 50%; color: var(--ink-2); background: color-mix(in srgb, var(--surface) 70%, transparent); box-shadow: 0 1px 3px rgb(10 20 40 / .1); }
.od-outils > :is(.icon-btn, .cf-signal):hover, .od-outils .menu-wrap > .icon-btn:hover { background: var(--surface); color: var(--ink); }
.od-outils > .cf-signal:hover { color: var(--bad); }
.od-hero .detail-title { gap: .4rem; }
.od-hero .detail-title h2 { font: 760 var(--fs-6)/1.18 var(--f-display); letter-spacing: -.02em; color: var(--ink); text-wrap: balance; overflow-wrap: anywhere; }
.od-sub { display: flex; align-items: baseline; flex-wrap: wrap; gap: .1rem .45rem; margin: 0; font-size: var(--fs-3); color: var(--ink-2); }
.od-ent { font-weight: 650; color: var(--ink); text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--ink) 30%, transparent); text-underline-offset: 3px; }
.od-ent:hover { color: var(--accent); }
.od-dot { color: var(--muted); }
.od-quand { color: var(--muted); font-size: var(--fs-2); }
.od-signaux { display: flex; flex-wrap: wrap; gap: .4rem; }
.od-signaux .tag { min-height: 28px; padding: .25rem .6rem; font-size: var(--fs-2); }
.od-signal { display: inline-flex; align-items: center; gap: .3rem; min-height: 28px; padding: 0 .65rem 0 .5rem; border-radius: var(--r-pill); background: var(--good-soft); color: var(--good); font-size: var(--fs-2); font-weight: 650; }

/* Les faits : des tuiles, l'icône dans la couleur de l'entreprise ; la dernière tuile seule prend toute la ligne */
.od-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; margin: 0; }
.od-facts > div { position: relative; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: .1rem; min-height: 60px; padding: .6rem .75rem; padding-inline-start: calc(.75rem + 36px + .65rem); border-radius: var(--r-lg); background: var(--surface-2); }
.od-facts > div:last-child:nth-child(odd) { grid-column: 1 / -1; }
.od-facts dt { font-size: var(--fs-1); font-weight: 600; color: var(--muted); line-height: 1.3; }
[dir="rtl"] .od-facts dt { font-size: var(--fs-2); }
.od-facts dd { margin: 0; font-size: var(--fs-3); font-weight: 650; color: var(--ink); line-height: 1.3; overflow-wrap: anywhere; }
.od-fait-ico { position: absolute; inset-inline-start: .75rem; top: 50%; translate: 0 -50%; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 12px; background: var(--f-fond); color: var(--f-ink); }
.od-facts > .urgent { background: var(--brass-soft); }
.od-facts > .urgent .od-fait-ico { background: color-mix(in srgb, var(--brass) 16%, var(--surface)); color: var(--brass); }
.od-facts > .urgent dd { color: var(--brass); }
/* Trois colonnes sur grand écran : la dernière tuile prend la place qui reste sur sa ligne (pas de trou à droite) */
@media (min-width: 761px) { .od-facts { grid-template-columns: repeat(3, minmax(0, 1fr)); } .od-facts > div:last-child:nth-child(odd) { grid-column: auto; }
  .od-facts > div:last-child:nth-child(3n + 1) { grid-column: 1 / -1; } .od-facts > div:last-child:nth-child(3n + 2) { grid-column: span 2; } }

/* La description, aérée ; puis qui la propose, avec son visage */
.od-bloc { display: flex; flex-direction: column; gap: .6rem; padding-top: 1.05rem; border-top: 1px solid var(--line); }
.od-bloc > h3 { margin: 0; font: 700 var(--fs-4)/1.3 var(--f-display); letter-spacing: -.01em; color: var(--ink); }
.od-desc .prose { max-width: 62ch; font-size: var(--fs-4); line-height: 1.68; color: var(--ink-2); }
.od-desc .prose p { margin: 0; }
.od-lien { align-self: flex-start; display: inline-flex; align-items: center; gap: .4rem; min-height: 40px; padding: 0 .9rem; border-radius: var(--r-pill); background: var(--tonal-bg); color: var(--tonal-ink); font-weight: 600; font-size: var(--fs-2); text-decoration: none; }
.od-lien:hover { background: var(--tonal-hover); }
.od-author { display: flex; align-items: center; gap: .85rem; width: 100%; padding: .85rem .9rem; border: 0; border-radius: var(--r-lg); background: var(--surface-2); color: inherit; font: inherit; text-align: start; cursor: pointer; transition: background-color .2s ease, transform .15s var(--ease); }
.od-author:hover { background: color-mix(in srgb, var(--surface-2) 70%, var(--line)); }
.od-author:active { transform: scale(.99); }
.od-author-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .15rem; }
.od-author-line { display: flex; align-items: center; gap: .3rem; min-width: 0; font: 700 var(--fs-4)/1.3 var(--f-display); color: var(--ink); }
.od-author-line > span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.od-author .role-line { font-size: var(--fs-2); }
.od-author-note { display: flex; align-items: center; gap: .35rem; margin-top: .2rem; font-size: var(--fs-2); font-weight: 600; color: var(--ink-2); }
.od-author-note > svg { flex: none; color: var(--muted); }
.od-author.coopt .od-author-note { color: var(--good); }
.od-author.coopt .od-author-note > svg { color: var(--good); }
.od-author-ico { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; color: var(--muted); }
.od-author:hover .od-author-ico { color: var(--accent); }
[dir="rtl"] .od-author-ico svg { transform: scaleX(-1); }
.od-onglets { align-self: stretch; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
.od-onglets > button { min-height: 40px; }
/* Candidats : le statut choisi prend sa couleur (reçue en bleu, entretien en laiton, pas retenue en gris) */
.cand-statut .seg > button.on[data-s="entretien"] { background: var(--brass-soft); color: var(--brass); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--brass) 35%, transparent); }
.cand-statut .seg > button.on[data-s="refuse"] { background: var(--surface); color: var(--ink-2); box-shadow: inset 0 0 0 1px var(--line-strong); }
.cand-statut .seg > button.on[data-s="retenu"] { background: var(--good-soft); color: var(--good); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--good) 35%, transparent); }
/* Profils qui correspondent : un titre comme les autres blocs ; par profil, le visage et le nom en entier, puis la raison
   et « Inviter à postuler » dessous (la raison n'est jamais écrasée lettre par lettre). Assez large : une seule ligne. */
.matching { display: flex; flex-direction: column; gap: .2rem; margin-top: .5rem; }
.matching-titre { display: flex; align-items: center; gap: .45rem; margin: 0; font: 700 var(--fs-4)/1.3 var(--f-display); letter-spacing: -.01em; color: var(--ink); }
.matching-titre > svg { flex: none; color: var(--accent); }
.matching .people-list li { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: .5rem .75rem; padding-block: .75rem; }
.matching .people-list li > .person { grid-column: 1 / -1; }
.matching .people-list li > :is(.why, .spacer) { min-width: 0; overflow-wrap: normal; }
.matching .people-list li > :is(.btn, .state-pill) { justify-self: end; }
.matching .people-list li > .btn { min-height: 40px; }
@media (min-width: 600px) {
  .matching .people-list li { grid-template-columns: minmax(0, 1fr) auto auto; }
  .matching .people-list li > .person { grid-column: auto; }
}
/* Les questions : « il y a 9 j » ne se coupe jamais en deux lignes */
.comments .q-quand { white-space: nowrap; }
/* La candidature : l'icône à côté de sa phrase (jamais seule sur une ligne), le bouton sous la phrase ; les réactions plus près */
.apply-box .apply-cv { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: .35rem .5rem; }
.apply-box .apply-cv > svg { margin-top: .1rem; }
.apply-box .apply-cv > :not(svg):not(span) { grid-column: 2; justify-self: start; }
/* Les réactions de la fiche, comme sur les cartes : jamais un nombre (le résumé ouvre qui a réagi) ; le choix des cinq
   émojis s'ouvre par-dessus la ligne, rien ne bouge autour */
.od > .od-rx { position: relative; margin-block: -.4rem; }
/* Tant qu'on n'a pas réagi, le bouton dit « Réagir » en toutes lettres (son nom, déjà traduit) : seul sur sa ligne, une
   icône ne suffirait pas à dire l'action */
.od > .od-rx .rx-ajouter:not(.on) { width: auto; padding-inline: .6rem .8rem; gap: .35rem; }
.od > .od-rx .rx-ajouter:not(.on) .rx-plus { display: none; }
.od > .od-rx .rx-ajouter:not(.on)::after { content: attr(aria-label); }

/* Le pied collé : le marque-page (qui fait un petit bond), « Postuler » ; puis la coche de la candidature envoyée */
.modal-foot > .od-foot { flex: 1; min-width: 0; display: flex; align-items: center; gap: .6rem; }
.od-foot .btn.primary { flex: 1; min-height: 48px; font-size: var(--fs-4); }
.od-foot .btn.ghost { min-height: 48px; }
.od-save { flex: none; width: 48px; height: 48px; border: 1px solid var(--line-strong); border-radius: var(--r-md); }
.od-save.on { background: var(--sel-bg); color: var(--sel-ink); border-color: transparent; box-shadow: inset 0 0 0 1px var(--sel-ring); }
.od-foot-txt { flex: 1; min-width: 0; }
.od-envoyee { min-height: 48px; }
.od-envoyee .od-foot-txt { display: flex; flex-direction: column; gap: .05rem; }
.od-envoyee strong { font: 700 var(--fs-4)/1.25 var(--f-display); color: var(--ink); }
@media (prefers-reduced-motion: no-preference) {
  .od-save.pop .ico { animation: marque .4s cubic-bezier(.3, 1.6, .5, 1); }
  .od-envoyee.vient .od-foot-txt { animation: od-envoi .4s var(--ease-out) .12s backwards; }
}
@keyframes od-envoi { from { opacity: 0; transform: translateX(-10px); } }
[dir="rtl"] .od-envoyee.vient .od-foot-txt { animation-name: od-envoi-rtl; }
@keyframes od-envoi-rtl { from { opacity: 0; transform: translateX(10px); } }
@media (min-width: 761px) { .od-foot .btn.primary { flex: 0 0 auto; min-width: 15rem; margin-inline-start: auto; } }

/* Grand écran : la fiche s'ouvre en panneau à côté de la liste, qui reste visible derrière un voile léger */
@media (min-width: 1100px) {
  .modal-back:has(> .modal.fiche-offre) { place-items: stretch end; padding: 12px; background: rgb(10 12 18 / calc(.26 * var(--voile, 1))); }
  .modal.fiche-offre, .modal.fiche-offre.wide { width: min(640px, 50vw); max-height: none; border-radius: var(--r-xl); animation: od-panneau .4s var(--ease-out) backwards; }
  [dir="rtl"] .modal.fiche-offre { animation-name: od-panneau-rtl; }
  .modal-back.sortie > .modal.fiche-offre { animation: od-panneau-part .22s var(--ease-in) forwards; }
  [dir="rtl"] .modal-back.sortie > .modal.fiche-offre { animation-name: od-panneau-part-rtl; }
  .modal.fiche-offre > .modal-body { --od-px: 1.6rem; }
  .modal.fiche-offre .modal-foot { padding-inline: 1.6rem; }
}
@media (prefers-reduced-motion: no-preference) and (min-width: 1100px) {
  ::view-transition-new(vt-fiche) { animation: .4s var(--ease-out) both od-panneau; }
  html[dir="rtl"]::view-transition-new(vt-fiche) { animation-name: od-panneau-rtl; }
}
@keyframes od-panneau { from { transform: translateX(calc(100% + 24px)); } }
@keyframes od-panneau-rtl { from { transform: translateX(calc(-100% - 24px)); } }
@keyframes od-panneau-part { to { transform: translateX(calc(100% + 24px)); } }
@keyframes od-panneau-part-rtl { to { transform: translateX(calc(-100% - 24px)); } }
@media (prefers-reduced-motion: reduce) { .modal.fiche-offre, .modal.fiche-offre.wide { animation-name: fade-in; } .modal-back.sortie > .modal.fiche-offre { animation-name: fade-out; }
  .od-author { transition: background-color .2s ease; } .od-author:active { transform: none; } }
`);

ajouterIcones({ remunere: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>' });

const OFFRES_AR = ['عرض آخر', 'عرضان آخران', 'عروض أخرى', 'عرضًا آخر'];
const OFFRES_N = ['عرض واحد', 'عرضان', 'عروض', 'عرضًا'];
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
  // La page des offres : en-tête, rangée collée, « Pour toi », « Nouveau »
  'Par les étudiants': 'من الطلبة', 'Rechercher une offre': 'ابحث عن عرض', 'Filtrer les offres': 'تصفية العروض', 'Offres ou demandes': 'عروض أو طلبات',
  'Choisies d’après ta filière et ton profil': 'مختارة حسب شعبتك وملفك', 'Nouveau': 'جديد', 'depuis ta dernière visite': 'منذ زيارتك الأخيرة',
  'Proposée par': 'مقترح من', 'Ton offre': 'عرضك', 'Déposer': 'اقتراح', 'Pose ta question…': 'اطرح سؤالك…', 'Ta question sur l’offre': 'سؤالك حول العرض',
  // La fiche : les titres des blocs, la candidature envoyée
  'Partagée par': 'مشاركة من', 'Le sujet': 'الموضوع', 'Le poste': 'المنصب', 'La mission': 'المهمة', 'L’annonce': 'الإعلان',
  'Candidature envoyée': 'تم إرسال ترشيحك', 'Reçoit ta candidature et te répond ici': 'يستقبل ترشيحك ويجيبك هنا',
}, [
  [/^(\d+) offres? pour ta (.+)$/, (n, a) => `${arCount(n, OFFRES_N)} لـ${a}`],
  [/^(\d+) offres? pour toi$/, n => `${arCount(n, OFFRES_N)} لك`],
  [/^(\d+) candidatures? à traiter$/, n => `${arCount(n, ['ترشيح واحد', 'ترشيحان', 'ترشيحات', 'ترشيحًا'])} في انتظار ردك`],
  [/^(\d+) offres? ouvertes?$/, n => arCount(n, ['عرض واحد مفتوح', 'عرضان مفتوحان', 'عروض مفتوحة', 'عرضًا مفتوحًا'])],
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
  [/^([^,·]+) peut te recommander$/, n => `تزكية ممكنة من ${n}`],
  [/^Partagée par ([^,]+), qui reçoit ta candidature et te répond ici$/, n => `عرض من ${n}، يصله ترشيحك ويأتيك الجواب هنا`],
  [/^Partagée par ([^,]+)$/, n => `عرض من ${n}`],
  [/^([^,]+) te répond ici$/, n => `الجواب من ${n} هنا`],
  [/^(.+) reçoit ta candidature avec ton profil( et ton CV)?\. Tu suis sa réponse dans « Mon parcours »\.$/, (n, cv) => `يصل ترشيحك إلى ${n === 'Le lauréat' ? 'الخريج' : n} مع ملفك${cv ? ' وسيرتك الذاتية' : ''}. تتابع الرد في «مساري».`],
  [/^Recruter (.+?) \? (.+?) recevra une demande de confirmation, et tu peux annuler tant que ce n’est pas confirmé\.$/, n => `توظيف ${n}؟ يصل طلب تأكيد إلى ${n}، ويمكنك الإلغاء ما دام لم يُؤكَّد بعد.`],
  [/^Annuler le recrutement de (.+?) \? Il n’y aura plus rien à confirmer de son côté\.$/, n => `إلغاء توظيف ${n}؟ لن يبقى ما يجب تأكيده.`],
]);
