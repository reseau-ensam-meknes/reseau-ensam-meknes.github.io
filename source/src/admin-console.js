// Console d'administration : le cadre. Les rubriques (sur ordinateur, 1100 px et plus : une colonne collée au bord, en groupes ;
// plus étroit : une rangée de puces), l'en-tête (l'année, le choix de l'école, la recherche dans tout le réseau),
// et ce qui sert à plusieurs rubriques : la largeur de l'écran, télécharger un CSV, copier un texte.
import { html, useState, useEffect, useRef } from './vendor/preact-htm.js';
import { Icon, Avatar, toast, injectCSS } from './ui.js';
import { PucesNav } from './lignes.js';
import { addAR } from './i18n.js';
import { ajouterIcones } from './entree.js';
import { chercherConsole, texteCSV } from './admin-console-regles.js';
import { adminDuReseau } from './logic.js';


// Un porte-voix (Animer le réseau) et deux cercles qui se croisent (Partenaires)
ajouterIcones({
  'adm-voix': '<path d="M4 10.5v3a1 1 0 0 0 1 1h2.5L15 19V5L7.5 9.5H5a1 1 0 0 0-1 1z"/><path d="M18.5 9a4 4 0 0 1 0 6"/><path d="M8 14.5 9.6 19"/>',
  'adm-accord': '<circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/>',
});

addAR({
  'Piloter': 'القيادة', 'Animer': 'التنشيط', 'Gérer': 'التسيير', 'Grandir': 'النمو',
  'Animer le réseau': 'تنشيط الشبكة', 'Contenus': 'المحتويات', 'Écoles': 'المدارس', 'Partenaires': 'الشركاء', 'Affiches et rapport': 'الملصقات والتقرير',
  'Rubriques de l’administration': 'أقسام الإدارة', 'Toutes les écoles': 'كل المدارس', 'École': 'المدرسة',
  'Membre, offre, demande…': 'عضو، عرض، طلب…', 'Chercher dans le réseau': 'البحث في الشبكة',
  'Résultats de la recherche': 'نتائج البحث', 'Demande d’étudiant': 'طلب طالب',
  'Copie impossible ici.': 'النسخ غير ممكن هنا.',
});

export const GROUPES = [
  ['Piloter', [['', 'Tableau de bord', 'chart'], ['traiter', 'À traiter', 'inbox']]],
  ['Animer', [['animer', 'Animer le réseau', 'adm-voix'], ['agenda', 'Agenda', 'calendar'], ['inviter', 'Inviter', 'send']]],
  ['Gérer', [['membres', 'Membres', 'people'], ['contenus', 'Contenus', 'feed'], ['moderation', 'Modération', 'flag'], ['liste', 'Liste officielle', 'file']]],
  ['Grandir', [['ecoles', 'Écoles', 'cap'], ['partenaires', 'Partenaires', 'adm-accord'], ['sponsorises', 'Sponsorisés', 'etiquette'], ['outils', 'Affiches et rapport', 'image']]],
  [null, [['reglages', 'Réglages', 'wrench']]],
];
export const RUBRIQUES = GROUPES.flatMap(([, l]) => l);
// Ce qui appartient au réseau (les écoles, les partenaires, les affiches et le rapport, les réglages de l'ENSAM Meknès) :
// la base ne le laisse qu'à l'administration du réseau (super_admin()). Celle d'une école a les autres rubriques ; un
// groupe qui n'en garde aucune disparaît. L'administration du réseau : les tableaux d'avant, tels quels.
export const RUBRIQUES_DU_RESEAU = ['ecoles', 'partenaires', 'outils', 'reglages'];
const GROUPES_ECOLE = GROUPES.map(([g, l]) => [g, l.filter(([k]) => !RUBRIQUES_DU_RESEAU.includes(k))]).filter(([, l]) => l.length);
const RUBRIQUES_ECOLE = GROUPES_ECOLE.flatMap(([, l]) => l);
export const groupesPour = me => (adminDuReseau(me) ? GROUPES : GROUPES_ECOLE);
export const rubriquesPour = me => (adminDuReseau(me) ? RUBRIQUES : RUBRIQUES_ECOLE);
export const routeRubrique = k => (k ? 'admin/' + k : 'admin');

