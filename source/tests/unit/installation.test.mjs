// L'application installable : le manifeste se lit et chaque image qu'il cite existe, à la taille annoncée ; les écrans de
// démarrage de l'iPhone (outils/generer-demarrage.mjs) ont chacun leur balise dans la page publiée, moins de 60 Ko, et ne
// sont pas préchargés par le service worker ; les drapeaux du guide de l'étranger couvrent chaque pays connu, avec leur
// licence. Le tout reste léger : moins de 2 Mo d'images ajoutées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PAYS_AR, codePays } from '../../src/geo.js';

const SRC = new URL('../../src/', import.meta.url).pathname;
const RACINE = new URL('../../../', import.meta.url).pathname;
const lire = f => fs.readFileSync(f);

// Largeur et hauteur d'une image, lues dans son en-tête (PNG : IHDR ; JPEG : le premier SOF)
function dimensions(f) {
  const b = lire(f);
  if (b.subarray(1, 4).toString() === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)];
  assert.ok(b[0] === 0xFF && b[1] === 0xD8, `${f} : ni PNG ni JPEG`);
  for (let i = 2; i < b.length;) {
    if (b[i] !== 0xFF) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xC0 && m <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(m)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error(`${f} : taille introuvable`);
}
const taille = f => `${dimensions(f).join('x')}`;
const poids = d => fs.readdirSync(d).reduce((n, f) => n + fs.statSync(path.join(d, f)).size, 0);

test('manifeste : un JSON valide ; icônes, captures et raccourcis existent, à la taille annoncée ; une capture narrow et une wide', () => {
  const m = JSON.parse(fs.readFileSync(path.join(SRC, 'pwa/manifest.webmanifest'), 'utf8'));
  for (const k of ['name', 'short_name', 'start_url', 'scope', 'display', 'background_color', 'theme_color']) assert.ok(m[k], `manifeste : ${k}`);
  const images = [...m.icons, ...m.screenshots, ...(m.shortcuts || []).flatMap(s => s.icons || [])];
  assert.ok(images.length >= 5);
  for (const im of images) {
    const f = path.join(SRC, 'pwa', im.src);
    assert.ok(fs.existsSync(f), `image du manifeste introuvable : ${im.src}`);
    assert.equal(taille(f), im.sizes, `${im.src} : taille annoncée`);
    if (im.type) assert.equal(im.type, /\.png$/.test(im.src) ? 'image/png' : 'image/jpeg', `${im.src} : type`);
  }
  const captures = Object.fromEntries(m.screenshots.map(s => [s.form_factor, s]));
  assert.deepEqual(Object.keys(captures).sort(), ['narrow', 'wide']);
  assert.equal(captures.narrow.sizes, '1080x1920');
  assert.equal(captures.wide.sizes, '1920x1080');
  for (const s of m.screenshots) assert.match(s.label, /données fictives/, 'une capture de la démo le dit');
});

test('iPhone : un écran de démarrage par taille d’écran, moins de 60 Ko, chacun avec sa balise dans la page publiée ; ni lui ni les captures dans le préchargement', () => {
  const d = path.join(SRC, 'pwa/demarrage');
  const index = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
  const fichiers = fs.readdirSync(d);
  const tailles = [];
  for (const f of fichiers) {
    const m = f.match(/^iphone-(\d+)x(\d+)-(\d)x\.png$/);
    assert.ok(m, `nom inattendu : ${f}`);
    const [, l, h, x] = m.map(Number);
    assert.equal(taille(path.join(d, f)), `${l * x}x${h * x}`, f);
    assert.ok(fs.statSync(path.join(d, f)).size < 60 * 1024, `${f} : moins de 60 Ko`);
    assert.ok(index.includes(`<link rel="apple-touch-startup-image" media="(device-width: ${l}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${x}) and (orientation: portrait)" href="pwa/demarrage/${f}">`), `balise de ${f}`);
    tailles.push(`${l * x}x${h * x}`);
  }
  for (const t of ['1179x2556', '1290x2796', '1170x2532', '1284x2778', '1125x2436', '1242x2688', '828x1792', '750x1334', '640x1136']) assert.ok(tailles.includes(t), `écran de démarrage ${t}`);
  // Chaque balise de la page mène à un fichier
  for (const [, f] of index.matchAll(/rel="apple-touch-startup-image"[^>]*href="pwa\/demarrage\/([^"]+)"/g)) assert.ok(fichiers.includes(f), `balise sans image : ${f}`);
  assert.equal([...index.matchAll(/apple-touch-startup-image/g)].length, fichiers.length);
  // Le service worker ne les garde pas d'avance (3G) : l'iPhone et le navigateur les demandent eux-mêmes
  const sw = fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8');
  assert.doesNotMatch(sw, /pwa\/(demarrage|captures)\//);
});

test('drapeaux : un par pays connu du guide (flag-icons, 4:3), la licence MIT avec eux, rien de plus', () => {
  const d = path.join(SRC, 'img/drapeaux');
  const codes = new Set(Object.keys(PAYS_AR).map(p => codePays(p)?.toLowerCase()));
  assert.ok(!codes.has(undefined) && codes.size >= 60, 'chaque pays connu a son code');
  for (const c of codes) {
    const f = path.join(d, `${c}.svg`);
    assert.ok(fs.existsSync(f), `drapeau manquant : ${c}`);
    assert.match(fs.readFileSync(f, 'utf8'), /^<svg[^>]*viewBox="0 0 640 480"/, `${c} : 4:3`);
  }
  assert.deepEqual(fs.readdirSync(d).filter(f => f !== 'LICENSE').map(f => f.replace(/\.svg$/, '')).filter(c => !codes.has(c)), [], 'aucun drapeau inutile');
  const licence = fs.readFileSync(path.join(d, 'LICENSE'), 'utf8');
  assert.match(licence, /MIT License/); assert.match(licence, /Panayiotis Lipiridis/); assert.match(licence, /Permission is hereby granted/);
  // Un pays écrit autrement mène au même drapeau ; un pays inconnu n'en a pas (le guide garde son icône)
  assert.equal(codePays('USA'), codePays('États-Unis'));
  assert.equal(codePays('فرنسا'), 'FR');
  assert.equal(codePays('canada'), 'CA');
  assert.equal(codePays('Atlantide'), null);
  assert.equal(codePays(''), null);
});

test('images ajoutées (drapeaux, écrans de démarrage, captures) : moins de 2 Mo en tout', () => {
  const total = ['img/drapeaux', 'pwa/demarrage', 'pwa/captures'].reduce((n, d) => n + poids(path.join(SRC, d)), 0);
  assert.ok(total < 2 * 1024 * 1024, `${Math.round(total / 1024)} Ko`);
});
