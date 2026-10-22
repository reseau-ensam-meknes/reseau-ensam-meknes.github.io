// Demandes des étudiants : notifications (nouvelle demande, aide proposée, match, fin du match, démarrage)
// et email quotidien aux lauréats du parcours, dans leur langue, avec « Je peux aider »
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
const D1 = uid(501), D2 = uid(502);
const dem = (id, x = {}) => ({ id, titre: 'PFE en amélioration continue', type: 'pfe', lieu: 'Casablanca', prenom: 'Salma', niveau: 5, role: 'etudiant', filiere: 'Génie Industriel et Productique', ...x });

test('notifications : chaque étape d’une demande ouvre sa carte, en français et en arabe', () => {
  const n = N.texteNotif('demande_nouvelle', { nom: 'Salma', titre: 'PFE lean', type: 'pfe', demande: D1 }, 'fr', SITE);
  assert.equal(n.title, 'Un étudiant de ton parcours cherche');
  assert.equal(n.body, 'Salma · PFE : PFE lean');
  assert.equal(n.url, `${SITE}#offres/demandes/${D1}`);
  assert.equal(n.tag, `demande_nouvelle-${D1}`);
  assert.equal(N.texteNotif('demande_nouvelle', { nom: 'Halima', titre: 'Poste en qualité', type: 'emploi', demande: D1 }, 'fr', SITE).title, 'Quelqu’un du réseau cherche un emploi');
  const p = N.texteNotif('demande_proposition', { nom: 'Youssef Amrani', titre: 'PFE lean', entreprise: 'Renault', demande: D1 }, 'fr', SITE);
  assert.deepEqual([p.title, p.body], ['Un lauréat te propose son aide', 'Youssef Amrani (Renault) : PFE lean']);
  const m = N.texteNotif('demande_match', { nom: 'Salma Bennani', titre: 'PFE lean', demande: D1 }, 'fr', SITE);
  assert.match(m.body, /a accepté ton aide : PFE lean\. Déclare son démarrage/);
  assert.equal(N.texteNotif('demande_rouverte', { nom: 'Salma', titre: 'PFE lean', demande: D1 }, 'fr', SITE).body, 'Salma a mis fin au match : PFE lean.');
  // Sans identifiant valable : la liste des demandes
  assert.equal(N.texteNotif('demande_match', { nom: 'S', titre: 't', demande: 'x' }, 'fr', SITE).url, `${SITE}#offres/demandes`);
  const ar = N.texteNotif('demande_proposition', { nom: 'Youssef', titre: 'PFE lean', entreprise: 'Renault', demande: D1 }, 'ar', SITE);
  assert.equal(ar.title, 'خريج يقترح عليك مساعدته');
  assert.ok(ar.body.includes('⁨Youssef⁩'));
});

test('démarrage venu d’une demande : on parle de démarrage, pas de recrutement', () => {
  assert.equal(N.texteNotif('recrutement_a_confirmer', { nom: 'Youssef', entreprise: 'Renault', aide: 'encadre' }, 'fr', SITE).body, 'Youssef indique que tu as commencé chez Renault.');
  assert.equal(N.texteNotif('recrutement_a_confirmer', { nom: 'Youssef', entreprise: 'Renault' }, 'fr', SITE).body, 'Youssef indique t’avoir recruté(e) chez Renault.');
  assert.equal(N.texteNotif('recrutement_confirme', { nom: 'Salma', entreprise: 'Renault', aide: 'recommande' }, 'fr', SITE).title, 'Démarrage confirmé');
  assert.equal(N.texteNotif('recrutement_a_confirmer', { nom: 'Y', entreprise: 'R', aide: 'n’importe quoi' }, 'fr', SITE).title, 'Confirme ton recrutement');
});

