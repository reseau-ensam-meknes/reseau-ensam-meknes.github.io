// Le site construit (dist/, ou SITE_DIR) ouvert dans Chromium, en démo : aucun appel à la vraie base.
// Chaque profil de démo parcourt tous les écrans, puis les parcours importants sont rejoués.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';

const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

const SITE = path.resolve(process.env.SITE_DIR || new URL('../../dist', import.meta.url).pathname);
const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const ECRANS = ['accueil', 'offres', 'mentorat', 'mentorat/cv', 'messages', 'parcours', 'espace', 'reseau/groupes', 'reseau/agenda', 'reseau/entraide',
  'reseau/entreprises', 'reseau/etranger', 'reseau/annuaire', 'reseau/classement', 'reseau/talents', 'suivi', 'profil', 'enquete',
  'confidentialite', 'admin', 'admin/moderation', 'admin/membres', 'admin/liste', 'admin/inviter', 'admin/agenda', 'admin/reglages'];

let serveur, adresse, navigateur;
before(async () => {
  assert.ok(fs.existsSync(path.join(SITE, 'index.html')), `site introuvable : ${SITE} (lance d’abord sh build.sh)`);
  serveur = http.createServer((q, r) => {
    let u = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (u.endsWith('/')) u += 'index.html';
    // config.js vide : la plateforme s'ouvre en démonstration
    if (u === '/config.js') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end("window.ENSAM_CONFIG = { supabaseUrl: '', supabaseAnonKey: '' };"); }
    const f = path.join(SITE, path.normalize(u));
    if (!f.startsWith(SITE)) { r.writeHead(403); return r.end(); }
    fs.readFile(f, (e, b) => {
      if (e) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b);
    });
  });
  await new Promise(ok => serveur.listen(0, '127.0.0.1', ok));
  adresse = `http://127.0.0.1:${serveur.address().port}/`;
  navigateur = await chromium.launch();
});
after(async () => { await navigateur?.close(); serveur?.close(); });

// Une page neuve, dans la langue voulue, avec un relevé des erreurs
async function ouvrir({ largeur = 1280, langue = 'fr', sw = false, theme = 'light' } = {}) {
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: largeur > 800 ? 900 : 844 }, serviceWorkers: sw ? 'allow' : 'block', colorScheme: theme, reducedMotion: 'reduce' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const page = await ctx.newPage(); const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(adresse); await page.waitForSelector('.hello');
  await page.evaluate(l => { localStorage.clear(); localStorage.setItem('ensam-lang', l); }, langue);
  await page.reload(); await page.waitForSelector('.hello');
  const profils = await page.$$eval('#persona option', os => os.map(o => [o.value, o.textContent]));
  const comme = async nom => {
    const p = nom === 'Admin' ? profils[profils.length - 1] : profils.find(x => x[1].includes(nom));
    assert.ok(p, `profil de démo introuvable : ${nom}`);
    await page.selectOption('#persona', p[0]); await page.waitForTimeout(300);
  };
  const aller = async h => { await page.evaluate(h => { location.hash = h; }, h); await page.waitForTimeout(250); };
  const debordement = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const fiche = async nom => { await aller('reseau/annuaire'); await page.fill('#d-q', nom); await page.waitForTimeout(300); await page.locator(`.person:has-text("${nom}")`).first().click(); await page.waitForTimeout(300); };
  const fermer = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(200); };
  return { ctx, page, erreurs, profils, comme, aller, debordement, fiche, fermer };
}

for (const [largeur, langue] of [[1280, 'fr'], [390, 'ar']]) {
  test(`tous les écrans, tous les profils : sans erreur ni débordement (${largeur} px, ${langue})`, async () => {
    const s = await ouvrir({ largeur, langue });
    if (langue === 'ar') assert.equal(await s.page.getAttribute('html', 'dir'), 'rtl');
    const problemes = [];
    for (const [id, nom] of s.profils) {
      await s.page.selectOption('#persona', id); await s.page.waitForTimeout(250);
      for (const e of ECRANS) {
        await s.aller(e);
        const d = await s.debordement(); if (d > 0) problemes.push(`${nom} · ${e} : ${d} px de trop en largeur`);
      }
    }
    assert.deepEqual([...s.erreurs, ...problemes], []);
    await s.ctx.close();
  });
}

