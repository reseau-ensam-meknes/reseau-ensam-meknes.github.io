// Nouvelles notifications : la veille d'un rendez-vous, après un rendez-vous, une offre mise de côté qui ferme, une demande
// toujours sans aide ou mise en pause, le résumé du dimanche, une réponse utile, un bravo, une présence confirmée, les
// messages des groupes. Chaque type en français et en arabe, avec de vrais chiffres (n = 1, 2, 12), le tag et la route du
// contrat, sa case de Mon profil, son urgence et sa durée de vie ; jamais « undefined » ni « 0 », jamais culpabilisant.
// Rien de vrai à dire (pas de chiffre, pas de titre) : rien, en arabe comme en français.
// Sans les nouvelles clés (file d'une base plus ancienne) : un texte quand même, la route du type et un tag égal au type.
// Dans la file (jobPush passe l'identifiant de la ligne) : un tag par élément ou un tag fixe ne change jamais.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MODULE, SITE, uid } from './banc.mjs';

const N = await import(MODULE);
const logic = await import('../../src/logic.js');
const t = (k, d, l = 'fr') => N.texteNotif(k, d, l, SITE);
const CULPABILISANT = /oubli|manqu|dommage|urgent|vite|dépêche|tu n.as pas|personne ne|déçu|نسيت|فات|عاجل|بسرعة/i;
const FSI = '\u2068', PDI = '\u2069';
const DEMAIN = '2026-11-03T10:00:00Z';   // mardi 3 novembre, 10:00 au Maroc (GMT depuis le 20 septembre 2026)
const M = uid(9301), DE = uid(9302), MSG = uid(9303), EV = uid(9304), CAFE = uid(9305), OFFRE = uid(9306), D = uid(9307), Q = uid(9308),
  ANS = uid(9309), PL = uid(9310);
const H = 3600;

// type : [data (n : le vrai compte), route, tag, case de Mon profil, urgence, durée de vie]
const CAS = {
  rdv_demain: [n => ({ nom: 'Youssef Alami', sujet: 'Relire mon CV', rdv_at: DEMAIN, m: M, n }), 'mentorat', `mentorat-${M}`, 'mentorat', 'high', 4 * H],
  entretien_demain: [n => ({ nom: 'Salma', rdv_at: DEMAIN, duree: 30, lieu: '', visio: true, m: MSG, de: DE, n }), `messages/${DE}`, `rappel_entretien-${MSG}`, 'messages', 'high', 4 * H],
  agenda_demain: [n => ({ type: 'evenement', titre: 'Forum entreprises', debut: DEMAIN, lieu: 'Amphi A', inscrits: 12, id: EV, n }), `reseau/agenda/${EV}`, `evenement-${EV}`, 'reseau', 'high', 4 * H],
  apres_rdv: [() => ({ nom: 'Youssef', sujet: 'Relire mon CV', m: M, pour: 'demandeur' }), 'mentorat', `mentorat-${M}`, 'mentorat', 'high', 24 * H],
  offre_bientot: [() => ({ titre: 'Stage lean', entreprise: 'OCP', date_limite: '2026-11-03', offre: OFFRE, jours: 2 }), `offre/${OFFRE}`, `offre-${OFFRE}`, 'offres', 'high', 12 * H],
  demande_attente: [() => ({ nom: 'Hiba', type: 'pfe', titre: 'PFE supply chain', demande: D }), `aider/${D}`, `demande_nouvelle-${D}`, 'demandes', 'high', 24 * H],
  semaine: [n => ({ type: 'etudiant', offres: n, laureats: 2, promo: 0, evenements: 1 }), 'accueil', 'semaine', 'rappels', 'normal', 12 * H],
  reponse_utile: [n => ({ nom: 'Amine', titre: 'Où trouver un stage ouvrier ?', q: Q, answer: ANS, n, best: false }), `reseau/entraide/${Q}`, `reponse_utile-${ANS}`, 'reseau', 'high', 24 * H],
  bravo: [n => ({ nom: 'Nadia', entreprise: 'OCP', placement: PL, n }), 'accueil', `bravo-${PL}`, 'reseau', 'high', 24 * H],
  demande_pause: [() => ({ titre: 'Stage en BTP', demande: D }), `offres/demandes/${D}`, `demande_pause-${D}`, 'demandes', 'normal', 24 * H],
  mentorat_presence: [() => ({ nom: 'Salma', sujet: 'Relire mon CV', rdv_at: DEMAIN, m: M }), 'mentorat', `mentorat-${M}`, 'mentorat', 'high', 24 * H],
  groupe_jour: [n => ({ n, groupe: 'Génie industriel', gkey: 'filiere:genie industriel', autres: 2 }), `reseau/groupes/${encodeURIComponent('filiere:genie industriel')}`, 'groupe-filiere:genie industriel', 'reseau', 'normal', 12 * H],
};

