// La veille à 19:30 (veille_push) : le rendez-vous de mentorat ou l'entretien de demain (P3), l'agenda de demain (P4),
// l'après-rendez-vous (P8) et les groupes actifs du jour (P11d) ; la présence confirmée au rendez-vous (P11c, tout de suite).
// Chaque fois : le cas qui part, chaque exclusion, deuxième passage = rien.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid, reglerHorloge, aujourdhuiA } from './banc-sql.mjs';
import { autoGroups, groupLabel } from '../../src/logic.js';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const GI = 'Génie Industriel et Productique', GC = 'Génie Civil';
const ETU = uid(1301), ETU2 = uid(1302), ETU3 = uid(1303), LAU = uid(1304), LAU2 = uid(1305), LAU3 = uid(1306), ADMIN = uid(1307);
const NOMS = { [ETU]: 'ETU', [ETU2]: 'ETU2', [ETU3]: 'ETU3', [LAU]: 'LAU', [LAU2]: 'LAU2', [LAU3]: 'LAU3', [ADMIN]: 'ADMIN' };
const VEILLE = aujourdhuiA(19, 30);
const demainA = (h, m = 0) => aujourdhuiA(h, m, 1);
const iso = t => new Date(t).toISOString();

const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const un = async (sql, p) => (await db.query(sql, p)).rows[0];
const vider = () => db.query('delete from public.push_queue');
const file = async kind => (await db.query('select user_id, data from public.push_queue where kind = $1 order by id', [kind])).rows
  .map(r => ({ qui: NOMS[r.user_id] || r.user_id, data: r.data }));
const lancer = async f => { await vider(); return (await un(`select public.${f}() n`)).n; };
const choisir = (u, v) => db.query('update public.profiles set notif_push = $2::jsonb where id = $1', [u, JSON.stringify(v)]);
// Un mentorat accepté, avec son rendez-vous (posé directement : les règles d'acceptation sont testées dans test-mentorat)
const mentorat = async (etu, lau, rdv, sujet = 'Préparer un entretien') => {
  const { id } = await un(`insert into public.mentorships (student_id, mentor_id, sujet, creneaux) values ($1, $2, $3, $4) returning id`, [etu, lau, sujet, [rdv]]);
  await db.query(`update public.mentorships set status = 'acceptee', rdv_at = $2 where id = $1`, [id, rdv]);
  return id;
};
const entretien = async (de, a, rdv, champs = {}) => (await un(`insert into public.messages (author_id, dest_id, type, rdv_at, rdv_duree, rdv_lieu, rdv_lien)
  values ($1, $2, 'rdv', $3, $4, $5, $6) returning id`, [de, a, rdv, champs.duree || 30, champs.lieu || null, champs.lien || null])).id;

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ETU, full_name: 'Salma Bennani', role: 'etudiant', filiere: GI, promo: S + 1, ville: 'Casablanca' });
  await creerCompte(db, { id: ETU2, full_name: 'Hiba Alaoui', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: ETU3, full_name: 'Imane Kettani', role: 'etudiant', filiere: GC, promo: S + 2, ville: 'Rabat' });
  await creerCompte(db, { id: LAU, full_name: 'Youssef Amrani', role: 'laureat', filiere: GI, promo: 2015, entreprise: 'Renault', ville: 'Casablanca' });
  await creerCompte(db, { id: LAU2, full_name: 'Karim Tazi', role: 'laureat', filiere: GI, promo: 2018, entreprise: 'OCP' });
  await creerCompte(db, { id: LAU3, full_name: 'Nadia Berrada', role: 'laureat', filiere: GC, promo: 2016, ville: 'casablanca ', pays: 'France' });
  await creerCompte(db, { id: ADMIN, full_name: 'Admin École', role: 'etudiant', filiere: GI, promo: 2010, ville: 'Casablanca' });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://push.example/' || id, 'k', 'a' from public.profiles`);
  await reglerHorloge(db, VEILLE);
});

