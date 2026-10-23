// Page d'entrée : trois chiffres vrais pour un visiteur sans compte (jamais un nom), et comptes ouverts
// par code à 6 chiffres (une adresse tapée sans que le code soit entré ne compte pas)
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, creerCompte, en, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const L = n => uid(700 + n);

before(async () => {
  db = await nouvelleBase(SCHEMA);
  const lau = (n, entreprise, promo, extra = {}) => creerCompte(db, { id: L(n), full_name: `Lauréat ${n}`, role: 'laureat', filiere: 'Génie Mécanique', promo, ...(entreprise ? { entreprise } : {}), ...extra });
  await lau(1, 'Renault Group Maroc', 2016);
  await lau(2, 'Renault', 2016);
  await lau(3, 'Renault Tanger Med', 2018);
  await lau(4, 'OCP', 2019, { visibilite: { travail: 'contacts' } });
  await lau(5, null, 2019);
  await creerCompte(db, { id: L(6), full_name: 'Étudiante', role: 'etudiant', filiere: 'Génie Mécanique', promo: 2028, entreprise: 'Stellantis' });
  await creerCompte(db, { id: L(7), full_name: 'Admin', role: 'laureat', filiere: 'Génie Mécanique', promo: 2015, entreprise: 'Capgemini' });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [L(7)]);
});

const chiffres = role => en(db, null, tx => tx.query('select public.chiffres_publics() c'), { role }).then(r => r.rows[0].c);

test('chiffres publics : lauréats, promos et entreprises (« Renault » et ses filiales comptent une fois), même résultat sans compte', async () => {
  const anon = await chiffres('anon');
  assert.deepEqual(anon, { laureats: 5, promos: 3, entreprises: 2 });
  assert.deepEqual(Object.keys(anon).sort(), ['entreprises', 'laureats', 'promos']);
  assert.deepEqual(await chiffres('authenticated'), anon);
  assert.doesNotMatch(JSON.stringify(anon), /Renault|OCP|Lauréat/);
});

test('entreprises : un début de mots seulement (pas un début de lettres), même total que la comparaison clé contre clé', async () => {
  const noms = ['A', 'A B', 'A B C', 'AB', 'Renault Tanger', 'Ren', 'OCP Safi', 'Lear Corporation Maroc', 'B C'];
  await db.transaction(async tx => {
    for (const [i, entreprise] of noms.entries()) {
      const id = L(40 + i);
      await tx.query('insert into auth.users (id, email) values ($1, $2)', [id, `chaine${i}@exemple.ma`]);
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [id]);
      await tx.exec('set local role authenticated');
      await tx.query(`insert into public.profiles (id, full_name, role, filiere, promo, entreprise) values ($1, $2, 'laureat', 'Génie Mécanique', 2017, $3)`, [id, `Chaîne ${i}`, entreprise]);
      await tx.exec('reset role');
    }
    const c = (await tx.query('select public.chiffres_publics() c')).rows[0].c;
    const clecle = (await tx.query(`with ks as (select distinct public.cle_entreprise(entreprise) k from public.profiles where role = 'laureat' and coalesce(public.cle_entreprise(entreprise), '') <> '')
      select count(*)::int n from ks a where not exists (select 1 from ks b where a.k like b.k || ' %')`)).rows[0].n;
    // renault, ocp, a, ab, ren, lear, b c (« a b », « a b c », « renault tanger (med) », « ocp safi » ont un début déjà compté)
    assert.equal(c.entreprises, 7);
    assert.equal(c.entreprises, clecle);
    await tx.rollback();
  });
  assert.deepEqual(await chiffres('anon'), { laureats: 5, promos: 3, entreprises: 2 });
});

test('sans compte, la table des profils reste illisible', async () => {
  const r = await en(db, null, tx => tx.query('select count(*)::int n from public.profiles'), { role: 'anon' }).catch(e => e);
  assert.ok(r instanceof Error ? /permission denied/.test(r.message) : r.rows[0].n === 0);
});

test('comptes pour l’administration : « par_code » distingue les codes demandés des anciens comptes', async () => {
  // Supabase donne aussi un mot de passe (tiré au hasard) aux comptes créés par code : il ne doit rien décider
  await db.query(`insert into auth.users (id, email, created_at, last_sign_in_at, encrypted_password, raw_user_meta_data) values
    ($1, 'code.jamais.entre@exemple.ma', now() - interval '2 days', now() - interval '2 days' + interval '300 milliseconds', '$2a$10$hasard', '{"par_code": true, "role_choisi": "etudiant"}'),
    ($2, 'ancien.mdp@exemple.ma', now() - interval '2 days', now() - interval '2 days' + interval '300 milliseconds', '$2a$10$abc', '{}')`, [uid(781), uid(782)]);
  const r = await en(db, L(7), tx => tx.query('select email, a_profil, par_code from public.admin_comptes() where email = any($1) order by email', [['code.jamais.entre@exemple.ma', 'ancien.mdp@exemple.ma']]));
  assert.deepEqual(r.rows.map(x => [x.email, x.par_code]), [['ancien.mdp@exemple.ma', false], ['code.jamais.entre@exemple.ma', true]]);
  await assert.rejects(en(db, L(1), tx => tx.query('select * from public.admin_comptes()')), /Réservé/);
});
