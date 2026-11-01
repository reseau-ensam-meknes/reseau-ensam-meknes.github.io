// Console d'administration · Contenus : ce que les membres publient, par sorte (offres, demandes, questions, mentorats,
// événements), le plus récent d'abord. Les statuts en puces, une recherche, et les gestes que la base permet à l'administration :
// ouvrir, masquer ou rouvrir une offre, retirer une demande, annuler, supprimer. Sur ordinateur un tableau, sur téléphone une carte par contenu.
// (Une demande retirée ne se rouvre pas d'ici : seul son auteur la rouvre, et la base vérifie alors sa limite de demandes en cours.)
// (Relire et masquer une offre sans attendre un signalement est de la modération : les « Dernières offres » sont ici.)
import { html, useState } from './vendor/preact-htm.js';
import { Icon, toast, injectCSS } from './ui.js';
import { useVoirPlus, VoirPlus } from './lignes.js';
import { addAR } from './i18n.js';
import { TYPES, TYPES_EVENEMENT, BESOINS, timeAgo, norm, demandeEnPause } from './logic.js';
import { passe } from './agenda.js';
import { useLarge } from './admin-console.js';

addAR({
  'Sortes de contenus': 'أنواع المحتويات', 'Questions': 'الأسئلة', 'Filtrer par statut': 'تصفية حسب الحالة', 'Actions': 'الإجراءات',
  'Titre, entreprise, auteur…': 'العنوان، الشركة، الكاتب…', 'Titre, auteur…': 'العنوان، الكاتب…', 'Chercher dans ces contenus': 'البحث في هذه المحتويات',
  'Sans réponse': 'بلا جواب', 'Répondue': 'مُجاب عنها', 'Refusée': 'مرفوضة', 'Ouvert à tous': 'مفتوح للجميع',
  'Candidatures': 'الترشيحات', 'Aides proposées': 'المساعدات المقترحة', 'Date': 'التاريخ', 'Réponses': 'الأجوبة',
  'Rien ici pour l’instant.': 'لا شيء هنا حاليًا.', 'Aucun contenu ne correspond à cette recherche.': 'لا محتوى يطابق هذا البحث.',
  'Offre masquée.': 'أُخفي العرض.', 'Offre rouverte.': 'أُعيد فتح العرض.', 'Offre supprimée.': 'حُذف العرض.',
  'Demande supprimée.': 'تم حذف الطلب.',
  'Supprimer cette demande ? Les aides proposées partent avec elle.': 'حذف هذا الطلب؟ ستُحذف معه المساعدات المقترحة.',
  'Supprimer cette question ? Ses réponses partent avec elle.': 'حذف هذا السؤال؟ ستُحذف أجوبته معه.', 'Question supprimée.': 'حُذف السؤال.',
  'Annuler ce mentorat ? L’étudiant et le lauréat le verront annulé.': 'إلغاء هذا الإرشاد؟ سيراه الطالب والخريج ملغى.', 'Mentorat annulé.': 'أُلغي الإرشاد.', 'Annuler le mentorat': 'إلغاء الإرشاد',
  'Supprimer ce mentorat ? Il disparaît pour l’étudiant et le lauréat.': 'حذف هذا الإرشاد؟ سيختفي لدى الطالب والخريج.', 'Mentorat supprimé.': 'حُذف الإرشاد.',
}, [
  [/^Retirer la demande « (.+) » \? Elle ne sera plus proposée aux lauréats, et le match en cours s’arrête\.$/, t => `سحب الطلب «${t}»؟ لن يُقترح على الخريجين بعد الآن، وسيتوقف التوافق الجاري.`],
]);

export const ONGLETS_CONTENUS = [['offres', 'Offres', 'feed'], ['demandes', 'Demandes', 'send'], ['questions', 'Questions', 'qa'], ['mentorats', 'Mentorats', 'mentor'], ['evenements', 'Événements', 'calendar']];
const ms = d => (d ? new Date(d).getTime() || 0 : 0);
const dateCourte = d => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const compter = (lignes, k) => { const m = new Map(); for (const r of lignes || []) m.set(r[k], (m.get(r[k]) || 0) + 1); return m; };

