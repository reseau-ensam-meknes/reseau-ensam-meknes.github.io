// Origine des offres à l'écran (règles dans origine.js) : le badge des offres portées par un lauréat, la section
// « Offres partagées » (cartes compactes, le lien externe), et ce que le formulaire d'offre ajoute pour un partage.
import { html, useState } from './vendor/preact-htm.js';
import { Icon, Field, CompanyLogo, toast, injectCSS } from './ui.js';
import { Reactions } from './reactions.js';
import { addAR } from './i18n.js';
import { titreOffre, timeAgo } from './logic.js';
import { SignalerBtn } from './confiance.js';
import { estPortee, estPartagee, sourceDe, lienValide } from './origine.js';

const lecteurOffre = () => import('./parse-offre.js');
const prenom = p => (p?.full_name || '').split(' ')[0];
const lienSur = l => (lienValide(l) ? l.trim() : null);

// « Portée par un lauréat · il encadre » : sur la carte (court) et dans la fiche (long)
export const BadgePortee = ({ long = false }) => html`<span class="tag portee"><${Icon} name="shield" size=${13}/>${long ? 'Offre portée par un lauréat · il encadre' : 'Portée par un lauréat · il encadre'}</span>`;

// Où l'offre a été vue, pour la phrase « Partagée par Salma · vue sur LinkedIn »
export function lignePartage(o, auteur) {
  const src = sourceDe(o.lien), p = prenom(auteur);
  return p && src ? `Partagée par ${p} · vue sur ${src}` : p ? `Partagée par ${p}` : src ? `Vue sur ${src}` : 'Offre partagée';
}

// Carte compacte d'une offre partagée : le titre ouvre la fiche (questions, signaler) ; « Voir l'offre » ouvre le site d'origine
export function PartageCard({ o, ctx, onOpen }) {
  const { store, me } = ctx;
  const auteur = store.byId('profiles', o.author_id);
  const lien = lienSur(o.lien);
  const lieu = [o.ville, o.pays && o.pays !== 'Maroc' ? o.pays : ''].filter(Boolean).join(', ');
  const mine = o.author_id === me.id;
  return html`<article class=${'opart' + (o.status !== 'ouverte' ? ' closed' : '')}>
    <button type="button" class="opart-main" onClick=${onOpen} aria-label=${`Ouvrir : ${titreOffre(o)}`}>
      <${CompanyLogo} name=${o.entreprise} size=${32}/>
      <span class="opart-txt">
        <strong class="opart-titre" translate="no" dir="auto">${titreOffre(o)}</strong>
        <span class="opart-meta" translate="no" dir="auto">${o.entreprise}${lieu ? ` · ${lieu}` : ''}</span>
        <span class="opart-par">${lignePartage(o, auteur)}</span>
      </span>
    </button>
    <${Reactions} ctx=${ctx} cible=${{ offer_id: o.id }} cls="opart-rx"/>
    <div class="opart-actions">
      ${o.status !== 'ouverte' ? html`<span class="tag done">Fermée</span>` : null}
      <span class="muted small nowrap">${timeAgo(o.created_at)}</span>
      <span class="spacer"></span>
      ${!mine ? html`<${SignalerBtn} ctx=${ctx} type="offre" id=${o.id} small/>` : null}
      ${lien ? html`<a class="btn small tonal opart-voir" href=${lien} target="_blank" rel="noopener noreferrer"><${Icon} name="link" size=${15}/> Voir l’offre</a>` : null}
    </div>
  </article>`;
}

// Section séparée, sous les autres offres. Le bouton « Partager une offre » n'y est que si la base sait les recevoir.
export function SectionPartages({ ctx, list, onPartager }) {
  if (!list.length && !onPartager) return null;
  return html`<section class="partages" aria-labelledby="partages-titre">
    <div class="section-head"><h2 id="partages-titre" class="h-ico"><${Icon} name="share"/> Offres partagées</h2>${list.length ? html`<span class="count">${list.length}</span>` : null}</div>
    <p class="small muted partages-note">${list.length ? 'Vues ailleurs (LinkedIn, sites d’entreprise) et partagées par des membres. La candidature se fait sur le site d’origine.' : 'Tu as vu une offre intéressante sur LinkedIn ? Partage-la ici, avec son lien.'}</p>
    ${list.length ? html`<div class="partages-liste">${list.map(o => html`<${PartageCard} key=${o.id} o=${o} ctx=${ctx} onOpen=${() => ctx.openOffer(o.id)}/>`)}</div>` : null}
    ${onPartager ? html`<button type="button" class="btn small ghost partages-btn" id="of-partager-bas" onClick=${onPartager}><${Icon} name="plus" size=${15}/> Partager une offre</button>` : null}
  </section>`;
}

