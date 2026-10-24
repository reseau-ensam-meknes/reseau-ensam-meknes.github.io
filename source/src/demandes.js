// Demandes des étudiants : l'étudiant dit ce qu'il cherche (stage, PFE, étranger, emploi), CV joint ;
// des lauréats proposent leur aide (recruter, encadrer, recommander) ; il en accepte une : c'est un match.
// Quand il a commencé, le lauréat le déclare et l'étudiant confirme : la réussite est vérifiée des deux côtés et annoncée.
// Les règles sont celles de la base (protect_demande, protect_proposition, protect_placement).
import { html, useState, useEffect, useRef } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Avatar, roleTexte, useBusy, toast, injectCSS, celebrate, TYPE_ICON, allerAuChamp } from './ui.js';
import { useBrouillon } from './ui.js';
import { proposerPrevenir } from './pwa.js';
import { addAR, arCount, t as tr } from './i18n.js';
import { TYPES, AIDES, DEMANDES_MAX, typesDemande, demandesActives, demandeEnPause, demandesPour, niveauOf, timeAgo, fmtDate, placementOf, etatAide, AIDE_OUVERTE, manquesDemande } from './logic.js';
import { CV_MAX } from './store.js';
import { CvButton, OuvrirCV } from './cv.js';
import { MessageBtn } from './messages.js';
import { SignalerBtn } from './confiance.js';

const prenom = p => (p?.full_name || '').split(' ')[0] || 'L’étudiant';
const ACTIVES = ['ouverte', 'match'];
const ORDRE = { match: 0, ouverte: 1, pourvue: 2, fermee: 3 };
const parOrdre = (a, b) => ORDRE[a.status] - ORDRE[b.status] || new Date(b.created_at) - new Date(a.created_at);
const PILL = { ouverte: ['m-demande', 'Ouverte'], pause: ['m-refusee', 'En pause'], match: ['m-acceptee', 'Match'], pourvue: ['m-terminee', 'Réussie'], fermee: ['m-refusee', 'Fermée'] };
const EXEMPLES = {
  stage: 'Ex. Stage d’été de 4A en maintenance ou en qualité',
  pfe: 'Ex. PFE en supply chain ou en amélioration continue',
  etranger: 'Ex. Stage de 4 à 6 mois en France ou au Canada',
  emploi: 'Ex. Premier poste en méthodes, qualité ou data',
};
const doux = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
// La déclaration de démarrage liée à cette demande (refusée par l'étudiant : on peut la refaire)
const declarationDe = (data, d) => data.placements.find(p => p.demande_id === d.id && p.status !== 'refuse') || null;

function TypeTag({ type }) {
  return html`<span class="mini dm-type"><${Icon} name=${TYPE_ICON[type] || 'briefcase'} size=${12}/> ${TYPES[type]?.label || type}</span>`;
}
function Pill({ d }) {
  const [cls, label] = PILL[demandeEnPause(d) ? 'pause' : d.status] || PILL.ouverte;
  return html`<span class=${'state-pill ' + cls}>${label}</span>`;
}
// Où, quand, combien de temps : écrit par l'étudiant, jamais traduit
function Meta({ d }) {
  const bits = [d.lieu ? html`<span><${Icon} name="pin" size=${13}/> <span translate="no" dir="auto">${d.lieu}</span></span>` : null,
    d.debut ? html`<span><${Icon} name="calendar" size=${13}/> ${`Dès le ${fmtDate(d.debut)}`}</span>` : null,
    d.duree ? html`<span><${Icon} name="clock" size=${13}/> <span translate="no" dir="auto">${d.duree}</span></span>` : null];
  return html`<p class="dm-meta small muted">${bits.filter(Boolean)}<span>${timeAgo(d.created_at)}</span></p>`;
}
// Trois étapes : demande publiée, match, démarrage confirmé
function Etapes({ d }) {
  const i = d.status === 'pourvue' ? 3 : d.status === 'match' ? 2 : 1;
  return html`<ol class="dm-etapes" aria-label="Où en est la demande">${['Demande publiée', 'Match', 'Démarrage confirmé'].map((t, k) => html`<li class=${k < i ? 'fait' : k === i ? 'ici' : ''}><span class="dm-pt">${k < i ? html`<${Icon} name="check" size=${12}/>` : k + 1}</span><span>${t}</span></li>`)}</ol>`;
}
function Aide({ x }) {
  const a = AIDES[x.aide];
  return html`<p class="dm-aide"><span class="mini good"><${Icon} name=${a?.icon || 'heart'} size=${12}/> ${a?.court || ''}</span> <strong translate="no" dir="auto">${x.entreprise}</strong>${x.poste ? html` · <span translate="no" dir="auto">${x.poste}</span>` : null}</p>`;
}

