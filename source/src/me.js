// « Mon parcours » (étudiants) et « Mon espace » (lauréats).
import { html, useState, useEffect, useRef } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Avatar, Bar, toast, LevelChip, CompanyLogo, TYPE_ICON, celebrate, injectCSS, Embleme, EnTetePage, Compteur, Anneau, Rangee, vibrer, clavierOnglets } from './ui.js';
import { addAR, arCount } from './i18n.js';
import { OBJECTIFS, NIVEAUX, TYPES, niveauOf, statutOf, typeForNiveau, seasonLabel, timeAgo, levelOf, BADGES, badgesOf, BAREME, NIVEAUX_IMPACT, mentorState, requestsFor, demandesPour, pionniersOf, PIONNIER_MOI, haussesDepuisVisite } from './logic.js';
import { APP_STATUS, OfferComposer, annulerRecrutement } from './offers.js';
import { AttestationCard, ShareModal } from './growth.js';
import { Filleuls, ParrainCard } from './saison.js';
import { BilanCard } from './recrutement.js';
import { FaisVenirPromo } from './invitation.js';
import { slotWhen } from './mentorat.js';

// Étapes vues par l'étudiant : il postule, le lauréat fait avancer, l'étudiant confirme.
const JOURNEY = [['send', 'Je postule'], ['people', 'Entretien'], ['briefcase', 'Recrutement'], ['check', 'Confirmé']];
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

