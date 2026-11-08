// Écoles, finitions : la page d'entrée d'une autre école ouverte (lien ?ecole=…, p_ecole) montre ses chiffres, ses
// fondateurs et leurs photos, jamais ceux de l'ENSAM Meknès ; une école fermée ou inconnue ne montre rien (la même réponse
// qu'une école ouverte où personne n'est encore inscrit) ; une photo n'est lisible sans compte que si son propriétaire l'a
// voulu et que le réseau de SON école est ouvert ; l'invitation nommée ne passe jamais d'une école à l'autre.
// Sans p_ecole (le site d'aujourd'hui, chaque visiteur de l'ENSAM Meknès) : les réponses ne changent pas d'un octet.
// La mise à jour passe deux fois de suite, sur une base de main comme sur une base plus ancienne.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nouvelleBase, creerCompte, en, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
const MAJ = process.env.MAJ_SQL || new URL('../../supabase/mise-a-jour.sql', import.meta.url).pathname;
const AVANT = process.env.SCHEMA_AVANT || new URL('./schema-phase2.sql', import.meta.url).pathname;
const lireSql = chemin => fs.readFileSync(chemin, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, '');
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const le = (j, h = 9) => new Date(Date.UTC(2026, 9, j, h)).toISOString();
// ENSAM Meknès : Youssef, Nadia, Salma, l'administration ; école X : Karim, Omar, Rim, Hiba ; école Y : Amine ;
// une école fermée : Ilyas (son profil y a été créé avant qu'elle ne ferme) ; un compte sans profil encore
const [YOUSSEF, NADIA, SALMA, ADM, KARIM, OMAR, RIM, HIBA, AMINE, ILYAS, SANS_PROFIL] = [1801, 1802, 1803, 1804, 1805, 1806, 1807, 1808, 1809, 1810, 1811].map(uid);

const q = (b, u, sql, p) => en(b, u, tx => tx.query(sql, p)).then(r => r.rows);
const anon = (b, sql, p) => en(b, null, tx => tx.query(sql, p), { role: 'anon' }).then(r => r.rows);
const un = (b, u, sql, p) => (u ? q(b, u, sql, p) : anon(b, sql, p)).then(r => r[0]?.x);
// Comme le site : {} (aucun argument) ou { p_ecole } ; u = null : un visiteur sans compte
const appel = (b, u, f, ecole) => (ecole === undefined ? un(b, u, `select public.${f}() x`) : un(b, u, `select public.${f}(p_ecole => $1) x`, [ecole]));
// Le texte exact que PostgREST renverrait (jsonb : une seule écriture possible)
const brut = (b, u, f, ecole) => (ecole === undefined ? un(b, u, `select public.${f}()::text x`) : un(b, u, `select public.${f}(p_ecole => $1)::text x`, [ecole]));
const photosSansCompte = async b => (await anon(b, `select name from storage.objects where bucket_id = 'photos' order by name`)).map(r => r.name);
const ligne = (b, id) => b.query('select * from public.profiles where id = $1', [id]).then(r => r.rows[0]);
const ouvrir = (b, slug, oui) => b.query('update public.ecoles set ouverte = $2 where slug = $1', [slug, oui]);
const photo = (id, n) => `${id}/photo-${n}.webp`;

// La réponse « rien » : celle d'une école ouverte où personne n'est encore inscrit, rien ne s'affiche
const RIEN_CHIFFRES = { laureats: 0, promos: 0, entreprises: 0 };
const RIEN_FONDATEURS = { max: 25, total: 0, places: 25, mon_choix: null, fondateurs: [] };
const MEKNES = { laureats: 2, promos: 2, entreprises: 2 };
const ECOLE_X = { laureats: 3, promos: 3, entreprises: 2 }; // « Lear » et « Lear Corporation Maroc » : une entreprise

