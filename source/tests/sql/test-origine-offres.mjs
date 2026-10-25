// Origine des offres : un lauréat porte une offre de son entreprise (il encadre) ; tout membre partage une offre vue
// ailleurs, avec son lien ; un étudiant ne publie que des partages. Anti-spam des partages, fermeture après 45 jours,
// et l'alerte push dit d'où vient l'offre.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nouvelleBase, creerCompte, en, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
const saison = () => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; };
let db; const LAU = uid(1101), ETU = uid(1102), ETU2 = uid(1103), ADM = uid(1104), LAU2 = uid(1191), ETU3 = uid(1192);

before(async () => {
  db = await nouvelleBase(SCHEMA);
  // La mise à jour se rejoue sans erreur
  await db.exec(fs.readFileSync(SCHEMA, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, ''));
  const s = saison();
  await creerCompte(db, { id: LAU, full_name: 'Lauréate Origine', role: 'laureat', filiere: 'Génie Industriel', promo: 2015 });
  await creerCompte(db, { id: ETU, full_name: 'Étudiant Origine', role: 'etudiant', filiere: 'Génie Industriel', promo: s + 2 });
  await creerCompte(db, { id: ETU2, full_name: 'Étudiante Alerte', role: 'etudiant', filiere: 'Génie Industriel', promo: s + 2 });
  await creerCompte(db, { id: ADM, full_name: 'Admin Origine', role: 'etudiant', filiere: 'Génie Industriel', promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADM]);
  await creerCompte(db, { id: LAU2, full_name: 'Lauréat Partage', role: 'laureat', filiere: 'Génie Industriel', promo: 2016 });
  await creerCompte(db, { id: ETU3, full_name: 'Étudiant Relecture', role: 'etudiant', filiere: 'Génie Industriel', promo: s + 2 });
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.exemple/e2', 'k', 'a')`, [ETU2]);
});

const n = (k = 0) => `Offre d’essai numéro ${k}`;
const publier = (u, champs) => en(db, u, tx => tx.query(
  `insert into public.offers (author_id, type, titre, entreprise, description, annees, origine, lien, cooptation, audience)
   values ($1, $2, $3, $4, 'Missions et profil.', $5, $6, $7, $8, $9) returning *`,
  [u, champs.type || 'stage', champs.titre || n(Math.random()), champs.entreprise || 'Entreprise Test', champs.annees || '{4}', champs.origine ?? null, champs.lien ?? null, champs.cooptation ?? false, champs.audience || 'etudiants'])).then(r => r.rows[0]);
const refus = async (p, re) => { const e = await p.then(() => null, x => x); assert.ok(e, 'devait être refusé'); assert.match(e.message, re); };

test('un étudiant ne publie qu’une offre partagée, avec un lien http(s)', async () => {
  await refus(publier(ETU, {}), /Un étudiant partage une offre vue ailleurs/);
  await refus(publier(ETU, { origine: 'portee' }), /Seul un lauréat peut porter/);
  await refus(publier(ETU, { origine: 'partagee' }), /Ajoute le lien/);
  await refus(publier(ETU, { origine: 'partagee', lien: 'linkedin.com/jobs/view/1' }), /Ajoute le lien/);
  await refus(publier(ETU, { origine: 'partagee', lien: 'javascript:alert(1)' }), /Ajoute le lien/);
  await refus(publier(ETU, { origine: 'partagee', lien: 'https://exemple.ma/a', audience: 'laureats' }), /Un étudiant partage/);
  const o = await publier(ETU, { origine: 'partagee', lien: '  https://www.linkedin.com/jobs/view/123  ', cooptation: true });
  assert.equal(o.origine, 'partagee');
  assert.equal(o.lien, 'https://www.linkedin.com/jobs/view/123', 'lien nettoyé');
  assert.equal(o.cooptation, false, 'un partage ne promet pas de cooptation');
  // Le même lien, encore ouvert : une seule fois sur le réseau (même par quelqu’un d’autre)
  await refus(publier(LAU, { origine: 'partagee', lien: 'https://www.linkedin.com/jobs/view/123/' }), /déjà partagée/);
  // Un partage reste un partage
  await refus(en(db, ETU, tx => tx.query(`update public.offers set origine = null where id = $1`, [o.id])), /reste un partage/);
  await refus(en(db, ETU, tx => tx.query(`update public.offers set lien = 'pas un lien' where id = $1`, [o.id])), /Ajoute le lien/);
  await en(db, ETU, tx => tx.query(`update public.offers set status = 'fermee' where id = $1`, [o.id]));
});

test('un lauréat porte une offre de son entreprise, publie une offre classique ou partage', async () => {
  const p = await publier(LAU, { origine: 'portee', cooptation: true });
  assert.equal(p.origine, 'portee'); assert.equal(p.cooptation, true);
  const c = await publier(LAU, {});
  assert.equal(c.origine, null, 'classique : rien n’est affirmé');
  // Une offre classique peut devenir portée (le lauréat le confirme), et revenir classique ; jamais un partage
  await en(db, LAU, tx => tx.query(`update public.offers set origine = 'portee' where id = $1`, [c.id]));
  await en(db, LAU, tx => tx.query(`update public.offers set origine = null where id = $1`, [c.id]));
  await refus(en(db, LAU, tx => tx.query(`update public.offers set origine = 'partagee', lien = 'https://exemple.ma/x' where id = $1`, [c.id])), /reste un partage/);
  const s = await publier(LAU, { origine: 'partagee', lien: 'https://careers.exemple.ma/offre/7', audience: 'laureats' });
  assert.equal(s.origine, 'partagee');
  await refus(publier(LAU, { origine: 'autre' }), /offers_origine_check|violates check/);
});

