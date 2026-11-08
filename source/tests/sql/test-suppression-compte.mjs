// Supprimer son compte (supprimer_mon_compte, « Supprimer mon compte » du site) ou être supprimé par l'administration :
// ce qui visait le compte par un lien « on delete set null » reste, sans lien vers lui. Les gardes des tables (garde_ecole,
// protect_*) laissaient se vider ce lien en le refusant (« pas dans ton réseau » : le compte supprimé n'a plus d'école)
// ou en le remettant comme avant (un lien vers une ligne disparue, puis « pas dans ton réseau » au geste suivant).
// Un lauréat qui avait déclaré un recrutement ne pouvait plus supprimer son compte.
// Jamais une porte : une mise à jour ne passe ainsi que si elle ne fait QUE vider des liens vers des lignes qui n'existent plus.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nouvelleBase, creerCompte, en, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
const MAJ = process.env.MAJ_SQL || new URL('../../supabase/mise-a-jour.sql', import.meta.url).pathname;
const lireSql = chemin => fs.readFileSync(chemin, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, '');
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
let db;
const q = (b, u, sql, p) => en(b, u, tx => tx.query(sql, p)).then(r => r.rows);
const SUPPRIMER = 'select public.supprimer_mon_compte()';
const existe = async (b, id) => (await b.query('select (select count(*) from auth.users where id = $1)::int + (select count(*) from public.profiles where id = $1)::int n', [id])).rows[0].n;
const une = (b, sql, p) => b.query(sql, p).then(r => r.rows[0]);

// Chaque clé étrangère d'une colonne : les lignes qui visent une ligne disparue (aucune, dans une base saine)
export async function liensCasses(b) {
  const fks = (await b.query(`select k.conrelid::regclass::text t, a.attname c, k.confrelid::regclass::text r, f.attname rc
    from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
    join pg_attribute f on f.attrelid = k.confrelid and f.attnum = k.confkey[1]
    where k.contype = 'f' and cardinality(k.conkey) = 1 order by 1, 2`)).rows;
  const r = [];
  for (const k of fks) {
    const { rows: [x] } = await b.query(`select count(*)::int n from ${k.t} x where x.${k.c} is not null and not exists (select 1 from ${k.r} y where y.${k.rc} = x.${k.c})`);
    if (x.n) r.push(`${k.t}.${k.c} → ${k.r} (${x.n})`);
  }
  return r;
}

let n = 2100;
const ids = {};
async function membre(b, nom, role, ecole, extra = {}) {
  const id = uid(++n); ids[nom] = id;
  await creerCompte(b, { id, full_name: nom, role: role === 'admin' ? 'laureat' : role, filiere: 'Génie Industriel', promo: role === 'etudiant' ? S + 1 : 2015, ...(ecole ? { ecole } : {}), ...extra });
  if (role === 'admin') await b.query(`update public.profiles set role = 'admin' where id = $1`, [id]);
  return id;
}

