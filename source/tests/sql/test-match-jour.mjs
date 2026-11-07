// Match à midi : le tour du jour (P1, match_jour) et l'intérêt qui attend une réponse (P2, match_attente).
// P1 : seulement à qui a de vraies cartes (jamais plus que deckMatch sur les mêmes données), dont une arrivée depuis le
// dernier envoi ; pas le jour d'un choix ; chaque jour pour qui a joué ces 14 derniers jours, sinon le lundi ; 3 envois
// sans choix : le lundi seulement ; 4 lundis sans choix : plus rien jusqu'au prochain choix.
// P2 : un « Intéressé » donné il y a 20 h à 7 jours, sans réponse, sans match, sans blocage, rappelé une fois ; tous les
// intérêts d'une personne en une notification ; rien si l'intérêt vient de lui être notifié.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, creerCompte, uid, reglerHorloge, aujourdhuiA } from './banc-sql.mjs';
import { deckMatch } from '../../src/logic.js';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const GI = 'Génie Industriel et Productique', GIEO = 'Génie Industriel : Excellence Opérationnelle', GC = 'Génie Civil';
const PREPA = 'Classes préparatoires intégrées';
// Le calendrier de la base : un jour de semaine qui n'est pas un lundi, le lundi qui vient, aujourd'hui (12:30, l'heure du tour)
const DOW = new Date().getUTCDay();
const NON_LUNDI = aujourdhuiA(12, 30, DOW === 1 ? 1 : 0), LUNDI = aujourdhuiA(12, 30, (8 - DOW) % 7), AUJOURDHUI = aujourdhuiA(12, 30);
const NON_LUNDI_9H = aujourdhuiA(9, 0, DOW === 1 ? 1 : 0);

const E4 = uid(1201), E5 = uid(1202), E6 = uid(1203), L1 = uid(1211), L2 = uid(1212), L3 = uid(1213), LR = uid(1214), ADM = uid(1215);
const N = [...Array(7).keys()].map(i => uid(1221 + i));
const SP = [...Array(11).keys()].map(i => uid(1241 + i));
const NOMS = { [E4]: 'E4', [E5]: 'E5', [E6]: 'E6', [L1]: 'L1', [L2]: 'L2', [L3]: 'L3', [LR]: 'LR', [ADM]: 'ADM',
  ...Object.fromEntries(N.map((id, i) => [id, 'N' + (i + 1)])), ...Object.fromEntries(SP.map((id, i) => [id, 'S' + (i + 1)])) };
const O = {};

const un = async (sql, p) => (await db.query(sql, p)).rows[0];
const vider = () => db.query('delete from public.push_queue');
const file = async kind => (await db.query('select user_id, data from public.push_queue where kind = $1 order by id', [kind])).rows
  .map(r => ({ id: r.user_id, qui: NOMS[r.user_id] || r.user_id, data: r.data }));
const offre = async (auteur, titre, annees = '{4}', champs = {}) => (await un(`insert into public.offers (author_id, type, titre, entreprise, description, annees, filieres, origine, lien)
  values ($1, $2, $3, 'Renault', 'Une vraie mission.', $4, $5, $6, $7) returning id`,
  [auteur, champs.type || 'stage', titre, annees, champs.filieres || '{}', champs.origine || null, champs.lien || null])).id;
// Un choix dans Match, posé il y a « ilYa » (ou à une heure précise)
const choix = (u, { profil, offre: o }, c = 'oui', ilYa = '0 seconds', a = null) => {
  const col = o ? 'cible_offre' : 'cible_profil';
  return db.query(`insert into public.match_choix (user_id, ${col}, choix, updated_at) values ($1, $2, $3, coalesce($5::timestamptz, now() - $4::interval))
    on conflict (user_id, ${col}) do update set choix = excluded.choix, updated_at = excluded.updated_at`, [u, o || profil, c, ilYa, a]);
};
// Le temps passe de k jours : tout ce qui est daté recule ; le budget du jour et la file repartent de zéro
const jour = (k = 1) => db.exec(`
  update public.match_jour_notif set dernier_at = dernier_at - interval '${k} days';
  update public.match_choix set updated_at = updated_at - interval '${k} days', created_at = created_at - interval '${k} days';
  update public.offers set created_at = created_at - interval '${k} days';
  update public.profiles set created_at = created_at - interval '${k} days';
  update public.visites set vu_at = vu_at - interval '${k} days';
  update public.matchs set created_at = created_at - interval '${k} days';
  delete from public.notif_programme;
  delete from public.push_queue;`);

