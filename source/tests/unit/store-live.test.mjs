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

// Lot mouvement · C : la copie de l'accueil gardée sur l'appareil, et le jeton refusé renouvelé une fois
import { pourCache } from '../../src/store.js';

test('copie gardée sur l’appareil : rien de plus sur les autres que ce que l’écran montre déjà', () => {
  const data = {
    coordonnees: [{ id: 'moi', telephone: '06' }, { id: 'autre', telephone: '07' }],
    enquetes_insertion: [{ id: 'e1', user_id: 'moi' }, { id: 'e2', user_id: 'autre' }],
    signalements: [{ id: 's1', status: 'ouvert', created_at: 'x', motif: 'détail', cible_id: 'c' }, { id: 's2', status: 'traite' }],
    groupe_messages: [{ id: 'g1', body: 'groupe' }],
    messages: [
      { id: 'm1', author_id: 'moi', dest_id: 'a', created_at: '2026-01-01', lu_at: '2026-01-01' },
      { id: 'm2', author_id: 'a', dest_id: 'moi', created_at: '2026-01-02', lu_at: '2026-01-02' },
      { id: 'm3', author_id: 'b', dest_id: 'moi', created_at: '2026-01-01', lu_at: null },
      { id: 'm4', author_id: 'b', dest_id: 'moi', created_at: '2026-01-03', lu_at: null },
      { id: 'm5', author_id: 'x', dest_id: 'y', created_at: '2026-01-03' },
    ],
    profiles: [{ id: 'moi' }, { id: 'autre' }],
  };
  const c = pourCache(data, 'moi');
  assert.deepEqual(c.coordonnees, [{ id: 'moi', telephone: '06' }]);
  assert.deepEqual(c.enquetes_insertion.map(e => e.id), ['e1']);
  assert.deepEqual(c.signalements, [{ id: 's1', status: 'ouvert', created_at: 'x' }], 'seulement le nombre à traiter');
  assert.deepEqual(c.groupe_messages, []);
  assert.deepEqual(c.messages.map(m => m.id), ['m2', 'm3', 'm4'], 'le dernier mot de chaque conversation et les non lus');
  assert.deepEqual(c.profiles, data.profiles);
});

function renouvelable({ reponses, nouveau = 'neuf', gardee = { user: { id: 'moi' }, refresh_token: 'r', access_token: 'vieux' } }) {
  const s = new SupabaseStore({ supabaseAnonKey: 'cle' });
  const envoyes = [];
  let renouvellements = 0;
  s.sessionGardee = () => gardee;
  s.renouveler = async () => { renouvellements++; if (!nouveau) return null; gardee = { ...gardee, access_token: nouveau }; return { access_token: nouveau }; };
  const vrai = globalThis.fetch;
  globalThis.fetch = async (u, o) => { const h = new Headers(o.headers); envoyes.push(h.get('Authorization')); const [code, corps] = reponses.shift(); return new Response(JSON.stringify(corps), { status: code }); };
  return { s, envoyes, renouvellements: () => renouvellements, fin: () => { globalThis.fetch = vrai; } };
}
const JWT_EXPIRE = [401, { code: 'PGRST301', message: 'JWT expired' }];

test('jeton expiré refusé par la base : renouvelé, la requête refaite une seule fois avec le nouveau jeton', async () => {
  const r = renouvelable({ reponses: [JWT_EXPIRE, [200, [{ id: 'a' }]]] });
  try {
    const res = await r.s.fetchRenouvele('https://x.supabase.co/rest/v1/offers', { headers: { Authorization: 'Bearer vieux' } });
    assert.equal(res.status, 200);
    assert.deepEqual(r.envoyes, ['Bearer vieux', 'Bearer neuf']);
    assert.equal(r.renouvellements(), 1);
  } finally { r.fin(); }
});

test('renouvellement impossible : la réponse refusée est rendue telle quelle, sans boucle', async () => {
  const r = renouvelable({ reponses: [JWT_EXPIRE], nouveau: null });
  try {
    const res = await r.s.fetchRenouvele('https://x.supabase.co/rest/v1/offers', { headers: { Authorization: 'Bearer vieux' } });
    assert.equal(res.status, 401);
    assert.equal(r.envoyes.length, 1);
  } finally { r.fin(); }
});

test('un refus qui n’est pas un jeton expiré (droits) n’est pas renouvelé', async () => {
  const r = renouvelable({ reponses: [[403, { code: '42501', message: 'permission denied for table offers' }]] });
  try {
    const res = await r.s.fetchRenouvele('https://x.supabase.co/rest/v1/offers', { headers: { Authorization: 'Bearer vieux' } });
    assert.equal(res.status, 403);
    assert.equal(r.renouvellements(), 0);
  } finally { r.fin(); }
});

