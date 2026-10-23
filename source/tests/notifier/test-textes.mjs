import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE, SITE } from './banc.mjs';

const N = await import(MODULE);
const logic = await import('../../src/logic.js');

const RDV = '2026-10-21T17:30:00Z';   // mercredi 21 octobre, 17:30 au Maroc (GMT depuis le 20 septembre 2026)
const DONNEES = {
  mentorat_demande: { nom: 'Salma Idrissi', sujet: 'Relire mon CV' },
  mentorat_accepte: { nom: 'Youssef Alami', sujet: 'Relire mon CV', rdv_at: RDV },
  mentorat_deplace: { nom: 'Youssef Alami', sujet: 'Relire mon CV', rdv_at: RDV },
  mentorat_annule: { sujet: 'Relire mon CV' },
  merci: { nom: 'Salma Idrissi' },
  candidature: { nom: 'Salma Idrissi', titre: 'Stage maintenance prédictive' },
  candidature_statut: { titre: 'Stage maintenance prédictive', statut: 'entretien' },
  recrutement_a_confirmer: { nom: 'Youssef Alami', entreprise: 'OCP' },
  recrutement_confirme: { nom: 'Salma Idrissi', entreprise: 'OCP' },
  invitation: { nom: 'Youssef Alami', titre: 'Stage lean manufacturing' },
  reponse: { nom: 'Nadia Benali', titre: 'Comment préparer un entretien chez Renault ?' },
  question_routee: { cible: 'Renault', titre: 'Comment préparer un entretien chez Renault ?' },
  filleul: { nom: 'Amine Tazi' },
  parrain: { nom: 'Youssef Alami' },
  cafe: { ville: 'Casablanca', lieu: 'Café Bianca, Maârif', date_at: RDV },
  rappel_rdv: { nom: 'Youssef Alami', sujet: 'Relire mon CV', rdv_at: RDV },
  relance_offre: { titre: 'Stage lean manufacturing' },
  test: {},
};
const ROUTES = {
  mentorat_demande: 'mentorat', mentorat_accepte: 'mentorat', mentorat_deplace: 'mentorat', mentorat_annule: 'mentorat', merci: 'espace',
  candidature: 'espace', candidature_statut: 'parcours', recrutement_a_confirmer: 'parcours', recrutement_confirme: 'espace', invitation: 'offres',
  reponse: 'reseau/entraide', question_routee: 'reseau/entraide', filleul: 'espace', parrain: 'accueil', cafe: 'reseau/groupes',
  rappel_rdv: 'mentorat', relance_offre: 'offres', test: 'accueil',
};

