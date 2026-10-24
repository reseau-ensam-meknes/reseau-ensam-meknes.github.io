// Ambassadeurs, après relecture de sécurité : l'administration n'accepte jamais à la place du membre ; chacun n'annule
// que son propre retrait ; changer de promo ou de filière met fin au rôle (jamais deux groupes) ; une filière inattendue
// n'arrête pas les autres groupes ; un groupe sans candidat n'est recalculé qu'une fois par heure ; relançable depuis 70bc2b2.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { nouvelleBase, creerCompte, en, uid } from './banc-sql.mjs';
import { candidatsAmbassadeur, ambassadeursActifs } from '../../src/logic.js';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
const GM = 'Génie Mécanique', GC = 'Génie Civil', GI = 'Génie Industriel';
let db;
const [A, B, C, D, E, LONG, ADM] = [41, 42, 43, 44, 45, 46, 47].map(uid);
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const proposer = u => q(u, 'select public.ambassadeurs_proposer() n').then(r => r[0].n);
// qui change le statut de la ligne 2018 de cible (le membre lui-même, ou l'administration) ; une seule ligne attendue
const statut = async (qui, cible, s) => {
  const r = await q(qui, 'update public.ambassadeurs set statut = $2 where user_id = $1 and promo = 2018 returning statut', [cible, s]);
  assert.equal(r.length, 1, 'une ligne changée'); return r;
};
const ligne = (u, promo = 2018) => db.query('select statut, retire_par, statut_avant, promo, filiere from public.ambassadeurs where user_id = $1 and promo = $2 order by created_at desc limit 1', [u, promo]).then(r => r.rows[0]);
const brut = async (sql, p) => { await db.exec('set session_replication_role = replica'); try { await db.query(sql, p); } finally { await db.exec('set session_replication_role = origin'); } };
const offre = a => brut(`insert into public.offers (author_id, type, titre, entreprise, description, annees) values ($1, 'stage', 'Stage test', 'OCP', 'desc', '{4}')`, [a]);

before(async () => {
  db = await nouvelleBase(SCHEMA);
  const compte = async (id, nom, promo, filiere) => {
    await creerCompte(db, { id, full_name: nom, role: 'laureat', filiere, promo });
    await db.query('update public.profiles set consent_at = now() where id = $1', [id]);
  };
  await compte(A, 'Lauréat Alpha', 2018, GM);
  await compte(B, 'Lauréat Bravo', 2018, GM);
  await compte(C, 'Lauréat Charlie', 2018, GC);
  await compte(D, 'Lauréat Delta', 2019, GI);
  await compte(E, 'Lauréat Echo', 2020, GI);
  await compte(LONG, 'Lauréat Long', 2018, GI);
  await compte(ADM, 'Administration Test', 2010, GM);
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADM]);
  await offre(A); await offre(A); await offre(B); await offre(C); await offre(D);
});

test('l’administration retire, et n’annule que vers le statut d’avant : jamais accepter à la place du membre', async () => {
  assert.equal(await proposer(B), 1);
  assert.equal((await ligne(A)).statut, 'propose');
  await assert.rejects(statut(ADM, A, 'accepte'), /non autorisé/);
  await statut(ADM, A, 'retire');
  assert.deepEqual(await ligne(A), { statut: 'retire', retire_par: 'admin', statut_avant: 'propose', promo: 2018, filiere: GM });
  await assert.rejects(statut(ADM, A, 'accepte'), /non autorisé/, 'propose → retire → accepte : non');
  await assert.rejects(statut(A, A, 'accepte'), /non autorisé/, 'le membre ne revient pas sur un retrait de l’administration');
  await statut(ADM, A, 'propose');
  assert.deepEqual(await ligne(A), { statut: 'propose', retire_par: null, statut_avant: null, promo: 2018, filiere: GM }, 'annuler : retour à la proposition');
});

test('retiré par l’administration, le membre ne se remet pas ; retiré par lui-même, l’administration ne le remet pas', async () => {
  await statut(A, A, 'accepte');
  await statut(ADM, A, 'retire');
  assert.equal((await ligne(A)).retire_par, 'admin');
  await assert.rejects(statut(A, A, 'accepte'), /non autorisé/);
  // retire_par ne s'écrit pas à la main
  await q(A, `update public.ambassadeurs set retire_par = 'membre', statut_avant = 'accepte' where user_id = $1`, [A]);
  assert.equal((await ligne(A)).retire_par, 'admin');
  await assert.rejects(statut(A, A, 'accepte'), /non autorisé/);
  // L'administration annule son retrait (dans les 10 minutes) : il est de nouveau ambassadeur
  await statut(ADM, A, 'accepte');
  assert.equal((await ligne(A)).statut, 'accepte');
  // Il se retire lui-même : lui seul peut annuler
  await statut(A, A, 'retire');
  assert.deepEqual([(await ligne(A)).retire_par, (await ligne(A)).statut_avant], ['membre', 'accepte']);
  await assert.rejects(statut(ADM, A, 'accepte'), /non autorisé/);
  await statut(A, A, 'accepte');
  assert.equal((await ligne(A)).statut, 'accepte');
  // Plus de 10 minutes après un retrait de l'administration : rien ne revient
  await statut(ADM, A, 'retire');
  await brut(`update public.ambassadeurs set repondu_at = now() - interval '11 minutes' where user_id = $1`, [A]);
  await assert.rejects(statut(ADM, A, 'accepte'), /non autorisé/);
  await assert.rejects(q(ADM, 'delete from public.ambassadeurs where user_id = $1 returning id', [A]), /permission denied/);
});