async function peupler(b) {
  await b.query(`insert into public.ecoles (slug, nom, ouverte) values ('ecole-x', 'École X', true), ('ecole-y', 'École Y', true), ('ecole-fermee', 'École fermée', true)`);
  const lau = (id, full_name, filiere, promo, entreprise, ecole) => creerCompte(b, { id, full_name, role: 'laureat', filiere, promo, entreprise, ...(ecole ? { ecole } : {}) });
  await lau(YOUSSEF, 'Youssef Alaoui', 'Génie Mécanique', 2016, 'Renault');
  await lau(NADIA, 'Nadia El Fassi', 'Génie Industriel', 2019, 'OCP');
  await creerCompte(b, { id: SALMA, full_name: 'Salma Bennani', role: 'etudiant', filiere: 'Génie Industriel', promo: S + 1 });
  await lau(ADM, 'Admin Réseau', 'Génie Industriel', 2010, 'ENSAM');
  await b.query(`update public.profiles set role = 'admin' where id = $1`, [ADM]);
  await lau(KARIM, 'Karim Benali', 'Génie Civil', 2012, 'Lear', 'ecole-x');
  await lau(OMAR, 'Omar Tazi', 'Génie Industriel', 2018, 'Lear Corporation Maroc', 'ecole-x');
  await lau(RIM, 'Rim Kabbaj', 'Génie Industriel', 2020, 'Stellantis', 'ecole-x');
  await creerCompte(b, { id: HIBA, full_name: 'Hiba Idrissi', role: 'etudiant', filiere: 'Génie Industriel', promo: S + 1, ecole: 'ecole-x' });
  await lau(AMINE, 'Amine Berrada', 'Génie Mécanique', 2015, 'Safran', 'ecole-y');
  await lau(ILYAS, 'Ilyas Ouali', 'Génie Industriel', 2017, 'Yazaki', 'ecole-fermee');
  await b.query(`insert into auth.users (id, email) values ($1, 'sans-profil@exemple.ma')`, [SANS_PROFIL]);
  // Les premières aides aux étudiants, posées telles quelles à leur date (les règles de saisie sont testées ailleurs)
  await b.exec('set session_replication_role = replica');
  const offre = (auteur, ecole, at) => b.query(`insert into public.offers (author_id, type, titre, entreprise, description, annees, audience, status, created_at, ecole)
    values ($1, 'stage', 'Stage test', 'OCP', 'desc', '{4}', 'etudiants', 'ouverte', $3, $2)`, [auteur, ecole, at]);
  await offre(ADM, 'ensam-meknes', le(8)); // l'administration : jamais fondatrice
  await offre(ILYAS, 'ecole-fermee', le(9)); // la plus ancienne, mais d'une autre école
  await offre(YOUSSEF, 'ensam-meknes', le(10));
  await offre(KARIM, 'ecole-x', le(11));
  await b.query(`insert into public.mentorships (student_id, mentor_id, sujet, status, created_at, accepted_at, ecole) values ($1, $2, 'Conseil', 'acceptee', $3, $3, 'ensam-meknes')`, [SALMA, NADIA, le(12)]);
  const [d] = (await b.query(`insert into public.demandes (auteur_id, type, titre, details, ecole) values ($1, 'pfe', 'PFE qualité', 'Je cherche un PFE en qualité, à Tanger.', 'ecole-x') returning id`, [HIBA])).rows;
  await b.query(`insert into public.propositions (demande_id, laureat_id, aide, entreprise, message, status, created_at) values ($1, $2, 'encadre', 'Lear', 'Je peux t’encadrer.', 'envoyee', $3)`, [d.id, OMAR, le(13)]);
  await b.exec('set session_replication_role = origin');
  // Le stockage « photos » est privé : une photo par lauréat, et une ancienne photo de Karim
  for (const [id, n] of [[YOUSSEF, 1], [NADIA, 2], [KARIM, 3], [OMAR, 4], [RIM, 5], [AMINE, 6], [ILYAS, 7]]) {
    await b.query(`insert into storage.objects (bucket_id, name) values ('photos', $1)`, [photo(id, n)]);
    await b.query('update public.profiles set photo_path = $2 where id = $1', [id, photo(id, n)]);
  }
  await b.query(`insert into storage.objects (bucket_id, name) values ('photos', $1)`, [photo(KARIM, 30)]);
  await b.query('update public.profiles set verified = true where id = any($1)', [[YOUSSEF, NADIA, KARIM, OMAR, RIM, AMINE, ILYAS]]);
  // Le oui de chacun, donné dans l'appli par le membre lui-même. Rim dit oui pour les fondateurs sans figurer au classement.
  for (const id of [YOUSSEF, KARIM, RIM, ILYAS]) await q(b, id, 'update public.profiles set fondateur_public = true where id = $1', [id]);
  for (const id of [YOUSSEF, KARIM, ILYAS]) await q(b, id, 'update public.profiles set vitrine_publique = true where id = $1', [id]);
  await ouvrir(b, 'ecole-fermee', false);
}

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await peupler(db);
});