// Dans une école : un lauréat qui a recruté (son offre, la candidature et l'entretien de l'étudiant, leur match), un relecteur
// (trois relectures), l'aidant d'une demande en match (et le recrutement déclaré depuis la demande), l'auteur d'un guide
async function ecole(b, k, slug) {
  const e = slug || 'ensam-meknes';
  const x = {
    L: await membre(b, `Youssef ${k}`, 'laureat', slug), E: await membre(b, `Salma ${k}`, 'etudiant', slug),
    R: await membre(b, `Nadia ${k}`, 'laureat', slug), A: await membre(b, `Karim ${k}`, 'laureat', slug),
    G: await membre(b, `Omar ${k}`, 'laureat', slug, { pays: 'France' }), E2: await membre(b, `Hiba ${k}`, 'etudiant', slug),
  };
  await b.exec('set session_replication_role = replica');
  x.O = (await une(b, `insert into public.offers (author_id, type, titre, entreprise, description, annees, ecole) values ($1, 'pfe', 'PFE qualité', 'OCP', 'd', '{5}', $2) returning id`, [x.L, e])).id;
  x.APP = (await une(b, `insert into public.applications (student_id, offer_id, entreprise, titre, status, note) values ($1, $2, 'OCP', 'PFE qualité', 'entretien', 'Relancer lundi') returning id`, [x.E, x.O])).id;
  x.ENT = (await une(b, `insert into public.entretiens (author_id, entreprise, offer_id, questions, ecole) values ($1, 'OCP', $2, '{"Pourquoi OCP ?"}', $3) returning id`, [x.E, x.O, e])).id;
  x.PL = (await une(b, `insert into public.placements (student_id, laureat_id, offer_id, saison, niveau, type, entreprise, source, status, ecole)
    values ($1, $2, $3, $4, 5, 'pfe', 'OCP', 'plateforme', 'en_attente', $5) returning id`, [x.E, x.L, x.O, S, e])).id;
  await b.query(`insert into public.matchs (etudiant_id, laureat_id, offre_id) values ($1, $2, $3)`, [x.E, x.L, x.O]);
  x.REL = {};
  for (const st of ['demandee', 'en_cours', 'rendue', 'annulee']) {
    x.REL[st] = (await une(b, `insert into public.relectures_cv (student_id, reviewer_id, cv_path, status, synthese, pris_at, ecole)
      values ($1, $2, 'cv.pdf', $3, $4, $5, $6) returning id`, [x.E, x.R, st, st === 'rendue' ? 'Très clair.' : null, st === 'demandee' ? null : new Date().toISOString(), e])).id;
  }
  x.D = (await une(b, `insert into public.demandes (auteur_id, type, titre, details, status, laureat_id, match_at, ecole) values ($1, 'pfe', 'PFE qualité', 'Je cherche un PFE en qualité, à Tanger.', 'match', $2, now(), $3) returning id`, [x.E2, x.A, e])).id;
  x.P = (await une(b, `insert into public.propositions (demande_id, laureat_id, aide, entreprise, message, status) values ($1, $2, 'encadre', 'Lear', 'Je peux t’encadrer.', 'acceptee') returning id`, [x.D, x.A])).id;
  await b.query(`update public.demandes set proposition_id = $2 where id = $1`, [x.D, x.P]);
  x.PLD = (await une(b, `insert into public.placements (student_id, laureat_id, demande_id, saison, niveau, type, entreprise, source, status, aide, ecole)
    values ($1, $2, $3, $4, 5, 'pfe', 'Lear', 'plateforme', 'confirme', 'encadre', $5) returning id`, [x.E2, x.A, x.D, S, e])).id;
  await b.query(`insert into public.avis_stage (author_id, entreprise, saison, note, placement_id, verifie, ecole) values ($1, 'Lear', $2, 4, $3, true, $4)`, [x.E2, S, x.PLD, e]);
  x.GU = (await une(b, `insert into public.guide_pays (pays, section, contenu, updated_by) values ($1, 'visa', 'Le visa étudiant', $2) returning id`, ['France ' + k, x.G])).id;
  await b.query(`insert into public.guide_pays_historique (guide_id, contenu, updated_by) values ($1, 'Ancien texte', $2)`, [x.GU, x.G]);
  await b.exec('set session_replication_role = origin');
  return x;
}

