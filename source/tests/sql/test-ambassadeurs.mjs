// Ambassadeurs de promo : la base propose le rôle au membre le plus actif de chaque promo × filière (comme
// candidatsAmbassadeur() de logic.js), jamais à l'administration ; refus ou 7 jours sans réponse : le suivant ;
// un seul ambassadeur à la fois ; chacun ne répond que pour lui ; les chiffres de la promo pour l'ambassadeur.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nouvelleBase, creerCompte, en, uid } from './banc-sql.mjs';
import { candidatsAmbassadeur, chiffresPromo, proposerAmbassadeur } from '../../src/logic.js';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
const GM = 'Génie Mécanique', GC = 'Génie Civil';
let db;
const [ACTIF, MOYEN, CALME, SANS, NOUVEAU, AUTRE, ETU, ADM, GC1] = [21, 22, 23, 24, 25, 26, 27, 28, 29].map(uid);
const jours = n => new Date(Date.now() - n * 864e5).toISOString();
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const service = (sql, p) => en(db, null, tx => tx.query(sql, p), { role: 'service_role' }).then(r => r.rows);
const proposer = u => q(u, 'select public.ambassadeurs_proposer() n').then(r => r[0].n);
const lignes = () => db.query('select user_id, statut, par, promo, filiere from public.ambassadeurs order by created_at, user_id').then(r => r.rows);
const enCours = (promo, filiere) => db.query(`select user_id, statut from public.ambassadeurs where promo = $1 and filiere = $2 and statut in ('propose','accepte')`, [promo, filiere]).then(r => r.rows);
const repondre = (u, statut) => q(u, 'update public.ambassadeurs set statut = $2 where user_id = $1 and statut <> $2 returning statut', [u, statut]);
// Changer une date sans passer par les règles (le temps qui passe)
const brut = async (sql, p) => { await db.exec('set session_replication_role = replica'); try { await db.query(sql, p); } finally { await db.exec('set session_replication_role = origin'); } };
const iso = rows => rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])));
const tables = async () => {
  const t = {};
  for (const n of ['profiles', 'offers', 'propositions', 'mentorships', 'answers', 'questions', 'demandes', 'placements', 'ambassadeurs']) t[n] = iso(await service(`select * from public.${n}`));
  return t;
};

before(async () => {
  db = await nouvelleBase(SCHEMA);
  const compte = async (id, nom, role, promo, filiere, inscrit) => {
    await creerCompte(db, { id, full_name: nom, role: role === 'admin' ? 'laureat' : role, filiere, promo });
    await db.query('update public.profiles set consent_at = now(), created_at = $2 where id = $1', [id, inscrit]);
    if (role === 'admin') await db.query(`update public.profiles set role = 'admin' where id = $1`, [id]);
  };
  await compte(ACTIF, 'Lauréat Actif', 'laureat', 2018, GM, jours(300));
  await compte(MOYEN, 'Lauréate Moyenne', 'laureat', 2018, GM, jours(200));
  await compte(CALME, 'Lauréat Calme', 'laureat', 2018, GM, jours(100));
  await compte(SANS, 'Lauréat Sans Accord', 'laureat', 2018, GM, jours(400));
  await compte(NOUVEAU, 'Lauréat Nouveau', 'laureat', 2018, GM, jours(2));
  await compte(AUTRE, 'Lauréat Autre Promo', 'laureat', 2019, GM, jours(50));
  await compte(ETU, 'Étudiante Aidée', 'etudiant', 2027, GM, jours(30));
  await compte(ADM, 'Administration', 'admin', 2018, GM, jours(500));
  await compte(GC1, 'Lauréate Civil', 'laureat', 2018, GC, jours(60));
  await db.query('update public.profiles set consent_at = null where id = $1', [SANS]);
  await db.exec('set session_replication_role = replica');
  const offre = (a, j) => db.query(`insert into public.offers (author_id, type, titre, entreprise, description, annees, created_at) values ($1, 'stage', 'Stage test', 'OCP', 'desc', '{4}', $2)`, [a, jours(j)]);
  await offre(ACTIF, 20); await offre(ACTIF, 10);                // 6
  await offre(MOYEN, 15);                                        // 3, + 2 réponses = 7 ?
  await offre(SANS, 40); await offre(SANS, 30); await offre(SANS, 20); // jamais : pas encore accepté les conditions
  await offre(ADM, 5); await offre(ADM, 4); await offre(ADM, 3); // jamais : l'administration
  await offre(GC1, 12);
  const [qu] = (await db.query(`insert into public.questions (author_id, categorie, titre) values ($1, 'stage', 'Une question de test') returning id`, [ETU])).rows;
  await db.query(`insert into public.answers (question_id, author_id, body) values ($1, $2, 'Réponse'), ($1, $2, 'Autre réponse')`, [qu.id, MOYEN]);
  await db.query(`insert into public.mentorships (student_id, mentor_id, sujet, status, accepted_at) values ($1, $2, 'Conseil', 'terminee', now())`, [ETU, CALME]);
  // Une réussite et une demande pourvue dans la promo 2027 (chiffres)
  const [d] = (await db.query(`insert into public.demandes (auteur_id, type, titre, details, status, updated_at) values ($1, 'pfe', 'PFE génie méca', 'Je cherche un PFE en conception mécanique.', 'pourvue', now()) returning id`, [ETU])).rows;
  await db.query(`insert into public.placements (student_id, laureat_id, saison, niveau, type, entreprise, status, demande_id, confirmed_at) values ($1, $2, 2026, 4, 'stage', 'Renault', 'confirme', $3, now())`, [ETU, ACTIF, d.id]);
  await db.exec('set session_replication_role = origin');
  await db.query('update auth.users set last_sign_in_at = now() where id = $1', [CALME]); // 3 + 2 (connexion récente) = 5
});

