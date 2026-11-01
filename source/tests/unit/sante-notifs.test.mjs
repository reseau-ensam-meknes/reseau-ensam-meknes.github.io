// Santé des notifications : « Tester » mis en forme (bilanTestPush, raisonTestPush), le panneau de l'administration
// (santeResume, raisonsNotifs : des phrases simples avec les vrais nombres, la plus urgente d'abord), la démo (des totaux
// plausibles, jamais un nom) et le store réel (abonner_push qui répond 'ok' ou 'mort', admin_sante_notifs absente).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bilanTestPush, raisonTestPush, testPushARefaire, dureeAttente, jourNotif, nomTypeNotif, NOMS_NOTIF, santeResume, raisonsNotifs,
  raisonsAvecPertes, etatCronNotifs, SERVICES_PUSH } from '../../src/logic.js';
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
});

// ---------------------------------------------------------------------------
// Le panneau : santeResume
// ---------------------------------------------------------------------------
const JOURS = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
const jour = (i, x = {}) => ({ jour: JOURS[i], envoyees: 0, refusees: 0, echecs: 0, sans_tel: 0, coupees: 0, abandonnees: 0, jetees: 0, ...x });
function sante(x = {}) {
  return {
    at: il_y_a(0),
    roles: [{ role: 'admin', membres: 1, avec_tel: 1 }, { role: 'etudiant', membres: 60, avec_tel: 36 }, { role: 'laureat', membres: 40, avec_tel: 20 }],
    telephones: { total: 62, recus_24h: 30, recus_7j: 55, muets: 0, en_refus: 0, retires_7j: 0 },
    services: { fcm: 44, apple: 13, mozilla: 3, windows: 0, autre: 2 },
    jours: JOURS.map((_, i) => jour(i, { envoyees: 10 + i })),
    types: [{ kind: 'message', total: 30, envoyees: 25, perdues: 3, coupees: 1, echecs: 1 }, { kind: 'un_type_futur', total: 2, envoyees: 2, perdues: 0, coupees: 0, echecs: 0 }],
    file: { n: 0, age_s: 0 },
    cron: { existe: true, at: il_y_a(40), statut: 'succeeded' },
    http: { code: 200, at: il_y_a(120), delai: false, erreur: false },
    ...x,
  };
}

test('santeResume : la part des membres (sans l’administration), la semaine, les rôles, les services, les types', () => {
  const r = santeResume(sante({ jours: [jour(0, { envoyees: 50, sans_tel: 8, refusees: 2, abandonnees: 1, jetees: 1, coupees: 4, echecs: 3 }), ...JOURS.slice(1).map((_, i) => jour(i + 1, { envoyees: 5 }))] }));
  assert.equal(r.membres, 100); assert.equal(r.avecTel, 56); assert.equal(r.part, .56);
  assert.deepEqual(r.roles.map(x => [x.role, x.membres, x.avecTel, x.part]), [['etudiant', 60, 36, .6], ['laureat', 40, 20, .5], ['admin', 1, 1, 1]], 'étudiants, lauréats, puis administration');
  assert.deepEqual(r.semaine, { arrivees: 80, perdues: 12, refusees: 2, sansTel: 8, abandonnees: 1, jetees: 1, coupees: 4, echecs: 3 });
  assert.deepEqual(r.jours[0], { jour: '2026-10-26', court: '26', long: '26 octobre', arrivees: 50, perdues: 12, refusees: 2, sansTel: 8, abandonnees: 1, jetees: 1, coupees: 4, echecs: 3 });
  assert.equal(r.max, 62, 'la plus haute colonne : arrivées et perdues du même jour');
  assert.deepEqual(r.services.map(x => [x.cle, x.n]), [['fcm', 44], ['apple', 13], ['mozilla', 3], ['autre', 2]], 'les services sans téléphone sont omis');
  assert.equal(r.services[0].nom, SERVICES_PUSH[0][1]);
  assert.deepEqual(r.types.map(x => [x.kind, x.nom, x.connu, x.arrivees, x.perdues, x.coupees]), [['message', 'Message', true, 25, 3, 1], ['un_type_futur', 'Vie du réseau', false, 2, 0, 0]]);
  assert.deepEqual(r.telephones, { total: 62, recus24h: 30, recus7j: 55, muets: 0, enRefus: 0, retires7j: 0 });
  assert.deepEqual(r.cron, { existe: true, at: il_y_a(40), statut: 'succeeded' });
  assert.deepEqual(r.http, { code: 200, at: il_y_a(120), delai: false, erreur: false });
});

