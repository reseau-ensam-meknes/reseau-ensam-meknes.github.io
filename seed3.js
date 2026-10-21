// Données de démonstration de la Phase 3 (fictives) : CV et relectures, entretiens, avis de stage,
// guide de l'étranger, coordonnées, signalements, enquête d'insertion, agenda, liste officielle.
import { cleNom } from './logic.js';

export function seedPhase3(base, S, now = new Date()) {
  let n = 0; const id = p => `${p}3-${(++n).toString(36).padStart(4, '0')}`;
  const daysAgo = (d, h = 10) => new Date(now.getTime() - d * 864e5 - h * 36e5).toISOString();
  const inDays = (d, h = 9) => { const x = new Date(now.getTime() + d * 864e5); x.setHours(h, 0, 0, 0); return x.toISOString(); };
  const P = base.profiles;
  const persona = k => P.find(p => p._persona && p._persona.includes(k));
  const salma = persona('Salma'), youssef = persona('Youssef'), admin = P.find(p => p.role === 'admin');
  const lau = P.filter(p => p.role === 'laureat' && !p._persona);
  const etu5 = P.filter(p => p.role === 'etudiant' && p.promo === S + 1 && p !== salma);
  const etu4 = P.filter(p => p.role === 'etudiant' && p.promo === S + 2);
  const mk = o => { const p = { id: id('u'), pays: 'Maroc', competences: [], vitrine: true, verified: false, mentor_dispo: false, visibilite: {}, created_at: daysAgo(3), ...o }; P.push(p); return p; };

  // Une jeune lauréate pour essayer l'enquête d'insertion, deux lauréats de la promo de Youssef
  mk({ full_name: 'Hajar Lamrani', role: 'laureat', filiere: 'Génie Industriel', promo: S - 1, entreprise: 'Lear Corporation', poste: 'Ingénieure qualité', ville: 'Kénitra', verified: true, created_at: daysAgo(200), _persona: `Jeune lauréate ${S - 1} · Hajar` });
  const hamid = mk({ full_name: 'Hamid Squalli', role: 'laureat', filiere: 'Génie Mécanique', promo: youssef.promo, entreprise: 'Safran Nacelles', poste: 'Chef de projet', ville: 'Casablanca', verified: true, created_at: daysAgo(150) });
  const rachid = mk({ full_name: 'Rachid Benali', role: 'laureat', filiere: 'Génie Mécanique', promo: youssef.promo, entreprise: 'Stellantis Kénitra', poste: 'Ingénieur process', ville: 'Kénitra', created_at: daysAgo(2) });

  // Lauréats installés à l'étranger (pour le guide) : ceux du jeu de données, sinon on en installe
  const abroad = pays => lau.find(p => p.pays === pays) || Object.assign(lau.find(p => p.pays === 'Maroc' && !p._abroad), { pays, ville: { France: 'Lyon', Allemagne: 'Stuttgart', Canada: 'Montréal' }[pays], _abroad: true });
  const enFrance = abroad('France'), enAllemagne = abroad('Allemagne'), auCanada = abroad('Canada');

  // ---------------- Coordonnées et demandes de contact ----------------
  const coordonnees = [
    { id: youssef.id, telephone: '06 12 34 56 78', email: 'y.elamrani@exemple.ma', contact: 'WhatsApp au même numéro, plutôt le soir', created_at: daysAgo(60), updated_at: daysAgo(60) },
    { id: salma.id, telephone: '06 98 76 54 32', email: 'salma.bennani@exemple.ma', contact: null, created_at: daysAgo(30), updated_at: daysAgo(30) },
    { id: enFrance.id, telephone: '+33 6 11 22 33 44', email: null, contact: 'LinkedIn de préférence', created_at: daysAgo(90), updated_at: daysAgo(90) },
    { id: hamid.id, telephone: '06 55 44 33 22', email: null, contact: null, created_at: daysAgo(80), updated_at: daysAgo(80) },
  ];
  const demandes_contact = [
    { id: id('dc'), demandeur_id: salma.id, cible_id: youssef.id, message: 'Bonjour, je prépare un PFE en méthodes et j’aimerais vous poser deux questions.', status: 'acceptee', created_at: daysAgo(12), repondu_at: daysAgo(11) },
    { id: id('dc'), demandeur_id: etu5[3].id, cible_id: youssef.id, message: 'Bonjour, pourrais-je avoir votre numéro pour un conseil sur l’emboutissage ?', status: 'envoyee', created_at: daysAgo(1), repondu_at: null },
    { id: id('dc'), demandeur_id: salma.id, cible_id: enFrance.id, message: 'Je vise un stage en France, j’aimerais échanger avec vous.', status: 'envoyee', created_at: daysAgo(2), repondu_at: null },
  ];

  // ---------------- CV et relectures ----------------
  salma.cv_path = `${salma.id}/cv-demo.pdf`; salma.cv_maj = daysAgo(9);
  const autreCv = etu5[0]; autreCv.cv_path = `${autreCv.id}/cv-demo.pdf`; autreCv.cv_maj = daysAgo(2);
  const direct = etu4[1]; direct.cv_path = `${direct.id}/cv-demo.pdf`; direct.cv_maj = daysAgo(1);
  const r1 = { id: id('rc'), student_id: salma.id, reviewer_id: youssef.id, cv_path: salma.cv_path, message: 'Je vise un PFE en excellence opérationnelle. Mon CV est-il assez clair ?', status: 'rendue', synthese: 'Bon CV, bien structuré. Mets tes résultats chiffrés en avant et remonte ton projet Lean en haut de page.', merci: null, note: null, created_at: daysAgo(9), pris_at: daysAgo(8), rendue_at: daysAgo(7) };
  const relectures_cv = [
    r1,
    { id: id('rc'), student_id: autreCv.id, reviewer_id: null, cv_path: autreCv.cv_path, message: 'Premier CV pour un PFE en data, merci d’avance !', status: 'demandee', synthese: null, merci: null, note: null, created_at: daysAgo(1), pris_at: null, rendue_at: null },
    { id: id('rc'), student_id: direct.id, reviewer_id: youssef.id, cv_path: direct.cv_path, message: 'Pour un stage 4A dans l’automobile.', status: 'demandee', synthese: null, merci: null, note: null, created_at: daysAgo(0, 3), pris_at: null, rendue_at: null },
  ];
  const relecture_commentaires = [
    ['experience', 'Pour ton stage chez Yazaki, donne le résultat : « TRS +6 points en 2 mois » parle plus qu’une liste de tâches.'],
    ['profil', 'Ton accroche est bonne. Ajoute le type de PFE que tu cherches et la date de début.'],
    ['mise_en_page', 'Une seule page, c’est parfait. Évite les barres de niveau pour les langues : écris B2, C1.'],
  ].map(([section, body], i) => ({ id: id('cm'), relecture_id: r1.id, author_id: youssef.id, section, body, created_at: daysAgo(7, 12 - i) }));

  // ---------------- Banque d'entretiens ----------------
  const auteurs = [...etu5.slice(4, 10), ...etu4.slice(2, 6), ...lau.filter(p => p.promo === S)];
  let a = 0; const auteur = () => auteurs[(a++) % auteurs.length].id;
  const ENT = [
    ['Renault Group Maroc', 'PFE méthodes', 'pfe', 'presentiel', 3, 'retenu', false, ['Présente ton parcours en 2 minutes.', 'Qu’est-ce que l’emboutissage et quels défauts connais-tu ?', 'Comment calcules-tu un TRS ?', 'Raconte un problème que tu as résolu avec une méthode structurée (8D, Ishikawa).', 'Pourquoi Renault et pas Stellantis ?'], 'Un entretien RH puis un entretien technique avec le futur tuteur, le même jour. Visite d’atelier à la fin.', 'Révise les bases du Lean et prépare un exemple chiffré de ton stage 4A.'],
    ['Renault Group Maroc', 'Stage 4A logistique', 'stage', 'visio', 2, 'refuse', true, ['Parle-nous de ton projet de 3A.', 'Qu’est-ce qu’un kanban ?', 'Es-tu disponible tout l’été à Tanger ?'], 'Visio de 30 minutes avec deux personnes du service logistique.', 'Sois précis sur tes dates de disponibilité.'],
    ['OCP Group', 'Ingénieur maintenance', 'emploi', 'presentiel', 4, 'attente', false, ['Différence entre maintenance préventive et conditionnelle ?', 'Comment organiserais-tu un arrêt technique ?', 'Analyse vibratoire : que regardes-tu en premier ?', 'Où te vois-tu dans 5 ans ?'], 'Test écrit technique d’une heure, puis entretien avec un jury de trois personnes.', 'Le test écrit compte beaucoup : refais des exercices de RDM et d’électrotechnique.'],
    ['OCP Group', 'Stage 3A ouvrier', 'stage', 'telephone', 1, 'retenu', true, ['Pourquoi ce stage ?', 'As-tu tes EPI ?'], 'Appel de 10 minutes, très simple.', 'Envoie ta demande tôt, les places partent dès février.'],
    ['Stellantis Kénitra', 'PFE jumeau numérique', 'pfe', 'visio', 4, 'retenu', false, ['Explique un projet de simulation que tu as mené.', 'Quels logiciels de simulation connais-tu ?', 'Comment validerais-tu une cadence virtuelle ?', 'Questions en anglais sur ta motivation.'], 'Deux visios : RH puis équipe technique. Une partie en anglais.', 'Prépare ta présentation en anglais, c’est éliminatoire.'],
    ['Capgemini Engineering', 'PFE data', 'pfe', 'test_ecrit', 4, 'retenu', false, ['Test en ligne : Python et SQL (45 min).', 'Explique la validation croisée.', 'Comment traiterais-tu des données de capteurs manquantes ?'], 'Test en ligne puis entretien technique sur le test.', 'Entraîne-toi sur des exercices SQL de jointures et de regroupements.'],
    ['Lear Corporation', 'Stage 4A supply chain', 'stage', 'presentiel', 2, 'retenu', false, ['Excel : fais un tableau croisé dynamique devant nous.', 'Qu’est-ce qu’un MRP ?'], 'Entretien court avec un petit exercice sur Excel.', 'Maîtrise les recherches et les tableaux croisés dynamiques.'],
    ['Yazaki Morocco', 'Stage 4A amélioration continue', 'stage', 'presentiel', 2, 'retenu', true, ['Qu’est-ce que le SMED ?', 'Donne un exemple de 5S.', 'Travailler en 3x8, ça te va ?'], 'Entretien avec le responsable amélioration continue, puis visite des lignes.', 'Porte des chaussures fermées, on visite l’usine.'],
    ['Safran Nacelles', 'Ingénieur méthodes', 'emploi', 'presentiel', 3, 'refuse', true, ['Que sais-tu des matériaux composites ?', 'Comment rédiges-tu une gamme de fabrication ?', 'Mise en situation : un lot non conforme arrive, que fais-tu ?'], 'Entretien RH, puis technique, puis mise en situation.', 'Renseigne-toi sur la norme EN 9100.'],
    ['Airbus Operations', 'Stage 6 mois structures', 'etranger', 'visio', 5, 'retenu', false, ['Présente-toi en anglais.', 'Calcul : contrainte dans une poutre en flexion.', 'Que connais-tu des composites ?', 'Pourquoi Toulouse ?'], 'Deux visios, dont une technique avec un calcul au tableau partagé.', 'Révise la RDM et prépare ton projet le plus technique.'],
    ['Bosch', 'VIE qualité fournisseurs', 'emploi', 'visio', 3, 'attente', false, ['Tell us about a quality issue you solved.', 'What is PPAP?', 'Parles-tu allemand ?'], 'Entretien en anglais, 45 minutes.', 'Quelques mots d’allemand font bonne impression.'],
    ['LafargeHolcim Maroc', 'PFE énergie', 'pfe', 'presentiel', 3, 'retenu', false, ['Comment fais-tu un bilan énergétique ?', 'Ordres de grandeur de consommation d’un four ?'], 'Entretien avec le chef de service énergie à l’usine de Meknès.', 'Arrive avec des idées de valorisation de chaleur, ils apprécient.'],
  ];
  const entretiens = ENT.map(([entreprise, poste, type, format, difficulte, resultat, anonyme, questions, deroulement, conseils], i) => ({ id: id('en'), author_id: auteur(), entreprise, poste, type, saison: i % 4 === 3 ? S - 1 : S, format, questions, deroulement, conseils, difficulte, resultat, anonyme, offer_id: null, created_at: daysAgo(3 + i * 5) }));
  entretiens.push({ id: id('en'), author_id: salma.id, entreprise: 'Renault Group Maroc', poste: 'PFE réduction des rebuts', type: 'pfe', saison: S, format: 'visio', questions: ['Pourquoi ce sujet de PFE ?', 'Qu’est-ce que l’AMDEC ?', 'Donne un exemple de VSM que tu as réalisé.'], deroulement: 'Visio de 40 minutes avec le tuteur et une personne RH.', conseils: 'Préparer un exemple de VSM m’a beaucoup aidée.', difficulte: 3, resultat: 'attente', anonyme: false, offer_id: null, created_at: daysAgo(4) });

  // ---------------- Avis de stage ----------------
  const avis_stage = [];
  const AVIS = [
    ['Renault Group Maroc', 'Tanger', 'Maroc', 'pfe', 5, 5, 4, 5, 'correcte', 'Équipe très accueillante, tuteur disponible. On te confie un vrai projet.', true],
    ['Yazaki Morocco', 'Meknès', 'Maroc', 'stage', 4, 3, 4, 4, 'symbolique', 'Bon stage pour apprendre le Lean sur le terrain. Rythme soutenu.', true],
    ['Lear Corporation', 'Kénitra', 'Maroc', 'stage', 3, 2, 4, 3, 'non', 'Tuteur peu disponible, mais beaucoup d’autonomie. Prends l’initiative.', true],
    ['OCP Group', 'Jorf Lasfar', 'Maroc', 'stage', 4, 4, 5, 3, 'non', 'Site impressionnant, sécurité très stricte. Transport assuré depuis El Jadida.', true],
    ['Capgemini Engineering', 'Casablanca', 'Maroc', 'pfe', 5, 4, 5, 5, 'bonne', 'Très bon encadrement data, possibilité d’embauche à la fin.', true],
    ['Stellantis Kénitra', 'Kénitra', 'Maroc', 'pfe', 4, 4, 4, 4, 'correcte', 'Projet intéressant, beaucoup de réunions en anglais.', true],
    ['TGCC', 'Casablanca', 'Maroc', 'stage', 3, 3, 4, 3, 'non', 'Stage chantier formateur mais physique. Prévois tes EPI.', true],
    ['Airbus Operations', 'Toulouse', 'France', 'etranger', 5, 5, 5, 4, 'bonne', 'Excellente expérience. Commence les démarches de visa très tôt.', true],
    ['Valeo', 'Créteil', 'France', 'etranger', 4, 4, 4, 4, 'correcte', 'Bonne équipe. Le logement en région parisienne est le plus difficile à trouver.', true],
    ['Bosch', 'Stuttgart', 'Allemagne', 'etranger', 4, 4, 5, 3, 'bonne', 'Très structuré. Apprendre un peu d’allemand aide pour la vie sur place.', true],
    ['Siemens Gamesa', 'Tanger', 'Maroc', 'stage', 4, 4, 4, 5, 'symbolique', 'Stage d’été très concret, ambiance internationale.', true],
    ['Safran Nacelles', 'Casablanca', 'Maroc', 'stage', 2, 2, 3, 3, 'non', 'Peu de missions au début, il a fallu insister pour avoir un sujet.', false],
  ];
  const confirmes = base.placements.filter(p => p.status === 'confirme');
  AVIS.forEach(([entreprise, ville, pays, type, note, ne, na, nam, gratification, conseils, recommande], i) => {
    const pl = confirmes.find(p => p.entreprise === entreprise && !avis_stage.some(x => x.placement_id === p.id));
    avis_stage.push({ id: id('av'), author_id: pl ? pl.student_id : auteur(), entreprise, ville, pays, type, saison: pl ? pl.saison : (i % 3 ? S : S - 1), poste: null, note, note_encadrement: ne, note_apprentissage: na, note_ambiance: nam, gratification, conseils, recommande, anonyme: i % 4 !== 0, placement_id: pl?.id || null, verifie: !!pl, created_at: daysAgo(6 + i * 4) });
  });

  // ---------------- Guide de l'étranger ----------------
  const G = (pays, section, contenu, who, ago) => ({ id: id('gp'), pays, section, contenu, updated_by: who.id, updated_at: daysAgo(ago), created_at: daysAgo(ago + 20) });
  const guide_pays = [
    G('France', 'campus_france', 'Tout passe par la plateforme « Études en France » de Campus France Maroc : dossier en ligne, choix des formations, puis entretien. Commence dès l’automne pour une rentrée en septembre, les places partent vite. Garde tes relevés de notes et une lettre de motivation par formation.', enFrance, 20),
    G('France', 'visa', 'Pour un stage de plus de 3 mois : visa long séjour « stagiaire » ou « étudiant », demandé au centre de visas avec la convention de stage signée. À l’arrivée, valide ton visa en ligne. Vérifie toujours les conditions à jour sur le site officiel France-Visas.', enFrance, 15),
    G('France', 'convention', 'En France, un stage se fait toujours avec une convention signée par l’école, l’entreprise et toi. Au-delà de 2 mois, la gratification est obligatoire. Demande la convention à l’école dès que l’entreprise te dit oui : les signatures prennent souvent 2 à 3 semaines.', enFrance, 10),
    G('France', 'logement', 'Cherche avant de partir : résidences étudiantes, colocation, logements temporaires. Demande l’aide au logement (CAF) dès que tu as une adresse. Méfie-toi des annonces qui demandent de payer avant la visite.', enFrance, 30),
    G('France', 'budget', 'Compte le loyer (le plus gros poste, surtout en région parisienne), la caution, les transports et l’assurance. Ouvre un compte bancaire sur place pour recevoir ta gratification.', enFrance, 25),
    G('Allemagne', 'visa', 'Visa national (type D) pour un stage ou des études, demandé à l’ambassade avec ton contrat ou ta convention. Sur place, déclare ton adresse à la mairie (Anmeldung) dans les deux semaines. Vérifie les conditions à jour sur le site de l’ambassade.', enAllemagne, 18),
    G('Allemagne', 'logement', 'Les WG (colocations) sont la solution la plus simple. Les sites spécialisés sont pris d’assaut : réponds vite et présente-toi bien dans ton message.', enAllemagne, 40),
    G('Allemagne', 'stage', 'Les grands groupes publient leurs stages sur leur site carrière, souvent en anglais. Une lettre courte et un CV d’une page suffisent. Un peu d’allemand fait la différence.', enAllemagne, 35),
    G('Canada', 'visa', 'Pour le Québec : le CAQ d’abord, puis le permis d’études ou de travail selon ton cas. Les délais sont longs : commence plusieurs mois à l’avance et suis le site officiel d’Immigration Canada.', auCanada, 22),
    G('Canada', 'stage', 'Les stages « coop » et les centres de recherche accueillent des stagiaires internationaux. Contacte directement les professeurs ou les chercheurs dont les sujets t’intéressent.', auCanada, 28),
    G('Canada', 'vie', 'Prévois de vrais vêtements d’hiver dès novembre. Les associations marocaines et le réseau ENSAM sur place aident beaucoup pour les premières semaines.', auCanada, 50),
  ];
  const guide_pays_historique = [{ id: id('gh'), guide_id: guide_pays[1].id, contenu: 'Visa long séjour demandé au centre de visas avec la convention signée.', updated_by: enFrance.id, updated_at: daysAgo(40), created_at: daysAgo(15) }];

  // ---------------- Signalements ----------------
  const offreRecente = base.offers.find(o => o.status === 'ouverte');
  const msg = base.groupe_messages[0];
  const signalements = [
    { id: id('sg'), auteur_id: etu4[0].id, cible_type: 'offre', cible_id: offreRecente.id, motif: 'faux', details: 'Le lien de candidature ne mène nulle part.', status: 'ouvert', traite_par: null, traite_at: null, created_at: daysAgo(1) },
    ...(msg ? [{ id: id('sg'), auteur_id: etu5[2].id, cible_type: 'message', cible_id: msg.id, motif: 'spam', details: null, status: 'ouvert', traite_par: null, traite_at: null, created_at: daysAgo(0, 5) }] : []),
    { id: id('sg'), auteur_id: etu5[1].id, cible_type: 'profil', cible_id: lau[3].id, motif: 'autre', details: 'Doublon de compte ?', status: 'rejete', traite_par: admin.id, traite_at: daysAgo(6), created_at: daysAgo(8) },
  ];

  // ---------------- Enquête d'insertion ----------------
  const SECT = ['Automobile', 'Industrie', 'Conseil & IT', 'Énergie', 'Aéronautique', 'BTP & immobilier'];
  const SITU = ['emploi', 'emploi', 'emploi', 'recherche', 'emploi', 'etudes', 'emploi', 'entrepreneur', 'emploi', 'volontariat'];
  const SAL = ['6_10', '10_15', '10_15', '15_20', '6_10', '10_15', '20_30', 'nsp'];
  const CAN = ['reseau_ensam', 'plateforme', 'stage', 'linkedin', 'candidature', 'reseau_ensam', 'stage'];
  const enquetes_insertion = [];
  const diplomes = P.filter(p => p.role === 'laureat' && (p.promo === S - 1 || p.promo === S - 2) && !p._persona);
  diplomes.forEach((p, i) => {
    for (const vague of [6, 12]) {
      if (p.promo === S - 1 && vague === 12 && i % 2) continue;  // vague en cours : la moitié a répondu
      const situation = SITU[(i + vague) % SITU.length]; const poste = ['emploi', 'entrepreneur', 'volontariat'].includes(situation);
      enquetes_insertion.push({ id: id('eq'), user_id: p.id, vague, promo: p.promo, filiere: p.filiere, situation, contrat: poste ? (i % 3 ? 'cdi' : 'cdd') : null, secteur: poste ? SECT[i % SECT.length] : null,
        entreprise: poste ? p.entreprise || null : null, pays: poste ? (i % 5 === 0 ? 'France' : 'Maroc') : null, ville: null, delai_mois: poste ? (i * 2 + vague) % 7 : null,
        salaire: poste ? SAL[(i + vague) % SAL.length] : null, lien_formation: 3 + (i % 3), satisfaction: 3 + ((i + vague) % 3), canal: poste ? CAN[i % CAN.length] : null, commentaire: null,
        created_at: daysAgo(vague === 6 ? 200 + i : 60 + i), updated_at: daysAgo(vague === 6 ? 200 + i : 60 + i) });
    }
  });

  // ---------------- Agenda de l'école ----------------
  const evenements = [
    { id: id('ev'), author_id: admin.id, titre: 'Forum ENSAM Entreprises', type: 'forum', debut: inDays(19, 9), fin: inDays(19, 17), lieu: 'ENSAM Meknès, grand hall', lien: null, description: 'Une trentaine d’entreprises, des stands de lauréats et des entretiens sur place. Apporte ton CV imprimé.', public: 'tous', annule: false, created_at: daysAgo(5) },
    { id: id('ev'), author_id: admin.id, titre: 'Réussir son stage à l’étranger', type: 'conference', debut: inDays(8, 18), fin: inDays(8, 19), lieu: null, lien: 'https://meet.jit.si/ReseauENSAM-conference-etranger', description: 'Trois lauréats installés en France, en Allemagne et au Canada racontent leurs démarches. Questions en direct.', public: 'etudiants', annule: false, created_at: daysAgo(3) },
    { id: id('ev'), author_id: admin.id, titre: 'Portes ouvertes de l’école', type: 'portes_ouvertes', debut: inDays(55, 10), fin: inDays(55, 16), lieu: 'ENSAM Meknès', lien: null, description: 'Les lauréats volontaires présentent leur métier aux futurs étudiants.', public: 'tous', annule: false, created_at: daysAgo(2) },
    { id: id('ev'), author_id: admin.id, titre: 'Atelier CV et LinkedIn', type: 'atelier', debut: daysAgo(20, 6), fin: daysAgo(20, 4), lieu: 'Amphi 2', lien: null, description: 'Atelier animé par des lauréats recruteurs.', public: 'etudiants', annule: false, created_at: daysAgo(35) },
  ];
  const evenement_participants = [];
  [...etu5.slice(0, 12), ...etu4.slice(0, 6), youssef, hamid].forEach((p, i) => evenement_participants.push({ id: id('ep'), evenement_id: evenements[i % 3 === 0 ? 1 : 0].id, user_id: p.id, created_at: daysAgo(i % 4) }));

  // ---------------- Vérification par les camarades de promo ----------------
  const verifications_pairs = [{ id: id('vp'), laureat_id: rachid.id, verificateur_id: hamid.id, created_at: daysAgo(1) }];

  // ---------------- Liste officielle (importée par l'administration) ----------------
  const liste_officielle = [];
  P.filter(p => p.role === 'etudiant' && p.promo >= S + 1 && !p._persona).forEach((p, i) => { if (i % 6 !== 5) liste_officielle.push({ id: id('lo'), nom: p.full_name.split(' ').reverse().join(' ').toUpperCase(), email: null, promo: p.promo, filiere: p.filiere, matricule: `M${p.promo}${String(i).padStart(3, '0')}`, created_at: daysAgo(10) }); });
  ['Yassine Ouardi', 'Salima Kabbaj', 'Mouad Chafik', 'Ikram Filali', 'Hamza Rifi'].forEach((nom, i) => liste_officielle.push({ id: id('lo'), nom, email: null, promo: S + 1 + (i % 3), filiere: ['Génie Industriel', 'Génie Mécanique', 'Génie Civil'][i % 3], matricule: null, created_at: daysAgo(10) }));
  for (const p of P) if (!p.verified && p.role === 'etudiant' && liste_officielle.some(l => l.promo === p.promo && cleNom(l.nom) === cleNom(p.full_name))) p.verified = true;

  return { coordonnees, demandes_contact, relectures_cv, relecture_commentaires, entretiens, avis_stage, guide_pays, guide_pays_historique, signalements, enquetes_insertion, evenements, evenement_participants, verifications_pairs, liste_officielle };
}
