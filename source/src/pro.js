// Annuaire pro : personnes (entreprise, ville, pays, secteur), carte des lauréats, entreprises, startups.
import { html, useState, useMemo, useEffect, useRef } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, CompanyLogo, toast } from './ui.js';
import { getLang } from './i18n.js';
import { FILIERES, SECTEURS, TYPES, niveauOf, entKey, sameCompany, seasonLabel } from './logic.js';
import { coordsOf, canonPays, countryCentroid, PAYS_AR } from './geo.js';
import { OfferCard, matchesMe } from './offers.js';
import { EntrepriseResume, QuestionsRecentes } from './entreprises.js';
import { SignalerBtn } from './confiance.js';

// Les entreprises ont leur propre onglet (Réseau > Entreprises), avec les avis et les entretiens
const VUES = [['personnes', 'Personnes', 'people'], ['carte', 'Carte', 'pin'], ['startups', 'Startups', 'spark']];
const paysLabel = p => (getLang() === 'ar' && PAYS_AR[canonPays(p)]) || canonPays(p);

export function AnnuairePro({ ctx }) {
  // Ancien lien « Annuaire > Entreprises »
  useEffect(() => { if (ctx.sub2 === 'entreprises') ctx.go('reseau/entreprises'); }, [ctx.sub2]);
  const vue = VUES.some(([k]) => k === ctx.sub2) ? ctx.sub2 : 'personnes';
  return html`<div class="sub-page">
    <div class="seg" role="tablist" aria-label="Annuaire">${VUES.map(([k, l, i]) => html`<button role="tab" aria-selected=${vue === k} class=${vue === k ? 'on' : ''} onClick=${() => ctx.go('reseau/annuaire' + (k === 'personnes' ? '' : '/' + k))}><${Icon} name=${i} size=${15}/> ${l}</button>`)}</div>
    ${vue === 'personnes' ? html`<${Personnes} ctx=${ctx}/>` : null}
    ${vue === 'carte' ? html`<${Carte} ctx=${ctx}/>` : null}
    ${vue === 'startups' ? html`<${Startups} ctx=${ctx}/>` : null}
  </div>`;
}

// ---------------------------------------------------------------------------
// Personnes
// ---------------------------------------------------------------------------
function Personnes({ ctx }) {
  const { data, scores, openProfile, me, saison } = ctx;
  const [q, setQ] = useState(''); const [role, setRole] = useState(''); const [fil, setFil] = useState(''); const [sect, setSect] = useState(''); const [abroad, setAbroad] = useState(false);
  const myN = me.role === 'etudiant' ? niveauOf(me, saison) : null; // un étudiant voit les lauréats et sa propre promo
  const qq = q.trim().toLowerCase();
  const dir = data.profiles.filter(p => p.role !== 'admin' && (myN === null || p.role !== 'etudiant' || niveauOf(p, saison) === myN) && (!role || p.role === role) && (!fil || p.filiere === fil)
    && (!sect || p.secteur === sect) && (!abroad || (p.pays && canonPays(p.pays) !== 'Maroc'))
    && (!qq || `${p.full_name} ${p.entreprise || ''} ${p.ville || ''} ${p.pays || ''} ${p.poste || ''} ${p.secteur || ''} ${(p.competences || []).join(' ')}`.toLowerCase().includes(qq)))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  return html`<div class="sub-page">
    <div class="filter-row"><label class="search"><${Icon} name="search" size=${16}/><input id="d-q" placeholder="Nom, entreprise, ville, compétence…" value=${q} onInput=${e => setQ(e.target.value)}/></label>
      <select id="d-role" value=${role} onChange=${e => setRole(e.target.value)} aria-label="Rôle"><option value="">Tous</option><option value="laureat">Lauréats</option><option value="etudiant">${myN ? 'Ma promo' : 'Étudiants'}</option></select>
      <select id="d-fil" value=${fil} onChange=${e => setFil(e.target.value)} aria-label="Filière"><option value="">Toutes filières</option>${FILIERES.map(f => html`<option value=${f}>${f}</option>`)}</select>
      <select id="d-sect" value=${sect} onChange=${e => setSect(e.target.value)} aria-label="Secteur"><option value="">Tous secteurs</option>${SECTEURS.map(f => html`<option value=${f}>${f}</option>`)}</select></div>
    <div class="chips"><button class=${'chip' + (abroad ? ' on' : '')} aria-pressed=${abroad} onClick=${() => setAbroad(!abroad)}><${Icon} name="globe" size=${14}/> À l’étranger</button><span class="muted small">${dir.length} membre${dir.length > 1 ? 's' : ''}</span></div>
    <ul class="dir">${dir.slice(0, 150).map(p => html`<li key=${p.id}><${Person} p=${p} score=${scores.get(p.id)} onOpen=${openProfile}/>
      <span class="muted small">${[p.poste, p.secteur, p.ville, p.pays && canonPays(p.pays) !== 'Maroc' ? paysLabel(p.pays) : ''].filter(Boolean).join(' · ')}</span>
      ${p.role === 'laureat' && p.entreprise ? html`<button class="linkish small ent-link" onClick=${() => ctx.openEntreprise(p.entreprise)}><${Icon} name="briefcase" size=${13}/> ${p.entreprise}</button>` : null}</li>`)}</ul>
    ${dir.length > 150 ? html`<p class="muted small center">Affine la recherche pour voir les autres.</p>` : null}
  </div>`;
}

