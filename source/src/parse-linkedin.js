// « Profil en une minute » : le membre colle le texte de son profil LinkedIn (PDF « Enregistrer au format PDF »,
// copie de la page, ou simplement sa section Infos), ou dépose son CV, et le formulaire de profil se remplit.
// LinkedIn n'ouvre pas l'import direct aux petits sites. Pur JS, sans DOM ; ne lève jamais d'exception.
import { FILIERES, estAncienneFiliere, seasonOf } from './logic.js';
import { lookupVille, paysOf } from './geo.js';

const low = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’‘`´]/g, "'").trim();

// Titres de rubriques, en français et en anglais (PDF et page web)
const RUBRIQUES = {
  contact: ['contact', 'coordonnees', 'contact info', 'coordonnees de contact', 'informations personnelles', 'infos personnelles', 'contacts'],
  competences: ['top skills', 'principales competences', 'competences', 'skills', 'competences techniques', 'competences informatiques', 'competences cles',
    'logiciels', 'outils', 'outils informatiques', 'logiciels et outils', 'technical skills', 'hard skills', 'tools', 'informatique', 'savoir-faire'],
  langues: ['languages', 'langues', 'langues etrangeres'],
  resume: ['summary', 'resume', 'infos', 'about', 'a propos', 'info', 'profil', 'profil personnel', 'objectif', 'a propos de moi', 'presentation', 'profile', 'objective'],
  experience: ['experience', 'experiences', 'experience professionnelle', 'experiences professionnelles', 'parcours professionnel', 'stages', 'stages et experiences',
    'experiences et stages', 'stages effectues', 'work experience', 'professional experience', 'internships'],
  formation: ['education', 'formation', 'formations', 'formation academique', 'formations academiques', 'parcours academique', 'parcours scolaire', 'cursus',
    'cursus academique', 'cursus universitaire', 'diplomes', 'diplomes et formations', 'etudes', 'academic background'],
  autre: ['certifications', 'licences et certifications', 'licenses & certifications', 'licences & certifications', 'honors-awards', 'honors & awards', 'distinctions', 'prix et distinctions',
    'publications', 'projets', 'projects', 'benevolat', 'volunteering', 'volunteer experience', 'experience de benevolat', 'recommandations', 'recommendations',
    'centres d\'interet', 'interests', 'activite', 'activity', 'cours', 'courses', 'organisations', 'organizations', 'brevets', 'patents', 'tests et examens', 'test scores',
    'services', 'mis en avant', 'featured', 'ressources', 'resources', 'analyses', 'analytics', 'personnes que vous pourriez connaitre', 'people also viewed', 'autres profils consultes',
    'loisirs', 'activites parascolaires', 'activites extra-scolaires', 'vie associative', 'activites associatives', 'hobbies', 'projets academiques', 'certificats', 'qualites', 'soft skills', 'references'],
};
const RUB = new Map(Object.entries(RUBRIQUES).flatMap(([k, l]) => l.map(x => [x, k])));
const rubrique = l => RUB.get(low(l).replace(/\s*[:：]$/, '')) || null;

const TYPES_CONTRAT = /^(?:temps plein|temps partiel|full[- ]time|part[- ]time|stage|internship|cdi|cdd|freelance|independant|self[- ]employed|alternance|apprentissage|apprenticeship|contrat|contract|saisonnier|seasonal|interim|benevole|volunteer|pfe)$/;
const DUREE = /^(?:(?:\d+\s*(?:ans?|annees?|yrs?|years?|mois|mos?|months?)\s*)+|moins d'un an|less than a year)$/;
const MOIS = '(?:janv?|fevr?|mars|avr|mai|juin|juil|aout|sept?|oct|nov|dec|jan|feb|mar|apr|may|jun|jul|aug|sep)[a-z]*\\.?';
const DATES = new RegExp(`(?:${MOIS}\\s+)?(?:19|20)\\d{2}\\s*[-–—]\\s*(?:(?:${MOIS}\\s+)?(?:19|20)\\d{2}|aujourd'hui|present|actuel|maintenant|now)`);
const estDates = l => DATES.test(low(l));
const BRUIT = /^(?:afficher|voir|show|see|approuve|endorsed|\d+\s*(?:recommandations?|endorsements?|approbations?)|.*\b(?:competences?|skills?)\s*$|…|\.\.\.|page \d+|(?:plus|more)$|se connecter|sign in|rejoindre|join now|message|suivre|follow|contacter)/;

const ENSAM = /\bensam\b|arts\s*(?:et|&|and)\s*m[eé]tiers|national school of arts and crafts|المدرسة الوطنية العليا للفنون/i;
// Filières : d'abord les intitulés précis de la maquette actuelle, puis les anciennes appellations (promos précédentes)
const FIL_RE = [
  ['Génie Industriel : Excellence Opérationnelle', /excellence op[eé]rationnelle|operational excellence|\bGIEO\b/i],
  ['Génie Industriel et Productique', /industriel(?:le)? et productique|\bGIP24\b/i],
  ['Génie Électromécanique : Digitalisation Industrielle', /digitali[sz]ation industrielle|\bGE-?DI\b/i],
  ['Génie Électromécanique : Maintenance et Commande Industrielles', /maintenance et commande|\bGE-?MCI\b/i],
  ['Génie Mécanique : Conception et Industrialisation des Systèmes Mécaniques', /conception et industrialisation|\bGM-?CISM\b/i],
  ['Génie Mécanique : Ingénierie Mécanique et Structures', /ing[eé]nierie m[eé]canique et structures|\bGM-?IMS\b/i],
  ['Génie Mécanique : Matériaux et Procédés de Fabrication', /mat[eé]riaux et proc[eé]d[eé]s|\bGM-?MPF\b/i],
  ['Génie Mécanique : Énergétique', /g[eé]nie m[eé]canique\s*[:,-]\s*[eé]nerg[eé]tique|\bGME24\b/i],
  ['Intelligence Artificielle et Technologies des Données : Systèmes Industriels', /technologies des donn[eé]es|\bIATD(?:-SI)?\b/i],
  ['Génie Informatique : Ingénierie Logicielle et Systèmes Intelligents', /ing[eé]nierie logicielle|\bGI-?ILSI\b/i],
  ['Génie Électromécanique', /[eé]lectro\s*-?\s*m[eé]canique|electromechanical/i],
  ['Mécatronique', /m[eé]catronique|mechatronic/i],
  ['Génie Informatique & IA', /[Ii]nformatique|[Ii]ntelligence [Aa]rtificielle|[Cc]omputer|[Ss]oftware|[Dd]ata [Ss]cience|\bIA\b|\bAI\b/],
  ['Génie Énergétique', /[eé]nerg[eé]tique|\benergy\b|[eé]nergies?\b/i],
  ['Génie Civil', /\bcivil/i],
  ['Génie Industriel', /industriel|industrial/i],
  ['Génie Mécanique', /m[eé]canique|mechanical/i],
].filter(([f]) => FILIERES.includes(f) || estAncienneFiliere(f));
const METIER = /\b(?:ing[eé]nieur|engineer|manager|chef|directeur|director|consultant|responsable|d[eé]veloppeur|developer|head|ceo|cto|coo|founder|fondateur|stagiaire|intern|analyst|analyste|technicien|technician|[eé]tudiant|student|[eé]l[eè]ve|lead|officer|specialist|sp[eé]cialiste|charg[eé]|professeur|teacher|doctorant|phd)\b/i;

const PAS_NOM = /linkedin|premium|notifications|messagerie|emplois|accueil|r[eé]seau|relations|abonn[eé]s|followers|connections|contenu|recherche|search|jobs|messaging|home/i;
// Une ligne qui ressemble à un nom : 2 à 5 mots, lettres seulement, chacun avec une majuscule (sauf particules)
function estNom(l) {
  if (l.length > 50 || /[\d@/|:•·,()]/.test(l) || METIER.test(l) || PAS_NOM.test(l) || rubrique(l)) return false;
  const m = l.split(/\s+/);
  if (m.length < 2 || m.length > 5) return false;
  return m.every(w => /^\p{Lu}/u.test(w) || /^(?:de|du|des|el|al|ben|bin|ibn|la|le|d'|ait|ou|van|von)$/i.test(w)) && !lieu(l);
}

// « Casablanca, Casablanca-Settat, Maroc », « Région de Paris, France », « Morocco »
function lieu(l) {
  l = (l || '').split(/\s+·\s+/)[0];
  if (!l || l.length > 80 || /\d|@|https?:/.test(l)) return null;
  const parts = l.split(/\s*,\s*/).filter(Boolean);
  if (!parts.length || parts.length > 4) return null;
  const pays = paysOf(parts.at(-1));
  const v = lookupVille(parts[0]);
  if (v && (!pays || pays === v.pays)) return { ville: v.ville, pays: v.pays };
  if (pays && (parts.length > 1 || parts[0].split(/\s+/).length <= 3)) return { ville: parts.length > 1 && parts.length < 4 && !/r[eé]gion|province|-/i.test(parts[0]) ? parts[0] : null, pays };
  return null;
}

// Titre du profil : « Ingénieur méthodes chez Renault Group | Lean » → poste et entreprise
function titre(h) {
  const t = h.split(/\s+[|•]\s+|\s+\|\s*/)[0].trim();
  const m = t.match(/^(.+?)\s+(?:chez|at|au sein de|auprès de)\s+(.+)$/i) || t.match(/^(.+?)\s*@\s*(.+)$/);
  if (m && !ENSAM.test(m[2]) && !/^(?:l'|la |le )?(?:ensam|[eé]cole|universit)/i.test(m[2])) return { poste: m[1].trim(), entreprise: m[2].split(/\s*[,;!]\s*|\.\s|\s+(?:et|and|depuis|since)\s+/)[0].replace(/\.$/, '').trim() };
  return { poste: t };
}

// Première expérience : formats PDF (entreprise, poste, dates) et page web (poste, « Entreprise · Temps plein », dates)
function experience(L) {
  const a = L[0], b = L[1] || '', c = L[2] || '';
  const [b1, b2] = b.split(/\s+·\s+/);
  if (b2 !== undefined && TYPES_CONTRAT.test(low(b2))) return { poste: a, entreprise: b1, actuel: /aujourd|present|actuel/.test(low(c)) };
  if (TYPES_CONTRAT.test(low(b.split(/\s+·\s+/)[0])) || DUREE.test(low(b))) return { entreprise: a, poste: c, actuel: /aujourd|present|actuel/.test(low(L[3] || '')) };
  // PDF : entreprise puis poste ; page web sans type de contrat : poste puis entreprise
  if (estDates(c)) return METIER.test(a) && !METIER.test(b) ? { poste: a, entreprise: b, actuel: /aujourd|present|actuel/.test(low(c)) } : { entreprise: a, poste: b, actuel: /aujourd|present|actuel/.test(low(c)) };
  if (estDates(b)) return { poste: a, actuel: /aujourd|present|actuel/.test(low(b)) };
  return null;
}

// Formation à l'ENSAM : année de fin (= promo), filière, et si elle est encore en cours (étudiant)
const EN_COURS = /aujourd'hui|present|actuel|en cours|maintenant|\bnow\b|a ce jour|depuis|[eé]l[eè]ve[- ]ing[eé]nieur|[eé]tudiant/;
const AUTRE_ECOLE = /[eé]cole|universit|lyc[eé]e|institut|school|college|faculty|facult[eé]|cpge|classes pr[eé]pa/i;
// Une ligne qui ne porte que des dates (« 2019 – 2024 », « Depuis 2023 », « 2024 – Présent »)
const DATES_SEULES = /^\D{0,12}(?:19|20)\d{2}(?:\s*[-–—/àa]+\s*(?:(?:19|20)\d{2}|\D{2,20}))?\s*$/;
// Année d'études écrite en toutes lettres : « 5e année », « 4ème année », « 3A », « 4th year »
const NIVEAU_RE = /\b([1-5])\s*(?:[eè]me|eme|[eè]re|ere|e)\s*ann[eé]e\b|\b([1-5])A\b|\b([1-5])(?:st|nd|rd|th) year\b/i;
const niveauDe = t => { const m = String(t || '').match(NIVEAU_RE); return m ? +(m[1] || m[2] || m[3]) : 0; };

function formation(L) {
  let best = null;
  for (let i = 0; i < L.length; i++) {
    if (!ENSAM.test(L[i])) continue;
    const bloc = [L[i]];
    // Beaucoup de CV mettent les dates juste avant l'école (« 2019 – 2024 », puis « ENSAM Meknès »)
    const avant = i > 0 && DATES_SEULES.test(L[i - 1]) ? L[i - 1] : '';
    // Les lignes suivantes, jusqu'à l'école suivante ou aux dates de l'entrée suivante (sauf si l'école n'a pas encore ses dates)
    for (let j = i + 1; j < Math.min(L.length, i + 4) && !ENSAM.test(L[j]) && !AUTRE_ECOLE.test(L[j]) && !(avant && DATES_SEULES.test(L[j])); j++) bloc.push(L[j]);
    const txt = [avant, ...bloc].join(' ');
    const ans = [...txt.matchAll(/\b(19[89]\d|20[0-4]\d)\b/g)].map(m => +m[1]);
    const fil = FIL_RE.find(([, re]) => re.test(bloc.slice(1).join(' ')) || re.test(L[i].replace(ENSAM, '')))?.[0];
    const r = { promo: ans.length ? Math.max(...ans) : null, debut: ans.length ? Math.min(...ans) : null, filiere: fil || null, meknes: /mekn[eè]s|meknes/i.test(txt),
      enCours: EN_COURS.test(low(txt)), niveau: niveauDe(bloc.join(' ')), cycle: /cycle (?:d'|des |de l')?ing[eé]nieur|admission parall[eè]le|3e ann[eé]e|3[eè]me ann[eé]e/i.test(txt) };
    // Meknès d'abord, puis la formation en cours, puis la plus récente (le cycle ingénieur passe avant les classes prépa)
    const score = x => (x.meknes ? 4 : 0) + (x.enCours ? 2 : 0) + (x.promo || 0) / 1e4;
    if (!best || score(r) > score(best)) best = r;
  }
  return best;
}

function competencesDe(L) {
  const out = [];
  for (const l of L) for (const x of l.split(/\s+[•·]\s+|\s*;\s*/)) {
    const s = x.replace(/^[-–•·*\s]+/, '').trim();
    if (s.length < 2 || s.length > 40 || s.split(/\s+/).length > 5 || /^\d+$/.test(s) || BRUIT.test(low(s)) || rubrique(s) || METIER.test(s) || /\s(?:chez|at)\s/i.test(s)) continue;
    out.push(s);
  }
  return out;
}

const couper = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');

export function parseLinkedin(text, now = new Date()) {
  const r = {};
  try {
    const brut = String(text || '').replace(/\r\n?/g, '\n').replace(/ /g, ' ');
    // Lignes utiles ; la page web répète souvent chaque ligne deux fois (texte pour lecteurs d'écran)
    const lignes = [];
    for (let l of brut.split('\n')) {
      l = l.replace(/\s+/g, ' ').trim();
      if (!l || /^page \d+ (?:of|sur|de) \d+$/i.test(l) || l === lignes.at(-1)) continue;
      lignes.push(l);
    }
    if (!lignes.length) return r;

    const url = brut.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([\p{L}\p{N}_%-]+)/iu);
    if (url) r.linkedin = `https://www.linkedin.com/in/${url[1]}`;
    const mail = brut.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
    if (mail && !/linkedin|example/i.test(mail[0])) r.email = mail[0].toLowerCase();
    const tel = brut.match(/(?:\+|00)\s*212[\s.-]*\(?0?\)?[\s.-]*[5-7](?:[\s.-]*\d){8}|\b0[5-7](?:[\s.-]*\d){8}\b|(?:\+|00)\s*33[\s.-]*\(?0?\)?[\s.-]*[1-9](?:[\s.-]*\d){8}/);
    if (tel) r.telephone = tel[0].replace(/\s+/g, ' ').trim();

    // Découpage en rubriques
    const sec = {}; let cur = 'tete'; const tete = [];
    for (const l of lignes) {
      const k = rubrique(l);
      if (k) { cur = k; sec[k] ||= []; continue; }
      (cur === 'tete' ? tete : (sec[cur] ||= [])).push(l);
    }
    const aucune = !Object.keys(sec).length;

    // En-tête : nom, titre, lieu. Dans le PDF, ils viennent juste avant « Résumé » / « Expérience »,
    // après la colonne de gauche (Coordonnées, Compétences, Langues…) : on les cherche au bout du bloc.
    const blocs = [tete, ...['contact', 'competences', 'langues', 'autre'].map(k => sec[k] || [])];
    let entete = null;
    for (const b of blocs) {
      for (let i = b.length - 1; i >= 2 && !entete; i--) {
        if (!lieu(b[i])) continue;
        // Le titre tient sur une à trois lignes entre le nom et le lieu
        const n = [i - 2, i - 3, i - 4].find(k => k >= 0 && estNom(b[k]));
        if (n !== undefined) entete = { nom: b[n], titre: b.slice(n + 1, i).join(' '), lieu: lieu(b[i]), bloc: b, n, fin: i };
      }
      if (entete) break;
    }
    if (!entete) {
      // Page web ou texte libre : le nom en haut (après le menu du site), puis le titre et le lieu
      const i = tete.slice(0, 25).findIndex(estNom);
      if (i >= 0) {
        const apres = tete.slice(i + 1, i + 6);
        const j = apres.findIndex(l => lieu(l));
        const t = apres.slice(0, j < 0 ? 2 : j).find(l => l.length > 3 && !/^[(·•]|^\d|^(?:il|elle|he|she|they)\b/i.test(l));
        entete = { nom: tete[i], titre: t || '', lieu: j < 0 ? null : lieu(apres[j]), bloc: tete, n: i, fin: i + 1 + (j < 0 ? (t ? apres.indexOf(t) : -1) : j) };
      }
    }
    // CV : la ville est souvent sur la ligne des coordonnées (« 06 12… | nom@… | Meknès, Maroc »)
    if (!entete?.lieu) for (const l of lignes.slice(0, 15)) { const x = l.split(/\s*[|•·]\s*/).map(lieu).find(Boolean); if (x) { if (entete) entete.lieu = x; else { if (x.ville) r.ville = x.ville; r.pays = x.pays; } break; } }
    if (entete) {
      // « HAJEB Abderrahman » → « Hajeb Abderrahman »
      r.full_name = entete.nom.split(/\s+/).map(w => w.length > 1 && w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w).join(' ');
      if (entete.titre) { r.titre = entete.titre; Object.assign(r, titre(entete.titre)); }
      if (entete.lieu) { if (entete.lieu.ville) r.ville = entete.lieu.ville; r.pays = entete.lieu.pays; }
      // Les compétences du PDF s'arrêtent avant l'en-tête
      if (entete.bloc === sec.competences) sec.competences = sec.competences.slice(0, entete.n);
    }

    // Expérience : remplace le titre du profil, plus précis pour le poste et l'entreprise
    const sansLogo = L => (L || []).filter(l => !/^logo (?:de |d'|of )|\slogo$/i.test(l));
    const ex = sec.experience?.length ? experience(sansLogo(sec.experience)) : null;
    if (ex?.entreprise) { r.entreprise = ex.entreprise.replace(/\s+·.*$/, '').replace(/\s*[,–—-]\s*([^,–—-]+)$/, (m, v) => (lieu(v) ? '' : m)); if (ex.poste) r.poste = ex.poste; r.actuel = !!ex.actuel; }
    else if (ex?.poste && !r.poste) r.poste = ex.poste;

    // Formation à l'ENSAM : promo et filière
    const fo = formation(sansLogo(sec.formation || (aucune ? lignes : []))) || (sec.formation ? formation(lignes) : null);
    if (fo?.promo) r.promo = fo.promo;
    // Formation en cours sans année de fin (« 2023 – présent ») : la promo vient de l'année d'études écrite en tête ou dans le
    // résumé (« élève ingénieur en 4e année »), sinon de l'année d'entrée (une année dans la formation peut être celle de l'admission)
    if (fo?.enCours && !(fo.promo > seasonOf(now))) {
      const S = seasonOf(now), n = niveauDe([...tete.slice(0, 4), ...(sec.resume || [])].join(' ')) || (fo.debut ? 0 : fo.niveau);
      if (n) { r.promo = S + 6 - n; r.promoEstimee = true; }
      else if (fo.debut) { r.promo = Math.max(fo.debut + (fo.cycle ? 3 : 5), S + 1); r.promoEstimee = true; }
    }
    if (fo?.filiere) r.filiere = fo.filiere;
    if (!r.promo) { const m = brut.match(/\b(?:promo(?:tion)?|laur[ée]at(?:e)?|class of|dipl[oô]m[ée]e? en)\s*(19[89]\d|20[0-4]\d)\b/i); if (m) r.promo = +m[1]; }
    if (!r.filiere) { const f = FIL_RE.find(([, re]) => re.test(r.titre || '')); if (f && /g[ée]nie|engineering|ing[ée]nieur/i.test(r.titre)) r.filiere = f[0]; }

    // Compétences : la rubrique, plus les lignes « Compétences : A · B » des expériences
    const comp = competencesDe(sec.competences || []);
    for (const l of lignes) { const m = l.match(/^(?:comp[ée]tences|skills)\s*:\s*(.+)$/i); if (m) comp.push(...competencesDe([m[1]])); }
    const vues = new Set();
    r.competences = comp.filter(c => { const k = low(c); if (vues.has(k)) return false; vues.add(k); return true; }).slice(0, 15);
    if (!r.competences.length) delete r.competences;

    // Résumé → bio (600 caractères au plus)
    let bio = (sec.resume || []).filter(l => !/^(?:…\s*)?(?:voir plus|see more|afficher (?:plus|la suite))$/i.test(l)).join(' ').replace(/\s*…\s*(?:voir plus|see more)$/i, '').trim();
    if (!bio && aucune) bio = (entete ? tete.slice(entete.fin + 1) : lignes).join(' ');
    if (bio) r.bio = couper(bio, 600);
    if (aucune && !entete && !r.poste) { const t = titre(lignes[0]); if (lignes[0].length <= 120 && t.entreprise) Object.assign(r, t); }

    // Étudiant(e) ou lauréat(e) : d'après l'année de diplôme, sinon le titre
    const saison = seasonOf(now);
    if (fo?.enCours && (!r.promo || r.promo > saison)) r.role = 'etudiant';
    else if (r.promo) r.role = r.promo > saison ? 'etudiant' : 'laureat';
    else if (/\b(?:[ée]tudiant|student|[ée]l[eè]ve ing[ée]nieur)/i.test(r.titre || '')) r.role = 'etudiant';
    else if (r.entreprise) r.role = 'laureat';
    // Entreprise et poste ne s'affichent que pour les lauréats (le stage d'un étudiant reste dans sa bio)
    if (r.role === 'etudiant') { delete r.entreprise; delete r.poste; }
  } catch { /* texte inattendu : on garde ce qui a été trouvé */ }
  delete r.titre; delete r.actuel;
  return r;
}
