// Console d'administration : le suivi des écoles et des partenaires (admin_suivi) n'est lu et écrit que par l'administration ;
// un membre (étudiant, lauréat, administration en vue lauréat) n'y voit rien et n'y écrit rien ; un visiteur non plus.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const ADMIN = uid(971), ETU = uid(972), LAU = uid(973), ADMIN_VUE = uid(974);
const GIEO = 'Génie Industriel : Excellence Opérationnelle';
const q = (u, sql, p, opts) => en(db, u, tx => tx.query(sql, p), opts).then(r => r.rows);
const refuse = async (promesse, re) => { await assert.rejects(promesse, e => (re ? re.test(e.message) : true) || assert.fail(e.message)); };
const ligne = (u, champs = {}) => q(u, `insert into public.admin_suivi (type, nom, etape, ecole_slug, formule, montant_dh) values ($1, $2, $3, $4, $5, $6) returning *`,
  [champs.type || 'ecole', champs.nom || 'École exemple', champs.etape || 'a_contacter', champs.ecole_slug ?? null, champs.formule ?? null, champs.montant_dh ?? null]).then(r => r[0]);

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ADMIN, full_name: 'Admin École', role: 'etudiant', filiere: GIEO, promo: 2010 });
  await creerCompte(db, { id: ADMIN_VUE, full_name: 'Admin Vue Lauréat', role: 'etudiant', filiere: GIEO, promo: 2012 });
  await db.query(`update public.profiles set role = 'admin' where id = any($1)`, [[ADMIN, ADMIN_VUE]]);
  await q(ADMIN_VUE, 'update public.profiles set role = $2 where id = $1', [ADMIN_VUE, 'laureat']);
  await creerCompte(db, { id: ETU, full_name: 'Salma Bennani', role: 'etudiant', filiere: GIEO, promo: 2027 });
  await creerCompte(db, { id: LAU, full_name: 'Youssef El Amrani', role: 'laureat', filiere: GIEO, promo: 2016 });
});

test('l’administration ajoute, lit, modifie et supprime une ligne de suivi ; l’auteur et la date de mise à jour sont gardés', async () => {
  const r = await ligne(ADMIN, { nom: 'École exemple', ecole_slug: 'ecole-exemple' });
  assert.equal(r.created_by, ADMIN); assert.equal(r.etape, 'a_contacter');
  assert.equal(r.referent_ok, false); assert.equal(r.accord_nom, false); assert.equal(r.cndp_ok, false);
  const [m] = await q(ADMIN, `update public.admin_suivi set etape = 'contacte', referent_ok = true where id = $1 returning *`, [r.id]);
  assert.equal(m.etape, 'contacte'); assert.equal(m.referent_ok, true);
  assert.ok(new Date(m.updated_at) >= new Date(r.updated_at));
  const p = await ligne(ADMIN, { type: 'partenaire', nom: 'Entreprise exemple', etape: 'proposition', formule: 'partenaire', montant_dh: 2500 });
  assert.equal(p.montant_dh, 2500);
  assert.equal((await q(ADMIN, 'select * from public.admin_suivi')).length, 2);
  await q(ADMIN, 'delete from public.admin_suivi where id = $1', [p.id]);
  assert.equal((await q(ADMIN, 'select * from public.admin_suivi')).length, 1);
});

test('un membre ne lit rien et n’écrit rien ; l’administration en vue lauréat non plus ; un visiteur non plus', async () => {
  for (const u of [ETU, LAU, ADMIN_VUE]) {
    assert.deepEqual(await q(u, 'select * from public.admin_suivi'), [], u);
    await refuse(ligne(u, { nom: 'Intrus' }), /row-level security/);
    const maj = await q(u, `update public.admin_suivi set notes = 'x' returning id`);
    assert.deepEqual(maj, []);
  }
  await refuse(q(null, 'select * from public.admin_suivi', [], { role: 'anon' }), /permission denied/);
});

test('les valeurs hors liste sont refusées : type, étape, formule, montant, identifiant d’école', async () => {
  await refuse(ligne(ADMIN, { type: 'membre' }), /check/);
  await refuse(ligne(ADMIN, { etape: 'gagne' }), /check/);
  await refuse(ligne(ADMIN, { type: 'partenaire', formule: 'or' }), /check/);
  await refuse(ligne(ADMIN, { type: 'partenaire', montant_dh: -5 }), /check/);
  await refuse(ligne(ADMIN, { ecole_slug: 'ENSAM Rabat' }), /check/);
  await refuse(ligne(ADMIN, { nom: ' ' }), /check/);
});

test('dossier_cndp_de_mon_ecole : l’administration d’une école sait si son école est au dossier CNDP, sans lire le suivi', async () => {
  const AC = uid(975), EC = uid(976);
  await db.query(`update public.ecoles set ouverte = true where slug = 'ensam-casa'`);
  await creerCompte(db, { id: AC, full_name: 'Admin Casa', role: 'etudiant', filiere: GIEO, promo: 2010, ecole: 'ensam-casa' });
  await creerCompte(db, { id: EC, full_name: 'Karim Casa', role: 'etudiant', filiere: GIEO, promo: 2027, ecole: 'ensam-casa' });
  await db.query(`update public.ecoles set ouverte = false where slug = 'ensam-casa'`);
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [AC]);
  const cndp = u => q(u, 'select public.dossier_cndp_de_mon_ecole() x').then(r => r[0].x);
  // Pas de ligne de suivi pour son école, puis une ligne dont la case n'est pas cochée : non
  assert.equal(await cndp(AC), false);
  const r = await ligne(ADMIN, { nom: 'ENSAM Casablanca', ecole_slug: 'ensam-casa', etape: 'accord' });
  assert.equal(await cndp(AC), false);
  // Un partenaire au même identifiant, case cochée : ce n'est pas le suivi de l'école
  const p = await ligne(ADMIN, { type: 'partenaire', nom: 'Partenaire de Casablanca', ecole_slug: 'ensam-casa' });
  await q(ADMIN, 'update public.admin_suivi set cndp_ok = true where id = $1', [p.id]);
  assert.equal(await cndp(AC), false);
  // L'administration du réseau coche la case de l'école : oui, pour l'administration de cette école seulement
  await q(ADMIN, 'update public.admin_suivi set cndp_ok = true where id = $1', [r.id]);
  assert.equal(await cndp(AC), true);
  for (const u of [EC, ETU, LAU, ADMIN_VUE]) assert.equal(await cndp(u), false, u);
  // L'administration du réseau : la case de son école à elle (ENSAM Meknès), pas celle de Casablanca
  assert.equal(await cndp(ADMIN), false);
  // Elle ne lit toujours pas le suivi, et un visiteur ne peut pas la demander
  assert.deepEqual(await q(AC, 'select * from public.admin_suivi'), []);
  await refuse(q(null, 'select public.dossier_cndp_de_mon_ecole()', [], { role: 'anon' }), /permission denied/);
  // Décochée : non à nouveau
  await q(ADMIN, 'update public.admin_suivi set cndp_ok = false where id = $1', [r.id]);
  assert.equal(await cndp(AC), false);
});
