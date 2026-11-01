// Essai croisé base ⇄ notifier : chaque producteur de schema.sql (déclencheurs entre personnes, envois à beaucoup, tâches
// programmées de 08:00 à 19:30, nuit calme) tourne sur un petit réseau de test, et chaque ligne qu'il met en file passe par
// texteNotif du notifier, en français et en arabe, comme jobPush le ferait. Attendu, pour chaque ligne :
//   · un vrai texte : jamais null pour un vrai envoi, jamais « undefined », « NaN », « null » ni un « 0 » ;
//   · le tag et la route du contrat (CONTRAT-NOUVELLES), un écran qui existe dans app.js, un tag par élément ;
//   · les clés de data du contrat (nouveaux types) et les ids ajoutés (types existants) ;
//   · la même case de Mon profil dans la base (push_categorie) et sur le site (PUSH_KINDS) ;
//   · rien d'une école à l'autre (destinataires, noms, chiffres).
// La file est vidée après chaque étape, comme jobPush la vide, et chaque ligne est notée dans push_journal (code 201).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nouvelleBase, en, creerCompte, uid, reglerHorloge, aujourdhuiA } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
const NOTIFIER = process.env.NOTIFIER_TS || new URL('../../supabase/functions/notifier/index.ts', import.meta.url).pathname;
const N = await import(NOTIFIER);
const logic = await import('../../src/logic.js');
const SITE = 'https://reseau-ensam-meknes.github.io/';

const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const GI = 'Génie Industriel et Productique', GC = 'Génie Civil';
const MEK = 'ensam-meknes', TEST = 'ecole-test';
// ENSAM Meknès : E1 à E4 étudiants (E3 en 4A), L1 à L4 lauréats du parcours, LC lauréat d'un autre parcours, l'administration
const E1 = uid(2101), E2 = uid(2102), E3 = uid(2103), L1 = uid(2104), L2 = uid(2105), L3 = uid(2106), LC = uid(2107), ADMIN = uid(2108);
const E4 = uid(2109), L4 = uid(2110);   // arrivés pendant l'essai
// École test : des jumeaux (même filière, même ville, même promo), sans contenu : rien ne doit leur parvenir de l'autre école
const ET = uid(2121), LT = uid(2122), ET2 = uid(2123);
const MEMBRES = [
  [E1, 'Salma Bennani', 'etudiant', MEK, { promo: S + 1, ville: 'Casablanca' }],
  [E2, 'Hiba Alaoui', 'etudiant', MEK, { promo: S + 1, ville: 'Casablanca' }],
  [E3, 'Imane Kettani', 'etudiant', MEK, { promo: S + 2, ville: 'Rabat' }],
  [L1, 'Youssef Amrani', 'laureat', MEK, { promo: 2015, ville: 'Casablanca', entreprise: 'Renault' }],
  [L2, 'Karim Tazi', 'laureat', MEK, { promo: 2018, ville: 'Casablanca', entreprise: 'OCP' }],
  [L3, 'Nadia Berrada', 'laureat', MEK, { promo: 2016, ville: 'Casablanca' }],
  [LC, 'Omar Chraibi', 'laureat', MEK, { promo: 2016, ville: 'Rabat', filiere: GC }],
  [ADMIN, 'Admin Réseau', 'etudiant', MEK, { promo: 2010 }],
  [ET, 'Rania Fassi', 'etudiant', TEST, { promo: S + 1, ville: 'Casablanca' }],
  [LT, 'Mehdi Lahlou', 'laureat', TEST, { promo: 2015, ville: 'Casablanca', entreprise: 'Renault' }],
];
const ARRIVEES = [
  [E4, 'Aya Benjelloun', 'etudiant', MEK, { promo: S + 1, ville: 'Casablanca' }],
  [L4, 'Driss Lamrani', 'laureat', MEK, { promo: 2015, ville: 'Fès' }],
  [ET2, 'Sara Ouazzani', 'etudiant', TEST, { promo: S + 1, ville: 'Casablanca' }],
];
const ECOLE = Object.fromEntries([...MEMBRES, ...ARRIVEES].map(([id, , , ecole]) => [id, ecole]));
const NOM = Object.fromEntries([...MEMBRES, ...ARRIVEES].map(([id, nom]) => [id, nom]));
const QUI = id => (NOM[id] || id).split(' ')[0];