test('une autre requête a déjà renouvelé : le nouveau jeton est repris, sans second renouvellement', async () => {
  const r = renouvelable({ reponses: [JWT_EXPIRE, [200, []]], gardee: { user: { id: 'moi' }, refresh_token: 'r2', access_token: 'deja-neuf' } });
  try {
    await r.s.fetchRenouvele('https://x.supabase.co/rest/v1/offers', { headers: { Authorization: 'Bearer vieux' } });
    assert.deepEqual(r.envoyes, ['Bearer vieux', 'Bearer deja-neuf']);
    assert.equal(r.renouvellements(), 0);
  } finally { r.fin(); }
});

test('session gardée mais requête partie sans le compte (clé publique) : renouvelée d’abord, sinon c’est le réseau', async () => {
  let r = renouvelable({ reponses: [[200, []]] });
  try {
    await r.s.fetchRenouvele('https://x.supabase.co/rest/v1/offers', { headers: { Authorization: 'Bearer cle' } });
    assert.deepEqual(r.envoyes, ['Bearer neuf']);
  } finally { r.fin(); }
  r = renouvelable({ reponses: [], nouveau: null });
  try {
    await assert.rejects(r.s.fetchRenouvele('https://x.supabase.co/rest/v1/offers', { headers: { Authorization: 'Bearer cle' } }), /Failed to fetch/);
    assert.equal(r.envoyes.length, 0);
  } finally { r.fin(); }
});

