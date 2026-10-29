// Notifications qui arrivent : la file garde chaque notification jusqu'à la confirmation de son envoi, la base rappelle
// la fonction chaque minute pour ce qui attend ; rappel 15 minutes avant un rendez-vous (mentorat ou entretien proposé
// dans une discussion), par notification, sinon par email.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, creerCompte, en, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const ETU = uid(301), LAU = uid(302), ETU2 = uid(303), LAU2 = uid(304), SANS = uid(305), COUPE = uid(306), ETU3 = uid(307);
const service = (sql, p) => en(db, null, tx => tx.query(sql, p), { role: 'service_role' }).then(r => r.rows);
const minutes = n => new Date(Date.now() + n * 60e3).toISOString();
const file = async () => (await db.query('select user_id, kind, data from public.push_queue order by id')).rows;
const appels = async () => (await db.query('select body ->> \'job\' job, timeout from net.appels order by n')).rows;
const rdvMessage = async (de, a, quand, extra = {}) => {
  const row = { author_id: de, dest_id: a, type: 'rdv', rdv_at: quand, rdv_duree: 30, rdv_lien: 'https://meet.jit.si/ReseauENSAM-1a2b3c4d', ...extra };
  const cols = Object.keys(row);
  return (await db.query(`insert into public.messages (${cols.join(',')}) values (${cols.map((_, i) => '$' + (i + 1)).join(',')}) returning id`, Object.values(row))).rows[0].id;
};

before(async () => {
  db = await nouvelleBase(SCHEMA);
  // pg_net simulé : chaque appel de la fonction est noté (adresse du projet connue)
  await db.exec(`create schema net;
    create table net.appels (n serial, url text, body jsonb, timeout int);
    create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
      returns bigint language sql as $$ insert into net.appels (url, body, timeout) values (url, body, timeout_milliseconds) returning n::bigint $$;
    insert into public.app_secrets (cle, valeur) values ('projet_url', 'https://projet.supabase.co'), ('anon_key', 'cle-publique');`);
  const p = (id, role, x = {}) => creerCompte(db, { id, full_name: (role === 'etudiant' ? 'Salma Idrissi ' : 'Youssef Alami ') + id.slice(-2), role, filiere: 'Génie Mécanique', promo: role === 'etudiant' ? 2027 : 2015, ...x });
  await p(ETU, 'etudiant'); await p(LAU, 'laureat'); await p(ETU2, 'etudiant'); await p(LAU2, 'laureat'); await p(SANS, 'etudiant', { langue: 'ar' }); await p(COUPE, 'laureat'); await p(ETU3, 'etudiant');
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://push.example/' || id, 'k', 'a' from public.profiles where id <> $1`, [SANS]);
  await db.query(`update public.profiles set notif_push = '{"messages": false}' where id = $1`, [COUPE]);
});
beforeEach(async () => { await db.exec('delete from public.push_queue; delete from net.appels; delete from public.rappels_emails;'); });

