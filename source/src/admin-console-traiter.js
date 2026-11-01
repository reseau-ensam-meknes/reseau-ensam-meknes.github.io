// Console d'administration · À traiter : tout ce qui attend l'administration, du plus récent au plus ancien, une ligne par chose.
// Signalements, lauréats à vérifier, recrutements à confirmer, demandes, questions et mentorats sans réponse depuis 24 h,
// erreurs de lecture de CV, comptes sans profil. Chaque ligne s'ouvre ; les gestes simples se font sur place.
// Une demande sans proposition propose trois lauréats à qui écrire, avec un message prêt dans leur langue.
import { html, useState } from './vendor/preact-htm.js';
import { Icon, Person, Empty, toast, injectCSS } from './ui.js';
import { addAR, arCount } from './i18n.js';
import { laureatsPourDemande, timeAgo, NIVEAUX, niveauOf, filiereCourte } from './logic.js';
import { CATS, messagePourDemande } from './admin-console-regles.js';
import { MessageBtn } from './messages.js';
import { libellesCV } from './cv.js';
import { cible, TYPES_CIBLE, MOTIFS, court, demandeCV } from './admin-console-cibles.js';
import { copier } from './admin-console.js';


addAR({
  'Lauréats à vérifier': 'خريجون للتحقق', 'Recrutements à confirmer': 'توظيفات للتأكيد', 'Demandes sans proposition': 'طلبات دون اقتراح',
  'Questions sans réponse': 'أسئلة بلا جواب', 'Mentorats sans horaire': 'إرشاد دون توقيت', 'Lectures de CV': 'قراءات السيرة الذاتية', 'Comptes sans profil': 'حسابات دون ملف',
  'Signalement': 'تبليغ', 'Lauréat à vérifier': 'خريج للتحقق', 'Recrutement à confirmer': 'توظيف للتأكيد', 'Demande sans proposition': 'طلب دون اقتراح',
  'Question sans réponse': 'سؤال بلا جواب', 'Mentorat sans horaire': 'إرشاد دون توقيت', 'Lecture de CV à corriger': 'قراءة سيرة ذاتية للتصحيح',
  'Filtrer ce qui attend': 'تصفية ما ينتظر', 'Rien à traiter': 'لا شيء للمعالجة',
  'Tout est à jour. Les signalements, les lauréats à vérifier et les demandes qui attendent arriveront ici.': 'كل شيء محدَّث. ستصل هنا التبليغات والخريجون الذين ينتظرون التحقق والطلبات التي تنتظر.',
  'Rien ici pour l’instant.': 'لا شيء هنا حاليًا.',
  'Ouvrir la modération': 'فتح الإشراف', 'Voir dans Membres': 'عرض في الأعضاء',
  'Le lauréat a déclaré ce recrutement. Si l’étudiant ne confirme pas, l’administration peut le faire après vérification.': 'صرّح الخريج بهذا التوظيف. إذا لم يؤكده الطالب، يمكن للإدارة فعل ذلك بعد التحقق.',
  'Recrutement confirmé.': 'تم تأكيد التوظيف.', 'Recrutement refusé.': 'تم رفض التوظيف.',
  'Trois lauréats qui peuvent aider': 'ثلاثة خريجين يمكنهم المساعدة', 'Un message prêt, dans sa langue : relis-le avant de l’envoyer.': 'رسالة جاهزة بلغته: راجعها قبل إرسالها.',
  'Aucun lauréat proche pour l’instant : partage la demande dans les groupes de sa filière.': 'لا خريج قريب حاليًا: شارك الطلب في مجموعات شعبته.',
  'L’étudiant attend qu’un lauréat choisisse un de ses horaires.': 'ينتظر الطالب أن يختار خريج أحد توقيتاته.', 'Voir les mentorats': 'عرض الإرشاد',
  'Un rappel par email part tout seul 24 h après l’inscription.': 'يُرسَل تذكير بالبريد تلقائيًا بعد 24 ساعة من التسجيل.',
  'Lu :': 'المقروء:', 'Juste :': 'الصحيح:', 'Profil supprimé': 'ملف محذوف', 'Contenu déjà supprimé': 'المحتوى حُذف من قبل',
  '1 chose à traiter': 'أمر واحد للمعالجة', '1 recrutement à confirmer': 'توظيف واحد للتأكيد', '1 compte créé sans profil': 'حساب واحد دون ملف',
}, [
  [/^(\d+) choses à traiter$/, n => `${arCount(n, ['أمر واحد', 'أمران', 'أمور', 'أمرًا'])} للمعالجة`],
  [/^(\d+) recrutements à confirmer$/, n => `${arCount(n, ['توظيف واحد', 'توظيفان', 'توظيفات', 'توظيفًا'])} للتأكيد`],
  [/^(\d+) comptes créés sans profil$/, n => `${arCount(n, ['حساب واحد', 'حسابان', 'حسابات', 'حسابًا'])} دون ملف`],
  [/^(\d+) comptes sans profil$/, n => `${arCount(n, ['حساب واحد', 'حسابان', 'حسابات', 'حسابًا'])} دون ملف`],
]);

