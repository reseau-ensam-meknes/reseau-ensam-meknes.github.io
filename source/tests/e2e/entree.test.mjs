// Le site « en ligne » vu par un visiteur sans compte (faux Supabase local) : page d'entrée, code à 6 chiffres,
// « Dernière étape », lien d'invitation d'une promo et lien d'une offre partagée sur WhatsApp
import { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { fauxSite, UID } from './faux-supabase.mjs';
import { autoGroups } from '../../src/logic.js';
// test : celui de node:test, sauf sur la CI où chaque machine n'en déclare qu'une part (PARTIE, partie.mjs)
import { test } from './partie.mjs';

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

// langue: null = un visiteur qui n'a jamais choisi de langue ; avant(ctx) : réseau à régler avant la première visite ;
// ua : l'appareil (le navigateur d'une application, par exemple) ;
// sw : le service worker est permis (l'application gardée sur l'appareil, les nouvelles versions)
async function visiteur({ largeur = 360, hauteur = 640, langue = 'fr', hash = '', query = '', stockage = {}, avant, ua, sw = false } = {}) {
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, serviceWorkers: sw ? 'allow' : 'block', reducedMotion: 'reduce', ...(ua ? { userAgent: ua } : {}) });
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
  await page.click('.me-btn'); await page.click('.modal.moi button:has-text("Se déconnecter")');
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
// à la demande du navigateur, qui arrive après « delai » millisecondes ; les demandes sont comptées (window.__demandes) ;
// langue : celle choisie sur cet appareil ; largeur : celle de l'écran (390 px : un téléphone)
async function membre({ hash = '', push = false, permission = 'default', delai = 0, langue = 'fr', largeur = 390 } = {}) {
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
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
  await ctx.addInitScript(([uid, langue]) => {
    if (sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init', '1');
    localStorage.setItem('ensam-lang', langue);
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'x.' + btoa(JSON.stringify({ sub: uid, exp: now + 7200 })) + '.y', token_type: 'bearer', expires_in: 7200, expires_at: now + 7200, refresh_token: 'r', user: { id: uid, aud: 'authenticated', email: 'membre@exemple.ma', user_metadata: {}, app_metadata: {} } }));
  }, [UID, langue]);
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
    const m = await membre({ hash: '#profil/notifications' });
    await m.page.waitForSelector('#md-push', { timeout: 15000 });
    assert.equal(await m.page.locator('.md-cats').count(), colonne ? 1 : 0, 'les cases par catégorie');
    assert.equal(await m.page.locator('#md-alertes').count(), colonne ? 0 : 1, 'avant la mise à jour, l’étudiant garde sa case « M’alerter… »');
    // Avant, la présentation d'avant : « M'alerter… » (le téléphone) ne se range pas sous un titre « Par email »
    assert.equal(await m.page.locator('#profil-notifications .md-titre').count(), colonne ? 1 : 0, 'le titre « Par email »');
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
  // Dans Mon profil, la même réponse laisse « Activer » à toucher, sans dire que les notifications sont bloquées
  await m.page.evaluate(() => { location.hash = '#profil/notifications'; });
  await m.page.waitForSelector('#md-push-oui:not([disabled])', { timeout: 15000 });
  await m.page.click('#md-push-oui'); await m.page.waitForTimeout(500);
  assert.equal(await m.page.isDisabled('#md-push-oui'), false);
  assert.equal(await m.page.locator('#md-push-ok').count(), 0);
  assert.doesNotMatch(await m.page.locator('#md-push .push-etat').innerText(), /bloquées/);
  assert.equal((await lire(m)).fait, undefined);
  assert.equal(await m.page.evaluate(() => window.__demandes), 1, 'depuis le rechargement : le toucher dans Mon profil a demandé');
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('Mon profil : pendant la demande du navigateur lancée par « Activer », pas de feuille d’ouverture par-dessus', async () => {
  site.vider(); site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z', notif_push: {} });
  const m = await membre({ hash: '#profil/notifications', push: true, permission: 'granted', delai: 7000 });
  await m.page.waitForSelector('#md-push-oui:not([disabled])', { timeout: 15000 });
  await m.page.click('#md-push-oui');
  await m.page.waitForTimeout(8500);
  assert.equal(await m.page.locator('.modal.ouverture').count(), 0, 'une seule demande à la fois');
  assert.match(await m.page.locator('#md-push-ok').innerText(), /Activées sur cet appareil/);
  assert.ok(await m.page.isVisible('#md-push-test'), '« Tester » une fois activées');
  assert.ok(await m.page.isVisible('#md-push-non'));
  assert.equal(await m.page.evaluate(() => window.__demandes), 1);
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('Mon profil ouvert : après « Activer » sur la feuille, la carte de cet appareil suit', async () => {
  site.vider(); site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z', notif_push: {} });
  const m = await membre({ hash: '#profil/notifications', push: true, permission: 'denied' });
  await m.page.waitForSelector('.modal.ouverture', { timeout: 12000 });
  assert.equal(await m.page.isDisabled('#md-push-oui'), false);
  await m.page.click('#ouv-oui'); await m.page.waitForTimeout(800);
  assert.equal(await m.page.locator('#md-push-oui').count(), 0, 'refusée : plus de bouton « Activer »');
  assert.match(await m.page.locator('#md-push .push-etat').innerText(), /bloquées pour ce site/, 'refusée : la carte le dit');
  assert.ok(await m.page.isVisible('#md-push-debloquer'), 'et dit comment les débloquer');
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('Mon profil en ligne : « Visible par les lauréats » écrit la Vitrine, et Match seulement quand la base a la colonne match_visible', async () => {
  for (const colonne of [false, true]) {
    site.vider(); site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z', notif_push: {}, vitrine: false, ...(colonne ? { match_visible: true } : {}) });
    const m = await membre({ hash: '#profil/visibilite' });
    await m.page.waitForSelector('#pf-visible', { state: 'attached', timeout: 15000 });
    // Allumé si l'un des deux l'est : avec la colonne, Match l'est encore
    assert.equal(await m.page.isChecked('#pf-visible'), colonne);
    await m.page.locator('.pf-visible .mx-switch').click(); await m.page.waitForTimeout(600);
    const envoi = site.appels.filter(a => a.u === '/sb/rest/v1/profiles' && a.m === 'PATCH').at(-1);
    assert.deepEqual(envoi?.corps, colonne ? { vitrine: false, match_visible: false } : { vitrine: true });
    assert.equal(await m.page.isChecked('#pf-visible'), !colonne);
    assert.deepEqual(m.erreurs, []);
    await m.ctx.close();
  }
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
  assert.ok(await m.page.evaluate(() => {
    const f = document.querySelector('.fd-accueil'), apres = (a, b) => !!a && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    return f.parentElement.classList.contains('home-col') && apres(document.querySelector('.home .hello'), f) && apres(f, document.querySelector('.home-main'));
  }), 'sous le bonjour et « À faire », avant « Pour toi »');
  assert.equal(await m.page.locator('.fd-accueil .fd-carte').count(), 2);
  assert.match(await m.page.locator('.fd-accueil .fd-carte').first().innerText(), /Abderrahman Hajeb[\s\S]*\bToi\b/);
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
  await m.page.evaluate(() => { location.hash = 'profil/visibilite'; });
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
  await m.page.waitForSelector('[data-pas^="am"], .af-accueil .todo > li[data-cle^="am"]', { timeout: 15000 });
  await m.page.waitForTimeout(1500);
  assert.ok(site.appels.some(a => a.u === '/sb/rest/v1/rpc/ambassadeurs_proposer'), 'la base est appelée à l’ouverture');
  if (await m.page.$('.fete-back')) { await m.page.keyboard.press('Escape'); await m.page.waitForTimeout(300); }
  // Sur la carte « prochaine étape » ; sinon la ligne de « À faire » ouvre la feuille de la proposition
  if (!(await m.page.$('[data-pas^="am"]'))) { await m.page.click('.af-accueil .todo > li[data-cle^="am"] button'); await m.page.waitForSelector('.modal.amb-feuille #amb-proposition'); }
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
  assert.equal(await m.page.locator('#amb-carte, #amb-proposition, [data-pas^="am"], [data-cle^="am"]').count(), 0);
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
  // La base ne reconnaît plus ce jeton (révoqué, horloge…) au moment où le message lui arrive, pas avant : posé avant le
  // toucher, une lecture de fond (le second temps du chargement, jusqu'à 1,5 s après l'affichage) pouvait perdre la
  // session avant « Envoyer », et le bouton disparaissait sous le doigt. Les jetons émis à partir de cette seconde (la
  // reconnexion) restent bons.
  let perime = false;
  const avant = ctx => ctx.route(/\/sb\/rest\/v1\/messages(\?|$)/, r => {
    if (!perime && r.request().method() === 'POST') { perime = true; site.jetons.depuis = Math.floor(Date.now() / 1000); }
    return r.continue();
  });
  const m = await connecte({ hash: '#messages/' + AUTEUR, attendre: '#chat-txt', avant });
  await m.page.fill('#chat-txt', 'Je t’envoie mon CV ce soir.');
  await m.page.click('.composer .send-btn');
  await m.page.waitForSelector('#entree #au-session', { timeout: 15000 });
  assert.ok(perime, 'le message est arrivé à la base');
  assert.ok(site.appels.some(a => a.u === '/sb/rest/v1/messages' && a.m === 'POST' && a.refuse), 'la base l’a refusé');
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
  await m.page.click('.me-btn'); await m.page.click('.modal.moi button:has-text("Se déconnecter")');
  await m.page.waitForSelector('#entree .entree-form', { timeout: 15000 });
  assert.equal(await m.page.locator('#au-session').count(), 0, 'déconnexion voulue : pas de « session expirée »');
  assert.deepEqual(await brouillons(m.page), []);
  assert.equal(await lireCacheMembre(m.page), null);
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

// L'adresse que la carte « Ouvrir dans Chrome » construit porte l'étape (mode=inscription) : elle ne vaut que pour l'arrivée,
// jamais pour la page d'entrée qui revient plus tard dans la même visite (déconnexion, session perdue)
const ARRIVEE_CARTE = '?role=etudiant&mode=inscription';
async function arriveEtSeConnecte() {
  const s = await visiteur({ largeur: 390, hauteur: 844, query: ARRIVEE_CARTE });
  assert.ok(await s.page.isVisible('#au-je-etudiant'), 'l’arrivée ouvre bien « Créer mon compte »');
  await s.page.click('.entree-form button.linkish:has-text("J’ai déjà un compte")');
  await s.page.fill('#au-email', 'membre@exemple.ma');
  await s.page.click('.entree-form button.btn.primary'); await s.page.waitForSelector('#au-code');
  await s.page.fill('#au-code', '123456');
  await s.page.waitForSelector('.me-btn', { timeout: 15000 });
  return s;
}

test('arrivée par l’adresse de la carte (?mode=inscription), connexion, puis « Se déconnecter » : « Se connecter », pas « Créer mon compte »', async () => {
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  const s = await arriveEtSeConnecte();
  await s.page.click('.me-btn'); await s.page.click('.modal.moi button:has-text("Se déconnecter")');
  await s.page.waitForSelector('#entree .entree-form', { timeout: 15000 });
  assert.equal(await s.page.locator('#au-je-etudiant').count(), 0, 'pas « Créer mon compte » juste après une déconnexion');
  assert.equal(await s.page.locator('.entree-form h2').innerText(), 'Se connecter');
  assert.equal(await s.page.locator('#au-session').count(), 0, 'déconnexion voulue : pas de « session expirée »');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('arrivée par l’adresse de la carte (?mode=inscription) puis session perdue : « Ta session a expiré », l’adresse déjà là ; de même pour une session gardée trop ancienne', async () => {
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  const s = await arriveEtSeConnecte();
  // Le téléphone sort de veille : renouvellement refusé, la session est perdue sans l'avoir voulu
  await s.page.evaluate(() => {
    const k = 'sb-127-auth-token', x = JSON.parse(localStorage.getItem(k));
    x.expires_at = Math.floor(Date.now() / 1000) + 30; localStorage.setItem(k, JSON.stringify(x));
    dispatchEvent(new Event('focus'));
  });
  await s.page.waitForSelector('#entree #au-session', { timeout: 15000 });
  assert.equal(await s.page.locator('.entree-form h2').innerText(), 'Se connecter');
  assert.equal(await s.page.locator('#au-je-etudiant').count(), 0, 'se reconnecter, pas créer un compte');
  assert.equal(await s.page.inputValue('#au-email'), 'membre@exemple.ma');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
  // Un membre dont la session gardée est trop ancienne, ouvert sur la même adresse : la session perdue passe avant l'étape
  site.vider(); site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  const m = await connecte({ hash: ARRIVEE_CARTE, exp: -3600, expiresAt: -3600, attendre: '#entree .entree-form' });
  await m.page.waitForSelector('#entree #au-session', { timeout: 15000 });
  assert.equal(await m.page.inputValue('#au-email'), 'membre@exemple.ma');
  assert.equal(await m.page.locator('#au-je-etudiant').count(), 0);
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

// « Ouvrir dans Chrome » touché dans Instagram (Android), mais l'application ignore le lien : rien ne se recharge, on s'inscrit
// ici. Ce qui a été gardé au toucher (l'étape « Créer mon compte », pour l'adresse de secours) ne revient jamais sur la page
// d'entrée qui suit dans la visite (déconnexion, session perdue) : se reconnecter, pas créer un compte
const INSTAGRAM = 'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.122 Mobile Safari/537.36 Instagram 404.0.0.48.76 Android (34/14; 450dpi; 1080x2340; samsung; SM-A546B; a54x; s5e8835; fr_FR; 812345678)';
for (const fin of ['déconnexion', 'session perdue']) test(`Instagram, « Ouvrir dans Chrome » sans effet, inscription ici, puis ${fin} : « Se connecter »${fin === 'session perdue' ? ' et « Ta session a expiré »' : ''}, pas « Créer mon compte »`, async () => {
  const s = await visiteur({ largeur: 390, hauteur: 844, ua: INSTAGRAM });
  await s.page.waitForSelector('#au-appli');
  await s.page.click('#au-je-etudiant');
  await s.page.fill('#au-email', 'amine@ensam-umi.ac.ma');
  await s.page.evaluate(() => addEventListener('click', e => { if (e.target.closest?.('#au-appli-chrome')) e.preventDefault(); }, { capture: true, once: true }));
  await s.page.click('#au-appli-chrome');
  await s.page.check('#au-ok');
  await s.page.click('.entree-form button.btn.primary.wide'); await s.page.waitForSelector('#au-code');
  await s.page.fill('#au-code', '123456');
  await s.page.waitForSelector('.auth-card.wide.onb', { timeout: 15000 });
  await s.page.fill('#pf-name', 'Amine Alaoui'); await s.page.fill('#pf-promo', String(S + 1));
  await s.page.selectOption('#pf-fil', { index: 1 });
  await s.page.click('.pf-pied .btn');
  await s.page.waitForFunction(() => !document.querySelector('.auth-card.wide.onb'), null, { timeout: 15000 });
  await s.page.waitForSelector('.me-btn', { timeout: 15000 });
  assert.equal(await s.page.evaluate(() => sessionStorage.getItem('ensam-entree-saisie')), null, 'connecté : plus rien de la page d’entrée à reprendre');
  if (fin === 'déconnexion') {
    for (let i = 0; i < 4 && await s.page.locator('.modal').count(); i++) { await s.page.keyboard.press('Escape'); await s.page.waitForTimeout(200); }
    await s.page.click('.me-btn'); await s.page.click('.modal.moi button:has-text("Se déconnecter")');
    await s.page.waitForSelector('#entree .entree-form', { timeout: 15000 });
  } else {
    // Une saisie qui traînerait encore (par un autre chemin) : la session perdue passe avant son étape.
    // Puis le téléphone sort de veille : renouvellement refusé, la session est perdue sans l'avoir voulu
    await s.page.evaluate(() => {
      sessionStorage.setItem('ensam-entree-saisie', JSON.stringify({ email: 'amine@ensam-umi.ac.ma', mode: 'inscription', ok: false, mails: true, t: Date.now() }));
      const k = 'sb-127-auth-token', x = JSON.parse(localStorage.getItem(k));
      x.expires_at = Math.floor(Date.now() / 1000) + 30; localStorage.setItem(k, JSON.stringify(x));
      dispatchEvent(new Event('focus'));
    });
    await s.page.waitForSelector('#entree #au-session', { timeout: 15000 });
    assert.equal(await s.page.locator('#au-session').innerText(), 'Ta session a expiré. Reconnecte-toi pour continuer.');
    assert.equal(await s.page.inputValue('#au-email'), 'amine@ensam-umi.ac.ma', 'l’adresse déjà là');
  }
  assert.equal(await s.page.locator('.entree-form h2').innerText(), 'Se connecter');
  assert.equal(await s.page.locator('#au-je-etudiant').count(), 0, 'se reconnecter, pas créer un compte');
  assert.equal(await s.page.getAttribute('.entree-form', 'aria-label'), null);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
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
    // La barre du haut garde la forme de la vraie : messages, langue et cloche sur téléphone ; langue et cloche sur ordinateur
    const icones = () => m.page.locator('.shell.squelette .top .sq-icone:visible').count();
    assert.equal(await icones(), 3, 'téléphone');
    await m.page.setViewportSize({ width: 1280, height: 800 });
    assert.equal(await icones(), 2, 'ordinateur');
    await m.page.setViewportSize({ width: 390, height: 844 });
    tenir = false; for (const r of tenus.splice(0)) await r.continue();
    await m.page.waitForSelector(ACCUEIL, { timeout: 15000 });
    assert.equal(await m.page.locator('.shell.squelette').count(), 0);
    const vraies = () => m.page.locator('.shell .top > .icon-btn:visible, .shell .top > .lang-btn:visible').count();
    assert.equal(await vraies(), 3, 'la vraie barre, sur téléphone');
    await m.page.setViewportSize({ width: 1280, height: 800 });
    assert.equal(await vraies(), 2, 'la vraie barre, sur ordinateur');
    // Seuls les prénoms des membres restent tels quels
    if (langue === 'ar') assert.deepEqual(await m.page.evaluate(() => [...(window.__ensamMissing || [])].filter(x => !['Salma', 'Hajar'].includes(x))), []);
    assert.deepEqual(m.erreurs, []);
    await m.ctx.close();
  });
}

// ---------------------------------------------------------------------------
// Plan · vitesse et ambiance (lot plan-vitesse) : page d'entrée plus légère (le magasin et l'application partent au
// premier geste ou une fois la page calme, l'illustration juste après le formulaire, la page ne garde que le CSS de l'entrée,
// tiré au build du CSS complet), et les données en deux temps (l'accueil d'abord ; les messages des groupes, les réactions et
// les commentaires de relecture juste après le premier affichage ; un écran qui les lit les attend)
// ---------------------------------------------------------------------------
// Le CSS complet du site construit (lu à la demande : sans site construit, before() le dit d'abord)
const siteCss = () => fs.readFileSync(path.join(SITE, 'site.css'), 'utf8');

// Un visiteur dont les polices (ou autre chose) restent en route : la page n'est jamais « chargée », ni calme
// (cssVu : l'appareil a déjà appliqué le CSS complet de cette version, comme après une déconnexion)
async function visiteLegere({ query = '', retenir = /\.woff2$/, largeur = 390, hauteur = 844, langue = 'fr', cssVu = false } = {}) {
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const js = [], css = [], tenus = []; let tenir = true;
  ctx.on('request', q => { const u = new URL(q.url()); if (/\.m?js$/.test(u.pathname)) js.push(u.pathname.slice(1)); else if (u.pathname === '/site.css') css.push(q.url()); });
  if (retenir) await ctx.route(retenir, r => (tenir ? tenus.push(r) : r.continue()));
  const vu = cssVu ? fs.readFileSync(path.join(SITE, 'index.html'), 'utf8').match(/window\.ENSAM_CSS='([^']+)'/)[1] : null;
  await ctx.addInitScript(([l, vu]) => { if (!sessionStorage.getItem('__init')) { sessionStorage.setItem('__init', '1'); localStorage.setItem('ensam-lang', l); if (vu) localStorage.setItem('ensam-css', vu); } }, [langue, vu]);
  const page = await ctx.newPage(), erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto(site.adresse + query, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#entree .entree-form');
  const lacher = async () => { tenir = false; for (const r of tenus.splice(0)) await r.continue().catch(() => {}); };
  const app = () => page.waitForFunction(() => window.ENSAM_APP, null, { timeout: 15000 });
  return { ctx, page, erreurs, js, css, tenus, lacher, app };
}
const parti =(page, re) => page.waitForFunction(re => performance.getEntriesByType('resource').some(e => new RegExp(re).test(e.name)), re.source, { timeout: 5000 });

test('page d’entrée plus légère : avant un geste, ni le magasin ni l’application (10 fichiers JS, 10 au plus, contre 13 avant) ; au premier toucher, ils partent', async () => {
  // Même sur un appareil qui a déjà reçu le CSS complet (un membre déconnecté) : rien ne le précharge pour un visiteur
  const v = await visiteLegere({ cssVu: true });
  await v.page.waitForTimeout(2500);
  const { magasin, modules } = await v.page.evaluate(() => ({ magasin: window.ENSAM_MAGASIN || [], modules: window.ENSAM_MODULES || [] }));
  assert.ok(magasin.includes('store.js') && modules.includes('app.js'), 'les listes du magasin et de l’application (site construit)');
  // Seuls les modules de l'entrée (préchargés), config.js, l'illustration, la rangée des fondateurs, la reconnaissance du
  // navigateur d'une application (appareil.js, sa carte : portes #59) et ce que les membres ont accepté de montrer
  // (entree-vitrine.js : plan, partie membres) ; jamais le magasin ni l'application (fondateurs-public.js et scene.js servent
  // aussi à l'application, appareil.js au magasin par logic.js, et entree-vitrine.js, que l'entrée charge ensuite, est
  // préchargé avec l'application d'un membre : l'entrée les charge à part).
  // Mesuré : 10 fichiers JS (8 avant appareil.js et entree-vitrine.js) ; 10 au plus (main en demandait 13 dans les mêmes conditions).
  const avantGeste = [...v.js];
  const deTrop = avantGeste.filter(f => [...magasin, ...modules].includes(f) && !['scene.js', 'fondateurs-public.js', 'appareil.js', 'entree-vitrine.js'].includes(f));
  assert.deepEqual(deTrop, [], `avant un geste : ${avantGeste.join(', ')}`);
  assert.ok(avantGeste.length <= 10, `${avantGeste.length} fichiers JS avant un geste : ${avantGeste.join(', ')}`);
  assert.ok(avantGeste.includes('scene.js'), 'l’illustration arrive juste après le formulaire');
  await v.page.waitForSelector('#entree .entree-scene .scene svg');
  assert.equal(await v.page.evaluate(() => typeof window.ENSAM_APP), 'undefined');
  assert.equal(await v.page.locator('link[data-css="site"]').count(), 0, 'le CSS complet attend l’application');
  assert.deepEqual(v.css, [], 'ni demandé ni préchargé avant un geste');
  // Premier geste : le magasin part aussitôt, puis l'application ; la page marche comme avant
  await v.page.click('#au-je-etudiant');
  await parti(v.page, /\/store\.js$/);
  await v.lacher();
  await v.app();
  // Le toucher qui a fait partir le magasin a aussi fait son travail : le rôle est choisi
  assert.equal(await v.page.getAttribute('#au-je-etudiant', 'aria-pressed'), 'true');
  // Le CSS complet est arrivé avec l'application, et celui de l'entrée est parti (rien en double)
  assert.equal(await v.page.locator('link[data-css="site"]').count(), 1);
  assert.equal(await v.page.locator('#css-entree').count(), 0);
  assert.ok((await v.page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
  assert.deepEqual(v.erreurs, []);
  await v.ctx.close();
});

test('page d’entrée plus légère : sans geste, le magasin part une fois la page chargée et calme ; un lien d’appareil (?notifs=1) le fait partir tout de suite', async () => {
  const v = await visiteur({ largeur: 390, hauteur: 844 });
  await v.app();
  const t = await v.page.evaluate(() => ({ charge: performance.getEntriesByType('navigation')[0].loadEventEnd, magasin: performance.getEntriesByType('resource').find(e => /\/store\.js$/.test(e.name))?.startTime }));
  assert.ok(t.magasin >= t.charge + 800, `le magasin après la page calme (chargée à ${Math.round(t.charge)} ms, magasin à ${Math.round(t.magasin)} ms)`);
  assert.deepEqual(v.erreurs, []);
  await v.ctx.close();
  // ?notifs=1 (lien d'une notification) : l'application lit l'adresse, le magasin part tout de suite, même page pas chargée
  const n = await visiteLegere({ query: '?notifs=1' });
  await parti(n.page, /\/store\.js$/);
  await n.lacher();
  assert.deepEqual(n.erreurs, []);
  await n.ctx.close();
});

// Le CSS de l'entrée (dans la page) face au CSS complet (site.css) : chaque élément, chaque propriété calculée, pseudo-éléments
// compris, doit être pareil avec l'un ou l'autre. Le CSS complet est retenu (jamais servi, sans échec : un échec ferait
// recharger la page d'un membre) pour voir la page sans lui.
const stylesCalcules = page => page.evaluate(() => {
  const out = {};
  const els = [document.documentElement, ...document.querySelectorAll('body, body *')].filter(e => !e.closest('svg') || e.tagName.toLowerCase() === 'svg');
  els.forEach((e, i) => {
    const id = i + ':' + e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : '');
    for (const pseudo of [null, '::before', '::after', '::placeholder', '::marker']) {
      const st = getComputedStyle(e, pseudo);
      if ((pseudo === '::before' || pseudo === '::after') && st.content === 'none') continue;
      const o = {}; for (let k = 0; k < st.length; k++) { const p = st[k]; if (!/^(transition|animation)/.test(p)) o[p] = st.getPropertyValue(p); }
      out[id + (pseudo || '')] = o;
    }
  });
  return out;
});
async function memesStyles(nom, { largeur = 390, hauteur = 844, langue = 'fr', theme = 'light', query = '', jeton = false, ua, faire } = {}) {
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: theme, ...(ua ? { userAgent: ua } : {}) });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await ctx.route(/\/site\.css/, () => {});
  await ctx.addInitScript(([langue, jeton, uid]) => {
    if (sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init', '1');
    localStorage.setItem('ensam-lang', langue);
    if (jeton) { const now = Math.floor(Date.now() / 1000); localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'x.' + btoa(JSON.stringify({ sub: uid, exp: now + 3600 })) + '.y', refresh_token: 'r', expires_at: now + 3600, expires_in: 3600, token_type: 'bearer', user: { id: uid, email: 'membre@exemple.ma' } })); }
  }, [langue, jeton, UID]);
  const page = await ctx.newPage();
  await page.goto(site.adresse + query, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(jeton ? '.shell.squelette' : '#entree .entree-form');
  if (faire) await faire(page);
  await page.waitForTimeout(1200);
  const seul = await stylesCalcules(page);
  await page.evaluate(css => { const s = document.createElement('style'); s.textContent = css; const e = document.getElementById('css-entree'); e.after(s); e.remove(); }, siteCss());
  await page.waitForTimeout(200);
  const complet = await stylesCalcules(page);
  const diffs = [];
  for (const k of Object.keys(complet)) { if (!seul[k]) { diffs.push(`${k} : absent sans le CSS complet`); continue; } for (const p of Object.keys(complet[k])) if (seul[k][p] !== complet[k][p]) diffs.push(`${k} { ${p}: ${seul[k][p]} → ${complet[k][p]} }`); }
  assert.ok(Object.keys(complet).length > 30, `${nom} : ${Object.keys(complet).length} éléments`);
  assert.deepEqual(diffs.slice(0, 8), [], `${nom} : ${diffs.length} différences`);
  await ctx.close();
}
// La carte du navigateur d'une application (portes, #59) : son propre style arrive avec appareil.js ; ses boutons, son lien et
// son icône prennent celui de la page (Instagram sur Android, Facebook sur iPhone)
const FACEBOOK_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/490.0.0.38.107;FBBV/700000000;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/18.6;FBSS/3;FBCR/;FBID/phone;FBLC/fr_FR;FBOP/80]';
test('page d’entrée plus légère : son CSS seul donne exactement les styles du CSS complet (formulaire, fondateurs, code, erreur, promo, arabe sombre, forme de l’accueil, carte du navigateur d’une application)', async () => {
  // Bien plus petit que le CSS complet, et tiré de lui au build (outils/css-critique.mjs)
  const page = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  const entree = page.match(/<style id="css-entree">([\s\S]*?)<\/style>/)?.[1] || '';
  assert.ok(entree.length > 10000 && entree.length < siteCss().length * 0.35, `CSS de l’entrée ${entree.length} octets, complet ${siteCss().length}`);
  assert.match(page, /window\.ENSAM_CSS='site\.css\?v=[0-9a-f]{10}'/);
  fondateursFaux = reponse();
  await memesStyles('visiteur, fondateurs', { faire: p => p.waitForSelector('.fd-public .fd-carte') });
  fondateursFaux = null;
  await memesStyles('arabe, sombre, ordinateur', { langue: 'ar', theme: 'dark', largeur: 1280, hauteur: 900 });
  await memesStyles('code', { faire: async p => { await p.click('#au-je-etudiant'); await p.fill('#au-email', 'amine@ensam-umi.ac.ma'); await p.check('#au-ok'); await p.click('.entree-form button.btn.primary'); await p.waitForSelector('#au-code'); } });
  await memesStyles('erreur', { faire: async p => { await p.click('#au-je-etudiant'); await p.fill('#au-email', 'vite@exemple.ma'); await p.check('#au-ok'); await p.click('.entree-form button.btn.primary'); await p.waitForSelector('.auth-msg'); } });
  await memesStyles('promo, mot de passe', { query: '?promo=2019', faire: async p => { await p.click('text=J’ai déjà un compte'); await p.click('#au-mdp'); } });
  await memesStyles('forme de l’accueil (membre)', { jeton: true });
  await memesStyles('forme de l’accueil (membre, arabe, ordinateur)', { jeton: true, langue: 'ar', largeur: 1280, hauteur: 900 });
  await memesStyles('navigateur d’une application (Android) : la carte', { ua: INSTAGRAM, faire: p => p.waitForSelector('#au-appli[data-systeme="android"] #au-appli-chrome') });
  await memesStyles('navigateur d’une application (Android) : « Continuer ici », sa ligne', { ua: INSTAGRAM, faire: async p => { await p.waitForSelector('#au-appli-ici'); await p.click('#au-appli-ici'); await p.waitForSelector('.entree-appli-mot #au-appli-chrome'); } });
  await memesStyles('navigateur d’une application (Android, petit écran) : la ligne sous le titre', { ua: INSTAGRAM, largeur: 360, hauteur: 640, faire: p => p.waitForSelector('.entree-promesse .entree-appli-mot') });
  await memesStyles('navigateur d’une application (iPhone, arabe, sombre) : la carte', { ua: FACEBOOK_IOS, langue: 'ar', theme: 'dark', faire: p => p.waitForSelector('#au-appli[data-systeme="ios"] #au-appli-ici') });
});

test('page d’entrée plus légère : le CSS complet donne au navigateur exactement les règles de page.html', async () => {
  const src = fs.readFileSync(new URL('../../src/page.html', import.meta.url), 'utf8');
  const fin = src.indexOf('<div id="app">');
  const [polices, tout] = [...src.slice(0, fin).matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]);
  const dist = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  const policesDist = dist.match(/<style>([\s\S]*?)<\/style>/)[1];
  const page = await navigateur.newPage();
  const regles = css => page.evaluate(css => {
    // Seuls les espaces autour de , et > changent (ceux que le raccourci enlève) : on les retire des deux côtés
    const n = t => String(t).replace(/\s*([,>])\s*/g, '$1').trim();
    const out = [];
    const tour = (l, pre) => { for (const r of l) {
      const t = pre + n(r.selectorText || r.conditionText || r.name || r.keyText || r.constructor.name);
      if (r.style) { const props = []; for (let i = 0; i < r.style.length; i++) { const p = r.style[i]; props.push(p + ':' + n(r.style.getPropertyValue(p)) + (r.style.getPropertyPriority(p) ? '!' : '')); } out.push(t + '{' + props.join(';') + '}'); } else out.push(t);
      if (r.cssRules) tour(r.cssRules, t + ' > ');
    } };
    const st = new CSSStyleSheet(); st.replaceSync(css); tour(st.cssRules, '');
    return out;
  }, css);
  for (const [a, b, nom] of [[tout, siteCss(), 'site.css'], [polices, policesDist, 'polices']]) {
    const ra = await regles(a), rb = await regles(b);
    assert.equal(rb.length, ra.length, nom);
    assert.deepEqual(ra.map((x, i) => [x, rb[i]]).filter(([x, y]) => x !== y).slice(0, 3), [], nom);
  }
  assert.ok((await regles(tout)).length > 1500);
  await page.close();
});

// Un membre déjà connecté, sans attendre le chargement complet de la page (un fichier retenu le retarderait)
async function membreLeger({ hash = '', avant } = {}) {
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  if (avant) await avant(ctx);
  await ctx.addInitScript(uid => {
    if (sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init', '1');
    localStorage.setItem('ensam-lang', 'fr');
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'x.' + btoa(JSON.stringify({ sub: uid, exp: now + 7200 })) + '.y', token_type: 'bearer', expires_in: 7200, expires_at: now + 7200, refresh_token: 'r', user: { id: uid, aud: 'authenticated', email: 'membre@exemple.ma', user_metadata: {}, app_metadata: {} } }));
  }, UID);
  const page = await ctx.newPage(), erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto(site.adresse + hash, { waitUntil: 'domcontentloaded' });
  return { ctx, page, erreurs };
}

test('page d’entrée plus légère : un membre connecté voit la forme de l’accueil, et l’application attend le CSS complet pour s’afficher', async () => {
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  let tenir = true; const tenus = [];
  const m = await membreLeger({ avant: ctx => ctx.route(/\/site\.css/, r => (tenir ? tenus.push(r) : r.continue())) });
  await m.page.waitForSelector('.shell.squelette');
  // Le CSS complet est demandé (cet appareil ne l'a jamais reçu : par l'application, son code arrivé ; le test suivant)
  for (let i = 0; i < 50 && !tenus.length; i++) await m.page.waitForTimeout(100);
  assert.ok(tenus.length >= 1, 'site.css demandé');
  await m.page.waitForFunction(() => performance.getEntriesByType('resource').some(e => /\/app\.js$/.test(e.name) && e.responseEnd > 0), null, { timeout: 10000 });
  await m.page.waitForTimeout(800);
  assert.equal(await m.page.locator(ACCUEIL).count(), 0, 'pas d’accueil sans son CSS');
  assert.equal(await m.page.locator('.shell.squelette').count(), 1, 'la forme de l’accueil patiente');
  tenir = false; for (const r of tenus.splice(0)) await r.continue();
  await m.page.waitForSelector(ACCUEIL, { timeout: 15000 });
  assert.equal(await m.page.locator('#css-entree').count(), 0);
  assert.equal(await m.page.locator(ACCUEIL).evaluate(e => getComputedStyle(e).display), 'grid', 'l’accueil a tout son style');
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

// Un membre dont l'appareil n'a jamais appliqué cette version du CSS complet : préchargés ensemble, ses 39 Ko prenaient en 3G
// le réseau au code qu'attendent ses données (mesuré : l'accueil 0,3 s plus tard qu'avec le CSS dans la page). Il part quand
// l'application le demande, tout son code arrivé, pendant la lecture des données ; noté (ensam-css), il est ensuite gardé par le
// navigateur : la fois suivante, préchargé dès le haut de la page, comme avant
test('page d’entrée plus légère : un membre dont l’appareil n’a pas ce CSS le demande une fois le code de l’application arrivé, jamais avant ; la fois suivante, dès le haut de la page', async () => {
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  let tenir = true; const tenus = [], css = [];
  const m = await membreLeger({ avant: async ctx => {
    ctx.on('request', q => { if (new URL(q.url()).pathname === '/site.css') css.push(q.url()); });
    await ctx.route(/\/app\.js$/, r => (tenir ? tenus.push(r) : r.continue()));
  } });
  await m.page.waitForSelector('.shell.squelette');
  // L'entrée a lancé le magasin et l'application : le code du magasin est arrivé, celui de l'application est retenu
  await m.page.waitForFunction(() => window.ENSAM_ENTREE && performance.getEntriesByType('resource').some(e => /\/store\.js$/.test(e.name) && e.responseEnd > 0), null, { timeout: 10000 });
  await m.page.waitForTimeout(1000);
  assert.ok(tenus.length >= 1, 'app.js retenu');
  assert.deepEqual(css, [], 'le CSS complet attend le code de l’application');
  assert.equal(await m.page.locator('link[data-css="site"]').count(), 0);
  tenir = false; for (const r of tenus.splice(0)) await r.continue();
  await m.page.waitForSelector(ACCUEIL, { timeout: 15000 });
  assert.equal(css.length, 1, 'demandé une fois, par l’application');
  assert.equal(await m.page.locator(ACCUEIL).evaluate(e => getComputedStyle(e).display), 'grid', 'l’accueil a tout son style');
  const { vu, adresse } = await m.page.evaluate(() => ({ vu: localStorage.getItem('ensam-css'), adresse: window.ENSAM_CSS }));
  assert.match(adresse, /^site\.css\?v=[0-9a-f]{10}$/);
  assert.equal(vu, adresse, 'noté sur l’appareil, avec son empreinte');
  // La fois suivante : préchargé dès le haut de la page, pendant que le code de l'application est encore retenu
  tenir = true; css.length = 0;
  await m.page.reload({ waitUntil: 'domcontentloaded' });
  await m.page.waitForSelector('.shell.squelette');
  for (let i = 0; i < 50 && !css.length; i++) await m.page.waitForTimeout(100);
  assert.ok(css.length >= 1, 'site.css demandé dès le haut de la page');
  assert.ok(tenus.length >= 1, 'app.js retenu');
  assert.equal(await m.page.evaluate(() => typeof window.ENSAM_APP), 'undefined');
  tenir = false; for (const r of tenus.splice(0)) await r.continue();
  await m.page.waitForSelector(ACCUEIL, { timeout: 15000 });
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('données en deux temps (en ligne) : l’accueil s’affiche sans attendre les messages des groupes ; ils partent juste après ; les Groupes les attendent, puis les montrent', async () => {
  const [groupe] = autoGroups(ETUDIANT);
  assert.ok(groupe);
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  site.tables.groupe_messages = [{ id: 'a1b2c3d4-0000-4000-8000-000000000001', groupe, author_id: AUTEUR, body: 'Rendez-vous jeudi à la bibliothèque', created_at: new Date().toISOString() }];
  let tenir = true; const tenus = [];
  const m = await connecte({ attendre: ACCUEIL, avant: ctx => ctx.route(/\/sb\/rest\/v1\/groupe_messages/, r => (tenir ? tenus.push(r) : r.continue())) });
  // L'accueil est là ; les messages des groupes partent juste après, sans le retenir
  for (let i = 0; i < 40 && !tenus.length; i++) await m.page.waitForTimeout(100);
  assert.equal(tenus.length, 1, 'une lecture des messages des groupes, partie après l’accueil');
  assert.ok(await m.page.isVisible(ACCUEIL));
  // Le reste d'ENSUITE est arrivé (réactions, commentaires de relecture), une seule fois chacun
  for (let i = 0; i < 40 && site.appels.filter(a => a.u === '/sb/rest/v1/relecture_commentaires').length < 1; i++) await m.page.waitForTimeout(100);
  for (const t of ['reactions_messages', 'relecture_commentaires']) assert.equal(site.appels.filter(a => a.u === '/sb/rest/v1/' + t && a.m === 'GET').length, 1, t);
  // Les Groupes ouverts avant leur arrivée : l'écran d'attente, jamais une carte sans son dernier message
  await m.page.evaluate(() => { location.hash = '#reseau/groupes'; });
  await m.page.waitForSelector('.page-attente');
  assert.equal(await m.page.locator('.rangee-groupes').count(), 0);
  assert.equal(await m.page.locator('.page-attente [role="status"]').count(), 1, 'dit aux lecteurs d’écran que ça charge');
  tenir = false; for (const r of tenus.splice(0)) await r.continue();
  await m.page.waitForSelector('.rangee-groupes .gcard-last');
  assert.match(await m.page.locator('.rangee-groupes .gcard-last').first().innerText(), /Rendez-vous jeudi à la bibliothèque/);
  assert.equal(await m.page.locator('.page-attente').count(), 0);
  // Ensuite, plus rien n'attend : retour à l'accueil puis au Réseau, tout de suite là, sans nouvelle lecture
  const lectures = site.appels.filter(a => a.u === '/sb/rest/v1/groupe_messages').length;
  await m.page.evaluate(() => { location.hash = '#accueil'; }); await m.page.waitForSelector(ACCUEIL);
  await m.page.evaluate(() => { location.hash = '#reseau'; });
  await m.page.waitForSelector('.rangee-groupes .gcard-last');
  assert.equal(await m.page.locator('.page-attente').count(), 0);
  assert.equal(site.appels.filter(a => a.u === '/sb/rest/v1/groupe_messages').length, lectures);
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('données en deux temps (en ligne) : une conversation ouverte d’un lien (notification) lit ses réactions avec le reste, puis s’ouvre comme avant', async () => {
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  site.tables.mentorships = EN_CONTACT();
  let tenir = true; const tenus = [];
  const m = await connecte({ hash: '#messages/' + AUTEUR, attendre: null, avant: ctx => ctx.route(/\/sb\/rest\/v1\/reactions_messages/, r => (tenir ? tenus.push(r) : r.continue())) });
  for (let i = 0; i < 50 && !tenus.length; i++) await m.page.waitForTimeout(100);
  assert.equal(tenus.length, 1, 'les réactions partent avec les premières tables');
  await m.page.waitForTimeout(600);
  assert.equal(await m.page.locator('#chat-txt').count(), 0, 'pas de conversation sans ses réactions');
  tenir = false; for (const r of tenus.splice(0)) await r.continue();
  await m.page.waitForSelector('#chat-txt', { timeout: 10000 });
  assert.equal(await m.page.locator('.page-attente').count(), 0);
  await m.page.waitForTimeout(2500);
  // Ensuite, relues seulement avec les messages, par le rattrapage de la conversation ouverte (messages.js, comme avant) ;
  // jamais par le second temps, qui ne lit que ce qui manque encore
  const lues = t => site.appels.filter(a => a.u === '/sb/rest/v1/' + t && a.m === 'GET').length;
  assert.equal(lues('reactions_messages'), lues('messages'), `réactions ${lues('reactions_messages')}, messages ${lues('messages')}`);
  assert.ok(lues('reactions_messages') <= 2, `réactions lues ${lues('reactions_messages')} fois`);
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('données en deux temps (en ligne) : l’administration voit tout dans sa console ; le message de groupe signalé, arrivé en second, est dans la modération', async () => {
  const GM = 'a1b2c3d4-0000-4000-8000-0000000000aa';
  site.inscrits.push({ ...ETUDIANT, role: 'admin', full_name: 'Admin Test', consent_at: '2025-10-01T10:00:00Z' });
  site.tables.groupe_messages = [{ id: GM, groupe: 'filiere:gi', author_id: AUTEUR, body: 'Stage payé contre 500 dirhams, écris-moi', created_at: new Date().toISOString() }];
  site.tables.signalements = [{ id: 'a1b2c3d4-0000-4000-8000-0000000000bb', cible_type: 'message', cible_id: GM, motif: 'arnaque', status: 'ouvert', auteur_id: AUTEUR, created_at: new Date().toISOString() }];
  let tenir = true; const tenus = [];
  const m = await connecte({ attendre: '.me-btn', avant: ctx => ctx.route(/\/sb\/rest\/v1\/groupe_messages/, r => (tenir ? tenus.push(r) : r.continue())) });
  await m.page.evaluate(() => { location.hash = '#admin/moderation'; });
  await m.page.waitForSelector('.page-attente');
  assert.equal(await m.page.locator('.mod-card').count(), 0, 'jamais « Contenu déjà supprimé » pour un message pas encore arrivé');
  tenir = false; for (const r of tenus.splice(0)) await r.continue();
  await m.page.waitForSelector('.mod-card .mod-texte');
  assert.match(await m.page.locator('.mod-card .mod-texte').first().innerText(), /Stage payé contre 500 dirhams/);
  assert.equal(await m.page.getByText('Contenu déjà supprimé').count(), 0);
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

// ---------------------------------------------------------------------------
// Plan · vitesse et ambiance, revue : une lecture du second temps ratée (réseau coupé juste après l'accueil) est dite, puis
// relue au retour du réseau ; ouvert depuis la copie de l'appareil, le Réseau ne montre plus « Pas encore de message » sur
// des groupes qui en ont, ni Mes données un export incomplet ; la photo qu'on vient de choisir revient au rechargement.
// ---------------------------------------------------------------------------
const PAS_DE_RESEAU_PAGE = 'Pas de réseau pour l’instant : cette page s’affiche dès qu’il revient.';
const ONGLETS_RESEAU = '[role="tablist"][aria-label="Rubriques du réseau"] [role="tab"]';

test('données en deux temps (en ligne) : réseau coupé juste après l’accueil, les Groupes le disent (jamais « Pas encore de message ») ; le réseau revenu, leurs messages arrivent', async () => {
  const [groupe] = autoGroups(ETUDIANT);
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  site.tables.groupe_messages = [{ id: 'a1b2c3d4-0000-4000-8000-000000000002', groupe, author_id: AUTEUR, body: 'Rendez-vous jeudi à la bibliothèque', created_at: new Date().toISOString() }];
  let couper = true, coupees = 0;
  const m = await connecte({ attendre: ACCUEIL, avant: ctx => ctx.route(/\/sb\/rest\/v1\/groupe_messages/, r => (couper ? (coupees++, r.abort('internetdisconnected')) : r.continue())) });
  // La lecture du second temps et son nouvel essai échouent : l'accueil n'en sait rien
  for (let i = 0; i < 60 && coupees < 2; i++) await m.page.waitForTimeout(100);
  assert.equal(coupees, 2);
  assert.ok(await m.page.isVisible(ACCUEIL));
  // Le Réseau (son onglet Groupes) le dit, ses autres onglets restent là ; l'écran relit aussitôt (encore coupé)
  await m.page.evaluate(() => { location.hash = '#reseau'; });
  await m.page.getByText(PAS_DE_RESEAU_PAGE).waitFor({ timeout: 10000 });
  assert.equal(await m.page.locator('.gcard').count(), 0, 'aucune carte de groupe sans son dernier message');
  assert.equal(await m.page.getByText('Pas encore de message. Dis bonjour !').count(), 0);
  assert.equal(await m.page.locator('.page-attente').count(), 0, 'la page du Réseau est là');
  assert.ok((await m.page.locator(ONGLETS_RESEAU).count()) >= 2, 'ses autres onglets restent ouverts');
  for (let i = 0; i < 60 && coupees < 4; i++) await m.page.waitForTimeout(100);
  assert.equal(coupees, 4, 'relue une fois en arrivant sur l’écran');
  // Le réseau revient (au plus une lecture toutes les 5 s) : relue, l'écran se redessine avec le dernier message
  await m.page.waitForTimeout(4000);
  couper = false;
  await m.page.evaluate(() => dispatchEvent(new Event('online')));
  await m.page.waitForSelector('.rangee-groupes .gcard-last', { timeout: 10000 });
  assert.match(await m.page.locator('.rangee-groupes .gcard-last').first().innerText(), /Rendez-vous jeudi à la bibliothèque/);
  assert.equal(await m.page.getByText(PAS_DE_RESEAU_PAGE).count(), 0);
  assert.equal(coupees, 4);
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('membre revenu sur le Réseau (copie de l’appareil) : les Groupes attendent la mise à jour, jamais « Pas encore de message » ; sans réseau, eux et Mes données le disent', async () => {
  const [groupe] = autoGroups(ETUDIANT);
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  site.tables.groupe_messages = [{ id: 'a1b2c3d4-0000-4000-8000-000000000003', groupe, author_id: AUTEUR, body: 'Qui vient au café samedi ?', created_at: new Date().toISOString() }];
  let mode = 'passer'; const tenus = [];
  const m = await connecte({ attendre: ACCUEIL, avant: ctx => ctx.route(/\/sb\/rest\/v1\//, r => (mode === 'tenir' ? tenus.push(r) : mode === 'couper' ? r.abort('internetdisconnected') : r.continue())) });
  let c = null;
  for (let i = 0; i < 40 && !c; i++) { await m.page.waitForTimeout(250); c = await lireCacheMembre(m.page); }
  assert.ok(c, 'une copie de l’accueil est gardée');
  assert.deepEqual(c.data.groupe_messages, [], 'la copie ne garde pas les messages des groupes');
  // Rouvert sur le Réseau, la base ne répond pas encore : la page et ses onglets tout de suite, la liste attend la mise à jour
  mode = 'tenir';
  await m.page.evaluate(() => { location.hash = '#reseau'; });
  await m.page.reload();
  await m.page.waitForSelector(ONGLETS_RESEAU, { timeout: 5000 });
  await m.page.waitForSelector('[aria-busy="true"] > .sq-liste');
  assert.equal(await m.page.locator('.page-attente').count(), 0, 'les onglets du Réseau restent ouverts');
  assert.equal(await m.page.locator('.gcard').count(), 0);
  assert.equal(await m.page.getByText('Pas encore de message. Dis bonjour !').count(), 0);
  assert.ok(tenus.length > 0, 'la base n’a pas encore répondu');
  mode = 'passer'; for (const r of tenus.splice(0)) await r.continue();
  await m.page.waitForSelector('.rangee-groupes .gcard-last', { timeout: 10000 });
  assert.match(await m.page.locator('.rangee-groupes .gcard-last').first().innerText(), /Qui vient au café samedi \?/);
  // Rouvert sans réseau : les Groupes le disent (onglets toujours là), Mes données aussi (son export serait incomplet)
  mode = 'couper';
  await m.page.reload();
  await m.page.getByText(PAS_DE_RESEAU_PAGE).waitFor({ timeout: 10000 });
  assert.ok((await m.page.locator(ONGLETS_RESEAU).count()) >= 2);
  assert.equal(await m.page.locator('.gcard').count(), 0);
  await m.page.evaluate(() => { location.hash = '#profil/donnees'; });
  await m.page.locator('#profil-donnees').getByText(PAS_DE_RESEAU_PAGE).waitFor({ timeout: 5000 });
  assert.equal(await m.page.locator('#md-export').count(), 0, 'pas d’export sans les messages des groupes');
  // Le réseau revient : tout arrive, l'export est là, les Groupes ont leur dernier message
  mode = 'passer';
  await m.page.evaluate(() => dispatchEvent(new Event('online')));
  await m.page.waitForSelector('#md-export', { timeout: 15000 });
  await m.page.evaluate(() => { location.hash = '#reseau'; });
  await m.page.waitForSelector('.rangee-groupes .gcard-last', { timeout: 5000 });
  assert.match(await m.page.locator('.rangee-groupes .gcard-last').first().innerText(), /Qui vient au café samedi \?/);
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('photo de profil choisie en ligne : rouverte depuis la copie de l’appareil, c’est toujours la photo (jamais une adresse blob: morte, ni les initiales)', async () => {
  site.inscrits.push({ ...ETUDIANT, photo_path: null, consent_at: '2025-10-01T10:00:00Z' });
  const m = await connecte({ hash: '#profil', attendre: '#profil-photo' });
  const IMG = '#profil-photo .avatar img';
  await m.page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 240; c.height = 300;
    const g = c.getContext('2d'); g.fillStyle = '#a8714f'; g.fillRect(0, 0, 240, 300); g.fillStyle = '#2b3a55'; g.fillRect(30, 230, 180, 70);
    const b = await new Promise(ok => c.toBlob(ok, 'image/png'));
    const dt = new DataTransfer(); dt.items.add(new File([b], 'moi.png', { type: 'image/png' }));
    const input = document.querySelector('#photo-file'); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // Tout de suite à l'écran (adresse blob: de cette page), déposée, puis gardée avec la copie du compte
  await m.page.waitForFunction(sel => /^blob:/.test(document.querySelector(sel)?.src || ''), IMG, { timeout: 15000 });
  assert.ok(site.appels.some(a => a.u.startsWith('/sb/storage/v1/object/photos/' + UID + '/photo-') && a.m === 'POST'), 'la photo est déposée');
  let c = null;
  for (let i = 0; i < 40 && !c?.data.profiles.find(p => p.id === UID)?.photo_path; i++) { await m.page.waitForTimeout(250); c = await lireCacheMembre(m.page); }
  assert.ok(c?.data.profiles.find(p => p.id === UID)?.photo_path, 'la copie a la nouvelle photo');
  assert.ok(!(c.photos || []).some(([, v]) => /^blob:/.test(v?.url || '')), 'jamais l’adresse blob: dans la copie');
  // Rouverte : la photo arrive par un lien du stockage, l'image s'affiche (pas les initiales)
  await m.page.reload();
  await m.page.waitForFunction(sel => { const i = document.querySelector(sel); return !!i && !i.hidden && i.complete && i.naturalWidth > 0; }, IMG, { timeout: 10000 });
  assert.match(await m.page.getAttribute(IMG, 'src'), /\/storage\/v1\/object\/sign\/photos\//);
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('supprimer son compte : pas de « session expirée » ensuite, ni brouillons, ni copie, ni photos gardées sur l’appareil', async () => {
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  site.tables.mentorships = EN_CONTACT();
  let supprime = 0;
  const m = await connecte({ hash: '#messages/' + AUTEUR, attendre: '#chat-txt',
    avant: ctx => ctx.route(/\/sb\/rest\/v1\/rpc\/supprimer_mon_compte/, r => { supprime++; return r.fulfill({ status: 204, body: '' }); }) });
  await m.page.fill('#chat-txt', 'Un mot pas encore envoyé');
  let c = null;
  for (let i = 0; i < 40 && !c; i++) { await m.page.waitForTimeout(250); c = await lireCacheMembre(m.page); }
  assert.ok(c); assert.equal((await brouillons(m.page)).length, 1);
  // Une photo de membre gardée par le service worker (le cache qu'il remplit)
  await m.page.evaluate(async () => { const k = await caches.open('photos-v1'); await k.put(location.origin + '/sb/storage/v1/object/sign/photos/x/photo.png', new Response('img', { headers: { 'content-type': 'image/png' } })); });
  await m.page.evaluate(() => { location.hash = '#profil/donnees'; });
  await m.page.click('#md-supprimer');
  await m.page.fill('#del-txt', 'SUPPRIMER');
  await m.page.click('.modal button:has-text("Supprimer définitivement")');
  await m.page.waitForSelector('#entree .entree-form', { timeout: 15000 });
  await m.page.waitForTimeout(500);
  assert.equal(supprime, 1, 'la base supprime le compte');
  assert.equal(await m.page.locator('#au-session').count(), 0, 'compte supprimé : pas de « session expirée »');
  assert.equal(await m.page.inputValue('#au-email').catch(() => ''), '', 'l’adresse du compte supprimé n’est pas reproposée');
  assert.deepEqual(await brouillons(m.page), []);
  assert.equal(await lireCacheMembre(m.page), null);
  assert.equal(await m.page.evaluate(() => caches.has('photos-v1')), false);
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

// La page passe derrière une autre application (le visiteur va chercher son code dans sa boîte mail)
const cacher = page => page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });

// Le CSS complet appliqué (site.css : la page n'a d'abord que celui de l'entrée) : la règle que seule la nouvelle version porte
const cssApplique = async page => {
  await page.waitForFunction(() => !document.getElementById('css-entree'), null, { timeout: 15000 });
  return page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--maj-test').trim());
};
test('nouvelle version publiée pendant que le visiteur tape son email : la page ne se recharge pas sous ses doigts ; cachée, elle se recharge et l’email revient, avec le CSS complet de la nouvelle version', async () => {
  const s = await visiteur({ sw: true });
  let liberer = () => {};
  try {
    // Le site gardé sur l'appareil : le service worker installé a pris la main sur la page
    await s.page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
    await s.page.reload(); await s.page.waitForSelector('#entree .entree-form');
    assert.ok(await s.page.evaluate(() => !!navigator.serviceWorker.controller), 'le site est gardé sur l’appareil');
    // Il revient après une mise en ligne : la nouvelle version s'installe pendant qu'il tape (son site.css a une règle de plus)
    Object.assign(site.maj, { version: 'test-' + Date.now(), retenue: new Promise(ok => { liberer = ok; }), css: ':root{--maj-test:1}' });
    let chargements = 0;
    s.page.on('load', () => { chargements++; });
    await s.page.reload(); await s.page.waitForSelector('#entree .entree-form');
    await s.page.click('#au-je-etudiant');
    await s.page.fill('#au-email', 'amine@ensam-umi.ac.ma');
    liberer();
    const prete = () => s.page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => !!r?.waiting));
    for (let i = 0; i < 150 && !(await prete()); i++) await s.page.waitForTimeout(100);
    assert.ok(await prete(), 'la nouvelle version est installée et attend');
    // Les premières secondes passées (celles où une page qu'on n'a pas touchée se recharge d'elle-même) : rien n'a bougé
    await s.page.waitForFunction(() => performance.now() > 10000, null, { timeout: 15000, polling: 200 });
    assert.equal(chargements, 1, 'pas de rechargement pendant qu’il tape');
    assert.equal(await s.page.inputValue('#au-email'), 'amine@ensam-umi.ac.ma');
    // L'application partie à son premier geste a le CSS complet de sa version, gardé avec elle (jamais un mélange)
    assert.equal(await cssApplique(s.page), '', 'le CSS complet de la version gardée');
    // Il va lire son code ailleurs : la nouvelle version prend la main, la page se recharge sans qu'il le voie
    await cacher(s.page);
    for (let i = 0; i < 100 && chargements < 2; i++) await s.page.waitForTimeout(100);
    assert.equal(chargements, 2, 'la nouvelle version s’applique une fois la page cachée');
    await s.page.waitForSelector('#entree .entree-form');
    assert.equal(await s.page.inputValue('#au-email'), 'amine@ensam-umi.ac.ma', 'ce qu’il avait tapé revient');
    // Rechargée, la page a le site.css de la nouvelle version (son adresse porte la même empreinte ici : c'est la copie de la
    // nouvelle version que le service worker rend)
    assert.equal(await cssApplique(s.page), '1', 'la nouvelle version apporte son CSS complet');
    assert.deepEqual(s.erreurs, []);
  } finally {
    liberer(); Object.assign(site.maj, { version: null, retenue: null, css: null });
    await s.ctx.close();
  }
});
// Un appareil déjà abonné, en ligne (PushManager simulé) : « Tester » et la resynchronisation à l'ouverture.
// pm.refuse : subscribe() est rejeté à partir de cet appel (1 = le premier), comme un service de push qui ne répond pas ;
// morts : les adresses auxquelles abonner_push_etat répond « mort » ; test : la réponse du job test (un objet, ou 500) ;
// cle : false, la clé de la plateforme est injoignable. Les appels au job test et à abonner_push_etat sont notés (appels),
// chaque toast aussi (window.__toasts), et l'abonnement du navigateur (window.__pm : cur, journal).
const TEST_PHRASES = {
  aucun: 'Aucun appareil abonné pour l’instant.',
  reabonne: 'Le service de notifications ne reconnaissait plus cet appareil : il vient d’être réabonné. Touche « Tester » encore une fois.',
  trop: 'La notification d’essai a été refusée (trop longue). Préviens l’administration.',
  injoignable: 'Le service de notifications de cet appareil ne répond pas pour l’instant. Réessaie dans quelques minutes.',
  lent: 'Le service de notifications ne répond pas, réessaie dans un moment.',
  panne: 'La fonction de notifications ne répond pas encore.',
};
async function appareil({ hash = '#profil/notifications', langue = 'fr', pm = {}, morts = [], test = null, cle = true } = {}) {
  site.vider(); site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z', notif_push: {} });
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const appels = [];
  await ctx.route('**/sb/rest/v1/rpc/abonner_push_etat', r => {
    const ep = r.request().postDataJSON()?.p_endpoint;
    appels.push(['abonner_push_etat', ep]);
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(morts.includes(ep) ? 'mort' : 'ok') });
  });
  await ctx.route('**/sb/functions/v1/notifier', r => {
    const corps = r.request().postDataJSON() || {};
    if (corps.job === 'cle' && !cle) return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Erreur interne"}' });
    if (corps.job !== 'test') return r.continue();
    appels.push(['test', corps.endpoint ?? null]);
    if (test === 500) return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Erreur interne"}' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(test) });
  });
  await ctx.addInitScript(pm => {
    const st = window.__pm = { n: 0, cur: null, subs: 0, journal: [] };
    const nouveau = () => {
      const endpoint = 'https://push.exemple.ma/e' + ++st.n;
      const s = { endpoint, options: {}, toJSON: () => ({ endpoint, keys: { p256dh: 'p256', auth: 'auth' } }),
        unsubscribe: async () => { st.journal.push('unsubscribe ' + endpoint); if (st.cur === s) st.cur = null; return true; } };
      return s;
    };
    if (pm.existante !== false) st.cur = nouveau();
    const manager = {
      getSubscription: async () => st.cur,
      subscribe: async () => {
        st.subs++; st.journal.push('subscribe');
        if (pm.refuse && st.subs >= pm.refuse) throw new DOMException('Registration failed - push service error', 'AbortError');
        if (!st.cur) st.cur = nouveau();
        return st.cur;
      },
    };
    const reg = { waiting: null, installing: null, addEventListener() {}, pushManager: manager };
    const sw = { register: async () => reg, ready: Promise.resolve(reg), controller: null, addEventListener() {}, removeEventListener() {} };
    Object.defineProperty(Navigator.prototype, 'serviceWorker', { get: () => sw, configurable: true });
    window.Notification = class { static permission = 'granted'; static requestPermission = async () => 'granted'; };
    if (!('PushManager' in window)) window.PushManager = function PushManager() {};
    window.__toasts = [];
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList?.contains('toast')) setTimeout(() => window.__toasts.push(n.innerText.trim()), 30); })
      .observe(document, { childList: true, subtree: true });
  }, pm);
  await ctx.addInitScript(([uid, langue]) => {
    if (sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init', '1');
    localStorage.setItem('ensam-lang', langue);
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'x.' + btoa(JSON.stringify({ sub: uid, exp: now + 7200 })) + '.y', token_type: 'bearer', expires_in: 7200, expires_at: now + 7200, refresh_token: 'r', user: { id: uid, aud: 'authenticated', email: 'membre@exemple.ma', user_metadata: {}, app_metadata: {} } }));
  }, [UID, langue]);
  const page = await ctx.newPage(); const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await page.goto(site.adresse + hash);
  await page.waitForSelector('.me-btn', { timeout: 15000 });
  await page.waitForSelector('#md-push .push-etat[data-etat="on"], #md-push .push-etat[data-etat="off"]', { timeout: 15000 });
  // La resynchronisation de l'ouverture a donné l'abonnement à la base
  for (let i = 0; i < 50 && !appels.some(a => a[0] === 'abonner_push_etat'); i++) await page.waitForTimeout(100);
  await page.waitForTimeout(400);
  const etat = () => page.evaluate(() => ({ carte: document.querySelector('#md-push .push-etat')?.dataset.etat || null, cur: window.__pm.cur?.endpoint || null, journal: window.__pm.journal }));
  const toasts = () => page.evaluate(() => window.__toasts);
  const tester = async () => {
    await page.evaluate(() => { window.__pm.journal = []; window.__toasts = []; });
    await page.click('#md-push-test');
    await page.waitForFunction(() => window.__toasts.length > 0, null, { timeout: 8000 });
    await page.waitForTimeout(600);
  };
  return { ctx, page, erreurs, appels, etat, toasts, tester };
}
const effaces = () => site.appels.filter(a => a.m === 'DELETE' && a.u === '/sb/rest/v1/push_subscriptions').length;

test('« Tester » en ligne : chaque réponse de la fonction a sa phrase ; parti ou refusé, cet appareil est réabonné ; sinon rien n’est touché', async () => {
  const cas = [
    ['aucun téléphone', { sent: 0, failed: 0, removed: 0, codes: [], abonnements: 0 }, 'aucun', false],
    ['parti 410', { sent: 0, failed: 0, removed: 1, codes: [410], abonnements: 1, ici: 410 }, 'reabonne', true],
    ['refusé 403', { sent: 0, failed: 1, removed: 0, codes: [403], abonnements: 1, ici: 403 }, 'reabonne', true],
    ['trop longue 413', { sent: 0, failed: 1, removed: 0, codes: [413], abonnements: 1, ici: 413 }, 'trop', false],
    ['injoignable 0', { sent: 0, failed: 0, removed: 0, codes: [0], abonnements: 1, ici: 0 }, 'injoignable', false],
    ['injoignable 503', { sent: 0, failed: 1, removed: 0, codes: [503], abonnements: 1, ici: 503 }, 'injoignable', false],
    ['fonction en panne', 500, 'panne', false],
  ];
  for (const [nom, reponse, phrase, refait] of cas) {
    const m = await appareil({ test: reponse });
    await m.tester();
    assert.deepEqual(await m.toasts(), [TEST_PHRASES[phrase]], nom);
    assert.deepEqual(m.appels.filter(a => a[0] === 'test'), [['test', 'https://push.exemple.ma/e1']], `${nom} : l’adresse de cet appareil part avec l’essai`);
    const e = await m.etat();
    if (refait) {
      assert.deepEqual(e, { carte: 'on', cur: 'https://push.exemple.ma/e2', journal: ['unsubscribe https://push.exemple.ma/e1', 'subscribe'] }, nom);
      assert.ok(m.appels.some(a => a[0] === 'abonner_push_etat' && a[1] === 'https://push.exemple.ma/e2'), `${nom} : la nouvelle adresse est donnée à la base`);
      assert.equal(effaces(), 1, `${nom} : l’ancienne est retirée de la base`);
    } else {
      assert.deepEqual(e, { carte: 'on', cur: 'https://push.exemple.ma/e1', journal: [] }, `${nom} : rien n’est touché`);
      assert.equal(effaces(), 0, nom);
    }
    assert.deepEqual(m.erreurs, [], nom);
    await m.ctx.close();
  }
});

test('« Tester » en ligne, en arabe : la fonction de notifications qui ne répond pas se dit en arabe', async () => {
  const m = await appareil({ test: 500, langue: 'ar' });
  await m.tester();
  assert.deepEqual(await m.toasts(), ['خدمة الإشعارات على المنصة لا تستجيب بعد.'], `avant : « ${TEST_PHRASES.panne} », en français`);
  assert.ok(!(await m.page.evaluate(() => [...(window.__ensamMissing || [])])).includes(TEST_PHRASES.panne));
  assert.deepEqual(await m.etat(), { carte: 'on', cur: 'https://push.exemple.ma/e1', journal: [] }, 'rien n’est touché');
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('« Tester » en ligne, la réparation échoue (service de push muet, clé injoignable) : jamais « réabonné », la carte dit ce qui reste', async () => {
  // L'ancien abonnement retiré, le nouveau refusé : l'appareil n'a plus d'abonnement, la carte repasse à « Activer »
  let m = await appareil({ test: { sent: 0, failed: 1, removed: 0, codes: [403], abonnements: 1, ici: 403 }, pm: { refuse: 1 } });
  await m.tester();
  assert.deepEqual(await m.toasts(), [TEST_PHRASES.lent], 'avant : « il vient d’être réabonné »');
  assert.deepEqual(await m.etat(), { carte: 'off', cur: null, journal: ['unsubscribe https://push.exemple.ma/e1', 'subscribe'] }, 'avant : « Activées sur cet appareil »');
  assert.ok(await m.page.isVisible('#md-push-oui'), '« Activer » à toucher');
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
  // Sans la clé de la plateforme, rien n'est refait : l'abonnement reste, et le message dit de réessayer
  m = await appareil({ test: { sent: 0, failed: 0, removed: 1, codes: [410], abonnements: 1, ici: 410 }, cle: false });
  await m.tester();
  assert.deepEqual(await m.toasts(), [TEST_PHRASES.lent], 'avant : « il vient d’être réabonné », sans rien avoir fait');
  assert.deepEqual(await m.etat(), { carte: 'on', cur: 'https://push.exemple.ma/e1', journal: [] });
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
  // Acceptée mais pas arrivée sur cet appareil dans les 20 s, et l'abonnement ne peut pas être refait : pas de « vient d'être refait »
  m = await appareil({ test: { sent: 1, failed: 0, removed: 0, codes: [201], abonnements: 1, ici: 201 }, pm: { refuse: 1 } });
  await m.tester();
  assert.deepEqual(await m.toasts(), ['Notification de test envoyée.']);
  await m.page.waitForFunction(() => window.__toasts.length > 1 || document.querySelector('#md-push-diag'), null, { timeout: 30000 });
  await m.page.waitForTimeout(600);
  assert.equal(await m.page.locator('#md-push-diag').count(), 0, 'avant : « L’abonnement de cet appareil vient d’être refait », sans abonnement');
  assert.deepEqual(await m.toasts(), ['Notification de test envoyée.', TEST_PHRASES.lent]);
  assert.deepEqual(await m.etat(), { carte: 'off', cur: null, journal: ['unsubscribe https://push.exemple.ma/e1', 'subscribe'] });
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('« Tester » en ligne, deux téléphones sur le compte : la raison est celle de cet appareil, pas celle de l’autre', async () => {
  // Celui-ci : son service ne répond pas (503) ; l'autre, un vieux téléphone, est parti (410)
  const m = await appareil({ test: { sent: 0, failed: 1, removed: 1, codes: [503, 410], abonnements: 2, ici: 503 } });
  await m.tester();
  assert.deepEqual(await m.toasts(), [TEST_PHRASES.injoignable], 'avant : « ne reconnaissait plus cet appareil »');
  assert.deepEqual(await m.etat(), { carte: 'on', cur: 'https://push.exemple.ma/e1', journal: [] }, 'avant : cet appareil réabonné à cause de l’autre');
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

test('à l’ouverture, adresse « morte » pour la base : réabonné une fois ; le service de push refuse : la carte repasse à « Activer »', async () => {
  let m = await appareil({ morts: ['https://push.exemple.ma/e1'] });
  assert.deepEqual(m.appels, [['abonner_push_etat', 'https://push.exemple.ma/e1'], ['abonner_push_etat', 'https://push.exemple.ma/e2']]);
  assert.deepEqual(await m.etat(), { carte: 'on', cur: 'https://push.exemple.ma/e2', journal: ['unsubscribe https://push.exemple.ma/e1', 'subscribe'] });
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
  m = await appareil({ morts: ['https://push.exemple.ma/e1'], pm: { refuse: 1 } });
  assert.deepEqual(await m.etat(), { carte: 'off', cur: null, journal: ['unsubscribe https://push.exemple.ma/e1', 'subscribe'] }, 'avant : « Activées » toute la visite, sans abonnement');
  assert.ok(await m.page.isVisible('#md-push-oui'));
  assert.equal(await m.page.locator('#md-push-test').count(), 0, 'plus de « Tester »');
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

// ---------------------------------------------------------------------------
// Plan · partie membres : l'invitation nommée (&de=, le code du membre qui envoie le lien), et ce que la page d'entrée
// montre avec l'accord des membres (« Ils sont déjà dans le réseau », « Réussites »)
// ---------------------------------------------------------------------------
const NADIA = c => (c?.p_code === 'nadia219' ? { prenom: 'Nadia', promo: 2019, role: 'laureat' } : null);

test('invitation nommée : « Invitation de Nadia · promo 2019 », le code part avec la demande de code, puis il est oublié', async () => {
  site.rpc.invitation_de = NADIA;
  const s = await visiteur({ largeur: 390, hauteur: 844, query: '?promo=2019&de=nadia219' });
  await s.page.waitForSelector('#au-invite-de', { timeout: 8000 });
  assert.equal(await s.page.locator('#au-invite-de').innerText(), 'Invitation de Nadia · promo 2019');
  // La même promo : qui invite prend la place de « Bienvenue, promo 2019 ! » ; sur téléphone, le bandeau tient en une ligne
  assert.equal((await s.page.locator('.invite-band').innerText()).trim(), 'Invitation de Nadia · promo 2019');
  assert.equal(await s.page.evaluate(() => location.search), '', 'adresse nettoyée');
  assert.equal(await s.page.evaluate(() => localStorage.getItem('ensam-invite-de')), 'nadia219');
  assert.deepEqual(site.appels.filter(a => a.u === '/sb/rest/v1/rpc/invitation_de').map(a => a.corps), [{ p_code: 'nadia219' }]);
  assert.equal(await s.page.getAttribute('#au-je-laureat', 'aria-pressed'), 'true', 'promo 2019 : côté lauréats');
  assert.ok((await basBouton(s.page)) <= 844);
  assert.ok((await s.debordement()) <= 0);
  assert.deepEqual(await axe(s.page, '#entree'), []);
  await s.page.fill('#au-email', 'karim@gmail.com'); await s.page.check('#au-ok');
  await s.page.click('.entree-form button.btn.primary');
  await s.page.waitForSelector('#au-code');
  const otp = site.appels.filter(a => a.u === '/sb/auth/v1/otp').pop();
  assert.equal(otp.corps.data.invite_par, 'nadia219', 'la base retrouvera Nadia (même école) en créant le profil');
  assert.equal(otp.corps.data.role_choisi, 'laureat');
  await s.page.fill('#au-code', '123456');
  await s.page.waitForSelector('.auth-card.wide.onb', { timeout: 15000 });
  assert.equal(await s.page.inputValue('#pf-promo'), '2019');
  await s.page.fill('#pf-name', 'Karim Bennani');
  await s.page.selectOption('#pf-fil', { index: 1 }); await s.page.click('#pf-aide-oui');
  await s.page.click('.pf-pied .btn');
  await s.page.waitForFunction(() => !document.querySelector('.auth-card.wide.onb'), null, { timeout: 15000 });
  const p = site.inscrits.find(x => x.id === UID);
  assert.equal(p.promo, 2019);
  assert.equal('invite_par' in p, false, 'le profil envoyé ne dit pas qui invite : la base le lit dans le compte');
  assert.equal(await s.page.evaluate(() => localStorage.getItem('ensam-invite-de')), null, 'oublié une fois le profil créé');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('invitation nommée : en arabe, depuis la page de la promo, code inconnu, code mal formé, base pas encore à jour', async () => {
  site.rpc.invitation_de = NADIA;
  // Le lien de « Fais venir ta promo » : la page de la promo (aperçu WhatsApp) renvoie vers l'entrée en gardant le code
  let s = await visiteur({ langue: 'ar', query: 'promo/2019/?de=nadia219' });
  await s.page.waitForSelector('#au-invite-de', { timeout: 8000 });
  assert.equal(await s.page.locator('#au-invite-de').innerText(), 'دعوة من ⁨Nadia⁩ · دفعة 2019', 'le prénom tel qu’il est écrit');
  assert.match(await s.page.locator('.invite-band').innerText(), /دفعة 2019/);
  assert.equal(await s.page.evaluate(() => location.pathname + location.search), '/');
  await s.app();
  assert.ok(await s.page.isVisible('#au-invite-de'), 'l’application reprend la ligne');
  assert.deepEqual(await s.page.evaluate(() => [...(window.__ensamMissing || [])]), []);
  assert.ok((await s.debordement()) <= 0);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
  // Un code qu'aucun membre de l'école ne porte : rien n'est dit, le code est oublié et ne part pas
  s = await visiteur({ query: '?de=zzzzzzzz' });
  await s.page.waitForFunction(() => localStorage.getItem('ensam-invite-de') === null, null, { timeout: 8000 });
  assert.ok(site.appels.some(a => a.u === '/sb/rest/v1/rpc/invitation_de' && a.corps?.p_code === 'zzzzzzzz'));
  assert.equal(await s.page.locator('#au-invite-de').count(), 0);
  await sInscrire(s.page, { email: 'imane@ensam-umi.ac.ma' });
  assert.equal('invite_par' in site.appels.filter(a => a.u === '/sb/auth/v1/otp').pop().corps.data, false);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
  // Mal formé : rien n'est gardé ni demandé, l'adresse est nettoyée
  site.vider(); site.rpc.invitation_de = NADIA;
  s = await visiteur({ query: '?de=Nadia%3Cb%3E' });
  await s.page.waitForTimeout(300);
  assert.equal(await s.page.evaluate(() => location.search), '');
  assert.equal(await s.page.evaluate(() => localStorage.getItem('ensam-invite-de')), null);
  assert.equal(site.appels.filter(a => a.u === '/sb/rest/v1/rpc/invitation_de').length, 0);
  await s.ctx.close();
  // Base pas encore à jour : pas de ligne, le code est gardé pour l'inscription
  site.vider();
  s = await visiteur({ query: '?de=nadia219' });
  await s.app(); await s.page.waitForTimeout(300);
  assert.ok(site.appels.some(a => a.u === '/sb/rest/v1/rpc/invitation_de'), 'demandé');
  assert.equal(await s.page.locator('#au-invite-de').count(), 0);
  assert.equal(await s.page.locator('.invite-band').count(), 0);
  assert.equal(await s.page.evaluate(() => localStorage.getItem('ensam-invite-de')), 'nadia219');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

// Le bandeau d'un lien d'invitation laisse « Recevoir mon code » au premier écran : sur téléphone, sa première ligne seule
// (qui invite, ou « Bienvenue, promo 2019 ! ») ; la phrase qui explique sur ordinateur
test('lien d’invitation au premier écran : sur téléphone, le bandeau en une ligne laisse le rôle, l’email, l’accord et « Recevoir mon code » en vue ; sur ordinateur, la phrase en plus', async () => {
  site.rpc.invitation_de = NADIA;
  const ACCORD = '.entree-form label.check:has(#au-ok)', BOUTON = '.entree-form button.btn.primary';
  for (const [largeur, hauteur, langue, query, attendu] of [
    [360, 640, 'fr', '?promo=2019&de=nadia219', 'Invitation de Nadia · promo 2019'], [375, 667, 'fr', '?promo=2019&de=nadia219', 'Invitation de Nadia · promo 2019'],
    [390, 664, 'fr', '?promo=2019&de=nadia219', 'Invitation de Nadia · promo 2019'], [360, 640, 'fr', '?promo=2019', 'Bienvenue, promo 2019 !'],
    [390, 664, 'ar', '?promo=2019&de=nadia219', 'دعوة من ⁨Nadia⁩ · دفعة 2019'], [393, 690, 'ar', '?promo=2019', 'مرحبا بك، دفعة 2019!']]) {
    const cas = `${largeur} × ${hauteur} ${langue} ${query}`;
    const s = await visiteur({ largeur, hauteur, langue, query });
    if (query.includes('de=')) await s.page.waitForSelector('#au-invite-de', { timeout: 8000 });
    await s.page.evaluate(() => document.fonts.ready);
    assert.equal((await s.page.locator('.invite-band').innerText()).trim(), attendu, cas);
    for (const sel of ['.invite-band', '#au-je-laureat', '#au-email', ACCORD, BOUTON]) {
      const b = await s.page.locator(sel).boundingBox();
      assert.ok(b.y >= 0 && b.y + b.height <= hauteur, `${cas} : ${sel} de ${Math.round(b.y)} à ${Math.round(b.y + b.height)}, hors du premier écran`);
    }
    if (langue === 'ar') assert.deepEqual(await s.page.evaluate(() => [...(window.__ensamMissing || [])]), [], cas);
    assert.ok((await s.debordement()) <= 0, cas);
    assert.deepEqual(s.erreurs, [], cas);
    await s.ctx.close();
  }
  // Sur ordinateur : qui invite, puis la phrase ; une autre promo que celle de qui invite garde son « Bienvenue »
  for (const [query, lignes] of [
    ['?promo=2019&de=nadia219', ['Invitation de Nadia · promo 2019', 'Ta promo est déjà indiquée : crée ton compte, puis vérifie tes informations.']],
    ['?promo=2019', ['Bienvenue, promo 2019 ! Ta promo est déjà indiquée : crée ton compte, puis vérifie tes informations.']],
    [`?promo=${S + 1}&de=nadia219`, ['Invitation de Nadia · promo 2019', `Bienvenue, promo ${S + 1} ! Ta promo est déjà indiquée : crée ton compte, puis vérifie tes informations.`]]]) {
    const s = await visiteur({ largeur: 1280, hauteur: 800, query });
    if (query.includes('de=')) await s.page.waitForSelector('#au-invite-de', { timeout: 8000 });
    assert.deepEqual((await s.page.locator('.invite-band').innerText()).split('\n').map(x => x.trim()).filter(Boolean), lignes, query);
    assert.deepEqual(s.erreurs, [], query);
    await s.ctx.close();
  }
  const a = await visiteur({ largeur: 1280, hauteur: 800, langue: 'ar', query: '?promo=2019&de=nadia219' });
  await a.page.waitForSelector('#au-invite-de', { timeout: 8000 });
  assert.deepEqual((await a.page.locator('.invite-band').innerText()).split('\n').map(x => x.trim()).filter(Boolean), ['دعوة من ⁨Nadia⁩ · دفعة 2019', 'دفعتك محدَّدة مسبقًا: أنشئ حسابك، ثم تحقق من معلوماتك.']);
  assert.deepEqual(await a.page.evaluate(() => [...(window.__ensamMissing || [])]), []);
  assert.deepEqual(a.erreurs, []);
  await a.ctx.close();
});

const VISAGES = [{ nom: 'Nadia B.', promo: 2019, entreprise: 'Renault Tanger', photo: UID + '/photo-3.webp' }, { nom: 'Youssef E.', promo: 2016, entreprise: 'OCP', photo: null }];
const REUSSITES = [{ entreprise: 'Lear Corporation', etudiant: 'Salma', laureat: 'Youssef', promo: 2016, mois: '2026-10' }];
for (const langue of ['fr', 'ar']) test(`entrée (${langue}) : « Ils sont déjà dans le réseau » et « Réussites », seulement ce que les membres ont accepté`, async () => {
  site.rpc.visages_publics = () => VISAGES; site.rpc.reussites_publiques = () => REUSSITES;
  const s = await visiteur({ langue });
  await s.page.waitForSelector('.ev-visages .ev-visage', { timeout: 8000 });
  assert.deepEqual(await s.page.$$eval('.ev-visage .ev-nom', x => x.map(e => e.textContent)), ['Nadia B.', 'Youssef E.']);
  assert.deepEqual(await s.page.$$eval('.ev-visage .ev-ent', x => x.map(e => e.textContent)), ['Renault Tanger', 'OCP']);
  await s.page.waitForFunction(() => document.querySelector('.ev-visages img')?.naturalWidth > 0);
  assert.equal(await s.page.locator('.ev-visages img').count(), 1, 'une photo (l’autre : ses initiales)');
  assert.deepEqual(site.appels.find(a => a.u === '/sb/storage/v1/object/sign/photos')?.corps, { expiresIn: 3600, paths: [UID + '/photo-3.webp'] }, 'un lien temporaire, seulement pour la photo montrée');
  const t = await s.page.locator('.ev').innerText();
  if (langue === 'fr') {
    assert.match(t, /Ils sont déjà dans le réseau[\s\S]*Promo 2019[\s\S]*Réussites[\s\S]*Lear Corporation[\s\S]*Salma, avec l’aide de Youssef \(promo 2016\)[\s\S]*octobre 2026/);
  } else {
    assert.match(t, /هم بالفعل في الشبكة[\s\S]*دفعة 2019[\s\S]*النجاحات[\s\S]*Lear Corporation[\s\S]*بمساعدة[\s\S]*أكتوبر 2026/);
    assert.doesNotMatch(t, /Promo|promo|octobre|avec l’aide/);
  }
  assert.ok(await s.page.evaluate(() => !!(document.querySelector('.entree-form').compareDocumentPosition(document.querySelector('.ev')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'sous le formulaire');
  assert.ok((await basBouton(s.page)) <= 640, 'le bouton « Recevoir mon code » se voit sans défiler');
  assert.ok((await s.debordement()) <= 0);
  await s.app();
  assert.ok(await s.page.isVisible('.ev-visages'), 'l’application reprend les deux rangées');
  if (langue === 'ar') assert.deepEqual(await s.page.evaluate(() => [...(window.__ensamMissing || [])]), []);
  assert.deepEqual(await axe(s.page, '#entree'), []);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('entrée : base pas encore à jour, ou personne n’a encore dit oui : ni visages ni réussites, sans erreur', async () => {
  let s = await visiteur();
  await s.app(); await s.page.waitForTimeout(400);
  assert.ok(site.appels.some(a => a.u === '/sb/rest/v1/rpc/visages_publics') && site.appels.some(a => a.u === '/sb/rest/v1/rpc/reussites_publiques'), 'demandés');
  assert.equal(await s.page.locator('.ev').count(), 0);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
  site.vider(); site.rpc.visages_publics = () => []; site.rpc.reussites_publiques = () => [];
  s = await visiteur();
  await s.app(); await s.page.waitForTimeout(400);
  assert.equal(await s.page.locator('.ev').count(), 0);
  assert.equal(site.appels.filter(a => a.u.startsWith('/sb/storage/')).length, 0, 'aucune photo demandée');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
  // Des réussites, aucun visage : la rangée des réussites seule
  site.rpc.reussites_publiques = () => REUSSITES;
  s = await visiteur();
  await s.page.waitForSelector('.ev-reussites', { timeout: 8000 });
  assert.equal(await s.page.locator('.ev-visages').count(), 0);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('entrée par le lien d’une école (?ecole=) : l’invitation, les visages et les réussites de cette école seulement', async () => {
  const corps = nom => site.appels.filter(a => a.u === '/sb/rest/v1/rpc/' + nom).map(a => a.corps);
  site.rpc.invitation_de = c => (c?.p_ecole === 'ensa-fes' && c?.p_code === 'omar2019' ? { prenom: 'Omar', promo: 2019, role: 'laureat' } : null);
  site.rpc.visages_publics = c => (c?.p_ecole === 'ensa-fes' ? [{ nom: 'Omar A.', promo: 2019, entreprise: 'Lear', photo: null }] : VISAGES);
  site.rpc.reussites_publiques = c => (c?.p_ecole === 'ensa-fes' ? [] : REUSSITES);
  let s = await visiteur({ query: '?ecole=ensa-fes&promo=2019&de=omar2019' });
  await s.page.waitForSelector('.ev-visages .ev-visage', { timeout: 8000 });
  await s.page.waitForSelector('#au-invite-de', { timeout: 8000 });
  assert.equal(await s.page.locator('#au-invite-de').innerText(), 'Invitation de Omar · promo 2019');
  assert.deepEqual(await s.page.$$eval('.ev-visage .ev-nom', x => x.map(e => e.textContent)), ['Omar A.'], 'pas les visages d’une autre école');
  assert.equal(await s.page.locator('.ev-reussites').count(), 0, 'ni ses réussites');
  for (const nom of ['invitation_de', 'visages_publics', 'reussites_publiques']) {
    const l = corps(nom);
    assert.ok(l.length && l.every(c => c?.p_ecole === 'ensa-fes'), `${nom} : l’école du lien part avec chaque appel (${JSON.stringify(l)})`);
  }
  assert.ok(corps('invitation_de').every(c => c.p_code === 'omar2019'));
  assert.equal(await s.page.evaluate(() => location.search), '', 'adresse nettoyée');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
  // Une école dont le réseau n'est pas encore ouvert : la base ne rend rien, la page ne montre rien
  site.vider(); site.rpc.visages_publics = () => []; site.rpc.reussites_publiques = () => [];
  s = await visiteur({ query: '?ecole=pas-ouverte' });
  await s.app(); await s.page.waitForTimeout(400);
  assert.ok(corps('visages_publics').length && corps('visages_publics').every(c => c?.p_ecole === 'pas-ouverte'));
  assert.equal(await s.page.locator('.ev').count(), 0);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('membre en ligne : le lien de « Fais venir ta promo » porte son code ; « 2 camarades sont arrivés grâce à toi »', async () => {
  site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  site.rpc.mon_code_invitation = (_c, m) => (m ? 'salma234' : undefined);
  site.rpc.mes_invites = (_c, m) => (m ? { n: 2, prenoms: ['Imane', 'Omar'] } : undefined);
  let m = await membre({ hash: '#parcours' });
  await m.page.waitForSelector('#promo-invites', { timeout: 15000 });
  assert.match(await m.page.locator('#promo-invites').innerText(), /^2 camarades sont arrivés grâce à toi\s*Imane, Omar$/);
  await m.page.waitForFunction(() => /promo%2F\d{4}%2F%3Fde%3Dsalma234/.test(document.getElementById('promo-wa')?.href || ''), null, { timeout: 8000 });
  assert.ok(site.appels.some(a => a.u === '/sb/rest/v1/rpc/mon_code_invitation'));
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
  // Base pas encore à jour : le lien simple de la promo, pas de ligne
  delete site.rpc.mon_code_invitation; delete site.rpc.mes_invites;
  m = await membre({ hash: '#parcours' });
  await m.page.waitForSelector('#promo-wa', { timeout: 15000 }); await m.page.waitForTimeout(400);
  assert.doesNotMatch(await m.page.getAttribute('#promo-wa', 'href'), /de%3D/);
  assert.equal(await m.page.locator('#promo-invites').count(), 0);
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

// ---------------------------------------------------------------------------
// Écoles : la page d'entrée d'un lien d'école (?ecole=) demande les chiffres et les fondateurs de cette école-là ; un membre
// d'une autre école que l'ENSAM Meknès voit son école dans l'onglet, la marque, la carte et le lien de sa promo
// ---------------------------------------------------------------------------
const FES = { slug: 'ensa-fes', nom: 'ENSA Fès', nom_court: 'ENSA', ville: 'Fès', nom_ar: 'ENSA فاس', couleur: '#225588', ouverte: true, created_at: '2026-10-01T00:00:00Z' };
const OMAR = { rang: 1, type: 'offre', at: '2026-10-23T09:12:00Z', nom: 'Omar Alami', filiere: 'Génie Industriel', promo: 2019, photo: null, verifie: true, id: null };
const lignesEntree = page => page.$$eval('.auth-chiffres span', x => x.map(e => e.textContent));

test('entrée par le lien d’une école (?ecole=) : ses chiffres et ses fondateurs à elle ; rien, jamais ceux de l’ENSAM Meknès, si la base ne rend rien', async () => {
  const corps = nom => site.appels.filter(a => a.u === '/sb/rest/v1/rpc/' + nom).map(a => a.corps);
  // La base de demain : {} pour l'ENSAM Meknès (comme avant) ; l'école demandée sinon (null : pas ouverte, ou inconnue)
  const PAR_ECOLE = {
    'ensa-fes': [{ laureats: 4, entreprises: 2, promos: 1 }, { max: 25, total: 1, places: 24, mon_choix: null, fondateurs: [OMAR] }],
    'fst-settat': [{ laureats: 0, entreprises: 0, promos: 0 }, { max: 25, total: 0, places: 25, mon_choix: null, fondateurs: [] }],
  };
  const regler = (ancienne = false) => {
    site.rpc.chiffres_publics = c => (!c?.p_ecole ? { laureats: 39, entreprises: 19, promos: 14 } : ancienne ? undefined : PAR_ECOLE[c.p_ecole]?.[0] ?? null);
    site.rpc.fondateurs_publics = c => (!c?.p_ecole ? reponse()(false) : ancienne ? undefined : PAR_ECOLE[c.p_ecole]?.[1] ?? null);
  };
  regler();
  // Le lien d'une école ouverte : ses chiffres, son fondateur ; chaque demande porte l'école du lien
  let s = await visiteur({ query: '?ecole=ensa-fes&promo=2019', largeur: 390, hauteur: 844 });
  await s.page.waitForFunction(() => document.querySelector('.auth-chiffres')?.children.length === 3);
  assert.deepEqual(await lignesEntree(s.page), ['4 lauréats', '2 entreprises', '1 promo']);
  await s.page.waitForSelector('.fd-public .fd-carte', { timeout: 8000 });
  assert.deepEqual(await s.page.$$eval('.fd-public .fd-nom-t', x => x.map(e => e.textContent)), ['Omar Alami']);
  assert.equal(await s.page.locator('.fd-public .fd-totaux').innerText(), '1 membre fondateur · 24 places restantes');
  await s.app(); await s.page.waitForTimeout(400);
  assert.deepEqual(await lignesEntree(s.page), ['4 lauréats', '2 entreprises', '1 promo'], 'l’application reprend les chiffres de l’école');
  for (const nom of ['chiffres_publics', 'fondateurs_publics']) {
    const l = corps(nom);
    assert.ok(l.length && l.every(c => JSON.stringify(c) === '{"p_ecole":"ensa-fes"}'), `${nom} : l’école du lien, jamais {} (${JSON.stringify(l)})`);
  }
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
  // Pas encore ouverte (la base rend null), inconnue (null), ouverte sans personne (zéro), ou une base d'avant qui ne
  // connaît pas p_ecole (404) : ni chiffres ni fondateurs ; jamais ceux de l'ENSAM Meknès à la place
  for (const [ecole, ancienne] of [['ecole-exemple', false], ['ensa-oujda', false], ['fst-settat', false], ['ensa-fes', true]]) {
    site.vider(); regler(ancienne);
    s = await visiteur({ query: `?ecole=${ecole}`, largeur: 390, hauteur: 844 });
    await s.app(); await s.page.waitForTimeout(600);
    const quoi = `${ecole}${ancienne ? ' (base d’avant)' : ''}`;
    assert.equal(await s.page.locator('.auth-chiffres span').count(), 0, quoi);
    assert.equal(await s.page.locator('.fd-public').count(), 0, quoi);
    assert.doesNotMatch(await s.page.locator('#entree').innerText(), /39 lauréats|Hajeb|Sedki|membres? fondateurs?/, quoi);
    for (const nom of ['chiffres_publics', 'fondateurs_publics']) {
      const l = corps(nom);
      assert.ok(l.length && l.every(c => c?.p_ecole === ecole), `${nom} ${quoi} : ${JSON.stringify(l)}`);
    }
    assert.deepEqual(s.erreurs, []);
    await s.ctx.close();
  }
  // Sans lien d'école, ou le lien de l'ENSAM Meknès : la demande d'avant ({}), ses chiffres et ses fondateurs
  for (const query of ['', '?ecole=ensam-meknes']) {
    site.vider(); regler();
    s = await visiteur({ query, largeur: 390, hauteur: 844 });
    await s.page.waitForFunction(() => document.querySelector('.auth-chiffres')?.children.length === 3);
    assert.deepEqual(await lignesEntree(s.page), ['39 lauréats', '19 entreprises', '14 promos']);
    await s.page.waitForSelector('.fd-public .fd-carte', { timeout: 8000 });
    assert.deepEqual(await s.page.$$eval('.fd-public .fd-nom-t', x => x.map(e => e.textContent)), ['Abderrahman Hajeb', 'Hamza Sedki']);
    for (const nom of ['chiffres_publics', 'fondateurs_publics']) assert.ok(corps(nom).length && corps(nom).every(c => JSON.stringify(c) === '{}'), `${nom} ${query}`);
    assert.deepEqual(s.erreurs, []);
    await s.ctx.close();
  }
});

for (const langue of ['fr', 'ar']) test(`membre en ligne d’une autre école (${langue}) : l’onglet, la marque, la carte et le lien de sa promo disent son école ; l’ENSAM Meknès comme avant`, async () => {
  const ar = langue === 'ar';
  site.inscrits.push({ ...ETUDIANT, ecole: 'ensa-fes', consent_at: '2025-10-01T10:00:00Z' });
  site.tables.ecoles = [FES];
  site.rpc.mon_code_invitation = (_c, m) => (m ? 'salma234' : undefined);
  let m = await membre({ hash: '#parcours', langue, largeur: 1280 });
  await m.page.waitForFunction(() => /ecole%3Densa-fes%26de%3Dsalma234/.test(document.getElementById('promo-wa')?.href || ''), null, { timeout: 15000 });
  let texte = new URL(await m.page.getAttribute('#promo-wa', 'href')).searchParams.get('text');
  assert.ok(texte.endsWith(`/promo/${S + 1}/${ar ? 'ar/' : ''}?ecole=ensa-fes&de=salma234`), texte);
  assert.match(texte, ar ? /أنا على «شبكة ENSA فاس»:/ : /Je suis sur le Réseau ENSA Fès :/);
  assert.doesNotMatch(texte, /Meknès|مكناس/);
  assert.match(await m.page.title(), /^(\(\d+\) )?Réseau ENSA Fès$/);
  assert.equal(await m.page.locator('.side .brand-txt span').innerText(), ar ? 'فاس · الخريجون والطلبة' : 'Fès · Lauréats & étudiants');
  const brand = await m.page.locator('.side .brand-txt span').boundingBox(), side = await m.page.locator('.side .brand').boundingBox();
  assert.ok(brand.x >= side.x - 1 && brand.x + brand.width <= side.x + side.width + 1, 'la marque tient dans la barre latérale');
  await m.page.evaluate(() => { location.hash = '#reseau/annuaire/carte'; });
  await m.page.waitForSelector('.sub-page .map', { timeout: 15000 });
  assert.equal(await m.page.locator('.sub-page > p.muted.small').first().innerText(), ar
    ? 'أين يعمل خريجو ENSA فاس. انقر على نقطة لترى من هناك. بالأزرق المغرب، وبالبرتقالي الخارج.'
    : 'Où travaillent les lauréats de l’ENSA Fès. Clique sur un point pour voir qui est là. En bleu le Maroc, en orange l’étranger.');
  assert.ok(site.appels.some(a => a.u === '/sb/rest/v1/ecoles' && a.m === 'GET'), 'la ligne de son école est lue');
  if (ar) assert.deepEqual(await m.page.evaluate(() => [...(window.__ensamMissing || [])].filter(x => /Fès|Lauréats|Où travaillent|Réseau/.test(x))), []);
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
  // Un membre de l'ENSAM Meknès : tout comme avant (son école n'est pas dans le lien, les textes d'avant)
  site.vider(); site.inscrits.push({ ...ETUDIANT, consent_at: '2025-10-01T10:00:00Z' });
  site.tables.ecoles = [{ slug: 'ensam-meknes', nom: 'ENSAM Meknès', ouverte: true, created_at: '2026-10-21T00:00:00Z' }, FES];
  site.rpc.mon_code_invitation = (_c, mm) => (mm ? 'salma234' : undefined);
  m = await membre({ hash: '#parcours', langue, largeur: 1280 });
  await m.page.waitForFunction(() => /de%3Dsalma234/.test(document.getElementById('promo-wa')?.href || ''), null, { timeout: 15000 });
  texte = new URL(await m.page.getAttribute('#promo-wa', 'href')).searchParams.get('text');
  assert.ok(texte.endsWith(`/promo/${S + 1}/${ar ? 'ar/' : ''}?de=salma234`), texte);
  assert.match(texte, ar ? /أنا على «شبكة ENSAM مكناس»:/ : /Je suis sur le Réseau ENSAM Meknès :/);
  assert.match(await m.page.title(), /^(\(\d+\) )?Réseau ENSAM Meknès$/);
  assert.equal(await m.page.locator('.side .brand-txt span').innerText(), ar ? 'مكناس · الخريجون والطلبة' : 'Meknès · Lauréats & étudiants');
  await m.page.evaluate(() => { location.hash = '#reseau/annuaire/carte'; });
  await m.page.waitForSelector('.sub-page .map', { timeout: 15000 });
  assert.equal(await m.page.locator('.sub-page > p.muted.small').first().innerText(), ar
    ? 'أين يعمل خريجو ENSAM مكناس. انقر على نقطة لترى من هناك. بالأزرق المغرب، وبالبرتقالي الخارج.'
    : 'Où travaillent les lauréats de l’ENSAM Meknès. Clique sur un point pour voir qui est là. En bleu le Maroc, en orange l’étranger.');
  assert.deepEqual(m.erreurs, []);
  await m.ctx.close();
});

// ---------------------------------------------------------------------------
// Lien d'une école ouvert dans le navigateur d'une application sur iPhone ou iPad : « Ouvrir dans Safari » (le geste de la
// carte) ouvre l'adresse affichée, et Safari n'a rien de ce que la page a gardé ici. L'adresse garde donc ce que « Ouvrir
// dans Chrome » emporte sur Android (la promo, qui invite, l'école, la langue, le rôle choisi, l'étape) ; ailleurs, elle
// reste propre, comme à la fin de l'inscription
// ---------------------------------------------------------------------------
const INSTAGRAM_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.32.81 (iPhone15,3; iOS 18_5; fr_FR; fr; scale=3.00; 1290x2796; 645432123)';
const SAFARI_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const OMAR_FES = c => (c?.p_ecole === 'ensa-fes' && c?.p_code === 'omar2019' ? { prenom: 'Omar', promo: 2019, role: 'laureat' } : null);
const adresseDe = page => page.evaluate(() => Object.fromEntries(new URLSearchParams(location.search)));
const gardes = page => page.evaluate(() => ['ensam-invite-promo', 'ensam-invite-ecole', 'ensam-invite-de', 'ensam-role-choisi'].map(k => localStorage.getItem(k)));
const quand = (page, k, v) => page.waitForFunction(([k, v]) => new URLSearchParams(location.search).get(k) === v, [k, v], { timeout: 8000 });

test('navigateur d’une application sur iPhone : l’adresse garde le lien de l’école pour Safari (promo, qui invite, école, rôle, étape, arabe), la même après un rechargement ; propre à la fin de l’inscription, et ailleurs', async () => {
  site.rpc.invitation_de = OMAR_FES; site.tables.ecoles = [FES];
  const s = await visiteur({ largeur: 390, hauteur: 844, ua: INSTAGRAM_IOS, query: '?promo=2019&ecole=ensa-fes&de=omar2019' });
  await s.page.waitForSelector('#au-invite-de', { timeout: 8000 });
  await quand(s.page, 'mode', 'inscription');
  assert.deepEqual(await adresseDe(s.page), { promo: '2019', de: 'omar2019', ecole: 'ensa-fes', mode: 'inscription' }, 'le rôle que la promo laisse deviner n’est pas un choix');
  // Le rôle touché, l'étape changée puis revenue, l'arabe : l'adresse suit
  await s.page.click('#au-je-laureat'); await quand(s.page, 'role', 'laureat');
  await s.page.click('.entree-form button.linkish:has-text("J’ai déjà un compte")'); await quand(s.page, 'mode', 'connexion');
  await s.page.click('.entree-form button.linkish:has-text("Créer un compte")'); await quand(s.page, 'mode', 'inscription');
  await s.page.click('.entree-top .lang-btn'); await quand(s.page, 'lang', 'ar');
  assert.deepEqual(await adresseDe(s.page), { promo: '2019', de: 'omar2019', ecole: 'ensa-fes', role: 'laureat', mode: 'inscription', lang: 'ar' });
  const adresse = await s.page.evaluate(() => location.href);
  // Rechargée ici : la même page, et la même adresse
  await s.page.reload(); await s.page.waitForSelector('#entree .entree-form');
  await s.page.waitForSelector('#au-invite-de', { timeout: 8000 }); await quand(s.page, 'lang', 'ar');
  assert.equal(await s.page.evaluate(() => location.href), adresse);
  assert.equal(await s.page.getAttribute('html', 'dir'), 'rtl');
  assert.equal(await s.page.getAttribute('#au-je-laureat', 'aria-pressed'), 'true');
  assert.equal(await s.page.getAttribute('.entree-form', 'aria-label'), 'إنشاء حسابي', 'toujours « Créer mon compte »');
  assert.deepEqual(await gardes(s.page), ['2019', 'ensa-fes', 'omar2019', 'laureat']);
  // Safari ouvre cette adresse, sans rien de ce que l'application a gardé : le même lien, et une adresse propre
  const v = await visiteur({ largeur: 390, hauteur: 844, ua: SAFARI_IOS, langue: null, query: new URL(adresse).search });
  await v.page.waitForSelector('#au-invite-de', { timeout: 8000 });
  assert.equal(await v.page.evaluate(() => location.pathname + location.search), '/');
  assert.deepEqual(await gardes(v.page), ['2019', 'ensa-fes', 'omar2019', 'laureat']);
  assert.equal(await v.page.getAttribute('html', 'dir'), 'rtl');
  assert.equal(await v.page.getAttribute('#au-je-laureat', 'aria-pressed'), 'true');
  assert.equal(await v.page.getAttribute('.entree-form', 'aria-label'), 'إنشاء حسابي');
  assert.ok(site.appels.filter(a => a.u === '/sb/rest/v1/rpc/invitation_de').every(a => a.corps?.p_ecole === 'ensa-fes'));
  assert.deepEqual(v.erreurs, []);
  await v.ctx.close();
  // L'inscription finie ici : l'adresse propre
  await s.page.click('.entree-top .lang-btn'); await s.page.waitForFunction(() => !new URLSearchParams(location.search).has('lang'));
  await sInscrire(s.page, { role: 'laureat', email: 'karim@gmail.com' });
  assert.equal(await adresseDe(s.page).then(x => x.ecole), 'ensa-fes', 'jusqu’à la dernière étape');
  await s.page.fill('#pf-name', 'Karim Bennani');
  await s.page.selectOption('#pf-fil', { index: 1 }); await s.page.click('#pf-aide-oui');
  await s.page.click('.pf-pied .btn');
  await s.page.waitForFunction(() => !document.querySelector('.auth-card.wide.onb'), null, { timeout: 15000 });
  await s.page.waitForSelector('.me-btn', { timeout: 15000 });
  assert.equal(await s.page.evaluate(() => location.search), '');
  assert.deepEqual(await gardes(s.page), [null, null, null, null]);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
  // Ailleurs (Android, même dans une application ; Safari ; un ordinateur), l'adresse reste propre, comme avant
  for (const ua of [INSTAGRAM, SAFARI_IOS, undefined]) {
    site.vider(); site.rpc.invitation_de = OMAR_FES; site.tables.ecoles = [FES];
    const a = await visiteur({ largeur: 390, hauteur: 844, ua, query: '?promo=2019&ecole=ensa-fes&de=omar2019' });
    await a.page.waitForSelector('#au-invite-de', { timeout: 8000 });
    // Le rôle touché (gardé, montré : l'adresse aurait suivi dans le même geste), puis deux images (l'effet de l'étape aussi)
    await a.page.click('#au-je-laureat');
    await a.page.waitForFunction(() => localStorage.getItem('ensam-role-choisi') === 'laureat' && document.getElementById('au-je-laureat')?.getAttribute('aria-pressed') === 'true');
    await a.page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert.equal(await a.page.evaluate(() => location.pathname + location.search), '/', ua || 'ordinateur');
    assert.deepEqual(a.erreurs, []);
    await a.ctx.close();
  }
});

// ---------------------------------------------------------------------------
// Inscription par le lien d'une école : l'école part avec la demande de code (comme qui invite) ; un compte commencé sur
// un autre appareil (rien de gardé ici) finit quand même dans son école ; une école pas encore ouverte le dit, et le redit
// ---------------------------------------------------------------------------
const CASA = { slug: 'ensam-casa', nom: 'ENSAM Casablanca', nom_court: 'ENSAM', ville: 'Casablanca', nom_ar: 'ENSAM الدار البيضاء', ouverte: false, created_at: '2026-10-01T00:00:00Z' };
const FERMEE = 'Le réseau de cette école n’est pas encore ouvert.';
// La base refuse le profil d'une école pas encore ouverte (protect_ecole) : 42501 et sa phrase
const refusEcole = ctx => ctx.route(/\/sb\/rest\/v1\/profiles(\?|$)/, r => (r.request().method() === 'POST'
  ? r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: '42501', details: null, hint: null, message: FERMEE }) }) : r.continue()));
async function finirLaureat(page, { choisir = false } = {}) {
  if (choisir) await page.click('#pf-je-laureat');
  await page.fill('#pf-name', 'Karim Bennani'); await page.fill('#pf-promo', '2019');
  await page.selectOption('#pf-fil', { index: 1 }); await page.click('#pf-aide-oui');
  await page.click('.pf-pied .btn');
}

test('inscription par le lien d’une école : l’école part avec la demande de code, et un compte commencé sur un autre appareil finit dans son école', async () => {
  site.tables.ecoles = [FES];
  const otp = email => site.appels.filter(a => a.u === '/sb/auth/v1/otp' && a.corps.email === email).pop()?.corps;
  // Sur le téléphone du lien : la demande de code porte l'école (le compte la garde), puis le profil part dans son école
  let s = await visiteur({ largeur: 390, hauteur: 844, query: '?ecole=ensa-fes' });
  await s.page.click('#au-je-laureat'); await s.page.fill('#au-email', 'karim@gmail.com'); await s.page.check('#au-ok');
  await s.page.click('.entree-form button.btn.primary'); await s.page.waitForSelector('#au-code');
  assert.equal(otp('karim@gmail.com').data.ecole, 'ensa-fes');
  assert.equal(otp('karim@gmail.com').create_user, true);
  await s.ctx.close();
  // Le même compte, fini sur un autre appareil où rien n'est gardé (ni lien, ni école) : l'école du compte
  s = await visiteur({ largeur: 390, hauteur: 844 });
  assert.equal(await s.page.evaluate(() => localStorage.getItem('ensam-invite-ecole')), null);
  await s.page.click('.entree-form button.linkish:has-text("J’ai déjà un compte")');
  await s.page.fill('#au-email', 'karim@gmail.com'); await s.page.click('.entree-form button.btn.primary');
  await s.page.waitForSelector('#au-code'); await s.page.fill('#au-code', '123456');
  await s.page.waitForSelector('.auth-card.wide.onb', { timeout: 15000 });
  assert.equal(otp('karim@gmail.com').create_user, false, 'se connecter : le compte est celui du premier appareil');
  await finirLaureat(s.page, { choisir: true });
  await s.page.waitForFunction(() => !document.querySelector('.auth-card.wide.onb'), null, { timeout: 15000 });
  assert.equal(site.inscrits.find(x => x.id === UID)?.ecole, 'ensa-fes');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
  // L'ENSAM Meknès (sans lien d'école, ou son lien) : la demande et le profil d'avant, sans école
  for (const query of ['', '?ecole=ensam-meknes']) {
    site.vider(); site.tables.ecoles = [FES];
    s = await visiteur({ largeur: 390, hauteur: 844, query });
    await sInscrire(s.page, { role: 'laureat', email: 'hamza@gmail.com' });
    assert.deepEqual(Object.keys(otp('hamza@gmail.com').data).sort(), ['consent_at', 'consent_version', 'emails_hebdo', 'langue', 'par_code', 'role_choisi'], query);
    await finirLaureat(s.page);
    await s.page.waitForFunction(() => !document.querySelector('.auth-card.wide.onb'), null, { timeout: 15000 });
    assert.equal('ecole' in site.inscrits.find(x => x.id === UID), false, query);
    await s.ctx.close();
  }
});

for (const langue of ['fr', 'ar']) test(`lien d’une école pas encore ouverte (${langue}) : à la dernière étape, « ${FERMEE} » reste à l’écran, et le lien est gardé`, async () => {
  site.tables.ecoles = [FES, CASA];
  const s = await visiteur({ largeur: 390, hauteur: 844, langue, query: '?ecole=ensam-casa', avant: refusEcole });
  await sInscrire(s.page, { role: 'laureat', email: 'nawal@gmail.com' });
  await finirLaureat(s.page);
  await s.page.waitForSelector('.auth-card.wide.onb #pf-ferme', { timeout: 15000 });
  assert.match(await s.page.locator('#pf-ferme').innerText(), langue === 'ar' ? /^شبكة هذه المدرسة غير مفتوحة بعد\./ : /^Le réseau de cette école n’est pas encore ouvert\./);
  assert.equal(await s.page.locator('#pf-ferme').getAttribute('role'), 'alert');
  assert.ok(await s.page.isVisible('#pf-ferme'), 'en vue, au-dessus du bouton');
  assert.equal(await s.page.locator('.toast-zone').filter({ hasText: langue === 'ar' ? 'شبكة هذه المدرسة' : FERMEE }).count(), 0, 'dit une fois, pas en plus dans un message qui s’en va');
  assert.ok(await s.page.isVisible('.auth-card.wide.onb .pf-pied .btn'), 'la dernière étape reste là');
  assert.equal(await s.page.evaluate(() => localStorage.getItem('ensam-invite-ecole')), 'ensam-casa', 'gardé jusqu’à son ouverture');
  assert.equal(site.inscrits.length, 0);
  if (langue === 'ar') assert.deepEqual(await s.page.evaluate(() => [...(window.__ensamMissing || [])].filter(x => /école|ouvert|compte|inscription/.test(x))), []);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

// ---------------------------------------------------------------------------
// La page d'entrée du lien d'une école ouverte dit son nom (sa ligne de la table des écoles) : la marque, la situation (et,
// à la dernière étape, ses longues phrases), la porte dessinée, l'onglet, en français et en arabe. Une école pas encore
// ouverte, ou inconnue : la page d'avant, sans autre nom. L'ENSAM Meknès : la page d'avant, sans rien demander de plus.
// ---------------------------------------------------------------------------
const NOMS_FES = { fr: { marque: 'Réseau ENSA Fès', diplome: 'Diplôme ENSA', etudiant: 'De la 1re à la 5e année à l’ENSA Fès', laureat: 'De l’ENSA Fès, en poste ou en recherche d’emploi' },
  ar: { marque: 'شبكة ENSA فاس', diplome: 'شهادة ENSA', etudiant: 'من السنة الأولى إلى الخامسة في ENSA فاس', laureat: 'من ENSA فاس، في وظيفة أو في بحث عن عمل' } };
const NOMS_MEKNES = { fr: { marque: 'Réseau ENSAM Meknès', diplome: 'Diplôme ENSAM', etudiant: 'De la 1re à la 5e année à l’ENSAM Meknès', laureat: 'De l’ENSAM Meknès, en poste ou en recherche d’emploi' },
  ar: { marque: 'شبكة ENSAM مكناس', diplome: 'شهادة ENSAM', etudiant: 'من السنة الأولى إلى الخامسة في ENSAM مكناس', laureat: 'من ENSAM مكناس، في وظيفة أو في بحث عن عمل' } };
// Les lectures de la table des écoles par la page (l'adresse entière : le faux Supabase ne note que le chemin)
const lecturesEcoles = ctx => { const l = []; ctx.on('request', r => { if (/\/sb\/rest\/v1\/ecoles(\?|$)/.test(r.url())) l.push(r.url()); }); return l; };
const marque = page => page.locator('.entree-marque').innerText().then(x => x.trim());
const quandMarque = (page, m) => page.waitForFunction(m => document.querySelector('.entree-marque')?.innerText.trim() === m, m, { timeout: 8000 });
async function phrasesDerniereEtape(page) {
  await page.click('#pf-role-changer'); await page.waitForSelector('#pf-je-etudiant');
  return [await page.locator('#pf-je-etudiant .small').innerText(), await page.locator('#pf-je-laureat .small').innerText()];
}

for (const langue of ['fr', 'ar']) test(`lien d’une école ouverte (${langue}) : la page d’entrée et la dernière étape disent son nom ; pas encore ouverte ou inconnue : la page d’avant ; l’ENSAM Meknès : rien de plus, pas même une lecture`, async () => {
  const N = NOMS_FES[langue], M = NOMS_MEKNES[langue], ar = langue === 'ar';
  site.tables.ecoles = [FES, CASA];
  let lues = [];
  let s = await visiteur({ largeur: 390, hauteur: 844, langue, query: '?ecole=ensa-fes', avant: ctx => { lues = lecturesEcoles(ctx); } });
  await quandMarque(s.page, N.marque);
  assert.equal(await s.page.locator('#au-je-laureat .small').innerText(), N.diplome);
  assert.equal(await s.page.locator('#au-je-etudiant .small').innerText(), ar ? 'من السنة الأولى إلى الخامسة' : '1re à 5e année');
  assert.equal(await s.page.title(), 'Réseau ENSA Fès');
  await s.page.waitForSelector('.entree-scene .scene .g-txt', { timeout: 8000 });
  assert.equal(await s.page.locator('.entree-scene .g-txt').textContent(), 'ENSA · FÈS', 'la porte dessinée');
  assert.doesNotMatch(await s.page.locator('#entree').innerText(), /Meknès|مكناس/);
  assert.equal(lues.length, 1, 'sa ligne, lue une fois');
  assert.match(lues[0], /[?&]slug=eq\.ensa-fes(&|$)/);
  await s.app();
  assert.equal(await marque(s.page), N.marque, 'l’application reprend la page telle quelle');
  await sInscrire(s.page, { role: 'laureat', email: 'karim@gmail.com' });
  assert.deepEqual(await phrasesDerniereEtape(s.page), [N.etudiant, N.laureat]);
  // Rechargée à la dernière étape (le compte est là, sans la page d'entrée) : les mêmes phrases, de sa ligne
  await s.page.reload(); await s.page.waitForSelector('.auth-card.wide.onb', { timeout: 15000 });
  assert.deepEqual(await phrasesDerniereEtape(s.page), [N.etudiant, N.laureat], 'rechargée');
  if (ar) assert.deepEqual(await s.page.evaluate(() => [...(window.__ensamMissing || [])].filter(x => /ENSA|Réseau|Diplôme|année|poste/.test(x))), []);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
  // Pas encore ouverte, ou inconnue : la page d'avant, jamais un autre nom que celui de l'ENSAM Meknès
  for (const ecole of ['ensam-casa', 'ensa-oujda']) {
    site.vider(); site.tables.ecoles = [FES, CASA];
    s = await visiteur({ largeur: 390, hauteur: 844, langue, query: `?ecole=${ecole}` });
    await quandMarque(s.page, M.marque);
    assert.equal(await s.page.locator('#au-je-laureat .small').innerText(), M.diplome, ecole);
    assert.equal(await s.page.title(), 'Réseau ENSAM Meknès', ecole);
    await s.page.waitForSelector('.entree-scene .scene .g-txt', { timeout: 8000 });
    assert.equal(await s.page.locator('.entree-scene .g-txt').textContent(), 'ENSAM · MEKNÈS', ecole);
    assert.doesNotMatch(await s.page.locator('#entree').innerText(), /Casablanca|الدار البيضاء|Fès|فاس|Oujda/, ecole);
    await sInscrire(s.page, { role: 'laureat', email: 'nawal@gmail.com' });
    assert.deepEqual(await phrasesDerniereEtape(s.page), [M.etudiant, M.laureat], ecole);
    assert.deepEqual(s.erreurs, []);
    await s.ctx.close();
  }
  // L'ENSAM Meknès (sans lien d'école, ou son lien) : la page d'avant, et pas une lecture de plus
  for (const query of ['', '?ecole=ensam-meknes']) {
    site.vider(); site.tables.ecoles = [FES, CASA];
    s = await visiteur({ largeur: 390, hauteur: 844, langue, query, avant: ctx => { lues = lecturesEcoles(ctx); } });
    assert.equal(await marque(s.page), M.marque, query);
    assert.equal(await s.page.locator('#au-je-laureat .small').innerText(), M.diplome, query);
    assert.equal(await s.page.title(), 'Réseau ENSAM Meknès', query);
    await s.app();
    assert.deepEqual(lues, [], `${query} : la page d’entrée ne lit pas la table des écoles`);
    await sInscrire(s.page, { role: 'laureat', email: 'hamza@gmail.com' });
    assert.deepEqual(await phrasesDerniereEtape(s.page), [M.etudiant, M.laureat], query);
    assert.deepEqual(s.erreurs, []);
    await s.ctx.close();
  }
});

// L'email de l'école : les domaines et la règle de l'école ouverte du lien (sa ligne, comme la base) ; sans domaine, rien n'est
// dit ; l'ENSAM Meknès garde ceux de ses réglages
const FES_EMAIL = { ...FES, domaines: ['ensa-fes.ma'] };
const reglagesObligatoire = ctx => ctx.route(/\/sb\/rest\/v1\/reglages(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ cle: 'domaines_ecole', valeur: ['ensam-umi.ac.ma'] }, { cle: 'email_ecole_obligatoire', valeur: true }]) }));
const indice = page => page.locator('.entree-form .field:has(#au-email) .field-hint').allInnerTexts().then(x => x.join(' | '));
async function emailEtudiant(page, email) {
  await page.fill('#au-email', email);
  await page.waitForFunction(() => window.ENSAM_APP, null, { timeout: 15000 });
}

test('lien d’une école ouverte : l’email de l’école, ses domaines et sa règle (« Email de l’école reconnu », indice, refus) ; sans domaine, rien ; l’ENSAM Meknès comme avant', async () => {
  const otp = () => site.appels.filter(a => a.u === '/sb/auth/v1/otp');
  // Obligatoire pour l'école du lien
  site.tables.ecoles = [{ ...FES_EMAIL, email_obligatoire: true }];
  let s = await visiteur({ largeur: 390, hauteur: 844, query: '?ecole=ensa-fes' });
  await s.page.click('#au-je-etudiant'); await emailEtudiant(s.page, 'amine@ensa-fes.ma');
  await s.page.waitForSelector('#au-ecole', { timeout: 8000 });
  assert.equal(await s.page.locator('#au-ecole').innerText(), 'Email de l’école reconnu : ton profil étudiant sera vérifié tout de suite.');
  await s.page.fill('#au-email', 'amine@ensam-umi.ac.ma');
  await s.page.waitForFunction(() => !document.getElementById('au-ecole'));
  assert.equal(await indice(s.page), 'Côté étudiants : inscris-toi avec ton email de l’école (@ensa-fes.ma). Ton compte est alors vérifié tout de suite.');
  await s.page.fill('#au-email', 'amine@gmail.com'); await s.page.check('#au-ok');
  await s.page.click('.entree-form button.btn.primary');
  await s.page.waitForSelector('.entree-form .auth-msg.err', { timeout: 8000 });
  assert.equal(await s.page.locator('.entree-form .auth-msg.err').innerText(), 'Inscris-toi avec ton email de l’école.');
  assert.equal(otp().length, 0, 'rien ne part');
  await s.page.fill('#au-email', 'amine@ensa-fes.ma'); await s.page.click('.entree-form button.btn.primary');
  await s.page.waitForSelector('#au-code');
  assert.equal(otp().pop().corps.email, 'amine@ensa-fes.ma');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
  // De préférence seulement pour l'école du lien, même quand l'ENSAM Meknès l'exige : l'email de l'école est conseillé, un
  // autre passe, et la dernière étape ne le bloque pas non plus (la règle de son école, comme la base)
  site.vider(); site.tables.ecoles = [{ ...FES_EMAIL, email_obligatoire: false }];
  s = await visiteur({ largeur: 390, hauteur: 844, query: '?ecole=ensa-fes', avant: reglagesObligatoire });
  await s.page.click('#au-je-etudiant'); await emailEtudiant(s.page, 'amine@gmail.com');
  await s.page.waitForFunction(() => /@ensa-fes\.ma/.test(document.querySelector('.entree-form .field-hint')?.textContent || ''), null, { timeout: 8000 });
  assert.equal(await indice(s.page), 'Côté étudiants : de préférence avec ton email de l’école (@ensa-fes.ma). Ton compte est alors vérifié tout de suite.');
  await s.page.check('#au-ok'); await s.page.click('.entree-form button.btn.primary');
  await s.page.waitForSelector('#au-code'); await s.page.fill('#au-code', '123456');
  await s.page.waitForSelector('.auth-card.wide.onb', { timeout: 15000 });
  await s.page.fill('#pf-name', 'Amine Alaoui'); await s.page.fill('#pf-promo', String(S + 1));
  await s.page.selectOption('#pf-fil', { index: 1 });
  assert.equal(await s.page.locator('#pf-ecole').count(), 0, 'pas la règle de l’ENSAM Meknès');
  await s.page.click('.pf-pied .btn');
  await s.page.waitForFunction(() => !document.querySelector('.auth-card.wide.onb'), null, { timeout: 15000 });
  assert.equal(site.inscrits.find(x => x.id === UID)?.ecole, 'ensa-fes');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
  // Une école ouverte sans domaine : rien n'est dit, même pour un email de l'ENSAM Meknès
  site.vider(); site.tables.ecoles = [FES];
  s = await visiteur({ largeur: 390, hauteur: 844, query: '?ecole=ensa-fes', avant: reglagesObligatoire });
  await quandMarque(s.page, 'Réseau ENSA Fès');
  await s.page.click('#au-je-etudiant'); await emailEtudiant(s.page, 'amine@ensam-umi.ac.ma');
  assert.equal(await s.page.locator('#au-ecole').count(), 0);
  await s.page.fill('#au-email', 'amine@gmail.com');
  assert.equal(await indice(s.page), '');
  await s.page.check('#au-ok'); await s.page.click('.entree-form button.btn.primary');
  await s.page.waitForSelector('#au-code');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
  // L'ENSAM Meknès : ses réglages, comme avant (l'école ouverte d'un autre lien n'y change rien)
  site.vider(); site.tables.ecoles = [{ ...FES_EMAIL, email_obligatoire: false }];
  s = await visiteur({ largeur: 390, hauteur: 844 });
  await s.page.click('#au-je-etudiant'); await emailEtudiant(s.page, 'amine@ensam-umi.ac.ma');
  await s.page.waitForSelector('#au-ecole', { timeout: 8000 });
  await s.page.fill('#au-email', 'amine@ensa-fes.ma');
  await s.page.waitForFunction(() => !document.getElementById('au-ecole'));
  assert.equal(await indice(s.page), 'Côté étudiants : de préférence avec ton email de l’école (@ensam-umi.ac.ma). Ton compte est alors vérifié tout de suite.');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});