test('P3 rendez-vous de mentorat demain : les deux personnes ; déplacé : une nouvelle veille ; deuxième passage : rien', async () => {
  const m = await mentorat(ETU, LAU, demainA(10));
  // Pas acceptés, annulés, ou pas demain : rien
  await un(`insert into public.mentorships (student_id, mentor_id, sujet, creneaux) values ($1, $2, 'Relire mon CV', $3) returning id`, [ETU2, LAU, [demainA(11)]]);
  const annule = await mentorat(ETU2, LAU2, demainA(12));
  await db.query(`update public.mentorships set status = 'annulee' where id = $1`, [annule]);
  await mentorat(ETU3, LAU2, aujourdhuiA(10, 0, 2));
  assert.equal(await lancer('rdv_demain_push'), 2);
  const f = await file('rdv_demain');
  assert.deepEqual(f.map(x => [x.qui, x.data.nom, x.data.sujet, iso(x.data.rdv_at), x.data.m, x.data.n]),
    [['ETU', 'Youssef Amrani', 'Préparer un entretien', demainA(10), m, 1], ['LAU', 'Salma Bennani', 'Préparer un entretien', demainA(10), m, 1]]);
  assert.equal(await lancer('rdv_demain_push'), 0, 'deuxième passage : rien');
  await db.query(`update public.mentorships set rdv_at = $2 where id = $1`, [m, demainA(15)]);
  assert.equal(await lancer('rdv_demain_push'), 2, 'déplacé : une nouvelle veille, avec le nouvel horaire');
  assert.ok((await file('rdv_demain')).every(x => iso(x.data.rdv_at) === demainA(15)));
  assert.equal(await lancer('rdv_demain_push'), 0);
});

test('P3 deux rendez-vous le même lendemain : une notification (n = 2, le premier en détail) ; catégorie coupée : rien', async () => {
  const m1 = await mentorat(ETU2, LAU, demainA(9), 'Choisir mon PFE');
  await mentorat(ETU2, LAU2, demainA(14), 'Préparer un entretien chez OCP');
  await choisir(LAU2, { mentorat: false });
  assert.equal(await lancer('rdv_demain_push'), 2);
  const f = Object.fromEntries((await file('rdv_demain')).map(x => [x.qui, x.data]));
  assert.deepEqual(Object.keys(f).sort(), ['ETU2', 'LAU'], 'Karim a coupé « Mentorat » : rien pour lui');
  assert.equal(f.ETU2.n, 2); assert.equal(f.ETU2.m, m1); assert.equal(f.ETU2.nom, 'Youssef Amrani'); assert.equal(iso(f.ETU2.rdv_at), demainA(9));
  assert.equal(f.LAU.n, 1);
  await choisir(LAU2, {});
});

test('P3 entretien demain dans une discussion : les deux ; refusé, remplacé ou entre membres bloqués : rien ; deuxième passage : rien', async () => {
  const e = await entretien(LAU, ETU, demainA(10), { duree: 30, lieu: 'Usine Renault, Tanger' });
  assert.equal(await lancer('entretien_demain_push'), 2);
  const f = Object.fromEntries((await file('entretien_demain')).map(x => [x.qui, x.data]));
  assert.deepEqual({ ...f.ETU, rdv_at: iso(f.ETU.rdv_at) }, { nom: 'Youssef', rdv_at: demainA(10), duree: 30, lieu: 'Usine Renault, Tanger', visio: false, m: e, de: LAU, n: 1 });
  assert.deepEqual({ ...f.LAU, rdv_at: iso(f.LAU.rdv_at) }, { nom: 'Salma', rdv_at: demainA(10), duree: 30, lieu: 'Usine Renault, Tanger', visio: false, m: e, de: ETU, n: 1 });
  assert.equal(await lancer('entretien_demain_push'), 0, 'deuxième passage : rien');
  // En visio : pas de lieu, visio vrai
  const v = await entretien(LAU2, ETU2, demainA(11), { duree: 15, lien: 'https://meet.example/abc' });
  assert.equal(await lancer('entretien_demain_push'), 2);
  assert.deepEqual((await file('entretien_demain')).filter(x => x.qui === 'ETU2').map(x => [x.data.visio, x.data.lieu, x.data.duree, x.data.m]), [[true, undefined, 15, v]]);
  // Refusé (« un autre moment ») : rien
  const r = await entretien(LAU, ETU3, demainA(16));
  await db.query(`update public.messages set rdv_reponse = 'autre' where id = $1`, [r]);
  // Remplacé par un horaire plus récent dans la même discussion : seulement le dernier
  await entretien(LAU3, ETU3, demainA(9));
  await new Promise(res => setTimeout(res, 5));
  const r2 = await entretien(ETU3, LAU3, demainA(17));
  // Entre membres bloqués : rien
  await entretien(LAU2, ETU, demainA(12));
  await db.query('insert into public.blocages (user_id, bloque_id) values ($1, $2)', [ETU, LAU2]);
  assert.equal(await lancer('entretien_demain_push'), 2);
  assert.deepEqual((await file('entretien_demain')).map(x => [x.qui, x.data.m]).sort(), [['ETU3', r2], ['LAU3', r2]]);
  await db.query('delete from public.blocages');
});

