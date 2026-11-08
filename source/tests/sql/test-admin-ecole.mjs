// Administration d'une école (rôle admin d'une école autre que l'ENSAM Meknès) : elle ne voit et ne fait que ce qui est de
// son école — les comptes, les contenus privés des membres, les messages signalés et les fichiers du chat, la liste
// officielle, ce que sa console écrit, les notifications. Les réglages de l'ENSAM Meknès, le suivi du réseau, le guide
// de l'étranger (commun à toutes les écoles) et la santé des notifications restent à l'administration du réseau (admin
// de l'ENSAM Meknès), qui garde tout. Pour un membre, rien ne change.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const GI = 'Génie Industriel';
const RESEAU = uid(9801), AC = uid(9802);                  // administration du réseau ; administration de l'ENSAM Casablanca
const EM = uid(9811), LM = uid(9812), EM2 = uid(9813);     // Meknès : une étudiante, un lauréat, un étudiant
const EC = uid(9821), LC = uid(9822), EC2 = uid(9823);     // Casablanca : un étudiant, une lauréate, une étudiante
const M = { ecole: 'ensam-meknes', etu: EM, lau: LM, etu2: EM2 };
const C = { ecole: 'ensam-casa', etu: EC, lau: LC, etu2: EC2 };

const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
// Essayé puis annulé : ce que l'action rend, sans rien garder (la base reste la même pour les tests suivants)
const ANNULE = Symbol('annulé');
const dans = async (u, fn) => {
  let r;
  await en(db, u, async tx => { r = await fn(tx); throw ANNULE; }).catch(e => { if (e !== ANNULE) throw e; });
  return r;
};
const essai = (u, sql, p) => dans(u, tx => tx.query(sql, p).then(r => r.rows));
const refuse = (promesse, re) => assert.rejects(promesse, re);
const ids = rows => rows.map(r => r.id).sort();
const prevenus = async kind => (await db.query('select user_id from public.push_queue where kind = $1 order by user_id', [kind])).rows.map(r => r.user_id);

