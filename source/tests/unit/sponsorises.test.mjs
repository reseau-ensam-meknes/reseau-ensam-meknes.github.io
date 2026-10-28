// Cartes sponsorisées de Match : où elles s'insèrent (une après chaque 10 cartes, jamais en tête, aucune sous 10 cartes),
// qui elles visent (public, année, filière), les refus (mêmes mots que la base), les totaux ;
// puis la démo (DemoStore) qui suit les mêmes règles que compter_sponsorise() et bilan_sponsorises().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avecSponsorises, sponsorisePour, sponsorisesPour, sponsoEnCours, etatSponsorise, normaliserSponsorise, refusSponsorise,
  totauxSponsorises, tauxClic, decalageSponso, jourLocal, SPONSO_PAS } from '../../src/logic.js';

const NOW = new Date(2026, 9, 27, 10, 0).getTime();     // mardi 27 octobre 2026 : saison 2026-2027
const SAISON = 2026;
const GIEO = 'Génie Industriel : Excellence Opérationnelle', GIP = 'Génie Industriel et Productique', GME = 'Génie Mécanique : Énergétique';
const P = {
  s: { id: 's', role: 'etudiant', promo: 2027, filiere: GIEO },              // 5A
  t: { id: 't', role: 'etudiant', promo: 2029, filiere: GME },               // 3A
  j: { id: 'j', role: 'laureat', promo: 2026, filiere: GIP },                // jeune diplômé (6)
  l: { id: 'l', role: 'laureat', promo: 2018, filiere: GIEO },               // lauréat (7)
  o: { id: 'o', role: 'laureat', promo: 2012, filiere: 'Génie Industriel' }, // ancienne appellation (parcours PEI)
  a: { id: 'a', role: 'admin', promo: 2010, filiere: 'Génie Industriel' },
  v: { id: 'v', role: 'laureat', promo: 2010, filiere: 'Génie Industriel', admin_ok: true },   // l'administration en vue lauréat
};
const sp = x => ({ id: 'A', entreprise: 'Exemplia', titre: 'Allemand pour ingénieurs', texte: 'Cours du soir en petits groupes.', lien: 'https://example.com',
  public: 'tous', annees: null, filieres: null, debut: '2026-10-20', fin: '2026-11-30', actif: true, created_at: '2026-10-20T08:00:00Z', ...x });
const pour = (s, me) => sponsorisePour(s, me, NOW, SAISON);
const cartes = n => Array.from({ length: n }, (_, i) => ({ cle: `c${i}`, sorte: 'offre' }));
const sortes = d => d.map(c => (c.sorte === 'sponsorise' ? `S${c.sponsorise.id}` : '.')).join('');
const ou = d => d.flatMap((c, i) => (c.sorte === 'sponsorise' ? [i] : []));

// ---------------------------------------------------------------------------
// L'insertion
// ---------------------------------------------------------------------------
test(`insertion : une carte après chaque ${SPONSO_PAS} cartes, jamais en tête, aucune sous ${SPONSO_PAS} cartes`, () => {
  const A = [sp()];
  assert.equal(SPONSO_PAS, 10);
  assert.deepEqual(avecSponsorises(cartes(9), A), cartes(9), 'moins de 10 cartes : aucune');
  assert.deepEqual(avecSponsorises([], A), []);
  const dix = avecSponsorises(cartes(10), A);
  assert.equal(dix.length, 11); assert.deepEqual(ou(dix), [10], 'exactement 10 : la 11e carte');
  assert.deepEqual(dix[10], { cle: 's:A:1', sorte: 'sponsorise', sponsorise: A[0], creneau: 1 });
  const v5 = avecSponsorises(cartes(25), A);
  assert.equal(v5.length, 27); assert.deepEqual(ou(v5), [10, 21], 'la 11e et la 22e carte');
  assert.deepEqual(v5.filter(c => c.sorte !== 'sponsorise'), cartes(25), 'les cartes ordinaires gardent leur ordre');
  assert.equal(new Set(v5.map(c => c.cle)).size, 27, 'des clés uniques, même avec une seule entreprise');
  for (let n = 0; n <= 45; n++) {
    const d = avecSponsorises(cartes(n), A);
    assert.notEqual(d[0]?.sorte, 'sponsorise', `jamais en tête (${n} cartes)`);
    assert.equal(d.length - n, Math.floor(n / 10), `${n} cartes : ${Math.floor(n / 10)} sponsorisée(s)`);
  }
  assert.deepEqual(avecSponsorises(cartes(30), []), cartes(30), 'aucune entreprise : la pile ne change pas');
  assert.deepEqual(avecSponsorises(cartes(30), null), cartes(30));
});

