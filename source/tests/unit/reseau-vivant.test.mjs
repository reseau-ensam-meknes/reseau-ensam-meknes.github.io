// Réseau vivant : qui lit quelle demande (mêmes règles que la base), la liste « Demandes de ta promo »,
// le nombre d'aides sans dire qui, les pastilles de réactions, les règles de la démo et la cloche
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonOf } from '../../src/logic.js';
import { EMOJIS_PUBLICS, peutLireDemande, demandesPromo, aidesProposees, pastilles, reactionsSur, regleVivant, peutSupprimerVivant, cascadeVivant, nouvellesVivant, peutLireOffre } from '../../src/reseau-vivant.js';

const S = seasonOf();
const jour = 864e5, il = j => new Date(Date.now() - j * jour).toISOString();
const P = {
  salma: { id: 'salma', role: 'etudiant', promo: S + 1, full_name: 'Salma Bennani' },
  hiba: { id: 'hiba', role: 'etudiant', promo: S + 1, full_name: 'Hiba Alaoui' },
  amine: { id: 'amine', role: 'etudiant', promo: S + 3, full_name: 'Amine Talbi' },
  youssef: { id: 'youssef', role: 'laureat', promo: 2016, full_name: 'Youssef El Amrani' },
  halima: { id: 'halima', role: 'laureat', promo: 2020, full_name: 'Halima Cherche', en_recherche: true },
  admin: { id: 'admin', role: 'admin', promo: 2010, full_name: 'Admin' },
};
const byId = id => P[id];
const dem = (id, auteur, status = 'ouverte', o = {}) => ({ id, auteur_id: auteur, status, titre: 'Demande ' + id, created_at: il(1), relancee_at: il(1), ...o });
const donnees = () => ({
  profiles: Object.values(P), blocages: [],
  demandes: [dem('d1', 'hiba'), dem('d2', 'hiba', 'pourvue', { created_at: il(20) }), dem('d3', 'hiba', 'fermee'), dem('d4', 'amine'), dem('d5', 'halima'),
    dem('d6', 'hiba', 'match'), dem('d7', 'hiba', 'ouverte', { relancee_at: il(70), created_at: il(70) })],
  propositions: [{ id: 'p1', demande_id: 'd1', laureat_id: 'youssef', status: 'envoyee' }, { id: 'p2', demande_id: 'd1', laureat_id: 'l2', status: 'retiree' }, { id: 'p3', demande_id: 'd1', laureat_id: 'l3', status: 'declinee' }],
  offers: [{ id: 'o1', author_id: 'youssef', audience: 'etudiants', titre: 'PFE lean' }, { id: 'o2', author_id: 'youssef', audience: 'laureats', titre: 'Poste' }],
  reactions_publiques: [], reponses_demandes: [],
});

test('lire une demande : son année (ouverte, match, pourvue), pas une autre année, pas une demande d’emploi d’un lauréat', () => {
  const data = donnees(); const d = id => data.demandes.find(x => x.id === id);
  assert.equal(peutLireDemande(data, P.salma, d('d1'), byId, S), true);
  assert.equal(peutLireDemande(data, P.salma, d('d2'), byId, S), true);
  assert.equal(peutLireDemande(data, P.salma, d('d3'), byId, S), false, 'fermée');
  assert.equal(peutLireDemande(data, P.salma, d('d4'), byId, S), false, 'autre année');
  assert.equal(peutLireDemande(data, P.salma, d('d5'), byId, S), false, 'emploi d’un lauréat');
  assert.equal(peutLireDemande(data, P.amine, d('d1'), byId, S), false);
  for (const id of ['d1', 'd3', 'd4', 'd5']) assert.equal(peutLireDemande(data, P.youssef, d(id), byId, S), true);
  assert.equal(peutLireDemande({ ...data, blocages: [{ user_id: 'hiba', bloque_id: 'salma' }] }, P.salma, d('d1'), byId, S), false, 'blocage');
  assert.equal(peutLireOffre(P.salma, data.offers[1]), false); assert.equal(peutLireOffre(P.youssef, data.offers[1]), true);
});

test('« Demandes de ta promo » : ouvertes, puis match, puis réussies ; ni la sienne, ni celles en pause', () => {
  const data = donnees();
  assert.deepEqual(demandesPromo(data, P.salma, byId, S).map(d => d.id), ['d1', 'd6', 'd2']);
  assert.deepEqual(demandesPromo(data, P.hiba, byId, S).map(d => d.id), []);
  assert.deepEqual(demandesPromo(data, P.youssef, byId, S), [], 'pour les étudiants seulement');
});

test('nombre d’aides : les lauréats qui ont proposé (retirée : non) ; la base le donne quand elle l’a', () => {
  const data = donnees();
  assert.equal(aidesProposees(data, data.demandes[0]), 2);
  assert.equal(aidesProposees({ ...data, propositions: [] }, data.demandes[0]), 0);
  assert.equal(aidesProposees({ ...data, propositions: [] }, { ...data.demandes[0], nb_aides: 3 }), 3);
});

test('pastilles : une par émoji, la plus fournie d’abord, qui a réagi du plus récent au plus ancien', () => {
  const rs = [{ emoji: '👍', user_id: 'a', created_at: il(3) }, { emoji: '❤️', user_id: 'b', created_at: il(2) }, { emoji: '❤️', user_id: 'c', created_at: il(1) }, { emoji: '💪', user_id: 'd', created_at: il(1) }];
  assert.deepEqual(pastilles(rs), [{ emoji: '❤️', qui: ['c', 'b'] }, { emoji: '👍', qui: ['a'] }, { emoji: '💪', qui: ['d'] }]);
  assert.deepEqual(EMOJIS_PUBLICS, ['👍', '❤️', '👏', '🙏', '💪']);
});