test('file : prise, la notification reste jusqu’à push_faits ; reprise après 2 minutes, 3 essais au plus', async () => {
  await db.query(`insert into public.push_queue (user_id, kind, data) values ($1, 'merci', '{}'), ($1, 'merci', '{}')`, [ETU]);
  const prises = await service('select * from public.prendre_push(10)');
  assert.equal(prises.length, 2);
  assert.deepEqual((await db.query('select essais, pris_at is not null pris from public.push_queue')).rows, [{ essais: 1, pris: true }, { essais: 1, pris: true }]);
  assert.equal((await service('select * from public.prendre_push(10)')).length, 0, 'pas deux fois en même temps');
  await service('select public.push_faits($1)', [[prises[0].id]]);
  assert.equal((await db.query('select count(*)::int n from public.push_queue')).rows[0].n, 1);
  for (let essai = 2; essai <= 3; essai++) {
    await db.query(`update public.push_queue set pris_at = now() - interval '3 minutes'`);
    assert.equal((await service('select * from public.prendre_push(10)')).length, 1, `essai ${essai}`);
  }
  await db.query(`update public.push_queue set pris_at = now() - interval '3 minutes'`);
  assert.equal((await service('select * from public.prendre_push(10)')).length, 0, 'pas de quatrième essai');
  await service('select public.relancer_push()');
  assert.equal((await db.query('select count(*)::int n from public.push_queue')).rows[0].n, 0, 'abandonnée');
  for (const f of ['prendre_push(1)', 'push_faits(array[1]::bigint[])', 'relancer_push()', 'rappels_rdv()', 'taches_minute()', 'rappels_rdv_a_envoyer(1)', 'rappels_rdv_envoyes(array[1]::bigint[])'])
    await assert.rejects(en(db, ETU, tx => tx.query(`select public.${f}`)), /permission denied/, f);
  for (const t of ['push_journal', 'rappels_emails', 'rappels_entretiens'])
    assert.equal((await en(db, ETU, tx => tx.query(`select * from public.${t}`))).rows.length, 0, t);
});

test('chaque minute : un appel perdu est refait ; rien à refaire, pas d’appel ; 60 s d’attente pour pg_net', async () => {
  await db.query(`insert into public.push_queue (user_id, kind, data) values ($1, 'merci', '{}')`, [ETU]);
  assert.deepEqual(await appels(), [{ job: 'push', timeout: 60000 }], 'appel tout de suite, à l’ajout');
  await db.exec('delete from net.appels');
  assert.equal((await service('select public.relancer_push() v'))[0].v, false, 'ajoutée il y a moins d’une minute : l’appel est en route');
  await db.query(`update public.push_queue set created_at = now() - interval '2 minutes'`);
  assert.equal((await service('select public.relancer_push() v'))[0].v, true);
  assert.deepEqual(await appels(), [{ job: 'push', timeout: 60000 }]);
  // Prise il y a moins de 2 minutes : la fonction est en train de l'envoyer
  await service('select * from public.prendre_push(10)');
  await db.exec('delete from net.appels');
  assert.equal((await service('select public.relancer_push() v'))[0].v, false);
  // Plus d'un jour : le service de push ne la garderait pas
  await db.query(`update public.push_queue set created_at = now() - interval '25 hours', pris_at = null`);
  assert.equal((await service('select public.relancer_push() v'))[0].v, false);
  assert.equal((await db.query('select count(*)::int n from public.push_queue')).rows[0].n, 0);
});

test('pg_net ancien, sans délai réglable : l’appel part quand même', async () => {
  await db.exec(`drop function net.http_post(text, jsonb, jsonb, jsonb, int);
    create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}')
      returns bigint language sql as $$ insert into net.appels (url, body, timeout) values (url, body, null) returning n::bigint $$;`);
  try {
    await service(`select public.appeler_notifier('push')`);
    assert.deepEqual(await appels(), [{ job: 'push', timeout: null }]);
  } finally {
    await db.exec(`drop function net.http_post(text, jsonb, jsonb, jsonb);
      create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
        returns bigint language sql as $$ insert into net.appels (url, body, timeout) values (url, body, timeout_milliseconds) returning n::bigint $$;`);
  }
});

