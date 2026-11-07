// Plan · partie membres : l'invitation nommée (code d'un membre dans son lien, posé à l'inscription), les visages de la
// page d'entrée et les réussites montrées. Rien n'est public sans le oui du membre lui-même, chacun le retire quand il veut,
// et un visiteur ne reçoit que des lignes de son école.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nouvelleBase, creerCompte, en, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const [NADIA, YOUSSEF, KARIM, SALMA, AMINE, ADM, AILLEURS, AILLEURS_ETU] = [601, 602, 603, 604, 605, 606, 607, 608].map(uid);
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const anon = (sql, p) => en(db, null, tx => tx.query(sql, p), { role: 'anon' }).then(r => r.rows);
const un = (u, sql, p) => (u ? q(u, sql, p) : anon(sql, p)).then(r => r[0]?.x);
const ligne = id => db.query('select * from public.profiles where id = $1', [id]).then(r => r.rows[0]);
const placement = id => db.query('select * from public.placements where id = $1', [id]).then(r => r.rows[0]);
// Un compte qui s'inscrit depuis un lien d'invitation : la métadonnée du compte porte le code, puis le profil est créé
async function inscrire(id, nom, role, promo, meta, extra = {}) {
  await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [id, id.slice(-4) + '@exemple.ma', JSON.stringify(meta || {})]);
  const cols = Object.keys(extra);
  await q(id, `insert into public.profiles (id, full_name, role, filiere, promo${cols.map(c => ', ' + c).join('')}) values ($1, $2, $3, 'Génie Industriel', $4${cols.map((_, i) => ', $' + (i + 5)).join('')})`, [id, nom, role, promo, ...cols.map(c => extra[c])]);
}

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await db.query(`insert into public.ecoles (slug, nom, ouverte) values ('autre-ecole', 'Autre École', true) on conflict do nothing`);
  await creerCompte(db, { id: NADIA, full_name: 'Nadia El Fassi', role: 'laureat', filiere: 'Génie Industriel', promo: 2019, entreprise: 'OCP' });
  await creerCompte(db, { id: YOUSSEF, full_name: 'Youssef Alaoui', role: 'laureat', filiere: 'Génie Mécanique', promo: 2016, entreprise: 'Renault' });
  await creerCompte(db, { id: KARIM, full_name: 'Karim Benali', role: 'laureat', filiere: 'Génie Civil', promo: 2012, entreprise: '  ' });
  await creerCompte(db, { id: ADM, full_name: 'Admin Réseau', role: 'laureat', filiere: 'Génie Industriel', promo: 2010 });
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADM]);
  await creerCompte(db, { id: AILLEURS, full_name: 'Omar Ailleurs', role: 'laureat', filiere: 'Génie Industriel', promo: 2019, entreprise: 'Lear' });
  await db.query(`update public.profiles set ecole = 'autre-ecole' where id = $1`, [AILLEURS]);
  for (const [id, n] of [[NADIA, 1], [YOUSSEF, 2], [AILLEURS, 3]]) {
    await db.query(`insert into storage.objects (bucket_id, name) values ('photos', $1)`, [`${id}/photo-${n}.webp`]);
    await db.query('update public.profiles set photo_path = $2 where id = $1', [id, `${id}/photo-${n}.webp`]);
  }
  await db.query(`insert into storage.objects (bucket_id, name) values ('cv', $1)`, [`${NADIA}/cv.pdf`]);
  // Des lauréats vérifiés (liste de l'école ou deux camarades de promo) : la page d'entrée ne montre qu'eux
  await db.query('update public.profiles set verified = true where id = any($1)', [[NADIA, YOUSSEF, KARIM, AILLEURS]]);
});