test('chaque type de notification existe en français et en arabe', () => {
  assert.equal(Object.keys(DONNEES).length, 18);
  for (const [kind, data] of Object.entries(DONNEES)) {
    for (const langue of ['fr', 'ar']) {
      const n = N.texteNotif(kind, data, langue, SITE);
      assert.ok(n, `${kind} ${langue}`);
      assert.equal(n.url, SITE + '#' + ROUTES[kind], kind);
      assert.equal(n.tag, kind);
      assert.ok(n.title.length > 3 && n.body.length > 3, kind);
      assert.doesNotMatch(n.title + n.body, /undefined|null|NaN|\$\{/, kind);
      if (langue === 'ar') assert.match(n.title + n.body, /[؀-ۿ]/, kind + ' en arabe');
    }
  }
});

test('textes français exacts', () => {
  const t = (k, d = DONNEES[k]) => N.texteNotif(k, d, 'fr', SITE);
  assert.deepEqual([t('mentorat_accepte').title, t('mentorat_accepte').body], ['Rendez-vous fixé', 'Youssef Alami a choisi un de tes horaires : Relire mon CV, mercredi 21 octobre à 17:30']);
  assert.equal(t('mentorat_deplace').body, 'Youssef Alami propose mercredi 21 octobre à 17:30 : Relire mon CV');
  assert.equal(t('mentorat_demande').body, 'Salma Idrissi te demande de l’aide : Relire mon CV');
  assert.equal(t('candidature_statut').body, 'Ta candidature « Stage maintenance prédictive » avance : entretien.');
  assert.deepEqual([t('candidature_statut', { titre: 'X', statut: 'retenu' }).title, t('candidature_statut', { titre: 'X', statut: 'retenu' }).body], ['Bonne nouvelle !', 'Ta candidature pour « X » est retenue.']);
  assert.equal(t('cafe').title, 'Café ENSAM à Casablanca');
  assert.equal(t('cafe').body, 'mercredi 21 octobre à 17:30 · Café Bianca, Maârif. Inscris-toi en un clic.');
  assert.equal(t('rappel_rdv').body, 'Avec Youssef Alami à 17:30 : Relire mon CV');
  // Un push ne porte pas de pastille : la personne d'abord, les points restent dans le site (côté lauréat)
  assert.equal(t('recrutement_confirme').body, 'Salma Idrissi a confirmé son recrutement chez OCP.');
  assert.equal(t('mentorat_demande').title, 'Des horaires à choisir');
  assert.deepEqual([t('contact_demande', { nom: 'Y' }).title, t('contact_accepte', { nom: 'Y' }).title], ['Partager tes coordonnées ?', 'Coordonnées partagées']);
  assert.equal(t('parrain').body, 'Ton parrainage cette année : Youssef Alami, de ta filière.');
  assert.equal(t('test').body, 'Tu recevras ici les nouvelles importantes du Réseau ENSAM.');
});

test('textes arabes : date à l’heure du Maroc, chiffres latins', () => {
  const n = N.texteNotif('mentorat_accepte', DONNEES.mentorat_accepte, 'ar', SITE);
  assert.equal(n.title, 'تم تحديد الموعد');
  assert.match(n.body, /الأربعاء/);
  assert.match(n.body, /21 أكتوبر/);
  assert.match(n.body, /على الساعة 17:30/);
  assert.match(n.body, /Youssef Alami/);
  // Contenu des membres isolé (FSI … PDI) dans les textes arabes
  assert.equal(N.texteNotif('rappel_rdv', DONNEES.rappel_rdv, 'ar', SITE).body, 'مع \u2068Youssef Alami\u2069 على الساعة 17:30: \u2068Relire mon CV\u2069');
  assert.doesNotMatch(N.texteNotif('rappel_rdv', DONNEES.rappel_rdv, 'fr', SITE).body, /[\u2068\u2069]/);
});

test('cas limites : type inconnu, statut ignoré, langue absente, texte long, nom manquant', () => {
  assert.equal(N.texteNotif('inconnu', {}, 'fr', SITE), null);
  assert.equal(N.texteNotif('__proto__', {}, 'fr', SITE), null);
  assert.equal(N.texteNotif('constructor', {}, 'fr', SITE), null);
  assert.equal(N.texteNotif('candidature_statut', { titre: 'X', statut: 'refuse' }, 'fr', SITE), null);
  assert.equal(N.texteNotif('test', null, undefined, SITE).title, 'Notifications activées');
  const long = N.texteNotif('mentorat_demande', { nom: 'A', sujet: 'x'.repeat(400) }, 'fr', SITE);
  assert.equal(Array.from(long.body).length, 180);
  assert.ok(long.body.endsWith('…'));
  assert.equal(N.texteNotif('merci', {}, 'fr', SITE).body, 'Un membre te remercie pour ton aide.');
  assert.equal(N.texteNotif('mentorat_accepte', { nom: 'Y', sujet: 'S', rdv_at: 'pas une date' }, 'fr', SITE).body, 'Y a choisi un de tes horaires : S');
  // Contenu des membres inséré tel quel (pas d'échappement HTML dans une notification)
  assert.equal(N.texteNotif('reponse', { nom: 'A & B', titre: '<b>?</b>' }, 'fr', SITE).body, 'A & B a répondu à ta question : <b>?</b>');
});

test('rendez-vous annulé : qui annule est nommé ; l’étudiant peut proposer d’autres horaires (lien direct)', () => {
  const M = '0b6c1f9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
  const e = N.texteNotif('mentorat_annule', { sujet: 'Relire mon CV', m: M, nom: 'Youssef Alami', pour: 'demandeur' }, 'fr', SITE);
  assert.deepEqual([e.title, e.body], ['Rendez-vous annulé : Relire mon CV', 'Youssef Alami a annulé. Tu peux lui proposer d’autres horaires.']);
  assert.equal(e.url, SITE + '#mentorat/reprendre/' + M);
  assert.equal(e.tag, 'mentorat_annule-' + M);
  const l = N.texteNotif('mentorat_annule', { sujet: 'Relire mon CV', m: M, nom: 'Salma Idrissi', pour: 'mentor' }, 'fr', SITE);
  assert.deepEqual([l.body, l.url], ['Salma Idrissi a annulé le rendez-vous.', SITE + '#mentorat']);
  const a = N.texteNotif('mentorat_annule', { sujet: 'Relire mon CV', m: M, nom: 'Youssef Alami', pour: 'demandeur' }, 'ar', SITE);
  assert.equal(a.body, 'أُلغي الموعد من طرف \u2068Youssef Alami\u2069. يمكنك اقتراح توقيتات أخرى.');
  // Ancien payload (sans nom ni pour) : l'ancien texte, la route et le tag d'avant
  const v = N.texteNotif('mentorat_annule', { sujet: 'Relire mon CV' }, 'fr', SITE);
  assert.deepEqual([v.title, v.body, v.url, v.tag], ['Rendez-vous annulé', 'Relire mon CV', SITE + '#mentorat', 'mentorat_annule']);
  // Une valeur inconnue de « pour » est ignorée
  assert.equal(N.texteNotif('mentorat_annule', { sujet: 'S', m: M, nom: 'X', pour: 'admin' }, 'fr', SITE).url, SITE + '#mentorat');
});

test('demande rouverte : l’auteur garde une porte ouverte, le lauréat est remercié', () => {
  const D = '1b6c1f9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
  const au = N.texteNotif('demande_rouverte', { nom: 'Youssef', titre: 'Stage chez OCP', demande: D, pour: 'auteur' }, 'fr', SITE);
  assert.deepEqual([au.title, au.body], ['Ta demande est de nouveau ouverte', 'Youssef a retiré sa proposition. D’autres lauréats peuvent t’aider : Stage chez OCP']);
  assert.equal(au.url, SITE + '#offres/demandes/' + D);
  const ai = N.texteNotif('demande_rouverte', { nom: 'Salma', titre: 'Stage chez OCP', demande: D, pour: 'aidant' }, 'fr', SITE);
  assert.deepEqual([ai.title, ai.body], ['Merci d’avoir proposé ton aide', 'Salma a choisi une autre voie : Stage chez OCP']);
  assert.equal(N.texteNotif('demande_rouverte', { nom: 'Salma', titre: 'T', demande: D, pour: 'aidant' }, 'ar', SITE).title, 'شكرًا على اقتراح مساعدتك');
  assert.equal(N.texteNotif('demande_rouverte', { nom: 'Salma', titre: 'T', demande: D }, 'fr', SITE).title, 'Changement sur une demande');
});

test('points d’un recrutement : même barème que pointsRecrutement de logic.js', () => {
  for (const p of [{}, { pays: 'Maroc' }, { pays: 'France' }, { type: 'etranger' }, { type: 'stage', pays: null }]) assert.equal(N.pointsRecrutement(p), logic.pointsRecrutement(p), JSON.stringify(p));
});

test('urgence haute pour les rendez-vous seulement', () => {
  assert.equal(N.urgence('rappel_rdv'), 'high');
  assert.equal(N.urgence('mentorat_accepte'), 'high');
  for (const k of ['mentorat_demande', 'merci', 'cafe', 'test']) assert.equal(N.urgence(k), 'normal');
});

test('saison à l’heure de Casablanca (septembre → août)', () => {
  assert.equal(N.saisonDe(new Date('2026-08-31T22:30:00Z')), 2025);  // 31 août 23:30 à Casablanca
  assert.equal(N.saisonDe(new Date('2026-08-31T23:30:00Z')), 2026);  // 1er septembre 00:30
  assert.equal(N.saisonDe(new Date('2026-10-20T09:00:00Z')), 2026);
  assert.equal(N.saisonDe(new Date('2027-02-01T09:00:00Z')), 2026);
});

test('heure du Maroc : UTC+1 jusqu’au 20 septembre 2026, puis GMT pour de bon', () => {
  assert.equal(N.quand('2026-09-01T17:30:00Z', 'fr').heure, '18:30');
  assert.equal(N.quand('2026-09-20T00:30:00Z', 'fr').heure, '01:30');
  assert.equal(N.quand('2026-09-20T02:00:00Z', 'fr').heure, '02:00');
  assert.equal(N.quand('2027-07-01T17:30:00Z', 'fr').heure, '17:30');
  assert.equal(N.quand('2026-10-21T23:30:00Z', 'fr').date, 'mercredi 21 octobre');
});

test('niveau : même règle que niveauOf de logic.js', () => {
  for (let saison = 2023; saison <= 2030; saison++) {
    for (let promo = 2018; promo <= 2036; promo++) {
      assert.equal(N.niveauDe(promo, saison), logic.niveauOf({ promo }, saison), `promo ${promo} saison ${saison}`);
    }
  }
});

test('nom d’entreprise comparable, comme cle_entreprise / meme_entreprise en SQL', () => {
  const cas = {
    'Renault Group Maroc': 'renault', 'OCP SA': 'ocp', 'OCP Group': 'ocp', 'Capgemini Engineering (ex-Altran)': 'capgemini engineering',
    'Société Générale': 'societe generale', 'LEONI Wiring Systems': 'leoni wiring systems', 'STMicroelectronics S.A.S.': 'stmicroelectronics s a s',
    'The Coca-Cola Company': 'coca cola company', 'Groupe  Managem': 'managem', '': null, '  (Maroc) SA ': null, 'Électricité de France': 'electricite france',
  };
  for (const [e, k] of Object.entries(cas)) assert.equal(N.cleEntreprise(e), k, e);
  assert.equal(N.cleEntreprise(null), null);
  assert.equal(N.memeEntreprise('Renault', 'Renault Group Maroc'), true);
  assert.equal(N.memeEntreprise('Renault Trucks', 'Renault'), true);
  assert.equal(N.memeEntreprise('OCP Group', 'OCP S.A.'), true);
  assert.equal(N.memeEntreprise('Renaultx', 'Renault'), false);
  assert.equal(N.memeEntreprise('Maroc', 'Maroc'), false);   // clé vide des deux côtés
  assert.equal(N.memeEntreprise('Stellantis', 'Renault'), false);
});

test('adresse du site normalisée', () => {
  assert.equal(N.normaliserSite(''), 'https://reseau-ensam-meknes.github.io/');
  assert.equal(N.normaliserSite('https://exemple.ma/reseau'), 'https://exemple.ma/reseau/');
  assert.equal(N.normaliserSite('exemple.ma'), 'https://exemple.ma/');
  assert.equal(N.normaliserSite('https://exemple.ma/index.html#accueil'), 'https://exemple.ma/index.html');
});
