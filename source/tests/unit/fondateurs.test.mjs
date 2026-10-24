// Membres fondateurs : les 25 premiers lauréats à aider les étudiants, dans l'ordre de leur première contribution
// (offre pour les étudiants, aide proposée sur une demande d'étudiant, mentorat accepté). schema.sql applique la même règle
// (tests/sql/test-fondateurs.mjs compare les deux).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classementFondateurs, fondateursOf, lignePlaces, NB_FONDATEURS, filiereCourte, FILIERES_INFO, ANCIENNES_FILIERES, BADGES } from '../../src/logic.js';

const h = (j, heure = 9) => new Date(Date.UTC(2026, 9, j, heure)).toISOString();
const L = id => ({ id, role: 'laureat', full_name: id, filiere: 'Génie Mécanique', promo: 2024 });
const E = id => ({ id, role: 'etudiant', full_name: id, filiere: 'Génie Civil', promo: 2027 });

test('fondateurs : la première contribution envers les étudiants, pas la date d’inscription', () => {
  const profiles = [L('hajeb'), L('sedki'), L('tot'), E('salma'), { id: 'adm', role: 'admin' }];
  profiles[2].created_at = h(1); // inscrit le premier, n'a rien fait
  const data = {
    profiles,
    offers: [
      { id: 'o1', author_id: 'hajeb', audience: 'etudiants', created_at: h(23, 9), status: 'ouverte' },
      { id: 'o2', author_id: 'sedki', audience: 'etudiants', created_at: h(23, 11), status: 'pourvue' },
      { id: 'o3', author_id: 'adm', audience: 'etudiants', created_at: h(20) },          // l'administration : jamais
      { id: 'o4', author_id: 'tot', audience: 'laureats', created_at: h(21) },           // entre lauréats : ne compte pas
    ],
  };
  const c = classementFondateurs(data);
  assert.deepEqual(c, [{ id: 'hajeb', at: h(23, 9), type: 'offre', rang: 1 }, { id: 'sedki', at: h(23, 11), type: 'offre', rang: 2 }]);
  assert.deepEqual([...fondateursOf(data)], ['hajeb', 'sedki']);
  assert.equal(lignePlaces(c.length), '23 places de membre fondateur restantes sur 25');
});

test('fondateurs : aide proposée sur une demande d’étudiant, mentorat accepté ; retirée, refusée ou entre lauréats ne comptent pas', () => {
  const profiles = [L('a'), L('b'), L('c'), L('d'), L('e'), L('f'), E('s1'), E('s2'), L('chercheur')];
  const data = {
    profiles,
    demandes: [{ id: 'd1', auteur_id: 's1' }, { id: 'd2', auteur_id: 'chercheur' }],
    propositions: [
      { id: 'p1', demande_id: 'd1', laureat_id: 'a', status: 'declinee', created_at: h(5) }, // refusée par l'étudiant : l'aide a été proposée
      { id: 'p2', demande_id: 'd1', laureat_id: 'b', status: 'retiree', created_at: h(4) },  // retirée par le lauréat : non
      { id: 'p3', demande_id: 'd2', laureat_id: 'c', status: 'envoyee', created_at: h(3) },  // demande d'un lauréat : non
    ],
    mentorships: [
      { id: 'm1', student_id: 's2', mentor_id: 'd', status: 'acceptee', created_at: h(1), accepted_at: h(6) },
      { id: 'm2', student_id: 's2', mentor_id: 'e', status: 'terminee', created_at: h(7) },
      { id: 'm3', student_id: 's2', mentor_id: 'f', status: 'demande', created_at: h(2) },   // pas encore acceptée
      { id: 'm4', student_id: 's2', mentor_id: 'b', status: 'refusee', created_at: h(2) },
      { id: 'm5', student_id: 'chercheur', mentor_id: 'c', status: 'terminee', created_at: h(2) }, // entre lauréats
    ],
  };
  assert.deepEqual(classementFondateurs(data).map(f => [f.id, f.type, f.at]), [['a', 'aide', h(5)], ['d', 'mentorat', h(6)], ['e', 'mentorat', h(7)]]);
});

