// Notifications sur le téléphone, par catégorie : chaque type envoyé a sa catégorie, défauts selon le rôle.
// (La parité avec la base, push_categorie / push_defaut / push_voulu, est vérifiée dans sql/test-notif-push.mjs.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PUSH_KINDS, PUSH_CATEGORIES, pushCategorie, pushDefaut, pushChoix, pushVoulu } from '../../src/logic.js';
// Les noms du panneau « Santé des notifications » ont quitté logic.js pour sante-notifs.js (main, 1f2ad27)
import { NOMS_NOTIF } from '../../src/sante-notifs.js';

const SCHEMA = fs.readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8');
const NOTIFIER = fs.readFileSync(new URL('../../supabase/functions/notifier/index.ts', import.meta.url), 'utf8');

// Types que la base met en file : pousser(…, 'type'), insertions groupées (select x.id, 'type'), agenda (v_kind)
function typesDeLaBase() {
  const t = new Set();
  for (const [, k] of SCHEMA.matchAll(/pousser\([^,;]+,\s*'([a-z_]+)'/g)) t.add(k);
  for (const [, k] of SCHEMA.matchAll(/insert into public\.push_queue \(user_id, kind, data\)\s*select \w+\.id, '([a-z_]+)'/g)) t.add(k);
  for (const [, ligne] of SCHEMA.matchAll(/v_kind := (case[^;]+);/g)) for (const [, k] of ligne.matchAll(/'([a-z_]+)'/g)) t.add(k);
  return t;
}
// Types que le notifier sait écrire ('test' part directement, sans passer par la file)
function typesDuNotifier() {
  const bloc = NOTIFIER.slice(NOTIFIER.indexOf('const NOTIFS'), NOTIFIER.indexOf('\n};', NOTIFIER.indexOf('const NOTIFS')));
  return new Set([...bloc.matchAll(/^ {2}([a-z_]+): \{/gm)].map(m => m[1]).filter(k => k !== 'test'));
}

test('chaque type de notification de la base et du notifier a sa catégorie, et aucune catégorie n’est inventée', () => {
  const base = typesDeLaBase(), notifier = typesDuNotifier();
  assert.ok(base.size >= 30 && notifier.size >= 30, `types lus : ${base.size} dans la base, ${notifier.size} dans le notifier`);
  for (const k of base) assert.ok(k in PUSH_KINDS, `type de la base sans catégorie : ${k}`);
  for (const k of notifier) assert.ok(k in PUSH_KINDS, `type du notifier sans catégorie : ${k}`);
  for (const k of Object.keys(PUSH_KINDS)) assert.ok(notifier.has(k), `type classé mais inconnu du notifier : ${k}`);
  for (const c of Object.values(PUSH_KINDS)) assert.ok(PUSH_CATEGORIES.includes(c) || c === 'admin', c);
  for (const c of PUSH_CATEGORIES) assert.ok(Object.values(PUSH_KINDS).includes(c), `catégorie vide : ${c}`);
  for (const k of ['evenement', 'evenement_annule', 'evenement_deplace', 'question_routee', 'offre_alerte', 'demande_nouvelle', 'verifier_pair', 'cafe', 'signalement',
    'demande_large', 'promo_nouveau', 'offre_commentaire', 'annonce', 'mentorat_ouvert', 'match', 'match_interet', 'match_jour', 'rdv_message', 'rdv_reponse',
    // Les nouveaux types : envois entre personnes (pousser) et tâches programmées (insertions groupées)
    'match_attente', 'rdv_demain', 'entretien_demain', 'agenda_demain', 'apres_rdv', 'offre_bientot', 'demande_attente', 'semaine', 'reponse_utile', 'bravo',
    'demande_pause', 'mentorat_presence', 'groupe_jour', 'rappel_visite'])
    assert.ok(base.has(k), `lecture de la base incomplète : ${k}`);
});

// « Santé des notifications » (Par type) : un type sans nom y prendrait celui de sa catégorie (« Vie du réseau »), et ses
// chiffres se confondraient avec d'autres. Chaque nom a son arabe (un dictionnaire commun : addAR, dans un fichier de src/).
test('chaque type classé a son nom dans « Santé des notifications » (NOMS_NOTIF), en français et en arabe ; aucun nom pour un type inconnu', () => {
  for (const k of Object.keys(PUSH_KINDS)) assert.ok(Object.prototype.hasOwnProperty.call(NOMS_NOTIF, k), `type sans nom dans « Par type » : ${k}`);
  for (const k of Object.keys(NOMS_NOTIF)) assert.ok(k === 'test' || k in PUSH_KINDS, `nom d’un type que rien n’envoie : ${k}`);
  const dossier = new URL('../../src/', import.meta.url);
  const src = fs.readdirSync(dossier).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(new URL(f, dossier), 'utf8')).join('\n');
  for (const nom of Object.values(NOMS_NOTIF)) {
    const ar = src.match(new RegExp(`'${nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}': '([^']+)'`));
    assert.ok(ar && /[\u0600-\u06FF]/.test(ar[1]), `nom sans arabe : ${nom}`);
  }
});

test('catégories : messages, demandes, candidatures, mentorat, offres, vie du réseau ; un type inconnu suit la vie du réseau', () => {
  assert.equal(pushCategorie('message'), 'messages');
  assert.equal(pushCategorie('demande_nouvelle'), 'demandes');
  assert.equal(pushCategorie('demande_proposition'), 'demandes');
  assert.equal(pushCategorie('candidature'), 'candidatures');
  assert.equal(pushCategorie('invitation'), 'candidatures');
  assert.equal(pushCategorie('relance_offre'), 'candidatures');
  assert.equal(pushCategorie('rappel_rdv'), 'mentorat');
  assert.equal(pushCategorie('relecture_rendue'), 'mentorat');
  assert.equal(pushCategorie('parrain'), 'mentorat');
  assert.equal(pushCategorie('offre_alerte'), 'offres');
  assert.equal(pushCategorie('question_routee'), 'reseau');
  assert.equal(pushCategorie('signalement'), 'admin');
  assert.equal(pushCategorie('rappel_visite'), 'rappels', 'rappel de visite, à ne pas confondre avec rappel_rdv (mentorat)');
  assert.equal(pushCategorie('nouveau_type'), 'reseau');
  assert.equal(pushCategorie('constructor'), 'reseau');
});

// La règle annoncée, type par type : un même reclassement fait dans logic.js et dans schema.sql échoue ici
// (sql/test-notif-push.mjs vérifie que push_categorie donne la même chose que pushCategorie)
test('chaque type est dans la catégorie annoncée', () => {
  const regle = {
    messages: ['message', 'rdv_message', 'rdv_reponse', 'rappel_entretien', 'entretien_demain'],
    match: ['match', 'match_interet', 'match_jour', 'match_attente'],
    demandes: ['demande_nouvelle', 'demande_large', 'demande_proposition', 'demande_match', 'demande_rouverte', 'demande_reponse', 'demande_attente', 'demande_pause'],
    candidatures: ['candidature', 'candidature_statut', 'invitation', 'recrutement_a_confirmer', 'recrutement_confirme', 'relance_offre'],
    mentorat: ['mentorat_demande', 'mentorat_ouvert', 'mentorat_accepte', 'mentorat_deplace', 'mentorat_annule', 'rappel_rdv', 'merci', 'relecture_demande', 'relecture_prise',
      'relecture_rendue', 'contact_demande', 'contact_accepte', 'filleul', 'parrain', 'rdv_demain', 'mentorat_presence', 'apres_rdv'],
    offres: ['offre_alerte', 'offre_bientot'],
    reseau: ['reponse', 'question_routee', 'cafe', 'evenement', 'evenement_annule', 'evenement_deplace', 'enquete', 'verification_pair', 'verifier_pair', 'reaction',
      'promo_nouveau', 'offre_commentaire', 'annonce', 'agenda_demain', 'reponse_utile', 'bravo', 'groupe_jour'],
    rappels: ['rappel_visite', 'semaine'],
    admin: ['signalement'],
  };
  const attendu = Object.fromEntries(Object.entries(regle).flatMap(([cat, kinds]) => kinds.map(k => [k, cat])));
  assert.deepEqual(PUSH_KINDS, attendu);
});

// Toutes les catégories activées par défaut pour tout le monde, nouvelles offres comprises pour les lauréats
// (qu'ils cherchent un emploi ou non) ; seule l'ancienne case « M'alerter » décochée (un choix déjà fait) les coupe
test('défauts : tout est activé pour tous, les offres aussi pour un lauréat ; l’ancienne case « M’alerter » décochée reste un choix', () => {
  const etu = { role: 'etudiant' }, lau = { role: 'laureat' }, cherche = { role: 'laureat', en_recherche: true }, admin = { role: 'admin' };
  for (const c of PUSH_CATEGORIES) {
    for (const me of [etu, lau, cherche, admin]) assert.equal(pushDefaut(c, me), true, `${c} ${me.role}`);
  }
  assert.equal(pushDefaut('offres', { ...etu, alertes_offres: false }), false);
  assert.equal(pushDefaut('offres', { ...lau, alertes_offres: false }), false);
  assert.equal(pushDefaut('offres', { ...cherche, alertes_offres: false }), false);
  assert.equal(pushVoulu('offre_alerte', lau), true, 'un lauréat qui ne cherche pas d’emploi reçoit les nouvelles offres');
  for (const k of ['demande_large', 'promo_nouveau', 'offre_commentaire', 'annonce', 'mentorat_ouvert', 'message']) {
    for (const me of [etu, lau, cherche]) assert.equal(pushVoulu(k, me), true, `${k} ${me.role}`);
  }
  // Un choix déjà fait reste : la case coupée coupe aussi les nouveaux types de sa catégorie
  assert.equal(pushVoulu('promo_nouveau', { ...etu, notif_push: { reseau: false } }), false);
  assert.equal(pushVoulu('demande_large', { ...lau, notif_push: { demandes: false } }), false);
  assert.equal(pushVoulu('offre_alerte', { ...lau, notif_push: { offres: false } }), false);
  assert.equal(pushDefaut('admin', admin), true);
  assert.equal(pushDefaut('admin', lau), false);
});

test('le choix du membre l’emporte ; les signalements arrivent toujours à l’administration', () => {
  const lau = { role: 'laureat', notif_push: { offres: true, messages: false } };
  assert.equal(pushChoix('offres', lau), true);
  assert.equal(pushVoulu('offre_alerte', lau), true);
  assert.equal(pushVoulu('message', lau), false);
  assert.equal(pushVoulu('candidature', lau), true, 'catégorie non choisie : le défaut');
  assert.equal(pushVoulu('offre_alerte', { role: 'etudiant', alertes_offres: false, notif_push: { offres: true } }), true);
  assert.equal(pushVoulu('offre_alerte', { role: 'etudiant', notif_push: { offres: false } }), false);
  assert.equal(pushVoulu('signalement', { role: 'admin', notif_push: { reseau: false, messages: false } }), true);
  assert.equal(pushVoulu('nouveau_type', { role: 'etudiant', notif_push: { reseau: false } }), false);
  // Base pas encore à jour (pas de colonne notif_push) : les défauts
  assert.equal(pushVoulu('message', { role: 'etudiant' }), true);
  assert.equal(pushChoix('offres', { role: 'laureat', alertes_offres: false, notif_push: { offres: 'oui' } }), false, 'une valeur qui n’est pas un booléen ne compte pas');
});

// Rappels de visite : une catégorie à part, que l'on peut couper, activée par défaut pour les étudiants et les lauréats
test('rappels : catégorie à part, activée par défaut pour tous, coupée = rien ; la base accepte la case', () => {
  assert.ok(PUSH_CATEGORIES.includes('rappels'));
  assert.equal(PUSH_CATEGORIES.at(-1), 'rappels', 'dernière case de Mon profil');
  for (const me of [{ role: 'etudiant' }, { role: 'laureat' }, { role: 'laureat', en_recherche: true }, { role: 'etudiant', alertes_offres: false }]) {
    assert.equal(pushDefaut('rappels', me), true, JSON.stringify(me));
    assert.equal(pushVoulu('rappel_visite', me), true);
    assert.equal(pushVoulu('rappel_visite', { ...me, notif_push: { rappels: false } }), false);
    assert.equal(pushVoulu('rappel_visite', { ...me, notif_push: { messages: false, reseau: false, offres: false } }), true, 'les autres cases n’y changent rien');
    assert.equal(pushVoulu('rappel_rdv', { ...me, notif_push: { rappels: false } }), true, 'le rappel d’un rendez-vous reste dans « Mentorat »');
  }
  assert.match(SCHEMA, /e\.key not in \([^)]*'rappels'[^)]*\)/, 'notif_push_valide accepte la case « rappels »');
  // La base peut ranger d'autres types dans la même case (le résumé du dimanche) : la règle reste vraie
  assert.match(SCHEMA, /when p_kind (?:= 'rappel_visite'|in \([^)]*'rappel_visite'[^)]*\)) then 'rappels'/);
  // Le résumé du dimanche suit la même case : coupée, plus de résumé
  assert.equal(pushVoulu('semaine', { role: 'etudiant' }), true);
  assert.equal(pushVoulu('semaine', { role: 'laureat', notif_push: { rappels: false } }), false);
  assert.equal(pushVoulu('semaine', { role: 'etudiant', notif_push: { reseau: false, offres: false } }), true);
});

