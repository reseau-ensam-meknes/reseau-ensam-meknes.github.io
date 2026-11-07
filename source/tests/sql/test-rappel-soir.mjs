// Le rappel du soir (constats 2 et 3) : les nouvelles clés de rappel_contenu (matchs, interets, reponses, evenements),
// les comptes de plus d'un jour, et le budget du jour (une notification programmée DOUCE : elle attend s'il est plein).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, creerCompte, uid, reglerHorloge, aujourdhuiA } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const GI = 'Génie Industriel et Productique';
const ETU = uid(1601), ETU2 = uid(1602), ETU3 = uid(1603), LAU = uid(1604), LAU2 = uid(1605), LAU3 = uid(1606), NOUVEAU = uid(1607);
const NOMS = { [ETU]: 'ETU', [ETU2]: 'ETU2', [ETU3]: 'ETU3', [LAU]: 'LAU', [LAU2]: 'LAU2', [LAU3]: 'LAU3', [NOUVEAU]: 'NOUVEAU' };

const un = async (sql, p) => (await db.query(sql, p)).rows[0];
const contenu = async (u, depuis = "now() - interval '2 days'") => (await un(`select public.rappel_contenu(p, ${depuis}) c from public.profiles p where p.id = $1`, [u])).c;
const choix = (u, { profil, offre }, c = 'oui', ilYa = '0 seconds') => {
  const col = offre ? 'cible_offre' : 'cible_profil';
  return db.query(`insert into public.match_choix (user_id, ${col}, choix, updated_at) values ($1, $2, $3, now() - $4::interval)
    on conflict (user_id, ${col}) do update set choix = excluded.choix, updated_at = excluded.updated_at`, [u, offre || profil, c, ilYa]);
};
const bloquer = (a, b) => db.query('insert into public.blocages (user_id, bloque_id) values ($1, $2)', [a, b]);
const debloquer = () => db.query('delete from public.blocages');

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ETU, full_name: 'Salma Bennani', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: ETU2, full_name: 'Hiba Alaoui', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: ETU3, full_name: 'Imane Kettani', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: LAU, full_name: 'Youssef Amrani', role: 'laureat', filiere: GI, promo: 2015, entreprise: 'Renault' });
  await creerCompte(db, { id: LAU2, full_name: 'Karim Tazi', role: 'laureat', filiere: GI, promo: 2018, entreprise: 'OCP' });
  await creerCompte(db, { id: LAU3, full_name: 'Nadia Berrada', role: 'laureat', filiere: GI, promo: 2016 });
  await db.query(`update public.profiles set created_at = now() - interval '60 days'`);
  await db.query(`update public.app_secrets set valeur = (now() - interval '60 days')::text where cle = 'rappels_depuis'`);
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://push.example/' || id, 'k', 'a' from public.profiles`);
  await reglerHorloge(db, aujourdhuiA(18, 0));
});

test('matchs : ceux des 30 derniers jours que je n’ai pas encore vus, sans membre bloqué', async () => {
  await db.query(`insert into public.matchs (etudiant_id, laureat_id, created_at) values ($1, $2, now() - interval '2 days'), ($1, $3, now() - interval '3 days'), ($1, $4, now() - interval '40 days')`, [ETU, LAU, LAU2, LAU3]);
  await db.query(`update public.matchs set vu_laureat_at = now() where laureat_id = $1`, [LAU]);
  assert.equal((await contenu(ETU)).matchs, 3 - 1, 'deux de moins de 30 jours, pas vus par Salma');
  assert.equal((await contenu(LAU)).matchs, undefined, 'Youssef l’a vu : rien');
  assert.equal((await contenu(LAU2)).matchs, 1);
  await db.query(`update public.matchs set vu_etudiant_at = now() where laureat_id = $1`, [LAU]);
  assert.equal((await contenu(ETU)).matchs, 1);
  await bloquer(LAU2, ETU);
  assert.equal((await contenu(ETU)).matchs, undefined, 'bloqué : rien');
  assert.equal((await contenu(LAU2)).matchs, undefined);
  await debloquer();
  await db.query('delete from public.matchs');
});

