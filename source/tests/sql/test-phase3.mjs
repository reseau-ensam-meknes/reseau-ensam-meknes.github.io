// Phase 3 : sécurité et règles de la base (PGlite + ce qu'il faut de Supabase)
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const ETU = uid(1), ETU2 = uid(2), LAU = uid(3), LAU_FR = uid(4), ADMIN = uid(5), LAU2 = uid(6), NOUVEAU = uid(7);

const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const refuse = async (promesse, re) => { await assert.rejects(promesse, e => (re ? re.test(e.message) : true) || assert.fail(e.message)); };

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ETU, email: 'salma@exemple.ma', full_name: 'Salma Bennani', role: 'etudiant', filiere: 'Génie Industriel', promo: S + 1 });
  await creerCompte(db, { id: ETU2, full_name: 'Omar Tazi', role: 'etudiant', filiere: 'Génie Industriel', promo: S + 1 });
  await creerCompte(db, { id: LAU, full_name: 'Youssef Alaoui', role: 'laureat', filiere: 'Génie Industriel', promo: 2018, entreprise: 'Renault', poste: 'Ingénieur', contact: '06 11 22 33 44', mentor_dispo: true });
  await creerCompte(db, { id: LAU_FR, full_name: 'Nadia Idrissi', role: 'laureat', filiere: 'Génie Mécanique', promo: 2016, pays: 'France', ville: 'Lyon' });
  await creerCompte(db, { id: LAU2, full_name: 'Karim Fassi', role: 'laureat', filiere: 'Génie Industriel', promo: 2019 });
  await creerCompte(db, { id: ADMIN, full_name: 'Admin École', role: 'etudiant', filiere: 'Génie Industriel', promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
});

test('profils : la table est privée, la vue masque selon la visibilité choisie', async () => {
  const brut = await q(ETU, 'select id from public.profiles');
  assert.deepEqual(brut.map(r => r.id), [ETU]);
  const vus = await q(ETU, 'select id, entreprise, contact from public.profils order by full_name');
  assert.equal(vus.length, 6);
  assert.equal(vus.find(r => r.id === LAU).entreprise, 'Renault');
  // Le lauréat garde son travail pour les lauréats seulement
  await q(LAU, `update public.profiles set visibilite = '{"travail":"laureats","cv":"contacts"}' where id = $1`, [LAU]);
  assert.equal((await q(ETU, 'select entreprise from public.profils where id = $1', [LAU]))[0].entreprise, null);
  assert.equal((await q(LAU2, 'select entreprise from public.profils where id = $1', [LAU]))[0].entreprise, 'Renault');
  assert.equal((await q(ADMIN, 'select entreprise from public.profils where id = $1', [LAU]))[0].entreprise, 'Renault');
  assert.equal((await q(LAU, 'select visibilite from public.profils where id = $1', [LAU]))[0].visibilite.travail, 'laureats');
  assert.deepEqual((await q(ETU, 'select visibilite from public.profils where id = $1', [LAU]))[0].visibilite, {});
  await refuse(q(LAU, `update public.profiles set visibilite = '{"travail":"personne"}' where id = $1`, [LAU]), /visibilite/);
  await q(LAU, `update public.profiles set visibilite = '{}' where id = $1`, [LAU]);
});

