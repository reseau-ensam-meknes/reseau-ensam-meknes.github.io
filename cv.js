// CV en PDF et relecture de CV : l'étudiant dépose son CV et choisit qui le voit, demande une relecture ;
// un lauréat la prend, commente rubrique par rubrique, rédige une synthèse et la rend ; l'étudiant dit merci.
import { html, useState, useRef } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, toast, injectCSS } from './ui.js';
import { addAR, t as tr } from './i18n.js';
import { timeAgo, niveauOf, NIVEAUX } from './logic.js';
import { CV_MAX } from './store.js';
import { MessageBtn } from './messages.js';

const firstName = p => (p?.full_name || '').split(' ')[0];
const href = u => (/^https?:\/\//i.test(u) ? u : 'https://' + u);
const ACTIVES = ['demandee', 'en_cours'];
export const RUBRIQUES = [['general', 'Général', 'spark'], ['profil', 'Profil et accroche', 'user'], ['formation', 'Formation', 'cap'], ['experience', 'Expériences', 'briefcase'],
  ['projets', 'Projets', 'wrench'], ['competences', 'Compétences', 'star'], ['langues', 'Langues', 'globe'], ['mise_en_page', 'Mise en page', 'file']];
const PILL = { demandee: ['m-demande', 'En attente'], ouverte: ['m-demande', 'Ouverte à tous les lauréats'], en_cours: ['m-acceptee', 'En cours de relecture'], rendue: ['m-terminee', 'Relecture rendue'], annulee: ['m-refusee', 'Annulée'] };
const ETAPES = ['Demandée', 'En cours', 'Rendue'];

// Qui voit mon CV, selon le choix « CV » de la visibilité du profil
const QUI_VOIT = {
  tous: 'Visible par tous les membres connectés.',
  laureats: 'Visible par les lauréats, et par le lauréat dont tu postules à l’offre.',
  contacts: 'Visible seulement par tes contacts acceptés et par le lauréat dont tu postules à l’offre.',
};

// Ouvre un CV : la fenêtre s'ouvre tout de suite (sinon le navigateur la bloque), le lien temporaire arrive ensuite.
// Si la fenêtre est bloquée quand même, on renvoie le lien pour l'afficher.
async function ouvrirCV(store, path) {
  let w = null;
  try { w = window.open('', '_blank'); } catch { /* fenêtre refusée */ }
  try {
    const url = await store.lienCV(path);
    if (w && !w.closed) { w.location.href = url; return null; }
    return url;
  } catch (e) { try { w?.close(); } catch { /* */ } toast(e.message || String(e), 'err'); return null; }
}

// Bouton « Voir le CV » (et lien de secours si la fenêtre a été bloquée)
function OuvrirCV({ store, path, label = 'Voir le CV', cls = 'btn small ghost' }) {
  const [lien, setLien] = useState(null); const [busy, setBusy] = useState(false);
  if (lien) return html`<a class=${cls} href=${lien} target="_blank" rel="noopener" onClick=${() => setTimeout(() => setLien(null), 500)}><${Icon} name="file" size=${14}/> Ouvrir le CV</a>`;
  return html`<button type="button" class=${cls} disabled=${busy} onClick=${async () => { setBusy(true); setLien(await ouvrirCV(store, path)); setBusy(false); }}><${Icon} name="eye" size=${14}/> ${label}</button>`;
}

export function CvButton({ ctx, p, small }) {
  const { store } = ctx;
  if (!p || !store.voitChamp(p, 'cv')) return null;
  const cls = small ? 'btn tiny ghost' : 'btn small ghost';
  if (p.cv_path) return html`<${OuvrirCV} store=${store} path=${p.cv_path} cls=${cls}/>`;
  if (p.cv_url) return html`<a class=${cls} href=${href(p.cv_url)} target="_blank" rel="noopener"><${Icon} name="file" size=${14}/> Voir le CV</a>`;
  return null;
}

// ---------------------------------------------------------------------------
// Mon CV (page Mon profil)
// ---------------------------------------------------------------------------
export function CvCard({ ctx }) {
  const { me, store, act, data, go } = ctx;
  const input = useRef(); const [over, setOver] = useState(false); const [busy, setBusy] = useState(false); const [ask, setAsk] = useState(false);
  if (!me || me.role === 'admin') return null;
  const deposer = file => {
    if (!file) return;
    if (file.size > CV_MAX) { toast('Le fichier dépasse 2 Mo. Exporte ton CV en PDF plus léger.', 'err'); return; }
    const remplace = !!me.cv_path;
    setBusy(true);
    act(async () => { await store.deposerCV(file); toast(remplace ? 'CV remplacé.' : 'CV déposé.'); }).finally(() => { setBusy(false); if (input.current) input.current.value = ''; });
  };
  const vis = (me.visibilite || {}).cv || 'laureats';
  const mine = data.relectures_cv.filter(r => r.student_id === me.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const last = mine.find(r => r.status !== 'annulee');
  const enCours = mine.filter(r => ACTIVES.includes(r.status)).length;
  const reviewer = last?.reviewer_id ? store.byId('profiles', last.reviewer_id) : null;

  return html`<div class="panel cv-card">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="file"/> Mon CV</h2>${me.cv_path ? html`<span class="small muted">Mis à jour ${timeAgo(me.cv_maj || me.created_at)}</span>` : null}</div>
    <input ref=${input} id="cv-file" type="file" accept="application/pdf,.pdf" hidden onChange=${e => deposer(e.target.files[0])}/>
    ${me.cv_path ? html`<div class="cv-file">
        <span class="cv-ico"><${Icon} name="file" size=${22}/></span>
        <span class="grow"><strong>CV en PDF</strong><span class="small muted">Joint à chaque candidature</span></span>
        <span class="cv-acts"><${OuvrirCV} store=${store} path=${me.cv_path} label="Voir"/>
          <button type="button" class="btn small ghost" disabled=${busy} onClick=${() => input.current?.click()}><${Icon} name="upload" size=${14}/> ${busy ? 'Envoi en cours…' : 'Remplacer'}</button>
          <button type="button" class="icon-btn small" aria-label="Retirer mon CV" title="Retirer mon CV" onClick=${() => ctx.confirm('Retirer ton CV ? Les lauréats ne le verront plus avec tes candidatures.', () => act(async () => { await store.retirerCV(); toast('CV retiré.'); }), 'Retirer')}><${Icon} name="trash" size=${16}/></button></span>
      </div>`
      : html`<button type="button" id="cv-drop" class=${'cv-drop' + (over ? ' over' : '')} disabled=${busy} onClick=${() => input.current?.click()}
          onDragOver=${e => { e.preventDefault(); setOver(true); }} onDragLeave=${() => setOver(false)} onDrop=${e => { e.preventDefault(); setOver(false); deposer(e.dataTransfer?.files?.[0]); }}>
        <span class="cv-ico"><${Icon} name="upload" size=${22}/></span>
        <strong>${busy ? 'Envoi en cours…' : 'Dépose ton CV en PDF ici'}</strong>
        <span class="small muted">ou clique pour choisir un fichier · PDF, 2 Mo maximum</span>
      </button>
      ${me.cv_url ? html`<p class="small muted">Tu as déjà un lien vers ton CV dans ton profil. Le PDF est plus simple pour les lauréats.</p>` : null}`}
    <p class="small muted cv-vis"><${Icon} name="lock" size=${14}/><span>${QUI_VOIT[vis] || QUI_VOIT.laureats}</span><span>Choisis qui le voit plus bas.</span></p>

    ${me.cv_path || last ? html`<div class="cv-relu">
      <span class="obj-ico"><${Icon} name="eye" size=${18}/></span>
      <span class="grow">${!last ? html`<strong>Fais relire ton CV par un lauréat</strong><span class="small muted">Il commente rubrique par rubrique et te donne ses conseils.</span>`
        : last.status === 'rendue' ? html`<strong>${last.merci || last.note ? 'Ta dernière relecture est rendue' : 'Ta relecture est prête'}</strong><span class="small muted">${reviewer ? `Par ${reviewer.full_name} · ${timeAgo(last.rendue_at || last.created_at)}` : timeAgo(last.rendue_at || last.created_at)}</span>`
        : last.status === 'en_cours' ? html`<strong>${reviewer ? `${firstName(reviewer)} relit ton CV` : 'Ton CV est en cours de relecture'}</strong><span class="small muted">Tu seras prévenu(e) dès que c’est fini.</span>`
        : html`<strong>Demande de relecture envoyée</strong><span class="small muted">${reviewer ? `En attente de ${firstName(reviewer)} · ${timeAgo(last.created_at)}` : 'En attente d’un lauréat disponible'}</span>`}</span>
      ${last ? html`<button class=${'btn small' + (last.status === 'rendue' && !last.merci && !last.note ? ' primary' : ' ghost')} onClick=${() => go('mentorat/cv')}>${last.status === 'rendue' && !last.merci && !last.note ? 'Lire les conseils' : 'Suivre'}</button>` : null}
      ${me.cv_path && enCours < 2 && (!last || !ACTIVES.includes(last.status)) ? html`<button id="cv-ask" class=${'btn small' + (last ? ' ghost' : ' primary')} onClick=${() => setAsk(true)}>${last ? 'Nouvelle relecture' : 'Demander une relecture'}</button>` : null}
    </div>` : null}
    ${ask ? html`<${DemandeRelecture} ctx=${ctx} onClose=${() => setAsk(false)}/>` : null}
  </div>`;
}

// Demande de relecture : à tous les lauréats (le premier disponible), ou à un lauréat de ma filière
function DemandeRelecture({ ctx, onClose }) {
  const { data, me, store, act } = ctx;
  const [msg, setMsg] = useState(''); const [qui, setQui] = useState('');
  const proches = data.profiles.filter(p => p.role === 'laureat' && p.id !== me.id && p.filiere === me.filiere && (me.role !== 'laureat' || p.promo < me.promo))
    .sort((a, b) => (!!b.mentor_dispo - !!a.mentor_dispo) || (!!b.verified - !!a.verified) || a.promo - b.promo).slice(0, 8);
  const send = e => {
    e.preventDefault();
    act(async () => {
      await store.insert('relectures_cv', { student_id: me.id, cv_path: me.cv_path, reviewer_id: qui || null, message: msg.trim() || null });
      toast(qui ? `Demande envoyée à ${firstName(store.byId('profiles', qui))}.` : 'Demande envoyée aux lauréats.');
      onClose();
    });
  };
  return html`<${Modal} title="Demander une relecture" onClose=${onClose}>
    <form class="form" onSubmit=${send}>
      <p class="small muted">Un lauréat ouvre ton CV, laisse des commentaires rubrique par rubrique et une synthèse. Tu es prévenu(e) quand c’est prêt.</p>
      <${Field} label="Ce que tu vises (facultatif)" hint="Ex. PFE en excellence opérationnelle, stage 4A dans l’automobile…"><textarea id="rv-msg" rows="3" maxlength="600" value=${msg} onInput=${e => setMsg(e.target.value)} placeholder="Le poste visé, ce qui t’inquiète dans ton CV…"></textarea><//>
      <${Field} label="Qui relit ?"><select id="rv-qui" value=${qui} onChange=${e => setQui(e.target.value)}>
        <option value="">Tous les lauréats (le premier disponible)</option>
        ${proches.map(p => html`<option value=${p.id} translate="no">${p.full_name} · ${p.entreprise || p.promo}</option>`)}
      </select><//>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary"><${Icon} name="send" size=${15}/> Envoyer ma demande</button></div>
    </form>
  <//>`;
}

// ---------------------------------------------------------------------------
// Page Mentorat > Relecture de CV
// ---------------------------------------------------------------------------
export function RelecturesPage({ ctx }) {
  const { data, me, store, go } = ctx;
  const [ask, setAsk] = useState(false); const [past, setPast] = useState(false); const [more, setMore] = useState(false);
  const R = data.relectures_cv;
  const recent = (a, b) => new Date(b.created_at) - new Date(a.created_at);
  if (me.role === 'admin') {
    const ouv = R.filter(r => r.status === 'demandee'); const cours = R.filter(r => r.status === 'en_cours');
    const rendues = R.filter(r => r.status === 'rendue'); const notes = rendues.map(r => r.note).filter(Boolean);
    const vieilles = ouv.filter(r => Date.now() - new Date(r.created_at) > 7 * 864e5).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return html`<div class="sub-page">
      <div class="kpis">${[['Demandes en attente', ouv.length, 'pas encore prises'], ['En cours', cours.length, 'un lauréat relit'], ['Relectures rendues', rendues.length, 'depuis le début'],
        ['Note moyenne', notes.length ? (notes.reduce((a, b) => a + b, 0) / notes.length).toFixed(1) : '–', notes.length ? 'donnée par les étudiants' : 'pas encore de note']].map(([l, v, s]) => html`<div class="kpi"><span class="kpi-label">${l}</span><span class="kpi-val mono">${v}</span><span class="small muted">${s}</span></div>`)}</div>
      ${vieilles.length ? html`<div class="section-head"><h2>En attente depuis plus d’une semaine <span class="count">${vieilles.length}</span></h2></div>
        <ul class="people-list">${vieilles.map(r => html`<li key=${r.id}><${Person} p=${store.byId('profiles', r.student_id)} onOpen=${ctx.openProfile} size=${32}/><span class="spacer"></span><span class="small muted">${timeAgo(r.created_at)}</span></li>`)}</ul>` : null}
    </div>`;
  }
  const isLaureat = me.role === 'laureat';
  const mine = R.filter(r => r.student_id === me.id).sort(recent);
  const mineActive = mine.filter(r => ACTIVES.includes(r.status) || (r.status === 'rendue' && !r.merci && !r.note));
  const minePast = mine.filter(r => !mineActive.includes(r));
  const toMe = R.filter(r => r.reviewer_id === me.id && ACTIVES.includes(r.status)).sort((a, b) => (b.status === 'en_cours') - (a.status === 'en_cours') || new Date(a.created_at) - new Date(b.created_at));
  const queue = isLaureat ? R.filter(r => !r.reviewer_id && r.status === 'demandee' && r.student_id !== me.id)
    .map(r => ({ r, s: store.byId('profiles', r.student_id) }))
    .sort((a, b) => ((b.s?.filiere === me.filiere) - (a.s?.filiere === me.filiere)) || new Date(a.r.created_at) - new Date(b.r.created_at)) : [];
  const done = R.filter(r => r.reviewer_id === me.id && r.status === 'rendue').sort((a, b) => new Date(b.rendue_at || b.created_at) - new Date(a.rendue_at || a.created_at));
  const canAsk = me.cv_path && mine.filter(r => ACTIVES.includes(r.status)).length < 2;
  const hist = isLaureat ? done : minePast;
  const steps = isLaureat
    ? [['inbox', 'Un étudiant demande une relecture'], ['edit', 'Tu commentes rubrique par rubrique'], ['heart', 'Il te remercie : +15 points']]
    : [['upload', 'Tu déposes ton CV en PDF'], ['eye', 'Un lauréat le relit et le commente'], ['check', 'Tu reçois ses conseils, rubrique par rubrique']];

  // Le mode d'emploi en grand pour qui découvre ; replié pour celles et ceux qui ont déjà une relecture (comme les rendez-vous)
  const how = html`<ol class="how">${steps.map(([ic, t], i) => html`<li><span class="how-n">${i + 1}</span><${Icon} name=${ic} size=${18}/><span>${t}</span></li>`)}</ol>`;
  const connu = mine.length || done.length || toMe.length;
  return html`<div class="sub-page relectures">
    ${connu ? null : how}

    ${toMe.length ? html`<div class="section-head"><h2 class="h-ico"><${Icon} name="edit"/> Mes relectures <span class="count">${toMe.length}</span></h2></div>
      <div class="list">${toMe.map(r => html`<${RelectureCard} key=${r.id} ctx=${ctx} r=${r} side="reviewer"/>`)}</div>` : null}

    ${isLaureat ? html`<div class="section-head"><h2 class="h-ico"><${Icon} name="eye"/> CV à relire <span class="count">${queue.length}</span></h2>${queue.length > 1 ? html`<span class="small muted">Ceux de ta filière d’abord</span>` : null}</div>
      <div class="list">${queue.length ? queue.slice(0, more ? 20 : 3).map(({ r }) => html`<${RelectureCard} key=${r.id} ctx=${ctx} r=${r} side="queue"/>`) : html`<${Empty} icon="eye" title="Aucun CV n’attend de relecture">Tu seras prévenu(e) dès qu’un étudiant en demande une.<//>`}</div>
      ${queue.length > 3 ? html`<button class="linkish small past-toggle" onClick=${() => setMore(!more)}>${more ? 'Voir moins' : `Voir les autres demandes (${queue.length - 3})`}</button>` : null}` : null}

    ${!isLaureat || mineActive.length ? html`<div class="section-head"><h2 class="h-ico"><${Icon} name="file"/> Mes demandes${mineActive.length ? html` <span class="count">${mineActive.length}</span>` : null}</h2>
        ${canAsk ? html`<button id="rv-new" class="btn small primary" onClick=${() => setAsk(true)}><${Icon} name="plus" size=${15}/> Demander une relecture</button>` : null}</div>
      ${mineActive.length ? html`<div class="list">${mineActive.map(r => html`<${RelectureCard} key=${r.id} ctx=${ctx} r=${r} side="student"/>`)}</div>`
        : !me.cv_path ? html`<div class="help-cta"><span class="obj-ico"><${Icon} name="upload" size=${22}/></span><div class="grow"><strong>Dépose d’abord ton CV en PDF</strong><span class="small muted">Dans « Mon profil ». Ensuite, un lauréat peut le relire.</span></div><button class="btn primary small" onClick=${() => go('profil')}>Mon profil</button></div>`
        : !minePast.length ? html`<${Empty} icon="eye" title="Pas encore de relecture">Demande une relecture : un lauréat ouvre ton CV et te laisse ses conseils.<//>` : null}` : null}

    ${hist.length ? html`<button class="linkish small past-toggle" onClick=${() => setPast(!past)}>${past ? 'Masquer l’historique' : `Voir l’historique (${hist.length})`}</button>
      ${past ? html`<div class="list">${hist.slice(0, 12).map(r => html`<${RelectureCard} key=${r.id} ctx=${ctx} r=${r} side=${isLaureat ? 'reviewer' : 'student'}/>`)}</div>` : null}` : null}
    ${isLaureat && !mineActive.length && me.cv_path ? html`<p class="small muted center">Toi aussi, tu veux un regard neuf sur ton CV ? <button class="linkish" onClick=${() => setAsk(true)}>Demande à un lauréat plus expérimenté</button></p>` : null}
    ${connu ? html`<details class="m-how"><summary>Comment ça marche ?</summary>${how}</details>` : null}
    ${ask ? html`<${DemandeRelecture} ctx=${ctx} onClose=${() => setAsk(false)}/>` : null}
  </div>`;
}

function Etapes({ r }) {
  const n = r.status === 'rendue' ? 3 : r.status === 'en_cours' ? 2 : 1;
  return html`<ol class="stepper mstep">${ETAPES.map((s, i) => html`<li class=${i < n ? 'done' : ''}><span class="step-dot">${i < n ? html`<${Icon} name="check" size=${13}/>` : i + 1}</span>${s}</li>`)}</ol>`;
}

// Une demande de relecture, vue par l'étudiant (student), le lauréat qui relit (reviewer) ou un lauréat qui parcourt la file (queue)
function RelectureCard({ ctx, r, side }) {
  const { store, act, openProfile, me } = ctx;
  const student = store.byId('profiles', r.student_id); const reviewer = r.reviewer_id ? store.byId('profiles', r.reviewer_id) : null;
  const other = side === 'student' ? reviewer : student;
  const [cls, label] = PILL[r.status === 'demandee' && !r.reviewer_id ? 'ouverte' : r.status] || PILL.demandee;
  const prendre = () => act(async () => { await store.update('relectures_cv', r.id, { reviewer_id: me.id }); toast(`Merci ! Le CV de ${firstName(student)} est dans « Mes relectures ».`); });
  const sub = student?.role === 'etudiant' ? `${NIVEAUX[niveauOf(student, ctx.saison)]?.short || ''} · ${student.filiere}` : student ? `Promo ${student.promo} · ${student.filiere}` : '';
  return html`<article class=${'mreq rel-card st-' + (r.status === 'rendue' ? 'terminee' : r.status === 'en_cours' ? 'rdv' : r.status === 'annulee' ? 'annulee' : 'demande')}>
    <div class="mrow-head">
      ${other ? html`<${Person} p=${other} onOpen=${openProfile} size=${36} sub=${side === 'student' ? undefined : sub}/>` : html`<span class="open-to"><span class="open-ico"><${Icon} name="people" size=${18}/></span><span><strong>Tous les lauréats</strong><span class="small muted">Le premier disponible relit ton CV</span></span></span>`}
      <span class="spacer"></span><span class=${'state-pill ' + cls}>${label}</span>${other && side !== 'queue' ? html`<${MessageBtn} ctx=${ctx} p=${other} cls="btn tiny ghost"/>` : null}</div>
    ${r.message ? html`<p class="quote" dir="auto" translate="no">${r.message}</p>` : null}
    <p class="small muted">${r.status === 'rendue' && r.rendue_at ? `Demandée ${timeAgo(r.created_at)} · rendue ${timeAgo(r.rendue_at)}` : `Demandée ${timeAgo(r.created_at)}`}</p>
    ${side !== 'queue' && r.status !== 'annulee' ? html`<${Etapes} r=${r}/>` : null}

    ${side === 'queue' ? html`<div class="row"><${OuvrirCV} store=${store} path=${r.cv_path}/><span class="spacer"></span><button class="btn small primary" onClick=${prendre}><${Icon} name="check" size=${15}/> Je m’en occupe</button></div>` : null}

    ${side === 'reviewer' && r.status === 'demandee' ? html`<p class="small">${`${firstName(student)} t’a choisi(e) pour relire son CV.`}</p>
      <div class="row"><${OuvrirCV} store=${store} path=${r.cv_path}/><span class="spacer"></span>
        <button class="linkish small" onClick=${() => ctx.confirm('Tu n’es pas disponible ? La demande sera proposée aux autres lauréats.', () => act(async () => { await store.update('relectures_cv', r.id, { reviewer_id: null }); toast('Demande proposée aux autres lauréats.'); }), 'Proposer aux autres')}>Pas disponible</button>
        <button class="btn small primary" onClick=${prendre}><${Icon} name="check" size=${15}/> Je m’en occupe</button></div>` : null}
    ${side === 'reviewer' && r.status === 'en_cours' ? html`<${Atelier} ctx=${ctx} r=${r} student=${student}/>` : null}
    ${r.status === 'rendue' && side !== 'queue' ? html`<${Retour} ctx=${ctx} r=${r} side=${side}/>` : null}

    ${side === 'student' && ACTIVES.includes(r.status) ? html`<div class="row"><span class="small muted">${r.status === 'en_cours' ? `${firstName(reviewer) || 'Un lauréat'} relit ton CV. Tu seras prévenu(e).` : reviewer ? `En attente de ${firstName(reviewer)}…` : 'En attente d’un lauréat…'}</span><span class="spacer"></span>
      <button class="linkish small m-quiet" onClick=${() => ctx.confirm('Annuler cette demande de relecture ?', () => act(() => store.update('relectures_cv', r.id, { status: 'annulee' })), 'Annuler la demande')}>Annuler</button></div>` : null}
    ${side === 'student' && r.status === 'annulee' ? html`<div class="row"><span class="spacer"></span><button class="linkish small" onClick=${() => act(() => store.remove('relectures_cv', r.id))}>Supprimer</button></div>` : null}
  </article>`;
}

// Atelier du lauréat : ouvrir le CV, commenter par rubrique, rédiger la synthèse, rendre
function Atelier({ ctx, r, student }) {
  const { data, store, act, me } = ctx;
  const [rub, setRub] = useState('general'); const [txt, setTxt] = useState('');
  const [syn, setSyn] = useState(r.synthese || ''); const [busy, setBusy] = useState(false);
  const coms = data.relecture_commentaires.filter(c => c.relecture_id === r.id);
  const ajouter = e => {
    e.preventDefault(); if (!txt.trim()) return;
    setBusy(true);
    act(async () => { await store.insert('relecture_commentaires', { relecture_id: r.id, author_id: me.id, section: rub, body: txt.trim() }); setTxt(''); }).finally(() => setBusy(false));
  };
  const peutRendre = syn.trim() || coms.some(c => c.author_id === me.id);
  const rendre = () => act(async () => { await store.update('relectures_cv', r.id, { status: 'rendue', synthese: syn.trim() || null, reviewer_id: me.id }); toast(`Relecture rendue à ${firstName(student)}. +15 points`, 'win'); });
  return html`<div class="atelier">
    <div class="row wrap"><${OuvrirCV} store=${store} path=${r.cv_path} label="Ouvrir le CV" cls="btn small"/><span class="small muted">Le CV s’ouvre dans un nouvel onglet : garde cette page à côté.</span></div>
    <${Commentaires} ctx=${ctx} r=${r} coms=${coms}/>
    <form class="rel-add" onSubmit=${ajouter}>
      <div class="rub-chips" role="group" aria-label="Rubrique">${RUBRIQUES.map(([k, l, ic]) => html`<button type="button" class=${'chip' + (rub === k ? ' on' : '')} aria-pressed=${rub === k} onClick=${() => setRub(k)}><${Icon} name=${ic} size=${13}/> ${l}</button>`)}</div>
      <div class="rel-add-row"><textarea id=${'rv-com-' + r.id} rows="2" maxlength="1500" value=${txt} onInput=${e => setTxt(e.target.value)} placeholder="Un conseil précis, ex. « Mets le résultat chiffré de ton projet Lean en premier »"></textarea>
        <button class="btn small" disabled=${busy || !txt.trim()}><${Icon} name="plus" size=${15}/> Ajouter</button></div>
    </form>
    <${Field} label="Synthèse" hint="Ce qu’il faut retenir en trois lignes : points forts, priorités."><textarea id=${'rv-syn-' + r.id} rows="3" maxlength="2000" value=${syn} onInput=${e => setSyn(e.target.value)}
      onBlur=${() => { if ((syn.trim() || null) !== (r.synthese || null)) act(() => store.update('relectures_cv', r.id, { synthese: syn.trim() || null, reviewer_id: me.id })); }}></textarea><//>
    <div class="row"><button type="button" class="linkish small" onClick=${() => ctx.confirm('Rendre la main ? La demande sera proposée aux autres lauréats.', () => act(() => store.update('relectures_cv', r.id, { reviewer_id: null })), 'Rendre la main')}>Je ne peux plus</button><span class="spacer"></span>
      <button id=${'rv-rendre-' + r.id} class="btn primary small" disabled=${!peutRendre} title=${peutRendre ? '' : 'Ajoute au moins un commentaire ou une synthèse'} onClick=${rendre}><${Icon} name="send" size=${15}/> Rendre la relecture</button></div>
  </div>`;
}

// Commentaires groupés par rubrique ; l'étudiant et le lauréat peuvent aussi échanger dans « Général »
function Commentaires({ ctx, r, coms }) {
  const { store, act, me } = ctx;
  if (!coms.length) return r.status === 'rendue' ? null : html`<p class="small muted">Pas encore de commentaire.</p>`;
  const par = RUBRIQUES.map(([k, l, ic]) => [k, l, ic, coms.filter(c => c.section === k).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))]).filter(x => x[3].length);
  return html`<div class="rel-coms">${par.map(([k, l, ic, list]) => html`<section class="rel-rub" key=${k}>
    <h3 class="h-ico"><${Icon} name=${ic} size=${15}/> ${l}</h3>
    <ul>${list.map(c => html`<li key=${c.id} class=${c.author_id === r.student_id ? 'from-student' : ''}>
      ${c.author_id === r.student_id ? html`<span class="mini" translate="no">${firstName(store.byId('profiles', c.author_id))}</span>` : null}<span dir="auto" translate="no">${c.body}</span>
      ${c.author_id === me.id ? html`<button class="icon-btn small" aria-label="Supprimer" onClick=${() => act(() => store.remove('relecture_commentaires', c.id))}><${Icon} name="x" size=${13}/></button>` : null}</li>`)}</ul>
  </section>`)}</div>`;
}

