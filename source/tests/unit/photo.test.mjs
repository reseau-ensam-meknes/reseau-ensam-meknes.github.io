// Photo de profil depuis le CV : où sont les images de la première page, laquelle ressemble à une photo de la personne
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imagesDeLaPage, candidatsPhoto, ressemblePhoto } from '../../src/lire-cv.js';

const OPS = { save: 10, restore: 11, transform: 12, paintFormXObjectBegin: 74, paintFormXObjectEnd: 75, paintImageXObject: 85, paintInlineImageXObject: 86 };
const A4 = [0, 0, 595, 842];
const liste = ops => ({ fnArray: ops.map(o => o[0]), argsArray: ops.map(o => o[1]) });

test('position des images : les transformations s’enchaînent et se referment', () => {
  const imgs = imagesDeLaPage(liste([
    [OPS.save], [OPS.transform, [1, 0, 0, 1, 400, 600]], [OPS.save], [OPS.transform, [120, 0, 0, 150, 0, 0]], [OPS.paintImageXObject, ['img_1', 300, 375]], [OPS.restore], [OPS.restore],
    [OPS.paintFormXObjectBegin, [[2, 0, 0, 2, 10, 10], [0, 0, 100, 100]]], [OPS.transform, [30, 0, 0, 20, 0, 0]], [OPS.paintImageXObject, ['g_2', 90, 60]], [OPS.paintFormXObjectEnd],
    [OPS.transform, [50, 0, 0, 50, 20, 20]], [OPS.paintInlineImageXObject, [{ width: 16, height: 16 }]],
  ]), OPS);
  assert.deepEqual(imgs.map(({ ref, x, y, lw, lh }) => [typeof ref === 'string' ? ref : 'en ligne', x, y, lw, lh]),
    [['img_1', 400, 600, 120, 150], ['g_2', 10, 10, 60, 40], ['en ligne', 20, 20, 50, 50]]);
});

test('candidats : en haut de la page, à peu près carrés, ni minuscules ni pleine page ; le plus grand d’abord', () => {
  const img = (ref, w, h, x, y, lw, lh) => ({ ref, w, h, x, y, lw, lh });
  const c = candidatsPhoto([
    img('photo', 400, 500, 440, 640, 110, 137),
    img('petite-photo', 200, 200, 40, 700, 70, 70),
    img('logo-large', 600, 150, 40, 780, 160, 40),      // bandeau : trop allongé
    img('icone', 32, 32, 40, 760, 12, 12),              // pictogramme : trop petit
    img('fond', 1240, 1754, 0, 0, 595, 842),            // image pleine page (CV scanné, fond décoratif)
    img('bas', 300, 300, 400, 80, 100, 100),            // en bas de page : un logo d'école, une signature
  ], A4);
  assert.deepEqual(c.map(x => x.ref), ['photo', 'petite-photo']);
});

const pixels = (n, f) => { const px = new Uint8ClampedArray(n * n * 4); for (let i = 0; i < n * n; i++) px.set(f(i % n, Math.floor(i / n)), i * 4); return px; };

test('photo ou logo : une photo a des nuances partout ; un logo, quelques aplats ou beaucoup de transparence', () => {
  // « Visage » : dégradés de peau sur un fond clair légèrement bruité
  let graine = 7; const bruit = () => ((graine = (graine * 16807) % 2147483647) % 24) - 12;
  const photo = pixels(48, (x, y) => { const d = Math.hypot(x - 24, y - 20); return d < 14 ? [190 + bruit() - d * 2, 140 + bruit() - d, 110 + bruit(), 255] : [225 + bruit(), 228 + bruit(), 232 + bruit(), 255]; });
  assert.equal(ressemblePhoto(photo), true);
  // Photo en noir et blanc
  const nb = pixels(48, (x, y) => { const v = 40 + x * 3 + y * 1.5 + bruit(); return [v, v, v, 255]; });
  assert.equal(ressemblePhoto(nb), true);
  // Photo détourée en rond : coins transparents (environ 21 %)
  const rond = pixels(48, (x, y) => (Math.hypot(x - 23.5, y - 23.5) > 24 ? [0, 0, 0, 0] : [150 + bruit() + x, 110 + bruit() + y, 90 + bruit(), 255]));
  assert.equal(ressemblePhoto(rond), true);
  // Logo : deux couleurs franches sur blanc
  const logo = pixels(48, (x, y) => (x < 16 ? [22, 112, 168, 255] : y < 20 ? [246, 169, 74, 255] : [255, 255, 255, 255]));
  assert.equal(ressemblePhoto(logo), false);
  // Pictogramme sur fond transparent
  const picto = pixels(48, (x, y) => (Math.hypot(x - 24, y - 24) < 12 ? [30 + x, 60 + y, 90, 255] : [0, 0, 0, 0]));
  assert.equal(ressemblePhoto(picto), false);
  // Page presque blanche
  assert.equal(ressemblePhoto(pixels(48, () => [250, 250, 250, 255])), false);
});