test('l’administration peut tout, et une offre d’avant reste sans origine', async () => {
  const a = await publier(ADM, { origine: 'portee' });
  assert.equal(a.origine, 'portee');
  const vieille = await db.query(`insert into public.offers (author_id, type, titre, entreprise, description, annees) values ($1, 'stage', 'Ancienne offre', 'X', 'd', '{4}') returning origine`, [LAU]);
  assert.equal(vieille.rows[0].origine, null);
});

test('anti-spam : 5 offres par jour quand on partage, et pas deux fois le même lien', async () => {
  const E = uid(1105);
  await creerCompte(db, { id: E, full_name: 'Étudiant Pressé', role: 'etudiant', filiere: 'Génie Industriel', promo: saison() + 2 });
  for (let i = 0; i < 5; i++) await publier(E, { origine: 'partagee', lien: `https://exemple.ma/spam/${i}`, titre: n(100 + i) });
  await refus(publier(E, { origine: 'partagee', lien: 'https://exemple.ma/spam/9', titre: n(200) }), /Doucement/);
});

test('fermeture : un partage sans date limite après 45 jours, un partage dont la date limite est passée', async () => {
  const L2 = uid(1106);
  await creerCompte(db, { id: L2, full_name: 'Lauréat Fermeture', role: 'laureat', filiere: 'Génie Industriel', promo: 2012 });
  const vieux = await publier(L2, { origine: 'partagee', lien: 'https://exemple.ma/vieux', titre: n(300) });
  const recent = await publier(L2, { origine: 'partagee', lien: 'https://exemple.ma/recent', titre: n(301) });
  const passe = await publier(L2, { origine: 'partagee', lien: 'https://exemple.ma/passe', titre: n(302) });
  const classique = await publier(L2, { titre: n(303) });
  await db.query(`update public.offers set created_at = now() - interval '46 days' where id = any($1)`, [[vieux.id, classique.id]]);
  await db.query(`update public.offers set deadline = current_date - 1 where id = $1`, [passe.id]);
  const r = await db.query('select public.fermer_partages_anciens() n');
  assert.equal(r.rows[0].n, 2);
  const st = async id => (await db.query('select status from public.offers where id = $1', [id])).rows[0].status;
  assert.equal(await st(vieux.id), 'fermee'); assert.equal(await st(passe.id), 'fermee');
  assert.equal(await st(recent.id), 'ouverte'); assert.equal(await st(classique.id), 'ouverte', 'une offre classique ne se ferme pas seule');
});

test('alerte push : l’origine de l’offre part avec la notification', async () => {
  await db.query('delete from public.push_queue');
  const p = await publier(LAU, { origine: 'portee', titre: n(400), annees: '{4}' });
  // (le partage d'un lauréat ; celui d'un étudiant n'envoie pas de notification, voir « relecture » plus bas)
  const s = await publier(LAU2, { origine: 'partagee', lien: 'https://exemple.ma/alerte', titre: n(401), annees: '{4}' });
  const q = await db.query(`select data from public.push_queue where user_id = $1 and kind = 'offre_alerte'`, [ETU2]);
  const par = Object.fromEntries(q.rows.map(r => [r.data.offre, r.data.origine]));
  assert.equal(par[p.id], 'portee'); assert.equal(par[s.id], 'partagee');
  // Pas de relance « Ton offre est-elle toujours ouverte ? » pour un partage
  await db.query(`update public.offers set created_at = now() - interval '30 days' where id = any($1)`, [[p.id, s.id]]);
  await db.query('delete from public.push_queue');
  await db.query('select public.relances_offres()');
  const rel = await db.query(`select user_id, data from public.push_queue where kind = 'relance_offre'`);
  assert.ok(!rel.rows.some(r => JSON.stringify(r.data).includes(s.id)), 'aucune relance pour un partage');
});

test('relecture : un partage d’étudiant reste pour son année, sans alerte push ; pas de candidature sur un partage', async () => {
  const o = await publier(ETU3, { origine: 'partagee', lien: 'https://exemple.ma/relecture-1', annees: '{3,4,5,6}' });
  assert.deepEqual(o.annees, [4], 'son année seulement, quelles que soient les années envoyées');
  const pushs = await db.query(`select count(*)::int n from public.push_queue where kind = 'offre_alerte' and data->>'offre' = $1`, [o.id]);
  assert.equal(pushs.rows[0].n, 0, 'le partage d’un étudiant n’envoie pas de notification');
  // Ce que la publication interdit reste interdit après coup
  await refus(en(db, ETU3, tx => tx.query(`update public.offers set audience = 'laureats' where id = $1`, [o.id])), /Un étudiant partage/);
  await en(db, ETU3, tx => tx.query(`update public.offers set annees = '{3,5}' where id = $1`, [o.id]));
  assert.deepEqual((await db.query(`select annees from public.offers where id = $1`, [o.id])).rows[0].annees, [4]);
  // Changer le lien pour un lien déjà partagé et ouvert : refusé
  const autre = await publier(LAU2, { origine: 'partagee', lien: 'https://exemple.ma/relecture-2' });
  await refus(en(db, ETU3, tx => tx.query(`update public.offers set lien = 'https://exemple.ma/relecture-2/' where id = $1`, [o.id])), /déjà partagée/);
  // Une offre partagée se postule sur son site d'origine
  await refus(en(db, ETU2, tx => tx.query(`insert into public.applications (student_id, offer_id) values ($1, $2)`, [ETU2, autre.id])), /site d’origine/);
});
