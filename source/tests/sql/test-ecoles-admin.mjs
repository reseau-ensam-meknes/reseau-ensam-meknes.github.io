// Écoles, côté administration : liste officielle, couverture, manquants, rapport et chiffres d'insertion.
// Chaque fonction travaille sur une seule école : celle de l'administrateur, ou celle qu'il choisit (p_ecole).
// Un membre reste toujours dans la sienne.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
const AN = new Date().getFullYear();
let db;
const ADMIN = uid(901), SALMA = uid(902), NORA = uid(903), KARIM = uid(904), LAUREAT_MEK = uid(905);
const LAUREATS_AUTRE = [911, 912, 913, 914, 915].map(uid);
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const lignes = x => JSON.stringify(x);
const liste = async ecole => (await db.query('select nom, promo from public.liste_officielle where ecole = $1 order by nom', [ecole])).rows.map(r => `${r.nom} ${r.promo}`);
const verifie = async id => (await db.query('select verified from public.profiles where id = $1', [id])).rows[0].verified;

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await db.query(`insert into public.ecoles (slug, nom, ouverte) values ('autre-ecole', 'Autre École', true), ('fermee', 'École fermée', false)`);
  await creerCompte(db, { id: ADMIN, full_name: 'Admin Reseau', role: 'etudiant', filiere: 'GI', promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  await creerCompte(db, { id: SALMA, email: 'salma@exemple.ma', full_name: 'Salma Bennani', role: 'etudiant', filiere: 'GI', promo: AN + 1 });
  await creerCompte(db, { id: NORA, email: 'nora@exemple.ma', full_name: 'Nora Idrissi', role: 'etudiant', filiere: 'GI', promo: AN + 1 });
  await creerCompte(db, { id: KARIM, email: 'karim@exemple.ma', full_name: 'Karim Alaoui', role: 'etudiant', filiere: 'GI', promo: AN + 1 });
  await creerCompte(db, { id: LAUREAT_MEK, full_name: 'Youssef Lahlou', role: 'laureat', filiere: 'GI', promo: AN - 1 });
  for (const [i, id] of LAUREATS_AUTRE.entries()) await creerCompte(db, { id, full_name: `Laureat Autre ${i + 1}`, role: 'laureat', filiere: 'GI', promo: AN - 1 });
  await db.query(`update public.profiles set ecole = 'autre-ecole' where id = any($1::uuid[])`, [[KARIM, ...LAUREATS_AUTRE]]);
});

test('importer la liste : dans l’école de l’administrateur, ou dans celle qu’il choisit', async () => {
  const [{ importer_liste: r1 }] = await q(ADMIN, 'select public.importer_liste($1::jsonb)', [lignes([{ nom: 'Salma Bennani', promo: AN + 1 }, { nom: 'Omar Tazi', promo: AN + 1 }])]);
  assert.equal(r1.importes, 2);
  assert.deepEqual(await liste('ensam-meknes'), [`Omar Tazi ${AN + 1}`, `Salma Bennani ${AN + 1}`]);
  assert.equal(await verifie(SALMA), true, 'sur la liste de son école : vérifiée');
  // La liste d'une autre école : même nom que Salma, l'email de Salma, et Nora (inscrite à Meknès, pas sur la liste de Meknès)
  const autre = [{ nom: 'Salma Bennani', promo: AN + 1 }, { nom: 'Karim Alaoui', promo: AN + 1 }, { nom: 'Yassir Kabbaj', promo: AN + 1, email: 'salma@exemple.ma' }, { nom: 'Nora Idrissi', promo: AN + 1 }];
  const [{ importer_liste: r2 }] = await q(ADMIN, `select public.importer_liste($1::jsonb, false, 'autre-ecole')`, [lignes(autre)]);
  assert.equal(r2.importes, 4);
  assert.deepEqual(await liste('autre-ecole'), [`Karim Alaoui ${AN + 1}`, `Nora Idrissi ${AN + 1}`, `Salma Bennani ${AN + 1}`, `Yassir Kabbaj ${AN + 1}`]);
  assert.equal((await liste('ensam-meknes')).length, 2, 'la liste de Meknès ne bouge pas');
  assert.equal(await verifie(KARIM), true, 'Karim est sur la liste de son école');
  assert.equal(await verifie(NORA), false, 'Nora n’est que sur la liste d’une autre école : pas vérifiée');
  // Une école encore fermée se prépare avant d'ouvrir ; une école inconnue est refusée
  await q(ADMIN, `select public.importer_liste($1::jsonb, false, 'fermee')`, [lignes([{ nom: 'Ilyas Fermee', promo: AN + 2 }])]);
  assert.deepEqual(await liste('fermee'), [`Ilyas Fermee ${AN + 2}`]);
  await assert.rejects(q(ADMIN, `select public.importer_liste($1::jsonb, false, 'inconnue')`, [lignes([{ nom: 'X Y', promo: AN }])]), /École inconnue/);
  await assert.rejects(q(SALMA, `select public.importer_liste($1::jsonb, false, 'autre-ecole')`, [lignes([])]), /Réservé/);
  // Remplacer une promo ne touche que l'école choisie
  await q(ADMIN, `select public.importer_liste($1::jsonb, true, 'fermee')`, [lignes([{ nom: 'Hiba Fermee', promo: AN + 2 }])]);
  assert.deepEqual(await liste('fermee'), [`Hiba Fermee ${AN + 2}`]);
  assert.equal((await liste('autre-ecole')).length, 4);
});

