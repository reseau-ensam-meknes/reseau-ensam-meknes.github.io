// Membres fondateurs : fondateurs_publics() classe comme classementFondateurs() de logic.js ; un visiteur sans compte
// ne voit que des totaux, puis le nom et la photo d'un fondateur après son « oui » ; seul le membre lui-même dit oui.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nouvelleBase, creerCompte, en, uid } from './banc-sql.mjs';
import { classementFondateurs } from '../../src/logic.js';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const [HAJEB, SEDKI, TOT, AUTRE, S1, S2, ADM] = [91, 92, 93, 94, 95, 96, 97].map(uid);
const le = (j, h = 9) => new Date(Date.UTC(2026, 9, j, h)).toISOString();
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const anon = (sql, p) => en(db, null, tx => tx.query(sql, p), { role: 'anon' }).then(r => r.rows);
const publics = u => (u ? q(u, 'select public.fondateurs_publics() x') : anon('select public.fondateurs_publics() x')).then(r => r[0].x);
const service = sql => en(db, null, tx => tx.query(sql), { role: 'service_role' }).then(r => r.rows);

before(async () => {
  db = await nouvelleBase(SCHEMA);
  const lau = (id, nom, filiere, promo) => creerCompte(db, { id, full_name: nom, role: 'laureat', filiere, promo });
  await lau(HAJEB, 'Abderrahman Hajeb', 'Génie Mécanique', 2024);
  await lau(SEDKI, 'Hamza Sedki', 'Génie Électromécanique', 2024);
  await lau(TOT, 'Inscrit Tôt', 'Génie Industriel', 2015);
  await lau(AUTRE, 'Autre Lauréat', 'Génie Civil', 2012);
  await creerCompte(db, { id: S1, full_name: 'Salma Etudiante', role: 'etudiant', filiere: 'Génie Civil', promo: 2027 });
  await creerCompte(db, { id: S2, full_name: 'Amine Etudiant', role: 'etudiant', filiere: 'Génie Civil', promo: 2028 });
  await creerCompte(db, { id: ADM, full_name: 'Fondateur Plateforme', role: 'etudiant', filiere: 'Génie Industriel', promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADM]);
  await db.query(`update public.profiles set created_at = $2 where id = $1`, [TOT, le(1)]);
  // Les lignes sont posées telles quelles, à leur date (les règles de saisie sont testées ailleurs)
  await db.exec('set session_replication_role = replica');
  const offre = (auteur, at, audience = 'etudiants', status = 'ouverte') => db.query(`insert into public.offers (author_id, type, titre, entreprise, description, annees, audience, status, created_at) values ($1, 'stage', 'Stage test', 'OCP', 'desc', '{4}', $2, $3, $4)`, [auteur, audience, status, at]);
  await offre(ADM, le(20));                          // l'administration : jamais fondatrice
  await offre(TOT, le(21), 'laureats');              // entre lauréats : ne compte pas
  await offre(HAJEB, le(23, 9));
  await offre(SEDKI, le(23, 11), 'etudiants', 'pourvue');
  await offre(HAJEB, le(24));
  const [d] = (await db.query(`insert into public.demandes (auteur_id, type, titre, details) values ($1, 'pfe', 'PFE génie civil', 'Je cherche un PFE en structures, à Casablanca.') returning id`, [S1])).rows;
  await db.query(`insert into public.propositions (demande_id, laureat_id, aide, entreprise, message, status, created_at) values ($1, $2, 'encadre', 'TGCC', 'Je peux t’encadrer.', 'retiree', $3)`, [d.id, TOT, le(22)]);
  await db.query(`insert into public.propositions (demande_id, laureat_id, aide, entreprise, message, status, created_at) values ($1, $2, 'recommande', 'Vinci', 'Je te recommande.', 'envoyee', $3)`, [d.id, AUTRE, le(25)]);
  await db.query(`insert into public.mentorships (student_id, mentor_id, sujet, status, created_at, accepted_at) values ($1, $2, 'Conseil', 'demande', $3, null)`, [S2, TOT, le(22)]);
  await db.query(`insert into public.mentorships (student_id, mentor_id, sujet, status, created_at, accepted_at) values ($1, $2, 'Conseil', 'acceptee', $3, $4)`, [S2, AUTRE, le(21), le(26)]);
  await db.exec('set session_replication_role = origin');
  // Photos de profil (le stockage « photos » est privé) et un CV qui ne doit jamais s'ouvrir sans compte
  for (const [id, n] of [[HAJEB, '1'], [SEDKI, '2'], [AUTRE, '3']]) {
    await db.query(`insert into storage.objects (bucket_id, name) values ('photos', $1)`, [`${id}/photo-${n}.webp`]);
    await db.query(`update public.profiles set photo_path = $2 where id = $1`, [id, `${id}/photo-${n}.webp`]);
  }
  await db.query(`insert into storage.objects (bucket_id, name) values ('cv', $1)`, [`${HAJEB}/cv.pdf`]);
});

