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
// Membres fondateurs : la réponse de fondateurs_publics() pour un test (null : la base n'a pas encore la fonction)
let fondateursFaux = null;
// Ambassadeurs de promo : les lignes de la table (null : la base n'a pas encore la table)
let ambFaux = null;
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
before(async () => {
  assert.ok(fs.existsSync(path.join(SITE, 'index.html')), `site introuvable : ${SITE} (lance d’abord sh build.sh)`);
  site = await fauxSite(SITE, { offres: OFFRES, profils: PROFILS, partagees: { [OFFRE]: { type: 'pfe', audience: 'etudiants', ouverte: true }, [DISPARUE]: null, [INCONNUE]: 404 }, fondateurs: m => fondateursFaux?.(m) ?? null, photo: PIXEL, ambassadeurs: () => ambFaux, chiffresPromo: { inscrits: 12, nouveaux: 3, demandes: 2, demandes_mois: 1, stages: 4, stages_mois: 1 } });
  navigateur = await chromium.launch();
});
after(async () => { await navigateur?.close(); site?.fermer(); });
beforeEach(() => { site.vider(); fondateursFaux = null; ambFaux = null; });

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

test('entrée sur un grand téléphone : la phrase d’explication est là, et le clavier qui s’ouvre ne fait rien bouger', async () => {
  const s = await visiteur({ largeur: 390, hauteur: 844 });
  assert.ok(await s.page.isVisible('.entree-sous'));
  await s.page.focus('#au-email');
  const haut = () => s.page.evaluate(() => document.getElementById('au-email').getBoundingClientRect().top + scrollY);
  const avant = await haut();
  // Une application (WhatsApp, Instagram…) qui réduit la page quand le clavier s'ouvre
  await s.page.setViewportSize({ width: 390, height: 480 }); await s.page.waitForTimeout(200);
  assert.ok(await s.page.isVisible('.entree-sous'));
  assert.equal(await haut(), avant);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

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
  assert.equal(await s.page.locator('#pf-role-rappel').innerText(), 'Tu t’inscris côté lauréats.');
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
  // Puis l'accueil : son rang parmi les lauréats, un seul bouton ; « Membre fondateur » ne se promet plus à l'arrivée
  await s.page.waitForSelector('.modal.arrivee', { timeout: 8000 });
  assert.equal(await s.page.locator('.arrivee-titre').innerText(), 'Te voilà 2e parmi les lauréats du réseau');
  assert.doesNotMatch(await s.page.locator('.modal.arrivee').innerText(), /fondateur/i);
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
    assert.equal(await page.locator('#pf-role-rappel').innerText(), 'Tu t’inscris côté étudiants.');
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

for (const resume of [false, true]) test(`adresse tapée par quelqu’un d’autre (résumé ${resume ? 'laissé coché' : 'décoché'}) : la personne qui a le code ne reprend ni son rôle ni son accord`, async () => {
  let s = await visiteur();
  await s.page.click('#au-je-laureat'); await s.page.fill('#au-email', 'partage@exemple.ma'); await s.page.check('#au-ok');
  if (!resume) await s.page.uncheck('#au-mail');
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
  assert.equal(p.emails_hebdo, false, 'pas de résumé de la semaine sans un « oui » de cette personne');
  // La fenêtre « Tes données » demande l'accord ; le résumé y est proposé comme il a été laissé à l'inscription
  await s.page.waitForSelector('#cs-ok');
  assert.equal(await s.page.isChecked('#cs-ok'), false);
  assert.equal(await s.page.isChecked('#cs-mail'), resume);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('lien d’une promo, rôle choisi d’avance sans toucher : la « Dernière étape » garde ce rôle, même pour une adresse qui a déjà servi', async () => {
  let s = await visiteur();
  await s.page.click('#au-je-laureat'); await s.page.fill('#au-email', 'promo.role@exemple.ma'); await s.page.check('#au-ok');
  await s.page.click('.entree-form button.btn.primary'); await s.page.waitForSelector('#au-code');
  await s.ctx.close();
  s = await visiteur({ query: `?promo=${S + 1}` });
  assert.equal(await s.page.getAttribute('#au-je-etudiant', 'aria-pressed'), 'true');
  await s.page.fill('#au-email', 'promo.role@exemple.ma'); await s.page.check('#au-ok');
  await s.page.click('.entree-form button.btn.primary'); await s.page.waitForSelector('#au-code');
  await s.page.fill('#au-code', '123456');
  await s.page.waitForSelector('.auth-card.wide.onb', { timeout: 15000 });
  assert.equal(await s.page.locator('#pf-role-rappel').innerText(), 'Tu t’inscris côté étudiants.');
  assert.equal(await s.page.inputValue('#pf-promo'), String(S + 1));
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
  assert.equal(await s.page.locator('#pf-role-rappel').innerText(), 'Tu t’inscris côté étudiants.');
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

test('un geste pendant que le magasin est encore en train d’échouer : la page se recharge quand même dès que le réseau répond', async () => {
  // 3G lente : store.js met du temps à tomber, et le visiteur touche « Recevoir mon code » avant
  const etat = { ouvert: false, vu: 0 };
  const s = await visiteur({ avant: ctx => ctx.route(/\/store\.js$/, async r => {
    if (r.request().resourceType() === 'fetch') etat.ouvert = true;
    if (etat.ouvert) return r.continue();
    etat.vu++; await new Promise(ok => setTimeout(ok, 2500)); return r.abort('connectionreset');
  }) });
  while (!etat.vu) await s.page.waitForTimeout(50);
  await s.page.click('#au-je-etudiant'); await s.page.fill('#au-email', 'lent@exemple.ma'); await s.page.check('#au-ok');
  await Promise.all([s.page.waitForEvent('load', { timeout: 15000 }), s.page.click('.entree-form button.btn.primary')]);
  await s.page.waitForSelector('#entree .entree-form');
  assert.equal(await s.page.inputValue('#au-email'), 'lent@exemple.ma');
  assert.ok(etat.ouvert);
  await s.ctx.close();
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

test('même appareil, deux liens de promo : le rôle choisi d’avance par le premier ne reste pas pour le second', async () => {
  const s = await visiteur({ query: '?promo=2015' });
  assert.equal(await s.page.getAttribute('#au-je-laureat', 'aria-pressed'), 'true');
  await s.page.fill('#au-email', 'premier@exemple.ma'); await s.page.check('#au-ok');
  await s.page.click('.entree-form button.btn.primary'); await s.page.waitForSelector('#au-code');
  // Le code n'est jamais entré ; plus tard, sur le même téléphone, le lien d'une promo d'étudiants
  await s.page.evaluate(() => localStorage.removeItem('ensam-code-attendu'));
  await s.page.goto(site.adresse + `?promo=${S + 1}`); await s.page.waitForSelector('#entree .entree-form');
  assert.equal(await s.page.getAttribute('#au-je-etudiant', 'aria-pressed'), 'true');
  assert.match(await s.page.locator('.invite-band').innerText(), new RegExp(`promo ${S + 1}`));
  await s.page.fill('#au-email', 'second@exemple.ma'); await s.page.check('#au-ok');
  await s.page.click('.entree-form button.btn.primary'); await s.page.waitForSelector('#au-code');
  await s.page.fill('#au-code', '123456');
  await s.page.waitForSelector('.auth-card.wide.onb', { timeout: 15000 });
  assert.equal(await s.page.locator('#pf-role-rappel').innerText(), 'Tu t’inscris côté étudiants.');
  assert.equal(await s.page.inputValue('#pf-promo'), String(S + 1));
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('réseau coupé pendant la lecture de « Confidentialité » : la page se recharge, et au retour le formulaire tapé est là', async () => {
  const tenus = []; let libre = false;
  const s = await visiteur({ avant: ctx => ctx.route(/\/community\.js$/, r => (libre ? r.continue() : tenus.push(r))) });
  await s.page.click('#au-je-laureat'); await s.page.fill('#au-email', 'lit@exemple.ma'); await s.page.check('#au-ok');
  await s.page.click('.entree-form a[href="#confidentialite"]');
  while (!tenus.length) await s.page.waitForTimeout(50);
  libre = true;
  await Promise.all([s.page.waitForEvent('load'), (async () => { for (const r of tenus.splice(0)) await r.abort('connectionreset'); })()]);
  assert.equal(await s.page.evaluate(() => location.hash), '#confidentialite');
  await s.app();
  await s.page.goBack(); await s.page.waitForSelector('#entree .entree-form #au-email');
  assert.equal(await s.page.inputValue('#au-email'), 'lit@exemple.ma');
  assert.ok(await s.page.isChecked('#au-ok'));
  assert.equal(await s.page.getAttribute('#au-je-laureat', 'aria-pressed'), 'true');
  await s.ctx.close();
});

test('panne qui dure (un fichier toujours en échec) : deux rechargements au plus, puis un écran calme', async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 360, height: 640 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  // Un module de l'application chargé au démarrage (parse-offre.js, l'ancien témoin, ne se charge plus qu'à la demande)
  await ctx.route(/\/recrutement\.js$/, r => r.abort('connectionreset'));
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

// Un membre déjà connecté sur cet appareil (session gardée), ouvert sur « hash ». push : un navigateur qui peut recevoir
// des notifications sans y être abonné (etatPush 'off'), comme un téléphone Android. permission : la réponse du membre
// à la demande du navigateur, qui arrive après « delai » millisecondes ; les demandes sont comptées (window.__demandes)
async function membre({ hash = '', push = false, permission = 'default', delai = 0 } = {}) {
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  if (push) await ctx.addInitScript(([permission, delai]) => {
    const sub = { endpoint: 'https://push.exemple.ma/abc', toJSON: () => ({ endpoint: 'https://push.exemple.ma/abc', keys: { p256dh: 'p256', auth: 'auth' } }), unsubscribe: async () => true };
    const pm = { getSubscription: async () => null, subscribe: async () => sub };
    const reg = { waiting: null, installing: null, addEventListener() {}, pushManager: pm };
    const sw = { register: async () => reg, ready: Promise.resolve(reg), controller: null, addEventListener() {} };
    Object.defineProperty(Navigator.prototype, 'serviceWorker', { get: () => sw, configurable: true });
    window.__demandes = 0;
    window.Notification = class {
      static permission = 'default';
      static requestPermission = async () => {
        window.__demandes++;
        if (delai) await new Promise(ok => setTimeout(ok, delai));
        window.Notification.permission = permission; return permission;
      };
    };
    if (!('PushManager' in window)) window.PushManager = function PushManager() {};
  }, [permission, delai]);
  await ctx.addInitScript(uid => {
    if (sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init', '1');
    localStorage.setItem('ensam-lang', 'fr');
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'x.' + btoa(JSON.stringify({ sub: uid, exp: now + 7200 })) + '.y', token_type: 'bearer', expires_in: 7200, expires_at: now + 7200, refresh_token: 'r', user: { id: uid, aud: 'authenticated', email: 'membre@exemple.ma', user_metadata: {}, app_metadata: {} } }));
  }, UID);
  const page = await ctx.newPage(); const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto(site.adresse + hash);
  await page.waitForSelector('.me-btn', { timeout: 15000 });
  return { ctx, page, erreurs };
}
const ETUDIANT = { id: UID, full_name: 'Salma Test', role: 'etudiant', filiere: 'Génie Industriel', promo: S + 1, created_at: '2025-10-01T10:00:00Z', verified: true,
  emails_hebdo: true, alertes_offres: true, alertes_email: true, emails_messages: true };

test('accord pas encore donné (loi 09-08) : jamais de demande de notifications, même sur Confidentialité ou Mon profil', async () => {
  // Témoin : l'accord donné, la feuille d'ouverture vient
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z', notif_push: {} });
  let m = await membre({ hash: '#profil', push: true });
  await m.page.waitForSelector('.modal.ouverture', { timeout: 12000 });
  await m.ctx.close();
  for (const hash of ['#profil', '#confidentialite']) {
    site.vider(); site.inscrits.push({ ...ETUDIANT, notif_push: {} });
    m = await membre({ hash, push: true });
    await m.page.waitForTimeout(8000);
    assert.equal(await m.page.locator('.consent-back').count(), 0, 'la fenêtre de l’accord attend ailleurs');
    assert.equal(await m.page.locator('.modal.ouverture').count(), 0, hash);
    assert.deepEqual(m.erreurs, []);
    await m.ctx.close();
  }
});

test('Mon profil en ligne : les notifications par catégorie seulement une fois la base à jour (colonne notif_push)', async () => {
  for (const colonne of [false, true]) {
    site.vider(); site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z', ...(colonne ? { notif_push: {} } : {}) });
    const m = await membre({ hash: '#profil' });
    await m.page.waitForSelector('#mes-donnees', { timeout: 15000 });
    assert.equal(await m.page.locator('.md-cats').count(), colonne ? 1 : 0, 'les cases par catégorie');
    assert.equal(await m.page.locator('#md-alertes').count(), colonne ? 0 : 1, 'avant la mise à jour, l’étudiant garde sa case « M’alerter… »');
    // Avant, la présentation d'avant : « M'alerter… » (le téléphone) ne se range pas sous un titre « Par email »
    assert.equal(await m.page.locator('.md-titre').count(), colonne ? 2 : 0, 'les titres « Par email » et « Sur tes appareils »');
    assert.ok(await m.page.isChecked('#md-alertes-mail'), 'l’email des offres reste là');
    assert.deepEqual(m.erreurs, []);
    await m.ctx.close();
  }
});

test('« Activer » en ligne : le toucher demande l’autorisation au navigateur ; refusée, plus jamais de feuille ; acceptée, cet appareil est abonné', async () => {
  const cle = 'ensam-prevenir-' + UID;
  // Refusée par le membre dans la fenêtre du navigateur
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z', notif_push: {} });
  let m = await membre({ push: true, permission: 'denied' });
  await m.page.waitForSelector('.modal.ouverture', { timeout: 12000 });
  assert.equal(await m.page.evaluate(() => window.__demandes), 0, 'rien demandé avant le toucher');
  await m.page.click('#ouv-oui'); await m.page.waitForTimeout(500);
  assert.equal(await m.page.evaluate(() => window.__demandes), 1, 'le toucher sur « Activer » demande l’autorisation');
  assert.equal(await m.page.locator('.modal.ouverture').count(), 0);
  assert.equal(await m.page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}').fait, cle), 1);
  assert.ok(!site.appels.some(a => a.u === '/sb/rest/v1/rpc/abonner_push'), 'refusée : rien d’abonné');
  await m.page.reload(); await m.page.waitForSelector('.me-btn', { timeout: 15000 });
  await m.page.waitForTimeout(8000);
  assert.equal(await m.page.locator('.modal.ouverture').count(), 0, 'refusée par le navigateur : plus jamais');
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
  // Acceptée : la clé de la plateforme, puis l'abonnement de cet appareil
  site.vider(); site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z', notif_push: {} });
  m = await membre({ push: true, permission: 'granted' });
  await m.page.waitForSelector('.modal.ouverture', { timeout: 12000 });
  await m.page.click('#ouv-oui');
  await m.page.waitForSelector('.modal.ouverture', { state: 'detached', timeout: 5000 });
  assert.equal(await m.page.evaluate(() => window.__demandes), 1);
  const abonne = site.appels.find(a => a.u === '/sb/rest/v1/rpc/abonner_push');
  assert.deepEqual(abonne?.corps, { p_endpoint: 'https://push.exemple.ma/abc', p_p256dh: 'p256', p_auth: 'auth' });
  assert.match(await m.page.locator('.toast').last().innerText(), /Notifications activées sur cet appareil\./);
  assert.equal(await m.page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}').fait, cle), 1);
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('« Activer » puis fenêtre du navigateur fermée sans choisir : rien n’est bloqué, la demande pourra revenir', async () => {
  const cle = 'ensam-prevenir-' + UID;
  const lire = m => m.page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), cle);
  site.vider(); site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z', notif_push: {} });
  const m = await membre({ push: true, permission: 'default' });
  await m.page.waitForSelector('.modal.ouverture', { timeout: 12000 });
  await m.page.click('#ouv-oui');
  await m.page.waitForSelector('.modal.ouverture', { state: 'detached', timeout: 5000 });
  assert.match(await m.page.locator('.toast').last().innerText(), /Pas activées pour l’instant/);
  assert.equal((await lire(m)).fait, undefined, 'ce n’est pas une réponse');
  assert.equal((await lire(m)).n, 1, 'compté comme « Plus tard »');
  // Une semaine plus tard, la feuille revient
  await m.page.evaluate(k => { const x = JSON.parse(localStorage.getItem(k)); x.at -= 8 * 864e5; localStorage.setItem(k, JSON.stringify(x)); }, cle);
  await m.page.reload(); await m.page.waitForSelector('.me-btn', { timeout: 15000 });
  await m.page.waitForSelector('.modal.ouverture', { timeout: 12000 });
  await m.page.click('#ouv-tard');
  // Dans Mon profil, la même réponse laisse la case à toucher, sans dire que les notifications sont bloquées
  await m.page.evaluate(() => { location.hash = '#profil'; });
  await m.page.waitForSelector('#md-push:not([disabled])', { timeout: 15000 });
  await m.page.click('#md-push'); await m.page.waitForTimeout(500);
  assert.equal(await m.page.isDisabled('#md-push'), false);
  assert.equal(await m.page.isChecked('#md-push'), false);
  assert.doesNotMatch(await m.page.locator('.push-row').innerText(), /bloquées/);
  assert.equal((await lire(m)).fait, undefined);
  assert.equal(await m.page.evaluate(() => window.__demandes), 1, 'depuis le rechargement : le toucher dans Mon profil a demandé');
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('Mon profil : pendant la demande du navigateur lancée par l’interrupteur, pas de feuille d’ouverture par-dessus', async () => {
  site.vider(); site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z', notif_push: {} });
  const m = await membre({ hash: '#profil', push: true, permission: 'granted', delai: 7000 });
  await m.page.waitForSelector('#md-push:not([disabled])', { timeout: 15000 });
  await m.page.click('#md-push');
  await m.page.waitForTimeout(8500);
  assert.equal(await m.page.locator('.modal.ouverture').count(), 0, 'une seule demande à la fois');
  assert.ok(await m.page.isChecked('#md-push'));
  assert.equal(await m.page.evaluate(() => window.__demandes), 1);
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('Mon profil ouvert : après « Activer » sur la feuille, l’interrupteur de cet appareil suit', async () => {
  site.vider(); site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z', notif_push: {} });
  const m = await membre({ hash: '#profil', push: true, permission: 'denied' });
  await m.page.waitForSelector('.modal.ouverture', { timeout: 12000 });
  assert.equal(await m.page.isDisabled('#md-push'), false);
  await m.page.click('#ouv-oui'); await m.page.waitForTimeout(800);
  assert.equal(await m.page.isDisabled('#md-push'), true, 'refusée : l’interrupteur le montre');
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

// ---------------------------------------------------------------------------
// Membres fondateurs : en haut de la page d'entrée (seulement ceux qui ont dit oui), et sur l'accueil des membres
// ---------------------------------------------------------------------------
const HAJEB = { rang: 1, type: 'offre', at: '2026-10-23T09:12:00Z', nom: 'Abderrahman Hajeb', filiere: 'Génie Mécanique', promo: 2024, photo: UID + '/photo-1.webp', verifie: true };
const SEDKI = { rang: 2, type: 'offre', at: '2026-10-23T11:40:00Z', nom: 'Hamza Sedki', filiere: 'Génie Électromécanique', promo: 2024, photo: null, verifie: false };
const AUTRE_ID = '00000000-0000-4000-8000-0000000000c3';
const reponse = ({ oui = [HAJEB, SEDKI], choix = null } = {}) => membre => ({ max: 25, total: 2, places: 23, mon_choix: membre ? choix : null,
  fondateurs: (membre ? [HAJEB, SEDKI] : oui).map(f => ({ ...f, id: membre ? (f === HAJEB ? UID : AUTRE_ID) : null })) });

for (const langue of ['fr', 'ar']) test(`entrée (${langue}) : les membres fondateurs en haut, leur photo, « Recevoir mon code » toujours en vue`, async () => {
  fondateursFaux = reponse();
  const s = await visiteur({ langue, largeur: 390, hauteur: 844 });
  await s.page.waitForSelector('.fd-public .fd-carte', { timeout: 8000 });
  const bandeau = s.page.locator('.fd-public');
  assert.ok(await s.page.evaluate(() => document.querySelector('.fd-public').compareDocumentPosition(document.querySelector('.entree-promesse h1')) & Node.DOCUMENT_POSITION_FOLLOWING), 'au-dessus de la promesse');
  assert.deepEqual(await s.page.$$eval('.fd-public .fd-nom-t', x => x.map(e => e.textContent)), ['Abderrahman Hajeb', 'Hamza Sedki']);
  await s.page.waitForFunction(() => document.querySelector('.fd-public img')?.naturalWidth > 0);
  assert.equal(await s.page.locator('.fd-public .fd-liste img').count(), 1, 'une photo (l’autre : ses initiales)');
  assert.equal(await s.page.locator('.fd-public .fd-liste .verif').count(), 1);
  assert.equal(await s.page.locator('.fd-public .btn.primary').count(), 0, 'pas de bouton plein dans le bandeau');
  const sign = site.appels.find(a => a.u === '/sb/storage/v1/object/sign/photos');
  assert.deepEqual(sign?.corps, { expiresIn: 3600, paths: [UID + '/photo-1.webp'] }, 'un lien temporaire, seulement pour la photo publiée');
  if (langue === 'fr') {
    assert.match(await bandeau.innerText(), /Membres fondateurs[\s\S]*Lauréats du mois[\s\S]*Les premiers à aider les étudiants\. Merci !/);
    assert.match(await bandeau.innerText(), /GM · Promo 2024[\s\S]*Offre publiée le 23 octobre/);
    assert.match(await bandeau.innerText(), /2 membres fondateurs · 23 places restantes/);
  } else {
    const t = await bandeau.innerText();
    assert.match(t, /الأعضاء المؤسسون/); assert.match(t, /خريجو الشهر/); assert.match(t, /أول من ساعد الطلبة/);
    assert.match(t, /نشر عرض يوم 23 أكتوبر/); assert.match(t, /عضوان مؤسسان/); assert.doesNotMatch(t, /القدامى|Promo|Offre|places/);
  }
  assert.ok((await basBouton(s.page)) <= 844);
  assert.ok((await s.debordement()) <= 0);
  await s.app();
  assert.ok(await s.page.isVisible('.fd-public'), 'l’application reprend le bandeau');
  if (langue === 'ar') assert.deepEqual(await s.page.evaluate(() => [...(window.__ensamMissing || [])]), []);
  assert.deepEqual(await axe(s.page, '#entree'), []);
  assert.deepEqual(s.erreurs, []);
  // Petit téléphone : les visages seuls, et le bouton reste en vue
  await s.page.setViewportSize({ width: 360, height: 640 }); await s.page.reload();
  await s.page.waitForSelector('.fd-public .fd-pile', { state: 'visible', timeout: 8000 });
  assert.equal(await s.page.isVisible('.fd-public .fd-liste'), false);
  assert.ok((await basBouton(s.page)) <= 640, 'le bouton « Recevoir mon code » se voit sans défiler');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('entrée : sans l’accord des fondateurs, leur nombre seulement ; base pas encore à jour, pas de bandeau', async () => {
  fondateursFaux = reponse({ oui: [] });
  let s = await visiteur({ largeur: 390, hauteur: 844 });
  await s.page.waitForSelector('.fd-public', { timeout: 8000 });
  assert.equal(await s.page.locator('.fd-public .fd-carte').count(), 0);
  assert.doesNotMatch(await s.page.locator('.fd-public').innerText(), /Hajeb|Sedki/);
  assert.match(await s.page.locator('.fd-public .fd-totaux').innerText(), /^2 membres fondateurs · 23 places restantes$/);
  assert.equal(site.appels.filter(a => a.u.startsWith('/sb/storage/')).length, 0, 'aucune photo demandée');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
  fondateursFaux = null; site.vider();
  s = await visiteur({ largeur: 390, hauteur: 844 });
  await s.app(); await s.page.waitForTimeout(500);
  assert.ok(site.appels.some(a => a.u === '/sb/rest/v1/rpc/fondateurs_publics'), 'demandé');
  assert.equal(await s.page.locator('.fd-public').count(), 0);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('un lauréat devenu membre fondateur : le bandeau, la fête, puis « Ton nom sur la page d’entrée ? » une fois', async () => {
  fondateursFaux = reponse();
  site.inscrits.push({ id: UID, full_name: 'Abderrahman Hajeb', role: 'laureat', filiere: 'Génie Mécanique', promo: 2024, created_at: '2026-10-20T10:00:00Z', verified: true, consent_at: '2026-10-20T10:00:00Z', emails_hebdo: true });
  const m = await membre();
  await m.page.waitForSelector('.fd-accueil .fd-carte', { timeout: 15000 });
  assert.ok(await m.page.evaluate(() => document.querySelector('.home-col').firstElementChild.classList.contains('fd-accueil')), 'tout en haut de l’accueil');
  assert.equal(await m.page.locator('.fd-accueil .fd-carte').count(), 2);
  assert.match(await m.page.locator('.fd-accueil .fd-carte').first().innerText(), /Abderrahman Hajeb[\s\S]*C’est toi/);
  assert.match(await m.page.locator('.fd-accueil .fd-places').innerText(), /23 places de membre fondateur restantes sur 25/);
  assert.equal(await m.page.locator('.fd-accueil .btn.primary').count(), 0);
  // La fête, puis la question
  await m.page.waitForSelector('.fete-back', { timeout: 8000 });
  assert.match(await m.page.locator('.fete').innerText(), /Tu es Membre fondateur ![\s\S]*25 premiers lauréats à aider les étudiants/);
  await m.page.keyboard.press('Escape');
  await m.page.waitForSelector('.modal.fd-feuille', { timeout: 8000 });
  assert.match(await m.page.locator('.modal.fd-feuille').innerText(), /Ton nom et ta photo peuvent apparaître en haut de la page d’entrée, pour donner envie aux autres/);
  await m.page.click('#fd-oui');
  await m.page.waitForSelector('.modal.fd-feuille', { state: 'detached' });
  const envoi = site.appels.find(a => a.u === '/sb/rest/v1/profiles' && a.m === 'PATCH');
  assert.deepEqual(envoi?.corps, { fondateur_public: true });
  // Mon profil : la même question, à changer quand on veut
  await m.page.evaluate(() => { location.hash = 'profil'; });
  await m.page.waitForSelector('#md-fondateur');
  assert.ok(await m.page.isChecked('#md-fondateur'));
  await m.page.click('#md-fondateur'); await m.page.waitForTimeout(400);
  assert.deepEqual(site.appels.filter(a => a.u === '/sb/rest/v1/profiles' && a.m === 'PATCH').at(-1).corps, { fondateur_public: false });
  assert.equal(await m.page.isChecked('#md-fondateur'), false);
  // Une seule fois : de retour à l'accueil, plus de fête ni de question
  await m.page.evaluate(() => { location.hash = 'accueil'; }); await m.page.waitForTimeout(3000);
  assert.equal(await m.page.locator('.fete-back, .modal.fd-feuille').count(), 0);
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('base pas encore à jour : l’accueil d’un membre s’ouvre, les fondateurs calculés depuis les offres lisibles, sans question', async () => {
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  const m = await membre();
  await m.page.waitForSelector('.hello', { timeout: 15000 }); await m.page.waitForTimeout(2500);
  assert.ok(site.appels.some(a => a.u === '/sb/rest/v1/rpc/fondateurs_publics'), 'demandé, absent (404)');
  assert.deepEqual(await m.page.$$eval('.fd-accueil .fd-nom-t', x => x.map(e => e.textContent)), ['Hajar Lauréate'], 'la lauréate qui a publié l’offre');
  assert.match(await m.page.locator('.fd-accueil .fd-places').innerText(), /24 places de membre fondateur restantes sur 25/);
  assert.doesNotMatch(await m.page.locator('.fd-accueil').innerText(), /points?\b/i, 'jamais de points pour une étudiante');
  assert.equal(await m.page.locator('.modal.fd-feuille, .fete-back').count(), 0);
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

// ---------------------------------------------------------------------------
// Ambassadeurs de promo (en ligne) : la base propose, le membre accepte ; base pas encore à jour : rien ne casse
// ---------------------------------------------------------------------------
test('ambassadeur de promo en ligne : la proposition sur l’accueil, « Accepter », puis le lien et les chiffres de la promo', async () => {
  const now = new Date().toISOString();
  ambFaux = [{ id: 'a0000000-0000-4000-8000-000000000001', promo: S + 1, filiere: 'Génie Industriel', user_id: UID, statut: 'propose', par: 'auto', propose_at: now, repondu_at: null, created_at: now }];
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  const m = await membre();
  await m.page.waitForSelector('[data-pas^="am"], #amb-proposition', { timeout: 15000 });
  await m.page.waitForTimeout(1500);
  assert.ok(site.appels.some(a => a.u === '/sb/rest/v1/rpc/ambassadeurs_proposer'), 'la base est appelée à l’ouverture');
  if (await m.page.$('.fete-back')) { await m.page.keyboard.press('Escape'); await m.page.waitForTimeout(300); }
  assert.match(await m.page.locator('[data-pas^="am"], #amb-proposition').first().innerText(), new RegExp(`Deviens ambassadeur de ta promo \\(.+ ${S + 1}\\)`));
  const bouton = (await m.page.$('[data-pas^="am"] .pas-go')) ? '[data-pas^="am"] .pas-go' : '#amb-accepter';
  await m.page.click(bouton);
  await m.page.waitForSelector('.fete-back', { timeout: 8000 });
  assert.match(await m.page.locator('.fete').innerText(), /Merci, ambassadeur de ta promo !/);
  assert.deepEqual(site.appels.find(a => a.u === '/sb/rest/v1/ambassadeurs' && a.m === 'PATCH')?.corps, { statut: 'accepte' });
  await m.page.keyboard.press('Escape');
  await m.page.waitForSelector('#amb-carte');
  const t = await m.page.locator('#amb-carte').innerText();
  assert.match(t, /12\s*inscrits\s*\+3 ce mois-ci/);
  assert.match(t, /4\s*stages et emplois trouvés/);
  assert.match(await m.page.getAttribute('#amb-wa', 'href'), /^https:\/\/wa\.me\/\?text=.*promo/);
  assert.equal(await m.page.locator('#amb-carte .btn.primary').count(), 0, 'pas de bouton plein en plus');
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('ambassadeurs, base pas encore à jour : l’accueil s’ouvre, rien de cassé', async () => {
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  const m = await membre();
  await m.page.waitForSelector('.hello', { timeout: 15000 }); await m.page.waitForTimeout(2500);
  assert.equal(await m.page.locator('#amb-carte, #amb-proposition, [data-pas^="am"]').count(), 0);
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

// Lot mouvement · C : ouverture instantanée (données gardées sur l'appareil), forme de l'accueil au tout premier
// chargement, session qui expire (bug d'un membre sur Android 10) et brouillons gardés.
// exp : secondes avant l'expiration écrite dans le jeton (ce que la base vérifie) ; expiresAt : celle que Supabase garde
// sur l'appareil (une horloge de téléphone décalée les fait diverger)
async function connecte({ hash = '', langue = 'fr', theme = 'light', exp = 7200, expiresAt = exp, avant, attendre = '.me-btn' } = {}) {
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: theme });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  if (avant) await avant(ctx);
  await ctx.addInitScript(([uid, langue, exp, expiresAt]) => {
    if (sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init', '1');
    localStorage.setItem('ensam-lang', langue);
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'x.' + btoa(JSON.stringify({ sub: uid, exp: now + exp })) + '.y', token_type: 'bearer', expires_in: 7200, expires_at: now + expiresAt, refresh_token: 'r', user: { id: uid, aud: 'authenticated', email: 'membre@exemple.ma', user_metadata: {}, app_metadata: {} } }));
  }, [UID, langue, exp, expiresAt]);
  const page = await ctx.newPage(); const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto(site.adresse + hash);
  if (attendre) await page.waitForSelector(attendre, { timeout: 15000 });
  return { ctx, page, erreurs };
}
const ACCUEIL = '.shell:not(.squelette) .home-grid';
const lireCacheMembre = page => page.evaluate(() => new Promise(ok => {
  const r = indexedDB.open('ensam', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('cache');
  r.onsuccess = () => { try { const g = r.result.transaction('cache').objectStore('cache').get('membre'); g.onsuccess = () => { ok(g.result || null); r.result.close(); }; g.onerror = () => ok(null); } catch { ok(null); } };
  r.onerror = () => ok(null);
}));
const brouillons = page => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('ensam-brouillon:')));
const EN_CONTACT = () => [{ id: '5c1d2e3f-4a5b-4c6d-8e7f-8a9b0c1d2e3f', student_id: UID, mentor_id: AUTEUR, status: 'acceptee', sujet: 'Préparer mon PFE', created_at: '2026-10-02T10:00:00Z' }];

test('jeton refusé par la base (horloge du téléphone décalée) : renouvelé une seule fois, chaque requête refaite, l’accueil arrive', async () => {
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  site.jetons.renouveler = true;
  const m = await connecte({ exp: -60, expiresAt: 7200 });
  await m.page.waitForSelector(ACCUEIL, { timeout: 15000 });
  const renouvellements = site.appels.filter(a => a.u === '/sb/auth/v1/token');
  assert.equal(renouvellements.length, 1, 'un seul renouvellement pour toutes les requêtes refusées');
  const refusees = site.appels.filter(a => a.refuse);
  assert.ok(refusees.length >= 1, 'la base a d’abord refusé le jeton');
  for (const a of refusees) assert.ok(site.appels.some(b => b.u === a.u && b.m === a.m && !b.refuse && site.appels.indexOf(b) > site.appels.indexOf(a)), `${a.u} refaite`);
  assert.ok(site.appels.slice(site.appels.indexOf(renouvellements[0])).every(a => !a.refuse), 'plus aucun refus après le renouvellement');
  assert.ok(site.appels.some(a => /\/sb\/rest\/v1\/profil/.test(a.u) && !a.refuse), 'les profils sont arrivés');
  assert.equal(await m.page.locator('#entree .entree-form').count(), 0, 'aucune page de connexion');
  assert.notEqual(await m.page.evaluate(() => JSON.parse(localStorage.getItem('sb-127-auth-token')).refresh_token), 'r', 'la nouvelle session est gardée');
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

for (const langue of ['fr', 'ar']) {
  test(`session trop ancienne à l’ouverture (renouvellement refusé, ${langue}) : la connexion redemandée calmement, l’adresse déjà là`, async () => {
    site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
    const m = await connecte({ langue, exp: -3600, expiresAt: -3600, attendre: '#entree #au-session' });
    assert.equal(await m.page.locator('#au-session').innerText(), langue === 'fr' ? 'Ta session a expiré. Reconnecte-toi pour continuer.' : 'انتهت جلستك. سجّل الدخول من جديد للمتابعة.');
    assert.equal(await m.page.inputValue('#au-email'), 'membre@exemple.ma');
    assert.equal(await m.page.locator('#au-je-etudiant').count(), 0, 'se connecter, pas créer un compte');
    assert.equal(await m.page.locator('.auth-msg.err').count(), 0, 'pas un message d’erreur');
    if (langue === 'ar') {
      assert.equal(await m.page.getAttribute('html', 'dir'), 'rtl');
      assert.deepEqual(await m.page.evaluate(() => [...(window.__ensamMissing || [])]), []);
    }
    assert.deepEqual(await axe(m.page, '#entree'), []);
    assert.deepEqual(m.erreurs, []);
    await m.ctx.close();
  });
}

test('session perdue en écrivant un message (Android au réveil, renouvellement refusé) : reconnexion calme, le message rendu tel quel', async () => {
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  site.tables.mentorships = EN_CONTACT();
  const m = await connecte({ hash: '#messages/' + AUTEUR, attendre: '#chat-txt' });
  await m.page.fill('#chat-txt', 'Bonjour Hajar, je voulais te demander');
  // Le téléphone sort de veille : la session expire dans moins de deux minutes, elle est renouvelée tout de suite… et refusée
  await m.page.evaluate(() => {
    const k = 'sb-127-auth-token', s = JSON.parse(localStorage.getItem(k));
    s.expires_at = Math.floor(Date.now() / 1000) + 30; localStorage.setItem(k, JSON.stringify(s));
    dispatchEvent(new Event('focus'));
  });
  await m.page.waitForSelector('#entree #au-session', { timeout: 15000 });
  assert.ok(site.appels.some(a => a.u === '/sb/auth/v1/token'), 'le renouvellement est parti au réveil');
  assert.equal(await m.page.locator('#au-session').innerText(), 'Ta session a expiré. Reconnecte-toi : ce que tu étais en train d’écrire est gardé.');
  assert.equal(await m.page.inputValue('#au-email'), 'membre@exemple.ma');
  assert.equal((await brouillons(m.page)).length, 1, 'le brouillon reste sur l’appareil');
  await m.page.click('.entree-form button.btn.primary'); await m.page.waitForSelector('#au-code');
  await m.page.fill('#au-code', '123456');
  await m.page.waitForSelector('#chat-txt', { timeout: 15000 });
  assert.equal(await m.page.evaluate(() => location.hash), '#messages/' + AUTEUR);
  assert.equal(await m.page.inputValue('#chat-txt'), 'Bonjour Hajar, je voulais te demander');
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('message envoyé avec un jeton refusé et un renouvellement refusé : il reste, marqué « pas parti », et revient après la reconnexion', async () => {
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  site.tables.mentorships = EN_CONTACT();
  const m = await connecte({ hash: '#messages/' + AUTEUR, attendre: '#chat-txt' });
  site.jetons.depuis = Math.floor(Date.now() / 1000) + 1; // la base ne reconnaît plus ce jeton (révoqué, horloge…)
  await m.page.waitForTimeout(1100);
  await m.page.fill('#chat-txt', 'Je t’envoie mon CV ce soir.');
  await m.page.click('.composer .send-btn');
  await m.page.waitForSelector('#entree #au-session', { timeout: 15000 });
  assert.ok(!site.appels.some(a => a.u === '/sb/rest/v1/messages' && a.m === 'POST' && !a.refuse), 'rien n’est parti');
  await m.page.click('.entree-form button.btn.primary'); await m.page.waitForSelector('#au-code');
  await m.page.fill('#au-code', '123456');
  await m.page.waitForSelector('#chat-txt', { timeout: 15000 });
  assert.match(await m.page.locator('.msg.mine').last().innerText(), /Je t’envoie mon CV ce soir\./, 'le message n’est pas perdu');
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('membre revenu : l’accueil s’ouvre depuis l’appareil avant la réponse de la base, la mise à jour arrive sans bruit ; jamais pour un autre compte', async () => {
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  site.tables.coordonnees = [{ id: UID, telephone: '0612345678' }, { id: AUTEUR, telephone: '0698765432' }];
  let tenir = false; const tenus = [];
  const m = await connecte({ avant: ctx => ctx.route(/\/sb\/rest\/v1\//, r => (tenir ? tenus.push(r) : r.continue())) });
  await m.page.waitForSelector(ACCUEIL);
  let c = null;
  for (let i = 0; i < 40 && !c; i++) { await m.page.waitForTimeout(250); c = await lireCacheMembre(m.page); }
  assert.ok(c, 'une copie de l’accueil est gardée');
  assert.equal(c.uid, UID);
  assert.deepEqual(c.data.coordonnees.map(x => x.id), [UID], 'jamais les coordonnées des autres');
  // Rechargée, la base ne répond pas encore : l'accueil est là quand même
  tenir = true;
  await m.page.reload();
  await m.page.waitForSelector(ACCUEIL, { timeout: 5000 });
  assert.ok(tenus.length > 0, 'la base n’a pas encore répondu');
  assert.equal(await m.page.locator('#entree .entree-form').count(), 0);
  tenir = false; for (const r of tenus.splice(0)) await r.continue();
  await m.page.waitForTimeout(1200);
  assert.equal(await m.page.locator('.toast').count(), 0, 'la mise à jour arrive sans message');
  assert.ok(await m.page.isVisible(ACCUEIL));
  // Une autre personne se connecte sur ce téléphone : la copie n'est jamais montrée, elle est effacée
  const AUTRE = '00000000-0000-4000-8000-0000000000c3';
  await m.page.evaluate(id => { const k = 'sb-127-auth-token', s = JSON.parse(localStorage.getItem(k)); s.user.id = id; localStorage.setItem(k, JSON.stringify(s)); }, AUTRE);
  tenir = true;
  await m.page.reload(); await m.page.waitForTimeout(1500);
  assert.equal(await m.page.locator(ACCUEIL).count(), 0, 'rien de l’autre compte');
  assert.equal(await lireCacheMembre(m.page), null, 'la copie est effacée');
  tenir = false; for (const r of tenus.splice(0)) await r.continue();
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('se déconnecter soi-même : la copie de l’accueil et les brouillons de ce compte sont effacés', async () => {
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  site.tables.mentorships = EN_CONTACT();
  const m = await connecte({ hash: '#messages/' + AUTEUR, attendre: '#chat-txt' });
  await m.page.fill('#chat-txt', 'Un mot pas encore envoyé');
  let c = null;
  for (let i = 0; i < 40 && !c; i++) { await m.page.waitForTimeout(250); c = await lireCacheMembre(m.page); }
  assert.ok(c); assert.equal((await brouillons(m.page)).length, 1);
  await m.page.evaluate(() => { location.hash = '#accueil'; }); await m.page.waitForSelector(ACCUEIL);
  await m.page.click('.me-btn'); await m.page.click('.menu-pop button:has-text("Se déconnecter")');
  await m.page.waitForSelector('#entree .entree-form', { timeout: 15000 });
  assert.equal(await m.page.locator('#au-session').count(), 0, 'déconnexion voulue : pas de « session expirée »');
  assert.deepEqual(await brouillons(m.page), []);
  assert.equal(await lireCacheMembre(m.page), null);
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

for (const [langue, theme] of [['fr', 'light'], ['ar', 'dark']]) {
  test(`tout premier chargement d’un membre (${langue}, ${theme}) : la forme de l’accueil à sa taille, pas le logo`, async () => {
    site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
    let tenir = true; const tenus = [];
    const m = await connecte({ langue, theme, attendre: '#app .shell.squelette', avant: ctx => ctx.route(/\/sb\/rest\/v1\//, r => (tenir ? tenus.push(r) : r.continue())) });
    assert.equal(await m.page.locator('#app .boot').count(), 0, 'plus de logo qui attend');
    assert.equal(await m.page.getAttribute('html', 'dir'), langue === 'ar' ? 'rtl' : 'ltr');
    assert.ok(await m.page.isVisible('.shell.squelette .bottom-nav'), 'la barre du bas, à sa place');
    assert.ok((await m.page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
    const fond = await m.page.evaluate(() => getComputedStyle(document.body).backgroundColor.match(/\d+/g).slice(0, 3).map(Number));
    assert.ok(theme === 'dark' ? fond.every(x => x < 80) : fond.every(x => x > 200), `fond ${fond}`);
    assert.equal(await m.page.locator('.shell.squelette [role="status"]').count(), 1, 'dit aux lecteurs d’écran que ça charge');
    tenir = false; for (const r of tenus.splice(0)) await r.continue();
    await m.page.waitForSelector(ACCUEIL, { timeout: 15000 });
    assert.equal(await m.page.locator('.shell.squelette').count(), 0);
    // Seuls les prénoms des membres restent tels quels
    if (langue === 'ar') assert.deepEqual(await m.page.evaluate(() => [...(window.__ensamMissing || [])].filter(x => !['Salma', 'Hajar'].includes(x))), []);
    assert.deepEqual(m.erreurs, []);
    await m.ctx.close();
  });
}
