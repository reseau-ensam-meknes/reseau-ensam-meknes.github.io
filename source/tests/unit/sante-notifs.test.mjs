// Santé des notifications : « Tester » mis en forme (bilanTestPush, raisonTestPush), le panneau de l'administration
// (santeResume, raisonsNotifs : des phrases simples avec les vrais nombres, la plus urgente d'abord ; « envoyée » n'est pas
// « affichée » ; sans téléphone n'est pas une perte ; un service qui refuse tout accuse la clé, pas les téléphones), la démo
// (des totaux qui tombent juste, jamais un nom) et le store réel (abonner_push_etat qui répond 'ok' ou 'mort', avec repli
// sur abonner_push pour une base d'avant ; admin_sante_notifs absente).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bilanTestPush, raisonTestPush, testPushARefaire, dureeAttente, jourNotif, nomTypeNotif, NOMS_NOTIF, santeResume, raisonsNotifs,
  raisonsAvecPertes, etatCronNotifs, SERVICES_PUSH, TYPES_MAX_SN, REFUS_EN_MASSE_SN } from '../../src/logic.js';
import { SupabaseStore } from '../../src/store.js';

const NOW = Date.parse('2026-11-01T10:00:00Z');
const il_y_a = s => new Date(NOW - s * 1000).toISOString();

// ---------------------------------------------------------------------------
// « Tester »
// ---------------------------------------------------------------------------
test('bilanTestPush : la réponse de la fonction, mise en forme ; une ancienne fonction ne dit que { sent }', () => {
  assert.deepEqual(bilanTestPush({ sent: 1, failed: 2, removed: 0, codes: [201, 403, 0], abonnements: 3 }),
    { sent: 1, failed: 2, removed: 0, codes: [201, 403, 0], abonnements: 3 });
  assert.deepEqual(bilanTestPush({ sent: 0 }), { sent: 0, failed: 0, removed: 0, codes: [], abonnements: null }, 'ancienne fonction');
  assert.deepEqual(bilanTestPush(null), { sent: 0, failed: 0, removed: 0, codes: [], abonnements: null });
  assert.deepEqual(bilanTestPush({ sent: '2', failed: -1, removed: 'x', codes: ['410', null, 'abc'], abonnements: 0 }),
    { sent: 2, failed: 0, removed: 0, codes: [410, 0, 0], abonnements: 0 }, 'des nombres, jamais négatifs');
});

test('raisonTestPush : arrivé, aucun téléphone, parti, refusé, trop long, injoignable, ou inconnu (ancienne fonction)', () => {
  const r = d => raisonTestPush({ failed: 0, removed: 0, codes: [], abonnements: 1, ...d });
  assert.equal(r({ sent: 1, codes: [201] }), 'ok');
  assert.equal(r({ sent: 1, failed: 1, codes: [201, 410], abonnements: 2 }), 'ok', 'un téléphone sur deux suffit : l’essai est arrivé');
  assert.equal(r({ sent: 0, abonnements: 0 }), 'aucun');
  assert.equal(r({ sent: 0, failed: 1, removed: 1, codes: [410] }), 'parti');
  assert.equal(r({ sent: 0, failed: 1, codes: [404] }), 'parti');
  assert.equal(r({ sent: 0, failed: 1, codes: [403] }), 'refuse');
  assert.equal(r({ sent: 0, failed: 1, removed: 1, codes: [403] }), 'parti', 'troisième refus : l’abonnement vient d’être retiré');
  assert.equal(r({ sent: 0, failed: 1, codes: [413] }), 'trop');
  assert.equal(r({ sent: 0, failed: 1, codes: [0] }), 'injoignable');
  assert.equal(r({ sent: 0, failed: 2, codes: [503, 429], abonnements: 2 }), 'injoignable');
  assert.equal(raisonTestPush({ sent: 0 }), 'inconnu', 'ancienne fonction : on ne sait pas pourquoi');
  assert.equal(raisonTestPush({ sent: 1 }), 'ok');
  assert.deepEqual(['ok', 'aucun', 'parti', 'refuse', 'trop', 'injoignable', 'inconnu'].filter(testPushARefaire), ['parti', 'refuse']);
});

