// Les autres notifications programmées : l'offre mise de côté qui ferme (P5, 09:00), la demande toujours sans aide (P6,
// chaque heure de 8 h à 21 h), la demande en pause (P11b, 08:00), le résumé du dimanche (P7, 10:00) et le ménage du matin.
// Chaque fois : le cas qui part, chaque exclusion, deuxième passage = rien.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, creerCompte, uid, reglerHorloge, aujourdhuiA } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const GI = 'Génie Industriel et Productique', GIEO = 'Génie Industriel : Excellence Opérationnelle', GC = 'Génie Civil';
const ETU = uid(1401), ETU2 = uid(1402), ETU3A = uid(1403), ETU4 = uid(1404), LAU = uid(1405), LAU2 = uid(1406), CIVIL = uid(1407), ADMIN = uid(1408);
const NOMS = { [ETU]: 'ETU', [ETU2]: 'ETU2', [ETU3A]: 'ETU3A', [ETU4]: 'ETU4', [LAU]: 'LAU', [LAU2]: 'LAU2', [CIVIL]: 'CIVIL', [ADMIN]: 'ADMIN' };
const J = k => aujourdhuiA(0, 0, k).slice(0, 10);   // la date (UTC) dans k jours

const un = async (sql, p) => (await db.query(sql, p)).rows[0];
const vider = () => db.query('delete from public.push_queue');
const file = async kind => (await db.query('select user_id, data from public.push_queue where kind = $1 order by id', [kind])).rows
  .map(r => ({ qui: NOMS[r.user_id] || r.user_id, data: r.data }));
const lancer = async f => { await vider(); return (await un(`select public.${f}() n`)).n; };
const nouveauJour = () => db.query('delete from public.notif_programme');
const offre = async (auteur, titre, champs = {}) => (await un(`insert into public.offers (author_id, type, titre, entreprise, description, annees, filieres, deadline, origine, lien)
  values ($1, 'pfe', $2, $3, 'Une vraie mission.', $4, $5, $6, $7, $8) returning id`,
  [auteur, titre, champs.entreprise || 'Renault', champs.annees || '{5}', champs.filieres || '{}', champs.deadline || null, champs.origine || null, champs.lien || null])).id;
const garder = (u, o) => db.query(`insert into public.reactions (offer_id, user_id, kind) values ($1, $2, 'save')`, [o, u]);
const demande = async (u, titre, ilYa = '0 seconds') => {
  const { id } = await un(`insert into public.demandes (auteur_id, type, titre, details, lieu) values ($1, 'pfe', $2,
    'Lean, VSM et Power BI : je cherche un PFE en usine, de février à juin.', 'Casablanca') returning id`, [u, titre]);
  await db.query(`update public.demandes set created_at = now() - $2::interval, relancee_at = now() - $2::interval where id = $1`, [id, ilYa]);
  return id;
};

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ETU, full_name: 'Salma Bennani', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: ETU2, full_name: 'Hiba Alaoui', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: ETU3A, full_name: 'Rayan Fassi', role: 'etudiant', filiere: GI, promo: S + 3 });
  await creerCompte(db, { id: ETU4, full_name: 'Omar Idrissi', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: LAU, full_name: 'Youssef Amrani', role: 'laureat', filiere: GI, promo: 2015, entreprise: 'Renault' });
  await creerCompte(db, { id: LAU2, full_name: 'Karim Tazi', role: 'laureat', filiere: GIEO, promo: 2018, entreprise: 'OCP' });
  await creerCompte(db, { id: CIVIL, full_name: 'Nadia Civil', role: 'laureat', filiere: GC, promo: 2016 });
  await creerCompte(db, { id: ADMIN, full_name: 'Admin École', role: 'etudiant', filiere: GI, promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  await db.query(`update public.profiles set created_at = now() - interval '30 days'`);
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://push.example/' || id, 'k', 'a' from public.profiles`);
  await reglerHorloge(db, aujourdhuiA(9, 0));
});

