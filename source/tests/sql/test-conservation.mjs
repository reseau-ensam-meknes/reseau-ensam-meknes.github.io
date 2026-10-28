// Durées de conservation : comptes sans connexion pendant 3 ans (email 30 jours avant, puis suppression),
// réponses à l'enquête détachées 3 ans après le diplôme, liste officielle effacée le 1er septembre
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, creerCompte, en, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const ABSENT = uid(81), ARABE = uid(82), RECENT = uid(83), REVENU = uid(84), ADMIN = uid(85), SANS_PROFIL = uid(86), VISITEUR = uid(87);
const service = (sql, p) => en(db, null, tx => tx.query(sql, p), { role: 'service_role' }).then(r => r.rows);
const vieillir = (id, jours, visite = null) => db.query(`update auth.users set created_at = now() - make_interval(days => $2), last_sign_in_at = now() - make_interval(days => $2) where id = $1`, [id, jours])
  .then(() => visite === null ? null : db.query(`insert into public.visites (user_id, vu_at) values ($1, now() - make_interval(days => $2)) on conflict (user_id) do update set vu_at = excluded.vu_at`, [id, visite]));
const aPrevenir = async () => (await service('select * from public.comptes_inactifs_a_prevenir(100)')).map(x => [x.id, x.langue]);
const existe = async id => (await db.query('select (select count(*) from auth.users where id = $1)::int + (select count(*) from public.profiles where id = $1)::int n', [id])).rows[0].n;
const ANS = 365 * 3 + 1;