// ---------------------------------------------------------------------------
// Petites mises en forme
// ---------------------------------------------------------------------------
test('dureeAttente, jourNotif, nomTypeNotif', () => {
  assert.deepEqual([0, 30, 89, 540, 3599, 3600, 47 * 3600, 48 * 3600, 5 * 86400].map(dureeAttente),
    ['1 min', '1 min', '1 min', '9 min', '60 min', '1 h', '47 h', '2 jours', '5 jours']);
  assert.deepEqual(jourNotif('2026-10-26'), { court: '26', long: '26 octobre' });
  assert.deepEqual(jourNotif('2026-11-01'), { court: '1', long: '1 novembre' }, 'en UTC, comme la base');
  assert.deepEqual(jourNotif('pas une date'), { court: '', long: '' });
  assert.deepEqual(nomTypeNotif('match_jour'), { nom: 'Match du jour', connu: true });
  assert.deepEqual(nomTypeNotif('test'), { nom: 'Essai (Tester)', connu: true });
  assert.deepEqual(nomTypeNotif('un_type_futur'), { nom: 'Vie du réseau', connu: false }, 'un type inconnu : le nom de sa catégorie');
  assert.ok(Object.values(NOMS_NOTIF).every(n => typeof n === 'string' && n.length > 2));
  // Les types des nouvelles notifications (programmées, et entre personnes) ont leur nom, pas celui de leur catégorie
  for (const k of ['rdv_demain', 'entretien_demain', 'agenda_demain', 'apres_rdv', 'mentorat_presence', 'match_attente', 'offre_bientot',
    'demande_attente', 'demande_pause', 'semaine', 'reponse_utile', 'bravo', 'groupe_jour']) assert.equal(nomTypeNotif(k).connu, true, k);
  assert.equal(nomTypeNotif('rdv_demain').nom, 'Rendez-vous demain');
  assert.equal(new Set(Object.values(NOMS_NOTIF)).size, Object.keys(NOMS_NOTIF).length, 'deux types, deux noms');
});

// ---------------------------------------------------------------------------
// Le panneau : santeResume
// ---------------------------------------------------------------------------
const JOURS = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
const VIDE = { envoyees: 0, parties: 0, refusees: 0, trop_longues: 0, echecs: 0, sans_tel: 0, coupees: 0, abandonnees: 0, expirees: 0, jetees: 0 };
const jour = (i, x = {}) => ({ jour: JOURS[i], ...VIDE, ...x });
// Un service : abonnés, acceptés et refusés (dernière réponse en 7 jours), membres distincts qui refusent
const srv = (n, ok = n, refus = 0, refus_membres = refus) => ({ n, ok, refus, refus_membres });
function sante(x = {}) {
  return {
    at: il_y_a(0),
    roles: [{ role: 'admin', membres: 1, avec_tel: 1 }, { role: 'etudiant', membres: 60, avec_tel: 36 }, { role: 'laureat', membres: 40, avec_tel: 20 }],
    telephones: { total: 62, recus_24h: 30, recus_7j: 55, servis_7j: 58, muets: 0, en_refus: 0, retires_7j: 0 },
    services: { fcm: srv(44), apple: srv(13), mozilla: srv(3), windows: srv(0), autre: srv(2, 1) },
    jours: JOURS.map((_, i) => jour(i, { envoyees: 10 + i })),
    types: [{ kind: 'message', total: 30, envoyees: 25, perdues: 3, sans_tel: 1, coupees: 1, echecs: 0 },
      { kind: 'un_type_futur', total: 2, envoyees: 2, perdues: 0, sans_tel: 0, coupees: 0, echecs: 0 }],
    file: { n: 0, age_s: 0 },
    envoi_at: il_y_a(240),
    cron: { existe: true, at: il_y_a(40), statut: 'succeeded' },
    http: { code: 200, at: il_y_a(120), delai: false, erreur: false },
    ...x,
  };
}

