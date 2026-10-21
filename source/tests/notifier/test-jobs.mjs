import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE, Banc, installer, configurerEnv, requete, uid, SITE, CLE_SERVICE, verifierJwt } from './banc.mjs';
import { ID, jeu } from './donnees.mjs';

const N = await import(MODULE);
const SECRET = 'secret-de-test-0123456789abcdef';
const fetchOrigine = globalThis.fetch;
let erreurs = [];
const errOrigine = console.error;

beforeEach(() => { erreurs = []; console.error = (...a) => erreurs.push(a.map(String).join(' ')); configurerEnv(); });
afterEach(() => { console.error = errOrigine; globalThis.fetch = fetchOrigine; });

function nouveauBanc() {
  const b = installer(new Banc());
  b.tables.app_secrets.push({ cle: 'notifier_secret', valeur: SECRET });
  return b;
}
const appel = (corps, entetes = {}) => N.handler(requete(corps, entetes));
const corpsDe = async r => JSON.parse(await r.text());
const profil = (id, langue = 'fr') => ({ id, full_name: 'Membre ' + id.slice(-2), role: 'etudiant', filiere: 'Génie Industriel', promo: 2028, langue, created_at: '2026-01-01T00:00:00Z' });

// ---------------------------------------------------------------------------
test('CORS : pré-vol et en-têtes sur chaque réponse', async () => {
  nouveauBanc();
  const r = await N.handler(new Request('https://x/functions/v1/notifier', { method: 'OPTIONS' }));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.equal(r.headers.get('access-control-allow-headers'), 'authorization, apikey, content-type, x-client-info, x-notifier');
  const r2 = await appel({ job: 'nimporte' });
  assert.equal(r2.headers.get('access-control-allow-origin'), '*');
});

test('requêtes invalides : 400 / 405', async () => {
  nouveauBanc();
  assert.equal((await appel({ job: 'nimporte' })).status, 400);
  assert.equal((await appel({})).status, 400);
  assert.equal((await appel('pas du json')).status, 400);
  assert.equal((await appel('null')).status, 400);
  assert.equal((await N.handler(requete(null, {}, 'GET'))).status, 405);
});

test('configuration absente : 500 sans détail', async () => {
  nouveauBanc();
  configurerEnv({ SUPABASE_URL: '' });
  const r = await appel({ job: 'cle' });
  assert.equal(r.status, 500);
  assert.deepEqual(await corpsDe(r), { error: 'Configuration incomplète' });
});

// ---------------------------------------------------------------------------
test('cle : crée la paire VAPID une fois, puis la relit', async () => {
  const b = nouveauBanc();
  const r1 = await corpsDe(await appel({ job: 'cle' }));
  const r2 = await corpsDe(await appel({ job: 'cle' }));
  assert.equal(r1.publicKey, r2.publicKey);
  const brut = Buffer.from(r1.publicKey, 'base64url');
  assert.equal(brut.length, 65);
  assert.equal(brut[0], 4);
  const jwk = JSON.parse(b.tables.app_secrets.find(x => x.cle === 'vapid_private_jwk').valeur);
  assert.equal(jwk.kty, 'EC');
  assert.equal(jwk.crv, 'P-256');
  assert.ok(jwk.d);
  assert.equal(jwk.x, brut.subarray(1, 33).toString('base64url'));
  assert.equal(jwk.y, brut.subarray(33).toString('base64url'));
  // L'insertion demande « on conflict do nothing »
  const post = b.journal.find(x => x.methode === 'POST' && x.url.includes('/app_secrets'));
  assert.match(post.entetes.get('prefer'), /resolution=ignore-duplicates/);
  assert.equal(post.entetes.get('apikey'), CLE_SERVICE);
  assert.equal(post.entetes.get('authorization'), `Bearer ${CLE_SERVICE}`);
});

test('cle : deux premiers appels simultanés donnent la même clé', async () => {
  const b = nouveauBanc();
  b.lenteur = 15;   // les deux lisent « vide » avant que l'un n'écrive
  const [a, c] = await Promise.all([appel({ job: 'cle' }), appel({ job: 'cle' })]);
  const ka = (await corpsDe(a)).publicKey, kc = (await corpsDe(c)).publicKey;
  assert.equal(ka, kc);
  assert.equal(b.journal.filter(x => x.methode === 'POST' && x.url.includes('/app_secrets')).length, 2, 'les deux ont tenté d’insérer');
  assert.equal(b.tables.app_secrets.filter(x => x.cle === 'vapid_public').length, 1);
});

