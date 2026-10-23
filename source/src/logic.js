// Règles métier : saisons, niveaux, objectifs, points d'impact, badges, statistiques.

// Cycle ingénieur : 5 parcours et 11 filières (choix en 3A). Les 1A et 2A sont en classes préparatoires intégrées.
// En 5A, les matières communes se font en deux sections : A (électro-industriel, IA, informatique) et B (mécanique, civil).
export const PARCOURS = [
  { code: 'PEI', nom: 'Électro-industriel', section: 'A' },
  { code: 'PM', nom: 'Mécanique', section: 'B' },
  { code: 'CIVIL', nom: 'Civil', section: 'B' },
  { code: 'IA', nom: 'Intelligence artificielle', section: 'A' },
  { code: 'INFO', nom: 'Informatique', section: 'A' },
];
export const FILIERES_INFO = [
  { code: 'GIP24', nom: 'Génie Industriel et Productique', parcours: 'PEI' },
  { code: 'GIEO', nom: 'Génie Industriel : Excellence Opérationnelle', parcours: 'PEI' },
  { code: 'GE-DI', nom: 'Génie Électromécanique : Digitalisation Industrielle', parcours: 'PEI' },
  { code: 'GE-MCI', nom: 'Génie Électromécanique : Maintenance et Commande Industrielles', parcours: 'PEI' },
  { code: 'GM-CISM', nom: 'Génie Mécanique : Conception et Industrialisation des Systèmes Mécaniques', parcours: 'PM' },
  { code: 'GM-IMS', nom: 'Génie Mécanique : Ingénierie Mécanique et Structures', parcours: 'PM' },
  { code: 'GM-MPF', nom: 'Génie Mécanique : Matériaux et Procédés de Fabrication', parcours: 'PM' },
  { code: 'GME24', nom: 'Génie Mécanique : Énergétique', parcours: 'PM' },
  { code: 'GC24', nom: 'Génie Civil', parcours: 'CIVIL' },
  { code: 'IATD-SI', nom: 'Intelligence Artificielle et Technologies des Données : Systèmes Industriels', parcours: 'IA' },
  { code: 'GI-ILSI', nom: 'Génie Informatique : Ingénierie Logicielle et Systèmes Intelligents', parcours: 'INFO' },
];
export const FILIERES = FILIERES_INFO.map(f => f.nom);
export const PREPA = 'Classes préparatoires intégrées';
// Anciennes appellations : promos précédentes et profils déjà enregistrés. Elles restent valables et sont rapprochées par parcours.
export const ANCIENNES_FILIERES = [
  ['Génie Mécanique', ['PM']], ['Génie Industriel', ['PEI']], ['Génie Électromécanique', ['PEI']], ['Génie Énergétique', ['PM']],
  ['Mécatronique', ['PEI']], ['Génie Informatique & IA', ['INFO', 'IA']],
];
const FIL_PAR_NOM = new Map(FILIERES_INFO.map(f => [f.nom, f]));
const ANCIENNES = new Map(ANCIENNES_FILIERES);
export const filiereInfo = f => FIL_PAR_NOM.get(f) || null;
export const estAncienneFiliere = f => ANCIENNES.has(f);
// Parcours d'une filière (plusieurs pour une ancienne appellation à cheval), [] si inconnue
export const parcoursOf = f => (FIL_PAR_NOM.has(f) ? [FIL_PAR_NOM.get(f).parcours] : ANCIENNES.get(f) || []);
export const parcoursNom = code => PARCOURS.find(p => p.code === code)?.nom || '';
// Libellé court pour les listes et les cartes : le code officiel (GM-CISM…), sinon le nom
export const filiereCourte = f => FIL_PAR_NOM.get(f)?.code || f || '';
// Filières d'une offre en peu de mots : un parcours complet devient « Parcours Mécanique », le reste en codes officiels
export function resumeFilieres(list) {
  const reste = new Set(list || []), out = [];
  for (const p of PARCOURS) {
    const fs = FILIERES_INFO.filter(f => f.parcours === p.code).map(f => f.nom);
    if (fs.length > 1 && fs.every(f => reste.has(f))) { out.push(`Parcours ${p.nom}`); fs.forEach(f => reste.delete(f)); }
  }
  return [...out, ...[...reste].map(filiereCourte)];
}
// Une offre (liste de filières, vide = toutes) concerne-t-elle cette filière ?
// Deux filières de la maquette actuelle doivent être identiques ; une ancienne appellation couvre son parcours.
export function filiereMatch(list, filiere) {
  if (!list?.length) return true;
  if (!filiere) return false;
  if (list.includes(filiere)) return true;
  const mine = parcoursOf(filiere), vieille = !FIL_PAR_NOM.has(filiere);
  return list.some(x => (vieille || !FIL_PAR_NOM.has(x)) && parcoursOf(x).some(c => mine.includes(c)));
}
// Filtre d'une liste de membres : « parcours:PM » (tout un parcours) ou une filière (les anciennes appellations suivent leur parcours)
export function filtreFiliere(choix, filiere) {
  if (!choix) return true;
  if (choix.startsWith('parcours:')) return parcoursOf(filiere).includes(choix.slice(9));
  return filiereMatch([choix], filiere);
}
// Filtre d'une liste d'offres : une offre pour toutes les filières passe toujours
export function filtreOffre(filieres, choix) {
  if (!choix || !filieres?.length) return true;
  if (choix.startsWith('parcours:')) return filieres.some(x => parcoursOf(x).includes(choix.slice(9)));
  return filiereMatch(filieres, choix);
}
// Ce qui suit « : » dans le nom officiel (« Excellence Opérationnelle »), pour les puces groupées par parcours
export const filiereSousTitre = f => (f || '').split(' : ')[1] || f || '';
// Proximité entre deux membres : 2 = même filière, 1 = même parcours, 0 = sinon
export function proximiteFiliere(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 2;
  const pa = parcoursOf(a);
  return parcoursOf(b).some(c => pa.includes(c)) ? 1 : 0;
}
// Filières proposées dans un formulaire : prépa pour les 1A-2A, maquette actuelle, anciennes appellations pour les lauréats
export function filieresPour(role, niveau) {
  if (role === 'etudiant' && niveau <= 2) return [{ label: 'Années préparatoires intégrées (API)', options: [PREPA] }];
  const groupes = PARCOURS.map(p => ({ label: `Parcours ${p.nom}`, options: FILIERES_INFO.filter(f => f.parcours === p.code).map(f => f.nom) }));
  if (role !== 'etudiant') groupes.push({ label: 'Ancienne appellation (promos précédentes)', options: ANCIENNES_FILIERES.map(([f]) => f) });
  return groupes;
}

export const TYPES = {
  stage: { label: 'Stage', long: 'Stage (3A / 4A)' },
  pfe: { label: 'PFE', long: 'Projet de fin d’études' },
  etranger: { label: 'Stage à l’étranger', long: 'Stage à l’étranger' },
  emploi: { label: 'Emploi', long: 'Emploi (CDI, CDD, VIE…)' },
};

export const NIVEAUX = {
  1: { short: '1A', label: '1re année (cycle prépa)' },
  2: { short: '2A', label: '2e année (cycle prépa)' },
  3: { short: '3A', label: '3e année' },
  4: { short: '4A', label: '4e année' },
  5: { short: '5A', label: '5e année' },
  6: { short: 'Diplômé', label: 'Jeune diplômé' },
  7: { short: 'Lauréat', label: 'Lauréat' },
};

export const CATEGORIES_Q = ['PFE', 'Stage', 'Étranger & visas', 'CV & entretiens', 'Premier emploi', 'Vie à l’école'];

// Une saison = une année universitaire, de septembre à août. 2026 = « 2026-2027 ».
// Règles de la page d'entrée (elles vivent à part pour qu'elle s'affiche sans attendre ce fichier)
export { roleDePromo, promoValide, PROMO_MIN, PROMO_MAX, presetInscription, lignesChiffres, estEmailEcole, chiffresCode, casErreurAuth, saisonActuelle, lienPartage, lienEncoreBon, LIEN_DUREE, estUuid, phraseLien, suiteLien } from './regles-entree.js';
export function seasonOf(d = new Date()) { return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; }
export const seasonLabel = s => `${s}-${s + 1}`;

// Niveau d'un membre pendant une saison, calculé depuis sa promo (année de diplôme).
export function niveauOf(p, saison) {
  if (!p || !p.promo) return 7;
  const n = 5 - (p.promo - (saison + 1));
  if (n <= 0) return 1;
  if (n <= 5) return n;
  return p.promo === saison ? 6 : 7;
}

// « Fais venir ta promo » : le lien d'une promo mène à sa petite page d'aperçu (page = true, outils/pages-promo.mjs),
// qui nomme la promo dans WhatsApp puis ouvre le site avec ?promo= ; sinon le lien simple ?promo=
export const lienPromo = (promo, langue, page, base) => new URL(page ? `promo/${promo}/${langue === 'ar' ? 'ar/' : ''}` : `./?promo=${promo}${langue === 'ar' ? '&lang=ar' : ''}`, base).href;
// Membres inscrits avec cette promo, étudiants et lauréats, moi compris
export const inscritsDeLaPromo = (profiles, promo) => profiles.filter(p => p.promo != null && Number(p.promo) === Number(promo)).length;
// Message d'un membre à sa propre promo : court, à la première personne, avec le lien. n : déjà inscrits, cité à partir de 3.
export function messageCamarade(me, langue, lien, n = 0, saison = seasonOf()) {
  const { promo } = me; const etu = me.role === 'etudiant'; const demande = etu && niveauOf(me, saison) >= 3; const deja = n >= 3;
  if (langue === 'ar') return [`مرحبا دفعة ${promo} 👋`,
    !etu ? 'أنا على «شبكة ENSAM مكناس»: نساعد فيها كخريجين الطلبة على إيجاد تدريب أو مشروع نهاية الدراسة أو أول وظيفة، ونلتقي فيها كزملاء.'
      : demande ? 'أنا على «شبكة ENSAM مكناس»: نقول فيها للخريجين ما نبحث عنه من تدريب أو مشروع نهاية الدراسة، مع السيرة الذاتية، ومن يستطيع المساعدة منهم يجيب.'
      : 'أنا على «شبكة ENSAM مكناس»: نطرح فيها أسئلتنا على الخريجين (الشعبة، التداريب، الحياة بعد المدرسة) ويقدّمون لنا النصائح.',
    `${deja ? `نحن بالفعل ${n} من دفعة ${promo}. ` : ''}${etu ? 'سجّل مجانًا' : 'انضمّ إلينا مجانًا'}، دفعتك محدَّدة مسبقًا في الرابط:`, lien].join('\n');
  return [`Salut la promo ${promo} 👋`,
    !etu ? 'Je suis sur le Réseau ENSAM Meknès : entre lauréats, on y aide les étudiants à trouver un stage, un PFE ou un premier emploi, et on s’y retrouve entre camarades.'
      : demande ? 'Je suis sur le Réseau ENSAM Meknès : on y dit aux lauréats le stage ou le PFE qu’on cherche, CV joint, et ceux qui peuvent aider répondent.'
      : 'Je suis sur le Réseau ENSAM Meknès : on y pose nos questions aux lauréats (filière, stages, vie après l’école) et ils nous conseillent.',
    `${deja ? `On est déjà ${n} de la promo ${promo}. ` : ''}${etu ? 'Inscris-toi' : 'Rejoins-nous'}, c’est gratuit et ta promo est déjà indiquée :`, lien].join('\n');
}