test('la base propose au plus actif du groupe, comme le calcul de l’appli ; jamais l’administration ni sans accord', async () => {
  const t = await tables();
  // Même ordre que logic.js, la connexion récente en plus (la base seule la connaît : CALME 3 + 2)
  const appli = candidatsAmbassadeur(t, 2018, GM).map(x => [x.id, x.score]);
  assert.deepEqual(appli, [[MOYEN, 7], [ACTIF, 6], [CALME, 3]]);
  const base = (await service(`select id, score from public.ambassadeur_candidats(2018, '${GM}')`)).map(x => [x.id, x.score]);
  assert.deepEqual(base, [[MOYEN, 7], [ACTIF, 6], [CALME, 5]]);
  assert.equal(proposerAmbassadeur(t, 2018, GM).candidat, MOYEN);
  // Un membre ouvre l'appli : seul son groupe est traité
  assert.equal(await proposer(NOUVEAU), 1);
  assert.deepEqual(await lignes(), [{ user_id: MOYEN, statut: 'propose', par: 'auto', promo: 2018, filiere: GM }]);
  assert.equal(await proposer(NOUVEAU), 0, 'déjà quelqu’un');
  // La fonction de classement n'est pas ouverte
  await assert.rejects(q(ACTIF, `select * from public.ambassadeur_candidats(2018, '${GM}')`), /permission denied/);
  await assert.rejects(en(db, null, tx => tx.query('select public.ambassadeurs_proposer()'), { role: 'anon' }), /permission denied/);
});

test('chacun ne voit que les ambassadeurs acceptés et ses propres lignes ; refus : le suivant ; annuler dans les 10 minutes', async () => {
  assert.equal((await q(ACTIF, 'select * from public.ambassadeurs')).length, 0, 'une proposition reste entre la plateforme et la personne');
  assert.equal((await q(MOYEN, 'select * from public.ambassadeurs')).length, 1);
  // Quelqu'un d'autre ne répond pas à sa place
  assert.equal((await repondre(ACTIF, 'accepte')).length, 0);
  assert.equal((await q(ACTIF, `update public.ambassadeurs set statut = 'accepte' returning id`)).length, 0);
  // Elle refuse, puis annule (le « Annuler » du message du bas), puis refuse pour de bon
  await repondre(MOYEN, 'refuse');
  await q(MOYEN, `update public.ambassadeurs set statut = 'propose' where user_id = $1`, [MOYEN]);
  assert.deepEqual(await enCours(2018, GM), [{ user_id: MOYEN, statut: 'propose' }]);
  await repondre(MOYEN, 'refuse');
  assert.equal(await proposer(CALME), 1);
  assert.deepEqual(await enCours(2018, GM), [{ user_id: ACTIF, statut: 'propose' }], 'au suivant');
  // Une fois le refus passé (plus de 10 minutes), plus de retour en arrière
  await brut(`update public.ambassadeurs set repondu_at = now() - interval '11 minutes' where user_id = $1`, [MOYEN]);
  await assert.rejects(q(MOYEN, `update public.ambassadeurs set statut = 'propose' where user_id = $1`, [MOYEN]), /non autorisé/);
  // Il accepte : tous les membres le voient (badge)
  await repondre(ACTIF, 'accepte');
  for (const u of [ETU, GC1, AUTRE]) assert.deepEqual((await q(u, 'select user_id, statut from public.ambassadeurs')), [{ user_id: ACTIF, statut: 'accepte' }]);
  // Il ne peut pas changer de promo ni de date
  await q(ACTIF, `update public.ambassadeurs set promo = 2010, propose_at = now() - interval '1 year' where user_id = $1`, [ACTIF]);
  assert.deepEqual((await enCours(2018, GM)).length, 1);
  assert.equal(await proposer(CALME), 0, 'un seul ambassadeur à la fois');
});