test('P5 offre mise de côté qui ferme dans 2 jours : une notification ; candidature, fermée, la sienne, pas pour son année, à J+3 : rien ; deuxième passage : rien', async () => {
  const o = await offre(LAU, 'PFE méthodes', { deadline: J(2) });
  await garder(ETU, o); await garder(LAU, o);
  const postulee = await offre(LAU, 'PFE qualité', { deadline: J(2) });
  await garder(ETU2, postulee);
  await db.query(`insert into public.applications (student_id, offer_id, entreprise, titre) values ($1, $2, 'Renault', 'PFE qualité')`, [ETU2, postulee]);
  const fermee = await offre(LAU, 'PFE déjà pourvu', { deadline: J(2) });
  await garder(ETU, fermee);
  await db.query(`update public.offers set status = 'pourvue' where id = $1`, [fermee]);
  const cinqA = await offre(LAU2, 'PFE supply chain', { deadline: J(2) });
  await garder(ETU3A, cinqA);
  const plusTard = await offre(LAU, 'PFE dans 3 jours', { deadline: J(3) });
  await garder(ETU, plusTard);
  assert.equal(await lancer('offres_bientot_push'), 1);
  assert.deepEqual((await file('offre_bientot')).map(x => [x.qui, x.data]),
    [['ETU', { titre: 'PFE méthodes', entreprise: 'Renault', date_limite: J(2), offre: o, jours: 2 }]],
    'ni Hiba (déjà candidate), ni la fermée, ni Youssef (son offre), ni Rayan (3A : pas pour son année), ni J+3');
  assert.equal(await lancer('offres_bientot_push'), 0, 'deuxième passage : rien');
  await nouveauJour();
  assert.equal(await lancer('offres_bientot_push'), 0, 'le lendemain non plus : une fois par offre');
});

test('P5 rattrapage à J+1 ; un partage sans date limite ferme 45 jours après sa publication ; deux offres : deux lignes ; trois : une seule, groupée', async () => {
  await nouveauJour();
  const demain = await offre(LAU, 'PFE maintenance', { deadline: J(1) });
  await garder(ETU2, demain);
  const partage = await offre(LAU2, 'PFE vu sur LinkedIn', { origine: 'partagee', lien: 'https://linkedin.example/pfe-7' });
  await db.query(`update public.offers set created_at = now() - interval '43 days' where id = $1`, [partage]);
  await garder(ETU2, partage);
  const trois = [];
  for (const [t, k] of [['PFE énergie', 1], ['PFE logistique', 2], ['PFE achats', 2]]) { const id = await offre(LAU, t, { deadline: J(k) }); await garder(ETU4, id); trois.push(id); }
  assert.equal(await lancer('offres_bientot_push'), 3);
  const f = await file('offre_bientot');
  assert.deepEqual(f.filter(x => x.qui === 'ETU2').map(x => [x.data.titre, x.data.jours, x.data.date_limite]).sort(),
    [['PFE maintenance', 1, J(1)], ['PFE vu sur LinkedIn', 2, J(2)]], 'Hiba : deux offres, deux lignes (le partage de 43 jours ferme dans 2 jours)');
  assert.deepEqual(f.filter(x => x.qui === 'ETU4').map(x => x.data), [{ n: 3, groupe: true }], 'Omar : trois offres, une seule notification');
  await nouveauJour();
  assert.equal(await lancer('offres_bientot_push'), 0, 'les trois sont notées');
  // Catégorie « Nouvelles offres » coupée : rien
  const coupee = await offre(LAU, 'PFE production', { deadline: J(2) });
  await garder(ETU, coupee);
  await db.query(`update public.profiles set notif_push = '{"offres": false}' where id = $1`, [ETU]);
  await nouveauJour();
  assert.equal(await lancer('offres_bientot_push'), 0);
  await db.query(`update public.profiles set notif_push = '{}' where id = $1`, [ETU]);
});

test('P6 demande sans aide depuis 25 h : les lauréats de son parcours, une fois ; la nuit, trop tôt, trop tard ou déjà aidée : rien', async () => {
  await nouveauJour();
  const d = await demande(ETU, 'PFE amélioration continue', '25 hours');
  const aidee = await demande(ETU2, 'PFE supply chain', '26 hours');
  await db.query(`insert into public.propositions (demande_id, laureat_id, aide, entreprise, message) values ($1, $2, 'recommande', 'OCP', 'Je peux te recommander chez OCP.')`, [aidee, LAU2]);
  await demande(ETU4, 'PFE trop récent', '23 hours');
  await demande(ETU3A, 'Stage trop ancien', '73 hours');
  try {
    await reglerHorloge(db, aujourdhuiA(23, 5));
    assert.equal(await lancer('demande_attente_push'), 0, '23:05 : rien');
    await reglerHorloge(db, aujourdhuiA(7, 5));
    assert.equal(await lancer('demande_attente_push'), 0, '07:05 : rien');
    await reglerHorloge(db, aujourdhuiA(8, 5));
    assert.equal(await lancer('demande_attente_push'), 2);
    assert.deepEqual((await file('demande_attente')).map(x => [x.qui, x.data]).sort((a, b) => a[0].localeCompare(b[0])), [
      ['LAU', { nom: 'Salma', type: 'pfe', titre: 'PFE amélioration continue', demande: d }],
      ['LAU2', { nom: 'Salma', type: 'pfe', titre: 'PFE amélioration continue', demande: d }]], 'son parcours seulement (pas Nadia, en Génie Civil)');
    assert.equal(await lancer('demande_attente_push'), 0, 'deuxième passage : rien');
    // Le même jour, une autre demande : chacun a déjà la sienne aujourd'hui (une par jour et par lauréat) ; elle est
    // vue une fois (une fois par demande), et reste dans le rappel du soir et la liste des demandes
    await db.query(`update public.demandes set created_at = now() - interval '25 hours' where titre = 'PFE trop récent'`);
    assert.equal(await lancer('demande_attente_push'), 0, 'une par jour et par lauréat');
    await nouveauJour();
    assert.equal(await lancer('demande_attente_push'), 0, 'une fois par demande');
  } finally { await reglerHorloge(db, aujourdhuiA(9, 0)); }
});

