// « Fais venir ta promo » : le lien de la promo et le message qu'un membre envoie à ses camarades
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lienPromo, messageCamarade, inscritsDeLaPromo, promoValide } from '../../src/logic.js';

test('lienPromo : la page d’aperçu de la promo, sinon le lien simple ?promo=', () => {
  assert.equal(lienPromo(2019, 'fr', true, 'https://r.io/#espace'), 'https://r.io/promo/2019/');
  assert.equal(lienPromo(2019, 'ar', true, 'https://r.io/index.html?x#y'), 'https://r.io/promo/2019/ar/');
  assert.equal(lienPromo(1995, 'ar', false, 'https://r.io/'), 'https://r.io/?promo=1995&lang=ar');
  assert.equal(lienPromo(2027, 'fr', false, 'https://r.io/index.html#admin/inviter'), 'https://r.io/?promo=2027');
});

test('messageCamarade : lauréat, « On est déjà N » seulement à partir de 3, le lien en dernier', () => {
  const me = { promo: 2019, role: 'laureat' };
  const m = messageCamarade(me, 'fr', 'https://r.io/promo/2019/', 7, 2026);
  assert.ok(m.startsWith('Salut la promo 2019 👋'));
  assert.ok(m.includes('On est déjà 7 de la promo 2019.'));
  assert.ok(m.endsWith('\nhttps://r.io/promo/2019/'));
  assert.doesNotMatch(messageCamarade(me, 'fr', 'L', 2, 2026), /On est déjà/);
  const ar = messageCamarade(me, 'ar', 'https://r.io/promo/2019/ar/', 7, 2026);
  assert.ok(ar.startsWith('مرحبا دفعة 2019'));
  assert.ok(ar.includes('نحن بالفعل 7'));
  assert.match(ar, /خريجين/); assert.doesNotMatch(ar, /القدامى/);
  assert.doesNotMatch(messageCamarade(me, 'ar', 'L', 2, 2026), /نحن بالفعل/);
});

test('messageCamarade : un étudiant de 3A à 5A parle de sa demande, en 1A-2A de ses questions', () => {
  assert.match(messageCamarade({ promo: 2029, role: 'etudiant' }, 'fr', 'L', 0, 2026), /le stage ou le PFE/);
  assert.match(messageCamarade({ promo: 2027, role: 'etudiant' }, 'fr', 'L', 0, 2026), /Inscris-toi/);
  assert.match(messageCamarade({ promo: 2031, role: 'etudiant' }, 'fr', 'L', 0, 2026), /nos questions aux lauréats/);
  assert.match(messageCamarade({ promo: 2031, role: 'etudiant' }, 'ar', 'L', 0, 2026), /أسئلتنا على الخريجين/);
});

test('messageCamarade : jamais de points, de niveau ni de classement, et rien sur l’école qui soutiendrait le réseau', () => {
  for (const [promo, role] of [[2019, 'laureat'], [2029, 'etudiant'], [2031, 'etudiant']]) for (const l of ['fr', 'ar']) {
    const m = messageCamarade({ promo, role }, l, 'L', 9, 2026);
    assert.doesNotMatch(m, /points|niveau|classement|soutenu|vérifié|officiel|نقاط|ترتيب|رسمي/);
  }
});

test('inscritsDeLaPromo : étudiants et lauréats de la promo, moi compris', () => {
  const profiles = [{ promo: 2019, role: 'laureat' }, { promo: 2019, role: 'etudiant' }, { promo: '2019', role: 'laureat' }, { promo: 2020, role: 'laureat' }, { promo: null, role: 'admin' }];
  assert.equal(inscritsDeLaPromo(profiles, 2019), 3);
  assert.equal(inscritsDeLaPromo(profiles, 1990), 0);
});

test('promoValide : de 1990 à 2040, des années entières', () => {
  assert.ok(promoValide(1990) && promoValide(2040) && promoValide(2019));
  assert.ok(!promoValide(1989) && !promoValide(2041) && !promoValide(2019.5) && !promoValide(NaN));
});
