// Console d'administration : les calculs du pilotage (objectif du plan, semaines, écarts, actifs, aides, ce qui s'est passé,
// qui aide le plus, où sont les membres). Mêmes notions que le reste du site : parcoursInscription pour les actifs,
// poulsReseau pour les aides.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OBJECTIF_PLAN, objectifPlan, serieHebdo, ecartHebdo, actifsParSemaine, aidesDuReseau, topAidants, evenementsReseau, repartitionMembres,
  parcoursInscription, poulsReseau } from '../../src/logic.js';

const NOW = new Date('2026-11-01T12:00:00');
const ilYa = (j, h = 0) => new Date(NOW.getTime() - j * 864e5 - h * 36e5).toISOString();

test('objectif du plan : 40 demandes, 50 offres, 20 matchs, 10 aides acceptées d’ici au 22 novembre 2026', () => {
  assert.deepEqual(OBJECTIF_PLAN.cibles, [['demandes', 40], ['offres', 50], ['matchs', 20], ['aides', 10]]);
  const data = {
    demandes: [{ id: 'd1' }, { id: 'd2' }], offers: Array.from({ length: 52 }, (_, i) => ({ id: 'o' + i })), matchs: [{ id: 'm1' }],
    propositions: [{ status: 'acceptee' }, { status: 'envoyee' }, { status: 'acceptee' }, { status: 'declinee' }],
  };
  const o = objectifPlan(data, NOW);
  assert.equal(o.fini, false);
  assert.equal(o.jours, 22, 'jusqu’au 22 novembre au soir, aujourd’hui compris');
  assert.deepEqual(o.lignes.map(l => [l.k, l.n, l.cible, l.atteint, l.reste]),
    [['demandes', 2, 40, false, 38], ['offres', 52, 50, true, 0], ['matchs', 1, 20, false, 19], ['aides', 2, 10, false, 8]]);
  // Le dernier jour, puis la période finie : les chiffres restent
  assert.equal(objectifPlan(data, new Date('2026-11-22T10:00:00')).jours, 1);
  const apres = objectifPlan(data, new Date('2026-11-23T08:00:00'));
  assert.equal(apres.fini, true); assert.equal(apres.jours, 0);
  assert.equal(apres.lignes[1].n, 52);
  // Données vides : des zéros, jamais d'erreur
  assert.deepEqual(objectifPlan({}, NOW).lignes.map(l => l.n), [0, 0, 0, 0]);
});

test('semaines glissantes : 8 cases, la plus ancienne d’abord ; une date à venir ou trop ancienne ne compte pas', () => {
  const dates = [ilYa(0, 1), ilYa(6, 23), ilYa(7, 1), ilYa(13), ilYa(55), ilYa(56, 1), ilYa(-1), null, 'pas une date'];
  const s = serieHebdo(dates, NOW);
  assert.equal(s.length, 8);
  assert.deepEqual(s, [1, 0, 0, 0, 0, 0, 2, 2]);
  // Exactement 7 jours : la semaine d'avant (comme « t > semaine » de parcoursInscription)
  assert.deepEqual(serieHebdo([ilYa(7)], NOW, 2), [1, 0]);
  assert.deepEqual(serieHebdo([], NOW, 3), [0, 0, 0]);
  assert.deepEqual(ecartHebdo([1, 4, 2]), { n: 2, avant: 4, delta: -2 });
  assert.deepEqual(ecartHebdo([3]), { n: 3, avant: 0, delta: 3 });
  assert.deepEqual(ecartHebdo([]), { n: 0, avant: 0, delta: 0 });
});

