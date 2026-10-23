// Génère src/img/apercu.jpg (1200 × 630, moins de 300 Ko pour WhatsApp) : l'aperçu montré par WhatsApp, LinkedIn ou Facebook quand on colle
// un lien du site (balises og:image de src/page.html), et src/img/apercu-promo.jpg, celui des liens de promo (outils/pages-promo.mjs) :
// l'entrée dessinée, sans texte (le titre de l'aperçu nomme la promo). Lancer depuis le dossier source : node outils/generer-apercu.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { sceneMarkup } from '../src/scene.js';

const logo = fs.readFileSync(new URL('../src/img/logo-carre.svg', import.meta.url), 'utf8');
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

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(page, { waitUntil: 'networkidle' }).catch(() => {});
await p.evaluate(() => document.fonts.ready);
await p.locator('.carte').screenshot({ path: new URL('../src/img/apercu.jpg', import.meta.url).pathname, type: 'jpeg', quality: 88 });

// Liens de promo : l'entrée dessinée du site (mêmes styles que page.html), la tuile du logo en haut à gauche, hors du carré
// central que WhatsApp garde dans son petit aperçu. Le dessin est figé : deux étudiants remontent l'allée.
const css = fs.readFileSync(new URL('../src/page.html', import.meta.url), 'utf8').match(/<style>([\s\S]*?)<\/style>/)[1];
const promo = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,750&family=IBM+Plex+Sans:wght@500;600&display=block">
<style>${css}
  html, body { margin: 0; background: #fff; }
  .carte { width: 1200px; height: 630px; position: relative; overflow: hidden; }
  .carte .scene { position: absolute; inset: 0; }
  .tuile { position: absolute; inset-block-start: 30px; inset-inline-start: 32px; filter: drop-shadow(0 10px 18px rgb(19 33 58 / .3)); }
  .tuile svg { width: 84px; height: 84px; display: block; }
  .carte::after { content: ""; position: absolute; inset: auto 0 0 0; height: 12px; background: linear-gradient(90deg, #F39200 0 62%, #4FA9E6 62% 100%); }
</style></head><body><div class="carte sky"><div class="scene" aria-hidden="true">${sceneMarkup('xMidYMax', 'slice')}</div><div class="tuile">${logo}</div></div></body></html>`;
await p.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
await p.setContent(promo, { waitUntil: 'networkidle' }).catch(() => {});
await p.evaluate(() => document.fonts.ready);
await p.evaluate(() => {
  for (const a of document.getAnimations()) { a.pause(); const t = a.effect.getTiming(); a.currentTime = t.iterations === Infinity ? 0 : t.delay + t.duration; }
  document.getAnimations().filter(a => a.animationName === 'sc-walk').forEach((a, i) => { a.currentTime = i ? 13300 : 4300; });
});
const sortie = new URL('../src/img/apercu-promo.jpg', import.meta.url).pathname;
await p.locator('.carte').screenshot({ path: sortie, type: 'jpeg', quality: 86 });
await b.close();
console.log('src/img/apercu.jpg', 'src/img/apercu-promo.jpg', fs.statSync(sortie).size, 'octets');