// La pile que Match montrerait à ce membre (deckMatch de src/logic.js), sur les données de la base
const pile = async u => {
  const t = async sql => (await db.query(sql)).rows;
  const data = {
    profiles: await t('select id, role, filiere, promo, match_visible, created_at, visibilite, cv_path, entreprise from public.profiles'),
    offers: await t('select id, author_id, status, audience, annees, filieres, deadline::text as deadline, origine, created_at, type from public.offers'),
    match_choix: await t('select user_id, cible_profil, cible_offre, choix, updated_at from public.match_choix'),
    matchs: await t('select etudiant_id, laureat_id, offre_id, created_at from public.matchs'),
    applications: await t('select student_id, offer_id, status from public.applications'),
    blocages: await t('select user_id, bloque_id from public.blocages'),
    demandes: await t('select auteur_id, status, type from public.demandes'),
  };
  return deckMatch(data, data.profiles.find(p => p.id === u), Date.now(), S);
};
// Le tour du jour : chaque notification partie annonce au plus ce que deckMatch montrerait (et au plus 5)
const tour = async () => {
  await vider();
  const n = (await un('select public.match_jour_push() n')).n;
  const f = await file('match_jour');
  assert.equal(f.length, n);
  for (const x of f) {
    const deck = await pile(x.id);
    assert.ok(Number.isInteger(x.data.n) && x.data.n >= 1 && x.data.n <= Math.min(5, deck.length), `${x.qui} : ${x.data.n} carte(s) annoncée(s), ${deck.length} dans deckMatch`);
  }
  return f.map(x => [x.qui, x.data]);
};
const pour = async u => (await tour()).filter(([q]) => q === NOMS[u]);
const etat = u => un('select n, lundis from public.match_jour_notif where user_id = $1', [u]);
const attente = async () => { await vider(); return (await un('select public.match_attente_push() n')).n; };
const abonner = ids => db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://push.example/' || id, 'k', 'a' from unnest($1::uuid[]) id on conflict do nothing`, [ids]);

before(async () => {
  db = await nouvelleBase(SCHEMA);
  const etu = (id, full_name, promo, filiere = GI) => creerCompte(db, { id, full_name, role: 'etudiant', filiere, promo });
  await etu(E4, 'Imane Kettani', S + 2); await etu(E5, 'Salma Bennani', S + 1); await etu(E6, 'Hiba Alaoui', S + 1);
  await creerCompte(db, { id: L1, full_name: 'Youssef Amrani', role: 'laureat', filiere: GI, promo: 2015, entreprise: 'Renault' });
  await creerCompte(db, { id: L2, full_name: 'Karim Tazi', role: 'laureat', filiere: GI, promo: 2018, entreprise: 'OCP' });
  await creerCompte(db, { id: L3, full_name: 'Nadia Civil', role: 'laureat', filiere: GC, promo: 2016, entreprise: 'Vinci' });
  await creerCompte(db, { id: LR, full_name: 'Omar Methodes', role: 'laureat', filiere: GI, promo: 2012, entreprise: 'Lear' });
  await creerCompte(db, { id: ADM, full_name: 'Admin École', role: 'etudiant', filiere: GI, promo: 2010 });
  const noms = ['Amine Tazi', 'Omar Idrissi', 'Nora Bennis', 'Rayan Fassi', 'Lina Chraibi', 'Adam Berrada', 'Yasmine Cherkaoui', 'Sara Lahlou', 'Ilyas Naciri', 'Meryem Ziani', 'Anas Kabbaj'];
  for (const [i, id] of SP.entries()) await etu(id, noms[i], S + 1);
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADM]);
  // Karim montre son entreprise aux lauréats seulement
  await db.query(`update public.profiles set visibilite = '{"travail":"laureats"}' where id = $1`, [L2]);
  await db.query(`update public.profiles set created_at = now() - interval '30 days'`);
  await db.query(`update public.app_secrets set valeur = (now() - interval '60 days')::text where cle = 'rappels_depuis'`);
  // Les offres : 3 pour la 4A de lauréats GI ; une de plus que l'étudiante a vue (« Plus tard », il y a 2 jours) ;
  // pour la 5A ; pour la 4A en Génie Civil seulement ; un partage d'étudiant (pas dans Match)
  O.qualite = await offre(L1, 'Stage 4A qualité');
  O.methodes = await offre(L1, 'Stage 4A méthodes');
  O.supply = await offre(L2, 'Stage 4A supply chain');
  O.vu = await offre(L1, 'Stage 4A déjà vu');
  O.pfe5 = await offre(L1, 'PFE 5A Lean', '{5}', { type: 'pfe' });
  O.pfe5b = await offre(L2, 'PFE 5A supply', '{5}', { type: 'pfe' });
  O.chantier = await offre(L3, 'Stage 4A chantier', '{4}', { filieres: `{${GC}}` });
  O.partage = await offre(E5, 'Stage vu sur LinkedIn', '{4}', { origine: 'partagee', lien: 'https://linkedin.example/stage-4a' });
  await db.query(`update public.offers set created_at = now() - interval '3 days'`);
  await choix(E4, { offre: O.vu }, 'plus_tard', '2 days');
  // Téléphones abonnés : tous, sauf les étudiants des tests de P2 (abonnés au début de ces tests)
  await abonner((await db.query('select id from public.profiles where id <> all($1::uuid[])', [SP])).rows.map(r => r.id));
  await vider();
});