test('insertion : à tour de rôle entre plusieurs entreprises, avec un décalage', () => {
  const AB = [sp(), sp({ id: 'B' })];
  assert.equal(sortes(avecSponsorises(cartes(35), AB)), `${'.'.repeat(10)}SA${'.'.repeat(10)}SB${'.'.repeat(10)}SA.....`);
  assert.equal(sortes(avecSponsorises(cartes(35), AB, { decalage: 1 })), `${'.'.repeat(10)}SB${'.'.repeat(10)}SA${'.'.repeat(10)}SB.....`);
  assert.equal(sortes(avecSponsorises(cartes(20), AB, { decalage: 7 })), `${'.'.repeat(10)}SB${'.'.repeat(10)}SA`);
});

test('insertion : pendant la visite, la carte ne recule pas quand une carte part ; passée, elle ne revient pas', () => {
  const A = [sp()];
  // Déjà 4 cartes passées, 21 restantes : la 11e carte de la visite est la 7e restante
  assert.deepEqual(ou(avecSponsorises(cartes(21), A, { passees: 4 })), [6, 17]);
  // 10 cartes passées : la carte sponsorisée est en tête (c'est la 11e de la visite)
  assert.deepEqual(ou(avecSponsorises(cartes(5), A, { passees: 10 })), [0]);
  // …passée : elle ne revient pas
  assert.deepEqual(ou(avecSponsorises(cartes(5), A, { passees: 10, sautes: [1] })), []);
  assert.deepEqual(ou(avecSponsorises(cartes(13), A, { passees: 12, sautes: [1] })), [8], 'la suivante reste après la 20e');

  // Une visite entière : chaque geste retire la carte du dessus
  const visite = (n, sponsors) => {
    let reste = cartes(n), passees = 0; const sautes = [], vu = [];
    for (;;) {
      const d = avecSponsorises(reste, sponsors, { passees, sautes });
      if (!d.length) return vu.join('');
      const top = d[0];
      if (top.sorte === 'sponsorise') { sautes.push(top.creneau); vu.push('S'); } else { reste = reste.filter(c => c.cle !== top.cle); passees++; vu.push('.'); }
    }
  };
  assert.equal(visite(25, A), `${'.'.repeat(10)}S${'.'.repeat(10)}S${'.'.repeat(5)}`);
  assert.equal(visite(9, A), '.'.repeat(9));
  assert.equal(visite(10, A), `${'.'.repeat(10)}S`);

  // « Revenir » juste après la carte sponsorisée : la 10e carte ordinaire revient, pas la sponsorisée
  const avant = avecSponsorises(cartes(16), A, { passees: 9, sautes: [1] });
  assert.equal(avant[0].cle, 'c0'); assert.deepEqual(ou(avant), [11]);
});

// ---------------------------------------------------------------------------
// Qui la carte vise
// ---------------------------------------------------------------------------
test('ciblage : le public, l’année (niveauOf), la filière (une ancienne appellation suit son parcours)', () => {
  assert.ok(['s', 't', 'j', 'l', 'o'].every(k => pour(sp(), P[k])), 'tous, toutes les années, toutes les filières');
  assert.ok(pour(sp({ annees: [], filieres: [] }), P.t), 'listes vides : tout le monde');
  assert.ok(pour(sp({ public: 'etudiants' }), P.s)); assert.ok(!pour(sp({ public: 'etudiants' }), P.l));
  assert.ok(pour(sp({ public: 'laureats' }), P.l)); assert.ok(!pour(sp({ public: 'laureats' }), P.s));
  assert.ok(pour(sp({ annees: [5] }), P.s)); assert.ok(!pour(sp({ annees: [5] }), P.t), 'un 3A n’est pas visé par une carte pour les 5A');
  assert.ok(pour(sp({ annees: [3, 4] }), P.t));
  assert.ok(pour(sp({ annees: [6] }), P.j)); assert.ok(!pour(sp({ annees: [6] }), P.l), 'jeunes diplômés : pas les lauréats plus anciens');
  assert.ok(pour(sp({ annees: [7] }), P.l)); assert.ok(pour(sp({ annees: ['5'] }), P.s), 'des années lues comme nombres');
  assert.ok(pour(sp({ filieres: [GIEO] }), P.s)); assert.ok(!pour(sp({ filieres: [GIEO] }), P.t));
  assert.ok(!pour(sp({ filieres: [GIP] }), P.s), 'deux filières actuelles : identiques, pas seulement le même parcours');
  assert.ok(pour(sp({ filieres: [GIP] }), P.o), 'l’ancienne appellation « Génie Industriel » suit le parcours PEI');
  assert.ok(pour(sp({ public: 'etudiants', annees: [5], filieres: [GIEO, GIP] }), P.s));
  assert.ok(!pour(sp({ public: 'laureats', annees: [5] }), P.s), 'toutes les règles ensemble');
});

