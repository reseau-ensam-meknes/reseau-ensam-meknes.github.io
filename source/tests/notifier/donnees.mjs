// Jeu de données réaliste, daté par rapport à `now` (tests purs et faux Supabase).
import { uid } from './banc.mjs';

export const ID = {
  salma: uid(1), youssef: uid(2), nadia: uid(3), amine: uid(4), imane: uid(5), omar: uid(6), karim: uid(7), hiba: uid(8),
  sara: uid(9), leila: uid(10), mehdi: uid(11), rachid: uid(12), admin: uid(13), ghita: uid(14), hamza: uid(15), kenza: uid(16),
};

export function saisonDe(now) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Casablanca', year: 'numeric', month: 'numeric' }).formatToParts(now);
  const an = +p.find(x => x.type === 'year').value, mois = +p.find(x => x.type === 'month').value;
  return mois >= 9 ? an : an - 1;
}

export function jeu(now) {
  const t = now.getTime(), J = 864e5;
  const il = j => new Date(t - j * J).toISOString();
  const dans = j => new Date(t + j * J).toISOString();
  // Jour J à 17:30 UTC, soit 17:30 au Maroc (GMT depuis le 20 septembre 2026)
  const a1730 = j => { const d = new Date(t + j * J); d.setUTCHours(17, 30, 0, 0); return d.toISOString(); };
  const S = saisonDe(now), promo = n => S + 6 - n;   // promo d'un étudiant de niveau n
  const GI = 'Génie Industriel', GM = 'Génie Mécanique';
  const P = (id, full_name, role, filiere, pr, x = {}) => ({
    id, full_name, role, filiere, promo: pr, entreprise: null, pays: 'Maroc', ville: null, vitrine: true, verified: false,
    cv_url: null, competences: [], created_at: il(200), langue: 'fr', emails_hebdo: true, ...x,
  });
  const profiles = [
    P(ID.salma, 'Salma Idrissi', 'etudiant', GI, promo(4), { ville: ' casablanca', cv_url: 'https://cv.example/salma.pdf', competences: ['Lean', 'Minitab'] }),
    P(ID.youssef, 'Youssef Alami', 'laureat', GI, 2018, { entreprise: 'OCP Group', ville: 'Casablanca', verified: true, langue: 'ar' }),
    P(ID.nadia, 'Nadia Benali', 'laureat', GM, 2020, { entreprise: 'Renault Group Maroc', ville: 'Tanger', verified: true }),
    P(ID.amine, 'Amine Tazi', 'etudiant', GI, promo(3), { ville: 'Meknès', competences: ['SolidWorks', 'Python'], created_at: il(3) }),
    P(ID.imane, 'Imane Chraibi', 'etudiant', GI, promo(5), { cv_url: 'https://cv.example/imane.pdf', competences: ['Lean', 'SAP'], created_at: il(300) }),
    P(ID.omar, 'Omar Fassi', 'etudiant', GI, promo(4), { competences: ['AutoCAD'], created_at: il(100) }),
    P(ID.karim, 'Karim Bennis', 'etudiant', GI, promo(4), { vitrine: false, emails_hebdo: false }),
    P(ID.hiba, 'Hiba Lahlou', 'etudiant', GI, promo(5)),
    P(ID.sara, 'Sara Ouazzani', 'etudiant', GI, promo(4), { cv_url: 'https://cv.example/sara.pdf', competences: ['Python', 'Power BI', 'SQL', 'Excel'], created_at: il(150) }),
    P(ID.leila, 'Leila Amrani', 'etudiant', GI, promo(3), { cv_url: 'https://cv.example/leila.pdf', competences: ['CATIA', 'Lean Six Sigma'], created_at: il(30) }),
    P(ID.mehdi, 'Mehdi Kettani', 'etudiant', 'Génie Civil', promo(4)),
    P(ID.rachid, 'Rachid Naciri', 'etudiant', GI, promo(1), { ville: 'Fès' }),
    P(ID.admin, 'Administration ENSAM', 'admin', GI, 2010, { verified: true }),
    P(ID.ghita, 'Ghita Berrada', 'laureat', 'Génie Énergétique', 2019, { pays: 'France', ville: 'Lyon', created_at: il(1) }),
    P(ID.hamza, 'Hamza Zouiten', 'laureat', 'Mécatronique', 2015, { ville: 'Agadir' }),
    P(ID.kenza, 'Kenza Mouline', 'laureat', GI, S, { ville: 'Kénitra', verified: true }),
  ];
  const O = (n, author_id, titre, entreprise, x) => ({
    id: uid(100 + n), author_id, type: 'stage', titre, entreprise, filieres: [], annees: [4], audience: 'etudiants',
    status: 'ouverte', created_at: il(1), relance_at: null, ...x,
  });
  const offers = [
    O(1, ID.youssef, 'Stage maintenance prédictive', 'OCP', { filieres: [GI], annees: [4, 5], created_at: il(2) }),
    O(2, ID.nadia, 'Stage lean manufacturing', 'Renault Group Maroc', { created_at: il(1) }),
    O(3, ID.nadia, 'PFE robotique de soudage', 'Renault', { type: 'pfe', annees: [5], created_at: il(1.5) }),
    O(4, ID.youssef, 'Ingénieur méthodes junior', 'OCP', { type: 'emploi', annees: [6], audience: 'laureats', created_at: il(3) }),
    O(5, ID.nadia, 'Stage qualité chantier', 'Renault', { filieres: ['Génie Civil'], created_at: il(2) }),
    O(6, ID.youssef, 'Stage supply chain', 'OCP', { created_at: il(10) }),
    O(7, ID.youssef, 'Stage data industrielle', 'OCP', { annees: [3, 4], status: 'pourvue', created_at: il(2) }),
    O(8, ID.nadia, 'Stage énergie solaire <PV> & stockage', 'Renault Group Maroc', { filieres: [GI, 'Génie Énergétique'], created_at: il(4) }),
    O(9, ID.youssef, 'Stage amélioration continue', 'OCP', { created_at: il(5) }),
    O(10, ID.youssef, 'Stage BI & reporting', 'OCP', { created_at: il(30), relance_at: il(2) }),
  ];
  const A = (n, student_id, offer, status = 'postule') => ({ id: uid(200 + n), student_id, offer_id: uid(100 + offer), status, entreprise: 'x', created_at: il(2) });
  const applications = [A(1, ID.amine, 1), A(2, ID.imane, 1), A(3, ID.omar, 9, 'entretien'), A(4, ID.salma, 10), A(5, ID.salma, 2)];
  const I = (n, student_id, offer, status = 'envoyee') => ({ id: uid(300 + n), laureat_id: ID.youssef, student_id, offer_id: uid(100 + offer), status, created_at: il(3) });
  const invitations = [I(1, ID.salma, 6), I(2, ID.salma, 7), I(3, ID.salma, 10), I(4, ID.salma, 9, 'declinee')];
  const M = (n, student_id, mentor_id, sujet, status, x = {}) => ({
    id: uid(400 + n), student_id, mentor_id, sujet, status, rdv_at: null, merci: null, created_at: il(5), besoin: 'cv', creneaux: [], ...x,
  });
  const mentorships = [
    M(1, ID.salma, ID.nadia, 'Préparer mon entretien chez Renault', 'acceptee', { rdv_at: a1730(2) }),
    M(2, ID.salma, ID.youssef, 'Relire mon CV', 'acceptee', { rdv_at: il(3) }),
    M(3, ID.salma, ID.nadia, 'Choisir entre deux offres', 'acceptee', { rdv_at: a1730(10) }),
    M(4, ID.imane, ID.youssef, 'Relire mon CV avant le forum', 'demande'),
    M(5, ID.amine, null, 'Choisir mon stage de 3A', 'demande', { created_at: il(4) }),
    M(6, ID.omar, null, 'Préparer un entretien technique', 'demande', { created_at: il(2) }),
    M(7, ID.mehdi, null, 'Stage en bureau d’études', 'demande', { created_at: il(3) }),
    M(8, ID.sara, ID.youssef, 'Conseils CV', 'terminee', { rdv_at: il(4), merci: 'Merci pour tes conseils sur le CV, j’ai déjà deux entretiens !' }),
    M(9, ID.leila, ID.youssef, 'Orientation', 'terminee', { rdv_at: il(10), merci: 'Merci !' }),
  ];
  const Q = (n, author_id, titre, x) => ({ id: uid(500 + n), author_id, categorie: 'Stage', titre, entreprise: null, pays: null, created_at: il(3), ...x });
  const questions = [
    Q(1, ID.amine, 'Comment se passe le stage ouvrier chez OCP ?', { entreprise: 'OCP S.A.' }),
    Q(2, ID.salma, 'Quels logiciels apprendre avant un stage chez Renault ?', { entreprise: 'Renault', created_at: il(5) }),
    Q(3, ID.imane, 'Visa pour un stage en France : par où commencer ?', { pays: 'France', created_at: il(2) }),
    Q(4, ID.omar, 'Entretien OCP : quelles questions ?', { entreprise: 'OCP', created_at: il(6) }),
    Q(5, ID.leila, 'OCP recrute des 3A ?', { entreprise: 'OCP', created_at: il(20) }),
    Q(6, ID.salma, 'Où trouver un stage ouvrier ?', { created_at: il(30) }),
  ];
  const R = (n, question, author_id, jours) => ({ id: uid(600 + n), question_id: uid(500 + question), author_id, body: '…', created_at: il(jours) });
  const answers = [R(1, 2, ID.nadia, 2), R(2, 2, ID.youssef, 1), R(3, 2, ID.salma, 1), R(4, 4, ID.youssef, 5), R(5, 6, ID.imane, 3), R(6, 6, ID.imane, 25)];
  const parrainages = [{ id: uid(700), filleul_id: ID.amine, parrain_id: ID.youssef, saison: S, created_at: il(2) }];
  const C = (n, organisateur_id, ville, lieu, date_at, x = {}) => ({ id: uid(800 + n), organisateur_id, ville, pays: 'Maroc', lieu, date_at, annule: false, places: 20, ...x });
  const cafes = [
    C(1, ID.nadia, 'Casablanca  ', 'Café Bianca, Maârif', a1730(5)),
    C(2, ID.nadia, 'Casablanca', 'Annulé', a1730(4), { annule: true }),
    C(3, ID.nadia, 'Casablanca', 'Trop tard', a1730(20)),
    C(4, ID.nadia, 'Rabat', 'Agdal', a1730(3)),
    C(5, ID.youssef, 'Casablanca', 'Morocco Mall, terrasse', a1730(6)),
    C(6, ID.youssef, 'Meknès', 'Place El Hedim', a1730(4)),
  ];
  const PL = (n, student_id, laureat_id, status, x = {}) => ({
    id: uid(1000 + n), student_id, laureat_id, offer_id: null, saison: S, niveau: 4, type: 'stage', entreprise: 'OCP', ville: null, pays: 'Maroc',
    source: laureat_id ? 'plateforme' : 'autre', status, merci: null, note: null, created_at: il(5), confirmed_at: null, ...x,
  });
  const placements = [
    PL(1, ID.salma, ID.youssef, 'en_attente'),
    PL(2, ID.hiba, ID.youssef, 'confirme', { confirmed_at: il(3), merci: 'Merci Youssef pour ton accompagnement, j’ai adoré l’équipe maintenance !' }),
    PL(3, ID.sara, ID.nadia, 'refuse', { entreprise: 'Renault' }),
    PL(4, ID.leila, null, 'declare', { saison: S - 1 }),
  ];
  const emails = Object.fromEntries(profiles.map(p => [p.id, `${p.full_name.split(' ')[0].toLowerCase()}@exemple.ma`]));
  return { S, tables: { profiles, offers, applications, invitations, mentorships, questions, answers, parrainages, cafes, placements }, emails };
}

// Forme attendue par indexer() (ce que chargerDonnees() rend)
export function brut(j) {
  const t = j.tables;
  return {
    profils: t.profiles, offres: t.offers, candidatures: t.applications, invitations: t.invitations, mentorats: t.mentorships,
    questions: t.questions, reponses: t.answers, parrainages: t.parrainages, cafes: t.cafes, placements: t.placements,
  };
}