// Vrai tant que l'écran est assez large (le menu en colonne, les tableaux) ; suit le redimensionnement
export const LARGE = '(min-width: 1100px)';
export function useLarge(requete = LARGE) {
  const lire = () => typeof matchMedia === 'function' && matchMedia(requete).matches;
  const [v, setV] = useState(lire);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia(requete), f = () => setV(m.matches);
    f(); m.addEventListener?.('change', f);
    return () => m.removeEventListener?.('change', f);
  }, [requete]);
  return v;
}

// Un fichier CSV pour un tableur : point-virgule, BOM (Excel lit les accents), une ligne par tableau
export function telecharger(nom, lignes) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texteCSV(lignes)], { type: 'text/csv;charset=utf-8' }));
  a.download = nom; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export async function copier(texte, message) {
  try { await navigator.clipboard.writeText(texte); toast(message); return true; } catch { toast('Copie impossible ici.', 'err'); return false; }
}

// Ordinateur : la colonne des rubriques, en groupes ; chaque rubrique avec son icône et, s'il y en a, ce qui attend
export function MenuConsole({ actif, compte = {}, go, groupes = GROUPES }) {
  return html`<nav class="cs-menu" aria-label="Rubriques de l’administration">${groupes.map(([titre, items], i) => html`
    <div class=${'cs-groupe' + (titre ? '' : ' cs-seul')} key=${i} role=${titre ? 'group' : null} aria-labelledby=${titre ? 'cs-g-' + i : null}>
      ${titre ? html`<p class="cs-g-titre" id=${'cs-g-' + i}>${titre}</p>` : null}
      <ul>${items.map(([k, l, ic]) => html`<li key=${k}><a href=${'#' + routeRubrique(k)} id=${'adm-tab-' + (k || 'vue')} aria-current=${actif === k ? 'page' : null}
        onClick=${e => { e.preventDefault(); go(routeRubrique(k)); }}><${Icon} name=${ic} size=${18}/><span class="cs-lib">${l}</span>${compte[k] ? html`<span class="cs-n">${compte[k]}</span>` : null}</a></li>`)}</ul>
    </div>`)}</nav>`;
}
// Téléphone et tablette : les mêmes rubriques, sur une rangée de puces
export function PucesConsole({ actif, compte = {}, go, rubriques = RUBRIQUES }) {
  return html`<${PucesNav} cls="adm-tabs" label="Rubriques de l’administration" idPrefix="adm-tab-" items=${rubriques.map(([k, l, i]) => ({ k, label: l, icon: i, n: compte[k] }))} actif=${actif} onChoisir=${k => go(routeRubrique(k))}/>`;
}

// Le choix de l'école, seulement quand le réseau en compte au moins deux
export function ChoixEcole({ ecoles, valeur, onChange }) {
  if ((ecoles || []).length < 2) return null;
  return html`<label class="cs-ecole"><${Icon} name="cap" size=${16}/><span class="sr-only">École</span>
    <select id="cs-ecole" value=${valeur} onChange=${e => onChange(e.target.value)}><option value="">Toutes les écoles</option>${ecoles.map(e => html`<option key=${e.slug} value=${e.slug} translate="no">${e.nom}</option>`)}</select></label>`;
}

