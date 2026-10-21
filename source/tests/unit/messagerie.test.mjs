// Messagerie et accueil : qui peut écrire à qui (mêmes règles que la base), conversations, « cette semaine »
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lienAvec, peutDiscuter, conversations, nonLus, poulsReseau } from '../../src/logic.js';

const P = { s: { id: 's', role: 'etudiant' }, l: { id: 'l', role: 'laureat' }, n: { id: 'n', role: 'laureat' }, a: { id: 'a', role: 'admin' } };
const profil = id => P[id] || null;
const base = x => ({ mentorships: [], relectures_cv: [], applications: [], offers: [], parrainages: [], demandes_contact: [], messages: [], blocages: [], placements: [], ...x });

test('messagerie : pas de conversation sans lien, puis ouverte par un mentorat', () => {
  assert.equal(peutDiscuter(base(), P.s, 'l', profil), false);
  const d = base({ mentorships: [{ id: 'm1', student_id: 's', mentor_id: 'l', status: 'demande', sujet: 'Mon PFE', created_at: '2026-10-01' }] });
  assert.equal(peutDiscuter(d, P.s, 'l', profil), true);
  assert.equal(peutDiscuter(d, P.l, 's', profil), true);
  assert.deepEqual(lienAvec(d, P.s, 'l', profil).label, 'Mentorat');
  assert.equal(lienAvec(d, P.s, 'l', profil).detail, 'Mon PFE');
  // Une demande ouverte à tous (sans lauréat) ne relie personne
  assert.equal(peutDiscuter(base({ mentorships: [{ id: 'm2', student_id: 's', mentor_id: null, status: 'demande' }] }), P.s, 'l', profil), false);
  assert.equal(peutDiscuter(d, P.s, 's', profil), false, 'pas avec soi-même');
});

test('messagerie : candidature, parrainage, coordonnées acceptées, relecture de CV', () => {
  const cand = base({ offers: [{ id: 'o1', author_id: 'l', titre: 'PFE Lean' }], applications: [{ id: 'a1', offer_id: 'o1', student_id: 's' }] });
  assert.equal(lienAvec(cand, P.l, 's', profil).type, 'candidature');
  assert.equal(peutDiscuter(cand, P.n, 's', profil), false, 'un autre lauréat ne profite pas de la candidature');
  assert.equal(lienAvec(base({ parrainages: [{ parrain_id: 'l', filleul_id: 's' }] }), P.s, 'l', profil).type, 'parrainage');
  assert.equal(peutDiscuter(base({ demandes_contact: [{ demandeur_id: 's', cible_id: 'l', status: 'envoyee' }] }), P.s, 'l', profil), false);
  assert.equal(peutDiscuter(base({ demandes_contact: [{ demandeur_id: 's', cible_id: 'l', status: 'acceptee' }] }), P.s, 'l', profil), true);
  assert.equal(peutDiscuter(base({ relectures_cv: [{ student_id: 's', reviewer_id: 'l', status: 'annulee' }] }), P.s, 'l', profil), false);
  assert.equal(peutDiscuter(base({ relectures_cv: [{ student_id: 's', reviewer_id: 'l', status: 'en_cours' }] }), P.s, 'l', profil), true);
});

test('messagerie : l’administration écrit à tous ; on lui répond, sans lui écrire en premier', () => {
  assert.equal(peutDiscuter(base(), P.a, 's', profil), true);
  assert.equal(peutDiscuter(base(), P.s, 'a', profil), false);
  const d = base({ messages: [{ id: 'x', author_id: 'a', dest_id: 's', created_at: '2026-10-20T10:00:00Z' }] });
  assert.equal(peutDiscuter(d, P.s, 'a', profil), true);
});

test('messagerie : un blocage, dans un sens ou dans l’autre, ferme la conversation', () => {
  const d = base({ mentorships: [{ id: 'm1', student_id: 's', mentor_id: 'l', status: 'acceptee' }], blocages: [{ user_id: 'l', bloque_id: 's' }] });
  assert.equal(peutDiscuter(d, P.s, 'l', profil), false);
  assert.equal(peutDiscuter(d, P.l, 's', profil), false);
});

test('conversations : la plus récente d’abord, messages dans l’ordre, non lus comptés', () => {
  const m = (id, de, a, at, lu = null) => ({ id, author_id: de, dest_id: a, created_at: at, lu_at: lu });
  const d = base({ messages: [m('1', 's', 'l', '2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z'), m('2', 'l', 's', '2026-10-02T10:00:00Z'), m('3', 'l', 's', '2026-10-02T09:00:00Z'), m('4', 'n', 's', '2026-10-03T10:00:00Z', '2026-10-03T10:05:00Z'), m('5', 'l', 'n', '2026-10-04T10:00:00Z')] });
  const c = conversations(d, 's');
  assert.deepEqual(c.map(x => x.autre), ['n', 'l']);
  assert.deepEqual(c[1].messages.map(x => x.id), ['1', '3', '2']);
  assert.equal(c[1].nonLus, 2);
  assert.equal(c[0].nonLus, 0);
  assert.equal(nonLus(d, 's'), 2);
  assert.equal(nonLus(d, 'n'), 1);
});

test('cette semaine dans le réseau : qui a aidé combien d’étudiants, sinon sur 30 jours', () => {
  const now = new Date('2026-10-21T12:00:00Z');
  const il_y_a = j => new Date(now - j * 864e5).toISOString();
  const d = base({
    mentorships: [{ mentor_id: 'l', student_id: 's', status: 'acceptee', accepted_at: il_y_a(2) }, { mentor_id: 'n', student_id: 't', status: 'terminee', accepted_at: il_y_a(5) }, { mentor_id: 'n', student_id: 'u', status: 'demande', accepted_at: il_y_a(1) }],
    placements: [{ laureat_id: 'l', student_id: 's', status: 'confirme', confirmed_at: il_y_a(1) }],
  });
  const p = poulsReseau(d, now);
  assert.equal(p.jours, 7);
  assert.deepEqual(p.aidants, ['l', 'n']);
  assert.equal(p.nbAides, 2);
  assert.equal(p.recrutes, 1);
  const calme = base({ mentorships: [{ mentor_id: 'l', student_id: 's', status: 'terminee', accepted_at: il_y_a(20) }] });
  assert.equal(poulsReseau(calme, now).jours, 30);
  assert.equal(poulsReseau(calme, now).nbAides, 1);
});
