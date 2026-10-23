// Mentorat : l'étudiant confirme sa présence, l'horaire déplacé demande une nouvelle confirmation,
// l'administration qui fixe elle-même un rendez-vous a sa salle de visio
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;
const S = (() => { const d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; })();
const ETU = uid(21), ETU2 = uid(22), LAU = uid(23), ADMIN = uid(24);
const q = (u, sql, p) => en(db, u, tx => tx.query(sql, p)).then(r => r.rows);
const dans = h => new Date(Date.now() + h * 36e5).toISOString();
const demande = async (etu, mentor, sujet) => (await q(etu, `insert into public.mentorships (student_id, mentor_id, besoin, sujet, creneaux) values ($1, $2, 'cv', $3, array[$4]::timestamptz[]) returning id`, [etu, mentor, sujet, dans(24)]))[0].id;
const lire = id => db.query('select * from public.mentorships where id = $1', [id]).then(r => r.rows[0]);

before(async () => {
  db = await nouvelleBase(SCHEMA);
  await creerCompte(db, { id: ETU, full_name: 'Salma Bennani', role: 'etudiant', filiere: 'Génie Industriel', promo: S + 1 });
  await creerCompte(db, { id: ETU2, full_name: 'Omar Tazi', role: 'etudiant', filiere: 'Génie Industriel', promo: S + 1 });
  await creerCompte(db, { id: LAU, full_name: 'Youssef Alaoui', role: 'laureat', filiere: 'Génie Industriel', promo: 2018, mentor_dispo: true });
  await creerCompte(db, { id: ADMIN, full_name: 'Admin École', role: 'laureat', filiere: 'Génie Industriel', promo: 2012 });
});

test('l’étudiant confirme sa présence ; un nouvel horaire demande une nouvelle confirmation', async () => {
  const id = await demande(ETU, LAU, 'Relire mon CV');
  // Pas de confirmation avant que le rendez-vous soit fixé
  await q(ETU, `update public.mentorships set confirme_at = now() where id = $1`, [id]);
  assert.equal((await lire(id)).confirme_at, null);
  await q(LAU, `update public.mentorships set status = 'acceptee', rdv_at = $2 where id = $1`, [id, dans(30)]);
  // Le lauréat ne peut pas confirmer à la place de l'étudiant, ni un autre étudiant
  await q(LAU, `update public.mentorships set confirme_at = now() where id = $1`, [id]);
  await q(ETU2, `update public.mentorships set confirme_at = now() where id = $1`, [id]);
  assert.equal((await lire(id)).confirme_at, null);
  await q(ETU, `update public.mentorships set confirme_at = '2001-01-01' where id = $1`, [id]);
  const c = (await lire(id)).confirme_at;
  assert.ok(c && Date.now() - new Date(c) < 6e4, 'l’heure de confirmation est celle de la base');
  // Le lauréat déplace le rendez-vous : la confirmation repart à zéro
  await q(LAU, `update public.mentorships set status = 'acceptee', rdv_at = $2 where id = $1`, [id, dans(48)]);
  assert.equal((await lire(id)).confirme_at, null);
  // « C'est fait » pendant le rendez-vous : le lauréat peut clore
  await q(LAU, `update public.mentorships set status = 'terminee' where id = $1`, [id]);
  assert.equal((await lire(id)).status, 'terminee');
});

test('l’administration qui fixe elle-même un rendez-vous a sa salle de visio', async () => {
  // La demande est adressée à un lauréat qui devient ensuite administrateur
  const id = await demande(ETU, ADMIN, 'Choisir mon PFE');
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  await q(ADMIN, `update public.mentorships set status = 'acceptee', rdv_at = $2 where id = $1`, [id, dans(26)]);
  const m = await lire(id);
  assert.equal(m.status, 'acceptee');
  assert.ok(m.accepted_at, 'accepted_at rempli');
  const [lien] = await q(ETU, 'select lien from public.liens_rdv where id = $1', [id]);
  assert.match(lien.lien, /^https:\/\/meet\.jit\.si\/ReseauENSAM-[0-9a-f]{12}$/);
  // L'étudiant confirme, l'administration déplace : nouvelle confirmation demandée
  await q(ETU, `update public.mentorships set confirme_at = now() where id = $1`, [id]);
  assert.ok((await lire(id)).confirme_at);
  await q(ADMIN, `update public.mentorships set rdv_at = $2 where id = $1`, [id, dans(50)]);
  assert.equal((await lire(id)).confirme_at, null);
});

test('la mise à jour crée la salle de visio des rendez-vous qui n’en avaient pas', async () => {
  const id = await demande(ETU2, LAU, 'Préparer un entretien');
  await db.query(`update public.mentorships set status = 'acceptee', rdv_at = $2 where id = $1`, [id, dans(40)]);
  await db.query('delete from public.liens_rdv where id = $1', [id]);
  const sql = (await import('node:fs')).readFileSync(SCHEMA, 'utf8');
  const bloc = sql.slice(sql.indexOf('-- Rendez-vous fixés sans salle de visio'), sql.indexOf('on conflict (id) do nothing;', sql.indexOf('-- Rendez-vous fixés sans salle de visio')) + 28);
  await db.exec(bloc);
  assert.equal((await db.query('select count(*)::int n from public.liens_rdv where id = $1', [id])).rows[0].n, 1);
});

test('rendez-vous annulé : qui annule est nommé ; l’étudiant reçoit de quoi proposer d’autres horaires', async () => {
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) select id, 'https://push.example/' || id, 'k', 'a' from public.profiles on conflict do nothing`);
  const pushs = async user => (await db.query(`select data from public.push_queue where kind = 'mentorat_annule' and user_id = $1`, [user])).rows.map(r => r.data);
  const fixe = async (sujet) => { const id = await demande(ETU2, LAU, sujet); await q(LAU, `update public.mentorships set status = 'acceptee', rdv_at = $2 where id = $1`, [id, dans(30)]); return id; };
  await db.query('delete from public.push_queue');
  // Le lauréat annule : l'étudiant est prévenu, avec le nom et le rendez-vous à reprendre
  const a = await fixe('Préparer un entretien');
  await q(LAU, `update public.mentorships set status = 'annulee' where id = $1`, [a]);
  assert.deepEqual(await pushs(ETU2), [{ sujet: 'Préparer un entretien', m: a, nom: 'Youssef Alaoui', pour: 'demandeur' }]);
  // L'étudiant annule : le lauréat est prévenu
  const b = await fixe('Relire ma lettre');
  await q(ETU2, `update public.mentorships set status = 'annulee' where id = $1`, [b]);
  assert.deepEqual(await pushs(LAU), [{ sujet: 'Relire ma lettre', m: b, nom: 'Omar Tazi', pour: 'mentor' }]);
  // L'administration annule : ni nom ni « pour », le notifier garde l'ancien texte
  const c = await fixe('Choisir mon stage');
  await db.query('delete from public.push_queue');
  await q(ADMIN, `update public.mentorships set status = 'annulee' where id = $1`, [c]);
  assert.equal((await lire(c)).status, 'annulee');
  assert.deepEqual([...await pushs(ETU2), ...await pushs(LAU)], [{ sujet: 'Choisir mon stage', m: c }]);
});
