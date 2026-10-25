// Notifications sur le téléphone, par catégorie : chaque type envoyé a sa catégorie, défauts selon le rôle.
// (La parité avec la base, push_categorie / push_defaut / push_voulu, est vérifiée dans sql/test-notif-push.mjs.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PUSH_KINDS, PUSH_CATEGORIES, pushCategorie, pushDefaut, pushChoix, pushVoulu } from '../../src/logic.js';

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
  for (const k of ['evenement', 'evenement_annule', 'evenement_deplace', 'question_routee', 'offre_alerte', 'demande_nouvelle', 'verifier_pair', 'cafe', 'signalement'])
    assert.ok(base.has(k), `lecture de la base incomplète : ${k}`);
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
    messages: ['message'],
    demandes: ['demande_nouvelle', 'demande_proposition', 'demande_match', 'demande_rouverte'],
    candidatures: ['candidature', 'candidature_statut', 'invitation', 'recrutement_a_confirmer', 'recrutement_confirme', 'relance_offre'],
    mentorat: ['mentorat_demande', 'mentorat_accepte', 'mentorat_deplace', 'mentorat_annule', 'rappel_rdv', 'merci', 'relecture_demande', 'relecture_prise',
      'relecture_rendue', 'contact_demande', 'contact_accepte', 'filleul', 'parrain'],
    offres: ['offre_alerte'],
    reseau: ['reponse', 'question_routee', 'cafe', 'evenement', 'evenement_annule', 'evenement_deplace', 'enquete', 'verification_pair', 'verifier_pair'],
    rappels: ['rappel_visite'],
    admin: ['signalement'],
  };
  const attendu = Object.fromEntries(Object.entries(regle).flatMap(([cat, kinds]) => kinds.map(k => [k, cat])));
  assert.deepEqual(PUSH_KINDS, attendu);
});

test('défauts : un étudiant reçoit tout (les offres suivent sa case « M’alerter ») ; un lauréat tout sauf les offres, sauf s’il cherche un emploi', () => {
  const etu = { role: 'etudiant' }, lau = { role: 'laureat' }, cherche = { role: 'laureat', en_recherche: true }, admin = { role: 'admin' };
  for (const c of ['messages', 'demandes', 'candidatures', 'mentorat', 'reseau']) {
    for (const me of [etu, lau, cherche, admin]) assert.equal(pushDefaut(c, me), true, `${c} ${me.role}`);
  }
  assert.equal(pushDefaut('offres', etu), true);
  assert.equal(pushDefaut('offres', { ...etu, alertes_offres: false }), false);
  assert.equal(pushDefaut('offres', lau), false);
  assert.equal(pushDefaut('offres', cherche), true);
  assert.equal(pushDefaut('offres', { ...cherche, alertes_offres: false }), false);
  assert.equal(pushDefaut('offres', admin), false);
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
  assert.equal(pushChoix('offres', { role: 'laureat', notif_push: { offres: 'oui' } }), false, 'une valeur qui n’est pas un booléen ne compte pas');
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
  assert.match(SCHEMA, /when p_kind = 'rappel_visite' then 'rappels'/);
});
