// Console d'administration : les règles, sans écran. Les données d'une école, la recherche, ce qui attend (« À traiter »),
// le message prêt pour un lauréat, les filtres et le tri des membres, leur fichier CSV.
// Ni Preact ni page ici : les tests unitaires les lisent directement (tests/unit/admin-console.test.mjs).
import { norm, filiereCourte, niveauOf, NIVEAUX, reponses48h, compteOuvert } from './logic.js';
import { deLEcole } from './admin-donnees.js';

const ms = d => (d ? new Date(d).getTime() || 0 : 0);

// Les tables dont chaque ligne porte une école, comme dans la base (une ligne sans école est de l'ENSAM Meknès, même en démo)
export const TABLES_ECOLE = new Set(['profiles', 'offers', 'questions', 'demandes', 'annonces', 'cafes', 'startups', 'evenements', 'placements',
  'mentorships', 'answers', 'groupe_messages', 'groupe_membres', 'relectures_cv', 'verifications_pairs', 'defis', 'ambassadeurs', 'votes',
  'reactions', 'kudos', 'cafe_participants', 'evenement_participants', 'shortlists', 'entretiens', 'avis_stage', 'enquetes_insertion',
  'liste_officielle', 'ambassadeurs_passages']);
// Les tables sans école : une ligne est de l'école du membre qu'elle concerne (un membre n'agit que dans la sienne)
export const PAR_MEMBRE = { signalements: 'auteur_id', retours_cv: 'profil_id', parrainages: 'filleul_id', propositions: 'laureat_id',
  applications: 'student_id', matchs: 'etudiant_id', match_choix: 'user_id', messages: 'author_id', comments: 'author_id',
  demandes_contact: 'demandeur_id', blocages: 'user_id', invitations: 'student_id', attestations: 'laureat_id' };

// Les données d'une école : chaque table dont les lignes portent une école, celles qui suivent leur membre, et les cartes
// sponsorisées de l'école ou de toutes les écoles (sans école) ; les autres (guide des pays…) restent entières
export function donneesDeLEcole(data, slug) {
  if (!slug) return data;
  const out = { ...data };
  for (const [t, v] of Object.entries(data)) {
    if (!Array.isArray(v)) continue;
    if (t === 'sponsorises') out[t] = v.filter(r => !r?.ecole || r.ecole === slug);
    else if (TABLES_ECOLE.has(t) || v.some(r => r && typeof r === 'object' && 'ecole' in r)) out[t] = deLEcole(v, slug);
  }
  const ids = new Set((out.profiles || []).map(p => p.id));
  for (const [t, col] of Object.entries(PAR_MEMBRE)) {
    const v = data[t];
    if (Array.isArray(v) && !v.some(r => r && typeof r === 'object' && 'ecole' in r)) out[t] = v.filter(r => ids.has(r?.[col]));
  }
  return out;
}

// La recherche de la console : membres (nom, email, promo, filière), offres (titre, entreprise), demandes (titre)
export function chercherConsole(data, comptes, q, saison) {
  const n = norm(q).trim();
  if (n.length < 2) return [];
  const mots = n.split(/\s+/).filter(Boolean);
  const ok = s => { const t = norm(s); return mots.every(m => t.includes(m)); };
  const email = new Map((comptes || []).map(c => [c.id, c.email || '']));
  const debut = s => (norm(s).startsWith(n) ? 0 : 1);
  const membres = (data.profiles || []).filter(p => p.role !== 'admin' && ok(`${p.full_name || ''} ${email.get(p.id) || ''} ${p.promo || ''} ${p.filiere || ''} ${filiereCourte(p.filiere)}`))
    .sort((a, b) => debut(a.full_name) - debut(b.full_name) || String(a.full_name).localeCompare(String(b.full_name), 'fr'))
    .slice(0, 6).map(p => ({ sorte: 'membre', cle: 'p-' + p.id, p, email: email.get(p.id) || '', sous: p.role === 'etudiant' ? `${NIVEAUX[niveauOf(p, saison)]?.short || ''} · ${p.filiere || ''}` : `${p.filiere || ''} · Promo ${p.promo}` }));
  const offres = (data.offers || []).filter(o => ok(`${o.titre || ''} ${o.entreprise || ''}`)).slice(0, 4).map(o => ({ sorte: 'offre', cle: 'o-' + o.id, o }));
  const demandes = (data.demandes || []).filter(d => ok(d.titre || '')).slice(0, 3).map(d => ({ sorte: 'demande', cle: 'd-' + d.id, d }));
  return [...membres, ...offres, ...demandes];
}

