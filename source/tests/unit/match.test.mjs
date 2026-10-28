// Match : les cartes de chacun, les refus (mêmes mots que la base), le match quand les deux disent oui, les étapes ;
// puis la démo (DemoStore) qui suit les mêmes règles que protect_match_choix() et match_apres_choix().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refusChoixMatch, nouveauMatch, deckMatch, matchsDe, etapeMatch, pourquoiCarte, matchEntre, lienAvec, peutDiscuter, MATCH_PAR_JOUR, PREPA } from '../../src/logic.js';

const NOW = new Date(2026, 9, 27, 10, 0).getTime();     // mardi 27 octobre 2026 : saison 2026-2027
const SAISON = 2026;
const il_y_a = (j, h = 0) => new Date(NOW - j * 864e5 - h * 36e5).toISOString();
const GIEO = 'Génie Industriel : Excellence Opérationnelle', GIP = 'Génie Industriel et Productique', GME = 'Génie Mécanique : Énergétique';
const P = {
  s: { id: 's', role: 'etudiant', full_name: 'Salma Bennani', promo: 2027, filiere: GIEO, competences: ['Lean'], created_at: il_y_a(300) },   // 5A
  t: { id: 't', role: 'etudiant', full_name: 'Taha Alami', promo: 2029, filiere: GME, created_at: il_y_a(100) },                               // 3A, autre parcours
  u: { id: 'u', role: 'etudiant', full_name: 'Ilham Tazi', promo: 2028, filiere: GIP, cv_path: 'u/cv.pdf', created_at: il_y_a(90) },           // 4A, même parcours
  w: { id: 'w', role: 'etudiant', full_name: 'Wiam Idrissi', promo: 2028, filiere: GIEO, created_at: il_y_a(80) },                             // 4A, même filière
  v: { id: 'v', role: 'etudiant', full_name: 'Invisible', promo: 2027, filiere: GIEO, match_visible: false, created_at: il_y_a(50) },
  q: { id: 'q', role: 'etudiant', full_name: 'En prépa', promo: 2031, filiere: PREPA, created_at: il_y_a(10) },
  l: { id: 'l', role: 'laureat', full_name: 'Youssef El Amrani', promo: 2018, filiere: GIEO, competences: ['Lean'], entreprise: 'Renault' },
  m: { id: 'm', role: 'laureat', full_name: 'Meryem Kettani', promo: 2016, filiere: GME, entreprise: 'LafargeHolcim' },
  a: { id: 'a', role: 'admin', full_name: 'Administration' },
};
const offre = x => ({ id: 'o', author_id: 'l', titre: 'PFE : Lean sur la ligne', type: 'pfe', status: 'ouverte', audience: 'etudiants', annees: [5], filieres: [GIEO], created_at: il_y_a(3), ...x });
const OFFRES = [offre(), offre({ id: 'o2', author_id: 'm', titre: 'Stage : énergie', type: 'stage', filieres: [GME], annees: [3, 4] }), offre({ id: 'o3', author_id: 'm', titre: 'PFE : toutes filières', filieres: [], created_at: il_y_a(1) })];
const base = x => ({ profiles: Object.values(P), offers: OFFRES, applications: [], match_choix: [], matchs: [], blocages: [], demandes: [], messages: [], placements: [],
  mentorships: [], relectures_cv: [], parrainages: [], demandes_contact: [], ...x });
const choix = (user_id, cible, c = 'oui', j = 1) => ({ id: `${user_id}>${cible.offre || cible.profil}`, user_id, cible_profil: cible.profil || null, cible_offre: cible.offre || null, choix: c, created_at: il_y_a(j), updated_at: il_y_a(j) });
const cles = (d, me) => deckMatch(d, me, NOW, SAISON).map(c => c.cle);
const refus = (d, me, cible) => refusChoixMatch(d, me, cible, NOW, SAISON);

