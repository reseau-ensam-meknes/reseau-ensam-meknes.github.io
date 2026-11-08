// Page d'entrée par le lien d'une école (?ecole=) : dans le navigateur d'une application sur iPhone ou iPad, l'adresse garde
// ce que « Ouvrir dans Chrome » emporte sur Android (Safari le relit) ; une école ouverte y est nommée comme dans
// l'application, avec ses règles d'email ; une école pas encore ouverte, jamais. Pour l'ENSAM Meknès : rien de plus, pas
// même une lecture.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Le navigateur, juste ce qu'il faut pour charger la page d'entrée (sans la démarrer)
const stockage = new Map();
globalThis.window = globalThis;
globalThis.ENSAM_ENTREE = true;
globalThis.document = { documentElement: {}, addEventListener() {}, querySelector: () => null, head: { appendChild() {} }, createElement: () => ({ dataset: {}, style: {} }) };
globalThis.addEventListener = () => {};
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.localStorage = { getItem: k => (stockage.has(k) ? stockage.get(k) : null), setItem: (k, v) => stockage.set(k, String(v)), removeItem: k => stockage.delete(k) };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.location = { href: 'https://r.io/', origin: 'https://r.io', pathname: '/', search: '', hash: '' };
globalThis.history = { state: null, replaceState(_, __, u) { location.href = new URL(u, location.href).href; } };

const R = await import('../../src/regles-entree.js');
const A = await import('../../src/appareil.js');
const L = await import('../../src/logic.js');
const E = await import('../../src/entree.js');
const { setLang, t } = await import('../../src/i18n.js');

const FES = { slug: 'ensa-fes', nom: 'ENSA Fès', nom_court: 'ENSA', ville: 'Fès', nom_ar: 'ENSA فاس', couleur: '#225588', ouverte: true };
const FST = { slug: 'fst-settat', nom: 'FST Settat', nom_court: 'FST', ville: 'Settat', ouverte: true, domaines: ['fsts.ac.ma', 3, '', null], email_obligatoire: true };
const CASA = { slug: 'ensam-casa', nom: 'ENSAM Casablanca', nom_court: 'ENSAM', ville: 'Casablanca', nom_ar: 'ENSAM الدار البيضاء', ouverte: false };
const MEKNES = { slug: 'ensam-meknes', nom: 'ENSAM Meknès', ouverte: true };
const ecoleDuLien = e => (e ? stockage.set('ensam-invite-ecole', e) : stockage.delete('ensam-invite-ecole'));
const params = adresse => Object.fromEntries(new URL(adresse, 'https://r.io').searchParams);

test('navigateur d’une application sur iPhone ou iPad : l’adresse porte ce que « Ouvrir dans Chrome » emporte, à la place du sien ; Safari le relit ; sans contexte, l’adresse propre', () => {
  const { adresseAvecContexte } = R;
  const tout = { promo: 2019, de: 'nadia219', ecole: 'ensa-fes', role: 'laureat', mode: 'inscription' };
  const ici = adresseAvecContexte('https://r.io/', tout, 'ar');
  assert.equal(ici, '/?promo=2019&de=nadia219&ecole=ensa-fes&role=laureat&mode=inscription&lang=ar');
  // Le même contexte que lienChrome (Android), sans notifs=1 (qui ouvre la feuille d'activation de Chrome)
  const secours = params(decodeURIComponent(A.lienChrome('https://r.io/', '', { lang: 'ar', contexte: tout }).match(/S\.browser_fallback_url=([^;]+);/)[1]));
  delete secours.notifs;
  assert.deepEqual(params(ici), secours);
  // Une seule règle pour les deux navigateurs (appareil.js et logic.js la reprennent telle quelle)
  assert.equal(A.contexteEntree, R.contexteEntree);
  assert.equal(L.contexteEntree, R.contexteEntree);
  // À la place des siens : une autre promo, l'arabe quitté, un rôle plus choisi, une autre étape ; le reste ne bouge pas
  assert.equal(adresseAvecContexte('https://r.io/index.html?x=1&promo=2018&lang=ar&role=etudiant&mode=connexion#offre/abc-123', { promo: 2019 }, 'fr'), '/index.html?x=1&promo=2019#offre/abc-123');
  // Sans contexte (inscription finie) : propre, le reste gardé (une route pour l'application, le #)
  assert.equal(adresseAvecContexte('https://r.io/?r=mentorat&promo=2019&de=nadia219&ecole=ensa-fes&role=laureat&mode=connexion&lang=ar#accueil', null, 'ar'), '/?r=mentorat#accueil');
  // Jamais une valeur que la page d'entrée ne relirait pas, ni l'email tapé, ni l'accord
  assert.equal(adresseAvecContexte('https://r.io/', { promo: 1900, de: 'Nadia', ecole: 'ENSA Fès', role: 'admin', mode: 'nouveau', email: 'a@b.ma', accord: true }, 'fr'), '/');
  // La page d'entrée de Safari (stockage vide) relit tout : la promo, qui invite, l'école et l'arabe (lireInvitation),
  // puis l'étape et le rôle (contexteArrivee)
  location.href = new URL(ici, 'https://r.io').href;
  assert.equal(E.lireInvitation(), 'ar');
  assert.deepEqual(['ensam-invite-promo', 'ensam-invite-de', 'ensam-invite-ecole'].map(k => stockage.get(k)), ['2019', 'nadia219', 'ensa-fes']);
  const a = E.contexteArrivee(new URL(location.href).search);
  assert.deepEqual([a.role, a.mode, a.search], ['laureat', 'inscription', '']);
  for (const k of ['ensam-invite-promo', 'ensam-invite-de', 'ensam-invite-ecole']) stockage.delete(k);
});