test('coordonnées : le contact du profil devient privé, visible après accord', async () => {
  assert.equal((await q(LAU, 'select contact from public.profiles where id = $1', [LAU]))[0].contact, null);
  assert.equal((await q(LAU, 'select contact from public.coordonnees where id = $1', [LAU]))[0].contact, '06 11 22 33 44');
  assert.equal((await q(ETU, 'select * from public.coordonnees where id = $1', [LAU])).length, 0);
  const [d] = await q(ETU, `insert into public.demandes_contact (demandeur_id, cible_id, message) values ($1, $2, 'Bonjour') returning id, status`, [ETU, LAU]);
  assert.equal(d.status, 'envoyee');
  // Le demandeur ne peut pas accepter sa propre demande
  await q(ETU, `update public.demandes_contact set status = 'acceptee' where id = $1`, [d.id]);
  assert.equal((await q(ETU, 'select status from public.demandes_contact where id = $1', [d.id]))[0].status, 'envoyee');
  assert.equal((await q(ETU, 'select * from public.coordonnees where id = $1', [LAU])).length, 0);
  await q(LAU, `update public.demandes_contact set status = 'acceptee' where id = $1`, [d.id]);
  assert.equal((await q(ETU, 'select contact from public.coordonnees where id = $1', [LAU]))[0].contact, '06 11 22 33 44');
  // Un ancien site qui envoie encore « contact » dans le profil : il part dans les coordonnées
  await q(ETU, `update public.profiles set contact = 'salma@gmail.com' where id = $1`, [ETU]);
  assert.equal((await q(ETU, 'select contact from public.profiles where id = $1', [ETU]))[0].contact, null);
  assert.equal((await q(LAU, 'select contact from public.coordonnees where id = $1', [ETU]))[0].contact, 'salma@gmail.com');
  assert.equal((await q(ETU2, 'select * from public.coordonnees where id = $1', [ETU])).length, 0);
  // Retrait de l'accord
  await q(LAU, `update public.demandes_contact set status = 'refusee' where id = $1`, [d.id]);
  assert.equal((await q(ETU, 'select * from public.coordonnees where id = $1', [LAU])).length, 0);
  await refuse(q(ETU, `insert into public.demandes_contact (demandeur_id, cible_id) values ($1, $1)`, [ETU]));
});

test('coordonnées : l’auteur d’une offre voit celles de l’étudiant qui a postulé', async () => {
  const [o] = await q(LAU2, `insert into public.offers (author_id, type, titre, entreprise, description, annees, filieres) values ($1, 'pfe', 'PFE Lean', 'OCP', 'desc', '{5}', '{}') returning id`, [LAU2]);
  assert.equal((await q(LAU2, 'select * from public.coordonnees where id = $1', [ETU])).length, 0);
  await q(ETU, `insert into public.applications (student_id, offer_id, entreprise) values ($1, $2, 'x')`, [ETU, o.id]);
  assert.equal((await q(LAU2, 'select contact from public.coordonnees where id = $1', [ETU]))[0].contact, 'salma@gmail.com');
  // mais pas l'inverse
  await q(LAU2, `insert into public.coordonnees (id, telephone) values ($1, '0600000000')`, [LAU2]);
  assert.equal((await q(ETU, 'select * from public.coordonnees where id = $1', [LAU2])).length, 0);
});

