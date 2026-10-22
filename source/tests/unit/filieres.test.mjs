// Filières officielles : 11 filières en 5 parcours, classes prépa en 1A-2A, anciennes appellations des lauréats
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FILIERES, PREPA, PARCOURS, filiereMatch, proximiteFiliere, filieresPour, resumeFilieres, groupeFiliere, groupLabel, filtreFiliere, filtreOffre, filiereCourte, filiereSousTitre } from '../../src/logic.js';
import { parseOffre } from '../../src/parse-offre.js';

const GIEO = 'Génie Industriel : Excellence Opérationnelle', GIP = 'Génie Industriel et Productique';
const GE_DI = 'Génie Électromécanique : Digitalisation Industrielle', GE_MCI = 'Génie Électromécanique : Maintenance et Commande Industrielles';

test('la liste officielle : 11 filières, 5 parcours', () => {
  assert.equal(FILIERES.length, 11);
  assert.deepEqual(PARCOURS.map(p => p.nom), ['Électro-industriel', 'Mécanique', 'Civil', 'Intelligence artificielle', 'Informatique']);
  assert.equal(filiereCourte(GIEO), 'GIEO');
  assert.equal(filiereCourte('Génie Mécanique'), 'Génie Mécanique', 'une ancienne appellation garde son nom');
  assert.equal(filiereSousTitre(GIEO), 'Excellence Opérationnelle');
  assert.equal(filiereSousTitre(GIP), GIP);
});

test('formulaire : classes prépa en 1A-2A, filières par parcours ensuite, anciennes appellations pour les lauréats', () => {
  assert.deepEqual(filieresPour('etudiant', 1).flatMap(g => g.options), [PREPA]);
  assert.deepEqual(filieresPour('etudiant', 2).flatMap(g => g.options), [PREPA]);
  const e3 = filieresPour('etudiant', 3);
  assert.equal(e3.length, 5);
  assert.equal(e3[0].label, 'Parcours Électro-industriel');
  assert.deepEqual(e3[0].options, [GIP, GIEO, GE_DI, GE_MCI]);
  assert.ok(!e3.flatMap(g => g.options).includes('Génie Industriel'), 'pas d’ancienne appellation pour un étudiant');
  const l = filieresPour('laureat', 7);
  assert.equal(l.at(-1).label, 'Ancienne appellation (promos précédentes)');
  assert.ok(l.at(-1).options.includes('Mécatronique'));
});

test('offres : deux filières actuelles identiques, une ancienne appellation couvre son parcours', () => {
  assert.equal(filiereMatch([], PREPA), true);
  assert.equal(filiereMatch([GIEO], GIEO), true);
  assert.equal(filiereMatch([GIEO], GIP), false);
  assert.equal(filiereMatch([GIEO], 'Génie Industriel'), true);
  assert.equal(filiereMatch(['Mécatronique'], GE_MCI), true);
  assert.equal(filiereMatch([GIEO], 'Génie Mécanique'), false);
  assert.equal(filiereMatch([GIEO], ''), false);
  assert.equal(proximiteFiliere(GIEO, GIEO), 2);
  assert.equal(proximiteFiliere('Génie Électromécanique', GIP), 1);
  assert.equal(proximiteFiliere('Génie Informatique & IA', 'Intelligence Artificielle et Technologies des Données : Systèmes Industriels'), 1);
  assert.equal(proximiteFiliere('Génie Civil', GIP), 0);
});

test('filtres : tout un parcours, ou une filière', () => {
  assert.equal(filtreFiliere('', 'Génie Civil'), true);
  assert.equal(filtreFiliere('parcours:PEI', 'Mécatronique'), true);
  assert.equal(filtreFiliere('parcours:PEI', 'Génie Civil'), false);
  assert.equal(filtreFiliere(GIEO, 'Génie Industriel'), true, 'un lauréat de l’ancienne appellation reste visible');
  assert.equal(filtreOffre([], 'parcours:PM'), true);
  assert.equal(filtreOffre([GIEO], 'parcours:PEI'), true);
  assert.equal(filtreOffre([GIEO], 'parcours:PM'), false);
});

test('affichage : un parcours complet en un mot, le reste en codes officiels', () => {
  assert.deepEqual(resumeFilieres([GIP, GIEO, GE_DI, GE_MCI, 'Génie Civil']), ['Parcours Électro-industriel', 'GC24']);
  assert.deepEqual(resumeFilieres([GIEO, 'Génie Mécanique']), ['GIEO', 'Génie Mécanique']);
});

test('groupes : un groupe par parcours, nommé par le parcours', () => {
  assert.equal(groupeFiliere(GIEO), 'filiere:electro-industriel');
  assert.equal(groupeFiliere('Génie Industriel'), 'filiere:electro-industriel', 'lauréats et étudiants ensemble');
  assert.equal(groupeFiliere('Génie Informatique & IA'), 'filiere:informatique');
  assert.equal(groupeFiliere(PREPA), 'filiere:classes preparatoires integrees');
  assert.ok(FILIERES.every(f => groupeFiliere(f).length <= 80));
  assert.equal(groupLabel({ profiles: [] }, 'filiere:mecanique'), 'Mécanique');
});

test('offre collée : les filières officielles reconnues', () => {
  const f = t => parseOffre(t).fields.filieres || [];
  assert.deepEqual(f('Stage PFE ingénieur qualité, démarche lean, Kénitra, 6 mois'), [GIP, GIEO]);
  assert.deepEqual(f('PFE : développeur full-stack, Casablanca'), ['Génie Informatique : Ingénierie Logicielle et Systèmes Intelligents']);
  assert.deepEqual(f('Stage machine learning pour la maintenance prédictive'), [GE_DI, GE_MCI, 'Intelligence Artificielle et Technologies des Données : Systèmes Industriels']);
});
