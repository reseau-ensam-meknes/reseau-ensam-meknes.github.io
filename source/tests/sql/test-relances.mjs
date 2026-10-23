// Rappel d'inscription : un seul email aux comptes créés depuis plus de 24 h sans profil
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, creerCompte, en, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const VIEUX = uid(61), ARABE = uid(62), RECENT = uid(63), COMPLET = uid(64), ANCIEN = uid(65);
const service = (sql, p) => en(db, null, tx => tx.query(sql, p), { role: 'service_role' }).then(r => r.rows);
const compte = (id, email, heures, langue) => db.query(`insert into auth.users (id, email, created_at, raw_user_meta_data) values ($1, $2, now() - make_interval(hours => $3), $4)`,
  [id, email, heures, langue ? { langue } : {}]);

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await compte(VIEUX, 'vieux@exemple.ma', 30);
  await compte(ARABE, 'arabe@exemple.ma', 50, 'ar');
  await compte(RECENT, 'recent@exemple.ma', 5);
  await compte(ANCIEN, 'ancien@exemple.ma', 24 * 40);
  await creerCompte(db, { id: COMPLET, full_name: 'Profil Complet', role: 'laureat', filiere: 'Génie Mécanique', promo: 2020 });
  await db.query(`update auth.users set created_at = now() - interval '3 days' where id = $1`, [COMPLET]);
});

test('seuls les comptes sans profil créés depuis plus de 24 h (et moins de 30 jours) sont relancés, dans leur langue', async () => {
  const r = await service('select * from public.comptes_a_relancer(100)');
  assert.deepEqual(r.map(x => [x.email, x.langue]), [['arabe@exemple.ma', 'ar'], ['vieux@exemple.ma', 'fr']]);
});

test('une fois relancé, plus jamais ; personne d’autre ne lit ni n’appelle', async () => {
  await service('select public.relances_envoyees($1)', [[ARABE, VIEUX, uid(99)]]);
  assert.equal((await service('select * from public.comptes_a_relancer(100)')).length, 0);
  assert.equal((await service('select count(*)::int n from public.relances_inscription'))[0].n, 2, 'un identifiant inconnu est ignoré');
  await service('select public.relances_envoyees($1)', [[VIEUX]]);
  await assert.rejects(en(db, VIEUX, tx => tx.query('select * from public.comptes_a_relancer(10)')), /permission denied/);
  await assert.rejects(en(db, VIEUX, tx => tx.query('select public.relances_envoyees($1)', [[RECENT]])), /permission denied/);
  await assert.rejects(en(db, VIEUX, tx => tx.query('select * from public.relances_inscription')), /permission denied/);
});

test('la tâche quotidienne appelle aussi les rappels', async () => {
  const [{ def }] = (await db.query(`select pg_get_functiondef('public.taches_quotidiennes'::regproc) def`)).rows;
  assert.match(def, /appeler_notifier\('relances'\)/);
});

test('code demandé mais jamais entré : pas de rappel ; code entré, ou ancien compte à mot de passe : rappel', async () => {
  // Comme Supabase : tout compte a un mot de passe (tiré au hasard pour ceux créés par code)
  const n = async (id, email, connexion, meta = '{"par_code": true}') => db.query(`insert into auth.users (id, email, created_at, last_sign_in_at, encrypted_password, raw_user_meta_data) values ($1, $2, now() - interval '30 hours', now() - interval '30 hours' + $3::interval, '$2a$10$hasard', $4::jsonb)`, [id, email, connexion, meta]);
  await n(uid(71), 'code.pas.entre@exemple.ma', '300 milliseconds');
  await n(uid(72), 'code.entre@exemple.ma', '2 minutes');
  await n(uid(73), 'ancien.mdp@exemple.ma', '200 milliseconds', '{}');
  const r = await service('select email from public.comptes_a_relancer(100)');
  assert.deepEqual(r.map(x => x.email).sort(), ['ancien.mdp@exemple.ma', 'code.entre@exemple.ma']);
});