test('ciblage : en cours seulement (active, entre ses dates incluses) ; jamais l’administration', () => {
  assert.ok(!pour(sp({ actif: false }), P.s));
  assert.ok(!pour(sp({ debut: '2026-10-28' }), P.s), 'à venir'); assert.ok(pour(sp({ debut: '2026-10-27' }), P.s), 'commence aujourd’hui');
  assert.ok(!pour(sp({ fin: '2026-10-26' }), P.s), 'finie'); assert.ok(pour(sp({ fin: '2026-10-27' }), P.s), 'finit ce soir');
  assert.ok(!pour(sp(), P.a)); assert.ok(!pour(sp(), P.v), 'l’administration qui regarde comme un lauréat');
  assert.ok(!pour(sp(), null)); assert.ok(!pour(null, P.s));
  assert.ok(sponsoEnCours(sp(), NOW));
  assert.deepEqual(['en_cours', 'programmee', 'terminee', 'arretee'], [sp(), sp({ debut: '2026-11-01' }), sp({ fin: '2026-10-01', debut: '2026-09-01' }), sp({ actif: false })].map(s => etatSponsorise(s, NOW)));
  const liste = [sp({ id: 'B', created_at: '2026-10-22T08:00:00Z' }), sp({ id: 'X', public: 'laureats' }), sp({ id: 'A' }), sp({ id: 'C', actif: false })];
  assert.deepEqual(sponsorisesPour(liste, P.s, NOW, SAISON).map(s => s.id), ['A', 'B'], 'celles qui le visent, la plus ancienne d’abord');
  assert.deepEqual(sponsorisesPour(null, P.s, NOW, SAISON), []);
});

test('le tour de rôle change chaque jour et d’un membre à l’autre ; le jour est celui de l’appareil', () => {
  const d0 = decalageSponso('s', NOW), d1 = decalageSponso('s', NOW + 864e5);
  assert.ok(Number.isInteger(d0) && d0 >= 0);
  assert.equal(decalageSponso('s', NOW + 3600e3), d0, 'stable dans la journée');
  assert.equal(d1, (d0 + 1) % 1000003, 'demain : la carte suivante en tête');
  assert.notEqual(decalageSponso('t', NOW), d0, 'deux membres le même jour : pas le même point de départ');
  assert.equal(jourLocal(NOW), '2026-10-27');
});

// ---------------------------------------------------------------------------
// Ce que l'administration écrit
// ---------------------------------------------------------------------------
test('écrire : nettoyée comme dans la base, mêmes refus que les contraintes', () => {
  const n = normaliserSponsorise({ entreprise: '  Exemplia ', titre: ' Allemand ', texte: ' Cours du soir. ', lien: ' https://example.com ', domaine: 'HTTPS://www.Example.com/accueil', annees: [5, '4', 5], filieres: [] });
  assert.deepEqual(n, { entreprise: 'Exemplia', titre: 'Allemand', texte: 'Cours du soir.', lien: 'https://example.com', domaine: 'example.com', annees: [4, 5], filieres: null });
  assert.equal(normaliserSponsorise({ domaine: '  ' }).domaine, null);
  assert.equal(normaliserSponsorise({ annees: [] }).annees, null);
  assert.ok(!('domaine' in normaliserSponsorise({ titre: 'x' })), 'un champ absent reste absent (modification partielle)');
  const ok = sp();
  assert.equal(refusSponsorise(ok), null);
  const cas = [
    [{ entreprise: 'E' }, 'Indique l’entreprise (80 caractères au plus).'],
    [{ entreprise: 'E'.repeat(81) }, 'Indique l’entreprise (80 caractères au plus).'],
    [{ titre: 'Ab' }, 'Le titre fait de 3 à 90 caractères.'],
    [{ texte: 'Trop cour' }, 'Le texte fait de 10 à 280 caractères.'],
    [{ texte: 'x'.repeat(281) }, 'Le texte fait de 10 à 280 caractères.'],
    [{ lien: 'http://example.com' }, 'Le lien doit commencer par https://'],
    [{ lien: 'javascript:alert(1)' }, 'Le lien doit commencer par https://'],
    [{ lien: 'https://localhost' }, 'Le lien doit commencer par https://'],
    [{ lien: 'https://example.com/' + 'a'.repeat(490) }, 'Le lien doit commencer par https://'],
    [{ domaine: 'pas un domaine' }, 'Le domaine du logo s’écrit sans https:// (ex. exemple.ma).'],
    [{ public: 'admins' }, 'Choisis un public.'],
    [{ annees: [8] }, 'Choisis des années de la liste.'],
    [{ debut: '' }, 'Choisis les dates de début et de fin.'],
    [{ fin: '30/11/2026' }, 'Choisis les dates de début et de fin.'],
    [{ debut: '2026-11-02', fin: '2026-11-01' }, 'La fin vient après le début.'],
  ];
  for (const [x, msg] of cas) assert.equal(refusSponsorise(sp(x)), msg, JSON.stringify(x).slice(0, 60));
  assert.equal(refusSponsorise(sp({ lien: 'https://example.com/langues?utm=reseau#cours', domaine: 'exemple.ma', debut: '2026-11-01', fin: '2026-11-01' })), null);
});

