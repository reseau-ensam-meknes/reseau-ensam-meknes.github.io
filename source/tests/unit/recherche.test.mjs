// Lauréats qui cherchent un emploi : quelles offres leur sont faites, lesquelles ils peuvent postuler
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offrePour, peutPostulerA } from '../../src/logic.js';

const S = 2026;
const GM = 'Génie Mécanique';
const etu5 = { id: 'e5', role: 'etudiant', promo: 2027, filiere: GM };
const jeune = { id: 'j', role: 'laureat', promo: 2026, filiere: GM };
const ancien = { id: 'a', role: 'laureat', promo: 2019, filiere: GM };
const ancienCherche = { ...ancien, id: 'ac', en_recherche: true };
const offre = (x = {}) => ({ id: 'o', author_id: 'auteur', audience: 'etudiants', annees: [6], filieres: [], status: 'ouverte', ...x });

test('offres pour moi : « Jeunes diplômés » et entre lauréats aussi pour un lauréat qui cherche un emploi', () => {
  assert.equal(offrePour(offre(), jeune, S), true, 'diplômé de l’année : niveau 6');
  assert.equal(offrePour(offre(), ancien, S), false, 'ancien lauréat en poste : pas pour lui');
  assert.equal(offrePour(offre(), ancienCherche, S), true);
  assert.equal(offrePour(offre({ annees: [5] }), ancienCherche, S), false, 'une offre de PFE reste aux 5A');
  assert.equal(offrePour(offre({ annees: [5] }), etu5, S), true);
  assert.equal(offrePour(offre({ audience: 'laureats', annees: [] }), ancienCherche, S), true);
  assert.equal(offrePour(offre({ audience: 'laureats', annees: [] }), ancien, S), false);
  assert.equal(offrePour(offre({ audience: 'laureats', annees: [] }), etu5, S), false);
  assert.equal(offrePour(offre({ filieres: ['Génie Civil'] }), ancienCherche, S), false, 'la filière compte toujours');
  assert.equal(offrePour(offre({ annees: [6] }), { ...etu5, en_recherche: true }, S), false, 'un étudiant ne coche pas « en recherche »');
});

test('postuler : le lauréat qui cherche un emploi (ou diplômé de l’année) postule aux offres « Jeunes diplômés »', () => {
  assert.equal(peutPostulerA(offre(), ancienCherche, S), true);
  assert.equal(peutPostulerA(offre(), jeune, S), true);
  assert.equal(peutPostulerA(offre(), ancien, S), false);
  assert.equal(peutPostulerA(offre({ annees: [4, 5] }), ancienCherche, S), false);
  assert.equal(peutPostulerA(offre({ audience: 'laureats', annees: [] }), ancien, S), true, 'entre lauréats : comme avant');
  assert.equal(peutPostulerA(offre({ audience: 'laureats', annees: [] }), etu5, S), false);
  assert.equal(peutPostulerA(offre({ annees: [5] }), etu5, S), true);
  assert.equal(peutPostulerA(offre({ author_id: 'ac' }), ancienCherche, S), false, 'pas à sa propre offre');
  assert.equal(peutPostulerA(offre(), { id: 'adm', role: 'admin', promo: 2015 }, S), false);
});
