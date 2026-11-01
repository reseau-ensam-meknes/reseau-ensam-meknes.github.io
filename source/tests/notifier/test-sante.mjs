// Santé des notifications, côté fonction : une notification par événement dans la barre (sauf ce qui remplace),
// les abonnements morts retirés (404, 410, trois refus définitifs d'affilée), 413 au journal seulement, une base pas
// encore mise à jour servie comme avant, l'heure limite de 45 s, le détail de « Tester », et la ligne des emails
// pour qui n'a de notifications sur aucun téléphone.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE, Banc, installer, configurerEnv, requete, uid, SITE } from './banc.mjs';
import { ID, jeu, brut } from './donnees.mjs';

const N = await import(MODULE);
const SECRET = 'secret-de-test-0123456789abcdef';
const fetchOrigine = globalThis.fetch;
let erreurs = [];
const errOrigine = console.error;
beforeEach(() => { erreurs = []; console.error = (...a) => erreurs.push(a.map(String).join(' ')); configurerEnv(); });
afterEach(() => { console.error = errOrigine; globalThis.fetch = fetchOrigine; });
const nouveauBanc = () => { const b = installer(new Banc()); b.tables.app_secrets.push({ cle: 'notifier_secret', valeur: SECRET }); return b; };
const appel = corps => N.handler(requete(corps, { 'x-notifier': SECRET }));
const corpsDe = async r => JSON.parse(await r.text());
const profil = (id, x = {}) => ({ id, full_name: 'Membre ' + id.slice(-2), role: 'etudiant', langue: 'fr', created_at: '2026-01-01T00:00:00Z', ...x });
const vieillir = (b, minutes) => { for (const x of b.tables.push_queue) if (x.pris_at) x.pris_at = new Date(Date.now() - minutes * 60e3).toISOString(); };
let prochain = 1;
const enFile = (b, user_id, kind, data = {}) => { const id = prochain++; b.tables.push_queue.push({ id, user_id, kind, data }); return id; };
const journal = b => b.tables.push_journal.map(x => [x.kind, x.code]);

test('tags : une notification par événement ; ce qui remplace garde son tag ; les tags par élément restent', async () => {
  const t = (kind, data, id) => N.texteNotif(kind, data, 'fr', SITE, id).tag;
  assert.equal(t('candidature', { nom: 'Salma', titre: 'Stage' }, 12), 'candidature-12');
  assert.equal(t('reponse', { nom: 'Nadia', titre: 'Entretien chez Renault ?' }, '13'), 'reponse-13');
  assert.equal(t('candidature', { nom: 'Salma', titre: 'Stage' }), 'candidature', 'sans identifiant de file : le type');
  // Ce qui remplace la précédente : un seul rappel du soir, un seul Match du jour, un seul essai, une seule enquête
  assert.deepEqual(N.SE_REMPLACENT, ['rappel_visite', 'match_jour', 'test', 'enquete']);
  assert.equal(t('rappel_visite', { messages: 2 }, 14), 'rappel_visite');
  assert.equal(t('match_jour', { n: 3, type: 'etudiant' }, 15), 'match_jour');
  assert.equal(t('test', {}, 16), 'test');
  assert.equal(t('enquete', { vague: 6 }, 17), 'enquete');
  // Regroupées par élément : la conversation, le match, l'offre
  const de = uid(501), m = uid(502), o = uid(503);
  assert.equal(t('message', { nom: 'Salma', de, type: 'texte', texte: 'Bonjour' }, 18), `message-${de}`);
  assert.equal(t('match', { nom: 'Salma', de, match: m }, 19), `match-${m}`);
  assert.equal(t('offre_alerte', { titre: 'PFE', entreprise: 'OCP', offre: o }, 20), `offre-${o}`);
  // Dans la file : deux candidatures du même jour restent deux notifications
  const b = nouveauBanc();
  const u = uid(1);
  b.tables.profiles.push(profil(u, { role: 'laureat' }));
  b.abonner(u, 1);
  const a1 = enFile(b, u, 'candidature', { nom: 'Salma Idrissi', titre: 'Stage maintenance' });
  const a2 = enFile(b, u, 'candidature', { nom: 'Amine Tazi', titre: 'Stage qualité' });
  enFile(b, u, 'match_jour', { n: 2, type: 'laureat' });
  assert.deepEqual(await corpsDe(await appel({ job: 'push' })), { sent: 3, failed: 0, removed: 0 });
  assert.deepEqual(b.push.map(x => x.message.tag), [`candidature-${a1}`, `candidature-${a2}`, 'match_jour']);
});

