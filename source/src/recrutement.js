// Recruter par le réseau : alerte talents, offre en 30 secondes, banque de sujets PFE,
// relance douce des offres, bilan de cooptation à montrer à sa RH.
import { html, useState, useMemo } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Avatar, CompanyLogo, BrandLogo, toast } from './ui.js';
import { FILIERES, TYPES, niveauOf, alerteTalents, bilanCooptation, needsRelance, seasonLabel } from './logic.js';
import { parseOffre } from './parse-offre.js';

// ---------------------------------------------------------------------------
// Alerte talents (accueil lauréat) : les étudiants de sa filière qui cherchent encore
// ---------------------------------------------------------------------------
export function AlerteTalents({ ctx }) {
  const { data, me, saison, go } = ctx;
  const { list, nouveaux } = useMemo(() => alerteTalents(data, me, saison), [data, me, saison]);
  if (me.role !== 'laureat' || !list.length) return null;
  return html`<button class="impact-strip clickable talents-strip" onClick=${() => go('reseau/talents')}>
    <span class="obj-ico"><${Icon} name="spark" size=${20}/></span>
    <span class="grow"><strong>${list.length} étudiant${list.length > 1 ? 's' : ''} de ${me.filiere} cherche${list.length > 1 ? 'nt' : ''} encore</strong>${nouveaux ? html`<span class="mini hit">${nouveaux} nouveau${nouveaux > 1 ? 'x' : ''} cette semaine</span>` : null}
      <span class="small muted">Un stage, un PFE ou un premier emploi dans ton équipe ? Invite-les à postuler en un clic.</span></span>
    <span class="av-stack">${list.slice(0, 4).map(({ p }) => html`<${Avatar} p=${p} size=${28}/>`)}</span>
    <${Icon} name="arrow" size=${18}/>
  </button>`;
}

