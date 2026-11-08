// L'école gardée sur cet appareil (le lien d'une école, ?ecole=, gardé jusqu'à l'inscription) : un lien d'invitation arrivé
// ensuite sans école (?promo=, &de= : l'ENSAM Meknès) l'efface ; une simple visite la garde ; un lien qui dit son école la
// garde, ou la remplace. Ce que le site fabrique pour emporter le contexte ailleurs (l'adresse gardée dans le navigateur
// d'une application sur iPhone, « Ouvrir dans Chrome » sur Android) dit toujours l'école gardée : elle ne se perd pas en route.
import { test, beforeEach } from 'node:test';
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

const E = await import('../../src/entree.js');
const R = await import('../../src/regles-entree.js');
const A = await import('../../src/appareil.js');

const ECOLE = 'ensam-invite-ecole', PROMO = 'ensam-invite-promo', DE = 'ensam-invite-de';
// Arrivée sur cette adresse, puis lireInvitation (au chargement de la page) : ce qu'elle renvoie, l'adresse après, et ce qui
// est gardé
function arriver(adresse) {
  location.href = new URL(adresse, 'https://r.io').href;
  const r = E.lireInvitation();
  const u = new URL(location.href);
  return { r, adresse: u.pathname + u.search + u.hash, ecole: stockage.get(ECOLE) ?? null, promo: stockage.get(PROMO) ?? null, de: stockage.get(DE) ?? null };
}
beforeEach(() => { stockage.clear(); location.href = 'https://r.io/'; });

test('un lien d’invitation sans école (?promo=, &de= : l’ENSAM Meknès) efface l’école gardée par le lien d’une autre école', () => {
  for (const ancienne of ['ensam-casa', 'ensa-fes']) {
    stockage.set(ECOLE, ancienne);
    assert.deepEqual(arriver('/?promo=2019'), { r: null, adresse: '/', ecole: null, promo: '2019', de: null }, `${ancienne} puis ?promo=`);
    stockage.clear(); stockage.set(ECOLE, ancienne);
    assert.deepEqual(arriver('/?de=nadia219'), { r: null, adresse: '/', ecole: null, promo: null, de: 'nadia219' }, `${ancienne} puis ?de=`);
    stockage.clear(); stockage.set(ECOLE, ancienne);
    assert.deepEqual(arriver('/?promo=2019&lang=ar&de=nadia219#offre/abc'), { r: 'ar', adresse: '/#offre/abc', ecole: null, promo: '2019', de: 'nadia219' }, `${ancienne} puis le lien arabe d’une promo`);
    // Un code de qui invite mal formé reste un lien d'invitation : l'école d'avant ne vaut pas pour lui
    stockage.clear(); stockage.set(ECOLE, ancienne);
    assert.equal(arriver('/?de=x').ecole, null, `${ancienne} puis ?de=x`);
    stockage.clear();
  }
  // Rien de gardé : rien de plus (un lien de l'ENSAM Meknès, comme avant)
  assert.deepEqual(arriver('/?promo=2019&de=nadia219'), { r: null, adresse: '/', ecole: null, promo: '2019', de: 'nadia219' });
});

test('une simple visite, ou une adresse sans lien d’invitation, garde l’école gardée', () => {
  for (const adresse of ['/', '/#offre/3f2b8c1e-9a7d-4e21-b6c0-5d4e3f2a1b0c', '/?mode=connexion', '/?r=mentorat&notifs=1', '/?role=laureat&mode=inscription&ici=1', '/?lang=ar', '/index.html?x=1#accueil']) {
    stockage.set(ECOLE, 'ensa-fes'); stockage.set(PROMO, '2019'); stockage.set(DE, 'omar2019');
    const a = arriver(adresse);
    assert.deepEqual([a.ecole, a.promo, a.de], ['ensa-fes', '2019', 'omar2019'], adresse);
    stockage.clear();
  }
});

test('un lien qui dit son école la garde, ou remplace celle d’avant', () => {
  stockage.set(ECOLE, 'ensam-casa');
  assert.deepEqual(arriver('/?promo=2019&ecole=ensa-fes&de=omar2019'), { r: null, adresse: '/', ecole: 'ensa-fes', promo: '2019', de: 'omar2019' });
  assert.deepEqual(arriver('/?ecole=ensa-fes&promo=2020'), { r: null, adresse: '/', ecole: 'ensa-fes', promo: '2020', de: 'omar2019' }, 'la même école');
  stockage.set(ECOLE, 'ensam-casa');
  assert.deepEqual(arriver('/?ecole=ensa-fes'), { r: null, adresse: '/', ecole: 'ensa-fes', promo: '2020', de: 'omar2019' }, 'le lien d’une école seul');
  stockage.set(ECOLE, 'ensam-casa');
  assert.equal(arriver('/?de=salma234&ecole=ensa-fes').ecole, 'ensa-fes', 'qui invite, et son école');
  // Le lien de l'ENSAM Meknès qui la dit : elle, comme avant
  assert.equal(arriver('/?promo=2019&ecole=ensam-meknes').ecole, 'ensam-meknes');
});

