// Un mot pour chaque chose : les textes affichés (et ceux des emails) ne disent plus « (e) », « shortlist »,
// « Intitulé » ni « saison » (موسم), et « demande » ne désigne plus que les Demandes des étudiants.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SRC = new URL('../../src/', import.meta.url);
const NOTIFIER = new URL('../../supabase/functions/notifier/index.ts', import.meta.url);
const lire = u => fs.readFileSync(u, 'utf8');

// Les littéraux de texte d'un fichier JS/TS ('…', "…", `…` sans les ${…}), commentaires et expressions régulières exclus
export function litteraux(code) {
  const out = []; let i = 0; const n = code.length;
  const lireChaine = q => { // i est sur le guillemet ouvrant
    let s = ''; i++;
    while (i < n && code[i] !== q) { if (code[i] === '\\') { s += code[i + 1]; i += 2; } else s += code[i++]; }
    i++; return s;
  };
  const lireGabarit = () => { // i est sur l'accent grave ouvrant ; chaque ${…} devient un espace (et ses propres textes sont lus)
    let s = ''; i++;
    while (i < n && code[i] !== '`') {
      if (code[i] === '\\') { s += code[i + 1]; i += 2; }
      else if (code[i] === '$' && code[i + 1] === '{') { i += 2; lire(true); s += ' '; }
      else s += code[i++];
    }
    i++; return s;
  };
  // Lit le code jusqu'à la fin (ou jusqu'à l'accolade qui ferme un ${…})
  function lire(dansGabarit) {
    let prev = '', prof = 0; // dernier caractère significatif : distingue une division d'une expression régulière
    while (i < n) {
      const c = code[i];
      if (c === '/' && code[i + 1] === '/') { while (i < n && code[i] !== '\n') i++; continue; }
      if (c === '/' && code[i + 1] === '*') { i = code.indexOf('*/', i + 2); i = i < 0 ? n : i + 2; continue; }
      if (c === '\'' || c === '"') { out.push(lireChaine(c)); prev = 'a'; continue; }
      if (c === '`') { out.push(lireGabarit()); prev = 'a'; continue; }
      if (c === '/' && (!prev || '(,=:[!&|?{};+-*%<>~^'.includes(prev) || /\b(return|typeof|case)$/.test(code.slice(Math.max(0, i - 8), i).trimEnd()))) {
        i++; let classe = false; // expression régulière : jusqu'au / fermant (hors classe [...])
        while (i < n && (classe || code[i] !== '/')) { if (code[i] === '\\') i++; else if (code[i] === '[') classe = true; else if (code[i] === ']') classe = false; i++; }
        i++; while (/[a-z]/.test(code[i] || '')) i++;
        prev = 'a'; continue;
      }
      if (c === '{') prof++;
      if (c === '}') { if (dansGabarit && !prof) { i++; return; } prof--; }
      if (!/\s/.test(c)) prev = c;
      i++;
    }
  }
  lire(false);
  return out;
}

const fichiers = fs.readdirSync(SRC).filter(f => f.endsWith('.js') && !/^seed|^pdf/.test(f));
const TEXTES = [...fichiers.map(f => [f, litteraux(lire(new URL(f, SRC)))]), ['notifier', litteraux(lire(NOTIFIER))]];
// Ce qui n'est jamais lu : les identifiants, classes et liens d'un gabarit, et les noms de propriétés (« saison= »)
const lu = s => s.replace(/\b(?:id|class|name|href|for|type|key|src|rel|target|role|data-[\w-]+)="[^"]*"/g, ' ').replace(/\b[\w-]+=/g, ' ');
const cherche = (re, garde = () => true) => TEXTES.flatMap(([f, l]) => l.filter(s => re.test(lu(s)) && garde(lu(s), f)).map(s => `${f} : ${s.slice(0, 120)}`));

test('lexique : l’extracteur voit les textes, pas les commentaires ni les expressions régulières', () => {
  const l = litteraux("// Lauréat(e)\nconst a = 'Bonjour', b = `Promo ${x ? 'A' : `B${y}`} fin`; /* (e) */ const r = /^Tu (.+)$/; f(e => e);");
  assert.deepEqual(l, ['Bonjour', 'A', 'B ', 'Promo   fin']);
  assert.deepEqual(litteraux("html`<b>${x.replace(/'/g, '')}</b> ${a / b}`; const c = 'ok';"), ['', '<b> </b>  ', 'ok']);
});

