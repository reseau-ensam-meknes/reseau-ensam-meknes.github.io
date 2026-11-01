// Nouvelles notifications : le budget du jour (3 notifications programmées, DURES et DOUCES), la nuit calme (envois à
// beaucoup gardés jusqu'à 08:00, demandes ouvertes à tous jamais la nuit), l'ordre avant chaque plafond, un id par élément
// dans les notifications existantes, et une mise à jour relançable.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nouvelleBase, en, creerCompte, uid, reglerHorloge, aujourdhuiA } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const ETU = uid(1101), ETU2 = uid(1102), ETU3 = uid(1103), LAU = uid(1104), LAU2 = uid(1105), CIVIL = uid(1106), ADMIN = uid(1107);
const NOMS = { [ETU]: 'ETU', [ETU2]: 'ETU2', [ETU3]: 'ETU3', [LAU]: 'LAU', [LAU2]: 'LAU2', [CIVIL]: 'CIVIL', [ADMIN]: 'ADMIN' };
const GI = 'Génie Industriel et Productique', GC = 'Génie Civil', GIEO = 'Génie Industriel : Excellence Opérationnelle';
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const vider = () => db.query('delete from public.push_queue');
const file = async kind => (await db.query('select user_id, kind, data from public.push_queue' + (kind ? ' where kind = $1' : '') + ' order by id', kind ? [kind] : [])).rows
  .map(r => ({ qui: NOMS[r.user_id] || r.user_id, kind: r.kind, data: r.data }));
const qui = async kind => (await file(kind)).map(x => x.qui).sort();
const nuit = async () => (await db.query('select user_id, kind, data from public.push_nuit order by id')).rows.map(r => ({ qui: NOMS[r.user_id] || r.user_id, kind: r.kind, data: r.data }));
const choisir = (u, v) => db.query('update public.profiles set notif_push = $2::jsonb where id = $1', [u, JSON.stringify(v)]);
const abonner = ids => db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://push.example/' || id, 'k', 'a' from unnest($1::uuid[]) id on conflict do nothing`, [ids]);
const un = async (sql, p) => (await db.query(sql, p)).rows[0];
const place = async (u, k) => (await un('select public.programme_place($1, $2) ok', [u, k])).ok;
const offre = async (u, titre, champs = {}) => (await q(u, `insert into public.offers (author_id, type, titre, entreprise, description, annees, filieres)
  values ($1, $2, $3, 'Renault', 'Une vraie mission.', $4, '{}') returning id`, [u, champs.type || 'pfe', titre, champs.annees || '{5}']))[0].id;
const demande = async (u, titre) => (await un(`insert into public.demandes (auteur_id, type, titre, details, lieu) values ($1, 'pfe', $2,
  'Lean, VSM et Power BI : je cherche un PFE en usine, de février à juin.', 'Casablanca') returning id`, [u, titre])).id;

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ETU, full_name: 'Salma Bennani', role: 'etudiant', filiere: GI, promo: S + 1, ville: 'Casablanca' });
  await creerCompte(db, { id: ETU2, full_name: 'Hiba Alaoui', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: ETU3, full_name: 'Imane Kettani', role: 'etudiant', filiere: GI, promo: S + 2 });
  await creerCompte(db, { id: LAU, full_name: 'Youssef Amrani', role: 'laureat', filiere: GI, promo: 2015, entreprise: 'Renault', ville: 'Casablanca' });
  await creerCompte(db, { id: LAU2, full_name: 'Karim Tazi', role: 'laureat', filiere: GI, promo: 2018, entreprise: 'OCP' });
  await creerCompte(db, { id: CIVIL, full_name: 'Nadia Civil', role: 'laureat', filiere: GC, promo: 2016 });
  await creerCompte(db, { id: ADMIN, full_name: 'Admin École', role: 'etudiant', filiere: GI, promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  await db.query(`update public.profiles set cv_path = id::text || '/cv-1730000000000.pdf' where role = 'etudiant'`);
  await abonner(Object.keys(NOMS));
});

