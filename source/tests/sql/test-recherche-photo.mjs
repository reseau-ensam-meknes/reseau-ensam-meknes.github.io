// Lauréats qui cherchent un emploi (alertes d'offres) et photo de profil (stockage privé « photos »)
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const CHERCHE = uid(81), EN_POSTE = uid(82), RECRUTEUR = uid(83), ETU = uid(84), ADMIN = uid(85);
const GI = 'Génie Industriel';
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const refuse = async (promesse, re) => { await assert.rejects(promesse, e => (re ? re.test(e.message) : true) || assert.fail(e.message)); };

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: CHERCHE, full_name: 'Halima Cherche', role: 'laureat', filiere: GI, promo: 2019 });
  await creerCompte(db, { id: EN_POSTE, full_name: 'Karim Poste', role: 'laureat', filiere: GI, promo: 2019, entreprise: 'OCP' });
  await creerCompte(db, { id: RECRUTEUR, full_name: 'Youssef Recrute', role: 'laureat', filiere: GI, promo: 2012, entreprise: 'Renault' });
  await creerCompte(db, { id: ETU, full_name: 'Salma Etudiante', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: ADMIN, full_name: 'Admin École', role: 'etudiant', filiere: GI, promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://push.example/' || id, 'k', 'a' from public.profiles`);
});

test('« Je cherche un emploi » : visible des autres membres, les offres « Jeunes diplômés » et entre lauréats lui arrivent comme pour lui', async () => {
  assert.equal((await q(CHERCHE, 'select en_recherche from public.profils where id = $1', [CHERCHE]))[0].en_recherche, false);
  await q(CHERCHE, 'update public.profiles set en_recherche = true where id = $1', [CHERCHE]);
  assert.equal((await q(RECRUTEUR, 'select en_recherche from public.profils where id = $1', [CHERCHE]))[0].en_recherche, true);
  await db.query('delete from public.push_queue');
  await q(RECRUTEUR, `insert into public.offers (author_id, type, titre, entreprise, description, annees, filieres) values ($1, 'emploi', 'Ingénieur méthodes junior', 'Renault', 'desc', '{6}', '{}')`, [RECRUTEUR]);
  await q(RECRUTEUR, `insert into public.offers (author_id, type, titre, entreprise, description, annees, filieres, audience) values ($1, 'emploi', 'Responsable qualité', 'Renault', 'desc', '{}', '{}', 'laureats')`, [RECRUTEUR]);
  await q(RECRUTEUR, `insert into public.offers (author_id, type, titre, entreprise, description, annees, filieres) values ($1, 'pfe', 'PFE Lean', 'Renault', 'desc', '{5}', '{}')`, [RECRUTEUR]);
  await q(RECRUTEUR, `insert into public.offers (author_id, type, titre, entreprise, description, annees, filieres) values ($1, 'emploi', 'Ingénieur structures', 'Vinci', 'desc', '{6}', '{"Génie Civil"}')`, [RECRUTEUR]);
  // Chaque lauréat reçoit toutes les offres de sa filière ; « relayer » : celles qui ne le visent pas (il peut les faire suivre)
  const pour = async id => (await db.query(`select data->>'titre' || coalesce(' / ' || (data->>'pour'), '') t from public.push_queue where kind = 'offre_alerte' and user_id = $1 order by t`, [id])).rows.map(r => r.t);
  assert.deepEqual(await pour(CHERCHE), ['Ingénieur méthodes junior', 'PFE Lean / relayer', 'Responsable qualité']);
  assert.deepEqual(await pour(EN_POSTE), ['Ingénieur méthodes junior / relayer', 'PFE Lean / relayer', 'Responsable qualité / relayer'], 'un lauréat en poste les reçoit aussi, pour les faire suivre');
  assert.deepEqual(await pour(ETU), ['PFE Lean']);
  // Emploi trouvé : il décoche, les offres d'emploi arrivent encore, à faire suivre
  await q(CHERCHE, 'update public.profiles set en_recherche = false where id = $1', [CHERCHE]);
  await db.query('delete from public.push_queue');
  await q(RECRUTEUR, `insert into public.offers (author_id, type, titre, entreprise, description, annees, filieres) values ($1, 'emploi', 'Ingénieur maintenance', 'Renault', 'desc', '{6}', '{}')`, [RECRUTEUR]);
  assert.deepEqual(await pour(CHERCHE), ['Ingénieur maintenance / relayer']);
});

test('photo de profil : dans son propre dossier, vue par les membres connectés, retirée par soi ou par l’administration', async () => {
  const b = (await db.query(`select public, file_size_limit::int as l, allowed_mime_types m from storage.buckets where id = 'photos'`)).rows[0];
  assert.deepEqual([b.public, b.l, b.m], [false, 1048576, ['image/jpeg', 'image/png', 'image/webp']]);
  const chemin = `${CHERCHE}/photo-1730000000000.webp`;
  await q(CHERCHE, `insert into storage.objects (bucket_id, name, owner) values ('photos', $1, $2)`, [chemin, CHERCHE]);
  await refuse(q(CHERCHE, `insert into storage.objects (bucket_id, name, owner) values ('photos', $1, $2)`, [`${ETU}/photo-1.webp`, CHERCHE]), /row-level security/);
  await refuse(q(CHERCHE, `insert into storage.objects (bucket_id, name, owner) values ('photos', $1, $2)`, [`${CHERCHE}/photo-2.svg`, CHERCHE]), /row-level security/);
  await q(CHERCHE, 'update public.profiles set photo_path = $2 where id = $1', [CHERCHE, chemin]);
  await refuse(q(CHERCHE, 'update public.profiles set photo_path = $2 where id = $1', [CHERCHE, `${ETU}/photo-1.webp`]), /photo_path/);
  await refuse(q(CHERCHE, 'update public.profiles set photo_path = $2 where id = $1', [CHERCHE, `${CHERCHE}/../x.webp`]), /photo_path/);
  assert.equal((await q(ETU, 'select photo_path from public.profils where id = $1', [CHERCHE]))[0].photo_path, chemin);
  assert.equal((await q(ETU, `select name from storage.objects where bucket_id = 'photos'`)).length, 1, 'tout membre connecté la voit');
  assert.equal((await en(db, null, tx => tx.query(`select name from storage.objects where bucket_id = 'photos'`), { role: 'anon' })).rows.length, 0, 'pas sans compte');
  // Un autre membre ne peut ni la retirer ni changer le profil ; l'administration peut (modération)
  await q(ETU, `delete from storage.objects where bucket_id = 'photos' and name = $1`, [chemin]);
  assert.equal((await db.query(`select count(*)::int n from storage.objects where bucket_id = 'photos'`)).rows[0].n, 1);
  await q(ADMIN, 'update public.profiles set photo_path = null where id = $1', [CHERCHE]);
  await q(ADMIN, `delete from storage.objects where bucket_id = 'photos' and name = $1`, [chemin]);
  assert.equal((await db.query(`select count(*)::int n from storage.objects where bucket_id = 'photos'`)).rows[0].n, 0);
  assert.equal((await db.query('select photo_path from public.profiles where id = $1', [CHERCHE])).rows[0].photo_path, null);
});
