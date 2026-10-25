// Rappels de visite : qui est choisi (absent depuis 2 jours ET quelque chose de concret l'attend), avec quels chiffres,
// l'espacement croissant remis à zéro à la visite suivante, la catégorie « Rappels » coupée = rien,
// et les emails (sans téléphone ou absent depuis 5 jours, une fois par semaine, jamais le jour d'un autre email).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const ETU = uid(401), LAU = uid(402), LAU_AUTRE = uid(403), ETU_SANS = uid(404), LAU_SANS = uid(405), CALME = uid(406);
const NOMS = { [ETU]: 'ETU', [LAU]: 'LAU', [LAU_AUTRE]: 'LAU_AUTRE', [ETU_SANS]: 'ETU_SANS', [LAU_SANS]: 'LAU_SANS', [CALME]: 'CALME' };
const GI = 'Génie Industriel et Productique', GM = 'Génie Mécanique et Structures';
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const nom = id => NOMS[id] || id;
const vider = () => db.query('delete from public.push_queue');
const file = async () => (await db.query(`select user_id, data from public.push_queue where kind = 'rappel_visite' order by user_id`)).rows.map(r => [nom(r.user_id), r.data]);
const push = async () => (await db.query('select public.rappels_push() n')).rows[0].n;
const dus = async () => Object.fromEntries((await db.query('select id, n, abonne, contenu from public.rappels_dus()')).rows.map(r => [nom(r.id), r]));
const emails = async (max = 150) => (await db.query('select id, email, langue, contenu from public.rappels_emails_a_envoyer($1)', [max])).rows.map(r => nom(r.id)).sort();
// Le temps passe : tout ce qui est noté recule de j jours (visites, rappels, emails du réseau)
const reculer = async j => {
  await db.query(`update public.visites set vu_at = vu_at - $1 * interval '1 day'`, [j]);
  await db.query(`update public.rappels_visite set dernier_at = dernier_at - $1 * interval '1 day', push_at = push_at - $1 * interval '1 day', email_at = email_at - $1 * interval '1 day'`, [j]);
  for (const t of ['messages', 'offers', 'applications', 'propositions']) await db.query(`update public.${t} set created_at = created_at - $1 * interval '1 day'`, [j]);
  await db.query(`update public.demandes set created_at = created_at - $1 * interval '1 day', relancee_at = relancee_at - $1 * interval '1 day'`, [j]);
};
// Message posé directement (le droit d'écrire est testé ailleurs)
const message = (de, a, body = 'Bonjour') => db.query('insert into public.messages (author_id, dest_id, body) values ($1, $2, $3)', [de, a, body]);
const visite = (u, joursAvant = 0) => db.query(`insert into public.visites (user_id, vu_at) values ($1, now() - $2 * interval '1 day') on conflict (user_id) do update set vu_at = excluded.vu_at`, [u, joursAvant]);
const etat = async u => (await db.query('select n from public.rappels_visite where user_id = $1', [u])).rows[0]?.n ?? 0;

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ETU, full_name: 'Salma Bennani', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: LAU, full_name: 'Youssef Amrani', role: 'laureat', filiere: GI, promo: 2015, entreprise: 'Renault' });
  await creerCompte(db, { id: LAU_AUTRE, full_name: 'Karim Tazi', role: 'laureat', filiere: GM, promo: 2012, entreprise: 'Safran' });
  await creerCompte(db, { id: ETU_SANS, full_name: 'Imane Alaoui', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: LAU_SANS, full_name: 'Nadia Berrada', role: 'laureat', filiere: GI, promo: 2016, entreprise: 'OCP' });
  await creerCompte(db, { id: CALME, full_name: 'Omar Calme', role: 'laureat', filiere: GI, promo: 2014 });
  await db.query(`update public.profiles set cv_path = id::text || '/cv-1730000000000.pdf' where role = 'etudiant'`);
  await db.query(`update public.profiles set langue = 'ar' where id = $1`, [ETU_SANS]);
  await db.query(`update public.profiles set created_at = now() - interval '60 days'`);
  // Téléphones abonnés : pas pour ETU_SANS ni LAU_SANS
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://push.example/' || id, 'k', 'a' from unnest($1::uuid[]) id`, [[ETU, LAU, LAU_AUTRE, CALME]]);
});

