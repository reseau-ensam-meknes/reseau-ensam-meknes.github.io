// Demandes des étudiants : publier ce qu'on cherche, aides proposées par les lauréats, match,
// démarrage confirmé des deux côtés (réussite), arrêt et reprise, qui voit quoi, email aux lauréats
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const ETU = uid(91), ETU3 = uid(92), AUTRE = uid(93), L1 = uid(94), L2 = uid(95), CIVIL = uid(96), CHERCHE = uid(97), ADMIN = uid(98);
const GI = 'Génie Industriel et Productique', GI_ANCIEN = 'Génie Industriel', GC = 'Génie Civil';
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const refuse = async (promesse, re) => { await assert.rejects(promesse, e => (re ? re.test(e.message) : true) || assert.fail(e.message)); };
const cv = id => `${id}/cv-1730000000000.pdf`;
const publier = (u, champs = {}) => q(u, `insert into public.demandes (auteur_id, type, titre, details, lieu) values ($1, $2, $3, $4, $5) returning *`,
  [u, champs.type || 'pfe', champs.titre || 'PFE en amélioration continue', champs.details || 'Lean, VSM et Power BI : je cherche un PFE en usine, de février à juin.', champs.lieu || 'Casablanca ou Tanger']).then(r => r[0]);
const proposer = (u, d, champs = {}) => q(u, `insert into public.propositions (demande_id, laureat_id, aide, entreprise, poste, message) values ($1, $2, $3, $4, $5, $6) returning *`,
  [d, u, champs.aide || 'encadre', champs.entreprise || 'Renault', champs.poste || 'PFE méthodes', champs.message || 'Bonjour, j’ai un sujet de PFE Lean dans mon équipe.']).then(r => r[0]);
const pushs = async (kind, user) => (await db.query('select user_id, data from public.push_queue where kind = $1' + (user ? ' and user_id = $2' : ''), user ? [kind, user] : [kind])).rows;
const demande = async id => (await db.query('select * from public.demandes where id = $1', [id])).rows[0];

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ETU, full_name: 'Salma Bennani', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: ETU3, full_name: 'Amine Idrissi', role: 'etudiant', filiere: GI, promo: S + 3 });
  await creerCompte(db, { id: AUTRE, full_name: 'Hiba Alaoui', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: L1, full_name: 'Youssef Amrani', role: 'laureat', filiere: GI_ANCIEN, promo: 2015, entreprise: 'Renault' });
  await creerCompte(db, { id: L2, full_name: 'Karim Tazi', role: 'laureat', filiere: GI, promo: 2018, entreprise: 'OCP' });
  await creerCompte(db, { id: CIVIL, full_name: 'Nadia Civil', role: 'laureat', filiere: GC, promo: 2016 });
  await creerCompte(db, { id: CHERCHE, full_name: 'Halima Cherche', role: 'laureat', filiere: GI, promo: 2020 });
  await creerCompte(db, { id: ADMIN, full_name: 'Admin École', role: 'etudiant', filiere: GI, promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  for (const id of [ETU, ETU3, AUTRE, CHERCHE]) await db.query('update public.profiles set cv_path = $2 where id = $1', [id, cv(id)]);
  await db.query('update public.profiles set cv_path = null where id = $1', [ETU3]);
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://push.example/' || id, 'k', 'a' from public.profiles`);
});