const M = {}, C = {}, ADM = {};
async function peupler(b) {
  // L'ENSAM Casablanca, ouverte le temps d'inscrire ses membres, puis fermée comme aujourd'hui
  await b.query(`update public.ecoles set ouverte = true where slug = 'ensam-casa'`);
  Object.assign(M, await ecole(b, 'Meknès'));
  Object.assign(C, await ecole(b, 'Casa', 'ensam-casa'));
  // L'administration du réseau (ENSAM Meknès) : deux admins qui ont écrit une carte sponsorisée, une annonce, un événement et
  // traité un signalement ; un troisième qui supprime ; l'administration de l'ENSAM Casablanca
  for (const k of ['A1', 'A2', 'A3']) ADM[k] = await membre(b, `Admin ${k}`, 'admin');
  ADM.AC = await membre(b, 'Admin Casa', 'admin', 'ensam-casa');
  await b.exec('set session_replication_role = replica');
  for (const a of [ADM.A1, ADM.A2]) {
    await b.query(`insert into public.sponsorises (entreprise, titre, texte, lien, fin, created_by) values ('OCP', 'Stages d’été', 'Des stages d’été pour les 4A.', 'https://ocp.ma', current_date + 7, $1)`, [a]);
    await b.query(`insert into public.annonces (author_id, texte) values ($1, 'Forum entreprises jeudi')`, [a]);
    await b.query(`insert into public.evenements (author_id, titre, debut) values ($1, 'Forum entreprises', now() + interval '3 days')`, [a]);
  }
  await b.query(`insert into public.signalements (auteur_id, cible_type, cible_id, motif, status, traite_par, traite_at) values ($1, 'offre', $2, 'spam', 'traite', $3, now())`, [ADM.A3, M.O, ADM.A1]);
  await b.exec('set session_replication_role = origin');
  await b.query(`update public.ecoles set ouverte = false where slug = 'ensam-casa'`);
}

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await peupler(db);
  assert.deepEqual(await liensCasses(db), [], 'une base saine au départ');
});

test('un lauréat qui a recruté supprime son compte, à l’ENSAM Meknès comme à l’ENSAM Casablanca : ce qui visait le compte et son offre reste, sans lien', async () => {
  for (const x of [M, C]) {
    await q(db, x.L, SUPPRIMER);
    assert.equal(await existe(db, x.L), 0, 'le compte et le profil sont partis');
    // Le recrutement déclaré reste à l'étudiant (il le confirme ou non), sans le lauréat ni l'offre disparus
    const pl = await une(db, 'select laureat_id, offer_id, status, entreprise, student_id from public.placements where id = $1', [x.PL]);
    assert.deepEqual(pl, { laureat_id: null, offer_id: null, status: 'en_attente', entreprise: 'OCP', student_id: x.E });
    // La candidature et l'entretien de l'étudiant restent, détachés de l'offre (comme une candidature hors plateforme)
    assert.deepEqual(await une(db, 'select offer_id, status, note from public.applications where id = $1', [x.APP]), { offer_id: null, status: 'entretien', note: 'Relancer lundi' });
    assert.deepEqual(await une(db, 'select offer_id, questions from public.entretiens where id = $1', [x.ENT]), { offer_id: null, questions: ['Pourquoi OCP ?'] });
    assert.equal((await une(db, 'select count(*)::int n from public.matchs where laureat_id = $1', [x.L])).n, 0, 'le match part avec lui');
    // L'étudiant reprend la main : il confirme ce recrutement (avant : « pas dans ton réseau »)
    await q(db, x.E, `update public.placements set status = 'confirme' where id = $1`, [x.PL]);
    assert.equal((await une(db, 'select status from public.placements where id = $1', [x.PL])).status, 'confirme');
  }
  assert.deepEqual(await liensCasses(db), []);
});

