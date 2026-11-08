// Console de l'administration d'une école (un admin dont l'école n'est pas l'ENSAM Meknès : super_admin() est faux pour
// lui). Depuis le 3e tour SQL, la base ne lui donne que son école : la console est celle de son école seulement (ses
// rubriques, ses textes à son nom), sans ce qui appartient au réseau (Réglages, Écoles, Partenaires, Affiches et rapport,
// santé des notifications), et le guide de l'étranger ne s'y supprime pas et ne s'y écrit que comme un lauréat sur place
// (protect_guide). Sa liste officielle d'une école pas encore ouverte lit le dossier CNDP par dossier_cndp_de_mon_ecole().
// La démo suit les mêmes règles. L'administration du réseau garde tout comme avant, à l'octet près.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Le navigateur, juste ce qu'il faut pour charger la console (sans démarrer la page d'entrée)
const stockage = new Map();
globalThis.window = globalThis;
globalThis.ENSAM_ENTREE = true;
globalThis.document = { documentElement: {}, addEventListener() {}, querySelector: () => null, head: { appendChild() {} }, createElement: () => ({ dataset: {}, style: {} }) };
globalThis.addEventListener = () => {};
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.localStorage = { getItem: k => (stockage.has(k) ? stockage.get(k) : null), setItem: (k, v) => stockage.set(k, String(v)), removeItem: k => stockage.delete(k), clear: () => stockage.clear() };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.location = { href: 'https://r.io/index.html#admin', origin: 'https://r.io', pathname: '/', search: '', hash: '#admin' };

const L = await import('../../src/logic.js');
const C = await import('../../src/admin-console.js');
const K = await import('../../src/admin-console-cibles.js');
const A = await import('../../src/admin.js');
const D = await import('../../src/admin-donnees.js');
const S = await import('../../src/store.js');
const { setLang, t } = await import('../../src/i18n.js');

const IE = 'institut-exemple';
const LIGNE_IE = { slug: IE, nom: 'Institut exemple', ouverte: false, created_at: '2026-11-01T00:00:00Z' };
const FST = { slug: 'fst-settat', nom: 'FST Settat', nom_court: 'FST', ville: 'Settat', nom_ar: 'FST سطات', ouverte: true, created_at: '2026-10-02T00:00:00Z' };
const RESEAU = { id: 'r', role: 'admin' }, MEKNES = { id: 'm', role: 'admin', ecole: 'ensam-meknes' }, ADMIN_IE = { id: 'a-ie', role: 'admin', ecole: IE };
const ie = L.nomsEcole([LIGNE_IE], IE), fst = L.nomsEcole([FST], 'fst-settat');
// Les marques de direction (isolants) que l'arabe met autour des noms et des nombres
const nu = s => s.replace(/[‎‏⁦-⁩]/g, '');

test('rubriques : le réseau garde toutes les siennes (les mêmes tableaux) ; une école n’a ni Réglages, ni Écoles, ni Partenaires, ni Affiches', () => {
  assert.deepEqual(C.RUBRIQUES_DU_RESEAU, ['ecoles', 'partenaires', 'outils', 'reglages']);
  for (const me of [RESEAU, MEKNES]) {
    assert.equal(C.groupesPour(me), C.GROUPES, 'le réseau : les groupes d’avant, tels quels');
    assert.equal(C.rubriquesPour(me), C.RUBRIQUES);
  }
  assert.equal(C.RUBRIQUES.length, 14);
  assert.deepEqual(C.rubriquesPour(ADMIN_IE).map(([k]) => k), ['', 'traiter', 'animer', 'agenda', 'inviter', 'membres', 'contenus', 'moderation', 'liste', 'sponsorises']);
  // Les groupes sans rubrique disparaissent (celui de Réglages) ; Grandir garde Sponsorisés
  assert.deepEqual(C.groupesPour(ADMIN_IE).map(([g, l]) => [g, l.map(([k]) => k)]),
    [['Piloter', ['', 'traiter']], ['Animer', ['animer', 'agenda', 'inviter']], ['Gérer', ['membres', 'contenus', 'moderation', 'liste']], ['Grandir', ['sponsorises']]]);
  // Les intitulés et icônes ne changent pas
  assert.deepEqual(C.rubriquesPour(ADMIN_IE).find(([k]) => k === 'sponsorises'), C.RUBRIQUES.find(([k]) => k === 'sponsorises'));
});