test('santeResume : rien de lisible, des champs absents ou faux ne cassent rien', () => {
  assert.equal(santeResume(null), null); assert.equal(santeResume('x'), null);
  const r = santeResume({});
  assert.equal(r.part, null); assert.equal(r.membres, 0); assert.deepEqual(r.jours, []); assert.equal(r.max, 1);
  assert.deepEqual(r.semaine, { arrivees: 0, perdues: 0, refusees: 0, sansTel: 0, abandonnees: 0, jetees: 0, coupees: 0, echecs: 0 });
  assert.equal(r.cron, null); assert.equal(r.http, null); assert.deepEqual(r.file, { n: 0, ageS: 0 });
  const h = santeResume(sante({ http: { code: null, at: il_y_a(60), delai: true, erreur: false }, roles: [{ role: 'etudiant', membres: 3, avec_tel: 9 }] }));
  assert.equal(h.http.code, null, 'pas de réponse : pas de code');
  assert.equal(h.avecTel, 3, 'jamais plus de membres avec un téléphone que de membres');
  assert.equal(santeResume(sante({ cron: { existe: false } })).cron.existe, false);
});

// ---------------------------------------------------------------------------
// Le panneau : raisonsNotifs
// ---------------------------------------------------------------------------
const raisons = x => raisonsNotifs(santeResume(sante(x)), NOW);
const cles = l => l.map(x => x.cle);

test('raisonsNotifs : tout va bien, une phrase calme ; une semaine vide le dit', () => {
  const l = raisons();
  assert.deepEqual(l, [{ cle: 'rien', ton: 'bien', texte: 'Rien ne s’est perdu cette semaine.' }]);
  assert.equal(raisonsAvecPertes(l), false);
  assert.deepEqual(raisons({ jours: JOURS.map((_, i) => jour(i)) }), [{ cle: 'vide', ton: 'info', texte: 'Aucune notification n’est partie cette semaine.' }]);
  assert.deepEqual(raisonsNotifs(null), []);
});