// Mon parcours (étudiant), dans l'ordre où il sert : ce qui se fait ici même (confirmer, dire merci), le parrain (3A),
// puis l'objectif de l'année en un chemin (les étapes franchies, celle en cours mise en avant, la ligne qui se remplit)
// avec la prochaine chose à faire, puis ses candidatures et leur statut.
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
  // Une seule action principale, dans cet ordre : la carte à confirmer (ou le merci), sinon « Lui écrire » du parrain (3A),
  // sinon la prochaine étape ; les autres passent en tonal. La carte du parrain ne compte que si elle s'affiche (parrain connu)
  const pr = me.role === 'etudiant' && n === 3 ? data.parrainages?.find(x => x.filleul_id === me.id && x.saison === saison) : null;
  const parrain = !!(pr && store.byId('profiles', pr.parrain_id));
  const aFaire = aFaireIci(data, me);
  const plein = !aFaire && !parrain;

  return html`<section class="page parcours pc-page">
    <${EnTetePage} surTitre=${NIVEAUX[n]?.label} titre="Mon parcours"/>

    <${AFaire} ctx=${ctx}/>
    <${ParrainCard} ctx=${ctx} plein=${!aFaire}/>

    <section class=${'objective pc-objectif st-' + st.key} aria-labelledby="pc-objectif-titre">
      <div class="pc-obj-tete">
        <span class="pc-obj-ico" aria-hidden="true"><${Icon} name=${obj ? TYPE_ICON[obj.types[0]] : 'cap'} size=${22}/></span>
        <div class="pc-obj-txt"><p class="eyebrow">Mon objectif de l’année</p><h2 id="pc-objectif-titre">${obj ? obj.titre : 'Pas d’objectif de placement cette année'}</h2></div>
        ${obj ? html`<span class=${'state-pill s-' + st.key}>${st.label}</span>` : null}
      </div>
      ${obj ? html`<${Chemin} step=${step}/>` : null}
      <${ProchaineEtape} ctx=${ctx} obj=${obj} step=${step} plein=${plein}/>
      ${pl && pl.status !== 'en_attente' ? html`<div class="found-line"><${CompanyLogo} name=${pl.entreprise} size=${40}/><span class="grow"><strong translate="no">${pl.entreprise}</strong>${pl.ville ? html`, <span translate="no">${pl.ville}</span>` : ''}${pl.pays && pl.pays !== 'Maroc' ? ` (${pl.pays})` : ''}<br/><span class="esp-sous">${pl.status === 'confirme' ? `Vérifié : recrutement déclaré par ${helper?.full_name || 'un lauréat'}, confirmé par toi` : 'Trouvé en dehors de la plateforme'}</span></span>
        <button type="button" class="btn small tonal" onClick=${() => setShare(true)}><${Icon} name="share" size=${15}/> Partager</button></div>` : null}
      ${pl && pl.status === 'confirme' && helper ? html`<label class="check small consent"><input id="pl-partage" type="checkbox" checked=${!!pl.partage_ok} onChange=${e => partagerNom(ctx, pl, e)}/> ${helper.full_name.split(' ')[0]} peut citer mon nom s’il partage mon recrutement sur LinkedIn</label>` : null}
      ${pl && pl.status === 'confirme' && helper ? html`<${ReussitePublique} ctx=${ctx} pl=${pl} cote="etudiant"/>` : null}
    </section>

    ${pl && pl.laureat_id && pl.status === 'confirme' && pl.merci ? html`<${MerciBox} ctx=${ctx} pl=${pl} helper=${helper}/>` : null}

    <section class="esp-bloc pc-cands" aria-labelledby="pc-cands-titre">
      <div class="pc-tete"><h2 class="esp-h" id="pc-cands-titre">Mes candidatures${apps.length ? html` <span class="count">${apps.length}</span>` : null}</h2>
        <button type="button" class="btn small tonal" aria-label="Ajouter une candidature hors plateforme" onClick=${() => setAddApp(true)}><${Icon} name="plus" size=${15}/> Ajouter</button></div>
      ${apps.length ? html`<ul class="esp-lignes">${apps.map(a => {
        const o = a.offer_id ? store.byId('offers', a.offer_id) : null;
        const titre = a.titre || o?.titre;
        // Sous le titre (deux lignes au plus), l'entreprise et la date en entier : une ligne de faits, qui passe à la ligne
        // entre les deux plutôt que d'abréger le nom (« Renault Group Maroc », à 360 px)
        const corps = html`<${CompanyLogo} name=${a.entreprise} size=${44}/>
          <span class="esp-ligne-txt">${titre ? html`<strong class="esp-titre" translate="no" dir="auto">${titre}</strong>` : html`<strong class="esp-titre">Candidature</strong>`}
            <span class="esp-sous pc-sous faits"><span class="pc-ent"><bdi translate="no">${a.entreprise}</bdi></span><span class="pc-quand nowrap">${o ? timeAgo(a.updated_at || a.created_at) : 'hors plateforme'}</span></span></span>`;
        return o ? html`<li class="pc-cand" key=${a.id}><button type="button" class="esp-ligne" onClick=${() => openOffer(o.id)}>${corps}<span class=${'state-pill a-' + a.status}>${APP_STATUS[a.status]}</span></button></li>`
          : html`<li class="pc-cand hors" key=${a.id}><div class="esp-ligne">${corps}
            <span class="pc-hors-act"><select id=${'ap-' + a.id} aria-label="Statut" value=${a.status} onChange=${e => act(() => store.update('applications', a.id, { status: e.target.value, updated_at: new Date().toISOString() }))}>${Object.entries(APP_STATUS).map(([v, t]) => html`<option value=${v}>${t}</option>`)}</select>
              <button type="button" class="icon-btn" aria-label="Supprimer" title="Supprimer" onClick=${() => act(() => store.remove('applications', a.id))}><${Icon} name="trash" size=${16}/></button></span></div></li>`;
      })}</ul>
      <p class="pc-note"><${Icon} name="shield" size=${15}/><span>Pour les offres de la plateforme, c’est le lauréat qui met à jour le statut. Quand il déclare ton recrutement, tu confirmes ici.</span></p>`
      : html`<${Empty} icon="send" scene="candidatures" title="Aucune candidature pour l’instant">Ouvre une offre et clique sur « Postuler ». Le lauréat reçoit ton message et ton CV.<//>`}
    </section>

    <${FaisVenirPromo} ctx=${ctx}/>

    ${!pl && obj ? html`<p class="pc-hors-ligne">Tu as trouvé sans passer par la plateforme ? <button type="button" class="linkish" onClick=${() => setDeclare(true)}>Indique-le ici</button> pour que le suivi de ton année soit juste.</p>` : null}

    ${history.length ? html`<section class="esp-bloc" aria-labelledby="pc-avant-titre"><h2 class="esp-h" id="pc-avant-titre">Années précédentes</h2>
      <ul class="esp-lignes">${history.map(h => html`<li key=${h.id}><div class="esp-ligne"><${CompanyLogo} name=${h.entreprise} size=${44}/><span class="esp-ligne-txt"><strong>${TYPES[h.type]?.label} chez <span translate="no">${h.entreprise}</span></strong><span class="esp-sous">${seasonLabel(h.saison)}${h.pays && h.pays !== 'Maroc' ? ` · ${h.pays}` : ''}</span></span>${h.source === 'plateforme' ? html`<span class="state-pill s-trouve">Via la plateforme</span>` : null}</div></li>`)}</ul></section>` : null}

    ${declare ? html`<${DeclareOutside} ctx=${ctx} onClose=${() => setDeclare(false)}/>` : null}
    ${share && pl ? html`<${ShareModal} ctx=${ctx} pl=${pl} onClose=${() => setShare(false)}/>` : null}
    ${addApp ? html`<${AppModal} ctx=${ctx} onClose=${() => setAddApp(false)}/>` : null}
  </section>`;
}

// « … peut citer mon nom s’il partage mon recrutement sur LinkedIn » : comme « Peut être montré » (ReussitePublique), un choix
// refusé ou perdu en route remet la case à ce que la base a gardé, puis act() dit l'erreur (la case du navigateur a déjà
// changé d'état, et rien ne redessine la page après un échec)
function partagerNom({ store, act }, pl, e) {
  const c = e.currentTarget;
  return act(async () => {
    try { await store.update('placements', pl.id, { partage_ok: c.checked }); } catch (err) { c.checked = !!(store.byId('placements', pl.id) || pl).partage_ok; throw err; }
  });
}

// Le chemin de l'année : quatre étapes reliées. Celles franchies en vert (coche), celle en cours en bleu, mise en avant ;
// la ligne se remplit jusqu'à elle à l'arrivée (0,4 s, immobile en mouvement réduit). Lu comme une liste ordonnée.
const CHEMIN = [['send', 'Je postule'], ['people', 'Entretien'], ['briefcase', 'Recrutement'], ['trophy', 'Confirmé']];
function Chemin({ step }) {
  const der = CHEMIN.length - 1;
  const fait = Math.max(0, Math.min(der, step - 1)) / der;   // jusqu'à la dernière étape franchie
  const vers = Math.min(der, step) / der;                      // jusqu'à l'étape en cours
  return html`<div class="chemin" style=${`--fait:${fait};--vers:${vers}`}>
    <span class="chemin-rail" aria-hidden="true"><span class="chemin-vers"></span><span class="chemin-plein"></span></span>
    <ol class="chemin-etapes" aria-label="Mon chemin">${CHEMIN.map(([ic, l], i) => {
      const etat = i < step ? 'fait' : i === step ? 'ici' : 'apres';
      return html`<li key=${i} class=${'ch-' + etat} aria-current=${etat === 'ici' ? 'step' : null}>
        <span class="ch-pt" aria-hidden="true"><${Icon} name=${etat === 'fait' ? 'check' : ic} size=${etat === 'ici' ? 18 : 16}/></span>
        <span class="ch-l">${l}</span>${etat === 'fait' ? html`<span class="sr-only">(fait)</span>` : null}</li>`;
    })}</ol>
  </div>`;
}

// La prochaine chose à faire, selon l'étape : une phrase et un bouton (plein seulement si rien d'autre ne l'est au-dessus)
function ProchaineEtape({ ctx, obj, step, plein }) {
  const cls = 'btn ' + (plein ? 'primary' : 'tonal');
  const e = !obj ? ['Pas de placement à viser cette année : profite de l’Entraide et du mentorat pour préparer ton premier stage.', ['mentor', 'Demander un conseil', () => ctx.askHelp()]]
    : step === 0 ? ['Postule à une offre de ton année : le lauréat reçoit ton message et ton CV.', ['search', 'Voir les offres pour moi', () => ctx.go('offres')]]
      : step === 1 ? ['Tes candidatures sont parties. En attendant leur réponse, un lauréat peut relire ton CV.', ['file', 'Faire relire mon CV', () => ctx.go('mentorat/cv')]]
        : step === 2 ? ['Tu as un entretien : entraîne-toi 20 minutes en visio avec un lauréat.', ['mentor', 'Préparer mon entretien', () => ctx.askHelp(null, 'entretien')]]
          : step === 3 ? ['Un lauréat a déclaré ton recrutement : confirme-le juste au-dessus.', null]
            : ['C’est fait : ta réussite compte dans le suivi de ton année. Bravo !', null];
  const [phrase, action] = e;
  return html`<div class="pc-suite">
    <div class="pc-suite-txt"><p class="eyebrow">${step >= 4 && obj ? 'Objectif atteint' : 'Prochaine étape'}</p><p class="pc-suite-phrase">${phrase}</p></div>
    ${action ? html`<button type="button" class=${cls + ' pc-suite-btn'} onClick=${action[2]}><${Icon} name=${action[0]} size=${17}/> ${action[1]}</button>` : null}
  </div>`;
}

// Le lauréat a déclaré le recrutement : l'étudiant confirme ou non (ici, ou depuis la carte « prochaine étape » de l'accueil)
export const refuserRecrutement = (ctx, pl) => ctx.act(async () => { await ctx.store.update('placements', pl.id, { status: 'refuse' }); toast('C’est noté. Le lauréat sera informé.'); });
export const confirmerRecrutement = (ctx, pl, helper) => ctx.act(async () => {
  const { store } = ctx;
  await store.update('placements', pl.id, { status: 'confirme' });
  // Un lauréat qui cherchait un emploi l'a trouvé : il sort de la Vitrine, son entreprise est notée
  const me = ctx.me;
  if (me?.role === 'laureat' && me.en_recherche) await store.update('profiles', me.id, { en_recherche: false, ...(me.entreprise ? {} : { entreprise: pl.entreprise }) }).catch(() => {});
  const p = me?.role === 'etudiant' ? (helper?.full_name || '').split(' ')[0] : '';
  const fete = celebrate({
    cle: 'recrutement-' + pl.id, icon: 'trophy', titre: 'Félicitations, c’est officiel !',
    texte: p ? `Ton recrutement chez ${pl.entreprise} est vérifié des deux côtés. Un petit mot fera très plaisir à ${p}.` : `Ton recrutement chez ${pl.entreprise} est vérifié des deux côtés.`,
    action: p ? { label: `Dire merci à ${p}`, icon: 'heart', onClick: () => versMerci(ctx) } : null,
  });
  if (!fete) toast('Félicitations ! Ta réussite est confirmée.', 'win');
});
export function ConfirmRecruit({ ctx, pl, helper }) {
  const { store } = ctx;
  const o = pl.offer_id ? store.byId('offers', pl.offer_id) : null;
  // Depuis une demande : le lauréat du match déclare le démarrage (recrutement, encadrement ou recommandation)
  const d = pl.demande_id ? store.byId('demandes', pl.demande_id) : null;
  return html`<div class="confirm-card">
    <div class="confirm-top"><${CompanyLogo} name=${pl.entreprise} size=${48}/>
      <div><p class="eyebrow">À confirmer</p><h2>${pl.demande_id ? `${helper?.full_name || 'Un lauréat'} indique que tu as commencé chez ${pl.entreprise}` : `${helper?.full_name || 'Un lauréat'} déclare ton recrutement chez ${pl.entreprise}`}</h2>
        <p class="muted small">${o ? o.titre : d ? html`<span translate="no" dir="auto">${d.titre}</span>` : TYPES[pl.type]?.long}. Une fois confirmé, ta réussite est vérifiée des deux côtés et compte dans le suivi de ton année.</p></div></div>
    <div class="row-end">
      <button class="btn ghost" onClick=${() => refuserRecrutement(ctx, pl)}>Ce n’est pas le cas</button>
      <button class="btn primary" onClick=${() => confirmerRecrutement(ctx, pl, helper)}><${Icon} name="check" size=${16}/> Oui, je confirme</button>
    </div>
  </div>`;
}

// Après la fête : on ouvre « Mon parcours » (ou « Mon espace ») et on place le curseur dans le mot de remerciement
export function versMerci(ctx) {
  ctx.go(ctx.me?.role === 'etudiant' ? 'parcours' : 'espace');
  setTimeout(() => {
    const t = document.getElementById('merci-txt');
    if (!t) return;
    t.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    t.focus({ preventScroll: true });
  }, 450);
}

// En tête de Mon parcours et de Mon espace : seulement ce qui se fait ici même (confirmer un recrutement, dire merci).
// Les autres gestes (candidatures, rendez-vous, CV relu…) sont dans la cloche et sur l'accueil : on ne les répète pas ici.
// Rien à confirmer ni à remercier : rien ne s'affiche. Sinon, la carte porte le bouton plein de la page.
const aFaireIci = (data, me) => data.placements.some(p => p.student_id === me.id && (p.status === 'en_attente' || (p.status === 'confirme' && p.laureat_id && !p.merci)));
export function AFaire({ ctx }) {
  const { data, me, store } = ctx;
  const helper = p => store.byId('profiles', p.laureat_id);
  const aConfirmer = data.placements.filter(p => p.student_id === me.id && p.status === 'en_attente');
  const aRemercier = data.placements.filter(p => p.student_id === me.id && p.status === 'confirme' && p.laureat_id && !p.merci);
  if (!aConfirmer.length && !aRemercier.length) return null;
  return html`<section class="a-faire" aria-label=${aConfirmer.length ? 'À confirmer' : 'Dis merci'}>
    ${aConfirmer.map(p => html`<${ConfirmRecruit} key=${p.id} ctx=${ctx} pl=${p} helper=${helper(p)}/>`)}
    ${aRemercier.map(p => html`<${MerciBox} key=${p.id} ctx=${ctx} pl=${p} helper=${helper(p)}/>`)}
  </section>`;
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
    <div class="row"><span class="stars" role="radiogroup" aria-label="Aide reçue">${[1, 2, 3, 4, 5].map(v => html`<button type="button" role="radio" aria-checked=${v === note} class=${v <= note ? 'on' : ''} aria-label=${v + ' sur 5'} onClick=${() => setNote(v)}>★</button>`)}</span><span class="spacer"></span><button class="btn primary small" disabled=${!merci.trim()}>Envoyer mon merci</button></div>
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
      <p class="small muted">Pour une offre de la plateforme, pas besoin de remplir ceci : le lauréat déclare ton recrutement et tu confirmes.</p>
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
// Mon espace (lauréat), dans l'ordre où il sert :
//   1. ce qui l'attend : un recrutement que l'étudiant doit encore confirmer, le prochain rendez-vous (lignes compactes) ;
//   2. « Mon impact » : une carte bleu nuit, trois vrais chiffres qui comptent, le niveau et l'anneau du prochain badge ;
//   3. trois onglets, dans l'adresse comme Mon profil (#espace, #espace/offres, #espace/documents) :
//      Impact (mercis, recrues, filleuls ; badges et points repliés), Mes offres (état, candidats), Documents ;
//   4. « Fais venir ta promo », sur une ligne.
// Un lauréat qui arrive n'a rien à rattraper : une première aide facile, pas un tableau de zéros.
// ---------------------------------------------------------------------------
const STATUT_OFFRE = { ouverte: ['Ouverte', 'of-ouverte'], pourvue: ['Pourvue', 's-trouve'] };
export const ONGLETS_ESPACE = [['impact', 'Impact'], ['offres', 'Mes offres'], ['documents', 'Documents']];
export const ongletEspace = sub => (ONGLETS_ESPACE.some(([k]) => k === sub) ? sub : 'impact');
export const routeEspace = k => (k === 'impact' ? 'espace' : 'espace/' + k);

export function EspacePage(ctx) {
  const { data, me, scores, go } = ctx;
  const s = scores.get(me.id) || { points: 0, events: [], offres: 0, recrutes: 0, mentorats: 0, mercis: 0, reponses: 0 };
  const mine = badgesOf(s, me, { star: ctx.starId, fondateurs: ctx.fondateurs, ambassadeurs: ctx.ambassadeurs, pionniers: pionniersOf(data.profiles) })
    .map(b => (b.id === 'pionnier' ? { ...b, ...PIONNIER_MOI } : b));
  const myOffers = data.offers.filter(o => o.author_id === me.id).sort((a, b) => (a.status === 'ouverte' ? 0 : 1) - (b.status === 'ouverte' ? 0 : 1) || new Date(b.created_at) - new Date(a.created_at));
  const waiting = data.placements.filter(p => p.laureat_id === me.id && p.status === 'en_attente');
  const helped = data.placements.filter(p => p.laureat_id === me.id && p.status === 'confirme');
  const mercis = [
    ...helped.filter(p => p.merci).map(p => ({ id: p.id, who: p.student_id, txt: p.merci, at: p.confirmed_at || p.created_at, ctx: p.entreprise })),
    ...data.mentorships.filter(m => m.mentor_id === me.id && m.merci).map(m => ({ id: m.id, who: m.student_id, txt: m.merci, at: m.created_at, ctx: m.sujet })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  const [bareme, setBareme] = useState(false);
  const [compose, setCompose] = useState(false);
  const [share, setShare] = useState(null);
  const rdv = data.mentorships.filter(m => m.mentor_id === me.id && mentorState(m) === 'rdv').sort((a, b) => new Date(a.rdv_at) - new Date(b.rdv_at));
  const recrues = helped.filter(p => p.saison === ctx.saison).sort((a, b) => new Date(b.confirmed_at || b.created_at) - new Date(a.confirmed_at || a.created_at));
  const events = [...(s.events || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
  const nouveau = !s.points && !myOffers.length && !helped.length && !waiting.length && !rdv.length && !mercis.length;
  // Une seule action principale : si une carte à confirmer (ou un merci) montre son bouton plein, « Publier une offre »
  // et le geste de la première aide passent en tonal
  const carteAFaire = aFaireIci(data, me);
  const onglet = ongletEspace(ctx.sub);
  const hausses = useHausses(me.id, { recrutes: helped.length, mentorats: Number(s.mentorats) || 0, mercis: mercis.length });
  // Sur ordinateur, « Publier une offre » est dans la barre latérale (le bouton de la page se cache) ; sur un petit écran, « Publier »
  const publier = nouveau ? null : html`<button type="button" class=${'btn publier-offre ' + (carteAFaire ? 'tonal' : 'primary')} onClick=${() => setCompose(true)}>
    <${Icon} name="plus" size=${18}/><span class="po-long">Publier une offre</span><span class="po-court">Publier</span></button>`;

  return html`<section class="page espace esp-page">
    <${EnTetePage} surTitre=${html`<span class="faits"><span class="nowrap">${`Promo ${me.promo}`}</span>${me.entreprise ? html`<span><bdi translate="no">${me.entreprise}</bdi></span>` : null}</span>`} titre="Mon espace" action=${publier}/>

    <${AFaire} ctx=${ctx}/>
    ${nouveau ? html`<${PremiereAide} ctx=${ctx} plein=${!carteAFaire} onPublier=${() => setCompose(true)}/>
      <${ProchainBadge} s=${s} mine=${mine}/>` : html`
      <${CeQuiTAttend} ctx=${ctx} waiting=${waiting} rdv=${rdv}/>
      <${MonImpact} s=${s} mine=${mine} recrutes=${helped.length} mercis=${mercis.length} hausses=${hausses} onBareme=${() => setBareme(true)}/>
      <${OngletsEspace} onglet=${onglet} nOffres=${myOffers.length} onChange=${k => go(routeEspace(k), { remplacer: true })}/>
      <div class="esp-panneau" id="esp-panneau" role="tabpanel" aria-labelledby=${'esp-onglet-' + onglet} key=${onglet}>
        ${onglet === 'impact' ? html`<${PanneauImpact} ctx=${ctx} mercis=${mercis} recrues=${recrues} mine=${mine} events=${events} onShare=${setShare}/>` : null}
        ${onglet === 'offres' ? html`<${PanneauOffres} ctx=${ctx} offres=${myOffers}/>` : null}
        ${onglet === 'documents' ? html`<${PanneauDocuments} ctx=${ctx}/>` : null}
      </div>
      <${FaisVenirPromo} ctx=${ctx}/>`}

    ${bareme ? html`<${Modal} title="Points d’impact" onClose=${() => setBareme(false)}>
      <table class="tbl"><tbody>${BAREME.map(([l, p]) => html`<tr><td>${l}</td><td class="num mono">+${p}</td></tr>`)}</tbody></table>
      <p class="muted small">Niveaux : ${NIVEAUX_IMPACT.map(n => `${n.nom} (${n.min})`).join(' · ')}. Chaque mois, le lauréat qui a eu le plus d’impact est mis en avant sur l’accueil.</p>
    <//>` : null}
    ${compose ? html`<${OfferComposer} ctx=${ctx} onClose=${() => setCompose(false)}/>` : null}
    ${share ? html`<${ShareModal} ctx=${ctx} pl=${share} onClose=${() => setShare(null)}/>` : null}
  </section>`;
}

// Ce qui l'attend, en lignes compactes dans une seule carte : le prochain rendez-vous (vers Mentorat), puis chaque
// recrutement déclaré que l'étudiant doit encore confirmer (avec « Annuler », discret). Rien : rien ne s'affiche.
function CeQuiTAttend({ ctx, waiting, rdv }) {
  const { store, openProfile, go } = ctx;
  if (!waiting.length && !rdv.length) return null;
  const r = rdv[0];
  const w = r ? slotWhen(r.rdv_at) : null;
  const d = r ? new Date(r.rdv_at) : null;
  const etu = r ? store.byId('profiles', r.student_id) : null;
  return html`<section class="esp-attend" aria-labelledby="esp-attend-titre">
    <h2 class="esp-h" id="esp-attend-titre">Ce qui t’attend</h2>
    <ul class="esp-lignes">
      ${r ? html`<li class="esp-rdv" key="rdv"><button type="button" class="esp-ligne" onClick=${() => go('mentorat')}>
        <span class=${'esp-jour' + (w.diff === 0 ? ' auj' : '')} aria-hidden="true"><span class="ej-n">${d.getDate()}</span><span class="ej-m">${MOIS_COURT[d.getMonth()]}</span></span>
        <span class="esp-ligne-txt"><strong>${rdv.length > 1 ? `${rdv.length} rendez-vous à venir` : 'Rendez-vous en visio'}</strong>
          <span class="esp-sous esp-1l"><span>${w.day}</span> · <span class="mono">${w.time}</span>${etu ? html` · <span translate="no" dir="auto">${etu.full_name}</span>` : null}</span>
          ${r.sujet ? html`<span class="esp-sous esp-1l esp-sujet" translate="no" dir="auto">${r.sujet}</span>` : null}</span>
        <span class="esp-go" aria-hidden="true"><${Icon} name="arrow" size=${18}/></span></button></li>` : null}
      ${waiting.map(p => {
        const st = store.byId('profiles', p.student_id);
        return html`<li class="esp-attente" key=${p.id}><div class="esp-ligne">
          <${Avatar} p=${st} size=${44}/>
          <span class="esp-ligne-txt"><button type="button" class="linkish esp-nom" onClick=${() => openProfile(st)}>${st ? html`<span translate="no" dir="auto">${st.full_name}</span>` : 'Un étudiant'}</button>
            <span class="esp-sous faits"><span class="nowrap"><span class="esp-attente-pt" aria-hidden="true"></span><span>Confirmation attendue</span></span><span><bdi translate="no">${p.entreprise}</bdi></span></span></span>
          <button type="button" class="btn tiny ghost" aria-label=${`Annuler le recrutement déclaré pour ${st ? st.full_name : 'un étudiant'}`} onClick=${() => annulerRecrutement(ctx, p)}>Annuler</button></div></li>`;
      })}
    </ul>
  </section>`;
}
const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// « Mon impact » : une carte bleu nuit. Trois chiffres qui comptent pour les étudiants (ils comptent à l'arrivée),
// le niveau et ce qu'il reste pour le suivant, puis l'anneau du prochain badge. Les ondes, en haut, s'ouvrent une fois.
// Sous un chiffre qui a monté depuis la dernière visite : « +1 depuis ta dernière visite » (useHausses)
function MonImpact({ s, mine, recrutes, mercis, hausses = {}, onBareme }) {
  const lvl = levelOf(s.points);
  const faits = [
    [recrutes, 'recruté grâce à toi', 'recrutés grâce à toi', 'recrutes'],
    [Number(s.mentorats) || 0, 'mentorat terminé', 'mentorats terminés', 'mentorats'],
    [mercis, 'merci reçu', 'mercis reçus', 'mercis'],
  ];
  return html`<section class="impact-card" aria-labelledby="impact-titre">
    <span class="ic-ondes" aria-hidden="true"></span>
    <div class="ic-tete"><h2 id="impact-titre">Mon impact</h2><button type="button" class="ic-bareme" onClick=${onBareme}><span class="ic-long">Comment gagner des points ?</span><span class="ic-court">Barème</span></button></div>
    <ul class="impact-nums">${faits.map(([n, un, plus, k], i) => html`<li key=${i} class=${n ? '' : 'zero'}>
      <span class="impact-n"><${Compteur} v=${n}/></span><span class="impact-l">${n > 1 ? plus : un}</span>
      ${hausses[k] ? html`<${Hausse} n=${hausses[k]}/>` : null}</li>`)}</ul>
    <div class="ic-bas">
      <div class="impact-niveau">
        <div class="lvl-row"><${LevelChip} points=${s.points}/><span class="impact-pts">${`${s.points} point${s.points > 1 ? 's' : ''} d’impact`}</span></div>
        <${Bar} value=${lvl.progress} label="Progression vers le niveau suivant"/>
        <span class="impact-reste">${lvl.next ? `encore ${lvl.next.min - s.points} pour ${lvl.next.nom}` : 'Niveau maximum'}</span>
      </div>
      <${ProchainBadge} s=${s} mine=${mine} dedans/>
    </div>
  </section>`;
}

// « +1 depuis ta dernière visite » : les chiffres de « Mon impact » vus la dernière fois, gardés sur cet appareil pour chaque
// membre. On les garde de nouveau en quittant Mon espace (ou au bout de 4 s, ou quand l'onglet passe en arrière-plan) :
// la pastille reste pour cette visite, pas pour la suivante. Première visite : rien. Ni points, ni classement.
const CLE_VUS = id => 'espace-vus-' + id;
const lireVus = id => { try { return JSON.parse(localStorage.getItem(CLE_VUS(id)) || 'null'); } catch { return null; } };
function useHausses(id, chiffres) {
  const [avant, setAvant] = useState(() => ({ id, v: lireVus(id) }));
  const derniers = useRef({}); derniers.current[id] = chiffres;
  const vus = avant.id === id ? avant.v : lireVus(id);
  useEffect(() => {
    if (avant.id !== id) setAvant({ id, v: lireVus(id) });
    const garder = () => { try { localStorage.setItem(CLE_VUS(id), JSON.stringify(derniers.current[id])); } catch { /* pas de stockage : pas de pastille */ } };
    const cache = () => { if (document.visibilityState === 'hidden') garder(); };
    const t = setTimeout(garder, 4000);
    addEventListener('pagehide', garder); document.addEventListener('visibilitychange', cache);
    return () => { clearTimeout(t); removeEventListener('pagehide', garder); document.removeEventListener('visibilitychange', cache); garder(); };
  }, [id]);
  return haussesDepuisVisite(vus, chiffres);
}
// La pastille dit tout haut ce qu'elle compte : sur un téléphone, pas de survol pour lire un « title »
function Hausse({ n }) {
  return html`<span class="impact-hausse">${`+${n} depuis ta dernière visite`}</span>`;
}

// « Peut être montré sur la page d'entrée » : sous un recrutement confirmé, l'étudiant et le lauréat cochent chacun leur case
// (store.montrerReussite, jamais celle de l'autre). La réussite n'y paraît qu'avec les deux, et s'en va dès qu'un des deux décoche.
// En ligne, une base plus ancienne que le site (la réussite lue sans sa colonne public_…) : pas de case, elle ne mènerait qu'à une erreur.
// Un choix refusé ou perdu en route (réseau, droits, base pas à jour) : la case revient à ce que la base a gardé, act() dit l'erreur
// (la case du navigateur a déjà changé d'état, et rien ne redessine la page après un échec).
export function ReussitePublique({ ctx, pl, cote }) {
  const { store, act } = ctx;
  if (pl?.status !== 'confirme' || !pl.laureat_id || !store.montrerReussite) return null;
  if (store.mode === 'live' && !(('public_' + cote) in pl)) return null;
  const changer = e => {
    const c = e.currentTarget, oui = c.checked;
    return act(async () => {
      let x;
      try { x = await store.montrerReussite(pl.id, oui); } catch (err) { c.checked = (store.byId('placements', pl.id) || pl)['public_' + cote] === true; throw err; }
      toast(!oui ? 'C’est noté : cette réussite n’est pas sur la page d’entrée.'
        : x?.public_etudiant && x?.public_laureat ? 'C’est noté : cette réussite est maintenant sur la page d’entrée.'
        : 'C’est noté : elle sera sur la page d’entrée quand l’autre personne aura coché aussi.');
    });
  };
  return html`<div class="pl-public">
    <label class="check small consent"><input id=${'pl-public-' + pl.id} class="pl-public-case" type="checkbox" checked=${pl['public_' + cote] === true} onChange=${changer}/> Peut être montré sur la page d’entrée</label>
    <p class="small muted pl-public-sens">La page d’entrée est publique : l’entreprise, vos deux prénoms, la promo du lauréat et le mois y apparaissent seulement si vous cochez tous les deux. Tu peux décocher à tout moment.</p>
  </div>`;
}

// Une rangée d'onglets au clavier (Mon espace, Suivi, Mentorat) : la brique commune de ui.js
export { clavierOnglets };

// Les trois parties de Mon espace : la rangée de segments de l'appli (la pastille glisse d'un onglet à l'autre, le contenu suit)
function OngletsEspace({ onglet, nOffres, onChange }) {
  const clavier = clavierOnglets(ONGLETS_ESPACE.map(([k]) => k), onglet, onChange, k => 'esp-onglet-' + k);
  return html`<div class="seg seg-page esp-onglets" role="tablist" aria-label="Parties de mon espace" onKeyDown=${clavier}>
    ${ONGLETS_ESPACE.map(([k, l]) => html`<button type="button" role="tab" key=${k} id=${'esp-onglet-' + k} class=${onglet === k ? 'on' : ''} aria-selected=${onglet === k ? 'true' : 'false'}
      aria-controls="esp-panneau" tabindex=${onglet === k ? 0 : -1} onClick=${() => { if (k !== onglet) onChange(k); }}>${l}${k === 'offres' && nOffres ? html` <span class="count">${nOffres}</span>` : null}</button>`)}
  </div>`;
}

// Impact : ce que les étudiants en disent (les mercis, en rangée), les recrues de l'année, les filleuls ;
// tout le détail (badges, historique des points) replié en bas
function PanneauImpact({ ctx, mercis, recrues, mine, events, onShare }) {
  const { store, openProfile } = ctx;
  const vide = !mercis.length && !recrues.length && !mine.length && !events.length;
  return html`
    ${mercis.length ? html`<${Rangee} titre=${html`Leurs mercis <span class="count">${mercis.length}</span>`} cls="esp-mercis">${mercis.slice(0, 8).map(m => html`<${CarteMerci} key=${m.id} ctx=${ctx} m=${m}/>`)}<//>` : null}
    ${recrues.length ? html`<section class="esp-bloc esp-recrues" aria-labelledby="esp-recrues-titre">
      <h2 class="esp-h" id="esp-recrues-titre">Recrutés grâce à toi cette année <span class="count">${recrues.length}</span></h2>
      <ul class="esp-lignes">${recrues.slice(0, 5).map(p => html`<li class="esp-recrue" key=${p.id}><div class="esp-ligne">
        <${Person} p=${store.byId('profiles', p.student_id)} onOpen=${openProfile} size=${44} sub=${html`<span class="faits"><span><bdi translate="no">${p.entreprise}</bdi></span><span>${TYPES[p.type]?.label}</span></span>`}/>
        <button type="button" class="icon-btn esp-partage" aria-label="Partager sur LinkedIn" title="Partager sur LinkedIn" onClick=${() => onShare(p)}><${Icon} name="share" size=${18}/></button></div>
        <${ReussitePublique} ctx=${ctx} pl=${p} cote="laureat"/></li>`)}</ul>
    </section>` : null}
    <${Filleuls} ctx=${ctx}/>
    ${vide ? html`<${Empty} icon="heart" title="Les mercis des étudiants arriveront ici">Un CV relu, un conseil, une offre : chaque aide compte, et l’étudiant peut te dire merci.<//>` : null}
    <div class="esp-plis">
      <${MesBadges} mine=${mine}/>
      <${HistoriquePoints} events=${events}/>
    </div>`;
}

// L'historique des points, replié : le compte du résumé dit le total ; les 12 derniers, puis les plus anciens à la demande
const HISTO_N = 12;
function HistoriquePoints({ events }) {
  const [tout, setTout] = useState(false);
  if (!events.length) return null;
  const reste = events.length - HISTO_N;
  return html`<details class="ledger esp-plie">
    <summary><span class="esp-plie-ico" aria-hidden="true"><${Icon} name="star" size=${16}/></span><span class="grow">Historique de mes points</span><span class="count">${events.length}</span></summary>
    <ul class="events" id="esp-histo">${(tout ? events : events.slice(0, HISTO_N)).map((e, i) => html`<li key=${i}><span class="mono pts">+${e.pts}</span> <span class="grow">${e.label}</span> <span class="muted small nowrap">${timeAgo(e.at)}</span></li>`)}</ul>
    ${reste > 0 ? html`<button type="button" class="linkish esp-plus" aria-controls="esp-histo" aria-expanded=${tout ? 'true' : 'false'} onClick=${() => setTout(!tout)}>${tout ? 'Voir moins' : `Voir les ${reste} plus anciens`}</button>` : null}
  </details>`;
}

// Un merci : la phrase de l'étudiant en grand, qui il est, pour quoi, quand (en entier : la date passe sous l'aide plutôt
// que de finir en « … », .faits)
function CarteMerci({ ctx, m }) {
  const p = ctx.store.byId('profiles', m.who);
  return html`<figure class="merci-carte">
    <blockquote><p translate="no" dir="auto">${m.txt}</p></blockquote>
    <figcaption class="mc-qui"><${Avatar} p=${p} size=${32}/>
      <span class="mc-txt"><button type="button" class="linkish mc-nom" onClick=${() => ctx.openProfile(p)}>${p ? html`<span translate="no" dir="auto">${p.full_name}</span>` : 'Un étudiant'}</button>
        <span class="esp-sous faits"><span><bdi translate="no">${m.ctx}</bdi></span><span class="nowrap">${timeAgo(m.at)}</span></span></span></figcaption>
  </figure>`;
}

// Mes offres : chaque offre dit son état en couleur, ses candidats et ses recrues ; un toucher ouvre l'offre
function PanneauOffres({ ctx, offres }) {
  const { data, openOffer } = ctx;
  return html`<section class="esp-offres esp-bloc" aria-labelledby="esp-offres-titre">
    <h2 class="esp-h" id="esp-offres-titre">Mes offres${offres.length ? html` <span class="count">${offres.length}</span>` : null}</h2>
    ${offres.length ? html`<ul class="esp-lignes">${offres.slice(0, 10).map(o => {
      const nApps = data.applications.filter(a => a.offer_id === o.id).length;
      const nRec = data.placements.filter(p => p.offer_id === o.id && p.status === 'confirme').length;
      const [statut, cls] = STATUT_OFFRE[o.status] || ['Fermée', 'of-fermee'];
      return html`<li key=${o.id}><button type="button" class="app-row esp-ligne esp-offre" onClick=${() => openOffer(o.id)}>
        <span class=${'type-ico t-' + o.type}><${Icon} name=${TYPE_ICON[o.type]} size=${20}/></span>
        <span class="esp-ligne-txt"><strong class="esp-titre" translate="no" dir="auto">${o.titre}</strong>
          <span class="esp-sous"><span class=${'state-pill ' + cls}>${statut}</span><span class="esp-chiffres"><span class=${nApps ? '' : 'zero'}>${nApps ? `${nApps} candidat${nApps > 1 ? 's' : ''}` : 'Pas encore de candidat'}</span>${nRec ? html` · <span class="ok">${`${nRec} recruté${nRec > 1 ? 's' : ''}`}</span>` : null}</span></span></span>
        <span class="esp-go" aria-hidden="true"><${Icon} name="arrow" size=${18}/></span></button></li>`;
    })}</ul>` : html`<${Empty} icon="feed" scene="offres" title="Aucune offre publiée">Une offre partagée peut lancer une carrière : les étudiants concernés la voient tout de suite.<//>`}
  </section>`;
}

// Documents : l'attestation (CV, LinkedIn) et le bilan (RH, manager), côte à côte sur ordinateur
function PanneauDocuments({ ctx }) {
  return html`<section class="esp-docs esp-bloc" aria-labelledby="esp-docs-titre">
    <h2 class="esp-h" id="esp-docs-titre">Mes documents</h2>
    <div class="esp-docs-paire"><${AttestationCard} ctx=${ctx}/><${BilanCard} ctx=${ctx}/></div>
  </section>`;
}

// Première visite d'un lauréat : un geste mis en avant (le plus utile aujourd'hui), les autres en lignes, avec le temps
// qu'ils prennent. Aucun n'est obligatoire. Seulement des gestes possibles aujourd'hui : un étudiant qui cherche,
// un CV à relire, un horaire à choisir, sinon se rendre disponible ; publier une offre est toujours possible.
function PremiereAide({ ctx, onPublier, plein = true }) {
  const { data, me, go, store, act } = ctx;
  const byId = id => store.byId('profiles', id);
  const cvs = (data.relectures_cv || []).filter(r => !r.reviewer_id && r.status === 'demandee' && r.student_id !== me.id);
  const demandes = demandesPour(data, me, byId).filter(x => !x.mienne);
  const attente = requestsFor(data, me, byId);
  const gestes = [
    demandes.length ? ['send', 'Répondre à un étudiant qui cherche', 'Il a dit ce qu’il cherche, CV joint : propose ton aide en un clic.', '2 min', () => go('offres/demandes'), 'Voir sa demande'] : null,
    cvs.length ? ['file', 'Relire un CV', 'Ton regard de pro, quelques remarques suffisent.', '10 min', () => go('mentorat/cv'), 'Relire un CV'] : null,
    attente.length ? ['calendar', 'Choisir un horaire pour un étudiant', 'Un appel en visio, au moment qui t’arrange.', '2 min', () => go('mentorat'), 'Choisir un horaire'] : null,
    !me.mentor_dispo ? ['mentor', 'Me rendre disponible', 'Les étudiants de ta filière te verront dans Mentorat.', '1 clic', () => act(async () => { await store.update('profiles', me.id, { mentor_dispo: true }); vibrer(10); toast('C’est noté : les étudiants de ta filière te verront dans Mentorat.', 'win'); }), 'Me rendre disponible'] : null,
    ['feed', 'Publier une offre', 'Colle l’annonce : les champs se remplissent seuls.', '5 min', onPublier, 'Publier une offre'],
  ].filter(Boolean);
  const [une, ...autres] = gestes;
  const [ic, titre, sous, duree, faire, cta] = une;
  return html`<section class="premiere-aide" aria-labelledby="pa-titre">
    <div class="pa-head">
      <p class="eyebrow">${`Bienvenue, ${(me.full_name || '').split(' ')[0]}`}</p>
      <h2 id="pa-titre">Ta première aide</h2>
      <p class="pa-intro">Merci d’être là. Un seul geste peut changer l’année d’un étudiant : choisis celui qui te prend le moins de temps.</p>
    </div>
    <div class="pa-une">
      <span class="pa-une-ico" aria-hidden="true"><${Icon} name=${ic} size=${24}/></span>
      <div class="pa-une-txt"><span class="pa-geste-titre"><strong>${titre}</strong><span class="pa-duree">${duree}</span></span><span class="esp-sous">${sous}</span></div>
      <button type="button" class=${'btn pa-une-btn ' + (plein ? 'primary' : 'tonal')} onClick=${faire}>${cta}<${Icon} name="arrow" size=${18}/></button>
    </div>
    <p class="pa-ou">Ou bien</p>
    <ul class="pa-gestes">${autres.map(([ic2, t, sub, d, fn]) => html`<li key=${ic2}><button type="button" class="pa-geste" onClick=${fn}>
      <span class="pa-geste-ico"><${Icon} name=${ic2} size=${20}/></span>
      <span class="pa-geste-txt"><span class="pa-geste-titre"><strong>${t}</strong><span class="pa-duree">${d}</span></span><span class="esp-sous">${sub}</span></span>
      <span class="pa-geste-go" aria-hidden="true"><${Icon} name="arrow" size=${16}/></span></button></li>`)}<li key="promo"><${FaisVenirPromo} ctx=${ctx} geste/></li></ul>
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
  reactif: ['Choisis un horaire pour 3 étudiants en moins de 24 h', s => [s.rapides, 3]],
  faiseur: ['Aide 10 étudiants à être recrutés', s => [s.recrutes, 10]],
  top: ['Atteins 300 points d’impact', s => [s.points, 300]],
};
// « Membre fondateur » ne s'obtient plus après les 25 premiers : on ne le montre qu'à ceux qui l'ont
// (« Pionnier de ta promo » non plus : il vient de la date d'arrivée, rien à viser)
const badgesPossibles = has => BADGES.filter(b => !['fondateur', 'ambassadeur', 'pionnier'].includes(b.id) || has.has(b.id));