test('santeResume : la part des membres (sans l’administration), la semaine (envoyées, perdues par raison, sans téléphone à part), les rôles, les services, les types', () => {
  const r = santeResume(sante({ jours: [jour(0, { envoyees: 50, sans_tel: 8, parties: 2, refusees: 1, trop_longues: 1, abandonnees: 1, expirees: 2, jetees: 1, coupees: 4, echecs: 3 }),
    ...JOURS.slice(1).map((_, i) => jour(i + 1, { envoyees: 5 }))] }));
  assert.equal(r.membres, 100); assert.equal(r.avecTel, 56); assert.equal(r.part, .56);
  assert.deepEqual(r.roles.map(x => [x.role, x.membres, x.avecTel, x.part]), [['etudiant', 60, 36, .6], ['laureat', 40, 20, .5], ['admin', 1, 1, 1]], 'étudiants, lauréats, puis administration');
  // Perdues : parties, refusées, trop longues, abandonnées, expirées, jetées ; jamais « sans téléphone » (rien ne pouvait partir)
  assert.deepEqual(r.semaine, { envoyees: 80, perdues: 8, parties: 2, refusees: 1, tropLongues: 1, abandonnees: 1, expirees: 2, jetees: 1, sansTel: 8, coupees: 4, echecs: 3 });
  assert.deepEqual(r.jours[0], { jour: '2026-10-26', court: '26', long: '26 octobre', envoyees: 50, parties: 2, refusees: 1, tropLongues: 1, abandonnees: 1,
    expirees: 2, jetees: 1, sansTel: 8, coupees: 4, echecs: 3, perdues: 8 });
  assert.equal(r.max, 58, 'la plus haute colonne : envoyées et perdues du même jour (sans téléphone : hors du graphique)');
  assert.deepEqual(r.services.map(x => [x.cle, x.n, x.ok, x.refus, x.refusMembres]), [['fcm', 44, 44, 0, 0], ['apple', 13, 13, 0, 0], ['mozilla', 3, 3, 0, 0], ['autre', 2, 1, 0, 0]],
    'les services sans téléphone sont omis');
  assert.equal(r.services[0].nom, SERVICES_PUSH[0][1]);
  assert.deepEqual(r.types.map(x => [x.kind, x.nom, x.connu, x.envoyees, x.perdues, x.sansTel, x.coupees]),
    [['message', 'Message', true, 25, 3, 1, 1], ['un_type_futur', 'Vie du réseau', false, 2, 0, 0, 0]]);
  assert.equal(r.typesPlein, false);
  assert.deepEqual(r.telephones, { total: 62, servis7j: 58, recus24h: 30, recus7j: 55, muets: 0, enRefus: 0, retires7j: 0 });
  assert.equal(r.envoiAt, il_y_a(240));
  assert.deepEqual(r.cron, { existe: true, at: il_y_a(40), statut: 'succeeded' });
  assert.deepEqual(r.http, { vide: false, code: 200, at: il_y_a(120), delai: false, erreur: false });
});

test('santeResume : rien de lisible, des champs absents ou faux ne cassent rien ; pg_net vide ; « Par type » plein', () => {
  assert.equal(santeResume(null), null); assert.equal(santeResume('x'), null);
  const r = santeResume({});
  assert.equal(r.part, null); assert.equal(r.membres, 0); assert.deepEqual(r.jours, []); assert.equal(r.max, 1);
  assert.deepEqual(r.semaine, { envoyees: 0, perdues: 0, parties: 0, refusees: 0, tropLongues: 0, abandonnees: 0, expirees: 0, jetees: 0, sansTel: 0, coupees: 0, echecs: 0 });
  assert.equal(r.cron, null); assert.equal(r.http, null); assert.deepEqual(r.file, { n: 0, ageS: 0 }); assert.equal(r.envoiAt, null);
  const h = santeResume(sante({ http: { code: null, at: il_y_a(60), delai: true, erreur: false }, roles: [{ role: 'etudiant', membres: 3, avec_tel: 9 }] }));
  assert.equal(h.http.code, null, 'pas de réponse : pas de code');
  assert.equal(h.avecTel, 3, 'jamais plus de membres avec un téléphone que de membres');
  assert.equal(santeResume(sante({ cron: { existe: false } })).cron.existe, false);
  // pg_net lisible mais vide (il ne garde ses réponses que 6 h) : ni un code, ni « jamais appelée »
  assert.deepEqual(santeResume(sante({ http: { vide: true } })).http, { vide: true, code: null, at: null, delai: false, erreur: false });
  // Une forme plus ancienne des services (un nombre) : les abonnés seulement
  assert.deepEqual(santeResume(sante({ services: { fcm: 5 } })).services, [{ cle: 'fcm', nom: SERVICES_PUSH[0][1], n: 5, ok: 0, refus: 0, refusMembres: 0 }]);
  const types = Array.from({ length: TYPES_MAX_SN }, (_, i) => ({ kind: 'type_' + i, total: 1, envoyees: 1 }));
  assert.equal(santeResume(sante({ types })).typesPlein, true, 'la base n’en rend que 12 : le panneau le dit');
});

// ---------------------------------------------------------------------------
// Le panneau : raisonsNotifs
// ---------------------------------------------------------------------------
const raisons = x => raisonsNotifs(santeResume(sante(x)), NOW);
const cles = l => l.map(x => x.cle);
const semaine = x => [jour(0, x), ...JOURS.slice(1).map((_, i) => jour(i + 1))];

test('raisonsNotifs : tout va bien, une phrase calme ; une semaine vide le dit', () => {
  const l = raisons();
  assert.deepEqual(l, [{ cle: 'rien', ton: 'bien', texte: 'Aucune notification envoyée ne s’est perdue cette semaine.' }]);
  assert.equal(raisonsAvecPertes(l), false);
  assert.deepEqual(raisons({ jours: JOURS.map((_, i) => jour(i)) }), [{ cle: 'vide', ton: 'info', texte: 'Aucune notification n’est partie cette semaine.' }]);
  assert.deepEqual(raisonsNotifs(null), []);
});

