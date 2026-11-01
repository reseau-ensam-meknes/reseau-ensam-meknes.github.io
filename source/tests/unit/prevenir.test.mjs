// « Me prévenir » : quand proposer les notifications après une action qui attend une réponse
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prevenirVariante, PREVENIR_ECART, ouvertureNotif, OUVERTURE_ECART, bandeauPush, BANDEAU_PUSH_ECART } from '../../src/logic.js';

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

test('prevenirVariante : revient 3 jours après chaque refus, tant que rien n’est activé', () => {
  assert.equal(PREVENIR_ECART, 3 * J);
  assert.equal(v({ etat: 'off', memo: { n: 1, at: NOW - 2 * J } }), null);
  assert.equal(v({ etat: 'off', memo: { n: 1, at: NOW - 3 * J } }), 'push');
  assert.equal(v({ etat: 'off', memo: { n: 9, at: NOW - 3 * J } }), 'push');
  assert.equal(v({ etat: 'ios', memo: { n: 1, at: NOW - 2 * J } }), null);
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

// À l'ouverture : « Reçois l'essentiel sur ton téléphone »
const o = x => ouvertureNotif({ etat: 'off', role: 'etudiant', now: NOW, ...x });

test('ouvertureNotif : seulement un appareil qui peut recevoir sans être abonné, l’admin aussi (ses signalements)', () => {
  assert.equal(o({}), true);
  assert.equal(o({ role: 'laureat' }), true);
  assert.equal(o({ role: 'admin' }), true);
  for (const etat of ['on', 'ios', 'absent', 'refuse', 'demo', '…']) assert.equal(o({ etat }), false, etat);
});

test('ouvertureNotif : « Plus tard » la ramène 2 jours après, sans plafond, mémo partagé avec « Me prévenir »', () => {
  assert.equal(OUVERTURE_ECART, 2 * J);
  assert.equal(o({ memo: { n: 1, at: NOW - 1.9 * J } }), false);
  assert.equal(o({ memo: { n: 1, at: NOW - 2 * J } }), true);
  assert.equal(o({ memo: { n: 9, at: NOW - 2 * J } }), true);
  // Accepté (ici ou par « Me prévenir »), ou coupé dans Mon profil : plus jamais
  assert.equal(o({ memo: { fait: 1 } }), false);
  // Une feuille « Me prévenir » remise à cette visite passe avant
  assert.equal(o({ memo: { differe: 'demande' } }), false);
  // La variante email de « Me prévenir » ne compte pas comme une demande d'autorisation
  assert.equal(o({ memo: { mail: 1 } }), true);
});

test('catégorie décochée dans Mon profil : « Me prévenir » ne promet pas de notification, l’email reste possible', () => {
  assert.equal(v({ etat: 'off', voulu: false }), null);
  assert.equal(v({ etat: 'ios', voulu: false }), null);
  assert.equal(v({ etat: 'off', voulu: true }), 'push');
  assert.equal(v({ etat: 'absent', raison: 'demande', voulu: false }), 'email');
});

test('ouvertureNotif : toutes les catégories décochées, rien à proposer', () => {
  assert.equal(o({ voulu: false }), false);
  assert.equal(o({ voulu: true }), true);
});

test('bandeauPush : dit ce qui bloque, se range 3 jours, respecte qui a coupé', () => {
  const b = x => bandeauPush({ role: 'etudiant', now: NOW, ...x });
  assert.equal(BANDEAU_PUSH_ECART, 3 * J);
  for (const e of ['off', 'ios', 'refuse']) assert.equal(b({ etat: e }), e);
  for (const e of ['on', 'absent', 'demo', '…']) assert.equal(b({ etat: e }), null);
  assert.equal(b({ etat: 'off', role: 'admin' }), null);
  assert.equal(b({ etat: 'off', voulu: false }), null);
  assert.equal(b({ etat: 'off', memo: { coupe: 1 } }), null);
  assert.equal(b({ etat: 'off', memo: { bandeau: NOW - 2 * J } }), null);
  assert.equal(b({ etat: 'off', memo: { bandeau: NOW - 3 * J } }), 'off');
});
