// Écoles : chaque réseau ne voit que le sien, ENSAM Meknès ne change pas, personne n'entre seul dans une autre école
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid, reglerHorloge, aujourdhuiA } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const MEK = uid(801), MEK2 = uid(802), AUTRE = uid(803), ADMIN = uid(804), NOUVEAU = uid(805);
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const noms = async u => (await q(u, 'select full_name from public.profils order by full_name')).map(x => x.full_name);
const offre = (u, titre) => q(u, `insert into public.offers (author_id, type, titre, entreprise, description, annees) values ($1, 'pfe', $2, 'OCP', 'Mission.', '{5}') returning id, ecole`, [u, titre]);

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await db.query(`insert into public.ecoles (slug, nom, ouverte) values ('autre-ecole', 'Autre École', true), ('fermee', 'École fermée', false)`);
  await creerCompte(db, { id: MEK, full_name: 'Salma Meknes', role: 'etudiant', filiere: 'GI', promo: 2027 });
  await creerCompte(db, { id: MEK2, full_name: 'Youssef Meknes', role: 'laureat', filiere: 'GI', promo: 2015, entreprise: 'OCP' });
  await creerCompte(db, { id: AUTRE, full_name: 'Karim Autre', role: 'laureat', filiere: 'GI', promo: 2016, entreprise: 'Lear' });
  await creerCompte(db, { id: ADMIN, full_name: 'Admin Reseau', role: 'etudiant', filiere: 'GI', promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  await db.query(`update public.profiles set ecole = 'autre-ecole' where id = $1`, [AUTRE]);
});

test('tout le monde est à ENSAM Meknès par défaut, et l’école n’est pas une donnée d’un autre réseau', async () => {
  assert.equal((await db.query('select ecole from public.profiles where id = $1', [MEK])).rows[0].ecole, 'ensam-meknes');
  assert.deepEqual(await noms(MEK), ['Admin Reseau', 'Salma Meknes', 'Youssef Meknes']);
  assert.deepEqual(await noms(AUTRE), ['Karim Autre']);
  assert.equal((await noms(ADMIN)).length, 4, 'l’administration voit tous les réseaux');
});

test('une offre reste dans son école, en lecture comme en écriture', async () => {
  const [a] = await offre(MEK2, 'PFE Meknès'); const [b] = await offre(AUTRE, 'PFE Autre');
  assert.equal(a.ecole, 'ensam-meknes'); assert.equal(b.ecole, 'autre-ecole');
  const titres = async u => (await q(u, 'select titre from public.offers order by titre')).map(x => x.titre);
  assert.deepEqual(await titres(MEK), ['PFE Meknès']);
  assert.deepEqual(await titres(AUTRE), ['PFE Autre']);
  assert.equal((await titres(ADMIN)).length, 2);
  await assert.rejects(q(MEK2, `insert into public.offers (author_id, type, titre, entreprise, description, annees, ecole) values ($1, 'pfe', 'Ailleurs', 'OCP', 'Mission.', '{5}', 'autre-ecole')`, [MEK2]));
  assert.equal((await q(AUTRE, `update public.offers set titre = 'Pris' where id = $1 returning id`, [a.id])).length, 0, 'l’offre d’une autre école ne se modifie pas');
});

test('l’école d’un compte ne se change pas ; on n’entre pas dans une école fermée', async () => {
  await assert.rejects(q(MEK, `update public.profiles set ecole = 'autre-ecole' where id = $1`, [MEK]), /ne se change pas/);
  await q(ADMIN, `update public.profiles set ecole = 'ensam-meknes' where id = $1`, [ADMIN]);
  await db.query(`insert into auth.users (id, email) values ($1, 'n@x.ma') on conflict do nothing`, [NOUVEAU]);
  await assert.rejects(q(NOUVEAU, `insert into public.profiles (id, full_name, role, ecole) values ($1, 'Nouveau', 'etudiant', 'fermee')`, [NOUVEAU]), /pas encore ouvert/);
});

test('les écoles fermées ne se voient pas', async () => {
  const r = await q(MEK, 'select slug from public.ecoles order by slug');
  assert.deepEqual(r.map(x => x.slug), ['autre-ecole', 'ensam-meknes']);
  await assert.rejects(q(MEK, `update public.ecoles set ouverte = true where slug = 'fermee' returning slug`).then(x => { if (!x.length) throw new Error('refusé'); return x; }));
});