export function RechercheConsole({ ctx, comptes }) {
  const { data, saison, openProfile, openOffer, go } = ctx;
  const [q, setQ] = useState('');
  const [actif, setActif] = useState(0);
  const [ouvert, setOuvert] = useState(false);
  const champ = useRef();
  // « / » (hors d'un champ) ou Ctrl+K (⌘K) : le curseur dans la recherche ; une feuille ouverte garde la main
  useEffect(() => {
    const f = e => {
      if (e.defaultPrevented || document.querySelector('.modal')) return;
      const saisie = e.target?.closest?.('input, textarea, select, [contenteditable="true"]');
      const raccourci = (e.key === '/' && !saisie && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && String(e.key).toLowerCase() === 'k');
      if (!raccourci) return;
      e.preventDefault(); champ.current?.focus(); champ.current?.select();
    };
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, []);
  const res = chercherConsole(data, comptes, q, saison);
  const montrer = ouvert && res.length > 0;
  const i = Math.min(actif, Math.max(0, res.length - 1));
  const choisir = r => {
    setQ(''); setOuvert(false); setActif(0); champ.current?.blur();
    if (r.sorte === 'membre') openProfile(r.p); else if (r.sorte === 'offre') openOffer(r.o.id); else go('offres/demandes/' + r.d.id);
  };
  const touche = e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!res.length) return;
      e.preventDefault(); setOuvert(true);
      setActif(ouvert ? (i + (e.key === 'ArrowDown' ? 1 : -1) + res.length) % res.length : 0);
    } else if (e.key === 'Enter') {
      if (montrer) { e.preventDefault(); choisir(res[i]); }
    } else if (e.key === 'Escape') {
      if (q || ouvert) { e.preventDefault(); e.stopPropagation(); setQ(''); setOuvert(false); } else champ.current?.blur();
    }
  };
  const ligne = (r, k) => {
    const on = k === i, attrs = { id: 'cs-opt-' + k, role: 'option', 'aria-selected': on, class: 'cs-opt' + (on ? ' on' : ''), onMouseDown: e => e.preventDefault(), onMouseMove: () => k !== i && setActif(k), onClick: () => choisir(r) };
    if (r.sorte === 'membre') return html`<li key=${r.cle} ...${attrs}><${Avatar} p=${r.p} size=${28}/><span class="cs-opt-txt"><span class="cs-opt-t" translate="no" dir="auto">${r.p.full_name}</span><span class="cs-opt-s">${r.sous}${r.email ? html` · <span dir="ltr" translate="no">${r.email}</span>` : null}</span></span><span class="tag done">Membre</span></li>`;
    if (r.sorte === 'offre') return html`<li key=${r.cle} ...${attrs}><span class="cs-opt-ico"><${Icon} name="feed" size=${16}/></span><span class="cs-opt-txt"><span class="cs-opt-t" translate="no" dir="auto">${r.o.titre}</span><span class="cs-opt-s" translate="no" dir="auto">${r.o.entreprise || ''}</span></span><span class="tag done">Offre</span></li>`;
    return html`<li key=${r.cle} ...${attrs}><span class="cs-opt-ico"><${Icon} name="send" size=${16}/></span><span class="cs-opt-txt"><span class="cs-opt-t" translate="no" dir="auto">${r.d.titre}</span></span><span class="tag done">Demande d’étudiant</span></li>`;
  };
  return html`<div class="cs-cherche" role="search">
    <label class="search cs-q"><${Icon} name="search" size=${16}/>
      <input id="cs-q" ref=${champ} type="search" role="combobox" autocomplete="off" aria-autocomplete="list" aria-expanded=${montrer} aria-controls="cs-res"
        aria-activedescendant=${montrer ? 'cs-opt-' + i : null} aria-label="Chercher dans le réseau" placeholder="Membre, offre, demande…"
        value=${q} onInput=${e => { setQ(e.target.value); setActif(0); setOuvert(true); }} onFocus=${() => setOuvert(true)} onBlur=${() => setOuvert(false)} onKeyDown=${touche}/>
      <kbd class="cs-kbd" aria-hidden="true">/</kbd></label>
    <ul class="cs-res" id="cs-res" role="listbox" aria-label="Résultats de la recherche" hidden=${!montrer}>${montrer ? res.map(ligne) : null}</ul>
    ${ouvert && q.trim().length >= 2 && !res.length ? html`<p class="cs-vide small muted" role="status">Aucun résultat</p>` : null}
  </div>`;
}

