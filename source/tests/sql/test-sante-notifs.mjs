// Santé des notifications : rien ne se perd sans trace. Le journal dit pourquoi une notification n'est pas partie
// (-1 aucun téléphone abonné, -2 catégorie coupée, -3 abandonnée), un abonnement mort est retiré et son adresse notée
// (push_morts), abonner_push répond « mort » à une adresse morte, les erreurs se lisent (raise warning) sans jamais
// bloquer le membre, et l'administration lit des totaux seulement (admin_sante_notifs).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nouvelleBase, creerCompte, en, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
const MAJ = process.env.MAJ_SQL || new URL('../../supabase/mise-a-jour.sql', import.meta.url).pathname;
let db;
const ETU = uid(1401), LAU = uid(1402), SANS = uid(1403), COUPE = uid(1404), ETU2 = uid(1405), LAU2 = uid(1406), LAU3 = uid(1407),
  ETU3 = uid(1408), RES = uid(1409);
const GI = 'Génie Industriel et Productique';
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const service = (sql, p) => en(db, null, tx => tx.query(sql, p), { role: 'service_role' }).then(r => r.rows);
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const journal = async u => (await db.query('select kind, code from public.push_journal where user_id = $1 order by id', [u])).rows;
const file = async u => (await db.query('select kind from public.push_queue where user_id = $1 order by id', [u])).rows.map(r => r.kind);
const sql = chemin => fs.readFileSync(chemin, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, '');
// Les avertissements (raise warning) d'une requête
const avertissements = async (texte, p = []) => {
  const notes = [];
  await db.query(texte, p, { onNotice: n => notes.push(n) });
  return notes.filter(n => n.severity === 'WARNING').map(n => n.message);
};

before(async () => {
  db = await nouvelleBase(SCHEMA);
  // pg_net simulé : chaque appel de la fonction est noté, en-têtes compris
  await db.exec(`create schema net;
    create table net.appels (n serial, url text, body jsonb, headers jsonb);
    create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
      returns bigint language sql as $$ insert into net.appels (url, body, headers) values (url, body, headers) returning n::bigint $$;
    insert into public.app_secrets (cle, valeur) values ('projet_url', 'https://projet.supabase.co'), ('anon_key', 'sb_publishable_cle');`);
  const etu = (id, full_name, extra = {}) => creerCompte(db, { id, full_name, role: 'etudiant', filiere: GI, promo: S + 1, ...extra });
  const lau = (id, full_name, extra = {}) => creerCompte(db, { id, full_name, role: 'laureat', filiere: GI, promo: 2015, entreprise: 'OCP', ...extra });
  await etu(ETU, 'Salma Bennani'); await lau(LAU, 'Youssef Amrani'); await etu(SANS, 'Rayan Sans'); await lau(COUPE, 'Karim Coupe');
  await etu(ETU2, 'Hiba Alaoui'); await lau(LAU2, 'Nadia Berrada'); await lau(LAU3, 'Omar Fassi'); await etu(ETU3, 'Imane Kettani'); await etu(RES, 'Adam Res');
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
    ($1, 'https://fcm.googleapis.com/fcm/send/etu', 'k', 'a'), ($2, 'https://web.push.apple.com/lau', 'k', 'a'),
    ($3, 'https://updates.push.services.mozilla.com/wpush/v2/coupe', 'k', 'a'), ($4, 'https://fcm.googleapis.com/fcm/send/lau3', 'k', 'a')`,
  [ETU, LAU, COUPE, LAU3]);
  await db.query(`update public.profiles set notif_push = '{"reseau": false}' where id = $1`, [COUPE]);
  await db.query(`update public.profiles set notif_push = '{"match": false}' where id = $1`, [LAU3]);
});

test('abonner_push_etat : « ok », puis « mort » pour une adresse refusée pour de bon, qui n’est pas réinscrite ; abonner_push (sans réponse) fait pareil', async () => {
  const neuve = 'https://fcm.googleapis.com/fcm/send/etu3-neuve', morte = 'https://fcm.googleapis.com/fcm/send/etu3-morte',
    autre = 'https://fcm.googleapis.com/fcm/send/etu3-autre';
  assert.deepEqual(await q(ETU3, 'select public.abonner_push_etat($1, $2, $3) r', [neuve, 'k', 'a']), [{ r: 'ok' }]);
  assert.deepEqual(await q(ETU3, 'select public.abonner_push_etat($1, $2, $3) r', [neuve, 'k', 'a']), [{ r: 'ok' }], 'déjà là : rien ne change');
  await db.query('insert into public.push_morts (endpoint) values ($1)', [morte]);
  assert.deepEqual(await q(ETU3, 'select public.abonner_push_etat($1, $2, $3) r', [morte, 'k', 'a']), [{ r: 'mort' }]);
  // abonner_push, celle de l'ancien site et des autres branches : ne répond rien, n'inscrit pas non plus l'adresse morte
  await q(ETU3, 'select public.abonner_push($1, $2, $3)', [morte, 'k', 'a']);
  await q(ETU3, 'select public.abonner_push($1, $2, $3)', [autre, 'k', 'a']);
  assert.deepEqual((await db.query('select endpoint from public.push_subscriptions where user_id = $1 order by endpoint', [ETU3])).rows.map(r => r.endpoint),
    [autre, neuve]);
  const resultat = async f => (await db.query(`select pg_get_function_result($1::regprocedure) t`, [f])).rows[0].t;
  assert.equal(await resultat('public.abonner_push(text,text,text)'), 'void', 'le type de retour d’avant : un autre mise-a-jour.sql peut la redéfinir');
  assert.equal(await resultat('public.abonner_push_etat(text,text,text)'), 'text');
  // Mêmes droits qu'avant : les membres connectés seulement
  for (const f of ['public.abonner_push(text,text,text)', 'public.abonner_push_etat(text,text,text)']) {
    const [{ anon, membre }] = (await db.query(`select has_function_privilege('anon', $1, 'execute') anon,
      has_function_privilege('authenticated', $1, 'execute') membre`, [f])).rows;
    assert.equal(anon, false, f); assert.equal(membre, true, f);
  }
  await assert.rejects(q(null, 'select public.abonner_push_etat($1, $2, $3)', [neuve, 'k', 'a']), /Connecte-toi d’abord/);
  await assert.rejects(q(ETU3, 'select public.abonner_push_etat($1, $2, $3)', ['http://exemple.ma/x', 'k', 'a']), /Abonnement invalide/);
  // push_morts : illisible depuis le site
  const [{ rls, regles }] = (await db.query(`select relrowsecurity rls, (select count(*)::int from pg_policies where tablename = 'push_morts') regles
    from pg_class where oid = 'public.push_morts'::regclass`)).rows;
  assert.equal(rls, true); assert.equal(regles, 0);
  assert.deepEqual(await q(ETU3, 'select * from public.push_morts'), []);
  await db.query('delete from public.push_subscriptions where user_id = $1', [ETU3]);
});

test('journal : sans téléphone (-1), catégorie coupée (-2) par pousser et par le filtre de la file, abandonnée (-3)', async () => {
  await db.query(`select public.pousser($1, 'reponse', '{}')`, [SANS]);
  assert.deepEqual(await journal(SANS), [{ kind: 'reponse', code: -1 }]);
  await db.query(`select public.pousser($1, 'reponse', '{}')`, [COUPE]);
  await db.query(`insert into public.push_queue (user_id, kind) values ($1, 'annonce')`, [COUPE]);
  assert.deepEqual(await journal(COUPE), [{ kind: 'reponse', code: -2 }, { kind: 'annonce', code: -2 }]);
  assert.deepEqual(await file(COUPE), []);
  // Ce qui part n'est noté qu'à son envoi (par la fonction)
  await db.query(`select public.pousser($1, 'reponse', '{}')`, [ETU]);
  assert.deepEqual(await file(ETU), ['reponse']); assert.deepEqual(await journal(ETU), []);
  // Abandonnée : un jour en file, ou 3 essais sans succès
  await db.query(`insert into public.push_queue (user_id, kind) values ($1, 'merci'), ($1, 'cafe')`, [ETU]);
  await db.query(`update public.push_queue set created_at = now() - interval '25 hours' where user_id = $1 and kind = 'merci'`, [ETU]);
  await db.query(`update public.push_queue set essais = 3, pris_at = now() - interval '3 minutes' where user_id = $1 and kind = 'cafe'`, [ETU]);
  await service('select public.relancer_push()');
  assert.deepEqual(await file(ETU), ['reponse']);
  assert.deepEqual((await journal(ETU)).sort((a, b) => a.kind.localeCompare(b.kind)), [{ kind: 'cafe', code: -3 }, { kind: 'merci', code: -3 }]);
  // Jamais de contenu au journal
  assert.deepEqual((await db.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'push_journal' order by ordinal_position`)).rows
    .map(r => r.column_name), ['id', 'user_id', 'kind', 'code', 'at']);
  await db.query('delete from public.push_queue');
});

