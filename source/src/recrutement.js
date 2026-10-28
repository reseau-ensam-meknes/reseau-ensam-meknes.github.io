// Recruter par le réseau : offre en 30 secondes, sujets de PFE pris ou disponibles,
// relance douce des offres, bilan de cooptation à montrer à sa RH.
import { html, useState, useMemo, useRef } from './vendor/preact-htm.js';
import { Icon, Modal, Field, BrandLogo, toast } from './ui.js';
import { TYPES, bilanCooptation, needsRelance, seasonLabel } from './logic.js';
// La lecture d'une annonce (parse-offre.js) n'arrive qu'à l'ouverture de « Offre en 30 secondes »
const lecteurOffre = () => import('./parse-offre.js');

// ---------------------------------------------------------------------------
// Offre en 30 secondes : coller le texte d'une annonce, le formulaire se remplit
// ---------------------------------------------------------------------------
export function PasteOffer({ me, onFill }) {
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState('');
  const cta = useRef();
  // Seulement ce qui a été reconnu, et rien d'invisible (aucun champ « contact » dans le formulaire).
  // Le formulaire éclaire ce qu'il a reçu et dit lui-même combien ; le focus revient sur ce bouton.
  const fill = async () => {
    const { parseOffre } = await lecteurOffre();
    const { fields, found } = parseOffre(txt, me);
    const vus = found.filter(k => k !== 'contact');
    if (!vus.length) { toast('Rien de reconnu. Remplis les champs à la main.', 'err'); return; }
    onFill(Object.fromEntries(vus.map(k => [k, fields[k]])), vus); setOpen(false); setTxt('');
    setTimeout(() => cta.current?.focus({ preventScroll: true }));
  };
  if (!open) return html`<button type="button" class="paste-cta" ref=${cta} onClick=${() => { lecteurOffre().catch(() => {}); setOpen(true); }}><span class="obj-ico"><${Icon} name="copy" size=${20}/></span>
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
// Sujets de PFE (la puce PFE des offres) : l'entreprise dépose un vrai problème, un étudiant de 5A le prend, le lauréat l'encadre.
// Un sujet est pris dès qu'un recrutement est en cours dessus (pas refusé).
// ---------------------------------------------------------------------------
export const sujetPris = (data, o) => o.type === 'pfe' && o.audience !== 'laureats' && (data.placements || []).some(p => p.offer_id === o.id && p.status !== 'refuse');

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

// Dans « Mon espace » (Mes documents), à côté de l'attestation
export function BilanCard({ ctx }) {
  const [open, setOpen] = useState(false);
  return html`<div class="attest-card">
    <span class="attest-ico"><${Icon} name="briefcase" size=${24}/></span>
    <div class="grow"><strong>Bilan de cooptation</strong><span class="small muted">Pour ta RH ou ton manager : tes offres, candidatures et recrues.</span></div>
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
  const periode = per === 'saison' ? `Année ${seasonLabel(saison)}` : per === 'an' ? '12 derniers mois' : 'Depuis l’inscription';
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return html`<${Modal} title="Bilan de cooptation" onClose=${onClose} wide>
    <div class="row bilan-ctl">
      <div class="seg">${[['saison', 'Cette année'], ['an', '12 mois'], ['tout', 'Depuis le début']].map(([k, l]) => html`<button class=${per === k ? 'on' : ''} onClick=${() => setPer(k)}>${l}</button>`)}</div>
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
        ${b.recrues.map(p => { const s = store.byId('profiles', p.student_id); return html`<tr><td>${s ? html`<bdi translate="no">${s.full_name.split(' ')[0] + ' ' + (s.full_name.split(' ')[1]?.[0] || '') + '.'}</bdi>` : 'Profil étudiant'}</td><td>${s?.filiere || ''}</td><td>${TYPES[p.type]?.label || ''}</td><td class="mono">${new Date(p.confirmed_at || p.created_at).toLocaleDateString('fr-FR')}</td></tr>`; })}
      </tbody></table>` : html`<p class="muted">Pas encore de recrue confirmée sur cette période.</p>`}
      ${b.filieres.length ? html`<p class="small">Filières recrutées : ${b.filieres.map(([f, n]) => `${f} (${n})`).join(' · ')}</p>` : null}
      <p class="small muted">Chaque recrutement est déclaré par le lauréat, puis confirmé sur la plateforme par la personne recrutée. Document généré le ${today}.</p>
    </div>
    <div class="row-end"><button class="btn primary" onClick=${printSheet}><${Icon} name="download" size=${16}/> Imprimer ou PDF</button></div>
  <//>`;
}