injectCSS('admin-console', `
/* La console prend plus de place que les autres pages : sur ordinateur, ses tableaux respirent */
.page.admin { max-width: 1400px; }
.cs-corps { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--sp-5); align-items: start; }
.cs-main { min-width: 0; display: flex; flex-direction: column; gap: 1.25rem; container: cs / inline-size; }
@media (min-width: 1100px) { .cs-corps { grid-template-columns: 208px minmax(0, 1fr); } }
/* La colonne des rubriques : collée sous la barre du haut, elle défile seule si l'écran est bas */
.cs-menu { position: sticky; top: 76px; max-height: calc(100vh - 92px); overflow-y: auto; scrollbar-width: thin; display: flex; flex-direction: column; gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-2); background: var(--surface); border-radius: var(--r-lg); box-shadow: var(--sh1); }
.cs-groupe { display: flex; flex-direction: column; gap: 2px; }
.cs-groupe.cs-seul { padding-top: var(--sp-3); border-top: 1px solid var(--line); }
.cs-g-titre { margin: 0 0 2px; padding-inline: .65rem; font: 650 var(--fs-1)/1.5 var(--f-body); letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
[dir="rtl"] .cs-g-titre { letter-spacing: 0; text-transform: none; font-size: var(--fs-2); }
.cs-menu ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.cs-menu a { display: flex; align-items: center; gap: .6rem; min-height: 40px; padding: .4rem .65rem; border-radius: var(--r-md); color: var(--ink-2); text-decoration: none; font-weight: 500; font-size: var(--fs-3); line-height: 1.25; transition: background .15s, color .15s; }
.cs-menu a:hover { background: var(--surface-2); color: var(--ink); }
.cs-menu a[aria-current="page"] { background: var(--sel-bg); color: var(--sel-ink); box-shadow: inset 0 0 0 1px var(--sel-ring); font-weight: 600; }
.cs-menu a .ico { flex: none; color: var(--muted); }
.cs-menu a[aria-current="page"] .ico { color: currentColor; }
.cs-lib { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.cs-n { flex: none; min-width: 1.4rem; height: 1.3rem; padding-inline: .35rem; border-radius: var(--r-pill); background: var(--orange); color: var(--navy); font: 700 var(--fs-1)/1.3rem var(--f-body); font-variant-numeric: tabular-nums; text-align: center; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .cs-n { color: var(--bg); } }
:root[data-theme="dark"] .cs-n { color: var(--bg); }
/* L'en-tête : l'école et la recherche au bout de la ligne du titre (ordinateur), sous lui ailleurs */
.cs-outils { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; min-width: 0; }
.en-tete-act .cs-outils { flex-wrap: nowrap; }
.cs-ecole { display: inline-flex; align-items: center; gap: .4rem; padding-inline-start: .6rem; border: 1px solid var(--line-strong); border-radius: var(--r-md); background: var(--surface); color: var(--muted); }
.cs-ecole select { border: 0; background: transparent; padding-inline: .2rem .5rem; color: var(--ink); font-weight: 600; }
/* Un nom d'école long se coupe au lieu de faire défiler la page de côté (390 px) */
.cs-ecole { min-width: 0; max-width: 100%; }
.cs-ecole select { min-width: 0; flex: 0 1 auto; text-overflow: ellipsis; }
@media (pointer: fine) { .cs-ecole select { min-height: 40px; } }
.cs-cherche { position: relative; flex: 1 1 18rem; min-width: 0; }
.en-tete-act .cs-cherche { flex: 0 1 21rem; width: 21rem; }
.cs-q { min-height: 42px; }
.cs-q input { min-width: 0; flex: 1; }
.cs-q input::-webkit-search-cancel-button { cursor: pointer; }
.cs-kbd { flex: none; display: inline-grid; place-items: center; min-width: 1.4rem; height: 1.4rem; padding-inline: .3rem; border: 1px solid var(--line-strong); border-radius: 6px; color: var(--muted); font: 600 var(--fs-1)/1 var(--f-body); }
@media (max-width: 1099px), (pointer: coarse) { .cs-kbd { display: none; } }
.cs-res { position: absolute; z-index: 30; inset-inline: 0; top: calc(100% + 6px); margin: 0; padding: .3rem; list-style: none; max-height: min(60vh, 26rem); overflow-y: auto;
  background: var(--raised); border-radius: var(--r-lg); box-shadow: var(--sh2); }
.cs-res[hidden] { display: none; }
.cs-opt { display: flex; align-items: center; gap: .6rem; min-height: 48px; padding: .4rem .55rem; border-radius: var(--r-md); cursor: pointer; }
.cs-opt.on { background: var(--sel-bg); box-shadow: inset 0 0 0 1px var(--sel-ring); }
.cs-opt-ico { display: inline-grid; place-items: center; flex: none; width: 28px; height: 28px; border-radius: 50%; background: var(--surface-2); color: var(--ink-2); }
.cs-opt-txt { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.cs-opt-t { font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-opt-s { font-size: var(--fs-2); color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-opt .tag { flex: none; margin: 0; }
.cs-vide { position: absolute; z-index: 30; inset-inline: 0; top: calc(100% + 6px); margin: 0; padding: .7rem .9rem; background: var(--raised); border-radius: var(--r-lg); box-shadow: var(--sh2); }
@media (max-width: 760px) { .cs-cherche { flex-basis: 100%; } }
`);
