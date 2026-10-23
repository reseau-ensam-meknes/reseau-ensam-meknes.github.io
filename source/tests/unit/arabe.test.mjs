// Version arabe : nombres écrits pareil qu'en français, une seule traduction par texte français, et les mots du réseau
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

globalThis.document ??= { documentElement: {} }; // i18n.js pose lang et dir sur <html>
const { setLang, t, nombresLTR } = await import('../../src/i18n.js');
const { pct } = await import('../../src/logic.js');
await setLang('ar');

const LRI = '⁦', PDI = '⁩';

test('nombres : « 93% », « +258 », « 2026-2027 » isolés de gauche à droite, une seule écriture', () => {
  assert.equal(nombresLTR('93 %'), `${LRI}93%${PDI}`);
  assert.equal(nombresLTR('93 %'), `${LRI}93%${PDI}`);
  assert.equal(nombresLTR('+258 خلال 30 يومًا'), `${LRI}+258${PDI} خلال 30 يومًا`);
  assert.equal(nombresLTR('موسم 2026 – 2027'), `موسم ${LRI}2026-2027${PDI}`);
  assert.equal(nombresLTR('−3'), `${LRI}−3${PDI}`);
  // Un nombre seul, une heure, une date ou un numéro ne bougent pas
  for (const s of ['12', '17:30', '21 أكتوبر', '3A', 'دفعة 2021']) assert.equal(nombresLTR(s), s);
  // Déjà isolé : rien n'est ajouté
  assert.equal(nombresLTR(nombresLTR('+5 نقاط')), nombresLTR('+5 نقاط'));
  assert.equal(pct(0.93), '93%');
});

test('nombres dans les traductions : signe, pourcentage et saison isolés', () => {
  assert.equal(t('+10 points'), `${LRI}+10${PDI} نقطة`);
  assert.equal(t('93 % des comptes'), `${LRI}93%${PDI} من الحسابات`);
  assert.equal(t('Saison 2026-2027'), `موسم ${LRI}2026-2027${PDI}`);
  assert.equal(t('+258'), `${LRI}+258${PDI}`); // texte sans lettre : seulement isolé
});

// Les dictionnaires : export const AR = {…} dans i18n-ar.js et chaque addAR({…}) des modules
const SRC = new URL('../../src/', import.meta.url);
const fichiers = fs.readdirSync(SRC).filter(f => f.endsWith('.js') && !f.startsWith('seed'));
function blocs(code) {
  const out = [];
  for (const m of code.matchAll(/(?:^export const AR = |addAR\()\{/gm)) {
    let i = m.index + m[0].length, prof = 1, q = null;
    for (; i < code.length && prof; i++) {
      const c = code[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; } else if (c === '/' && code[i + 1] === '/') i = code.indexOf('\n', i);
      else if (c === "'" || c === '"' || c === '`') q = c; else if (c === '{') prof++; else if (c === '}') prof--;
    }
    out.push(code.slice(m.index + m[0].length, i - 1));
  }
  return out;
}
const PAIRE = /'((?:[^'\\\n]|\\.)+)'\s*:\s*'((?:[^'\\\n]|\\.)*)'/g;

test('une seule traduction par texte français : un module ne remplace pas en silence le sens d’un autre', () => {
  const vus = new Map(), conflits = [];
  for (const f of fichiers) {
    for (const b of blocs(fs.readFileSync(new URL(f, SRC), 'utf8'))) {
      for (const [, cle, val] of b.matchAll(PAIRE)) {
        const avant = vus.get(cle);
        if (avant && avant[1] !== val) conflits.push(`${JSON.stringify(cle)} : ${avant[0]} « ${avant[1]} » / ${f} « ${val} »`);
        else if (!avant) vus.set(cle, [f, val]);
      }
    }
  }
  assert.ok(vus.size > 2000, `dictionnaires lus (${vus.size} clés)`);
  assert.deepEqual(conflits, []);
});

test('« Français » sur le bouton de langue, « Nom » d’une startup n’est pas un nom de famille', () => {
  const entree = fs.readFileSync(new URL('entree.js', SRC), 'utf8');
  assert.match(entree, /<span class="lang-long" translate="no">\$\{ar \? 'Français'/);
  assert.equal(t('Nom'), 'الاسم');
  const admin = fs.readFileSync(new URL('admin.js', SRC), 'utf8'); // colonne du fichier CSV des membres
  assert.match(admin, /\['nom', 'Nom de famille'\]/);
  assert.match(admin, /'Nom de famille': 'الاسم العائلي'/);
  assert.doesNotMatch(admin, /'Nom': /);
});

test('mots du réseau : خريجين pour les lauréats, jamais القدامى', () => {
  const textes = [...fichiers.map(f => [f, fs.readFileSync(new URL(f, SRC), 'utf8')]),
    ['notifier', fs.readFileSync(new URL('../../supabase/functions/notifier/index.ts', import.meta.url), 'utf8')]];
  assert.deepEqual(textes.filter(([, s]) => s.replace(/^\s*\/\/.*$/gm, '').includes('القدامى')).map(([f]) => f), []); // la règle peut être rappelée en commentaire
  assert.match(t('Lauréats'), /الخريجون|الخريجين/);
});