test('relecture de CV : dépôt, demande, prise par un lauréat, commentaires, merci', async () => {
  await refuse(q(ETU, `insert into public.relectures_cv (student_id, cv_path) values ($1, 'x')`, [ETU]), /Dépose d’abord ton CV/);
  await refuse(q(ETU, `update public.profiles set cv_path = $2 where id = $1`, [ETU, `${ETU2}/cv.pdf`]), /cv_path/);
  await q(ETU, `update public.profiles set cv_path = $2, cv_maj = now() where id = $1`, [ETU, `${ETU}/cv-1.pdf`]);
  const [r] = await q(ETU, `insert into public.relectures_cv (student_id, cv_path, message) values ($1, 'ignoré', 'Je vise un PFE') returning *`, [ETU]);
  assert.equal(r.cv_path, `${ETU}/cv-1.pdf`);
  assert.equal(r.status, 'demandee');
  // Les lauréats voient la demande ouverte, pas les autres étudiants
  assert.equal((await q(LAU2, 'select id from public.relectures_cv')).length, 1);
  assert.equal((await q(ETU2, 'select id from public.relectures_cv')).length, 0);
  // Le CV : visible du lauréat (relecture ouverte et visibilité par défaut), pas de l'autre étudiant
  assert.equal((await q(LAU2, 'select public.peut_voir_cv($1) v', [`${ETU}/cv-1.pdf`]))[0].v, true);
  assert.equal((await q(ETU2, 'select public.peut_voir_cv($1) v', [`${ETU}/cv-1.pdf`]))[0].v, false);
  assert.equal((await q(ETU2, 'select cv_path from public.profils where id = $1', [ETU]))[0].cv_path, null);
  assert.equal((await q(LAU, 'select cv_path from public.profils where id = $1', [ETU]))[0].cv_path, `${ETU}/cv-1.pdf`);
  // Un étudiant ne peut pas prendre la demande
  await q(ETU2, `update public.relectures_cv set reviewer_id = $2 where id = $1`, [r.id, ETU2]);
  assert.equal((await q(ETU, 'select reviewer_id from public.relectures_cv where id = $1', [r.id]))[0].reviewer_id, null);
  await q(LAU2, `update public.relectures_cv set reviewer_id = $2 where id = $1`, [r.id, LAU2]);
  const [pris] = await q(ETU, 'select reviewer_id, status from public.relectures_cv where id = $1', [r.id]);
  assert.deepEqual(pris, { reviewer_id: LAU2, status: 'en_cours' });
  await refuse(q(LAU2, `update public.relectures_cv set status = 'rendue' where id = $1`, [r.id]), /au moins un commentaire/);
  await refuse(q(LAU, `insert into public.relecture_commentaires (relecture_id, author_id, body) values ($1, $2, 'x')`, [r.id, LAU]), /Seuls/);
  await q(LAU2, `insert into public.relecture_commentaires (relecture_id, author_id, section, body) values ($1, $2, 'experience', 'Chiffre tes résultats')`, [r.id, LAU2]);
  await q(LAU2, `update public.relectures_cv set status = 'rendue', synthese = 'Bon CV' where id = $1`, [r.id]);
  assert.equal((await q(ETU, 'select status from public.relectures_cv where id = $1', [r.id]))[0].status, 'rendue');
  assert.equal((await q(ETU, 'select body from public.relecture_commentaires where relecture_id = $1', [r.id])).length, 1);
  assert.equal((await q(ETU2, 'select body from public.relecture_commentaires')).length, 0);
  await q(ETU, `update public.relectures_cv set merci = 'Merci !', note = 5 where id = $1`, [r.id]);
  assert.equal((await q(LAU2, 'select merci from public.relectures_cv where id = $1', [r.id]))[0].merci, 'Merci !');
  // Deux demandes en cours au plus
  await q(ETU, `insert into public.relectures_cv (student_id, cv_path) values ($1, '')`, [ETU]);
  await q(ETU, `insert into public.relectures_cv (student_id, cv_path, reviewer_id) values ($1, '', $2)`, [ETU, LAU]);
  await refuse(q(ETU, `insert into public.relectures_cv (student_id, cv_path) values ($1, '')`, [ETU]), /2 relectures en cours/);
});

test('entretiens et avis : anonymes pour les autres, avis vérifié par une réussite confirmée', async () => {
  await q(ETU, `insert into public.entretiens (author_id, entreprise, questions, anonyme) values ($1, 'Renault', '{"Présente-toi", "  ", "Pourquoi Renault ?"}', true)`, [ETU]);
  await refuse(q(ETU, `insert into public.entretiens (author_id, entreprise, questions) values ($1, 'OCP', '{" "}')`, [ETU]), /questions/);
  const autres = await q(ETU2, 'select author_id, questions from public.entretiens_publics');
  assert.equal(autres.length, 1);
  assert.equal(autres[0].author_id, null);
  assert.deepEqual(autres[0].questions, ['Présente-toi', 'Pourquoi Renault ?']);
  assert.equal((await q(ETU, 'select author_id from public.entretiens_publics'))[0].author_id, ETU);
  assert.equal((await q(ADMIN, 'select author_id from public.entretiens_publics'))[0].author_id, ETU);
  assert.equal((await q(ETU2, 'select * from public.entretiens')).length, 0);
  // Réussite confirmée chez Renault cette saison : l'avis est vérifié
  const [pl] = await q(LAU, `insert into public.placements (student_id, laureat_id, saison, niveau, type, entreprise) values ($1, $2, $3, 5, 'pfe', 'Renault Group Maroc') returning id`, [ETU, LAU, S]);
  await q(ETU, `update public.placements set status = 'confirme' where id = $1`, [pl.id]);
  const [a] = await q(ETU, `insert into public.avis_stage (author_id, entreprise, saison, note, anonyme) values ($1, 'Renault', $2, 4, true) returning verifie, placement_id`, [ETU, S]);
  assert.equal(a.verifie, true);
  assert.equal(a.placement_id, pl.id);
  assert.equal((await q(ETU2, 'select placement_id, author_id, verifie from public.avis_publics'))[0].author_id, null);
  await refuse(q(ETU, `insert into public.avis_stage (author_id, entreprise, saison, note) values ($1, 'renault', $2, 2)`, [ETU, S]), /avis_stage_un_par_saison/);
  const [b] = await q(ETU2, `insert into public.avis_stage (author_id, entreprise, saison, note) values ($1, 'Renault', $2, 2) returning verifie`, [ETU2, S]);
  assert.equal(b.verifie, false);
});

