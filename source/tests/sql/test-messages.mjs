// Messagerie : qui peut écrire à qui, lecture, « vu », blocage, signalement, fichiers, notifications
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const ETU = uid(11), ETU2 = uid(12), LAU = uid(13), LAU2 = uid(14), ADMIN = uid(15);

const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const refuse = async (promesse, re) => { await assert.rejects(promesse, e => (re ? re.test(e.message) : true) || assert.fail(e.message)); };
const ecrire = (de, a, body, extra = {}) => {
  const row = { author_id: de, dest_id: a, body, ...extra }; const cols = Object.keys(row);
  return q(de, `insert into public.messages (${cols.join(',')}) values (${cols.map((_, i) => '$' + (i + 1)).join(',')}) returning *`, Object.values(row)).then(r => r[0]);
};

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ETU, email: 'salma@exemple.ma', full_name: 'Salma Bennani', role: 'etudiant', filiere: 'Génie Industriel', promo: S + 1 });
  await creerCompte(db, { id: ETU2, full_name: 'Omar Tazi', role: 'etudiant', filiere: 'Génie Industriel', promo: S + 1 });
  await creerCompte(db, { id: LAU, email: 'youssef@exemple.ma', full_name: 'Youssef Alaoui', role: 'laureat', filiere: 'Génie Industriel', promo: 2018, mentor_dispo: true });
  await creerCompte(db, { id: LAU2, full_name: 'Karim Fassi', role: 'laureat', filiere: 'Génie Industriel', promo: 2019 });
  await creerCompte(db, { id: ADMIN, full_name: 'Admin École', role: 'etudiant', filiere: 'Génie Industriel', promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
});

test('sans lien entre deux membres, pas de conversation', async () => {
  await refuse(ecrire(ETU, LAU, 'Bonjour'), /Conversation pas encore ouverte/);
  assert.equal((await q(ETU, 'select public.peut_discuter($1, $2) as ok', [ETU, LAU]))[0].ok, false);
  // On ne peut pas sonder les liens entre deux autres membres
  assert.equal((await q(ETU2, 'select public.peut_discuter($1, $2) as ok', [ETU, LAU]))[0].ok, false);
});

test('mentorat : une demande adressée à un lauréat ouvre la conversation des deux côtés', async () => {
  const demain = new Date(Date.now() + 864e5).toISOString();
  // Demande ouverte à tous : pas encore de lauréat, pas de conversation
  const [ouverte] = await q(ETU, `insert into public.mentorships (student_id, besoin, sujet, creneaux) values ($1, 'cv', 'Relire mon CV', array[$2]::timestamptz[]) returning id`, [ETU, demain]);
  await refuse(ecrire(ETU, LAU, 'Bonjour'), /pas encore ouverte/);
  await q(ETU, `update public.mentorships set status = 'annulee' where id = $1`, [ouverte.id]);
  await q(ETU, `insert into public.mentorships (student_id, mentor_id, besoin, sujet, creneaux) values ($1, $2, 'stage', 'Trouver un PFE', array[$3]::timestamptz[])`, [ETU, LAU, demain]);
  const m = await ecrire(ETU, LAU, '  Bonjour Youssef, merci !  ', { author_id: ETU2 });
  assert.equal(m.author_id, ETU, 'l’auteur est toujours la personne connectée');
  assert.equal(m.body, 'Bonjour Youssef, merci !');
  assert.equal(m.lu_at, null);
  await ecrire(LAU, ETU, 'Avec plaisir, envoie-moi ton CV');
  assert.equal((await q(LAU, 'select count(*)::int n from public.messages')).length, 1);
  assert.equal((await q(LAU, 'select count(*)::int n from public.messages'))[0].n, 2);
  assert.equal((await q(ETU2, 'select count(*)::int n from public.messages'))[0].n, 0);
  assert.equal((await q(LAU2, 'select count(*)::int n from public.messages'))[0].n, 0);
});