// La phrase d'une catégorie, pour l'encadré du tableau de bord (les mêmes mots que depuis le début)
function phrase(k, n) {
  switch (k) {
    case 'signalements': return `${n} signalement${n > 1 ? 's' : ''} à traiter`;
    case 'laureats': return `${n} lauréat${n > 1 ? 's' : ''} à vérifier`;
    case 'recrutements': return n > 1 ? `${n} recrutements à confirmer` : '1 recrutement à confirmer';
    case 'demandes': return n > 1 ? `${n} demandes d’étudiants sans proposition depuis plus de 24 h` : '1 demande d’étudiant sans proposition depuis plus de 24 h';
    case 'questions': return n > 1 ? `${n} questions d’étudiants sans réponse depuis plus de 24 h` : '1 question d’étudiant sans réponse depuis plus de 24 h';
    case 'mentorats': return n > 1 ? `${n} étudiants attendent un horaire depuis plus de 24 h` : '1 étudiant attend un horaire depuis plus de 24 h';
    case 'cv': return n > 1 ? `${n} erreurs de lecture de CV signalées` : '1 erreur de lecture de CV signalée';
    default: return n > 1 ? `${n} comptes créés sans profil` : '1 compte créé sans profil';
  }
}
const nombre = (it) => (it.cat === 'comptes' ? it.comptes.length : 1);

// L'encadré du haut du tableau de bord : combien de choses attendent, par sorte ; chaque ligne ouvre « À traiter » au bon endroit
export function CalloutATraiter({ items, go }) {
  if (!items.length) return null;
  const par = CATS.map(([k, , ic]) => [k, ic, items.filter(i => i.cat === k).reduce((a, i) => a + nombre(i), 0)]).filter(([, , n]) => n);
  return html`<div class="callout today cs-a-traiter">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="bell"/> ${items.length > 1 ? `${items.length} choses à traiter` : '1 chose à traiter'}</h2>
      <button type="button" class="btn small tonal" id="adm-traiter-tout" onClick=${() => go('admin/traiter')}>Tout voir</button></div>
    <ul class="todo cs-todo">${par.map(([k, ic, n]) => html`<li key=${k}><button type="button" class="notif act" onClick=${() => go('admin/traiter/' + k)}><span class="n-ico accent"><${Icon} name=${ic} size=${16}/></span><span>${phrase(k, n)}</span><${Icon} name="arrow" size=${16}/></button></li>`)}</ul>
  </div>`;
}

const lienDemande = id => `${location.origin}${location.pathname}#offres/demandes/${id}`;
const prenomDe = p => (p?.full_name || '').split(' ')[0];