test('refus : réservé aux étudiants et aux lauréats, les offres aux étudiants de l’année, mêmes mots que la base', () => {
  const d = base();
  assert.equal(refus(d, P.a, { offre: 'o' }), 'Match est réservé aux étudiants et aux lauréats.');
  assert.equal(refus(d, P.s, { offre: 'zz' }), 'Cette offre n’existe plus.');
  assert.equal(refus(d, P.l, { offre: 'o' }), 'C’est ta propre offre.');
  assert.equal(refus(d, P.l, { offre: 'o2' }), 'Dans Match, les offres sont proposées aux étudiants.');
  assert.equal(refus(base({ offers: [offre({ status: 'pourvue' })] }), P.s, { offre: 'o' }), 'Cette offre n’est plus ouverte.');
  assert.equal(refus(d, P.t, { offre: 'o' }), 'Cette offre n’est pas proposée à ton année.', 'un 3A sur un PFE de 5A');
  assert.equal(refus(base({ offers: [offre({ audience: 'laureats' })] }), P.s, { offre: 'o' }), 'Cette offre n’est pas proposée à ton année.');
  assert.equal(refus(d, P.s, { offre: 'o' }), null);
});

test('refus : un profil — l’étudiant répond seulement aux lauréats intéressés ; le lauréat voit les étudiants visibles', () => {
  const d = base();
  assert.equal(refus(d, P.s, { profil: 's' }), 'Choisis un autre membre que toi.');
  assert.equal(refus(d, P.s, { profil: 'zz' }), 'Ce membre n’est plus sur le réseau.');
  assert.equal(refus(d, P.s, { profil: 'l' }), 'Ici, tu réponds aux lauréats qui s’intéressent à ton profil.');
  assert.equal(refus(base({ match_choix: [choix('l', { profil: 's' })] }), P.s, { profil: 'l' }), null, 'Youssef a dit oui : Salma peut répondre');
  assert.equal(refus(base({ match_choix: [choix('l', { profil: 's' }, 'plus_tard')] }), P.s, { profil: 'l' }), 'Ici, tu réponds aux lauréats qui s’intéressent à ton profil.');
  assert.equal(refus(d, P.l, { profil: 'm' }), 'Ce profil n’est pas proposé dans Match.', 'pas un lauréat');
  assert.equal(refus(d, P.l, { profil: 'v' }), 'Ce profil n’est pas proposé dans Match.', 'il a choisi de ne pas apparaître');
  assert.equal(refus(base({ match_choix: [choix('v', { offre: 'o' })] }), P.l, { profil: 'v' }), null, '…sauf s’il a dit oui à une offre de ce lauréat');
  assert.equal(refus(d, P.l, { profil: 't' }), null);
  assert.equal(refus(base({ blocages: [{ user_id: 't', bloque_id: 'l' }] }), P.l, { profil: 't' }), 'Action non autorisée pour ton compte.');
});

test(`refus : ${MATCH_PAR_JOUR} choix par 24 h au plus ; changer d’avis sur une carte ne compte pas`, () => {
  const lignes = Array.from({ length: MATCH_PAR_JOUR }, (_, i) => ({ ...choix('l', { profil: 'x' + i }, 'plus_tard', 0), updated_at: il_y_a(0, i % 20) }));
  assert.equal(refus(base({ match_choix: lignes }), P.l, { profil: 't' }), 'Tu as déjà fait 80 choix aujourd’hui. La suite demain !');
  assert.equal(refus(base({ match_choix: [...lignes.slice(1), choix('l', { profil: 't' }, 'plus_tard', 0)] }), P.l, { profil: 't' }), null, 'la même carte');
  assert.equal(refus(base({ match_choix: lignes.map(x => ({ ...x, updated_at: il_y_a(1, 1) })) }), P.l, { profil: 't' }), null, 'hier : la suite');
});

