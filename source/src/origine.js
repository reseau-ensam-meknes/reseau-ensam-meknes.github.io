// Origine d'une offre (colonne offers.origine), sans DOM :
//   'portee'   : un lauréat l'a apportée de son entreprise, il en est responsable et encadre la personne retenue
//   'partagee' : vue ailleurs (LinkedIn, site d'entreprise…) et partagée par un membre, étudiants compris ; lien obligatoire
//   null       : offre classique (toutes les offres d'avant : rien n'est affirmé sur elles)
// Mêmes règles que offre_origine() et fermer_partages_anciens() dans schema.sql.

export const estPortee = o => o?.origine === 'portee';
export const estPartagee = o => o?.origine === 'partagee';

// Une offre partagée sans date limite se ferme seule après 45 jours ; avec une date limite, une fois celle-ci passée.
// La base la ferme chaque nuit ; l'écran la cache déjà (démo, ou en attendant la nuit).
export const PARTAGE_JOURS = 45;
export function partageExpire(o, now = Date.now()) {
  if (!estPartagee(o)) return false;
  if (o.deadline) return new Date(o.deadline + 'T23:59:59') < new Date(now);
  return now - new Date(o.created_at).getTime() > PARTAGE_JOURS * 864e5;
}
// Ce qu'une liste d'offres ouvertes montre : tout, sauf un partage expiré
export const offreVisible = (o, now = Date.now()) => o.status === 'ouverte' && !partageExpire(o, now);

// Ordre des offres : d'abord celles portées par un lauréat, puis les classiques, puis les partages ;
// dans chaque groupe, la plus récente d'abord
export const rangOrigine = o => (estPortee(o) ? 0 : estPartagee(o) ? 2 : 1);
export const trierOffres = list => [...list].sort((a, b) => rangOrigine(a) - rangOrigine(b) || new Date(b.created_at) - new Date(a.created_at));

// Points d'impact d'une offre publiée (lauréats seulement : les étudiants ne voient jamais de points).
// Une offre portée compte plus qu'une offre classique ; un partage, presque rien.
export const POINTS_OFFRE = { portee: 15, classique: 10, partagee: 1 };
export const pointsOffre = o => POINTS_OFFRE[estPortee(o) ? 'portee' : estPartagee(o) ? 'partagee' : 'classique'];

// Un lien http(s) vers une page (comme dans la base)
export const LIEN_RE = /^https?:\/\/[^\s/?#]+\.[^\s]+$/i;
export const lienValide = s => typeof s === 'string' && s.trim().length <= 500 && LIEN_RE.test(s.trim());
const cleLien = s => String(s || '').trim().toLowerCase().replace(/\/+$/, '');

// Où l'offre a été vue : « LinkedIn », « Indeed »… sinon le nom du site (« careers.ocpgroup.ma »)
const SOURCES = [[/(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/, 'LinkedIn'], [/(^|\.)indeed\./, 'Indeed'], [/(^|\.)rekrute\.com$/, 'ReKrute'],
  [/(^|\.)welcometothejungle\.com$/, 'Welcome to the Jungle'], [/(^|\.)emploi\.ma$/, 'Emploi.ma'], [/(^|\.)anapec\.org$/, 'ANAPEC'], [/(^|\.)glassdoor\./, 'Glassdoor']];
export function sourceDe(lien) {
  let h = '';
  try { h = new URL(String(lien || '').trim()).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
  for (const [re, nom] of SOURCES) if (re.test(h)) return nom;
  return h;
}

// Qui peut publier quoi (comme offre_origine() dans la base). role : le rôle de l'auteur de l'offre ; admin : la personne
// qui agit est de l'administration ; old : la ligne avant une modification. Renvoie le message à afficher, ou null si c'est permis.
export function refusOrigine(row, { role = '', admin = false } = {}, offres = [], old = null, now = Date.now()) {
  if (old) {
    if (row.origine !== old.origine && !admin) {
      if (estPartagee(old) || estPartagee(row)) return 'Une offre partagée reste un partage : publie plutôt une nouvelle offre.';
      if (estPortee(row) && !['laureat', 'admin'].includes(role)) return 'Seul un lauréat peut porter une offre de son entreprise.';
    }
    if (role === 'etudiant' && !admin && (row.audience || 'etudiants') !== 'etudiants') return 'Un étudiant partage une offre vue ailleurs, avec son lien.';
    if (estPartagee(row) && row.lien !== old.lien) {
      if (!lienValide(row.lien)) return 'Ajoute le lien de l’offre (https://…).';
      const k = cleLien(row.lien);
      if (offres.some(o => estPartagee(o) && o.status === 'ouverte' && cleLien(o.lien) === k && now - new Date(o.created_at).getTime() < PARTAGE_JOURS * 864e5)) return 'Cette offre est déjà partagée sur le réseau.';
    }
    return null;
  }
  if (estPortee(row) && !['laureat', 'admin'].includes(role)) return 'Seul un lauréat peut porter une offre de son entreprise.';
  if (role === 'etudiant' && (!estPartagee(row) || (row.audience || 'etudiants') !== 'etudiants')) return 'Un étudiant partage une offre vue ailleurs, avec son lien.';
  if (estPartagee(row)) {
    if (!lienValide(row.lien)) return 'Ajoute le lien de l’offre (https://…).';
    const k = cleLien(row.lien);
    if (offres.some(o => estPartagee(o) && o.status === 'ouverte' && cleLien(o.lien) === k && now - new Date(o.created_at).getTime() < PARTAGE_JOURS * 864e5)) return 'Cette offre est déjà partagée sur le réseau.';
  }
  return null;
}

// Les partages : 5 par jour au plus et par personne (toutes offres comprises), et pas deux fois le même lien en 24 h.
// Comme le déclencheur trg_limite_partage (limiter) dans la base.
export const LIMITE_PARTAGES = 5;