test('le code d’invitation : créé à la demande, 8 caractères, stable ; personne ne le choisit ni ne le change', async () => {
  assert.equal((await ligne(NADIA)).code_invitation, null, 'pas de code tant qu’il n’a pas servi');
  const code = await un(NADIA, 'select public.mon_code_invitation() x');
  assert.match(code, /^[a-z0-9]{8}$/);
  assert.equal(await un(NADIA, 'select public.mon_code_invitation() x'), code, 'le même ensuite');
  assert.notEqual(await un(YOUSSEF, 'select public.mon_code_invitation() x'), code);
  // Le membre ne le change pas lui-même, ni le code d'un autre, ni « invité par »
  await q(NADIA, `update public.profiles set code_invitation = 'zzzzzzzz', invite_par = $2 where id = $1`, [NADIA, YOUSSEF]);
  const n = await ligne(NADIA);
  assert.deepEqual([n.code_invitation, n.invite_par], [code, null]);
  await assert.rejects(anon('select public.mon_code_invitation() x'), /permission denied/);
  // L'administration peut (correction) ; le format reste contrôlé
  await q(ADM, `update public.profiles set code_invitation = 'nadia019' where id = $1`, [NADIA]);
  assert.equal((await ligne(NADIA)).code_invitation, 'nadia019');
  await assert.rejects(q(ADM, `update public.profiles set code_invitation = 'Nadia!' where id = $1`, [NADIA]), /profiles_code_invitation_format/);
  await q(ADM, `update public.profiles set code_invitation = $2 where id = $1`, [NADIA, code]);
});

test('invitation_de : prénom, promo et rôle de qui invite, seulement dans l’école du visiteur', async () => {
  const code = (await ligne(NADIA)).code_invitation;
  assert.deepEqual(await un(null, 'select public.invitation_de($1) x', [code]), { prenom: 'Nadia', promo: 2019, role: 'laureat' });
  assert.deepEqual(await un(YOUSSEF, 'select public.invitation_de($1) x', [code]), { prenom: 'Nadia', promo: 2019, role: 'laureat' });
  assert.equal(await un(null, 'select public.invitation_de($1) x', ['inconnu1']), null);
  assert.equal(await un(null, 'select public.invitation_de($1) x', ["x' or 1=1"]), null);
  assert.equal(await un(null, 'select public.invitation_de($1) x', [null]), null);
  const ailleurs = await un(AILLEURS, 'select public.mon_code_invitation() x');
  assert.equal(await un(null, 'select public.invitation_de($1) x', [ailleurs]), null, 'un membre d’une autre école n’invite pas ici');
  assert.equal((await un(AILLEURS, 'select public.invitation_de($1) x', [ailleurs])).prenom, 'Omar', 'mais bien dans la sienne');
});

test('à l’inscription, le code du lien pose « invité par » ; jamais un autre réseau, jamais ce que le compte envoie lui-même', async () => {
  const code = (await ligne(NADIA)).code_invitation;
  await inscrire(SALMA, 'Salma Bennani', 'etudiant', S + 1, { invite_par: code.toUpperCase() + ' ', consent_version: '2' }, { invite_par: YOUSSEF, code_invitation: 'salma123' });
  const s = await ligne(SALMA);
  assert.deepEqual([s.invite_par, s.code_invitation], [NADIA, null], 'le code du lien, pas les colonnes envoyées');
  await inscrire(AMINE, 'Amine Tazi', 'etudiant', S + 2, { invite_par: code });
  assert.equal((await ligne(AMINE)).invite_par, NADIA);
  // Un code d'une autre école, un code inconnu, un code mal formé : personne
  const ailleurs = (await ligne(AILLEURS)).code_invitation;
  await inscrire(uid(611), 'Hamza Idrissi', 'etudiant', S + 1, { invite_par: ailleurs });
  await inscrire(uid(612), 'Rim Kabbaj', 'etudiant', S + 1, { invite_par: 'abcdefgh' });
  await inscrire(uid(613), 'Ilyas Berrada', 'etudiant', S + 1, { invite_par: { code } });
  for (const id of [611, 612, 613]) assert.equal((await ligne(uid(id))).invite_par, null);
  // Dans l'autre école, le code d'Omar compte
  await inscrire(AILLEURS_ETU, 'Sara Autre', 'etudiant', S + 1, { invite_par: ailleurs }, { ecole: 'autre-ecole' });
  assert.equal((await ligne(AILLEURS_ETU)).invite_par, AILLEURS);
  // Un code reçu après l'inscription ne change rien : « invité par » ne se pose qu'à la création du profil
  await db.query(`update auth.users set raw_user_meta_data = $2 where id = $1`, [uid(612), JSON.stringify({ invite_par: code })]);
  await q(uid(612), `update public.profiles set invite_par = $2, ville = 'Fès' where id = $1`, [uid(612), NADIA]);
  assert.equal((await ligne(uid(612))).invite_par, null);
});