// ---------------------------------------------------------------------------
// L'onglet « Demandes » de la page Offres
// ---------------------------------------------------------------------------
export function DemandesTab({ ctx }) {
  const { me, sub2, saison } = ctx;
  const [form, setForm] = useState(null);
  const focusId = sub2 && sub2 !== 'nouvelle' ? sub2 : null;
  // Redirection : l'entrée prend sa nouvelle adresse telle quelle (exact), sans Retour simulé qui refermerait le formulaire
  useEffect(() => { if (sub2 === 'nouvelle') { ctx.go('offres/demandes', { exact: true }); setForm({}); } }, [sub2]);
  useEffect(() => {
    if (!focusId) return;
    const t = setTimeout(() => document.getElementById('dm-' + focusId)?.scrollIntoView({ block: 'center', behavior: doux() }), 250);
    return () => clearTimeout(t);
  }, [focusId]);
  const peutPublier = typesDemande(me, saison).length > 0;
  const fermer = () => setForm(null);
  return html`<div class="dm-page">
    ${me.role === 'admin' ? html`<${DemandesAdmin} ctx=${ctx} focusId=${focusId}/>` : null}
    ${me.role === 'laureat' ? html`<${DemandesLaureat} ctx=${ctx} focusId=${focusId}/>` : null}
    ${peutPublier ? html`<${MesDemandes} ctx=${ctx} focusId=${focusId} onNew=${() => setForm({})} onEdit=${d => setForm({ d })}/>` : null}
    ${me.role === 'etudiant' && !peutPublier ? html`<${Empty} icon="send" scene="demandes" title="Les demandes arrivent en 3e année">À partir de la 3e année, tu pourras dire aux lauréats le stage que tu cherches, CV joint. En attendant, demande-leur un conseil dans Mentorat.<//>` : null}
    ${form ? html`<${DemandeForm} ctx=${ctx} d=${form.d || null} onClose=${fermer}/>` : null}
  </div>`;
}

// ---------------------------------------------------------------------------
// Côté étudiant (ou lauréat qui cherche un emploi) : ses demandes
// ---------------------------------------------------------------------------
function Comment({ laureat = false }) {
  const steps = laureat
    ? [['file', 'Un étudiant publie ce qu’il cherche, CV joint'], ['heart', 'Tu proposes : recruter, encadrer ou recommander'], ['trophy', 'Il accepte, puis confirme son démarrage : c’est annoncé']]
    : [['send', 'Tu dis ce que tu cherches, CV joint'], ['people', 'Des lauréats te proposent leur aide'], ['trophy', 'Tu choisis, vous démarrez : c’est annoncé']];
  return html`<ol class="how">${steps.map(([ic, t], i) => html`<li><span class="how-n">${i + 1}</span><${Icon} name=${ic} size=${18}/><span>${t}</span></li>`)}</ol>`;
}

function MesDemandes({ ctx, focusId, onNew, onEdit }) {
  const { data, me } = ctx;
  const mine = (data.demandes || []).filter(d => d.auteur_id === me.id).sort(parOrdre);
  const actives = mine.filter(d => ACTIVES.includes(d.status));
  const anciennes = mine.filter(d => !ACTIVES.includes(d.status));
  const peutPlus = actives.length < DEMANDES_MAX;
  const laureat = me.role === 'laureat';
  if (!mine.length) return html`<section class="panel dm-hero">
    ${laureat ? html`<p class="eyebrow">Un nouveau poste ?</p>` : null}
    <h2>${laureat ? 'Dis-le aux lauréats du réseau' : 'Dis aux lauréats ce que tu cherches'}</h2>
    <p class="muted">${laureat ? 'Ta demande et ton CV arrivent chez les lauréats de ton parcours. Ceux qui recrutent ou peuvent te recommander te le proposent, tu choisis.' : 'Stage, PFE, étranger ou emploi : ta demande et ton CV arrivent chez les lauréats de ton parcours. Ceux qui peuvent t’aider te le proposent, tu choisis.'}</p>
    <${Comment}/>
    <div class="row"><button type="button" id="dm-nouvelle" class="btn primary" onClick=${onNew}><${Icon} name="send" size=${16}/> Publier ma demande</button></div>
  </section>`;
  return html`<section class="m-section dm-mes">
    <div class="m-head"><h2 class="h-ico"><${Icon} name="send"/> ${laureat ? 'Ma demande d’emploi' : 'Mes demandes'}</h2><span class="spacer"></span>
      ${peutPlus ? html`<button type="button" id="dm-nouvelle" class="btn small" onClick=${onNew}><${Icon} name="plus" size=${15}/> Nouvelle demande</button>` : html`<span class="small muted">2 demandes en cours au plus</span>`}</div>
    <div class="list">${actives.map(d => html`<${CarteAuteur} key=${d.id} ctx=${ctx} d=${d} focus=${d.id === focusId} onEdit=${() => onEdit(d)}/>`)}</div>
    ${anciennes.length ? html`<details class="dm-anciennes" open=${anciennes.some(d => d.id === focusId) || !actives.length}><summary>${anciennes.length > 1 ? `Anciennes demandes (${anciennes.length})` : 'Ancienne demande'}</summary>
      <div class="list">${anciennes.map(d => html`<${CarteAuteur} key=${d.id} ctx=${ctx} d=${d} focus=${d.id === focusId}/>`)}</div></details>` : null}
  </section>`;
}

function CarteAuteur({ ctx, d, focus, onEdit }) {
  const { data, store, act, me } = ctx;
  const props = (data.propositions || []).filter(x => x.demande_id === d.id);
  const envoyees = props.filter(x => x.status === 'envoyee').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const pause = demandeEnPause(d);
  // Fermer ou rouvrir se fait d'un geste : « Annuler » dans le message du bas remet l'état d'avant.
  // Des propositions attendent une réponse : elles seraient closes pour de bon, alors on demande d'abord.
  const changer = (status, mot, retour) => act(async () => { await store.update('demandes', d.id, { status }); toast(mot, 'ok', 0, retour ? { annuler: retour } : {}); });
  const FERMEE = 'Demande fermée.', ROUVERTE = 'Demande rouverte : les lauréats la voient de nouveau.';
  const fermer = () => (envoyees.length
    ? ctx.confirm('Fermer ta demande ? Les lauréats ne la verront plus. Tu pourras la rouvrir.', () => changer('fermee', FERMEE), 'Fermer la demande')
    : changer('fermee', FERMEE, () => changer('ouverte', ROUVERTE)));
  const rouvrir = () => changer('ouverte', ROUVERTE, () => changer('fermee', FERMEE));
  const supprimer = () => ctx.confirm('Supprimer cette demande ? Elle disparaît pour tout le monde.', () => act(async () => { await store.remove('demandes', d.id); toast('Demande supprimée.'); }), 'Supprimer');
  const relancer = () => act(async () => { await store.update('demandes', d.id, { relancee_at: new Date().toISOString() }); toast('Demande relancée : les lauréats la voient de nouveau.'); });
  return html`<article class=${'dm-card st-' + d.status + (focus ? ' dm-focus' : '')} id=${'dm-' + d.id}>
    <div class="dm-head"><${TypeTag} type=${d.type}/><span class="spacer"></span><${Pill} d=${d}/></div>
    <h3 class="dm-titre" translate="no" dir="auto">${d.titre}</h3>
    <${Meta} d=${d}/>
    ${d.status === 'ouverte' ? html`<p class="dm-details" translate="no" dir="auto">${d.details}</p>` : null}
    ${d.status !== 'fermee' ? html`<${Etapes} d=${d}/>` : null}

    ${d.status === 'ouverte' && pause ? html`<div class="dm-box warn"><${Icon} name="clock" size=${18}/><p>Ta demande est en pause : 60 jours sans nouvelle. Relance-la si tu cherches toujours, elle revient chez les lauréats.</p><button type="button" class="btn small primary" onClick=${relancer}>Relancer ma demande</button></div>` : null}
    ${d.status === 'ouverte' ? (envoyees.length
      ? html`<div class="dm-props"><p class="eyebrow">${envoyees.length > 1 ? `${envoyees.length} lauréats te proposent leur aide` : 'Un lauréat te propose son aide'}</p>${envoyees.map(x => html`<${PropositionRecue} key=${x.id} ctx=${ctx} d=${d} x=${x}/>`)}</div>`
      : !pause ? html`<p class="small muted dm-attente"><${Icon} name="bell" size=${15}/> <span>Les lauréats de ton parcours sont prévenus. Leurs propositions arrivent ici et dans tes messages.</span></p>` : null) : null}
    ${d.status === 'match' ? html`<${MatchAuteur} ctx=${ctx} d=${d}/>` : null}
    ${d.status === 'pourvue' ? html`<${ReussiteAuteur} ctx=${ctx} d=${d}/>` : null}

    <div class="dm-acts">
      ${!me.cv_path && d.status === 'ouverte' ? html`<span class="small warn-t">Ton CV n’est plus joint : ajoute-le dans ton profil.</span>` : null}
      <span class="spacer"></span>
      ${d.status === 'ouverte' && onEdit ? html`<button type="button" class="btn tiny ghost" onClick=${onEdit}><${Icon} name="edit" size=${14}/> Modifier</button>` : null}
      ${d.status === 'ouverte' ? html`<button type="button" class="btn tiny ghost" onClick=${fermer}><${Icon} name="x" size=${14}/> Fermer</button>` : null}
      ${d.status === 'fermee' ? html`<button type="button" class="btn tiny" onClick=${rouvrir}>Rouvrir</button><button type="button" class="btn tiny ghost" onClick=${supprimer}><${Icon} name="trash" size=${14}/> Supprimer</button>` : null}
    </div>
  </article>`;
}

// Une aide reçue : qui, quoi, son mot ; on l'accepte (c'est un match) ou on dit non merci
function PropositionRecue({ ctx, d, x }) {
  const { store, act, openProfile, me } = ctx;
  const l = store.byId('profiles', x.laureat_id);
  const [oui, setOui] = useState(false);
  // Le match : les deux visages se rejoignent (le sien, puis celui du lauréat), une seule fois par aide
  const accepter = () => act(async () => {
    await store.update('propositions', x.id, { status: 'acceptee' });
    setOui(false);
    if (!celebrate({ cle: 'match-' + x.id, icon: 'heart', visages: [me, l], titre: 'C’est un match !', texte: `Parle avec ${prenom(l)} de la suite. Quand tu commences, ${prenom(l)} le déclare et tu confirmes : ta réussite sera annoncée.`, action: { label: `Écrire à ${prenom(l)}`, icon: 'chat', onClick: () => ctx.ecrire?.(x.laureat_id) } })) toast('C’est un match ! Écris-lui pour la suite.', 'win');
  });
  const nonMerci = () => act(async () => { await store.update('propositions', x.id, { status: 'declinee' }); toast('C’est noté. Merci pour ta réponse.'); });
  return html`<div class="dm-prop">
    <div class="dm-prop-head"><${Person} p=${l} onOpen=${openProfile} size=${36}/><span class="spacer"></span><span class="small muted">${timeAgo(x.created_at)}</span></div>
    <${Aide} x=${x}/>
    <p class="quote" translate="no" dir="auto">${x.message}</p>
    <div class="row dm-prop-acts"><button type="button" class="btn small tonal dm-accepter" aria-haspopup="dialog" onClick=${() => setOui(true)}><${Icon} name="check" size=${15}/> Accepter</button>
      <${MessageBtn} ctx=${ctx} p=${l} cls="btn small ghost"/><span class="spacer"></span>
      <button type="button" class="btn small ghost" onClick=${nonMerci}>Non merci</button></div>
    ${oui ? html`<${AccepterAide} l=${l} x=${x} onYes=${accepter} onClose=${() => setOui(false)}/>` : null}
  </div>`;
}

// « Oui, accepter » : le visage de qui on choisit, ce qu'il propose, et ce que le choix change
function AccepterAide({ l, x, onYes, onClose }) {
  const [busy, run] = useBusy();
  const nom = l?.full_name || 'Un lauréat';
  return html`<${Modal} title=${l ? `Accepter l’aide de ${prenom(l)} ?` : 'Accepter cette aide ?'} onClose=${onClose} cls="dm-oui-feuille">
    <div class="dm-oui-qui"><${Avatar} p=${l} size=${72}/><strong translate="no" dir="auto">${nom}</strong>${l ? html`<span class="small muted">${roleTexte(l, true)}</span>` : null}<${Aide} x=${x}/></div>
    <p class="dm-oui-txt">Les autres propositions seront closes, et vous verrez vos coordonnées.</p>
    <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Pas maintenant</button><button type="button" class="btn primary dm-oui" aria-busy=${busy ? 'true' : undefined} disabled=${busy} onClick=${run(onYes)}><${Icon} name="heart" size=${16}/> Oui, accepter</button></div>
  <//>`;
}

// Le match, côté étudiant : avec qui, la suite, et la confirmation du démarrage
function MatchAuteur({ ctx, d }) {
  const { data, store, act, openProfile } = ctx;
  const x = store.byId('propositions', d.proposition_id);
  const l = store.byId('profiles', d.laureat_id);
  const pl = declarationDe(data, d);
  const arreter = () => ctx.confirm(`Ça ne s’est pas fait avec ${prenom(l)} ? Ta demande se rouvre et d’autres lauréats pourront te proposer leur aide.`, () => act(async () => { await store.update('demandes', d.id, { status: 'ouverte' }); toast('Ta demande est de nouveau ouverte.'); }), 'Rouvrir ma demande');
  const trouve = () => ctx.confirm('Tu as trouvé autrement ? Ta demande sera fermée. Pense à l’indiquer dans Mon parcours.', () => act(async () => { await store.update('demandes', d.id, { status: 'fermee' }); toast('Bravo ! Ta demande est fermée.', 'win'); ctx.go('parcours'); }), 'Fermer ma demande');
  const confirmer = () => act(async () => {
    await store.update('placements', pl.id, { status: 'confirme' });
    if (ctx.me?.role === 'laureat' && ctx.me.en_recherche) await store.update('profiles', ctx.me.id, { en_recherche: false }).catch(() => {});
    if (!celebrate({ cle: 'demande-reussie-' + d.id, icon: 'trophy', titre: 'Félicitations, c’est officiel !', texte: `Ta réussite chez ${pl.entreprise} est vérifiée des deux côtés et annoncée dans le réseau. Un petit merci fera plaisir à ${prenom(l)}.`, action: { label: `Dire merci à ${prenom(l)}`, icon: 'heart', onClick: () => ctx.go('parcours') } })) toast('Félicitations ! Ta réussite est confirmée.', 'win');
  });
  return html`<div class="dm-match">
    <p class="eyebrow"><${Icon} name="heart" size=${13}/> C’est un match</p>
    <div class="dm-prop-head"><${Person} p=${l} onOpen=${openProfile} size=${40}/><span class="spacer"></span><${MessageBtn} ctx=${ctx} p=${l} cls="btn small"/></div>
    ${x ? html`<${Aide} x=${x}/>` : null}
    ${pl && pl.status === 'en_attente' ? html`<div class="dm-box accent"><${Icon} name="briefcase" size=${18}/><p><strong>${`${prenom(l)} indique que tu as commencé chez ${pl.entreprise}.`}</strong> <span class="small">Une fois confirmé, ta réussite est vérifiée des deux côtés et annoncée.</span></p>
        <div class="row"><button type="button" class="btn small ghost" onClick=${() => act(async () => { await store.update('placements', pl.id, { status: 'refuse' }); toast('C’est noté. Le lauréat sera informé.'); })}>Pas encore</button>
        <button type="button" class="btn small primary dm-confirmer" onClick=${confirmer}><${Icon} name="check" size=${15}/> Oui, je confirme</button></div></div>`
      : html`<p class="small muted">${`Vous avez accès à vos coordonnées. Quand tu commences, ${prenom(l)} le déclare ici et tu confirmes.`}</p>`}
    <div class="row dm-sortie"><button type="button" class="linkish small" onClick=${arreter}>Ça ne s’est pas fait</button><button type="button" class="linkish small" onClick=${trouve}>J’ai trouvé autrement</button></div>
  </div>`;
}

