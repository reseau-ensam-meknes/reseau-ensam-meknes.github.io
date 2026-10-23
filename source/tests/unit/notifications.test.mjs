// Notifications : catégories, choix par défaut selon le rôle, proposition à l'ouverture de l'application installée
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NOTIF_CATEGORIES, CATEGORIE_NOTIF, notifActive, proposerActivation, ACTIVATION_ECART } from '../../src/logic.js';

test('par défaut : tout est activé, sauf les nouvelles offres pour un lauréat qui ne cherche pas', () => {
  for (const cat of NOTIF_CATEGORIES) assert.equal(notifActive({ role: 'etudiant' }, cat), true, cat);
  assert.equal(notifActive({ role: 'laureat' }, 'offres'), false);
  assert.equal(notifActive({ role: 'laureat', en_recherche: true }, 'offres'), true);
  assert.equal(notifActive({ role: 'laureat' }, 'candidatures'), true);
});

test('le choix du membre passe avant le défaut', () => {
  assert.equal(notifActive({ role: 'etudiant', notif_prefs: { push: { offres: false } } }, 'offres'), false);
  assert.equal(notifActive({ role: 'laureat', notif_prefs: { push: { offres: true } } }, 'offres'), true);
});

test('chaque type envoyé par la base a une catégorie, la même côté base et côté site', () => {
  const sql = fs.readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8');
  const kinds = new Set([...sql.matchAll(/pousser\([^,]+,\s*'([a-z_]+)'/g)].map(m => m[1]));
  kinds.add('offre_alerte');
  for (const k of kinds) assert.ok(CATEGORIE_NOTIF[k], `type sans catégorie : ${k}`);
  const fonction = sql.slice(sql.indexOf('function public.categorie_notif'), sql.indexOf('function public.push_autorise'));
  // Une clause « when … then 'catégorie' » peut tenir sur plusieurs lignes
  const clauses = fonction.split(/\bwhen\b/).slice(1);
  for (const [k, cat] of Object.entries(CATEGORIE_NOTIF)) {
    const c = clauses.find(x => x.includes(`'${k}'`));
    assert.ok(c && new RegExp(`then '${cat}'`).test(c), `${k} → ${cat} dans categorie_notif`);
  }
});

test('application installée : proposée une fois, puis tous les 7 jours au plus, trois fois en tout', () => {
  const now = Date.now();
  assert.equal(proposerActivation({ etat: 'off', installee: true, now }), true);
  assert.equal(proposerActivation({ etat: 'off', installee: false, now }), false, 'dans le navigateur : non');
  assert.equal(proposerActivation({ etat: 'on', installee: true, now }), false);
  assert.equal(proposerActivation({ etat: 'refuse', installee: true, now }), false, 'refus du navigateur : jamais');
  assert.equal(proposerActivation({ etat: 'off', installee: true, now, memo: { app: { n: 1, at: now - 1000 } } }), false);
  assert.equal(proposerActivation({ etat: 'off', installee: true, now, memo: { app: { n: 1, at: now - ACTIVATION_ECART - 1 } } }), true);
  assert.equal(proposerActivation({ etat: 'off', installee: true, now, memo: { app: { n: 3, at: 0 } } }), false);
  assert.equal(proposerActivation({ etat: 'off', installee: true, now, memo: { fait: 1 } }), false);
});
