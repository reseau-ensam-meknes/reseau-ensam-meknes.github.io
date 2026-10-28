// Ce que les lauréats y gagnent : vivier de talents (shortlist, invitations), attestation vérifiable,
// et fil des réussites à partager sur LinkedIn.
import { html, useState, useEffect } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Avatar, RoleLine, BrandLogo, toast, injectCSS, FiliereFiltre } from './ui.js';
import { FOUND, niveauOf, statutOf, timeAgo, attestationStats, filtreFiliere, AIDES, NIVEAUX } from './logic.js';
import { OfferComposer, matchesMe } from './offers.js';
import { getLang, addAR } from './i18n.js';
import { CvButton } from './cv.js';
import { recherche } from './geo.js';
import { PersonneLigne, useVoirPlus, VoirPlus, BoutonFiltres, FeuilleFiltres } from './lignes.js';

const firstName = p => (p?.full_name || '').split(' ')[0];

async function copyText(txt, done = 'Copié.') {
  try { await navigator.clipboard.writeText(txt); toast(done); } catch { toast('Copie impossible ici : sélectionne le texte et copie-le.', 'err'); }
}

// ---------------------------------------------------------------------------
// Vivier de talents : chercher, garder dans sa shortlist, inviter à postuler
// ---------------------------------------------------------------------------
const CHERCHE = { 3: 'stage de 3A', 4: 'stage de 4A', 5: 'PFE ou stage à l’étranger' };

