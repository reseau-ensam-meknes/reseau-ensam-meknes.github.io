// Notifications sur le téléphone, par catégorie : défauts selon le rôle, choix du membre qui l'emporte,
// un seul filtre pour toutes les notifications (pousser et envois groupés), mêmes règles que logic.js
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';
import { PUSH_KINDS, PUSH_CATEGORIES, pushCategorie, pushDefaut, pushVoulu } from '../../src/logic.js';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const ETU = uid(301), LAU = uid(302), CHERCHE = uid(303), ADMIN = uid(304), TEST = uid(305);
const GI = 'Génie Industriel et Productique';
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const refuse = async (promesse, re) => { await assert.rejects(promesse, e => (re ? re.test(e.message) : true) || assert.fail(e.message)); };
const vider = () => db.query('delete from public.push_queue');
const file = async () => (await db.query('select user_id, kind from public.push_queue order by id')).rows.map(r => `${r.user_id === ETU ? 'ETU' : r.user_id === LAU ? 'LAU' : r.user_id === CHERCHE ? 'CHERCHE' : r.user_id === ADMIN ? 'ADMIN' : r.user_id}:${r.kind}`);
// pousser() comme le font les triggers (hors session d'un membre)
const pousser = async (lignes) => { for (const [u, k] of lignes) await db.query(`select public.pousser($1, $2, '{}'::jsonb)`, [u, k]); };
const choisir = (u, v) => q(u, 'update public.profiles set notif_push = $2::jsonb where id = $1 returning notif_push', [u, JSON.stringify(v)]);

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ETU, full_name: 'Salma Bennani', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: LAU, full_name: 'Youssef Amrani', role: 'laureat', filiere: GI, promo: 2015, entreprise: 'Renault' });
  await creerCompte(db, { id: CHERCHE, full_name: 'Halima Cherche', role: 'laureat', filiere: GI, promo: 2020 });
  await creerCompte(db, { id: ADMIN, full_name: 'Admin École', role: 'etudiant', filiere: GI, promo: 2010 });
  await creerCompte(db, { id: TEST, full_name: 'Profil Essai', role: 'etudiant', filiere: GI, promo: S + 2 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  await q(CHERCHE, 'update public.profiles set en_recherche = true where id = $1', [CHERCHE]);
  await db.query(`update public.profiles set cv_path = id::text || '/cv-1730000000000.pdf' where id = $1`, [ETU]);
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://push.example/' || id, 'k', 'a' from public.profiles where id <> $1`, [TEST]);
});

test('un membre arrive sans choix : notif_push vide, le défaut de son rôle s’applique', async () => {
  const r = (await db.query('select id, notif_push from public.profiles')).rows;
  assert.ok(r.every(x => JSON.stringify(x.notif_push) === '{}'));
  await vider();
  await pousser([
    [ETU, 'message'], [ETU, 'demande_proposition'], [ETU, 'candidature_statut'], [ETU, 'mentorat_accepte'], [ETU, 'offre_alerte'], [ETU, 'reponse'],
    [LAU, 'message'], [LAU, 'demande_nouvelle'], [LAU, 'candidature'], [LAU, 'mentorat_demande'], [LAU, 'offre_alerte'], [LAU, 'question_routee'],
    [CHERCHE, 'offre_alerte'],
    [ADMIN, 'signalement'], [ADMIN, 'offre_alerte'], [ADMIN, 'message'],
    [ETU, 'type_inconnu'], [LAU, 'type_inconnu'],
  ]);
  assert.deepEqual(await file(), [
    'ETU:message', 'ETU:demande_proposition', 'ETU:candidature_statut', 'ETU:mentorat_accepte', 'ETU:offre_alerte', 'ETU:reponse',
    'LAU:message', 'LAU:demande_nouvelle', 'LAU:candidature', 'LAU:mentorat_demande', 'LAU:question_routee',
    'CHERCHE:offre_alerte',
    'ADMIN:signalement', 'ADMIN:message',
    'ETU:type_inconnu', 'LAU:type_inconnu',
  ], 'lauréat : pas de nouvelles offres par défaut, sauf s’il cherche un emploi ; un type inconnu suit « vie du réseau »');
  // Sans téléphone abonné : rien en file, comme avant
  await vider();
  await pousser([[TEST, 'message']]);
  assert.deepEqual(await file(), []);
});