const refuse = p => assert.rejects(p, /pas dans ton réseau|row-level security/);
test('aucune action vers une autre école par identifiant : message, mentorat, match, candidature, commentaire, invitation', async () => {
  const o = (await db.query(`select id from public.offers where titre = 'PFE Autre'`)).rows[0].id;
  await refuse(q(MEK, `insert into public.messages (author_id, dest_id, body) values ($1, $2, 'Salut')`, [MEK, AUTRE]));
  await refuse(q(MEK, `insert into public.mentorships (student_id, mentor_id, sujet) values ($1, $2, 'CV')`, [MEK, AUTRE]));
  await refuse(q(MEK, `insert into public.match_choix (cible_profil, choix) values ($1, 'oui')`, [AUTRE]));
  await refuse(q(MEK, `insert into public.match_choix (cible_offre, choix) values ($1, 'oui')`, [o]));
  await refuse(q(MEK, `insert into public.applications (student_id, offer_id) values ($1, $2)`, [MEK, o]));
  await refuse(q(MEK, `insert into public.comments (author_id, offer_id, body) values ($1, $2, 'Hop')`, [MEK, o]));
  await refuse(q(MEK2, `insert into public.invitations (laureat_id, student_id) values ($1, $2)`, [MEK2, AUTRE]));
});

test('notifications et listes : rien ne passe d’une école à l’autre', async () => {
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://p/' || id, 'k', 'a' from public.profiles on conflict do nothing`);
  await db.query('delete from public.push_queue');
  await q(ADMIN, `insert into public.annonces (texte) values ('Forum')`);
  const dest = (await db.query(`select user_id from public.push_queue where kind = 'annonce'`)).rows.map(r => r.user_id);
  assert.ok(!dest.includes(AUTRE), 'l’annonce reste dans l’école de qui la publie');
  const [o] = await q(MEK2, `select row_to_json(x) j from public.offers x where titre = 'PFE Meknès'`);
  assert.ok(o, 'offre visible');
  const pour = await db.query(`select public.offre_pour(o, p, public.saison_courante()) v from public.offers o, public.profiles p where o.titre = 'PFE Autre' and p.id = $1`, [MEK]);
  assert.equal(pour.rows[0].v, false);
  await db.query('delete from public.push_queue');
});

test('chiffres, fondateurs et liste officielle : chaque école les siens', async () => {
  const f = async u => (await q(u, 'select public.fondateurs_publics() j'))[0].j.fondateurs.map(z => z.nom);
  assert.ok((await f(MEK2)).includes('Youssef Meknes'));
  assert.ok(!(await f(MEK2)).includes('Karim Autre'));
  assert.deepEqual(await f(AUTRE), ['Karim Autre'], 'la première offre de l’école donne la première place de cette école');
  await db.query(`insert into public.liste_officielle (ecole, nom, promo) values ('autre-ecole', 'Salma Meknes', 2027)`);
  assert.equal((await db.query('select public.dans_liste($1, $2, $3) v', [MEK, 'Salma Meknes', 2027])).rows[0].v, false, 'sur la liste d’une autre école : pas vérifié ici');
  assert.equal((await db.query('select public.dans_liste($1, $2, $3) v', [AUTRE, 'Salma Meknes', 2027])).rows[0].v, true);
  await db.query(`insert into public.liste_officielle (nom, promo) values ('Salma Meknes', 2027)`);
  assert.equal((await db.query(`select count(*)::int n from public.liste_officielle where nom = 'Salma Meknes'`)).rows[0].n, 2, 'même nom, même promo, deux écoles');
});

test('ambassadeurs, enquêtes et cartes sponsorisées : par école', async () => {
  await db.query(`insert into public.ambassadeurs (ecole, promo, filiere, user_id) values ('ensam-meknes', 2015, 'GI', $1), ('autre-ecole', 2015, 'GI', $2)`, [MEK2, AUTRE]);
  const c = await db.query(`select public.chiffres_groupe(2015, 'GI', now() - interval '1 year', 'autre-ecole') j`);
  assert.equal(c.rows[0].j.inscrits, 0, 'Karim est en promo 2016 ; Youssef, de l’autre école, ne compte pas');
  const d = await db.query(`select public.chiffres_groupe(2015, 'GI', now() - interval '1 year', 'ensam-meknes') j`);
  assert.equal(d.rows[0].j.inscrits, 1);
  await db.query(`insert into public.sponsorises (entreprise, titre, texte, lien, debut, fin, ecole) values ('OCP', 'Stage', 'Un texte assez long.', 'https://ocp.ma', current_date, current_date, 'autre-ecole') `).catch(() => {});
  const v = await db.query(`select public.sponsorise_pour(s, p) v from public.sponsorises s, public.profiles p where p.id = $1 limit 1`, [MEK]);
  if (v.rows[0]) assert.equal(v.rows[0].v, false);
  await db.query('delete from public.ambassadeurs');
});

