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
  match: [{ nom: 'Salma', de: ETU, match: MATCH, titre: 'PFE Lean' }, `messages/${ETU}`, `match-${MATCH}`, 'match', 'high'],
  match_interet: [{ nom: 'Hamza', de: LAU, entreprise: 'OCP' }, 'match', `match_interet-${LAU}`, 'match', 'high'],
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
  assert.equal(ar.title, 'تمّ الاتفاق!');
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

// Le tour du jour, à midi (P1) : de vraies cartes, comptées comme Match les montre (TOUR_JOUR au plus) ; ni cœur, ni emoji,
// ni série ; une seule ligne dans la barre (tag fixe), la suivante remplace
const CULPABILISANT = /oubli|manqu|dommage|urgent|vite|dépêche|tu n.as pas|personne ne|déçu|نسيت|فات|عاجل|بسرعة/i;
const SANS_COEUR = /[\u{1F300}-\u{1FAFF}☀-➿]|♥|❤|cœur|قلب|سلسلة|série/u;
test('tour du jour : « Ton tour du jour est prêt », de vraies cartes de son année (5 au plus), sans pression ni emoji', () => {
  assert.equal(N.TOUR_JOUR, logic.TOUR_JOUR, 'le notifier compte comme la page Match');
  const ATTENDU = {
    etudiant: {
      fr: { 1: 'Une offre d’un lauréat pour ton année, dans Match.', 2: '2 offres de lauréats pour ton année, dans Match.', 5: '5 offres de lauréats pour ton année, dans Match.', 12: '5 offres de lauréats pour ton année, dans Match.' },
      ar: { 1: 'عرض واحد من الخريجين لسنتك في صفحة التوافق.', 2: 'عرضان من الخريجين لسنتك في صفحة التوافق.', 5: '5 عروض من الخريجين لسنتك في صفحة التوافق.', 12: '5 عروض من الخريجين لسنتك في صفحة التوافق.' },
    },
    laureat: {
      fr: { 1: 'Un nouvel étudiant de ton parcours dans Match.', 2: '2 nouveaux étudiants de ton parcours dans Match.', 5: '5 nouveaux étudiants de ton parcours dans Match.', 12: '5 nouveaux étudiants de ton parcours dans Match.' },
      ar: { 1: 'طالب جديد من مسارك في صفحة التوافق.', 2: 'طالبان جديدان من مسارك في صفحة التوافق.', 5: '5 طلبة جدد من مسارك في صفحة التوافق.', 12: '5 طلبة جدد من مسارك في صفحة التوافق.' },
    },
  };
  for (const [role, langues] of Object.entries(ATTENDU)) for (const [l, corps] of Object.entries(langues)) for (const [n, body] of Object.entries(corps)) {
    const x = t('match_jour', { n: Number(n), type: role }, l);
    assert.deepEqual([x.title, x.body, x.url, x.tag], [l === 'fr' ? 'Ton tour du jour est prêt' : 'جولة اليوم جاهزة', body, SITE + '#match', 'match_jour'], `${role} ${l} ${n}`);
    assert.doesNotMatch(x.title + x.body, CULPABILISANT);
    assert.doesNotMatch(x.title + x.body, SANS_COEUR);
    assert.doesNotMatch(x.title + x.body, /une minute suffit|دقيقة واحدة تكفي/);
  }
  // Aucune carte, ou un compte douteux : rien n'est envoyé (jamais « 0 offre »)
  for (const n of [0, -2, null, 'abc', 1.5]) for (const l of ['fr', 'ar']) assert.equal(t('match_jour', { n, type: 'etudiant' }, l), null, `${n} ${l}`);
  assert.equal(t('match_jour', { n: '3', type: 'laureat' }).body, '3 nouveaux étudiants de ton parcours dans Match.', 'un nombre envoyé en texte reste un nombre');
  assert.equal(logic.pushCategorie('match_jour'), 'match');
  assert.deepEqual([N.urgence('match_jour'), N.dureeVie('match_jour')], ['high', 6 * 3600]);
  assert.ok(N.TAGS_FIXES.has('match_jour'));
});