test('budget : 3 notifications programmées par jour ; une DURE part toujours et compte, une DOUCE attend ; jamais pour l’administration', async () => {
  const compte = async u => (await un(`select count(*)::int n from public.notif_programme where user_id = $1`, [u])).n;
  assert.equal(await place(ETU, 'match_jour'), true);
  assert.equal(await place(ETU, 'offre_bientot'), true);
  assert.equal(await place(ETU, 'rappel_visite'), true);
  assert.equal(await place(ETU, 'semaine'), false, 'la 4e DOUCE du jour attend');
  assert.equal(await compte(ETU), 3, 'refusée : pas notée');
  assert.equal(await place(ETU, 'rdv_demain'), true, 'une DURE part toujours');
  assert.equal(await compte(ETU), 4, 'et elle compte');
  assert.equal(await place(ETU, 'type_inconnu'), false, 'un type inconnu est DOUCE');
  for (const k of ['rdv_demain', 'match_jour', 'signalement']) assert.equal(await place(ADMIN, k), false, `admin : ${k}`);
  assert.equal(await place(null, 'rdv_demain'), false);
  // Deux DURES d'abord : il reste une place pour une DOUCE
  assert.equal(await place(LAU, 'match_attente'), true);
  assert.equal(await place(LAU, 'agenda_demain'), true);
  assert.equal(await place(LAU, 'groupe_jour'), true);
  assert.equal(await place(LAU, 'demande_attente'), false);
  // Le lendemain (jour UTC) : de la place de nouveau
  await db.query(`update public.notif_programme set at = at - interval '1 day'`);
  assert.equal(await place(ETU, 'semaine'), true);
  assert.equal(await place(LAU, 'demande_attente'), true);
  // Classes : celles du contrat
  const classes = (await db.query(`select k, public.programme_classe(k) c from unnest($1::text[]) k`, [[
    'rdv_demain', 'entretien_demain', 'agenda_demain', 'apres_rdv', 'match_attente',
    'match_jour', 'offre_bientot', 'demande_attente', 'demande_pause', 'rappel_visite', 'semaine', 'groupe_jour']])).rows;
  assert.deepEqual(Object.fromEntries(classes.map(r => [r.k, r.c])), {
    rdv_demain: 'dure', entretien_demain: 'dure', agenda_demain: 'dure', apres_rdv: 'dure', match_attente: 'dure',
    match_jour: 'douce', offre_bientot: 'douce', demande_attente: 'douce', demande_pause: 'douce', rappel_visite: 'douce', semaine: 'douce', groupe_jour: 'douce' });
  await db.query('delete from public.notif_programme');
});

test('budget : une tâche qui passe sur beaucoup de membres ne garde qu’un verrou (pas un par membre)', async () => {
  const membres = (await un(`select count(*)::int n from public.profiles where role in ('etudiant','laureat')`)).n;
  assert.ok(membres >= 5, 'plusieurs membres');
  const { notes, verrous } = await db.transaction(async tx => ({
    notes: (await tx.query(`select count(*) filter (where x.ok)::int n from (
      select public.programme_place(p.id, 'rdv_demain') ok from public.profiles p where p.role in ('etudiant','laureat') order by p.id) x`)).rows[0].n,
    // PGlite n'a qu'une session (pg_locks sans pid) : tous les verrous consultatifs sont ceux de cette transaction
    verrous: (await tx.query(`select count(*)::int n from pg_locks where locktype = 'advisory'`)).rows[0].n,
  }));
  assert.equal(notes, membres, 'chacun noté');
  assert.equal(verrous, 1, 'un seul verrou, gardé jusqu’à la fin de la transaction');
  assert.equal((await un(`select count(*)::int n from pg_locks where locktype = 'advisory'`)).n, 0, 'rendu à la fin');
  await db.query('delete from public.notif_programme');
});

test('nuit calme : de 21:30 à 08:00, aucune DOUCE ; une DURE oui ; 08:00 pile, c’est le jour', async () => {
  const calme = async h => (await un('select public.heure_calme($1::timestamptz) c', [h])).c;
  assert.equal(await calme(aujourdhuiA(21, 29)), false);
  assert.equal(await calme(aujourdhuiA(21, 30)), true);
  assert.equal(await calme(aujourdhuiA(0, 0)), true);
  assert.equal(await calme(aujourdhuiA(7, 59)), true);
  assert.equal(await calme(aujourdhuiA(8, 0)), false);
  try {
    await reglerHorloge(db, aujourdhuiA(22, 0));
    assert.equal(await place(LAU2, 'match_jour'), false);
    assert.equal(await place(LAU2, 'rappel_visite'), false);
    assert.equal(await place(LAU2, 'apres_rdv'), true, 'une DURE');
    await reglerHorloge(db, aujourdhuiA(7, 59));
    assert.equal(await place(LAU2, 'match_jour'), false);
    await reglerHorloge(db, aujourdhuiA(8, 0));
    assert.equal(await place(LAU2, 'match_jour'), true);
  } finally { await reglerHorloge(db); }
  await db.query('delete from public.notif_programme');
});