test('nouveauMatch : le lauréat dit oui au profil, l’étudiant à une offre de ce lauréat (la plus récente) ou à son profil', () => {
  const lau = choix('l', { profil: 's' }, 'oui', 2), etu = choix('s', { offre: 'o' }, 'oui', 0);
  assert.deepEqual(nouveauMatch(base({ match_choix: [lau, etu] }), etu), { etudiant_id: 's', laureat_id: 'l', offre_id: 'o' });
  assert.deepEqual(nouveauMatch(base({ match_choix: [etu, lau] }), lau), { etudiant_id: 's', laureat_id: 'l', offre_id: 'o' }, 'dans l’autre ordre');
  const rep = choix('s', { profil: 'l' }, 'oui', 0);
  assert.deepEqual(nouveauMatch(base({ match_choix: [lau, rep] }), rep), { etudiant_id: 's', laureat_id: 'l', offre_id: null }, 'en réponse à son intérêt, sans offre');
  assert.equal(nouveauMatch(base({ match_choix: [etu] }), etu), null, 'oui d’un seul côté');
  assert.equal(nouveauMatch(base({ match_choix: [lau, { ...etu, choix: 'plus_tard' }] }), { ...etu, choix: 'plus_tard' }), null);
  assert.equal(nouveauMatch(base({ match_choix: [lau, etu] }), etu, etu), null, 'déjà oui avant : rien de nouveau');
  assert.equal(nouveauMatch(base({ match_choix: [lau, etu], matchs: [{ id: 'x', etudiant_id: 's', laureat_id: 'l' }] }), etu), null, 'déjà un match');
  assert.equal(nouveauMatch(base({ match_choix: [choix('m', { profil: 's' }), etu] }), etu), null, 'oui à l’offre d’un autre lauréat');
});

test('cartes de l’étudiant : d’abord les lauréats intéressés (avec leur offre), puis les offres de sa filière et de son année', () => {
  const d = base({ match_choix: [choix('l', { profil: 's' })] });
  const deck = deckMatch(d, P.s, NOW, SAISON);
  assert.deepEqual(deck.map(c => c.cle), ['p:l', 'o:o3'], 'l’offre de Youssef est dans sa carte ; le stage 3A-4A n’est pas pour une 5A');
  assert.equal(deck[0].sorte, 'laureat'); assert.equal(deck[0].interet.offre.id, 'o');
  assert.equal(deck[0].raison, 'Même filière que toi');
  assert.deepEqual(cles(base(), P.s), ['o:o', 'o:o3'], 'sa filière avant « toutes filières »');
  assert.deepEqual(cles(base(), P.t), ['o:o2'], 'un 3A voit le stage de son année');
  assert.deepEqual(cles(base({ applications: [{ id: 'a', student_id: 's', offer_id: 'o' }] }), P.s), ['o:o3'], 'déjà candidat : pas de carte');
  assert.deepEqual(cles(base({ offers: [offre({ deadline: '2026-10-26' })] }), P.s), [], 'date limite passée');
  assert.deepEqual(cles(base({ offers: [offre({ author_id: 'a' })] }), P.s), [], 'une offre sans lauréat : pas de match possible');
  assert.deepEqual(cles(base(), P.a), [], 'l’administration n’a pas de cartes');
  assert.deepEqual(cles(base(), null), []);
});

test('cartes : jamais déjà « Intéressé », « Plus tard » revient après 30 jours ou un intérêt plus récent ; ni bloqué, ni déjà en match', () => {
  assert.deepEqual(cles(base({ match_choix: [choix('s', { offre: 'o' })] }), P.s), ['o:o3']);
  assert.deepEqual(cles(base({ match_choix: [choix('s', { offre: 'o3' }, 'plus_tard', 5)] }), P.s), ['o:o']);
  assert.deepEqual(cles(base({ match_choix: [choix('s', { offre: 'o3' }, 'plus_tard', 31)] }), P.s), ['o:o', 'o:o3'], '30 jours plus tard, la carte revient');
  // Plus tard sur Youssef, puis il redit oui (plus tard) : il revient en tête
  const plusTard = choix('s', { profil: 'l' }, 'plus_tard', 3);
  assert.deepEqual(cles(base({ match_choix: [plusTard, choix('l', { profil: 's' }, 'oui', 5)] }), P.s), ['o:o', 'o:o3'], 'son oui est plus ancien : sa carte attend, son offre reste une carte à part');
  assert.deepEqual(cles(base({ match_choix: [plusTard, choix('l', { profil: 's' }, 'oui', 1)] }), P.s), ['p:l', 'o:o3'], 'son oui est plus récent');
  assert.deepEqual(cles(base({ blocages: [{ user_id: 'm', bloque_id: 's' }] }), P.s), ['o:o']);
  assert.deepEqual(cles(base({ matchs: [{ id: 'x', etudiant_id: 's', laureat_id: 'l' }] }), P.s), ['o:o3'], 'déjà en match avec Youssef');
});

