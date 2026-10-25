// Accueil qui guide : la carte du haut, « Cette semaine », « Ils ont besoin de toi », « Besoin d'un coup de main ? », publier
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demandesPour, rdvALaUne, profilLaureatFait, joursAvant, annoncePour, pourPublic, petitesTaches, besoinsDeMoi, coupDeMain, etatAide, AIDE_OUVERTE,
  manquesOffre, manquesDemande, enqueteDue, seasonOf, lignePouls, lignePresence, presenceReseau, tachePhoto, logoEntreprise, monogramme } from '../../src/logic.js';

const NOW = new Date(2026, 9, 23, 10, 0);   // vendredi 23 octobre 2026, 10 h (heure de l'appareil)
const at = (j, h = 18, mn = 30) => new Date(2026, 9, 23 + j, h, mn).toISOString();
const base = x => ({ profiles: [], mentorships: [], relectures_cv: [], demandes: [], propositions: [], questions: [], answers: [], blocages: [], placements: [], ...x });

test('joursAvant : jours de calendrier, pas des tranches de 24 h', () => {
  assert.equal(joursAvant(at(0, 23, 59), NOW), 0);
  assert.equal(joursAvant(at(1, 0, 5), NOW), 1, 'demain à 0 h 05 : demain, même à moins de 24 h');
  assert.equal(joursAvant(at(2, 9), NOW), 2);
});

test('rdvALaUne : un rendez-vous ne prend la carte que la veille ou le jour même, confirmation comprise', () => {
  const m = x => ({ id: 'm', student_id: 's', mentor_id: 'l', status: 'acceptee', rdv_at: at(3), ...x });
  assert.equal(rdvALaUne(m(), 's', NOW), null, 'dans trois jours : pas encore');
  assert.equal(rdvALaUne(m({ rdv_at: at(1) }), 's', NOW), 'proche', 'demain : la veille');
  assert.equal(rdvALaUne(m({ rdv_at: at(0) }), 'l', NOW), 'proche', 'aujourd’hui, pour le lauréat aussi');
  assert.equal(rdvALaUne(m({ rdv_at: new Date(NOW.getTime() + 10 * 6e4).toISOString() }), 's', NOW), 'direct', 'dans 10 minutes : on rejoint');
  assert.equal(rdvALaUne(m({ confirme_at: null }), 's', NOW), null, 'à confirmer mais dans trois jours : « Cette semaine », pas la carte');
  assert.equal(rdvALaUne(m({ rdv_at: at(1), confirme_at: null }), 's', NOW), 'confirmer', 'la veille : l’étudiant confirme sur la carte');
  assert.equal(rdvALaUne(m({ confirme_at: null }), 'l', NOW), null, 'le lauréat n’a rien à confirmer');
  assert.equal(rdvALaUne(m({ rdv_at: at(1) }), 'x', NOW), null, 'pas le sien');
  assert.equal(rdvALaUne(m({ status: 'terminee', rdv_at: at(0) }), 's', NOW), null, 'terminé');
  assert.equal(rdvALaUne(m({ rdv_at: at(-1) }), 's', NOW), null, 'passé');
});

test('profilLaureatFait : le jeune lauréat sans emploi n’est plus bloqué', () => {
  assert.equal(profilLaureatFait({ role: 'laureat' }), false);
  assert.equal(profilLaureatFait({ entreprise: 'OCP' }), true);
  assert.equal(profilLaureatFait({ poste: 'Ingénieur méthodes' }), true);
  assert.equal(profilLaureatFait({ en_recherche: true }), false, 'en recherche, il dit encore quand il est disponible');
  assert.equal(profilLaureatFait({ en_recherche: true, disponibilite: 'Dès maintenant' }), true);
});

test('annonces : chacun ne voit que la sienne, 14 jours au plus, la plus récente', () => {
  const a = (id, pub, j) => ({ id, public: pub, active: true, created_at: new Date(NOW.getTime() - j * 864e5).toISOString() });
  const list = [a('t', 'tous', 5), a('e', 'etudiants', 2), a('l', 'laureats', 1), a('vieux', 'tous', 20), { ...a('off', 'tous', 0), active: false }];
  assert.equal(annoncePour(list, { role: 'etudiant' }, NOW.getTime()).id, 'e');
  assert.equal(annoncePour(list, { role: 'laureat' }, NOW.getTime()).id, 'l');
  assert.equal(annoncePour(list, { role: 'admin' }, NOW.getTime()).id, 'l', 'l’administration voit tout');
  assert.equal(annoncePour([a('vieux', 'tous', 20)], { role: 'etudiant' }, NOW.getTime()), null);
  assert.equal(pourPublic(undefined, 'etudiant'), true, 'une annonce d’avant le public : tout le monde');
  assert.equal(pourPublic('laureats', 'etudiant'), false);
});