// ---------------------------------------------------------------------------
test('push / resume : x-notifier absent ou faux -> 401, sans rien lire d’autre', async () => {
  const b = nouveauBanc();
  for (const job of ['push', 'resume']) {
    assert.equal((await appel({ job })).status, 401);
    assert.equal((await appel({ job }, { 'x-notifier': 'faux' })).status, 401);
    assert.equal((await appel({ job }, { 'x-notifier': SECRET + 'x' })).status, 401);
    assert.equal((await appel({ job }, { 'x-notifier': SECRET.slice(0, -1) })).status, 401);
  }
  assert.equal(b.appelsRpc.prendre_push, 0);
  assert.equal(b.appelsRpc.destinataires_resume, 0);
  // Secret absent de la base : toujours refusé
  b.tables.app_secrets = [];
  assert.equal((await appel({ job: 'push' }, { 'x-notifier': SECRET })).status, 401);
});

test('push : regroupé par membre, chiffré, VAPID, 410 supprimé, file vidée', async () => {
  const b = nouveauBanc();
  const [u1, u2, u3] = [uid(1), uid(2), uid(3)];
  b.tables.profiles.push(profil(u1), profil(u2, 'ar'), profil(u3));
  const s1 = b.abonner(u1, 1, 'https://push.example.net');
  const s2 = b.abonner(u1, 2, 'https://fcm.googleapis.com');
  const s3 = b.abonner(u2, 1, 'https://web.push.apple.com');
  b.statutsPush.set(s2.endpoint, 410);
  const q = (id, user_id, kind, data) => ({ id, user_id, kind, data, created_at: new Date().toISOString() });
  b.tables.push_queue.push(
    q(1, u1, 'mentorat_accepte', { nom: 'Youssef Alami', sujet: 'Mon CV', rdv_at: '2026-10-21T17:30:00Z' }),
    q(2, u2, 'candidature', { nom: 'Salma Idrissi', titre: 'Stage maintenance' }),
    q(3, u1, 'merci', { nom: 'Salma Idrissi' }),
    q(4, u3, 'test', {}),
    q(5, u1, 'type_inconnu', {}),
  );
  const r = await appel({ job: 'push' }, { 'x-notifier': SECRET });
  assert.equal(r.status, 200);
  assert.deepEqual(await corpsDe(r), { sent: 3, failed: 0, removed: 1 });
  // Abonnement 410 supprimé (par id), une seule tentative dessus
  assert.deepEqual(b.tables.push_subscriptions.map(x => x.id).sort(), [s1.id, s3.id].sort());
  assert.equal(b.push.filter(x => x.endpoint === s2.endpoint).length, 1);
  const del = b.journal.find(x => x.methode === 'DELETE');
  assert.ok(del.url.includes(`/push_subscriptions?id=in.(${s2.id})`));
  // Une seule lecture des abonnements par tour, pour tous les membres du lot
  const lectures = b.journal.filter(x => x.methode === 'GET' && x.url.includes('/push_subscriptions'));
  assert.equal(lectures.length, 1);
  for (const u of [u1, u2, u3]) assert.ok(decodeURIComponent(lectures[0].url).includes(u));
  // File vidée ; on relance jusqu'à une réponse vide
  assert.equal(b.tables.push_queue.length, 0);
  assert.equal(b.appelsRpc.prendre_push, 2);
  // Ordre et contenu sur le téléphone de u1
  const recu1 = b.push.filter(x => x.endpoint === s1.endpoint);
  assert.deepEqual(recu1.map(x => x.message.tag), ['mentorat_accepte', 'merci']);
  assert.deepEqual(recu1[0].message, {
    title: 'Rendez-vous fixé', body: 'Youssef Alami a accepté : Mon CV, mercredi 21 octobre à 17:30', url: SITE + '#mentorat', tag: 'mentorat_accepte',
  });
  assert.equal(recu1[0].entetes.urgency, 'high');
  assert.equal(recu1[1].entetes.urgency, 'normal');
  // En arabe pour u2
  const recu3 = b.push.find(x => x.endpoint === s3.endpoint);
  assert.equal(recu3.message.title, 'ترشيح جديد');
  assert.equal(recu3.message.url, SITE + '#espace');
  // En-têtes Web Push et jeton VAPID vérifié avec la clé publique enregistrée
  const publique = b.tables.app_secrets.find(x => x.cle === 'vapid_public').valeur;
  for (const p of b.push) {
    assert.equal(p.methode, 'POST');
    assert.equal(p.entetes.ttl, '86400');
    assert.equal(p.entetes['content-encoding'], 'aes128gcm');
    assert.equal(p.entetes['content-type'], 'application/octet-stream');
    const m = p.entetes.authorization.match(/^vapid t=([\w-]+\.[\w-]+\.[\w-]+), k=([\w-]+)$/);
    assert.ok(m, p.entetes.authorization);
    assert.equal(m[2], publique);
    const v = verifierJwt(m[1], publique);
    assert.equal(v.valide, true);
    assert.equal(v.claims.aud, new URL(p.endpoint).origin);
    assert.equal(v.claims.sub, SITE);
    assert.equal(p.dechiffre.rs, 4096);
  }
  assert.ok(erreurs.some(e => e.includes('notification ignorée') && e.includes('type_inconnu')));
});

