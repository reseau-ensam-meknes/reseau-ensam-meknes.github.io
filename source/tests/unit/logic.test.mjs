// Règles de calcul partagées par le site (saisons, niveaux, enquête, insertion, entreprises)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonOf, niveauOf, enqueteDue, cleNom, sameCompany, statsInsertion, rapportInsertion } from '../../src/logic.js';

test('saison : elle commence en septembre', () => {
  assert.equal(seasonOf(new Date(2026, 8, 1)), 2026);
  assert.equal(seasonOf(new Date(2026, 7, 31)), 2025);
});

test('niveau : calculé depuis la promo, il avance chaque septembre', () => {
  assert.equal(niveauOf({ promo: 2027 }, 2026), 5);
  assert.equal(niveauOf({ promo: 2029 }, 2026), 3);
  assert.equal(niveauOf({ promo: 2026 }, 2026), 6);
  assert.equal(niveauOf({ promo: 2015 }, 2026), 7);
  assert.equal(niveauOf({ promo: 2027 }, 2027), 6);
});

test('enquête d’insertion : 6 mois puis 12 mois après le diplôme, une seule fois chacune', () => {
  const hajar = { id: 'h', role: 'laureat', promo: 2025 };
  assert.equal(enqueteDue(hajar, [], new Date(2025, 11, 15)), null);
  assert.equal(enqueteDue(hajar, [], new Date(2026, 2, 1)).vague, 6);
  assert.equal(enqueteDue(hajar, [], new Date(2026, 9, 20)).vague, 12);
  assert.equal(enqueteDue(hajar, [{ user_id: 'h', vague: 12 }], new Date(2026, 9, 20)), null);
  assert.equal(enqueteDue(hajar, [], new Date(2027, 4, 1)), null);
  assert.equal(enqueteDue({ id: 's', role: 'etudiant', promo: 2027 }, [], new Date(2026, 9, 20)), null);
  assert.equal(enqueteDue({ id: 'a', role: 'admin', promo: 2025 }, [], new Date(2026, 2, 1)), null);
});

test('noms : « EL AMRANI Salma » est la même personne que « Salma El-Amrani »', () => {
  assert.equal(cleNom('EL AMRANI Salma'), cleNom('Salma El-Amrani'));
  assert.notEqual(cleNom('Salma Bennani'), cleNom('Salma El Amrani'));
});

test('entreprises : même nom écrit autrement', () => {
  assert.ok(sameCompany('Renault Group Maroc', 'Renault'));
  assert.ok(sameCompany('OCP Group', 'ocp'));
  assert.ok(!sameCompany('OCP', 'Renault'));
  assert.ok(!sameCompany('', 'Renault'));
});

const reponse = (promo, filiere, situation, extra = {}) => ({ promo, vague: 6, filiere, situation, ...extra });

test('chiffres d’insertion : rien de détaillé sous 5 réponses', () => {
  const peu = statsInsertion([reponse(2025, 'GI', 'emploi', { salaire: '10_15' }), reponse(2025, 'GI', 'recherche')]);
  assert.equal(peu.length, 1);
  assert.equal(peu[0].n, 2);
  assert.equal(peu[0].salaires, null);
  assert.equal(peu[0].filieres, null);
  const assez = statsInsertion(['emploi', 'emploi', 'entrepreneur', 'recherche', 'etudes'].map(s => reponse(2025, 'GI', s, { salaire: '10_15', pays: s === 'emploi' ? 'France' : 'Maroc' })));
  assert.equal(assez[0].en_poste, 3);
  assert.equal(assez[0].etranger, 2);
  assert.deepEqual(assez[0].filieres, { GI: { n: 5, en_poste: 3 } });
  assert.deepEqual(assez[0].salaires, { '10_15': 5 });
});

test('taux d’insertion : ceux qui poursuivent leurs études ne comptent pas', () => {
  const profiles = [1, 2, 3, 4].map(i => ({ id: 'p' + i, role: 'laureat', promo: 2025, filiere: 'GI' }));
  const enquetes_insertion = [reponse(2025, 'GI', 'emploi'), reponse(2025, 'GI', 'recherche'), reponse(2025, 'GI', 'etudes')];
  const [r] = rapportInsertion({ profiles, enquetes_insertion, liste_officielle: [] }, new Date(2026, 9, 20));
  assert.equal(r.repondants, 3);
  assert.equal(r.taux_insertion, 0.5);
  assert.equal(r.taux_reponse, 0.75);
});
