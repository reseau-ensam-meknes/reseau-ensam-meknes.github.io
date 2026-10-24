// Ambassadeurs de promo : qui la plateforme propose, quand elle passe au suivant, les chiffres de la promo,
// et ce qu'une réussite partagée dit (jamais un nom sans accord).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidatsAmbassadeur, proposerAmbassadeur, ambassadeurDuGroupe, ambassadeursActifs, chiffresPromo, reussitesDuGroupe, texteReussite, badgesOf, AMB_DELAI_JOURS } from '../../src/logic.js';

const GM = 'Génie Mécanique : Énergétique';
const NOW = Date.parse('2026-10-24T10:00:00Z');
const il = j => new Date(NOW - j * 864e5).toISOString();
const p = (id, role, promo, extra = {}) => ({ id, full_name: id[0].toUpperCase() + id.slice(1) + ' Test', role, promo, filiere: GM, created_at: il(100), ...extra });
const base = () => ({
  profiles: [p('ali', 'laureat', 2020, { created_at: il(300) }), p('badr', 'laureat', 2020, { created_at: il(200) }), p('chama', 'laureat', 2020),
    p('dina', 'laureat', 2020, { consent_at: null }), p('admin', 'admin', 2020), p('ely', 'laureat', 2021), p('fara', 'etudiant', 2020)],
  offers: [{ author_id: 'ali' }, { author_id: 'dina' }, { author_id: 'dina' }, { author_id: 'admin' }, { author_id: 'admin' }, { author_id: 'ely' }],
  propositions: [{ laureat_id: 'badr', status: 'envoyee' }, { laureat_id: 'chama', status: 'retiree' }],
  mentorships: [{ mentor_id: 'chama', student_id: 'fara', status: 'terminee' }, { mentor_id: 'ali', student_id: 'x', status: 'demande' }],
  answers: [], questions: [{ author_id: 'fara' }], ambassadeurs: [],
});

test('le plus actif de la promo et de la filière, jamais l’administration ni qui n’a pas accepté les conditions', () => {
  const d = base();
  // ali 3 (offre), badr 3 (aide), chama 3 (mentorat), fara 1 + 1 (question, mentorat reçu) ; égalité : le plus ancien inscrit
  assert.deepEqual(candidatsAmbassadeur(d, 2020, GM, NOW).map(x => [x.id, x.score]), [['ali', 3], ['badr', 3], ['chama', 3], ['fara', 2]]);
  assert.equal(proposerAmbassadeur(d, 2020, GM, NOW).candidat, 'ali');
  assert.equal(proposerAmbassadeur(d, 2021, GM, NOW).candidat, 'ely', 'une autre promo, un autre ambassadeur');
  assert.equal(proposerAmbassadeur(d, 2020, 'Génie Civil', NOW).candidat, null, 'personne');
  // Rien fait : jamais proposé
  d.offers = []; d.propositions = []; d.mentorships = []; d.questions = [];
  assert.equal(proposerAmbassadeur(d, 2020, GM, NOW).candidat, null);
});