test('interets : « Intéressé » reçus ces 7 derniers jours, sans réponse, sans match, sans blocage (son profil ; ses offres pour un lauréat)', async () => {
  await choix(LAU, { profil: ETU2 }, 'oui', '3 days');
  await choix(LAU2, { profil: ETU2 }, 'oui', '1 day');
  await choix(LAU3, { profil: ETU2 }, 'oui', '8 days');      // trop ancien
  await choix(LAU3, { profil: ETU3 }, 'plus_tard', '1 day');  // pas un intérêt
  assert.equal((await contenu(ETU2)).interets, 2);
  await choix(ETU2, { profil: LAU2 }, 'plus_tard', '1 hour');
  assert.equal((await contenu(ETU2)).interets, 1, 'Hiba a répondu à Karim (« Plus tard ») : il ne compte plus');
  await bloquer(ETU2, LAU);
  assert.equal((await contenu(ETU2)).interets, undefined, 'bloqué : rien');
  await debloquer();
  // Le lauréat : les étudiants qui ont dit oui à une de ses offres (deux offres, la même étudiante : une personne)
  const o = [];
  for (const t of ['PFE Lean', 'PFE méthodes']) o.push((await un(`insert into public.offers (author_id, type, titre, entreprise, description, annees) values ($1, 'pfe', $2, 'Lear', 'd', '{5}') returning id`, [LAU3, t])).id);
  await choix(ETU, { offre: o[0] }, 'oui', '2 days');
  await choix(ETU, { offre: o[1] }, 'oui', '1 day');
  await choix(ETU3, { offre: o[0] }, 'oui', '5 hours');
  assert.equal((await contenu(LAU3)).interets, 2, 'Salma (deux offres) et Imane');
  // Un match s'est fait : plus un intérêt
  await db.query('insert into public.matchs (etudiant_id, laureat_id, offre_id) values ($1, $2, $3)', [ETU3, LAU3, o[0]]);
  assert.equal((await contenu(LAU3)).interets, 1);
  await db.query('delete from public.matchs');
});

test('reponses : les réponses des autres à mes questions depuis ma dernière visite (pas les miennes, pas d’un membre bloqué)', async () => {
  const { id: qid } = await un(`insert into public.questions (author_id, categorie, titre) values ($1, 'stage', 'Un stage chez Renault Tanger ?') returning id`, [ETU3]);
  const repondre = (u, ilYa) => db.query(`insert into public.answers (question_id, author_id, body, created_at) values ($1, $2, 'Oui, passe par le forum.', now() - $3::interval)`, [qid, u, ilYa]);
  await repondre(LAU, '1 day'); await repondre(LAU2, '5 hours'); await repondre(ETU3, '4 hours'); await repondre(LAU3, '3 days');
  assert.equal((await contenu(ETU3)).reponses, 2, 'depuis sa visite il y a 2 jours : Youssef et Karim (pas la sienne, pas celle d’avant)');
  await bloquer(LAU2, ETU3);
  assert.equal((await contenu(ETU3)).reponses, 1);
  await debloquer();
  assert.equal((await contenu(LAU)).reponses, undefined, 'pas sa question');
});

test('evenements : inscrit à un événement ou à un café non annulé dans les 2 jours, pas ceux qu’il organise', async () => {
  const ev = async (titre, dans, auteur = null) => (await un(`insert into public.evenements (author_id, titre, type, debut) values ($1, $2, 'forum', now() + $3::interval) returning id`, [auteur, titre, dans])).id;
  const e1 = await ev('Forum entreprises', '1 day'), e2 = await ev('Forum trop loin', '3 days'), e3 = await ev('Forum annulé', '1 day'), e4 = await ev('Mon atelier', '1 day', LAU);
  for (const e of [e1, e2, e3, e4]) await db.query('insert into public.evenement_participants (evenement_id, user_id) values ($1, $2)', [e, LAU]);
  await db.query('update public.evenements set annule = true where id = $1', [e3]);
  const { id: c } = await un(`insert into public.cafes (organisateur_id, ville, lieu, date_at) values ($1, 'Casablanca', 'Café de la gare', now() + interval '30 hours') returning id`, [LAU2]);
  await db.query('insert into public.cafe_participants (cafe_id, user_id) values ($1, $2)', [c, LAU]);
  assert.equal((await contenu(LAU)).evenements, 2, 'le forum de demain et le café ; pas le lointain, pas l’annulé, pas le sien');
  assert.equal((await contenu(LAU2)).evenements, undefined, 'Karim organise le café');
});

