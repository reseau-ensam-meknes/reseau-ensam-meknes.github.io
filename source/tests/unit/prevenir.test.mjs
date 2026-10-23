// « Me prévenir » : quand proposer les notifications après une action qui attend une réponse
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prevenirVariante, PREVENIR_ECART } from '../../src/logic.js';

const NOW = Date.UTC(2026, 9, 23, 10);
const J = 864e5;
const v = x => prevenirVariante({ raison: 'mentorat', role: 'etudiant', now: NOW, emailsMessages: true, emailsHebdo: true, ...x });

test('prevenirVariante : jamais pour l’admin, ni quand c’est déjà fait ou activé, ni avant de connaître l’état', () => {
  assert.equal(v({ etat: 'off', role: 'admin' }), null);
  assert.equal(v({ etat: 'on' }), null);
  assert.equal(v({ etat: 'off', memo: { fait: 1 } }), null);
  assert.equal(v({ etat: '…' }), null);
  assert.equal(v({ etat: 'demo' }), null);
  assert.equal(v({ etat: 'off' }), 'push');
  assert.equal(v({ etat: 'ios' }), 'ios');
});

test('prevenirVariante : deux refus au plus, à 14 jours d’écart', () => {
  assert.equal(PREVENIR_ECART, 14 * J);
  assert.equal(v({ etat: 'off', memo: { n: 1, at: NOW - 3 * J } }), null);
  assert.equal(v({ etat: 'off', memo: { n: 1, at: NOW - 15 * J } }), 'push');
  assert.equal(v({ etat: 'off', memo: { n: 2, at: NOW - 60 * J } }), null);
  assert.equal(v({ etat: 'ios', memo: { n: 1, at: NOW - 3 * J } }), null);
});

test('prevenirVariante : sans notifications possibles, l’email une seule fois, et seulement s’il part vraiment', () => {
  assert.equal(v({ etat: 'absent', raison: 'demande' }), 'email');
  assert.equal(v({ etat: 'refuse', raison: 'demande' }), 'email');
  assert.equal(v({ etat: 'absent', raison: 'demande', emailsMessages: false }), null);
  assert.equal(v({ etat: 'absent', raison: 'question' }), 'email');
  assert.equal(v({ etat: 'absent', raison: 'question', emailsHebdo: false }), null);
  assert.equal(v({ etat: 'absent', raison: 'candidature' }), null);
  assert.equal(v({ etat: 'absent', raison: 'demande', memo: { mail: 1 } }), null);
});
