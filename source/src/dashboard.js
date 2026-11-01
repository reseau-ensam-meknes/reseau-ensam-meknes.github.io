// Tableau de bord de suivi : qui a trouvé quoi, par niveau, filière et saison,
// puis l'insertion des diplômés (enquête à 6 et 12 mois) avec le rapport exportable de l'administration.
import { html, useState, useMemo, useEffect, useRef } from './vendor/preact-htm.js';
import { Icon, Bar, Person, injectCSS, toast, EnTetePage, Compteur, Anneau } from './ui.js';
import { seasonStats, monthlyActivity, seasonLabel, NIVEAUX, pct, OBJECTIFS, statutOf, FOUND, niveauOf, enqueteDue, SITUATIONS, SALAIRES, CANAUX, proximiteFiliere, filiereMatch, filiereCourte } from './logic.js';
import { CompanyLogo } from './ui.js';
import { addAR, arCount } from './i18n.js';
import { SuccessFeed } from './growth.js';
import { useStatsInsertion, tauxInsertion, KpisInsertion, virgule } from './enquete.js';
import { clavierOnglets } from './me.js';

export function DashboardPage(ctx) {
  if (ctx.sub === 'insertion') return html`<${InsertionPage} ctx=${ctx}/>`;
  if (ctx.me.role === 'etudiant') return html`<${PromoPage} ctx=${ctx}/>`;
  return html`<${SeasonPage} ctx=${ctx}/>`;
}

// Placement / Insertion : deux vues du même onglet, dans l'adresse (#suivi, #suivi/insertion). La pastille glisse (Socle) ;
// au clavier, les flèches (dans le sens de lecture), Début et Fin. Sous l'en-tête, le panneau de l'onglet choisi (VueSuivi).
// La rangée a sa ligne sous le titre et garde sa largeur sur ordinateur ; sur téléphone, les deux onglets se partagent la largeur.
const VUES_SUIVI = ['placement', 'insertion'];
function SuiviSeg({ ctx, on }) {
  const etu = ctx.me.role === 'etudiant';
  const aller = k => ctx.go(k === 'insertion' ? 'suivi/insertion' : 'suivi', { remplacer: true });
  const onglet = (k, ic, l) => html`<button type="button" role="tab" id=${'suivi-onglet-' + k} aria-selected=${on === k ? 'true' : 'false'} aria-controls="suivi-vue" tabindex=${on === k ? 0 : -1}
    class=${on === k ? 'on' : ''} onClick=${() => { if (k !== on) aller(k); }}><${Icon} name=${ic} size=${15}/> ${l}</button>`;
  return html`<div class="suivi-onglets ins-noprint"><div class="seg suivi-seg" role="tablist" aria-label="Vue du suivi" onKeyDown=${clavierOnglets(VUES_SUIVI, on, aller, k => 'suivi-onglet-' + k)}>
    ${onglet('placement', etu ? 'people' : 'chart', etu ? 'Mon année' : 'Placement')}
    ${onglet('insertion', 'briefcase', etu ? 'Après le diplôme' : 'Insertion des diplômés')}
  </div></div>`;
}
const VueSuivi = ({ on, children }) => html`<div class="suivi-vue" id="suivi-vue" role="tabpanel" aria-labelledby=${'suivi-onglet-' + on}>${children}</div>`;

