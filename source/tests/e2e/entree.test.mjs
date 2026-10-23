// Le site « en ligne » vu par un visiteur sans compte (faux Supabase local) : page d'entrée, code à 6 chiffres,
// « Dernière étape », lien d'invitation d'une promo et lien d'une offre partagée sur WhatsApp
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { fauxSite, UID } from './faux-supabase.mjs';

const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const SITE = path.resolve(process.env.SITE_DIR || new URL('../../dist', import.meta.url).pathname);
const saison = (d = new Date()) => (d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1);
const S = saison();
const OFFRE = '3f2b8c1e-9a7d-4e21-b6c0-5d4e3f2a1b0c', DISPARUE = '11111111-2222-4333-8444-555555555555', INCONNUE = '99999999-2222-4333-8444-555555555555';
const AUTEUR = '00000000-0000-4000-8000-0000000000b2';
const PROFILS = [{ id: AUTEUR, full_name: 'Hajar Lauréate', role: 'laureat', filiere: 'Génie Industriel', promo: 2016, created_at: '2026-10-01T10:00:00Z', verified: true }];
const OFFRES = [{ id: OFFRE, author_id: AUTEUR, type: 'pfe', titre: 'PFE Lean manufacturing', entreprise: 'OCP', description: 'Amélioration continue.', annees: [5], filieres: [], status: 'ouverte', audience: 'etudiants', created_at: new Date().toISOString() }];

let site, navigateur;
before(async () => {
  assert.ok(fs.existsSync(path.join(SITE, 'index.html')), `site introuvable : ${SITE} (lance d’abord sh build.sh)`);
  site = await fauxSite(SITE, { offres: OFFRES, profils: PROFILS, partagees: { [OFFRE]: { type: 'pfe', audience: 'etudiants', ouverte: true }, [DISPARUE]: null, [INCONNUE]: 404 } });
  navigateur = await chromium.launch();
});
after(async () => { await navigateur?.close(); site?.fermer(); });
beforeEach(() => site.vider());

async function visiteur({ largeur = 360, hauteur = 640, langue = 'fr', hash = '', query = '', stockage = {} } = {}) {
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await ctx.addInitScript(([langue, stockage]) => {
    if (sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init', '1');
    localStorage.setItem('ensam-lang', langue);
    for (const [k, v] of Object.entries(stockage)) localStorage.setItem(k, v);
  }, [langue, stockage]);
  const page = await ctx.newPage(); const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto(site.adresse + query + hash);
  await page.waitForSelector('#entree .entree-form');
  const debordement = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const app = () => page.waitForFunction(() => window.ENSAM_APP, null, { timeout: 15000 });
  return { ctx, page, erreurs, debordement, app };
}
const axe = async (page, sel) => {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async sel => (await axe.run(sel, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] })).violations.map(x => x.id), sel);
};
const basBouton = page => page.locator('.entree-form button.btn.primary').boundingBox().then(b => b.y + b.height);
// Le code : choix du rôle, email, accord, puis 123456
async function sInscrire(page, { role = 'etudiant', email = 'amine@ensam-umi.ac.ma' } = {}) {
  await page.click('#au-je-' + role);
  await page.fill('#au-email', email);
  await page.check('#au-ok');
  await page.click('.entree-form button.btn.primary');
  await page.waitForSelector('#au-code');
  await page.fill('#au-code', '123456');
  await page.waitForSelector('.auth-card.wide.onb', { timeout: 15000 });
}