test('refus définitifs : au troisième d’affilée l’abonnement est retiré et son adresse notée, quand le même service accepte un autre téléphone ; un envoi accepté remet le compte à zéro', async () => {
  const b = nouveauBanc();
  const u = uid(2), autre = uid(9);
  b.tables.profiles.push(profil(u), profil(autre));
  const s = b.abonner(u, 1, 'https://fcm.googleapis.com');
  b.abonner(autre, 1, 'https://fcm.googleapis.com');   // un autre membre, que Google accepte
  const envoi = async (qui = u) => { enFile(b, qui, 'merci', { nom: 'Salma' }); return corpsDe(await appel({ job: 'push' })); };
  const abo = () => b.tables.push_subscriptions.find(x => x.id === s.id);
  b.statutsPush.set(s.endpoint, 403);
  assert.deepEqual(await envoi(), { sent: 0, failed: 1, removed: 0 });
  assert.equal(abo().refus, 1);
  assert.equal(abo().dernier_code, 403);
  b.statutsPush.delete(s.endpoint);
  assert.deepEqual(await envoi(), { sent: 1, failed: 0, removed: 0 });
  assert.equal(abo().refus, 0, 'accepté : le compte repart de zéro');
  b.statutsPush.set(s.endpoint, 401);
  await envoi();
  // Pendant la série, Google accepte le téléphone d'un autre membre : c'est bien celui-ci qu'il refuse
  assert.deepEqual(await envoi(autre), { sent: 1, failed: 0, removed: 0 });
  b.statutsPush.set(s.endpoint, 400);
  await envoi();
  assert.equal(abo().refus, 2);
  b.statutsPush.set(s.endpoint, 403);
  assert.deepEqual(await envoi(), { sent: 0, failed: 1, removed: 1 }, 'troisième refus d’affilée : retiré');
  assert.equal(abo(), undefined);
  assert.deepEqual(b.tables.push_morts.map(x => x.endpoint), [s.endpoint]);
  // Un refus définitif n'est pas repris : chaque notification sort de la file, avec sa réponse au journal
  assert.deepEqual(b.tables.push_queue, []);
  assert.deepEqual(b.tables.push_journal.filter(x => x.user_id === u).map(x => [x.kind, x.code]),
    [['merci', 403], ['merci', 201], ['merci', 401], ['merci', 400], ['merci', 403]]);
  // Plusieurs refus dans un même tour ne comptent qu'une fois
  const s2 = b.abonner(u, 2);
  b.statutsPush.set(s2.endpoint, 403);
  enFile(b, u, 'merci', { nom: 'A' }); enFile(b, u, 'merci', { nom: 'B' }); enFile(b, u, 'merci', { nom: 'C' });
  assert.deepEqual(await corpsDe(await appel({ job: 'push' })), { sent: 0, failed: 3, removed: 0 });
  assert.equal(b.tables.push_subscriptions.find(x => x.id === s2.id).refus, 1);
});

