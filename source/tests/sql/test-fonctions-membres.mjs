// Fonctions SECURITY DEFINER que les règles appellent et qu'un membre peut aussi appeler lui-même, avec les ids qu'il veut
// (test-droits-visiteurs les garde permises aux membres). Elles passent à côté des règles : elles ne répondent que sur
// ce que l'appelant voit déjà. Qui est en contact avec qui (en_relation) : seulement pour un lien où il est, sinon pour
// l'administration de l'école des deux personnes ou celle du réseau. Qu'un message a été signalé (message_signale) :
// seulement pour l'administration (même l'auteur du message ne l'apprend pas : il saurait qui l'a signalé). Les
// confirmations d'un lauréat (pairs_valides) : celles que son école lit déjà, pas celles d'une autre école.
// demande_large_le et domaines_ecole ne disent rien qu'un membre ne lise déjà : elles restent telles quelles.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const GI = 'Génie Industriel';
const RESEAU = uid(9901), AC = uid(9902);                                          // administration du réseau ; de l'ENSAM Casablanca
const EM = uid(9911), LM = uid(9912), EM2 = uid(9913), LM2 = uid(9914), LM3 = uid(9915); // Meknès
const EC = uid(9921), LC = uid(9922), EC2 = uid(9923), LC2 = uid(9924), LC3 = uid(9925); // Casablanca
const F = {};

const x = async (u, sql, p) => (await en(db, u, tx => tx.query(sql, p))).rows[0].x;
const rows = async (u, sql, p) => (await en(db, u, tx => tx.query(sql, p))).rows;
const ANNULE = Symbol('annulé');
const essai = async (u, sql, p) => {
  let r;
  await en(db, u, async tx => { r = (await tx.query(sql, p)).rows; throw ANNULE; }).catch(e => { if (e !== ANNULE) throw e; });
  return r;
};
const un = async (sql, p) => (await db.query(sql, p)).rows[0]?.id;

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: RESEAU, full_name: 'Admin Réseau', role: 'etudiant', filiere: GI, promo: 2010 });
  await creerCompte(db, { id: EM, full_name: 'Salma Meknès', role: 'etudiant', filiere: GI, promo: 2027 });
  await creerCompte(db, { id: LM, full_name: 'Youssef Meknès', role: 'laureat', filiere: GI, promo: 2016 });
  await creerCompte(db, { id: EM2, full_name: 'Omar Meknès', role: 'etudiant', filiere: 'Génie Civil', promo: 2027 });
  await creerCompte(db, { id: LM2, full_name: 'Rachid Meknès', role: 'laureat', filiere: GI, promo: 2016 });
  await creerCompte(db, { id: LM3, full_name: 'Hamid Meknès', role: 'laureat', filiere: GI, promo: 2016 });
  await db.query(`update public.ecoles set ouverte = true where slug = 'ensam-casa'`);
  for (const [id, full_name, role, promo] of [[AC, 'Admin Casa', 'etudiant', 2010], [EC, 'Karim Casa', 'etudiant', 2027], [LC, 'Nadia Casa', 'laureat', 2016],
    [EC2, 'Imane Casa', 'etudiant', 2027], [LC2, 'Sara Casa', 'laureat', 2016], [LC3, 'Hind Casa', 'laureat', 2016]]) {
    await creerCompte(db, { id, full_name, role, filiere: GI, promo, ecole: 'ensam-casa' });
  }
  await db.query(`update public.ecoles set ouverte = false where slug = 'ensam-casa'`);
  await db.query(`update public.profiles set role = 'admin' where id = any($1::uuid[])`, [[RESEAU, AC]]);
  await db.query(`update public.profiles set verified = true where id = any($1::uuid[])`, [[LM, LM3, LC, LC3]]);
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://p/' || id, 'k', 'a' from public.profiles on conflict do nothing`);
  // L'étudiante ne montre sa ville qu'à ses contacts ; elle et le lauréat sont en contact (demande acceptée)
  await db.query(`update public.profiles set ville = 'Meknès', visibilite = '{"lieu": "contacts"}' where id = $1`, [EM]);
  await db.query(`insert into public.coordonnees (id, telephone) values ($1, '0611111111') on conflict (id) do update set telephone = excluded.telephone`, [EM]);
  for (const [k, etu, lau] of [['m', EM, LM], ['c', EC, LC]]) {
    const o = F[k] = {};
    await db.query(`insert into public.demandes_contact (demandeur_id, cible_id, status) values ($1, $2, 'acceptee')`, [etu, lau]);
    o.message = await un(`insert into public.messages (author_id, dest_id, body) values ($1, $2, 'Bonjour') returning id`, [etu, lau]);
    o.fichier = `${etu}/${lau}/photo.webp`;
    o.photo = await un(`insert into public.messages (author_id, dest_id, type, fichier) values ($1, $2, 'photo', $3) returning id`, [etu, lau, o.fichier]);
    o.calme = await un(`insert into public.messages (author_id, dest_id, body) values ($1, $2, 'Merci') returning id`, [etu, lau]);
    // Le lauréat signale les deux premiers messages
    await db.query(`insert into public.signalements (auteur_id, cible_type, cible_id, motif) values ($1, 'prive', $2, 'harcelement'), ($1, 'prive', $3, 'inapproprie')`, [lau, o.message, o.photo]);
  }
  // Une première confirmation, donnée par un lauréat vérifié de la promo, dans chaque école
  await en(db, LM, tx => tx.query(`insert into public.verifications_pairs (laureat_id) values ($1)`, [LM2]));
  await en(db, LC, tx => tx.query(`insert into public.verifications_pairs (laureat_id) values ($1)`, [LC2]));
  await db.query(`insert into public.reglages (cle, valeur) values ('domaines_ecole', '["ensam-umi.ac.ma"]') on conflict (cle) do update set valeur = excluded.valeur`);
  F.demandes = [await un(`insert into public.demandes (auteur_id, type, titre, details) values ($1, 'stage', 'Cherche un stage', 'Un stage de fin d’études en logistique, dès juin.') returning id`, [EM]),
    await un(`insert into public.demandes (auteur_id, type, titre, details) values ($1, 'stage', 'Cherche un chantier', 'Un stage sur un chantier de génie civil, cet été.') returning id`, [EM2])];
});

