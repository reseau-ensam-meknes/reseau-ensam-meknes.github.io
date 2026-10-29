// La file des notifications : une notification n'en sort que reçue par un téléphone, ou sans espoir ; une panne
// passagère la laisse pour un nouvel essai. Journal de chaque envoi. Rappel d'un entretien, par notification ou par email.
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
const profil = (id, langue = 'fr') => ({ id, full_name: 'Membre ' + id.slice(-2), role: 'etudiant', langue, created_at: '2026-01-01T00:00:00Z' });
const vieillir = (b, minutes) => { for (const x of b.tables.push_queue) if (x.pris_at) x.pris_at = new Date(Date.now() - minutes * 60e3).toISOString(); };

test('file : reçue sur un téléphone, ou sans téléphone, elle sort ; chaque envoi est noté au journal', async () => {
  const b = nouveauBanc();
  const [u1, u2, u3] = [uid(1), uid(2), uid(3)];
  b.tables.profiles.push(profil(u1), profil(u2), profil(u3));
  const ok = b.abonner(u1, 1), panne = b.abonner(u1, 2);
  b.statutsPush.set(panne.endpoint, 503);
  const parti = b.abonner(u2, 1);
  b.statutsPush.set(parti.endpoint, 410);
  b.tables.push_queue.push(
    { id: 1, user_id: u1, kind: 'merci', data: { nom: 'Salma' } },
    { id: 2, user_id: u2, kind: 'merci', data: { nom: 'Salma' } },
    { id: 3, user_id: u3, kind: 'merci', data: { nom: 'Salma' } },
    { id: 4, user_id: u1, kind: 'type_inconnu', data: {} },
  );
  assert.deepEqual(await corpsDe(await appel({ job: 'push' })), { sent: 1, failed: 1, removed: 1 });
  // 1 : reçue sur un des deux téléphones ; 2 : son seul téléphone est parti ; 3 : aucun téléphone ; 4 : type inconnu
  assert.deepEqual(b.tables.push_queue, []);
  assert.deepEqual([...b.argsRpc.push_faits[0].p_ids].sort(), [1, 2, 3, 4]);
  assert.deepEqual(b.tables.push_journal.map(x => [x.user_id, x.kind, x.code]).sort(), [[u1, 'merci', 201], [u2, 'merci', 410], [u3, 'merci', -1]]);
  assert.ok(!JSON.stringify(b.tables.push_journal).includes('Salma'), 'le journal ne garde pas le contenu');
});

test('file : une panne passagère partout, nouvel essai après 2 minutes ; reçue, elle sort', async () => {
  const b = nouveauBanc();
  const u = uid(4);
  b.tables.profiles.push(profil(u));
  const s = b.abonner(u, 1);
  b.statutsPush.set(s.endpoint, 429);
  b.tables.push_queue.push({ id: 7, user_id: u, kind: 'message', data: { nom: 'Youssef', de: uid(5), texte: 'Salut' } });
  assert.deepEqual(await corpsDe(await appel({ job: 'push' })), { sent: 0, failed: 1, removed: 0, retry: 1 });
  assert.deepEqual(b.tables.push_queue.map(x => x.essais), [1]);
  // Rappelée tout de suite (un autre message) : prise il y a moins de 2 minutes, elle n'est pas renvoyée en double
  assert.deepEqual(await corpsDe(await appel({ job: 'push' })), { sent: 0, failed: 0, removed: 0 });
  assert.equal(b.push.length, 1);
  vieillir(b, 3);
  b.statutsPush.delete(s.endpoint);
  assert.deepEqual(await corpsDe(await appel({ job: 'push' })), { sent: 1, failed: 0, removed: 0 });
  assert.deepEqual(b.tables.push_queue, []);
  assert.deepEqual(b.push.map(x => x.message.body), ['Salut', 'Salut']);
  assert.deepEqual(b.tables.push_journal.map(x => x.code), [429, 201]);
});

test('file : 3 essais au plus', async () => {
  const b = nouveauBanc();
  const u = uid(6);
  b.tables.profiles.push(profil(u));
  b.statutsPush.set(b.abonner(u, 1).endpoint, 500);
  b.tables.push_queue.push({ id: 1, user_id: u, kind: 'merci', data: {} });
  for (let i = 0; i < 4; i++) { await appel({ job: 'push' }); vieillir(b, 3); }
  assert.equal(b.push.length, 3);
  assert.deepEqual(b.tables.push_queue.map(x => x.essais), [3], 'la base l’abandonne ensuite (relancer_push)');
});

test('file : base pas encore mise à jour (sans push_faits ni journal), les envois partent quand même', async () => {
  const b = nouveauBanc();
  const u = uid(8);
  b.tables.profiles.push(profil(u));
  b.abonner(u, 1);
  delete b.tables.push_journal;
  b.rpcs = { prendre_push: () => { const l = b.tables.push_queue.splice(0); return l.map(x => ({ ...x, langue: 'fr' })); }, push_faits: () => { throw new Error('inconnue'); } };
  b.tables.push_queue.push({ id: 1, user_id: u, kind: 'merci', data: {} });
  const r = await appel({ job: 'push' });
  assert.equal(r.status, 200);
  assert.deepEqual(await corpsDe(r), { sent: 1, failed: 0, removed: 0 });
  assert.ok(erreurs.some(e => e.includes('journal des notifications impossible')));
});