export function TalentPool({ ctx }) {
  const { data, me, saison, store, act, openProfile } = ctx;
  const canRecruit = me.role === 'laureat';
  const [view, setView] = useState('tous');
  const [q, setQ] = useState(''); const [fil, setFil] = useState(''); const [niv, setNiv] = useState(''); const [cv, setCv] = useState(false);
  const [invite, setInvite] = useState(null);
  const [feuille, setFeuille] = useState(false); const [fiche, setFiche] = useState(null);
  const saved = new Map(data.shortlists.filter(x => x.laureat_id === me.id).map(x => [x.student_id, x]));
  // Étudiants de 3A à 5A visibles, et lauréats qui cherchent un emploi
  const pool = data.profiles.filter(p => p.id !== me.id && ((p.role === 'etudiant' && p.vitrine !== false && [3, 4, 5].includes(niveauOf(p, saison))) || (p.role === 'laureat' && p.en_recherche)));
  const laur = p => p.role === 'laureat';
  const trouve = recherche(q);
  const searching = p => laur(p) || !['trouve', 'validation'].includes(statutOf(data, p, saison).key);
  const list = pool.filter(p => (view === 'shortlist' ? saved.has(p.id) : searching(p)))
    .filter(p => filtreFiliere(fil, p.filiere) && (!niv || (niv === 'L' ? laur(p) : !laur(p) && niveauOf(p, saison) === +niv)) && (!cv || p.cv_path || p.cv_url)
      && (!trouve || trouve(`${p.full_name} ${p.bio || ''} ${(p.competences || []).join(' ')}`, p.ville)))
    .sort((a, b) => (saved.has(b.id) - saved.has(a.id)) || (!!(b.cv_path || b.cv_url) - !!(a.cv_path || a.cv_url)) || (b.competences?.length || 0) - (a.competences?.length || 0));
  const toggle = p => act(async () => {
    const s = saved.get(p.id);
    if (s) await store.remove('shortlists', s.id);
    else { await store.insert('shortlists', { laureat_id: me.id, student_id: p.id, note: '' }); toast(`Profil de ${firstName(p)} mis de côté.`); }
  });
  const invState = p => {
    const inv = data.invitations.filter(i => i.laureat_id === me.id && i.student_id === p.id);
    if (!inv.length) return null;
    if (data.applications.some(a => a.student_id === p.id && inv.some(i => i.offer_id === a.offer_id))) return ['s-trouve', 'A postulé'];
    return inv.every(i => i.status === 'declinee') ? ['', 'A décliné'] : ['s-validation', 'Invitation envoyée'];
  };

  const cherche = p => (laur(p) ? 'un emploi' : CHERCHE[niveauOf(p, saison)]);
  const etat = p => { if (searching(p)) return canRecruit ? invState(p) : null; const st = statutOf(data, p, saison); return ['s-' + st.key, st.label]; };
  const actifs = [fil, niv].filter(Boolean).length + (cv ? 1 : 0);
  const { vus, reste, plus } = useVoirPlus(list, 20, [view, q, fil, niv, cv].join('|'));
  const pf = fiche ? pool.find(p => p.id === fiche) : null;
  return html`<div class="sub-page">
    <p class="muted small">Étudiants et lauréats en recherche, visibles par les lauréats.</p>
    ${canRecruit ? html`<div class="seg" role="tablist" aria-label="Talents">${[['tous', 'Tous les talents'], ['shortlist', 'Mis de côté']].map(([k, l]) => html`<button role="tab" aria-selected=${view === k} class=${view === k ? 'on' : ''} onClick=${() => setView(k)}>${k === 'shortlist' ? html`<${Icon} name="bookmark" size=${15}/> ` : null}${l}${k === 'shortlist' && saved.size ? html` <span class="count">${saved.size}</span>` : null}</button>`)}</div>` : null}
    <div class="recherche-filtres"><label class="search"><${Icon} name="search" size=${16}/><input id="t-q" placeholder="Compétence, ville, nom…" value=${q} onInput=${e => setQ(e.target.value)}/></label>
      <${BoutonFiltres} id="t-filtres" actifs=${actifs} onClick=${() => setFeuille(true)}/></div>
    ${list.length ? html`<p class="liste-tete">${`${list.length} talent${list.length > 1 ? 's' : ''}`}</p>
    <ul class="lignes talents">${vus.map(p => { const s = saved.get(p.id); const e = etat(p); return html`<li key=${p.id} class="ligne">
      <${PersonneLigne} p=${p} onOpen=${() => setFiche(p.id)} meta=${html`${e ? html`<span class=${'ligne-etat ' + e[0]}>${e[1]}</span> · ` : null}Cherche : <strong>${cherche(p)}</strong>${laur(p) ? html` · Promo ${p.promo}` : null}${p.disponibilite ? html` · <span translate="no" dir="auto">${p.disponibilite}</span>` : null}${p.ville ? html` · <span translate="no">${p.ville}</span>` : null}`}/>
      ${canRecruit ? html`<span class="ligne-act"><button class=${'icon-btn save-btn' + (s ? ' on' : '')} aria-pressed=${!!s} aria-label=${s ? 'Ne plus mettre de côté' : 'Mettre de côté'} title=${s ? 'Ne plus mettre de côté' : 'Mettre de côté'} onClick=${() => toggle(p)}><${Icon} name="bookmark" size=${18}/></button></span>` : null}
    </li>`; })}</ul>
    <${VoirPlus} reste=${reste} onPlus=${plus}/>` : view === 'shortlist' && !saved.size
      ? html`<${Empty} icon="bookmark" title="Aucun profil mis de côté">Clique sur le marque-page d’un profil pour le mettre de côté ici, avec une note pour toi.<//>`
      : html`<${Empty} icon="spark" title="Personne ne correspond à ces critères">Essaie une autre filière ou enlève un filtre.<//>`}
    ${feuille ? html`<${FeuilleFiltres} total=${list.length} actifs=${actifs} onEffacer=${() => { setFil(''); setNiv(''); setCv(false); }} onClose=${() => setFeuille(false)}>
      <${Field} label="Filière"><${FiliereFiltre} id="t-fil" value=${fil} onChange=${setFil}/><//>
      <${Field} label="Année"><select id="t-niv" value=${niv} onChange=${e => setNiv(e.target.value)}><option value="">Toutes les années</option><option value="3">3A</option><option value="4">4A</option><option value="5">5A</option><option value="L">Lauréats en recherche</option></select><//>
      <div class="filtres-bascules"><button type="button" class=${'chip' + (cv ? ' on' : '')} aria-pressed=${cv} onClick=${() => setCv(!cv)}><${Icon} name="file" size=${14}/> Avec CV</button></div>
    <//>` : null}
    ${pf ? html`<${FicheTalent} ctx=${ctx} p=${pf} s=${saved.get(pf.id)} etat=${etat(pf)} cherche=${cherche(pf)} canRecruit=${canRecruit} trouve=${trouve} enRecherche=${searching(pf)}
      onToggle=${() => toggle(pf)} onInvite=${() => { setFiche(null); setInvite(pf); }} onClose=${() => setFiche(null)}/>` : null}
    ${invite ? html`<${InviteModal} ctx=${ctx} student=${invite} onClose=${() => setInvite(null)}/>` : null}
  </div>`;
}

// Le détail d'un talent, dans une feuille : ce qu'il cherche, ses compétences, son CV, ta note ; « Inviter à postuler » en bas
function FicheTalent({ ctx, p, s, etat, cherche, canRecruit, trouve, enRecherche, onToggle, onInvite, onClose }) {
  const { store, act, openProfile } = ctx;
  const laur = p.role === 'laureat';
  return html`<${Modal} title="Profil" onClose=${onClose} footer=${canRecruit && enRecherche ? html`<button type="button" class="btn primary" onClick=${onInvite}><${Icon} name="send" size=${16}/> Inviter à postuler</button>` : null}>
    <div class="fiche-talent">
      <div class="row"><${Person} p=${p} onOpen=${x => { onClose(); openProfile(x); }} size=${48}/><span class="spacer"></span>
        ${canRecruit ? html`<button class=${'icon-btn save-btn' + (s ? ' on' : '')} aria-pressed=${!!s} aria-label=${s ? 'Ne plus mettre de côté' : 'Mettre de côté'} title=${s ? 'Ne plus mettre de côté' : 'Mettre de côté'} onClick=${onToggle}><${Icon} name="bookmark" size=${18}/></button>` : null}</div>
      <p>Cherche : <strong>${cherche}</strong>${laur ? html` <span class="muted">· Promo ${p.promo}</span>` : null}</p>
      ${p.disponibilite || p.ville ? html`<p class="small muted tmeta">${p.disponibilite ? html`<span><${Icon} name=${laur ? 'briefcase' : 'calendar'} size=${14}/> <span translate="no" dir="auto">${p.disponibilite}</span></span>` : null}${p.ville ? html`<span><${Icon} name="pin" size=${14}/> ${p.ville}</span>` : null}</p>` : null}
      ${(p.competences || []).length ? html`<p class="chips-line">${p.competences.slice(0, 10).map(c => html`<span class=${'mini' + (trouve && trouve(c) ? ' hit' : '')}>${c}</span>`)}</p>` : null}
      ${etat ? html`<p><span class=${'state-pill ' + etat[0]}>${etat[1]}</span></p>` : null}
      ${s ? html`<input class="note-in" id=${'note-' + p.id} maxlength="300" placeholder="Note pour moi (visible par moi seul)" value=${s.note || ''} onChange=${e => act(() => store.update('shortlists', s.id, { note: e.target.value.trim() }))}/>` : null}
      <div class="row">${p.cv_path || p.cv_url ? html`<${CvButton} ctx=${ctx} p=${p} small/>` : html`<span class="muted small">Pas encore de CV</span>`}
        <button type="button" class="btn small ghost" onClick=${() => { onClose(); openProfile(p); }}>Voir le profil</button></div>
    </div>
  <//>`;
}

