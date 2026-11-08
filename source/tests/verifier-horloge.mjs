// FAUX_MAINTENANT=… node --import ./horloge-balayage.mjs verifier-horloge.mjs [--pages] : l'horloge du balayage atteint-elle
// Node, un processus node lancé par un essai et, avec --pages, les pages des navigateurs (browser.newContext puis
// browser.newPage) ? Lancé avant les essais de chaque machine du balayage : si une mise à jour de Playwright contournait le
// montage, les pages resteraient à l'heure vraie sans rien dire, et tout serait vert, le témoin compris.
import { execFileSync } from 'node:child_process';

const cible = process.env.FAUX_MAINTENANT, ecart = globalThis[Symbol.for('horloge-balayage')], pages = process.argv.includes('--pages');
// Sans rien autour (elle part aussi dans un processus enfant et dans les pages) : la date décalée, l'heure vraie
// (performance ne bouge pas), l'année selon Intl sans date et selon Date
function mesurer() {
  return [Date.now(), performance.timeOrigin + performance.now(),
    new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'UTC' }).format(), String(new Date().getUTCFullYear())];
}
const fautes = [];
const juger = (ou, [decale, vrai, anIntl, anDate]) => {
  const d = decale - vrai - ecart;
  if (Math.abs(d) > 2000) fautes.push(`${ou} : Date.now() est à ${Math.round(d / 1000)} s de l'instant voulu`);
  if (anIntl !== anDate) fautes.push(`${ou} : Intl sans date donne ${anIntl}, Date donne ${anDate}`);
};

if (!cible) fautes.push('FAUX_MAINTENANT manque');
else if (typeof ecart !== 'number') fautes.push("horloge-balayage.mjs n'est pas chargé (node --import ./horloge-balayage.mjs …)");
else {
  if (cible !== 'maintenant' && Math.abs(Date.now() - Date.parse(cible)) > 10 * 60e3) fautes.push(`Node est au ${new Date().toISOString()}, loin de ${cible}`);
  juger('Node', mesurer());
  juger('un processus node lancé par un essai',
    JSON.parse(execFileSync(process.execPath, ['-e', `console.log(JSON.stringify((${mesurer})()))`], { encoding: 'utf8' })));
  if (pages) {
    const { chromium } = await import('playwright');
    const navigateur = await chromium.launch();
    try {
      const ctx = await navigateur.newContext();
      const page = await ctx.newPage();
      await page.setContent('<p>horloge</p>');
      juger('une page (browser.newContext)', await page.evaluate(mesurer));
      const seule = await navigateur.newPage();
      await seule.setContent('<p>horloge</p>');
      juger('une page (browser.newPage)', await seule.evaluate(mesurer));
    } finally {
      await navigateur.close();
    }
  }
}
if (fautes.length) {
  console.error(`L'horloge du balayage (${cible}) n'atteint pas tout :\n- ${fautes.join('\n- ')}`);
  process.exit(1);
}
console.log(`Horloge du balayage (${cible}) : ${new Date().toISOString()} pour Node, un processus enfant${pages ? ' et les pages' : ''}`);