test('les totaux : vues, clics, membres différents — jamais qui', () => {
  const C = [
    { sponsorise_id: 'A', user_id: 's', jour: '2026-10-26', kind: 'vue' }, { sponsorise_id: 'A', user_id: 's', jour: '2026-10-27', kind: 'vue' },
    { sponsorise_id: 'A', user_id: 's', jour: '2026-10-27', kind: 'clic' }, { sponsorise_id: 'A', user_id: 't', jour: '2026-10-27', kind: 'vue' },
    { sponsorise_id: 'B', user_id: 'l', jour: '2026-10-27', kind: 'vue' },
  ];
  const t = totauxSponsorises([sp(), sp({ id: 'B' }), sp({ id: 'Z' })], C);
  assert.deepEqual(t, [
    { sponsorise_id: 'A', vues: 3, clics: 1, membres: 2 },
    { sponsorise_id: 'B', vues: 1, clics: 0, membres: 1 },
    { sponsorise_id: 'Z', vues: 0, clics: 0, membres: 0 },
  ]);
  assert.ok(!JSON.stringify(t).includes('"s"') && !JSON.stringify(t).includes('user_id'), 'aucun identifiant de membre');
  assert.equal(tauxClic(1, 3), '33%'); assert.equal(tauxClic(0, 0), '–'); assert.equal(tauxClic(1, 1), '100%');
});

// ---------------------------------------------------------------------------
// La démo : mêmes gardes que la base
// ---------------------------------------------------------------------------
async function demo() {
  globalThis.window ??= {};
  window.ENSAM_CONFIG = {};
  const { createStore } = await import('../../src/store.js');
  const s = await createStore();
  const qui = nom => s.personas().find(p => p._persona.includes(nom));
  return { s, qui, comme: nom => s.switchTo(qui(nom).id) };
}
const NOUVELLE = { entreprise: 'Atelier Exemple', titre: 'Préparer son départ en Allemagne', texte: 'Un accompagnement pour le visa et le logement.', lien: 'https://example.org/depart', public: 'etudiants', annees: [5], filieres: [], debut: jourLocal(), fin: jourLocal(Date.now() + 30 * 864e5) };