test('P1 étudiante de 4A : 3 offres de lauréats pour son année (ni la 5A, ni une autre filière, ni un partage d’étudiant, ni une carte déjà vue) → n = 3, le compte de deckMatch', async () => {
  await reglerHorloge(db, NON_LUNDI);
  try {
    assert.deepEqual(await tour(), [['E4', { n: 3, type: 'etudiant' }]], 'Imane seule : les autres n’ont pas joué ces 14 derniers jours (le lundi seulement)');
    assert.equal((await pile(E4)).filter(c => c.sorte === 'offre').length, 3, 'deckMatch lui montre les mêmes 3 offres');
    assert.deepEqual(await etat(E4), { n: 1, lundis: 0 });
  } finally { await reglerHorloge(db); }
});

test('P1 deuxième appel le même jour : rien ; un choix ce jour-là : rien ; l’administration : jamais', async () => {
  await reglerHorloge(db, NON_LUNDI);
  try {
    assert.deepEqual(await tour(), [], 'deuxième appel : rien (au plus un par jour)');
    // Hiba (5A) dit « Plus tard » à une offre ce jour-là : pas de tour ce jour-là
    await choix(E6, { offre: O.pfe5 }, 'plus_tard', null, NON_LUNDI_9H);
    assert.deepEqual(await tour(), [], 'le jour d’un choix dans Match : rien');
    // Son choix date de la veille : elle a joué, une carte l'attend
    await db.query(`update public.match_choix set updated_at = updated_at - interval '1 day' where user_id = $1`, [E6]);
    assert.deepEqual(await tour(), [['E6', { n: 1, type: 'etudiant' }]]);
    assert.deepEqual(await pile(ADM), [], 'l’administration n’a pas de pile');
  } finally { await reglerHorloge(db); }
});

test('P1 sans avoir joué ces 14 derniers jours : le lundi seulement', async () => {
  await reglerHorloge(db, LUNDI);
  try {
    assert.deepEqual(await tour(), [['E5', { n: 2, type: 'etudiant' }]], 'Salma n’a jamais joué : le lundi, ses 2 offres de 5A');
    assert.deepEqual(await etat(E5), { n: 1, lundis: 1 });
  } finally { await reglerHorloge(db); }
});

