// La fiche « Installer l'application » : les gestes de l'iPhone (Safari) ou d'Android (Chrome), chacun montré par un petit
// dessin de l'écran (le bouton à toucher entouré) et une phrase courte. En tête, l'accueil du Réseau ENSAM dans un
// téléphone : ce qu'on obtient (une vraie capture, outils/generer-demarrage.mjs). Les dessins n'ont pas de texte : ils
// servent en français comme en arabe, retournés en miroir comme l'écran du téléphone. Leur anneau ne bat pas quand
// l'appareil demande moins de mouvement. pwa.js la réexporte (IosInstallHelp) : les notifications s'en servent aussi.
import { html, useState } from './vendor/preact-htm.js';
import { Icon, Modal, injectCSS } from './ui.js';
import { getLang, addAR, t as traduire } from './i18n.js';
import { estIPad, nomsLatins } from './appareil.js';

// Typographie française des gestes : ni « ni : ? ! ; seul en début ou en fin de ligne (espace insécable). En arabe, la
// phrase française reste la clé du dictionnaire : elle passe telle quelle.
const fr = s => (getLang() === 'ar' ? s : s.replace(/« /g, '« ').replace(/ ([»:;?!])/g, ' $1'));

const POURQUOI = {
  ios: 'Sur iPhone, les notifications n’arrivent que dans l’application ajoutée à l’écran d’accueil. Trois gestes :',
  android: 'Une icône sur ton écran d’accueil : AlloLauréat s’ouvre en un toucher, comme une application.',
};
// Partager est en bas de Safari, ou dans son menu ••• ; dans Chrome ou Firefox sur iPhone, dans la barre d'adresse
// Sur iPad (portes #59), Partager est en haut de l'écran de Safari
const PARTAGER = { safari: 'Dans Safari, touche Partager : en bas de l’écran, ou dans le menu •••.', ipad: 'Dans Safari, touche Partager, en haut de l’écran.', autre: 'Touche Partager, dans la barre d’adresse ou dans le menu du navigateur.' };
const IOS = [
  ['partager', ''],
  ['accueil', 'Choisis « Sur l’écran d’accueil ».'],
  ['ajouter', 'Laisse « Ouvrir en tant qu’app web » activé, puis touche « Ajouter ».'],
];
// Android sans proposition du navigateur (Firefox, Samsung Internet, ou Chrome qui ne l'a pas encore proposée)
const ANDROID = [
  ['menu', 'Touche le menu ⋮ du navigateur.'],
  ['installer', 'Choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ».'],
  ['confirmer', 'Confirme en touchant « Installer ».'],
];
// Installer ne suffit pas : les notifications s'activent ensuite, dans l'application
const APRES = {
  ios: 'Ouvre AlloLauréat depuis sa nouvelle icône, connecte-toi une fois, puis touche « Activer ».',
  android: 'Ouvre AlloLauréat depuis son icône, puis touche « Activer les notifications » si ce n’est pas déjà fait.',
};
const autreNavigateurIos = () => typeof navigator !== 'undefined' && /CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
// iPad (iPadOS compris : il se présente comme un Mac, avec un écran tactile), comme pwa.js : la phrase dit « iPad »
const surIPad = () => typeof navigator !== 'undefined' && (estIPad(navigator.userAgent, navigator.maxTouchPoints) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const pourIos = s => (surIPad() ? s.replace(/iPhone/g, 'iPad') : s);
// Un geste qui nomme Safari ou Chrome : traduit d'abord, puis chaque nom dans son <span translate="no" dir="auto"> (comme les
// gestes de pwa.js, portes #59). Preact écrit translate comme une propriété : l'attribut est posé à la main.
const sansTraduction = el => el?.setAttribute('translate', 'no');
const avecNoms = s => nomsLatins(fr(traduire(s))).map((p, i) => (i % 2 ? html`<span translate="no" dir="auto" ref=${sansTraduction}>${p}</span>` : p));

// ---------------------------------------------------------------------------
// Les dessins (120 × 80) : un bout d'écran, des traits pour le texte, le bouton à toucher entouré d'un anneau
// ---------------------------------------------------------------------------
// Des fonctions, pas des constantes : chaque dessin affiché a ses propres nœuds (Preact ne partage pas un nœud entre deux places)
const ecran = () => html`<rect class="m-ecran" x=".75" y=".75" width="118.5" height="78.5" rx="10"/>`;
const traits = (x, y, ls) => ls.map((l, i) => html`<rect class=${'m-trait' + (i ? ' faible' : '')} x=${x} y=${y + i * 8} width=${l} height=${i ? 3.5 : 4.5} rx="1.75"/>`);
const cible = (forme, anneau) => html`${forme}<g class="m-anneau">${anneau}</g>`;
const appli = (x, y, t) => html`<rect class="m-appli" x=${x} y=${y} width=${t} height=${t} rx=${t * .24}/><circle class="m-appli-o" cx=${x + t / 2} cy=${y + t / 2} r=${t * .26}/>`;
const DESSINS = {
  // Safari : la barre du bas, Partager au milieu
  partager: () => html`${ecran()}${traits(12, 12, [62, 92, 80])}
    <path class="m-barre" d="M.75 50h118.5v19.5a9.75 9.75 0 0 1-9.75 9.75h-99A9.75 9.75 0 0 1 .75 69.5z"/>
    <path class="m-ico" d="M17 60.5l-4 3.5 4 3.5M33 60.5l4 3.5-4 3.5"/>
    <path class="m-ico" d="M80.5 59.5h7a1.5 1.5 0 0 1 1.5 1.5v8h-7a1.5 1.5 0 0 0-1.5 1.5zM100.5 61h7v7h-7zM103 58.5h6.5v6.5"/>
    ${cible(html`<circle class="m-cible" cx="60" cy="64" r="10"/>`, html`<circle cx="60" cy="64" r="10"/>`)}
    <path class="m-ico fort" d="M56 62.5v6.5h8v-6.5M60 56.5v8.5M57 59.5l3-3 3 3"/>`,
  // Chrome, Firefox ou Edge sur iPhone, et Safari sur iPad : Partager en haut, au bout de la barre d'adresse (pas dans une barre du bas)
  partagerHaut: () => html`${ecran()}<path class="m-barre" d="M.75 10.75A10 10 0 0 1 10.75.75h98.5a10 10 0 0 1 10 10V26H.75z"/>
    <rect class="m-champ" x="7" y="7" width="106" height="13" rx="6.5"/><path class="m-ico" d="M12.5 13.5h4v3.5h-4zM13.25 13.5v-1.25a1.25 1.25 0 0 1 2.5 0v1.25"/><rect class="m-trait" x="21" y="11.75" width="44" height="3.5" rx="1.75"/>
    ${cible(html`<circle class="m-cible" cx="104" cy="13.5" r="8"/>`, html`<circle cx="104" cy="13.5" r="8"/>`)}
    <path class="m-ico fort" d="M101.2 12.4v4.6h5.6v-4.6M104 8.3v6M101.9 10.4l2.1-2.1 2.1 2.1"/>
    ${traits(12, 36, [70, 96, 84, 58])}`,
  // La feuille de partage : « Sur l'écran d'accueil » (un plus dans un carré)
  accueil: () => html`${ecran()}${traits(12, 10, [70])}<rect class="m-voile" x=".75" y=".75" width="118.5" height="78.5" rx="10"/>
    <path class="m-feuille" d="M.75 30A10 10 0 0 1 10.75 20h98.5a10 10 0 0 1 10 10v39.5a9.75 9.75 0 0 1-9.75 9.75h-99A9.75 9.75 0 0 1 .75 69.5z"/>
    <rect class="m-ligne" x="8" y="26" width="104" height="13" rx="3.5"/>${traits(13, 30.5, [38])}<path class="m-ico" d="M101 29.5v6.5h7v-6.5M104.5 28v5"/>
    ${cible(html`<rect class="m-cible" x="8" y="43" width="104" height="13" rx="3.5"/>`, html`<rect x="8" y="43" width="104" height="13" rx="3.5"/>`)}
    <rect class="m-trait fort" x="13" y="47.5" width="48" height="4" rx="2"/><path class="m-ico fort" d="M100.5 45.5h7.5a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1zM104.25 47.5v5.5M101.5 50.25h5.5"/>
    <rect class="m-ligne" x="8" y="60" width="104" height="13" rx="3.5"/>${traits(13, 64.5, [30])}`,
  // L'écran « Ajouter » : l'icône du Réseau ENSAM, « Ouvrir en tant qu'app web » activé, « Ajouter » en haut
  ajouter: () => html`${ecran()}<path class="m-barre" d="M.75 10.75A10 10 0 0 1 10.75.75h98.5a10 10 0 0 1 10 10V22H.75z"/>
    <rect class="m-trait lien" x="9" y="9.5" width="18" height="3.5" rx="1.75"/><rect class="m-trait" x="44" y="9.25" width="32" height="4" rx="2"/>
    ${cible(html`<rect class="m-cible" x="86" y="5.5" width="27" height="12" rx="6"/>`, html`<rect x="86" y="5.5" width="27" height="12" rx="6"/>`)}
    <rect class="m-trait lien fort" x="91" y="9.75" width="17" height="3.5" rx="1.75"/>
    ${appli(10, 28, 20)}${traits(37, 31, [46, 66])}
    <rect class="m-trait" x="10" y="61" width="58" height="4" rx="2"/><rect class="m-bascule" x="90" y="57" width="20" height="12" rx="6"/><circle class="m-bouton" cx="104" cy="63" r="4.5"/>`,
  // Chrome : la barre d'adresse en haut, le menu ⋮ à son bout
  menu: () => html`${ecran()}<path class="m-barre" d="M.75 10.75A10 10 0 0 1 10.75.75h98.5a10 10 0 0 1 10 10V26H.75z"/>
    <rect class="m-champ" x="7" y="7" width="80" height="13" rx="6.5"/><path class="m-ico" d="M12.5 13.5h4v3.5h-4zM13.25 13.5v-1.25a1.25 1.25 0 0 1 2.5 0v1.25"/><rect class="m-trait" x="21" y="11.75" width="40" height="3.5" rx="1.75"/>
    <rect class="m-ico" x="93" y="9.5" width="8" height="8" rx="2"/>
    ${cible(html`<circle class="m-cible" cx="111" cy="13.5" r="7"/>`, html`<circle cx="111" cy="13.5" r="7"/>`)}
    <circle class="m-point" cx="111" cy="9.5" r="1.3"/><circle class="m-point" cx="111" cy="13.5" r="1.3"/><circle class="m-point" cx="111" cy="17.5" r="1.3"/>
    ${traits(12, 36, [70, 96, 84, 58])}`,
  // Le menu de Chrome : « Installer l'application » (un téléphone et une flèche)
  installer: () => html`${ecran()}<path class="m-barre" d="M.75 10.75A10 10 0 0 1 10.75.75h98.5a10 10 0 0 1 10 10V26H.75z"/>${traits(12, 36, [52, 40])}
    <rect class="m-menu" x="50" y="5" width="64" height="70" rx="5"/>${traits(58, 12.5, [34])}${traits(58, 25.5, [42])}
    ${cible(html`<rect class="m-cible" x="53" y="36" width="58" height="14" rx="3.5"/>`, html`<rect x="53" y="36" width="58" height="14" rx="3.5"/>`)}
    <path class="m-ico fort" d="M59 39.5h5.5a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H59a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1zM61.75 41.5v4M60 44l1.75 1.75L63.5 44"/>
    <rect class="m-trait fort" x="69" y="41.25" width="36" height="3.5" rx="1.75"/>${traits(58, 57.5, [30])}${traits(58, 66.5, [38])}`,
  // La confirmation : l'icône, le nom, « Installer »
  confirmer: () => html`${ecran()}${traits(12, 10, [70, 92, 84, 60, 88, 74])}<rect class="m-voile" x=".75" y=".75" width="118.5" height="78.5" rx="10"/>
    <rect class="m-carte" x="13" y="13" width="94" height="54" rx="7"/>${appli(20, 20, 16)}${traits(42, 22.5, [44, 34])}
    <rect class="m-trait lien" x="44" y="53.5" width="20" height="3.5" rx="1.75"/>
    ${cible(html`<rect class="m-cible plein" x="70" y="48.5" width="31" height="13" rx="6.5"/>`, html`<rect x="70" y="48.5" width="31" height="13" rx="6.5"/>`)}
    <rect class="m-trait sur-plein" x="77" y="53.25" width="17" height="3.5" rx="1.75"/>`,
};
const Dessin = ({ k }) => html`<svg class="ins-svg" viewBox="0 0 120 80" width="120" height="80" focusable="false">${DESSINS[k]()}</svg>`;

// L'accueil du Réseau ENSAM dans un téléphone (le haut de l'écran, qui s'estompe). Sans l'image (démo en Artifact) : rien.
function Telephone() {
  const [rate, setRate] = useState(false);
  if (rate) return null;
  return html`<span class="ins-tel" aria-hidden="true"><img src=${`pwa/captures/accueil-${getLang() === 'ar' ? 'ar' : 'fr'}.jpg`} alt="" width="390" height="600"
    decoding="async" onError=${() => setRate(true)}/></span>`;
}

export function IosInstallHelp({ onClose, android }) {
  const sys = android ? 'android' : 'ios';
  // Chrome, Firefox ou Edge sur iPhone : Partager est en haut, le dessin le montre là (pas la barre du bas de Safari)
  const autre = !android && autreNavigateurIos();
  // Safari sur iPad : Partager en haut de l'écran, le dessin le montre là aussi
  const ipad = !android && !autre && surIPad();
  const etapes = android ? ANDROID : IOS.map(([k, t]) => (k === 'partager' ? [autre || ipad ? 'partagerHaut' : k, autre ? PARTAGER.autre : ipad ? PARTAGER.ipad : PARTAGER.safari] : [k, t]));
  return html`<${Modal} title="Installer l’application" cls="installer" onClose=${onClose}>
    <div class="ins-tete"><${Telephone}/><p class="ins-pourquoi">${fr(android ? POURQUOI.android : pourIos(POURQUOI.ios))}</p></div>
    <ol class="ios-steps ins-etapes">${etapes.map(([k, t], i) => html`<li key=${k}>
      <span class="ins-dessin" aria-hidden="true"><${Dessin} k=${k}/><span class="ins-n">${i + 1}</span></span><span class="ins-txt">${avecNoms(t)}</span></li>`)}</ol>
    <p class="ins-apres"><span class="ins-cloche" aria-hidden="true"><${Icon} name="bell" size=${16}/></span><span>${fr(APRES[sys])}</span></p>
  <//>`;
}

injectCSS('installer', `
.ins-tete { display: flex; align-items: flex-start; gap: 1rem; }
.ins-pourquoi { margin: 0; flex: 1; min-width: 0; align-self: center; text-wrap: pretty; }
/* Le téléphone : son cadre, l'île en haut, le bas de l'écran qui s'estompe */
.ins-tel { --cadre: #16253F; position: relative; flex: none; width: 92px; height: 132px; padding: 4px 4px 0; border-radius: 18px 18px 0 0; background: var(--cadre); overflow: hidden;
  -webkit-mask-image: linear-gradient(#000 62%, transparent); mask-image: linear-gradient(#000 62%, transparent); }
.ins-tel::before { content: ""; position: absolute; top: 7px; inset-inline: 0; width: 24px; height: 7px; margin-inline: auto; border-radius: 4px; background: var(--cadre); }
.ins-tel img { display: block; width: 100%; height: auto; border-radius: 14px 14px 0 0; background: var(--surface-2); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .ins-tel { --cadre: #3B4D6B; } }
:root[data-theme="dark"] .ins-tel { --cadre: #3B4D6B; }
/* Les gestes : le dessin, son numéro, la phrase */
.installer .ins-etapes { gap: .9rem; }
.installer .ins-etapes li { display: grid; grid-template-columns: 104px minmax(0, 1fr); align-items: center; gap: .9rem; }
.ins-dessin { position: relative; display: block; line-height: 0; }
.ins-svg { display: block; width: 104px; height: auto; overflow: visible; }
[dir="rtl"] .ins-svg { transform: scaleX(-1); }
.ins-n { position: absolute; top: -7px; inset-inline-start: -7px; min-width: 22px; height: 22px; border-radius: 11px; background: var(--accent); color: var(--accent-ink);
  font: 700 var(--fs-1)/22px var(--f-body); text-align: center; box-shadow: 0 0 0 2px var(--surface); }
.ins-txt { min-width: 0; text-wrap: pretty; }
.ins-apres { display: flex; align-items: center; gap: .7rem; margin: .2rem 0 0; padding: .7rem .8rem; border-radius: var(--r-md); background: var(--surface-2); color: var(--ink-2); font-size: var(--fs-2); }
.ins-cloche { flex: none; display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--accent-soft); color: var(--blue-text); }
/* Les couleurs des dessins suivent le thème */
.ins-svg .m-ecran { fill: var(--surface); stroke: var(--line-strong); stroke-width: 1.5; }
.ins-svg .m-barre { fill: var(--surface-2); }
.ins-svg .m-champ, .ins-svg .m-ligne { fill: var(--surface-2); }
.ins-svg .m-feuille, .ins-svg .m-menu, .ins-svg .m-carte { fill: var(--raised); stroke: var(--line-strong); stroke-width: 1; }
.ins-svg .m-voile { fill: rgb(10 12 18 / .22); }
.ins-svg .m-trait { fill: var(--line-strong); }
.ins-svg .m-trait.faible { fill: var(--line); }
.ins-svg .m-trait.fort { fill: var(--ink-2); }
.ins-svg .m-trait.lien { fill: var(--accent); }
.ins-svg .m-trait.sur-plein { fill: var(--accent-ink); }
.ins-svg .m-ico { fill: none; stroke: var(--muted); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.ins-svg .m-ico.fort { stroke: var(--accent); }
.ins-svg .m-point { fill: var(--accent); }
.ins-svg .m-appli { fill: #1D3150; stroke: var(--line-strong); stroke-width: 1; }
.ins-svg .m-appli-o { fill: #F7A11A; }
.ins-svg .m-bascule { fill: #34C759; }
.ins-svg .m-bouton { fill: #FFFFFF; }
.ins-svg .m-cible { fill: color-mix(in srgb, var(--accent) 16%, transparent); stroke: var(--accent); stroke-width: 1.5; }
.ins-svg .m-cible.plein { fill: var(--accent); }
.ins-svg .m-anneau { fill: none; stroke: var(--accent); stroke-width: 1.5; transform-box: fill-box; transform-origin: center; animation: ins-pouls 1.8s var(--ease) infinite; }
@keyframes ins-pouls { from { opacity: .7; transform: scale(1); } to { opacity: 0; transform: scale(1.35); } }
@media (prefers-reduced-motion: reduce) { .ins-svg .m-anneau { animation: none; opacity: 0; } }
@media (max-width: 360px) {
  .installer .ins-etapes li { grid-template-columns: 88px minmax(0, 1fr); gap: .75rem; }
  .ins-svg { width: 88px; }
  .ins-tel { width: 80px; height: 116px; }
}
`);

addAR({
  [POURQUOI.ios]: 'على iPhone، لا تصل الإشعارات إلا داخل التطبيق المضاف إلى الشاشة الرئيسية. ثلاث خطوات:',
  [POURQUOI.android]: 'أيقونة على شاشتك الرئيسية: يُفتح ألو خريج بلمسة واحدة، مثل تطبيق.',
  [PARTAGER.safari]: 'في Safari، المس «مشاركة»: أسفل الشاشة، أو في قائمة •••.',
  [PARTAGER.ipad]: 'في Safari، المس «مشاركة» في أعلى الشاشة.',
  [PARTAGER.autre]: 'المس «مشاركة»، في شريط العنوان أو في قائمة المتصفح.',
  [POURQUOI.ios.replace(/iPhone/g, 'iPad')]: 'على iPad، لا تصل الإشعارات إلا داخل التطبيق المضاف إلى الشاشة الرئيسية. ثلاث خطوات:',
  [IOS[1][1]]: 'اختر «إضافة إلى الشاشة الرئيسية».',
  [IOS[2][1]]: 'اترك «فتح كتطبيق ويب» مفعّلًا، ثم المس «إضافة».',
  [ANDROID[0][1]]: 'المس قائمة ⋮ في المتصفح.',
  [ANDROID[1][1]]: 'اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».',
  [ANDROID[2][1]]: 'أكّد بلمس «تثبيت».',
  [APRES.ios]: 'افتح ألو خريج من أيقونتها الجديدة، وسجّل الدخول مرة واحدة، ثم المس «تفعيل».',
  [APRES.android]: 'افتح ألو خريج من أيقونتها، ثم المس «فعّل الإشعارات» إن لم يتمّ ذلك بعد.',
});
