// Console d'administration : les règles sans écran (admin-console-regles.js). Les données d'une école, la recherche,
// ce qui attend dans « À traiter », le message prêt pour un lauréat, les filtres et le tri des membres, leur fichier CSV.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { donneesDeLEcole, chercherConsole, CATS, elementsATraiter, messagePourDemande, FILTRES, TESTS, COLS, ENTETES_CSV, ligneCSV, texteCSV, jour, membresFiltres }
  from '../../src/admin-console-regles.js';

const NOW = new Date('2026-11-01T12:00:00');
const ilYa = (j, h = 0) => new Date(NOW.getTime() - j * 864e5 - h * 36e5).toISOString();
const ids = l => l.map(x => x.id);

test('une école : ses profils et les lignes qui portent son école (sans école : l’ENSAM Meknès) ; les autres tables restent entières', () => {
  const data = {
    profiles: [{ id: 'a' }, { id: 'b', ecole: 'ensam-casa' }, { id: 'c', ecole: 'ensam-meknes' }],
    offers: [{ id: 'o1', ecole: 'ensam-casa' }, { id: 'o2' }],
    comments: [{ id: 'c1' }], reactions: [], saison: 2026,
  };
  assert.equal(donneesDeLEcole(data, ''), data, 'aucune école choisie : toutes');
  assert.equal(donneesDeLEcole(data, null), data);
  const m = donneesDeLEcole(data, 'ensam-meknes');
  assert.deepEqual(ids(m.profiles), ['a', 'c']);
  assert.deepEqual(ids(m.offers), ['o2']);
  assert.equal(m.comments, data.comments, 'une table sans école reste la même');
  assert.equal(m.reactions, data.reactions);
  assert.equal(m.saison, 2026);
  const c = donneesDeLEcole(data, 'ensam-casa');
  assert.deepEqual([ids(c.profiles), ids(c.offers)], [['b'], ['o1']]);
  assert.equal(data.profiles.length, 3, 'les données d’origine ne changent pas');
});

const PROFILS = [
  { id: 'adm', role: 'admin', full_name: 'Administration Youssef' },
  { id: 'l1', role: 'laureat', full_name: 'Youssef El Amrani', promo: 2016, filiere: 'Génie Mécanique : Énergétique' },
  { id: 'l2', role: 'laureat', full_name: 'Salma Bennani', promo: 2019, filiere: 'Génie Industriel' },
  { id: 'e1', role: 'etudiant', full_name: 'Amine Youssfi', promo: 2027, filiere: 'Génie Civil' },
  { id: 'e2', role: 'etudiant', full_name: 'Hiba Élyoussoufi', promo: 2029, filiere: 'Génie Mécanique : Énergétique' },
];
const RECHERCHE = {
  profiles: PROFILS,
  offers: [{ id: 'o1', titre: 'Stage en emboutissage', entreprise: 'Renault Tanger' }, { id: 'o2', titre: 'PFE qualité', entreprise: 'Atelier Nord' }],
  demandes: [{ id: 'd1', titre: 'PFE en efficacité énergétique industrielle' }],
};

