import { html, useState, useEffect } from './vendor/preact-htm.js';
import { addAR, getLang } from './i18n.js';
import { Icon, argsEcole } from './entree.js';
import { Visage } from './fondateurs-public.js';

export const TITRE_VISAGES = 'Ils sont déjà dans le réseau';
export const TITRE_REUSSITES = 'Réussites';
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'];
const iso = n => `⁨${n}⁩`;
const texte = (x, max) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
const promoOk = p => (Number.isInteger(+p) && +p >= 1990 && +p <= 2040 ? +p : null);

export function moisReussite(m, ar = false) {
  const [a, n] = String(m || '').split('-').map(Number);
  return a > 1990 && n >= 1 && n <= 12 ? `${(ar ? MOIS_AR : MOIS)[n - 1]} ${a}` : '';
}
export function phraseReussite(r, ar = false) {
  const p = r.promo ? (ar ? ` (دفعة ${r.promo})` : ` (promo ${r.promo})`) : '';
  return ar ? `${iso(r.etudiant)}، بمساعدة ${iso(r.laureat)}${p}` : `${r.etudiant}, avec l’aide de ${r.laureat}${p}`;
}
export function lireVisages(x) {
  return (Array.isArray(x) ? x : []).map(v => ({ nom: texte(v?.nom, 60), promo: promoOk(v?.promo), entreprise: texte(v?.entreprise, 80) || null, photo: typeof v?.photo === 'string' && v.photo ? v.photo : null }))
    .filter(v => v.nom).slice(0, 24);
}
export function lireReussites(x) {
  return (Array.isArray(x) ? x : []).map(r => ({ entreprise: texte(r?.entreprise, 80), etudiant: texte(r?.etudiant, 40), laureat: texte(r?.laureat, 40), promo: promoOk(r?.promo), mois: texte(r?.mois, 7) }))
    .filter(r => r.entreprise && r.etudiant && r.laureat).slice(0, 12);
}

let promesse = null;
async function appeler(cfg) {
  const h = { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, 'Content-Type': 'application/json' };
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000);
  const corps = JSON.stringify(argsEcole());
  const rpc = nom => fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${nom}`, { method: 'POST', headers: h, body: corps, signal: c.signal })
    .then(r => (r.ok ? r.json() : null), () => null);
  try {
    const [v, r] = await Promise.all([rpc('visages_publics'), rpc('reussites_publiques')]);
    const visages = lireVisages(v), reussites = lireReussites(r);
    const chemins = visages.map(x => x.photo).filter(Boolean);
    const urls = {};
    if (chemins.length) {
      try {
        const s = await fetch(`${cfg.supabaseUrl}/storage/v1/object/sign/photos`, { method: 'POST', headers: h, body: JSON.stringify({ expiresIn: 3600, paths: chemins }), signal: c.signal });
        if (s.ok) for (const y of await s.json()) if (y?.signedURL && !y.error) urls[y.path] = `${cfg.supabaseUrl}/storage/v1${y.signedURL}`;
      } catch { /* pas de photo : les initiales */ }
    }
    return { visages: visages.map(x => ({ ...x, url: urls[x.photo] || null })), reussites, ok: v !== null || r !== null };
  } catch { return null; } finally { clearTimeout(t); }
}
export function vitrinePublique(cfg = window.ENSAM_CONFIG || {}) {
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return Promise.resolve(null);
  return promesse ||= appeler(cfg).then(v => { if (!v?.ok) promesse = null; return v; });
}

export function VitrineEntree() {
  const [x, setX] = useState(null);
  useEffect(() => { let vivant = true; vitrinePublique().then(v => { if (vivant) setX(v); }); return () => { vivant = false; }; }, []);
  if (!x || (!x.visages.length && !x.reussites.length)) return null;
  const ar = getLang() === 'ar';
  return html`<div class="ev">
    ${x.visages.length ? html`<section class="ev-bloc ev-visages" aria-labelledby="ev-visages-t">
      <h2 class="eyebrow" id="ev-visages-t">${TITRE_VISAGES}</h2>
      <ul class="ev-liste" role="list" tabindex="0" aria-labelledby="ev-visages-t">${x.visages.map((v, i) => html`<li class="ev-visage" key=${i}>
        <${Visage} nom=${v.nom} url=${v.url} size=${52}/>
        <span class="ev-nom" translate="no" dir="auto">${v.nom}</span>
        ${v.promo ? html`<span class="ev-meta">${`Promo ${v.promo}`}</span>` : null}
        ${v.entreprise ? html`<span class="ev-meta ev-ent" translate="no" dir="auto">${v.entreprise}</span>` : null}
      </li>`)}</ul>
    </section>` : null}
    ${x.reussites.length ? html`<section class="ev-bloc ev-reussites" aria-labelledby="ev-reussites-t">
      <h2 class="eyebrow" id="ev-reussites-t">${TITRE_REUSSITES}</h2>
      <ul class="ev-r-liste" role="list">${x.reussites.map((r, i) => html`<li class="ev-reussite" key=${i}>
        <span class="sc-ico"><${Icon} name="briefcase"/></span>
        <span class="ev-r-txt"><strong translate="no" dir="auto">${r.entreprise}</strong>
          <span translate="no">${phraseReussite(r, ar)}</span>
          ${moisReussite(r.mois, ar) ? html`<span class="ev-meta" translate="no">${moisReussite(r.mois, ar)}</span>` : null}</span>
      </li>`)}</ul>
    </section>` : null}
  </div>`;
}

const CSS = `
.ev { display: flex; flex-direction: column; gap: 1.1rem; min-width: 0; grid-column: 1 / -1; }
.ev-bloc { min-width: 0; }
.ev-bloc > .eyebrow { margin: 0 0 .5rem; padding-inline: .3rem; font-size: .78rem; }
.ev-liste { list-style: none; margin: 0; padding: 2px .3rem 4px; display: flex; gap: var(--sp-3); overflow-x: auto; scroll-snap-type: x mandatory; overscroll-behavior-inline: contain; scrollbar-width: none; }
.ev-liste::-webkit-scrollbar { display: none; }
.ev-visage { flex: 0 0 6.5rem; scroll-snap-align: start; display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; min-width: 0; }
.ev-visage .avatar { margin-block-end: 4px; }
.ev-nom { max-inline-size: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 650; font-size: var(--fs-2); color: var(--ink); }
.ev-meta { max-inline-size: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--fs-1); color: var(--muted); }
.ev-ent { color: var(--ink-2); }
.ev-r-liste { list-style: none; margin: 0; padding: 0 .3rem; display: flex; flex-direction: column; gap: .7rem; }
.ev-reussite { display: flex; align-items: flex-start; gap: .6rem; min-width: 0; }
.ev-reussite .sc-ico { width: 34px; height: 34px; border-radius: 10px; }
.ev-r-txt { display: flex; flex-direction: column; gap: 1px; min-width: 0; font-size: var(--fs-2); color: var(--ink-2); }
.ev-r-txt strong { font-size: var(--fs-3); color: var(--ink); overflow-wrap: anywhere; }
`;
if (typeof document !== 'undefined' && !document.querySelector('style[data-module="entree-vitrine"]')) {
  const s = document.createElement('style'); s.dataset.module = 'entree-vitrine'; s.textContent = CSS; document.head.appendChild(s);
}

addAR({ 'Ils sont déjà dans le réseau': 'هم بالفعل في الشبكة', 'Réussites': 'النجاحات' });
