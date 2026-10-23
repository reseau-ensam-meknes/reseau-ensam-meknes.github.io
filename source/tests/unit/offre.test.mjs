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

test('titre affiché : le type, déjà sur l’étiquette, n’est pas répété (« PFE : … »)', async () => {
  const { titreOffre } = await import('../../src/logic.js');
  assert.equal(titreOffre({ type: 'pfe', titre: 'PFE : déployer le Lean sur une ligne de câblage' }), 'Déployer le Lean sur une ligne de câblage');
  assert.equal(titreOffre({ type: 'pfe', titre: 'Projet de fin d’études – Jumeau numérique' }), 'Jumeau numérique');
  assert.equal(titreOffre({ type: 'stage', titre: 'Stage : maintenance prédictive' }), 'Maintenance prédictive');
  assert.equal(titreOffre({ type: 'etranger', titre: 'Stage à l’étranger : bureau d’études à Lyon' }), 'Bureau d’études à Lyon');
  // Un autre type, un mot qui fait partie du titre, ou un titre réduit au préfixe : inchangés
  assert.equal(titreOffre({ type: 'stage', titre: 'PFE : déployer le Lean' }), 'PFE : déployer le Lean');
  assert.equal(titreOffre({ type: 'stage', titre: 'Stage ouvrier chez OCP' }), 'Stage ouvrier chez OCP');
  assert.equal(titreOffre({ type: 'pfe', titre: 'PFE :' }), 'PFE :');
});
