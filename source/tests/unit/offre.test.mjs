// « Offre en 30 secondes » : le titre vient du poste, jamais d'une ligne d'exigences (« Formation : Bac+5… »)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOffre } from '../../src/parse-offre.js';

const titre = t => parseOffre(t).fields.titre;

test('offre collée : « Formation », « Expérience », « Langues » ne deviennent pas le titre', () => {
  assert.equal(titre('Nous recrutons un(e) stagiaire PFE\nFormation : Bac+5 en Qualité / Génie Industriel\nMissions : mise en place des outils qualité\nLieu : Kénitra'), 'Stagiaire PFE');
  assert.equal(titre('Offre de stage – Ingénieur Qualité\nFormation : Bac+5 en Qualité / Génie Industriel\nDurée : 6 mois'), 'Offre de stage – Ingénieur Qualité');
  assert.equal(titre('Expérience : 2 ans minimum en maintenance\nPoste : Responsable maintenance\nLangues : français, anglais'), 'Responsable maintenance');
  // Seulement des exigences : pas de titre inventé, le lauréat l'écrit
  assert.ok(!/^Formation/.test(titre('Formation : Bac+5 en Qualité / Génie Industriel (ENSAM de préférence)\nDurée : 6 mois') || ''));
});
