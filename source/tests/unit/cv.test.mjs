// CV en PDF : le texte extrait remplit le profil (rôle, promo, filière, poste, coordonnées)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyserCV } from '../../src/lire-cv.js';
import { roleIncoherent } from '../../src/logic.js';

const OCT_2026 = new Date(2026, 9, 21);

const LAUREAT = `YOUSSEF BENALI
Ingénieur méthodes
youssef.benali@gmail.com | +212 6 61 23 45 67 | Meknès, Maroc
PROFIL
Ingénieur en génie industriel, 2 ans d'expérience en amélioration continue.
EXPÉRIENCES PROFESSIONNELLES
Lear Corporation
Ingénieur méthodes
Sept. 2024 - Aujourd'hui
FORMATION
ENSAM Meknès
Génie Industriel
2019 - 2024
COMPÉTENCES
Lean • CATIA • Python`;

const ETUDIANT = `Salma Idrissi
Élève ingénieure à l'ENSAM Meknès
salma.idrissi@edu.umi.ac.ma
06 12 34 56 78
FORMATION ACADÉMIQUE
ENSAM Meknès
Génie Mécanique - 4ème année
Depuis 2022
STAGES
Stage ouvrier - OCP
Juillet 2025 - Août 2025`;

test('CV de lauréat : rôle, promo, filière, poste et coordonnées', () => {
  const r = analyserCV(LAUREAT, OCT_2026);
  assert.equal(r.role, 'laureat');
  assert.equal(r.promo, 2024);
  assert.equal(r.filiere, 'Génie Industriel');
  assert.equal(r.entreprise, 'Lear Corporation');
  assert.equal(r.poste, 'Ingénieur méthodes');
  assert.equal(r.email, 'youssef.benali@gmail.com');
  assert.equal(r.telephone, '+212661234567');
  assert.deepEqual(r.competences, ['Lean', 'CATIA', 'Python']);
});

test('CV d’étudiant encore à l’école : la promo vient du niveau', () => {
  const r = analyserCV(ETUDIANT, OCT_2026);
  assert.equal(r.role, 'etudiant');
  assert.equal(r.promo, 2028);  // 4ème année en 2026-2027 : diplôme en 2028
  assert.equal(r.filiere, 'Génie Mécanique');
  assert.equal(r.telephone, '0612345678');
  assert.equal(r.entreprise, undefined);
});

test('rôle et promo : incohérences repérées', () => {
  assert.equal(roleIncoherent({ role: 'etudiant', promo: 2025 }, 2026), 'etudiant');
  assert.equal(roleIncoherent({ role: 'laureat', promo: 2027 }, 2026), 'laureat');
  assert.equal(roleIncoherent({ role: 'laureat', promo: 2026 }, 2026), null);
  assert.equal(roleIncoherent({ role: 'etudiant', promo: 2027 }, 2026), null);
});
