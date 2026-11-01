// « Moi » : ce qui me concerne, derrière l'avatar en haut. Sur téléphone, une feuille qui monte du bas ; sur ordinateur,
// un panneau posé sous l'avatar (comme la cloche). Le focus y entre, Échap la ferme et le rend à l'avatar (Modal ;
// app.js donne le focus à l'avatar quand on le touche, ce que Safari ne fait pas de lui-même).
// Dans l'ordre, sans doublon : qui je suis (et, pour l'administration, la vue Admin | Lauréat), mes pages, le thème,
// l'aide, la confidentialité, l'administration, puis se déconnecter. Sur téléphone seulement, les pages que la barre du
// bas n'a pas (l'ordinateur les a déjà dans la barre latérale).
import { html } from './vendor/preact-htm.js';
import { Icon, Avatar, Modal, roleTexte, injectCSS } from './ui.js';
import { ajouterIcones } from './entree.js';
import { addAR } from './i18n.js';

// Thème automatique : un disque à moitié plein (comme l'appareil, clair ou sombre)
ajouterIcones({ contraste: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>' });

// Les trois choix du thème : null suit l'appareil
const THEMES = [[null, 'Automatique', 'contraste'], ['light', 'Clair', 'sun'], ['dark', 'Sombre', 'moon']];

// theme : le choix gardé (null, 'light' ou 'dark') ; choisirTheme(t) l'applique (setTheme d'app.js)
// installer : null si l'application ne peut pas s'installer ici (déjà installée, navigateur sans installation)
export function Moi({ me, mode, avecMatch, pointPerso, theme, choisirTheme, installer, go, changerVue, ouvrirAnnee, sortir, onClose }) {
  const perso = me.role === 'etudiant' ? ['parcours', 'Mon parcours', 'route'] : ['espace', 'Mon espace', 'star'];
  const ligne = (icone, label, faire, cls = '', fin = null) => html`<button type="button" class=${'moi-ligne' + (cls ? ' ' + cls : '')} onClick=${faire}>
    <${Icon} name=${icone} size=${18}/><span class="grow">${label}</span>${fin}</button>`;
  return html`<${Modal} title="Moi" cls="moi" onClose=${onClose}>
    <div class="moi-tete">
      <${Avatar} p=${me} size=${52}/>
      <div class="moi-qui"><strong translate="no" dir="auto">${me.full_name}</strong><span class="small muted">${roleTexte(me)}</span></div>
    </div>
    ${me.admin_ok ? html`<div class="vue-switch moi-vue" role="group" aria-label="Voir l’application comme">${[['admin', 'Admin', 'shield'], ['laureat', 'Lauréat', 'star']].map(([r, l, i]) =>
      html`<button type="button" key=${r} class=${me.role === r ? 'on' : ''} aria-pressed=${me.role === r} onClick=${() => me.role !== r && changerVue(r)}><${Icon} name=${i} size=${16}/> ${l}</button>`)}</div>` : null}
    <div class="moi-groupe">
      ${ligne('user', 'Mon profil', () => go('profil'))}
      ${ligne('chart', me.role === 'etudiant' ? 'Mon année' : 'Suivi', () => go('suivi'), 'moi-tel')}
      ${avecMatch ? ligne(perso[2], perso[1], () => go(perso[0]), 'moi-tel', pointPerso ? html`<span class="dotn" aria-hidden="true"></span><span class="sr-only">À faire ici</span>` : null) : null}
    </div>
    <div class="moi-groupe moi-theme">
      <span class="moi-theme-l" id="moi-theme-l">Thème</span>
      <div class="seg" role="group" aria-labelledby="moi-theme-l">${THEMES.map(([t, l, i]) => html`<button type="button" key=${l} class=${theme === t ? 'on' : ''} aria-pressed=${theme === t}
        onClick=${() => theme !== t && choisirTheme(t)}><${Icon} name=${i} size=${16}/><span>${l}</span></button>`)}</div>
    </div>
    <div class="moi-groupe">
      ${me.role !== 'admin' ? ligne('route', 'Comment ça marche ?', () => go('accueil/etapes')) : null}
      ${me.role !== 'admin' ? ligne('award', 'Ton année dans le réseau', ouvrirAnnee) : null}
      ${installer ? ligne('download', 'Installer l’application', installer) : null}
      ${ligne('shield', 'Confidentialité', () => go('confidentialite'))}
      ${me.role === 'admin' ? ligne('shield', 'Administration', () => go('admin')) : null}
    </div>
    <div class="moi-groupe">
      ${mode === 'live' ? ligne('logout', 'Se déconnecter', sortir, 'moi-sortir') : ligne('spark', 'Réinitialiser la démo', sortir, 'moi-sortir')}
    </div>
  <//>`;
}

injectCSS('moi', `
/* Ordinateur : un panneau sous l'avatar, le fond à peine voilé (comme la cloche) */
@media (min-width: 761px) {
  .modal-back:has(> .modal.moi) { place-items: start end; padding: 64px 16px 16px; background: rgb(10 12 18 / calc(.2 * var(--voile, 1))); }
  .modal.moi { width: min(360px, 100%); max-height: calc(100vh - 80px); }
}
.modal.moi .modal-body { gap: .5rem; }
.moi-tete { display: flex; align-items: center; gap: .85rem; min-width: 0; padding-bottom: .35rem; }
.moi-qui { display: flex; flex-direction: column; gap: .15rem; min-width: 0; }
.moi-qui strong { font-size: var(--fs-4); line-height: 1.25; overflow-wrap: anywhere; }
.moi-vue { margin: 0 0 .35rem; }
.moi-vue button { display: inline-flex; align-items: center; justify-content: center; gap: .35rem; min-height: 44px; padding: .45rem .5rem; border: 0; border-radius: calc(var(--r-md) - 3px); background: transparent; font: inherit; font-weight: 600; color: var(--ink-2); cursor: pointer; }
.moi-vue button.on { background: var(--raised); color: var(--ink); box-shadow: var(--sh1); }
.moi-groupe { display: flex; flex-direction: column; padding-top: .5rem; border-top: 1px solid var(--line); }
.moi-ligne { display: flex; align-items: center; gap: .75rem; min-height: 44px; padding: .5rem .6rem; margin-inline: -.6rem; border: 0; border-radius: var(--r-sm); background: none; color: var(--ink); font: inherit; font-weight: 500; text-align: start; cursor: pointer; }
.moi-ligne:hover { background: var(--surface-2); }
.moi-ligne > .ico { flex: none; color: var(--ink-2); }
.moi-ligne .dotn { flex: none; }
.moi-tel { display: none; }
@media (max-width: 760px) { .moi-tel { display: flex; } }
/* Le thème : trois choix côte à côte, l'icône au-dessus du mot (« Automatique » tient sur 320 px) */
.moi-theme { gap: .5rem; padding-block: .75rem .5rem; }
.moi-theme-l { font-size: var(--fs-2); font-weight: 600; color: var(--ink-2); }
.moi-theme .seg { display: flex; align-self: stretch; overflow: visible; }
.moi-theme .seg button { flex: 1 1 0; min-width: 0; flex-direction: column; gap: .25rem; min-height: 56px; padding: .45rem .3rem; font-size: var(--fs-2); }
.moi-theme .seg button > span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.moi-sortir > .ico { color: var(--muted); }
@media (prefers-reduced-motion: reduce) { .moi-ligne, .moi-theme .seg button { transition: none; } }
`);

addAR({ 'Moi': 'أنا', 'Thème': 'المظهر', 'Automatique': 'تلقائي', 'Clair': 'فاتح', 'Sombre': 'داكن' });
