// La mise à jour appliquée à la base de production (main, 9300e99 : schema-9300e99.sql, la copie exacte de son schema.sql)
// vide les liens vers des lignes disparues, même quand une ligne en a plusieurs. Les gardes d'avant liens_disparus
// remettaient chaque lien qu'une suppression venait de vider : un recrutement peut viser une demande, un lauréat et une
// offre qui n'existent plus. Vidés un lien après l'autre, le deuxième échouait : dès qu'une ligne a changé dans la
// transaction, Postgres vérifie à nouveau toutes ses clés étrangères, et celle du troisième lien vise toujours une ligne
// disparue. Chaque ligne est donc mise à jour une seule fois, tous ses liens disparus vidés ensemble. Relancée sur une base
// saine, la mise à jour ne change rien (maj_tables comprise).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nouvelleBase, creerCompte, uid } from './banc-sql.mjs';

const PROD = process.env.SCHEMA_PROD || new URL('./schema-9300e99.sql', import.meta.url).pathname;
const MAJ = process.env.MISE_A_JOUR_SQL || new URL('../../supabase/mise-a-jour.sql', import.meta.url).pathname;
const GI = 'Génie Industriel';
const ETU = uid(9601), ETU2 = uid(9602), LAU = uid(9603);
const DISPARU = { lau: uid(9690), offre: uid(9691), demande: uid(9692), offre2: uid(9693), lau2: uid(9694) };

// Les tables à plusieurs liens « on delete set null » d'une seule colonne
const plusieursLiens = async db => (await db.query(`select k.conrelid::regclass::text t from pg_constraint k
  where k.contype = 'f' and k.confdeltype = 'n' and cardinality(k.conkey) = 1 and k.connamespace = 'public'::regnamespace
  group by 1 having count(*) > 1 order by 1`)).rows.map(r => r.t);
const ligne = async (db, t, id) => (await db.query(`select to_jsonb(x) - 'id' j from public.${t} x where x.id = $1`, [id])).rows[0]?.j;
const etat = async db => ({
  placements: (await db.query(`select to_jsonb(x)::text j from public.placements x order by x.id`)).rows.map(r => r.j),
  applications: (await db.query(`select to_jsonb(x)::text j from public.applications x order by x.id`)).rows.map(r => r.j),
  maj_tables: (await db.query(`select cle, maj::text from public.maj_tables order by cle`)).rows,
});

test('production → mise à jour : un recrutement dont la demande, le lauréat et l’offre ont disparu perd ces trois liens, la ligne reste ; relancée, rien ne change', async () => {
  const db = await nouvelleBase(PROD);
  await creerCompte(db, { id: ETU, full_name: 'Salma Prod', role: 'etudiant', filiere: GI, promo: 2026 });
  await creerCompte(db, { id: ETU2, full_name: 'Omar Prod', role: 'etudiant', filiere: GI, promo: 2026 });
  await creerCompte(db, { id: LAU, full_name: 'Youssef Prod', role: 'laureat', filiere: GI, promo: 2016 });
  const un = async (sql, p) => (await db.query(sql, p)).rows[0].id;
  const offre = await un(`insert into public.offers (author_id, type, titre, entreprise, description) values ($1, 'stage', 'Stage en logistique', 'Atlas', 'Six mois.') returning id`, [LAU]);
  const demande = await un(`insert into public.demandes (auteur_id, type, titre, details) values ($1, 'stage', 'Cherche un stage', 'Un stage de fin d’études en logistique, dès juin.') returning id`, [ETU]);
  // Une seule table a plusieurs liens « on delete set null » en production comme après la mise à jour : les recrutements.
  // Une autre table qui en aurait plusieurs demanderait ici sa ligne aux liens disparus.
  assert.deepEqual(await plusieursLiens(db), ['placements']);

  // Les lignes que la production peut avoir : posées sans clés étrangères ni déclencheurs, comme les gardes d'avant les ont laissées
  await db.exec('set session_replication_role = replica');
  const tous = await un(`insert into public.placements (student_id, laureat_id, offer_id, demande_id, entreprise, saison, niveau, type, source, status)
    values ($1, $2, $3, $4, 'Atlas', 2024, 4, 'stage', 'plateforme', 'confirme') returning id`, [ETU, DISPARU.lau, DISPARU.offre, DISPARU.demande]);
  const deux = await un(`insert into public.placements (student_id, laureat_id, offer_id, demande_id, entreprise, saison, niveau, type, source, status)
    values ($1, $2, $3, $4, 'Atlas', 2025, 5, 'pfe', 'plateforme', 'en_attente') returning id`, [ETU, DISPARU.lau2, DISPARU.offre2, demande]);
  const candidature = await un(`insert into public.applications (student_id, offer_id, entreprise) values ($1, $2, 'Atlas') returning id`, [ETU2, DISPARU.offre]);
  await db.exec('set session_replication_role = origin');
  const sain = await un(`insert into public.placements (student_id, laureat_id, offer_id, entreprise, saison, niveau, type, source, status)
    values ($1, $2, $3, 'Atlas', 2025, 4, 'stage', 'plateforme', 'en_attente') returning id`, [ETU2, LAU, offre]);
  const avant = { tous: await ligne(db, 'placements', tous), deux: await ligne(db, 'placements', deux), sain: await ligne(db, 'placements', sain) };
  const n = async t => (await db.query(`select count(*)::int n from public.${t}`)).rows[0].n;
  const lignes = { placements: await n('placements'), applications: await n('applications'), demandes: await n('demandes'), offers: await n('offers') };

  const sql = fs.readFileSync(MAJ, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, '-- pgcrypto : gen_random_uuid est intégré');
  await db.exec(sql);

  // Les trois liens disparus vidés, en une fois ; le reste de la ligne tel quel
  assert.deepEqual(await ligne(db, 'placements', tous), { ...avant.tous, laureat_id: null, offer_id: null, demande_id: null });
  // Deux liens disparus vidés, la demande qui existe gardée
  assert.deepEqual(await ligne(db, 'placements', deux), { ...avant.deux, laureat_id: null, offer_id: null });
  assert.equal((await ligne(db, 'placements', deux)).demande_id, demande);
  // Une ligne à un seul lien disparu (une candidature à une offre supprimée) : comme avant ; une ligne saine : intacte
  assert.equal((await ligne(db, 'applications', candidature)).offer_id, null);
  assert.deepEqual(await ligne(db, 'placements', sain), avant.sain);
  for (const [t, k] of Object.entries(lignes)) assert.equal(await n(t), k, t);
  assert.deepEqual(await plusieursLiens(db), ['placements']);

  // Relancée sur la base saine : rien ne change, maj_tables comprise
  const sain1 = await etat(db);
  await db.exec(sql);
  assert.deepEqual(await etat(db), sain1);
  await db.close();
});