// Le prochain badge : son emblème dans un anneau qui se remplit (où on en est), ce qu'il demande.
// Dans « Mon impact » (dedans) ou seul, pour un nouveau lauréat (« Ton premier badge »)
function ProchainBadge({ s, mine, dedans = false }) {
  const has = new Set(mine.map(b => b.id));
  const next = Object.keys(VERS_BADGE).map(id => BADGES.find(b => b.id === id)).find(b => b && !has.has(b.id));
  if (!next) return null;
  const [quoi, f] = VERS_BADGE[next.id];
  const [cur, goal] = f(s).map(x => Number(x) || 0);
  const fait = Math.min(cur, goal);
  return html`<div class=${'badge-next' + (dedans ? ' dedans' : '')}>
    <${Anneau} valeur=${fait} max=${goal} taille=${dedans ? 58 : 60} epaisseur=${5} ton="impact" label=${`${fait} sur ${goal}`}><span class=${'bn-embleme m-' + next.id}><${Embleme} id=${next.id} size=${24}/></span><//>
    <div class="grow"><p class="eyebrow">${mine.length ? 'Prochain badge' : 'Ton premier badge'}</p><strong>${next.nom}</strong><span class="esp-sous">${quoi}</span></div>
    ${goal > 1 ? html`<span class="bn-compte">${`${fait} sur ${goal}`}</span>` : null}
  </div>`;
}