// Dans la fiche d'une offre portée : ce que le lauréat s'engage à faire
export const EngagementPortee = ({ auteur }) => html`<div class="od-portee"><${BadgePortee} long/>
  <p class="small">${prenom(auteur) ? `${prenom(auteur)} a apporté cette offre de son entreprise, en est responsable et encadre la personne retenue.` : 'Un lauréat a apporté cette offre de son entreprise, en est responsable et encadre la personne retenue.'}</p></div>`;

// Dans la fiche d'une offre partagée : d'où elle vient, et qu'on postule là-bas
export const NotePartage = ({ o, auteur }) => html`<p class="small muted od-partage-note"><${Icon} name="share" size=${14}/> <span><span>${lignePartage(o, auteur)}</span> <span>La candidature se fait sur le site d’origine, pas ici.</span></span></p>`;
export function PiedPartage({ o }) {
  const lien = lienSur(o.lien), src = sourceDe(o.lien);
  if (!lien) return null;
  return html`<div class="od-foot"><a class="btn primary" id="od-voir-partage" href=${lien} target="_blank" rel="noopener noreferrer"><${Icon} name="link" size=${16}/> ${src === 'LinkedIn' ? 'Voir l’offre sur LinkedIn' : 'Voir l’offre'}</a></div>`;
}

// Formulaire : le premier choix, simple. Une offre de son entreprise (il encadre), ou une offre vue ailleurs.
export function ChoixOrigine({ value, onChange }) {
  const opts = [['entreprise', 'briefcase', 'Une offre de mon entreprise, je l’encadre'], ['partage', 'share', 'Je partage une offre vue ailleurs']];
  return html`<div class="origine-pick" role="radiogroup" aria-label="Quelle offre ?">${opts.map(([k, ic, l]) => html`<button type="button" role="radio" id=${'of-mode-' + k} aria-checked=${value === k} class=${'origine-opt' + (value === k ? ' on' : '')} onClick=${() => onChange(k)}><${Icon} name=${ic} size=${20}/><span>${l}</span></button>`)}</div>`;
}

// Un lauréat confirme qu'il porte l'offre : une case claire, décochée au départ
export const CasePortee = ({ checked, onChange }) => html`<label class="check case-portee"><input id="of-porte" type="checkbox" checked=${checked} onChange=${e => onChange(e.target.checked)}/>
  <span><strong>Je confirme : cette offre vient de mon entreprise, j’en suis responsable et j’encadrerai la personne retenue.</strong>
  <span class="small muted">Elle passe en tête des offres, avec le badge « Portée par un lauréat · il encadre ».</span></span></label>`;

// Partage : le lien et le texte de l'offre (LinkedIn ne se télécharge pas depuis le navigateur : on colle le texte)
export function SourcePartage({ me, f, set, onFill, err, aria }) {
  const [txt, setTxt] = useState('');
  const remplir = async () => {
    const { parseOffre } = await lecteurOffre();
    // L'offre vient d'ailleurs : pas son entreprise par défaut ; un étudiant garde son année
    const { fields, found } = parseOffre(txt, { ville: me.ville });
    const vus = found.filter(k => !['contact', 'cooptation', ...(me.role === 'etudiant' ? ['annees'] : [])].includes(k) && !(k === 'lien' && lienValide(f.lien)));
    if (!vus.length) { toast('Rien de reconnu. Remplis les champs à la main.', 'err'); return; }
    onFill(Object.fromEntries(vus.map(k => [k, fields[k]])), vus);
  };
  return html`<div class="partage-source">
    <${Field} label="Lien de l’offre" err=${err} errId="of-lien-p-err"><input id="of-lien-p" type="url" inputmode="url" dir="ltr" ...${aria} value=${f.lien || ''} onInput=${e => set('lien', e.target.value)} placeholder="https://www.linkedin.com/jobs/view/…" maxlength="500"/><//>
    <${Field} label="Texte de l’offre" hint="Copie le texte de l’annonce LinkedIn et colle-le ici : le formulaire se remplit tout seul."><textarea id="of-texte-p" rows="4" value=${txt} onInput=${e => setTxt(e.target.value)} placeholder="Colle ici le texte de l’annonce…" dir="auto"></textarea><//>
    <div class="row-end"><button type="button" class="btn small" id="of-preremplir" disabled=${txt.trim().length < 15} onClick=${remplir}><${Icon} name="spark" size=${15}/> Préremplir le formulaire</button></div>
  </div>`;
}