test('changer de promo ou de filière met fin au rôle : jamais ambassadeur d’un autre groupe, ni de deux', async () => {
  // C est ambassadeur de Génie Civil 2018
  assert.equal(await proposer(C), 1);
  await q(C, `update public.ambassadeurs set statut = 'accepte' where user_id = $1`, [C]);
  assert.equal((await q(C, 'select public.chiffres_ma_promo() x'))[0].x.promo, 2018);
  // Il passe en Génie Industriel 2019 (où D est le plus actif, mais avec moins d'offres que lui une fois sa promo changée)
  await offre(C); await offre(C);
  await q(C, 'update public.profiles set promo = 2019, filiere = $2 where id = $1', [C, GI]);
  assert.deepEqual(await ligne(C), { statut: 'retire', retire_par: 'systeme', statut_avant: 'accepte', promo: 2018, filiere: GC });
  await assert.rejects(q(C, `update public.ambassadeurs set statut = 'accepte' where user_id = $1`, [C]), /non autorisé/, 'un retrait du système ne s’annule pas');
  assert.equal((await q(C, 'select public.chiffres_ma_promo() x'))[0].x, null);
  // Dans son nouveau groupe, il redevient candidat comme un autre (son ancienne ligne est close)
  assert.equal(await proposer(C), 1);
  assert.deepEqual((await db.query(`select user_id from public.ambassadeurs where promo = 2019 and statut = 'propose'`)).rows.map(r => r.user_id), [C]);
  // Une ligne en cours ailleurs (données d'avant ce correctif) : pas candidat ici, et ses chiffres sont ceux du groupe actuel seulement
  await brut(`update public.ambassadeurs set statut = 'retire' where user_id = $1 and promo = 2019`, [C]);
  await brut(`insert into public.ambassadeurs (promo, filiere, user_id, statut) values (2017, $2, $1, 'accepte')`, [D, GI]);
  const base = (await en(db, null, tx => tx.query(`select id from public.ambassadeur_candidats(2019, $1)`, [GI]), { role: 'service_role' })).rows.map(r => r.id);
  assert.ok(!base.includes(D), 'déjà ambassadeur ailleurs');
  assert.equal((await q(D, 'select public.chiffres_ma_promo() x'))[0].x, null, 'le rôle d’un autre groupe ne donne rien');
  assert.deepEqual((await en(db, null, tx => tx.query('select user_id from public.chiffres_ambassadeurs(now())'), { role: 'service_role' })).rows.map(r => r.user_id).filter(u => u === D), []);
  await assert.rejects(q(ADM, `insert into public.ambassadeurs (promo, filiere, user_id, par) values (2019, $2, $1, 'admin')`, [D, GI]), /Déjà ambassadeur/);
  // logic.js : même règle, et le badge ne suit pas un ancien groupe
  const data = {
    profiles: [{ id: 'd', promo: 2019, filiere: GI, role: 'laureat' }, { id: 'c', promo: 2019, filiere: GI, role: 'laureat' }],
    offers: [{ author_id: 'd' }, { author_id: 'd' }, { author_id: 'c' }],
    ambassadeurs: [{ user_id: 'd', promo: 2017, filiere: GI, statut: 'accepte' }],
  };
  assert.deepEqual(candidatsAmbassadeur(data, 2019, GI).map(x => x.id), ['c']);
  assert.equal(ambassadeursActifs(data).has('d'), false);
  await brut('delete from public.ambassadeurs where user_id = $1 and promo = 2017', [D]);
});

test('une filière de plus de 120 caractères n’arrête pas la proposition des autres groupes', async () => {
  await q(LONG, `update public.profiles set filiere = repeat('x', 130), promo = 2021 where id = $1`, [LONG]);
  await offre(E); await offre(LONG);
  const n = await proposer(ADM);
  assert.ok(n >= 1, 'les autres groupes sont traités');
  assert.equal((await db.query(`select count(*)::int n from public.ambassadeurs where user_id = $1 and statut = 'propose'`, [E])).rows[0].n, 1);
  assert.equal(await proposer(LONG), 0);
});