test('l’adresse gardée pour Safari (iPhone) et « Ouvrir dans Chrome » (Android) disent l’école gardée : relue de l’autre côté, elle reste', () => {
  const contexte = { promo: 2019, de: 'omar2019', ecole: 'ensa-fes', role: 'laureat', mode: 'inscription' };
  // iPhone : l'adresse de la page (adresseIci), rechargée ici même ou ouverte dans Safari (rien de gardé)
  for (const garde of [true, false]) {
    if (garde) { stockage.set(ECOLE, 'ensa-fes'); stockage.set(PROMO, '2019'); stockage.set(DE, 'omar2019'); }
    const a = arriver(R.adresseAvecContexte('https://r.io/', contexte, 'fr'));
    assert.deepEqual([a.ecole, a.promo, a.de], ['ensa-fes', '2019', 'omar2019'], garde ? 'rechargée' : 'Safari');
    stockage.clear();
  }
  // Android : l'adresse que Chrome ouvre (et celle de secours, ici même)
  const lien = A.lienChrome('https://r.io/', '', { lang: 'fr', contexte, ici: true });
  for (const adresse of [`https://${lien.slice('intent://'.length).split('#Intent;')[0]}`, decodeURIComponent(lien.match(/S\.browser_fallback_url=([^;]+);/)[1])]) {
    const a = arriver(adresse);
    assert.deepEqual([a.ecole, a.promo, a.de], ['ensa-fes', '2019', 'omar2019'], adresse);
    stockage.clear();
  }
  // Sans école gardée (l'ENSAM Meknès), ces adresses n'en disent aucune, et rien n'en est gardé
  const meknes = R.adresseAvecContexte('https://r.io/', { ...contexte, ecole: null }, 'fr');
  assert.doesNotMatch(meknes, /ecole/);
  assert.equal(arriver(meknes).ecole, null);
});

// L'école du compte à l'inscription (ecoleRetenue) : celle du lien que la page suit. Un lien d'invitation sans école (?promo=,
// &de=) retient l'ENSAM Meknès, à part : ni l'école gardée, ni ce qui part (argsEcole), ni les adresses pour Safari et Chrome
// ne la disent (jamais ecole=ensam-meknes). Une simple visite la garde, un lien qui dit son école la remplace ; sans lien,
// rien (l'école que le compte a reçue avec sa demande de code) ; l'inscription finie, oubliée avec le reste.
test('un lien d’invitation sans école retient l’ENSAM Meknès pour l’inscription (ecoleRetenue), sans rien dire de plus à ce qui part', () => {
  assert.equal(E.ecoleRetenue(), null, 'sans lien : rien');
  for (const adresse of ['/?promo=2019', '/?de=nadia219', '/?promo=2019&lang=ar&de=nadia219#offre/abc', '/?de=x']) {
    for (const avant of [null, 'ensam-casa', 'ensa-fes']) {
      stockage.clear(); if (avant) stockage.set(ECOLE, avant);
      arriver(adresse);
      assert.deepEqual([E.ecoleRetenue(), E.ecoleInvitee(), E.argsEcole()], ['ensam-meknes', null, {}], `${avant} puis ${adresse}`);
    }
  }
  arriver('/'); arriver('/?mode=connexion');
  assert.equal(E.ecoleRetenue(), 'ensam-meknes', 'une simple visite la garde');
  assert.equal(arriver('/?ecole=ensa-fes').ecole, 'ensa-fes');
  assert.deepEqual([E.ecoleRetenue(), stockage.has('ensam-invite-meknes')], ['ensa-fes', false], 'un lien qui dit son école la remplace');
  arriver('/?promo=2019'); assert.equal(E.ecoleRetenue(), 'ensam-meknes');
  arriver('/?promo=2019&ecole=ensam-casa'); assert.equal(E.ecoleRetenue(), 'ensam-casa');
  arriver('/?ecole=ensam-meknes'); assert.equal(E.ecoleRetenue(), 'ensam-meknes', 'le lien de l’ENSAM Meknès qui la dit');
  arriver('/?promo=2019'); E.oublierInvitation();
  assert.deepEqual([E.ecoleRetenue(), [...stockage.keys()].filter(k => k.startsWith('ensam-invite'))], [null, []], 'l’inscription finie');
  // Ce que le site fabrique pour emporter le contexte (fait de ce qui est gardé) : sans école ; relu de l'autre côté (rien de
  // gardé), l'ENSAM Meknès revient par le lien d'invitation qu'il emporte
  stockage.clear(); arriver('/?promo=2019&de=nadia219');
  const contexte = { promo: E.promoInvitee(), de: 'nadia219', ecole: E.ecoleInvitee(), role: 'laureat', mode: 'inscription' };
  const safari = R.adresseAvecContexte('https://r.io/', contexte, 'fr');
  const chrome = A.lienChrome('https://r.io/', '', { lang: 'fr', contexte, ici: true });
  for (const x of [safari, decodeURIComponent(chrome)]) assert.doesNotMatch(x, /ecole/, x);
  for (const adresse of [safari, `https://${chrome.slice('intent://'.length).split('#Intent;')[0]}`, decodeURIComponent(chrome.match(/S\.browser_fallback_url=([^;]+);/)[1])]) {
    stockage.clear(); arriver(adresse);
    assert.equal(E.ecoleRetenue(), 'ensam-meknes', adresse);
  }
});