// Les lignes de chaque école, posées directement (comme la base les aurait)
const un = async (sql, p) => (await db.query(sql, p)).rows[0]?.id;
async function poser(s) {
  const { ecole, etu, lau, etu2 } = s;
  const o = {};
  o.offre = await un(`insert into public.offers (author_id, type, titre, entreprise, description, ecole) values ($1, 'stage', 'Stage en logistique', 'Atlas Industrie', 'Six mois sur la chaîne logistique.', $2) returning id`, [lau, ecole]);
  o.demande = await un(`insert into public.demandes (auteur_id, type, titre, details, ecole) values ($1, 'stage', 'Cherche un stage', 'Un stage de fin d’études en logistique, dès juin.', $2) returning id`, [etu, ecole]);
  o.mentorat = await un(`insert into public.mentorships (student_id, mentor_id, sujet, status, ecole) values ($1, $2, 'Préparer un entretien', 'acceptee', $3) returning id`, [etu, lau, ecole]);
  o.relecture = await un(`insert into public.relectures_cv (student_id, reviewer_id, cv_path, status, ecole) values ($1, $2, $3, 'en_cours', $4) returning id`, [etu, lau, `${etu}/cv.pdf`, ecole]);
  o.applications = await un(`insert into public.applications (student_id, offer_id, entreprise) values ($1, $2, 'Atlas Industrie') returning id`, [etu, o.offre]);
  o.attestations = await un(`insert into public.attestations (laureat_id) values ($1) returning id`, [lau]);
  o.avis_stage = await un(`insert into public.avis_stage (author_id, entreprise, saison, note, ecole) values ($1, 'Atlas Industrie', 2025, 4, $2) returning id`, [etu, ecole]);
  o.entretiens = await un(`insert into public.entretiens (author_id, entreprise, questions, ecole) values ($1, 'Atlas Industrie', '{"Parle-moi de toi"}', $2) returning id`, [etu, ecole]);
  o.enquetes_insertion = await un(`insert into public.enquetes_insertion (user_id, vague, promo, situation, ecole) values ($1, 6, 2016, 'emploi', $2) returning id`, [lau, ecole]);
  o.blocages = await un(`insert into public.blocages (user_id, bloque_id) values ($1, $2) returning id`, [etu2, lau]);
  await db.query(`insert into public.coordonnees (id, telephone) values ($1, '0600000000') on conflict (id) do update set telephone = excluded.telephone`, [lau]);
  o.coordonnees = lau;
  o.demandes_contact = await un(`insert into public.demandes_contact (demandeur_id, cible_id) values ($1, $2) returning id`, [etu, lau]);
  o.invitations = await un(`insert into public.invitations (laureat_id, student_id, offer_id) values ($1, $2, $3) returning id`, [lau, etu, o.offre]);
  await db.query(`insert into public.liens_rdv (id, lien) values ($1, 'https://meet.exemple.ma/rdv')`, [o.mentorat]);
  o.liens_rdv = o.mentorat;
  o.matchs = await un(`insert into public.matchs (etudiant_id, laureat_id) values ($1, $2) returning id`, [etu, lau]);
  o.parrainages = await un(`insert into public.parrainages (filleul_id, parrain_id, saison) values ($1, $2, 2020) returning id`, [etu, lau]);
  o.propositions = await un(`insert into public.propositions (demande_id, laureat_id, aide, entreprise, message) values ($1, $2, 'recrute', 'Atlas Industrie', 'Je peux te prendre en stage cet été.') returning id`, [o.demande, lau]);
  o.retours_cv = await un(`insert into public.retours_cv (profil_id, auteur_id) values ($1, $2) returning id`, [etu, lau]);
  o.relecture_commentaires = await un(`insert into public.relecture_commentaires (relecture_id, author_id, body) values ($1, $2, 'Bonne structure.') returning id`, [o.relecture, lau]);
  o.comments = await un(`insert into public.comments (offer_id, author_id, body) values ($1, $2, 'Intéressée !') returning id`, [o.offre, etu]);
  o.reactions_publiques = await un(`insert into public.reactions_publiques (offer_id, user_id, emoji) values ($1, $2, '👍') returning id`, [o.offre, etu]);
  o.reponses_demandes = await un(`insert into public.reponses_demandes (demande_id, author_id, body) values ($1, $2, 'Regarde chez nous.') returning id`, [o.demande, lau]);
  o.messages = await un(`insert into public.messages (author_id, dest_id, body) values ($1, $2, 'Bonjour') returning id`, [etu, lau]);
  o.fichier = `${etu}/${lau}/photo.webp`;
  o.photo = await un(`insert into public.messages (author_id, dest_id, type, fichier) values ($1, $2, 'photo', $3) returning id`, [etu, lau, o.fichier]);
  // Le lauréat signale les deux messages : l'administration peut alors les lire
  o.signalements = await un(`insert into public.signalements (auteur_id, cible_type, cible_id, motif) values ($1, 'prive', $2, 'harcelement') returning id`, [lau, o.messages]);
  await db.query(`insert into public.signalements (auteur_id, cible_type, cible_id, motif) values ($1, 'prive', $2, 'inapproprie')`, [lau, o.photo]);
  o.liste = await un(`insert into public.liste_officielle (nom, promo, filiere, ecole) values ($1, 2016, $2, $3) returning id`, ['Nom ' + ecole, GI, ecole]);
  o.cv = `${etu}/cv.pdf`; o.photo_profil = `${etu}/photo.webp`;
  await db.query(`insert into storage.objects (bucket_id, name) values ('cv', $1), ('photos', $2), ('chat', $3)`, [o.cv, o.photo_profil, o.fichier]);
  o.cafe = await un(`insert into public.cafes (organisateur_id, ville, lieu, date_at, ecole) values ($1, 'Rabat', 'Café central', now() + interval '6 days', $2) returning id`, [lau, ecole]);
  o.evenement = await un(`insert into public.evenements (author_id, titre, debut, ecole) values ($1, 'Forum des métiers', now() + interval '8 days', $2) returning id`, [RESEAU, ecole]);
  return o;
}