test('couverture et manquants : la liste d’une école, comparée à ses inscrits seulement', async () => {
  const couv = async (...a) => (await q(ADMIN, `select public.couverture_liste(${a.map((_, i) => '$' + (i + 1)).join(',')}) c`, a))[0].c;
  assert.deepEqual(await couv(), [{ promo: AN + 1, filiere: '', total: 2, inscrits: 1 }], 'Meknès : Salma inscrite, Omar pas encore');
  // Autre école : Karim inscrit ; Salma (même nom) et Yassir (email de Salma) sont des inscrits de Meknès, donc absents ici
  assert.deepEqual(await couv('autre-ecole'), [{ promo: AN + 1, filiere: '', total: 4, inscrits: 1 }]);
  const manquants = async (...a) => (await q(ADMIN, `select nom from public.manquants_liste(${a.map((_, i) => '$' + (i + 1)).join(',')})`, a)).map(x => x.nom);
  assert.deepEqual(await manquants(AN + 1), ['Omar Tazi']);
  assert.deepEqual(await manquants(AN + 1, 'autre-ecole'), ['Nora Idrissi', 'Salma Bennani', 'Yassir Kabbaj']);
  await assert.rejects(q(ADMIN, `select public.couverture_liste('inconnue')`), /École inconnue/);
  await assert.rejects(q(KARIM, `select public.couverture_liste('autre-ecole')`), /Réservé/);
  await assert.rejects(q(KARIM, `select * from public.manquants_liste($1, 'autre-ecole')`, [AN + 1]), /Réservé/);
});

test('vider la liste d’une promo : une seule école, et les comptes vérifiés le restent', async () => {
  assert.equal((await q(ADMIN, 'select public.vider_liste($1) n', [AN + 1]))[0].n, 2);
  assert.deepEqual(await liste('ensam-meknes'), []);
  assert.equal((await liste('autre-ecole')).length, 4, 'la même promo d’une autre école reste');
  assert.equal(await verifie(SALMA), true);
  assert.equal((await q(ADMIN, `select public.vider_liste($1, 'autre-ecole') n`, [AN + 1]))[0].n, 4);
  assert.deepEqual(await liste('autre-ecole'), []);
  assert.equal((await liste('fermee')).length, 1);
  await assert.rejects(q(ADMIN, 'select public.vider_liste(null)'), /Choisis une promo/);
  await assert.rejects(q(SALMA, 'select public.vider_liste($1)', [AN + 2]), /Réservé/);
  await assert.rejects(q(ADMIN, `select public.vider_liste($1, 'inconnue')`, [AN + 2]), /École inconnue/);
});

