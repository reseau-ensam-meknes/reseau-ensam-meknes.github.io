// Administration d'une école (rôle admin d'une école autre que l'ENSAM Meknès) : ce qu'elle écrit dans les lignes de son
// école ne vise personne ni rien d'une autre école. Les colonnes qui visent une personne ou une ligne — le lauréat d'une
// aide proposée, l'auteur d'un entretien ou d'un avis de stage, l'offre d'un entretien, le recrutement d'un avis, la
// demande citée par un recrutement, l'aide retenue d'une demande, « invité par », « traité par » — refusent un id d'une
// autre école (« pas dans ton réseau »). Sans quoi l'administration de Casablanca mettait un lauréat de Meknès dans
// une aide acceptée (l'étudiant de Casablanca et lui lisaient alors leurs coordonnées), ouvrait un entretien de son
// école à un membre de Meknès, pourvoyait ou clôturait une demande de Meknès. Pour un membre et pour l'administration
// du réseau (qui garde tout), rien ne change.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const GI = 'Génie Industriel';
const RESEAU = uid(9701), AC = uid(9702);                  // administration du réseau ; administration de l'ENSAM Casablanca
const EM = uid(9711), LM = uid(9712);                      // Meknès : une étudiante, un lauréat
const EC = uid(9721), LC = uid(9722), EC2 = uid(9723);     // Casablanca : un étudiant, une lauréate, une étudiante
const F = {};

const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
// Essayé puis annulé : ce que l'action rend, sans rien garder (la base reste la même pour les tests suivants)
const ANNULE = Symbol('annulé');
const dans = async (u, fn) => {
  let r;
  await en(db, u, async tx => { r = await fn(tx); throw ANNULE; }).catch(e => { if (e !== ANNULE) throw e; });
  return r;
};
const essai = (u, sql, p) => dans(u, tx => tx.query(sql, p).then(r => r.rows));
const pasLa = /pas dans ton réseau/;
const refuse = (promesse, re = pasLa) => assert.rejects(promesse, re);
const un = async (sql, p) => (await db.query(sql, p)).rows[0]?.id;
const statut = async (t, id) => (await db.query(`select status from public.${t} where id = $1`, [id])).rows[0].status;

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: RESEAU, full_name: 'Admin Réseau', role: 'etudiant', filiere: GI, promo: 2010 });
  await creerCompte(db, { id: EM, full_name: 'Salma Meknès', role: 'etudiant', filiere: GI, promo: 2027 });
  await creerCompte(db, { id: LM, full_name: 'Youssef Meknès', role: 'laureat', filiere: GI, promo: 2016 });
  // L'ENSAM Casablanca, fermée : ouverte le temps des inscriptions
  await db.query(`update public.ecoles set ouverte = true where slug = 'ensam-casa'`);
  for (const [id, full_name, role, promo] of [[AC, 'Admin Casa', 'etudiant', 2010], [EC, 'Karim Casa', 'etudiant', 2027],
    [LC, 'Nadia Casa', 'laureat', 2016], [EC2, 'Imane Casa', 'etudiant', 2027]]) {
    await creerCompte(db, { id, full_name, role, filiere: GI, promo, ecole: 'ensam-casa' });
  }
  await db.query(`update public.ecoles set ouverte = false where slug = 'ensam-casa'`);
  await db.query(`update public.profiles set role = 'admin' where id = any($1::uuid[])`, [[RESEAU, AC]]);
  await db.query(`update public.profiles set verified = true where id = any($1::uuid[])`, [[LM, LC]]);
  await db.query(`insert into public.coordonnees (id, telephone, email) values ($1, '0600000000', 'youssef.prive@exemple.ma')`, [LM]);
  // Les lignes de chaque école, posées par la base (comme elle les aurait)
  for (const [k, ecole, etu, lau] of [['m', 'ensam-meknes', EM, LM], ['c', 'ensam-casa', EC, LC]]) {
    const o = F[k] = {};
    o.offre = await un(`insert into public.offers (author_id, type, titre, entreprise, description, ecole) values ($1, 'stage', 'Stage en logistique', 'Atlas Industrie', 'Six mois sur la chaîne logistique.', $2) returning id`, [lau, ecole]);
    o.demande = await un(`insert into public.demandes (auteur_id, type, titre, details, ecole) values ($1, 'stage', 'Cherche un stage', 'Un stage de fin d’études en logistique, dès juin.', $2) returning id`, [etu, ecole]);
    o.aide = await un(`insert into public.propositions (demande_id, laureat_id, aide, entreprise, message) values ($1, $2, 'recrute', 'Atlas Industrie', 'Je peux te prendre en stage cet été.') returning id`, [o.demande, lau]);
    o.entretien = await un(`insert into public.entretiens (author_id, entreprise, questions, ecole) values ($1, 'Atlas Industrie', '{"Parle-moi de toi"}', $2) returning id`, [etu, ecole]);
    o.avis = await un(`insert into public.avis_stage (author_id, entreprise, saison, note, ecole) values ($1, $3, 2025, 4, $2) returning id`, [etu, ecole, k === 'm' ? 'Lear' : 'Renault']);
    o.recrutement = await un(`insert into public.placements (student_id, laureat_id, entreprise, saison, niveau, type, source, status) values ($1, $2, 'Atlas Industrie', 2025, 4, 'stage', 'plateforme', 'en_attente') returning id`, [etu, lau]);
    o.signalement = await un(`insert into public.signalements (auteur_id, cible_type, cible_id, motif) values ($1, 'offre', $2, 'spam') returning id`, [etu, o.offre]);
  }
  // À Meknès, l'aide est acceptée : la demande est en match avec elle
  await db.query(`update public.propositions set status = 'acceptee' where id = $1`, [F.m.aide]);
  await db.query(`insert into public.applications (student_id, offer_id, entreprise) values ($1, $2, 'Atlas Industrie')`, [EM, F.m.offre]);
});