test('guide de l’étranger : écrit par les lauréats du pays, avec historique', async () => {
  await refuse(q(ETU, `insert into public.guide_pays (pays, section, contenu) values ('France', 'visa', 'x')`), /lauréats qui vivent/);
  await refuse(q(LAU, `insert into public.guide_pays (pays, section, contenu) values ('France', 'visa', 'x')`), /lauréats qui vivent/);
  await refuse(q(LAU, `insert into public.guide_pays (pays, section, contenu) values ('Maroc', 'visa', 'x')`), /lauréats qui vivent/);
  const [g] = await q(LAU_FR, `insert into public.guide_pays (pays, section, contenu) values ('france', 'visa', 'Prendre rendez-vous tôt') returning id, updated_by`);
  assert.equal(g.updated_by, LAU_FR);
  await q(LAU_FR, `update public.guide_pays set contenu = 'Prendre rendez-vous 3 mois avant', pays = 'Canada' where id = $1`, [g.id]);
  const [maj] = await q(ETU, 'select pays, contenu from public.guide_pays where id = $1', [g.id]);
  assert.deepEqual(maj, { pays: 'france', contenu: 'Prendre rendez-vous 3 mois avant' });
  assert.equal((await q(ETU, 'select contenu from public.guide_pays_historique where guide_id = $1', [g.id]))[0].contenu, 'Prendre rendez-vous tôt');
  await refuse(q(LAU_FR, `insert into public.guide_pays (pays, section, contenu) values ('France', 'visa', 'doublon')`), /guide_pays_pays_cle_section/);
});

test('signalements : privés, traités par l’administration', async () => {
  const [o] = await q(ETU, 'select id from public.offers limit 1');
  const [s] = await q(ETU, `insert into public.signalements (auteur_id, cible_type, cible_id, motif) values ($1, 'offre', $2, 'spam') returning id`, [ETU, o.id]);
  await refuse(q(ETU, `insert into public.signalements (auteur_id, cible_type, cible_id, motif) values ($1, 'offre', $2, 'faux')`, [ETU, o.id]), /duplicate/);
  assert.equal((await q(ETU2, 'select * from public.signalements')).length, 0);
  await q(ETU, `update public.signalements set status = 'traite' where id = $1`, [s.id]);
  assert.equal((await q(ADMIN, 'select status from public.signalements where id = $1', [s.id]))[0].status, 'ouvert');
  await q(ADMIN, `update public.signalements set status = 'traite' where id = $1`, [s.id]);
  const [t] = await q(ADMIN, 'select status, traite_par from public.signalements where id = $1', [s.id]);
  assert.deepEqual(t, { status: 'traite', traite_par: ADMIN });
});

test('anti-spam : limite par jour et texte identique refusé', async () => {
  for (let i = 0; i < 5; i++) await q(ETU2, `insert into public.questions (author_id, categorie, titre) values ($1, 'Stage', $2)`, [ETU2, `Question numéro ${i}`]);
  await refuse(q(ETU2, `insert into public.questions (author_id, categorie, titre) values ($1, 'Stage', 'Encore une question')`, [ETU2]), /beaucoup publié/);
  const [o] = await q(ETU, 'select id from public.offers limit 1');
  await q(ETU2, `insert into public.comments (offer_id, author_id, body) values ($1, $2, 'Super offre')`, [o.id, ETU2]);
  await refuse(q(ETU2, `insert into public.comments (offer_id, author_id, body) values ($1, $2, ' super offre ')`, [o.id, ETU2]), /exactement ce texte/);
  // L'administration n'est pas limitée
  for (let i = 0; i < 7; i++) await q(ADMIN, `insert into public.questions (author_id, categorie, titre) values ($1, 'Stage', $2)`, [ADMIN, `Annonce numéro ${i}`]);
});

