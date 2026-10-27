// Page Match, mode réel : le store parle à la base comme DemoStore parle à la démo (mêmes noms, mêmes réponses).
// choisirMatch rend le match que CE geste a créé ; « Revenir » ne défait jamais un match ; « vu » une seule fois ;
// la réponse à un entretien passe par repondre_rdv. Et logic.js : un match ouvre la discussion (comme peut_discuter).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseStore } from '../../src/store.js';
import { peutDiscuter, lienAvec } from '../../src/logic.js';

const ETU = 'etu-1', LAU = 'lau-1', LAU2 = 'lau-2', OFFRE = 'offre-1', OFFRE2 = 'offre-2';
const T = '2026-10-27T10:00:00.123456+00:00';

// Un faux client Supabase : il note chaque appel et répond ce qu'on lui donne
function magasin({ moi = { id: ETU, role: 'etudiant' }, ligne, match = null, erreur = null, rpc = null } = {}) {
  const s = new SupabaseStore({}); s.session = { user: { id: moi.id } }; s.me = moi;
  s.data.offers = [{ id: OFFRE, author_id: LAU, titre: 'PFE Lean' }, { id: OFFRE2, author_id: LAU2, titre: 'PFE Qualité' }];
  s.data.match_choix = []; s.data.matchs = []; s.data.messages = [];
  const appels = [];
  s.sb = {
    from: t => ({
      upsert: (row, opt) => { appels.push(['upsert', t, row, opt]); return { select: () => ({ single: async () => (erreur ? { data: null, error: erreur } : { data: ligne, error: null }) }) }; },
      select: () => { const f = { eq: (c, v) => { appels.push(['eq', t, c, v]); return f; }, maybeSingle: async () => ({ data: match, error: null }) }; return f; },
      delete: () => ({ eq: async (c, v) => { appels.push(['delete', t, v]); return { error: null }; } }),
      update: patch => ({ eq: async (c, v) => { appels.push(['update', t, patch, v]); return { error: null }; } }),
    }),
    rpc: async (fn, args) => { appels.push(['rpc', fn, args]); return rpc || { data: null, error: null }; },
  };
  s.loadTable = async t => { appels.push(['load', t]); };
  return { s, appels };
}

test('choisirMatch : une ligne par carte (upsert), et le match que ce geste vient de créer', async () => {
  const ligne = { id: 'c1', user_id: ETU, cible_offre: OFFRE, cible_profil: null, choix: 'oui', created_at: T, updated_at: T };
  const m = { id: 'm1', etudiant_id: ETU, laureat_id: LAU, offre_id: OFFRE, created_at: T };
  const { s, appels } = magasin({ ligne, match: m });
  const r = await s.choisirMatch({ offre: OFFRE }, 'oui');
  assert.deepEqual(r, { match: m });
  assert.deepEqual(appels[0], ['upsert', 'match_choix', { user_id: ETU, cible_offre: OFFRE, choix: 'oui' }, { onConflict: 'user_id,cible_offre' }]);
  // La paire : moi (étudiant) et l'auteur de l'offre
  assert.deepEqual(appels.filter(a => a[0] === 'eq'), [['eq', 'matchs', 'etudiant_id', ETU], ['eq', 'matchs', 'laureat_id', LAU]]);
  assert.deepEqual(s.data.match_choix, [ligne]);
  assert.deepEqual(s.data.matchs, [m]);
  assert.ok(appels.some(a => a[0] === 'load' && a[1] === 'profiles'), 'le CV de l’étudiant devient lisible');
});

test('choisirMatch : un match plus ancien (fait par un autre geste) ne se fête pas ; « plus tard » ne cherche pas de match', async () => {
  const ligne = { id: 'c1', user_id: ETU, cible_offre: OFFRE, choix: 'oui', updated_at: T };
  const ancien = { id: 'm0', etudiant_id: ETU, laureat_id: LAU, created_at: '2026-10-20T09:00:00+00:00' };
  let { s, appels } = magasin({ ligne, match: ancien });
  assert.deepEqual(await s.choisirMatch({ offre: OFFRE }, 'oui'), { match: null });
  assert.deepEqual(s.data.matchs, [ancien], 'mais il est bien là');
  assert.ok(!appels.some(a => a[0] === 'load'));
  ({ s, appels } = magasin({ ligne: { ...ligne, choix: 'plus_tard' } }));
  assert.deepEqual(await s.choisirMatch({ offre: OFFRE }, 'plus_tard'), { match: null });
  assert.ok(!appels.some(a => a[0] === 'eq'));
  await assert.rejects(s.choisirMatch({ offre: OFFRE }, 'peut-etre'), /Choix invalide/);
  await assert.rejects(s.choisirMatch({}, 'oui'), /Choix invalide/);
});

test('choisirMatch : le lauréat choisit un étudiant (la paire dans l’autre sens) ; un refus de la base est dit tel quel', async () => {
  const ligne = { id: 'c2', user_id: LAU, cible_profil: ETU, choix: 'oui', updated_at: T };
  const { s, appels } = magasin({ moi: { id: LAU, role: 'laureat' }, ligne, match: { id: 'm2', etudiant_id: ETU, laureat_id: LAU, created_at: T } });
  assert.equal((await s.choisirMatch({ profil: ETU }, 'oui')).match.id, 'm2');
  assert.deepEqual(appels[0][3], { onConflict: 'user_id,cible_profil' });
  assert.deepEqual(appels.filter(a => a[0] === 'eq').map(a => a[3]), [ETU, LAU]);
  const refus = magasin({ erreur: { code: '42501', message: 'Ce profil n’est pas proposé dans Match.' } });
  await assert.rejects(refus.s.choisirMatch({ profil: ETU }, 'oui'), /Ce profil n’est pas proposé dans Match\./);
  const plein = magasin({ erreur: { code: 'P0001', message: 'Tu as déjà fait 80 choix aujourd’hui. La suite demain !' } });
  await assert.rejects(plein.s.choisirMatch({ offre: OFFRE }, 'oui'), /80 choix/);
});