test('petitesTaches : trois au plus, jamais ce que montre la carte, ni les aides ni les rappels de rendez-vous', () => {
  const n = (key, x = {}) => ({ key, action: true, at: NOW.toISOString(), ...x });
  const notifs = [n('apO1-3', { ref: 'o1' }), n('mdM1', { besoin: true }), n('srM3', { rdv: true, rappel: true }), n('mfP1'), n('roO2'), n('dmC1'), n('eq6'), n('dcX'), n('paY'), n('zzz'), { key: 'sfA', at: NOW.toISOString() }, n('scM2', { ref: 'm2' })];
  const t = petitesTaches(notifs);
  assert.deepEqual(t.map(x => x.key), ['apO1-3', 'dmC1', 'scM2'], 'les candidatures, les matchs, puis une présence à confirmer ; trois au plus');
  assert.ok(!t.some(x => ['md', 'sr', 'dc', 'pa', 'zz', 'sf'].includes(x.key.slice(0, 2))));
  const sans = petitesTaches(notifs, { key: 'dmC1', ref: 'o1' });
  assert.deepEqual(sans.map(x => x.key), ['scM2', 'mfP1', 'roO2'], 'la carte du haut et son offre ne reviennent pas dessous');
  assert.deepEqual(petitesTaches(notifs, { key: 'rdvm2', ref: 'm2', cles: ['scM2'] }).map(x => x.key), ['apO1-3', 'dmC1', 'mfP1'], 'la veille, la carte montre le rendez-vous : sa confirmation n’est pas répétée');
  assert.deepEqual(petitesTaches(notifs, { cles: ['mfP1', 'roO2', 'scM2'] }).map(x => x.key), ['apO1-3', 'dmC1', 'eq6']);
});

test('tâche photo : un lauréat sans photo, quand la base accepte les photos ; en dernier, après les vraies tâches', () => {
  const l = { id: 'l', role: 'laureat', created_at: at(-30) };
  const t = tachePhoto(l);
  assert.equal(t.text, 'Ajoute une photo, les étudiants écrivent plus facilement à un visage.');
  assert.equal(t.to, 'profil');
  assert.ok(t.action && t.semaine && !t.geste, 'dans « Cette semaine » seulement : rien ne s’ajoute au chiffre de la cloche');
  assert.equal(tachePhoto({ ...l, photo_path: 'l/photo.jpg' }), null, 'déjà une photo');
  assert.equal(tachePhoto({ id: 's', role: 'etudiant', created_at: at(-3) }), null, 'pas pour un étudiant');
  assert.equal(tachePhoto({ id: 'a', role: 'admin' }), null);
  assert.equal(tachePhoto(l, { live: true }), null, 'en ligne, sans colonne photo : la base n’accepte pas encore les photos');
  assert.ok(tachePhoto({ ...l, photo_path: null }, { live: true }), 'en ligne, colonne présente et vide');
  const n = (key, x = {}) => ({ key, action: true, at: NOW.toISOString(), ...x });
  assert.deepEqual(petitesTaches([t, n('eq6'), n('roO2')]).map(x => x.key), ['roO2', 'eq6', 'ph'], 'la photo vient après toutes les vraies tâches');
  assert.deepEqual(petitesTaches([t, n('apO1'), n('dmC1'), n('scM2')]).map(x => x.key), ['apO1', 'dmC1', 'scM2'], 'trois vraies tâches : pas de place pour la photo');
});

