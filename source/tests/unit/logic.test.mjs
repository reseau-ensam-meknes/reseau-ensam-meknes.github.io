// Règles de calcul partagées par le site (saisons, niveaux, enquête, insertion, entreprises)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonOf, niveauOf, enqueteDue, cleNom, sameCompany, statsInsertion, rapportInsertion } from '../../src/logic.js';

test('saison : elle commence en septembre', () => {
  assert.equal(seasonOf(new Date(2026, 8, 1)), 2026);
  assert.equal(seasonOf(new Date(2026, 7, 31)), 2025);
});

test('niveau : calculé depuis la promo, il avance chaque septembre', () => {
  assert.equal(niveauOf({ promo: 2027 }, 2026), 5);
  assert.equal(niveauOf({ promo: 2029 }, 2026), 3);
  assert.equal(niveauOf({ promo: 2026 }, 2026), 6);
  assert.equal(niveauOf({ promo: 2015 }, 2026), 7);
  assert.equal(niveauOf({ promo: 2027 }, 2027), 6);
});

test('enquête d’insertion : 6 mois puis 12 mois après le diplôme, une seule fois chacune', () => {
  const hajar = { id: 'h', role: 'laureat', promo: 2025 };
  assert.equal(enqueteDue(hajar, [], new Date(2025, 11, 15)), null);
  assert.equal(enqueteDue(hajar, [], new Date(2026, 2, 1)).vague, 6);
  assert.equal(enqueteDue(hajar, [], new Date(2026, 9, 20)).vague, 12);
  assert.equal(enqueteDue(hajar, [{ user_id: 'h', vague: 12 }], new Date(2026, 9, 20)), null);
  assert.equal(enqueteDue(hajar, [], new Date(2027, 4, 1)), null);
  assert.equal(enqueteDue({ id: 's', role: 'etudiant', promo: 2027 }, [], new Date(2026, 9, 20)), null);
  assert.equal(enqueteDue({ id: 'a', role: 'admin', promo: 2025 }, [], new Date(2026, 2, 1)), null);
});

test('noms : « EL AMRANI Salma » est la même personne que « Salma El-Amrani »', () => {
  assert.equal(cleNom('EL AMRANI Salma'), cleNom('Salma El-Amrani'));
  assert.notEqual(cleNom('Salma Bennani'), cleNom('Salma El Amrani'));
});

test('entreprises : même nom écrit autrement', () => {
  assert.ok(sameCompany('Renault Group Maroc', 'Renault'));
  assert.ok(sameCompany('OCP Group', 'ocp'));
  assert.ok(!sameCompany('OCP', 'Renault'));
  assert.ok(!sameCompany('', 'Renault'));
});

const reponse = (promo, filiere, situation, extra = {}) => ({ promo, vague: 6, filiere, situation, ...extra });

test('chiffres d’insertion : rien de détaillé sous 5 réponses', () => {
  const peu = statsInsertion([reponse(2025, 'GI', 'emploi', { salaire: '10_15' }), reponse(2025, 'GI', 'recherche')]);
  assert.equal(peu.length, 1);
  assert.equal(peu[0].n, 2);
  assert.equal(peu[0].salaires, null);
  assert.equal(peu[0].filieres, null);
  const assez = statsInsertion(['emploi', 'emploi', 'entrepreneur', 'recherche', 'etudes'].map(s => reponse(2025, 'GI', s, { salaire: '10_15', pays: s === 'emploi' ? 'France' : 'Maroc' })));
  assert.equal(assez[0].en_poste, 3);
  assert.equal(assez[0].etranger, 2);
  assert.deepEqual(assez[0].filieres, { GI: { n: 5, en_poste: 3 } });
  assert.deepEqual(assez[0].salaires, { '10_15': 5 });
});

test('taux d’insertion : ceux qui poursuivent leurs études ne comptent pas', () => {
  const profiles = [1, 2, 3, 4].map(i => ({ id: 'p' + i, role: 'laureat', promo: 2025, filiere: 'GI' }));
  const enquetes_insertion = [reponse(2025, 'GI', 'emploi'), reponse(2025, 'GI', 'recherche'), reponse(2025, 'GI', 'etudes')];
  const [r] = rapportInsertion({ profiles, enquetes_insertion, liste_officielle: [] }, new Date(2026, 9, 20));
  assert.equal(r.repondants, 3);
  assert.equal(r.taux_insertion, 0.5);
  assert.equal(r.taux_reponse, 0.75);
});