// Les statuts de chaque sorte : [clé, libellé, couleur de l'étiquette]
const STATUTS = {
  offres: [['ouverte', 'Ouverte', 'coopt'], ['fermee', 'Fermée', 'done'], ['pourvue', 'Pourvue', 'done']],
  demandes: [['ouverte', 'Ouverte', 'coopt'], ['pause', 'En pause', 'done'], ['match', 'Match', 'entre'], ['pourvue', 'Réussie', 'coopt'], ['fermee', 'Fermée', 'done']],
  questions: [['sans', 'Sans réponse', 'urgent'], ['repondue', 'Répondue', 'entre'], ['resolue', 'Résolue', 'coopt']],
  mentorats: [['demande', 'En attente', 'urgent'], ['acceptee', 'Acceptée', 'entre'], ['terminee', 'Terminée', 'coopt'], ['refusee', 'Refusée', 'done'], ['annulee', 'Annulée', 'done']],
  evenements: [['avenir', 'À venir', 'entre'], ['passe', 'Terminé', 'done'], ['annule', 'Annulé', 'done']],
};
const statutQuestion = (q, rep) => (q.best_answer_id ? 'resolue' : rep.get(q.id) ? 'repondue' : 'sans');
const statutEvenement = e => (e.annule ? 'annule' : passe(e) ? 'passe' : 'avenir');

// Le nombre de chaque sorte, pour les onglets
export function nombresContenus(data) {
  return { offres: (data.offers || []).length, demandes: (data.demandes || []).length, questions: (data.questions || []).length, mentorats: (data.mentorships || []).length, evenements: (data.evenements || []).length };
}