test('recherche de la console : nom, email, promo, filière (même en code court), sans accents ; jamais l’administration', () => {
  const cles = (q, comptes = []) => chercherConsole(RECHERCHE, comptes, q, 2026).map(r => r.cle);
  assert.deepEqual(cles('y'), [], 'une lettre ne cherche pas encore');
  assert.deepEqual(cles(''), []);
  // Le nom qui commence par la recherche d'abord, puis l'ordre alphabétique ; « Élyoussoufi » se trouve sans accent
  assert.deepEqual(cles('youss'), ['p-l1', 'p-e1', 'p-e2']);
  assert.deepEqual(cles('el amrani'), ['p-l1'], 'chaque mot doit se trouver');
  assert.deepEqual(cles('youssef bennani'), []);
  assert.deepEqual(cles('salma.bennani@', [{ id: 'l2', email: 'salma.bennani@exemple.ma' }]), ['p-l2']);
  assert.deepEqual(cles('GME24'), ['p-e2', 'p-l1']);
  assert.deepEqual(cles('2027'), ['p-e1']);
  assert.deepEqual(cles('administration'), [], 'l’administration n’est pas un membre');
  // Offres (titre, entreprise) et demandes (titre), après les membres
  assert.deepEqual(cles('renault'), ['o-o1']);
  assert.deepEqual(cles('EMBOUTISSAGE'), ['o-o1']);
  assert.deepEqual(cles('efficacite'), ['d-d1']);
  assert.deepEqual(cles('pfe'), ['o-o2', 'd-d1']);
  // Ce que dit la ligne sous le nom : l'année et la filière d'un étudiant, la filière et la promo d'un lauréat
  const [l1, e1] = [chercherConsole(RECHERCHE, [], 'youssef el', 2026)[0], chercherConsole(RECHERCHE, [], 'amine', 2026)[0]];
  assert.equal(l1.sous, 'Génie Mécanique : Énergétique · Promo 2016');
  assert.equal(e1.sous, '5A · Génie Civil');
  assert.equal(l1.sorte, 'membre');
  // Au plus 6 membres, 4 offres, 3 demandes
  const beaucoup = {
    profiles: Array.from({ length: 9 }, (_, i) => ({ id: 'x' + i, role: 'etudiant', full_name: 'Test ' + i, promo: 2028 })),
    offers: Array.from({ length: 7 }, (_, i) => ({ id: 'o' + i, titre: 'Test ' + i, entreprise: 'A' })),
    demandes: Array.from({ length: 5 }, (_, i) => ({ id: 'd' + i, titre: 'Test ' + i })),
  };
  const r = chercherConsole(beaucoup, null, 'test', 2026);
  assert.deepEqual(['membre', 'offre', 'demande'].map(s => r.filter(x => x.sorte === s).length), [6, 4, 3]);
});

