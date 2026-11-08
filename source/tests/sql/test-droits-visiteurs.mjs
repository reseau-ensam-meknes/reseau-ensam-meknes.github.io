// Ce qu'un visiteur sans compte (rôle anon : la clé publique de config.js, que tout le monde a) peut faire exécuter à la
// base. Une fonction SECURITY DEFINER tourne avec tous les droits et passe à côté des règles : seules celles de la page
// d'entrée, des liens partagés et des liens des emails lui sont permises, chacune revue. Supabase permet à tous chaque
// nouvelle fonction : ce test la refuse tant qu'elle n'est pas revue (revoke … from public, anon ; ou ajoutée ici, avec
// sa raison). Les membres connectés gardent ce qu'ils avaient.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nouvelleBase, creerCompte, en, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;

// Les fonctions qu'un visiteur appelle, et pourquoi
const PERMISES = {
  'attestation_publique(uuid)': 'la page publique qui vérifie une attestation',
  'chiffres_publics(text)': 'la page d’entrée : trois totaux, jamais un nom',
  'fondateurs_publics(text)': 'la page d’entrée et la page des fondateurs',
  'invitation_de(text,text)': 'le lien d’invitation nommée, avant l’inscription',
  'offre_partagee(uuid)': 'le lien d’une offre partagé',
  'photo_fondateur_publique(text)': 'la règle « photos fondateurs publics » du stockage',
  'photo_visage_publique(text)': 'la règle « photos visages publics » du stockage',
  'push_recu(text)': 'l’accusé de réception du service worker (clé publique)',
  'reussites_publiques(text)': 'la page d’entrée',
  'se_desabonner(uuid)': 'le lien de désabonnement du résumé par email',
  'se_desabonner_alertes(uuid)': 'le lien de désabonnement des alertes',
  'se_desabonner_messages(uuid)': 'le lien de désabonnement des emails de messages',
  'se_desabonner_rappels(uuid)': 'le lien de désabonnement des rappels',
  'visages_publics(text)': 'la page d’entrée',
};
// Retirées aux visiteurs, gardées par les membres (règles, vues, console)
const MEMBRES = ['admin_comptes()', 'demande_large_le(demandes)', 'domaines_ecole()', 'email_rdv(uuid)', 'en_relation(uuid,uuid)',
  'is_admin()', 'message_signale(uuid)', 'pairs_valides(uuid,integer)', 'peut_lire_fichier_chat(text)', 'peut_voir_cv(text)',
  'voit_champ(uuid,jsonb,text)'];

const L = uid(9101), E = uid(9102), C = uid(9103), ADM = uid(9104);
let db;
const anon = (sql, p) => en(db, null, tx => tx.query(sql, p), { role: 'anon' }).then(r => r.rows);
const permisesA = async (d, role) => (await d.query(`select p.oid::regprocedure::text f from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef and has_function_privilege($1, p.oid, 'execute')`, [role]))
  .rows.map(x => x.f).sort();

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: L, full_name: 'Lauréate Droits', role: 'laureat', filiere: 'Génie Industriel', promo: 2016 });
  await creerCompte(db, { id: E, full_name: 'Étudiant Droits', role: 'etudiant', filiere: 'Génie Industriel', promo: 2027 });
  await creerCompte(db, { id: ADM, full_name: 'Admin Droits', role: 'etudiant', filiere: 'Génie Industriel', promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADM]);
  // Un membre de l'ENSAM Casablanca (réseau fermé : ouvert le temps de l'inscription)
  await db.query(`update public.ecoles set ouverte = true where slug = 'ensam-casa'`);
  await creerCompte(db, { id: C, full_name: 'Membre Casa', role: 'etudiant', filiere: 'Génie Industriel', promo: 2027, ecole: 'ensam-casa' });
  await db.query(`update public.ecoles set ouverte = false where slug = 'ensam-casa'`);
});