function ReussiteAuteur({ ctx, d }) {
  const { data, store, go, openProfile } = ctx;
  const l = store.byId('profiles', d.laureat_id);
  const pl = data.placements.find(p => p.demande_id === d.id && p.status === 'confirme');
  return html`<div class="dm-box good"><${Icon} name="trophy" size=${18}/><p>${pl ? `Réussite confirmée chez ${pl.entreprise}, avec ${l?.full_name || 'un lauréat'}.` : 'Réussite confirmée.'}</p>
    ${pl && !pl.merci ? html`<button type="button" class="btn small" onClick=${() => go('parcours')}><${Icon} name="heart" size=${14}/> Dire merci</button>` : l ? html`<button type="button" class="btn tiny ghost" onClick=${() => openProfile(l)}>Voir son profil</button>` : null}</div>`;
}

// ---------------------------------------------------------------------------
// Publier ou modifier une demande : ce que je cherche, où, quand ; CV joint
// ---------------------------------------------------------------------------
function DemandeForm({ ctx, d = null, onClose }) {
  const { me, store, act, saison } = ctx;
  const types = typesDemande(me, saison);
  // Une nouvelle demande en cours d'écriture reste sur l'appareil (session expirée, rechargement)
  const [f, setF, oublierBrouillon] = useBrouillon(d ? null : me.id + ':demande', () => ({ type: d?.type || types[0], titre: d?.titre || '', details: d?.details || '', lieu: d?.lieu || '', debut: d?.debut || '', duree: d?.duree || '' }));
  const [busy, setBusy] = useState(false);
  const input = useRef();
  const set = k => e => setF({ ...f, [k]: e.target.value });
  // « Publier » reste actif et au pouce : s'il manque quelque chose, il mène au premier champ à compléter
  const [tente, setTente] = useState(false);
  const manques = manquesDemande(f, me);
  const ok = !manques.length && types.includes(f.type);
  const nd = f.details.trim().length, reste = 20 - nd;
  const MSG = { titre: 'Dis-le en une phrase : 4 caractères au moins.',
    details: nd ? `Encore ${reste} caractère${reste > 1 ? 's' : ''} au moins.` : 'Quelques lignes suffisent : 20 caractères au moins.' };
  const err = k => (tente && manques.includes(k) ? MSG[k] : null);
  const aria = k => (err(k) ? { 'aria-invalid': 'true', 'aria-describedby': `dm-${k}-err` } : {});
  const deposer = file => {
    if (!file) return;
    if (file.size > CV_MAX) { toast('Le fichier dépasse 2 Mo. Exporte ton CV en PDF plus léger.', 'err'); return; }
    setBusy(true);
    act(async () => { await store.deposerCV(file); toast('CV déposé.'); }).finally(() => { setBusy(false); if (input.current) input.current.value = ''; });
  };
  const envoyer = e => {
    e.preventDefault();
    if (manques.length) { setTente(true); allerAuChamp({ titre: 'dm-titre', details: 'dm-details', cv: 'dm-cv' }[manques[0]]); return; }
    if (!ok) return;
    act(async () => {
      const champs = { type: f.type, titre: f.titre.trim(), details: f.details.trim(), lieu: f.lieu.trim() || null, debut: f.debut || null, duree: f.duree.trim() || null };
      if (d) { await store.update('demandes', d.id, champs); toast('Demande mise à jour.'); onClose(); return; }
      await store.insert('demandes', { auteur_id: me.id, ...champs });
      oublierBrouillon(); onClose();
      const mot = 'Demande publiée. Les lauréats de ton parcours sont prévenus.';
      if (celebrate({ cle: 'premiere-demande-' + me.id, icon: 'send', titre: 'Ta demande est publiée', texte: 'Les lauréats de ton parcours sont prévenus. Leurs propositions arriveront ici et dans tes messages.' })) proposerPrevenir('demande');
      else if (!proposerPrevenir('demande', mot)) toast(mot, 'envoi');
    });
  };
  const pied = html`<button class="btn primary" type="submit" form="dm-form" id="dm-publier">${d ? 'Enregistrer' : 'Publier ma demande'}</button>`;
  return html`<${Modal} title=${d ? 'Modifier ma demande' : 'Publier ma demande'} onClose=${onClose} footer=${pied}>
    <form class="form dm-form" id="dm-form" noValidate onSubmit=${envoyer}>
      ${types.length > 1 ? html`<div class="field"><span class="field-label">Je cherche</span><div class="chips" role="radiogroup" aria-label="Je cherche">${types.map(t => html`<button type="button" role="radio" aria-checked=${f.type === t} class=${'chip' + (f.type === t ? ' on' : '')} id=${'dm-type-' + t} onClick=${() => setF({ ...f, type: t })}><${Icon} name=${TYPE_ICON[t]} size=${14}/> ${TYPES[t].label}</button>`)}</div></div>`
        : html`<p class="small muted"><${Icon} name=${TYPE_ICON[f.type] || 'briefcase'} size=${14}/> ${`Je cherche : ${TYPES[f.type]?.label || ''}`}</p>`}
      <${Field} label="En une phrase" err=${err('titre')} errId="dm-titre-err"><input id="dm-titre" dir="auto" maxlength="120" value=${f.titre} onInput=${set('titre')} placeholder=${EXEMPLES[f.type] || ''} ...${aria('titre')} required/><//>
      <${Field} label="Ce que tu cherches et ce que tu sais faire" err=${err('details')} errId="dm-details-err" hint="Domaine, missions qui te plaisent, compétences, contraintes (dates, mobilité). Les lauréats décident sur ces lignes et ton CV."><textarea id="dm-details" dir="auto" rows="4" maxlength="1500" value=${f.details} onInput=${set('details')} ...${aria('details')} placeholder="Ex. Je cherche un PFE de 6 mois en lean ou supply chain. J’ai fait mon stage de 4A en méthodes chez un équipementier ; je maîtrise VSM, SMED et Power BI." required></textarea><//>
      <div class="grid2"><${Field} label="Où (facultatif)"><input id="dm-lieu" dir="auto" maxlength="120" value=${f.lieu} onInput=${set('lieu')} placeholder="Ex. Casablanca, Tanger ou à distance"/><//>
        <${Field} label="À partir du (facultatif)"><input id="dm-debut" type="date" value=${f.debut || ''} onInput=${set('debut')}/><//></div>
      <${Field} label="Durée (facultatif)"><input id="dm-duree" dir="auto" maxlength="40" value=${f.duree} onInput=${set('duree')} placeholder="Ex. 2 mois, 6 mois, CDI"/><//>
      <input ref=${input} id="dm-cv-file" type="file" accept="application/pdf,.pdf" hidden onChange=${e => deposer(e.target.files[0])}/>
      ${me.cv_path ? html`<p class="small hint-box"><${Icon} name="file" size=${15}/> <span>Ton CV PDF est joint. Les lauréats le voient tant que ta demande est ouverte.</span> <${OuvrirCV} store=${store} path=${me.cv_path} label="Voir" cls="btn tiny ghost"/></p>`
        : html`<button type="button" id="dm-cv" class=${'cv-drop' + (tente && manques.includes('cv') ? ' manque' : '')} disabled=${busy} onClick=${() => input.current?.click()}><span class="cv-ico"><${Icon} name="upload" size=${22}/></span><strong>${busy ? 'Envoi en cours…' : 'Joins ton CV en PDF'}</strong><span class="small muted">Obligatoire : c’est la première chose que regardent les lauréats. PDF, 2 Mo maximum.</span></button>`}
      <p class="small muted"><${Icon} name="lock" size=${14}/> Visible par les lauréats seulement. Tes coordonnées restent cachées jusqu’au match.</p>
    </form>
  <//>`;
}