test('un relecteur supprime son compte : ce qui n’était pas rendu redevient ouvert à tous, une relecture rendue garde sa synthèse', async () => {
  for (const x of [M, C]) {
    await q(db, x.R, SUPPRIMER);
    assert.equal(await existe(db, x.R), 0);
    const r = async st => une(db, 'select reviewer_id, status, synthese, pris_at is not null as pris from public.relectures_cv where id = $1', [x.REL[st]]);
    assert.deepEqual(await r('demandee'), { reviewer_id: null, status: 'demandee', synthese: null, pris: false });
    assert.deepEqual(await r('en_cours'), { reviewer_id: null, status: 'demandee', synthese: null, pris: false }, 'un autre lauréat peut la prendre');
    assert.deepEqual(await r('rendue'), { reviewer_id: null, status: 'rendue', synthese: 'Très clair.', pris: true });
    assert.deepEqual(await r('annulee'), { reviewer_id: null, status: 'annulee', synthese: null, pris: true });
  }
  // Un lauréat de la même école prend la relecture redevenue ouverte
  const autre = await membre(db, 'Rim Meknès', 'laureat');
  await q(db, autre, 'update public.relectures_cv set reviewer_id = $2 where id = $1', [M.REL.en_cours, autre]);
  assert.deepEqual(await une(db, 'select reviewer_id, status from public.relectures_cv where id = $1', [M.REL.en_cours]), { reviewer_id: autre, status: 'en_cours' });
  assert.deepEqual(await liensCasses(db), []);
});

test('l’aidant d’une demande en match supprime son compte : la demande et la réussite déclarée restent à l’étudiante', async () => {
  for (const x of [M, C]) {
    await q(db, x.A, SUPPRIMER);
    assert.equal(await existe(db, x.A), 0);
    const d = await une(db, 'select laureat_id, status, auteur_id from public.demandes where id = $1', [x.D]);
    assert.deepEqual(d, { laureat_id: null, status: 'match', auteur_id: x.E2 }, 'elle la rouvre ou la ferme elle-même (« Ça ne s’est pas fait »)');
    assert.equal((await une(db, 'select count(*)::int n from public.propositions where id = $1', [x.P])).n, 0, 'sa proposition part avec lui');
    assert.deepEqual(await une(db, 'select laureat_id, demande_id, status from public.placements where id = $1', [x.PLD]), { laureat_id: null, demande_id: x.D, status: 'confirme' });
  }
  // L'étudiante rouvre sa demande
  await q(db, M.E2, `update public.demandes set status = 'ouverte' where id = $1`, [M.D]);
  assert.deepEqual(await une(db, 'select status, laureat_id, proposition_id from public.demandes where id = $1', [M.D]), { status: 'ouverte', laureat_id: null, proposition_id: null });
  assert.deepEqual(await liensCasses(db), []);
});

test('l’auteur d’un guide de l’étranger supprime son compte : le guide et son historique restent, sans auteur', async () => {
  for (const x of [M, C]) {
    await q(db, x.G, SUPPRIMER);
    assert.equal(await existe(db, x.G), 0);
    assert.deepEqual(await une(db, 'select updated_by, contenu from public.guide_pays where id = $1', [x.GU]), { updated_by: null, contenu: 'Le visa étudiant' });
    assert.deepEqual(await une(db, 'select updated_by, contenu from public.guide_pays_historique where guide_id = $1', [x.GU]), { updated_by: null, contenu: 'Ancien texte' });
  }
  assert.deepEqual(await liensCasses(db), []);
});

test('des étudiants suppriment leur compte (recrutements, candidatures, entretiens, relectures, demande, avis de stage) : tout ce qui est à eux part', async () => {
  for (const x of [M, C]) for (const e of [x.E, x.E2]) {
    await q(db, e, SUPPRIMER);
    assert.equal(await existe(db, e), 0);
    for (const t of ['placements', 'relectures_cv']) assert.equal((await une(db, `select count(*)::int n from public.${t} where student_id = $1`, [e])).n, 0, t);
    for (const [t, c] of [['applications', 'student_id'], ['entretiens', 'author_id'], ['demandes', 'auteur_id'], ['avis_stage', 'author_id']]) {
      assert.equal((await une(db, `select count(*)::int n from public.${t} where ${c} = $1`, [e])).n, 0, t);
    }
  }
  assert.deepEqual(await liensCasses(db), []);
});

