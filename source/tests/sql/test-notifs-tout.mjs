// Notifications pour tout : une par message (anti-spam de 20 s par conversation), tout activé par défaut,
// nouvelles offres aux lauréats, demande ouverte à tous, nouveaux membres de la promo, commentaires sous une offre,
// annonces, mentorat ouvert à tous. Une catégorie coupée dans Mon profil : rien.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const ETU = uid(501), ETU2 = uid(502), LAU = uid(503), LAU2 = uid(504), CIVIL = uid(505), CHERCHE = uid(506), ADMIN = uid(507), ETU_GC = uid(508);
const GI = 'Génie Industriel et Productique', GC = 'Génie Civil';
const NOMS = { [ETU]: 'ETU', [ETU2]: 'ETU2', [LAU]: 'LAU', [LAU2]: 'LAU2', [CIVIL]: 'CIVIL', [CHERCHE]: 'CHERCHE', [ADMIN]: 'ADMIN', [ETU_GC]: 'ETU_GC' };
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const vider = () => db.query('delete from public.push_queue');
const file = async kind => (await db.query('select user_id, kind, data from public.push_queue' + (kind ? ' where kind = $1' : '') + ' order by id', kind ? [kind] : [])).rows
  .map(r => ({ qui: NOMS[r.user_id] || r.user_id, kind: r.kind, data: r.data }));
const qui = async kind => (await file(kind)).map(x => x.qui).sort();
const choisir = (u, v) => db.query('update public.profiles set notif_push = $2::jsonb where id = $1', [u, JSON.stringify(v)]);
const abonner = ids => db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://push.example/' || id, 'k', 'a' from unnest($1::uuid[]) id`, [ids]);
// Le temps passe pour l'anti-spam (notif_cadence) : la dernière notification d'une clé recule
const reculer = (motif, intervalle) => db.query(`update public.notif_cadence set at = at - $2::interval where cle like $1`, [motif, intervalle]);

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ETU, full_name: 'Salma Bennani', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: ETU2, full_name: 'Hiba Alaoui', role: 'etudiant', filiere: GI, promo: S + 1 });
  await creerCompte(db, { id: LAU, full_name: 'Youssef Amrani', role: 'laureat', filiere: GI, promo: 2015, entreprise: 'Renault' });
  await creerCompte(db, { id: LAU2, full_name: 'Karim Tazi', role: 'laureat', filiere: GI, promo: 2018, entreprise: 'OCP' });
  await creerCompte(db, { id: CIVIL, full_name: 'Nadia Civil', role: 'laureat', filiere: GC, promo: 2016 });
  await creerCompte(db, { id: CHERCHE, full_name: 'Halima Cherche', role: 'laureat', filiere: GI, promo: 2020 });
  await creerCompte(db, { id: ADMIN, full_name: 'Admin École', role: 'etudiant', filiere: GI, promo: 2010 });
  await creerCompte(db, { id: ETU_GC, full_name: 'Omar Civil', role: 'etudiant', filiere: GC, promo: S + 1 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  await db.query(`update public.profiles set en_recherche = true where id = $1`, [CHERCHE]);
  await db.query(`update public.profiles set cv_path = id::text || '/cv-1730000000000.pdf' where id = any($1::uuid[])`, [[ETU, ETU2, ETU_GC]]);
  // Une conversation ouverte entre Salma et Youssef (mentorat accepté)
  await db.query(`insert into public.mentorships (student_id, mentor_id, sujet, status, accepted_at) values ($1, $2, 'Conseil', 'acceptee', now())`, [ETU, LAU]);
  await abonner(Object.keys(NOMS));
});