test('push : plusieurs tours de 300, jusqu’à une file vide', async () => {
  const b = nouveauBanc();
  const u = uid(7);
  b.tables.profiles.push(profil(u));
  b.abonner(u, 1);
  for (let i = 1; i <= 650; i++) b.tables.push_queue.push({ id: i, user_id: u, kind: 'merci', data: { nom: 'N' + i } });
  const r = await corpsDe(await appel({ job: 'push' }, { 'x-notifier': SECRET }));
  assert.deepEqual(r, { sent: 650, failed: 0, removed: 0 });
  assert.equal(b.appelsRpc.prendre_push, 4);   // 300 + 300 + 50 + vide
  assert.equal(b.tables.push_queue.length, 0);
  // Les notifications d'un même téléphone partent dans l'ordre de la file
  assert.deepEqual(b.push.slice(0, 3).map(x => x.message.body), ['N1 te remercie pour ton aide.', 'N2 te remercie pour ton aide.', 'N3 te remercie pour ton aide.']);
});

test('push : 5 tours au plus', async () => {
  const b = nouveauBanc();
  const u = uid(7);
  b.tables.profiles.push(profil(u));   // pas de téléphone : rien à chiffrer
  for (let i = 1; i <= 1600; i++) b.tables.push_queue.push({ id: i, user_id: u, kind: 'merci', data: {} });
  const r = await corpsDe(await appel({ job: 'push' }, { 'x-notifier': SECRET }));
  assert.deepEqual(r, { sent: 0, failed: 0, removed: 0 });
  assert.equal(b.appelsRpc.prendre_push, 5);
  assert.equal(b.tables.push_queue.length, 100);   // le reste partira au prochain appel
});

test('push : garde-fou CPU, pas de nouveau tour après 900 envois', async () => {
  const b = nouveauBanc();
  const u = uid(7);
  b.tables.profiles.push(profil(u));
  b.abonner(u, 1);
  for (let i = 1; i <= 1600; i++) b.tables.push_queue.push({ id: i, user_id: u, kind: 'merci', data: { nom: 'N' + i } });
  const r = await corpsDe(await appel({ job: 'push' }, { 'x-notifier': SECRET }));
  assert.deepEqual(r, { sent: 900, failed: 0, removed: 0 });
  assert.equal(b.appelsRpc.prendre_push, 3);
  assert.equal(b.tables.push_queue.length, 700);   // rien de perdu : la suite reste en file
});