// Les lignes d'une sorte : { id, statut, at, cherche, titre, ouvrir, sous, cellules, gestes }, la plus récente d'abord
function lignesDe(sorte, ctx) {
  const { data, store, act, confirm, openOffer, openProfile, go } = ctx;
  const p = id => (id ? store.byId('profiles', id) : null);
  const qui = id => { const x = p(id); return x ? html`<button type="button" class="linkish" translate="no" dir="auto" onClick=${() => openProfile(x)}>${x.full_name}</button>` : html`<span class="muted">Un membre</span>`; };
  const nomTexte = id => p(id)?.full_name || '';
  const suppr = (question, table, id, message) => html`<button type="button" class="icon-btn small danger-t cnt-suppr" aria-label="Supprimer" title="Supprimer"
    onClick=${() => confirm(question, () => act(async () => { await store.remove(table, id); toast(message); }), 'Supprimer')}><${Icon} name="trash" size=${16}/></button>`;
  const geste = (label, faire, message) => html`<button type="button" class="btn small tonal" onClick=${() => act(async () => { await faire(); toast(message); })}>${label}</button>`;
  switch (sorte) {
    case 'offres': {
      const cand = compter(data.applications, 'offer_id');
      return (data.offers || []).map(o => ({
        id: o.id, statut: o.status, at: ms(o.created_at), cherche: [o.titre, o.entreprise, o.ville, nomTexte(o.author_id)],
        titre: o.titre, ouvrir: () => openOffer(o.id), sous: html`<span translate="no" dir="auto">${[o.entreprise, o.ville].filter(Boolean).join(' · ')}</span>`,
        cellules: [['type', TYPES[o.type]?.label || ''], ['auteur', qui(o.author_id)], ['date', timeAgo(o.created_at)], ['n', cand.get(o.id) || 0, true]],
        gestes: html`${o.status === 'ouverte' ? geste('Masquer', () => store.update('offers', o.id, { status: 'fermee' }), 'Offre masquée.') : geste('Rouvrir', () => store.update('offers', o.id, { status: 'ouverte' }), 'Offre rouverte.')}
          ${suppr('Supprimer cette offre ?', 'offers', o.id, 'Offre supprimée.')}`,
      }));
    }
    case 'demandes': {
      const aides = compter(data.propositions, 'demande_id');
      // Retirer arrête aussi un match en cours (la base clôt l'aide acceptée et prévient le lauréat) : on demande d'abord
      const retirer = d => confirm(d.status === 'match' ? `Retirer la demande « ${d.titre} » ? Elle ne sera plus proposée aux lauréats, et le match en cours s’arrête.`
        : `Retirer la demande « ${d.titre} » ? Elle ne sera plus proposée aux lauréats.`, () => act(async () => { await store.update('demandes', d.id, { status: 'fermee' }); toast('Demande retirée.'); }), 'Retirer la demande');
      return (data.demandes || []).map(d => ({
        // « En pause » n'est pas un statut de la base : une demande ouverte sans relance depuis 60 jours (demandeEnPause)
        id: d.id, statut: demandeEnPause(d) ? 'pause' : d.status, at: ms(d.created_at), cherche: [d.titre, nomTexte(d.auteur_id)],
        titre: d.titre, ouvrir: () => go('offres/demandes/' + d.id), sous: TYPES[d.type]?.label || '',
        cellules: [['auteur', qui(d.auteur_id)], ['date', timeAgo(d.created_at)], ['n', aides.get(d.id) || 0, true]],
        gestes: html`${['ouverte', 'match'].includes(d.status) ? html`<button type="button" class="btn small tonal" onClick=${() => retirer(d)}>Retirer</button>` : null}
          ${suppr('Supprimer cette demande ? Les aides proposées partent avec elle.', 'demandes', d.id, 'Demande supprimée.')}`,
      }));
    }
    case 'questions': {
      const rep = compter(data.answers, 'question_id');
      return (data.questions || []).map(q => ({
        id: q.id, statut: statutQuestion(q, rep), at: ms(q.created_at), cherche: [q.titre, q.categorie, nomTexte(q.author_id)],
        titre: q.titre, ouvrir: () => go('reseau/entraide/' + q.id), sous: q.categorie || '',
        cellules: [['auteur', qui(q.author_id)], ['date', timeAgo(q.created_at)], ['n', rep.get(q.id) || 0, true]],
        gestes: suppr('Supprimer cette question ? Ses réponses partent avec elle.', 'questions', q.id, 'Question supprimée.'),
      }));
    }
    case 'mentorats':
      return (data.mentorships || []).map(m => ({
        id: m.id, statut: m.status, at: ms(m.created_at), cherche: [m.sujet, nomTexte(m.student_id), nomTexte(m.mentor_id)],
        titre: m.sujet, ouvrir: null, sous: BESOINS[m.besoin]?.label || '',
        cellules: [['auteur', qui(m.student_id)], ['laureat', m.mentor_id ? qui(m.mentor_id) : html`<span class="muted">Ouvert à tous</span>`], ['date', timeAgo(m.created_at)], ['rdv', m.rdv_at ? dateCourte(m.rdv_at) : '–']],
        gestes: html`${['demande', 'acceptee'].includes(m.status) ? html`<button type="button" class="btn small tonal" onClick=${() => confirm('Annuler ce mentorat ? L’étudiant et le lauréat le verront annulé.', () => act(async () => { await store.update('mentorships', m.id, { status: 'annulee' }); toast('Mentorat annulé.'); }), 'Annuler le mentorat')}>Annuler</button>` : null}
          ${suppr('Supprimer ce mentorat ? Il disparaît pour l’étudiant et le lauréat.', 'mentorships', m.id, 'Mentorat supprimé.')}`,
      }));
    default: {
      const ins = compter(data.evenement_participants, 'evenement_id');
      return (data.evenements || []).map(e => ({
        id: e.id, statut: statutEvenement(e), at: ms(e.debut), cherche: [e.titre, e.lieu, TYPES_EVENEMENT[e.type]?.[0]],
        titre: e.titre, ouvrir: () => go('reseau/agenda/' + e.id), sous: html`<span>${TYPES_EVENEMENT[e.type]?.[0] || 'Événement'}</span>${e.lieu ? html` · <span translate="no" dir="auto">${e.lieu}</span>` : null}`,
        cellules: [['date', dateCourte(e.debut)], ['n', ins.get(e.id) || 0, true]],
        gestes: html`${e.annule ? geste('Rétablir', () => store.update('evenements', e.id, { annule: false }), 'Événement rétabli.')
          : !passe(e) ? html`<button type="button" class="btn small tonal" onClick=${() => confirm('Annuler cet événement ? Il reste visible, barré, et les inscrits sont prévenus.', () => act(async () => { await store.update('evenements', e.id, { annule: true }); toast('Événement annulé. Les inscrits sont prévenus.'); }), 'Annuler l’événement')}>Annuler l’événement</button>` : null}
          ${suppr('Supprimer cet événement ? Les inscriptions partent avec lui.', 'evenements', e.id, 'Événement supprimé.')}`,
      }));
    }
  }
}

// Les colonnes du tableau, après celle du titre : [clé, libellé, nombre ?]
const COLONNES = {
  offres: [['type', 'Type'], ['auteur', 'Auteur'], ['date', 'Date'], ['n', 'Candidatures', true]],
  demandes: [['auteur', 'Étudiant'], ['date', 'Date'], ['n', 'Aides proposées', true]],
  questions: [['auteur', 'Auteur'], ['date', 'Date'], ['n', 'Réponses', true]],
  mentorats: [['auteur', 'Étudiant'], ['laureat', 'Lauréat'], ['date', 'Date'], ['rdv', 'Rendez-vous']],
  evenements: [['date', 'Date'], ['n', 'Inscrits', true]],
};
const TITRE_COL = { offres: 'Offre', demandes: 'Demande', questions: 'Question', mentorats: 'Mentorat', evenements: 'Événement' };