test('À traiter : un signalement par contenu, les lauréats à vérifier, les recrutements, ce qui attend depuis plus de 24 h, les lectures de CV, les comptes sans profil', () => {
  const data = {
    profiles: [{ id: 'adm', role: 'admin' }, { id: 'l1', role: 'laureat', verified: true, created_at: ilYa(40) }, { id: 'l2', role: 'laureat', verified: false, created_at: ilYa(3) },
      { id: 'e1', role: 'etudiant', created_at: ilYa(50) }, { id: 'e2', role: 'etudiant', created_at: ilYa(50) }],
    signalements: [{ id: 's1', cible_type: 'offre', cible_id: 'o1', status: 'ouvert', created_at: ilYa(2) }, { id: 's2', cible_type: 'offre', cible_id: 'o1', status: 'ouvert', created_at: ilYa(0, 2) },
      { id: 's3', cible_type: 'profil', cible_id: 'l1', status: 'traite', created_at: ilYa(0, 1) }],
    placements: [{ id: 'p1', status: 'en_attente', created_at: ilYa(1) }, { id: 'p2', status: 'confirme', created_at: ilYa(1) }],
    demandes: [
      { id: 'd1', auteur_id: 'e1', titre: 'PFE', status: 'ouverte', created_at: ilYa(4) },
      { id: 'd2', auteur_id: 'e1', titre: 'Stage', status: 'ouverte', created_at: ilYa(0, 5) },
      { id: 'd3', auteur_id: 'e2', titre: 'Emploi', status: 'ouverte', created_at: ilYa(5) },
      { id: 'd4', auteur_id: 'e2', titre: 'Fermée', status: 'fermee', created_at: ilYa(6) },
    ],
    propositions: [{ id: 'x1', demande_id: 'd3', laureat_id: 'l1', created_at: ilYa(4) }],
    questions: [{ id: 'q1', author_id: 'e2', titre: 'Quelle filière ?', created_at: ilYa(2) }],
    answers: [{ id: 'a1', question_id: 'q1', author_id: 'e2', created_at: ilYa(1) }],
    mentorships: [{ id: 'm1', student_id: 'e1', mentor_id: 'l1', status: 'demande', sujet: 'CV', created_at: ilYa(3, 5) }],
    retours_cv: [{ id: 'r1', status: 'ouvert', created_at: ilYa(1, 1) }, { id: 'r2', status: 'classe', created_at: ilYa(1) }],
  };
  const comptes = [
    { id: 'k1', a_profil: false, par_code: true, created_at: ilYa(2), last_sign_in_at: ilYa(1) },
    { id: 'k2', a_profil: false, par_code: true, created_at: ilYa(2), last_sign_in_at: ilYa(2) },
    { id: 'k3', a_profil: true, created_at: ilYa(0, 1) },
    { id: 'k4', a_profil: false, created_at: ilYa(0, 3) },
  ];
  const items = elementsATraiter(data, comptes, NOW);
  // Le plus récent d'abord
  assert.deepEqual(items.map(i => i.cle), ['sg-offre-o1', 'comptes', 'rc-p1', 'cv-r1', 'question-q1', 'lv-l2', 'mentorat-m1', 'demande-d1']);
  assert.deepEqual(items.map(i => i.cat), ['signalements', 'comptes', 'recrutements', 'cv', 'questions', 'laureats', 'mentorats', 'demandes']);
  for (let i = 1; i < items.length; i++) assert.ok(items[i - 1].at >= items[i].at);
  const cats = new Set(CATS.map(c => c[0]));
  assert.ok(items.every(i => cats.has(i.cat)), 'chaque élément a sa rubrique');
  assert.equal(CATS.length, 8);
  // Deux signalements du même contenu : une seule ligne, datée du plus récent
  const sg = items[0];
  assert.deepEqual([sg.g.length, sg.at], [2, new Date(ilYa(0, 2)).getTime()]);
  // Les comptes sans profil en une ligne ; un code demandé mais jamais entré n'en est pas un
  assert.deepEqual(items[1].comptes.map(c => c.id), ['k1', 'k4']);
  // Une proposition sur la demande, une réponse d'un autre membre à la question : plus rien n'attend
  data.propositions.push({ id: 'x2', demande_id: 'd1', laureat_id: 'l1', created_at: ilYa(0, 1) });
  data.answers.push({ id: 'a2', question_id: 'q1', author_id: 'l1', created_at: ilYa(0, 1) });
  const apres = elementsATraiter(data, comptes, NOW).map(i => i.cle);
  assert.ok(!apres.includes('demande-d1') && !apres.includes('question-q1'));
  assert.equal(apres.length, 6);
  // Sans comptes chargés ni tables : rien, jamais d'erreur
  assert.deepEqual(elementsATraiter({}, null, NOW), []);
  assert.deepEqual(elementsATraiter({ profiles: [] }, [], NOW), []);
});

test('message prêt pour un lauréat : dans sa langue, qui cherche quoi, et le lien de la demande', () => {
  const etu = { full_name: 'Hiba Alaoui', promo: 2027, filiere: 'Génie Mécanique : Énergétique' };
  const d = { type: 'pfe', titre: 'PFE en efficacité énergétique industrielle' };
  const lien = 'https://exemple.ma/#offres/demandes/dm-1';
  assert.equal(messagePourDemande({ full_name: 'Soufiane Bennani', langue: 'fr' }, etu, d, lien, 2026),
    'Bonjour Soufiane, Hiba (5A · GME24) cherche un PFE : « PFE en efficacité énergétique industrielle ». Tu pourrais jeter un œil à sa demande ? https://exemple.ma/#offres/demandes/dm-1 Merci !');
  assert.equal(messagePourDemande({ full_name: 'Soufiane Bennani', langue: 'ar' }, etu, d, lien, 2026),
    'مرحبًا Soufiane، Hiba (5A · GME24) بحاجة إلى مشروع نهاية الدراسة: « PFE en efficacité énergétique industrielle ». هل يمكنك إلقاء نظرة على هذا الطلب؟ https://exemple.ma/#offres/demandes/dm-1 شكرًا!');
  // Sans langue choisie : en français
  assert.match(messagePourDemande({ full_name: 'Hamid Squalli', langue: null }, etu, d, lien, 2026), /^Bonjour Hamid, /);
  const quoi = type => messagePourDemande({ full_name: 'A' }, etu, { ...d, type }, lien, 2026);
  assert.match(quoi('stage'), / cherche un stage : /);
  assert.match(quoi('etranger'), / cherche un stage à l’étranger : /);
  assert.match(quoi('emploi'), / cherche un emploi : /);
  assert.match(quoi('autre'), / cherche de l’aide : /);
  assert.match(messagePourDemande({ full_name: 'A', langue: 'ar' }, etu, { ...d, type: 'autre' }, lien, 2026), / بحاجة إلى مساعدة: /);
  // Ni promo ni filière : pas de parenthèses vides (et jamais « Lauréat » pour un étudiant sans promo)
  assert.match(messagePourDemande({ full_name: 'A' }, { full_name: 'Nora' }, d, lien, 2026), /^Bonjour A, Nora cherche un PFE : /);
  assert.match(messagePourDemande({ full_name: 'A' }, { full_name: 'Nora', filiere: 'Génie Civil' }, d, lien, 2026), /^Bonjour A, Nora \(GC24\) cherche /);
});

