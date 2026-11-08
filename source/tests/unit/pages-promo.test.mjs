// Pages d'aperçu des liens de promo (outils/pages-promo.mjs) : une par promo et par langue, stables d'une construction à l'autre
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const SOURCE = new URL('../../', import.meta.url).pathname;
const SITE = 'https://reseau-ensam-meknes.github.io/';
function construire() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-'));
  fs.writeFileSync(path.join(tmp, 'index.html'), `<meta property="og:image" content="${SITE}img/apercu.jpg">`);
  execFileSync('node', ['outils/pages-promo.mjs', tmp], { cwd: SOURCE, stdio: 'pipe' });
  const pages = {};
  (function lister(d) { for (const e of fs.readdirSync(path.join(tmp, d), { withFileTypes: true })) { const r = path.join(d, e.name); if (e.isDirectory()) lister(r); else if (r !== 'index.html') pages[r] = fs.readFileSync(path.join(tmp, r), 'utf8'); } })('');
  fs.rmSync(tmp, { recursive: true, force: true });
  return pages;
}

test('pages de promo : 1990 à 2040, en français et en arabe, identiques à chaque construction', () => {
  const pages = construire();
  assert.equal(Object.keys(pages).length, 102);
  assert.ok(!pages['promo/1989/index.html'] && !pages['promo/2041/index.html']);
  for (const [f, s] of Object.entries(pages)) assert.ok(Buffer.byteLength(s) < 2500, `${f} : ${Buffer.byteLength(s)} octets`);
  assert.deepEqual(construire(), pages);
});

test('page de la promo 2019 : aperçu qui nomme la promo, puis le site avec ?promo=2019', () => {
  const p = construire()['promo/2019/index.html'];
  assert.ok(p.includes('<meta property="og:title" content="Promo 2019 · tes camarades sont sur le Réseau">'));
  assert.ok(p.includes(`<meta property="og:url" content="${SITE}promo/2019/">`));
  assert.ok(p.includes(`<link rel="canonical" href="${SITE}promo/2019/">`));
  assert.ok(p.includes(`content="${SITE}img/apercu-promo.jpg"`));
  assert.ok(p.includes('location.replace("../../?promo=2019"'));
  assert.doesNotMatch(p, /http-equiv/);
  assert.doesNotMatch(p, /l’école (?:soutient|vérifie)|officiel/i);
});

test('page arabe de la promo 2019', () => {
  const p = construire()['promo/2019/ar/index.html'];
  assert.ok(p.includes('dir="rtl"'));
  assert.ok(p.includes('دفعة 2019 · زملاؤك على الشبكة'));
  assert.ok(p.includes('../../../?promo=2019&lang=ar'));
  assert.ok(p.includes(`<meta property="og:url" content="${SITE}promo/2019/ar/">`));
});

test('sans og:image dans index.html, la construction s’arrête', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-'));
  fs.writeFileSync(path.join(tmp, 'index.html'), '<title>x</title>');
  assert.throws(() => execFileSync('node', ['outils/pages-promo.mjs', tmp], { cwd: SOURCE, stdio: 'pipe' }));
  fs.rmSync(tmp, { recursive: true, force: true });
});

// Où le script d'une page d'aperçu envoie la personne, pour une adresse donnée (location.search, location.hash)
function suivre(page, search, hash = '') {
  const script = /<script>([\s\S]*?)<\/script>/.exec(page)[1];
  let vers = null;
  vm.runInNewContext(script, { location: { search, hash, replace: u => { vers = u; } } });
  return vers;
}