// L'état d'une année d'études par rapport au temps écoulé vers l'échéance (vert, ambre, rouge, comme partout)
function tonAnnee(r) {
  const gap = r.rate - r.elapsed;
  const tone = r.rate >= 0.999 ? 'good' : r.daysLeft < 0 ? (r.rate >= 0.9 ? 'good' : 'bad') : gap >= -0.05 ? 'good' : gap >= -0.25 ? 'warn' : 'bad';
  const txt = r.rate >= 0.999 ? 'Objectif atteint' : r.daysLeft < 0 ? 'Année terminée' : tone === 'good' ? 'Dans les temps' : tone === 'warn' ? 'À surveiller' : 'En retard';
  return [tone, txt];
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
  const ouvertes = data.offers.filter(o => o.status === 'ouverte');
  const auteurs = new Set(ouvertes.map(o => o.author_id)).size;
  const row = st.rows.find(r => r.n === niv);
  const [detail, setDetail] = useState(false);
  const [tousCherchent, setTousCherchent] = useState(false);
  const part = totalPop ? totalFound / totalPop : 0;
  const partVia = st.totalFound ? st.viaTotal / st.totalFound : 0;
  // Une année touchée : son détail (filières, qui cherche encore) s'ouvre juste dessous ; s'il tombe sous l'écran,
  // la page y glisse (sans glisser en mouvement réduit), pour que le toucher ait un effet visible
  const voirAnnee = n => {
    setNiv(n); setDetail(true); setTousCherchent(false);
    requestAnimationFrame(() => {
      const d = document.getElementById('suivi-detail');
      if (d && d.getBoundingClientRect().top > innerHeight * .7) d.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  };
  const cherchent = tousCherchent ? row.searching : row.searching.slice(0, CHERCHENT_N);

  return html`<section class="page suivi-page">
    <${EnTetePage} surTitre="Suivi de placement" titre="Tableau de bord"
      action=${html`<label class="season-pick">Année <select id="dash-season" value=${saison} onChange=${e => setSaison(+e.target.value)}>${seasons.map(x => html`<option value=${x}>${seasonLabel(x)}${x === cur ? ' (en cours)' : ''}</option>`)}</select></label>`}>
      <${SuiviSeg} ctx=${ctx} on="placement"/>
    <//>

    <${VueSuivi} on="placement">
    <section class="suivi-hero" aria-labelledby="suivi-hero-titre">
      <${Anneau} valeur=${totalFound} max=${totalPop || 1} taille=${116} epaisseur=${10} ton="bien" label=${`${pct(part)} ont trouvé`}>
        <span class="sh-pct"><${Compteur} v=${Math.round(part * 100)} format=${x => x + '%'}/></span><span class="sh-pct-l">ont trouvé</span><//>
      <div class="sh-txt">
        <h2 id="suivi-hero-titre"><span class="sh-n"><${Compteur} v=${totalFound}/></span> <span class="sh-sur">${`sur ${totalPop} inscrits`}</span></h2>
        <p class="sh-qui"><span>3A, 4A, 5A et jeunes diplômés</span> · <span>${seasonLabel(saison)}</span></p>
        <ul class="sh-faits">
          <li><span class="sh-pt bien" aria-hidden="true"></span><span><strong><${Compteur} v=${st.viaTotal}/></strong> <span>${`grâce à la plateforme (${pct(partVia)} des réussites)`}</span></span></li>
          <li><span class="sh-pt attente" aria-hidden="true"></span><span><strong><${Compteur} v=${pendingAll}/></strong> <span>à confirmer par l’étudiant</span></span></li>
          <li><span class="sh-pt offres" aria-hidden="true"></span><span><strong><${Compteur} v=${ouvertes.length}/></strong> <span>${`offres ouvertes, publiées par ${auteurs} lauréat${auteurs > 1 ? 's' : ''}`}</span></span></li>
        </ul>
      </div>
    </section>

    <section class="esp-bloc suivi-annees" aria-labelledby="suivi-annees-titre">
      <h2 class="esp-h" id="suivi-annees-titre">Par année d’études</h2>
      <ul class="esp-lignes">${st.rows.map(r => {
        const [tone, toneTxt] = tonAnnee(r);
        const choisie = detail && niv === r.n;
        const fin = r.end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(r.daysLeft >= 0 ? {} : { year: 'numeric' }) });
        return html`<li key=${r.n}><button type="button" class=${'esp-ligne sa-ligne' + (choisie ? ' on' : '')} aria-controls="suivi-detail" aria-pressed=${choisie ? 'true' : 'false'} onClick=${() => voirAnnee(r.n)}>
          <span class="sa-niv" aria-hidden="true">${r.n === 6 ? html`<${Icon} name="cap" size=${22}/>` : NIVEAUX[r.n].short}</span>
          <span class="sa-corps">
            <span class="sa-l1"><span class="sr-only">${NIVEAUX[r.n].label}</span> <strong class="sa-obj">${r.objectif.titre}</strong><span class="sa-pct">${pct(r.rate)}</span></span>
            <${Bar} value=${r.rate} pace=${r.daysLeft >= 0 ? r.elapsed : undefined} label=${`${pct(r.rate)} ont trouvé`}/>
            <span class="esp-sous sa-faits"><span class="sa-faits-in"><span class=${'sa-ton t-' + tone}><span class="sa-ton-pt" aria-hidden="true"></span>${toneTxt}</span><span>${`${r.found} sur ${r.total}`}</span>${r.pending ? html`<span>${`${r.pending} à confirmer`}</span>` : null}<span>${r.daysLeft >= 0 ? `Échéance ${fin}` : `Échéance passée (${fin})`}</span></span></span>
          </span></button></li>`;
      })}</ul>
      <ul class="sa-legende">
        <li><span class="sa-lg-plein" aria-hidden="true"></span>part des étudiants qui ont trouvé</li>
        <li><span class="sa-lg-trait" aria-hidden="true"></span>rythme attendu à cette date (temps écoulé vers l’échéance)</li>
      </ul>
    </section>

    <details class="suivi-detail" id="suivi-detail" open=${detail} onToggle=${e => setDetail(e.currentTarget.open)}>
    <summary>${detail ? 'Masquer le détail' : 'Voir le détail'} <${Icon} name="arrow" size=${16}/></summary>
    <div class="suivi-detail-corps">
    <h2 class="esp-h suivi-detail-titre">${`${NIVEAUX[niv].label} · ${row.objectif.court}`}</h2>
    <div class="sd-paire">
      <section class="esp-bloc sd-filieres" aria-labelledby="sd-fil-titre">
        <h2 class="esp-h" id="sd-fil-titre">Par filière</h2>
        <ul class="esp-lignes">${row.byFiliere.map(f => {
          const code = filiereCourte(f.filiere);
          return html`<li key=${f.filiere}><div class="esp-ligne sd-fil">
            <strong class="sd-fil-code" translate="no">${code}</strong>
            <${Bar} value=${f.total ? f.found / f.total : 0} label=${`${f.found} sur ${f.total}`}/>
            <span class="sd-fil-n">${`${f.found} sur ${f.total}`}</span>
            ${code !== f.filiere ? html`<span class="esp-sous sd-fil-nom">${f.filiere}</span>` : null}
          </div></li>`;
        })}</ul>
      </section>
      <section class="esp-bloc sd-cherche" aria-labelledby="sd-cherche-titre">
        <h2 class="esp-h" id="sd-cherche-titre">Encore en recherche <span class="count">${row.searching.length}</span></h2>
        ${row.searching.length ? html`<p class="esp-sous sd-note">Un message ou une offre ciblée peut tout changer pour eux.</p>
          <ul class="esp-lignes" id="sd-cherche-liste">${cherchent.map(p => {
            const s = statutOf(data, p, saison);
            return html`<li key=${p.id}><div class="esp-ligne"><${Person} p=${p} onOpen=${openProfile} size=${40}
              sub=${html`<span translate="no">${filiereCourte(p.filiere)}</span> · <span class=${'sd-etat s-' + s.key}>${s.label}</span>`}/></div></li>`;
          })}</ul>
          ${row.searching.length > CHERCHENT_N ? html`<button type="button" class="linkish sd-plus" aria-controls="sd-cherche-liste" aria-expanded=${tousCherchent ? 'true' : 'false'}
            onClick=${() => setTousCherchent(!tousCherchent)}>${tousCherchent ? 'Voir moins' : `Voir les ${row.searching.length - CHERCHENT_N} autres`}</button>` : null}`
        : html`<p class="esp-sous sd-note">Plus personne ne cherche dans cette année.</p>`}
      </section>
    </div>
    <${SuccessFeed} ctx=${ctx} max=${3} lien=${false}/>

    <div class="panel">
      <div class="section-head"><h2>Activité des 12 derniers mois</h2>
        <span class="legend small"><span class="lg-item"><span class="sw s1"></span>Offres publiées</span><span class="lg-item"><span class="sw s2"></span>Réussites confirmées par un lauréat</span></span></div>
      <${MonthChart} months=${months}/>
    </div>

    <div class="two-col">
      <div class="panel"><div class="section-head"><h2>Destinations à l’étranger</h2><span class="muted small">${seasonLabel(saison)}</span></div>
        ${st.countries.length ? html`<ol class="rank">${st.countries.slice(0, 6).map(([c, k]) => html`<li><span>${c}</span><span class="num">${k}</span></li>`)}</ol>` : html`<p class="muted">Aucun départ à l’étranger déclaré pour l’instant.</p>`}</div>
      <div class="panel"><div class="section-head"><h2>Entreprises qui accueillent</h2><span class="muted small">${seasonLabel(saison)}</span></div>
        <ol class="rank">${st.companies.slice(0, 6).map(([c, k]) => html`<li><span translate="no" dir="auto">${c}</span><span class="num">${k}</span></li>`)}</ol></div>
    </div>
    ${me.role === 'admin' ? html`<${ExportBox} data=${data} saison=${saison} rows=${st.rows}/>` : null}
    </div></details>
    <//>
  </section>`;
}
// Encore en recherche : les premiers, puis tous à la demande (le compte du titre dit le total)
const CHERCHENT_N = 6;

// Sur téléphone, le graphique défile en largeur : il s'ouvre sur les mois les plus récents, au bout à droite
// (en arabe, le défilement part déjà de là), la première fois qu'il paraît (le détail est replié au départ) ;
// l'échelle se répète à ce bout-là, pour lire les barres sans revenir au début
function MonthChart({ months }) {
  const wrap = useRef(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      if (getComputedStyle(el).direction !== 'rtl') el.scrollLeft = el.scrollWidth;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // L : l'échelle au début ; R : la même échelle au bout, montrée seulement quand le graphique défile (téléphone)
  const W = 720, H = 220, L = 34, R = 30, B = 26, T = 12;
  const max = Math.max(4, ...months.flatMap(m => [m.offres, m.placements]));
  const step = max <= 8 ? 2 : max <= 20 ? 5 : 10;
  const top = Math.ceil(max / step) * step;
  const y = v => T + (H - T - B) * (1 - v / top);
  const gw = (W - L - R) / months.length, bw = Math.min(16, gw / 3.2);
  const ticks = []; for (let v = 0; v <= top; v += step) ticks.push(v);
  return html`<div class="chart-wrap" ref=${wrap} tabindex="0" role="region" aria-label="Graphique : offres et réussites par mois"><svg viewBox=${`0 0 ${W} ${H}`} class="chart" role="img" aria-label="Offres publiées et réussites confirmées par mois">
    ${ticks.map(v => html`<g><line x1=${L} x2=${W - R} y1=${y(v)} y2=${y(v)} class="grid"/><text x=${L - 6} y=${y(v) + 4} class="axis" text-anchor="end">${v}</text>
      <text x=${W - R + 6} y=${y(v) + 4} class="axis axis-fin" text-anchor="start" aria-hidden="true">${v}</text></g>`)}
    ${months.map((m, i) => { const x = L + i * gw + gw / 2; return html`<g>
      <rect x=${x - bw - 1} y=${y(m.offres)} width=${bw} height=${Math.max(0, y(0) - y(m.offres))} rx="3" class="s1"><title>${m.label} : ${m.offres} offres publiées</title></rect>
      <rect x=${x + 1} y=${y(m.placements)} width=${bw} height=${Math.max(0, y(0) - y(m.placements))} rx="3" class="s2"><title>${m.label} : ${m.placements} réussites confirmées</title></rect>
      <text x=${x} y=${H - 8} class="axis" text-anchor="middle">${m.label}</text></g>`; })}
  </svg></div>`;
}

function ExportBox({ data, saison, rows }) {
  const [href, setHref] = useState(null);
  const build = () => {
    const lines = [['Nom', 'Année', 'Filière', 'Promo', 'Statut', 'Entreprise', 'Ville', 'Pays', 'Source', 'Vérifié']];
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
    <p class="muted small">Liste complète de l’année (une ligne par étudiant), à ouvrir dans Excel.</p>
    ${href ? html`<a class="btn" href=${href} download=${`suivi-placement-${seasonLabel(saison)}.csv`}><${Icon} name="download"/> Télécharger le fichier CSV</a>` : html`<button class="btn" onClick=${build}>Préparer l’export ${seasonLabel(saison)}</button>`}
  </div>`;
}

// Vue étudiant : seulement sa propre promo, tournée vers ce qui vient (offres ouvertes, camarades qui ont trouvé).
// Pas d'échéance, pas de rythme attendu, pas de barre vide : encourager plutôt que comparer.
// Un fait à un seul endroit : les offres de l'année (dont celles qui ciblent sa filière), puis qui a trouvé (et comment).
// Couleurs d'état partout pareilles : vert = trouvé, gris = en attente de confirmation.

// Barre empilée : grâce à un lauréat (vert), hors plateforme (vert clair), à confirmer (gris), sur tous les inscrits de l'année
function BarreTrouves({ via, autres, attente, total }) {
  const parts = [['tr-via', via, `${via} grâce à un lauréat`], ['tr-autre', autres, `${autres} hors plateforme`], ['tr-attente', attente, `${attente} à confirmer`]].filter(x => x[1] > 0);
  if (!total || !parts.length) return null;
  return html`<div class="tr-barre" role="img" aria-label=${parts.map(x => x[2]).join(' · ')}>${parts.map(([c, n]) => html`<span class=${c} style=${`width:${(n / total) * 100}%`}></span>`)}</div>
    <ul class="tr-legende">${parts.map(([c, , l]) => html`<li><span class=${'tr-dot ' + c} aria-hidden="true"></span>${l}</li>`)}</ul>`;
}

function PromoPage({ ctx }) {
  const { data, saison, me, go } = ctx;
  const n = niveauOf(me, saison);
  const st = useMemo(() => seasonStats(data, saison), [data, saison]);
  const row = st.rows.find(r => r.n === n);
  if (!row) return html`<section class="page">
    <${EnTetePage} surTitre=${seasonLabel(saison)} titre="Mon année"><${SuiviSeg} ctx=${ctx} on="placement"/><//>
    <${VueSuivi} on="placement"><div class="panel"><p>Le suivi commence en 3e année. En attendant, profite de l’Entraide et du mentorat pour découvrir les métiers des lauréats.</p></div><//></section>`;
  const companies = new Map();
  for (const pl of row.foundList) companies.set(pl.entreprise, (companies.get(pl.entreprise) || 0) + 1);
  const comp = [...companies.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxComp = comp[0]?.[1] || 1;
  const mine = row.byFiliere.find(f => f.filiere === me.filiere);
  // Les mêmes offres que dans « Offres » : ouvertes, pour les étudiants de cette année ; celles qui ciblent sa filière en part de ce total
  const pourAnnee = data.offers.filter(o => o.status === 'ouverte' && o.audience !== 'laureats' && (o.annees || []).includes(n));
  const ouvertes = pourAnnee.length;
  const pourFiliere = pourAnnee.filter(o => o.filieres?.length && filiereMatch(o.filieres, me.filiere)).length;
  const aidants = data.profiles.filter(p => p.role === 'laureat' && proximiteFiliere(p.filiere, me.filiere) > 0).length;
  const phraseFil = pourFiliere > 1 ? `${pourFiliere} offres ciblent ta filière` : '1 offre cible ta filière';
  const tete = (id, ic, titre) => html`<div class="pr-tete"><span class="pr-stat-ico" aria-hidden="true"><${Icon} name=${ic} size=${18}/></span><h2 id=${id}>${titre}</h2></div>`;
  return html`<section class="page promo">
    <${EnTetePage} surTitre=${`${seasonLabel(saison)} · ${NIVEAUX[n].label}`} titre="Mon année"><${SuiviSeg} ctx=${ctx} on="placement"/><//>
    <${VueSuivi} on="placement">
    <div class="pr-avant">
      <section class="pr-stat pr-offres" aria-labelledby="pr-offres-t">
        ${tete('pr-offres-t', 'feed', 'Offres pour ton année')}
        <p class="pr-chiffre"><span class="pr-stat-num"><${Compteur} v=${ouvertes}/></span><span class="pr-stat-lbl">${ouvertes > 1 ? 'ouvertes en ce moment' : 'ouverte en ce moment'}</span></p>
        ${pourFiliere ? html`<${Bar} value=${pourFiliere / ouvertes} label=${phraseFil}/>
          <ul class="tr-legende"><li><span class="tr-dot tr-fil" aria-hidden="true"></span>${phraseFil}</li></ul>` : null}
        <button type="button" class="linkish small pr-stat-go" onClick=${() => go('offres')}>Voir les offres <${Icon} name="arrow" size=${14}/></button>
      </section>
      ${row.found ? html`<section class="pr-stat good pr-trouve" aria-labelledby="pr-trouve-t">
        ${tete('pr-trouve-t', 'check', 'Camarades qui ont trouvé')}
        <p class="pr-chiffre"><span class="pr-stat-num"><${Compteur} v=${row.found}/></span><span class="pr-stat-lbl">${`sur ${row.total} inscrits de ton année`}</span></p>
        <${BarreTrouves} via=${row.via} autres=${row.found - row.via} attente=${row.pending} total=${row.total}/>
        ${mine?.found ? html`<div class="pr-fil"><span class="pr-fil-l" title=${me.filiere}>Ta filière</span><${Bar} value=${mine.found / mine.total} label=${`${mine.found} sur ${mine.total}`}/><span class="small mono">${mine.found} sur ${mine.total}</span></div>` : null}
        <p class="small muted pr-calme">Chacun avance à son rythme : les lauréats publient toute l’année.</p>
      </section>` : html`<section class="pr-stat good" aria-labelledby="pr-aide-t">
        ${tete('pr-aide-t', 'mentor', 'Des lauréats pour t’aider')}
        <p class="pr-chiffre"><span class="pr-stat-num"><${Compteur} v=${aidants}/></span><span class="pr-stat-lbl">${aidants > 1 ? 'lauréats de ta filière dans le réseau' : 'lauréat de ta filière dans le réseau'}</span></p>
        <button type="button" class="linkish small pr-stat-go" onClick=${() => go('mentorat')}>Trouver un mentor <${Icon} name="arrow" size=${14}/></button>
      </section>`}
    </div>
    <${SuccessFeed} ctx=${ctx} max=${3} lien=${false}/>
    ${comp.length ? html`<section class="esp-bloc" aria-labelledby="pr-ent-titre"><h2 class="esp-h" id="pr-ent-titre">Où vont les étudiants de ton année</h2>
      <ul class="esp-lignes pr-entreprises">${comp.map(([c, k]) => html`<li key=${c}><div class="esp-ligne"><${CompanyLogo} name=${c} size=${40}/><span class="pr-ent"><span class="pr-ent-nom" translate="no" dir="auto">${c}</span><span class="pr-ent-piste" aria-hidden="true"><span class="pr-ent-bar" style=${`width:${(k / maxComp) * 100}%`}></span></span></span><span class="pr-ent-n">${k}</span></div></li>`)}</ul></section>` : null}
    <//>
  </section>`;
}

injectCSS('dashboard-promo', `
.pr-avant { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .7rem; align-items: stretch; }
.pr-stat { display: flex; flex-direction: column; gap: .55rem; padding: 1rem 1.1rem; border-radius: var(--r-lg); border: 0; background: var(--surface); box-shadow: var(--sh1); min-width: 0; }
.pr-tete { display: flex; align-items: center; gap: .6rem; }
.pr-tete h2 { margin: 0; font-size: var(--fs-3); font-weight: 650; color: var(--ink); line-height: 1.3; }
.pr-stat-ico { flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--accent-soft); color: var(--blue-text); }
.pr-stat.good .pr-stat-ico { background: var(--good-soft); color: var(--good); }
.pr-chiffre { margin: 0; display: flex; align-items: baseline; flex-wrap: wrap; gap: .2rem .5rem; }
.pr-stat-num { font: 750 var(--fs-7)/1.05 var(--f-display); font-variant-numeric: tabular-nums; color: var(--ink); }
.pr-stat-lbl { color: var(--ink-2); font-size: var(--fs-2); line-height: 1.35; }
.pr-stat-go { margin-top: auto; align-self: flex-start; display: inline-flex; align-items: center; gap: .3rem; font-weight: 600; }
.pr-calme { margin: auto 0 0; }
.tr-barre { display: flex; height: 10px; border-radius: 999px; overflow: hidden; background: var(--surface-2); }
.tr-barre span { height: 100%; }
.tr-via { background: var(--good); }
.tr-autre { background: color-mix(in srgb, var(--good) 45%, var(--surface)); }
.tr-attente { background: var(--muted); }
.tr-fil { background: var(--accent); }
.tr-legende { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: .25rem .9rem; font-size: var(--fs-2); color: var(--ink-2); }
.tr-legende li { display: inline-flex; align-items: center; gap: .4rem; }
.tr-dot { flex: none; width: 9px; height: 9px; border-radius: 50%; }
.pr-fil { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: .6rem; font-size: var(--fs-2); color: var(--ink-2); padding-top: .5rem; border-top: 1px solid var(--line); }
.pr-fil .bar-fill { background: var(--good); }
@media (max-width: 640px) { .pr-avant { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 420px) { .pr-stat { padding: .9rem .85rem; } .pr-stat-num { font-size: var(--fs-6); } }
/* Où vont les étudiants de ton année : une ligne par entreprise, la barre en vert sous le nom, le nombre au bout */
.pr-entreprises .esp-ligne { min-height: 60px; padding-block: .6rem; }
.pr-ent { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .35rem; }
.pr-ent-nom { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* En arabe, un nom d'entreprise en lettres latines reste calé à droite, au-dessus de sa barre */
:root[dir="rtl"] .pr-ent-nom { text-align: right; }
.pr-ent-piste { display: block; block-size: 6px; border-radius: 3px; background: var(--surface-2); overflow: hidden; }
.pr-entreprises .pr-ent-bar { display: block; block-size: 100%; min-width: 6px; border-radius: 3px; background: var(--good); transform-origin: left center; }
[dir="rtl"] .pr-entreprises .pr-ent-bar { transform-origin: right center; }
@media (prefers-reduced-motion: no-preference) { .pr-entreprises .pr-ent-bar { animation: grow-x .4s var(--ease) .1s backwards; } }
.pr-ent-n { flex: none; min-width: 2ch; text-align: end; font: 750 var(--fs-5)/1 var(--f-display); font-variant-numeric: tabular-nums; color: var(--ink); }
/* La barre empilée de « Mon année » se remplit à l'arrivée, comme les autres */
.tr-barre { transform-origin: left center; }
[dir="rtl"] .tr-barre { transform-origin: right center; }
@media (prefers-reduced-motion: no-preference) { .tr-barre { animation: grow-x .4s var(--ease) .1s backwards; } }

/* ===== Placement | Insertion : la rangée d'onglets sous le titre, puis le panneau de l'onglet ===== */
.suivi-seg button { display: inline-flex; align-items: center; justify-content: center; gap: .35rem; }
@media (max-width: 560px) {
  .suivi-seg { display: flex; }
  .suivi-seg button { flex: 1 1 auto; min-height: 44px; padding-inline: .5rem; }
}
/* Le panneau garde l'arrivée des blocs d'une page (l'un après l'autre ; un simple fondu en mouvement réduit) */
.suivi-vue { display: flex; flex-direction: column; gap: 1.25rem; min-width: 0; }
.suivi-page > .suivi-vue { gap: 1.5rem; }
.page > div.suivi-vue { animation: none; }
.suivi-vue > * { animation: rise .4s var(--ease) backwards; }
.suivi-vue > :nth-child(1) { animation-delay: .04s; } .suivi-vue > :nth-child(2) { animation-delay: .08s; }
.suivi-vue > :nth-child(3) { animation-delay: .12s; } .suivi-vue > :nth-child(n+4) { animation-delay: .16s; }

/* ===== Tableau de bord (lauréats, administration) : un anneau, trois faits, puis chaque année d'études en barre ===== */
.suivi-page { gap: 1.5rem; }
.suivi-page .en-tete-txt { flex-basis: 12rem; }
.suivi-page .season-pick select { min-height: 44px; }
.suivi-hero { display: flex; align-items: center; gap: 1.25rem; padding: 1.2rem 1.2rem 1.25rem; border-radius: var(--r-xl); background: var(--surface); box-shadow: var(--sh1); min-width: 0; }
.suivi-hero .anneau { --trait: var(--good); }
.suivi-hero .anneau-centre { display: flex; flex-direction: column; align-items: center; gap: .1rem; }
.sh-pct { font: 750 var(--fs-6)/1 var(--f-display); letter-spacing: -.02em; color: var(--ink); }
.sh-pct-l { font: 500 var(--fs-1)/1.2 var(--f-body); color: var(--muted); }
.sh-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .3rem; }
.sh-txt h2 { margin: 0; display: flex; align-items: baseline; flex-wrap: wrap; gap: 0 .4rem; }
.sh-n { font: 750 var(--fs-titre)/1.05 var(--f-display); letter-spacing: -.02em; font-variant-numeric: tabular-nums; color: var(--ink); }
.sh-sur { font: 600 var(--fs-3)/1.3 var(--f-body); color: var(--ink-2); }
.sh-qui { margin: 0; font-size: var(--fs-2); color: var(--muted); }
.sh-faits { list-style: none; margin: .45rem 0 0; padding: .65rem 0 0; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: .4rem; }
.sh-faits li { display: flex; align-items: baseline; gap: .55rem; font-size: var(--fs-2); line-height: 1.4; color: var(--ink-2); }
.sh-faits strong { font-size: var(--fs-3); font-weight: 750; font-variant-numeric: tabular-nums; color: var(--ink); }
.sh-pt { flex: none; inline-size: 8px; block-size: 8px; border-radius: 50%; transform: translateY(-1px); }
.sh-pt.bien { background: var(--good); } .sh-pt.attente { background: var(--muted); } .sh-pt.offres { background: var(--accent); }
@media (max-width: 480px) {
  /* L'anneau à gauche du chiffre, les trois faits en dessous sur toute la largeur */
  .suivi-hero { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; column-gap: 1rem; row-gap: .9rem; padding: 1rem; }
  .suivi-hero .sh-txt { display: contents; }
  .suivi-hero > .anneau { grid-row: 1 / span 2; }
  .suivi-hero .sh-txt h2 { grid-column: 2; align-self: end; }
  .suivi-hero .sh-qui { grid-column: 2; align-self: start; }
  .sh-faits { grid-column: 1 / -1; margin-top: 0; }
}
/* Chaque année d'études : son objectif et sa part en %, la barre qui se remplit (et le trait du rythme attendu),
   puis la lecture (dans les temps, à surveiller…) et les chiffres, coupés seulement entre deux faits */
.suivi-annees .esp-lignes > li + li::before { inset-inline-start: calc(1rem + 44px + .85rem); }
.suivi-annees .sa-ligne { align-items: flex-start; padding-block: .85rem; }
.sa-ligne.on { background: var(--sel-bg); }
.sa-niv { flex: none; display: grid; place-items: center; inline-size: 44px; block-size: 44px; border-radius: var(--r-md); background: var(--accent-soft); color: var(--blue-text); font: 750 var(--fs-3)/1 var(--f-display); }
.sa-corps { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .5rem; }
.sa-l1 { display: flex; align-items: baseline; gap: .75rem; }
.sa-obj { flex: 1; min-width: 0; font-weight: 650; line-height: 1.3; color: var(--ink); }
.sa-pct { flex: none; font: 750 var(--fs-5)/1 var(--f-display); font-variant-numeric: tabular-nums; color: var(--ink); }
.sa-corps > .bar { height: 8px; }
.sa-corps > .bar .bar-fill { background: var(--good); }
/* Les faits passent à la ligne entre deux faits seulement ; le point qui les sépare tombe hors champ en début de ligne */
.sa-faits { display: block; overflow: hidden; line-height: 1.45; }
.sa-faits-in { display: flex; flex-wrap: wrap; margin-inline-start: -1.1em; }
.sa-faits-in > span { white-space: nowrap; }
.sa-faits-in > span::before { content: "·"; content: "·" / ""; display: inline-block; inline-size: 1.1em; text-align: center; color: var(--muted); font-weight: 400; }
.sa-ton { font-weight: 650; }
.sa-ton-pt { display: inline-block; inline-size: 8px; block-size: 8px; border-radius: 50%; background: currentColor; margin-inline-end: .35rem; transform: translateY(-1px); }
.sa-ton.t-good { color: var(--good); } .sa-ton.t-warn { color: var(--warn); } .sa-ton.t-bad { color: var(--bad); }
.sa-legende { list-style: none; margin: 0; padding: 0 .25rem; display: flex; flex-wrap: wrap; gap: .3rem 1.1rem; font-size: var(--fs-2); line-height: 1.4; color: var(--muted); }
.sa-legende li { display: inline-flex; align-items: center; gap: .5rem; }
.sa-lg-plein { flex: none; inline-size: 18px; block-size: 8px; border-radius: 4px; background: var(--good); }
.sa-lg-trait { flex: none; inline-size: 2px; block-size: 14px; border-radius: 1px; background: var(--ink); margin-inline: 8px; }
.suivi-detail-titre { margin: 0; }
/* Une année touchée : la page glisse jusqu'au détail, qui s'arrête sous la barre du haut */
.suivi-detail { scroll-margin-top: 80px; }
/* Le détail d'une année : chaque filière sur deux lignes (le code, la barre verte, la part ; puis son nom en clair),
   les barres alignées d'une filière à l'autre ; puis ceux qui cherchent encore */
.sd-paire { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; align-items: start; }
.sd-filieres .esp-lignes > li + li::before { inset-inline-start: 1rem; }
.sd-filieres .esp-lignes .sd-fil { display: grid; grid-template-columns: 5.25rem minmax(0, 1fr) minmax(4.5rem, auto); align-items: center; gap: .15rem .75rem; min-height: 0; padding-block: .7rem; }
.sd-fil-code { min-width: 0; font-weight: 650; color: var(--ink); overflow-wrap: anywhere; }
.sd-fil-n { font-size: var(--fs-2); font-weight: 600; font-variant-numeric: tabular-nums; color: var(--ink-2); text-align: end; white-space: nowrap; }
.sd-fil-nom { grid-column: 1 / -1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sd-fil .bar { margin: 0; }
.sd-fil .bar-fill { background: var(--good); }
.sd-note { margin: 0; }
.sd-plus { align-self: flex-start; display: inline-flex; align-items: center; min-height: 44px; margin-top: -.5rem; font-size: var(--fs-2); }
.sd-etat { font-weight: 600; background: none; }
.sd-etat::before { content: ""; display: inline-block; inline-size: 7px; block-size: 7px; border-radius: 50%; background: currentColor; margin-inline-end: .3rem; transform: translateY(-1px); }
.sd-etat.s-entretiens { color: var(--blue-text); } .sd-etat.s-validation { color: var(--brass); } .sd-etat.s-candidatures, .sd-etat.s-recherche { color: var(--ink-2); }
@media (min-width: 900px) { .sd-paire { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 900px) {
  .suivi-hero { padding: 1.5rem 1.75rem; gap: 2rem; }
  .sh-faits { flex-direction: row; flex-wrap: wrap; gap: .4rem 1.75rem; }
}
`);

addAR({
  'Mon année': 'سنتي', 'Année terminée': 'انتهت السنة', 'Où vont les étudiants de ton année': 'أين يتجه طلبة سنتك',
  'Liste complète de l’année (une ligne par étudiant), à ouvrir dans Excel.': 'اللائحة الكاملة للسنة (سطر لكل طالب)، تُفتح في Excel.',
  'Offres pour ton année': 'عروض لسنتك', 'ouvertes en ce moment': 'مفتوحة حاليًا', 'ouverte en ce moment': 'مفتوح حاليًا',
  'Camarades qui ont trouvé': 'زملاء وجدوا فرصتهم', 'Des lauréats pour t’aider': 'خريجون لمساعدتك',
  'vérifiées des deux côtés': 'موثّقة من الطرفين',
  'lauréats de ta filière dans le réseau': 'خريجون من شعبتك في الشبكة',
  'lauréat de ta filière dans le réseau': 'خريج من شعبتك في الشبكة',
  '1 offre cible ta filière': 'عرض واحد يستهدف شعبتك',
  'Chacun avance à son rythme : les lauréats publient toute l’année.': 'كل واحد يتقدم بإيقاعه: ينشر الخريجون العروض طوال السنة.',
  // Tableau de bord : l'anneau, les trois faits, les années d'études
  'Vue du suivi': 'عرض المتابعة', 'ont trouvé': 'وجدوا فرصتهم', 'Par année d’études': 'حسب سنة الدراسة',
  '3A, 4A, 5A et jeunes diplômés': '3A و4A و5A والخريجون الجدد', 'à confirmer par l’étudiant': 'في انتظار تأكيد الطالب',
  'Plus personne ne cherche dans cette année.': 'لم يعد أحد يبحث في هذه السنة.',
}, [
  [/^Voir les (\d+) autres$/, n => `عرض الآخرين (${n})`],
  [/^sur (\d+) inscrits?$/, k => `من أصل ${arCount(k, ['مسجَّل واحد', 'مسجَّلَين', 'مسجَّلين', 'مسجَّلًا'])}`],
  [/^grâce à la plateforme \((\d+(?:[.,]\d+)?)\s?% des réussites\)$/, k => `بفضل المنصة (${k}% من النجاحات)`],
  [/^(\d+) offres ciblent ta filière$/, k => `${arCount(k, ['عرض واحد', 'عرضان', 'عروض', 'عرضًا'])} تستهدف شعبتك`],
  [/^sur (\d+) inscrits? de ton année$/, k => `من أصل ${arCount(k, ['مسجَّل واحد', 'مسجَّلَين', 'مسجَّلين', 'مسجَّلًا'])} في سنتك`],
  [/^(\d+) grâce à un lauréat$/, k => `${k} بفضل خريج`],
  [/^(\d+) hors plateforme$/, k => `${k} خارج المنصة`],
  [/^(\d+(?:[.,]\d+)?)\s?% des réussites$/, k => `${k}% من النجاحات`],
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
  'Ta réponse compte : elle aide les promos suivantes.': 'جوابك مهم: يساعد الدفعات القادمة.',
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
/* Le tableau qui défile se prend au clavier (flèches), avec un contour visible */
.tbl-scroll:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: var(--r-sm, 6px); }
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
  body.print-ins .side, body.print-ins .top, body.print-ins .bottom-nav, body.print-ins .demo-band, body.print-ins .ins-noprint, body.print-ins .toast, body.print-ins .insertion > .en-tete { display: none !important; }
  body.print-ins .shell { display: block !important; }
  body.print-ins .content { padding: 0 !important; }
  body.print-ins .page { max-width: none !important; gap: .4rem !important; }
  body.print-ins .page > *, body.print-ins .suivi-vue > * { animation: none !important; }
  body.print-ins .suivi-vue { gap: .4rem !important; }
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
    <${EnTetePage} surTitre="Enquête d’insertion" titre=${etu ? 'Après le diplôme' : 'Insertion des diplômés'}>
      <${SuiviSeg} ctx=${ctx} on="insertion"/>
      ${promos.length ? html`<div class="ins-pick ins-noprint">
        <label class="season-pick">Promotion <select id="ins-promo" value=${p} onChange=${e => { setPromo(+e.target.value); setVague(null); }}>${promos.map(x => html`<option value=${x}>${x}</option>`)}</select></label>
        ${vagues.length > 1 ? html`<div class="seg small-seg" role="group" aria-label="Vague">${vagues.map(x => html`<button type="button" class=${x === v ? 'on' : ''} aria-pressed=${x === v} onClick=${() => setVague(x)}>${x} mois</button>`)}</div>` : null}
      </div>` : null}
    <//>
    <${VueSuivi} on="insertion">
    ${due ? html`<div class="hint-box ins-noprint"><${Icon} name="chart" size=${16}/><span class="grow">Ta réponse compte : elle aide les promos suivantes.</span><button class="btn small primary" onClick=${() => go('enquete')}>Répondre</button></div>` : null}

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
    <//>
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
    ${rows === null ? html`<p class="muted">Chargement…</p>` : !list.length ? html`<p class="muted">Aucune ligne pour ces filtres.</p>` : html`<div class="tbl-scroll" tabindex="0" role="region" aria-label="Rapport d’insertion"><table class="tbl ins-rapport">
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
