// Console d'administration · Membres : sur ordinateur, un vrai tableau (trier par colonne, cocher des lignes, copier les emails,
// exporter en CSV) ; sur téléphone, la liste habituelle. Les filtres tiennent sur une rangée : Tous, Étudiants, Lauréats,
// À vérifier, Sans CV, Sans photo, Inactifs 30 j, puis la promo et la recherche.
import { html, useState, useRef, useEffect } from './vendor/preact-htm.js';
import { Icon, Person, toast, injectCSS } from './ui.js';
import { useVoirPlus, VoirPlus } from './lignes.js';
import { addAR, arCount } from './i18n.js';
import { NIVEAUX, niveauOf, timeAgo, filiereCourte, compteOuvert } from './logic.js';
import { telecharger, copier, useLarge } from './admin-console.js';
import { ROLES, aCV, aPhoto, FILTRES, TESTS, COLS, jour, ENTETES_CSV, ligneCSV, membresFiltres } from './admin-console-regles.js';


addAR({
  'À vérifier': 'للتحقق', 'Sans CV': 'دون سيرة ذاتية', 'Sans photo': 'دون صورة', 'Inactifs 30 j': 'غير نشطين منذ 30 يومًا',
  'Filtrer les membres': 'تصفية الأعضاء', 'Toutes les promos': 'كل الدفعات', 'Dernière visite': 'آخر زيارة', 'Vérifié': 'متحقَّق منه',
  'Tout sélectionner': 'تحديد الكل', 'Tout désélectionner': 'إلغاء التحديد', 'Pour toute la liste :': 'لكل اللائحة:',
  'Aucun email connu pour ces membres.': 'لا بريد معروف لهؤلاء الأعضاء.', 'Oui': 'نعم', 'Non': 'لا', 'Trier par': 'ترتيب حسب',
  'Aucun membre ne correspond à ces filtres.': 'لا عضو يطابق هذه المرشحات.',
}, [
  [/^Sélectionner (.+)$/, n => `تحديد ${n}`],
  [/^(\d+) sélectionnés?$/, n => arCount(n, ['عضو واحد محدَّد', 'عضوان محدَّدان', 'أعضاء محدَّدين', 'عضوًا محدَّدًا'])],
]);

const dateCourte = d => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function CaseTout({ etat, onChange }) {
  const ref = useRef();
  useEffect(() => { if (ref.current) ref.current.indeterminate = etat === 'partiel'; });
  return html`<label class="cs-case"><input ref=${ref} type="checkbox" checked=${etat === 'tout'} aria-label="Tout sélectionner" onChange=${onChange}/></label>`;
}

function Coche({ oui, label }) {
  return oui ? html`<span class="cs-oui"><${Icon} name="check" size=${16}/><span class="sr-only">${label || 'Oui'}</span></span>` : html`<span class="cs-non" aria-hidden="true">–</span><span class="sr-only">Non</span>`;
}