test('lien de promo d’une autre école : la page d’aperçu fait suivre l’école (&ecole=…) avec le code de qui invite ; sans école, comme avant', () => {
  const pages = construire(), fr = pages['promo/2019/index.html'], ar = pages['promo/2019/ar/index.html'];
  // Sans école (les liens de l'ENSAM Meknès) : la même adresse qu'avant
  assert.equal(suivre(fr, ''), '../../?promo=2019');
  assert.equal(suivre(fr, '?de=nadia219'), '../../?promo=2019&de=nadia219');
  assert.equal(suivre(ar, '?de=nadia219', '#x'), '../../../?promo=2019&lang=ar&de=nadia219#x');
  // L'école du lien suit, avant le code, en français et en arabe, quel que soit l'ordre dans l'adresse
  assert.equal(suivre(fr, '?ecole=ensa-fes'), '../../?promo=2019&ecole=ensa-fes');
  assert.equal(suivre(fr, '?ecole=ensa-fes&de=nadia219'), '../../?promo=2019&ecole=ensa-fes&de=nadia219');
  assert.equal(suivre(fr, '?de=nadia219&ecole=ensa-fes', '#x'), '../../?promo=2019&ecole=ensa-fes&de=nadia219#x');
  assert.equal(suivre(ar, '?ecole=ensa-fes&de=nadia219'), '../../../?promo=2019&lang=ar&ecole=ensa-fes&de=nadia219');
  assert.equal(suivre(ar, '?utm=1&ecole=fst-settat'), '../../../?promo=2019&lang=ar&ecole=fst-settat');
  // Une école mal écrite ne suit pas (la règle d'ecoleValide : 2 à 40 lettres minuscules, chiffres, tirets)
  for (const q of ['?ecole=ENSA', '?ecole=%3Cscript%3E', '?ecole=<script>', '?ecole=a', '?ecole=' + 'a'.repeat(41), '?ecole=', '?xecole=ensa-fes', '?ecole=ensa-fes%26de%3Dx', '?ecole=ensa_fes', '?ecole=ensa-fès']) {
    assert.equal(suivre(fr, q + '&de=nadia219'), '../../?promo=2019&de=nadia219', q);
  }
  assert.equal(suivre(fr, '?ecole=' + 'a'.repeat(40)), '../../?promo=2019&ecole=' + 'a'.repeat(40));
  // Les textes et les balises de la page ne changent pas : ils ne nomment que l'ENSAM Meknès (aucune page pour une autre école),
  // et le lien de secours (sans JavaScript) reste celui d'avant
  for (const [f, page] of Object.entries(pages)) {
    const sansScript = page.replace(/<script>[\s\S]*?<\/script>/, '');
    assert.doesNotMatch(sansScript, /ecole=/, f);
    assert.doesNotMatch(page, /Casablanca|Fès|Settat/, f);
  }
  assert.ok(fr.includes('<body><p><a href="../../?promo=2019">Ouvrir le Réseau ENSAM Meknès</a></p></body>'));
  assert.ok(ar.includes('<body><p><a href="../../../?promo=2019&amp;lang=ar">فتح شبكة ENSAM مكناس</a></p></body>'));
});

// Le service worker, qui remplace la page d'aperçu pour qui est déjà venu : la même adresse que la page
function redirectionSW() {
  const ecoutes = {};
  const ctx = {
    self: { addEventListener: (t, f) => { (ecoutes[t] ||= []).push(f); }, registration: { scope: 'https://site.ma/' } },
    location: new URL('https://site.ma/'), URL, caches: {},
    Response: { redirect: (url, status) => ({ url, status }) },
  };
  vm.runInNewContext(fs.readFileSync(new URL('../../src/sw.js', import.meta.url), 'utf8'), ctx);
  const site = ecoutes.fetch[1];
  return chemin => {
    let rep = null;
    site({ request: { method: 'GET', mode: 'navigate', url: 'https://site.ma/' + chemin }, respondWith: r => { rep = r; } });
    return rep && { url: rep.url.replace('https://site.ma/', './'), status: rep.status };
  };
}

test('lien de promo d’une autre école, service worker actif : l’école suit aussi, avant le code ; sans école, comme avant', () => {
  const sw = redirectionSW();
  assert.deepEqual(sw('promo/2019/'), { url: './?promo=2019', status: 302 });
  assert.deepEqual(sw('promo/2019/?de=nadia219'), { url: './?promo=2019&de=nadia219', status: 302 });
  assert.deepEqual(sw('promo/2019/ar/?ecole=ensa-fes&de=nadia219'), { url: './?promo=2019&lang=ar&ecole=ensa-fes&de=nadia219', status: 302 });
  assert.deepEqual(sw('promo/2019/index.html?de=nadia219&ecole=fst-settat'), { url: './?promo=2019&ecole=fst-settat&de=nadia219', status: 302 });
  assert.deepEqual(sw('promo/2019/?ecole=ensa-fes'), { url: './?promo=2019&ecole=ensa-fes', status: 302 });
  for (const q of ['ENSA', '%3Cscript%3E', 'a', 'a'.repeat(41), '', 'ensa_fes', 'ensa-f%C3%A8s', 'ensa-fes%26de%3Dx']) {
    assert.deepEqual(sw(`promo/2019/?ecole=${q}&de=nadia219`), { url: './?promo=2019&de=nadia219', status: 302 }, q);
  }
});
