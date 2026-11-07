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