test('fondateurs_publics : le même classement que l’appli (première aide aux étudiants, jamais l’administration)', async () => {
  const x = await publics(S1);
  assert.equal(x.total, 3); assert.equal(x.places, 22); assert.equal(x.max, 25);
  assert.deepEqual(x.fondateurs.map(f => [f.id, f.rang, f.type]), [[HAJEB, 1, 'offre'], [SEDKI, 2, 'offre'], [AUTRE, 3, 'aide']]);
  assert.equal(x.fondateurs[0].nom, 'Abderrahman Hajeb');
  assert.equal(new Date(x.fondateurs[0].at).toISOString(), le(23, 9));
  // Les mêmes lignes, lues par le service, passées au calcul de l'appli
  const [profiles, offers, demandes, propositions, mentorships] = await Promise.all(['profiles', 'offers', 'demandes', 'propositions', 'mentorships'].map(t => service(`select * from public.${t}`)));
  const iso = rows => rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])));
  const appli = classementFondateurs({ profiles, offers: iso(offers), demandes, propositions: iso(propositions), mentorships: iso(mentorships) });
  assert.deepEqual(appli.map(f => [f.id, f.rang, f.type, f.at]), x.fondateurs.map(f => [f.id, f.rang, f.type, new Date(f.at).toISOString()]));
  assert.equal(x.mon_choix, null, 'pas encore demandé');
  // Le classement brut n'est pas ouvert
  await assert.rejects(anon('select * from public.fondateurs_classement()'), /permission denied/);
  await assert.rejects(q(S1, 'select * from public.fondateurs_classement()'), /permission denied/);
});

test('visiteur sans compte : les totaux seulement, puis le nom et la photo d’un fondateur qui a dit oui', async () => {
  let x = await publics(null);
  assert.deepEqual([x.total, x.places, x.fondateurs.length], [3, 22, 0]);
  assert.equal(x.mon_choix, null);
  assert.deepEqual(await anon(`select name from storage.objects`), [], 'aucune photo lisible');
  // Hajeb dit oui (dans l'appli, sa propre ligne)
  await q(HAJEB, 'update public.profiles set fondateur_public = true where id = $1', [HAJEB]);
  assert.equal((await publics(HAJEB)).mon_choix, true);
  x = await publics(null);
  assert.equal(x.total, 3);
  assert.deepEqual(x.fondateurs, [{ id: null, rang: 1, type: 'offre', at: x.fondateurs[0].at, nom: 'Abderrahman Hajeb', filiere: 'Génie Mécanique', promo: 2024, photo: `${HAJEB}/photo-1.webp`, verifie: false }]);
  assert.deepEqual((await anon(`select name from storage.objects order by name`)).map(r => r.name), [`${HAJEB}/photo-1.webp`], 'sa photo seulement, jamais son CV ni les autres');
  // Une nouvelle photo : l'ancienne n'est plus lisible
  await db.query(`insert into storage.objects (bucket_id, name) values ('photos', $1)`, [`${HAJEB}/photo-11.webp`]);
  await q(HAJEB, 'update public.profiles set photo_path = $2 where id = $1', [HAJEB, `${HAJEB}/photo-11.webp`]);
  assert.deepEqual((await anon(`select name from storage.objects order by name`)).map(r => r.name), [`${HAJEB}/photo-11.webp`]);
  // Un membre connecté voit toujours tous les fondateurs
  assert.equal((await publics(S2)).fondateurs.length, 3);
  // Il change d'avis : plus rien
  await q(HAJEB, 'update public.profiles set fondateur_public = false where id = $1', [HAJEB]);
  assert.equal((await publics(null)).fondateurs.length, 0);
  assert.deepEqual(await anon(`select name from storage.objects`), []);
});

