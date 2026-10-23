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

// Réactions sur un réseau qui hésite : deux échecs de suite ne laissent jamais une réaction qui n'existe nulle part
function reactions(serveur = []) {
  const s = new SupabaseStore({}); s.session = { user: { id: 'moi' } };
  const attentes = [];
  const attendre = () => new Promise(ok => attentes.push(ok));
  s.sb = { from: () => ({ upsert: attendre, delete: () => ({ eq: () => ({ eq: attendre }) }) }) };
  s.data.reactions_messages = serveur;
  return { s, attentes };
}
const COUPE = { error: { message: 'Failed to fetch' } };

test('réactions : deux réactions qui échouent, dans un ordre ou dans l’autre, ne laissent rien à l’écran', async () => {
  for (const ordre of [[0, 1], [1, 0]]) {
    const { s, attentes } = reactions();
    const p = [s.reagir('A', '👍').catch(() => 'e'), s.reagir('A', '❤️').catch(() => 'e')];
    for (const i of ordre) attentes[i](COUPE);
    assert.deepEqual(await Promise.all(p), ['e', 'e']);
    assert.deepEqual(s.data.reactions_messages, [], 'ordre ' + ordre);
  }
});

test('réactions : changer d’avis puis échouer remet la réaction enregistrée', async () => {
  const pouce = { id: 'r1', message_id: 'A', user_id: 'moi', emoji: '👍' };
  const { s, attentes } = reactions([pouce]);
  const p = s.reagir('A', '❤️').catch(() => 'e');
  assert.equal(s.data.reactions_messages[0].emoji, '❤️');
  attentes[0](COUPE); await p;
  assert.deepEqual(s.data.reactions_messages, [pouce]);
});

test('réactions : un échec ne touche pas une réaction posée entre-temps sur le même message', async () => {
  const { s, attentes } = reactions();
  const p1 = s.reagir('A', '👍').catch(() => 'e');
  attentes[0](COUPE); await p1;
  const p2 = s.reagir('A', '😂').catch(() => 'e');
  assert.equal(s.data.reactions_messages[0].emoji, '😂');
  attentes[1](COUPE); await p2;
  assert.deepEqual(s.data.reactions_messages, []);
});

test('répondre : base pas encore relue par l’API → le message part quand même, sans la citation', async () => {
  const s = new SupabaseStore({}); s.session = { user: { id: 'moi' } };
  const envois = [];
  s.sb = { from: () => ({ insert: row => ({ select: () => ({ single: async () => {
    envois.push({ ...row });
    return 'reponse_a' in row ? { data: null, error: { code: 'PGRST204', message: "Could not find the 'reponse_a' column of 'messages' in the schema cache" } }
      : { data: { id: 'm1', ...row }, error: null };
  } }) }) }) };
  const m = await s.envoyerMessage({ dest: 'lui', body: 'Salut', reponse_a: 'm0' });
  assert.equal(envois.length, 2); assert.equal('reponse_a' in envois[1], false);
  assert.equal(m.id, 'm1'); assert.equal(s.data.messages[0].id, 'm1');
});

test('répondre : une autre erreur ne renvoie pas le message en double', async () => {
  const s = new SupabaseStore({}); s.session = { user: { id: 'moi' } };
  let n = 0;
  s.sb = { from: () => ({ insert: () => ({ select: () => ({ single: async () => { n++; return { data: null, error: { code: '42501', message: 'new row violates row-level security policy for table "messages"' } }; } }) }) }) };
  await assert.rejects(() => s.envoyerMessage({ dest: 'lui', body: 'Salut', reponse_a: 'm0' }));
  assert.equal(n, 1);
});