test('lien d’une école ouverte : ses noms, ceux de l’application, et ses règles d’email ; une école pas encore ouverte, l’ENSAM Meknès, une ligne bizarre : rien (la page d’avant)', async () => {
  const fes = E.nomsDeLigne(FES);
  assert.deepEqual({ ...fes }, { nom: 'ENSA Fès', marque: 'Réseau ENSA Fès', etudiant: 'De la 1re à la 5e année à l’ENSA Fès', laureat: 'De l’ENSA Fès, en poste ou en recherche d’emploi', diplome: 'Diplôme ENSA', bande: 'ENSA · FÈS', domaines: [], obligatoire: false });
  assert.equal(E.nomsDeLigne(FES), fes, 'une fois par ligne');
  // Les noms de l'application (nomsEcole, logic.js : l'onglet, la marque) et son élision (deLEcoleNommee)
  assert.equal(fes.marque, `Réseau ${L.nomsEcole([FES, FST], 'ensa-fes').nom}`);
  const fst = E.nomsDeLigne(FST);
  assert.equal(fst.laureat, `D${L.deLEcoleNommee('FST Settat').slice(1)}, en poste ou en recherche d’emploi`);
  assert.equal(fst.etudiant, 'De la 1re à la 5e année à l’école FST Settat');
  assert.deepEqual([fst.domaines, fst.obligatoire, fst.bande], [['fsts.ac.ma'], true, 'FST · SETTAT']);
  const sansNom = { slug: 'ensa-oujda', nom_court: 'ENSA', ville: 'Oujda', ouverte: true };
  assert.equal(E.nomsDeLigne(sansNom).nom, L.nomsEcole([sansNom], 'ensa-oujda').nom);
  assert.equal(E.nomsDeLigne({ ...FES, email_obligatoire: 'oui' }).obligatoire, false);
  for (const l of [CASA, MEKNES, { ...FES, ouverte: 'true' }, { ...FES, slug: 'ENSA Fès' }, null, undefined, {}]) assert.equal(E.nomsDeLigne(l), null, JSON.stringify(l));
  // En arabe, sans attendre le dictionnaire : son nom arabe (sans, son nom)
  await setLang('ar', { attendre: false, garder: false });
  try {
    assert.deepEqual([fes.marque, fes.etudiant, fes.laureat, fes.diplome].map(t), ['شبكة ENSA فاس', 'من السنة الأولى إلى الخامسة في ENSA فاس', 'من ENSA فاس، في وظيفة أو في بحث عن عمل', 'شهادة ENSA']);
    assert.equal(t(fst.marque), 'شبكة FST Settat');
  } finally { await setLang('fr', { attendre: false, garder: false }); }
});

test('lien d’une école : sa ligne lue une fois par visite (une lecture des écoles ouvertes) ; rien à lire pour l’ENSAM Meknès, sans lien ou en démo ; les fonctions publiques comme avant', async () => {
  const cfg = { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k' };
  const appels = [];
  let reponse = () => ({ status: 200, x: [FES] });
  globalThis.fetch = async (url, o) => {
    appels.push([String(url), o.method, o.body, o.headers.apikey]);
    const r = reponse();
    return { ok: r.status < 300, status: r.status, json: async () => r.x };
  };
  for (const e of [null, 'ensam-meknes', 'ENSA Fès']) { ecoleDuLien(e); assert.equal(await E.ecoleDuLien(cfg), null, String(e)); }
  ecoleDuLien('ensa-fes');
  assert.equal(await E.ecoleDuLien({}), null, 'démo');
  assert.deepEqual(appels, [], 'rien n’est lu');
  assert.equal((await E.ecoleDuLien(cfg)).marque, 'Réseau ENSA Fès');
  assert.deepEqual(appels, [['https://x.supabase.co/rest/v1/ecoles?select=*&slug=eq.ensa-fes&ouverte=is.true', 'GET', null, 'k']]);
  assert.equal(await E.ecoleDuLien(cfg), await E.ecoleDuLien(cfg));
  assert.equal(appels.length, 1, 'une fois par visite');
  // Pas encore ouverte : la base ne la rend pas à un visiteur, ou la rend fermée ; une autre ligne que la sienne : rien
  ecoleDuLien('ensam-casa'); reponse = () => ({ status: 200, x: [] });
  assert.equal(await E.ecoleDuLien(cfg), null);
  ecoleDuLien('ensa-oujda'); reponse = () => ({ status: 200, x: [{ slug: 'ensa-oujda', nom: 'ENSA Oujda', ouverte: false }] });
  assert.equal(await E.ecoleDuLien(cfg), null);
  ecoleDuLien('ensa-tanger'); reponse = () => ({ status: 200, x: [FES] });
  assert.equal(await E.ecoleDuLien(cfg), null);
  // Sans réseau (ou la base refuse) : rien, et relue la fois suivante
  ecoleDuLien('fst-settat'); reponse = () => ({ status: 500, x: {} });
  assert.equal(await E.ecoleDuLien(cfg), null);
  reponse = () => ({ status: 200, x: [FST] });
  assert.equal((await E.ecoleDuLien(cfg)).marque, 'Réseau FST Settat');
  assert.equal(appels.length, 6);
  // Les fonctions publiques de la base : la même demande qu'avant (POST, son corps)
  ecoleDuLien(null); reponse = () => ({ status: 200, x: { laureats: 3 } });
  assert.deepEqual(await E.chiffresPublics(cfg), { laureats: 3 });
  assert.deepEqual(appels.at(-1), ['https://x.supabase.co/rest/v1/rpc/chiffres_publics', 'POST', '{}', 'k']);
});