for (const langue of ['fr', 'ar']) {
  test(`entrée (${langue}, 360 px) : le rôle et l’email au-dessus du pli, des chiffres vrais, l’indépendance dite`, async () => {
    const s = await visiteur({ langue });
    assert.equal(await s.page.getAttribute('html', 'dir'), langue === 'ar' ? 'rtl' : 'ltr');
    assert.ok((await basBouton(s.page)) <= 640, 'le bouton « Recevoir mon code » se voit sans défiler');
    assert.ok(await s.page.isVisible('#au-je-etudiant'));
    await s.page.waitForFunction(() => document.querySelector('.auth-chiffres')?.children.length === 3);
    if (langue === 'fr') {
      assert.deepEqual(await s.page.$$eval('.auth-chiffres span', x => x.map(e => e.textContent)), ['39 lauréats', '19 entreprises', '14 promos']);
      assert.match(await s.page.locator('.auth-pied').innerText(), /indépendante de l’administration de l’école/);
    } else assert.match(await s.page.locator('h1').innerText(), /الخريجون/);
    assert.equal(await s.page.getAttribute('.auth-pied a[href^="mailto:"]', 'href'), 'mailto:reseau.ensam.meknes@gmail.com');
    assert.ok((await s.debordement()) <= 0);
    await s.app();
    assert.ok(await s.page.isVisible('#entree .entree-form'), 'l’application reprend l’entrée telle quelle');
    if (langue === 'ar') assert.deepEqual(await s.page.evaluate(() => [...(window.__ensamMissing || [])]), []);
    assert.deepEqual(await axe(s.page, '#entree'), []);
    assert.deepEqual(s.erreurs, []);
    await s.ctx.close();
  });
}

test('code à 6 chiffres : de l’entrée à la « Dernière étape », le rôle n’est demandé qu’une fois', async () => {
  const s = await visiteur({ largeur: 390, hauteur: 844 });
  // Sans rôle : rien ne part, on le dit
  await s.page.fill('#au-email', 'yassine@gmail.com'); await s.page.check('#au-ok');
  await s.page.click('.entree-form button.btn.primary');
  assert.ok(await s.page.isVisible('#au-role-msg'));
  assert.equal(site.appels.filter(a => a.u === '/sb/auth/v1/otp' && a.corps.email === 'yassine@gmail.com').length, 0);
  await s.page.click('#au-je-laureat');
  await s.page.click('.entree-form button.btn.primary');
  await s.page.waitForSelector('#au-code');
  const otp = site.appels.filter(a => a.u === '/sb/auth/v1/otp' && a.corps.email === 'yassine@gmail.com').pop();
  assert.equal(otp.corps.create_user, true);
  assert.equal(otp.corps.data.role_choisi, 'laureat');
  assert.match(await s.page.locator('.au-adresse').innerText(), /yassine@gmail\.com/);
  assert.match(await s.page.locator('#au-renvoyer').innerText(), /Renvoyer le code dans \d+ s/);
  assert.ok(await s.page.isDisabled('#au-renvoyer'));
  assert.equal(await s.page.getAttribute('#au-code', 'autocomplete'), 'one-time-code');
  // Un code faux : on le dit, le champ reste prêt
  await s.page.fill('#au-code', '111111');
  await s.page.waitForSelector('.auth-msg.err');
  assert.match(await s.page.locator('.auth-msg.err').innerText(), /Ce code ne marche pas/);
  // Le code collé avec du texte autour, en chiffres arabes
  await s.page.fill('#au-code', 'Ton code : ١٢٣٤٥٦');
  await s.page.waitForSelector('.auth-card.wide.onb', { timeout: 15000 });
  assert.equal(await s.page.locator('#pf-role-rappel').innerText(), 'Tu t’inscris comme lauréat(e).');
  assert.equal(await s.page.locator('#entree').count(), 0, 'l’entrée est partie');
  assert.equal(await s.page.evaluate(() => localStorage.getItem('ensam-deja-membre')), '1');
  // « Dernière étape » : trois champs et « aider », puis le profil part avec le rôle choisi
  await s.page.fill('#pf-name', 'Yassine Berrada'); await s.page.fill('#pf-promo', '2019');
  await s.page.selectOption('#pf-fil', { index: 1 }); await s.page.click('#pf-aide-oui');
  await s.page.click('.pf-pied .btn');
  await s.page.waitForFunction(() => !document.querySelector('.auth-card.wide.onb'), null, { timeout: 15000 });
  const p = site.inscrits.find(x => x.id === UID);
  assert.equal(p.role, 'laureat'); assert.equal(p.promo, 2019); assert.equal(p.mentor_dispo, true); assert.equal(p.full_name, 'Yassine Berrada');
  assert.ok(p.consent_at, 'l’accord donné à l’entrée est gardé');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('code à 6 chiffres : un email inconnu passe à l’inscription, un code déjà parti mène à l’étape du code', async () => {
  const s = await visiteur({ stockage: { 'ensam-deja-membre': '1' } });
  assert.equal(await s.page.locator('#au-je-etudiant').count(), 0, 'ce téléphone a déjà servi : « Se connecter » d’abord');
  await s.page.fill('#au-email', 'inconnu@exemple.ma');
  await s.page.click('.entree-form button.btn.primary');
  await s.page.waitForSelector('#au-je-etudiant');
  assert.match(await s.page.locator('.auth-msg').innerText(), /Pas encore de compte avec cet email/);
  assert.equal(await s.page.inputValue('#au-email'), 'inconnu@exemple.ma');
  await s.page.click('#au-je-etudiant'); await s.page.fill('#au-email', 'vite@exemple.ma'); await s.page.check('#au-ok');
  await s.page.click('.entree-form button.btn.primary');
  await s.page.waitForSelector('#au-code');
  assert.match(await s.page.locator('.auth-msg').innerText(), /Un code t’a déjà été envoyé/);
  // Recharger à l'étape du code (retour de la messagerie) : on y revient
  await s.page.reload(); await s.page.waitForSelector('#au-code');
  assert.match(await s.page.locator('.au-adresse').innerText(), /vite@exemple\.ma/);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('membre déjà connecté : jamais la page d’entrée', async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 360, height: 640 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await ctx.addInitScript(uid => {
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'x.' + btoa(JSON.stringify({ sub: uid, exp: now + 7200 })) + '.y', token_type: 'bearer', expires_in: 7200, expires_at: now + 7200, refresh_token: 'r', user: { id: uid, aud: 'authenticated', email: 'membre@exemple.ma', user_metadata: { role_choisi: 'etudiant' }, app_metadata: {} } }));
    window.__vu = false; new MutationObserver(() => { if (document.getElementById('entree')) window.__vu = true; }).observe(document, { childList: true, subtree: true });
  }, UID);
  const page = await ctx.newPage(); const erreurs = []; page.on('pageerror', e => erreurs.push(e.message));
  await page.goto(site.adresse);
  await page.waitForSelector('.auth-card.wide.onb', { timeout: 15000 });
  assert.equal(await page.evaluate(() => window.__vu), false);
  assert.equal(await page.locator('#pf-role-rappel').innerText(), 'Tu t’inscris comme étudiant(e).');
  assert.deepEqual(erreurs, []);
  await ctx.close();
});