test('coût : index sur les auteurs ; un groupe sans candidat attend une heure ; la table des passages est fermée', async () => {
  const idx = (await db.query(`select tablename || '.' || indexdef as d from pg_indexes where schemaname = 'public'`)).rows.map(r => r.d);
  for (const [t, c] of [['offers', 'author_id'], ['propositions', 'laureat_id'], ['mentorships', 'mentor_id'], ['mentorships', 'student_id'], ['answers', 'author_id'], ['questions', 'author_id']])
    assert.ok(idx.some(d => d.startsWith(t + '.') && new RegExp(`\\(${c}\\)`).test(d)), `index ${t}(${c})`);
  // Promo 2030 Génie Industriel : un membre sans activité
  const F = uid(48);
  await creerCompte(db, { id: F, full_name: 'Lauréat Foxtrot', role: 'laureat', filiere: GI, promo: 2030 });
  await db.query('update public.profiles set consent_at = now() where id = $1', [F]);
  assert.equal(await proposer(F), 0);
  assert.equal((await db.query(`select count(*)::int n from public.ambassadeurs_passages where promo = 2030`)).rows[0].n, 1);
  await offre(F);
  assert.equal(await proposer(F), 0, 'recalculé au plus une fois par heure');
  await db.query(`update public.ambassadeurs_passages set at = now() - interval '61 minutes' where promo = 2030`);
  assert.equal(await proposer(F), 1);
  await assert.rejects(q(F, 'select * from public.ambassadeurs_passages'), /permission denied/);
  const droits = r => db.query(`select privilege_type from information_schema.role_table_grants where table_name = 'ambassadeurs' and grantee = $1 order by 1`, [r]).then(x => x.rows.map(y => y.privilege_type));
  assert.deepEqual(await droits('authenticated'), ['INSERT', 'SELECT', 'UPDATE']);
  assert.deepEqual(await droits('anon'), []);
});

test('se connecter seulement ne suffit pas : la connexion récente ne compte que pour qui a déjà agi', async () => {
  const [G, H] = [uid(49), uid(50)];
  for (const [id, nom] of [[G, 'Lauréat Golf'], [H, 'Lauréat Hotel']]) {
    await creerCompte(db, { id, full_name: nom, role: 'laureat', filiere: GC, promo: 2031 });
    await db.query('update public.profiles set consent_at = now() where id = $1', [id]);
    await db.query('update auth.users set last_sign_in_at = now() where id = $1', [id]);
  }
  const cands = () => en(db, null, tx => tx.query(`select id, score from public.ambassadeur_candidats(2031, $1)`, [GC]), { role: 'service_role' }).then(r => r.rows.map(x => [x.id, x.score]));
  assert.deepEqual(await cands(), []);
  assert.equal(await proposer(G), 0);
  await offre(H);
  assert.deepEqual(await cands(), [[H, 5]], '3 (offre) + 2 (connexion récente)');
  const data = { profiles: [{ id: 'g', promo: 2031, filiere: GC, role: 'laureat' }, { id: 'h', promo: 2031, filiere: GC, role: 'laureat' }], offers: [{ author_id: 'h' }] };
  assert.deepEqual(candidatsAmbassadeur(data, 2031, GC).map(x => [x.id, x.score]), [['h', 3]], 'logic.js : même ordre, sans la connexion');
});

test('relançable depuis la base de 70bc2b2, deux fois', async t => {
  let ancien;
  try { ancien = execFileSync('git', ['show', '70bc2b2:source/supabase/schema.sql'], { cwd: new URL('.', import.meta.url).pathname, encoding: 'utf8', maxBuffer: 64e6, stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return t.skip('historique git indisponible'); }
  const vieille = await nouvelleBase(null);
  await vieille.exec(ancien.replace(/^create extension if not exists pgcrypto;$/m, ''));
  await creerCompte(vieille, { id: uid(1), full_name: 'Lauréat Existant', role: 'laureat', filiere: GC, promo: 2015 });
  const nouveau = fs.readFileSync(SCHEMA, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, '');
  await vieille.exec(nouveau);
  await vieille.exec(nouveau);
  const cols = (await vieille.query(`select column_name from information_schema.columns where table_name = 'ambassadeurs' and column_name in ('retire_par','statut_avant') order by 1`)).rows.map(r => r.column_name);
  assert.deepEqual(cols, ['retire_par', 'statut_avant']);
  assert.equal((await vieille.query(`select count(*)::int n from pg_trigger where tgname in ('trg_protect_ambassadeur','trg_protect_ambassadeur_insert','trg_ambassadeur_change_groupe')`)).rows[0].n, 3);
  assert.equal((await vieille.query('select count(*)::int n from public.profiles')).rows[0].n, 1);
});