test('ENSAM Meknès avec {} (le site d’aujourd’hui) : ses chiffres et ses fondateurs, rien d’une autre école', async () => {
  assert.deepEqual(await appel(db, null, 'chiffres_publics'), MEKNES);
  assert.deepEqual(await appel(db, null, 'chiffres_publics', 'ensam-meknes'), MEKNES, 'l’ENSAM Meknès nommée dans le lien : comme sans lien');
  const f = await appel(db, null, 'fondateurs_publics');
  assert.deepEqual([f.max, f.total, f.places, f.mon_choix], [25, 2, 23, null]);
  assert.deepEqual(f.fondateurs, [{ id: null, rang: 1, type: 'offre', at: f.fondateurs[0].at, nom: 'Youssef Alaoui', filiere: 'Génie Mécanique', promo: 2016, photo: photo(YOUSSEF, 1), verifie: true }],
    'Youssef seul a dit oui ; ni Ilyas (une offre plus ancienne, une autre école) ni l’administration');
  assert.equal(new Date(f.fondateurs[0].at).toISOString(), le(10));
  assert.equal(await brut(db, null, 'fondateurs_publics', 'ensam-meknes'), await brut(db, null, 'fondateurs_publics'));
  // Un membre de l'ENSAM Meknès : tout le classement de son école, avec les id ; un lien d'une autre école n'y change rien
  const m = await appel(db, SALMA, 'fondateurs_publics', 'ecole-x');
  assert.deepEqual(m.fondateurs.map(x => [x.id, x.rang, x.type]), [[YOUSSEF, 1, 'offre'], [NADIA, 2, 'mentorat']]);
  assert.deepEqual(await appel(db, SALMA, 'chiffres_publics', 'ecole-x'), MEKNES);
});

test('une école ouverte nommée dans le lien (p_ecole) : ses chiffres et ses fondateurs seulement', async () => {
  assert.deepEqual(await appel(db, null, 'chiffres_publics', 'ecole-x'), ECOLE_X);
  const f = await appel(db, null, 'fondateurs_publics', 'ecole-x');
  assert.deepEqual([f.total, f.places, f.mon_choix], [2, 23, null]);
  assert.deepEqual(f.fondateurs.map(x => [x.id, x.rang, x.type, x.nom, x.photo]), [[null, 1, 'offre', 'Karim Benali', photo(KARIM, 3)]],
    'Karim a dit oui ; Omar, au classement, non ; Rim a dit oui sans figurer au classement');
  assert.equal(new Date(f.fondateurs[0].at).toISOString(), le(11));
  assert.doesNotMatch(JSON.stringify(f), /Youssef|Nadia|Ilyas/);
  // Une école ouverte où personne n'a encore aidé un étudiant : un lauréat inscrit, aucun fondateur
  assert.deepEqual(await appel(db, null, 'chiffres_publics', 'ecole-y'), { laureats: 1, promos: 1, entreprises: 1 });
  assert.deepEqual(await appel(db, null, 'fondateurs_publics', 'ecole-y'), RIEN_FONDATEURS);
});

test('une école fermée ou inconnue : la réponse « rien », comme visages_publics et reussites_publiques', async () => {
  for (const e of ['ensam-casa', 'ecole-fermee', 'inconnue', '', 'ECOLE-X', "ecole-x' or 1=1"]) {
    assert.deepEqual(await appel(db, null, 'chiffres_publics', e), RIEN_CHIFFRES, e);
    assert.deepEqual(await appel(db, null, 'fondateurs_publics', e), RIEN_FONDATEURS, e);
    assert.deepEqual(await appel(db, null, 'visages_publics', e), [], e);
    assert.deepEqual(await appel(db, null, 'reussites_publiques', e), [], e);
  }
  // Ilyas a dit oui et ouvre le classement de son école : tant qu'elle est fermée, rien de ce profil sans compte
  assert.equal((await ligne(db, ILYAS)).fondateur_public, true);
  // L'école X fermée à son tour : plus rien d'elle, l'ENSAM Meknès ne change pas
  await ouvrir(db, 'ecole-x', false);
  try {
    assert.deepEqual(await appel(db, null, 'chiffres_publics', 'ecole-x'), RIEN_CHIFFRES);
    assert.deepEqual(await appel(db, null, 'fondateurs_publics', 'ecole-x'), RIEN_FONDATEURS);
    assert.deepEqual(await appel(db, null, 'chiffres_publics'), MEKNES);
  } finally { await ouvrir(db, 'ecole-x', true); }
  assert.deepEqual(await appel(db, null, 'chiffres_publics', 'ecole-x'), ECOLE_X);
  assert.equal((await db.query(`select ouverte from public.ecoles where slug = 'ensam-casa'`)).rows[0].ouverte, false, 'ENSAM Casablanca reste fermée');
});