test('« vu » : seul le destinataire marque comme lu ; le reste ne change jamais', async () => {
  const [m] = await q(ETU, `select id, body from public.messages where author_id = $1`, [ETU]);
  // L'auteur ne peut ni marquer comme lu ni réécrire son message
  await q(ETU, `update public.messages set lu_at = now(), body = 'modifié' where id = $1`, [m.id]);
  assert.equal((await q(ETU, 'select lu_at, body from public.messages where id = $1', [m.id]))[0].lu_at, null);
  assert.equal((await q(ETU, 'select body from public.messages where id = $1', [m.id]))[0].body, 'Bonjour Youssef, merci !');
  assert.equal((await q(LAU, 'select public.marquer_lus($1) as n', [ETU]))[0].n, 1);
  const lu = (await q(ETU, 'select lu_at from public.messages where id = $1', [m.id]))[0].lu_at;
  assert.ok(lu);
  assert.equal((await q(LAU, 'select public.marquer_lus($1) as n', [ETU]))[0].n, 0);
  // Ce qu'il m'a écrit ne passe pas en « lu » quand c'est moi qui marque ses propres messages
  assert.equal((await q(ETU2, 'select public.marquer_lus($1) as n', [LAU]))[0].n, 0);
});

test('types : photo et vocal avec un fichier rangé dans le dossier de la conversation', async () => {
  const p = await ecrire(ETU, LAU, null, { type: 'photo', fichier: `${ETU}/${LAU}/a.jpg`, largeur: 1200, hauteur: 900, duree: 30 });
  assert.equal(p.duree, null);
  const v = await ecrire(LAU, ETU, 'ignoré', { type: 'vocal', fichier: `${LAU}/${ETU}/b.webm`, duree: 42, onde: '1357975311' });
  assert.equal(v.body, null);
  assert.equal(v.duree, 42);
  await refuse(ecrire(ETU, LAU, null, { type: 'photo', fichier: `${ETU2}/${LAU}/x.jpg` }), /Fichier invalide/);
  await refuse(ecrire(ETU, LAU, null, { type: 'vocal' }), /check/);
  await refuse(ecrire(ETU, LAU, '   '), /check/);
  await refuse(ecrire(ETU, LAU, 'x'.repeat(2001)), /check/);
  await refuse(ecrire(ETU, LAU, null, { type: 'vocal', fichier: `${ETU}/${LAU}/c.webm`, duree: 600 }), /check/);
});

test('stockage « chat » : dépôt dans son dossier vers un membre en lien, lecture par les deux seulement', async () => {
  const b = (await db.query(`select public, file_size_limit::int as lim from storage.buckets where id = 'chat'`)).rows[0];
  assert.deepEqual(b, { public: false, lim: 5242880 });
  const ins = (u, name) => q(u, `insert into storage.objects (bucket_id, name, owner) values ('chat', $1, $2)`, [name, u]);
  await ins(ETU, `${ETU}/${LAU}/photo-1.jpg`);
  await refuse(ins(ETU, `${LAU}/${ETU}/photo-2.jpg`), /row-level security/);
  await refuse(ins(ETU, `${ETU}/${LAU2}/photo-3.jpg`), /row-level security/);
  await refuse(ins(ETU, `${ETU}/pas-un-id/photo-4.jpg`), /row-level security/);
  const voit = async u => (await q(u, `select name from storage.objects where bucket_id = 'chat'`)).length;
  assert.equal(await voit(ETU), 1);
  assert.equal(await voit(LAU), 1);
  assert.equal(await voit(ETU2), 0);
  assert.equal(await voit(ADMIN), 0);
  await q(LAU, `delete from storage.objects where bucket_id = 'chat'`);
  assert.equal(await voit(ETU), 1, 'le destinataire ne supprime pas le fichier de l’autre');
});

test('l’administration écrit à tout le monde ; on peut toujours lui répondre', async () => {
  await refuse(ecrire(ETU2, ADMIN, 'Bonjour'), /pas encore ouverte/);
  await ecrire(ADMIN, ETU2, 'Bienvenue sur le réseau !');
  await ecrire(ETU2, ADMIN, 'Merci beaucoup');
  // Elle ne lit pas les conversations des autres
  assert.equal((await q(ADMIN, 'select count(*)::int n from public.messages where author_id <> $1 and dest_id <> $1', [ADMIN]))[0].n, 0);
});