test('raisonsNotifs : les pertes avec leurs vrais nombres, un défaut d’abord, puis ce qui est à surveiller, les pertes normales, et ce qui n’est pas une perte', () => {
  const l = raisons({ jours: semaine({ envoyees: 40, sans_tel: 24, parties: 5, refusees: 3, trop_longues: 1, abandonnees: 1, expirees: 2, jetees: 1, coupees: 15, echecs: 6 }),
    telephones: { total: 10, recus_24h: 2, recus_7j: 5, servis_7j: 8, muets: 2, en_refus: 1, retires_7j: 1 } });
  assert.deepEqual(cles(l), ['jetees', 'trop_longues', 'refusees', 'expirees', 'abandonnees', 'muets', 'parties', 'sans_tel', 'coupees', 'echecs']);
  assert.deepEqual(l.map(x => x.ton), ['bad', 'bad', 'warn', 'warn', 'warn', 'warn', 'info', 'info', 'note', 'note']);
  assert.deepEqual(l.map(x => x.texte), [
    '1 notification a été écartée par le serveur (type inconnu) : un défaut à signaler.',
    '1 notification a été refusée parce que trop longue (erreur 413) : un défaut à signaler.',
    '3 notifications ont été refusées par le service de notification du téléphone. Après 3 refus de suite, le téléphone est retiré, sauf si tout ce service refuse (la clé de la plateforme serait alors en cause).',
    '2 notifications ont expiré sans aucun essai d’envoi, après un jour d’attente : la fonction notifier ou la tâche de chaque minute ne tournait pas (voir Fonctionnement, dans le détail).',
    '1 notification a été abandonnée après 3 essais ou un jour d’attente : le service du téléphone ne répondait pas.',
    '2 téléphones acceptent les notifications sans confirmer les afficher : économie d’énergie, notifications du navigateur coupées, ou ancienne version de l’application.',
    '5 notifications n’ont pas pu arriver : le téléphone n’était plus abonné (application désinstallée, téléphone changé ou notifications retirées). Son abonnement est retiré ; le membre devra réactiver les notifications.',
    '24 notifications n’ont pas pu partir : le membre n’a activé les notifications sur aucun téléphone (ses emails l’invitent à le faire).',
    '15 notifications n’ont pas été envoyées : le membre a coupé ce type dans Mon profil. C’est son choix.',
    '6 envois ont échoué un moment (service du téléphone injoignable), puis ont été réessayés.',
  ]);
  assert.equal(raisonsAvecPertes(l), true);
  // Au singulier
  const un = raisons({ jours: semaine({ envoyees: 1, sans_tel: 1, parties: 1, refusees: 1, trop_longues: 1, expirees: 1, coupees: 1, echecs: 1 }),
    telephones: { total: 1, recus_24h: 0, recus_7j: 1, servis_7j: 1, muets: 1, en_refus: 0, retires_7j: 0 } });
  assert.deepEqual(un.map(x => x.texte.split(' :')[0].split(' (')[0].split('. ')[0]), ['1 notification a été refusée parce que trop longue',
    '1 notification a expiré sans aucun essai d’envoi, après un jour d’attente', '1 notification a été refusée par le service de notification du téléphone',
    '1 téléphone accepte les notifications sans confirmer les afficher', '1 notification n’a pas pu arriver', '1 notification n’a pas pu partir',
    '1 notification n’a pas été envoyée', '1 envoi a échoué un moment']);
  // Coupées et réessayées seulement : ce n'est pas une perte
  const calme = raisons({ jours: semaine({ envoyees: 9, coupees: 2, echecs: 1 }) });
  assert.deepEqual(cles(calme), ['rien', 'coupees', 'echecs'], 'la bonne nouvelle d’abord');
  assert.equal(raisonsAvecPertes(calme), false);
});

test('raisonsNotifs : un membre sans téléphone n’est pas une perte — la semaine reste calme, et c’est dit après la bonne nouvelle', () => {
  const l = raisons({ jours: semaine({ envoyees: 30, sans_tel: 69 }) });
  assert.deepEqual(cles(l), ['rien', 'sans_tel']);
  assert.deepEqual(l.map(x => x.ton), ['bien', 'info']);
  assert.equal(raisonsAvecPertes(l), false, 'le titre reste « Cette semaine »');
  const r = santeResume(sante({ jours: semaine({ envoyees: 30, sans_tel: 69, refusees: 1 }) }));
  assert.equal(r.semaine.perdues, 1); assert.equal(r.max, 31, 'le graphique ne les compte pas');
});