test('P4 agenda de demain : inscrits (le vrai nombre), pas l’organisateur ; annulé ou pas inscrit : rien ; deux le même jour : n = 2', async () => {
  const [ev] = (await db.query(`insert into public.evenements (author_id, titre, type, debut, lieu) values ($1, 'Forum entreprises', 'forum', $2, 'Amphi A') returning id`, [LAU2, demainA(18)])).rows;
  const [annule] = (await db.query(`insert into public.evenements (author_id, titre, type, debut, lieu) values ($1, 'Atelier CV', 'atelier', $2, 'Salle 3') returning id`, [ADMIN, demainA(15)])).rows;
  for (const u of [ETU, ETU2, LAU2]) await db.query('insert into public.evenement_participants (evenement_id, user_id) values ($1, $2)', [ev.id, u]);
  await db.query('insert into public.evenement_participants (evenement_id, user_id) values ($1, $2)', [annule.id, ETU3]);
  await db.query('update public.evenements set annule = true where id = $1', [annule.id]);
  // Un café demain à Casablanca, organisé par Youssef (inscrit d'office) : Salma y va aussi
  const [c] = (await db.query(`insert into public.cafes (organisateur_id, ville, lieu, date_at) values ($1, 'Casablanca', 'Café de la gare', $2) returning id`, [LAU, demainA(19)])).rows;
  await db.query('insert into public.cafe_participants (cafe_id, user_id) values ($1, $2)', [c.id, ETU]);
  assert.equal(await lancer('agenda_demain_push'), 2, 'Salma et Hiba ; ni Karim (il organise), ni Youssef (il organise le café), ni Imane (annulé)');
  const f = Object.fromEntries((await file('agenda_demain')).map(x => [x.qui, { ...x.data, debut: iso(x.data.debut) }]));
  assert.deepEqual(f.ETU2, { type: 'evenement', titre: 'Forum entreprises', debut: demainA(18), lieu: 'Amphi A', inscrits: 3, id: ev.id, n: 1 });
  assert.deepEqual(f.ETU, { type: 'evenement', titre: 'Forum entreprises', debut: demainA(18), lieu: 'Amphi A', inscrits: 3, id: ev.id, n: 2 }, 'le forum puis le café : le premier en détail');
  assert.equal(await lancer('agenda_demain_push'), 0, 'deuxième passage : rien');
  // Un café seul : sa ville, son vrai nombre d'inscrits
  const [c2] = (await db.query(`insert into public.cafes (organisateur_id, ville, lieu, date_at) values ($1, 'Rabat', 'Café Agdal', $2) returning id`, [LAU3, demainA(10)])).rows;
  await db.query('insert into public.cafe_participants (cafe_id, user_id) values ($1, $2)', [c2.id, ETU3]);
  assert.equal(await lancer('agenda_demain_push'), 1);
  assert.deepEqual((await file('agenda_demain')).map(x => [x.qui, { ...x.data, debut: iso(x.data.debut) }]),
    [['ETU3', { type: 'cafe', debut: demainA(10), lieu: 'Café Agdal', ville: 'Rabat', inscrits: 2, id: c2.id, n: 1 }]]);
});