test('cartes du lauréat : les étudiants qui ont dit oui à ses offres, puis ceux qui montrent leur CV, puis les plus proches (jamais la prépa)', () => {
  // Ilham montre son CV : elle passe d'abord ; puis même filière (la 5A avant la 4A), même parcours, le reste ; ni l'invisible, ni la prépa
  assert.deepEqual(cles(base(), P.l), ['p:u', 'p:s', 'p:w', 'p:t']);
  // Son CV réservé à ses contacts : il ne compte plus, l'ordre des filières revient
  const prive = base({ profiles: Object.values(P).map(x => (x.id === 'u' ? { ...x, visibilite: { cv: 'contacts' } } : x)) });
  assert.deepEqual(cles(prive, P.l), ['p:s', 'p:w', 'p:u', 'p:t']);
  // Un intérêt pour son offre passe devant, même d’un étudiant invisible ; et la carte dit pour quelle offre
  const d = base({ match_choix: [choix('t', { offre: 'o' }), choix('v', { offre: 'o' }, 'oui', 0)] });
  const deck = deckMatch(d, P.l, NOW, SAISON);
  assert.deepEqual(deck.slice(0, 2).map(c => c.cle), ['p:v', 'p:t'], 'le plus récent d’abord');
  assert.equal(deck[1].interet.offre.id, 'o');
  assert.equal(deck.filter(c => c.cle === 'p:t').length, 1, 'une seule carte par étudiant');
  // Une demande ouverte (même parcours) passe avant tout le reste, et la carte dit ce qu'il cherche
  const dem = deckMatch(base({ demandes: [{ id: 'd1', auteur_id: 'u', type: 'pfe', titre: 'PFE en Lean', status: 'ouverte', created_at: il_y_a(2) }] }), P.l, NOW, SAISON);
  assert.deepEqual([dem[0].cle, dem[0].raison], ['p:u', 'Cherche un PFE en GIP24']);
  assert.deepEqual(cles(base({ match_choix: [choix('l', { profil: 't' })] }), P.l).includes('p:t'), false, 'déjà « Intéressé »');
});

test('pourquoi cette carte : une phrase vraie', () => {
  const o = c => pourquoiCarte({ sorte: 'offre', offre: offre(c) }, P.s, base(), SAISON);
  assert.equal(o({}), 'Pour ta filière');
  assert.equal(o({ filieres: [GIP] }), 'Pour ton parcours');
  assert.equal(o({ filieres: [] }), 'Ouverte à toutes les filières');
  assert.equal(o({ filieres: [GME] }), 'Pour ton année');
  assert.equal(pourquoiCarte({ sorte: 'laureat', profil: P.m }, P.s), 'Travaille chez LafargeHolcim');
  assert.equal(pourquoiCarte({ sorte: 'etudiant', profil: P.t }, P.l, base(), SAISON), 'En 3A à l’école');
  assert.equal(pourquoiCarte({ sorte: 'etudiant', profil: { ...P.t, competences: ['lean'] } }, P.l, base(), SAISON), 'lean, comme toi');
  assert.equal(pourquoiCarte({ sorte: 'etudiant', profil: P.u }, P.l, base(), SAISON), 'Même parcours que toi');
});

test('les matchs : le plus récent d’abord, « nouveau » tant que je ne l’ai pas vu ; la discussion s’ouvre', () => {
  const d = base({ matchs: [
    { id: 'x1', etudiant_id: 's', laureat_id: 'm', offre_id: 'o3', created_at: il_y_a(4), vu_etudiant_at: il_y_a(4), vu_laureat_at: null },
    { id: 'x2', etudiant_id: 's', laureat_id: 'l', offre_id: null, created_at: il_y_a(1), vu_etudiant_at: null, vu_laureat_at: il_y_a(1) },
  ] });
  assert.deepEqual(matchsDe(d, P.s).map(x => [x.autre.id, x.nouveau]), [['l', true], ['m', false]]);
  assert.deepEqual(matchsDe(d, P.m).map(x => [x.autre.id, x.nouveau, x.offre.id]), [['s', true, 'o3']]);
  assert.deepEqual(matchsDe(d, P.t), []);
  assert.equal(matchEntre(d, 'm', 's').id, 'x1', 'dans un sens ou dans l’autre');
  const profil = id => P[id] || null;
  assert.equal(peutDiscuter(base(), P.s, 'm', profil), false);
  assert.equal(peutDiscuter(d, P.s, 'm', profil), true);
  assert.deepEqual([lienAvec(d, P.m, 's', profil).type, lienAvec(d, P.m, 's', profil).detail], ['match', 'PFE : toutes filières']);
});

