// Version arabe : chaque carte « rien ici pour l'instant » a sa traduction (titre et texte)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SRC = new URL('../../src/', import.meta.url);
const fichiers = fs.readdirSync(SRC).filter(f => f.endsWith('.js'));
const tout = fichiers.map(f => fs.readFileSync(new URL(f, SRC), 'utf8')).join('\n');
const traduit = s => tout.includes(`'${s.replace(/'/g, "\\'")}':`);

test('écrans vides : titre et texte traduits en arabe', () => {
  const manquants = [];
  for (const f of fichiers.filter(f => !/^seed|^i18n/.test(f))) {
    const code = fs.readFileSync(new URL(f, SRC), 'utf8');
    for (const [, titre, texte] of code.matchAll(/<\$\{Empty\}[^>]*?title="([^"]+)"[^>]*>([^<$`]*)/g)) {
      for (const s of [titre, texte.trim()]) if (s && !traduit(s)) manquants.push(`${f} : ${s}`);
    }
  }
  assert.deepEqual(manquants, []);
});
