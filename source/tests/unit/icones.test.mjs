// Chaque icône nommée dans le code (<${Icon} name="…">) est définie : une icône inconnue s'affiche vide, sans aucune erreur
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SRC = new URL('../../src/', import.meta.url).pathname;
const fichiers = fs.readdirSync(SRC).filter(f => f.endsWith('.js')).map(f => [f, fs.readFileSync(path.join(SRC, f), 'utf8')]);

test('icônes : chaque nom utilisé dans le code est défini (entree.js ou un ajouterIcones)', () => {
  const definies = new Set();
  for (const [, s] of fichiers) {
    for (const b of s.matchAll(/(?:const ICONS = \{|ajouterIcones\(\{)([\s\S]*?)\n?\}\)?;/g)) {
      for (const m of b[1].matchAll(/(?:^|[\s,{])'?([a-zA-Z][\w-]*)'?\s*:\s*['`]/g)) definies.add(m[1]);
    }
  }
  assert.ok(definies.size > 50, `les définitions sont bien lues (${definies.size})`);
  const manquantes = [];
  for (const [f, s] of fichiers) {
    for (const m of s.matchAll(/<\$\{Icon\} name=(?:"([\w-]+)"|\$\{'([\w-]+)'\})/g)) {
      const n = m[1] || m[2];
      if (!definies.has(n)) manquantes.push(`${f} : ${n}`);
    }
  }
  assert.deepEqual(manquantes, []);
});
