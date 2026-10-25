// Origine des offres : portée par un lauréat > classique > partagée, les points, la fermeture des partages après 45 jours,
// qui peut publier quoi (comme offre_origine() dans la base), et le site qui reste comme avant tant que la base n'est pas à jour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trierOffres, rangOrigine, pointsOffre, POINTS_OFFRE, partageExpire, offreVisible, refusOrigine, sourceDe, lienValide } from '../../src/origine.js';
import { computeScores, peutPostulerA, needsRelance, candidatsAmbassadeur, classementFondateurs, BAREME } from '../../src/logic.js';
import { SupabaseStore } from '../../src/store.js';

const J = 864e5, maintenant = Date.parse('2026-10-25T10:00:00Z');
const il = j => new Date(maintenant - j * J).toISOString();
const offre = (id, origine, j = 1, x = {}) => ({ id, origine, author_id: 'lau', titre: 'Offre ' + id, type: 'stage', annees: [4], status: 'ouverte', created_at: il(j), audience: 'etudiants', ...x });

test('tri : portée > classique > partagée, et la plus récente d’abord dans chaque groupe', () => {
  const list = [offre('c-recente', null, 1), offre('p-vieille', 'partagee', 0), offre('po-ancienne', 'portee', 9), offre('c-ancienne', undefined, 5), offre('po-recente', 'portee', 2), offre('p-ancienne', 'partagee', 3)];
  assert.deepEqual(trierOffres(list).map(o => o.id), ['po-recente', 'po-ancienne', 'c-recente', 'c-ancienne', 'p-vieille', 'p-ancienne']);
  assert.deepEqual([rangOrigine({ origine: 'portee' }), rangOrigine({}), rangOrigine({ origine: 'partagee' })], [0, 1, 2]);
  assert.equal(list[0].id, 'c-recente', 'la liste donnée ne change pas');
});

test('points : une offre portée rapporte au moins autant qu’une offre classique, un partage presque rien', () => {
  assert.ok(pointsOffre({ origine: 'portee' }) >= pointsOffre({ origine: null }));
  assert.equal(pointsOffre({}), 10, 'une offre classique : le barème d’avant');
  assert.ok(pointsOffre({ origine: 'partagee' }) <= 1);
  const data = { offers: [offre('a', 'portee'), offre('b', null), offre('c', 'partagee')], applications: [], comments: [], placements: [], mentorships: [], answers: [], questions: [], votes: [] };
  const s = computeScores(data).get('lau');
  assert.equal(s.points, POINTS_OFFRE.portee + POINTS_OFFRE.classique + POINTS_OFFRE.partagee);
  assert.equal(s.offres, 2, 'un partage ne compte pas comme « offre publiée » (badge Premier coup de pouce)');
  assert.ok(s.events.some(e => /^Offre portée : /.test(e.label)) && s.events.some(e => /^Offre partagée : /.test(e.label)));
  // Le barème affiché dit les mêmes chiffres
  const b = Object.fromEntries(BAREME);
  assert.equal(b['Offre de ton entreprise, que tu encadres'], POINTS_OFFRE.portee);
  assert.equal(b['Offre vue ailleurs et partagée'], POINTS_OFFRE.partagee);
});

test('un partage ne fait ni membre fondateur, ni presque rien pour devenir ambassadeur', () => {
  const profiles = [{ id: 'lau', role: 'laureat', promo: 2015, filiere: 'GI', created_at: il(100) }];
  assert.deepEqual(classementFondateurs({ profiles, offers: [offre('p', 'partagee')] }), []);
  assert.equal(classementFondateurs({ profiles, offers: [offre('po', 'portee')] }).length, 1);
  const score = offers => candidatsAmbassadeur({ profiles, offers, ambassadeurs: [] }, 2015, 'GI')[0]?.score || 0;
  assert.equal(score([offre('p', 'partagee')]), 1);
  assert.equal(score([offre('po', 'portee')]), 3);
});

test('un partage : jamais de candidature ici, ni de relance « toujours ouverte ? »', () => {
  const etu = { id: 'e', role: 'etudiant', promo: 2028, filiere: 'GI' };
  const saison = 2026; // promo 2028 : 4A
  assert.equal(peutPostulerA(offre('c', null), etu, saison), true);
  assert.equal(peutPostulerA(offre('po', 'portee'), etu, saison), true);
  assert.equal(peutPostulerA(offre('p', 'partagee'), etu, saison), false);
  const data = { applications: [], comments: [] };
  assert.equal(needsRelance(data, offre('c', null, 30), maintenant), true);
  assert.equal(needsRelance(data, offre('p', 'partagee', 30), maintenant), false);
});