function InviteModal({ ctx, student, onClose }) {
  const { data, me, saison, store, act } = ctx;
  const mine = data.offers.filter(o => o.author_id === me.id && o.status === 'ouverte')
    .map(o => ({ o, fit: matchesMe(o, student, saison), done: data.invitations.some(i => i.offer_id === o.id && i.student_id === student.id), applied: data.applications.some(a => a.offer_id === o.id && a.student_id === student.id) }))
    .sort((a, b) => b.fit - a.fit);
  const [offerId, setOfferId] = useState(mine.find(x => x.fit && !x.done && !x.applied)?.o.id || mine.find(x => !x.done && !x.applied)?.o.id || '');
  // Message proposé dans la langue de l'interface ; le lauréat le modifie librement
  const [msg, setMsg] = useState(getLang() === 'ar' ? `السلام ${firstName(student)}، ملفك يهمني لهذا العرض. ترشّح إذا أعجبك!` : `Bonjour ${firstName(student)}, ton profil m’intéresse pour cette offre. Postule si ça te parle !`);
  const [compose, setCompose] = useState(false);
  if (compose) return html`<${OfferComposer} ctx=${ctx} onClose=${() => setCompose(false)}/>`;
  const send = e => {
    e.preventDefault();
    act(async () => { await store.insert('invitations', { laureat_id: me.id, student_id: student.id, offer_id: offerId, message: msg.trim() }); toast('Invitation envoyée. Elle apparaît dans ses notifications.'); onClose(); });
  };
  return html`<${Modal} title=${`Inviter ${student.full_name}`} onClose=${onClose}>
    ${mine.length ? html`<form class="form" onSubmit=${send}>
      <p class="small muted">L’étudiant reçoit une notification et ouvre l’offre en un clic. Il reste libre de postuler ou non.</p>
      <fieldset class="pick-list"><legend class="field-label">Sur quelle offre ?</legend>
        ${mine.map(({ o, fit, done, applied }) => html`<label class=${'pick' + (done || applied ? ' off' : '')} key=${o.id}>
          <input type="radio" name="inv-offer" value=${o.id} checked=${offerId === o.id} disabled=${done || applied} onChange=${() => setOfferId(o.id)}/>
          <span><strong>${o.titre}</strong><span class="small muted">${applied ? 'A déjà postulé' : done ? 'Invitation déjà envoyée' : fit ? 'Correspond à son année et à sa filière' : 'Hors de son année ou de sa filière'}</span></span></label>`)}
      </fieldset>
      <${Field} label="Message"><textarea id="inv-msg" rows="3" maxlength="600" value=${msg} onInput=${e => setMsg(e.target.value)}></textarea><//>
      ${!offerId ? html`<p class="small muted">Cet étudiant a déjà reçu une invitation ou postulé sur chacune de tes offres ouvertes.</p>` : null}
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" disabled=${!offerId}><${Icon} name="send" size=${16}/> Envoyer l’invitation</button></div>
    </form>` : html`<${Empty} icon="feed" title="Publie d’abord une offre">Tu pourras ensuite inviter cet étudiant à y postuler en un clic.<//>
      <div class="row-end"><button class="btn primary" onClick=${() => setCompose(true)}><${Icon} name="plus" size=${16}/> Publier une offre</button></div>`}
  <//>`;
}

