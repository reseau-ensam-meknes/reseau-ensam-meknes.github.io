// L'école du compte à l'inscription : celle du lien que la page suit (verifierCode, store.js). Le compte né de la demande de
// code du lien d'une autre école (gardée dans ses données) ne la garde plus quand la page suit le lien de l'ENSAM Meknès : null
// l'efface (GoTrue). Un compte qui n'a pas d'autre école, une page sans lien, un lien qui dit son école : la même mise à jour
// qu'avant, à l'octet ; une connexion : aucune.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseStore } from '../../src/store.js';

function magasin(ecoleDuCompte) {
  const majs = [];
  const s = new SupabaseStore({});
  s.sb = { auth: {
    verifyOtp: async () => ({ data: { user: { id: 'u', user_metadata: { par_code: true, ...(ecoleDuCompte ? { ecole: ecoleDuCompte } : {}) } }, session: {} }, error: null }),
    updateUser: async x => { majs.push(JSON.stringify(x)); return { data: {}, error: null }; },
  } };
  return { s, majs };
}
const META = { consent_at: '2026-11-08T10:00:00.000Z', consent_version: '2026-10', emails_hebdo: true, langue: 'fr', role_choisi: 'laureat' };

test('code vérifié à l’inscription : un compte né sur le lien d’une autre école, sur le lien de l’ENSAM Meknès, ne la garde plus ; sinon la mise à jour d’avant, à l’octet', async () => {
  for (const avant of ['ensam-casa', 'ensa-fes']) {
    const { s, majs } = magasin(avant);
    await s.verifierCode('karim@gmail.com', '123456', META, 'ensam-meknes');
    assert.deepEqual(majs, [JSON.stringify({ data: { ...META, ecole: null } })], avant);
  }
  // [école du compte, école du lien suivi, données de l'inscription]
  for (const [avant, ecole, meta] of [
    [null, 'ensam-meknes', META], [null, null, META], ['ensa-fes', null, META], ['ensa-fes', 'ensa-fes', { ...META, ecole: 'ensa-fes' }],
    ['ensam-casa', 'ensa-fes', { ...META, ecole: 'ensa-fes' }], [null, 'ensa-fes', { ...META, ecole: 'ensa-fes' }],
  ]) {
    const { s, majs } = magasin(avant);
    await s.verifierCode('karim@gmail.com', '123456', meta, ecole);
    assert.deepEqual(majs, [JSON.stringify({ data: meta })], `${avant} / ${ecole}`);
  }
  // Appelé comme avant (sans école) : la même chose
  const a = magasin('ensam-casa');
  await a.s.verifierCode('karim@gmail.com', '123456', META);
  assert.deepEqual(a.majs, [JSON.stringify({ data: META })]);
  // Une connexion : rien
  const b = magasin('ensam-casa');
  await b.s.verifierCode('karim@gmail.com', '123456', null, null);
  assert.deepEqual(b.majs, []);
});
