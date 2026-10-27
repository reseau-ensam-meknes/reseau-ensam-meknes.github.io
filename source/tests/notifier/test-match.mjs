// Page Match : textes FR et AR des notifications (match, intérêt, entretien proposé, réponse), lien vers le bon écran,
// regroupement sur le téléphone (tag), heure du Maroc. Match et intérêt : catégorie « Match » ; l'entretien proposé
// dans une discussion et sa réponse : « Messages » (couper Match ne fait pas rater un entretien).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE, SITE, uid } from './banc.mjs';

const N = await import(MODULE);
const logic = await import('../../src/logic.js');
const MATCH = uid(9101), ETU = uid(9102), LAU = uid(9103), OFFRE = uid(9104), MSG = uid(9105);
const RDV = '2026-11-03T10:00:00Z';   // mardi 3 novembre, 10:00 au Maroc (GMT depuis le 20 septembre 2026)
const t = (k, d, l = 'fr') => N.texteNotif(k, d, l, SITE);

const CAS = {
  match: [{ nom: 'Salma', de: ETU, match: MATCH, titre: 'PFE Lean' }, `messages/${ETU}`, `match-${MATCH}`, 'match', 'normal'],
  match_interet: [{ nom: 'Hamza', de: LAU, entreprise: 'OCP' }, 'match', `match_interet-${LAU}`, 'match', 'normal'],
  rdv_message: [{ nom: 'Youssef', de: LAU, m: MSG, rdv_at: RDV, duree: 30, lieu: null }, `messages/${LAU}`, `rdv_message-${MSG}`, 'messages', 'high'],
  rdv_reponse: [{ nom: 'Salma', de: ETU, m: MSG, reponse: 'oui', rdv_at: RDV }, `messages/${ETU}`, `rdv_reponse-${MSG}`, 'messages', 'high'],
};

