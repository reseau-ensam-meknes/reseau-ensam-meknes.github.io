// « Me prévenir » : quand proposer les notifications après une action qui attend une réponse
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prevenirVariante, PREVENIR_ECART, ouvertureNotif, OUVERTURE_ECART, bandeauPush, BANDEAU_PUSH_ECART, lignePrevenir, sansLigne, LIGNES_MAX, attendReponse,
  PUSH_CATEGORIES } from '../../src/logic.js';

const NOW = Date.UTC(2026, 9, 23, 10);
const J = 864e5;
const v = x => prevenirVariante({ raison: 'mentorat', role: 'etudiant', now: NOW, emailsMessages: true, emailsHebdo: true, ...x });

test('prevenirVariante : jamais pour l’admin, ni quand c’est déjà fait ou activé, ni avant de connaître l’état', () => {
  assert.equal(v({ etat: 'off', role: 'admin' }), null);
  assert.equal(v({ etat: 'on' }), null);
  assert.equal(v({ etat: 'off', memo: { fait: 1 } }), null);
  assert.equal(v({ etat: '…' }), null);
  assert.equal(v({ etat: 'demo' }), null);
  assert.equal(v({ etat: 'off' }), 'push');
  assert.equal(v({ etat: 'ios' }), 'ios');
});

test('prevenirVariante : revient 3 jours après chaque refus, tant que rien n’est activé', () => {
  assert.equal(PREVENIR_ECART, 3 * J);
  assert.equal(v({ etat: 'off', memo: { n: 1, at: NOW - 2 * J } }), null);
  assert.equal(v({ etat: 'off', memo: { n: 1, at: NOW - 3 * J } }), 'push');
  assert.equal(v({ etat: 'off', memo: { n: 9, at: NOW - 3 * J } }), 'push');
  assert.equal(v({ etat: 'ios', memo: { n: 1, at: NOW - 2 * J } }), null);
});

test('prevenirVariante : sans notifications possibles, l’email une seule fois, et seulement s’il part vraiment', () => {
  assert.equal(v({ etat: 'absent', raison: 'demande' }), 'email');
  assert.equal(v({ etat: 'refuse', raison: 'demande' }), 'email');
  assert.equal(v({ etat: 'absent', raison: 'demande', emailsMessages: false }), null);
  assert.equal(v({ etat: 'absent', raison: 'question' }), 'email');
  assert.equal(v({ etat: 'absent', raison: 'question', emailsHebdo: false }), null);
  assert.equal(v({ etat: 'absent', raison: 'candidature' }), null);
  assert.equal(v({ etat: 'absent', raison: 'demande', memo: { mail: 1 } }), null);
});

// À l'ouverture : « Reçois l'essentiel sur ton téléphone »
const o = x => ouvertureNotif({ etat: 'off', role: 'etudiant', now: NOW, ...x });

test('ouvertureNotif : seulement un appareil qui peut recevoir sans être abonné, l’admin aussi (ses signalements)', () => {
  assert.equal(o({}), true);
  assert.equal(o({ role: 'laureat' }), true);
  assert.equal(o({ role: 'admin' }), true);
  for (const etat of ['on', 'ios', 'absent', 'refuse', 'demo', '…']) assert.equal(o({ etat }), false, etat);
});

test('ouvertureNotif : « Plus tard » la ramène 2 jours après, sans plafond, mémo partagé avec « Me prévenir »', () => {
  assert.equal(OUVERTURE_ECART, 2 * J);
  assert.equal(o({ memo: { n: 1, at: NOW - 1.9 * J } }), false);
  assert.equal(o({ memo: { n: 1, at: NOW - 2 * J } }), true);
  assert.equal(o({ memo: { n: 9, at: NOW - 2 * J } }), true);
  // Accepté (ici ou par « Me prévenir »), ou coupé dans Mon profil : plus jamais
  assert.equal(o({ memo: { fait: 1 } }), false);
  // Une feuille « Me prévenir » remise à cette visite passe avant
  assert.equal(o({ memo: { differe: 'demande' } }), false);
  // La variante email de « Me prévenir » ne compte pas comme une demande d'autorisation
  assert.equal(o({ memo: { mail: 1 } }), true);
});

