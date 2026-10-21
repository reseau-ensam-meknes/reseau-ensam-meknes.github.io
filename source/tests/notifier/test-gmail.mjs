import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE, Banc, installer, configurerEnv, requete, SITE } from './banc.mjs';
import { ID, jeu } from './donnees.mjs';
import { FauxGmail, brancher, lireMime, decoderMot } from './smtp-faux.mjs';

const N = await import(MODULE);
const SECRET = 'secret-de-test-0123456789abcdef';
const GMAIL = 'reseau.test@gmail.com';
const fetchOrigine = globalThis.fetch;
const connecterOrigine = N.tls.connecter;
let erreurs = [], faux;
const errOrigine = console.error;

beforeEach(async () => {
  erreurs = []; console.error = (...a) => erreurs.push(a.map(String).join(' '));
  faux = await new FauxGmail({ user: GMAIL }).demarrer();
});
afterEach(async () => {
  console.error = errOrigine; globalThis.fetch = fetchOrigine; N.tls.connecter = connecterOrigine;
  await faux.arreter();
});

function banc() {
  const b = installer(new Banc());
  b.tables.app_secrets.push({ cle: 'notifier_secret', valeur: SECRET });
  const j = jeu(new Date());
  Object.assign(b.tables, j.tables);
  for (const [id, e] of Object.entries(j.emails)) b.emails.set(id, e);
  return { b, j };
}
const resume = async () => JSON.parse(await (await N.handler(requete({ job: 'resume' }, { 'x-notifier': SECRET }))).text());
const pour = (adresse) => faux.messages.find(m => m.a[0] === adresse);

