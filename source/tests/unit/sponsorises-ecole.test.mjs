// Cartes sponsorisées et écoles : l'administration du réseau (ENSAM Meknès) lit et écrit les cartes de toutes les écoles ;
// celle d'une autre école lit les cartes de son école et celles de toutes les écoles (sans école), et n'écrit que pour la
// sienne. Les règles de la base : « lecture membres », « ecriture admin », « modif admin », « suppression admin »,
// protect_sponsorise et bilan_sponsorises (supabase/schema.sql). Une carte sans école qu'elle écrit est de son école ; une
// autre école est refusée (« new row violates row-level security policy », dit « Action non autorisée pour ton compte. ») ;
// modifier ou supprimer une carte qu'elle ne gère pas ne touche aucune ligne, sans erreur de la base : « exiger » le dit.
// La démo (DemoStore) suit les mêmes règles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminDuReseau, sponsoriseLisible, sponsoriseModifiable, jourLocal } from '../../src/logic.js';

const CASA = 'ensam-casa';
const RESEAU = { id: 'r', role: 'admin' }, MEKNES = { id: 'm', role: 'admin', ecole: 'ensam-meknes' }, ADMIN_CASA = { id: 'c', role: 'admin', ecole: CASA };
const LAUREAT = { id: 'l', role: 'laureat', ecole: CASA }, ETUDIANT = { id: 'e', role: 'etudiant' };
const carte = ecole => ({ id: 'x', ecole });
const ECOLES = [null, undefined, '', 'ensam-meknes', CASA, 'ensa-fes'];

test('qui gère quelle carte : le réseau toutes ; une école la sienne, et lit aussi celles de toutes les écoles', () => {
  assert.deepEqual([RESEAU, MEKNES, ADMIN_CASA, LAUREAT, ETUDIANT, null].map(adminDuReseau), [true, true, false, false, false, false]);
  for (const me of [RESEAU, MEKNES]) {
    assert.ok(ECOLES.every(e => sponsoriseLisible(carte(e), me) && sponsoriseModifiable(carte(e), me)), 'le réseau : toutes les cartes');
  }
  assert.deepEqual(ECOLES.map(e => sponsoriseLisible(carte(e), ADMIN_CASA)), [true, true, true, false, true, false], 'son école et toutes les écoles');
  assert.deepEqual(ECOLES.map(e => sponsoriseModifiable(carte(e), ADMIN_CASA)), [false, false, false, false, true, false], 'son école seulement');
  for (const me of [LAUREAT, ETUDIANT, null]) assert.ok(ECOLES.every(e => !sponsoriseModifiable(carte(e), me) && !sponsoriseLisible(carte(e), me)), 'un membre n’a pas de console');
  assert.equal(sponsoriseModifiable(null, ADMIN_CASA), false);
});

// ---------------------------------------------------------------------------
// La démo : mêmes règles que la base
// ---------------------------------------------------------------------------
async function demo() {
  globalThis.window ??= {};
  window.ENSAM_CONFIG = {};
  const { createStore } = await import('../../src/store.js');
  const s = await createStore();
  const qui = nom => s.personas().find(p => p._persona.includes(nom));
  return { s, qui, comme: nom => s.switchTo(qui(nom).id) };
}
const NOUVELLE = { entreprise: 'Atelier Exemple', titre: 'Préparer son départ en Allemagne', texte: 'Un accompagnement pour le visa et le logement.', lien: 'https://example.org/depart', public: 'etudiants', annees: [5], filieres: [], debut: jourLocal(), fin: jourLocal(Date.now() + 30 * 864e5) };
const EXIGER = 'Rien n’a changé : cette carte n’est plus gérée par ton école.';
// La carte de la démo (toutes les écoles), une carte de l'ENSAM Meknès et une de Casa, écrites par l'administration du
// réseau ; puis l'administration de Casa (une admin de la démo passée à Casa) prend la main
async function avecCasa() {
  const d = await demo();
  d.comme('Admin');
  d.toutes = d.s.data.sponsorises[0];
  d.meknes = await d.s.insert('sponsorises', { ...NOUVELLE, titre: 'Carte de l’ENSAM Meknès', ecole: 'ensam-meknes' });
  d.casa = await d.s.insert('sponsorises', { ...NOUVELLE, titre: 'Carte de Casa', ecole: CASA });
  d.s.data.profiles.push({ id: 'adm-casa', role: 'admin', ecole: CASA, full_name: 'Admin Casa', verified: true, admin_ok: true, promo: 2012, filiere: 'Génie Industriel' });
  d.s.switchTo('adm-casa');
  d.photo = () => JSON.stringify(d.s.data.sponsorises);
  return d;
}

test('démo, administration d’une école : une carte écrite sans école est de son école ; pour une autre école, refusée', async () => {
  const { s, photo } = await avecCasa();
  assert.equal(s.me.id, 'adm-casa');
  const r = [await s.insert('sponsorises', { ...NOUVELLE }), await s.insert('sponsorises', { ...NOUVELLE, ecole: null }), await s.insert('sponsorises', { ...NOUVELLE, ecole: '' })];
  assert.deepEqual(r.map(x => x.ecole), [CASA, CASA, CASA]);
  assert.ok(r.every(x => x.created_by === 'adm-casa' && x.actif === true));
  const avant = photo();
  for (const ecole of ['ensam-meknes', 'ensa-fes']) await assert.rejects(s.insert('sponsorises', { ...NOUVELLE, ecole }), { message: 'Action non autorisée pour ton compte.' });
  assert.equal(photo(), avant, 'rien d’écrit');
});

