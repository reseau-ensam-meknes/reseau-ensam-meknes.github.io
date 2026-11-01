// Écoles, côté administration : la démo suit ecole_visee(), importer_liste(), couverture_liste(), manquants_liste(),
// vider_liste() et rapport_insertion() de la base (une école à la fois), et le mode réel n'envoie p_ecole que si une école est choisie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ecoleDe, ECOLE_DEFAUT, rapportInsertion } from '../../src/logic.js';
import { SupabaseStore } from '../../src/store.js';

test('l’école d’une ligne : ENSAM Meknès par défaut, comme dans la base', () => {
  assert.equal(ECOLE_DEFAUT, 'ensam-meknes');
  assert.equal(ecoleDe({}), 'ensam-meknes');
  assert.equal(ecoleDe(null), 'ensam-meknes');
  assert.equal(ecoleDe({ ecole: 'autre-ecole' }), 'autre-ecole');
});

test('rapport d’insertion : une école à la fois (inscrits, réponses et liste de cette école)', () => {
  const now = new Date(2026, 9, 20);
  const data = {
    profiles: [{ id: 'm', role: 'laureat', promo: 2025, filiere: 'GI' }, { id: 'a1', role: 'laureat', promo: 2025, filiere: 'GI', ecole: 'autre-ecole' }, { id: 'a2', role: 'laureat', promo: 2025, filiere: 'GI', ecole: 'autre-ecole' }],
    enquetes_insertion: [{ promo: 2025, filiere: 'GI', vague: 6, situation: 'emploi' }, { promo: 2025, filiere: 'GI', vague: 6, situation: 'recherche', ecole: 'autre-ecole' }],
    liste_officielle: [{ promo: 2025, filiere: 'GI', nom: 'A' }, { promo: 2025, filiere: 'GI', nom: 'B', ecole: 'autre-ecole' }, { promo: 2025, filiere: 'GI', nom: 'C', ecole: 'autre-ecole' }],
  };
  const ligne = rows => rows.find(r => r.promo === 2025 && r.vague === 6);
  const mek = ligne(rapportInsertion(data, now, 'ensam-meknes'));
  assert.deepEqual([mek.inscrits, mek.repondants, mek.en_poste, mek.effectif], [1, 1, 1, 1]);
  const autre = ligne(rapportInsertion(data, now, 'autre-ecole'));
  assert.deepEqual([autre.inscrits, autre.repondants, autre.recherche, autre.effectif], [2, 1, 1, 2]);
  assert.equal(ligne(rapportInsertion(data, now)).inscrits, 3, 'sans école : tout (usage interne)');
});

async function demo() {
  globalThis.window ??= {};
  window.ENSAM_CONFIG = {};
  const { createStore } = await import('../../src/store.js');
  const s = await createStore();
  const qui = nom => s.personas().find(p => p._persona.includes(nom));
  return { s, qui, comme: nom => s.switchTo(qui(nom).id) };
}

test('démo : la liste officielle d’une autre école ne touche ni la liste ni les membres de Meknès', async () => {
  const { s, comme } = await demo();
  comme('Admin');
  const etu = s.data.profiles.find(p => p.role === 'etudiant' && !p.verified && p.promo && p.full_name);
  assert.ok(etu, 'un étudiant non vérifié dans la démo');
  const avant = s.data.liste_officielle.length;
  const couvAvant = await s.couvertureListe();
  // Une autre école : le même nom et la même promo qu'un étudiant de Meknès, plus un inconnu
  const r = await s.importerListe([{ nom: etu.full_name, promo: etu.promo }, { nom: 'Inconnu Autre', promo: etu.promo }], false, 'autre-ecole');
  assert.equal(r.importes, 2);
  assert.equal(r.verifies, 0, 'personne de Meknès n’est vérifié par la liste d’une autre école');
  assert.equal(s.byId('profiles', etu.id).verified, false);
  assert.deepEqual(s.data.liste_officielle.slice(avant).map(l => l.ecole), ['autre-ecole', 'autre-ecole']);
  assert.deepEqual(await s.couvertureListe(), couvAvant, 'la couverture de Meknès ne bouge pas');
  assert.deepEqual(await s.couvertureListe('autre-ecole'), [{ promo: etu.promo, filiere: '', total: 2, inscrits: 0 }], 'un inscrit de Meknès ne compte pas pour une autre école');
  assert.deepEqual((await s.manquantsListe(etu.promo, 'autre-ecole')).map(x => x.nom).sort(), [etu.full_name, 'Inconnu Autre'].sort());
  assert.ok(!(await s.manquantsListe(etu.promo)).some(x => x.nom === 'Inconnu Autre'));
  // Remplacer et vider : seulement l'école choisie
  await s.importerListe([{ nom: 'Remplacant Autre', promo: etu.promo }], true, 'autre-ecole');
  assert.deepEqual(s.data.liste_officielle.filter(l => l.ecole === 'autre-ecole').map(l => l.nom), ['Remplacant Autre']);
  assert.equal(s.data.liste_officielle.length, avant + 1, 'la liste de Meknès est intacte');
  assert.equal(await s.viderListe(etu.promo, 'autre-ecole'), 1);
  assert.equal(s.data.liste_officielle.length, avant);
  const deMeknes = s.data.liste_officielle.filter(l => l.promo === etu.promo).length;
  assert.equal(await s.viderListe(etu.promo), deMeknes);
  await assert.rejects(s.viderListe(null), /Choisis une promo/);
  // Un membre ne choisit pas d'école, et rien de tout cela ne lui est ouvert
  comme('Salma');
  assert.equal(s.ecoleVisee('autre-ecole'), 'ensam-meknes');
  await assert.rejects(s.couvertureListe('autre-ecole'), /Réservé/);
  await assert.rejects(s.viderListe(etu.promo, 'autre-ecole'), /Réservé/);
});

test('mode réel : p_ecole seulement quand une école est choisie ; vider passe par vider_liste()', async () => {
  const s = new SupabaseStore({});
  const appels = [];
  s.sb = { rpc: async (fn, args) => { appels.push([fn, args]); return { data: fn === 'vider_liste' ? 3 : [], error: null }; } };
  s.loadTable = async () => {}; s.byId = () => null; s.emit = () => {};
  await s.couvertureListe(); await s.couvertureListe('autre-ecole');
  await s.manquantsListe('2027'); await s.manquantsListe(2027, 'autre-ecole');
  assert.equal(await s.viderListe(2027), 3); await s.viderListe('2027', 'autre-ecole');
  await s.importerListe([{ nom: 'A B', promo: 2027 }]); await s.importerListe([], true, 'autre-ecole');
  await s.rapportInsertion(); await s.rapportInsertion('autre-ecole');
  await s.statsInsertion();
  assert.deepEqual(appels, [
    ['couverture_liste', {}], ['couverture_liste', { p_ecole: 'autre-ecole' }],
    ['manquants_liste', { p_promo: 2027 }], ['manquants_liste', { p_promo: 2027, p_ecole: 'autre-ecole' }],
    ['vider_liste', { p_promo: 2027 }], ['vider_liste', { p_promo: 2027, p_ecole: 'autre-ecole' }],
    ['importer_liste', { p_lignes: [{ nom: 'A B', promo: 2027 }], p_remplacer: false }], ['importer_liste', { p_lignes: [], p_remplacer: true, p_ecole: 'autre-ecole' }],
    ['rapport_insertion', {}], ['rapport_insertion', { p_ecole: 'autre-ecole' }],
    ['stats_insertion', {}],
  ]);
});