test('catégorie décochée dans Mon profil : « Me prévenir » ne promet pas de notification, l’email reste possible', () => {
  assert.equal(v({ etat: 'off', voulu: false }), null);
  assert.equal(v({ etat: 'ios', voulu: false }), null);
  assert.equal(v({ etat: 'off', voulu: true }), 'push');
  assert.equal(v({ etat: 'absent', raison: 'demande', voulu: false }), 'email');
});

test('ouvertureNotif : toutes les catégories décochées, rien à proposer', () => {
  assert.equal(o({ voulu: false }), false);
  assert.equal(o({ voulu: true }), true);
});

test('bandeauPush : dit ce qui bloque, se range 3 jours, respecte qui a coupé', () => {
  const b = x => bandeauPush({ role: 'etudiant', now: NOW, ...x });
  assert.equal(BANDEAU_PUSH_ECART, 3 * J);
  for (const e of ['off', 'ios', 'refuse']) assert.equal(b({ etat: e }), e);
  for (const e of ['on', 'absent', 'demo', '…']) assert.equal(b({ etat: e }), null);
  assert.equal(b({ etat: 'off', role: 'admin' }), null);
  assert.equal(b({ etat: 'off', voulu: false }), null);
  assert.equal(b({ etat: 'off', memo: { coupe: 1 } }), null);
  assert.equal(b({ etat: 'off', memo: { bandeau: NOW - 2 * J } }), null);
  assert.equal(b({ etat: 'off', memo: { bandeau: NOW - 3 * J } }), 'off');
});

// « Demander au bon moment » : les nouvelles raisons (un « Intéressé » sans match, une offre publiée, des coordonnées demandées,
// un message qui attend sa réponse) et la ligne non modale de Messages et de la fin de la pile Match
const NOUVELLES = ['match', 'offre', 'offreLaureats', 'contact'];

test('nouvelles raisons : la feuille sur un appareil qui peut recevoir, 3 jours après « Plus tard », jamais d’email promis', () => {
  for (const raison of NOUVELLES) {
    assert.equal(v({ raison, etat: 'off' }), 'push', raison);
    assert.equal(v({ raison, etat: 'ios' }), 'ios', raison);
    assert.equal(v({ raison, etat: 'off', memo: { n: 1, at: NOW - 2 * J } }), null, raison);
    assert.equal(v({ raison, etat: 'off', memo: { n: 1, at: NOW - 3 * J } }), 'push', raison);
    // Bloquées ou impossibles ici : pas de feuille (seule la demande et la question ont un email qui suit vraiment)
    for (const etat of ['refuse', 'absent', 'on', 'demo', '…']) assert.equal(v({ raison, etat }), null, `${raison} ${etat}`);
    assert.equal(v({ raison, etat: 'off', role: 'admin' }), null, raison);
    assert.equal(v({ raison, etat: 'off', voulu: false }), null, raison);
  }
});

