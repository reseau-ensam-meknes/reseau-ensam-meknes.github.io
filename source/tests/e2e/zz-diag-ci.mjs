// Diagnostic jetable (branche diag-ci-entree, jamais fusionnée) : la page d'entrée dans le navigateur d'une application,
// mesurée sur la machine de la CI, bloc par bloc, avec les polices réellement utilisées (CDP) et le nombre de lignes.
import { chromium } from 'playwright';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fauxSite } from './faux-supabase.mjs';

const SITE = path.resolve(process.env.SITE_DIR);
const sh = c => { try { return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch (e) { return 'ERR ' + (e.stderr || e.message); } };
console.log('== fc-match sans-serif :', sh('fc-match sans-serif'));
console.log('== fc-match system-ui :', sh('fc-match system-ui'));
console.log('== fc-match Segoe UI :', sh("fc-match 'Segoe UI'"));
console.log('== fc-match rendu :', sh("fc-match -v sans-serif | grep -E 'hinting|hintstyle|antialias|rgba|lcdfilter|autohint|embeddedbitmap'").replace(/\s+/g, ' '));
console.log('== familles :', sh("fc-list : family | sort -u | tr '\\n' ';'"));
console.log('== cpus', os.cpus().length, 'LANG', process.env.LANG, 'TZ', process.env.TZ);

const INSTAGRAM = 'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.42.81 Android (34/14; 450dpi; 1080x2340; samsung; SM-A546B; a54x; s5e8835; fr_FR; 645432123)';
const INSTAGRAM_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.32.81 (iPhone15,3; iOS 18_5; fr_FR; fr; scale=3.00; 1290x2796; 645432123)';
const FACEBOOK_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/490.0.0.38.107;FBBV/700000000;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/18.6;FBSS/3;FBCR/;FBID/phone;FBLC/fr_FR;FBOP/80]';
const FACEBOOK_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.122 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/533.0.0.48.74;IABMV/1;]';
const noms = new Map([[INSTAGRAM, 'Instagram'], [FACEBOOK_ANDROID, 'Facebook'], [FACEBOOK_IOS, 'Facebook iPhone'], [INSTAGRAM_IOS, 'Instagram iPhone']]);
const CAS = [
  [FACEBOOK_IOS, 375, 553, 'fr'], [INSTAGRAM_IOS, 375, 553, 'ar'], [INSTAGRAM_IOS, 390, 664, 'fr'], [FACEBOOK_IOS, 375, 553, 'fr', true],
  [INSTAGRAM, 360, 640, 'fr'], [INSTAGRAM, 360, 640, 'ar'], [FACEBOOK_ANDROID, 390, 664, 'fr'], [INSTAGRAM, 390, 664, 'ar'],
];
const BLOCS = ['.entree-top', '.entree-promesse', '.entree-promesse h1', '#au-appli-mot', '.entree-form', '#au-je-etudiant', '#au-je-laureat', '#au-email', '.entree-form label.check:has(#au-mail)', '.entree-form label.check:has(#au-ok)', '.entree-form button.btn.primary.wide', '.au-sans-mdp'];

const site = await fauxSite(SITE, {});
const b = await chromium.launch();
console.log('== chromium', b.version());

async function mesurer(page) {
  return page.evaluate(BLOCS => {
    const lignesDe = el => {
      const tops = new Map();
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!n.textContent.trim()) continue;
        const r = document.createRange(); r.selectNodeContents(n);
        for (const x of r.getClientRects()) { if (x.width < 1) continue; const k = Math.round(x.top); tops.set(k, Math.max(tops.get(k) || 0, x.right) - 0); }
      }
      return [...tops.keys()].length;
    };
    return BLOCS.map(sel => {
      const el = document.querySelector(sel);
      if (!el) return { sel, absent: true };
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      // La place restante sur chaque ligne : largeur du contenu moins la ligne la plus longue
      const g = document.createRange(); g.selectNodeContents(el);
      const rs = [...g.getClientRects()].filter(x => x.width >= 1);
      const parLigne = new Map(); for (const x of rs) { const k = Math.round(x.top); const v = parLigne.get(k) || [Infinity, -Infinity]; parLigne.set(k, [Math.min(v[0], x.left), Math.max(v[1], x.right)]); }
      const largeurs = [...parLigne.values()].map(([a, z]) => Math.round((z - a) * 10) / 10);
      const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      return { sel, haut: Math.round(r.top * 10) / 10, bas: Math.round(r.bottom * 10) / 10, h: Math.round(r.height * 10) / 10, w: Math.round((r.width - pad) * 10) / 10, lignes: lignesDe(el), largeurs, font: `${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`.slice(0, 90), minH: cs.minHeight, texte: el.innerText.replace(/\s+/g, ' ').slice(0, 110) };
    });
  }, BLOCS);
}

