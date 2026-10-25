// Rappels de visite côté site : la dernière visite notée au plus une fois par heure (sans rien bloquer),
// la case « Rappels » dans Mon profil avec ses mots en arabe, le lien de désabonnement des emails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SupabaseStore } from '../../src/store.js';

const SRC = new URL('../../src/', import.meta.url);
const lire = f => fs.readFileSync(new URL(f, SRC), 'utf8');

test('dernière visite : marquer_vu au plus une fois par heure ; une base pas encore à jour ne gêne rien', async () => {
  const s = new SupabaseStore({});
  const appels = [];
  s.session = { user: { id: 'moi' } }; s.me = { id: 'moi' };
  s.sb = { rpc: async fn => { appels.push(fn); return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.marquer_vu' } }; } };
  const t = Date.UTC(2026, 9, 25, 18);
  s.noterVisite(t);
  s.noterVisite(t + 30 * 60e3);
  s.noterVisite(t + 59 * 60e3);
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(appels, ['marquer_vu']);
  s.noterVisite(t + 61 * 60e3);
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(appels, ['marquer_vu', 'marquer_vu']);
  // Un autre compte sur le même appareil a sa propre heure ; sans compte, rien
  s.me = { id: 'autre' }; s.session = { user: { id: 'autre' } };
  s.noterVisite(t + 62 * 60e3);
  s.me = null; s.noterVisite(t + 200 * 60e3);
  await new Promise(r => setTimeout(r, 0));
  assert.equal(appels.length, 3);
  // Une panne réseau (promesse rejetée) ne remonte jamais
  s.me = { id: 'moi' }; s.sb = { rpc: async () => { throw new TypeError('Failed to fetch'); } };
  s.noterVisite(t + 300 * 60e3);
  await new Promise(r => setTimeout(r, 0));
});

test('Mon profil : une case « Rappels » pour les étudiants et les lauréats (pas pour l’équipe), traduite en arabe', () => {
  const r = lire('rappels.js'), p = lire('privacy.js');
  assert.match(p, /rappels: RAPPELS_NOTIF\.etudiant/);
  assert.match(p, /rappels: RAPPELS_NOTIF\.laureat/);
  assert.match(p, /c !== 'rappels'/);
  for (const k of ['RAPPELS_NOTIF.etudiant[1]', 'RAPPELS_NOTIF.laureat[1]', 'PHRASE_VISITE']) assert.ok(r.includes(`[${k}]:`), k);
  assert.match(r, /Rappels: 'التذكيرات'/);
  // Les textes affichés sur la page de désabonnement ont tous leur traduction
  const ar = r.slice(r.indexOf('addAR({'), r.indexOf('});', r.indexOf('addAR({')));
  const page = r.slice(r.indexOf('export function DesaboRappels'));
  for (const [, t] of page.matchAll(/>([^<>${}]*[a-zé][^<>${}]*)</g)) if (t.trim().length > 3) assert.ok(ar.includes(`'${t.trim()}'`) || ar.includes(`\n  ${t.trim()}: `) || ['Me désabonner', 'Aller sur la plateforme'].includes(t.trim()), t);
  assert.match(p, /quoi === 'rappels'/);
});