injectCSS('partages', `
/* Offre portée : la carte un peu plus visible, sobre (un filet de couleur au début, un badge) */
.tag.portee { background: var(--good-soft); color: var(--good); white-space: normal; text-align: start; }
.ocard.portee { box-shadow: var(--sh1), inset 0 0 0 1px color-mix(in srgb, var(--good) 28%, transparent); border-inline-start: 3px solid var(--good); }
.od-portee { display: flex; flex-direction: column; align-items: flex-start; gap: .35rem; padding: .7rem .8rem; border-radius: var(--r-md); background: color-mix(in srgb, var(--good-soft) 60%, var(--surface)); }
.od-portee p { margin: 0; }
/* Offres partagées : une section à part, des cartes compactes */
.partages { display: flex; flex-direction: column; gap: .6rem; margin-top: 1.4rem; min-width: 0; }
.partages .section-head { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
.partages .partages-btn { align-self: flex-start; }
.partages-note { margin: 0; }
.partages-liste { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: .6rem; }
.opart { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); display: flex; flex-direction: column; min-width: 0; }
.opart.closed { opacity: .7; }
.opart-main { display: flex; gap: .65rem; align-items: flex-start; padding: .7rem .8rem .45rem; border: 0; background: none; color: inherit; font: inherit; text-align: start; cursor: pointer; min-width: 0; border-radius: var(--r-md) var(--r-md) 0 0; }
.opart-txt { display: flex; flex-direction: column; gap: .12rem; min-width: 0; }
.opart-titre { font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
.opart-meta, .opart-par { font-size: var(--fs-1); color: var(--muted); overflow-wrap: anywhere; }
.opart-par { color: var(--ink-2); }
.opart-actions { display: flex; align-items: center; gap: .45rem; padding: .3rem .8rem .55rem; min-width: 0; }
.opart-rx { padding: 0 .65rem; min-height: 40px; }
.opart-actions .spacer { flex: 1; }
.opart .opart-actions .btn { min-height: 36px; }
[dir="rtl"] .opart-txt [dir="auto"] { text-align: right; }
.od-partage-note { display: flex; gap: .4rem; align-items: flex-start; margin: 0; }
/* Formulaire : le premier choix, en deux grands boutons */
.origine-pick { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; }
.origine-opt { display: flex; align-items: center; gap: .55rem; padding: .7rem .8rem; border: 1px solid var(--line-strong); border-radius: var(--r-md); background: var(--surface); color: var(--ink-2); font: inherit; font-weight: 600; text-align: start; cursor: pointer; line-height: 1.3; min-height: 52px; }
.origine-opt svg { flex: none; }
.origine-opt.on { background: var(--sel-bg); color: var(--sel-ink); border-color: transparent; box-shadow: inset 0 0 0 1px var(--sel-ring); }
@media (max-width: 480px) { .origine-pick { grid-template-columns: 1fr; } }
.case-portee { align-items: flex-start; gap: .55rem; padding: .65rem .75rem; border: 1px solid color-mix(in srgb, var(--good) 35%, var(--line)); border-radius: var(--r-md); background: color-mix(in srgb, var(--good-soft) 45%, var(--surface)); }
.case-portee > span { display: flex; flex-direction: column; gap: .2rem; font-weight: 500; }
.case-portee input { margin-top: .2rem; flex: none; }
.partage-source { display: flex; flex-direction: column; gap: .6rem; padding: .75rem .8rem; border: 1px dashed color-mix(in srgb, var(--accent) 45%, var(--line)); border-radius: var(--r-md); background: color-mix(in srgb, var(--accent-soft) 40%, var(--surface)); }
.partage-source input, .partage-source textarea { font-size: max(16px, 1rem); }
`);

