// Réseau vivant : les étudiants lisent les demandes de leur année (sans les propositions, seul leur nombre),
// réactions publiques (une par membre, seulement sur ce qu'on lit), réponses sous une demande, et leurs notifications
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const ETU = uid(201), MEME = uid(202), AUTRE_AN = uid(203), L1 = uid(204), L2 = uid(205), CHERCHE = uid(206), ADMIN = uid(207);
const GI = 'Génie Industriel et Productique';
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const refuse = async (promesse, re) => { await assert.rejects(promesse, e => (re ? re.test(e.message) : true) || assert.fail(e.message)); };
const pushs = async (kind, user) => (await db.query('select user_id, data from public.push_queue where kind = $1' + (user ? ' and user_id = $2' : ''), user ? [kind, user] : [kind])).rows;
const publier = (u, champs = {}) => q(u, `insert into public.demandes (auteur_id, type, titre, details, nb_aides) values ($1, $2, $3, $4, $5) returning *`,
  [u, champs.type || 'pfe', champs.titre || 'PFE en supply chain', 'Je cherche un PFE de 6 mois en supply chain, à partir de février.', champs.nb_aides ?? 0]).then(r => r[0]);
const proposer = (u, d) => q(u, `insert into public.propositions (demande_id, laureat_id, aide, entreprise, message) values ($1, $2, 'encadre', 'Renault', 'Bonjour, j’ai un sujet de PFE pour toi.') returning *`, [d, u]).then(r => r[0]);
const reagir = (u, cible, emoji = '👍') => q(u, `insert into public.reactions_publiques (${cible.offer ? 'offer_id' : 'demande_id'}, user_id, emoji) values ($1, $2, $3) returning *`, [cible.offer || cible.demande, u, emoji]).then(r => r[0]);
const repondre = (u, d, body = 'Regarde du côté de Tanger Med, ils prennent des PFE.') => q(u, `insert into public.reponses_demandes (demande_id, author_id, body) values ($1, $2, $3) returning *`, [d, u, body]).then(r => r[0]);
let D, E, O;

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ETU, full_name: 'Salma Bennani', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: MEME, full_name: 'Hiba Alaoui', role: 'etudiant', filiere: 'Génie Civil', promo: S + 1 });
  await creerCompte(db, { id: AUTRE_AN, full_name: 'Amine Idrissi', role: 'etudiant', filiere: GI, promo: S + 2 });
  await creerCompte(db, { id: L1, full_name: 'Youssef Amrani', role: 'laureat', filiere: GI, promo: 2015, entreprise: 'Renault' });
  await creerCompte(db, { id: L2, full_name: 'Karim Tazi', role: 'laureat', filiere: GI, promo: 2018, entreprise: 'OCP' });
  await creerCompte(db, { id: CHERCHE, full_name: 'Halima Cherche', role: 'laureat', filiere: GI, promo: 2020, en_recherche: true });
  await creerCompte(db, { id: ADMIN, full_name: 'Admin École', role: 'etudiant', filiere: GI, promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  for (const id of [ETU, CHERCHE]) await db.query('update public.profiles set cv_path = $2 where id = $1', [id, `${id}/cv-1.pdf`]);
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://push.example/' || id, 'k', 'a' from public.profiles`);
  D = await publier(ETU, { nb_aides: 9 });
  E = await publier(CHERCHE, { type: 'emploi', titre: 'Ingénieure méthodes à Kénitra' });
  O = (await q(L1, `insert into public.offers (author_id, type, titre, entreprise, description, annees) values ($1, 'pfe', 'PFE lean à Tanger', 'Renault', 'Sujet de PFE lean.', '{5}') returning *`, [L1]))[0];
});

test('demandes : un étudiant lit celles de son année, pas celles d’une autre année ni les demandes d’emploi des lauréats', async () => {
  assert.equal(D.nb_aides, 0, 'le nombre d’aides ne s’écrit pas à la publication');
  assert.deepEqual((await q(MEME, 'select id from public.demandes')).map(r => r.id), [D.id]);
  assert.equal((await q(AUTRE_AN, 'select id from public.demandes')).length, 0);
  assert.equal((await q(L2, 'select id from public.demandes')).length, 2, 'les lauréats lisent tout');
  // Fermée : seulement l'auteur, les lauréats et l'administration
  await q(ETU, `update public.demandes set status = 'fermee' where id = $1`, [D.id]);
  assert.equal((await q(MEME, 'select id from public.demandes')).length, 0);
  await q(ETU, `update public.demandes set status = 'ouverte' where id = $1`, [D.id]);
  // En match : la ligne dirait quel lauréat aide, donc pas pour les camarades
  await db.query(`update public.demandes set status = 'match' where id = $1`, [D.id]);
  assert.equal((await q(MEME, 'select id from public.demandes')).length, 0);
  await db.query(`update public.demandes set status = 'ouverte' where id = $1`, [D.id]);
  // Un blocage entre les deux étudiants la cache aussi
  await q(MEME, 'insert into public.blocages (user_id, bloque_id) values ($1, $2)', [MEME, ETU]);
  assert.equal((await q(MEME, 'select id from public.demandes')).length, 0);
  await db.query('delete from public.blocages');
  // Il ne la modifie pas
  await q(MEME, `update public.demandes set titre = 'Piraté', status = 'fermee' where id = $1`, [D.id]);
  assert.equal((await db.query('select titre, status from public.demandes where id = $1', [D.id])).rows[0].status, 'ouverte');
});