// Changement de compte sans déconnexion (autre compte connecté dans un autre onglet) : rien du premier compte ne reste
// en mémoire ni n'est écrit dans la copie de l'appareil sous le second, même si une table ne se charge pas
test('autre compte connecté sans déconnexion : les lignes du premier ne restent pas, ni dans la copie de l’appareil', async () => {
  const { pourCache, TABLES } = await import('../../src/store.js');
  const A = 'aaaa', B = 'bbbb';
  globalThis.location ||= { hash: '#accueil', replace() {} };
  const s = new SupabaseStore({ supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k' });
  s.mode = 'live';
  s.session = { user: { id: A } };
  for (const t of TABLES) s.data[t] = [];
  s.data.profiles = [{ id: A, full_name: 'Alice' }, { id: B, full_name: 'Bob' }];
  s.data.applications = [{ id: 'cand-A', student_id: A, offer_id: 'o1', lettre: 'lettre privée d’Alice' }];
  s.data.shortlists = [{ id: 'sl-A', owner_id: A, note: 'note privée' }];
  s.me = s.data.profiles[0];
  // Ce que B lit : tout répond, sauf applications et shortlists (réseau qui hésite), qui échouent deux fois
  s.sb = {
    from: nom => ({ select: () => ({ order: () => ({ range: async () => (['applications', 'shortlists'].includes(nom)
      ? { data: null, error: { message: 'Failed to fetch' } }
      : { data: nom === 'profils' ? [{ id: A, full_name: 'Alice' }, { id: B, full_name: 'Bob' }] : [], error: null }) }) }) }),
    rpc: async () => ({ data: null, error: { message: 'x' } }),
    channel: () => ({ on() { return this; }, subscribe() {} }),
    auth: { getSession: async () => ({ data: { session: null } }) },
  };
  try {
    await s.changementSession('SIGNED_IN', { user: { id: B } });
    assert.equal(s.userId, B);
    assert.equal(s.me?.id, B, 'le nouveau compte, avec ce qui a pu être lu');
    assert.deepEqual(s.data.applications, []);
    assert.deepEqual(s.data.shortlists, []);
    assert.deepEqual(pourCache(s.data, s.userId).applications, []);
    // Et si me n'est pas (encore) le compte de la session, la copie n'est jamais écrite
    const ecrits = [];
    s.me = { id: A };
    const avant = globalThis.indexedDB;
    globalThis.indexedDB = { open() { ecrits.push('open'); throw new Error('non'); } };
    try {
      s.ecrireCacheMaintenant();
      assert.deepEqual(ecrits, []);
      s.me = s.byId('profiles', B);
      s.ecrireCacheMaintenant();
      assert.deepEqual(ecrits, ['open'], 'avec le bon compte, la copie est écrite');
    } finally { globalThis.indexedDB = avant; }
  } finally { clearTimeout(s.minuteurEssai); clearTimeout(s.minuteurCache); }
});

// Fondateur qui dit non (ou plus maintenant) : un visiteur a pu garder un lien signé vers sa photo, d'une durée qu'il a
// choisie. La photo change de nom (copie, profil, puis l'original supprimé) : l'ancien lien ne mène plus à rien.
function magasinPhoto({ copieOk = true, majOk = true } = {}) {
  const U = '11111111-1111-4111-8111-111111111111';
  const s = new SupabaseStore({ supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k' });
  const journal = [];
  s.session = { user: { id: U } };
  s.data.profiles = [{ id: U, full_name: 'Lauréat Fondateur', role: 'laureat', photo_path: `${U}/photo-1.webp`, fondateur_public: true }];
  s.me = s.data.profiles[0];
  s.sb = {
    from: () => ({ update: patch => ({ eq: () => ({ select: () => ({ single: async () => {
      journal.push(['profil', patch]);
      return majOk ? { data: { ...s.data.profiles[0], ...patch }, error: null } : { data: null, error: { message: 'Failed to fetch' } };
    } }) }) }) }),
    storage: { from: b => ({
      copy: async (de, vers) => { journal.push(['copie', b, de, vers]); return copieOk ? { data: { path: vers }, error: null } : { data: null, error: { message: 'Object not found' } }; },
      remove: async l => { journal.push(['suppression', b, ...l]); return { data: l, error: null }; },
    }) },
  };
  s.emit = () => {};
  return { s, journal, U };
}
test('fondateur qui ne veut plus être sur la page d’entrée : sa photo change de nom, l’ancienne est supprimée', async () => {
  const { s, journal, U } = magasinPhoto();
  const r = await s.masquerFondateur(false);
  const [copie, profil, suppression] = journal;
  assert.equal(copie[0], 'copie'); assert.equal(copie[2], `${U}/photo-1.webp`);
  assert.match(copie[3], new RegExp(`^${U}/photo-\\d{1,16}\\.webp$`), 'un nom accepté par profiles_photo_path_check');
  assert.deepEqual(profil, ['profil', { fondateur_public: false, photo_path: copie[3] }], 'une seule mise à jour : le refus et la nouvelle photo');
  assert.deepEqual(suppression, ['suppression', 'photos', `${U}/photo-1.webp`]);
  assert.equal(s.me.photo_path, copie[3]);
  assert.equal(r.photoRetiree, false);
});
test('copie impossible : la photo est retirée plutôt que laissée en ligne ; réseau coupé : rien ne change', async () => {
  const a = magasinPhoto({ copieOk: false });
  const r = await a.s.masquerFondateur(null);
  assert.deepEqual(a.journal.slice(1), [['profil', { fondateur_public: null, photo_path: null }], ['suppression', 'photos', `${a.U}/photo-1.webp`]]);
  assert.equal(r.photoRetiree, true);
  const b = magasinPhoto({ majOk: false });
  await assert.rejects(b.s.masquerFondateur(false), /Pas de réseau/);
  assert.deepEqual(b.journal.map(x => x[0]), ['copie', 'profil', 'suppression']);
  assert.notEqual(b.journal[2][2], `${b.U}/photo-1.webp`, 'seule la copie est supprimée, la photo reste');
  assert.equal(b.s.me.photo_path, `${b.U}/photo-1.webp`);
  // Pas sur la page d'entrée (pas encore répondu) : rien à renommer
  const c = magasinPhoto(); c.s.me.fondateur_public = null;
  await c.s.masquerFondateur(false);
  assert.deepEqual(c.journal, [['profil', { fondateur_public: false }]]);
});

// Notification d'un message touchée au retour de veille : le temps réel dormait, la discussion s'ouvrait sans les
// nouveaux messages jusqu'à un rechargement de la page
function retour() {
  const s = new SupabaseStore({}); s.session = { user: { id: 'moi' } }; s.me = { id: 'moi' };
  const lus = []; let ch = null; let battements = 0;
  s.sb = {
    from: nom => ({ select: () => ({ order: () => ({ range: async () => { lus.push(nom); return { data: nom === 'messages' ? [{ id: 'nouveau' }] : [], error: null }; } }) }) }),
    channel: () => (ch = { on() { return this; }, subscribe(cb) { this.cb = cb; return this; } }),
    realtime: { sendHeartbeat: () => { battements++; } },
  };
  let emis = 0; s.emit = () => { emis++; };
  return { s, lus, canal: () => ch, battements: () => battements, emis: () => emis };
}

test('retour au premier plan : les messages sont relus, une seule fois même si la discussion s’ouvre aussitôt', async () => {
  const r = retour();
  r.s.auRetour(0);
  assert.deepEqual(r.lus, [], 'pas caché : rien à relire');
  r.s.auRetour(4000);
  await r.s.rattraperMessages();
  await r.s.rattrapage;
  assert.deepEqual(r.lus.sort(), ['blocages', 'messages', 'reactions_messages']);
  assert.deepEqual(r.s.data.messages, [{ id: 'nouveau' }]);
  assert.ok(r.emis() >= 1);
  assert.equal(r.battements(), 0, 'courte absence : la connexion n’est pas sondée');
});

test('longue veille : la connexion du temps réel est sondée (un battement, un second 5 s plus tard)', async () => {
  const r = retour();
  r.s.auRetour(60e3);
  assert.equal(r.battements(), 1);
  assert.ok(r.s.minuteurSonde);
  clearTimeout(r.s.minuteurSonde);
  await r.s.rattrapage;
});

test('abonnement du temps réel retrouvé après une coupure : les messages manqués sont relus', async () => {
  const r = retour();
  r.s.subscribe();
  r.canal().cb('SUBSCRIBED');
  assert.deepEqual(r.lus, [], 'premier abonnement : tout vient d’être chargé');
  r.canal().cb('CHANNEL_ERROR');
  assert.deepEqual(r.lus, []);
  r.canal().cb('SUBSCRIBED');
  await r.s.rattrapage;
  assert.deepEqual(r.lus.sort(), ['blocages', 'messages', 'reactions_messages']);
});