test('fermeture : un partage sans date limite se cache après 45 jours, avec date limite une fois passée', () => {
  assert.equal(partageExpire(offre('p', 'partagee', 44), maintenant), false);
  assert.equal(partageExpire(offre('p', 'partagee', 46), maintenant), true);
  assert.equal(partageExpire(offre('c', null, 400), maintenant), false, 'une offre classique ne se ferme pas seule');
  assert.equal(partageExpire(offre('p', 'partagee', 60, { deadline: '2026-11-30' }), maintenant), false, 'sa date limite d’abord');
  assert.equal(partageExpire(offre('p', 'partagee', 2, { deadline: '2026-10-24' }), maintenant), true);
  assert.equal(offreVisible(offre('p', 'partagee', 2, { status: 'fermee' }), maintenant), false);
  assert.equal(offreVisible(offre('po', 'portee', 90), maintenant), true);
});

test('qui publie quoi : un étudiant ne partage qu’avec un lien http(s) ; seul un lauréat porte une offre', () => {
  const lien = 'https://www.linkedin.com/jobs/view/42';
  const etu = { role: 'etudiant' }, lau = { role: 'laureat' }, adm = { role: 'admin', admin: true };
  assert.match(refusOrigine({ origine: null }, etu), /Un étudiant partage/);
  assert.match(refusOrigine({ origine: 'portee' }, etu), /Seul un lauréat/);
  assert.match(refusOrigine({ origine: 'partagee', lien: 'linkedin.com/x' }, etu), /Ajoute le lien/);
  assert.match(refusOrigine({ origine: 'partagee', lien: 'javascript:alert(1)' }, etu), /Ajoute le lien/);
  assert.match(refusOrigine({ origine: 'partagee', lien, audience: 'laureats' }, etu), /Un étudiant partage/);
  assert.equal(refusOrigine({ origine: 'partagee', lien }, etu), null);
  assert.equal(refusOrigine({ origine: 'portee' }, lau), null);
  assert.equal(refusOrigine({ origine: null }, lau), null);
  assert.equal(refusOrigine({ origine: 'portee' }, adm), null);
  // Le même lien encore ouvert, partagé par quelqu'un d'autre : une seule fois
  const deja = [offre('x', 'partagee', 3, { lien: lien + '/' })];
  assert.match(refusOrigine({ origine: 'partagee', lien }, lau, deja, null, maintenant), /déjà partagée/);
  assert.equal(refusOrigine({ origine: 'partagee', lien }, lau, [{ ...deja[0], status: 'fermee' }], null, maintenant), null);
  // Modifier : un partage reste un partage ; classique ↔ portée par un lauréat
  assert.match(refusOrigine({ origine: null }, lau, [], { origine: 'partagee' }), /reste un partage/);
  assert.match(refusOrigine({ origine: 'partagee', lien }, lau, [], { origine: null }), /reste un partage/);
  assert.equal(refusOrigine({ origine: 'portee' }, lau, [], { origine: null }), null);
  assert.equal(refusOrigine({ origine: null }, { role: 'laureat', admin: true }, [], { origine: 'partagee' }), null);
});

test('source du lien : « vue sur LinkedIn », sinon le nom du site', () => {
  assert.equal(sourceDe('https://www.linkedin.com/jobs/view/123'), 'LinkedIn');
  assert.equal(sourceDe('https://ma.linkedin.com/posts/x'), 'LinkedIn');
  assert.equal(sourceDe('https://www.rekrute.com/offre-emploi-x.html'), 'ReKrute');
  assert.equal(sourceDe('https://careers.exemple.ma/offre/7'), 'careers.exemple.ma');
  assert.equal(sourceDe('pas un lien'), '');
  assert.equal(lienValide(' https://exemple.ma/a '), true);
  assert.equal(lienValide('https://exemple'), false);
});

test('base pas encore à jour : sans la colonne « origine », le formulaire reste celui d’avant', () => {
  const s = new SupabaseStore({}); s.mode = 'live';
  s.data.offers = [{ id: 'a', titre: 'Avant' }];
  assert.equal(s.peutOrigine(), false);
  s.data.offers = [{ id: 'a', titre: 'Après', origine: null }];
  assert.equal(s.peutOrigine(), true);
  s.data.offers = []; s.origineSondee = true;
  assert.equal(s.peutOrigine(), true, 'aucune offre, mais la base a répondu que la colonne existe');
});