test('resume par Gmail : 465 en TLS, compte du mot de passe sans espaces, messages lisibles', async () => {
  const { b, j } = banc();
  configurerEnv({ GMAIL_USER: GMAIL, GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' });
  faux.rejets.add(j.emails[ID.omar]);
  faux.delai = 15;
  const vus = brancher(N, faux);
  assert.deepEqual(await resume(), { sent: 10, empty: 3, errors: 1, via: 'gmail' });
  assert.ok(vus.every(v => v === 'smtp.gmail.com:465'), vus.join());
  assert.equal(b.brevo.length, 0, 'rien par Brevo');
  assert.ok(faux.maxOuvertes <= 3 && faux.maxOuvertes >= 2, `connexions en même temps : ${faux.maxOuvertes}`);
  assert.ok(faux.connexions <= 3, `connexions réutilisées (${faux.connexions})`);
  assert.equal(faux.quits, faux.connexions, 'chaque connexion est fermée proprement');
  assert.equal(faux.messages.length, 10);
  for (const m of faux.messages) {
    assert.equal(m.de, GMAIL);
    assert.equal(m.a.length, 1);
    assert.ok(!/(^|[^\r])\n/.test(m.brut), 'fins de ligne CRLF');
    assert.ok(m.brut.split('\r\n').every(l => l.length <= 998), 'lignes de 998 caractères au plus');
    const x = lireMime(m.brut);
    assert.ok(x.fin);
    assert.equal(decoderMot(x.entetes.from), `Réseau ENSAM Meknès <${GMAIL}>`);
    assert.equal(x.entetes.to, `<${m.a[0]}>`);
    assert.match(x.entetes.date, /^[A-Z][a-z]{2}, \d\d [A-Z][a-z]{2} \d{4} \d\d:\d\d:\d\d \+0000$/);
    assert.match(x.entetes['message-id'], /^<[0-9a-f-]{36}@gmail\.com>$/);
    for (const mot of x.entetes.subject.split('\r\n ')) assert.ok(mot.length <= 76, mot);
    const id = Object.keys(j.emails).find(k => j.emails[k] === m.a[0]);
    const desabo = `${SITE}#desabo/${b.tables.notif_etat.find(n => n.user_id === id).token}`;
    assert.equal(x.entetes['list-unsubscribe'], `<${desabo}>`);
    assert.deepEqual(x.parties.map(p => p.type), ['text/plain', 'text/html']);
    assert.ok(x.parties[0].texte.includes(desabo));
    assert.ok(x.parties[1].texte.includes(`href="${desabo}"`));
    assert.doesNotMatch(x.parties[1].texte, /<img/i);
  }
  const youssef = lireMime(pour(j.emails[ID.youssef]).brut);
  assert.match(decoderMot(youssef.entetes.subject), /شبكة ENSAM$/);
  assert.match(youssef.parties[1].texte, /<html lang="ar" dir="rtl">/);
  const salma = lireMime(pour(j.emails[ID.salma]).brut);
  assert.equal(decoderMot(salma.entetes.subject), 'Confirme ton recrutement chez OCP · Réseau ENSAM');
  // l'échec n'est pas marqué : il repartira demain
  assert.equal(b.tables.notif_etat.filter(n => n.resume_at).length, 13);
  assert.ok(erreurs.some(e => e.includes('Gmail a refusé un email')));
  assert.ok(!erreurs.some(e => e.includes('abcdefghijklmnop')), 'le mot de passe n’apparaît jamais dans les journaux');
});

test('Gmail refuse le mot de passe : Brevo prend le relais', async () => {
  const { b } = banc();
  configurerEnv({ GMAIL_USER: GMAIL, GMAIL_APP_PASSWORD: 'mauvais', BREVO_API_KEY: 'xkeysib-test', SENDER_EMAIL: 'reseau@ensam-meknes.example' });
  brancher(N, faux);
  const r = await resume();
  assert.deepEqual(r, { sent: 11, empty: 3, errors: 0, via: 'gmail+brevo' });
  assert.equal(faux.messages.length, 0);
  assert.equal(b.brevo.length, 11);
  assert.ok(faux.auths <= 3, `Gmail n’est pas réessayé pour chaque email (${faux.auths})`);
  assert.ok(erreurs.some(e => e.includes('Gmail refuse les envois') && e.includes('535')));
});

test('Gmail refuse le mot de passe, sans Brevo : rien n’est marqué', async () => {
  const { b } = banc();
  configurerEnv({ GMAIL_USER: GMAIL, GMAIL_APP_PASSWORD: 'mauvais' });
  brancher(N, faux);
  assert.deepEqual(await resume(), { sent: 0, empty: 3, errors: 11, via: 'gmail' });
  assert.equal(b.tables.notif_etat.filter(n => n.resume_at).length, 3, 'seuls les résumés vides sont marqués');
});

test('limite du jour atteinte : le reste part par Brevo', async () => {
  const { b } = banc();
  configurerEnv({ GMAIL_USER: GMAIL, GMAIL_APP_PASSWORD: 'abcdefghijklmnop', BREVO_API_KEY: 'k', SENDER_EMAIL: 'a@b.ma' });
  faux.limite = 4;
  brancher(N, faux);
  const r = await resume();
  assert.equal(r.sent, 11);
  assert.equal(r.via, 'gmail+brevo');
  assert.equal(faux.messages.length, 4);
  assert.equal(b.brevo.length, 7);
  const tous = [...faux.messages.map(m => m.a[0]), ...b.brevo.map(x => x.corps.to[0].email)];
  assert.equal(new Set(tous).size, 11, 'personne ne reçoit deux fois');
});

test('connexion coupée par Gmail entre deux envois : un nouvel essai sur une connexion neuve', async () => {
  banc();
  configurerEnv({ GMAIL_USER: GMAIL, GMAIL_APP_PASSWORD: 'abcdefghijklmnop' });
  faux.couperApres = 2;
  brancher(N, faux);
  assert.deepEqual(await resume(), { sent: 11, empty: 3, errors: 0, via: 'gmail' });
  assert.equal(new Set(faux.messages.map(m => m.a[0])).size, 11);
  assert.ok(faux.connexions >= 6);
});

test('Gmail injoignable : erreurs comptées, pas de plantage', async () => {
  const { b } = banc();
  configurerEnv({ GMAIL_USER: GMAIL, GMAIL_APP_PASSWORD: 'abcdefghijklmnop' });
  N.tls.connecter = () => Promise.reject(new Error('Connection refused'));
  assert.deepEqual(await resume(), { sent: 0, empty: 3, errors: 11, via: 'gmail' });
  assert.equal(b.brevo.length, 0);
  assert.ok(erreurs.some(e => e.includes('Gmail injoignable')));
});

test('serveur muet : abandon après le délai, sans bloquer la fonction', async () => {
  banc();
  configurerEnv({ GMAIL_USER: GMAIL, GMAIL_APP_PASSWORD: 'abcdefghijklmnop' });
  let ferme = 0;
  N.tls.connecter = async () => ({ read: () => new Promise(() => {}), write: async p => p.length, close: () => { ferme++; } });
  const t = Date.now();
  // délai SMTP de 20 s : on vérifie seulement la forme avec un minuteur accéléré
  const vrai = globalThis.setTimeout;
  globalThis.setTimeout = (f, ms, ...a) => vrai(f, Math.min(ms, 5), ...a);
  try {
    assert.deepEqual(await resume(), { sent: 0, empty: 3, errors: 11, via: 'gmail' });
  } finally { globalThis.setTimeout = vrai; }
  assert.ok(Date.now() - t < 5000);
  assert.ok(ferme >= 11);
  assert.ok(erreurs.some(e => e.includes('pas de réponse')));
});

test('en-têtes : mots encodés de 75 caractères au plus, ASCII laissé tel quel', () => {
  assert.equal(N.enteteMot('Hello world'), 'Hello world');
  const long = 'سلمى، عندك 3 عروض جديدة و موعد إرشاد هاد الأسبوع · شبكة ENSAM';
  const v = N.enteteMot(long);
  for (const mot of v.split('\r\n ')) assert.ok(mot.length <= 75 && /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/.test(mot), mot);
  assert.equal(decoderMot(v), long);
  assert.equal(N.enteteMot('a\r\nBcc: x@y.z'), 'a Bcc: x@y.z', 'pas d’injection d’en-tête');
  const m = N.messageMime({ nom: 'Réseau', email: 'r@gmail.com' }, 'x@y.ma', { sujet: 'S', html: '<p>é</p>', texte: '.début\nfin', desabo: 'https://s/#desabo/t' }, new Date('2026-10-25T08:00:00Z'), '11111111-2222-4333-8444-555555555555');
  assert.match(m, /^Date: Sun, 25 Oct 2026 08:00:00 \+0000$/m);
  assert.equal(lireMime(m).parties[0].texte, '.début\nfin');
});

test('essai_email : le résumé part tout de suite vers les administrateurs seulement, sans rien marquer', async () => {
  const { b, j } = banc();
  configurerEnv({ GMAIL_USER: GMAIL, GMAIL_APP_PASSWORD: 'abcdefghijklmnop' });
  brancher(N, faux);
  const admins = b.tables.profiles.filter(p => p.role === 'admin');
  assert.ok(admins.length >= 1);
  const r = JSON.parse(await (await N.handler(requete({ job: 'essai_email' }, { 'x-notifier': SECRET }))).text());
  assert.deepEqual(r, { sent: admins.length, errors: 0, via: 'gmail' });
  assert.deepEqual(faux.messages.map(m => m.a[0]).sort(), admins.map(p => j.emails[p.id]).sort());
  assert.equal(b.tables.notif_etat.filter(n => n.resume_at).length, 0);
  assert.equal((await N.handler(requete({ job: 'essai_email' }, {}))).status, 401, 'secret exigé');
});

test('essai_email : un administrateur sans rien cette semaine reçoit quand même un email', async () => {
  const b = installer(new Banc());
  b.tables.app_secrets.push({ cle: 'notifier_secret', valeur: SECRET });
  const id = '00000000-0000-4000-8000-000000000777';
  b.tables.profiles.push({ id, full_name: 'Oussama Admin', role: 'admin', filiere: 'Génie Industriel', promo: 2027, langue: 'ar', created_at: '2026-01-01T00:00:00Z' });
  b.tables.notif_etat.push({ user_id: id, token: 'jeton-admin', resume_at: null });
  b.emails.set(id, 'admin@example.ma');
  configurerEnv({ GMAIL_USER: GMAIL, GMAIL_APP_PASSWORD: 'abcdefghijklmnop' });
  brancher(N, faux);
  const r = JSON.parse(await (await N.handler(requete({ job: 'essai_email' }, { 'x-notifier': SECRET }))).text());
  assert.deepEqual(r, { sent: 1, errors: 0, via: 'gmail' });
  const x = lireMime(faux.messages[0].brut);
  assert.equal(decoderMot(x.entetes.subject), 'أسبوعك على شبكة ENSAM مكناس');
  assert.ok(x.parties[1].texte.includes('#desabo/jeton-admin'));
});
