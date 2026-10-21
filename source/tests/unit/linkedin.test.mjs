// « Profil en une minute » : le texte d'un profil LinkedIn collé remplit le formulaire
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLinkedin } from '../../src/parse-linkedin.js';

const OCT_2026 = new Date(2026, 9, 21);

// Texte copié depuis le PDF « Enregistrer au format PDF » (interface en français) : colonne de gauche d'abord
const PDF_FR = `Coordonnées
www.linkedin.com/in/salma-el-amrani-4b2a1 (LinkedIn)
Principales compétences
Lean Manufacturing
CATIA
Gestion de projet
Languages
Arabe (Langue maternelle ou bilingue)
Français (Compétence professionnelle complète)
Certifications
Lean Six Sigma Green Belt
Salma El Amrani
Ingénieure méthodes chez Renault Group | Lean | Amélioration
continue
Tanger, Tanger-Tétouan-Al Hoceïma, Maroc
Résumé
Ingénieure méthodes passionnée par l'amélioration continue. J'aide les
étudiants de l'ENSAM à préparer leurs entretiens.
Expérience
Renault Group
3 ans 2 mois
Ingénieure méthodes
janvier 2024 - aujourd’hui (1 an 10 mois)
Tanger, Maroc
Ingénieure process
septembre 2022 - décembre 2023 (1 an 4 mois)
Formation
École Nationale Supérieure d'Arts et Métiers de Meknès
Diplôme d'ingénieur d'État, Génie industriel · (2017 - 2022)
Lycée Moulay Ismail
Baccalauréat, Sciences mathématiques · (2015 - 2017)
Page 1 sur 2`;

test('PDF LinkedIn en français : nom, poste, entreprise, ville, promo, filière, compétences, bio', () => {
  const r = parseLinkedin(PDF_FR, OCT_2026);
  assert.equal(r.full_name, 'Salma El Amrani');
  assert.equal(r.poste, 'Ingénieure méthodes');
  assert.equal(r.entreprise, 'Renault Group');
  assert.equal(r.ville, 'Tanger');
  assert.equal(r.pays, 'Maroc');
  assert.equal(r.promo, 2022);
  assert.equal(r.filiere, 'Génie Industriel');
  assert.equal(r.role, 'laureat');
  assert.deepEqual(r.competences, ['Lean Manufacturing', 'CATIA', 'Gestion de projet']);
  assert.match(r.bio, /^Ingénieure méthodes passionnée .* entretiens\.$/);
  assert.equal(r.linkedin, 'https://www.linkedin.com/in/salma-el-amrani-4b2a1');
});

const PDF_EN = `Contact
youssef.bennani@example.com
www.linkedin.com/in/youssefbennani (LinkedIn)
Top Skills
Python
Machine Learning
SQL
Languages
English (Full Professional)
Youssef Bennani
Data Engineer at OCP Group
Casablanca, Casablanca-Settat, Morocco
Summary
Data engineer building pipelines for industrial analytics.
Experience
OCP Group
Data Engineer
September 2023 - Present (3 years 2 months)
Casablanca, Morocco
Education
ENSAM Meknès
Engineer's degree, Génie Informatique et Intelligence Artificielle · (2018 - 2023)`;

test('PDF LinkedIn en anglais', () => {
  const r = parseLinkedin(PDF_EN, OCT_2026);
  assert.equal(r.full_name, 'Youssef Bennani');
  assert.equal(r.poste, 'Data Engineer');
  assert.equal(r.entreprise, 'OCP Group');
  assert.equal(r.ville, 'Casablanca');
  assert.equal(r.pays, 'Maroc');
  assert.equal(r.promo, 2023);
  assert.equal(r.filiere, 'Génie Informatique & IA');
  assert.deepEqual(r.competences, ['Python', 'Machine Learning', 'SQL']);
  assert.equal(r.bio, 'Data engineer building pipelines for industrial analytics.');
});

// Copie de la page du profil (Ctrl+A) : menu du site, lignes répétées, « Afficher plus »…
const WEB_FR = `Passer au contenu principal
Accueil
Réseau
Emplois
Messagerie
Notifications
Vous
Hajar Tazi
Hajar Tazi
Process Engineer chez Stellantis
Kénitra, Rabat-Salé-Kénitra, Maroc · Coordonnées
500+ relations
Infos
Infos
Ingénieure process, j'accompagne les lauréats qui veulent travailler dans l'automobile.
…voir plus
Expérience
Expérience
Process Engineer
Process Engineer
Stellantis · Temps plein
Stellantis · Temps plein
mars 2023 - aujourd’hui · 3 ans 8 mois
Kénitra, Maroc
Compétences : Lean · APQP · AMDEC
Formation
Formation
Logo de École Nationale Supérieure d’Arts et Métiers - Meknès
École Nationale Supérieure d’Arts et Métiers - Meknès
Diplôme d'ingénieur, Génie Électromécanique
2018 - 2023
Compétences
Compétences
Lean Six Sigma
Lean Six Sigma
Approuvé par 3 collègues
Afficher les 12 compétences`;

test('copie de la page web : lignes doublées et menu ignorés', () => {
  const r = parseLinkedin(WEB_FR, OCT_2026);
  assert.equal(r.full_name, 'Hajar Tazi');
  assert.equal(r.poste, 'Process Engineer');
  assert.equal(r.entreprise, 'Stellantis');
  assert.equal(r.ville, 'Kénitra');
  assert.equal(r.pays, 'Maroc');
  assert.equal(r.promo, 2023);
  assert.equal(r.filiere, 'Génie Électromécanique');
  assert.deepEqual(r.competences, ['Lean Six Sigma', 'Lean', 'APQP', 'AMDEC']);
  assert.equal(r.bio, 'Ingénieure process, j\'accompagne les lauréats qui veulent travailler dans l\'automobile.');
});

test('étudiant(e) : promo future, pas d’entreprise ni de poste', () => {
  const r = parseLinkedin(`Amine Kettani
Élève ingénieur en Génie Mécanique à l'ENSAM Meknès
Meknès, Fès-Meknès, Maroc
Expérience
Stagiaire méthodes
Lear Corporation · Stage
juil. 2025 - sept. 2025 · 3 mois
Formation
ENSAM Meknès
Diplôme d'ingénieur, Génie mécanique
2022 - 2027`, OCT_2026);
  assert.equal(r.full_name, 'Amine Kettani');
  assert.equal(r.role, 'etudiant');
  assert.equal(r.promo, 2027);
  assert.equal(r.filiere, 'Génie Mécanique');
  assert.equal(r.ville, 'Meknès');
  assert.equal(r.entreprise, undefined);
  assert.equal(r.poste, undefined);
});

test('texte libre (la section Infos seule) : devient la bio', () => {
  const r = parseLinkedin('Ingénieur qualité chez Lear Corporation, lauréat 2019. Je peux aider pour les stages dans l’automobile.', OCT_2026);
  assert.equal(r.poste, 'Ingénieur qualité');
  assert.equal(r.entreprise, 'Lear Corporation');
  assert.equal(r.promo, 2019);
  assert.match(r.bio, /^Ingénieur qualité chez Lear Corporation/);
});

test('ne lève jamais d’exception et rend un objet vide sur du vide', () => {
  for (const x of [null, undefined, '', '   \n  ', 42, {}, 'Expérience\n\nFormation']) assert.doesNotThrow(() => parseLinkedin(x));
  assert.deepEqual(parseLinkedin(''), {});
  assert.ok(parseLinkedin('x'.repeat(5000)).bio.length <= 600);
});
