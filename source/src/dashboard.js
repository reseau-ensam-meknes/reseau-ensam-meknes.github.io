// Tableau de bord de suivi : qui a trouvé quoi, par niveau, filière et saison,
// puis l'insertion des diplômés (enquête à 6 et 12 mois) avec le rapport exportable de l'administration.
import { html, useState, useMemo, useEffect } from './vendor/preact-htm.js';
import { Icon, Bar, Person, Tabs, Num, injectCSS, toast } from './ui.js';
import { seasonStats, monthlyActivity, seasonLabel, NIVEAUX, pct, OBJECTIFS, statutOf, FOUND, niveauOf, enqueteDue, SITUATIONS, SALAIRES, CANAUX } from './logic.js';
import { CompanyLogo } from './ui.js';
import { addAR, arCount } from './i18n.js';
import { PoulsReseau } from './pouls.js';
import { SuccessFeed } from './growth.js';
import { useStatsInsertion, tauxInsertion, KpisInsertion, virgule } from './enquete.js';

export function DashboardPage(ctx) {
  if (ctx.sub === 'insertion') return html`<${InsertionPage} ctx=${ctx}/>`;
  if (ctx.me.role === 'etudiant') return html`<${PromoPage} ctx=${ctx}/>`;
  return html`<${SeasonPage} ctx=${ctx}/>`;
}

// Placement / Insertion : deux vues du même onglet
function SuiviSeg({ ctx, on }) {
  const etu = ctx.me.role === 'etudiant';
  return html`<div class="seg suivi-seg ins-noprint" role="tablist">
    <button role="tab" aria-selected=${on === 'placement'} class=${on === 'placement' ? 'on' : ''} onClick=${() => ctx.go('suivi')}><${Icon} name=${etu ? 'people' : 'chart'} size=${15}/> ${etu ? 'Ma promo' : 'Placement'}</button>
    <button role="tab" aria-selected=${on === 'insertion'} class=${on === 'insertion' ? 'on' : ''} onClick=${() => ctx.go('suivi/insertion')}><${Icon} name="briefcase" size=${15}/> ${etu ? 'Après le diplôme' : 'Insertion des diplômés'}</button>
  </div>`;
}

function SeasonPage({ ctx }) {
  const { data, saison: cur, me, openProfile } = ctx;
  const seasons = useMemo(() => [...new Set([cur, ...data.placements.map(p => p.saison)])].sort((a, b) => b - a), [data, cur]);
  const [saison, setSaison] = useState(cur);
  const [niv, setNiv] = useState(5);
  const now = saison === cur ? new Date() : OBJECTIFS[3].deadline(saison);
  const st = useMemo(() => seasonStats(data, saison, now), [data, saison]);
  const months = useMemo(() => monthlyActivity(data, 12), [data]);
  const totalPop = st.rows.reduce((a, r) => a + r.total, 0);
  const totalFound = st.rows.reduce((a, r) => a + r.found, 0);
  const pendingAll = st.rows.reduce((a, r) => a + r.pending, 0);
  const openOffers = data.offers.filter(o => o.status === 'ouverte').length;
  const row = st.rows.find(r => r.n === niv);
  const canSeeNames = me.role !== 'etudiant';

  return html`<section class="page">
    <header class="page-head">
      <div><p class="eyebrow">Suivi de placement</p><h1>Tableau de bord</h1></div>
      <label class="season-pick">Saison <select id="dash-season" value=${saison} onChange=${e => setSaison(+e.target.value)}>${seasons.map(s => html`<option value=${s}>${seasonLabel(s)}${s === cur ? ' (en cours)' : ''}</option>`)}</select></label>
    </header>
    <${SuiviSeg} ctx=${ctx} on="placement"/>

    <div class="kpis">
      <div class="kpi"><span class="kpi-label">Ont trouvé</span><span class="kpi-val mono"><${Num} v=${totalFound}/><small>/${totalPop}</small></span><span class="small muted">${pct(totalPop ? totalFound / totalPop : 0)} des inscrits 3A, 4A, 5A et jeunes diplômés</span></div>
      <div class="kpi"><span class="kpi-label">Grâce à la plateforme</span><span class="kpi-val mono"><${Num} v=${st.viaTotal}/></span><span class="small muted">${pct(st.totalFound ? st.viaTotal / st.totalFound : 0)} des réussites, vérifiées des deux côtés</span></div>
      <div class="kpi"><span class="kpi-label">À confirmer</span><span class="kpi-val mono"><${Num} v=${pendingAll}/></span><span class="small muted">recrutés, attendent la confirmation de l’étudiant</span></div>
      <div class="kpi"><span class="kpi-label">Offres ouvertes</span><span class="kpi-val mono"><${Num} v=${openOffers}/></span><span class="small muted">publiées par ${new Set(data.offers.filter(o => o.status === 'ouverte').map(o => o.author_id)).size} lauréats</span></div>
    </div>

    <div class="niv-grid">${st.rows.map(r => {
      const pace = r.elapsed; const gap = r.rate - pace;
      const tone = r.rate >= 0.999 ? 'good' : r.daysLeft < 0 ? (r.rate >= 0.9 ? 'good' : 'bad') : gap >= -0.05 ? 'good' : gap >= -0.25 ? 'warn' : 'bad';
      const toneTxt = r.rate >= 0.999 ? 'Objectif atteint' : r.daysLeft < 0 ? 'Saison terminée' : tone === 'good' ? 'Dans les temps' : tone === 'warn' ? 'À surveiller' : 'En retard';
      return html`<button class=${'niv-card' + (niv === r.n ? ' on' : '')} onClick=${() => setNiv(r.n)} aria-pressed=${niv === r.n}>
        <div class="niv-top"><span class="niv-badge">${NIVEAUX[r.n].short}</span><span class=${'status s-' + tone}><span class="sdot"></span>${toneTxt}</span></div>
        <strong class="niv-obj">${r.objectif.titre}</strong>
        <div class="niv-num"><span class="mono big">${pct(r.rate)}</span><span class="muted small">${r.found} sur ${r.total}${r.pending ? ` · ${r.pending} à confirmer` : ''}</span></div>
        <${Bar} value=${r.rate} pace=${r.daysLeft >= 0 ? pace : undefined} label=${`${pct(r.rate)} ont trouvé`}/>
        <span class="small muted">${r.daysLeft >= 0 ? `Échéance ${r.end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · J-${r.daysLeft}` : `Échéance passée (${r.end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })})`} · ${r.via} via la plateforme</span>
      </button>`;
    })}</div>
    <p class="legend small muted"><span class="lg-fill"></span> part des étudiants qui ont trouvé <span class="lg-pace"></span> rythme attendu à cette date (temps écoulé vers l’échéance)</p>
    <${SuccessFeed} ctx=${ctx} max=${5} lien=${false}/>

    <div class="two-col">
      <div class="panel">
        <div class="section-head"><h2>Par filière</h2><span class="muted small">${NIVEAUX[niv].label} · ${row.objectif.court}</span></div>
        <table class="tbl heat"><thead><tr><th>Filière</th><th class="num">Trouvé</th><th>Progression</th></tr></thead><tbody>
          ${row.byFiliere.map(f => html`<tr><td>${f.filiere}</td><td class="num mono">${f.found}/${f.total}</td><td class="bar-cell"><${Bar} value=${f.total ? f.found / f.total : 0}/></td></tr>`)}
        </tbody></table>
      </div>
      <div class="panel">
        <div class="section-head"><h2>Encore en recherche</h2><span class="muted small">${row.searching.length} · ${NIVEAUX[niv].short}</span></div>
        ${canSeeNames ? html`<p class="muted small">Un message ou une offre ciblée peut tout changer pour eux.</p>
          <ul class="people-list">${row.searching.slice(0, 12).map(p => { const s = statutOf(data, p, saison); return html`<li><${Person} p=${p} onOpen=${openProfile} size=${30}/><span class=${'state-pill s-' + s.key}>${s.label}</span></li>`; })}</ul>
          ${row.searching.length > 12 ? html`<p class="small muted">et ${row.searching.length - 12} autres (voir la Vitrine des talents dans Communauté).</p>` : null}`
        : html`<p class="muted">${row.searching.length} étudiant${row.searching.length > 1 ? 's' : ''} de ${NIVEAUX[niv].short} cherchent encore. Les lauréats voient la liste des profils ouverts dans la Vitrine des talents pour leur proposer des offres.</p>`}
      </div>
    </div>

    <div class="panel">
      <div class="section-head"><h2>Activité des 12 derniers mois</h2>
        <span class="legend small"><span class="sw s1"></span> Offres publiées <span class="sw s2"></span> Réussites confirmées par un lauréat</span></div>
      <${MonthChart} months=${months}/>
    </div>

    <div class="two-col">
      <div class="panel"><div class="section-head"><h2>Destinations à l’étranger</h2><span class="muted small">${seasonLabel(saison)}</span></div>
        ${st.countries.length ? html`<ol class="rank">${st.countries.slice(0, 6).map(([c, k]) => html`<li><span>${c}</span><span class="mono">${k}</span></li>`)}</ol>` : html`<p class="muted">Aucun départ à l’étranger déclaré pour l’instant.</p>`}</div>
      <div class="panel"><div class="section-head"><h2>Entreprises qui accueillent</h2><span class="muted small">${seasonLabel(saison)}</span></div>
        <ol class="rank">${st.companies.slice(0, 6).map(([c, k]) => html`<li><span translate="no" dir="auto">${c}</span><span class="mono">${k}</span></li>`)}</ol></div>
    </div>
    ${me.role === 'admin' ? html`<${ExportBox} data=${data} saison=${saison} rows=${st.rows}/>` : null}
  </section>`;
}

