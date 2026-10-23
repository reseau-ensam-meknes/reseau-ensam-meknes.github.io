// « Dernière étape » et « Mon profil » : ce qui manque est dit (jamais un bouton grisé sans raison),
// rôle et promo cohérents, une session perdue dite clairement
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { incoherenceProfil, manquesProfil, compteOuvert, codesSansSuite } from '../../src/logic.js';
import { SupabaseStore } from '../../src/store.js';

test('rôle et promo : un lauréat a son diplôme, un étudiant l’aura entre la 5A et la 1re année', () => {
  assert.equal(incoherenceProfil('laureat', 2027, 2026, 2026), 'futur');
  assert.equal(incoherenceProfil('etudiant', 2026, 2026, 2026), 'diplome');
  assert.equal(incoherenceProfil('etudiant', 2032, 2026, 2026), 'loin');
  assert.equal(incoherenceProfil('etudiant', 2031, 2026, 2026), null);
  assert.equal(incoherenceProfil('laureat', '2019', 2026, 2026), null);
  assert.equal(incoherenceProfil('etudiant', '', 2026, 2026), null, 'une promo pas encore écrite n’est pas une erreur');
  assert.equal(incoherenceProfil('admin', 2030, 2026, 2026), null);
});

test('ce qui manque, dans l’ordre de l’écran', () => {
  const vide = { role: '', full_name: '', promo: '', filiere: '', mentor_dispo: null };
  assert.deepEqual(manquesProfil(vide, { onboarding: true }), ['role', 'nom', 'promo', 'filiere']);
  const laureat = { role: 'laureat', full_name: 'Yassine Berrada', promo: '2019', filiere: 'Génie Industriel', mentor_dispo: null };
  assert.deepEqual(manquesProfil(laureat, { onboarding: true }), ['aide'], 'à l’inscription, un lauréat dit s’il peut aider');
  assert.deepEqual(manquesProfil(laureat), [], 'dans « Mon profil », ce n’est pas obligatoire');
  assert.deepEqual(manquesProfil({ ...laureat, mentor_dispo: false }, { onboarding: true }), [], '« Pas pour l’instant » est une réponse');
  assert.ok(manquesProfil(laureat, { incoherent: 'futur' }).includes('coherence'));
  assert.deepEqual(manquesProfil({ ...laureat, mentor_dispo: true, full_name: ' A ' }), ['nom']);
  assert.deepEqual(manquesProfil({ ...laureat, mentor_dispo: true, promo: 1980 }), ['promo']);
  assert.deepEqual(manquesProfil({ ...laureat, mentor_dispo: true }, { ecoleBloque: true }), ['ecole']);
  assert.deepEqual(manquesProfil({ role: 'etudiant', full_name: 'Amine', promo: 2029, filiere: 'X', mentor_dispo: null }, { onboarding: true }), [], '« aider » ne concerne que les lauréats');
});

test('comptes : un code demandé mais jamais entré ne compte pas comme une inscription', () => {
  const t = '2026-10-23T10:00:00Z';
  assert.equal(compteOuvert({ a_profil: true, mot_de_passe: false, created_at: t, last_sign_in_at: t }), true);
  assert.equal(compteOuvert({ mot_de_passe: true, created_at: t, last_sign_in_at: t }), true, 'ancien compte avec mot de passe');
  assert.equal(compteOuvert({ created_at: t, last_sign_in_at: t }), true, 'base pas encore à jour : le compte compte');
  assert.equal(compteOuvert({ mot_de_passe: false, created_at: t, last_sign_in_at: null }), true);
  assert.equal(compteOuvert({ mot_de_passe: false, created_at: t, last_sign_in_at: '2026-10-23T10:00:01Z' }), false, 'code demandé, pas entré');
  assert.equal(compteOuvert({ mot_de_passe: false, created_at: t, last_sign_in_at: '2026-10-23T10:03:00Z' }), true, 'code entré plus tard');
  const comptes = [{ id: 'a', mot_de_passe: false, created_at: t, last_sign_in_at: t }, { id: 'adm', mot_de_passe: false, created_at: t, last_sign_in_at: t }, { id: 'b', a_profil: true }];
  assert.equal(codesSansSuite(comptes, [{ id: 'adm', role: 'admin' }]), 1);
});

function magasin(erreur) {
  const s = new SupabaseStore({}); s.session = { user: { id: 'moi' } };
  s.sb = { from: () => ({ update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: null, error: erreur }) }) }) }) }) };
  return s;
}
test('session perdue en enregistrant son profil : on le dit, sans « JWT expired » en anglais', async () => {
  await assert.rejects(magasin({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }).update('profiles', 'moi', { ville: 'Rabat' }), /Ta connexion a expiré/);
  await assert.rejects(magasin({ code: 'PGRST301', message: 'JWT expired' }).update('profiles', 'moi', { ville: 'Rabat' }), /Ta connexion a expiré/);
  await assert.rejects(magasin({ code: 'PGRST116', message: 'x' }).update('mentorships', 'm1', {}), /Un autre lauréat vient de prendre cette demande/);
  await assert.rejects(magasin({ code: 'PGRST116', message: 'x' }).update('profiles', 'autre', {}), /Cette action n’est plus possible/);
});
