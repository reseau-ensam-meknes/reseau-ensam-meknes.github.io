// Pages d'aperçu des liens de promo (outils/pages-promo.mjs) : une par promo et par langue, stables d'une construction à l'autre
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

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