test('étapes d’un match : Match, puis Entretien (accepté ou candidature en entretien), Retenu, ou pas retenu', () => {
  const mt = { id: 'x', etudiant_id: 's', laureat_id: 'l', offre_id: 'o' };
  const rdv = r => ({ id: 'r', type: 'rdv', author_id: 'l', dest_id: 's', rdv_at: il_y_a(-2), rdv_reponse: r });
  assert.equal(etapeMatch(base(), mt), 'match');
  assert.equal(etapeMatch(base({ messages: [rdv(null)] }), mt), 'match', 'proposé, pas encore accepté');
  assert.equal(etapeMatch(base({ messages: [rdv('autre')] }), mt), 'match');
  assert.equal(etapeMatch(base({ messages: [rdv('oui')] }), mt), 'entretien');
  assert.equal(etapeMatch(base({ applications: [{ student_id: 's', offer_id: 'o', status: 'entretien' }] }), mt), 'entretien');
  assert.equal(etapeMatch(base({ applications: [{ student_id: 's', offer_id: 'o', status: 'retenu' }] }), mt), 'retenu');
  assert.equal(etapeMatch(base({ placements: [{ student_id: 's', laureat_id: 'l', status: 'confirme' }] }), mt), 'retenu');
  assert.equal(etapeMatch(base({ applications: [{ student_id: 's', offer_id: 'o', status: 'refuse' }] }), mt), 'pas_retenu');
  assert.equal(etapeMatch(base(), null), 'match');
});

// ---------------------------------------------------------------------------
// La démo : mêmes gardes que la base, et la graine raconte déjà une histoire
// ---------------------------------------------------------------------------
async function demo() {
  globalThis.window ??= {};
  window.ENSAM_CONFIG = {};
  const { createStore } = await import('../../src/store.js');
  const s = await createStore();
  const qui = nom => s.personas().find(p => p._persona.includes(nom));
  return { s, qui, comme: nom => s.switchTo(qui(nom).id) };
}