test('raisonsNotifs : « envoyée » n’est pas « affichée » — des téléphones qui ne confirment pas, pas de « rien ne s’est perdu » ; aucun qui confirme, c’est à régler', () => {
  // Quelques téléphones muets : à surveiller, et pas de bonne nouvelle
  const muets = raisons({ telephones: { total: 6, recus_24h: 1, recus_7j: 2, servis_7j: 6, muets: 4, en_refus: 0, retires_7j: 0 } });
  assert.deepEqual(cles(muets), ['muets']);
  assert.equal(raisonsAvecPertes(muets), true);
  // 20 envois acceptés, aucun téléphone ne confirme : la seule phrase, en tête (la ligne des muets dirait la même chose)
  const aucun = raisons({ jours: semaine({ envoyees: 20 }), telephones: { total: 4, recus_24h: 0, recus_7j: 0, servis_7j: 4, muets: 4, en_refus: 0, retires_7j: 0 } });
  assert.deepEqual(aucun, [{ cle: 'aucune_recue', ton: 'bad',
    texte: 'Les services de notification ont accepté 20 envois cette semaine, mais aucun téléphone ne confirme les avoir affichés : essaie « Tester » sur un vrai téléphone (Mon profil > Notifications).' }]);
  assert.match(raisons({ jours: semaine({ envoyees: 1 }), telephones: { total: 1, recus_7j: 0, servis_7j: 1, muets: 1 } })[0].texte, /accepté 1 envoi cette semaine/);
  // Rien d'envoyé cette semaine : rien à confirmer
  assert.deepEqual(cles(raisons({ jours: JOURS.map((_, i) => jour(i)), telephones: { total: 4, recus_7j: 0, servis_7j: 0 } })), ['vide']);
});

test('raisonsNotifs : tout un service refuse sans accepter personne — la clé de la plateforme est en cause, pas les téléphones', () => {
  const l = raisons({ services: { fcm: srv(4, 0, 4, 4), apple: srv(2) }, jours: semaine({ refusees: 12 }) });
  assert.deepEqual(cles(l), ['masse_fcm', 'refusees']);
  assert.deepEqual(l[0], { cle: 'masse_fcm', ton: 'bad',
    texte: 'Le service « Chrome et Android (Google) » refuse les notifications de 4 téléphones et n’en accepte aucun : la clé de la plateforme est en cause, pas les membres. Regarde les Logs de la fonction notifier (Edge Functions > notifier > Logs).' });
  assert.equal(REFUS_EN_MASSE_SN, 3, 'même seuil que la fonction notifier (REFUS_EN_MASSE)');
  // Les iPhone refusent, les Android acceptent : seul Apple est en cause
  assert.deepEqual(cles(raisons({ services: { fcm: srv(2), apple: srv(3, 0, 3) }, jours: semaine({ envoyees: 8, refusees: 12 }) })), ['masse_apple', 'refusees']);
  // Un téléphone du service accepte encore : ce sont bien ces téléphones-là qui refusent
  assert.deepEqual(cles(raisons({ services: { fcm: srv(5, 1, 4) }, jours: semaine({ envoyees: 8, refusees: 4 }) })), ['refusees']);
  // Un seul membre et ses trois vieux abonnements : trois téléphones, mais pas un service entier
  assert.deepEqual(cles(raisons({ services: { fcm: srv(3, 0, 3, 1) }, jours: semaine({ refusees: 3 }) })), ['refusees']);
  // Deux membres seulement : en dessous du seuil
  assert.deepEqual(cles(raisons({ services: { fcm: srv(2, 0, 2) }, jours: semaine({ refusees: 2 }) })), ['refusees']);
});

