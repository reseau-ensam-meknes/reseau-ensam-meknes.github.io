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