test('mes_invites : les camarades arrivés grâce à moi, prénoms seulement, rien des autres', async () => {
  assert.deepEqual(await un(NADIA, 'select public.mes_invites() x'), { n: 2, prenoms: ['Amine', 'Salma'] });
  assert.deepEqual(await un(YOUSSEF, 'select public.mes_invites() x'), { n: 0, prenoms: [] });
  assert.deepEqual(await un(AILLEURS, 'select public.mes_invites() x'), { n: 1, prenoms: ['Sara'] });
  await assert.rejects(anon('select public.mes_invites() x'), /permission denied/);
  // Un camarade qui supprime son compte n'est plus compté
  await db.query('delete from public.profiles where id = $1', [AMINE]);
  assert.deepEqual(await un(NADIA, 'select public.mes_invites() x'), { n: 1, prenoms: ['Salma'] });
  // Un compte supprimé qui avait invité : « invité par » se vide, le profil reste
  await creerCompte(db, { id: uid(620), full_name: 'Temporaire Lauréat', role: 'laureat', filiere: 'Génie Civil', promo: 2014 });
  const c = await un(uid(620), 'select public.mon_code_invitation() x');
  await inscrire(uid(621), 'Yasmine Ouali', 'etudiant', S + 1, { invite_par: c });
  assert.equal((await ligne(uid(621))).invite_par, uid(620));
  await db.query('delete from auth.users where id = $1', [uid(620)]);
  const y = await ligne(uid(621));
  assert.ok(y, 'le camarade invité garde son compte');
  assert.equal(y.invite_par, null);
});

test('le membre qui avait invité supprime lui-même son compte : « invité par » se vide, sans lien vers un profil disparu', async () => {
  const [LAU, INV] = [uid(630), uid(631)];
  await creerCompte(db, { id: LAU, full_name: 'Rachid Partant', role: 'laureat', filiere: 'Génie Civil', promo: 2013 });
  const c = await un(LAU, 'select public.mon_code_invitation() x');
  await inscrire(INV, 'Ihssane Restante', 'etudiant', S + 1, { invite_par: c });
  assert.equal((await ligne(INV)).invite_par, LAU);
  // Un membre ne vide pas lui-même « invité par » (ni ne le change)
  await q(INV, 'update public.profiles set invite_par = null where id = $1', [INV]);
  assert.equal((await ligne(INV)).invite_par, LAU);
  await q(LAU, 'select public.supprimer_mon_compte()');
  assert.equal(await ligne(LAU), undefined);
  assert.equal((await ligne(INV)).invite_par, null);
  const orphelins = await db.query('select count(*)::int n from public.profiles p where p.invite_par is not null and not exists (select 1 from public.profiles x where x.id = p.invite_par)');
  assert.equal(orphelins.rows[0].n, 0);
});

test('le garde des invitations à postuler (protect_invitation) reste le sien : un lauréat invite sur son offre, un étudiant jamais', async () => {
  const offre = (await q(NADIA, `insert into public.offers (author_id, type, titre, entreprise, description) values ($1, 'stage', 'Stage qualité', 'OCP', 'Deux mois au service qualité, à Jorf Lasfar.') returning id`, [NADIA]))[0].id;
  const [inv] = await q(NADIA, `insert into public.invitations (laureat_id, student_id, offer_id, status) values ($1, $2, $3, 'declinee') returning laureat_id, status`, [YOUSSEF, SALMA, offre]);
  assert.deepEqual([inv.laureat_id, inv.status], [NADIA, 'envoyee'], 'le lauréat de l’offre, invitation envoyée');
  await assert.rejects(q(SALMA, 'insert into public.invitations (laureat_id, student_id, offer_id) values ($1, $2, $3)', [NADIA, uid(611), offre]), /Seul un lauréat peut inviter/);
  const t = await db.query(`select g.tgrelid::regclass::text as t, p.proname as f from pg_trigger g join pg_proc p on p.oid = g.tgfoid where g.tgname in ('trg_protect_invitation', 'trg_protect_code_invitation') order by 1`);
  assert.deepEqual(t.rows, [{ t: 'invitations', f: 'protect_invitation' }, { t: 'profiles', f: 'protect_code_invitation' }]);
});