test('défauts : tout est activé pour tous les membres, nouvelles offres comprises pour un lauréat ; un choix déjà fait reste', async () => {
  const voulu = async (u, k) => (await db.query('select public.push_voulu($1, $2) v', [u, k])).rows[0].v;
  for (const u of [ETU, LAU, CHERCHE]) {
    for (const k of ['message', 'offre_alerte', 'demande_nouvelle', 'demande_large', 'candidature', 'mentorat_ouvert', 'promo_nouveau', 'offre_commentaire', 'annonce', 'rappel_visite']) {
      assert.equal(await voulu(u, k), true, `${NOMS[u]} ${k}`);
    }
  }
  // Catégories des nouveaux types
  const cat = async k => (await db.query('select public.push_categorie($1) c', [k])).rows[0].c;
  assert.deepEqual(await Promise.all(['demande_large', 'mentorat_ouvert', 'promo_nouveau', 'offre_commentaire', 'annonce'].map(cat)),
    ['demandes', 'mentorat', 'reseau', 'reseau', 'reseau']);
  // Un choix déjà fait reste : la case coupée, et l'ancienne case « M'alerter » décochée
  await choisir(LAU, { offres: false });
  assert.equal(await voulu(LAU, 'offre_alerte'), false);
  await choisir(LAU, {});
  await db.query('update public.profiles set alertes_offres = false where id = $1', [ETU2]);
  assert.equal(await voulu(ETU2, 'offre_alerte'), false);
  await choisir(ETU2, { offres: true });
  assert.equal(await voulu(ETU2, 'offre_alerte'), true, 'le choix explicite l’emporte');
  await choisir(ETU2, {});
  await db.query('update public.profiles set alertes_offres = true where id = $1', [ETU2]);
});

test('messages : une notification par message (même conversation, n non lus), au plus une toutes les 20 s ; catégorie coupée = rien', async () => {
  const ecrire = (de, a, body) => q(de, `insert into public.messages (author_id, dest_id, body) values ($1, $2, $3) returning id`, [de, a, body]);
  await vider();
  await ecrire(ETU, LAU, 'Bonjour Youssef');
  await ecrire(ETU, LAU, 'Tu as vu mon CV ?');
  let m = await file('message');
  assert.equal(m.length, 2, 'deux messages en 20 s : deux notifications, la seconde calme (le dernier message reste affiché)');
  assert.deepEqual([m[0].qui, m[0].data.de, m[0].data.texte, m[0].data.n, m[0].data.calme], ['LAU', ETU, 'Bonjour Youssef', 1, false]);
  assert.deepEqual([m[1].data.texte, m[1].data.n, m[1].data.calme], ['Tu as vu mon CV ?', 2, true]);
  // Plus de 20 s après : une notification pour le message suivant, avec le nombre de non lus et le dernier texte
  await reculer('message:%', '21 seconds');
  await ecrire(ETU, LAU, 'Je l’ai mis à jour');
  m = await file('message');
  assert.equal(m.length, 3);
  assert.deepEqual([m[2].data.de, m[2].data.texte, m[2].data.n, m[2].data.calme], [ETU, 'Je l’ai mis à jour', 3, false]);
  // Pas de rafale à attendre : un message seul, 20 s après, part même si les précédents ne sont pas lus (avant : 10 minutes)
  await reculer('message:%', '21 seconds');
  await ecrire(ETU, LAU, 'Merci !');
  assert.equal((await file('message')).length, 4);
  // Lu : le compte repart de un
  await q(LAU, 'select public.marquer_lus($1)', [ETU]);
  await reculer('message:%', '21 seconds');
  await ecrire(ETU, LAU, 'Encore une question');
  assert.equal((await file('message')).at(-1).data.n, 1);
  // L'anti-spam est par conversation : l'autre sens n'attend pas
  await ecrire(LAU, ETU, 'Avec plaisir');
  assert.deepEqual((await file('message')).at(-1).qui, 'ETU');
  // Catégorie « Messages » coupée : rien
  await vider();
  await choisir(LAU, { messages: false });
  await reculer('message:%', '21 seconds');
  await ecrire(ETU, LAU, 'Tu es là ?');
  assert.deepEqual(await file('message'), []);
  await choisir(LAU, {});
});

