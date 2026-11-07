// La file des notifications : une notification n'en sort que reçue par un téléphone, ou sans espoir ; une panne
// passagère la laisse pour un nouvel essai. Journal de chaque envoi. Rappel d'un entretien, par notification ou par email.
// Ce que reçoit vraiment le service de push : la durée de vie et l'urgence de chaque type ; la nuit calme (21:30 → 08:00).
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
  // Le type inconnu aussi : jetée par la fonction (-4), rien ne se perd sans trace
  assert.deepEqual(b.tables.push_journal.map(x => [x.user_id, x.kind, x.code]).sort(), [[u1, 'merci', 201], [u1, 'type_inconnu', -4], [u2, 'merci', 410], [u3, 'merci', -1]]);
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
// Ce que reçoit vraiment le service de push : la durée de vie (en-tête TTL) et l'urgence de chaque type, celles du contrat.
// Nuit calme, de 21:30 à 08:00 (heure du Maroc = UTC) : la base ne programme rien la nuit, mais le service de push garde
// une notification tant que sa durée de vie court, pour un téléphone hors réseau, ou un Android en veille quand l'urgence
// est « normal ». Une notification programmée (le budget du jour, programme_place) ne vit donc que jusqu'à 21:30 ; prise
// par la fonction après 21:30 (file en retard, après une panne), elle ne part pas. Entre personnes : rien ne change.
const H = 3600;
const aLHeure = async (iso, f) => { const vrai = Date.now; Date.now = () => Date.parse(iso); try { return await f(); } finally { Date.now = vrai; } };
const DEMAIN = '2026-11-10T10:00:00Z';
const [MT, DE, EV, OF, DM] = [uid(41), uid(42), uid(43), uid(44), uid(45)];
// type : [data, durée de vie du contrat, urgence] ; les 12 programmées, puis deux notifications entre personnes
const TYPES = {
  match_jour: [{ n: 3, type: 'etudiant' }, 6 * H, 'high'],
  match_attente: [{ nom: 'Salma', de: DE, n: 1, type: 'laureat' }, 12 * H, 'high'],
  rdv_demain: [{ nom: 'Youssef', sujet: 'Relire mon CV', rdv_at: DEMAIN, m: MT, n: 1 }, 4 * H, 'high'],
  entretien_demain: [{ nom: 'Salma', rdv_at: DEMAIN, duree: 30, visio: true, m: uid(46), de: DE, n: 1 }, 4 * H, 'high'],
  agenda_demain: [{ type: 'evenement', titre: 'Forum entreprises', debut: DEMAIN, lieu: 'Amphi A', id: EV, n: 1 }, 4 * H, 'high'],
  apres_rdv: [{ nom: 'Youssef', sujet: 'Relire mon CV', m: MT, pour: 'demandeur' }, 24 * H, 'high'],
  offre_bientot: [{ titre: 'Stage lean', entreprise: 'OCP', date_limite: '2026-11-10', offre: OF, jours: 1 }, 12 * H, 'high'],
  demande_attente: [{ nom: 'Hiba', type: 'pfe', titre: 'PFE supply chain', demande: DM }, 24 * H, 'high'],
  demande_pause: [{ titre: 'Stage en BTP', demande: DM }, 24 * H, 'normal'],
  semaine: [{ type: 'etudiant', offres: 2 }, 12 * H, 'normal'],
  groupe_jour: [{ n: 2, groupe: 'Génie industriel', gkey: 'filiere:genie industriel', autres: 0 }, 12 * H, 'normal'],
  rappel_visite: [{ messages: 2 }, 24 * H, 'normal'],
  message: [{ nom: 'Salma', de: DE, type: 'texte', texte: 'Bonjour' }, 24 * H, 'high'],
  rappel_rdv: [{ nom: 'Youssef', sujet: 'Relire mon CV', rdv_at: DEMAIN, m: MT }, 900, 'high'],
};
const ENTRE_PERSONNES = ['message', 'rappel_rdv'];
// Une ligne de file de chaque type, chacune pour son membre (un téléphone), traitée par la fonction à l'heure dite ; rend
// le banc, la réponse de la fonction et, par type, ce que le service de push a reçu
async function traiterA(iso, types = Object.keys(TYPES)) {
  const b = nouveauBanc();
  const tel = new Map();
  types.forEach((kind, i) => {
    const u = uid(600 + i);
    b.tables.profiles.push(profil(u));
    tel.set(b.abonner(u, 1).endpoint, kind);
    b.tables.push_queue.push({ id: 700 + i, user_id: u, kind, data: TYPES[kind][0] });
  });
  const bilan = await aLHeure(iso, async () => corpsDe(await appel({ job: 'push' })));
  const recu = Object.fromEntries(b.push.map(p => [tel.get(p.endpoint), { ttl: Number(p.entetes.ttl), urgence: p.entetes.urgency }]));
  return { b, bilan, recu };
}

