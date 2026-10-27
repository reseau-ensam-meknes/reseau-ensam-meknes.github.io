// Vitrine : ce qui montre que le réseau vit (règles pures et testées dans vitrine-regles.js).
//  - « Ça bouge dans le réseau » : des comptes vrais (offres, réactions, réponses, nouveaux membres), jamais qui ;
//  - « Grâce à toi » : sur l'accueil d'un lauréat, la plus belle nouvelle vraie née de ses offres ;
//  - la carte qui s'ouvre en fiche : le logo et le titre glissent jusqu'à leur place (View Transitions), sinon un fondu ;
//  - la forme des cartes tant que les offres arrivent.
import { html, useMemo } from './vendor/preact-htm.js';
import { Icon, Avatar, mouvementReduit } from './ui.js';
import { addAR, arCount, getLang } from './i18n.js';
import { villeAffichee, PAYS_AR, canonPays } from './geo.js';
import { timeAgo, titreOffre } from './logic.js';
import { caBouge, phraseBouge, graceAToi, phraseGrace } from './vitrine-regles.js';

// ---------------------------------------------------------------------------
// « Ça bouge dans le réseau » : une bande calme sous le pouls de « Cette semaine ». Rien à toucher, rien de privé.
// ---------------------------------------------------------------------------
const ICONES_BOUGE = { offres: 'feed', reactions: 'heart', reponses: 'comment', membres: 'people' };
export function CaBouge({ ctx }) {
  const { data, me, store, saison } = ctx;
  const b = useMemo(() => caBouge(data, me, id => store.byId('profiles', id), Date.now(), saison),
    [data.offers, data.reactions_publiques, data.reponses_demandes, data.answers, data.profiles, data.demandes, me.id, saison]);
  if (!b) return null;
  return html`<div class="cabouge" role="group" aria-labelledby="cabouge-titre">
    <p class="cabouge-titre" id="cabouge-titre"><span class="cabouge-point" aria-hidden="true"></span><span>${b.jours === 7 ? 'Ça bouge dans le réseau' : 'Ça bouge ce mois-ci'}</span></p>
    <ul class="cabouge-faits">${b.faits.map((f, i) => html`<li key=${f.cle} class=${'cb-' + f.cle} style=${`--i:${i}`}><span class="cb-ico" aria-hidden="true"><${Icon} name=${ICONES_BOUGE[f.cle]} size=${16}/></span><span>${phraseBouge(f)}</span></li>`)}</ul>
  </div>`;
}

// ---------------------------------------------------------------------------
// « Grâce à toi, Salma a décroché un entretien » : une carte douce (ni bouton plein ni chiffre de points), qui ouvre l'offre.
// ---------------------------------------------------------------------------
export function GraceAToi({ ctx }) {
  const { data, me, store, openOffer, go } = ctx;
  const ev = useMemo(() => graceAToi(data, me), [data.applications, data.placements, data.reactions, data.offers, data.profiles, me.id]);
  if (!ev) return null;
  const o = ev.offre ? store.byId('offers', ev.offre) : null;
  const etu = ev.etudiant ? store.byId('profiles', ev.etudiant) : null;
  if (ev.quoi !== 'interet' && !etu) return null;
  const prenom = (etu?.full_name || '').split(' ')[0];
  return html`<button type="button" class=${'grace g-' + ev.quoi} onClick=${() => (o ? openOffer(o.id) : go('espace'))}>
    <span class="grace-visage" aria-hidden="true">${etu ? html`<${Avatar} p=${etu} size=${40}/>` : html`<span class="grace-tuile"><${Icon} name="bookmark" size=${20}/></span>`}<span class="grace-coeur"><${Icon} name="heart" size=${16}/></span></span>
    <span class="grace-txt"><strong>${phraseGrace(ev, prenom)}</strong>${o ? html`<span class="grace-sous"><span class="grace-offre" translate="no" dir="auto">${titreOffre(o)}</span>${ev.at ? html`<span class="grace-quand">${timeAgo(ev.at)}</span>` : null}</span>` : null}</span>
    <span class="grace-go" aria-hidden="true"><${Icon} name="arrow" size=${16}/></span>
  </button>`;
}

// Où se passe une offre, dans la langue de l'écran : « Meknès » ou « مكناس », le pays seulement hors du Maroc
export const lieuOffre = o => {
  const l = getLang();
  const pays = o.pays && canonPays(o.pays) !== 'Maroc' ? (l === 'ar' && PAYS_AR[canonPays(o.pays)]) || o.pays : '';
  return [villeAffichee(o.ville, l), pays].filter(Boolean).join(l === 'ar' ? '، ' : ', ');
};