test('aide proposée : l’administration de Casablanca n’y met pas un lauréat de Meknès (ses coordonnées restent à lui)', async () => {
  const { c, m } = F;
  // Une aide acceptée au nom d'un lauréat de Meknès, sur une demande de Casablanca (déjà refusée par la règle d'écriture :
  // une aide se pose à son propre nom)
  await refuse(essai(AC, `insert into public.propositions (demande_id, laureat_id, aide, entreprise, message, status) values ($1, $2, 'recommande', 'Casa SA', 'Je peux t’aider pour ce stage.', 'acceptee')`, [c.demande, LM]),
    /pas dans ton réseau|row-level security/);
  // Ou à son propre nom, puis le lauréat de Meknès à sa place
  await refuse(dans(AC, async tx => {
    const [x] = (await tx.query(`insert into public.propositions (demande_id, laureat_id, aide, entreprise, message, status) values ($1, $2, 'recommande', 'Casa SA', 'Je peux t’aider pour ce stage.', 'acceptee') returning id`, [c.demande, AC])).rows;
    await tx.query('update public.propositions set laureat_id = $2 where id = $1', [x.id, LM]);
  }));
  await refuse(essai(AC, 'update public.propositions set laureat_id = $2 where id = $1', [c.aide, LM]));
  // L'étudiant de Casablanca ne lit pas les coordonnées du lauréat de Meknès, ni lui les siennes
  assert.deepEqual(await q(EC, 'select telephone from public.coordonnees where id = $1', [LM]), []);
  assert.equal((await q(EC, 'select public.en_relation($1, $2) x', [EC, LM]))[0].x, false);
  // Dans son école : permis (une lauréate de son école, ou elle-même)
  assert.deepEqual(await essai(AC, 'update public.propositions set laureat_id = $2 where id = $1 returning laureat_id', [c.aide, AC]), [{ laureat_id: AC }]);
  assert.equal((await essai(AC, `insert into public.propositions (demande_id, laureat_id, aide, entreprise, message) values ($1, $2, 'recommande', 'Casa SA', 'Je peux t’aider pour ce stage.') returning status`, [c.demande, AC]))[0].status, 'envoyee');
  // Le statut d'une aide de son école, sans toucher au lauréat : permis
  assert.deepEqual(await essai(AC, `update public.propositions set status = 'close' where id = $1 returning status`, [c.aide]), [{ status: 'close' }]);
  // L'administration du réseau : comme avant
  assert.deepEqual(await essai(RESEAU, 'update public.propositions set laureat_id = $2 where id = $1 returning laureat_id', [c.aide, LM]), [{ laureat_id: LM }]);
  assert.deepEqual(await essai(RESEAU, 'update public.propositions set laureat_id = $2 where id = $1 returning laureat_id', [m.aide, LC]), [{ laureat_id: LC }]);
});