test('lien d’invitation d’une promo : bandeau, rôle étudiant choisi d’avance, adresse nettoyée', async () => {
  const s = await visiteur({ query: `?promo=${S + 1}` });
  assert.equal(await s.page.getAttribute('#au-je-etudiant', 'aria-pressed'), 'true');
  assert.match(await s.page.locator('.invite-band').innerText(), new RegExp(`promo ${S + 1}`));
  assert.equal(await s.page.evaluate(() => location.search), '');
  assert.equal(await s.page.evaluate(() => getComputedStyle(document.querySelector('.invite-band')).borderRadius), '10px', 'bandeau mis en forme avant l’application');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('offre partagée sur WhatsApp : l’entrée dit ce qui attend, le lien survit à l’inscription, l’offre s’ouvre', async () => {
  const s = await visiteur({ hash: '#offre/' + OFFRE });
  await s.page.waitForFunction(() => /PFE/.test(document.getElementById('au-lien')?.textContent || ''));
  assert.equal(await s.page.locator('#au-lien').innerText(), 'Une offre de PFE t’attend : crée ton compte pour la voir.');
  assert.equal(await s.page.locator('.entree-sous').count(), 0);
  assert.ok((await basBouton(s.page)) <= 640);
  assert.equal(await s.page.evaluate(() => location.hash), '#offre/' + OFFRE);
  assert.ok(await s.page.evaluate(() => localStorage.getItem('ensam-lien-partage')));
  // Rechargée (onglet WhatsApp, retour de la messagerie) : rien ne change
  await s.page.reload(); await s.page.waitForSelector('#au-lien');
  await s.app();
  // Confidentialité puis retour : la ligne est toujours là
  await s.page.click('.entree-form a[href="#confidentialite"]'); await s.page.waitForTimeout(400);
  await s.page.goBack(); await s.page.waitForSelector('#au-lien');
  assert.ok(await s.page.isVisible('#au-lien'));
  await sInscrire(s.page);
  assert.equal(await s.page.locator('#onb-lien').innerText(), 'Après cette étape, l’offre qu’on t’a partagée s’ouvre.');
  // Étudiant(e) de 5A : la fiche de l'offre s'ouvre après la « Dernière étape »
  await s.page.fill('#pf-name', 'Amine Alaoui'); await s.page.fill('#pf-promo', String(S + 1));
  await s.page.selectOption('#pf-fil', { index: 1 });
  await s.page.click('.pf-pied .btn');
  await s.page.waitForSelector('.modal', { timeout: 15000 });
  assert.match(await s.page.locator('.modal').innerText(), /PFE Lean manufacturing/);
  assert.equal(await s.page.evaluate(() => location.hash), '#offres');
  assert.equal(await s.page.evaluate(() => localStorage.getItem('ensam-lien-partage')), null);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('offre partagée : disparue, base pas à jour, déjà membre, autres liens', async () => {
  let s = await visiteur({ hash: '#offre/' + DISPARUE });
  await s.page.waitForSelector('#au-lien.fini');
  assert.equal(await s.page.locator('#au-lien').innerText(), 'Cette offre n’est plus en ligne.');
  assert.equal(await s.page.evaluate(() => location.hash), '#accueil');
  assert.equal(await s.page.evaluate(() => localStorage.getItem('ensam-lien-partage')), null);
  await s.ctx.close();
  s = await visiteur({ hash: '#offre/' + INCONNUE });
  await s.page.waitForTimeout(600);
  assert.equal(await s.page.locator('#au-lien').innerText(), 'On t’a partagé une offre : crée ton compte pour la voir.');
  await s.ctx.close();
  s = await visiteur({ hash: '#offre/' + OFFRE, stockage: { 'ensam-deja-membre': '1' } });
  await s.page.waitForFunction(() => /PFE/.test(document.getElementById('au-lien')?.textContent || ''));
  assert.match(await s.page.locator('#au-lien').innerText(), /connecte-toi pour la voir\.$/);
  await s.ctx.close();
  s = await visiteur({ hash: '#aider/d1' });
  assert.equal(await s.page.locator('#au-je-etudiant').count(), 0, '« Je peux aider » vient d’un email : connexion');
  assert.equal(await s.page.locator('#au-lien').innerText(), 'Connecte-toi pour voir la demande de l’étudiant.');
  await s.ctx.close();
  s = await visiteur({ hash: '#reseau/entraide/q1' });
  assert.equal(await s.page.locator('#au-lien').innerText(), 'Une question t’attend : crée ton compte pour y répondre.');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('offre partagée en arabe : la phrase traduite, rien qui dépasse, rien d’oublié', async () => {
  const s = await visiteur({ langue: 'ar', hash: '#offre/' + OFFRE });
  await s.page.waitForFunction(() => /مشروع/.test(document.getElementById('au-lien')?.textContent || ''));
  assert.equal(await s.page.locator('#au-lien').innerText(), 'عرض مشروع نهاية الدراسة في انتظارك: أنشئ حسابك لتطّلع عليه.');
  assert.ok((await s.debordement()) <= 0);
  await s.app();
  assert.deepEqual(await s.page.evaluate(() => [...(window.__ensamMissing || [])]), []);
  assert.deepEqual(await axe(s.page, '#entree'), []);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});
