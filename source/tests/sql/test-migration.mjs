// La mise à jour s'applique sur une base Phase 2 existante, sans perdre de données
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nouvelleBase, en, creerCompte, uid } from './banc-sql.mjs';
const AVANT = process.env.SCHEMA_AVANT || new URL('./schema-phase2.sql', import.meta.url).pathname;
const APRES = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
test('Phase 2 -> Phase 3 : données gardées, contact déplacé, relançable', async () => {
  const db = await nouvelleBase(AVANT);
  await creerCompte(db, { id: uid(1), full_name: 'Salma Test', role: 'etudiant', filiere: 'GI', promo: 2027, contact: '0611' });
  await creerCompte(db, { id: uid(2), full_name: 'Youssef Test', role: 'laureat', filiere: 'GI', promo: 2015, entreprise: 'OCP' });
  await en(db, uid(2), tx => tx.query(`insert into public.offers (author_id, type, titre, entreprise, description, annees) values ($1, 'pfe', 'PFE test', 'OCP', 'd', '{5}')`, [uid(2)]));
  const sql = fs.readFileSync(APRES, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, '');
  await db.exec(sql);
  await db.exec(sql);
  assert.equal((await db.query('select count(*)::int n from public.profiles')).rows[0].n, 2);
  assert.equal((await db.query('select count(*)::int n from public.offers')).rows[0].n, 1);
  assert.equal((await db.query('select contact from public.coordonnees where id = $1', [uid(1)])).rows[0].contact, '0611');
  assert.equal((await db.query('select contact from public.profiles where id = $1', [uid(1)])).rows[0].contact, null);
  const vus = await en(db, uid(1), tx => tx.query('select full_name, entreprise from public.profils order by full_name'));
  assert.deepEqual(vus.rows.map(r => r.full_name), ['Salma Test', 'Youssef Test']);
});