const visages = u => un(u, 'select public.visages_publics() x');
const photosVisiteur = async () => (await anon(`select name from storage.objects order by name`)).map(r => r.name);
test('visages de la page d’entrée : seulement les lauréats qui ont dit oui, de l’école du visiteur ; la photo seule devient lisible', async () => {
  assert.deepEqual(await visages(null), []);
  assert.deepEqual(await photosVisiteur(), []);
  await q(NADIA, 'update public.profiles set vitrine_publique = true where id = $1', [NADIA]);
  await q(KARIM, 'update public.profiles set vitrine_publique = true where id = $1', [KARIM]);
  await q(AILLEURS, 'update public.profiles set vitrine_publique = true where id = $1', [AILLEURS]);
  assert.deepEqual(await visages(null), [
    { nom: 'Nadia E.', promo: 2019, entreprise: 'OCP', photo: `${NADIA}/photo-1.webp` },
    { nom: 'Karim B.', promo: 2012, entreprise: null, photo: null },
  ], 'avec photo d’abord ; jamais un autre réseau ; pas d’id');
  assert.deepEqual(await photosVisiteur(), [`${NADIA}/photo-1.webp`], 'jamais le CV, ni la photo de qui n’a rien dit, ni celle d’une autre école');
  assert.deepEqual((await visages(AILLEURS)).map(v => v.nom), ['Omar A.'], 'un membre de l’autre école voit les siens');
  // Un compte pas encore vérifié qui dit oui (il pourrait porter le nom et la photo de quelqu'un d'autre) : rien de public
  const FAUX = uid(640);
  await creerCompte(db, { id: FAUX, full_name: 'Nadia  El Fassi', role: 'laureat', filiere: 'Génie Industriel', promo: 2019, entreprise: 'OCP' });
  await db.query(`insert into storage.objects (bucket_id, name) values ('photos', $1)`, [`${FAUX}/photo-9.webp`]);
  await q(FAUX, 'update public.profiles set photo_path = $2, vitrine_publique = true where id = $1', [FAUX, `${FAUX}/photo-9.webp`]);
  assert.equal((await ligne(FAUX)).vitrine_publique, true, 'son oui est gardé pour quand il sera vérifié');
  assert.deepEqual((await visages(null)).map(v => v.nom), ['Nadia E.', 'Karim B.']);
  assert.deepEqual(await photosVisiteur(), [`${NADIA}/photo-1.webp`]);
  // Vérifié : il apparaît (deux espaces dans le nom n'enlèvent pas l'initiale), puis son profil est retiré pour la suite
  await db.query('update public.profiles set verified = true where id = $1', [FAUX]);
  assert.deepEqual((await visages(null)).map(v => v.nom), ['Nadia E.', 'Nadia E.', 'Karim B.']);
  assert.deepEqual(await photosVisiteur(), [`${NADIA}/photo-1.webp`, `${FAUX}/photo-9.webp`]);
  await db.query('delete from auth.users where id = $1', [FAUX]);
  await db.query(`delete from storage.objects where name = $1`, [`${FAUX}/photo-9.webp`]);
  // Une nouvelle photo : l'ancienne n'est plus lisible
  await db.query(`insert into storage.objects (bucket_id, name) values ('photos', $1)`, [`${NADIA}/photo-11.webp`]);
  await q(NADIA, 'update public.profiles set photo_path = $2 where id = $1', [NADIA, `${NADIA}/photo-11.webp`]);
  assert.deepEqual(await photosVisiteur(), [`${NADIA}/photo-11.webp`]);
  // Elle retire son oui : plus rien
  await q(NADIA, 'update public.profiles set vitrine_publique = false where id = $1', [NADIA]);
  assert.deepEqual((await visages(null)).map(v => v.nom), ['Karim B.']);
  assert.deepEqual(await photosVisiteur(), []);
});

