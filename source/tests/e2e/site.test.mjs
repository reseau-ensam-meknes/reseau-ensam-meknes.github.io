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
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
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

test('profil : s’enregistre même avec des champs vides ; rôle et promo cohérents', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Nadia'); await s.aller('profil');
  await s.page.fill('#pf-ville', 'Rabat');
  await s.page.click('form .row-end .btn.primary'); await s.page.waitForTimeout(300);
  assert.match(await s.page.locator('.toast').innerText(), /Profil enregistré/);
  await s.aller('accueil'); await s.aller('profil');
  assert.equal(await s.page.inputValue('#pf-ville'), 'Rabat');
  // Un « lauréat » d'une promo pas encore diplômée : on le lui dit, et un bouton corrige le rôle
  await s.page.fill('#pf-promo', String(new Date().getFullYear() + 1)); await s.page.waitForTimeout(150);
  assert.ok(await s.page.isVisible('#pf-incoherent'));
  assert.ok(await s.page.isDisabled('form .row-end .btn.primary'));
  await s.page.click('#pf-role-ok'); await s.page.waitForTimeout(150);
  assert.ok(!(await s.page.isVisible('#pf-incoherent')));
  assert.ok(await s.page.isEnabled('form .row-end .btn.primary'));
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

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

test('mentorat : demander, fixer l’horaire, confirmer sa présence, ignorer une demande', async () => {
  const s = await ouvrir();
  const carte = sujet => s.page.locator('.mreq', { hasText: sujet }).first();
  // Salma demande de l'aide à Youssef depuis sa fiche
  await s.comme('Salma'); await s.fiche('Youssef El Amrani');
  await s.page.click('.modal button:has-text("Demander de l’aide")'); await s.page.waitForTimeout(300);
  await s.page.click('.need-pick .chip >> nth=0'); await s.page.fill('#ah-sujet', 'Préparer mon PFE en lean');
  await s.page.click('.modal .btn.primary:has-text("Envoyer ma demande")'); await s.page.waitForTimeout(400);
  // Youssef choisit un horaire : le rendez-vous attend la confirmation de Salma
  await s.aller('accueil'); await s.comme('Youssef'); await s.aller('mentorat');
  await carte('Préparer mon PFE en lean').locator('.chip.time').first().click();
  await carte('Préparer mon PFE en lean').locator('button:has-text("Confirmer le rendez-vous")').click(); await s.page.waitForTimeout(400);
  await s.page.locator('.fete-acts .btn').last().click({ timeout: 2000 }).catch(() => {});
  assert.match(await carte('Préparer mon PFE en lean').innerText(), /Salma n’a pas encore confirmé/);
  // Salma confirme sa présence
  await s.aller('accueil'); await s.comme('Salma'); await s.aller('mentorat'); await s.page.waitForTimeout(1300);
  await s.page.locator('.fete-acts .btn').last().click({ timeout: 2000 }).catch(() => {});
  await carte('Préparer mon PFE en lean').locator('button:has-text("Je serai là")').click(); await s.page.waitForTimeout(300);
  assert.match(await carte('Préparer mon PFE en lean').innerText(), /Tu as confirmé ta présence/);
  await s.aller('accueil'); await s.comme('Youssef'); await s.aller('mentorat');
  assert.match(await carte('Préparer mon PFE en lean').innerText(), /Salma a confirmé sa présence/);
  // Une demande ouverte à tous peut être écartée : elle ne revient plus
  await s.page.click('button:has-text("Voir les autres demandes")'); await s.page.waitForTimeout(200);
  const ign = s.page.locator('.mreq button:has-text("Ignorer")');
  const avant = await ign.count(); assert.ok(avant > 0, 'au moins une demande ouverte à écarter');
  await ign.first().click(); await s.page.waitForTimeout(300);
  assert.equal(await ign.count(), avant - 1);
  // L'administration voit le suivi de l'école, et retire une demande restée sans suite
  await s.comme('Admin'); await s.aller('mentorat');
  assert.match(await s.page.locator('.page').innerText(), /Suivi de l’école/);
  const enAttente = s.page.locator('.m-section', { hasText: 'Suivi de l’école' }).locator('.mreq:has(.m-more-btn)');
  const n = await enAttente.count(); assert.ok(n > 0, 'au moins une demande en attente à retirer');
  await enAttente.first().locator('.m-more-btn').click();
  await s.page.click('[role="menuitem"]:has-text("Retirer la demande")');
  await s.page.click('.modal .btn.danger'); await s.page.waitForTimeout(300);
  assert.match(await s.page.locator('.toast').last().innerText(), /Demande retirée/);
  assert.equal(await enAttente.count(), n - 1);
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

// CV de lauréat (texte d'un PDF) ; le PDF est fabriqué dans la page puis déposé dans le champ fichier
const CV_LAUREAT = ['Yassine BERRADA', 'Ingénieur méthodes – OCP Group', 'yassine.berrada@outlook.fr · 06 61 22 33 44 · Casablanca, Maroc',
  'EXPÉRIENCE PROFESSIONNELLE', 'OCP Group, Jorf Lasfar', 'Ingénieur méthodes', 'Septembre 2021 – Aujourd\'hui',
  'FORMATION', '2016 – 2021 : Diplôme d\'ingénieur d\'État en Génie Industriel, ENSAM Meknès', 'COMPÉTENCES TECHNIQUES', 'Lean, SMED, Power BI'];
const deposerPdf = (page, champ, lignes) => page.evaluate(async ([champ, lignes]) => {
  const { pdfSimple } = await import('./store.js');
  const dt = new DataTransfer(); dt.items.add(new File([pdfSimple(lignes)], 'cv.pdf', { type: 'application/pdf' }));
  const input = document.querySelector(champ); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
}, [champ, lignes]);

test('inscription : « Tu es… » bien visible, puis tout se remplit depuis le CV', async () => {
  const s = await ouvrir({ largeur: 390, langue: 'ar' });
  // Le formulaire d'inscription (en démo, on a déjà un profil : on l'affiche seul)
  await s.page.evaluate(async () => {
    const [{ html, render }, { createStore }, { ProfileForm }] = await Promise.all([import('./vendor/preact-htm.js'), import('./store.js'), import('./community.js')]);
    const store = await createStore();
    document.getElementById('app').hidden = true;
    const el = document.body.appendChild(document.createElement('main')); el.id = 'inscription'; el.className = 'auth-card wide';
    render(html`<${ProfileForm} ctx=${{ store, act: fn => fn() }} onboarding/>`, el);
  });
  await s.page.waitForSelector('#pf-je-laureat');
  assert.ok(await s.page.isVisible('#pf-choisir'));
  assert.equal(await s.page.locator('#pf-name').count(), 0, 'le reste du formulaire attend le choix');
  assert.ok(await s.page.isDisabled('form .row-end .btn.primary'));
  await s.page.click('#pf-je-etudiant');
  assert.equal(await s.page.getAttribute('#pf-je-etudiant', 'aria-pressed'), 'true');
  assert.ok(await s.page.isVisible('#pf-name'));
  // Le CV d'un lauréat inscrit par erreur comme étudiant : rôle, promo, filière, poste et téléphone viennent du CV
  await deposerPdf(s.page, '#pf-cvfile', CV_LAUREAT);
  await s.page.waitForSelector('.cv-lu', { timeout: 15000 });
  assert.equal(await s.page.getAttribute('#pf-je-laureat', 'aria-pressed'), 'true');
  assert.equal(await s.page.inputValue('#pf-name'), 'Yassine Berrada');
  assert.equal(await s.page.inputValue('#pf-promo'), '2021');
  assert.equal(await s.page.inputValue('#pf-fil'), 'Génie Industriel');
  assert.equal(await s.page.inputValue('#pf-ent'), 'OCP Group');
  assert.equal(await s.page.inputValue('#pf-poste'), 'Ingénieur méthodes');
  assert.equal(await s.page.inputValue('#pf-tel'), '06 61 22 33 44');
  assert.ok(await s.page.isEnabled('form .row-end .btn.primary'));
  assert.ok((await s.debordement()) <= 0, 'pas de débordement à 390 px');
  await s.page.addScriptTag({ content: AXE });
  const v = await s.page.evaluate(async () => (await axe.run('#inscription', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] })).violations.map(x => x.id));
  assert.deepEqual(v, []);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('CV qui contredit ou complète le profil : le membre met à jour en un clic, l’administration lit les CV et corrige', async () => {
  const s = await ouvrir();
  await s.comme('Salma'); await s.aller('profil');
  await deposerPdf(s.page, '#cv-file', CV_LAUREAT);
  await s.page.waitForSelector('#cv-controle', { timeout: 15000 });
  assert.match(await s.page.locator('#cv-controle').innerText(), /Lauréat\(e\) · Promo 2021/);
  await s.page.click('#cv-appliquer'); await s.page.waitForTimeout(300);
  assert.match(await s.page.locator('.toast').last().innerText(), /Profil mis à jour d’après ton CV/);
  assert.equal(await s.page.locator('#cv-controle').count(), 0);
  assert.equal(await s.page.inputValue('#pf-promo'), '2021');
  assert.equal(await s.page.inputValue('#pf-poste'), 'Ingénieur méthodes', 'les champs vides se remplissent depuis le CV');
  assert.equal(await s.page.inputValue('#pf-ent'), 'OCP Group');
  // Amine dépose le même CV sans corriger : l'administration le trouve en lisant les CV déposés
  await s.comme('Amine'); await s.aller('profil');
  await deposerPdf(s.page, '#cv-file', CV_LAUREAT);
  await s.page.waitForSelector('#cv-controle', { timeout: 15000 });
  await s.comme('Admin'); await s.aller('admin/membres');
  await s.page.click('#adm-lire-cv');
  const ligne = s.page.locator('.revoir-list li', { hasText: 'Amine' });
  await ligne.waitFor({ timeout: 20000 });
  assert.match(await ligne.innerText(), /Son CV indique :\s*Lauréat\(e\) · Promo 2021/);
  await ligne.locator('button', { hasText: 'Appliquer' }).click(); await s.page.waitForTimeout(300);
  assert.match(await s.page.locator('.toast').last().innerText(), /Profil corrigé/);
  assert.equal(await s.page.locator('.revoir-list li', { hasText: 'Amine' }).count(), 0);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('lecture de CV fausse : le membre la signale, l’administration la copie pour Claude sans coordonnées, puis la classe', async () => {
  const s = await ouvrir();
  await s.ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await s.comme('Salma'); await s.aller('profil');
  await deposerPdf(s.page, '#cv-file', CV_LAUREAT);
  await s.page.waitForSelector('#cv-controle', { timeout: 15000 });
  await s.page.click('#cv-signaler');
  await s.page.fill('#cv-juste', 'Étudiante 5A, promo 2027');
  await s.page.click('#cv-signal-send'); await s.page.waitForTimeout(300);
  assert.match(await s.page.locator('.toast').last().innerText(), /L’erreur est signalée/);
  assert.equal(await s.page.locator('#cv-controle').count(), 0, 'la proposition signalée disparaît');
  await s.comme('Admin'); await s.aller('admin');
  assert.match(await s.page.locator('.callout.today').innerText(), /1 erreur de lecture de CV signalée/);
  await s.aller('admin/membres');
  const panneau = s.page.locator('#adm-lectures');
  assert.match(await panneau.innerText(), /Lu :\s*Lauréat\(e\) · Promo 2021[\s\S]*Juste :\s*Étudiante 5A, promo 2027/);
  await s.page.click('#adm-cv-copier'); await s.page.waitForTimeout(200);
  const copie = await s.page.evaluate(() => navigator.clipboard.readText());
  assert.match(copie, /Lu dans le CV : Lauréat\(e\) · Promo 2021/);
  assert.match(copie, /\| 2016 – 2021 : Diplôme d'ingénieur d'État en Génie Industriel, ENSAM Meknès/);
  assert.doesNotMatch(copie, /outlook|61 22 33|Salma/, 'ni coordonnées ni nom');
  // Relue par l'administration, la même lecture n'est plus proposée
  await s.page.click('#adm-lire-cv');
  await s.page.waitForSelector('#adm-lire-cv:not([disabled])', { timeout: 20000 });
  assert.equal(await s.page.locator('.panel:has(#adm-lire-cv) .revoir-list li', { hasText: 'Salma' }).count(), 0);
  await panneau.locator('button', { hasText: 'Classer' }).click(); await s.page.waitForTimeout(300);
  assert.match(await panneau.innerText(), /Toutes les erreurs signalées sont classées \(1\)/);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('CV en deux colonnes : les morceaux d’une ligne sont remis de gauche à droite', async () => {
  const s = await ouvrir();
  // PDF dont la colonne de droite (ville, dates) est écrite avant l'école, sur la même ligne
  const r = await s.page.evaluate(async () => {
    const [{ texteDuCV }, { parseLinkedin }] = await Promise.all([import('./lire-cv.js'), import('./parse-linkedin.js')]);
    const items = [[60, 800, 'HAJEB ABDERRAHMAN', 18], [60, 760, 'FORMATION', 13], [440, 740, 'MEKNES'], [510, 740, '2019-2024'],
      [60, 740, 'National School of Arts and Crafts-ENSAM'], [80, 726, 'Mechanical Engineering Structures and Product Engineering', 10],
      [60, 700, 'PROFESSIONAL EXPERIENCES', 13], [60, 680, 'End-of-study industrial project'], [430, 680, 'February 2024 - June 2024']];
    const flux = items.map(([x, y, t, taille = 11]) => `BT /F1 ${taille} Tf ${x} ${y} Td (${t}) Tj ET`).join('\n');
    const objets = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', `<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`];
    let out = '%PDF-1.4\n'; const pos = [];
    objets.forEach((o, i) => { pos.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n` + pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const texte = await texteDuCV(Uint8Array.from(out, c => c.charCodeAt(0) & 255).buffer);
    return { texte, promo: parseLinkedin(texte, new Date(2026, 9, 22)).promo };
  });
  assert.match(r.texte, /^National School of Arts and Crafts-ENSAM MEKNES 2019-2024$/m);
  assert.match(r.texte, /^End-of-study industrial project February 2024 - June 2024$/m);
  assert.equal(r.promo, 2024);
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