// Les tables privées : qui, parmi les membres de l'école, voit la ligne (etu, lau, etu2) ; ce que l'administration y
// modifie ; si elle peut la supprimer
const PRIVEES = {
  applications: { voient: ['etu', 'lau'], maj: `note = 'Vu'` },
  attestations: { voient: ['lau'], supp: true },
  avis_stage: { voient: ['etu'], maj: `conseils = 'Revu'`, supp: true },
  entretiens: { voient: ['etu'], maj: `conseils = 'Revu'`, supp: true },
  enquetes_insertion: { voient: ['lau'], maj: `secteur = 'Industrie'`, supp: true },
  blocages: { voient: ['etu2'], supp: true },
  coordonnees: { voient: ['lau'] },
  demandes_contact: { voient: ['etu', 'lau'], maj: `status = 'acceptee'`, supp: true },
  invitations: { voient: ['etu', 'lau'], maj: `status = 'declinee'`, supp: true },
  liens_rdv: { voient: ['etu', 'lau'] },
  matchs: { voient: ['etu', 'lau'] },
  parrainages: { voient: ['etu', 'lau'], supp: true },
  propositions: { voient: ['etu', 'lau'], maj: `status = 'close'`, supp: true },
  retours_cv: { voient: ['etu', 'lau'], maj: `status = 'corrige'`, supp: true },
  relecture_commentaires: { voient: ['etu', 'lau'], supp: true },
  signalements: { voient: ['lau'], maj: `status = 'traite'`, supp: true },
  messages: { voient: ['etu', 'lau'], supp: true },
};
let F;
const voit = async (u, table, id) => (await q(u, `select id from public.${table} where id = $1`, [id])).length === 1;

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: RESEAU, full_name: 'Admin Réseau', role: 'etudiant', filiere: GI, promo: 2010, ville: 'Meknès' });
  await creerCompte(db, { id: EM, full_name: 'Salma Meknès', role: 'etudiant', filiere: GI, promo: 2027, ville: 'Meknès' });
  await creerCompte(db, { id: LM, full_name: 'Youssef Meknès', role: 'laureat', filiere: GI, promo: 2016, ville: 'Meknès' });
  await creerCompte(db, { id: EM2, full_name: 'Omar Meknès', role: 'etudiant', filiere: GI, promo: 2027, ville: 'Meknès' });
  // L'ENSAM Casablanca, fermée : ouverte le temps des inscriptions. Son administration habite Meknès (les cafés de la ville).
  await db.query(`update public.ecoles set ouverte = true where slug = 'ensam-casa'`);
  await creerCompte(db, { id: AC, full_name: 'Admin Casa', role: 'etudiant', filiere: GI, promo: 2010, ville: 'Meknès', ecole: 'ensam-casa' });
  await creerCompte(db, { id: EC, full_name: 'Karim Casa', role: 'etudiant', filiere: GI, promo: 2027, ville: 'Casablanca', ecole: 'ensam-casa' });
  await creerCompte(db, { id: LC, full_name: 'Nadia Casa', role: 'laureat', filiere: GI, promo: 2016, ville: 'Casablanca', ecole: 'ensam-casa' });
  await creerCompte(db, { id: EC2, full_name: 'Imane Casa', role: 'etudiant', filiere: GI, promo: 2027, ville: 'Casablanca', ecole: 'ensam-casa' });
  await db.query(`update public.ecoles set ouverte = false where slug = 'ensam-casa'`);
  await db.query(`update public.profiles set role = 'admin' where id = any($1::uuid[])`, [[RESEAU, AC]]);
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://p/' || id, 'k', 'a' from public.profiles on conflict do nothing`);
  F = { m: await poser(M), c: await poser(C) };
});

test('comptes : l’administration de Casablanca ne lit, ne modifie, ne promeut ni ne supprime aucun compte de Meknès ; ceux de son école, oui', async () => {
  const tous = [EM, LM, EM2, EC, LC, EC2];
  assert.deepEqual(ids(await q(AC, 'select id from public.profiles where id = any($1::uuid[])', [tous])), [EC, LC, EC2].sort());
  assert.deepEqual(await essai(AC, `update public.profiles set full_name = 'Modifié' where id = $1 returning id`, [EM]), []);
  // Un compte de Meknès promu admin serait de l'administration du réseau
  assert.deepEqual(await essai(AC, `update public.profiles set role = 'admin' where id = $1 returning id`, [LM]), []);
  assert.deepEqual(await essai(AC, 'delete from public.profiles where id = $1 returning id', [EM]), []);
  // Sans condition non plus : seuls ceux de son école
  assert.deepEqual(ids(await essai(AC, `update public.profiles set bio = 'Revu' returning id`)), [AC, EC, LC, EC2].sort());
  // Son école : vérifier, modifier, supprimer
  assert.deepEqual(await essai(AC, 'update public.profiles set verified = true where id = $1 returning id, verified', [LC]), [{ id: LC, verified: true }]);
  assert.deepEqual(await essai(AC, 'delete from public.profiles where id = $1 returning id', [EC2]), [{ id: EC2 }]);
  // Les comptes de la console : ceux de son école
  assert.deepEqual((await q(AC, 'select id from public.admin_comptes()')).map(r => r.id).sort(), [AC, EC, LC, EC2].sort());
  // L'administration du réseau : tous
  assert.deepEqual(ids(await q(RESEAU, 'select id from public.profiles where id = any($1::uuid[])', [tous])), tous.sort());
  assert.deepEqual(await essai(RESEAU, `update public.profiles set full_name = 'Modifié' where id = $1 returning id`, [EM]), [{ id: EM }]);
  assert.deepEqual(await essai(RESEAU, `update public.profiles set verified = true where id = $1 returning id`, [LC]), [{ id: LC }]);
});

