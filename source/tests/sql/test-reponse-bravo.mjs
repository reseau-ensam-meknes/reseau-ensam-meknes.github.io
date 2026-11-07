// Entre personnes, tout de suite : un vote ou la meilleure réponse sur ma réponse (P9, reponse_utile), un bravo sur ma
// réussite (P10, bravo). Au plus un par jour et par réponse (un par heure et par réussite), avec le vrai nombre ;
// jamais pour son propre geste, jamais entre membres bloqués.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid, reglerHorloge, aujourdhuiA } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const GI = 'Génie Industriel et Productique';
const ETU = uid(1501), ETU2 = uid(1502), ETU3 = uid(1503), LAU = uid(1504), LAU2 = uid(1505), LAU3 = uid(1506);
const NOMS = { [ETU]: 'ETU', [ETU2]: 'ETU2', [ETU3]: 'ETU3', [LAU]: 'LAU', [LAU2]: 'LAU2', [LAU3]: 'LAU3' };

const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const un = async (sql, p) => (await db.query(sql, p)).rows[0];
const vider = () => db.query('delete from public.push_queue');
const file = async kind => (await db.query('select user_id, data from public.push_queue where kind = $1 order by id', [kind])).rows
  .map(r => ({ qui: NOMS[r.user_id] || r.user_id, data: r.data }));
const reculer = (motif, intervalle) => db.query(`update public.notif_cadence set at = at - $2::interval where cle like $1`, [motif, intervalle]);
const question = async (u, titre) => (await un(`insert into public.questions (author_id, categorie, titre) values ($1, 'stage', $2) returning id`, [u, titre])).id;
const reponse = async (u, qid, body = 'Passe par le forum entreprises.') => (await un(`insert into public.answers (question_id, author_id, body) values ($1, $2, $3) returning id`, [qid, u, body])).id;
const voter = (u, a) => db.query('insert into public.votes (answer_id, user_id) values ($1, $2)', [a, u]);
const reussite = async (u, entreprise, status = 'confirme', saison = S) => (await un(`insert into public.placements (student_id, saison, niveau, type, entreprise, status)
  values ($1, $2, 5, 'pfe', $3, $4) returning id`, [u, saison, entreprise, status])).id;
const bravo = (u, p) => db.query('insert into public.kudos (placement_id, user_id) values ($1, $2)', [p, u]);

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ETU, full_name: 'Salma Bennani', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: ETU2, full_name: 'Hiba Alaoui', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: ETU3, full_name: 'Imane Kettani', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: LAU, full_name: 'Youssef Amrani', role: 'laureat', filiere: GI, promo: 2015, entreprise: 'Renault' });
  await creerCompte(db, { id: LAU2, full_name: 'Karim Tazi', role: 'laureat', filiere: GI, promo: 2018, entreprise: 'OCP' });
  await creerCompte(db, { id: LAU3, full_name: 'Nadia Berrada', role: 'laureat', filiere: GI, promo: 2016 });
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://push.example/' || id, 'k', 'a' from public.profiles where id <> $1`, [LAU3]);
});

test('P9 deux votes en une heure : une seule notification ; le lendemain, le vrai nombre ; voter pour sa propre réponse : rien', async () => {
  const qid = await question(ETU, 'Comment trouver un PFE chez Renault ?');
  const a = await reponse(LAU, qid);
  await vider();
  await q(ETU2, 'insert into public.votes (answer_id, user_id) values ($1, $2)', [a, ETU2]);   // depuis le site
  await voter(ETU3, a);
  assert.deepEqual((await file('reponse_utile')).map(x => [x.qui, x.data]),
    [['LAU', { nom: 'Hiba', titre: 'Comment trouver un PFE chez Renault ?', q: qid, answer: a, n: 1, best: false }]], 'une seule ligne');
  await reculer('vote:%', '25 hours');
  await voter(LAU2, a);
  assert.deepEqual((await file('reponse_utile')).map(x => [x.data.nom, x.data.n]), [['Hiba', 1], ['Karim', 3]], 'cadence passée : n = 3');
  await vider();
  await reculer('vote:%', '25 hours');
  await voter(LAU, a);
  assert.deepEqual(await file('reponse_utile'), [], 'son propre vote : rien');
});

