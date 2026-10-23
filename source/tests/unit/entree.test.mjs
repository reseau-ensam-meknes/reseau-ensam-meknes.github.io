// Page d'entrée : règles sans dépendance (rôle, chiffres, email de l'école, code à 6 chiffres, lien partagé),
// page légère (elle s'affiche avant le reste du site) et entièrement traduite
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {
  saisonActuelle, roleDePromo, presetInscription, lignesChiffres, estEmailEcole, chiffresCode, casErreurAuth, adresseContact,
  lienPartage, lienEncoreBon, estUuid, phraseLien, suiteLien, offreFermeePour,
} from '../../src/regles-entree.js';
import { seasonOf } from '../../src/logic.js';

const SRC = new URL('../../src/', import.meta.url);
const DIST = new URL('../../dist/', import.meta.url);
const lireSrc = f => fs.readFileSync(new URL(f, SRC), 'utf8');

test('saison et rôle : même règle que le reste du site', () => {
  for (const d of [new Date(2026, 7, 31), new Date(2026, 8, 1), new Date(2027, 0, 15)]) assert.equal(saisonActuelle(d), seasonOf(d));
  assert.equal(roleDePromo(2027, 2026), 'etudiant');
  assert.equal(roleDePromo(2026, 2026), 'laureat');
});

test('ce que la « Dernière étape » sait déjà : le rôle choisi, et la promo du lien seulement si elle va avec', () => {
  assert.deepEqual(presetInscription({ choisi: 'laureat', invite: 2027, saison: 2026 }), { role: 'laureat' });
  assert.deepEqual(presetInscription({ choisi: 'etudiant', invite: 2027, saison: 2026 }), { role: 'etudiant', promo: 2027 });
  assert.deepEqual(presetInscription({ invite: 2019, saison: 2026 }), { role: 'laureat', promo: 2019 });
  assert.equal(presetInscription({ saison: 2026 }), null);
  assert.equal(presetInscription({ choisi: 'admin', saison: 2026 }), null);
});

test('chiffres publics : jamais un « 0 », singulier et pluriel', () => {
  assert.deepEqual(lignesChiffres({ laureats: 39, entreprises: 19, promos: 14 }), ['39 lauréats', '19 entreprises', '14 promos']);
  assert.deepEqual(lignesChiffres({ laureats: 1, entreprises: 0, promos: 1 }), ['1 lauréat', '1 promo']);
  assert.equal(lignesChiffres({ laureats: 0, entreprises: 3, promos: 2 }), null);
  assert.equal(lignesChiffres(null), null);
  assert.equal(lignesChiffres({ laureats: '12' }), null);
});

test('email de l’école : le domaine et ses sous-domaines, jamais un domaine qui lui ressemble', () => {
  const d = ['ensam-umi.ac.ma'];
  assert.ok(estEmailEcole('A.Amine@ensam-umi.ac.ma ', d));
  assert.ok(estEmailEcole('a@etu.ensam-umi.ac.ma', d));
  assert.ok(!estEmailEcole('a@xensam-umi.ac.ma', d));
  assert.ok(!estEmailEcole('a@ensam-umi.ac.ma.evil.com', d));
  assert.ok(!estEmailEcole('ensam-umi.ac.ma', d));
  assert.ok(!estEmailEcole('a@ensam-umi.ac.ma', []));
});

test('code reçu : chiffres arabes, espaces et texte collé autour', () => {
  assert.equal(chiffresCode('123456'), '123456');
  assert.equal(chiffresCode('١٢٣٤٥٦'), '123456');
  assert.equal(chiffresCode('۱۲۳۴۵۶'), '123456');
  assert.equal(chiffresCode('123 456'), '123456');
  assert.equal(chiffresCode('Ton code : 654321 · رمزك'), '654321');
  assert.equal(chiffresCode('12a3'), '123');
  assert.equal(chiffresCode('12345678'), '123456');
  assert.equal(chiffresCode(null), '');
});

test('réponses de la base : trop tôt, pas de compte, code faux', () => {
  assert.deepEqual(casErreurAuth({ message: 'For security purposes, you can only request this after 42 seconds.' }), { cas: 'trop_tot', attente: 42 });
  assert.deepEqual(casErreurAuth({ message: 'Signups not allowed for otp' }), { cas: 'pas_de_compte' });
  assert.deepEqual(casErreurAuth({ code: 'otp_disabled', message: '' }), { cas: 'pas_de_compte' });
  assert.deepEqual(casErreurAuth({ message: 'Token has expired or is invalid' }), { cas: 'code_faux' });
  assert.deepEqual(casErreurAuth({ code: 'over_email_send_rate_limit', message: 'Email rate limit exceeded' }), { cas: '' }, 'limite horaire : pas « trop tôt »');
  assert.deepEqual(casErreurAuth(null), { cas: '' });
  assert.equal(adresseContact({}), 'reseau.ensam.meknes@gmail.com');
  assert.equal(adresseContact({ contactEmail: 'x@y.ma' }), 'x@y.ma');
});