test('entretiens et avis de stage : l’auteur reste de l’école, l’offre d’un entretien et le recrutement d’un avis aussi', async () => {
  const { c, m } = F;
  // Un entretien ou un avis de Casablanca attribué à un membre de Meknès : il le lirait (règle de l'auteur) et son propre avis
  // sur cette entreprise et cette saison serait refusé
  await refuse(essai(AC, 'update public.entretiens set author_id = $2 where id = $1', [c.entretien, EM]));
  await refuse(essai(AC, 'update public.avis_stage set author_id = $2 where id = $1', [c.avis, EM]));
  // L'offre d'un entretien, le recrutement d'un avis : de son école
  await refuse(essai(AC, 'update public.entretiens set offer_id = $2 where id = $1', [c.entretien, m.offre]));
  await refuse(essai(AC, `insert into public.entretiens (author_id, entreprise, questions, offer_id) values ($1, 'Atlas Industrie', '{"Pourquoi nous ?"}', $2)`, [AC, m.offre]));
  await refuse(essai(AC, 'update public.avis_stage set placement_id = $2 where id = $1', [c.avis, m.recrutement]));
  // Dans son école : permis
  assert.deepEqual(await essai(AC, 'update public.entretiens set author_id = $2, offer_id = $3 where id = $1 returning author_id, offer_id', [c.entretien, EC2, c.offre]),
    [{ author_id: EC2, offer_id: c.offre }]);
  assert.deepEqual(await essai(AC, 'update public.avis_stage set author_id = $2 where id = $1 returning author_id', [c.avis, EC2]), [{ author_id: EC2 }]);
  assert.deepEqual(await essai(AC, `update public.entretiens set conseils = 'Revu' where id = $1 returning conseils`, [c.entretien]), [{ conseils: 'Revu' }]);
  // L'administration du réseau : comme avant
  assert.deepEqual(await essai(RESEAU, 'update public.entretiens set author_id = $2 where id = $1 returning author_id', [c.entretien, EM]), [{ author_id: EM }]);
  assert.deepEqual(await essai(RESEAU, 'update public.avis_stage set author_id = $2 where id = $1 returning author_id', [c.avis, EM]), [{ author_id: EM }]);
  // Un membre : comme avant. L'offre d'un entretien reste celle d'une candidature ; une autre (d'une autre école, ou
  // supprimée entre-temps) est retirée sans bruit
  const offre = (u, o) => essai(u, `insert into public.entretiens (author_id, entreprise, questions, offer_id) values ($1, 'Atlas Industrie', '{"Pourquoi nous ?"}', $2) returning offer_id`, [u, o]).then(r => r[0].offer_id);
  assert.equal(await offre(EM, m.offre), m.offre);
  assert.equal(await offre(EM, c.offre), null);
  assert.equal(await offre(EM, uid(9799)), null);
  // Son propre avis sur l'entreprise et la saison de l'avis de Casablanca : pas bloqué par un avis d'une autre école mis à son nom
  assert.equal((await essai(EM, `insert into public.avis_stage (author_id, entreprise, saison, note) values ($1, 'Renault', 2025, 5) returning author_id`, [EM]))[0].author_id, EM);
});