// ---------------------------------------------------------------------------
// Attestation de contribution : imprimable, ajoutable sur LinkedIn, vérifiable par lien
// ---------------------------------------------------------------------------
export const codeOf = id => String(id).replace(/[^0-9a-z]/gi, '').slice(0, 8).toUpperCase().replace(/^(.{4})/, '$1-');
export const verifyUrl = id => `${location.origin}${location.pathname}#verifier/${id}`;
const fmtLong = iso => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const STAT_KEYS = ['mentorats', 'recrutes', 'reponses'];

function linkedinCertUrl(a) {
  const d = new Date(a.created_at); const enc = encodeURIComponent;
  return `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${enc('Attestation de contribution · Réseau ENSAM Meknès')}&organizationName=${enc('Réseau ENSAM Meknès')}&issueYear=${d.getFullYear()}&issueMonth=${d.getMonth() + 1}&certUrl=${enc(verifyUrl(a.id))}&certId=${enc(codeOf(a.id))}`;
}

function printCertificate() {
  const off = () => { document.body.classList.remove('print-cert'); removeEventListener('afterprint', off); };
  document.body.classList.add('print-cert');
  addEventListener('afterprint', off);
  setTimeout(off, 4000);
  try { window.print(); } catch { off(); toast('Utilise Ctrl+P, ou Partager puis Imprimer sur téléphone.', 'err'); }
}