test('P6 150 lauréats au plus : d’abord ceux que l’annonce de la demande n’a pas atteints, puis les plus actifs', async () => {
  await nouveauJour();
  const ids = [...Array(152).keys()].map(i => `00000000-0000-4000-9200-${String(i + 1).padStart(12, '0')}`);
  await db.query(`insert into auth.users (id, email) select id, right(id::text, 4) || '@exemple.ma' from unnest($1::uuid[]) id`, [ids]);
  await db.query(`insert into public.profiles (id, full_name, role, filiere, promo, created_at) select id, 'Lauréat ' || right(id::text, 3), 'laureat', $2, 2000, now() - interval '30 days' from unnest($1::uuid[]) id`, [ids, GI]);
  await db.query(`insert into public.visites (user_id, vu_at) select id, now() - right(id::text, 3)::int * interval '1 hour' from unnest($1::uuid[]) id`, [ids]);
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://push.example/' || id, 'k', 'a' from unnest($1::uuid[]) id`, [ids]);
  const d = await demande(ETU4, 'PFE excellence opérationnelle', '25 hours');
  // L'annonce de la demande est arrivée chez les 5 plus actifs (journal du notifier)
  await db.query(`insert into public.push_journal (user_id, kind, code, at) select id, 'demande_nouvelle', 201, now() - interval '25 hours' + interval '1 minute'
    from unnest($1::uuid[]) id`, [ids.slice(0, 5)]);
  await lancer('demande_attente_push');
  const lignes = (await file('demande_attente')).filter(x => x.data.demande === d);
  assert.equal(lignes.length, 150, '150 au plus');
  const recus = new Set(lignes.map(x => x.qui));
  assert.ok(recus.has('LAU') && recus.has('LAU2'));
  assert.deepEqual(ids.filter(id => !recus.has(id)).map(id => Number(id.slice(-3))), [2, 3, 4, 5],
    'laissés de côté : ceux que l’annonce a atteints (le plus actif d’entre eux passe encore, 150e)');
  await db.query('delete from public.demandes where id = $1', [d]);
  await db.query('delete from public.profiles where id = any($1::uuid[])', [ids]);
});

test('P6 une demande publiée la nuit : son annonce part à 08:00 (push_nuit) ; ceux qu’elle n’a pas atteints passent d’abord, comme le jour', async () => {
  await nouveauJour();
  const ids = [...Array(152).keys()].map(i => `00000000-0000-4000-9300-${String(i + 1).padStart(12, '0')}`);
  await db.query(`insert into auth.users (id, email) select id, right(id::text, 4) || '@exemple.ma' from unnest($1::uuid[]) id`, [ids]);
  await db.query(`insert into public.profiles (id, full_name, role, filiere, promo, created_at) select id, 'Lauréat ' || right(id::text, 3), 'laureat', $2, 2000, now() - interval '30 days' from unnest($1::uuid[]) id`, [ids, GI]);
  await db.query(`insert into public.visites (user_id, vu_at) select id, now() - right(id::text, 3)::int * interval '1 hour' from unnest($1::uuid[]) id`, [ids]);
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://push.example/' || id, 'k', 'a' from unnest($1::uuid[]) id`, [ids]);
  // Publiée à 23:00 il y a deux jours : son annonce (demande_nouvelle) a attendu 08:00 dans push_nuit (liberer_nuit) ;
  // le notifier l'a notée au journal à 08:01, chez les 5 plus actifs
  const d = await demande(ETU4, 'PFE publié le soir');
  const soir = aujourdhuiA(23, 0, -2), matin = aujourdhuiA(8, 1, -1);
  await db.query(`update public.demandes set created_at = $2, relancee_at = $2 where id = $1`, [d, soir]);
  await db.query(`insert into public.push_journal (user_id, kind, code, at) select id, 'demande_nouvelle', 201, $2 from unnest($1::uuid[]) id`, [ids.slice(0, 5), matin]);
  try {
    await reglerHorloge(db, aujourdhuiA(10, 5));
    await lancer('demande_attente_push');
    const recus = new Set((await file('demande_attente')).filter(x => x.data.demande === d).map(x => x.qui));
    assert.equal(recus.size, 150, '150 au plus');
    assert.deepEqual(ids.filter(id => !recus.has(id)).map(id => Number(id.slice(-3))), [2, 3, 4, 5],
      'laissés de côté : ceux que l’annonce du matin a atteints, pas les moins actifs (149 à 152, jamais prévenus)');
  } finally {
    await reglerHorloge(db, aujourdhuiA(9, 0));
    await db.query('delete from public.demandes where id = $1', [d]);
    await db.query('delete from public.profiles where id = any($1::uuid[])', [ids]);
  }
});