const MEMBRES = [
  { id: 'adm', role: 'admin', full_name: 'Administration', created_at: ilYa(400) },
  { id: 'l1', role: 'laureat', full_name: 'Youssef El Amrani', promo: 2016, filiere: 'Génie Mécanique', verified: true, cv_path: 'cv/l1.pdf', photo_path: 'p/l1.jpg', entreprise: 'Renault', created_at: ilYa(30) },
  { id: 'l2', role: 'laureat', full_name: 'Salma Bennani', promo: 2019, filiere: 'Génie Industriel', verified: false, created_at: ilYa(10) },
  { id: 'l3', role: 'laureat', full_name: 'Hamid Squalli', promo: 2016, filiere: 'Génie Civil', verified: false, cv_url: 'https://exemple.ma/cv.pdf', created_at: ilYa(20) },
  { id: 'e1', role: 'etudiant', full_name: 'Amine Youssfi', promo: 2027, filiere: 'Génie Mécanique : Énergétique', photo_path: 'p/e1.jpg', created_at: ilYa(5) },
  { id: 'e2', role: 'etudiant', full_name: 'Hiba Alaoui', promo: 2029, filiere: 'Génie Civil', created_at: ilYa(1) },
];
const COMPTES = [
  { id: 'l1', email: 'youssef@exemple.ma', last_sign_in_at: ilYa(2) },
  { id: 'l2', email: 'salma.bennani@exemple.ma', last_sign_in_at: ilYa(45) },
  { id: 'e1', email: 'amine@exemple.ma', last_sign_in_at: ilYa(0, 1) },
  { id: 'e2', email: 'hiba@exemple.ma', last_sign_in_at: null },
];

test('membres : chaque filtre, la promo, la recherche (email, code de filière, entreprise) ; jamais l’administration', () => {
  const f = (o = {}, comptes = COMPTES) => ids(membresFiltres(MEMBRES, comptes, o, NOW.getTime()));
  assert.ok(FILTRES.every(([k]) => typeof TESTS[k] === 'function'), 'chaque puce a son test');
  // Par défaut : les derniers inscrits d'abord
  assert.deepEqual(f(), ['e2', 'e1', 'l2', 'l3', 'l1']);
  assert.deepEqual(f({ filtre: 'etudiants' }), ['e2', 'e1']);
  assert.deepEqual(f({ filtre: 'laureats' }), ['l2', 'l3', 'l1']);
  assert.deepEqual(f({ filtre: 'verifier' }), ['l2', 'l3']);
  assert.deepEqual(f({ filtre: 'sans-cv' }), ['e2', 'e1', 'l2'], 'un lien de CV compte comme un CV');
  assert.deepEqual(f({ filtre: 'sans-photo' }), ['e2', 'l2', 'l3']);
  // Inactifs 30 j : pas venu depuis 30 jours, jamais venu, ou sans compte ; seulement quand les comptes sont chargés
  assert.deepEqual(f({ filtre: 'inactifs' }), ['e2', 'l2', 'l3']);
  assert.deepEqual(f({ filtre: 'inactifs' }, null), []);
  assert.deepEqual(f({ filtre: 'inconnu' }), f(), 'un filtre inconnu : tous');
  assert.deepEqual(f({ promo: '2016' }), ['l3', 'l1']);
  assert.deepEqual(f({ promo: 2016, filtre: 'verifier' }), ['l3']);
  assert.deepEqual(f({ q: 'salma.bennani@' }), ['l2']);
  assert.deepEqual(f({ q: 'gme24' }), ['e1']);
  assert.deepEqual(f({ q: 'RENAULT' }), ['l1']);
  assert.deepEqual(f({ q: 'genie civil' }), ['e2', 'l3']);
  assert.deepEqual(f({ q: '   ' }), f(), 'des espaces ne filtrent rien');
});