test('Membre fondateur : les 25 premiers lauréats inscrits, jamais un étudiant', async () => {
  const { fondateursOf, badgesOf, NB_FONDATEURS } = await import('../../src/logic.js');
  const jour = i => new Date(Date.UTC(2026, 9, 1) + i * 36e5).toISOString();
  const profiles = [
    { id: 'etu', role: 'etudiant', created_at: jour(0) },
    ...Array.from({ length: 30 }, (_, i) => ({ id: 'l' + i, role: 'laureat', created_at: jour(30 - i) })),
  ];
  const f = fondateursOf(profiles);
  assert.equal(f.size, NB_FONDATEURS);
  assert.ok(!f.has('etu'));
  assert.ok(f.has('l29') && f.has('l5') && !f.has('l4'));
  const ids = p => badgesOf({}, p, { fondateurs: f }).map(b => b.id);
  assert.ok(ids({ id: 'l29' }).includes('fondateur'));
  assert.ok(!ids({ id: 'l0' }).includes('fondateur'));
});

test('réponses en 48 h : demandes d’étudiants sur 30 jours, celles qui attendent depuis plus de 24 h', async () => {
  const { reponses48h } = await import('../../src/logic.js');
  const now = new Date('2026-11-10T12:00:00Z'), il = h => new Date(now.getTime() - h * 36e5).toISOString();
  const data = {
    profiles: [{ id: 'e', role: 'etudiant' }, { id: 'l', role: 'laureat' }, { id: 'a', role: 'admin' }],
    mentorships: [
      { id: 'm1', student_id: 'e', sujet: 'PFE', status: 'acceptee', created_at: il(100), accepted_at: il(80) },   // 20 h : à temps
      { id: 'm2', student_id: 'e', sujet: 'Stage', status: 'demande', created_at: il(60) },                        // 60 h sans réponse : en retard
      { id: 'm3', student_id: 'e', sujet: 'CV', status: 'demande', created_at: il(30) },                          // 30 h : attend, pas encore compté
      { id: 'm4', student_id: 'e', sujet: 'Annulée', status: 'annulee', created_at: il(90) },
      { id: 'm5', student_id: 'a', sujet: 'test admin', status: 'demande', created_at: il(90) },
      { id: 'm6', student_id: 'e', sujet: 'Vieille', status: 'demande', created_at: il(24 * 40) },
    ],
    questions: [{ id: 'q1', author_id: 'e', titre: 'Question', created_at: il(70) }, { id: 'q2', author_id: 'l', titre: 'De lauréat', created_at: il(70) }],
    answers: [{ question_id: 'q1', author_id: 'e', created_at: il(69) }, { question_id: 'q1', author_id: 'l', created_at: il(60) }],
  };
  const r = reponses48h(data, now);
  assert.equal(r.total, 3); assert.equal(r.a48, 2); assert.equal(Math.round(r.taux * 100), 67);
  assert.deepEqual(r.attente.map(d => d.id), ['m2', 'm3']);
  assert.deepEqual(r.parType.mentorat, { total: 2, a48: 1, taux: 0.5 });
  assert.deepEqual(r.parType.question, { total: 1, a48: 1, taux: 1 });
  assert.equal(r.parType.demande.taux, null, 'pas encore de Demande');
});

test('inscriptions : compte créé, profil rempli, première action ; actifs de la semaine', async () => {
  const { parcoursInscription } = await import('../../src/logic.js');
  const now = new Date('2026-11-10T12:00:00Z'), il = j => new Date(now.getTime() - j * 864e5).toISOString();
  const data = {
    profiles: [{ id: 'e', role: 'etudiant' }, { id: 'l', role: 'laureat' }, { id: 'l2', role: 'laureat' }, { id: 'a', role: 'admin' }],
    offers: [{ author_id: 'l', created_at: il(10) }, { author_id: 'a', created_at: il(1) }],
    mentorships: [{ student_id: 'e', mentor_id: 'l2', created_at: il(12), accepted_at: il(2) }],
  };
  const comptes = [{ id: 'e', a_profil: true }, { id: 'l', a_profil: true }, { id: 'l2', a_profil: true }, { id: 'a', a_profil: true }, { id: 'x', a_profil: false }, { id: 'y', a_profil: false }];
  assert.deepEqual(parcoursInscription(comptes, data, now), { comptes: 5, profil: 3, action: 3, actifs: 1 }, 'l’administration ne compte pas ; accepter une demande d’aide est une action');
  assert.equal(parcoursInscription([], data, now).comptes, 3, 'sans la liste des comptes : les profils');
});