test('propositions : l’étudiant de la même année n’en voit aucune, seulement combien de lauréats ont proposé leur aide', async () => {
  const p1 = await proposer(L1, D.id); await proposer(L2, D.id);
  assert.equal((await q(MEME, 'select * from public.propositions')).length, 0, 'ni qui ni quoi');
  assert.equal((await q(MEME, 'select nb_aides from public.demandes where id = $1', [D.id]))[0].nb_aides, 2);
  // Une aide retirée ne compte plus ; l'auteur ne peut pas écrire ce nombre
  await q(L1, `update public.propositions set status = 'retiree' where id = $1`, [p1.id]);
  assert.equal((await q(MEME, 'select nb_aides from public.demandes where id = $1', [D.id]))[0].nb_aides, 1);
  await q(ETU, 'update public.demandes set nb_aides = 40 where id = $1', [D.id]);
  assert.equal((await db.query('select nb_aides from public.demandes where id = $1', [D.id])).rows[0].nb_aides, 1);
  // Le CV de l'auteur reste réservé aux lauréats
  assert.equal((await q(MEME, 'select cv_path from public.profils where id = $1', [ETU]))[0].cv_path, null);
  assert.ok((await q(L2, 'select cv_path from public.profils where id = $1', [ETU]))[0].cv_path);
});

test('réactions : une par membre et par élément, modifiable et retirable ; seulement sur ce qu’on lit, jamais sur sa publication', async () => {
  await db.query('delete from public.push_queue');
  const r = await reagir(MEME, { demande: D.id }, '💪');
  assert.equal(r.user_id, MEME);
  await refuse(reagir(MEME, { demande: D.id }, '👏'), /duplicate|unique/);
  await q(MEME, `update public.reactions_publiques set emoji = '👏', demande_id = $2 where id = $1`, [r.id, E.id]);
  const apres = (await db.query('select emoji, demande_id from public.reactions_publiques where id = $1', [r.id])).rows[0];
  assert.deepEqual(apres, { emoji: '👏', demande_id: D.id }, 'seul l’émoji change');
  await refuse(q(MEME, `update public.reactions_publiques set emoji = '🤡' where id = $1`, [r.id]), /check/);
  // On ne réagit pas à ce qu'on ne lit pas : demande d'une autre année, demande d'emploi d'un lauréat
  await refuse(reagir(AUTRE_AN, { demande: D.id }), /row-level security/);
  await refuse(reagir(MEME, { demande: E.id }), /row-level security/);
  await refuse(reagir(ETU, { demande: D.id }), /propre publication/);
  await refuse(reagir(L1, { offer: O.id }), /propre publication/);
  await refuse(q(L2, `insert into public.reactions_publiques (offer_id, demande_id, user_id, emoji) values ($1, $2, $3, '👍')`, [O.id, D.id, L2]), /check/);
  // Une réaction sur l'offre d'un lauréat ; qui lit quoi
  await reagir(ETU, { offer: O.id }, '❤️'); await reagir(L2, { demande: D.id }, '👍');
  assert.equal((await q(AUTRE_AN, 'select id from public.reactions_publiques')).length, 1, 'il lit l’offre, pas la demande');
  assert.equal((await q(MEME, 'select id from public.reactions_publiques')).length, 3);
  // On retire la sienne seulement
  await q(L2, 'delete from public.reactions_publiques where id = $1', [r.id]);
  assert.equal((await db.query('select count(*)::int n from public.reactions_publiques where id = $1', [r.id])).rows[0].n, 1);
  await q(MEME, 'delete from public.reactions_publiques where id = $1', [r.id]);
  assert.equal((await db.query('select count(*)::int n from public.reactions_publiques where id = $1', [r.id])).rows[0].n, 0);
  // Aucun point pour une réaction
  assert.equal((await db.query(`select count(*)::int n from pg_proc where proname like '%point%' and prosrc like '%reactions_publiques%'`)).rows[0].n, 0);
});