test('recrutement : la demande citée est de l’école ; confirmé, il ne pourvoit pas une demande de Meknès', async () => {
  const { c, m } = F;
  const recrute = (u, etu, d, status = 'confirme') => essai(u, `insert into public.placements (student_id, entreprise, saison, niveau, type, status, demande_id)
    values ($1, 'Casa SA', 2026, 4, 'stage', $3, $2) returning id, status`, [etu, d, status]);
  await refuse(recrute(AC, EC, m.demande));
  await refuse(essai(AC, 'update public.placements set demande_id = $2 where id = $1', [c.recrutement, m.demande]));
  // Un recrutement de Casablanca qui cite déjà une demande de Meknès (posé par la base) : le confirmer est refusé
  await refuse(dans(AC, async tx => {
    await tx.exec('reset role');
    await tx.query(`select set_config('request.jwt.claim.sub', '', true)`);
    const [x] = (await tx.query(`insert into public.placements (student_id, entreprise, saison, niveau, type, status, demande_id) values ($1, 'Casa SA', 2026, 4, 'stage', 'en_attente', $2) returning id`, [EC2, m.demande])).rows;
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [AC]);
    await tx.exec('set local role authenticated');
    await tx.query(`update public.placements set status = 'confirme' where id = $1`, [x.id]);
  }));
  // Un étudiant de Casablanca non plus
  await refuse(essai(EC, `insert into public.placements (student_id, entreprise, saison, niveau, type, demande_id) values ($1, 'Casa SA', 2026, 4, 'stage', $2)`, [EC, m.demande]));
  assert.equal(await statut('demandes', m.demande), 'match', 'la demande de Meknès reste en cours');
  // La demande de l'étudiant lui-même, dans son école : permis, et elle est pourvue
  assert.equal(await dans(AC, async tx => {
    await tx.query(`insert into public.placements (student_id, entreprise, saison, niveau, type, status, demande_id) values ($1, 'Casa SA', 2026, 4, 'stage', 'confirme', $2)`, [EC, c.demande]);
    return (await tx.query('select status from public.demandes where id = $1', [c.demande])).rows[0].status;
  }), 'pourvue');
  // La demande d'un autre étudiant de son école : refusée (comme pour un lauréat, celle de l'étudiant recruté)
  await refuse(recrute(AC, EC2, c.demande), /pas celle de cet étudiant/);
  assert.deepEqual(await essai(AC, 'update public.placements set demande_id = $2 where id = $1 returning demande_id', [c.recrutement, c.demande]), [{ demande_id: c.demande }]);
  await refuse(essai(AC, 'update public.placements set student_id = $2, demande_id = $3 where id = $1', [c.recrutement, EC2, c.demande]), /pas celle de cet étudiant/);
  // L'administration du réseau : comme avant (une demande de Meknès citée par un recrutement de Casablanca)
  assert.equal(await dans(RESEAU, async tx => {
    await tx.query(`insert into public.placements (student_id, entreprise, saison, niveau, type, status, demande_id) values ($1, 'Casa SA', 2026, 4, 'stage', 'confirme', $2)`, [EC2, m.demande]);
    return (await tx.query('select status from public.demandes where id = $1', [m.demande])).rows[0].status;
  }), 'pourvue');
});

