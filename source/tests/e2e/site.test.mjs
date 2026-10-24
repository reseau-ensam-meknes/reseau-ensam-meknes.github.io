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
// Une nouvelle version du site publiée pendant un test : sw.js change de VERSION, et les fichiers que le service worker
// télécharge pour l'installer (fetch, sec-fetch-dest « empty ») attendent « retenue »
let nouvelleVersion = null; // { version, retenue: Promise }
before(async () => {
  assert.ok(fs.existsSync(path.join(SITE, 'index.html')), `site introuvable : ${SITE} (lance d’abord sh build.sh)`);
  const repondre = (q, r) => {
    let u = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (u.endsWith('/')) u += 'index.html';
    // config.js vide : la plateforme s'ouvre en démonstration
    if (u === '/config.js') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end("window.ENSAM_CONFIG = { supabaseUrl: '', supabaseAnonKey: '' };"); }
    const f = path.join(SITE, path.normalize(u));
    if (!f.startsWith(SITE)) { r.writeHead(403); return r.end(); }
    fs.readFile(f, (e, b) => {
      if (e) { r.writeHead(404); return r.end(); }
      if (u === '/sw.js' && nouvelleVersion) b = Buffer.from(String(b).replace(/const VERSION = '[^']*'/, `const VERSION = '${nouvelleVersion.version}'`));
      r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b);
    });
  };
  serveur = http.createServer((q, r) => {
    if (nouvelleVersion && q.headers['sec-fetch-dest'] === 'empty' && !q.url.startsWith('/sw.js')) return void nouvelleVersion.retenue.then(() => repondre(q, r));
    repondre(q, r);
  });
  await new Promise(ok => serveur.listen(0, '127.0.0.1', ok));
  adresse = `http://127.0.0.1:${serveur.address().port}/`;
  navigateur = await chromium.launch();
});
after(async () => { await navigateur?.close(); serveur?.close(); });

// Une page neuve, dans la langue voulue, avec un relevé des erreurs
// ua : le user-agent d'un vrai appareil (TELEPHONE) ; sinon celui de Chromium sur un ordinateur
// mouvement : les animations telles qu'un appareil sans « Réduire les animations » les joue
async function ouvrir({ largeur = 1280, langue = 'fr', sw = false, theme = 'light', ua, mouvement = false } = {}) {
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: largeur > 800 ? 900 : 844 }, serviceWorkers: sw ? 'allow' : 'block', colorScheme: theme, reducedMotion: mouvement ? 'no-preference' : 'reduce', ...(ua ? { userAgent: ua } : {}) });
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

// Contenu écrit par les membres de démo : chaque morceau (« Ingénieure qualité · Kénitra ») se trouve tel quel dans les graines,
// ou c'est un nom propre fait de mots des graines (« Soufiane Hajji »).
let GRAINES, MOTS_GRAINES;
function ecritParUnMembre(x) {
  GRAINES ??= ['seed.js', 'seed3.js', 'seed4.js'].map(f => fs.readFileSync(path.join(SITE, f), 'utf8')).join('\n');
  MOTS_GRAINES ??= new Set(GRAINES.match(/\p{L}[\p{L}’-]*/gu));
  return x.split(/\s+·\s+|,\s+/).map(p => p.replace(/^·\s*/, '').trim()).filter(Boolean)
    .every(p => GRAINES.includes(p) || p.split(/\s+/).every(m => /^\p{Lu}/u.test(m) && MOTS_GRAINES.has(m)));
}

