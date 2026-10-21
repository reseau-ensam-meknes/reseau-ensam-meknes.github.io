// « Cette semaine dans le réseau » : une ligne de preuve douce que l'entraide marche,
// avec les visages de ceux qui ont aidé. Pas de classement, pas de comparaison.
import { html } from './vendor/preact-htm.js';
import { Avatar, injectCSS } from './ui.js';
import { addAR } from './i18n.js';
import { poulsReseau } from './logic.js';

export function PoulsReseau({ ctx, onOpen }) {
  const { data, store } = ctx;
  const p = poulsReseau(data);
  if (!p.aidants.length || !p.nbAides) return null;
  const visages = p.aidants.slice(0, 4).map(id => store.byId('profiles', id)).filter(Boolean);
  const quand = p.jours === 7 ? 'Cette semaine' : 'Ce mois-ci';
  const ligne = `${p.aidants.length > 1 ? `${p.aidants.length} lauréats ont aidé` : '1 lauréat a aidé'} ${p.nbAides > 1 ? `${p.nbAides} étudiants` : '1 étudiant'}`;
  const Tag = onOpen ? 'button' : 'div';
  return html`<${Tag} type=${onOpen ? 'button' : undefined} class=${'pouls' + (onOpen ? ' clickable' : '')} onClick=${onOpen}>
    <span class="pouls-visages" aria-hidden="true">${visages.map(v => html`<${Avatar} p=${v} size=${28}/>`)}</span>
    <span class="pouls-txt"><strong>${quand}</strong> <span>${ligne}</span>${p.recrutes ? html`<span class="pouls-sep"> · </span><span>${p.recrutes > 1 ? `${p.recrutes} recrutements confirmés` : '1 recrutement confirmé'}</span>` : null}</span>
  </${Tag}>`;
}

injectCSS('pouls', `
.pouls { display: flex; align-items: center; gap: .7rem; padding: .55rem .9rem .55rem .6rem; border-radius: var(--r-pill); background: color-mix(in srgb, var(--good-soft) 70%, var(--surface)); border: 1px solid color-mix(in srgb, var(--good) 22%, var(--line)); color: var(--ink-2); font-size: var(--fs-2); text-align: start; width: 100%; }
button.pouls { cursor: pointer; font: inherit; font-size: var(--fs-2); }
.pouls-visages { display: flex; flex: none; }
.pouls-visages .avatar { box-shadow: 0 0 0 2px var(--surface); }
.pouls-visages .avatar + .avatar { margin-inline-start: -9px; }
.pouls-txt strong { color: var(--good); font-weight: 600; }
@media (max-width: 420px) { .pouls { border-radius: var(--r-lg); align-items: flex-start; } }
`);

addAR({ 'Cette semaine': 'هذا الأسبوع', 'Ce mois-ci': 'هذا الشهر', '1 recrutement confirmé': 'توظيف واحد مؤكَّد' }, [
  [/^(\d+) lauréats ont aidé (\d+) étudiants$/, (a, b) => `${a} خريجين ساعدوا ${b} طلاب`],
  [/^(\d+) lauréats ont aidé 1 étudiant$/, a => `${a} خريجين ساعدوا طالبًا واحدًا`],
  [/^1 lauréat a aidé (\d+) étudiants$/, b => `خريج واحد ساعد ${b} طلاب`],
  [/^1 lauréat a aidé 1 étudiant$/, () => 'خريج واحد ساعد طالبًا واحدًا'],
  [/^(\d+) recrutements confirmés$/, n => `${n} توظيفات مؤكَّدة`],
]);
