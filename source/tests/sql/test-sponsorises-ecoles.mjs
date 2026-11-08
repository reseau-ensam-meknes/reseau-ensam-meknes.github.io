// Cartes sponsorisées et écoles : un membre lit les cartes en cours de son école et celles de toutes les écoles (sans
// école), jamais celles d'une autre école ; l'administration d'une école lit et écrit les cartes de son école (sa
// console), lit celles de toutes les écoles sans les toucher ; l'administration du réseau (ENSAM Meknès) lit et écrit tout.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const EM = uid(9201), EC = uid(9202), LC = uid(9203), AM = uid(9204), AC = uid(9205);
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const jour = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const K = {};
const carte = (u, titre, ecole, actif = true) => q(u, `insert into public.sponsorises (entreprise, titre, texte, lien, debut, fin, actif, ecole)
  values ('Exemplia', $1, 'Cours du soir en petits groupes, tous niveaux.', 'https://example.com', $2, $3, $4, $5) returning id, ecole`,
  [titre, jour(-1), jour(30), actif, ecole]).then(r => r[0]);
const titres = async u => (await q(u, 'select titre from public.sponsorises order by titre')).map(r => r.titre);

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: EM, full_name: 'Salma Meknès', role: 'etudiant', filiere: 'Génie Industriel', promo: 2027 });
  await creerCompte(db, { id: AM, full_name: 'Admin Réseau', role: 'etudiant', filiere: 'Génie Industriel', promo: 2010 });
  // L'ENSAM Casablanca, ouverte le temps des inscriptions (son réseau reste fermé)
  await db.query(`update public.ecoles set ouverte = true where slug = 'ensam-casa'`);
  await creerCompte(db, { id: EC, full_name: 'Amine Casa', role: 'etudiant', filiere: 'Génie Industriel', promo: 2027, ecole: 'ensam-casa' });
  await creerCompte(db, { id: LC, full_name: 'Nadia Casa', role: 'laureat', filiere: 'Génie Industriel', promo: 2015, ecole: 'ensam-casa' });
  await creerCompte(db, { id: AC, full_name: 'Admin Casa', role: 'etudiant', filiere: 'Génie Industriel', promo: 2010, ecole: 'ensam-casa' });
  await db.query(`update public.ecoles set ouverte = false where slug = 'ensam-casa'`);
  await db.query(`update public.profiles set role = 'admin' where id = any($1)`, [[AM, AC]]);
  K.meknes = await carte(AM, 'Carte Meknès', 'ensam-meknes');
  K.meknesArretee = await carte(AM, 'Carte Meknès arrêtée', 'ensam-meknes', false);
  K.casa = await carte(AM, 'Carte Casa', 'ensam-casa');
  K.casaArretee = await carte(AM, 'Carte Casa arrêtée', 'ensam-casa', false);
  K.toutes = await carte(AM, 'Carte toutes écoles', null);
});

test('un membre lit les cartes en cours de son école et celles de toutes les écoles, jamais d’une autre école', async () => {
  assert.deepEqual(await titres(EM), ['Carte Meknès', 'Carte toutes écoles']);
  assert.deepEqual(await titres(EC), ['Carte Casa', 'Carte toutes écoles']);
  assert.deepEqual(await titres(LC), ['Carte Casa', 'Carte toutes écoles']);
  // Même par son identifiant
  assert.deepEqual(await q(EM, 'select id from public.sponsorises where id = $1', [K.casa.id]), []);
  assert.deepEqual(await q(EC, 'select id from public.sponsorises where id = $1', [K.meknes.id]), []);
});

test('Match : chacun compte la carte de son école, pas celle d’une autre', async () => {
  const compter = (u, id) => q(u, `select public.compter_sponsorise($1, 'vue') ok`, [id]).then(r => r[0].ok);
  assert.equal(await compter(EM, K.meknes.id), true);
  assert.equal(await compter(EM, K.casa.id), false);
  assert.equal(await compter(EC, K.casa.id), true);
  assert.equal(await compter(EC, K.meknes.id), false);
  assert.equal(await compter(EC, K.toutes.id), true);
  // Les cartes qu'un membre lit et qui le visent : celles de Match
  const visees = async u => (await q(u, `select s.titre from public.sponsorises s, public.profiles p
    where p.id = auth.uid() and public.sponsorise_pour(s, p) order by 1`)).map(r => r.titre);
  assert.deepEqual(await visees(EM), ['Carte Meknès', 'Carte toutes écoles']);
  assert.deepEqual(await visees(EC), ['Carte Casa', 'Carte toutes écoles']);
});

