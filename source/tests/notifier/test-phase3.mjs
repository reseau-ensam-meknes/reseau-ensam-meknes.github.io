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
const OFFRE = uid(5001), OFFRE2 = uid(5002);

test('notifications Phase 3 : textes fr / ar, liens', () => {
  const t = (k, d = {}, l = 'fr') => N.texteNotif(k, d, l, SITE);
  assert.deepEqual(t('offre_alerte', { titre: 'PFE lean', entreprise: 'OCP', offre: OFFRE }),
    { title: 'Nouvelle offre pour toi', body: 'PFE lean · OCP', url: `${SITE}#offre/${OFFRE}`, tag: `offre-${OFFRE}` });
  assert.equal(t('offre_alerte', { titre: 'PFE lean', offre: 'pas-un-uuid' }).url, `${SITE}#offres`);
  assert.equal(t('contact_demande', { nom: 'Salma Idrissi' }).body, 'Salma Idrissi aimerait avoir tes coordonnées. Tu acceptes ou non, en un clic.');
  assert.equal(t('contact_accepte', { nom: 'Youssef' }).url, `${SITE}#accueil`);
  for (const k of ['relecture_demande', 'relecture_prise', 'relecture_rendue']) assert.equal(t(k, { nom: 'X' }).url, `${SITE}#mentorat/cv`);
  assert.equal(t('signalement', { motif: 'arnaque' }).body, 'Motif : arnaque. À regarder dans la modération.');
  assert.equal(t('signalement', { motif: '<script>' }).body, 'Motif : autre. À regarder dans la modération.');
  assert.equal(t('signalement', { motif: 'spam' }).url, `${SITE}#admin/moderation`);
  assert.equal(t('verification_pair', { nom: 'Hamid', n: 1 }).title, 'Ta promo confirmée une fois');
  assert.equal(t('verification_pair', { nom: 'Hamid', n: 2 }).title, 'Tu es vérifié(e)');
  assert.equal(t('verifier_pair', { nom: 'Rachid', promo: 2016 }).body, 'Rachid vient de rejoindre le réseau (promo 2016). Confirme-le si tu le connais.');
  assert.equal(t('verifier_pair', { nom: 'Rachid', promo: '20x6' }).body, 'Rachid vient de rejoindre le réseau. Confirme-le si tu le connais.');
  const e = t('evenement', { titre: 'Forum ENSAM Entreprises', debut: '2026-11-12T09:00:00Z', lieu: 'Amphi A' });
  assert.equal(e.title, 'À l’agenda : Forum ENSAM Entreprises');
  assert.match(e.body, /^jeudi 12 novembre à 09:00 · Amphi A$/);
  assert.equal(e.url, `${SITE}#reseau/agenda`);
  assert.equal(t('evenement', { titre: 'Atelier' }).body, 'Nouvel événement de l’école.');
  assert.equal(t('evenement_annule', { titre: 'Atelier CV' }).body, 'Atelier CV');
  assert.equal(t('enquete', { vague: 12 }).body, '12 mois après ton diplôme : 2 minutes pour aider l’école et les promos suivantes.');
  assert.equal(t('enquete', { vague: 99 }).body, '6 mois après ton diplôme : 2 minutes pour aider l’école et les promos suivantes.');
  assert.equal(t('enquete', {}).url, `${SITE}#enquete`);
  // Arabe : contenu des membres isolé
  const a = t('contact_demande', { nom: 'Salma' }, 'ar');
  assert.equal(a.title, 'طلب معلومات الاتصال');
  assert.ok(a.body.includes('⁨Salma⁩'));
  assert.equal(t('signalement', { motif: 'faux' }, 'ar').body, 'السبب: معلومة خاطئة. راجعه في صفحة الإشراف.');
  for (const k of ['offre_alerte', 'contact_demande', 'contact_accepte', 'relecture_demande', 'relecture_prise', 'relecture_rendue', 'signalement', 'verification_pair', 'verifier_pair', 'evenement', 'evenement_annule', 'evenement_deplace', 'enquete']) {
    for (const l of ['fr', 'ar']) { const n = t(k, { nom: 'A', titre: 'B', n: 1, vague: 6 }, l); assert.ok(n && n.title && n.body, `${k} ${l}`); }
  }
});