test('le soir : un compte de moins d’un jour n’est pas rappelé ; un jour après, oui ; les nouvelles clés en font partie', async () => {
  await creerCompte(db, { id: NOUVEAU, full_name: 'Omar Nouveau', role: 'laureat', filiere: GI, promo: 2019 });
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example/n', 'k', 'a')`, [NOUVEAU]);
  await db.query(`insert into public.matchs (etudiant_id, laureat_id) values ($1, $2)`, [ETU, NOUVEAU]);
  await db.query(`update public.profiles set created_at = now() - interval '20 hours' where id = $1`, [NOUVEAU]);
  await db.query(`insert into public.visites (user_id, vu_at) values ($1, now() - interval '20 hours')`, [NOUVEAU]);
  const dus = async () => Object.fromEntries((await db.query('select id, contenu from public.rappels_dus()')).rows.map(r => [NOMS[r.id] || r.id, r.contenu]));
  assert.equal((await dus()).NOUVEAU, undefined, 'inscrit il y a 20 heures');
  await db.query(`update public.profiles set created_at = now() - interval '25 hours' where id = $1`, [NOUVEAU]);
  await db.query(`update public.visites set vu_at = now() - interval '25 hours' where user_id = $1`, [NOUVEAU]);
  assert.deepEqual((await dus()).NOUVEAU, { matchs: 1 }, 'un jour après : rappelé, avec son match à découvrir');
  await db.query('delete from public.matchs');
});

test('le soir : une notification DOUCE, seulement s’il reste de la place dans le budget du jour (sinon, le lendemain)', async () => {
  await db.query('delete from public.push_queue');
  await db.query(`delete from public.rappels_visite`);
  // ETU3 et LAU ont quelque chose (réponses, événements) ; LAU a déjà reçu 3 notifications programmées aujourd'hui
  for (const u of [ETU3, LAU]) await db.query(`insert into public.visites (user_id, vu_at) values ($1, now() - interval '2 days') on conflict (user_id) do update set vu_at = excluded.vu_at`, [u]);
  for (const k of ['match_jour', 'offre_bientot', 'groupe_jour']) await db.query(`select public.programme_place($1, $2)`, [LAU, k]);
  await db.query('select public.rappels_push()');
  const qui = (await db.query(`select user_id from public.push_queue where kind = 'rappel_visite'`)).rows.map(r => NOMS[r.user_id]);
  assert.ok(qui.includes('ETU3') && !qui.includes('LAU'), qui.join());
  assert.equal((await un('select count(*)::int n from public.rappels_visite where user_id = $1', [LAU])).n, 0, 'pas noté : il reste dû');
  assert.equal((await un(`select count(*)::int n from public.notif_programme where user_id = $1 and kind = 'rappel_visite'`, [ETU3])).n, 1, 'compté dans le budget');
  // Le lendemain : il part
  await db.query(`update public.notif_programme set at = at - interval '1 day'`);
  await db.query('delete from public.push_queue');
  await db.query('select public.rappels_push()');
  assert.ok((await db.query(`select user_id from public.push_queue where kind = 'rappel_visite'`)).rows.some(r => r.user_id === LAU));
});