test('P11b demande en pause depuis 60 jours : son auteur, une fois par pause ; relancée puis de nouveau en pause : de nouveau', async () => {
  await nouveauJour();
  const d = await demande(ETU3A, 'Stage ouvrier en usine', '61 days');
  await demande(ETU2, 'Stage pas encore en pause', '59 days');
  await demande(ETU4, 'Stage en pause depuis longtemps', '70 days');
  const fermee = await demande(ETU, 'Stage déjà trouvé', '61 days');
  await db.query(`update public.demandes set status = 'fermee' where id = $1`, [fermee]);
  assert.equal(await lancer('demande_pause_push'), 1);
  assert.deepEqual((await file('demande_pause')).map(x => [x.qui, x.data]), [['ETU3A', { titre: 'Stage ouvrier en usine', demande: d }]]);
  assert.equal(await lancer('demande_pause_push'), 0, 'deuxième passage : rien');
  await nouveauJour();
  assert.equal(await lancer('demande_pause_push'), 0, 'le lendemain non plus : une fois par pause');
  // Relancée il y a 62 jours (une nouvelle pause) : de nouveau
  await db.query(`update public.demandes set relancee_at = now() - interval '62 days' where id = $1`, [d]);
  await nouveauJour();
  assert.equal(await lancer('demande_pause_push'), 1);
  // Par le matin (matin_push) : la même chose, une fois
  await db.query(`update public.demandes set relancee_at = now() - interval '61 days' where id = $1`, [d]);
  await nouveauJour();
  await vider();
  assert.equal((await un('select public.matin_push() n')).n, 1);
  assert.deepEqual((await file('demande_pause')).map(x => x.qui), ['ETU3A']);
});

test('matin_push : le ménage (budget de plus de 8 jours, veilles et intérêts de plus de 30 jours, offres de plus de 60 jours)', async () => {
  await db.query(`insert into public.notif_programme (user_id, kind, at) values ($1, 'semaine', public.horloge() - interval '9 days'), ($1, 'semaine', public.horloge() - interval '7 days')`, [ETU]);
  await db.query(`insert into public.veilles_envoyees (quoi, id, rdv_at, created_at) values ('rdv', gen_random_uuid(), now(), now() - interval '31 days'), ('agenda', gen_random_uuid(), now(), now() - interval '29 days')`);
  const o = await offre(LAU, 'PFE ancien');
  await db.query(`insert into public.offres_bientot_notif (user_id, offer_id, at) values ($1, $3, now() - interval '61 days'), ($2, $3, now() - interval '59 days')`, [ETU, ETU2, o]);
  await db.query('select public.matin_push()');
  assert.equal((await un(`select count(*)::int n from public.notif_programme where user_id = $1 and kind = 'semaine'`, [ETU])).n, 1);
  assert.deepEqual((await db.query('select quoi from public.veilles_envoyees order by quoi')).rows.map(r => r.quoi), ['agenda']);
  assert.deepEqual((await db.query('select user_id from public.offres_bientot_notif where offer_id = $1', [o])).rows.map(r => NOMS[r.user_id]), ['ETU2']);
  await db.query('delete from public.notif_programme');
});