test('un membre de l’école X, sans p_ecole (ou avec le lien d’une autre école) : son école', async () => {
  for (const e of [undefined, 'ensam-meknes', 'ecole-y']) {
    assert.deepEqual(await appel(db, HIBA, 'chiffres_publics', e), ECOLE_X, String(e));
    const f = await appel(db, HIBA, 'fondateurs_publics', e);
    assert.deepEqual(f.fondateurs.map(x => [x.id, x.rang, x.type]), [[KARIM, 1, 'offre'], [OMAR, 2, 'aide']], 'tout le classement de son école, avec les id');
    assert.deepEqual([f.total, f.places, f.mon_choix], [2, 23, null]);
  }
  assert.equal((await appel(db, KARIM, 'fondateurs_publics')).mon_choix, true, 'son propre choix');
  // Un membre d'une école pas encore ouverte voit la sienne (ses membres se voient déjà dans l'appli) ; un visiteur, rien
  assert.deepEqual(await appel(db, ILYAS, 'chiffres_publics'), { laureats: 1, promos: 1, entreprises: 1 });
  assert.deepEqual((await appel(db, ILYAS, 'fondateurs_publics')).fondateurs.map(x => [x.id, x.rang]), [[ILYAS, 1]]);
  // Connecté mais sans profil encore (l'inscription n'est pas finie) : comme un visiteur, l'école du lien
  assert.deepEqual(await appel(db, SANS_PROFIL, 'chiffres_publics', 'ecole-x'), ECOLE_X);
  assert.deepEqual(await appel(db, SANS_PROFIL, 'chiffres_publics'), MEKNES);
  assert.deepEqual(await appel(db, SANS_PROFIL, 'fondateurs_publics', 'ensam-casa'), RIEN_FONDATEURS);
});

test('fondateurs_classement prend l’école ; une seule version de chaque fonction, mêmes droits', async () => {
  const versions = async n => (await db.query(`select p.oid::regprocedure::text f, pg_get_function_arguments(p.oid) a from pg_proc p
    join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = $1`, [n])).rows;
  assert.deepEqual(await versions('chiffres_publics'), [{ f: 'chiffres_publics(text)', a: 'p_ecole text DEFAULT NULL::text' }]);
  assert.deepEqual(await versions('fondateurs_publics'), [{ f: 'fondateurs_publics(text)', a: 'p_ecole text DEFAULT NULL::text' }]);
  assert.equal((await versions('fondateurs_classement')).length, 1);
  assert.match((await versions('fondateurs_classement'))[0].f, /^fondateurs_classement\(text\)$/);
  const droit = async (role, f) => (await db.query(`select has_function_privilege($1, $2, 'execute') d`, [role, f])).rows[0].d;
  for (const f of ['public.chiffres_publics(text)', 'public.fondateurs_publics(text)']) {
    assert.equal(await droit('anon', f), true, f); assert.equal(await droit('authenticated', f), true, f);
  }
  assert.equal(await droit('anon', 'public.fondateurs_classement(text)'), false);
  assert.equal(await droit('authenticated', 'public.fondateurs_classement(text)'), false);
  // Chaque école son classement ; une école inconnue (null) : personne ; sans argument : l'ENSAM Meknès, comme avant
  const ids = async a => (await db.query(`select id from public.fondateurs_classement(${a}) order by rang`)).rows.map(r => r.id);
  assert.deepEqual(await ids(`'ecole-x'`), [KARIM, OMAR]);
  assert.deepEqual(await ids(`'ecole-fermee'`), [ILYAS]);
  assert.deepEqual(await ids('null'), []);
  assert.deepEqual(await ids(''), [YOUSSEF, NADIA]);
  // Aucun appel de la base ne garde l'ancienne forme (sans l'école)
  const appelants = await db.query(`select p.oid::regprocedure::text f from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public' and p.prosrc ~ 'fondateurs_classement\\s*\\(\\s*\\)' order by 1`);
  assert.deepEqual(appelants.rows, []);
});