test('nuit : une offre publiée à 23:00 attend dans push_nuit ; à 08:00 elle part par le filtre des catégories, sans ce qui n’est plus vrai', async () => {
  await vider();
  try {
    await reglerHorloge(db, aujourdhuiA(23, 0));
    await choisir(ETU3, {});
    const o = await offre(LAU2, 'PFE publié le soir');
    const o2 = await offre(LAU2, 'PFE retiré dans la nuit');
    assert.deepEqual(await file('offre_alerte'), [], 'rien dans la file la nuit');
    const gardees = await nuit();
    assert.deepEqual([...new Set(gardees.filter(x => x.data.offre === o).map(x => x.qui))].sort(), ['CIVIL', 'ETU', 'ETU2', 'LAU'].sort(),
      'gardées pour le matin : les étudiants de 5A et les lauréats (relayer)');
    // Entre personnes : tout de suite, même la nuit (un message, une candidature)
    await db.query('insert into public.messages (author_id, dest_id, body) values ($1, $2, $3)', [ETU, LAU, 'Bonjour, une question sur le PFE']);
    assert.deepEqual(await qui('message'), ['LAU']);
    await db.query(`insert into public.applications (student_id, offer_id, entreprise, titre) values ($1, $2, 'Renault', 'PFE')`, [ETU, o]);
    assert.deepEqual(await qui('candidature'), ['LAU2']);
    // Dans la nuit : une offre est fermée, Hiba coupe « Nouvelles offres »
    await db.query(`update public.offers set status = 'fermee' where id = $1`, [o2]);
    await choisir(ETU2, { offres: false });
    assert.equal((await un('select public.liberer_nuit() n')).n, 0, 'la nuit, rien ne sort');
    assert.ok((await nuit()).length > 0);
    await reglerHorloge(db, aujourdhuiA(8, 0));
    await vider();
    const n = (await un('select public.liberer_nuit() n')).n;
    const matin = await file('offre_alerte');
    assert.equal(n, matin.length);
    assert.deepEqual(matin.map(x => x.qui).sort(), ['CIVIL', 'ETU', 'LAU'].sort(), 'Hiba a coupé « Nouvelles offres » : rien pour elle');
    assert.ok(matin.every(x => x.data.offre === o), 'l’offre fermée dans la nuit ne part pas');
    assert.deepEqual(await nuit(), [], 'tout est sorti');
    assert.equal((await un('select public.liberer_nuit() n')).n, 0, 'deuxième passage : rien');
  } finally { await reglerHorloge(db); await choisir(ETU2, {}); }
});

test('nuit : chaque envoi à beaucoup est gardé ; une relecture demandée à un relecteur choisi part tout de suite ; plus d’un jour : abandonné', async () => {
  await vider();
  const lignes = ['offre_alerte', 'annonce', 'evenement', 'evenement_annule', 'evenement_deplace', 'cafe', 'promo_nouveau', 'mentorat_ouvert',
    'question_routee', 'demande_nouvelle', 'demande_large', 'relecture_demande', 'verifier_pair', 'enquete'];
  const entre = ['message', 'match', 'match_interet', 'candidature', 'reponse', 'reponse_utile', 'bravo', 'mentorat_demande', 'rappel_rdv', 'rdv_demain'];
  try {
    await reglerHorloge(db, aujourdhuiA(1, 30));
    for (const k of [...lignes, ...entre]) await db.query(`insert into public.push_queue (user_id, kind, data) values ($1, $2, '{}')`, [LAU, k]);
    assert.deepEqual((await file()).map(x => x.kind).sort(), [...entre].sort(), 'entre personnes et engagements : tout de suite');
    assert.deepEqual((await nuit()).map(x => x.kind).sort(), [...lignes].sort(), 'envois à beaucoup : gardés');
    // Relecture : à un relecteur choisi, tout de suite ; ouverte à tous, le matin
    const [r] = (await db.query(`insert into public.relectures_cv (student_id, reviewer_id, cv_path) values ($1, $2, 'x/cv.pdf') returning id`, [ETU, LAU])).rows;
    assert.ok((await file('relecture_demande')).some(x => x.qui === 'LAU' && x.data.r === r.id), 'relecteur choisi : tout de suite');
    await db.query('delete from public.push_nuit');
    await db.query(`update public.profiles set mentor_dispo = true where id = $1`, [LAU2]);
    const [r2] = (await db.query(`insert into public.relectures_cv (student_id, cv_path) values ($1, 'x/cv.pdf') returning id`, [ETU2])).rows;
    assert.deepEqual((await nuit()).map(x => [x.qui, x.kind, x.data.r]), [['LAU2', 'relecture_demande', r2.id]], 'ouverte à tous : le matin');
    // Plus d'un jour d'attente (tâche du matin en panne) : abandonné
    await db.query(`update public.push_nuit set created_at = now() - interval '25 hours'`);
    await reglerHorloge(db, aujourdhuiA(8, 0));
    await vider();
    assert.equal((await un('select public.liberer_nuit() n')).n, 0);
    assert.deepEqual(await nuit(), []);
  } finally { await reglerHorloge(db); await vider(); }
});