// Relecture rendue : la synthèse, les commentaires, puis le merci de l'étudiant (note et mot)
function Retour({ ctx, r, side }) {
  const { data, store, act, me } = ctx;
  const coms = data.relecture_commentaires.filter(c => c.relecture_id === r.id);
  const reviewer = store.byId('profiles', r.reviewer_id); const student = store.byId('profiles', r.student_id);
  const [note, setNote] = useState(5); const [merci, setMerci] = useState(''); const [q, setQ] = useState('');
  return html`<div class="rel-retour">
    ${r.synthese ? html`<div class="rel-syn"><p class="eyebrow"><${Icon} name="spark" size=${13}/> ${side === 'student' && reviewer ? `Synthèse de ${firstName(reviewer)}` : 'Synthèse'}</p><p dir="auto" translate="no">${r.synthese}</p></div>` : null}
    <${Commentaires} ctx=${ctx} r=${r} coms=${coms}/>
    ${side === 'student' && !r.merci && !r.note ? html`<form class="merci-box" onSubmit=${e => { e.preventDefault(); act(async () => { await store.update('relectures_cv', r.id, { note, merci: merci.trim() || null }); toast(merci.trim() ? `Merci envoyé à ${firstName(reviewer)} !` : 'C’est noté, merci !', 'win'); }); }}>
      <p><${Icon} name="heart" size=${16}/> <strong>Cette relecture t’a aidé(e) ?</strong></p>
      <span class="stars" role="group" aria-label="Aide reçue">${[1, 2, 3, 4, 5].map(v => html`<button type="button" class=${v <= note ? 'on' : ''} aria-label=${v + ' sur 5'} onClick=${() => setNote(v)}>★</button>`)}</span>
      <textarea id=${'rv-merci-' + r.id} rows="2" maxlength="800" placeholder="Un mot de remerciement…" value=${merci} onInput=${e => setMerci(e.target.value)}></textarea>
      <div class="row-end"><button class="btn primary small">${merci.trim() ? 'Envoyer mon merci' : 'Envoyer ma note'}</button></div>
    </form>` : null}
    ${r.merci || r.note ? html`<p class="small merci-inline">${r.note ? html`<span class="stars-ro" aria-label=${r.note + ' sur 5'}>${'★'.repeat(r.note)}</span>` : null}${r.merci ? html`<${Icon} name="heart" size=${14}/> <span dir="auto" translate="no">${r.merci}</span>` : null}</p>` : null}
    <form class="rel-add-row" onSubmit=${e => { e.preventDefault(); if (!q.trim()) return; act(async () => { await store.insert('relecture_commentaires', { relecture_id: r.id, author_id: me.id, section: 'general', body: q.trim() }); setQ(''); }); }}>
      <input id=${'rv-q-' + r.id} maxlength="1500" value=${q} onInput=${e => setQ(e.target.value)} placeholder=${side === 'student' ? `Une question pour ${firstName(reviewer) || 'le lauréat'} ?` : `Un dernier mot pour ${firstName(student)} ?`}/>
      <button class="btn small" disabled=${!q.trim()}>Envoyer</button></form>
  </div>`;
}

