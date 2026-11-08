// Génère les images d'aperçu (1200 × 630, moins de 300 Ko pour WhatsApp) que montrent WhatsApp, LinkedIn ou Facebook quand on
// colle un lien du site :
//  - src/img/apercu.jpg : celui du site (balises og:image de src/page.html) ;
//  - src/img/apercu-promo.jpg : celui des liens de promo (outils/pages-promo.mjs), l'entrée dessinée, sans texte (le titre de
//    l'aperçu nomme la promo) ;
//  - src/img/apercu-promo-neutre.jpg : celui des pages neutres des liens d'une autre école que l'ENSAM Meknès (promo/AAAA/e/,
//    outils/pages-promo.mjs) : la même entrée, dont la porte dit « ENSAM », sans ville.
// Lancer depuis le dossier source : node outils/generer-apercu.mjs. Un nom en argument ne refait que ces images
// (ex. node outils/generer-apercu.mjs apercu-promo-neutre) : les autres restent telles quelles.
// Les titres en Bricolage Grotesque (Google Fonts) ; s'il est injoignable, le script le dit (la porte de l'entrée dessinée prend
// alors la police du site, Titres ENSAM, src/polices).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { sceneMarkup } from '../src/scene.js';

const voulues = process.argv.slice(2), faire = n => !voulues.length || voulues.includes(n);
const sortie = n => new URL(`../src/img/${n}.jpg`, import.meta.url).pathname;
const logo = fs.readFileSync(new URL('../src/img/logo-carre.svg', import.meta.url), 'utf8');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
// La police des titres vient-elle de Google Fonts (sinon : celle du site, ou celle du système) ?
const deGoogle = () => p.evaluate(() => [...document.fonts].some(f => f.family === 'Bricolage Grotesque' && f.status === 'loaded'));