const ligneAlerte = (id, email, offres, langue = 'fr') => ({ id, email, langue, token: `00000000-0000-4000-9000-${id.slice(-12)}`, offres });
const offre = (id, titre, x = {}) => ({ id, titre, entreprise: 'OCP Group', type: 'pfe', ville: 'Jorf Lasfar', pays: 'Maroc', deadline: null, ...x });

test('alertes : sans Gmail ni Brevo, rien n’est lu', async () => {
  const b = nouveauBanc();
  b.rpcs = { alertes_a_envoyer: () => { throw new Error('ne doit pas être appelé'); } };
  assert.deepEqual(await corpsDe(await appel({ job: 'alertes' })), { skipped: 'email' });
});

test('alertes : un email par personne, lien vers chaque offre, désabonnement des alertes, seuls les envois marqués', async () => {
  const b = nouveauBanc();
  configurerEnv({ BREVO_API_KEY: 'xkeysib-test', SENDER_EMAIL: 'reseau@ensam-meknes.example' });
  const lignes = [
    ligneAlerte(uid(1), 'salma@exemple.ma', [offre(OFFRE, 'PFE efficacité énergétique', { deadline: '2026-11-30T00:00:00Z' }), offre(OFFRE2, 'Stage <maintenance> & fiabilité', { type: 'etranger', ville: 'Lyon', pays: 'France' })]),
    ligneAlerte(uid(2), 'youssef@exemple.ma', [offre(OFFRE, 'PFE efficacité énergétique')], 'ar'),
    ligneAlerte(uid(3), 'refuse@exemple.ma', [offre(OFFRE, 'PFE efficacité énergétique')]),
    ligneAlerte(uid(4), 'vide@exemple.ma', []),
    ligneAlerte('pas-un-uuid', 'x@exemple.ma', [offre(OFFRE, 'PFE')]),
  ];
  b.rpcs = { alertes_a_envoyer: a => { assert.deepEqual(a, { p_max: 100 }); return lignes; }, alertes_envoyees: () => undefined };
  b.echecsBrevo.add('refuse@exemple.ma');
  const r = await corpsDe(await appel({ job: 'alertes' }));
  assert.deepEqual(r, { sent: 2, errors: 3, via: 'brevo' });
  assert.equal(b.argsRpc.alertes_envoyees.length, 1);
  assert.deepEqual([...b.argsRpc.alertes_envoyees[0].p_ids].sort(), [uid(1), uid(2)]);
  const salma = b.brevo.find(x => x.corps.to[0].email === 'salma@exemple.ma').corps;
  assert.equal(salma.subject, '2 nouvelles offres pour toi · Réseau ENSAM');
  assert.ok(salma.htmlContent.includes(`href="${SITE}#offre/${OFFRE}"`));
  assert.ok(salma.htmlContent.includes(`href="${SITE}#offre/${OFFRE2}"`));
  assert.ok(salma.htmlContent.includes('Stage &lt;maintenance&gt; &amp; fiabilité'), 'titre échappé');
  assert.ok(!salma.htmlContent.includes('<maintenance>'));
  assert.ok(salma.htmlContent.includes('Lyon, France') && salma.htmlContent.includes('Stage à l’étranger'));
  assert.match(salma.htmlContent, /Avant le lundi 30 novembre/);
  const desabo = `${SITE}#desabo/${lignes[0].token}/alertes`;
  assert.equal(salma.headers['List-Unsubscribe'], `<${desabo}>`);
  assert.ok(salma.textContent.includes(desabo) && salma.textContent.includes(`${SITE}#offre/${OFFRE2}`));
  assert.ok(!/<img/i.test(salma.htmlContent), 'pas d’image dans le contenu');
  const youssef = b.brevo.find(x => x.corps.to[0].email === 'youssef@exemple.ma').corps;
  assert.match(youssef.htmlContent, /<html lang="ar" dir="rtl">/);
  assert.match(youssef.subject, /^عرض جديد لك: PFE efficacité énergétique · OCP Group$/);
});