export function Certificate({ p, a, code, url }) {
  const s = a.stats || {};
  const facts = [
    [s.mentorats, 'mentorat terminé', 'mentorats terminés'],
    [s.recrutes, 'étudiant recruté et confirmé', 'étudiants recrutés et confirmés'],
    [s.reponses, 'réponse dans l’Entraide', 'réponses dans l’Entraide'],
  ].filter(f => f[0] > 0);
  return html`<div class="certificate">
    <div class="cert-in">
      <div class="cert-top"><${BrandLogo} size=${52}/><span class="cert-org"><strong>Réseau ENSAM Meknès</strong><span>Lauréats & étudiants</span></span></div>
      <p class="cert-kicker">Attestation de contribution</p>
      <p>La plateforme Réseau ENSAM Meknès atteste que</p>
      <p class="cert-name">${p.full_name}</p>
      <p class="cert-sub">${p.filiere} · Promo ${p.promo}</p>
      <p>a accompagné les étudiants de l’école :</p>
      <ul class="cert-facts">${facts.map(([n, one, many]) => html`<li><b class="mono">${n}</b><span>${n > 1 ? many : one}</span></li>`)}</ul>
      <p class="small muted">Chaque action est confirmée par l’étudiant concerné sur la plateforme.</p>
      <div class="cert-foot"><span>Délivrée le ${fmtLong(a.created_at)}</span>${code ? html`<span>Code <b class="mono">${code}</b></span>` : null}</div>
      ${url ? html`<p class="cert-url small">Vérifier : <span class="mono" dir="ltr">${url.replace(/^https?:\/\//, '')}</span></p>` : null}
    </div>
  </div>`;
}

// Dans « Mon espace » (Mes documents), à côté du bilan : une phrase qui dit à quoi elle sert
export function AttestationCard({ ctx }) {
  const [open, setOpen] = useState(false);
  return html`<div class="attest-card">
    <span class="attest-ico"><${Icon} name="award" size=${24}/></span>
    <div class="grow"><strong>Attestation de contribution</strong><span class="small muted">Pour ton CV et LinkedIn, avec un lien de vérification.</span></div>
    <button class="btn small" onClick=${() => setOpen(true)}>Voir mon attestation</button>
    ${open ? html`<${AttestationModal} ctx=${ctx} onClose=${() => setOpen(false)}/>` : null}
  </div>`;
}

function AttestationModal({ ctx, onClose }) {
  const { data, me, store, act } = ctx;
  const now = attestationStats(data, me.id);
  const last = data.attestations.filter(a => a.laureat_id === me.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const current = last && STAT_KEYS.every(k => (last.stats?.[k] || 0) === now[k]) ? last : null;
  if (!now.mentorats && !now.recrutes) return html`<${Modal} title="Attestation de contribution" onClose=${onClose}>
    <${Empty} icon="award" title="Bientôt prête">Ton attestation sera disponible après ton premier mentorat terminé ou recrutement confirmé.<//><//>`;
  const shown = current || { stats: now, created_at: new Date().toISOString() };
  return html`<${Modal} title="Attestation de contribution" onClose=${onClose} wide>
    <${Certificate} p=${me} a=${shown} code=${current ? codeOf(current.id) : null} url=${current ? verifyUrl(current.id) : null}/>
    ${current ? html`<div class="row-end wrap cert-actions">
      <button class="btn ghost" onClick=${() => copyText(verifyUrl(current.id), 'Lien de vérification copié.')}><${Icon} name="link" size=${16}/> Copier le lien</button>
      <a class="btn ghost" href=${linkedinCertUrl(current)} target="_blank" rel="noopener"><${Icon} name="share" size=${16}/> Ajouter à mon profil LinkedIn</a>
      <button class="btn primary" onClick=${printCertificate}><${Icon} name="download" size=${16}/> Imprimer ou PDF</button></div>`
    : html`<div class="row-end wrap cert-actions"><p class="small muted grow">${last ? 'Tes chiffres ont changé depuis ta dernière attestation. Crée une version à jour.' : 'Crée ton attestation pour obtenir son code et son lien de vérification.'}</p>
      <button class="btn primary" onClick=${() => act(async () => { await store.insert('attestations', { laureat_id: me.id }); toast('Attestation créée.', 'win'); })}><${Icon} name="award" size=${16}/> Créer mon attestation</button></div>`}
  <//>`;
}

// Page publique : un recruteur ou une RH vérifie une attestation, sans compte
export function VerifyPage({ store, id }) {
  const [res, setRes] = useState(undefined);
  useEffect(() => { let on = true; Promise.resolve(store.verifyAttestation(id)).then(r => on && setRes(r || null), () => on && setRes(null)); return () => { on = false; }; }, [id]);
  return html`<div class="verify-page">
    <a class="brand" href="#accueil"><${BrandLogo} size=${40}/><strong>Réseau ENSAM Meknès</strong></a>
    ${res === undefined ? html`<p class="muted">Vérification en cours…</p>`
      : res ? html`<p class="verify-ok"><${Icon} name="shield" size=${18}/> Attestation authentique, enregistrée sur la plateforme</p><${Certificate} p=${res} a=${res} code=${codeOf(res.id)}/>`
      : html`<div class="verify-ko"><${Icon} name="x" size=${20}/><div><strong>Aucune attestation ne correspond à ce lien.</strong><p class="small muted">Vérifie que le lien est complet, ou demande-le à nouveau à la personne.</p></div></div>`}
  </div>`;
}

// ---------------------------------------------------------------------------
// Fil des réussites : bravos, et partage sur LinkedIn
// ---------------------------------------------------------------------------
const WHAT = { stage: 'son stage', pfe: 'son PFE', etranger: 'son stage à l’étranger', emploi: 'son premier emploi' };

// max : nombre de réussites montrées. S'il en reste : un lien discret vers le Suivi, où elles sont toutes ;
// sur le Suivi lui-même (lien=false), on les déplie sur place.
export function SuccessFeed({ ctx, max = 5, lien = true }) {
  const { data, me, saison, store, act, openProfile } = ctx;
  const [share, setShare] = useState(null);
  const [tout, setTout] = useState(false);
  const myN = me.role === 'etudiant' ? niveauOf(me, saison) : null; // un étudiant voit les réussites de sa promo
  const toutes = data.placements.filter(p => p.saison === saison && FOUND.has(p.status) && (myN === null || p.niveau === myN || p.student_id === me.id))
    .sort((a, b) => new Date(b.confirmed_at || b.created_at) - new Date(a.confirmed_at || a.created_at));
  const items = tout ? toutes : toutes.slice(0, max);
  const reste = toutes.length - items.length;
  if (!items.length) return null;
  const voirTout = () => {
    ctx.go('suivi');
    setTimeout(() => document.getElementById('reussites')?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }), 400);
  };
  return html`<div class="panel wins-panel" id=${lien ? undefined : 'reussites'}>
    <div class="section-head"><h2 class="h-ico"><${Icon} name="trophy"/> ${myN ? 'Réussites de mon année' : 'Réussites de l’année'}</h2></div>
    <ul class="wins">${items.map(p => {
      const st = store.byId('profiles', p.student_id); const la = p.status === 'confirme' && p.laureat_id ? store.byId('profiles', p.laureat_id) : null;
      const k = data.kudos.filter(x => x.placement_id === p.id); const mine = k.find(x => x.user_id === me.id);
      const own = p.student_id === me.id || (la && la.id === me.id);
      return html`<li class="win" key=${p.id}>
        <${Avatar} p=${st} size=${38}/>
        <div class="win-txt"><p><button class="linkish strong" onClick=${() => openProfile(st)}>${st ? html`<span translate="no" dir="auto">${st.full_name}</span>` : 'Un étudiant'}</button> a décroché ${WHAT[p.type]} chez <strong translate="no">${p.entreprise}</strong>${la ? html` ${AIDES[p.aide]?.annonce || 'grâce à'} <button class="linkish strong" onClick=${() => openProfile(la)}><span translate="no" dir="auto">${la.full_name}</span></button>` : null}</p>
          <span class="muted small">${p.status === 'confirme' ? (p.demande_id ? 'Vérifié des deux côtés · Via sa demande' : 'Vérifié des deux côtés') : 'Trouvé hors plateforme'} · ${timeAgo(p.confirmed_at || p.created_at)}</span></div>
        <div class="win-act">
          <button class=${'kudo' + (mine ? ' on' : '')} aria-pressed=${!!mine} disabled=${p.student_id === me.id} title=${mine ? 'Retirer mon bravo' : 'Dire bravo'} onClick=${() => act(() => (mine ? store.remove('kudos', mine.id) : store.insert('kudos', { placement_id: p.id, user_id: me.id })))}><${Icon} name="clap" size=${16}/><span>Bravo</span>${k.length ? html`<b class="mono">${k.length}</b>` : null}</button>
          ${own ? html`<button class="icon-btn small" aria-label="Partager sur LinkedIn" title="Partager sur LinkedIn" onClick=${() => setShare(p)}><${Icon} name="share" size=${16}/></button>` : null}
        </div>
      </li>`;
    })}</ul>
    ${reste > 0 ? (lien ? html`<button type="button" class="btn small ghost wins-all" onClick=${voirTout}>Voir toutes les réussites <${Icon} name="arrow" size=${14}/></button>`
      : html`<button type="button" class="btn small ghost wins-all" onClick=${() => setTout(true)}>${reste > 1 ? `Voir les ${reste} autres réussites` : 'Voir l’autre réussite'}</button>`) : null}
    ${share ? html`<${ShareModal} ctx=${ctx} pl=${share} onClose=${() => setShare(null)}/>` : null}
  </div>`;
}

