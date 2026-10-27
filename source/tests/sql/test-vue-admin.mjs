// L'administration regarde l'application comme un lauréat : son rôle devient « laureat » le temps de cette vue
// (les règles de la base la traitent alors en lauréat), puis elle revient en admin d'un appui grâce à admin_ok.
// Personne d'autre ne se donne admin_ok ni le rôle admin ; l'administration qui retire le rôle admin retire aussi admin_ok.
// En vue lauréat, l'administration ne compte ni dans les chiffres publics, ni parmi les fondateurs, ni parmi les ambassadeurs.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, creerCompte, en, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const [ADM, ADM2, LAU, ETU] = [61, 62, 63, 64].map(uid);
const GI = 'Génie Industriel et Productique';
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const profil = async id => (await db.query('select role, admin_ok, verified from public.profiles where id = $1', [id])).rows[0];
const role = (u, id, r) => q(u, 'update public.profiles set role = $2 where id = $1', [id, r]);
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ADM, full_name: 'Admin Plateforme', role: 'etudiant', filiere: GI, promo: 2026 });
  await creerCompte(db, { id: ADM2, full_name: 'Second Admin', role: 'etudiant', filiere: GI, promo: 2012 });
  await creerCompte(db, { id: LAU, full_name: 'Youssef Amrani', role: 'laureat', filiere: GI, promo: 2015, entreprise: 'OCP' });
  await creerCompte(db, { id: ETU, full_name: 'Salma Bennani', role: 'etudiant', filiere: GI, promo: S + 1 });
  // Comme dans l'éditeur SQL de Supabase : le rôle admin donné à la main
  await db.query(`update public.profiles set role = 'admin', verified = true where id = any($1)`, [[ADM, ADM2]]);
});

test('le rôle admin donné depuis l’éditeur SQL donne admin_ok ; la mise à jour le rattrape pour un admin existant', async () => {
  assert.deepEqual(await profil(ADM), { role: 'admin', admin_ok: true, verified: true });
  await db.exec('alter table public.profiles disable trigger trg_protect_profile');
  await db.query('update public.profiles set admin_ok = false where id = $1', [ADM2]);
  await db.exec('alter table public.profiles enable trigger trg_protect_profile');
  await db.query(`update public.profiles set admin_ok = true where role = 'admin' and not admin_ok`);
  assert.equal((await profil(ADM2)).admin_ok, true);
});

test('vue lauréat : l’admin devient lauréat (vérifié), agit comme un lauréat, puis revient en admin', async () => {
  await role(ADM, ADM, 'laureat');
  assert.deepEqual(await profil(ADM), { role: 'laureat', admin_ok: true, verified: true });
  assert.equal((await q(ADM, 'select public.is_admin() x'))[0].x, false);
  // Une règle réservée aux lauréats : choisir le profil d'un étudiant dans Match
  await q(ADM, `insert into public.match_choix (cible_profil, choix) values ($1, 'oui')`, [ETU]);
  // Le chiffre que voit chacun : l'admin n'y est pas, même en vue lauréat
  const vue = (await q(LAU, 'select admin_ok from public.profils where id = $1', [ADM]))[0];
  assert.equal(vue.admin_ok, true);
  await role(ADM, ADM, 'admin');
  assert.deepEqual(await profil(ADM), { role: 'admin', admin_ok: true, verified: true });
  assert.equal((await q(ADM, 'select public.is_admin() x'))[0].x, true);
});

test('un lauréat ne se fait ni admin ni admin_ok', async () => {
  await role(LAU, LAU, 'admin');
  await q(LAU, 'update public.profiles set admin_ok = true where id = $1', [LAU]);
  assert.deepEqual(await profil(LAU), { role: 'laureat', admin_ok: false, verified: false });
  // Ni à l'inscription
  const NOUVEAU = uid(65);
  await creerCompte(db, { id: NOUVEAU, full_name: 'Nouveau Compte', role: 'laureat', filiere: GI, promo: 2018 });
  await q(NOUVEAU, 'update public.profiles set role = $2, admin_ok = true where id = $1', [NOUVEAU, 'admin']);
  assert.deepEqual(await profil(NOUVEAU), { role: 'laureat', admin_ok: false, verified: false });
});

test('l’administration qui retire le rôle admin retire aussi le retour (admin_ok)', async () => {
  await role(ADM, LAU, 'admin');
  assert.equal((await profil(LAU)).admin_ok, true);
  await role(ADM, LAU, 'laureat');
  assert.equal((await profil(LAU)).admin_ok, false);
  await role(LAU, LAU, 'admin');
  assert.equal((await profil(LAU)).role, 'laureat');
  // Un second admin en vue lauréat, passé en étudiant par l'administration : il ne revient plus
  await role(ADM2, ADM2, 'laureat');
  await role(ADM, ADM2, 'etudiant');
  await role(ADM2, ADM2, 'admin');
  const p = await profil(ADM2);
  assert.deepEqual([p.role, p.admin_ok], ['etudiant', false]);
});

test('en vue lauréat, l’admin ne compte ni dans les chiffres publics, ni parmi les fondateurs, ni parmi les ambassadeurs', async () => {
  const avant = (await q(null, 'select public.chiffres_publics() x'))[0].x;
  await q(ADM, `insert into public.offers (author_id, type, titre, entreprise, description, annees, audience, status) values ($1, 'pfe', 'PFE de test', 'ENSAM', 'Une vraie mission.', '{5}', 'etudiants', 'ouverte')`, [ADM]);
  await role(ADM, ADM, 'laureat');
  const apres = (await q(null, 'select public.chiffres_publics() x'))[0].x;
  assert.equal(apres.laureats, avant.laureats);
  const fondateurs = (await db.query('select id from public.fondateurs_classement()')).rows.map(r => r.id);
  assert.ok(!fondateurs.includes(ADM));
  await db.query(`update public.profiles set consent_at = now() where id = $1`, [ADM]);
  const candidats = (await db.query('select id from public.ambassadeur_candidats($1, $2)', [2026, GI])).rows.map(r => r.id);
  assert.ok(!candidats.includes(ADM));
  await role(ADM, ADM, 'admin');
});