test('photos sans compte : décidées par leur propriétaire (son oui, son école ouverte), jamais par l’école du visiteur', async () => {
  const fondateur = n => un(db, null, 'select public.photo_fondateur_publique($1) x', [n]);
  const visage = n => un(db, null, 'select public.photo_visage_publique($1) x', [n]);
  assert.deepEqual(await photosSansCompte(db), [photo(YOUSSEF, 1), photo(KARIM, 3)],
    'Youssef et Karim ont dit oui ; ni Nadia, Omar, Amine (rien dit), ni Rim (hors du classement), ni Ilyas (école fermée), ni l’ancienne photo de Karim');
  assert.deepEqual([await fondateur(photo(KARIM, 3)), await visage(photo(KARIM, 3))], [true, true]);
  assert.deepEqual([await fondateur(photo(RIM, 5)), await fondateur(photo(KARIM, 30)), await fondateur(photo(ILYAS, 7)), await visage(photo(ILYAS, 7))], [false, false, false, false]);
  // Rim dit oui pour la page d'entrée : sa photo devient lisible (visage, hors du classement des fondateurs)
  await q(db, RIM, 'update public.profiles set vitrine_publique = true where id = $1', [RIM]);
  assert.deepEqual(await photosSansCompte(db), [photo(YOUSSEF, 1), photo(KARIM, 3), photo(RIM, 5)]);
  assert.deepEqual([await fondateur(photo(RIM, 5)), await visage(photo(RIM, 5))], [false, true]);
  // Karim retire un oui puis l'autre : sa photo reste tant qu'il en reste un, puis plus rien
  await q(db, KARIM, 'update public.profiles set fondateur_public = false where id = $1', [KARIM]);
  assert.ok((await photosSansCompte(db)).includes(photo(KARIM, 3)), 'encore son visage');
  await q(db, KARIM, 'update public.profiles set vitrine_publique = false where id = $1', [KARIM]);
  assert.ok(!(await photosSansCompte(db)).includes(photo(KARIM, 3)));
  await q(db, KARIM, 'update public.profiles set fondateur_public = true where id = $1', [KARIM]);
  assert.deepEqual([await fondateur(photo(KARIM, 3)), await visage(photo(KARIM, 3))], [true, false], 'son seul oui de fondateur');
  await q(db, KARIM, 'update public.profiles set vitrine_publique = true where id = $1', [KARIM]);
  // L'école X fermée : plus aucune de ses photos, même avec le oui ; celles de l'ENSAM Meknès restent
  await ouvrir(db, 'ecole-x', false);
  try { assert.deepEqual(await photosSansCompte(db), [photo(YOUSSEF, 1)]); } finally { await ouvrir(db, 'ecole-x', true); }
  // L'école d'Ilyas ouverte (dans ce test seulement) : sa photo suit l'école de son propriétaire
  await ouvrir(db, 'ecole-fermee', true);
  try {
    assert.deepEqual([await fondateur(photo(ILYAS, 7)), await visage(photo(ILYAS, 7))], [true, true]);
    assert.equal((await appel(db, null, 'fondateurs_publics', 'ecole-fermee')).fondateurs[0].photo, photo(ILYAS, 7));
  } finally { await ouvrir(db, 'ecole-fermee', false); }
  assert.deepEqual(await photosSansCompte(db), [photo(YOUSSEF, 1), photo(KARIM, 3), photo(RIM, 5)]);
  // Un membre connecté passe par sa propre règle (photos de son école), pas par celles-ci
  assert.deepEqual((await q(db, SALMA, `select name from storage.objects where bucket_id = 'photos' and name like $1`, [`${KARIM}/%`])), []);
  await q(db, RIM, 'update public.profiles set vitrine_publique = false where id = $1', [RIM]);
});