// Tous les badges, repliés : le résumé montre déjà les médailles gagnées ; dedans, celles obtenues en couleur, les autres en contour
function MesBadges({ mine }) {
  if (!mine.length) return null;
  const has = new Set(mine.map(b => b.id));
  const possibles = badgesPossibles(has);
  const tuile = (b, on) => html`<div class=${'badge' + (on ? ' has' : '')} title=${b.desc} key=${b.id}><span class=${'badge-medal m-' + b.id}><${Embleme} id=${b.id} size=${24}/></span><strong>${b.nom}</strong><span class="small muted">${b.desc}</span></div>`;
  return html`<details class="esp-plie esp-badges">
    <summary><span class="esp-plie-ico" aria-hidden="true"><${Icon} name="award" size=${16}/></span><span class="grow">${`Mes badges · ${mine.length} sur ${possibles.length}`}</span>
      <span class="esp-medailles" aria-hidden="true">${mine.slice(0, 4).map(b => html`<span class=${'badge-medal m-' + b.id} key=${b.id}><${Embleme} id=${b.id} size=${14}/></span>`)}</span></summary>
    <div class="badges">${mine.map(b => tuile(b, true))}${possibles.filter(b => !has.has(b.id)).map(b => tuile(b, false))}</div>
  </details>`;
}