test('l’administration : un admin supprime son propre compte, un admin en supprime un autre, l’admin de l’ENSAM Casablanca un membre de son école', async () => {
  // Son compte à lui : sa carte sponsorisée, son annonce, son événement et le signalement traité restent, sans auteur
  await q(db, ADM.A1, SUPPRIMER);
  assert.equal(await existe(db, ADM.A1), 0);
  // Un autre admin du réseau supprime l'admin A2 (une carte, une annonce, un événement)
  await q(db, ADM.A3, 'delete from public.profiles where id = $1', [ADM.A2]);
  assert.equal((await une(db, 'select count(*)::int n from public.profiles where id = $1', [ADM.A2])).n, 0);
  assert.deepEqual((await db.query('select created_by, titre from public.sponsorises order by created_at')).rows, [{ created_by: null, titre: 'Stages d’été' }, { created_by: null, titre: 'Stages d’été' }]);
  assert.equal((await une(db, 'select count(*)::int n from public.annonces where author_id is null')).n, 2);
  assert.equal((await une(db, 'select count(*)::int n from public.evenements where author_id is null')).n, 2);
  assert.deepEqual(await une(db, 'select traite_par, status from public.signalements'), { traite_par: null, status: 'traite' });
  // L'administration de l'ENSAM Casablanca supprime un lauréat de son école qui a recruté
  const L = await membre(db, 'Amine Casa', 'laureat'), etu = await membre(db, 'Ines Casa', 'etudiant');
  await db.query(`update public.profiles set ecole = 'ensam-casa' where id = any($1)`, [[L, etu]]);
  await db.exec('set session_replication_role = replica');
  const pl = (await une(db, `insert into public.placements (student_id, laureat_id, saison, niveau, type, entreprise, source, status, ecole)
    values ($1, $2, $3, 5, 'stage', 'Renault', 'plateforme', 'confirme', 'ensam-casa') returning id`, [etu, L, S])).id;
  await db.exec('set session_replication_role = origin');
  await q(db, ADM.AC, 'delete from public.profiles where id = $1', [L]);
  assert.deepEqual(await une(db, 'select laureat_id, status from public.placements where id = $1', [pl]), { laureat_id: null, status: 'confirme' });
  assert.deepEqual(await liensCasses(db), []);
});

test('un lauréat supprime une de ses offres : candidatures, entretiens, recrutements et matchs restent, sans lien vers elle', async () => {
  const L = await membre(db, 'Yassine Meknès', 'laureat'), E = await membre(db, 'Imane Meknès', 'etudiant');
  await db.exec('set session_replication_role = replica');
  const O = (await une(db, `insert into public.offers (author_id, type, titre, entreprise, description, annees) values ($1, 'stage', 'Stage maintenance', 'Renault', 'd', '{4}') returning id`, [L])).id;
  const app = (await une(db, `insert into public.applications (student_id, offer_id, entreprise, titre, status) values ($1, $2, 'Renault', 'Stage maintenance', 'retenu') returning id`, [E, O])).id;
  await db.query(`insert into public.entretiens (author_id, entreprise, offer_id, questions) values ($1, 'Renault', $2, '{"Q"}')`, [E, O]);
  const pl = (await une(db, `insert into public.placements (student_id, laureat_id, offer_id, saison, niveau, type, entreprise, source, status)
    values ($1, $2, $3, $4, 4, 'stage', 'Renault', 'plateforme', 'en_attente') returning id`, [E, L, O, S])).id;
  await db.query(`insert into public.matchs (etudiant_id, laureat_id, offre_id) values ($1, $2, $3)`, [E, L, O]);
  await db.exec('set session_replication_role = origin');
  await q(db, L, 'delete from public.offers where id = $1', [O]);
  assert.deepEqual(await liensCasses(db), [], 'avant : ces quatre lignes visaient encore l’offre supprimée');
  assert.deepEqual(await une(db, 'select offer_id, status from public.applications where id = $1', [app]), { offer_id: null, status: 'retenu' });
  assert.deepEqual(await une(db, 'select offre_id from public.matchs where laureat_id = $1', [L]), { offre_id: null });
  // L'étudiant confirme le recrutement et garde ses notes (avant : « pas dans ton réseau »)
  await q(db, E, `update public.placements set status = 'confirme' where id = $1`, [pl]);
  await q(db, E, `update public.applications set note = 'Commence le 1er juillet' where id = $1`, [app]);
  assert.deepEqual(await une(db, 'select p.status, a.note from public.placements p, public.applications a where p.id = $1 and a.id = $2', [pl, app]), { status: 'confirme', note: 'Commence le 1er juillet' });
});