test('le choix du membre l’emporte sur le défaut, pour pousser() comme pour une insertion directe', async () => {
  assert.deepEqual((await choisir(ETU, { messages: false, offres: false }))[0].notif_push, { messages: false, offres: false });
  await choisir(LAU, { offres: true, reseau: false });
  await choisir(ADMIN, { messages: false });
  await vider();
  await pousser([
    [ETU, 'message'], [ETU, 'offre_alerte'], [ETU, 'mentorat_accepte'],
    [LAU, 'offre_alerte'], [LAU, 'question_routee'], [LAU, 'type_inconnu'], [LAU, 'candidature'],
    [ADMIN, 'message'], [ADMIN, 'signalement'],
  ]);
  assert.deepEqual(await file(), ['ETU:mentorat_accepte', 'LAU:offre_alerte', 'LAU:candidature', 'ADMIN:signalement'],
    'les signalements arrivent toujours à l’administration');
  // Les envois groupés écrivent directement dans la file : le même filtre s'applique
  await vider();
  await db.query(`insert into public.push_queue (user_id, kind, data) values ($1, 'message', '{}'), ($1, 'reponse', '{}'), ($2, 'cafe', '{}'), ($3, 'signalement', '{}')`, [ETU, LAU, ADMIN]);
  assert.deepEqual(await file(), ['ETU:reponse', 'ADMIN:signalement']);
  // Ancienne case « M'alerter » décochée : plus d'offres par défaut ; un choix explicite la remplace
  await q(ETU, `update public.profiles set alertes_offres = false, notif_push = '{}' where id = $1`, [ETU]);
  await vider();
  await pousser([[ETU, 'offre_alerte']]);
  assert.deepEqual(await file(), []);
  await choisir(ETU, { offres: true });
  await pousser([[ETU, 'offre_alerte']]);
  assert.deepEqual(await file(), ['ETU:offre_alerte']);
  for (const u of [ETU, LAU, ADMIN]) await choisir(u, {});
  await q(ETU, 'update public.profiles set alertes_offres = true where id = $1', [ETU]);
});

test('vraies actions : nouvelle offre et nouvelle demande prévenues selon les choix, sans jamais bloquer l’action', async () => {
  await vider();
  const offre = (titre, audience = 'etudiants', annees = '{5}') => q(LAU, `insert into public.offers (author_id, type, titre, entreprise, description, annees, filieres, audience) values ($1, 'pfe', $2, 'Renault', 'desc', $3, '{}', $4) returning id`, [LAU, titre, annees, audience]);
  await offre('PFE Lean');
  await offre('Ingénieur méthodes', 'laureats', '{}');
  assert.deepEqual((await file()).filter(x => x.endsWith(':offre_alerte')).sort(), ['CHERCHE:offre_alerte', 'ETU:offre_alerte']);
  await choisir(ETU, { offres: false });
  await choisir(CHERCHE, { offres: false });
  await vider();
  assert.equal((await offre('PFE Supply chain')).length, 1, 'l’offre est publiée');
  await offre('Ingénieur qualité', 'laureats', '{}');
  assert.deepEqual(await file(), []);
  // Nouvelle demande d'une étudiante : les lauréats de sa filière, sauf celui qui ne veut plus de « demandes »
  await choisir(LAU, { demandes: false });
  await vider();
  const [d] = await q(ETU, `insert into public.demandes (auteur_id, type, titre, details, lieu) values ($1, 'pfe', 'PFE en amélioration continue', 'Lean, VSM et Power BI : je cherche un PFE en usine, de février à juin.', 'Casablanca') returning id`, [ETU]);
  assert.ok(d.id, 'la demande est publiée');
  assert.deepEqual(await file(), ['CHERCHE:demande_nouvelle']);
  for (const u of [ETU, LAU, CHERCHE]) await choisir(u, {});
});

