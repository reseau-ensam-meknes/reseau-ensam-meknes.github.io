// Écoles et nouvelles notifications : une tâche de pg_cron n'a pas de membre connecté (auth.uid() vide), push_filtre ne
// filtre donc pas l'école pour elle. Chaque producteur programmé choisit ses destinataires, ses chiffres et ses noms dans
// l'école du membre ; un envoi à beaucoup sans membre connecté (éditeur SQL, service) reste dans l'école de son contenu.
// Deux écoles aux membres jumeaux (même filière, même promo, même ville) : rien ne doit passer de l'une à l'autre.
// Les lignes d'une école à l'autre sont posées directement (le site ne peut pas les créer : garde_ecole, test-ecoles.mjs) :
// c'est le filtre de chaque producteur qui est vérifié ici.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, creerCompte, uid, reglerHorloge, aujourdhuiA } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const GI = 'Génie Industriel et Productique', GC = 'Génie Civil';
const MEK = 'ensam-meknes', TEST = 'ecole-test';
// ENSAM Meknès : EM (étudiante), LM et LM2 (lauréats) ; École test : ET (étudiante), LT, LT2 et LT3 (lauréats)
const EM = uid(1601), LM = uid(1602), LM2 = uid(1603), ET = uid(1611), LT = uid(1612), LT2 = uid(1613), LT3 = uid(1614), ADMIN = uid(1620);
const NOMS = { [EM]: 'EM', [LM]: 'LM', [LM2]: 'LM2', [ET]: 'ET', [LT]: 'LT', [LT2]: 'LT2', [LT3]: 'LT3', [ADMIN]: 'ADMIN' };
const DOW = new Date().getUTCDay();
const LUNDI = aujourdhuiA(12, 30, (8 - DOW) % 7);
const J = k => aujourdhuiA(0, 0, k).slice(0, 10);

let db;
const un = async (sql, p) => (await db.query(sql, p)).rows[0];
const vider = () => db.query('delete from public.push_queue');
const lancer = async f => { await vider(); return (await un(`select public.${f}() n`)).n; };
// La file, par destinataire : { EM: data, … } (un seul envoi par personne et par type dans ces tests)
const recus = async kind => {
  const r = (await db.query('select user_id, data from public.push_queue where kind = $1 order by id', [kind])).rows;
  const m = {};
  for (const x of r) { const k = NOMS[x.user_id] || x.user_id; assert.ok(!(k in m), `${kind} : un seul pour ${k}`); m[k] = x.data; }
  return m;
};
const qui = async kind => Object.keys(await recus(kind)).sort();
const offre = async (auteur, ecole, titre, champs = {}) => (await un(`insert into public.offers (author_id, type, titre, entreprise, description, annees, filieres, deadline, ecole)
  values ($1, 'pfe', $2, 'Renault', 'Une vraie mission.', '{5}', '{}', $3, $4) returning id`, [auteur, titre, champs.deadline || null, ecole])).id;
const mentorat = async (etu, lau, rdv, sujet = 'Préparer un entretien') => {
  const { id } = await un(`insert into public.mentorships (student_id, mentor_id, sujet, creneaux) values ($1, $2, $3, $4) returning id`, [etu, lau, sujet, [rdv]]);
  await db.query(`update public.mentorships set status = 'acceptee', rdv_at = $2 where id = $1`, [id, rdv]);
  return id;
};
const evenement = async (ecole, titre, debut) => (await un(`insert into public.evenements (titre, debut, lieu, public, ecole) values ($1, $2, 'Amphi A', 'tous', $3) returning id`,
  [titre, debut, ecole])).id;
const inscrire = (u, e) => db.query('insert into public.evenement_participants (evenement_id, user_id) values ($1, $2)', [e, u]);
const demande = async (u, ecole, titre, ilYa = '0 seconds') => {
  const { id } = await un(`insert into public.demandes (auteur_id, type, titre, details, lieu, ecole) values ($1, 'pfe', $2,
    'Lean, VSM et Power BI : je cherche un PFE en usine, de février à juin.', 'Casablanca', $3) returning id`, [u, titre, ecole]);
  await db.query(`update public.demandes set created_at = now() - $2::interval, relancee_at = now() - $2::interval where id = $1`, [id, ilYa]);
  return id;
};
const oui = (de, { profil, offre: o }, ilYa = '21 hours') => db.query(`insert into public.match_choix (user_id, ${o ? 'cible_offre' : 'cible_profil'}, choix, updated_at)
  values ($1, $2, 'oui', now() - $3::interval)`, [de, o || profil, ilYa]);