test('offres : chaque lauréat de la filière reçoit la nouvelle offre (« relayer » si elle ne le vise pas) ; partage d’étudiant : rien ; catégorie coupée : rien', async () => {
  const offre = (u, titre, champs = {}) => q(u, `insert into public.offers (author_id, type, titre, entreprise, description, annees, filieres, audience, origine, lien)
    values ($1, $2, $3, 'Renault', 'desc', $4, $5, $6, $7, $8) returning id`,
    [u, champs.type || 'stage', titre, champs.annees || `{${S + 6 - (S + 1)}}`, champs.filieres || '{}', champs.audience || 'etudiants', champs.origine || null, champs.lien || null]).then(r => r[0]);
  await vider();
  const o = await offre(LAU2, 'PFE Lean manufacturing', { origine: 'portee', type: 'pfe' });
  const par = Object.fromEntries((await file('offre_alerte')).map(x => [x.qui, x.data.pour || 'pour lui']));
  assert.deepEqual(par, { ETU: 'pour lui', ETU2: 'pour lui', ETU_GC: 'pour lui', LAU: 'relayer', CIVIL: 'relayer', CHERCHE: 'relayer' },
    'les étudiants visés, et tous les lauréats (toutes filières : l’offre est ouverte à toutes) ; jamais l’auteur ni l’administration');
  assert.ok((await file('offre_alerte')).every(x => x.data.offre === o.id && x.data.origine === 'portee'));
  // Une offre réservée à une filière : les lauréats des autres parcours ne sont pas dérangés
  await vider();
  await offre(LAU2, 'Stage chantier', { filieres: `{"${GC}"}` });
  assert.deepEqual(await qui('offre_alerte'), ['CIVIL', 'ETU_GC']);
  // Offre entre lauréats : tous les lauréats de la filière (en recherche : pour lui ; sinon : à faire suivre), aucun étudiant
  await vider();
  await offre(LAU2, 'Ingénieur méthodes', { audience: 'laureats', annees: '{}', type: 'emploi' });
  assert.deepEqual(Object.fromEntries((await file('offre_alerte')).map(x => [x.qui, x.data.pour || 'pour lui'])), { LAU: 'relayer', CIVIL: 'relayer', CHERCHE: 'pour lui' });
  // Le partage d'un étudiant reste sans notification (anti-spam)
  await vider();
  await offre(ETU, 'Stage vu sur LinkedIn', { origine: 'partagee', lien: 'https://exemple.ma/offre-1' });
  assert.deepEqual(await file('offre_alerte'), []);
  // Catégorie « Nouvelles offres » coupée : rien pour lui
  await choisir(LAU, { offres: false });
  await vider();
  await offre(LAU2, 'Stage maintenance');
  assert.ok(!(await qui('offre_alerte')).includes('LAU'));
  assert.ok((await qui('offre_alerte')).includes('CHERCHE'));
  await choisir(LAU, {});
});