test('aucune porte : un membre ne vise toujours pas l’autre école, et ne vide pas un lien à la place de la base', async () => {
  const L = await membre(db, 'Rachid Meknès', 'laureat'), E = await membre(db, 'Sara Meknès', 'etudiant'), LC = await membre(db, 'Rachid Casa', 'laureat');
  await db.query(`update public.profiles set ecole = 'ensam-casa' where id = $1`, [LC]);
  await db.exec('set session_replication_role = replica');
  const rel = (await une(db, `insert into public.relectures_cv (student_id, cv_path, status) values ($1, 'cv.pdf', 'demandee') returning id`, [E])).id;
  const pl = (await une(db, `insert into public.placements (student_id, laureat_id, saison, niveau, type, entreprise, source, status)
    values ($1, $2, $3, 4, 'stage', 'Renault', 'plateforme', 'en_attente') returning id`, [E, L, S])).id;
  // Une candidature d'avant les écoles, sur une offre de l'ENSAM Casablanca
  const OC = (await une(db, `insert into public.offers (author_id, type, titre, entreprise, description, annees, ecole) values ($1, 'stage', 'Stage Casa', 'Lear', 'd', '{4}', 'ensam-casa') returning id`, [LC])).id;
  const app = (await une(db, `insert into public.applications (student_id, offer_id, entreprise, titre) values ($1, $2, 'Lear', 'Stage Casa') returning id`, [E, OC])).id;
  await db.exec('set session_replication_role = origin');
  // Viser un lauréat de l'autre école : refusé, comme avant (et l'autre école ne voit pas la ligne)
  assert.deepEqual(await q(db, LC, 'update public.relectures_cv set reviewer_id = $2 where id = $1 returning id', [rel, LC]), []);
  await assert.rejects(q(db, E, 'update public.relectures_cv set reviewer_id = $2 where id = $1', [rel, LC]), /pas dans ton réseau/);
  // Changer une ligne qui vise l'autre école : refusé, comme avant (vider aussi un lien n'y change rien)
  await assert.rejects(q(db, E, `update public.applications set note = 'x' where id = $1`, [app]), /pas dans ton réseau/);
  // Le lauréat vide lui-même son nom d'un recrutement : son profil existe, rien ne passe (la garde le remet)
  await q(db, L, 'update public.placements set laureat_id = null where id = $1', [pl]);
  assert.equal((await une(db, 'select laureat_id from public.placements where id = $1', [pl])).laureat_id, L);
  // L'aide de la base n'est ouverte à personne
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await une(db, `select has_function_privilege($1, 'public.liens_disparus(regclass, jsonb, jsonb)', 'execute') d`, [role])).d, false, role);
  }
  await assert.rejects(q(db, E, `select public.liens_disparus('public.placements'::regclass, '{}'::jsonb, '{}'::jsonb)`), /permission denied/);
});