test('fondateurs : la première contribution compte, une offre supprimée ne compte plus ; égalités départagées comme la base', () => {
  const profiles = [L('zed'), L('amy'), L('bob'), E('s')];
  const offre = (id, author_id, at) => ({ id, author_id, created_at: at });
  const data = {
    profiles,
    offers: [offre('o1', 'zed', h(10)), offre('o2', 'amy', h(10)), offre('o3', 'bob', h(12)), offre('o4', 'bob', h(15))],
    mentorships: [{ id: 'm', student_id: 's', mentor_id: 'bob', status: 'acceptee', created_at: h(9, 8), accepted_at: h(11) }],
  };
  // Même instant : l'id départage (comme « order by at, id » dans la base) ; bob : son mentorat (11) avant ses offres
  assert.deepEqual(classementFondateurs(data).map(f => [f.id, f.type]), [['amy', 'offre'], ['zed', 'offre'], ['bob', 'mentorat']]);
  // Même instant pour un même lauréat : le type départage (aide, mentorat, offre)
  const meme = { profiles, offers: [offre('o', 'amy', h(3))], mentorships: [{ student_id: 's', mentor_id: 'amy', status: 'acceptee', accepted_at: h(3) }] };
  assert.equal(classementFondateurs(meme)[0].type, 'mentorat');
  // Offre supprimée de la plateforme (elle n'est plus dans les données) : amy n'a plus rien fait
  assert.deepEqual(classementFondateurs({ ...data, offers: data.offers.filter(o => o.id !== 'o2') }).map(f => f.id), ['zed', 'bob']);
  // Un lauréat devenu étudiant (rôle corrigé) ou un profil disparu ne compte pas
  assert.deepEqual(classementFondateurs({ ...data, profiles: [{ ...profiles[0], role: 'etudiant' }, profiles[2], profiles[3]] }).map(f => f.id), ['bob']);
});

test('fondateurs : 25 au plus, puis « Les 25 places sont prises » ; un 26e n’entre pas', () => {
  const lau = Array.from({ length: 30 }, (_, i) => L('l' + String(i).padStart(2, '0')));
  const data = { profiles: lau, offers: lau.map((l, i) => ({ id: 'o' + i, author_id: l.id, created_at: h(1 + i) })) };
  const c = classementFondateurs(data);
  assert.equal(NB_FONDATEURS, 25);
  assert.equal(c.length, 25);
  assert.equal(c[24].id, 'l24');
  assert.equal(c[24].rang, 25);
  assert.ok(!fondateursOf(data).has('l25'));
  assert.equal(lignePlaces(25), 'Les 25 places de membre fondateur sont prises');
  assert.equal(lignePlaces(24), '1 place de membre fondateur restante sur 25');
  assert.equal(classementFondateurs({}).length, 0);
  assert.match(BADGES.find(b => b.id === 'fondateur').desc, /25 premiers lauréats à aider les étudiants/);
});

test('page d’entrée : le code court des filières est celui du site, et un code pour chaque ancienne appellation', async () => {
  globalThis.document ??= undefined;
  const src = fs.readFileSync(new URL('../../src/fondateurs-public.js', import.meta.url), 'utf8');
  const CODES = Object.fromEntries([...src.matchAll(/'([^']+)': '([A-Z0-9-]+)'/g)].map(m => [m[1], m[2]]));
  for (const f of FILIERES_INFO) assert.equal(CODES[f.nom], filiereCourte(f.nom), f.nom);
  for (const [f] of ANCIENNES_FILIERES) assert.ok(CODES[f], f);
  assert.equal(CODES['Génie Mécanique'], 'GM');
  assert.equal(CODES['Génie Électromécanique'], 'GEM');
});