// ---------------------------------------------------------------------------
// Côté lauréat : les demandes de son parcours, ses aides proposées, ses matchs
// ---------------------------------------------------------------------------
function DemandesLaureat({ ctx, focusId }) {
  const { data, me, store } = ctx;
  const byId = id => store.byId('profiles', id);
  const tous = demandesPour(data, me, byId);
  const libres = tous.filter(x => !x.mienne);
  const [proche, setProche] = useState(() => libres.some(x => x.prox >= 1));
  const [type, setType] = useState('tous');
  const types = [...new Set(libres.map(x => x.d.type))];
  const liste = libres.filter(x => (!proche || x.prox >= 1) && (type === 'tous' || x.d.type === type));
  const mesAides = (data.propositions || []).filter(x => x.laureat_id === me.id).map(x => ({ x, d: store.byId('demandes', x.demande_id) })).filter(y => y.d)
    .sort((a, b) => (a.x.status === 'acceptee' && a.d.status === 'match' ? 0 : 1) - (b.x.status === 'acceptee' && b.d.status === 'match' ? 0 : 1) || new Date(b.x.created_at) - new Date(a.x.created_at));
  const enCours = mesAides.filter(({ x, d }) => (x.status === 'acceptee' && d.status === 'match') || x.status === 'envoyee');
  const passees = mesAides.filter(y => !enCours.includes(y));
  const vues = new Set([...liste.map(x => x.d.id), ...mesAides.map(y => y.d.id)]);
  const seule = focusId && !vues.has(focusId) ? store.byId('demandes', focusId) : null;
  return html`<div class="dm-laureat">
    ${seule && seule.auteur_id !== me.id ? html`<section class="m-section"><div class="list"><${CarteLaureat} ctx=${ctx} d=${seule} focus/></div></section>` : null}
    ${enCours.length ? html`<section class="m-section"><div class="m-head"><h2 class="h-ico"><${Icon} name="heart"/> Mes aides en cours</h2></div>
      <div class="list">${enCours.map(({ d }) => html`<${CarteLaureat} key=${d.id} ctx=${ctx} d=${d} focus=${d.id === focusId}/>`)}</div></section>` : null}
    <section class="m-section">
      ${enCours.length || (seule && seule.auteur_id !== me.id) ? html`<div class="m-head"><h2 class="h-ico"><${Icon} name="send"/> Ils cherchent</h2></div>` : html`<h2 class="sr-only">Ils cherchent</h2>`}
      ${!enCours.length && !passees.length ? html`<details class="m-how" open=${!libres.length}><summary>Comment ça marche ?</summary><${Comment} laureat/></details>` : null}
      ${libres.length ? html`<div class="chips offres-chips dm-filtres" role="group" aria-label="Filtrer les demandes">
        <button type="button" class=${'chip' + (proche ? ' on' : '')} aria-pressed=${proche} onClick=${() => setProche(!proche)}>${proche ? html`<${Icon} name="check" size=${15}/>` : null}Proches de ma filière</button>
        ${types.length > 1 ? html`<span class="chips-sep" aria-hidden="true"></span>${['tous', ...types].map(t => html`<button type="button" class=${'chip' + (type === t ? ' on' : '')} aria-pressed=${type === t} onClick=${() => setType(t)}>${t === 'tous' ? 'Tout' : TYPES[t].label}</button>`)}` : null}
      </div>` : null}
      ${liste.length ? html`<div class="list">${liste.map(({ d, why }) => html`<${CarteLaureat} key=${d.id} ctx=${ctx} d=${d} why=${why} focus=${d.id === focusId}/>`)}</div>`
        : libres.length ? html`<p class="small muted">Rien de ce côté pour l’instant. <button type="button" class="linkish" onClick=${() => { setProche(false); setType('tous'); }}>Voir toutes les demandes</button></p>`
        : html`<${Empty} icon="send" scene="demandes" title="Pas de demande ouverte pour le moment" action=${ctx.publierOffre ? { label: 'Publier une offre', icon: 'plus', onClick: ctx.publierOffre } : null}>Dès qu’un étudiant de ton parcours publie ce qu’il cherche, on te prévient. En attendant, une offre publiée lui parle tout de suite.<//>`}
    </section>
    ${passees.length ? html`<details class="dm-anciennes"><summary>${passees.length > 1 ? `Mes aides passées (${passees.length})` : 'Mon aide passée'}</summary>
      <div class="list">${passees.map(({ d }) => html`<${CarteLaureat} key=${d.id} ctx=${ctx} d=${d}/>`)}</div></details>` : null}
  </div>`;
}

function CarteLaureat({ ctx, d, why = [], focus = false }) {
  const { data, me, store, act, openProfile } = ctx;
  const a = store.byId('profiles', d.auteur_id);
  const mienne = (data.propositions || []).find(x => x.demande_id === d.id && x.laureat_id === me.id) || null;
  const e = etatAide(data, me, d);  // une seule feuille « Je peux aider » pour tous les points d'entrée
  const retirer = () => ctx.confirm(mienne?.status === 'acceptee' ? `Te retirer ? La demande de ${prenom(a)} se rouvre pour les autres lauréats.` : 'Retirer ton aide ?', () => act(async () => { await store.update('propositions', mienne.id, { status: 'retiree' }); toast('Ton aide est retirée.'); }), 'Me retirer');
  const s = mienne?.status;
  return html`<article class=${'dm-card st-' + d.status + (focus ? ' dm-focus' : '')} id=${'dm-' + d.id}>
    <div class="dm-head"><${Person} p=${a} onOpen=${openProfile} size=${40}/><span class="spacer"></span><${TypeTag} type=${d.type}/>${d.status !== 'ouverte' || demandeEnPause(d) ? html`<${Pill} d=${d}/>` : null}</div>
    <h3 class="dm-titre" translate="no" dir="auto">${d.titre}</h3>
    <${Meta} d=${d}/>
    ${d.status === 'ouverte' || s === 'envoyee' ? html`<p class="dm-details" translate="no" dir="auto">${d.details}</p>` : null}
    ${why.length && !mienne ? html`<p class="why"><span class="small muted">Pourquoi toi :</span> ${why.map(w => html`<span class="mini good">${w}</span>`)}</p>` : null}

    ${s === 'acceptee' && d.status === 'match' ? html`<${MatchLaureat} ctx=${ctx} d=${d} x=${mienne}/>` : null}
    ${s === 'acceptee' && d.status === 'pourvue' ? html`<div class="dm-box good"><${Icon} name="trophy" size=${18}/><p>${`${prenom(a)} a confirmé son démarrage. Ta réussite est annoncée dans le réseau : merci !`}</p></div>` : null}
    ${s === 'envoyee' ? html`<div class="dm-box"><${Icon} name="send" size=${18}/><div class="grow"><p><strong>Ton aide est envoyée.</strong> <span class="small muted">${`${prenom(a)} choisit parmi les propositions reçues.`}</span></p><${Aide} x=${mienne}/></div></div>` : null}
    ${s === 'declinee' ? html`<p class="small muted dm-fin"><${Icon} name="heart" size=${14}/> ${`${prenom(a)} a choisi une autre voie. Merci d’avoir proposé ton aide !`}</p>` : null}
    ${s === 'close' ? html`<p class="small muted dm-fin"><${Icon} name="heart" size=${14}/> La demande est pourvue ou fermée. Merci d’avoir proposé ton aide !</p>` : null}
    ${s === 'retiree' ? html`<p class="small muted dm-fin">Tu as retiré ton aide.</p>` : null}

    <div class="dm-acts">
      <${CvButton} ctx=${ctx} p=${a} small/>
      ${mienne && ['envoyee', 'acceptee'].includes(s) && d.status !== 'match' ? html`<${MessageBtn} ctx=${ctx} p=${a} cls="btn tiny ghost"/>` : null}
      <span class="spacer"></span>
      <${SignalerBtn} ctx=${ctx} type="demande" id=${d.id} small/>
      ${e === 'modifier' ? html`<button type="button" class="btn tiny ghost" onClick=${() => ctx.proposerAide(d.id)}><${Icon} name="edit" size=${14}/> Modifier</button><button type="button" class="btn tiny ghost" onClick=${retirer}>Retirer</button>` : null}
      ${e === 'reproposer' ? html`<button type="button" class="btn small" onClick=${() => ctx.proposerAide(d.id)}>Proposer à nouveau</button>` : null}
      ${e === 'proposer' ? html`<button type="button" class="btn small tonal dm-aider" onClick=${() => ctx.proposerAide(d.id)}><${Icon} name="heart" size=${15}/> Je peux aider</button>` : null}
    </div>
  </article>`;
}

// Le match, côté lauréat : la suite, puis la déclaration du démarrage (l'étudiant confirme)
function MatchLaureat({ ctx, d, x }) {
  const { data, store, act } = ctx;
  const a = store.byId('profiles', d.auteur_id);
  const pl = declarationDe(data, d);
  const refusee = !pl && data.placements.some(p => p.demande_id === d.id && p.status === 'refuse');
  const [declare, setDeclare] = useState(false);
  const retirer = () => ctx.confirm(`Te retirer ? La demande de ${prenom(a)} se rouvre pour les autres lauréats.`, () => act(async () => { await store.update('propositions', x.id, { status: 'retiree' }); toast('C’est noté, tu ne l’accompagnes plus. Merci de l’avoir dit.'); }), 'Me retirer');
  return html`<div class="dm-match">
    <p class="eyebrow"><${Icon} name="heart" size=${13}/> ${`C’est un match avec ${prenom(a)}`}</p>
    <${Etapes} d=${d}/>
    <${Aide} x=${x}/>
    ${pl && pl.status === 'en_attente' ? html`<div class="dm-box"><${Icon} name="clock" size=${18}/><p>${`Démarrage déclaré chez ${pl.entreprise}. En attente de la confirmation de ${prenom(a)}.`}</p></div>`
      : html`<p class="small">${refusee ? `${prenom(a)} n’a pas confirmé. Parlez-en, puis déclare à nouveau quand c’est fait.` : `Quand ${prenom(a)} commence (stage signé, PFE lancé, contrat), dis-le ici : ${prenom(a)} confirme et la réussite est annoncée.`}</p>`}
    <div class="row dm-prop-acts"><${MessageBtn} ctx=${ctx} p=${a} cls="btn small ghost"/><span class="spacer"></span>
      ${!pl ? html`<button type="button" class="linkish small" onClick=${retirer}>Me retirer</button><button type="button" class="btn small tonal dm-demarre" onClick=${() => setDeclare(true)}><${Icon} name="check" size=${15}/> ${`${prenom(a)} a commencé`}</button>` : null}</div>
    ${declare ? html`<${DeclarerDemarrage} ctx=${ctx} d=${d} x=${x} onClose=${() => setDeclare(false)}/>` : null}
  </div>`;
}

function DeclarerDemarrage({ ctx, d, x, onClose }) {
  const { me, store, act, saison, data } = ctx;
  const a = store.byId('profiles', d.auteur_id);
  const [f, setF] = useState({ entreprise: x.entreprise || me.entreprise || '', ville: d.lieu && !/[,/]| ou /i.test(d.lieu) ? d.lieu : me.ville || '', pays: me.pays || 'Maroc' });
  const envoyer = e => {
    e.preventDefault();
    act(async () => {
      const deja = placementOf(data, d.auteur_id, saison);
      if (deja && deja.status !== 'refuse') { toast(`${a?.full_name || 'Cet étudiant'} a déjà une réussite enregistrée cette année.`, 'err'); return; }
      const pays = f.pays.trim() || 'Maroc';
      await store.insert('placements', { student_id: d.auteur_id, laureat_id: me.id, demande_id: d.id, saison, niveau: Math.min(niveauOf(a, saison), 6), type: pays !== 'Maroc' && d.type !== 'emploi' ? 'etranger' : d.type, entreprise: f.entreprise.trim(), ville: f.ville.trim() || null, pays, source: 'plateforme' });
      toast(`${prenom(a)} doit maintenant confirmer. Tes 50 points arrivent dès sa confirmation.`);
      onClose();
    });
  };
  return html`<${Modal} title=${`${prenom(a)} a commencé`} onClose=${onClose}>
    <form class="form" onSubmit=${envoyer}>
      <p class="small muted">${`${prenom(a)} reçoit une demande de confirmation. Une fois confirmé, c’est vérifié des deux côtés et annoncé dans le réseau.`}</p>
      <${Field} label="Entreprise"><input id="dm-pl-ent" dir="auto" value=${f.entreprise} onInput=${e => setF({ ...f, entreprise: e.target.value })} required/><//>
      <div class="grid2"><${Field} label="Ville"><input id="dm-pl-ville" dir="auto" value=${f.ville} onInput=${e => setF({ ...f, ville: e.target.value })}/><//><${Field} label="Pays"><input id="dm-pl-pays" dir="auto" value=${f.pays} onInput=${e => setF({ ...f, pays: e.target.value })}/><//></div>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" id="dm-pl-ok" disabled=${f.entreprise.trim().length < 2}>Déclarer</button></div>
    </form>
  <//>`;
}

// « Je peux aider » en un geste : une feuille du bas ouverte sur place (accueil, cloche, carte), déjà remplie.
// Sa demande et son CV en haut, l'aide préchoisie d'après le type, « Chez … » replié, un mot prêt ; un seul bouton, au pouce.
const AIDE_PAR_TYPE = { pfe: 'encadre', emploi: 'recrute', stage: 'recommande', etranger: 'recommande' };
const CHOIX = { recrute: 'Recruter', encadre: 'Encadrer', recommande: 'Recommander' };
const MOT = {
  recrute: p => `Bonjour ${p}, j’ai lu ta demande et ton CV. Je peux te proposer une place dans mon équipe. Réponds-moi quand tu veux, on en parle.`,
  encadre: p => `Bonjour ${p}, j’ai lu ta demande et ton CV. Je peux t’encadrer dans mon entreprise. Réponds-moi quand tu veux, on en parle.`,
  recommande: p => `Bonjour ${p}, j’ai lu ta demande et ton CV. Je peux te recommander dans mon entreprise. Réponds-moi quand tu veux, on en parle.`,
};
// Le mot suit la langue de l'écran ; sans les marques invisibles qui isolent le prénom
const motPret = (aide, p) => tr(MOT[aide](p)).replace(/[⁨⁩]/g, '');

