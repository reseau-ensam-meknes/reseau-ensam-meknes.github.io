// « Offre en 30 secondes » : un lauréat colle une annonce (post LinkedIn, email, WhatsApp…)
// et le formulaire d'offre se remplit tout seul. Pur JS, sans DOM ; ne lève jamais d'exception.
import { FILIERES, TYPES } from './logic.js';
import { lookupVille, paysOf, normGeo } from './geo.js';

const KEYS = ['type', 'titre', 'entreprise', 'ville', 'pays', 'duree', 'deadline', 'lien', 'contact', 'filieres', 'annees', 'remunere', 'cooptation', 'description'];
const low = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’‘`´]/g, "'");
const pad = n => String(n).padStart(2, '0');
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\ufe0f\u200d\u20e3]/gu;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"«»]+/gi;
const EMAIL = '[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)*\\.[a-zA-Z]{2,}';
const PHONE = '(?:\\+|00)212[\\s.-]?(?:\\(0\\)\\s?)?[5-7](?:[\\s.-]?\\d){8}|\\b0[5-7](?:[\\s.-]?\\d){8}\\b|(?:\\+|00)[1-9]\\d{0,2}(?:[\\s.-]?\\d){7,12}';

// Texte nettoyé : fins de ligne, bloc de hashtags final, lignes vides en série
function clean(text) {
  const lines = text.replace(/\r\n?/g, '\n').replace(/hashtag#/gi, '#').split('\n').map(l => l.replace(/[ \t\u00a0]+$/, ''));
  while (lines.length && /^[\s\p{P}\p{S}]*(?:#[\p{L}\p{N}_]+[\s\p{P}\p{S}]*)*$/u.test(lines.at(-1))) lines.pop();
  return lines.join('\n').replace(/(?:[ \t]+#[\p{L}\p{N}_]+)+[ \t]*$/u, '').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------------------
// Lieu : ville connue (→ pays) ou pays cité ; « à X », « in X », « 📍 X » l'emportent
// ---------------------------------------------------------------------------
const CUES = new Set(['a', 'au', 'aux', 'en', 'in', 'at', 'lieu', 'location', 'localisation', 'ville', 'base', 'basee', 'based', 'situe', 'situee', 'located', 'sur', 'near', 'pres', 'to', 'vers', 'site', 'f', 'fi', 'في']);
const RISKY = new Set(['nice', 'aix', 'us', 'u s', 'jordan', 'chili', 'washington', 'milan', 'mexico', 'jorf', 'sf', 'dc']);

function findPlace(src) {
  const t = src.replace(URL_RE, ' ').replace(new RegExp(EMAIL, 'g'), ' ').replace(/(?:ensam|arts et m[ée]tiers)[\s-]*(?:de\s+)?mekn[eè]s/gi, ' ');
  const tok = [...t.matchAll(/[\p{L}\p{N}]+/gu)];
  const cueAt = i => (i > 0 && CUES.has(low(tok[i - 1][0]))) || t.slice(Math.max(0, tok[i].index - 4), tok[i].index).includes('📍');
  const cand = [];
  for (let i = 0; i < tok.length; i++) {
    const w = tok[i][0], cue = cueAt(i);
    if (/^\p{N}/u.test(w) || (/^\p{Ll}/u.test(w) && !cue)) continue;
    for (let k = Math.min(4, tok.length - i); k >= 1; k--) {
      const orig = tok.slice(i, i + k).map(m => m[0]).join(' ');
      const v = lookupVille(orig), p = v ? v.pays : paysOf(orig);
      if (!p) continue;
      const key = normGeo(orig);
      if ((key.length <= 3 && orig !== orig.toUpperCase()) || (RISKY.has(key) && !cue)) break;
      cand.push({ i, cue, v, p }); i += k - 1; break;
    }
  }
  if (!cand.length) return null;
  cand.sort((a, b) => b.cue - a.cue || !!b.v - !!a.v || a.i - b.i);
  const best = cand[0], v = best.v || cand.find(c => c.v && c.v.pays === best.p)?.v;
  return { pays: best.p, ville: v?.ville || '' };
}

// ---------------------------------------------------------------------------
// Type, durée, niveaux
// ---------------------------------------------------------------------------
const PFE = /\bpfe\b|projets? de fin d'?\s?etudes|stages? de fin d'?\s?etudes|fin de cursus|final[- ]year (?:project|internship)|graduation (?:project|internship)|end[- ]of[- ]studies|master'?s? thesis|\btfe\b/;
const STAGE = /\b(?:stages?|stagiaires?|interns?|internships?|alternance|alternant|apprenti\w*|trainee)\b/;
const STRONG = /\b(?:cdi|cdd)\b|volontariat international|offre d'emploi|contrat a duree|permanent (?:position|contract|role)|\d+\s*(?:a|-|à)?\s*\d*\s*ans? d'experience|\d+\+?\s*years? of experience/;
const HIRE = /(?:recrute\w*|recherch\w*|cherch\w*)\s+(?:un|une|des|deux|trois|\d+)\s*(?:\((?:e|es)\)\s*)?(?:ingenieur|responsable|chef|technicien|manager|consultant|developpeur|analyste|charge|directeur|superviseur)|hiring\s+(?:an?\s+|our\s+|two\s+|several\s+|\d+\s+)?(?:[\w-]+\s+){0,3}(?:engineer|developer|manager|analyst|lead|specialist|technician|consultant)s?\b/g;
const WEAK = /\b(?:poste|job|emploi|position|recrutement|hiring|recrute|recrutons|full[- ]time|temps plein|embauche)\b/;

function typeOf(L, core) {
  const L2 = L.replace(/(?:possibilit|perspective|opportunit)\w*\s+(?:d'|de\s+)?(?:embauche|recrutement|emploi|cdi|integration)[^.\n]*|pre[- ]?embauche|(?:en vue d'une?|debouchant sur une?|suivi d'une?)\s+(?:embauche|cdi|recrutement)[^.\n]*/g, ' ');
  if (PFE.test(L2) || /مشروع (?:نهاية|التخرج)/.test(core)) return 'pfe';
  const hire = [...L2.matchAll(HIRE)].some(m => !STAGE.test(L2.slice(m.index, m.index + m[0].length + 25)));
  if (STRONG.test(L2) || hire || /\bV\.?I\.?E\b/.test(core)) return 'emploi';
  if (STAGE.test(L2) || /تدريب|تربص|متدرب/.test(core)) return 'stage';
  if (WEAK.test(L2) || /وظيفة|توظيف|منصب|فرصة عمل/.test(core)) return 'emploi';
  return null;
}

const NUM = { un: 1, une: 1, one: 1, deux: 2, two: 2, trois: 3, three: 3, quatre: 4, four: 4, cinq: 5, five: 5, six: 6, huit: 8, eight: 8, dix: 10, ten: 10, douze: 12, twelve: 12 };
const NW = `\\d{1,2}|${Object.keys(NUM).join('|')}`;
const DUR = new RegExp(`\\b(${NW})(?:\\s*(?:a|-|–|to|ou|or)\\s*(${NW}))?\\s*(mois|months?|semaines?|weeks?|ans?|years?)\\b(?!\\s*(?:d'|de |of )?\\s*exp)`, 'g');
const num = s => NUM[s] || +s;

function dureeOf(L, core) {
  for (const m of L.matchAll(DUR)) {
    const a = num(m[1]), b = m[2] ? num(m[2]) : 0, n = b || a, u = m[3];
    if (!a || (/^(?:an|year)/.test(u) && n > 3) || /exp/.test(L.slice(Math.max(0, m.index - 25), m.index))) continue;
    const unit = /^(?:mois|month)/.test(u) ? 'mois' : /^(?:sem|week)/.test(u) ? (n > 1 ? 'semaines' : 'semaine') : n > 1 ? 'ans' : 'an';
    return b ? `${a} à ${b} ${unit}` : `${a} ${unit}`;
  }
  const ar = /(\d{1,2})\s*(?:أشهر|اشهر|شهور|شهر)/.exec(core);
  return ar ? `${ar[1]} mois` : '';
}

const ANNEE = [
  [3, /\b3a\b|\b3\s?(?:e|eme|ieme|rd)[\s-]+(?:annee|year)|troisieme annee|third[- ]year/],
  [4, /\b4a\b|\b4\s?(?:e|eme|ieme|th)[\s-]+(?:annee|year)|quatrieme annee|fourth[- ]year/],
  [5, /\b5a\b|\b5\s?(?:e|eme|ieme|th)[\s-]+(?:annee|year)|cinquieme annee|derniere annee|fifth[- ]year|final[- ]year/],
  [6, /jeunes? diplomes?|nouveaux? diplomes?|fraichement diplome|young graduates?|fresh graduates?|recent graduates?|new grads?|jeunes? laureats?/],
];

function anneesOf(type, L, duree) {
  const ex = ANNEE.filter(([, re]) => re.test(L)).map(([n]) => n);
  if (ex.length) return { annees: ex, sure: true };
  if (type === 'stage' && (/stage (?:ouvrier|d'?\s?initiation|d'?\s?observation)/.test(L) || duree === '1 mois')) return { annees: [3], sure: true };
  if (type === 'stage' && /stage technique|ingenieure? adjointe?/.test(L)) return { annees: [4], sure: true };
  return { annees: { pfe: [5], emploi: [6], etranger: [4, 5] }[type] || [3, 4], sure: false };
}

// ---------------------------------------------------------------------------
// Entreprise : « Entreprise : X », « chez X », « X recrute », « at X », « @X », « rejoindre X »
// ---------------------------------------------------------------------------
const W = String.raw`(?:[\p{L}\p{N}&’'\-]|\.(?=[\p{L}\p{N}]))*`; // un mot, sans point final
const NAME = String.raw`\p{Lu}${W}(?:[ \t]+(?:(?:de|du|des|of|&|et)[ \t]+)?[\p{Lu}\p{N}]${W}){0,4}`;
const ENT = [
  String.raw`(?:^|\n)[\s\p{P}\p{S}]*(?:[Ee]ntreprise|[Ss]oci[ée]t[ée]|[Cc]ompany|[Ee]mployeur|[Ee]mployer|[Oo]rganisme)\s*:\s*([^\n,;|–()]+)`,
  String.raw`(?:\bchez|شركة|لدى)\s+(${NAME})`,
  String.raw`(${NAME})\s+(?:recrute|recrutent|is hiring|are hiring|hires|is looking|recherche|cherche)\b`,
  String.raw`\bat\s+(${NAME})`,
  String.raw`au sein (?:de l['’]|de la |du |de |d['’])(${NAME})`,
  String.raw`(?:^|[\s(])@(${NAME})`,
  String.raw`\b(?:[Rr]ejoindre|[Rr]ejoignez|[Rr]ejoins|[Jj]oin|[Jj]oining)\s+(?:l['’]équipe\s+(?:de\s+)?|the team (?:at|of)\s+|us at\s+)?(${NAME})`,
].map(s => new RegExp(s, 'u'));
const BAD_ENT = /^(?:nous|we|our|notre|nos|je|i|my|mon|ma|on|the|la|le|les|un|une|des|ensam|linkedin|hello|bonjour|team|this|cette|ce|il|elle|they|ils|stage|pfe|cdi|cdd|vie|offre|urgent|hiring|opportunit\S*|poste|job|whatsapp|intern|internship)$/i;

function entrepriseOf(core) {
  for (const re of ENT) {
    const m = re.exec(core); if (!m) continue;
    let w = m[1].replace(/[\s.,;:!?'’\-–—]+$/, '').trim().split(/\s+/);
    while (w.length && /^(?:urgent|new|nouveau|hiring|offre|job|stage|pfe|cdi|cdd|vie)$/i.test(w[0])) w.shift();
    for (let again = true; again && w.length > 1;) {
      again = false;
      for (let k = Math.min(3, w.length - 1); k >= 1; k--) if (lookupVille(w.slice(-k).join(' '))) { w = w.slice(0, -k); again = true; break; }
    }
    const r = w.join(' ');
    if (r && r.length <= 60 && !BAD_ENT.test(r) && !BAD_ENT.test(w[0]) && !lookupVille(r) && !paysOf(r)) return r;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Titre : la ligne courte la plus parlante (« Ingénieur(e) méthodes – CDI »), sans emojis ni hashtags
// ---------------------------------------------------------------------------
const ROLE = /\b(?:ingenieure?s?|engineers?|stages?|stagiaires?|interns?|internships?|pfe|cdi|cdd|vie|alternance|alternant|postes?|position|chef|responsable|developpeur|developer|analyste|analyst|technicien|consultant|manager|charge|projet|project|data|methodes|qualite|maintenance|designer|architecte|scientist|trainee)\b|تدريب|وظيفة/;
const FIELD = /^(?:profil|missions?|lieu|localisation|location|duree|duration|date|deadline|contact|e-?mail|tel|telephone|lien|link|postuler|postulez|apply|envoye\w*|candidature\w*|remuneration|salaire|competences|requirements|qualifications|responsabilites|description|avantages|entreprise|societe|company|ville|pays|niveau|debut|start|contrat|type de contrat|n'hesitez|merci|pour postuler)\b/;
const HYPE = /\b(?:we'?re hiring|we are hiring|hiring|opportunite|opportunity|offre|job alert|urgent|bonjour|hello|salam|hi|dear|chers?|bonne nouvelle|great news|exciting|join us|rejoignez[- ]nous|nous recrutons|on recrute|je recrute|partagez|share|a tous|everyone|all|nouvelle|new|alert|alerte)\b/g;
const GREET = /^(?:bonjour|bonsoir|hello|salam|hi|hey|dear|chers?|cher)\b/;
const LABEL = /^(?:poste|intitul[ée]|titre|job title|position|r[ôo]le|sujet|subject|objet)\s*:\s*/i;

function cleanLine(s) {
  return s.replace(URL_RE, ' ').replace(new RegExp(EMAIL, 'g'), ' ').replace(new RegExp(PHONE, 'g'), ' ').replace(EMOJI, ' ')
    .replace(/(?:\s*#[\p{L}\p{N}_]+)+\s*$/u, '').replace(/#(?=[\p{L}\p{N}])/gu, '')
    .replace(/\((?:h\/f|f\/h|m\/f|f\/m|m\/w|w\/m)\)|\b(?:h\/f|f\/h)\b/gi, ' ').replace(/\s+/g, ' ')
    .replace(/^[\s\-–—•*>|:·.,!]+/, '').replace(/^(?:we['’]?re hiring|we are hiring|hiring|nous recrutons|on recrute|je recrute|nouvelle opportunit[ée]|opportunit[ée]|opportunity|offre|urgent|job alert|alerte)\s*[:!\-–—|]+\s*/i, '')
    .replace(/[.,;\-–—]?\s*(?:deadline|date limite|lien|link|apply|postuler)\s*:.*$/i, '').replace(/[,\-–—]?\s*(?:contact|e-?mail|t[ée]l(?:[ée]phone)?|whatsapp)\s*:?\s*$/i, '').replace(/[\s:;,\-–—|•!]+$/, '').replace(/(?<![.\s])\.$/, '').trim();
}
const meaningful = l => l.replace(HYPE, '').replace(/[^\p{L}\p{N}]+/gu, '').length >= 6;
const short = s => (s.length <= 140 ? s : s.slice(0, 139).replace(/\s+\S*$/, '') + '…');

function titreOf(core) {
  let best = '', bs = 3;
  // Chaque ligne, et chaque phrase d'une longue ligne (« … recrute ! Stage PFE : sujet, 6 mois. »)
  const cands = core.split('\n').filter(l => l.trim()).slice(0, 15).flatMap((l, i) => {
    const ph = l.split(/(?<=[.!?])\s+(?=\P{Ll})/u).filter(x => x.trim());
    return ph.length > 1 ? [[l, i], ...ph.map(x => [x, i])] : [[l, i]];
  });
  cands.forEach(([raw, idx]) => {
    let c = cleanLine(raw), s = -idx * 0.3;
    if (c.length < 4) return;
    if (LABEL.test(c)) { c = c.replace(LABEL, ''); s += 6; }
    const m = /(?:recherch\w*|cherch\w*|looking for|recrut\w*|seeking|hiring)\s+(?:un\(e\)|une?|des|an?|deux|\d+)\s+(.{6,100}?)(?=\s+(?:pour|afin|au sein|dans|qui|to|for|who|with|avec|chez|à|at|in)\s|[.,;!]|$)/i.exec(c);
    if (m && ROLE.test(low(m[1]))) c = m[1][0].toUpperCase() + m[1].slice(1);
    const l = low(c);
    if ((s < 6 && FIELD.test(l)) || !meaningful(l)) return;
    if (ROLE.test(l)) s += 4;
    if (GREET.test(l)) s -= 4;
    if (/^(?:opportunite|opportunity|offre|nouvelle|new|urgent)\b/.test(l)) s -= 2;
    if (/\s[:–—-]\s/.test(c)) s += 1;
    s += c.length <= 90 ? 2 : c.length > 140 ? -2 : 0;
    if (s > bs) { bs = s; best = c; }
  });
  return short(best);
}
// À défaut : « <Type> : <premier groupe nominal> »
function titreDefaut(core, type, ent) {
  const first = core.split('\n').map(cleanLine).find(c => c.length >= 4 && !FIELD.test(low(c)) && !GREET.test(low(c)) && meaningful(low(c)));
  const phrase = first?.split(/[.!?;,(:]/)[0].trim().split(/\s+/).slice(0, 8).join(' ');
  const label = TYPES[type].label;
  return short(phrase && phrase.length >= 4 ? `${label} : ${phrase}` : ent ? `${label} chez ${ent}` : '');
}

// ---------------------------------------------------------------------------
// Filières (même ordre que FILIERES), seulement sur un signal clair
// ---------------------------------------------------------------------------
const FIL = [
  [/genie mecanique|mechanical|\bmecaniques?\b|conception mecanique|\bcao\b|catia|solidworks|usinage/],
  [/genie industriel|ingenieure? industriel|industrial engineer|supply[- ]chain|\blean\b|six sigma|amelioration continue|continuous improvement|logistique|logistics|(?:assurance|controle|ingenieure?|responsable|service|management|systeme|engineer|manager|pole|departement)\s+(?:de la |de |en |d')?(?:qualite|quality)\b|quality (?:engineer|assurance|control|manager)|\bqhse\b/],
  [/electromecani|electromechani|\belectriques?\b|electrical|automatism|automation|\bautomates?\b|\bplc\b|maintenance|instrumentation|electrotechni/],
  [/genie civil|civil engineer|\bbtp\b|beton arme|calcul (?:de |des )?structures?|ingenieure? structures?|structures? (?:metalliques?|en beton|beton)|ouvrages? d'art|batiment|travaux publics|geotechni|\bvrd\b/],
  [/energetique|energies? renouvelables?|renewable|thermique|thermal|solaire|\bsolar\b|photovolta|eolien|wind (?:energy|power|farm)|\bhvac\b|\bcvc\b|hydrogene|hydrogen|(?:ingenieure?|engineer|secteur|domaine|stage|pfe|transition|efficacite|audit)\s+(?:en\s+|de l'|d')?(?:energie|energy)\b/],
  [/informatique|informaticien|intelligence artificielle|artificial intelligence|machine learning|deep learning|data (?:scien|engineer|analy)|big data|\bsoftware\b|genie logiciel|developpement logiciel|ingenieure? logiciel|developpeur|developer|developpement (?:web|mobile|informatique)|full[- ]?stack|back[- ]?end|front[- ]?end|devops|cyber|computer vision|vision par ordinateur|\bllms?\b|\bnlp\b/, /\b(?:AI|IA)\b/],
  [/mecatroni|mechatroni|robotique|robotics|\brobots?\b|embarque|embedded|electronique|electronics|\biot\b|microcontr|fpga/],
];

// ---------------------------------------------------------------------------
// Date limite : « Date limite : 30/11 », « avant le 15 novembre », « deadline: Nov 30th »
// ---------------------------------------------------------------------------
const MOIS = { janvier: 1, janv: 1, january: 1, jan: 1, fevrier: 2, fevr: 2, fev: 2, february: 2, feb: 2, mars: 3, march: 3, mar: 3, avril: 4, avr: 4, april: 4, apr: 4, mai: 5, may: 5, juin: 6, june: 6, jun: 6, juillet: 7, juil: 7, july: 7, jul: 7, aout: 8, august: 8, aug: 8, septembre: 9, september: 9, sept: 9, sep: 9, octobre: 10, october: 10, oct: 10, novembre: 11, november: 11, nov: 11, decembre: 12, december: 12, dec: 12 };
const MO = Object.keys(MOIS).join('|');
const DATES = [
  [/\b(20\d\d)-(\d{1,2})-(\d{1,2})\b/, m => [+m[3], +m[2], +m[1]]],
  [/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}|\d{2}))?\b/, m => [+m[1], +m[2], +m[3] || 0]],
  [new RegExp(`\\b(\\d{1,2})(?:er|st|nd|rd|th)?\\s+(${MO})\\b\\.?(?:\\s+(\\d{4}))?`), m => [+m[1], MOIS[m[2]], +m[3] || 0]],
  [new RegExp(`\\b(${MO})\\b\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`), m => [+m[2], MOIS[m[1]], +m[3] || 0]],
];
const DL_CUE = /date limite|deadline|avant le|avant|jusqu'?\s?(?:au|a|le)|au plus tard|d'ici (?:le|au)|apply (?:by|before)|applications? (?:close|due)|closing date|due date|limite de (?:depot|candidature)|before|until|آخر أجل|قبل/g;

function parseDate(s, now) {
  const c = DATES.map(([re, f]) => { const m = re.exec(s); return m && [m.index, ...f(m)]; }).filter(Boolean).sort((a, b) => a[0] - b[0]);
  for (let [, d, mo, y] of c) {
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]; // format américain 11/30
    if (y && y < 100) y += 2000;
    if (!y) {
      y = now.getFullYear();
      if (mo * 100 + d < (now.getMonth() + 1) * 100 + now.getDate()) y++; // prochaine occurrence
    }
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (mo >= 1 && mo <= 12 && d >= 1 && dt.getUTCMonth() === mo - 1) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  return '';
}

function deadlineOf(L, now) {
  for (const m of L.matchAll(DL_CUE)) {
    const d = parseDate(L.slice(m.index + m[0].length, m.index + m[0].length + 50).split('\n')[0], now);
    if (d) return d;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Lien, contact, rémunération, cooptation
// ---------------------------------------------------------------------------
function lienOf(core) {
  const urls = (core.match(URL_RE) || []).map(u => u.replace(/[.,;:!?)\]}>»'"]+$/, '')).map(u => (/^www\./i.test(u) ? 'https://' + u : u));
  const score = u => (/linkedin\.com\/(?:feed|in\/|posts?\/|search|company\/[^/?#]+\/?(?:[?#]|$))|\/hashtag\//i.test(u) ? 0 : 2) + (/^https:/i.test(u) ? 1 : 0);
  return urls.reduce((b, u) => (!b || score(u) > score(b) ? u : b), '');
}
const contactOf = core => (new RegExp(EMAIL).exec(core) || new RegExp(PHONE).exec(core))?.[0].trim() || '';
const NON_REM = /\bnon[- ]?(?:remunere|paye|gratifie)|\bunpaid\b|sans (?:remuneration|gratification)/;
const REM = /remuner|gratifi|\bpaid\b|indemnit|salaire|salary|stipend|\d\s*(?:dh|dhs|mad|eur|euros)\b|€|package attractif/;
const COOPT = /coopt|referral|\brefer (?:you|candidates|profiles)|(?:can|happy to|will|i'll) refer|recommand\w* (?:en )?interne|je (?:peux|pourrai|pourrais) (?:vous |te )?(?:recommander|appuyer|pousser|transmettre|referer)|je (?:vous |te )?(?:recommanderai|transmettrai|ferai suivre|pousserai)|send me (?:your )?(?:cv|resume)|(?:dm|inbox|mp) me (?:your )?(?:cv|resume)|envoye[rz][- ]moi (?:votre|vos|ton|tes) cv|envoie[- ]moi (?:ton|tes|votre) cv|(?:cv|resume) (?:en|par) (?:mp|dm|message prive)/;

// ---------------------------------------------------------------------------
// parseOffre(text, me, now) → { fields, found }
// ---------------------------------------------------------------------------
export function parseOffre(text, me = {}, now = new Date()) {
  try {
    const d = now instanceof Date && !isNaN(now) ? now : new Date();
    return parse(String(text ?? ''), me || {}, d);
  } catch {
    return { fields: {}, found: [] };
  }
}

function parse(text, me, now) {
  const core = clean(text.slice(0, 20000)); // un collage géant ne bloque pas l'interface
  if (!core) return { fields: {}, found: [] };
  const L = low(core), f = {}, found = new Set();
  const set = (k, v, sure = true) => { if (v === '' || v == null) return; f[k] = v; if (sure) found.add(k); };

  const place = findPlace(core), pays = place?.pays || 'Maroc';
  const t = typeOf(L, core);
  const type = t === 'stage' && pays !== 'Maroc' ? 'etranger' : t || 'stage';
  set('type', type, !!t);

  const ent = entrepriseOf(core);
  set('entreprise', ent || me.entreprise || '', !!ent);
  set('titre', titreOf(core));
  if (!f.titre) set('titre', titreDefaut(core, type, ent), true);
  set('ville', place?.ville || (pays === 'Maroc' ? me.ville || '' : ''), !!place?.ville);
  set('pays', pays, !!place);

  const contrat = [[/\bCDI\b/i, 'CDI'], [/\bCDD\b/i, 'CDD'], [/\bV\.?I\.?E\b/, 'VIE']].map(([re, k]) => [core.search(re), k]).filter(x => x[0] >= 0).sort((a, b) => a[0] - b[0])[0]?.[1];
  const dur = dureeOf(L, core);
  set('duree', type === 'emploi' && contrat ? (contrat === 'CDI' ? 'CDI' : `${contrat}${dur ? ' ' + dur : ''}`) : dur);
  set('deadline', deadlineOf(L, now));
  set('lien', lienOf(core));
  set('contact', contactOf(core));

  const Lf = L.replace(/(?:outils?|connaissances?|maitrise)\s+(?:de\s+l'outil\s+|des\s+outils\s+)?informatiques?/g, ' ');
  const filieres = FIL.map(([re, cs], i) => (re.test(Lf) || cs?.test(core) ? FILIERES[i] : null)).filter(Boolean);
  if (filieres.length) set('filieres', filieres);
  const { annees, sure } = anneesOf(type, L, f.duree);
  set('annees', annees, sure || !!t);

  if (NON_REM.test(L) || /غير مدفوع/.test(core)) set('remunere', false);
  else if (REM.test(L) || /مدفوع|براتب|منحة/.test(core)) set('remunere', true);
  if (COOPT.test(L)) set('cooptation', true);
  set('description', core.slice(0, 4000));

  return { fields: f, found: KEYS.filter(k => found.has(k)) };
}