test('publier : le type suit l’année, le CV est obligatoire, 2 demandes en cours au plus ; les lauréats du parcours sont prévenus', async () => {
  await db.query('delete from public.push_queue');
  await refuse(publier(ETU, { type: 'stage' }), /ne correspond pas à ton année/);
  await refuse(publier(ETU3, { type: 'stage' }), /Dépose d’abord ton CV/);
  await refuse(publier(L1, { type: 'emploi' }), /ne correspond pas à ton année/);
  const d = await publier(ETU);
  assert.equal(d.status, 'ouverte');
  assert.equal(d.auteur_id, ETU);
  // Prévenus : les lauréats du même parcours (ancienne appellation comprise), pas ceux d'un autre parcours
  assert.deepEqual((await pushs('demande_nouvelle')).map(x => x.user_id).sort(), [L1, L2, CHERCHE].sort());
  assert.equal((await pushs('demande_nouvelle'))[0].data.nom, 'Salma');
  const d2 = await publier(ETU, { type: 'etranger', titre: 'Stage d’été en Allemagne', lieu: 'Allemagne' });
  await refuse(publier(ETU, { type: 'emploi', titre: 'Pré-embauche' }), /déjà 2 demandes en cours/);
  // Les lauréats voient les demandes ; un autre étudiant, non
  assert.equal((await q(CIVIL, 'select id from public.demandes')).length, 2);
  assert.equal((await q(AUTRE, 'select id from public.demandes')).length, 0);
  // L'auteur la ferme, puis la rouvre ; personne d'autre ne la change
  await q(L1, `update public.demandes set status = 'fermee' where id = $1`, [d2.id]);
  assert.equal((await demande(d2.id)).status, 'ouverte');
  await q(ETU, `update public.demandes set status = 'fermee' where id = $1`, [d2.id]);
  assert.equal((await demande(d2.id)).status, 'fermee');
  await q(ETU, `delete from public.demandes where id = $1`, [d2.id]);
  assert.equal(await demande(d2.id), undefined);
  // Lauréat qui cherche un emploi : une demande d'emploi seulement
  await refuse(publier(CHERCHE, { type: 'emploi', titre: 'Poste méthodes' }), /ne correspond pas/);
  await q(CHERCHE, 'update public.profiles set en_recherche = true where id = $1', [CHERCHE]);
  const e = await publier(CHERCHE, { type: 'emploi', titre: 'Ingénieur méthodes à Kénitra' });
  assert.equal((await q(L2, 'select id from public.demandes where id = $1', [e.id])).length, 1);
  await q(CHERCHE, `delete from public.demandes where id = $1`, [e.id]);
});

test('aider : le mot du lauréat arrive en message, l’étudiant accepte une aide (match), les autres sont closes', async () => {
  const d = (await q(ETU, `select * from public.demandes where auteur_id = $1 and status = 'ouverte'`, [ETU]))[0];
  await db.query('delete from public.push_queue');
  await refuse(proposer(ETU, d.id), /Seul un lauréat/);
  const p1 = await proposer(L1, d.id);
  assert.equal(p1.status, 'envoyee');
  await refuse(proposer(L1, d.id), /duplicate|unique/);
  const p2 = await proposer(L2, d.id, { aide: 'recrute', entreprise: 'OCP', message: 'Notre usine de Jorf cherche un PFE, ça te dit ?' });
  // Message dans la messagerie, une seule notification (celle de l'aide, pas celle du message)
  const msgs = await q(ETU, 'select author_id, body from public.messages where dest_id = $1 order by created_at', [ETU]);
  assert.deepEqual(msgs.map(m => m.author_id), [L1, L2]);
  assert.equal(msgs[0].body, 'Bonjour, j’ai un sujet de PFE Lean dans mon équipe.');
  assert.equal((await pushs('message')).length, 0);
  assert.deepEqual((await pushs('demande_proposition', ETU)).map(x => x.data.nom).sort(), ['Karim Tazi', 'Youssef Amrani']);
  // Chacun voit ses aides ; l'étudiant voit les deux ; un autre lauréat aucune
  assert.equal((await q(L1, 'select id from public.propositions')).length, 1);
  assert.equal((await q(ETU, 'select id from public.propositions')).length, 2);
  assert.equal((await q(CIVIL, 'select id from public.propositions')).length, 0);
  // Conversation ouverte dans les deux sens
  await q(ETU, `insert into public.messages (author_id, dest_id, type, body) values ($1, $2, 'texte', 'Merci ! Quelles dates ?')`, [ETU, L2]);
  // Un lauréat ne s'accepte pas lui-même ; l'étudiant accepte Youssef
  await q(L1, `update public.propositions set status = 'acceptee' where id = $1`, [p1.id]);
  assert.equal((await demande(d.id)).status, 'ouverte');
  await q(ETU, `update public.propositions set status = 'acceptee' where id = $1`, [p1.id]);
  const m = await demande(d.id);
  assert.deepEqual([m.status, m.laureat_id, m.proposition_id], ['match', L1, p1.id]);
  assert.ok(m.match_at);
  assert.equal((await db.query('select status from public.propositions where id = $1', [p2.id])).rows[0].status, 'close');
  assert.equal((await pushs('demande_match', L1)).length, 1);
  await refuse(q(ETU, `update public.propositions set status = 'acceptee' where id = $1`, [p2.id]).then(() => db.query('select status from public.propositions where id = $1', [p2.id])).then(r => { if (r.rows[0].status !== 'acceptee') throw new Error('refusé'); }), /refusé/);
  await refuse(proposer(CIVIL, d.id), /n’est plus ouverte/);
  // Match : coordonnées visibles l'un de l'autre
  await q(ETU, `insert into public.coordonnees (id, telephone) values ($1, '0611223344')`, [ETU]);
  await q(L1, `insert into public.coordonnees (id, telephone) values ($1, '0622334455')`, [L1]);
  assert.equal((await q(L1, 'select telephone from public.coordonnees where id = $1', [ETU]))[0]?.telephone, '0611223344');
  assert.equal((await q(ETU, 'select telephone from public.coordonnees where id = $1', [L1]))[0]?.telephone, '0622334455');
  assert.equal((await q(L2, 'select telephone from public.coordonnees where id = $1', [ETU])).length, 0);
});

