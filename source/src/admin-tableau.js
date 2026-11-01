// Console d'administration · Tableau de bord : l'objectif du plan, les chiffres de la semaine (une courbe de 8 semaines chacun),
// où sont les membres (promo × parcours), ce qui s'est passé, ceux qui aident le plus. Les graphiques sont dessinés à la main
// (SVG et tableau), lisibles sans couleur : chaque valeur est écrite, ou dite au lecteur d'écran.
import { html } from './vendor/preact-htm.js';
import { Icon, Person, Bar, Compteur, injectCSS } from './ui.js';
import { addAR, arCount } from './i18n.js';
import { objectifPlan, serieHebdo, ecartHebdo, actifsParSemaine, aidesDuReseau, topAidants, evenementsReseau, repartitionMembres,
  reponses48h, parcoursInscription, compteOuvert, pct, timeAgo } from './logic.js';

addAR({
  'Objectif du plan': 'هدف الخطة', 'Période terminée': 'انتهت الفترة', 'Dernier jour pour y arriver.': 'آخر يوم لبلوغه.',
  'La période de l’objectif est terminée. Les chiffres restent ici.': 'انتهت فترة الهدف. تبقى الأرقام هنا.',
  'Matchs': 'التوافقات', 'Aides acceptées': 'المساعدات المقبولة', 'Atteint': 'تحقق',
  'Depuis le lancement de la plateforme. Une aide acceptée : un lauréat propose son aide sur une demande, et l’étudiant l’accepte.': 'منذ إطلاق المنصة. المساعدة المقبولة: يقترح خريج مساعدته على طلب، ويقبلها الطالب.',
  'Le réseau en chiffres': 'الشبكة بالأرقام', 'Chaque chiffre : les 7 derniers jours, comparés aux 7 d’avant, et sa courbe sur 8 semaines.': 'كل رقم: آخر 7 أيام، مقارنة بالسبعة التي قبلها، ومنحناه على 8 أسابيع.',
  'Nouveaux membres': 'أعضاء جدد', 'Aides données': 'المساعدات المقدَّمة', 'par rapport à la semaine d’avant': 'مقارنة بالأسبوع السابق',
  'Pas encore d’aide cette semaine': 'لا مساعدة بعد هذا الأسبوع',
  'Où sont les membres': 'أين يوجد الأعضاء', 'Par promo et par parcours': 'حسب الدفعة والمسار', 'Membres par promo et par parcours': 'الأعضاء حسب الدفعة والمسار',
  'Prépa': 'التحضيري', 'Total': 'المجموع', 'Plus': 'أكثر', 'Sans promo': 'دون دفعة',
  'Ceux qui aident le plus': 'الأكثر مساعدة', '30 derniers jours': 'آخر 30 يومًا', 'Pas encore d’aide ces 30 derniers jours.': 'لا مساعدة بعد خلال آخر 30 يومًا.',
  'Une aide : un rendez-vous de mentorat fait, un CV relu, un recrutement confirmé, ou une aide acceptée par l’étudiant.': 'المساعدة: جلسة إرشاد تمّت، أو سيرة ذاتية روجعت، أو توظيف مؤكَّد، أو مساعدة قبلها الطالب.',
  'Ce qui s’est passé': 'ما حدث مؤخرًا', 'Rien de nouveau pour l’instant.': 'لا جديد حاليًا.',
  'a rejoint le réseau': 'انضم إلى الشبكة', 'a publié une offre': 'نشر عرضًا', 'a publié une demande': 'نشر طلبًا', 'a proposé son aide': 'اقترح مساعدته',
  'a demandé un conseil': 'طلب نصيحة', 'a un match avec': 'لديه توافق مع', 'a confirmé son recrutement': 'أكّد توظيفه', 'a confirmé son recrutement chez': 'أكّد توظيفه في',
  'a publié un événement': 'نشر حدثًا', 'Un membre': 'عضو', '1 lauréat a aidé': 'ساعد خريج واحد',
}, [
  [/^(\d+) lauréats ont aidé$/, n => `ساعد ${arCount(n, ['خريج واحد', 'خريجان', 'خريجين', 'خريجًا'])}`],
  [/^Encore (\d+) jours pour y arriver\.$/, n => `بقي ${arCount(n, ['يوم واحد', 'يومان', 'أيام', 'يومًا'])} لبلوغه.`],
  [/^Encore (\d+)$/, n => `بقي ${n}`],
  [/^8 dernières semaines : ([\d, ]+)$/, l => `آخر 8 أسابيع: ${l}`],
  [/^(\d+) en tout$/, n => `${n} في المجموع`],
  [/^(\d+) cette semaine$/, n => `${n} هذا الأسبوع`],
  [/^(\d+) aides? pour (\d+) étudiants?$/, (a, e) => `${arCount(a, ['مساعدة واحدة', 'مساعدتان', 'مساعدات', 'مساعدة'])} لـ${arCount(e, ['طالب واحد', 'طالبين', 'طلبة', 'طالبًا'])}`],
  [/^Promos (\d{4})–(\d{4})$/, (a, b) => `دفعات ${a}–${b}`],
  [/^Avant (\d{4})$/, a => `قبل ${a}`],
]);

