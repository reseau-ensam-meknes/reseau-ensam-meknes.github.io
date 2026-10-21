// Données de démonstration (personnes et entreprises fictives) pour essayer la plateforme.
import { FILIERES, seasonOf } from './logic.js';
import { seedPhase3 } from './seed3.js';
import { seedMessages } from './seed4.js';

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const PRENOMS = ['Salma', 'Youssef', 'Imane', 'Hamza', 'Khadija', 'Anas', 'Meryem', 'Othmane', 'Hiba', 'Ayoub', 'Zineb', 'Mehdi', 'Nour', 'Ilyas', 'Kawtar', 'Amine', 'Sara', 'Reda', 'Chaimae', 'Bilal', 'Ghita', 'Adam', 'Yasmine', 'Soufiane', 'Fatima Zahra', 'Hatim', 'Douae', 'Ismail', 'Rania', 'Zakaria', 'Oumaima', 'Achraf', 'Wiam', 'Taha', 'Asmae', 'Nabil', 'Lina', 'Marouane', 'Hajar', 'Karim'];
const NOMS = ['Bennani', 'El Amrani', 'Alaoui', 'Tazi', 'Berrada', 'Idrissi', 'Chraibi', 'Lahlou', 'Fassi', 'Benjelloun', 'Ouazzani', 'Kettani', 'Sebti', 'Moussaoui', 'Bouzidi', 'Hajji', 'Naciri', 'Zerouali', 'Amrani', 'Belkadi', 'Skalli', 'Rahmouni', 'Lamrani', 'Cherkaoui', 'Bakkali', 'El Khattabi', 'Squalli', 'Mernissi', 'Tahiri', 'Ziani'];
const VILLES_MA = ['Casablanca', 'Tanger', 'Kénitra', 'Rabat', 'Meknès', 'Fès', 'Marrakech', 'Agadir', 'Jorf Lasfar', 'Mohammedia'];

const ENTREPRISES = [
  { nom: 'Renault Group Maroc', ville: 'Tanger', pays: 'Maroc', fil: ['Génie Mécanique', 'Génie Industriel'] },
  { nom: 'Stellantis Kénitra', ville: 'Kénitra', pays: 'Maroc', fil: ['Génie Industriel', 'Mécatronique'] },
  { nom: 'OCP Group', ville: 'Jorf Lasfar', pays: 'Maroc', fil: ['Génie Électromécanique', 'Génie Énergétique'] },
  { nom: 'Safran Nacelles', ville: 'Casablanca', pays: 'Maroc', fil: ['Génie Mécanique'] },
  { nom: 'Lear Corporation', ville: 'Kénitra', pays: 'Maroc', fil: ['Génie Industriel'] },
  { nom: 'Siemens Gamesa', ville: 'Tanger', pays: 'Maroc', fil: ['Génie Énergétique', 'Génie Mécanique'] },
  { nom: 'Capgemini Engineering', ville: 'Casablanca', pays: 'Maroc', fil: ['Génie Informatique & IA', 'Mécatronique'] },
  { nom: 'ONEE', ville: 'Rabat', pays: 'Maroc', fil: ['Génie Électromécanique', 'Génie Énergétique'] },
  { nom: 'LafargeHolcim Maroc', ville: 'Meknès', pays: 'Maroc', fil: ['Génie Civil', 'Génie Industriel'] },
  { nom: 'Yazaki Morocco', ville: 'Meknès', pays: 'Maroc', fil: ['Génie Industriel'] },
  { nom: 'Spirit AeroSystems', ville: 'Casablanca', pays: 'Maroc', fil: ['Génie Mécanique', 'Génie Industriel'] },
  { nom: 'TGCC', ville: 'Casablanca', pays: 'Maroc', fil: ['Génie Civil'] },
  { nom: 'Airbus Operations', ville: 'Toulouse', pays: 'France', fil: ['Génie Mécanique'] },
  { nom: 'Valeo', ville: 'Créteil', pays: 'France', fil: ['Mécatronique', 'Génie Électromécanique'] },
  { nom: 'Bosch', ville: 'Stuttgart', pays: 'Allemagne', fil: ['Mécatronique', 'Génie Informatique & IA'] },
  { nom: 'Hydro-Québec', ville: 'Montréal', pays: 'Canada', fil: ['Génie Énergétique', 'Génie Électromécanique'] },
  { nom: 'Schneider Electric', ville: 'Grenoble', pays: 'France', fil: ['Génie Électromécanique'] },
  { nom: 'Vinci Construction', ville: 'Nanterre', pays: 'France', fil: ['Génie Civil'] },
];