const rel = (u, a, b) => x(u, 'select public.en_relation($1, $2) x', [a, b]);

test('en_relation : un membre ne sait que les liens où il est', async () => {
  // Les deux personnes du lien : oui, dans les deux sens
  assert.equal(await rel(EM, LM, EM), true);
  assert.equal(await rel(EM, EM, LM), true);
  assert.equal(await rel(LM, LM, EM), true);
  assert.equal(await rel(EM, LM, EM2), false);
  // Un autre membre de l'école, ou d'une autre école : il n'apprend pas qui est en contact avec qui
  assert.equal(await rel(EM2, LM, EM), false);
  assert.equal(await rel(EM2, EM, LM), false);
  assert.equal(await rel(LM3, LM, EM), false);
  assert.equal(await rel(EC, LM, EM), false);
  assert.equal(await rel(EM, LC, EC), false);
  // L'administration du réseau : partout ; celle d'une école : entre membres de son école
  assert.equal(await rel(RESEAU, LM, EM), true);
  assert.equal(await rel(RESEAU, LC, EC), true);
  assert.equal(await rel(AC, LC, EC), true);
  assert.equal(await rel(AC, LM, EM), false);
  assert.equal(await rel(AC, LC, EM), false);
  // La base elle-même (fonctions du serveur, sans membre connecté) : tout
  assert.equal((await db.query('select public.en_relation($1, $2) x', [LM, EM])).rows[0].x, true);
});