test('textes de la console qui nomment l’école : la sienne, jamais l’ENSAM Meknès ; ceux du réseau à l’octet près', async () => {
  const x = A.textesDeSonEcole(ie);
  assert.equal(x.verifier, 'Vérifie que la personne est bien diplômée de l’Institut exemple (promo, filière), puis valide. Le badge rassure les étudiants. Deux lauréats vérifiés de sa promo peuvent aussi le confirmer.');
  assert.equal(x.parrains, 'Le bouton attribue les parrains aux étudiants de l’Institut exemple ; la plateforme le fait aussi chaque matin.');
  assert.deepEqual([x.attribues(1), x.attribues(3)], ['1 parrain attribué aux étudiants de l’Institut exemple.', '3 parrains attribués aux étudiants de l’Institut exemple.']);
  assert.equal(A.textesDeSonEcole(ie), x, 'une fois par école');
  assert.match(A.textesDeSonEcole(fst).verifier, /diplômée de l’école FST Settat \(promo/);
  // Demande de CV à un membre : sans école, le texte d'avant ; sinon le nom de son école (dans la langue du membre)
  const p = { full_name: 'Amine Talbi', langue: 'fr' }, pa = { ...p, langue: 'ar' };
  assert.equal(K.demandeCV(p), 'Bonjour Amine, bienvenue sur le Réseau ENSAM Meknès ! Pour vérifier ton profil, peux-tu déposer ton CV en PDF dans « Mon profil » (ou ajouter ton lien LinkedIn) ? Ça prend une minute. Merci !');
  assert.equal(K.demandeCV(p, L.NOMS_MEKNES), K.demandeCV(p));
  assert.equal(K.demandeCV(p, ie), K.demandeCV(p).replace('Réseau ENSAM Meknès', 'Réseau Institut exemple'));
  assert.equal(K.demandeCV(pa, fst), K.demandeCV(pa).replace('شبكة ENSAM مكناس', 'شبكة FST سطات'));
  // Bilan d'une carte de son école : le réseau de son école ; sans noms, celui d'avant
  const carte = { titre: 'Visite d’usine', entreprise: 'Atelier Exemple', ecole: IE, debut: '2026-11-01', fin: '2026-11-30' }, tot = { vues: 4, clics: 1, membres: 3 };
  const avant = A.bilanSponso(carte, tot, '2026-11-08');
  assert.match(avant, /^Bilan · Réseau ENSAM Meknès\nCarte sponsorisée : « Visite d’usine » \(Atelier Exemple\)\n/);
  assert.equal(A.bilanSponso(carte, tot, '2026-11-08', null, L.NOMS_MEKNES), avant);
  assert.equal(A.bilanSponso(carte, tot, '2026-11-08', null, ie), avant.replace('Réseau ENSAM Meknès', 'Réseau Institut exemple'));
  await setLang('ar');
  try {
    assert.equal(nu(t(x.verifier)), 'تحقق من أن الشخص خريج Institut exemple (الدفعة، الشعبة)، ثم أكّد. الشارة تطمئن الطلبة. يمكن أيضًا لخريجَين متحقق منهما من دفعته تأكيد ذلك.');
    assert.equal(nu(t(A.textesDeSonEcole(fst).verifier)), 'تحقق من أن الشخص خريج FST سطات (الدفعة، الشعبة)، ثم أكّد. الشارة تطمئن الطلبة. يمكن أيضًا لخريجَين متحقق منهما من دفعته تأكيد ذلك.');
    // Le paragraphe du parrainage, chiffres compris : celui d'une seule école, avec la phrase de son école à la fin
    const debut = '3 filleuls cette année · 2 lauréats volontaires · 1 étudiant de 3A sans parrain. ';
    const seule = nu(t(debut + 'Chaque matin, la plateforme attribue aussi les parrains toute seule.'));
    assert.ok(seule.endsWith('كل صباح تعيّن المنصة العرّابين تلقائيًا أيضًا.'), seule);
    assert.equal(nu(t(debut + x.parrains)), seule.replace('كل صباح تعيّن المنصة العرّابين تلقائيًا أيضًا.', 'يعيّن الزر العرّابين لطلبة Institut exemple؛ وتفعل المنصة ذلك أيضًا كل صباح.'));
    assert.equal(nu(t(x.attribues(3))), 'عدد العرّابين المعيَّنين لطلبة Institut exemple: 3.');
    assert.equal(nu(t(A.textesDeSonEcole(fst).attribues(2))), 'عدد العرّابين المعيَّنين لطلبة FST سطات: 2.');
    const bilan = A.bilanSponso(carte, tot, '2026-11-08', null, fst);
    assert.equal(bilan, A.bilanSponso(carte, tot, '2026-11-08').replace('شبكة ENSAM مكناس', 'شبكة FST سطات'));
    for (const s of [t(x.verifier), t(debut + x.parrains), t(x.attribues(3)), bilan]) assert.doesNotMatch(s, /مكناس|Meknès/);
  } finally { await setLang('fr'); }
});

test('admin_suivi (le suivi des écoles et des partenaires) n’est qu’à l’administration du réseau', () => {
  assert.equal(D.reserveeAuReseau('admin_suivi', ADMIN_IE), true);
  for (const me of [RESEAU, MEKNES]) assert.equal(D.reserveeAuReseau('admin_suivi', me), false);
  for (const tb of ['ecoles', 'liste_officielle', 'guide_pays_historique']) assert.equal(D.reserveeAuReseau(tb, ADMIN_IE), false, tb);
});

// ---------------------------------------------------------------------------
// La démo : mêmes règles que la base
// ---------------------------------------------------------------------------
const saison = L.seasonOf();
// La démo, avec l'Institut exemple (pas encore ouvert) : son admin, un lauréat volontaire et un étudiant de 3A de sa
// filière, et une ligne de sa liste officielle ; l'admin de la démo reste celui du réseau
async function demo() {
  stockage.clear();
  window.ENSAM_CONFIG = {};
  const s = await S.createStore();
  s.data.ecoles = [...(s.data.ecoles || []), LIGNE_IE];
  const fil = 'Génie Industriel', t0 = '2026-10-01T10:00:00Z';
  s.data.profiles.push({ ...ADMIN_IE, full_name: 'Nadia Ferhat', verified: true, admin_ok: true, promo: 2012, filiere: fil, created_at: t0 },
    { id: 'ie-lau', role: 'laureat', ecole: IE, full_name: 'Youssef El Amrani', verified: true, parrain_dispo: true, promo: 2018, filiere: fil, created_at: t0 },
    { id: 'ie-etu', role: 'etudiant', ecole: IE, full_name: 'Salma Bennani', verified: true, promo: saison + 3, filiere: fil, created_at: t0 });
  s.data.liste_officielle = [...s.data.liste_officielle, { id: 'lo-ie', ecole: IE, nom: 'Salma Bennani', promo: saison + 3, filiere: fil, created_at: t0 }];
  const reseau = s.personas().find(p => p._persona.includes('Admin'));
  return { s, reseau: () => s.switchTo(reseau.id), ecole: () => s.switchTo(ADMIN_IE.id) };
}
const RUBRIQUE = 'Un texte assez long pour la rubrique du guide.';

test('démo, administration d’une école : ni les réglages du réseau, ni la santé des notifications ; le guide comme un membre', async () => {
  const { s, ecole } = await demo();
  ecole();
  assert.equal(s.me.id, ADMIN_IE.id);
  const avant = JSON.stringify(s.reglages);
  await assert.rejects(s.enregistrerReglage('domaines_ecole', ['institut.ma']), { message: 'Action non autorisée pour ton compte.' });
  assert.equal(JSON.stringify(s.reglages), avant, 'rien n’a changé');
  await assert.rejects(s.santeNotifs(), { message: 'Réservé à l’administration.' });
  // Le guide, commun à toutes les écoles : écrit seulement par un lauréat qui vit dans le pays (protect_guide)
  const fr = s.data.guide_pays.find(g => g.pays === 'France');
  await assert.rejects(s.update('guide_pays', fr.id, { contenu: RUBRIQUE }), { message: 'Seuls les lauréats qui vivent dans ce pays peuvent écrire son guide.' });
  await assert.rejects(s.insert('guide_pays', { pays: 'Espagne', section: 'visa', contenu: RUBRIQUE }), { message: 'Seuls les lauréats qui vivent dans ce pays peuvent écrire son guide.' });
  // Supprimer : la base ne touche aucune ligne, sans erreur ; « exiger » le dit
  const n = s.data.guide_pays.length;
  await s.remove('guide_pays', fr.id);
  await assert.rejects(s.remove('guide_pays', fr.id, { exiger: L.RIEN_GUIDE }), { message: L.RIEN_GUIDE });
  assert.equal(s.data.guide_pays.length, n);
  assert.ok(s.byId('guide_pays', fr.id), 'la rubrique est toujours là');
});

test('démo, administration du réseau : réglages, santé des notifications et guide comme avant ; une rubrique déjà partie est dite', async () => {
  const { s, reseau } = await demo();
  reseau();
  assert.equal(L.adminDuReseau(s.me), true);
  await s.enregistrerReglage('domaines_ecole', ['ensam-umi.ac.ma']);
  assert.deepEqual(s.reglages.domaines_ecole, ['ensam-umi.ac.ma']);
  assert.ok((await s.santeNotifs()).jours?.length >= 1);
  const [fr, de] = s.data.guide_pays.filter(g => g.pays === 'France');
  await s.update('guide_pays', fr.id, { contenu: RUBRIQUE });
  assert.equal(s.byId('guide_pays', fr.id).contenu, RUBRIQUE);
  await s.remove('guide_pays', fr.id, { exiger: L.RIEN_GUIDE });
  assert.equal(s.byId('guide_pays', fr.id), undefined);
  // Déjà supprimée ailleurs : « exiger » le dit ; sans, comme avant (rien, sans erreur)
  await assert.rejects(s.remove('guide_pays', fr.id, { exiger: L.RIEN_GUIDE }), { message: L.RIEN_GUIDE });
  await s.remove('guide_pays', fr.id);
  await s.remove('guide_pays', de.id);
  assert.equal(s.byId('guide_pays', de.id), undefined);
});

test('démo, administration d’une école : dossier CNDP de son école, liste officielle et parrains de son école seulement', async () => {
  const { s, reseau, ecole } = await demo();
  ecole();
  // Le suivi (admin_suivi) ne se lit pas d'ici : seul dossier_cndp_de_mon_ecole() dit si son école est au dossier
  assert.equal(await s.dossierCndpDeMonEcole(), false);
  s.data.admin_suivi = [...s.data.admin_suivi, { id: 'sv-ie', type: 'ecole', nom: 'Institut exemple', ecole_slug: IE, cndp_ok: false, created_at: '2026-11-01T00:00:00Z' }];
  assert.equal(await s.dossierCndpDeMonEcole(), false);
  s.data.admin_suivi = s.data.admin_suivi.map(x => (x.id === 'sv-ie' ? { ...x, cndp_ok: true } : x));
  assert.equal(await s.dossierCndpDeMonEcole(), true);
  s.data.admin_suivi = s.data.admin_suivi.map(x => (x.id === 'sv-ie' ? { ...x, ecole_slug: 'ensam-meknes' } : x));
  assert.equal(await s.dossierCndpDeMonEcole(), false, 'la ligne d’une autre école ne compte pas');
  // La liste officielle : celle de son école, quelle que soit l'école demandée (comme ecole_visee() dans la base)
  const couv = await s.couvertureListe('ensam-meknes');
  assert.deepEqual(couv.map(c => [c.promo, c.total]), [[saison + 3, 1]]);
  assert.deepEqual(await s.couvertureListe(), couv);
  // Les parrains : attribués dans son école seulement
  const avant = s.data.parrainages.length;
  assert.equal(await s.attribuerParrains(), 1);
  assert.deepEqual(s.data.parrainages.slice(0, s.data.parrainages.length - avant).map(x => [x.filleul_id, x.parrain_id]), [['ie-etu', 'ie-lau']]);
  // L'administration du réseau, comme avant : toutes les écoles
  reseau();
  assert.ok((await s.couvertureListe('ensam-meknes')).length > 1);
  assert.deepEqual((await s.couvertureListe(IE)).map(c => [c.promo, c.total]), [[saison + 3, 1]]);
});

test('en ligne : dossier_cndp_de_mon_ecole(), vrai seulement quand la base répond vrai ; une base sans la fonction ou une erreur : faux', async () => {
  const appels = [];
  const s = new S.SupabaseStore({});
  const reponses = [{ data: true, error: null }, { data: false, error: null }, { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.dossier_cndp_de_mon_ecole' } },
    { data: 'oui', error: null }, { data: null, error: { code: '42501', message: 'permission denied' } }];
  const vus = [];
  for (const r of reponses) {
    s.sb = { rpc: async (nom, args) => { appels.push([nom, args]); return r; } };
    vus.push(await s.dossierCndpDeMonEcole());
  }
  s.sb = { rpc: async () => { throw new TypeError('Failed to fetch'); } };
  vus.push(await s.dossierCndpDeMonEcole());
  assert.deepEqual(vus, [true, false, false, false, false, false]);
  assert.deepEqual(appels.map(([n, a]) => [n, a]), Array(5).fill(['dossier_cndp_de_mon_ecole', undefined]), 'sans argument : la base prend l’école de l’appelant');
});

test('Modération : « Supprimer la rubrique » du guide pour le réseau seulement, et une rubrique déjà partie est dite', async () => {
  const appels = [];
  const store = { byId: (tb, id) => (tb === 'guide_pays' && id === 'g1' ? { id: 'g1', pays: 'France', section: 'visa', contenu: 'Le visa…', updated_by: 'u1' } : null), remove: async (...a) => { appels.push(a); } };
  const ctx = me => ({ store, me, openOffer() {}, openProfile() {}, go() {} });
  const r = K.cible(ctx(RESEAU), 'guide', 'g1');
  assert.deepEqual(r.actions.map(([l, , danger]) => [l, danger]), [['Supprimer la rubrique', true]]);
  await r.actions[0][1]();
  assert.deepEqual(appels, [['guide_pays', 'g1', { exiger: L.RIEN_GUIDE }]]);
  assert.deepEqual(K.cible(ctx(MEKNES), 'guide', 'g1').actions.map(([l]) => l), ['Supprimer la rubrique']);
  // L'administration d'une école : la base ne la laisse pas supprimer ; le contenu se lit, rien à faire de lui
  const e = K.cible(ctx(ADMIN_IE), 'guide', 'g1');
  assert.equal(e.titre, 'France · Visa et titre de séjour');
  assert.deepEqual(e.actions, []);
});