// ---------------------------------------------------------------------------
// À traiter
// ---------------------------------------------------------------------------
export const CATS = [
  ['signalements', 'Signalements', 'flag'], ['laureats', 'Lauréats à vérifier', 'shield'], ['recrutements', 'Recrutements à confirmer', 'briefcase'],
  ['demandes', 'Demandes sans proposition', 'send'], ['questions', 'Questions sans réponse', 'qa'], ['mentorats', 'Mentorats sans horaire', 'clock'],
  ['cv', 'Lectures de CV', 'file'], ['comptes', 'Comptes sans profil', 'user'],
];

// Tout ce qui attend, le plus récent d'abord : { cat, cle, at, … } (une ligne par contenu signalé, par lauréat, par recrutement…)
export function elementsATraiter(data, comptes, now = new Date()) {
  const out = [];
  const groupes = new Map();
  for (const s of (data.signalements || []).filter(x => x.status === 'ouvert')) { const k = s.cible_type + '-' + s.cible_id; if (!groupes.has(k)) groupes.set(k, []); groupes.get(k).push(s); }
  for (const [k, g] of groupes) out.push({ cat: 'signalements', cle: 'sg-' + k, at: Math.max(...g.map(s => ms(s.created_at))), g });
  for (const p of (data.profiles || []).filter(x => x.role === 'laureat' && !x.verified)) out.push({ cat: 'laureats', cle: 'lv-' + p.id, at: ms(p.created_at), p });
  for (const pl of (data.placements || []).filter(x => x.status === 'en_attente')) out.push({ cat: 'recrutements', cle: 'rc-' + pl.id, at: ms(pl.created_at), pl });
  for (const a of reponses48h(data, now).attente) out.push({ cat: a.type === 'demande' ? 'demandes' : a.type === 'question' ? 'questions' : 'mentorats', cle: a.type + '-' + a.id, at: a.at, a });
  for (const r of (data.retours_cv || []).filter(x => x.status === 'ouvert')) out.push({ cat: 'cv', cle: 'cv-' + r.id, at: ms(r.created_at), r });
  const sans = (comptes || []).filter(c => !c.a_profil && compteOuvert(c));
  if (sans.length) out.push({ cat: 'comptes', cle: 'comptes', at: Math.max(...sans.map(c => ms(c.created_at))), comptes: sans });
  return out.sort((a, b) => b.at - a.at);
}