test('logos d’entreprises : le vrai logo pour un nom et ses variantes, sinon un monogramme soigné', () => {
  assert.equal(logoEntreprise('Renault Group Maroc'), 'img/logos/renault.png');
  assert.equal(logoEntreprise('Groupe Renault'), 'img/logos/renault.png');
  assert.equal(logoEntreprise('Safran Nacelles'), 'img/logos/safran.png');
  assert.equal(logoEntreprise('Airbus Operations'), 'img/logos/airbus.png');
  assert.equal(logoEntreprise('Capgemini Engineering'), 'img/logos/capgemini.png');
  assert.equal(logoEntreprise('Hydro-Québec'), 'img/logos/hydro-quebec.png');
  assert.equal(logoEntreprise('  schneider electric (Bouskoura) '), 'img/logos/schneider-electric.png');
  assert.equal(logoEntreprise('Siemens Gamesa'), null, 'une filiale qui a son propre logo ne prend pas celui du groupe');
  assert.equal(logoEntreprise('Orangina'), null, 'mot pour mot');
  assert.equal(logoEntreprise('OCP Group'), null);
  assert.equal(logoEntreprise(''), null);
  assert.equal(monogramme('OCP Group'), 'OCP', 'un sigle reste entier');
  assert.equal(monogramme('Groupe OCP'), 'OCP');
  assert.equal(monogramme('ONEE'), 'ONEE');
  assert.equal(monogramme('TGCC'), 'TGCC');
  assert.equal(monogramme('Stellantis Kénitra'), 'S', 'la ville ne compte pas');
  assert.equal(monogramme('Yazaki Morocco'), 'Y');
  assert.equal(monogramme('Lear Corporation'), 'L');
  assert.equal(monogramme('LafargeHolcim Maroc'), 'LH');
  assert.equal(monogramme('Spirit AeroSystems'), 'SA');
  assert.equal(monogramme('Siemens Gamesa'), 'SG');
  assert.equal(monogramme('Vinci Construction'), 'VC');
  assert.equal(monogramme('Maroc Telecom'), 'MT', 'un mot vide en tête du nom compte');
  assert.equal(monogramme('Tanger Med'), 'TM');
  assert.equal(monogramme('ENSAM Meknès'), 'E');
  assert.equal(monogramme('Jorf Lasfar Energy'), 'JE');
});

const S = seasonOf(NOW);
const lau = { id: 'l', role: 'laureat', filiere: 'Génie Mécanique', promo: 2016, entreprise: 'Renault' };
const etu = (id, filiere = 'Génie Mécanique', promo = S + 1) => ({ id, role: 'etudiant', filiere, promo });

test('besoinsDeMoi : ceux qui l’ont choisi d’abord, puis une sorte après l’autre', () => {
  const profiles = [lau, etu('s1'), etu('s2'), etu('s3'), etu('s4'), etu('s5', 'Génie Civil')];
  const byId = id => profiles.find(p => p.id === id);
  const d = base({
    profiles,
    mentorships: [{ id: 'm1', student_id: 's1', mentor_id: 'l', status: 'demande', sujet: 'Entretien', created_at: at(-2) }],
    relectures_cv: [{ id: 'r1', student_id: 's2', status: 'demandee', reviewer_id: null, created_at: at(-3) }, { id: 'r2', student_id: 's3', status: 'demandee', reviewer_id: 'l', created_at: at(-1) }],
    demandes: [{ id: 'd1', auteur_id: 's4', status: 'ouverte', type: 'pfe', titre: 'PFE énergie', created_at: at(-1) }, { id: 'd2', auteur_id: 's5', status: 'ouverte', type: 'stage', titre: 'Hors de mon parcours', created_at: at(-1) }],
    questions: [{ id: 'q1', author_id: 's2', entreprise: 'Renault', titre: 'Comment ça se passe ?', created_at: at(-1) }],
  });
  const b = besoinsDeMoi(d, lau, byId, { now: NOW.getTime() });
  assert.deepEqual(b.slice(0, 2).map(x => x.id), ['m1', 'r2'], 'les demandes qui le nomment, la plus ancienne d’abord');
  assert.deepEqual(b.slice(2).map(x => x.kind), ['question', 'demande', 'cv'], 'puis une question, une demande, un CV');
  assert.ok(!b.some(x => x.id === 'd2'), 'une demande hors de son parcours ne lui est pas montrée ici');
  assert.deepEqual(besoinsDeMoi(d, lau, byId, { now: NOW.getTime(), exclure: new Set(['m1', 'q1']) }).map(x => x.id), ['r2', 'd1', 'r1'], 'ce que la carte montre déjà n’est pas répété');
  assert.deepEqual(besoinsDeMoi(d, etu('s1'), byId, { now: NOW.getTime() }), [], 'un étudiant n’a pas ce bloc');
  // Déjà répondu à la question : elle ne revient pas
  const rep = besoinsDeMoi({ ...d, answers: [{ question_id: 'q1', author_id: 'l' }] }, lau, byId, { now: NOW.getTime() });
  assert.ok(!rep.some(x => x.id === 'q1'));
});

