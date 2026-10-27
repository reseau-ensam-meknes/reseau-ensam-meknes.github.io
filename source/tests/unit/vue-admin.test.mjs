// L'administration en vue lauréat : la démo suit protect_profile() (aller-retour admin ⇄ lauréat, personne d'autre ne se fait admin),
// et l'admin en vue lauréat ne compte ni dans les chiffres, ni dans l'ordre d'arrivée, ni parmi les fondateurs ou le lauréat du mois.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { laureatCompte, ordreArrivee, chiffreReseau, classementFondateurs, starOfMonth } from '../../src/logic.js';

const ADM = { id: 'a', role: 'laureat', admin_ok: true, created_at: '2026-01-01T00:00:00Z', full_name: 'Admin' };
const LAU = { id: 'l', role: 'laureat', created_at: '2026-02-01T00:00:00Z', full_name: 'Youssef' };
const ETU = { id: 'e', role: 'etudiant', promo: 2027, full_name: 'Salma' };

test('chiffres et classements : l’admin en vue lauréat ne compte pas', () => {
  assert.equal(laureatCompte(ADM), false);
  assert.equal(laureatCompte(LAU), true);
  assert.deepEqual(ordreArrivee([ADM, LAU, ETU]).map(p => p.id), ['l']);
  assert.match(chiffreReseau([ADM, LAU, ETU], LAU), /^1 lauréat\b/);
  const offre = (id, author_id, created_at) => ({ id, author_id, created_at, audience: 'etudiants', status: 'ouverte' });
  const data = { profiles: [ADM, LAU, ETU], offers: [offre('o1', 'a', '2026-03-01T00:00:00Z'), offre('o2', 'l', '2026-03-02T00:00:00Z')], propositions: [], mentorships: [], demandes: [],
    applications: [], placements: [], answers: [], questions: [], kudos: [], relectures_cv: [], invitations: [] };
  assert.deepEqual(classementFondateurs(data).map(f => f.id), ['l']);
  const scores = new Map([['a', { points: 99 }], ['l', { points: 5 }]]);
  assert.equal(starOfMonth(data, scores)?.p.id, 'l');
});

async function demo() {
  globalThis.window ??= {};
  window.ENSAM_CONFIG = {};
  const { createStore } = await import('../../src/store.js');
  const s = await createStore();
  const qui = nom => s.personas().find(p => p._persona.includes(nom));
  return { s, qui, comme: nom => s.switchTo(qui(nom).id) };
}

test('démo : l’admin passe en vue lauréat et revient ; un lauréat ne se fait pas admin', async () => {
  const { s, qui, comme } = await demo();
  const admin = qui('Admin');
  assert.equal(admin.admin_ok, true);
  comme('Admin');
  await s.update('profiles', admin.id, { role: 'laureat' });
  assert.deepEqual([s.me.role, s.me.admin_ok, s.me.verified], ['laureat', true, true]);
  await s.update('profiles', admin.id, { role: 'admin' });
  assert.deepEqual([s.me.role, s.me.admin_ok, s.me.verified], ['admin', true, true]);
  comme('Youssef');
  const y = s.me;
  await s.update('profiles', y.id, { role: 'admin', admin_ok: true });
  assert.deepEqual([s.me.role, !!s.me.admin_ok], ['laureat', false]);
  // L'administration retire le rôle admin d'un autre : admin_ok part avec
  comme('Admin');
  await s.update('profiles', y.id, { role: 'admin' });
  assert.equal(s.byId('profiles', y.id).admin_ok, true);
  await s.update('profiles', y.id, { role: 'laureat' });
  assert.equal(s.byId('profiles', y.id).admin_ok, false);
});
