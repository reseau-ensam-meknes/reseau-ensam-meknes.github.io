// Ambassadeurs de promo dans le résumé de la semaine : le premier résumé du mois (jours 1 à 7) porte les chiffres vrais
// de sa promo le mois précédent ; les autres semaines, rien. Base pas encore à jour (fonction absente) : le résumé part.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE, Banc, installer, configurerEnv, SITE } from './banc.mjs';
import { ID, jeu, brut } from './donnees.mjs';

const N = await import(MODULE);
const TOKEN = '6f1c2b8e-3d4a-4f5b-9c7d-0e1f2a3b4c5d';
const fetchOrigine = globalThis.fetch;
beforeEach(() => configurerEnv());
afterEach(() => { globalThis.fetch = fetchOrigine; });

const chiffres = { inscrits: 14, nouveaux: 3, demandes: 4, demandes_mois: 1, stages: 6, stages_mois: 2 };

test('le premier résumé du mois : les chiffres du mois précédent, seulement pour l’ambassadeur', () => {
  assert.equal(N.moisPrecedent(new Date('2026-11-03T09:00:00Z')), '2026-10-01T00:00:00.000Z');
  assert.equal(N.moisPrecedent(new Date('2027-01-07T09:00:00Z')), '2026-12-01T00:00:00.000Z');
  assert.equal(N.moisPrecedent(new Date('2026-11-08T09:00:00Z')), null);
  const NOW = new Date('2026-11-03T09:00:00Z');
  const J = jeu(NOW);
  const salma = J.tables.profiles.find(p => p.id === ID.salma);
  const D = N.indexer({ ...brut(J), ambassadeurs: [{ user_id: ID.salma, promo: salma.promo, filiere: salma.filiere, chiffres }], moisAmbassadeurs: '2026-10-01T00:00:00.000Z' }, NOW);
  const r = N.resumeDe(D.profils.get(ID.salma), D);
  assert.deepEqual(r.promo, { promo: salma.promo, filiere: salma.filiere, mois: 9, inscrits: 14, nouveaux: 3, demandes: 4, demandesMois: 1, stages: 6, stagesMois: 2 });
  assert.equal(N.resumeDe(D.profils.get(ID.amine), D)?.promo, undefined, 'pas ambassadeur');
  const fr = N.rendreResume(r, 'fr', SITE, TOKEN);
  assert.match(fr.texte, /TA PROMO LE MOIS DERNIER/);
  assert.match(fr.texte, new RegExp(`Promo ${salma.promo} · ${salma.filiere}, en octobre`));
  assert.match(fr.texte, /14 inscrits sur le réseau, dont 3 nouveaux ce mois-là\./);
  assert.match(fr.texte, /1 demande pourvue ce mois-là \(4 en tout\)\./);
  assert.match(fr.texte, /2 stages et emplois trouvés ce mois-là \(6 en tout\)\./);
  assert.match(fr.html, /#accueil/);
  const ar = N.rendreResume(r, 'ar', SITE, TOKEN);
  assert.match(ar.texte, /دفعتك في الشهر الماضي/);
  assert.match(ar.texte, /في أكتوبر/);
  assert.match(ar.texte, /14 عضوًا مسجَّلًا في الشبكة، منهم 3 أعضاء جدد/);
  assert.doesNotMatch(ar.texte, /القدامى|inscrit|pourvue/);
  // Un ambassadeur qui n'a rien d'autre cette semaine reçoit quand même ses chiffres
  const calme = { ...N.resumeVide(D.profils.get(ID.salma)), promo: r.promo };
  assert.equal(N.estVide(calme), false);
});

test('lecture : la fonction est appelée les jours 1 à 7 seulement ; absente (base pas à jour), le résumé reste valable', async () => {
  const b = installer(new Banc());
  const env = N.lireEnv();
  b.rpcs = { chiffres_ambassadeurs: () => [{ user_id: ID.salma, promo: 2027, filiere: 'Génie Industriel', chiffres }] };
  let x = await N.chargerDonnees(env, [ID.salma], new Date('2026-11-02T09:00:00Z'));
  assert.deepEqual(b.argsRpc.chiffres_ambassadeurs, [{ p_debut: '2026-10-01T00:00:00.000Z' }]);
  assert.equal(x.ambassadeurs.length, 1);
  assert.equal(x.moisAmbassadeurs, '2026-10-01T00:00:00.000Z');
  x = await N.chargerDonnees(env, [ID.salma], new Date('2026-11-12T09:00:00Z'));
  assert.equal(b.argsRpc.chiffres_ambassadeurs.length, 1, 'pas au milieu du mois');
  assert.deepEqual(x.ambassadeurs, []);
  delete b.rpcs.chiffres_ambassadeurs;
  x = await N.chargerDonnees(env, [ID.salma], new Date('2026-11-02T09:00:00Z'));
  assert.deepEqual(x.ambassadeurs, []);
});