// Les tâches de la base n'ont pas de membre connecté : push_filtre ne peut pas trier les écoles, et un plafond (limit)
// rempli par une autre école priverait la sienne. Chaque envoi à plusieurs filtre donc l'école lui-même.
const comme = (u, sql, p) => db.transaction(async tx => {
  await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [u]);
  return (await tx.query(sql, p)).rows;
});
const recus = async kind => (await db.query('select user_id from public.push_queue where kind = $1', [kind])).rows.map(r => r.user_id);
test('envois à plusieurs : l’école est filtrée avant le plafond, même lancés par la base', async () => {
  const MEK3 = uid(806), NOUVEAU_LAU = uid(807);
  await creerCompte(db, { id: MEK3, full_name: 'Nadia Meknes', role: 'laureat', filiere: 'GI', promo: 2016, entreprise: 'Lear' });
  await db.query(`update public.profiles set verified = true, mentor_dispo = true, ville = 'Kenitra', entreprise = 'Lear' where id = any($1::uuid[])`, [[MEK3, AUTRE]]);
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://p/' || id, 'k', 'a' from public.profiles on conflict do nothing`);
  const verifier = async (kind, action) => {
    await db.query('delete from public.push_queue');
    await action();
    const r = await recus(kind);
    assert.ok(r.includes(MEK3), `${kind} : la lauréate de la même école est prévenue`);
    assert.ok(!r.includes(AUTRE), `${kind} : personne d’une autre école`);
  };
  await verifier('question_routee', () => db.query(`insert into public.questions (author_id, categorie, titre, entreprise) values ($1, 'stage', 'Un stage chez Lear ?', 'Lear')`, [MEK]));
  await verifier('cafe', () => db.query(`insert into public.cafes (organisateur_id, ville, lieu, date_at) values ($1, 'Kenitra', 'Café central', now() + interval '3 days')`, [MEK]));
  await verifier('verifier_pair', async () => {
    await db.query('insert into auth.users (id, email) values ($1, $2)', [NOUVEAU_LAU, 'nouveau-lau@exemple.ma']);
    await db.query(`insert into public.profiles (id, full_name, role, filiere, promo) values ($1, 'Omar Meknes', 'laureat', 'GI', 2016)`, [NOUVEAU_LAU]);
  });
  await verifier('evenement', () => db.query(`insert into public.evenements (author_id, titre, debut) values ($1, 'Forum entreprises', now() + interval '5 days')`, [ADMIN]));
  await verifier('relecture_demande', () => db.query(`insert into public.relectures_cv (student_id, cv_path) values ($1, 'cv/salma.pdf')`, [MEK]));
  await verifier('demande_nouvelle', () => db.query(`insert into public.demandes (auteur_id, type, titre, details) values ($1, 'pfe', 'PFE en génie industriel', 'Je cherche un PFE en amélioration continue, à Kénitra.')`, [MEK]));
  await verifier('mentorat_ouvert', () => db.query(`insert into public.mentorships (student_id, besoin, sujet, creneaux) values ($1, 'cv', 'Relire mon CV', array[now() + interval '1 day']::timestamptz[])`, [MEK]));
  await verifier('annonce', () => db.query(`insert into public.annonces (texte) values ('Forum des entreprises')`));
  await db.query('delete from public.push_queue');
});

test('ce que fait l’administration notifie le membre concerné, quelle que soit son école', async () => {
  await db.query('delete from public.push_queue');
  await comme(ADMIN, `select public.pousser($1, 'reponse', '{"de": "admin"}')`, [AUTRE]);
  await comme(MEK, `select public.pousser($1, 'reponse', '{"de": "membre"}')`, [AUTRE]);
  const r = (await db.query(`select data->>'de' de from public.push_queue where user_id = $1 and kind = 'reponse'`, [AUTRE])).rows.map(x => x.de);
  assert.deepEqual(r, ['admin'], 'un membre ne notifie pas une autre école ; l’administration, si');
  await db.query('delete from public.push_queue');
});

