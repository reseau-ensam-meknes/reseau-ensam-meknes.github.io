// Des messages qui laissent une porte ouverte : après un refus, le vrai nombre d'autres offres (sinon une autre porte vraie),
// après une annulation, d'autres horaires ; et en arabe, les mêmes phrases, sans marque de genre ni « موسم »
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { porteApresRefus, offresOuvertesPour, pointsRecrutement, nouvelleDemandeApres } from '../../src/logic.js';

const S = 2026; // année 2026-2027 : la promo 2029 est en 3A
const salma = { id: 's', role: 'etudiant', promo: 2029 };
const offre = (id, x = {}) => ({ id, author_id: 'l', status: 'ouverte', audience: 'etudiants', annees: [3], deadline: null, ...x });
const donnees = (offers, x = {}) => ({ offers, applications: [], demandes: [], mentorships: [], ...x });

test('refus : le vrai nombre d’offres où l’on peut encore postuler', () => {
  const offers = [offre('a'), offre('b'), offre('c'), offre('fermee', { status: 'pourvue' }), offre('4a', { annees: [4] }),
    offre('passee', { deadline: '2020-01-01' }), offre('entre', { audience: 'laureats' }), offre('miennne', { author_id: 's' })];
  const d = donnees(offers, { applications: [{ student_id: 's', offer_id: 'c', status: 'refuse' }] });
  assert.deepEqual(offresOuvertesPour(d, salma, S).map(o => o.id), ['a', 'b']);
  const p = porteApresRefus(d, salma, S);
  assert.equal(p.n, 2);
  assert.equal(p.phrase, '2 autres offres t’attendent.');
  assert.equal(p.to, 'offres');
  assert.equal(porteApresRefus(donnees([offre('a')]), salma, S).phrase, 'Une autre offre t’attend.');
});

test('refus sans autre offre : publier sa demande, ou, si elle existe déjà, un conseil (jamais « 0 offre »)', () => {
  const vide = porteApresRefus(donnees([]), salma, S);
  assert.equal(vide.n, 0);
  assert.equal(vide.to, 'offres/demandes/nouvelle');
  assert.match(vide.phrase, /^Dis aux lauréats ce que tu cherches/);
  const avecDemande = porteApresRefus(donnees([], { demandes: [{ id: 'd', auteur_id: 's', status: 'ouverte' }] }), salma, S);
  assert.equal(avecDemande.to, 'mentorat');
  assert.equal(avecDemande.conseil, true);
  // Un lauréat en poste ne peut pas publier de demande : un conseil
  assert.equal(porteApresRefus(donnees([]), { id: 'k', role: 'laureat', promo: 2015 }, S).to, 'mentorat');
});

test('refus côté lauréat : les offres « Entre lauréats » ouvrent leur onglet', () => {
  const karim = { id: 'k', role: 'laureat', promo: 2015, en_recherche: true };
  const p = porteApresRefus(donnees([offre('x', { audience: 'laureats' }), offre('y', { audience: 'laureats' })]), karim, S);
  assert.deepEqual([p.n, p.to], [2, 'offres/laureats']);
});

test('rendez-vous annulé : la porte disparaît dès que d’autres horaires sont envoyés au même lauréat', () => {
  const m = { id: 'm1', student_id: 's', mentor_id: 'l', status: 'annulee', created_at: '2026-10-01T10:00:00Z' };
  assert.equal(nouvelleDemandeApres({ mentorships: [m] }, m), false);
  const autreLaureat = { id: 'm2', student_id: 's', mentor_id: 'z', status: 'demande', created_at: '2026-10-02T10:00:00Z' };
  assert.equal(nouvelleDemandeApres({ mentorships: [m, autreLaureat] }, m), false);
  const relance = { id: 'm3', student_id: 's', mentor_id: 'l', status: 'demande', created_at: '2026-10-02T10:00:00Z' };
  assert.equal(nouvelleDemandeApres({ mentorships: [m, relance] }, m), true);
  assert.equal(nouvelleDemandeApres({ mentorships: [m, { ...relance, status: 'annulee' }] }, m), false);
});

test('points d’un recrutement : 50, et 75 à l’international (la pastille dit le vrai nombre)', () => {
  assert.equal(pointsRecrutement({}), 50);
  assert.equal(pointsRecrutement({ pays: 'Maroc' }), 50);
  assert.equal(pointsRecrutement({ pays: 'France' }), 75);
  assert.equal(pointsRecrutement({ type: 'etranger' }), 75);
});

test('arabe : les phrases changées ont leur traduction, neutre en genre, avec « السنة » et jamais « موسم »', async () => {
  globalThis.document ??= { documentElement: {} };
  const i18n = await import('../../src/i18n.js');
  await i18n.setLang('ar');
  const ar = s => i18n.t(s);
  const cas = {
    'Année 2026-2027': 'السنة 2026-2027',
    '+50 points': '⁦+50⁩ نقطة',
    '+10 points': '⁦+10⁩ نقاط',
    'Ton parrainage cette année : Youssef, de ta filière.': 'عرّابك هذه السنة: ⁨Youssef⁩، من خريجي شعبتك.',
    'Youssef déclare ton recrutement chez OCP': 'تصريح من ⁨Youssef⁩ بتوظيفك لدى ⁨OCP⁩',
    'Salma a confirmé son démarrage chez OCP.': 'تم تأكيد بدء ⁨Salma⁩ لدى ⁨OCP⁩.',
    'Salma te remercie : son recrutement chez OCP est confirmé.': 'شكر من ⁨Salma⁩: تأكَّد التوظيف لدى ⁨OCP⁩.',
    'Ton rendez-vous avec Youssef pour « Relire mon CV » est annulé. Tu peux lui proposer d’autres horaires.': 'أُلغي موعدك مع ⁨Youssef⁩ بخصوص «⁨Relire mon CV⁩». يمكنك اقتراح توقيتات أخرى.',
    'Youssef a choisi un de tes horaires : Relire mon CV': 'تم تحديد موعدك مع ⁨Youssef⁩: ⁨Relire mon CV⁩',
    'Promo 2027 : tu es encore à l’école ? Mets ton profil à jour.': 'دفعة 2027: هل ما زلت تدرس في المدرسة؟ حدّث ملفك.',
    '12 réussites vérifiées grâce aux lauréats cette année.': '12 نجاحًا موثَّقًا بفضل الخريجين هذه السنة.',
    'Un autre lauréat vient de choisir un horaire.': 'اختار خريج آخر توقيتًا للتو.',
  };
  for (const [fr, attendu] of Object.entries(cas)) assert.equal(ar(fr), attendu, fr);
  await i18n.setLang('fr');
});
