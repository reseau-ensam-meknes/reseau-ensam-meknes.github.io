// Recrutement déclaré : l'étudiant confirme, même quand c'est l'administration qui recrute sur sa propre offre ;
// celui qui l'a déclaré peut l'annuler tant que l'étudiant n'a pas confirmé, la candidature redevient « Envoyée »
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const ETU = uid(31), ETU2 = uid(32), LAU = uid(33), ADMIN = uid(34);
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const offre = async auteur => (await db.query(`insert into public.offers (author_id, type, titre, entreprise, description) values ($1, 'pfe', 'PFE Qualité', 'Trèves Group', 'Amélioration continue.') returning id`, [auteur])).rows[0].id;
const recruter = (u, etu, o) => q(u, `insert into public.placements (student_id, offer_id, laureat_id, saison, niveau, type, entreprise, source)
  values ($1, $2, $3, $4, 5, 'pfe', 'Trèves Group', 'plateforme') returning id, status`, [etu, o, u, S]).then(r => r[0]);
const lire = id => db.query('select * from public.placements where id = $1', [id]).then(r => r.rows[0]);

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ETU, full_name: 'Adam El Madani', role: 'etudiant', filiere: 'Génie Industriel', promo: S + 1 });
  await creerCompte(db, { id: ETU2, full_name: 'Salma Bennani', role: 'etudiant', filiere: 'Génie Industriel', promo: S + 1 });
  await creerCompte(db, { id: LAU, full_name: 'Youssef Alaoui', role: 'laureat', filiere: 'Génie Industriel', promo: 2018 });
  await creerCompte(db, { id: ADMIN, full_name: 'Admin Réseau', role: 'laureat', filiere: 'Génie Industriel', promo: 2012 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
});

test('l’administration qui recrute sur sa propre offre : l’étudiant confirme, comme pour un lauréat', async () => {
  const o = await offre(ADMIN);
  const p = await recruter(ADMIN, ETU, o);
  assert.equal(p.status, 'en_attente', 'pas une réussite « déclarée » sans confirmation');
  await q(ETU, `update public.placements set status = 'confirme' where id = $1`, [p.id]);
  const apres = await lire(p.id);
  assert.equal(apres.status, 'confirme');
  assert.ok(apres.confirmed_at);
  // Une réussite saisie par l'administration pour quelqu'un d'autre garde son statut
  const [autre] = await q(ADMIN, `insert into public.placements (student_id, saison, niveau, type, entreprise, status) values ($1, $2, 5, 'stage', 'OCP', 'confirme') returning status`, [ETU2, S]);
  assert.equal(autre.status, 'confirme');
});

test('annuler un recrutement déclaré par erreur : possible avant la confirmation, plus après', async () => {
  const o = await offre(LAU);
  const [app] = await q(ETU2, `insert into public.applications (student_id, offer_id, entreprise, titre) values ($1, $2, 'Trèves Group', 'PFE Qualité') returning id`, [ETU2, o]);
  // L'étudiant a déjà une réussite cette année (test précédent) pour ETU2 : on la retire pour ce parcours
  await db.query(`delete from public.placements where student_id = $1`, [ETU2]);
  await q(LAU, `update public.applications set status = 'retenu' where id = $1`, [app.id]);
  const p = await recruter(LAU, ETU2, o);
  assert.equal(p.status, 'en_attente');
  // Un autre lauréat ne peut pas l'annuler à sa place
  const [autreLau] = [uid(35)];
  await creerCompte(db, { id: autreLau, full_name: 'Nadia Lahlou', role: 'laureat', filiere: 'Génie Industriel', promo: 2020 });
  await q(autreLau, 'delete from public.placements where id = $1', [p.id]);
  assert.ok(await lire(p.id), 'toujours là');
  // Celui qui l'a déclaré l'annule, la candidature redevient « Envoyée »
  await q(LAU, 'delete from public.placements where id = $1', [p.id]);
  await q(LAU, `update public.applications set status = 'postule' where id = $1`, [app.id]);
  assert.equal(await lire(p.id), undefined);
  assert.equal((await db.query('select status from public.applications where id = $1', [app.id])).rows[0].status, 'postule');
  // Une fois confirmé par l'étudiant, le lauréat ne peut plus l'effacer
  const p2 = await recruter(LAU, ETU2, o);
  await q(ETU2, `update public.placements set status = 'confirme' where id = $1`, [p2.id]);
  await q(LAU, 'delete from public.placements where id = $1', [p2.id]);
  assert.equal((await lire(p2.id)).status, 'confirme');
});

test('une ancienne déclaration de l’administration restée « declare » peut être annulée', async () => {
  const o = await offre(ADMIN);
  const [p] = (await db.query(`insert into public.placements (student_id, offer_id, laureat_id, saison, niveau, type, entreprise, source, status)
    values ($1, $2, $3, $4, 5, 'pfe', 'Trèves Group', 'plateforme', 'declare') returning id`, [ETU, o, ADMIN, S - 1])).rows;
  await q(ADMIN, 'delete from public.placements where id = $1', [p.id]);
  assert.equal(await lire(p.id), undefined);
});

test('un recrutement annulé qui ramène la candidature à « Entretien » ne renvoie pas de notification d’entretien', async () => {
  const etu = uid(36);
  await creerCompte(db, { id: etu, full_name: 'Hamza Idrissi', role: 'etudiant', filiere: 'Génie Industriel', promo: S + 1 });
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, 'k', 'a')`, [etu, 'https://push.example/' + etu]);
  const o = await offre(LAU);
  const [app] = await q(etu, `insert into public.applications (student_id, offer_id, entreprise, titre) values ($1, $2, 'Trèves Group', 'PFE Qualité') returning id`, [etu, o]);
  for (const st of ['entretien', 'retenu', 'entretien']) await q(LAU, 'update public.applications set status = $2 where id = $1', [app.id, st]);
  const pushs = (await db.query(`select data->>'statut' as s from public.push_queue where kind = 'candidature_statut' and user_id = $1`, [etu])).rows.map(r => r.s).sort();
  assert.deepEqual(pushs, ['entretien', 'retenu'], 'un seul « Entretien »');
});
