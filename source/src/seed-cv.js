// CV de démonstration (données fictives) : une vraie page de CV, comme celles des meilleurs élèves ingénieurs de l'école,
// tirée du profil (filière, année, promo, ville, compétences, recherche en cours) et variée d'une personne à l'autre
// (graine = son identifiant). Bandeau bleu nuit (cercle d'initiales, nom, titre, objectif, coordonnées fictives), colonne
// latérale (compétences et niveaux, logiciels, langues, certifications, centres d'intérêt), colonne principale (profil,
// formation, expériences aux résultats chiffrés, projets, vie associative). Entreprises inventées, jamais une vraie.
// Le PDF est écrit à la main (pdfUnePage, store.js) : Helvetica et Helvetica gras, codage WinAnsi, largeurs réelles des
// glyphes pour couper les lignes ; si la page déborde, les détails les moins utiles partent d'abord. Le texte est écrit dans
// l'ordre de lecture (en-tête, colonne principale, colonne latérale) : relu par lire-cv.js (contrôle du profil,
// administration), il redonne le rôle, la promo et la filière du profil. Chargé seulement en démo (lienCV, store.js).
import { codeWinAnsi, echapPdf, pdfUnePage } from './store.js';
import { seasonOf, niveauOf, initials, filiereInfo, PREPA } from './logic.js';

// ---------------------------------------------------------------------------
// Mesure du texte : largeurs des glyphes Helvetica et Helvetica-Bold (AFM d'Adobe), en millièmes de la taille,
// codes WinAnsi 32 à 126 puis 128 à 255
// ---------------------------------------------------------------------------
const R_ASCII = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667,
  944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500,
  278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const G_ASCII = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667,
  944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556,
  333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
const R_HAUT = [556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, 0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667,
  278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, 556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500];
const G_HAUT = [556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, 0, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 667,
  278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, 611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556];
const glyphe = (k, gras) => (k < 32 ? 278 : k < 127 ? (gras ? G_ASCII : R_ASCII)[k - 32] : k >= 128 ? (gras ? G_HAUT : R_HAUT)[k - 128] || 278 : 278);
// Largeur d'un texte en points ; espace : l'espacement des lettres (Tc), compté entre les lettres
export function mesure(t, gras = false, taille = 10, espace = 0) {
  const s = Array.from(String(t)); let m = 0;
  for (const c of s) m += glyphe(codeWinAnsi(c), gras);
  return (m * taille) / 1000 + espace * Math.max(0, s.length - 1);
}
// Les lignes d'un texte dans une largeur donnée (coupé aux espaces ; une espace insécable ne coupe pas)
export function couper(t, max, gras = false, taille = 10) {
  const lignes = []; let l = '';
  for (const mot of String(t).trim().split(/ +/)) {
    const essai = l ? l + ' ' + mot : mot;
    if (l && mesure(essai, gras, taille) > max) { lignes.push(l); l = mot; } else l = essai;
  }
  if (l) lignes.push(l);
  // Un mot plus long que la ligne (rare) : coupé là où il faut
  return lignes.flatMap(x => {
    if (mesure(x, gras, taille) <= max) return [x];
    const out = []; let b = '';
    for (const c of x) { if (b && mesure(b + c, gras, taille) > max) { out.push(b); b = c; } else b += c; }
    return b ? [...out, b] : out;
  });
}

