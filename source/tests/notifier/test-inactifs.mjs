// Compte sans connexion depuis 3 ans : un email 30 jours avant sa suppression, dans sa langue, sans lien de désabonnement
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
const ligne = (n, x = {}) => ({ id: uid(n), email: `c${n}@exemple.ma`, langue: 'fr', ...x });

test('compte inactif : sans Gmail ni Brevo, personne n’est lu ni noté (donc personne ne sera supprimé)', async () => {
  const b = nouveauBanc();
  b.rpcs = { comptes_inactifs_a_prevenir: () => { throw new Error('ne doit pas être appelé'); } };
  assert.deepEqual(await corpsDe(await appel({ job: 'inactifs' })), { skipped: 'email' });
});

test('compte inactif : un email par compte, dans sa langue, « Garder mon compte » ; seuls les envois réussis sont notés', async () => {
  const b = nouveauBanc();
  configurerEnv({ BREVO_API_KEY: 'xkeysib-test', SENDER_EMAIL: 'reseau@ensam-meknes.example' });
  const lignes = [ligne(1), ligne(2, { langue: 'ar' }), ligne(3), ligne(4, { id: 'pas-un-uuid' }), ligne(5, { email: null })];
  b.rpcs = { comptes_inactifs_a_prevenir: a => { assert.deepEqual(a, { p_max: 100 }); return lignes; }, comptes_inactifs_prevenus: () => undefined };
  b.echecsBrevo.add('c3@exemple.ma');
  assert.deepEqual(await corpsDe(await appel({ job: 'inactifs' })), { sent: 2, errors: 3, via: 'brevo' });
  assert.deepEqual([...b.argsRpc.comptes_inactifs_prevenus[0].p_ids].sort(), [uid(1), uid(2)]);
  const fr = b.brevo.find(x => x.corps.to[0].email === 'c1@exemple.ma').corps;
  assert.equal(fr.subject, 'Ton compte sur le Réseau ENSAM Meknès sera supprimé dans 30 jours');
  assert.ok(fr.htmlContent.includes(`href="${SITE}"`) && fr.htmlContent.includes('Garder mon compte'));
  assert.match(fr.textContent, /3 ans sans connexion[\s\S]*ouvrir la plateforme une fois dans les 30 jours/);
  assert.ok(fr.textContent.includes(`Garder mon compte : ${SITE}`));
  assert.equal(fr.headers, undefined, 'pas de lien de désabonnement : c’est une information sur le compte');
  assert.ok(!/<img/i.test(fr.htmlContent), 'pas d’image dans le contenu');
  const ar = b.brevo.find(x => x.corps.to[0].email === 'c2@exemple.ma').corps;
  assert.match(ar.htmlContent, /<html lang="ar" dir="rtl">/);
  assert.equal(ar.subject, 'سيُحذف حسابك على شبكة ENSAM مكناس بعد 30 يومًا');
  assert.ok(ar.htmlContent.includes('الاحتفاظ بحسابي'));
  assert.ok(!/القدامى/.test(ar.htmlContent));
});

test('compte inactif : personne à prévenir, rien à noter ; le secret est exigé', async () => {
  const b = nouveauBanc();
  configurerEnv({ BREVO_API_KEY: 'k', SENDER_EMAIL: 'a@b.ma' });
  b.rpcs = { comptes_inactifs_a_prevenir: () => [], comptes_inactifs_prevenus: () => { throw new Error('rien à noter'); } };
  assert.deepEqual(await corpsDe(await appel({ job: 'inactifs' })), { sent: 0, errors: 0 });
  assert.equal((await N.handler(requete({ job: 'inactifs' }, {}))).status, 401);
});