test('service de push : la durée de vie et l’urgence du contrat pour chaque type ; une notification programmée ne vit pas au-delà de 21:30', async () => {
  // À 8 h, il reste 13 h 30 avant la nuit : les durées du contrat partent telles quelles, celles d'un jour sont raccourcies
  const matin = await traiterA('2026-11-09T08:00:00Z');
  assert.deepEqual(matin.bilan, { sent: Object.keys(TYPES).length, failed: 0, removed: 0 });
  for (const [kind, [, vie, urgence]] of Object.entries(TYPES)) {
    assert.deepEqual(matin.recu[kind], { ttl: ENTRE_PERSONNES.includes(kind) ? vie : Math.min(vie, 13.5 * H), urgence }, kind);
  }
  assert.deepEqual(['match_jour', 'rdv_demain', 'entretien_demain', 'agenda_demain', 'match_attente', 'offre_bientot', 'semaine', 'groupe_jour'].map(k => matin.recu[k].ttl),
    [6 * H, 4 * H, 4 * H, 4 * H, 12 * H, 12 * H, 12 * H, 12 * H], 'jamais un jour pour tout');
  // À 19 h 30 (la veille, après un rendez-vous, les groupes du jour) : 2 h au plus, plus rien ne sonne à 2 h du matin ;
  // entre personnes, la durée ne change pas
  const soir = await traiterA('2026-11-09T19:30:00Z');
  for (const [kind, [, vie, urgence]] of Object.entries(TYPES)) {
    assert.deepEqual(soir.recu[kind], { ttl: ENTRE_PERSONNES.includes(kind) ? vie : 2 * H, urgence }, kind);
  }
  // À 21:05 (la dernière demande sans aide de la journée) : 25 minutes ; à 21:29:30, 30 secondes
  assert.equal((await traiterA('2026-11-09T21:05:00Z', ['demande_attente'])).recu.demande_attente.ttl, 25 * 60);
  assert.equal((await traiterA('2026-11-09T21:29:30Z', ['groupe_jour'])).recu.groupe_jour.ttl, 30);
});

test('nuit calme : prise après 21:30 (file en retard), une notification programmée ne part pas et sort de la file, notée -5 ; entre personnes, elle part', async () => {
  for (const iso of ['2026-11-09T21:30:00Z', '2026-11-09T23:00:00Z', '2026-11-10T03:00:00Z', '2026-11-10T07:59:59Z']) {
    erreurs = [];
    const { b, bilan, recu } = await traiterA(iso);
    assert.deepEqual(Object.keys(recu).sort(), [...ENTRE_PERSONNES].sort(), iso);
    assert.deepEqual(bilan, { sent: ENTRE_PERSONNES.length, failed: 0, removed: 0 }, iso);
    assert.deepEqual(b.tables.push_queue, [], `${iso} : rien ne reste en file, pas de nouvel essai dans la nuit`);
    const journal = Object.fromEntries(b.tables.push_journal.map(x => [x.kind, x.code]));
    for (const kind of Object.keys(TYPES)) assert.equal(journal[kind], ENTRE_PERSONNES.includes(kind) ? 201 : -5, `${iso} ${kind}`);
    assert.ok(erreurs.some(e => e.includes('nuit calme') && e.includes('groupe_jour')), `${iso} : dit dans les Logs`);
    assert.ok(!erreurs.some(e => /Salma|Youssef|Hiba|Génie|Stage/.test(e)), 'les Logs ne gardent que le type');
  }
  // À 8 h, tout repart
  assert.equal(Object.keys((await traiterA('2026-11-10T08:00:00Z')).recu).length, Object.keys(TYPES).length);
});

test('nuit calme : le temps qui reste avant 21:30 ; les types programmés sont ceux du budget de la base (programme_place)', () => {
  const a = iso => N.avantNuit(Date.parse(iso));
  assert.deepEqual(['08:00:00', '12:30:00', '19:30:00', '21:05:00', '21:29:30', '21:30:00', '23:59:59'].map(h => a(`2026-11-09T${h}Z`)),
    [13.5 * H, 9 * H, 2 * H, 25 * 60, 30, 0, 0]);
  assert.deepEqual(['00:00:00', '03:00:00', '07:59:59', '08:00:00'].map(h => a(`2026-11-10T${h}Z`)), [0, 0, 0, 13.5 * H], 'après minuit aussi');
  // Un type programmé de plus dans la base (programme_place) : la fonction le borne aussi
  const sql = fs.readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8');
  const budget = [...new Set([...sql.matchAll(/programme_place\(\w+\.\w+, '(\w+)'\)/g)].map(x => x[1]))].sort();
  assert.equal(budget.length, 12);
  assert.deepEqual([...N.PROGRAMMEES].sort(), budget);
  assert.deepEqual(Object.keys(TYPES).filter(k => !ENTRE_PERSONNES.includes(k)).sort(), budget, 'les tests ci-dessus essaient chacun');
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