// ---------------------------------------------------------------------------
// Mon espace : en-tête compact, lignes compactes, carte « Mon impact » bleu nuit, onglets, rangée de mercis
// Quatre tailles de texte : le titre de page (et les grands chiffres), le titre de section, le texte, la méta.
// ---------------------------------------------------------------------------
injectCSS('me-espace', `
/* Le rythme des pages (.page, 1,25rem entre les blocs) : le même que partout */
/* En-tête : le titre garde sa ligne ; « Publier une offre » devient « Publier » sur un petit téléphone (sur ordinateur, la barre latérale l'a déjà) */
.esp-page .en-tete-txt { flex-basis: 11rem; }
/* « Promo 2016 · Renault Group Maroc » en entier : l'entreprise passe à la ligne plutôt que de finir en « … » (.faits) */
.esp-page .en-tete .eyebrow { white-space: normal; }
.esp-page .en-tete .btn.publier-offre { width: auto; min-height: 44px; padding-inline: 1rem 1.1rem; gap: .4rem; }
.esp-page .po-court { display: none; }
@media (max-width: 430px) { .esp-page .po-long { display: none; } .esp-page .po-court { display: inline; } }

/* Titres de section : une seule taille, le compte à côté */
.esp-h, .esp-page .rangee-titre { display: block; margin: 0; font: 750 var(--fs-5)/1.25 var(--f-display); letter-spacing: -.015em; color: var(--ink); text-wrap: balance; }
.esp-h .count, .esp-page .rangee-titre .count { margin-inline-start: .4rem; vertical-align: .2em; font-family: var(--f-body); letter-spacing: 0; }
.esp-bloc, .esp-attend { display: flex; flex-direction: column; gap: .75rem; min-width: 0; }
.esp-sous { font-size: var(--fs-2); line-height: 1.45; color: var(--muted); min-width: 0; }

/* Lignes compactes : une carte, des lignes séparées par un filet qui part après le visage (ou la date) */
.esp-lignes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; border-radius: var(--r-lg); background: var(--surface); box-shadow: var(--sh1); overflow: hidden; }
.esp-lignes > li { position: relative; min-width: 0; }
.esp-lignes > li + li::before { content: ""; position: absolute; top: 0; inset-inline: calc(1rem + 44px + .85rem) 0; height: 1px; background: var(--line); z-index: 1; }
.esp-lignes .esp-ligne { display: flex; align-items: center; gap: .85rem; width: 100%; min-height: 68px; margin: 0; padding: .75rem 1rem; border: 0; border-radius: 0; background: none; box-shadow: none; font: inherit; color: inherit; text-align: start; }
.esp-lignes button.esp-ligne { cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background-color .2s; }
.esp-lignes button.esp-ligne:hover { background: var(--surface-2); box-shadow: none; }
.esp-lignes button.esp-ligne:active { background: var(--sel-bg); transition-duration: .06s; }
.esp-lignes button.esp-ligne:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.esp-ligne-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .1rem; }
.esp-ligne-txt > strong, .esp-titre { font-weight: 650; line-height: 1.35; color: var(--ink); }
/* Un titre (offre, candidature) tient sur deux lignes au plus, sans couper un mot trop long hors de la carte.
   La boîte épouse le texte et se cale au début de la ligne : en arabe, un titre en lettres latines reste à droite
   comme le reste de la ligne (aligner le texte lui-même à droite pousserait les points de suspension hors de la boîte) */
.esp-titre { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; align-self: flex-start; max-width: 100%; }
/* Un sujet sur une ligne, en lettres latines : calé à droite en arabe, comme les noms */
:root[dir="rtl"] .esp-sujet { text-align: right; }
.esp-ligne .person { flex: 1 1 auto; min-width: 0; gap: .85rem; }
.esp-ligne .person .person-txt { min-width: 0; }
/* Le nom et la ligne du dessous se lisent en entier : à 360 px, un nom long passe à la ligne (le bouclier reste sur la
   première), et l'entreprise passe à la ligne avant ce qui la suit (.faits) plutôt que de finir en « … » */
.esp-ligne .person .role-line { display: block; font-size: var(--fs-2); color: var(--muted); }
.esp-ligne .person-l1 { display: flex; align-items: flex-start; min-width: 0; }
.esp-ligne .person-name { min-width: 0; font-weight: 650; overflow-wrap: anywhere; }
.esp-ligne .person-l1 > :not(.person-name) { flex: none; }
.esp-ligne .person-l1 > .verif { margin-block-start: calc((1.3em - 16px) / 2); }
.esp-partage { flex: none; inline-size: 44px; block-size: 44px; color: var(--ink-2); }
/* Réussite montrée sur la page d'entrée : la case et sa phrase ; sous une recrue, alignées sur son nom (après le visage) */
.pl-public { display: flex; flex-direction: column; gap: .2rem; min-width: 0; }
.pl-public .consent { margin-top: 0; }
.pl-public-sens { margin: 0; padding-inline-start: 1.6rem; max-width: 60ch; }
.esp-recrue > .pl-public { margin-top: -.35rem; padding: 0 1rem .85rem; padding-inline-start: calc(1rem + 44px + .85rem); }
.esp-ligne-fin { flex: none; display: inline-flex; align-items: center; gap: .25rem; }
.esp-go { flex: none; display: inline-grid; color: var(--muted); transition: transform .25s var(--ease), color .2s; }
.esp-lignes button.esp-ligne:hover .esp-go { color: var(--accent); transform: translateX(2px); }
[dir="rtl"] .esp-lignes button.esp-ligne:hover .esp-go { transform: translateX(-2px); }
.esp-nom { align-self: flex-start; font-weight: 650; color: var(--ink); text-align: start; }

/* Ce qui l'attend : la date du rendez-vous en tuile, l'attente d'une confirmation en point ambre */
.esp-jour { flex: none; display: flex; flex-direction: column; align-items: center; justify-content: center; inline-size: 44px; block-size: 48px; border-radius: var(--r-md);
  background: var(--accent-soft); color: var(--blue-text); line-height: 1.05; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 12%, transparent); }
.esp-jour .ej-n { font: 750 var(--fs-5)/1 var(--f-display); font-variant-numeric: tabular-nums; }
.esp-jour .ej-m { font-size: var(--fs-2); font-weight: 600; }
.esp-jour.auj { background: var(--accent); color: var(--accent-ink); box-shadow: none; }
.esp-1l { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.esp-sujet { color: var(--ink-2); }
.esp-attente-pt { display: inline-block; inline-size: 7px; block-size: 7px; border-radius: 50%; background: var(--warn); margin-inline-end: .4rem; vertical-align: .1em; }
.esp-attente .btn.tiny { flex: none; min-height: 40px; }

/* ===== « Mon impact » : bleu nuit vers le bleu ENSAM, des ondes qui partent du coin (l'impact qui se propage) ===== */
.impact-card { --ic-a: #13223D; --ic-b: #1A3A66; --ic-c: #16639B; --ic-or: #FFC766; --ic-or-2: #FFAA33; --ic-l: rgb(255 255 255 / .9); --ic-filet: rgb(255 255 255 / .14);
  position: relative; isolation: isolate; overflow: hidden; display: flex; flex-direction: column; gap: 1.15rem; min-width: 0;
  padding: 1.15rem 1.15rem 1.25rem; border-radius: var(--r-xl); color: #FFFFFF;
  background: linear-gradient(155deg, var(--ic-a) 0%, var(--ic-b) 55%, var(--ic-c) 100%);
  box-shadow: 0 1px 2px rgb(16 32 64 / .14), 0 22px 44px -24px rgb(18 60 120 / .6); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .impact-card { --ic-a: #0C1626; --ic-b: #102647; --ic-c: #134774; --ic-filet: rgb(255 255 255 / .1);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .07), 0 0 0 1px rgb(255 255 255 / .07), 0 24px 48px -26px rgb(0 0 0 / .85); } }
:root[data-theme="dark"] .impact-card { --ic-a: #0C1626; --ic-b: #102647; --ic-c: #134774; --ic-filet: rgb(255 255 255 / .1);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .07), 0 0 0 1px rgb(255 255 255 / .07), 0 24px 48px -26px rgb(0 0 0 / .85); }
.ic-ondes { position: absolute; z-index: -1; inset-block-start: -210px; inset-inline-end: -210px; inline-size: 460px; block-size: 460px; border-radius: 50%; pointer-events: none;
  background: radial-gradient(closest-side, rgb(255 176 60 / .34), rgb(255 176 60 / .1) 42%, transparent 70%),
    repeating-radial-gradient(circle, rgb(255 255 255 / .085) 0 1px, transparent 1.5px 32px);
  -webkit-mask-image: radial-gradient(closest-side, #000 30%, transparent 100%); mask-image: radial-gradient(closest-side, #000 30%, transparent 100%); }
@media (prefers-reduced-motion: no-preference) { .ic-ondes { animation: ic-ondes .4s var(--ease) .05s backwards; } }
@keyframes ic-ondes { from { opacity: 0; transform: scale(.72); } }
.ic-tete { display: flex; align-items: center; justify-content: space-between; gap: .5rem; flex-wrap: wrap; min-width: 0; }
.ic-tete h2 { margin: 0; font: 750 var(--fs-5)/1.25 var(--f-display); letter-spacing: -.015em; color: #FFFFFF; }
.ic-bareme { min-height: 44px; margin-inline-end: -.35rem; padding: 0 .35rem; border: 0; border-radius: var(--r-sm); background: none; color: #CFE8FB; font: 600 var(--fs-2)/1.3 var(--f-body); cursor: pointer;
  text-decoration: underline; text-decoration-color: rgb(207 232 251 / .45); text-underline-offset: 3px; }
.ic-bareme:hover { color: #FFFFFF; text-decoration-color: currentColor; }
.ic-bareme:focus-visible { outline: 2px solid #FFFFFF; outline-offset: 1px; }
.ic-court { display: none; }
@media (max-width: 380px) { .ic-long { display: none; } .ic-court { display: inline; } }
.impact-card .impact-nums { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; }
.impact-card .impact-nums li { display: flex; flex-direction: column; align-items: flex-start; gap: .3rem; min-width: 0; padding: 0; padding-inline: .85rem .5rem; border-radius: 0; background: none; }
.impact-card .impact-nums li:first-child { padding-inline-start: 0; }
.impact-card .impact-nums li + li { border-inline-start: 1px solid var(--ic-filet); }
.impact-card .impact-n { font: 750 var(--fs-titre)/1 var(--f-display); letter-spacing: -.02em; font-variant-numeric: tabular-nums; color: #FFFFFF; }
.impact-card .impact-l { font-size: var(--fs-2); line-height: 1.35; color: var(--ic-l); text-wrap: balance; }
.impact-card .impact-nums li.zero .impact-n { color: rgb(255 255 255 / .6); }
/* « +1 depuis ta dernière visite » : une pastille calme sous le chiffre, verte sur le bleu nuit, le texte en blanc ;
   dans une colonne étroite, elle passe à la ligne */
.impact-card .impact-hausse { display: inline-block; max-width: 100%; padding: .1rem .5rem; border-radius: var(--r-sm); background: rgb(93 201 145 / .22); box-shadow: inset 0 0 0 1px rgb(93 201 145 / .42);
  color: #FFFFFF; font: 650 var(--fs-1)/1.35 var(--f-body); font-variant-numeric: tabular-nums; white-space: normal; overflow-wrap: anywhere; text-wrap: balance; }
.ic-bas { display: flex; flex-direction: column; gap: 1rem; padding-top: 1.05rem; border-top: 1px solid var(--ic-filet); min-width: 0; }
.impact-card .impact-niveau { display: flex; flex-direction: column; gap: .6rem; }
.impact-card .lvl-row { display: flex; align-items: center; gap: .55rem; flex-wrap: wrap; }
.impact-card .lvl { border: 0; padding: .3rem .62rem; font-weight: 700; background: rgb(255 255 255 / .16); color: #FFFFFF; }
.impact-card .lvl-1 { background: linear-gradient(180deg, #F3C9A1, #DDA06C); color: #3A1F08; }
.impact-card .lvl-2 { background: linear-gradient(180deg, #F4F7FB, #CDD8E5); color: #1D2B44; }
.impact-card .lvl-3 { background: linear-gradient(180deg, #FFE4A6, #FFC155); color: #432800; }
.impact-card .lvl-4 { background: linear-gradient(180deg, #E8F7FF, #B8E2F8); color: #0D3553; }
.impact-card .lvl-5 { background: linear-gradient(180deg, #FFC56B, #F39200); color: #351B00; }
.impact-card .impact-pts { font-size: var(--fs-3); font-weight: 650; font-variant-numeric: tabular-nums; color: #FFFFFF; }
.impact-reste { align-self: flex-end; margin-top: -.15rem; font-size: var(--fs-2); color: var(--ic-l); font-variant-numeric: tabular-nums; }
.impact-card .bar { height: 8px; border-radius: 4px; background: rgb(255 255 255 / .16); }
.impact-card .bar-fill { border-radius: 4px; background: linear-gradient(90deg, var(--ic-or), var(--ic-or-2)); box-shadow: 0 0 14px rgb(255 184 72 / .45); }
[dir="rtl"] .impact-card .bar-fill { background: linear-gradient(270deg, var(--ic-or), var(--ic-or-2)); }
/* Le prochain badge, dans la carte : l'anneau doré se remplit, l'emblème au centre */
.badge-next { display: flex; align-items: center; gap: .9rem; padding: .9rem 1rem; border-radius: var(--r-lg); background: var(--surface); box-shadow: var(--sh1); min-width: 0; }
.badge-next .grow { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .1rem; }
.badge-next .eyebrow { margin: 0; color: var(--brass); }
.badge-next strong { font-weight: 650; line-height: 1.3; color: var(--ink); }
.bn-embleme { display: grid; place-items: center; color: var(--brass); }
.bn-compte { flex: none; padding: .32rem .6rem; border-radius: var(--r-pill); background: var(--brass-soft); color: var(--brass); font: 650 var(--fs-2)/1.2 var(--f-body); font-variant-numeric: tabular-nums; white-space: nowrap; }
.badge-next.dedans { padding: 0; border-radius: 0; background: none; box-shadow: none; }
.badge-next.dedans .anneau { --trait: var(--ic-or); }
.badge-next.dedans .anneau-fond { stroke: rgb(255 255 255 / .16); }
.badge-next.dedans .bn-embleme { color: var(--ic-or); }
.badge-next.dedans .eyebrow { color: var(--ic-or); }
.badge-next.dedans strong { color: #FFFFFF; }
.badge-next.dedans .esp-sous { color: var(--ic-l); }
.badge-next.dedans .bn-compte { background: rgb(255 255 255 / .12); color: #FFFFFF; }
@media (min-width: 900px) {
  .impact-card { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); grid-template-rows: auto 1fr; grid-template-areas: "tete bas" "nums bas"; gap: 1.6rem 2.5rem; padding: 1.5rem 1.75rem 1.6rem; }
  .ic-tete { grid-area: tete; }
  .impact-card .impact-nums { grid-area: nums; align-self: end; }
  .ic-bas { grid-area: bas; align-self: center; padding-top: 0; padding-inline-start: 2.5rem; border-top: 0; border-inline-start: 1px solid var(--ic-filet); margin-inline-start: -2.5rem; }
  .ic-ondes { inset-block-start: -240px; inset-inline-end: -160px; inline-size: 560px; block-size: 560px; }
}

/* Les onglets : le segment commun des onglets de page (.seg-page, ui.js), toute la largeur sur téléphone */
.esp-panneau { display: flex; flex-direction: column; gap: 1.5rem; min-width: 0; margin-top: -.25rem; }
@media (min-width: 900px) {
  .esp-panneau:has(> .esp-recrues):has(> .esp-filleuls) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
  .esp-panneau > :is(.rangee-bloc, .esp-plis, .empty) { grid-column: 1 / -1; }
}

/* Leurs mercis : la phrase de l'étudiant en grand, dans une rangée qui défile */
.esp-mercis { --rangee-l: min(84%, 19.5rem); }
.merci-carte { position: relative; margin: 0; display: flex; flex-direction: column; justify-content: space-between; gap: 1rem; block-size: 100%; padding: 1.1rem 1.1rem 1rem; border-radius: var(--r-lg); background: var(--surface); box-shadow: var(--sh1); }
.merci-carte::before { content: "“"; position: absolute; inset-block-start: .2rem; inset-inline-end: .85rem; font: 750 3.25rem/1 var(--f-display); color: color-mix(in srgb, var(--brass) 32%, transparent); pointer-events: none; }
[dir="rtl"] .merci-carte::before { content: "”"; }
.merci-carte blockquote { margin: 0; padding-inline-end: 1.6rem; }
.merci-carte p { margin: 0; font-size: var(--fs-3); line-height: 1.55; color: var(--ink); text-wrap: pretty; }
.mc-qui { display: flex; align-items: center; gap: .6rem; min-width: 0; }
.mc-txt { display: flex; flex-direction: column; min-width: 0; }
.mc-nom { align-self: flex-start; font-weight: 650; color: var(--ink); text-align: start; }

/* Une note sous une liste (filleuls) et son petit lien d'action */
.esp-note { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0 1rem; }
.esp-note p { margin: 0; flex: 1 1 16rem; font-size: var(--fs-2); line-height: 1.45; color: var(--muted); }
.esp-note-act { display: inline-flex; align-items: center; min-height: 44px; font-size: var(--fs-2); }
.esp-ligne .msg-btn { flex: none; min-height: 40px; }
/* Petit téléphone : « Écrire » d'un filleul devient une icône ronde de 44 px (son nom, aria-label « Écrire à Soufiane »,
   reste lu), et le nom du filleul garde sa ligne */
@media (max-width: 380px) {
  .esp-filleuls .msg-btn { justify-content: center; min-width: 44px; min-height: 44px; padding-inline: .6rem; border-radius: var(--r-pill); }
  .esp-filleuls .msg-btn-txt { display: none; }
}

/* Le détail replié : badges et historique des points, deux lignes d'une même carte */
.esp-plis { display: flex; flex-direction: column; border-radius: var(--r-lg); background: var(--surface); box-shadow: var(--sh1); overflow: hidden; }
.esp-plis:empty { display: none; }
/* Le filet entre deux lignes repliées part après l'icône, comme dans les listes */
.esp-plie + .esp-plie > summary::before { content: ""; position: absolute; top: 0; inset-inline: calc(1rem + 36px + .75rem) 0; height: 1px; background: var(--line); }
.esp-plie > summary { position: relative; display: flex; align-items: center; gap: .75rem; min-height: 60px; padding: .6rem 1rem; cursor: pointer; list-style: none; font-weight: 650; color: var(--ink); -webkit-tap-highlight-color: transparent; transition: background-color .2s; }
.esp-plie > summary::-webkit-details-marker { display: none; }
.esp-plie > summary:hover { background: var(--surface-2); }
.esp-plie > summary:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.esp-plie > summary::after { content: ""; flex: none; inline-size: 7px; block-size: 7px; border-right: 2px solid var(--muted); border-bottom: 2px solid var(--muted); transform: translateY(-2px) rotate(45deg); transition: transform .2s var(--ease); margin-inline: .2rem .1rem; }
.esp-plie[open] > summary::after { transform: translateY(2px) rotate(-135deg); }
.esp-plie > summary .grow { flex: 1; min-width: 0; }
.esp-plie-ico { flex: none; display: grid; place-items: center; inline-size: 36px; block-size: 36px; border-radius: 50%; background: var(--brass-soft); color: var(--brass); }
.esp-medailles { display: inline-flex; align-items: center; flex: none; }
.esp-medailles .badge-medal { inline-size: 28px; block-size: 28px; margin: 0; border: 0; background: var(--brass-soft); color: var(--brass); box-shadow: 0 0 0 2px var(--surface); }
.esp-medailles .badge-medal.m-verifie { background: color-mix(in srgb, var(--teal) 14%, var(--surface)); color: var(--teal); }
.esp-medailles .badge-medal + .badge-medal { margin-inline-start: -7px; }
.esp-badges .badges { padding: .5rem 1rem 1.15rem; }
.ledger .events { padding: .1rem 1rem 1rem; gap: .5rem; }
.ledger .events li { display: flex; align-items: baseline; gap: .6rem; }
.ledger .events .pts { flex: none; min-width: 2.6rem; font-variant-numeric: tabular-nums; }
.ledger .esp-plus { display: inline-flex; align-items: center; min-height: 44px; margin: -.6rem 1rem .4rem; font-size: var(--fs-2); }
@media (max-width: 420px) { .esp-medailles { display: none; } }

/* Mes offres : l'état en couleur, les candidats et les recrues en clair, sous le titre */
.state-pill.of-ouverte { background: var(--accent-soft); color: var(--blue-text); }
.state-pill.of-fermee { background: var(--surface-2); color: var(--muted); }
.esp-offre .type-ico { inline-size: 44px; block-size: 44px; }
.esp-offre .esp-sous { display: flex; align-items: center; flex-wrap: wrap; gap: .25rem .6rem; margin-top: .15rem; }
.esp-chiffres { font-variant-numeric: tabular-nums; color: var(--ink-2); }
.esp-chiffres .zero { color: var(--muted); }
.esp-chiffres .ok { color: var(--good); font-weight: 650; }

/* Documents : attestation et bilan, côte à côte sur ordinateur */
.esp-docs-paire { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: .75rem; }
.esp-docs .attest-card { margin-top: 0; align-items: flex-start; align-content: space-between; gap: .5rem .85rem; padding: 1rem 1.05rem; }
.esp-docs .attest-ico { inline-size: 44px; block-size: 44px; }
.esp-docs .attest-card .grow { flex: 1 1 calc(100% - 44px - .85rem); min-width: 0; }
.esp-docs .attest-card > .btn { margin-inline-start: calc(44px + .85rem); min-height: 40px; }

/* ===== Première visite d'un lauréat : un geste mis en avant, les autres en lignes ===== */
.premiere-aide { display: flex; flex-direction: column; gap: .9rem; min-width: 0; }
.pa-head { display: flex; flex-direction: column; gap: .2rem; }
.pa-head .eyebrow { margin: 0; color: var(--brass); }
.pa-head h2 { margin: 0; font: 750 var(--fs-5)/1.25 var(--f-display); letter-spacing: -.015em; }
.pa-intro { margin: .15rem 0 0; color: var(--ink-2); font-size: var(--fs-3); line-height: 1.5; max-width: 54ch; text-wrap: pretty; }
.pa-une { position: relative; isolation: isolate; overflow: hidden; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: .9rem 1rem; align-items: center; padding: 1.15rem;
  border-radius: var(--r-xl); background: linear-gradient(150deg, var(--accent-soft), color-mix(in srgb, var(--accent-soft) 35%, var(--surface)) 70%); box-shadow: var(--sh1); }
.pa-une::after { content: ""; position: absolute; z-index: -1; inset-block-start: -120px; inset-inline-end: -120px; inline-size: 260px; block-size: 260px; border-radius: 50%;
  background: repeating-radial-gradient(circle, color-mix(in srgb, var(--accent) 12%, transparent) 0 1px, transparent 1.5px 26px);
  -webkit-mask-image: radial-gradient(closest-side, #000 25%, transparent 100%); mask-image: radial-gradient(closest-side, #000 25%, transparent 100%); }
.pa-une-ico { display: grid; place-items: center; inline-size: 52px; block-size: 52px; border-radius: 50%; background: var(--surface); color: var(--blue-text); box-shadow: var(--sh1); }
.pa-une-txt { display: flex; flex-direction: column; gap: .2rem; min-width: 0; }
.pa-une-txt strong { font-weight: 650; line-height: 1.3; }
.pa-une-btn { grid-column: 1 / -1; justify-self: stretch; min-height: 48px; gap: .5rem; }
[dir="rtl"] .pa-une-btn .ico { transform: scaleX(-1); }
.pa-ou { margin: .2rem 0 -.3rem; font-size: var(--fs-2); font-weight: 600; color: var(--muted); }
.pa-gestes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; border-radius: var(--r-lg); background: var(--surface); box-shadow: var(--sh1); overflow: hidden; }
.pa-gestes > li { position: relative; }
.pa-gestes > li + li::before { content: ""; position: absolute; top: 0; inset-inline: calc(1rem + 42px + .8rem) 0; height: 1px; background: var(--line); }
.pa-geste { inline-size: 100%; display: flex; align-items: center; gap: .8rem; min-height: 68px; padding: .8rem 1rem; border: 0; border-radius: 0; background: none; font: inherit; color: inherit; text-align: start; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background-color .2s; }
a.pa-geste { text-decoration: none; }
.pa-geste:hover { background: var(--surface-2); }
.pa-geste:active { background: var(--sel-bg); }
.pa-geste:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.pa-geste-ico { flex: none; inline-size: 42px; block-size: 42px; border-radius: var(--r-md); display: grid; place-items: center; background: var(--tonal-bg); color: var(--tonal-ink); }
.pa-geste-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .1rem; }
.pa-geste-titre { display: flex; align-items: baseline; flex-wrap: wrap; gap: .15rem .5rem; }
.pa-geste-txt strong { font-weight: 650; line-height: 1.3; }
.pa-duree { flex: none; font: 600 var(--fs-1)/1.5 var(--f-body); font-variant-numeric: tabular-nums; padding: 0 .5rem; border-radius: var(--r-pill); background: var(--good-soft); color: var(--good); white-space: nowrap; }
.pa-geste-go { flex: none; color: var(--muted); transition: color .2s, transform .25s var(--ease); }
.pa-geste:hover .pa-geste-go { color: var(--accent); transform: translateX(2px); }
[dir="rtl"] .pa-geste:hover .pa-geste-go { transform: translateX(-2px); }
.pa-geste .small.muted { font-size: var(--fs-2); }
@media (min-width: 760px) {
  .pa-une { grid-template-columns: auto minmax(0, 1fr) auto; padding: 1.3rem 1.4rem; }
  .pa-une-btn { grid-column: auto; justify-self: end; }
}
`);