test('« Supprimer mon compte » : la même fonction, les mêmes droits', async () => {
  const r = (await db.query(`select p.oid::regprocedure::text f, pg_get_function_result(p.oid) t from pg_proc p where p.proname = 'supprimer_mon_compte' and p.pronamespace = 'public'::regnamespace`)).rows;
  assert.deepEqual(r, [{ f: 'supprimer_mon_compte()', t: 'void' }]);
  const droit = async role => (await une(db, `select has_function_privilege($1, 'public.supprimer_mon_compte()', 'execute') d`, [role])).d;
  assert.deepEqual([await droit('anon'), await droit('authenticated')], [false, true]);
  await assert.rejects(en(db, null, tx => tx.query(SUPPRIMER), { role: 'anon' }), /permission denied/);
});

test('la mise à jour (deux fois) vide les liens cassés laissés avant, et seulement eux', async () => {
  const b = await nouvelleBase(SCHEMA);
  try {
    const L = uid(2201), E = uid(2202), A = uid(2203);
    await creerCompte(b, { id: L, full_name: 'Youssef Alaoui', role: 'laureat', filiere: 'Génie Industriel', promo: 2016 });
    await creerCompte(b, { id: E, full_name: 'Salma Idrissi', role: 'etudiant', filiere: 'Génie Industriel', promo: S + 1 });
    await creerCompte(b, { id: A, full_name: 'Admin Réseau', role: 'laureat', filiere: 'Génie Industriel', promo: 2010 });
    await b.exec('set session_replication_role = replica');
    const O = (await une(b, `insert into public.offers (author_id, type, titre, entreprise, description, annees) values ($1, 'pfe', 'PFE qualité', 'OCP', 'd', '{5}') returning id`, [L])).id;
    const O2 = (await une(b, `insert into public.offers (author_id, type, titre, entreprise, description, annees) values ($1, 'pfe', 'PFE maintenance', 'OCP', 'd', '{5}') returning id`, [L])).id;
    await b.query(`insert into public.applications (student_id, offer_id, entreprise, titre, updated_at) values ($1, $2, 'OCP', 'PFE qualité', '2026-10-01'), ($1, $3, 'OCP', 'PFE maintenance', '2026-10-01')`, [E, O, O2]);
    await b.query(`insert into public.placements (student_id, laureat_id, offer_id, saison, niveau, type, entreprise, source, status) values ($1, $2, $3, $4, 5, 'pfe', 'OCP', 'plateforme', 'confirme')`, [E, L, O, S]);
    await b.query(`insert into public.sponsorises (entreprise, titre, texte, lien, fin, created_by) values ('OCP', 'Carte', 'Une carte de test.', 'https://ocp.ma', current_date + 7, $1)`, [A]);
    // L'état laissé par les gardes d'avant : l'offre supprimée par son auteur, un admin supprimé par un autre
    await b.query('delete from public.offers where id = $1', [O]);
    await b.query('delete from public.profiles where id = $1', [A]);
    await b.exec('set session_replication_role = origin');
    assert.deepEqual(await liensCasses(b), ['applications.offer_id → offers (1)', 'placements.offer_id → offers (1)', 'sponsorises.created_by → profiles (1)']);
    const avant = (await b.query('select id, titre, offer_id, updated_at, entreprise, status from public.applications order by titre')).rows;
    const maj = lireSql(MAJ);
    await b.exec(maj);
    await b.exec(maj);
    assert.deepEqual(await liensCasses(b), []);
    const apres = (await b.query('select id, titre, offer_id, updated_at, entreprise, status from public.applications order by titre')).rows;
    assert.deepEqual(apres.map(x => x.titre), ['PFE maintenance', 'PFE qualité']);
    assert.deepEqual(apres, [avant[0], { ...avant[1], offer_id: null }], 'seul le lien cassé change : ni la date, ni le reste');
    assert.deepEqual(await une(b, 'select offer_id, laureat_id, status from public.placements'), { offer_id: null, laureat_id: L, status: 'confirme' });
    assert.deepEqual(await une(b, 'select created_by, titre from public.sponsorises'), { created_by: null, titre: 'Carte' });
  } finally { await b.close(); }
});