export function Contenus({ ctx }) {
  const { data, sub2, go } = ctx;
  const onglet = ONGLETS_CONTENUS.some(([k]) => k === sub2) ? sub2 : 'offres';
  const n = nombresContenus(data);
  return html`<div class="sub-page contenus">
    <div class="seg cs-onglets" role="tablist" aria-label="Sortes de contenus">${ONGLETS_CONTENUS.map(([k, l, ic]) => html`<button type="button" role="tab" key=${k} id=${'cnt-tab-' + k}
      aria-selected=${k === onglet} aria-controls="cnt-panneau" class=${k === onglet ? 'on' : ''} onClick=${() => go('admin/contenus/' + k, { remplacer: true })}>
      <${Icon} name=${ic} size=${16}/><span>${l}</span><span class="count">${n[k]}</span></button>`)}</div>
    <div id="cnt-panneau" role="tabpanel" aria-labelledby=${'cnt-tab-' + onglet}><${Liste} key=${onglet} ctx=${ctx} sorte=${onglet}/></div>
  </div>`;
}

function Liste({ ctx, sorte }) {
  const large = useLarge();
  const [statut, setStatut] = useState('');
  const [q, setQ] = useState('');
  const toutes = lignesDe(sorte, ctx).sort((a, b) => b.at - a.at);
  const qq = norm(q).trim();
  const liste = toutes.filter(l => (!statut || l.statut === statut) && (!qq || norm(l.cherche.filter(Boolean).join(' ')).includes(qq)));
  const { vus, reste, plus } = useVoirPlus(liste, large ? 50 : 20, statut + '|' + qq);
  const statuts = STATUTS[sorte].map(([k, l, c]) => [k, l, c, toutes.filter(x => x.statut === k).length]).filter(([k, , , nb]) => nb || k === statut);
  const tag = k => { const s = STATUTS[sorte].find(x => x[0] === k); return s ? html`<span class=${'tag ' + s[2]}>${s[1]}</span>` : null; };
  const titre = l => (l.ouvrir ? html`<button type="button" class="linkish cnt-titre" translate="no" dir="auto" onClick=${l.ouvrir}>${l.titre}</button>` : html`<span class="cnt-titre" translate="no" dir="auto">${l.titre}</span>`);
  const id = sorte === 'offres' ? 'adm-offres' : 'adm-' + sorte;
  return html`<div class="panel cnt-panel">
    <div class="cnt-outils">
      <div class="chips rangee cnt-filtres" role="group" aria-label="Filtrer par statut">
        <button type="button" class=${'chip' + (statut ? '' : ' on')} aria-pressed=${!statut} onClick=${() => setStatut('')}>Tous <span class="count">${toutes.length}</span></button>
        ${statuts.map(([k, l, , nb]) => html`<button type="button" key=${k} class=${'chip' + (statut === k ? ' on' : '')} aria-pressed=${statut === k} onClick=${() => setStatut(statut === k ? '' : k)}>${l} <span class="count">${nb}</span></button>`)}
      </div>
      <label class="search cnt-q"><${Icon} name="search" size=${16}/><input id="cnt-q" type="search" aria-label="Chercher dans ces contenus" placeholder=${sorte === 'offres' ? 'Titre, entreprise, auteur…' : 'Titre, auteur…'} value=${q} onInput=${e => setQ(e.target.value)}/></label>
    </div>
    ${!toutes.length ? html`<p class="small muted">Rien ici pour l’instant.</p>` : !liste.length ? html`<p class="small muted">Aucun contenu ne correspond à cette recherche.</p>`
    : large ? html`<div class="cnt-tab" id=${id}><table class=${'tbl cs-contenus cnt-' + sorte}>
        <thead><tr><th scope="col" class="k-titre">${TITRE_COL[sorte]}</th>${COLONNES[sorte].map(([k, l, nb]) => html`<th scope="col" key=${k} class=${'k-' + k + (nb ? ' num' : '')}>${l}</th>`)}<th scope="col" class="k-statut">Statut</th><th scope="col" class="k-gestes"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${vus.map(l => html`<tr key=${l.id} class="cnt-ligne" data-id=${l.id} data-statut=${l.statut}>
          <td class="k-titre">${titre(l)}${l.sous ? html`<span class="cnt-sous">${l.sous}</span>` : null}</td>
          ${l.cellules.map(([k, v, nb]) => html`<td key=${k} class=${'k-' + k + (nb ? ' num' : '')}>${v}</td>`)}
          <td class="k-statut">${tag(l.statut)}</td>
          <td class="k-gestes"><span class="cnt-gestes">${l.gestes}</span></td>
        </tr>`)}</tbody>
      </table></div>`
    : html`<ul class="cnt-cartes" id=${id}>${vus.map(l => html`<li key=${l.id} class="cnt-ligne" data-id=${l.id} data-statut=${l.statut}>
        <div class="cnt-tete">${titre(l)}${tag(l.statut)}</div>
        ${l.sous ? html`<span class="cnt-sous">${l.sous}</span>` : null}
        <p class="cnt-faits small">${l.cellules.map(([k, v], i) => html`<span key=${k} class=${'k-' + k}>${i ? html`<span aria-hidden="true"> · </span>` : null}${k === 'n' ? html`<span>${COLONNES[sorte].find(c => c[0] === 'n')[1]}</span> <strong>${v}</strong>` : v}</span>`)}</p>
        <div class="cnt-gestes">${l.gestes}</div>
      </li>`)}</ul>`}
    <${VoirPlus} reste=${reste} onPlus=${plus}/>
  </div>`;
}

