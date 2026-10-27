// Page Match : qui peut choisir quoi, qui lit quoi, le match quand les deux disent oui (dans un ordre ou dans l'autre),
// la discussion qui s'ouvre, le CV lisible par le lauréat, l'entretien proposé et sa réponse, les notifications
// (catégorie « Match », activée par défaut ; coupée : rien).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
// 5A : diplômés l'été prochain ; 4A : l'année d'après
const ETU = uid(901), ETU2 = uid(902), ETU3 = uid(903), ETU4 = uid(904), CACHE = uid(905), ETU_4A = uid(906), SANS = uid(907), ETU_CV = uid(908), ETU_RDV = uid(909);
const LAU = uid(911), LAU2 = uid(912), LAU3 = uid(913), ADMIN = uid(914);
const NOMS = { [ETU]: 'ETU', [ETU2]: 'ETU2', [ETU3]: 'ETU3', [ETU4]: 'ETU4', [CACHE]: 'CACHE', [ETU_4A]: 'ETU_4A', [SANS]: 'SANS', [ETU_CV]: 'ETU_CV', [ETU_RDV]: 'ETU_RDV',
  [LAU]: 'LAU', [LAU2]: 'LAU2', [LAU3]: 'LAU3', [ADMIN]: 'ADMIN' };
const GI = 'Génie Industriel et Productique';
const O = {};

const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const refuse = async (promesse, re) => { await assert.rejects(promesse, e => (re ? re.test(e.message) : true) || assert.fail(e.message)); };
// Comme le site (upsert de PostgREST) : une ligne par carte, changer d'avis la remplace
const choisir = (u, { profil, offre }, choix = 'oui') => {
  const col = offre ? 'cible_offre' : 'cible_profil';
  return q(u, `insert into public.match_choix (${col}, choix) values ($1, $2)
    on conflict (user_id, ${col}) do update set choix = excluded.choix returning *`, [offre || profil, choix]).then(r => r[0]);
};
const matchsDe = async (e, l) => (await db.query('select * from public.matchs where etudiant_id = $1 and laureat_id = $2', [e, l])).rows;
const vider = () => db.query('delete from public.push_queue');
const file = async kind => (await db.query('select user_id, kind, data from public.push_queue' + (kind ? ' where kind = $1' : '') + ' order by id', kind ? [kind] : [])).rows
  .map(r => ({ qui: NOMS[r.user_id] || r.user_id, kind: r.kind, data: r.data }));
const qui = async kind => (await file(kind)).map(x => x.qui).sort();
const reculer = (motif, intervalle) => db.query(`update public.notif_cadence set at = at - $2::interval where cle like $1`, [motif, intervalle]);
const offre = async (u, titre, champs = {}) => (await q(u, `insert into public.offers (author_id, type, titre, entreprise, description, annees, audience, origine, lien, status)
  values ($1, $2, $3, 'OCP', 'Une vraie mission.', $4, $5, $6, $7, 'ouverte') returning id`,
  [u, champs.type || 'pfe', titre, champs.annees || '{5}', champs.audience || 'etudiants', champs.origine || null, champs.lien || null]))[0].id;
const demain = () => new Date(Date.now() + 864e5).toISOString();