test('enquête d’insertion : lauréats seulement, résultats agrégés', async () => {
  await refuse(q(ETU, `insert into public.enquetes_insertion (user_id, vague, promo, situation) values ($1, 6, 2025, 'emploi')`, [ETU]), /lauréats/);
  const [e] = await q(LAU, `insert into public.enquetes_insertion (user_id, vague, promo, situation, salaire, delai_mois, pays) values ($1, 6, 1999, 'emploi', '10_15', 2, 'France') returning promo, filiere`, [LAU]);
  assert.deepEqual(e, { promo: 2018, filiere: 'Génie Industriel' });
  await refuse(q(LAU, `insert into public.enquetes_insertion (user_id, vague, promo, situation) values ($1, 6, 2018, 'recherche')`, [LAU]), /duplicate/);
  assert.equal((await q(LAU2, 'select * from public.enquetes_insertion')).length, 0);
  // Une seule réponse : rien pour les membres (anonymat sous 5 réponses), le détail pour l'administration
  assert.deepEqual((await q(ETU, 'select public.stats_insertion()'))[0].stats_insertion, []);
  const [{ stats_insertion: st }] = await q(ADMIN, 'select public.stats_insertion()');
  assert.equal(st.length, 1);
  assert.equal(st[0].n, 1);
  assert.equal(st[0].en_poste, 1);
  assert.equal(st[0].etranger, 1);
  assert.deepEqual(st[0].salaires, { '10_15': 1 });
});

test('liste officielle : import par l’administration, vérification automatique', async () => {
  await refuse(q(ETU, `select public.importer_liste('[]'::jsonb)`), /Réservé/);
  assert.equal((await q(ETU2, 'select verified from public.profiles where id = $1', [ETU2]))[0].verified, false);
  const lignes = [
    { nom: 'TAZI Omar', promo: S + 1, filiere: 'Génie Industriel' },
    { nom: 'Lina Berrada', email: 'Lina@Exemple.MA', promo: S + 2 },
    { nom: 'X', promo: 2026 },
    { nom: 'Sans promo' },
  ];
  const [{ importer_liste: r }] = await q(ADMIN, 'select public.importer_liste($1::jsonb)', [JSON.stringify(lignes)]);
  assert.deepEqual(r, { importes: 2, rejetes: 2, verifies: 1 });
  assert.equal((await q(ETU2, 'select verified from public.profiles where id = $1', [ETU2]))[0].verified, true);
  assert.equal((await q(ETU, 'select * from public.liste_officielle')).length, 0);
  // Nouvelle inscription avec l'email de la liste : vérifiée tout de suite, même avec un autre nom
  await creerCompte(db, { id: NOUVEAU, email: 'lina@exemple.ma', full_name: 'Lina B.', role: 'etudiant', filiere: 'Génie Mécanique', promo: S + 2 });
  assert.equal((await q(NOUVEAU, 'select verified from public.profiles where id = $1', [NOUVEAU]))[0].verified, true);
  const [{ couverture_liste: c }] = await q(ADMIN, 'select public.couverture_liste()');
  assert.equal(c.reduce((s, x) => s + x.inscrits, 0), 2);
  // Réimport : mise à jour sans doublon
  await q(ADMIN, 'select public.importer_liste($1::jsonb)', [JSON.stringify([{ nom: 'Omar  Tazi', promo: S + 1, matricule: 'A123' }, { nom: 'Hiba Amrani', promo: S + 1 }])]);
  assert.equal((await q(ADMIN, 'select count(*)::int n from public.liste_officielle'))[0].n, 3);
  assert.deepEqual((await q(ADMIN, 'select nom from public.manquants_liste($1)', [S + 1])).map(x => x.nom), ['Hiba Amrani']);
});