before(async () => {
  db = await nouvelleBase(SCHEMA);
  const profil = (id, x = {}) => creerCompte(db, { id, full_name: 'Membre ' + id.slice(-2), role: 'laureat', filiere: 'Génie Mécanique', promo: 2018, ...x });
  await profil(ABSENT); await profil(ARABE, { langue: 'ar' }); await profil(RECENT); await profil(REVENU); await profil(ADMIN); await profil(VISITEUR);
  await db.query(`update public.profiles set role = 'admin', verified = true where id = $1`, [ADMIN]);
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'sans.profil@exemple.ma', '{"langue": "ar"}')`, [SANS_PROFIL]);
  await vieillir(ABSENT, ANS); await vieillir(ARABE, ANS - 20); await vieillir(RECENT, ANS - 40); await vieillir(REVENU, ANS);
  await vieillir(ADMIN, ANS); await vieillir(SANS_PROFIL, ANS + 100);
  await vieillir(VISITEUR, ANS, 2);  // connecté il y a 3 ans, mais il ouvre l'application chaque semaine
});

test('prévenus : absents depuis 3 ans moins 30 jours, dans leur langue ; ni l’administration, ni ceux qui viennent encore', async () => {
  assert.deepEqual(await aPrevenir(), [[SANS_PROFIL, 'ar'], [ABSENT, 'fr'], [REVENU, 'fr'], [ARABE, 'ar']]);
});

test('un compte n’est jamais supprimé sans email parti 30 jours avant', async () => {
  await vieillir(ABSENT, ANS + 400);
  assert.equal((await service('select public.purger_comptes_inactifs() n'))[0].n, 0);
  assert.equal(await existe(ABSENT), 2);
});

test('prévenu une fois ; supprimé 30 jours après s’il n’est pas revenu ; une visite le garde', async () => {
  await service('select public.comptes_inactifs_prevenus($1)', [[ABSENT, REVENU, ADMIN, uid(99)]]);
  assert.deepEqual((await aPrevenir()).map(x => x[0]), [SANS_PROFIL, ARABE], 'pas deux emails');
  assert.equal((await service('select count(*)::int n from public.comptes_prevenus'))[0].n, 3, 'un identifiant inconnu est ignoré');
  assert.equal((await service('select public.purger_comptes_inactifs() n'))[0].n, 0, 'pas avant 30 jours');
  await db.query(`update public.comptes_prevenus set prevenu_at = now() - interval '31 days'`);
  await db.query(`insert into public.visites (user_id, vu_at) values ($1, now() - interval '3 days')`, [REVENU]);
  assert.equal((await service('select public.purger_comptes_inactifs() n'))[0].n, 1);
  assert.equal(await existe(ABSENT), 0, 'le compte et le profil');
  assert.equal(await existe(REVENU), 2, 'revenu après l’email : gardé');
  assert.equal(await existe(ADMIN), 2, 'l’administration n’est jamais supprimée');
  assert.equal((await service('select count(*)::int n from public.comptes_prevenus where user_id = $1', [ABSENT]))[0].n, 0, 'la trace part avec le compte');
});

test('revenu puis de nouveau absent 3 ans : prévenu à nouveau', async () => {
  await db.query(`update public.visites set vu_at = now() - make_interval(days => $2) where user_id = $1`, [REVENU, ANS - 10]);
  await db.query(`update public.comptes_prevenus set prevenu_at = now() - make_interval(days => $2) where user_id = $1`, [REVENU, ANS + 20]);
  assert.ok((await aPrevenir()).some(x => x[0] === REVENU));
  assert.equal((await service('select public.purger_comptes_inactifs() n'))[0].n, 0, 'jamais sur un ancien email');
});

test('enquête : détachée du compte 3 ans après le diplôme, sans entreprise, ville ni commentaire ; les chiffres restent', async () => {
  const an = new Date().getUTCFullYear(), mois = new Date().getUTCMonth() + 1;
  const vieille = mois >= 9 ? an - 3 : an - 4, jeune = an - 1;
  const rep = (id, promo) => db.query(`insert into public.enquetes_insertion (user_id, vague, promo, filiere, situation, entreprise, ville, pays, commentaire, satisfaction)
    values ($1, 12, $2, 'Génie Mécanique', 'emploi', 'OCP', 'Safi', 'Maroc', 'Merci', 4)`, [id, promo]);
  await rep(VISITEUR, vieille); await rep(RECENT, jeune);
  assert.equal((await service('select public.anonymiser_enquetes() n'))[0].n, 1);
  const rows = (await db.query('select user_id, promo, situation, entreprise, ville, pays, commentaire, satisfaction from public.enquetes_insertion order by promo')).rows;
  assert.deepEqual(rows[0], { user_id: null, promo: vieille, situation: 'emploi', entreprise: null, ville: null, pays: 'Maroc', commentaire: null, satisfaction: 4 });
  assert.equal(rows[1].user_id, RECENT); assert.equal(rows[1].entreprise, 'OCP');
  const stats = (await en(db, ADMIN, tx => tx.query('select public.stats_insertion() s'))).rows[0].s;
  assert.ok(stats.some(g => g.promo === vieille && g.n === 1 && g.en_poste === 1), 'la réponse détachée compte encore');
  // Un membre ne peut ni détacher sa réponse ni la reprendre ; le membre ne la voit plus comme la sienne
  await en(db, RECENT, tx => tx.query(`update public.enquetes_insertion set user_id = null where user_id = $1`, [RECENT]));
  assert.equal((await db.query('select count(*)::int n from public.enquetes_insertion where user_id = $1', [RECENT])).rows[0].n, 1);
  assert.equal((await en(db, VISITEUR, tx => tx.query('select * from public.enquetes_insertion'))).rows.length, 0);
});

test('liste officielle : ce qui a été importé avant le dernier 1er septembre est effacé', async () => {
  const d = new Date(), an = d.getUTCFullYear() - (d.getUTCMonth() + 1 < 9 ? 1 : 0);
  await db.query(`insert into public.liste_officielle (nom, promo, created_at) values ('Ancien Import', 2027, $1), ('Nouvel Import', 2027, $2)`,
    [`${an}-08-31T23:00:00Z`, `${an}-09-01T08:00:00Z`]);
  assert.equal((await service('select public.effacer_liste_officielle() n'))[0].n, 1);
  assert.deepEqual((await db.query('select nom from public.liste_officielle')).rows.map(r => r.nom), ['Nouvel Import']);
});

test('chaque jour : la conservation, puis l’email ; personne d’autre n’y touche', async () => {
  const [{ def }] = (await db.query(`select pg_get_functiondef('public.taches_quotidiennes'::regproc) def`)).rows;
  assert.match(def, /conservation_quotidienne\(\)[\s\S]*appeler_notifier\('inactifs'\)/);
  assert.deepEqual(Object.keys((await db.query('select public.conservation_quotidienne() r')).rows[0].r).sort(), ['comptes', 'enquetes', 'liste']);
  for (const f of ['comptes_inactifs_a_prevenir(10)', 'comptes_inactifs_prevenus(array[]::uuid[])', 'purger_comptes_inactifs()', 'anonymiser_enquetes()', 'effacer_liste_officielle()', 'conservation_quotidienne()'])
    await assert.rejects(en(db, ADMIN, tx => tx.query(`select public.${f}`)), /permission denied/, f);
  await assert.rejects(en(db, ADMIN, tx => tx.query('select * from public.comptes_prevenus')), /permission denied/);
});
