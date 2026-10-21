// Messagerie : notification sur le téléphone (aperçu, lien vers la conversation) et email des messages non lus
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE, Banc, installer, configurerEnv, requete, uid, SITE } from './banc.mjs';

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
const DE = uid(7001);

test('message : le nom en titre, un aperçu en texte, la conversation en lien', () => {
  const t = (d, l = 'fr') => N.texteNotif('message', d, l, SITE);
  assert.deepEqual(t({ nom: 'Salma Bennani', de: DE, type: 'texte', texte: 'Merci pour ton temps !' }),
    { title: 'Salma Bennani', body: 'Merci pour ton temps !', url: `${SITE}#messages/${DE}`, tag: `message-${DE}` });
  assert.equal(t({ nom: 'Salma', de: DE, type: 'photo' }).body, '📷 Photo');
  assert.equal(t({ nom: 'Salma', de: DE, type: 'vocal', duree: 42 }).body, '🎤 Message vocal (0:42)');
  assert.equal(t({ nom: 'Salma', de: DE, type: 'vocal', duree: 75 }).body, '🎤 Message vocal (1:15)');
  assert.equal(t({ nom: 'Salma', de: 'pas-un-uuid', type: 'texte', texte: 'x' }).url, `${SITE}#messages`);
  assert.equal(t({ de: DE, type: 'texte' }).title, 'Un membre');
  assert.equal(t({ nom: 'Salma', de: DE, type: 'texte' }).body, 'Nouveau message');
  const a = t({ nom: 'Salma', de: DE, type: 'vocal', duree: 9 }, 'ar');
  assert.equal(a.body, '🎤 رسالة صوتية (0:09)');
  assert.ok(a.title.includes('⁨Salma⁩'));
  assert.equal(t({ nom: 'Salma', de: DE, type: 'photo' }, 'ar').body, '📷 صورة');
  assert.equal(N.urgence('message'), 'high');
});

const ligne = (n, x = {}) => ({ id: uid(n), email: `m${n}@exemple.ma`, langue: 'fr', token: `00000000-0000-4000-9000-0000000000${String(n).padStart(2, '0')}`, n: 1, noms: ['Salma Bennani'], ...x });

test('messages non lus : sans Gmail ni Brevo, rien n’est lu', async () => {
  const b = nouveauBanc();
  b.rpcs = { messages_a_signaler: () => { throw new Error('ne doit pas être appelé'); } };
  assert.deepEqual(await corpsDe(await appel({ job: 'messages' })), { skipped: 'email' });
});

test('messages non lus : un email par personne, qui a écrit (jamais le contenu), désabonnement, seuls les envois marqués', async () => {
  const b = nouveauBanc();
  configurerEnv({ BREVO_API_KEY: 'xkeysib-test', SENDER_EMAIL: 'reseau@ensam-meknes.example' });
  const lignes = [ligne(1), ligne(2, { n: 3, noms: ['Youssef <Alaoui>', 'Nadia Idrissi'], langue: 'ar' }), ligne(3), ligne(4, { n: 0 }), ligne(5, { id: 'pas-un-uuid' })];
  b.rpcs = { messages_a_signaler: a => { assert.deepEqual(a, { p_max: 100 }); return lignes; }, messages_signales: () => undefined };
  b.echecsBrevo.add('m3@exemple.ma');
  assert.deepEqual(await corpsDe(await appel({ job: 'messages' })), { sent: 2, errors: 3, via: 'brevo' });
  assert.deepEqual([...b.argsRpc.messages_signales[0].p_ids].sort(), [uid(1), uid(2)]);
  const m1 = b.brevo.find(x => x.corps.to[0].email === 'm1@exemple.ma').corps;
  assert.equal(m1.subject, 'Salma Bennani t’a écrit · Réseau ENSAM');
  assert.ok(m1.htmlContent.includes(`href="${SITE}#messages"`));
  assert.ok(m1.htmlContent.includes('Un message t’attend de la part de <strong>Salma Bennani</strong>.'));
  const desabo = `${SITE}#desabo/${lignes[0].token}/messages`;
  assert.equal(m1.headers['List-Unsubscribe'], `<${desabo}>`);
  assert.ok(m1.textContent.includes(desabo));
  assert.ok(!/<img/i.test(m1.htmlContent), 'pas d’image dans le contenu');
  const m2 = b.brevo.find(x => x.corps.to[0].email === 'm2@exemple.ma').corps;
  assert.match(m2.htmlContent, /<html lang="ar" dir="rtl">/);
  assert.equal(m2.subject, '3 رسائل جديدة · شبكة ENSAM');
  assert.ok(m2.htmlContent.includes('Youssef &lt;Alaoui&gt;') && !m2.htmlContent.includes('<Alaoui>'), 'nom échappé');
});

test('messages non lus : personne à prévenir', async () => {
  const b = nouveauBanc();
  configurerEnv({ BREVO_API_KEY: 'k', SENDER_EMAIL: 'a@b.ma' });
  b.rpcs = { messages_a_signaler: () => [], messages_signales: () => { throw new Error('rien à marquer'); } };
  assert.deepEqual(await corpsDe(await appel({ job: 'messages' })), { sent: 0, errors: 0 });
});
