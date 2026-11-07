// L'appareil où le Réseau s'ouvre : le navigateur intégré d'une application, un iPad, et le lien qui fait passer dans Chrome.
// Règles pures, sans autre dépendance que les règles de la page d'entrée : la page d'entrée charge ce module à part, après
// son premier affichage (elle garde ses six fichiers), et logic.js le réexporte pour le reste de l'application et les tests.
import { promoValide } from './regles-entree.js';

// Le navigateur intégré d'une application (lien ouvert dans Instagram, Facebook, Messenger, LinkedIn, TikTok, Snapchat,
// Telegram, ou une vue web Android « ; wv) ») : on n'y reste pas connecté, et ni notification ni installation n'y sont
// possibles. Messenger avant Facebook (son user-agent porte aussi FBAN). « TelegramBot », l'aperçu d'un lien, n'est pas un
// navigateur.
export const APPLIS = [
  ['Messenger', /FB_IAB\/MESSENGER|FBAN\/Messenger|MessengerForiOS|MessengerLite/i],
  ['Instagram', /\bInstagram\b/i],
  ['Facebook', /FBAN\/|FBAV\/|FB_IAB|FBIOS|FB4A/],
  ['LinkedIn', /LinkedInApp/i],
  ['TikTok', /musical_ly|BytedanceWebview|\bTikTok\b/i],
  ['Snapchat', /\bSnapchat\b/i],
  ['Telegram', /\bTelegram\b/i],
];

// iPad : son nom dans le user-agent, ou iPadOS, qui se présente comme un Mac (« Macintosh ») mais avec un écran tactile
// (toucher : navigator.maxTouchPoints). Un vrai Mac n'a pas d'écran tactile.
export const estIPad = (ua = '', toucher = 0) => /iPad/.test(String(ua || '')) || (/Macintosh/.test(String(ua || '')) && Number(toucher) > 1);

// { nom, systeme } ou null. nom : l'application quand on la reconnaît (null pour une vue web quelconque) ; systeme :
// 'android', 'ios' (iPhone, iPad, iPadOS compris) ou 'autre'.
export function navigateurIntegre(ua = '', toucher = 0) {
  const s = String(ua || '');
  const systeme = /android/i.test(s) ? 'android' : /iphone|ipad|ipod/i.test(s) || estIPad(s, toucher) ? 'ios' : 'autre';
  const a = APPLIS.find(([, re]) => re.test(s));
  if (a) return { nom: a[0], systeme };
  if (systeme === 'android' && /; wv\)/.test(s)) return { nom: null, systeme };
  return null;
}

// Ce que la page d'entrée emporte dans Chrome (contexte de lienChrome) : la promo d'un lien d'invitation, le rôle choisi et
// l'étape (créer un compte, ou se connecter). Jamais l'email tapé ni l'accord : une adresse ne voyage pas dans un lien
// (historique, journaux du serveur), et l'accord se donne là où le compte se crée.
export function contexteEntree(x) {
  const { promo, role, mode } = x || {}, out = {};
  if (promoValide(Number(promo))) out.promo = String(Number(promo));
  if (role === 'etudiant' || role === 'laureat') out.role = role;
  if (mode === 'inscription' || mode === 'connexion') out.mode = mode;
  return out;
}