test('nouvelles raisons (pwa.js) : chacune a sa phrase en français et en arabe, et la catégorie de Mon profil dont dépend la réponse', () => {
  const pwa = fs.readFileSync(new URL('../../src/pwa.js', import.meta.url), 'utf8');
  const bloc = nom => { const i = pwa.indexOf(`const ${nom} = {`); return pwa.slice(i, pwa.indexOf('};', i)); };
  const cat = Object.fromEntries([...bloc('CAT_RAISON').matchAll(/(\w+): '(\w+)'/g)].map(m => [m[1], m[2]]));
  assert.deepEqual({ match: cat.match, offre: cat.offre, offreLaureats: cat.offreLaureats, contact: cat.contact, message: cat.message },
    { match: 'match', offre: 'candidatures', offreLaureats: 'candidatures', contact: 'mentorat', message: 'messages' });
  for (const c of Object.values(cat)) assert.ok(PUSH_CATEGORIES.includes(c), `catégorie inconnue : ${c}`);
  const phrases = bloc('NOTIF_RAISON');
  for (const r of [...NOUVELLES, 'offreCandidatures']) {
    assert.match(phrases, new RegExp(`\\n  ${r}: '[^']+'`), `phrase de ${r}`);
    assert.match(pwa, new RegExp(`\\[NOTIF_RAISON\\.${r}\\]: '[^']*[\\u0600-\\u06FF][^']*'`), `arabe de ${r}`);
  }
  assert.match(phrases, /match: 'Si l’intérêt est réciproque, une notification arrive sur cet appareil\.'/);
  assert.match(phrases, /offre: 'Dès qu’un étudiant postule ou s’intéresse à ton offre, une notification arrive sur cet appareil\.'/);
  // La ligne : sa phrase sur téléphone, en arabe aussi
  assert.match(pwa, /'Sa réponse peut arriver sur ce téléphone, même application fermée'/);
  assert.match(pwa, /'Une notification arrive dès qu’un intérêt est réciproque'/);
  for (const k of ['LIGNE.message.tel', 'LIGNE.message.pc', 'LIGNE.match.tel', 'LIGNE_X.message', 'LIGNE_X.match', 'TITRE_RAISON.match', 'TITRE_RAISON.offre'])
    assert.match(pwa, new RegExp(`\\[${k.replace(/\./g, '\\.')}\\]: '[^']*[\\u0600-\\u06FF]`), `arabe de ${k}`);
});

// La ligne
const l = x => lignePrevenir({ etat: 'off', role: 'etudiant', ...x });

test('lignePrevenir : « Activer » sur un appareil qui peut recevoir, « Comment faire » sur iPhone, « Débloquer » quand c’est bloqué', () => {
  assert.equal(l({}), 'activer');
  assert.equal(l({ etat: 'ios' }), 'ios');
  assert.equal(l({ etat: 'refuse' }), 'debloquer');
  // Rien quand cet appareil reçoit déjà, ne peut rien recevoir, ou n'est pas encore connu (démo ordinaire comprise)
  for (const etat of ['on', 'absent', 'demo', '…']) assert.equal(l({ etat }), null, etat);
});

test('lignePrevenir : rien pour l’admin, pour qui a coupé ou décoché la catégorie, ni quand rien n’attend de réponse', () => {
  assert.equal(l({ role: 'admin' }), null);
  assert.equal(l({ memo: { coupe: 1, fait: 1 } }), null);
  assert.equal(l({ memo: { coupe: 1 } }), null);
  assert.equal(l({ etat: 'refuse', memo: { coupe: 1 } }), null);
  assert.equal(l({ voulu: false }), null);
  assert.equal(l({ attente: false }), null);
  // Une réponse donnée sur cet appareil (memo.fait) : plus d'« Activer » ; et un blocage qui est cette réponse (« Bloquer »
  // dans la fenêtre du navigateur, ou bloquées dans les réglages après les avoir activées) est respecté : pas de « Débloquer »
  // à chaque visite. Un blocage qui ne vient pas d'une réponse ici (plus ancien, ou d'un autre compte) : « Débloquer ».
  assert.equal(l({ memo: { fait: 1 } }), null);
  assert.equal(l({ etat: 'refuse', memo: { fait: 1 } }), null);
  assert.equal(l({ etat: 'refuse', memo: { n: 1, at: NOW - 4 * J } }), 'debloquer');
});