test('contenus privés : rien d’un membre de Meknès à lire, modifier ou supprimer pour l’administration de Casablanca ; ceux de son école, oui', async () => {
  for (const [t, d] of Object.entries(PRIVEES)) {
    assert.equal(await voit(AC, t, F.m[t]), false, `${t} : lue à Meknès`);
    assert.equal(await voit(AC, t, F.c[t]), true, `${t} : pas lue à Casablanca`);
    if (d.maj) {
      assert.deepEqual(await essai(AC, `update public.${t} set ${d.maj} where id = $1 returning id`, [F.m[t]]), [], `${t} : modifiée à Meknès`);
      assert.deepEqual(await essai(AC, `update public.${t} set ${d.maj} where id = $1 returning id`, [F.c[t]]), [{ id: F.c[t] }], `${t} : pas modifiée à Casablanca`);
    }
    if (d.supp) {
      assert.deepEqual(await essai(AC, `delete from public.${t} where id = $1 returning id`, [F.m[t]]), [], `${t} : supprimée à Meknès`);
      assert.deepEqual(await essai(AC, `delete from public.${t} where id = $1 returning id`, [F.c[t]]), [{ id: F.c[t] }], `${t} : pas supprimée à Casablanca`);
    }
  }
  // Toute la table d'un coup : seulement les lignes de son école
  for (const [t, d] of Object.entries(PRIVEES)) {
    if (!d.supp) continue;
    const touchees = await dans(AC, async tx => {
      await tx.query(`delete from public.${t}`);
      await tx.exec('reset role');
      return (await tx.query(`select id from public.${t} where id = any($1::uuid[])`, [[F.m[t], F.c[t]]])).rows.map(r => r.id);
    });
    assert.deepEqual(touchees, [F.m[t]], `${t} : suppression de toute la table`);
  }
});

test('suppressions sous un contenu (commentaires, réactions, réponses) et fichiers : seulement dans son école', async () => {
  for (const t of ['comments', 'reactions_publiques', 'reponses_demandes']) {
    const restent = await dans(AC, async tx => {
      await tx.query(`delete from public.${t}`);
      await tx.exec('reset role');
      return (await tx.query(`select id from public.${t} where id = any($1::uuid[])`, [[F.m[t], F.c[t]]])).rows.map(r => r.id);
    });
    assert.deepEqual(restent, [F.m[t]], `${t} : celle de Meknès doit rester, celle de Casablanca partir`);
  }
  // CV, photos de profil, photos du chat : celles de Meknès restent
  const restent = await dans(AC, async tx => {
    await tx.query(`delete from storage.objects where bucket_id in ('cv', 'photos', 'chat')`);
    await tx.exec('reset role');
    return (await tx.query('select name from storage.objects order by name')).rows.map(r => r.name);
  });
  assert.deepEqual(restent, [F.m.cv, F.m.photo_profil, F.m.fichier].sort());
  // L'administration du réseau : partout
  const rien = await dans(RESEAU, async tx => {
    await tx.query(`delete from storage.objects where bucket_id in ('cv', 'photos', 'chat')`);
    await tx.query('delete from public.comments');
    await tx.exec('reset role');
    return (await tx.query('select (select count(*) from storage.objects)::int + (select count(*) from public.comments)::int n')).rows[0].n;
  });
  assert.equal(rien, 0);
});