test('Match : chaque côté sans téléphone est noté (-1), l’intérêt aussi ; un côté qui a coupé Match est noté (-2)', async () => {
  const choisir = (u, profil) => q(u, `insert into public.match_choix (cible_profil, choix) values ($1, 'oui')`, [profil]);
  // Omar (téléphone, Match coupé) s'intéresse à Hiba (sans téléphone), puis Hiba dit oui : match
  await choisir(LAU3, ETU2);
  assert.deepEqual(await journal(ETU2), [{ kind: 'match_interet', code: -1 }]);
  await choisir(ETU2, LAU3);
  assert.equal((await db.query('select count(*)::int n from public.matchs where etudiant_id = $1 and laureat_id = $2', [ETU2, LAU3])).rows[0].n, 1);
  assert.deepEqual(await journal(ETU2), [{ kind: 'match_interet', code: -1 }, { kind: 'match', code: -1 }]);
  assert.deepEqual(await journal(LAU3), [{ kind: 'match', code: -2 }]);
  assert.deepEqual(await file(LAU3), []);
  // Nadia (sans téléphone) et Salma (téléphone) : Salma reçoit l'intérêt puis le match, Nadia est notée
  await choisir(LAU2, ETU);
  await choisir(ETU, LAU2);
  assert.deepEqual(await file(ETU), ['match_interet', 'match']);
  assert.deepEqual(await journal(LAU2), [{ kind: 'match', code: -1 }]);
  await db.query('delete from public.push_queue');
});