// ---------------------------------------------------------------------------
// Offre en 30 secondes : coller le texte d'une annonce, le formulaire se remplit
// ---------------------------------------------------------------------------
export function PasteOffer({ me, onFill }) {
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState('');
  const fill = () => {
    const { fields, found } = parseOffre(txt, me);
    if (!found.length) { toast('Rien de reconnu. Remplis les champs à la main.', 'err'); return; }
    onFill(Object.fromEntries(found.map(k => [k, fields[k]]))); setOpen(false); setTxt('');  // seulement ce qui a été reconnu
    toast(`${found.length} champ${found.length > 1 ? 's' : ''} rempli${found.length > 1 ? 's' : ''}. Vérifie, puis publie.`);
  };
  if (!open) return html`<button type="button" class="paste-cta" onClick=${() => setOpen(true)}><span class="obj-ico"><${Icon} name="copy" size=${20}/></span>
    <span class="grow"><strong>Offre en 30 secondes</strong><span class="small muted">Colle le texte de l’annonce (LinkedIn, email, WhatsApp) : le formulaire se remplit tout seul.</span></span><${Icon} name="arrow" size=${18}/></button>`;
  return html`<div class="paste-box">
    <${Field} label="Texte de l’annonce"><textarea id="of-paste" rows="6" value=${txt} onInput=${e => setTxt(e.target.value)} placeholder="Colle ici le post LinkedIn ou l’email de la RH…" dir="auto"></textarea><//>
    <div class="row-end"><button type="button" class="btn ghost small" onClick=${() => setOpen(false)}>Annuler</button><button type="button" class="btn primary small" disabled=${txt.trim().length < 15} onClick=${fill}><${Icon} name="spark" size=${15}/> Remplir le formulaire</button></div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Relance douce : « Ton offre est-elle toujours ouverte ? » après 3 semaines sans activité
// ---------------------------------------------------------------------------
export function RelanceBanner({ ctx, o }) {
  const { data, me, store, act } = ctx;
  if (o.author_id !== me.id || !needsRelance(data, o)) return null;
  return html`<div class="relance"><${Icon} name="clock" size=${18}/>
    <div class="grow"><strong>Ton offre est-elle toujours ouverte ?</strong><span class="small muted">Pas de candidature ni de question depuis 3 semaines. Un clic pour que les étudiants voient une offre à jour.</span></div>
    <div class="row">
      <button class="btn small primary" onClick=${() => act(async () => { await store.update('offers', o.id, { verifiee_at: new Date().toISOString() }); toast('Merci ! L’offre reste en ligne.'); })}>Oui, toujours ouverte</button>
      <button class="btn small" onClick=${() => act(async () => { await store.update('offers', o.id, { status: 'pourvue' }); toast('Offre marquée pourvue. Bravo !'); })}>Pourvue</button>
      <button class="btn small ghost" onClick=${() => act(async () => { await store.update('offers', o.id, { status: 'fermee' }); toast('Offre fermée.'); })}>Fermée</button>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Banque de sujets PFE : l'entreprise dépose un vrai problème, un étudiant le prend, le lauréat l'encadre
// ---------------------------------------------------------------------------
// « PFE : Optimiser… » → « Optimiser… »
const sujetTitre = t => { const s = t.replace(/^(PFE|Sujet de PFE|Stage PFE)\s*[:–-]\s*/i, ''); return s.charAt(0).toUpperCase() + s.slice(1); };

export function BanqueSujets({ ctx, onPropose }) {
  const { data, me, saison, store, openOffer, openProfile } = ctx;
  const [fil, setFil] = useState(me.role === 'etudiant' ? me.filiere : '');
  const [dispo, setDispo] = useState(true);
  const taken = o => data.placements.find(p => p.offer_id === o.id && p.status !== 'refuse');
  const sujets = data.offers.filter(o => o.type === 'pfe' && (o.audience || 'etudiants') === 'etudiants' && (!fil || !o.filieres?.length || o.filieres.includes(fil)))
    .map(o => ({ o, pl: taken(o) }))
    .filter(({ o, pl }) => !dispo || (o.status === 'ouverte' && !pl))
    .sort((a, b) => (a.o.status === 'ouverte' && !a.pl ? 0 : 1) - (b.o.status === 'ouverte' && !b.pl ? 0 : 1) || new Date(b.o.created_at) - new Date(a.o.created_at));
  return html`<div class="sub-page">
    <ol class="how sujets-how">
      <li><span class="how-n">1</span><span><strong>L’entreprise dépose un vrai problème</strong><span class="small muted">Un lauréat le publie au nom de son équipe.</span></span></li>
      <li><span class="how-n">2</span><span><strong>Un étudiant de 5A le prend</strong><span class="small muted">Il postule, le lauréat le retient.</span></span></li>
      <li><span class="how-n">3</span><span><strong>Le lauréat l’encadre</strong><span class="small muted">Jusqu’à la soutenance, et parfois l’embauche.</span></span></li>
    </ol>
    <div class="toolbar">
      <select id="sj-fil" value=${fil} onChange=${e => setFil(e.target.value)} aria-label="Filière"><option value="">Toutes filières</option>${FILIERES.map(f => html`<option value=${f}>${f}</option>`)}</select>
      <div class="seg">${[[true, 'Disponibles'], [false, 'Tous les sujets']].map(([v, l]) => html`<button class=${dispo === v ? 'on' : ''} onClick=${() => setDispo(v)}>${l}</button>`)}</div>
    </div>
    <div class="sujets">${sujets.length ? sujets.map(({ o, pl }) => {
      const a = store.byId('profiles', o.author_id); const st = pl ? store.byId('profiles', pl.student_id) : null;
      const libre = o.status === 'ouverte' && !pl;
      return html`<article class=${'sujet' + (libre ? '' : ' pris')} key=${o.id}>
        <button class="sujet-main clickable" onClick=${() => openOffer(o.id)}>
          <${CompanyLogo} name=${o.entreprise} size=${42}/>
          <span class="grow"><span class="row small"><span class=${'state-pill ' + (libre ? 's-recherche' : 's-trouve')}>${libre ? 'Disponible' : pl ? 'Pris' : 'Clos'}</span><span class="muted">${o.entreprise}${o.ville ? ' · ' + o.ville : ''}</span></span>
            <strong class="sujet-titre" translate="no" dir="auto">${sujetTitre(o.titre)}</strong>
            <span class="small muted sujet-desc" translate="no" dir="auto">${o.description.slice(0, 180)}${o.description.length > 180 ? '…' : ''}</span>
            ${o.filieres?.length ? html`<span class="ocard-tags">${o.filieres.map(f => html`<span class="mini">${f}</span>`)}</span>` : null}</span>
        </button>
        <footer class="sujet-foot">
          ${a ? html`<span class="small">Encadré par</span><${Person} p=${a} onOpen=${openProfile} size=${26}/>` : null}
          <span class="spacer"></span>
          ${st ? html`<span class="small muted">Pris par ${st.full_name.split(' ')[0]}${pl.status === 'confirme' ? '' : ' (à confirmer)'}</span>` : null}
          ${libre && me.role === 'etudiant' && niveauOf(me, saison) === 5 ? html`<button class="btn tiny primary" onClick=${() => openOffer(o.id, true)}>Je prends ce sujet</button>` : null}
        </footer>
      </article>`;
    }) : html`<${Empty} icon="cap" title=${dispo ? 'Aucun sujet disponible pour l’instant' : 'Aucun sujet'}>${me.role === 'etudiant' ? 'Les lauréats déposent des sujets toute l’année. Reviens bientôt ou demande conseil en mentorat.' : html`Dépose le premier : un problème réel de ton équipe, que tu pourrais encadrer.<div class="empty-act"><button class="btn small primary" onClick=${onPropose}><${Icon} name="plus" size=${15}/> Déposer un sujet</button></div>`}<//>`}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Bilan de cooptation : ce que ses offres ont apporté, à montrer à sa RH (imprimable)
// ---------------------------------------------------------------------------
function printSheet() {
  const off = () => { document.body.classList.remove('print-bilan'); removeEventListener('afterprint', off); };
  document.body.classList.add('print-bilan');
  addEventListener('afterprint', off);
  setTimeout(off, 4000);
  try { window.print(); } catch { off(); toast('Utilise Ctrl+P, ou Partager puis Imprimer sur téléphone.', 'err'); }
}

export function BilanCard({ ctx }) {
  const [open, setOpen] = useState(false);
  return html`<div class="attest-card">
    <span class="attest-ico"><${Icon} name="briefcase" size=${24}/></span>
    <div class="grow"><strong>Bilan de cooptation</strong><span class="small muted">Tes offres, les candidatures reçues et les recrues confirmées, sur une page à montrer à ta RH ou à ton manager.</span></div>
    <button class="btn small" onClick=${() => setOpen(true)}>Voir mon bilan</button>
    ${open ? html`<${BilanModal} ctx=${ctx} onClose=${() => setOpen(false)}/>` : null}
  </div>`;
}

function BilanModal({ ctx, onClose }) {
  const { data, me, saison, store } = ctx;
  const [per, setPer] = useState('saison');
  const [equipe, setEquipe] = useState(false);
  const since = per === 'saison' ? new Date(saison, 8, 1) : per === 'an' ? new Date(Date.now() - 365 * 864e5) : null;
  const b = useMemo(() => bilanCooptation(data, me, { since, equipe }), [data, me, per, equipe]);
  const periode = per === 'saison' ? `Saison ${seasonLabel(saison)}` : per === 'an' ? '12 derniers mois' : 'Depuis l’inscription';
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return html`<${Modal} title="Bilan de cooptation" onClose=${onClose} wide>
    <div class="row bilan-ctl">
      <div class="seg">${[['saison', 'Cette saison'], ['an', '12 mois'], ['tout', 'Depuis le début']].map(([k, l]) => html`<button class=${per === k ? 'on' : ''} onClick=${() => setPer(k)}>${l}</button>`)}</div>
      ${me.entreprise ? html`<label class="check small"><input id="bl-eq" type="checkbox" checked=${equipe} onChange=${e => setEquipe(e.target.checked)}/> Tous les lauréats de ${me.entreprise}</label>` : null}
    </div>
    <div class="bilan-sheet">
      <div class="cert-top"><${BrandLogo} size=${44}/><span class="cert-org"><strong>Réseau ENSAM Meknès</strong><span>Bilan de cooptation · ${periode}</span></span></div>
      <h2 class="bilan-title">${equipe && me.entreprise ? `${me.entreprise} · ${b.laureats} lauréat${b.laureats > 1 ? 's' : ''} de l’ENSAM Meknès` : `${me.full_name}${me.entreprise ? ' · ' + me.entreprise : ''}`}</h2>
      <div class="bilan-kpis">
        ${[[b.offres, 'offre publiée', 'offres publiées'], [b.candidatures, 'candidature reçue', 'candidatures reçues'], [b.entretiens, 'entretien', 'entretiens'], [b.recrues.length, 'recrue confirmée', 'recrues confirmées']].map(([n, a, z]) => html`<div><b class="mono">${n}</b><span>${n > 1 ? z : a}</span></div>`)}
      </div>
      ${b.delai !== null ? html`<p>Délai moyen entre la publication et la confirmation : <b class="mono">${b.delai}</b> jours.</p>` : null}
      ${b.recrues.length ? html`<table class="tbl"><thead><tr><th>Recrue</th><th>Filière</th><th>Type</th><th>Confirmé le</th></tr></thead><tbody>
        ${b.recrues.map(p => { const s = store.byId('profiles', p.student_id); return html`<tr><td>${s ? html`<bdi translate="no">${s.full_name.split(' ')[0] + ' ' + (s.full_name.split(' ')[1]?.[0] || '') + '.'}</bdi>` : 'Étudiant(e)'}</td><td>${s?.filiere || ''}</td><td>${TYPES[p.type]?.label || ''}</td><td class="mono">${new Date(p.confirmed_at || p.created_at).toLocaleDateString('fr-FR')}</td></tr>`; })}
      </tbody></table>` : html`<p class="muted">Pas encore de recrue confirmée sur cette période.</p>`}
      ${b.filieres.length ? html`<p class="small">Filières recrutées : ${b.filieres.map(([f, n]) => `${f} (${n})`).join(' · ')}</p>` : null}
      <p class="small muted">Chaque recrutement est déclaré par le lauréat puis confirmé par l’étudiant(e) sur la plateforme. Document généré le ${today}.</p>
    </div>
    <div class="row-end"><button class="btn primary" onClick=${printSheet}><${Icon} name="download" size=${16}/> Imprimer ou PDF</button></div>
  <//>`;
}