// Un compte qui s'inscrit depuis un lien : la métadonnée du compte porte le code (invite_par), puis le profil est créé
// dans l'école du lien (?ecole=…, envoyée avec le profil)
async function inscrire(b, id, nom, meta, ecole) {
  await b.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [id, id.slice(-4) + '@exemple.ma', JSON.stringify(meta || {})]);
  await q(b, id, `insert into public.profiles (id, full_name, role, filiere, promo${ecole ? ', ecole' : ''}) values ($1, $2, 'etudiant', 'Génie Industriel', $3${ecole ? ', $4' : ''})`,
    [id, nom, S + 1, ...(ecole ? [ecole] : [])]);
  return ligne(b, id);
}
test('invitation nommée entre écoles : « invité par » et invitation_de seulement dans l’école de qui invite, ouverte', async () => {
  const code = id => un(db, id, 'select public.mon_code_invitation() x');
  const [ck, ca, cy, ci] = [await code(KARIM), await code(AMINE), await code(YOUSSEF), await code(ILYAS)];
  // Un nouveau membre de X invité par un membre de X
  assert.equal((await inscrire(db, uid(1821), 'Sara Alami', { invite_par: ck }, 'ecole-x')).invite_par, KARIM);
  assert.equal((await inscrire(db, uid(1822), 'Lina Bennis', { invite_par: ca }, 'ecole-y')).invite_par, AMINE);
  // Le code d'un membre de X pour une inscription ailleurs (Y, ENSAM Meknès), et l'inverse : personne
  assert.equal((await inscrire(db, uid(1823), 'Yassine Fassi', { invite_par: ck }, 'ecole-y')).invite_par, null);
  assert.equal((await inscrire(db, uid(1824), 'Imane Kettani', { invite_par: ck })).invite_par, null);
  assert.equal((await inscrire(db, uid(1825), 'Ayoub Chraibi', { invite_par: cy }, 'ecole-x')).invite_par, null);
  // Une école fermée : pas d'inscription du tout, même avec le code d'un de ses membres
  await assert.rejects(inscrire(db, uid(1826), 'Ines Amrani', { invite_par: ci }, 'ecole-fermee'), /pas encore ouvert/);
  assert.deepEqual(await un(db, KARIM, 'select public.mes_invites() x'), { n: 1, prenoms: ['Sara'] });
  // invitation_de(code, X) : qui invite, seulement si X est ouverte et que qui invite en est
  const de = (c, e) => (e === undefined ? un(db, null, 'select public.invitation_de($1) x', [c]) : un(db, null, 'select public.invitation_de($1, $2) x', [c, e]));
  assert.deepEqual(await de(ck, 'ecole-x'), { prenom: 'Karim', promo: 2012, role: 'laureat' });
  for (const [c, e] of [[ck, 'ecole-y'], [ck, undefined], [ck, 'ensam-meknes'], [cy, 'ecole-x'], [ci, 'ecole-fermee'], [ck, 'inconnue']]) assert.equal(await de(c, e), null, `${c} ${e}`);
  assert.equal((await de(cy)).prenom, 'Youssef');
  await ouvrir(db, 'ecole-x', false);
  try { assert.equal(await de(ck, 'ecole-x'), null, 'X fermée : personne'); } finally { await ouvrir(db, 'ecole-x', true); }
  // Connecté : l'école du membre, quel que soit le lien
  assert.equal((await un(db, HIBA, 'select public.invitation_de($1) x', [ck])).prenom, 'Karim');
  assert.equal(await un(db, SALMA, 'select public.invitation_de($1, $2) x', [ck, 'ecole-x']), null);
});

test('aucune fonction ouverte aux visiteurs ne fige l’ENSAM Meknès (ni l’école d’un visiteur)', async () => {
  const r = await db.query(`select p.oid::regprocedure::text f from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('anon', p.oid, 'execute') and p.prosrc ~ 'ensam-meknes' order by 1`);
  assert.deepEqual(r.rows.map(x => x.f), [], 'l’école vient de ecole_entree (le lien) ou du propriétaire, jamais d’un nom écrit dans la fonction');
});

