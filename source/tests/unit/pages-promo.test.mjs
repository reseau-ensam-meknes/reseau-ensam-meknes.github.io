// Pages d'aperçu des liens de promo (outils/pages-promo.mjs) : une par promo et par langue, stables d'une construction à l'autre
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

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
  // Celles de l'ENSAM Meknès (promo/AAAA/, promo/AAAA/ar/) et leurs pages neutres (promo/AAAA/e/, promo/AAAA/ar/e/)
  assert.equal(Object.keys(pages).length, 204);
  assert.equal(Object.keys(pages).filter(f => /^promo\/\d{4}\/(ar\/)?index\.html$/.test(f)).length, 102);
  assert.equal(Object.keys(pages).filter(f => /^promo\/\d{4}\/(ar\/)?e\/index\.html$/.test(f)).length, 102);
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
  // Les textes et les balises de la page ne changent pas : ils ne nomment que l'ENSAM Meknès (les pages neutres, aucune
  // école : aucune page n'en nomme une autre), et le lien de secours (sans JavaScript) reste celui d'avant
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

// Les pages neutres (promo/AAAA/e/, promo/AAAA/ar/e/) : celles des liens d'une autre école que l'ENSAM Meknès (avecEcole,
// regles-entree.js, y mène quand il ajoute &ecole=). L'aperçu ne nomme aucune école : « Réseau ENSAM », « de ton école »,
// une entrée d'école dessinée dont la porte dit « ENSAM » (img/apercu-promo-neutre.jpg) ; la personne est envoyée vers le
// site comme depuis la page d'avant (l'école, le code de qui invite, l'arabe)
test('pages de l’ENSAM Meknès (promo/AAAA/, promo/AAAA/ar/) : à l’octet celles d’avant', () => {
  const meknes = Object.entries(construire()).filter(([f]) => /^promo\/\d{4}\/(ar\/)?index\.html$/.test(f)).sort(([a], [b]) => (a < b ? -1 : 1));
  // Empreinte calculée sur le code d'avant (8eaeb9a), avec la même adresse du site
  assert.equal(createHash('sha256').update(JSON.stringify(meknes)).digest('hex'), '8f095c710b261fb8d4d773a3c6e8a0a15103a09e9b5f1b7560789b315e3699ca');
});

test('page neutre de la promo 2019 (lien d’une autre école) : aperçu sans nom d’école, en français et en arabe ; le site avec ?promo=2019, l’école et le code', () => {
  const pages = construire(), fr = pages['promo/2019/e/index.html'], ar = pages['promo/2019/ar/e/index.html'];
  const meta = (p, k) => (p.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]*)">`)) || [])[1];
  assert.deepEqual(['og:site_name', 'og:title', 'og:description', 'description', 'og:image', 'og:image:alt', 'og:url', 'og:locale'].map(k => meta(fr, k)), [
    'Réseau ENSAM', 'Promo 2019 · tes camarades sont sur le Réseau',
    'Initiative de lauréats, indépendante de l’école : stages, PFE, emplois et conseils entre lauréats et étudiants de ton école. Inscription gratuite, ta promo est déjà indiquée.',
    'Initiative de lauréats, indépendante de l’école : stages, PFE, emplois et conseils entre lauréats et étudiants de ton école. Inscription gratuite, ta promo est déjà indiquée.',
    `${SITE}img/apercu-promo-neutre.jpg`, 'Dessin d’une entrée d’école', `${SITE}promo/2019/e/`, 'fr_FR']);
  assert.ok(fr.includes(`<link rel="canonical" href="${SITE}promo/2019/e/">`));
  assert.ok(fr.includes('<title>Promo 2019 · tes camarades sont sur le Réseau</title>'));
  assert.ok(fr.includes('<body><p><a href="../../../?promo=2019">Ouvrir le Réseau ENSAM</a></p></body>'));
  assert.ok(ar.includes('<html lang="ar" dir="rtl">'));
  assert.deepEqual(['og:site_name', 'og:title', 'og:description', 'og:image', 'og:image:alt', 'og:url', 'og:locale'].map(k => meta(ar, k)), [
    'شبكة ENSAM', 'دفعة 2019 · زملاؤك على الشبكة',
    'مبادرة من الخريجين، مستقلة عن إدارة المدرسة: تداريب، مشاريع نهاية الدراسة، وظائف ونصائح بين خريجي وطلبة مدرستك. التسجيل مجاني، ودفعتك محدَّدة مسبقًا.',
    `${SITE}img/apercu-promo-neutre.jpg`, 'رسم لمدخل مدرسة', `${SITE}promo/2019/ar/e/`, 'ar_MA']);
  assert.ok(ar.includes('<body><p><a href="../../../../?promo=2019&amp;lang=ar">فتح شبكة ENSAM</a></p></body>'));
  // Aucune page neutre ne nomme une école (ni l'ENSAM Meknès, ni une autre), ni ne dit l'école ailleurs que dans son script
  for (const [f, p] of Object.entries(pages).filter(([f]) => /\/e\/index\.html$/.test(f))) {
    assert.doesNotMatch(p, /Meknès|مكناس|Casablanca|Fès|Settat|apercu-promo\.jpg/, f);
    assert.doesNotMatch(p.replace(/<script>[\s\S]*?<\/script>/, ''), /ecole=/, f);
    assert.ok(Buffer.byteLength(p) < 2500, `${f} : ${Buffer.byteLength(p)} octets`);
  }
  // Le script : comme la page d'avant, un dossier plus bas
  assert.equal(suivre(fr, '?ecole=ensa-fes&de=nadia219', '#x'), '../../../?promo=2019&ecole=ensa-fes&de=nadia219#x');
  assert.equal(suivre(fr, '?de=nadia219&ecole=fst-settat'), '../../../?promo=2019&ecole=fst-settat&de=nadia219');
  assert.equal(suivre(ar, '?ecole=ensa-fes'), '../../../../?promo=2019&lang=ar&ecole=ensa-fes');
  assert.equal(suivre(ar, '?ecole=ENSA%3Cx%3E&de=nadia219'), '../../../../?promo=2019&lang=ar&de=nadia219', 'une école mal écrite ne suit pas');
  assert.equal(suivre(fr, ''), '../../../?promo=2019');
});