export function ProposerAide({ ctx, id, onClose }) {
  const { me, store, act, data } = ctx;
  const d = store.byId('demandes', id);
  const a = d ? store.byId('profiles', d.auteur_id) : null;
  const p = prenom(a);
  const etat = etatAide(data, me, d);         // recalculé à chaque rendu : la demande peut se fermer pendant ce temps
  const [mode] = useState(etat);              // figé à l'ouverture : libellés du bouton et du toast
  const x = (data.propositions || []).find(y => y.demande_id === id && y.laureat_id === me.id) || null;
  const [f, setF, oublierBrouillon] = useBrouillon(x ? null : me.id + ':aide:' + id, () => { const aide = x?.aide || AIDE_PAR_TYPE[d?.type] || 'recommande'; return { aide, entreprise: x?.entreprise || me.entreprise || '', poste: x?.poste || '', message: x?.message || motPret(aide, p) }; });
  const [chezOuvert] = useState(() => !(x?.entreprise || me.entreprise || '').trim());
  const [lire, setLire] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tente, setTente] = useState(false);
  useEffect(() => { if (etat === 'non') onClose(); }, [etat]);
  if (etat === 'non') return null;
  const possible = AIDE_OUVERTE.includes(etat);
  // Changer d'aide réécrit le mot seulement s'il n'a pas été retouché
  const choisir = k => setF(v => ({ ...v, aide: k, message: v.message === motPret(v.aide, p) ? motPret(k, p) : v.message }));
  // « Proposer mon aide » reste actif : après un essai, seuls les champs à compléter sont signalés, et il mène au premier
  const manques = { entreprise: f.entreprise.trim().length < 2, message: f.message.trim().length < 10 };
  const ok = !!AIDES[f.aide] && !manques.entreprise && !manques.message;
  const errAide = k => (tente && manques[k] ? (k === 'entreprise' ? 'Indique l’entreprise où tu peux aider.' : 'Écris-lui quelques mots (10 caractères au moins).') : null);
  const ariaAide = (k, idErr) => (errAide(k) ? { 'aria-invalid': 'true', 'aria-describedby': idErr } : {});
  const envoyer = e => {
    e.preventDefault();
    if (!possible || busy) return;
    if (!ok) { setTente(true); setTimeout(() => allerAuChamp(manques.entreprise ? 'dm-p-ent' : 'dm-p-msg'), 0); return; }
    setBusy(true);
    act(async () => {
      const champs = { aide: f.aide, entreprise: f.entreprise.trim(), poste: f.poste.trim() || null, message: f.message.trim() };
      if (x) await store.update('propositions', x.id, x.status === 'retiree' ? { ...champs, status: 'envoyee' } : champs);
      else await store.insert('propositions', { demande_id: d.id, laureat_id: me.id, ...champs });
      oublierBrouillon(); onClose();
      const mot = mode === 'modifier' ? 'Proposition modifiée.' : `Proposition envoyée. ${p} la reçoit aussi dans ses messages.`;
      if (mode === 'modifier' || !proposerPrevenir('proposition', mot)) toast(mot, mode === 'modifier' ? 'ok' : 'envoi');
    }).finally(() => setBusy(false));
  };
  if (!d) return html`<${Modal} title="Demandes des étudiants" onClose=${onClose}><p class="dm-box"><${Icon} name="heart" size=${18}/><span>Cette demande n’attend plus d’aide : elle est pourvue ou fermée. Merci d’avoir voulu aider !</span></p><//>`;
  const pied = possible ? html`<button class="btn primary" type="submit" form="dm-aider-form" id="dm-p-envoyer" disabled=${busy}><${Icon} name="heart" size=${16}/> ${mode === 'modifier' ? 'Enregistrer' : 'Proposer mon aide'}</button>` : null;
  return html`<${Modal} title=${`Aider ${p}`} onClose=${onClose} footer=${pied}>
    <section class="dm-resume" aria-label="Sa demande">
      <div class="dm-head"><${Person} p=${a} onOpen=${ctx.openProfile} size=${36}/><span class="spacer"></span><${TypeTag} type=${d.type}/></div>
      <p class="dm-titre-home"><strong translate="no" dir="auto">${d.titre}</strong></p>
      <${Meta} d=${d}/>
      ${lire ? html`<p class="dm-details" translate="no" dir="auto">${d.details}</p>` : null}
      <div class="dm-resume-acts"><${CvButton} ctx=${ctx} p=${a} small/><button type="button" class="linkish small" aria-expanded=${lire} onClick=${() => setLire(!lire)}>${lire ? 'Réduire' : 'Lire sa demande'}</button></div>
    </section>
    ${possible ? html`<form id="dm-aider-form" class="form dm-form" onSubmit=${envoyer}>
      <div class="field"><span class="field-label" id="dm-aide-l">Ce que tu proposes</span>
        <div class="dm-aides" role="radiogroup" aria-labelledby="dm-aide-l">${Object.keys(AIDES).map(k => html`<label key=${k} class=${'dm-aide-choix' + (f.aide === k ? ' on' : '')} title=${AIDES[k].label}>
          <input type="radio" name="dm-aide" id=${'dm-aide-' + k} value=${k} checked=${f.aide === k} onChange=${() => choisir(k)}/><span>${CHOIX[k]}</span></label>`)}</div></div>
      <details class="dm-chez" open=${chezOuvert || !!errAide('entreprise')}>
        <summary><${Icon} name="briefcase" size=${16}/><span class="grow">${f.entreprise.trim() ? `Chez ${f.entreprise.trim()}` : 'Ton entreprise'}</span><span class="linkish small">Modifier</span></summary>
        <div class="grid2"><${Field} label="Entreprise" err=${errAide('entreprise')} errId="dm-p-ent-err"><input id="dm-p-ent" dir="auto" maxlength="120" value=${f.entreprise} onInput=${e => setF({ ...f, entreprise: e.target.value })} ...${ariaAide('entreprise', 'dm-p-ent-err')}/><//>
          <${Field} label="Poste ou sujet (facultatif)"><input id="dm-p-poste" dir="auto" maxlength="140" value=${f.poste} onInput=${e => setF({ ...f, poste: e.target.value })} placeholder="Ex. PFE méthodes, stage qualité"/><//></div>
      </details>
      <${Field} label=${`Ton mot à ${p}`} err=${errAide('message')} errId="dm-p-msg-err" hint="Propose seulement ce que tu peux vraiment faire. Si ça ne se fait pas, tu pourras te retirer."><textarea id="dm-p-msg" dir="auto" rows="4" maxlength="1000" value=${f.message} onInput=${e => setF({ ...f, message: e.target.value })} ...${ariaAide('message', 'dm-p-msg-err')}></textarea><//>
    </form>` : html`<p class="dm-box"><${Icon} name="heart" size=${18}/><span>${etat === 'pause' ? `La demande de ${p} est en pause : 60 jours sans nouvelle. Elle revient ici dès qu’elle est relancée.` : 'Cette demande n’attend plus d’aide : elle est pourvue ou fermée. Merci d’avoir voulu aider !'}</span></p>`}
  <//>`;
}