test('email : les demandes du parcours, un bouton « Je peux aider » par demande, désabonnement des alertes', () => {
  const c = N.rendreDemandes([dem(D1), dem(D2, { prenom: 'Halima', role: 'laureat', niveau: 7, type: 'emploi', titre: 'Poste en qualité', lieu: null })], 'fr', SITE, 'jeton');
  assert.equal(c.sujet, '2 demandes d’étudiants de ton parcours · Réseau ENSAM');
  assert.ok(c.html.includes(`href="${SITE}#offres/demandes/${D1}"`) && c.html.includes('Je peux aider'));
  assert.ok(c.texte.includes('Salma · 5A · PFE · PFE en amélioration continue · Casablanca'));
  assert.ok(c.texte.includes('Halima · Lauréat · Emploi · Poste en qualité'));
  assert.equal(c.desabo, `${SITE}#desabo/jeton/alertes`);
  assert.ok(!/<img/i.test(c.html), 'pas d’image dans le contenu');
  const un = N.rendreDemandes([dem(D1, { titre: '<b>PFE</b>' })], 'fr', SITE, 'j');
  assert.equal(un.sujet, 'Salma cherche : <b>PFE</b>');
  assert.ok(!un.html.includes('<b>PFE</b>') && un.html.includes('&lt;b&gt;PFE&lt;/b&gt;'), 'le texte des membres est échappé');
  const ar = N.rendreDemandes([dem(D1)], 'ar', SITE, 'j');
  assert.match(ar.html, /<html lang="ar" dir="rtl">/);
  assert.ok(ar.html.includes('أستطيع المساعدة'));
});

test('tâche « demandes » : un email par lauréat choisi par la base ; seuls les envois réussis sont notés', async () => {
  const b = nouveauBanc();
  configurerEnv({ BREVO_API_KEY: 'xkeysib-test', SENDER_EMAIL: 'reseau@ensam-meknes.example' });
  const lignes = [
    { id: uid(1), email: 'l1@exemple.ma', langue: 'fr', token: 't1', demandes: [dem(D1)] },
    { id: uid(2), email: 'l2@exemple.ma', langue: 'ar', token: 't2', demandes: [dem(D1), dem(D2)] },
    { id: uid(3), email: 'l3@exemple.ma', langue: 'fr', token: 't3', demandes: [dem('pas-un-uuid')] },
    { id: uid(4), email: 'l4@exemple.ma', langue: 'fr', token: 't4', demandes: [dem(D2)] },
  ];
  b.rpcs = { demandes_a_signaler: a => { assert.deepEqual(a, { p_max: 100 }); return lignes; }, demandes_signalees: () => undefined };
  b.echecsBrevo.add('l4@exemple.ma');
  assert.deepEqual(await corpsDe(await appel({ job: 'demandes' })), { sent: 2, errors: 2, via: 'brevo' });
  assert.deepEqual([...b.argsRpc.demandes_signalees[0].p_ids].sort(), [uid(1), uid(2)]);
  const fr = b.brevo.find(x => x.corps.to[0].email === 'l1@exemple.ma').corps;
  assert.equal(fr.subject, 'Salma cherche : PFE en amélioration continue');
  assert.ok(fr.headers?.['List-Unsubscribe']?.includes('#desabo/t1/alertes'));
});

test('tâche « demandes » : sans Gmail ni Brevo, rien n’est lu ; personne à prévenir, rien à noter', async () => {
  const b = nouveauBanc();
  b.rpcs = { demandes_a_signaler: () => { throw new Error('ne doit pas être appelé'); } };
  assert.deepEqual(await corpsDe(await appel({ job: 'demandes' })), { skipped: 'email' });
  configurerEnv({ BREVO_API_KEY: 'k', SENDER_EMAIL: 'a@b.ma' });
  b.rpcs = { demandes_a_signaler: () => [], demandes_signalees: () => { throw new Error('rien à noter'); } };
  assert.deepEqual(await corpsDe(await appel({ job: 'demandes' })), { sent: 0, errors: 0 });
});