// Ce que montre chaque ligne : sorte, titre, détail court, gestes sur place, et ce qui s'ouvre
function vue(ctx, it, comptes) {
  const { store, act, go, openProfile, saison } = ctx;
  const nom = p => html`<span translate="no" dir="auto">${p?.full_name || ''}</span>`;
  switch (it.cat) {
    case 'signalements': {
      const s0 = it.g[0], [tl] = TYPES_CIBLE[s0.cible_type] || ['Contenu', 'flag'], c = cible(ctx, s0.cible_type, s0.cible_id);
      const motifs = [...new Set(it.g.map(s => s.motif))];
      return {
        ico: 'flag', ton: 'brass', type: 'Signalement', sous: tl,
        titre: c ? html`<span translate="no" dir="auto">${court(c.titre, 90)}</span>` : 'Contenu déjà supprimé',
        meta: html`${motifs.map(m => html`<span class="tag urgent">${MOTIFS[m] || m}</span>`)}${it.g.length > 1 ? html` <span>${`Signalé ${it.g.length} fois`}</span>` : null}`,
        gestes: html`<button type="button" class="btn small tonal" onClick=${() => go('admin/moderation')}>Modérer</button>`,
        detail: () => html`${c?.texte ? html`<p class="tt-cite" translate="no" dir="auto">${court(c.texte, 280)}</p>` : null}
          <ul class="tt-faits small">${it.g.map(s => { const a = store.byId('profiles', s.auteur_id); return html`<li key=${s.id}><span class="muted">Signalé par</span> ${a ? html`<button type="button" class="linkish" translate="no" onClick=${() => openProfile(a)}>${a.full_name}</button>` : '?'} · <span class="muted">${MOTIFS[s.motif] || s.motif}</span>${s.details ? html` <span class="mod-details" translate="no" dir="auto">« ${s.details} »</span>` : null}</li>`; })}</ul>
          <div class="row">${c?.voir ? html`<button type="button" class="btn small ghost" onClick=${c.voir[1]}><${Icon} name="eye" size=${15}/> ${c.voir[0]}</button>` : null}<button type="button" class="btn small ghost" onClick=${() => go('admin/moderation')}>Ouvrir la modération</button></div>`,
      };
    }
    case 'laureats': {
      const p = it.p, c = (comptes || []).find(x => x.id === p.id);
      return {
        ico: 'shield', ton: 'accent', type: 'Lauréat à vérifier', titre: nom(p), meta: `${p.filiere || ''} · Promo ${p.promo}`,
        gestes: html`<button type="button" class="btn small tonal" onClick=${() => act(async () => { await store.update('profiles', p.id, { verified: true }); toast('Lauréat vérifié.'); })}><${Icon} name="shield" size=${15}/> Vérifier</button>`,
        detail: () => html`<ul class="tt-faits small">
            ${c?.email ? html`<li><span class="mono" dir="ltr" translate="no">${c.email}</span></li>` : null}
            ${p.entreprise ? html`<li translate="no" dir="auto">${[p.poste, p.entreprise].filter(Boolean).join(' · ')}</li>` : null}
            <li class=${p.cv_path || p.cv_url ? 'good-t' : 'muted'}>${p.cv_path || p.cv_url ? 'CV déposé' : 'Pas de CV déposé'}</li>
            <li>${p.linkedin ? html`<a href=${p.linkedin.startsWith('http') ? p.linkedin : 'https://' + p.linkedin} target="_blank" rel="noopener">Son profil LinkedIn</a>` : html`<span class="muted">Pas de LinkedIn</span>`}</li></ul>
          <div class="row"><button type="button" class="btn small ghost" onClick=${() => openProfile(p)}>Voir le profil</button>
            ${!p.cv_path && !p.cv_url ? html`<${MessageBtn} ctx=${ctx} p=${p} cls="btn small ghost" label="Demander son CV" texte=${demandeCV(p)}/>` : null}
            <button type="button" class="btn small ghost" onClick=${() => go('admin/membres')}>Voir dans Membres</button></div>`,
      };
    }
    case 'recrutements': {
      const pl = it.pl, s = store.byId('profiles', pl.student_id), l = store.byId('profiles', pl.laureat_id);
      return {
        ico: 'briefcase', ton: 'good', type: 'Recrutement à confirmer', titre: nom(s), meta: html`<span translate="no" dir="auto">${pl.entreprise || ''}</span> · <span>${`déclaré par ${l?.full_name || '?'}`}</span>`,
        gestes: html`<button type="button" class="btn small ghost" onClick=${() => act(async () => { await store.update('placements', pl.id, { status: 'refuse' }); toast('Recrutement refusé.'); })}>Refuser</button>
          <button type="button" class="btn small tonal" onClick=${() => act(async () => { await store.update('placements', pl.id, { status: 'confirme' }); toast('Recrutement confirmé.'); })}>Confirmer</button>`,
        detail: () => html`<p class="small muted">Le lauréat a déclaré ce recrutement. Si l’étudiant ne confirme pas, l’administration peut le faire après vérification.</p>
          <ul class="people-list tt-gens">${[s, l].filter(Boolean).map(x => html`<li key=${x.id}><${Person} p=${x} onOpen=${openProfile}/></li>`)}</ul>`,
      };
    }
    case 'demandes': {
      const d = store.byId('demandes', it.a.id), etu = d && store.byId('profiles', d.auteur_id);
      if (!d) return null;
      const quoi = [etu?.promo ? NIVEAUX[niveauOf(etu, saison)]?.short : '', filiereCourte(etu?.filiere)].filter(Boolean).join(' · ');
      return {
        ico: 'send', ton: 'accent', type: 'Demande sans proposition', titre: html`<span translate="no" dir="auto">${d.titre}</span>`,
        meta: html`<span translate="no" dir="auto">${prenomDe(etu)}</span>${quoi ? ` · ${quoi}` : ''}`,
        gestes: html`<button type="button" class="btn small ghost" onClick=${() => go('offres/demandes/' + d.id)}>Voir la demande</button>`,
        detail: () => {
          const l = laureatsPourDemande(ctx.data, d, 3);
          return html`${d.details ? html`<p class="tt-cite" translate="no" dir="auto">${court(d.details, 280)}</p>` : null}
            ${l.length ? html`<p class="tt-sous-t">Trois lauréats qui peuvent aider</p>
              <ul class="people-list tt-aidants">${l.map(({ p, why }) => html`<li key=${p.id}><${Person} p=${p} onOpen=${openProfile} sub=${`${p.filiere || ''} · Promo ${p.promo}`}/>
                <span class="tt-why">${why.map(w => html`<span class="mini">${w}</span>`)}</span>
                <${MessageBtn} ctx=${ctx} p=${p} cls="btn small tonal" texte=${messagePourDemande(p, etu, d, lienDemande(d.id), saison)}/></li>`)}</ul>
              <p class="small muted">Un message prêt, dans sa langue : relis-le avant de l’envoyer.</p>`
            : html`<p class="small muted">Aucun lauréat proche pour l’instant : partage la demande dans les groupes de sa filière.</p>`}`;
        },
      };
    }
    case 'questions': {
      const q = store.byId('questions', it.a.id), a = q && store.byId('profiles', q.author_id);
      if (!q) return null;
      return {
        ico: 'qa', ton: 'accent', type: 'Question sans réponse', titre: html`<span translate="no" dir="auto">${q.titre}</span>`, meta: html`<span translate="no" dir="auto">${prenomDe(a)}</span>`,
        gestes: html`<button type="button" class="btn small ghost" onClick=${() => go('reseau/entraide/' + q.id)}>Voir la question</button>`,
        detail: () => html`${q.body ? html`<p class="tt-cite" translate="no" dir="auto">${court(q.body, 280)}</p>` : html`<p class="small muted">Rien ici pour l’instant.</p>`}`,
      };
    }
    case 'mentorats': {
      const m = store.byId('mentorships', it.a.id), s = m && store.byId('profiles', m.student_id);
      if (!m) return null;
      return {
        ico: 'clock', ton: 'accent', type: 'Mentorat sans horaire', titre: html`<span translate="no" dir="auto">${m.sujet}</span>`, meta: html`<span translate="no" dir="auto">${prenomDe(s)}</span>`,
        gestes: html`<button type="button" class="btn small ghost" onClick=${() => go('mentorat')}>Voir les mentorats</button>`,
        detail: () => html`<p class="small muted">L’étudiant attend qu’un lauréat choisisse un de ses horaires.</p>${s ? html`<ul class="people-list tt-gens"><li><${Person} p=${s} onOpen=${openProfile}/></li></ul>` : null}`,
      };
    }
    case 'cv': {
      const r = it.r, p = store.byId('profiles', r.profil_id);
      return {
        ico: 'file', ton: 'accent', type: 'Lecture de CV à corriger', titre: p ? nom(p) : 'Profil supprimé',
        gestes: html`<button type="button" class="btn small ghost" onClick=${() => go('admin/membres')}>Voir dans Membres</button>`,
        detail: () => html`<p class="small"><span>Lu :</span> <b>${libellesCV(r.proposition || {}).join(' · ')}</b>${r.juste ? html` · <span>Juste :</span> <b translate="no" dir="auto">${r.juste}</b>` : null}</p>`,
      };
    }
    default: {
      const n = it.comptes.length, emails = it.comptes.map(c => c.email).filter(Boolean);
      return {
        ico: 'user', ton: 'accent', type: 'Comptes sans profil', titre: n > 1 ? `${n} comptes créés sans profil` : '1 compte créé sans profil',
        gestes: emails.length ? html`<button type="button" class="btn small tonal" onClick=${() => copier(emails.join(', '), 'Emails copiés.')}><${Icon} name="copy" size=${15}/> Copier les emails</button>` : null,
        detail: () => html`<ul class="tt-emails small">${emails.map(e => html`<li key=${e} class="mono" dir="ltr" translate="no">${e}</li>`)}</ul>
          <p class="small muted">Un rappel par email part tout seul 24 h après l’inscription.</p>`,
      };
    }
  }
}