test('droits : chacun change ses propres choix seulement, avec des valeurs connues ; la vue les montre à lui seul', async () => {
  assert.equal((await q(ETU, `update public.profiles set notif_push = '{"messages":false}' where id = $1 returning id`, [LAU])).length, 0);
  assert.deepEqual((await db.query('select notif_push from public.profiles where id = $1', [LAU])).rows[0].notif_push, {});
  await refuse(q(ETU, `update public.profiles set notif_push = '{"publicite":true}' where id = $1`, [ETU]), /notif_push/);
  await refuse(q(ETU, `update public.profiles set notif_push = '{"messages":"non"}' where id = $1`, [ETU]), /notif_push/);
  await refuse(q(ETU, `update public.profiles set notif_push = '{"admin":false}' where id = $1`, [ETU]), /notif_push/);
  await refuse(q(ETU, `update public.profiles set notif_push = '[]' where id = $1`, [ETU]), /notif_push/);
  await refuse(q(ETU, `update public.profiles set notif_push = null where id = $1`, [ETU]), /null/);
  await choisir(ETU, { reseau: false });
  assert.deepEqual((await q(ETU, 'select notif_push from public.profils where id = $1', [ETU]))[0].notif_push, { reseau: false });
  assert.equal((await q(LAU, 'select notif_push from public.profils where id = $1', [ETU]))[0].notif_push, null);
  await refuse(q(ETU, 'select public.push_voulu($1, $2)', [LAU, 'message']), /permission denied/);
  await choisir(ETU, {});
});

test('mêmes règles que logic.js : catégorie de chaque type, défauts et choix', async () => {
  const kinds = [...Object.keys(PUSH_KINDS), 'type_inconnu', 'test'];
  const cats = (await db.query('select k, public.push_categorie(k) c from unnest($1::text[]) k', [kinds])).rows;
  for (const { k, c } of cats) assert.equal(c, pushCategorie(k), k);
  for (const role of ['etudiant', 'laureat', 'admin']) for (const alertes_offres of [true, false]) for (const en_recherche of [true, false]) {
    const me = { role, alertes_offres, en_recherche };
    const r = (await db.query('select c, public.push_defaut(c, jsonb_populate_record(null::public.profiles, $2::jsonb)) d from unnest($1::text[]) c',
      [[...PUSH_CATEGORIES, 'admin', 'autre'], JSON.stringify(me)])).rows;
    for (const { c, d } of r) assert.equal(d, pushDefaut(c, me), `${c} ${JSON.stringify(me)}`);
  }
  const choix = [{}, { offres: true }, { offres: false, messages: false }, { reseau: false, demandes: false, candidatures: false, mentorat: false }];
  for (const role of ['etudiant', 'laureat', 'admin']) for (const en_recherche of [true, false]) for (const notif_push of choix) {
    await db.query('update public.profiles set role = $2, en_recherche = $3, notif_push = $4::jsonb where id = $1', [TEST, role, en_recherche, JSON.stringify(notif_push)]);
    const me = { role, en_recherche, alertes_offres: true, notif_push };
    const r = (await db.query('select k, public.push_voulu($1, k) v from unnest($2::text[]) k', [TEST, kinds])).rows;
    for (const { k, v } of r) assert.equal(v, pushVoulu(k, me), `${k} ${JSON.stringify(me)}`);
  }
});

test('mise à jour relancée : les choix restent, un seul filtre', async () => {
  await choisir(LAU, { offres: true, reseau: false });
  await db.exec(fs.readFileSync(SCHEMA, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, ''));
  assert.deepEqual((await db.query('select notif_push from public.profiles where id = $1', [LAU])).rows[0].notif_push, { offres: true, reseau: false });
  assert.equal((await db.query(`select count(*)::int n from pg_trigger where tgname = 'trg_push_filtre'`)).rows[0].n, 1);
  assert.equal((await db.query(`select count(*)::int n from pg_constraint where conname = 'profiles_notif_push_check'`)).rows[0].n, 1);
  await vider();
  await pousser([[LAU, 'cafe'], [LAU, 'offre_alerte']]);
  assert.deepEqual(await file(), ['LAU:offre_alerte']);
});
