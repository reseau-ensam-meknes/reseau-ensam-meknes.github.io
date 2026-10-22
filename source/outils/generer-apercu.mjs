// Génère src/img/apercu.jpg (1200 × 630, moins de 300 Ko pour WhatsApp) : l'aperçu montré par WhatsApp, LinkedIn ou Facebook quand on colle
// un lien du site (balises og:image de src/page.html). Lancer depuis le dossier source : node outils/generer-apercu.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

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
await b.close();
console.log('src/img/apercu.jpg');
