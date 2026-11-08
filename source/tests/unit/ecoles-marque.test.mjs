// La marque de la barre latérale (et du haut de l'écran du téléphone, son lien « Accueil ») dit l'école du membre :
// « Réseau ENSAM » et « Meknès · Lauréats & étudiants » pour l'ENSAM Meknès, comme avant ; le nom court (sinon le nom) et
// la ville d'une autre école ; sa ligne pas (encore) là : « Réseau ENSAM », sans ville, jamais Meknès.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marqueDuMembre, NOMS_MEKNES } from '../../src/logic.js';

const FES = { slug: 'ensa-fes', nom: 'ENSA Fès', nom_court: 'ENSA', ville: 'Fès', nom_ar: 'ENSA فاس', couleur: '#225588', ouverte: true, created_at: '2026-10-01T00:00:00Z' };
const FST = { slug: 'fst-settat', nom: 'FST Settat', nom_court: 'FST', ville: 'Settat', ouverte: true, created_at: '2026-10-02T00:00:00Z' };
const INSTITUT = { slug: 'institut-exemple', nom: 'Institut exemple', nom_ar: 'معهد مثال', ouverte: true, created_at: '2026-10-03T00:00:00Z' };
const MEKNES = { slug: 'ensam-meknes', nom: 'ENSAM Meknès', ouverte: true, created_at: '2026-10-21T00:00:00Z' };
const ECOLES = [MEKNES, FES, FST, INSTITUT];
const marque = (ecoles, me) => { const m = marqueDuMembre({ ecoles }, me); return [m.titre, m.sous, m.nomAr]; };

test('marque de l’ENSAM Meknès : « Réseau ENSAM » et « Meknès · Lauréats & étudiants », comme avant, avec ou sans sa ligne', () => {
  const avant = ['Réseau ENSAM', 'Meknès · Lauréats & étudiants', 'ENSAM'];
  for (const me of [{ ecole: 'ensam-meknes' }, { role: 'etudiant' }, { ecole: null }, { ecole: '' }, { role: 'admin' }, null, undefined]) {
    assert.deepEqual(marque(ECOLES, me), avant, JSON.stringify(me));
    assert.deepEqual(marque([], me), avant);
    assert.deepEqual(marque(undefined, me), avant);
  }
  // Sa ligne de la table des écoles ne change pas ses textes (ceux d'avant)
  assert.deepEqual(marque([{ slug: 'ensam-meknes', nom: 'Autre nom', nom_court: 'AN', ville: 'Ailleurs' }], { ecole: 'ensam-meknes' }), avant);
  assert.deepEqual(marqueDuMembre(null, null), { titre: 'Réseau ENSAM', sous: 'Meknès · Lauréats & étudiants', nomAr: 'ENSAM' });
  assert.equal(NOMS_MEKNES.ville, 'Meknès');
});

test('marque d’une autre école : son nom court et sa ville ; son nom seul ; sa ligne pas là : « Réseau ENSAM », jamais Meknès', () => {
  // Nom court et ville
  assert.deepEqual(marque(ECOLES, { ecole: 'ensa-fes' }), ['Réseau ENSA', 'Fès · Lauréats & étudiants', 'ENSA']);
  assert.deepEqual(marque(ECOLES, { ecole: 'fst-settat', role: 'laureat' }), ['Réseau FST', 'Settat · Lauréats & étudiants', 'FST']);
  // Son nom seulement (ni nom court ni ville) : son nom, et son nom arabe s'il en a un
  assert.deepEqual(marque(ECOLES, { ecole: 'institut-exemple' }), ['Réseau Institut exemple', 'Lauréats & étudiants', 'معهد مثال']);
  assert.deepEqual(marque([{ slug: 'x-y', nom: 'École exemple' }], { ecole: 'x-y' }), ['Réseau École exemple', 'Lauréats & étudiants', 'École exemple']);
  // Un nom court sans nom ni ville ; des espaces resserrés ; une école pas encore ouverte (ses membres lisent son nom)
  assert.deepEqual(marque([{ slug: 'x-y', nom_court: '  EST ', ville: ' Oujda ' }], { ecole: 'x-y' }), ['Réseau EST', 'Oujda · Lauréats & étudiants', 'EST']);
  assert.deepEqual(marque([{ ...FES, nom_court: ' ENSA \n Fès ' }], { ecole: 'ensa-fes' }), ['Réseau ENSA Fès', 'Fès · Lauréats & étudiants', 'ENSA Fès']);
  assert.deepEqual(marque([{ ...FES, ouverte: false }], { ecole: 'ensa-fes', role: 'admin' }), ['Réseau ENSA', 'Fès · Lauréats & étudiants', 'ENSA']);
  // Sa ligne pas (encore) là (copie de l'appareil d'avant, base pas à jour) : « Réseau ENSAM », sans ville
  for (const ecoles of [[], undefined, [MEKNES, FST]]) assert.deepEqual(marque(ecoles, { ecole: 'ensa-fes' }), ['Réseau ENSAM', 'Lauréats & étudiants', 'ENSAM']);
  for (const [e, me] of [[ECOLES, { ecole: 'ensa-fes' }], [ECOLES, { ecole: 'institut-exemple' }], [[], { ecole: 'ensa-fes' }], [[{ slug: 'x-y', nom: 'Ailleurs' }], { ecole: 'x-y' }]]) {
    for (const x of marque(e, me)) assert.doesNotMatch(x, /Meknès|مكناس/, `${me.ecole} : ${x}`);
  }
});
