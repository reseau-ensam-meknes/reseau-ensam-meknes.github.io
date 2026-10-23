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
const ECRANS = ['accueil', 'offres', 'offres/demandes', 'mentorat', 'mentorat/cv', 'messages', 'parcours', 'espace', 'reseau/groupes', 'reseau/agenda', 'reseau/entraide',
  'reseau/entreprises', 'reseau/etranger', 'reseau/annuaire', 'reseau/annuaire/ma-filiere', 'reseau/annuaire/ma-promo', 'reseau/classement', 'reseau/talents', 'suivi', 'profil', 'enquete',
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

test('messagerie : répondre à un message précis, réagir ; sous le nom, qui est la personne (jamais « Administration »)', async () => {
  const s = await ouvrir({ largeur: 390 });
  const id = nom => s.profils.find(x => x[1].includes(nom))[0];
  const salma = id('Salma'), youssef = id('Youssef');
  await s.comme('Salma'); await s.aller('messages/' + youssef); await s.page.waitForTimeout(300);
  await s.page.fill('#chat-txt', 'Je peux vous envoyer mon CV ici avant jeudi ?');
  await s.page.click('.composer .send-btn'); await s.page.waitForTimeout(400);
  await s.aller('accueil'); await s.comme('Youssef'); await s.aller('messages/' + salma); await s.page.waitForTimeout(300);
  const sienne = s.page.locator('.msg:not(.mine)').last();
  // Réagir : la pastille apparaît, à moi de la retirer
  await sienne.locator('.msg-more').click();
  await s.page.click('.react-btn[aria-label="Réagir avec ❤️"]'); await s.page.waitForTimeout(200);
  assert.equal(await sienne.locator('button.react-pill').getAttribute('aria-label'), 'Retirer ma réaction ❤️');
  // Répondre : le message cité s'affiche au-dessus de la zone d'écriture, puis dans la bulle envoyée
  await sienne.locator('.msg-more').click();
  await s.page.locator('.msg-actions button', { hasText: 'Répondre' }).click();
  assert.match(await s.page.locator('.comp-cite').innerText(), /Salma[\s\S]*CV ici avant jeudi/);
  assert.equal(await s.page.evaluate(() => document.activeElement?.id), 'chat-txt');
  await s.page.fill('#chat-txt', 'Oui, envoie-le ici.');
  await s.page.click('.composer .send-btn'); await s.page.waitForTimeout(400);
  assert.equal(await s.page.locator('.comp-cite').count(), 0);
  const reponse = s.page.locator('.msg.mine').last();
  assert.match(await reponse.locator('.msg-cite').innerText(), /Salma[\s\S]*CV ici avant jeudi/);
  // Toucher la citation ramène au message d'origine
  await reponse.locator('.msg-cite').click(); await s.page.waitForTimeout(150);
  assert.equal(await sienne.evaluate(e => e.classList.contains('eclaire')), true);
  assert.equal(await sienne.evaluate(e => document.activeElement === e), true, 'le message cité prend le focus');
  // Une citation et une réaction lisibles (contrastes, noms), en clair et en sombre
  await s.page.addScriptTag({ content: AXE });
  for (const theme of ['light', 'dark']) {
    await s.page.emulateMedia({ colorScheme: theme }); await s.page.waitForTimeout(100);
    await s.page.evaluate(() => document.getAnimations().forEach(a => { try { a.finish(); } catch { /* animation sans fin */ } }));
    const v = await s.page.evaluate(async () => (await axe.run('.conv', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] })).violations.map(x => `${x.id} : ${x.nodes.map(n => n.target.join(' ')).join(' ; ')}`));
    assert.deepEqual(v, [], 'citation et réaction : axe ' + theme);
  }
  await s.page.emulateMedia({ colorScheme: 'light' });
  // L'éclat s'éteint, même avec les animations réduites
  await s.page.waitForTimeout(1700);
  assert.equal(await sienne.evaluate(e => e.classList.contains('eclaire')), false);
  // Salma voit la réaction de Youssef et la citation
  await s.aller('accueil'); await s.comme('Salma'); await s.aller('messages/' + youssef); await s.page.waitForTimeout(300);
  assert.match(await s.page.locator('.msg.mine').last().locator('.react-pill').getAttribute('aria-label'), /^Réaction de Youssef : ❤️$/);
  assert.match(await s.page.locator('.msg:not(.mine)').last().locator('.msg-cite').innerText(), /^Toi/);
  await s.page.locator('.msg.mine .react-pill').click();
  assert.equal(await s.page.locator('.msg.mine .react-pill').count(), 1, 'la réaction de l’autre ne se retire pas');
  // Le même emoji des deux côtés : « 2 », et le nom accessible dit que l'autre a aussi réagi
  const mien = s.page.locator('.msg.mine').last();
  await mien.locator('.msg-more').click();
  await s.page.click('.react-btn[aria-label="Réagir avec ❤️"]'); await s.page.waitForTimeout(200);
  assert.equal(await mien.locator('button.react-pill').getAttribute('aria-label'), 'Retirer ma réaction ❤️ (Youssef aussi)');
  assert.equal(await mien.locator('.react-n').innerText(), '2');
  assert.equal(await s.page.evaluate(() => document.activeElement?.classList.contains('msg-more')), true, 'le focus revient sur les actions du message');
  await mien.locator('button.react-pill').click(); await s.page.waitForTimeout(200);
  assert.equal(await mien.locator('.react-pill').getAttribute('aria-label'), 'Réaction de Youssef : ❤️');
  // Youssef retire la sienne
  await s.aller('accueil'); await s.comme('Youssef'); await s.aller('messages/' + salma); await s.page.waitForTimeout(300);
  await s.page.locator('button.react-pill').click(); await s.page.waitForTimeout(200);
  assert.equal(await s.page.locator('.react-pill').count(), 0);
  // L'administration écrit à Salma : sous son nom, son année et sa filière ; côté Salma, « Équipe du réseau »
  await s.aller('accueil'); await s.comme('Admin'); await s.aller('messages/' + salma); await s.page.waitForTimeout(300);
  const sous = await s.page.locator('.conv-sub').innerText();
  assert.doesNotMatch(sous, /Administration/); assert.match(sous, /5A · /);
  await s.page.fill('#chat-txt', 'Bienvenue Salma !'); await s.page.click('.composer .send-btn'); await s.page.waitForTimeout(400);
  const admin = await s.page.evaluate(() => window.__demo.me.id);
  await s.aller('accueil'); await s.comme('Salma'); await s.aller('messages/' + admin); await s.page.waitForTimeout(300);
  assert.equal(await s.page.locator('.conv-sub').innerText(), 'Équipe du réseau');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('profil : « Qui voit quoi » s’enregistre dès le choix ; une mise à jour venue d’ailleurs n’efface pas ce qu’on est en train d’écrire', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Youssef'); await s.aller('profil'); await s.page.waitForTimeout(300);
  await s.page.click('#vis-lieu-contacts'); await s.page.waitForTimeout(250);
  assert.match(await s.page.locator('#vis-etat').innerText(), /Enregistré/);
  assert.equal(await s.page.locator('.pf-collant').count(), 0, 'rien d’autre à enregistrer');
  await s.page.reload(); await s.page.waitForSelector('#persona'); await s.comme('Youssef'); await s.aller('profil'); await s.page.waitForTimeout(300);
  assert.equal(await s.page.getAttribute('#vis-lieu-contacts', 'aria-checked'), 'true');
  // Il écrit sa bio sans enregistrer ; son CV met à jour son poste ailleurs : la bio reste, le poste suit
  await s.page.fill('#pf-bio', 'Bio en cours d’écriture');
  assert.equal(await s.page.locator('.pf-collant').count(), 1);
  await s.page.evaluate(() => window.__demo.update('profiles', window.__demo.me.id, { poste: 'Directeur méthodes' })); await s.page.waitForTimeout(250);
  assert.equal(await s.page.inputValue('#pf-bio'), 'Bio en cours d’écriture');
  assert.equal(await s.page.inputValue('#pf-poste'), 'Directeur méthodes');
  await s.page.click('#vis-presentation-laureats'); await s.page.waitForTimeout(250);
  assert.equal(await s.page.inputValue('#pf-bio'), 'Bio en cours d’écriture');
  await s.page.locator('.pf-collant .btn.primary').click(); await s.page.waitForTimeout(300);
  assert.equal(await s.page.locator('.pf-collant').count(), 0);
  const moi = await s.page.evaluate(() => { const m = window.__demo.me; return { bio: m.bio, poste: m.poste, vis: m.visibilite }; });
  assert.deepEqual(moi, { bio: 'Bio en cours d’écriture', poste: 'Directeur méthodes', vis: { lieu: 'contacts', presentation: 'laureats' } });
  // Une lettre tapée puis effacée : rien à enregistrer
  const ville = await s.page.inputValue('#pf-ville');
  await s.page.fill('#pf-ville', ville + 'x');
  assert.equal(await s.page.locator('.pf-collant').count(), 1);
  await s.page.fill('#pf-ville', ville);
  assert.equal(await s.page.locator('.pf-collant').count(), 0, 'la barre part quand rien ne diffère');
  // Un choix qui ne part pas (réseau coupé) reste affiché, et part avec « Enregistrer »
  await s.page.evaluate(() => { const d = window.__demo, u = d.update; d.update = async () => { d.update = u; throw new Error('Pas de réseau pour l’instant.'); }; });
  await s.page.click('#vis-cv-contacts'); await s.page.waitForTimeout(250);
  assert.equal(await s.page.getAttribute('#vis-cv-contacts', 'aria-checked'), 'true');
  assert.equal(await s.page.locator('.pf-collant').count(), 1);
  await s.page.locator('.pf-collant .btn.primary').click(); await s.page.waitForTimeout(300);
  assert.equal(await s.page.locator('.pf-collant').count(), 0);
  assert.equal(await s.page.evaluate(() => window.__demo.me.visibilite.cv), 'contacts');
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

test('partage WhatsApp : le lien direct rouvre l’offre et la question ; l’administration voit où l’inscription s’arrête', async () => {
  const s = await ouvrir();
  await s.comme('Salma'); await s.aller('offres');
  await s.page.locator('.ocard-main').first().click(); await s.page.waitForSelector('.od h2');
  const titre = await s.page.locator('.od h2').innerText();
  const msg = decodeURIComponent((await s.page.getAttribute('#od-partage', 'href')).split('https://wa.me/?text=')[1]);
  assert.ok(msg.includes(titre), msg);
  const lien = msg.match(/https?:\/\/\S+#offre\/\S+/)[0];
  await s.fermer(); await s.aller('accueil');
  await s.page.goto(lien); await s.page.reload(); await s.page.waitForSelector('.od h2');
  assert.equal(await s.page.locator('.od h2').innerText(), titre, 'le lien ouvre la même offre');
  await s.fermer();
  await s.aller('reseau/entraide'); await s.page.locator('.qrow').first().click(); await s.page.waitForSelector('#q-partage');
  const q = decodeURIComponent((await s.page.getAttribute('#q-partage', 'href')).split('text=')[1]);
  assert.match(q, /#reseau\/entraide\/\S+/);
  await s.comme('Admin'); await s.aller('admin');
  const parcours = await s.page.locator('#adm-parcours').innerText();
  assert.match(parcours, /Compte créé[\s\S]*Profil rempli[\s\S]*Première action/);
  assert.match(parcours, /Le plus grand arrêt|Personne ne s’arrête/);
  assert.match(await s.page.locator('.kpis').innerText(), /Demandes aidées en 48 h[\s\S]*Actifs cette semaine/i);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('règles du réseau : un étudiant ne voit ni points ni classement, et le lien d’une offre d’une autre année reste doux', async () => {
  const s = await ouvrir();
  // Salma (étudiante) ouvre la fiche d'un lauréat : badges de confiance seulement
  await s.comme('Salma'); await s.fiche('Youssef El Amrani');
  const fiche = await s.page.locator('.modal').innerText();
  assert.equal(await s.page.locator('.modal .profile-stats').count(), 0);
  assert.doesNotMatch(fiche, /points|Top contributeur|Lauréat du mois/i);
  await s.fermer();
  // Une offre de Salma (5A) qui n'est pas pour les 3A : son lien, ouvert par Amine (3A)
  await s.aller('offres');
  let lien = null;
  for (let i = 0; i < Math.min(6, await s.page.locator('.ocard-main').count()) && !lien; i++) {
    await s.page.locator('.ocard-main').nth(i).click(); await s.page.waitForSelector('.od h2');
    const pour = await s.page.locator('.od-facts').innerText();
    const msg = decodeURIComponent((await s.page.getAttribute('#od-partage', 'href')).split('https://wa.me/?text=')[1]);
    assert.match(msg, /Ouvre-la ici/); assert.doesNotMatch(msg, /^(Stage|PFE|Emploi) : \1/i, 'le type n’est pas répété');
    if (!/3A/.test(pour)) lien = msg.match(/https?:\/\/\S+#offre\/\S+/)[0];
    await s.fermer();
  }
  assert.ok(lien, 'une offre de 5A sans les 3A');
  await s.comme('Amine'); await s.aller('accueil');
  await s.page.goto(lien); await s.page.reload(); await s.page.waitForSelector('.modal');
  const doux = await s.page.locator('.modal').innerText();
  assert.match(doux, /Cette offre est pour les/); assert.match(doux, /Voici celles de ta 3A/);
  assert.equal(await s.page.locator('.modal .od h2').count(), 0, 'la fiche n’est pas montrée');
  await s.page.click('.modal .btn.primary:has-text("Voir mes offres")'); await s.page.waitForTimeout(300);
  assert.equal(await s.page.locator('.modal').count(), 0);
  // L'administration voit les chiffres du lauréat, et « À traiter » avant les chiffres
  await s.comme('Admin'); await s.fiche('Youssef El Amrani');
  assert.equal(await s.page.locator('.modal .profile-stats').count(), 1);
  await s.fermer(); await s.aller('admin');
  if (await s.page.locator('.callout.today').count()) {
    assert.ok(await s.page.evaluate(() => !!(document.querySelector('.callout.today').compareDocumentPosition(document.querySelector('.kpis')) & Node.DOCUMENT_POSITION_FOLLOWING)), '« À traiter » en premier');
  }
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
  // Inscription courte : le reste (coordonnées comprises, déjà remplies depuis le CV) s'ouvre au besoin
  assert.equal(await s.page.locator('#pf-tel').count(), 0);
  await s.page.click('#pf-plus');
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

test('lauréat qui cherche un emploi : il le coche, voit les offres pour lui, peut postuler, et apparaît dans la Vitrine', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Nadia'); await s.aller('profil');
  await s.page.check('#pf-recherche');
  await s.page.fill('#pf-dispo', 'Ingénieur méthodes, Casablanca');
  await s.page.click('form .row-end .btn.primary'); await s.page.waitForTimeout(300);
  assert.match(await s.page.locator('.toast').last().innerText(), /Profil enregistré/);
  await s.aller('accueil');
  assert.match(await s.page.locator('.hello-sub').innerText(), /Le réseau t’aide à trouver ton poste/);
  // Une offre « Jeunes diplômés » de sa filière : elle peut postuler
  await s.aller('offres'); await s.page.fill('#f-q', 'Safran'); await s.page.waitForTimeout(300);
  assert.equal(await s.page.locator('.ocard:has-text("Ingénieur méthodes (CDI)") .ocard-apply').count(), 1);
  // Un lauréat qui recrute la trouve dans la Vitrine des talents
  await s.comme('Youssef'); await s.aller('reseau/talents');
  await s.page.selectOption('#t-niv', 'L'); await s.page.waitForTimeout(300);
  const carte = s.page.locator('.tcard', { hasText: 'Nadia Ferhat' });
  assert.equal(await carte.count(), 1);
  assert.match(await carte.innerText(), /Cherche :\s*un emploi/);
  assert.match(await carte.innerText(), /Ingénieur méthodes, Casablanca/);
  assert.ok((await s.debordement()) <= 0);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

// Une photo « d'identité » fabriquée dans la page (dégradés et grain), en fichier image ou dans un CV en PDF
const fabriquerPortrait = () => {
  const c = document.createElement('canvas'); c.width = 240; c.height = 300;
  const g = c.getContext('2d');
  g.fillStyle = '#dfe5ea'; g.fillRect(0, 0, 240, 300);
  const peau = g.createRadialGradient(120, 120, 10, 120, 120, 80); peau.addColorStop(0, '#e2b393'); peau.addColorStop(1, '#a8714f');
  g.fillStyle = peau; g.beginPath(); g.ellipse(120, 125, 62, 80, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2b3a55'; g.fillRect(30, 230, 180, 70);
  const d = g.getImageData(0, 0, 240, 300);
  for (let i = 0; i < d.data.length; i += 4) { const n = (Math.random() - 0.5) * 30; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
  g.putImageData(d, 0, 0);
  return c;
};
const choisirPhoto = page => page.evaluate(async fab => {
  const c = new Function(`return (${fab})()`)();
  const b = await new Promise(ok => c.toBlob(ok, 'image/png'));
  const dt = new DataTransfer(); dt.items.add(new File([b], 'moi.png', { type: 'image/png' }));
  const input = document.querySelector('#photo-file'); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
}, fabriquerPortrait.toString());
// CV en PDF avec la photo en haut à droite (JPEG) et un logo plat en bas
const deposerCvAvecPhoto = (page, champ) => page.evaluate(async ([champ, fab]) => {
  const c = new Function(`return (${fab})()`)();
  const jpeg = new Uint8Array(await (await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.9))).arrayBuffer());
  const texte = s => Uint8Array.from(s, x => x.charCodeAt(0) & 255);
  const flux = 'q 110 0 0 137 440 660 cm /Im1 Do Q\nBT /F1 18 Tf 56 780 Td (Nadia Ferhat) Tj ET\nBT /F1 11 Tf 56 750 Td (Ingenieure qualite) Tj ET';
  const objets = [texte('<< /Type /Catalog /Pages 2 0 R >>'), texte('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    texte('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> /XObject << /Im1 5 0 R >> >> /Contents 6 0 R >>'),
    texte('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
    [texte(`<< /Type /XObject /Subtype /Image /Width 240 /Height 300 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, texte('\nendstream')],
    texte(`<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`)];
  const parts = [texte('%PDF-1.4\n')]; let n = parts[0].length; const pos = [];
  objets.forEach((o, i) => { pos.push(n); for (const x of [texte(`${i + 1} 0 obj\n`), ...[].concat(o), texte('\nendobj\n')]) { parts.push(x); n += x.length; } });
  parts.push(texte(`xref\n0 ${objets.length + 1}\n0000000000 65535 f \n` + pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${n}\n%%EOF`));
  const dt = new DataTransfer(); dt.items.add(new File(parts, 'cv.pdf', { type: 'application/pdf' }));
  const input = document.querySelector(champ); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
}, [champ, fabriquerPortrait.toString()]);

test('photo de profil : choisie, vue partout, retirée ; celle du CV est proposée (Mon profil, accueil), jamais mise sans accord', async () => {
  const s = await ouvrir({ largeur: 390, langue: 'ar' });
  await s.comme('Salma'); await s.aller('profil');
  await choisirPhoto(s.page);
  await s.page.waitForSelector('.photo-card .avatar img', { timeout: 10000 });
  const taille = await s.page.$eval('.photo-card .avatar img', i => [i.naturalWidth, i.naturalHeight]);
  assert.deepEqual(taille, [320, 320], 'recadrée en carré et réduite avant l’envoi');
  // Les autres la voient (annuaire)
  await s.comme('Youssef'); await s.fiche('Salma Bennani');
  assert.equal(await s.page.locator('.modal .avatar img').count() > 0, true);
  await s.fermer();
  // Retirée : les initiales reviennent
  await s.comme('Salma'); await s.aller('profil');
  await s.page.locator('.photo-card .photo-acts .btn').nth(1).click();
  await s.page.locator('.modal .btn.danger').click(); await s.page.waitForTimeout(300);
  assert.equal(await s.page.locator('.photo-card .avatar img').count(), 0);
  // Photo dans le CV : proposée dans Mon profil ; « Utiliser » la met
  await s.comme('Nadia'); await s.aller('profil');
  await deposerCvAvecPhoto(s.page, '#cv-file');
  await s.page.waitForSelector('#photo-cv', { timeout: 15000 });
  assert.equal(await s.page.locator('.photo-card .avatar img').count(), 0, 'rien sans son accord');
  await s.page.click('#photo-cv-oui');
  await s.page.waitForSelector('.photo-card .avatar img', { timeout: 10000 });
  // Déjà inscrit avec un CV : la proposition l'attend à l'accueil ; « Non merci » ne revient pas
  await s.comme('Youssef'); await s.aller('profil');
  await deposerCvAvecPhoto(s.page, '#cv-file');
  await s.page.waitForSelector('#photo-cv', { timeout: 15000 });
  await s.aller('accueil');
  await s.page.waitForSelector('.photo-home #photo-cv', { timeout: 5000 });
  assert.ok((await s.debordement()) <= 0, 'pas de débordement à 390 px');
  await s.page.click('#photo-cv-non'); await s.page.waitForTimeout(200);
  await s.aller('profil'); await s.aller('accueil'); await s.page.waitForTimeout(1500);
  assert.equal(await s.page.locator('#photo-cv').count(), 0);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('inscription : la photo trouvée dans le CV est proposée, gardée seulement si on dit oui', async () => {
  const s = await ouvrir();
  await s.page.evaluate(async () => {
    const [{ html, render }, { createStore }, { ProfileForm }] = await Promise.all([import('./vendor/preact-htm.js'), import('./store.js'), import('./community.js')]);
    const store = await createStore();
    document.getElementById('app').hidden = true;
    const el = document.body.appendChild(document.createElement('main')); el.id = 'inscription'; el.className = 'auth-card wide';
    render(html`<${ProfileForm} ctx=${{ store, act: fn => fn() }} onboarding/>`, el);
  });
  await s.page.click('#pf-je-laureat');
  await deposerCvAvecPhoto(s.page, '#pf-cvfile');
  await s.page.waitForSelector('#photo-cv', { timeout: 15000 });
  await s.page.click('#photo-cv-oui');
  assert.match(await s.page.locator('.cv-box').innerText(), /Photo gardée : elle sera sur ton profil/);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('lauréats à vérifier : CV et LinkedIn en vue ; sans CV, un message tout prêt pour le demander', async () => {
  const s = await ouvrir();
  await s.comme('Admin'); await s.aller('admin/membres');
  const ligne = s.page.locator('.verif-list li', { hasText: 'Pas de CV déposé' }).first();
  await ligne.waitFor({ timeout: 5000 });
  const nom = (await ligne.locator('.person-name').first().innerText()).split(' ')[0];
  await ligne.locator('button', { hasText: 'Demander son CV' }).click(); await s.page.waitForTimeout(400);
  const brouillon = await s.page.inputValue('#chat-txt');
  assert.match(brouillon, /^Bonjour .+, bienvenue sur le Réseau ENSAM Meknès ! Pour vérifier ton profil de lauréat\(e\), peux-tu déposer ton CV en PDF/);
  assert.ok(brouillon.includes(nom), 'le prénom du lauréat');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('administration : son propre CV se dépose dans Mon profil (sans relecture à demander), sa photo aussi', async () => {
  const s = await ouvrir();
  await s.comme('Admin'); await s.aller('profil');
  await s.page.waitForSelector('.cv-card #cv-drop', { timeout: 5000 });
  await deposerCvAvecPhoto(s.page, '#cv-file');
  await s.page.waitForSelector('.cv-card .cv-file', { timeout: 10000 });
  assert.equal(await s.page.locator('.cv-card .cv-relu').count(), 0, 'pas de relecture pour l’administration');
  await s.page.waitForSelector('#photo-cv', { timeout: 15000 });
  await s.page.click('#photo-cv-oui');
  await s.page.waitForSelector('.photo-card .avatar img', { timeout: 10000 });
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('demande d’un étudiant : il publie (CV joint), un lauréat propose, match, démarrage confirmé des deux côtés et annoncé', async () => {
  const s = await ouvrir();
  const TITRE = 'PFE en lean manufacturing, idéalement à Tanger';
  const carte = () => s.page.locator('.dm-card', { hasText: TITRE }).first();
  const fete = () => s.page.locator('.fete-acts .btn').last().click({ timeout: 2000 }).catch(() => {});
  // Salma (5A) publie ce qu'elle cherche : son CV est déjà dans son profil
  await s.comme('Salma'); await s.aller('accueil');
  assert.match(await s.page.locator('#coup-de-main').innerText(), /Dis aux lauréats ce que tu cherches/);
  await s.aller('offres/demandes');
  await s.page.click('#dm-nouvelle'); await s.page.waitForTimeout(200);
  assert.equal(await s.page.locator('.dm-form [role="radio"]').count(), 3, '5A : PFE, étranger ou emploi');
  await s.page.click('#dm-type-pfe');
  // « Publier » reste au pouce : s'il manque quelque chose, rien ne part et le premier champ à compléter est signalé
  await s.page.click('#dm-publier'); await s.page.waitForTimeout(250);
  assert.equal(await s.page.evaluate(() => document.activeElement.id), 'dm-titre', 'pas de publication sans titre ni description');
  assert.match(await s.page.locator('#dm-titre-err').innerText(), /4 caractères au moins/);
  await s.page.fill('#dm-titre', TITRE);
  await s.page.fill('#dm-details', 'Je cherche un PFE de 6 mois en lean : VSM, SMED, chantiers 5S. Mobile à Tanger et Kénitra.');
  await s.page.fill('#dm-lieu', 'Tanger');
  await s.page.click('#dm-publier'); await s.page.waitForTimeout(400); await fete();
  assert.match(await carte().innerText(), /Ouverte/);
  assert.match(await carte().innerText(), /Les lauréats de ton parcours sont prévenus/);
  // Youssef la trouve (autre parcours : « Toutes les filières »), voit le CV, propose d'encadrer
  await s.comme('Youssef'); await s.aller('offres/demandes');
  if (!(await carte().count())) await s.page.click('button:has-text("Toutes les filières")');
  assert.equal(await carte().locator('button:has-text("Voir le CV")').count(), 1, 'le CV joint est visible');
  await carte().locator('.dm-aider').click(); await s.page.waitForTimeout(200);
  await s.page.click('.dm-aide-choix:has(#dm-aide-encadre)');
  assert.equal(await s.page.inputValue('#dm-p-ent'), 'Renault Group Maroc');
  await s.page.fill('#dm-p-msg', 'Bonjour Salma, j’ai un sujet de PFE lean dans mon équipe à Tanger. Je serai ton encadrant.');
  await s.page.click('#dm-p-envoyer'); await s.page.waitForTimeout(400);
  assert.match(await s.page.locator('.toast').last().innerText(), /Proposition envoyée/);
  assert.match(await carte().innerText(), /Ton aide est envoyée/);
  // Salma : sa prochaine étape, le mot dans ses messages ; elle accepte : c'est un match.
  // Sa demande publiée termine ses premiers pas : la fête s'ouvre à l'accueil, elle la ferme.
  await s.comme('Salma'); await s.aller('accueil'); await fete();
  assert.match(await s.page.locator('.page').innerText(), /Youssef El Amrani te propose son aide : PFE en lean manufacturing/);
  await s.aller('messages');
  assert.match(await s.page.locator('main').first().innerText(), /j’ai un sujet de PFE lean dans mon équipe/);
  await s.aller('offres/demandes');
  assert.match(await carte().locator('.dm-prop').innerText(), /Encadre/);
  await carte().locator('.dm-accepter').click(); await s.page.click('.modal .btn.danger'); await s.page.waitForTimeout(400); await fete();
  assert.match(await carte().innerText(), /C’est un match/i);
  // Youssef déclare le démarrage ; Salma confirme : demande réussie, annoncée « encadré(e) par »
  await s.comme('Youssef'); await s.aller('offres/demandes');
  assert.match(await s.page.locator('.m-section', { hasText: 'Mes aides en cours' }).innerText(), new RegExp(TITRE));
  await carte().locator('.dm-demarre').click(); await s.page.waitForTimeout(200);
  await s.page.click('#dm-pl-ok'); await s.page.waitForTimeout(400);
  assert.match(await s.page.locator('.toast').last().innerText(), /Salma doit maintenant confirmer/);
  assert.match(await carte().innerText(), /En attente de la confirmation de Salma/);
  await s.comme('Salma'); await s.aller('offres/demandes');
  assert.match(await carte().innerText(), /Youssef indique que tu as commencé chez Renault Group Maroc/);
  await carte().locator('.dm-confirmer').click(); await s.page.waitForTimeout(400); await fete();
  await s.aller('offres/demandes');
  assert.match(await carte().innerText(), /Réussie/);
  await s.aller('suivi');
  assert.match(await s.page.locator('.wins').first().innerText(), /Salma Bennani a décroché son PFE chez Renault Group Maroc encadré\(e\) par Youssef El Amrani/);
  // L'administration voit les demandes en cours
  await s.comme('Admin'); await s.aller('offres/demandes');
  assert.match(await s.page.locator('.dm-page').innerText(), /ouvertes · \d+ en match · \d+ réussies/);
  assert.ok((await s.debordement()) <= 0);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

// Accueil qui guide : sur un petit Android, une seule carte, un seul bouton plein, visible sans défiler
test('accueil (360 × 640) : une carte « prochaine étape » et son seul bouton plein, visibles sans défiler ; trois petites choses au plus', async () => {
  const s = await ouvrir({ largeur: 360 });
  await s.page.setViewportSize({ width: 360, height: 640 });
  for (const [id, nom] of s.profils) {
    await s.page.selectOption('#persona', id); await s.page.waitForTimeout(300);
    await s.aller('accueil');
    if (await s.page.$('.fete-back')) await s.fermer();
    const r = await s.page.evaluate(() => {
      const go = document.querySelector('.pas .pas-go'), fond = go && getComputedStyle(go).backgroundColor;
      return { cartes: document.querySelectorAll('.home .pas').length, bas: go && go.getBoundingClientRect().bottom, nav: document.querySelector('.bottom-nav').getBoundingClientRect().top,
        pleins: [...document.querySelectorAll('.home .btn.primary')].filter(b => b.offsetParent && getComputedStyle(b).backgroundColor === fond).length,
        taches: document.querySelectorAll('.semaine .todo > li').length };
    });
    assert.equal(r.cartes, 1, `${nom} : une seule carte`);
    assert.ok(r.bas && r.bas < r.nav, `${nom} : le bouton de la carte est sous la barre du bas (${r.bas} ≥ ${r.nav})`);
    assert.equal(r.pleins, 1, `${nom} : un seul bouton plein sur l’accueil`);
    assert.ok(r.taches <= 3, `${nom} : ${r.taches} petites choses`);
  }
  assert.ok((await s.debordement()) <= 0);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('cloche : son chiffre compte ce qui attend un geste, la feuille dit « À faire » puis « Nouvelles » ; pastilles seulement où il y a à faire', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Youssef'); await s.aller('accueil');
  const chiffre = (await s.page.textContent('.cloche-btn .badge-n')).trim();
  await s.page.click('.cloche-btn'); await s.page.waitForSelector('.modal.cloche');
  assert.equal(String(await s.page.locator('.cloche .af-row').count()), chiffre);
  assert.match(await s.page.locator('.modal.cloche').innerText(), /À faire[\s\S]*Nouvelles/);
  // Un geste depuis la cloche : elle se ferme et l'écran du geste s'ouvre
  await s.page.locator('.cloche .af-row', { hasText: 'candidatures' }).locator('button').first().click(); await s.page.waitForTimeout(300);
  assert.equal(await s.page.locator('.modal.cloche').count(), 0);
  assert.match(await s.page.locator('.modal').last().innerText(), /PFE : réduction des rebuts[\s\S]*Candidats/, 'l’offre s’ouvre sur ses candidats');
  await s.fermer();
  const pastilles = () => s.page.$$eval('.bottom-nav a', as => as.filter(a => a.querySelector('.dotn')).map(a => a.innerText.trim().split('\n')[0]));
  assert.deepEqual((await pastilles()).sort(), ['Espace', 'Mentorat']);
  // Mon espace commence par « À faire »
  await s.aller('espace');
  assert.ok(await s.page.evaluate(() => document.querySelector('.page-head').nextElementSibling.classList.contains('a-faire')), 'Mon espace commence par À faire');
  // Un étudiant sans rien à faire : ni chiffre ni pastille, et la cloche le dit calmement
  await s.comme('Amine'); await s.aller('accueil');
  assert.equal(await s.page.locator('.cloche-btn .badge-n').count(), 0);
  assert.deepEqual(await pastilles(), []);
  await s.page.click('.cloche-btn'); await s.page.waitForSelector('.modal.cloche');
  assert.equal(await s.page.locator('.cloche .af-row').count(), 0);
  await s.fermer();
  // Salma : Mon parcours commence aussi par « À faire »
  await s.comme('Salma'); await s.aller('parcours');
  assert.ok(await s.page.evaluate(() => document.querySelector('.page-head').nextElementSibling.classList.contains('a-faire')), 'Mon parcours commence par À faire');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('premiers pas fondus dans la carte : la feuille s’ouvre, se masque, et se retrouve dans le menu', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Amine'); await s.aller('accueil');
  assert.match(await s.page.locator('.pas').innerText(), /Premiers pas · 1 sur 5[\s\S]*Ajouter mon CV/);
  await s.page.locator('.pas').getByText('Voir les étapes').click();
  await s.page.waitForSelector('.modal .etapes');
  assert.equal(await s.page.locator('.modal .etapes li.fait').count(), 1, 'le compte est fait');
  await s.page.click('text=Ne plus afficher les premiers pas'); await s.page.waitForTimeout(300);
  assert.equal(await s.page.locator('.modal .etapes').count(), 0);
  assert.doesNotMatch(await s.page.locator('.pas').innerText(), /Premiers pas/);
  await s.aller('accueil/etapes'); await s.page.waitForSelector('.modal .etapes');
  await s.fermer();
  assert.equal(await s.page.evaluate(() => location.hash), '#accueil');
  // La jeune lauréate sans emploi : ses premiers pas ne demandent pas d'employeur
  await s.comme('Nadia'); await s.aller('accueil');
  assert.match(await s.page.locator('.pas').innerText(), /Premiers pas · 1 sur 5[\s\S]*En poste ou en recherche d’emploi/);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('« Je peux aider » en un geste : depuis l’accueil, et depuis le lien d’une notification', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Youssef'); await s.aller('accueil');
  await s.page.locator('.bs-ligne', { hasText: 'Je peux aider' }).first().click();
  await s.page.waitForSelector('.modal:has(#dm-p-envoyer)');
  assert.match(await s.page.inputValue('#dm-p-msg'), /^Bonjour \S+/, 'le mot est déjà prêt');
  assert.equal(await s.page.evaluate(() => location.hash), '#accueil', 'on reste sur l’accueil');
  await s.fermer();
  // Le lien « Je peux aider » d'un email ou d'une notification
  const id = await s.page.evaluate(() => { const { data } = JSON.parse(localStorage.getItem('ensam-demo-v14')); const douae = data.profiles.find(p => p.full_name === 'Douae Idrissi'); return data.demandes.find(d => d.auteur_id === douae.id && d.status === 'ouverte').id; });
  await s.aller('aider/' + id); await s.page.waitForSelector('.modal:has(#dm-p-envoyer)');
  assert.match(await s.page.locator('.modal').innerText(), /Aider Douae/);
  assert.equal(await s.page.evaluate(() => location.hash), '#offres/demandes/' + id);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('feuilles : le pied « Publier » ne cache jamais le champ suivi ; « Je peux aider » dit ce qui manque ; une feuille ouverte de l’accueil garde son bouton plein', async () => {
  const s = await ouvrir({ largeur: 360 });
  await s.page.setViewportSize({ width: 360, height: 640 });
  // Tab de champ en champ dans « Publier une offre » : chaque champ reste au-dessus du pied
  await s.comme('Youssef'); await s.aller('offres');
  await s.page.click('.page-head button.btn.primary'); await s.page.waitForSelector('#of-titre');
  await s.page.focus('#of-titre');
  for (let k = 0; k < 6; k++) {
    await s.page.keyboard.press('Tab'); await s.page.waitForTimeout(80);
    const r = await s.page.evaluate(() => { const a = document.activeElement, f = document.querySelector('.modal-foot'); if (!a.closest('.modal') || f.contains(a)) return null; return { id: a.id, bas: a.getBoundingClientRect().bottom, pied: f.getBoundingClientRect().top }; });
    if (!r) break;
    assert.ok(r.bas <= r.pied + 1, `${r.id} est caché sous le pied (${r.bas} > ${r.pied})`);
  }
  await s.fermer();
  // Nadia n'a pas d'entreprise : le bouton reste actif, dit ce qui manque et y mène
  await s.comme('Nadia');
  const id = await s.page.evaluate(() => { const { data } = JSON.parse(localStorage.getItem('ensam-demo-v14')); const douae = data.profiles.find(p => p.full_name === 'Douae Idrissi'); return data.demandes.find(d => d.auteur_id === douae.id && d.status === 'ouverte').id; });
  await s.aller('aider/' + id); await s.page.waitForSelector('.modal:has(#dm-p-envoyer)');
  assert.equal(await s.page.isDisabled('#dm-p-envoyer'), false);
  await s.page.click('#dm-p-envoyer'); await s.page.waitForTimeout(400);
  assert.match(await s.page.locator('#dm-p-ent-err').innerText(), /Indique l’entreprise/);
  assert.equal(await s.page.evaluate(() => document.activeElement.id), 'dm-p-ent');
  assert.equal(await s.page.getByRole('textbox', { name: 'Entreprise', exact: true }).count(), 1, 'l’erreur n’entre pas dans le nom du champ');
  await s.page.fill('#dm-p-ent', 'Lear Corporation'); await s.page.click('#dm-p-envoyer'); await s.page.waitForTimeout(400);
  assert.match(await s.page.locator('.toast').last().innerText(), /Proposition envoyée/);
  // Amine (CV déposé) ouvre « Faire relire mon CV » depuis l'accueil : l'action de la feuille reste un bouton plein
  await s.comme('Amine');
  await s.page.evaluate(() => { const k = 'ensam-demo-v14', st = JSON.parse(localStorage.getItem(k)); const me = st.data.profiles.find(p => p.id === st.meId); me.cv_path = me.id + '/cv.pdf'; localStorage.setItem(k, JSON.stringify(st)); });
  await s.page.reload(); await s.page.waitForSelector('.hello'); await s.aller('accueil');
  if (await s.page.$('.fete-back')) await s.fermer();
  const style = sel => s.page.evaluate(x => { const c = getComputedStyle(document.querySelector(x)); return [c.backgroundColor, c.backgroundImage, c.color].join(' | '); }, sel);
  const carte = await style('.pas .pas-go');
  await s.page.locator('.coup-de-main button', { hasText: 'Faire relire mon CV' }).first().click(); await s.page.waitForSelector('.modal .btn.primary');
  assert.equal(await style('.modal .btn.primary'), carte, 'le bouton de la feuille est plein, comme celui de la carte');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('annonce : sur une ligne, seulement pour son public', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Admin'); await s.aller('admin');
  await s.page.fill('#ann-txt', 'Forum entreprises mardi pour tout le réseau');
  await s.page.locator('form:has(#ann-txt) button.primary').click(); await s.page.waitForTimeout(300);
  await s.page.fill('#ann-txt', 'Afterwork des lauréats jeudi soir à l’école');
  await s.page.click('#ann-pour-laureats');
  await s.page.locator('form:has(#ann-txt) button.primary').click(); await s.page.waitForTimeout(300);
  await s.comme('Youssef'); await s.aller('accueil');
  assert.match(await s.page.locator('.annonce-ligne').innerText(), /Afterwork des lauréats/);
  await s.comme('Amine'); await s.aller('accueil');
  assert.doesNotMatch(await s.page.locator('.home').innerText(), /Afterwork/);
  assert.match(await s.page.locator('.annonce-ligne').innerText(), /Forum entreprises mardi/, 'l’annonce pour tout le monde reste aux étudiants');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('arabe : les phrases de l’accueil sont traduites en entier, noms de repli compris', async () => {
  const s = await ouvrir({ largeur: 390, langue: 'ar' });
  const ar = await s.page.evaluate(async () => {
    const { t } = await import('./i18n.js');
    return ['Une question pour toi sur France : Où se loger à Toulouse ?', 'C’est un match avec Salma Bennani : déclare son démarrage dès qu’il a lieu.',
      'Un lauréat relit ton CV', 'Un lauréat indique t’avoir recruté(e) chez Lear', '45 lauréats sont déjà là', '2 lauréats sont déjà là, dont 1 de ta promo',
      'Tu relis le CV de Hatim Moussaoui', 'Continuer la relecture'].map(t);
  });
  assert.match(ar[0], /^سؤال موجّه إليك حول فرنسا/);
  assert.match(ar[1], /صرّح ببدئه/);
  for (const x of ar.slice(2, 4)) assert.doesNotMatch(x, /Un lauréat/, x);
  for (const x of ar.slice(4, 6)) { assert.match(x, /^انضمّ إلى الشبكة/, x); assert.doesNotMatch(x, /معك/, x); }
  assert.match(ar[6], /تراجع سيرة/);
  assert.equal(ar[7], 'متابعة المراجعة');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('un rendez-vous ne prend la carte que la veille ; Mentorat calme propose « Me rendre disponible »', async () => {
  const s = await ouvrir({ largeur: 390 });
  const demo = f => s.page.evaluate(f => { const k = 'ensam-demo-v14', st = JSON.parse(localStorage.getItem(k)); new Function('d', f)(st.data); localStorage.setItem(k, JSON.stringify(st)); }, f);
  const recharger = async () => { await s.page.reload(); await s.page.waitForSelector('.hello'); await s.page.waitForTimeout(300); if (await s.page.$('.fete-back')) await s.fermer(); };
  // Salma a un rendez-vous demain, pas encore confirmé : la carte le propose
  await s.comme('Salma'); await s.aller('accueil');
  if (await s.page.$('.fete-back')) await s.fermer();
  assert.match(await s.page.locator('.pas').getAttribute('data-pas'), /^sc/);
  assert.match(await s.page.locator('.pas .pas-go').innerText(), /Je serai là/);
  // Dans quatre jours : une ligne de « Cette semaine », la carte passe à autre chose
  await demo(`const salma = d.profiles.find(p => p.full_name.startsWith('Salma'));
    d.mentorships.find(m => m.student_id === salma.id && m.status === 'acceptee' && !m.confirme_at && new Date(m.rdv_at) > Date.now()).rdv_at = new Date(Date.now() + 4 * 864e5).toISOString();`);
  await recharger();
  assert.doesNotMatch(await s.page.locator('.pas').getAttribute('data-pas'), /^sc|^rdv/);
  assert.match(await s.page.locator('.semaine .todo').innerText(), /Confirme ta présence/);
  // Une lauréate encore invisible, sans demande : une seule action
  await s.comme('Nadia');
  await demo(`d.mentorships = d.mentorships.filter(m => m.status !== 'demande');`);
  await recharger(); await s.aller('mentorat');
  const calme = s.page.locator('.m-section').first();
  assert.match(await calme.innerText(), /Tout est calme pour l’instant/);
  assert.equal(await s.page.locator('.page .btn.primary:visible').count(), 1);
  await calme.locator('.empty button:has-text("Me rendre disponible")').click(); await s.page.waitForTimeout(300);
  assert.match(await calme.innerText(), /Tu seras prévenu\(e\)/);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('cloche : une relecture commencée reste à faire ; une note sans merci et un rendez-vous commencé n’y restent pas', async () => {
  const s = await ouvrir({ largeur: 390 });
  const demo = f => s.page.evaluate(f => { const k = 'ensam-demo-v14', st = JSON.parse(localStorage.getItem(k)); new Function('d', f)(st.data); localStorage.setItem(k, JSON.stringify(st)); }, f);
  const recharger = async () => { await s.page.reload(); await s.page.waitForSelector('.hello'); await s.page.waitForTimeout(300); if (await s.page.$('.fete-back')) await s.fermer(); };
  const cloche = async () => { await s.page.click('.cloche-btn'); await s.page.waitForSelector('.modal.cloche'); const t = await s.page.locator('.cloche .af-liste').innerText().catch(() => ''); await s.fermer(); return t; };
  // Youssef commence la relecture qu'on lui a demandée : elle reste dans « À faire » et sur l'accueil
  await s.comme('Youssef');
  await demo(`const y = d.profiles.find(p => p.full_name === 'Youssef El Amrani'); const r = d.relectures_cv.find(x => x.reviewer_id === y.id && x.status === 'demandee'); r.status = 'en_cours'; r.pris_at = new Date().toISOString();`);
  await recharger();
  assert.match(await cloche(), /Continuer la relecture/);
  assert.match(await s.page.locator('.home').innerText(), /Tu relis le CV de/);
  // Salma note la relecture sans écrire de merci, et son rendez-vous a commencé sans qu'elle ait confirmé
  await s.comme('Salma');
  await demo(`const sa = d.profiles.find(p => p.full_name.startsWith('Salma'));
    for (const r of d.relectures_cv) if (r.student_id === sa.id && r.status === 'rendue' && !r.merci) r.note = 5;
    d.mentorships.find(m => m.student_id === sa.id && m.status === 'acceptee' && !m.confirme_at && new Date(m.rdv_at) > Date.now()).rdv_at = new Date(Date.now() - 10 * 6e4).toISOString();`);
  await recharger();
  const faire = await cloche();
  assert.doesNotMatch(faire, /Lire ses conseils/, 'une note suffit : rien à faire de plus');
  assert.doesNotMatch(faire, /Confirmer ma présence/, 'le rendez-vous a commencé : plus rien à confirmer');
  assert.match(await s.page.locator('.pas .pas-oeil').innerText(), /C’est l’heure/);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

// page.goBack() = le bouton Retour du navigateur (comme celui du téléphone)
const retour = async page => { await page.goBack({ waitUntil: 'commit' }); await page.waitForTimeout(350); };
const ici = page => page.evaluate(() => location.hash);

test('Retour : ferme la feuille, puis revient à l’écran d’avant, à la même place', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Salma');
  await s.page.click('.bottom-nav a[href="#offres"]'); await s.page.waitForTimeout(300);
  await s.page.locator('.ocard-main').first().click(); await s.page.waitForSelector('.od h2');
  await retour(s.page);
  assert.equal(await s.page.locator('.modal').count(), 0, 'Retour ferme la fiche');
  assert.equal(await ici(s.page), '#offres', 'et reste sur la liste');
  await retour(s.page);
  assert.equal(await ici(s.page), '#accueil');
  // La liste reprend sa place
  await s.page.click('.bottom-nav a[href="#reseau"]'); await s.page.waitForTimeout(300);
  await s.page.click('.icon-tabs button:has-text("Entraide")'); await s.page.waitForTimeout(300);
  const ligne = s.page.locator('.qrow').nth(4); await ligne.scrollIntoViewIfNeeded();
  const avant = await s.page.evaluate(() => scrollY); assert.ok(avant > 200);
  await ligne.click(); await s.page.waitForTimeout(300);
  await retour(s.page);
  assert.ok(Math.abs(await s.page.evaluate(() => scrollY) - avant) <= 2, 'même place dans la liste');
  // « ← Toutes les questions » fait comme Retour, sans empiler
  await s.page.locator('.qrow').nth(4).click(); await s.page.waitForTimeout(300);
  await s.page.click('button.back'); await s.page.waitForTimeout(350);
  assert.ok(Math.abs(await s.page.evaluate(() => scrollY) - avant) <= 2);
  await retour(s.page);
  assert.equal(await ici(s.page), '#accueil', 'les onglets ne s’empilent pas : Retour mène à l’accueil');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('Retour : une fiche qui mène ailleurs (Écrire) ne demande qu’un Retour ; Échap et la croix ne laissent rien', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Salma'); await s.fiche('Youssef El Amrani');
  await s.page.locator('.modal .msg-btn').first().click(); await s.page.waitForTimeout(400);
  assert.match(await ici(s.page), /^#messages\//);
  await retour(s.page);
  assert.equal(await ici(s.page), '#reseau/annuaire'); assert.equal(await s.page.locator('.modal').count(), 0);
  for (const fermer of [() => s.page.keyboard.press('Escape'), () => s.page.click('.modal-head .icon-btn')]) {
    await s.page.locator('.person').first().click(); await s.page.waitForSelector('.modal');
    await fermer(); await s.page.waitForTimeout(300);
  }
  await retour(s.page);
  assert.notEqual(await ici(s.page), '#reseau/annuaire', 'aucune fiche fantôme à refermer');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('Retour : un lien « Publier ma demande » ouvert depuis les demandes garde son formulaire ouvert', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Salma'); await s.aller('offres/demandes');
  await s.page.evaluate(() => { const a = document.createElement('a'); a.href = '#offres/demandes/nouvelle'; a.id = 'lien-test'; a.textContent = 'Publier ma demande'; document.querySelector('.page').prepend(a); });
  await s.page.click('#lien-test'); await s.page.waitForTimeout(900);
  assert.equal(await ici(s.page), '#offres/demandes');
  assert.ok(await s.page.locator('.modal #dm-titre').count(), 'le formulaire de demande est resté ouvert');
  await retour(s.page);
  assert.equal(await s.page.locator('.modal').count(), 0);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('Retour jusqu’à une page d’avant l’appli (vérification d’attestation) : l’onglet Accueil ne fait pas sortir du site', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.page.goto('about:blank'); await s.page.goto(adresse + '#verifier/abc'); await s.page.waitForTimeout(600);
  await s.page.click('a[href="#accueil"]'); await s.page.waitForSelector('.hello');
  await retour(s.page);
  assert.equal(await ici(s.page), '#verifier/abc');
  await s.page.click('a[href="#accueil"]'); await s.page.waitForSelector('.hello');
  await s.page.click('.bottom-nav a[href="#reseau"]'); await s.page.waitForTimeout(400);
  await s.page.click('.icon-tabs button:has-text("Entraide")'); await s.page.waitForTimeout(300);
  await s.page.locator('.qrow').first().click(); await s.page.waitForTimeout(400);
  await s.page.click('.bottom-nav a[href="#accueil"]'); await s.page.waitForTimeout(900);
  assert.equal(await ici(s.page), '#accueil');
  assert.equal(await s.page.locator('.hello').count(), 1);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('lien WhatsApp vers une offre : après un toucher, Retour ferme la fiche, puis mène à l’accueil (pas hors du site)', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Salma'); await s.aller('offres');
  await s.page.locator('.ocard-main').first().click(); await s.page.waitForSelector('#od-partage');
  const msg = decodeURIComponent((await s.page.getAttribute('#od-partage', 'href')).split('text=')[1]);
  const lien = msg.match(/https?:\/\/\S+#offre\/\S+/)[0];
  const page = await s.ctx.newPage();
  await page.goto(adresse + 'vide.html').catch(() => {});          // une page d'avant (le 404 du serveur de test suffit)
  await page.goto(lien); await page.waitForSelector('.od h2');
  await page.locator('.modal .modal-body').click({ position: { x: 12, y: 12 } });
  await retour(page);
  assert.equal(await page.locator('.modal').count(), 0); assert.equal(await ici(page), '#offres');
  await retour(page);
  assert.equal(await ici(page), '#accueil');
  assert.ok(await page.locator('.hello').count(), 'on est toujours dans la plateforme');
  await s.ctx.close();
});

test('Retour : la cloche et « Je peux aider » se ferment sur l’accueil ; les premiers pas ouverts du menu ramènent où l’on était', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Youssef'); await s.aller('accueil');
  await s.page.click('.cloche-btn'); await s.page.waitForSelector('.modal.cloche');
  await retour(s.page);
  assert.equal(await s.page.locator('.modal').count(), 0, 'Retour ferme la cloche');
  assert.equal(await ici(s.page), '#accueil');
  await s.page.locator('.bs-ligne', { hasText: 'Je peux aider' }).first().click(); await s.page.waitForSelector('.modal:has(#dm-p-envoyer)');
  await retour(s.page);
  assert.equal(await s.page.locator('.modal').count(), 0, 'Retour ferme « Je peux aider »');
  assert.equal(await ici(s.page), '#accueil');
  // « Comment ça marche ? » depuis le menu, sur Offres : Retour ferme la feuille et ramène sur Offres
  await s.comme('Amine'); await s.aller('offres');
  await s.page.click('.me-btn'); await s.page.click('.menu-pop button:has-text("Comment ça marche ?")');
  await s.page.waitForSelector('.modal .etapes');
  await retour(s.page);
  assert.equal(await s.page.locator('.modal').count(), 0, 'Retour ferme les premiers pas');
  assert.equal(await ici(s.page), '#offres');
  // Une étape qui ouvre une feuille (« Demander un conseil ») : elle s'ouvre sur l'accueil et y reste
  await s.page.click('.me-btn'); await s.page.click('.menu-pop button:has-text("Comment ça marche ?")');
  await s.page.waitForSelector('.modal .etapes');
  await s.page.locator('.modal .etapes button', { hasText: 'Demander un conseil' }).click(); await s.page.waitForTimeout(900);
  assert.equal(await ici(s.page), '#accueil');
  assert.match(await s.page.locator('.modal').last().innerText(), /Demander de l’aide/, 'la feuille de l’étape est restée ouverte');
  await retour(s.page);
  assert.equal(await s.page.locator('.modal').count(), 0);
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
  // Échap tapé à l'instant même où la fenêtre apparaît (avant l'image suivante) : elle se ferme quand même
  await s.page.evaluate(() => { new MutationObserver((l, o) => { if (!document.querySelector('.modal')) return; o.disconnect(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }).observe(document.body, { childList: true, subtree: true }); });
  await s.page.locator('.person').first().click(); await s.page.waitForTimeout(400);
  assert.equal(await s.page.locator('.modal').count(), 0, 'Échap tapé tout de suite est perdu');
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
