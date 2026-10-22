// Inscription par CV : le texte d'un CV (lu dans le PDF) donne le rôle, la promo, la filière et le reste du profil
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLinkedin } from '../../src/parse-linkedin.js';
import { ecartsCV, complementsCV, propositionCV, corrigeProfil } from '../../src/lire-cv.js';

const OCT_2026 = new Date(2026, 9, 22);
const CISM = 'Génie Mécanique : Conception et Industrialisation des Systèmes Mécaniques';

const ETUDIANT = `HAJEB Abderrahman
Élève ingénieur en Génie Mécanique
+212 6 12 34 56 78 | hajeb.abderrahman@gmail.com | Meknès, Maroc
PROFIL
Élève ingénieur en 5e année, passionné par la conception mécanique.
FORMATION
2022 – 2024
Classes préparatoires intégrées – ENSAM Meknès
2024 – Présent
École Nationale Supérieure d'Arts et Métiers – Meknès
Cycle ingénieur : Conception et Industrialisation des Systèmes Mécaniques
EXPÉRIENCES PROFESSIONNELLES
Stage PFA – Renault Group, Tanger
Juillet 2025 – Août 2025
COMPÉTENCES
CATIA • SolidWorks • Ansys • Python
LANGUES
Arabe, Français, Anglais`;

const LAUREAT = `Yassine BERRADA
Ingénieur méthodes – OCP Group
yassine.berrada@outlook.fr · 06 61 22 33 44 · Casablanca, Maroc
EXPÉRIENCE PROFESSIONNELLE
OCP Group, Jorf Lasfar
Ingénieur méthodes
Septembre 2021 – Aujourd'hui
FORMATION
2016 – 2021 : Diplôme d'ingénieur d'État en Génie Industriel, ENSAM Meknès
COMPÉTENCES TECHNIQUES
Lean • SMED • Power BI`;

test('CV d’étudiant : formation en cours, promo tirée de l’entrée en cycle ingénieur', () => {
  const r = parseLinkedin(ETUDIANT, OCT_2026);
  assert.equal(r.full_name, 'Hajeb Abderrahman');
  assert.equal(r.role, 'etudiant');
  assert.equal(r.promo, 2027);
  assert.equal(r.filiere, CISM);
  assert.equal(r.email, 'hajeb.abderrahman@gmail.com');
  assert.equal(r.telephone, '+212 6 12 34 56 78');
  assert.equal(r.ville, 'Meknès');
  assert.equal(r.entreprise, undefined, 'le stage d’un étudiant ne devient pas son entreprise');
  assert.deepEqual(r.competences, ['CATIA', 'SolidWorks', 'Ansys', 'Python']);
});

test('CV de lauréat : diplôme obtenu, poste actuel', () => {
  const r = parseLinkedin(LAUREAT, OCT_2026);
  assert.equal(r.full_name, 'Yassine Berrada');
  assert.equal(r.role, 'laureat');
  assert.equal(r.promo, 2021);
  assert.equal(r.filiere, 'Génie Industriel');
  assert.equal(r.entreprise, 'OCP Group');
  assert.equal(r.poste, 'Ingénieur méthodes');
  assert.equal(r.telephone, '06 61 22 33 44');
});

test('écarts entre le CV et le profil : rôle, promo, filière d’un autre parcours', () => {
  const cv = parseLinkedin(LAUREAT, OCT_2026);
  assert.deepEqual(ecartsCV({ role: 'etudiant', promo: 2027, filiere: CISM }, cv), { role: 'laureat', promo: 2021, filiere: 'Génie Industriel' });
  assert.deepEqual(ecartsCV({ role: 'laureat', promo: 2021, filiere: 'Génie Industriel : Excellence Opérationnelle' }, cv), {}, 'même parcours : rien à corriger');
  const etu = parseLinkedin(ETUDIANT, OCT_2026);
  assert.deepEqual(ecartsCV({ role: 'laureat', promo: 2027, filiere: 'Génie Mécanique' }, etu), { role: 'etudiant' }, 'promo estimée, filière compatible');
  assert.deepEqual(ecartsCV({ role: 'admin', promo: 2010, filiere: 'Génie Civil' }, cv), {});
});

test('le CV remplit les champs vides du profil, sans rien écraser', () => {
  const cv = parseLinkedin(LAUREAT, OCT_2026);
  const etudiant = { role: 'etudiant', promo: 2027, filiere: CISM, poste: null, entreprise: '', ville: null, competences: [] };
  const e = propositionCV(etudiant, cv, OCT_2026);
  assert.equal(e.role, 'laureat');
  assert.equal(e.poste, 'Ingénieur méthodes', 'devenu lauréat : son poste vient du CV');
  assert.equal(e.entreprise, 'OCP Group');
  assert.deepEqual(e.competences, ['Lean', 'SMED', 'Power BI']);
  assert.ok(corrigeProfil(e));
  const deja = { role: 'laureat', promo: 2021, filiere: 'Génie Industriel', poste: 'Responsable méthodes', entreprise: 'OCP', ville: 'Safi', competences: ['Lean'] };
  const c = propositionCV(deja, cv, OCT_2026);
  assert.equal(c.poste, undefined, 'un champ rempli n’est pas remplacé');
  assert.ok(!corrigeProfil(c));
  assert.equal(complementsCV({ role: 'etudiant', poste: null, entreprise: null }, { poste: 'Stagiaire', entreprise: 'Renault' }).poste, undefined, 'pas de poste pour un étudiant');
  assert.deepEqual(propositionCV({ role: 'admin' }, cv), {});
});

test('CV d’étudiant : l’année d’études écrite donne la promo', () => {
  const quatre = `Sara EL IDRISSI
Élève ingénieure en 4ème année – ENSAM Meknès
sara.elidrissi@gmail.com | 06 70 11 22 33 | Meknès
FORMATION
ENSAM Meknès – Génie Industriel : Excellence Opérationnelle (en cours)
COMPÉTENCES
Lean, Python`;
  const r = parseLinkedin(quatre, OCT_2026);
  assert.equal(r.role, 'etudiant');
  assert.equal(r.promo, 2028, '4A en 2026-2027 : diplôme en 2028');
  assert.equal(r.filiere, 'Génie Industriel : Excellence Opérationnelle');
});