// Objectif de chaque niveau pour la saison, avec son échéance.
export const OBJECTIFS = {
  3: { titre: 'Stage de fin de 3e année', court: 'Stage', types: ['stage', 'etranger'], start: s => new Date(s, 8, 1), deadline: s => new Date(s + 1, 5, 30) },
  4: { titre: 'Stage de fin de 4e année', court: 'Stage', types: ['stage', 'etranger'], start: s => new Date(s, 8, 1), deadline: s => new Date(s + 1, 5, 30) },
  5: { titre: 'PFE ou stage à l’étranger', court: 'PFE / étranger', types: ['pfe', 'etranger'], start: s => new Date(s, 8, 1), deadline: s => new Date(s + 1, 1, 15) },
  6: { titre: 'Premier emploi', court: 'Emploi', types: ['emploi'], start: s => new Date(s, 6, 1), deadline: s => new Date(s + 1, 2, 31) },
};

export function typeForNiveau(n) { return n === 6 || n === 7 ? 'emploi' : n === 5 ? 'pfe' : 'stage'; }

export const FOUND = new Set(['declare', 'confirme']);

export function placementOf(data, uid, saison) {
  return data.placements.find(p => p.student_id === uid && p.saison === saison && p.status !== 'refuse');
}

// Statut de recherche d'un étudiant pour la saison
export function statutOf(data, p, saison) {
  const pl = placementOf(data, p.id, saison);
  if (pl && FOUND.has(pl.status)) return { key: 'trouve', label: 'Trouvé', pl };
  if (pl && pl.status === 'en_attente') return { key: 'validation', label: 'À confirmer', pl };
  const apps = data.applications.filter(a => a.student_id === p.id);
  if (apps.some(a => a.status === 'entretien')) return { key: 'entretiens', label: 'Entretiens en cours' };
  if (apps.length) return { key: 'candidatures', label: 'Candidatures envoyées' };
  return { key: 'recherche', label: 'En recherche' };
}

// ---------------------------------------------------------------------------
// Tableau de bord
// ---------------------------------------------------------------------------
export function seasonStats(data, saison, now = new Date()) {
  const members = data.profiles.filter(p => p.role !== 'admin');
  const rows = [3, 4, 5, 6].map(n => {
    const pop = members.filter(p => niveauOf(p, saison) === n);
    const pls = pop.map(p => placementOf(data, p.id, saison)).filter(Boolean);
    const found = pls.filter(pl => FOUND.has(pl.status));
    const pending = pls.filter(pl => pl.status === 'en_attente');
    const via = found.filter(pl => pl.source === 'plateforme');
    const o = OBJECTIFS[n];
    const start = o.start(saison), end = o.deadline(saison);
    const elapsed = Math.max(0, Math.min(1, (now - start) / (end - start)));
    const daysLeft = Math.ceil((end - now) / 864e5);
    const rate = pop.length ? found.length / pop.length : 0;
    const byFiliere = [...new Set([...FILIERES, ...pop.map(p => p.filiere).filter(Boolean)])].map(f => {
      const fp = pop.filter(p => p.filiere === f);
      const ff = fp.filter(p => found.some(pl => pl.student_id === p.id));
      return { filiere: f, total: fp.length, found: ff.length };
    }).filter(x => x.total > 0);
    const searching = pop.filter(p => !pls.some(pl => pl.student_id === p.id && (FOUND.has(pl.status) || pl.status === 'en_attente')));
    return { n, objectif: o, total: pop.length, found: found.length, pending: pending.length, via: via.length, rate, elapsed, daysLeft, end, byFiliere, searching, foundList: found };
  });
  const sPl = data.placements.filter(p => p.saison === saison && FOUND.has(p.status));
  const countries = tally(sPl.filter(p => (p.pays || 'Maroc') !== 'Maroc').map(p => p.pays));
  const companies = tally(sPl.map(p => p.entreprise));
  return { rows, countries, companies, totalFound: sPl.length, viaTotal: sPl.filter(p => p.source === 'plateforme').length };
}

export function monthlyActivity(data, months = 6, now = new Date()) {
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const inM = r => { const t = new Date(r.created_at); return t >= d && t < e; };
    out.push({
      label: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
      offres: data.offers.filter(inM).length,
      placements: data.placements.filter(p => p.status === 'confirme' && p.confirmed_at && (t => t >= d && t < e)(new Date(p.confirmed_at))).length,
    });
  }
  return out;
}

function tally(arr) {
  const m = new Map(); for (const x of arr) if (x) m.set(x, (m.get(x) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// ---------------------------------------------------------------------------
// Points d'impact et badges : ce qui donne envie aux lauréats de revenir
// ---------------------------------------------------------------------------
export const BAREME = [
  ['Offre publiée', 10],
  ['Candidature reçue sur une offre', 2],
  ['Commentaire utile', 1],
  ['Étudiant recruté (confirmé par l’étudiant)', 50],
  ['Bonus stage ou emploi à l’étranger', 25],
  ['Mentorat accepté', 10],
  ['Mentorat terminé', 20],
  ['Message de remerciement reçu', 10],
  ['Réponse dans l’Entraide', 5],
  ['Meilleure réponse choisie', 15],
  ['Vote reçu sur une réponse', 2],
  ['Réussite enregistrée (étudiant)', 10],
  ['CV relu et rendu à un étudiant', 15],
  ['Rubrique du guide de l’étranger écrite', 10],
  ['Entretien ou avis de stage partagé', 5],
];

export const NIVEAUX_IMPACT = [
  { min: 0, nom: 'Membre' },
  { min: 60, nom: 'Bronze' },
  { min: 150, nom: 'Argent' },
  { min: 300, nom: 'Or' },
  { min: 600, nom: 'Platine' },
  { min: 1000, nom: 'Légende ENSAM' },
];

export function levelOf(points) {
  let i = 0; for (let k = 0; k < NIVEAUX_IMPACT.length; k++) if (points >= NIVEAUX_IMPACT[k].min) i = k;
  const cur = NIVEAUX_IMPACT[i], next = NIVEAUX_IMPACT[i + 1];
  return { ...cur, idx: i, next, progress: next ? (points - cur.min) / (next.min - cur.min) : 1 };
}

// Retourne une Map id -> { points, events[], stats } ; `since` limite aux événements récents.
export function computeScores(data, since = null) {
  const S = new Map();
  const get = id => { if (!S.has(id)) S.set(id, { points: 0, events: [], offres: 0, recrutes: 0, etranger: 0, mentorats: 0, rapides: 0, mercis: 0, reponses: 0, meilleures: 0, candidatures: 0 }); return S.get(id); };
  const add = (id, pts, label, at) => {
    if (!id) return; if (since && new Date(at) < since) return;
    const s = get(id); s.points += pts; s.events.push({ pts, label, at });
  };
  const offerAuthor = new Map(data.offers.map(o => [o.id, o.author_id]));
  for (const o of data.offers) { add(o.author_id, 10, `Offre publiée : ${o.titre}`, o.created_at); get(o.author_id).offres++; }
  for (const ap of data.applications) if (ap.offer_id) { const a = offerAuthor.get(ap.offer_id); if (a && a !== ap.student_id) { add(a, 2, 'Candidature reçue', ap.created_at); get(a).candidatures++; } }
  for (const c of data.comments) add(c.author_id, 1, 'Commentaire', c.created_at);
  for (const p of data.placements) {
    if (FOUND.has(p.status)) add(p.student_id, 10, 'Réussite enregistrée', p.created_at);
    if (p.status === 'confirme' && p.laureat_id) {
      const at = p.confirmed_at || p.created_at;
      add(p.laureat_id, 50, `Étudiant recruté chez ${p.entreprise}`, at); get(p.laureat_id).recrutes++;
      if (p.type === 'etranger' || (p.pays && p.pays !== 'Maroc')) { add(p.laureat_id, 25, `Bonus international (${p.pays})`, at); get(p.laureat_id).etranger++; }
      if (p.merci) { add(p.laureat_id, 10, 'Message de remerciement', at); get(p.laureat_id).mercis++; }
    }
  }
  for (const m of data.mentorships) {
    if (!m.mentor_id) continue;
    const at = m.accepted_at || m.created_at;
    if (m.status === 'acceptee' || m.status === 'terminee') add(m.mentor_id, 10, `Mentorat accepté : ${m.sujet}`, at);
    if (m.accepted_at && new Date(m.accepted_at) - new Date(m.created_at) < 864e5 && m.status !== 'annulee') get(m.mentor_id).rapides++;
    if (m.status === 'terminee') { add(m.mentor_id, 20, `Mentorat terminé : ${m.sujet}`, m.rdv_at || at); get(m.mentor_id).mentorats++; }
    if (m.merci) { add(m.mentor_id, 10, 'Message de remerciement', m.rdv_at || at); get(m.mentor_id).mercis++; }
  }
  const ansAuthor = new Map(data.answers.map(a => [a.id, a.author_id]));
  for (const a of data.answers) { add(a.author_id, 5, 'Réponse dans l’Entraide', a.created_at); get(a.author_id).reponses++; }
  for (const q of data.questions) if (q.best_answer_id && ansAuthor.get(q.best_answer_id)) { const a = ansAuthor.get(q.best_answer_id); add(a, 15, 'Meilleure réponse', q.created_at); get(a).meilleures++; }
  for (const v of data.votes) { const a = ansAuthor.get(v.answer_id); if (a && a !== v.user_id) add(a, 2, 'Vote sur ta réponse', v.created_at); }
  // Phase 3 : relectures de CV, guide de l'étranger, entretiens et avis partagés (l'auteur d'un partage anonyme n'est connu que de lui)
  for (const r of data.relectures_cv || []) if (r.status === 'rendue' && r.reviewer_id) {
    add(r.reviewer_id, 15, 'CV relu et rendu', r.rendue_at || r.created_at); get(r.reviewer_id).relectures = (get(r.reviewer_id).relectures || 0) + 1;
    if (r.merci) { add(r.reviewer_id, 10, 'Message de remerciement', r.rendue_at || r.created_at); get(r.reviewer_id).mercis++; }
  }
  for (const g of data.guide_pays || []) if (g.updated_by) add(g.updated_by, 10, `Guide de l’étranger : ${g.pays}`, g.updated_at || g.created_at);
  for (const e of data.entretiens || []) if (e.author_id) add(e.author_id, 5, `Entretien partagé : ${e.entreprise}`, e.created_at);
  for (const a of data.avis_stage || []) if (a.author_id) add(a.author_id, 5, `Avis de stage : ${a.entreprise}`, a.created_at);
  return S;
}

export const BADGES = [
  { id: 'fondateur', nom: 'Membre fondateur', desc: 'Parmi les 25 premiers lauréats du réseau', test: (s, p, x) => !!p.id && !!x.fondateurs?.has(p.id) },
  { id: 'verifie', nom: 'Lauréat vérifié', desc: 'Diplôme confirmé par le réseau', test: (s, p) => p.role === 'laureat' && p.verified },
  { id: 'premier', nom: 'Premier coup de pouce', desc: 'A publié une première offre', test: s => s.offres >= 1 },
  { id: 'recruteur', nom: 'Recruteur', desc: '3 étudiants recrutés grâce à ses offres', test: s => s.recrutes >= 3 },
  { id: 'faiseur', nom: 'Faiseur de carrières', desc: '10 étudiants recrutés', test: s => s.recrutes >= 10 },
  { id: 'passeport', nom: 'Passeport', desc: 'A ouvert une porte à l’étranger', test: s => s.etranger >= 1 },
  { id: 'mentor', nom: 'Mentor', desc: '3 mentorats terminés', test: s => s.mentorats >= 3 },
  { id: 'reactif', nom: 'Toujours là', desc: '3 demandes d’aide acceptées en moins de 24 h', test: s => s.rapides >= 3 },
  { id: 'sage', nom: 'Sage de l’entraide', desc: '3 meilleures réponses', test: s => s.meilleures >= 3 },
  { id: 'aime', nom: 'Aimé de la promo', desc: '5 messages de remerciement', test: s => s.mercis >= 5 },
  { id: 'top', nom: 'Top contributeur', desc: '300 points d’impact (niveau Or)', test: s => s.points >= 300 },
  { id: 'mois', nom: 'Lauréat du mois', desc: 'Le plus d’impact sur les 30 derniers jours', test: (s, p, x) => !!p.id && x.star === p.id },
];

// Membres fondateurs : les 25 premiers lauréats arrivés sur la plateforme (ils ont lancé l'entraide)
export const NB_FONDATEURS = 25;
// Les lauréats dans l'ordre où ils ont rejoint le réseau (même ordre pour le badge et pour l'accueil)
export const ordreArrivee = profiles => (profiles || []).filter(p => p.role === 'laureat' && p.created_at)
  .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)));