// ---------------------------------------------------------------------------
// Mon parcours : l'objectif en un chemin (étapes reliées, la ligne qui se remplit), la prochaine chose, les candidatures
// ---------------------------------------------------------------------------
injectCSS('me-parcours', `
/* Le rythme des pages (.page, 1,25rem entre les blocs) : le même que partout */
.pc-objectif { display: flex; flex-direction: column; gap: 1.15rem; padding: 1.15rem 1.15rem 1.2rem; border-radius: var(--r-xl); background: var(--surface); box-shadow: var(--sh1); min-width: 0; }
.pc-obj-tete { display: flex; align-items: flex-start; gap: .85rem; min-width: 0; }
.pc-obj-ico { flex: none; display: grid; place-items: center; inline-size: 44px; block-size: 44px; border-radius: var(--r-md); background: var(--accent-soft); color: var(--blue-text); }
.pc-obj-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .1rem; }
.pc-obj-txt .eyebrow { margin: 0; }
.pc-obj-txt h2 { margin: 0; font: 750 var(--fs-5)/1.25 var(--f-display); letter-spacing: -.015em; text-wrap: balance; }
.pc-obj-tete .state-pill { flex: none; margin-top: .15rem; }
@media (max-width: 520px) {
  .pc-obj-tete { flex-wrap: wrap; row-gap: .5rem; }
  .pc-obj-tete .pc-obj-txt { flex-basis: calc(100% - 44px - .85rem); }
  .pc-obj-tete .state-pill { order: 3; margin: 0; margin-inline-start: calc(44px + .85rem); }
}

/* Le chemin : quatre étapes reliées ; franchies en vert, en cours en bleu (plus grande), à venir en contour */
.chemin { position: relative; padding-top: 2px; }
.chemin-etapes { position: relative; z-index: 1; list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: start; }
.chemin-etapes li { display: flex; flex-direction: column; align-items: center; gap: .4rem; min-width: 0; text-align: center; font-size: var(--fs-2); line-height: 1.25; font-weight: 500; color: var(--muted); }
.ch-pt { display: grid; place-items: center; inline-size: 36px; block-size: 36px; margin-block: 4px; border-radius: 50%; background: var(--surface); color: var(--muted); box-shadow: inset 0 0 0 2px var(--line-strong); }
.chemin-etapes .ch-fait { color: var(--ink-2); }
.ch-fait .ch-pt { background: var(--good); color: var(--good-soft); box-shadow: none; }
.chemin-etapes .ch-ici { color: var(--blue-text); font-weight: 650; }
.ch-ici .ch-pt { inline-size: 44px; block-size: 44px; margin-block: 0; background: var(--accent); color: var(--accent-ink); box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent) 18%, transparent); }
.chemin-rail { position: absolute; z-index: 0; top: calc(2px + 22px - 2px); inset-inline: 12.5%; block-size: 4px; border-radius: 2px; background: var(--line); overflow: hidden; }
.chemin-vers, .chemin-plein { position: absolute; inset-block: 0; inset-inline-start: 0; border-radius: inherit; transform-origin: left center; }
[dir="rtl"] :is(.chemin-vers, .chemin-plein) { transform-origin: right center; }
.chemin-vers { inline-size: calc(var(--vers) * 100%); background: linear-gradient(90deg, var(--good) 40%, var(--accent)); }
[dir="rtl"] .chemin-vers { background: linear-gradient(270deg, var(--good) 40%, var(--accent)); }
.chemin-plein { inline-size: calc(var(--fait) * 100%); background: var(--good); }
@media (prefers-reduced-motion: no-preference) {
  .chemin-vers { animation: ch-pousse .4s var(--ease) .1s backwards; }
  .chemin-plein { animation: ch-pousse .35s var(--ease) .1s backwards; }
  .ch-ici .ch-pt { animation: ch-ici .3s var(--ease) .35s backwards; }
}
@keyframes ch-pousse { from { transform: scaleX(0); } }
@keyframes ch-ici { from { transform: scale(.7); box-shadow: 0 0 0 0 transparent; } }
/* Petit téléphone : les intitulés un cran plus petits, pour que « Recrutement » garde de l'air entre ses voisins */
@media (max-width: 380px) { .chemin-etapes li { font-size: var(--fs-1); letter-spacing: -.005em; } }

/* La prochaine chose : une phrase, un bouton (pleine largeur sur téléphone) */
.pc-suite { display: flex; flex-direction: column; gap: .8rem; padding-top: 1rem; border-top: 1px solid var(--line); }
.pc-suite-txt { min-width: 0; }
.pc-suite-txt .eyebrow { margin: 0 0 .15rem; color: var(--blue-text); }
.pc-suite-phrase { margin: 0; font-size: var(--fs-3); line-height: 1.5; color: var(--ink); text-wrap: pretty; }
.pc-suite-btn { align-self: stretch; min-height: 48px; gap: .45rem; }
@media (min-width: 640px) {
  .pc-suite { flex-direction: row; align-items: center; justify-content: space-between; gap: 1rem 1.5rem; }
  .pc-suite-btn { align-self: auto; flex: none; }
}
.pc-objectif .found-line { padding-top: 1rem; }
.pc-objectif .consent { margin-top: -.4rem; }
.pc-objectif .pl-public { margin-top: -.4rem; }
.pc-objectif .pl-public .consent { margin-top: 0; }

/* Mes candidatures : une carte, une ligne par candidature, le statut en couleur */
.pc-tete { display: flex; align-items: center; justify-content: space-between; gap: .5rem 1rem; flex-wrap: wrap; }
.pc-tete .btn { min-height: 40px; }
.pc-cand .state-pill { flex: none; }
.pc-cand.hors .esp-ligne { flex-wrap: wrap; row-gap: .5rem; }
.pc-cand.hors .esp-ligne-txt { flex-basis: calc(100% - 44px - .85rem); }
.pc-hors-act { display: flex; align-items: center; gap: .35rem; margin-inline-start: calc(44px + .85rem); }
.pc-hors-act select { min-height: 40px; padding: .3rem .55rem; font-size: var(--fs-2); }
@media (pointer: coarse) { .pc-hors-act select { min-height: 44px; } }
.pc-hors-act .icon-btn { inline-size: 40px; block-size: 40px; color: var(--muted); }
@media (min-width: 640px) {
  .pc-cand.hors .esp-ligne { flex-wrap: nowrap; }
  .pc-cand.hors .esp-ligne-txt { flex-basis: 0; }
  .pc-hors-act { margin-inline-start: 0; }
}
.pc-note { display: flex; align-items: flex-start; gap: .45rem; margin: 0; font-size: var(--fs-2); line-height: 1.45; color: var(--muted); }
.pc-note .ico { flex: none; margin-top: .1rem; color: var(--teal); }
.pc-hors-ligne { margin: 0; text-align: center; font-size: var(--fs-2); line-height: 1.5; color: var(--muted); text-wrap: balance; }
.pc-hors-ligne .linkish { font-size: inherit; }
`);