test('lexique : plus de « (e) » ni de « le/la », en français comme en arabe (« (ة) »)', () => {
  assert.deepEqual(cherche(/\p{L}\(e\)|\ble\/la\b|\bil\/elle\b/u), []);
  assert.deepEqual(cherche(/\((?:ة|ت|ا)\)/), []);
});

test('lexique : « Mettre de côté » et « Titre de l’offre », jamais « shortlist » ni « Intitulé »', () => {
  // 'shortlist' et 'shortlists' : la valeur interne de la vue et le nom de la table, jamais affichés
  assert.deepEqual(cherche(/\bshortlist/i, s => !/^shortlists?$/.test(s)), []);
  assert.deepEqual(cherche(/\bIntitulé/), []);
});

test('lexique : « Année » partout, plus de « saison » ni de « موسم » à l’écran ou dans les emails', () => {
  assert.deepEqual(cherche(/موسم|المواسم/), []);
  // Les noms internes (clés, colonnes, contrainte) restent ; le texte lu ne dit plus « saison »
  assert.deepEqual(cherche(/\b[Ss]aisons?\b/, s => /\s/.test(s.trim()) && !/^[a-z_]+$/.test(s) && !/select=|avis_stage_un_par_saison/.test(s)), []);
});

test('lexique : « demande » ne désigne plus que les Demandes des étudiants (mentorat, CV, coordonnées)', () => {
  // Le verbe reste permis (« te demande de l’aide », « Demander un conseil ») ; le nom est réservé à la fonction phare
  const VERBE = /\b([Tt]e|lui|en|il|elle|qui|on|t’en) demandes?\b|\bdemandes? (de l’aide|une relecture|un conseil|à un lauréat)|\bDemande (une relecture|à un lauréat|un conseil|de l’aide)|\bdemande-leur\b|\bDemander\b|\bdemander\b/g;
  const PHARE = /\b(ma|ta|sa|une|la|de|des|cette|leurs?|ses|tes|mes|votre|nos) demandes? (ouvertes?|d’étudiants?|des étudiants)|Demandes? des étudiants|Publier ma demande|Voir ma demande|Ma demande|ta demande|Tes demandes|Mes demandes|une demande ouverte|qu’une demande a réunie?/g;
  const nom = s => /\b[Dd]emandes?\b/.test(lu(s).replace(VERBE, '').replace(PHARE, ''));
  const HORS_PHARE = ['mentorat.js', 'cv.js', 'confiance.js', 'privacy.js', 'messages.js'];
  // Restent permis : les identifiants et routes (« demande », « offres/demandes/… »), le CSS, le signalement d'une Demande
  // (« cette demande ») et l'ancien message de la base, gardé tant que la mise à jour SQL n'a pas tourné
  const PERMIS = new Set(['cette demande', 'Conversation pas encore ouverte : elle s’ouvre avec un mentorat, une candidature ou une demande de contact acceptée.']);
  const texte = s => /[a-zà-ÿ]/.test(s) && !/^[\w/-]+$/.test(s) && !/\{[^}]*:[^}]*;[^}]*\}/.test(s) && !PERMIS.has(s);
  const fautifs = TEXTES.filter(([f]) => HORS_PHARE.includes(f)).flatMap(([f, l]) => l.filter(s => texte(s) && nom(s)).map(s => `${f} : ${s.slice(0, 120)}`));
  assert.deepEqual(fautifs, []);
  // En arabe, طلب (pas طلبة, « étudiants ») n'apparaît pas dans les textes du mentorat, du CV ni des coordonnées
  // Restent permis : les verbes (« demander conseil » : لطلب نصيحة، طلب مراجعة) et la Demande des étudiants (طلب مفتوح)
  const AR_VERBE = /يطلب|اطلب|طلبت|مطلوبة|طلبات الطلبة|طلبي|طلبك|نشر طلب|طلباتي|طلب مفتوح|جمعك به طلب|لطلب نصيحة|من طلب النصح|^طلب مراجعة$/g;
  const fautifsAR = TEXTES.filter(([f]) => HORS_PHARE.includes(f)).flatMap(([f, l]) => l.filter(s => /طلب(?!ة)/.test(s.replace(AR_VERBE, ''))).map(s => `${f} : ${s.slice(0, 120)}`));
  assert.deepEqual(fautifsAR, []);
});