export function buildSeed(now = new Date()) {
  const r = rng(20261018);
  const pick = a => a[Math.floor(r() * a.length)];
  const S = seasonOf(now);
  const daysAgo = (d, h = 10) => new Date(now.getTime() - d * 864e5 - h * 36e5).toISOString();
  const seasonDate = (s, frac) => new Date(new Date(s, 8, 1).getTime() + frac * 300 * 864e5).toISOString();
  let n = 0; const id = p => `${p}-${(++n).toString(36).padStart(4, '0')}`;
  const used = new Set();
  const name = () => { for (;;) { const x = `${pick(PRENOMS)} ${pick(NOMS)}`; if (!used.has(x)) { used.add(x); return x; } } };

  const profiles = [];
  const mk = (o) => { const p = { id: id('u'), pays: 'Maroc', competences: [], vitrine: true, verified: false, mentor_dispo: false, created_at: daysAgo(40 + Math.floor(r() * 300)), ...o }; used.add(p.full_name); profiles.push(p); return p; };

  // Trois comptes « personas » pour essayer chaque rôle
  const salma = mk({ full_name: 'Salma Bennani', role: 'etudiant', filiere: 'Génie Industriel', promo: S + 1, ville: 'Meknès', bio: 'Passionnée de lean manufacturing et de supply chain. Je cherche un PFE en excellence opérationnelle, idéalement à l’étranger.', competences: ['Lean', 'VSM', 'Python', 'Power BI', 'SolidWorks'], linkedin: 'linkedin.com/in/salma-bennani', _persona: 'Étudiante 5A · Salma' });
  const youssef = mk({ full_name: 'Youssef El Amrani', role: 'laureat', filiere: 'Génie Mécanique', promo: 2016, entreprise: 'Renault Group Maroc', poste: 'Responsable méthodes emboutissage', ville: 'Tanger', verified: true, mentor_dispo: true, mentor_sujets: 'Industrie automobile, méthodes, préparer un entretien technique', bio: 'Promo 2016. 10 ans dans l’automobile entre Tanger et Flins. Je réponds toujours aux étudiants de l’école.', competences: ['Emboutissage', 'Méthodes', 'Lean', 'Management'], linkedin: 'linkedin.com/in/youssef-elamrani', _persona: 'Lauréat actif · Youssef' });
  const admin = mk({ full_name: 'Bureau des relations entreprises', role: 'admin', filiere: 'Génie Industriel', promo: 2010, entreprise: 'ENSAM Meknès', poste: 'Administration', ville: 'Meknès', verified: true, _persona: 'Admin école' });
  // Deux comptes « neufs » pour tester la plateforme comme un nouvel inscrit
  mk({ full_name: 'Amine Talbi', role: 'etudiant', filiere: 'Génie Mécanique', promo: S + 3, ville: 'Meknès', competences: [], _persona: 'Nouvel étudiant 3A · Amine' });
  mk({ full_name: 'Nadia Ferhat', role: 'laureat', filiere: 'Génie Industriel', promo: 2019, ville: 'Casablanca', competences: [], _persona: 'Nouvelle lauréate · Nadia' });

  // Étudiants de la saison en cours
  const students = [salma];
  const counts = { [S + 1]: 21, [S + 2]: 18, [S + 3]: 17 };
  for (const promo of Object.keys(counts).map(Number)) for (let i = 0; i < counts[promo]; i++) {
    students.push(mk({ full_name: name(), role: 'etudiant', filiere: pick(FILIERES), promo, ville: pick(VILLES_MA), competences: [] }));
  }
  // Jeunes diplômés (promo S) et promo précédente
  const jeunes = []; for (let i = 0; i < 16; i++) jeunes.push(mk({ full_name: name(), role: 'laureat', filiere: pick(FILIERES), promo: S, ville: pick(VILLES_MA), verified: r() > 0.3 }));
  const precedents = []; for (let i = 0; i < 7; i++) precedents.push(mk({ full_name: name(), role: 'laureat', filiere: pick(FILIERES), promo: S - 1, verified: true }));

  // Lauréats expérimentés
  const postes = ['Ingénieur méthodes', 'Responsable qualité', 'Chef de projet', 'Ingénieur R&D', 'Responsable maintenance', 'Plant manager', 'Data engineer', 'Ingénieur structures', 'Consultant supply chain', 'Ingénieure procédés'];
  const seniors = [youssef];
  for (let i = 0; i < 17; i++) {
    const e = pick(ENTREPRISES);
    seniors.push(mk({ full_name: name(), role: 'laureat', filiere: pick(e.fil), promo: 2008 + Math.floor(r() * 15), entreprise: e.nom, poste: pick(postes), ville: e.ville, pays: e.pays, verified: r() > 0.15, mentor_dispo: r() > 0.45, mentor_sujets: pick(['Stages à l’étranger, Campus France, VIE', 'CV, entretiens, négociation de salaire', 'Lean, qualité, industrie', 'Data, IA, reconversion', 'Génie civil, chantiers, BET', 'Énergies renouvelables']), competences: [] }));
  }
  // Les postes des jeunes diplômés déjà en emploi sont remplis plus bas.

  // ---------------- Offres ----------------
  const offers = [];
  const OFFRES = [
    ['pfe', 'PFE : réduction des rebuts sur ligne d’emboutissage', 'Renault Group Maroc', ['Génie Mécanique', 'Génie Industriel'], [5], 'Sujet de PFE de 6 mois en équipe méthodes. Analyse des causes (Ishikawa, AMDEC), plan d’action et suivi des indicateurs. Je coopte directement les profils motivés.', 9, youssef],
    ['stage', 'Stage ingénieur adjoint : amélioration continue', 'Yazaki Morocco', ['Génie Industriel'], [4], 'Stage de 2 mois cet été. Chantiers 5S, SMED et suivi TRS sur les lignes de câblage.', 32],
    ['etranger', 'Stage 6 mois : aérostructures (Toulouse)', 'Airbus Operations', ['Génie Mécanique'], [5], 'Stage en bureau d’études, calcul de structures composites. Niveau B2 en français et anglais exigé. Gratification + aide au logement.', 21],
    ['emploi', 'Ingénieur maintenance (CDI) – jeune diplômé accepté', 'OCP Group', ['Génie Électromécanique', 'Génie Énergétique'], [6], 'Poste basé à Jorf Lasfar. Maintenance préventive et conditionnelle des unités de production. Je peux transmettre vos CV en interne.', 18],
    ['stage', 'Stage ouvrier / technique sur chantier', 'TGCC', ['Génie Civil'], [3], 'Stage de 1 mois sur un chantier à Casablanca. Découverte de l’organisation de chantier et du suivi de gros œuvre.', 40],
    ['pfe', 'PFE data : maintenance prédictive par machine learning', 'Capgemini Engineering', ['Génie Informatique & IA', 'Mécatronique', 'Génie Électromécanique'], [5], 'Modèles de prédiction de pannes à partir de données capteurs. Python, scikit-learn, notions de vibratoire appréciées.', 25],
    ['etranger', 'Stage de recherche : stockage d’énergie', 'Hydro-Québec', ['Génie Énergétique', 'Génie Électromécanique'], [4, 5], 'Stage de 4 à 6 mois à Montréal au centre de recherche. Visa étudiant à prévoir, je peux vous guider sur la procédure.', 35],
    ['emploi', 'VIE ingénieur qualité fournisseurs (Allemagne)', 'Bosch', ['Mécatronique', 'Génie Industriel'], [6], 'VIE de 18 mois à Stuttgart. Allemand apprécié, anglais courant indispensable.', 29],
    ['stage', 'Stage d’été maintenance éolienne', 'Siemens Gamesa', ['Génie Énergétique', 'Génie Mécanique'], [3, 4], 'Stage de 6 à 8 semaines à l’usine de pales de Tanger. Sécurité, maintenance, contrôle qualité.', 12],
    ['pfe', 'PFE : optimisation énergétique d’un four rotatif', 'LafargeHolcim Maroc', ['Génie Énergétique', 'Génie Industriel'], [5], 'Bilan énergétique, pistes de valorisation de la chaleur perdue, étude technico-économique. Usine de Meknès.', 15],
    ['emploi', 'Ingénieur structures junior (CDI)', 'Vinci Construction', ['Génie Civil'], [6], 'Bureau d’études à Nanterre, dimensionnement béton armé et charpente. Ouvert aux jeunes diplômés avec un PFE en structures.', 44],
    ['stage', 'Stage 4A : supply chain et planification', 'Lear Corporation', ['Génie Industriel'], [4], 'Stage de 2 mois, planification de production et gestion des flux. Excel avancé demandé.', 50],
    ['etranger', 'Stage 4A en électrification (Grenoble)', 'Schneider Electric', ['Génie Électromécanique'], [4], 'Stage de 3 mois sur la qualification de tableaux électriques. Démarches Campus France à anticiper dès janvier.', 22],
    ['pfe', 'PFE : jumeau numérique d’une cellule robotisée', 'Stellantis Kénitra', ['Mécatronique', 'Génie Informatique & IA'], [5], 'Modélisation d’une cellule de soudage robotisée et validation virtuelle des cadences.', 6],
    ['emploi', 'Ingénieur méthodes (CDI)', 'Safran Nacelles', ['Génie Mécanique', 'Génie Industriel'], [6], 'Industrialisation de pièces composites. 0 à 3 ans d’expérience.', 4],
    ['stage', 'Stage ouvrier en atelier d’usinage', 'Spirit AeroSystems', ['Génie Mécanique'], [3], 'Découverte de l’usinage aéronautique et du contrôle dimensionnel. 1 mois en juillet.', 2],
    ['pfe', 'PFE : réseau de chaleur et autoconsommation solaire', 'ONEE', ['Génie Énergétique', 'Génie Électromécanique'], [5], 'Dimensionnement d’une installation photovoltaïque pour un site administratif et étude de rentabilité.', 1],
  ];
  const offerAuthors = seniors.filter(s => s.entreprise);
  for (const [type, titre, ent, fil, an, desc, ago, author] of OFFRES) {
    const e = ENTREPRISES.find(x => x.nom === ent);
    const a = author || offerAuthors.find(s => s.entreprise === ent) || pick(offerAuthors);
    const dl = new Date(now.getTime() + (10 + Math.floor(r() * 60)) * 864e5);
    offers.push({ id: id('o'), author_id: a.id, type, titre, entreprise: ent, ville: e.ville, pays: e.pays, filieres: fil, annees: an, description: desc, contact: a.linkedin || 'Message via la plateforme', lien: '', deadline: ago === 1 ? new Date(now.getTime() + 3 * 864e5).toISOString().slice(0, 10) : dl.toISOString().slice(0, 10), cooptation: r() > 0.5 || a === youssef, remunere: type !== 'stage' || r() > 0.5, duree: type === 'pfe' ? '6 mois' : type === 'emploi' ? 'CDI' : type === 'etranger' ? '4 à 6 mois' : '1 à 2 mois', status: ago > 40 ? 'pourvue' : 'ouverte', created_at: daysAgo(ago, Math.floor(r() * 10)) });
  }
  // Historique : offres des mois précédents, déjà pourvues
  const HIST = { stage: 'Stage technique', pfe: 'PFE', etranger: 'Stage international', emploi: 'Ingénieur junior' };
  for (let i = 0; i < 34; i++) {
    const e = pick(ENTREPRISES); const type = e.pays !== 'Maroc' ? pick(['etranger', 'emploi']) : pick(['stage', 'pfe', 'emploi', 'stage']);
    const a = offerAuthors.find(s => s.entreprise === e.nom) || pick(offerAuthors);
    offers.push({ id: id('o'), author_id: a.id, type, titre: `${HIST[type]} – ${e.fil[0]}`, entreprise: e.nom, ville: e.ville, pays: e.pays, filieres: e.fil, annees: type === 'pfe' ? [5] : type === 'emploi' ? [6] : type === 'etranger' ? [4, 5] : [3, 4], description: 'Offre partagée par un lauréat, désormais pourvue.', contact: 'Message via la plateforme', lien: '', deadline: null, cooptation: r() > 0.6, remunere: true, duree: '', status: 'pourvue', created_at: daysAgo(55 + Math.floor(r() * 300)) });
  }
  const offerOf = t => offers.find(o => o.titre.startsWith(t));

  // ---------------- Placements ----------------
  const placements = [];
  const recruitApps = []; // une candidature « retenue » accompagne chaque recrutement via une offre de la saison
  const place = (st, o) => { placements.push({ id: id('p'), student_id: st.id, offer_id: null, laureat_id: null, source: 'autre', status: 'declare', pays: 'Maroc', merci: null, note: null, confirmed_at: null, ...o }); };
  const fromOffer = (st, off, saison, niveau, extra = {}) => {
    if (saison === S) recruitApps.push({ student_id: st.id, offer_id: off.id, entreprise: off.entreprise, titre: off.titre, created_at: daysAgo(35) });
    place(st, { offer_id: off.id, laureat_id: off.author_id, source: 'plateforme', status: 'confirme', saison, niveau, type: off.type, entreprise: off.entreprise, ville: off.ville, pays: off.pays, confirmed_at: daysAgo(Math.floor(r() * 25) + 1), created_at: daysAgo(30), ...extra });
  };
  const MERCIS = ['Merci infiniment pour la cooptation, l’entretien s’est très bien passé grâce à vos conseils.', 'Votre offre est tombée au bon moment. Merci d’avoir pris le temps de relire mon CV !', 'Grâce à vous j’ai décroché mon stage, je ferai pareil pour les promos suivantes.', 'Merci pour votre disponibilité et vos réponses rapides.'];

  const s5 = students.filter(s => s.promo === S + 1 && s !== salma), s4 = students.filter(s => s.promo === S + 2), s3 = students.filter(s => s.promo === S + 3);
  // Saison en cours
  fromOffer(s5[0], offerOf('PFE : réduction'), S, 5, { merci: MERCIS[0], note: 5 });
  fromOffer(s5[1], offerOf('PFE data'), S, 5, { merci: MERCIS[1], note: 5 });
  fromOffer(s5[2], offerOf('Stage 6 mois'), S, 5, { merci: MERCIS[2], note: 4 });
  fromOffer(s5[3], offerOf('PFE : optimisation'), S, 5, {});
  fromOffer(s5[4], offerOf('PFE : réduction'), S, 5, { status: 'en_attente', confirmed_at: null, created_at: daysAgo(1) });
  fromOffer(s5[5], offerOf('PFE : jumeau'), S, 5, { status: 'en_attente', confirmed_at: null, created_at: daysAgo(2) });
  for (let i = 6; i < 10; i++) { const e = pick(ENTREPRISES); place(s5[i], { saison: S, niveau: 5, type: e.pays === 'Maroc' ? 'pfe' : 'etranger', entreprise: e.nom, ville: e.ville, pays: e.pays, created_at: daysAgo(5 + i * 3) }); }
  fromOffer(s4[0], offerOf('Stage d’été'), S, 4, { merci: MERCIS[3], note: 5 });
  place(s4[1], { saison: S, niveau: 4, type: 'stage', entreprise: 'Lear Corporation', ville: 'Kénitra', created_at: daysAgo(9) });
  place(s4[2], { saison: S, niveau: 4, type: 'etranger', entreprise: 'Valeo', ville: 'Créteil', pays: 'France', created_at: daysAgo(4) });
  place(s3[0], { saison: S, niveau: 3, type: 'stage', entreprise: 'TGCC', ville: 'Casablanca', created_at: daysAgo(6) });
  fromOffer(s3[1], offerOf('Stage ouvrier en atelier'), S, 3, { status: 'en_attente', confirmed_at: null, created_at: daysAgo(0) });
  // Jeunes diplômés : premier emploi
  jeunes.forEach((j, i) => {
    if (i >= 11) return;
    const e = pick(ENTREPRISES);
    if (i < 3) {
      const o = [offerOf('Ingénieur maintenance'), offerOf('Ingénieur méthodes'), offerOf('VIE ingénieur')][i];
      fromOffer(j, o, S, 6, { merci: MERCIS[i % 4], note: 5 }); j.entreprise = o.entreprise; j.poste = o.titre.split(' (')[0]; j.ville = o.ville; j.pays = o.pays;
    } else { place(j, { saison: S, niveau: 6, type: 'emploi', entreprise: e.nom, ville: e.ville, pays: e.pays, created_at: daysAgo(20 + i * 4) }); j.entreprise = e.nom; j.poste = pick(postes); j.ville = e.ville; j.pays = e.pays; }
  });
  // Saison précédente (historique complet)
  const P = S - 1;
  const prevPlace = (st, niveau, frac, viaRate = 0.3) => {
    const e = pick(ENTREPRISES);
    const type = niveau === 6 ? 'emploi' : niveau === 5 ? (e.pays === 'Maroc' ? 'pfe' : 'etranger') : (e.pays === 'Maroc' ? 'stage' : 'etranger');
    const old = offers.filter(o => o.status === 'pourvue' && o.entreprise === e.nom);
    const via = old.length > 0 && r() < viaRate; const off = via ? pick(old) : null;
    place(st, { saison: P, niveau, type, entreprise: e.nom, ville: e.ville, pays: e.pays, source: via ? 'plateforme' : 'autre', offer_id: off?.id || null, laureat_id: off?.author_id || null, status: via ? 'confirme' : 'declare', confirmed_at: via ? seasonDate(P, frac + 0.02) : null, merci: via && r() > 0.5 ? pick(MERCIS) : null, created_at: seasonDate(P, frac) });
  };
  jeunes.forEach((j, i) => prevPlace(j, 5, 0.25 + i * 0.012, 0.35));               // ils étaient en 5A
  s5.concat([salma]).forEach((st, i) => { if (st !== salma && i < 19) prevPlace(st, 4, 0.45 + i * 0.015, 0.3); }); // en 4A
  s4.forEach((st, i) => { if (i < 17) prevPlace(st, 3, 0.5 + i * 0.015, 0.2); });  // en 3A
  precedents.forEach((p, i) => { if (i < 6) prevPlace(p, 6, 0.1 + i * 0.05, 0.3); });
  place(salma, { saison: P, niveau: 4, type: 'stage', entreprise: 'Yazaki Morocco', ville: 'Meknès', created_at: seasonDate(P, 0.6) });

  // ---------------- Interactions ----------------
  const comments = [], reactions = [], applications = [], mentorships = [], questions = [], answers = [], votes = [];
  const COMS = [
    ['etudiant', 'Est-ce que l’offre est ouverte aux étudiants en Génie Électromécanique ?'],
    ['laureat', 'Oui, envoyez votre CV avec un mot sur vos projets. Je fais suivre aux RH cette semaine.'],
    ['etudiant', 'Candidature envoyée, merci pour le partage !'],
    ['etudiant', 'Le stage est-il rémunéré ?'],
    ['laureat', 'Gratification prévue + transport. Le processus RH prend environ 3 semaines.'],
    ['laureat', 'Je confirme, très bonne équipe. J’y ai fait mon PFE en 2019.'],
    ['etudiant', 'Combien de profils vous comptez prendre cette année ?'],
    ['laureat', 'Pensez à préparer un niveau B2 certifié, c’est vérifié pour le visa.'],
  ];
  offers.forEach((o, i) => {
    const k = 1 + Math.floor(r() * 4);
    for (let c = 0; c < k; c++) {
      const [role, body] = COMS[(i + c * 3) % COMS.length];
      const author = role === 'laureat' ? (c % 2 ? offers[i] && profiles.find(p => p.id === o.author_id) : pick(seniors)) : pick(students);
      comments.push({ id: id('c'), offer_id: o.id, author_id: author.id, body, created_at: new Date(new Date(o.created_at).getTime() + (c + 1) * 5 * 36e5).toISOString() });
    }
  });
  reactions.push({ id: id('r'), offer_id: offerOf('Stage 6 mois').id, user_id: salma.id, kind: 'save', created_at: daysAgo(3) });
  reactions.push({ id: id('r'), offer_id: offerOf('Stage de recherche').id, user_id: salma.id, kind: 'save', created_at: daysAgo(2) });

  // Candidatures de Salma (persona) + d'autres
  const MSG = ['Bonjour, je suis en 5A et ce sujet correspond exactement à mon projet de fin d’études. Mon CV est sur mon profil.', 'Bonjour, j’ai fait mon stage de 4A en méthodes et j’aimerais continuer dans cette voie. Disponible pour un appel quand vous voulez.', 'Bonjour, très intéressé(e) par l’offre. J’ai travaillé sur un projet AMDEC au club industrie de l’école.', 'Bonjour, je suis disponible dès février. Merci pour le partage !'];
  for (const a of recruitApps) applications.push({ id: id('a'), ...a, status: 'retenu', message: pick(MSG), note: '', updated_at: a.created_at });
  // Candidatures de Salma (persona)
  applications.push({ id: id('a'), student_id: salma.id, offer_id: offerOf('PFE : réduction').id, entreprise: 'Renault Group Maroc', titre: offerOf('PFE : réduction').titre, status: 'entretien', message: 'Bonjour M. El Amrani, je suis en 5A Génie Industriel. J’ai appliqué la VSM et le SMED pendant mon stage chez Yazaki, et je voudrais en faire mon PFE. Mon CV est en lien sur mon profil.', note: 'Entretien technique jeudi 10h avec le service méthodes', created_at: daysAgo(6), updated_at: daysAgo(1) });
  applications.push({ id: id('a'), student_id: salma.id, offer_id: offerOf('Stage 6 mois').id, entreprise: 'Airbus Operations', titre: offerOf('Stage 6 mois').titre, status: 'postule', message: 'Bonjour, je vise un stage à l’étranger pour mon PFE. Niveau B2 certifié en anglais.', note: '', created_at: daysAgo(4), updated_at: daysAgo(4) });
  applications.push({ id: id('a'), student_id: salma.id, offer_id: null, entreprise: 'Decathlon', titre: 'PFE supply chain (candidature spontanée)', status: 'refuse', note: 'Profil plus logistique recherché', created_at: daysAgo(15), updated_at: daysAgo(8) });
  // Autres candidats, dont plusieurs sur les offres de Youssef (persona lauréat)
  const yOffer = offerOf('PFE : réduction');
  s5.slice(12, 15).forEach((st, i) => applications.push({ id: id('a'), student_id: st.id, offer_id: yOffer.id, entreprise: yOffer.entreprise, titre: yOffer.titre, status: 'postule', message: MSG[(i + 1) % MSG.length], note: '', created_at: daysAgo(i, 2 + i * 3), updated_at: daysAgo(i) }));
  s5.slice(15, 20).forEach((st, i) => { const o = offers[i + 1]; applications.push({ id: id('a'), student_id: st.id, offer_id: o.id, entreprise: o.entreprise, titre: o.titre, status: i % 3 ? 'postule' : 'entretien', message: pick(MSG), note: '', created_at: daysAgo(3 + i), updated_at: daysAgo(1 + i) }); });

  // Mentorat : l'étudiant dit ce dont il a besoin et propose 3 horaires, un lauréat en choisit un
  const mentors = seniors.filter(s => s.mentor_dispo);
  const at = (days, hh, mm = 0) => { const d = new Date(now); d.setDate(d.getDate() + days); d.setHours(hh, mm, 0, 0); return d.toISOString(); };
  const later = (iso, h) => new Date(Date.parse(iso) + h * 36e5).toISOString();
  const ms = o => { const m = { id: id('m'), besoin: 'stage', message: '', creneaux: [], rdv_at: null, accepted_at: null, reponse: null, merci: null, note: null, ...o }; mentorships.push(m); return m; };
  ms({ student_id: s5[11].id, mentor_id: youssef.id, besoin: 'entretien', sujet: 'Préparer un entretien technique en méthodes', message: 'Bonjour, j’ai un entretien chez un équipementier automobile la semaine prochaine. Pourriez-vous m’aider à me préparer ?', status: 'demande', creneaux: [at(1, 18, 30), at(2, 12, 30), at(3, 19, 0)], created_at: daysAgo(0, 3) });
  ms({ student_id: s4[3].id, mentor_id: youssef.id, besoin: 'stage', sujet: 'Choisir entre deux stages de 4A', message: 'J’hésite entre un stage en qualité et un stage en méthodes.', status: 'terminee', created_at: daysAgo(20), accepted_at: daysAgo(20, 6), rdv_at: daysAgo(18, -8), note: 5, merci: 'Merci pour l’appel, j’ai choisi les méthodes et je ne regrette pas !' });
  ms({ student_id: s5[7].id, mentor_id: youssef.id, besoin: 'cv', sujet: 'Relire mon CV pour l’automobile', status: 'acceptee', created_at: daysAgo(5), accepted_at: daysAgo(4), rdv_at: at(-1, 18, 30) });
  mentors.slice(1).forEach((m, i) => {
    const st = pick(students);
    const sujet = pick(['Procédure Campus France', 'Préparer un entretien', 'Choisir mon sujet de PFE', 'Négocier un premier salaire', 'Trouver un stage à l’étranger']);
    const besoin = /France|étranger/.test(sujet) ? 'etranger' : /entretien/.test(sujet) ? 'entretien' : /salaire/.test(sujet) ? 'carriere' : 'stage';
    const created_at = daysAgo(8 + i * 4);
    ms({ student_id: st.id, mentor_id: m.id, besoin, sujet, status: i % 3 === 0 ? 'acceptee' : 'terminee', created_at, accepted_at: later(created_at, 5 + i % 4 * 9), rdv_at: i % 3 === 0 ? at(3 + i % 5, 18, 30) : later(created_at, 50), note: i % 3 ? 4 + i % 2 : null, merci: i % 3 ? 'Merci beaucoup pour vos conseils !' : null });
  });

  // Entraide
  const QS = [
    ['Étranger & visas', 'Quand commencer la procédure Campus France pour un stage de 5A en France ?', 'Je vise un stage à partir de février. Quels documents préparer et combien de temps ça prend en pratique ?', [
      ['laureat', 'Commence dès octobre. Il faut la convention de stage signée, le relevé de notes traduit si besoin et une preuve de ressources. Compte 6 à 8 semaines au total avec le rendez-vous visa.'],
      ['laureat', 'Ajoute aussi l’attestation de logement, c’est ce qui m’a bloqué deux semaines.'],
      ['etudiant', 'Merci ! Est-ce que le relevé de 4A suffit ?']]],
    ['PFE', 'Comment choisir entre un PFE en R&D et un PFE en production ?', 'J’ai deux propositions et je ne sais pas laquelle aide le plus pour un premier emploi.', [
      ['laureat', 'Pense au premier poste que tu veux. La production embauche plus vite au Maroc, la R&D ouvre plus de portes à l’étranger. Dans les deux cas, ce qui compte c’est un résultat chiffré à mettre sur ton CV.'],
      ['laureat', 'Regarde aussi qui sera ton encadrant en entreprise. Un bon encadrant vaut plus que le sujet.']]],
    ['CV & entretiens', 'Faut-il mettre les projets du cycle prépa sur le CV ?', '', [
      ['laureat', 'Non, sauf s’ils sont vraiment techniques. Garde la place pour tes stages de 3A et 4A et les projets du cycle ingénieur.']]],
    ['Premier emploi', 'Quel salaire demander pour un premier poste d’ingénieur à Casablanca ?', 'Pour un CDI en industrie, quelle fourchette est raisonnable en 2026 ?', [
      ['laureat', 'Dans l’industrie, la fourchette la plus courante que je vois pour un débutant reste entre 9 000 et 12 000 DH net, plus selon les primes. Les multinationales de l’automobile et de l’aéronautique sont souvent au-dessus.']]],
    ['Stage', 'Des entreprises à Meknès qui prennent des stagiaires de 3A ?', 'Je cherche un stage ouvrier proche de l’école.', []],
    ['Vie à l’école', 'Le club robotique cherche des lauréats pour un parrainage', 'On prépare la compétition nationale et on cherche des conseils et un sponsor.', [
      ['laureat', 'Contactez-moi, notre entreprise sponsorise déjà deux clubs, on peut regarder.']]],
  ];
  QS.forEach(([cat, titre, body, ans], qi) => {
    const author = pick(students);
    const q = { id: id('q'), author_id: author.id, categorie: cat, titre, body, best_answer_id: null, created_at: daysAgo(2 + qi * 4) };
    questions.push(q);
    ans.forEach(([role, txt], ai) => {
      const a = { id: id('ans'), question_id: q.id, author_id: role === 'laureat' ? (qi === 0 && ai === 0 ? youssef.id : pick(seniors).id) : author.id, body: txt, created_at: new Date(new Date(q.created_at).getTime() + (ai + 1) * 3 * 36e5).toISOString() };
      answers.push(a);
      const nv = role === 'laureat' ? 2 + Math.floor(r() * 9) : 0;
      const vs = new Set(); for (let v = 0; v < nv; v++) vs.add(pick(students).id);
      for (const uid of vs) votes.push({ id: id('v'), answer_id: a.id, user_id: uid, created_at: a.created_at });
      if (ai === 0 && role === 'laureat' && qi % 2 === 0) q.best_answer_id = a.id;
    });
  });

  // ---------------- Phase 1 : vivier, mentorat, réussites ----------------
  // Générateur à part pour ne pas changer les données ci-dessus.
  const r2 = rng(1532); const pick2 = a => a[Math.floor(r2() * a.length)];
  const COMP = {
    'Génie Mécanique': ['CATIA', 'SolidWorks', 'RDM', 'Ansys', 'Fabrication', 'Cotation GPS'],
    'Génie Industriel': ['Lean', 'VSM', 'SMED', 'Power BI', 'Supply chain', 'Six Sigma'],
    'Génie Électromécanique': ['Automatisme', 'Siemens TIA', 'Maintenance', 'AMDEC', 'Électrotechnique'],
    'Génie Civil': ['Robot Structural', 'Revit', 'Béton armé', 'Métré', 'AutoCAD'],
    'Génie Énergétique': ['Thermique', 'PVsyst', 'Bilan énergétique', 'Matlab', 'Froid industriel'],
    'Génie Informatique & IA': ['Python', 'Machine learning', 'SQL', 'React', 'Docker'],
    'Mécatronique': ['Arduino', 'ROS', 'Simulink', 'Capteurs', 'Python'],
  };
  const DISPO = { 3: ['Juillet à août', 'Tout le mois de juillet'], 4: ['Juillet à septembre', 'Dès juin'], 5: ['Dès février', 'Dès janvier, 6 mois'] };
  for (const st of students) {
    if (st === salma) { st.disponibilite = 'Dès février, 6 mois'; st.cv_url = 'https://example.com/cv/salma-bennani.pdf'; continue; }
    const pool = COMP[st.filiere] || ['Python'];
    st.competences = [...new Set([pick2(pool), pick2(pool), pick2(pool)])];
    const niv = 5 - (st.promo - (S + 1));
    st.disponibilite = pick2(DISPO[niv] || ['À discuter']);
    if (r2() > 0.4) st.cv_url = `https://example.com/cv/${st.full_name.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').replace(/ +/g, '-')}.pdf`;
  }

  // Mentorat de Youssef et de Salma, demandes ouvertes à tous les lauréats
  ms({ student_id: s5[9].id, mentor_id: youssef.id, besoin: 'entretien', sujet: 'Préparer un entretien chez Lear', message: 'Entretien technique la semaine prochaine, je voudrais m’entraîner.', status: 'acceptee', creneaux: [at(2, 18, 30)], created_at: daysAgo(1, 8), accepted_at: daysAgo(1, 4), rdv_at: at(2, 18, 30) });
  ms({ student_id: s4[4].id, mentor_id: youssef.id, besoin: 'stage', sujet: 'Choisir mon stage de 4A', status: 'terminee', created_at: daysAgo(8), accepted_at: daysAgo(8, 4), rdv_at: at(-6, 18, 30), note: 5, merci: 'Vingt minutes qui m’ont fait gagner un mois de recherche. Merci !' });
  ms({ student_id: s5[8].id, mentor_id: youssef.id, besoin: 'cv', sujet: 'Relire mon CV pour l’automobile', status: 'terminee', created_at: daysAgo(5), accepted_at: daysAgo(5, 7), rdv_at: at(-3, 12, 30), note: 4 });
  const exp = mentors.slice(1, 6);
  ms({ student_id: salma.id, mentor_id: exp[0].id, besoin: 'etranger', sujet: 'Stage à l’étranger : par où commencer ?', message: 'Je vise un PFE en Europe à partir de février. Je ne sais pas par quoi commencer.', status: 'acceptee', creneaux: [at(1, 18, 30), at(2, 13, 0)], created_at: daysAgo(2), accepted_at: daysAgo(1, 9), rdv_at: at(1, 18, 30) });
  for (let i = 0; i < 5; i++) {
    const created_at = daysAgo(6 + i * 5);
    ms({ student_id: pick2(students.filter(x => x !== salma)).id, mentor_id: exp[1].id, besoin: 'stage', sujet: pick2(['Mon premier entretien', 'Choisir ma filière de PFE', 'Le VIE, comment ça marche ?']), status: 'terminee', created_at, accepted_at: later(created_at, 3), rdv_at: later(created_at, 30), note: 5, merci: i < 2 ? 'Merci pour ce moment, très clair !' : null });
  }
  // Demandes ouvertes : n'importe quel lauréat peut les prendre
  const meca = students.filter(x => x.filiere === 'Génie Mécanique' && x !== salma && x.promo <= S + 2 && ![s5[11], s5[9], s5[7], s4[4]].includes(x));
  const OPEN = [
    [meca[0], 'stage', 'Trouver un PFE dans l’automobile', 'Je cherche un sujet en méthodes ou en industrialisation, idéalement à Tanger ou Kénitra.', 0, 6],
    [meca[1], 'entretien', 'Simuler un entretien en bureau d’études', 'Premier entretien technique bientôt, je ne sais pas quelles questions on pose.', 1, 2],
    [s5[13], 'etranger', 'Partir en VIE après le diplôme', 'Comment ça marche concrètement, et quelles entreprises en proposent ?', 2, 20],
    [s4[6], 'cv', 'Mon CV pour un stage de 4A', 'C’est mon premier vrai CV, j’aimerais un regard d’ingénieur.', 0, 9],
  ];
  for (const [st, besoin, sujet, message, dd, hh] of OPEN) if (st) ms({ student_id: st.id, mentor_id: null, besoin, sujet, message, status: 'demande', creneaux: [at(1, 18, 30), at(2, 12, 30), at(4, 19, 0)], created_at: daysAgo(dd, hh) });

  const hex = () => Array.from({ length: 12 }, () => '0123456789abcdef'[Math.floor(r2() * 16)]).join('');
  const liens_rdv = mentorships.filter(m => m.status === 'acceptee' || m.status === 'terminee').map(m => ({ id: m.id, lien: `https://meet.jit.si/ReseauENSAM-${hex()}`, created_at: m.accepted_at || m.created_at }));
  const annonces = [{ id: id('an'), author_id: admin.id, texte: 'Nouveau : besoin d’un conseil ? Demande l’aide d’un lauréat en une minute. Dès qu’il accepte, le rendez-vous en visio et l’invitation agenda sont prêts.', lien: null, active: true, created_at: daysAgo(1) }];

  const shortlists = [
    { id: id('sh'), laureat_id: youssef.id, student_id: s5[10].id, note: 'Profil lean, à rappeler en janvier', created_at: daysAgo(5) },
    { id: id('sh'), laureat_id: youssef.id, student_id: s5[16].id, note: '', created_at: daysAgo(2) },
  ];
  const lafarge = offerOf('PFE : optimisation');
  const invitations = [
    { id: id('in'), laureat_id: youssef.id, student_id: s5[10].id, offer_id: yOffer.id, message: 'Ton expérience en lean m’intéresse pour ce sujet. Postule si ça te parle !', status: 'envoyee', created_at: daysAgo(1, 4) },
    { id: id('in'), laureat_id: lafarge.author_id, student_id: salma.id, offer_id: lafarge.id, message: 'Bonjour Salma, ton profil lean et Power BI colle bien à ce sujet à Meknès. Je serais ravi de recevoir ta candidature.', status: 'envoyee', created_at: daysAgo(0, 5) },
  ];

  const kudos = [];
  const fans = profiles.filter(p => p.role !== 'admin' && !p._persona);
  for (const pl of placements.filter(x => x.saison === S && (x.status === 'confirme' || x.status === 'declare'))) {
    const k = Math.floor(r2() * 7); const who = new Set();
    for (let i = 0; i < k; i++) who.add(pick2(fans).id);
    for (const uid of who) if (uid !== pl.student_id) kudos.push({ id: id('k'), placement_id: pl.id, user_id: uid, created_at: pl.confirmed_at || pl.created_at });
  }

  // ---------------- Phase 2 : annuaire pro, groupes, cafés, startups, défis, parrainage ----------------
  // Générateur à part pour ne pas changer les données ci-dessus.
  const r3 = rng(2027); const pick3 = a => a[Math.floor(r3() * a.length)];
  const SECT = { 'Renault Group Maroc': 'Automobile', 'Stellantis Kénitra': 'Automobile', 'Lear Corporation': 'Automobile', 'Yazaki Morocco': 'Automobile', Valeo: 'Automobile', Bosch: 'Automobile', 'OCP Group': 'Mines & chimie', 'Safran Nacelles': 'Aéronautique', 'Spirit AeroSystems': 'Aéronautique', 'Airbus Operations': 'Aéronautique', 'Siemens Gamesa': 'Énergie', ONEE: 'Énergie', 'Hydro-Québec': 'Énergie', 'Schneider Electric': 'Énergie', 'Capgemini Engineering': 'Conseil & IT', 'LafargeHolcim Maroc': 'BTP & immobilier', TGCC: 'BTP & immobilier', 'Vinci Construction': 'BTP & immobilier' };
  for (const p of profiles) {
    Object.assign(p, { langue: 'fr', emails_hebdo: true, consent_at: p.created_at, parrain_dispo: false });
    if (p.role === 'laureat' && p.entreprise) p.secteur = SECT[p.entreprise] || 'Industrie';
  }
  youssef.parrain_dispo = true;
  for (const x of seniors) if (x !== youssef && r3() > 0.45) x.parrain_dispo = true;
  for (const x of jeunes) if (r3() > 0.7) x.parrain_dispo = true;
  const lau = profiles.filter(p => p.role === 'laureat' && !p._persona);
  const inCity = v => lau.filter(p => p.ville === v);

  // Deux étudiants inscrits cette semaine (alerte talents des lauréats de Génie Mécanique)
  for (const [promo, comp, d] of [[S + 2, ['CATIA', 'RDM', 'Usinage'], 2], [S + 1, ['Ansys', 'SolidWorks', 'Python'], 4]]) {
    const p = mk({ full_name: name(), role: 'etudiant', filiere: 'Génie Mécanique', promo, ville: pick3(['Meknès', 'Fès', 'Tanger']), competences: comp, disponibilite: promo === S + 1 ? 'Dès février, 6 mois' : 'Juillet à septembre', cv_url: 'https://example.com/cv/nouveau-' + d + '.pdf', created_at: daysAgo(d), langue: 'fr', emails_hebdo: true, consent_at: daysAgo(d), parrain_dispo: false });
    students.push(p);
  }
  // Parrains des 3A (Amine, persona 3A, reçoit le sien à sa première visite)
  const parrainages = [];
  for (const st of s3) {
    const cap = x => (x === youssef ? 2 : 3);
    const l = profiles.filter(x => x.role === 'laureat' && x.parrain_dispo && x.filiere === st.filiere && parrainages.filter(y => y.parrain_id === x.id).length < cap(x))
      .sort((a, b) => b.verified - a.verified)[0];
    if (l) parrainages.push({ id: id('pa'), filleul_id: st.id, parrain_id: l.id, saison: S, created_at: daysAgo(30 + Math.floor(r3() * 10)) });
  }

  // Offres entre lauréats, et une offre de Youssef sans nouvelles depuis un mois (relance douce)
  const stell = lau.find(p => p.entreprise === 'Stellantis Kénitra') || pick3(lau);
  const ocp = lau.find(p => p.entreprise === 'OCP Group') || pick3(lau);
  offers.push({ id: id('o'), author_id: stell.id, audience: 'laureats', type: 'emploi', titre: 'Responsable de production (5 ans d’expérience)', entreprise: 'Stellantis Kénitra', ville: 'Kénitra', pays: 'Maroc', filieres: ['Génie Industriel', 'Génie Mécanique'], annees: [], description: 'Pilotage d’un atelier de 120 personnes, objectifs sécurité, qualité, coûts. Je recommande directement les lauréats intéressés au directeur d’usine.', contact: 'Message via la plateforme', lien: '', deadline: null, cooptation: true, remunere: true, duree: 'CDI', status: 'ouverte', created_at: daysAgo(3) });
  offers.push({ id: id('o'), author_id: ocp.id, audience: 'laureats', type: 'emploi', titre: 'Chef de projet maintenance (3 à 8 ans)', entreprise: 'OCP Group', ville: 'Jorf Lasfar', pays: 'Maroc', filieres: ['Génie Électromécanique', 'Génie Énergétique'], annees: [], description: 'Projet de fiabilisation des unités d’acide sulfurique. Expérience en maintenance industrielle demandée.', contact: 'Message via la plateforme', lien: '', deadline: null, cooptation: true, remunere: true, duree: 'CDI', status: 'ouverte', created_at: daysAgo(8) });
  offers.push({ id: id('o'), author_id: youssef.id, audience: 'etudiants', type: 'stage', titre: 'Stage 4A : maintenance des presses', entreprise: 'Renault Group Maroc', ville: 'Tanger', pays: 'Maroc', filieres: ['Génie Mécanique', 'Génie Électromécanique'], annees: [4], description: 'Stage de 2 mois cet été sur la maintenance préventive des presses d’emboutissage.', contact: 'Message via la plateforme', lien: '', deadline: null, cooptation: true, remunere: true, duree: '2 mois', status: 'ouverte', created_at: daysAgo(26) });
  // Banque de sujets PFE : de vrais problèmes déposés par des lauréats qui encadrent
  const giEnc = lau.find(p => p.filiere === 'Génie Industriel' && p !== youssef && p !== stell) || pick3(lau);
  const sujet = (author, titre, ent, ville, fil, desc, ago) => offers.push({ id: id('o'), author_id: author.id, audience: 'etudiants', type: 'pfe', titre, entreprise: ent, ville, pays: 'Maroc', filieres: fil, annees: [5], description: desc, contact: 'Message via la plateforme', lien: '', deadline: null, cooptation: true, remunere: true, duree: '6 mois', status: 'ouverte', created_at: daysAgo(ago, 3) });
  sujet(giEnc, 'PFE : déployer le Lean sur une ligne de câblage', 'Yazaki Morocco', 'Meknès', ['Génie Industriel'], 'Notre ligne perd 12 % de TRS sur les arrêts courts. Le sujet : cartographie VSM, chantiers SMED et 5S, suivi des gains sur 6 mois. Je t’encadre côté entreprise.', 4);
  sujet(stell, 'PFE : réduire le temps de changement de série en ferrage', 'Stellantis Kénitra', 'Kénitra', ['Génie Industriel', 'Génie Mécanique'], 'Changement de série de 45 minutes aujourd’hui, objectif 20. Analyse SMED, standardisation et formation des équipes.', 7);
  sujet(ocp, 'PFE : tableau de bord qualité en temps réel', 'OCP Group', 'Jorf Lasfar', ['Génie Industriel', 'Génie Informatique & IA'], 'Les données qualité sont dans trois fichiers Excel différents. Le sujet : un tableau de bord Power BI branché sur la production, avec alertes.', 11);
  for (const o of offers) o.audience ||= 'etudiants';

  // Questions routées : vers les lauréats de Renault, et vers ceux qui vivent en France
  const qR = { id: id('q'), author_id: s4[5].id, categorie: 'Stage', titre: 'Comment se passe le recrutement des stagiaires chez Renault à Tanger ?', body: 'Entretien technique, test, ou seulement le CV ? Je prépare ma candidature pour cet été.', entreprise: 'Renault', pays: null, best_answer_id: null, created_at: daysAgo(1, 5) };
  const qF = { id: id('q'), author_id: s5[6].id, categorie: 'Étranger & visas', titre: 'Où se loger à Toulouse pour un stage de 6 mois ?', body: 'Résidence, colocation ? Quel budget prévoir ?', entreprise: null, pays: 'France', best_answer_id: null, created_at: daysAgo(3, 2) };
  questions.push(qR, qF);
  const enFrance = lau.find(p => p.pays === 'France');
  if (enFrance) answers.push({ id: id('ans'), question_id: qF.id, author_id: enFrance.id, body: 'Regarde les résidences du CROUS et les colocations près des lignes de métro. Compte 450 à 600 € par mois.', created_at: daysAgo(2, 20) });

  // Groupes par filière, par ville et à l'étranger
  const groupe_messages = []; const gm = (groupe, author, body, d, h = 10) => groupe_messages.push({ id: id('g'), groupe, author_id: author.id, body, created_at: daysAgo(d, h) });
  const gi = lau.filter(p => p.filiere === 'Génie Industriel');
  gm('filiere:genie industriel', gi[0] || youssef, 'Bonjour à tous ! Qui est sur une mission lean en ce moment ? Je cherche des retours sur le déploiement du TPM.', 6);
  gm('filiere:genie industriel', salma, 'Bonjour, je prépare mon PFE en excellence opérationnelle. Si quelqu’un a un sujet en tête, je suis preneuse !', 3);
  gm('filiere:genie industriel', gi[1] || youssef, 'Salma, envoie-moi ton CV en message, on ouvre deux sujets en supply chain en février.', 2, 4);
  gm('filiere:genie mecanique', youssef, 'Rappel aux 3A : les candidatures pour les stages ouvriers d’été commencent maintenant. N’attendez pas avril.', 4);
  gm('pays:france', enFrance || youssef, 'Pour ceux qui arrivent en France cette année : ouvrez un compte bancaire en ligne avant de partir, ça simplifie tout.', 9);
  gm('pays:france', salma, 'Merci ! Et pour la CAF, il faut combien de temps ?', 8);
  gm('pays:france', enFrance || youssef, 'Environ 6 semaines après la demande. Faites-la dès la signature du bail.', 8, 2);
  const casa = inCity('Casablanca');
  if (casa[0]) gm('ville:casablanca', casa[0], 'Afterwork ENSAM à Casa le mois prochain ? Je regarde un lieu à Maârif.', 5);
  if (casa[1]) gm('ville:casablanca', casa[1], 'Partant ! Je ramène deux collègues de la promo 2018.', 5, 6);
  gm('ville:tanger', youssef, 'Café ENSAM à Tanger bientôt, inscrivez-vous dans l’onglet Groupes.', 2);
  const groupe_membres = [{ id: id('gmb'), groupe: 'pays:france', user_id: salma.id, created_at: daysAgo(10) }];

  // Cafés ENSAM (dont un à Meknès, la ville de Salma)
  const cafes = [], cafe_participants = [];
  const at3 = (days, hh, mm = 0) => { const d = new Date(now); d.setDate(d.getDate() + days); d.setHours(hh, mm, 0, 0); return d.toISOString(); };
  const cafe = (org, ville, pays, lieu, date_at, message, nb, places = null) => {
    const c = { id: id('cf'), organisateur_id: org.id, ville, pays, lieu, date_at, message, places, annule: false, created_at: daysAgo(4) };
    cafes.push(c);
    const who = [org, ...lau.filter(p => p.ville === ville && p !== org), ...students.filter(p => p.ville === ville)].slice(0, nb);
    for (const p of who) cafe_participants.push({ id: id('cp'), cafe_id: c.id, user_id: p.id, created_at: daysAgo(3) });
    return c;
  };
  const mek = inCity('Meknès')[0] || youssef;
  cafe(mek, 'Meknès', 'Maroc', 'Café de la place El Hedim', at3(3, 18, 0), 'Un café entre lauréats et étudiants, juste à côté de l’école. Venez avec vos questions sur les stages !', 6, 15);
  if (casa[0]) cafe(casa[0], 'Casablanca', 'Maroc', 'Maârif, près du boulevard Al Massira', at3(6, 19, 0), 'Afterwork ENSAM : on se retrouve après le travail, toutes les promos sont les bienvenues.', 8, 25);
  cafe(youssef, 'Tanger', 'Maroc', 'Café Hafa', at3(10, 18, 30), 'Premier café ENSAM à Tanger. Thé à la menthe et retours d’expérience sur l’automobile.', 5);
  const pastCafe = { id: id('cf'), organisateur_id: (inCity('Rabat')[0] || youssef).id, ville: 'Rabat', pays: 'Maroc', lieu: 'Agdal', date_at: daysAgo(25, -9), message: '', places: null, annule: false, created_at: daysAgo(40) };
  cafes.push(pastCafe); cafe_participants.push({ id: id('cp'), cafe_id: pastCafe.id, user_id: pastCafe.organisateur_id, created_at: daysAgo(40) });

  // Startups fondées par des lauréats
  const founders = lau.filter(p => p.promo < S - 2);
  const startups = [
    { nom: 'Atlas Robotics', pitch: 'Cellules robotisées clé en main pour les PME industrielles marocaines : soudage, palettisation, contrôle par vision.', secteur: 'Industrie', ville: 'Casablanca', site: 'https://atlas-robotics.example', recrute: true },
    { nom: 'Sunwise', pitch: 'Suivi en temps réel des centrales solaires sur téléphone, alertes de panne et rapport mensuel automatique.', secteur: 'Énergie', ville: 'Marrakech', site: 'https://sunwise.example', recrute: false },
    { nom: 'BatiScan', pitch: 'Métrés et suivi d’avancement de chantier à partir de simples photos, pour les bureaux d’études et les entreprises du BTP.', secteur: 'BTP & immobilier', ville: 'Rabat', site: 'https://batiscan.example', recrute: true },
  ].map((x, i) => ({ id: id('st'), fondateur_id: (founders[i * 3] || youssef).id, pays: 'Maroc', created_at: daysAgo(20 + i * 15), ...x }));

  // Défis de la saison (lancés par l'administration)
  const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const defis = [
    { id: id('df'), titre: `${MOIS[now.getMonth()]} : 10 stages trouvés pour les 4A`, mesure: 'stages', niveau: 4, cible: 10, debut: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), fin: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)), created_at: daysAgo(15) },
    { id: id('df'), titre: 'Cette saison : 40 mentorats terminés', mesure: 'mentorats', niveau: null, cible: 40, debut: ymd(new Date(S, 8, 1)), fin: ymd(new Date(S + 1, 5, 30)), created_at: daysAgo(40) },
  ];

  const base = { profiles, offers, comments, reactions, applications, placements, mentorships, questions, answers, votes, shortlists, invitations, kudos, attestations: [], liens_rdv, annonces, groupe_messages, groupe_membres, cafes, cafe_participants, startups, defis, parrainages };
  const phase3 = seedPhase3(base, S, now);
  return { ...base, ...phase3, ...seedMessages({ ...base, ...phase3 }, now) };
}