test('membres : le tri de chaque colonne, dans les deux sens ; à égalité, le dernier inscrit d’abord', () => {
  const t = (k, desc = false) => ids(membresFiltres(MEMBRES, COMPTES, { tri: { k, desc } }, NOW.getTime()));
  assert.deepEqual(t('nom'), ['e1', 'l3', 'e2', 'l2', 'l1']);
  assert.deepEqual(t('nom', true), ['l1', 'l2', 'e2', 'l3', 'e1']);
  assert.deepEqual(t('promo'), ['l3', 'l1', 'l2', 'e1', 'e2']);
  assert.deepEqual(t('promo', true), ['e2', 'e1', 'l2', 'l3', 'l1']);
  assert.deepEqual(t('vu', true), ['e1', 'l1', 'l2', 'e2', 'l3']);
  assert.deepEqual(t('inscrit'), ['l1', 'l3', 'l2', 'e1', 'e2']);
  assert.deepEqual(t('verifie', true).slice(0, 1), ['l1']);
  assert.deepEqual(t('cv', true).slice(0, 2), ['l3', 'l1']);
  assert.deepEqual(t('inconnue', true), t('inscrit', true));
  assert.ok(COLS.every(c => typeof c[2] === 'function'));
});

test('fichier CSV des membres : une colonne par en-tête, oui/non, dates du jour ; Excel l’ouvre avec ses accents', () => {
  const [, l1, , , , e2] = MEMBRES;
  const ligne = ligneCSV({ ...l1, poste: 'Ingénieur méthodes', ville: 'Tanger', created_at: '2026-03-05T10:00:00' }, COMPTES[0]);
  assert.equal(ligne.length, ENTETES_CSV.length);
  assert.deepEqual(ligne, ['Youssef El Amrani', 'Lauréat', 2016, 'Génie Mécanique', 'Renault', 'Ingénieur méthodes', 'Tanger', 'youssef@exemple.ma', '2026-03-05', jour(COMPTES[0].last_sign_in_at), 'oui', 'oui', 'oui']);
  assert.deepEqual(ligneCSV(e2, undefined), ['Hiba Alaoui', 'Étudiant', 2029, 'Génie Civil', '', '', '', '', jour(e2.created_at), '', 'non', 'non', 'non']);
  assert.equal(jour(null), '');
  assert.equal(jour('2026-11-01T23:30:00'), '2026-11-01', 'le jour de l’heure locale');
  // Point-virgule, guillemets doublés, BOM en tête, lignes Windows
  const txt = texteCSV([['Nom', 'Note'], ['Salma; « la pro »', 'dit "oui"'], ['Hiba', null], ['Deux\nlignes', 0]]);
  assert.equal(txt, '﻿Nom;Note\r\n"Salma; « la pro »";"dit ""oui"""\r\nHiba;\r\n"Deux\nlignes";0');
  // Un nom ou un poste écrit comme une formule reste du texte dans Excel ; les nombres et le reste ne bougent pas
  assert.equal(texteCSV([['=HYPERLINK("https://x.test";"ici")', '+212 600', '-1', '@SOMME(A1)', '\tcaché', 'Salma = pro', -3, 2016]]),
    '﻿"\'=HYPERLINK(""https://x.test"";""ici"")";\'+212 600;\'-1;\'@SOMME(A1);\'\tcaché;Salma = pro;-3;2016');
});