test('fonctions SECURITY DEFINER permises à un visiteur : exactement celles revues', async () => {
  assert.deepEqual(await permisesA(db, 'anon'), Object.keys(PERMISES).sort());
  // Aucune n'est une fonction de déclencheur (un déclencheur tourne sans ce droit)
  const trg = await db.query(`select count(*)::int n from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and p.prorettype = 'trigger'::regtype and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`);
  assert.equal(trg.rows[0].n, 0);
});

test('mise à jour d’une base où tout était permis à tous : la même liste', async () => {
  const b = await nouvelleBase(SCHEMA);
  try {
    // Les anciennes bases : chaque fonction permise à public et anon (droits de Supabase par défaut)
    await b.exec('grant execute on all functions in schema public to public, anon, authenticated');
    await b.exec(fs.readFileSync(SCHEMA, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, ''));
    assert.deepEqual(await permisesA(b, 'anon'), Object.keys(PERMISES).sort());
    for (const f of MEMBRES) assert.equal((await b.query(`select has_function_privilege('authenticated', $1, 'execute') d`, ['public.' + f])).rows[0].d, true, f);
  } finally { await b.close(); }
});

test('les règles et les vues qu’un visiteur traverse n’appellent que des fonctions qui lui sont permises', async () => {
  const r = await db.query(`
    select format('%s « %s »', c.oid::regclass, pol.polname) ou, d.refobjid::regprocedure::text f
      from pg_policy pol join pg_class c on c.oid = pol.polrelid
      join pg_depend d on d.classid = 'pg_policy'::regclass and d.objid = pol.oid and d.refclassid = 'pg_proc'::regclass
      where (0::oid = any(pol.polroles) or 'anon'::regrole = any(pol.polroles)) and not has_function_privilege('anon', d.refobjid, 'execute')
    union all
    select v.oid::regclass::text, d.refobjid::regprocedure::text
      from pg_class v join pg_rewrite w on w.ev_class = v.oid
      join pg_depend d on d.classid = 'pg_rewrite'::regclass and d.objid = w.oid and d.refclassid = 'pg_proc'::regclass
      where v.relkind in ('v', 'm') and has_table_privilege('anon', v.oid, 'select') and not has_function_privilege('anon', d.refobjid, 'execute')
    order by 1, 2`);
  assert.deepEqual(r.rows, []);
  // Le banc voit bien les fonctions d'une règle (sinon la vérification ci-dessus ne prouverait rien)
  const vues = await db.query(`select count(*)::int n from pg_policy pol join pg_depend d on d.classid = 'pg_policy'::regclass and d.objid = pol.oid
    and d.refclassid = 'pg_proc'::regclass where pol.polname = 'photos fondateurs publics'`);
  assert.equal(vues.rows[0].n, 1);
  // Chaque table qu'une règle ouvre aux visiteurs se lit sans erreur
  const tables = (await db.query(`select distinct c.oid::regclass::text t from pg_policy pol join pg_class c on c.oid = pol.polrelid
    where 0::oid = any(pol.polroles) or 'anon'::regrole = any(pol.polroles) order by 1`)).rows.map(x => x.t);
  assert.deepEqual(tables, ['ecoles', 'reglages', 'storage.objects']);
  for (const t of tables) await anon(`select count(*) from ${t}`);
});

test('un visiteur lit les écoles ouvertes ; un membre la sienne en plus ; l’administration du réseau toutes', async () => {
  const slugs = rows => rows.map(x => x.slug);
  assert.deepEqual(slugs(await anon(`select slug from public.ecoles order by 1`)), ['ensam-meknes']);
  const lire = u => en(db, u, tx => tx.query(`select slug from public.ecoles order by 1`)).then(r => slugs(r.rows));
  assert.deepEqual(await lire(E), ['ensam-meknes']);
  assert.deepEqual(await lire(C), ['ensam-casa', 'ensam-meknes']);
  assert.deepEqual(await lire(ADM), ['ensam-casa', 'ensam-meknes']);
  // Ouverte : un visiteur la voit aussi
  await db.query(`update public.ecoles set ouverte = true where slug = 'ensam-casa'`);
  try { assert.deepEqual(slugs(await anon(`select slug from public.ecoles order by 1`)), ['ensam-casa', 'ensam-meknes']); }
  finally { await db.query(`update public.ecoles set ouverte = false where slug = 'ensam-casa'`); }
});