test('alertes d’offres : notification aux étudiants concernés, email groupé', async () => {
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example/a', 'k', 'a'), ($2, 'https://push.example/b', 'k', 'a')`, [ETU, ETU2]);
  await db.query('delete from public.push_queue');
  await q(LAU, `insert into public.offers (author_id, type, titre, entreprise, description, annees, filieres) values ($1, 'pfe', 'PFE Supply chain', 'Renault', 'desc', '{5}', '{"Génie Industriel"}')`, [LAU]);
  await q(LAU, `insert into public.offers (author_id, type, titre, entreprise, description, annees, filieres) values ($1, 'stage', 'Stage 3A', 'Renault', 'desc', '{3}', '{}')`, [LAU]);
  const file = (await db.query(`select user_id, data from public.push_queue where kind = 'offre_alerte' order by id`)).rows;
  assert.deepEqual(file.map(x => x.user_id).sort(), [ETU, ETU2].sort());
  assert.equal(file[0].data.titre, 'PFE Supply chain');
  await q(ETU2, 'update public.profiles set alertes_email = false where id = $1', [ETU2]);
  const a = (await db.query('select * from public.alertes_a_envoyer(50)')).rows;
  const moi = a.find(x => x.id === ETU);
  assert.ok(moi, 'Salma reçoit une alerte');
  assert.equal(moi.email, 'salma@exemple.ma');
  assert.ok(moi.offres.some(o => o.titre === 'PFE Supply chain'));
  assert.ok(!moi.offres.some(o => o.titre === 'Stage 3A'));
  assert.ok(!a.some(x => x.id === ETU2));
  await db.query('select public.alertes_envoyees($1::uuid[])', [[ETU]]);
  assert.ok(!(await db.query('select * from public.alertes_a_envoyer(50)')).rows.some(x => x.id === ETU));
  await refuse(q(ETU, 'select * from public.alertes_a_envoyer(50)'), /permission denied/);
  const [{ se_desabonner_alertes: ok }] = (await db.query(`select public.se_desabonner_alertes((select token from public.notif_etat where user_id = $1))`, [ETU])).rows;
  assert.equal(ok, true);
});

test('stockage des CV : chacun dépose dans son dossier, la lecture suit la visibilité', async () => {
  const b = (await db.query(`select public, file_size_limit::int as file_size_limit, allowed_mime_types from storage.buckets where id = 'cv'`)).rows[0];
  assert.deepEqual(b, { public: false, file_size_limit: 2097152, allowed_mime_types: ['application/pdf'] });
  await q(ETU, `insert into storage.objects (bucket_id, name, owner) values ('cv', $1, $2)`, [`${ETU}/cv-1.pdf`, ETU]);
  await refuse(q(ETU, `insert into storage.objects (bucket_id, name, owner) values ('cv', $1, $2)`, [`${ETU2}/cv-1.pdf`, ETU]), /row-level security/);
  await refuse(q(ETU, `insert into storage.objects (bucket_id, name, owner) values ('cv', $1, $2)`, [`${ETU}/cv.exe`, ETU]), /row-level security/);
  assert.equal((await q(ETU2, `select name from storage.objects where bucket_id = 'cv'`)).length, 0);
  assert.equal((await q(LAU, `select name from storage.objects where bucket_id = 'cv'`)).length, 1);
  await q(ETU, `update public.profiles set visibilite = '{"cv":"contacts"}' where id = $1`, [ETU]);
  // Ses demandes de relecture encore ouvertes laissent les lauréats lire le CV : on les annule
  assert.equal((await q(LAU, `select name from storage.objects where bucket_id = 'cv'`)).length, 1);
  await q(ETU, `update public.relectures_cv set status = 'annulee' where status in ('demandee', 'en_cours')`);
  assert.equal((await q(LAU, `select name from storage.objects where bucket_id = 'cv'`)).length, 0);
  assert.equal((await q(LAU2, `select name from storage.objects where bucket_id = 'cv'`)).length, 1);  // a postulé à son offre
  await q(ETU, `update public.profiles set visibilite = '{}' where id = $1`, [ETU]);
  await q(ETU2, `delete from storage.objects where name = $1`, [`${ETU}/cv-1.pdf`]);
  assert.equal((await db.query(`select count(*)::int n from storage.objects`)).rows[0].n, 1);
});