if (faire('apercu')) {
  const page = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,750&family=IBM+Plex+Sans:wght@500&family=IBM+Plex+Sans+Arabic:wght@600&display=block">
<style>
  html, body { margin: 0; }
  .carte { width: 1200px; height: 630px; box-sizing: border-box; padding: 84px 92px; display: flex; align-items: center; gap: 64px; position: relative; overflow: hidden;
    background: radial-gradient(900px 520px at 100% 0%, #27497A 0%, transparent 70%), linear-gradient(135deg, #1D3150 0%, #0F1B2E 100%); color: #fff; font-family: "IBM Plex Sans", system-ui, sans-serif; }
  .carte::after { content: ""; position: absolute; inset: auto 0 0 0; height: 14px; background: linear-gradient(90deg, #F39200 0 62%, #4FA9E6 62% 100%); }
  .logo svg { width: 300px; height: 300px; display: block; filter: drop-shadow(0 24px 40px rgb(0 0 0 / .35)); }
  h1 { font-family: "Bricolage Grotesque", system-ui, sans-serif; font-weight: 750; font-size: 84px; line-height: .98; letter-spacing: -1.5px; margin: 0 0 26px; }
  h1 span { color: #F7A11A; }
  p { margin: 0; font-size: 33px; line-height: 1.32; color: #DCE6F3; max-width: 640px; }
  .ar { margin-top: 22px; font-family: "IBM Plex Sans Arabic", system-ui, sans-serif; font-weight: 600; font-size: 31px; color: #9CC9EE; direction: rtl; text-align: left; }
</style></head><body><div class="carte"><div class="logo">${logo}</div>
<div><h1>Réseau ENSAM<br><span>Meknès</span></h1><p>Lauréats et étudiants : stages, PFE, emplois, conseils et entraide.</p>
<p class="ar">شبكة خريجي وطلبة ENSAM مكناس</p></div></div></body></html>`;
  await p.setContent(page, { waitUntil: 'networkidle' }).catch(() => {});
  await p.evaluate(() => document.fonts.ready);
  await p.locator('.carte').screenshot({ path: sortie('apercu'), type: 'jpeg', quality: 88 });
  console.log('src/img/apercu.jpg', fs.statSync(sortie('apercu')).size, 'octets', await deGoogle() ? '' : '(Google Fonts injoignable : police du système)');
}

// Liens de promo : l'entrée dessinée du site (mêmes styles que page.html : tous ses blocs <style>, ses polices lues ici), la
// tuile du logo en haut à gauche, hors du carré central que WhatsApp garde dans son petit aperçu. Le dessin est figé : deux
// étudiants remontent l'allée. bande : ce que dit la porte (sans : « ENSAM · MEKNÈS », le dessin tel quel).
const css = [...fs.readFileSync(new URL('../src/page.html', import.meta.url), 'utf8').matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n')
  .replace(/url\(polices\/([\w-]+\.woff2)\)/g, (_, f) => `url(data:font/woff2;base64,${fs.readFileSync(new URL(`../src/polices/${f}`, import.meta.url)).toString('base64')})`);
async function entree(nom, bande) {
  const promo = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,750&family=IBM+Plex+Sans:wght@500;600&display=block">
<style>${css}
  html, body { margin: 0; background: #fff; }
  .carte { width: 1200px; height: 630px; position: relative; overflow: hidden; --f-display: "Bricolage Grotesque", "Titres ENSAM", "Segoe UI", system-ui, sans-serif; }
  .carte .scene { position: absolute; inset: 0; }
  .tuile { position: absolute; inset-block-start: 30px; inset-inline-start: 32px; filter: drop-shadow(0 10px 18px rgb(19 33 58 / .3)); }
  .tuile svg { width: 84px; height: 84px; display: block; }
  .carte::after { content: ""; position: absolute; inset: auto 0 0 0; height: 12px; background: linear-gradient(90deg, #F39200 0 62%, #4FA9E6 62% 100%); }
</style></head><body><div class="carte sky"><div class="scene" aria-hidden="true">${sceneMarkup('xMidYMax', 'slice')}</div><div class="tuile">${logo}</div></div></body></html>`;
  await p.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await p.setContent(promo, { waitUntil: 'networkidle' }).catch(() => {});
  if (bande) await p.evaluate(t => { document.querySelector('.scene .g-txt').textContent = t; }, bande);
  await p.evaluate(() => document.fonts.ready);
  // Le dessin figé comme dans apercu-promo.jpg (fait quand la scène bougeait en boucle) : ce qui se répète à son début, ce qui
  // ne passe qu'une fois à sa fin (les nuages à leur place) ; les deux étudiants côte à côte au quart de l'allée (4,3 s d'une
  // marche de 18 s), les oiseaux au quart de leur vol (8 s sur 34). En fraction de chaque mouvement, son délai mis à zéro :
  // vrai quelles que soient ses durées et ses délais d'aujourd'hui
  await p.evaluate(() => {
    const instant = { 'sc-walk': 4.3 / 18, 'sc-fly': 8 / 34 };
    for (const a of document.getAnimations()) {
      a.pause(); const t = a.effect.getTiming(), f = instant[a.animationName];
      if (f != null) { a.effect.updateTiming({ delay: 0 }); a.currentTime = f * t.duration; } else a.currentTime = t.iterations > 1 ? 0 : t.delay + t.duration;
    }
  });
  await p.locator('.carte').screenshot({ path: sortie(nom), type: 'jpeg', quality: 86 });
  const porte = await p.evaluate(() => document.querySelector('.scene .g-txt').textContent);
  console.log(`src/img/${nom}.jpg`, fs.statSync(sortie(nom)).size, 'octets, la porte :', porte, await deGoogle() ? '' : '(Google Fonts injoignable : la police du site, Titres ENSAM)');
}
if (faire('apercu-promo')) await entree('apercu-promo');
if (faire('apercu-promo-neutre')) await entree('apercu-promo-neutre', 'ENSAM');
await b.close();
