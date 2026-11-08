// Lien d'une offre partagé (WhatsApp) : la page d'entrée dit le type de l'offre et si elle est ouverte, sans compte.
// Jamais le titre, l'entreprise, l'auteur, les années ni le texte ; la table des offres reste illisible sans compte.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nouvelleBase, creerCompte, en, uid } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db; const LAU = uid(801); const ids = {};

before(async () => {
  db = await nouvelleBase(SCHEMA);
  // La mise à jour se rejoue sans erreur
  await db.exec(fs.readFileSync(SCHEMA, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, ''));
  await creerCompte(db, { id: LAU, full_name: 'Lauréate Offres', role: 'laureat', filiere: 'Génie Industriel', promo: 2016 });
  const offre = async (k, type, extra = '') => {
    const r = await en(db, LAU, tx => tx.query(`insert into public.offers (author_id, type, titre, entreprise, description, annees${extra ? ', audience' : ''}) values ($1, $2, 'Titre secret ' || $3, 'Entreprise secrète', 'Texte secret ' || $3, '{5}'${extra ? `, '${extra}'` : ''}) returning id`, [LAU, type, k]));
    ids[k] = r.rows[0].id;
  };
  await offre('pfe', 'pfe'); await offre('lau', 'emploi', 'laureats'); await offre('pourvue', 'stage');
  await en(db, LAU, tx => tx.query(`update public.offers set status = 'pourvue' where id = $1`, [ids.pourvue]));
});

const lire = (id, role = 'anon') => en(db, null, tx => tx.query('select public.offre_partagee($1) x', [id]), { role }).then(r => r.rows[0].x);

test('sans compte : le type, le public et l’état de l’offre, rien d’autre', async () => {
  assert.deepEqual(await lire(ids.pfe), { type: 'pfe', audience: 'etudiants', ouverte: true });
  assert.deepEqual(await lire(ids.lau), { type: 'emploi', audience: 'laureats', ouverte: true });
  assert.deepEqual(await lire(ids.pourvue), { type: 'stage', audience: 'etudiants', ouverte: false });
  const tout = JSON.stringify([await lire(ids.pfe), await lire(ids.lau), await lire(ids.pourvue)]);
  assert.doesNotMatch(tout, /secret|Titre|Entreprise|annees|author|8010/i);
});

test('une offre qui n’existe plus : null ; la table des offres reste illisible sans compte', async () => {
  assert.equal(await lire(uid(899)), null);
  const r = await en(db, null, tx => tx.query('select count(*)::int n from public.offers'), { role: 'anon' }).catch(e => e);
  assert.ok(r instanceof Error ? /permission denied/.test(r.message) : r.rows[0].n === 0);
});

test('connecté : la même réponse', async () => {
  assert.deepEqual(await lire(ids.pfe, 'authenticated'), await lire(ids.pfe));
});

// Une école dont le réseau n'est pas encore ouvert : le lien d'une de ses offres ne dit rien à qui n'en est pas membre,
// exactement comme une offre qui n'existe pas (null). Ses membres la reconnaissent ; ouverte, tout le monde.
const lireEn = (u, id) => en(db, u, tx => tx.query('select public.offre_partagee($1) x', [id])).then(r => r.rows[0].x);
const CASA_LAU = uid(802), CASA_ETU = uid(803);
test('une offre d’une école fermée : rien, comme une offre inconnue ; un membre de cette école la reconnaît', async () => {
  await db.query(`update public.ecoles set ouverte = true where slug = 'ensam-casa'`);
  await creerCompte(db, { id: CASA_LAU, full_name: 'Lauréate Casa', role: 'laureat', filiere: 'Génie Industriel', promo: 2015, ecole: 'ensam-casa' });
  await creerCompte(db, { id: CASA_ETU, full_name: 'Étudiant Casa', role: 'etudiant', filiere: 'Génie Industriel', promo: 2027, ecole: 'ensam-casa' });
  const r = await en(db, CASA_LAU, tx => tx.query(`insert into public.offers (author_id, type, titre, entreprise, description, annees) values ($1, 'stage', 'Titre secret casa', 'Entreprise secrète', 'Texte secret casa', '{4}') returning id, ecole`, [CASA_LAU]));
  assert.equal(r.rows[0].ecole, 'ensam-casa');
  ids.casa = r.rows[0].id;
  await db.query(`update public.ecoles set ouverte = false where slug = 'ensam-casa'`);
  const rien = await lire(uid(898));
  assert.equal(rien, null);
  assert.equal(await lire(ids.casa), rien, 'un visiteur sans compte');
  assert.equal(await lireEn(LAU, ids.casa), rien, 'un membre de l’ENSAM Meknès');
  assert.deepEqual(await lireEn(CASA_ETU, ids.casa), { type: 'stage', audience: 'etudiants', ouverte: true }, 'un membre de l’école');
  // Le réseau ouvert : la réponse habituelle pour tous
  await db.query(`update public.ecoles set ouverte = true where slug = 'ensam-casa'`);
  try { assert.deepEqual(await lire(ids.casa), { type: 'stage', audience: 'etudiants', ouverte: true }); }
  finally { await db.query(`update public.ecoles set ouverte = false where slug = 'ensam-casa'`); }
});

test('ENSAM Meknès : la même réponse qu’avant, octet pour octet', async () => {
  for (const k of ['pfe', 'lau', 'pourvue']) {
    const avant = (await db.query(`select jsonb_build_object('type', o.type, 'audience', coalesce(o.audience, 'etudiants'), 'ouverte', o.status = 'ouverte')::text t
      from public.offers o where o.id = $1`, [ids[k]])).rows[0].t;
    for (const u of [null, LAU, CASA_ETU]) {
      const t = (await en(db, u, tx => tx.query('select public.offre_partagee($1)::text t', [ids[k]]), { role: u ? 'authenticated' : 'anon' })).rows[0].t;
      assert.equal(t, avant, `${k} ${u || 'visiteur'}`);
    }
  }
});
