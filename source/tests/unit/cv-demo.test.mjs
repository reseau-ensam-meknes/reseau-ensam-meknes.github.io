// CV de démonstration (seed-cv.js), celui que Match montre en grand : une vraie page A4 bien formée, le pied
// « CV de démonstration — données fictives », des dates qui se tiennent (rien avant l'entrée à l'école ni après aujourd'hui),
// des stages dans des entreprises inventées, et chaque ligne dans sa colonne (aucun texte ne déborde ni ne descend sous le pied).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pdfCvDemo, contenuCv, mesure } from '../../src/seed-cv.js';
import { codeWinAnsi } from '../../src/store.js';
import { buildSeed } from '../../src/seed.js';
import { logoEntreprise, niveauOf, seasonOf, demandesActives, FILIERES, PREPA } from '../../src/logic.js';

const NOW = new Date('2026-11-01T10:00:00Z');
const S = seasonOf(NOW), AN = NOW.getFullYear();
const DATA = buildSeed(NOW);
const demandeDe = p => demandesActives(DATA, p.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;

// Les profils essayés : tous les étudiants et lauréats de la démo, plus des cas difficiles (noms longs, compétences longues,
// prépa restée dans le profil d'un 4A, aucune compétence)
const DIFFICILES = [
  { id: 'cv-t1', full_name: 'Nour El Houda Benjelloun Touimi', role: 'etudiant', filiere: FILIERES[0], promo: S + 1, ville: 'Casablanca',
    competences: ['Ingénierie des systèmes embarqués temps réel', 'Analyse de données et visualisation', 'Anticonstitutionnellement-long-mot', 'Power BI'] },
  { id: 'cv-t2', full_name: 'Abderrahmane El Ouazzani Chahdi', role: 'etudiant', filiere: PREPA, promo: S + 2, ville: 'Errachidia', competences: [] },
  { id: 'cv-t3', full_name: 'Imane Squalli', role: 'etudiant', filiere: PREPA, promo: S + 4, ville: 'Fès', competences: ['Python'] },
  { id: 'cv-t4', full_name: 'Ayoub Lahlou', role: 'etudiant', filiere: FILIERES[FILIERES.length - 1], promo: S + 3, ville: 'Meknès', competences: [], linkedin: 'https://www.linkedin.com/in/ayoub-lahlou-a1b2c3/' },
];
const PROFILS = [...DATA.profiles.filter(p => ['etudiant', 'laureat'].includes(p.role)), ...DIFFICILES];

// Les noms de vraies entreprises de la démo (offres, postes des lauréats) : un stage du CV n'en porte jamais un
const VRAIES = new Set([...DATA.offers.map(o => o.entreprise), ...DATA.profiles.map(p => p.entreprise)].filter(Boolean).map(x => x.toLowerCase()));

// Lecture du PDF : les objets, la table xref, et chaque texte posé (police, taille, espacement, position, texte décodé)
const INVERSE = (() => { const m = {}; for (let u = 0; u < 0x2200; u++) { const c = String.fromCharCode(u); const k = codeWinAnsi(c); if (k >= 128 && !(k in m)) m[k] = c; } return m; })();
const decoder = s => s.replace(/\\([0-7]{3}|[()\\])/g, (x, g) => (g.length === 3 ? INVERSE[parseInt(g, 8)] ?? '?' : g));
async function lire(blob) {
  const brut = Buffer.from(await blob.arrayBuffer()).toString('latin1');
  const textes = [...brut.matchAll(/BT \/(F1|F2) ([\d.]+) Tf ([\d.-]+) Tc [\d. ]+ rg ([\d.-]+) ([\d.-]+) Td \(((?:\\.|[^\\)])*)\) Tj ET/g)]
    .map(m => { const t = decoder(m[6]), gras = m[1] === 'F2', taille = +m[2], espace = +m[3]; return { t, gras, taille, x: +m[4], y: +m[5], w: mesure(t, gras, taille, espace) }; });
  return { brut, textes };
}