test('P9 meilleure réponse : une fois par question, avec les votes (sans « 0 ») ; la sienne, un membre bloqué, sans téléphone : rien', async () => {
  const qid = await question(ETU, 'Quel logiciel pour la VSM ?');
  const a = await reponse(LAU2, qid, 'Visio ou Excel suffisent.');
  const a2 = await reponse(LAU, qid, 'Lucidchart, souvent.');
  await voter(ETU2, a2);
  await vider();
  await q(ETU, 'update public.questions set best_answer_id = $2 where id = $1', [qid, a]);
  assert.deepEqual((await file('reponse_utile')).map(x => [x.qui, x.data]),
    [['LAU2', { nom: 'Salma', titre: 'Quel logiciel pour la VSM ?', q: qid, answer: a, best: true }]], 'sans vote : pas de n');
  // Elle change d'avis : une fois par question
  await vider();
  await q(ETU, 'update public.questions set best_answer_id = $2 where id = $1', [qid, a2]);
  assert.deepEqual(await file('reponse_utile'), []);
  // Avec des votes : n
  const q2 = await question(ETU2, 'Stage ouvrier : à quelle période ?');
  const b = await reponse(LAU, q2, 'En juillet, plutôt.');
  await voter(ETU3, b); await voter(ETU, b);
  await vider();
  await db.query('update public.questions set best_answer_id = $2 where id = $1', [q2, b]);
  assert.deepEqual((await file('reponse_utile')).map(x => [x.qui, x.data.n, x.data.best]), [['LAU', 2, true]]);
  // Sa propre réponse, un membre bloqué, un auteur sans téléphone : rien
  const q3 = await question(LAU, 'Qui connaît le site de Kénitra ?');
  const c = await reponse(LAU, q3, 'Moi : j’y ai travaillé.');
  const c2 = await reponse(LAU3, q3, 'Je connais bien Kénitra.');
  await vider();
  await db.query('update public.questions set best_answer_id = $2 where id = $1', [q3, c]);
  await db.query('update public.questions set best_answer_id = $2 where id = $1', [q3, c2]);
  assert.deepEqual(await file('reponse_utile'), [], 'la sienne ; Nadia n’a pas de téléphone abonné');
  const q4 = await question(ETU3, 'Quelle entreprise à Tanger ?');
  const d = await reponse(LAU2, q4, 'Renault, bien sûr.');
  await db.query('insert into public.blocages (user_id, bloque_id) values ($1, $2)', [LAU2, ETU3]);
  await vider();
  await voter(ETU3, d);
  await db.query('update public.questions set best_answer_id = $2 where id = $1', [q4, d]);
  assert.deepEqual(await file('reponse_utile'), [], 'bloqué : rien');
  await db.query('delete from public.blocages');
});

test('P10 trois bravos en 10 minutes : une seule notification ; une heure après, le vrai nombre ; le sien, une réussite non confirmée : rien', async () => {
  const p = await reussite(ETU, 'Renault');
  await vider();
  await bravo(LAU, p); await bravo(LAU2, p);
  await q(ETU2, 'insert into public.kudos (placement_id, user_id) values ($1, $2)', [p, ETU2]);   // depuis le site
  assert.deepEqual((await file('bravo')).map(x => [x.qui, x.data]), [['ETU', { nom: 'Youssef', entreprise: 'Renault', placement: p, n: 1 }]], 'une seule ligne');
  await reculer('bravo:%', '61 minutes');
  await bravo(ETU3, p);
  assert.deepEqual((await file('bravo')).map(x => [x.data.nom, x.data.n]), [['Youssef', 1], ['Imane', 4]], 'cadence passée : n = 4');
  await vider();
  await reculer('bravo:%', '61 minutes');
  await bravo(ETU, p);
  assert.deepEqual(await file('bravo'), [], 'son propre bravo : rien');
  // Déclarée (pas encore confirmée) : oui ; en attente ou refusée : rien
  const declaree = await reussite(ETU2, 'OCP', 'declare');
  const attente = await reussite(ETU3, 'Lear', 'en_attente');
  await vider();
  await bravo(LAU, declaree); await bravo(LAU, attente);
  assert.deepEqual((await file('bravo')).map(x => [x.qui, x.data.entreprise]), [['ETU2', 'OCP']]);
  await db.query(`update public.placements set status = 'refuse' where id = $1`, [declaree]);
  await reculer('bravo:%', '61 minutes');
  await vider();
  await bravo(LAU2, declaree);
  assert.deepEqual(await file('bravo'), [], 'refusée : rien');
  // Bloqué : rien
  const p2 = await reussite(ETU3, 'Safran', 'confirme', S - 1);
  await db.query('insert into public.blocages (user_id, bloque_id) values ($1, $2)', [ETU3, LAU2]);
  await vider();
  await bravo(LAU2, p2);
  assert.deepEqual(await file('bravo'), []);
  await db.query('delete from public.blocages');
});

test('P9 et P10 ne sont pas programmées : ni budget, ni nuit (entre personnes, tout de suite)', async () => {
  const p = (await un(`select id from public.placements where student_id = $1 and status = 'confirme'`, [ETU])).id;
  await reglerHorloge(db, aujourdhuiA(23, 30));
  try {
    await db.query('delete from public.notif_programme');
    await reculer('bravo:%', '61 minutes');
    await vider();
    await bravo(LAU3, p);
    assert.equal((await file('bravo')).length, 1, 'à 23:30 aussi');
    assert.equal((await un('select count(*)::int n from public.notif_programme')).n, 0, 'hors du budget du jour');
    assert.equal((await un(`select count(*)::int n from public.push_nuit where kind in ('bravo', 'reponse_utile')`)).n, 0);
  } finally { await reglerHorloge(db); }
});