test('la dernière visite : marquer_vu au plus une fois par heure, réservé au membre lui-même, illisible depuis le site', async () => {
  await q(ETU, 'select public.marquer_vu()');
  const [{ vu_at: t1 }] = (await db.query('select vu_at from public.visites where user_id = $1', [ETU])).rows;
  await q(ETU, 'select public.marquer_vu()');
  assert.equal((await db.query('select vu_at from public.visites where user_id = $1', [ETU])).rows[0].vu_at.getTime(), t1.getTime(), 'moins d’une heure après : rien ne change');
  await db.query(`update public.visites set vu_at = now() - interval '61 minutes' where user_id = $1`, [ETU]);
  await q(ETU, 'select public.marquer_vu()');
  assert.ok(Date.now() - (await db.query('select vu_at from public.visites where user_id = $1', [ETU])).rows[0].vu_at.getTime() < 60e3, 'une heure après : notée de nouveau');
  await en(db, null, tx => tx.query('select public.marquer_vu()'), { role: 'anon' }).then(() => assert.fail('anon ne doit pas pouvoir l’appeler'), e => assert.match(e.message, /permission denied/));
  assert.deepEqual(await q(LAU, 'select * from public.visites'), [], 'aucune ligne lisible par un membre, même la sienne');
  await assert.rejects(q(LAU, `insert into public.visites (user_id, vu_at) values ($1, now() + interval '1 year')`, [LAU]), /row-level security/);
  await assert.rejects(q(LAU, 'select * from public.rappels_dus()'), /permission denied/);
  await assert.rejects(q(LAU, 'select public.rappels_push()'), /permission denied/);
  await db.query('delete from public.visites');
});

test('à l’installation, personne n’est rappelé tout de suite (date de mise en route), même avec quelque chose en attente', async () => {
  await message(LAU, ETU);
  assert.deepEqual(await dus(), {});
  assert.equal(await push(), 0);
  await db.query(`update public.app_secrets set valeur = (now() - interval '30 days')::text where cle = 'rappels_depuis'`);
  await db.query('delete from public.messages');
});