test('aide retenue d’une demande : une aide de cette demande, jamais une aide de Meknès (que la fin de la demande clôturerait)', async () => {
  const { c, m } = F;
  await refuse(essai(AC, 'update public.demandes set proposition_id = $2 where id = $1', [c.demande, m.aide]), /pas une aide de cette demande/);
  // Ce que cela permettait : la demande de Casablanca « en match » avec l'aide de Meknès, puis fermée, clôturait cette aide
  await refuse(dans(AC, async tx => {
    await tx.query(`update public.demandes set status = 'match', laureat_id = $2, proposition_id = $3 where id = $1`, [c.demande, LC, m.aide]);
    await tx.query(`update public.demandes set status = 'fermee' where id = $1`, [c.demande]);
  }), /pas une aide de cette demande/);
  assert.equal(await statut('propositions', m.aide), 'acceptee');
  // Une aide de cette demande, ou aucune : permis
  assert.deepEqual(await essai(AC, 'update public.demandes set proposition_id = $2 where id = $1 returning proposition_id', [c.demande, c.aide]), [{ proposition_id: c.aide }]);
  assert.deepEqual(await essai(AC, 'update public.demandes set proposition_id = null where id = $1 returning proposition_id', [c.demande]), [{ proposition_id: null }]);
  assert.deepEqual(await essai(AC, `update public.demandes set lieu = 'Casablanca' where id = $1 returning lieu`, [c.demande]), [{ lieu: 'Casablanca' }]);
  // L'administration du réseau : comme avant
  assert.deepEqual(await essai(RESEAU, 'update public.demandes set proposition_id = $2 where id = $1 returning proposition_id', [c.demande, m.aide]), [{ proposition_id: m.aide }]);
  // La suite automatique (l'étudiant accepte l'aide) pose toujours l'aide retenue
  assert.deepEqual(await dans(EC, async tx => {
    await tx.query(`update public.propositions set status = 'acceptee' where id = $1`, [c.aide]);
    return (await tx.query('select status, proposition_id from public.demandes where id = $1', [c.demande])).rows;
  }), [{ status: 'match', proposition_id: c.aide }]);
});

test('« invité par », « traité par » : personne d’une autre école', async () => {
  const { c } = F;
  await refuse(essai(AC, 'update public.profiles set invite_par = $2 where id = $1', [EC, LM]));
  assert.deepEqual(await essai(AC, 'update public.profiles set invite_par = $2 where id = $1 returning invite_par', [EC, LC]), [{ invite_par: LC }]);
  assert.deepEqual(await essai(RESEAU, 'update public.profiles set invite_par = $2 where id = $1 returning invite_par', [EC, LM]), [{ invite_par: LM }]);
  await refuse(essai(AC, 'update public.signalements set traite_par = $2 where id = $1', [c.signalement, LM]));
  assert.deepEqual(await essai(AC, `update public.signalements set status = 'traite' where id = $1 returning traite_par`, [c.signalement]), [{ traite_par: AC }]);
  assert.deepEqual(await essai(RESEAU, `update public.signalements set traite_par = $2 where id = $1 returning traite_par`, [c.signalement, LM]), [{ traite_par: LM }]);
  // Son propre profil : comme avant (sa présentation)
  assert.deepEqual(await essai(AC, `update public.profiles set bio = 'Administration de Casablanca' where id = $1 returning bio`, [AC]), [{ bio: 'Administration de Casablanca' }]);
});

test('un membre : les mêmes gestes qu’avant (aide, recrutement depuis une demande, entretien, avis)', async () => {
  const { m } = F;
  // Le lauréat de Meknès déclare le recrutement de la demande en match avec lui ; l'étudiante le confirme : la demande est pourvue
  const r = await dans(LM, async tx => {
    const [x] = (await tx.query(`insert into public.placements (student_id, laureat_id, demande_id, entreprise, saison, niveau, type, source) values ($1, $2, $3, 'Atlas Industrie', 2026, 4, 'stage', 'plateforme') returning id, status, aide`, [EM, LM, m.demande])).rows;
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [EM]);
    await tx.query(`update public.placements set status = 'confirme' where id = $1`, [x.id]);
    return { ...x, demande: (await tx.query('select status from public.demandes where id = $1', [m.demande])).rows[0].status };
  });
  assert.deepEqual({ status: r.status, aide: r.aide, demande: r.demande }, { status: 'en_attente', aide: 'recrute', demande: 'pourvue' });
  // L'auteur d'un entretien ou d'un avis : soi-même, toujours
  assert.equal((await essai(EM, `insert into public.entretiens (author_id, entreprise, questions) values ($1, 'Atlas Industrie', '{"Pourquoi nous ?"}') returning author_id`, [EM]))[0].author_id, EM);
  assert.deepEqual(await essai(EM, `update public.entretiens set conseils = 'Préparer la VSM' where id = $1 returning author_id, conseils`, [m.entretien]), [{ author_id: EM, conseils: 'Préparer la VSM' }]);
});
