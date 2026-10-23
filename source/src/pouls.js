// « Cette semaine dans le réseau » : une ligne vraie, la même pour tout le monde.
// Dès qu'un lauréat a aidé un étudiant (30 derniers jours) : « N lauréats ont aidé N étudiants ».
// Avant, sur l'accueil seulement : qui est déjà là (« 39 lauréats sont déjà là, dont 5 de ta filière »).
// Pas de classement, pas de comparaison ; un appui ouvre exactement les personnes annoncées.
import { html } from './vendor/preact-htm.js';
import { Avatar, Icon, injectCSS } from './ui.js';
import { addAR, arCount } from './i18n.js';
import { poulsReseau, presenceReseau, lignePresence, lignePouls } from './logic.js';

const VERS = { filiere: 'ma-filiere', parcours: 'mon-parcours', promo: 'ma-promo' };

// accueil : autorise la ligne de présence ; semaine : la ligne est déjà sous le titre « Cette semaine »
export function PoulsReseau({ ctx, onOpen, accueil = false, semaine = false }) {
  const { data, store, me, go } = ctx;
  const p = store.pouls ? store.pouls() : poulsReseau(data);
  const aide = p.nbAidants > 0 && p.nbAides > 0;
  const pr = !aide && accueil ? presenceReseau(data, me) : null;
  if (!aide && !pr) return null;
  const visages = (aide ? p.aidants : pr.visages).slice(0, 3).map(id => store.byId('profiles', id)).filter(Boolean);
  const ouvrir = aide ? onOpen : () => go('reseau/annuaire' + (VERS[pr.cle] ? '/' + VERS[pr.cle] : ''));
  const quand = aide && !(semaine && p.jours === 7) ? (p.jours === 7 ? 'Cette semaine' : 'Ce mois-ci') : null;
  const Tag = ouvrir ? 'button' : 'div';
  return html`<${Tag} type=${ouvrir ? 'button' : undefined} class=${'pouls' + (ouvrir ? ' clickable' : '')} onClick=${ouvrir}>
    ${visages.length ? html`<span class="pouls-visages" aria-hidden="true">${visages.map(v => html`<${Avatar} key=${v.id} p=${v} size=${28}/>`)}</span>` : null}
    <span class="pouls-txt">${quand ? html`<strong>${quand}</strong> ` : null}<span>${aide ? lignePouls(p) : lignePresence(pr)}</span>${aide && p.recrutes ? html`<span class="pouls-sep"> · </span><span>${p.recrutes > 1 ? `${p.recrutes} recrutements confirmés` : '1 recrutement confirmé'}</span>` : null}</span>
    ${ouvrir ? html`<span class="pouls-go" aria-hidden="true"><${Icon} name="arrow" size=${16}/></span>` : null}
  </${Tag}>`;
}

injectCSS('pouls', `
.pouls { display: flex; align-items: center; gap: .7rem; padding: .55rem .8rem .55rem .6rem; border-radius: var(--r-pill); background: color-mix(in srgb, var(--good-soft) 70%, var(--surface)); border: 1px solid color-mix(in srgb, var(--good) 22%, var(--line)); color: var(--ink-2); font-size: var(--fs-2); text-align: start; width: 100%; }
button.pouls { cursor: pointer; font: inherit; font-size: var(--fs-2); }
button.pouls:hover { border-color: color-mix(in srgb, var(--good) 45%, var(--line)); }
.pouls-visages { display: flex; flex: none; }
.pouls-visages .avatar { box-shadow: 0 0 0 2px var(--surface); }
.pouls-visages .avatar + .avatar { margin-inline-start: -5px; }
.pouls-txt { flex: 1; min-width: 0; text-wrap: pretty; }
.pouls-txt strong { color: var(--good); font-weight: 600; }
.pouls-go { flex: none; display: inline-flex; align-self: center; color: var(--muted); }
@media (max-width: 420px) { .pouls { border-radius: var(--r-lg); align-items: flex-start; } }
`);

// Arabe : accord du nombre (1, 2, 3-10, 11 et plus) et du verbe ; الخريجين, jamais القدامى
const LAU = ['خريج واحد', 'خريجان', 'خريجين', 'خريجًا'];
const ETU_ACC = ['طالبًا واحدًا', 'طالبَين', 'طلاب', 'طالبًا'];
const SAIDE = n => (+n === 1 ? 'ساعد' : +n === 2 ? 'ساعدا' : 'ساعدوا');
const DE_AR = { 'ta filière': 'من شعبتك', 'ton parcours': 'من مسارك', 'ta promo': 'من دفعتك' };
const NB_AR = n => (+n === 1 ? 'واحد' : +n === 2 ? 'اثنان' : n);
addAR({ 'Cette semaine': 'هذا الأسبوع', 'Ce mois-ci': 'هذا الشهر', '1 recrutement confirmé': 'توظيف واحد مؤكَّد' }, [
  [/^(\d+) lauréats? (?:ont|a) aidé (\d+) étudiants?$/, (a, b) => `${arCount(a, LAU)} ${SAIDE(a)} ${arCount(b, ETU_ACC)}`],
  [/^(\d+) recrutements? confirmés?$/, n => arCount(n, ['توظيف واحد مؤكَّد', 'توظيفان مؤكَّدان', 'توظيفات مؤكَّدة', 'توظيفًا مؤكَّدًا'])],
  [/^(\d+) lauréats? (?:sont|est) déjà là$/, t => `معك في الشبكة ${arCount(t, LAU)}`],
  [/^(\d+) lauréats? de (ta filière|ton parcours|ta promo) (?:sont|est) déjà là$/, (t, x) => `معك في الشبكة ${arCount(t, LAU)} ${DE_AR[x]}`],
  [/^(\d+) lauréats sont déjà là, dont (\d+) de (ta filière|ton parcours|ta promo)$/, (t, n, x) => `معك في الشبكة ${arCount(t, LAU)}، ${+t === 2 ? 'منهما' : 'منهم'} ${NB_AR(n)} ${DE_AR[x]}`],
]);