test('raisonsNotifs : la chaîne elle-même d’abord — fonction notifier, tâche de chaque minute, file bloquée', () => {
  const txt = x => raisons(x).filter(r => ['http', 'cron', 'file'].includes(r.cle)).map(r => [r.cle, r.ton, r.texte]);
  assert.deepEqual(txt({ http: { code: 401, at: il_y_a(30 * 86400), delai: false, erreur: false } }), [['http', 'bad',
    'La fonction notifier refuse les appels de la base (erreur 401) : désactive « Verify JWT » dans Supabase (Edge Functions > notifier > Details).']], 'un 401 se dit, même ancien');
  assert.match(txt({ http: { code: 404, at: il_y_a(60) } })[0][2], /introuvable \(erreur 404\) : déploie-la/);
  assert.match(txt({ http: { code: 500, at: il_y_a(60) } })[0][2], /^La fonction notifier a répondu par une erreur au dernier appel \(erreur 500\)/);
  assert.equal(txt({ http: { code: null, at: il_y_a(600), delai: true, erreur: false } })[0][1], 'warn', 'délai dépassé récent : à surveiller');
  assert.deepEqual(txt({ http: { code: null, at: il_y_a(2 * 86400), delai: true, erreur: false } }), [], 'un vieux délai dépassé ne dit plus rien');
  assert.deepEqual(txt({ http: null, cron: null }), [], 'pg_net ou pg_cron illisibles : rien d’inventé');
  assert.deepEqual(txt({ http: { vide: true } }), [], 'pg_net vide (une nuit calme) : la fonction n’est pas en cause');
  // La chaîne en panne : pas de « rien ne s’est perdu » (ses notifications n'expirent qu'un jour plus tard)
  assert.deepEqual(cles(raisons({ http: { code: 401, at: il_y_a(60) } })), ['http']);
  assert.match(txt({ cron: { existe: false } })[0][2], /^La tâche de chaque minute n’existe pas dans la base : active pg_cron/);
  assert.equal(txt({ cron: { existe: true, at: il_y_a(60), statut: 'failed' } })[0][1], 'bad');
  assert.match(txt({ cron: { existe: true, at: null, statut: null } })[0][2], /n’a encore jamais tourné/);
  assert.deepEqual(txt({ cron: { existe: true, at: il_y_a(50 * 60), statut: 'succeeded' } }), [['cron', 'warn',
    'La tâche de chaque minute n’a pas tourné depuis 50 min : vérifie pg_cron dans Supabase (Database > Cron).']]);
  assert.deepEqual(txt({ cron: { existe: true, at: il_y_a(5 * 60), statut: 'succeeded' } }), [], 'il y a 5 minutes : rien à dire');
  assert.deepEqual(txt({ file: { n: 12, age_s: 540 } }), [['file', 'warn',
    '12 notifications attendent depuis 9 min au lieu de partir tout de suite : la tâche de chaque minute ou la fonction notifier est bloquée (voir Fonctionnement, dans le détail).']]);
  assert.deepEqual(txt({ file: { n: 3, age_s: 90 } }), [], 'quelques secondes d’attente : normal');
  assert.match(txt({ file: { n: 1, age_s: 3 * 3600 } })[0][2], /^1 notification attend depuis 3 h /);
  // Tout à la fois : la fonction, la tâche, la file, puis les pertes
  assert.deepEqual(cles(raisons({ http: { code: 401, at: il_y_a(60) }, cron: { existe: false }, file: { n: 4, age_s: 900 },
    jours: [jour(0, { envoyees: 3, sans_tel: 2 }), ...JOURS.slice(1).map((_, i) => jour(i + 1))] })), ['http', 'cron', 'file', 'sans_tel']);
  assert.deepEqual([null, { existe: false }, { existe: true, at: null }, { existe: true, at: 'x', statut: 'failed' }, { existe: true, at: 'x', statut: 'running' },
    { existe: true, at: 'x', statut: 'succeeded' }, { existe: true, at: 'x', statut: 'bizarre' }].map(etatCronNotifs), [null, 'absente', 'jamais', 'echec', 'en_cours', 'ok', 'inconnu']);
});

// ---------------------------------------------------------------------------
// La démo : mêmes champs que la base, des totaux seulement, pour l'administration seule
// ---------------------------------------------------------------------------
async function demo() {
  globalThis.window ??= {};
  window.ENSAM_CONFIG = {};
  const { createStore } = await import('../../src/store.js');
  const s = await createStore();
  const qui = nom => s.personas().find(p => p._persona.includes(nom));
  return { s, comme: nom => s.switchTo(qui(nom).id) };
}