test('alertes : personne à prévenir', async () => {
  const b = nouveauBanc();
  configurerEnv({ BREVO_API_KEY: 'k', SENDER_EMAIL: 'a@b.ma' });
  b.rpcs = { alertes_a_envoyer: () => [], alertes_envoyees: () => { throw new Error('rien à marquer'); } };
  assert.deepEqual(await corpsDe(await appel({ job: 'alertes' })), { sent: 0, errors: 0 });
});

test('enquetes : email si autorisé, sinon téléphone seulement ; échecs non marqués ; rappel', async () => {
  const b = nouveauBanc();
  configurerEnv({ BREVO_API_KEY: 'xkeysib-test', SENDER_EMAIL: 'reseau@ensam-meknes.example' });
  const L = (n, x) => ({ id: uid(n), email: `m${n}@exemple.ma`, langue: 'fr', token: `00000000-0000-4000-9000-0000000000${String(n).padStart(2, '0')}`, vague: 6, rappel: false, email_ok: true, ...x });
  const lignes = [L(1), L(2, { langue: 'ar', vague: 12, rappel: true }), L(3, { email_ok: false }), L(4), L(5, { vague: 7 })];
  b.rpcs = { enquetes_a_inviter: () => lignes, enquetes_invitees: () => lignes.length };
  b.echecsBrevo.add('m4@exemple.ma');
  const r = await corpsDe(await appel({ job: 'enquetes' }));
  assert.deepEqual(r, { sent: 2, push: 1, errors: 1, via: 'brevo' });
  const marques = b.argsRpc.enquetes_invitees[0].p_lignes;
  assert.deepEqual(marques.map(x => x.id).sort(), [uid(1), uid(2), uid(3)].sort());
  assert.deepEqual(marques.find(x => x.id === uid(2)), { id: uid(2), vague: 12, rappel: true });
  const m1 = b.brevo.find(x => x.corps.to[0].email === 'm1@exemple.ma').corps;
  assert.equal(m1.subject, 'Où en es-tu six mois après ton diplôme ? Enquête d’insertion');
  assert.match(b.brevo.find(x => x.corps.to[0].email === 'm2@exemple.ma').corps.htmlContent, /<html lang="ar" dir="rtl">/);
  assert.ok(m1.htmlContent.includes(`href="${SITE}#enquete"`));
  assert.equal(m1.headers['List-Unsubscribe'], `<${SITE}#desabo/${lignes[0].token}>`);
  const m2 = b.brevo.find(x => x.corps.to[0].email === 'm2@exemple.ma').corps;
  assert.match(m2.subject, /^تذكير: أين وصلت بعد سنة من تخرجك؟/);
  assert.ok(!b.brevo.some(x => x.corps.to[0].email === 'm3@exemple.ma'));
});

test('enquetes : sans email configuré, le téléphone suffit', async () => {
  const b = nouveauBanc();
  b.rpcs = { enquetes_a_inviter: () => [{ id: uid(1), email: 'a@b.ma', langue: 'fr', token: uid(77), vague: 6, rappel: false, email_ok: true }], enquetes_invitees: () => 1 };
  assert.deepEqual(await corpsDe(await appel({ job: 'enquetes' })), { sent: 0, push: 1, errors: 0, via: 'brevo' });
  assert.equal(b.argsRpc.enquetes_invitees.length, 1);
});