test('refus en masse : tous les téléphones d’un service refusent et aucun n’accepte (clé de la plateforme ?) : rien n’est compté, c’est dit dans les Logs', async () => {
  const b = nouveauBanc();
  const us = [uid(21), uid(22), uid(23)];
  for (const u of us) b.tables.profiles.push(profil(u));
  const fcm = us.map(u => b.abonner(u, 1, 'https://fcm.googleapis.com'));
  const ailleurs = b.abonner(us[0], 2);   // un autre service, qui accepte : il ne change rien pour Google
  for (const s of fcm) b.statutsPush.set(s.endpoint, 403);
  const tour = async (qui = us) => { for (const u of qui) enFile(b, u, 'merci', { nom: 'Salma' }); return corpsDe(await appel({ job: 'push' })); };
  const refus = () => fcm.map(s => b.tables.push_subscriptions.find(x => x.id === s.id)?.refus);
  for (let i = 0; i < 3; i++) assert.deepEqual(await tour(), { sent: 1, failed: 3, removed: 0 });
  assert.deepEqual(refus(), [0, 0, 0], 'trois tours de refus en masse : personne n’est retiré');
  assert.deepEqual(b.tables.push_morts, []);
  assert.equal(b.tables.push_subscriptions.find(x => x.id === ailleurs.id).refus, 0);
  assert.ok(erreurs.some(e => e.includes('tous les téléphones de ce service refusent') && e.endsWith(' fcm')), 'Logs : le service est nommé, comme dans la base');
  assert.ok(erreurs.every(e => !us.some(u => e.includes(u)) && !fcm.some(s => e.includes(s.endpoint))), 'Logs : ni membre ni adresse');
  // Deux téléphones seulement refusent : ce sont eux, leurs refus comptent
  b.statutsPush.delete(fcm[2].endpoint);
  await tour();
  assert.deepEqual(refus(), [1, 1, 0], 'un téléphone du même service accepte : les refus des autres comptent');
  assert.deepEqual(N.refusEnMasse([{ id: 'a', code: 403, recu: false, refus: true }, { id: 'b', code: 401, recu: false, refus: true }], () => 'x'), [], 'moins de 3 : comptés');
  assert.equal(N.REFUS_EN_MASSE, 3);
});

test('refus en masse, un téléphone par tour (le cas courant) : Google refuse les quatre membres, trois messages chacun : personne n’est retiré', async () => {
  const b = nouveauBanc();
  const us = [uid(31), uid(32), uid(33), uid(34)];
  for (const u of us) b.tables.profiles.push(profil(u));
  const fcm = us.map(u => b.abonner(u, 1, 'https://fcm.googleapis.com'));
  for (const s of fcm) b.statutsPush.set(s.endpoint, 403);
  // Chaque message déclenche son propre appel, un destinataire à la fois : le garde-fou d'un tour ne voit qu'un téléphone
  for (let i = 0; i < 3; i++) for (const u of us) { enFile(b, u, 'merci', { nom: 'Salma' }); await appel({ job: 'push' }); }
  assert.equal(b.tables.push_subscriptions.length, 4, 'aucun téléphone retiré (avant : les quatre)');
  assert.deepEqual(b.tables.push_morts, [], 'aucune adresse bannie');
  assert.deepEqual(b.tables.push_subscriptions.map(x => x.refus), [3, 3, 3, 3], 'les refus sont comptés, la base attend une preuve');
  assert.equal(b.avertissements.length, 4, 'la base le dit une fois par téléphone');
  // La clé de la plateforme réparée : tout repart, le compte des refus revient à zéro
  for (const s of fcm) b.statutsPush.delete(s.endpoint);
  enFile(b, us[0], 'merci', { nom: 'Amine' });
  assert.deepEqual(await corpsDe(await appel({ job: 'push' })), { sent: 1, failed: 0, removed: 0 });
  assert.equal(b.tables.push_subscriptions.find(x => x.id === fcm[0].id).refus, 0);
});