export function fondateursOf(profiles) {
  return new Set(ordreArrivee(profiles).slice(0, NB_FONDATEURS).map(p => p.id));
}
// « Te voilà 40e lauréat(e) du réseau » : le rang d'arrivée d'un lauréat (null pour les autres, ou sans date)
export function rangLaureat(profiles, me) {
  if (me?.role !== 'laureat' || !me.created_at) return null;
  const i = ordreArrivee(profiles).findIndex(p => p.id === me.id);
  return i < 0 ? null : i + 1;
}

// `extra.star` : id du lauréat du mois (voir starOfMonth) ; `extra.fondateurs` : voir fondateursOf
export function badgesOf(score, profile, extra = {}) {
  const s = score || { points: 0, offres: 0, recrutes: 0, etranger: 0, mentorats: 0, rapides: 0, meilleures: 0, mercis: 0 };
  return BADGES.filter(b => b.test(s, profile || {}, extra));
}

// Lauréat qui a eu le plus d'impact sur 30 jours (null si personne n'a de points)
export function starOfMonth(data, monthScores = computeScores(data, new Date(Date.now() - 30 * 864e5))) {
  const best = data.profiles.filter(p => p.role === 'laureat').map(p => ({ p, pts: monthScores.get(p.id)?.points || 0 })).sort((a, b) => b.pts - a.pts)[0];
  return best && best.pts > 0 ? best : null;
}

// ---------------------------------------------------------------------------
// Mentorat en 3 étapes : l'étudiant demande (besoin + horaires), un lauréat choisit
// un horaire, ils se parlent en visio, l'étudiant dit merci.
// ---------------------------------------------------------------------------
export const BESOINS = {
  cv: { label: 'Mon CV', icon: 'file', mots: ['cv', 'candidature', 'lettre'] },
  stage: { label: 'Stage ou PFE', icon: 'briefcase', mots: ['stage', 'pfe', 'industrie', 'projet'] },
  entretien: { label: 'Un entretien', icon: 'people', mots: ['entretien', 'recrutement', 'oral'] },
  etranger: { label: 'Partir à l’étranger', icon: 'globe', mots: ['étranger', 'etranger', 'campus france', 'visa', 'vie', 'international', 'france', 'canada', 'allemagne'] },
  carriere: { label: 'Mon orientation', icon: 'route', mots: ['carrière', 'carriere', 'orientation', 'salaire', 'emploi', 'reconversion'] },
};
export const RDV_MIN = 20; // durée d'un rendez-vous de mentorat

// ouverte : attend un lauréat (à tous) · demande : attend le lauréat choisi · rdv : rendez-vous à venir
// apres : rendez-vous passé, à clore · terminee · annulee · refusee
export function mentorState(m, now = new Date()) {
  if (m.status === 'demande') return m.mentor_id ? 'demande' : 'ouverte';
  if (m.status === 'acceptee') return m.rdv_at && new Date(m.rdv_at).getTime() + RDV_MIN * 6e4 < now.getTime() ? 'apres' : 'rdv';
  return m.status;
}
// Jours de calendrier (ceux de l'appareil) d'aujourd'hui à cette date : 0 aujourd'hui, 1 demain
export const joursAvant = (iso, now = new Date()) => { const j = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); return Math.round((j(new Date(iso)) - j(now)) / 864e5); };
// Un rendez-vous ne prend la carte « prochaine étape » que s'il commence, la veille ou le jour même.
// L'étudiant qui n'a pas encore confirmé le fait alors sur la carte ; avant, c'est une ligne de « Cette semaine ».
export function rdvALaUne(m, meId, now = new Date()) {
  if (!m?.rdv_at || (m.student_id !== meId && m.mentor_id !== meId) || mentorState(m, now) !== 'rdv') return null;
  if (now.getTime() > new Date(m.rdv_at).getTime() - 15 * 6e4) return 'direct';
  if (joursAvant(m.rdv_at, now) > 1) return null;
  return m.student_id === meId && 'confirme_at' in m && !m.confirme_at ? 'confirmer' : 'proche';
}
// Premiers pas d'un lauréat : son profil compte dès qu'il dit où il en est (en poste ou en recherche), jamais bloqué faute d'employeur
export const profilLaureatFait = me => !!(me?.entreprise || me?.poste || (me?.en_recherche && me?.disponibilite));
// Le chiffre des 30 premiers jours : les demandes d'étudiants (aide d'un lauréat, questions) qui ont une réponse en 48 h.
// Sur 30 jours ; une demande de moins de 48 h encore sans réponse ne compte pas encore. « attente » : sans réponse depuis plus de 24 h.
export function reponses48h(data, now = new Date()) {
  const t = now.getTime(), H = 36e5, role = id => (data.profiles || []).find(p => p.id === id)?.role;
  const demandes = [
    ...(data.mentorships || []).filter(m => m.status !== 'annulee' && role(m.student_id) === 'etudiant')
      .map(m => ({ type: 'mentorat', id: m.id, titre: m.sujet, at: new Date(m.created_at).getTime(), rep: m.accepted_at ? new Date(m.accepted_at).getTime() : null, close: m.status === 'refusee' })),
    ...(data.demandes || []).filter(d => role(d.auteur_id) === 'etudiant').map(d => {
      const r = (data.propositions || []).filter(x => x.demande_id === d.id).map(x => new Date(x.created_at).getTime());
      return { type: 'demande', id: d.id, titre: d.titre, at: new Date(d.created_at).getTime(), rep: r.length ? Math.min(...r) : null, close: !['ouverte', 'match'].includes(d.status) };
    }),
    ...(data.questions || []).filter(q => role(q.author_id) === 'etudiant').map(q => {
      const r = (data.answers || []).filter(a => a.question_id === q.id && a.author_id !== q.author_id).map(a => new Date(a.created_at).getTime());
      return { type: 'question', id: q.id, titre: q.titre, at: new Date(q.created_at).getTime(), rep: r.length ? Math.min(...r) : null, close: false };
    }),
  ].filter(d => t - d.at <= 30 * 24 * H);
  const comptees = demandes.filter(d => d.rep !== null || t - d.at >= 48 * H);
  const a48 = comptees.filter(d => d.rep !== null && d.rep - d.at <= 48 * H).length;
  const attente = demandes.filter(d => d.rep === null && !d.close && t - d.at > 24 * H).sort((a, b) => a.at - b.at);
  // Le même chiffre pour chaque sorte de demande (la « Demande » d'un étudiant est celle qu'on suit d'abord)
  const parType = Object.fromEntries(['demande', 'mentorat', 'question'].map(k => {
    const c = comptees.filter(d => d.type === k), a = c.filter(d => d.rep !== null && d.rep - d.at <= 48 * H).length;
    return [k, { total: c.length, a48: a, taux: c.length ? a / c.length : null }];
  }));
  return { total: comptees.length, a48, taux: comptees.length ? a48 / comptees.length : null, attente, parType };
}