test('signaler un message : l’administration voit ce message-là, et peut le supprimer', async () => {
  const m = await ecrire(LAU, ETU, 'Message gênant');
  await q(ETU, `insert into public.signalements (auteur_id, cible_type, cible_id, motif) values ($1, 'prive', $2, 'harcelement')`, [ETU, m.id]);
  const vus = await q(ADMIN, 'select id from public.messages where author_id <> $1 and dest_id <> $1', [ADMIN]);
  assert.deepEqual(vus.map(r => r.id), [m.id]);
  // Le destinataire ne supprime pas le message de l'autre ; l'administration oui
  await q(ETU, 'delete from public.messages where id = $1', [m.id]);
  assert.equal((await q(LAU, 'select count(*)::int n from public.messages where id = $1', [m.id]))[0].n, 1);
  await q(ADMIN, 'delete from public.messages where id = $1', [m.id]);
  assert.equal((await q(LAU, 'select count(*)::int n from public.messages where id = $1', [m.id]))[0].n, 0);
});

test('bloquer : plus rien dans un sens ni dans l’autre, jusqu’au déblocage', async () => {
  const [b] = await q(ETU, `insert into public.blocages (user_id, bloque_id) values ($1, $2) returning id, user_id`, [LAU2, LAU]);
  assert.equal(b.user_id, ETU);
  await refuse(ecrire(LAU, ETU, 'Tu es là ?'), /pas encore ouverte/);
  await refuse(ecrire(ETU, LAU, 'Oui'), /pas encore ouverte/);
  assert.equal((await q(LAU, 'select count(*)::int n from public.blocages'))[0].n, 0, 'le membre bloqué ne voit pas le blocage');
  await q(ETU, 'delete from public.blocages where id = $1', [b.id]);
  await ecrire(LAU, ETU, 'Re-bonjour');
});

test('notification : une seule pour une rafale, et un email si le message reste non lu', async () => {
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example/lau', 'k', 'a')`, [LAU]);
  await q(LAU, 'select public.marquer_lus($1)', [ETU]);
  await db.query('delete from public.push_queue');
  await ecrire(ETU, LAU, 'Tu as vu mon CV ?');
  await ecrire(ETU, LAU, 'Je l’ai mis à jour');
  const pushs = (await db.query(`select kind, data from public.push_queue where user_id = $1`, [LAU])).rows;
  assert.equal(pushs.length, 1);
  assert.equal(pushs[0].kind, 'message');
  assert.equal(pushs[0].data.nom, 'Salma Bennani');
  assert.equal(pushs[0].data.de, ETU);
  assert.equal(pushs[0].data.texte, 'Tu as vu mon CV ?');
  // Pas d'email avant 30 minutes
  assert.equal((await db.query('select * from public.messages_a_signaler(10)')).rows.length, 0);
  await db.query(`update public.messages set created_at = now() - interval '45 minutes' where dest_id = $1 and lu_at is null`, [LAU]);
  const [x] = (await db.query('select * from public.messages_a_signaler(10)')).rows;
  assert.equal(x.id, LAU);
  assert.equal(x.email, 'youssef@exemple.ma');
  assert.equal(x.n, 2);
  assert.deepEqual(x.noms, ['Salma Bennani']);
  await db.query('select public.messages_signales($1)', [[LAU]]);
  assert.equal((await db.query('select * from public.messages_a_signaler(10)')).rows.length, 0);
  // Désabonnement en un clic depuis l'email
  const { token } = (await db.query('select token from public.notif_etat where user_id = $1', [LAU])).rows[0];
  assert.equal((await q(null, 'select public.se_desabonner_messages($1) as ok', [token]))[0].ok, true);
  assert.equal((await db.query('select emails_messages from public.profiles where id = $1', [LAU])).rows[0].emails_messages, false);
});

test('anti-spam : 300 messages par jour au plus', async () => {
  await db.query(`insert into public.messages (author_id, dest_id, body, created_at) select $1, $2, 'm' || g, now() from generate_series(1, 300) g`, [LAU2, ADMIN]);
  await ecrire(ADMIN, LAU2, 'Bonjour');
  await refuse(ecrire(LAU2, ADMIN, 'Encore un'), /Doucement/);
});