addAR({
  'Félicitations, c’est officiel !': 'تهانينا، أصبح الأمر رسميًا!',
  'Une offre partagée peut lancer une carrière : les étudiants concernés la voient tout de suite.': 'عرض واحد قد يطلق مسارًا مهنيًا: يراه الطلبة المعنيون فورًا.',
  'Historique de mes points': 'سجل نقاطي',
  'Dis merci': 'قل شكرًا', 'Mon impact': 'أثري', 'Mes documents': 'وثائقي',
  // Les deux cartes de « Mes documents » (growth.js, recrutement.js)
  'Pour ton CV et LinkedIn, avec un lien de vérification.': 'لسيرتك الذاتية وحسابك على LinkedIn، مع رابط للتحقق.',
  'Pour ta RH ou ton manager : tes offres, candidatures et recrues.': 'لمصلحة الموارد البشرية أو لمديرك: عروضك والترشيحات ومن وظّفتهم.',
  'Ta première aide': 'أول مساعدة لك',
  // Mon espace : ce qui t'attend, onglets, mercis, première aide
  'Ce qui t’attend': 'ما ينتظرك', 'Rendez-vous en visio': 'موعد عبر الفيديو', 'Confirmation attendue': 'بانتظار التأكيد',
  'Impact': 'الأثر', 'Documents': 'الوثائق', 'Parties de mon espace': 'أقسام فضائي', 'Leurs mercis': 'رسائل شكرهم',
  'Les mercis des étudiants arriveront ici': 'هنا ستصلك رسائل شكر الطلبة',
  'Un CV relu, un conseil, une offre : chaque aide compte, et l’étudiant peut te dire merci.': 'سيرة ذاتية تراجعها، نصيحة، عرض: كل مساعدة لها قيمة، ويمكن للطالب أن يشكرك.',
  'Merci d’être là. Un seul geste peut changer l’année d’un étudiant : choisis celui qui te prend le moins de temps.': 'شكرًا لوجودك. خطوة واحدة قد تغيّر سنة طالب: اختر ما يأخذ منك أقل وقت.',
  'Voir sa demande': 'الاطلاع على طلبه', 'Ou bien': 'أو', 'Barème': 'سلّم النقاط',
  // Barème des points (logic.js), ouvert depuis « Mon impact »
  'Offre de ton entreprise, que tu encadres': 'عرض من شركتك تؤطّره بنفسك', 'Offre vue ailleurs et partagée': 'عرض رأيته في مكان آخر وشاركته',
  'Relire un CV': 'مراجعة سيرة ذاتية',
  'Ton regard de pro, quelques remarques suffisent.': 'نظرتك المهنية، وبضع ملاحظات تكفي.',
  'Choisir un horaire pour un étudiant': 'اختيار موعد لطالب',
  'Un appel en visio, au moment qui t’arrange.': 'مكالمة فيديو في الوقت الذي يناسبك.',
  'Colle l’annonce : les champs se remplissent seuls.': 'الصق الإعلان: تُملأ الخانات تلقائيًا.',
  'Répondre à un étudiant qui cherche': 'الرد على طالب يبحث', 'Il a dit ce qu’il cherche, CV joint : propose ton aide en un clic.': 'قال ما يبحث عنه مع سيرته الذاتية: اقترح مساعدتك بنقرة واحدة.', 'Les étudiants de ta filière te verront dans Mentorat.': 'سيراك طلبة شعبتك في قسم الإرشاد.', '1 clic': 'نقرة واحدة',
  'Mes badges': 'شاراتي',
  'Ton premier badge': 'شارتك الأولى',
  'Prochain badge': 'الشارة التالية',
  'Publie une première offre': 'انشر عرضك الأول',
  'Termine 3 mentorats': 'أنهِ 3 جلسات إرشاد',
  'Aide 3 étudiants à être recrutés': 'ساعد 3 طلبة على التوظيف',
  'Reçois 5 mercis d’étudiants': 'تلقَّ 5 رسائل شكر من الطلبة',
  'Ouvre une porte à l’étranger': 'افتح بابًا نحو الخارج',
  'Donne 3 meilleures réponses dans l’Entraide': 'قدّم 3 أفضل أجوبة في التعاون',
  'Choisis un horaire pour 3 étudiants en moins de 24 h': 'اختيار توقيت لـ3 طلبة في أقل من 24 ساعة',
  'Aide 10 étudiants à être recrutés': 'ساعد 10 طلبة على التوظيف',
  'Atteins 300 points d’impact': 'اجمع 300 نقطة أثر',
  // Barème et derniers points (logic.js)
  'CV relu et rendu à un étudiant': 'مراجعة سيرة ذاتية لطالب', 'Rubrique du guide de l’étranger écrite': 'قسم مكتوب في دليل الخارج',
  'Entretien ou avis de stage partagé': 'مشاركة مقابلة أو رأي حول تدريب', 'CV relu et rendu': 'مراجعة سيرة ذاتية مُنجزة',
  'Recrutement': 'التوظيف', 'Mon objectif de l’année': 'هدفي لهذه السنة', 'Années précédentes': 'السنوات السابقة', 'Recrutés grâce à toi cette année': 'تم توظيفهم بفضلك هذه السنة',
  'Pour les offres de la plateforme, c’est le lauréat qui met à jour le statut. Quand il déclare ton recrutement, tu confirmes ici.': 'في عروض المنصة، الخريج هو من يحدّث الحالة. عندما يصرّح بتوظيفك، تؤكد هنا.',
  'Pour une offre de la plateforme, pas besoin de remplir ceci : le lauréat déclare ton recrutement et tu confirmes.': 'لعرض من المنصة، لا حاجة لملء هذا: الخريج يصرّح بتوظيفك وأنت تؤكد.',
  'pour que le suivi de ton année soit juste.': 'ليكون تتبّع سنتك دقيقًا.',
  // Mon parcours : le chemin de l'année et la prochaine étape
  'Mon chemin': 'مساري', '(fait)': '(تمّ)', 'Prochaine étape': 'الخطوة التالية', 'Préparer mon entretien': 'التحضير لمقابلتي',
  'Ajouter une candidature hors plateforme': 'إضافة ترشيح خارج المنصة',
  'Postule à une offre de ton année : le lauréat reçoit ton message et ton CV.': 'ترشّح لعرض يخص سنتك: يتوصّل الخريج برسالتك وسيرتك الذاتية.',
  'Tes candidatures sont parties. En attendant leur réponse, un lauréat peut relire ton CV.': 'أُرسلت ترشيحاتك. في انتظار الرد، يمكن لخريج أن يراجع سيرتك الذاتية.',
  'Tu as un entretien : entraîne-toi 20 minutes en visio avec un lauréat.': 'لديك مقابلة: تدرّب 20 دقيقة عبر الفيديو مع خريج.',
  'Un lauréat a déclaré ton recrutement : confirme-le juste au-dessus.': 'صرّح خريج بتوظيفك: أكّده في الأعلى.',
  'C’est fait : ta réussite compte dans le suivi de ton année. Bravo !': 'تمّ الأمر: نجاحك يُحتسب في تتبّع سنتك. أحسنت!',
  'Pas de placement à viser cette année : profite de l’Entraide et du mentorat pour préparer ton premier stage.': 'لا تدريب مطلوب هذه السنة: استفد من التعاون والإرشاد لتحضير تدريبك الأول.',
  // Plan · partie membres
  'Pionnier de ta promo': 'من روّاد دفعتك', 'Parmi les 3 premiers lauréats de ta promo à rejoindre le réseau': 'من بين أول 3 خريجين من دفعتك انضموا إلى الشبكة',
  'Pionnier de sa promo': 'من روّاد الدفعة', 'Parmi les 3 premiers lauréats de sa promo à rejoindre le réseau': 'من بين أول 3 خريجين من دفعته انضموا إلى الشبكة',
  'Pionnier': 'من الروّاد', 'Pionnier de sa promo : parmi les 3 premiers lauréats de sa promo à rejoindre le réseau': 'من روّاد الدفعة: من بين أول 3 خريجين من دفعته انضموا إلى الشبكة',
  'Peut être montré sur la page d’entrée': 'يمكن عرضه في صفحة الدخول',
  'C’est noté : cette réussite n’est pas sur la page d’entrée.': 'تم الحفظ: هذا النجاح غير معروض في صفحة الدخول.',
  'C’est noté : cette réussite est maintenant sur la page d’entrée.': 'تم الحفظ: هذا النجاح معروض الآن في صفحة الدخول.',
  'C’est noté : elle sera sur la page d’entrée quand l’autre personne aura coché aussi.': 'تم الحفظ: سيُعرض في صفحة الدخول عندما يؤشّر الطرف الآخر أيضًا.',
  'La page d’entrée est publique : l’entreprise, vos deux prénoms, la promo du lauréat et le mois y apparaissent seulement si vous cochez tous les deux. Tu peux décocher à tout moment.': 'صفحة الدخول عمومية: تظهر فيها الشركة واسماكما الشخصيان ودفعة الخريج والشهر، فقط إذا أشّرتما معًا. يمكنك إلغاء التأشير في أي وقت.',
}, [
  [/^\+(\d+) depuis ta dernière visite$/, n => `+${n} منذ زيارتك الأخيرة`],
  [/^Guide de l’étranger : (.+)$/, x => `دليل الخارج: ${x}`],
  [/^Entretien partagé : (.+)$/, x => `مقابلة مشتركة: ${x}`],
  [/^Avis de stage : (.+)$/, x => `رأي حول تدريب: ${x}`],
  [/^Vérifié : recrutement déclaré par (.+), confirmé par toi$/, n => `موثّق: توظيف بتصريح من ${n === 'un lauréat' ? 'خريج' : n}، وبتأكيد منك`],
  [/^Ton recrutement chez (.+) est vérifié des deux côtés\. Un petit mot fera très plaisir à (.+)\.$/, (e, p) => `توظيفك في ${e} مؤكَّد من الطرفين. كلمة شكر صغيرة ستُسعد ${p} كثيرًا.`],
  [/^Ton recrutement chez (.+) est vérifié des deux côtés\.$/, e => `توظيفك في ${e} مؤكَّد من الطرفين.`],
  [/^Dire merci à (.+)$/, p => `قل شكرًا لـ${p}`],
  [/^Bienvenue, (.+)$/, n => `مرحبًا ${n}`],
  [/^(\d+) min$/, n => arCount(n, ['دقيقة', 'دقيقتان', 'دقائق', 'دقيقة'])],
  // Mon espace : l'historique des points (les plus anciens à la demande), « Annuler » d'un recrutement en attente
  [/^Voir les (\d+) plus anciens$/, n => `عرض الأقدم (${n})`],
  [/^Annuler le recrutement déclaré pour (.+)$/, n => `إلغاء التوظيف المصرَّح به (${n === 'un étudiant' ? 'طالب' : n})`],
]);