// Les « Intéressé » qui attendent une réponse (P2), regroupés ; seul, il remplace l'intérêt d'origine de la même personne
test('intérêts qui attendent : un seul, la ligne de l’intérêt d’origine ; plusieurs, une ligne fixe ; entreprise seulement si visible', () => {
  const lau = { nom: 'Salma', titre: 'PFE Lean manufacturing', de: ETU, offre: OFFRE, type: 'laureat' };
  const etu = { nom: 'Hamza', entreprise: 'OCP', de: LAU, type: 'etudiant' };
  const un = t('match_attente', { ...lau, n: 1 });
  assert.deepEqual([un.title, un.body, un.url, un.tag], ['Un intérêt t’attend dans Match', 'Salma s’intéresse à ton offre « PFE Lean manufacturing ». Réponds quand tu as un moment.', SITE + '#match', `match_interet-${ETU}`]);
  assert.equal(un.tag, t('match_interet', { nom: 'Salma', de: ETU, titre: 'PFE Lean manufacturing', offre: OFFRE }).tag, 'même ligne que l’intérêt d’origine');
  assert.equal(t('match_attente', { ...etu, n: 1 }).body, 'Hamza (OCP) s’intéresse à ton profil. Réponds quand tu as un moment.');
  // Entreprise cachée : la base l'envoie vide
  assert.equal(t('match_attente', { ...etu, entreprise: '', n: 1 }).body, 'Hamza s’intéresse à ton profil. Réponds quand tu as un moment.');
  assert.equal(t('match_attente', { ...etu, entreprise: '', n: 1 }, 'ar').body, 'اهتمام بملفك من \u2068Hamza\u2069. يمكنك الرد متى سمح وقتك.');
  const deux = t('match_attente', { ...etu, n: 2 });
  assert.deepEqual([deux.title, deux.body, deux.tag], ['2 intérêts t’attendent dans Match', 'Hamza et un autre lauréat s’intéressent à ton profil. Réponds quand tu as un moment.', 'match_attente']);
  const douze = t('match_attente', { ...lau, n: 12 });
  assert.deepEqual([douze.title, douze.body, douze.tag], ['12 intérêts t’attendent dans Match', 'Salma et 11 autres étudiants s’intéressent à tes offres. Réponds quand tu as un moment.', 'match_attente']);
  assert.equal(t('match_attente', { ...lau, n: 2 }).body, 'Salma et un autre étudiant s’intéressent à tes offres. Réponds quand tu as un moment.');
  // Arabe : le titre accordé (2, 3 à 10, 11 et plus), le prénom isolé
  const A = n => t('match_attente', { ...etu, n }, 'ar');
  assert.deepEqual([A(1).title, A(1).body], ['اهتمام ينتظر ردك في صفحة التوافق', 'اهتمام بملفك من \u2068Hamza\u2069 (\u2068OCP\u2069). يمكنك الرد متى سمح وقتك.']);
  assert.deepEqual([A(2).title, A(2).body], ['اهتمامان ينتظران ردك في صفحة التوافق', 'من بينها اهتمام من \u2068Hamza\u2069. يمكنك الرد متى سمح وقتك.']);
  assert.equal(A(3).title, '3 اهتمامات تنتظر ردك في صفحة التوافق');
  assert.equal(A(12).title, '12 اهتمامًا ينتظر ردك في صفحة التوافق');
  assert.equal(t('match_attente', { ...lau, n: 1 }, 'ar').body, 'اهتمام من \u2068Salma\u2069 بعرضك «\u2068PFE Lean manufacturing\u2069». يمكنك الرد متى سمح وقتك.');
  for (const n of [1, 2, 12]) for (const l of ['fr', 'ar']) for (const d of [lau, etu]) {
    const x = t('match_attente', { ...d, n }, l);
    assert.doesNotMatch(x.title + x.body, CULPABILISANT);
    assert.doesNotMatch(x.title + x.body, SANS_COEUR);
    assert.doesNotMatch(x.title + x.body, /undefined|null|NaN|\$\{|(^|\D)0(\D|$)/);
    assert.ok(x.title.length <= 80 && x.body.length <= 180);
  }
  // Sans le type (ancienne file) : une offre visée veut dire un lauréat ; sans « de », la ligne fixe
  assert.match(t('match_attente', { nom: 'Salma', titre: 'PFE', offre: OFFRE, n: 1 }).body, /à ton offre « PFE »/);
  assert.equal(t('match_attente', { nom: 'Salma', n: 1 }).tag, 'match_attente');
  assert.equal(logic.pushCategorie('match_attente'), 'match');
  assert.deepEqual([N.urgence('match_attente'), N.dureeVie('match_attente')], ['high', 12 * 3600]);
});