test('Match : un « oui » repris après « Plus tard » ne renvoie pas l’intérêt, et ne le renote pas sans téléphone (une fois par jour et par paire)', async () => {
  const choisir = (u, profil, choix = 'oui') => q(u, `insert into public.match_choix (cible_profil, choix) values ($1, $2)
    on conflict (user_id, cible_profil) do update set choix = excluded.choix, updated_at = now()`, [profil, choix]);
  const interets = async u => (await journal(u)).filter(l => l.kind === 'match_interet');
  // Youssef (téléphone) s'intéresse à Rayan (sans téléphone) : noté une fois (-1)
  await choisir(LAU, SANS);
  assert.deepEqual(await interets(SANS), [{ kind: 'match_interet', code: -1 }]);
  // « Plus tard », puis « oui » encore, deux fois : rien de plus au journal (avant : un -1 à chaque « oui »)
  for (let i = 0; i < 2; i++) { await choisir(LAU, SANS, 'plus_tard'); await choisir(LAU, SANS); }
  assert.deepEqual(await interets(SANS), [{ kind: 'match_interet', code: -1 }]);
  // Retiré puis refait : pareil
  await q(LAU, 'delete from public.match_choix where cible_profil = $1', [SANS]); await choisir(LAU, SANS);
  assert.deepEqual(await interets(SANS), [{ kind: 'match_interet', code: -1 }]);
  // Avec un téléphone : une seule notification en file, et rien au journal avant son envoi
  await choisir(COUPE, ETU);
  for (let i = 0; i < 2; i++) { await choisir(COUPE, ETU, 'plus_tard'); await choisir(COUPE, ETU); }
  assert.deepEqual(await file(ETU), ['match_interet']);
  assert.deepEqual(await interets(ETU), []);
  // Le lendemain, la même paire peut de nouveau prévenir
  await db.query(`update public.notif_cadence set at = now() - interval '25 hours' where cle = $1`, ['match_interet:' + SANS + ':' + LAU]);
  await choisir(LAU, SANS, 'plus_tard'); await choisir(LAU, SANS);
  assert.deepEqual(await interets(SANS), [{ kind: 'match_interet', code: -1 }, { kind: 'match_interet', code: -1 }]);
  await db.query('delete from public.match_choix where user_id in ($1, $2)', [LAU, COUPE]);
  await db.query('delete from public.push_queue');
});