const ID = '3f2b8c1e-9a7d-4e21-b6c0-5d4e3f2a1b0c';
test('lien partagé : seules trois formes sont reconnues', () => {
  assert.deepEqual(lienPartage('#offre/' + ID), { k: 'offre', id: ID, r: 'offre/' + ID });
  assert.equal(lienPartage('offre/o-003a').k, 'offre');
  assert.deepEqual(lienPartage('reseau/entraide/q1'), { k: 'question', id: 'q1', r: 'reseau/entraide/q1' });
  assert.deepEqual(lienPartage('#aider/d1'), { k: 'aider', id: 'd1', r: 'aider/d1' });
  for (const x of ['offres', 'offre/', 'offre/a/b', 'offre/<b>', 'offre/' + 'a'.repeat(65), 'admin/inviter', null, 'offre/a?x=1']) assert.equal(lienPartage(x), null, String(x));
  const now = Date.now();
  assert.ok(lienEncoreBon({ r: 'offre/' + ID, t: now - 36e5 }, now));
  assert.equal(lienEncoreBon({ r: 'offre/' + ID, t: now - 25 * 36e5 }, now), null);
  assert.equal(lienEncoreBon({ r: 'offre/' + ID, t: now + 6e4 }, now), null);
  assert.equal(lienEncoreBon({ r: 'admin', t: now }, now), null);
  assert.equal(lienEncoreBon({ r: 'offre/x', t: String(now) }, now), null);
  assert.ok(estUuid(ID)); assert.ok(!estUuid('o-003a')); assert.ok(!estUuid(ID + 'a'));
});

test('lien partagé : une phrase par cas, et chacune traduite', () => {
  const o = lienPartage('offre/' + ID), q = lienPartage('reseau/entraide/q1'), a = lienPartage('aider/d1');
  assert.equal(phraseLien(o, undefined), 'On t’a partagé une offre : crée ton compte pour la voir.');
  assert.equal(phraseLien(o, { type: 'pfe', audience: 'etudiants', ouverte: true }), 'Une offre de PFE t’attend : crée ton compte pour la voir.');
  assert.equal(phraseLien(o, { type: 'stage', audience: 'laureats', ouverte: true }, false), 'Une offre entre lauréats t’attend : connecte-toi pour la voir.');
  assert.equal(phraseLien(o, { type: 'emploi', audience: 'etudiants', ouverte: false }), 'Cette offre n’accepte plus de candidatures.');
  assert.equal(phraseLien(o, null), 'Cette offre n’est plus en ligne.');
  assert.equal(phraseLien(q, undefined, false), 'Une question t’attend : connecte-toi pour y répondre.');
  assert.equal(phraseLien(a, undefined), 'Connecte-toi pour voir la demande de l’étudiant.');
  assert.equal(phraseLien(null, undefined), '');
  // Une offre entre lauréats ne s'ouvrira pas pour un étudiant : on le dit dès le rôle choisi, rien n'est promis
  const entreLaureats = { type: 'emploi', audience: 'laureats', ouverte: true };
  assert.equal(phraseLien(o, entreLaureats, true, 'etudiant'), 'Cette offre est réservée aux lauréats.');
  assert.equal(phraseLien(o, entreLaureats, true, 'laureat'), 'Une offre entre lauréats t’attend : crée ton compte pour la voir.');
  assert.equal(offreFermeePour(entreLaureats, 'etudiant'), true);
  assert.equal(offreFermeePour({ type: 'pfe', audience: 'etudiants', ouverte: true }, 'etudiant'), false);
  const entree = lireSrc('entree.js');
  const traduit = s => entree.includes(`'${s}':`);
  const phrases = [suiteLien(o), suiteLien(q), suiteLien(a), phraseLien(o, null), phraseLien(a), phraseLien(o, entreLaureats, true, 'etudiant')];
  for (const ins of [true, false]) {
    phrases.push(phraseLien(q, undefined, ins), phraseLien(o, undefined, ins), phraseLien(o, { type: 'pfe', audience: 'laureats', ouverte: true }, ins), phraseLien(o, { type: 'pfe', ouverte: false }, ins));
    for (const type of ['stage', 'pfe', 'etranger', 'emploi']) phrases.push(phraseLien(o, { type, audience: 'etudiants', ouverte: true }, ins));
  }
  assert.deepEqual(phrases.filter(s => !traduit(s)), []);
});

test('arabe de la page d’entrée : les mêmes mots que le reste du site', async () => {
  const dico = lireSrc('i18n-ar.js');
  const AR = Object.fromEntries([...dico.matchAll(/'([^'\n]+)': '([^'\n]+)'/g)].map(m => [m[1], m[2]]));
  const entree = lireSrc('entree.js');
  const paires = [...entree.matchAll(/'([^'\n]+)': '([^'\n]+)'/g)].map(m => [m[1], m[2]]);
  assert.ok(paires.length > 50);
  const differents = paires.filter(([fr, ar]) => AR[fr] !== undefined && AR[fr] !== ar).map(([fr]) => fr);
  assert.deepEqual(differents, []);
  assert.doesNotMatch(entree, /القدامى/);
});

test('page d’entrée légère : six fichiers préchargés, moins de 32 Ko compressés', () => {
  const index = fs.readFileSync(new URL('index.html', DIST), 'utf8');
  const pre = [...index.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map(m => m[1]);
  assert.ok(pre.includes('entree.js') && pre.length <= 6, pre.join(', '));
  assert.ok(!pre.some(f => /^(app|store|logic|i18n-ar|community)\.js$|supabase/.test(f)), 'ni l’application, ni Supabase, ni le dictionnaire arabe');
  const taille = pre.reduce((n, f) => n + zlib.gzipSync(fs.readFileSync(new URL(f, DIST))).length, 0);
  assert.ok(taille < 32 * 1024, `${Math.round(taille / 1024)} Ko`);
  assert.match(index, /<script type="module" src="entree\.js"/);
  assert.ok(!/\/\*MAGASIN\*\/\[\]|\/\*MODULES\*\/\[\]|<!--PRECHARGE-->/.test(index), 'listes de préchargement remplies');
});