test('rapport et chiffres d’insertion : chaque école les siens, même après l’anonymisation', async () => {
  const repondre = (u, situation) => q(u, `insert into public.enquetes_insertion (vague, promo, situation) values (6, $1, $2) returning ecole`, [AN - 1, situation]);
  assert.equal((await repondre(LAUREAT_MEK, 'emploi'))[0].ecole, 'ensam-meknes');
  for (const id of LAUREATS_AUTRE) assert.equal((await repondre(id, 'recherche'))[0].ecole, 'autre-ecole', 'la réponse prend l’école de qui répond');
  await assert.rejects(q(LAUREATS_AUTRE[0], `update public.enquetes_insertion set ecole = 'ensam-meknes' where user_id = $1 returning ecole`, [LAUREATS_AUTRE[0]])
    .then(r => { if (r[0]?.ecole === 'ensam-meknes') return; throw new Error('gardée'); }), /gardée/);
  // Rapport de l'administration
  const ligne = rows => rows.find(r => r.promo === AN - 1 && r.filiere === 'GI' && r.vague === 6);
  const mek = ligne(await q(ADMIN, 'select * from public.rapport_insertion()'));
  assert.equal(mek.inscrits, 1); assert.equal(mek.repondants, 1); assert.equal(mek.en_poste, 1);
  const autre = ligne(await q(ADMIN, `select * from public.rapport_insertion('autre-ecole')`));
  assert.equal(autre.inscrits, 5); assert.equal(autre.repondants, 5); assert.equal(autre.recherche, 5); assert.equal(autre.en_poste, 0);
  await assert.rejects(q(KARIM, `select * from public.rapport_insertion('autre-ecole')`), /Réservé/);
  // Chiffres des membres : sous 5 réponses rien ne s'affiche ; une autre école ne se voit jamais
  const stats = async (u, ...a) => (await q(u, `select public.stats_insertion(${a.map((_, i) => '$' + (i + 1)).join(',')}) s`, a))[0].s;
  assert.deepEqual((await stats(ADMIN)).map(g => g.n), [1]);
  assert.deepEqual((await stats(ADMIN, 'autre-ecole')).map(g => g.n), [5]);
  assert.deepEqual(await stats(LAUREAT_MEK), [], 'les 5 réponses de l’autre école ne comptent pas à Meknès');
  assert.deepEqual(await stats(LAUREAT_MEK, 'autre-ecole'), [], 'un membre ne choisit pas une autre école');
  assert.deepEqual((await stats(KARIM)).map(g => [g.n, g.recherche]), [[5, 5]]);
  // Anonymisée (user_id vide), une réponse reste dans son école
  await db.query('update public.enquetes_insertion set user_id = null where user_id = any($1::uuid[])', [LAUREATS_AUTRE]);
  assert.deepEqual((await db.query('select distinct ecole from public.enquetes_insertion where user_id is null')).rows.map(r => r.ecole), ['autre-ecole']);
  assert.deepEqual((await stats(KARIM)).map(g => g.n), [5]);
  assert.deepEqual(await stats(LAUREAT_MEK), []);
});

test('relancée, la mise à jour ne garde qu’une version de chaque fonction, et rien ne se perd', async () => {
  // Une base d'avant : les anciennes signatures (sans école)
  await db.exec(`
    create or replace function public.couverture_liste() returns jsonb language sql as $$ select '[]'::jsonb $$;
    create or replace function public.manquants_liste(p_promo int) returns table (nom text, email text, filiere text) language sql as $$ select null::text, null::text, null::text where false $$;
    create or replace function public.importer_liste(p_lignes jsonb, p_remplacer boolean default false) returns jsonb language sql as $$ select '{}'::jsonb $$;
    create or replace function public.stats_insertion() returns jsonb language sql as $$ select '[]'::jsonb $$;`);
  const sql = fs.readFileSync(SCHEMA, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, '');
  await db.exec(sql); await db.exec(sql);
  const versions = (await db.query(`select proname, pronargs from pg_proc where pronamespace = 'public'::regnamespace
    and proname in ('rapport_insertion', 'stats_insertion', 'importer_liste', 'couverture_liste', 'manquants_liste', 'vider_liste', 'ecole_visee') order by proname`)).rows;
  assert.deepEqual(versions.map(v => `${v.proname}/${v.pronargs}`), ['couverture_liste/1', 'ecole_visee/1', 'importer_liste/3', 'manquants_liste/2', 'rapport_insertion/1', 'stats_insertion/1', 'vider_liste/2']);
  assert.deepEqual((await db.query('select ecole, count(*)::int n from public.enquetes_insertion group by ecole order by ecole')).rows, [{ ecole: 'autre-ecole', n: 5 }, { ecole: 'ensam-meknes', n: 1 }]);
  // Sans argument, chaque fonction reste appelable comme avant (le site en ligne pendant la mise à jour)
  await q(ADMIN, 'select public.couverture_liste(), public.stats_insertion()');
  await q(ADMIN, 'select * from public.rapport_insertion()');
  await q(ADMIN, 'select * from public.manquants_liste($1)', [AN + 1]);
  await q(ADMIN, `select public.importer_liste('[]'::jsonb)`);
  assert.equal((await db.query(`select has_function_privilege('anon', 'public.vider_liste(int, text)', 'execute') a, has_function_privilege('authenticated', 'public.ecole_visee(text)', 'execute') b`)).rows[0].a, false);
});