// Offres faites pour un membre : un étudiant, celles de son année ; un jeune diplômé, celles « Jeunes diplômés » ;
// un lauréat qui cherche un emploi, celles-là et les offres entre lauréats. Toujours dans sa filière.
export function offrePour(o, me, saison) {
  if (!me || !filiereMatch(o.filieres, me.filiere)) return false;
  const recherche = me.role === 'laureat' && !!me.en_recherche;
  if (o.audience === 'laureats') return recherche;
  const annees = o.annees || [];
  return annees.includes(niveauOf(me, saison)) || (recherche && annees.includes(6));
}
// Qui peut postuler : un étudiant aux offres étudiantes ; un lauréat aux offres entre lauréats,
// et aux offres « Jeunes diplômés » s'il est jeune diplômé ou cherche un emploi
export function peutPostulerA(o, me, saison) {
  if (!me || o.author_id === me.id) return false;
  // Un étudiant ne postule qu'aux offres de son année (comme dans la liste)
  if (me.role === 'etudiant') return o.audience !== 'laureats' && (o.annees || []).includes(niveauOf(me, saison));
  if (me.role !== 'laureat') return false;
  return o.audience === 'laureats' || ((o.annees || []).includes(6) && (!!me.en_recherche || niveauOf(me, saison) === 6));
}

// Ce qui compte comme une action : publier, commenter, réagir, postuler, demander ou donner de l'aide, répondre…
const ACTIONS = [['offers', 'author_id'], ['comments', 'author_id'], ['reactions', 'user_id'], ['applications', 'student_id'], ['mentorships', 'student_id'],
  ['questions', 'author_id'], ['answers', 'author_id'], ['votes', 'user_id'], ['kudos', 'user_id'], ['placements', 'laureat_id'], ['groupe_messages', 'author_id'],
  ['relectures_cv', 'student_id'], ['avis_stage', 'author_id'], ['entretiens', 'author_id'], ['cafes', 'organisateur_id']];
// La dernière action de chaque membre (id → date en ms)
export function dernieresActions(data) {
  const m = new Map();
  const noter = (id, at) => { const t = at ? new Date(at).getTime() : NaN; if (id && t > (m.get(id) || 0)) m.set(id, t); };
  for (const [table, col] of ACTIONS) for (const r of data[table] || []) noter(r[col], r.created_at);
  for (const r of data.mentorships || []) if (r.mentor_id && r.accepted_at) noter(r.mentor_id, r.accepted_at);
  return m;
}
// Où les inscriptions s'arrêtent : compte créé → profil rempli → première action ; et qui a agi cette semaine
// Rôle et promo cohérents : un lauréat a déjà son diplôme, un étudiant l'aura entre la 5A et la 1re année de cette saison
export function incoherenceProfil(role, promo, S, an) {
  const p = Number(promo); if (promo === '' || promo == null || !Number.isInteger(p) || p < 1990 || p > 2040) return null;
  return role === 'laureat' && p > an ? 'futur' : role === 'etudiant' && p <= S ? 'diplome' : role === 'etudiant' && p > S + 5 ? 'loin' : null;
}
// Ce qui manque encore pour enregistrer le profil, dans l'ordre de l'écran (le bouton le dit, et y mène)
export function manquesProfil(f, { onboarding = false, ecoleBloque = false, incoherent = null } = {}) {
  const p = Number(f.promo);
  return [!f.role && 'role', ecoleBloque && 'ecole', String(f.full_name || '').trim().length < 2 && 'nom',
    !(f.promo !== '' && f.promo != null && Number.isInteger(p) && p >= 1990 && p <= 2040) && 'promo', !!incoherent && 'coherence', !f.filiere && 'filiere',
    onboarding && f.role === 'laureat' && typeof f.mentor_dispo !== 'boolean' && 'aide'].filter(Boolean);
}
// Avec le code à 6 chiffres, demander un code crée déjà le compte (connexion notée dans la seconde) :
// un compte créé par code n'est « ouvert » qu'avec un profil ou une connexion venue plus tard (le code entré).
// Un compte d'avant les codes, ou un champ absent (base pas encore à jour), compte toujours.
export function compteOuvert(c) {
  if (c.a_profil || c.par_code !== true || c.last_sign_in_at == null || c.created_at == null) return true;
  return new Date(c.last_sign_in_at) - new Date(c.created_at) > 5000;
}
// Personnes qui ont demandé un code sans l'entrer (code pas reçu, ou visite interrompue), hors administration
export function codesSansSuite(comptes, profils = []) {
  const admins = new Set(profils.filter(p => p.role === 'admin').map(p => p.id));
  return (comptes || []).filter(c => !admins.has(c.id) && !compteOuvert(c)).length;
}
export function parcoursInscription(comptes, data, now = new Date()) {
  const admins = new Set((data.profiles || []).filter(p => p.role === 'admin').map(p => p.id));
  const liste = (comptes?.length ? comptes : (data.profiles || []).map(p => ({ id: p.id, a_profil: true }))).filter(c => !admins.has(c.id) && compteOuvert(c));
  const actions = dernieresActions(data);
  const profil = liste.filter(c => c.a_profil).length, action = liste.filter(c => c.a_profil && actions.has(c.id)).length;
  const semaine = now.getTime() - 7 * 864e5;
  const actifs = [...actions].filter(([id, t]) => t > semaine && !admins.has(id)).length;
  return { comptes: liste.length, profil, action, actifs };
}
export const futureSlots = (m, now = new Date()) => (m.creneaux || []).filter(c => new Date(c) > now).sort();

export const norm = t => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Pourquoi ce lauréat est le bon pour cette demande (et l'inverse)
export function helpMatch(m, laureat, student, now = new Date()) {
  const why = []; let score = 0;
  const prox = student ? proximiteFiliere(laureat.filiere, student.filiere) : 0;
  if (prox === 2) { score += 3; why.push('Même filière'); } else if (prox === 1) { score += 2; why.push('Même parcours'); }
  const sujets = norm(`${laureat.mentor_sujets || ''} ${laureat.poste || ''} ${(laureat.competences || []).join(' ')}`);
  const b = BESOINS[m?.besoin];
  if (b && b.mots.some(w => sujets.includes(norm(w)))) { score += 2; why.push(b.label); }
  if (m?.besoin === 'etranger' && laureat.pays && laureat.pays !== 'Maroc') { score += 2; why.push(`Vit en ${laureat.pays}`); }
  if (m && !m.mentor_id) score += Math.min(3, Math.floor((now - new Date(m.created_at)) / 864e5)); // les plus anciennes d'abord
  return { score, why };
}

// Demandes que ce lauréat peut prendre : celles qui lui sont adressées, puis les demandes ouvertes qui lui correspondent
export function requestsFor(data, me, byId, now = new Date()) {
  return data.mentorships
    .filter(m => m.status === 'demande' && m.student_id !== me.id && (m.mentor_id === me.id || !m.mentor_id))
    .map(m => ({ m, ...helpMatch(m, me, byId(m.student_id), now), direct: m.mentor_id === me.id }))
    .sort((a, b) => b.direct - a.direct || b.score - a.score || new Date(a.m.created_at) - new Date(b.m.created_at));
}

// Lauréats conseillés pour une demande (ou pour un étudiant, sans demande précise)
export function mentorsFor(data, student, besoin, scores) {
  return data.profiles.filter(p => p.role === 'laureat' && p.mentor_dispo && p.id !== student.id)
    .map(p => ({ p, ...helpMatch({ besoin, mentor_id: p.id }, p, student) }))
    .sort((a, b) => b.score - a.score || (scores?.get(b.p.id)?.points || 0) - (scores?.get(a.p.id)?.points || 0));
}

// Offres recommandées : filière, compétences retrouvées dans l'offre, ville, fraîcheur
export function offerMatch(o, me, now = new Date()) {
  const why = []; let score = 0;
  if (o.filieres?.length && filiereMatch(o.filieres, me.filiere)) { score += 3; why.push('Ta filière'); } else if (!o.filieres?.length) score += 1;
  const txt = norm(`${o.titre} ${o.description}`);
  for (const c of me.competences || []) if (c.length > 1 && txt.includes(norm(c)) && why.length < 3) { score += 1; why.push(c); }
  if (me.ville && o.ville && norm(o.ville) === norm(me.ville)) { score += 1; why.push(o.ville); }
  if (now - new Date(o.created_at) < 7 * 864e5) score += 1;
  return { score, why };
}

// Étudiants en recherche qui correspondent à une offre (pour l'inviter à postuler)
export function talentsFor(data, o, saison, max = 3) {
  return data.profiles.filter(p => p.role === 'etudiant' && p.vitrine !== false && (o.annees || []).includes(niveauOf(p, saison))
      && !['trouve', 'validation'].includes(statutOf(data, p, saison).key)
      && !data.applications.some(a => a.offer_id === o.id && a.student_id === p.id))
    .map(p => ({ p, ...offerMatch(o, p) })).filter(x => x.score >= 3)
    .sort((a, b) => b.score - a.score).slice(0, max);
}

// Ce que l'attestation certifie : uniquement des actions vérifiées par l'autre partie.
export function attestationStats(data, uid) {
  return {
    mentorats: data.mentorships.filter(m => m.mentor_id === uid && m.status === 'terminee').length,
    recrutes: data.placements.filter(p => p.laureat_id === uid && p.status === 'confirme').length,
    reponses: data.answers.filter(a => a.author_id === uid).length,
  };
}

// ---------------------------------------------------------------------------
// Petits utilitaires d'affichage
// ---------------------------------------------------------------------------
export function timeAgo(iso, now = new Date()) {
  const s = Math.round((now - new Date(iso)) / 1000);
  if (s < 60) return 'à l’instant';
  const m = Math.round(s / 60); if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24); if (d < 30) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
export const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '';
export function daysUntil(dateStr, now = new Date()) { if (!dateStr) return null; return Math.ceil((new Date(dateStr + 'T23:59:59') - now) / 864e5); }
export const initials = name => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
export const pct = x => `${Math.round(x * 100)}\u202f%`;

// ---------------------------------------------------------------------------
// Phase 2 : annuaire pro, entreprises, groupes, défis, coupe des promos, relance douce, bilans
// ---------------------------------------------------------------------------
export const SECTEURS = ['Automobile', 'Aéronautique', 'Énergie', 'Industrie', 'BTP & immobilier', 'Mines & chimie', 'Conseil & IT', 'Banque & finance', 'Télécoms', 'Agroalimentaire', 'Logistique', 'Enseignement & recherche', 'Fonction publique', 'Startup', 'Autre'];

// Nom d'entreprise comparable (même règle que cle_entreprise dans schema.sql) : « Renault Group Maroc » -> « renault »
const STOP_ENT = new Set(['group', 'groupe', 'maroc', 'morocco', 'sa', 'sas', 'sarl', 'ltd', 'inc', 'the', 'le', 'la', 'les', 'de', 'du', 'des', 'corporation', 'operations', 'international']);
export function entKey(name) {
  const k = norm(name).replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w && !STOP_ENT.has(w)).join(' ');
  return k || null;
}
export function sameCompany(a, b) {
  const x = entKey(a), y = entKey(b);
  return !!x && !!y && (x === y || x.startsWith(y + ' ') || y.startsWith(x + ' '));
}