function MonthChart({ months }) {
  const W = 720, H = 220, L = 34, B = 26, T = 12;
  const max = Math.max(4, ...months.flatMap(m => [m.offres, m.placements]));
  const step = max <= 8 ? 2 : max <= 20 ? 5 : 10;
  const top = Math.ceil(max / step) * step;
  const y = v => T + (H - T - B) * (1 - v / top);
  const gw = (W - L) / months.length, bw = Math.min(16, gw / 3.2);
  const ticks = []; for (let v = 0; v <= top; v += step) ticks.push(v);
  return html`<div class="chart-wrap" tabindex="0" role="region" aria-label="Graphique : offres et réussites par mois"><svg viewBox=${`0 0 ${W} ${H}`} class="chart" role="img" aria-label="Offres publiées et réussites confirmées par mois">
    ${ticks.map(v => html`<g><line x1=${L} x2=${W} y1=${y(v)} y2=${y(v)} class="grid"/><text x=${L - 6} y=${y(v) + 4} class="axis" text-anchor="end">${v}</text></g>`)}
    ${months.map((m, i) => { const x = L + i * gw + gw / 2; return html`<g>
      <rect x=${x - bw - 1} y=${y(m.offres)} width=${bw} height=${Math.max(0, y(0) - y(m.offres))} rx="3" class="s1"><title>${m.label} : ${m.offres} offres publiées</title></rect>
      <rect x=${x + 1} y=${y(m.placements)} width=${bw} height=${Math.max(0, y(0) - y(m.placements))} rx="3" class="s2"><title>${m.label} : ${m.placements} réussites confirmées</title></rect>
      <text x=${x} y=${H - 8} class="axis" text-anchor="middle">${m.label}</text></g>`; })}
  </svg></div>`;
}

function ExportBox({ data, saison, rows }) {
  const [href, setHref] = useState(null);
  const build = () => {
    const lines = [['Nom', 'Niveau', 'Filière', 'Promo', 'Statut', 'Entreprise', 'Ville', 'Pays', 'Source', 'Vérifié']];
    for (const r of rows) for (const p of data.profiles.filter(x => x.role !== 'admin')) {
      const n = r.n; const lvl = (5 - (p.promo - (saison + 1)));
      const pn = lvl <= 5 ? lvl : p.promo === saison ? 6 : 7; if (pn !== n) continue;
      const pl = data.placements.find(x => x.student_id === p.id && x.saison === saison && x.status !== 'refuse');
      lines.push([p.full_name, NIVEAUX[n].short, p.filiere, p.promo, pl ? (FOUND.has(pl.status) ? 'Trouvé' : 'À confirmer') : 'En recherche', pl?.entreprise || '', pl?.ville || '', pl?.pays || '', pl ? (pl.source === 'plateforme' ? 'Plateforme' : 'Autre') : '', pl?.status === 'confirme' ? 'Oui' : '']);
    }
    const csv = '﻿' + lines.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    setHref(URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })));
  };
  return html`<div class="panel"><div class="section-head"><h2>Export administration</h2></div>
    <p class="muted small">Liste complète de la saison (une ligne par étudiant), à ouvrir dans Excel.</p>
    ${href ? html`<a class="btn" href=${href} download=${`suivi-placement-${seasonLabel(saison)}.csv`}><${Icon} name="download"/> Télécharger le fichier CSV</a>` : html`<button class="btn" onClick=${build}>Préparer l’export ${seasonLabel(saison)}</button>`}
  </div>`;
}

// Vue étudiant : seulement sa propre promo, tournée vers ce qui vient (offres ouvertes, lauréats qui aident).
// Pas d'échéance, pas de rythme attendu, pas de barre vide : encourager plutôt que comparer.