export function TableMembres({ ctx, comptes }) {
  const { data, store, act, openProfile, saison } = ctx;
  const large = useLarge();
  const [filtre, setFiltre] = useState('tous');
  const [promo, setPromo] = useState('');
  const [q, setQ] = useState('');
  const [tri, setTri] = useState({ k: 'inscrit', desc: true });
  const [sel, setSel] = useState(() => new Set());
  const now = Date.now();
  const compte = new Map((comptes || []).map(c => [c.id, c]));
  const membres = data.profiles.filter(p => p.role !== 'admin');
  const liste = membresFiltres(data.profiles, comptes, { filtre, promo, q, tri }, now);
  const { vus, reste, plus } = useVoirPlus(liste, large ? 50 : 20, [filtre, promo, q.trim(), tri.k, tri.desc].join('|'));
  const nb = k => membres.filter(p => TESTS[k](p, compte.get(p.id), now, !!comptes)).length;
  const promos = [...new Set(membres.map(p => p.promo).filter(x => x != null && x !== ''))].sort((a, b) => b - a);
  const sansProfil = (comptes || []).filter(c => !c.a_profil && compteOuvert(c));
  const choisis = liste.filter(p => sel.has(p.id));
  const cibles = choisis.length ? choisis : liste;
  const basculer = id => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const etatTout = vus.length && vus.every(p => sel.has(p.id)) ? 'tout' : vus.some(p => sel.has(p.id)) ? 'partiel' : 'rien';
  const toutBasculer = () => setSel(s => { const n = new Set(s); if (etatTout === 'tout') vus.forEach(p => n.delete(p.id)); else vus.forEach(p => n.add(p.id)); return n; });
  const trier = k => setTri(t => (t.k === k ? { k, desc: !t.desc } : { k, desc: k === 'inscrit' || k === 'vu' }));
  const emails = () => { const l = cibles.map(p => compte.get(p.id)?.email).filter(Boolean); if (!l.length) return toast('Aucun email connu pour ces membres.', 'err'); copier(l.join(', '), 'Emails copiés.'); };
  const exporter = () => telecharger(`membres-reseau-ensam-${jour(now)}.csv`, [ENTETES_CSV, ...cibles.map(p => ligneCSV(p, compte.get(p.id)))]);
  const role = p => html`<select id=${'role-' + p.id} aria-label="Rôle" value=${p.role} onChange=${e => act(async () => { await store.update('profiles', p.id, { role: e.target.value }); toast('Rôle modifié.'); })}>${ROLES.map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select>`;
  const filtres = (q || promo || filtre !== 'tous');

  return html`<div class="panel cs-membres-panel" id="adm-membres">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="people"/> Membres <span class="count">${membres.length}</span></h2>
      <label class="search"><${Icon} name="search" size=${16}/><input id="adm-q" placeholder="Nom, email, filière, promo…" value=${q} onInput=${e => setQ(e.target.value)}/></label></div>
    <div class="cs-filtres">
      <div class="chips rangee cs-puces" role="group" aria-label="Filtrer les membres">${FILTRES.map(([k, l]) => html`<button type="button" key=${k} id=${'mb-f-' + k} class=${'chip' + (filtre === k ? ' on' : '')} aria-pressed=${filtre === k} onClick=${() => setFiltre(k)}>${l} <span class="count">${k === 'tous' ? membres.length : nb(k)}</span></button>`)}</div>
      <select id="mb-promo" class="cs-promo" aria-label="Promo" value=${promo} onChange=${e => setPromo(e.target.value)}><option value="">Toutes les promos</option>${promos.map(p => html`<option key=${p} value=${p}>${p}</option>`)}</select>
    </div>
    ${sansProfil.length ? html`<p class="small hint-box"><${Icon} name="user" size=${15}/> <span>${sansProfil.length} compte${sansProfil.length > 1 ? 's' : ''} créé${sansProfil.length > 1 ? 's' : ''} sans profil (inscription pas terminée) : <span class="mono" dir="ltr" translate="no">${sansProfil.slice(0, 5).map(c => c.email).join(', ')}</span></span></p>` : null}
    <div class="cs-barre">
      <p class="liste-tete">${filtres ? `${liste.length} sur ${membres.length} membres` : `${membres.length} membre${membres.length > 1 ? 's' : ''}`}</p>
      <span class="spacer"></span>
      ${choisis.length ? html`<strong class="small" id="mb-n">${`${choisis.length} sélectionné${choisis.length > 1 ? 's' : ''}`}</strong>` : large ? html`<span class="small muted">Pour toute la liste :</span>` : null}
      <button type="button" class="btn small tonal" id="mb-emails" disabled=${!cibles.length} onClick=${emails}><${Icon} name="copy" size=${15}/> Copier les emails</button>
      <button type="button" class="btn small tonal" id="mb-csv" disabled=${!cibles.length} onClick=${exporter}><${Icon} name="download" size=${15}/> Exporter en CSV</button>
      ${choisis.length ? html`<button type="button" class="btn small ghost" onClick=${() => setSel(new Set())}>Tout désélectionner</button>` : null}
    </div>
    ${!liste.length ? html`<p class="small muted">Aucun membre ne correspond à ces filtres.</p>` : large ? html`<div class="cs-tab-membres">
      <table class="tbl cs-membres">
        <thead><tr><th scope="col" class="c-coche"><${CaseTout} etat=${etatTout} onChange=${toutBasculer}/></th>
          ${COLS.map(([k, l]) => html`<th scope="col" key=${k} class=${'c-' + k} aria-sort=${tri.k === k ? (tri.desc ? 'descending' : 'ascending') : null}>
            <button type="button" class="cs-tri" id=${'mb-tri-' + k} onClick=${() => trier(k)}>${l}<${Icon} name="chevron" size=${16}/></button></th>`)}</tr></thead>
        <tbody>${vus.map(p => { const c = compte.get(p.id), on = sel.has(p.id); return html`<tr key=${p.id} class=${'mb-ligne' + (on ? ' on' : '')} data-id=${p.id}>
          <td class="c-coche"><label class="cs-case"><input type="checkbox" checked=${on} aria-label=${`Sélectionner ${p.full_name || ''}`} onChange=${() => basculer(p.id)}/></label></td>
          <td class="c-nom"><${Person} p=${p} onOpen=${openProfile} size=${32} sub=${html`${c?.email ? html`<span class="cs-m-email" dir="ltr" translate="no">${c.email}</span>` : null}<span class="cs-m-plie">${p.entreprise ? html`<span translate="no" dir="auto">${p.entreprise}</span> · ` : null}<span>${dateCourte(p.created_at)}</span></span>`}/></td>
          <td class="c-role">${role(p)}</td>
          <td class="c-promo">${p.promo ?? '–'}${p.role === 'etudiant' ? html`<span class="muted"> · ${NIVEAUX[niveauOf(p, saison)]?.short || ''}</span>` : null}</td>
          <td class="c-filiere"><span translate="no" title=${p.filiere || ''}>${filiereCourte(p.filiere) || '–'}</span></td>
          <td class="c-entreprise"><span translate="no" dir="auto">${p.entreprise || ''}</span></td>
          <td class="c-inscrit">${dateCourte(p.created_at)}</td>
          <td class="c-vu">${c?.last_sign_in_at ? timeAgo(c.last_sign_in_at) : '–'}</td>
          <td class="c-verifie">${p.verified ? html`<${Coche} oui label="Vérifié"/>` : p.role === 'laureat' ? html`<span class="tag urgent">À vérifier</span>` : html`<${Coche}/>`}</td>
          <td class="c-cv"><${Coche} oui=${aCV(p)}/></td>
          <td class="c-photo"><${Coche} oui=${aPhoto(p)}/></td>
        </tr>`; })}</tbody>
      </table></div>`
    : html`<ul class="lignes member-list">${vus.map(p => { const c = compte.get(p.id); return html`<li key=${p.id} class="ligne">
        <${Person} p=${p} onOpen=${openProfile} size=${40} sub=${html`<span class="ligne-sub">${p.role === 'etudiant' ? `${NIVEAUX[niveauOf(p, saison)]?.short || ''} · ${p.filiere} · promo ${p.promo}` : `${p.filiere} · Promo ${p.promo}`}</span>
          <span class="ligne-sub member-meta">${c ? html`<span dir="ltr" translate="no">${c.email}</span> · ` : null}<span>Inscrit ${timeAgo(p.created_at)}</span>${c?.last_sign_in_at ? html` · <span>Vu ${timeAgo(c.last_sign_in_at)}</span>` : null}</span>`}/>
        <span class="ligne-act">${role(p)}</span>
      </li>`; })}</ul>`}
    <${VoirPlus} reste=${reste} onPlus=${plus}/>
  </div>`;
}