test('en_relation : les coordonnées, la vue profils et la messagerie qui s’en servent marchent comme avant', async () => {
  // Coordonnées : le contact les lit, un autre membre non
  assert.deepEqual(await rows(LM, 'select telephone from public.coordonnees where id = $1', [EM]), [{ telephone: '0611111111' }]);
  assert.deepEqual(await rows(EM2, 'select telephone from public.coordonnees where id = $1', [EM]), []);
  // Vue profils : la ville « contacts seulement » se montre au contact
  assert.equal((await rows(LM, 'select ville from public.profils where id = $1', [EM]))[0].ville, 'Meknès');
  assert.equal((await rows(EM2, 'select ville from public.profils where id = $1', [EM]))[0].ville, null);
  assert.equal((await rows(RESEAU, 'select ville from public.profils where id = $1', [EM]))[0].ville, 'Meknès');
  // Messagerie : les deux contacts peuvent s'écrire ; un autre membre, sans lien, non
  assert.equal(await x(LM, 'select public.peut_discuter($1, $2) x', [LM, EM]), true);
  assert.equal(await x(EM, 'select public.peut_discuter($1, $2) x', [EM, LM]), true);
  assert.equal(await x(EM2, 'select public.peut_discuter($1, $2) x', [EM2, LM]), false);
  assert.deepEqual(await essai(LM, `insert into public.messages (author_id, dest_id, body) values ($1, $2, 'Avec plaisir') returning dest_id`, [LM, EM]), [{ dest_id: EM }]);
  await assert.rejects(essai(EM2, `insert into public.messages (author_id, dest_id, body) values ($1, $2, 'Bonjour') returning dest_id`, [EM2, LM]));
});

const sig = (u, id) => x(u, 'select public.message_signale($1) x', [id]);

test('message_signale : seule l’administration sait qu’un message est signalé', async () => {
  const { m, c } = F;
  // Les membres : non, même l'auteur du message (il saurait qui l'a signalé) ou celui qui l'a reçu
  for (const u of [EM, LM, EM2, LM3, EC, LC]) {
    assert.equal(await sig(u, m.message), false, u);
    assert.equal(await sig(u, c.message), false, u);
  }
  // L'administration du réseau : tous ; celle d'une école : ceux de son école
  assert.equal(await sig(RESEAU, m.message), true);
  assert.equal(await sig(RESEAU, c.photo), true);
  assert.equal(await sig(RESEAU, m.calme), false);
  assert.equal(await sig(AC, c.message), true);
  assert.equal(await sig(AC, c.photo), true);
  assert.equal(await sig(AC, m.message), false);
  assert.equal(await sig(AC, c.calme), false);
  assert.equal((await db.query('select public.message_signale($1) x', [m.message])).rows[0].x, true);
});

test('message_signale : l’administration lit toujours les messages signalés et leurs photos, rien de plus', async () => {
  const { m, c } = F;
  const lus = async (u, ids) => (await rows(u, 'select id from public.messages where id = any($1::uuid[]) order by id', [ids])).map(r => r.id);
  assert.deepEqual(await lus(RESEAU, [m.message, m.photo, m.calme]), [m.message, m.photo].sort());
  assert.deepEqual(await lus(RESEAU, [c.message, c.photo, c.calme]), [c.message, c.photo].sort());
  assert.deepEqual(await lus(AC, [c.message, c.photo, c.calme]), [c.message, c.photo].sort());
  assert.deepEqual(await lus(AC, [m.message, m.photo]), []);
  assert.deepEqual(await lus(EM2, [m.message, m.photo, m.calme]), []);
  assert.deepEqual(await lus(EM, [m.message, m.photo, m.calme]), [m.message, m.photo, m.calme].sort());
  const fichier = (u, f) => x(u, 'select public.peut_lire_fichier_chat($1) x', [f]);
  assert.equal(await fichier(RESEAU, m.fichier), true);
  assert.equal(await fichier(RESEAU, c.fichier), true);
  assert.equal(await fichier(AC, c.fichier), true);
  assert.equal(await fichier(AC, m.fichier), false);
  assert.equal(await fichier(EM2, m.fichier), false);
  assert.equal(await fichier(EM, m.fichier), true);
});

const pairs = (u, id) => x(u, 'select public.pairs_valides($1, 2016) x', [id]);

test('pairs_valides : les confirmations d’un lauréat, pour qui les lit déjà (son école), pas pour une autre école', async () => {
  // Son école : comme avant (les confirmations et les profils de qui confirme y sont lisibles par tous les membres)
  for (const u of [LM2, LM, EM2, RESEAU]) assert.equal(await pairs(u, LM2), 1, u);
  const lisibles = await rows(EM2, `select count(*)::int n from public.verifications_pairs v join public.profils p on p.id = v.verificateur_id
    where v.laureat_id = $1 and p.role = 'laureat' and p.verified and p.promo = 2016`, [LM2]);
  assert.equal(lisibles[0].n, 1);
  for (const u of [LC2, EC, AC, RESEAU]) assert.equal(await pairs(u, LC2), 1, u);
  // Une autre école : rien (ni les membres, ni son administration)
  for (const u of [EC, LC, AC]) assert.equal(await pairs(u, LM2), 0, u);
  for (const u of [EM, LM, EM2]) assert.equal(await pairs(u, LC2), 0, u);
  assert.equal((await db.query('select public.pairs_valides($1, 2016) x', [LM2])).rows[0].x, 1);
});