test('le oui vient du lauréat lui-même : ni l’administration, ni un autre membre, ni un étudiant', async () => {
  await q(ADM, 'update public.profiles set vitrine_publique = true where id = $1', [YOUSSEF]);
  assert.equal((await ligne(YOUSSEF)).vitrine_publique, null);
  await q(NADIA, 'update public.profiles set vitrine_publique = true where id = $1', [YOUSSEF]);
  assert.equal((await ligne(YOUSSEF)).vitrine_publique, null);
  await q(SALMA, 'update public.profiles set vitrine_publique = true where id = $1', [SALMA]);
  assert.equal((await ligne(SALMA)).vitrine_publique, null, 'la question n’est posée qu’aux lauréats');
  await q(YOUSSEF, 'update public.profiles set vitrine_publique = true where id = $1', [YOUSSEF]);
  assert.deepEqual((await visages(null)).map(v => v.nom), ['Youssef A.', 'Karim B.']);
  // L'administration peut retirer quelqu'un de la page d'entrée
  await q(ADM, 'update public.profiles set vitrine_publique = false where id = $1', [KARIM]);
  assert.deepEqual((await visages(null)).map(v => v.nom), ['Youssef A.']);
  // Un compte de l'administration n'y est jamais, même en vue lauréat
  await q(ADM, `update public.profiles set role = 'laureat', vitrine_publique = true where id = $1`, [ADM]);
  assert.deepEqual((await visages(null)).map(v => v.nom), ['Youssef A.']);
  await q(ADM, `update public.profiles set role = 'admin' where id = $1`, [ADM]);
  // 24 au plus
  await db.exec('set session_replication_role = replica');
  for (let i = 0; i < 30; i++) {
    const id = uid(700 + i);
    await db.query('insert into auth.users (id, email) values ($1, $2)', [id, `v${i}@exemple.ma`]);
    await db.query(`insert into public.profiles (id, full_name, role, filiere, promo, vitrine_publique, verified) values ($1, $2, 'laureat', 'Génie Civil', 2015, true, true)`, [id, `Lauréat${i} Test`]);
  }
  await db.exec('set session_replication_role = origin');
  assert.equal((await visages(null)).length, 24);
  assert.equal((await visages(null))[0].nom, 'Youssef A.', 'les visages avec photo d’abord');
});