test('refus en masse compté par membre : un membre seul avec trois vieux abonnements refusés : ses refus comptent, sans fausse alerte ; retirés dès que Google accepte un autre téléphone', async () => {
  const b = nouveauBanc();
  const u = uid(91), autre = uid(92);
  b.tables.profiles.push(profil(u), profil(autre));
  const vieux = [1, 2, 3].map(i => b.abonner(u, i, 'https://fcm.googleapis.com'));
  for (const s of vieux) b.statutsPush.set(s.endpoint, 403);
  for (let i = 0; i < 3; i++) { enFile(b, u, 'merci', { nom: 'X' + i }); await appel({ job: 'push' }); }
  assert.deepEqual(b.tables.push_subscriptions.map(x => x.refus), [3, 3, 3], 'comptés (avant : jamais, ils restaient pour toujours)');
  assert.ok(!erreurs.some(e => e.includes('tous les téléphones de ce service refusent')), 'Logs : pas d’alerte « clé de la plateforme » pour un seul membre');
  assert.deepEqual(N.refusEnMasse(vieux.map(s => ({ id: s.id, code: 403, recu: false, refus: true })), () => 'fcm', () => u), [], 'un membre : pas un refus en masse');
  assert.deepEqual(N.refusEnMasse([1, 2, 3].map(i => ({ id: 'a' + i, code: 403, recu: false, refus: true })), () => 'fcm', id => id), ['fcm'], 'trois membres : oui');
  // Google accepte le téléphone d'un autre membre : au refus suivant, les trois vieux abonnements sont retirés
  b.abonner(autre, 1, 'https://fcm.googleapis.com');
  enFile(b, autre, 'merci', { nom: 'Y' }); await appel({ job: 'push' });
  enFile(b, u, 'merci', { nom: 'Z' });
  assert.deepEqual(await corpsDe(await appel({ job: 'push' })), { sent: 0, failed: 3, removed: 3 });
  assert.deepEqual(b.tables.push_subscriptions.map(x => x.user_id), [autre]);
  assert.equal(b.tables.push_morts.length, 3);
  // Le service est nommé comme dans la base (service_push)
  assert.deepEqual(['https://fcm.googleapis.com/fcm/send/x', 'https://web.push.apple.com/x', 'https://updates.push.services.mozilla.com/wpush/v2/x',
    'https://wns2-par02p.notify.windows.com/w/?token=x', 'https://push.exemple.ma/x', 'pas une adresse'].map(N.servicePush),
  ['fcm', 'apple', 'mozilla', 'windows', 'autre', 'autre']);
});

test('413 : notification trop longue, notée au journal, pas reprise ; rien n’est compté contre le téléphone', async () => {
  const b = nouveauBanc();
  const u = uid(3);
  b.tables.profiles.push(profil(u));
  const s = b.abonner(u, 1);
  b.statutsPush.set(s.endpoint, 413);
  enFile(b, u, 'reponse', { nom: 'Nadia', titre: 'Une question' });
  assert.deepEqual(await corpsDe(await appel({ job: 'push' })), { sent: 0, failed: 1, removed: 0 });
  assert.deepEqual(b.tables.push_queue, [], 'la renvoyer donnerait la même réponse');
  assert.deepEqual(journal(b), [['reponse', 413]]);
  const abo = b.tables.push_subscriptions.find(x => x.id === s.id);
  assert.equal(abo.refus, 0); assert.equal(abo.dernier_code, 413);
});

test('jetée par la fonction : type inconnu, au journal (-4) et retirée de la file', async () => {
  const b = nouveauBanc();
  const u = uid(4);
  b.tables.profiles.push(profil(u));
  b.abonner(u, 1);
  enFile(b, u, 'type_qui_n_existe_pas', {});
  assert.deepEqual(await corpsDe(await appel({ job: 'push' })), { sent: 0, failed: 0, removed: 0 });
  assert.deepEqual(journal(b), [['type_qui_n_existe_pas', -4]]);
  assert.deepEqual(b.tables.push_queue, []);
  assert.equal(b.push.length, 0);
});