test('pairs_valides : la deuxième confirmation vérifie toujours le lauréat, dans chaque école, et il en est prévenu', async () => {
  const verifie = async id => (await db.query('select verified from public.profiles where id = $1', [id])).rows[0].verified;
  const comptes = async id => (await db.query(`select data ->> 'n' n from public.push_queue where user_id = $1 and kind = 'verification_pair' order by id`, [id])).rows.map(r => r.n);
  assert.equal(await verifie(LM2), false);
  await en(db, LM3, tx => tx.query(`insert into public.verifications_pairs (laureat_id) values ($1)`, [LM2]));
  assert.equal(await verifie(LM2), true);
  assert.deepEqual(await comptes(LM2), ['1', '2']);
  assert.equal(await verifie(LC2), false);
  await en(db, LC3, tx => tx.query(`insert into public.verifications_pairs (laureat_id) values ($1)`, [LC2]));
  assert.equal(await verifie(LC2), true);
  assert.deepEqual(await comptes(LC2), ['1', '2']);
});

test('demande_large_le et domaines_ecole : rien qu’un membre ne lise déjà, réponses inchangées', async () => {
  // demande_large_le : la date de la demande passée en argument, et si la filière de son auteur (lisible dans profils)
  // a un parcours
  const r = await rows(EM2, `select public.demande_large_le(d) = case when cardinality(coalesce(public.parcours_de(p.filiere), '{}')) = 0
      then d.created_at else d.created_at + interval '24 hours' end ok, p.filiere from public.demandes d join public.profils p on p.id = d.auteur_id
    where d.id = any($1::uuid[]) order by p.filiere`, [F.demandes]);
  assert.deepEqual(r, [{ ok: true, filiere: 'Génie Civil' }, { ok: true, filiere: GI }]);
  // domaines_ecole : les domaines de l'email de l'ENSAM Meknès, que la page d'inscription lit sans compte
  const anon = (await en(db, null, tx => tx.query(`select valeur from public.reglages where cle = 'domaines_ecole'`), { role: 'anon' })).rows[0].valeur;
  for (const u of [EM, EC, AC]) assert.deepEqual(await x(u, 'select public.domaines_ecole() x'), anon);
});

test('voit_champ : une demande d’une autre école n’ouvre pas le CV de son auteur', async () => {
  // Le CV d'une étudiante qui a une demande ouverte, montré à ses contacts seulement : les lauréats de son école le voient
  // le temps de la demande, comme avant ; l'administration aussi ; un étudiant non
  const cv = (u, owner) => x(u, `select public.voit_champ($1, '{"cv": "contacts"}'::jsonb, 'cv') x`, [owner]);
  assert.equal(await cv(LM3, EM), true);
  assert.equal(await cv(LM2, EM), true);
  assert.equal(await cv(RESEAU, EM), true);
  assert.equal(await cv(EM2, EM), false);
  // Un lauréat d'une autre école : cette demande n'est pas dans son réseau (il ne la lit pas), elle ne lui ouvre pas le CV
  assert.equal(await cv(LC, EM), false);
  assert.equal(await cv(LC3, EM), false);
  // Ce que la vue profils et le stockage des CV montrent : comme avant (son école seulement)
  assert.equal((await rows(LM3, 'select id from public.profils where id = $1', [EM])).length, 1);
  assert.deepEqual(await rows(LC, 'select id from public.profils where id = $1', [EM]), []);
  assert.equal(await x(LC, 'select public.peut_voir_cv($1) x', [`${EM}/cv.pdf`]), false);
  // Les demandes que lisent les étudiants de la même année (« lecture promo ») : comme avant
  assert.deepEqual((await rows(EM2, 'select id from public.demandes where id = any($1::uuid[])', [F.demandes])).map(r => r.id).sort(), [...F.demandes].sort());
  assert.deepEqual(await rows(EC, 'select id from public.demandes where id = any($1::uuid[])', [F.demandes]), []);
});