test('interets : un « Intéressé » déjà rappelé à midi (match_attente) ne revient ni dans le rappel de 18:00, ni dans les suivants', async () => {
  for (const t of ['push_queue', 'rappels_visite', 'notif_programme']) await db.query(`delete from public.${t}`);
  // Imane, venue il y a 2 jours : Karim a dit oui à son profil il y a 21 h ; son match_interet est parti à ce moment-là
  await db.query(`insert into public.visites (user_id, vu_at) values ($1, now() - interval '2 days') on conflict (user_id) do update set vu_at = excluded.vu_at`, [ETU3]);
  await choix(LAU2, { profil: ETU3 }, 'oui', '21 hours');
  await db.query('delete from public.push_queue');
  assert.equal((await contenu(ETU3, "now() - interval '2 days'")).interets, 1, 'avant midi : il attend sa réponse');
  try {
    await reglerHorloge(db, aujourdhuiA(12, 30));
    await db.query('select public.match_attente_push()');
    assert.deepEqual((await db.query(`select data ->> 'de' de from public.push_queue where kind = 'match_attente' and user_id = $1`, [ETU3])).rows.map(r => r.de), [LAU2],
      'rappelé une fois, à midi');
    await db.query('delete from public.push_queue');
    await reglerHorloge(db, aujourdhuiA(18, 0));
    assert.equal((await contenu(ETU3, "now() - interval '2 days'")).interets, undefined, 'déjà rappelé : il ne compte plus');
    await db.query('select public.rappels_push()');
    const soir = (await db.query(`select data from public.push_queue where kind = 'rappel_visite' and user_id = $1`, [ETU3])).rows.map(r => r.data);
    assert.equal(soir.length, 1, 'le rappel part pour le reste (ses réponses)');
    assert.equal(soir[0].interets, undefined, JSON.stringify(soir[0]));
    // Un autre « Intéressé », pas encore rappelé : lui compte
    await choix(LAU, { profil: ETU3 }, 'oui', '2 hours');
    assert.equal((await contenu(ETU3, "now() - interval '2 days'")).interets, 1);
  } finally {
    await reglerHorloge(db, aujourdhuiA(18, 0));
    await db.query('delete from public.match_choix where cible_profil = $1', [ETU3]);
    for (const t of ['push_queue', 'rappels_visite', 'notif_programme']) await db.query(`delete from public.${t}`);
  }
});

test('dimanche : le résumé de 10:00 est parti, pas de rappel du soir le même jour ; il part le lendemain, recalculé', async () => {
  for (const t of ['push_queue', 'rappels_visite', 'notif_programme']) await db.query(`delete from public.${t}`);
  // Imane, venue il y a 2 jours : des réponses à sa question, et une offre de la semaine pour son année
  await db.query(`insert into public.visites (user_id, vu_at) values ($1, now() - interval '2 days') on conflict (user_id) do update set vu_at = excluded.vu_at`, [ETU3]);
  const { id: o } = await un(`insert into public.offers (author_id, type, titre, entreprise, description, annees) values ($1, 'pfe', 'PFE supply chain', 'Lear', 'd', '{5}') returning id`, [LAU3]);
  const recu = async kind => (await db.query(`select data from public.push_queue where kind = $1 and user_id = $2`, [kind, ETU3])).rows.map(r => r.data);
  try {
    await reglerHorloge(db, aujourdhuiA(10, 0));
    await db.query('select public.semaine_push()');
    assert.equal((await recu('semaine')).length, 1, 'le résumé du dimanche, à 10:00');
    await db.query('delete from public.push_queue');
    await reglerHorloge(db, aujourdhuiA(18, 0));
    await db.query('select public.rappels_push()');
    assert.deepEqual(await recu('rappel_visite'), [], 'pas un deuxième résumé le même jour, avec d’autres chiffres');
    assert.equal((await un('select count(*)::int n from public.rappels_visite where user_id = $1', [ETU3])).n, 0, 'pas noté : il reste dû');
    // Le lendemain soir : il part, recalculé (ses réponses l'attendent toujours)
    await reglerHorloge(db, aujourdhuiA(18, 0, 1));
    await db.query('select public.rappels_push()');
    const soir = await recu('rappel_visite');
    assert.equal(soir.length, 1, 'le lendemain : le rappel part');
    assert.ok(soir[0].reponses >= 1, JSON.stringify(soir[0]));
  } finally {
    await reglerHorloge(db, aujourdhuiA(18, 0));
    await db.query('delete from public.offers where id = $1', [o]);
    for (const t of ['push_queue', 'rappels_visite', 'notif_programme']) await db.query(`delete from public.${t}`);
  }
});