test('demandes hors de son parcours : ouvertes à tous les lauréats 24 h après, tout de suite sans filière', () => {
  const profiles = [lau, etu('s5', 'Génie Civil'), etu('s6', 'Génie Civil'), etu('s7', null)];
  const byId = id => profiles.find(p => p.id === id);
  const d = base({ profiles, demandes: [
    { id: 'jeune', auteur_id: 's5', status: 'ouverte', type: 'stage', titre: 'Publiée hier soir', created_at: at(-1) },
    { id: 'vieille', auteur_id: 's6', status: 'ouverte', type: 'stage', titre: 'Publiée avant-hier', created_at: at(-2) },
    { id: 'sans', auteur_id: 's7', status: 'ouverte', type: 'pfe', titre: 'Sans filière', created_at: at(0, 9) },
  ] });
  const ids = besoinsDeMoi(d, lau, byId, { now: NOW.getTime() }).map(x => x.id);
  assert.deepEqual(ids.sort(), ['sans', 'vieille'], 'pas celle de moins de 24 h d’un autre parcours');
  const v = demandesPour(d, lau, byId, NOW.getTime()).find(x => x.d.id === 'vieille');
  assert.equal(v.large, true); assert.equal(v.pourMoi, true); assert.ok(v.why.includes('Ouverte à tous les lauréats'));
  assert.equal(demandesPour(d, lau, byId, NOW.getTime()).find(x => x.d.id === 'jeune').pourMoi, false);
});

test('coupDeMain : une porte en bouton, deux au plus en liens, et ce qui est en route', () => {
  const me = { ...etu('s'), cv_path: 's/cv.pdf' };
  const vide = coupDeMain(base(), me, S);
  assert.equal(vide.principal, 'demande');
  assert.deepEqual(vide.autres, ['conseil', 'cv']);
  assert.equal(vide.suivi, null);
  // La carte du haut propose déjà la demande : la porte suivante prend la place
  assert.equal(coupDeMain(base(), me, S, { cle: 'demande' }).principal, 'conseil');
  // Une demande active : plus de porte « demande », la ligne de suivi la montre
  const d = base({ demandes: [{ id: 'd1', auteur_id: 's', status: 'ouverte', created_at: at(-1) }], mentorships: [{ id: 'm1', student_id: 's', status: 'demande' }] });
  const c = coupDeMain(d, me, S);
  assert.equal(c.principal, 'cv');
  assert.deepEqual(c.suivi, { kind: 'demande', id: 'd1' });
  assert.deepEqual(coupDeMain(d, me, S, { exclure: new Set(['d1']) }).suivi, { kind: 'conseil', id: 'm1' }, 'pas deux fois la même chose');
  // Sans CV : pas de porte « relire mon CV »
  assert.ok(!coupDeMain(base(), { ...me, cv_path: null }, S).autres.includes('cv'));
  assert.equal(coupDeMain(base(), lau, S).principal, null, 'pas pour un lauréat');
});

test('etatAide : la feuille « Je peux aider » ne s’ouvre que si l’aide est possible', () => {
  const d = { id: 'd1', auteur_id: 's', status: 'ouverte', created_at: at(-2) };
  const st = (x = {}, dd = d, me = lau) => etatAide(base(x), me, dd, NOW.getTime());
  assert.equal(st(), 'proposer');
  assert.ok(AIDE_OUVERTE.includes(st()));
  assert.equal(st({ propositions: [{ demande_id: 'd1', laureat_id: 'l', status: 'envoyee' }] }), 'modifier');
  assert.equal(st({ propositions: [{ demande_id: 'd1', laureat_id: 'l', status: 'retiree' }] }), 'reproposer');
  assert.equal(st({ propositions: [{ demande_id: 'd1', laureat_id: 'l', status: 'refusee' }] }), 'non');
  assert.equal(st({ propositions: [{ demande_id: 'd1', laureat_id: 'l', status: 'acceptee' }] }, { ...d, status: 'match' }), 'non');
  assert.equal(st({}, { ...d, status: 'match' }), 'fermee');
  assert.equal(st({}, null), 'fermee', 'demande supprimée');
  assert.equal(st({}, { ...d, created_at: at(-90) }), 'pause');
  assert.equal(st({ blocages: [{ user_id: 's', bloque_id: 'l' }] }), 'non');
  assert.equal(st({}, d, etu('x')), 'non', 'un étudiant ne propose pas d’aide');
  assert.equal(st({}, { ...d, auteur_id: 'l' }), 'non');
});