async function polices(page, cdp) {
  // Les polices réellement utilisées pour le texte de chaque bloc (et de ses enfants)
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const out = {};
  for (const sel of BLOCS) {
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: sel + ', ' + sel + ' *' }).catch(() => ({ nodeIds: [] }));
    const tot = {};
    for (const id of nodeIds) {
      const r = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: id }).catch(() => null);
      for (const f of r?.fonts || []) tot[`${f.familyName}${f.isCustomFont ? '*' : ''}`] = (tot[`${f.familyName}${f.isCustomFont ? '*' : ''}`] || 0) + f.glyphCount;
    }
    out[sel] = tot;
  }
  return out;
}

for (const [ua, largeur, hauteur, langue, membre] of CAS) {
  const ios = ua === FACEBOOK_IOS || ua === INSTAGRAM_IOS;
  const cas = `${noms.get(ua)} ${largeur} × ${hauteur} ${langue}${membre ? ' connexion' : ''}`;
  const ctx = await b.newContext({ viewport: { width: largeur, height: hauteur }, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: 'light', userAgent: ua });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  if (membre) await ctx.addInitScript(() => localStorage.setItem('ensam-deja-membre', '1'));
  if (ios) await ctx.addInitScript(p => { Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { configurable: true, get: () => 5 }); Object.defineProperty(Navigator.prototype, 'platform', { configurable: true, get: () => p }); }, 'iPhone');
  await ctx.addInitScript(l => { if (sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init', '1'); if (l) localStorage.setItem('ensam-lang', l); }, langue);
  const page = await ctx.newPage();
  const erreurs = []; page.on('pageerror', e => erreurs.push(e.message));
  await page.goto(site.adresse);
  await page.waitForSelector('#entree .entree-form');
  await page.waitForSelector('#au-appli, #au-appli-mot');
  const etatAvant = await page.evaluate(() => [...document.fonts].map(f => `${f.family}:${f.weight}:${f.status}`).join(' '));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.getAnimations().forEach(a => { try { a.finish(); } catch { /* sans fin */ } }));
  const tout = await mesurer(page);
  const etatApres = await page.evaluate(() => [...document.fonts].map(f => `${f.family}:${f.weight}:${f.status}`).join(' '));
  await page.waitForTimeout(2000);
  await page.evaluate(() => document.fonts.ready);
  const plusTard = await mesurer(page);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const pol = await polices(page, cdp);
  console.log(`\n######## ${cas}`);
  console.log('polices avant ready :', etatAvant);
  console.log('polices après ready :', etatApres);
  for (const m of tout) console.log(JSON.stringify(m));
  const change = plusTard.filter((m, i) => JSON.stringify(m) !== JSON.stringify(tout[i]));
  console.log('2 s plus tard, changé :', change.length ? '' : 'rien');
  for (const m of change) console.log('  après 2 s', JSON.stringify(m));
  console.log('polices utilisées :', JSON.stringify(pol));
  console.log('erreurs :', JSON.stringify(erreurs), 'scrollHeight', await page.evaluate(() => document.documentElement.scrollHeight), 'clientWidth', await page.evaluate(() => document.documentElement.clientWidth), 'rem', await page.evaluate(() => getComputedStyle(document.documentElement).fontSize));
  await ctx.close();
}
await b.close(); await site.fermer();