function Ligne({ ctx, it, comptes, ouvert, basculer }) {
  const v = vue(ctx, it, comptes);
  if (!v) return null;
  const id = 'tt-d-' + it.cle;
  return html`<li class="tt-item" data-cat=${it.cat} data-cle=${it.cle}>
    <div class="tt-tete">
      <span class=${'n-ico ' + v.ton} aria-hidden="true"><${Icon} name=${v.ico} size=${16}/></span>
      <button type="button" class="tt-ouvrir" aria-expanded=${ouvert} aria-controls=${id} onClick=${basculer}>
        <span class="tt-l1"><span class="tt-type">${v.type}</span>${v.sous ? html`<span class="tt-sous">${v.sous}</span>` : null}<span class="tt-quand">${timeAgo(new Date(it.at).toISOString())}</span></span>
        <span class="tt-titre">${v.titre}</span>
        ${v.meta ? html`<span class="tt-meta">${v.meta}</span>` : null}
        <${Icon} name="chevron" size=${16}/>
      </button>
      ${v.gestes ? html`<span class="tt-gestes">${v.gestes}</span>` : null}
    </div>
    <div class="tt-detail" id=${id} hidden=${!ouvert}>${ouvert ? v.detail() : null}</div>
  </li>`;
}

export function ATraiter({ ctx, items, comptes }) {
  const { sub2, go } = ctx;
  const [ouverts, setOuverts] = useState(() => new Set());
  const filtre = CATS.some(([k]) => k === sub2) ? sub2 : '';
  const liste = filtre ? items.filter(i => i.cat === filtre) : items;
  const nb = k => items.filter(i => i.cat === k).length;
  const basculer = cle => setOuverts(s => { const n = new Set(s); if (n.has(cle)) n.delete(cle); else n.add(cle); return n; });
  if (!items.length) return html`<div class="panel"><${Empty} icon="checks" title="Rien à traiter">Tout est à jour. Les signalements, les lauréats à vérifier et les demandes qui attendent arriveront ici.<//></div>`;
  return html`<div class="sub-page a-traiter">
    <div class="chips rangee tt-filtres" role="group" aria-label="Filtrer ce qui attend">
      <button type="button" class=${'chip' + (filtre ? '' : ' on')} aria-pressed=${!filtre} onClick=${() => go('admin/traiter', { remplacer: true })}>Tout <span class="count">${items.length}</span></button>
      ${CATS.filter(([k]) => nb(k)).map(([k, l]) => html`<button type="button" key=${k} class=${'chip' + (filtre === k ? ' on' : '')} aria-pressed=${filtre === k} onClick=${() => go('admin/traiter/' + k, { remplacer: true })}>${l} <span class="count">${nb(k)}</span></button>`)}
    </div>
    ${liste.length ? html`<ul class="tt-liste">${liste.map(it => html`<${Ligne} key=${it.cle} ctx=${ctx} it=${it} comptes=${comptes} ouvert=${ouverts.has(it.cle)} basculer=${() => basculer(it.cle)}/>`)}</ul>`
      : html`<p class="small muted">Rien ici pour l’instant.</p>`}
  </div>`;
}