// Les nouvelles notifications programmées (P2, P5 à P8, P11b, P11d, le rappel du soir) et la nuit calme partent aussi de
// pg_cron, sans membre connecté : chacune choisit ses destinataires, ses chiffres et ses noms dans l'école du membre, avant
// tout plafond.
// Ici, à chaque fois, des jumeaux d'une autre école qui rempliraient sinon les conditions (Karim, lauréat GI 2016 à Kénitra
// comme Nadia ; Hiba, étudiante GI 2027 comme Salma) ; le détail de chaque envoi : test-ecoles-notifs.mjs. Le budget du jour
// est remis à zéro avant chaque tâche : ce n'est pas lui qu'on vérifie ici.
test('nouvelles notifications programmées : l’école est filtrée avant le plafond, même lancées par la base', async () => {
  const MEK3 = uid(806), NOUVEAU_LAU = uid(807), HIBA = uid(808);
  await creerCompte(db, { id: HIBA, full_name: 'Hiba Autre', role: 'etudiant', filiere: 'GI', promo: 2027, ville: 'Kenitra', ecole: 'autre-ecole' });
  try {
    await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://p/' || id, 'k', 'a' from public.profiles on conflict do nothing`);
    await db.query(`insert into public.visites (user_id, vu_at) select id, now() - interval '3 days' from public.profiles on conflict (user_id) do update set vu_at = excluded.vu_at`);
    const NOMS = { [MEK]: 'MEK', [MEK2]: 'MEK2', [MEK3]: 'MEK3', [NOUVEAU_LAU]: 'NOUVEAU_LAU', [AUTRE]: 'AUTRE', [HIBA]: 'HIBA', [ADMIN]: 'ADMIN' };
    // La file d'un type, par destinataire : { MEK: [data, …], … }
    const file = async kind => {
      const m = {};
      for (const x of (await db.query('select user_id, data from public.push_queue where kind = $1 order by id', [kind])).rows) (m[NOMS[x.user_id] || x.user_id] ??= []).push(x.data);
      return m;
    };
    const par = (f, champ) => Object.fromEntries(Object.entries(f).map(([k, d]) => [k, d.map(x => (typeof champ === 'function' ? champ(x) : x[champ]))]));
    // Chaque tâche à son heure (en UTC, l'heure du Maroc), file vidée et budget du jour remis à zéro
    const lancer = async (f, h, m = 0) => {
      await db.query('delete from public.push_queue'); await db.query('delete from public.notif_programme');
      await reglerHorloge(db, aujourdhuiA(h, m));
      try { return (await db.query(`select public.${f}() n`)).rows[0].n; } finally { await reglerHorloge(db); }
    };

    // Offre qui ferme (P5) : ses offres enregistrées de son école, même avec une offre d'ailleurs enregistrée (pour l'année
    // de Salma et de Hiba, promo 2027, quelle que soit la saison)
    const ferme = async (auteur, ecole, titre) => (await db.query(`insert into public.offers (author_id, type, titre, entreprise, description, annees, deadline, ecole)
      values ($1, 'pfe', $2, 'OCP', 'Mission.', array[public.niveau_de(2027, public.saison_courante())], $3, $4) returning id`,
      [auteur, titre, aujourdhuiA(0, 0, 2).slice(0, 10), ecole])).rows[0].id;
    const om = await ferme(MEK2, 'ensam-meknes', 'PFE qui ferme à Meknès'), oa = await ferme(AUTRE, 'autre-ecole', 'PFE qui ferme ailleurs');
    await db.query(`insert into public.reactions (offer_id, user_id, kind) select o, u, 'save' from unnest($1::uuid[]) o, unnest($2::uuid[]) u`, [[om, oa], [MEK, HIBA]]);
    await lancer('offres_bientot_push', 9);
    assert.deepEqual(par(await file('offre_bientot'), 'offre'), { MEK: [om], HIBA: [oa] });

    // Demande sans aide (P6), 150 lauréats au plus par demande : 150 lauréats d'une autre école, du même parcours et venus
    // plus récemment, ne prennent pas la place de ceux de l'école de la demande. Celle de Salma passe la première (plus
    // ancienne) : sinon ces 150 auraient déjà eu leur notification du jour, et ne lui disputeraient plus rien.
    const demande = async (auteur, ecole, titre, ilYa) => {
      const { id } = (await db.query(`insert into public.demandes (auteur_id, type, titre, details, ecole) values ($1, 'pfe', $2,
        'Je cherche un PFE en amélioration continue, à Kénitra.', $3) returning id`, [auteur, titre, ecole])).rows[0];
      await db.query(`update public.demandes set created_at = now() - $2::interval, relancee_at = now() - $2::interval where id = $1`, [id, ilYa]);
      return id;
    };
    const dm = await demande(MEK, 'ensam-meknes', 'PFE lean à Kénitra', '26 hours'), da = await demande(HIBA, 'autre-ecole', 'PFE qualité à Kénitra', '25 hours');
    const foule = Array.from({ length: 150 }, (_, i) => uid(900 + i));
    await db.query(`insert into auth.users (id, email) select u, u::text || '@autre.ma' from unnest($1::uuid[]) u`, [foule]);
    await db.query(`insert into public.profiles (id, full_name, role, filiere, promo, ecole) select u, 'Lauréat Autre', 'laureat', 'GI', 2016, 'autre-ecole' from unnest($1::uuid[]) u`, [foule]);
    await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select u, 'https://p/' || u, 'k', 'a' from unnest($1::uuid[]) u`, [foule]);
    await db.query(`insert into public.visites (user_id, vu_at) select u, now() from unnest($1::uuid[]) u`, [foule]);
    try {
      await lancer('demande_attente_push', 10);
      const att = (await db.query(`select user_id, data->>'demande' d, data->>'nom' nom from public.push_queue where kind = 'demande_attente'`)).rows;
      assert.deepEqual(att.filter(x => x.d === dm).map(x => NOMS[x.user_id] || 'foule').sort(), ['MEK2', 'MEK3', 'NOUVEAU_LAU'], 'les lauréats de son école');
      assert.ok(att.filter(x => x.d === dm).every(x => x.nom === 'Salma'));
      const ailleurs = att.filter(x => x.d === da);
      assert.equal(ailleurs.length, 150, 'le plafond, rempli par l’école de la demande');
      assert.ok(ailleurs.every(x => !['MEK', 'MEK2', 'MEK3', 'NOUVEAU_LAU'].includes(NOMS[x.user_id])), 'personne de Meknès');
    } finally {
      await db.query('delete from auth.users where id = any($1::uuid[])', [foule]);
    }

    // Demande en pause (P11b) : chacun la sienne
    await db.query(`update public.demandes set created_at = now() - interval '61 days', relancee_at = now() - interval '61 days' where id = any($1::uuid[])`, [[dm, da]]);
    await lancer('demande_pause_push', 8);
    assert.deepEqual(par(await file('demande_pause'), 'demande'), { MEK: [dm], HIBA: [da] });

    // Groupes du jour (P11d) : Kénitra est un groupe à part dans chaque école ; les messages de l'autre ne comptent pas
    const ecrire = (u, ecole, n) => db.query(`insert into public.groupe_messages (groupe, author_id, body, ecole, created_at)
      select 'ville:kenitra', $1, 'Bonjour ' || i, $2, now() - interval '2 hours' from generate_series(1, $3::int) i`, [u, ecole, n]);
    await ecrire(MEK, 'ensam-meknes', 2); await ecrire(HIBA, 'autre-ecole', 3);
    await lancer('groupe_jour_push', 19, 30);
    assert.deepEqual(par(await file('groupe_jour'), 'n'), { MEK3: [2], AUTRE: [3] });

    // Résumé du dimanche (P7) : tous ces comptes sont arrivés cette semaine ; chacun ne compte que son école
    await lancer('semaine_push', 10);
    const sem = await file('semaine');
    assert.equal(sem.MEK[0].laureats, 3, 'Youssef, Nadia et Omar ; pas Karim, d’une autre école');
    assert.equal(sem.MEK[0].promo, undefined, 'Hiba est de sa promo, mais d’une autre école');
    assert.equal(sem.MEK3[0].promo, 1, 'Omar ; pas Karim, de sa promo mais d’une autre école');
    assert.deepEqual([sem.HIBA[0].laureats, sem.HIBA[0].promo], [1, undefined], 'Karim ; pas Salma, de sa promo mais d’une autre école');

    // La veille (P8) : l'événement de demain de son école ; les inscrits comptés dans l'école de l'événement
    const ev = async (ecole, titre) => (await db.query(`insert into public.evenements (titre, debut, lieu, public, ecole) values ($1, $2, 'Amphi A', 'tous', $3) returning id`,
      [titre, aujourdhuiA(14, 0, 1), ecole])).rows[0].id;
    const em = await ev('ensam-meknes', 'Atelier CV de demain'), ea = await ev('autre-ecole', 'Forum de demain');
    await db.query(`insert into public.evenement_participants (evenement_id, user_id) values ($1, $3), ($1, $4), ($2, $5), ($2, $6)`, [em, ea, MEK3, AUTRE, HIBA, MEK]);
    await lancer('agenda_demain_push', 19, 30);
    assert.deepEqual(par(await file('agenda_demain'), x => [x.id, x.inscrits]), { MEK3: [[em, 1]], HIBA: [[ea, 1]] });

    // Intérêt qui attend (P2) : Nadia a dit oui à Salma il y a 21 h ; Karim, d'une autre école, plus tard : ni compté ni nommé
    const oui = (de, champ, cible, ilYa = '21 hours') => db.query(`insert into public.match_choix (user_id, ${champ}, choix, updated_at)
      values ($1, $2, 'oui', now() - $3::interval)`, [de, cible, ilYa]);
    await oui(MEK3, 'cible_profil', MEK);
    await oui(AUTRE, 'cible_profil', MEK, '20 hours 30 minutes');
    await oui(NOUVEAU_LAU, 'cible_profil', HIBA); // d'une autre école : rien pour Hiba
    await oui(HIBA, 'cible_offre', om);           // sur l'offre de Youssef, d'une autre école : rien pour lui
    await lancer('match_attente_push', 12, 30);
    assert.deepEqual(par(await file('match_attente'), x => [x.n, x.nom, x.de]), { MEK: [[1, 'Nadia', MEK3]] });

    // Rappel du soir : les nouvelles clés comptent dans son école (un match et un oui chacun ; Hiba, rien de Meknès)
    await db.query(`insert into public.matchs (etudiant_id, laureat_id) values ($1, $2), ($3, $4)`, [MEK, MEK2, HIBA, MEK3]);
    await db.query(`update public.profiles set created_at = now() - interval '30 days' where id = any($1::uuid[])`, [[MEK, MEK2, MEK3, AUTRE, HIBA]]);
    await lancer('rappels_push', 18);
    const rv = await file('rappel_visite');
    assert.deepEqual([rv.MEK[0].matchs, rv.MEK[0].interets], [1, 1], 'Youssef et Nadia ; pas le oui de Karim, d’une autre école');
    assert.equal(rv.MEK3[0].matchs, undefined, 'le match avec Hiba, d’une autre école, ne compte pas');
    assert.deepEqual([rv.HIBA[0].matchs, rv.HIBA[0].interets], [undefined, undefined], 'ni le match avec Nadia ni le oui d’Omar');
    assert.equal(rv.MEK2?.[0]?.interets, undefined, 'le oui de Hiba sur son offre, d’une autre école, ne compte pas');

    // La nuit calme : un événement publié à 23 h attend 08:00 (push_nuit), puis part vers son école seulement
    await db.query('delete from public.push_queue'); await db.query('delete from public.push_nuit');
    await reglerHorloge(db, aujourdhuiA(23, 0));
    try {
      await db.query(`insert into public.evenements (titre, debut, lieu, public, ecole) values ('Forum de rentrée', now() + interval '4 days', 'Amphi B', 'tous', 'ensam-meknes')`);
      assert.deepEqual(await file('evenement'), {}, 'rien la nuit');
      await reglerHorloge(db, aujourdhuiA(8, 0, 1));
      assert.ok((await db.query('select public.liberer_nuit() n')).rows[0].n > 0);
    } finally { await reglerHorloge(db); }
    assert.deepEqual(Object.keys(await file('evenement')).sort(), ['ADMIN', 'MEK', 'MEK2', 'MEK3', 'NOUVEAU_LAU']);
    await db.query('delete from public.push_queue');
  } finally {
    // Hiba repart (la suite du fichier compte les membres de l'autre école) ; l'horloge revient à 10 h
    await db.query('delete from auth.users where id = $1', [HIBA]);
    await reglerHorloge(db);
  }
});

test('relancée, la mise à jour ne perd rien', async () => {
  const sql = (await import('node:fs')).readFileSync(SCHEMA, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, '');
  await db.exec(sql);
  assert.equal((await db.query(`select ecole from public.profiles where id = $1`, [AUTRE])).rows[0].ecole, 'autre-ecole');
  assert.deepEqual(await noms(AUTRE), ['Karim Autre']);
});