test('démo, administration d’une école : elle modifie, arrête et retire ses cartes ; elle ne les envoie pas à une autre école', async () => {
  const { s, casa } = await avecCasa();
  const m = await s.update('sponsorises', casa.id, { actif: false, titre: '  Carte de Casa, modifiée ' }, { exiger: EXIGER });
  assert.deepEqual([m.actif, m.titre, m.ecole, m.created_by], [false, 'Carte de Casa, modifiée', CASA, casa.created_by]);
  assert.equal((await s.update('sponsorises', casa.id, { ecole: null })).ecole, CASA, 'sans école : la sienne');
  await assert.rejects(s.update('sponsorises', casa.id, { ecole: 'ensam-meknes' }), { message: 'Action non autorisée pour ton compte.' });
  assert.equal(s.byId('sponsorises', casa.id).ecole, CASA, 'restée à Casa');
  await s.remove('sponsorises', casa.id, { exiger: EXIGER });
  assert.ok(!s.byId('sponsorises', casa.id), 'retirée');
});

test('démo, administration d’une école : une carte de toutes les écoles ou d’une autre école ne bouge pas (aucune ligne) ; « exiger » le dit', async () => {
  const { s, toutes, meknes, photo } = await avecCasa();
  const avant = photo();
  for (const x of [toutes, meknes]) {
    await assert.rejects(s.update('sponsorises', x.id, { actif: false }, { exiger: EXIGER }), { message: EXIGER });
    // Sans « exiger » : comme en ligne, où la base ne renvoie aucune ligne à la place de celle attendue
    await assert.rejects(s.update('sponsorises', x.id, { titre: 'Carte reprise par Casa' }), { message: 'Cette action n’est plus possible. Recharge la page.' });
    await assert.rejects(s.remove('sponsorises', x.id, { exiger: EXIGER }), { message: EXIGER });
    await s.remove('sponsorises', x.id); // sans « exiger » : aucune ligne, aucune erreur, comme la base
  }
  assert.equal(photo(), avant, 'rien n’a changé');
  await assert.rejects(s.update('sponsorises', 'sp-absente', { actif: false }, { exiger: EXIGER }), { message: EXIGER }, 'une carte retirée entre-temps');
});

test('démo, administration d’une école : les totaux de ses cartes et de celles de toutes les écoles, pas d’une autre école', async () => {
  const { s, toutes, meknes, casa } = await avecCasa();
  const ids = (await s.bilanSponsorises()).map(x => x.sponsorise_id);
  assert.deepEqual(ids.sort(), [casa.id, toutes.id].sort());
  assert.ok(!ids.includes(meknes.id));
});

// ---------------------------------------------------------------------------
// En ligne : la base ne touche aucune ligne (PGRST116 après .select().single()) ; « exiger » le dit, et les cartes sont
// relues pour que l'écran montre la carte telle qu'elle est maintenant
// ---------------------------------------------------------------------------
test('en ligne : une carte qu’elle ne gère plus, « exiger » le dit et relit les cartes ; sans « exiger », comme avant', async () => {
  const { SupabaseStore } = await import('../../src/store.js');
  const s = new SupabaseStore({});
  const appels = [];
  const AUCUNE = { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains 0 rows' } };
  s.sb = { from: t => ({ update: patch => ({ eq: (k, v) => ({ select: () => ({ single: async () => { appels.push(['update', t, patch, k, v]); return AUCUNE; } }) }) }) }) };
  s.loadTable = async t => { appels.push(['relue', t]); };
  let emis = 0; s.emit = () => { emis++; };
  await assert.rejects(s.update('sponsorises', 'sp-1', { actif: false }, { exiger: EXIGER }), { message: EXIGER });
  assert.deepEqual(appels, [['update', 'sponsorises', { actif: false }, 'id', 'sp-1'], ['relue', 'sponsorises']]);
  assert.equal(emis, 1);
  // Sans « exiger » (l'administration du réseau, tous les autres écrans) : la même requête et le même message qu'avant
  appels.length = 0; emis = 0;
  await assert.rejects(s.update('sponsorises', 'sp-1', { actif: false }), { message: 'Cette action n’est plus possible. Recharge la page.' });
  assert.deepEqual(appels, [['update', 'sponsorises', { actif: false }, 'id', 'sp-1']]);
  assert.equal(emis, 0);
});

test('démo, administration du réseau : comme avant, toutes les écoles (une carte sans école reste pour toutes)', async () => {
  const { s, comme } = await demo();
  comme('Admin');
  const toutes = await s.insert('sponsorises', { ...NOUVELLE, ecole: null });
  assert.equal(toutes.ecole, null);
  const casa = await s.insert('sponsorises', { ...NOUVELLE, ecole: CASA });
  assert.equal(casa.ecole, CASA);
  assert.equal((await s.update('sponsorises', casa.id, { ecole: null })).ecole, null);
  assert.equal((await s.update('sponsorises', s.data.sponsorises.at(-1).id, { actif: false }, { exiger: EXIGER })).actif, false);
  await s.remove('sponsorises', casa.id, { exiger: EXIGER });
  assert.ok(!s.byId('sponsorises', casa.id), 'retirée');
  assert.equal((await s.bilanSponsorises()).length, s.data.sponsorises.length);
});