// ---------------------------------------------------------------------------
// La carte devient la fiche : son logo et son titre glissent jusqu'à leur place dans la fenêtre (View Transitions).
// Sans l'API, ou quand moins de mouvement est demandé : la fiche s'ouvre comme avant (son propre fondu).
// ---------------------------------------------------------------------------
export function ouvrirEnDouceur(carte, ouvrir) {
  const racine = document.documentElement;
  if (!carte || typeof document.startViewTransition !== 'function' || mouvementReduit() || racine.classList.contains('vt-offre')) { ouvrir(); return; }
  const logo = carte.querySelector('.clogo'), titre = carte.querySelector('.ocard-title, .opart-titre');
  const nommer = n => { if (logo) logo.style.viewTransitionName = n ? 'vt-logo' : ''; if (titre) titre.style.viewTransitionName = n ? 'vt-titre' : ''; };
  nommer(true); racine.classList.add('vt-offre');
  const finir = () => { racine.classList.remove('vt-offre'); carte.classList.remove('vt-source'); };
  try {
    const t = document.startViewTransition(() => new Promise(ok => { nommer(false); carte.classList.add('vt-source'); ouvrir(); setTimeout(ok, 0); }));
    t.ready.catch(() => {});   // transition sautée (onglet caché, noms en double) : la fiche s'ouvre quand même
    t.finished.then(finir, finir);
  } catch { nommer(false); finir(); ouvrir(); }
}

// ---------------------------------------------------------------------------
// La forme des cartes d'offres, le temps que la liste arrive (mêmes blocs .sq que l'accueil qui charge)
// ---------------------------------------------------------------------------
export const SqCartes = ({ n = 4 }) => [
  html`<span class="sr-only" role="status" key="st">Chargement des offres…</span>`,
  ...Array.from({ length: n }, (_, i) => html`<div class="sq-carte" key=${i} aria-hidden="true">
    <span class="sq-tete"><span class="sq sq-logo"></span><span class="sq-col"><span class="sq sq-ligne court"></span><span class="sq sq-ligne mini"></span></span></span>
    <span class="sq sq-titre-carte"></span><span class="sq sq-ligne"></span>
    <span class="sq-puces"><span class="sq sq-puce"></span><span class="sq sq-puce"></span></span>
  </div>`),
];

const ETUDIANTS = ['طالب واحد', 'طالبان', 'طلاب', 'طالبًا'];
const LAU = ['خريج واحد', 'خريجان', 'خريجين', 'خريجًا'];
const DECROCHE_AR = { 'son stage': 'في التدريب', 'son PFE': 'في مشروع نهاية الدراسة', 'son stage à l’étranger': 'في التدريب بالخارج', 'son poste': 'في الوظيفة' };
addAR({
  'Ça bouge dans le réseau': 'الشبكة في حركة', 'Ça bouge ce mois-ci': 'الشبكة في حركة هذا الشهر',
  '1 nouvelle offre': 'عرض جديد', '1 réponse': 'رد واحد', '1 nouveau membre': 'عضو جديد', '1 candidature': 'ترشيح واحد',
  'Nouvelle': 'جديد', 'Rémunéré': 'مدفوع الأجر', 'Chargement des offres…': 'جارٍ تحميل العروض…',
}, [
  [/^(\d+) nouvelles offres$/, n => arCount(n, ['عرض جديد', 'عرضان جديدان', 'عروض جديدة', 'عرضًا جديدًا'])],
  [/^(\d+) réactions$/, n => arCount(n, ['تفاعل واحد', 'تفاعلان', 'تفاعلات', 'تفاعلًا'])],
  [/^(\d+) réponses$/, n => arCount(n, ['رد واحد', 'ردّان', 'ردود', 'ردًّا'])],
  [/^(\d+) nouveaux membres$/, n => arCount(n, ['عضو جديد', 'عضوان جديدان', 'أعضاء جدد', 'عضوًا جديدًا'])],
  [/^(\d+) candidatures$/, n => arCount(n, ['ترشيح واحد', 'ترشيحان', 'ترشيحات', 'ترشيحًا'])],
  [/^(\d+) étudiants l’ont mise de côté$/, n => `حفظ هذا العرض ${arCount(n, ETUDIANTS)}`],
  [/^(\d+) lauréats l’ont mise de côté$/, n => `حفظ هذا العرض ${arCount(n, LAU)}`],
  [/^(\d+) étudiants ont mis ton offre de côté$/, n => `حفظ عرضك ${arCount(n, ETUDIANTS)}`],
  [/^Grâce à toi, (.+) a décroché un entretien$/, x => `بفضلك، تمت دعوة ${x} إلى مقابلة`],
  [/^Grâce à toi, (.+) a décroché (son stage à l’étranger|son stage|son PFE|son poste)$/, (x, q) => `بفضلك، تم قبول ${x} ${DECROCHE_AR[q]}`],
  [/^Grâce à toi, (.+) a décroché sa place$/, x => `بفضلك، تم قبول ${x}`],
]);
