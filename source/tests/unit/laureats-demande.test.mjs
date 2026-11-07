// « 3 lauréats peuvent t'aider » : les lauréats proposés sous une Demande (et à l'administration quand elle attend)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { laureatsPourDemande } from '../../src/logic.js';

const GIEO = 'Génie Industriel : Excellence Opérationnelle', GIP = 'Génie Industriel et Productique', GM = 'Génie Mécanique : Conception et Industrialisation des Systèmes Mécaniques';
const P = (id, champs) => ({ id, created_at: '2026-10-01T00:00:00Z', ...champs });
const data = {
  profiles: [
    P('etu', { role: 'etudiant', filiere: GIEO, promo: 2027, full_name: 'Salma' }),
    P('l1', { role: 'laureat', filiere: GIEO, promo: 2016, verified: true, mentor_dispo: true, entreprise: 'Renault', poste: 'Responsable stage' }),
    P('l2', { role: 'laureat', filiere: GIP, promo: 2018 }),
    P('l3', { role: 'laureat', filiere: GM, promo: 2015, verified: true, mentor_dispo: true }),
    P('l4', { role: 'laureat', filiere: GIEO, promo: 2019, verified: true }),
    P('l5', { role: 'laureat', filiere: GIEO, promo: 2020, admin_ok: true }),
    P('adm', { role: 'admin', filiere: GIEO, promo: 2010 }),
    P('autre', { role: 'laureat', filiere: GIEO, promo: 2014, verified: true, ecole: 'ecole-exemple' }),
  ],
  propositions: [{ demande_id: 'd1', laureat_id: 'l4' }],
};
const d = { id: 'd1', auteur_id: 'etu', type: 'stage', created_at: '2026-10-30T00:00:00Z' };

test('les mieux placés d’abord ; jamais un lauréat qui a déjà proposé, l’administration, ni une autre école', () => {
  const ids = laureatsPourDemande(data, d).map(x => x.p.id);
  assert.deepEqual(ids, ['l1', 'l2']);
  assert.ok(!ids.includes('l4') && !ids.includes('l5') && !ids.includes('adm') && !ids.includes('autre') && !ids.includes('l3'));
  assert.ok(laureatsPourDemande(data, d)[0].why.includes('Même filière'));
});

test('au plus n ; une demande sans auteur connu ne propose personne', () => {
  assert.equal(laureatsPourDemande(data, d, 1).length, 1);
  assert.deepEqual(laureatsPourDemande(data, { ...d, auteur_id: 'inconnu' }), []);
});