test('demande ouverte à tous après 24 h : les lauréats des autres parcours, une seule fois ; déjà aidée : rien ; catégorie coupée : rien', async () => {
  await vider();
  const [d] = await q(ETU, `insert into public.demandes (auteur_id, type, titre, details, lieu) values ($1, 'pfe', 'PFE en amélioration continue', 'Lean, VSM et Power BI : je cherche un PFE en usine, de février à juin.', 'Casablanca') returning id`, [ETU]);
  assert.deepEqual(await qui('demande_nouvelle'), ['CHERCHE', 'LAU', 'LAU2'], 'à la publication : les lauréats du parcours');
  // Avant 24 h : rien de plus
  assert.equal((await db.query('select public.demandes_larges_push() n')).rows[0].n, 0);
  await db.query(`update public.demandes set created_at = now() - interval '25 hours' where id = $1`, [d.id]);
  await choisir(CIVIL, { demandes: false });
  assert.equal((await db.query('select public.demandes_larges_push() n')).rows[0].n, 0, 'le seul autre lauréat ne veut plus de « Demandes »');
  // Une autre demande, cette fois avec la case cochée ; passe par la tâche horaire
  await choisir(CIVIL, {});
  const [d2] = await q(ETU2, `insert into public.demandes (auteur_id, type, titre, details, lieu) values ($1, 'pfe', 'PFE supply chain', 'Planification, ERP et Power BI : je cherche un PFE en logistique, de février à juin.', 'Tanger') returning id`, [ETU2]);
  await db.query(`update public.demandes set created_at = now() - interval '25 hours' where id = $1`, [d2.id]);
  await vider();
  await db.query('select public.alertes_horaires()');
  const larges = await file('demande_large');
  assert.deepEqual(larges.map(x => x.qui), ['CIVIL'], 'les lauréats des autres parcours seulement (ceux du parcours l’ont eue à la publication)');
  assert.deepEqual(larges[0].data, { nom: 'Hiba', titre: 'PFE supply chain', type: 'pfe', demande: d2.id });
  // Une seule fois
  await vider();
  await db.query('select public.alertes_horaires()');
  assert.deepEqual(await file('demande_large'), []);
  // Une demande qui a déjà une aide proposée : pas de relance aux autres parcours
  const [d3] = await q(ETU_GC, `insert into public.demandes (auteur_id, type, titre, details, lieu) values ($1, 'pfe', 'PFE béton bas carbone', 'Formulation et essais de bétons bas carbone : je cherche un PFE en bureau d’études.', 'Rabat') returning id`, [ETU_GC]);
  await q(CIVIL, `insert into public.propositions (demande_id, laureat_id, aide, entreprise, poste, message) values ($1, $2, 'encadre', 'Vinci', 'PFE', 'Bonjour, j’ai un sujet de PFE dans mon équipe.')`, [d3.id, CIVIL]);
  await db.query(`update public.demandes set created_at = now() - interval '25 hours' where id = $1`, [d3.id]);
  await vider();
  assert.equal((await db.query('select public.demandes_larges_push() n')).rows[0].n, 0);
});

test('nouveau membre de ta promo : « Prénom a rejoint ta promo », au plus une par jour, avec le compte ; catégorie coupée : rien', async () => {
  const P = S + 2;
  const A = uid(520), B = uid(521), C = uid(522), D = uid(523), E = uid(524);
  await creerCompte(db, { id: A, full_name: 'Aya Promo', role: 'etudiant', filiere: GI, promo: P });
  await creerCompte(db, { id: B, full_name: 'Badr Promo', role: 'etudiant', filiere: GC, promo: P });
  await abonner([A, B]);
  await vider();
  await creerCompte(db, { id: C, full_name: 'Chaimae Nouvelle', role: 'etudiant', filiere: GI, promo: P });
  const p1 = await file('promo_nouveau');
  assert.deepEqual(p1.map(x => [x.qui, x.data]), [[A, { nom: 'Chaimae', n: 2, promo: P }], [B, { nom: 'Chaimae', n: 1, promo: P }]],
    'toute la promo, toutes filières ; le compte : arrivés depuis soi (Aya : Badr et Chaimae)');
  // Le même jour : une autre arrivée ne renvoie rien
  await vider();
  await creerCompte(db, { id: D, full_name: 'Driss Nouveau', role: 'etudiant', filiere: GI, promo: P });
  assert.deepEqual(await file('promo_nouveau'), [], 'au plus une par jour et par personne');
  await abonner([C, D]);
  // Le lendemain : une notification, qui compte aussi l'arrivée qu'on n'a pas annoncée
  await db.query(`update public.profiles set created_at = created_at - interval '25 hours' where promo = $1`, [P]);
  await reculer('promo:%', '25 hours');
  await choisir(B, { reseau: false });
  await vider();
  await creerCompte(db, { id: E, full_name: 'Elias Nouveau', role: 'etudiant', filiere: GI, promo: P });
  const p2 = await file('promo_nouveau');
  assert.deepEqual(p2.map(x => x.qui).sort(), [A, C, D].sort(), 'B a coupé « vie du réseau » : rien pour lui');
  assert.deepEqual(p2.find(x => x.qui === A).data, { nom: 'Elias', n: 2, promo: P }, 'Driss et Elias depuis la précédente');
  assert.equal(p2.find(x => x.qui === C).data.n, 2, 'Chaimae : Driss puis Elias, arrivés après elle');
  assert.equal(p2.find(x => x.qui === D).data.n, 1, 'Driss : Elias seulement');
  // Une autre promo n'est pas prévenue
  assert.ok(!p2.some(x => [ETU, ETU2, LAU].includes(x.qui)));
  await choisir(B, {});
});

