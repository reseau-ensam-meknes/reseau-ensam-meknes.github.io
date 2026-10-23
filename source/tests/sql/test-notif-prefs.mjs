// Notifications par catégorie : la file d'envoi écarte ce que le membre a coupé, et suit les choix par défaut du rôle
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, creerCompte, en, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const ETU = uid(71), LAU = uid(72), CHERCHE = uid(73);
const file = async (u, kind) => {
  await db.query('insert into public.push_queue (user_id, kind) values ($1, $2)', [u, kind]);
  return (await db.query('select count(*)::int n from public.push_queue where user_id = $1 and kind = $2', [u, kind])).rows[0].n;
};

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ETU, full_name: 'Salma Idrissi', role: 'etudiant', filiere: 'Génie Civil', promo: 2028 });
  await creerCompte(db, { id: LAU, full_name: 'Youssef Alami', role: 'laureat', filiere: 'Génie Civil', promo: 2016 });
  await creerCompte(db, { id: CHERCHE, full_name: 'Nadia Berrada', role: 'laureat', filiere: 'Génie Civil', promo: 2025 });
  await db.query('update public.profiles set en_recherche = true where id = $1', [CHERCHE]);
});

test('par défaut : un étudiant reçoit les offres, un lauréat non, sauf s’il cherche un emploi', async () => {
  assert.equal(await file(ETU, 'offre_alerte'), 1);
  assert.equal(await file(LAU, 'offre_alerte'), 0);
  assert.equal(await file(CHERCHE, 'offre_alerte'), 1);
  assert.equal(await file(LAU, 'candidature'), 1);
});

test('une catégorie coupée par le membre n’entre plus dans la file ; les autres oui', async () => {
  await en(db, ETU, tx => tx.query(`update public.profiles set notif_prefs = '{"push": {"messages": false}}' where id = $1`, [ETU]));
  assert.equal(await file(ETU, 'message'), 0);
  assert.equal(await file(ETU, 'mentorat_accepte'), 1);
  // Lauréat qui veut quand même les offres
  await en(db, LAU, tx => tx.query(`update public.profiles set notif_prefs = '{"push": {"offres": true}}' where id = $1`, [LAU]));
  assert.equal(await file(LAU, 'offre_alerte'), 1);
});

test('le choix se lit dans la vue du membre, et seulement pour lui', async () => {
  const lui = await en(db, ETU, tx => tx.query('select notif_prefs from public.profils where id = $1', [ETU]));
  assert.deepEqual(lui.rows[0].notif_prefs, { push: { messages: false } });
  const autre = await en(db, LAU, tx => tx.query('select notif_prefs from public.profils where id = $1', [ETU]));
  assert.equal(autre.rows[0].notif_prefs, null);
});

test('un type sans catégorie part toujours ; un membre ne lit pas la fonction de filtre', async () => {
  assert.equal(await file(ETU, 'test'), 1);
  await assert.rejects(en(db, ETU, tx => tx.query('select public.push_autorise($1, $2)', [ETU, 'message'])), /permission denied/);
});