injectCSS('growth-ux', `
.wins-all { align-self: flex-start; margin-inline-start: -.5rem; color: var(--blue-text); }
`);
addAR({ 'Voir toutes les réussites': 'عرض كل النجاحات', 'Voir l’autre réussite': 'عرض النجاح الآخر',
  // Mettre de côté (marque-page), un seul mot pour les offres et les profils
  'Mis de côté': 'المحفوظة', 'Mettre de côté': 'حفظ', 'Ne plus mettre de côté': 'إلغاء الحفظ', 'Aucun profil mis de côté': 'لا ملف محفوظ',
  'Clique sur le marque-page d’un profil pour le mettre de côté ici, avec une note pour toi.': 'انقر على علامة الحفظ في ملف لتحفظه هنا، مع ملاحظة لك.',
  'Invitation envoyée': 'دعوة مُرسلة', 'Invitation déjà envoyée': 'سبق إرسال الدعوة', 'Étudiants et lauréats en recherche, visibles par les lauréats.': 'طلبة وخريجون يبحثون عن فرصة، يظهرون للخريجين.',
  'Réussites de mon année': 'نجاحات سنتي', 'Réussites de l’année': 'نجاحات السنة',
}, [
  [/^Profil de (.+) mis de côté\.$/, n => `حُفظ ملف ${n}.`],
  [/^Voir les (\d+) autres réussites$/, n => `عرض ${n} نجاحات أخرى`],
]);