test('qui est choisi : absent depuis 2 jours ET quelque chose de concret l’attend, avec les vrais chiffres', async () => {
  for (const u of Object.keys(NOMS)) await visite(u, 3);
  await visite(LAU_AUTRE, 1);   // venu hier : pas de rappel, même s'il y a quelque chose
  assert.deepEqual(await dus(), {}, 'absents, mais rien ne les attend : pas de rappel');
  // Une demande de Salma (GI) : les lauréats de son parcours tout de suite, les autres 24 h après sans aide
  const [d] = await q(ETU, `insert into public.demandes (auteur_id, type, titre, details, lieu) values ($1, 'pfe', 'PFE en amélioration continue', 'Lean, VSM et Power BI : je cherche un PFE en usine, de février à juin.', 'Casablanca') returning id`, [ETU]);
  // Une offre pour son année publiée depuis sa visite (par CALME), un message non lu de Youssef
  await q(CALME, `insert into public.offers (author_id, type, titre, entreprise, description, annees, filieres) values ($1, 'pfe', 'PFE Lean', 'Lesieur', 'desc', '{5}', '{}')`, [CALME]);
  await message(LAU, ETU);
  // Nadia propose son aide : Salma a une proposition à regarder (et le mot de Nadia dans ses messages)
  await q(LAU_SANS, `insert into public.propositions (demande_id, aide, entreprise, message) values ($1, 'encadre', 'OCP', 'Je peux encadrer ton PFE à Jorf.')`, [d.id]);
  // Une candidature d'Imane sur l'offre de CALME
  const [o] = (await db.query(`select id from public.offers where titre = 'PFE Lean'`)).rows;
  await q(ETU_SANS, `insert into public.applications (student_id, offer_id, entreprise, titre) values ($1, $2, 'Lesieur', 'PFE Lean')`, [ETU_SANS, o.id]);
  const r = await dus();
  assert.deepEqual(Object.keys(r).sort(), ['CALME', 'ETU', 'ETU_SANS', 'LAU'].sort());
  assert.deepEqual(r.ETU.contenu, { messages: 2, propositions: 1, offres: 1 }, 'le mot de Nadia arrive aussi en message');
  assert.deepEqual(r.LAU.contenu, { demandes: 1 });
  assert.deepEqual(r.CALME.contenu, { demandes: 1, candidatures: 1 });
  assert.deepEqual(r.ETU_SANS.contenu, { offres: 1 });
  assert.equal(r.LAU_SANS, undefined, 'Nadia a déjà proposé son aide : plus rien ne l’attend');
  assert.equal(r.ETU.abonne, true); assert.equal(r.ETU_SANS.abonne, false);
  // Karim (autre parcours) : la demande ne lui est ouverte qu'après 24 h sans aide ; Salma a déjà une proposition
  await visite(LAU_AUTRE, 3);
  assert.equal((await dus()).LAU_AUTRE, undefined, 'demande d’un autre parcours, pas encore ouverte à tous');
  await db.query(`update public.demandes set created_at = now() - interval '25 hours' where id = $1`, [d.id]);
  await visite(LAU_AUTRE, 4);
  assert.deepEqual((await dus()).LAU_AUTRE?.contenu, { demandes: 1 }, 'ouverte à tous après 24 h : comptée à ce moment-là');
  await visite(LAU_AUTRE, 0.5);
  assert.equal((await dus()).LAU_AUTRE, undefined, 'déjà venu depuis qu’elle lui est ouverte');
});

test('le soir : une notification par membre abonné, par la file et son filtre, notée tout de suite', async () => {
  await vider();
  assert.equal(await push(), 3, 'ETU, LAU, CALME (ETU_SANS n’a pas de téléphone)');
  assert.deepEqual(await file(), [['ETU', { messages: 2, propositions: 1, offres: 1 }], ['LAU', { demandes: 1 }], ['CALME', { demandes: 1, candidatures: 1 }]]);
  assert.equal(await etat(ETU), 1);
  await vider();
  assert.equal(await push(), 0, 'relancé le même soir : rien de plus');
  assert.deepEqual(await file(), []);
});

test('espacement : 2 jours, puis 4, 7, et 14 jours entre deux rappels ; tout repart de zéro à la visite suivante', async () => {
  const un = async () => { await vider(); await push(); return (await file()).some(([n]) => n === 'LAU'); };
  await reculer(3);
  assert.equal(await un(), false, '3 jours après le 1er rappel : trop tôt (4)');
  await reculer(1);
  assert.equal(await un(), true, '4 jours après : 2e rappel');
  assert.equal(await etat(LAU), 2);
  await reculer(6);
  assert.equal(await un(), false, '6 jours après le 2e : trop tôt (7)');
  await reculer(1);
  assert.equal(await un(), true, '7 jours après : 3e rappel');
  await reculer(13);
  assert.equal(await un(), false);
  await reculer(1);
  assert.equal(await un(), true, '14 jours après : 4e rappel');
  await reculer(14);
  assert.equal(await un(), true, 'ensuite tous les 14 jours, au plus');
  assert.equal(await etat(LAU), 5);
  // Il revient : rien ce soir ; deux jours plus tard, la série repart du début
  await q(LAU, 'select public.marquer_vu()');
  assert.equal(await un(), false, 'venu aujourd’hui');
  // La demande n'est plus nouvelle pour lui : il faut quelque chose de neuf (une candidature sur son offre)
  await q(LAU, `insert into public.offers (author_id, type, titre, entreprise, description, annees, filieres) values ($1, 'stage', 'Stage méthodes', 'Renault', 'desc', '{5}', '{}')`, [LAU]);
  const [o] = (await db.query(`select id from public.offers where titre = 'Stage méthodes'`)).rows;
  await reculer(2);
  await q(ETU, `insert into public.applications (student_id, offer_id, entreprise, titre) values ($1, $2, 'Renault', 'Stage méthodes')`, [ETU, o.id]);
  assert.equal(await un(), true, '2 jours après sa visite');
  assert.equal(await etat(LAU), 1, 'la série est remise à zéro');
  assert.deepEqual((await file()).find(([n]) => n === 'LAU')[1], { candidatures: 1 }, 'la demande déjà là à sa visite n’est plus comptée');
});

