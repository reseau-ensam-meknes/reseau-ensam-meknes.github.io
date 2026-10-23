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

// langue: null = un visiteur qui n'a jamais choisi de langue ; avant(ctx) : réseau à régler avant la première visite
async function visiteur({ largeur = 360, hauteur = 640, langue = 'fr', hash = '', query = '', stockage = {}, avant } = {}) {
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  if (avant) await avant(ctx);
  await ctx.addInitScript(([langue, stockage]) => {
    if (sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init', '1');
    if (langue) localStorage.setItem('ensam-lang', langue);
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
  assert.equal(otp.corps.data.par_code, true, 'la base sait que ce compte naît d’une demande de code');
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
  // Puis l'accueil : son rang parmi les lauréats, le badge annoncé, un seul bouton
  await s.page.waitForSelector('.modal.arrivee', { timeout: 8000 });
  assert.equal(await s.page.locator('.arrivee-titre').innerText(), 'Te voilà 2e lauréat(e) du réseau');
  assert.match(await s.page.locator('.arrivee-fondateur').innerText(), /Membre fondateur/);
  assert.equal(await s.page.locator('.modal.arrivee .btn.primary').count(), 1);
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

for (const ici of [true, false]) test(`membre déjà connecté : jamais la page d’entrée ; le rôle vient ${ici ? 'de cet appareil' : 'd’une nouvelle question (code demandé ailleurs)'}`, async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 360, height: 640 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await ctx.addInitScript(([uid, ici]) => {
    if (sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init', '1');
    if (ici) localStorage.setItem('ensam-accord-ici', JSON.stringify({ e: 'membre@exemple.ma', t: Date.now() }));
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'x.' + btoa(JSON.stringify({ sub: uid, exp: now + 7200 })) + '.y', token_type: 'bearer', expires_in: 7200, expires_at: now + 7200, refresh_token: 'r', user: { id: uid, aud: 'authenticated', email: 'membre@exemple.ma', user_metadata: { role_choisi: 'etudiant' }, app_metadata: {} } }));
    window.__vu = false; new MutationObserver(() => { if (document.getElementById('entree')) window.__vu = true; }).observe(document, { childList: true, subtree: true });
  }, [UID, ici]);
  const page = await ctx.newPage(); const erreurs = []; page.on('pageerror', e => erreurs.push(e.message));
  // Code entré mais « Dernière étape » pas finie : pas encore membre, le lien de sa promo garde la promo
  await page.goto(site.adresse + (ici ? `?promo=${S + 1}` : ''));
  await page.waitForSelector('.auth-card.wide.onb', { timeout: 15000 });
  assert.equal(await page.evaluate(() => window.__vu), false);
  if (ici) {
    assert.equal(await page.locator('#pf-role-rappel').innerText(), 'Tu t’inscris comme étudiant(e).');
    assert.equal(await page.inputValue('#pf-promo'), String(S + 1));
  } else {
    assert.equal(await page.locator('#pf-role-rappel').count(), 0);
    assert.ok(await page.isVisible('#pf-je-etudiant'), 'rôle et accord ne sont repris que s’ils ont été donnés sur cet appareil');
  }
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

test('adresse tapée par quelqu’un d’autre : la personne qui a le code ne reprend ni son rôle ni son accord', async () => {
  let s = await visiteur();
  await s.page.click('#au-je-laureat'); await s.page.fill('#au-email', 'partage@exemple.ma'); await s.page.check('#au-ok');
  await s.page.uncheck('#au-mail');
  await s.page.click('.entree-form button.btn.primary'); await s.page.waitForSelector('#au-code');
  await s.ctx.close();
  // Sur son propre téléphone, la vraie personne se connecte avec le code reçu
  s = await visiteur({ stockage: { 'ensam-deja-membre': '1' } });
  await s.page.fill('#au-email', 'partage@exemple.ma');
  await s.page.click('.entree-form button.btn.primary'); await s.page.waitForSelector('#au-code');
  await s.page.fill('#au-code', '123456');
  await s.page.waitForSelector('.auth-card.wide.onb', { timeout: 15000 });
  assert.equal(await s.page.locator('#pf-role-rappel').count(), 0);
  await s.page.click('#pf-je-etudiant');
  await s.page.fill('#pf-name', 'Salma Idrissi'); await s.page.fill('#pf-promo', String(S + 1));
  await s.page.selectOption('#pf-fil', { index: 1 });
  await s.page.click('.pf-pied .btn');
  await s.page.waitForFunction(() => !document.querySelector('.auth-card.wide.onb'), null, { timeout: 15000 });
  const p = site.inscrits.find(x => x.id === UID);
  assert.equal(p.role, 'etudiant');
  assert.ok(!p.consent_at, 'l’accord n’est pas celui de l’autre personne');
  assert.equal(p.emails_hebdo, false, 'un « non » au résumé est toujours gardé');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('adresse tapée par quelqu’un d’autre, puis « Créer mon compte » par la vraie personne : son rôle à elle', async () => {
  let s = await visiteur();
  await s.page.click('#au-je-laureat'); await s.page.fill('#au-email', 'salma@exemple.ma'); await s.page.check('#au-ok');
  await s.page.click('.entree-form button.btn.primary'); await s.page.waitForSelector('#au-code');
  await s.ctx.close();
  s = await visiteur();
  await sInscrire(s.page, { role: 'etudiant', email: 'salma@exemple.ma' });
  assert.equal(await s.page.locator('#pf-role-rappel').innerText(), 'Tu t’inscris comme étudiant(e).');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('entrée : deux touchers dans le même instant n’envoient qu’un code ; le passage d’un mode à l’autre garde le clavier au bon endroit', async () => {
  const s = await visiteur();
  await s.app();
  await s.page.click('#au-je-etudiant'); await s.page.fill('#au-email', 'double@exemple.ma'); await s.page.check('#au-ok');
  await s.page.evaluate(() => { const b = document.querySelector('.entree-form button.btn.primary'); b.click(); b.click(); });
  await s.page.waitForSelector('#au-code');
  await s.page.waitForTimeout(300);
  assert.equal(site.appels.filter(a => a.u === '/sb/auth/v1/otp' && a.corps.email === 'double@exemple.ma').length, 1);
  await s.ctx.close();
  const t = await visiteur({ stockage: { 'ensam-deja-membre': '1' } });
  const focus = id => t.page.waitForFunction(id => document.activeElement?.id === id, id, { timeout: 3000 });
  await t.page.click('.entree-form button.linkish:has-text("Créer un compte")');
  await focus('au-je-etudiant'); // sans rôle : le choix du rôle d'abord
  await t.page.click('#au-je-laureat');
  await t.page.click('.entree-form button.linkish:has-text("J’ai déjà un compte")');
  await focus('au-email');
  await t.page.click('#au-mdp');
  await focus('au-pw');
  assert.deepEqual(t.erreurs, []);
  await t.ctx.close();
});

test('réseau coupé pendant le chargement : la page se recharge dès que le réseau répond, l’email tapé reste', async () => {
  // store.js tombe (3G instable) jusqu'à ce que le site vérifie que le réseau répond : le navigateur, lui,
  // ne redemanderait jamais ce module dans cette page
  const coupe = (fichier, etat) => ctx => ctx.route(new RegExp(`/${fichier}$`), r => {
    if (r.request().resourceType() === 'fetch') etat.ouvert = true;
    if (etat.ouvert) return r.continue();
    etat.coupes++; return r.abort('connectionreset');
  });
  const e1 = { ouvert: false, coupes: 0 };
  const s = await visiteur({ avant: coupe('store\\.js', e1) });
  await s.page.waitForFunction(() => document.querySelector('link[href="store.js"]'));
  while (!e1.coupes) await s.page.waitForTimeout(50);
  await s.page.waitForTimeout(300);
  await s.page.click('#au-je-etudiant'); await s.page.fill('#au-email', 'reprise@exemple.ma'); await s.page.check('#au-ok');
  await Promise.all([s.page.waitForEvent('load'), s.page.click('.entree-form button.btn.primary')]);
  await s.page.waitForSelector('#entree .entree-form');
  assert.equal(await s.page.inputValue('#au-email'), 'reprise@exemple.ma');
  assert.ok(await s.page.isChecked('#au-ok'));
  assert.equal(await s.page.getAttribute('#au-je-etudiant', 'aria-pressed'), 'true');
  await s.page.click('.entree-form button.btn.primary');
  await s.page.waitForSelector('#au-code');
  await s.ctx.close();
  // Avec un mot de passe : le même formulaire revient (sans le mot de passe), prêt à le retaper
  const e0 = { ouvert: false, coupes: 0 };
  const m = await visiteur({ stockage: { 'ensam-deja-membre': '1' }, avant: coupe('store\\.js', e0) });
  while (!e0.coupes) await m.page.waitForTimeout(50);
  await m.page.waitForTimeout(300);
  await m.page.click('#au-mdp'); await m.page.fill('#au-email', 'laureat@exemple.ma'); await m.page.fill('#au-pw', 'secret123');
  await Promise.all([m.page.waitForEvent('load'), m.page.click('.entree-form button.btn.primary')]);
  await m.page.waitForSelector('#au-pw');
  assert.equal(await m.page.inputValue('#au-email'), 'laureat@exemple.ma');
  assert.equal(await m.page.inputValue('#au-pw'), '');
  await m.page.waitForFunction(() => document.activeElement?.id === 'au-pw', null, { timeout: 3000 });
  await m.ctx.close();
  // app.js tombe : après le bon code, la page se recharge dès que le réseau répond et la « Dernière étape » s'ouvre
  const e2 = { ouvert: false, coupes: 0 };
  const t = await visiteur({ avant: coupe('app\\.js', e2) });
  await sInscrire(t.page);
  assert.ok(e2.coupes > 0 && e2.ouvert);
  assert.equal(await t.page.locator('#entree').count(), 0);
  await t.ctx.close();
});

test('lien arabe d’une promo : l’arabe pour cette visite seulement, jamais gardé comme un choix', async () => {
  const s = await visiteur({ langue: null, query: '?promo=2019&lang=ar' });
  assert.equal(await s.page.getAttribute('html', 'dir'), 'rtl');
  assert.equal(await s.page.evaluate(() => localStorage.getItem('ensam-lang')), null);
  await s.page.reload(); await s.page.waitForSelector('#entree .entree-form');
  assert.equal(await s.page.getAttribute('html', 'dir'), 'rtl', 'rechargée pendant la visite : toujours en arabe');
  // Plus tard, un lien français (nouvelle visite) : en français
  const p = await s.ctx.newPage();
  await p.goto(site.adresse + '?promo=2019'); await p.waitForSelector('#entree .entree-form');
  assert.equal(await p.getAttribute('html', 'dir'), 'ltr');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('déconnexion en lisant une question : l’entrée ne prétend pas qu’on lui a partagé un lien', async () => {
  site.inscrits.push({ id: UID, full_name: 'Membre Test', role: 'etudiant', filiere: 'Génie Industriel', promo: S + 1, created_at: '2026-10-01T10:00:00Z', consent_at: '2026-10-01T10:00:00Z', verified: true });
  const ctx = await navigateur.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await ctx.addInitScript(uid => {
    if (sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init', '1');
    localStorage.setItem('ensam-lang', 'fr');
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'x.' + btoa(JSON.stringify({ sub: uid, exp: now + 7200 })) + '.y', token_type: 'bearer', expires_in: 7200, expires_at: now + 7200, refresh_token: 'r', user: { id: uid, aud: 'authenticated', email: 'membre@exemple.ma', user_metadata: {}, app_metadata: {} } }));
  }, UID);
  const page = await ctx.newPage(); const erreurs = []; page.on('pageerror', e => erreurs.push(e.message));
  await page.goto(site.adresse + '?promo=2019#reseau/entraide');
  await page.waitForSelector('.me-btn', { timeout: 15000 });
  assert.equal(await page.evaluate(() => localStorage.getItem('ensam-invite-promo')), null, 'un membre avec son profil n’est pas un invité');
  await page.evaluate(() => { location.hash = '#reseau/entraide/' + '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'; });
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.click('.me-btn'); await page.click('.menu-pop button:has-text("Se déconnecter")');
  await page.waitForSelector('#entree .entree-form', { timeout: 15000 });
  assert.equal(await page.locator('#au-lien').count(), 0);
  assert.ok(await page.isVisible('.entree-sous'));
  // Rechargée plus tard (onglet restauré) : toujours rien
  await page.reload(); await page.waitForSelector('#entree .entree-form');
  assert.equal(await page.locator('#au-lien').count(), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('ensam-lien-partage')), null);
  assert.deepEqual(erreurs, []);
  await ctx.close();
});

test('réseau coupé après la connexion : un module qui tombe une fois la connexion faite recharge aussi la page', async () => {
  const tenus = []; let libre = false;
  const s = await visiteur({ avant: ctx => ctx.route(/\/community\.js$/, r => (libre ? r.continue() : tenus.push(r))) });
  await s.page.click('#au-je-etudiant'); await s.page.fill('#au-email', 'tard@exemple.ma'); await s.page.check('#au-ok');
  await s.page.click('.entree-form button.btn.primary'); await s.page.waitForSelector('#au-code');
  await s.page.fill('#au-code', '123456');
  await s.page.waitForFunction(() => /Connexion/.test(document.querySelector('.entree-form button.btn.primary')?.textContent || ''));
  while (!tenus.length) await s.page.waitForTimeout(50);
  libre = true; for (const r of tenus.splice(0)) await r.abort('connectionreset');
  await s.page.waitForSelector('.auth-card.wide.onb', { timeout: 20000 });
  assert.equal(await s.page.evaluate(() => sessionStorage.getItem('ensam-entree-saisie')), null, 'rien de tapé ne reviendra après une déconnexion');
  await s.ctx.close();
});

test('panne qui dure (un fichier toujours en échec) : deux rechargements au plus, puis un écran calme', async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 360, height: 640 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await ctx.route(/\/parse-offre\.js$/, r => r.abort('connectionreset'));
  await ctx.addInitScript(uid => {
    if (sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init', '1');
    localStorage.setItem('ensam-lang', 'fr');
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'x.' + btoa(JSON.stringify({ sub: uid, exp: now + 7200 })) + '.y', token_type: 'bearer', expires_in: 7200, expires_at: now + 7200, refresh_token: 'r', user: { id: uid, aud: 'authenticated', email: 'membre@exemple.ma', user_metadata: {}, app_metadata: {} } }));
  }, UID);
  const page = await ctx.newPage(); let chargements = 0;
  page.on('load', () => { chargements++; });
  await page.goto(site.adresse);
  await page.waitForSelector('.fatal', { timeout: 20000 });
  await page.waitForTimeout(3000);
  assert.ok(chargements <= 3, `${chargements} chargements`);
  assert.match(await page.locator('.fatal').innerText(), /Pas de connexion pour l’instant/);
  assert.equal(await page.locator('.fatal .btn.primary').innerText(), 'Réessayer');
  await ctx.close();
});

test('code demandé en arabe, entré dans un autre onglet : toujours en arabe', async () => {
  const s = await visiteur({ langue: null, query: '?promo=2019&lang=ar' });
  await s.page.click('#au-je-laureat'); await s.page.fill('#au-email', 'hiba@exemple.ma'); await s.page.check('#au-ok');
  await s.page.click('.entree-form button.btn.primary'); await s.page.waitForSelector('#au-code');
  const p = await s.ctx.newPage();
  await p.goto(site.adresse); await p.waitForSelector('#au-code');
  assert.equal(await p.getAttribute('html', 'dir'), 'rtl');
  await p.fill('#au-code', '123456');
  await p.waitForSelector('.auth-card.wide.onb', { timeout: 15000 });
  assert.equal(await p.getAttribute('html', 'dir'), 'rtl');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});
