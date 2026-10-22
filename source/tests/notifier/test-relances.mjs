// Rappel d'inscription : un seul email aux comptes créés sans profil, dans leur langue, sans lien de désabonnement
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE, Banc, installer, configurerEnv, requete, uid, SITE } from './banc.mjs';
import { lireMime } from './smtp-faux.mjs';

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

test('rappel : sans Gmail ni Brevo, rien n’est lu', async () => {
  const b = nouveauBanc();
  b.rpcs = { comptes_a_relancer: () => { throw new Error('ne doit pas être appelé'); } };
  assert.deepEqual(await corpsDe(await appel({ job: 'relances' })), { skipped: 'email' });
});

test('rappel : un email par compte, dans sa langue, un bouton vers le site ; seuls les envois réussis sont notés', async () => {
  const b = nouveauBanc();
  configurerEnv({ BREVO_API_KEY: 'xkeysib-test', SENDER_EMAIL: 'reseau@ensam-meknes.example' });
  const lignes = [ligne(1), ligne(2, { langue: 'ar' }), ligne(3), ligne(4, { id: 'pas-un-uuid' }), ligne(5, { email: null })];
  b.rpcs = { comptes_a_relancer: a => { assert.deepEqual(a, { p_max: 100 }); return lignes; }, relances_envoyees: () => undefined };
  b.echecsBrevo.add('c3@exemple.ma');
  assert.deepEqual(await corpsDe(await appel({ job: 'relances' })), { sent: 2, errors: 3, via: 'brevo' });
  assert.deepEqual([...b.argsRpc.relances_envoyees[0].p_ids].sort(), [uid(1), uid(2)]);
  const fr = b.brevo.find(x => x.corps.to[0].email === 'c1@exemple.ma').corps;
  assert.equal(fr.subject, 'Ton profil t’attend sur le Réseau ENSAM Meknès');
  assert.ok(fr.htmlContent.includes(`href="${SITE}"`) && fr.htmlContent.includes('Terminer mon profil'));
  assert.ok(fr.textContent.includes(`Terminer mon profil : ${SITE}`));
  assert.ok(fr.textContent.includes('une seule fois'));
  assert.equal(fr.headers, undefined, 'pas de lien de désabonnement : il part une seule fois');
  assert.ok(!/<img/i.test(fr.htmlContent), 'pas d’image dans le contenu');
  const ar = b.brevo.find(x => x.corps.to[0].email === 'c2@exemple.ma').corps;
  assert.match(ar.htmlContent, /<html lang="ar" dir="rtl">/);
  assert.equal(ar.subject, 'ملفك ينتظرك على شبكة ENSAM مكناس');
  assert.ok(ar.htmlContent.includes('إكمال ملفي'));
});

test('rappel : personne à relancer, rien à noter ; le secret est exigé', async () => {
  const b = nouveauBanc();
  configurerEnv({ BREVO_API_KEY: 'k', SENDER_EMAIL: 'a@b.ma' });
  b.rpcs = { comptes_a_relancer: () => [], relances_envoyees: () => { throw new Error('rien à noter'); } };
  assert.deepEqual(await corpsDe(await appel({ job: 'relances' })), { sent: 0, errors: 0 });
  assert.equal((await N.handler(requete({ job: 'relances' }, {}))).status, 401);
});

test('email sans désabonnement : pas d’en-tête List-Unsubscribe', () => {
  const m = N.messageMime({ nom: 'Réseau', email: 'r@gmail.com' }, 'x@y.ma', N.rendreRelance('fr', SITE));
  assert.ok(!/^List-Unsubscribe:/m.test(m));
  assert.match(lireMime(m).parties[0].texte, /Terminer mon profil/);
  assert.match(N.messageMime({ nom: 'R', email: 'r@gmail.com' }, 'x@y.ma', { sujet: 'S', html: '', texte: '', desabo: 'https://s/#desabo/t' }), /^List-Unsubscribe: <https:\/\/s\/#desabo\/t>$/m);
});