test('catégorie « Rappels » coupée : rien, ni notification ni email ; une autre catégorie coupée n’y change rien', async () => {
  await db.query('delete from public.rappels_visite');
  await q(ETU, `update public.profiles set notif_push = '{"rappels": false}' where id = $1`, [ETU]);
  await q(CALME, `update public.profiles set notif_push = '{"messages": false, "demandes": false}' where id = $1`, [CALME]);
  await q(ETU_SANS, `update public.profiles set notif_push = '{"rappels": false}' where id = $1`, [ETU_SANS]);
  await vider();
  await push();
  const qui = (await file()).map(([n]) => n);
  assert.ok(!qui.includes('ETU') && qui.includes('CALME'), qui.join());
  assert.ok(!(await emails()).includes('ETU_SANS'), 'l’email suit la même case');
  // Même une insertion directe dans la file passe par le filtre
  await vider();
  await db.query(`insert into public.push_queue (user_id, kind, data) values ($1, 'rappel_visite', '{"messages":1}')`, [ETU]);
  assert.deepEqual(await file(), []);
  for (const u of [ETU, CALME, ETU_SANS]) await q(u, `update public.profiles set notif_push = '{}' where id = $1`, [u]);
});

test('emails : sans téléphone, ou absent depuis 5 jours ; une fois par semaine ; jamais le jour d’un autre email du réseau', async () => {
  await db.query('delete from public.rappels_visite');
  for (const u of Object.keys(NOMS)) await visite(u, 3);
  await q(CALME, `insert into public.offers (author_id, type, titre, entreprise, description, annees, filieres) values ($1, 'pfe', 'PFE Qualité', 'Lesieur', 'desc', '{5}', '{}')`, [CALME]);
  await vider();
  await push();
  assert.deepEqual(await emails(), ['ETU_SANS'], 'sans téléphone : l’email ; avec un téléphone, absent depuis 3 jours : la notification suffit');
  const [l] = (await db.query('select email, langue, token, contenu from public.rappels_emails_a_envoyer(150)')).rows;
  assert.equal(l.langue, 'ar'); assert.ok(l.email && l.token); assert.ok(l.contenu.offres >= 1);
  // Le résumé de la semaine (ou l'email des demandes) est parti ce matin : pas de rappel par email ce soir
  await db.query(`update public.notif_etat set resume_at = now() - interval '10 hours' where user_id = $1`, [ETU_SANS]);
  assert.deepEqual(await emails(), []);
  await db.query(`update public.notif_etat set resume_at = now() - interval '6 days', demandes_at = now() - interval '3 hours' where user_id = $1`, [ETU_SANS]);
  assert.deepEqual(await emails(), []);
  await db.query(`update public.notif_etat set demandes_at = now() - interval '30 hours' where user_id = $1`, [ETU_SANS]);
  assert.deepEqual(await emails(), ['ETU_SANS']);
  // Résumé désactivé (lien « Se désabonner ») : pas de rappel par email non plus
  await db.query('update public.profiles set emails_hebdo = false where id = $1', [ETU_SANS]);
  assert.deepEqual(await emails(), []);
  await db.query('update public.profiles set emails_hebdo = true where id = $1', [ETU_SANS]);
  await db.query('select public.rappels_emails_envoyes($1)', [[ETU_SANS]]);
  assert.equal(await etat(ETU_SANS), 1, 'l’email compte comme le rappel du soir');
  assert.deepEqual(await emails(), [], 'déjà parti');
  // 4 jours plus tard, le 2e rappel est dû, mais un email par semaine au plus : il attend le 7e jour
  await reculer(4);
  assert.ok(!(await emails()).includes('ETU_SANS'));
  await reculer(3);
  assert.ok((await emails()).includes('ETU_SANS'));
  // Absent depuis 5 jours avec un téléphone : la notification du soir, et l'email aussi
  await db.query('delete from public.rappels_visite');
  await visite(LAU, 6);
  await message(ETU, LAU, 'Merci pour le stage');
  await vider();
  await push();
  assert.ok((await file()).some(([n]) => n === 'LAU'));
  assert.ok((await emails()).includes('LAU'), 'absent depuis 6 jours : aussi par email');
  await db.query('select public.rappels_emails_envoyes($1)', [[LAU]]);
  assert.equal(await etat(LAU), 1, 'notification et email du même soir : un seul rappel');
});