// Un recrutement déclaré par le lauréat, confirmé par l'étudiant
async function reussite(lau, etu, entreprise) {
  const [p] = await q(lau, `insert into public.placements (student_id, laureat_id, saison, niveau, type, entreprise, source) values ($1, $2, $3, 5, 'pfe', $4, 'plateforme') returning id`, [etu, lau, S, entreprise]);
  return p.id;
}
const montrer = (u, id, oui) => q(u, 'select public.montrer_reussite($1, $2) x', [id, oui]).then(r => r[0].x);
const reussites = u => un(u, 'select public.reussites_publiques() x');
test('réussites montrées : chacun coche sa case, seulement une fois confirmée ; affichée quand les deux ont dit oui', async () => {
  const id = await reussite(NADIA, SALMA, 'OCP');
  const p0 = await placement(id);
  assert.deepEqual([p0.status, p0.public_etudiant, p0.public_laureat], ['en_attente', false, false]);
  await assert.rejects(montrer(NADIA, id, true), /confirmée/);
  await q(SALMA, `update public.placements set status = 'confirme' where id = $1`, [id]);
  // Une case cochée directement dans la table ne passe pas (ni la sienne, ni celle de l'autre)
  await q(SALMA, 'update public.placements set public_etudiant = true, public_laureat = true where id = $1', [id]);
  await q(NADIA, 'update public.placements set public_etudiant = true, public_laureat = true where id = $1', [id]);
  assert.deepEqual([(await placement(id)).public_etudiant, (await placement(id)).public_laureat], [false, false]);
  // Quelqu'un d'autre ne coche rien
  await assert.rejects(montrer(YOUSSEF, id, true), /revient à l’étudiant et au lauréat/);
  await assert.rejects(montrer(ADM, id, true), /revient à l’étudiant et au lauréat/);
  await assert.rejects(anon('select public.montrer_reussite($1, true) x', [id]), /permission denied/);
  assert.deepEqual(await montrer(SALMA, id, true), { public_etudiant: true, public_laureat: false });
  assert.deepEqual(await reussites(null), [], 'pas encore : le lauréat n’a rien dit');
  assert.deepEqual(await montrer(NADIA, id, true), { public_etudiant: true, public_laureat: true });
  const [r] = await reussites(null);
  assert.deepEqual(r, { entreprise: 'OCP', etudiant: 'Salma', laureat: 'Nadia', promo: 2019, mois: new Date().toISOString().slice(0, 7) });
  // L'administration ne montre jamais à la place de quelqu'un, mais peut retirer
  await q(ADM, 'update public.placements set public_laureat = false where id = $1', [id]);
  assert.deepEqual(await reussites(null), []);
  await q(ADM, 'update public.placements set public_laureat = true where id = $1', [id]);
  assert.equal((await placement(id)).public_laureat, false);
  await montrer(NADIA, id, true);
  assert.equal((await reussites(null)).length, 1);
  // L'étudiant retire son oui : plus rien, la case du lauréat ne bouge pas
  assert.deepEqual(await montrer(SALMA, id, false), { public_etudiant: false, public_laureat: true });
  assert.deepEqual(await reussites(null), []);
  await montrer(SALMA, id, true);
  // Une réussite qui n'est plus confirmée (correction de l'administration) disparaît
  await q(ADM, `update public.placements set status = 'refuse' where id = $1`, [id]);
  assert.deepEqual(await reussites(null), []);
  await q(ADM, `update public.placements set status = 'confirme' where id = $1`, [id]);
  assert.equal((await reussites(null)).length, 1);
});

test('réussites : jamais celles d’une autre école, 12 au plus, les plus récentes d’abord', async () => {
  await db.exec('set session_replication_role = replica');
  await db.query(`insert into public.placements (student_id, laureat_id, saison, niveau, type, entreprise, source, status, confirmed_at, public_etudiant, public_laureat, ecole)
    values ($1, $2, $3, 5, 'pfe', 'Lear', 'plateforme', 'confirme', now(), true, true, 'autre-ecole')`, [AILLEURS_ETU, AILLEURS, S]);
  for (let i = 0; i < 14; i++) {
    const etu = uid(750 + i);
    await db.query('insert into auth.users (id, email) values ($1, $2)', [etu, `r${i}@exemple.ma`]);
    await db.query(`insert into public.profiles (id, full_name, role, filiere, promo) values ($1, $2, 'etudiant', 'Génie Civil', $3)`, [etu, `Etudiant${i} Test`, S + 1]);
    await db.query(`insert into public.placements (student_id, laureat_id, saison, niveau, type, entreprise, source, status, confirmed_at, public_etudiant, public_laureat)
      values ($1, $2, $3, 5, 'stage', $4, 'plateforme', 'confirme', $5, true, $6)`, [etu, YOUSSEF, S, `Entreprise ${i}`, new Date(Date.UTC(2025, 0, 1 + i)).toISOString(), i !== 13]);
  }
  await db.exec('set session_replication_role = origin');
  const r = await reussites(null);
  assert.equal(r.length, 12);
  assert.equal(r[0].entreprise, 'OCP', 'la plus récente');
  assert.ok(!r.some(x => x.entreprise === 'Lear'), 'pas l’autre école');
  assert.ok(!r.some(x => x.entreprise === 'Entreprise 13'), 'le lauréat n’a pas dit oui');
  assert.deepEqual(r[1], { entreprise: 'Entreprise 12', etudiant: 'Etudiant12', laureat: 'Youssef', promo: 2016, mois: '2025-01' });
  assert.deepEqual((await reussites(AILLEURS)).map(x => x.entreprise), ['Lear'], 'l’autre école voit la sienne');
  // Un nouveau recrutement arrive sans case cochée, même envoyée
  const [p] = await q(YOUSSEF, `insert into public.placements (student_id, laureat_id, saison, niveau, type, entreprise, source, public_etudiant, public_laureat) values ($1, $2, $3, 5, 'pfe', 'Renault', 'plateforme', true, true) returning public_etudiant, public_laureat`, [uid(613), YOUSSEF, S]);
  assert.deepEqual([p.public_etudiant, p.public_laureat], [false, false]);
});