test('démo : la santé des notifications, plausible et sans aucun nom, pour l’administration seule ; « Par type » tombe juste', async () => {
  const { s, comme } = await demo();
  comme('Salma');
  await assert.rejects(s.santeNotifs(), { message: 'Réservé à l’administration.' });
  comme('Admin');
  const d = await s.santeNotifs();
  assert.deepEqual(Object.keys(d).sort(), ['at', 'cron', 'envoi_at', 'file', 'http', 'jours', 'roles', 'services', 'telephones', 'types']);
  assert.equal(d.jours.length, 7);
  assert.equal(d.jours[6].jour, new Date().toISOString().slice(0, 10), 'le dernier jour est aujourd’hui (UTC, comme la base)');
  assert.deepEqual(Object.keys(d.jours[0]).sort(), ['abandonnees', 'coupees', 'echecs', 'envoyees', 'expirees', 'jetees', 'jour', 'parties', 'refusees', 'sans_tel', 'trop_longues']);
  assert.deepEqual(Object.keys(d.telephones).sort(), ['en_refus', 'muets', 'recus_24h', 'recus_7j', 'retires_7j', 'servis_7j', 'total']);
  const par = r => s.data.profiles.filter(p => p.role === r).length;
  for (const r of d.roles) { assert.equal(r.membres, par(r.role), r.role); assert.ok(r.avec_tel <= r.membres); }
  assert.ok(d.types.length <= 12 && d.types.every(t => NOMS_NOTIF[t.kind]), 'des types connus, 12 au plus');
  // Chaque colonne de « Par type » tombe juste sur la semaine (tous les types y sont)
  const r = santeResume(d), somme = k => d.types.reduce((a, t) => a + t[k], 0);
  assert.deepEqual(['envoyees', 'perdues', 'sans_tel', 'coupees', 'echecs'].map(somme), [r.semaine.envoyees, r.semaine.perdues, r.semaine.sansTel, r.semaine.coupees, r.semaine.echecs]);
  for (const t of d.types) assert.equal(t.total, t.envoyees + t.perdues + t.sans_tel + t.coupees + t.echecs, t.kind);
  // « Sans téléphone » et « coupées » : seulement les types qui passent par pousser() (les autres ne partent que vers un téléphone qui les veut)
  const POUSSER = ['message', 'candidature', 'reponse', 'match', 'match_interet', 'merci', 'rdv_message', 'mentorat_demande'];
  assert.deepEqual(d.types.filter(t => t.sans_tel || t.coupees).map(t => t.kind).filter(k => !POUSSER.includes(k)), []);
  // Téléphones et services cohérents : abonnés, servis, confirmés, acceptés, refusés
  const t = d.telephones, sv = Object.values(d.services);
  assert.equal(sv.reduce((a, x) => a + x.n, 0), t.total);
  assert.ok(t.recus_7j <= t.servis_7j && t.servis_7j <= t.total);
  assert.equal(sv.reduce((a, x) => a + x.ok + x.refus, 0), t.servis_7j, 'chaque téléphone servi a accepté ou refusé');
  assert.equal(t.muets, t.servis_7j - t.recus_7j);
  const tout = JSON.stringify(d);
  for (const p of s.data.profiles) assert.ok(!tout.includes(p.id) && !tout.includes(p.full_name), 'aucun identifiant ni nom');
  assert.ok(!/@|https?:/.test(tout), 'aucune adresse');
  // Mêmes chiffres à chaque ouverture (seules les heures avancent)
  const sans = x => JSON.stringify({ ...x, at: 0, envoi_at: 0, cron: { ...x.cron, at: 0 }, http: { ...x.http, at: 0 } });
  assert.equal(sans(await s.santeNotifs()), sans(d));
  // Le panneau la lit : environ la moitié des membres, une semaine avec quelques vraies pertes expliquées
  assert.ok(r.part > .4 && r.part < .7, String(r.part));
  assert.ok(r.semaine.envoyees > 200 && r.semaine.perdues > 0 && r.semaine.sansTel > r.semaine.perdues);
  assert.deepEqual(cles(raisonsNotifs(r)), ['refusees', 'abandonnees', 'muets', 'parties', 'sans_tel', 'coupees', 'echecs']);
  // Aucun téléphone en démo : l'abonnement est accepté, l'essai ne part vers aucun téléphone
  assert.equal(await s.abonnerPush({}), 'ok');
  assert.deepEqual(await s.testPushDetails(), { sent: 0, failed: 0, removed: 0, codes: [], abonnements: 0 });
  assert.equal(await s.testPush(), 0);
});

// ---------------------------------------------------------------------------
// Le store réel : un faux client Supabase
// ---------------------------------------------------------------------------
function magasin({ rpc = {}, invoke = null } = {}) {
  const s = new SupabaseStore({}); s.session = { user: { id: 'u1' } };
  const appels = [];
  s.sb = {
    rpc: async (fn, args) => { appels.push(['rpc', fn, args]); return rpc[fn] || { data: null, error: null }; },
    functions: { invoke: async (nom, opt) => { appels.push(['invoke', nom, opt]); return invoke || { data: null, error: null }; } },
  };
  return { s, appels };
}
const SUB = { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'P', auth: 'A' } }) };