test('démo : la graine — des intérêts qui attendent, un match avec une discussion et un entretien proposé', async () => {
  const { s, qui } = await demo();
  const salma = qui('Salma'), youssef = qui('Youssef');
  const deckS = deckMatch(s.data, salma);
  assert.equal(deckS[0].sorte, 'laureat', 'une lauréate s’intéresse au profil de Salma : elle est en tête');
  const deckY = deckMatch(s.data, youssef);
  assert.ok(deckY.slice(0, 2).every(c => c.interet), 'deux étudiantes ont dit oui au PFE de Youssef');
  assert.ok(deckY.some(c => c.profil.id === salma.id && c.interet));
  const [mS] = matchsDe(s.data, salma);
  assert.equal(mS.autre.role, 'laureat');
  const rdv = s.data.messages.find(m => m.type === 'rdv' && m.dest_id === salma.id);
  assert.ok(rdv && new Date(rdv.rdv_at) > new Date() && rdv.rdv_duree === 30 && /^https:\/\/meet\.jit\.si\//.test(rdv.rdv_lien));
  assert.equal(rdv.author_id, mS.autre.id);
  assert.equal(matchsDe(s.data, youssef).length, 1, 'Youssef a déjà un match');
});

test('démo : choisir, le match, revenir, vu, retirer — mêmes refus que la base', async () => {
  const { s, qui, comme } = await demo();
  const salma = qui('Salma');
  comme('Youssef');
  await assert.rejects(s.choisirMatch({}, 'oui'), { message: 'Choix invalide.' });
  await assert.rejects(s.choisirMatch({ profil: salma.id }, 'peut-être'), { message: 'Choix invalide.' });
  await assert.rejects(s.choisirMatch({ profil: s.me.id }), { message: 'Choisis un autre membre que toi.' });
  // « Plus tard » ne fait rien naître ; « Revenir » l'efface
  const n = s.data.match_choix.length;
  assert.deepEqual(await s.choisirMatch({ profil: salma.id }, 'plus_tard'), { match: null });
  assert.equal(s.data.match_choix.length, n + 1);
  assert.deepEqual(await s.revenirMatch(), { profil: salma.id, offre: null });
  assert.equal(s.data.match_choix.length, n);
  // Salma a dit oui à son PFE : oui de Youssef = un match, lié à cette offre, pas encore vu
  const { match } = await s.choisirMatch({ profil: salma.id });
  assert.ok(match && match.etudiant_id === salma.id && match.laureat_id === s.me.id);
  const pfe = s.byId('offers', match.offre_id);
  assert.equal(pfe.author_id, s.me.id);
  assert.equal(match.vu_etudiant_at, null); assert.equal(match.vu_laureat_at, null);
  assert.equal(s.voitChamp(salma, 'cv'), true, 'le lauréat du match lit le CV');
  assert.equal(await s.revenirMatch(), null, 'un choix qui a fait un match reste');
  assert.ok(!deckMatch(s.data, s.me).some(c => c.profil.id === salma.id), 'sa carte quitte la pile');
  await s.vuMatch(match.id);
  assert.ok(s.byId('matchs', match.id).vu_laureat_at); assert.equal(s.byId('matchs', match.id).vu_etudiant_at, null, 'seulement ma date');
  // Un autre membre ne retire pas ce match ; l'un des deux, si
  comme('Amine');
  await assert.rejects(s.retirerMatch(match.id), { message: 'Action non autorisée pour ton compte.' });
  comme('Salma');
  await s.retirerMatch(match.id);
  assert.ok(!s.byId('matchs', match.id));
});

test('démo : l’entretien proposé — le destinataire répond, les champs sont vérifiés comme dans la base', async () => {
  const { s, comme } = await demo();
  comme('Salma');
  const rdv = s.data.messages.find(m => m.type === 'rdv' && m.dest_id === s.me.id);
  await assert.rejects(s.repondreRdv(rdv.id, 'bof'), { message: 'Réponse invalide.' });
  assert.equal((await s.repondreRdv(rdv.id, 'oui')).rdv_reponse, 'oui');
  assert.equal(etapeMatch(s.data, matchEntre(s.data, s.me.id, rdv.author_id)), 'entretien');
  assert.equal((await s.repondreRdv(rdv.id, 'autre')).rdv_reponse, 'autre', 'on peut changer d’avis avant l’heure');
  // L'auteur ne répond pas à sa propre proposition
  s.switchTo(rdv.author_id);
  await assert.rejects(s.repondreRdv(rdv.id, 'oui'), { message: 'Action non autorisée pour ton compte.' });
  const dest = rdv.dest_id, demain = new Date(Date.now() + 864e5).toISOString();
  const envoi = x => s.envoyerMessage({ dest, type: 'rdv', body: null, rdv_at: demain, rdv_duree: 30, rdv_lien: 'https://meet.jit.si/ReseauENSAM-test', ...x });
  await assert.rejects(envoi({ rdv_at: new Date(Date.now() - 6e4).toISOString() }), { message: 'Choisis une date à venir, dans les 4 prochains mois.' });
  await assert.rejects(envoi({ rdv_at: new Date(Date.now() + 200 * 864e5).toISOString() }), { message: 'Choisis une date à venir, dans les 4 prochains mois.' });
  await assert.rejects(envoi({ rdv_duree: 5 }), { message: 'La durée va de 15 à 120 minutes.' });
  await assert.rejects(envoi({ rdv_lien: 'http://exemple.ma' }), { message: 'Le lien de la visio doit commencer par https://' });
  await assert.rejects(envoi({ body: 'x'.repeat(501) }), { message: 'La note est trop longue (500 caractères au plus).' });
  const r = await envoi({ rdv_lien: null, rdv_lieu: '  Usine de Meknès  ', rdv_duree: 15 });
  assert.deepEqual([r.type, r.rdv_lieu, r.rdv_lien, r.rdv_reponse, r.rdv_duree], ['rdv', 'Usine de Meknès', null, null, 15]);
  // Un message ordinaire ne garde aucun champ d'entretien
  const t = await s.envoyerMessage({ dest, type: 'texte', body: 'Bonjour', rdv_at: demain, rdv_duree: 30 });
  assert.equal('rdv_at' in t || 'rdv_duree' in t, false);
});