test('raisonsNotifs : les pertes avec leurs vrais nombres, la plus fréquente d’abord (un défaut avant tout), puis ce qui n’est pas une perte', () => {
  const l = raisons({ jours: [jour(0, { envoyees: 40, sans_tel: 24, refusees: 3, abandonnees: 1, jetees: 1, coupees: 15, echecs: 6 }), ...JOURS.slice(1).map((_, i) => jour(i + 1))],
    telephones: { total: 10, recus_24h: 2, recus_7j: 5, muets: 2, en_refus: 1, retires_7j: 1 } });
  assert.deepEqual(cles(l), ['jetees', 'sans_tel', 'refusees', 'abandonnees', 'muets', 'coupees', 'echecs']);
  assert.deepEqual(l.map(x => x.ton), ['bad', 'info', 'warn', 'warn', 'warn', 'note', 'note']);
  assert.deepEqual(l.map(x => x.texte), [
    '1 notification a été écartée par le serveur (type inconnu) : un défaut à signaler.',
    '24 notifications n’ont pas pu partir : le membre n’a activé les notifications sur aucun téléphone (ses emails l’invitent à le faire).',
    '3 notifications ont été refusées par le téléphone (application désinstallée, téléphone changé ou autorisation retirée). Un téléphone qui refuse est retiré : le membre devra réactiver les notifications.',
    '1 notification a été abandonnée après 3 essais ou un jour d’attente : le service du téléphone ne répondait pas.',
    '2 téléphones acceptent les notifications sans confirmer les afficher : économie d’énergie, notifications du navigateur coupées, ou ancienne version de l’application.',
    '15 notifications n’ont pas été envoyées : le membre a coupé ce type dans Mon profil. C’est son choix.',
    '6 envois ont échoué un moment (service du téléphone injoignable), puis ont été réessayés.',
  ]);
  assert.equal(raisonsAvecPertes(l), true);
  // Au singulier
  const un = raisons({ jours: [jour(0, { envoyees: 1, sans_tel: 1, refusees: 1, coupees: 1, echecs: 1 }), ...JOURS.slice(1).map((_, i) => jour(i + 1))],
    telephones: { total: 1, recus_24h: 0, recus_7j: 0, muets: 1, en_refus: 0, retires_7j: 0 } });
  assert.deepEqual(un.map(x => x.texte.split(' :')[0].split(' (')[0]), ['1 notification n’a pas pu partir', '1 notification a été refusée par le téléphone',
    '1 téléphone accepte les notifications sans confirmer les afficher', '1 notification n’a pas été envoyée', '1 envoi a échoué un moment']);
  // Coupées et réessayées seulement : ce n'est pas une perte
  const calme = raisons({ jours: [jour(0, { envoyees: 9, coupees: 2, echecs: 1 }), ...JOURS.slice(1).map((_, i) => jour(i + 1))] });
  assert.deepEqual(cles(calme), ['rien', 'coupees', 'echecs'], 'la bonne nouvelle d’abord');
  assert.equal(raisonsAvecPertes(calme), false);
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

test('démo : la santé des notifications, plausible et sans aucun nom, pour l’administration seule', async () => {
  const { s, comme } = await demo();
  comme('Salma');
  await assert.rejects(s.santeNotifs(), { message: 'Réservé à l’administration.' });
  comme('Admin');
  const d = await s.santeNotifs();
  assert.deepEqual(Object.keys(d).sort(), ['at', 'cron', 'file', 'http', 'jours', 'roles', 'services', 'telephones', 'types']);
  assert.equal(d.jours.length, 7);
  assert.equal(d.jours[6].jour, new Date().toISOString().slice(0, 10), 'le dernier jour est aujourd’hui (UTC, comme la base)');
  assert.deepEqual(Object.keys(d.jours[0]).sort(), ['abandonnees', 'coupees', 'echecs', 'envoyees', 'jetees', 'jour', 'refusees', 'sans_tel']);
  const par = r => s.data.profiles.filter(p => p.role === r).length;
  for (const r of d.roles) { assert.equal(r.membres, par(r.role), r.role); assert.ok(r.avec_tel <= r.membres); }
  assert.ok(d.types.length <= 12 && d.types.every(t => NOMS_NOTIF[t.kind]), 'des types connus, 12 au plus');
  const tout = JSON.stringify(d);
  for (const p of s.data.profiles) assert.ok(!tout.includes(p.id) && !tout.includes(p.full_name), 'aucun identifiant ni nom');
  assert.ok(!/@|https?:/.test(tout), 'aucune adresse');
  // Mêmes chiffres à chaque ouverture (seules les heures avancent)
  const sans = x => JSON.stringify({ ...x, at: 0, cron: { ...x.cron, at: 0 }, http: { ...x.http, at: 0 } });
  assert.equal(sans(await s.santeNotifs()), sans(d));
  // Le panneau la lit : environ la moitié des membres, une semaine avec quelques pertes expliquées
  const r = santeResume(d);
  assert.ok(r.part > .4 && r.part < .7, String(r.part));
  assert.ok(r.semaine.arrivees > 200 && r.semaine.perdues > 0);
  assert.deepEqual(cles(raisonsNotifs(r)), ['sans_tel', 'refusees', 'abandonnees', 'muets', 'coupees', 'echecs']);
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

test('store réel : abonnerPush rend « ok » ou « mort » (base à jour), null avant la mise à jour ; une erreur est dite en français', async () => {
  let m = magasin({ rpc: { abonner_push: { data: 'ok', error: null } } });
  assert.equal(await m.s.abonnerPush(SUB), 'ok');
  assert.deepEqual(m.appels, [['rpc', 'abonner_push', { p_endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p_p256dh: 'P', p_auth: 'A' }]]);
  m = magasin({ rpc: { abonner_push: { data: 'mort', error: null } } });
  assert.equal(await m.s.abonnerPush(SUB), 'mort');
  m = magasin({ rpc: { abonner_push: { data: null, error: null } } });
  assert.equal(await m.s.abonnerPush(SUB), null, 'ancienne base : abonner_push ne rend rien');
  m = magasin({ rpc: { abonner_push: { data: null, error: { message: 'Failed to fetch' } } } });
  await assert.rejects(m.s.abonnerPush(SUB), { message: 'Pas de réseau pour l’instant. Réessaie dans un instant.' });
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