test('P1 une carte neuve à chaque envoi ; 3 envois sans choix : le lundi seulement ; 4 lundis : plus rien ; un choix remet à zéro', async () => {
  try {
    await jour(1);
    await reglerHorloge(db, NON_LUNDI);
    assert.deepEqual(await pour(E4), [], 'le lendemain, aucune carte arrivée depuis le dernier envoi : rien');
    await offre(L2, 'Stage 4A logistique');
    assert.deepEqual(await pour(E4), [['E4', { n: 4, type: 'etudiant' }]], 'une nouvelle offre : 2e envoi');
    await jour(1);
    await offre(L2, 'Stage 4A maintenance');
    assert.deepEqual(await pour(E4), [['E4', { n: 5, type: 'etudiant' }]], '3e envoi (5 au plus)');
    assert.deepEqual(await etat(E4), { n: 3, lundis: 0 });
    await jour(1);
    await offre(L2, 'Stage 4A énergie');
    assert.deepEqual(await pour(E4), [], '3 envois sans aucun choix : plus en semaine');
    await reglerHorloge(db, LUNDI);
    assert.deepEqual(await pour(E4), [['E4', { n: 5, type: 'etudiant' }]], 'le lundi, oui');
    for (const k of [2, 3, 4]) {
      await jour(7);
      await reglerHorloge(db, NON_LUNDI);
      await offre(L1, `Stage 4A semaine ${k}`);
      assert.deepEqual(await pour(E4), [], `semaine ${k} : rien en semaine`);
      await reglerHorloge(db, LUNDI);
      assert.equal((await pour(E4)).length, 1, `lundi n° ${k}`);
    }
    assert.deepEqual(await etat(E4), { n: 7, lundis: 4 });
    await jour(7);
    await offre(L1, 'Stage 4A semaine 5');
    assert.deepEqual(await pour(E4), [], '4 lundis sans choix : plus rien');
    // Elle revient jouer : la série repart (chaque jour, puisqu'elle a joué)
    await choix(E4, { offre: O.qualite }, 'plus_tard', '1 day');
    await reglerHorloge(db, NON_LUNDI);
    assert.equal((await pour(E4)).length, 1, 'un choix : de nouveau chaque jour');
    assert.deepEqual(await etat(E4), { n: 1, lundis: 0 }, 'remis à zéro');
  } finally { await reglerHorloge(db); }
});

test('P1 lauréat : les étudiants de son parcours arrivés depuis sa dernière visite (ni cachés, ni d’une autre filière, ni prépa, ni sans filière, ni bloqués)', async () => {
  await reglerHorloge(db, NON_LUNDI);
  try {
    await db.query(`insert into public.visites (user_id, vu_at) values ($1, now() - interval '2 days') on conflict (user_id) do update set vu_at = excluded.vu_at`, [LR]);
    await choix(LR, { profil: E5 }, 'plus_tard', '3 days');   // il a joué ces 14 derniers jours
    const nouveau = (id, nom, filiere, promo = S + 1) => creerCompte(db, { id, full_name: nom, role: 'etudiant', filiere, promo });
    await nouveau(N[0], 'Aya Nouvelle', GI);
    await nouveau(N[1], 'Badr Nouveau', GIEO, S + 2);   // même parcours
    await nouveau(N[2], 'Chaimae Civil', GC);           // autre parcours
    await nouveau(N[3], 'Driss Discret', GI);
    await db.query('update public.profiles set match_visible = false where id = $1', [N[3]]);
    await nouveau(N[4], 'Elias Prepa', PREPA, S + 4);
    await nouveau(N[5], 'Farah Sans', '');
    await nouveau(N[6], 'Ghali Bloque', GI);
    await db.query('insert into public.blocages (user_id, bloque_id) values ($1, $2)', [N[6], LR]);
    const f = (await tour()).filter(([q]) => q === 'LR');
    assert.deepEqual(f, [['LR', { n: 2, type: 'laureat' }]], 'Aya et Badr');
    const vu = (await un('select public.derniere_visite($1) v', [LR])).v;
    const deck = await pile(LR);
    assert.deepEqual(deck.filter(c => new Date(c.profil.created_at) > vu).map(c => NOMS[c.profil.id]).sort(), ['N1', 'N2', 'N3'],
      'deckMatch lui montre aussi Chaimae (autre parcours, en fin de pile) : le tour n’annonce que « de ton parcours »');
    assert.ok(deck.length > 3, 'dans une pile plus grande');
  } finally { await reglerHorloge(db); }
});

test('P2 un « Intéressé » sans réponse depuis 21 h : un rappel, une seule fois ; 8 jours ou 3 heures : rien', async () => {
  await abonner(SP);
  await reglerHorloge(db, AUJOURDHUI);
  try {
    await choix(L1, { profil: SP[0] }, 'oui', '21 hours');
    await choix(L1, { profil: SP[1] }, 'oui', '8 days');
    await choix(L1, { profil: SP[2] }, 'oui', '3 hours');   // la notification de l'intérêt vient de partir
    assert.equal(await attente(), 1);
    assert.deepEqual((await file('match_attente')).map(x => [x.qui, x.data]),
      [['S1', { n: 1, nom: 'Youssef', de: L1, type: 'etudiant', entreprise: 'Renault' }]], 'l’entreprise : montrée à tous');
    assert.equal(await attente(), 0, 'deuxième passage : rien');
    await db.query('delete from public.notif_programme');
    assert.equal(await attente(), 0, 'le lendemain non plus : chaque intérêt est rappelé une fois');
  } finally { await reglerHorloge(db); await db.query('delete from public.notif_programme'); }
});

