// Sur le téléphone, une notification par élément : chaque filleul, chaque événement déplacé et chaque rendez-vous de
// mentorat déplacé a la sienne. La base met l'identifiant de l'élément dans les données, la fonction notifier en fait le
// tag : une nouvelle date du même élément remplace l'ancienne, un autre élément ne l'efface pas (ni son nom).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
const N = await import(process.env.NOTIFIER_TS || new URL('../../supabase/functions/notifier/index.ts', import.meta.url).pathname);
const SITE = 'https://reseau-ensam-meknes.github.io/';
let db, s;
const PAR = uid(1601), F1 = uid(1602), F2 = uid(1603), F3 = uid(1604), ETU = uid(1605), LAU = uid(1606), LAU2 = uid(1607), ADMIN = uid(1608);
const GI = 'Génie Industriel et Productique';
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const dans = h => new Date(Date.now() + h * 36e5).toISOString();
// Ce que le téléphone affichera : la notification de chaque ligne en file, avec son tag
const file = async (u, kind) => (await db.query('select id, data from public.push_queue where user_id = $1 and kind = $2 order by id', [u, kind])).rows
  .map(x => ({ data: x.data, n: N.texteNotif(kind, x.data, 'fr', SITE, x.id) }));

before(async () => {
  db = await nouvelleBase(SCHEMA);
  s = (await db.query('select public.saison_courante() s')).rows[0].s;
  for (const [id, nom] of [[F1, 'Salma Etudiante'], [F2, 'Hiba Etudiante'], [F3, 'Imane Etudiante']]) {
    await creerCompte(db, { id, full_name: nom, role: 'etudiant', filiere: GI, promo: s + 3 });
  }
  await creerCompte(db, { id: PAR, full_name: 'Youssef Parrain', role: 'laureat', filiere: GI, promo: 2015, entreprise: 'OCP' });
  await creerCompte(db, { id: ETU, full_name: 'Nora Etudiante', role: 'etudiant', filiere: GI, promo: s + 1 });
  await creerCompte(db, { id: LAU, full_name: 'Karim Mentor', role: 'laureat', filiere: GI, promo: 2016, mentor_dispo: true });
  await creerCompte(db, { id: LAU2, full_name: 'Nadia Mentor', role: 'laureat', filiere: GI, promo: 2017, mentor_dispo: true });
  await creerCompte(db, { id: ADMIN, full_name: 'Admin École', role: 'laureat', filiere: GI, promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://fcm.googleapis.com/fcm/send/' || id, 'k', 'a'
    from public.profiles where id = any($1::uuid[])`, [[PAR, ETU]]);
});

test('trois filleuls d’un coup : trois notifications, chacune avec son nom (avant : la troisième effaçait les deux autres)', async () => {
  await db.query('update public.profiles set parrain_dispo = true where id = $1', [PAR]);
  const l = await file(PAR, 'filleul');
  assert.equal(l.length, 3);
  assert.deepEqual(l.map(x => x.data.filleul).sort(), [F1, F2, F3].sort(), 'l’identifiant du filleul est dans les données');
  assert.deepEqual(l.map(x => x.n.tag).sort(), [F1, F2, F3].map(f => `filleul-${f}`).sort());
  assert.deepEqual(l.map(x => x.n.body.split(' (3A)')[0]).sort(), ['Hiba Etudiante', 'Imane Etudiante', 'Salma Etudiante']);
});

test('deux événements déplacés : deux notifications ; une nouvelle date du même événement remplace la précédente', async () => {
  const ev = async titre => (await db.query(`insert into public.evenements (author_id, titre, debut, lieu) values ($1, $2, $3, 'Amphi A') returning id`, [ADMIN, titre, dans(72)])).rows[0].id;
  const forum = await ev('Forum entreprises'), visite = await ev('Visite OCP');
  for (const e of [forum, visite]) await db.query('insert into public.evenement_participants (evenement_id, user_id) values ($1, $2)', [e, ETU]);
  await db.query('update public.evenements set debut = $2 where id = $1', [forum, dans(96)]);
  await db.query('update public.evenements set debut = $2 where id = $1', [visite, dans(120)]);
  await db.query('update public.evenements set debut = $2 where id = $1', [forum, dans(144)]);
  const l = await file(ETU, 'evenement_deplace');
  assert.equal(l.length, 3);
  assert.deepEqual(l.map(x => x.data.evenement), [forum, visite, forum], 'l’identifiant de l’événement est dans les données');
  assert.deepEqual(l.map(x => x.n.tag), [`evenement_deplace-${forum}`, `evenement_deplace-${visite}`, `evenement_deplace-${forum}`],
    'avant : « evenement_deplace » pour les trois, la Visite OCP effaçait le Forum');
});

test('deux rendez-vous de mentorat déplacés : deux notifications ; une nouvelle date du même rendez-vous remplace la précédente', async () => {
  const rdv = async (mentor, sujet) => {
    const [m] = await q(ETU, `insert into public.mentorships (student_id, mentor_id, besoin, sujet, creneaux) values ($1, $2, 'cv', $3, array[$4]::timestamptz[]) returning id`, [ETU, mentor, sujet, dans(24)]);
    await q(mentor, `update public.mentorships set status = 'acceptee', rdv_at = $2 where id = $1`, [m.id, dans(30)]);
    return m.id;
  };
  const cv = await rdv(LAU, 'Mon CV'), entretien = await rdv(LAU2, 'Entretien Renault');
  await q(LAU, 'update public.mentorships set rdv_at = $2 where id = $1', [cv, dans(50)]);
  await q(LAU2, 'update public.mentorships set rdv_at = $2 where id = $1', [entretien, dans(52)]);
  await q(LAU, 'update public.mentorships set rdv_at = $2 where id = $1', [cv, dans(54)]);
  const l = await file(ETU, 'mentorat_deplace');
  assert.equal(l.length, 3);
  assert.deepEqual(l.map(x => x.data.m), [cv, entretien, cv], 'l’identifiant du rendez-vous est dans les données');
  assert.deepEqual(l.map(x => x.n.tag), [`mentorat_deplace-${cv}`, `mentorat_deplace-${entretien}`, `mentorat_deplace-${cv}`],
    'avant : « mentorat_deplace » pour les trois, le rendez-vous de Nadia effaçait celui de Karim');
  assert.match(l[1].n.body, /^Nadia Mentor propose /);
});
