// Écoles : chaque réseau ne voit que le sien, ENSAM Meknès ne change pas, personne n'entre seul dans une autre école
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const MEK = uid(801), MEK2 = uid(802), AUTRE = uid(803), ADMIN = uid(804), NOUVEAU = uid(805);
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const noms = async u => (await q(u, 'select full_name from public.profils order by full_name')).map(x => x.full_name);
const offre = (u, titre) => q(u, `insert into public.offers (author_id, type, titre, entreprise, description, annees) values ($1, 'pfe', $2, 'OCP', 'Mission.', '{5}') returning id, ecole`, [u, titre]);

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await db.query(`insert into public.ecoles (slug, nom, ouverte) values ('autre-ecole', 'Autre École', true), ('fermee', 'École fermée', false)`);
  await creerCompte(db, { id: MEK, full_name: 'Salma Meknes', role: 'etudiant', filiere: 'GI', promo: 2027 });
  await creerCompte(db, { id: MEK2, full_name: 'Youssef Meknes', role: 'laureat', filiere: 'GI', promo: 2015, entreprise: 'OCP' });
  await creerCompte(db, { id: AUTRE, full_name: 'Karim Autre', role: 'laureat', filiere: 'GI', promo: 2016, entreprise: 'Lear' });
  await creerCompte(db, { id: ADMIN, full_name: 'Admin Reseau', role: 'etudiant', filiere: 'GI', promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  await db.query(`update public.profiles set ecole = 'autre-ecole' where id = $1`, [AUTRE]);
});

test('tout le monde est à ENSAM Meknès par défaut, et l’école n’est pas une donnée d’un autre réseau', async () => {
  assert.equal((await db.query('select ecole from public.profiles where id = $1', [MEK])).rows[0].ecole, 'ensam-meknes');
  assert.deepEqual(await noms(MEK), ['Admin Reseau', 'Salma Meknes', 'Youssef Meknes']);
  assert.deepEqual(await noms(AUTRE), ['Karim Autre']);
  assert.equal((await noms(ADMIN)).length, 4, 'l’administration voit tous les réseaux');
});

test('une offre reste dans son école, en lecture comme en écriture', async () => {
  const [a] = await offre(MEK2, 'PFE Meknès'); const [b] = await offre(AUTRE, 'PFE Autre');
  assert.equal(a.ecole, 'ensam-meknes'); assert.equal(b.ecole, 'autre-ecole');
  const titres = async u => (await q(u, 'select titre from public.offers order by titre')).map(x => x.titre);
  assert.deepEqual(await titres(MEK), ['PFE Meknès']);
  assert.deepEqual(await titres(AUTRE), ['PFE Autre']);
  assert.equal((await titres(ADMIN)).length, 2);
  await assert.rejects(q(MEK2, `insert into public.offers (author_id, type, titre, entreprise, description, annees, ecole) values ($1, 'pfe', 'Ailleurs', 'OCP', 'Mission.', '{5}', 'autre-ecole')`, [MEK2]));
  assert.equal((await q(AUTRE, `update public.offers set titre = 'Pris' where id = $1 returning id`, [a.id])).length, 0, 'l’offre d’une autre école ne se modifie pas');
});

test('l’école d’un compte ne se change pas ; on n’entre pas dans une école fermée', async () => {
  await assert.rejects(q(MEK, `update public.profiles set ecole = 'autre-ecole' where id = $1`, [MEK]), /ne se change pas/);
  await q(ADMIN, `update public.profiles set ecole = 'ensam-meknes' where id = $1`, [ADMIN]);
  await db.query(`insert into auth.users (id, email) values ($1, 'n@x.ma') on conflict do nothing`, [NOUVEAU]);
  await assert.rejects(q(NOUVEAU, `insert into public.profiles (id, full_name, role, ecole) values ($1, 'Nouveau', 'etudiant', 'fermee')`, [NOUVEAU]), /pas encore ouvert/);
});

test('les écoles fermées ne se voient pas', async () => {
  const r = await q(MEK, 'select slug from public.ecoles order by slug');
  assert.deepEqual(r.map(x => x.slug), ['autre-ecole', 'ensam-meknes']);
  await assert.rejects(q(MEK, `update public.ecoles set ouverte = true where slug = 'fermee' returning slug`).then(x => { if (!x.length) throw new Error('refusé'); return x; }));
});

test('relancée, la mise à jour ne perd rien', async () => {
  const sql = (await import('node:fs')).readFileSync(SCHEMA, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, '');
  await db.exec(sql);
  assert.equal((await db.query(`select ecole from public.profiles where id = $1`, [AUTRE])).rows[0].ecole, 'autre-ecole');
  assert.deepEqual(await noms(AUTRE), ['Karim Autre']);
});