test('push_resultats : accepté remet à zéro ; 404, 410, ou 3 refus définitifs d’affilée quand le service accepte un autre téléphone, retirent l’abonnement et notent son adresse ; 413 ne compte pas', async () => {
  const ep = n => `https://fcm.googleapis.com/fcm/send/res-${n}`;
  const ids = {};
  for (const n of ['ok', 'refus', 'parti', 'trop', 'panne', 'perdu', 'repris']) {
    ids[n] = (await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, 'k', 'a') returning id`, [RES, ep(n)])).rows[0].id;
  }
  await db.query('update public.push_subscriptions set refus = 2 where id = $1', [ids.repris]);
  const tour = l => service('select public.push_resultats($1::jsonb) r', [JSON.stringify(l)]).then(r => r[0].r);
  const etat = async n => (await db.query('select dernier_code, refus, dernier_envoi_at is not null envoye, refus_at is not null refuse from public.push_subscriptions where id = $1', [ids[n]])).rows[0];
  const retires = await tour([
    { id: ids.ok, code: 201, recu: true, refus: false }, { id: ids.refus, code: 403, recu: false, refus: true },
    { id: ids.parti, code: 410, recu: false, refus: false }, { id: ids.trop, code: 413, recu: false, refus: false },
    { id: ids.panne, code: 503, recu: false, refus: false }, { id: ids.perdu, code: 404, recu: false, refus: false },
    { id: ids.repris, code: 201, recu: true, refus: false },
  ]);
  assert.deepEqual([...retires].sort(), [ids.parti, ids.perdu].sort());
  assert.deepEqual(await etat('ok'), { dernier_code: 201, refus: 0, envoye: true, refuse: false });
  assert.deepEqual(await etat('refus'), { dernier_code: 403, refus: 1, envoye: true, refuse: true });
  assert.deepEqual(await etat('trop'), { dernier_code: 413, refus: 0, envoye: true, refuse: false }, '413 : la notification était trop longue, pas la faute du téléphone');
  assert.deepEqual(await etat('panne'), { dernier_code: 503, refus: 0, envoye: true, refuse: false });
  assert.deepEqual(await etat('repris'), { dernier_code: 201, refus: 0, envoye: true, refuse: false }, 'accepté : le compte des refus repart de zéro');
  assert.equal(await etat('parti'), undefined);
  const morts = async () => (await db.query(`select endpoint from public.push_morts where endpoint like '%res-%' order by endpoint`)).rows.map(r => r.endpoint);
  assert.deepEqual(await morts(), [ep('parti'), ep('perdu')]);
  // Deuxième refus, puis troisième : retiré au troisième
  assert.deepEqual(await tour([{ id: ids.refus, code: 401, recu: false, refus: true }]), []);
  assert.equal((await etat('refus')).refus, 2);
  assert.deepEqual(await tour([{ id: ids.refus, code: 400, recu: false, refus: true }]), [ids.refus]);
  assert.equal(await etat('refus'), undefined);
  assert.deepEqual(await morts(), [ep('parti'), ep('perdu'), ep('refus')]);
  // L'appareil qui redonne une adresse morte doit se réabonner
  assert.deepEqual(await q(RES, 'select public.abonner_push_etat($1, $2, $3) r', [ep('refus'), 'k', 'a']), [{ r: 'mort' }]);
  // Une liste vide, ou rien de lisible : rien ne bouge
  assert.deepEqual(await tour([]), []);
  assert.deepEqual((await service(`select public.push_resultats('{"pas":"une liste"}'::jsonb) r`))[0].r, []);
  // Réservé à la fonction (clé de service)
  await assert.rejects(q(RES, `select public.push_resultats('[]'::jsonb)`), /permission denied/);
  await db.query('delete from public.push_subscriptions where user_id = $1', [RES]);
});

test('push_resultats : trois refus d’affilée sans qu’un autre téléphone du même service accepte depuis le premier : gardés, dit une fois chacun ; la preuve venue plus tard retire au refus suivant', async () => {
  // Windows ici : aucun autre téléphone de ce service dans la base
  const ep = n => `https://wns2-par02p.notify.windows.com/w/?token=preuve-${n}`;
  const abo = async (u, n) => (await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, 'k', 'a') returning id`, [u, ep(n)])).rows[0].id;
  const W1 = await abo(RES, 'w1'), W2 = await abo(ETU3, 'w2'), W3 = await abo(LAU2, 'w3'), W4 = await abo(ETU2, 'w4');
  const F = (await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://fcm.googleapis.com/fcm/send/preuve-f', 'k', 'a') returning id`, [ETU2])).rows[0].id;
  const tour = async l => {
    const notes = [];
    const r = await db.query('select public.push_resultats($1::jsonb) r', [JSON.stringify(l)], { onNotice: n => notes.push(n) });
    return { retires: r.rows[0].r, w: notes.filter(n => n.severity === 'WARNING').map(n => n.message) };
  };
  const refus = id => ({ id, code: 403, recu: false, refus: true }), accepte = id => ({ id, code: 201, recu: true, refus: false });
  const etat = async id => (await db.query('select refus, refus_depuis from public.push_subscriptions where id = $1', [id])).rows[0];
  const morts = async () => (await db.query(`select endpoint from public.push_morts where endpoint like '%preuve-%' order by endpoint`)).rows.map(r => r.endpoint);
  // La clé de la plateforme ne va plus : chaque tour n'a qu'un téléphone (un message, une candidature), tous refusent.
  // Un autre service qui accepte (FCM) ne prouve rien pour Windows.
  const avert = [];
  for (let n = 0; n < 3; n++) {
    for (const id of [W1, W2, W3]) {
      const r = await tour([refus(id)]);
      assert.deepEqual(r.retires, [], 'personne n’est retiré');
      avert.push(...r.w);
      if (n === 0 && id === W1) await tour([accepte(F)]);
    }
  }
  for (const id of [W1, W2, W3]) assert.equal((await etat(id)).refus, 3);
  assert.equal(avert.length, 3, 'dit une fois par téléphone, à son troisième refus');
  for (const w of avert) assert.match(w, /^push_resultats : des téléphones refusent trois fois de suite et aucun autre du même service n'accepte \(windows\) : gardés/);
  assert.deepEqual(await tour([refus(W1)]), { retires: [], w: [] }, 'un quatrième refus : gardé, et rien de redit');
  assert.deepEqual(await morts(), []);
  // Windows accepte maintenant un autre téléphone : c'était bien W1 et W2 qu'il refusait ; retirés à leur refus suivant
  assert.deepEqual(await tour([accepte(W4)]), { retires: [], w: [] });
  assert.deepEqual(await tour([refus(W1)]), { retires: [W1], w: [] });
  assert.deepEqual(await tour([refus(W2), accepte(W4)]), { retires: [W2], w: [] }, 'la preuve peut venir du même tour');
  assert.deepEqual(await morts(), [ep('w1'), ep('w2')]);
  // Un envoi accepté arrête la série : la preuve d'avant ne compte pas pour la suivante
  await tour([accepte(W3)]);
  assert.deepEqual(await etat(W3), { refus: 0, refus_depuis: null });
  const r1 = await tour([refus(W3)]);
  const debut = (await etat(W3)).refus_depuis;
  assert.ok(debut, 'le premier refus de la série est daté'); assert.deepEqual(r1, { retires: [], w: [] });
  await tour([refus(W3)]);
  assert.equal((await etat(W3)).refus_depuis.getTime(), debut.getTime(), 'le début de la série ne bouge plus');
  const r3 = await tour([refus(W3)]);
  assert.deepEqual(r3.retires, [], 'W4 a accepté avant cette série : rien de prouvé');
  assert.equal(r3.w.length, 1);
  // Un abonnement en refus d'avant cette colonne (refus_depuis vide) : son dernier refus sert de début
  const W5 = await abo(SANS, 'w5');
  await db.query(`update public.push_subscriptions set refus = 2, refus_at = now() - interval '2 days', refus_depuis = null where id = $1`, [W5]);
  await tour([accepte(W4)]);
  assert.deepEqual(await tour([refus(W5)]), { retires: [W5], w: [] });
  assert.deepEqual(await morts(), [ep('w1'), ep('w2'), ep('w5')]);
  await db.query(`delete from public.push_subscriptions where endpoint like '%preuve-%'`);
});

test('push_rendues : une notification prise mais pas essayée revient tout de suite dans la file, sans essai compté', async () => {
  await db.query('delete from public.push_queue');
  await db.query(`insert into public.push_queue (user_id, kind) values ($1, 'message'), ($1, 'cafe'), ($1, 'merci')`, [ETU]);
  const pris = await service('select id, kind from public.prendre_push(2)');
  assert.deepEqual(pris.map(r => r.kind), ['message', 'cafe']);
  // Plus le temps d'essayer « cafe » (la fonction ne commence plus d'envoi après 45 s) : rendue ; un id inconnu ne gêne pas
  await service('select public.push_rendues($1::bigint[])', [[pris[1].id, 999999999]]);
  const lignes = async () => (await db.query('select kind, essais, pris_at is not null pris from public.push_queue order by id')).rows;
  assert.deepEqual(await lignes(), [{ kind: 'message', essais: 1, pris: true }, { kind: 'cafe', essais: 0, pris: false }, { kind: 'merci', essais: 0, pris: false }]);
  // Reprise à l'appel suivant, sans attendre les 2 minutes d'une notification prise
  assert.deepEqual((await service('select kind from public.prendre_push(10)')).map(r => r.kind), ['cafe', 'merci']);
  // Rendue deux fois, ou pas prise : rien de plus ; jamais d'essais négatifs
  const cafe = pris[1].id;
  await service('select public.push_rendues($1::bigint[])', [[cafe]]);
  await service('select public.push_rendues($1::bigint[])', [[cafe]]);
  await db.query('update public.push_queue set pris_at = now(), essais = 0 where id = $1', [cafe]);
  await service('select public.push_rendues($1::bigint[])', [[cafe]]);
  assert.deepEqual((await lignes())[1], { kind: 'cafe', essais: 0, pris: false });
  await service('select public.push_rendues(null)');
  await service(`select public.push_rendues('{}'::bigint[])`);
  // Réservée à la fonction (clé de service)
  await assert.rejects(q(ETU, `select public.push_rendues('{1}'::bigint[])`), /permission denied/);
  assert.equal((await db.query(`select has_function_privilege('service_role', 'public.push_rendues(bigint[])', 'execute') d`)).rows[0].d, true);
  await db.query('delete from public.push_queue');
});

