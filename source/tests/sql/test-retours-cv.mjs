// Lecture des CV : une proposition fausse est signalée par le membre ou par l'administration, qui seule la classe
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, creerCompte, en, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const ADMIN = uid(51), HAJEB = uid(52), AUTRE = uid(53);
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const signaler = (u, profil, juste) => q(u, `insert into public.retours_cv (profil_id, auteur_id, cv_path, proposition, juste, extrait)
  values ($1, $2, 'x/cv.pdf', '{"promo": 2019}', $3, 'National School of Arts and Crafts-ENSAM MEKNES 2019-2024') returning auteur_id, status`, [profil, u, juste]);

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ADMIN, full_name: 'Admin École', role: 'etudiant', filiere: 'Génie Civil', promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  await creerCompte(db, { id: HAJEB, full_name: 'Hajeb Abderrahman', role: 'laureat', filiere: 'Génie Mécanique', promo: 2024 });
  await creerCompte(db, { id: AUTRE, full_name: 'Autre Membre', role: 'laureat', filiere: 'Génie Mécanique', promo: 2020 });
});

test('le membre signale la lecture de son CV ; un autre membre ne peut ni signaler pour lui ni lire', async () => {
  const [r] = await signaler(HAJEB, HAJEB, 'Promo 2024');
  assert.equal(r.auteur_id, HAJEB); assert.equal(r.status, 'ouvert');
  await assert.rejects(signaler(AUTRE, HAJEB, 'faux'), /row-level security/);
  assert.equal((await q(AUTRE, 'select id from public.retours_cv')).length, 0);
  assert.equal((await q(HAJEB, 'select id from public.retours_cv')).length, 1);
});

test('l’administration signale pour un membre, le membre le voit, seule l’administration classe', async () => {
  await signaler(ADMIN, HAJEB, 'Promo 2024');
  assert.equal((await q(HAJEB, 'select id from public.retours_cv')).length, 2, 'le membre voit ce qui concerne son CV');
  await q(HAJEB, `update public.retours_cv set status = 'corrige'`);
  assert.equal((await q(ADMIN, `select id from public.retours_cv where status = 'corrige'`)).length, 0, 'le membre ne classe pas');
  const [c] = await q(ADMIN, `update public.retours_cv set status = 'corrige', juste = 'autre chose' where auteur_id = $1 returning status, juste`, [ADMIN]);
  assert.equal(c.status, 'corrige'); assert.equal(c.juste, 'Promo 2024', 'seul le statut change');
});