test('messages privés signalés et fichiers du chat : l’administration lit ceux de son école ; celle du réseau, tous', async () => {
  const lus = async u => ids(await q(u, 'select id from public.messages where id = any($1::uuid[])', [[F.m.messages, F.m.photo, F.c.messages, F.c.photo]]));
  assert.deepEqual(await lus(AC), [F.c.messages, F.c.photo].sort());
  assert.deepEqual(await lus(RESEAU), [F.m.messages, F.m.photo, F.c.messages, F.c.photo].sort());
  const fichier = async (u, nom) => (await q(u, 'select public.peut_lire_fichier_chat($1) x', [nom]))[0].x;
  assert.equal(await fichier(AC, F.m.fichier), false);
  assert.equal(await fichier(AC, F.c.fichier), true);
  assert.equal(await fichier(RESEAU, F.m.fichier), true);
  assert.equal(await fichier(RESEAU, F.c.fichier), true);
  const objets = async u => (await q(u, `select name from storage.objects where bucket_id = 'chat' order by name`)).map(r => r.name);
  assert.deepEqual(await objets(AC), [F.c.fichier]);
  assert.deepEqual(await objets(RESEAU), [F.m.fichier, F.c.fichier].sort());
  // Les CV : ceux de son école
  const cv = async (u, nom) => (await q(u, 'select public.peut_voir_cv($1) x', [nom]))[0].x;
  assert.equal(await cv(AC, F.m.cv), false);
  assert.equal(await cv(AC, F.c.cv), true);
  assert.equal(await cv(RESEAU, F.m.cv), true);
  assert.equal(await cv(RESEAU, F.c.cv), true);
  // Les signalements : ceux de son école
  assert.deepEqual(ids(await q(AC, 'select id from public.signalements')), ids(await q(RESEAU, `select s.id from public.signalements s join public.profiles p on p.id = s.auteur_id where p.ecole = 'ensam-casa'`)));
});

test('liste officielle : celle de son école, par la table comme par les fonctions de la console', async () => {
  assert.deepEqual(ids(await q(AC, 'select id from public.liste_officielle')), [F.c.liste]);
  assert.deepEqual(ids(await q(RESEAU, 'select id from public.liste_officielle')), [F.m.liste, F.c.liste].sort());
  await refuse(essai(AC, `insert into public.liste_officielle (nom, promo, ecole) values ('Ajout Intrus', 2016, 'ensam-meknes')`), /row-level security/);
  assert.equal((await essai(AC, `insert into public.liste_officielle (nom, promo, ecole) values ('Ajout Casa', 2016, 'ensam-casa') returning ecole`))[0].ecole, 'ensam-casa');
  assert.deepEqual(await essai(AC, `update public.liste_officielle set promo = 2017 where id = $1 returning id`, [F.m.liste]), []);
  await refuse(essai(AC, `update public.liste_officielle set ecole = 'ensam-meknes' where id = $1`, [F.c.liste]), /row-level security/);
  assert.deepEqual(await essai(AC, 'delete from public.liste_officielle where id = $1 returning id', [F.m.liste]), []);
  // Les fonctions de la console : l'école demandée ne compte que pour l'administration du réseau
  const restent = await dans(AC, async tx => {
    const n = (await tx.query(`select public.vider_liste(2016, 'ensam-meknes') n`)).rows[0].n;
    const r = (await tx.query(`select public.importer_liste('[{"nom":"Importé Casa","promo":2016}]'::jsonb, false, 'ensam-meknes') r`)).rows[0].r;
    await tx.exec('reset role');
    return { n, r, ecoles: (await tx.query('select ecole, count(*)::int n from public.liste_officielle group by ecole order by ecole')).rows };
  });
  assert.equal(restent.n, 1);
  assert.equal(restent.r.importes, 1);
  assert.deepEqual(restent.ecoles, [{ ecole: 'ensam-casa', n: 1 }, { ecole: 'ensam-meknes', n: 1 }]);
  assert.deepEqual((await q(AC, `select public.couverture_liste('ensam-meknes') c`))[0].c.map(x => x.total), [1]);
});