for (const [largeur, langue] of [[1280, 'fr'], [390, 'ar']]) {
  test(`tous les écrans, tous les profils : sans erreur ni débordement${langue === 'ar' ? ', sans texte oublié en français' : ''} (${largeur} px, ${langue})`, async () => {
    const s = await ouvrir({ largeur, langue });
    if (langue === 'ar') assert.equal(await s.page.getAttribute('html', 'dir'), 'rtl');
    const problemes = [], oublis = new Map();
    // En arabe, chaque texte laissé en français est relevé (window.__ensamMissing), sauf ce qu'écrivent les membres de démo (noms, villes, offres, questions…)
    const lireOublis = async ou => { for (const x of await s.page.evaluate(() => { const m = [...(window.__ensamMissing || [])]; window.__ensamMissing?.clear(); return m; })) if (!oublis.has(x)) oublis.set(x, ou); };
    for (const [id, nom] of s.profils) {
      await s.page.selectOption('#persona', id); await s.page.waitForTimeout(250);
      for (const e of ECRANS) {
        await s.aller(e);
        const d = await s.debordement(); if (d > 0) problemes.push(`${nom} · ${e} : ${d} px de trop en largeur`);
        if (langue === 'ar') await lireOublis(`${nom} · ${e}`);
      }
    }
    if (langue === 'ar') {
      for (const [x, ou] of oublis) if (!ecritParUnMembre(x)) problemes.push(`${ou} : texte non traduit ${JSON.stringify(x)}`);
      // « Français » sur le bouton de langue, même après l'écran d'invitation qui traduit « Français » (langue du message)
      assert.equal(await s.page.textContent('.lang-btn .lang-long'), 'Français');
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
  // Le bouton n'est jamais grisé : il dit ce qui manque et y mène
  const bouton = 'form .row-end .btn.primary';
  assert.equal(await s.page.getAttribute(bouton, 'data-manque'), 'coherence');
  assert.match(await s.page.locator(bouton).innerText(), /Vérifie ta promo/);
  await s.page.click(bouton); await s.page.waitForTimeout(400);
  assert.equal(await s.page.evaluate(() => document.activeElement?.id), 'pf-role-ok');
  await s.page.click('#pf-role-ok'); await s.page.waitForTimeout(150);
  assert.ok(!(await s.page.isVisible('#pf-incoherent')));
  assert.equal(await s.page.getAttribute(bouton, 'data-manque'), null);
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
  await s.page.locator('.cf-home li:has-text("Amine") .btn.tonal').click(); await s.page.waitForTimeout(300);
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
  await s.page.click('.modal .btn.primary:has-text("Envoyer ces horaires")'); await s.page.waitForTimeout(400);
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
  await s.page.click('button:has-text("Voir les autres étudiants")'); await s.page.waitForTimeout(200);
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
  await s.page.click('[role="menuitem"]:has-text("Retirer ces horaires")');
  await s.page.click('.modal .btn.danger'); await s.page.waitForTimeout(300);
  assert.match(await s.page.locator('.toast').last().innerText(), /C’est retiré/);
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

test('agenda de l’école : je participe (une seule action), l’agenda proposé dans une feuille, puis je me désinscris', async () => {
  const s = await ouvrir();
  await s.comme('Salma'); await s.aller('reseau/agenda');
  const carte = s.page.locator('.ev-card').first();
  const participer = carte.locator('button.ev-participer');
  assert.equal(await carte.locator('a[href$=".ics"], a[href*="calendar.google"]').count(), 0, 'la carte ne garde que « Je participe »');
  assert.equal(await participer.getAttribute('aria-pressed'), 'false');
  await participer.click(); await s.page.waitForTimeout(300);
  assert.equal(await participer.getAttribute('aria-pressed'), 'true', 'inscrit : le bouton est sélectionné');
  // Juste après, la feuille « Ajouter à mon agenda » : Google Agenda ou fichier .ics
  assert.match(await s.page.locator('.modal').innerText(), /Ajouter à mon agenda[\s\S]*Google Agenda[\s\S]*Autre agenda \(\.ics\)/);
  await s.fermer();
  await participer.click(); await s.page.waitForTimeout(300);
  assert.equal(await participer.getAttribute('aria-pressed'), 'false');
  assert.match(await s.page.locator('.toast').last().innerText(), /tu n’y vas plus/);
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
  assert.match(msg, /promo 2027/); assert.ok(msg.includes(adresse + 'promo/2027/'));
  await s.page.click('.inv-opts .seg button:nth-child(3)');
  assert.match(await s.page.locator('.inv-msg').innerText(), /مرحبا دفعة/);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('lien de promo : sa page d’aperçu nomme la promo, puis ouvre le site avec la promo gardée et l’adresse propre', async () => {
  const s = await ouvrir();
  const brut = await (await fetch(adresse + 'promo/2019/')).text();
  assert.ok(brut.includes('<meta property="og:title" content="Promo 2019 · tes camarades sont sur le Réseau">'));
  await s.page.goto(adresse + 'promo/2019/'); await s.page.waitForSelector('.hello');
  assert.equal(await s.page.evaluate(() => localStorage.getItem('ensam-invite-promo')), '2019');
  assert.deepEqual(await s.page.evaluate(() => [location.pathname, location.search]), ['/', '']);
  // Lien arabe : la page s'ouvre en arabe pour cette visite (jamais gardé comme un choix), sauf si ce navigateur
  // a déjà choisi le français
  await s.page.evaluate(() => localStorage.removeItem('ensam-lang'));
  await s.page.goto(adresse + 'promo/2019/ar/'); await s.page.waitForSelector('.hello');
  assert.equal(await s.page.getAttribute('html', 'dir'), 'rtl');
  assert.equal(await s.page.evaluate(() => localStorage.getItem('ensam-lang')), null);
  assert.equal(await s.page.evaluate(() => sessionStorage.getItem('ensam-lang-visite')), 'ar');
  assert.deepEqual(await s.page.evaluate(() => [location.pathname, location.search]), ['/', '']);
  await s.page.evaluate(() => localStorage.setItem('ensam-lang', 'fr'));
  await s.page.goto(adresse + 'promo/2019/ar/'); await s.page.waitForSelector('.hello');
  assert.equal(await s.page.getAttribute('html', 'dir'), 'ltr');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('lien de promo avec le service worker : l’application gardée s’ouvre tout de suite, sans rechargement de secours', async () => {
  const s = await ouvrir({ sw: true });
  await s.page.waitForFunction(() => navigator.serviceWorker.getRegistration().then(r => !!r?.active), null, { timeout: 30000 });
  await s.page.reload(); await s.page.waitForSelector('.hello');
  await s.page.goto(adresse + 'promo/2019/'); await s.page.waitForSelector('.hello');
  assert.ok(await s.page.evaluate(() => !!navigator.serviceWorker.controller));
  assert.equal(await s.page.evaluate(() => sessionStorage.getItem('ensam-reprise')), null);
  assert.equal(await s.page.evaluate(() => location.pathname), '/');
  assert.equal(await s.page.evaluate(() => localStorage.getItem('ensam-invite-promo')), '2019');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('« Fais venir ta promo » : un bouton WhatsApp avec le message et le lien de la promo', async () => {
  const s = await ouvrir();
  const texte = async sel => decodeURIComponent((await s.page.getAttribute(sel, 'href')).split('text=')[1]);
  await s.comme('Nadia'); await s.aller('espace');
  assert.ok((await s.page.getAttribute('#pa-promo', 'href')).startsWith('https://wa.me/?text='));
  const nadia = await texte('#pa-promo');
  assert.ok(nadia.includes('Salut la promo 2019')); assert.ok(nadia.includes(adresse + 'promo/2019/'));
  await s.comme('Youssef'); await s.aller('espace');
  assert.match(await texte('#promo-wa'), /On est déjà \d+ de la promo 2016\./);
  assert.equal(await s.page.locator('#promo-wa.primary').count(), 0);
  await s.comme('Salma'); await s.aller('parcours');
  assert.ok((await texte('#promo-wa')).includes(adresse + 'promo/2027/'));
  assert.doesNotMatch(await texte('#promo-wa'), /points|classement/);
  // Admin > Inviter : une promo sans aucun inscrit garde le lien simple ?promo=
  await s.comme('Admin'); await s.aller('admin/inviter');
  await s.page.fill('#inv-promo', '1995'); await s.page.click('.inv-autre button');
  assert.ok((await s.page.locator('.inv-row', { hasText: 'Promo 1995' }).locator('.inv-link').innerText()).endsWith('?promo=1995'));
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('« Fais venir ta promo » en arabe : lien arabe de la promo, message en arabe ; l’admin n’a pas de carte', async () => {
  const s = await ouvrir({ largeur: 390, langue: 'ar' });
  await s.comme('Salma'); await s.aller('parcours');
  const msg = decodeURIComponent((await s.page.getAttribute('#promo-wa', 'href')).split('text=')[1]);
  assert.ok(msg.includes(adresse + 'promo/2027/ar/')); assert.ok(msg.includes('مرحبا دفعة 2027'));
  assert.equal(await s.debordement(), 0);
  await s.comme('Admin'); await s.aller('espace');
  assert.equal(await s.page.locator('#promo-card').count(), 0);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('lien partagé depuis l’arabe : ?lang=ar, en arabe pour cette visite chez qui n’a rien choisi, jamais par-dessus un choix', async () => {
  // Le lien WhatsApp d'une offre partagée depuis l'interface arabe porte la langue ; depuis le français, non
  const lienOffre = async langue => {
    const s = await ouvrir({ langue });
    await s.comme('Salma'); await s.aller('offres');
    await s.page.locator('.ocard-main').first().click(); await s.page.waitForSelector('#od-partage');
    const texte = decodeURIComponent((await s.page.getAttribute('#od-partage', 'href')).split('text=')[1]);
    assert.deepEqual(s.erreurs, []); await s.ctx.close();
    return texte.match(/https?:\/\/\S+/)[0];
  };
  const lien = await lienOffre('ar');
  assert.ok(lien.startsWith(adresse + '?lang=ar#offre/'), lien);
  assert.ok((await lienOffre('fr')).startsWith(adresse + '#offre/'));
  // Ouvert dans un navigateur neuf : en arabe pour la visite (rechargement compris), sans devenir un choix gardé
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const page = await ctx.newPage(); const erreurs = []; page.on('pageerror', e => erreurs.push(e.message));
  await page.goto(lien); await page.waitForSelector('#persona');
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
  assert.equal(await page.evaluate(() => localStorage.getItem('ensam-lang')), null);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('ensam-lang-visite')), 'ar');
  await page.reload(); await page.waitForSelector('#persona');
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
  // Quelqu'un qui a choisi le français reste en français
  await page.evaluate(() => { localStorage.setItem('ensam-lang', 'fr'); sessionStorage.clear(); });
  await page.goto(adresse + 'index.html' + lien.slice(adresse.length)); await page.waitForSelector('#persona');
  assert.equal(await page.getAttribute('html', 'dir'), 'ltr');
  assert.deepEqual(erreurs, []);
  await ctx.close();
});

test('recherche et villes : « مكناس » trouve Meknès ; en arabe, les villes s’écrivent en arabe', async () => {
  const s = await ouvrir();
  await s.comme('Salma'); await s.aller('reseau/annuaire');
  const nb = async q => { await s.page.fill('#d-q', q); await s.page.waitForTimeout(250); return Number((await s.page.innerText('#d-total')).match(/\d+/)[0]); };
  const meknes = await nb('Meknès');
  assert.ok(meknes > 0);
  assert.equal(await nb('مكناس'), meknes);
  assert.equal(await nb('MEKNES'), meknes);
  await s.ctx.close();
  const a = await ouvrir({ largeur: 390, langue: 'ar' });
  await a.comme('Salma'); await a.aller('reseau/annuaire');
  await a.page.fill('#d-q', 'مكناس'); await a.page.waitForTimeout(250);
  assert.ok(await a.page.locator('.annuaire > li').count() > 0);
  assert.match(await a.page.locator('.annuaire').innerText(), /مكناس/);
  assert.doesNotMatch(await a.page.locator('.annuaire').innerText(), /Meknès/);
  await a.aller('reseau/groupes');
  assert.match(await a.page.locator('.page').innerText(), /مكناس/, 'le groupe de la ville');
  assert.deepEqual(a.erreurs, []);
  await a.ctx.close();
});

test('preuves : dernier merci sur la carte du mentor, deux visages sur le merci de l’accueil, « peut te recommander » dans son entreprise seulement', async () => {
  const s = await ouvrir();
  await s.comme('Salma'); await s.aller('mentorat');
  const cartes = s.page.locator('.mcard');
  assert.equal(await cartes.count(), 3);
  // Le dernier merci montré (réussite confirmée ou mentorat terminé) ; aucun : rien
  const attendu = await s.page.evaluate(nom => {
    const d = window.__demo.data, p = d.profiles.find(x => x.full_name === nom);
    const m = [...d.placements.filter(x => x.laureat_id === p.id && x.merci && x.status === 'confirme').map(x => [x.merci, x.confirmed_at || x.created_at]),
      ...d.mentorships.filter(x => x.mentor_id === p.id && x.merci && x.status === 'terminee').map(x => [x.merci, x.rdv_at || x.created_at])].sort((a, b) => new Date(b[1]) - new Date(a[1]));
    return { merci: m[0]?.[0], ent: p.entreprise };
  }, 'Ismail Sebti');
  const ismail = cartes.filter({ hasText: 'Ismail Sebti' });
  assert.equal(await ismail.locator('.mcard-merci p').innerText(), `« ${attendu.merci} »`);
  assert.equal(await ismail.locator('.mcard-merci .avatar').count(), 1, 'le visage de l’étudiant');
  assert.match(await ismail.locator('.mcard-merci .merci-duo').innerText(), /·\s*(\dA|Promo \d{4})/, 'son année ou sa promo');
  assert.equal(await cartes.filter({ hasText: 'Hiba Rahmouni' }).locator('.mcard-merci').count(), 0);
  // L'entreprise n'est écrite qu'une fois sur la carte
  assert.equal((await ismail.innerText()).split(attendu.ent).length - 1, 1);
  // Accueil : le merci récent montre les deux visages, l'année, l'entreprise et la date
  await s.aller('accueil');
  const duo = s.page.locator('.merci-une .merci-duo');
  assert.equal(await duo.locator('.avatar').count(), 2);
  assert.match(await duo.innerText(), /Zineb · (\dA|Promo \d{4})[\s\S]*Karim Moussaoui · OCP Group[\s\S]*il y a/);
  // « peut te recommander » : l'auteur travaille dans l'entreprise de l'offre (Nour, chez Siemens Gamesa, ne le promet pas pour Yazaki)
  const verif = await s.page.evaluate(() => {
    const d = window.__demo.data; const nour = d.profiles.find(p => p.full_name.startsWith('Nour '));
    return { yazaki: d.offers.find(o => o.author_id === nour?.id && o.entreprise === 'Yazaki Morocco')?.id };
  });
  await s.comme('Amine'); await s.aller('offres');
  for (const c of await s.page.locator('.ocard:has(.oa-coopt)').all()) {
    const ent = (await c.locator('.ocard-meta').innerText()).split(' · ')[0].split(' ')[0].toLowerCase();
    await c.locator('.ocard-main').click(); await s.page.waitForSelector('.od-author');
    assert.ok((await s.page.locator('.od-author .role-line').innerText()).toLowerCase().includes(ent), ent);
    await s.fermer();
  }
  if (verif.yazaki) {
    await s.page.evaluate(id => { location.hash = '#offre/' + id; }, verif.yazaki); await s.page.waitForSelector('.od-author');
    assert.doesNotMatch(await s.page.locator('.od-author').innerText(), /recommander/);
    await s.fermer();
  }
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('chiffres : « 3 lauréats » plutôt que des zéros, une note à partir de 3 avis, un seul chiffre par écran', async () => {
  for (const [largeur, langue] of [[390, 'fr'], [390, 'ar']]) {
    const s = await ouvrir({ largeur, langue });
    await s.comme('Salma'); await s.aller('reseau/entreprises');
    // Le nombre de lauréats, visible sur téléphone ; aucun zéro mis en avant
    const nb = s.page.locator('.ent-row .ent-nb').first();
    assert.ok(await nb.isVisible());
    assert.match(await nb.innerText(), langue === 'ar' ? /خريج/ : /^\d+ lauréats?$/);
    for (const t of await s.page.locator('.ent-row .mini-stats > span').allInnerTexts()) assert.doesNotMatch(t, /^\s*0\s*$/);
    assert.doesNotMatch(await s.page.locator('.ent-hero').innerText(), /(^|\s)0\s/);
    assert.equal(await s.page.locator('.page-head .eyebrow').count(), 0, 'l’en-tête du Réseau ne double pas le chiffre de la page');
    // Renault : 3 avis, sa note s'affiche ; Yazaki : un seul avis, pas de moyenne
    await s.page.locator('.ent-row', { hasText: 'Renault' }).first().click(); await s.page.waitForSelector('.ent-head');
    assert.equal(await s.page.locator('.ent-synth').count(), 1);
    assert.match(await s.page.locator('.ent-big-n').innerText(), /4[,.]3/);
    await s.aller('reseau/entreprises');
    await s.page.locator('.ent-row', { hasText: 'Yazaki' }).first().click(); await s.page.waitForSelector('.ent-head');
    assert.equal(await s.page.locator('.ent-synth').count(), 0);
    assert.equal(await s.page.locator('.ent-head .ent-stars').count(), 0);
    if (langue === 'fr') assert.equal(await s.page.locator('.ent-peu').innerText(), '1 avis · La note s’affiche à partir de 3 avis.');
    else assert.match(await s.page.locator('.ent-peu').innerText(), /رأي واحد · يظهر التقييم ابتداءً من 3 آراء/);
    // Annuaire et guide de l'étranger : un seul compteur, pas de « 0 lauréat »
    await s.aller('reseau/annuaire');
    assert.equal(await s.page.locator('.page-head .eyebrow').count(), 0);
    await s.aller('reseau/etranger');
    assert.equal(await s.page.locator('.page-head .eyebrow').count(), 0);
    assert.equal(await s.page.locator('.gp-prog .mono').count(), 0);
    assert.doesNotMatch(await s.page.locator('.gp-grid').innerText(), /(^|\s)0 (lauréat|خريج)/);
    await s.aller('reseau/groupes');
    assert.match(await s.page.locator('.page-head .eyebrow').textContent(), langue === 'ar' ? /خريج/ : /^\d+ lauréats$/, 'un étudiant ne voit qu’un chiffre : les lauréats');
    if (langue === 'ar') assert.deepEqual(await s.page.evaluate(() => [...window.__ensamMissing].filter(t => /lauréat|La note s’affiche|où travaillent/.test(t))), []);
    assert.equal(await s.debordement(), 0);
    assert.deepEqual(s.erreurs, []);
    await s.ctx.close();
  }
});

// Une application installée rechargée en arrière-plan (nouvelle version) : l'écran est caché au chargement.
// __plan(etat, avance) le montre ou le cache, et avance l'horloge de la page (Date.now) de « avance » millisecondes.
const PLAN = () => {
  let v = 'hidden', d = 0;
  const vrai = Date.now.bind(Date);
  Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => v });
  Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => v === 'hidden' });
  Date.now = () => vrai() + d;
  window.__plan = (x, avance = 0) => { d += avance; if (x !== v) { v = x; document.dispatchEvent(new Event('visibilitychange')); } };
};

// Un téléphone Android
const TELEPHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
// « Me prévenir » : en démo, un test simule l'état des notifications d'un vrai téléphone (ensam-prevenir-demo)
async function prevenirSur(etat, { cachee = false, ...opts } = {}) {
  const s = await ouvrir({ largeur: 360, ua: TELEPHONE, ...opts });
  await s.page.setViewportSize({ width: 360, height: 640 });
  if (cachee) await s.ctx.addInitScript(PLAN);
  if (etat) { await s.page.evaluate(e => localStorage.setItem('ensam-prevenir-demo', e), etat); await s.page.reload(); await s.page.waitForSelector('.hello'); }
  const memo = () => s.page.evaluate(() => { const k = Object.keys(localStorage).find(x => x.startsWith('ensam-prevenir-') && x !== 'ensam-prevenir-demo'); return k ? JSON.parse(localStorage.getItem(k)) : {}; });
  const changerMemo = f => s.page.evaluate(f => { const k = Object.keys(localStorage).find(x => x.startsWith('ensam-prevenir-') && x !== 'ensam-prevenir-demo'); localStorage.setItem(k, JSON.stringify(new Function('m', 'return ' + f)(JSON.parse(localStorage.getItem(k))))); }, f);
  const mentorat = async sujet => {
    await s.fiche('Youssef El Amrani');
    await s.page.click('.modal button:has-text("Demander de l’aide")'); await s.page.waitForTimeout(300);
    await s.page.click('.need-pick .chip >> nth=0'); await s.page.fill('#ah-sujet', sujet);
    await s.page.click('.modal .btn.primary:has-text("Envoyer ces horaires")'); await s.page.waitForTimeout(700);
  };
  return { ...s, memo, changerMemo, mentorat };
}

// La feuille d'ouverture : « Reçois l'essentiel sur ton téléphone »
const ouverture = '.modal.ouverture';
const attendreOuverture = s => s.page.waitForSelector(ouverture, { timeout: 8000 });
const rienALouverture = async (s, msg) => { await s.page.waitForTimeout(4500); assert.equal(await s.page.locator(ouverture).count(), 0, msg); };
const recharger = async s => { await s.page.reload(); await s.page.waitForSelector('.hello'); };

test('« Me prévenir » : rien en démo ordinaire, le petit mot reste', async () => {
  const s = await prevenirSur(null);
  await s.comme('Amine'); await s.mentorat('Choisir mon stage de 3A');
  assert.equal(await s.page.locator('.modal.prevenir').count(), 0);
  assert.match(await s.page.locator('.toast').last().innerText(), /Horaires envoyés à Youssef/);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('« Me prévenir » : après une demande de mentorat, la feuille remplace le petit mot ; deux refus au plus, à 14 jours d’écart', async () => {
  const s = await prevenirSur('off');
  await s.comme('Amine'); await s.mentorat('Choisir mon stage de 3A');
  await s.page.waitForSelector('.modal.prevenir');
  assert.equal(await s.page.locator('.prevenir .modal-head h2, .prevenir h2').first().innerText(), 'Te prévenir de la réponse ?');
  assert.match(await s.page.locator('.modal.prevenir').innerText(), /choisit un horaire/);
  assert.match(await s.page.locator('.prevenir .verify-ok').innerText(), /Horaires envoyés à Youssef\./);
  assert.match(await s.page.locator('#pv-oui').innerText(), /Me prévenir/);
  assert.equal(await s.page.locator('.toast').count(), 0, 'pas de petit mot sous la feuille');
  assert.ok(await s.page.evaluate(() => document.querySelector('.prevenir .modal-foot').getBoundingClientRect().bottom <= innerHeight + .5));
  assert.equal(await s.debordement(), 0);
  await s.page.click('#pv-tard'); await s.page.waitForTimeout(300);
  assert.equal(await s.page.locator('.modal.prevenir').count(), 0);
  assert.equal((await s.memo()).n, 1);
  // Juste après un refus : le petit mot, pas la feuille
  await s.mentorat('Préparer mon entretien');
  assert.equal(await s.page.locator('.modal.prevenir').count(), 0);
  assert.match(await s.page.locator('.toast').last().innerText(), /Horaires envoyés à Youssef/);
  // 15 jours plus tard : une dernière fois
  await s.changerMemo('({ ...m, at: m.at - 15 * 864e5 })');
  await s.mentorat('Relire mon rapport');
  await s.page.waitForSelector('.modal.prevenir');
  await s.page.keyboard.press('Escape'); await s.page.waitForTimeout(300);
  assert.equal((await s.memo()).n, 2);
  await s.changerMemo('({ ...m, at: m.at - 30 * 864e5 })');
  await s.mentorat('Choisir une option');
  assert.equal(await s.page.locator('.modal.prevenir').count(), 0, 'plus jamais après deux refus');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('« Me prévenir » : la catégorie de la réponse décochée dans Mon profil, pas de notification promise ; le petit mot reste', async () => {
  const s = await prevenirSur('off');
  await s.comme('Amine'); await s.aller('profil');
  await s.page.click('#np-mentorat'); await s.page.waitForTimeout(250);
  await attendreOuverture(s); await s.page.click('#ouv-tard'); await s.page.waitForTimeout(300);
  await s.changerMemo('({ ...m, at: m.at - 15 * 864e5 })');
  await s.mentorat('Choisir mon stage de 3A');
  assert.equal(await s.page.locator('.modal.prevenir').count(), 0, 'mentorat décoché : pas de feuille');
  assert.match(await s.page.locator('.toast').last().innerText(), /Horaires envoyés à Youssef/);
  // Recochée : la feuille revient
  await s.aller('profil'); await s.page.click('#np-mentorat'); await s.page.waitForTimeout(250);
  await s.mentorat('Préparer mon entretien');
  await s.page.waitForSelector('.modal.prevenir');
  assert.match(await s.page.locator('.modal.prevenir').innerText(), /choisit un horaire/);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('« Me prévenir » sur iPhone, en arabe : les étapes pour ajouter le Réseau à l’écran d’accueil', async () => {
  const s = await prevenirSur('ios', { langue: 'ar' });
  await s.comme('Salma'); await s.aller('reseau/entraide');
  await s.page.click('.toolbar .btn.primary'); await s.page.waitForTimeout(200);
  await s.page.fill('#aq-titre', 'Quel logiciel apprendre avant un PFE en lean ?');
  await s.page.click('.modal form .btn.primary'); await s.page.waitForTimeout(700);
  await s.page.waitForSelector('.modal.prevenir');
  assert.equal(await s.page.getAttribute('html', 'dir'), 'rtl');
  assert.match(await s.page.locator('.modal.prevenir').innerText(), /هل نُعلمك عند وصول الرد؟/);
  assert.equal(await s.page.locator('.prevenir .ios-steps li').count(), 3);
  assert.equal((await s.page.locator('#pv-oui').innerText()).trim(), 'فهمت');
  assert.equal(await s.debordement(), 0);
  await s.page.click('#pv-oui'); await s.page.waitForTimeout(300);
  assert.equal((await s.memo()).n, 1);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('« Me prévenir » : une fête qui s’ouvre pendant la feuille passe devant ; la feuille revient plus tard, sans compter de refus', async () => {
  const s = await prevenirSur('off');
  await s.comme('Amine'); await s.mentorat('Choisir mon stage de 3A');
  await s.page.waitForSelector('.modal.prevenir');
  await s.page.evaluate(async () => {
    const ui = await import(new URL('ui.js', location.href).href);
    ui.celebrate({ cle: 'test-fete-' + Date.now(), titre: 'Bravo', texte: 'Une fête pour le test.' });
  });
  await s.page.waitForSelector('.fete-back');
  await s.page.waitForTimeout(300);
  assert.equal(await s.page.locator('.modal.prevenir').count(), 0, 'jamais deux fenêtres l’une sur l’autre');
  const m = await s.memo();
  assert.ok(!m.n, 'pas un refus');
  assert.ok(m.differe, 'gardée pour la visite suivante');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('« Me prévenir » n’arrive jamais par-dessus une fête : il attend la visite suivante ; accepté, il ne revient plus', async () => {
  const s = await prevenirSur('off');
  await s.comme('Salma'); await s.aller('offres/demandes');
  await s.page.click('#dm-nouvelle'); await s.page.waitForTimeout(200);
  await s.page.click('#dm-type-pfe');
  await s.page.fill('#dm-titre', 'PFE en maintenance prédictive');
  await s.page.fill('#dm-details', 'Je cherche un PFE de 6 mois en maintenance prédictive, à Casablanca ou à Kénitra.');
  await s.page.click('#dm-publier'); await s.page.waitForTimeout(500);
  assert.ok(await s.page.locator('.fete-back').isVisible());
  assert.equal(await s.page.locator('.modal.prevenir').count(), 0);
  assert.equal((await s.memo()).differe, 'demande');
  await s.page.goto(adresse); await s.page.waitForSelector('.hello');
  await s.comme('Salma');
  await s.page.waitForSelector('.modal.prevenir', { timeout: 4000 });
  assert.equal(await s.page.locator('.prevenir .verify-ok').count(), 0);
  assert.match(await s.page.locator('.modal.prevenir').innerText(), /te propose son aide/);
  assert.equal((await s.memo()).differe, undefined);
  await s.page.click('#pv-oui'); await s.page.waitForTimeout(300);
  assert.match(await s.page.locator('.toast').last().innerText(), /Sur la vraie plateforme/);
  assert.equal((await s.memo()).fait, 1);
  await s.mentorat('Préparer mes entretiens');
  assert.equal(await s.page.locator('.modal.prevenir').count(), 0);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

// À l'ouverture : « Reçois l'essentiel sur ton téléphone », quelques secondes après l'arrivée, sur un écran calme
test('à l’ouverture : la feuille des notifications selon le rôle ; « Plus tard » la range 7 jours, deux fois au plus', async () => {
  const s = await prevenirSur('off');
  // Pas tout de suite : quelques secondes après l'arrivée
  assert.equal(await s.page.locator(ouverture).count(), 0);
  await attendreOuverture(s);
  const txt = await s.page.locator(ouverture).innerText();
  assert.match(await s.page.locator(`${ouverture} .modal-head h2`).innerText(), /^Reçois l’essentiel sur ton téléphone$/);
  assert.match(txt, /Ce qui te concerne arrive tout de suite, même quand l’application est fermée/);
  assert.deepEqual(await s.page.$$eval(`${ouverture} .ouv-points li`, ls => ls.map(l => l.dataset.cat)), ['messages', 'demandes', 'candidatures', 'offres']);
  assert.match(txt, /Les nouvelles offres de ton année et de ta filière/);
  assert.match(txt, /Tu choisis quoi recevoir dans « Mon profil »\. Pas de publicité\./);
  assert.match(await s.page.locator('#ouv-oui').innerText(), /Activer/);
  assert.ok(await s.page.evaluate(() => document.querySelector('.ouverture .modal-foot').getBoundingClientRect().bottom <= innerHeight + .5), 'les boutons à portée du pouce');
  assert.equal(await s.debordement(), 0);
  assert.equal((await s.memo()).n, 1, 'comptée dès qu’elle s’affiche');
  await s.page.click('#ouv-tard'); await s.page.waitForTimeout(300);
  assert.equal(await s.page.locator(ouverture).count(), 0);
  assert.equal((await s.memo()).n, 1);
  // 6 jours plus tard : pas encore
  await s.changerMemo('({ ...m, at: m.at - 6 * 864e5 })');
  await recharger(s); await rienALouverture(s, 'pas avant 7 jours');
  // 8 jours après : une dernière fois (fermer compte comme « Plus tard »)
  await s.changerMemo('({ ...m, at: m.at - 2 * 864e5 })');
  await recharger(s); await attendreOuverture(s);
  await s.page.keyboard.press('Escape'); await s.page.waitForTimeout(300);
  assert.equal((await s.memo()).n, 2);
  await s.changerMemo('({ ...m, at: m.at - 30 * 864e5 })');
  await recharger(s); await rienALouverture(s, 'plus jamais après deux refus');
  // « Me prévenir » partage le mémo et le plafond : pas de feuille non plus après une demande, le petit mot reste
  await s.mentorat('Choisir mon stage');
  assert.equal(await s.page.locator('.modal.prevenir').count(), 0);
  assert.match(await s.page.locator('.toast').last().innerText(), /Horaires envoyés à Youssef/);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('à l’ouverture : affichée puis laissée sans réponse (application quittée), elle compte comme « Plus tard »', async () => {
  const s = await prevenirSur('off');
  await attendreOuverture(s);
  await recharger(s); await rienALouverture(s, 'pas à chaque visite : rien avant 7 jours');
  assert.equal((await s.memo()).n, 1);
  await s.changerMemo('({ ...m, at: m.at - 8 * 864e5 })');
  await recharger(s); await attendreOuverture(s);
  await recharger(s);
  await s.changerMemo('({ ...m, at: m.at - 30 * 864e5 })');
  await recharger(s); await rienALouverture(s, 'deux fois au plus en tout');
  assert.equal((await s.memo()).n, 2);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('à l’ouverture : rechargée cachée (nouvelle version installée), elle attend que le membre revienne ; une longue absence est une nouvelle visite', async () => {
  const s = await prevenirSur('off', { cachee: true });
  const plan = (etat, avance = 0) => s.page.evaluate(([e, a]) => window.__plan(e, a), [etat, avance]);
  // Cachée plus de 30 secondes après le chargement : rien pendant ce temps
  await s.page.waitForTimeout(3500); await plan('hidden', 35e3); await s.page.waitForTimeout(3000);
  assert.equal(await s.page.locator(ouverture).count(), 0);
  assert.deepEqual(await s.memo(), {});
  // Le membre revient : sa visite commence maintenant
  await plan('visible');
  await attendreOuverture(s);
  await s.page.click('#ouv-tard'); await s.page.waitForTimeout(300);
  await s.changerMemo('({ ...m, at: m.at - 8 * 864e5 })');
  // Revenu après quelques minutes : la même visite
  await plan('hidden'); await plan('visible', 10 * 60e3);
  await rienALouverture(s, 'même visite');
  // Revenu le lendemain, l'application restée ouverte : une nouvelle visite
  await plan('hidden'); await plan('visible', 20 * 3600e3);
  await attendreOuverture(s);
  assert.equal((await s.memo()).n, 2);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('à l’ouverture : jamais par-dessus une fête ; une fête qui arrive range la feuille sans compter de refus', async () => {
  const fete = s => s.page.evaluate(async () => {
    const ui = await import(new URL('ui.js', location.href).href);
    ui.celebrate({ cle: 'test-fete-' + Date.now(), titre: 'Bravo', texte: 'Une fête pour le test.' });
  });
  let s = await prevenirSur('off');
  await fete(s); await s.page.waitForSelector('.fete-back');
  await rienALouverture(s, 'jamais par-dessus une fête');
  assert.deepEqual(await s.memo(), {});
  await s.ctx.close();
  s = await prevenirSur('off');
  await attendreOuverture(s);
  await fete(s); await s.page.waitForSelector('.fete-back'); await s.page.waitForTimeout(300);
  assert.equal(await s.page.locator(ouverture).count(), 0, 'la fête passe devant');
  assert.ok(!(await s.memo()).n, 'pas un refus');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('à l’ouverture : rien de coché dans Mon profil, rien à proposer', async () => {
  const s = await prevenirSur('off');
  await attendreOuverture(s); await s.page.click('#ouv-tard'); await s.page.waitForTimeout(300);
  await s.aller('profil');
  for (const c of ['messages', 'demandes', 'candidatures', 'mentorat', 'offres', 'reseau']) { await s.page.click('#np-' + c); await s.page.waitForTimeout(150); }
  await s.changerMemo('({ ...m, at: m.at - 8 * 864e5 })');
  const relire = async () => { await s.page.reload(); await s.page.waitForSelector('#mes-donnees'); };
  await relire(); await rienALouverture(s, 'rien à proposer');
  // Une case recochée : la feuille revient, avec ce seul point
  await s.page.click('#np-messages'); await s.page.waitForTimeout(250);
  await relire(); await attendreOuverture(s);
  assert.deepEqual(await s.page.$$eval(`${ouverture} .ouv-points li`, ls => ls.map(l => l.dataset.cat)), ['messages']);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('Mon profil : activer ou couper les notifications ici est une réponse, plus aucune demande ensuite', async () => {
  const s = await prevenirSur('off');
  await attendreOuverture(s); await s.page.click('#ouv-tard'); await s.page.waitForTimeout(300);
  await s.changerMemo('({ ...m, at: m.at - 8 * 864e5 })');
  await s.aller('profil');
  assert.equal(await s.page.isDisabled('#md-push'), false);
  await s.page.check('#md-push'); await s.page.waitForTimeout(250);
  assert.equal((await s.memo()).fait, 1, 'activées ici');
  assert.match(await s.page.locator('.toast').last().innerText(), /Sur la vraie plateforme/);
  assert.equal(await s.page.locator('.push-row button').count(), 0, 'rien à tester en démo');
  await s.changerMemo('({ ...m, fait: undefined })');
  await s.page.uncheck('#md-push'); await s.page.waitForTimeout(250);
  assert.equal((await s.memo()).fait, 1, 'coupées ici');
  await s.page.reload(); await s.page.waitForSelector('#mes-donnees');
  await rienALouverture(s, 'coupées dans Mon profil : plus de demande');
  assert.equal(await s.page.isChecked('#md-push'), false);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('à l’ouverture : un lauréat voit ce qui le concerne ; « Activer » vaut pour « Me prévenir » aussi', async () => {
  const s = await prevenirSur('off');
  await s.comme('Youssef');
  await attendreOuverture(s);
  const txt = await s.page.locator(ouverture).innerText();
  assert.match(txt, /Ce qui te concerne arrive tout de suite/);
  // Les nouvelles offres ne sont pas activées d'office pour un lauréat qui ne cherche pas d'emploi
  assert.deepEqual(await s.page.$$eval(`${ouverture} .ouv-points li`, ls => ls.map(l => l.dataset.cat)), ['messages', 'demandes', 'candidatures', 'mentorat']);
  assert.match(txt, /Les nouvelles demandes d’étudiants de ta filière/);
  await s.page.click('#ouv-oui'); await s.page.waitForTimeout(300);
  assert.equal(await s.page.locator(ouverture).count(), 0);
  assert.match(await s.page.locator('.toast').last().innerText(), /Sur la vraie plateforme/);
  assert.equal((await s.memo()).fait, 1);
  await recharger(s); await rienALouverture(s, 'acceptée : plus jamais');
  // Un lauréat qui cherche un emploi : la suite de sa demande et de ses candidatures, et les offres pour lui
  await s.comme('Nadia');
  await s.page.evaluate(() => window.__demo.update('profiles', window.__demo.me.id, { en_recherche: true }));
  await attendreOuverture(s);
  assert.deepEqual(await s.page.$$eval(`${ouverture} .ouv-points li`, ls => ls.map(l => l.dataset.cat)), ['messages', 'demandes', 'offres', 'candidatures']);
  const rech = await s.page.locator(ouverture).innerText();
  assert.match(rech, /Les réponses à ta demande d’emploi/); assert.match(rech, /Tes candidatures qui avancent/);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('à l’ouverture : jamais par-dessus une autre feuille ni la bienvenue ; rien sur iPhone hors écran d’accueil, sans notifications ou pour l’admin', async () => {
  // Une autre fenêtre ouverte : elle attend que l'écran soit calme
  let s = await prevenirSur('off');
  await s.page.click('.cloche-btn'); await s.page.waitForSelector('.modal.cloche');
  await rienALouverture(s, 'jamais par-dessus une autre feuille');
  await s.fermer();
  await s.page.waitForSelector(ouverture, { timeout: 5000 });
  await s.ctx.close();
  // La bienvenue d'un nouveau membre : pas dans la même visite, et ce n'est pas un refus
  s = await prevenirSur('off');
  await s.comme('Amine'); await signalArrivee(s.page);
  await recharger(s); await s.page.waitForSelector('.modal.arrivee', { timeout: 5000 });
  await rienALouverture(s, 'jamais par-dessus la bienvenue');
  await s.fermer();
  await rienALouverture(s, 'pas dans la même visite que la bienvenue');
  assert.deepEqual(await s.memo(), {});
  await recharger(s); await attendreOuverture(s);
  await s.ctx.close();
  // Une fête : test à part ; l'accord à donner : entree.test.mjs (en ligne). Ici : iPhone, navigateur sans notifications, admin
  for (const etat of ['ios', 'absent']) {
    s = await prevenirSur(etat);
    await rienALouverture(s, etat);
    assert.equal(await s.page.locator('.modal.prevenir').count(), 0, etat);
    await s.ctx.close();
  }
  s = await prevenirSur('off');
  await s.comme('Admin');
  await rienALouverture(s, 'pas pour l’admin');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('à l’ouverture : « Plus tard » puis une fête dans la même visite, le refus reste compté', async () => {
  const s = await prevenirSur('off');
  await attendreOuverture(s); await s.page.click('#ouv-tard'); await s.page.waitForTimeout(300);
  assert.equal((await s.memo()).n, 1);
  await s.page.evaluate(async () => { const ui = await import(new URL('ui.js', location.href).href); ui.celebrate({ cle: 'test-fete-' + Date.now(), titre: 'Bravo', texte: 'Une fête.' }); });
  await s.page.waitForSelector('.fete-back'); await s.page.waitForTimeout(300);
  assert.equal((await s.memo()).n, 1, '« Plus tard » reste compté');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('à l’ouverture : écran occupé plus de 30 s, la feuille attend la visite suivante', async () => {
  const s = await prevenirSur('off', { cachee: true });
  const plan = (etat, avance = 0) => s.page.evaluate(([e, a]) => window.__plan(e, a), [etat, avance]);
  await plan('visible');
  await s.page.click('.cloche-btn'); await s.page.waitForSelector('.modal.cloche');
  await s.page.waitForTimeout(3500);
  await plan('visible', 31e3);
  await s.page.waitForTimeout(3000);
  await s.fermer();
  await rienALouverture(s, 'trop tard dans la visite : à la visite suivante');
  assert.deepEqual(await s.memo(), {});
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('Mon profil : deux cases touchées coup sur coup sont enregistrées toutes les deux', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Salma'); await s.aller('profil');
  await s.page.evaluate(() => { const d = window.__demo; const u = d.update.bind(d); d.update = (...a) => new Promise(ok => setTimeout(ok, 400)).then(() => u(...a)); });
  await s.page.click('#np-reseau'); await s.page.click('#np-offres');
  await s.page.waitForTimeout(1500);
  assert.deepEqual(await s.page.evaluate(() => window.__demo.me.notif_push), { reseau: false, offres: false });
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('Mon profil : un choix qui n’a pas pu être enregistré n’est pas montré comme fait ; réessayé, c’est bien le sien', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Salma'); await s.aller('profil');
  assert.equal(await s.page.isChecked('#np-reseau'), true);
  await s.page.evaluate(() => { const d = window.__demo; d.__update = d.update; d.update = async () => { throw new Error('Pas de réseau pour l’instant. Réessaie dans un instant.'); }; });
  await s.page.click('#np-reseau'); await s.page.waitForTimeout(300);
  assert.match(await s.page.locator('.toast').last().innerText(), /Pas de réseau/);
  assert.equal(await s.page.isChecked('#np-reseau'), true, 'la case revient à ce qui est enregistré');
  assert.deepEqual(await s.page.evaluate(() => window.__demo.me.notif_push), {});
  // Le réseau revenu, le même geste enregistre ce que le membre voulait
  await s.page.evaluate(() => { const d = window.__demo; d.update = d.__update; delete d.__update; });
  await s.page.click('#np-reseau'); await s.page.waitForTimeout(300);
  assert.match(await s.page.locator('.toast').last().innerText(), /Choix enregistré/);
  assert.equal(await s.page.isChecked('#np-reseau'), false);
  assert.deepEqual(await s.page.evaluate(() => window.__demo.me.notif_push), { reseau: false });
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('à l’ouverture : jamais sous la photo agrandie d’un message ; elle vient une fois la photo fermée', async () => {
  const s = await prevenirSur('off');
  const id = nom => s.profils.find(x => x[1].includes(nom))[0];
  const salma = id('Salma'), youssef = id('Youssef');
  await s.comme('Salma');
  // Une photo de Youssef (une url : en démo, les fichiers envoyés ne vivent que dans l'onglet)
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await s.page.evaluate(([y, sa, png]) => {
    const d = window.__demo;
    d.data.messages.push({ id: 'photo-test-1', author_id: y, dest_id: sa, type: 'photo', body: null, fichier: 'x/y/z.png', url: png, largeur: 400, hauteur: 300, created_at: new Date().toISOString(), lu_at: null });
    d.persist(); location.hash = 'messages/' + y;
  }, [youssef, salma, png]);
  // Nouvelle visite, droit dans la conversation : la photo touchée dès l'arrivée
  await s.page.reload(); await s.page.waitForSelector('.msg-photo img');
  await s.page.click('.msg-photo'); await s.page.waitForSelector('.visionneuse');
  await rienALouverture(s, 'jamais sous la photo agrandie');
  assert.deepEqual(await s.memo(), {}, 'rien de compté sans avoir été vue');
  await s.page.click('.visionneuse .icon-btn'); await s.page.waitForTimeout(200);
  assert.equal(await s.page.locator('.visionneuse').count(), 0);
  await attendreOuverture(s);
  assert.equal((await s.memo()).n, 1);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('à l’ouverture : jamais pendant que le membre écrit ni sur un menu ouvert ; elle vient ensuite', async () => {
  let s = await prevenirSur('off');
  await s.aller('reseau/annuaire');
  await s.page.click('#d-q'); await s.page.keyboard.type('Youss');
  await rienALouverture(s, 'pas pendant la saisie');
  assert.deepEqual(await s.memo(), {});
  await s.page.evaluate(() => document.activeElement.blur());
  await attendreOuverture(s);
  await s.ctx.close();
  s = await prevenirSur('off');
  await s.page.click('.me-btn'); await s.page.waitForSelector('.menu-pop');
  await rienALouverture(s, 'pas sur un menu ouvert');
  await s.page.click('.me-btn'); await s.page.waitForTimeout(200);
  assert.equal(await s.page.locator('.menu-pop').count(), 0);
  await attendreOuverture(s);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('à l’ouverture sur un ordinateur : la feuille parle de cet ordinateur, pas du téléphone (fr, ar)', async () => {
  const s = await ouvrir();
  const titre = () => s.page.locator(`${ouverture} .modal-head h2`).innerText();
  await s.page.evaluate(() => localStorage.setItem('ensam-prevenir-demo', 'off'));
  await recharger(s); await attendreOuverture(s);
  assert.equal(await titre(), 'Reçois l’essentiel sur cet ordinateur');
  await s.page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('ensam-prevenir-') && k !== 'ensam-prevenir-demo') localStorage.removeItem(k);
    localStorage.setItem('ensam-lang', 'ar');
  });
  await recharger(s); await attendreOuverture(s);
  assert.equal(await s.page.getAttribute('html', 'dir'), 'rtl');
  assert.equal(await titre(), 'الأهم يصلك على هذا الحاسوب');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('à l’ouverture : jamais pendant qu’une nouvelle version peut recharger la page ; affichée ensuite, elle reste et compte une fois', async () => {
  const s = await prevenirSur('off', { sw: true });
  let liberer = () => {};
  try {
    await s.page.waitForFunction(() => navigator.serviceWorker.getRegistration().then(r => !!r?.active), null, { timeout: 30000 });
    await recharger(s);
    assert.ok(await s.page.evaluate(() => !!navigator.serviceWorker.controller));
    // Un membre jamais sollicité sur cet appareil ; une nouvelle version du site vient d'être publiée
    await s.page.evaluate(() => localStorage.removeItem('ensam-prevenir-' + window.__demo.me.id));
    nouvelleVersion = { version: 'test-' + Date.now(), retenue: new Promise(ok => { liberer = ok; }) };
    let chargements = 0;
    s.page.on('load', () => { chargements++; });
    await recharger(s);
    // Elle s'installe pendant les premières secondes de la visite, juste après le moment où la feuille venait (3 s) :
    // la page se recharge alors d'elle-même
    const tropTot = await s.page.waitForSelector(ouverture, { timeout: 3000 }).then(() => true, () => false);
    liberer();
    for (let i = 0; i < 80 && chargements < 2; i++) await s.page.waitForTimeout(100);
    assert.equal(chargements, 2, 'la nouvelle version recharge la page');
    assert.equal(tropTot, false, 'pas de feuille tant que la page peut encore se recharger');
    await s.page.waitForSelector('.hello');
    assert.deepEqual(await s.memo(), {}, 'rien de compté sans avoir été vue');
    // Une fois la page stable : la feuille, qui reste à l'écran
    await s.page.waitForSelector(ouverture, { timeout: 15000 });
    assert.ok(await s.page.evaluate(() => performance.now()) > 8000, 'pas avant la fin de la fenêtre des mises à jour');
    await s.page.waitForTimeout(1500);
    assert.equal(await s.page.locator(ouverture).count(), 1);
    assert.equal(chargements, 2);
    assert.equal((await s.memo()).n, 1);
    assert.deepEqual(s.erreurs, []);
  } finally {
    liberer(); nouvelleVersion = null;
    await s.ctx.close();
  }
});

test('Mon profil : les notifications par catégorie, défauts selon le rôle, enregistrées et relues après rechargement', async () => {
  const s = await ouvrir({ largeur: 390 });
  const cases = () => s.page.$$eval('.md-cats input[type=checkbox]', xs => Object.fromEntries(xs.map(x => [x.id.replace('np-', ''), x.checked])));
  const tout = { messages: true, demandes: true, candidatures: true, mentorat: true, offres: true, reseau: true };
  await s.comme('Salma'); await s.aller('profil');
  assert.deepEqual(await cases(), tout);
  const etu = await s.page.locator('.md-cats').innerText();
  assert.match(etu, /Mes demandes : les propositions d’aide/); assert.match(etu, /Nouvelles offres pour moi/);
  assert.match(etu, /Tes choix valent pour tous les appareils où les notifications sont activées\./);
  // L'ancienne case « M'alerter… » est devenue « Nouvelles offres pour moi » ; l'email des offres garde sa case
  assert.equal(await s.page.locator('#md-alertes').count(), 0);
  assert.ok(await s.page.isChecked('#md-alertes-mail'));
  await s.page.click('#np-reseau'); await s.page.waitForTimeout(250);
  assert.match(await s.page.locator('.toast').last().innerText(), /Choix enregistré/);
  // Visite suivante : le choix d'avant est gardé quand une autre case change
  await s.page.reload(); await s.page.waitForSelector('#mes-donnees');
  await s.page.click('#np-offres'); await s.page.waitForTimeout(250);
  await s.page.reload(); await s.page.waitForSelector('#mes-donnees');
  assert.deepEqual(await cases(), { ...tout, offres: false, reseau: false });
  assert.deepEqual(await s.page.evaluate(() => window.__demo.me.notif_push), { reseau: false, offres: false });
  assert.ok(await s.page.isChecked('#md-alertes-mail'), 'l’email ne change pas');
  // Lauréat : les demandes de sa filière ; les offres seulement s'il cherche un emploi
  await s.comme('Youssef'); await s.aller('profil');
  assert.deepEqual(await cases(), { ...tout, offres: false });
  const lau = await s.page.locator('.md-cats').innerText();
  assert.match(lau, /Demandes des étudiants de ma filière/); assert.match(lau, /Candidatures reçues sur mes offres/);
  assert.doesNotMatch(lau, /Mes demandes : les propositions d’aide/);
  // Un lauréat pose aussi des questions : la case qui les coupe le dit
  assert.match(lau, /Questions et vie du réseau/); assert.match(lau, /Réponses à tes questions, questions sur ton entreprise ou ton pays/);
  // Tout lauréat peut postuler ; les offres n'arrivent qu'avec « Je cherche un emploi en ce moment » : le texte le dit
  assert.match(lau, /si tu postules, la suite de tes candidatures/);
  assert.match(lau, /Avec « Je cherche un emploi en ce moment » coché dans ton profil/);
  assert.equal(await s.page.locator('#md-alertes-mail').count(), 0);
  await s.page.click('#np-offres'); await s.page.waitForTimeout(250);
  await s.page.reload(); await s.page.waitForSelector('#mes-donnees');
  assert.equal(await s.page.isChecked('#np-offres'), true);
  // Un lauréat qui cherche un emploi : ses demandes et ses candidatures aussi ; les offres d'office
  await s.comme('Nadia');
  await s.page.evaluate(() => window.__demo.update('profiles', window.__demo.me.id, { en_recherche: true }));
  await s.aller('profil');
  const rech = await s.page.locator('.md-cats').innerText();
  assert.match(rech, /Les réponses à ta demande d’emploi/); assert.match(rech, /La suite des tiennes \(entretien, recrutement à confirmer\)/);
  assert.doesNotMatch(rech, /Candidatures reçues sur mes offres/);
  assert.equal(await s.page.isChecked('#np-offres'), true);
  // L'équipe du réseau : les signalements arrivent toujours (pas de case) ; ni nouvelles demandes ni offres, qui ne lui arrivent jamais
  await s.comme('Admin'); await s.aller('profil');
  const adm = await s.page.locator('.md-cats').innerText();
  assert.match(adm, /Les signalements arrivent toujours à l’équipe du réseau\./);
  // Les questions sur une entreprise ou un pays ne vont qu'aux lauréats : l'admin reçoit les réponses aux siennes
  assert.match(adm, /Réponses à mes questions et vie du réseau/); assert.doesNotMatch(adm, /questions sur ton entreprise|Questions qui me sont adressées/);
  assert.equal(await s.page.locator('#np-admin').count(), 0);
  assert.deepEqual(await cases(), { messages: true, candidatures: true, mentorat: true, reseau: true });
  assert.equal(await s.debordement(), 0);
  await s.page.addScriptTag({ content: AXE });
  const v = await s.page.evaluate(async () => (await axe.run('#mes-donnees', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] })).violations.map(x => x.id));
  assert.deepEqual(v, []);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('notifications en arabe : la feuille d’ouverture et les réglages, sans texte oublié', async () => {
  const s = await prevenirSur('off', { langue: 'ar' });
  const latin = sel => s.page.locator(sel).innerText().then(t => t.match(/[A-Za-zÀ-ÿ]{2,}/g) || []);
  await attendreOuverture(s);
  assert.equal(await s.page.getAttribute('html', 'dir'), 'rtl');
  assert.match(await s.page.locator(ouverture).innerText(), /الأهم يصلك على هاتفك/);
  assert.equal((await s.page.locator('#ouv-oui').innerText()).trim(), 'تفعيل');
  assert.deepEqual(await latin(ouverture), []);
  assert.equal(await s.debordement(), 0);
  await s.page.click('#ouv-tard'); await s.page.waitForTimeout(300);
  await s.comme('Youssef'); await attendreOuverture(s);
  assert.deepEqual(await latin(ouverture), [], 'lauréat');
  await s.page.click('#ouv-tard'); await s.page.waitForTimeout(300);
  await s.comme('Nadia');
  await s.page.evaluate(() => window.__demo.update('profiles', window.__demo.me.id, { en_recherche: true }));
  await attendreOuverture(s);
  assert.deepEqual(await latin(ouverture), [], 'lauréat qui cherche un emploi');
  await s.page.click('#ouv-tard'); await s.page.waitForTimeout(300);
  for (const nom of ['Salma', 'Youssef', 'Nadia', 'Admin']) {
    await s.comme(nom); await s.aller('profil');
    await s.page.waitForSelector('.md-cats');
    assert.deepEqual(await latin('.md-cats'), [], nom);
    assert.deepEqual((await latin('#mes-donnees')).filter(x => x !== 'ENSAM'), [], nom);
    assert.equal(await s.debordement(), 0);
  }
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('construction : pages de promo et image d’aperçu présentes, mais pas gardées par le service worker', () => {
  const sw = fs.readFileSync(path.join(SITE, 'sw.js'), 'utf8');
  assert.doesNotMatch(sw.match(/const FICHIERS = (\[.*?\]);/)[1], /"promo\//);
  assert.ok(fs.statSync(path.join(SITE, 'img/apercu-promo.jpg')).size < 300_000);
  assert.ok(fs.existsSync(path.join(SITE, 'promo/2040/ar/index.html')));
});

test('partage WhatsApp : le lien direct rouvre l’offre et la question ; l’administration voit où l’inscription s’arrête', async () => {
  const s = await ouvrir();
  await s.comme('Salma'); await s.aller('offres');
  await s.page.locator('.ocard-main').first().click(); await s.page.waitForSelector('.od h2');
  const titre = await s.page.locator('.od h2').innerText();
  const msg = decodeURIComponent((await s.page.getAttribute('#od-partage', 'href')).split('https://wa.me/?text=')[1]);
  // La fiche ne répète pas le type (« PFE : ») déjà dit par l’étiquette ; le message, lui, le garde
  assert.ok(msg.toLowerCase().includes(titre.toLowerCase()), msg);
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
  assert.equal(await s.page.getAttribute('form .row-end .btn.primary', 'data-manque'), 'role');
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
  // Un lauréat dit s'il peut aider : c'est la seule chose qui manque encore
  assert.equal(await s.page.getAttribute('form .row-end .btn.primary', 'data-manque'), 'aide');
  await s.page.click('#pf-aide-oui');
  assert.equal(await s.page.getAttribute('form .row-end .btn.primary', 'data-manque'), null);
  // Inscription courte : le reste (entreprise, coordonnées, déjà remplies depuis le CV) s'ouvre au besoin
  assert.equal(await s.page.locator('#pf-ent').count(), 0);
  assert.equal(await s.page.locator('#pf-tel').count(), 0);
  await s.page.click('#pf-plus');
  assert.equal(await s.page.inputValue('#pf-ent'), 'OCP Group');
  assert.equal(await s.page.inputValue('#pf-poste'), 'Ingénieur méthodes');
  assert.equal(await s.page.inputValue('#pf-tel'), '06 61 22 33 44');
  assert.ok((await s.debordement()) <= 0, 'pas de débordement à 390 px');
  await s.page.addScriptTag({ content: AXE });
  const v = await s.page.evaluate(async () => (await axe.run('#inscription', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] })).violations.map(x => x.id));
  assert.deepEqual(v, []);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

// La « Dernière étape » seule, comme à l'inscription (en démo, on a déjà un profil)
const monterInscription = (page, preset) => page.evaluate(async preset => {
  const [{ html, render }, { createStore }, { ProfileForm }] = await Promise.all([import('./vendor/preact-htm.js'), import('./store.js'), import('./community.js')]);
  const store = await createStore();
  document.getElementById('app').hidden = true;
  const el = document.body.appendChild(document.createElement('main')); el.id = 'inscription'; el.className = 'auth-card wide onb';
  render(html`<${ProfileForm} ctx=${{ store, act: fn => fn() }} preset=${preset} onboarding/>`, el);
}, preset);

for (const langue of ['fr', 'ar']) {
  test(`inscription courte d’un lauréat : trois champs et « aider » au-dessus du pli, le bouton dit ce qui manque (360 px, ${langue})`, async () => {
    const s = await ouvrir({ largeur: 360, langue });
    await s.page.setViewportSize({ width: 360, height: 640 });
    const avant = await s.page.evaluate(() => [...(window.__ensamMissing || [])]);
    await monterInscription(s.page, { role: 'laureat' });
    await s.page.waitForSelector('#pf-role-rappel');
    // Le rôle choisi sur la page d'entrée n'est pas redemandé : il est rappelé
    assert.equal(await s.page.locator('#pf-je-laureat').count(), 0);
    if (langue === 'fr') assert.equal(await s.page.locator('#pf-role-rappel').innerText(), 'Tu t’inscris côté lauréats.');
    assert.equal(await s.page.inputValue('#pf-promo'), '', 'aucune promo choisie d’avance');
    for (const id of ['#pf-name', '#pf-promo', '#pf-fil', '#pf-aide-oui']) {
      const b = await s.page.locator(id).boundingBox();
      assert.ok(b && b.y + b.height < 640, `${id} visible sans défiler (bas à ${b && Math.round(b.y + b.height)})`);
    }
    assert.equal(await s.page.locator('#pf-ent').count(), 0);
    assert.equal(await s.page.locator('#pf-tel').count(), 0);
    assert.equal(await s.page.locator('#pf-cv-choisir.primary').count(), 0, 'le CV est un raccourci, pas l’action principale');
    const bouton = s.page.locator('.pf-pied .btn');
    const bb = await bouton.boundingBox();
    assert.ok(bb.y >= 0 && bb.y + bb.height <= 640, 'le bouton reste à portée du pouce');
    assert.ok(await bouton.isEnabled());
    // Un appui à vide mène au premier champ qui manque, et le dit
    await bouton.click(); await s.page.waitForTimeout(400);
    assert.equal(await s.page.evaluate(() => document.activeElement?.id), 'pf-name');
    assert.ok(await s.page.locator('.field-err').first().isVisible());
    assert.equal(await s.page.getAttribute('#pf-name', 'aria-invalid'), 'true');
    await s.page.fill('#pf-name', 'Yassine Berrada');
    await s.page.fill('#pf-promo', '2019');
    await s.page.selectOption('#pf-fil', { index: 1 });
    assert.equal(await bouton.getAttribute('data-manque'), 'aide');
    await s.page.click('#pf-aide-non');
    assert.equal(await bouton.getAttribute('data-manque'), null);
    assert.equal((await bouton.innerText()).trim(), langue === 'fr' ? 'Rejoindre la communauté' : 'الانضمام إلى المجتمع');
    // « Changer » ramène les cartes, le rôle choisi en évidence
    await s.page.click('#pf-role-changer');
    assert.equal(await s.page.getAttribute('#pf-je-laureat', 'aria-pressed'), 'true');
    // « Facultatif » s'ouvre et se referme
    await s.page.click('#pf-plus');
    assert.equal(await s.page.getAttribute('#pf-plus', 'aria-expanded'), 'true');
    assert.ok(await s.page.isVisible('#pf-ent'));
    await s.page.click('#pf-plus');
    assert.equal(await s.page.locator('#pf-ent').count(), 0);
    assert.ok((await s.debordement()) <= 0, 'pas de débordement à 360 px');
    await s.page.addScriptTag({ content: AXE });
    const v = await s.page.evaluate(async () => (await axe.run('#inscription', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] })).violations.map(x => x.id));
    assert.deepEqual(v, []);
    if (langue === 'ar') {
      const nouveaux = await s.page.evaluate(a => [...(window.__ensamMissing || [])].filter(x => !a.includes(x)), avant);
      assert.deepEqual(nouveaux.filter(x => !/^(Yassine Berrada|2019|Ex\. 2019)$/.test(x)), [], 'tout est traduit');
    }
    assert.deepEqual(s.erreurs, []);
    await s.ctx.close();
  });
}

test('inscription d’un étudiant : la promo part vide, puis dit l’année ; changer de rôle ne remplit rien', async () => {
  const s = await ouvrir({ largeur: 390 });
  await monterInscription(s.page, { role: 'etudiant' });
  await s.page.waitForSelector('#pf-role-rappel');
  assert.equal(await s.page.inputValue('#pf-promo'), '');
  await s.page.click('#pf-role-changer');
  await s.page.click('#pf-je-etudiant'); await s.page.click('#pf-je-laureat'); await s.page.click('#pf-je-etudiant');
  assert.equal(await s.page.inputValue('#pf-promo'), '', 'une promo vide reste vide');
  const S = await s.page.evaluate(async () => (await import('./logic.js')).seasonOf());
  await s.page.fill('#pf-promo', String(S + 3)); await s.page.waitForTimeout(150);
  assert.match(await s.page.locator('#pf-promo').locator('xpath=ancestor::label').innerText(), /En \d{4}-\d{4}, tu es en 3e année\./);
  assert.equal(await s.page.locator('#pf-aide').count(), 0, '« aider » ne concerne que les lauréats');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('profil : deux choix « Qui voit quoi » coup sur coup, le premier lent : « Enregistré » seulement quand le dernier est parti, et des mots exacts', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Youssef'); await s.aller('profil'); await s.page.waitForTimeout(300);
  await s.page.evaluate(() => {
    const d = window.__demo, vrai = d.update.bind(d);
    d.update = (t, id, patch) => (patch.visibilite && Object.keys(patch).length === 1 ? new Promise(ok => setTimeout(ok, 1000)).then(() => vrai(t, id, patch)) : vrai(t, id, patch));
  });
  await s.page.click('#vis-lieu-laureats'); await s.page.click('#vis-lieu-contacts');
  await s.page.waitForTimeout(1500); // le premier est enregistré, le second encore en route
  assert.equal(await s.page.locator('#vis-etat').innerText(), 'Enregistrement…');
  await s.page.waitForFunction(() => /^Enregistré/.test(document.getElementById('vis-etat')?.textContent.trim() || ''), null, { timeout: 4000 });
  assert.equal(await s.page.locator('#vis-etat').innerText(), 'Enregistré : seuls tes contacts le voient.');
  assert.equal(await s.page.evaluate(() => window.__demo.me.visibilite.lieu), 'contacts');
  // « Les lauréats » ouvre aussi aux contacts (la base les laisse voir) : on le dit
  await s.page.click('#vis-travail-laureats');
  await s.page.waitForFunction(() => /^Enregistré/.test(document.getElementById('vis-etat')?.textContent.trim() || ''), null, { timeout: 4000 });
  assert.equal(await s.page.locator('#vis-etat').innerText(), 'Enregistré : les lauréats et tes contacts le voient.');
  await s.page.evaluate(() => { delete window.__demo.update; });
  // Un lauréat peut aussi publier une demande (emploi) : même phrase pour le CV
  await s.page.click('#vis-cv-contacts');
  await s.page.waitForFunction(() => /^Enregistré/.test(document.getElementById('vis-etat')?.textContent.trim() || ''), null, { timeout: 4000 });
  assert.equal(await s.page.locator('#vis-etat').innerText(), 'Enregistré : tes contacts le voient ; les lauréats aussi quand tu as une demande ouverte.');
  // Un envoi qui échoue après un « Enregistrer » réussi ne dit plus « Pas encore enregistré »
  await s.page.evaluate(() => {
    const d = window.__demo, vrai = d.update.bind(d); let premier = true;
    d.update = (t, id, patch) => {
      if (patch.visibilite && Object.keys(patch).length === 1 && premier) { premier = false; return new Promise((_, ko) => setTimeout(() => ko(new Error('Pas de réseau pour l’instant. Réessaie dans un instant.')), 1500)); }
      return vrai(t, id, patch);
    };
  });
  await s.page.click('#vis-lieu-tous');
  await s.page.fill('#pf-ville', 'Rabat');
  await s.page.click('.pf-collant .btn.primary');
  await s.page.waitForTimeout(2500);
  assert.doesNotMatch(await s.page.locator('.cf-vis').innerText(), /Pas encore enregistré/);
  assert.equal(await s.page.evaluate(() => window.__demo.me.visibilite.lieu), 'tous');
  assert.equal(await s.page.locator('.pf-collant').count(), 0);
  await s.page.evaluate(() => { delete window.__demo.update; });
  // Le renvoi qui suit « Enregistrer » échoue lui aussi : la base a déjà la grille voulue, rien d'alarmant à dire
  await s.page.evaluate(() => {
    const d = window.__demo, vrai = d.update.bind(d);
    d.update = (t, id, patch) => (patch.visibilite && Object.keys(patch).length === 1 ? new Promise((_, ko) => setTimeout(() => ko(new Error('Pas de réseau pour l’instant. Réessaie dans un instant.')), 1500)) : vrai(t, id, patch));
  });
  await s.page.click('#vis-lieu-contacts');
  await s.page.fill('#pf-ville', 'Fès');
  await s.page.click('.pf-collant .btn.primary');
  await s.page.waitForTimeout(4000);
  assert.doesNotMatch(await s.page.locator('.cf-vis').innerText(), /Pas encore enregistré/);
  assert.match(await s.page.locator('#vis-etat').innerText(), /^Enregistré/);
  assert.equal(await s.page.evaluate(() => window.__demo.me.visibilite.lieu), 'contacts');
  assert.equal(await s.page.locator('.pf-collant').count(), 0);
  await s.page.evaluate(() => { delete window.__demo.update; });
  // Le CV d'un étudiant reste visible des lauréats pendant une demande ouverte
  await s.comme('Salma'); await s.aller('profil'); await s.page.waitForTimeout(300);
  await s.page.click('#vis-cv-contacts');
  await s.page.waitForFunction(() => /^Enregistré/.test(document.getElementById('vis-etat')?.textContent.trim() || ''), null, { timeout: 4000 });
  assert.equal(await s.page.locator('#vis-etat').innerText(), 'Enregistré : tes contacts le voient ; les lauréats aussi quand tu as une demande ouverte.');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('profil : un choix « Qui voit quoi » défait pendant qu’un envoi traîne : au bout de 20 s, la ligne dit que rien n’est sûr', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Youssef'); await s.aller('profil'); await s.page.waitForTimeout(300);
  const garde = await s.page.evaluate(() => window.__demo.me.visibilite?.lieu || 'tous');
  const autre = garde === 'tous' ? 'contacts' : 'tous';
  // Les envois de « Qui voit quoi » ne reviennent jamais (le premier peut encore arriver au serveur)
  await s.page.evaluate(() => {
    const d = window.__demo, vrai = d.update.bind(d);
    d.update = (t, id, patch) => (patch.visibilite && Object.keys(patch).length === 1 ? new Promise(() => {}) : vrai(t, id, patch));
  });
  await s.page.click(`#vis-lieu-${autre}`); await s.page.waitForTimeout(200);
  await s.page.click(`#vis-lieu-${garde}`);
  await s.page.waitForFunction(() => /Pas encore enregistré/.test(document.getElementById('vis-etat')?.textContent || ''), null, { timeout: 25000 });
  await s.page.evaluate(() => { delete window.__demo.update; });
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('profil : un réglage « Qui voit quoi » qui ne part pas reste affiché, et part avec « Enregistrer »', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Youssef'); await s.aller('profil'); await s.page.waitForTimeout(300);
  await s.page.evaluate(() => {
    const d = window.__demo, vrai = d.update.bind(d);
    d.update = (t, id, patch) => (patch.visibilite && Object.keys(patch).length === 1 ? Promise.reject(new Error('Pas de réseau pour l’instant. Réessaie dans un instant.')) : vrai(t, id, patch));
  });
  await s.page.click('#vis-lieu-contacts'); await s.page.waitForTimeout(300);
  assert.equal(await s.page.getAttribute('#vis-lieu-contacts', 'aria-checked'), 'true', 'le choix reste');
  assert.match(await s.page.locator('#vis-etat').innerText(), /Pas encore enregistré/);
  assert.equal(await s.page.locator('.pf-collant').count(), 1);
  await s.page.evaluate(() => { delete window.__demo.update; });
  await s.page.click('.pf-collant .btn.primary'); await s.page.waitForTimeout(300);
  assert.equal(await s.page.evaluate(() => window.__demo.me.visibilite?.lieu), 'contacts');
  assert.equal(await s.page.locator('.pf-collant').count(), 0);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('profil : promo effacée, le bouton le dit et mène au champ', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Nadia'); await s.aller('profil');
  await s.page.fill('#pf-promo', ''); await s.page.waitForTimeout(150);
  const bouton = '.pf-collant .btn.primary';
  assert.equal(await s.page.getAttribute(bouton, 'data-manque'), 'promo');
  assert.match(await s.page.locator(bouton).innerText(), /Ajoute ta promo/);
  await s.page.click(bouton); await s.page.waitForTimeout(400);
  assert.equal(await s.page.evaluate(() => document.activeElement?.id), 'pf-promo');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('offres : une seule rangée de puces avant la première offre ; les anciens liens ouvrent la bonne puce ; « Demandes » dit combien', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Youssef');
  // L'ancien onglet « Sujets PFE » : la puce PFE choisie, et « Déposer un sujet » reste le bouton plein
  await s.aller('offres/sujets'); await s.page.waitForSelector('.offres-chips');
  assert.equal((await s.page.locator('.offres-chips .chip[aria-pressed="true"]').innerText()).trim(), 'PFE');
  assert.match(await s.page.locator('#of-publier.btn.primary').innerText(), /Déposer un sujet/);
  const types = await s.page.locator('.ocard .ocard-tags > .tag:first-child').allInnerTexts();
  assert.ok(types.length && types.every(t => /PFE/.test(t)), 'seulement des sujets de PFE');
  // Une seule rangée de filtres ; Offres · Demandes (n) en tête, n les demandes ouvertes qu'il voit
  assert.equal(await s.page.locator('.offres-page .chips').count(), 1);
  const onglets = s.page.locator('.offres-seg [role="tab"]');
  assert.equal(await onglets.count(), 2);
  assert.equal(await onglets.nth(0).getAttribute('aria-selected'), 'true');
  assert.match(await onglets.nth(1).innerText(), /^Demandes\s+[1-9]\d*$/);
  // Une autre puce : l'adresse redevient celle des offres
  await s.page.click('.offres-chips .chip:has-text("Tout")'); await s.page.waitForTimeout(250);
  assert.equal(await s.page.evaluate(() => location.hash), '#offres');
  assert.match(await s.page.locator('#of-publier').innerText(), /Publier une offre/);
  // « Entre lauréats » : une puce de la même rangée, l'ancien lien y mène aussi
  await s.aller('offres/laureats'); await s.page.waitForSelector('.offres-chips');
  assert.equal((await s.page.locator('.offres-chips .chip[aria-pressed="true"]').innerText()).trim(), 'Entre lauréats');
  assert.equal(await s.page.locator('.ocard').count(), await s.page.locator('.ocard .tag.entre').count());
  // Une étudiante : ni « Entre lauréats » ni « Mes offres », aucune offre entre lauréats, pas de bouton pour publier
  await s.comme('Salma'); await s.aller('offres'); await s.page.waitForSelector('.offres-chips');
  assert.ok(!(await s.page.locator('.offres-chips .chip').allInnerTexts()).some(t => /Entre lauréats|Mes offres/.test(t)));
  assert.equal(await s.page.locator('.ocard .tag.entre').count(), 0);
  assert.equal(await s.page.locator('#of-publier').count(), 0);
  assert.equal(await s.debordement(), 0);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('offre d’une autre année ouverte par un lien : sans offre pour son année, l’étudiant peut agir tout de suite', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Amine');
  const id = await s.page.evaluate(async () => {
    const d = window.__demo, { niveauOf, seasonOf } = await import('./logic.js');
    const n = niveauOf(d.me, seasonOf());
    for (const o of d.data.offers.filter(o => o.status === 'ouverte' && o.audience !== 'laureats' && (o.annees || []).includes(n))) await d.update('offers', o.id, { status: 'pourvue' });
    return d.data.offers.find(o => o.status === 'ouverte' && o.audience !== 'laureats' && !(o.annees || []).includes(n))?.id;
  });
  assert.ok(id, 'une offre d’une autre année');
  await s.aller('offre/' + id); await s.page.waitForSelector('.modal');
  const txt = await s.page.locator('.modal').innerText();
  assert.match(txt, /Pas encore d’offre pour ta 3A\./);
  assert.doesNotMatch(txt, /Voici celles de ta/);
  await s.page.click('#od-ensuite');
  await s.page.waitForSelector('#dm-titre', { timeout: 3000 });
  assert.equal(await s.page.evaluate(() => location.hash), '#offres/demandes');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

// Juste après la « Dernière étape » : le signal posé par l'inscription (en démo, à la main)
const signalArrivee = page => page.evaluate(() => sessionStorage.setItem('ensam-arrivee', window.__demo.me.id));

test('accueil après l’inscription : une lauréate apprend son rang, voit des visages, et un seul bouton (une fois)', async () => {
  const s = await ouvrir({ largeur: 360 });
  await s.page.setViewportSize({ width: 360, height: 640 });
  await s.comme('Nadia'); await signalArrivee(s.page);
  await s.page.reload(); await s.page.waitForSelector('.modal.arrivee', { timeout: 5000 });
  const attendu = await s.page.evaluate(async () => { const { rangLaureat } = await import('./logic.js'); return `Te voilà ${rangLaureat(window.__demo.data.profiles, window.__demo.me)}e parmi les lauréats du réseau`; });
  assert.equal(await s.page.locator('.arrivee-titre').innerText(), attendu);
  const n = await s.page.locator('.arrivee-visages .avatar').count();
  assert.ok(n >= 1 && n <= 5, `${n} visages`);
  assert.equal(await s.page.locator('.modal.arrivee .btn.primary').count(), 1);
  assert.equal((await s.page.locator('#arrivee-go').innerText()).trim(), (await s.page.locator('.pas .pas-go').innerText()).trim(), 'le même bouton que la carte');
  const b = await s.page.locator('#arrivee-go').boundingBox();
  assert.ok(b.y + b.height <= 640);
  assert.ok((await s.debordement()) <= 0);
  const id = await s.page.evaluate(() => window.__demo.me.id);
  await s.page.click('#arrivee-go'); await s.page.waitForTimeout(500);
  assert.equal(await s.page.locator('.modal.arrivee').count(), 0);
  await s.aller('accueil'); await s.page.reload(); await s.page.waitForSelector('#persona'); await s.page.waitForTimeout(1500);
  assert.equal(await s.page.locator('.modal.arrivee').count(), 0, 'une seule fois');
  assert.equal(await s.page.evaluate(id => localStorage.getItem('accueil-vu-' + id), id), '1');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('accueil après l’inscription : un étudiant voit les lauréats de sa filière ; jamais par-dessus une autre fenêtre', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Amine'); await signalArrivee(s.page);
  await s.page.reload(); await s.page.waitForSelector('.modal.arrivee', { timeout: 5000 });
  const attendu = await s.page.evaluate(async () => { const { phrasesArrivee, accueilArrivee } = await import('./logic.js'); return phrasesArrivee(accueilArrivee(window.__demo.data, window.__demo.me)).titre; });
  assert.equal(await s.page.locator('.arrivee-titre').innerText(), attendu);
  assert.match(attendu, /lauréats? (?:de (?:ta filière|ton parcours) )?(?:sont|est) déjà là/);
  assert.equal((await s.page.locator('#arrivee-go').innerText()).trim(), (await s.page.locator('.pas .pas-go').innerText()).trim());
  await s.fermer();
  // Les premiers pas ouverts par le menu : la feuille d'accueil attend le prochain accueil
  await s.comme('Youssef'); await signalArrivee(s.page);
  await s.page.evaluate(() => { location.hash = 'accueil/etapes'; }); await s.page.reload(); await s.page.waitForSelector('#persona');
  await s.page.waitForTimeout(1500);
  assert.equal(await s.page.locator('.modal.arrivee').count(), 0, 'pas deux feuilles l’une sur l’autre');
  await s.fermer(); await s.aller('offres'); await s.aller('accueil');
  await s.page.waitForSelector('.modal.arrivee', { timeout: 5000 });
  assert.equal(await s.page.locator('.fete-back').count(), 0);
  // Sans rechargement : le signal de la « Dernière étape » ouvre la feuille sur un accueil déjà affiché
  await s.fermer();
  await s.comme('Nadia'); await s.aller('accueil');
  await s.page.evaluate(() => { localStorage.removeItem('accueil-vu-' + window.__demo.me.id); return import('./pouls.js').then(m => m.marquerArrivee(window.__demo.me.id)); });
  await s.page.waitForSelector('.modal.arrivee', { timeout: 1500 });
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('accueil après l’inscription en arabe : رقم N, مرحبًا, rien d’oublié', async () => {
  const s = await ouvrir({ largeur: 390, langue: 'ar' });
  await s.comme('Nadia'); await signalArrivee(s.page);
  await s.page.reload(); await s.page.waitForSelector('.modal.arrivee', { timeout: 5000 });
  assert.match(await s.page.locator('.arrivee-titre').innerText(), /^أنت الآن رقم \d+ بين خريجي الشبكة$/);
  assert.match(await s.page.locator('.modal.arrivee .modal-head h2').innerText(), /مرحبًا/);
  const manque = await s.page.evaluate(() => [...(window.__ensamMissing || [])].filter(x => /Te voilà|Bienvenue|déjà là|Membre fondateur|commence avec toi/.test(x)));
  assert.deepEqual(manque, []);
  assert.match(await s.page.evaluate(async () => { const { t } = await import('./i18n.js'); return t('1 lauréat de ta filière est déjà là'); }), /^انضمّ إلى الشبكة خريج واحد من شعبتك$/);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('CV qui contredit ou complète le profil : le membre met à jour en un clic, l’administration lit les CV et corrige', async () => {
  const s = await ouvrir();
  await s.comme('Salma'); await s.aller('profil');
  await deposerPdf(s.page, '#cv-file', CV_LAUREAT);
  await s.page.waitForSelector('#cv-controle', { timeout: 15000 });
  assert.match(await s.page.locator('#cv-controle').innerText(), /Profil lauréat · Promo 2021/);
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
  assert.match(await ligne.innerText(), /Son CV indique :\s*Profil lauréat · Promo 2021/);
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
  assert.match(await panneau.innerText(), /Lu :\s*Profil lauréat · Promo 2021[\s\S]*Juste :\s*Étudiante 5A, promo 2027/);
  await s.page.click('#adm-cv-copier'); await s.page.waitForTimeout(200);
  const copie = await s.page.evaluate(() => navigator.clipboard.readText());
  assert.match(copie, /Lu dans le CV : Profil lauréat · Promo 2021/);
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
  // Les listes déroulantes vivent dans la feuille « Filtres » ; le bouton dit ensuite combien de filtres sont actifs
  await s.page.click('#t-filtres'); await s.page.waitForSelector('.modal #t-niv');
  await s.page.selectOption('#t-niv', 'L'); await s.page.waitForTimeout(300);
  assert.match(await s.page.locator('.modal-foot .btn.primary').innerText(), /^Voir (\d+ résultats|1 résultat)$/);
  await s.page.click('.modal-foot .btn.primary'); await s.page.waitForTimeout(300);
  assert.equal(await s.page.locator('.modal').count(), 0);
  assert.match(await s.page.innerText('#t-filtres'), /Filtres · 1/);
  const carte = s.page.locator('.talents .ligne', { hasText: 'Nadia Ferhat' });
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
  // L'image est dans la page avant d'être décodée : ses dimensions se lisent une fois chargée
  await s.page.waitForFunction(() => { const i = document.querySelector('.photo-card .avatar img'); return i?.complete && i.naturalWidth > 0; }, null, { timeout: 10000 });
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
  assert.match(brouillon, /^Bonjour .+, bienvenue sur le Réseau ENSAM Meknès ! Pour vérifier ton profil, peux-tu déposer ton CV en PDF/);
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
  // Youssef la trouve (autre parcours : la puce « Proches de ma filière » relâchée), voit le CV, propose d'encadrer
  await s.comme('Youssef'); await s.aller('offres/demandes');
  if (!(await carte().count())) await s.page.click('.dm-filtres button[aria-pressed="true"]:has-text("Proches de ma filière")');
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
  await carte().locator('.dm-accepter').click(); await s.page.click('.modal .dm-oui'); await s.page.waitForTimeout(400); await fete();
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
  assert.match(await s.page.locator('.wins').first().innerText(), /Salma Bennani a décroché son PFE chez Renault Group Maroc avec l’encadrement de Youssef El Amrani/);
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

test('« Cette semaine » : un lauréat sans photo voit « Ajoute une photo », en dernier, ni dans la cloche ni sur la carte ; elle ouvre Mon profil sur la carte photo', async () => {
  const s = await ouvrir({ largeur: 390 });
  const PHRASE = 'Ajoute une photo, les étudiants écrivent plus facilement à un visage.';
  await s.comme('Nadia'); await s.aller('accueil');
  if (await s.page.$('.fete-back, .modal-back')) await s.fermer();
  const lignes = s.page.locator('.semaine .todo > li');
  const textes = (await lignes.allInnerTexts()).map(t => t.trim());
  const i = textes.findIndex(t => t.includes(PHRASE));
  assert.ok(i >= 0, JSON.stringify(textes));
  assert.equal(i, textes.length - 1, 'après les vraies tâches');
  assert.equal(await s.page.locator('.pas', { hasText: 'Ajoute une photo' }).count(), 0, 'jamais la carte du haut');
  await s.page.click('.cloche-btn'); await s.page.waitForSelector('.modal.cloche');
  assert.equal(await s.page.locator('.modal.cloche', { hasText: 'Ajoute une photo' }).count(), 0, 'ni dans la cloche');
  await s.fermer();
  await lignes.nth(i).locator('button').click();
  await s.page.waitForFunction(() => location.hash === '#profil');
  await s.page.waitForSelector('.photo-card');
  assert.ok(await s.page.evaluate(() => { const c = document.querySelector('.photo-card').getBoundingClientRect(); return c.top >= 0 && c.top < innerHeight; }), 'la carte photo est à l’écran');
  // Un étudiant ne la voit pas
  await s.comme('Salma'); await s.aller('accueil');
  assert.equal(await s.page.locator('.semaine', { hasText: 'Ajoute une photo' }).count(), 0);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('candidats sur téléphone : gros boutons groupés ; « Recruter » demande une confirmation et s’annule tant que l’étudiant n’a pas confirmé, la candidature retrouve son statut', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Youssef'); await s.aller('accueil');
  await s.page.click('.cloche-btn'); await s.page.waitForSelector('.modal.cloche');
  await s.page.locator('.cloche .af-row', { hasText: 'candidatures' }).locator('button').first().click(); await s.page.waitForSelector('.modal .cand');
  const carte = s.page.locator('.modal .cand').filter({ has: s.page.locator('.cand-recruter') }).first();
  const nom = (await carte.locator('.person-name').innerText()).trim();
  const sienne = () => s.page.locator('.modal .cand', { hasText: nom });
  // Des boutons qu'on touche sans viser (44 px), rien qui dépasse de la carte
  const hauteurs = await carte.locator('.cand-actions .btn, .cand-recruter, .cand-statut .seg button').evaluateAll(bs => bs.map(b => b.offsetHeight));
  assert.ok(hauteurs.length >= 5 && hauteurs.every(h => h >= 44), JSON.stringify(hauteurs));
  assert.ok(await s.page.evaluate(() => [...document.querySelectorAll('.modal .cand')].every(c => c.scrollWidth <= c.clientWidth + 1)), 'rien ne dépasse');
  // Un toucher de trop ne recrute personne : « Pas maintenant » ne change rien
  await carte.locator('.cand-recruter').click(); await s.page.waitForSelector('.modal .row-end .btn.primary');
  assert.match(await s.page.locator('.modal').last().innerText(), new RegExp(`Recruter ${nom.split(' ')[0]} \\?`));
  await s.page.click('.modal .row-end .btn.ghost'); await s.page.waitForTimeout(200);
  assert.equal(await sienne().locator('.cand-recruter').count(), 1);
  // Entretien, puis recruter pour de vrai, puis annuler : la candidature revient à « Entretien », plus rien à confirmer
  await sienne().locator('.seg button', { hasText: 'Entretien' }).click(); await s.page.waitForTimeout(200);
  await sienne().locator('.cand-recruter').click(); await s.page.click('.modal .row-end .btn.primary'); await s.page.waitForTimeout(300);
  assert.match(await sienne().innerText(), /Recrutement déclaré · attend sa confirmation/);
  // « Annuler le recrutement » : seul sur sa ligne, en rouge
  const annuler = sienne().locator('.cand-annuler');
  assert.ok(await annuler.evaluate(b => b.offsetWidth >= b.parentElement.clientWidth - 2), 'seul sur sa ligne');
  assert.notEqual(await annuler.evaluate(b => getComputedStyle(b).color), await sienne().locator('.cand-actions .btn').first().evaluate(b => getComputedStyle(b).color));
  await annuler.click(); await s.page.waitForSelector('.modal .row-end .btn.danger');
  assert.match(await s.page.locator('.modal').last().innerText(), /Garder/);
  await s.page.click('.modal .row-end .btn.danger'); await s.page.waitForTimeout(300);
  assert.equal(await sienne().locator('.cand-annuler').count(), 0);
  assert.equal(await sienne().locator('.cand-recruter').count(), 1);
  assert.equal(await sienne().locator('.seg button[aria-pressed="true"]').innerText(), 'Entretien');
  const reste = await s.page.evaluate(n => { const d = window.__demo.data; const st = d.profiles.find(p => p.full_name === n); return d.placements.filter(p => p.student_id === st.id && p.status !== 'refuse' && p.laureat_id).length; }, nom);
  assert.equal(reste, 0, 'plus de recrutement à confirmer');
  // L'étudiant confirme pendant que la question est ouverte : rien n'est annulé, la candidature reste « Recrutée »
  await sienne().locator('.cand-recruter').click(); await s.page.click('.modal .row-end .btn.primary'); await s.page.waitForTimeout(300);
  await sienne().locator('.cand-annuler').click(); await s.page.waitForSelector('.modal .row-end .btn.danger');
  await s.page.evaluate(n => { const d = window.__demo.data; const st = d.profiles.find(p => p.full_name === n); d.placements.find(p => p.student_id === st.id && p.status === 'en_attente').status = 'confirme'; }, nom);
  await s.page.click('.modal .row-end .btn.danger'); await s.page.waitForTimeout(300);
  assert.match(await s.page.locator('.toast').last().innerText(), /vient d’être confirmé/);
  const etat = await s.page.evaluate(n => { const d = window.__demo.data; const st = d.profiles.find(p => p.full_name === n); return [d.placements.filter(p => p.student_id === st.id && p.status === 'confirme').length, d.applications.filter(a => a.student_id === st.id && a.status === 'retenu').length]; }, nom);
  assert.deepEqual(etat, [1, 1], 'le recrutement confirmé et la candidature restent');
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
  assert.match(await s.page.locator('.modal').last().innerText(), /Réduction des rebuts[\s\S]*Candidats/, 'l’offre s’ouvre sur ses candidats');
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
  // Le CV était l'étape montrée : la carte la coche d'abord (« Fait »), puis l'étape suivante arrive avec son bouton
  await s.page.waitForSelector('.pas .pas-go', { timeout: 3000 });
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
      'Un lauréat relit ton CV', 'Un lauréat déclare ton recrutement chez Lear', '45 lauréats sont déjà là', '2 lauréats sont déjà là, dont 1 de ta promo',
      'Tu relis le CV de Hatim Moussaoui', 'Continuer la relecture'].map(t);
  });
  assert.match(ar[0], /^سؤال موجّه إليك حول فرنسا/);
  assert.match(ar[1], /صرّح بالبداية/);
  for (const x of ar.slice(2, 4)) assert.doesNotMatch(x, /Un lauréat/, x);
  for (const x of ar.slice(4, 6)) { assert.match(x, /^انضمّ إلى الشبكة/, x); assert.doesNotMatch(x, /معك/, x); }
  assert.match(ar[6], /تراجع سيرة/);
  assert.equal(ar[7], 'متابعة المراجعة');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('arabe dans le bon ordre et lisible : aperçus, flèche du merci, saisie, nombres, petites étiquettes, pas d’italique', async () => {
  const s = await ouvrir({ largeur: 390, langue: 'ar' });
  // Un merci : de qui → à qui, la flèche suit le sens de lecture (de droite à gauche)
  await s.aller('accueil');
  const merci = await s.page.evaluate(() => {
    const f = document.querySelector('.merci-une footer.merci-duo'); if (!f) return null;
    const r = e => e.getBoundingClientRect(), svg = f.querySelector('.md-vers > svg');
    const q = document.querySelector('.merci-une .merci p');
    const de = r(f.querySelector('.md-qui b')), fl = r(svg), a = r(f.querySelector('.md-vers button'));
    return { de: de.left, deBas: de.bottom, fleche: fl.left, flecheHaut: fl.top, a: a.left, retournee: getComputedStyle(svg).transform, italique: q && getComputedStyle(q).fontStyle };
  });
  assert.ok(merci, 'un merci sur l’accueil du premier profil');
  // La flèche reste collée à celui qu'on remercie, à sa droite ; l'auteur est à droite de la flèche, ou au-dessus si la ligne passe à la suivante
  assert.ok(merci.fleche > merci.a && (merci.de > merci.fleche || merci.flecheHaut >= merci.deBas - 2), JSON.stringify(merci));
  assert.equal(merci.retournee, 'matrix(-1, 0, 0, 1, 0, 0)');
  assert.equal(merci.italique, 'normal');
  // Petites étiquettes : au moins 13 px en arabe
  const petites = await s.page.$$eval('.eyebrow, .tag, .mini, .status, .bottom-nav a', es => es.filter(e => e.getClientRects().length && /[؀-ۿ]/.test(e.textContent)).map(e => parseFloat(getComputedStyle(e).fontSize)).filter(t => t < 13));
  assert.deepEqual(petites, []);
  // Aperçus des conversations : le texte d'un membre garde sa direction (le début d'un message en français reste visible, à gauche)
  await s.aller('messages');
  const apercus = await s.page.$$eval('.ci-prev .ap-txt', es => es.map(e => [e.getAttribute('dir'), getComputedStyle(e).direction, e.textContent]));
  assert.ok(apercus.length, 'des aperçus de conversation');
  for (const [dir, sens, txt] of apercus) {
    assert.equal(dir, 'auto', txt);
    if (/^[A-Za-zÀ-ÿ]/.test(txt.trim())) assert.equal(sens, 'ltr', txt);
  }
  // Saisie : le texte tapé suit sa propre langue, le champ vide reste à droite
  await s.aller('reseau/annuaire');
  assert.equal(await s.page.getAttribute('#d-q', 'dir'), 'auto');
  assert.equal(await s.page.$eval('#d-q', e => getComputedStyle(e).direction), 'rtl');
  await s.page.fill('#d-q', 'Bonjour !');
  assert.equal(await s.page.$eval('#d-q', e => e.matches(':dir(ltr)')), true);
  await s.page.fill('#d-q', '');
  // Nombres : « 93% », « +258 », « 2026-2027 » isolés de gauche à droite, comme en français
  const nombres = await s.page.evaluate(async () => {
    const { t } = await import('./i18n.js');
    return [t('Année 2026-2027'), t('+10 points'), t('93 % des comptes')];
  });
  assert.match(nombres[0], /⁦2026-2027⁩/);
  assert.match(nombres[1], /^⁦\+10⁩/);
  assert.match(nombres[2], /⁦93%⁩/);
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
  assert.match(await calme.innerText(), /On te prévient dès qu’un étudiant demande de l’aide/);
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

test('portes ouvertes : un refus dit le vrai nombre d’offres, un rendez-vous annulé propose d’autres horaires, les points restent côté lauréat', async () => {
  const s = await ouvrir({ largeur: 390 });
  const demo = f => s.page.evaluate(f => { const k = 'ensam-demo-v14', st = JSON.parse(localStorage.getItem(k)); new Function('d', f)(st.data); localStorage.setItem(k, JSON.stringify(st)); }, f);
  const recharger = async () => { await s.page.reload(); await s.page.waitForSelector('.hello'); await s.page.waitForTimeout(300); if (await s.page.$('.fete-back')) await s.fermer(); };
  const cloche = async () => { await s.page.click('.cloche-btn'); await s.page.waitForSelector('.modal.cloche'); const t = await s.page.locator('.modal.cloche').innerText(); await s.fermer(); return t; };
  // Salma : une candidature pas retenue, et le lauréat annule son prochain rendez-vous
  await s.comme('Salma');
  await demo(`const sa = d.profiles.find(p => p.full_name.startsWith('Salma')), now = new Date().toISOString();
    const a = d.applications.find(x => x.student_id === sa.id && x.offer_id); a.status = 'refuse'; a.updated_at = now;
    const m = d.mentorships.find(x => x.student_id === sa.id && x.status === 'acceptee' && new Date(x.rdv_at) > Date.now()); m.status = 'annulee'; m.sujet = 'Préparer mon entretien';`);
  await recharger();
  const n = await s.page.evaluate(async () => { const { offresOuvertesPour, seasonOf } = await import('./logic.js'); return offresOuvertesPour(window.__demo.data, window.__demo.me, seasonOf()).length; });
  const t = await cloche();
  assert.match(t, n > 1 ? new RegExp(`pas retenue cette fois\\. ${n} autres offres t’attendent\\.`) : n === 1 ? /pas retenue cette fois\. Une autre offre t’attend\./ : /pas retenue cette fois\. (Dis aux lauréats|Un lauréat peut)/);
  assert.match(t, /Ton rendez-vous avec \S+ pour « Préparer mon entretien » est annulé\. Tu peux lui proposer d’autres horaires\./);
  assert.doesNotMatch(t, /points|Pas retenu\(e\)|\(e\)/);
  // Le lien de la notification : « Proposer d'autres horaires » au même lauréat, sur le même sujet
  const id = await s.page.evaluate(() => window.__demo.data.mentorships.find(x => x.status === 'annulee' && x.sujet === 'Préparer mon entretien').id);
  await s.aller('mentorat/reprendre/' + id); await s.page.waitForSelector('#ah-sujet');
  assert.equal(await s.page.inputValue('#ah-sujet'), 'Préparer mon entretien');
  await s.fermer();
  // Côté étudiant, aucun point nulle part ; côté lauréat, un recrutement confirmé met la personne d'abord et les points en pastille
  assert.equal(await s.page.locator('.pastille-pts').count(), 0);
  await s.comme('Youssef');
  await demo(`const y = d.profiles.find(p => p.full_name === 'Youssef El Amrani'); const p = d.placements.find(x => x.laureat_id === y.id && x.status === 'confirme');
    p.confirmed_at = new Date().toISOString(); p.merci = 'Merci pour tout !'; p.pays = 'France';`);
  await recharger();
  await s.page.click('.cloche-btn'); await s.page.waitForSelector('.modal.cloche');
  const ligne = s.page.locator('.modal.cloche .notif', { hasText: 'te remercie : son' }).first();
  assert.match(await ligne.innerText(), /te remercie : son (recrutement|démarrage) chez .+ est confirmé\.\s*\+85 points/);
  assert.equal(await ligne.locator('.pastille-pts').innerText(), '+85 points');
  await s.fermer();
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
  await s.page.click('.puces-nav [role="tab"]:has-text("Entraide")'); await s.page.waitForTimeout(300);
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
  await s.page.click('.puces-nav [role="tab"]:has-text("Entraide")'); await s.page.waitForTimeout(300);
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

// ---------------------------------------------------------------------------
// Lot mouvement · A : le match fêté des deux côtés, la carte qui dit « Fait », les écrans vides illustrés, le décor qui se pose
// ---------------------------------------------------------------------------
const MATCH = ['var(--accent)', 'var(--orange)', 'var(--navy)'];
// Salma publie une demande, Youssef (déjà passé par l'accueil) propose d'encadrer ; rend le titre de la demande
async function demandeAvecAide(s, TITRE) {
  const fete = () => s.page.locator('.fete-acts .btn').last().click({ timeout: 2000 }).catch(() => {});
  await s.comme('Youssef'); await s.page.waitForTimeout(200);
  await s.comme('Salma'); await s.aller('offres/demandes');
  await s.page.click('#dm-nouvelle'); await s.page.waitForTimeout(200);
  await s.page.click('#dm-type-pfe');
  await s.page.fill('#dm-titre', TITRE);
  await s.page.fill('#dm-details', 'Je cherche un PFE de 6 mois en maintenance : AMDEC, TPM, indicateurs. Mobile à Tanger et Kénitra.');
  await s.page.click('#dm-publier'); await s.page.waitForTimeout(400); await fete();
  await s.comme('Youssef'); await s.aller('offres/demandes');
  const carte = s.page.locator('.dm-card', { hasText: TITRE }).first();
  if (!(await carte.count())) await s.page.click('.dm-filtres button[aria-pressed="true"]:has-text("Proches de ma filière")');
  await carte.locator('.dm-aider').click(); await s.page.waitForTimeout(200);
  await s.page.click('.dm-aide-choix:has(#dm-aide-encadre)');
  await s.page.fill('#dm-p-msg', 'Bonjour Salma, j’ai un sujet de PFE en maintenance dans mon équipe. Je serai ton encadrant.');
  await s.page.click('#dm-p-envoyer'); await s.page.waitForTimeout(400);
  return fete;
}

test('match fêté des deux côtés : « Oui, accepter » avec son visage, les deux visages et le cœur ; le lauréat le vit à son retour, une fois', async () => {
  const s = await ouvrir({ largeur: 390 });
  const TITRE = 'PFE en maintenance industrielle à Tanger';
  const fete = await demandeAvecAide(s, TITRE);
  await s.comme('Salma'); await s.page.waitForTimeout(300); await fete();
  await s.aller('offres/demandes');
  const carte = s.page.locator('.dm-card', { hasText: TITRE }).first();
  // La confirmation : son visage, son nom, ce qu'il propose ; « Oui, accepter » est le bouton plein, rien en rouge
  await carte.locator('.dm-accepter').click(); await s.page.waitForSelector('.modal.dm-oui-feuille');
  const feuille = s.page.locator('.modal.dm-oui-feuille');
  assert.match(await feuille.locator('h2').innerText(), /Accepter l’aide de Youssef \?/);
  assert.equal(await feuille.locator('.dm-oui-qui .avatar').count(), 1);
  assert.match(await feuille.innerText(), /Youssef El Amrani[\s\S]*Encadre/);
  assert.equal(await feuille.locator('.btn.danger').count(), 0, 'accepter n’est pas une action rouge');
  assert.equal(await feuille.locator('.btn.primary').count(), 1);
  assert.equal((await feuille.locator('.btn.primary').innerText()).trim(), 'Oui, accepter');
  await feuille.locator('.btn.primary').click();
  await s.page.waitForSelector('.fete.fete-match');
  // Les deux visages (le sien, puis celui du lauréat), le cœur, des confettis bleu, orange et bleu nuit ; aucun point pour l'étudiante
  assert.equal(await s.page.locator('.fete-match .fm-duo .avatar').count(), 2);
  assert.equal(await s.page.locator('.fete-match .fm-coeur').count(), 1);
  assert.match(await s.page.locator('#fete-titre').innerText(), /C’est un match/);
  const couleurs = await s.page.$$eval('.fete-pluie i', is => [...new Set(is.map(i => i.style.getPropertyValue('--c')))]);
  assert.deepEqual(couleurs.sort(), [...MATCH].sort());
  assert.equal(await s.page.locator('.fete .pastille-pts').count(), 0);
  await fete();
  assert.match(await carte.innerText(), /C’est un match/i);
  // Youssef revient sur l'accueil : « Salma a accepté ton aide », les deux visages, et « Écrire à Salma »
  await s.comme('Youssef'); await s.page.waitForSelector('.fete.fete-match', { timeout: 4000 });
  assert.equal(await s.page.locator('#fete-titre').innerText(), 'Salma a accepté ton aide');
  assert.match(await s.page.locator('.fete').innerText(), new RegExp(`C’est un match pour « ${TITRE} »`));
  assert.equal(await s.page.locator('.fete-match .fm-duo .avatar').count(), 2);
  assert.equal((await s.page.locator('.fete-acts .btn.primary').innerText()).trim(), 'Écrire à Salma');
  await fete();
  // Une seule fois : ni au retour sur l'accueil, ni après un rechargement
  await s.aller('offres'); await s.aller('accueil'); await s.page.waitForTimeout(1300);
  assert.equal(await s.page.locator('.fete-back').count(), 0);
  await s.page.reload(); await s.page.waitForSelector('.hello'); await s.page.waitForTimeout(1300);
  assert.equal(await s.page.locator('.fete-back').count(), 0);
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('premier merci reçu par un lauréat : une fête le cite en entier, une seule fois ; ceux d’avant ne sont pas fêtés', async () => {
  const s = await ouvrir({ largeur: 390 });
  const demo = f => s.page.evaluate(f => { const k = 'ensam-demo-v14', st = JSON.parse(localStorage.getItem(k)); new Function('d', f)(st.data); localStorage.setItem(k, JSON.stringify(st)); }, f);
  const recharger = async () => { await s.page.reload(); await s.page.waitForSelector('.hello'); await s.page.waitForTimeout(1300); };
  // Youssef a déjà des mercis : rien n'est fêté
  await s.comme('Youssef'); await s.page.waitForTimeout(1300);
  assert.equal(await s.page.locator('.fete-back').count(), 0);
  // Nadia vient d'arriver (aucun merci) ; Salma lui dit merci après un mentorat
  await s.comme('Nadia'); await s.page.waitForTimeout(1300);
  assert.equal(await s.page.locator('.fete-back').count(), 0);
  const MOT = 'Merci Nadia pour ces 20 minutes : tes conseils sur l’entretien chez OCP m’ont vraiment rassurée.\nJe me sens prête pour la suite !';
  await demo(`const nadia = d.profiles.find(p => p.full_name === 'Nadia Ferhat'), salma = d.profiles.find(p => p.full_name === 'Salma Bennani');
    const m = d.mentorships.find(x => x.status === 'terminee');
    d.mentorships.push({ ...m, id: 'm-merci-nadia', mentor_id: nadia.id, student_id: salma.id, status: 'terminee', sujet: 'Préparer mon entretien', merci: ${JSON.stringify(MOT)}, rdv_at: new Date(Date.now() - 36e5).toISOString(), created_at: new Date(Date.now() - 864e5).toISOString() });`);
  await recharger(); await s.page.waitForSelector('.fete.fete-merci', { timeout: 3000 });
  assert.equal(await s.page.locator('#fete-titre').innerText(), 'Ton premier merci');
  assert.equal(await s.page.locator('.fete-cite p').innerText(), `« ${MOT} »`, 'le merci est cité en entier');
  assert.match(await s.page.locator('.fete-cite footer').innerText(), /Salma/);
  assert.equal(await s.page.locator('.fete-cite footer .avatar').count(), 1);
  assert.equal((await s.page.locator('.fete-acts .btn').last().innerText()).trim(), 'Avec plaisir');
  await s.page.locator('.fete-acts .btn').last().click(); await s.page.waitForTimeout(200);
  await recharger();
  assert.equal(await s.page.locator('.fete-back').count(), 0, 'une seule fois');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('carte « Fait » : au retour sur l’accueil, l’étape accomplie se coche en vert, puis la suivante arrive ; sur place aussi ; pas par-dessus la fête de fin', async () => {
  const s = await ouvrir({ largeur: 390 });
  await s.comme('Nadia');
  assert.equal(await s.page.getAttribute('.pas', 'data-pas'), 'guide-profil');
  await s.aller('profil'); await s.page.fill('#pf-ent', 'OCP Group');
  await s.page.click('form .row-end .btn.primary'); await s.page.waitForTimeout(300);
  await s.aller('accueil');
  // L'étape faite, cochée en vert, avec l'anneau qui avance d'un cran
  const fait = s.page.locator('.pas.pas-fait');
  assert.equal(await fait.count(), 1);
  assert.equal(await fait.getAttribute('data-pas'), 'fait-profil');
  assert.match(await fait.innerText(), /Premiers pas · 2 sur 5[\s\S]*Complète ton profil[\s\S]*Fait/);
  assert.equal(await fait.locator('.pas-coche svg').count(), 1);
  assert.equal(await s.page.locator('.home .pas').count(), 1, 'une seule carte à la fois');
  assert.equal(await s.page.locator('.pas .btn.primary').count(), 0, 'pas de bouton pendant qu’elle se coche');
  // Puis la suivante arrive, toute seule
  await s.page.waitForSelector('.pas:not(.pas-fait)', { timeout: 3000 });
  assert.equal(await s.page.getAttribute('.pas', 'data-pas'), 'guide-dispo');
  assert.match(await s.page.getAttribute('.pas', 'class'), /pas-arrive/);
  // Sur place : « Me rendre disponible » se coche aussi, puis l'étape suivante
  await s.page.click('.pas .pas-go'); await s.page.waitForSelector('.pas.pas-fait[data-pas="fait-dispo"]', { timeout: 2000 });
  await s.page.waitForSelector('.pas:not(.pas-fait)', { timeout: 3000 });
  assert.notEqual(await s.page.getAttribute('.pas', 'data-pas'), 'guide-dispo');
  // Une seule fois : rien ne se recoche au retour
  await s.aller('offres'); await s.aller('accueil');
  assert.equal(await s.page.locator('.pas.pas-fait').count(), 0);
  await s.page.reload(); await s.page.waitForSelector('.hello');
  assert.equal(await s.page.locator('.pas.pas-fait').count(), 0);
  // La dernière étape : c'est la fête « Premiers pas terminés ! » qui le dit, pas la carte
  await s.comme('Amine');
  const demo = f => s.page.evaluate(f => { const k = 'ensam-demo-v14', st = JSON.parse(localStorage.getItem(k)); new Function('d', f)(st.data); localStorage.setItem(k, JSON.stringify(st)); }, f);
  const vue = await s.page.getAttribute('.pas', 'data-pas');
  assert.match(vue, /^guide-/);
  await demo(`const a = d.profiles.find(p => p.full_name === 'Amine Talbi'); a.cv_path = a.id + '/cv.pdf';
    const o = d.offers.find(x => x.status === 'ouverte' && (x.annees || []).includes(3));
    d.demandes.push({ id: 'dm-amine', auteur_id: a.id, type: 'stage', titre: 'Stage de 3A', details: 'Un stage ouvrier de 1 mois en atelier.', status: 'ouverte', lieu: null, debut: null, duree: null, laureat_id: null, proposition_id: null, match_at: null, created_at: new Date().toISOString(), relancee_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    if (o) d.applications.push({ id: 'ap-amine', offer_id: o.id, student_id: a.id, status: 'envoyee', message: 'Bonjour', created_at: new Date().toISOString() });
    const m = d.mentorships.find(x => x.status === 'demande'); d.mentorships.push({ ...m, id: 'm-amine', student_id: a.id, mentor_id: null, status: 'demande', created_at: new Date().toISOString() });`);
  await s.page.reload(); await s.page.waitForSelector('.hello');
  await s.page.waitForSelector('.fete-back', { timeout: 2000 });
  assert.match(await s.page.locator('#fete-titre').innerText(), /Premiers pas terminés/);
  assert.equal(await s.page.locator('.pas.pas-fait').count(), 0, 'la carte ne coche pas par-dessus la fête');
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
});

test('écrans vides illustrés : une scène dessinée pour aucune demande, aucun message, aucune candidature ; jour et nuit, en arabe aussi', async () => {
  for (const [theme, langue] of [['light', 'fr'], ['dark', 'ar']]) {
    const s = await ouvrir({ largeur: 390, theme, langue });
    const scenes = {};
    const voir = async (nom, e, scene) => {
      await s.comme(nom); await s.aller(e);
      const el = s.page.locator(`.empty .es.es-${scene}`).first();
      assert.equal(await el.count(), 1, `${nom} · ${e} : la scène ${scene}`);
      assert.equal(await el.getAttribute('aria-hidden'), 'true');
      scenes[scene] = await el.evaluate(x => ({ ko: x.innerHTML.length / 1024, soleil: getComputedStyle(x.querySelector('.es-soleil')).fill, etoiles: getComputedStyle(x.querySelector('.es-etoiles')).opacity,
        miroir: getComputedStyle(x.querySelector('svg')).transform, w: x.getBoundingClientRect().width, deborde: x.getBoundingClientRect().right > innerWidth || x.getBoundingClientRect().left < 0 }));
    };
    await voir('Hajar', 'messages', 'messages');
    await voir('Amine', 'parcours', 'candidatures');
    // Aucune demande d'étudiant dans le réseau : la porte de l'école et un avion de papier qui attend
    await s.aller('accueil');
    await s.page.evaluate(() => { const k = 'ensam-demo-v14', st = JSON.parse(localStorage.getItem(k)); st.data.demandes = []; st.data.propositions = []; localStorage.setItem(k, JSON.stringify(st)); });
    await s.page.reload(); await s.page.waitForSelector('.hello');
    await voir('Youssef', 'offres/demandes', 'demandes');
    for (const [k, v] of Object.entries(scenes)) {
      assert.ok(v.ko < 4, `${k} : ${v.ko.toFixed(1)} Ko, une petite scène`);
      assert.ok(v.w >= 150 && !v.deborde, `${k} : ${v.w} px`);
      assert.equal(v.etoiles, theme === 'dark' ? '1' : '0', `${k} : les étoiles la nuit seulement`);
      assert.equal(v.soleil, theme === 'dark' ? 'rgb(239, 233, 214)' : 'rgb(255, 201, 77)', `${k} : le soleil le jour, la lune la nuit`);
      assert.equal(v.miroir !== 'none', langue === 'ar', `${k} : la scène suit le sens de lecture`);
    }
    assert.ok((await s.debordement()) <= 0);
    assert.deepEqual(s.erreurs, []);
    await s.ctx.close();
  }
});

test('le décor ne tourne plus sans fin : l’entrée dessinée s’anime à l’ouverture puis se pose ; immobile si l’appareil réduit les animations', async () => {
  let s = await ouvrir({ largeur: 390, mouvement: true });
  await s.comme('Youssef'); await s.page.waitForTimeout(300);
  const boucles = () => s.page.evaluate(() => document.getAnimations().filter(a => a.effect?.target?.closest?.('.scene')).map(a => {
    const t = a.effect.getComputedTiming();
    return { qui: a.effect.target.getAttribute('class'), nom: a.animationName, fin: t.endTime };
  }));
  const anims = await boucles();
  assert.ok(anims.length > 10, 'l’entrée s’anime à l’ouverture');
  const sansFin = anims.filter(a => !Number.isFinite(a.fin));
  assert.deepEqual(sansFin, [], 'aucune animation de la scène sans fin');
  // Tout ce qu'on voit (hors oiseaux qui s'en vont) se pose en une dizaine de secondes
  const longues = anims.filter(a => a.fin > 10500 && !/sc-fly|sc-flap/.test(a.nom));
  assert.deepEqual(longues, []);
  // Les écrans vides aussi : un seul mouvement à l'arrivée
  await s.comme('Hajar'); await s.aller('messages');
  const vides = await s.page.evaluate(() => document.getAnimations().filter(a => a.effect?.target?.closest?.('.es')).map(a => a.effect.getComputedTiming().endTime));
  assert.ok(vides.length > 0 && vides.every(x => Number.isFinite(x) && x < 4000), JSON.stringify(vides));
  assert.deepEqual(s.erreurs, []);
  await s.ctx.close();
  s = await ouvrir({ largeur: 390 });
  await s.comme('Youssef'); await s.page.waitForTimeout(300);
  assert.equal((await boucles()).length, 0, 'immobile avec « Réduire les animations »');
  await s.ctx.close();
});

test('arabe : les fêtes du match et du merci, et la carte « Fait », sont traduites ; les visages suivent le sens de lecture', async () => {
  const s = await ouvrir({ largeur: 390, langue: 'ar' });
  await s.comme('Youssef'); await s.page.waitForTimeout(300);
  const ar = await s.page.evaluate(async () => {
    const { t } = await import('./i18n.js');
    return ['Salma a accepté ton aide', 'C’est un match pour « PFE en lean ». Écris-lui pour la suite, et déclare son démarrage dès qu’il a lieu.', 'Accepter l’aide de Youssef ?',
      'Oui, accepter', 'Fait', 'Ton premier merci', 'Avec plaisir', 'Quelqu’un que tu as aidé t’a laissé ce mot :', 'Les autres propositions seront closes, et vous verrez vos coordonnées.', 'Écrire à Salma'].map(t);
  });
  for (const x of ar) assert.doesNotMatch(x.replace(/Salma|Youssef|PFE en lean/g, ''), /[A-Za-zÀ-ÿ]{3,}/, x);
  await s.page.evaluate(async () => {
    const ui = await import(new URL('ui.js', location.href).href);
    const { data } = JSON.parse(localStorage.getItem('ensam-demo-v14'));
    const p = n => data.profiles.find(x => x.full_name === n);
    ui.celebrate({ cle: 'test-match-' + Date.now(), titre: 'Salma a accepté ton aide', visages: [p('Youssef El Amrani'), p('Salma Bennani')] });
  });
  await s.page.waitForSelector('.fete-match');
  const [a, b] = await s.page.$$eval('.fm-duo .fm-v', vs => vs.map(v => v.getBoundingClientRect().left));
  assert.ok(a > b, 'en arabe, le premier visage est à droite');
  const coeur = await s.page.$eval('.fm-coeur', c => { const r = c.getBoundingClientRect(), d = c.parentElement.getBoundingClientRect(); return Math.abs((r.left + r.right) / 2 - (d.left + d.right) / 2); });
  assert.ok(coeur < 2, 'le cœur est entre les deux visages');
  assert.deepEqual((await s.page.evaluate(() => [...(window.__ensamMissing || [])])).filter(x => !ecritParUnMembre(x)), []);
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