test('demandes ouvertes à tous : rien la nuit (23:05) ; la fenêtre de 3 jours rattrape à 08:05', async () => {
  const d = await demande(ETU, 'PFE amélioration continue');
  await db.query(`update public.demandes set created_at = now() - interval '25 hours' where id = $1`, [d]);
  await vider();
  try {
    await reglerHorloge(db, aujourdhuiA(23, 5));
    assert.equal((await un('select public.demandes_larges_push() n')).n, 0, '23:05 : rien');
    assert.equal((await un('select public.demande_attente_push() n')).n, 0, '23:05 : rien non plus pour les lauréats du parcours');
    await reglerHorloge(db, aujourdhuiA(7, 5));
    assert.equal((await un('select public.demandes_larges_push() n')).n, 0, '07:05 : toujours rien');
    await reglerHorloge(db, aujourdhuiA(8, 5));
    assert.equal((await un('select public.demandes_larges_push() n')).n, 1);
    assert.deepEqual((await file('demande_large')).map(x => [x.qui, x.data.demande]), [['CIVIL', d]]);
    await reglerHorloge(db, aujourdhuiA(21, 5));
    assert.equal((await un('select public.demandes_larges_push() n')).n, 0, '21:05 : une seule fois');
  } finally { await reglerHorloge(db); await db.query('delete from public.demandes where id = $1', [d]); }
});

test('ordre avant chaque plafond : une nouvelle demande va aux 150 lauréats les plus proches puis les plus actifs', async () => {
  // 155 lauréats de la même filière (venus il y a 1 à 155 heures) et 5 du même parcours (venus à l'instant)
  const ids = [...Array(160).keys()].map(i => `00000000-0000-4000-9100-${String(i + 1).padStart(12, '0')}`);
  await db.query(`insert into auth.users (id, email) select id, right(id::text, 4) || '@exemple.ma' from unnest($1::uuid[]) id`, [ids]);
  await db.query(`insert into public.profiles (id, full_name, role, filiere, promo)
    select id, 'Lauréat ' || right(id::text, 3), 'laureat', case when right(id::text, 3)::int > 155 then $2 else $3 end, 1990 + right(id::text, 3)::int % 30
    from unnest($1::uuid[]) id`, [ids, GIEO, GI]);
  await db.query(`insert into public.visites (user_id, vu_at) select id, now() - case when right(id::text, 3)::int > 155 then interval '0' else right(id::text, 3)::int * interval '1 hour' end
    from unnest($1::uuid[]) id`, [ids]);
  await abonner(ids);
  await vider();
  const d = await demande(ETU2, 'PFE supply chain');
  const tous = (await file('demande_nouvelle')).map(x => x.qui);
  assert.equal(tous.length, 150, '150 au plus (avant : 60, au hasard)');
  assert.equal(new Set(tous).size, 150, 'une fois chacun');
  assert.ok(tous.includes('LAU') && tous.includes('LAU2'), 'même filière, inscrits à l’instant : dans les 150');
  assert.ok(!tous.includes('CIVIL'), 'hors du parcours : jamais');
  const recus = new Set(tous.filter(x => ids.includes(x)));
  assert.deepEqual(ids.filter(id => !recus.has(id)).map(id => Number(id.slice(-3))).sort((a, b) => a - b),
    [149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160],
    'laissés de côté : les 5 du parcours (moins proches, même venus à l’instant), puis ceux de la filière venus le moins récemment');
  // Un camarade à vérifier : les 5 camarades vérifiés les plus actifs (avant : les 5 premiers trouvés)
  const camarades = [...Array(7).keys()].map(i => uid(1150 + i));
  for (const [i, id] of camarades.entries()) await creerCompte(db, { id, full_name: `Camarade ${i}`, role: 'laureat', filiere: GI, promo: 2012 });
  await db.query(`update public.profiles set verified = true where id = any($1::uuid[])`, [camarades]);
  await db.query(`insert into public.visites (user_id, vu_at) select id, now() - n * interval '1 day' from unnest($1::uuid[]) with ordinality t(id, n)`, [camarades.slice().reverse()]);
  await abonner(camarades);
  await vider();
  await creerCompte(db, { id: uid(1160), full_name: 'Nouveau Camarade', role: 'laureat', filiere: GI, promo: 2012 });
  assert.deepEqual((await file('verifier_pair')).map(x => x.qui).sort(), camarades.slice(2).sort(), 'les 5 venus le plus récemment');
  await db.query('delete from public.demandes where id = $1', [d]);
  await db.query('delete from public.profiles where id = any($1::uuid[])', [[...ids, ...camarades, uid(1160)]]);
});