test('démarrage : seul le lauréat du match le déclare, l’étudiant confirme, la demande est pourvue', async () => {
  const d = (await q(ETU, `select * from public.demandes where auteur_id = $1 and status = 'match'`, [ETU]))[0];
  const placer = u => q(u, `insert into public.placements (student_id, laureat_id, demande_id, saison, niveau, type, entreprise, ville, source) values ($1, $2, $3, $4, 5, 'pfe', 'Renault', 'Tanger', 'plateforme') returning *`, [ETU, u, d.id, S]).then(r => r[0]);
  await refuse(placer(L2), /pas en cours avec toi/);
  await refuse(q(ETU, `update public.demandes set status = 'pourvue' where id = $1`, [d.id]).then(async () => { if ((await demande(d.id)).status === 'pourvue') throw new Error('ok'); throw new Error('refusé'); }), /refusé/);
  await db.query('delete from public.push_queue');
  const pl = await placer(L1);
  assert.deepEqual([pl.status, pl.aide, pl.laureat_id], ['en_attente', 'encadre', L1]);
  assert.equal((await pushs('recrutement_a_confirmer', ETU))[0].data.aide, 'encadre');
  assert.equal((await demande(d.id)).status, 'match');
  await q(ETU, `update public.placements set status = 'confirme' where id = $1`, [pl.id]);
  assert.equal((await demande(d.id)).status, 'pourvue');
  // Pourvue : le lauréat ne retire plus son aide, l'étudiant ne la rouvre plus
  const p1 = (await db.query('select * from public.propositions where id = $1', [d.proposition_id])).rows[0];
  await q(L1, `update public.propositions set status = 'retiree' where id = $1`, [p1.id]);
  assert.equal((await db.query('select status from public.propositions where id = $1', [p1.id])).rows[0].status, 'acceptee');
  await q(ETU, `update public.demandes set status = 'ouverte' where id = $1`, [d.id]);
  assert.equal((await demande(d.id)).status, 'pourvue');
});