test('CV de démo : un PDF A4 bien formé (objets, xref, fin), avec le pied « données fictives » et le nom en tête', async () => {
  for (const p of [DATA.profiles.find(x => x._persona?.includes('Salma')), ...DIFFICILES]) {
    const b = pdfCvDemo(p, { now: NOW, demande: demandeDe(p) });
    assert.equal(b.type, 'application/pdf');
    const { brut, textes } = await lire(b);
    assert.ok(brut.startsWith('%PDF-1.4\n') && brut.endsWith('%%EOF'), p.full_name);
    assert.match(brut, /\/MediaBox \[0 0 595 842\]/);
    // startxref pointe sur la table, et chaque entrée sur son objet
    const xref = +brut.match(/startxref\n(\d+)\n%%EOF$/)[1];
    assert.equal(brut.slice(xref, xref + 4), 'xref');
    const entrees = [...brut.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map(m => +m[1]);
    assert.ok(entrees.length >= 6);
    entrees.forEach((o, i) => assert.equal(brut.slice(o, o + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`));
    // La longueur du flux est juste (une visionneuse stricte le relit)
    const [, lg, flux] = brut.match(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/);
    assert.equal(flux.length, +lg);
    const pied = textes.find(x => x.t === 'CV de démonstration — données fictives');
    assert.ok(pied && pied.y < 46, 'le pied « données fictives » est en bas de la page');
    assert.ok(textes.some(x => x.t === p.full_name && x.y > 692), 'le nom est dans le bandeau');
    assert.ok(!textes.some(x => /undefined|null|NaN|\?\?/.test(x.t)), textes.map(x => x.t).find(t => /undefined|null|NaN|\?\?/.test(t)));
  }
});

test('CV de démo : chaque ligne reste dans sa colonne, rien sous le pied, rien hors de la page', async () => {
  const soucis = [];
  for (const p of PROFILS) {
    const { textes } = await lire(pdfCvDemo(p, { now: NOW, demande: demandeDe(p) }));
    for (const x of textes) {
      const fin = x.x + x.w, ou = `${p.full_name} : « ${x.t} »`;
      if (x.y > 692) { if (x.x < 18 || fin > 595 - 18) soucis.push(`bandeau ${ou} ${x.x.toFixed(1)}–${fin.toFixed(1)}`); continue; }
      if (x.y < 46) { if (x.t !== 'CV de démonstration — données fictives') soucis.push(`sous le pied ${ou}`); continue; }
      // Colonne latérale : de 26 à 174 pt ; colonne principale : de 220 à 561 pt
      if (x.x < 196) { if (x.x < 25.9 || fin > 174.5) soucis.push(`latérale ${ou} ${x.x.toFixed(1)}–${fin.toFixed(1)}`); }
      else if (x.x < 219.9 || fin > 561.5) soucis.push(`principale ${ou} ${x.x.toFixed(1)}–${fin.toFixed(1)}`);
    }
  }
  assert.deepEqual(soucis, []);
});

test('CV de démo : des dates qui se tiennent (entrée à l’école, années d’études, jamais après aujourd’hui)', () => {
  const soucis = [];
  for (const p of PROFILS) {
    const c = contenuCv(p, { now: NOW, demande: demandeDe(p) });
    const P = Number(p.promo), niv = niveauOf(p, S), etudiant = p.role === 'etudiant' && niv <= 5;
    // Chaque date : son début (une année seule, ou « 2025 – 2026 » : une année universitaire, qui peut être celle en cours)
    const dates = l => l.map(e => (String(e.droite || '').match(/\b(?:19|20)\d{2}\b/g) || []).map(Number)).filter(x => x.length);
    for (const [a, b] of dates([...c.experiences, ...c.projets, ...c.assos])) {
      const ou = `${p.full_name} (${etudiant ? niv + 'A' : 'lauréat'}, promo ${P}) : ${a}${b ? ' – ' + b : ''}`;
      // Rien avant l'entrée à l'école (septembre de la promo − 5) pour un étudiant ; rien qui commence après aujourd'hui ;
      // une année universitaire finit au plus tard avec celle en cours
      if ((etudiant && a < P - 5) || a > AN || (b !== undefined && (b < a || b > S + 1))) soucis.push(ou);
    }
    if (etudiant) {
      if (niv >= 3) assert.equal(c.formation[0].droite, `${P - 3} – ${P}`, p.full_name);
      const bac = c.formation.find(f => f.titre.startsWith('Baccalauréat'));
      assert.equal(bac?.droite, String(P - 5), p.full_name);
    }
    // Une association ne commence jamais avant l'entrée à l'école
    for (const x of c.assos) { const [a] = x.droite.split(' – ').map(Number); if (a < P - 5) soucis.push(`${p.full_name} : association en ${a}`); }
  }
  assert.deepEqual(soucis, []);
});

test('CV de démo : les stages des étudiants sont dans des entreprises inventées (aucun vrai nom, aucun vrai logo), jamais deux fois la même', () => {
  for (const p of PROFILS.filter(x => x.role === 'etudiant')) {
    const c = contenuCv(p, { now: NOW, demande: demandeDe(p) });
    const noms = c.experiences.map(e => e.e?.nom).filter(Boolean);
    for (const n of noms) {
      assert.equal(logoEntreprise(n), null, `${p.full_name} : ${n} a un vrai logo`);
      assert.ok(!VRAIES.has(n.toLowerCase()), `${p.full_name} : ${n} est une vraie entreprise de la démo`);
    }
    assert.equal(new Set(noms).size, noms.length, `${p.full_name} : deux stages dans la même entreprise`);
  }
});

test('CV de démo : le même profil donne le même CV ; deux profils de la même filière ne se ressemblent pas mot pour mot', async () => {
  const [a, b] = DATA.profiles.filter(p => p.role === 'etudiant' && niveauOf(p, S) === 5 && p.filiere === DATA.profiles.find(x => x._persona?.includes('Salma')).filiere);
  const lu = async p => (await lire(pdfCvDemo(p, { now: NOW }))).textes.map(x => x.t).join('\n');
  assert.equal(await lu(a), await lu(a));
  if (b) assert.notEqual((await lu(a)).replace(a.full_name, ''), (await lu(b)).replace(b.full_name, ''));
});