const P = (id, role, extra = {}) => ({ id, role, full_name: id, created_at: ilYa(100), ...extra });
const base = () => ({
  profiles: [P('adm', 'admin'), P('l1', 'laureat', { promo: 2016, filiere: 'Génie Mécanique' }), P('l2', 'laureat', { promo: 2024, filiere: 'Génie Industriel' }),
    P('l3', 'laureat', { promo: 2026, filiere: 'Génie Civil' }), P('lv', 'laureat', { promo: 2010, admin_ok: true }),
    P('e1', 'etudiant', { promo: 2027, filiere: 'Génie Industriel' }), P('e2', 'etudiant', { promo: 2029, filiere: 'Génie Mécanique' }), P('e3', 'etudiant', { promo: 2027, filiere: 'Classes préparatoires intégrées' })],
  offers: [{ id: 'o1', author_id: 'l1', created_at: ilYa(2) }, { id: 'o2', author_id: 'adm', created_at: ilYa(1) }],
  comments: [{ author_id: 'e1', created_at: ilYa(10) }], reactions: [{ user_id: 'e2', created_at: ilYa(0, 3) }],
  applications: [{ student_id: 'e1', created_at: ilYa(3) }],
  mentorships: [{ id: 'm1', student_id: 'e2', mentor_id: 'l2', status: 'terminee', created_at: ilYa(20), accepted_at: ilYa(9), rdv_at: ilYa(5), sujet: 'Mon CV' },
    { id: 'm2', student_id: 'e1', mentor_id: 'l1', status: 'terminee', created_at: ilYa(12), accepted_at: ilYa(11), rdv_at: ilYa(4), sujet: 'PFE' }],
  relectures_cv: [{ reviewer_id: 'l1', student_id: 'e2', status: 'rendue', rendue_at: ilYa(1) }, { reviewer_id: 'l3', student_id: 'e1', status: 'demandee', created_at: ilYa(1) }],
  placements: [{ id: 'p1', laureat_id: 'l1', student_id: 'e1', status: 'confirme', created_at: ilYa(25), confirmed_at: ilYa(20), entreprise: 'Atelier Nord' },
    { id: 'p2', laureat_id: 'l3', student_id: 'e2', status: 'declare', created_at: ilYa(2) }],
  demandes: [{ id: 'd1', auteur_id: 'e1', titre: 'PFE en qualité', created_at: ilYa(6) }],
  propositions: [{ id: 'x1', demande_id: 'd1', laureat_id: 'l3', status: 'acceptee', created_at: ilYa(5), repondu_at: ilYa(3) }],
  matchs: [{ id: 'mt1', etudiant_id: 'e2', laureat_id: 'l2', created_at: ilYa(0, 5) }],
  evenements: [{ id: 'ev1', author_id: 'adm', titre: 'Forum', created_at: ilYa(0, 2), annule: false }, { id: 'ev2', author_id: 'adm', titre: 'Annulé', created_at: ilYa(0, 1), annule: true }],
  questions: [], answers: [], votes: [], kudos: [], groupe_messages: [], avis_stage: [], entretiens: [], cafes: [],
});

test('actifs par semaine : la dernière semaine donne le chiffre de parcoursInscription (hors administration)', () => {
  const data = base();
  const s = actifsParSemaine(data, NOW);
  assert.equal(s.length, 8);
  assert.equal(s[7], parcoursInscription([], data, NOW).actifs);
  // Cette semaine : l1 (offre), e2 (réaction), e1 (candidature, relecture demandée), l3 (recrutement déclaré) ; l'administration ne compte pas
  assert.equal(s[7], 4);
  // La semaine d'avant : e1 (commentaire, conseil demandé), l2 et l1 (conseils acceptés il y a 9 et 11 jours)
  assert.equal(s[6], 3);
  assert.equal(s[4], 1, 'l1 : recrutement déclaré il y a 25 jours');
});

test('aides du réseau : les mêmes que « Cette semaine dans le réseau », d’un lauréat vers un étudiant', () => {
  const data = base();
  const aides = aidesDuReseau(data);
  assert.deepEqual(aides.map(a => a.sorte).sort(), ['cv', 'match', 'rdv', 'rdv', 'recrute']);
  assert.ok(aides.every(a => a.laureat.startsWith('l') && a.etudiant.startsWith('e')));
  const p = poulsReseau(data, NOW);
  const semaine = new Set(aides.filter(a => NOW - new Date(a.at) <= 7 * 864e5).map(a => a.laureat));
  assert.equal(p.jours, 7);
  assert.deepEqual([...semaine].sort(), [...p.aidants].sort());
  assert.equal(serieHebdo(aides.map(a => a.at), NOW)[7], 4, 'cette semaine : 2 rendez-vous, 1 relecture, 1 aide acceptée');
});

