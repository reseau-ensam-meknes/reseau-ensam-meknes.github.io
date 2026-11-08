// Une ligne qui vient sous un contenu (réponse, vote, réaction, bravo, inscription à un café ou à un événement) ou qui
// concerne un membre (recrutement déclaré pour un étudiant, confirmation d'un lauréat) est de l'école de ce contenu ou de
// ce membre, même écrite par l'administration du réseau (ENSAM Meknès) dans une autre école : sinon elle serait de
// l'ENSAM Meknès (l'école de qui écrit, la valeur par défaut), invisible pour les membres de l'école concernée.
// Pour un membre, rien ne change : garde_ecole lui refuse déjà le contenu d'une autre école.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const AM = uid(9301), EM = uid(9302), CE = uid(9303), CL = uid(9304), CL2 = uid(9305), CL3 = uid(9306);
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const un = (u, sql, p) => q(u, sql, p).then(r => r[0]);
const C = {};

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: AM, full_name: 'Admin Réseau', role: 'etudiant', filiere: 'Génie Industriel', promo: 2010 });
  await creerCompte(db, { id: EM, full_name: 'Salma Meknès', role: 'etudiant', filiere: 'Génie Industriel', promo: 2027 });
  await db.query(`update public.ecoles set ouverte = true where slug = 'ensam-casa'`);
  await creerCompte(db, { id: CE, full_name: 'Amine Casa', role: 'etudiant', filiere: 'Génie Industriel', promo: 2027, ecole: 'ensam-casa' });
  for (const [id, n] of [[CL, 'Nadia Casa'], [CL2, 'Omar Casa'], [CL3, 'Hiba Casa']])
    await creerCompte(db, { id, full_name: n, role: 'laureat', filiere: 'Génie Industriel', promo: 2015, ecole: 'ensam-casa' });
  await db.query(`update public.ecoles set ouverte = false where slug = 'ensam-casa'`);
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [AM]);
  await db.query(`update public.profiles set verified = true where id = any($1)`, [[CL2, CL3]]);
  // Le contenu de l'ENSAM Casablanca, écrit par ses membres (et un événement publié pour elle depuis la console)
  C.question = await un(CE, `insert into public.questions (author_id, categorie, titre) values ($1, 'stage', 'Un stage à Casablanca ?') returning id, ecole`, [CE]);
  C.reponse = await un(CL, `insert into public.answers (question_id, author_id, body) values ($1, $2, 'Oui, chez OCP.') returning id, ecole`, [C.question.id, CL]);
  C.offre = await un(CL, `insert into public.offers (author_id, type, titre, entreprise, description, annees) values ($1, 'stage', 'Stage maintenance', 'OCP', 'Mission.', '{4}') returning id, ecole`, [CL]);
  C.recrutement = await un(CL, `insert into public.placements (student_id, laureat_id, offer_id, saison, niveau, type, entreprise, source)
    values ($1, $2, $3, $4, 4, 'stage', 'OCP', 'plateforme') returning id, ecole`, [CE, CL, C.offre.id, S]);
  C.cafe = await un(CL, `insert into public.cafes (organisateur_id, ville, lieu, date_at) values ($1, 'Casablanca', 'Café du port', now() + interval '3 days') returning id, ecole`, [CL]);
  C.evenement = await un(AM, `insert into public.evenements (author_id, titre, debut, ecole) values ($1, 'Forum Casa', now() + interval '5 days', 'ensam-casa') returning id, ecole`, [AM]);
  for (const k of Object.keys(C)) assert.equal(C[k].ecole, 'ensam-casa', k);
});

test('l’administration du réseau écrit sous le contenu d’une autre école : la ligne est de cette école', async () => {
  const lignes = {
    reponse: await un(AM, `insert into public.answers (question_id, author_id, body) values ($1, $2, 'La réponse de l’administration.') returning id, ecole`, [C.question.id, AM]),
    vote: await un(AM, 'insert into public.votes (answer_id, user_id) values ($1, $2) returning id, ecole', [C.reponse.id, AM]),
    reaction: await un(AM, `insert into public.reactions (offer_id, user_id, kind) values ($1, $2, 'utile') returning id, ecole`, [C.offre.id, AM]),
    bravo: await un(AM, 'insert into public.kudos (placement_id, user_id) values ($1, $2) returning id, ecole', [C.recrutement.id, AM]),
    cafe: await un(AM, 'insert into public.cafe_participants (cafe_id, user_id) values ($1, $2) returning id, ecole', [C.cafe.id, CE]),
    evenement: await un(AM, 'insert into public.evenement_participants (evenement_id, user_id) values ($1, $2) returning id, ecole', [C.evenement.id, CE]),
    // (une réussite par saison : celle d'avant)
    recrutement: await un(AM, `insert into public.placements (student_id, laureat_id, saison, niveau, type, entreprise, source)
      values ($1, $2, $3, 3, 'stage', 'Lear', 'plateforme') returning id, ecole`, [CE, CL2, S - 1]),
    confirmation: await un(AM, 'insert into public.verifications_pairs (laureat_id, verificateur_id) values ($1, $2) returning id, ecole', [CL, CL2]),
  };
  for (const [k, l] of Object.entries(lignes)) assert.equal(l.ecole, 'ensam-casa', k);
  // Les membres de l'école les voient ; un membre de l'ENSAM Meknès, non
  const voit = async (u, t, id) => (await q(u, `select id from public.${t} where id = $1`, [id])).length === 1;
  for (const [k, t] of [['reponse', 'answers'], ['vote', 'votes'], ['reaction', 'reactions'], ['bravo', 'kudos'], ['cafe', 'cafe_participants'],
    ['evenement', 'evenement_participants'], ['recrutement', 'placements'], ['confirmation', 'verifications_pairs']]) {
    assert.equal(await voit(CE, t, lignes[k].id) || await voit(CL, t, lignes[k].id), true, k);
    assert.equal(await voit(EM, t, lignes[k].id), false, k);
  }
});

test('sous le contenu de son école, l’administration écrit comme avant ; un membre, comme avant', async () => {
  const [qm] = await q(EM, `insert into public.questions (author_id, categorie, titre) values ($1, 'stage', 'Un stage à Meknès ?') returning id`, [EM]);
  assert.equal((await un(AM, `insert into public.answers (question_id, author_id, body) values ($1, $2, 'Oui.') returning ecole`, [qm.id, AM])).ecole, 'ensam-meknes');
  assert.equal((await un(CL3, `insert into public.answers (question_id, author_id, body) values ($1, $2, 'Chez Lear aussi.') returning ecole`, [C.question.id, CL3])).ecole, 'ensam-casa');
  // Un membre d'une autre école : toujours refusé, et l'école donnée à la main ne passe pas
  await assert.rejects(q(EM, `insert into public.answers (question_id, author_id, body) values ($1, $2, 'Moi aussi.')`, [C.question.id, EM]), /pas dans ton réseau/);
  await assert.rejects(q(EM, `insert into public.questions (author_id, categorie, titre, ecole) values ($1, 'stage', 'Ailleurs ?', 'ensam-casa')`, [EM]), /row-level security/);
  // Une ligne écrite par la base (sans membre connecté) prend aussi l'école du contenu
  const [v] = (await db.query('insert into public.votes (answer_id, user_id) values ($1, $2) returning ecole', [C.reponse.id, CE])).rows;
  assert.equal(v.ecole, 'ensam-casa');
});