// ---------------------------------------------------------------------------
// Objectif du plan : quatre barres « n / cible », les jours qui restent
// ---------------------------------------------------------------------------
const LIBELLES_OBJ = { demandes: 'Demandes', offres: 'Offres', matchs: 'Matchs', aides: 'Aides acceptées' };
export function ObjectifPlan({ data, now = new Date() }) {
  const o = objectifPlan(data, now);
  const fin = new Date(o.fin + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  return html`<div class="panel cs-objectif" id="adm-objectif">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="trophy"/> Objectif du plan</h2>
      <span class=${'tag ' + (o.fini ? 'done' : 'entre')}>${o.fini ? 'Période terminée' : `Jusqu’au ${fin}`}</span></div>
    <p class="cs-obj-quand">${o.fini ? 'La période de l’objectif est terminée. Les chiffres restent ici.' : o.jours > 1 ? `Encore ${o.jours} jours pour y arriver.` : 'Dernier jour pour y arriver.'}</p>
    <ul class="cs-obj">${o.lignes.map(l => html`<li key=${l.k} data-k=${l.k}>
      <span class="cs-obj-l">${LIBELLES_OBJ[l.k]}</span>
      <span class="cs-obj-n"><strong>${l.n}</strong> / ${l.cible}</span>
      <span class="cs-obj-bar"><${Bar} value=${l.n / l.cible}/></span>
      ${l.atteint ? html`<span class="cs-obj-ok"><${Icon} name="check" size=${16}/> Atteint</span>` : html`<span class="cs-obj-reste">${`Encore ${l.reste}`}</span>`}
    </li>`)}</ul>
    <p class="small muted">Depuis le lancement de la plateforme. Une aide acceptée : un lauréat propose son aide sur une demande, et l’étudiant l’accepte.</p>
  </div>`;
}

// ---------------------------------------------------------------------------
// Une courbe de 8 semaines : un trait de 2 px, un lavis léger, la semaine en cours marquée d'un point orange.
// Le temps va de gauche à droite, en arabe aussi ; les valeurs sont dites au lecteur d'écran (et au survol).
// ---------------------------------------------------------------------------
const H = 36;
export function Sparkline({ serie }) {
  const n = serie.length, max = Math.max(1, ...serie);
  const x = i => (n > 1 ? (i * 100) / (n - 1) : 100);
  const y = v => 4 + (H - 8) * (1 - v / max);
  const pts = serie.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`);
  const dit = `8 dernières semaines : ${serie.join(', ')}`;
  return html`<span class="cs-spark" dir="ltr" role="img" aria-label=${dit} title=${dit}>
    <svg viewBox=${`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <line class="cs-spark-base" x1="0" y1=${H - 2} x2="100" y2=${H - 2}/>
      <path class="cs-spark-aire" d=${`M0,${H - 2} L${pts.join(' L')} L100,${H - 2} Z`}/>
      <polyline class="cs-spark-ligne" points=${pts.join(' ')}/>
    </svg>
    <span class="cs-spark-pt" style=${`top:calc(${((y(serie[n - 1] || 0) / H) * 100).toFixed(2)}% - 4px)`}></span>
  </span>`;
}

// L'écart avec la semaine d'avant : signé, une flèche et sa couleur (plus = bien), et ce à quoi on compare
function Ecart({ serie }) {
  const { delta } = ecartHebdo(serie);
  const sens = delta > 0 ? 'hausse' : delta < 0 ? 'baisse' : 'egal';
  return html`<span class="cs-ecart"><span class=${'cs-delta ' + sens}>${delta ? html`<${Icon} name="arrow" size=${16}/>` : null}${delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : '='}</span>
    <span class="cs-delta-l">par rapport à la semaine d’avant</span></span>`;
}

function Tuile({ label, serie, sous, cls = '' }) {
  const v = serie[serie.length - 1] || 0;
  return html`<div class=${'kpi cs-tuile ' + cls}>
    <span class="kpi-label">${label}</span>
    <span class="kpi-val"><${Compteur} v=${v}/></span>
    <${Ecart} serie=${serie}/>
    <${Sparkline} serie=${serie}/>
    ${sous ? html`<span class="small muted">${sous}</span>` : null}
  </div>`;
}

export function KpisPilotage({ ctx, comptes, now = new Date() }) {
  const { data, saison } = ctx;
  const membres = data.profiles.filter(p => p.role !== 'admin' && !p.admin_ok);
  const etu = membres.filter(p => p.role === 'etudiant').length, lau = membres.filter(p => p.role === 'laureat').length;
  const nouveaux = membres.filter(p => now - new Date(p.created_at) < 7 * 864e5).length;
  const sansProfil = (comptes || []).filter(c => !c.a_profil && compteOuvert(c)).length;
  const r48 = reponses48h(data, now), dm = r48.parType.demande;
  const confirmes = data.placements.filter(p => p.saison === saison && p.status === 'confirme').length;
  const aides = aidesDuReseau(data);
  const aidantsSemaine = new Set(aides.filter(a => { const t = new Date(a.at).getTime(); return t <= now && now - t < 7 * 864e5; }).map(a => a.laureat)).size;
  const s = {
    nouveaux: serieHebdo(membres.map(p => p.created_at), now),
    actifs: actifsParSemaine(data, now),
    demandes: serieHebdo((data.demandes || []).map(d => d.created_at), now),
    offres: serieHebdo(data.offers.map(o => o.created_at), now),
    matchs: serieHebdo((data.matchs || []).map(m => m.created_at), now),
    aides: serieHebdo(aides.map(a => a.at), now),
    recrutes: serieHebdo(data.placements.filter(p => p.status === 'confirme').map(p => p.confirmed_at), now),
  };
  // Pour l'ancien chiffre « Actifs cette semaine » : le même que « Inscriptions : où les gens s'arrêtent »
  const actifs = parcoursInscription(comptes, data, now).actifs;
  const taux = dm.taux === null ? null : dm.taux;
  return html`<section class="cs-chiffres" aria-labelledby="cs-chiffres-t">
    <div class="section-head"><h2 id="cs-chiffres-t" class="h-ico"><${Icon} name="chart"/> Le réseau en chiffres</h2>
      <span class="small muted">Chaque chiffre : les 7 derniers jours, comparés aux 7 d’avant, et sa courbe sur 8 semaines.</span></div>
    <div class="kpis cs-kpis">
      <div class="kpi cs-kpi-une">
        <span class="kpi-label">Demandes aidées en 48 h</span>
        <span class="cs-une"><span class="kpi-val">${taux === null ? '–' : pct(taux)}</span>
          <span class="cs-jauge" aria-hidden="true"><span class="cs-jauge-plein" style=${`width:${Math.round((taux || 0) * 100)}%`}></span><span class="cs-jauge-cible"></span></span></span>
        <span class="small muted">${dm.total ? `${dm.a48} sur ${dm.total} en 30 jours · objectif 8 sur 10${r48.total > dm.total ? ` · toutes aides : ${pct(r48.taux)}` : ''}` : r48.total ? `Pas encore de demande d’étudiant ce mois-ci · toutes aides : ${pct(r48.taux)}` : 'Pas encore de demande d’étudiant ce mois-ci'}</span>
      </div>
      <div class="kpi cs-tuile cs-kpi-rec">
        <span class="kpi-label">Recrutés et confirmés</span>
        <span class="kpi-val"><${Compteur} v=${confirmes}/></span>
        <span class="small muted">cette année, via la plateforme</span>
        <${Sparkline} serie=${s.recrutes}/>
        <span class="small muted">${`${s.recrutes[7]} cette semaine`}</span>
      </div>
      <${Tuile} label="Nouveaux membres" serie=${s.nouveaux} sous=${`${membres.length} membres · ${etu} étudiants · ${lau} lauréats`}/>
      <div class="kpi cs-tuile">
        <span class="kpi-label">Actifs cette semaine</span>
        <span class="kpi-val"><${Compteur} v=${actifs}/></span>
        <${Ecart} serie=${s.actifs}/>
        <${Sparkline} serie=${s.actifs}/>
        <span class="small muted">${`${nouveaux} nouveau${nouveaux > 1 ? 'x' : ''} inscrit${nouveaux > 1 ? 's' : ''}${sansProfil ? ` · ${sansProfil} sans profil` : ''}`}</span>
      </div>
      <${Tuile} label="Demandes" serie=${s.demandes} sous=${`${(data.demandes || []).length} en tout`}/>
      <${Tuile} label="Offres" serie=${s.offres} sous=${`${data.offers.length} en tout`}/>
      <${Tuile} label="Matchs" serie=${s.matchs} sous=${`${(data.matchs || []).length} en tout`}/>
      <${Tuile} label="Aides données" serie=${s.aides} sous=${aidantsSemaine > 1 ? `${aidantsSemaine} lauréats ont aidé` : aidantsSemaine ? '1 lauréat a aidé' : 'Pas encore d’aide cette semaine'}/>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Où sont les membres : promo × parcours, une seule teinte (plus foncé = plus de membres), chaque nombre écrit
// ---------------------------------------------------------------------------
export function OuSontLesMembres({ ctx }) {
  const r = repartitionMembres(ctx.data.profiles, ctx.saison);
  if (!r.lignes.length) return null;
  const groupes = [['etudiants', 'Étudiants'], ['laureats', 'Lauréats']].map(([g, l]) => [g, l, r.lignes.filter(x => x.groupe === g)]).filter(([, , l]) => l.length);
  const totaux = r.colonnes.map((_, j) => r.lignes.reduce((a, l) => a + l.n[j], 0));
  const cellule = v => html`<td class=${v ? 'cs-c' : 'cs-c zero'} style=${v ? `--i:${(v / Math.max(1, r.max)).toFixed(3)}` : null}>${v}</td>`;
  return html`<div class="panel" id="adm-carte">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="people"/> Où sont les membres</h2><span class="small muted">Par promo et par parcours</span></div>
    <div class="cs-carte" role="region" aria-label="Où sont les membres" tabindex="0">
      <table class="cs-chaleur">
        <caption class="sr-only">Membres par promo et par parcours</caption>
        <thead><tr><th scope="col" class="cs-c0">Promo</th>${r.colonnes.map(c => html`<th scope="col" key=${c.code}><span class="cs-long">${c.nom}</span><span class="cs-court" aria-hidden="true">${c.code === 'PREPA' ? 'Prépa' : c.code === 'AUTRE' ? 'Autre' : c.code}</span></th>`)}<th scope="col" class="cs-tot">Total</th></tr></thead>
        ${groupes.map(([g, titre, lignes]) => html`<tbody key=${g}>
          <tr class="cs-gr"><th scope="rowgroup" colspan=${r.colonnes.length + 2}>${titre}</th></tr>
          ${lignes.map(l => html`<tr key=${l.cle}><th scope="row">${l.etiquette}</th>${l.n.map(cellule)}<td class="cs-tot">${l.total}</td></tr>`)}
        </tbody>`)}
        <tfoot><tr><th scope="row">Total</th>${totaux.map(v => html`<td class="cs-tot">${v}</td>`)}<td class="cs-tot">${totaux.reduce((a, b) => a + b, 0)}</td></tr></tfoot>
      </table>
    </div>
    <p class="cs-legende small muted" aria-hidden="true"><span>Moins</span>${[0.15, 0.35, 0.55, 0.75, 1].map(i => html`<i style=${`--i:${i}`}></i>`)}<span>Plus</span></p>
  </div>`;
}

// ---------------------------------------------------------------------------
// Ceux qui aident le plus (30 jours) : pour l'administration seule, jamais montré aux membres
// ---------------------------------------------------------------------------
export function CeuxQuiAident({ ctx, now = new Date() }) {
  const { store, openProfile } = ctx;
  const top = topAidants(ctx.data, now, 30, 8).map(x => ({ ...x, p: store.byId('profiles', x.id) })).filter(x => x.p);
  return html`<div class="panel" id="adm-aidants">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="heart"/> Ceux qui aident le plus</h2><span class="small muted">30 derniers jours</span></div>
    ${top.length ? html`<ol class="people-list cs-top">${top.map((x, i) => html`<li key=${x.id}><span class="cs-rang" aria-hidden="true">${i + 1}</span>
      <${Person} p=${x.p} onOpen=${openProfile} sub=${`${x.p.filiere || ''} · Promo ${x.p.promo}`}/>
      <span class="cs-top-n small">${`${x.aides} aide${x.aides > 1 ? 's' : ''} pour ${x.etudiants} étudiant${x.etudiants > 1 ? 's' : ''}`}</span></li>`)}</ol>`
      : html`<p class="small muted">Pas encore d’aide ces 30 derniers jours.</p>`}
    <p class="small muted">Une aide : un rendez-vous de mentorat fait, un CV relu, un recrutement confirmé, ou une aide acceptée par l’étudiant.</p>
  </div>`;
}

// ---------------------------------------------------------------------------
// Ce qui s'est passé : les 15 derniers gestes du réseau, chacun avec son lien
// ---------------------------------------------------------------------------
const SORTES = {
  membre: ['user', 'a rejoint le réseau'], offre: ['feed', 'a publié une offre'], demande: ['send', 'a publié une demande'],
  aide: ['heart', 'a proposé son aide'], mentorat: ['mentor', 'a demandé un conseil'], match: ['spark', 'a un match avec'],
  recrutement: ['briefcase', 'a confirmé son recrutement'], evenement: ['calendar', 'a publié un événement'],
};
export function CeQuiSestPasse({ ctx }) {
  const { store, openProfile, openOffer, go } = ctx;
  const ev = evenementsReseau(ctx.data, 15);
  const nom = id => {
    const p = id && store.byId('profiles', id);
    return p ? html`<button type="button" class="linkish" translate="no" dir="auto" onClick=${() => openProfile(p)}>${p.full_name}</button>` : html`<span>Un membre</span>`;
  };
  const titre = e => {
    if (!e.titre) return null;
    const ouvrir = e.sorte === 'offre' ? (store.byId('offers', e.id) ? () => openOffer(e.id) : null)
      : e.sorte === 'demande' || e.sorte === 'aide' ? () => go('offres/demandes/' + e.id)
      : e.sorte === 'mentorat' ? () => go('mentorat') : e.sorte === 'evenement' ? () => go('reseau/agenda/' + e.id) : null;
    return ouvrir ? html`<button type="button" class="linkish cs-fil-titre" translate="no" dir="auto" onClick=${ouvrir}>${e.titre}</button>` : html`<span class="cs-fil-titre" translate="no" dir="auto">${e.titre}</span>`;
  };
  return html`<div class="panel" id="adm-fil">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="clock"/> Ce qui s’est passé</h2></div>
    ${ev.length ? html`<ul class="cs-fil">${ev.map(e => { const [ic, phrase] = SORTES[e.sorte]; return html`<li key=${e.sorte + e.id} data-sorte=${e.sorte}>
      <span class="n-ico accent" aria-hidden="true"><${Icon} name=${ic} size=${16}/></span>
      <span class="cs-fil-txt">${nom(e.qui)} <span>${e.sorte === 'recrutement' && e.titre ? 'a confirmé son recrutement chez' : phrase}</span>${' '}${e.sorte === 'match' ? nom(e.avec)
        : e.sorte === 'recrutement' ? (e.titre ? html`<span translate="no" dir="auto">${e.titre}</span>` : null) : titre(e)}</span>
      <span class="small muted cs-fil-quand">${timeAgo(e.at)}</span></li>`; })}</ul>`
      : html`<p class="small muted">Rien de nouveau pour l’instant.</p>`}
  </div>`;
}

injectCSS('admin-tableau', `
/* Objectif du plan : une ligne par cible (le libellé, n / cible, la barre, ce qui reste) */
.cs-obj-quand { margin: 0; font-weight: 600; color: var(--ink); }
.cs-obj { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(7.5rem, auto) auto minmax(80px, 1fr) minmax(5.5rem, auto); gap: .55rem .9rem; align-items: center; }
.cs-obj li { display: contents; }
.cs-obj-l { font-weight: 600; }
.cs-obj-n { font-variant-numeric: tabular-nums; color: var(--ink-2); white-space: nowrap; }
.cs-obj-n strong { font: 750 var(--fs-5)/1 var(--f-display); color: var(--ink); }
.cs-obj-bar .bar { margin: 0; }
.cs-obj-ok { display: inline-flex; align-items: center; gap: .3rem; color: var(--good); font-weight: 650; font-size: var(--fs-2); }
.cs-obj-reste { font-size: var(--fs-2); color: var(--muted); }
/* Étroit : chaque cible sur trois lignes (le libellé et n / cible, la barre, ce qui reste) */
@container cs (max-width: 560px) {
  .cs-obj { display: flex; flex-direction: column; align-items: stretch; gap: .85rem; }
  .cs-obj li { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "l n" "b b" "r r"; gap: .3rem .8rem; align-items: baseline; }
  .cs-obj-l { grid-area: l; } .cs-obj-n { grid-area: n; } .cs-obj-bar { grid-area: b; } :is(.cs-obj-ok, .cs-obj-reste) { grid-area: r; }
}
/* Les chiffres : une tuile en vedette (les demandes aidées en 48 h), les recrutements, puis six tuiles de la semaine */
.cs-chiffres { display: flex; flex-direction: column; gap: .6rem; min-width: 0; }
.cs-chiffres > .section-head { margin-top: 0; }
.kpis.cs-kpis { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.cs-kpis > .kpi { grid-column: span 2; }
.cs-kpis > .cs-kpi-une { grid-column: span 4; background: var(--accent-soft); box-shadow: none; }
.cs-kpi-une .kpi-label { color: var(--sel-ink); }
.cs-une { display: flex; align-items: center; gap: 1rem; min-width: 0; }
.cs-une .kpi-val { font-size: 2.4rem; }
.cs-jauge { position: relative; flex: 1; height: 10px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--accent) 16%, var(--surface)); }
.cs-jauge-plein { position: absolute; inset-block: 0; inset-inline-start: 0; border-radius: inherit; background: var(--accent); }
.cs-jauge-cible { position: absolute; top: -4px; bottom: -4px; inset-inline-start: 80%; width: 2px; border-radius: 1px; background: var(--ink); }
.cs-tuile .kpi-val { font-size: 1.75rem; }
.cs-ecart { display: flex; flex-wrap: wrap; align-items: baseline; gap: .1rem .4rem; font-size: var(--fs-1); color: var(--muted); }
.cs-delta { display: inline-flex; align-items: center; gap: .15rem; font: 700 var(--fs-2)/1.2 var(--f-body); font-variant-numeric: tabular-nums; }
.cs-delta .ico, [dir="rtl"] .cs-delta .ico { transform: rotate(-90deg); }
.cs-delta.baisse .ico, [dir="rtl"] .cs-delta.baisse .ico { transform: rotate(90deg); }
.cs-delta.hausse { color: var(--good); } .cs-delta.baisse { color: var(--warn); } .cs-delta.egal { color: var(--muted); }
@container cs (max-width: 620px) {
  .kpis.cs-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cs-kpis > .kpi { grid-column: span 1; }
  .cs-kpis > :is(.cs-kpi-une, .cs-kpi-rec) { grid-column: span 2; }
  .cs-une .kpi-val { font-size: 2rem; }
}
/* La courbe : trait de 2 px, lavis à 10 %, ligne de base fine ; le point orange (semaine en cours) cerclé du fond */
.cs-spark { position: relative; display: block; height: ${H}px; margin-block: .3rem .1rem; }
.cs-spark svg { display: block; width: 100%; height: 100%; overflow: visible; }
.cs-spark-base { stroke: var(--line); stroke-width: 1; vector-effect: non-scaling-stroke; }
.cs-spark-aire { fill: color-mix(in srgb, var(--s1) 10%, transparent); }
.cs-spark-ligne { fill: none; stroke: var(--s1); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
.cs-spark-pt { position: absolute; right: -4px; width: 8px; height: 8px; border-radius: 50%; background: var(--s2); box-shadow: 0 0 0 2px var(--surface); }
/* Où sont les membres : une teinte, du clair au foncé ; le texte reste lisible (foncé plafonné, jour et nuit) */
.cs-carte { overflow-x: auto; min-width: 0; border-radius: var(--r-md); }
.cs-carte:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cs-chaleur { --cmax: 68%; width: 100%; border-collapse: separate; border-spacing: 3px; font-size: var(--fs-2); font-variant-numeric: tabular-nums; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .cs-chaleur, :root:not([data-theme="light"]) .cs-legende { --cmax: 52%; } }
:root[data-theme="dark"] :is(.cs-chaleur, .cs-legende) { --cmax: 52%; }
.cs-chaleur th { font-weight: 600; color: var(--muted); text-align: center; padding: .3rem .35rem; line-height: 1.25; }
.cs-chaleur thead th { vertical-align: bottom; font-size: var(--fs-1); }
.cs-chaleur th[scope="row"] { text-align: start; color: var(--ink-2); white-space: nowrap; }
.cs-chaleur .cs-gr th { text-align: start; padding-top: .6rem; color: var(--ink); font-weight: 650; }
.cs-chaleur td { text-align: center; padding: .42rem .3rem; border-radius: 6px; min-width: 2.4rem; }
.cs-c { background: color-mix(in srgb, var(--s1) calc(var(--i) * var(--cmax)), var(--surface)); color: var(--ink); font-weight: 600; }
.cs-c.zero { background: var(--surface-2); color: var(--muted); font-weight: 500; }
.cs-chaleur .cs-tot { color: var(--ink-2); font-weight: 650; }
.cs-chaleur tfoot th, .cs-chaleur tfoot td { border-top: 1px solid var(--line); }
.cs-court { display: none; }
@container cs (max-width: 700px) {
  .cs-long { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .cs-court { display: inline; }
}
.cs-legende { --cmax: 68%; display: flex; align-items: center; gap: 3px; margin: 0; }
.cs-legende span { margin-inline: .2rem; }
.cs-legende i { width: 22px; height: 12px; border-radius: 3px; background: color-mix(in srgb, var(--s1) calc(var(--i) * var(--cmax)), var(--surface)); box-shadow: inset 0 0 0 1px var(--line); }
/* Ceux qui aident le plus : le rang, la personne, ses aides */
.cs-top li { gap: .6rem; }
.cs-rang { flex: none; width: 1.6rem; text-align: center; font: 700 var(--fs-3)/1 var(--f-display); color: var(--muted); font-variant-numeric: tabular-nums; }
.cs-top .person { flex: 1 1 auto; min-width: 0; }
.cs-top-n { flex: none; margin-inline-start: auto; color: var(--ink-2); font-weight: 600; text-align: end; }
@container cs (max-width: 480px) { .cs-top li { flex-wrap: wrap; } .cs-top-n { flex-basis: 100%; padding-inline-start: 2.2rem; text-align: start; } }
/* Ce qui s'est passé : une ligne par geste, le moment au bout */
.cs-fil { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.cs-fil li { display: flex; align-items: flex-start; gap: .6rem; padding-block: .55rem; border-top: 1px solid var(--line); }
.cs-fil li:first-child { border-top: 0; padding-top: 0; }
.cs-fil-txt { flex: 1; min-width: 0; line-height: 1.45; overflow-wrap: anywhere; color: var(--ink-2); padding-top: .2rem; }
.cs-fil-txt .linkish { font-weight: 600; }
.cs-fil-titre { font-weight: 500 !important; color: var(--ink); }
.cs-fil-quand { flex: none; padding-top: .25rem; white-space: nowrap; }
@container cs (max-width: 480px) { .cs-fil li { flex-wrap: wrap; } .cs-fil-quand { flex-basis: 100%; padding-inline-start: calc(30px + .6rem); padding-top: 0; } }
/* Deux colonnes quand la place le permet : ce qui s'est passé, ceux qui aident */
.cs-deux { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.25rem; align-items: start; }
@container cs (min-width: 860px) { .cs-deux { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); } }
@media (prefers-reduced-motion: no-preference) { .cs-jauge-plein { transition: width .4s var(--ease-out, ease); } }
`);