test('ceux qui aident le plus : sur 30 jours, le plus d’aides d’abord, puis la plus récente', () => {
  const t = topAidants(base(), NOW);
  assert.deepEqual(t.map(x => [x.id, x.aides, x.etudiants]), [['l1', 3, 2], ['l3', 1, 1], ['l2', 1, 1]]);
  assert.deepEqual(topAidants(base(), NOW, 30, 1).map(x => x.id), ['l1']);
  assert.deepEqual(topAidants(base(), NOW, 7).map(x => x.id), ['l1', 'l3', 'l2'], 'le recrutement d’il y a 20 jours ne compte plus');
  assert.equal(topAidants(base(), NOW, 7)[0].aides, 2);
});

test('ce qui s’est passé : le plus récent d’abord, sans l’administration comme membre ni les événements annulés', () => {
  const ev = evenementsReseau(base(), 15);
  assert.ok(ev.length <= 15);
  assert.deepEqual(ev.slice(0, 6).map(e => e.sorte), ['evenement', 'match', 'offre', 'offre', 'aide', 'demande']);
  for (let i = 1; i < ev.length; i++) assert.ok(ev[i - 1].t >= ev[i].t);
  assert.ok(!ev.some(e => e.sorte === 'membre' && ['adm', 'lv'].includes(e.qui)), 'ni l’administration, ni l’administration en vue lauréat');
  assert.ok(!ev.some(e => e.id === 'ev2'));
  const aide = ev.find(e => e.sorte === 'aide');
  assert.deepEqual([aide.qui, aide.avec, aide.id, aide.titre], ['l3', 'e1', 'd1', 'PFE en qualité']);
  const rec = ev.find(e => e.sorte === 'recrutement');
  assert.deepEqual([rec.qui, rec.avec, rec.titre], ['e1', 'l1', 'Atelier Nord']);
  assert.equal(evenementsReseau(base(), 3).length, 3);
});

test('où sont les membres : promos d’étudiants (5A d’abord), lauréats par 5 promos ; parcours, prépa ; ni l’administration ni la vue lauréat', () => {
  const r = repartitionMembres(base().profiles, 2026);
  assert.deepEqual(r.colonnes.map(c => c.code), ['PEI', 'PM', 'CIVIL', 'IA', 'INFO', 'PREPA']);
  assert.equal(r.colonnes[0].nom, 'Électro-industriel');
  assert.deepEqual(r.lignes.map(l => [l.etiquette, l.total]), [['5A · promo 2027', 2], ['3A · promo 2029', 1], ['Promos 2022–2026', 2], ['Promos 2012–2016', 1]]);
  assert.deepEqual(r.lignes[0].n, [1, 0, 0, 0, 0, 1]);
  assert.equal(r.max, 1);
  assert.equal(r.lignes.reduce((a, l) => a + l.total, 0), 6, 'ni l’admin ni l’admin en vue lauréat');
  const vieux = repartitionMembres([{ id: 'v', role: 'laureat', promo: 2001, filiere: 'Génie Mécanique' }, { id: 'w', role: 'laureat', promo: null, filiere: 'Génie Mécanique' }], 2026);
  assert.deepEqual(vieux.lignes.map(l => l.etiquette), ['Avant 2012', 'Sans promo']);
  assert.deepEqual(repartitionMembres([], 2026).lignes, []);
});

test('démo : les actifs de la semaine sont ceux de « Inscriptions », les aides celles du pouls', async () => {
  globalThis.window ??= {};
  window.ENSAM_CONFIG = {};
  const { createStore } = await import('../../src/store.js');
  const s = await createStore();
  const now = new Date();
  assert.equal(actifsParSemaine(s.data, now)[7], parcoursInscription([], s.data, now).actifs);
  const p = poulsReseau(s.data, now);
  const fen = p.jours * 864e5;
  const aidants = new Set(aidesDuReseau(s.data).filter(a => now - new Date(a.at) <= fen && new Date(a.at) <= now).map(a => a.laureat));
  assert.deepEqual([...aidants].sort(), [...p.aidants].sort());
  // Des semaines qui bougent, pour que les courbes de la démo disent quelque chose
  assert.ok(serieHebdo(s.data.profiles.map(x => x.created_at), now).some(Boolean));
  assert.ok(repartitionMembres(s.data.profiles).lignes.length >= 4);
});