function PromoPage({ ctx }) {
  const { data, saison, me, go } = ctx;
  const n = niveauOf(me, saison);
  const st = useMemo(() => seasonStats(data, saison), [data, saison]);
  const row = st.rows.find(r => r.n === n);
  if (!row) return html`<section class="page"><header class="page-head"><div><p class="eyebrow">Saison ${seasonLabel(saison)}</p><h1>Ma promo</h1></div></header>
    <${SuiviSeg} ctx=${ctx} on="placement"/>
    <div class="panel"><p>Le suivi commence en 3e année. En attendant, profite de l’Entraide et du mentorat pour découvrir les métiers des lauréats.</p></div></section>`;
  const companies = new Map();
  for (const pl of row.foundList) companies.set(pl.entreprise, (companies.get(pl.entreprise) || 0) + 1);
  const comp = [...companies.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const mine = row.byFiliere.find(f => f.filiere === me.filiere);
  // Les mêmes offres que dans « Offres » : ouvertes, pour les étudiants de cette année
  const ouvertes = data.offers.filter(o => o.status === 'ouverte' && o.audience !== 'laureats' && (o.annees || []).includes(n)).length;
  const aidants = data.profiles.filter(p => p.role === 'laureat' && p.filiere === me.filiere).length;
  const pourFiliere = data.offers.filter(o => o.status === 'ouverte' && o.audience !== 'laureats' && (o.annees || []).includes(n) && o.filieres?.includes(me.filiere)).length;
  return html`<section class="page promo">
    <header class="page-head"><div><p class="eyebrow">Saison ${seasonLabel(saison)} · ${NIVEAUX[n].label}</p><h1>Ma promo</h1></div></header>
    <${SuiviSeg} ctx=${ctx} on="placement"/>
    <div class="pr-avant">
      <button type="button" class="pr-stat" onClick=${() => go('offres')}>
        <span class="pr-stat-ico"><${Icon} name="feed" size=${18}/></span>
        <span class="pr-stat-num mono"><${Num} v=${ouvertes}/></span>
        <span class="pr-stat-lbl">${ouvertes > 1 ? 'offres ouvertes pour ta promo' : 'offre ouverte pour ta promo'}</span>
        <span class="pr-stat-go">Voir les offres <${Icon} name="arrow" size=${14}/></span>
      </button>
      ${row.via ? html`<div class="pr-stat good">
        <span class="pr-stat-ico"><${Icon} name="heart" size=${18}/></span>
        <span class="pr-stat-num mono"><${Num} v=${row.via}/></span>
        <span class="pr-stat-lbl">${row.via > 1 ? 'camarades ont trouvé grâce à un lauréat' : 'camarade a trouvé grâce à un lauréat'}</span>
      </div>` : html`<button type="button" class="pr-stat good" onClick=${() => go('mentorat')}>
        <span class="pr-stat-ico"><${Icon} name="mentor" size=${18}/></span>
        <span class="pr-stat-num mono"><${Num} v=${aidants}/></span>
        <span class="pr-stat-lbl">${aidants > 1 ? 'lauréats de ta filière dans le réseau' : 'lauréat de ta filière dans le réseau'}</span>
        <span class="pr-stat-go">Trouver un mentor <${Icon} name="arrow" size=${14}/></span>
      </button>`}
    </div>
    <${PoulsReseau} ctx=${ctx}/>
    ${mine ? html`<div class="panel pr-fil"><div class="section-head"><h2>${me.filiere}</h2>${mine.found ? html`<span class="muted small">${mine.found > 1 ? `${mine.found} camarades ont trouvé` : '1 camarade a trouvé'}</span>` : null}</div>
      ${mine.found ? html`<${Bar} value=${mine.total ? mine.found / mine.total : 0} label=${mine.found > 1 ? `${mine.found} camarades ont trouvé` : '1 camarade a trouvé'}/>` : null}
      <p class="small muted">Chacun avance à son rythme : les lauréats publient toute l’année.</p>
      ${pourFiliere ? html`<button type="button" class="linkish small pr-fil-go" onClick=${() => go('offres')}>${pourFiliere > 1 ? `${pourFiliere} offres ciblent ta filière` : '1 offre cible ta filière'} <${Icon} name="arrow" size=${13}/></button>` : null}</div>` : null}
    <${SuccessFeed} ctx=${ctx} max=${3} lien=${false}/>
    ${comp.length ? html`<div class="panel"><div class="section-head"><h2>Où va ta promo</h2></div>
      <ul class="company-cloud">${comp.map(([c, k]) => html`<li><${CompanyLogo} name=${c} size=${34}/><span translate="no" dir="auto">${c}</span><span class="count">${k}</span></li>`)}</ul></div>` : null}
  </section>`;
}

injectCSS('dashboard-promo', `
.pr-avant { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .7rem; }
.pr-stat { display: flex; flex-direction: column; align-items: flex-start; gap: .3rem; padding: 1rem 1.1rem; border-radius: var(--r-xl); border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--line)); background: linear-gradient(160deg, var(--accent-soft), var(--surface) 78%); text-align: start; font: inherit; color: inherit; min-width: 0; }
button.pr-stat { cursor: pointer; transition: transform .25s var(--ease), box-shadow .25s, border-color .2s; }
button.pr-stat:hover { transform: translateY(-2px); box-shadow: var(--shadow-lift); border-color: color-mix(in srgb, var(--accent) 45%, var(--line)); }
.pr-stat.good { background: linear-gradient(160deg, var(--good-soft), var(--surface) 78%); border-color: color-mix(in srgb, var(--good) 24%, var(--line)); }
.pr-stat-ico { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: var(--surface); color: var(--accent); margin-bottom: .2rem; }
.pr-stat.good .pr-stat-ico { color: var(--good); }
.pr-stat-num { font-size: var(--fs-7); line-height: 1.05; color: var(--ink); }
.pr-stat-lbl { color: var(--ink-2); font-size: var(--fs-2); line-height: 1.35; }
.pr-stat-go { margin-top: auto; padding-top: .3rem; display: inline-flex; align-items: center; gap: .3rem; font-weight: 600; font-size: var(--fs-2); color: var(--blue-text); }
.pr-stat.good .pr-stat-go { color: var(--good); }
.pr-fil .bar-fill { background: var(--good); }
.pr-fil-go { align-self: flex-start; display: inline-flex; align-items: center; gap: .3rem; font-weight: 600; }
@media (max-width: 420px) { .pr-avant { gap: .55rem; } .pr-stat { padding: .9rem .85rem; } .pr-stat-num { font-size: var(--fs-6); } }
`);

addAR({
  'offres ouvertes pour ta promo': 'عروض مفتوحة لدفعتك',
  'offre ouverte pour ta promo': 'عرض مفتوح لدفعتك',
  'camarades ont trouvé grâce à un lauréat': 'زملاء وجدوا فرصتهم بفضل خريج',
  'camarade a trouvé grâce à un lauréat': 'زميل وجد فرصته بفضل خريج',
  'lauréats de ta filière dans le réseau': 'خريجون من شعبتك في الشبكة',
  'lauréat de ta filière dans le réseau': 'خريج من شعبتك في الشبكة',
  '1 camarade a trouvé': 'زميل واحد وجد فرصته',
  '1 offre cible ta filière': 'عرض واحد يستهدف شعبتك',
  'Chacun avance à son rythme : les lauréats publient toute l’année.': 'كل واحد يتقدم بإيقاعه: ينشر الخريجون العروض طوال السنة.',
}, [
  [/^(\d+) offres ciblent ta filière$/, k => `${arCount(k, ['عرض واحد', 'عرضان', 'عروض', 'عرضًا'])} تستهدف شعبتك`],
  [/^(\d+) camarades ont trouvé$/, k => `${arCount(k, ['زميل واحد', 'زميلان', 'زملاء', 'زميلًا'])} وجدوا فرصتهم`],
]);

// ---------------------------------------------------------------------------
// Insertion des diplômés : résultats de l'enquête à 6 et 12 mois (agrégés, 5 réponses minimum),
// et pour l'administration le rapport par promo, filière et vague, exportable (CSV, Excel, PDF).
// ---------------------------------------------------------------------------
addAR({
  'Placement': 'التشغيل والتدريب',
  'Insertion des diplômés': 'إدماج الخريجين',
  'Après le diplôme': 'بعد التخرج',
  'Enquête 6 et 12 mois après le diplôme': 'استطلاع بعد 6 و12 شهراً من التخرج',
  'Promotion': 'الدفعة',
  '12 mois': '12 شهراً',
  'Chargement…': 'جارٍ التحميل…',
  'Pas encore assez de réponses': 'لا توجد أجوبة كافية بعد',
  'Les résultats s’affichent dès 5 réponses par promo, pour protéger l’anonymat. L’enquête est envoyée aux diplômés 6 et 12 mois après le diplôme.': 'تظهر النتائج ابتداءً من 5 أجوبة لكل دفعة، حمايةً لسرية المشاركين. يُرسل الاستطلاع إلى الخريجين بعد 6 و12 شهراً من التخرج.',
  'Aucune réponse pour l’instant.': 'لا توجد أجوبة حالياً.',
  'Ta réponse compte : elle aide l’école et les promos suivantes.': 'جوابك مهم: يساعد المدرسة والدفعات القادمة.',
  'Situation des diplômés': 'وضعية الخريجين',
  'En poste': 'يعملون',
  'Autre situation': 'وضعية أخرى',
  'Comment ils ont trouvé': 'كيف وجدوا عملهم',
  'Secteurs': 'القطاعات',
  'Salaire net mensuel': 'الراتب الشهري الصافي',
  'Hors « je préfère ne pas dire ».': 'دون احتساب «أفضل عدم الإفصاح».',
  'Filières avec au moins 5 réponses.': 'الشعب التي لها 5 أجوبة على الأقل.',
  'Toutes les promos': 'كل الدفعات',
  'Vague': 'الموجة',
  'Réponses': 'الأجوبة',
  'Délai médian': 'المدة الوسيطة',
  'Taux d’insertion = en poste (emploi, création d’entreprise, volontariat) ÷ (répondants − poursuite d’études).': 'نسبة الإدماج = العاملون (وظيفة، إنشاء مقاولة، تطوع) ÷ (المجيبون − متابعو الدراسة).',
  'Taux de réponse = répondants ÷ effectif officiel (ou inscrits sur la plateforme si la liste officielle n’est pas importée).': 'نسبة الإجابة = المجيبون ÷ العدد الرسمي (أو المسجلون في المنصة إذا لم تُستورد اللائحة الرسمية).',
  'Rapport d’insertion': 'تقرير الإدماج',
  'Pour les rapports officiels et l’accréditation : par promo, filière et vague.': 'للتقارير الرسمية والاعتماد: حسب الدفعة والشعبة والموجة.',
  'Toutes les promos (filtre)': 'كل الدفعات',
  'Les deux vagues': 'الموجتان',
  'Effectif officiel': 'العدد الرسمي',
  'Inscrits sur la plateforme': 'المسجلون في المنصة',
  'Répondants': 'المجيبون',
  'Taux de réponse': 'نسبة الإجابة',
  'Poursuite d’études': 'متابعة الدراسة',
  'En poste à l’étranger': 'يعملون في الخارج',
  'Délai médian (mois)': 'المدة الوسيطة (أشهر)',
  'Satisfaction (/5)': 'الرضا (/5)',
  'Lien avec la formation (/5)': 'العلاقة بالتكوين (/5)',
  'Vague (mois)': 'الموجة (أشهر)',
  'Excel': 'Excel',
  'CSV': 'CSV',
  'Imprimer / PDF': 'طباعة / PDF',
  'Fichier Excel prêt.': 'ملف Excel جاهز.',
  'Fichier CSV prêt.': 'ملف CSV جاهز.',
  'Aucune ligne pour ces filtres.': 'لا توجد أسطر لهذه المرشحات.',
  'L’effectif officiel vient de la liste importée par l’administration (vide si la liste n’est pas importée).': 'العدد الرسمي مأخوذ من اللائحة التي استوردتها الإدارة (فارغ إذا لم تُستورد اللائحة).',
  'École Nationale Supérieure d’Arts et Métiers de Meknès': 'المدرسة الوطنية العليا للفنون والمهن بمكناس',
  'Rapport d’insertion des diplômés': 'تقرير إدماج الخريجين',
}, [
  [/^(\d+) réponses?$/, n => `${n} ${+n === 1 ? 'جواب' : 'أجوبة'}`],
  [/^(\d+) réponses? · promo (\d{4}), (6|12) mois après le diplôme$/, (n, p, v) => `${n} ${+n === 1 ? 'جواب' : 'أجوبة'} · دفعة ${p}، ${v === '12' ? '12 شهراً' : '6 أشهر'} بعد التخرج`],
  [/^(\d+) groupes? \(promo et vague\) ont encore moins de 5 réponses : leurs résultats s’afficheront plus tard\.$/, n => `${n} ${+n === 1 ? 'مجموعة' : 'مجموعات'} (دفعة وموجة) لها أقل من 5 أجوبة بعد: ستظهر نتائجها لاحقاً.`],
  [/^Total (6|12) mois$/, v => `المجموع ${v === '12' ? '12 شهراً' : '6 أشهر'}`],
  [/^Généré le (.+)$/, d => `أُنجز في ${d}`],
  [/^Promo (\d{4}) · (6|12) mois$/, (p, v) => `دفعة ${p} · ${v === '12' ? '12 شهراً' : '6 أشهر'}`],
  [/^(\d+) lignes?$/, n => `${n} ${+n === 1 ? 'سطر' : 'أسطر'}`],
  [/^En poste (\d+), En recherche (\d+), Poursuite d’études (\d+), Autre situation (\d+)$/, (a, b, c, d) => `يعملون ${a}، في طور البحث ${b}، متابعة الدراسة ${c}، وضعية أخرى ${d}`],
]);

injectCSS('dashboard-insertion', `
.suivi-seg { align-self: flex-start; }
.suivi-seg button { display: inline-flex; align-items: center; gap: .35rem; }
.ins-pick { display: flex; gap: .6rem; align-items: center; flex-wrap: wrap; }
.ins-pick select { min-width: 7.5rem; }
.ins-stats { display: flex; flex-direction: column; gap: 1.1rem; }
.ins-stack { display: flex; height: 14px; border-radius: 999px; overflow: hidden; background: var(--surface-2); }
.ins-stack span { height: 100%; transition: width .6s var(--ease); }
.ins-c-poste { background: var(--good); } .ins-c-rech { background: var(--warn); } .ins-c-etu { background: var(--accent); } .ins-c-autre { background: var(--muted); }
.ins-legend { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .4rem; }
.ins-legend li { display: flex; align-items: center; gap: .5rem; font-size: .9rem; }
.ins-legend .dot { width: 10px; height: 10px; border-radius: 3px; flex: none; }
.ins-legend .v, .ins-bars .v { margin-inline-start: auto; font-variant-numeric: tabular-nums; color: var(--ink-2); white-space: nowrap; }
.ins-bars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .55rem; }
.ins-bars li { display: grid; grid-template-columns: minmax(0, 11rem) minmax(0, 1fr) 3.4rem; gap: .6rem; align-items: center; font-size: .88rem; }
.ins-bars li > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ins-bars .v { text-align: end; }
.tbl-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.tbl tr.click { cursor: pointer; }
.tbl tr.click:hover td { background: var(--surface-2); }
.tbl tr.sel td { background: var(--accent-soft); }
.tbl.ins-all td { white-space: nowrap; }
.tbl.ins-rapport { font-size: .82rem; min-width: 860px; }
.tbl.ins-rapport th, .tbl.ins-rapport td { padding-inline: .35rem; }
.tbl.ins-rapport td.fil { white-space: nowrap; }
.tbl.ins-rapport th { white-space: normal; vertical-align: bottom; text-transform: none; letter-spacing: 0; font-size: .74rem; }
.tbl.ins-rapport tr.tot td { font-weight: 600; background: var(--surface-2); }
.ins-actions { display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; }
.ins-method { margin: 0; }
.ins-print-head { display: none; }
@media (max-width: 760px) {
  .ins-bars li { grid-template-columns: minmax(0, 1fr) 3rem; row-gap: .25rem; }
  .ins-bars li > span:first-child { grid-column: 1 / -1; white-space: normal; }
  .tbl.ins-all { font-size: .84rem; }
  .tbl.ins-all th, .tbl.ins-all td { padding-inline: .35rem; }
  .ins-pick { width: 100%; }
  .ins-actions .btn { flex: 1; }
}
@media print {
  body.print-ins { --ink: #000; --ink-2: #222; --muted: #555; --line: #bbb; --surface: #fff; --surface-2: #eef2f6; --bg: #fff; background: #fff !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body.print-ins::before { display: none !important; }
  body.print-ins .side, body.print-ins .top, body.print-ins .bottom-nav, body.print-ins .demo-band, body.print-ins .ins-noprint, body.print-ins .toast { display: none !important; }
  body.print-ins .shell { display: block !important; }
  body.print-ins .content { padding: 0 !important; }
  body.print-ins .page { max-width: none !important; gap: .4rem !important; }
  body.print-ins .page > * { animation: none !important; }
  body.print-ins .ins-print-head { display: block !important; margin-bottom: 6mm; }
  body.print-ins .ins-print-head h1 { font-size: 16pt; margin: 0 0 2mm; }
  body.print-ins .ins-print-head p { margin: 0 0 1mm; font-size: 9pt; }
  body.print-ins .ins-rapport-panel { border: 0 !important; padding: 0 !important; }
  body.print-ins .tbl-scroll { overflow: visible !important; }
  body.print-ins .tbl.ins-rapport { min-width: 0 !important; font-size: 7.5pt !important; }
  body.print-ins .tbl.ins-rapport th, body.print-ins .tbl.ins-rapport td { padding: 3px 4px !important; }
  body.print-ins .tbl.ins-rapport tr { break-inside: avoid; }
}
`);

const num = x => (x == null || x === '' ? null : Number(x));

function InsertionPage({ ctx }) {
  const { data, me, store, go } = ctx;
  const admin = me.role === 'admin';
  const etu = me.role === 'etudiant';
  const stats = useStatsInsertion(store, data.enquetes_insertion);
  const min = admin ? 1 : 5;
  const rows = (stats || []).map(r => ({ ...r, n: num(r.n), en_poste: num(r.en_poste), recherche: num(r.recherche), etudes: num(r.etudes), etranger: num(r.etranger), delai_median: num(r.delai_median), satisfaction: num(r.satisfaction), lien_formation: num(r.lien_formation) }))
    .filter(r => r.n >= min);
  const caches = (stats || []).filter(r => num(r.n) < min).length;
  const promos = [...new Set(rows.map(r => r.promo))].sort((a, b) => b - a);
  const [promo, setPromo] = useState(null);
  const [vague, setVague] = useState(null);
  const p = promos.includes(promo) ? promo : me.role === 'laureat' && promos.includes(me.promo) ? me.promo : promos[0];
  const vagues = rows.filter(r => r.promo === p).map(r => r.vague).sort((a, b) => a - b);
  const v = vagues.includes(vague) ? vague : vagues.includes(12) ? 12 : vagues[0];
  const r = rows.find(x => x.promo === p && x.vague === v);
  const due = enqueteDue(me, data.enquetes_insertion || []);

  return html`<section class="page insertion">
    <header class="page-head ins-noprint"><div><p class="eyebrow">Enquête 6 et 12 mois après le diplôme</p><h1>${etu ? 'Après le diplôme' : 'Insertion des diplômés'}</h1></div>
      ${promos.length ? html`<div class="ins-pick">
        <label class="season-pick">Promotion <select id="ins-promo" value=${p} onChange=${e => { setPromo(+e.target.value); setVague(null); }}>${promos.map(x => html`<option value=${x}>${x}</option>`)}</select></label>
        ${vagues.length > 1 ? html`<div class="seg small-seg" role="group" aria-label="Vague">${vagues.map(x => html`<button class=${x === v ? 'on' : ''} aria-pressed=${x === v} onClick=${() => setVague(x)}>${x} mois</button>`)}</div>` : null}
      </div>` : null}
    </header>
    <${SuiviSeg} ctx=${ctx} on="insertion"/>
    ${due ? html`<div class="hint-box ins-noprint"><${Icon} name="chart" size=${16}/><span class="grow">Ta réponse compte : elle aide l’école et les promos suivantes.</span><button class="btn small primary" onClick=${() => go('enquete')}>Répondre</button></div>` : null}

    <div class="ins-stats ins-noprint">
      ${stats === null ? html`<p class="muted">Chargement…</p>` : !r ? html`<div class="panel"><div class="empty"><${Icon} name="chart" size=${28}/><strong>Pas encore assez de réponses</strong><div>${admin ? 'Aucune réponse pour l’instant.' : 'Les résultats s’affichent dès 5 réponses par promo, pour protéger l’anonymat. L’enquête est envoyée aux diplômés 6 et 12 mois après le diplôme.'}</div></div></div>` : html`
        <${KpisInsertion} r=${r}/>
        <p class="small muted ins-method">${r.n} réponses · promo ${r.promo}, ${r.vague} mois après le diplôme</p>
        <div class="two-col">
          <${SituationPanel} r=${r}/>
          ${r.canaux ? html`<${Repartition} titre="Comment ils ont trouvé" icon="search" m=${r.canaux} labels=${CANAUX}/>` : null}
        </div>
        ${r.secteurs || r.salaires ? html`<div class="two-col">
          ${r.secteurs ? html`<${Repartition} titre="Secteurs" icon="briefcase" m=${r.secteurs}/>` : null}
          ${r.salaires ? html`<${Repartition} titre="Salaire net mensuel" icon="award" m=${r.salaires} labels=${SALAIRES} ordre=${Object.keys(SALAIRES).filter(k => k !== 'nsp')} note="Hors « je préfère ne pas dire »."/>` : null}
        </div>` : null}
        ${r.filieres ? html`<div class="panel"><div class="section-head"><h2>Par filière</h2><span class="small muted">Filières avec au moins 5 réponses.</span></div>
          <table class="tbl"><thead><tr><th>Filière</th><th class="num">Réponses</th><th class="num">En poste</th><th></th></tr></thead><tbody>
            ${Object.entries(r.filieres).sort((a, b) => b[1].n - a[1].n).map(([f, x]) => html`<tr><td>${f}</td><td class="num mono">${x.n}</td><td class="num mono">${pct(x.n ? x.en_poste / x.n : 0)}</td><td class="bar-cell"><${Bar} value=${x.n ? x.en_poste / x.n : 0}/></td></tr>`)}
          </tbody></table></div>` : null}
        <div class="panel"><div class="section-head"><h2>Toutes les promos</h2></div>
          <div class="tbl-scroll"><table class="tbl ins-all"><thead><tr><th>Promotion</th><th>Vague</th><th class="num">Réponses</th><th class="num">Taux d’insertion</th><th class="num">Délai médian</th><th class="num">Satisfaction</th></tr></thead><tbody>
            ${rows.map(x => { const t = tauxInsertion(x); const choisir = () => { setPromo(x.promo); setVague(x.vague); };
              return html`<tr class=${'click' + (x === r ? ' sel' : '')} tabindex="0" aria-current=${x === r ? 'true' : null} onClick=${choisir} onKeyDown=${e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choisir(); } }}>
              <td class="mono">${x.promo}</td><td>${x.vague} mois</td><td class="num mono">${x.n}</td><td class="num mono">${t == null ? '—' : pct(t)}</td>
              <td class="num mono">${x.delai_median == null ? '—' : `${virgule(x.delai_median)} mois`}</td><td class="num mono">${x.satisfaction == null ? '—' : `${virgule(x.satisfaction)} / 5`}</td></tr>`; })}
          </tbody></table></div>
          <p class="small muted ins-method">Taux d’insertion = en poste (emploi, création d’entreprise, volontariat) ÷ (répondants − poursuite d’études).</p>
        </div>`}
      ${caches && !admin ? html`<p class="small muted">${caches} groupe${caches > 1 ? 's' : ''} (promo et vague) ont encore moins de 5 réponses : leurs résultats s’afficheront plus tard.</p>` : null}
    </div>
    ${admin ? html`<${RapportPanel} ctx=${ctx} stats=${rows}/>` : null}
  </section>`;
}

function SituationPanel({ r }) {
  const autre = Math.max(0, r.n - r.en_poste - r.recherche - r.etudes);
  const parts = [['ins-c-poste', 'En poste', r.en_poste], ['ins-c-rech', SITUATIONS.recherche, r.recherche], ['ins-c-etu', SITUATIONS.etudes, r.etudes], ['ins-c-autre', 'Autre situation', autre]];
  return html`<div class="panel"><div class="section-head"><h2 class="h-ico"><${Icon} name="people"/> Situation des diplômés</h2></div>
    <div class="ins-stack" role="img" aria-label=${parts.map(([, l, k]) => `${l} ${k}`).join(', ')}>${parts.map(([c, l, k]) => (k ? html`<span class=${c} style=${`width:${(k / r.n) * 100}%`} title=${l}></span>` : null))}</div>
    <ul class="ins-legend">${parts.map(([c, l, k]) => html`<li><span class=${'dot ' + c}></span><span>${l}</span><span class="v mono">${k} · ${pct(k / r.n)}</span></li>`)}</ul>
  </div>`;
}

function Repartition({ titre, icon, m, labels, ordre, note }) {
  const entries = (ordre ? ordre.filter(k => m[k]).map(k => [k, num(m[k])]) : Object.entries(m).map(([k, v]) => [k, num(v)]).sort((a, b) => b[1] - a[1])).slice(0, 8);
  const tot = Object.values(m).reduce((a, v) => a + num(v), 0) || 1;
  return html`<div class="panel"><div class="section-head"><h2 class="h-ico"><${Icon} name=${icon}/> ${titre}</h2></div>
    <ul class="ins-bars">${entries.map(([k, v]) => html`<li><span title=${labels?.[k] || k}>${labels?.[k] || k}</span><${Bar} value=${v / tot}/><span class="v mono">${pct(v / tot)}</span></li>`)}</ul>
    ${note ? html`<p class="small muted ins-method">${note}</p>` : null}
  </div>`;
}

// Colonnes du rapport, partagées par le tableau, le CSV et le fichier Excel
const COLS = [
  ['promo', 'Promotion', 'id'], ['filiere', 'Filière', 'txt'], ['vague', 'Vague (mois)', 'int'],
  ['effectif', 'Effectif officiel', 'int'], ['inscrits', 'Inscrits sur la plateforme', 'int'], ['repondants', 'Répondants', 'int'],
  ['taux_reponse', 'Taux de réponse', 'pct'], ['taux_insertion', 'Taux d’insertion', 'pct'],
  ['en_poste', 'En poste', 'int'], ['recherche', 'En recherche', 'int'], ['etudes', 'Poursuite d’études', 'int'], ['etranger', 'En poste à l’étranger', 'int'],
  ['delai_median', 'Délai médian (mois)', 'dec'], ['satisfaction', 'Satisfaction (/5)', 'dec'], ['lien_formation', 'Lien avec la formation (/5)', 'dec'],
];
const CLS = { id: 'mono', txt: 'fil', int: 'num mono', pct: 'num mono', dec: 'num mono' };
const METHODE = [
  'Taux d’insertion = en poste (emploi, création d’entreprise, volontariat) ÷ (répondants − poursuite d’études).',
  'Taux de réponse = répondants ÷ effectif officiel (ou inscrits sur la plateforme si la liste officielle n’est pas importée).',
  'L’effectif officiel vient de la liste importée par l’administration (vide si la liste n’est pas importée).',
];

// Totaux d'une vague (les effectifs se répètent d'une vague à l'autre : on ne les additionne pas entre vagues)
function totaux(list, promo) {
  return [6, 12].filter(v => list.some(r => r.vague === v)).map(v => {
    const l = list.filter(r => r.vague === v);
    const sum = k => l.reduce((a, r) => a + (num(r[k]) || 0), 0);
    const rep = sum('repondants'), etu = sum('etudes'), ep = sum('en_poste');
    const base = l.reduce((a, r) => a + (num(r.effectif) || num(r.inscrits) || 0), 0);
    return { tot: true, promo: promo || 'Toutes', filiere: 'Toutes filières', vague: v, effectif: l.every(r => r.effectif != null) ? sum('effectif') : null, inscrits: sum('inscrits'), repondants: rep,
      taux_reponse: base ? rep / base : null, taux_insertion: rep - etu > 0 ? ep / (rep - etu) : null, en_poste: ep, recherche: sum('recherche'), etudes: etu, etranger: sum('etranger'), delai_median: null, satisfaction: null, lien_formation: null };
  });
}

function RapportPanel({ ctx, stats }) {
  const { store, data } = ctx;
  const [rows, setRows] = useState(null);
  const [promo, setPromo] = useState('');
  const [vague, setVague] = useState(0);
  useEffect(() => {
    let on = true;
    Promise.resolve(store.rapportInsertion()).then(r => on && setRows(Array.isArray(r) ? r : []), e => { if (on) { setRows([]); toast(e.message || String(e), 'err'); } });
    return () => { on = false; };
  }, [data.enquetes_insertion, data.profiles.length, data.liste_officielle?.length]);
  const all = (rows || []).map(r => ({ ...r, promo: num(r.promo), vague: num(r.vague) }));
  const promos = [...new Set(all.map(r => r.promo))].sort((a, b) => b - a);
  const list = all.filter(r => (!promo || r.promo === +promo) && (!vague || r.vague === vague));
  const tots = totaux(list, promo ? +promo : null);
  const cell = (r, [k, , t]) => {
    const x = r[k];
    if (x == null || x === '') return '—';
    if (t === 'pct') return pct(num(x));
    if (t === 'dec') return virgule(Math.round(num(x) * 10) / 10);
    return x;
  };
  const meta = { promo: promo ? +promo : null, vague };
  const nom = ext => `insertion-ensam-meknes-${promo || 'toutes-promos'}${vague ? '-' + vague + 'mois' : ''}-${new Date().toISOString().slice(0, 10)}.${ext}`;
  const csv = () => { telecharger(new Blob([rapportCSV(list, tots)], { type: 'text/csv;charset=utf-8' }), nom('csv')); toast('Fichier CSV prêt.'); };
  const excel = () => { telecharger(rapportXLSX(list, tots, stats.filter(s => (!promo || s.promo === +promo) && (!vague || s.vague === vague)), meta), nom('xlsx')); toast('Fichier Excel prêt.'); };
  const imprimer = () => {
    document.body.classList.add('print-ins');
    const off = () => { document.body.classList.remove('print-ins'); removeEventListener('afterprint', off); };
    addEventListener('afterprint', off);
    try { window.print(); } finally { setTimeout(off, 800); }
  };
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return html`<div class="panel ins-rapport-panel">
    <div class="ins-print-head"><p>École Nationale Supérieure d’Arts et Métiers de Meknès</p><h1>Rapport d’insertion des diplômés</h1>
      <p>Généré le ${date}${promo ? ` · Promo ${promo}` : ''}${vague ? ` · ${vague} mois` : ''}</p>${METHODE.map(m => html`<p>${m}</p>`)}</div>
    <div class="section-head ins-noprint"><h2 class="h-ico"><${Icon} name="file"/> Rapport d’insertion</h2>
      <div class="ins-actions">
        <button class="btn small" id="ins-csv" disabled=${!list.length} onClick=${csv}><${Icon} name="download" size=${15}/> CSV</button>
        <button class="btn small" id="ins-xlsx" disabled=${!list.length} onClick=${excel}><${Icon} name="download" size=${15}/> Excel</button>
        <button class="btn small primary" id="ins-print" disabled=${!list.length} onClick=${imprimer}><${Icon} name="file" size=${15}/> Imprimer / PDF</button>
      </div></div>
    <p class="small muted ins-noprint ins-method">Pour les rapports officiels et l’accréditation : par promo, filière et vague.</p>
    <div class="ins-pick ins-noprint">
      <select id="ins-r-promo" value=${promo} onChange=${e => setPromo(e.target.value)} aria-label="Promotion"><option value="">Toutes les promos (filtre)</option>${promos.map(x => html`<option value=${x}>${x}</option>`)}</select>
      <div class="seg small-seg" role="group" aria-label="Vague">${[[0, 'Les deux vagues'], [6, '6 mois'], [12, '12 mois']].map(([k, l]) => html`<button class=${vague === k ? 'on' : ''} aria-pressed=${vague === k} onClick=${() => setVague(k)}>${l}</button>`)}</div>
      <span class="small muted">${list.length} ligne${list.length > 1 ? 's' : ''}</span>
    </div>
    ${rows === null ? html`<p class="muted">Chargement…</p>` : !list.length ? html`<p class="muted">Aucune ligne pour ces filtres.</p>` : html`<div class="tbl-scroll"><table class="tbl ins-rapport">
      <thead><tr>${COLS.map(([k, l, t]) => html`<th class=${CLS[t] === 'num mono' ? 'num' : ''}>${l}</th>`)}</tr></thead>
      <tbody>${list.map(r => html`<tr>${COLS.map(c => html`<td class=${CLS[c[2]]}>${cell(r, c)}</td>`)}</tr>`)}
        ${tots.map(r => html`<tr class="tot">${COLS.map(c => html`<td class=${CLS[c[2]]}>${c[0] === 'vague' ? `Total ${r.vague} mois` : cell(r, c)}</td>`)}</tr>`)}</tbody>
    </table></div>`}
    ${METHODE.map(m => html`<p class="small muted ins-method ins-noprint">${m}</p>`)}
  </div>`;
}

function telecharger(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

// CSV pour Excel en français : UTF-8 avec BOM, séparateur « ; », virgule décimale, taux en %
function rapportCSV(list, tots) {
  const val = (r, [k, , t]) => {
    const x = r[k];
    if (k === 'vague' && r.tot) return `Total ${x} mois`;
    if (x == null || x === '') return '';
    if (t === 'pct') return (num(x) * 100).toFixed(1).replace('.', ',');
    if (t === 'dec') return String(Math.round(num(x) * 10) / 10).replace('.', ',');
    return String(x);
  };
  const head = COLS.map(([, l, t]) => (t === 'pct' ? `${l} (%)` : l));
  const lines = [head, ...[...list, ...tots].map(r => COLS.map(c => val(r, c)))];
  return '﻿' + lines.map(l => l.map(v => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(';')).join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// Fichier Excel (.xlsx) écrit à la main : un zip non compressé de quelques fichiers XML
// ---------------------------------------------------------------------------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = ~0; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return ~c >>> 0; };
function zip(files) {
  const enc = new TextEncoder(); const parts = []; const central = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  }
  const size = central.reduce((a, x) => a + x.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
const xe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const colL = i => { let s = ''; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
// Styles : 0 normal, 1 en-tête, 2 pourcentage, 3 décimal, 4 titre, 5 gras, 6 pourcentage gras, 7 texte replié
function sheet(rows, { widths = [], freeze = 0 } = {}) {
  const cell = (c, ri, ci) => {
    if (c == null || c === '') return '';
    const { v, s = 0 } = typeof c === 'object' ? c : { v: c };
    if (v == null || v === '') return '';
    const ref = colL(ci) + (ri + 1);
    return typeof v === 'number' && Number.isFinite(v) ? `<c r="${ref}"${s ? ` s="${s}"` : ''}><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"${s ? ` s="${s}"` : ''}><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
  };
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + (freeze ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freeze}" topLeftCell="A${freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : '')
    + (widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '')
    + `<sheetData>${rows.map((r, ri) => `<row r="${ri + 1}">${r.map((c, ci) => cell(c, ri, ci)).join('')}</row>`).join('')}</sheetData></worksheet>`;
}
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="0.0%"/><numFmt numFmtId="165" formatCode="0.0"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2F0F9"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="bottom"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
function classeur(feuilles) {
  const n = feuilles.length;
  return zip([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${feuilles.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${feuilles.map((f, i) => `<sheet name="${xe(f.nom)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${feuilles.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: STYLES },
    ...feuilles.map((f, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: f.xml })),
  ]);
}

function rapportXLSX(list, tots, stats, { promo, vague }) {
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const filtre = `${promo ? `Promo ${promo}` : 'Toutes les promos'} · ${vague ? `${vague} mois après le diplôme` : 'vagues à 6 et 12 mois'}`;
  const v = (r, [k, , t]) => {
    const x = r[k];
    if (k === 'vague' && r.tot) return { v: `Total ${x} mois`, s: 5 };
    if (k === 'promo' && r.tot) return { v: x === 'Toutes' ? 'Toutes' : num(x), s: 5 };
    if (x == null || x === '') return null;
    if (t === 'txt') return { v: String(x), s: r.tot ? 5 : 0 };
    if (t === 'pct') return { v: num(x), s: r.tot ? 6 : 2 };
    if (t === 'dec') return { v: Math.round(num(x) * 10) / 10, s: 3 };
    return { v: num(x), s: r.tot ? 5 : 0 };
  };
  const rapport = [
    [{ v: 'ENSAM Meknès · Rapport d’insertion des diplômés', s: 4 }],
    [`Généré le ${date} · ${filtre}`],
    [],
    COLS.map(([, l]) => ({ v: l, s: 1 })),
    ...list.map(r => COLS.map(c => v(r, c))),
    ...tots.map(r => COLS.map(c => v(r, c))),
  ];
  const tx = r => (r.n - r.etudes > 0 ? r.en_poste / (r.n - r.etudes) : null);
  const synthese = [
    [{ v: 'Synthèse par promo et vague (toutes filières)', s: 4 }],
    [`Généré le ${date} · ${filtre}`],
    [],
    ['Promotion', 'Vague (mois)', 'Répondants', 'En poste', 'En recherche', 'Poursuite d’études', 'En poste à l’étranger', 'Taux d’insertion', 'Délai médian (mois)', 'Satisfaction (/5)', 'Lien avec la formation (/5)'].map(l => ({ v: l, s: 1 })),
    ...stats.map(r => [r.promo, r.vague, r.n, r.en_poste, r.recherche, r.etudes, r.etranger, { v: tx(r), s: 2 }, { v: r.delai_median, s: 3 }, { v: r.satisfaction, s: 3 }, { v: r.lien_formation, s: 3 }]),
  ];
  const methode = [
    [{ v: 'Méthode', s: 4 }],
    ['Source : enquête d’insertion de la plateforme Réseau ENSAM Meknès, envoyée aux diplômés 6 mois puis 12 mois après le diplôme.'],
    ...METHODE.map(m => [{ v: m, s: 7 }]),
    ['En poste : emploi, création d’entreprise, volontariat ou VIE.'],
    ['Délai médian : mois entre le diplôme et le premier poste, pour les diplômés en poste qui ont répondu.'],
    ['Satisfaction et lien avec la formation : moyennes des notes de 1 à 5.'],
    [`Généré le ${date}.`],
  ];
  return classeur([
    { nom: 'Rapport', xml: sheet(rapport, { widths: [11, 26, 12, 12, 13, 12, 12, 12, 10, 12, 12, 12, 12, 12, 14], freeze: 4 }) },
    { nom: 'Synthèse', xml: sheet(synthese, { widths: [11, 12, 12, 10, 12, 12, 14, 13, 13, 13, 14], freeze: 4 }) },
    { nom: 'Méthode', xml: sheet(methode, { widths: [120] }) },
  ]);
}