test('push : erreurs du service (500, réseau) comptées, 404 supprimé', async () => {
  const b = nouveauBanc();
  const u = uid(8);
  b.tables.profiles.push(profil(u));
  const a = b.abonner(u, 1), c = b.abonner(u, 2), d = b.abonner(u, 3);
  b.statutsPush.set(a.endpoint, 500);
  b.statutsPush.set(c.endpoint, 404);
  b.recepteurs.delete(d.endpoint);   // hôte injoignable
  b.tables.push_queue.push({ id: 1, user_id: u, kind: 'test', data: {} });
  const r = await corpsDe(await appel({ job: 'push' }, { 'x-notifier': SECRET }));
  assert.deepEqual(r, { sent: 0, failed: 2, removed: 1 });
  assert.deepEqual(b.tables.push_subscriptions.map(x => x.id).sort(), [a.id, d.id].sort());
  assert.ok(erreurs.some(e => e.includes('push refusé') && e.includes('500')));
});

// ---------------------------------------------------------------------------
test('test : 401 sans jeton utilisateur ou avec un jeton invalide', async () => {
  const b = nouveauBanc();
  assert.equal((await appel({ job: 'test' })).status, 401);
  assert.equal((await appel({ job: 'test' }, { Authorization: 'Bearer pas-un-vrai-jeton' })).status, 401);
  assert.equal(b.push.length, 0);
});

test('test : notification d’essai sur les téléphones du membre connecté, dans sa langue', async () => {
  const b = nouveauBanc();
  const u = uid(9), autre = uid(10);
  b.tables.profiles.push(profil(u, 'ar'), profil(autre));
  b.jetons.set('jeton-utilisateur', u);
  const a = b.abonner(u, 1), g = b.abonner(u, 2);
  b.abonner(autre, 1);
  b.statutsPush.set(g.endpoint, 410);
  const r = await appel({ job: 'test' }, { Authorization: 'Bearer jeton-utilisateur' });
  assert.equal(r.status, 200);
  assert.deepEqual(await corpsDe(r), { sent: 1 });
  assert.equal(b.push.length, 2);
  assert.ok(b.push.every(p => p.endpoint !== `${'https://push.example.net'}/s/${autre.slice(-4)}-1`));
  const ok = b.push.find(p => p.endpoint === a.endpoint);
  assert.deepEqual(ok.message, { title: 'تم تفعيل الإشعارات', body: 'ستصلك هنا أهم أخبار شبكة ENSAM.', url: SITE + '#accueil', tag: 'test' });
  assert.ok(!b.tables.push_subscriptions.some(x => x.id === g.id));
  // Le jeton est vérifié auprès de Supabase Auth
  const auth = b.journal.find(x => x.url.endsWith('/auth/v1/user'));
  assert.equal(auth.entetes.get('authorization'), 'Bearer jeton-utilisateur');
  assert.ok(auth.entetes.get('apikey'));
});

// ---------------------------------------------------------------------------
test('resume : sans Gmail ni Brevo, rien n’est fait', async () => {
  const b = nouveauBanc();
  const r = await appel({ job: 'resume' }, { 'x-notifier': SECRET });
  assert.deepEqual(await corpsDe(r), { skipped: 'email' });
  assert.equal(b.appelsRpc.destinataires_resume, 0);
  configurerEnv({ BREVO_API_KEY: 'xkeysib-test' });   // expéditeur manquant
  assert.deepEqual(await corpsDe(await appel({ job: 'resume' }, { 'x-notifier': SECRET })), { skipped: 'email' });
  configurerEnv({ GMAIL_USER: 'reseau.test@gmail.com' });   // mot de passe d'application manquant
  assert.deepEqual(await corpsDe(await appel({ job: 'resume' }, { 'x-notifier': SECRET })), { skipped: 'email' });
});