test('publier : seuls les champs obligatoires vides sont signalés, dans l’ordre de l’écran', () => {
  assert.deepEqual(manquesOffre({ titre: 'PFE', entreprise: '', description: '  ', annees: [] }), ['titre', 'entreprise', 'description', 'annees']);
  assert.deepEqual(manquesOffre({ titre: 'PFE énergie', entreprise: 'OCP', description: 'Missions', annees: [5] }), []);
  assert.deepEqual(manquesOffre({ titre: 'Poste méthodes', entreprise: 'OCP', description: 'x', audience: 'laureats', annees: [] }), [], 'entre lauréats : pas d’année');
  assert.deepEqual(manquesDemande({ titre: 'PFE', details: 'court' }, {}), ['titre', 'details', 'cv']);
  assert.deepEqual(manquesDemande({ titre: 'PFE énergie', details: 'Je cherche un PFE en énergétique.' }, { cv_path: 'a.pdf' }), []);
});

test('enqueteDue donne aussi le début de la vague (pour « Cette semaine »)', () => {
  const e = enqueteDue({ id: 'u', role: 'laureat', promo: 2025 }, [], new Date(2026, 9, 23));
  assert.equal(e.vague, 12);
  assert.equal(e.debut.getTime(), new Date(2026, 6, 1).getTime());
});

test('cette semaine dans le réseau : les phrases', () => {
  assert.equal(lignePouls({ nbAidants: 4, nbAides: 7 }), '4 lauréats ont aidé 7 étudiants');
  assert.equal(lignePouls({ nbAidants: 1, nbAides: 1 }), '1 lauréat a aidé 1 étudiant');
  assert.equal(lignePresence({ total: 39, proches: 5, cle: 'filiere' }), '39 lauréats sont déjà là, dont 5 de ta filière');
  assert.equal(lignePresence({ total: 5, proches: 5, cle: 'promo' }), '5 lauréats de ta promo sont déjà là');
  assert.equal(lignePresence({ total: 1, proches: 0, cle: null }), '1 lauréat est déjà là');
  const profiles = [{ id: 'me', role: 'laureat', promo: 2016 }, { id: 'a', role: 'laureat', promo: 2016 }, { id: 'b', role: 'laureat', promo: 2018 }, { id: 'c', role: 'etudiant' }];
  const p = presenceReseau({ profiles }, profiles[0]);
  assert.deepEqual([p.total, p.proches, p.cle, p.visages], [3, 1, 'promo', ['a']], 'le même total pour tous ; « de ta promo » et les visages sans moi');
  assert.equal(presenceReseau({ profiles }, profiles[3]).total, 3, 'un étudiant voit le même total');
  assert.equal(presenceReseau({ profiles: [profiles[0]] }, profiles[0]), null, 'personne d’autre : rien à dire');
});

test('accueil après l’inscription : le rang d’arrivée d’un lauréat (rien à voir avec les membres fondateurs)', async () => {
  const { rangLaureat, fondateursOf } = await import('../../src/logic.js');
  const jour = i => new Date(Date.UTC(2026, 9, 1) + i * 36e5).toISOString();
  const lau = Array.from({ length: 39 }, (_, i) => ({ id: 'l' + String(i).padStart(2, '0'), role: 'laureat', promo: 2010 + (i % 10), created_at: jour(i) }));
  const moi = { id: 'moi', role: 'laureat', promo: 2019, created_at: jour(100) };
  const profiles = [{ id: 'adm', role: 'admin', created_at: jour(-5) }, { id: 'etu', role: 'etudiant', created_at: jour(-4) }, ...lau, moi];
  assert.equal(rangLaureat(profiles, moi), 40);
  assert.equal(rangLaureat(profiles, lau[0]), 1);
  assert.equal(rangLaureat([{ id: 'b', role: 'laureat', created_at: jour(1) }, { id: 'a', role: 'laureat', created_at: jour(1) }], { id: 'b', role: 'laureat', created_at: jour(1) }), 2, 'même date : ordre des ids');
  assert.equal(rangLaureat(profiles, { ...moi, created_at: null }), null);
  assert.equal(rangLaureat(profiles, { id: 'etu', role: 'etudiant', created_at: jour(-4) }), null);
  assert.equal(fondateursOf({ profiles }).size, 0, 'arriver tôt ne fait pas un membre fondateur : aider les étudiants, si');
});