// Groupes : « filiere:genie industriel », « ville:casablanca », « pays:france »
export const groupKey = (kind, v) => (v && norm(v).trim() ? `${kind}:${norm(v).trim().replace(/\s+/g, ' ')}` : null);
// Le groupe « filière » réunit tout un parcours : étudiants des filières actuelles et lauréats des anciennes appellations
export function groupeFiliere(f) {
  const c = parcoursOf(f)[0];
  return c ? groupKey('filiere', parcoursNom(c)) : groupKey('filiere', f)?.slice(0, 80) || null;
}
export function autoGroups(p) {
  if (!p) return [];
  return [groupeFiliere(p.filiere), groupKey('ville', p.ville), p.pays && norm(p.pays) !== 'maroc' ? groupKey('pays', p.pays) : null].filter(Boolean);
}
export function myGroups(data, me) {
  const auto = autoGroups(me);
  const followed = data.groupe_membres.filter(g => g.user_id === me.id).map(g => g.groupe);
  return { auto, followed: followed.filter(g => !auto.includes(g)), all: [...new Set([...auto, ...followed])] };
}
// Membres d'un groupe : ceux dont le profil correspond, plus ceux qui le suivent
export function groupMembers(data, key) {
  const followers = new Set(data.groupe_membres.filter(g => g.groupe === key).map(g => g.user_id));
  return data.profiles.filter(p => p.role !== 'admin' && (autoGroups(p).includes(key) || followers.has(p.id)));
}
// Nom affiché d'un groupe : l'écriture la plus courante parmi ses membres
export function groupLabel(data, key) {
  const [kind, v] = key.split(':');
  const parcours = kind === 'filiere' && PARCOURS.find(p => groupKey('filiere', p.nom) === key);
  if (parcours) return parcours.nom;
  const field = { filiere: 'filiere', ville: 'ville', pays: 'pays' }[kind];
  const counts = new Map();
  for (const p of data.profiles) if (p[field] && groupKey(kind, p[field]) === key) counts.set(p[field].trim(), (counts.get(p[field].trim()) || 0) + 1);
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return best || v.replace(/\b\w/g, c => c.toUpperCase());
}

// Défis de saison : progression collective, calculée à partir de ce qui est déjà vérifié sur la plateforme
export const MESURES = {
  reussites: { label: 'Réussites', unite: 'réussites' },
  stages: { label: 'Stages trouvés', unite: 'stages' },
  pfe: { label: 'PFE trouvés', unite: 'PFE' },
  etranger: { label: 'Expériences à l’étranger', unite: 'à l’étranger' },
  emplois: { label: 'Premiers emplois', unite: 'emplois' },
  mentorats: { label: 'Mentorats terminés', unite: 'mentorats' },
  offres: { label: 'Offres publiées', unite: 'offres' },
  reponses: { label: 'Réponses dans l’Entraide', unite: 'réponses' },
};
export function defiProgress(data, d) {
  const a = new Date(d.debut + 'T00:00:00'), b = new Date(d.fin + 'T23:59:59');
  const inR = iso => { if (!iso) return false; const t = new Date(iso); return t >= a && t <= b; };
  const pl = data.placements.filter(p => FOUND.has(p.status) && inR(p.confirmed_at || p.created_at) && (!d.niveau || p.niveau === d.niveau));
  const n = {
    reussites: () => pl.length,
    stages: () => pl.filter(p => p.type === 'stage' || p.type === 'etranger').length,
    pfe: () => pl.filter(p => p.type === 'pfe').length,
    etranger: () => pl.filter(p => p.type === 'etranger' || (p.pays && p.pays !== 'Maroc')).length,
    emplois: () => pl.filter(p => p.type === 'emploi').length,
    mentorats: () => data.mentorships.filter(m => m.status === 'terminee' && inR(m.rdv_at || m.created_at)).length,
    offres: () => data.offers.filter(o => inR(o.created_at) && (!d.niveau || (o.annees || []).includes(d.niveau))).length,
    reponses: () => data.answers.filter(x => inR(x.created_at)).length,
  }[d.mesure]?.() || 0;
  const now = new Date();
  return { n, cible: d.cible, ratio: Math.min(1, n / d.cible), elapsed: Math.max(0, Math.min(1, (now - a) / (b - a))), daysLeft: Math.ceil((b - now) / 864e5), done: n >= d.cible };
}
export const activeDefis = (data, now = new Date()) => data.defis.filter(d => new Date(d.debut + 'T00:00:00') <= now && new Date(d.fin + 'T23:59:59') >= now);

// Coupe des promos : les points d'impact de la saison, additionnés par promo de lauréats
export function coupeDesPromos(data, saison, scores = computeScores(data, new Date(saison, 8, 1))) {
  const m = new Map();
  for (const p of data.profiles) {
    if (p.role !== 'laureat') continue;
    const pts = scores.get(p.id)?.points || 0;
    const x = m.get(p.promo) || { promo: p.promo, pts: 0, actifs: 0, membres: 0 };
    x.pts += pts; x.membres++; if (pts > 0) x.actifs++;
    m.set(p.promo, x);
  }
  return [...m.values()].filter(x => x.pts > 0).sort((a, b) => b.pts - a.pts || b.actifs - a.actifs);
}

// Relance douce : une offre ouverte sans candidature, question ni confirmation depuis 3 semaines
export const RELANCE_JOURS = 21;
export function offerLastActivity(data, o) {
  let t = Math.max(new Date(o.created_at).getTime(), o.verifiee_at ? new Date(o.verifiee_at).getTime() : 0);
  for (const a of data.applications) if (a.offer_id === o.id) t = Math.max(t, new Date(a.created_at).getTime());
  for (const c of data.comments) if (c.offer_id === o.id) t = Math.max(t, new Date(c.created_at).getTime());
  return t;
}
export const needsRelance = (data, o, now = Date.now()) => o.status === 'ouverte' && now - offerLastActivity(data, o) > RELANCE_JOURS * 864e5;

// Questions routées : celles qui visent l'entreprise ou le pays d'un lauréat
export function routedTo(q, p) {
  if (!p || p.role !== 'laureat' || q.author_id === p.id) return false;
  if (q.entreprise && sameCompany(q.entreprise, p.entreprise)) return true;
  return !!(q.pays && p.pays && norm(p.pays) !== 'maroc' && norm(q.pays) === norm(p.pays));
}

// Alerte talents : étudiants de la filière du lauréat qui cherchent encore, les nouveaux d'abord
export function alerteTalents(data, me, saison, days = 7) {
  const since = Date.now() - days * 864e5;
  const list = data.profiles.filter(p => p.role === 'etudiant' && p.vitrine !== false && proximiteFiliere(p.filiere, me.filiere) > 0 && [3, 4, 5].includes(niveauOf(p, saison))
    && !['trouve', 'validation'].includes(statutOf(data, p, saison).key))
    .map(p => ({ p, nouveau: new Date(p.created_at).getTime() > since }))
    .sort((a, b) => b.nouveau - a.nouveau || (!!b.p.cv_url - !!a.p.cv_url) || (b.p.competences?.length || 0) - (a.p.competences?.length || 0));
  return { list, nouveaux: list.filter(x => x.nouveau).length };
}