// Les fonctions telles que main les définit (avant ces finitions) : sans l'école, l'ENSAM Meknès pour tout visiteur
const ANCIENNES = `
drop function if exists public.chiffres_publics(text);
drop function if exists public.fondateurs_publics(text);
drop function if exists public.fondateurs_classement(text);
create or replace function public.chiffres_publics() returns jsonb
language sql stable security definer set search_path = public as $$
  with l as (select promo, public.cle_entreprise(entreprise) as k from public.profiles
    where role = 'laureat' and not admin_ok and ecole = coalesce(public.mon_ecole(), 'ensam-meknes')),
  ks as (select distinct k from l where k is not null and k <> '')
  select jsonb_build_object(
    'laureats', (select count(*) from l),
    'promos', (select count(distinct promo) from l),
    'entreprises', (select count(*) from ks) - (select count(distinct a.k) from ks a
      cross join lateral generate_series(1, array_length(string_to_array(a.k, ' '), 1) - 1) i
      join ks b on b.k = array_to_string((string_to_array(a.k, ' '))[1:i], ' ')));
$$;
revoke all on function public.chiffres_publics() from public;
grant execute on function public.chiffres_publics() to anon, authenticated;
create or replace function public.fondateurs_classement() returns table (id uuid, at timestamptz, type text, rang int)
language sql stable security definer set search_path = public as $$
  with c as (
    select o.author_id as l, o.created_at as at, 'offre'::text as k from public.offers o
      where coalesce(o.audience, 'etudiants') = 'etudiants' and o.origine is distinct from 'partagee'
    union all select x.laureat_id, x.created_at, 'aide' from public.propositions x
      join public.demandes d on d.id = x.demande_id
      join public.profiles s on s.id = d.auteur_id and s.role = 'etudiant'
      where x.status <> 'retiree'
    union all select m.mentor_id, coalesce(m.accepted_at, m.created_at), 'mentorat' from public.mentorships m
      join public.profiles s on s.id = m.student_id and s.role = 'etudiant'
      where m.mentor_id is not null and m.status in ('acceptee', 'terminee')
  ), premiere as (
    select distinct on (c.l) c.l, c.at, c.k from c
      join public.profiles p on p.id = c.l and p.role = 'laureat' and not p.admin_ok and p.ecole = coalesce(public.mon_ecole(), 'ensam-meknes')
      where c.at is not null
      order by c.l, c.at, c.k
  )
  select l, at, k, (row_number() over (order by at, l))::int from premiere order by at, l limit 25;
$$;
revoke all on function public.fondateurs_classement() from public, anon, authenticated;
create or replace function public.fondateurs_publics() returns jsonb
language sql stable security definer set search_path = public as $$
  with f as (
    select c.id, c.at, c.type, c.rang, p.full_name, p.filiere, p.promo, p.photo_path, p.verified, p.fondateur_public
    from public.fondateurs_classement() c join public.profiles p on p.id = c.id
  ), qui as (select exists (select 1 from public.profiles where id = auth.uid()) as membre)
  select jsonb_build_object(
    'max', 25,
    'total', (select count(*) from f),
    'places', greatest(0, 25 - (select count(*) from f)),
    'mon_choix', case when q.membre then (select to_jsonb(fondateur_public) from public.profiles where id = auth.uid()) end,
    'fondateurs', coalesce((select jsonb_agg(jsonb_build_object(
        'id', case when q.membre then f.id end, 'rang', f.rang, 'type', f.type, 'at', f.at,
        'nom', f.full_name, 'filiere', f.filiere, 'promo', f.promo, 'photo', f.photo_path, 'verifie', coalesce(f.verified, false))
        order by f.rang) from f where q.membre or f.fondateur_public is true), '[]'::jsonb))
  from qui q;
$$;
revoke all on function public.fondateurs_publics() from public;
grant execute on function public.fondateurs_publics() to anon, authenticated;
create or replace function public.photo_fondateur_publique(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  select p.id into v from public.profiles p where p.photo_path = p_name and p.fondateur_public and p.role = 'laureat' limit 1;
  if v is null then return false; end if;
  return exists (select 1 from public.fondateurs_classement() c where c.id = v);
end $$;
create or replace function public.photo_visage_publique(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.photo_path = p_name and p.vitrine_publique and p.verified and p.role = 'laureat'
    and not p.admin_ok and p.ecole = coalesce(public.mon_ecole(), 'ensam-meknes'));
$$;`;

// Ce que voient, avec {}, un visiteur, un compte sans profil, des membres de l'ENSAM Meknès, de l'école X et de l'école fermée
const QUI = [null, SANS_PROFIL, YOUSSEF, SALMA, HIBA, KARIM, ILYAS];
async function reponses(b) {
  const r = {};
  for (const u of QUI) for (const f of ['chiffres_publics', 'fondateurs_publics']) r[`${u} ${f}`] = await brut(b, u, f);
  return r;
}