test('un id par élément : candidatures (offre, n), invitation, recrutement, relance', async () => {
  const o = await offre(LAU, 'PFE méthodes');
  await vider();
  const [a1] = (await db.query(`insert into public.applications (student_id, offer_id, entreprise, titre) values ($1, $2, 'Renault', 'PFE méthodes') returning id`, [ETU, o])).rows;
  await db.query(`insert into public.applications (student_id, offer_id, entreprise, titre) values ($1, $2, 'Renault', 'PFE méthodes')`, [ETU2, o]);
  const c = await file('candidature');
  assert.deepEqual(c.map(x => [x.qui, x.data.offre, x.data.n]), [['LAU', o, 1], ['LAU', o, 2]], 'n : les candidatures en attente sur cette offre');
  assert.equal(c[0].data.nom, 'Salma Bennani');
  await db.query(`update public.applications set status = 'entretien' where id = $1`, [a1.id]);
  assert.deepEqual((await file('candidature_statut')).map(x => [x.qui, x.data.offre, x.data.statut]), [['ETU', o, 'entretien']]);
  await db.query(`insert into public.invitations (laureat_id, student_id, offer_id) values ($1, $2, $3)`, [LAU, ETU3, o]);
  assert.deepEqual((await file('invitation')).map(x => [x.qui, x.data.offre, x.data.titre]), [['ETU3', o, 'PFE méthodes']]);
  const [p] = (await db.query(`insert into public.placements (student_id, offer_id, laureat_id, saison, niveau, type, entreprise, source, status)
    values ($1, $2, $3, $4, 5, 'pfe', 'Renault', 'plateforme', 'en_attente') returning id`, [ETU, o, LAU, S])).rows;
  assert.deepEqual((await file('recrutement_a_confirmer')).map(x => [x.qui, x.data.p]), [['ETU', p.id]]);
  await db.query(`update public.placements set status = 'confirme' where id = $1`, [p.id]);
  assert.deepEqual((await file('recrutement_confirme')).map(x => [x.qui, x.data.p]), [['LAU', p.id]]);
  await db.query(`update public.offers set created_at = now() - interval '30 days' where id = $1`, [o]);
  await db.query(`update public.applications set created_at = now() - interval '30 days' where offer_id = $1`, [o]);
  await db.query('select public.relances_offres()');
  assert.deepEqual((await file('relance_offre')).map(x => [x.qui, x.data.offre]), [['LAU', o]]);
});