test('la page d’entrée d’une autre école (lien ?ecole=) : ses visages, ses réussites et ses invitations seulement ; rien tant que son réseau n’est pas ouvert', async () => {
  const code = (await ligne(AILLEURS)).code_invitation;
  const pour = (u, f, e) => un(u, `select public.${f}($1) x`, [e]);
  const invitation = (c, e) => un(null, 'select public.invitation_de($1, $2) x', [c, e]);
  assert.deepEqual(await pour(null, 'visages_publics', 'autre-ecole'), [{ nom: 'Omar A.', promo: 2019, entreprise: 'Lear', photo: `${AILLEURS}/photo-3.webp` }]);
  assert.deepEqual((await pour(null, 'reussites_publiques', 'autre-ecole')).map(r => r.entreprise), ['Lear']);
  assert.equal((await invitation(code, 'autre-ecole')).prenom, 'Omar');
  assert.equal(await invitation((await ligne(NADIA)).code_invitation, 'autre-ecole'), null, 'un membre de l’ENSAM Meknès n’invite pas sur la page d’une autre école');
  // L'ENSAM Meknès nommée dans le lien : comme sans lien
  assert.deepEqual(await pour(null, 'visages_publics', 'ensam-meknes'), await visages(null));
  assert.deepEqual(await pour(null, 'reussites_publiques', 'ensam-meknes'), await reussites(null));
  // Un membre connecté voit la page de son école, quel que soit le lien
  assert.ok(!(await pour(YOUSSEF, 'visages_publics', 'autre-ecole')).some(v => v.nom === 'Omar A.'));
  assert.ok(!(await pour(YOUSSEF, 'reussites_publiques', 'autre-ecole')).some(r => r.entreprise === 'Lear'));
  // Une école inconnue, ou dont le réseau n'est pas encore ouvert : rien
  assert.deepEqual(await pour(null, 'visages_publics', 'inconnue'), []);
  assert.equal(await invitation(code, 'inconnue'), null);
  await db.query(`update public.ecoles set ouverte = false where slug = 'autre-ecole'`);
  assert.deepEqual(await pour(null, 'visages_publics', 'autre-ecole'), []);
  assert.deepEqual(await pour(null, 'reussites_publiques', 'autre-ecole'), []);
  assert.equal(await invitation(code, 'autre-ecole'), null);
  await db.query(`update public.ecoles set ouverte = true where slug = 'autre-ecole'`);
  await assert.rejects(anon('select public.ecole_entree($1) x', ['autre-ecole']), /permission denied/);
});

test('relancée deux fois, la mise à jour ne perd rien : codes, invitations, oui donnés', async () => {
  const avant = await ligne(NADIA);
  const sql = fs.readFileSync(SCHEMA, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, '');
  await db.exec(sql);
  await db.exec(sql);
  const apres = await ligne(NADIA);
  assert.deepEqual([apres.code_invitation, apres.vitrine_publique], [avant.code_invitation, avant.vitrine_publique]);
  assert.equal((await ligne(SALMA)).invite_par, NADIA);
  assert.equal((await reussites(null)).length, 12);
  assert.deepEqual((await visages(null))[0].nom, 'Youssef A.');
  assert.deepEqual(await un(NADIA, 'select public.mes_invites() x'), { n: 1, prenoms: ['Salma'] });
});