test('base de main : la mise à jour passe deux fois ; avec {}, chaque réponse reste la même à l’octet près', async () => {
  const b = await nouvelleBase(SCHEMA);
  try {
    await peupler(b);
    await b.exec(ANCIENNES);
    // Avant : la page d'entrée de l'école X n'a ni ses chiffres (p_ecole inconnu de la base), ni ses photos
    await assert.rejects(appel(b, null, 'chiffres_publics', 'ecole-x'), /does not exist/);
    assert.deepEqual(await photosSansCompte(b), [photo(YOUSSEF, 1)]);
    const avant = await reponses(b);
    assert.deepEqual(JSON.parse(avant['null chiffres_publics']), MEKNES);
    const maj = lireSql(MAJ);
    await b.exec(maj);
    await b.exec(maj);
    assert.deepEqual(await reponses(b), avant);
    // Après : la page de l'école X a les siens ; les oui et les codes d'avant sont gardés
    assert.deepEqual(await appel(b, null, 'chiffres_publics', 'ecole-x'), ECOLE_X);
    assert.deepEqual((await appel(b, null, 'fondateurs_publics', 'ecole-x')).fondateurs.map(x => x.nom), ['Karim Benali']);
    assert.deepEqual(await appel(b, null, 'fondateurs_publics', 'ensam-casa'), RIEN_FONDATEURS);
    assert.deepEqual(await photosSansCompte(b), [photo(YOUSSEF, 1), photo(KARIM, 3)]);
    assert.deepEqual([(await ligne(b, KARIM)).fondateur_public, (await ligne(b, KARIM)).vitrine_publique], [true, true]);
    const n = async f => (await b.query(`select count(*)::int n from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace`, [f])).rows[0].n;
    for (const f of ['chiffres_publics', 'fondateurs_publics', 'fondateurs_classement']) assert.equal(await n(f), 1, f);
    const regles = (await b.query(`select policyname from pg_policies where tablename = 'objects' and 'anon' = any(roles) order by 1`)).rows.map(r => r.policyname);
    assert.deepEqual(regles, ['photos fondateurs publics', 'photos visages publics']);
  } finally { await b.close(); }
});

test('base plus ancienne (Phase 2) : la mise à jour passe deux fois, les fonctions de la page d’entrée prennent l’école', async () => {
  const b = await nouvelleBase(AVANT);
  try {
    await creerCompte(b, { id: uid(1831), full_name: 'Youssef Test', role: 'laureat', filiere: 'GI', promo: 2015, entreprise: 'OCP' });
    await creerCompte(b, { id: uid(1832), full_name: 'Salma Test', role: 'etudiant', filiere: 'GI', promo: 2027 });
    await en(b, uid(1831), tx => tx.query(`insert into public.offers (author_id, type, titre, entreprise, description, annees) values ($1, 'pfe', 'PFE test', 'OCP', 'd', '{5}')`, [uid(1831)]));
    const maj = lireSql(MAJ);
    await b.exec(maj);
    await b.exec(maj);
    assert.deepEqual(await appel(b, null, 'chiffres_publics'), { laureats: 1, promos: 1, entreprises: 1 });
    assert.deepEqual(await appel(b, null, 'chiffres_publics', 'ensam-casa'), RIEN_CHIFFRES);
    const f = await appel(b, null, 'fondateurs_publics');
    assert.deepEqual([f.total, f.places, f.fondateurs], [1, 24, []], 'un fondateur, qui n’a pas encore dit oui');
    assert.deepEqual(await appel(b, null, 'fondateurs_publics', 'inconnue'), RIEN_FONDATEURS);
    assert.deepEqual((await appel(b, uid(1832), 'fondateurs_publics')).fondateurs.map(x => x.id), [uid(1831)]);
    const n = async fn => (await b.query(`select count(*)::int n from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace`, [fn])).rows[0].n;
    for (const fn of ['chiffres_publics', 'fondateurs_publics', 'fondateurs_classement', 'photo_fondateur_publique', 'photo_visage_publique']) assert.equal(await n(fn), 1, fn);
    assert.equal((await b.query(`select ouverte from public.ecoles where slug = 'ensam-casa'`)).rows[0].ouverte, false);
  } finally { await b.close(); }
});