test('ce qui touche aux membres est refusé à un visiteur, toujours permis aux membres', async () => {
  for (const f of MEMBRES) {
    const d = async role => (await db.query(`select has_function_privilege($1, $2, 'execute') d`, [role, 'public.' + f])).rows[0].d;
    assert.equal(await d('anon'), false, f);
    assert.equal(await d('authenticated'), true, f);
    assert.equal(await d('service_role'), true, f);
  }
  await assert.rejects(anon('select public.en_relation($1, $2) x', [L, E]), /permission denied/);
  await assert.rejects(anon('select public.pairs_valides($1, 2016) x', [L]), /permission denied/);
  await assert.rejects(anon('select public.message_signale($1) x', [uid(9199)]), /permission denied/);
  await assert.rejects(anon('select public.is_admin() x'), /permission denied/);
  await assert.rejects(anon('select public.admin_comptes()'), /permission denied/);
  // Un membre : comme avant
  assert.equal((await en(db, E, tx => tx.query('select public.en_relation($1, $2) x', [L, E]))).rows[0].x, false);
  assert.equal((await en(db, E, tx => tx.query('select public.is_admin() x'))).rows[0].x, false);
  assert.equal((await en(db, ADM, tx => tx.query('select count(*)::int n from public.admin_comptes()'))).rows[0].n, 4);
});

test('les fonctions permises répondent toujours à un visiteur', async () => {
  const x = async (sql, p) => (await anon(sql, p))[0]?.x;
  assert.deepEqual(Object.keys(await x('select public.chiffres_publics(null) x')).sort(), ['entreprises', 'laureats', 'promos']);
  assert.ok(Array.isArray((await x('select public.fondateurs_publics(null) x')).fondateurs));
  await x('select public.visages_publics(null) x');
  await x('select public.reussites_publiques(null) x');
  assert.equal(await x(`select public.invitation_de('ABCDEFGH', null) x`), null);
  assert.equal(await x('select public.offre_partagee($1) x', [uid(9198)]), null);
  await x('select public.attestation_publique($1) x', [uid(9197)]);
  for (const f of ['se_desabonner', 'se_desabonner_alertes', 'se_desabonner_messages', 'se_desabonner_rappels']) await x(`select public.${f}($1) x`, [uid(9196)]);
  await x(`select public.push_recu('https://exemple.invalid/push') x`);
  assert.equal(await x(`select public.photo_fondateur_publique('x/y.jpg') x`), false);
  assert.equal(await x(`select public.photo_visage_publique('x/y.jpg') x`), false);
});

test('les déclencheurs tournent toujours (le droit d’exécuter leur fonction n’est vérifié qu’à leur création)', async () => {
  // protect_profile : un nouveau compte qui se dit admin redevient étudiant, sans vérification
  const N = uid(9105);
  await creerCompte(db, { id: N, full_name: 'Nouveau Droits', role: 'admin', filiere: 'Génie Industriel', promo: 2027 });
  assert.deepEqual((await db.query('select role, verified from public.profiles where id = $1', [N])).rows, [{ role: 'etudiant', verified: false }]);
  // garde_ecole : un membre de Meknès ne vise pas un membre de Casablanca
  await assert.rejects(en(db, E, tx => tx.query(`insert into public.demandes_contact (demandeur_id, cible_id) values ($1, $2)`, [E, C])), /pas dans ton réseau/);
});
