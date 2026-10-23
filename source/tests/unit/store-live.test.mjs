// Mode réel : une session expirée ou une coupure réseau ne vide jamais les listes et n'abandonne pas les vues
// (un membre a vu son profil se comporter bizarrement sur un téléphone Android dont la session avait expiré)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseStore } from '../../src/store.js';

// Un faux client Supabase : chaque lecture répond selon le nom de la table ou de la vue lue
function magasin(reponse) {
  const s = new SupabaseStore({});
  const lus = [];
  s.sb = { from: nom => ({ select: () => ({ order: () => ({ range: async () => { lus.push(nom); return reponse(nom, lus.length); } }) }) }) };
  return { s, lus };
}
const EXPIREE = { data: null, error: { code: 'PGRST301', message: 'JWT expired' } };
const REFUS = { data: null, error: { code: '42501', message: 'permission denied for view profils' } };

test('session expirée : les profils déjà là restent, et la vue protégée n’est pas abandonnée', async () => {
  const { s, lus } = magasin(() => REFUS);
  s.data.profiles = [{ id: 'moi' }, { id: 'autre' }];
  await s.loadTable('profiles');
  assert.deepEqual(s.data.profiles.map(p => p.id), ['moi', 'autre']);
  assert.notEqual(s.vues.profiles, false);
  assert.deepEqual(lus, ['profils', 'profils'], 'un seul nouvel essai, toujours sur la vue');
});

test('coupure passagère : le deuxième essai suffit', async () => {
  const { s } = magasin((nom, n) => (n === 1 ? EXPIREE : { data: [{ id: 'a' }], error: null }));
  await s.loadTable('profiles');
  assert.deepEqual(s.data.profiles, [{ id: 'a' }]);
});

test('table facultative : une session expirée ne vide pas les messages ni les coordonnées', async () => {
  const { s } = magasin(() => EXPIREE);
  s.data.messages = [{ id: 'm1' }]; s.data.coordonnees = [{ id: 'moi', telephone: '06' }];
  await s.loadTable('messages'); await s.loadTable('coordonnees');
  assert.deepEqual(s.data.messages, [{ id: 'm1' }]);
  assert.deepEqual(s.data.coordonnees, [{ id: 'moi', telephone: '06' }]);
  assert.equal(s.absentes?.has('messages') || false, false);
});

test('base pas encore à jour : vue absente → la table ; table facultative absente → liste vide et fonctions cachées', async () => {
  const { s, lus } = magasin(nom => (nom === 'profils' ? { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.profils' in the schema cache" } }
    : nom === 'reactions_messages' ? { data: null, error: { code: '42P01', message: 'relation "public.reactions_messages" does not exist' } } : { data: [{ id: 'x' }], error: null }));
  await s.loadTable('profiles');
  assert.equal(s.vues.profiles, false); assert.deepEqual(lus, ['profils', 'profiles']); assert.deepEqual(s.data.profiles, [{ id: 'x' }]);
  s.data.reactions_messages = [{ id: 'vieux' }];
  await s.loadTable('reactions_messages');
  assert.deepEqual(s.data.reactions_messages, []); assert.equal(s.peutReagir(), false);
});

test('premier chargement sans rien en main : une table obligatoire en erreur le dit (écran calme « Réessayer »)', async () => {
  const { s } = magasin(() => EXPIREE);
  await assert.rejects(() => s.loadTable('offers'));
});