test('un id par élément : réponses (q, n depuis la dernière visite), question routée (q), contacts (c), relectures (r), signalement, annonce', async () => {
  await vider();
  const [qu] = (await db.query(`insert into public.questions (author_id, categorie, titre) values ($1, 'stage', 'Comment trouver un PFE chez Renault ?') returning id`, [ETU])).rows;
  await db.query(`insert into public.visites (user_id, vu_at) values ($1, now() - interval '2 days') on conflict (user_id) do update set vu_at = excluded.vu_at`, [ETU]);
  const repondre = u => db.query(`insert into public.answers (question_id, author_id, body) values ($1, $2, 'Passe par le forum.')`, [qu.id, u]);
  await repondre(LAU); await repondre(LAU2); await repondre(ETU);
  assert.deepEqual((await file('reponse')).map(x => [x.qui, x.data.q, x.data.n]), [['ETU', qu.id, 1], ['ETU', qu.id, 2]], 'sa propre réponse ne compte pas');
  await db.query(`update public.visites set vu_at = now() where user_id = $1`, [ETU]);
  await vider();
  await repondre(CIVIL);
  assert.deepEqual((await file('reponse')).map(x => x.data.n), [1], 'depuis sa dernière visite');
  // Question routée vers les lauréats de Renault : la question
  const [q2] = (await db.query(`insert into public.questions (author_id, categorie, titre, entreprise) values ($1, 'stage', 'Un stage chez Renault Tanger ?', 'Renault') returning id`, [ETU2])).rows;
  assert.deepEqual((await file('question_routee')).map(x => [x.qui, x.data.q]), [['LAU', q2.id]]);
  // Contacts
  await vider();
  const [c] = (await db.query(`insert into public.demandes_contact (demandeur_id, cible_id) values ($1, $2) returning id`, [ETU3, LAU2])).rows;
  await db.query(`update public.demandes_contact set status = 'acceptee' where id = $1`, [c.id]);
  assert.deepEqual((await file()).filter(x => x.kind.startsWith('contact_')).map(x => [x.qui, x.kind, x.data.c]),
    [['LAU2', 'contact_demande', c.id], ['ETU3', 'contact_accepte', c.id]]);
  // Relectures : demandée, prise, rendue, merci
  await vider();
  const [r] = (await db.query(`insert into public.relectures_cv (student_id, reviewer_id, cv_path) values ($1, $2, 'x/cv.pdf') returning id`, [ETU3, LAU])).rows;
  await db.query(`update public.relectures_cv set status = 'en_cours' where id = $1`, [r.id]);
  await db.query(`update public.relectures_cv set status = 'rendue' where id = $1`, [r.id]);
  await db.query(`update public.relectures_cv set merci = 'Merci beaucoup !' where id = $1`, [r.id]);
  assert.deepEqual((await file()).map(x => [x.qui, x.kind, x.data.r]),
    [['LAU', 'relecture_demande', r.id], ['ETU3', 'relecture_prise', r.id], ['ETU3', 'relecture_rendue', r.id], ['LAU', 'merci', r.id]]);
  // Signalement (à l'administration), annonce (à son public)
  await vider();
  const [s] = (await db.query(`insert into public.signalements (auteur_id, cible_type, cible_id, motif) values ($1, 'offre', $2, 'spam') returning id`, [ETU, uid(9)])).rows;
  assert.deepEqual((await file('signalement')).map(x => [x.qui, x.data.id, x.data.motif]), [['ADMIN', s.id, 'spam']]);
  const [an] = (await db.query(`insert into public.annonces (author_id, texte, public) values ($1, 'Forum entreprises jeudi', 'laureats') returning id`, [ADMIN])).rows;
  assert.ok((await file('annonce')).every(x => x.data.id === an.id && x.data.texte === 'Forum entreprises jeudi'));
  assert.deepEqual(await qui('annonce'), ['CIVIL', 'LAU', 'LAU2']);
});

