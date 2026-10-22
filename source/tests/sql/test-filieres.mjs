// Filières officielles : rapprochement par parcours (offres, parrainage), groupes de parcours
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nouvelleBase, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const GIEO = 'Génie Industriel : Excellence Opérationnelle', GIP = 'Génie Industriel et Productique', CISM = 'Génie Mécanique : Conception et Industrialisation des Systèmes Mécaniques';
const un = (sql, p) => db.query(sql, p).then(r => Object.values(r.rows[0])[0]);

before(async () => { db = await nouvelleBase(SCHEMA); });

test('offres : filières actuelles identiques, anciennes appellations par parcours', async () => {
  const ok = (liste, f) => un('select public.filiere_ok($1::text[], $2)', [liste, f]);
  assert.equal(await ok([], 'Classes préparatoires intégrées'), true, 'liste vide : toutes filières');
  assert.equal(await ok([GIEO], GIEO), true);
  assert.equal(await ok([GIEO], GIP), false, 'autre filière actuelle du même parcours');
  assert.equal(await ok([GIEO], 'Génie Industriel'), true, 'ancienne appellation du parcours');
  assert.equal(await ok(['Mécatronique'], 'Génie Électromécanique : Digitalisation Industrielle'), true, 'offre ancienne, étudiant actuel');
  assert.equal(await ok([GIEO], 'Génie Mécanique'), false, 'autre parcours');
  assert.equal(await ok([GIEO], null), false);
  assert.equal(await un('select public.proximite_filiere($1, $2)', [GIEO, GIEO]), 2);
  assert.equal(await un('select public.proximite_filiere($1, $2)', ['Génie Énergétique', CISM]), 1);
  assert.equal(await un('select public.proximite_filiere($1, $2)', ['Génie Civil', CISM]), 0);
});

test('parrainage : un 3A de la nouvelle maquette trouve un parrain de son parcours, la même filière d’abord', async () => {
  await creerCompte(db, { id: uid(31), full_name: 'Hamza Zouiten', role: 'laureat', filiere: 'Génie Mécanique', promo: 2015, parrain_dispo: true });
  await creerCompte(db, { id: uid(32), full_name: 'Ghita Berrada', role: 'laureat', filiere: 'Génie Civil', promo: 2016, parrain_dispo: true });
  await creerCompte(db, { id: uid(33), full_name: 'Amine Tazi', role: 'etudiant', filiere: CISM, promo: S + 3 });
  assert.equal(await un('select parrain_id from public.parrainages where filleul_id = $1', [uid(33)]), uid(31));
  await creerCompte(db, { id: uid(34), full_name: 'Sara Ouazzani', role: 'laureat', filiere: CISM, promo: 2020, parrain_dispo: true });
  await creerCompte(db, { id: uid(35), full_name: 'Leila Amrani', role: 'etudiant', filiere: CISM, promo: S + 3 });
  assert.equal(await un('select parrain_id from public.parrainages where filleul_id = $1', [uid(35)]), uid(34), 'même filière avant même parcours');
});

test('groupes : les anciens groupes de filière passent dans le groupe de leur parcours', async () => {
  const L = uid(31), E = uid(33);
  await db.query(`insert into public.groupe_messages (groupe, author_id, body) values ('filiere:genie mecanique', $1, 'Bonjour la mécanique')`, [L]);
  await db.query(`insert into public.groupe_membres (groupe, user_id) values ('filiere:genie industriel', $1), ('filiere:electro-industriel', $1), ('filiere:mecatronique', $2)`, [L, E]);
  const sql = fs.readFileSync(SCHEMA, 'utf8');
  const debut = sql.indexOf('-- Le groupe « filière » réunit désormais tout un parcours');
  await db.exec(sql.slice(debut, sql.indexOf('end $$;', debut) + 7));
  assert.equal(await un(`select groupe from public.groupe_messages where body = 'Bonjour la mécanique'`), 'filiere:mecanique');
  const g = (await db.query('select user_id, groupe from public.groupe_membres order by user_id, groupe')).rows.map(r => `${r.user_id.slice(-2)} ${r.groupe}`);
  assert.deepEqual(g, ['31 filiere:electro-industriel', '33 filiere:electro-industriel']);
});