// Une base neuve par test : deux écoles ouvertes, des membres jumeaux, tous abonnés, venus il y a 3 jours, inscrits il y a 30 jours
async function base() {
  db = await nouvelleBase(SCHEMA);
  await db.query(`insert into public.ecoles (slug, nom, ouverte) values ($1, 'École test', true)`, [TEST]);
  const membre = (id, full_name, role, ecole, champs) => creerCompte(db, { id, full_name, role, filiere: GI, ville: 'Casablanca', ecole, ...champs });
  await membre(EM, 'Salma Bennani', 'etudiant', MEK, { promo: S + 1 });
  await membre(LM, 'Youssef Amrani', 'laureat', MEK, { promo: 2015, entreprise: 'Renault' });
  await membre(LM2, 'Karim Tazi', 'laureat', MEK, { promo: 2018 });
  // La même ville, écrite autrement dans l'école test (et plus souvent : 4 contre 3) : le nom du groupe vient de son école
  await membre(ET, 'Hiba Alaoui', 'etudiant', TEST, { promo: S + 1, ville: 'CASABLANCA' });
  await membre(LT, 'Omar Fassi', 'laureat', TEST, { promo: 2015, entreprise: 'Renault', ville: 'CASABLANCA' });
  await membre(LT2, 'Nadia Berrada', 'laureat', TEST, { promo: 2018, ville: 'CASABLANCA' });
  await membre(LT3, 'Rayan Idrissi', 'laureat', TEST, { promo: 2016, ville: 'CASABLANCA' });
  await creerCompte(db, { id: ADMIN, full_name: 'Admin Réseau', role: 'etudiant', filiere: GI, promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  await db.query(`update public.profiles set created_at = now() - interval '30 days', mentor_dispo = (role = 'laureat'), verified = (role = 'laureat')`);
  await db.query(`insert into public.visites (user_id, vu_at) select id, now() - interval '3 days' from public.profiles`);
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://push.example/' || id, 'k', 'a' from public.profiles`);
  assert.deepEqual((await db.query(`select ecole, count(*)::int n from public.profiles group by 1 order by 1`)).rows, [{ ecole: TEST, n: 4 }, { ecole: MEK, n: 4 }]);
  await vider();
}

test('Match du jour (P1) : les cartes de son école seulement (offres pour l’étudiant, nouveaux étudiants pour le lauréat)', async () => {
  await base();
  await offre(LM, MEK, 'PFE méthodes à Meknès');
  await offre(LT, TEST, 'PFE qualité');
  await offre(LT, TEST, 'PFE supply chain');
  // Deux étudiantes arrivées hier, une par école : de nouvelles cartes pour les lauréats de chaque école
  await db.query(`update public.profiles set created_at = now() - interval '1 day' where id = any($1::uuid[])`, [[EM, ET]]);
  await reglerHorloge(db, LUNDI);
  try {
    await lancer('match_jour_push');
    const f = await recus('match_jour');
    assert.deepEqual(Object.fromEntries(Object.entries(f).map(([k, d]) => [k, d.n])), { EM: 1, ET: 2, LM: 1, LM2: 1, LT: 1, LT2: 1, LT3: 1 });
  } finally { await reglerHorloge(db); }
});

test('Intérêt qui attend (P2) : seuls les intérêts de son école, avec un nom de son école', async () => {
  await base();
  const o = await offre(LM, MEK, 'PFE méthodes à Meknès');
  await oui(LM2, { profil: EM });
  await oui(LT, { profil: EM }, '20 hours 30 minutes');   // d'une autre école, plus récent : ni compté, ni nommé
  await oui(LM, { profil: ET });                 // d'une autre école : rien pour Hiba
  await oui(ET, { offre: o });                   // Hiba sur l'offre de Youssef : rien pour lui
  await reglerHorloge(db, aujourdhuiA(12, 30));
  try {
    await lancer('match_attente_push');
    const f = await recus('match_attente');
    assert.deepEqual(Object.keys(f), ['EM']);
    assert.equal(f.EM.n, 1); assert.equal(f.EM.de, LM2); assert.equal(f.EM.nom, 'Karim');
  } finally { await reglerHorloge(db); }
});

test('La veille (P3, P4, P8) : rendez-vous, entretien, agenda et lendemain entre membres d’une même école ; inscrits de son école', async () => {
  await base();
  await reglerHorloge(db, aujourdhuiA(19, 30));
  try {
    const demain = h => aujourdhuiA(h, 0, 1);
    await mentorat(EM, LT, demain(10));                   // d'une école à l'autre : rien
    const m = await mentorat(ET, LT, demain(11));
    await lancer('rdv_demain_push');
    const r = await recus('rdv_demain');
    assert.deepEqual(Object.keys(r).sort(), ['ET', 'LT']);
    assert.equal(r.LT.n, 1, 'un rendez-vous demain, pas deux'); assert.equal(r.LT.m, m); assert.equal(r.LT.nom, 'Hiba Alaoui');
    // Entretien proposé dans une discussion
    const rdv = (de, a, h) => db.query(`insert into public.messages (author_id, dest_id, type, rdv_at, rdv_duree) values ($1, $2, 'rdv', $3, 30)`, [de, a, demain(h)]);
    await rdv(EM, LT, 9); await rdv(ET, LT2, 15);
    await lancer('entretien_demain_push');
    const e = await recus('entretien_demain');
    assert.deepEqual(Object.keys(e).sort(), ['ET', 'LT2']);
    assert.equal(e.LT2.nom, 'Hiba'); assert.equal(e.LT2.n, 1);
    // Agenda : un forum de l'école test ; Salma (Meknès) y est inscrite par erreur : ni prévenue, ni comptée
    const ev = await evenement(TEST, 'Forum de l’école test', demain(14));
    for (const u of [ET, LT2, EM]) await inscrire(u, ev);
    await lancer('agenda_demain_push');
    const a = await recus('agenda_demain');
    assert.deepEqual(Object.keys(a).sort(), ['ET', 'LT2']);
    assert.equal(a.ET.inscrits, 2, 'les inscrits de son école');
    // Le lendemain d'un rendez-vous (il y a 20 h)
    const hier = new Date(Date.now() - 20 * 36e5).toISOString();
    await mentorat(EM, LT2, hier);
    const m2 = await mentorat(ET, LT3, hier);
    await lancer('apres_rdv_push');
    const p = await recus('apres_rdv');
    assert.deepEqual(Object.keys(p).sort(), ['ET', 'LT3']);
    assert.equal(p.ET.m, m2); assert.equal(p.ET.nom, 'Rayan');
  } finally { await reglerHorloge(db); }
});

test('Groupes du jour (P11d) : les messages, le chiffre et le nom du groupe de son école', async () => {
  await base();
  const ecrire = (u, ecole, n) => db.query(`insert into public.groupe_messages (groupe, author_id, body, ecole, created_at)
    select 'ville:casablanca', $1, 'Bonjour ' || i, $2, now() - interval '2 hours' from generate_series(1, $3::int) i`, [u, ecole, n]);
  await ecrire(LM, MEK, 2);
  await ecrire(LT, TEST, 3);
  await reglerHorloge(db, aujourdhuiA(19, 30));
  try {
    await lancer('groupe_jour_push');
    const g = await recus('groupe_jour');
    assert.deepEqual(Object.fromEntries(Object.entries(g).map(([k, d]) => [k, [d.n, d.groupe, d.gkey, d.autres]])), {
      EM: [2, 'Casablanca', 'ville:casablanca', 0], LM2: [2, 'Casablanca', 'ville:casablanca', 0],
      ET: [3, 'CASABLANCA', 'ville:casablanca', 0], LT2: [3, 'CASABLANCA', 'ville:casablanca', 0], LT3: [3, 'CASABLANCA', 'ville:casablanca', 0] });
    assert.equal((await un(`select public.nom_groupe('ville:casablanca', $1) n`, [MEK])).n, 'Casablanca');
    assert.equal((await un(`select public.nom_groupe('ville:casablanca', $1) n`, [TEST])).n, 'CASABLANCA');
  } finally { await reglerHorloge(db); }
});

test('Résumé du dimanche (P7) : chaque compte dans l’école du membre', async () => {
  await base();
  // Arrivés cette semaine : Karim (Meknès, promo 2018), Nadia (école test, promo 2018) et Rayan (école test)
  await db.query(`update public.profiles set created_at = now() - interval '2 days' where id = any($1::uuid[])`, [[LM2, LT2, LT3]]);
  await offre(LM, MEK, 'PFE méthodes à Meknès');
  await offre(LT, TEST, 'PFE qualité');
  await offre(LT, TEST, 'PFE supply chain');
  await evenement(MEK, 'Forum Meknès', aujourdhuiA(10, 0, 3));
  await evenement(TEST, 'Forum test', aujourdhuiA(10, 0, 3));
  await evenement(TEST, 'Atelier test', aujourdhuiA(10, 0, 4));
  await lancer('semaine_push');
  const f = await recus('semaine');
  const sans = d => { const { type, ...reste } = d; return reste; };
  assert.deepEqual(Object.fromEntries(Object.entries(f).map(([k, d]) => [k, sans(d)])), {
    EM: { offres: 1, laureats: 1, evenements: 1 },
    ET: { offres: 2, laureats: 2, evenements: 2 },
    LM: { evenements: 1 },
    LM2: { offres: 1, evenements: 1 },               // Nadia, de sa promo mais d'une autre école : pas comptée
    LT: { evenements: 2 },
    LT2: { offres: 2, evenements: 2 },               // Karim, de sa promo mais d'une autre école : pas compté
    LT3: { offres: 2, evenements: 2 },
  });
});

test('Rappel du soir : les nouvelles clés (matchs, intérêts, réponses, agenda) comptent dans son école seulement', async () => {
  await base();
  await db.query(`insert into public.matchs (etudiant_id, laureat_id) values ($1, $2), ($1, $3)`, [EM, LM, LT]);
  await oui(LM2, { profil: EM }, '2 days');
  await oui(LT2, { profil: EM }, '2 days');
  const { id: qid } = await un(`insert into public.questions (author_id, categorie, titre, ecole) values ($1, 'stage', 'Un PFE chez Renault ?', $2) returning id`, [EM, MEK]);
  await db.query(`insert into public.answers (question_id, author_id, body) values ($1, $2, 'Oui, écris-moi.'), ($1, $3, 'Moi aussi.')`, [qid, LM, LT]);
  await inscrire(EM, await evenement(MEK, 'Forum Meknès', aujourdhuiA(10, 0, 1)));
  await inscrire(EM, await evenement(TEST, 'Forum test', aujourdhuiA(11, 0, 1)));
  const contenu = async u => (await un(`select public.rappel_contenu(p, now() - interval '3 days') c from public.profiles p where p.id = $1`, [u])).c;
  const c = await contenu(EM);
  assert.deepEqual({ matchs: c.matchs, interets: c.interets, reponses: c.reponses, evenements: c.evenements },
    { matchs: 1, interets: 1, reponses: 1, evenements: 1 });
  // Le soir même, sur le téléphone : les mêmes chiffres, sauf l'agenda, que agenda_demain annonce la veille à 19:30 (l'email,
  // qui lit rappel_contenu, le garde)
  await reglerHorloge(db, aujourdhuiA(18, 0));
  try {
    await lancer('rappels_push');
    const r = await recus('rappel_visite');
    assert.deepEqual({ matchs: r.EM.matchs, interets: r.EM.interets, reponses: r.EM.reponses, evenements: r.EM.evenements },
      { matchs: 1, interets: 1, reponses: 1, evenements: undefined });
  } finally { await reglerHorloge(db); }
});

test('Offre qui ferme (P5), demande sans aide (P6), demande ouverte à tous, demande en pause (P11b) : rien d’une autre école', async () => {
  await base();
  // P5 : Salma garde une offre de chaque école, toutes deux ferment dans 2 jours
  const om = await offre(LM, MEK, 'PFE méthodes à Meknès', { deadline: J(2) });
  const ot = await offre(LT, TEST, 'PFE qualité', { deadline: J(2) });
  await db.query(`insert into public.reactions (offer_id, user_id, kind) values ($1, $3, 'save'), ($2, $3, 'save')`, [om, ot, EM]);
  await reglerHorloge(db, aujourdhuiA(9, 0));
  try {
    await lancer('offres_bientot_push');
    assert.deepEqual(Object.fromEntries(Object.entries(await recus('offre_bientot')).map(([k, d]) => [k, d.offre])), { EM: om });
  } finally { await reglerHorloge(db); }
  // P6 : une demande par école, sans aide depuis 25 h : les lauréats de son école
  const dm = await demande(EM, MEK, 'PFE lean à Casablanca', '25 hours');
  const dt = await demande(ET, TEST, 'PFE qualité à Casablanca', '25 hours');
  await lancer('demande_attente_push');
  const a = await recus('demande_attente');
  assert.deepEqual(Object.fromEntries(Object.entries(a).map(([k, d]) => [k, [d.demande, d.nom]])),
    { LM: [dm, 'Salma'], LM2: [dm, 'Salma'], LT: [dt, 'Hiba'], LT2: [dt, 'Hiba'], LT3: [dt, 'Hiba'] });
  // Ouverte à tous après 24 h : une demande de Génie Civil dans l'école test va aux lauréats des autres parcours de cette école
  await creerCompte(db, { id: uid(1615), full_name: 'Amine Civil', role: 'etudiant', filiere: GC, promo: S + 1, ecole: TEST });
  NOMS[uid(1615)] = 'ETC';
  const dc = await demande(uid(1615), TEST, 'Stage chantier à Rabat', '25 hours');
  await lancer('demandes_larges_push');
  assert.deepEqual(Object.fromEntries(Object.entries(await recus('demande_large')).map(([k, d]) => [k, d.demande])), { LT: dc, LT2: dc, LT3: dc });
  // P11b : chacun sa demande en pause, rien d'autre
  await db.query(`update public.demandes set relancee_at = now() - interval '61 days', created_at = now() - interval '61 days' where id = any($1::uuid[])`, [[dm, dt]]);
  await reglerHorloge(db, aujourdhuiA(8, 0));
  try {
    await lancer('demande_pause_push');
    assert.deepEqual(Object.fromEntries(Object.entries(await recus('demande_pause')).map(([k, d]) => [k, d.demande])), { EM: dm, ET: dt });
  } finally { await reglerHorloge(db); }
});

test('Envois à beaucoup sans membre connecté (éditeur SQL, service) : l’école du contenu, l’administration reçoit tout', async () => {
  await base();
  const ecoleTest = ['ET', 'LT', 'LT2', 'LT3'];
  await db.query(`insert into public.evenements (titre, debut, lieu, public, ecole) values ('Forum test', now() + interval '5 days', 'Amphi', 'tous', $1)`, [TEST]);
  assert.deepEqual(await qui('evenement'), [...ecoleTest, 'ADMIN'].sort());
  await vider();
  await db.query(`insert into public.annonces (texte, public, ecole) values ('Journée portes ouvertes', 'tous', $1)`, [TEST]);
  assert.deepEqual(await qui('annonce'), [...ecoleTest, 'ADMIN'].sort());
  await vider();
  await db.query(`insert into public.cafes (organisateur_id, ville, lieu, date_at, ecole) values ($1, 'Casablanca', 'Café de la gare', now() + interval '3 days', $2)`, [ET, TEST]);
  assert.deepEqual(await qui('cafe'), ['LT', 'LT2', 'LT3'], 'Casablanca, mais dans son école');
  await vider();
  await demande(ET, TEST, 'PFE qualité à Casablanca');
  assert.deepEqual(await qui('demande_nouvelle'), ['LT', 'LT2', 'LT3']);
  await vider();
  await db.query(`insert into public.mentorships (student_id, sujet, ecole) values ($1, 'Choisir mon PFE', $2)`, [ET, TEST]);
  assert.deepEqual(await qui('mentorat_ouvert'), ['LT', 'LT2', 'LT3']);
  await vider();
  await db.query(`insert into public.questions (author_id, categorie, titre, entreprise, ecole) values ($1, 'stage', 'Un stage chez Renault ?', 'Renault', $2)`, [ET, TEST]);
  assert.deepEqual(await qui('question_routee'), ['LT'], 'Renault, mais dans son école');
  await vider();
  await db.query(`insert into public.relectures_cv (student_id, cv_path, ecole) values ($1, 'x/cv.pdf', $2)`, [ET, TEST]);
  assert.deepEqual(await qui('relecture_demande'), ['LT', 'LT2', 'LT3']);
  await vider();
  await db.query(`insert into auth.users (id, email) values ($1, 'nouveau@exemple.ma')`, [uid(1616)]);
  await db.query(`insert into public.profiles (id, full_name, role, filiere, promo, ecole) values ($1, 'Mehdi Promo', 'laureat', $2, 2015, $3)`, [uid(1616), GI, TEST]);
  assert.deepEqual(await qui('verifier_pair'), ['LT'], 'promo 2015, mais dans son école');
});
