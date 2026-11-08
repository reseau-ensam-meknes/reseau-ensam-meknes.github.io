// Écoles : les liens et les messages d'invitation disent l'école du membre (ou celle que regarde la console), le titre,
// la marque et la carte la nomment, la page d'entrée demande les chiffres et les fondateurs de l'école du lien. Pour
// l'ENSAM Meknès, tout reste comme avant, à l'octet près ; une école pas encore ouverte n'est jamais nommée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Le navigateur, juste ce qu'il faut pour charger invitation.js, admin-animer.js et la page d'entrée (sans la démarrer)
const stockage = new Map();
globalThis.window = globalThis;
globalThis.ENSAM_ENTREE = true;
globalThis.document = { documentElement: {}, addEventListener() {}, querySelector: () => null, head: { appendChild() {} }, createElement: () => ({ dataset: {}, style: {} }) };
globalThis.addEventListener = () => {};
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.localStorage = { getItem: k => (stockage.has(k) ? stockage.get(k) : null), setItem: (k, v) => stockage.set(k, String(v)), removeItem: k => stockage.delete(k) };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.location = { href: 'https://r.io/index.html#espace', origin: 'https://r.io', pathname: '/', search: '', hash: '' };

const L = await import('../../src/logic.js');
const I = await import('../../src/invitation.js');
const T = await import('../../src/admin-textes.js');
const { lienSite } = await import('../../src/admin-animer.js');
const S = await import('../../src/store.js');
const E = await import('../../src/entree.js');
const F = await import('../../src/fondateurs-public.js');
const { setLang, t } = await import('../../src/i18n.js');
const { NOMS_MEKNES, nomsEcole } = L;

// Des écoles d'exemple (lignes de la table des écoles) : une ouverte qui s'élide (« de l'ENSA Fès »), une ouverte qui ne
// s'élide pas (« de l'école FST Settat »), une pas encore ouverte (jamais nommée hors de l'application)
const FES = { slug: 'ensa-fes', nom: 'ENSA Fès', nom_court: 'ENSA', ville: 'Fès', nom_ar: 'ENSA فاس', couleur: '#225588', ouverte: true, created_at: '2026-10-01T00:00:00Z' };
const FST = { slug: 'fst-settat', nom: 'FST Settat', nom_court: 'FST', ville: 'Settat', ouverte: true, created_at: '2026-10-02T00:00:00Z' };
const FERMEE = { slug: 'ecole-exemple', nom: 'École exemple', nom_court: 'EE', ville: 'Exempleville', nom_ar: 'مدرسة مثال', ouverte: false, created_at: '2026-10-03T00:00:00Z' };
const MEKNES = { slug: 'ensam-meknes', nom: 'ENSAM Meknès', ouverte: true, created_at: '2026-10-21T00:00:00Z' };
const ECOLES = [MEKNES, FES, FST, FERMEE];
const fes = nomsEcole(ECOLES, 'ensa-fes'), fst = nomsEcole(ECOLES, 'fst-settat');
// Le texte de l'ENSAM Meknès avec les noms d'une autre école : seuls les noms changent
const avecNoms = (txt, n) => txt.replaceAll('ENSAM Meknès', n.nom).replaceAll('ENSAM مكناس', n.nomAr);
const SANS_MEKNES = /Meknès|مكناس/;

// Les liens et les textes de l'ENSAM Meknès, avec les arguments d'avant (sans école ni noms)
function sortiesMeknes({ L, I, T, lienSite }) {
  const o = {};
  for (const promo of [2019, 2029, 2031]) for (const l of ['fr', 'ar']) for (const page of [true, false]) {
    o[`lienPromo ${promo} ${l} ${page}`] = L.lienPromo(promo, l, page, 'https://r.io/index.html?x=1#admin/inviter');
    o[`lienInvitation ${promo} ${l} ${page}`] = I.lienInvitation(promo, l, page);
    o[`lienDeMembre ${promo} ${l} ${page}`] = [I.lienDeMembre(promo, l, 'nadia219', page), I.lienDeMembre(promo, l, null, page)];
  }
  for (const promo of [2019, 2029, 2031]) for (const l of ['fr', 'ar', 'deux']) o[`messageInvitation ${promo} ${l}`] = I.messageInvitation(promo, l, 'LIEN', 2026);
  for (const [promo, role] of [[2019, 'laureat'], [2029, 'etudiant'], [2031, 'etudiant']]) for (const l of ['fr', 'ar']) for (const n of [0, 7])
    o[`messageCamarade ${promo} ${role} ${l} ${n}`] = L.messageCamarade({ promo, role }, l, 'LIEN', n, 2026);
  for (const l of ['fr', 'ar']) for (const ok of [true, false]) for (const lau of [null, 'x'])
    o[`texteReussite ${l} ${ok} ${lau}`] = L.texteReussite({ partage_ok: ok, type: 'pfe', entreprise: 'OCP', laureat_id: lau }, { full_name: 'Salma B', promo: 2027, filiere: 'Génie Industriel' }, l, 'LIEN');
  const p = { full_name: 'Karim Alaoui', entreprise: 'OCP' };
  o.offreBoite = [T.messageOffreBoite(p, 'LIEN', 'fr'), T.messageOffreBoite(p, 'LIEN', 'ar')];
  o.affiche = [T.texteAffiche(2027, 2026), T.texteAffiche('laureats', 2026)];
  o.lienSite = [lienSite('fr'), lienSite('ar')];
  return o;
}