test('lignePrevenir : son × la range pour ce fil seulement ; elle ne compte pas dans le budget des feuilles', () => {
  const memo = sansLigne({ n: 1, at: NOW - J }, 'u-0002');
  assert.equal(l({ memo, fil: 'u-0002' }), null);
  assert.equal(l({ memo, fil: 'u-0005' }), 'activer');
  assert.equal(l({ memo, fil: 'match' }), 'activer');
  // Une feuille refusée hier (avant cette visite) ne l'empêche pas : la ligne n'attend pas 3 jours
  assert.equal(l({ memo: { n: 1, at: NOW - J }, depuis: NOW - 60e3 }), 'activer');
  // Le × ne touche pas au compte des feuilles
  assert.deepEqual({ n: memo.n, at: memo.at }, { n: 1, at: NOW - J });
});

test('lignePrevenir : une seule demande par visite', () => {
  // Une feuille vue ou refusée pendant cette visite (feuille d'ouverture, « Plus tard ») : pas de ligne
  assert.equal(l({ memo: { n: 1, at: NOW - 30e3 }, depuis: NOW - 60e3 }), null);
  // Une feuille « Me prévenir » demandée, ou la fenêtre du navigateur déjà répondue pendant cette visite
  assert.equal(l({ deja: true }), null);
  assert.equal(l({ etat: 'refuse', deja: true }), null);
  assert.equal(l({ etat: 'ios', deja: true }), null);
});

test('sansLigne : retient les fils rangés, le plus récent d’abord, sans doublon ni liste sans fin', () => {
  assert.deepEqual(sansLigne({}, 'match').lignes, ['match']);
  assert.deepEqual(sansLigne({ lignes: ['a', 'b'] }, 'b').lignes, ['b', 'a']);
  assert.deepEqual(sansLigne({ fait: 1 }, 'a'), { fait: 1, lignes: ['a'] });
  let m = {};
  for (let i = 0; i < LIGNES_MAX + 10; i++) m = sansLigne(m, 'f' + i);
  assert.equal(m.lignes.length, LIGNES_MAX);
  assert.equal(m.lignes[0], 'f' + (LIGNES_MAX + 9));
  // Un mémo abîmé (lignes qui n'est pas une liste) ne casse rien
  assert.deepEqual(sansLigne({ lignes: 'x' }, 'a').lignes, ['a']);
  assert.equal(l({ memo: { lignes: 'x' }, fil: 'x' }), 'activer');
});

test('attendReponse : un premier message resté sans réponse, ou un entretien proposé qui attend la sienne', () => {
  const moi = 'u-0001', lui = 'u-0002';
  const msg = (auteur, x = {}) => ({ author_id: auteur, type: 'texte', ...x });
  assert.equal(attendReponse([], moi), false, 'rien écrit : rien n’attend');
  assert.equal(attendReponse([msg(lui)], moi), false, 'l’autre a écrit, pas moi');
  assert.equal(attendReponse([msg(moi)], moi), true);
  assert.equal(attendReponse([msg(moi), msg(moi)], moi), true);
  assert.equal(attendReponse([msg(moi), msg(lui)], moi), false, 'il a répondu');
  assert.equal(attendReponse([msg(lui), msg(moi)], moi), false, 'la conversation a déjà sa réponse');
  const demain = new Date(NOW + J).toISOString(), hier = new Date(NOW - J).toISOString();
  // Un entretien proposé, à venir, sans réponse : attendue, même après d'autres messages
  assert.equal(attendReponse([msg(lui), msg(moi, { type: 'rdv', rdv_at: demain, rdv_reponse: null })], moi, NOW), true);
  assert.equal(attendReponse([msg(lui), msg(moi, { type: 'rdv', rdv_at: demain, rdv_reponse: 'oui' })], moi, NOW), false);
  assert.equal(attendReponse([msg(lui), msg(moi, { type: 'rdv', rdv_at: hier, rdv_reponse: null })], moi, NOW), false, 'passé : plus rien à attendre');
  // Répondu à l'entretien sans écrire : c'est une réponse
  assert.equal(attendReponse([msg(moi, { type: 'rdv', rdv_at: demain, rdv_reponse: 'autre' })], moi, NOW), false);
});