test('un id par élément : mentorat (m, de la demande au rappel), agenda (id), café (id), camarade à vérifier (de), aides proposées (n)', async () => {
  await vider();
  const creneau = new Date(Date.now() + 3 * 864e5).toISOString();
  const [m] = (await db.query(`insert into public.mentorships (student_id, mentor_id, sujet, creneaux) values ($1, $2, 'Préparer un entretien', $3) returning id`, [ETU, LAU, [creneau]])).rows;
  await db.query(`update public.mentorships set status = 'acceptee', rdv_at = $2 where id = $1`, [m.id, creneau]);
  await db.query(`update public.mentorships set rdv_at = $2 where id = $1`, [m.id, new Date(Date.now() + 4 * 864e5).toISOString()]);
  await db.query(`update public.mentorships set merci = 'Merci pour vos conseils' where id = $1`, [m.id]);
  assert.deepEqual((await file()).map(x => [x.qui, x.kind, x.data.m]),
    [['LAU', 'mentorat_demande', m.id], ['ETU', 'mentorat_accepte', m.id], ['ETU', 'mentorat_deplace', m.id], ['LAU', 'merci', m.id]]);
  // Le rappel 15 minutes avant : le même mentorat
  await vider();
  await db.query(`update public.mentorships set rdv_at = now() + interval '10 minutes' where id = $1`, [m.id]);
  await db.query('select public.rappels_rdv()');
  assert.deepEqual((await file('rappel_rdv')).map(x => [x.qui, x.data.m]).sort(), [['ETU', m.id], ['LAU', m.id]]);
  // Agenda : l'événement, son déplacement, son annulation
  await vider();
  const [e] = (await db.query(`insert into public.evenements (author_id, titre, type, debut, lieu) values ($1, 'Forum entreprises', 'forum', now() + interval '5 days', 'Amphi A') returning id`, [ADMIN])).rows;
  assert.ok((await file('evenement')).length >= 5 && (await file('evenement')).every(x => x.data.id === e.id));
  await db.query(`insert into public.evenement_participants (evenement_id, user_id) values ($1, $2)`, [e.id, ETU]);
  await vider();
  await db.query(`update public.evenements set debut = debut + interval '1 day' where id = $1`, [e.id]);
  await db.query(`update public.evenements set annule = true where id = $1`, [e.id]);
  assert.deepEqual((await file()).map(x => [x.qui, x.kind, x.data.id]), [['ETU', 'evenement_deplace', e.id], ['ETU', 'evenement_annule', e.id]]);
  // Café : son id
  await vider();
  const [c] = (await db.query(`insert into public.cafes (organisateur_id, ville, lieu, date_at) values ($1, 'Casablanca', 'Café de la gare', now() + interval '3 days') returning id`, [LAU2])).rows;
  assert.deepEqual((await file('cafe')).map(x => [x.qui, x.data.id]).sort(), [['ETU', c.id], ['LAU', c.id]]);
  // Camarade à vérifier : qui
  await db.query(`update public.profiles set verified = true where id = $1`, [LAU2]);
  await vider();
  await creerCompte(db, { id: uid(1170), full_name: 'Omar Promo', role: 'laureat', filiere: GI, promo: 2018 });
  assert.deepEqual((await file('verifier_pair')).map(x => [x.qui, x.data.de, x.data.nom]), [['LAU2', uid(1170), 'Omar Promo']]);
  // Aides proposées sur une demande : combien de lauréats proposent leur aide
  const d = await demande(ETU3, 'Stage qualité');
  await vider();
  const proposer = u => db.query(`insert into public.propositions (demande_id, laureat_id, aide, entreprise, message) values ($1, $2, 'recommande', 'OCP', 'Je peux te recommander.')`, [d, u]);
  await proposer(LAU); await proposer(LAU2);
  assert.deepEqual((await file('demande_proposition')).map(x => [x.qui, x.data.demande, x.data.n]), [['ETU3', d, 1], ['ETU3', d, 2]]);
});

test('sécurité : tables du serveur seulement, fonctions jamais appelables depuis le site', async () => {
  for (const t of ['notif_programme', 'push_nuit', 'match_jour_notif', 'match_attente_notif', 'veilles_envoyees', 'offres_bientot_notif',
    'demandes_attente_notif', 'demandes_pause_notif']) {
    const r = await un(`select c.relrowsecurity rls, (select count(*)::int from pg_policies p where p.schemaname = 'public' and p.tablename = $1) politiques
      from pg_class c where c.oid = ('public.' || $1)::regclass`, [t]);
    assert.deepEqual(r, { rls: true, politiques: 0 }, t);
    assert.deepEqual(await q(LAU, `select * from public.${t}`), [], `${t} : rien de lisible par un membre`);
  }
  for (const f of ['programme_place(null::uuid, null::text)', 'liberer_nuit()', 'match_jour_push()', 'match_attente_push()', 'rdv_demain_push()',
    'entretien_demain_push()', 'agenda_demain_push()', 'apres_rdv_push()', 'offres_bientot_push()', 'demande_attente_push()', 'demande_pause_push()',
    'semaine_push()', 'groupe_jour_push()', 'matin_push()', 'midi_push()', 'veille_push()', 'horloge()', 'heure_calme()',
    'programme_classe(null::text)', 'groupes_auto(null, null, null)', 'nom_groupe(null)']) {
    await assert.rejects(q(LAU, `select public.${f}`), /permission denied/, f);
    await assert.rejects(en(db, null, tx => tx.query(`select public.${f}`), { role: 'anon' }), /permission denied/, f + ' (anon)');
  }
  const definer = (await db.query(`select proname from pg_proc where pronamespace = 'public'::regnamespace and not prosecdef and proname = any($1)`,
    [['programme_place', 'liberer_nuit', 'push_nuit_filtre', 'match_jour_push', 'match_attente_push', 'rdv_demain_push', 'entretien_demain_push',
      'agenda_demain_push', 'apres_rdv_push', 'offres_bientot_push', 'demande_attente_push', 'demande_pause_push', 'semaine_push', 'groupe_jour_push',
      'matin_push', 'midi_push', 'veille_push', 'notif_vote', 'notif_meilleure_reponse', 'notif_bravo']])).rows;
  assert.deepEqual(definer, [], 'toutes en security definer');
});