// L'image des pages de l'ENSAM Meknès, telle qu'elle était (1590345) : jamais refaite avec la page neutre
const EMPREINTE_APERCU_PROMO = 'd13d9b6d1243c7f4be1b5ba9583e3c9a580f6329cf9fbf5f2de2dca25c2a728e';
// Hauteur et largeur d'une image JPEG (son premier en-tête SOF)
function tailleJpeg(b) {
  for (let i = 2; i < b.length;) {
    const m = b[i + 1], n = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + n;
  }
  return null;
}
test('image des pages neutres : 1200 × 630, moins de 300 Ko, différente de celle de l’ENSAM Meknès (gardée telle quelle)', () => {
  const neutre = fs.readFileSync(new URL('../../src/img/apercu-promo-neutre.jpg', import.meta.url)), meknes = fs.readFileSync(new URL('../../src/img/apercu-promo.jpg', import.meta.url));
  assert.deepEqual(tailleJpeg(neutre), [1200, 630]);
  assert.ok(neutre.length < 300_000, `${neutre.length} octets`);
  assert.notDeepEqual(neutre, meknes);
  assert.equal(createHash('sha256').update(meknes).digest('hex'), EMPREINTE_APERCU_PROMO);
});

test('pages neutres, service worker actif : la même adresse que la page ; celles d’avant, comme avant', () => {
  const sw = redirectionSW();
  assert.deepEqual(sw('promo/2019/e/?ecole=ensa-fes&de=nadia219'), { url: './?promo=2019&ecole=ensa-fes&de=nadia219', status: 302 });
  assert.deepEqual(sw('promo/2019/ar/e/?ecole=ensa-fes'), { url: './?promo=2019&lang=ar&ecole=ensa-fes', status: 302 });
  assert.deepEqual(sw('promo/2019/e/index.html?de=nadia219&ecole=fst-settat'), { url: './?promo=2019&ecole=fst-settat&de=nadia219', status: 302 });
  assert.deepEqual(sw('promo/2019/ar/e/?ecole=ENSA&de=nadia219'), { url: './?promo=2019&lang=ar&de=nadia219', status: 302 });
  assert.deepEqual(sw('promo/2019/'), { url: './?promo=2019', status: 302 });
  assert.deepEqual(sw('promo/2019/ar/?de=nadia219'), { url: './?promo=2019&lang=ar&de=nadia219', status: 302 });
});