test('base pas encore mise à jour (sans push_resultats) : les téléphones partis sont retirés comme avant, l’envoi continue', async () => {
  const b = nouveauBanc();
  b.absentes.add('push_resultats');
  const u = uid(5);
  b.tables.profiles.push(profil(u));
  const parti = b.abonner(u, 1), ok = b.abonner(u, 2), refuse = b.abonner(u, 3);
  b.statutsPush.set(parti.endpoint, 410);
  b.statutsPush.set(refuse.endpoint, 403);
  enFile(b, u, 'merci', { nom: 'Salma' });
  assert.deepEqual(await corpsDe(await appel({ job: 'push' })), { sent: 1, failed: 1, removed: 1 });
  // Retiré par son identifiant, comme avant
  const del = b.journal.filter(x => x.methode === 'DELETE');
  assert.equal(del.length, 1);
  assert.ok(del[0].url.includes(`/push_subscriptions?id=in.(${parti.id})`));
  assert.deepEqual(b.tables.push_subscriptions.map(x => x.id).sort(), [ok.id, refuse.id].sort(), 'un refus n’est pas compté sans la base à jour');
  assert.deepEqual(b.tables.push_queue, []);
  assert.deepEqual(journal(b), [['merci', 201]]);
  assert.ok(erreurs.some(e => e.includes('push_resultats')), 'Logs : la base est à mettre à jour');
  // Une base tout à fait ancienne (sans journal) : rien ne bloque non plus
  delete b.tables.push_journal;
  enFile(b, u, 'merci', { nom: 'Amine' });
  assert.deepEqual(await corpsDe(await appel({ job: 'push' })), { sent: 1, failed: 1, removed: 0 });
});

test('heure limite : aucun envoi ne commence après 45 s ; la suite reste en file, sans trace au journal, et part au passage suivant', async () => {
  const b = nouveauBanc();
  const u = uid(6);
  b.tables.profiles.push(profil(u));
  b.abonner(u, 1);
  for (let i = 0; i < 8; i++) enFile(b, u, 'merci', { nom: 'N' + i });
  const vrai = Date.now;
  let decalage = 0;
  Date.now = () => vrai() + decalage;
  b.surPush = () => { decalage += 10_000; };   // chaque envoi prend 10 s
  try {
    assert.equal(N.DUREE_PUSH, 45_000);
    assert.deepEqual(await corpsDe(await appel({ job: 'push' })), { sent: 5, failed: 0, removed: 0, retry: 3 });
  } finally {
    Date.now = vrai;
    b.surPush = null;
  }
  assert.equal(b.tables.push_queue.length, 3, 'rien de perdu');
  assert.deepEqual(journal(b), Array(5).fill(['merci', 201]), 'pas de ligne pour ce qui n’a pas été essayé');
  // La base rappelle la fonction chaque minute : après 2 minutes, la suite part
  vieillir(b, 3);
  assert.deepEqual(await corpsDe(await appel({ job: 'push' })), { sent: 3, failed: 0, removed: 0 });
  assert.equal(b.tables.push_queue.length, 0);
  assert.deepEqual(b.push.map(x => x.message.body), Array.from({ length: 8 }, (_, i) => `N${i} te remercie pour ton aide.`));
});