test('P7 le dimanche : les vrais comptes des 7 derniers jours, 3 au plus, dans l’ordre ; tout à zéro, un rappel du soir la veille, l’administration : rien', async () => {
  await nouveauJour();
  // Ce qui précède date d'il y a plus d'une semaine
  await db.exec(`update public.offers set created_at = now() - interval '10 days'; update public.demandes set created_at = now() - interval '10 days', relancee_at = now() - interval '10 days';`);
  const o1 = await offre(LAU, 'PFE pour la filière GI', { filieres: `{${GI}}` });
  await offre(LAU2, 'PFE pour le parcours', { filieres: `{${GI},${GIEO}}` });
  await demande(ETU, 'PFE amélioration continue (bis)');
  await creerCompte(db, { id: uid(1420), full_name: 'Nouveau Lauréat', role: 'laureat', filiere: GI, promo: 2019 });
  await creerCompte(db, { id: uid(1421), full_name: 'Nouvelle Étudiante', role: 'etudiant', filiere: GI, promo: S + 1 });
  await db.query(`insert into public.evenements (author_id, titre, type, debut, lieu, public) values ($1, 'Forum entreprises', 'forum', now() + interval '5 days', 'Amphi A', 'etudiants')`, [ADMIN]);
  await db.query(`insert into public.evenements (author_id, titre, type, debut, lieu) values ($1, 'Forum passé', 'forum', now() - interval '1 day', 'Amphi B')`, [ADMIN]);
  // Hiba a reçu son rappel du soir hier
  await db.query(`insert into public.rappels_visite (user_id, n, dernier_at, push_at) values ($1, 1, now() - interval '16 hours', now() - interval '16 hours')`, [ETU2]);
  await reglerHorloge(db, aujourdhuiA(10, 0));
  try {
    assert.ok((await lancer('semaine_push')) >= 1);
    const f = Object.fromEntries((await file('semaine')).map(x => [x.qui, x.data]));
    assert.deepEqual(f.ETU, { type: 'etudiant', offres: 2, laureats: 1, promo: 1 }, 'Salma : 3 au plus (l’événement de la semaine n’est pas dit)');
    assert.deepEqual(f.ETU3A, { type: 'etudiant', laureats: 1, evenements: 1 }, 'Rayan (3A) : pas les offres de 5A');
    assert.deepEqual(f.LAU, { type: 'laureat', demandes: 1, offres: 1 }, 'Youssef : la demande de Salma, l’offre de Karim (pas la sienne)');
    assert.deepEqual(f.LAU2, { type: 'laureat', demandes: 1 }, 'Karim : un seul compte, une seule phrase');
    assert.equal(f.CIVIL, undefined, 'Nadia : tout à zéro, rien');
    assert.equal(f.ETU2, undefined, 'Hiba : rappel du soir hier');
    assert.equal(f.ADMIN, undefined);
    assert.ok(Object.values(f).every(d => Object.entries(d).every(([k, v]) => k === 'type' || (Number.isInteger(v) && v > 0))), 'jamais un zéro');
    assert.equal(await lancer('semaine_push'), 0, 'une fois par semaine');
    assert.ok(o1);
  } finally { await reglerHorloge(db, aujourdhuiA(9, 0)); }
});

test('P7 lauréat : « N nouvelles demandes d’étudiants de ton parcours » ne compte que son parcours, pas une demande d’ailleurs ouverte à tous', async () => {
  await nouveauJour();
  // Une étudiante de Génie Civil publie il y a 2 jours, sans aide : ouverte à tous les lauréats depuis 24 h (demande_pour)
  const AUTRE = uid(1430);
  NOMS[AUTRE] = 'CIVILE';
  await creerCompte(db, { id: AUTRE, full_name: 'Imane Civile', role: 'etudiant', filiere: GC, promo: S + 1 });
  const d = await demande(AUTRE, 'Stage chantier en été', '2 days');
  await reglerHorloge(db, aujourdhuiA(10, 0));
  try {
    const youssef = await un(`select public.demande_pour(d, p) ok from public.demandes d, public.profiles p where d.id = $1 and p.id = $2`, [d, LAU]);
    assert.equal(youssef.ok, true, 'Youssef peut l’aider (ouverte à tous)');
    await lancer('semaine_push');
    const f = Object.fromEntries((await file('semaine')).map(x => [x.qui, x.data]));
    assert.deepEqual([f.LAU?.demandes, f.LAU2?.demandes], [1, 1], 'Youssef et Karim : la seule demande de leur parcours (Salma)');
    assert.equal(f.CIVIL?.demandes, 1, 'Nadia (Génie Civil) : celle d’Imane, de son parcours');
  } finally {
    await reglerHorloge(db, aujourdhuiA(9, 0));
    await db.query('delete from public.demandes where id = $1', [d]);
  }
});