test('rappel d’entretien : l’heure, avec qui, où ; ouvre la discussion ; urgent et valable 15 minutes', async () => {
  const b = nouveauBanc();
  const [u, autre, m] = [uid(9), uid(10), uid(11)];
  b.tables.profiles.push(profil(u), profil(uid(12), 'ar'));
  const sFr = b.abonner(u, 1), sAr = b.abonner(uid(12), 1);
  const rdv = '2026-10-21T17:30:00Z';
  b.tables.push_queue.push(
    { id: 1, user_id: u, kind: 'rappel_entretien', data: { nom: 'Salma', de: autre, m, rdv_at: rdv, duree: 30 } },
    { id: 2, user_id: uid(12), kind: 'rappel_entretien', data: { nom: 'Salma', de: autre, m, rdv_at: rdv, duree: 15, lieu: 'OCP Casablanca' } },
  );
  await appel({ job: 'push' });
  const fr = b.push.find(x => x.endpoint === sFr.endpoint), ar = b.push.find(x => x.endpoint === sAr.endpoint);
  assert.deepEqual(fr.message, { title: 'Entretien à 17:30', body: 'Avec Salma · 30 min en visio. Le lien est dans votre discussion.', url: `${SITE}#messages/${autre}`, tag: `rappel_entretien-${m}` });
  assert.equal(fr.entetes.urgency, 'high');
  assert.equal(fr.entetes.ttl, '900');
  assert.equal(ar.message.title, 'مكالمة على الساعة 17:30');
  assert.equal(ar.message.body, 'مع \u2068Salma\u2069 · 15 دقيقة · \u2068OCP Casablanca\u2069.');
});

// ---------------------------------------------------------------------------
const RDV = new Date(Date.now() + 14 * 60e3).toISOString();
const ligne = (n, x = {}) => ({ id: n, email: `c${n}@exemple.ma`, langue: 'fr', kind: 'rappel_entretien', data: { nom: 'Salma', de: uid(20), m: uid(21), rdv_at: RDV, duree: 30 }, ...x });

test('rappel par email : sans Gmail ni Brevo, rien n’est pris', async () => {
  const b = nouveauBanc();
  b.rpcs = { rappels_rdv_a_envoyer: () => { throw new Error('ne doit pas être appelé'); } };
  assert.deepEqual(await corpsDe(await appel({ job: 'rappels_rdv' })), { skipped: 'email' });
  assert.equal((await N.handler(requete({ job: 'rappels_rdv' }, {}))).status, 401);
});

test('rappel par email : un par personne, dans sa langue, la visio d’un clic ; seuls les envois réussis sortent', async () => {
  const b = nouveauBanc();
  configurerEnv({ BREVO_API_KEY: 'xkeysib-test', SENDER_EMAIL: 'reseau@ensam-meknes.example' });
  const lignes = [
    ligne(1, { data: { ...ligne(1).data, lien: 'https://meet.jit.si/ReseauEnsam-abc123' } }),
    ligne(2, { langue: 'ar' }),
    ligne(3, { kind: 'rappel_rdv', data: { nom: 'Youssef Alami', sujet: 'Relire mon CV', rdv_at: RDV } }),
    ligne(4),
    ligne(5, { data: { nom: 'Salma' } }),
    ligne(6, { data: { ...ligne(6).data, lieu: 'Café de la gare', lien: 'https://meet.jit.si/x' } }),
  ];
  b.rpcs = { rappels_rdv_a_envoyer: a => { assert.deepEqual(a, { p_max: 100 }); return lignes; }, rappels_rdv_envoyes: () => undefined };
  b.echecsBrevo.add('c4@exemple.ma');
  assert.deepEqual(await corpsDe(await appel({ job: 'rappels_rdv' })), { sent: 4, errors: 2, via: 'brevo' });
  // 5 (sans date) sort aussi, pour ne pas être repris ; 4 (refusé par Brevo) reste pour un nouvel essai
  assert.deepEqual([...b.argsRpc.rappels_rdv_envoyes[0].p_ids].sort(), [1, 2, 3, 5, 6]);
  const de = n => b.brevo.find(x => x.corps.to[0].email === `c${n}@exemple.ma`).corps;
  const heure = N.quand(RDV, 'fr').heure;
  const visio = de(1);
  assert.equal(visio.subject, `Rappel : ton entretien avec Salma à ${heure}`);
  assert.ok(visio.htmlContent.includes('href="https://meet.jit.si/ReseauEnsam-abc123"') && visio.htmlContent.includes('Rejoindre la visio'));
  assert.ok(visio.htmlContent.includes(`href="${SITE}#messages/${uid(20)}"`), 'la discussion en second lien');
  assert.match(visio.textContent, /Ton entretien avec Salma commence à \d\d:\d\d \(.+\), pour 30 min\.[\s\S]*le bouton ci-dessous ouvre la salle/);
  assert.equal(visio.headers, undefined, 'pas de lien de désabonnement');
  assert.ok(!/<img/i.test(visio.htmlContent));
  const sansLien = de(2);
  assert.match(sansLien.htmlContent, /<html lang="ar" dir="rtl">/);
  assert.ok(sansLien.subject.startsWith('تذكير: مقابلتك مع Salma على الساعة'));
  assert.ok(sansLien.htmlContent.includes('فتح المحادثة') && sansLien.htmlContent.includes('الرابط في محادثتكما'));
  const mentorat = de(3);
  assert.equal(mentorat.subject, `Rappel : ton rendez-vous avec Youssef Alami à ${heure}`);
  assert.ok(mentorat.htmlContent.includes('Sujet : Relire mon CV.') && mentorat.htmlContent.includes(`href="${SITE}#mentorat"`));
  const lieu = de(6);
  assert.ok(lieu.textContent.includes('Lieu : Café de la gare.') && !lieu.htmlContent.includes('meet.jit.si'), 'un lieu : pas de bouton de visio');
});