test('vérification par deux lauréats vérifiés de la même promo', async () => {
  const A = uid(21), B = uid(22), C = uid(23), D = uid(24);
  for (const [id, nom] of [[A, 'Ali Amrani'], [B, 'Badr Bakkali'], [C, 'Chama Chraibi'], [D, 'Dina Douiri']]) await creerCompte(db, { id, full_name: nom, role: 'laureat', filiere: 'Génie Civil', promo: 2015 });
  await db.query('update public.profiles set verified = true where id = any($1)', [[A, B]]);
  assert.equal((await db.query(`select count(*)::int n from public.push_queue where kind = 'verifier_pair'`)).rows[0].n, 0);  // personne n'a de téléphone abonné
  // C (non vérifiée) ne peut pas confirmer D ; un lauréat d'une autre promo non plus
  await refuse(q(C, 'insert into public.verifications_pairs (laureat_id, verificateur_id) values ($1, $2)', [D, C]), /même promo/);
  await refuse(q(LAU, 'insert into public.verifications_pairs (laureat_id, verificateur_id) values ($1, $2)', [D, LAU]), /même promo/);
  await refuse(q(A, 'insert into public.verifications_pairs (laureat_id, verificateur_id) values ($1, $2)', [ETU, A]), /profil de lauréat/);
  await q(A, 'insert into public.verifications_pairs (laureat_id, verificateur_id) values ($1, $2)', [D, B]);  // verificateur forcé à A
  assert.equal((await db.query('select verificateur_id from public.verifications_pairs where laureat_id = $1', [D])).rows[0].verificateur_id, A);
  assert.equal((await db.query('select verified from public.profiles where id = $1', [D])).rows[0].verified, false);
  await q(B, 'insert into public.verifications_pairs (laureat_id, verificateur_id) values ($1, $2)', [D, B]);
  assert.equal((await db.query('select verified from public.profiles where id = $1', [D])).rows[0].verified, true);
  // L'administration retire la vérification : les confirmations partent aussi, et une modification du profil ne la remet pas
  await q(ADMIN, 'update public.profiles set verified = false where id = $1', [D]);
  assert.equal((await db.query('select count(*)::int n from public.verifications_pairs where laureat_id = $1', [D])).rows[0].n, 0);
  await q(D, `update public.profiles set bio = 'Bonjour' where id = $1`, [D]);
  assert.equal((await db.query('select verified from public.profiles where id = $1', [D])).rows[0].verified, false);
});

test('email de l’école : vérification automatique, puis obligatoire si l’administration le demande', async () => {
  await refuse(q(ETU, `insert into public.reglages (cle, valeur) values ('domaines_ecole', '["edu.umi.ac.ma"]')`), /row-level security/);
  await q(ADMIN, `insert into public.reglages (cle, valeur) values ('domaines_ecole', '["edu.umi.ac.ma"]')`);
  const lus = await en(db, null, tx => tx.query('select valeur from public.reglages'), { role: 'anon' });
  assert.deepEqual(lus.rows[0].valeur, ['edu.umi.ac.ma']);
  const E1 = uid(31), E2 = uid(32), E3 = uid(33);
  await creerCompte(db, { id: E1, email: 'h.amrani@edu.umi.ac.ma', full_name: 'Hiba Ouali', role: 'etudiant', filiere: 'Génie Civil', promo: S + 2 });
  assert.equal((await db.query('select verified from public.profiles where id = $1', [E1])).rows[0].verified, true);
  await creerCompte(db, { id: E2, email: 'e2@gmail.com', full_name: 'Ehab Two', role: 'etudiant', filiere: 'Génie Civil', promo: S + 2 });
  assert.equal((await db.query('select verified from public.profiles where id = $1', [E2])).rows[0].verified, false);
  await q(ADMIN, `insert into public.reglages (cle, valeur) values ('email_ecole_obligatoire', 'true')`);
  await refuse(creerCompte(db, { id: E3, email: 'e3@gmail.com', full_name: 'Ehab Three', role: 'etudiant', filiere: 'Génie Civil', promo: S + 2 }), /email de l’école \(@edu\.umi\.ac\.ma\)/);
  // Un lauréat s'inscrit avec n'importe quel email
  await creerCompte(db, { id: uid(34), email: 'l@gmail.com', full_name: 'Laila Four', role: 'laureat', filiere: 'Génie Civil', promo: 2012 });
  await q(ADMIN, `update public.reglages set valeur = 'false' where cle = 'email_ecole_obligatoire'`);
});