test('« Tester » : le détail de chaque téléphone, au journal sous « test » ; en urgence haute', async () => {
  const b = nouveauBanc();
  const u = uid(7), sans = uid(8);
  b.tables.profiles.push(profil(u), profil(sans));
  b.jetons.set('jeton-u', u);
  b.jetons.set('jeton-sans', sans);
  const a = b.abonner(u, 1), c = b.abonner(u, 2), d = b.abonner(u, 3);
  b.statutsPush.set(c.endpoint, 403);
  b.recepteurs.delete(d.endpoint);   // service injoignable
  const tester = jeton => N.handler(requete({ job: 'test' }, { Authorization: `Bearer ${jeton}` })).then(corpsDe);
  assert.deepEqual(await tester('jeton-u'), { sent: 1, failed: 2, removed: 0, codes: [201, 403, 0], abonnements: 3 });
  assert.equal(b.push.find(p => p.endpoint === a.endpoint).entetes.urgency, 'high', 'le membre attend cette notification');
  assert.equal(b.tables.push_subscriptions.find(x => x.id === c.id).refus, 0, 'un refus du test ne compte pas contre le téléphone');
  assert.equal(b.tables.push_subscriptions.find(x => x.id === c.id).dernier_code, 403, 'mais sa réponse est notée');
  assert.deepEqual(journal(b), [['test', 201]]);
  // Aucun téléphone : la réponse le dit, le journal le note
  assert.deepEqual(await tester('jeton-sans'), { sent: 0, failed: 0, removed: 0, codes: [], abonnements: 0 });
  assert.deepEqual(b.tables.push_journal.at(-1), { user_id: sans, kind: 'test', code: -1 });
});

test('« Tester » appuyé quatre fois sur un téléphone que le service refuse : jamais retiré, toujours essayé', async () => {
  const b = nouveauBanc();
  const u = uid(51), autre = uid(52);
  b.tables.profiles.push(profil(u), profil(autre));
  b.jetons.set('jeton-membre', u);
  const s = b.abonner(u, 1, 'https://fcm.googleapis.com');
  b.abonner(autre, 1, 'https://fcm.googleapis.com');
  enFile(b, autre, 'merci', { nom: 'Y' }); await appel({ job: 'push' });   // Google accepte un autre téléphone
  b.statutsPush.set(s.endpoint, 403);
  const tester = () => N.handler(requete({ job: 'test' }, { Authorization: 'Bearer jeton-membre' })).then(corpsDe);
  for (let i = 0; i < 4; i++) assert.deepEqual(await tester(), { sent: 0, failed: 1, removed: 0, codes: [403], abonnements: 1 }, `essai ${i + 1}`);
  assert.equal(b.tables.push_subscriptions.find(x => x.id === s.id).refus, 0, 'avant : retiré au troisième appui, et son adresse bannie');
  assert.deepEqual(b.tables.push_morts, []);
  // Un téléphone parti (410) l'est toujours, même pendant un essai
  b.statutsPush.set(s.endpoint, 410);
  assert.deepEqual(await tester(), { sent: 0, failed: 0, removed: 1, codes: [410], abonnements: 1 });
  assert.equal(b.tables.push_subscriptions.find(x => x.id === s.id), undefined);
});

const NOW = new Date('2026-10-20T09:00:00Z');
const D = N.indexer(brut(jeu(NOW)), NOW);
const TOKEN = '6f1c2b8e-3d4a-4f5b-9c7d-0e1f2a3b4c5d';
const PHRASE = 'Reçois tes matchs et tes messages directement sur ton téléphone';
const PHRASE_AR = 'استقبل توافقاتك ورسائلك مباشرة على هاتفك';