test('démo : une seule carte d’exemple, fictive, en cours, pour tout le monde', async () => {
  const { s, qui } = await demo();
  assert.equal(s.data.sponsorises.length, 1);
  const [ex] = s.data.sponsorises;
  assert.match(ex.entreprise, /\(fictive\)/); assert.match(ex.texte, /inventée/);
  assert.match(ex.lien, /^https:\/\/example\.com\//, 'un domaine réservé aux exemples');
  assert.equal(refusSponsorise(ex), null);
  assert.equal(ex.created_by, qui('Admin').id);
  assert.ok(sponsorisePour(ex, qui('Salma')) && sponsorisePour(ex, qui('Youssef')) && sponsorisePour(ex, qui('Amine')));
  assert.ok(!sponsorisePour(ex, qui('Admin')));
  assert.deepEqual(s.data.sponsorises_comptes || [], [], 'aucun compte au départ');
});

test('démo : seule l’administration crée, modifie, arrête et supprime ; mêmes refus que la base', async () => {
  const { s, qui, comme } = await demo();
  const id = s.data.sponsorises[0].id;
  comme('Salma');
  await assert.rejects(s.insert('sponsorises', NOUVELLE), { message: 'Action non autorisée pour ton compte.' });
  await assert.rejects(s.update('sponsorises', id, { titre: 'Piratée' }), { message: 'Action non autorisée pour ton compte.' });
  await assert.rejects(s.remove('sponsorises', id), { message: 'Action non autorisée pour ton compte.' });
  comme('Youssef');
  await assert.rejects(s.insert('sponsorises', NOUVELLE), { message: 'Action non autorisée pour ton compte.' });
  comme('Admin');
  await assert.rejects(s.insert('sponsorises', { ...NOUVELLE, lien: 'http://example.org' }), { message: 'Le lien doit commencer par https://' });
  await assert.rejects(s.insert('sponsorises', { ...NOUVELLE, fin: '2000-01-01' }), { message: 'La fin vient après le début.' });
  const r = await s.insert('sponsorises', { ...NOUVELLE, domaine: 'WWW.Example.org', created_by: qui('Salma').id });
  assert.equal(r.created_by, s.me.id, 'l’auteur est celui qui écrit'); assert.equal(r.actif, true);
  assert.equal(r.domaine, 'example.org'); assert.equal(r.filieres, null); assert.deepEqual(r.annees, [5]);
  const m = await s.update('sponsorises', r.id, { actif: false, created_by: qui('Youssef').id, titre: '  Préparer son départ  ' });
  assert.deepEqual([m.actif, m.created_by, m.created_at, m.titre], [false, r.created_by, r.created_at, 'Préparer son départ']);
  await assert.rejects(s.update('sponsorises', r.id, { annees: [9] }), { message: 'Choisis des années de la liste.' });
  assert.equal(s.data.sponsorises.length, 2);
});

test('démo : une vue et un clic par jour pour un membre visé ; rien pour les autres ; Match n’écrit aucun choix', async () => {
  const { s, comme } = await demo();
  const ex = s.data.sponsorises[0];
  comme('Admin');
  const pour5A = await s.insert('sponsorises', NOUVELLE);
  const nChoix = s.data.match_choix.length;
  comme('Salma');
  assert.equal(await s.vueSponsorise(ex.id), true);
  assert.equal(await s.vueSponsorise(ex.id), false, 'une seule vue par jour');
  assert.equal(await s.clicSponsorise(ex.id), true);
  assert.equal(await s.clicSponsorise(ex.id), false, 'un seul clic par jour');
  assert.equal(await s.vueSponsorise(pour5A.id), true, 'Salma est en 5A');
  assert.equal(await s.compterSponsorise(ex.id, 'partage'), false, 'seulement vue ou clic');
  comme('Amine');
  assert.equal(await s.vueSponsorise(pour5A.id), false, 'un 3A n’est pas visé');
  assert.equal(await s.vueSponsorise(ex.id), true);
  comme('Youssef');
  assert.equal(await s.clicSponsorise(pour5A.id), false, 'un lauréat n’est pas visé par une carte pour les étudiants');
  comme('Admin');
  assert.equal(await s.vueSponsorise(ex.id), false, 'l’administration ne compte pas');
  await s.update('sponsorises', ex.id, { actif: false });
  comme('Youssef');
  assert.equal(await s.vueSponsorise(ex.id), false, 'une carte arrêtée ne compte plus');
  assert.equal(s.data.sponsorises_comptes.length, 4);
  assert.equal(s.data.match_choix.length, nChoix, 'aucun choix Match');
});

test('démo : les totaux pour l’administration seule, sans nom ni identifiant ; supprimer une carte efface ses comptes', async () => {
  const { s, comme } = await demo();
  const ex = s.data.sponsorises[0];
  comme('Salma'); await s.vueSponsorise(ex.id); await s.clicSponsorise(ex.id);
  comme('Youssef'); await s.vueSponsorise(ex.id);
  await assert.rejects(s.bilanSponsorises(), { message: 'Réservé à l’administration.' });
  comme('Salma');
  await assert.rejects(s.bilanSponsorises(), { message: 'Réservé à l’administration.' });
  comme('Admin');
  const b = await s.bilanSponsorises();
  assert.deepEqual(b, [{ sponsorise_id: ex.id, vues: 2, clics: 1, membres: 2 }]);
  assert.deepEqual(Object.keys(b[0]).sort(), ['clics', 'membres', 'sponsorise_id', 'vues']);
  await s.remove('sponsorises', ex.id);
  assert.deepEqual(s.data.sponsorises_comptes, []);
  assert.deepEqual(await s.bilanSponsorises(), []);
});