test('7 jours sans réponse : expirée, et proposée au suivant ; accepter après 7 jours est refusé', async () => {
  // Autre groupe (Génie Civil 2018) : une seule lauréate active
  assert.equal(await proposer(GC1), 1);
  await brut(`update public.ambassadeurs set propose_at = now() - interval '8 days' where user_id = $1`, [GC1]);
  await assert.rejects(repondre(GC1, 'accepte'), /non autorisé/);
  assert.equal(await proposer(GC1), 1, 'expirée');
  const l = (await lignes()).filter(x => x.filiere === GC);
  assert.deepEqual(l.map(x => [x.user_id, x.statut]), [[GC1, 'expire']], 'personne d’autre à proposer');
  // logic.js : même lecture
  const t = await tables();
  assert.equal(proposerAmbassadeur(t, 2018, GC).candidat, null);
});

test('l’administration nomme (une proposition, avec la promo du membre) et retire ; un membre ne nomme personne', async () => {
  await assert.rejects(q(ETU, `insert into public.ambassadeurs (promo, filiere, user_id, par) values (2027, $1, $2, 'admin')`, [GM, ETU]), /row-level security|violates/);
  await assert.rejects(q(ADM, `insert into public.ambassadeurs (promo, filiere, user_id, par) values (2027, $1, $2, 'admin')`, [GM, ADM]), /Seul un étudiant ou un lauréat/);
  await q(ADM, `insert into public.ambassadeurs (promo, filiere, user_id, par) values (1999, 'X', $1, 'admin')`, [ETU]);
  assert.deepEqual(await enCours(2027, GM), [{ user_id: ETU, statut: 'propose' }], 'promo et filière du membre');
  // Retirer l'ambassadeur de 2018 : puis annuler, puis retirer
  await q(ADM, `update public.ambassadeurs set statut = 'retire' where user_id = $1 and statut = 'accepte'`, [ACTIF]);
  assert.deepEqual(await enCours(2018, GM), []);
  await q(ADM, `update public.ambassadeurs set statut = 'accepte' where user_id = $1 and statut = 'retire'`, [ACTIF]);
  assert.deepEqual(await enCours(2018, GM), [{ user_id: ACTIF, statut: 'accepte' }]);
  // L'admin ne peut pas accepter à la place du membre
  await assert.rejects(q(ADM, `update public.ambassadeurs set statut = 'accepte' where user_id = $1`, [ETU]), /non autorisé/);
  // Il se retire lui-même
  await repondre(ACTIF, 'retire');
  assert.deepEqual(await enCours(2018, GM), []);
  await q(ACTIF, `update public.ambassadeurs set statut = 'accepte' where user_id = $1 and statut = 'retire'`, [ACTIF]);
  assert.deepEqual(await enCours(2018, GM), [{ user_id: ACTIF, statut: 'accepte' }]);
});

test('les chiffres de la promo : pour l’ambassadeur accepté seulement, les mêmes que l’appli ; schema relançable', async () => {
  // L'étudiante accepte d'être ambassadrice de 2027
  await repondre(ETU, 'accepte');
  const debut = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const [x] = await q(ETU, 'select public.chiffres_ma_promo($1) x', [debut]);
  const t = await tables();
  const appli = chiffresPromo(t, 2027, GM, debut);
  assert.deepEqual({ ...x.x, debut: undefined, promo: undefined, filiere: undefined }, { ...appli, debut: undefined, promo: undefined, filiere: undefined });
  assert.deepEqual([appli.inscrits, appli.demandes, appli.stages], [1, 1, 1]);
  assert.equal(x.x.promo, 2027);
  assert.equal((await q(CALME, 'select public.chiffres_ma_promo() x'))[0].x, null, 'pas ambassadeur');
  assert.equal((await q(ADM, `select public.chiffres_ma_promo(null, 2018, $1) x`, [GM]))[0].x.inscrits, 5, 'l’administration, pour n’importe quel groupe (sans elle-même)');
  // Le résumé de la semaine (clé de service) les lit tous ; un membre, jamais
  await assert.rejects(q(ETU, 'select * from public.chiffres_ambassadeurs(now())'), /permission denied/);
  assert.deepEqual((await service('select user_id from public.chiffres_ambassadeurs($1) order by user_id', [debut])).map(r => r.user_id), [ACTIF, ETU]);
  // schema.sql relancé : les lignes restent
  await db.exec(fs.readFileSync(SCHEMA, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, ''));
  assert.equal((await enCours(2027, GM)).length, 1);
  assert.equal(await proposer(ETU), 0);
});