test('réglages de l’ENSAM Meknès, suivi du réseau, guide de l’étranger, santé des notifications : à l’administration du réseau', async () => {
  const domaines = `insert into public.reglages (cle, valeur) values ('domaines_ecole', '["intrus.ma"]') on conflict (cle) do update set valeur = excluded.valeur returning cle`;
  await refuse(essai(AC, domaines), /row-level security/);
  assert.deepEqual(await essai(RESEAU, domaines), [{ cle: 'domaines_ecole' }]);
  await db.query(`insert into public.reglages (cle, valeur) values ('email_ecole_obligatoire', 'false') on conflict (cle) do nothing`);
  assert.deepEqual(await essai(AC, `update public.reglages set valeur = 'true' returning cle`), []);
  assert.deepEqual(await essai(AC, 'delete from public.reglages returning cle'), []);
  // Les lire reste permis à tous
  assert.deepEqual((await q(AC, 'select cle from public.reglages')).map(r => r.cle), ['email_ecole_obligatoire']);
  // Le suivi des écoles et des partenaires : celui du réseau
  await q(RESEAU, `insert into public.admin_suivi (type, nom) values ('partenaire', 'Partenaire du réseau')`);
  assert.deepEqual(await q(AC, 'select nom from public.admin_suivi'), []);
  await refuse(essai(AC, `insert into public.admin_suivi (type, nom) values ('ecole', 'École intruse')`), /row-level security/);
  assert.deepEqual((await q(RESEAU, 'select nom from public.admin_suivi')).map(r => r.nom), ['Partenaire du réseau']);
  // Le guide de l'étranger, commun à toutes les écoles : l'administration d'une école l'écrit comme un membre
  const [g] = await q(RESEAU, `insert into public.guide_pays (pays, section, contenu) values ('France', 'visa', 'Le visa étudiant se demande sur Campus France.') returning id`);
  assert.deepEqual(await essai(AC, 'delete from public.guide_pays where id = $1 returning id', [g.id]), []);
  await refuse(essai(AC, `update public.guide_pays set contenu = 'Réécrit' where id = $1`, [g.id]), /Seuls les lauréats/);
  assert.deepEqual(await essai(RESEAU, `update public.guide_pays set contenu = 'Revu par le réseau.' where id = $1 returning id`, [g.id]), [{ id: g.id }]);
  // La santé des notifications : tout le réseau (budget, tâches de la base)
  await refuse(q(AC, 'select public.admin_sante_notifs() s'), /Réservé à l’administration/);
  assert.equal(typeof (await q(RESEAU, 'select public.admin_sante_notifs() s'))[0].s, 'object');
  // Les écoles : déjà au seul réseau
  assert.deepEqual(await essai(AC, `update public.ecoles set ouverte = true returning slug`), []);
});

test('ce que la console de Casablanca écrit ne vise personne de Meknès (organisateur, participant, attestation, parrainage, auteur, discussion)', async () => {
  const pasLa = /pas dans ton réseau|row-level security/;
  await refuse(essai(AC, `insert into public.cafes (organisateur_id, ville, lieu, date_at) values ($1, 'Casablanca', 'Café du port', now() + interval '3 days')`, [LM]), pasLa);
  await refuse(essai(AC, 'insert into public.cafe_participants (cafe_id, user_id) values ($1, $2)', [F.c.cafe, EM]), pasLa);
  await refuse(essai(AC, 'insert into public.evenement_participants (evenement_id, user_id) values ($1, $2)', [F.c.evenement, EM]), pasLa);
  await refuse(essai(AC, 'insert into public.attestations (laureat_id) values ($1)', [LM]), pasLa);
  await refuse(essai(AC, 'insert into public.parrainages (filleul_id, parrain_id, saison) values ($1, $2, 2026)', [EM, LM]), pasLa);
  await refuse(essai(AC, 'insert into public.retours_cv (profil_id, auteur_id) values ($1, $2)', [EM, AC]), pasLa);
  await refuse(essai(AC, 'update public.offers set author_id = $2 where id = $1', [F.c.offre, LM]), pasLa);
  await refuse(essai(AC, 'update public.cafes set organisateur_id = $2 where id = $1', [F.c.cafe, LM]), pasLa);
  await refuse(essai(AC, 'insert into public.messages (author_id, dest_id, body) values ($1, $2, $3)', [AC, EM, 'Bonjour']), pasLa);
  // Les mêmes, dans son école : permis
  assert.equal((await essai(AC, `insert into public.cafes (organisateur_id, ville, lieu, date_at) values ($1, 'Casablanca', 'Café du port', now() + interval '3 days') returning ecole`, [LC]))[0].ecole, 'ensam-casa');
  assert.equal((await essai(AC, 'insert into public.cafe_participants (cafe_id, user_id) values ($1, $2) returning ecole', [F.c.cafe, EC]))[0].ecole, 'ensam-casa');
  assert.equal((await essai(AC, 'insert into public.attestations (laureat_id) values ($1) returning laureat_id', [LC]))[0].laureat_id, LC);
  assert.equal((await essai(AC, 'insert into public.parrainages (filleul_id, parrain_id, saison) values ($1, $2, 2026) returning parrain_id', [EC, LC]))[0].parrain_id, LC);
  assert.equal((await essai(AC, 'update public.offers set author_id = $2 where id = $1 returning author_id', [F.c.offre, EC]))[0].author_id, EC);
  // Un événement de Casablanca publié par l'administration du réseau : celle de l'école le gère (son auteur ne change pas)
  assert.deepEqual(await essai(AC, `update public.evenements set lieu = 'Amphi A' where id = $1 returning author_id`, [F.c.evenement]), [{ author_id: RESEAU }]);
  // Discuter : avec les membres de son école ; l'administration du réseau, avec tous
  const discute = async (u, v) => (await q(u, 'select public.peut_discuter($1, $2) x', [u, v]))[0].x;
  assert.equal(await discute(AC, EM), false);
  assert.equal(await discute(AC, EC), true);
  assert.equal(await discute(RESEAU, EC), true);
  assert.equal(await discute(RESEAU, EM), true);
  await refuse(essai(AC, `insert into storage.objects (bucket_id, name) values ('chat', $1)`, [`${AC}/${EM}/x.webp`]), /row-level security/);
  assert.equal((await essai(AC, `insert into storage.objects (bucket_id, name) values ('chat', $1) returning name`, [`${AC}/${EC}/x.webp`])).length, 1);
  // L'administration du réseau : les deux écoles
  assert.equal((await essai(RESEAU, 'insert into public.cafe_participants (cafe_id, user_id) values ($1, $2) returning user_id', [F.c.cafe, EC]))[0].user_id, EC);
  assert.equal((await essai(RESEAU, 'insert into public.attestations (laureat_id) values ($1) returning laureat_id', [LM]))[0].laureat_id, LM);
});

