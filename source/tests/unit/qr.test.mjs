// QR code des affiches et du mode évènement (src/qr.js, port du générateur MIT de Project Nayuki) :
// chaque code produit est relu par un vrai lecteur (jsQR), depuis la matrice et depuis le SVG dessiné.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { qrModules, qrSVG, QrCode, Ecc } from '../../src/qr.js';

const jsQR = createRequire(import.meta.url)('jsqr');

// Une image RGBA : chaque module fait « px » pixels, avec la marge blanche autour (4 modules, comme sur l'affiche)
function image(modules, px = 6, marge = 4) {
  const n = modules.length, cote = (n + 2 * marge) * px;
  const rgba = new Uint8ClampedArray(cote * cote * 4).fill(255);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!modules[y][x]) continue;
    for (let dy = 0; dy < px; dy++) for (let dx = 0; dx < px; dx++) {
      const i = (((y + marge) * px + dy) * cote + (x + marge) * px + dx) * 4;
      rgba[i] = rgba[i + 1] = rgba[i + 2] = 0;
    }
  }
  return { rgba, cote };
}
const lire = (modules, px, marge) => { const { rgba, cote } = image(modules, px, marge); return jsQR(rgba, cote, cote, { inversionAttempts: 'dontInvert' })?.data ?? null; };

// Le SVG dessine des bandes horizontales (M x y h l v1 h-l z) : on les remet en matrice, marge comprise
function depuisSVG(svg) {
  const n = Number(/viewBox="0 0 (\d+) \1"/.exec(svg)?.[1]);
  assert.ok(n > 21, 'viewBox carré attendu');
  const m = Array.from({ length: n }, () => Array(n).fill(false));
  const d = /<path d="([^"]*)"/.exec(svg)[1];
  for (const [, x, y, l] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) for (let i = 0; i < Number(l); i++) m[Number(y)][Number(x) + i] = true;
  return m;
}

const TEXTES = [
  'https://reseau-ensam-meknes.github.io/promo/2027/',
  'https://reseau-ensam-meknes.github.io/?promo=2029&lang=ar',
  'RESEAU ENSAM MEKNES 2026',
  '0612345678',
  'Réseau ENSAM Meknès : شبكة ENSAM مكناس',
  'x'.repeat(300),
];

test('chaque code se relit à l’identique depuis la matrice', () => {
  for (const t of TEXTES) assert.equal(lire(qrModules(t), 6, 4), t, t.slice(0, 40));
});

test('le SVG relu donne le même texte, et sa marge fait 4 modules', () => {
  for (const t of TEXTES) {
    const svg = qrSVG(t);
    const m = depuisSVG(svg), n = qrModules(t).length;
    assert.equal(m.length, n + 8);
    // Rien de noir dans la marge
    for (let i = 0; i < m.length; i++) for (let j = 0; j < m.length; j++) if (i < 4 || j < 4 || i >= n + 4 || j >= n + 4) assert.equal(m[i][j], false);
    assert.equal(lire(m, 5, 0), t, t.slice(0, 40));
  }
});

test('correction d’erreur au moins moyenne (M), et la taille suit la longueur', () => {
  const court = QrCode.encodeText('https://reseau-ensam-meknes.github.io/promo/2027/', Ecc.MEDIUM);
  assert.ok(court.errorCorrectionLevel.ordinal >= Ecc.MEDIUM.ordinal);
  assert.equal(qrModules('https://reseau-ensam-meknes.github.io/promo/2027/').length, court.size);
  assert.ok(qrModules('x'.repeat(300)).length > court.size);
  // Le niveau choisi peut être relevé par le générateur (même version, meilleure correction) mais jamais baissé
  assert.ok(QrCode.encodeText('A', Ecc.LOW).errorCorrectionLevel.ordinal >= Ecc.LOW.ordinal);
});

test('le SVG se lit comme une image (titre) ou se tait (décor)', () => {
  const avec = qrSVG('https://exemple.ma', { titre: 'QR code : rejoindre le réseau' });
  assert.match(avec, /^<svg [^>]*role="img"[^>]*aria-label="QR code : rejoindre le réseau"/);
  const sans = qrSVG('https://exemple.ma');
  assert.match(sans, /aria-hidden="true"/);
  // Un titre avec des guillemets ou des chevrons reste un attribut sûr
  assert.doesNotMatch(qrSVG('a', { titre: '"><script>' }), /<script>/);
});