test('P8 après le rendez-vous : l’étudiant (pas encore remercié) et le lauréat ; merci donné : le lauréat seul ; annulé, terminé ou trop tôt : rien', async () => {
  const hier = new Date(Date.now() - 20 * 36e5).toISOString();
  const m = await mentorat(ETU, LAU2, hier, 'Négocier mon salaire');
  const m2 = await mentorat(ETU2, LAU3, hier, 'Partir en France');
  await db.query(`update public.mentorships set merci = 'Merci pour tes conseils' where id = $1`, [m2]);
  const annule = await mentorat(ETU3, LAU, hier);
  await db.query(`update public.mentorships set status = 'annulee' where id = $1`, [annule]);
  const fini = await mentorat(ETU3, LAU2, hier, 'Choisir une option');
  await db.query(`update public.mentorships set status = 'terminee' where id = $1`, [fini]);
  await mentorat(ETU2, LAU, new Date(Date.now() - 30 * 6e4).toISOString(), 'Trop tôt');      // il y a 30 min
  await mentorat(ETU2, LAU2, new Date(Date.now() - 40 * 36e5).toISOString(), 'Trop tard');   // il y a 40 h
  assert.equal(await lancer('apres_rdv_push'), 3);
  assert.deepEqual((await file('apres_rdv')).map(x => [x.qui, x.data]).sort((a, b) => a[0].localeCompare(b[0])), [
    ['ETU', { nom: 'Karim', sujet: 'Négocier mon salaire', m, pour: 'demandeur' }],
    ['LAU2', { nom: 'Salma', sujet: 'Négocier mon salaire', m, pour: 'mentor' }],
    ['LAU3', { nom: 'Hiba', sujet: 'Partir en France', m: m2, pour: 'mentor' }]]);
  assert.equal(await lancer('apres_rdv_push'), 0, 'deuxième passage : rien');
});

test('P11c « Je serai là » : le lauréat le sait tout de suite, une fois ; un nouvel horaire, une nouvelle confirmation', async () => {
  const m = await mentorat(ETU2, LAU, aujourdhuiA(10, 0, 3), 'Mon premier entretien');
  await vider();
  await q(ETU2, 'update public.mentorships set confirme_at = now() where id = $1', [m]);
  const f = await file('mentorat_presence');
  assert.deepEqual(f.map(x => [x.qui, x.data.nom, x.data.sujet, iso(x.data.rdv_at), x.data.m]), [['LAU', 'Hiba', 'Mon premier entretien', aujourdhuiA(10, 0, 3), m]]);
  await q(ETU2, 'update public.mentorships set confirme_at = now() where id = $1', [m]);
  assert.equal((await file('mentorat_presence')).length, 1, 'déjà confirmé : rien de plus');
  // Le lauréat déplace le rendez-vous : la confirmation tombe ; confirmée de nouveau, il le sait de nouveau
  await q(LAU, 'update public.mentorships set rdv_at = $2 where id = $1', [m, aujourdhuiA(11, 0, 4)]);
  await vider();
  await q(ETU2, 'update public.mentorships set confirme_at = now() where id = $1', [m]);
  assert.deepEqual((await file('mentorat_presence')).map(x => iso(x.data.rdv_at)), [aujourdhuiA(11, 0, 4)]);
});