// ---------------------------------------------------------------------------
// Accueil : une seule ligne, seulement quand il y a quelque chose à suivre
// (les demandes qui me sont adressées et les relectures rendues sont déjà dans « À faire aujourd'hui »)
// ---------------------------------------------------------------------------
export function RelecturesHome({ ctx }) {
  const { data, me, store, go } = ctx;
  const R = data.relectures_cv || [];
  let ico = 'eye', titre = null, sous = '', cta = '';
  if (me.role === 'laureat') {
    const enCours = R.find(r => r.reviewer_id === me.id && r.status === 'en_cours');
    const file = R.filter(r => !r.reviewer_id && r.status === 'demandee' && r.student_id !== me.id);
    if (enCours) { ico = 'edit'; titre = `Tu relis le CV de ${firstName(store.byId('profiles', enCours.student_id))}`; sous = 'Quelques commentaires et une synthèse, puis tu la rends.'; cta = 'Continuer'; }
    else if (file.length) { titre = file.length > 1 ? `${file.length} CV attendent une relecture` : '1 CV attend une relecture'; sous = 'Dix minutes suffisent : tes conseils, rubrique par rubrique.'; cta = 'Relire un CV'; }
  } else if (me.role === 'etudiant') {
    const r = R.find(x => x.student_id === me.id && x.status === 'en_cours');
    if (r) { titre = `${firstName(store.byId('profiles', r.reviewer_id)) || 'Un lauréat'} relit ton CV`; sous = 'Tu seras prévenu(e) dès que ses conseils sont prêts.'; cta = 'Suivre'; }
  }
  if (!titre) return null;
  return html`<div class="help-cta rel-home"><span class="obj-ico"><${Icon} name=${ico} size=${22}/></span>
    <div class="grow"><strong>${titre}</strong><span class="small muted">${sous}</span></div>
    <button class="btn small" onClick=${() => go('mentorat/cv')}>${cta}</button></div>`;
}

