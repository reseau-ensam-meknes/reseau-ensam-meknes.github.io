// Profil : un « lauréat » d'une promo pas encore diplômée n'est pas vérifié ; le bon rôle l'est
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, creerCompte, en, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const ADMIN = uid(41), HAJEB = uid(42);
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ADMIN, full_name: 'Admin École', role: 'etudiant', filiere: 'Génie Civil', promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  await q(ADMIN, 'select public.importer_liste($1::jsonb)', [JSON.stringify([{ nom: 'Hajeb Abderrahman', promo: S + 1 }])]);
});

test('promo pas encore diplômée : pas de badge lauréat, le rôle étudiant est vérifié', async () => {
  await creerCompte(db, { id: HAJEB, full_name: 'Hajeb Abderrahman', role: 'laureat', filiere: 'Génie Mécanique', promo: S + 1 });
  const verifie = async () => (await q(HAJEB, 'select verified from public.profiles where id = $1', [HAJEB]))[0].verified;
  assert.equal(await verifie(), false);
  // Il corrige son profil (champs facultatifs vides, comme le formulaire les envoie)
  const r = await q(HAJEB, `update public.profiles set role = 'etudiant', entreprise = null, poste = null, linkedin = null, bio = null where id = $1 returning role`, [HAJEB]);
  assert.equal(r[0].role, 'etudiant');
  assert.equal(await verifie(), true);
});