// ---------------------------------------------------------------------------
// Administration : les demandes en cours, et les retirer si besoin (test, doublon, abus)
// ---------------------------------------------------------------------------
function DemandesAdmin({ ctx, focusId }) {
  const { data, store, act, openProfile } = ctx;
  const toutes = [...(data.demandes || [])].sort(parOrdre);
  const actives = toutes.filter(d => ACTIVES.includes(d.status));
  const n = s => toutes.filter(d => d.status === s).length;
  const retirer = d => ctx.confirm(`Retirer la demande « ${d.titre} » ? Elle ne sera plus proposée aux lauréats.`, () => act(async () => { await store.update('demandes', d.id, { status: 'fermee' }); toast('Demande retirée.'); }), 'Retirer la demande');
  return html`<section class="m-section">
    <div class="m-head"><h2 class="h-ico"><${Icon} name="send"/> Demandes en cours</h2></div>
    <p class="small muted">${`${n('ouverte')} ouvertes · ${n('match')} en match · ${n('pourvue')} réussies`}</p>
    ${actives.length ? html`<div class="list">${actives.map(d => {
      const props = (data.propositions || []).filter(x => x.demande_id === d.id && ['envoyee', 'acceptee'].includes(x.status)).length;
      return html`<article class=${'dm-card' + (d.id === focusId ? ' dm-focus' : '')} id=${'dm-' + d.id} key=${d.id}>
        <div class="dm-head"><${Person} p=${store.byId('profiles', d.auteur_id)} onOpen=${openProfile} size=${36}/><span class="spacer"></span><${TypeTag} type=${d.type}/><${Pill} d=${d}/></div>
        <h3 class="dm-titre" translate="no" dir="auto">${d.titre}</h3><${Meta} d=${d}/>
        <div class="dm-acts"><span class="small muted">${props > 1 ? `${props} propositions` : props ? '1 proposition' : 'Pas encore de proposition'}</span><span class="spacer"></span><button type="button" class="btn tiny ghost" onClick=${() => retirer(d)}><${Icon} name="x" size=${14}/> Retirer la demande</button></div>
      </article>`;
    })}</div>` : html`<${Empty} icon="send" scene="demandes" title="Aucune demande en cours">Les demandes des étudiants apparaissent ici dès qu’elles sont publiées.<//>`}
  </section>`;
}

// Le nombre affiché sur l'onglet : ce qui attend une réponse de moi
export function demandesAFaire(data, me, store) {
  if (me.role === 'laureat') {
    const matchs = (data.propositions || []).filter(x => x.laureat_id === me.id && x.status === 'acceptee' && store.byId('demandes', x.demande_id)?.status === 'match' && !data.placements.some(p => p.demande_id === x.demande_id && p.status !== 'refuse')).length;
    return matchs + demandesPour(data, me, id => store.byId('profiles', id)).filter(x => !x.mienne && x.prox >= 1).length;
  }
  const miennes = new Set(demandesActives(data, me.id).map(d => d.id));
  return (data.propositions || []).filter(x => miennes.has(x.demande_id) && x.status === 'envoyee').length
    + data.placements.filter(p => p.student_id === me.id && p.demande_id && p.status === 'en_attente').length;
}

injectCSS('demandes', `
.dm-page { display: flex; flex-direction: column; gap: var(--sp-5, 1.5rem); }
.dm-laureat { display: flex; flex-direction: column; gap: var(--sp-5, 1.5rem); }
.dm-hero { display: flex; flex-direction: column; gap: var(--sp-3); }
.dm-hero h2 { margin: 0; }
.dm-hero p { margin: 0; max-width: 62ch; }
.dm-card { display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-4); border: 0; box-shadow: var(--sh1); border-radius: var(--r-lg); background: var(--surface); min-width: 0; }
.dm-card.st-fermee { opacity: .85; }
.dm-card.dm-focus { box-shadow: var(--sh2), 0 0 0 2px var(--sel-ring); }
.dm-head { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; min-width: 0; }
.dm-head > .person { flex: 1 1 10rem; min-width: 0; }
.dm-head > .person + .spacer { display: none; }
.dm-head > .person ~ :not(.spacer) { flex-shrink: 0; align-self: flex-start; }
.dm-titre { margin: 0; font-size: var(--fs-4, 1.1rem); line-height: 1.35; overflow-wrap: anywhere; }
.dm-titre-home { margin: var(--sp-2) 0; overflow-wrap: anywhere; }
.dm-meta { display: flex; flex-wrap: wrap; gap: .25rem .9rem; margin: 0; }
.dm-meta > span { display: inline-flex; align-items: center; gap: .3rem; }
.dm-details { margin: 0; white-space: pre-line; overflow-wrap: anywhere; color: var(--ink-2, inherit); }
.dm-type { display: inline-flex; align-items: center; gap: .3rem; }
.dm-etapes { display: flex; gap: .4rem; list-style: none; margin: var(--sp-1) 0; padding: 0; flex-wrap: wrap; font-size: var(--fs-2, .85rem); }
.dm-etapes li { display: inline-flex; align-items: center; gap: .35rem; color: var(--muted); }
.dm-etapes li + li::before { content: ''; width: 1.2rem; height: 2px; background: var(--line); margin-inline-end: .1rem; }
.dm-etapes li.fait { color: var(--good, #2e7d32); }
.dm-etapes li.ici { color: var(--accent); font-weight: 600; }
.dm-pt { display: inline-grid; place-items: center; width: 1.35rem; height: 1.35rem; border-radius: 50%; border: 1.5px solid currentColor; font-size: .75rem; font-weight: 700; }
.dm-etapes li.fait .dm-pt { background: var(--good-soft, #e8f5e9); }
.dm-props { display: flex; flex-direction: column; gap: var(--sp-3); margin-top: var(--sp-2); }
.dm-props > .eyebrow { margin: 0; }
.dm-prop { display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-3) 0 0; border-top: 1px solid var(--line); }
.dm-prop .quote { margin: 0; }
.dm-prop-head { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
.dm-prop-acts { gap: var(--sp-2); flex-wrap: wrap; align-items: center; }
/* « Oui, accepter » : le visage du lauréat au centre, ce qu'il propose dessous */
.dm-oui-qui { display: flex; flex-direction: column; align-items: center; gap: .3rem; padding-block: .3rem .6rem; text-align: center; }
.dm-oui-qui .avatar { margin-block-end: .3rem; box-shadow: 0 0 0 4px var(--surface), 0 0 0 5px color-mix(in srgb, var(--accent) 22%, transparent); }
.dm-oui-qui strong { font: 700 var(--fs-5)/1.25 var(--f-display); }
.dm-oui-qui .dm-aide { margin-block-start: .25rem; }
.dm-oui-txt { color: var(--ink-2); text-align: center; text-wrap: pretty; }
.dm-oui-feuille .row-end { margin-block-start: var(--sp-4); }
.dm-oui-feuille .row-end .btn { min-height: 46px; }
.dm-oui-feuille .row-end .btn.primary { flex: 1 1 12rem; }
@media (prefers-reduced-motion: no-preference) { .dm-oui-qui .avatar { animation: dm-oui-av .45s var(--ease) .08s backwards; } }
@keyframes dm-oui-av { from { opacity: 0; transform: scale(.85); } }
.dm-aide { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: .35rem; overflow-wrap: anywhere; }
.dm-match { display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-3) 0 0; border-top: 1px solid var(--line); }
.dm-match > .eyebrow { margin: 0; color: var(--good, #2e7d32); display: inline-flex; align-items: center; gap: .3rem; }
.dm-match p { margin: 0; }
.dm-sortie { gap: var(--sp-4); justify-content: flex-end; }
.dm-box { display: flex; align-items: flex-start; gap: var(--sp-2) var(--sp-3); flex-wrap: wrap; padding: var(--sp-3); border-radius: var(--r-md); background: var(--surface-2); }
.dm-box > p, .dm-box .grow p { margin: 0; flex: 1 1 14rem; }
.dm-box.accent, .dm-box.good { background: var(--surface-2); }
.dm-box.warn { background: var(--warn-soft, #fff4e5); }
.dm-box > .row { margin-inline-start: auto; gap: var(--sp-2); }
.dm-attente, .dm-fin { display: flex; align-items: flex-start; gap: .4rem; margin: 0; }
.dm-acts { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; margin-top: var(--sp-1); }
.dm-anciennes > summary { cursor: pointer; color: var(--muted); padding: var(--sp-2) 0; }
.dm-anciennes .list { margin-top: var(--sp-2); }
.dm-filtres { margin-block: var(--sp-1); }
.dm-form .chips { display: flex; flex-wrap: wrap; gap: .4rem; }
.dm-resume { display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-3); border-radius: var(--r-md); background: var(--surface-2); min-width: 0; }
.dm-resume .dm-titre-home { margin: 0; }
.dm-resume .dm-meta, .dm-resume .dm-details { margin: 0; }
.dm-resume-acts { display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp-2) var(--sp-3); }
.dm-aides { display: flex; flex-wrap: nowrap; gap: .4rem; }
.dm-aide-choix { position: relative; flex: 1 1 auto; display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: .45rem .6rem; border: 1px solid var(--line-strong); border-radius: 999px; background: var(--surface); color: var(--ink-2); font-size: .9rem; white-space: nowrap; cursor: pointer; }
.dm-aide-choix input { position: absolute; opacity: 0; pointer-events: none; }
.dm-aide-choix.on { border-color: transparent; background: var(--sel-bg); color: var(--sel-ink); box-shadow: inset 0 0 0 1px var(--sel-ring); font-weight: 600; }
.dm-aide-choix:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (max-width: 340px) { .dm-aides { flex-wrap: wrap; } }
.dm-chez > summary { display: flex; align-items: center; gap: .5rem; min-height: 44px; cursor: pointer; list-style: none; color: var(--ink-2); font-size: .9rem; }
.dm-chez > summary::-webkit-details-marker { display: none; }
.dm-chez > summary .grow { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dm-chez[open] > summary .linkish { display: none; }
.dm-chez .grid2 { margin-top: var(--sp-2); }
@media (prefers-reduced-motion: no-preference) { .dm-card.dm-focus { animation: dm-flash 1.2s ease-out 1; } }
@keyframes dm-flash { from { box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 35%, transparent); } }
`);

addAR({
  'Indique l’entreprise où tu peux aider.': 'اذكر الشركة التي يمكنك المساعدة فيها.', 'Écris-lui quelques mots (10 caractères au moins).': 'اكتب بضع كلمات (10 أحرف على الأقل).',
  'En pause': 'متوقف مؤقتًا', 'Match': 'تطابق', 'Réussie': 'ناجح',   'Demande publiée': 'نُشر الطلب', 'Démarrage confirmé': 'تأكيد البدء', 'Où en est la demande': 'أين وصل الطلب',
  'Recrute': 'توظيف', 'Encadre': 'تأطير', 'Recommande': 'توصية',
  'Je recrute dans mon équipe': 'توظيف في فريقي', 'J’encadre son stage ou son PFE': 'أؤطّر التدريب أو مشروع نهاية الدراسة', 'Je recommande son profil dans mon entreprise': 'توصية داخل شركتي', 'Un nouveau poste ?': 'وظيفة جديدة؟',
  'Les demandes arrivent en 3e année': 'الطلبات تبدأ من السنة الثالثة',
  'À partir de la 3e année, tu pourras dire aux lauréats le stage que tu cherches, CV joint. En attendant, demande-leur un conseil dans Mentorat.': 'ابتداءً من السنة الثالثة، ستستطيع إخبار الخريجين بالتدريب الذي تبحث عنه مع سيرتك الذاتية. في انتظار ذلك، اطلب منهم نصيحة في صفحة المواكبة.',
  'Un étudiant publie ce qu’il cherche, CV joint': 'ينشر طالب ما يبحث عنه مع سيرته الذاتية', 'Tu proposes : recruter, encadrer ou recommander': 'تقترح: التوظيف أو التأطير أو التوصية',
  'Il accepte, puis confirme son démarrage : c’est annoncé': 'القبول، ثم تأكيد البداية: ويُعلن الخبر',
  'Tu dis ce que tu cherches, CV joint': 'تقول ما تبحث عنه مع سيرتك الذاتية', 'Des lauréats te proposent leur aide': 'يقترح عليك الخريجون مساعدتهم', 'Tu choisis, vous démarrez : c’est annoncé': 'تختار وتبدآن: يُعلن النجاح',
  'Tu cherches un emploi ?': 'تبحث عن عمل؟', 'Ce que tu cherches': 'ما تبحث عنه', 'Dis-le aux lauréats du réseau': 'أخبر خريجي الشبكة', 'Dis aux lauréats ce que tu cherches': 'أخبر الخريجين بما تبحث عنه',
  'Ta demande et ton CV arrivent chez les lauréats de ton parcours. Ceux qui recrutent ou peuvent te recommander te le proposent, tu choisis.': 'يصل طلبك وسيرتك الذاتية إلى خريجي مسارك. من يوظّف أو يستطيع التوصية بك يقترح عليك ذلك، وأنت تختار.',
  'Stage, PFE, étranger ou emploi : ta demande et ton CV arrivent chez les lauréats de ton parcours. Ceux qui peuvent t’aider te le proposent, tu choisis.': 'تدريب أو مشروع نهاية الدراسة أو الخارج أو عمل: يصل طلبك وسيرتك الذاتية إلى خريجي مسارك. من يستطيع مساعدتك يقترح عليك ذلك، وأنت تختار.',
  'Publier ma demande': 'نشر طلبي', 'Ma demande d’emploi': 'طلبي للعمل', 'Mes demandes': 'طلباتي', 'Nouvelle demande': 'طلب جديد', '2 demandes en cours au plus': 'طلبان جاريان على الأكثر',
  'Ancienne demande': 'طلب سابق', 'Ta demande est en pause : 60 jours sans nouvelle. Relance-la si tu cherches toujours, elle revient chez les lauréats.': 'طلبك متوقف مؤقتًا: 60 يومًا دون جديد. أعد إطلاقه إن كنت لا تزال تبحث، فيعود إلى الخريجين.',
  'Relancer ma demande': 'إعادة إطلاق طلبي', 'Un lauréat te propose son aide': 'خريج يقترح عليك مساعدته',
  'Les lauréats de ton parcours sont prévenus. Leurs propositions arrivent ici et dans tes messages.': 'تم إخبار خريجي مسارك. تصلك اقتراحاتهم هنا وفي رسائلك.',
  'Ton CV n’est plus joint : ajoute-le dans ton profil.': 'سيرتك الذاتية لم تعد مرفقة: أضفها في ملفك.',   'Fermer ta demande ? Les lauréats ne la verront plus. Tu pourras la rouvrir.': 'إغلاق طلبك؟ لن يراه الخريجون بعد الآن. يمكنك إعادة فتحه.', 'Fermer la demande': 'إغلاق الطلب', 'Demande fermée.': 'تم إغلاق الطلب.',
  'Demande rouverte : les lauréats la voient de nouveau.': 'أُعيد فتح الطلب: يراه الخريجون من جديد.', 'Supprimer cette demande ? Elle disparaît pour tout le monde.': 'حذف هذا الطلب؟ سيختفي عند الجميع.', 'Demande supprimée.': 'تم حذف الطلب.',
  'Demande relancée : les lauréats la voient de nouveau.': 'أُعيد إطلاق الطلب: يراه الخريجون من جديد.', 'C’est un match !': 'تمّ الاتفاق!',
  'C’est un match ! Écris-lui pour la suite.': 'تمّ الاتفاق! الخطوة التالية: رسالة قصيرة لترتيب البداية.', 'C’est noté. Merci pour ta réponse.': 'تم التسجيل. شكرًا على ردك.',
  'C’est un match': 'تمّ الاتفاق', 'Une fois confirmé, ta réussite est vérifiée des deux côtés et annoncée.': 'بعد التأكيد، يُوثَّق نجاحك من الطرفين ويُعلن.', 'Pas encore': 'ليس بعد',   'Ça ne s’est pas fait': 'لم يتم الأمر', 'J’ai trouvé autrement': 'وجدت بطريقة أخرى', 'Rouvrir ma demande': 'إعادة فتح طلبي',
  'Ta demande est de nouveau ouverte.': 'طلبك مفتوح من جديد.', 'Tu as trouvé autrement ? Ta demande sera fermée. Pense à l’indiquer dans Mon parcours.': 'وجدت بطريقة أخرى؟ سيُغلق طلبك. لا تنس الإشارة إلى ذلك في مساري.',
  'Fermer ma demande': 'إغلاق طلبي', 'Bravo ! Ta demande est fermée.': 'مبروك! تم إغلاق طلبك.',   'Réussite confirmée.': 'تم تأكيد النجاح.', 'Dire merci': 'قل شكرًا', 'Voir son profil': 'عرض الملف',
  'Modifier ma demande': 'تعديل طلبي', 'Je cherche': 'أبحث عن', 'En une phrase': 'في جملة واحدة', 'Ce que tu cherches et ce que tu sais faire': 'ما تبحث عنه وما تتقنه',
  'Domaine, missions qui te plaisent, compétences, contraintes (dates, mobilité). Les lauréats décident sur ces lignes et ton CV.': 'المجال، المهام التي تعجبك، الكفاءات، القيود (التواريخ، التنقل). يقرر الخريجون بناءً على هذه الأسطر وسيرتك الذاتية.',
  'Où (facultatif)': 'أين (اختياري)', 'À partir du (facultatif)': 'ابتداءً من (اختياري)', 'Durée (facultatif)': 'المدة (اختياري)',
  'Ton CV PDF est joint. Les lauréats le voient tant que ta demande est ouverte.': 'سيرتك الذاتية PDF مرفقة. يراها الخريجون ما دام طلبك مفتوحًا.',   'Joins ton CV en PDF': 'أرفق سيرتك الذاتية PDF', 'Obligatoire : c’est la première chose que regardent les lauréats. PDF, 2 Mo maximum.': 'إلزامي: هي أول ما ينظر إليه الخريجون. PDF، 2 ميغابايت على الأكثر.',
  'Visible par les lauréats seulement. Tes coordonnées restent cachées jusqu’au match.': 'يراه الخريجون فقط. تبقى معلومات الاتصال بك مخفية حتى التطابق.',   'Demande mise à jour.': 'تم تحديث الطلب.', 'Ta demande est publiée': 'تم نشر طلبك', 'Les lauréats de ton parcours sont prévenus. Leurs propositions arriveront ici et dans tes messages.': 'تم إخبار خريجي مسارك. ستصلك اقتراحاتهم هنا وفي رسائلك.',
  'Demande publiée. Les lauréats de ton parcours sont prévenus.': 'تم نشر الطلب. تم إخبار خريجي مسارك.',     'Ex. Stage d’été de 4A en maintenance ou en qualité': 'مثال: تدريب صيفي للسنة الرابعة في الصيانة أو الجودة', 'Ex. PFE en supply chain ou en amélioration continue': 'مثال: مشروع نهاية الدراسة في سلسلة الإمداد أو التحسين المستمر',
  'Ex. Stage de 4 à 6 mois en France ou au Canada': 'مثال: تدريب من 4 إلى 6 أشهر في فرنسا أو كندا', 'Ex. Premier poste en méthodes, qualité ou data': 'مثال: أول منصب في المناهج أو الجودة أو البيانات',
  'Ex. Je cherche un PFE de 6 mois en lean ou supply chain. J’ai fait mon stage de 4A en méthodes chez un équipementier ; je maîtrise VSM, SMED et Power BI.': 'مثال: أبحث عن مشروع نهاية دراسة لمدة 6 أشهر في اللين أو سلسلة الإمداد. قمت بتدريب السنة الرابعة في المناهج لدى مُصنّع معدات، وأتقن VSM وSMED وPower BI.',
  'Ex. Casablanca, Tanger ou à distance': 'مثال: الدار البيضاء، طنجة أو عن بعد', 'Ex. 2 mois, 6 mois, CDI': 'مثال: شهران، 6 أشهر، عقد دائم',
  'Mes aides en cours': 'مساعداتي الجارية', 'Demandes en cours': 'الطلبات الجارية', 'Proches de ma filière': 'قريبة من شعبتي', 'Filtrer les demandes': 'تصفية الطلبات', 'Ils cherchent': 'يبحثون عن', 'Toutes les filières': 'كل الشعب',   'Rien de ce côté pour l’instant.': 'لا شيء هنا حاليًا.', 'Voir toutes les demandes': 'عرض كل الطلبات', 'Pas de demande ouverte pour le moment': 'لا يوجد طلب مفتوح حاليًا',
  'Dès qu’un étudiant de ton parcours publie ce qu’il cherche, on te prévient. En attendant, une offre publiée lui parle tout de suite.': 'بمجرد أن ينشر طالب من مسارك ما يبحث عنه، يصلك إشعار. في انتظار ذلك، عرض منشور يصله مباشرة.',
  'Mon aide passée': 'مساعدتي السابقة', 'Ton aide est envoyée.': 'تم إرسال مساعدتك.',
  'La demande est pourvue ou fermée. Merci d’avoir proposé ton aide !': 'تمت تلبية الطلب أو إغلاقه. شكرًا على اقتراح مساعدتك!', 'Tu as retiré ton aide.': 'سحبت مساعدتك.',
  'Proposer à nouveau': 'الاقتراح من جديد', 'Je peux aider': 'أستطيع المساعدة', 'Retirer ton aide ?': 'سحب مساعدتك؟', 'Me retirer': 'الانسحاب', 'Ton aide est retirée.': 'تم سحب مساعدتك.',
  'C’est noté, tu ne l’accompagnes plus. Merci de l’avoir dit.': 'تم تسجيل انسحابك. شكرًا على إخبارنا.', 'Déclarer': 'تصريح',   'Ce que tu proposes': 'ما تقترحه', 'Poste ou sujet (facultatif)': 'المنصب أو الموضوع (اختياري)', 'Ex. PFE méthodes, stage qualité': 'مثال: مشروع نهاية الدراسة في المناهج، تدريب في الجودة',
  'Ce que tu proposes concrètement et la prochaine étape. Il arrive aussi dans ses messages.': 'ما تقترحه بالتحديد والخطوة التالية. يصل أيضًا إلى الرسائل.',
  'Propose seulement ce que tu peux vraiment faire. Si ça ne se fait pas, tu pourras te retirer : la demande se rouvre.': 'اقترح فقط ما تستطيع فعله حقًا. إن لم يتم الأمر، يمكنك الانسحاب: يُعاد فتح الطلب.',
  'Envoyer ma proposition': 'إرسال اقتراحي', 'Proposition modifiée.': 'تم تعديل الاقتراح.',
  'Aucune demande en cours': 'لا يوجد طلب جارٍ', 'Les demandes des étudiants apparaissent ici dès qu’elles sont publiées.': 'تظهر طلبات الطلبة هنا بمجرد نشرها.', 'Retirer la demande': 'سحب الطلب', 'Demande retirée.': 'سُحب الطلب.',
  'Pas encore de proposition': 'لا يوجد اقتراح بعد', '1 proposition': 'اقتراح واحد', 'Un étudiant de ton parcours cherche': 'طالب من مسارك يبحث عن', 'Ma demande': 'طلبي',   'Ta demande et ton CV arrivent chez les lauréats de ton parcours : ceux qui peuvent t’aider te le proposent.': 'يصل طلبك وسيرتك الذاتية إلى خريجي مسارك: من يستطيع مساعدتك يقترح عليك ذلك.',
  'Demandes des étudiants': 'طلبات الطلبة', 'Via sa demande': 'عبر الطلب',
  'avec l’encadrement de': 'بتأطير من', 'sur la recommandation de': 'بتوصية من',
  'Proposer mon aide': 'اقتراح مساعدتي', 'Recruter': 'توظيف', 'Encadrer': 'تأطير', 'Recommander': 'توصية',
  'Lire sa demande': 'قراءة الطلب', 'Réduire': 'إخفاء', 'Sa demande': 'الطلب', 'Ton entreprise': 'شركتك',
  'Propose seulement ce que tu peux vraiment faire. Si ça ne se fait pas, tu pourras te retirer.': 'اقترح فقط ما تستطيع فعله حقًا. إن لم يتم الأمر، يمكنك الانسحاب.',
  'Cette demande n’attend plus d’aide : elle est pourvue ou fermée. Merci d’avoir voulu aider !': 'لم يعد هذا الطلب ينتظر مساعدة: تمت تلبيته أو أُغلق. شكرًا على رغبتك في المساعدة!',
  'Tu as déjà proposé ton aide pour cette demande.': 'سبق أن اقترحت مساعدتك لهذا الطلب.',
  'Cette demande n’est plus ouverte.': 'لم يعد هذا الطلب مفتوحًا.', 'C’est ta propre demande.': 'هذا طلبك أنت.',
  'Dis-le en une phrase : 4 caractères au moins.': 'قلها في جملة واحدة: 4 أحرف على الأقل.',
  'Quelques lignes suffisent : 20 caractères au moins.': 'تكفي بضعة أسطر: 20 حرفًا على الأقل.',
}, [
  [/^Bonjour (.+), j’ai lu ta demande et ton CV\. Je peux te proposer une place dans mon équipe\. Réponds-moi quand tu veux, on en parle\.$/, n => `مرحبًا ${n}، قرأت طلبك وسيرتك الذاتية. أستطيع أن أقترح عليك مكانًا في فريقي. يسعدني أن نتحدث في الأمر متى شئت.`],
  [/^Bonjour (.+), j’ai lu ta demande et ton CV\. Je peux t’encadrer dans mon entreprise\. Réponds-moi quand tu veux, on en parle\.$/, n => `مرحبًا ${n}، قرأت طلبك وسيرتك الذاتية. أستطيع تأطيرك في شركتي. يسعدني أن نتحدث في الأمر متى شئت.`],
  [/^Bonjour (.+), j’ai lu ta demande et ton CV\. Je peux te recommander dans mon entreprise\. Réponds-moi quand tu veux, on en parle\.$/, n => `مرحبًا ${n}، قرأت طلبك وسيرتك الذاتية. أستطيع التوصية بك في شركتي. يسعدني أن نتحدث في الأمر متى شئت.`],
  [/^Chez (.+)$/, e => `لدى ${e}`],
  [/^Ton aide est envoyée à (.+)\. Merci !$/, n => `تم إرسال مساعدتك إلى ${n}. شكرًا!`],
  [/^La demande de (.+) est en pause : 60 jours sans nouvelle\. Elle revient ici dès qu’elle est relancée\.$/, n => `طلب ${n} متوقف مؤقتًا: 60 يومًا دون جديد. يعود هنا بمجرد إعادة إطلاقه.`],
  [/^Encore (\d+) caractères? au moins\.$/, k => `ما زال ينقص ${arCount(k, ['حرف واحد', 'حرفان', 'أحرف', 'حرفًا'])} على الأقل.`],
  [/^Dès le (.+)$/, d => `ابتداءً من ${d}`],
  [/^Tu es en (.+)$/, p => `أنت في ${p}`],
  [/^Anciennes demandes \((\d+)\)$/, n => `الطلبات السابقة (${n})`],
  [/^Mes aides passées \((\d+)\)$/, n => `مساعداتي السابقة (${n})`],
  [/^(\d+) lauréats te proposent leur aide$/, n => `${n} خريجين يقترحون عليك مساعدتهم`],
  [/^(\d+) propositions$/, n => `${n} اقتراحات`],
  [/^Voir les (\d+)$/, n => `عرض ${n}`],
  [/^Je cherche : (.+)$/, t => `أبحث عن: ${({ Stage: 'تدريب', PFE: 'مشروع نهاية الدراسة', 'Stage à l’étranger': 'تدريب بالخارج', Emploi: 'عمل' })[t] || t}`],
  [/^(\d+) ouvertes · (\d+) en match · (\d+) réussies$/, (a, b, c) => `${a} مفتوحة · ${b} في تطابق · ${c} ناجحة`],
  [/^Aider (.+)$/, n => `مساعدة ${n}`],
  [/^Ton mot à (.+)$/, n => `كلمتك إلى ${n}`],
  [/^Bonjour (.+), j’ai lu ta demande et ton CV…$/, n => `مرحبًا ${n}، قرأت طلبك وسيرتك الذاتية…`],
  [/^Proposition envoyée\. (.+) la reçoit aussi dans ses messages\.$/, n => `تم إرسال الاقتراح، ويصل أيضًا إلى رسائل ${n}.`],
  [/^Accepter l’aide de (.+) \? Les autres propositions seront closes, et vous verrez vos coordonnées\.$/, n => `قبول مساعدة ${n}؟ ستُغلق الاقتراحات الأخرى، وسيرى كل منكما معلومات اتصال الآخر.`],
  [/^Parle avec (.+) de la suite\. Quand tu commences, (.+) le déclare et tu confirmes : ta réussite sera annoncée\.$/, n => `تحدث مع ${n} عن الخطوات التالية. عند بدايتك، يأتي تصريح ${n} ثم تأكيدك: ويُعلن نجاحك.`],
  [/^Écrire à (.+)$/, n => `مراسلة ${n}`],
  [/^Dire merci à (.+)$/, n => `قل شكرًا لـ${n}`],
  [/^(.+) indique que tu as commencé chez (.+)\. Confirme-le\.$/, (n, e) => `تصريح من ${n}: بدأت لدى ${e}. أكّد ذلك.`],
  [/^(.+) indique que tu as commencé chez (.+?)\.?$/, (n, e) => `تصريح من ${n}: بدأت لدى ${e}.`],
  [/^Vous avez accès à vos coordonnées\. Quand tu commences, (.+) le déclare ici et tu confirmes\.$/, n => `يمكن لكل منكما رؤية معلومات اتصال الآخر. عند بدايتك، يأتي تصريح ${n} هنا ثم تأكيدك.`],
  [/^Ça ne s’est pas fait avec (.+) \? Ta demande se rouvre et d’autres lauréats pourront te proposer leur aide\.$/, n => `لم يتم الأمر مع ${n}؟ يُعاد فتح طلبك ويمكن لخريجين آخرين اقتراح مساعدتهم.`],
  [/^Ta réussite chez (.+) est vérifiée des deux côtés et annoncée dans le réseau\. Un petit merci fera plaisir à (.+)\.$/, (e, n) => `نجاحك لدى ${e} موثّق من الطرفين ومُعلن في الشبكة. كلمة شكر صغيرة ستُسعد ${n}.`],
  [/^Réussite confirmée chez (.+), avec (.+)\.$/, (e, n) => `تم تأكيد النجاح لدى ${e}، مع ${n}.`],
  [/^(.+) a confirmé son démarrage\. Ta réussite est annoncée dans le réseau : merci !$/, n => `تأكيد البداية من ${n}. نجاحك مُعلن في الشبكة: شكرًا!`],
  [/^(.+) choisit parmi les propositions reçues\.$/, n => `الاختيار بين الاقتراحات الواردة بيد ${n}.`],
  [/^(.+) a choisi une autre voie\. Merci d’avoir proposé ton aide !$/, n => `اختيار ${n}: طريق آخر. شكرًا على اقتراح مساعدتك!`],
  [/^Te retirer \? La demande de (.+) se rouvre pour les autres lauréats\.$/, n => `الانسحاب؟ يُعاد فتح طلب ${n} أمام الخريجين الآخرين.`],
  [/^C’est un match avec ([^:]+)$/, n => `تمّ الاتفاق مع ${n}`],
  [/^Démarrage déclaré chez (.+)\. En attente de la confirmation de (.+)\.$/, (e, n) => `تم التصريح بالبدء لدى ${e}. في انتظار تأكيد ${n}.`],
  [/^(.+) n’a pas confirmé\. Parlez-en, puis déclare à nouveau quand c’est fait\.$/, n => `لا تأكيد من ${n} بعد. تحدثا في الأمر، ثم صرّح من جديد عندما يتم.`],
  [/^Quand (.+) commence \(stage signé, PFE lancé, contrat\), dis-le ici : (.+) confirme et la réussite est annoncée\.$/, n => `عند بداية ${n} (تدريب موقّع، مشروع انطلق، عقد)، قل ذلك هنا: يأتي التأكيد ويُعلن النجاح.`],
  [/^(.+) a commencé$/, n => `بداية ${n}`],
  [/^(.+) doit maintenant confirmer\. Tes 50 points arrivent dès sa confirmation\.$/, n => `ننتظر الآن تأكيد ${n}. تصلك 50 نقطة بمجرد التأكيد.`],
  [/^(.+) reçoit une demande de confirmation\. Une fois confirmé, c’est vérifié des deux côtés et annoncé dans le réseau\.$/, n => `يصل طلب تأكيد إلى ${n}. بعد التأكيد، يُوثَّق من الطرفين ويُعلن في الشبكة.`],
  [/^(.+) a déjà une réussite enregistrée cette année\.$/, n => `لدى ${n} نجاح مسجّل هذه السنة.`],
  [/^Retirer la demande « (.+) » \? Elle ne sera plus proposée aux lauréats\.$/, t => `سحب الطلب «${t}»؟ لن يُقترح على الخريجين بعد الآن.`],
  // Notifications de l'accueil (app.js)
  [/^(.+?) te propose son aide : (.+)$/, (n, t) => `عرض مساعدة من ${n}: ${t}`],
  [/^(.+?) a retiré sa proposition\. Ta demande est de nouveau ouverte aux lauréats\.$/, n => `سُحب اقتراح ${n}: طلبك مفتوح من جديد أمام الخريجين.`],
  [/^C’est un match avec (.+?) : déclare son démarrage dès qu’il a lieu\.$/, n => `تمّ الاتفاق مع ${n}: صرّح بالبداية بمجرد حدوثها.`],
  [/^(.+?) a choisi une autre voie pour « (.+) »\. Merci d’avoir proposé ton aide !$/, (n, t) => `اختيار ${n} لـ«${t}»: طريق آخر. شكرًا على اقتراح مساعدتك!`],
  [/^Ta demande « (.+) » est en pause\. Relance-la si tu cherches toujours\.$/, t => `طلبك «${t}» متوقف مؤقتًا. أعد إطلاقه إن كنت لا تزال تبحث.`],
  [/^(.+?) cherche : (.+)$/, (n, t) => `${n} · المطلوب: ${t}`],
]);