test('revenirMatch : mon dernier choix part et sa carte revient ; jamais celui d’une carte déjà en match', async () => {
  const { s, appels } = magasin();
  s.data.match_choix = [
    { id: 'a', user_id: ETU, cible_offre: OFFRE, cible_profil: null, updated_at: '2026-10-27T09:00:00Z' },
    { id: 'b', user_id: ETU, cible_offre: OFFRE2, cible_profil: null, updated_at: '2026-10-27T09:05:00Z' },
    { id: 'c', user_id: LAU, cible_profil: ETU, cible_offre: null, updated_at: '2026-10-27T09:10:00Z' },
  ];
  assert.deepEqual(await s.revenirMatch(), { profil: null, offre: OFFRE2 });
  assert.deepEqual(appels.filter(a => a[0] === 'delete'), [['delete', 'match_choix', 'b']]);
  assert.deepEqual(s.data.match_choix.map(c => c.id), ['a', 'c']);
  // La carte suivante a fait un match avec Youssef : rien n'est retiré
  s.data.matchs = [{ id: 'm1', etudiant_id: ETU, laureat_id: LAU }];
  assert.equal(await s.revenirMatch(), null);
  assert.deepEqual(s.data.match_choix.map(c => c.id), ['a', 'c']);
  // Aucun choix à moi : rien
  const vide = magasin();
  assert.equal(await vide.s.revenirMatch(), null);
});

test('retirerMatch, vuMatch : l’un ou l’autre retire ; chacun note son « vu », une fois', async () => {
  const { s, appels } = magasin();
  s.data.matchs = [{ id: 'm1', etudiant_id: ETU, laureat_id: LAU, vu_etudiant_at: null, vu_laureat_at: null }, { id: 'm2', etudiant_id: 'x', laureat_id: LAU2 }];
  await s.vuMatch('m1');
  assert.ok(s.data.matchs[0].vu_etudiant_at); assert.equal(s.data.matchs[0].vu_laureat_at, null);
  assert.deepEqual(appels.filter(a => a[0] === 'update').map(a => [Object.keys(a[2]), a[3]]), [[['vu_etudiant_at'], 'm1']]);
  await s.vuMatch('m1'); await s.vuMatch('m2'); await s.vuMatch('inconnu');
  assert.equal(appels.filter(a => a[0] === 'update').length, 1, 'déjà vu, pas le mien, inconnu : rien');
  await s.retirerMatch('m1');
  assert.deepEqual(s.data.matchs.map(m => m.id), ['m2']);
  assert.deepEqual(appels.filter(a => a[0] === 'delete'), [['delete', 'matchs', 'm1']]);
});

test('repondreRdv : par repondre_rdv, le message mis à jour à l’écran ; un refus est dit', async () => {
  const rdv = { id: 'msg1', type: 'rdv', author_id: LAU, dest_id: ETU, rdv_reponse: null };
  const { s, appels } = magasin({ rpc: { data: { ...rdv, rdv_reponse: 'oui' }, error: null } });
  s.data.messages = [rdv];
  const r = await s.repondreRdv('msg1', 'oui');
  assert.equal(r.rdv_reponse, 'oui');
  assert.deepEqual(appels.at(-1), ['rpc', 'repondre_rdv', { p_id: 'msg1', p_reponse: 'oui' }]);
  assert.equal(s.data.messages[0].rdv_reponse, 'oui');
  const passe = magasin({ rpc: { data: null, error: { message: 'Cet entretien est déjà passé.' } } });
  await assert.rejects(passe.s.repondreRdv('msg1', 'autre'), /déjà passé/);
});

test('discussion : un match l’ouvre (étiquette « Match » et l’offre) ; un blocage la ferme, comme peut_discuter', () => {
  const profils = { [ETU]: { id: ETU, role: 'etudiant' }, [LAU]: { id: LAU, role: 'laureat' }, [LAU2]: { id: LAU2, role: 'laureat' } };
  const profil = id => profils[id] || null;
  const data = { mentorships: [], applications: [], offers: [{ id: OFFRE, titre: 'PFE Lean' }], messages: [], blocages: [],
    matchs: [{ id: 'm1', etudiant_id: ETU, laureat_id: LAU, offre_id: OFFRE }] };
  assert.equal(peutDiscuter(data, profils[ETU], LAU, profil), true);
  assert.equal(peutDiscuter(data, profils[LAU], ETU, profil), true);
  assert.equal(peutDiscuter(data, profils[ETU], LAU2, profil), false);
  assert.deepEqual(lienAvec(data, profils[LAU], ETU, profil), { type: 'match', label: 'Match', detail: 'PFE Lean', match: 'm1' });
  assert.equal(lienAvec({ ...data, matchs: [{ ...data.matchs[0], offre_id: null }] }, profils[ETU], LAU, profil).detail, null);
  assert.equal(peutDiscuter({ ...data, blocages: [{ user_id: LAU, bloque_id: ETU }] }, profils[ETU], LAU, profil), false);
  // Base pas encore à jour (pas de matchs) : rien ne change
  assert.equal(peutDiscuter({ ...data, matchs: undefined }, profils[ETU], LAU, profil), false);
});
