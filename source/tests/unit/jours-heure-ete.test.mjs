// joursAvant compte des jours de calendrier même quand un jour n'a que 23 ou 25 heures (changement d'heure) : à l'heure
// de Paris, comme un lauréat installé en France. Le fuseau est posé pour ce fichier seulement (chaque fichier a son processus).
process.env.TZ = 'Europe/Paris';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joursAvant } from '../../src/logic.js';

test('joursAvant : le dimanche du passage à l’heure d’été (23 h), lundi est demain ; le samedi, lundi est dans deux jours', () => {
  assert.equal(new Date('2027-03-28T10:00:00Z').getTimezoneOffset(), -120, 'le fuseau de Paris est bien posé');
  assert.equal(joursAvant('2027-03-29T08:00:00Z', new Date('2027-03-28T10:00:00Z')), 1);
  assert.equal(joursAvant('2027-03-29T08:00:00Z', new Date('2027-03-27T11:00:00Z')), 2);
  assert.equal(joursAvant('2027-03-28T20:00:00Z', new Date('2027-03-28T00:30:00Z')), 0, 'le même dimanche, avant et après le saut');
});

test('joursAvant : le dimanche du retour à l’heure d’hiver (25 h), lundi est demain', () => {
  assert.equal(joursAvant('2027-11-01T08:00:00Z', new Date('2027-10-31T10:00:00Z')), 1);
  assert.equal(joursAvant('2027-11-01T08:00:00Z', new Date('2027-10-30T10:00:00Z')), 2);
});