test('résumé : agenda, enquête, coordonnées, CV à relire, signalements', () => {
  const NOW = new Date('2027-01-12T09:00:00Z');
  const J = jeu(NOW);
  const B = brut(J);
  const h = j => new Date(NOW.getTime() + j * 864e5).toISOString();
  // Youssef (promo 2018) : pas d'enquête ; un jeune diplômé de 2026 : vague 6 ouverte en janvier 2027
  const jeune = { ...J.tables.profiles.find(p => p.id === ID.nadia), id: uid(70), full_name: 'Jeune Diplômée', role: 'laureat', promo: 2026 };
  B.profils = [...B.profils, jeune];
  B.evenements = [
    { id: uid(80), titre: 'Forum ENSAM Entreprises', debut: h(5), lieu: 'Amphi A', public: 'tous' },
    { id: uid(81), titre: 'Atelier CV', debut: h(3), lieu: null, public: 'etudiants' },
    { id: uid(82), titre: 'Afterwork lauréats', debut: h(20), lieu: 'Casa', public: 'laureats' },
    { id: uid(83), titre: 'Annulé', debut: h(2), lieu: '', public: 'tous', annule: true },
  ];
  B.enquetes = [];
  B.relectures = [{ id: uid(90), student_id: ID.salma, reviewer_id: null, status: 'demandee' }, { id: uid(91), student_id: ID.mehdi, reviewer_id: null, status: 'demandee' }, { id: uid(92), student_id: ID.imane, reviewer_id: ID.nadia, status: 'demandee' }];
  B.demandesContact = [{ id: uid(95), demandeur_id: ID.salma, cible_id: ID.youssef, status: 'envoyee' }, { id: uid(96), demandeur_id: ID.amine, cible_id: ID.youssef, status: 'acceptee' }];
  B.signalements = 2;
  const D = N.indexer(B, NOW);
  const R = id => N.resumeDe(D.profils.get(id), D);
  const s = R(ID.salma);
  assert.deepEqual(s.evenements.map(e => e.titre), ['Atelier CV', 'Forum ENSAM Entreprises']);
  assert.equal(s.enquete, 0);
  const y = R(ID.youssef);
  assert.deepEqual(y.evenements.map(e => e.titre), ['Forum ENSAM Entreprises']);
  assert.equal(y.contacts, 1);
  assert.equal(y.relectures, 1);   // Salma (GI) ; pas Mehdi (Génie Civil) ni la demande adressée à Nadia
  assert.equal(R(ID.nadia).relectures, 1);
  const jd = R(uid(70));
  assert.equal(jd.enquete, 6);
  const m = N.rendreResume(jd, 'fr', SITE, uid(99));
  assert.equal(m.sujet, 'Enquête d’insertion : où en es-tu six mois après ton diplôme ? · Réseau ENSAM');
  assert.ok(m.html.includes(`${SITE}#enquete`) && m.html.includes('À l’agenda de l’école'));
  // Réponse déjà donnée : plus d'enquête
  B.enquetes = [{ user_id: uid(70), vague: 6 }];
  assert.equal(N.resumeDe(jd && N.indexer(B, NOW).profils.get(uid(70)), N.indexer(B, NOW)).enquete, 0);
  const a = R(ID.admin);
  assert.equal(a.admin.signalements, 2);
  assert.match(N.rendreResume(a, 'ar', SITE, uid(99)).html, /تبليغان/);
  const ym = N.rendreResume(y, 'ar', SITE, uid(99));
  assert.ok(ym.html.includes('سيرة ذاتية واحدة تنتظر المراجعة.') && ym.html.includes('عضو يرغب في معلومات الاتصال بك.'));
  // vague_ouverte
  assert.equal(N.vagueOuverte(2026, new Date('2027-06-30T12:00:00Z')), 6);
  assert.equal(N.vagueOuverte(2026, new Date('2027-07-01T12:00:00Z')), 12);
  assert.equal(N.vagueOuverte(2026, new Date('2028-03-31T12:00:00Z')), 12);
  assert.equal(N.vagueOuverte(2026, new Date('2028-04-01T12:00:00Z')), 0);
  assert.equal(N.vagueOuverte(2026, new Date('2026-12-31T12:00:00Z')), 0);
});
