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

const refuse = p => assert.rejects(p, /pas dans ton réseau|row-level security/);
test('aucune action vers une autre école par identifiant : message, mentorat, match, candidature, commentaire, invitation', async () => {
  const o = (await db.query(`select id from public.offers where titre = 'PFE Autre'`)).rows[0].id;
  await refuse(q(MEK, `insert into public.messages (author_id, dest_id, body) values ($1, $2, 'Salut')`, [MEK, AUTRE]));
  await refuse(q(MEK, `insert into public.mentorships (student_id, mentor_id, sujet) values ($1, $2, 'CV')`, [MEK, AUTRE]));
  await refuse(q(MEK, `insert into public.match_choix (cible_profil, choix) values ($1, 'oui')`, [AUTRE]));
  await refuse(q(MEK, `insert into public.match_choix (cible_offre, choix) values ($1, 'oui')`, [o]));
  await refuse(q(MEK, `insert into public.applications (student_id, offer_id) values ($1, $2)`, [MEK, o]));
  await refuse(q(MEK, `insert into public.comments (author_id, offer_id, body) values ($1, $2, 'Hop')`, [MEK, o]));
  await refuse(q(MEK2, `insert into public.invitations (laureat_id, student_id) values ($1, $2)`, [MEK2, AUTRE]));
});

test('notifications et listes : rien ne passe d’une école à l’autre', async () => {
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://p/' || id, 'k', 'a' from public.profiles on conflict do nothing`);
  await db.query('delete from public.push_queue');
  await q(ADMIN, `insert into public.annonces (texte) values ('Forum')`);
  const dest = (await db.query(`select user_id from public.push_queue where kind = 'annonce'`)).rows.map(r => r.user_id);
  assert.ok(!dest.includes(AUTRE), 'l’annonce reste dans l’école de qui la publie');
  const [o] = await q(MEK2, `select row_to_json(x) j from public.offers x where titre = 'PFE Meknès'`);
  assert.ok(o, 'offre visible');
  const pour = await db.query(`select public.offre_pour(o, p, public.saison_courante()) v from public.offers o, public.profiles p where o.titre = 'PFE Autre' and p.id = $1`, [MEK]);
  assert.equal(pour.rows[0].v, false);
  await db.query('delete from public.push_queue');
});

test('chiffres, fondateurs et liste officielle : chaque école les siens', async () => {
  const f = async u => (await q(u, 'select public.fondateurs_publics() j'))[0].j.fondateurs.map(z => z.nom);
  assert.ok((await f(MEK2)).includes('Youssef Meknes'));
  assert.ok(!(await f(MEK2)).includes('Karim Autre'));
  assert.deepEqual(await f(AUTRE), ['Karim Autre'], 'la première offre de l’école donne la première place de cette école');
  await db.query(`insert into public.liste_officielle (ecole, nom, promo) values ('autre-ecole', 'Salma Meknes', 2027)`);
  assert.equal((await db.query('select public.dans_liste($1, $2, $3) v', [MEK, 'Salma Meknes', 2027])).rows[0].v, false, 'sur la liste d’une autre école : pas vérifié ici');
  assert.equal((await db.query('select public.dans_liste($1, $2, $3) v', [AUTRE, 'Salma Meknes', 2027])).rows[0].v, true);
  await db.query(`insert into public.liste_officielle (nom, promo) values ('Salma Meknes', 2027)`);
  assert.equal((await db.query(`select count(*)::int n from public.liste_officielle where nom = 'Salma Meknes'`)).rows[0].n, 2, 'même nom, même promo, deux écoles');
});

test('ambassadeurs, enquêtes et cartes sponsorisées : par école', async () => {
  await db.query(`insert into public.ambassadeurs (ecole, promo, filiere, user_id) values ('ensam-meknes', 2015, 'GI', $1), ('autre-ecole', 2015, 'GI', $2)`, [MEK2, AUTRE]);
  const c = await db.query(`select public.chiffres_groupe(2015, 'GI', now() - interval '1 year', 'autre-ecole') j`);
  assert.equal(c.rows[0].j.inscrits, 0, 'Karim est en promo 2016 ; Youssef, de l’autre école, ne compte pas');
  const d = await db.query(`select public.chiffres_groupe(2015, 'GI', now() - interval '1 year', 'ensam-meknes') j`);
  assert.equal(d.rows[0].j.inscrits, 1);
  await db.query(`insert into public.sponsorises (entreprise, titre, texte, lien, debut, fin, ecole) values ('OCP', 'Stage', 'Un texte assez long.', 'https://ocp.ma', current_date, current_date, 'autre-ecole') `).catch(() => {});
  const v = await db.query(`select public.sponsorise_pour(s, p) v from public.sponsorises s, public.profiles p where p.id = $1 limit 1`, [MEK]);
  if (v.rows[0]) assert.equal(v.rows[0].v, false);
  await db.query('delete from public.ambassadeurs');
});

test('relancée, la mise à jour ne perd rien', async () => {
  const sql = (await import('node:fs')).readFileSync(SCHEMA, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, '');
  await db.exec(sql);
  assert.equal((await db.query(`select ecole from public.profiles where id = $1`, [AUTRE])).rows[0].ecole, 'autre-ecole');
  assert.deepEqual(await noms(AUTRE), ['Karim Autre']);
});