test('mentorat : rappel aux deux 15 minutes avant, une fois ; un nouvel horaire, un nouveau rappel', async () => {
  const m = (await db.query(`insert into public.mentorships (student_id, mentor_id, sujet, status, rdv_at) values ($1, $2, 'Relire mon CV', 'acceptee', $3) returning id`, [ETU, LAU, minutes(40)])).rows[0].id;
  await db.exec('delete from public.push_queue');
  assert.equal((await service('select public.rappels_rdv() n'))[0].n, 0, '40 minutes avant : trop tôt');
  await db.query('update public.mentorships set rdv_at = $2 where id = $1', [m, minutes(14)]);
  await db.exec('delete from public.push_queue');
  assert.equal((await service('select public.rappels_rdv() n'))[0].n, 1);
  const q = await file();
  assert.deepEqual(q.map(x => [x.user_id, x.kind, x.data.sujet]).sort(), [[ETU, 'rappel_rdv', 'Relire mon CV'], [LAU, 'rappel_rdv', 'Relire mon CV']].sort());
  assert.ok(q.find(x => x.user_id === ETU).data.nom.startsWith('Youssef Alami'));
  assert.equal((await service('select public.rappels_rdv() n'))[0].n, 0, 'une seule fois');
  await db.query('update public.mentorships set rdv_at = $2 where id = $1', [m, minutes(12)]);
  await db.exec('delete from public.push_queue');
  assert.equal((await service('select public.rappels_rdv() n'))[0].n, 1, 'déplacé : rappelé à son nouvel horaire');
  await db.query(`update public.mentorships set status = 'annulee', rdv_at = $2 where id = $1`, [m, minutes(10)]);
  assert.equal((await service('select public.rappels_rdv() n'))[0].n, 0, 'annulé : rien');
});

test('entretien proposé dans une discussion : accepté ou sans réponse, rappel aux deux ; refusé, remplacé ou bloqué, rien', async () => {
  const id = await rdvMessage(LAU, ETU, minutes(13));
  await db.exec('delete from public.push_queue');
  assert.equal((await service('select public.rappels_rdv() n'))[0].n, 1);
  const q = await file();
  assert.deepEqual(q.map(x => [x.user_id, x.kind]).sort(), [[ETU, 'rappel_entretien'], [LAU, 'rappel_entretien']].sort());
  const pourEtu = q.find(x => x.user_id === ETU).data;
  assert.equal(pourEtu.de, LAU); assert.equal(pourEtu.m, id); assert.equal(pourEtu.duree, 30); assert.ok(/^Youssef$/.test(pourEtu.nom));
  assert.equal(pourEtu.lien, undefined, 'le lien de la visio ne passe pas par la notification');
  assert.equal((await service('select public.rappels_rdv() n'))[0].n, 0, 'une seule fois');
  // « Autre horaire » : pas de rappel
  const refuse = await rdvMessage(LAU2, ETU2, minutes(14));
  await db.query(`update public.messages set rdv_reponse = 'autre' where id = $1`, [refuse]);
  // Remplacé par un horaire proposé depuis, dans la même discussion (dans un sens ou dans l'autre)
  const ancien = await rdvMessage(LAU2, ETU3, minutes(11));
  await db.query(`update public.messages set created_at = now() - interval '1 hour' where id = $1`, [ancien]);
  await rdvMessage(ETU3, LAU2, minutes(60 * 24));
  await db.exec('delete from public.push_queue');
  assert.equal((await service('select public.rappels_rdv() n'))[0].n, 0);
  // Bloqué : rien
  const bloque = await rdvMessage(LAU2, ETU, minutes(9));
  await db.query('insert into public.blocages (user_id, bloque_id) values ($1, $2)', [ETU, LAU2]);
  assert.equal((await service('select public.rappels_rdv() n'))[0].n, 0);
  await db.query('delete from public.blocages'); await db.query('delete from public.messages where id = $1', [bloque]);
});