addAR({
  'Portée par un lauréat · il encadre': 'يقدّمه خريج · مع التأطير',
  'Offre portée par un lauréat · il encadre': 'عرض يقدّمه خريج · مع التأطير',
  'Offres partagées': 'عروض تمت مشاركتها',
  'Offre partagée': 'عرض تمت مشاركته',
  'Partager une offre': 'مشاركة عرض',
  'Vues ailleurs (LinkedIn, sites d’entreprise) et partagées par des membres. La candidature se fait sur le site d’origine.': 'عروض منشورة في مواقع أخرى (LinkedIn، مواقع الشركات) شاركها أعضاء الشبكة. يتم الترشح في الموقع الأصلي.',
  'Tu as vu une offre intéressante sur LinkedIn ? Partage-la ici, avec son lien.': 'رأيت عرضًا مهمًّا على LinkedIn؟ شاركه هنا مع رابطه.',
  'Voir l’offre sur LinkedIn': 'فتح العرض على LinkedIn',
  'Un lauréat a apporté cette offre de son entreprise, en est responsable et encadre la personne retenue.': 'عرض قدّمه خريج من شركته، مع المسؤولية عنه وتأطير الشخص المقبول.',
  'Quelle offre ?': 'أي عرض؟',
  'Une offre de mon entreprise, je l’encadre': 'عرض من شركتي، مع تأطيري',
  'Je partage une offre vue ailleurs': 'مشاركة عرض منشور في موقع آخر',
  'Je confirme : cette offre vient de mon entreprise, j’en suis responsable et j’encadrerai la personne retenue.': 'أؤكد: هذا العرض من شركتي، وأتحمّل مسؤوليته، وسأتولّى تأطير الشخص المقبول.',
  'Elle passe en tête des offres, avec le badge « Portée par un lauréat · il encadre ».': 'يظهر في أعلى العروض، مع شارة «يقدّمه خريج · مع التأطير».',
  'Lien de l’offre': 'رابط العرض', 'Texte de l’offre': 'نص العرض',
  'Copie le texte de l’annonce LinkedIn et colle-le ici : le formulaire se remplit tout seul.': 'انسخ نص الإعلان من LinkedIn والصقه هنا: تمتلئ الاستمارة تلقائيًا.',
  'Colle ici le texte de l’annonce…': 'الصق هنا نص الإعلان…',
  'Préremplir le formulaire': 'ملء الاستمارة تلقائيًا',
  'La candidature se fait sur le site d’origine, pas ici.': 'يتم الترشح في الموقع الأصلي، لا هنا.',
  'https://www.linkedin.com/jobs/view/…': 'https://www.linkedin.com/jobs/view/…',
  // Formulaire et fiche (offers.js)
  'Fermer le partage': 'إغلاق المشاركة',
  'Offre partagée. Elle apparaît dans « Offres partagées », avec son lien.': 'تمت مشاركة العرض. يظهر في «عروض تمت مشاركتها» مع رابطه.',
  'Tu partages une offre vue ailleurs (LinkedIn, site d’entreprise…). Les étudiants de ton année la voient avec son lien, et postulent sur le site d’origine.': 'تشارك عرضًا منشورًا في موقع آخر (LinkedIn، موقع شركة…). يراه طلبة سنتك مع رابطه، ويترشحون في الموقع الأصلي.',
  'Elle apparaît dans « Offres partagées », avec son lien. Elle se ferme seule après 45 jours, ou à sa date limite.': 'يظهر في «عروض تمت مشاركتها» مع رابطه، ويُغلق تلقائيًا بعد 45 يومًا أو عند آخر أجل له.',
  'Un lien complet, qui commence par https://': 'رابط كامل يبدأ بـ https://',
  'Colle le lien de l’offre (LinkedIn, site de l’entreprise…).': 'الصق رابط العرض (LinkedIn، موقع الشركة…).',
  // Refus de la base (offre_origine) et de la démo, mêmes phrases
  'Une offre partagée reste un partage : publie plutôt une nouvelle offre.': 'يبقى العرض المشترك مشاركة: انشر عرضًا جديدًا بدلًا من ذلك.',
  'Seul un lauréat peut porter une offre de son entreprise.': 'وحده الخريج يمكنه تقديم عرض من شركته.',
  'Un étudiant partage une offre vue ailleurs, avec son lien.': 'يمكن للطالب مشاركة عرض منشور في موقع آخر، مع رابطه.',
  'Ajoute le lien de l’offre (https://…).': 'أضف رابط العرض (https://…).',
  'Cette offre est déjà partagée sur le réseau.': 'تمت مشاركة هذا العرض من قبل في الشبكة.',
  'Cette offre partagée se postule sur son site d’origine.': 'يتم الترشح لهذا العرض المشارَك في موقعه الأصلي.',
}, [
  [/^Partagée par (.+?) · vue sur (.+)$/, (n, s) => `مشاركة من ${n} · منشور على ${s}`],
  [/^Vue sur (.+)$/, s => `منشور على ${s}`],
  [/^(.+?) a apporté cette offre de son entreprise, en est responsable et encadre la personne retenue\.$/, n => `عرض قدّمه ${n} من شركته، مع المسؤولية عنه وتأطير الشخص المقبول.`],
]);