test('chaque nouveau type : français et arabe, n = 1, 2, 12, tag et route du contrat, sa case, son urgence, sa durée de vie', () => {
  for (const [kind, [data, route, tag, cat, urg, vie]] of Object.entries(CAS)) {
    assert.equal(logic.pushCategorie(kind), cat, kind);
    assert.equal(N.urgence(kind), urg, kind);
    assert.equal(N.dureeVie(kind), vie, kind);
    for (const n of [1, 2, 12]) for (const l of ['fr', 'ar']) {
      const x = t(kind, data(n), l), quoi = `${kind} ${l} n=${n}`;
      assert.ok(x, quoi);
      assert.equal(x.url, SITE + '#' + route, quoi);
      assert.equal(x.tag, tag, quoi);
      assert.ok(x.title.length > 3 && x.body.length > 3 && x.title.length <= 80 && x.body.length <= 180, quoi);
      assert.doesNotMatch(x.title + x.body, /undefined|null|NaN|\[object|\$\{/, quoi);
      assert.doesNotMatch(x.title + x.body, /(^|[^\d:])0(?![\d:])/, quoi + ' : jamais « 0 »');
      assert.doesNotMatch(x.title + x.body, CULPABILISANT, quoi);
      if (l === 'ar') {
        assert.match(x.title + x.body, /[؀-ۿ]/, quoi);
        assert.doesNotMatch(x.title + x.body, /القدامى|متدربين/, quoi);
      } else assert.doesNotMatch(x.title + x.body, /[\u2068\u2069]/, quoi);
      // Un vrai nombre au-delà de 2 est écrit, en chiffres latins
      if (n === 12 && 'n' in data(n)) assert.match(x.title + x.body, /12/, quoi);
    }
  }
});

test('la veille : rendez-vous de mentorat demain, à l’heure du Maroc ; plusieurs, le premier en détail', () => {
  const d = CAS.rdv_demain[0];
  assert.deepEqual([t('rdv_demain', d(1)).title, t('rdv_demain', d(1)).body], ['Demain à 10:00 : rendez-vous avec Youssef Alami', 'Relire mon CV. Un rappel arrive 15 minutes avant.']);
  assert.deepEqual([t('rdv_demain', d(2)).title, t('rdv_demain', d(2)).body], ['Demain : 2 rendez-vous', 'Le premier à 10:00 avec Youssef Alami : Relire mon CV. Un rappel arrive 15 minutes avant chacun.']);
  assert.deepEqual([t('rdv_demain', d(1), 'ar').title, t('rdv_demain', d(1), 'ar').body], [`غدًا على الساعة 10:00: موعد مع ${FSI}Youssef Alami${PDI}`, `${FSI}Relire mon CV${PDI}. يصلك تذكير قبل 15 دقيقة.`]);
  assert.equal(t('rdv_demain', d(2), 'ar').title, 'غدًا: موعدان');
  assert.equal(t('rdv_demain', d(3), 'ar').title, 'غدًا: 3 مواعيد');
  assert.equal(t('rdv_demain', d(12), 'ar').title, 'غدًا: 12 موعدًا');
  // Un sujet qui finit déjà par une ponctuation n'en reçoit pas une deuxième
  assert.equal(t('rdv_demain', { ...d(1), sujet: 'Quel PFE choisir ?' }).body, 'Quel PFE choisir ? Un rappel arrive 15 minutes avant.');
  // Le rappel de 15 minutes et la veille prennent la même ligne de la barre
  assert.equal(t('rappel_rdv', { nom: 'Youssef Alami', sujet: 'Relire mon CV', rdv_at: DEMAIN, m: M }).tag, t('rdv_demain', d(1)).tag);
});

test('la veille : entretien demain, « appel » pour 15 minutes, visio ou lieu ; même ligne que son rappel, ouvre la discussion', () => {
  const d = CAS.entretien_demain[0];
  assert.deepEqual([t('entretien_demain', d(1)).title, t('entretien_demain', d(1)).body], ['Demain à 10:00 : entretien avec Salma', '30 min · en visio. Le lien est dans votre discussion.']);
  const appel = t('entretien_demain', { ...d(1), duree: 15, visio: false, lieu: 'Siège OCP, Casablanca' });
  assert.deepEqual([appel.title, appel.body], ['Demain à 10:00 : appel avec Salma', '15 min · Siège OCP, Casablanca.']);
  assert.equal(t('entretien_demain', { ...d(1), duree: 0 }).body, 'En visio. Le lien est dans votre discussion.');
  assert.deepEqual([t('entretien_demain', d(2)).title, t('entretien_demain', d(2)).body], ['Demain : 2 rendez-vous', 'Le premier à 10:00 : entretien avec Salma · 30 min · en visio. Le lien est dans votre discussion.']);
  const ar = t('entretien_demain', { ...d(1), duree: 15 }, 'ar');
  assert.deepEqual([ar.title, ar.body], [`غدًا على الساعة 10:00: مكالمة مع ${FSI}Salma${PDI}`, '15 دقيقة · عبر الفيديو. الرابط في محادثتكما.']);
  assert.equal(t('entretien_demain', d(1), 'ar').title, `غدًا على الساعة 10:00: مقابلة مع ${FSI}Salma${PDI}`);
  assert.equal(t('entretien_demain', d(1)).tag, t('rappel_entretien', { nom: 'Salma', de: DE, m: MSG, rdv_at: DEMAIN }).tag);
});

test('la veille : événement ou café de demain où je suis inscrit ; inscrits dits à partir de 2 ; un café ouvre les groupes', () => {
  const d = CAS.agenda_demain[0];
  assert.deepEqual([t('agenda_demain', d(1)).title, t('agenda_demain', d(1)).body], ['Demain à 10:00 : Forum entreprises', 'Amphi A · 12 inscrits · Ta participation est notée.']);
  assert.equal(t('agenda_demain', { ...d(1), inscrits: 1 }).body, 'Amphi A · Ta participation est notée.', 'un seul inscrit : pas de chiffre');
  assert.equal(t('agenda_demain', { ...d(1), inscrits: 0, lieu: '' }).body, 'Ta participation est notée.');
  assert.deepEqual([t('agenda_demain', d(2)).title, t('agenda_demain', d(2)).body], ['Demain : 2 rendez-vous de l’agenda', 'Le premier à 10:00 : Forum entreprises · Amphi A.']);
  const cafe = { type: 'cafe', ville: 'Casablanca', debut: DEMAIN, lieu: 'Café Bianca, Maârif', inscrits: 5, id: CAFE, n: 1 };
  const c = t('agenda_demain', cafe);
  assert.deepEqual([c.title, c.body, c.url, c.tag], ['Demain à 10:00 : Café ENSAM à Casablanca', 'Café Bianca, Maârif · 5 inscrits · Ta participation est notée.', SITE + '#reseau/groupes', `cafe-${CAFE}`]);
  assert.equal(t('agenda_demain', cafe, 'ar').title, `غدًا على الساعة 10:00: مقهى ENSAM في ${FSI}Casablanca${PDI}`);
  assert.equal(t('agenda_demain', cafe, 'ar').body, `${FSI}Café Bianca, Maârif${PDI} · عدد المسجلين: 5 · حضورك مسجّل.`);
  assert.equal(t('agenda_demain', d(2), 'ar').title, 'غدًا: موعدان في الأجندة');
  // La veille reprend la ligne de l'annonce de l'événement, et celle du café
  assert.equal(t('agenda_demain', d(1)).tag, t('evenement', { titre: 'Forum entreprises', id: EV }).tag);
  assert.equal(c.tag, t('cafe', { ville: 'Casablanca', lieu: 'x', id: CAFE }).tag);
  // Sans titre ni ville, rien à dire : pas de notification vide, en arabe non plus
  for (const l of ['fr', 'ar']) {
    assert.equal(t('agenda_demain', { type: 'evenement', debut: DEMAIN, id: EV, n: 1 }, l), null, l);
    assert.equal(t('agenda_demain', { type: 'evenement', debut: DEMAIN, id: EV, n: 2 }, l), null, `${l} n = 2`);
  }
});

test('après un rendez-vous : un merci possible pour l’étudiant, le marquer terminé pour le lauréat', () => {
  const e = t('apres_rdv', CAS.apres_rdv[0]()), l = t('apres_rdv', { nom: 'Salma', sujet: 'Relire mon CV', m: M, pour: 'mentor' });
  assert.deepEqual([e.title, e.body], ['Comment s’est passé ton échange avec Youssef ?', 'Relire mon CV. Tu peux lui laisser un merci en un clic.']);
  assert.deepEqual([l.title, l.body, l.tag], ['Ton rendez-vous avec Salma a eu lieu ?', 'Tu peux le marquer comme terminé en un geste.', `mentorat-${M}`]);
  const ea = t('apres_rdv', CAS.apres_rdv[0](), 'ar'), la = t('apres_rdv', { nom: 'Salma', m: M, pour: 'mentor' }, 'ar');
  assert.deepEqual([ea.title, ea.body], [`كيف كان لقاؤك مع ${FSI}Youssef${PDI}؟`, `${FSI}Relire mon CV${PDI}. يمكنك ترك رسالة شكر بنقرة واحدة.`]);
  assert.deepEqual([la.title, la.body], [`هل تمّ موعدك مع ${FSI}Salma${PDI}؟`, 'يمكنك تأكيد انتهائه بنقرة واحدة.']);
  // « pour » inconnu : un texte neutre, jamais vide
  assert.deepEqual([t('apres_rdv', { nom: 'Salma', m: M }).title, t('apres_rdv', { nom: 'Salma', m: M }).body], ['Ton rendez-vous avec Salma', 'La suite est dans Mentorat.']);
});

test('offre mise de côté qui ferme : demain ou dans 2 jours, la date limite du Maroc ; plusieurs, une seule ligne groupée', () => {
  const d = CAS.offre_bientot[0]();
  assert.deepEqual([t('offre_bientot', d).title, t('offre_bientot', d).body], ['Ferme dans 2 jours : « Stage lean »', 'Tu l’as mise de côté · OCP. Date limite : mardi 3 novembre.']);
  assert.equal(t('offre_bientot', { ...d, jours: 1, date_limite: '2026-11-02' }).title, 'Ferme demain : « Stage lean »');
  assert.equal(t('offre_bientot', { ...d, jours: undefined }).title, 'Ferme bientôt : « Stage lean »');
  assert.equal(t('offre_bientot', { ...d, date_limite: null }).body, 'Tu l’as mise de côté · OCP.');
  const ar = t('offre_bientot', d, 'ar');
  assert.deepEqual([ar.title, ar.body], [`يُغلق بعد يومين: «${FSI}Stage lean${PDI}»`, `عرض حفظته · ${FSI}OCP${PDI}. آخر أجل: الثلاثاء، 3 نونبر.`]);
  assert.equal(t('offre_bientot', { ...d, jours: 1 }, 'ar').title, `يُغلق غدًا: «${FSI}Stage lean${PDI}»`);
  // La même ligne que l'annonce de l'offre (offre_alerte)
  assert.equal(t('offre_bientot', d).tag, t('offre_alerte', { titre: 'Stage lean', offre: OFFRE }).tag);
  for (const [n, fr, ar2] of [[2, '2 offres mises de côté ferment bientôt', 'عرضان محفوظان يُغلقان قريبًا'], [3, '3 offres mises de côté ferment bientôt', '3 عروض محفوظة تُغلق قريبًا'],
    [12, '12 offres mises de côté ferment bientôt', '12 عرضًا محفوظًا يُغلق قريبًا']]) {
    const g = t('offre_bientot', { n, groupe: true });
    assert.deepEqual([g.title, g.body, g.url, g.tag], [fr, 'Leur date limite tombe dans les prochains jours.', SITE + '#offres', 'offre_bientot']);
    assert.equal(t('offre_bientot', { n, groupe: true }, 'ar').title, ar2);
  }
  // Groupée d'une seule offre, ou sans titre : pas de faux groupe, pas de notification vide, en arabe non plus
  for (const l of ['fr', 'ar']) {
    assert.equal(t('offre_bientot', { n: 1, groupe: true }, l), null, l);
    assert.equal(t('offre_bientot', { offre: OFFRE, jours: 1, entreprise: 'OCP', date_limite: '2026-11-03' }, l), null, `${l} sans titre`);
  }
  assert.equal(t('offre_bientot', { ...d, n: 1, groupe: true }).tag, `offre-${OFFRE}`);
});

test('offre mise de côté qui ferme : l’échéance en tête du titre, même avec un long titre d’offre (coupé à 80, elle reste)', () => {
  // 83 caractères (offers.titre en accepte 140) : la fin du titre est coupée, jamais « demain »
  const long = 'Stage PFE – Ingénieur méthodes et amélioration continue (H/F) – Usine de Tanger Med';
  assert.equal(Array.from(long).length, 83);
  const d = { ...CAS.offre_bientot[0](), titre: long };
  for (const [jours, fr, ar] of [[1, 'Ferme demain', 'يُغلق غدًا'], [2, 'Ferme dans 2 jours', 'يُغلق بعد يومين'],
    [5, 'Ferme dans 5 jours', 'يُغلق بعد 5 أيام'], [undefined, 'Ferme bientôt', 'يُغلق قريبًا']]) {
    const f = t('offre_bientot', { ...d, jours }).title, a = t('offre_bientot', { ...d, jours }, 'ar').title;
    assert.ok(f.startsWith(`${fr} : « Stage PFE – Ingénieur méthodes`) && f.endsWith('…') && Array.from(f).length <= 80, f);
    assert.ok(a.startsWith(`${ar}: «${FSI}Stage PFE – Ingénieur méthodes`) && a.endsWith('…') && Array.from(a).length <= 80, a);
  }
});

test('demande toujours sans aide (lauréats du parcours) ; demande mise en pause (son auteur)', () => {
  const a = t('demande_attente', CAS.demande_attente[0]());
  assert.deepEqual([a.title, a.body], ['Hiba cherche toujours un PFE', 'Sa demande « PFE supply chain » est encore ouverte. Un conseil ou un contact peut l’aider.']);
  assert.equal(t('demande_attente', { nom: 'Hiba', type: 'emploi', titre: 'T', demande: D }).title, 'Hiba cherche toujours un emploi');
  assert.equal(t('demande_attente', { nom: 'Hiba', titre: 'T', demande: D }).title, 'Hiba cherche toujours de l’aide');
  const aa = t('demande_attente', CAS.demande_attente[0](), 'ar');
  assert.deepEqual([aa.title, aa.body], ['طلب من مسارك لا يزال مفتوحًا', `${FSI}Hiba${PDI} · مشروع نهاية الدراسة: «${FSI}PFE supply chain${PDI}». نصيحة أو جهة اتصال قد تكفي.`]);
  // Elle reprend la ligne de la publication et ouvre « Je peux aider »
  const pub = t('demande_nouvelle', { nom: 'Hiba', type: 'pfe', titre: 'PFE supply chain', demande: D });
  assert.deepEqual([a.tag, a.url], [pub.tag, pub.url]);
  const p = t('demande_pause', CAS.demande_pause[0]());
  assert.deepEqual([p.title, p.body], ['Ta demande est en pause', '« Stage en BTP » : tu peux la relancer en un clic si tu cherches toujours.']);
  const pa = t('demande_pause', CAS.demande_pause[0](), 'ar');
  assert.deepEqual([pa.title, pa.body], ['طلبك متوقف مؤقتًا', `«${FSI}Stage en BTP${PDI}»: يمكنك إعادة إطلاقه بنقرة واحدة إن كنت لا تزال تبحث.`]);
  assert.equal(t('demande_pause', { demande: D }).body, 'Tu peux la relancer en un clic si tu cherches toujours.');
});

test('résumé du dimanche : 3 vrais comptes au plus, dans l’ordre du rôle, jamais un zéro ; aucun compte, rien', () => {
  const etu = t('semaine', { type: 'etudiant', offres: 4, laureats: 2, promo: 0, evenements: 1, demandes: 3 });
  assert.deepEqual([etu.title, etu.body, etu.url, etu.tag], ['Ta semaine sur le Réseau ENSAM', '4 nouvelles offres pour toi · 2 nouveaux lauréats de ta filière · 1 événement cette semaine.', SITE + '#accueil', 'semaine']);
  assert.equal(t('semaine', { type: 'etudiant', offres: 4, laureats: 2, promo: 0, evenements: 1 }, 'ar').body, '4 عروض جديدة تخصك · خريجان جديدان من شعبتك · نشاط واحد هذا الأسبوع.');
  const lau = t('semaine', { type: 'laureat', demandes: 12, offres: 1, promo: 5, evenements: 2, laureats: 3 });
  assert.equal(lau.body, '12 nouvelles demandes d’étudiants de ton parcours · 1 nouvelle offre dans ta filière · 5 nouveaux membres dans ta promo.');
  assert.equal(t('semaine', { type: 'laureat', demandes: 12, offres: 1, promo: 5 }, 'ar').body, '12 طلب مساعدة جديدًا من طلبة مسارك · عرض جديد في شعبتك · 5 أعضاء جدد في دفعتك.');
  assert.equal(t('semaine', { type: 'laureat', demandes: 12, offres: 1, promo: 5 }, 'ar').title, 'أسبوعك على شبكة ENSAM');
  assert.equal(t('semaine', { type: 'etudiant', evenements: 1 }).body, '1 événement cette semaine.');
  assert.equal(t('semaine', { type: 'etudiant', promo: 2 }, 'ar').body, 'عضوان جديدان في دفعتك.');
  // Tout à zéro, absent ou douteux : rien n'est envoyé
  for (const d of [{ type: 'etudiant' }, { type: 'laureat', offres: 0, demandes: 0 }, { type: 'etudiant', offres: -3, promo: 'x', laureats: 1.5 }, null])
    for (const l of ['fr', 'ar']) assert.equal(t('semaine', d, l), null, JSON.stringify(d));
});

test('réponse utile : un vote (n membres), ou la meilleure réponse choisie ; une ligne par réponse', () => {
  const d = CAS.reponse_utile[0];
  assert.deepEqual([t('reponse_utile', d(1)).title, t('reponse_utile', d(1)).body], ['Ta réponse est utile', 'Amine l’a trouvée utile : Où trouver un stage ouvrier ?']);
  assert.equal(t('reponse_utile', d(12)).body, '12 membres l’ont trouvée utile : Où trouver un stage ouvrier ?');
  const best = t('reponse_utile', { ...d(3), best: true });
  assert.deepEqual([best.title, best.body], ['Ta réponse a été choisie', 'Amine l’a choisie comme meilleure réponse : Où trouver un stage ouvrier ?']);
  assert.equal(t('reponse_utile', d(1), 'ar').body, `تصويت من ${FSI}Amine${PDI} على جوابك: ${FSI}Où trouver un stage ouvrier ?${PDI}`);
  assert.equal(t('reponse_utile', d(2), 'ar').body, `تصويتان على جوابك: ${FSI}Où trouver un stage ouvrier ?${PDI}`);
  assert.equal(t('reponse_utile', d(12), 'ar').body, `12 تصويتًا على جوابك: ${FSI}Où trouver un stage ouvrier ?${PDI}`);
  assert.deepEqual([t('reponse_utile', { ...d(1), best: true }, 'ar').title, t('reponse_utile', { ...d(1), best: true }, 'ar').body],
    ['اختيار أفضل جواب', `اختيار جوابك كأفضل جواب من طرف ${FSI}Amine${PDI}: ${FSI}Où trouver un stage ouvrier ?${PDI}`]);
  // « best » doit être un vrai booléen
  assert.equal(t('reponse_utile', { ...d(1), best: 'true' }).title, 'Ta réponse est utile');
});

test('bravo : un bravo, puis le nombre de bravos sur la même réussite (une ligne par réussite)', () => {
  const d = CAS.bravo[0];
  assert.deepEqual([t('bravo', d(1)).title, t('bravo', d(1)).body], ['Nadia te dit bravo', 'Pour ta réussite chez OCP.']);
  assert.deepEqual([t('bravo', d(2)).title, t('bravo', d(2)).body], ['2 bravos pour ta réussite chez OCP', 'Nadia et un autre membre te félicitent.']);
  assert.equal(t('bravo', d(12)).body, 'Nadia et 11 autres membres te félicitent.');
  assert.deepEqual([t('bravo', d(1), 'ar').title, t('bravo', d(1), 'ar').body], [`تهنئة من ${FSI}Nadia${PDI}`, `على نجاحك لدى ${FSI}OCP${PDI}.`]);
  assert.equal(t('bravo', d(2), 'ar').title, `تهنئتان على نجاحك لدى ${FSI}OCP${PDI}`);
  assert.equal(t('bravo', d(3), 'ar').title, `3 تهانٍ على نجاحك لدى ${FSI}OCP${PDI}`);
  assert.equal(t('bravo', d(12), 'ar').title, `12 تهنئةً على نجاحك لدى ${FSI}OCP${PDI}`);
  assert.equal(t('bravo', { nom: 'Nadia', placement: PL }).body, 'Pour ta réussite.');
});

test('présence confirmée : au lauréat, le sujet et l’horaire du Maroc, sur la ligne du mentorat', () => {
  const p = t('mentorat_presence', CAS.mentorat_presence[0]());
  assert.deepEqual([p.title, p.body], ['Salma a confirmé sa présence', 'Relire mon CV · mardi 3 novembre à 10:00.']);
  const ar = t('mentorat_presence', CAS.mentorat_presence[0](), 'ar');
  assert.equal(ar.title, `تأكيد الحضور من ${FSI}Salma${PDI}`);
  assert.match(ar.body, /الثلاثاء/); assert.match(ar.body, /على الساعة 10:00\.$/);
  assert.equal(t('mentorat_presence', { nom: 'Salma', m: M }).body, 'Le rendez-vous est confirmé.');
  assert.equal(t('mentorat_presence', { nom: 'Salma', m: M }, 'ar').body, 'الموعد مؤكد.');
});

test('messages des groupes : le groupe le plus actif, les autres comptés ; le lien ouvre ce groupe', () => {
  const d = CAS.groupe_jour[0];
  assert.deepEqual([t('groupe_jour', d(1)).title, t('groupe_jour', d(1)).body], ['1 nouveau message dans le groupe Génie industriel', 'Et du nouveau dans 2 autres groupes.']);
  assert.equal(t('groupe_jour', d(12)).title, '12 nouveaux messages dans le groupe Génie industriel');
  assert.equal(t('groupe_jour', { ...d(2), autres: 1 }).body, 'Et du nouveau dans un autre de tes groupes.');
  assert.equal(t('groupe_jour', { ...d(2), autres: 0 }).body, 'À lire quand tu as un moment.');
  assert.equal(t('groupe_jour', d(1), 'ar').title, `رسالة جديدة في مجموعة ${FSI}Génie industriel${PDI}`);
  assert.equal(t('groupe_jour', d(2), 'ar').title, `رسالتان جديدتان في مجموعة ${FSI}Génie industriel${PDI}`);
  assert.equal(t('groupe_jour', d(12), 'ar').title, `12 رسالة جديدة في مجموعة ${FSI}Génie industriel${PDI}`);
  assert.equal(t('groupe_jour', d(2), 'ar').body, 'وجديد في مجموعتين أخريين.');
  assert.equal(t('groupe_jour', { ...d(2), autres: 5 }, 'ar').body, 'وجديد في 5 مجموعات أخرى.');
  assert.equal(t('groupe_jour', { ...d(2), autres: 0 }, 'ar').body, 'ألقِ نظرة متى سمح وقتك.');
  // Une ville avec un accent dans son nom affiché ; la clé est passée telle quelle, encodée dans le lien
  const v = t('groupe_jour', { n: 3, groupe: 'Fès', gkey: 'ville:fes', autres: 0 });
  assert.deepEqual([v.url, v.tag], [SITE + '#reseau/groupes/ville%3Afes', 'groupe-ville:fes']);
  // Rien à compter, ou pas de nom de groupe : rien, en arabe non plus (jamais « 0 رسالة ») ; une clé douteuse : la page des groupes
  for (const l of ['fr', 'ar']) {
    assert.equal(t('groupe_jour', { n: 0, groupe: 'Génie industriel', gkey: 'filiere:genie industriel', autres: 0 }, l), null, l);
    assert.equal(t('groupe_jour', { groupe: 'Génie industriel', gkey: 'filiere:genie industriel', autres: 2 }, l), null, `${l} sans n`);
    assert.equal(t('groupe_jour', { n: 2, gkey: 'filiere:genie industriel' }, l), null, `${l} sans nom`);
  }
  const k = t('groupe_jour', { n: 2, groupe: 'X', gkey: 'pas une clé\n' });
  assert.deepEqual([k.url, k.tag], [SITE + '#reseau/groupes', 'groupe_jour']);
});

test('base plus ancienne : sans les nouvelles clés, chaque nouveau type a un texte, la route du type et un tag égal au type', () => {
  const ROUTE_TYPE = {
    rdv_demain: 'mentorat', entretien_demain: 'messages', agenda_demain: 'reseau/agenda', apres_rdv: 'mentorat', demande_attente: 'offres/demandes',
    reponse_utile: 'reseau/entraide', bravo: 'accueil', demande_pause: 'offres/demandes', mentorat_presence: 'mentorat',
  };
  for (const [kind, route] of Object.entries(ROUTE_TYPE)) for (const l of ['fr', 'ar']) {
    const d = { nom: 'Salma', sujet: 'Relire mon CV', titre: 'Forum entreprises', rdv_at: DEMAIN, debut: DEMAIN, pour: 'mentor', type: 'evenement', n: 1 };
    const x = t(kind, d, l);
    assert.ok(x, `${kind} ${l}`);
    assert.deepEqual([x.url, x.tag], [SITE + '#' + route, kind], `${kind} ${l}`);
    assert.doesNotMatch(x.title + x.body, /undefined|null|NaN|\$\{/);
  }
  // Données vides ou absurdes : jamais de plantage ni de texte cassé
  for (const kind of [...Object.keys(CAS), 'match_jour', 'match_attente']) for (const d of [{}, null, { n: -1, inscrits: 'x', jours: 99, autres: -2, groupe: 3 }]) for (const l of ['fr', 'ar']) {
    const x = t(kind, d, l);
    if (x) assert.doesNotMatch(x.title + x.body, /undefined|null|NaN|\[object|\$\{|(^|[^\d:])0(?![\d:])/, `${kind} ${JSON.stringify(d)} ${l}`);
  }
});

test('rien de vrai à dire : la même décision en français et en arabe, pour chaque type et chaque donnée absente, vide ou à 0', () => {
  // Une donnée complète, puis chacune de ses clés retirée, vide ou à 0 : jamais une notification en arabe quand le
  // français n'a rien de vrai à dire (« 0 رسالة جديدة », « غدًا على الساعة 10:00:  », «» sans titre), ni l'inverse
  const riche = {
    nom: 'Salma', titre: 'Forum entreprises', sujet: 'Relire mon CV', n: 2, groupe: 'Génie industriel', gkey: 'filiere:genie industriel', autres: 1,
    type: 'evenement', debut: DEMAIN, rdv_at: DEMAIN, date_at: DEMAIN, id: EV, offre: OFFRE, jours: 1, ville: 'Casablanca', lieu: 'Amphi A', inscrits: 5,
    de: DE, m: M, demande: D, q: Q, answer: ANS, best: true, entreprise: 'OCP', placement: PL, date_limite: '2026-11-03', texte: 'Bonjour', duree: 30,
    visio: true, pour: 'demandeur', statut: 'entretien', vague: 6, cible: 'OCP', motif: 'spam', r: uid(9311), c: uid(9312), p: uid(9313),
    messages: 2, matchs: 1, offres: 2, laureats: 1, promo: 2, evenements: 1, demandes: 3,
  };
  const bases = [riche, { ...riche, type: 'cafe' }, { ...riche, groupe: true, n: 3 }, { ...riche, type: 'etudiant' }, { ...riche, type: 'laureat' },
    { ...riche, pour: 'mentor' }, { ...riche, n: 1 }, { ...riche, n: 12 }, ...Object.values(CAS).map(([data]) => data(1))];
  const kinds = [...new Set([...Object.keys(logic.PUSH_KINDS), ...Object.keys(CAS), 'rappel_visite', 'test'])];
  let essais = 0;
  for (const kind of kinds) for (const base of bases) for (const k of [null, ...Object.keys(base)]) for (const vide of k ? [undefined, 0, ''] : [undefined]) {
    const d = { ...base };
    if (k) { if (vide === undefined) delete d[k]; else d[k] = vide; }
    const fr = t(kind, d, 'fr'), ar = t(kind, d, 'ar');
    assert.equal(fr === null, ar === null, `${kind}, ${k ? `${k} = ${String(vide)}` : 'complet'} : ${fr === null ? 'rien en français, une notification en arabe' : 'rien en arabe, une notification en français'}`);
    essais++;
  }
  assert.ok(kinds.length > 50 && essais > 50000, `${kinds.length} types, ${essais} essais`);
});

test('types existants : un tag et une route par élément quand la clé est là ; sans elle, l’ancien comportement', () => {
  const O1 = uid(9401), O2 = uid(9402), P = uid(9403), R = uid(9404), C = uid(9405), AN = uid(9406), SG = uid(9407), V = uid(9408);
  // type : [data sans la clé, clé ajoutée par la base, route avec, tag avec, route sans (celle d'avant)]
  const ELEMENTS = {
    candidature: [{ nom: 'Salma', titre: 'Stage lean' }, { offre: O1 }, `offre/${O1}`, `candidature-${O1}`, 'espace'],
    candidature_statut: [{ titre: 'Stage lean', statut: 'entretien' }, { offre: O1 }, 'parcours', `candidature_statut-${O1}`, 'parcours'],
    invitation: [{ nom: 'Youssef', titre: 'Stage lean' }, { offre: O1 }, `offre/${O1}`, `invitation-${O1}`, 'offres'],
    recrutement_a_confirmer: [{ nom: 'Youssef', entreprise: 'OCP' }, { p: P }, 'parcours', `recrutement-${P}`, 'parcours'],
    recrutement_confirme: [{ nom: 'Salma', entreprise: 'OCP' }, { p: P }, 'espace', `recrutement-${P}`, 'espace'],
    relance_offre: [{ titre: 'Stage lean' }, { offre: O1 }, `offre/${O1}`, `relance_offre-${O1}`, 'offres'],
    reponse: [{ nom: 'Nadia', titre: 'Visa ?' }, { q: Q }, `reseau/entraide/${Q}`, `reponse-${Q}`, 'reseau/entraide'],
    question_routee: [{ cible: 'OCP', titre: 'Visa ?' }, { q: Q }, `reseau/entraide/${Q}`, `question_routee-${Q}`, 'reseau/entraide'],
    evenement: [{ titre: 'Forum', date_at: DEMAIN }, { id: EV }, `reseau/agenda/${EV}`, `evenement-${EV}`, 'reseau/agenda'],
    evenement_annule: [{ titre: 'Forum' }, { id: EV }, `reseau/agenda/${EV}`, `evenement-${EV}`, 'reseau/agenda'],
    evenement_deplace: [{ titre: 'Forum', date_at: DEMAIN }, { id: EV }, `reseau/agenda/${EV}`, `evenement-${EV}`, 'reseau/agenda'],
    cafe: [{ ville: 'Casablanca', lieu: 'Bianca', date_at: DEMAIN }, { id: CAFE }, 'reseau/groupes', `cafe-${CAFE}`, 'reseau/groupes'],
    mentorat_demande: [{ nom: 'Salma', sujet: 'CV' }, { m: M }, 'mentorat', `mentorat-${M}`, 'mentorat'],
    mentorat_accepte: [{ nom: 'Youssef', sujet: 'CV', rdv_at: DEMAIN }, { m: M }, 'mentorat', `mentorat-${M}`, 'mentorat'],
    mentorat_deplace: [{ nom: 'Youssef', sujet: 'CV', rdv_at: DEMAIN }, { m: M }, 'mentorat', `mentorat-${M}`, 'mentorat'],
    mentorat_annule: [{ nom: 'Salma', sujet: 'CV', pour: 'mentor' }, { m: M }, 'mentorat', `mentorat-${M}`, 'mentorat'],
    rappel_rdv: [{ nom: 'Youssef', sujet: 'CV', rdv_at: DEMAIN }, { m: M }, 'mentorat', `mentorat-${M}`, 'mentorat'],
    merci: [{ nom: 'Salma' }, { m: M }, 'espace', `mentorat-${M}`, 'espace'],
    mentorat_ouvert: [{ nom: 'Hiba', sujet: 'CV' }, { m: M }, 'mentorat', `mentorat_ouvert-${M}`, 'mentorat'],
    relecture_demande: [{ nom: 'Salma' }, { r: R }, 'mentorat/cv', `relecture-${R}`, 'mentorat/cv'],
    relecture_prise: [{ nom: 'Youssef' }, { r: R }, 'mentorat/cv', `relecture-${R}`, 'mentorat/cv'],
    relecture_rendue: [{ nom: 'Youssef' }, { r: R }, 'mentorat/cv', `relecture-${R}`, 'mentorat/cv'],
    contact_demande: [{ nom: 'Salma' }, { c: C }, 'accueil', `contact-${C}`, 'accueil'],
    contact_accepte: [{ nom: 'Youssef' }, { c: C }, 'accueil', `contact-${C}`, 'accueil'],
    verifier_pair: [{ nom: 'Karim', promo: 2021 }, { de: V }, 'accueil', `verifier_pair-${V}`, 'accueil'],
    annonce: [{ texte: 'Forum jeudi à 10 h' }, { id: AN }, 'accueil', `annonce-${AN}`, 'accueil'],
    signalement: [{ motif: 'spam' }, { id: SG }, 'admin/moderation', `signalement-${SG}`, 'admin/moderation'],
    demande_proposition: [{ nom: 'Youssef', entreprise: 'OCP', titre: 'PFE' }, { demande: D, n: 2 }, `offres/demandes/${D}`, `demande_proposition-${D}`, 'offres/demandes'],
  };
  for (const [kind, [d, cle, route, tag, avant]] of Object.entries(ELEMENTS)) for (const l of ['fr', 'ar']) {
    const avec = t(kind, { ...d, ...cle }, l), sans = t(kind, d, l);
    assert.deepEqual([avec.url, avec.tag], [SITE + '#' + route, tag], `${kind} ${l} avec ${Object.keys(cle)}`);
    assert.deepEqual([sans.url, sans.tag], [SITE + '#' + avant, kind], `${kind} ${l} sans la clé`);
    // Une valeur qui n'est pas un identifiant est ignorée
    const faux = t(kind, { ...d, ...Object.fromEntries(Object.keys(cle).filter(k => k !== 'n').map(k => [k, 'pas-un-id'])) }, l);
    assert.equal(faux.tag, kind, `${kind} ${l} : identifiant douteux`);
  }
  // Une relecture remerciée prend la ligne de la relecture
  assert.equal(t('merci', { nom: 'Salma', r: R }).tag, `relecture-${R}`);
  // Le rendez-vous annulé garde le lien direct « Proposer d'autres horaires » pour l'étudiant
  assert.equal(t('mentorat_annule', { nom: 'Youssef', sujet: 'CV', pour: 'demandeur', m: M }).url, `${SITE}#mentorat/reprendre/${M}`);
});

test('deux candidatures sur deux offres : deux lignes ; la deuxième sur la même offre : la même ligne, avec le compte', () => {
  const O1 = uid(9501), O2 = uid(9502);
  const a = t('candidature', { nom: 'Salma', titre: 'Stage lean', offre: O1, n: 1 }), b = t('candidature', { nom: 'Amine', titre: 'PFE data', offre: O2, n: 1 });
  assert.notEqual(a.tag, b.tag);
  assert.deepEqual([a.title, a.body, a.url], ['Nouvelle candidature', 'Salma a postulé : Stage lean', `${SITE}#offre/${O1}`]);
  const a2 = t('candidature', { nom: 'Imane', titre: 'Stage lean', offre: O1, n: 2 });
  assert.equal(a2.tag, a.tag, 'même offre : la suivante remplace');
  assert.deepEqual([a2.title, a2.body], ['2 candidatures sur « Stage lean »', 'Imane vient de postuler.']);
  assert.equal(t('candidature', { nom: 'Imane', titre: 'Stage lean', offre: O1, n: 12 }).title, '12 candidatures sur « Stage lean »');
  assert.equal(t('candidature', { nom: 'Imane', offre: O1, n: 3 }).title, '3 candidatures sur ton offre');
  const ar = n => t('candidature', { nom: 'Imane', titre: 'Stage lean', offre: O1, n }, 'ar');
  assert.deepEqual([ar(2).title, ar(2).body], [`ترشيحان على «${FSI}Stage lean${PDI}»`, `آخر ترشيح من ${FSI}Imane${PDI}.`]);
  assert.equal(ar(3).title, `3 ترشيحات على «${FSI}Stage lean${PDI}»`);
  assert.equal(ar(12).title, `12 ترشيحًا على «${FSI}Stage lean${PDI}»`);
  assert.equal(ar(1).title, 'ترشيح جديد');
  // Réponses à une question et propositions d'aide : le même regroupement, avec le compte
  assert.deepEqual([t('reponse', { nom: 'Nadia', titre: 'Visa ?', q: Q, n: 3 }).title, t('reponse', { nom: 'Nadia', titre: 'Visa ?', q: Q, n: 3 }).body],
    ['3 nouvelles réponses à ta question', 'Nadia a répondu en dernier : Visa ?']);
  assert.equal(t('reponse', { nom: 'Nadia', titre: 'Visa ?', q: Q, n: 2 }, 'ar').title, 'جوابان جديدان على سؤالك');
  assert.equal(t('reponse', { nom: 'Nadia', titre: 'Visa ?', q: Q, n: 12 }, 'ar').title, '12 جوابًا جديدًا على سؤالك');
  const prop = n => t('demande_proposition', { nom: 'Youssef', entreprise: 'OCP', titre: 'PFE lean', demande: D, n });
  assert.deepEqual([prop(2).title, prop(2).body], ['2 lauréats te proposent leur aide', 'Youssef (OCP) et un autre : PFE lean']);
  assert.deepEqual([prop(12).title, prop(12).body], ['12 lauréats te proposent leur aide', 'Youssef (OCP) et 11 autres : PFE lean']);
  assert.deepEqual([prop(1).title, prop(1).body], ['Un lauréat te propose son aide', 'Youssef (OCP) : PFE lean']);
  const propAr = n => t('demande_proposition', { nom: 'Youssef', titre: 'PFE lean', demande: D, n }, 'ar');
  assert.deepEqual([propAr(2).title, propAr(2).body], ['عرضا مساعدة من الخريجين', `آخرها من ${FSI}Youssef${PDI}: ${FSI}PFE lean${PDI}`]);
  assert.equal(propAr(12).title, '12 عرض مساعدة من الخريجين');
});

test('tags fixes : exactement la liste du contrat ; ces types gardent leur tag, la suivante remplace la précédente', () => {
  // Le filleul n'y est plus : chaque filleul est une personne de plus, il a sa ligne (filleul-<étudiant>, plus bas)
  assert.deepEqual([...N.TAGS_FIXES].sort(), ['enquete', 'match_attente', 'match_jour', 'offre_bientot', 'parrain', 'promo_nouveau', 'rappel_visite', 'semaine',
    'test', 'verification_pair'].sort());
  const exemples = {
    rappel_visite: { messages: 2 }, promo_nouveau: { nom: 'Chaimae', n: 2, promo: 2028 }, verification_pair: { nom: 'Karim', n: 1 }, enquete: { vague: 6 },
    parrain: { nom: 'Youssef' }, test: {}, semaine: { type: 'etudiant', offres: 2 }, match_jour: { n: 3, type: 'etudiant' },
    match_attente: { nom: 'Salma', de: DE, n: 3 }, offre_bientot: { n: 3, groupe: true },
  };
  for (const k of N.TAGS_FIXES) assert.equal(t(k, exemples[k]).tag, k, k);
  // Dans la file aussi (jobPush passe l'identifiant de la ligne) : le filet ne touche pas un tag fixe voulu
  for (const k of N.TAGS_FIXES) assert.equal(N.texteNotif(k, exemples[k], 'fr', SITE, 42).tag, k, `${k} dans la file`);
  // Le filleul : sa ligne (la clé filleul que la base écrit) ; sans elle (données d'avant), une ligne par notification,
  // jamais une ligne fixe où le deuxième filleul effacerait le premier
  const F = uid(9351);
  assert.ok(!N.SE_REMPLACENT.includes('filleul'));
  assert.equal(N.texteNotif('filleul', { nom: 'Amine', filleul: F }, 'fr', SITE, 42).tag, `filleul-${F}`);
  assert.equal(N.texteNotif('filleul', { nom: 'Amine', filleul: F }, 'ar', SITE, 43).tag, `filleul-${F}`);
  assert.deepEqual([42, 43].map(id => N.texteNotif('filleul', { nom: 'Amine' }, 'fr', SITE, id).tag), ['filleul-42', 'filleul-43']);
  // Chaque type classé dans Mon profil est connu : soit à tag fixe, soit avec un tag par élément quand la donnée le dit
  for (const k of N.TAGS_FIXES) assert.ok(k === 'test' || k in logic.PUSH_KINDS, k);
});

test('dans la file (identifiant de sa ligne) : un tag par élément ou un tag fixe ne change jamais ; le filet ne prend que ce qu’aucun élément ne regroupe', () => {
  const f = (k, d, id) => N.texteNotif(k, d, 'fr', SITE, id).tag;
  // Les nouveaux types, avec les clés du contrat : le tag du contrat, quelle que soit la ligne ; la suivante remplace la précédente
  for (const [kind, [data, , tag]] of Object.entries(CAS)) for (const n of [1, 2, 12]) {
    assert.equal(f(kind, data(n), 41), tag, `${kind} n = ${n}`);
    assert.equal(f(kind, data(n), 42), tag, `${kind} n = ${n}, ligne suivante`);
  }
  // Leurs variantes : un intérêt Match d'une personne, un café de demain
  assert.equal(f('match_attente', { nom: 'Salma', de: DE, n: 1, type: 'laureat' }, 43), `match_interet-${DE}`);
  assert.equal(f('agenda_demain', { type: 'cafe', ville: 'Casablanca', id: CAFE, n: 1 }, 44), `cafe-${CAFE}`);
  // Les tags fixes qui ne sont pas dans SE_REMPLACENT restent fixes : le résumé du dimanche, plusieurs intérêts Match en
  // attente, les offres mises de côté qui ferment ensemble (une seule ligne chacun, jamais une par jour)
  for (const [k, d] of [['semaine', { type: 'etudiant', offres: 2 }], ['match_attente', { nom: 'Salma', de: DE, n: 3, type: 'etudiant' }],
    ['offre_bientot', { n: 3, groupe: true }]]) {
    assert.ok(N.TAGS_FIXES.has(k) && !N.SE_REMPLACENT.includes(k), k);
    assert.deepEqual([f(k, d, 45), f(k, d, 46)], [k, k], k);
  }
  // Les propositions d'aide que la base compte (n) : une ligne par demande, qui se met à jour
  assert.equal(f('demande_proposition', { nom: 'Youssef', titre: 'PFE', demande: D, n: 2 }, 47), `demande_proposition-${D}`);
  // Ce qu'aucun élément ne regroupe (sans la clé, base plus ancienne) : une notification par ligne de file
  assert.equal(f('rdv_demain', { nom: 'Salma', sujet: 'CV', rdv_at: DEMAIN, n: 1 }, 48), 'rdv_demain-48');
  assert.equal(f('groupe_jour', { n: 2, groupe: 'Génie industriel', autres: 0 }, 49), 'groupe_jour-49');
});

test('chaque lien mène à un écran qui existe dans src/app.js (aucune route inventée)', () => {
  const app = fs.readFileSync(new URL('../../src/app.js', import.meta.url), 'utf8');
  const src = fs.readdirSync(new URL('../../src/', import.meta.url)).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(new URL('../../src/' + f, import.meta.url), 'utf8')).join('\n');
  const ROUTES = JSON.parse(app.match(/const ROUTES = (\[[^\]]+\]);/)[1].replace(/'/g, '"'));
  const routes = new Set();
  for (const [kind, [data]] of Object.entries(CAS)) for (const n of [1, 2]) routes.add(t(kind, data(n)).url.slice(SITE.length + 1));
  for (const d of [{ type: 'cafe', ville: 'Casablanca', id: CAFE, n: 1 }, { n: 2, groupe: true }]) routes.add(t(d.type === 'cafe' ? 'agenda_demain' : 'offre_bientot', d).url.slice(SITE.length + 1));
  for (const r of ['candidature', 'invitation', 'relance_offre']) routes.add(t(r, { nom: 'S', titre: 'T', offre: OFFRE }).url.slice(SITE.length + 1));
  for (const r of ['reponse', 'question_routee']) routes.add(t(r, { nom: 'S', titre: 'T', cible: 'OCP', q: Q }).url.slice(SITE.length + 1));
  routes.add(t('evenement', { titre: 'Forum', id: EV }).url.slice(SITE.length + 1));
  routes.add(t('match_attente', { nom: 'S', de: DE, n: 1 }).url.slice(SITE.length + 1));
  routes.add(t('match_jour', { n: 2, type: 'laureat' }).url.slice(SITE.length + 1));
  for (const r of routes) {
    const [base, sous] = r.split('/');
    assert.ok(ROUTES.includes(base), `${r} : écran ${base} inconnu de app.js`);
    if (sous && !/^[0-9a-f-]{36}$/.test(sous)) assert.ok(src.includes(`${base}/${sous}`), `${r} : ${base}/${sous} inconnu du site`);
  }
  // Les pages qui lisent l'identifiant à la fin du lien
  assert.match(fs.readFileSync(new URL('../../src/groupes.js', import.meta.url), 'utf8'), /if \(sub2\) return html`<\$\{GroupView\}/);
  assert.match(fs.readFileSync(new URL('../../src/community.js', import.meta.url), 'utf8'), /ctx\.sub2 && store\.byId\('questions', ctx\.sub2\)/);
  assert.match(fs.readFileSync(new URL('../../src/agenda.js', import.meta.url), 'utf8'), /mine\.find\(e => e\.id === sub2\)/);
  assert.match(app, /route\.base === 'offre' && route\.sub/);
  assert.match(app, /route\.base === 'aider' && route\.sub/);
});