// ---------------------------------------------------------------------------
// La page : le fond (formes), le texte dans l'ordre de lecture, puis le texte posé sur les formes (initiales, « in »)
// ---------------------------------------------------------------------------
const W = 595, H = 842;
const n2 = v => String(Math.round(v * 100) / 100);
const rvb = h => [1, 3, 5].map(i => +(parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
const K = 0.5523;   // arc de cercle en Bézier
class Page {
  constructor() { this.fond = []; this.texte = []; this.dessus = []; }
  rect(x, y, w, h, c) { this.fond.push(`${rvb(c)} rg ${n2(x)} ${n2(y)} ${n2(w)} ${n2(h)} re f`); }
  arrondi(x, y, w, h, r, c, trait = 0) {
    r = Math.min(r, w / 2, h / 2); const k = K * r;
    const p = [`${n2(x + r)} ${n2(y)} m`, `${n2(x + w - r)} ${n2(y)} l`, `${n2(x + w - r + k)} ${n2(y)} ${n2(x + w)} ${n2(y + r - k)} ${n2(x + w)} ${n2(y + r)} c`,
      `${n2(x + w)} ${n2(y + h - r)} l`, `${n2(x + w)} ${n2(y + h - r + k)} ${n2(x + w - r + k)} ${n2(y + h)} ${n2(x + w - r)} ${n2(y + h)} c`,
      `${n2(x + r)} ${n2(y + h)} l`, `${n2(x + r - k)} ${n2(y + h)} ${n2(x)} ${n2(y + h - r + k)} ${n2(x)} ${n2(y + h - r)} c`,
      `${n2(x)} ${n2(y + r)} l`, `${n2(x)} ${n2(y + r - k)} ${n2(x + r - k)} ${n2(y)} ${n2(x + r)} ${n2(y)} c`, 'h'].join(' ');
    this.fond.push(trait ? `${rvb(c)} RG ${n2(trait)} w ${p} S` : `${rvb(c)} rg ${p} f`);
  }
  cercle(cx, cy, r, c, trait = 0) {
    const k = K * r;
    const p = [`${n2(cx + r)} ${n2(cy)} m`, `${n2(cx + r)} ${n2(cy + k)} ${n2(cx + k)} ${n2(cy + r)} ${n2(cx)} ${n2(cy + r)} c`,
      `${n2(cx - k)} ${n2(cy + r)} ${n2(cx - r)} ${n2(cy + k)} ${n2(cx - r)} ${n2(cy)} c`, `${n2(cx - r)} ${n2(cy - k)} ${n2(cx - k)} ${n2(cy - r)} ${n2(cx)} ${n2(cy - r)} c`,
      `${n2(cx + k)} ${n2(cy - r)} ${n2(cx + r)} ${n2(cy - k)} ${n2(cx + r)} ${n2(cy)} c`, 'h'].join(' ');
    this.fond.push(trait ? `${rvb(c)} RG ${n2(trait)} w ${p} S` : `${rvb(c)} rg ${p} f`);
  }
  ligne(x1, y1, x2, y2, c, ep = 0.6) { this.fond.push(`${rvb(c)} RG ${n2(ep)} w 1 J ${n2(x1)} ${n2(y1)} m ${n2(x2)} ${n2(y2)} l S`); }
  chemin(p, c, trait = 0) { this.fond.push(trait ? `${rvb(c)} RG ${n2(trait)} w 1 J 1 j ${p} S` : `${rvb(c)} rg ${p} f`); }
  // Les formes suivantes restent dans ce rectangle (décor du bandeau)
  dans(x, y, w, h, dessin) { this.fond.push(`q ${n2(x)} ${n2(y)} ${n2(w)} ${n2(h)} re W n`); dessin(); this.fond.push('Q'); }
  // Un texte ; align : début (gauche), fin (droite) ou centre ; renvoie sa largeur
  ecrire(t, x, y, { gras = false, taille = 9, c = '#16233A', espace = 0, align = 'g', ou = 'texte' } = {}) {
    const w = mesure(t, gras, taille, espace);
    const x0 = align === 'd' ? x - w : align === 'c' ? x - w / 2 : x;
    this[ou].push(`BT /${gras ? 'F2' : 'F1'} ${n2(taille)} Tf ${n2(espace)} Tc ${rvb(c)} rg ${n2(x0)} ${n2(y)} Td (${echapPdf(t)}) Tj ET`);
    return w;
  }
  flux() { return [...this.fond, ...this.texte, ...this.dessus].join('\n'); }
}

// ---------------------------------------------------------------------------
// Le contenu : par filière (famille de métiers), varié par la graine de la personne
// ---------------------------------------------------------------------------
function alea(graine) {
  let h = 1779033703 ^ graine.length;
  for (let i = 0; i < graine.length; i++) { h = Math.imul(h ^ graine.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const melanger = (l, r) => { const a = [...l]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sansAccent = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Accords : « {passionné|passionnée} » selon la personne
const accorder = (t, f) => String(t).replace(/\{([^|}]*)\|([^}]*)\}/g, (m, a, b) => (f ? b : a));
const PRENOMS_F = new Set(['salma', 'imane', 'khadija', 'meryem', 'maryam', 'hiba', 'zineb', 'nour', 'kawtar', 'sara', 'chaimae', 'ghita', 'yasmine', 'fatima', 'douae',
  'rania', 'oumaima', 'wiam', 'asmae', 'lina', 'hajar', 'nadia', 'salima', 'soukaina', 'houda', 'loubna', 'siham', 'amal', 'ikram', 'aya', 'malak', 'hanane', 'najat',
  'widad', 'ilham', 'btissam', 'sanae', 'safae', 'noura', 'basma', 'amina', 'layla', 'leila', 'manal', 'rim', 'hind', 'jihane', 'kenza', 'nisrine', 'nada', 'dounia']);
const estFemme = p => PRENOMS_F.has(sansAccent(String(p?.full_name || '').split(/\s+/)[0]));
const ent = (nom, ville, secteur) => ({ nom, ville, secteur });
// Des entreprises inventées (aucune n'existe sous ce nom à notre connaissance), par secteur
const E = {
  cablage: ent('Câblerie Zénata', 'Casablanca', 'l’automobile'), faisceaux: ent('Faisceaux du Détroit', 'Tanger', 'l’automobile'),
  conserves: ent('Conserverie du Saïss', 'Meknès', 'l’agroalimentaire'), emballages: ent('Emballages du Tafilalet', 'Casablanca', 'l’emballage'),
  forges: ent('Forges de Bouskoura', 'Casablanca', 'la métallurgie'), fonderie: ent('Fonderie de l’Oriental', 'Oujda', 'la fonderie'),
  precision: ent('Mécanique de précision du Sebou', 'Kénitra', 'la mécanique de précision'), aero: ent('Aéroméca Nouaceur', 'Casablanca', 'l’aéronautique'),
  emboutissage: ent('Emboutissage du Gharb', 'Kénitra', 'l’automobile'), automatismes: ent('Automatismes du Sebou', 'Kénitra', 'l’automatisme industriel'),
  maintenance: ent('Maintenance industrielle du Saïss', 'Fès', 'la maintenance industrielle'), process: ent('Électro Process Tanger', 'Tanger', 'l’industrie 4.0'),
  solaire: ent('Noria Énergie Solaire', 'Marrakech', 'les énergies renouvelables'), froid: ent('Froid et Process du Souss', 'Agadir', 'le froid industriel'),
  data: ent('Ifrane Data Lab', 'Rabat', 'la data'), logiciels: ent('Logiciels du Souss', 'Agadir', 'le logiciel'), plateforme: ent('Bouregreg Numérique', 'Rabat', 'le numérique'),
  bet: ent('Oasis Structures', 'Marrakech', 'les bureaux d’études'), chantiers: ent('Chantiers du Bouregreg', 'Rabat', 'le BTP'), geo: ent('Géotechnique du Rif', 'Tétouan', 'la géotechnique'),
  charpente: ent('Charpentes métalliques de l’Oriental', 'Oujda', 'la construction métallique'), laiterie: ent('Laiterie des Zaërs', 'Rabat', 'l’agroalimentaire'),
};
const st = (poste, e, puces) => ({ poste, e, puces });
const pj = (titre, desc) => ({ titre, desc });
const FAMILLES = {
  gi: {
    metier: 'Génie Industriel',
    passions: ['{passionné|passionnée} par l’amélioration continue et la performance des lignes de production', '{attiré|attirée} par la supply chain, la planification et le pilotage par les données', '{tourné|tournée} vers le terrain : lean, résolution de problèmes et qualité'],
    domaines: ['lean et amélioration continue', 'supply chain et planification', 'qualité et excellence opérationnelle'],
    modules: 'Lean manufacturing, gestion de production, supply chain, qualité et Six Sigma, recherche opérationnelle',
    competences: ['Lean manufacturing', 'VSM', 'SMED', 'Six Sigma (DMAIC)', 'Gestion de production', 'Supply chain', 'Planification (MRP)', 'Kaizen et 5S', 'AMDEC', 'Analyse de données'],
    logiciels: ['Power BI', 'Excel (VBA)', 'Minitab', 'FlexSim', 'SAP (MM/PP)', 'Python', 'MS Project', 'Arena'],
    stages: [
      st('Stage ingénieur adjoint — amélioration continue', E.cablage, ['Cartographie VSM de la ligne d’assemblage : 3 gaspillages majeurs chiffrés et priorisés', 'Chantier SMED sur 2 presses : changement de série ramené de 52 à 34 min', 'Suivi du TRS sous Power BI : +6 points en 8 semaines sur la ligne pilote']),
      st('Stage ingénieur adjoint — supply chain', E.conserves, ['Analyse ABC/XYZ de 1 200 références et nouvelles règles de réapprovisionnement', 'Stock d’emballages réduit de 18 % sans rupture pendant la saison', 'Tableau de bord des ruptures partagé chaque semaine avec les achats']),
      st('Stage ingénieur adjoint — qualité', E.emboutissage, ['Résolution de problème en 8D sur un défaut d’aspect récurrent', 'Taux de rebut de la cellule ramené de 4,1 à 2,6 % en 6 semaines', 'Formation de 14 opérateurs aux nouveaux standards de contrôle']),
      st('Stage ingénieur adjoint — méthodes et production', E.emballages, ['Équilibrage de la ligne de conditionnement (Yamazumi) : cadence +12 %', 'Standards de travail rédigés pour 9 postes avec les chefs d’équipe', 'Audit 5S hebdomadaire mis en place et suivi par l’atelier']),
    ],
    ouvriers: [
      st('Stage ouvrier — ligne de conditionnement', E.conserves, ['Un mois en équipe de production, en 3x8, sur une ligne de conserves', 'Relevé des micro-arrêts : fiche de suivi reprise par le chef d’équipe']),
      st('Stage ouvrier — atelier d’assemblage', E.faisceaux, ['Un mois au poste d’assemblage de faisceaux électriques', 'Idée retenue : rangement des connecteurs par code couleur']),
      st('Stage technicien — magasin et logistique', E.emballages, ['Inventaire tournant de 400 références avec l’équipe du magasin', 'Emplacements corrigés dans l’ERP : écarts de stock en baisse']),
    ],
    projets: [pj('Simulation des flux d’un atelier (FlexSim)', 'Trois scénarios comparés ; celui retenu réduit l’attente des pièces de 22 %.'), pj('Chantier 5S au FabLab de l’école', 'Audit, plan d’actions et suivi sur 6 semaines avec une équipe de 5 élèves.'),
      pj('Tableau de bord qualité sous Power BI', 'Indicateurs de non-qualité d’une PME partenaire, mis à jour automatiquement.')],
    certifs: ['Lean Six Sigma — Yellow Belt', 'Gestion de projet agile (Scrum)', 'Excel avancé et VBA'],
  },
  ge: {
    metier: 'Génie Électromécanique',
    passions: ['{passionné|passionnée} par l’automatisme, la supervision et l’industrie 4.0', '{attiré|attirée} par la maintenance et la fiabilité des équipements', '{curieux|curieuse} de tout ce qui relie l’électrotechnique au numérique'],
    domaines: ['automatismes et digitalisation industrielle', 'maintenance et fiabilité', 'industrie 4.0'],
    modules: 'Automatismes et API, électrotechnique, maintenance industrielle, régulation, réseaux industriels',
    competences: ['Automatismes (API)', 'Supervision SCADA', 'Maintenance préventive', 'AMDEC', 'Régulation PID', 'Électrotechnique', 'Variateurs de vitesse', 'IoT industriel', 'GMAO', 'Analyse vibratoire'],
    logiciels: ['TIA Portal', 'WinCC', 'EPLAN', 'Matlab/Simulink', 'Node-RED', 'Python', 'Factory I/O', 'SolidWorks'],
    stages: [
      st('Stage ingénieur adjoint — automatismes', E.automatismes, ['Migration d’un poste de dosage vers un automate S7-1200 et TIA Portal', 'Supervision WinCC : 18 alarmes regroupées par priorité', 'Temps d’arrêt du poste réduit de 27 % sur le mois de suivi']),
      st('Stage ingénieur adjoint — maintenance', E.maintenance, ['AMDEC de 3 équipements critiques et plan de maintenance préventive', 'Pannes du convoyeur principal divisées par 2 en 2 mois', 'Fiches d’intervention standard adoptées par l’équipe']),
      st('Stage ingénieur adjoint — industrie 4.0', E.process, ['Capteurs de vibration reliés à un tableau de bord Node-RED (MQTT)', 'Deux défauts de moteur détectés avant la panne pendant le stage', 'Note de déploiement chiffrée pour 12 machines']),
    ],
    ouvriers: [
      st('Stage ouvrier — maintenance électrique', E.conserves, ['Un mois aux côtés des électriciens de maintenance, en 2x8', 'Schémas de 4 armoires électriques remis à jour']),
      st('Stage technicien — câblage d’armoires', E.automatismes, ['Câblage et tests de 3 armoires de commande', 'Contrôle des borniers selon les plans EPLAN']),
    ],
    projets: [pj('Bras robotisé de tri par couleur', 'Capteur de couleur, Arduino et automate pédagogique ; 95 % des pièces bien triées.'), pj('Supervision d’une station de pompage', 'Grafcet, programme TIA Portal et écrans WinCC testés sur Factory I/O.'),
      pj('Banc de mesure de vibrations', 'Accéléromètre, carte ESP32 et analyse fréquentielle sous Python.')],
    certifs: ['Habilitation électrique B1V-BR', 'Automates programmables — niveau 1', 'Sécurité des machines'],
  },
  gm: {
    metier: 'Génie Mécanique',
    passions: ['{passionné|passionnée} par la conception mécanique et le calcul de structures', '{attiré|attirée} par l’industrialisation de produits mécaniques', '{curieux|curieuse} du lien entre bureau d’études et atelier'],
    domaines: ['conception et industrialisation', 'calcul de structures', 'bureau d’études mécanique'],
    modules: 'Conception mécanique, RDM, éléments finis, fabrication, industrialisation',
    competences: ['Conception mécanique', 'RDM', 'Éléments finis', 'Cotation GPS', 'Dimensionnement', 'Industrialisation', 'Analyse fonctionnelle', 'DFMA', 'Prototypage 3D'],
    logiciels: ['CATIA V5', 'SolidWorks', 'Ansys', 'Abaqus', 'Creo', 'Matlab', 'AutoCAD', 'Python'],
    stages: [
      st('Stage ingénieur adjoint — bureau d’études', E.aero, ['Reconception d’une bride d’outillage sous CATIA V5 : masse réduite de 22 %', 'Vérification par éléments finis (Ansys) : coefficient de sécurité de 2,4', 'Plans cotés en GPS validés par le responsable du bureau d’études']),
      st('Stage ingénieur adjoint — industrialisation', E.precision, ['Gamme de fabrication d’un support usiné : temps de cycle −15 %', 'Montage d’usinage conçu sous SolidWorks, fabriqué en 3 semaines', 'Contrôle des 30 premières pièces : toutes conformes']),
      st('Stage ingénieur adjoint — calcul de structures', E.charpente, ['Note de calcul d’un portique de manutention de 5 tonnes', 'Optimisation des profilés : 9 % d’acier en moins', 'Plans d’ensemble transmis à l’atelier de fabrication']),
    ],
    ouvriers: [
      st('Stage ouvrier — atelier d’usinage', E.precision, ['Un mois sur tour et fraiseuse conventionnels, puis en commande numérique', 'Contrôle dimensionnel des pièces au pied à coulisse et au micromètre']),
      st('Stage ouvrier — maintenance mécanique', E.forges, ['Démontage et remontage de réducteurs avec l’équipe de maintenance', 'Relevé des jeux et proposition d’un graissage planifié']),
    ],
    projets: [pj('Conception d’un réducteur pour convoyeur', 'Engrenages et roulements dimensionnés, maquette CATIA complète.'), pj('Optimisation topologique d’un support', 'Ansys : masse −30 % à rigidité égale, pièce imprimée en 3D.'),
      pj('Banc d’essai de flexion', 'Conception, fabrication et comparaison des mesures au calcul : écart de 6 %.')],
    certifs: ['SolidWorks — certification CSWA', 'Cotation fonctionnelle GPS', 'Sécurité en atelier'],
  },
  mat: {
    metier: 'Génie Mécanique',
    passions: ['{attiré|attirée} par les matériaux, les procédés de fabrication et la qualité', '{passionné|passionnée} par la mise en forme et la métallurgie', '{curieux|curieuse} des matériaux composites et du contrôle non destructif'],
    domaines: ['procédés de fabrication', 'matériaux et contrôle qualité', 'fonderie et mise en forme'],
    modules: 'Métallurgie, procédés de mise en forme, traitements thermiques, contrôle non destructif, composites',
    competences: ['Métallurgie', 'Traitements thermiques', 'Mise en forme', 'Soudage', 'CND (ultrasons)', 'Essais mécaniques', 'Plans d’expériences', 'Composites', 'Usinage CN'],
    logiciels: ['SolidWorks', 'Mastercam', 'Minitab', 'Ansys', 'ImageJ', 'Excel (VBA)', 'CATIA V5', 'Python'],
    stages: [
      st('Stage ingénieur adjoint — procédés', E.forges, ['Plan d’expériences sur la température de forgeage : 3 paramètres réglés', 'Fissures en sortie de forge réduites de 35 % en 5 semaines', 'Fiche de réglage adoptée par les 3 équipes']),
      st('Stage ingénieur adjoint — contrôle qualité', E.fonderie, ['Contrôle par ultrasons de 120 pièces moulées et analyse des défauts', 'Cause principale trouvée (retassures) : masselotte modifiée', 'Rebut de la fonderie ramené de 7,2 à 4,5 %']),
      st('Stage ingénieur adjoint — emboutissage', E.emboutissage, ['Analyse des plis sur une pièce emboutie et réglage du serre-flan', 'Pièces non conformes divisées par 3 sur la référence suivie', 'Fiche de lancement de série mise à jour avec le régleur']),
    ],
    ouvriers: [
      st('Stage ouvrier — fonderie', E.fonderie, ['Un mois au moulage et au parachèvement des pièces', 'Contrôle visuel et relevé des défauts par lot']),
      st('Stage ouvrier — atelier de soudage', E.charpente, ['Préparation des joints et soudage semi-automatique', 'Contrôle par ressuage avec le technicien qualité']),
    ],
    projets: [pj('Influence de la trempe sur un acier C45', 'Essais de dureté et de traction, micrographies et plan d’expériences.'), pj('Pièce composite en fibre de verre', 'Moulage au contact, essais de flexion trois points et rapport comparatif.'),
      pj('Recyclage de copeaux d’aluminium', 'Refonte au four de l’école et contrôle de la composition des lingots.')],
    certifs: ['Contrôle par ultrasons — niveau 1', 'Plans d’expériences', 'Sécurité en atelier'],
  },
  ener: {
    metier: 'Génie Mécanique et Énergétique',
    passions: ['{engagé|engagée} pour l’efficacité énergétique et les énergies renouvelables', '{passionné|passionnée} par la thermique et les systèmes énergétiques', '{attiré|attirée} par le solaire et la transition énergétique de l’industrie'],
    domaines: ['efficacité énergétique', 'énergies renouvelables', 'thermique industrielle'],
    modules: 'Thermique, mécanique des fluides, énergies renouvelables, froid et climatisation, audit énergétique',
    competences: ['Audit énergétique', 'Thermique industrielle', 'Mécanique des fluides', 'Solaire photovoltaïque', 'Froid et CVC', 'Récupération de chaleur', 'ISO 50001', 'Bilan énergétique'],
    logiciels: ['PVsyst', 'TRNSYS', 'EES', 'Ansys Fluent', 'Matlab', 'Excel (VBA)', 'RETScreen', 'AutoCAD'],
    stages: [
      st('Stage ingénieur adjoint — efficacité énergétique', E.conserves, ['Bilan vapeur de l’usine et cartographie des pertes thermiques', 'Calorifugeage de 140 m de réseau : 9 % de gaz en moins (estimé)', 'Plan d’actions chiffré présenté à la direction technique']),
      st('Stage ingénieur adjoint — solaire photovoltaïque', E.solaire, ['Centrale de 250 kWc en toiture dimensionnée sous PVsyst', 'Étude d’ombrage et choix des onduleurs : productible +4 %', 'Note technique remise au client avec le temps de retour']),
      st('Stage ingénieur adjoint — froid industriel', E.froid, ['Audit de 4 chambres froides : fuites et réglage des détendeurs', 'Consommation du froid réduite de 12 % sur le mois de suivi', 'Procédure de contrôle mensuel rédigée avec l’équipe']),
    ],
    ouvriers: [
      st('Stage ouvrier — chaufferie et utilités', E.laiterie, ['Un mois avec l’équipe des utilités : chaudières, air comprimé, eau glacée', 'Relevé quotidien des compteurs et premières courbes de consommation']),
      st('Stage ouvrier — installation solaire', E.solaire, ['Pose et câblage de panneaux sur deux toitures', 'Mesures de production comparées aux prévisions']),
    ],
    projets: [pj('Chauffe-eau solaire pour un internat', 'Dimensionnement sous TRNSYS : 68 % des besoins couverts par le solaire.'), pj('Audit énergétique d’un bâtiment de l’école', 'Relevés, bilan et 5 mesures chiffrées ; économie estimée de 15 %.'),
      pj('Simulation CFD d’un échangeur', 'Ansys Fluent : deux géométries d’ailettes comparées.')],
    certifs: ['Management de l’énergie (ISO 50001)', 'Photovoltaïque raccordé au réseau', 'Sécurité électrique'],
  },
  ia: {
    metier: 'IA et Technologies des Données',
    passions: ['{passionné|passionnée} par la data science et l’IA appliquées à l’industrie', '{attiré|attirée} par la vision par ordinateur et la maintenance prédictive', '{curieux|curieuse} de mettre les modèles en production, au service du terrain'],
    domaines: ['data science industrielle', 'vision par ordinateur', 'maintenance prédictive'],
    modules: 'Apprentissage automatique, deep learning, bases de données, statistiques, systèmes industriels',
    competences: ['Machine learning', 'Deep learning', 'Vision par ordinateur', 'Séries temporelles', 'Statistiques', 'MLOps', 'Data visualisation', 'Bases de données'],
    logiciels: ['Python', 'PyTorch', 'scikit-learn', 'OpenCV', 'SQL', 'Power BI', 'Docker', 'Git'],
    stages: [
      st('Stage ingénieur adjoint — data science', E.data, ['Prévision de la demande par gradient boosting : erreur MAPE de 9 %', 'Pipeline automatisé : rapport hebdomadaire en 5 min au lieu d’une demi-journée', 'Restitution aux équipes métier avec un tableau de bord Power BI']),
      st('Stage ingénieur adjoint — vision par ordinateur', E.faisceaux, ['Détection de défauts de sertissage (YOLO) sur 6 000 images annotées', 'Précision de 96 % sur le jeu de test, réponse en moins de 80 ms', 'Démonstrateur installé sur un poste pilote de contrôle']),
      st('Stage ingénieur adjoint — maintenance prédictive', E.process, ['Modèle d’anomalies sur les vibrations de 8 pompes', 'Alerte 6 jours avant une panne de roulement pendant le stage', 'Code documenté et livré avec ses tests']),
    ],
    ouvriers: [
      st('Stage technicien — données de production', E.conserves, ['Un mois avec le service méthodes : collecte des arrêts de ligne', 'Premier tableau de bord des arrêts, mis à jour chaque jour']),
      st('Stage technicien — support informatique', E.plateforme, ['Inventaire du parc et scripts d’automatisation en Python', 'Documentation des procédures pour les nouveaux arrivants']),
    ],
    projets: [pj('Maintenance prédictive de roulements', 'Signaux vibratoires, caractéristiques et LSTM : 91 % des défauts détectés.'), pj('Tri de déchets par vision', 'Réseau convolutif entraîné sur 4 000 images, déployé sur Raspberry Pi.'),
      pj('Recherche documentaire sur les cours', 'Recherche sémantique avec un modèle de langue open source.')],
    certifs: ['Deep learning — certificat en ligne', 'SQL pour l’analyse de données', 'Gestion de projet agile (Scrum)'],
  },
  info: {
    metier: 'Génie Informatique',
    passions: ['{passionné|passionnée} par le développement logiciel et les architectures web', '{attiré|attirée} par les systèmes intelligents et la qualité du code', '{curieux|curieuse} de construire des produits utiles, du besoin à la mise en production'],
    domaines: ['développement logiciel', 'applications web', 'systèmes intelligents'],
    modules: 'Génie logiciel, architectures distribuées, bases de données, intelligence artificielle, DevOps',
    competences: ['Développement web', 'Architecture logicielle', 'API REST', 'Bases de données', 'DevOps', 'Méthode Scrum', 'Tests automatisés', 'Machine learning'],
    logiciels: ['Java (Spring Boot)', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'Git', 'Python', 'Figma'],
    stages: [
      st('Stage ingénieur adjoint — développement web', E.logiciels, ['Application de suivi des interventions (React, Spring Boot) livrée en 8 semaines', 'API REST documentée, 85 % du code couvert par des tests', 'Mise en production avec Docker sur le serveur du client']),
      st('Stage ingénieur adjoint — plateforme de données', E.plateforme, ['Refonte de 12 requêtes lentes : page principale 4 fois plus rapide', 'Intégration continue mise en place avec l’équipe (3 développeurs)', 'Guide de contribution rédigé pour les stagiaires suivants']),
    ],
    ouvriers: [
      st('Stage technicien — support et réseau', E.plateforme, ['Un mois au support : postes, comptes et réseau local', 'Scripts d’installation automatisée des postes']),
      st('Stage technicien — développement', E.logiciels, ['Correction de 20 tickets sur une application interne', 'Premiers tests automatisés écrits avec l’équipe']),
    ],
    projets: [pj('Plateforme de covoiturage étudiant', 'React et Node.js ; 120 utilisateurs pendant le mois de test.'), pj('Application mobile de suivi d’absences', 'Flutter et Firebase, utilisée par 2 classes pendant un semestre.'),
      pj('Chatbot d’orientation pour les 1A', 'Base de questions fréquentes et modèle de langue open source.')],
    certifs: ['Scrum — Professional Scrum Master I', 'Développement web full stack', 'Docker et intégration continue'],
  },
  civil: {
    metier: 'Génie Civil',
    passions: ['{attiré|attirée} par le calcul de structures et la conduite de chantiers', '{passionné|passionnée} par le BIM et l’ingénierie du bâtiment', '{curieux|curieuse} des ouvrages, du bureau d’études au chantier'],
    domaines: ['structures et bureau d’études', 'conduite de travaux', 'BIM et ingénierie du bâtiment'],
    modules: 'Béton armé, structures, géotechnique, hydraulique, gestion de chantier',
    competences: ['Béton armé (BAEL, EC2)', 'Calcul de structures', 'Métrés et devis', 'Suivi de chantier', 'Géotechnique', 'BIM', 'Hydraulique urbaine', 'Planification'],
    logiciels: ['Robot Structural', 'Revit', 'AutoCAD', 'CYPECAD', 'MS Project', 'Covadis', 'Excel (VBA)', 'Arche'],
    stages: [
      st('Stage ingénieur adjoint — bureau d’études structures', E.bet, ['Descente de charges et ferraillage d’un immeuble R+5 sous Robot', 'Plans d’exécution de 12 poutres et 8 poteaux, vérifiés par l’ingénieur', 'Métré du gros œuvre : écart de 3 % avec le devis initial']),
      st('Stage ingénieur adjoint — conduite de travaux', E.chantiers, ['Suivi quotidien d’un chantier de 40 logements', 'Planning MS Project mis à jour chaque semaine : 2 retards anticipés', 'Réception de 3 coulages de dalles avec contrôle des éprouvettes']),
      st('Stage ingénieur adjoint — géotechnique', E.geo, ['Campagne de 6 sondages et interprétation des essais pressiométriques', 'Choix des fondations argumenté dans le rapport de synthèse', 'Coupes géotechniques dessinées sous AutoCAD']),
    ],
    ouvriers: [
      st('Stage ouvrier — chantier de bâtiment', E.chantiers, ['Un mois avec les équipes de gros œuvre : coffrage, ferraillage, coulage', 'Suivi des quantités de béton livrées']),
      st('Stage ouvrier — laboratoire de matériaux', E.geo, ['Essais sur granulats et éprouvettes de béton', 'Rapports d’essais mis en forme pour le client']),
    ],
    projets: [pj('Étude d’un pont-dalle en béton armé', 'Modèle Robot, ferraillage et note de calcul selon l’Eurocode 2.'), pj('Maquette BIM d’un bâtiment R+3', 'Maquette Revit complète, métrés automatiques et planning simplifié.'),
      pj('Réseau d’assainissement d’un lotissement', 'Dimensionnement des collecteurs et profils en long sous Covadis.')],
    certifs: ['Revit — niveau avancé', 'Sécurité sur chantier', 'Gestion de projet (MS Project)'],
  },
  prepa: {
    metier: 'Classes préparatoires intégrées',
    passions: ['{curieux|curieuse} de toutes les filières de l’ingénieur', '{attiré|attirée} par la mécanique et l’électronique', '{passionné|passionnée} par les projets concrets et le travail en équipe'],
    domaines: ['découverte de l’industrie'],
    modules: 'Mathématiques, physique, mécanique, dessin technique et sciences de l’ingénieur',
    competences: ['Mathématiques', 'Physique', 'Programmation Python', 'Dessin technique', 'Travail en équipe', 'Prise de parole'],
    logiciels: ['Python', 'SolidWorks', 'Arduino', 'Excel', 'LaTeX', 'Scilab'],
    stages: [], ouvriers: [], projets: [], certifs: ['Secourisme (PSC1)', 'Python — bases'],
  },
};
const FAMILLE_DE = { GIP24: 'gi', GIEO: 'gi', 'GE-DI': 'ge', 'GE-MCI': 'ge', 'GM-CISM': 'gm', 'GM-IMS': 'gm', 'GM-MPF': 'mat', GME24: 'ener', GC24: 'civil', 'IATD-SI': 'ia', 'GI-ILSI': 'info' };
const ANCIENNES = { 'Génie Industriel': 'gi', 'Génie Électromécanique': 'ge', 'Mécatronique': 'ge', 'Génie Mécanique': 'gm', 'Génie Énergétique': 'ener', 'Génie Civil': 'civil', 'Génie Informatique & IA': 'ia' };
const familleDe = f => (f === PREPA ? 'prepa' : FAMILLE_DE[filiereInfo(f)?.code] || ANCIENNES[f] || 'gi');
const PROJETS_PREPA = [pj('Éolienne de démonstration', 'Conception et essais d’une petite éolienne à axe vertical, en équipe de 4.'), pj('Robot suiveur de ligne', 'Châssis, capteurs infrarouges et programmation Arduino ; finaliste du concours interne.'),
  pj('Banc de mesure de température', 'Capteurs, acquisition et traitement des mesures sous Python.')];
const ASSOS = [
  { nom: 'Club Industrie 4.0', role: '{Responsable|Responsable} des visites d’entreprises', desc: '6 visites organisées pour 140 élèves' },
  { nom: 'Bureau des élèves', role: '{Trésorier|Trésorière}', desc: 'budget annuel suivi et présenté en assemblée générale' },
  { nom: 'Club Robotique', role: '{Membre|Membre} de l’équipe compétition', desc: 'robot suiveur de ligne, finale d’une compétition étudiante' },
  { nom: 'Forum Écoles–Entreprises', role: 'Équipe partenariats', desc: '25 entreprises contactées, 9 stands confirmés' },
  { nom: 'Club Social', role: '{Bénévole|Bénévole}', desc: 'soutien scolaire chaque semaine pour 15 collégiens de Meknès' },
  { nom: 'Club Entrepreneuriat', role: '{Vice-président|Vice-présidente}', desc: 'un hackathon de 48 h organisé pour 70 participants' },
  { nom: 'Club Sport', role: '{Capitaine|Capitaine} de l’équipe de futsal', desc: 'tournoi inter-écoles de Meknès' },
];
const INTERETS = ['Course à pied — semi-marathon', 'Échecs — club de l’école', 'Photographie de paysage', 'Randonnée dans le Moyen Atlas', 'Lecture : romans et essais', 'Football en club',
  'Natation', 'Calligraphie arabe', 'Musique : oud', 'Voyages en train', 'Basket-ball', 'Cuisine marocaine', 'Bénévolat associatif', 'Jeux de stratégie'];
const QUALITES = [[['Rigoureux', 'Rigoureuse'], ['curieux', 'curieuse']], [['Méthodique', 'Méthodique'], ['autonome', 'autonome']], [['Organisé', 'Organisée'], ['persévérant', 'persévérante']], [['Curieux', 'Curieuse'], ['rigoureux', 'rigoureuse']]];
const TRAITS = ['à l’aise sur le terrain comme devant les données', 'avec le goût du travail en équipe et des résultats concrets', 'à l’aise pour présenter ses travaux et convaincre'];
// Les logiciels qu'on reconnaît dans les compétences d'un profil (début du nom, sans accents ni espaces)
const LOGICIELS = ['solidworks', 'catia', 'ansys', 'abaqus', 'creo', 'matlab', 'simulink', 'autocad', 'revit', 'robotstructural', 'pvsyst', 'trnsys', 'python', 'powerbi', 'excel',
  'minitab', 'flexsim', 'sap', 'arena', 'msproject', 'tiaportal', 'siemenstia', 'wincc', 'eplan', 'nodered', 'factoryio', 'sql', 'react', 'docker', 'git', 'pytorch', 'tensorflow',
  'scikitlearn', 'opencv', 'java', 'nodejs', 'postgresql', 'figma', 'arduino', 'ros', 'mastercam', 'imagej', 'ees', 'ansysfluent', 'retscreen', 'covadis', 'cypecad', 'arche', 'labview', 'scilab', 'latex'];
const ATOUTS = ['Esprit d’équipe', 'Rigueur', 'Sens du résultat', 'Communication', 'Leadership', 'Autonomie', 'Adaptabilité', 'Organisation', 'Créativité', 'Écoute'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const premiereMaj = s => s.charAt(0).toUpperCase() + s.slice(1);
// Comme demoEmail (store.js) : prenom.nom@exemple.ma
const emailDemo = p => (p?.full_name || 'membre').toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').trim().replace(/ +/g, '.') + '@exemple.ma';
const lienLinkedin = p => (p?.linkedin ? String(p.linkedin).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
  : 'linkedin.com/in/' + String(p?.full_name || 'membre').toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').trim().replace(/ +/g, '-'));

// Tout ce que dit le CV d'un membre ; demande : sa recherche en cours (Demandes), now : la date de la démo
export function contenuCv(p, { demande = null, now = new Date() } = {}) {
  const r = alea(String(p?.id || p?.full_name || 'cv'));
  const f = estFemme(p), a = t => accorder(t, f);
  const S = seasonOf(now), niv = niveauOf(p, S), P = Number(p?.promo) || S + 1;
  const etudiant = p?.role !== 'laureat' && p?.role !== 'admin' && niv <= 5;
  // Un élève du cycle ingénieur resté sur « Classes préparatoires intégrées » dans son profil : un CV sans filière
  const sansFiliere = etudiant && niv >= 3 && familleDe(p?.filiere) === 'prepa';
  const fam = FAMILLES[etudiant && niv <= 2 ? 'prepa' : sansFiliere ? 'gi' : familleDe(p?.filiere)];
  const info = filiereInfo(p?.filiere);
  const [filX, filY] = String(info?.nom || p?.filiere || fam.metier).split(' : ');
  const domaine = fam.domaines[Math.floor(r() * fam.domaines.length)];
  const nom = String(p?.full_name || 'Membre du réseau').trim();

  // Compétences : celles du profil d'abord (les logiciels du profil vont avec les logiciels), puis celles de la filière ;
  // « Lean » et « Lean manufacturing », « CATIA » et « CATIA V5 » ne font qu'un
  const cle = s => sansAccent(s).replace(/[^a-z0-9]/g, '');
  const estLogiciel = s => LOGICIELS.some(l => cle(s).startsWith(l)) || fam.logiciels.some(l => cle(l) === cle(s));
  const duProfil = (p?.competences || []).map(s => String(s).trim()).filter(Boolean);
  const logiciels = [], competences = [], vu = [];
  const ajouter = (liste, s, niveau) => {
    const k = cle(s); if (!k || vu.some(v => (v.length >= 3 && k.startsWith(v)) || (k.length >= 3 && v.startsWith(k)))) return;
    vu.push(k); liste.push(liste === competences ? [s, niveau] : s);
  };
  for (const s of duProfil) ajouter(estLogiciel(s) ? logiciels : competences, s, 5 - Math.floor(r() * 2));
  for (const s of melanger(fam.competences, r)) if (competences.length < 6) ajouter(competences, s, 3 + Math.floor(r() * 2));
  for (const s of melanger(fam.logiciels, r)) if (logiciels.length < 7) ajouter(logiciels, s);

  const anglais = r() < 0.75 ? `B2 · TOEIC ${785 + 5 * Math.floor(r() * 30)}` : r() < 0.5 ? 'C1' : 'B2';
  const troisieme = r(); const langues = [['Arabe', 'Langue maternelle'], ['Français', r() < 0.7 ? 'C1' : 'B2'], ['Anglais', anglais],
    ...(troisieme < 0.35 ? [['Espagnol', 'A2']] : troisieme < 0.55 ? [['Allemand', 'A2']] : troisieme < 0.7 ? [['Amazighe', 'Courant']] : [])];
  const interets = melanger(INTERETS, r).slice(0, 3);
  const certifications = melanger(fam.certifs, r).slice(0, 2);
  const assos = melanger(ASSOS, r).slice(0, 2);
  const stages = melanger(fam.stages, r), ouvriers = melanger(fam.ouvriers, r);
  const passion = a(fam.passions[Math.floor(r() * fam.passions.length)]);
  // Les qualités ne répètent pas un mot de la passion (« curieuse des composites… Rigoureuse et curieuse »)
  const possibles = QUALITES.filter(q => !q.flat().some(m => sansAccent(passion).includes(sansAccent(m).slice(0, 6))));
  const [q1, q2] = (possibles.length ? possibles : QUALITES)[Math.floor(r() * (possibles.length || QUALITES.length))];
  const qualites = `${f ? q1[1] : q1[0]} et ${f ? q2[1] : q2[0]}, ${TRAITS[Math.floor(r() * TRAITS.length)]}.`;
  const atouts = melanger(ATOUTS, r).slice(0, 4);

  // Titre, objectif, expériences et formation selon l'année (ou le parcours d'un lauréat)
  let titre, objectif, profil; const experiences = [], projets = [], formation = [];
  const bac = { titre: `Baccalauréat sciences mathématiques, mention ${r() < 0.6 ? 'Très bien' : 'Bien'}`, droite: String(P - 5), lignes: [] };
  const prepa = { titre: 'Classes préparatoires intégrées — ENSAM Meknès', droite: `${P - 5} – ${P - 3}`, lignes: ['Mathématiques, physique, mécanique et sciences de l’ingénieur'] };
  const cycle = (diplome) => ({ titre: `${diplome} — ENSAM Meknès`, droite: `${P - 3} – ${P}`, sous: sansFiliere ? [] : filY ? [filX, filY] : [filX],
    lignes: sansFiliere ? [] : [`Modules clés : ${fam.modules.charAt(0).toLowerCase()}${fam.modules.slice(1)}`] });
  const ete = an => `Juil. – août ${an}`;
  if (etudiant && niv >= 3) {
    titre = a(`{Élève ingénieur|Élève ingénieure}${sansFiliere ? '' : ' en ' + fam.metier} · ${niv}e année`);
    if (demande?.titre) objectif = ['Recherche : ' + demande.titre, demande.lieu, demande.duree].filter(Boolean);
    else if (niv === 5) objectif = [`Recherche un PFE de 6 mois à partir de février ${P}`, domaine];
    else if (niv === 4) objectif = [`Recherche un stage d’ingénieur adjoint de 2 mois, été ${P - 1}`, domaine];
    else objectif = [`Recherche un stage ouvrier d’un mois, été ${P - 2}`, domaine];
    formation.push(cycle('Cycle ingénieur d’État'), prepa, bac);
    if (niv === 5) {
      // Deux stages dans deux entreprises différentes (jamais deux fois la même usine)
      const ouv = ouvriers.find(o => o.e !== stages[0]?.e) || ouvriers[0];
      if (stages[0]) experiences.push({ ...stages[0], droite: ete(P - 1), duree: '2 mois' });
      if (ouv) experiences.push({ ...ouv, droite: `Juillet ${P - 2}`, duree: '1 mois' });
      projets.push(...melanger(fam.projets, r).slice(0, 2).map((x, i) => ({ ...x, titre: (i ? 'Projet — ' : 'PFA — ') + x.titre, droite: String(P - 1 - i) })));
      const s1 = stages[0]?.e.secteur || 'l’industrie', s2 = ouv?.e.secteur || 'l’industrie';
      profil = a(`{Élève ingénieur|Élève ingénieure} en dernière année à l’ENSAM Meknès, ${passion}. ${s1 === s2 ? `Deux stages dans ${s1}` : `Deux stages, dans ${s1} puis ${s2}`}, avec des résultats mesurés sur le terrain. ${qualites}`);
    } else if (niv === 4) {
      if (ouvriers[0]) experiences.push({ ...ouvriers[0], droite: `Juillet ${P - 2}`, duree: '1 mois' });
      projets.push(...melanger(fam.projets, r).slice(0, 2).map((x, i) => ({ ...x, titre: (i ? 'Projet — ' : 'PFA en cours — ') + x.titre, droite: i ? String(P - 2) : `${P - 2} – ${P - 1}` })));
      profil = a(`{Élève ingénieur|Élève ingénieure} en 4e année à l’ENSAM Meknès, ${passion}. Un premier stage dans ${ouvriers[0]?.e.secteur || 'l’industrie'} et des projets d’équipe concrets en ${domaine}. ${qualites}`);
    } else {
      projets.push(...melanger(PROJETS_PREPA, r).slice(0, 2).map((x, i) => ({ ...x, titre: `Projet de ${2 - i === 2 ? '2e' : '1re'} année — ${x.titre}`, droite: String(P - 3 - i) })));
      profil = a(`{Élève ingénieur|Élève ingénieure} en 3e année à l’ENSAM Meknès, ${passion}. Des projets d’équipe concrets depuis les classes préparatoires et un engagement associatif régulier. ${qualites}`);
    }
  } else if (etudiant) {
    titre = `Élève en classes préparatoires intégrées · ${Math.max(1, niv)}e année`;
    objectif = [a('{Futur ingénieur|Future ingénieure} de l’ENSAM Meknès'), 'visites d’usine et stages d’observation'];
    formation.push({ ...prepa, droite: `${P - 5} – ${P - 3}` }, bac);
    // Des projets datés entre l'entrée à l'école (septembre P − 5) et aujourd'hui
    const derniere = Math.min(S, P - 4);
    projets.push(...melanger(PROJETS_PREPA, r).slice(0, 2).map((x, i) => ({ ...x, titre: 'Projet — ' + x.titre, droite: String(derniere - i) })).filter(x => +x.droite >= P - 5));
    profil = a(`{Élève|Élève} en classes préparatoires intégrées à l’ENSAM Meknès, ${passion}. ${qualites}`);
  } else {
    // Un lauréat : son poste du profil (ses propres mots), puis son PFE dans une entreprise inventée
    titre = p?.poste ? String(p.poste) : a(`{Ingénieur|Ingénieure} d’État en ${fam.metier}`);
    objectif = [p?.entreprise ? `${p.poste ? '' : 'En poste · '}${p.entreprise}` : `Promo ${P} · ENSAM Meknès`, p?.ville || ''].filter(Boolean);
    formation.push(cycle('Diplôme d’ingénieur d’État'), prepa);
    if (p?.entreprise) experiences.push({ poste: p.poste || 'Ingénieur', e: { nom: p.entreprise, ville: p.ville || '' }, droite: `Depuis ${Math.max(P, S - 1)}`, puces: [] });
    if (stages[0]) experiences.push({ ...stages[0], poste: stages[0].poste.replace(/^Stage ingénieur adjoint/, 'Projet de fin d’études'), droite: `Févr. – juin ${P}`, duree: '5 mois' });
    profil = a(`{Ingénieur|Ingénieure} ${fam.metier} {diplômé|diplômée} de l’ENSAM Meknès (promo ${P}), ${passion}. ${qualites}`);
  }
  // La vie associative : les deux dernières années universitaires terminées, jamais avant l'entrée à l'école
  // (en 1re ou 2e année de prépa, l'année en cours compte)
  const fin = Math.min(S - 1, P - 2), annees = [fin, fin - 1].filter(y => y >= P - 5);
  if (annees.length < 2 && fin + 1 <= S && fin + 1 >= P - 5) annees.unshift(fin + 1);
  return {
    nom, initiales: initials(nom), titre, objectif, profil, femme: f,
    contact: { email: emailDemo(p), tel: '+212 6 00 00 00 00', ville: p?.ville || 'Meknès', linkedin: lienLinkedin(p) },
    formation, experiences, projets,
    assos: assos.slice(0, annees.length).map((x, i) => ({ titre: `${x.nom} — ENSAM Meknès`, droite: `${annees[i]} – ${annees[i] + 1}`, role: a(x.role), desc: x.desc })),
    competences, logiciels, langues, certifications, interets, atouts,
    disponibilite: p?.disponibilite || null, mois: MOIS[now.getMonth()],
  };
}

// ---------------------------------------------------------------------------
// La mise en page
// ---------------------------------------------------------------------------
const C = {
  nuit: '#0C2645', nuit2: '#11315A', nuit3: '#163C6B', bande: '#0F2D52', orange: '#F39200', orangeClair: '#FFB547', blanc: '#FFFFFF', bandeTexte: '#CFDDEE',
  encre: '#15223A', encre2: '#3E4B61', gris: '#677388', filet: '#D5DDE8', bleu: '#1670A8', bleuTexte: '#135F8F', lat: '#F1F5FA', puce: '#DFEAF5', puceTexte: '#164C78', vide: '#C6D2E0', atout: '#FCEBD3', atoutTexte: '#8A4A00',
};
const HAUT = 150;                    // hauteur du bandeau
const LAT = 196;                     // largeur de la colonne latérale
const XL = 26, XL2 = LAT - 22;       // colonne latérale (texte)
const XP = LAT + 24, XP2 = W - 34;   // colonne principale
const BAS = 46;                      // rien sous cette ligne (pied de page)

// Le titre d'une rubrique : petites capitales espacées, un filet et sa touche d'orange
function rubrique(pg, t, x, x2, y) {
  pg.ecrire(t.toUpperCase(), x, y, { gras: true, taille: 9.2, c: C.nuit, espace: 0.55 });
  pg.ligne(x, y - 6, x2, y - 6, C.filet, 0.7);
  pg.rect(x, y - 7.1, 22, 2.2, C.orange);
  return y - 21;
}

// Le bandeau : cercle d'initiales, nom, titre, objectif ; dessous, la ligne des coordonnées
function bandeau(pg, c) {
  const y0 = H - HAUT, yb = y0 + 32;
  pg.rect(0, y0, W, HAUT, C.nuit);
  pg.dans(0, y0, W, HAUT, () => { pg.cercle(W - 28, H + 18, 150, C.nuit2); pg.cercle(W + 50, y0 + 6, 112, C.nuit3); });
  pg.rect(0, y0, W, 32, C.bande);
  pg.rect(0, y0 - 3, W, 3, C.orange);
  // Le cercle d'initiales, cerclé d'orange
  const cx = 36 + 44, cy = (H + yb) / 2 + 1;
  pg.cercle(cx, cy, 46.5, C.orange); pg.cercle(cx, cy, 43.5, C.blanc);
  const ti = c.initiales.length > 2 ? 26 : 32;
  pg.ecrire(c.initiales, cx, cy - ti * 0.355, { gras: true, taille: ti, c: C.nuit, align: 'c', ou: 'dessus' });
  // Nom, titre, objectif : à droite du cercle
  const x = cx + 62, max = W - 30 - x;
  let tn = 27; while (tn > 17 && mesure(c.nom, true, tn) > max) tn -= 0.5;
  let tt = 11.5; while (tt > 8.5 && mesure(c.titre, true, tt) > max) tt -= 0.25;
  // L'objectif tient sur une ligne : on retire d'abord le moins utile (la fin)
  let obj = [...c.objectif], to = 9.6;
  const ligneObj = () => obj.join(' · ');
  while (mesure(ligneObj(), false, to) > max) { if (to > 8.6) to -= 0.2; else if (obj.length > 1) { obj = obj.slice(0, -1); to = 9.6; } else break; }
  const yn = cy + 9;
  pg.ecrire(c.nom, x, yn, { gras: true, taille: tn, c: C.blanc });
  pg.ecrire(c.titre, x, yn - 22, { gras: true, taille: tt, c: C.orangeClair });
  pg.ecrire(ligneObj(), x, yn - 37, { taille: to, c: C.bandeTexte });
  coordonnees(pg, c.contact, y0 + 12);
}

// Les petites icônes des coordonnées (traits orange)
const ICONES = {
  email: (pg, x, y) => { pg.arrondi(x, y - 3.4, 10, 7.2, 1.2, C.orangeClair, 0.9); pg.chemin(`${n2(x + 0.6)} ${n2(y + 3.2)} m ${n2(x + 5)} ${n2(y - 0.4)} l ${n2(x + 9.4)} ${n2(y + 3.2)} l`, C.orangeClair, 0.9); return 10; },
  tel: (pg, x, y) => { pg.arrondi(x + 1.5, y - 5, 6, 10, 1.4, C.orangeClair, 0.9); pg.ligne(x + 3.6, y - 3.1, x + 5.4, y - 3.1, C.orangeClair, 0.9); return 9; },
  ville: (pg, x, y) => {
    const cx = x + 4.2, cy = y + 1.4;
    pg.chemin(`${n2(cx)} ${n2(cy - 6.2)} m ${n2(cx - 1.4)} ${n2(cy - 4.2)} ${n2(cx - 3.8)} ${n2(cy - 2.3)} ${n2(cx - 3.8)} ${n2(cy + 0.2)} c ${n2(cx - 3.8)} ${n2(cy + 2.4)} ${n2(cx - 2.1)} ${n2(cy + 4)} ${n2(cx)} ${n2(cy + 4)} c ${n2(cx + 2.1)} ${n2(cy + 4)} ${n2(cx + 3.8)} ${n2(cy + 2.4)} ${n2(cx + 3.8)} ${n2(cy + 0.2)} c ${n2(cx + 3.8)} ${n2(cy - 2.3)} ${n2(cx + 1.4)} ${n2(cy - 4.2)} ${n2(cx)} ${n2(cy - 6.2)} c h`, C.orangeClair, 0.9);
    pg.cercle(cx, cy + 0.2, 1.3, C.orangeClair); return 8.4;
  },
  linkedin: (pg, x, y) => { pg.arrondi(x, y - 4.6, 9.2, 9.2, 1.8, C.orangeClair); pg.ecrire('in', x + 4.6, y - 2.6, { gras: true, taille: 6.6, c: C.bande, align: 'c', ou: 'dessus' }); return 9.2; },
};
function coordonnees(pg, k, y) {
  const items = [['email', k.email], ['tel', k.tel], ['ville', k.ville], ['linkedin', k.linkedin]];
  const max = W - 72;
  let taille = 8.6, liste = items;
  const largeur = (l, t) => l.reduce((s, [, v]) => s + 10 + 5 + mesure(v, false, t), 0) + (l.length - 1) * 16;
  while (largeur(liste, taille) > max) { if (taille > 7.4) taille -= 0.2; else if (liste.length > 3) { liste = liste.filter(([k2]) => k2 !== 'ville'); taille = 8.6; } else break; }
  // Réparties sur toute la largeur, du bord du cercle au bord de la page
  const libre = max - largeur(liste, taille), pas = 16 + (liste.length > 1 ? libre / (liste.length - 1) : 0);
  let x = 36;
  for (const [ic, v] of liste) {
    const wi = ICONES[ic](pg, x, y + 2.6);
    const wt = pg.ecrire(v, x + wi + 5, y, { taille, c: C.blanc });
    x += wi + 5 + wt + Math.min(pas, 40);
  }
}

// La colonne principale. red : ce qu'on retire pour que tout tienne ; es, ee : l'air ajouté après chaque rubrique et
// chaque entrée pour que la colonne descende jusqu'au pied de page (une page pleine et égale, pas un trou en bas)
function principale(pg, c, red, es = 0, ee = 0) {
  let y = H - HAUT - 3 - 26;
  const corps = 9.3 - red.corps, interligne = corps * 1.42;
  const para = (t, x, x2, opts = {}) => {
    const taille = opts.taille || corps;
    for (const l of couper(t, x2 - x, opts.gras, taille)) { pg.ecrire(l, x, y, { taille, c: C.encre2, ...opts }); y -= taille * 1.42; }
  };
  // Une ligne de titre (gras) avec ses dates au bout
  const tete = (t, droite, taille = 9.7) => {
    const wd = droite ? mesure(droite, false, 8.4) : 0;
    couper(t, XP2 - XP - (wd ? wd + 12 : 0), true, taille).forEach((l, i) => {
      pg.ecrire(l, XP, y, { gras: true, taille, c: C.encre });
      if (!i && droite) pg.ecrire(droite, XP2, y, { taille: 8.4, c: C.gris, align: 'd' });
      y -= 12.6;
    });
  };
  const fin = () => { y -= 9 + es; };
  y = rubrique(pg, 'Profil', XP, XP2, y);
  para(c.profil, XP, XP2);
  fin();
  y = rubrique(pg, 'Formation', XP, XP2, y);
  for (const [i, e] of c.formation.entries()) {
    if (red.bac && /^Baccalauréat/.test(e.titre)) continue;
    tete(e.titre, e.droite);
    // La filière : « Génie Mécanique : Énergétique » sur une ligne quand elle tient, sinon en deux
    const sous = e.sous?.length ? (mesure(e.sous.join(' : '), true, 8.9) <= XP2 - XP ? [e.sous.join(' : ')] : e.sous) : [];
    for (const s of sous) for (const l of couper(s, XP2 - XP, true, 8.9)) { pg.ecrire(l, XP, y + 0.6, { gras: true, taille: 8.9, c: C.bleuTexte }); y -= 11.8; }
    if (!red.modules || !e.sous) for (const l of e.lignes || []) para(l, XP, XP2, { taille: 8.6, c: C.gris });
    y -= 5 + ee;
  }
  fin();
  if (c.experiences.length) {
    y = rubrique(pg, 'Expériences', XP, XP2, y);
    for (const e of c.experiences) {
      tete(e.poste, e.droite);
      // L'entreprise (en bleu), puis la ville et la durée
      const we = pg.ecrire(e.e.nom, XP, y + 0.6, { gras: true, taille: 8.9, c: C.bleuTexte });
      const suite = [e.e.ville, e.duree].filter(Boolean).join(' · ');
      if (suite) pg.ecrire(' · ' + suite, XP + we, y + 0.6, { taille: 8.9, c: C.gris });
      y -= 13;
      for (const pu of e.puces.slice(0, red.puces)) {
        pg.cercle(XP + 3, y + corps * 0.32, 1.5, C.orange);
        for (const l of couper(pu, XP2 - XP - 11, false, corps)) { pg.ecrire(l, XP + 11, y, { taille: corps, c: C.encre2 }); y -= interligne; }
      }
      y -= 6 + ee;
    }
    fin();
  }
  if (c.projets.length) {
    y = rubrique(pg, 'Projets académiques', XP, XP2, y);
    for (const p of c.projets.slice(0, red.projets)) { tete(p.titre, p.droite, 9.4); para(p.desc, XP, XP2); y -= 5 + ee; }
    fin();
  }
  if (c.assos.length && red.assos) {
    y = rubrique(pg, 'Vie associative', XP, XP2, y);
    for (const v of c.assos.slice(0, red.assos)) { tete(v.titre, v.droite, 9.4); para(`${v.role} : ${v.desc}.`, XP, XP2); y -= 5 + ee; }
    y += 5 + ee;
  }
  return y;
}

// La colonne latérale : compétences et niveaux, logiciels, langues, atouts, certifications, centres d'intérêt
function laterale(pg, c, red, es = 0) {
  let y = H - HAUT - 3 - 26;
  pg.rect(0, 0, LAT, H - HAUT - 3, C.lat);
  const pastilles = (liste, fond, encre) => {
    let x = XL; const hp = 14.5, tp = 7.9;
    y += 3;
    for (const l of liste) {
      const w = mesure(l, false, tp) + 11;
      if (x > XL && x + w > XL2) { x = XL; y -= hp + 4.5; }
      pg.arrondi(x, y - 4.2, w, hp, hp / 2, fond);
      pg.ecrire(l, x + 5.5, y, { taille: tp, c: encre });
      x += w + 4.5;
    }
    y -= hp + 3;
  };
  const liste = items => {
    for (const ce of items) {
      for (const [i, l] of couper(ce, XL2 - XL - 10, false, 8.5).entries()) { if (!i) pg.cercle(XL + 2.6, y + 2.8, 1.5, C.orange); pg.ecrire(l, XL + 10, y, { taille: 8.5, c: C.encre2 }); y -= 11.8; }
      y -= 3.6;
    }
    y += 3.6;
  };
  const fin = () => { y -= 12 + es; };
  y = rubrique(pg, 'Compétences', XL, XL2, y);
  for (const [nom, niveau] of c.competences) {
    // Un nom trop long passe sur deux lignes plutôt que de rapetisser ou de toucher les points
    let t = 8.7; const maxNom = XL2 - XL - 5 * 7.4 - 6;
    while (t > 8.1 && mesure(nom, false, t) > maxNom) t -= 0.1;
    if (mesure(nom, false, t) > maxNom) t = 8.7;
    const lignes = mesure(nom, false, t) > maxNom ? couper(nom, maxNom, false, t).slice(0, 2) : [nom];
    lignes.forEach((l, i) => pg.ecrire(l, XL, y - i * 10.6, { taille: t, c: C.encre }));
    for (let i = 0; i < 5; i++) pg.cercle(XL2 - 2.7 - (4 - i) * 7.4, y + 2.9, 2.7, i < niveau ? C.bleu : C.vide);
    y -= 15.6 + (lignes.length - 1) * 10.6;
  }
  y += 15.6 - 11; fin();
  y = rubrique(pg, 'Logiciels', XL, XL2, y);
  pastilles(c.logiciels, C.puce, C.puceTexte);
  fin();
  y = rubrique(pg, 'Langues', XL, XL2, y);
  for (const [l, niv] of c.langues) {
    pg.ecrire(l, XL, y, { gras: true, taille: 8.7, c: C.encre });
    let t = 8.3; while (t > 7 && mesure(niv, false, t) > XL2 - XL - 52) t -= 0.2;
    pg.ecrire(niv, XL2, y, { taille: t, c: C.gris, align: 'd' });
    y -= 15.6;
  }
  y += 15.6 - 11; fin();
  if (red.atouts) {
    y = rubrique(pg, 'Atouts', XL, XL2, y);
    pastilles(c.atouts, C.atout, C.atoutTexte);
    fin();
  }
  if (red.certifs) {
    y = rubrique(pg, 'Certifications', XL, XL2, y);
    liste(c.certifications);
    fin();
  }
  y = rubrique(pg, 'Centres d’intérêt', XL, XL2, y);
  liste(c.interets.slice(0, red.interets));
  return y;
}

// Les réglages essayés l'un après l'autre jusqu'à ce que la page tienne
const REDUCTIONS = [
  { corps: 0, puces: 3, projets: 2, assos: 2, atouts: true, certifs: true, interets: 3 },
  { corps: 0, puces: 3, projets: 2, assos: 1, atouts: true, certifs: true, interets: 3 },
  { corps: 0, puces: 2, projets: 2, assos: 1, atouts: true, certifs: true, interets: 3, modules: true },
  { corps: 0.3, puces: 2, projets: 1, assos: 1, atouts: false, certifs: false, interets: 2, modules: true },
  { corps: 0.5, puces: 2, projets: 1, assos: 0, atouts: false, certifs: false, interets: 2, modules: true, bac: true },
];
// Combien de rubriques et d'entrées reçoivent de l'air dans chaque colonne
const airPrincipale = c => ({ rubriques: 1 + 1 + (c.experiences.length ? 1 : 0) + (c.projets.length ? 1 : 0), entrees: c.formation.length + c.experiences.length + Math.min(2, c.projets.length) + Math.min(2, c.assos.length) });

// Le CV d'un membre, en PDF d'une page
export function pdfCvDemo(p, opts = {}) {
  const c = contenuCv(p, opts);
  const composer = (red, es = 0, ee = 0, el = 0) => {
    const pg = new Page();
    bandeau(pg, c);
    return { pg, yp: principale(pg, c, red, es, ee), yl: laterale(pg, c, red, el) };
  };
  let red = REDUCTIONS[0], essai = null;
  for (red of REDUCTIONS) { essai = composer(red); if (essai.yp >= BAS && essai.yl >= BAS) break; }
  // L'air qui reste se répartit entre les rubriques et les entrées (sans dépasser un écart confortable)
  const a = airPrincipale(c), libreP = Math.max(0, essai.yp - BAS - 6), libreL = Math.max(0, essai.yl - BAS - 6);
  const es = Math.min(14, (libreP * 0.55) / a.rubriques), ee = Math.min(7, (libreP - es * a.rubriques) / Math.max(1, a.entrees));
  const el = Math.min(16, libreL / 5);
  const { pg } = composer(red, es, Math.max(0, ee), el);
  pg.ligne(XP, 34, XP2, 34, C.filet, 0.5);
  pg.ecrire('CV de démonstration — données fictives', XP2, 22, { taille: 7.4, c: C.gris, align: 'd' });
  return pdfUnePage(pg.flux(), { titre: `CV de ${c.nom} (démonstration)` });
}