test('commentaires : l’auteur de l’offre est prévenu, puis ceux qui ont écrit quand il répond ; au plus une toutes les 10 min', async () => {
  const [o] = await q(LAU, `insert into public.offers (author_id, type, titre, entreprise, description, annees, filieres) values ($1, 'stage', 'Stage qualité', 'Renault', 'desc', $2, '{}') returning id`, [LAU, `{${S + 6 - (S + 1)}}`]);
  const commenter = (u, body) => q(u, `insert into public.comments (offer_id, author_id, body) values ($1, $2, $3)`, [o.id, u, body]);
  await vider();
  await commenter(ETU, 'Le stage est-il rémunéré ?');
  let c = await file('offre_commentaire');
  assert.deepEqual(c.map(x => [x.qui, x.data.pour, x.data.nom, x.data.texte, x.data.offre]), [['LAU', 'auteur', 'Salma Bennani', 'Le stage est-il rémunéré ?', o.id]]);
  await commenter(ETU2, 'Et la durée ?');
  assert.equal((await file('offre_commentaire')).length, 1, 'une deuxième question dans les 10 minutes : la même notification suffit');
  await vider();
  await commenter(LAU, 'Oui, 3000 DH par mois, 4 mois.');
  c = await file('offre_commentaire');
  assert.deepEqual(c.map(x => [x.qui, x.data.pour]).sort(), [['ETU', 'fil'], ['ETU2', 'fil']]);
  // Catégorie coupée : rien
  await choisir(LAU, { reseau: false });
  await reculer('commentaire:%', '11 minutes');
  await vider();
  await commenter(ETU, 'Merci beaucoup !');
  assert.deepEqual(await file('offre_commentaire'), []);
  await choisir(LAU, {});
});

test('annonce de l’équipe : son public seulement ; mentorat ouvert à tous : les lauréats disponibles du parcours', async () => {
  await vider();
  await q(ADMIN, `insert into public.annonces (author_id, texte, public) values ($1, 'Forum entreprises jeudi à 10 h, amphi A', 'etudiants')`, [ADMIN]);
  const a = await file('annonce');
  assert.ok(a.length >= 3 && a.every(x => x.data.texte === 'Forum entreprises jeudi à 10 h, amphi A'));
  assert.ok(!a.some(x => ['LAU', 'LAU2', 'CIVIL', 'CHERCHE', 'ADMIN'].includes(x.qui)), 'les étudiants seulement');
  await db.query(`update public.profiles set mentor_dispo = true where id = any($1::uuid[])`, [[LAU2, CIVIL]]);
  await vider();
  const creneau = new Date(Date.now() + 3 * 864e5).toISOString();
  await q(ETU2, `insert into public.mentorships (student_id, sujet, besoin, creneaux) values ($1, 'Préparer un entretien', 'entretien', $2)`, [ETU2, [creneau]]);
  const mo = await file('mentorat_ouvert');
  assert.deepEqual(mo.map(x => x.qui), ['LAU2'], 'disponible et du même parcours');
  assert.deepEqual(mo[0].data, { nom: 'Hiba Alaoui', sujet: 'Préparer un entretien' });
  // Le lauréat choisi passe la main : les autres disponibles, pas lui
  await db.query(`update public.profiles set mentor_dispo = true where id = $1`, [LAU]);
  const [m] = await q(ETU, `insert into public.mentorships (student_id, mentor_id, sujet, besoin, creneaux) values ($1, $2, 'Relire mon CV', 'cv', $3) returning id`, [ETU, LAU2, [creneau]]);
  await vider();
  await q(LAU2, `update public.mentorships set mentor_id = null where id = $1`, [m.id]);
  assert.deepEqual((await file('mentorat_ouvert')).map(x => x.qui), ['LAU']);
});