test('arrêter : l’étudiant ou le lauréat met fin au match, la demande se rouvre et l’autre est prévenu', async () => {
  const d = await publier(AUTRE, { type: 'pfe', titre: 'PFE supply chain' });
  const p = await proposer(L2, d.id, { aide: 'recommande', entreprise: 'OCP' });
  await q(AUTRE, `update public.propositions set status = 'acceptee' where id = $1`, [p.id]);
  const pl = (await q(L2, `insert into public.placements (student_id, laureat_id, demande_id, saison, niveau, type, entreprise, source) values ($1, $2, $3, $4, 5, 'pfe', 'OCP', 'plateforme') returning *`, [AUTRE, L2, d.id, S]))[0];
  await db.query('delete from public.push_queue');
  // L'étudiant rouvre : l'aide est déclinée, la déclaration en attente aussi
  await q(AUTRE, `update public.demandes set status = 'ouverte' where id = $1`, [d.id]);
  let x = await demande(d.id);
  assert.deepEqual([x.status, x.laureat_id, x.proposition_id], ['ouverte', null, null]);
  assert.equal((await db.query('select status from public.propositions where id = $1', [p.id])).rows[0].status, 'declinee');
  assert.equal((await db.query('select status from public.placements where id = $1', [pl.id])).rows[0].status, 'refuse');
  assert.deepEqual((await pushs('demande_rouverte', L2)).map(x => x.data.pour), ['aidant'], 'le lauréat est remercié');
  // Un autre lauréat aide ; cette fois c'est lui qui se retire
  const p3 = await proposer(L1, d.id, { aide: 'recrute' });
  await q(AUTRE, `update public.propositions set status = 'acceptee' where id = $1`, [p3.id]);
  await q(L1, `update public.propositions set status = 'retiree' where id = $1`, [p3.id]);
  x = await demande(d.id);
  assert.deepEqual([x.status, x.laureat_id], ['ouverte', null]);
  assert.deepEqual((await pushs('demande_rouverte', AUTRE)).map(x => x.data.pour), ['auteur'], 'l’étudiant garde une porte ouverte');
  assert.equal((await pushs('demande_rouverte', L1)).length, 0, 'celui qui se retire n’est pas prévenu de son propre retrait');
  // Il peut la proposer à nouveau tant que la demande est ouverte (son mot repart en message)
  await q(L1, `update public.propositions set status = 'envoyee', message = 'Finalement c’est bon, le poste est ouvert !' where id = $1`, [p3.id]);
  assert.equal((await db.query('select status from public.propositions where id = $1', [p3.id])).rows[0].status, 'envoyee');
  assert.equal((await q(AUTRE, `select count(*)::int n from public.messages where author_id = $1 and body like 'Finalement%'`, [L1]))[0].n, 1);
  // Fermée : les aides en attente sont closes
  await q(AUTRE, `update public.demandes set status = 'fermee' where id = $1`, [d.id]);
  assert.equal((await db.query('select status from public.propositions where id = $1', [p3.id])).rows[0].status, 'close');
});

test('CV joint : visible des lauréats tant que la demande est ouverte, même s’il est réservé aux contacts', async () => {
  await q(AUTRE, `update public.profiles set visibilite = '{"cv":"contacts"}' where id = $1`, [AUTRE]);
  const vu = async () => (await q(CIVIL, 'select cv_path from public.profils where id = $1', [AUTRE]))[0].cv_path;
  assert.equal(await vu(), null);
  const d = await publier(AUTRE, { type: 'emploi', titre: 'Pré-embauche en logistique' });
  assert.equal(await vu(), cv(AUTRE));
  assert.equal((await q(CIVIL, 'select public.peut_voir_cv($1) ok', [cv(AUTRE)]))[0].ok, true);
  assert.equal((await q(ETU, 'select public.peut_voir_cv($1) ok', [cv(AUTRE)]))[0].ok, false, 'pas un autre étudiant');
  await q(AUTRE, `update public.demandes set status = 'fermee' where id = $1`, [d.id]);
  assert.equal(await vu(), null);
});

