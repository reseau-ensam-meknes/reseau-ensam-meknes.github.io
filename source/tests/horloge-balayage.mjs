// Balayage des dates (.github/workflows/balayage-dates.yml, lancé à la main) : tous les essais rejoués à une date à venir.
// FAUX_MAINTENANT=2027-09-01T10:00:00Z node --import ./horloge-balayage.mjs --test …
// Node part de cet instant (Date, donc PGlite et le faux Supabase ; les contextes vm aussi), et chaque page des navigateurs
// aussi : un script posé dans chaque contexte décale Date du même écart, sans rien toucher d'autre (minuteurs, performance,
// requestAnimationFrame et requestIdleCallback restent les vrais). Un essai qui pose sa propre heure (clock.install) la pose
// par-dessus, comme d'habitude. FAUX_MAINTENANT=maintenant : le même montage à l'heure vraie, le témoin.
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { dirname, join } from 'node:path';
const cible = process.env.FAUX_MAINTENANT;
if (cible) {
  const Vrai = Date, decalage = cible === 'maintenant' ? 0 : Vrai.parse(cible) - Vrai.now();
  if (!Number.isFinite(decalage)) throw new Error(`FAUX_MAINTENANT illisible : ${cible}`);
  class Faux extends Vrai {
    constructor(...a) { if (a.length === 0) super(Vrai.now() + decalage); else super(...a); }
    static now() { return Vrai.now() + decalage; }
  }
  globalThis.Date = Faux;
  const require = createRequire(join(process.cwd(), 'x.js'));
  const vm = require('node:vm');
  const avecHorloge = s => (s && typeof s === 'object' && !('Date' in s) ? Object.assign(s, { Date: Faux }) : s);
  const { runInNewContext, createContext } = vm;
  vm.runInNewContext = (code, s, ...r) => runInNewContext(code, avecHorloge(s ?? {}), ...r);
  vm.createContext = (s, ...r) => createContext(avecHorloge(s ?? {}), ...r);
  syncBuiltinESMExports();
  let pc = null;
  try { pc = dirname(require.resolve('playwright-core/package.json')); } catch { /* pas de Playwright ici (calculs, base, emails) */ }
  if (pc) {
    const decaler = `(() => { const D = Date, e = ${decalage};
      function F(...a) { if (!new.target) return new D(D.now() + e).toString(); return a.length ? new D(...a) : new D(D.now() + e); }
      // Comme le vrai Date : des propriétés non énumérables (l'horloge de Playwright recopie les énumérables sur la sienne)
      const p = v => ({ value: v, writable: true, configurable: true, enumerable: false });
      Object.defineProperties(F, { prototype: { value: D.prototype }, now: p(() => D.now() + e), parse: p(D.parse), UTC: p(D.UTC),
        name: { value: 'Date', configurable: true }, length: { value: 7, configurable: true } });
      globalThis.Date = F; })();`;
    const { Browser } = require(join(pc, 'lib/client/browser.js'));
    const nouveau = Browser.prototype.newContext;
    Browser.prototype.newContext = async function (...a) { const ctx = await nouveau.apply(this, a); await ctx.addInitScript(decaler); return ctx; };
  }
}
