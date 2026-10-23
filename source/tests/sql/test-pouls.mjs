// « Cette semaine dans le réseau » : pouls_reseau() donne le même chiffre à tous, et le même que poulsReseau() dans logic.js.
// Annonces : un public (tous, étudiants, lauréats), « tous » par défaut.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, creerCompte, en, uid } from './banc-sql.mjs';
import { poulsReseau } from '../../src/logic.js';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const [L1, L2, L3, L4, S1, S2, S3, ADM] = [71, 72, 73, 74, 75, 76, 77, 78].map(uid);
const ilYa = j => new Date(Date.now() - j * 864e5).toISOString();
const pouls = u => en(db, u, tx => tx.query('select public.pouls_reseau() p')).then(r => r.rows[0].p);
const service = sql => en(db, null, tx => tx.query(sql), { role: 'service_role' }).then(r => r.rows);

before(async () => {
  db = await nouvelleBase(SCHEMA);
  const lau = (id, n) => creerCompte(db, { id, full_name: `Lauréat ${n}`, role: 'laureat', filiere: 'Génie Mécanique', promo: 2016 + n });
  const etu = (id, n) => creerCompte(db, { id, full_name: `Étudiant ${n}`, role: 'etudiant', filiere: 'Génie Mécanique', promo: 2027 });
  await lau(L1, 1); await lau(L2, 2); await lau(L3, 3); await lau(L4, 4);
  await etu(S1, 1); await etu(S2, 2); await etu(S3, 3);
  await creerCompte(db, { id: ADM, full_name: 'Bureau', role: 'etudiant', filiere: 'Génie Industriel', promo: 2027 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADM]);
  // Les lignes d'aide sont posées telles quelles (les triggers de saisie sont testés ailleurs)
  await db.exec('set session_replication_role = replica');
  const m = (mentor, etudiant, rdv, status = 'acceptee') => db.query(`insert into public.mentorships (student_id, mentor_id, sujet, status, rdv_at, accepted_at) values ($1, $2, 'Conseil', $3, $4, $4)`, [etudiant, mentor, status, rdv]);
  await m(L1, S1, ilYa(2));                                   // rendez-vous passé : une aide
  await m(L1, S3, new Date(Date.now() + 2 * 864e5).toISOString()); // à venir : pas encore
  await m(ADM, S3, ilYa(1));                                  // l'administration n'est pas un lauréat
  await m(L2, L3, ilYa(1), 'terminee');                       // d'un lauréat vers un lauréat : non
  await db.query(`insert into public.relectures_cv (student_id, reviewer_id, cv_path, status, rendue_at) values ($1, $2, 'x.pdf', 'rendue', $3)`, [S2, L2, ilYa(1)]);
  await db.query(`insert into public.placements (student_id, laureat_id, saison, niveau, type, entreprise, source, status, confirmed_at) values ($1, $2, 2026, 5, 'pfe', 'Renault', 'plateforme', 'confirme', $3)`, [S1, L3, ilYa(3)]);
  const [d] = (await db.query(`insert into public.demandes (auteur_id, type, titre, details) values ($1, 'pfe', 'PFE énergie', 'Je cherche un PFE en énergétique industrielle.') returning id`, [S2])).rows;
  await db.query(`insert into public.propositions (demande_id, laureat_id, aide, entreprise, message, status, repondu_at) values ($1, $2, 'encadre', 'OCP', 'Je peux t’encadrer.', 'acceptee', $3)`, [d.id, L4, ilYa(0.5)]);
  await db.exec('set session_replication_role = origin');
});

// Les mêmes lignes, lues par le service, passées au calcul de l'appli
async function calculAppli() {
  const [profiles, mentorships, relectures_cv, placements, demandes, propositions] = await Promise.all(
    ['profiles', 'mentorships', 'relectures_cv', 'placements', 'demandes', 'propositions'].map(t => service(`select * from public.${t}`)));
  const iso = rows => rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])));
  return poulsReseau({ profiles, mentorships: iso(mentorships), relectures_cv: iso(relectures_cv), placements: iso(placements), demandes, propositions: iso(propositions) });
}

test('pouls_reseau : que des aides d’un lauréat vers un étudiant, passées, sur 7 jours', async () => {
  const p = await pouls(S3);
  assert.equal(p.jours, 7);
  assert.equal(p.nb_aidants, 4, 'L1 (rendez-vous), L2 (relecture), L3 (recrutement), L4 (proposition acceptée)');
  assert.equal(p.nb_aides, 2, 'S1 et S2 ; S3 n’a eu que l’administration et un rendez-vous à venir');
  assert.equal(p.recrutes, 1);
  assert.deepEqual(p.aidants, [L4, L2, L1, L3], 'l’aide la plus récente d’abord, quatre au plus');
  assert.deepEqual(await pouls(L1), p, 'le même chiffre pour tout le monde');
  const js = await calculAppli();
  assert.deepEqual([js.jours, js.nbAidants, js.nbAides, js.recrutes, js.aidants], [p.jours, p.nb_aidants, p.nb_aides, p.recrutes, p.aidants], 'le même calcul que l’appli');
});

test('pouls_reseau : moins de deux aidants cette semaine, on regarde le mois', async () => {
  await db.query(`update public.relectures_cv set rendue_at = $1`, [ilYa(20)]);
  await db.query(`update public.placements set confirmed_at = $1`, [ilYa(25)]);
  await db.query(`update public.propositions set repondu_at = $1`, [ilYa(40)]);
  const p = await pouls(S1);
  assert.deepEqual([p.jours, p.nb_aidants, p.nb_aides, p.recrutes], [30, 3, 2, 1], 'L4 est hors du mois');
  const js = await calculAppli();
  assert.deepEqual([js.jours, js.nbAidants, js.nbAides, js.aidants], [p.jours, p.nb_aidants, p.nb_aides, p.aidants]);
});

test('pouls_reseau : rien pour un visiteur', async () => {
  await assert.rejects(en(db, null, tx => tx.query('select public.pouls_reseau()'), { role: 'anon' }), /permission denied/);
  assert.equal(await pouls(null), null, 'connecté sans identité : rien');
});

test('annonces : un public, « tous » par défaut, rien d’autre', async () => {
  const [a] = await service(`insert into public.annonces (texte) values ('Forum entreprises jeudi') returning public`);
  assert.equal(a.public, 'tous');
  await service(`insert into public.annonces (texte, public) values ('Pour les 5A', 'etudiants')`);
  await assert.rejects(service(`insert into public.annonces (texte, public) values ('x', 'autres')`), /annonces_public_check/);
});