test('Match : un texte en français et en arabe, le bon écran, un tag qui regroupe ; la catégorie et l’urgence de chacune', () => {
  for (const [kind, [data, route, tag, categorie, urgence]] of Object.entries(CAS)) {
    assert.equal(logic.pushCategorie(kind), categorie, kind);
    assert.equal(N.urgence(kind), urgence, kind + ' : un entretien est un message, il arrive tout de suite');
    for (const langue of ['fr', 'ar']) {
      const n = t(kind, data, langue);
      assert.ok(n, `${kind} ${langue}`);
      assert.equal(n.url, SITE + '#' + route, `${kind} ${langue}`);
      assert.equal(n.tag, tag, kind);
      assert.ok(n.title.length > 3 && n.body.length > 3, kind);
      assert.doesNotMatch(n.title + n.body, /undefined|null|NaN|\$\{/, kind);
      if (langue === 'ar') {
        assert.match(n.title + n.body, /[؀-ۿ]/, kind + ' en arabe');
        assert.doesNotMatch(n.title + n.body, /القدامى/);
      }
    }
  }
});

test('c’est un match : aux deux, le prénom de l’autre, la discussion s’ouvre', () => {
  const n = t('match', CAS.match[0]);
  assert.deepEqual([n.title, n.body], ['C’est un match !', 'Toi et Salma, vous pouvez vous écrire.']);
  const ar = t('match', CAS.match[0], 'ar');
  assert.equal(ar.title, 'تمّ التوافق!');
  assert.match(ar.body, /Salma/);
  // Sans l'autre personne (ancienne file) : la page Match, un tag par match
  assert.equal(t('match', { nom: 'Salma', match: MATCH }).url, SITE + '#match');
  assert.equal(t('match', { nom: 'Salma' }).tag, 'match');
  assert.doesNotMatch(t('match', {}).body, /undefined|null/);
});

test('intérêt : l’étudiant (un lauréat, son entreprise s’il la montre) ; le lauréat (son offre)', () => {
  const e = t('match_interet', CAS.match_interet[0]);
  assert.deepEqual([e.title, e.body], ['Un lauréat s’intéresse à ton profil', 'Hamza (OCP) s’intéresse à ton profil. Réponds dans Match.']);
  assert.equal(t('match_interet', { nom: 'Karim', de: LAU }).body, 'Karim s’intéresse à ton profil. Réponds dans Match.');
  const l = t('match_interet', { nom: 'Salma', de: ETU, titre: 'PFE Lean manufacturing', offre: OFFRE });
  assert.deepEqual([l.title, l.body], ['Nouvel intérêt pour ton offre', 'Salma s’intéresse à ton offre « PFE Lean manufacturing ». Réponds dans Match.']);
  assert.equal(l.url, SITE + '#match');
  assert.equal(l.tag, `match_interet-${ETU}`, 'une par personne : la suivante remplace la précédente');
  const ar = t('match_interet', { nom: 'Salma', de: ETU, titre: 'PFE Lean', offre: OFFRE }, 'ar');
  assert.equal(ar.title, 'اهتمام جديد بعرضك');
  assert.match(ar.body, /Salma/); assert.match(ar.body, /PFE Lean/);
  assert.equal(t('match_interet', CAS.match_interet[0], 'ar').title, 'أحد الخريجين مهتم بملفك');
});

test('entretien proposé : la date et l’heure du Maroc, la durée, visio ou lieu ; 15 minutes : un appel', () => {
  const n = t('rdv_message', CAS.rdv_message[0]);
  assert.deepEqual([n.title, n.body], ['Entretien proposé : mardi 3 novembre à 10:00', 'Youssef te propose un entretien de 30 min en visio.']);
  const lieu = t('rdv_message', { ...CAS.rdv_message[0], duree: 60, lieu: 'Siège OCP, Casablanca' });
  assert.equal(lieu.body, 'Youssef te propose un entretien de 60 min · Siège OCP, Casablanca.');
  const appel = t('rdv_message', { ...CAS.rdv_message[0], duree: 15 });
  assert.deepEqual([appel.title, appel.body], ['Appel proposé : mardi 3 novembre à 10:00', 'Youssef te propose un appel de 15 min en visio.']);
  const ar = t('rdv_message', CAS.rdv_message[0], 'ar');
  assert.match(ar.title, /^مقابلة مقترحة: .+ على الساعة 10:00$/);
  assert.match(ar.body, /30 دقيقة/); assert.match(ar.body, /عبر الفيديو/);
  assert.match(t('rdv_message', { ...CAS.rdv_message[0], duree: 15 }, 'ar').title, /^مكالمة مقترحة/);
  // Sans date (ancienne file) : un titre simple
  assert.equal(t('rdv_message', { nom: 'Youssef', de: LAU, duree: 30 }).title, 'Entretien proposé');
});

test('réponse à l’entretien : « sera là » ou « un autre horaire », à l’auteur ; une réponse inconnue ne part pas', () => {
  const oui = t('rdv_reponse', CAS.rdv_reponse[0]);
  assert.deepEqual([oui.title, oui.body], ['Salma sera là', 'Entretien du mardi 3 novembre à 10:00.']);
  const autre = t('rdv_reponse', { ...CAS.rdv_reponse[0], reponse: 'autre' });
  assert.deepEqual([autre.title, autre.body], ['Salma propose un autre horaire', 'Pour l’entretien du mardi 3 novembre à 10:00 : convenez d’un autre moment dans la discussion.']);
  assert.equal(t('rdv_reponse', { nom: 'Salma', de: ETU, reponse: 'autre' }).body, 'Convenez d’un autre moment dans la discussion.');
  assert.equal(t('rdv_reponse', { ...CAS.rdv_reponse[0], reponse: 'peut-etre' }), null);
  assert.equal(t('rdv_reponse', { ...CAS.rdv_reponse[0], reponse: 'peut-etre' }, 'ar'), null);
  assert.equal(t('rdv_reponse', CAS.rdv_reponse[0], 'ar').title.includes('تأكيد الحضور'), true);
  assert.match(t('rdv_reponse', { ...CAS.rdv_reponse[0], reponse: 'autre' }, 'ar').title, /توقيت آخر/);
});