// Qui remercie qui : les deux visages, l'année (ou la promo) de l'auteur, l'entreprise et la date. Écrite à côté du
// nom du lauréat, l'entreprise (la sienne, ou celle d'une réussite confirmée) ne s'affiche que s'il montre son travail
// à ce lecteur (« Qui voit quoi » ; en ligne, a.entreprise est vide s'il le cache). seul : le lauréat est déjà nommé à
// côté (carte de mentor), on ne montre que l'auteur.
export function MerciDuo({ ctx, m, size = 26, seul = false }) {
  const { store, saison, openProfile } = ctx;
  const de = store.byId('profiles', m.from), a = store.byId('profiles', m.to);
  const annee = !de ? '' : de.role === 'etudiant' ? NIVEAUX[niveauOf(de, saison)]?.short || '' : de.promo ? `Promo ${de.promo}` : '';
  const ent = a && a.entreprise && store.voitChamp(a, 'travail') ? m.entreprise || a.entreprise : '';
  const prenom = de?.full_name?.split(' ')[0];
  return html`<footer class="merci-duo">
    <span class="md-qui"><${Avatar} p=${de} size=${size}/><span class="md-txt">${prenom ? html`<b translate="no" dir="auto">${prenom}</b>` : html`<b>Un étudiant</b>`}${annee ? html`<span class="muted"> · ${annee}</span>` : null}</span></span>
    ${!seul && a ? html`<span class="md-vers"><${Icon} name="arrow" size=${14}/><span class="sr-only"> → </span>
    <span class="md-qui"><${Avatar} p=${a} size=${size}/><span class="md-txt"><button type="button" class="linkish" onClick=${() => openProfile(a)}><span translate="no" dir="auto">${a.full_name}</span></button>${ent ? html`<span class="muted"> · <span translate="no" dir="auto">${ent}</span></span>` : null}</span></span></span>` : null}
    <span class="muted small md-quand">${m.confirme && !seul ? `Vérifié des deux côtés · ${timeAgo(m.at)}` : timeAgo(m.at)}</span>
  </footer>`;
}
injectCSS('merci-duo', `
.merci-duo { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem .45rem; font-size: .88rem; }
.merci-duo .md-qui { display: inline-flex; align-items: center; gap: .35rem; min-width: 0; }
.merci-duo .md-txt { min-width: 0; overflow-wrap: anywhere; }
.merci-duo .md-vers { display: inline-flex; align-items: center; gap: .45rem; min-width: 0; }
.merci-duo .md-vers > svg { color: var(--muted); flex: none; }
.merci-duo .md-quand { flex-basis: 100%; }
.mcard-merci { align-self: stretch; padding: .5rem .7rem; }
.mcard-merci p { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; font-size: .9rem; }
`);