injectCSS('admin-membres', `
.cs-filtres { display: flex; align-items: center; gap: var(--sp-2); min-width: 0; }
.cs-puces { flex: 1 1 auto; min-width: 0; }
.cs-promo { flex: none; width: auto; }
@media (pointer: fine) { .cs-promo { min-height: 38px; padding-block: .35rem; } }
@container cs (max-width: 620px) { .cs-filtres { flex-wrap: wrap; } .cs-puces { flex-basis: 100%; } }
.cs-barre { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem .5rem; }
.cs-barre .liste-tete { margin: 0; }
/* Le tableau : en-têtes qui trient, une case par ligne ; les colonnes moins utiles passent sous le nom quand la place manque */
.cs-tab-membres { min-width: 0; overflow-x: auto; }
.cs-membres { table-layout: auto; font-size: var(--fs-2); }
.cs-membres :is(th, td) { padding-inline: .4rem; }
.cs-membres th { vertical-align: bottom; }
.cs-membres td { vertical-align: middle; padding-block: .45rem; }
.cs-membres tbody tr:hover { background: color-mix(in srgb, var(--surface-2) 55%, transparent); }
.cs-membres tbody tr.on { background: var(--sel-bg); }
.cs-tri { display: inline-flex; align-items: center; gap: .2rem; padding: .2rem .1rem; text-align: start; border: 0; background: none; color: inherit; font: inherit; font-weight: 600; cursor: pointer; border-radius: 6px; }
.cs-tri:hover { color: var(--ink); }
.cs-tri .ico { opacity: 0; }
.cs-tri:hover .ico, .cs-tri:focus-visible .ico { opacity: .45; }
th[aria-sort] .cs-tri { color: var(--ink); }
th[aria-sort] .cs-tri .ico { opacity: 1; }
th[aria-sort="ascending"] .cs-tri .ico { transform: rotate(180deg); }
@media (prefers-reduced-motion: no-preference) { .cs-tri .ico { transition: opacity .15s, transform .15s; } }
.c-coche { width: 2rem; }
.cs-case { display: inline-grid; place-items: center; width: 28px; height: 28px; cursor: pointer; }
.cs-case input { width: 17px; height: 17px; margin: 0; accent-color: var(--accent); cursor: pointer; }
.c-nom { min-width: 12rem; }
.c-nom .person { gap: .55rem; }
.c-nom .role-line { display: flex; flex-direction: column; gap: 0; }
.cs-m-email { font-size: var(--fs-1); color: var(--muted); overflow-wrap: anywhere; }
.cs-m-plie { display: none; font-size: var(--fs-1); color: var(--muted); }
.c-role select { width: auto; min-height: 34px; padding: .25rem .4rem; font-size: var(--fs-2); }
.c-promo { white-space: nowrap; font-variant-numeric: tabular-nums; }
td.c-filiere { min-width: 4.5rem; max-width: 8.5rem; overflow-wrap: break-word; }
.c-entreprise { min-width: 7rem; max-width: 12rem; overflow-wrap: anywhere; }
td.c-inscrit, td.c-vu { white-space: nowrap; color: var(--ink-2); }
.c-verifie .tag { margin: 0; white-space: nowrap; }
.cs-oui { color: var(--good); display: inline-flex; }
.cs-non { color: var(--muted); }
/* Moins de 1100 px : l'entreprise et la date d'inscription passent sous le nom ; CV et photo restent dans les filtres */
@container cs (max-width: 1099px) {
  .cs-membres :is(.c-entreprise, .c-inscrit, .c-cv, .c-photo) { display: none; }
  .cs-m-plie { display: block; }
}
`);