injectCSS('admin-traiter', `
.cs-a-traiter .section-head { margin: 0; }
.cs-todo { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0 1rem; }
@container cs (min-width: 760px) { .cs-todo { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.a-traiter { display: flex; flex-direction: column; gap: .9rem; }
/* Sur ordinateur, les filtres passent à la ligne : à la souris, une rangée qui défile cache ceux du bout */
@container cs (min-width: 621px) { .tt-filtres.chips.rangee { flex-wrap: wrap; overflow: visible; } }
.tt-liste { list-style: none; margin: 0; padding: 0 var(--sp-4); background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--sh1); }
.tt-item { border-top: 1px solid var(--line); }
.tt-item:first-child { border-top: 0; }
.tt-tete { display: flex; align-items: center; gap: .7rem; min-height: 64px; padding-block: .55rem; }
.tt-tete > .n-ico { align-self: flex-start; margin-top: .55rem; }
.tt-ouvrir { flex: 1 1 0; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: .5rem; align-items: center; padding: .3rem .2rem; border: 0; background: none; color: inherit; font: inherit; text-align: start; cursor: pointer; border-radius: var(--r-md); }
.tt-ouvrir:hover .tt-titre { text-decoration: underline; text-underline-offset: 3px; }
.tt-ouvrir > :not(.ico) { grid-column: 1; }
.tt-ouvrir > .ico { grid-column: 2; grid-row: 1 / span 3; color: var(--muted); }
.tt-ouvrir[aria-expanded="true"] > .ico { transform: rotate(180deg); }
@media (prefers-reduced-motion: no-preference) { .tt-ouvrir > .ico { transition: transform .2s var(--ease); } }
.tt-l1 { display: flex; flex-wrap: wrap; align-items: baseline; gap: .1rem .5rem; font-size: var(--fs-1); color: var(--muted); }
.tt-type { font-weight: 650; color: var(--ink-2); text-transform: uppercase; letter-spacing: .04em; }
[dir="rtl"] .tt-type { text-transform: none; letter-spacing: 0; font-size: var(--fs-2); }
.tt-titre { font-weight: 600; color: var(--ink); overflow-wrap: anywhere; line-height: 1.35; }
.tt-meta { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem; font-size: var(--fs-2); color: var(--muted); }
.tt-meta .tag { margin: 0; }
.tt-gestes { flex: none; display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: .35rem; }
.tt-detail { padding-block: 0 .9rem; padding-inline: calc(30px + .7rem) 0; display: flex; flex-direction: column; gap: .55rem; }
.tt-detail[hidden] { display: none; }
.tt-detail > p { margin: 0; }
.tt-cite { margin: 0; padding-inline-start: .75rem; border-inline-start: 2px solid var(--line); color: var(--ink-2); font-size: .9rem; overflow-wrap: anywhere; }
.tt-faits { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .2rem; overflow-wrap: anywhere; }
.tt-emails { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: .3rem .8rem; }
.tt-sous-t { font-weight: 650; color: var(--ink); }
.tt-aidants li { flex-wrap: wrap; gap: .4rem .7rem; }
.tt-aidants li > .person { flex: 1 1 14rem; min-width: 0; }
.tt-why { display: flex; flex-wrap: wrap; gap: .25rem; }
.tt-why .mini { margin: 0; }
.tt-gens li { padding-block: .35rem; }
@container cs (max-width: 620px) {
  .tt-tete { flex-wrap: wrap; }
  .tt-gestes { flex-basis: 100%; justify-content: flex-start; padding-inline-start: calc(30px + .7rem); }
  .tt-detail { padding-inline: 0; }
}
`);
