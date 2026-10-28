// Cartes sponsorisées de Match : seule l'administration écrit et lit tout ; un membre lit seulement les cartes en cours ;
// un membre visé compte une vue et un clic par jour (compter_sponsorise), jamais pour une carte qui ne le vise pas ;
// personne ne lit les comptes, l'administration en lit seulement les totaux (bilan_sponsorises), sans nom ni identifiant.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const ADMIN = uid(951), ETU5 = uid(952), ETU3 = uid(953), LAU = uid(954), LAU_OLD = uid(955), ADMIN_VUE = uid(956);
const GIEO = 'Génie Industriel : Excellence Opérationnelle', GIP = 'Génie Industriel et Productique', GME = 'Génie Mécanique : Énergétique';
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const refuse = async (promesse, re) => { await assert.rejects(promesse, e => (re ? re.test(e.message) : true) || assert.fail(e.message)); };
const jour = n => { const d = new Date(Date.now() + n * 864e5); return d.toISOString().slice(0, 10); };
const carte = (u, champs = {}) => q(u, `insert into public.sponsorises (entreprise, titre, texte, lien, domaine, public, annees, filieres, debut, fin, actif)
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`, [champs.entreprise || 'Exemplia Langues', champs.titre || 'Allemand pour ingénieurs',
  champs.texte || 'Cours du soir en petits groupes, du niveau A1 au niveau C1.', champs.lien || 'https://example.com/langues', champs.domaine ?? null,
  champs.public || 'tous', champs.annees ?? null, champs.filieres ?? null, champs.debut || jour(-1), champs.fin || jour(30), champs.actif ?? true]).then(r => r[0]);
const compter = (u, id, kind) => q(u, 'select public.compter_sponsorise($1, $2) as ok', [id, kind]).then(r => r[0].ok);
const C = {};

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ADMIN, full_name: 'Admin École', role: 'etudiant', filiere: GIEO, promo: 2010 });
  await creerCompte(db, { id: ADMIN_VUE, full_name: 'Admin Vue Lauréat', role: 'etudiant', filiere: GIEO, promo: 2012 });
  await db.query(`update public.profiles set role = 'admin' where id = any($1)`, [[ADMIN, ADMIN_VUE]]);
  await creerCompte(db, { id: ETU5, full_name: 'Salma Bennani', role: 'etudiant', filiere: GIEO, promo: S + 1 });
  await creerCompte(db, { id: ETU3, full_name: 'Amine Talbi', role: 'etudiant', filiere: GME, promo: S + 3 });
  await creerCompte(db, { id: LAU, full_name: 'Youssef El Amrani', role: 'laureat', filiere: GIP, promo: 2016 });
  await creerCompte(db, { id: LAU_OLD, full_name: 'Karim Fassi', role: 'laureat', filiere: 'Génie Industriel', promo: 2012 });
  // L'administration qui regarde l'application comme un lauréat (admin_ok) : ni vue ni clic comptés
  await q(ADMIN_VUE, 'update public.profiles set role = $2 where id = $1', [ADMIN_VUE, 'laureat']);
  C.tous = await carte(ADMIN, { titre: 'Pour tout le monde', domaine: 'HTTPS://www.Example.com/accueil', annees: '{}', filieres: '{}' });
  C.cinq = await carte(ADMIN, { titre: 'Pour les 5A du parcours PEI', public: 'etudiants', annees: '{5}', filieres: [GIP] });
  C.lau = await carte(ADMIN, { titre: 'Pour les lauréats', public: 'laureats', filieres: ['Génie Industriel'] });
  C.arretee = await carte(ADMIN, { titre: 'Arrêtée', actif: false });
  C.future = await carte(ADMIN, { titre: 'Pas encore commencée', debut: jour(5), fin: jour(20) });
  C.finie = await carte(ADMIN, { titre: 'Déjà finie', debut: jour(-30), fin: jour(-2) });
});

test('l’administration écrit la carte ; la base garde l’auteur et nettoie le domaine et les listes vides', async () => {
  assert.equal(C.tous.created_by, ADMIN);
  assert.equal(C.tous.domaine, 'example.com');
  assert.equal(C.tous.annees, null); assert.equal(C.tous.filieres, null);
  // Un lien http, des dates à l'envers, un public inconnu, une année hors liste : refusés comme dans le site (refusSponsorise)
  await refuse(carte(ADMIN, { lien: 'http://example.com' }), /sponsorises_lien_check/);
  await refuse(carte(ADMIN, { lien: 'javascript:alert(1)' }), /sponsorises_lien_check/);
  await refuse(carte(ADMIN, { debut: jour(3), fin: jour(1) }), /sponsorises_dates/);
  await refuse(carte(ADMIN, { public: 'admins' }), /check/);
  await refuse(carte(ADMIN, { annees: '{9}' }), /sponsorises_annees_check/);
  await refuse(carte(ADMIN, { domaine: 'pas un domaine' }), /sponsorises_domaine_check/);
  // Modifier, arrêter, reprendre : l'auteur et la date restent
  const [m] = await q(ADMIN, 'update public.sponsorises set titre = $2, actif = false, created_by = $3 where id = $1 returning *', [C.lau.id, 'Pour les lauréats (modifiée)', LAU]);
  assert.deepEqual([m.titre, m.actif, m.created_by], ['Pour les lauréats (modifiée)', false, ADMIN]);
  await q(ADMIN, 'update public.sponsorises set actif = true where id = $1', [C.lau.id]);
});

