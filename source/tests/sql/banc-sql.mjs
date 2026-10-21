// Banc SQL : Postgres (PGlite) avec ce qu'il faut de Supabase pour exécuter schema.sql et tester RLS et triggers.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

export const SUPABASE = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text, created_at timestamptz default now(), last_sign_in_at timestamptz, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, owner uuid, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now(), unique (bucket_id, name));
alter table storage.objects enable row level security;
grant all on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create function storage.filename(name text) returns text language sql immutable as $$ select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)] $$;
create function storage.extension(name text) returns text language sql immutable as $$ select lower(reverse(split_part(reverse(name), '.', 1))) $$;
`;

export async function nouvelleBase(schemaPath) {
  const db = new PGlite();
  await db.exec(SUPABASE);
  if (schemaPath) await db.exec(fs.readFileSync(schemaPath, 'utf8').replace(/^create extension if not exists pgcrypto;$/m, '-- pgcrypto : gen_random_uuid est intégré'));
  return db;
}

// Exécute en tant que membre connecté (rôle authenticated + auth.uid()), dans une transaction annulée ou validée
export async function en(db, uid, fn, { role = 'authenticated' } = {}) {
  return db.transaction(async tx => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid || '']);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
}

export async function creerCompte(db, { id, email, ...profil }) {
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email || id.slice(-4) + '@exemple.ma']);
  if (profil.full_name) {
    const cols = Object.keys(profil);
    await en(db, id, tx => tx.query(`insert into public.profiles (id, ${cols.join(',')}) values ($1, ${cols.map((_, i) => '$' + (i + 2)).join(',')})`, [id, ...cols.map(k => profil[k])]));
  }
}
export const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