injectCSS('cv', `
.cv-card { display: flex; flex-direction: column; gap: .75rem; }
.cv-card .section-head { margin: 0; }
.cv-file, .cv-relu { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
.cv-file .grow, .cv-relu .grow { display: flex; flex-direction: column; min-width: 10rem; flex: 1; }
.cv-ico { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); flex: none; }
.cv-acts { display: flex; gap: .4rem; align-items: center; flex-wrap: wrap; }
.cv-drop { display: flex; flex-direction: column; align-items: center; gap: .35rem; padding: 1.3rem 1rem; border: 2px dashed var(--line); border-radius: 14px; background: var(--surface-2); color: var(--ink); cursor: pointer; text-align: center; font: inherit; width: 100%; transition: border-color .2s, background .2s; }
.cv-drop:hover, .cv-drop.over { border-color: var(--accent); background: var(--accent-soft); }
.cv-drop .cv-ico { background: var(--surface); }
.cv-vis { display: flex; gap: .35rem; align-items: center; flex-wrap: wrap; margin: 0; }
.cv-vis svg { flex: none; }
.cv-relu { padding-top: .75rem; border-top: 1px solid var(--line); }
.atelier, .rel-retour { display: flex; flex-direction: column; gap: .7rem; padding-top: .7rem; border-top: 1px dashed var(--line); }
.atelier .row.wrap { flex-wrap: wrap; }
.rel-coms { display: grid; gap: .55rem; }
.rel-rub h3 { font-size: .9rem; margin: 0 0 .3rem; color: var(--ink-2); }
.rel-rub ul { list-style: none; margin: 0; padding: 0; display: grid; gap: .3rem; }
.rel-rub li { display: flex; gap: .45rem; align-items: flex-start; padding: .45rem .65rem; border-radius: 10px; background: var(--surface-2); font-size: .92rem; }
.rel-rub li > span[dir] { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.rel-rub li .mini { margin: 0; flex: none; }
.rel-rub li.from-student { background: var(--accent-soft); }
.rel-rub li .icon-btn { margin-inline-start: auto; flex: none; }
.rub-chips { display: flex; flex-wrap: wrap; gap: .3rem; }
.rel-add { display: flex; flex-direction: column; gap: .5rem; }
.rel-add-row { display: flex; gap: .5rem; align-items: flex-end; }
.rel-add-row textarea, .rel-add-row input { flex: 1; min-width: 0; }
.rel-syn { padding: .7rem .9rem; border-radius: 12px; background: var(--brass-soft); }
.rel-syn p { margin: 0; }
.rel-syn .eyebrow { color: var(--brass); margin-bottom: .25rem; display: flex; gap: .3rem; align-items: center; }
.mentor-seg button { display: inline-flex; align-items: center; gap: .35rem; }
.apply-cv { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; margin: 0; }
@media (max-width: 640px) {
  .rel-add-row { flex-direction: column; align-items: stretch; }
  .cv-acts { width: 100%; }
}
`);