test('l’administration du réseau lit tout ; celle d’une école, les cartes de son école et de toutes les écoles', async () => {
  assert.deepEqual(await titres(AM), ['Carte Casa', 'Carte Casa arrêtée', 'Carte Meknès', 'Carte Meknès arrêtée', 'Carte toutes écoles']);
  assert.deepEqual(await titres(AC), ['Carte Casa', 'Carte Casa arrêtée', 'Carte toutes écoles']);
  // Les totaux : les mêmes cartes
  const bilan = async u => (await q(u, 'select sponsorise_id from public.bilan_sponsorises()')).map(r => r.sponsorise_id).sort();
  assert.deepEqual(await bilan(AM), Object.values(K).map(k => k.id).sort());
  assert.deepEqual(await bilan(AC), [K.casa.id, K.casaArretee.id, K.toutes.id].sort());
});

test('l’administration d’une école n’écrit que les cartes de son école', async () => {
  // Une carte écrite sans école par l'administration de Casablanca : de Casablanca (toutes les écoles : celle du réseau)
  const sans = await carte(AC, 'Nouvelle carte Casa', null);
  assert.equal(sans.ecole, 'ensam-casa');
  await assert.rejects(carte(AC, 'Carte pour Meknès', 'ensam-meknes'), /row-level security/);
  // Les cartes de Meknès et celles de toutes les écoles : ni modifiées, ni arrêtées, ni supprimées, ni prises
  for (const k of [K.meknes, K.toutes]) {
    const r = await q(AC, `update public.sponsorises set titre = 'Prise' where id = $1 returning id`, [k.id]).catch(e => e);
    assert.ok(r instanceof Error ? /row-level security/.test(r.message) : r.length === 0, k.ecole);
    const r2 = await q(AC, `update public.sponsorises set ecole = 'ensam-casa' where id = $1 returning id`, [k.id]).catch(e => e);
    assert.ok(r2 instanceof Error ? /row-level security/.test(r2.message) : r2.length === 0, k.ecole);
    assert.deepEqual(await q(AC, 'delete from public.sponsorises where id = $1 returning id', [k.id]), []);
  }
  assert.deepEqual((await db.query(`select titre, ecole from public.sponsorises where id = any($1) order by titre`, [[K.meknes.id, K.toutes.id]])).rows,
    [{ titre: 'Carte Meknès', ecole: 'ensam-meknes' }, { titre: 'Carte toutes écoles', ecole: null }]);
  // La sienne : modifiée, arrêtée ; pas envoyée dans une autre école
  assert.equal((await q(AC, `update public.sponsorises set titre = 'Carte Casa (modifiée)', actif = false where id = $1 returning id`, [sans.id])).length, 1);
  await assert.rejects(q(AC, `update public.sponsorises set ecole = 'ensam-meknes' where id = $1`, [sans.id]), /row-level security/);
  assert.equal((await q(AC, `update public.sponsorises set ecole = null where id = $1 returning ecole`, [sans.id]))[0].ecole, 'ensam-casa');
  assert.equal((await q(AC, 'delete from public.sponsorises where id = $1 returning id', [sans.id])).length, 1);
});

test('l’administration du réseau écrit pour toutes les écoles', async () => {
  const t = await carte(AM, 'Réseau pour toutes', null);
  assert.equal(t.ecole, null);
  const c = await carte(AM, 'Réseau pour Casa', 'ensam-casa');
  assert.equal(c.ecole, 'ensam-casa');
  assert.equal((await q(AM, `update public.sponsorises set ecole = 'ensam-meknes' where id = $1 returning ecole`, [c.id]))[0].ecole, 'ensam-meknes');
  assert.equal((await q(AM, 'delete from public.sponsorises where id = any($1) returning id', [[t.id, c.id]])).length, 2);
});