// Bilan de cooptation pour la RH : ce que les offres d'un lauréat (ou de son entreprise) ont donné
export function bilanCooptation(data, me, { since = null, equipe = false } = {}) {
  const inR = iso => !since || new Date(iso) >= since;
  const auteurs = new Set([me.id]);
  if (equipe && me.entreprise) for (const p of data.profiles) if (p.role === 'laureat' && sameCompany(p.entreprise, me.entreprise)) auteurs.add(p.id);
  const offres = data.offers.filter(o => auteurs.has(o.author_id) && inR(o.created_at));
  const ids = new Set(offres.map(o => o.id));
  const apps = data.applications.filter(a => ids.has(a.offer_id));
  const recrues = data.placements.filter(p => p.status === 'confirme' && auteurs.has(p.laureat_id) && inR(p.confirmed_at || p.created_at));
  const delais = recrues.map(p => { const o = data.offers.find(x => x.id === p.offer_id); return o ? (new Date(p.confirmed_at || p.created_at) - new Date(o.created_at)) / 864e5 : null; }).filter(x => x !== null && x >= 0);
  return {
    offres: offres.length, candidatures: apps.length, entretiens: apps.filter(a => ['entretien', 'retenu'].includes(a.status)).length,
    recrues, delai: delais.length ? Math.round(delais.reduce((s, x) => s + x, 0) / delais.length) : null,
    filieres: tallyOf(recrues.map(p => data.profiles.find(x => x.id === p.student_id)?.filiere)),
    types: tallyOf(recrues.map(p => p.type)), laureats: auteurs.size,
  };
}
function tallyOf(arr) { const m = new Map(); for (const x of arr) if (x) m.set(x, (m.get(x) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); }

// « Ton année dans le réseau » : le bilan personnel d'une saison
export function tonAnnee(data, me, saison) {
  const a = new Date(saison, 8, 1), b = new Date(saison + 1, 8, 1);
  const inS = iso => { if (!iso) return false; const t = new Date(iso); return t >= a && t < b; };
  if (me.role === 'etudiant') {
    const apps = data.applications.filter(x => x.student_id === me.id && inS(x.created_at));
    const ments = data.mentorships.filter(m => m.student_id === me.id && m.status === 'terminee' && inS(m.rdv_at || m.created_at));
    const qs = data.questions.filter(q => q.author_id === me.id && inS(q.created_at));
    const qIds = new Set(qs.map(q => q.id));
    const pl = placementOf(data, me.id, saison);
    return {
      role: 'etudiant', candidatures: apps.length, entretiens: apps.filter(x => ['entretien', 'retenu'].includes(x.status)).length,
      mentorats: ments.length, laureats: new Set(ments.map(m => m.mentor_id)).size, questions: qs.length,
      reponses: data.answers.filter(x => qIds.has(x.question_id)).length,
      cafes: data.cafe_participants.filter(c => c.user_id === me.id && inS(data.cafes.find(x => x.id === c.cafe_id)?.date_at)).length,
      bravos: pl ? data.kudos.filter(k => k.placement_id === pl.id).length : 0,
      reussite: pl && FOUND.has(pl.status) ? pl : null,
    };
  }
  const s = computeScores(data, a).get(me.id) || { points: 0 };
  const inSeason = (iso) => inS(iso);
  const mercis = [
    ...data.placements.filter(p => p.laureat_id === me.id && p.merci && inSeason(p.confirmed_at || p.created_at)).map(p => p.merci),
    ...data.mentorships.filter(m => m.mentor_id === me.id && m.merci && inSeason(m.rdv_at || m.created_at)).map(m => m.merci),
  ];
  const coupe = coupeDesPromos(data, saison);
  return {
    role: 'laureat', points: Math.max(0, s.points - (computeScores(data, b).get(me.id)?.points || 0)),
    mentorats: data.mentorships.filter(m => m.mentor_id === me.id && m.status === 'terminee' && inSeason(m.rdv_at || m.created_at)).length,
    recrutes: data.placements.filter(p => p.laureat_id === me.id && p.status === 'confirme' && inSeason(p.confirmed_at || p.created_at)).length,
    offres: data.offers.filter(o => o.author_id === me.id && inSeason(o.created_at)).length,
    candidatures: data.applications.filter(x => inSeason(x.created_at) && data.offers.some(o => o.id === x.offer_id && o.author_id === me.id)).length,
    reponses: data.answers.filter(x => x.author_id === me.id && inSeason(x.created_at)).length,
    filleuls: data.parrainages.filter(x => x.parrain_id === me.id && x.saison === saison).length,
    mercis, rangPromo: coupe.findIndex(x => x.promo === me.promo) + 1, promos: coupe.length,
  };
}

// ---------------------------------------------------------------------------
// Phase 3
// ---------------------------------------------------------------------------
// Nom comparable (même règle que cle_nom() dans la base) : « EL AMRANI Salma » = « Salma El-Amrani »
export const cleNom = t => norm(t).replace(/[^a-z]+/g, ' ').split(' ').filter(Boolean).sort().join(' ');

// Enquête d'insertion : à 6 mois (janvier à juin après le diplôme) et à 12 mois (juillet à mars suivant).
// Retourne la vague à remplir maintenant, ou null.
export function enqueteDue(me, enquetes = [], now = new Date()) {
  if (!me || me.role === 'admin' || !me.promo || (me.role !== 'laureat' && niveauOf(me, seasonOf(now)) < 6)) return null;
  const P = me.promo; const t = now.getTime();
  const vagues = [[6, new Date(P + 1, 0, 1), new Date(P + 1, 6, 1)], [12, new Date(P + 1, 6, 1), new Date(P + 2, 3, 1)]];
  for (const [v, debut, fin] of vagues) if (t >= debut && t < fin && !enquetes.some(e => e.user_id === me.id && e.vague === v)) return { vague: v, debut, fin };
  return null;
}

export const SITUATIONS = { emploi: 'En emploi', entrepreneur: 'Création d’entreprise', volontariat: 'Volontariat ou VIE', recherche: 'En recherche', etudes: 'Poursuite d’études', autre: 'Autre' };
export const SALAIRES = { lt6: 'Moins de 6 000 DH', '6_10': '6 000 à 10 000 DH', '10_15': '10 000 à 15 000 DH', '15_20': '15 000 à 20 000 DH', '20_30': '20 000 à 30 000 DH', gt30: 'Plus de 30 000 DH', nsp: 'Je préfère ne pas dire' };
export const CANAUX = { reseau_ensam: 'Réseau ENSAM', plateforme: 'Cette plateforme', linkedin: 'LinkedIn', stage: 'Suite au stage ou PFE', candidature: 'Candidature spontanée', concours: 'Concours', autre: 'Autre' };

// Mêmes chiffres que stats_insertion() dans la base (aucun détail sous 5 réponses)
export function statsInsertion(rows = []) {
  const groupes = new Map();
  for (const e of rows) { const k = e.promo + '|' + e.vague; if (!groupes.has(k)) groupes.set(k, []); groupes.get(k).push(e); }
  const enPoste = e => ['emploi', 'entrepreneur', 'volontariat'].includes(e.situation);
  const compte = (l, k, min = 1) => { const m = {}; for (const e of l) if (e[k] != null && !(k === 'salaire' && e[k] === 'nsp')) m[e[k]] = (m[e[k]] || 0) + 1; for (const x of Object.keys(m)) if (m[x] < min) delete m[x]; return Object.keys(m).length ? m : null; };
  const moy = (l, k) => { const v = l.map(e => e[k]).filter(x => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; };
  const mediane = v => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = (s.length - 1) / 2; return (s[Math.floor(m)] + s[Math.ceil(m)]) / 2; };
  return [...groupes.values()].map(l => {
    const n = l.length; const filieres = {};
    for (const e of l) if (e.filiere) { filieres[e.filiere] ||= { n: 0, en_poste: 0 }; filieres[e.filiere].n++; if (enPoste(e)) filieres[e.filiere].en_poste++; }
    for (const f of Object.keys(filieres)) if (filieres[f].n < 5) delete filieres[f];
    return {
      promo: l[0].promo, vague: l[0].vague, n, en_poste: l.filter(enPoste).length, recherche: l.filter(e => e.situation === 'recherche').length,
      etudes: l.filter(e => e.situation === 'etudes').length, etranger: l.filter(e => enPoste(e) && e.pays && norm(e.pays).trim() !== 'maroc').length,
      delai_median: mediane(l.map(e => e.delai_mois).filter(x => x != null)), lien_formation: moy(l, 'lien_formation'), satisfaction: moy(l, 'satisfaction'),
      canaux: compte(l, 'canal'), secteurs: n >= 5 ? compte(l, 'secteur', 2) : null, salaires: n >= 5 ? compte(l, 'salaire') : null,
      filieres: Object.keys(filieres).length ? filieres : null,
    };
  }).sort((a, b) => b.promo - a.promo || a.vague - b.vague);
}

// Rubriques du guide de l'étranger
export const GUIDE_SECTIONS = [
  ['campus_france', 'Campus France et admission', 'cap'], ['visa', 'Visa et titre de séjour', 'shield'], ['convention', 'Convention de stage', 'check'],
  ['logement', 'Logement', 'home'], ['budget', 'Budget et coût de la vie', 'briefcase'], ['stage', 'Trouver un stage ou un emploi', 'feed'], ['vie', 'Vie sur place', 'heart'],
];

// Taux d'insertion par promo, filière et vague (même calcul que rapport_insertion() dans la base) :
// le taux exclut ceux qui poursuivent leurs études ; le taux de réponse se rapporte à la liste officielle si elle est importée.
export function rapportInsertion(data, now = new Date()) {
  const an = now.getFullYear(); const enPoste = e => ['emploi', 'entrepreneur', 'volontariat'].includes(e.situation);
  const cohortes = new Map();
  for (const p of data.profiles) if (p.role !== 'admin' && p.promo <= an && p.promo >= an - 6) { const k = p.promo + '|' + p.filiere; cohortes.set(k, (cohortes.get(k) || 0) + 1); }
  const liste = data.liste_officielle || []; const enq = data.enquetes_insertion || [];
  const mediane = v => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = (s.length - 1) / 2; return (s[Math.floor(m)] + s[Math.ceil(m)]) / 2; };
  const moy = v => v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null;
  const rows = [];
  for (const [k, inscrits] of cohortes) {
    const [promoS, filiere] = k.split('|'); const promo = +promoS;
    for (const vague of [6, 12]) {
      const r = enq.filter(e => e.promo === promo && e.filiere === filiere && e.vague === vague);
      if (!r.length && promo > an - 1) continue;
      const eff = liste.filter(l => l.promo === promo && norm(l.filiere || '').trim() === norm(filiere).trim()).length || null;
      const ep = r.filter(enPoste).length, etu = r.filter(e => e.situation === 'etudes').length;
      rows.push({
        promo, filiere, vague, effectif: eff, inscrits, repondants: r.length, en_poste: ep, recherche: r.filter(e => e.situation === 'recherche').length, etudes: etu,
        etranger: r.filter(e => enPoste(e) && e.pays && norm(e.pays).trim() !== 'maroc').length,
        taux_insertion: r.length - etu > 0 ? Math.round(ep / (r.length - etu) * 1000) / 1000 : null,
        taux_reponse: (eff || inscrits) ? Math.round(r.length / (eff || inscrits) * 1000) / 1000 : null,
        delai_median: mediane(r.map(e => e.delai_mois).filter(x => x != null)), satisfaction: moy(r.map(e => e.satisfaction).filter(x => x != null)),
        lien_formation: moy(r.map(e => e.lien_formation).filter(x => x != null)),
      });
    }
  }
  return rows.sort((a, b) => b.promo - a.promo || a.filiere.localeCompare(b.filiere) || a.vague - b.vague);
}

export const TYPES_EVENEMENT = { forum: ['Forum', 'briefcase'], conference: ['Conférence', 'mentor'], portes_ouvertes: ['Portes ouvertes', 'home'], atelier: ['Atelier', 'wrench'], soutenance: ['Soutenances', 'cap'], autre: ['Événement', 'calendar'] };

// ---------------------------------------------------------------------------
// Messagerie : mêmes règles que peut_discuter() dans la base. On s'écrit quand un lien existe
// déjà (mentorat, relecture de CV, candidature, parrainage, coordonnées acceptées), quand l'autre
// a écrit en premier, ou avec l'administration. Un blocage, dans un sens ou dans l'autre, ferme tout.
// ---------------------------------------------------------------------------
const entre = (x, a, b, k1, k2) => (x[k1] === a && x[k2] === b) || (x[k1] === b && x[k2] === a);
export const bloque = (data, a, b) => (data.blocages || []).some(x => entre(x, a, b, 'user_id', 'bloque_id'));