test('le oui vient du membre : l’administration peut le retirer de la page d’entrée, jamais l’y mettre', async () => {
  await q(ADM, 'update public.profiles set fondateur_public = true where id = $1', [SEDKI]);
  assert.equal((await db.query('select fondateur_public from public.profiles where id = $1', [SEDKI])).rows[0].fondateur_public, null);
  await q(SEDKI, 'update public.profiles set fondateur_public = true where id = $1', [SEDKI]);
  assert.deepEqual((await publics(null)).fondateurs.map(f => f.nom), ['Hamza Sedki']);
  await q(ADM, 'update public.profiles set fondateur_public = false where id = $1', [SEDKI]);
  assert.equal((await publics(null)).fondateurs.length, 0);
  // Un autre membre ne touche pas au profil de quelqu'un d'autre (règle déjà là)
  await q(S1, 'update public.profiles set fondateur_public = true where id = $1', [SEDKI]);
  assert.equal((await db.query('select fondateur_public from public.profiles where id = $1', [SEDKI])).rows[0].fondateur_public, false);
});

test('un fondateur qui sort du classement (offre supprimée) n’est plus public ; 25 au plus ; relançable', async () => {
  await q(HAJEB, 'update public.profiles set fondateur_public = true where id = $1', [HAJEB]);
  assert.equal((await publics(null)).fondateurs.length, 1);
  await db.query('delete from public.offers where author_id = $1', [HAJEB]);
  const x = await publics(null);
  assert.deepEqual([x.total, x.fondateurs.length], [2, 0]);
  assert.deepEqual(await anon(`select name from storage.objects`), []);
  // 30 lauréats qui publient : 25 fondateurs, 0 place
  await db.exec('set session_replication_role = replica');
  for (let i = 0; i < 30; i++) {
    const id = uid(200 + i);
    await db.query('insert into auth.users (id, email) values ($1, $2)', [id, `l${i}@exemple.ma`]);
    await db.query(`insert into public.profiles (id, full_name, role, filiere, promo) values ($1, $2, 'laureat', 'Génie Civil', 2015)`, [id, `Lauréat ${i}`]);
    await db.query(`insert into public.offers (author_id, type, titre, entreprise, description, annees, created_at) values ($1, 'stage', 'Stage test', 'OCP', 'desc', '{4}', $2)`, [id, le(1, i % 24)]);
  }
  await db.exec('set session_replication_role = origin');
  const y = await publics(S1);
  assert.deepEqual([y.total, y.places, y.fondateurs.length], [25, 0, 25]);
  assert.ok(!y.fondateurs.some(f => f.id === SEDKI), 'arrivé après 25 autres');
  // schema.sql relancé : rien ne casse, les choix restent
  await db.exec(fs.readFileSync(SCHEMA, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, ''));
  assert.equal((await db.query('select fondateur_public from public.profiles where id = $1', [HAJEB])).rows[0].fondateur_public, true);
  assert.equal((await publics(null)).total, 25);
});