test('ENSAM Meknès : les 68 liens et textes d’invitation, de réussite, d’affiche et de la console, à l’octet près ceux d’avant', () => {
  const o = sortiesMeknes({ L, I, T, lienSite });
  assert.equal(Object.keys(o).length, 68);
  // Empreinte de ces sorties calculée sur le code d'avant (plan-final, 5da0b0f), avec les mêmes arguments
  assert.equal(createHash('sha256').update(JSON.stringify(o)).digest('hex'), 'c1f300f1492760ea7c77521419a1a893a3c55e69d0331f522c192fa897d78b18');
  // Quelques-unes en clair
  assert.equal(o['lienDeMembre 2019 ar true'][0], 'https://r.io/promo/2019/ar/?de=nadia219');
  assert.equal(o['lienPromo 2031 fr false'], 'https://r.io/?promo=2031');
  assert.deepEqual(o.lienSite, ['https://r.io/', 'https://r.io/?lang=ar']);
  assert.match(o['messageInvitation 2019 fr'], /^Salut la promo 2019 👋\nLe Réseau ENSAM Meknès est ouvert : la plateforme gratuite des lauréats et des étudiants de l'ENSAM Meknès\./);
  assert.match(o['messageInvitation 2019 ar'], /«شبكة ENSAM مكناس» مفتوحة الآن: المنصة المجانية لخريجي وطلبة ENSAM مكناس\./);
  // L'école de l'ENSAM Meknès dite (le membre, la console) : les mêmes liens et les mêmes textes
  for (const ecole of [undefined, null, '', 'ensam-meknes']) {
    assert.equal(I.lienDeMembre(2019, 'fr', 'nadia219', true, ecole), 'https://r.io/promo/2019/?de=nadia219');
    assert.equal(I.lienInvitation(2027, 'ar', false, ecole), 'https://r.io/?promo=2027&lang=ar');
    assert.equal(lienSite('ar', ecole), 'https://r.io/?lang=ar');
  }
  for (const l of ['fr', 'ar', 'deux']) assert.equal(I.messageInvitation(2029, l, 'LIEN', 2026, NOMS_MEKNES), o[`messageInvitation 2029 ${l}`]);
  assert.equal(L.messageCamarade({ promo: 2019, role: 'laureat' }, 'ar', 'LIEN', 7, 2026, nomsEcole(ECOLES, 'ensam-meknes')), o['messageCamarade 2019 laureat ar 7']);
});

test('liens d’une autre école : &ecole= dans la page d’aperçu (sa page neutre, e/) et le lien simple (la page neutre du site, e.html), en français et en arabe, avec ou sans code', () => {
  const base = 'https://r.io/index.html?x=1#admin/inviter';
  // La page d'aperçu d'une autre école : sa page neutre (promo/AAAA/e/, promo/AAAA/ar/e/), qui ne nomme pas l'ENSAM Meknès
  assert.equal(L.lienPromo(2019, 'fr', true, base, 'ensa-fes'), 'https://r.io/promo/2019/e/?ecole=ensa-fes');
  assert.equal(L.lienPromo(2019, 'ar', true, base, 'ensa-fes'), 'https://r.io/promo/2019/ar/e/?ecole=ensa-fes');
  // Le lien simple : la page neutre du site (e.html, à côté d'index.html), qui envoie vers le site avec toute l'adresse
  assert.equal(L.lienPromo(1995, 'ar', false, base, 'ensa-fes'), 'https://r.io/e.html?promo=1995&lang=ar&ecole=ensa-fes');
  assert.equal(L.lienPromo(2027, 'fr', false, base, 'ensa-fes'), 'https://r.io/e.html?promo=2027&ecole=ensa-fes');
  // Le code de qui invite après l'école : la page d'aperçu et le service worker les font suivre tous les deux
  assert.equal(I.lienDeMembre(2019, 'fr', 'nadia219', true, 'ensa-fes'), 'https://r.io/promo/2019/e/?ecole=ensa-fes&de=nadia219');
  assert.equal(I.lienDeMembre(2019, 'ar', 'nadia219', true, 'ensa-fes'), 'https://r.io/promo/2019/ar/e/?ecole=ensa-fes&de=nadia219');
  assert.equal(I.lienDeMembre(2019, 'ar', 'nadia219', false, 'ensa-fes'), 'https://r.io/e.html?promo=2019&lang=ar&ecole=ensa-fes&de=nadia219');
  assert.equal(I.lienDeMembre(2019, 'fr', null, true, 'ensa-fes'), 'https://r.io/promo/2019/e/?ecole=ensa-fes', 'sans code (base pas à jour, pas de réseau)');
  assert.equal(I.lienDeMembre(2019, 'fr', 'MAL<', true, 'ensa-fes'), 'https://r.io/promo/2019/e/?ecole=ensa-fes', 'un code mal formé ne part pas');
  // L'adresse du site (résumé, merci, fondateurs, « Une offre de ta boîte », affiche des lauréats) : sa page neutre aussi
  assert.equal(lienSite('fr', 'ensa-fes'), 'https://r.io/e.html?ecole=ensa-fes');
  assert.equal(lienSite('ar', 'ensa-fes'), 'https://r.io/e.html?lang=ar&ecole=ensa-fes');
  assert.equal(lienSite('fr', 'ensa-fes') + '#offres', 'https://r.io/e.html?ecole=ensa-fes#offres');
  // avecEcole : la même règle que la page d'entrée (ecoleValide) ; un identifiant mal formé ne part jamais
  assert.equal(L.avecEcole('https://r.io/#offres', 'ensa-fes'), 'https://r.io/e.html?ecole=ensa-fes#offres');
  assert.equal(L.avecEcole('https://r.io/?a=1#x', 'fst-settat'), 'https://r.io/e.html?a=1&ecole=fst-settat#x');
  for (const e of ['ENSA', 'a', 'x'.repeat(41), '<script>', 'ensa fes', 'ensa-fes&de=x', 12, null]) {
    assert.equal(L.avecEcole('https://r.io/promo/2019/', e), 'https://r.io/promo/2019/', String(e));
    assert.equal(L.ecoleValide(e), false, String(e));
  }
  // La page d'aperçu d'une promo : sa page neutre, seulement quand l'école est dite (l'ENSAM Meknès, ou rien : celle d'avant)
  assert.equal(L.avecEcole('https://r.io/promo/2019/', 'ensa-fes'), 'https://r.io/promo/2019/e/?ecole=ensa-fes');
  assert.equal(L.avecEcole('https://r.io/promo/2019/ar/?de=nadia219', 'ensa-fes'), 'https://r.io/promo/2019/ar/e/?de=nadia219&ecole=ensa-fes');
  assert.equal(L.avecEcole('https://r.io/site/promo/2040/#x', 'fst-settat'), 'https://r.io/site/promo/2040/e/?ecole=fst-settat#x');
  for (const e of ['ensam-meknes', undefined, '']) assert.equal(L.avecEcole('https://r.io/promo/2019/ar/', e), 'https://r.io/promo/2019/ar/', String(e));
  // Le site lui-même (sa racine, index.html) : sa page neutre, e.html, dans le même dossier ; l'ENSAM Meknès, ou rien : celle d'avant
  assert.equal(L.avecEcole('https://r.io/', 'ensa-fes'), 'https://r.io/e.html?ecole=ensa-fes');
  assert.equal(L.avecEcole('https://r.io/index.html?x=1#y', 'ensa-fes'), 'https://r.io/e.html?x=1&ecole=ensa-fes#y');
  assert.equal(L.avecEcole('https://r.io/?r=promo/2019/', 'ensa-fes'), 'https://r.io/e.html?r=promo/2019/&ecole=ensa-fes');
  assert.equal(L.avecEcole('https://r.io/site/?lang=ar#offre/o1', 'fst-settat'), 'https://r.io/site/e.html?lang=ar&ecole=fst-settat#offre/o1');
  for (const e of ['ensam-meknes', undefined, '', 'ENSA']) assert.equal(L.avecEcole('https://r.io/?lang=ar#offre/o1', e), 'https://r.io/?lang=ar#offre/o1', String(e));
  // Une autre adresse que celle d'une page d'aperçu ou du site ne change pas de chemin (une page neutre reste la sienne)
  for (const a of ['https://r.io/e.html', 'https://r.io/promo/', 'https://r.io/promo/2019', 'https://r.io/promo/2019/e/', 'https://r.io/promo/2019/fr/', 'https://r.io/promo/19/', 'https://r.io/promo/2019/index.html', 'https://r.io/verifier.html'])
    assert.equal(L.avecEcole(a, 'ensa-fes').replace(/[?&]ecole=ensa-fes/, ''), a, a);
  assert.ok(L.ecoleValide('ensa-fes') && L.ecoleValide('x'.repeat(40)) && L.ecoleValide('ensam-meknes'));
  assert.equal(E.ecoleInvitee(), null);
});

test('messages d’invitation d’une autre école : son nom, en français et en arabe ; seuls les noms changent', () => {
  for (const promo of [2019, 2029, 2031]) {
    for (const l of ['fr', 'ar', 'deux']) {
      const m = I.messageInvitation(promo, l, 'LIEN', 2026, fes);
      assert.equal(m, avecNoms(I.messageInvitation(promo, l, 'LIEN', 2026), fes), `${promo} ${l}`);
      assert.doesNotMatch(m, SANS_MEKNES);
      assert.doesNotMatch(m, /القدامى|اللوريا|soutenu|officiel/);
    }
    assert.match(I.messageInvitation(promo, 'fr', 'LIEN', 2026, fes), /Le Réseau ENSA Fès est ouvert : .* de l'ENSA Fès\./);
    assert.match(I.messageInvitation(promo, 'ar', 'LIEN', 2026, fes), /«شبكة ENSA فاس» مفتوحة الآن: .*(?:خريجي وطلبة|طلبة وخريجي) ENSA فاس\./);
    // Une école dont le nom ne s'élide pas : « de l'école FST Settat » ; sans nom arabe, son nom tel qu'il s'écrit
    assert.match(I.messageInvitation(promo, 'fr', 'LIEN', 2026, fst), /Le Réseau FST Settat est ouvert : .* de l'école FST Settat\./);
    assert.match(I.messageInvitation(promo, 'ar', 'LIEN', 2026, fst), /«شبكة FST Settat» مفتوحة الآن/);
  }
  // Message d'un membre à sa promo, et réussite partagée par un ambassadeur
  for (const [promo, role] of [[2019, 'laureat'], [2029, 'etudiant'], [2031, 'etudiant']]) for (const l of ['fr', 'ar']) {
    const m = L.messageCamarade({ promo, role }, l, 'LIEN', 7, 2026, fes);
    assert.equal(m, avecNoms(L.messageCamarade({ promo, role }, l, 'LIEN', 7, 2026), fes));
    assert.match(m, l === 'fr' ? /Je suis sur le Réseau ENSA Fès :/ : /أنا على «شبكة ENSA فاس»:/);
  }
  const pl = { partage_ok: true, type: 'stage', entreprise: 'Lear', laureat_id: 'x' }, e = { full_name: 'Imane T', promo: 2027, filiere: 'Génie Industriel' };
  assert.match(L.texteReussite(pl, e, 'fr', 'LIEN', fes), /Les lauréats du Réseau ENSA Fès aident les étudiants :\nLIEN$/);
  assert.match(L.texteReussite(pl, e, 'ar', 'LIEN', fes), /الخريجون على «شبكة ENSA فاس» يساعدون الطلبة:\nLIEN$/);
  assert.doesNotMatch(L.texteReussite(pl, e, 'ar', 'LIEN', fes), SANS_MEKNES);
});

test('noms d’une école : sa ligne de la table des écoles ; l’ENSAM Meknès par défaut ; jamais l’ENSAM Meknès pour une autre', () => {
  assert.equal(nomsEcole([], 'ensam-meknes'), NOMS_MEKNES);
  assert.equal(nomsEcole(undefined, undefined), NOMS_MEKNES);
  assert.deepEqual({ ...NOMS_MEKNES }, { slug: 'ensam-meknes', nom: 'ENSAM Meknès', nomAr: 'ENSAM مكناس', ville: 'Meknès', meknes: true });
  // La ligne de l'ENSAM Meknès ne change pas ses textes (ceux d'avant)
  assert.equal(nomsEcole([{ slug: 'ensam-meknes', nom: 'Autre nom', ville: 'Ailleurs' }], 'ensam-meknes'), NOMS_MEKNES);
  assert.deepEqual({ ...fes }, { slug: 'ensa-fes', nom: 'ENSA Fès', nomAr: 'ENSA فاس', ville: 'Fès', meknes: false });
  assert.deepEqual([fst.nom, fst.nomAr, fst.ville], ['FST Settat', 'FST Settat', 'Settat'], 'sans nom arabe : son nom tel qu’il s’écrit');
  // Sa ligne pas (encore) là (copie de l'appareil d'avant, base pas à jour) : « ENSAM », sans ville, jamais Meknès
  assert.deepEqual([nomsEcole([], 'ensa-fes').nom, nomsEcole([], 'ensa-fes').nomAr, nomsEcole([], 'ensa-fes').ville], ['ENSAM', 'ENSAM', '']);
  assert.equal(nomsEcole([{ slug: 'x-y', nom_court: 'EST', ville: '  Oujda ' }], 'x-y').nom, 'EST Oujda', 'sans nom : le nom court et la ville');
  assert.equal(nomsEcole([{ slug: 'x-y', nom: '  ENSA \n  Fès ' }], 'x-y').nom, 'ENSA Fès', 'espaces resserrés');
  assert.equal(nomsEcole([{ slug: 'x-y', nom: 'a'.repeat(300) }], 'x-y').nom.length, 120);
  // Le membre : sa propre école ; une ligne sans école est à l'ENSAM Meknès
  assert.equal(L.nomsDuMembre({ ecoles: ECOLES }, { ecole: 'ensa-fes' }).nom, 'ENSA Fès');
  assert.equal(L.nomsDuMembre({ ecoles: ECOLES }, { role: 'etudiant' }), NOMS_MEKNES);
  assert.equal(L.nomsDuMembre({}, { ecole: 'ensa-fes' }).nom, 'ENSAM');
  assert.equal(L.nomsDuMembre(null, null), NOMS_MEKNES);
  // Un texte qui sort de l'application : une école pas encore ouverte n'y est jamais nommée
  assert.deepEqual(L.nomsAPartager(ECOLES, 'ensa-fes'), fes);
  assert.equal(L.nomsAPartager(ECOLES, 'ensam-meknes'), NOMS_MEKNES);
  assert.equal(L.nomsAPartager([], 'ensam-meknes'), NOMS_MEKNES);
  for (const n of [L.nomsAPartager(ECOLES, 'ecole-exemple'), L.nomsAPartager([{ ...FES, ouverte: false }], 'ensa-fes'), L.nomsAPartager([], 'ensa-fes')]) {
    assert.deepEqual([n.nom, n.nomAr, n.ville], ['ENSAM', 'ENSAM', '']);
  }
  const ferme = I.messageInvitation(2019, 'deux', 'LIEN', 2026, L.nomsAPartager(ECOLES, 'ecole-exemple'));
  assert.doesNotMatch(ferme, /exemple|Exempleville|مثال|Meknès|مكناس/);
  assert.match(ferme, /Le Réseau ENSAM est ouvert : la plateforme gratuite des lauréats et des étudiants de l'ENSAM\./);
  // « de l'… » : l'élision devant une voyelle, sinon « de l'école … »
  assert.equal(L.deLEcoleNommee('ENSAM Meknès'), 'de l’ENSAM Meknès');
  assert.equal(L.deLEcoleNommee('ENSA Fès', "'"), "de l'ENSA Fès");
  assert.equal(L.deLEcoleNommee('Institut exemple'), 'de l’Institut exemple');
  assert.equal(L.deLEcoleNommee('École exemple'), 'de l’École exemple');
  assert.equal(L.deLEcoleNommee('FST Settat'), 'de l’école FST Settat');
  assert.equal(L.deLEcoleNommee(''), 'de l’ENSAM');
  assert.equal(L.deLEcoleNommee(undefined, "'"), "de l'ENSAM");
});

test('titre, marque et carte : la ville et le nom de l’école du membre, en français et en arabe ; l’ENSAM Meknès comme avant', async () => {
  assert.equal(L.sousMarque(NOMS_MEKNES), 'Meknès · Lauréats & étudiants');
  assert.equal(L.sousMarque(fes), 'Fès · Lauréats & étudiants');
  assert.equal(L.sousMarque(nomsEcole([], 'ensa-fes')), 'Lauréats & étudiants', 'sans ville connue');
  assert.equal(L.legendeCarte(), 'Où travaillent les lauréats de l’ENSAM Meknès. Clique sur un point pour voir qui est là. En bleu le Maroc, en orange l’étranger.');
  assert.equal(L.legendeCarte(NOMS_MEKNES), L.legendeCarte());
  assert.equal(L.legendeCarte(fes), 'Où travaillent les lauréats de l’ENSA Fès. Clique sur un point pour voir qui est là. En bleu le Maroc, en orange l’étranger.');
  assert.equal(L.legendeCarte(fst), 'Où travaillent les lauréats de l’école FST Settat. Clique sur un point pour voir qui est là. En bleu le Maroc, en orange l’étranger.');
  assert.equal(`Réseau ${L.nomsDuMembre({ ecoles: ECOLES }, { ecole: 'ensa-fes' }).nom}`, 'Réseau ENSA Fès');
  assert.equal(`Réseau ${L.nomsDuMembre({ ecoles: ECOLES }, {}).nom}`, 'Réseau ENSAM Meknès');
  // En arabe (i18n-ar.js) : le dictionnaire pour l'ENSAM Meknès, comme avant ; la ville et le nom de l'école sinon
  await setLang('ar');
  try {
    assert.equal(t(L.sousMarque(NOMS_MEKNES)), 'مكناس · الخريجون والطلبة');
    assert.equal(t(L.sousMarque(fes)), 'فاس · الخريجون والطلبة');
    assert.equal(t(L.sousMarque(nomsEcole([], 'ensa-fes'))), 'الخريجون والطلبة');
    assert.equal(t(L.legendeCarte()), 'أين يعمل خريجو ENSAM مكناس. انقر على نقطة لترى من هناك. بالأزرق المغرب، وبالبرتقالي الخارج.');
    assert.equal(t(L.legendeCarte(fes)), 'أين يعمل خريجو ENSA فاس. انقر على نقطة لترى من هناك. بالأزرق المغرب، وبالبرتقالي الخارج.');
    assert.equal(t(L.legendeCarte(fst)), 'أين يعمل خريجو FST سطات. انقر على نقطة لترى من هناك. بالأزرق المغرب، وبالبرتقالي الخارج.');
    const inconnue = t(L.legendeCarte(nomsEcole([], 'ensa-fes')));
    assert.match(inconnue, /^أين يعمل خريجو ⁨ENSAM⁩\. انقر/);
    for (const x of [t(L.sousMarque(fes)), t(L.legendeCarte(fes)), inconnue]) assert.doesNotMatch(x, /مكناس|Meknès|Lauréats|Clique/);
  } finally { await setLang('fr'); }
});

test('console : les messages, les liens et l’affiche sont ceux de l’école qu’elle regarde quand elle est ouverte', () => {
  const me = { id: 'adm', role: 'admin' };
  const vue = (ecoleConsole, extra = {}) => L.ecoleDesTextes({ me, ecoles: ECOLES, ecoleConsole, ...extra });
  // Toutes les écoles, ou l'ENSAM Meknès : ceux d'avant
  for (const c of ['', 'ensam-meknes', undefined]) assert.deepEqual(vue(c), { slug: 'ensam-meknes', noms: NOMS_MEKNES, autre: false, fermee: false }, String(c));
  // Une autre école ouverte : la sienne
  const f = vue('ensa-fes');
  assert.deepEqual([f.slug, f.noms.nom, f.noms.nomAr, f.autre, f.fermee], ['ensa-fes', 'ENSA Fès', 'ENSA فاس', true, false]);
  // Une école pas encore ouverte : son nom attend son accord, et personne ne peut y entrer ; ceux de l'administration
  assert.deepEqual(vue('ecole-exemple'), { slug: 'ensam-meknes', noms: NOMS_MEKNES, autre: false, fermee: true });
  // La liste des écoles de la console d'abord ; sinon celle du magasin
  assert.equal(L.ecoleDesTextes({ me, ecoles: [], data: { ecoles: ECOLES }, ecoleConsole: 'ensa-fes' }).noms.nom, 'ENSA Fès');
  assert.equal(L.ecoleDesTextes({ me, ecoleConsole: 'ensa-fes' }).slug, 'ensam-meknes', 'sans la ligne de l’école, on ne sait pas qu’elle est ouverte');
  // Une administration d'une autre école : la sienne ; jamais le nom d'une école pas encore ouverte
  assert.equal(L.ecoleDesTextes({ me: { ...me, ecole: 'ensa-fes' }, ecoles: ECOLES, ecoleConsole: '' }).noms.nom, 'ENSA Fès');
  const fermee = L.ecoleDesTextes({ me: { ...me, ecole: 'ecole-exemple' }, ecoles: ECOLES, ecoleConsole: '' });
  assert.deepEqual([fermee.slug, fermee.noms.nom, fermee.autre], ['ecole-exemple', 'ENSAM', false]);
  // Les liens qui vont avec (Inviter, Animer, Affiches)
  assert.equal(I.lienInvitation(2019, 'fr', true, f.slug), 'https://r.io/promo/2019/e/?ecole=ensa-fes');
  assert.equal(I.lienInvitation(2019, 'ar', false, vue('').slug), 'https://r.io/?promo=2019&lang=ar');
  assert.equal(lienSite('fr', vue('ecole-exemple').slug), 'https://r.io/');
});

test('console : le résumé, le merci, les fondateurs, « Une offre de ta boîte » et l’affiche nomment l’école des messages', () => {
  const now = Date.parse('2026-11-01T12:00:00Z');
  // Le résumé de la semaine : ses noms passés, sinon ceux de sa ligne quand elle est ouverte
  const r = T.resumeSemaine({ profiles: [], offers: [], ecoles: ECOLES }, { now, saison: 2026, lien: 'L', ecole: 'ensa-fes' });
  assert.equal(r.fr.split('\n')[0], '✅ Cette semaine dans le Réseau ENSA Fès');
  assert.equal(r.ar.split('\n')[0], '✅ هذا الأسبوع في شبكة ENSA فاس');
  const rf = T.resumeSemaine({ profiles: [], offers: [], ecoles: ECOLES }, { now, saison: 2026, lien: 'L', ecole: 'ecole-exemple' });
  assert.deepEqual([rf.fr.split('\n')[0], rf.ar.split('\n')[0]], ['✅ Cette semaine dans le Réseau ENSAM', '✅ هذا الأسبوع في شبكة ENSAM']);
  const rm = T.resumeSemaine({ profiles: [], offers: [], ecoles: ECOLES }, { now, saison: 2026, lien: 'L' });
  assert.deepEqual([rm.fr.split('\n')[0], rm.ar.split('\n')[0]], ['✅ Cette semaine dans le Réseau ENSAM Meknès', '✅ هذا الأسبوع في شبكة ENSAM مكناس']);
  // Le merci : « noms » rendu reste la liste des prénoms cités
  const aidants = [{ id: 'a', prenom: 'Ayoub', etudiants: ['e1', 'e2'], gestes: { offre: 1 } }];
  const m = T.texteMerci(aidants, ['a'], { lien: 'L', ecoleNoms: fes }), mm = T.texteMerci(aidants, ['a'], { lien: 'L' });
  assert.deepEqual(m.noms, ['Ayoub']);
  assert.match(m.fr, /1 lauréat a aidé 2 étudiants de l’ENSA Fès : conseils/);
  assert.match(m.ar, / من ENSA فاس: نصائح/);
  assert.match(mm.fr, /2 étudiants de l’ENSAM Meknès : conseils/);
  assert.match(mm.ar, / من ENSAM مكناس: نصائح/);
  assert.equal(T.texteMerci(aidants, ['a'], { lien: 'L', ecoleNoms: fst }).fr.includes('2 étudiants de l’école FST Settat :'), true);
  // Les fondateurs
  const fd = T.texteFondateurs({ profiles: [] }, { liste: [], lien: 'L', noms: fes }), fdm = T.texteFondateurs({ profiles: [] }, { liste: [], lien: 'L' });
  assert.deepEqual([fd.fr.split('\n')[0], fd.ar.split('\n')[0]], ['⭐ Membres fondateurs du Réseau ENSA Fès', '⭐ الأعضاء المؤسسون لشبكة ENSA فاس']);
  assert.deepEqual([fdm.fr.split('\n')[0], fdm.ar.split('\n')[0]], ['⭐ Membres fondateurs du Réseau ENSAM Meknès', '⭐ الأعضاء المؤسسون لشبكة ENSAM مكناس']);
  // « Une offre de ta boîte » et l'affiche
  const p = { full_name: 'Karim Alaoui', entreprise: 'OCP' };
  assert.match(T.messageOffreBoite(p, 'L', 'fr', fes), /\nLes étudiants de l’ENSA Fès cherchent des stages et des PFE/);
  assert.match(T.messageOffreBoite(p, 'L', 'fr', fst), /\nLes étudiants de l’école FST Settat cherchent/);
  assert.match(T.messageOffreBoite(p, 'L', 'ar', fes), /\nيبحث طلبة ENSA فاس عن تداريب/);
  const a = T.texteAffiche(2027, 2026, fes);
  assert.deepEqual([a.fr.titre, a.ar.titre], ['Rejoins le Réseau ENSA Fès', 'انضم إلى شبكة ENSA فاس']);
  assert.deepEqual(T.texteAffiche(2027, 2026, NOMS_MEKNES), T.texteAffiche(2027, 2026));
  for (const x of [r.fr, r.ar, m.fr, m.ar, fd.fr, fd.ar, T.messageOffreBoite(p, 'L', 'ar', fes), JSON.stringify(a)]) assert.doesNotMatch(x, SANS_MEKNES);
});

test('magasin : la ligne de l’école lue avec l’accueil, gardée avec la copie de l’appareil, sans temps réel ; la copie d’avant reste bonne', async () => {
  assert.ok(S.TABLES.includes('ecoles') && S.PREMIERES.includes('ecoles') && !S.ENSUITE.includes('ecoles'));
  // Lue en même temps que le reste de l'accueil ; une base qui n'a pas la table : une liste vide, sans erreur
  const s = new S.SupabaseStore({});
  s.sb = { from: nom => ({ select: () => ({ order: () => ({ range: async () => (nom === 'ecoles' ? { data: [FES], error: null } : { data: [], error: null }) }) }) }) };
  await s.loadTable('ecoles');
  assert.deepEqual(s.data.ecoles, [FES]);
  s.sb = { from: () => ({ select: () => ({ order: () => ({ range: async () => ({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.ecoles' in the schema cache" } }) }) }) }) };
  s.data.ecoles = [];
  await s.loadTable('ecoles');
  assert.deepEqual(s.data.ecoles, []);
  // Gardée avec la copie de l'appareil (le titre et la marque tout de suite à la prochaine ouverture)
  assert.deepEqual(S.pourCache({ ecoles: [FES] }, 'moi').ecoles, [FES]);
  // Pas d'abonnement au temps réel pour elle (la base ne la publie pas) ; les autres tables, comme avant
  const ecoutees = [];
  s.sb = { channel: () => ({ on(_e, f) { ecoutees.push(f.table); return this; }, subscribe() {} }) };
  s.subscribe();
  assert.ok(ecoutees.includes('profiles') && ecoutees.includes('offers') && ecoutees.includes('messages'));
  assert.ok(!ecoutees.includes('ecoles'));
  // La copie gardée par un membre avant ce changement (sa forme ne connaissait pas les écoles) s'ouvre toujours
  const UID = 'moi', ancienne = { forme: S.CACHE_V + ':' + S.TABLES.filter(x => x !== 'ecoles').join(','), uid: UID, t: Date.now(), data: { profiles: [{ id: UID }] } };
  const lue = await avecCache(ancienne, () => S.lireCache(UID));
  assert.equal(lue?.uid, UID, 'la copie d’avant n’est pas oubliée');
  assert.equal(await avecCache({ ...ancienne, forme: S.CACHE_V + ':profiles' }, () => S.lireCache(UID)), null, 'une autre forme, si');
  assert.equal(copieGardee, undefined, 'et elle est effacée');
});
// Un faux IndexedDB qui garde une seule copie (« membre ») ; le magasin garde la base ouverte d'une fois à l'autre : la
// même pour tout le fichier, seule la copie change
let copieGardee;
const fausseBase = { transaction() {
  const tx = {}, requete = v => { const q = {}; setTimeout(() => { q.result = v; q.onsuccess?.(); tx.oncomplete?.(); }); return q; };
  tx.objectStore = () => ({ get: () => requete(copieGardee), put: v => requete((copieGardee = v, undefined)), delete: () => requete((copieGardee = undefined, undefined)) });
  return tx;
} };
async function avecCache(copie, f) {
  const avant = globalThis.indexedDB;
  copieGardee = copie;
  globalThis.indexedDB = { open() { const r = { result: fausseBase }; setTimeout(() => r.onsuccess?.()); return r; } };
  try { return await f(); } finally { globalThis.indexedDB = avant; }
}

test('page d’entrée : les chiffres et les fondateurs de l’école du lien, gardés par école ; rien, jamais ceux de l’ENSAM Meknès, si l’école n’est pas ouverte ou si la base ne la connaît pas', async () => {
  const cfg = { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k' };
  const appels = [];
  let reponse = () => ({ status: 404, x: { code: 'PGRST202' } });
  globalThis.fetch = async (url, o) => {
    const nom = String(url).split('/').pop(), corps = JSON.parse(o.body);
    appels.push([nom, o.body]);
    const r = reponse(nom, corps);
    return { ok: r.status < 300, status: r.status, json: async () => r.x };
  };
  const ecole = e => (e ? stockage.set('ensam-invite-ecole', e) : stockage.delete('ensam-invite-ecole'));
  const chiffres = { laureats: 39, entreprises: 19, promos: 14 };
  const fondateurs = n => ({ total: n, max: 25, places: 25 - n, fondateurs: n ? [{ rang: 1, nom: 'Omar A.', promo: 2019, photo: null }] : [] });
  // Sans lien d'école (ou celui de l'ENSAM Meknès) : la demande d'avant, {}
  reponse = nom => ({ status: 200, x: nom === 'chiffres_publics' ? chiffres : fondateurs(3) });
  ecole('ensam-meknes');
  assert.deepEqual(await E.chiffresPublics(cfg), chiffres);
  assert.equal((await F.fondateursPublics(cfg)).total, 3);
  assert.deepEqual(appels, [['chiffres_publics', '{}'], ['fondateurs_publics', '{}']]);
  ecole(null);
  await E.chiffresPublics(cfg); await F.fondateursPublics(cfg);
  assert.equal(appels.length, 2, 'gardés pour la visite');
  // Le lien d'une école ouverte : ses chiffres à elle, demandés à part (jamais ceux de l'ENSAM Meknès gardés plus haut)
  ecole('ensa-fes');
  reponse = (nom, c) => ({ status: 200, x: c.p_ecole !== 'ensa-fes' ? null : nom === 'chiffres_publics' ? { laureats: 4, entreprises: 2, promos: 1 } : fondateurs(1) });
  assert.deepEqual(await E.chiffresPublics(cfg), { laureats: 4, entreprises: 2, promos: 1 });
  assert.equal((await F.fondateursPublics(cfg)).liste[0].nom, 'Omar A.');
  assert.deepEqual(appels.slice(2), [['chiffres_publics', '{"p_ecole":"ensa-fes"}'], ['fondateurs_publics', '{"p_ecole":"ensa-fes"}']]);
  // Une école pas ouverte (ou inconnue) : la base répond « rien » ; rien ne s'affiche
  ecole('ecole-exemple');
  reponse = () => ({ status: 200, x: null });
  assert.equal(await E.chiffresPublics(cfg), null);
  assert.equal(L.lignesChiffres(await E.chiffresPublics(cfg)), null);
  assert.equal(await F.fondateursPublics(cfg), null);
  // Zéro, ou une réponse vide : rien non plus
  ecole('fst-settat');
  reponse = nom => ({ status: 200, x: nom === 'chiffres_publics' ? { laureats: 0, entreprises: 0, promos: 0 } : fondateurs(0) });
  assert.equal(L.lignesChiffres(await E.chiffresPublics(cfg)), null);
  assert.equal((await F.fondateursPublics(cfg)).total, 0, 'FondateursPublics ne montre rien sans fondateur');
  // Une base d'avant, qui ne connaît pas p_ecole (404) : rien, et la demande repart à la prochaine visite de la page
  ecole('ensa-oujda');
  reponse = () => ({ status: 404, x: { code: 'PGRST202', message: 'Could not find the function public.chiffres_publics(p_ecole)' } });
  assert.equal(await E.chiffresPublics(cfg), null);
  assert.equal(await F.fondateursPublics(cfg), null);
  const n = appels.length;
  reponse = (nom, c) => ({ status: 200, x: c.p_ecole === 'ensa-oujda' ? (nom === 'chiffres_publics' ? { laureats: 2 } : fondateurs(2)) : null });
  assert.deepEqual(L.lignesChiffres(await E.chiffresPublics(cfg)), ['2 lauréats']);
  assert.equal((await F.fondateursPublics(cfg)).total, 2);
  assert.equal(appels.length, n + 2);
  // Et l'ENSAM Meknès n'a jamais été redemandée ni mêlée aux autres
  ecole(null);
  assert.deepEqual(await E.chiffresPublics(cfg), chiffres);
  assert.equal(appels.filter(([, b]) => b === '{}').length, 2);
});