// Ce qui relie deux membres, du plus utile au plus général : sert de sous-titre à la conversation
export function lienAvec(data, me, autre, profil = () => null) {
  if (!me || !autre || me.id === autre) return null;
  const m = data.mentorships.filter(x => x.mentor_id && ['demande', 'acceptee', 'terminee'].includes(x.status) && entre(x, me.id, autre, 'student_id', 'mentor_id'))
    .sort((a, b) => (a.status === 'acceptee' ? 0 : 1) - (b.status === 'acceptee' ? 0 : 1) || new Date(b.created_at) - new Date(a.created_at))[0];
  if (m) return { type: 'mentorat', label: 'Mentorat', detail: m.sujet, m };
  // Une aide proposée (ou acceptée) sur une demande ouvre la conversation entre l'étudiant et le lauréat
  for (const x of data.propositions || []) {
    if (!['envoyee', 'acceptee'].includes(x.status) || !(x.laureat_id === me.id || x.laureat_id === autre)) continue;
    const d = (data.demandes || []).find(y => y.id === x.demande_id);
    if (d && entre({ a: d.auteur_id, b: x.laureat_id }, me.id, autre, 'a', 'b')) return { type: 'demande', label: x.status === 'acceptee' ? 'Match' : 'Demande', detail: d.titre, demande: d.id };
  }
  const r = (data.relectures_cv || []).find(x => x.reviewer_id && x.status !== 'annulee' && entre(x, me.id, autre, 'student_id', 'reviewer_id'));
  if (r) return { type: 'relecture', label: 'Relecture de CV' };
  for (const a of data.applications) {
    if (!a.offer_id || !(a.student_id === me.id || a.student_id === autre)) continue;
    const o = data.offers.find(x => x.id === a.offer_id);
    if (o && ((a.student_id === autre && o.author_id === me.id) || (a.student_id === me.id && o.author_id === autre))) return { type: 'candidature', label: 'Candidature', detail: o.titre, offer: o.id };
  }
  if ((data.parrainages || []).some(x => entre(x, me.id, autre, 'parrain_id', 'filleul_id'))) return { type: 'parrainage', label: 'Parrainage' };
  if ((data.demandes_contact || []).some(d => d.status === 'acceptee' && entre(d, me.id, autre, 'demandeur_id', 'cible_id'))) return { type: 'contact', label: 'Contact accepté' };
  // Sans lien particulier, pas d'étiquette : l'écran dit alors qui est la personne (jamais « Administration »)
  if (me.role === 'admin' || profil(autre)?.role === 'admin') return { type: 'admin', label: null };
  if ((data.messages || []).some(x => x.author_id === autre && x.dest_id === me.id)) return { type: 'message', label: null };
  return null;
}
export function peutDiscuter(data, me, autre, profil = () => null) {
  if (!me || !autre || me.id === autre || bloque(data, me.id, autre) || !profil(autre)) return false;
  if (me.role === 'admin') return true;
  const l = lienAvec(data, me, autre, profil);
  // On répond à l'administration, mais on ne lui écrit pas en premier
  return !!l && (l.type !== 'admin' || (data.messages || []).some(x => x.author_id === autre && x.dest_id === me.id));
}

// Conversations de « me », la plus récente d'abord : l'autre personne, ses messages (du plus ancien au plus récent), les non lus
export function conversations(data, meId) {
  const g = new Map();
  for (const m of data.messages || []) {
    if (m.author_id !== meId && m.dest_id !== meId) continue;
    const autre = m.author_id === meId ? m.dest_id : m.author_id;
    if (!g.has(autre)) g.set(autre, []);
    g.get(autre).push(m);
  }
  return [...g.entries()].map(([autre, ms]) => {
    ms.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return { autre, messages: ms, dernier: ms[ms.length - 1], nonLus: ms.filter(m => m.dest_id === meId && !m.lu_at).length };
  }).sort((a, b) => new Date(b.dernier.created_at) - new Date(a.dernier.created_at));
}
export const nonLus = (data, meId) => (data.messages || []).filter(m => m.dest_id === meId && !m.lu_at).length;