test('parrains : l’administration de Casablanca n’attribue que ceux de son école ; celle du réseau, ceux de toutes les écoles', async () => {
  const s = (await db.query('select public.saison_courante() s')).rows[0].s;
  const EM3 = uid(9814), EC3 = uid(9824);
  await db.query('update public.profiles set parrain_dispo = true where id = any($1::uuid[])', [[LM, LC]]);
  await creerCompte(db, { id: EM3, full_name: 'Hiba Meknès', role: 'etudiant', filiere: GI, promo: s + 3 });
  await db.query(`update public.ecoles set ouverte = true where slug = 'ensam-casa'`);
  await creerCompte(db, { id: EC3, full_name: 'Yassine Casa', role: 'etudiant', filiere: GI, promo: s + 3, ecole: 'ensam-casa' });
  await db.query(`update public.ecoles set ouverte = false where slug = 'ensam-casa'`);
  // En attente d'un parrain (comme avant qu'un lauréat se porte volontaire)
  await db.query('delete from public.parrainages where filleul_id = any($1::uuid[])', [[EM3, EC3]]);
  const parrain = async e => (await db.query('select parrain_id from public.parrainages where filleul_id = $1 and saison = $2', [e, s])).rows[0]?.parrain_id ?? null;
  assert.equal((await q(AC, 'select public.attribuer_parrains() n'))[0].n, 1);
  assert.equal(await parrain(EC3), LC);
  assert.equal(await parrain(EM3), null, 'l’étudiante de Meknès attend l’administration de son école');
  assert.equal((await q(RESEAU, 'select public.attribuer_parrains() n'))[0].n, 1);
  assert.equal(await parrain(EM3), LM);
});

test('notifications : un café, un événement, une annonce, un signalement de Meknès ne vont pas à l’administration de Casablanca ; celle du réseau reçoit tout', async () => {
  await db.query('delete from public.push_queue');
  await q(LM, `insert into public.cafes (organisateur_id, ville, lieu, date_at) values ($1, 'Meknès', 'Café de la place', now() + interval '4 days')`, [LM]);
  assert.deepEqual(await prevenus('cafe'), [RESEAU, EM, EM2].sort(), 'les membres de Meknès de la ville et le réseau, pas Casablanca');
  await q(RESEAU, `insert into public.evenements (author_id, titre, debut) values ($1, 'Journée des lauréats', now() + interval '9 days')`, [RESEAU]);
  assert.deepEqual(await prevenus('evenement'), [EM, LM, EM2].sort());
  await q(RESEAU, `insert into public.annonces (author_id, texte) values ($1, 'Assemblée du réseau de Meknès')`, [RESEAU]);
  assert.deepEqual(await prevenus('annonce'), [EM, LM, EM2].sort());
  await q(EM, `insert into public.signalements (auteur_id, cible_type, cible_id, motif) values ($1, 'offre', $2, 'spam')`, [EM, F.m.offre]);
  assert.deepEqual(await prevenus('signalement'), [RESEAU]);
  // Ce qui se passe à Casablanca : son administration est prévenue, celle du réseau aussi
  await db.query('delete from public.push_queue');
  await q(EC, `insert into public.signalements (auteur_id, cible_type, cible_id, motif) values ($1, 'offre', $2, 'spam')`, [EC, F.c.offre]);
  assert.deepEqual(await prevenus('signalement'), [RESEAU, AC].sort());
  await q(AC, `insert into public.annonces (author_id, texte) values ($1, 'Bienvenue sur le réseau de Casablanca')`, [AC]);
  assert.deepEqual(await prevenus('annonce'), [RESEAU, EC, LC, EC2].sort());
});