test('tâches programmées : les cinq créneaux du contrat, dans un bloc pg_cron ; le rappel du soir ne lance plus le tour Match', async () => {
  const texte = fs.readFileSync(SCHEMA, 'utf8');
  for (const [nom, quand, fn] of [['ensam-matin', '0 8 * * *', 'matin_push'], ['ensam-offres-bientot', '0 9 * * *', 'offres_bientot_push'],
    ['ensam-midi', '30 12 * * *', 'midi_push'], ['ensam-veille', '30 19 * * *', 'veille_push'], ['ensam-semaine', '0 10 * * 0', 'semaine_push']]) {
    assert.ok(texte.includes(`perform cron.schedule('${nom}', '${quand}', 'select public.${fn}()');`), nom);
  }
  const soir = (await un(`select prosrc from pg_proc where proname = 'rappels_soir'`)).prosrc;
  assert.ok(!soir.includes('match_jour_push'), 'le tour Match part à midi');
  const midi = (await un(`select prosrc from pg_proc where proname = 'midi_push'`)).prosrc;
  assert.ok(midi.indexOf('match_attente_push') < midi.indexOf('match_jour_push'), 'les intérêts en attente avant le tour du jour');
  const horaire = (await un(`select prosrc from pg_proc where proname = 'alertes_horaires'`)).prosrc;
  assert.ok(horaire.includes('demandes_larges_push') && horaire.includes('demande_attente_push'));
  // Une partie en panne n'empêche pas les autres
  await db.query(`alter function public.rdv_demain_push() rename to rdv_demain_push_cache`);
  try {
    assert.equal((await un('select public.veille_push() n')).n, 0);
  } finally { await db.query(`alter function public.rdv_demain_push_cache() rename to rdv_demain_push`); }
});

test('mise à jour relancée deux fois : rien de perdu, un seul exemplaire de chaque déclencheur', async () => {
  await db.query(`insert into public.notif_programme (user_id, kind, at) values ($1, 'semaine', now())`, [ETU]);
  await db.query(`insert into public.push_nuit (user_id, kind, data) values ($1, 'annonce', '{"id": "x"}')`, [ETU]);
  await db.query(`insert into public.match_jour_notif (user_id, n, lundis, dernier_at) values ($1, 2, 1, now()) on conflict do nothing`, [ETU]);
  const sql = fs.readFileSync(SCHEMA, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, '');
  await db.exec(sql);
  await db.exec(sql);
  for (const t of ['notif_programme', 'push_nuit', 'match_jour_notif']) {
    assert.equal((await un(`select count(*)::int n from public.${t} where user_id = $1`, [ETU])).n, 1, t);
  }
  for (const t of ['trg_push_nuit', 'trg_push_filtre', 'trg_notif_vote', 'trg_notif_meilleure', 'trg_notif_bravo']) {
    assert.equal((await un('select count(*)::int n from pg_trigger where tgname = $1', [t])).n, 1, t);
  }
  const ordre = (await db.query(`select tgname from pg_trigger where tgrelid = 'public.push_queue'::regclass and not tgisinternal and tgtype & 2 = 2 order by tgname`)).rows.map(r => r.tgname);
  assert.deepEqual(ordre, ['trg_push_filtre', 'trg_push_nuit'], 'avant l’insertion : le filtre des catégories, puis la nuit');
  await db.exec('delete from public.push_nuit; delete from public.notif_programme; delete from public.match_jour_notif');
});