const POUR_MOI = { stage: 'mon stage', pfe: 'mon projet de fin d’études', etranger: 'mon stage à l’étranger', emploi: 'mon premier poste d’ingénieur' };
const POUR_LUI = { stage: 'son stage', pfe: 'son projet de fin d’études', etranger: 'son stage', emploi: 'son premier poste d’ingénieur' };

// Texte proposé : l'étudiant parle de lui ; le lauréat ne cite le nom de l'étudiant qu'avec son accord.
export function shareText(store, me, pl) {
  const st = store.byId('profiles', pl.student_id); const la = pl.laureat_id && pl.status === 'confirme' ? store.byId('profiles', pl.laureat_id) : null;
  const lieu = pl.ville ? ` à ${pl.ville}` : '';
  if (pl.student_id === me.id) {
    return `Une belle nouvelle : je rejoins ${pl.entreprise}${lieu} pour ${POUR_MOI[pl.type]} !`
      + (la ? `\n\nMerci à ${la.full_name} (ENSAM Meknès), qui m’a ouvert la porte grâce au Réseau ENSAM Meknès.` : '')
      + '\n\n#ENSAM #ENSAMMeknès #ArtsEtMétiers';
  }
  const who = pl.partage_ok ? st?.full_name : 'un talent de l’ENSAM Meknès';
  return `C’est une joie d’accueillir ${who} chez ${pl.entreprise}${lieu} pour ${POUR_LUI[pl.type]}.\n\nSur le Réseau ENSAM Meknès, les lauréats partagent leurs offres de stages, de PFE et d’emplois avec les étudiants de l’école. Lauréats, rejoignez-nous !\n\n#ENSAM #ENSAMMeknès #ArtsEtMétiers`;
}

export function ShareModal({ ctx, pl, onClose }) {
  const { store, me } = ctx;
  const [text, setText] = useState(() => shareText(store, me, pl));
  const st = store.byId('profiles', pl.student_id);
  const anonymous = pl.student_id !== me.id && !pl.partage_ok;
  return html`<${Modal} title="Partager sur LinkedIn" onClose=${onClose}>
    <div class="form">
      <p class="small muted">LinkedIn ouvre une nouvelle publication avec ce texte. Tu peux le modifier ici avant.</p>
      ${anonymous ? html`<p class="small hint-box"><${Icon} name="shield" size=${15}/> <span>${firstName(st)} n’a pas autorisé que son nom soit publié : le texte reste anonyme.</span></p>` : null}
      <textarea id="share-txt" rows="7" maxlength="2500" value=${text} onInput=${e => setText(e.target.value)}></textarea>
      <div class="row-end wrap">
        <button type="button" class="btn ghost" onClick=${() => copyText(text, 'Texte copié.')}><${Icon} name="copy" size=${16}/> Copier le texte</button>
        <a class="btn primary" href=${'https://www.linkedin.com/feed/?shareActive=true&text=' + encodeURIComponent(text)} target="_blank" rel="noopener"><${Icon} name="share" size=${16}/> Ouvrir LinkedIn</a>
      </div>
    </div>
  <//>`;
}