test('P11d groupes actifs du jour : messages des autres depuis sa dernière visite, le groupe le plus actif et le nombre d’autres ; une fois par jour', async () => {
  // Un autre jour : le budget est libre (les veilles plus haut l'ont rempli pour Youssef, et une DOUCE attend)
  await db.query('delete from public.notif_programme');
  for (const u of Object.keys(NOMS)) await db.query(`insert into public.visites (user_id, vu_at) values ($1, now() - interval '2 days') on conflict (user_id) do update set vu_at = excluded.vu_at`, [u]);
  const ecrire = (u, groupe, body) => db.query(`insert into public.groupe_messages (groupe, author_id, body) values ($1, $2, $3)`, [groupe, u, body]);
  const PEI = 'filiere:electro-industriel', CASA = 'ville:casablanca';
  for (const t of ['Qui va au forum ?', 'Un PFE chez OCP à partager', 'Réunion jeudi']) await ecrire(LAU2, PEI, t);
  await ecrire(LAU, CASA, 'Café vendredi à Maârif ?');
  await db.query(`insert into public.groupe_messages (groupe, author_id, body, created_at) values ($1, $2, 'Vieux message', now() - interval '30 hours')`, [CASA, LAU3]);
  await db.query(`insert into public.groupe_membres (groupe, user_id) values ($1, $2)`, [CASA, LAU2]);   // Karim suit le groupe de Casablanca
  await db.query(`update public.visites set vu_at = now() - interval '10 minutes' where user_id = $1`, [ETU2]);
  assert.equal(await lancer('groupe_jour_push'), 4);
  const f = Object.fromEntries((await file('groupe_jour')).map(x => [x.qui, x.data]));
  assert.deepEqual(f.LAU3, { n: 1, groupe: 'Casablanca', gkey: CASA, autres: 0 }, 'Nadia (« casablanca », écrit autrement) : le même groupe ; son vieux message ne compte pas');
  assert.deepEqual(f.ETU, { n: 3, groupe: 'Électro-industriel', gkey: PEI, autres: 1 }, 'Salma : son parcours (3 messages), et Casablanca');
  assert.deepEqual(f.LAU, { n: 3, groupe: 'Électro-industriel', gkey: PEI, autres: 0 }, 'Youssef : pas son propre message');
  assert.deepEqual(f.LAU2, { n: 1, groupe: 'Casablanca', gkey: CASA, autres: 0 }, 'Karim : le groupe qu’il suit (pas ses propres messages)');
  assert.equal(f.ETU2, undefined, 'Hiba est venue après les messages');
  assert.equal(f.ADMIN, undefined, 'jamais l’administration');
  assert.equal(await lancer('groupe_jour_push'), 0, 'une fois par jour');
  // Le lendemain : Salma bloque Karim ; il reste Casablanca
  await db.query('delete from public.notif_programme');
  await db.query('insert into public.blocages (user_id, bloque_id) values ($1, $2)', [ETU, LAU2]);
  await lancer('groupe_jour_push');
  assert.deepEqual((await file('groupe_jour')).filter(x => x.qui === 'ETU').map(x => x.data), [{ n: 1, groupe: 'Casablanca', gkey: CASA, autres: 0 }]);
  await db.query('delete from public.blocages');
});

test('P11d les groupes de la base sont ceux de l’application (autoGroups, groupLabel)', async () => {
  const profils = (await db.query('select id, role, filiere, ville, pays from public.profiles')).rows;
  for (const p of profils) {
    const sql = (await un('select public.groupes_auto($1, $2, $3) g', [p.filiere, p.ville, p.pays])).g;
    assert.deepEqual(sql, autoGroups(p), NOMS[p.id]);
  }
  for (const f of ['Génie Mécanique : Énergétique', 'Génie Informatique & IA', 'Intelligence Artificielle et Technologies des Données : Systèmes Industriels', 'Classes préparatoires intégrées']) {
    assert.deepEqual((await un('select public.groupes_auto($1, null, null) g', [f])).g, autoGroups({ filiere: f }), f);
  }
  const data = { profiles: profils };
  for (const k of ['filiere:electro-industriel', 'filiere:civil', 'ville:casablanca', 'ville:rabat', 'pays:france', 'ville:inconnue']) {
    assert.equal((await un('select public.nom_groupe($1) n', [k])).n, groupLabel(data, k), k);
  }
});

test('veille_push : les cinq parties, dans l’ordre du contrat (les DURES avant la DOUCE) ; rien deux fois', async () => {
  const src = (await un(`select prosrc from pg_proc where proname = 'veille_push'`)).prosrc;
  const ordre = ['rdv_demain_push', 'entretien_demain_push', 'agenda_demain_push', 'apres_rdv_push', 'groupe_jour_push'];
  assert.deepEqual(ordre.map(f => src.indexOf(f)).every((p, i, a) => p > 0 && (i === 0 || p > a[i - 1])), true, src);
  // Tout est oublié : chaque partie a de nouveau quelque chose à envoyer
  await db.exec('delete from public.veilles_envoyees; delete from public.notif_programme;');
  await vider();
  const n = (await un('select public.veille_push() n')).n;
  const kinds = (await db.query('select distinct kind from public.push_queue')).rows.map(r => r.kind).sort();
  assert.equal(n, (await un('select count(*)::int n from public.push_queue')).n, 'le nombre rendu : les lignes mises en file');
  assert.deepEqual(kinds, ['agenda_demain', 'apres_rdv', 'entretien_demain', 'groupe_jour', 'rdv_demain']);
  await vider();
  assert.equal((await un('select public.veille_push() n')).n, 0, 'deuxième passage : rien');
});