test('démo : une réaction par membre, seulement sur ce qu’on lit, jamais sur sa publication ; réponses courtes, pas sous une demande fermée', () => {
  const store = (me, data = donnees()) => ({ me, data, byId: (t, id) => data[t].find(x => x.id === id) });
  const essai = (s, table, r, old = null) => { regleVivant(s, table, r, old); return r; };
  const s = store(P.salma);
  assert.equal(essai(s, 'reactions_publiques', { demande_id: 'd1', emoji: '💪', user_id: 'pirate' }).user_id, 'salma');
  assert.throws(() => essai(s, 'reactions_publiques', { demande_id: 'd1', emoji: '🤡' }), /inconnue/);
  assert.throws(() => essai(s, 'reactions_publiques', { demande_id: 'd4', emoji: '👍' }), /non autorisée/);
  assert.throws(() => essai(s, 'reactions_publiques', { offer_id: 'o2', emoji: '👍' }), /non autorisée/);
  assert.throws(() => essai(s, 'reactions_publiques', { offer_id: 'o1', demande_id: 'd1', emoji: '👍' }), /non autorisée/);
  assert.throws(() => essai(store(P.youssef), 'reactions_publiques', { offer_id: 'o1', emoji: '👍' }), /propre publication/);
  s.data.reactions_publiques.push({ id: 'r1', demande_id: 'd1', user_id: 'salma', emoji: '💪' });
  assert.throws(() => essai(s, 'reactions_publiques', { demande_id: 'd1', emoji: '👍' }), /déjà réagi/);
  // Changer d'émoji : ni l'élément ni la personne
  const m = essai(s, 'reactions_publiques', { id: 'r1', demande_id: 'd6', user_id: 'x', emoji: '👏' }, s.data.reactions_publiques[0]);
  assert.deepEqual([m.demande_id, m.user_id, m.emoji], ['d1', 'salma', '👏']);
  assert.equal(peutSupprimerVivant(s.data, P.hiba, 'reactions_publiques', s.data.reactions_publiques[0]), false);
  assert.equal(peutSupprimerVivant(s.data, P.salma, 'reactions_publiques', s.data.reactions_publiques[0]), true);
  // Réponses
  assert.equal(essai(s, 'reponses_demandes', { demande_id: 'd1', body: '  Courage !  ' }).body, 'Courage !');
  assert.throws(() => essai(s, 'reponses_demandes', { demande_id: 'd1', body: 'x' }), /entre 2 et 500/);
  assert.throws(() => essai(s, 'reponses_demandes', { demande_id: 'd4', body: 'Bonne chance' }), /non autorisée/);
  assert.throws(() => essai(store(P.youssef), 'reponses_demandes', { demande_id: 'd3', body: 'Bonne chance' }), /fermée/);
  const rep = { id: 'x1', demande_id: 'd1', author_id: 'youssef', body: 'Un contact' };
  assert.equal(peutSupprimerVivant(s.data, P.hiba, 'reponses_demandes', rep), true, 'sous sa demande');
  assert.equal(peutSupprimerVivant(s.data, P.salma, 'reponses_demandes', rep), false);
  // Une demande supprimée emporte ses réactions et ses réponses
  s.data.reponses_demandes.push(rep); cascadeVivant(s.data, 'demandes', 'd1');
  assert.deepEqual([reactionsSur(s.data, { demande_id: 'd1' }).length, s.data.reponses_demandes.length], [0, 0]);
});

test('cloche : une ligne par élément qui fait réagir, une par réponse sous ma demande ; jamais ses propres gestes', () => {
  const data = donnees();
  data.reactions_publiques = [
    { id: 'a', offer_id: 'o1', user_id: 'salma', emoji: '👏', created_at: il(1) }, { id: 'b', offer_id: 'o1', user_id: 'hiba', emoji: '❤️', created_at: il(0.5) },
    { id: 'c', demande_id: 'd1', user_id: 'salma', emoji: '💪', created_at: il(0.2) }, { id: 'd', demande_id: 'd1', user_id: 'youssef', emoji: '👍', created_at: il(9) }];
  data.reponses_demandes = [{ id: 'r', demande_id: 'd1', author_id: 'youssef', body: 'Regarde du côté de Tanger Med.', created_at: il(0.1) }, { id: 's', demande_id: 'd1', author_id: 'hiba', body: 'Merci', created_at: il(0.1) }];
  const nom = id => P[id].full_name;
  const lau = nouvellesVivant(data, P.youssef, nom);
  assert.deepEqual(lau.map(n => n.text), ['2 réactions sur « PFE lean »']);
  assert.equal(lau[0].offer, 'o1');
  const etu = nouvellesVivant(data, P.hiba, nom).map(n => n.text);
  assert.deepEqual(etu, ['Salma Bennani a réagi 💪 à « Demande d1 »', 'Youssef El Amrani a répondu à ta demande : « Regarde du côté de Tanger Med. »']);
  assert.ok(nouvellesVivant(data, P.hiba, nom).every(n => !n.geste && !n.action), 'des nouvelles, rien à faire');
});