test('filtre des notifications : ce que fait l’administration de Casablanca ne prévient que son école ; un membre de Meknès ne la prévient pas', async () => {
  // Une notification posée au nom de qui agit (comme pousser() depuis un déclencheur), puis le filtre central
  const pose = async (acteur, dest) => {
    await db.query('delete from public.push_queue');
    await en(db, acteur, tx => tx.query(`insert into public.push_queue (user_id, kind, data) values ($1, 'annonce', '{}')`, [dest]), { role: 'postgres' });
    return (await prevenus('annonce')).length === 1;
  };
  assert.equal(await pose(AC, EM), false, 'Casablanca vers une membre de Meknès');
  assert.equal(await pose(AC, EC), true);
  assert.equal(await pose(AC, RESEAU), true, 'vers l’administration du réseau');
  assert.equal(await pose(LM, AC), false, 'un membre de Meknès vers l’administration de Casablanca');
  assert.equal(await pose(LM, RESEAU), true);
  assert.equal(await pose(EC, AC), true);
  assert.equal(await pose(EC, RESEAU), true, 'un membre de Casablanca vers l’administration du réseau');
  assert.equal(await pose(RESEAU, EC), true, 'l’administration du réseau prévient qui elle veut');
  assert.equal(await pose(RESEAU, EM), true);
  assert.equal(await pose(EM, EC), false, 'comme avant : un membre ne prévient pas une autre école');
});

test('l’administration du réseau garde tout : chaque ligne privée des deux écoles', async () => {
  for (const t of Object.keys(PRIVEES)) {
    assert.equal(await voit(RESEAU, t, F.m[t]), true, `${t} à Meknès`);
    assert.equal(await voit(RESEAU, t, F.c[t]), true, `${t} à Casablanca`);
  }
  for (const t of ['comments', 'reactions_publiques', 'reponses_demandes']) {
    assert.equal(await voit(RESEAU, t, F.m[t]), true, t);
    assert.equal(await voit(RESEAU, t, F.c[t]), true, t);
  }
  assert.deepEqual(ids(await essai(RESEAU, `update public.signalements set status = 'traite' returning id`)).length, (await db.query('select count(*)::int n from public.signalements')).rows[0].n);
});

test('un membre : il voit ce qu’il voyait, ni plus ni moins (les deux écoles)', async () => {
  for (const [s, autre] of [[M, C], [C, M]]) {
    const f = s === M ? F.m : F.c;
    for (const [t, d] of Object.entries(PRIVEES)) {
      for (const k of ['etu', 'lau', 'etu2']) assert.equal(await voit(s[k], t, f[t]), d.voient.includes(k), `${t} : ${k} de ${s.ecole}`);
      for (const k of ['etu', 'lau', 'etu2']) assert.equal(await voit(autre[k], t, f[t]), false, `${t} : ${k} de l’autre école`);
    }
    for (const k of ['etu', 'lau', 'etu2']) assert.deepEqual(ids(await q(s[k], 'select id from public.profiles')), [s[k]]);
  }
  // Ses propres actions : comme avant
  assert.deepEqual(await essai(LM, `update public.signalements set status = 'traite' where id = $1 returning id`, [F.m.signalements]), []);
  assert.deepEqual(await essai(EM, 'delete from public.comments where id = $1 returning id', [F.m.comments]), [{ id: F.m.comments }]);
  assert.equal(await (async () => (await q(EM, 'select public.peut_lire_fichier_chat($1) x', [F.m.fichier]))[0].x)(), true);
  assert.equal(await (async () => (await q(EM2, 'select public.peut_lire_fichier_chat($1) x', [F.m.fichier]))[0].x)(), false);
});

test('réseau de Casablanca ouvert ou fermé : le même périmètre pour son administration', async () => {
  await db.query(`update public.ecoles set ouverte = true where slug = 'ensam-casa'`);
  try {
    assert.deepEqual(ids(await q(AC, 'select id from public.profiles where id = any($1::uuid[])', [[EM, LM, EC]])), [EC]);
    assert.equal(await voit(AC, 'applications', F.m.applications), false);
    assert.equal(await voit(AC, 'applications', F.c.applications), true);
  } finally { await db.query(`update public.ecoles set ouverte = false where slug = 'ensam-casa'`); }
});
