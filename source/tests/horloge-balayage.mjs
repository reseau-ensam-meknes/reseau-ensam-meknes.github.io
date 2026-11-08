// Balayage des dates (.github/workflows/balayage-dates.yml, lancé à la main) : tous les essais rejoués à une date à venir.
// FAUX_MAINTENANT=2027-09-01T10:00:00Z node --import ./horloge-balayage.mjs --test …   (FAUX_MAINTENANT=maintenant : le témoin)
// Seul Date avance, du même écart partout : dans Node (donc PGlite et le faux Supabase, et les contextes vm), dans les
// processus node que lancent les essais (NODE_OPTIONS, même écart), et dans chaque page des navigateurs (un script posé
// dans chaque contexte). Les minuteurs, performance, requestAnimationFrame et requestIdleCallback restent les vrais : les
// fausser faisait échouer des essais même au témoin. Un essai qui pose sa propre heure (clock.install) la pose par-dessus,
// comme d'habitude. verifier-horloge.mjs contrôle que Node, un processus enfant et les pages suivent bien.
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { dirname, join } from 'node:path';

const MARQUE = Symbol.for('horloge-balayage');

// Le décalage de e millisecondes, posé tel quel dans Node et dans chaque page : un Date qui part de maintenant + e
export const decaler = e => `(() => {
  const marque = Symbol.for('horloge-balayage');
  if (globalThis[marque] !== undefined) return;
  const D = Date, p = v => ({ value: v, writable: true, configurable: true, enumerable: false });
  // Comme le vrai Date : appelé sans new, une chaîne ; avec new, une date, sous-classes comprises
  function F(...a) {
    if (!new.target) return new D(D.now() + ${e}).toString();
    return Reflect.construct(D, a.length ? a : [D.now() + ${e}], new.target);
  }
  // Des propriétés non énumérables, comme le vrai Date : l'horloge de Playwright recopie les énumérables sur la sienne
  Object.defineProperties(F, { prototype: { value: D.prototype }, now: p(function now() { return D.now() + ${e}; }),
    parse: p(D.parse), UTC: p(D.UTC), name: { value: 'Date', configurable: true }, length: { value: 7, configurable: true } });
  Object.defineProperty(D.prototype, 'constructor', p(F));
  // Intl sans date lit l'horloge du moteur, pas Date.now : une date omise devient Date.now()
  const I = Intl.DateTimeFormat.prototype, g = Object.getOwnPropertyDescriptor(I, 'format'), parts = I.formatToParts, liees = new WeakMap();
  Object.defineProperty(I, 'format', { configurable: true, enumerable: false, get() {
    let f = liees.get(this);
    if (!f) { const vraie = g.get.call(this); f = d => vraie(d === undefined ? Date.now() : d); liees.set(this, f); }
    return f;
  } });
  Object.defineProperty(I, 'formatToParts', p(function formatToParts(d) { return parts.call(this, d === undefined ? Date.now() : d); }));
  Object.defineProperty(globalThis, marque, { value: ${e} });
  globalThis.Date = F;
})();`;

// Un instant ISO (2027-09-01, 2027-09-01T10:00:00Z, 2027-09-01T10:00:00+01:00…). Refuse un jour qui n'existe pas
// (2027-02-29, 31 septembre), que Date reporterait sans rien dire au lendemain, et tout ce qui n'est pas AAAA-MM-JJ.
export function lireInstant(s) {
  const [, a, m, j] = /^(\d{4})-(\d\d)-(\d\d)(?:T|$)/.exec(s) || [];
  const d = new Date(s);
  if (!a || Number.isNaN(d.getTime()) || new Date(Date.UTC(+a, m - 1, +j)).getUTCDate() !== +j) throw new Error(`date illisible : ${s}`);
  return d;
}

const cible = process.env.FAUX_MAINTENANT;
if (cible && globalThis[MARQUE] === undefined) {
  // Un seul écart pour tous les processus d'un lancement : le premier le calcule, ceux qu'il lance le reprennent
  const [pour, herite] = (process.env.FAUX_DECALAGE || '').split('|');
  let ecart = pour === cible && herite !== '' ? Number(herite) : NaN;
  if (!Number.isFinite(ecart)) ecart = cible === 'maintenant' ? 0 : lireInstant(cible).getTime() - Date.now();
  process.env.FAUX_DECALAGE = `${cible}|${ecart}`;
  const moi = `--import=${import.meta.url}`;
  if (!(process.env.NODE_OPTIONS || '').includes(moi)) process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} ${moi}`.trim();
  (0, eval)(decaler(ecart));

  const require = createRequire(import.meta.url);
  const vm = require('node:vm');
  const avecHorloge = s => (s && typeof s === 'object' && !('Date' in s) ? Object.assign(s, { Date: globalThis.Date }) : s);
  const { runInNewContext, createContext } = vm, scriptNouveau = vm.Script.prototype.runInNewContext;
  vm.runInNewContext = (code, s, ...r) => runInNewContext(code, avecHorloge(s ?? {}), ...r);
  vm.createContext = (s, ...r) => createContext(avecHorloge(s ?? {}), ...r);
  vm.Script.prototype.runInNewContext = function (s, ...r) { return scriptNouveau.call(this, avecHorloge(s ?? {}), ...r); };
  syncBuiltinESMExports();

  let pc = null;
  try { pc = dirname(require.resolve('playwright-core/package.json')); } catch { /* pas de Playwright ici */ }
  if (pc) {
    const script = decaler(ecart);
    const { Browser } = require(join(pc, 'lib/client/browser.js'));
    const nouveau = Browser.prototype.newContext;
    Browser.prototype.newContext = async function (...a) { const ctx = await nouveau.apply(this, a); await ctx.addInitScript(script); return ctx; };
  }
}