test('accueil après l’inscription : une phrase vraie par cas', async () => {
  const { accueilArrivee, phrasesArrivee, presenceReseau } = await import('../../src/logic.js');
  const jour = i => new Date(Date.UTC(2026, 9, 1) + i * 36e5).toISOString();
  const L = (id, promo, extra = {}) => ({ id, role: 'laureat', promo, filiere: 'Génie Mécanique', created_at: jour(+id.slice(1)), ...extra });
  const promo19 = [L('l1', 2019), L('l2', 2019), L('l3', 2019)];
  const autres = Array.from({ length: 36 }, (_, i) => L('l' + (10 + i), 2012, { photo_path: i === 30 ? 'p.jpg' : null }));
  const moi = L('l99', 2019);
  const d = { profiles: [...promo19, ...autres, moi] };
  const a = accueilArrivee(d, moi);
  assert.deepEqual(phrasesArrivee(a), { titre: 'Te voilà 40e parmi les lauréats du réseau', sous: '3 lauréats de ta promo sont déjà là' });
  assert.equal('fondateur' in a, false, 'l’arrivée ne promet plus le badge « Membre fondateur »');
  assert.ok(a.visages.length <= 5 && !a.visages.includes('l99'));
  const seul = L('l1', 2019);
  const a1 = accueilArrivee({ profiles: [seul] }, seul);
  assert.equal(phrasesArrivee(a1).titre, 'Le réseau des lauréats commence avec toi');
  const deux = [L('l1', 2019), L('l2', 2019)];
  assert.deepEqual(phrasesArrivee(accueilArrivee({ profiles: deux }, deux[1])), { titre: 'Te voilà 2e parmi les lauréats du réseau', sous: '1 lauréat de ta promo est déjà là' });
  // Étudiants : la filière, sinon le parcours, sinon tout le réseau ; personne : un simple bienvenue
  const F = 'Génie Mécanique : Énergétique', F2 = 'Génie Mécanique : Ingénierie Mécanique et Structures';
  const etu = { id: 'e1', role: 'etudiant', promo: 2029, filiere: F };
  const lauF = [L('l1', 2015, { filiere: F }), L('l2', 2016, { filiere: F }), L('l3', 2017, { filiere: 'Génie Civil' })];
  assert.equal(phrasesArrivee(accueilArrivee({ profiles: [...lauF, etu] }, etu)).titre, '2 lauréats de ta filière sont déjà là');
  assert.equal(phrasesArrivee(accueilArrivee({ profiles: [L('l1', 2015, { filiere: F }), etu] }, etu)).titre, '1 lauréat de ta filière est déjà là');
  assert.equal(phrasesArrivee(accueilArrivee({ profiles: [L('l1', 2015, { filiere: F2 }), etu] }, etu)).titre, '1 lauréat de ton parcours est déjà là');
  const prepa = { id: 'e2', role: 'etudiant', promo: 2031, filiere: 'Classes préparatoires intégrées' };
  assert.equal(phrasesArrivee(accueilArrivee({ profiles: [...lauF.slice(0, 2), prepa] }, prepa)).titre, '2 lauréats sont déjà là');
  assert.deepEqual(phrasesArrivee(accueilArrivee({ profiles: [etu] }, etu)), { titre: 'Bienvenue dans le réseau !', sous: null });
  assert.equal(accueilArrivee({ profiles: [] }, { id: 'a', role: 'admin' }), null);
  assert.equal(presenceReseau(d, moi).visages.length, 3, 'l’accueil garde ses trois visages');
});