test('notification de réaction : au plus une par élément et par heure (vie du réseau), avec le compte et le lien', async () => {
  await db.query('delete from public.push_queue'); await db.query('delete from public.reactions_notif');
  await db.query('delete from public.reactions_publiques');
  await reagir(MEME, { demande: D.id }, '💪');
  await reagir(L1, { demande: D.id }, '👏');
  await reagir(L2, { demande: D.id }, '👍');
  const p = await pushs('reaction', ETU);
  assert.equal(p.length, 1, 'une seule par heure');
  assert.deepEqual({ ...p[0].data }, { nom: 'Hiba Alaoui', emoji: '💪', n: 1, titre: 'PFE en supply chain', demande: D.id });
  // Une heure plus tard, la suivante part avec le compte du moment
  await db.query(`update public.reactions_notif set at = now() - interval '61 minutes'`);
  await q(L2, 'delete from public.reactions_publiques where user_id = $1', [L2]);
  await reagir(L2, { demande: D.id }, '❤️');
  const p2 = await pushs('reaction', ETU);
  assert.equal(p2.length, 2);
  assert.equal(p2[1].data.n, 3);
  // Catégorie « reseau » : coupée par le membre, rien ne part
  await db.query(`update public.profiles set notif_push = '{"reseau": false}' where id = $1`, [L1]);
  await reagir(ETU, { offer: O.id }, '🙏');
  assert.equal((await pushs('reaction', L1)).length, 0);
  assert.equal((await db.query(`select public.push_categorie('reaction') c`)).rows[0].c, 'reseau');
});

test('réponses : lues et écrites par ceux qui lisent la demande ; l’auteur est prévenu ; fermée, plus de réponse ; signalables', async () => {
  await db.query('delete from public.push_queue');
  const r = await repondre(L1, D.id);
  assert.equal(r.author_id, L1);
  const m = await repondre(MEME, D.id, 'Courage, je cherche aussi en supply chain !');
  await refuse(repondre(AUTRE_AN, D.id), /row-level security/);
  await refuse(repondre(MEME, E.id), /row-level security/);
  await refuse(repondre(L2, D.id, 'x'), /check/);
  await refuse(repondre(L2, D.id, 'y'.repeat(501)), /check/);
  assert.equal((await q(MEME, 'select id from public.reponses_demandes')).length, 2);
  assert.equal((await q(AUTRE_AN, 'select id from public.reponses_demandes')).length, 0);
  const p = await pushs('demande_reponse', ETU);
  assert.equal(p.length, 2);
  assert.deepEqual({ ...p[0].data }, { nom: 'Youssef Amrani', titre: 'PFE en supply chain', texte: 'Regarde du côté de Tanger Med, ils prennent des PFE.', demande: D.id });
  assert.equal((await db.query(`select public.push_categorie('demande_reponse') c`)).rows[0].c, 'demandes');
  // L'auteur qui répond lui-même ne se prévient pas ; il retire une réponse sous sa demande, un autre membre non
  await repondre(ETU, D.id, 'Merci beaucoup, je regarde !');
  assert.equal((await pushs('demande_reponse')).length, 2);
  // Supprimer puis republier ne renvoie pas de notification (une toutes les 30 minutes par personne qui répond)
  await q(L1, 'delete from public.reponses_demandes where id = $1', [r.id]);
  const r2 = await repondre(L1, D.id);
  assert.equal((await pushs('demande_reponse')).length, 2);
  await q(L2, 'delete from public.reponses_demandes where id = $1', [m.id]);
  assert.equal((await db.query('select count(*)::int n from public.reponses_demandes where id = $1', [m.id])).rows[0].n, 1);
  await q(ETU, 'delete from public.reponses_demandes where id = $1', [m.id]);
  assert.equal((await db.query('select count(*)::int n from public.reponses_demandes where id = $1', [m.id])).rows[0].n, 0);
  // Signaler une réponse ; pas plus de 30 réponses par jour
  await q(L2, `insert into public.signalements (auteur_id, cible_type, cible_id, motif) values ($1, 'reponse_demande', $2, 'spam')`, [L2, r2.id]);
  await db.query(`update public.reponses_demandes set created_at = now() where author_id = $1`, [L2]);
  for (let i = 0; i < 30; i++) await repondre(L2, D.id, `Conseil numéro ${i} pour ta recherche`);
  await refuse(repondre(L2, D.id, 'Encore un conseil pour ta recherche'), /Doucement/);
  // Fermée : plus de réponse
  await q(ETU, `update public.demandes set status = 'fermee' where id = $1`, [D.id]);
  await refuse(repondre(L1, D.id, 'Une dernière idée pour toi'), /fermée/);
  // Supprimée : réactions et réponses partent avec elle
  await q(ETU, 'delete from public.demandes where id = $1', [D.id]);
  assert.equal((await db.query('select count(*)::int n from public.reponses_demandes')).rows[0].n, 0);
  assert.equal((await db.query('select count(*)::int n from public.reactions_publiques where demande_id is not null')).rows[0].n, 0);
});