// « Ouvrir dans Chrome » depuis le navigateur d'une application Android : un lien intent:// vers la même page, que Chrome
// ouvre (sinon la même adresse, ici même : browser_fallback_url). La route passe en ?r=… (le # sert à l'intent) et notifs=1
// ouvre tout de suite la feuille d'activation : c'est pour elle que le membre change de navigateur. app.js lit puis efface les deux.
// lang : la langue de la page ; Chrome ne connaît pas le choix fait ici, l'arabe passe donc par l'adresse (?lang=ar, gardé
// pour la visite, i18n.js), le français laisse Chrome à son propre choix. Sans lang : l'adresse garde le sien.
// contexte : depuis la page d'entrée, ce que le visiteur y avait déjà (contexteEntree) ; la page d'entrée le relit en arrivant.
// ici : l'adresse de secours seule porte en plus ici=1, la page d'entrée sait ainsi qu'il n'y a pas de Chrome (sans stockage aussi).
export function lienChrome(adresse, route = '', { lang, contexte, ici } = {}) {
  const u = new URL(adresse);
  u.hash = '';
  for (const k of ['r', 'notifs', 'depuis', 'ici']) u.searchParams.delete(k);
  if (lang === 'ar') u.searchParams.set('lang', 'ar'); else if (lang) u.searchParams.delete('lang');
  for (const [k, v] of Object.entries(contexteEntree(contexte))) u.searchParams.set(k, v);
  const r = String(route || '').replace(/^#/, '');
  if (r && r !== 'accueil') u.searchParams.set('r', r);
  u.searchParams.set('notifs', '1');
  const cible = u.href, schema = u.protocol.replace(/:$/, '');
  if (ici) u.searchParams.set('ici', '1');
  return `intent://${cible.slice(u.protocol.length + 2)}#Intent;scheme=${schema};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
}
// La carte de la page d'entrée dans le navigateur d'une application (CarteAppli, entree.js) : ses phrases, leur arabe et son
// style arrivent avec ce module, seul ce navigateur-là en a besoin (la page d'entrée reste légère). Mêmes mots que les
// feuilles de l'application (pwa.js). La feuille du navigateur d'une application est montrée une fois par visite au plus
// (CLE_APPLI_VUE, cet onglet) : la carte de l'entrée compte pour elle.
export const CLE_APPLI_VUE = 'ensam-appli-vue';
// Le geste pour passer dans Safari depuis le navigateur d'une application (iPhone, iPad) : le même dans la carte de l'entrée,
// son mot discret et les feuilles de l'application (ETAPES_APPLI, pwa.js, qui l'importe), avec un seul arabe (CARTE_AR)
export const GESTE_SAFARI = 'Touche ••• (en haut ou en bas de l’écran), puis « Ouvrir dans Safari » ou « Ouvrir dans le navigateur ».';
export const CARTE = {
  tuEs: nom => (nom ? `Tu es dans le navigateur ${/^[AEIOUY]/i.test(nom) ? 'd’' : 'de '}${nom}.` : 'Tu es dans le navigateur d’une application.'),
  android: 'Ouvre le Réseau dans Chrome : tu y resteras connecté et tes notifications arriveront sur ce téléphone.',
  ios: 'Ouvre le Réseau dans Safari : tu y resteras connecté.',
  geste: GESTE_SAFARI,
  icone: { iphone: 'Sur iPhone, les notifications passent ensuite par l’icône de l’écran d’accueil.', ipad: 'Sur iPad, les notifications passent ensuite par l’icône de l’écran d’accueil.' },
  ouvrir: 'Ouvrir dans Chrome', ici: 'Continuer ici', ligne: 'Ouvrir le Réseau dans Chrome',
  rien: 'Rien ne s’ouvre ? Touche ⋮ en haut à droite, puis « Ouvrir dans Chrome » ou « Ouvrir dans le navigateur ».',
};
export const CARTE_AR = {
  [CARTE.tuEs()]: 'أنت في متصفح أحد التطبيقات.',
  [CARTE.android]: 'افتح الشبكة في Chrome: ستبقى متصلًا، وستصل إشعاراتك إلى هذا الهاتف.',
  [CARTE.ios]: 'افتح الشبكة في Safari: ستبقى متصلًا.',
  [GESTE_SAFARI]: 'المس ••• (أعلى الشاشة أو أسفلها)، ثم «فتح في Safari» أو «فتح في المتصفح».',
  [CARTE.icone.iphone]: 'على iPhone، تصل الإشعارات بعد ذلك عبر الأيقونة على الشاشة الرئيسية.',
  [CARTE.icone.ipad]: 'على iPad، تصل الإشعارات بعد ذلك عبر الأيقونة على الشاشة الرئيسية.',
  [CARTE.ouvrir]: 'فتح في Chrome', [CARTE.ici]: 'المتابعة هنا', [CARTE.ligne]: 'افتح الشبكة في Chrome',
  [CARTE.rien]: 'لا يُفتح شيء؟ المس ⋮ في أعلى الشاشة، ثم «فتح في Chrome» أو «فتح في المتصفح».',
};
// Les espaces insécables de la typographie française (avant « : ? ! » et dans les guillemets), comme les feuilles de
// l'application (pwa.js) : jamais un deux-points ni un guillemet seul en début de ligne. En arabe, la phrase telle quelle :
// c'est elle que le dictionnaire reconnaît.
export const typo = (s, lang) => (lang === 'ar' || typeof s !== 'string' ? s : s.replace(/« /g, '«\u00a0').replace(/ ([»:;?!])/g, '\u00a0$1'));
export const CARTE_MOTIFS = [[/^Tu es dans le navigateur (?:d’|de )(.+)\.$/, n => `أنت في متصفح ${n}.`]];
// Cibles de 44 px au moins. La page d'entrée garde à la carte la place de la plus haute (PLACE, entree.js : une phrase ou un
// style qui change sa hauteur s'y reporte) ; une carte plus courte remplit cette place, ses gestes en bas. « Rien ne s'ouvre ? »,
// sous les gestes, ne prend de place qu'une fois dit (vide, hors de la grille : la zone annoncée est déjà là).
export const CARTE_CSS = `.entree-appli { display: grid; grid-template-columns: auto minmax(0, 1fr); align-content: space-between; gap: .55rem .6rem; padding: .75rem .85rem; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line)); background: var(--surface); color: var(--ink); font-size: .92rem; line-height: 1.45; }
.entree-appli > .ico, .entree-appli-mot > .ico { flex: none; color: var(--accent); }
.entree-appli > .ico { margin-block-start: .12rem; }
.entree-appli-txt { display: flex; flex-direction: column; gap: .45rem; min-width: 0; }
.entree-appli-txt p { margin: 0; text-wrap: pretty; }
.entree-appli-acts { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: .25rem .5rem; }
.entree-appli-acts .btn { min-height: 44px; text-decoration: none; }
.entree-appli-acts .linkish { min-height: 44px; padding-inline: .5rem; }
.entree-appli-rien { grid-column: 1 / -1; margin: 0; font-size: var(--fs-2); line-height: 1.4; color: var(--ink-2); text-wrap: pretty; }
.entree-appli-rien:empty { position: absolute; }
.entree-appli-mot { display: flex; align-items: center; gap: .45rem; margin: 0; min-height: 44px; font-size: var(--fs-2); line-height: 1.4; color: var(--ink-2); }
.entree-appli-mot a { display: inline-flex; align-items: center; min-height: 44px; color: var(--blue-text); font-weight: 600; text-underline-offset: .2em; }
@media (prefers-reduced-motion: no-preference) { .entree-appli { animation: entree-appli .3s ease-out backwards; } }
@keyframes entree-appli { from { opacity: 0; transform: translateY(-4px); } }`;

// Paramètres d'adresse lus au démarrage (app.js), puis retirés : r (la route, venue d'un autre navigateur par « Ouvrir dans
// Chrome »), notifs=1 (le lien « Active tes notifications »), depuis=ancienne (arrivée par l'ancienne adresse du Réseau).
// search : ce qui reste de l'adresse ('' ou '?…') ; aucun : rien de tout cela (l'adresse ne change pas).
export function parametresLien(search = '') {
  const p = new URLSearchParams(search);
  const brut = (p.get('r') || '').replace(/^#/, '').trim();
  const out = { r: /^[\w\-/]{1,200}$/.test(brut) ? brut : '', notifs: p.get('notifs') === '1', depuis: p.get('depuis') === 'ancienne' ? 'ancienne' : '' };
  const aucun = !['r', 'notifs', 'depuis'].some(k => p.has(k));
  for (const k of ['r', 'notifs', 'depuis']) p.delete(k);
  const reste = p.toString();
  return { ...out, search: reste ? '?' + reste : '', aucun };
}