const CULPABILISANT = /oubli|manqu|dommage|urgent|vite|dépêche|tu n.as pas|personne ne|déçu|نسيت|فات|عاجل|بسرعة/i;
const FAUX = /undefined|\bnull\b|NaN|\[object|\$\{/;
const ZERO = /(^|[^\d:])0(?![\d:])/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Les nouveaux types du lot (contrat, « Nouveaux types : l'interface ») : les clés exactes de data, [obligatoires, permises]
const CLES = {
  match_jour: [['n', 'type'], []],
  match_attente: [['n', 'nom', 'entreprise', 'de', 'type'], ['titre', 'offre']],
  rdv_demain: [['nom', 'sujet', 'rdv_at', 'm', 'n'], []],
  entretien_demain: [['nom', 'rdv_at', 'duree', 'visio', 'm', 'de', 'n'], ['lieu']],
  agenda_demain: [['type', 'debut', 'inscrits', 'id', 'n'], ['titre', 'lieu', 'ville']],
  apres_rdv: [['nom', 'sujet', 'm', 'pour'], []],
  offre_bientot: [[], ['titre', 'entreprise', 'date_limite', 'offre', 'jours', 'n', 'groupe']],
  demande_attente: [['nom', 'type', 'titre', 'demande'], []],
  semaine: [['type'], ['offres', 'laureats', 'promo', 'evenements', 'demandes']],
  reponse_utile: [['nom', 'titre', 'q', 'answer', 'best'], ['n']],
  bravo: [['nom', 'entreprise', 'placement', 'n'], []],
  demande_pause: [['titre', 'demande'], []],
  mentorat_presence: [['nom', 'sujet', 'rdv_at', 'm'], []],
  groupe_jour: [['n', 'groupe', 'gkey', 'autres'], []],
};
// Les types existants (contrat, « un id par élément ») : les clés ajoutées, toujours là
const IDS = {
  candidature: ['offre', 'n'], candidature_statut: ['offre'], invitation: ['offre'], recrutement_a_confirmer: ['p'], recrutement_confirme: ['p'],
  relance_offre: ['offre'], reponse: ['q', 'n'], question_routee: ['q'], evenement: ['id'], evenement_annule: ['id'], evenement_deplace: ['id'],
  cafe: ['id'], mentorat_demande: ['m'], mentorat_accepte: ['m'], mentorat_deplace: ['m'], mentorat_annule: ['m'], rappel_rdv: ['m'],
  mentorat_ouvert: ['m'], relecture_demande: ['r'], relecture_prise: ['r'], relecture_rendue: ['r'], contact_demande: ['c'], contact_accepte: ['c'],
  verifier_pair: ['de'], annonce: ['id'], signalement: ['id'], demande_proposition: ['demande', 'n'],
};

// Le tag et la route attendus pour une ligne (contrat ; hors de ses tables, le comportement d'avant, gardé)
const ROUTE_RAPPEL = { messages: 'messages', matchs: 'match', interets: 'match', propositions: 'offres/demandes', mentorats: 'mentorat',
  candidatures: 'espace', reponses: 'reseau/entraide', evenements: 'reseau/agenda', demandes: 'offres/demandes', offres: 'offres' };
const meme = (prefixe, cle, route) => d => [`${prefixe}-${d[cle]}`, typeof route === 'function' ? route(d) : route];
const ATTENDU = {
  match_jour: () => ['match_jour', 'match'],
  match_attente: d => [d.n >= 2 ? 'match_attente' : `match_interet-${d.de}`, 'match'],
  rdv_demain: meme('mentorat', 'm', 'mentorat'),
  entretien_demain: d => [`rappel_entretien-${d.m}`, `messages/${d.de}`],
  agenda_demain: d => (d.type === 'cafe' ? [`cafe-${d.id}`, 'reseau/groupes'] : [`evenement-${d.id}`, `reseau/agenda/${d.id}`]),
  apres_rdv: meme('mentorat', 'm', 'mentorat'),
  offre_bientot: d => (d.groupe === true ? ['offre_bientot', 'offres'] : [`offre-${d.offre}`, `offre/${d.offre}`]),
  demande_attente: d => [`demande_nouvelle-${d.demande}`, `aider/${d.demande}`],
  semaine: () => ['semaine', 'accueil'],
  reponse_utile: d => [`reponse_utile-${d.answer}`, `reseau/entraide/${d.q}`],
  bravo: meme('bravo', 'placement', 'accueil'),
  demande_pause: d => [`demande_pause-${d.demande}`, `offres/demandes/${d.demande}`],
  mentorat_presence: meme('mentorat', 'm', 'mentorat'),
  groupe_jour: d => [`groupe-${d.gkey}`, `reseau/groupes/${encodeURIComponent(d.gkey)}`],
  rappel_visite: d => ['rappel_visite', ROUTE_RAPPEL[N.RAPPEL_ORDRE.find(k => d[k] > 0)]],
  candidature: d => [`candidature-${d.offre}`, `offre/${d.offre}`],
  candidature_statut: meme('candidature_statut', 'offre', 'parcours'),
  invitation: d => [`invitation-${d.offre}`, `offre/${d.offre}`],
  recrutement_a_confirmer: meme('recrutement', 'p', 'parcours'),
  recrutement_confirme: meme('recrutement', 'p', 'espace'),
  relance_offre: d => [`relance_offre-${d.offre}`, `offre/${d.offre}`],
  reponse: d => [`reponse-${d.q}`, `reseau/entraide/${d.q}`],
  question_routee: d => [`question_routee-${d.q}`, `reseau/entraide/${d.q}`],
  evenement: d => [`evenement-${d.id}`, `reseau/agenda/${d.id}`],
  evenement_annule: d => [`evenement-${d.id}`, `reseau/agenda/${d.id}`],
  evenement_deplace: d => [`evenement-${d.id}`, `reseau/agenda/${d.id}`],
  cafe: meme('cafe', 'id', 'reseau/groupes'),
  mentorat_demande: meme('mentorat', 'm', 'mentorat'),
  mentorat_accepte: meme('mentorat', 'm', 'mentorat'),
  mentorat_deplace: meme('mentorat', 'm', 'mentorat'),
  rappel_rdv: meme('mentorat', 'm', 'mentorat'),
  mentorat_annule: d => [`mentorat-${d.m}`, d.pour === 'demandeur' ? `mentorat/reprendre/${d.m}` : 'mentorat'],
  merci: d => (d.m ? [`mentorat-${d.m}`, 'espace'] : [`relecture-${d.r}`, 'espace']),
  mentorat_ouvert: meme('mentorat_ouvert', 'm', 'mentorat'),
  relecture_demande: meme('relecture', 'r', 'mentorat/cv'),
  relecture_prise: meme('relecture', 'r', 'mentorat/cv'),
  relecture_rendue: meme('relecture', 'r', 'mentorat/cv'),
  contact_demande: meme('contact', 'c', 'accueil'),
  contact_accepte: meme('contact', 'c', 'accueil'),
  verifier_pair: meme('verifier_pair', 'de', 'accueil'),
  annonce: meme('annonce', 'id', 'accueil'),
  signalement: meme('signalement', 'id', 'admin/moderation'),
  demande_proposition: d => [`demande_proposition-${d.demande}`, `offres/demandes/${d.demande}`],
  message: d => [`message-${d.de}`, `messages/${d.de}`],
  match: d => [`match-${d.match}`, `messages/${d.de}`],
  match_interet: d => [`match_interet-${d.de}`, 'match'],
  rdv_message: d => [`rdv_message-${d.m}`, `messages/${d.de}`],
  rdv_reponse: d => [`rdv_reponse-${d.m}`, `messages/${d.de}`],
  rappel_entretien: d => [`rappel_entretien-${d.m}`, `messages/${d.de}`],
  offre_alerte: d => [`offre-${d.offre}`, `offre/${d.offre}`],
  offre_commentaire: d => [`offre_commentaire-${d.offre}`, `offre/${d.offre}`],
  demande_nouvelle: d => [`demande_nouvelle-${d.demande}`, `aider/${d.demande}`],
  demande_large: d => [`demande_large-${d.demande}`, `aider/${d.demande}`],
  promo_nouveau: () => ['promo_nouveau', 'reseau/annuaire'],
  reaction: d => (d.offre ? [`reaction-${d.offre}`, `offre/${d.offre}`] : [`reaction-${d.demande}`, `offres/demandes/${d.demande}`]),
};
// Urgence et durée de vie du contrat pour les nouveaux types
const H = 3600;
const VIE = {
  match_jour: ['high', 6 * H], match_attente: ['high', 12 * H], rdv_demain: ['high', 4 * H], entretien_demain: ['high', 4 * H],
  agenda_demain: ['high', 4 * H], apres_rdv: ['high', 24 * H], offre_bientot: ['high', 12 * H], demande_attente: ['high', 24 * H],
  semaine: ['normal', 12 * H], reponse_utile: ['high', 24 * H], bravo: ['high', 24 * H], demande_pause: ['normal', 24 * H],
  mentorat_presence: ['high', 24 * H], groupe_jour: ['normal', 12 * H],
};

let db;
const lignes = [];   // { etape, user_id, kind, data }
const un = async (sql, p) => (await db.query(sql, p)).rows[0];
// La file comme jobPush la traite : chaque ligne relevée, notée dans le journal (201), puis retirée
async function ramasser(etape) {
  const r = (await db.query('select user_id, kind, data from public.push_queue order by id')).rows;
  for (const x of r) lignes.push({ etape, ...x });
  await db.query(`insert into public.push_journal (user_id, kind, code) select user_id, kind, 201 from public.push_queue`);
  await db.query('delete from public.push_queue');
  return r;
}
const etape = async (nom, fn) => { await fn(); return ramasser(nom); };
// Une tâche programmée, à son heure : le budget du jour repart de zéro (chaque tâche est essayée seule)
const tache = async (nom, quand, sql) => {
  await reglerHorloge(db, quand);
  await db.query('delete from public.notif_programme');
  try { return await etape(nom, () => db.query(sql)); } finally { await reglerHorloge(db); }
};
const offre = async (auteur, titre, champs = {}) => (await un(`insert into public.offers (author_id, type, titre, entreprise, description, annees, filieres, deadline)
  values ($1, $2, $3, $4, 'Une vraie mission, encadrée par un lauréat.', $5, '{}', $6) returning id`,
[auteur, champs.type || 'pfe', titre, champs.entreprise || 'Renault', champs.annees || '{5}', champs.deadline || null])).id;
const mentorat = async (etu, lau, rdv, sujet) => {
  const { id } = await un(`insert into public.mentorships (student_id, mentor_id, sujet, besoin, creneaux) values ($1, $2, $3, 'entretien', $4) returning id`, [etu, lau, sujet, [rdv]]);
  await db.query(`update public.mentorships set status = 'acceptee', rdv_at = $2, accepted_at = now() where id = $1`, [id, rdv]);
  return id;
};
const demande = async (auteur, type, titre, ilYa = null) => {
  const { id } = await un(`insert into public.demandes (auteur_id, type, titre, details, lieu) values ($1, $2, $3,
    'Lean, VSM et Power BI : je cherche une vraie mission en usine, de février à juin.', 'Casablanca') returning id`, [auteur, type, titre]);
  if (ilYa) await db.query(`update public.demandes set created_at = now() - $2::interval, relancee_at = now() - $2::interval where id = $1`, [id, ilYa]);
  return id;
};
const ilYa = h => new Date(Date.now() - h * 36e5).toISOString();
const J = k => aujourdhuiA(0, 0, k).slice(0, 10);
const DOW = new Date().getUTCDay();
const LUNDI = aujourdhuiA(12, 30, (8 - DOW) % 7);
const ids = {};

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await db.query(`insert into public.ecoles (slug, nom, ouverte) values ($1, 'École test', true)`, [TEST]);
  const creer = ([id, full_name, role, ecole, champs]) => creerCompte(db, { id, full_name, role, filiere: GI, ecole, ...champs });
  for (const m of MEMBRES) await creer(m);
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  await db.query(`update public.profiles set created_at = now() - interval '30 days', mentor_dispo = (role = 'laureat'), verified = (role = 'laureat'),
    cv_path = case when role = 'etudiant' then id::text || '/cv-1730000000000.pdf' end`);
  await db.query(`insert into public.visites (user_id, vu_at) select id, now() - interval '3 days' from public.profiles`);
  const abonner = list => db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    select id, 'https://push.example/' || id, 'k', 'a' from unnest($1::uuid[]) id on conflict do nothing`, [list]);
  await abonner(MEMBRES.map(m => m[0]));

  // Arrivées : un camarade de promo (étudiante, lauréat à vérifier), et une étudiante de l'école test
  for (const m of ARRIVEES) await etape('arrivée ' + QUI(m[0]), () => creer(m));
  await abonner(ARRIVEES.map(m => m[0]));

  // --- La journée (10:00) : ce que font les membres -------------------------------------------------------------------
  await etape('offres', async () => {
    ids.O1 = await offre(L1, 'PFE méthodes');
    ids.O2 = await offre(L1, 'Stage qualité', { type: 'stage' });
    ids.O4 = await offre(L2, 'PFE maintenance', { entreprise: 'OCP', annees: '{4,5}' });
    ids.O5 = await offre(L3, 'Stage lean', { type: 'stage', entreprise: 'Lesieur' });
    // Mises de côté qui ferment : une dans 2 jours (Salma), une demain (Imane, 4A), trois demain (Hiba : une seule ligne)
    ids.B1 = await offre(L2, 'PFE supply chain', { entreprise: 'OCP', deadline: J(2) });
    ids.B2 = await offre(L3, 'Stage maintenance', { type: 'stage', entreprise: 'Lesieur', annees: '{4,5}', deadline: J(1) });
    ids.B3 = [];
    for (const t of ['Stage achats', 'Stage logistique', 'Stage production']) ids.B3.push(await offre(L2, t, { type: 'stage', entreprise: 'OCP', deadline: J(1) }));
  });
  await etape('mises de côté', async () => {
    const garder = (u, o) => db.query(`insert into public.reactions (offer_id, user_id, kind) values ($1, $2, 'save')`, [o, u]);
    await garder(E1, ids.B1); await garder(E3, ids.B2);
    for (const o of ids.B3) await garder(E2, o);
  });
  // Match : Youssef et Salma se choisissent (un intérêt, puis le match) ; des intérêts d'hier restés sans réponse
  await etape('match', async () => {
    await db.query(`insert into public.match_choix (user_id, cible_profil, choix) values ($1, $2, 'oui')`, [L1, E1]);
    await db.query(`insert into public.match_choix (user_id, cible_offre, choix) values ($1, $2, 'oui')`, [E1, ids.O1]);
  });
  await etape('intérêts d’hier', async () => {
    await db.query(`insert into public.match_choix (user_id, cible_profil, choix, updated_at) values ($1, $2, 'oui', now() - interval '21 hours')`, [L1, E3]);
    await db.query(`insert into public.match_choix (user_id, cible_offre, choix, updated_at) values ($1, $2, 'oui', now() - interval '21 hours'), ($3, $2, 'oui', now() - interval '22 hours')`, [E2, ids.O4, E3]);
    await db.query(`insert into public.match_choix (user_id, cible_offre, choix, updated_at) values ($1, $2, 'oui', now() - interval '21 hours')`, [E1, ids.O5]);
  });
  // Leur notification est partie hier, au moment du choix
  await db.query(`update public.push_journal set at = now() - interval '21 hours' where kind = 'match_interet' and user_id = any($1::uuid[])`, [[E3, L2, L3]]);

  // Mentorat : deux rendez-vous demain pour Salma, un d'hier soir (Hiba), une présence confirmée, un rappel dans 10 minutes,
  // un rendez-vous déplacé puis annulé par le lauréat, un autre annulé par l'étudiante, un merci, une demande ouverte à tous
  await etape('mentorat', async () => {
    ids.M1 = await mentorat(E1, L1, aujourdhuiA(10, 0, 1), 'Préparer un entretien');
    ids.M2 = await mentorat(E1, L2, aujourdhuiA(15, 0, 1), 'Relire mon CV');
    ids.M3 = await mentorat(E2, L3, ilYa(20), 'Choisir mon PFE');
    ids.M4 = await mentorat(E3, L1, aujourdhuiA(10, 0, 3), 'Mon premier entretien');
    await db.query(`update public.mentorships set confirme_at = now() where id = $1`, [ids.M4]);
    ids.M5 = await mentorat(E3, L2, new Date(Date.now() + 10 * 60e3).toISOString(), 'Conseils pour un stage');
    ids.M6 = await mentorat(E2, L1, aujourdhuiA(11, 0, 5), 'Négocier un salaire');
    await db.query(`update public.mentorships set rdv_at = $2 where id = $1`, [ids.M6, aujourdhuiA(16, 0, 6)]);
    await en(db, L1, tx => tx.query(`update public.mentorships set status = 'annulee' where id = $1`, [ids.M6]));
    ids.M7 = await mentorat(E1, L3, aujourdhuiA(9, 0, 6), 'Partir à l’étranger');
    await en(db, E1, tx => tx.query(`update public.mentorships set status = 'annulee' where id = $1`, [ids.M7]));
    ids.M8 = await mentorat(E4, L2, ilYa(72), 'Mon stage ouvrier');
    await db.query(`update public.mentorships set merci = 'Merci pour vos conseils' where id = $1`, [ids.M8]);
    ids.M9 = (await un(`insert into public.mentorships (student_id, sujet, besoin, creneaux) values ($1, 'Choisir une option', 'carriere', $2) returning id`,
      [E4, [aujourdhuiA(17, 0, 4)]])).id;
  });
  // Messages : un appel demain (en visio, accepté), un entretien demain sur place, un entretien dans 10 minutes, un message
  await etape('messages', async () => {
    ids.R1 = (await un(`insert into public.messages (author_id, dest_id, type, rdv_at, rdv_duree, rdv_lien) values ($1, $2, 'rdv', $3, 15, 'https://meet.example/x') returning id`,
      [L3, E2, aujourdhuiA(11, 0, 1)])).id;
    await en(db, E2, tx => tx.query('select public.repondre_rdv($1, $2)', [ids.R1, 'oui']));
    ids.R3 = (await un(`insert into public.messages (author_id, dest_id, type, rdv_at, rdv_duree, rdv_lieu) values ($1, $2, 'rdv', $3, 45, 'Siège OCP, Casablanca') returning id`,
      [L2, E3, aujourdhuiA(16, 0, 1)])).id;
    ids.R2 = (await un(`insert into public.messages (author_id, dest_id, type, rdv_at, rdv_duree, rdv_lieu) values ($1, $2, 'rdv', $3, 30, 'Siège Renault, Casablanca') returning id`,
      [L1, E1, new Date(Date.now() + 10 * 60e3).toISOString()])).id;
    await db.query(`insert into public.messages (author_id, dest_id, body) values ($1, $2, 'Merci, à demain !')`, [E2, L3]);
  });
  // Candidatures (deux sur une offre, une sur une autre), entretien, invitation, recrutement, bravos, relance, commentaire, réaction
  await etape('candidatures', async () => {
    ids.A1 = (await un(`insert into public.applications (student_id, offer_id, entreprise, titre) values ($1, $2, 'Renault', 'PFE méthodes') returning id`, [E2, ids.O1])).id;
    await db.query(`insert into public.applications (student_id, offer_id, entreprise, titre) values ($1, $2, 'Renault', 'PFE méthodes')`, [E4, ids.O1]);
    await db.query(`insert into public.applications (student_id, offer_id, entreprise, titre) values ($1, $2, 'Renault', 'Stage qualité')`, [E1, ids.O2]);
    await db.query(`update public.applications set status = 'entretien' where id = $1`, [ids.A1]);
    await db.query(`insert into public.invitations (laureat_id, student_id, offer_id) values ($1, $2, $3)`, [L1, E3, ids.O2]);
    ids.P = (await un(`insert into public.placements (student_id, offer_id, laureat_id, saison, niveau, type, entreprise, source, status)
      values ($1, $2, $3, $4, 5, 'pfe', 'Renault', 'plateforme', 'en_attente') returning id`, [E1, ids.O1, L1, S])).id;
    await db.query(`update public.placements set status = 'confirme' where id = $1`, [ids.P]);
  });
  await etape('bravos', async () => {
    await db.query('insert into public.kudos (placement_id, user_id) values ($1, $2)', [ids.P, L2]);
    await db.query(`update public.notif_cadence set at = at - interval '2 hours' where cle like 'bravo:%'`);
    await db.query('insert into public.kudos (placement_id, user_id) values ($1, $2)', [ids.P, L3]);
  });
  await etape('offres : relance, commentaire, réaction', async () => {
    ids.OV = await offre(L3, 'Stage oublié depuis longtemps', { type: 'stage', entreprise: 'Lesieur' });
    await db.query(`update public.offers set created_at = now() - interval '30 days' where id = $1`, [ids.OV]);
    await db.query('select public.relances_offres()');
    await db.query(`insert into public.comments (offer_id, author_id, body) values ($1, $2, 'Le stage est-il rémunéré ?')`, [ids.O2, E2]);
    await db.query(`insert into public.reactions_publiques (offer_id, user_id, emoji) values ($1, $2, '👍')`, [ids.O2, E3]);
  });
  // Entraide : deux réponses, deux votes, la meilleure réponse ; une question pour les lauréats de Renault
  await etape('entraide', async () => {
    ids.Q1 = (await un(`insert into public.questions (author_id, categorie, titre) values ($1, 'stage', 'Comment trouver un PFE chez Renault ?') returning id`, [E1])).id;
    ids.A = (await un(`insert into public.answers (question_id, author_id, body) values ($1, $2, 'Passe par le forum entreprises.') returning id`, [ids.Q1, L1])).id;
    await db.query(`insert into public.answers (question_id, author_id, body) values ($1, $2, 'Écris aux RH de l’usine.')`, [ids.Q1, L2]);
    await db.query('insert into public.votes (answer_id, user_id) values ($1, $2)', [ids.A, E2]);
    await db.query(`update public.notif_cadence set at = at - interval '2 days' where cle like 'vote:%'`);
    await db.query('insert into public.votes (answer_id, user_id) values ($1, $2)', [ids.A, E3]);
    await db.query('update public.questions set best_answer_id = $2 where id = $1', [ids.Q1, ids.A]);
    ids.Q2 = (await un(`insert into public.questions (author_id, categorie, titre, entreprise) values ($1, 'stage', 'Un stage chez Renault Tanger ?', 'Renault') returning id`, [E2])).id;
  });
  // Contacts, relecture de CV, signalement, annonce
  await etape('contacts et relectures', async () => {
    const c = (await un(`insert into public.demandes_contact (demandeur_id, cible_id) values ($1, $2) returning id`, [E3, L2])).id;
    await db.query(`update public.demandes_contact set status = 'acceptee' where id = $1`, [c]);
    const r = (await un(`insert into public.relectures_cv (student_id, reviewer_id, cv_path) values ($1, $2, 'x/cv.pdf') returning id`, [E3, L1])).id;
    for (const s of ['en_cours', 'rendue']) await db.query(`update public.relectures_cv set status = $2 where id = $1`, [r, s]);
    await db.query(`update public.relectures_cv set merci = 'Merci beaucoup !' where id = $1`, [r]);
    await db.query(`insert into public.signalements (auteur_id, cible_type, cible_id, motif) values ($1, 'offre', $2, 'spam')`, [E1, ids.OV]);
    await db.query(`insert into public.annonces (author_id, texte, public) values ($1, 'Forum entreprises jeudi à 10 h, amphi A', 'tous')`, [ADMIN]);
  });
  // Agenda : un forum demain (Salma, Hiba, Youssef inscrits), un atelier déplacé puis annulé, un café demain à Casablanca
  await etape('agenda', async () => {
    ids.EV1 = (await un(`insert into public.evenements (author_id, titre, type, debut, lieu, public) values ($1, 'Forum entreprises', 'forum', $2, 'Amphi A', 'tous') returning id`,
      [ADMIN, aujourdhuiA(14, 0, 1)])).id;
    for (const u of [E1, E2, L1]) await db.query('insert into public.evenement_participants (evenement_id, user_id) values ($1, $2)', [ids.EV1, u]);
    ids.EV2 = (await un(`insert into public.evenements (author_id, titre, type, debut, lieu, public) values ($1, 'Atelier CV', 'atelier', $2, 'Salle B12', 'etudiants') returning id`,
      [ADMIN, aujourdhuiA(16, 0, 5)])).id;
    await db.query('insert into public.evenement_participants (evenement_id, user_id) values ($1, $2)', [ids.EV2, E3]);
    await db.query(`update public.evenements set debut = debut + interval '1 day' where id = $1`, [ids.EV2]);
    await db.query(`update public.evenements set annule = true where id = $1`, [ids.EV2]);
    ids.CAFE = (await un(`insert into public.cafes (organisateur_id, ville, lieu, date_at) values ($1, 'Casablanca', 'Café de la gare', $2) returning id`,
      [L2, aujourdhuiA(18, 0, 1)])).id;
    for (const u of [L3, E2]) await db.query('insert into public.cafe_participants (cafe_id, user_id) values ($1, $2)', [ids.CAFE, u]);
  });
  // Demandes : une d'hier sans aide (Salma), une ouverte depuis 61 jours (Hiba), une qui reçoit deux aides (Imane)
  await etape('demandes', async () => {
    ids.D1 = await demande(E1, 'pfe', 'PFE amélioration continue', '25 hours');
    ids.D2 = await demande(E2, 'stage', 'Stage ouvrier en été', '61 days');
    ids.D3 = await demande(E3, 'stage', 'Stage qualité en usine');
    for (const u of [L1, L2]) await db.query(`insert into public.propositions (demande_id, laureat_id, aide, entreprise, message) values ($1, $2, 'recommande', 'OCP', 'Je peux te recommander.')`, [ids.D3, u]);
  });
  // Groupes : des messages d'il y a 2 heures dans le groupe de la ville et dans celui du parcours (Salma est dans les deux)
  await etape('groupes', async () => {
    ids.GF = (await un(`select (public.groupes_auto(filiere, ville, pays))[1] g from public.profiles where id = $1`, [E1])).g;
    for (let i = 1; i <= 3; i++) await db.query(`insert into public.groupe_messages (groupe, author_id, body, created_at) values ('ville:casablanca', $1, $2, now() - interval '2 hours')`, [L1, 'Bonjour à tous ' + i]);
    await db.query(`insert into public.groupe_messages (groupe, author_id, body, created_at) values ($1, $2, 'Qui va au forum ?', now() - interval '2 hours')`, [ids.GF, L2]);
  });

  // --- La nuit : une offre publiée à 23:00 attend 08:00 -----------------------------------------------------------------
  await reglerHorloge(db, aujourdhuiA(23, 0, -1));
  await etape('nuit', async () => { ids.ON = await offre(L2, 'PFE publié le soir', { entreprise: 'OCP' }); });
  ids.gardees = (await un('select count(*)::int n from public.push_nuit')).n;
  await reglerHorloge(db);

  // --- Les tâches programmées, chacune à son heure -----------------------------------------------------------------------
  await tache('08:00 matin_push', aujourdhuiA(8, 0), 'select public.matin_push()');
  await tache('09:00 offres_bientot_push', aujourdhuiA(9, 0), 'select public.offres_bientot_push()');
  await tache('10:05 alertes_horaires', aujourdhuiA(10, 5), 'select public.alertes_horaires()');
  await tache('dimanche 10:00 semaine_push', aujourdhuiA(10, 0), 'select public.semaine_push()');
  await tache('lundi 12:30 midi_push', LUNDI, 'select public.midi_push()');
  await tache('18:00 rappels_soir', aujourdhuiA(18, 0), 'select public.rappels_soir()');
  await tache('19:30 veille_push', aujourdhuiA(19, 30), 'select public.veille_push()');
  await tache('chaque minute rappels_rdv', aujourdhuiA(10, 0), 'select public.rappels_rdv()');
});

// Ce que le téléphone affichera pour une ligne, dans une langue
const texte = (x, l) => N.texteNotif(x.kind, x.data, l, SITE);
const quoi = (x, l) => `${x.etape} · ${x.kind} → ${QUI(x.user_id)} (${l}) ${JSON.stringify(x.data)}`;

test('chaque producteur met de vraies lignes en file : tous les types du contrat, avec leurs variantes', () => {
  const vus = new Set(lignes.map(x => x.kind));
  const attendus = [...Object.keys(CLES), 'rappel_visite', ...Object.keys(IDS), 'merci', 'message', 'match', 'match_interet', 'rdv_message',
    'rdv_reponse', 'rappel_entretien', 'offre_alerte', 'offre_commentaire', 'demande_nouvelle', 'demande_large', 'promo_nouveau', 'reaction'];
  assert.deepEqual(attendus.filter(k => !vus.has(k)), [], 'types jamais produits');
  const de = k => lignes.filter(x => x.kind === k).map(x => x.data);
  const variantes = {
    'match_jour étudiant': de('match_jour').some(d => d.type === 'etudiant'),
    'match_jour lauréat': de('match_jour').some(d => d.type === 'laureat'),
    'match_attente étudiant, une personne, son entreprise': de('match_attente').some(d => d.type === 'etudiant' && d.n === 1 && d.entreprise),
    'match_attente lauréat, une personne, son offre': de('match_attente').some(d => d.type === 'laureat' && d.n === 1 && d.titre && d.offre),
    'match_attente plusieurs personnes': de('match_attente').some(d => d.n >= 2),
    'rdv_demain deux rendez-vous': de('rdv_demain').some(d => d.n >= 2),
    'rdv_demain un seul': de('rdv_demain').some(d => d.n === 1),
    'entretien_demain en visio': de('entretien_demain').some(d => d.visio === true && !d.lieu),
    'entretien_demain sur place': de('entretien_demain').some(d => d.visio === false && d.lieu),
    'agenda_demain événement': de('agenda_demain').some(d => d.type === 'evenement' && d.inscrits >= 2),
    'agenda_demain café': de('agenda_demain').some(d => d.type === 'cafe'),
    'agenda_demain deux rendez-vous': de('agenda_demain').some(d => d.n >= 2),
    'apres_rdv étudiant': de('apres_rdv').some(d => d.pour === 'demandeur'),
    'apres_rdv lauréat': de('apres_rdv').some(d => d.pour === 'mentor'),
    'offre_bientot demain': de('offre_bientot').some(d => d.jours === 1),
    'offre_bientot dans 2 jours': de('offre_bientot').some(d => d.jours === 2),
    'offre_bientot groupée': de('offre_bientot').some(d => d.groupe === true && d.n >= 3),
    'semaine étudiant': de('semaine').some(d => d.type === 'etudiant'),
    'semaine lauréat': de('semaine').some(d => d.type === 'laureat'),
    'reponse_utile un vote': de('reponse_utile').some(d => d.best === false && d.n === 1),
    'reponse_utile plusieurs votes': de('reponse_utile').some(d => d.best === false && d.n >= 2),
    'reponse_utile meilleure réponse': de('reponse_utile').some(d => d.best === true),
    'bravo un': de('bravo').some(d => d.n === 1),
    'bravo plusieurs': de('bravo').some(d => d.n >= 2),
    'groupe_jour avec un autre groupe': de('groupe_jour').some(d => d.autres >= 1),
    'rappel_visite Match et agenda': de('rappel_visite').some(d => d.matchs > 0 || d.interets > 0) && de('rappel_visite').some(d => d.evenements > 0),
    'rappel_visite réponses': de('rappel_visite').some(d => d.reponses > 0),
    'candidature plusieurs': de('candidature').some(d => d.n >= 2),
    'reponse plusieurs': de('reponse').some(d => d.n >= 2),
    'demande_proposition plusieurs': de('demande_proposition').some(d => d.n >= 2),
    'mentorat_annule par le lauréat': de('mentorat_annule').some(d => d.pour === 'demandeur'),
    'mentorat_annule par l’étudiant': de('mentorat_annule').some(d => d.pour === 'mentor'),
    'merci mentorat': de('merci').some(d => d.m),
    'merci relecture': de('merci').some(d => d.r),
  };
  assert.deepEqual(Object.entries(variantes).filter(([, v]) => !v).map(([k]) => k), [], 'variantes jamais produites');
  assert.ok(lignes.length >= 100, `${lignes.length} lignes`);
});

test('chaque ligne, en français et en arabe : un vrai texte, jamais null, « undefined », « NaN » ni « 0 », jamais culpabilisant', () => {
  const nouveaux = new Set([...Object.keys(CLES), 'rappel_visite']);
  for (const x of lignes) for (const l of ['fr', 'ar']) {
    const t = texte(x, l), q = quoi(x, l);
    assert.ok(t, q + ' : texteNotif rend null pour un vrai envoi');
    assert.ok(typeof t.title === 'string' && t.title.trim().length > 1 && typeof t.body === 'string' && t.body.trim().length > 1, q);
    assert.ok(Array.from(t.title).length <= 80 && Array.from(t.body).length <= 180, q);
    const tout = t.title + ' ' + t.body;
    assert.doesNotMatch(tout, FAUX, q);
    assert.doesNotMatch(tout, ZERO, q + ' : un « 0 »');
    if (nouveaux.has(x.kind)) assert.doesNotMatch(tout, CULPABILISANT, q);
    if (l === 'ar') {
      assert.doesNotMatch(tout, /القدامى/, q);
      // Un message privé peut ne contenir que le nom et le texte du membre (isolés) ; tout le reste parle arabe
      if (x.kind !== 'message') assert.match(tout, /[؀-ۿ]/, q);
      // Aucun mot latin hors du contenu des membres (isolé) et du nom ENSAM : rien n'est oublié en arabe
      const reste = tout.replace(/⁨[^⁩]*⁩/g, '').replace(/ENSAM/g, '');
      assert.deepEqual(reste.match(/[A-Za-zÀ-ÿ]{2,}/g) || [], [], q + ' : mot latin en arabe');
    } else {
      assert.doesNotMatch(tout, /[⁨⁩]/, q);
    }
  }
});

test('le tag et la route du contrat, un écran qui existe dans app.js ; un élément, une ligne dans la barre', async () => {
  const app = fs.readFileSync(new URL('../../src/app.js', import.meta.url), 'utf8');
  const ROUTES = JSON.parse(app.match(/const ROUTES = (\[[^\]]+\]);/)[1].replace(/'/g, '"'));
  for (const x of lignes) {
    assert.ok(Object.prototype.hasOwnProperty.call(ATTENDU, x.kind), `${x.kind} : tag et route attendus à écrire dans ce test`);
    const [tag, route] = ATTENDU[x.kind](x.data);
    for (const l of ['fr', 'ar']) {
      const t = texte(x, l), q = quoi(x, l);
      assert.equal(t.tag, tag, q);
      assert.equal(t.url, SITE + '#' + route, q);
    }
    assert.doesNotMatch(tag, /undefined|null/, quoi(x, 'fr'));
    // Un tag par élément : seuls les types de TAGS_FIXES gardent un tag égal au type
    if (!N.TAGS_FIXES.has(x.kind)) assert.notEqual(tag, x.kind, quoi(x, 'fr') + ' : tag fixe');
    assert.ok(ROUTES.includes(route.split('/')[0]), `${route} : écran inconnu de app.js`);
  }
  // Deux candidatures sur deux offres : deux lignes dans la barre de Youssef ; deux sur la même offre : la même ligne
  const cand = lignes.filter(x => x.kind === 'candidature' && x.user_id === L1).map(x => texte(x, 'fr').tag);
  assert.deepEqual(cand, [`candidature-${ids.O1}`, `candidature-${ids.O1}`, `candidature-${ids.O2}`]);
  // Toute la vie d'un mentorat sur une seule ligne : la demande, le rendez-vous fixé, la veille, le rappel de 15 minutes
  const m1 = lignes.filter(x => x.user_id === E1 && x.data.m === ids.M1).map(x => [x.kind, texte(x, 'fr').tag]);
  assert.deepEqual([...new Set(m1.map(([, t]) => t))], [`mentorat-${ids.M1}`], JSON.stringify(m1));
  assert.ok(m1.some(([k]) => k === 'mentorat_accepte') && m1.some(([k]) => k === 'rdv_demain'), JSON.stringify(m1));
  // La veille d'un entretien prend la ligne de son rappel ; celle d'un événement, la ligne de son annonce
  const r = k => lignes.filter(x => x.kind === k && x.data.m === ids.R1).map(x => texte(x, 'fr').tag);
  assert.deepEqual([...new Set(r('entretien_demain'))], [`rappel_entretien-${ids.R1}`]);
  const ev = lignes.filter(x => x.user_id === E1 && (x.data.id === ids.EV1)).map(x => [x.kind, texte(x, 'fr').tag]);
  assert.deepEqual(ev.map(([k]) => k), ['evenement', 'agenda_demain']);
  assert.equal(ev[0][1], ev[1][1]);
  // Une demande toujours sans aide reprend la ligne de sa publication
  const d1 = lignes.filter(x => x.user_id === L2 && x.data.demande === ids.D1).map(x => [x.kind, texte(x, 'fr').tag]);
  assert.deepEqual(d1.map(([k]) => k), ['demande_nouvelle', 'demande_attente']);
  assert.equal(d1[0][1], d1[1][1]);
  // Le lien d'un groupe ouvre ce groupe : app.js découpe la route et décode chaque morceau (parseRoute), GroupView n'ouvre
  // qu'une clé filiere:, ville: ou pays:, et c'est un groupe du membre (autoGroups du site, ou un groupe qu'il suit)
  const groupes = lignes.filter(x => x.kind === 'groupe_jour');
  assert.ok(groupes.length >= 2);
  for (const x of groupes) {
    const [base, sub, sub2] = texte(x, 'fr').url.slice(SITE.length + 1).split('/').map(decodeURIComponent);
    assert.deepEqual([base, sub, sub2], ['reseau', 'groupes', x.data.gkey], quoi(x, 'fr'));
    assert.match(sub2, /^(filiere|ville|pays):.+/, quoi(x, 'fr'));
    const p = await un('select filiere, ville, pays from public.profiles where id = $1', [x.user_id]);
    const suivis = (await db.query('select groupe from public.groupe_membres where user_id = $1', [x.user_id])).rows.map(r => r.groupe);
    assert.ok([...logic.autoGroups(p), ...suivis].includes(x.data.gkey), quoi(x, 'fr') + ' : pas un groupe du membre');
  }
});

test('les clés de data : celles du contrat pour les nouveaux types, les ids ajoutés aux types existants', () => {
  for (const x of lignes) {
    const q = quoi(x, 'fr'), cles = Object.keys(x.data);
    if (CLES[x.kind]) {
      const [requises, permises] = CLES[x.kind];
      assert.deepEqual(requises.filter(k => !cles.includes(k)), [], q + ' : clé manquante');
      assert.deepEqual(cles.filter(k => !requises.includes(k) && !permises.includes(k)), [], q + ' : clé hors du contrat');
    }
    for (const k of IDS[x.kind] || []) {
      if (k === 'n') assert.ok(Number.isInteger(x.data.n) && x.data.n >= 1, q);
      else assert.match(String(x.data[k]), UUID, q + ` : ${k}`);
    }
    // Les ids de toutes les lignes sont de vrais uuid ; les nombres, des entiers positifs (0 n'est jamais envoyé)
    for (const k of ['offre', 'q', 'm', 'r', 'c', 'p', 'id', 'de', 'demande', 'answer', 'placement', 'match']) {
      if (k in x.data) assert.match(String(x.data[k]), UUID, q + ` : ${k}`);
    }
    for (const k of ['n', 'jours', 'inscrits', 'offres', 'laureats', 'promo', 'evenements', 'demandes', 'matchs', 'interets', 'reponses']) {
      if (k in x.data && !(k === 'promo' && x.kind === 'promo_nouveau') && !(k === 'promo' && x.kind === 'verifier_pair')) {
        assert.ok(Number.isInteger(x.data[k]) && x.data[k] >= 1, q + ` : ${k}`);
      }
    }
    if (x.kind === 'groupe_jour') assert.ok(Number.isInteger(x.data.autres) && x.data.autres >= 0, q);
    if (x.kind === 'match_jour') assert.ok(x.data.n <= N.TOUR_JOUR && ['etudiant', 'laureat'].includes(x.data.type), q);
  }
});

test('chaque clé que la base envoie sert au notifier : changer sa valeur change le texte, le tag ou la route', () => {
  // Une clé qui ne change jamais rien : la base l'envoie pour rien, ou le notifier lit un autre nom (l'interface a divergé)
  // On essaie une autre valeur du même domaine (un autre rôle, un autre uuid, un autre jour…), puis la clé absente.
  // Nouveaux types : toutes leurs clés (le test précédent vérifie qu'elles sont celles du contrat) ; types existants : les ids ajoutés
  const AUTRE = '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f';
  const ECHANGE = { etudiant: 'laureat', laureat: 'etudiant', evenement: 'cafe', cafe: 'evenement', demandeur: 'mentor', mentor: 'demandeur', pfe: 'stage', stage: 'pfe' };
  const changer = v => (typeof v === 'boolean' ? !v : typeof v === 'number' ? v + 2 : UUID.test(v) ? AUTRE
    : /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(Date.parse(v) + 2 * 864e5 + 36e5).toISOString() : ECHANGE[v] || 'Zakaria Idrissi');
  // Lue seulement en secours, quand type manque (le notifier devine alors le rôle) : la base envoie toujours type
  const SECOURS = new Set(['match_attente.offre']);
  const vu = JSON.stringify;
  const servent = {}, envoyees = {};
  for (const x of lignes.filter(x => CLES[x.kind] || IDS[x.kind])) {
    const ref = vu([texte(x, 'fr'), texte(x, 'ar')]);
    const s = (servent[x.kind] ||= new Set()), e = (envoyees[x.kind] ||= new Set());
    for (const k of Object.keys(x.data).filter(k => CLES[x.kind] || IDS[x.kind].includes(k))) {
      e.add(k);
      const sans = { ...x.data }; delete sans[k];
      const autre = { ...x.data, [k]: changer(x.data[k]) };
      const lu = d => vu([N.texteNotif(x.kind, d, 'fr', SITE), N.texteNotif(x.kind, d, 'ar', SITE)]);
      if (lu(autre) !== ref || lu(sans) !== ref) s.add(k);
    }
  }
  const inutiles = Object.keys(envoyees).flatMap(kind => [...envoyees[kind]].filter(k => !servent[kind].has(k)).map(k => `${kind}.${k}`));
  assert.deepEqual(inutiles.filter(c => !SECOURS.has(c)), [], 'clés envoyées que le notifier ne lit pas');
  // Toutes les clés du contrat ont été essayées sur au moins une vraie ligne
  const jamais = Object.entries(CLES).flatMap(([kind, [req]]) => req.filter(k => !envoyees[kind]?.has(k)).map(k => `${kind}.${k}`));
  assert.deepEqual(jamais, [], 'clés du contrat jamais envoyées');
});

test('la même case de Mon profil dans la base et sur le site ; l’urgence et la durée de vie du contrat', async () => {
  const kinds = [...new Set(lignes.map(x => x.kind))].sort();
  const base = Object.fromEntries((await db.query('select k, public.push_categorie(k) c from unnest($1::text[]) k', [kinds])).rows.map(r => [r.k, r.c]));
  assert.deepEqual(Object.fromEntries(kinds.map(k => [k, logic.pushCategorie(k)])), base);
  for (const k of kinds) assert.ok(Object.prototype.hasOwnProperty.call(logic.PUSH_KINDS, k), `${k} : absent de PUSH_KINDS`);
  for (const [k, [urg, vie]] of Object.entries(VIE)) {
    assert.equal(N.urgence(k), urg, k);
    assert.equal(N.dureeVie(k), vie, k);
  }
});

test('rien d’une école à l’autre : chaque nom vient de l’école du destinataire, chaque chiffre aussi', () => {
  const ecoleDuNom = {};
  for (const [id, nom] of Object.entries(NOM)) { ecoleDuNom[nom] = ECOLE[id]; ecoleDuNom[nom.split(' ')[0]] = ECOLE[id]; }
  for (const x of lignes) {
    assert.ok(ECOLE[x.user_id], quoi(x, 'fr') + ' : destinataire inconnu');
    if (typeof x.data.nom === 'string' && ecoleDuNom[x.data.nom]) assert.equal(ecoleDuNom[x.data.nom], ECOLE[x.user_id], quoi(x, 'fr'));
  }
  // L'école test n'a rien publié : ses membres ne reçoivent que l'arrivée d'une camarade de promo, son résumé du dimanche et,
  // pour le lauréat, le tour Match du lundi qui compte cette seule nouvelle étudiante (jamais les quatre de Meknès)
  const test = lignes.filter(x => ECOLE[x.user_id] === TEST).map(x => [QUI(x.user_id), x.kind, x.data]);
  assert.deepEqual(test.map(([q, k]) => `${q} ${k}`).sort(), ['Mehdi match_jour', 'Rania promo_nouveau', 'Rania semaine']);
  assert.deepEqual(test.find(([, k]) => k === 'semaine')[2], { type: 'etudiant', promo: 1 }, 'les chiffres de son école');
  assert.deepEqual(test.find(([, k]) => k === 'match_jour')[2], { n: 1, type: 'laureat' }, 'les étudiantes de son école');
  assert.equal(test.find(([, k]) => k === 'promo_nouveau')[2].nom, 'Sara', 'la nouvelle de son école');
});

test('la nuit : l’offre publiée à 23:00 attend dans push_nuit, puis part à 08:00 avec un vrai texte', () => {
  assert.ok(ids.gardees >= 3, `${ids.gardees} gardées`);
  assert.deepEqual(lignes.filter(x => x.etape === 'nuit'), [], 'rien dans la file la nuit');
  const matin = lignes.filter(x => x.etape === '08:00 matin_push' && x.kind === 'offre_alerte');
  assert.equal(matin.length, ids.gardees);
  assert.ok(matin.every(x => x.data.offre === ids.ON && texte(x, 'fr').title && texte(x, 'ar').title));
  assert.ok(lignes.some(x => x.etape === '08:00 matin_push' && x.kind === 'demande_pause' && x.data.demande === ids.D2));
});