test('nettoyage quotidien : les adresses mortes sont gardées 90 jours', async () => {
  await db.query(`insert into public.push_morts (endpoint, at) values ('https://exemple.ma/vieille', now() - interval '91 days'), ('https://exemple.ma/recente', now() - interval '10 days')`);
  await service('select public.taches_quotidiennes()');
  const restent = (await db.query(`select endpoint from public.push_morts where endpoint like 'https://exemple.ma/%'`)).rows.map(r => r.endpoint);
  assert.deepEqual(restent, ['https://exemple.ma/recente']);
});

test('appeler_notifier : la clé publique part aussi en apikey ; un échec se lit en avertissement, sans rien bloquer', async () => {
  await db.exec('delete from net.appels');
  await service(`select public.appeler_notifier('push')`);
  const [{ url, headers }] = (await db.query('select url, headers from net.appels')).rows;
  assert.equal(url, 'https://projet.supabase.co/functions/v1/notifier');
  assert.equal(headers.apikey, 'sb_publishable_cle');
  assert.equal(headers.Authorization, 'Bearer sb_publishable_cle');
  assert.match(headers['x-notifier'], /^[0-9a-f]{64}$/);
  // Sans l'adresse du projet : rien n'est appelé, et Logs > Postgres le dit
  await db.query(`delete from public.app_secrets where cle = 'projet_url'`);
  const w = await avertissements(`select public.appeler_notifier('push')`);
  assert.equal(w.length, 1); assert.match(w[0], /^appeler_notifier : projet_url ou anon_key absent/);
  await db.query(`insert into public.app_secrets (cle, valeur) values ('projet_url', 'https://projet.supabase.co')`);
  // pg_net en panne : l'action du membre passe, l'erreur est écrite
  await db.exec(`create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
    returns bigint language plpgsql as $$ begin raise exception 'pg_net en panne'; end $$;`);
  const w2 = await avertissements(`select public.appeler_notifier('push')`);
  assert.deepEqual(w2, ['appeler_notifier : pg_net en panne']);
  await db.exec(`create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
    returns bigint language sql as $$ insert into net.appels (url, body, headers) values (url, body, headers) returning n::bigint $$;`);
});

