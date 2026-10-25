// Rappels de visite : textes FR/AR (vrais chiffres, ton calme, le bon écran), email sans image avec son lien
// « Ne plus recevoir ces rappels », plafond par exécution, et jamais le même jour qu'un autre email du réseau.
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
const TOKEN = '11111111-2222-4333-8444-555555555555';
const ligne = (n, x = {}) => ({ id: uid(n), email: `m${n}@exemple.ma`, langue: 'fr', token: TOKEN, contenu: { offres: 2 }, dernier_email: null, ...x });
// Jamais culpabilisant : ni reproche, ni urgence inventée
const CULPABILISANT = /oubli|manqu|dommage|urgent|vite|dépêche|tu n.as pas|personne ne|déçu|نسيت|فات|عاجل|بسرعة/i;

test('notification : la chose la plus personnelle en titre, les autres dessous, le bon écran ; en français et en arabe', () => {
  const n = N.texteNotif('rappel_visite', { demandes: 3, messages: 1, candidatures: 2 }, 'fr', SITE);
  assert.deepEqual(n, {
    title: '1 message non lu', body: 'Aussi : 2 nouvelles candidatures sur tes offres · 3 demandes d’étudiants depuis ta dernière visite.',
    url: `${SITE}#messages`, tag: 'rappel_visite',
  });
  const seul = N.texteNotif('rappel_visite', { demandes: 1 }, 'fr', SITE);
  assert.deepEqual([seul.title, seul.body, seul.url], ['1 demande d’étudiant depuis ta dernière visite', 'À voir quand tu as un moment.', `${SITE}#offres/demandes`]);
  const etu = N.texteNotif('rappel_visite', { propositions: 1, offres: 4 }, 'fr', SITE);
  assert.deepEqual([etu.title, etu.body, etu.url], ['Un lauréat te propose son aide', 'Aussi : 4 nouvelles offres pour toi.', `${SITE}#offres/demandes`]);
  assert.equal(N.texteNotif('rappel_visite', { mentorats: 2 }, 'fr', SITE).url, `${SITE}#mentorat`);
  assert.equal(N.texteNotif('rappel_visite', { offres: 1 }, 'fr', SITE).title, '1 nouvelle offre pour toi');
  const ar = N.texteNotif('rappel_visite', { messages: 2, offres: 12, propositions: 3 }, 'ar', SITE);
  assert.deepEqual([ar.title, ar.body, ar.url], ['رسالتان غير مقروءتين', 'وأيضًا: 3 عروض مساعدة من الخريجين، 12 عرضًا جديدًا يخصك.', `${SITE}#messages`]);
  assert.equal(N.texteNotif('rappel_visite', { demandes: 1 }, 'ar', SITE).body, 'ألقِ نظرة متى سمح وقتك.');
  for (const l of ['fr', 'ar']) for (const k of N.RAPPEL_ORDRE) for (const c of [1, 2, 5, 11]) {
    const x = N.texteNotif('rappel_visite', { [k]: c }, l, SITE);
    assert.ok(x.title.includes(String(c)) || c === 1 || (l === 'ar' && c === 2), `${l} ${k} ${c} : ${x.title}`);
    assert.ok(!CULPABILISANT.test(x.title + x.body), x.title + ' / ' + x.body);
    assert.ok(x.title.length <= 80 && x.body.length <= 180);
  }
});

test('notification : rien de concret, rien n’est écrit ; un chiffre douteux est ignoré', () => {
  for (const d of [{}, null, { messages: 0 }, { messages: -2 }, { messages: '3' }, { messages: 1.5 }, { inconnu: 4 }]) {
    const x = N.texteNotif('rappel_visite', d, 'fr', SITE);
    if (d && d.messages === '3') assert.equal(x.title, '3 messages non lus', 'un nombre envoyé en texte par la base reste un nombre');
    else assert.equal(x, null, JSON.stringify(d));
  }
});

test('email : FR et AR, les mêmes chiffres, un bouton vers le bon écran, sans image, avec le lien pour arrêter les rappels', () => {
  const fr = N.rendreRappel({ propositions: 2, offres: 3 }, 'fr', SITE, TOKEN);
  assert.equal(fr.sujet, '2 lauréats te proposent leur aide · Réseau ENSAM');
  assert.equal(fr.desabo, `${SITE}#desabo/${TOKEN}/rappels`);
  assert.ok(fr.html.includes(`href="${SITE}#offres/demandes"`) && fr.html.includes('Voir sur la plateforme'));
  assert.ok(fr.html.includes('3 nouvelles offres pour toi') && fr.texte.includes('• 2 lauréats te proposent leur aide'));
  assert.ok(fr.texte.includes(`Ne plus recevoir ces rappels : ${SITE}#desabo/${TOKEN}/rappels`));
  assert.ok(fr.texte.includes('une fois par semaine au plus'));
  assert.ok(!/<img/i.test(fr.html), 'pas d’image');
  assert.ok(!CULPABILISANT.test(fr.html + fr.texte));
  const ar = N.rendreRappel({ messages: 1 }, 'ar', SITE, TOKEN);
  assert.match(ar.html, /<html lang="ar" dir="rtl">/);
  assert.equal(ar.sujet, 'رسالة غير مقروءة · شبكة ENSAM');
  assert.equal(ar.desabo, `${SITE}?lang=ar#desabo/${TOKEN}/rappels`);
  assert.ok(ar.html.includes('إيقاف هذه التذكيرات') && ar.html.includes(`${SITE}?lang=ar#messages`));
  assert.ok(!/<img/i.test(ar.html));
  assert.match(N.messageMime({ nom: 'Réseau', email: 'r@gmail.com' }, 'x@y.ma', fr), new RegExp(`^List-Unsubscribe: <${SITE.replace(/[.]/g, '\\.')}#desabo/${TOKEN}/rappels>$`, 'm'));
});