test('coordonnées : visibles seulement après accord', async () => {
  const s = await ouvrir();
  await s.comme('Amine'); await s.fiche('Youssef El Amrani');
  assert.ok(!(await s.page.locator('.modal').innerText()).includes('06 12 34 56 78'));
  await s.page.click('#cf-ask'); await s.page.fill('#cf-ask-msg', 'Bonjour, je suis en 3A et j’aimerais un conseil.');
  await s.page.click('#cf-ask-send'); await s.page.waitForTimeout(300); await s.fermer();
  await s.comme('Youssef'); await s.aller('accueil');
  await s.page.locator('.cf-home li:has-text("Amine") .btn.primary').click(); await s.page.waitForTimeout(300);
  await s.comme('Amine'); await s.fiche('Youssef El Amrani');
  assert.match(await s.page.locator('#cf-contact').innerText(), /06 12 34 56 78/);
  await s.fermer();
  await s.comme('Nadia'); await s.fiche('Youssef El Amrani');
  assert.ok(!(await s.page.locator('.modal').innerText()).includes('06 12 34 56 78'));
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('messagerie : écrire, être lu, bloquer ; pas de conversation sans lien', async () => {
  const s = await ouvrir({ largeur: 390 });
  const id = nom => s.profils.find(x => x[1].includes(nom))[0];
  const salma = id('Salma'), youssef = id('Youssef');
  await s.comme('Salma'); await s.aller('messages/' + youssef); await s.page.waitForTimeout(300);
  await s.page.fill('#chat-txt', 'Merci pour vos conseils, je prépare mes questions !');
  await s.page.click('.composer .send-btn'); await s.page.waitForTimeout(400);
  const dernier = () => s.page.locator('.msg.mine').last();
  assert.match(await dernier().innerText(), /Merci pour vos conseils/);
  assert.equal(await dernier().locator('.msg-etat').getAttribute('title'), 'Envoyé');
  await s.page.addScriptTag({ content: AXE });
  await s.page.evaluate(() => document.getAnimations().forEach(a => { try { a.finish(); } catch { /* animation sans fin */ } }));
  const v = await s.page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, resultTypes: ['violations'] })).violations.map(x => `${x.id} : ${x.nodes[0].target.join(' ')}`));
  assert.deepEqual(v, [], 'conversation ouverte : axe');
  // Youssef voit le message non lu, l'ouvre ; Salma voit « Vu »
  await s.aller('accueil'); await s.comme('Youssef'); await s.aller('messages');
  assert.equal(await s.page.locator('.conv-item.unread', { hasText: 'Salma' }).count(), 1);
  await s.aller('messages/' + salma); await s.page.waitForTimeout(300);
  await s.aller('accueil'); await s.comme('Salma'); await s.aller('messages/' + youssef); await s.page.waitForTimeout(300);
  assert.equal(await dernier().locator('.msg-etat').getAttribute('title'), 'Vu');
  // Salma bloque : plus personne ne peut écrire
  await s.page.click('.conv-menu > .icon-btn'); await s.page.click('.conv-menu .danger-t');
  await s.page.locator('.modal .btn.danger').click(); await s.page.waitForTimeout(300);
  assert.equal(await s.page.locator('#chat-txt').count(), 0);
  await s.aller('accueil'); await s.comme('Youssef'); await s.aller('messages/' + salma); await s.page.waitForTimeout(200);
  assert.equal(await s.page.locator('#chat-txt').count(), 0);
  // Une nouvelle lauréate sans lien avec Salma ne peut pas lui écrire
  await s.aller('accueil'); await s.comme('Nadia'); await s.aller('messages/' + salma); await s.page.waitForTimeout(200);
  assert.equal(await s.page.locator('#chat-txt').count(), 0);
  assert.equal(await s.page.locator('.composer.ferme').count(), 1);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('signaler un profil, puis l’administration le traite', async () => {
  const s = await ouvrir();
  await s.comme('Salma'); await s.fiche('Nadia Ferhat');
  await s.page.click('.profile-foot .cf-signal'); await s.page.click('#cf-motif-faux');
  await s.page.fill('#cf-details', 'Je ne crois pas que ce soit une lauréate.'); await s.page.click('#cf-send'); await s.page.waitForTimeout(300);
  assert.equal(await s.page.locator('.profile-foot .cf-signale').count(), 1);
  await s.fermer();
  await s.comme('Admin'); await s.aller('admin/moderation');
  const avant = await s.page.locator('.mod-card').count();
  assert.ok(await s.page.locator('.mod-card:has-text("Nadia")').count() > 0);
  await s.page.locator('.mod-card .btn.danger').first().click(); await s.page.waitForTimeout(200);
  await s.page.locator('.modal .btn.danger').click(); await s.page.waitForTimeout(300);
  assert.equal(await s.page.locator('.mod-card').count(), avant - 1);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('agenda de l’école : je participe, puis je me désinscris', async () => {
  const s = await ouvrir();
  await s.comme('Salma'); await s.aller('reseau/agenda');
  const carte = s.page.locator('.ev-card').first();
  await carte.locator('.btn.primary').click(); await s.page.waitForTimeout(300);
  assert.match(await carte.innerText(), /Je ne viens plus/);
  await carte.locator('button:has-text("Je ne viens plus")').click(); await s.page.waitForTimeout(300);
  assert.match(await carte.innerText(), /Je participe/);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('mode sombre : le choix est gardé', async () => {
  const s = await ouvrir();
  const avant = await s.page.getAttribute('html', 'data-theme');
  await s.page.click('.top .theme-btn'); await s.page.waitForTimeout(200);
  const apres = await s.page.getAttribute('html', 'data-theme');
  assert.notEqual(apres, avant);
  await s.page.reload(); await s.page.waitForSelector('.hello');
  assert.equal(await s.page.getAttribute('html', 'data-theme'), apres);
  await s.ctx.close();
});

test('hors ligne : le site s’ouvre depuis la copie gardée sur le téléphone', async () => {
  const s = await ouvrir({ sw: true });
  await s.page.waitForFunction(() => navigator.serviceWorker.getRegistration().then(r => !!r?.active), null, { timeout: 30000 });
  await s.page.reload(); await s.page.waitForSelector('.hello');
  await s.ctx.setOffline(true);
  await s.page.reload(); await s.page.waitForSelector('.hello', { timeout: 15000 });
  assert.ok(await s.page.evaluate(() => !!navigator.serviceWorker.controller));
  await s.ctx.setOffline(false);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('lien d’invitation d’une promo : la promo est gardée, l’adresse nettoyée, le message prêt pour WhatsApp', async () => {
  const s = await ouvrir();
  await s.page.goto(adresse + '?promo=2027'); await s.page.waitForSelector('.hello');
  assert.equal(await s.page.evaluate(() => localStorage.getItem('ensam-invite-promo')), '2027');
  assert.equal(await s.page.evaluate(() => location.search), '');
  await s.comme('Admin'); await s.aller('admin/inviter');
  assert.ok(await s.page.locator('.inv-row').count() >= 9);
  const wa = await s.page.locator('.inv-row', { hasText: 'Promo 2027' }).locator('a[href^="https://wa.me/"]').getAttribute('href');
  const msg = decodeURIComponent(wa.split('text=')[1]);
  assert.match(msg, /promo 2027/); assert.ok(msg.includes(adresse + '?promo=2027'));
  await s.page.click('.inv-opts .seg button:nth-child(3)');
  assert.match(await s.page.locator('.inv-msg').innerText(), /مرحبا دفعة/);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('profil : remplir depuis le texte LinkedIn collé', async () => {
  const s = await ouvrir();
  await s.comme('Amine'); await s.aller('profil');
  await s.page.click('.li-box summary');
  await s.page.fill('#pf-litxt', 'Amine Kettani\nÉlève ingénieur à l’ENSAM Meknès\nCompétences : SolidWorks · Ansys · Gestion de projet');
  await s.page.click('#pf-lifill'); await s.page.waitForTimeout(200);
  assert.match(await s.page.inputValue('#pf-comp'), /SolidWorks, Ansys, Gestion de projet/);
  assert.match(await s.page.locator('.li-faits').innerText(), /Compétences/);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('clavier : lien « Aller au contenu », fenêtre qui garde le focus puis le rend', async () => {
  const s = await ouvrir();
  await s.page.keyboard.press('Tab');
  assert.equal(await s.page.evaluate(() => document.activeElement.className), 'skip');
  await s.page.keyboard.press('Enter');
  assert.equal(await s.page.evaluate(() => document.activeElement.id), 'contenu');
  await s.comme('Amine'); await s.fiche('Youssef El Amrani');
  for (let i = 0; i < 25; i++) await s.page.keyboard.press('Tab');
  assert.ok(await s.page.evaluate(() => !!document.activeElement.closest('.modal')), 'le focus est sorti de la fenêtre');
  await s.fermer();
  assert.ok(await s.page.evaluate(() => document.activeElement.matches('.person')), 'le focus n’est pas revenu sur la fiche ouverte');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

// Audit automatique (axe-core) : contrastes, noms des boutons et champs, repères pour les lecteurs d'écran
for (const [largeur, langue, theme] of [[1280, 'fr', 'light'], [390, 'ar', 'dark']]) {
  test(`accessibilité : aucun problème relevé par axe (${largeur} px, ${langue}, ${theme})`, async () => {
    const s = await ouvrir({ largeur, langue, theme });
    const problemes = [];
    for (const [id, nom] of s.profils) {
      await s.page.selectOption('#persona', id); await s.page.waitForTimeout(250);
      for (const e of ECRANS) {
        await s.aller(e);
        if (!(await s.page.evaluate(() => !!window.axe))) await s.page.addScriptTag({ content: AXE });
        // Les fondus d'arrivée (même courts) faussent la mesure des contrastes : on les termine avant l'audit
        await s.page.evaluate(() => document.getAnimations().forEach(a => { try { a.finish(); } catch { /* animation sans fin */ } }));
        const v = await s.page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, resultTypes: ['violations'] }))
          .violations.map(x => `${x.id} : ${x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' ; ')}`));
        for (const x of v) problemes.push(`${nom} · ${e} · ${x}`);
      }
    }
    assert.deepEqual(problemes, []);
    assert.deepEqual(s.erreurs, []);
    await s.ctx.close();
  });
}