// Le message prêt pour un lauréat, dans sa langue : qui cherche quoi, et le lien de la demande
const TYPE_MSG = { stage: ['un stage', 'تدريب'], pfe: ['un PFE', 'مشروع نهاية الدراسة'], etranger: ['un stage à l’étranger', 'تدريب في الخارج'], emploi: ['un emploi', 'عمل'] };
export function messagePourDemande(l, etu, d, lien, saison) {
  const prenom = (l?.full_name || '').split(' ')[0], pe = (etu?.full_name || '').split(' ')[0];
  // Son année (si sa promo est connue) et sa filière en code court ; rien entre parenthèses si on ne sait ni l'une ni l'autre
  const quoi = [etu?.promo ? NIVEAUX[niveauOf(etu, saison)]?.short : '', filiereCourte(etu?.filiere)].filter(Boolean).join(' · ');
  const qui = quoi ? `${pe} (${quoi})` : pe;
  const [fr, ar] = TYPE_MSG[d.type] || ['de l’aide', 'مساعدة'];
  return l?.langue === 'ar'
    ? `مرحبًا ${prenom}، ${qui} بحاجة إلى ${ar}: « ${d.titre} ». هل يمكنك إلقاء نظرة على هذا الطلب؟ ${lien} شكرًا!`
    : `Bonjour ${prenom}, ${qui} cherche ${fr} : « ${d.titre} ». Tu pourrais jeter un œil à sa demande ? ${lien} Merci !`;
}
// ---------------------------------------------------------------------------
// Membres : filtres, tri, fichier CSV
// ---------------------------------------------------------------------------
// Le menu du rôle (étiqueté « Rôle ») dit le rôle en un mot : sur téléphone, le nom du membre garde la place de se lire
export const ROLES = [['etudiant', 'Étudiant'], ['laureat', 'Lauréat']];
export const aCV = p => !!(p.cv_path || p.cv_url);
export const aPhoto = p => !!p.photo_path;
export const FILTRES = [['tous', 'Tous'], ['etudiants', 'Étudiants'], ['laureats', 'Lauréats'], ['verifier', 'À vérifier'], ['sans-cv', 'Sans CV'], ['sans-photo', 'Sans photo'], ['inactifs', 'Inactifs 30 j']];
export const TESTS = {
  tous: () => true, etudiants: p => p.role === 'etudiant', laureats: p => p.role === 'laureat', verifier: p => p.role === 'laureat' && !p.verified,
  'sans-cv': p => !aCV(p), 'sans-photo': p => !aPhoto(p),
  inactifs: (p, c, now, charges) => charges && (!c?.last_sign_in_at || now - ms(c.last_sign_in_at) > 30 * 864e5),
};
// Les colonnes du tableau, et comment chacune se trie
export const COLS = [
  ['nom', 'Membre', p => norm(p.full_name)], ['role', 'Rôle', p => p.role], ['promo', 'Promo', p => Number(p.promo) || 0], ['filiere', 'Filière', p => filiereCourte(p.filiere)],
  ['entreprise', 'Entreprise', p => norm(p.entreprise || '')], ['inscrit', 'Inscrit', p => ms(p.created_at)], ['vu', 'Dernière visite', (p, c) => ms(c?.last_sign_in_at)],
  ['verifie', 'Vérifié', p => (p.verified ? 1 : 0)], ['cv', 'CV', p => (aCV(p) ? 1 : 0)], ['photo', 'Photo', p => (aPhoto(p) ? 1 : 0)],
];
const deux = n => String(n).padStart(2, '0');
export const jour = d => { if (!d) return ''; const x = new Date(d); return `${x.getFullYear()}-${deux(x.getMonth() + 1)}-${deux(x.getDate())}`; };
export const ENTETES_CSV = ['Nom', 'Rôle', 'Promo', 'Filière', 'Entreprise', 'Poste', 'Ville', 'Email', 'Inscrit le', 'Vu le', 'Vérifié', 'CV', 'Photo'];
// Le texte d'un fichier CSV qu'Excel ouvre tel quel : point-virgule, guillemets quand il le faut, BOM pour les accents.
// Un texte qui commence par = + - @ (ou une tabulation) serait lu comme une formule : une apostrophe devant le neutralise,
// car les noms, entreprises et postes sont écrits par les membres eux-mêmes.
const celluleCSV = v => { let t = String(v ?? ''); if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[";\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
export const texteCSV = lignes => '\uFEFF' + lignes.map(r => r.map(celluleCSV).join(';')).join('\r\n');
export const ligneCSV = (p, c) => [p.full_name || '', ROLES.find(([k]) => k === p.role)?.[1] || p.role, p.promo ?? '', p.filiere || '', p.entreprise || '', p.poste || '', p.ville || '',
  c?.email || '', jour(p.created_at), jour(c?.last_sign_in_at), p.verified ? 'oui' : 'non', aCV(p) ? 'oui' : 'non', aPhoto(p) ? 'oui' : 'non'];

// Les membres retenus par les filtres, dans l'ordre choisi
export function membresFiltres(profiles, comptes, { filtre = 'tous', promo = '', q = '', tri = { k: 'inscrit', desc: true } } = {}, now = Date.now()) {
  const compte = new Map((comptes || []).map(c => [c.id, c]));
  const qq = norm(q).trim();
  const col = COLS.find(([k]) => k === tri.k) || COLS[5];
  const sens = tri.desc ? -1 : 1;
  return (profiles || []).filter(p => p.role !== 'admin')
    .filter(p => (TESTS[filtre] || TESTS.tous)(p, compte.get(p.id), now, !!comptes) && (!promo || String(p.promo) === String(promo))
      && (!qq || norm(`${p.full_name} ${p.filiere} ${filiereCourte(p.filiere)} ${p.promo} ${p.entreprise || ''} ${compte.get(p.id)?.email || ''}`).includes(qq)))
    .sort((a, b) => {
      const x = col[2](a, compte.get(a.id)), y = col[2](b, compte.get(b.id));
      return (x < y ? -1 : x > y ? 1 : 0) * sens || ms(b.created_at) - ms(a.created_at);
    });
}