test('plafond : 150 emails de rappel par jour pour toute la plateforme, et la limite demandée', async () => {
  assert.equal((await emails(1)).length, 1);
  await db.query(`insert into auth.users (id, email) select ('00000000-0000-4000-9000-' || lpad(i::text, 12, '0'))::uuid, 'x' || i || '@exemple.ma' from generate_series(1, 150) i`);
  await db.query(`insert into public.profiles (id, full_name, role, filiere, promo) select id, 'Membre ' || right(id::text, 3), 'etudiant', 'Génie Industriel et Productique', 2020 from auth.users where email like 'x%'`);
  await db.query(`insert into public.rappels_visite (user_id, n, dernier_at, email_at) select id, 1, now() - interval '3 hours', now() - interval '3 hours' from auth.users where email like 'x%'`);
  assert.deepEqual(await emails(), [], '150 déjà partis aujourd’hui');
  await db.query(`update public.rappels_visite set email_at = now() - interval '21 hours' where user_id in (select id from auth.users where email like 'x%')`);
  assert.ok((await emails()).length >= 1);
});

test('désabonnement depuis l’email : la case « Rappels » se décoche, le reste ne change pas ; un faux jeton ne fait rien', async () => {
  await q(ETU_SANS, `update public.profiles set notif_push = '{"offres": false}' where id = $1`, [ETU_SANS]);
  const [{ token }] = (await db.query('select token from public.notif_etat where user_id = $1', [ETU_SANS])).rows;
  assert.equal((await en(db, null, tx => tx.query('select public.se_desabonner_rappels($1) ok', [token]), { role: 'anon' })).rows[0].ok, true);
  assert.deepEqual((await db.query('select notif_push, emails_hebdo from public.profiles where id = $1', [ETU_SANS])).rows[0], { notif_push: { offres: false, rappels: false }, emails_hebdo: true });
  assert.equal((await en(db, null, tx => tx.query('select public.se_desabonner_rappels($1) ok', [uid(999)]), { role: 'anon' })).rows[0].ok, false);
});

test('mise à jour relancée : rien n’est perdu, une seule tâche du soir', async () => {
  const avant = (await db.query('select count(*)::int n from public.rappels_visite')).rows[0].n;
  const depuis = (await db.query(`select valeur from public.app_secrets where cle = 'rappels_depuis'`)).rows[0].valeur;
  await db.exec(fs.readFileSync(SCHEMA, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, ''));
  assert.equal((await db.query('select count(*)::int n from public.rappels_visite')).rows[0].n, avant);
  assert.equal((await db.query(`select valeur from public.app_secrets where cle = 'rappels_depuis'`)).rows[0].valeur, depuis, 'la date de mise en route ne bouge pas');
  assert.equal((await db.query(`select public.push_categorie('rappel_visite') c`)).rows[0].c, 'rappels');
});