test('un producteur en erreur : un avertissement, l’action du membre passe', async () => {
  await db.exec(`alter table public.push_queue add constraint test_casse check (kind not in ('casse', 'message'))`);
  try {
    const w = await avertissements(`select public.pousser($1, 'casse', '{}')`, [ETU]);
    assert.equal(w.length, 1); assert.match(w[0], /^pousser : .*test_casse/);
    // Une vraie action : le message part, la notification ratée est écrite dans les journaux de Postgres
    const avant = (await db.query('select count(*)::int n from public.messages where dest_id = $1', [ETU])).rows[0].n;
    const w2 = await avertissements(`insert into public.messages (author_id, dest_id, type, body) values ($1, $2, 'texte', 'Bonjour')`, [LAU, ETU]);
    assert.equal((await db.query('select count(*)::int n from public.messages where dest_id = $1', [ETU])).rows[0].n, avant + 1);
    assert.equal(w2.length, 1); assert.match(w2[0], /^pousser : .*test_casse/);
    assert.deepEqual(await file(ETU), []);
  } finally {
    await db.exec('alter table public.push_queue drop constraint test_casse');
  }
  // Toutes les fonctions des notifications le disent, aucune ne se tait
  const { rows } = await db.query(`select p.proname, pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('appeler_notifier', 'pousser', 'push_filtre', 'notif_evenements', 'notif_message', 'notif_demande',
      'notif_reaction_publique', 'notif_reponse_demande', 'notif_promo', 'notif_commentaire', 'notif_annonce', 'notif_mentorat_ouvert',
      'alerte_offre', 'notif_phase3', 'nouveau_laureat', 'notif_evenement', 'match_apres_choix', 'rappeler', 'noter_push')`);
  assert.ok(rows.length >= 15, 'les fonctions des notifications sont là');
  for (const r of rows) {
    assert.doesNotMatch(r.def, /exception\s+when\s+others\s+then\s+null/i, `${r.proname} ne doit pas se taire`);
    assert.match(r.def, /raise warning '/, `${r.proname} écrit son erreur`);
  }
});

test('admin_sante_notifs : réservée à l’administration, des totaux seulement', async () => {
  const b = await nouvelleBase(SCHEMA);
  const ADMIN = uid(1501), E1 = uid(1502), E2 = uid(1503), L1 = uid(1504), L2 = uid(1505), L3 = uid(1506);
  await creerCompte(b, { id: ADMIN, full_name: 'Admin École', role: 'etudiant', filiere: GI, promo: 2010 });
  await b.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  for (const [id, role, nom] of [[E1, 'etudiant', 'Salma Idrissi'], [E2, 'etudiant', 'Amine Tazi'], [L1, 'laureat', 'Youssef Alami'], [L2, 'laureat', 'Nadia Berrada'], [L3, 'laureat', 'Karim Fassi']]) {
    await creerCompte(b, { id, full_name: nom, role, filiere: GI, promo: role === 'etudiant' ? S + 1 : 2015 });
  }
  await b.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, recu_at, dernier_code, dernier_envoi_at, refus) values
    ($1, 'https://fcm.googleapis.com/fcm/send/e1', 'k', 'a', now() - interval '1 hour', 201, now() - interval '1 hour', 0),
    ($1, 'https://push.exemple.ma/e1', 'k', 'a', null, null, null, 0),
    ($2, 'https://web.push.apple.com/l1', 'k', 'a', now() - interval '3 days', 201, now() - interval '3 days', 0),
    ($2, 'https://updates.push.services.mozilla.com/wpush/v2/l1', 'k', 'a', null, 201, now() - interval '2 hours', 0),
    ($3, 'https://wns2-par02p.notify.windows.com/w/?token=l2', 'k', 'a', now() - interval '9 days', 403, now() - interval '1 day', 1)`, [E1, L1, L2]);
  await b.query(`insert into public.push_morts (endpoint, at) values ('https://exemple.ma/m1', now() - interval '1 day'), ('https://exemple.ma/m2', now() - interval '6 days'), ('https://exemple.ma/m3', now() - interval '8 days')`);
  // Le journal : aujourd'hui, avant-hier, il y a 6 jours (premier jour du panneau), il y a 8 jours (hors du panneau)
  const lignes = [
    [E1, 'message', 201, 0], [E1, 'message', 201, 0], [L1, 'message', 201, 0], [L1, 'message', 410, 0], [E1, 'match', 0, 0],
    [E2, 'message', -1, 0], [L2, 'offre_alerte', -2, 0], [E1, 'message', -3, 0], [E1, 'inconnu', -4, 0],
    [L1, 'match', 201, 2], [L1, 'match', 201, 2], [L2, 'match', 403, 2], [L2, 'match', 429, 2],
    [E1, 'test', 201, 6], [L1, 'offre_alerte', 413, 6], [E1, 'message', 201, 8], [E1, 'message', 201, 8],
  ];
  for (const [u, kind, code, jours] of lignes) {
    await b.query(`insert into public.push_journal (user_id, kind, code, at) values ($1, $2, $3, now() - make_interval(days => $4::int))`, [u, kind, code, jours]);
  }
  await b.query(`insert into public.push_queue (user_id, kind, created_at) values ($1, 'message', now() - interval '95 seconds'), ($1, 'cafe', now() - interval '10 seconds')`, [E1]);
  const lire = (u, role = 'authenticated') => en(b, u, tx => tx.query('select public.admin_sante_notifs() s'), { role }).then(r => r.rows[0].s);
  await assert.rejects(lire(E1), /Réservé à l’administration/);
  await assert.rejects(lire(null, 'anon'), /permission denied/);
  const s = await lire(ADMIN);
  assert.deepEqual(s.roles, [{ role: 'admin', membres: 1, avec_tel: 0 }, { role: 'etudiant', membres: 2, avec_tel: 1 }, { role: 'laureat', membres: 3, avec_tel: 2 }]);
  assert.deepEqual(s.telephones, { total: 5, recus_24h: 1, recus_7j: 2, muets: 1, en_refus: 1, retires_7j: 2 });
  assert.deepEqual(s.services, { fcm: 1, apple: 1, mozilla: 1, windows: 1, autre: 1 });
  assert.equal(s.jours.length, 7);
  const jour = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  assert.deepEqual(s.jours.map(j => j.jour), [6, 5, 4, 3, 2, 1, 0].map(jour));
  const vide = { envoyees: 0, refusees: 0, echecs: 0, sans_tel: 0, coupees: 0, abandonnees: 0, jetees: 0 };
  assert.deepEqual(s.jours[6], { jour: jour(0), envoyees: 3, refusees: 1, echecs: 1, sans_tel: 1, coupees: 1, abandonnees: 1, jetees: 1 });
  assert.deepEqual(s.jours[4], { jour: jour(2), ...vide, envoyees: 2, refusees: 1, echecs: 1 });
  assert.deepEqual(s.jours[0], { jour: jour(6), ...vide, envoyees: 1, refusees: 1 });
  assert.deepEqual(s.jours[1], { jour: jour(5), ...vide });
  assert.deepEqual(s.types, [
    { kind: 'message', total: 6, envoyees: 3, perdues: 3, coupees: 0, echecs: 0 },
    { kind: 'match', total: 5, envoyees: 2, perdues: 1, coupees: 0, echecs: 2 },
    { kind: 'offre_alerte', total: 2, envoyees: 0, perdues: 1, coupees: 1, echecs: 0 },
    { kind: 'inconnu', total: 1, envoyees: 0, perdues: 1, coupees: 0, echecs: 0 },
    { kind: 'test', total: 1, envoyees: 1, perdues: 0, coupees: 0, echecs: 0 },
  ]);
  assert.equal(s.file.n, 2); assert.ok(s.file.age_s >= 95 && s.file.age_s < 200, `âge de la plus ancienne : ${s.file.age_s}`);
  // Ni pg_cron ni pg_net ici : null, sans erreur
  assert.equal(s.cron, null); assert.equal(s.http, null);
  // Des totaux seulement : aucun identifiant, aucune adresse
  const texte = JSON.stringify(s);
  for (const id of [ADMIN, E1, E2, L1, L2, L3]) assert.ok(!texte.includes(id), 'aucun identifiant');
  assert.doesNotMatch(texte, /@|https?:|exemple|googleapis|apple\.com|Salma|Youssef/);
  // pg_cron et pg_net lisibles : le dernier passage de la tâche de chaque minute et la dernière réponse de la fonction
  await b.exec(`create schema cron;
    create table cron.job (jobid bigint primary key, jobname text);
    create table cron.job_run_details (runid bigserial, jobid bigint, start_time timestamptz, end_time timestamptz, status text, return_message text);
    insert into cron.job values (1, 'ensam-quotidien');
    create schema net;
    create table net._http_response (id bigint primary key, status_code int, content text, timed_out boolean, error_msg text, created timestamptz);
    insert into net._http_response values (1, 200, '{"sent":3}', false, null, now() - interval '2 minutes'), (2, 401, '{"error":"x"}', false, null, now() - interval '1 minute');`);
  const s2 = await lire(ADMIN);
  assert.deepEqual(s2.cron, { existe: false }, 'la tâche de chaque minute n’est pas programmée');
  assert.equal(s2.http.code, 401); assert.equal(s2.http.delai, false); assert.equal(s2.http.erreur, false); assert.ok(s2.http.at);
  assert.ok(!JSON.stringify(s2).includes('"error"'), 'jamais le contenu de la réponse');
  await b.exec(`insert into cron.job values (2, 'ensam-rappels');
    insert into cron.job_run_details (jobid, start_time, end_time, status) values (2, now() - interval '61 seconds', now() - interval '60 seconds', 'succeeded'),
      (2, now() - interval '121 seconds', now() - interval '120 seconds', 'failed'), (1, now(), now(), 'failed');
    insert into net._http_response values (3, null, null, true, 'Timeout of 60000 ms reached', now());`);
  const s3 = await lire(ADMIN);
  assert.equal(s3.cron.existe, true); assert.equal(s3.cron.statut, 'succeeded'); assert.ok(s3.cron.at);
  assert.deepEqual({ code: s3.http.code, delai: s3.http.delai, erreur: s3.http.erreur }, { code: null, delai: true, erreur: true });
  await b.close();
});

test('mise à jour sur une base d’avant (abonner_push sans réponse, sans push_morts ni santé des abonnements), relancée deux fois', async () => {
  const b = await nouvelleBase(SCHEMA);
  const A = uid(1601), B = uid(1602);
  await creerCompte(b, { id: A, full_name: 'Salma Avant', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(b, { id: B, full_name: 'Admin Avant', role: 'etudiant', filiere: GI, promo: 2010 });
  await b.query(`update public.profiles set role = 'admin' where id = $1`, [B]);
  // La base telle qu'avant ce chantier
  await b.exec(`drop function public.admin_sante_notifs(); drop function public.service_push(text); drop function public.push_resultats(jsonb);
    drop function public.noter_push(uuid, text, int); drop table public.push_morts; drop function public.push_rendues(bigint[]);
    alter table public.push_subscriptions drop column dernier_code, drop column dernier_envoi_at, drop column refus, drop column refus_at,
      drop column refus_depuis;
    drop function public.abonner_push(text, text, text); drop function public.abonner_push_etat(text, text, text);
    create function public.abonner_push(p_endpoint text, p_p256dh text, p_auth text) returns void
    language plpgsql security definer set search_path = public as $$
    begin
      insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), p_endpoint, p_p256dh, p_auth)
        on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
    end $$;
    revoke all on function public.abonner_push(text, text, text) from public, anon;
    grant execute on function public.abonner_push(text, text, text) to authenticated;`);
  await en(b, A, tx => tx.query(`select public.abonner_push('https://fcm.googleapis.com/fcm/send/avant', 'k', 'a')`));
  await b.query(`insert into public.push_journal (user_id, kind, code) values ($1, 'message', 201)`, [A]);
  const maj = sql(MAJ);
  await b.exec(maj);
  await b.exec(maj);
  // Rien de perdu
  assert.deepEqual((await b.query('select endpoint, refus, dernier_code from public.push_subscriptions')).rows,
    [{ endpoint: 'https://fcm.googleapis.com/fcm/send/avant', refus: 0, dernier_code: null }]);
  assert.equal((await b.query('select count(*)::int n from public.push_journal')).rows[0].n, 1);
  // abonner_push garde son type (sans réponse) et ses droits ; abonner_push_etat répond, avec les mêmes droits
  const resultat = async f => (await b.query(`select pg_get_function_result($1::regprocedure) t`, [f])).rows[0].t;
  assert.equal(await resultat('public.abonner_push(text,text,text)'), 'void');
  assert.equal(await resultat('public.abonner_push_etat(text,text,text)'), 'text');
  const droit = async (role, f) => (await b.query(`select has_function_privilege($1, $2, 'execute') d`, [role, f])).rows[0].d;
  assert.equal(await droit('authenticated', 'public.abonner_push(text,text,text)'), true);
  assert.equal(await droit('anon', 'public.abonner_push(text,text,text)'), false);
  assert.equal(await droit('authenticated', 'public.abonner_push_etat(text,text,text)'), true);
  assert.equal(await droit('anon', 'public.abonner_push_etat(text,text,text)'), false);
  assert.equal(await droit('service_role', 'public.push_rendues(bigint[])'), true);
  assert.equal(await droit('authenticated', 'public.push_rendues(bigint[])'), false);
  assert.equal(await droit('service_role', 'public.push_resultats(jsonb)'), true);
  assert.equal(await droit('authenticated', 'public.push_resultats(jsonb)'), false);
  assert.equal(await droit('authenticated', 'public.noter_push(uuid,text,integer)'), false);
  assert.equal(await droit('authenticated', 'public.admin_sante_notifs()'), true);
  assert.equal(await droit('anon', 'public.admin_sante_notifs()'), false);
  assert.deepEqual((await en(b, A, tx => tx.query(`select public.abonner_push_etat('https://fcm.googleapis.com/fcm/send/avant', 'k2', 'a2') r`))).rows, [{ r: 'ok' }]);
  await b.query(`insert into public.push_morts (endpoint) values ('https://fcm.googleapis.com/fcm/send/morte')`);
  assert.deepEqual((await en(b, A, tx => tx.query(`select public.abonner_push_etat('https://fcm.googleapis.com/fcm/send/morte', 'k', 'a') r`))).rows, [{ r: 'mort' }]);
  assert.equal((await b.query(`select count(*)::int n from information_schema.columns where table_name = 'push_subscriptions' and column_name = 'refus_depuis'`)).rows[0].n, 1);
  // Le panneau répond tout de suite
  const s = (await en(b, B, tx => tx.query('select public.admin_sante_notifs() s'))).rows[0].s;
  assert.equal(s.telephones.total, 1); assert.equal(s.jours.at(-1).envoyees, 1);
  await b.close();
});

// abonner_push telle que la définit le mise-a-jour.sql de main (#44 à #50) et des branches parties de lui : sans réponse
const ABONNER_PUSH_MAIN = `create or replace function public.abonner_push(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connecte-toi d’abord.'; end if;
  if p_endpoint !~* '^https://' then raise exception 'Abonnement invalide.'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), p_endpoint, p_p256dh, p_auth)
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
      created_at = case when push_subscriptions.user_id = excluded.user_id then push_subscriptions.created_at else now() end
    where (push_subscriptions.user_id, push_subscriptions.p256dh, push_subscriptions.auth) is distinct from (excluded.user_id, excluded.p256dh, excluded.auth);
