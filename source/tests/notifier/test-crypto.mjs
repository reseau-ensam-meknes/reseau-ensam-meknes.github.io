import { test } from 'node:test';
import assert from 'node:assert/strict';
import nodeCrypto from 'node:crypto';
import { MODULE, nouveauRecepteur, dechiffrer, verifierJwt } from './banc.mjs';

const N = await import(MODULE);
const hex = h => new Uint8Array(Buffer.from(h, 'hex'));

// Vecteur de la RFC 8291, annexe A (valeurs reprises des tests de mozilla/rust-ece)
const RFC = {
  asPrive: 'c9f58f89813e9f8e872e71f42aa64e1757c9254dcc62b72ddc010bb4043ea11c',
  asPublic: '04fe33f4ab0dea71914db55823f73b54948f41306d920732dbb9a59a53286482200e597a7b7bc260ba1c227998580992e93973002f3012a28ae8f06bbb78e5ec0f',
  uaPublic: '042571b2becdfde360551aaf1ed0f4cd366c11cebe555f89bcb7b186a53339173168ece2ebe018597bd30479b86e3c8f8eced577ca59187e9246990db682008b0e',
  uaPrive: 'ab5757a70dd4a53e553a6bbf71ffefea2874ec07a6b379e3c48f895a02dc33de',
  auth: '05305932a1c7eabe13b6cec9fda48882',
  sel: '0c6bfaadad67958803092d454676f397',
  message: 'When I grow up, I want to be a watermelon',
  attendu: '0c6bfaadad67958803092d454676f397000010004104fe33f4ab0dea71914db55823f73b54948f41306d920732dbb9a59a53286482200e597a7b7bc260ba1c227998580992e93973002f3012a28ae8f06bbb78e5ec0ff297de5b429bba7153d3a4ae0caa091fd425f3b4b5414add8ab37a19c1bbb05cf5cb5b2a2e0562d558635641ec52812c6c8ff42e95ccb86be7cd',
  // Forme base64url imprimée dans la RFC
  attenduB64: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

test('base64url : aller-retour et compatibilité avec Buffer', () => {
  for (let n = 0; n < 70; n++) {
    const o = nodeCrypto.randomBytes(n);
    const b = N.b64url(new Uint8Array(o));
    assert.equal(b, o.toString('base64url'));
    assert.deepEqual(Buffer.from(N.deB64url(b)), o);
  }
  // base64 classique avec « + / = » accepté (abonnements mal encodés)
  const o = nodeCrypto.randomBytes(65);
  assert.deepEqual(Buffer.from(N.deB64url(o.toString('base64'))), o);
  assert.throws(() => N.deB64url('abc$'));
});

test('RFC 8291 annexe A : chiffré identique au vecteur', async () => {
  const pub = hex(RFC.asPublic);
  const prive = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256', d: Buffer.from(RFC.asPrive, 'hex').toString('base64url'),
    x: Buffer.from(pub.subarray(1, 33)).toString('base64url'), y: Buffer.from(pub.subarray(33, 65)).toString('base64url'),
  }, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const sortie = await N.chiffrer(new TextEncoder().encode(RFC.message), N.b64url(hex(RFC.uaPublic)), N.b64url(hex(RFC.auth)), hex(RFC.sel), { prive, publique: pub });
  assert.equal(Buffer.from(sortie).toString('hex'), RFC.attendu);
  assert.equal(N.b64url(sortie), RFC.attenduB64);
});

test('RFC 8291 annexe A : le récepteur de test déchiffre le vecteur', () => {
  const ecdh = nodeCrypto.createECDH('prime256v1');
  ecdh.setPrivateKey(Buffer.from(RFC.uaPrive, 'hex'));
  assert.equal(ecdh.getPublicKey('hex'), RFC.uaPublic);
  const d = dechiffrer(hex(RFC.attendu), { ecdh, auth: Buffer.from(RFC.auth, 'hex') });
  assert.equal(d.clair, RFC.message);
  assert.equal(d.rs, 4096);
  assert.equal(d.idlen, 65);
});

test('aller-retour : chiffrer puis déchiffrer avec un récepteur indépendant', async () => {
  const r = nouveauRecepteur();
  const message = JSON.stringify({ title: 'Rendez-vous fixé', body: 'Youssef a accepté : mon CV — مرحبًا 🎉', url: 'https://x/#mentorat', tag: 'mentorat_accepte' });
  const a = await N.chiffrer(new TextEncoder().encode(message), r.p256dh, r.authB64);
  const b = await N.chiffrer(new TextEncoder().encode(message), r.p256dh, r.authB64);
  const d = dechiffrer(a, r);
  assert.equal(d.clair, message);
  assert.equal(d.rs, 4096);
  assert.equal(d.idlen, 65);
  assert.equal(d.asPub[0], 4);
  assert.equal(d.taille, 86 + Buffer.byteLength(message) + 1 + 16);   // en-tête + message + 0x02 + étiquette
  assert.notEqual(Buffer.from(a).toString('hex'), Buffer.from(b).toString('hex'), 'sel et clé neufs à chaque message');
  assert.equal(dechiffrer(b, r).clair, message);
});

test('chiffrer refuse des clés d’abonnement invalides', async () => {
  const r = nouveauRecepteur();
  const m = new TextEncoder().encode('x');
  await assert.rejects(N.chiffrer(m, 'AAAA', r.authB64));
  await assert.rejects(N.chiffrer(m, r.p256dh, 'AAAA'));
  await assert.rejects(N.chiffrer(new Uint8Array(4000), r.p256dh, r.authB64));
});

test('VAPID : JWT ES256 vérifiable, bonnes revendications', async () => {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = N.b64url(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey)));
  const avant = Math.floor(Date.now() / 1000);
  const jwt = await N.jetonVapid('https://fcm.googleapis.com', 'https://reseau-ensam-meknes.github.io/', kp.privateKey);
  const v = verifierJwt(jwt, pub);
  assert.equal(v.valide, true);
  assert.equal(v.tailleSig, 64);
  assert.deepEqual(v.entete, { typ: 'JWT', alg: 'ES256' });
  assert.equal(v.claims.aud, 'https://fcm.googleapis.com');
  assert.equal(v.claims.sub, 'https://reseau-ensam-meknes.github.io/');
  assert.ok(v.claims.exp >= avant + 12 * 3600 && v.claims.exp <= avant + 12 * 3600 + 5);
  // Une autre clé ne vérifie pas
  const autre = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  assert.equal(verifierJwt(jwt, N.b64url(new Uint8Array(await crypto.subtle.exportKey('raw', autre.publicKey)))).valide, false);
});

test('comparaison en temps constant', () => {
  assert.equal(N.egalConstant('abc', 'abc'), true);
  assert.equal(N.egalConstant('abc', 'abd'), false);
  assert.equal(N.egalConstant('abc', 'abcd'), false);
  assert.equal(N.egalConstant('', 'a'), false);
  assert.equal(N.egalConstant('é', 'é'), true);
});