test('P2 rien après une réponse « Plus tard », un match, un blocage, un intérêt notifié dans les 20 h ; jamais pour l’administration', async () => {
  await reglerHorloge(db, AUJOURDHUI);
  try {
    await choix(L2, { profil: SP[3] }, 'oui', '21 hours');
    await choix(SP[3], { profil: L2 }, 'plus_tard', '2 hours');
    await choix(L2, { profil: SP[4] }, 'oui', '21 hours');
    await choix(SP[4], { profil: L2 }, 'oui', '1 hour');
    assert.equal((await un('select count(*)::int n from public.matchs where etudiant_id = $1 and laureat_id = $2', [SP[4], L2])).n, 1, 'un match');
    await choix(L1, { profil: SP[5] }, 'oui', '21 hours');
    await db.query('insert into public.blocages (user_id, bloque_id) values ($1, $2)', [SP[5], L1]);
    await choix(L1, { profil: SP[6] }, 'oui', '22 hours');
    await db.query(`insert into public.push_journal (user_id, kind, code, at) values ($1, 'match_interet', 201, now() - interval '2 hours')`, [SP[6]]);
    await choix(L1, { profil: ADM }, 'oui', '21 hours');   // posé à la main : la base ne le permet pas depuis le site
    assert.equal(await attente(), 0);
    // L'intérêt de Youssef notifié il y a plus de 20 h : le rappel part
    await db.query(`update public.push_journal set at = now() - interval '21 hours' where user_id = $1`, [SP[6]]);
    assert.equal(await attente(), 1);
    assert.deepEqual((await file('match_attente')).map(x => x.qui), ['S7']);
  } finally { await reglerHorloge(db); await db.query('delete from public.notif_programme'); }
});

test('P2 tous les intérêts en une notification (n, le plus récent nommé) ; entreprise cachée : vide ; le lauréat, avec l’offre visée', async () => {
  await reglerHorloge(db, AUJOURDHUI);
  try {
    await choix(L2, { profil: SP[7] }, 'oui', '30 hours');
    await choix(L1, { profil: SP[7] }, 'oui', '21 hours');
    await choix(L2, { profil: SP[8] }, 'oui', '21 hours');
    O.ouverte = await offre(L3, 'PFE 5A ouvert à toutes les filières', '{5}', { type: 'pfe' });
    await choix(SP[9], { offre: O.ouverte }, 'oui', '21 hours');
    assert.equal(await attente(), 3);
    const f = Object.fromEntries((await file('match_attente')).map(x => [x.qui, x.data]));
    assert.deepEqual(f.S8, { n: 2, nom: 'Youssef', de: L1, type: 'etudiant', entreprise: 'Renault' }, 'deux lauréats attendent : une notification');
    assert.deepEqual(f.S9, { n: 1, nom: 'Karim', de: L2, type: 'etudiant', entreprise: '' }, 'Karim cache son entreprise aux étudiants');
    assert.deepEqual(f.L3, { n: 1, nom: 'Meryem', de: SP[9], type: 'laureat', entreprise: '', titre: 'PFE 5A ouvert à toutes les filières', offre: O.ouverte });
  } finally { await reglerHorloge(db); await db.query('delete from public.notif_programme'); }
});

test('P2 puis P1 à midi : le jour d’un rappel d’intérêt, pas de tour du jour ; le lendemain, oui', async () => {
  await reglerHorloge(db, AUJOURDHUI);
  try {
    // Anas a joué avant-hier et a des cartes ; Youssef s'intéresse à lui depuis 21 h
    await choix(SP[10], { offre: O.pfe5 }, 'plus_tard', '2 days');
    await choix(L1, { profil: SP[10] }, 'oui', '21 hours');
    await vider();
    await db.query('select public.midi_push()');
    const kinds = (await db.query('select kind from public.push_queue where user_id = $1', [SP[10]])).rows.map(r => r.kind);
    assert.deepEqual(kinds, ['match_attente'], 'une seule notification Match ce jour-là');
    await jour(1);
    assert.deepEqual(await pour(SP[10]), [['S11', { n: 2, type: 'etudiant' }]], 'le lendemain : son tour du jour (sans les offres de Youssef, qui l’attend dans sa pile)');
  } finally { await reglerHorloge(db); }
});