test('email aux lauréats : les nouvelles demandes de leur parcours, une fois par jour au plus', async () => {
  await db.query('update public.notif_etat set demandes_at = null');
  const d = await publier(AUTRE, { type: 'pfe', titre: 'PFE maintenance prédictive' });
  const r = await en(db, null, tx => tx.query('select * from public.demandes_a_signaler(50)'), { role: 'postgres' });
  const pour = new Map(r.rows.map(x => [x.id, x.demandes.map(y => y.titre)]));
  assert.ok(pour.get(L1)?.includes('PFE maintenance prédictive'));
  assert.ok(pour.get(L2)?.includes('PFE maintenance prédictive'));
  assert.equal(pour.has(CIVIL), false, 'autre parcours');
  assert.equal(pour.has(AUTRE), false, 'pas aux étudiants');
  assert.equal(r.rows.find(x => x.id === L1).demandes.find(y => y.id === d.id).prenom, 'Hiba');
  await en(db, null, tx => tx.query('select public.demandes_signalees($1)', [[L1, L2, CHERCHE]]), { role: 'postgres' });
  const r2 = await en(db, null, tx => tx.query('select * from public.demandes_a_signaler(50)'), { role: 'postgres' });
  assert.equal(r2.rows.some(x => [L1, L2].includes(x.id)), false);
});

test('email : une demande restée sans aide 24 h s’ouvre aux lauréats des autres parcours, une seule fois ; sans parcours, tout de suite', async () => {
  const SANS = uid(99);
  await creerCompte(db, { id: SANS, full_name: 'Rania Sansfiliere', role: 'etudiant', filiere: 'Autre filière', promo: S + 1 });
  await db.query('update public.profiles set cv_path = $2 where id = $1', [SANS, cv(SANS)]);
  await db.query(`update public.demandes set status = 'fermee' where status in ('ouverte','match')`);
  await db.query('update public.notif_etat set demandes_at = null');
  const vieille = await publier(AUTRE, { type: 'pfe', titre: 'PFE logistique sans réponse' });
  const aidee = await publier(ETU, { type: 'pfe', titre: 'PFE déjà aidé' });
  await db.query(`update public.demandes set created_at = now() - interval '25 hours', relancee_at = now() - interval '25 hours' where id = any($1)`, [[vieille.id, aidee.id]]);
  await proposer(L1, aidee.id);
  const sans = await publier(SANS, { type: 'pfe', titre: 'PFE sans filière' });
  const lire = async () => new Map((await en(db, null, tx => tx.query('select * from public.demandes_a_signaler(50)'), { role: 'postgres' })).rows.map(x => [x.id, x.demandes]));
  const r = await lire();
  const civil = r.get(CIVIL) || [];
  assert.deepEqual(civil.map(y => y.titre).sort(), ['PFE logistique sans réponse', 'PFE sans filière'], 'restée sans aide, ou sans parcours ; pas celle déjà aidée');
  assert.ok(civil.every(y => y.large === true));
  assert.equal(r.get(L2).find(y => y.id === vieille.id).large, false, 'son parcours : pas « large »');
  assert.ok(r.get(L2).some(y => y.id === sans.id), 'sans parcours : tous les lauréats');
  // Vu par le lauréat dans l'appli aussi (demande_pour)
  assert.equal((await db.query('select public.demande_pour(d, p) ok from public.demandes d, public.profiles p where d.id = $1 and p.id = $2', [vieille.id, CIVIL])).rows[0].ok, true);
  assert.equal((await db.query(`select public.demande_pour(d, p) ok from public.demandes d, public.profiles p where d.id = $1 and p.id = $2`, [aidee.id, CIVIL])).rows[0].ok, true, 'visible, mais pas envoyée par email');
  // Envoyé : plus jamais la même, même le lendemain
  await en(db, null, tx => tx.query('select public.demandes_signalees($1)', [[CIVIL, L2]]), { role: 'postgres' });
  await db.query(`update public.notif_etat set demandes_at = now() - interval '2 days' where user_id = any($1)`, [[CIVIL, L2]]);
  const r2 = await lire();
  assert.equal(r2.has(CIVIL), false);
  assert.equal(r2.has(L2), false);
  assert.equal((await db.query('select count(*)::int n from public.demandes_emails where user_id = $1', [CIVIL])).rows[0].n, 2);
});