test('store réel : abonnerPush demande abonner_push_etat (« ok » ou « mort ») ; une base d’avant (fonction absente) : abonner_push, puis plus jamais abonner_push_etat ; une erreur est dite en français', async () => {
  const ARGS = { p_endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p_p256dh: 'P', p_auth: 'A' };
  let m = magasin({ rpc: { abonner_push_etat: { data: 'ok', error: null } } });
  assert.equal(await m.s.abonnerPush(SUB), 'ok');
  assert.deepEqual(m.appels, [['rpc', 'abonner_push_etat', ARGS]]);
  m = magasin({ rpc: { abonner_push_etat: { data: 'mort', error: null } } });
  assert.equal(await m.s.abonnerPush(SUB), 'mort');
  // Base d'avant : abonner_push_etat n'existe pas, abonner_push (sans réponse) abonne comme avant
  for (const error of [{ code: 'PGRST202', message: 'Could not find the function public.abonner_push_etat(p_auth, p_endpoint, p_p256dh) in the schema cache' },
    { code: '42883', message: 'function public.abonner_push_etat(text, text, text) does not exist' }]) {
    m = magasin({ rpc: { abonner_push_etat: { data: null, error }, abonner_push: { data: null, error: null } } });
    assert.equal(await m.s.abonnerPush(SUB), null, error.code);
    assert.equal(await m.s.abonnerPush(SUB), null);
    assert.deepEqual(m.appels, [['rpc', 'abonner_push_etat', ARGS], ['rpc', 'abonner_push', ARGS], ['rpc', 'abonner_push', ARGS]], 'l’absence est retenue');
  }
  m = magasin({ rpc: { abonner_push_etat: { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }, abonner_push: { data: null, error: { message: 'Failed to fetch' } } } });
  await assert.rejects(m.s.abonnerPush(SUB), { message: 'Pas de réseau pour l’instant. Réessaie dans un instant.' });
  // Une vraie erreur d'abonner_push_etat n'est pas prise pour une base d'avant
  m = magasin({ rpc: { abonner_push_etat: { data: null, error: { message: 'Failed to fetch' } } } });
  await assert.rejects(m.s.abonnerPush(SUB), { message: 'Pas de réseau pour l’instant. Réessaie dans un instant.' });
  assert.deepEqual(m.appels.map(a => a[1]), ['abonner_push_etat']);
});

test('store réel : testPushDetails dit ce que chaque téléphone a répondu ; testPush garde son contrat (le nombre envoyé)', async () => {
  const rep = { data: { sent: 1, failed: 1, removed: 1, codes: [201, 410], abonnements: 2 }, error: null };
  let m = magasin({ invoke: rep });
  assert.deepEqual(await m.s.testPushDetails(), { sent: 1, failed: 1, removed: 1, codes: [201, 410], abonnements: 2 });
  assert.deepEqual(m.appels, [['invoke', 'notifier', { body: { job: 'test' } }]]);
  assert.equal(await m.s.testPush(), 1);
  m = magasin({ invoke: { data: { sent: 0 }, error: null } });
  assert.deepEqual(await m.s.testPushDetails(), { sent: 0, failed: 0, removed: 0, codes: [], abonnements: null }, 'ancienne fonction');
  assert.equal(await m.s.testPush(), 0);
  m = magasin({ invoke: { data: null, error: { message: 'FunctionsFetchError' } } });
  await assert.rejects(m.s.testPushDetails(), { message: 'La fonction de notifications ne répond pas encore.' });
  await assert.rejects(m.s.testPush(), { message: 'La fonction de notifications ne répond pas encore.' });
});

test('store réel : santeNotifs lit admin_sante_notifs ; absente (base pas à jour) : null ; refusée : le message', async () => {
  const d = sante();
  let m = magasin({ rpc: { admin_sante_notifs: { data: d, error: null } } });
  assert.deepEqual(await m.s.santeNotifs(), d);
  assert.deepEqual(m.appels, [['rpc', 'admin_sante_notifs', undefined]]);
  for (const error of [{ code: 'PGRST202', message: 'Could not find the function public.admin_sante_notifs without parameters in the schema cache' },
    { code: '42883', message: 'function public.admin_sante_notifs() does not exist' }]) {
    m = magasin({ rpc: { admin_sante_notifs: { data: null, error } } });
    assert.equal(await m.s.santeNotifs(), null, error.code);
  }
  m = magasin({ rpc: { admin_sante_notifs: { data: null, error: { code: '42501', message: 'Réservé à l’administration.' } } } });
  await assert.rejects(m.s.santeNotifs(), { message: 'Réservé à l’administration.' });
  m = magasin({ rpc: { admin_sante_notifs: { data: null, error: { message: 'Failed to fetch' } } } });
  await assert.rejects(m.s.santeNotifs(), { message: 'Pas de réseau pour l’instant. Réessaie dans un instant.' });
});