addAR({
  'Mon CV': 'سيرتي الذاتية', 'CV en PDF': 'السيرة الذاتية بصيغة PDF', 'Joint à chaque candidature': 'تُرفق بكل ترشيح', 'Voir': 'عرض', 'Remplacer': 'استبدال',
  'Retirer mon CV': 'سحب سيرتي الذاتية', 'Retirer': 'سحب', 'CV retiré.': 'تم سحب السيرة الذاتية.', 'CV déposé.': 'تم رفع السيرة الذاتية.', 'CV remplacé.': 'تم استبدال السيرة الذاتية.',
  'Retirer ton CV ? Les lauréats ne le verront plus avec tes candidatures.': 'سحب سيرتك الذاتية؟ لن يراها الخريجون مع ترشيحاتك بعد الآن.',
  'Dépose ton CV en PDF ici': 'ضع سيرتك الذاتية بصيغة PDF هنا', 'Envoi en cours…': 'جارٍ الإرسال…', 'ou clique pour choisir un fichier · PDF, 2 Mo maximum': 'أو انقر لاختيار ملف · PDF، 2 ميغا كحد أقصى',
  'Tu as déjà un lien vers ton CV dans ton profil. Le PDF est plus simple pour les lauréats.': 'لديك رابط لسيرتك الذاتية في ملفك. ملف PDF أبسط للخريجين.',
  'Le fichier dépasse 2 Mo. Exporte ton CV en PDF plus léger.': 'الملف يتجاوز 2 ميغا. صدّر سيرتك الذاتية بصيغة PDF أخف.',
  'Visible par tous les membres connectés.': 'مرئية لكل الأعضاء المسجلين.',
  'Visible par les lauréats, et par le lauréat dont tu postules à l’offre.': 'مرئية للخريجين، وللخريج الذي تترشح لعرضه.',
  'Visible seulement par tes contacts acceptés et par le lauréat dont tu postules à l’offre.': 'مرئية فقط لجهات اتصالك المقبولة وللخريج الذي تترشح لعرضه.',
  'Choisis qui le voit plus bas.': 'اختر من يراها في الأسفل.',
  'Fais relire ton CV par un lauréat': 'اطلب من خريج مراجعة سيرتك الذاتية', 'Il commente rubrique par rubrique et te donne ses conseils.': 'يعلّق قسمًا بقسم ويقدّم لك نصائحه.',
  'Ta relecture est prête': 'مراجعتك جاهزة', 'Ta dernière relecture est rendue': 'آخر مراجعة لك جاهزة', 'Ton CV est en cours de relecture': 'سيرتك الذاتية قيد المراجعة',
  'Tu seras prévenu(e) dès que c’est fini.': 'ستُخبَر بمجرد الانتهاء.', 'Demande de relecture envoyée': 'تم إرسال طلب المراجعة', 'En attente d’un lauréat disponible': 'في انتظار خريج متاح',
  'Lire les conseils': 'قراءة النصائح', 'Suivre': 'متابعة', 'Nouvelle relecture': 'مراجعة جديدة', 'Demander une relecture': 'طلب مراجعة',
  'Un lauréat ouvre ton CV, laisse des commentaires rubrique par rubrique et une synthèse. Tu es prévenu(e) quand c’est prêt.': 'يفتح خريج سيرتك الذاتية ويترك تعليقات قسمًا بقسم وخلاصة. ستُخبَر عندما تكون جاهزة.',
  'Ce que tu vises (facultatif)': 'ما تطمح إليه (اختياري)', 'Ex. PFE en excellence opérationnelle, stage 4A dans l’automobile…': 'مثال: مشروع نهاية الدراسة في التميز العملياتي، تدريب السنة الرابعة في صناعة السيارات…',
  'Le poste visé, ce qui t’inquiète dans ton CV…': 'المنصب المستهدف، ما يقلقك في سيرتك الذاتية…', 'Qui relit ?': 'من يراجع؟', 'Tous les lauréats (le premier disponible)': 'كل الخريجين (أول خريج متاح)',
  'Demande envoyée aux lauréats.': 'تم إرسال الطلب إلى الخريجين.', 'Envoyer ma demande': 'أرسل طلبي',
  'Demandes en attente': 'طلبات في الانتظار', 'pas encore prises': 'لم يتكفل بها أحد بعد', 'En cours': 'قيد الإنجاز', 'un lauréat relit': 'خريج يراجع', 'Relectures rendues': 'مراجعات منجزة',
  'depuis le début': 'منذ البداية', 'Note moyenne': 'متوسط التقييم', 'donnée par les étudiants': 'من الطلبة', 'pas encore de note': 'لا تقييم بعد',
  'En attente depuis plus d’une semaine': 'في الانتظار منذ أكثر من أسبوع',
  'Un étudiant demande une relecture': 'طالب يطلب مراجعة', 'Tu commentes rubrique par rubrique': 'تعلّق قسمًا بقسم', 'Il te remercie : +15 points': 'يشكرك: +15 نقطة',
  'Tu déposes ton CV en PDF': 'ترفع سيرتك الذاتية بصيغة PDF', 'Un lauréat le relit et le commente': 'يراجعها خريج ويعلّق عليها', 'Tu reçois ses conseils, rubrique par rubrique': 'تتلقى نصائحه قسمًا بقسم',
  'Mes relectures': 'مراجعاتي', 'CV à relire': 'سير ذاتية للمراجعة', 'Ceux de ta filière d’abord': 'سير شعبتك أولًا', 'Aucun CV n’attend de relecture': 'لا توجد سيرة ذاتية تنتظر المراجعة',
  'Tu seras prévenu(e) dès qu’un étudiant en demande une.': 'ستُخبَر بمجرد أن يطلب طالب مراجعة.', 'Mes demandes': 'طلباتي',
  'Dépose d’abord ton CV en PDF': 'ارفع أولًا سيرتك الذاتية بصيغة PDF', 'Dans « Mon profil ». Ensuite, un lauréat peut le relire.': 'في «ملفي». بعد ذلك يمكن لخريج مراجعتها.', 'Mon profil': 'ملفي',
  'Pas encore de relecture': 'لا مراجعة بعد', 'Demande une relecture : un lauréat ouvre ton CV et te laisse ses conseils.': 'اطلب مراجعة: يفتح خريج سيرتك الذاتية ويترك لك نصائحه.',
  'Toi aussi, tu veux un regard neuf sur ton CV ?': 'أنت أيضًا تريد نظرة جديدة على سيرتك الذاتية؟', 'Demande à un lauréat plus expérimenté': 'اطلب من خريج أكثر خبرة',
  'Demandée': 'مطلوبة', 'Rendue': 'منجزة', 'Ouverte à tous les lauréats': 'مفتوحة لكل الخريجين', 'En cours de relecture': 'قيد المراجعة', 'Relecture rendue': 'المراجعة منجزة', 'Annulée': 'ملغاة',
  'Tous les lauréats': 'كل الخريجين', 'Le premier disponible relit ton CV': 'أول خريج متاح يراجع سيرتك الذاتية', 'Je m’en occupe': 'سأتكفل بها',
  'Pas disponible': 'غير متاح', 'Proposer aux autres': 'اقتراحها على الآخرين', 'Tu n’es pas disponible ? La demande sera proposée aux autres lauréats.': 'لست متاحًا؟ سيُقترح الطلب على باقي الخريجين.',
  'Demande proposée aux autres lauréats.': 'تم اقتراح الطلب على باقي الخريجين.', 'En attente d’un lauréat…': 'في انتظار خريج…', 'Annuler la demande': 'إلغاء الطلب',
  'Annuler cette demande de relecture ?': 'إلغاء طلب المراجعة هذا؟', 'Supprimer': 'حذف', 'Ouvrir le CV': 'فتح السيرة الذاتية', 'Voir le CV': 'عرض السيرة الذاتية',
  'Le CV s’ouvre dans un nouvel onglet : garde cette page à côté.': 'تُفتح السيرة الذاتية في علامة تبويب جديدة: أبقِ هذه الصفحة بجانبها.',
  'Rubrique': 'القسم', 'Général': 'عام', 'Profil et accroche': 'الملف والتقديم', 'Formation': 'التكوين', 'Expériences': 'الخبرات', 'Projets': 'المشاريع', 'Compétences': 'المهارات', 'Langues': 'اللغات', 'Mise en page': 'التنسيق',
  'Un conseil précis, ex. « Mets le résultat chiffré de ton projet Lean en premier »': 'نصيحة دقيقة، مثال: «ضع النتيجة الرقمية لمشروع Lean أولًا»', 'Ajouter': 'إضافة',
  'Synthèse': 'الخلاصة', 'Ce qu’il faut retenir en trois lignes : points forts, priorités.': 'ما يجب تذكره في ثلاثة أسطر: نقاط القوة والأولويات.',
  'Je ne peux plus': 'لم أعد أستطيع', 'Rendre la main ? La demande sera proposée aux autres lauréats.': 'التخلي عن المراجعة؟ سيُقترح الطلب على باقي الخريجين.', 'Rendre la main': 'التخلي عنها',
  'Ajoute au moins un commentaire ou une synthèse': 'أضف تعليقًا واحدًا على الأقل أو خلاصة', 'Rendre la relecture': 'تسليم المراجعة', 'Pas encore de commentaire.': 'لا تعليق بعد.',
  'Cette relecture t’a aidé(e) ?': 'هل ساعدتك هذه المراجعة؟', 'Aide reçue': 'المساعدة المتلقاة', 'Un mot de remerciement…': 'كلمة شكر…', 'Envoyer mon merci': 'أرسل شكري', 'Envoyer ma note': 'أرسل تقييمي',
  'C’est noté, merci !': 'تم التسجيل، شكرًا!', 'Envoyer': 'إرسال', 'Continuer': 'متابعة', 'Relire un CV': 'مراجعة سيرة ذاتية', '1 CV attend une relecture': 'سيرة ذاتية واحدة تنتظر المراجعة',
  'Quelques commentaires et une synthèse, puis tu la rends.': 'بعض التعليقات وخلاصة، ثم تسلّمها.', 'Dix minutes suffisent : tes conseils, rubrique par rubrique.': 'عشر دقائق تكفي: نصائحك، قسمًا بقسم.',
  'Tu seras prévenu(e) dès que ses conseils sont prêts.': 'ستُخبَر بمجرد أن تصبح نصائحه جاهزة.', 'Rendez-vous': 'المواعيد', 'Relecture de CV': 'مراجعة السيرة الذاتية',
  'Un lauréat relit ton CV et te conseille': 'خريج يراجع سيرتك الذاتية وينصحك', 'Relire le CV d’un étudiant, rubrique par rubrique': 'مراجعة سيرة طالب، قسمًا بقسم',
  'Le suivi des relectures de CV': 'متابعة مراجعات السير الذاتية',
  'Ton CV PDF sera visible par l’auteur de l’offre.': 'ستكون سيرتك الذاتية (PDF) مرئية لصاحب العرض.', 'Ajouter mon CV': 'إضافة سيرتي الذاتية',
  'Ajoute ton CV en PDF dans ton profil : le lauréat le verra avec ta candidature.': 'أضف سيرتك الذاتية بصيغة PDF في ملفك: سيراها الخريج مع ترشيحك.',
  'Le lien vers ton CV sera joint.': 'سيُرفق رابط سيرتك الذاتية.', 'Ton CV sera joint.': 'ستُرفق سيرتك الذاتية.',
  'Le lauréat verra ton profil et ton CV.': 'سيطّلع الخريج على ملفك وسيرتك الذاتية.', 'Le lauréat verra ton profil.': 'سيطّلع الخريج على ملفك.',
}, [
  [/^Mis à jour (il y a \d+ (?:min|h|j)|à l’instant|\d{1,2} \S+ \d{4})$/, (x) => `محيَّنة ${tr(x)}`],
  [/^(\d+) CV attendent une relecture$/, (n) => `${n} سير ذاتية تنتظر المراجعة`],
  [/^Tu relis le CV de (.+)$/, (x) => `تراجع سيرة ${x} الذاتية`],
  [/^(.+) relit ton CV\. Tu seras prévenu\(e\)\.$/, (x) => `${x} يراجع سيرتك الذاتية. ستُخبَر.`],
  [/^(.+) relit ton CV$/, (x) => `${x} يراجع سيرتك الذاتية`],
  [/^Par (.+) · (.+)$/, (x, t) => `بواسطة ${x} · ${tr(t)}`],
  [/^En attente de (.+) · (.+)$/, (x, t) => `في انتظار ${x} · ${tr(t)}`],
  [/^En attente de (.+)…$/, (x) => `في انتظار ${x}…`],
  [/^Demande envoyée à (.+)\.$/, (x) => `تم إرسال الطلب إلى ${x}.`],
  [/^Merci ! Le CV de (.+) est dans « Mes relectures »\.$/, (x) => `شكرًا! سيرة ${x} الذاتية في «مراجعاتي».`],
  [/^(.+) t’a choisi\(e\) pour relire son CV\.$/, (x) => `اختارك ${x} لمراجعة سيرته الذاتية.`],
  [/^Demandée (.+) · rendue (.+)$/, (a, b) => `طُلبت ${tr(a)} · سُلّمت ${tr(b)}`],
  [/^Demandée (il y a .+|à l’instant|\d.+)$/, (a) => `طُلبت ${tr(a)}`],
  [/^Relecture rendue à (.+)\. \+15 points$/, (x) => `تم تسليم المراجعة إلى ${x}. +15 نقطة`],
  [/^Synthèse de (.+)$/, (x) => `خلاصة ${x}`],
  [/^Une question pour (.+) \?$/, (x) => `سؤال لـ ${x}؟`],
  [/^Un dernier mot pour (.+) \?$/, (x) => `كلمة أخيرة لـ ${x}؟`],
  [/^Merci envoyé à (.+) !$/, (x) => `تم إرسال شكرك إلى ${x}!`],
  [/^Voir les autres demandes \((\d+)\)$/, (n) => `عرض الطلبات الأخرى (${n})`],
  [/^Voir l’historique \((\d+)\)$/, (n) => `عرض السجل (${n})`],
  [/^(\d) sur 5$/, (n) => `${n} من 5`],
  [/^Ton CV PDF sera visible par (.+), l’auteur de l’offre\.$/, (x) => `ستكون سيرتك الذاتية (PDF) مرئية لـ ${x}، صاحب العرض.`],
]);