before(async () => {
  db = await nouvelleBase(SCHEMA);
  const etu = (id, full_name, promo = S + 1, extra = {}) => creerCompte(db, { id, full_name, role: 'etudiant', filiere: GI, promo, ...extra });
  await etu(ETU, 'Salma Bennani'); await etu(ETU2, 'Amine Tazi'); await etu(ETU3, 'Hiba Alaoui'); await etu(ETU4, 'Omar Idrissi');
  await etu(CACHE, 'Nora Discrète'); await etu(ETU_4A, 'Imane Kettani', S + 2); await etu(SANS, 'Rayan Sans', S + 1, { filiere: '' });
  await etu(ETU_CV, 'Yasmine Cv'); await etu(ETU_RDV, 'Adam Rdv');
  await creerCompte(db, { id: LAU, full_name: 'Youssef Amrani', role: 'laureat', filiere: GI, promo: 2015, entreprise: 'OCP' });
  await creerCompte(db, { id: LAU2, full_name: 'Karim Fassi', role: 'laureat', filiere: GI, promo: 2017, entreprise: 'Renault' });
  await creerCompte(db, { id: LAU3, full_name: 'Nadia Berrada', role: 'laureat', filiere: GI, promo: 2016, entreprise: 'Lear' });
  await creerCompte(db, { id: ADMIN, full_name: 'Admin École', role: 'etudiant', filiere: GI, promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  await db.query(`update public.profiles set match_visible = false where id = $1`, [CACHE]);
  // Karim montre son entreprise aux lauréats seulement : elle ne part pas dans la notification d'un étudiant
  await db.query(`update public.profiles set visibilite = '{"travail":"laureats"}' where id = $1`, [LAU2]);
  O.pfe = await offre(LAU, 'PFE Lean manufacturing', { origine: 'portee' });
  O.bis = await offre(LAU, 'PFE Maintenance prédictive');
  O.stage4a = await offre(LAU, 'Stage 4A qualité', { type: 'stage', annees: '{4}' });
  O.laureats = await offre(LAU, 'Ingénieur méthodes', { type: 'emploi', annees: '{}', audience: 'laureats' });
  O.fermee = await offre(LAU, 'PFE déjà pourvu');
  await db.query(`update public.offers set status = 'pourvue' where id = $1`, [O.fermee]);
  O.partageLau = await offre(LAU2, 'PFE supply chain chez Renault', { origine: 'partagee', lien: 'https://renault.example/pfe-supply' });
  O.partageEtu = await offre(ETU2, 'PFE vu sur LinkedIn', { origine: 'partagee', lien: 'https://linkedin.example/pfe-42' });
  O.lau3 = await offre(LAU3, 'PFE câblage automobile');
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://push.example/' || id, 'k', 'a' from public.profiles`);
  await vider();
});

test('qui peut choisir quoi : l’étudiant, une offre ouverte de son année ; le lauréat, un étudiant de Match ; jamais l’administration ni soi-même', async () => {
  const c = await choisir(ETU, { offre: O.pfe });
  assert.equal(c.user_id, ETU); assert.equal(c.choix, 'oui');
  // Pas pour son année, réservée aux lauréats, plus ouverte, partagée par un étudiant : refusé
  await refuse(choisir(ETU, { offre: O.stage4a }), /pas proposée à ton année/);
  await refuse(choisir(ETU, { offre: O.laureats }), /pas proposée à ton année/);
  await refuse(choisir(ETU, { offre: O.fermee }), /plus ouverte/);
  await refuse(choisir(ETU, { offre: O.partageEtu }), /pas proposée à ton année/);
  await refuse(choisir(ETU2, { offre: O.partageEtu }), /propre offre/);
  // Un partage apporté par un lauréat : oui (le match se fera avec lui)
  await choisir(ETU, { offre: O.partageLau }, 'plus_tard');
  // L'étudiant ne choisit un lauréat que pour répondre à son intérêt
  await refuse(choisir(ETU4, { profil: LAU3 }), /lauréats qui s’intéressent à ton profil/);
  await refuse(choisir(ETU4, { profil: ETU3 }), /lauréats qui s’intéressent à ton profil/);
  // Le lauréat : un étudiant à la filière renseignée, qui apparaît dans Match ; pas une offre, pas un lauréat, pas lui-même
  await refuse(choisir(LAU3, { offre: O.pfe }), /offres sont proposées aux étudiants/);
  await refuse(choisir(LAU3, { profil: LAU2 }), /pas proposé dans Match/);
  await refuse(choisir(LAU3, { profil: LAU3 }), /autre membre que toi/);
  await refuse(choisir(LAU3, { profil: SANS }), /pas proposé dans Match/);
  await refuse(choisir(LAU3, { profil: CACHE }), /pas proposé dans Match/, 'un étudiant caché n’apparaît pas');
  // … sauf s'il a dit oui à une offre de ce lauréat : on peut toujours lui répondre
  await choisir(CACHE, { offre: O.lau3 });
  await choisir(LAU3, { profil: CACHE }, 'plus_tard');
  // L'administration ne participe pas
  await refuse(choisir(ADMIN, { offre: O.pfe }), /réservé aux étudiants et aux lauréats/);
  await refuse(choisir(ADMIN, { profil: ETU }), /réservé aux étudiants et aux lauréats/);
  // L'auteur est toujours la personne connectée ; une seule cible ; un choix connu
  const [x] = await q(ETU4, `insert into public.match_choix (user_id, cible_offre, choix) values ($1, $2, 'plus_tard') returning user_id`, [ETU, O.bis]);
  assert.equal(x.user_id, ETU4);
  await refuse(q(ETU4, `insert into public.match_choix (cible_offre, cible_profil, choix) values ($1, $2, 'oui')`, [O.pfe, LAU]), /match_choix_une_cible/);
  await refuse(q(ETU4, `insert into public.match_choix (cible_offre, choix) values ($1, 'peut-etre')`, [O.pfe]), /check/);
  // La carte ne change jamais : seul le choix change
  await q(ETU4, `update public.match_choix set cible_offre = $1, user_id = $2 where cible_offre = $3`, [O.pfe, ETU, O.bis]);
  assert.deepEqual((await db.query('select user_id, cible_offre from public.match_choix where id = (select id from public.match_choix where user_id = $1 and cible_offre = $2)', [ETU4, O.bis])).rows,
    [{ user_id: ETU4, cible_offre: O.bis }]);
});

test('bloqué : ni choisir son profil, ni ses offres, dans un sens comme dans l’autre', async () => {
  await q(ETU3, `insert into public.blocages (bloque_id) values ($1)`, [LAU2]);
  await refuse(choisir(LAU2, { profil: ETU3 }), /non autorisée/);
  await refuse(choisir(ETU3, { offre: O.partageLau }), /non autorisée/);
  await q(ETU3, `delete from public.blocages where bloque_id = $1`, [LAU2]);
  await choisir(ETU3, { offre: O.partageLau }, 'plus_tard');
  await q(ETU3, `delete from public.match_choix where cible_offre = $1`, [O.partageLau]);
});

test('lecture : mes choix, et les « oui » qui me visent ; jamais les « plus tard » des autres', async () => {
  const lus = async u => (await q(u, 'select user_id, cible_profil, cible_offre, choix from public.match_choix order by created_at'))
    .map(r => `${NOMS[r.user_id]}>${NOMS[r.cible_profil] || Object.keys(O).find(k => O[k] === r.cible_offre)}:${r.choix}`);
  // Youssef voit le oui de Salma sur son offre ; Karim ne voit pas son « plus tard » sur le partage
  assert.deepEqual(await lus(LAU), ['ETU>pfe:oui']);
  assert.deepEqual(await lus(LAU2), []);
  assert.deepEqual(await lus(ETU), ['ETU>pfe:oui', 'ETU>partageLau:plus_tard']);
  // Nadia a mis Nora « plus tard » : Nora ne le voit pas ; Nadia voit le oui de Nora sur son offre
  assert.deepEqual(await lus(CACHE), ['CACHE>lau3:oui']);
  assert.deepEqual(await lus(LAU3), ['CACHE>lau3:oui', 'LAU3>CACHE:plus_tard']);
  assert.deepEqual(await lus(ADMIN), [], 'l’administration ne lit pas les choix');
  // Un oui du lauréat se lit par l'étudiant visé
  await choisir(LAU3, { profil: ETU4 });
  assert.ok((await lus(ETU4)).includes('LAU3>ETU4:oui'));
  assert.ok(!(await lus(ETU)).includes('LAU3>ETU4:oui'));
  await q(LAU3, 'delete from public.match_choix where cible_profil = $1', [ETU4]);
  // On ne modifie ni ne supprime les choix des autres
  await q(LAU3, `update public.match_choix set choix = 'plus_tard' where user_id = $1`, [CACHE]);
  await q(LAU3, `delete from public.match_choix where user_id = $1`, [CACHE]);
  assert.equal((await db.query(`select choix from public.match_choix where user_id = $1 and cible_offre = $2`, [CACHE, O.lau3])).rows[0].choix, 'oui');
});

test('match : l’étudiant d’abord (sur une offre), puis le lauréat ; un seul match, avec l’offre ; « C’est un match ! » aux deux', async () => {
  await vider();
  // Salma a dit oui à l'offre de Youssef (premier test) : pas encore de match
  assert.deepEqual(await matchsDe(ETU, LAU), []);
  await choisir(LAU, { profil: ETU });
  const [m] = await matchsDe(ETU, LAU);
  assert.ok(m, 'le match est créé');
  assert.equal(m.offre_id, O.pfe);
  assert.equal(m.vu_etudiant_at, null); assert.equal(m.vu_laureat_at, null);
  // La même date que le choix qui l'a créé (le site s'en sert pour fêter le match au bon moment)
  const c = (await db.query('select updated_at from public.match_choix where user_id = $1 and cible_profil = $2', [LAU, ETU])).rows[0];
  assert.equal(new Date(m.created_at).getTime(), new Date(c.updated_at).getTime());
  // Aux deux, celui qui vient de dire oui compris : le prénom de l'autre, la discussion à ouvrir
  const pushs = await file('match');
  assert.deepEqual(pushs.map(x => x.qui).sort(), ['ETU', 'LAU']);
  const pour = Object.fromEntries(pushs.map(x => [x.qui, x.data]));
  assert.deepEqual(pour.ETU, { nom: 'Youssef', de: LAU, match: m.id, titre: 'PFE Lean manufacturing' });
  assert.deepEqual(pour.LAU, { nom: 'Salma', de: ETU, match: m.id, titre: 'PFE Lean manufacturing' });
  assert.deepEqual(await file('match_interet'), [], 'pas d’intérêt quand c’est un match');
  // Encore un oui (une autre offre du même lauréat, ou le même choix redit) : jamais un deuxième match, ni d'intérêt
  await vider();
  await choisir(ETU, { offre: O.bis });
  await choisir(LAU, { profil: ETU }, 'plus_tard'); await choisir(LAU, { profil: ETU });
  assert.equal((await matchsDe(ETU, LAU)).length, 1);
  assert.deepEqual(await file(), []);
});

test('match : le lauréat d’abord ; l’étudiant répond sur son profil (sans offre) ou sur une de ses offres (avec l’offre)', async () => {
  await vider();
  // Karim s'intéresse à Amine : Amine l'apprend (sans l'entreprise, que Karim ne montre qu'aux lauréats)
  await choisir(LAU2, { profil: ETU2 });
  assert.deepEqual(await matchsDe(ETU2, LAU2), []);
  assert.deepEqual(await file('match_interet'), [{ qui: 'ETU2', kind: 'match_interet', data: { nom: 'Karim', de: LAU2 } }]);
  await choisir(ETU2, { profil: LAU2 });
  const [m] = await matchsDe(ETU2, LAU2);
  assert.equal(m.offre_id, null);
  assert.deepEqual(await qui('match'), ['ETU2', 'LAU2']);
  // Youssef s'intéresse à Hiba (avec son entreprise, visible de tous) ; Hiba dit oui à son offre : le match porte l'offre
  await vider();
  await choisir(LAU, { profil: ETU3 });
  assert.deepEqual((await file('match_interet'))[0], { qui: 'ETU3', kind: 'match_interet', data: { nom: 'Youssef', de: LAU, entreprise: 'OCP' } });
  await choisir(ETU3, { offre: O.bis }, 'plus_tard');
  assert.deepEqual(await matchsDe(ETU3, LAU), [], '« plus tard » ne fait pas de match');
  await choisir(ETU3, { offre: O.bis });
  const [m2] = await matchsDe(ETU3, LAU);
  assert.equal(m2.offre_id, O.bis, 'passer de « plus tard » à « oui » crée le match');
  // Nadia avait mis Nora « plus tard » ; elle change d'avis : Nora avait dit oui à son offre, c'est un match
  await choisir(LAU3, { profil: CACHE });
  assert.equal((await matchsDe(CACHE, LAU3))[0].offre_id, O.lau3);
});

test('intérêt : au plus une notification par paire et par jour, au lauréat (son offre) comme à l’étudiant', async () => {
  await vider();
  await choisir(ETU4, { offre: O.pfe });
  assert.deepEqual(await file('match_interet'), [{ qui: 'LAU', kind: 'match_interet', data: { nom: 'Omar', de: ETU4, titre: 'PFE Lean manufacturing', offre: O.pfe } }]);
  // Une deuxième offre du même lauréat, ou « Revenir » puis oui : rien de plus aujourd'hui
  await choisir(ETU4, { offre: O.bis });
  await q(ETU4, 'delete from public.match_choix where cible_offre = $1', [O.pfe]);
  await choisir(ETU4, { offre: O.pfe });
  assert.equal((await file('match_interet')).length, 1);
  // Le lendemain : de nouveau
  await reculer('match_interet:%', '25 hours');
  await q(ETU4, 'delete from public.match_choix where cible_offre = $1', [O.pfe]);
  await choisir(ETU4, { offre: O.pfe });
  assert.equal((await file('match_interet')).length, 2);
  // Un « plus tard » ne prévient personne
  await vider();
  await choisir(ETU4, { offre: O.partageLau }, 'plus_tard');
  assert.deepEqual(await file(), []);
});

test('le match : lu par les deux (et l’administration) ; chacun note seulement qu’il l’a vu ; l’un ou l’autre le retire', async () => {
  const [m] = await matchsDe(ETU, LAU);
  const voit = async u => (await q(u, 'select id from public.matchs where id = $1', [m.id])).length;
  assert.deepEqual([await voit(ETU), await voit(LAU), await voit(ADMIN), await voit(ETU2), await voit(LAU2)], [1, 1, 1, 0, 0]);
  // Personne ne crée un match à la main
  await refuse(q(ETU4, `insert into public.matchs (etudiant_id, laureat_id) values ($1, $2)`, [ETU4, LAU]), /row-level security/);
  // « Vu » : son côté seulement, une fois ; rien d'autre ne change
  await q(ETU, `update public.matchs set vu_etudiant_at = now(), vu_laureat_at = now(), offre_id = null, laureat_id = $2 where id = $1`, [m.id, LAU2]);
  let r = (await db.query('select * from public.matchs where id = $1', [m.id])).rows[0];
  assert.ok(r.vu_etudiant_at); assert.equal(r.vu_laureat_at, null); assert.equal(r.offre_id, O.pfe); assert.equal(r.laureat_id, LAU);
  const vu = r.vu_etudiant_at;
  await q(ETU, `update public.matchs set vu_etudiant_at = null where id = $1`, [m.id]);
  await q(LAU, `update public.matchs set vu_laureat_at = now() where id = $1`, [m.id]);
  r = (await db.query('select * from public.matchs where id = $1', [m.id])).rows[0];
  assert.equal(r.vu_etudiant_at.getTime(), vu.getTime(), 'jamais remis à zéro'); assert.ok(r.vu_laureat_at);
  // « Revenir » sur le choix qui a fait le match ne le défait pas
  await q(LAU, 'delete from public.match_choix where cible_profil = $1', [ETU]);
  assert.equal((await matchsDe(ETU, LAU)).length, 1);
  await choisir(LAU, { profil: ETU });
  // Un autre membre ne le retire pas ; Hiba retire le sien avec Youssef
  await q(ETU2, 'delete from public.matchs where id = $1', [m.id]);
  assert.equal(await voit(ETU), 1);
  const [m3] = await matchsDe(ETU3, LAU);
  await q(ETU3, 'delete from public.matchs where id = $1', [m3.id]);
  assert.deepEqual(await matchsDe(ETU3, LAU), []);
});

test('discussion : un match l’ouvre ; un blocage la ferme ; sans match, toujours fermée', async () => {
  const peut = async (a, b) => (await q(a, 'select public.peut_discuter($1, $2) as ok', [a, b]))[0].ok;
  assert.equal(await peut(ETU, LAU), true); assert.equal(await peut(LAU, ETU), true);
  assert.equal(await peut(ETU2, LAU2), true);
  assert.equal(await peut(ETU4, LAU), false, 'un simple oui ne suffit pas');
  assert.equal(await peut(ETU3, LAU), false, 'match retiré : la discussion se referme (si personne n’a écrit)');
  const [msg] = await q(ETU, `insert into public.messages (author_id, dest_id, body) values ($1, $2, 'Bonjour Youssef !') returning id`, [ETU, LAU]);
  assert.ok(msg.id);
  await q(ETU2, `insert into public.blocages (bloque_id) values ($1)`, [LAU2]);
  assert.equal(await peut(LAU2, ETU2), false);
  await q(ETU2, `delete from public.blocages where bloque_id = $1`, [LAU2]);
});

test('CV : après le match, le lauréat lit le CV de l’étudiant (même réservé aux contacts) ; pas avant, ni un autre', async () => {
  const chemin = `${ETU_CV}/cv-1730000000000.pdf`;
  await db.query(`update public.profiles set cv_path = $2, visibilite = '{"cv":"contacts"}' where id = $1`, [ETU_CV, chemin]);
  await db.query(`insert into storage.objects (bucket_id, name, owner) values ('cv', $1, $2)`, [chemin, ETU_CV]);
  const lit = async u => (await q(u, `select name from storage.objects where bucket_id = 'cv' and name = $1`, [chemin])).length;
  const cvVu = async u => (await q(u, 'select cv_path from public.profils where id = $1', [ETU_CV]))[0].cv_path;
  assert.deepEqual([await lit(LAU), await lit(LAU2), await lit(ETU_CV)], [0, 0, 1]);
  assert.equal(await cvVu(LAU), null);
  await choisir(ETU_CV, { offre: O.pfe });
  assert.equal(await lit(LAU), 0, 'un oui de l’étudiant ne suffit pas');
  await choisir(LAU, { profil: ETU_CV });
  assert.equal((await matchsDe(ETU_CV, LAU)).length, 1);
  assert.deepEqual([await lit(LAU), await lit(LAU2)], [1, 0]);
  assert.equal(await cvVu(LAU), chemin);
  assert.equal(await cvVu(LAU2), null);
});

test('entretien : proposé dans la discussion (date à venir, durée, lieu ou lien), seul le destinataire répond, tant que c’est à venir', async () => {
  await choisir(ETU_RDV, { offre: O.pfe }); await choisir(LAU, { profil: ETU_RDV });
  await vider();
  const rdv = (extra = {}) => {
    const row = { author_id: LAU, dest_id: ETU_RDV, type: 'rdv', body: 'Entretien technique', rdv_at: demain(), rdv_duree: 30, rdv_lien: 'https://meet.jit.si/ReseauENSAM-1a2b3c4d', ...extra };
    const cols = Object.keys(row);
    return q(row.author_id, `insert into public.messages (${cols.join(',')}) values (${cols.map((_, i) => '$' + (i + 1)).join(',')}) returning *`, Object.values(row)).then(r => r[0]);
  };
  const m = await rdv({ fichier: `${LAU}/${ETU_RDV}/x.jpg`, rdv_reponse: 'oui', rdv_lieu: '   ' });
  assert.equal(m.type, 'rdv'); assert.equal(m.fichier, null); assert.equal(m.rdv_reponse, null, 'la réponse vient après'); assert.equal(m.rdv_lieu, null);
  assert.equal(m.rdv_duree, 30); assert.equal(m.rdv_lien, 'https://meet.jit.si/ReseauENSAM-1a2b3c4d');
  // Sur place, sans note : d'accord
  const surPlace = await rdv({ body: null, rdv_lien: null, rdv_lieu: 'Siège OCP, Casablanca', rdv_duree: 60 });
  assert.equal(surPlace.rdv_lieu, 'Siège OCP, Casablanca');
  await refuse(rdv({ rdv_at: new Date(Date.now() - 6e4).toISOString() }), /date à venir/);
  await refuse(rdv({ rdv_at: new Date(Date.now() + 121 * 864e5).toISOString() }), /date à venir/);
  await refuse(rdv({ rdv_at: null }), /date à venir/);
  await refuse(rdv({ rdv_duree: null }), /durée/);
  await refuse(rdv({ rdv_duree: 10 }), /check/);
  await refuse(rdv({ rdv_duree: 180 }), /check/);
  await refuse(rdv({ rdv_lien: 'http://meet.example/x' }), /rdv_lien_check/);
  await refuse(rdv({ rdv_lieu: 'x'.repeat(201) }), /check/);
  await refuse(rdv({ body: 'x'.repeat(501) }), /trop longue/);
  // Un message ordinaire ne porte pas d'entretien
  const [t] = await q(ETU_RDV, `insert into public.messages (author_id, dest_id, body, rdv_at, rdv_duree, rdv_reponse) values ($1, $2, 'Merci !', $3, 30, 'oui') returning *`, [ETU_RDV, LAU, demain()]);
  assert.deepEqual([t.type, t.rdv_at, t.rdv_duree, t.rdv_reponse], ['texte', null, null, null]);
  // Sans discussion ouverte, pas d'entretien
  await refuse(q(LAU2, `insert into public.messages (author_id, dest_id, type, rdv_at, rdv_duree) values ($1, $2, 'rdv', $3, 30)`, [LAU2, ETU4, demain()]), /pas encore ouverte/);
  // Notification au destinataire : l'entretien (catégorie Messages : couper Match ne le fait pas rater), pas un « message » de plus
  const p = (await file()).filter(x => x.qui === 'ETU_RDV');
  assert.deepEqual(p.map(x => `${x.qui}:${x.kind}`), ['ETU_RDV:rdv_message', 'ETU_RDV:rdv_message']);
  assert.deepEqual({ ...p[0].data, rdv_at: undefined }, { nom: 'Youssef', de: LAU, m: m.id, duree: 30, lieu: null, rdv_at: undefined });
  assert.equal(new Date(p[0].data.rdv_at).getTime(), new Date(m.rdv_at).getTime());
  assert.equal(p[1].data.lieu, 'Siège OCP, Casablanca');
  // Répondre : seulement le destinataire, oui ou autre ; on peut changer d'avis tant que c'est à venir
  await vider();
  const repondre = (u, id, r) => q(u, 'select * from public.repondre_rdv($1, $2)', [id, r]).then(x => x[0]);
  await refuse(repondre(LAU, m.id, 'oui'), /non autorisée/);
  await refuse(repondre(ETU2, m.id, 'oui'), /non autorisée/);
  await refuse(repondre(ETU_RDV, m.id, 'peut-etre'), /Réponse invalide/);
  await refuse(repondre(ETU_RDV, t.id, 'oui'), /non autorisée/, 'pas un entretien');
  const r1 = await repondre(ETU_RDV, m.id, 'oui');
  assert.equal(r1.rdv_reponse, 'oui'); assert.equal(r1.id, m.id);
  await repondre(ETU_RDV, m.id, 'oui');
  const r2 = await repondre(ETU_RDV, m.id, 'autre');
  assert.equal(r2.rdv_reponse, 'autre');
  const rep = await file('rdv_reponse');
  assert.deepEqual(rep.map(x => [x.qui, x.data.reponse, x.data.nom, x.data.de, x.data.m]), [['LAU', 'oui', 'Adam', ETU_RDV, m.id], ['LAU', 'autre', 'Adam', ETU_RDV, m.id]],
    'une notification par réponse qui change');
  // Directement dans la table : rien ne change (seulement par repondre_rdv) ; l'auteur ne réécrit pas son entretien
  await q(ETU_RDV, `update public.messages set rdv_reponse = 'oui' where id = $1`, [m.id]);
  await q(LAU, `update public.messages set rdv_at = now() + interval '3 days', rdv_reponse = 'oui' where id = $1`, [m.id]);
  const lu = (await db.query('select rdv_reponse, rdv_at from public.messages where id = $1', [m.id])).rows[0];
  assert.equal(lu.rdv_reponse, 'autre'); assert.equal(lu.rdv_at.getTime(), new Date(m.rdv_at).getTime());
  // Passé : plus de réponse
  await db.query(`update public.messages set rdv_at = now() - interval '1 hour' where id = $1`, [m.id]);
  await refuse(repondre(ETU_RDV, m.id, 'oui'), /déjà passé/);
  // Bloqué : plus de réponse
  await q(ETU_RDV, `insert into public.blocages (bloque_id) values ($1)`, [LAU]);
  await refuse(repondre(ETU_RDV, surPlace.id, 'oui'), /ne pouvez plus vous écrire/);
  await q(ETU_RDV, `delete from public.blocages where bloque_id = $1`, [LAU]);
});

test('catégorie « Match » coupée dans Mon profil : ni intérêt, ni match ; les messages et les entretiens continuent', async () => {
  const choisirNotif = (u, v) => db.query('update public.profiles set notif_push = $2::jsonb where id = $1', [u, JSON.stringify(v)]);
  await choisirNotif(LAU3, { match: false }); await choisirNotif(ETU4, { match: false });
  await vider();
  // Omar (catégorie coupée) dit oui à l'offre de Nadia (catégorie coupée) : pas d'intérêt ; Nadia dit oui : pas de match
  await choisir(ETU4, { offre: O.lau3 });
  assert.deepEqual(await matchsDe(ETU4, LAU3), []);
  assert.deepEqual(await file('match_interet'), []);
  await choisir(LAU3, { profil: ETU4 }, 'plus_tard'); await choisir(LAU3, { profil: ETU4 });
  assert.equal((await matchsDe(ETU4, LAU3)).length, 1, 'le match se fait quand même');
  assert.deepEqual(await file(), []);
  await q(LAU3, `insert into public.messages (author_id, dest_id, type, rdv_at, rdv_duree) values ($1, $2, 'rdv', $3, 15)`, [LAU3, ETU4, demain()]);
  await q(LAU3, `insert into public.messages (author_id, dest_id, body) values ($1, $2, 'À demain !')`, [LAU3, ETU4]);
  assert.deepEqual((await file()).map(x => `${x.qui}:${x.kind}`), ['ETU4:rdv_message', 'ETU4:message'], 'un entretien proposé est un message');
  // La case « Messages » coupée : ni message, ni entretien
  await choisirNotif(ETU4, { match: false, messages: false });
  await vider();
  await q(LAU3, `insert into public.messages (author_id, dest_id, type, rdv_at, rdv_duree) values ($1, $2, 'rdv', $3, 30)`, [LAU3, ETU4, demain()]);
  assert.deepEqual(await file(), []);
  // La base accepte la case ; une valeur qui n'est pas un booléen non
  await q(ETU4, `update public.profiles set notif_push = '{"match": true}' where id = $1`, [ETU4]);
  await refuse(q(ETU4, `update public.profiles set notif_push = '{"match": "non"}' where id = $1`, [ETU4]), /notif_push/);
  assert.equal((await db.query(`select public.push_categorie('match_interet') c`)).rows[0].c, 'match');
  assert.deepEqual((await db.query(`select public.push_categorie('rdv_message') a, public.push_categorie('rdv_reponse') b`)).rows[0], { a: 'messages', b: 'messages' });
  assert.equal((await db.query('select public.push_voulu($1, $2) v', [ETU, 'match'])).rows[0].v, true, 'activée par défaut');
  await choisirNotif(LAU3, {}); await choisirNotif(ETU4, {});
});

test('profil : « Apparaître dans Match » (vrai par défaut), lisible de tous dans la vue, changé par soi seulement', async () => {
  const vu = async (u, id) => (await q(u, 'select match_visible from public.profils where id = $1', [id]))[0].match_visible;
  assert.equal(await vu(LAU, ETU), true);
  assert.equal(await vu(LAU, CACHE), false);
  await q(ETU2, 'update public.profiles set match_visible = false where id = $1', [ETU2]);
  assert.equal(await vu(LAU, ETU2), false);
  await q(ETU, 'update public.profiles set match_visible = true where id = $1', [ETU2]);
  assert.equal(await vu(LAU, ETU2), false, 'pas le profil d’un autre');
  await refuse(choisir(LAU3, { profil: ETU2 }), /pas proposé dans Match/);
  await q(ETU2, 'update public.profiles set match_visible = true where id = $1', [ETU2]);
});

test('anti-spam : 80 choix au plus en 24 heures ; changer d’avis sur une carte ne compte pas de plus', async () => {
  await db.query(`insert into public.offers (author_id, type, titre, entreprise, description, annees) select $1, 'pfe', 'Offre en série ' || g, 'Lear', 'd', '{5}' from generate_series(1, 81) g`, [LAU3]);
  const ids = (await db.query(`select id from public.offers where titre like 'Offre en série %' order by titre`)).rows.map(r => r.id);
  const deja = (await db.query(`select count(*)::int n from public.match_choix where user_id = $1`, [ETU2])).rows[0].n;
  for (const id of ids.slice(0, 80 - deja)) await choisir(ETU2, { offre: id }, 'plus_tard');
  await refuse(choisir(ETU2, { offre: ids[80] }), /80 choix aujourd’hui/);
  await choisir(ETU2, { offre: ids[0] }, 'oui');
  // Le lendemain : de nouveau possible
  await db.query(`update public.match_choix set updated_at = updated_at - interval '25 hours' where user_id = $1`, [ETU2]);
  await choisir(ETU2, { offre: ids[80] });
});

test('mise à jour relancée : rien de perdu, un seul déclencheur, l’ancienne règle des fichiers remplacée', async () => {
  const avant = (await db.query('select count(*)::int n from public.matchs')).rows[0].n;
  const choix = (await db.query('select count(*)::int n from public.match_choix')).rows[0].n;
  await db.exec(fs.readFileSync(SCHEMA, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, ''));
  assert.equal((await db.query('select count(*)::int n from public.matchs')).rows[0].n, avant);
  assert.equal((await db.query('select count(*)::int n from public.match_choix')).rows[0].n, choix);
  for (const t of ['trg_protect_match_choix', 'trg_match_apres_choix', 'trg_protect_match']) {
    assert.equal((await db.query('select count(*)::int n from pg_trigger where tgname = $1', [t])).rows[0].n, 1, t);
  }
  const regles = (await db.query(`select conname, pg_get_constraintdef(oid) d from pg_constraint where conrelid = 'public.messages'::regclass and pg_get_constraintdef(oid) ilike '%fichier is not null%'`)).rows;
  assert.deepEqual(regles.map(r => r.conname), ['messages_fichier_requis']);
  // Une photo sans fichier reste refusée
  await refuse(q(ETU, `insert into public.messages (author_id, dest_id, type) values ($1, $2, 'photo')`, [ETU, LAU]), /messages_fichier_requis/);
});