end $$;
revoke all on function public.abonner_push(text, text, text) from public, anon;
grant execute on function public.abonner_push(text, text, text) to authenticated;`;

test('base passée par la première version de ce chantier (abonner_push rendait du texte) : la mise à jour la remet sans réponse, et le mise-a-jour.sql d’une autre branche passe ensuite', async () => {
  const b = await nouvelleBase(SCHEMA);
  const A = uid(1701);
  await creerCompte(b, { id: A, full_name: 'Salma Version', role: 'etudiant', filiere: GI, promo: S + 1 });
  // La base après la première version : abonner_push rendait 'ok' ou 'mort' ; ni abonner_push_etat, ni push_rendues, ni refus_depuis
  await b.exec(`drop function public.abonner_push_etat(text, text, text); drop function public.push_rendues(bigint[]);
    alter table public.push_subscriptions drop column refus_depuis;
    drop function public.abonner_push(text, text, text);
    create function public.abonner_push(p_endpoint text, p_p256dh text, p_auth text) returns text
    language plpgsql security definer set search_path = public as $$
    begin
      if exists (select 1 from public.push_morts where endpoint = p_endpoint) then return 'mort'; end if;
      insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), p_endpoint, p_p256dh, p_auth)
        on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
      return 'ok';
    end $$;
    revoke all on function public.abonner_push(text, text, text) from public, anon;
    grant execute on function public.abonner_push(text, text, text) to authenticated;`);
  // Avant : le mise-a-jour.sql d'une autre branche échouait ici (cannot change return type of existing function)
  await assert.rejects(b.exec(ABONNER_PUSH_MAIN), /cannot change return type/);
  const maj = sql(MAJ);
  await b.exec(maj);
  await b.exec(maj);
  const resultat = async f => (await b.query(`select pg_get_function_result($1::regprocedure) t`, [f])).rows[0].t;
  assert.equal(await resultat('public.abonner_push(text,text,text)'), 'void');
  assert.equal(await resultat('public.abonner_push_etat(text,text,text)'), 'text');
  const droit = async (role, f) => (await b.query(`select has_function_privilege($1, $2, 'execute') d`, [role, f])).rows[0].d;
  for (const f of ['public.abonner_push(text,text,text)', 'public.abonner_push_etat(text,text,text)']) {
    assert.equal(await droit('authenticated', f), true, f); assert.equal(await droit('anon', f), false, f);
  }
  // Maintenant, l'autre branche passe (elle remet son abonner_push, sans la vérification des adresses mortes)…
  await b.exec(ABONNER_PUSH_MAIN);
  assert.equal(await resultat('public.abonner_push(text,text,text)'), 'void');
  // … et cette mise à jour relancée remet la sienne : une adresse morte n'est pas réinscrite
  await b.exec(maj);
  await b.query(`insert into public.push_morts (endpoint) values ('https://fcm.googleapis.com/fcm/send/morte-v1')`);
  await en(b, A, tx => tx.query(`select public.abonner_push('https://fcm.googleapis.com/fcm/send/morte-v1', 'k', 'a')`));
  assert.equal((await b.query('select count(*)::int n from public.push_subscriptions')).rows[0].n, 0);
  assert.deepEqual((await en(b, A, tx => tx.query(`select public.abonner_push_etat('https://fcm.googleapis.com/fcm/send/neuve-v1', 'k', 'a') r`))).rows, [{ r: 'ok' }]);
  await b.close();
});