test('resume : résumés envoyés, vides sautés, notif_etat marqué, une fois par semaine', async () => {
  const b = nouveauBanc();
  configurerEnv({ BREVO_API_KEY: 'xkeysib-test', SENDER_EMAIL: 'reseau@ensam-meknes.example' });
  const j = jeu(new Date());
  Object.assign(b.tables, j.tables);
  for (const [id, e] of Object.entries(j.emails)) b.emails.set(id, e);
  b.echecsBrevo.add(j.emails[ID.omar]);
  b.delaiBrevo = 10;
  const r = await appel({ job: 'resume' }, { 'x-notifier': SECRET });
  assert.equal(r.status, 200);
  // 14 destinataires (Karim s'est désabonné, Ghita est inscrite d'hier) ; Rachid, Hamza et Leila n'ont rien cette semaine
  assert.deepEqual(await corpsDe(r), { sent: 10, empty: 3, errors: 1, via: 'brevo' });
  assert.ok(b.maxEnVol <= 5, `au plus 5 envois en même temps (vu ${b.maxEnVol})`);
  assert.ok(b.maxEnVol >= 2);
  const destinataires = b.brevo.map(x => x.corps.to[0].email);
  for (const vide of [ID.rachid, ID.hamza, ID.leila, ID.karim, ID.ghita]) assert.ok(!destinataires.includes(j.emails[vide]), vide);
  // Forme du corps Brevo
  for (const { entetes, corps } of b.brevo) {
    assert.equal(entetes['api-key'], 'xkeysib-test');
    assert.deepEqual(Object.keys(corps).sort(), ['headers', 'htmlContent', 'sender', 'subject', 'textContent', 'to']);
    assert.deepEqual(corps.sender, { name: 'Réseau ENSAM Meknès', email: 'reseau@ensam-meknes.example' });
    assert.equal(corps.to.length, 1);
    const id = Object.keys(j.emails).find(k => j.emails[k] === corps.to[0].email);
    const token = b.tables.notif_etat.find(n => n.user_id === id).token;
    const desabo = `${SITE}#desabo/${token}`;
    assert.equal(corps.headers['List-Unsubscribe'], `<${desabo}>`);
    assert.ok(corps.htmlContent.includes(`href="${desabo}"`));
    assert.ok(corps.textContent.includes(desabo));
    assert.ok(corps.subject.length > 5);
  }
  // Langue : arabe pour Youssef, français pour Salma
  const youssef = b.brevo.find(x => x.corps.to[0].email === j.emails[ID.youssef]).corps;
  assert.match(youssef.htmlContent, /<html lang="ar" dir="rtl">/);
  assert.match(youssef.subject, /شبكة ENSAM$/);
  const salma = b.brevo.find(x => x.corps.to[0].email === j.emails[ID.salma]).corps;
  assert.match(salma.htmlContent, /<html lang="fr" dir="ltr">/);
  assert.equal(salma.subject, 'Confirme ton recrutement chez OCP · Réseau ENSAM');
  // notif_etat : tous les examinés (envoyés ou vides) sont marqués, pas l'échec
  const marques = b.tables.notif_etat.filter(n => n.resume_at).map(n => n.user_id);
  assert.equal(marques.length, 13);
  assert.ok(!marques.includes(ID.omar));
  for (const id of [ID.rachid, ID.hamza, ID.leila, ID.salma, ID.youssef]) assert.ok(marques.includes(id), id);
  assert.equal(b.journal.filter(x => x.methode === 'PATCH').length, 1);
  // Le lendemain : seul l'échec revient
  b.brevo = [];
  const r2 = await corpsDe(await appel({ job: 'resume' }, { 'x-notifier': SECRET }));
  assert.deepEqual(r2, { sent: 0, empty: 0, errors: 1, via: 'brevo' });
  assert.deepEqual(b.brevo.map(x => x.corps.to[0].email), [j.emails[ID.omar]]);
  assert.ok(erreurs.some(e => e.includes('Brevo a refusé')));
});

test('resume : personne à prévenir', async () => {
  nouveauBanc();
  configurerEnv({ BREVO_API_KEY: 'k', SENDER_EMAIL: 'a@b.ma' });
  assert.deepEqual(await corpsDe(await appel({ job: 'resume' }, { 'x-notifier': SECRET })), { sent: 0, empty: 0, errors: 0 });
});

test('erreur de la base : 500 générique, rien ne fuit', async () => {
  const b = nouveauBanc();
  b.tables.push_queue.push({ id: 1, user_id: uid(1), kind: 'test', data: {} });
  const rpc = b.rpc.bind(b);
  b.rpc = () => b.json({ message: 'permission denied for table secrete', hint: CLE_SERVICE }, 500);
  const r = await appel({ job: 'push' }, { 'x-notifier': SECRET });
  assert.equal(r.status, 500);
  const t = await r.text();
  assert.equal(t, JSON.stringify({ error: 'Erreur interne' }));
  assert.ok(!t.includes(CLE_SERVICE) && !t.includes('secrete'));
  assert.ok(erreurs.some(e => e.includes('push')));
  b.rpc = rpc;
});
