// Écoles, côté administration : la démo suit ecole_visee(), importer_liste(), couverture_liste(), manquants_liste(),
// vider_liste() et rapport_insertion() de la base (une école à la fois), et le mode réel n'envoie p_ecole que si une école est choisie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ecoleDe, ECOLE_DEFAUT, rapportInsertion, surListeOfficielle } from '../../src/logic.js';
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

test('« Sur la liste officielle » (Membres) : seules les lignes de son école comptent, par nom et promo ou par email', () => {
  const salma = { full_name: 'Salma Bennani', promo: 2027 }; const karim = { full_name: 'Karim Alaoui', promo: 2027, ecole: 'autre-ecole' };
  const liste = [{ nom: 'BENNANI Salma', promo: 2027, ecole: 'autre-ecole' }, { nom: 'Yassir Kabbaj', promo: 2027, email: 'salma@exemple.ma', ecole: 'autre-ecole' }];
  assert.equal(surListeOfficielle(liste, salma, 'salma@exemple.ma'), null, 'aucune ligne de sa promo dans son école : pas de badge');
  assert.equal(surListeOfficielle(liste, karim, 'karim@exemple.ma'), false, 'la liste de son école a sa promo, sans lui');
  assert.equal(surListeOfficielle([...liste, { nom: 'Omar Tazi', promo: 2027 }], salma, 'salma@exemple.ma'), false, 'homonyme et email trouvés dans une autre école seulement');
  assert.equal(surListeOfficielle([...liste, { nom: 'Salma BENNANI', promo: 2027 }], salma, ''), true);
  assert.equal(surListeOfficielle([{ nom: 'Autre Nom', promo: 2027 }, { nom: 'X Y', promo: 2020, email: 'salma@exemple.ma' }], salma, 'Salma@Exemple.ma'), true, 'même email');
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
  s.data.ecoles = [{ slug: 'autre-ecole', nom: 'Autre École', ouverte: true }];
  await assert.rejects(s.couvertureListe('inconnue'), /École inconnue/);
  await assert.rejects(s.importerListe([{ nom: 'Fantome Test', promo: 2027 }], false, 'ensam-meknés'), /École inconnue/);
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
  // Enregistrer son profil ne le vérifie pas non plus par la liste d'une autre école (dansListe)
  s.switchTo(etu.id); await s.update('profiles', etu.id, { bio: 'Étudiant en génie industriel.' });
  assert.equal(s.byId('profiles', etu.id).verified, false);
  comme('Admin');
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

test('démo : rapport et chiffres d’insertion d’une école ; la réponse prend l’école de qui répond', async () => {
  const { s, comme } = await demo();
  s.data.ecoles = [{ slug: 'autre-ecole', nom: 'Autre École', ouverte: true }];
  const an = new Date().getFullYear();
  const l = s.data.profiles.find(p => p.role === 'laureat' && p.filiere && p.promo <= an - 1 && p.promo >= an - 6);
  assert.ok(l, 'une cohorte de lauréats dans la démo');
  comme('Admin');
  const rapportAvant = await s.rapportInsertion(); const statsAvant = await s.statsInsertion();
  // Une réponse d'une autre école, dans la même promo, filière et vague qu'une cohorte de Meknès
  s.data.enquetes_insertion.push({ id: 'enq-autre', user_id: null, vague: 6, promo: l.promo, filiere: l.filiere, situation: 'recherche', canal: 'linkedin', ecole: 'autre-ecole' });
  assert.deepEqual(await s.rapportInsertion(), rapportAvant, 'le rapport de Meknès ne bouge pas');
  assert.deepEqual(await s.statsInsertion(), statsAvant, 'les chiffres de Meknès ne bougent pas');
  assert.deepEqual((await s.statsInsertion('autre-ecole')).map(g => [g.promo, g.n]), [[l.promo, 1]]);
  comme('Salma');
  assert.deepEqual(await s.statsInsertion('autre-ecole'), await s.statsInsertion(), 'un membre ne choisit pas une autre école');
  // La règle de démo d'enquetes_insertion : l'école du compte qui répond, quoi qu'il envoie
  const laureat = s.data.profiles.find(p => p.role === 'laureat' && !p._persona && !s.data.enquetes_insertion.some(e => e.user_id === p.id && e.vague === 12));
  s.switchTo(laureat.id);
  await s.insert('enquetes_insertion', { vague: 12, promo: laureat.promo, situation: 'emploi', ecole: 'autre-ecole' });
  assert.equal(s.data.enquetes_insertion.find(e => e.user_id === laureat.id && e.vague === 12).ecole, 'ensam-meknes');
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

test('mode réel, base pas encore mise à jour : « Vider la liste » marche encore (ancien delete, l’école de l’administrateur)', async () => {
  const s = new SupabaseStore({});
  const appels = [];
  s.sb = {
    rpc: async (fn, args) => { appels.push(['rpc', fn, args]); return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.vider_liste(p_promo) in the schema cache' } }; },
    from: t => ({ delete: () => ({ eq: async (k, v) => { appels.push(['delete', t, k, v]); return { data: null, error: null }; } }) }),
  };
  await s.viderListe('2027');
  assert.deepEqual(appels, [['rpc', 'vider_liste', { p_promo: 2027 }], ['delete', 'liste_officielle', 'promo', 2027]]);
  // Une autre école demandée : jamais l'ancien delete (il viderait la promo partout)
  appels.length = 0;
  await assert.rejects(s.viderListe(2027, 'autre-ecole'));
  assert.deepEqual(appels.map(a => a[0]), ['rpc']);
});

test('démo : « Attribuer les parrains » donne à un 3A un lauréat de son école, jamais d’une autre (comme donner_parrain)', async () => {
  const { s, comme } = await demo();
  comme('Admin');
  const { seasonOf, niveauOf } = await import('../../src/logic.js');
  const S = seasonOf();
  // Un lauréat volontaire de Meknès qui a encore de la place (3 filleuls au plus par année)
  const lau = s.data.profiles.find(p => p.role === 'laureat' && p.parrain_dispo && p.filiere
    && s.data.parrainages.filter(x => x.parrain_id === p.id && x.saison === S).length < 3);
  assert.ok(lau, 'un lauréat volontaire avec de la place dans la démo');
  // Un 3A d'une autre école, de la filière de ce lauréat de Meknès
  const etu = { id: 'etu-autre-3a', role: 'etudiant', full_name: 'Test Autre', promo: S + 3, filiere: lau.filiere, ecole: 'autre-ecole', created_at: new Date().toISOString() };
  assert.equal(niveauOf(etu, S), 3);
  s.data.profiles = [...s.data.profiles, etu];
  await s.attribuerParrains();
  assert.equal(s.data.parrainages.filter(x => x.filleul_id === etu.id).length, 0, 'aucun lauréat volontaire de son école : pas de parrain');
  const sien = { id: 'lau-autre', role: 'laureat', full_name: 'Lauréat Autre', promo: S - 3, filiere: lau.filiere, parrain_dispo: true, ecole: 'autre-ecole', created_at: new Date().toISOString() };
  s.data.profiles = [...s.data.profiles, sien];
  await s.attribuerParrains();
  assert.deepEqual(s.data.parrainages.filter(x => x.filleul_id === etu.id).map(x => x.parrain_id), ['lau-autre']);
});