test('un membre ne crée, ne modifie ni ne supprime une carte', async () => {
  await refuse(carte(LAU), /row-level security|non autorisée/);
  await refuse(carte(ETU5), /row-level security|non autorisée/);
  const modif = await q(LAU, 'update public.sponsorises set titre = $2 where id = $1 returning id', [C.tous.id, 'Piratée']);
  assert.equal(modif.length, 0);
  const suppr = await q(ETU5, 'delete from public.sponsorises where id = $1 returning id', [C.tous.id]);
  assert.equal(suppr.length, 0);
  assert.equal((await db.query('select titre from public.sponsorises where id = $1', [C.tous.id])).rows[0].titre, 'Pour tout le monde');
});

test('un membre lit seulement les cartes en cours (ni arrêtée, ni à venir, ni finie) ; l’administration lit tout', async () => {
  const titres = async u => (await q(u, 'select titre from public.sponsorises order by titre')).map(r => r.titre);
  const enCours = ['Pour les 5A du parcours PEI', 'Pour les lauréats (modifiée)', 'Pour tout le monde'];
  assert.deepEqual(await titres(ETU5), enCours);
  assert.deepEqual(await titres(LAU), enCours);
  assert.equal((await titres(ADMIN)).length, 6);
  // Sans compte : rien
  const anon = await en(db, null, tx => tx.query('select count(*)::int n from public.sponsorises'), { role: 'anon' }).catch(e => e);
  assert.ok(anon instanceof Error || anon.rows[0].n === 0);
});

test('compter : une vue et un clic par jour, seulement pour un membre visé (public, année, filière ; ancienne appellation par parcours)', async () => {
  assert.equal(await compter(ETU5, C.tous.id, 'vue'), true);
  assert.equal(await compter(ETU5, C.tous.id, 'vue'), false, 'une seule vue par jour');
  assert.equal(await compter(ETU5, C.tous.id, 'clic'), true);
  assert.equal(await compter(ETU5, C.tous.id, 'clic'), false);
  assert.equal(await compter(ETU5, C.tous.id, 'like'), false, 'seulement vue ou clic');
  // 5A du parcours PEI : Salma (GIEO, même parcours) n'est pas dans la liste [GIP] (deux filières actuelles : identiques seulement)
  assert.equal(await compter(ETU5, C.cinq.id, 'vue'), false);
  assert.equal(await compter(ETU3, C.cinq.id, 'vue'), false, 'un 3A');
  assert.equal(await compter(LAU, C.cinq.id, 'vue'), false, 'un lauréat');
  // Pour les lauréats de « Génie Industriel » (ancienne appellation) : Youssef (GIP, même parcours) et Karim (même appellation)
  assert.equal(await compter(LAU, C.lau.id, 'vue'), true);
  assert.equal(await compter(LAU_OLD, C.lau.id, 'vue'), true);
  assert.equal(await compter(ETU5, C.lau.id, 'vue'), false, 'une étudiante');
  // Arrêtée, à venir, finie : rien
  for (const c of [C.arretee, C.future, C.finie]) assert.equal(await compter(ETU5, c.id, 'vue'), false, c.titre);
  // L'administration, même en vue lauréat : rien
  assert.equal(await compter(ADMIN, C.tous.id, 'vue'), false);
  assert.equal(await compter(ADMIN_VUE, C.tous.id, 'vue'), false);
  // Sans compte : la fonction n'est pas ouverte
  await refuse(en(db, null, tx => tx.query('select public.compter_sponsorise($1, $2)', [C.tous.id, 'vue']), { role: 'anon' }), /permission denied/);
});

test('les comptes : aucun membre ne les lit ni ne les écrit ; l’administration lit seulement les totaux', async () => {
  for (const u of [ETU5, LAU, ADMIN]) {
    await refuse(q(u, 'select * from public.sponsorises_comptes'), /permission denied/);
    await refuse(q(u, `insert into public.sponsorises_comptes (sponsorise_id, user_id, kind) values ($1, $2, 'vue')`, [C.tous.id, u]), /permission denied/);
  }
  await refuse(q(ETU5, 'select * from public.bilan_sponsorises()'), /Réservé à l’administration/);
  await refuse(q(LAU, 'select * from public.bilan_sponsorises()'), /Réservé à l’administration/);
  await refuse(q(ADMIN_VUE, 'select * from public.bilan_sponsorises()'), /Réservé à l’administration/, 'en vue lauréat, l’administration est un lauréat');
  const bilan = await q(ADMIN, 'select * from public.bilan_sponsorises()');
  const de = id => bilan.find(b => b.sponsorise_id === id);
  assert.deepEqual(Object.keys(bilan[0]).sort(), ['clics', 'membres', 'sponsorise_id', 'vues'], 'des totaux, aucun nom ni identifiant de membre');
  assert.deepEqual({ ...de(C.tous.id), sponsorise_id: undefined }, { sponsorise_id: undefined, vues: 1, clics: 1, membres: 1 });
  assert.deepEqual({ ...de(C.lau.id), sponsorise_id: undefined }, { sponsorise_id: undefined, vues: 2, clics: 0, membres: 2 });
  assert.deepEqual({ ...de(C.arretee.id), sponsorise_id: undefined }, { sponsorise_id: undefined, vues: 0, clics: 0, membres: 0 });
  assert.equal(bilan.length, 6);
});

test('passer une carte sponsorisée n’écrit rien dans Match : compter ne touche pas match_choix', async () => {
  const avant = (await db.query('select count(*)::int n from public.match_choix')).rows[0].n;
  await compter(ETU5, C.tous.id, 'vue');
  assert.equal((await db.query('select count(*)::int n from public.match_choix')).rows[0].n, avant);
});