test('sans notifications sur aucun appareil : un email (avec le lien de la visio) ; notifications coupées : rien', async () => {
  await rdvMessage(LAU, SANS, minutes(10));
  await rdvMessage(COUPE, ETU, minutes(10), { rdv_lien: null, rdv_lieu: 'Siège OCP, Casablanca' });
  await db.exec('delete from public.push_queue; delete from net.appels;');
  assert.equal((await service('select public.rappels_rdv() n'))[0].n, 2);
  // SANS : email ; LAU et ETU : notification ; COUPE a coupé « Messages » sur son téléphone : ni l'un ni l'autre
  assert.deepEqual((await file()).map(x => x.user_id).sort(), [ETU, LAU].sort());
  const emails = (await db.query('select user_id, kind, data from public.rappels_emails')).rows;
  assert.deepEqual(emails.map(x => [x.user_id, x.kind, x.data.lien]), [[SANS, 'rappel_entretien', 'https://meet.jit.si/ReseauENSAM-1a2b3c4d']]);
  assert.ok((await appels()).some(x => x.job === 'rappels_rdv'), 'la fonction est appelée pour l’email');
  // La fonction prend l'email (adresse, langue), puis le confirme ; repris après 2 minutes sinon, jamais après le début
  const pris = await service('select * from public.rappels_rdv_a_envoyer(10)');
  assert.deepEqual(pris.map(x => [x.email, x.langue, x.kind]), [[SANS.slice(-4) + '@exemple.ma', 'ar', 'rappel_entretien']]);
  assert.equal((await service('select * from public.rappels_rdv_a_envoyer(10)')).length, 0, 'pas deux fois en même temps');
  await db.query(`update public.rappels_emails set pris_at = now() - interval '3 minutes'`);
  await db.exec('delete from net.appels');
  assert.equal((await service('select public.relancer_push() v'))[0].v, true);
  assert.ok((await appels()).some(x => x.job === 'rappels_rdv'));
  await service('select public.rappels_rdv_envoyes($1)', [[pris[0].id]]);
  assert.equal((await db.query('select count(*)::int n from public.rappels_emails')).rows[0].n, 0);
  // Un rendez-vous commencé : son email ne part plus
  await db.query(`insert into public.rappels_emails (user_id, kind, data, rdv_at) values ($1, 'rappel_rdv', '{}', now() - interval '1 minute')`, [SANS]);
  assert.equal((await service('select * from public.rappels_rdv_a_envoyer(10)')).length, 0);
  await service('select public.relancer_push()');
  assert.equal((await db.query('select count(*)::int n from public.rappels_emails')).rows[0].n, 0);
});

test('un téléphone se réinscrit à chaque ouverture : rien ne change s’il est connu ; un autre compte le reprend', async () => {
  const endpoint = 'https://push.example/telephone-partage';
  const abonner = u => en(db, u, tx => tx.query(`select public.abonner_push($1, 'k1', 'a1')`, [endpoint]));
  const ligne = async () => (await db.query('select id, user_id, created_at from public.push_subscriptions where endpoint = $1', [endpoint])).rows;
  await abonner(ETU);
  const [a] = await ligne();
  await abonner(ETU);
  assert.deepEqual(await ligne(), [a], 'même ligne, même date');
  await abonner(LAU);
  const [b] = await ligne();
  assert.equal(b.user_id, LAU); assert.equal(b.id, a.id);
  await en(db, LAU, tx => tx.query(`select public.abonner_push($1, 'k2', 'a2')`, [endpoint]));
  assert.equal((await db.query('select p256dh from public.push_subscriptions where endpoint = $1', [endpoint])).rows[0].p256dh, 'k2', 'nouvelles clés du navigateur');
  await db.query('delete from public.push_subscriptions where endpoint = $1', [endpoint]);
});

test('chaque minute : les rappels, puis les files ; le journal et l’historique de pg_cron gardent 7 jours', async () => {
  const [{ def }] = (await db.query(`select pg_get_functiondef('public.taches_minute'::regproc) def`)).rows;
  assert.match(def, /rappels_rdv\(\)[\s\S]*relancer_push\(\)/);
  const [{ q }] = (await db.query(`select pg_get_functiondef('public.taches_quotidiennes'::regproc) q`)).rows;
  assert.match(q, /push_journal where at < now\(\) - interval '7 days'/);
  assert.match(q, /cron\.job_run_details where end_time < now\(\) - interval '7 days'/);
  await db.query(`insert into public.push_journal (user_id, kind, code, at) values ($1, 'merci', 201, now() - interval '8 days'), ($1, 'merci', 201, now())`, [ETU]);
  await service('select public.taches_quotidiennes()');
  assert.equal((await db.query('select count(*)::int n from public.push_journal')).rows[0].n, 1);
});