test('un seul à la fois ; refus ou 7 jours sans réponse : le suivant ; retiré : jamais reproposé', () => {
  const d = base();
  d.ambassadeurs = [{ id: 'a1', promo: 2020, filiere: GM, user_id: 'ali', statut: 'propose', propose_at: il(2) }];
  assert.equal(ambassadeurDuGroupe(d, 2020, GM, NOW).user_id, 'ali');
  assert.deepEqual(proposerAmbassadeur(d, 2020, GM, NOW), { expirees: [], candidat: null });
  d.ambassadeurs[0].propose_at = il(AMB_DELAI_JOURS);
  const x = proposerAmbassadeur(d, 2020, GM, NOW);
  assert.deepEqual([x.expirees.map(a => a.id), x.candidat], [['a1'], 'badr']);
  d.ambassadeurs = [{ id: 'a1', promo: 2020, filiere: GM, user_id: 'ali', statut: 'refuse', propose_at: il(2) }, { id: 'a2', promo: 2020, filiere: GM, user_id: 'badr', statut: 'retire', propose_at: il(1) }];
  assert.equal(proposerAmbassadeur(d, 2020, GM, NOW).candidat, 'chama');
  d.ambassadeurs.push({ id: 'a3', promo: 2020, filiere: GM, user_id: 'chama', statut: 'accepte', propose_at: il(1) });
  assert.equal(proposerAmbassadeur(d, 2020, GM, NOW).candidat, null);
  assert.deepEqual([...ambassadeursActifs(d).keys()], ['chama']);
  // Le badge nomme sa promo, et les étudiants le voient (pas de points)
  const b = badgesOf(null, { id: 'chama', role: 'laureat' }, { ambassadeurs: ambassadeursActifs(d) }).find(x => x.id === 'ambassadeur');
  assert.equal(b.nom, 'Ambassadeur promo 2020');
  assert.match(b.desc, /promo 2020 \(Énergétique|promo 2020 \(/);
  assert.equal(badgesOf(null, { id: 'ali' }, { ambassadeurs: ambassadeursActifs(d) }).some(x => x.id === 'ambassadeur'), false);
});

test('les chiffres de la promo : inscrits, demandes pourvues, stages trouvés, en tout et ce mois-ci', () => {
  const d = base();
  d.profiles.push(p('nouv', 'etudiant', 2020, { created_at: '2026-10-03T08:00:00Z' }));
  d.demandes = [{ auteur_id: 'fara', status: 'pourvue', updated_at: '2026-10-10T08:00:00Z' }, { auteur_id: 'nouv', status: 'ouverte' }, { auteur_id: 'fara', status: 'pourvue', updated_at: '2026-09-10T08:00:00Z' }];
  d.placements = [{ student_id: 'fara', status: 'confirme', confirmed_at: '2026-10-12T08:00:00Z' }, { student_id: 'nouv', status: 'declare', created_at: '2026-09-02T08:00:00Z' }, { student_id: 'nouv', status: 'refuse', created_at: '2026-10-02T08:00:00Z' }];
  assert.deepEqual(chiffresPromo(d, 2020, GM, new Date(2026, 9, 1)), { inscrits: 6, nouveaux: 1, demandes: 2, demandes_mois: 1, stages: 2, stages_mois: 1 });
});

test('une réussite à partager : vérifiée des deux côtés ; le prénom seulement avec l’accord ; jamais le lauréat', () => {
  const d = base();
  d.placements = [
    { id: 'r1', student_id: 'fara', laureat_id: 'ali', status: 'confirme', type: 'pfe', entreprise: 'OCP', confirmed_at: il(3), partage_ok: false },
    { id: 'r2', student_id: 'fara', status: 'declare', type: 'stage', entreprise: 'Renault', created_at: il(2) },
    { id: 'r3', student_id: 'fara', status: 'confirme', type: 'stage', entreprise: 'Vieux', confirmed_at: il(90) },
  ];
  const l = reussitesDuGroupe(d, 2020, GM, NOW);
  assert.deepEqual(l.map(x => x.id), ['r1']);
  const fara = d.profiles.find(x => x.id === 'fara');
  const t = texteReussite(l[0], fara, 'fr', 'https://x/?promo=2020');
  assert.match(t, /^Bonne nouvelle pour la promo 2020 🎉\nQuelqu’un de la promo 2020 \(.+\) a décroché un PFE chez OCP, grâce à un lauréat du réseau\./);
  assert.doesNotMatch(t, /Fara|Ali/);
  assert.match(texteReussite({ ...l[0], partage_ok: true }, fara, 'fr', 'L'), /\nFara a décroché un PFE chez OCP/);
  const ar = texteReussite(l[0], fara, 'ar', 'L');
  assert.match(ar, /خبر سار للدفعة 2020/); assert.doesNotMatch(ar, /القدامى|Fara/);
});
