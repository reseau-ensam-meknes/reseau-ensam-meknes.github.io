// Lot design · B : briques partagées des listes (Réseau, Admin, Offres)
//  - PucesNav : la rangée fine de puces (36 px, icône 16 px + texte) qui sert d'onglets ; la puce active se voit toujours
//  - useVoirPlus / VoirPlus : une longue liste s'arrête à 20, « Voir plus (n) » montre la suite
//  - BoutonFiltres / FeuilleFiltres : « Filtres · 2 » ouvre une feuille du bas ; « Effacer » et « Voir N résultats »
import { html, useState, useLayoutEffect, useRef } from './vendor/preact-htm.js';
import { Icon, Modal } from './ui.js';
import { ajouterIcones } from './entree.js';

// Réglages (le bouton « Filtres »)
ajouterIcones({ filtres: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>' });

const reduit = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } };

// La puce active au centre de sa rangée (à l'ouverture, par un lien, une notification, en arabe aussi),
// sans jamais faire défiler la page en hauteur : rangée hors de l'écran (Retour en bas d'une liste), on la décale seule
function centrer(el, doux) {
  const rangee = el?.parentElement;
  if (!rangee || rangee.scrollWidth <= rangee.clientWidth + 1) return;
  const r = rangee.getBoundingClientRect();
  if (r.top >= 0 && r.bottom <= innerHeight) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: doux && !reduit() ? 'smooth' : 'auto' });
  else { const e = el.getBoundingClientRect(); rangee.scrollBy({ left: e.left + e.width / 2 - (r.left + r.width / 2), behavior: 'auto' }); }
}

// items : [{ k, label, icon, n }] ; n, une pastille (chiffre) qui reste visible sur la puce
export function PucesNav({ items, actif, onChoisir, label, cls = '', idPrefix = '' }) {
  const ref = useRef();
  const vu = useRef(false);
  useLayoutEffect(() => {
    const el = ref.current?.querySelector('[aria-selected="true"]');
    if (el) centrer(el, vu.current);
    vu.current = true;
  }, [actif]);
  return html`<div class=${'puces-nav' + (cls ? ' ' + cls : '')} role="tablist" aria-label=${label} ref=${ref}>${items.map(({ k, label: l, icon, n }) => html`<button type="button" role="tab" key=${k} id=${idPrefix ? idPrefix + (k || 'vue') : undefined} aria-selected=${actif === k} class=${actif === k ? 'on' : ''} onClick=${() => onChoisir(k)}>
    ${icon ? html`<${Icon} name=${icon} size=${16}/>` : null}<span>${l}</span>${n ? html`<span class="puce-n">${n}</span>` : null}</button>`)}</div>`;
}

// Les 20 premiers, puis la suite à la demande ; « cle » remet à 20 quand la recherche ou les filtres changent
export function useVoirPlus(liste, pas = 20, cle = '') {
  const [st, setSt] = useState({ cle, n: pas });
  const max = st.cle === cle ? st.n : pas;
  return { vus: liste.slice(0, max), reste: Math.max(0, liste.length - max), plus: () => setSt({ cle, n: max + pas }), total: liste.length };
}
export function VoirPlus({ reste, onPlus }) {
  if (!reste) return null;
  return html`<button type="button" class="btn ghost voir-plus" onClick=${onPlus}>${`Voir plus (${reste})`}</button>`;
}

// « Filtres » ou « Filtres · 2 » : le nombre de filtres actifs se lit sans ouvrir la feuille
export function BoutonFiltres({ actifs = 0, onClick, id }) {
  return html`<button type="button" id=${id} class=${'btn filtres-btn' + (actifs ? ' on' : '')} aria-haspopup="dialog" aria-pressed=${actifs > 0} onClick=${onClick}>
    <${Icon} name="filtres" size=${16}/><span>${actifs ? `Filtres · ${actifs}` : 'Filtres'}</span></button>`;
}
// Les filtres s'appliquent tout de suite (la liste derrière bouge déjà) ; le bouton du bas dit combien il en reste
export function FeuilleFiltres({ titre = 'Filtres', total, actifs, onEffacer, onClose, children }) {
  return html`<${Modal} title=${titre} onClose=${onClose} cls="filtres-feuille" footer=${html`
    <button type="button" class="btn ghost" disabled=${!actifs} onClick=${onEffacer}>Effacer</button>
    <button type="button" class="btn primary" onClick=${onClose}>${total ? (total > 1 ? `Voir ${total} résultats` : 'Voir 1 résultat') : 'Aucun résultat'}</button>`}>
    <div class="filtres-corps">${children}</div>
  <//>`;
}