test('agenda de l’école : publié par l’administration, « J’y vais » par chacun', async () => {
  await refuse(q(ETU, `insert into public.evenements (titre, debut) values ('Forum', now() + interval '3 days')`), /row-level security/);
  const [e] = await q(ADMIN, `insert into public.evenements (author_id, titre, type, debut, public) values ($1, 'Forum ENSAM Entreprises', 'forum', now() + interval '3 days', 'tous') returning id`, [ADMIN]);
  assert.ok((await db.query(`select count(*)::int n from public.push_queue where kind = 'evenement'`)).rows[0].n >= 2);
  await q(ETU, 'insert into public.evenement_participants (evenement_id, user_id) values ($1, $2)', [e.id, ETU2]);
  assert.equal((await q(ETU2, 'select user_id from public.evenement_participants where evenement_id = $1', [e.id]))[0].user_id, ETU);
  await q(ADMIN, 'update public.evenements set annule = true where id = $1', [e.id]);
  assert.equal((await db.query(`select count(*)::int n from public.push_queue where kind = 'evenement_annule'`)).rows[0].n, 1);
  await refuse(q(ETU2, 'insert into public.evenement_participants (evenement_id, user_id) values ($1, $2)', [e.id, ETU2]), /annulé/);
});

test('enquête automatique : invitation à l’ouverture de la vague, puis un rappel', async () => {
  const P = new Date().getFullYear() - 1;  // diplômés l'an dernier : une vague est ouverte toute l'année
  const G = uid(41);
  await creerCompte(db, { id: G, email: 'g@exemple.ma', full_name: 'Ghita Grad', role: 'laureat', filiere: 'Génie Civil', promo: P });
  const vague = (await db.query('select public.vague_ouverte($1) v', [P])).rows[0].v;
  assert.ok([6, 12].includes(vague));
  const a = (await db.query('select * from public.enquetes_a_inviter(500)')).rows.find(x => x.id === G);
  assert.equal(a.vague, vague); assert.equal(a.rappel, false); assert.equal(a.email_ok, true);
  await db.query('select public.enquetes_invitees($1::jsonb)', [JSON.stringify([{ id: G, vague, rappel: false }])]);
  assert.ok(!(await db.query('select * from public.enquetes_a_inviter(500)')).rows.some(x => x.id === G));
  await db.query(`update public.notif_etat set enquete_at = now() - interval '22 days' where user_id = $1`, [G]);
  assert.equal((await db.query('select * from public.enquetes_a_inviter(500)')).rows.find(x => x.id === G).rappel, true);
  await q(G, `insert into public.enquetes_insertion (user_id, vague, promo, situation, delai_mois) values ($1, $2, 0, 'emploi', 3)`, [G, vague]);
  assert.ok(!(await db.query('select * from public.enquetes_a_inviter(500)')).rows.some(x => x.id === G));
  // Rapport pour l'accréditation : administration seulement
  await refuse(q(ETU, 'select * from public.rapport_insertion()'), /Réservé/);
  const r = await q(ADMIN, 'select * from public.rapport_insertion()');
  const ligne = r.find(x => x.promo === P && x.filiere === 'Génie Civil' && x.vague === vague);
  assert.equal(ligne.repondants, 1); assert.equal(ligne.en_poste, 1); assert.equal(Number(ligne.taux_insertion), 1);
});

test('anti-spam : 10 candidatures par jour au plus', async () => {
  const offres = [];
  for (let i = 0; i < 11; i++) offres.push((await q(ADMIN, `insert into public.offers (author_id, type, titre, entreprise, description, annees) values ($1, 'stage', $2, 'X', 'd', '{4}') returning id`, [ADMIN, 'Offre ' + i]))[0].id);
  const E = uid(51);
  await creerCompte(db, { id: E, full_name: 'Postule Beaucoup', role: 'etudiant', filiere: 'Génie Civil', promo: S + 2 });
  for (let i = 0; i < 10; i++) await q(E, `insert into public.applications (student_id, offer_id, entreprise) values ($1, $2, 'x')`, [E, offres[i]]);
  await refuse(q(E, `insert into public.applications (student_id, offer_id, entreprise) values ($1, $2, 'x')`, [E, offres[10]]), /beaucoup publié/);
});