injectCSS('admin-contenus', `
.contenus { display: flex; flex-direction: column; gap: .9rem; }
.cs-onglets .count { margin-inline-start: .1rem; }
.cnt-panel { gap: .7rem; }
.cnt-outils { display: flex; align-items: center; gap: var(--sp-2) var(--sp-3); min-width: 0; }
.cnt-filtres { flex: 1 1 auto; min-width: 0; }
.cnt-q { flex: 0 1 17rem; min-width: 12rem; }
@container cs (max-width: 700px) { .cnt-outils { flex-wrap: wrap; } .cnt-filtres, .cnt-q { flex-basis: 100%; } }
/* Le tableau : le titre (il ouvre le contenu) et sa ligne de détail, puis les colonnes, le statut et les gestes au bout */
.cnt-tab { min-width: 0; overflow-x: auto; }
.cs-contenus { font-size: var(--fs-2); }
.cs-contenus :is(th, td) { padding-inline: .4rem; }
.cs-contenus th { white-space: nowrap; }
.cs-contenus td { vertical-align: middle; padding-block: .5rem; }
.cs-contenus tbody tr:hover { background: color-mix(in srgb, var(--surface-2) 55%, transparent); }
.cs-contenus .k-titre { min-width: 14rem; }
.cs-contenus .k-date, .cs-contenus .k-rdv, .cs-contenus .k-type { white-space: nowrap; color: var(--ink-2); }
.cs-contenus .k-statut .tag { margin: 0; white-space: nowrap; }
.cs-contenus .k-gestes { width: 1%; white-space: nowrap; }
.cnt-titre { font-weight: 600; text-align: start; overflow-wrap: anywhere; }
span.cnt-titre { color: var(--ink); }
.cs-contenus .k-auteur .linkish, .cnt-faits .linkish { color: var(--ink-2); }
.icon-btn.small.cnt-suppr { width: 34px; height: 34px; }
.cnt-sous { display: block; font-size: var(--fs-1); color: var(--muted); overflow-wrap: anywhere; }
.cnt-gestes { display: inline-flex; align-items: center; justify-content: flex-end; gap: .35rem; }
@container cs (max-width: 900px) { .cs-contenus :is(.k-type, .k-rdv) { display: none; } }
/* Téléphone : une carte par contenu, le statut au bout du titre, les gestes dessous */
.cnt-cartes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.cnt-cartes > li { display: flex; flex-direction: column; gap: .3rem; padding-block: .75rem; border-top: 1px solid var(--line); min-width: 0; }
.cnt-cartes > li:first-child { border-top: 0; padding-top: .2rem; }
.cnt-tete { display: flex; align-items: flex-start; justify-content: space-between; gap: .6rem; min-width: 0; }
.cnt-tete .tag { flex: none; margin: 0; }
.cnt-faits { margin: 0; color: var(--muted); overflow-wrap: anywhere; }
.cnt-faits strong { color: var(--ink-2); font-variant-numeric: tabular-nums; }
.cnt-cartes .cnt-gestes { justify-content: flex-start; flex-wrap: wrap; }
`);