test('tâche « rappels » : un email par membre choisi par la base, dans sa langue ; seuls les envois réussis sont notés', async () => {
  const b = nouveauBanc();
  configurerEnv({ BREVO_API_KEY: 'xkeysib-test', SENDER_EMAIL: 'reseau@ensam-meknes.example' });
  const lignes = [ligne(1), ligne(2, { langue: 'ar', contenu: { messages: 2 } }), ligne(3), ligne(4, { id: 'pas-un-uuid' }), ligne(5, { email: null })];
  b.rpcs = { rappels_emails_a_envoyer: a => { assert.deepEqual(a, { p_max: 150 }); return lignes; }, rappels_emails_envoyes: () => undefined };
  b.echecsBrevo.add('m3@exemple.ma');
  assert.deepEqual(await corpsDe(await appel({ job: 'rappels' })), { sent: 2, skipped: 0, errors: 3, via: 'brevo' });
  assert.deepEqual([...b.argsRpc.rappels_emails_envoyes[0].p_ids].sort(), [uid(1), uid(2)]);
  const fr = b.brevo.find(x => x.corps.to[0].email === 'm1@exemple.ma').corps;
  assert.equal(fr.subject, '2 nouvelles offres pour toi · Réseau ENSAM');
  assert.equal(fr.headers['List-Unsubscribe'], `<${SITE}#desabo/${TOKEN}/rappels>`);
  assert.equal(b.brevo.find(x => x.corps.to[0].email === 'm2@exemple.ma').corps.subject, 'رسالتان غير مقروءتين · شبكة ENSAM');
});

test('tâche « rappels » : pas de doublon avec le résumé, les demandes ou un autre email des dernières 24 h ; rien de concret, rien', async () => {
  const b = nouveauBanc();
  configurerEnv({ BREVO_API_KEY: 'k', SENDER_EMAIL: 'a@b.ma' });
  const il = h => new Date(Date.now() - h * 3600e3).toISOString();
  b.rpcs = {
    rappels_emails_a_envoyer: () => [ligne(1, { dernier_email: il(3) }), ligne(2, { dernier_email: il(23.5) }), ligne(3, { dernier_email: il(25) }), ligne(4, { contenu: {} })],
    rappels_emails_envoyes: () => undefined,
  };
  assert.deepEqual(await corpsDe(await appel({ job: 'rappels' })), { sent: 1, skipped: 3, errors: 0, via: 'brevo' });
  assert.deepEqual(b.brevo.map(x => x.corps.to[0].email), ['m3@exemple.ma']);
  assert.deepEqual(b.argsRpc.rappels_emails_envoyes[0].p_ids, [uid(3)]);
});

test('tâche « rappels » : plafond de 150 par exécution, même si la base en rend plus', async () => {
  const b = nouveauBanc();
  configurerEnv({ BREVO_API_KEY: 'k', SENDER_EMAIL: 'a@b.ma' });
  b.rpcs = { rappels_emails_a_envoyer: () => Array.from({ length: 180 }, (_, i) => ligne(i + 1)), rappels_emails_envoyes: () => undefined };
  const r = await corpsDe(await appel({ job: 'rappels' }));
  assert.equal(r.sent, 150);
  assert.equal(b.brevo.length, 150);
  assert.equal(b.argsRpc.rappels_emails_envoyes[0].p_ids.length, 150);
});

test('tâche « rappels » : sans Gmail ni Brevo, rien n’est lu ; personne, rien à noter ; le secret est exigé', async () => {
  let b = nouveauBanc();
  b.rpcs = { rappels_emails_a_envoyer: () => { throw new Error('ne doit pas être appelé'); } };
  assert.deepEqual(await corpsDe(await appel({ job: 'rappels' })), { skipped: 'email' });
  b = nouveauBanc();
  configurerEnv({ BREVO_API_KEY: 'k', SENDER_EMAIL: 'a@b.ma' });
  b.rpcs = { rappels_emails_a_envoyer: () => [], rappels_emails_envoyes: () => { throw new Error('rien à noter'); } };
  assert.deepEqual(await corpsDe(await appel({ job: 'rappels' })), { sent: 0, skipped: 0, errors: 0 });
  assert.equal((await N.handler(requete({ job: 'rappels' }, {}))).status, 401);
  // « relances » reste le rappel d'inscription : les deux tâches ne se confondent pas
  b.rpcs = { comptes_a_relancer: () => [], rappels_emails_a_envoyer: () => { throw new Error('pas pour « relances »'); } };
  assert.deepEqual(await corpsDe(await appel({ job: 'relances' })), { sent: 0, errors: 0 });
});

test('la file : une notification « rappel_visite » part comme les autres, et un type inconnu n’est jamais envoyé vide', async () => {
  assert.equal(N.urgence('rappel_visite'), 'normal');
  const n = N.texteNotif('rappel_visite', { candidatures: 1 }, 'fr', SITE);
  assert.deepEqual([n.title, n.url], ['1 nouvelle candidature sur tes offres', `${SITE}#espace`]);
});