// Page Match : une catégorie à part (un intérêt pour soi, un match), activée par défaut, que l'on peut couper ;
// l'entretien proposé dans une discussion et sa réponse restent des messages
test('match : catégorie à part, activée par défaut pour les étudiants et les lauréats, coupée = rien ; un entretien reste un message', () => {
  assert.ok(PUSH_CATEGORIES.includes('match'));
  for (const k of ['match', 'match_interet', 'match_jour']) assert.equal(pushCategorie(k), 'match', k);
  for (const k of ['rdv_message', 'rdv_reponse', 'rappel_entretien']) assert.equal(pushCategorie(k), 'messages', k);
  for (const me of [{ role: 'etudiant' }, { role: 'laureat' }, { role: 'laureat', en_recherche: true }, { role: 'etudiant', alertes_offres: false }]) {
    assert.equal(pushDefaut('match', me), true, JSON.stringify(me));
    for (const k of ['match', 'match_interet', 'match_jour']) {
      assert.equal(pushVoulu(k, me), true, k);
      assert.equal(pushVoulu(k, { ...me, notif_push: { match: false } }), false, k + ' coupé');
      assert.equal(pushVoulu(k, { ...me, notif_push: { messages: false, demandes: false, reseau: false } }), true, 'les autres cases n’y changent rien');
    }
    for (const k of ['message', 'rdv_message', 'rdv_reponse']) {
      assert.equal(pushVoulu(k, { ...me, notif_push: { match: false } }), true, k + ' : couper Match ne fait pas rater un entretien');
      assert.equal(pushVoulu(k, { ...me, notif_push: { messages: false } }), false, k + ' : la case « Messages » le coupe');
    }
  }
  assert.match(SCHEMA, /e\.key not in \([^)]*'match'[^)]*\)/, 'notif_push_valide accepte la case « match »');
  // La base peut ajouter des types à ces listes (la veille d'un entretien, les intérêts qui attendent) : la règle reste vraie
  assert.match(SCHEMA, /when p_kind in \('message','rdv_message','rdv_reponse','rappel_entretien'[^)]*\) then 'messages'/);
  assert.match(SCHEMA, /when p_kind in \('match','match_interet','match_jour'[^)]*\) then 'match'/);
  // La veille d'un entretien reste un message ; les intérêts qui attendent suivent la case « Match »
  for (const me of [{ role: 'etudiant' }, { role: 'laureat' }]) {
    assert.equal(pushVoulu('entretien_demain', { ...me, notif_push: { match: false } }), true, 'couper Match ne fait pas rater la veille d’un entretien');
    assert.equal(pushVoulu('entretien_demain', { ...me, notif_push: { messages: false } }), false);
    assert.equal(pushVoulu('match_attente', { ...me, notif_push: { match: false } }), false);
    assert.equal(pushVoulu('match_attente', { ...me, notif_push: { messages: false } }), true);
  }
});

