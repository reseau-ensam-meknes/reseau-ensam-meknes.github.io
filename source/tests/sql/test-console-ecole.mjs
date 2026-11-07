// Console d'administration, plusieurs écoles : ce que l'administration publie pour une école depuis la console
// (événement, annonce, défi) est de cette école, seuls ses membres le voient et en sont prévenus ; sans école choisie,
// c'est l'école de l'administration (l'ENSAM Meknès), comme avant.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const ADMIN = uid(961), SALMA = uid(962), KARIM = uid(963), NADIA = uid(964);
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const prevenus = async kind => (await db.query('select user_id from public.push_queue where kind = $1 order by user_id', [kind])).rows.map(r => r.user_id);
const voit = async (u, table, id) => (await q(u, `select id from public.${table} where id = $1`, [id])).length === 1;

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await db.query(`insert into public.ecoles (slug, nom, ouverte) values ('institut-b', 'Institut B', true)`);
  await creerCompte(db, { id: ADMIN, full_name: 'Admin Reseau', role: 'etudiant', filiere: 'GI', promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  await creerCompte(db, { id: SALMA, full_name: 'Salma Meknes', role: 'etudiant', filiere: 'GI', promo: 2027 });
  await creerCompte(db, { id: KARIM, full_name: 'Karim Institut', role: 'etudiant', filiere: 'GI', promo: 2027 });
  await creerCompte(db, { id: NADIA, full_name: 'Nadia Institut', role: 'laureat', filiere: 'GI', promo: 2016 });
  await db.query(`update public.profiles set ecole = 'institut-b' where id = any($1::uuid[])`, [[KARIM, NADIA]]);
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://p/' || id, 'k', 'a' from public.profiles on conflict do nothing`);
});

test('un événement publié pour une autre école : de cette école, vu et annoncé à ses seuls membres, annulation comprise', async () => {
  await db.query('delete from public.push_queue');
  const [e] = await q(ADMIN, `insert into public.evenements (author_id, titre, type, debut, public, ecole)
    values ($1, 'Portes ouvertes de l’Institut', 'conference', now() + interval '5 days', 'tous', 'institut-b') returning id, ecole`, [ADMIN]);
  assert.equal(e.ecole, 'institut-b');
  assert.deepEqual(await prevenus('evenement'), [KARIM, NADIA], 'les membres de l’Institut, personne de Meknès');
  assert.equal(await voit(SALMA, 'evenements', e.id), false);
  assert.equal(await voit(KARIM, 'evenements', e.id), true);
  // Karim s'inscrit, puis l'administration annule : Karim est prévenu
  await q(KARIM, 'insert into public.evenement_participants (evenement_id, user_id) values ($1, $2)', [e.id, KARIM]);
  await db.query('delete from public.push_queue');
  await q(ADMIN, 'update public.evenements set annule = true where id = $1', [e.id]);
  assert.deepEqual(await prevenus('evenement_annule'), [KARIM]);
});

test('une annonce et un défi pour une autre école : de cette école ; l’annonce ne prévient que ses membres', async () => {
  await db.query('delete from public.push_queue');
  const [a] = await q(ADMIN, `insert into public.annonces (author_id, texte, ecole) values ($1, 'Lancement du réseau de l’Institut', 'institut-b') returning id, ecole`, [ADMIN]);
  assert.equal(a.ecole, 'institut-b');
  assert.deepEqual(await prevenus('annonce'), [KARIM, NADIA]);
  assert.equal(await voit(SALMA, 'annonces', a.id), false);
  assert.equal(await voit(NADIA, 'annonces', a.id), true);
  const [d] = await q(ADMIN, `insert into public.defis (titre, mesure, cible, debut, fin, ecole)
    values ('Premier défi de l’Institut', 'offres', 20, current_date, current_date + 30, 'institut-b') returning id, ecole`);
  assert.equal(d.ecole, 'institut-b');
  assert.equal(await voit(SALMA, 'defis', d.id), false);
  assert.equal(await voit(KARIM, 'defis', d.id), true);
});

test('sans école choisie : l’événement et l’annonce sont de l’école de l’administration, comme avant', async () => {
  await db.query('delete from public.push_queue');
  const [e] = await q(ADMIN, `insert into public.evenements (author_id, titre, debut) values ($1, 'Forum entreprises', now() + interval '5 days') returning ecole`, [ADMIN]);
  assert.equal(e.ecole, 'ensam-meknes');
  assert.deepEqual(await prevenus('evenement'), [SALMA]);
  const [a] = await q(ADMIN, `insert into public.annonces (author_id, texte) values ($1, 'Réunion du réseau') returning ecole`, [ADMIN]);
  assert.equal(a.ecole, 'ensam-meknes');
  assert.deepEqual(await prevenus('annonce'), [SALMA]);
});