// ---------------------------------------------------------------------------
// « Cette semaine dans le réseau » : qui a aidé qui ces 7 derniers jours (sinon 30). Même calcul que pouls_reseau() dans la base.
// Une aide : rendez-vous de mentorat terminé (merci de l'étudiant ou « C'est fait » du lauréat ; un rendez-vous seulement passé a pu ne pas avoir lieu),
// relecture rendue, recrutement confirmé par l'étudiant, proposition acceptée par l'étudiant.
// Toujours d'un lauréat vers un étudiant qui ont un profil. Pas de classement : l'ordre est celui de l'aide la plus récente.
// ---------------------------------------------------------------------------
export function poulsReseau(data, now = new Date()) {
  const role = new Map((data.profiles || []).map(p => [p.id, p.role]));
  const ok = (l, s) => !!l && !!s && role.get(l) === 'laureat' && role.get(s) === 'etudiant';
  const brut = [];
  for (const m of data.mentorships || []) { if (m.status === 'terminee' && ok(m.mentor_id, m.student_id)) brut.push([m.mentor_id, m.student_id, m.rdv_at || m.accepted_at, 'rdv']); }
  for (const r of data.relectures_cv || []) if (r.status === 'rendue' && ok(r.reviewer_id, r.student_id)) brut.push([r.reviewer_id, r.student_id, r.rendue_at, 'cv']);
  for (const p of data.placements || []) if (p.status === 'confirme' && ok(p.laureat_id, p.student_id)) brut.push([p.laureat_id, p.student_id, p.confirmed_at, 'recrute']);
  const auteur = new Map((data.demandes || []).map(d => [d.id, d.auteur_id]));
  for (const x of data.propositions || []) if (x.status === 'acceptee' && ok(x.laureat_id, auteur.get(x.demande_id))) brut.push([x.laureat_id, auteur.get(x.demande_id), x.repondu_at, 'match']);
  const calc = jours => {
    const fin = now.getTime(), debut = fin - jours * 864e5;
    const aidants = new Map(), aides = new Set(); let recrutes = 0;
    for (const [l, s, at, k] of brut) { const t = at ? new Date(at).getTime() : NaN; if (!(t >= debut && t <= fin)) continue; aidants.set(l, Math.max(aidants.get(l) || 0, t)); aides.add(s); if (k === 'recrute') recrutes++; }
    const ids = [...aidants.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    return { jours, aidants: ids, nbAidants: ids.length, nbAides: aides.size, recrutes };
  };
  const semaine = calc(7);
  return semaine.nbAidants >= 2 ? semaine : calc(30);
}
// À froid : combien de lauréats sont là (le même total pour tout le monde) et combien me ressemblent (moi exclu).
// « cle » = le filtre de l'annuaire qui montre exactement ces personnes.
export function presenceReseau(data, me, { visages: nbVisages = 3 } = {}) {
  const tous = (data.profiles || []).filter(p => p.role === 'laureat');
  const lau = tous.filter(p => p.id !== me?.id);
  if (!me || !lau.length) return null;
  let cle = null, proches = [];
  const garde = (k, f) => { if (cle) return; const x = lau.filter(f); if (x.length) { cle = k; proches = x; } };
  if (me.role === 'laureat' && me.promo) garde('promo', p => p.promo === me.promo);
  if (me.role === 'etudiant') {
    if (filiereInfo(me.filiere)) garde('filiere', p => filtreFiliere(me.filiere, p.filiere));
    const c = parcoursOf(me.filiere)[0];
    if (c) garde('parcours', p => filtreFiliere('parcours:' + c, p.filiere));
  }
  const visages = (proches.length ? proches : lau).slice()
    .sort((a, b) => (b.photo_path ? 1 : 0) - (a.photo_path ? 1 : 0) || String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, nbVisages).map(p => p.id);
  return { total: tous.length, proches: proches.length, cle, visages };
}
// L'accueil juste après l'inscription : des chiffres vrais (les mêmes que l'accueil), des visages, rien d'inventé
export function accueilArrivee(data, me) {
  if (!me || !['laureat', 'etudiant'].includes(me.role)) return null;
  const presence = presenceReseau(data, me, { visages: 5 });
  const rang = rangLaureat(data.profiles, me);
  return { role: me.role, rang, fondateur: !!rang && rang <= NB_FONDATEURS, presence, visages: presence?.visages || [] };
}
// Une seule phrase par cas (la version arabe la reconnaît en entier)
export function phrasesArrivee(a) {
  if (!a) return null;
  const pr = a.presence;
  const groupe = pr && pr.proches ? lignePresence({ total: pr.proches, proches: pr.proches, cle: pr.cle }) : null;
  if (a.role === 'laureat' && a.rang) {
    return { titre: a.rang === 1 ? 'Le réseau des lauréats commence avec toi' : `Te voilà ${a.rang}e lauréat(e) du réseau`, sous: pr?.cle === 'promo' ? groupe : null };
  }
  if (!pr) return { titre: 'Bienvenue dans le réseau !', sous: null };
  return { titre: groupe || lignePresence({ total: pr.total, proches: 0, cle: null }), sous: null };
}
const DE_PRES = { filiere: 'de ta filière', parcours: 'de ton parcours', promo: 'de ta promo' };
// Une seule phrase par cas : la version arabe la reconnaît en entier
export function lignePresence({ total: t, proches: n, cle }) {
  const de = DE_PRES[cle];
  if (de && n === t) return t > 1 ? `${t} lauréats ${de} sont déjà là` : `1 lauréat ${de} est déjà là`;
  const base = t > 1 ? `${t} lauréats sont déjà là` : '1 lauréat est déjà là';
  return de && n ? `${base}, dont ${n} ${de}` : base;
}
export const lignePouls = p => `${p.nbAidants > 1 ? `${p.nbAidants} lauréats ont aidé` : '1 lauréat a aidé'} ${p.nbAides > 1 ? `${p.nbAides} étudiants` : '1 étudiant'}`;

// ---------------------------------------------------------------------------
// Demandes des étudiants : mêmes règles que types_demande(), demande_pour() et protect_demande() dans la base.
// L'étudiant dit ce qu'il cherche (CV joint), des lauréats proposent leur aide, il en accepte une : c'est un match.
// Le lauréat déclare le démarrage, l'étudiant confirme : la demande est pourvue et la réussite annoncée.
// ---------------------------------------------------------------------------
export const DEMANDES_MAX = 2;
export const DEMANDE_PAUSE_JOURS = 60;
// Types qu'un membre peut demander : 3A/4A stage ou étranger ; 5A PFE, étranger ou emploi ;
// jeune diplômé, ou lauréat qui cherche un emploi : emploi
export function typesDemande(me, saison) {
  if (!me) return [];
  if (me.role === 'laureat') return me.en_recherche ? ['emploi'] : [];
  if (me.role !== 'etudiant') return [];
  const n = niveauOf(me, saison);
  return n === 3 || n === 4 ? ['stage', 'etranger'] : n === 5 ? ['pfe', 'etranger', 'emploi'] : n >= 6 ? ['emploi'] : [];
}
// Ce que le lauréat propose, et comment on l'annonce une fois la réussite confirmée
export const AIDES = {
  recrute: { label: 'Je le/la recrute dans mon équipe', court: 'Recrute', icon: 'briefcase', annonce: 'grâce à' },
  encadre: { label: 'J’encadre son stage ou son PFE', court: 'Encadre', icon: 'cap', annonce: 'encadré(e) par' },
  recommande: { label: 'Je le/la recommande dans mon entreprise', court: 'Recommande', icon: 'send', annonce: 'recommandé(e) par' },
};
export const demandesActives = (data, uid) => (data.demandes || []).filter(d => d.auteur_id === uid && ['ouverte', 'match'].includes(d.status));
// Une demande ouverte sans nouvelle depuis 60 jours se met en pause : l'étudiant la relance d'un geste
export const demandeEnPause = (d, now = Date.now()) => d.status === 'ouverte' && now - new Date(d.relancee_at || d.created_at).getTime() > DEMANDE_PAUSE_JOURS * 864e5;
// Demandes ouvertes qu'un lauréat peut prendre : son parcours d'abord, les plus anciennes sans réponse ensuite
export function demandesPour(data, me, byId, now = Date.now()) {
  if (me?.role !== 'laureat') return [];
  return (data.demandes || [])
    .filter(d => d.status === 'ouverte' && d.auteur_id !== me.id && !demandeEnPause(d, now) && !bloque(data, me.id, d.auteur_id))
    .map(d => {
      // Un lauréat ne voit que ses propres aides (pas celles des autres) : le tri n'en dépend pas
      const a = byId(d.auteur_id); const prox = proximiteFiliere(me.filiere, a?.filiere);
      const why = [prox === 2 ? 'Même filière' : prox === 1 ? 'Même parcours' : null, d.type === 'etranger' && me.pays && me.pays !== 'Maroc' ? `Tu es en ${me.pays}` : null].filter(Boolean);
      return { d, a, prox, why, mienne: (data.propositions || []).find(x => x.demande_id === d.id && x.laureat_id === me.id) || null, score: prox * 3 + Math.min(3, Math.floor((now - new Date(d.created_at)) / 864e5)) };
    })
    .sort((x, y) => y.score - x.score || new Date(y.d.created_at) - new Date(x.d.created_at));
}
// Ce qu'un lauréat peut faire sur une demande (mêmes règles que protect_proposition, plus la pause et le match)
export const AIDE_OUVERTE = ['proposer', 'reproposer', 'modifier'];
export function etatAide(data, me, d, now = Date.now()) {
  if (me?.role !== 'laureat') return 'non';
  if (!d) return 'fermee';
  if (d.auteur_id === me.id || bloque(data, me.id, d.auteur_id)) return 'non';
  const x = (data.propositions || []).find(p => p.demande_id === d.id && p.laureat_id === me.id);
  if (x?.status === 'acceptee') return 'non';
  if (d.status !== 'ouverte') return 'fermee';
  if (x?.status === 'envoyee') return 'modifier';
  if (x && x.status !== 'retiree') return 'non';
  if (demandeEnPause(d, now)) return 'pause';
  return x ? 'reproposer' : 'proposer';
}

// ---------------------------------------------------------------------------
// Accueil : ce qui est dit une seule fois, au bon endroit
// ---------------------------------------------------------------------------
// Annonces de l'administration : un public, comme les événements de l'agenda ; chacun ne voit que la sienne, 14 jours au plus
export const PUBLICS = [['tous', 'Tout le monde'], ['etudiants', 'Étudiants'], ['laureats', 'Lauréats']];
export const pourPublic = (pub, role) => role === 'admin' || !pub || pub === 'tous' || (pub === 'etudiants' && role === 'etudiant') || (pub === 'laureats' && role === 'laureat');
export const ANNONCE_JOURS = 14;
export const annonceVisible = (a, now = Date.now()) => !!a?.active && now - new Date(a.created_at).getTime() < ANNONCE_JOURS * 864e5;
export const annoncePour = (annonces, me, now = Date.now()) => (annonces || []).filter(a => annonceVisible(a, now) && pourPublic(a.public, me?.role))
  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;

// « Cette semaine » : trois petites choses au plus que seul le membre peut boucler.
// Jamais ce que montre la carte du haut ; pas les demandes d'aide (md, rd, qr : « Ils ont besoin de toi »),
// ni les coordonnées (dc : leur carte), ni le recrutement à confirmer (pa : la carte), ni les rappels de rendez-vous (rdv).
// Une présence à confirmer (sc) y vient tant que le rendez-vous est loin ; la veille, elle passe sur la carte.
export const TACHES = { dp: 0, ap: 0, dm: 0, rc: 0, sc: 1, in: 1, sg: 1, sf: 2, rr: 2, pm: 2, mf: 2, ev: 3, dr: 4, ro: 4, eq: 5 };
export function petitesTaches(notifs, pas = {}) {
  const deja = new Set([pas.key, ...(pas.cles || [])].filter(Boolean));
  return notifs.filter(n => n.action && !n.rdv && TACHES[(n.key || '').slice(0, 2)] !== undefined && !deja.has(n.key) && !(pas.ref && n.ref === pas.ref))
    .map(n => ({ ...n, rang: TACHES[n.key.slice(0, 2)] }))
    .sort((a, b) => a.rang - b.rang || new Date(b.at) - new Date(a.at)).slice(0, 3);
}

// « Ils ont besoin de toi » : ce que des étudiants attendent de ce lauréat. Ceux qui l'ont choisi d'abord, puis une sorte après l'autre.
const BESOIN_ORDRE = ['question', 'demande', 'conseil', 'cv'];
export function besoinsDeMoi(data, me, byId, { ignorees = new Set(), exclure = new Set(), now = Date.now() } = {}) {
  if (me?.role !== 'laureat') return [];
  const out = [];
  for (const x of requestsFor(data, me, byId, new Date(now))) if (x.direct || (x.score >= 2 && !ignorees.has(x.m.id)))
    out.push({ kind: 'conseil', id: x.m.id, who: x.m.student_id, sujet: x.m.sujet, direct: x.direct, at: x.m.created_at });
  (data.relectures_cv || []).filter(r => r.status === 'demandee' && r.student_id !== me.id && (r.reviewer_id === me.id || !r.reviewer_id))
    .map(r => ({ r, prox: proximiteFiliere(byId(r.student_id)?.filiere, me.filiere) }))
    .sort((a, b) => b.prox - a.prox || new Date(a.r.created_at) - new Date(b.r.created_at))
    .forEach(({ r }) => out.push({ kind: 'cv', id: r.id, who: r.student_id, sujet: r.message || '', direct: r.reviewer_id === me.id, at: r.created_at }));
  for (const x of demandesPour(data, me, byId, now)) if (!x.mienne && x.prox >= 1)
    out.push({ kind: 'demande', id: x.d.id, who: x.d.auteur_id, sujet: x.d.titre, type: x.d.type, direct: false, at: x.d.created_at });
  (data.questions || []).filter(q => routedTo(q, me) && now - new Date(q.created_at) < 14 * 864e5 && !(data.answers || []).some(a => a.question_id === q.id && a.author_id === me.id))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .forEach(q => out.push({ kind: 'question', id: q.id, who: q.author_id, sujet: q.titre, cible: q.entreprise || q.pays, direct: false, at: q.created_at }));
  const reste = out.filter(b => !exclure.has(b.id));
  const directs = reste.filter(b => b.direct).sort((a, b) => new Date(a.at) - new Date(b.at));
  const files = BESOIN_ORDRE.map(k => reste.filter(b => !b.direct && b.kind === k));
  const tour = []; for (let i = 0; files.some(f => f[i]); i++) for (const f of files) if (f[i]) tour.push(f[i]);
  return [...directs, ...tour];
}

// Carte « Besoin d'un coup de main ? » (étudiant) : une porte en bouton, deux au plus en liens, une ligne sur ce qui est en route
export function coupDeMain(data, me, saison, { exclure = new Set(), cle = null } = {}) {
  if (me?.role !== 'etudiant') return { principal: null, autres: [], suivi: null };
  const actives = demandesActives(data, me.id).sort((a, b) => (b.status === 'match') - (a.status === 'match') || new Date(b.created_at) - new Date(a.created_at));
  const attente = data.mentorships.find(m => m.student_id === me.id && m.status === 'demande');
  const rel = (data.relectures_cv || []).filter(r => r.student_id === me.id);
  const relEnRoute = rel.some(r => ['demandee', 'en_cours'].includes(r.status) || (r.status === 'rendue' && !r.merci && !r.note));
  const portes = [typesDemande(me, saison).length && !actives.length && cle !== 'demande' ? 'demande' : null,
    !attente && cle !== 'conseil' ? 'conseil' : null, me.cv_path && !relEnRoute ? 'cv' : null].filter(Boolean);
  const enCours = rel.find(r => r.status === 'en_cours');
  const suivi = [actives[0] && { kind: 'demande', id: actives[0].id }, enCours && { kind: 'cv', id: enCours.id }, attente && { kind: 'conseil', id: attente.id }]
    .find(x => x && !exclure.has(x.id)) || null;
  return { principal: portes[0] || null, autres: portes.slice(1, 3), suivi };
}

// Publier : champs obligatoires encore vides, dans l'ordre de l'écran. Mêmes règles que la base
// (offres : titre de 4 caractères au moins, entreprise et description non vides ; demandes : titre 4, détails 20, CV exigé)
export function manquesOffre(f) {
  return [(f.titre || '').trim().length < 4 && 'titre', !(f.entreprise || '').trim() && 'entreprise',
    !(f.description || '').trim() && 'description', f.audience !== 'laureats' && !(f.annees || []).length && 'annees'].filter(Boolean);
}
export function manquesDemande(f, me) {
  return [(f.titre || '').trim().length < 4 && 'titre', (f.details || '').trim().length < 20 && 'details', !me?.cv_path && 'cv'].filter(Boolean);
}

// « Me prévenir » : après une action qui attend une réponse, une feuille propose les notifications sur cet appareil.
// etat : celui des notifications ici (… | demo | absent | ios | refuse | off | on) ; memo : ce que cet appareil a déjà
// répondu ({ n refus, at dernier refus, fait, mail }). Deux refus au plus, 14 jours entre les deux ; la variante email
// (navigateur sans notifications) une seule fois, et seulement si un email part vraiment.
export const PREVENIR_ECART = 14 * 864e5;
export function prevenirVariante({ etat, raison, memo = {}, now = Date.now(), role, emailsMessages, emailsHebdo }) {
  if (role === 'admin' || memo.fait || etat === 'on' || etat === '…' || etat === 'demo') return null;
  if (etat === 'off' || etat === 'ios') {
    if ((memo.n || 0) >= 2 || (memo.at && now - memo.at < PREVENIR_ECART)) return null;
    return etat === 'off' ? 'push' : 'ios';
  }
  if (memo.mail) return null;
  if (raison === 'demande' && emailsMessages) return 'email';   // chaque proposition arrive en message, un email suit si elle reste non lue
  if (raison === 'question' && emailsHebdo) return 'email';     // les réponses figurent dans le résumé de la semaine
  return null;
}