// Lot « Nouvelles notifications » : la case de chaque nouveau type, comme le contrat SQL ⇄ notifier (push_categorie le suit)
test('nouveaux types : chacun dans sa case de Mon profil, coupé avec elle, jamais dans une autre', () => {
  const CASE = {
    match_attente: 'match', rdv_demain: 'mentorat', entretien_demain: 'messages', agenda_demain: 'reseau', apres_rdv: 'mentorat', offre_bientot: 'offres',
    demande_attente: 'demandes', semaine: 'rappels', reponse_utile: 'reseau', bravo: 'reseau', demande_pause: 'demandes', mentorat_presence: 'mentorat',
    groupe_jour: 'reseau', match_jour: 'match',
  };
  for (const [k, cat] of Object.entries(CASE)) {
    assert.equal(pushCategorie(k), cat, k);
    for (const me of [{ role: 'etudiant' }, { role: 'laureat' }, { role: 'laureat', en_recherche: true }]) {
      assert.equal(pushVoulu(k, me), true, `${k} : activé par défaut`);
      assert.equal(pushVoulu(k, { ...me, notif_push: { [cat]: false } }), false, `${k} : sa case le coupe`);
      const autres = Object.fromEntries(PUSH_CATEGORIES.filter(c => c !== cat).map(c => [c, false]));
      assert.equal(pushVoulu(k, { ...me, notif_push: autres }), true, `${k} : les autres cases n’y changent rien`);
    }
  }
  // Chaque nouveau type a son texte dans le notifier
  const notifier = typesDuNotifier();
  for (const k of Object.keys(CASE)) assert.ok(notifier.has(k), `${k} sans texte dans le notifier`);
});