// ---------------------------------------------------------------------------
// Carte des lauréats (Leaflet, chargé seulement quand on ouvre la carte)
// ---------------------------------------------------------------------------
let leafletP = null;
function loadLeaflet() {
  leafletP ||= new Promise((ok, ko) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'vendor/leaflet.css'; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = 'vendor/leaflet.js';
    s.onload = () => ok(window.L); s.onerror = () => { leafletP = null; ko(new Error('La carte ne se charge pas. Vérifie ta connexion.')); };
    document.head.appendChild(s);
  });
  return leafletP;
}
const darkMode = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };

function Carte({ ctx }) {
  const { data, openProfile } = ctx;
  const ref = useRef(), mapRef = useRef(null);
  const [err, setErr] = useState(null);
  const [sel, setSel] = useState(null);
  // Un point par ville (ou par pays quand la ville est inconnue)
  const { points, sans, parPays } = useMemo(() => {
    const m = new Map(); let sans = 0; const pp = new Map();
    for (const p of data.profiles) {
      if (p.role !== 'laureat') continue;
      const pays = canonPays(p.pays || 'Maroc');
      pp.set(pays, (pp.get(pays) || 0) + 1);
      const c = coordsOf(p.ville, pays);
      if (!c) { sans++; continue; }
      const k = c.join(',');
      const x = m.get(k) || { k, c, ville: p.ville || pays, pays, people: [] };
      x.people.push(p); m.set(k, x);
    }
    return { points: [...m.values()].sort((a, b) => b.people.length - a.people.length), sans, parPays: [...pp.entries()].sort((a, b) => b[1] - a[1]) };
  }, [data.profiles]);
  useEffect(() => {
    let map = null, on = true;
    loadLeaflet().then(L => {
      if (!on || !ref.current) return;
      map = mapRef.current = L.map(ref.current, { scrollWheelZoom: false, worldCopyJump: true, attributionControl: true });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
      L.tileLayer(`https://{s}.basemaps.cartocdn.com/${darkMode() ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`, { maxZoom: 12, subdomains: 'abcd', attribution: '© OpenStreetMap · © CARTO' }).addTo(map);
      const css = getComputedStyle(document.documentElement);
      const blue = css.getPropertyValue('--accent').trim() || '#1670A8', orange = css.getPropertyValue('--orange').trim() || '#F39200';
      for (const pt of points) {
        const n = pt.people.length, col = pt.pays === 'Maroc' ? blue : orange;
        L.circleMarker(pt.c, { radius: Math.min(26, 6 + Math.sqrt(n) * 3.2), color: col, weight: 2, fillColor: col, fillOpacity: 0.55 })
          .bindTooltip(`${pt.ville} · ${n}`, { direction: 'top' }).on('click', () => setSel(pt.k)).addTo(map);
      }
      const ma = points.filter(p => p.pays === 'Maroc');
      if (ma.length) map.fitBounds(L.latLngBounds(ma.map(p => p.c)).pad(0.25), { maxZoom: 6 }); else map.setView([31.8, -7.1], 5);
    }).catch(e => on && setErr(e.message));
    return () => { on = false; mapRef.current = null; map?.remove(); };
  }, [points]);
  const pt = points.find(p => p.k === sel);
  const voirPays = p => {
    const map = mapRef.current; if (!map) return;
    const ici = points.filter(x => x.pays === p);
    if (ici.length > 1) map.flyToBounds(ici.map(x => x.c), { padding: [40, 40], maxZoom: 7 });
    else if (ici.length) { map.flyTo(ici[0].c, 7); setSel(ici[0].k); }
    else { const c = countryCentroid(p); if (c) map.flyTo(c, 5); }
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  return html`<div class="sub-page">
    <p class="muted small">Où travaillent les lauréats de l’ENSAM Meknès. Clique sur un point pour voir qui est là. En bleu le Maroc, en orange l’étranger.</p>
    ${err ? html`<p class="warn-t small">${err}</p>` : null}
    <div class="map" ref=${ref} dir="ltr" role="img" aria-label="Carte des lauréats"></div>
    ${pt ? html`<div class="panel"><div class="section-head"><h2 class="h-ico"><${Icon} name="pin"/> <span translate="no" dir="auto">${pt.ville}</span>${pt.pays !== 'Maroc' ? `, ${paysLabel(pt.pays)}` : ''}</h2><span class="muted small">${pt.people.length} lauréat${pt.people.length > 1 ? 's' : ''}</span></div>
      <ul class="people-list">${pt.people.map(p => html`<li key=${p.id}><${Person} p=${p} onOpen=${openProfile} size=${32}/><span class="muted small">${p.poste || ''}</span></li>`)}</ul></div>` : null}
    <div class="pays-cloud">${parPays.map(([p, n]) => html`<button type="button" class=${'mini' + (p === 'Maroc' ? '' : ' hit')} onClick=${() => voirPays(p)}>${paysLabel(p)} · ${n}</button>`)}</div>
    ${sans ? html`<p class="muted small">${sans} lauréat${sans > 1 ? 's' : ''} sans ville connue. Complète ta ville dans ton profil pour apparaître sur la carte.</p>` : null}
  </div>`;
}

// ---------------------------------------------------------------------------
// Entreprises : regroupées par nom normalisé (« Renault Group Maroc » = « Renault »)
// ---------------------------------------------------------------------------
export function companiesOf(data) {
  const m = new Map();
  const add = (name, kind, row) => {
    const k = entKey(name); if (!k) return;
    const x = m.get(k) || { k, names: new Map(), laureats: [], offres: [], recrues: [] };
    x.names.set(name.trim(), (x.names.get(name.trim()) || 0) + 1);
    x[kind].push(row); m.set(k, x);
  };
  for (const p of data.profiles) if (p.role === 'laureat' && p.entreprise) add(p.entreprise, 'laureats', p);
  for (const o of data.offers) if (o.entreprise) add(o.entreprise, 'offres', o);
  for (const p of data.placements) if (p.entreprise && p.status === 'confirme') add(p.entreprise, 'recrues', p);
  return [...m.values()].map(x => ({ ...x, nom: [...x.names.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0] }));
}

export function EntrepriseModal({ ctx, name, onClose }) {
  const { data, me, saison, store, openProfile, openOffer } = ctx;
  const c = useMemo(() => companiesOf(data).find(x => sameCompany(x.nom, name) || x.k === entKey(name)), [data, name]);
  const voirTout = html`<button class="btn small ghost" onClick=${() => { onClose(); ctx.go('reseau/entreprises/' + encodeURIComponent(entKey(name) || name)); }}><${Icon} name="star" size=${15}/> Voir les avis et entretiens</button>`;
  const avisOuEntretiens = (data.avis_stage || []).some(a => sameCompany(a.entreprise, name)) || (data.entretiens || []).some(e => sameCompany(e.entreprise, name));
  if (!c) return html`<${Modal} title=${name} onClose=${onClose}>${avisOuEntretiens ? html`<div class="detail"><${EntrepriseResume} ctx=${ctx} entreprise=${name} onOpen=${onClose}/><${QuestionsRecentes} ctx=${ctx} entreprise=${name}/></div>` : html`<p class="muted">Pas encore d’informations sur cette entreprise.</p>`}<//>`;
  const offres = c.offres.filter(o => o.status === 'ouverte' && (me.role !== 'etudiant' || matchesMe(o, me, saison)));
  const villes = [...new Set([...c.laureats.map(p => p.ville), ...c.offres.map(o => o.ville)].filter(Boolean))].slice(0, 4);
  const secteurs = [...new Set(c.laureats.map(p => p.secteur).filter(Boolean))];
  const parSaison = new Map();
  for (const p of c.recrues) parSaison.set(p.saison, (parSaison.get(p.saison) || 0) + 1);
  return html`<${Modal} title=${c.nom} onClose=${onClose} wide>
    <div class="detail">
      <div class="detail-head"><${CompanyLogo} name=${c.nom} size=${56}/><div class="detail-title"><h2 translate="no">${c.nom}</h2><p class="muted small">${[...secteurs, ...villes].join(' · ')}</p></div></div>
      <${EntrepriseResume} ctx=${ctx} entreprise=${c.nom} onOpen=${onClose}/>
      <${QuestionsRecentes} ctx=${ctx} entreprise=${c.nom}/>
      ${avisOuEntretiens ? html`<div>${voirTout}</div>` : null}
      <div class="profile-stats"><span><b class="mono">${c.laureats.length}</b> lauréat${c.laureats.length > 1 ? 's' : ''}</span><span><b class="mono">${offres.length}</b> offre${offres.length > 1 ? 's' : ''} ouverte${offres.length > 1 ? 's' : ''}</span><span><b class="mono">${c.recrues.length}</b> recrue${c.recrues.length > 1 ? 's' : ''} confirmée${c.recrues.length > 1 ? 's' : ''}</span></div>
      ${c.laureats.length ? html`<h3>Lauréats chez ${c.nom}</h3><ul class="people-list">${c.laureats.map(p => html`<li key=${p.id}><${Person} p=${p} onOpen=${openProfile} size=${32}/><span class="muted small">${p.poste || ''}${p.ville ? ' · ' + p.ville : ''}</span></li>`)}</ul>` : null}
      ${offres.length ? html`<h3>Offres ouvertes</h3><div class="offer-grid one">${offres.map(o => html`<${OfferCard} key=${o.id} o=${o} ctx=${ctx} onOpen=${() => { onClose(); openOffer(o.id); }}/>`)}</div>` : null}
      ${c.recrues.length ? html`<h3>Recrutés grâce au réseau</h3><ul class="events">${[...parSaison.entries()].sort((a, b) => b[0] - a[0]).map(([s, n]) => html`<li><span class="mono pts">${n}</span> Saison ${seasonLabel(s)}</li>`)}</ul>
        <p class="small muted">${c.recrues.slice(0, 6).map((p, i) => html`${i ? ', ' : ''}<span translate="no">${store.byId('profiles', p.student_id)?.full_name?.split(' ')[0] || ''}</span> (${TYPES[p.type]?.label || ''})`)}</p>` : null}
      ${c.laureats.length && me.role !== 'admin' && !c.laureats.some(p => p.id === me.id) ? html`<div class="hint-box"><${Icon} name="qa" size=${16}/><span class="grow small">Une question sur ${c.nom} ? Les lauréats qui y travaillent la reçoivent directement.</span><button class="btn tiny primary" onClick=${() => { onClose(); ctx.askQuestion({ entreprise: c.nom }); }}>Poser une question</button></div>` : null}
    </div>
  <//>`;
}

// ---------------------------------------------------------------------------
// Vitrine des startups de lauréats
// ---------------------------------------------------------------------------
function Startups({ ctx }) {
  const { data, me, store, act, openProfile } = ctx;
  const [only, setOnly] = useState(false);
  const [form, setForm] = useState(null);
  const list = data.startups.filter(s => !only || s.recrute).sort((a, b) => (b.recrute - a.recrute) || new Date(b.created_at) - new Date(a.created_at));
  return html`<div class="sub-page">
    <div class="toolbar"><p class="muted small grow">Les entreprises créées par des lauréats de l’école, et celles qui cherchent des stagiaires.</p>
      ${me.role !== 'etudiant' ? html`<button class="btn small primary" onClick=${() => setForm({})}><${Icon} name="plus" size=${15}/> Ajouter ma startup</button>` : null}</div>
    <div class="chips"><button class=${'chip' + (only ? ' on' : '')} aria-pressed=${only} onClick=${() => setOnly(!only)}><${Icon} name="briefcase" size=${14}/> Cherchent des stagiaires</button></div>
    <div class="cards">${list.length ? list.map(s => { const f = store.byId('profiles', s.fondateur_id); return html`<article class="tcard startup" key=${s.id}>
      <div class="tcard-head"><${CompanyLogo} name=${s.nom} size=${44}/><div class="grow"><strong translate="no">${s.nom}</strong><p class="muted small">${[s.secteur, s.ville, s.pays && s.pays !== 'Maroc' ? s.pays : ''].filter(Boolean).join(' · ')}</p></div>
        ${s.fondateur_id === me.id || me.role === 'admin' ? html`<button class="icon-btn small" aria-label="Modifier" onClick=${() => setForm(s)}><${Icon} name="edit" size=${15}/></button>` : html`<${SignalerBtn} ctx=${ctx} type="startup" id=${s.id} small/>`}</div>
      <p translate="no" dir="auto">${s.pitch}</p>
      ${s.recrute ? html`<span class="tag coopt"><${Icon} name="briefcase" size=${13}/> Cherche des stagiaires</span>` : null}
      <div class="row tcard-foot">${f ? html`<${Person} p=${f} onOpen=${openProfile} size=${28} sub=${'Fondateur · Promo ' + f.promo}/>` : null}<span class="spacer"></span>
        ${s.site ? html`<a class="btn tiny ghost" href=${s.site} target="_blank" rel="noopener"><${Icon} name="link" size=${14}/> Site</a>` : null}</div>
    </article>`; }) : html`<${Empty} icon="spark" title="Aucune startup pour l’instant">Tu as créé une entreprise ? Présente-la ici : les étudiants pourront te contacter.<//>`}</div>
    ${form ? html`<${StartupForm} ctx=${ctx} s=${form} onClose=${() => setForm(null)}/>` : null}
  </div>`;
}

function StartupForm({ ctx, s, onClose }) {
  const { store, me, act } = ctx;
  const editing = !!s.id;
  const [f, setF] = useState({ nom: '', pitch: '', secteur: 'Startup', ville: me.ville || '', pays: me.pays || 'Maroc', site: '', recrute: false, ...s });
  const set = (k, v) => setF({ ...f, [k]: v });
  const site = f.site?.trim() ? (/^https?:\/\//i.test(f.site.trim()) ? f.site.trim().replace(/^http:/i, 'https:') : 'https://' + f.site.trim()) : null;
  const ok = f.nom.trim().length >= 2 && f.pitch.trim().length >= 10;
  const submit = e => { e.preventDefault(); if (!ok) return; act(async () => {
    const row = { nom: f.nom.trim(), pitch: f.pitch.trim(), secteur: f.secteur || null, ville: f.ville.trim() || null, pays: f.pays.trim() || 'Maroc', site, recrute: !!f.recrute };
    if (editing) await store.update('startups', s.id, row); else await store.insert('startups', { ...row, fondateur_id: me.id });
    toast(editing ? 'Startup mise à jour.' : 'Ta startup est dans la vitrine.'); onClose();
  }); };
  return html`<${Modal} title=${editing ? 'Modifier la startup' : 'Ajouter ma startup'} onClose=${onClose}>
    <form class="form" onSubmit=${submit}>
      <${Field} label="Nom"><input id="su-nom" required maxlength="80" value=${f.nom} onInput=${e => set('nom', e.target.value)}/><//>
      <${Field} label="En une ou deux phrases" hint=${`${f.pitch.length}/400`}><textarea id="su-pitch" rows="3" maxlength="400" required value=${f.pitch} onInput=${e => set('pitch', e.target.value)} placeholder="Ce que fait l’entreprise, pour qui."></textarea><//>
      <div class="grid3"><${Field} label="Secteur"><select id="su-sect" value=${f.secteur || ''} onChange=${e => set('secteur', e.target.value)}>${SECTEURS.map(x => html`<option value=${x}>${x}</option>`)}</select><//>
        <${Field} label="Ville"><input id="su-ville" value=${f.ville || ''} onInput=${e => set('ville', e.target.value)}/><//>
        <${Field} label="Pays"><input id="su-pays" value=${f.pays || ''} onInput=${e => set('pays', e.target.value)}/><//></div>
      <${Field} label="Site web"><input id="su-site" value=${f.site || ''} onInput=${e => set('site', e.target.value)} placeholder="https://…" dir="ltr"/><//>
      <label class="check"><input id="su-rec" type="checkbox" checked=${f.recrute} onChange=${e => set('recrute', e.target.checked)}/> Nous cherchons des stagiaires</label>
      <div class="row-end">${editing ? html`<button type="button" class="btn ghost danger-t" onClick=${() => ctx.confirm('Retirer cette startup de la vitrine ?', () => act(async () => { await store.remove('startups', s.id); onClose(); }), 'Retirer')}>Retirer</button><span class="spacer"></span>` : null}
        <button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" disabled=${!ok}>${editing ? 'Enregistrer' : 'Publier'}</button></div>
    </form>
  <//>`;
}