test('emails : une ligne calme pour qui n’a de notifications sur aucun téléphone, en français et en arabe', () => {
  assert.deepEqual(N.TELEPHONE.fr, { phrase: PHRASE, lien: 'Activer les notifications' });
  assert.equal(N.TELEPHONE.ar.phrase, PHRASE_AR);
  assert.equal(N.lienNotifs(SITE), `${SITE}?notifs=1`);
  assert.equal(N.lienNotifs(`${SITE}?lang=ar`), `${SITE}?lang=ar&notifs=1`);
  const r = N.resumeDe(D.profils.get(ID.salma), D);
  const fr = N.rendreResume(r, 'fr', SITE, TOKEN, true);
  assert.ok(fr.html.includes(PHRASE) && fr.html.includes(`href="${SITE}?notifs=1"`));
  assert.ok(fr.texte.includes(`${PHRASE} : ${SITE}?notifs=1`));
  const ar = N.rendreResume(r, 'ar', SITE, TOKEN, true);
  assert.ok(ar.html.includes(PHRASE_AR) && ar.html.includes(`href="${SITE}?lang=ar&amp;notifs=1"`));
  assert.ok(ar.texte.includes(`${PHRASE_AR}: ${SITE}?lang=ar&notifs=1`));
  // Avec un téléphone, ou pour l'administration : rien
  assert.ok(!N.rendreResume(r, 'fr', SITE, TOKEN).html.includes(PHRASE));
  assert.ok(!N.rendreResume({ ...r, role: 'admin' }, 'fr', SITE, TOKEN, true).html.includes(PHRASE));
  // Les emails de notification aussi
  const offre = { id: uid(601), titre: 'PFE Lean', entreprise: 'OCP' };
  const dem = { id: uid(602), titre: 'Stage en maintenance', prenom: 'Salma', niveau: 4 };
  const emails = sansTel => [
    N.rendreAlerte([offre], 'fr', SITE, TOKEN, sansTel), N.rendreDemandes([dem], 'fr', SITE, TOKEN, sansTel),
    N.rendreMessages(2, ['Salma Bennani'], 'fr', SITE, TOKEN, sansTel), N.rendreRappel({ messages: 2 }, 'fr', SITE, TOKEN, sansTel),
  ];
  for (const m of emails(true)) {
    assert.ok(m.html.includes(PHRASE) && m.html.includes(`${SITE}?notifs=1`), m.sujet);
    assert.ok(m.texte.includes(`${PHRASE} : ${SITE}?notifs=1`), m.sujet);
  }
  for (const m of emails(false)) assert.ok(!m.html.includes(PHRASE) && !m.texte.includes(PHRASE), m.sujet);
  assert.ok(N.rendreMessages(1, ['Salma'], 'ar', SITE, TOKEN, true).html.includes(PHRASE_AR));
});

test('emails : la ligne va seulement à qui n’a aucun téléphone abonné (ni à l’administration)', async () => {
  const b = nouveauBanc();
  configurerEnv({ BREVO_API_KEY: 'xkeysib-test', SENDER_EMAIL: 'reseau@ensam-meknes.example' });
  const avec = uid(11), sans = uid(12), admin = uid(13);
  b.tables.profiles.push(profil(avec), profil(sans), profil(admin, { role: 'admin' }));
  b.abonner(avec, 1);
  const ligne = (id, n) => ({ id, email: `m${n}@exemple.ma`, langue: 'fr', token: `00000000-0000-4000-9000-00000000000${n}`, n: 1, noms: ['Salma Bennani'] });
  b.rpcs = { messages_a_signaler: () => [ligne(avec, 1), ligne(sans, 2), ligne(admin, 3)], messages_signales: () => undefined };
  assert.deepEqual(await corpsDe(await appel({ job: 'messages' })), { sent: 3, errors: 0, via: 'brevo' });
  const corps = n => b.brevo.find(x => x.corps.to[0].email === `m${n}@exemple.ma`).corps;
  assert.ok(!corps(1).htmlContent.includes(PHRASE), 'un téléphone abonné : rien');
  assert.ok(corps(2).htmlContent.includes(PHRASE) && corps(2).textContent.includes(`${SITE}?notifs=1`));
  assert.ok(!corps(3).htmlContent.includes(PHRASE), 'l’administration : rien');
  // Téléphones illisibles : l'email part sans la ligne
  b.brevo.length = 0;
  b.rpcs.messages_a_signaler = () => [ligne(sans, 2)];
  const lire = b.supabase.bind(b);
  b.supabase = (url, ...r) => (url.pathname.endsWith('/push_subscriptions') ? b.json({ message: 'panne' }, 500) : lire(url, ...r));
  assert.deepEqual(await corpsDe(await appel({ job: 'messages' })), { sent: 1, errors: 0, via: 'brevo' });
  assert.ok(!corps(2).htmlContent.includes(PHRASE));
  assert.ok(erreurs.some(e => e.includes('téléphones des destinataires illisibles')));
});
