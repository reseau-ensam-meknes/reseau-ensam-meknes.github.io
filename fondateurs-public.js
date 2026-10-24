// Membres fondateurs : les 25 premiers lauréats à aider les étudiants (classementFondateurs dans logic.js, et la même
// règle dans schema.sql). Ce module-ci est léger : la carte d'un fondateur et son style (partagés avec l'accueil des
// membres, fondateurs.js), et le bandeau de la page d'entrée pour un visiteur sans compte.
// La page d'entrée le charge à part, après s'être affichée (import dynamique) : elle garde ses six fichiers.
// Un visiteur ne lit aucun profil : fondateurs_publics() lui donne les totaux, et le nom, la filière, la promo et la photo
// des seuls fondateurs qui ont dit oui. Démo, base pas encore à jour ou pas de réseau : rien, sans erreur.
import { html, useState, useEffect } from './vendor/preact-htm.js';
import { addAR, arCount } from './i18n.js';
import { Icon, ajouterIcones } from './entree.js';

// Le bouclier « vérifié » (le reste du site l'apporte avec ui.js, que la page d'entrée n'attend pas)
ajouterIcones({ shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>' });

export const TITRE_FONDATEURS = 'Membres fondateurs';
export const DU_MOIS = 'Lauréats du mois';
export const SOUS_FONDATEURS = 'Les premiers à aider les étudiants. Merci !';
// Ce que le fondateur a fait en premier (les mêmes types que la base : offre, aide, mentorat)
export const FAIT = { offre: 'Offre publiée', aide: 'Aide proposée', mentorat: 'Mentorat accepté' };
const ICONE = { offre: 'briefcase', aide: 'send', mentorat: 'mentor' };

// « GM · Promo 2024 » : le code officiel de la filière (le même que filiereCourte dans logic.js), et un code court
// pour les anciennes appellations, que portent la plupart des lauréats
const CODES = {
  'Génie Industriel et Productique': 'GIP24', 'Génie Industriel : Excellence Opérationnelle': 'GIEO',
  'Génie Électromécanique : Digitalisation Industrielle': 'GE-DI', 'Génie Électromécanique : Maintenance et Commande Industrielles': 'GE-MCI',
  'Génie Mécanique : Conception et Industrialisation des Systèmes Mécaniques': 'GM-CISM', 'Génie Mécanique : Ingénierie Mécanique et Structures': 'GM-IMS',
  'Génie Mécanique : Matériaux et Procédés de Fabrication': 'GM-MPF', 'Génie Mécanique : Énergétique': 'GME24', 'Génie Civil': 'GC24',
  'Intelligence Artificielle et Technologies des Données : Systèmes Industriels': 'IATD-SI', 'Génie Informatique : Ingénierie Logicielle et Systèmes Intelligents': 'GI-ILSI',
  // Anciennes appellations
  'Génie Mécanique': 'GM', 'Génie Industriel': 'GI', 'Génie Électromécanique': 'GEM', 'Génie Énergétique': 'GE', 'Mécatronique': 'MECA', 'Génie Informatique & IA': 'GI-IA',
};
export const filiereFondateur = f => CODES[f] || f || '';

// « 23 octobre » (l'année seulement si ce n'est pas celle-ci) : le mois en toutes lettres se traduit tout seul en arabe
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export function jourFondateur(iso, now = new Date()) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return `${d.getDate()} ${MOIS[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : ''}`;
}
// Les visiteurs ne voient que des totaux pour ceux qui n'ont pas (encore) dit oui
export const ligneTotaux = (total, places) => `${total > 1 ? `${total} membres fondateurs` : '1 membre fondateur'} · ${places > 1 ? `${places} places restantes` : places === 1 ? '1 place restante' : 'complet'}`;

// Un visage : la photo si elle est là, sinon les initiales sur une teinte douce (les mêmes teintes que l'Avatar du site)
const TEINTES = [[205, 62], [28, 78], [222, 32], [176, 46], [150, 34], [244, 42], [350, 52], [42, 66], [290, 28]];
const hacher = (s = '') => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const initiales = n => (n || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(x => [...x][0]).join('').toUpperCase();
export function Visage({ nom, url, size = 80 }) {
  const [h, s] = TEINTES[hacher(nom) % TEINTES.length];
  const ini = [...initiales(nom)];
  return html`<span class=${'avatar' + (url ? ' a-photo' : '')} style=${`--h:${h};--s:${s}%;--s2:${Math.min(s + 8, 70)}%;width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px`} aria-hidden="true"><span class="av-ini">${ini[0] || ''}${ini.length > 1 ? html`<span class="av-l2">${ini.slice(1).join('')}</span>` : null}</span>${url ? html`<img src=${url} alt="" width=${size} height=${size} decoding="async" onError=${e => { e.currentTarget.hidden = true; }}/>` : null}</span>`;
}

// La carte d'un fondateur. visage : la photo (Avatar sur l'accueil, Visage ici) ; apresNom : le bouclier « vérifié » ;
// onOpen : ouvre sa fiche (membres) ; pied : le « Merci » (membres)
export function CarteFondateur({ f, visage, apresNom, onOpen, pied }) {
  const Tete = onOpen ? 'button' : 'div';
  return html`<li class="fd-carte">
    <${Tete} type=${onOpen ? 'button' : undefined} class="fd-qui" onClick=${onOpen}>
      <span class="fd-photo">${visage}<span class="fd-rang" aria-hidden="true">${f.rang}</span></span>
      <span class="fd-nom"><span class="fd-nom-t" translate="no" dir="auto">${f.nom}</span>${apresNom}</span>
      <span class="fd-meta">${f.filiere ? html`<span translate="no">${filiereFondateur(f.filiere)}</span>` : null}${f.filiere && f.promo ? ' · ' : null}${f.promo ? html`<span>${`Promo ${f.promo}`}</span>` : null}</span>
    </${Tete}>
    ${FAIT[f.type] ? html`<p class="fd-fait"><${Icon} name=${ICONE[f.type]} size=${16}/><span>${`${FAIT[f.type]} le ${jourFondateur(f.at)}`}</span></p>` : null}
    ${pied || null}
  </li>`;
}
export function TeteFondateurs({ id }) {
  return html`<div class="fd-tete"><span class="fd-ico" aria-hidden="true"><${Icon} name="award" size=${20}/></span>
    <div class="fd-tete-txt"><div class="fd-l1"><h2 class="fd-titre" id=${id}>${TITRE_FONDATEURS}</h2><span class="fd-pastille">${DU_MOIS}</span></div><p class="fd-sous">${SOUS_FONDATEURS}</p></div></div>`;
}

// ---------------------------------------------------------------------------
// Page d'entrée : fondateurs_publics(), puis les photos de ceux qui ont dit oui (liens temporaires d'une heure,
// que la base n'accorde que pour ces photos-là : politique « photos fondateurs publics » de schema.sql)
// ---------------------------------------------------------------------------
let promesse = null;
async function appeler(cfg) {
  const h = { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, 'Content-Type': 'application/json' };
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000);
  try {
    const r = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/fondateurs_publics`, { method: 'POST', headers: h, body: '{}', signal: c.signal });
    if (!r.ok) return null;
    const x = await r.json();
    const total = Math.max(0, +x?.total || 0), max = +x?.max || 25;
    const liste = (Array.isArray(x?.fondateurs) ? x.fondateurs : []).filter(f => f && f.nom).slice(0, max);
    const chemins = liste.map(f => f.photo).filter(Boolean);
    const urls = {};
    if (chemins.length) {
      try {
        const s = await fetch(`${cfg.supabaseUrl}/storage/v1/object/sign/photos`, { method: 'POST', headers: h, body: JSON.stringify({ expiresIn: 3600, paths: chemins }), signal: c.signal });
        if (s.ok) for (const y of await s.json()) if (y?.signedURL && !y.error) urls[y.path] = `${cfg.supabaseUrl}/storage/v1${y.signedURL}`;
      } catch { /* pas de photo : les initiales */ }
    }
    const places = typeof x?.places === 'number' ? Math.max(0, x.places) : Math.max(0, max - total);
    return { total, max, places, liste: liste.map(f => ({ ...f, url: urls[f.photo] || null })) };
  } catch { return null; } finally { clearTimeout(t); }
}
export function fondateursPublics(cfg = window.ENSAM_CONFIG || {}) {
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return Promise.resolve(null);
  return promesse ||= appeler(cfg).then(v => { if (!v) promesse = null; return v; });
}

export function FondateursPublics() {
  const [x, setX] = useState(null);
  // Téléphone : une ligne par fondateur, photo à côté du nom ; petit écran (moins de 700 px de haut) : les visages seuls
  const [petit] = useState(() => typeof innerWidth === 'number' && innerWidth < 900);
  useEffect(() => { let vivant = true; fondateursPublics().then(v => { if (vivant) setX(v); }); return () => { vivant = false; }; }, []);
  if (!x || !x.total) return null;
  return html`<section class="fondateurs fd-public" aria-labelledby="fd-titre-entree">
    <${TeteFondateurs} id="fd-titre-entree"/>
    ${x.liste.length ? html`<span class="fd-pile" aria-hidden="true">${x.liste.slice(0, 4).map(f => html`<${Visage} key=${f.rang} nom=${f.nom} url=${f.url} size=${32}/>`)}</span>` : null}
    ${x.liste.length ? html`<ul class="fd-liste" role="list" tabindex="0" aria-labelledby="fd-titre-entree">${x.liste.map(f => html`<${CarteFondateur} key=${f.rang} f=${f} visage=${html`<${Visage} nom=${f.nom} url=${f.url} size=${petit ? 44 : 64}/>`}
      apresNom=${f.verifie ? html`<span class="verif" role="img" aria-label="Profil vérifié" title="Profil vérifié"><${Icon} name="shield" size=${16}/></span>` : null}/>`)}</ul>` : null}
    <p class="fd-places fd-totaux">${ligneTotaux(x.total, x.places)}</p>
  </section>`;
}

// Le style, partagé avec l'accueil des membres. Pas de cadre dans un cadre : une carte, des visages dedans.
const CSS = `
.fondateurs { position: relative; display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-4); border-radius: var(--r-lg); background: linear-gradient(180deg, color-mix(in srgb, var(--brass) 8%, var(--surface)), var(--surface) 70%); box-shadow: var(--sh1); }
.fd-tete { display: flex; align-items: flex-start; gap: var(--sp-3); }
.fd-ico { flex: none; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: color-mix(in srgb, var(--brass) 14%, var(--surface)); color: var(--brass); }
.fd-tete-txt { min-width: 0; }
.fd-l1 { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px var(--sp-2); }
.fd-titre { margin: 0; font: 700 var(--fs-4)/1.25 var(--f-display); color: var(--ink); }
.fd-pastille { display: inline-flex; align-items: center; min-height: 22px; padding: 1px 9px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--brass) 13%, var(--surface)); color: var(--brass); font-size: var(--fs-1); font-weight: 650; white-space: nowrap; }
.fd-sous { margin: 2px 0 0; color: var(--ink-2); font-size: var(--fs-2); }
.fd-liste { list-style: none; margin: 0 calc(-1 * var(--sp-4)); padding: var(--sp-1) var(--sp-4) var(--sp-2); display: flex; gap: var(--sp-3); overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding-inline: var(--sp-4); overscroll-behavior-inline: contain; scrollbar-width: none; }
.fd-liste::-webkit-scrollbar { display: none; }
.fd-carte { flex: 1 0 9.25rem; max-inline-size: 13rem; scroll-snap-align: start; display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); text-align: center; min-width: 0; }
.fd-qui { display: flex; flex-direction: column; align-items: center; gap: 6px; inline-size: 100%; min-width: 0; padding: var(--sp-1); margin: 0; border: 0; border-radius: var(--r-md); background: none; color: inherit; font: inherit; text-align: center; }
button.fd-qui { cursor: pointer; }
button.fd-qui:hover .fd-nom-t { text-decoration: underline; text-underline-offset: 3px; }
.fd-photo { position: relative; display: inline-flex; border-radius: 50%; padding: 4px; background: conic-gradient(from 210deg, var(--orange), var(--accent), var(--em-n), var(--orange)); }
.fd-photo .avatar { box-shadow: 0 0 0 2px var(--surface); }
.fd-rang { position: absolute; inset-block-end: -2px; inset-inline-end: -2px; min-width: 24px; height: 24px; padding-inline: 5px; display: grid; place-items: center; border-radius: var(--r-pill); background: var(--surface); color: var(--ink); box-shadow: var(--sh1); font: 700 var(--fs-1)/1 var(--f-body); font-variant-numeric: tabular-nums; }
.fd-nom { display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-1); max-inline-size: 100%; font-weight: 650; font-size: var(--fs-3); color: var(--ink); line-height: 1.25; }
.fd-nom-t { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; text-wrap: balance; }
.fd-nom .verif { flex: none; color: var(--teal); display: inline-flex; }
.fd-meta { color: var(--muted); font-size: var(--fs-2); }
.fd-fait { margin: 0; display: inline-flex; align-items: flex-start; gap: 6px; color: var(--ink-2); font-size: var(--fs-2); line-height: 1.35; text-align: start; text-wrap: balance; }
.fd-fait .ico { flex: none; width: 16px; height: 16px; margin-block-start: 1px; color: var(--brass); }
.fd-places { margin: 0; display: flex; align-items: center; gap: var(--sp-3); color: var(--ink-2); font-size: var(--fs-2); }
.fd-jauge { flex: none; inline-size: 56px; block-size: 6px; border-radius: var(--r-pill); background: var(--surface-2); overflow: hidden; }
.fd-jauge i { display: block; block-size: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--orange), var(--accent)); }
.fd-cta { align-self: flex-start; display: inline-flex; align-items: center; gap: var(--sp-2); min-height: 40px; font-size: var(--fs-2); text-align: start; }
.fd-merci { margin-block-start: auto; }
[dir="rtl"] .fd-cta .ico-arrow { transform: scaleX(-1); }
/* Page d'entrée sur téléphone : une ligne par fondateur (photo à côté du nom), pour que « Recevoir mon code » reste en vue */
.fd-totaux { color: var(--muted); }
.fd-public { margin-block: var(--sp-2) var(--sp-1); }
@media (max-width: 899px) {
  .fd-public { padding: var(--sp-3); gap: var(--sp-2); }
  .fd-public .fd-ico { width: 30px; height: 30px; }
  .fd-public .fd-titre { font-size: var(--fs-3); }
  .fd-public .fd-liste { margin-inline: calc(-1 * var(--sp-3)); padding: 2px var(--sp-3) 2px; scroll-padding-inline: var(--sp-3); gap: var(--sp-4); }
  .fd-public .fd-carte { flex: 0 0 auto; max-inline-size: 15.5rem; display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "photo nom" "photo meta" "photo fait"; column-gap: var(--sp-3); row-gap: 1px; align-items: center; text-align: start; }
  .fd-public .fd-qui { display: contents; text-align: start; }
  .fd-public .fd-photo { grid-area: photo; padding: 2px; }
  .fd-public .fd-rang { min-width: 20px; height: 20px; padding-inline: 4px; }
  .fd-public .fd-nom { grid-area: nom; justify-content: flex-start; font-size: var(--fs-2); }
  .fd-public .fd-nom-t { -webkit-line-clamp: 1; }
  .fd-public .fd-meta { grid-area: meta; font-size: var(--fs-1); }
  .fd-public .fd-fait { grid-area: fait; font-size: var(--fs-1); gap: 4px; align-items: center; }
  .fd-public .fd-fait .ico { width: 14px; height: 14px; margin: 0; }
  .fd-public .fd-ico { display: none; }
  .fd-public .fd-photo { padding: 3px; }
}
.fd-pile { display: none; }
@media (max-width: 899px) and (max-height: 700px) {
  .fd-public { display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "pile tete"; column-gap: var(--sp-3); align-items: center; padding-block: 6px; margin-block: var(--sp-1) 0; }
  .fd-public :is(.fd-sous, .fd-ico, .fd-liste, .fd-totaux, .fd-pastille) { display: none; }
  .fd-public .fd-tete { grid-area: tete; }
  .fd-pile { grid-area: pile; display: inline-flex; }
  .fd-pile .avatar { box-shadow: 0 0 0 2px var(--surface); }
  .fd-pile .avatar + .avatar { margin-inline-start: -8px; }
}
@media (min-width: 900px) { .fd-public { margin-block: var(--sp-2) var(--sp-3); max-inline-size: 36rem; } }
`;
if (typeof document !== 'undefined' && !document.querySelector('style[data-module="fondateurs"]')) {
  const s = document.createElement('style'); s.dataset.module = 'fondateurs'; s.textContent = CSS; document.head.appendChild(s);
}

// Arabe : خريجين, jamais القدامى ; formulations neutres. Les mêmes phrases sont aussi à l'accueil des membres.
const FAIT_AR = { [FAIT.offre]: 'نشر عرض', [FAIT.aide]: 'اقتراح مساعدة', [FAIT.mentorat]: 'قبول إرشاد' };
const MEMBRE_F = ['عضو مؤسس واحد', 'عضوان مؤسسان', 'أعضاء مؤسسين', 'عضوًا مؤسسًا'];
const PLACE = ['مكان واحد متبقٍّ', 'مكانان متبقيان', 'أماكن متبقية', 'مكانًا متبقيًا'];
addAR({
  [TITRE_FONDATEURS]: 'الأعضاء المؤسسون', [DU_MOIS]: 'خريجو الشهر',
  [SOUS_FONDATEURS]: 'أول من ساعد الطلبة. شكرًا!',
  'Profil vérifié': 'ملف موثَّق',
}, [
  [/^Promo (\d{4})$/, y => `دفعة ${y}`],
  // « Offre publiée le 23 octobre » : le mois passe en arabe tout seul (dateFix)
  [/^(Offre publiée|Aide proposée|Mentorat accepté) le (\d{1,2} \S+(?: \d{4})?)$/, (t, j) => `${FAIT_AR[t]} يوم ${j}`],
  [/^(\d+) membres fondateurs · (\d+) places restantes$/, (t, p) => `${arCount(t, MEMBRE_F)} · ${arCount(p, PLACE)}`],
  [/^(\d+) membres fondateurs · 1 place restante$/, t => `${arCount(t, MEMBRE_F)} · مكان واحد متبقٍّ`],
  [/^(\d+) membres fondateurs · complet$/, t => `${arCount(t, MEMBRE_F)} · اكتمل العدد`],
  [/^1 membre fondateur · (\d+) places restantes$/, p => `عضو مؤسس واحد · ${arCount(p, PLACE)}`],
]);
