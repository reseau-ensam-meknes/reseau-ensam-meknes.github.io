// Couche de données : même interface en mode démo (navigateur) et en mode réel (Supabase).
// Les données de démonstration (seed.js) ne sont chargées qu'en démo : le site réel n'en a pas besoin
const chargerSeed = () => import('./seed.js').then(m => m.buildSeed());
import { attestationStats, seasonOf, niveauOf, sameCompany, entKey, norm, statsInsertion, rapportInsertion, cleNom, peutDiscuter, nonLus } from './logic.js';

const PHASE2 = ['groupe_messages', 'groupe_membres', 'cafes', 'cafe_participants', 'startups', 'defis', 'parrainages'];
const PHASE3 = ['coordonnees', 'demandes_contact', 'relectures_cv', 'relecture_commentaires', 'entretiens', 'avis_stage', 'guide_pays', 'signalements', 'enquetes_insertion', 'verifications_pairs', 'evenements', 'evenement_participants'];
const MESSAGERIE = ['messages', 'blocages'];
export const TABLES = ['profiles', 'offers', 'comments', 'reactions', 'applications', 'placements', 'mentorships', 'questions', 'answers', 'votes', 'shortlists', 'invitations', 'kudos', 'attestations', 'liens_rdv', 'annonces', ...PHASE2, ...PHASE3, ...MESSAGERIE];
// Tables ajoutées par supabase/mise-a-jour.sql : tant que la base n'est pas à jour, elles restent vides au lieu de bloquer le site.
const OPTIONAL = new Set(['shortlists', 'invitations', 'kudos', 'attestations', 'liens_rdv', 'annonces', ...PHASE2, ...PHASE3, ...MESSAGERIE]);
// Lues par une vue qui masque ce que chacun a choisi de cacher (auteur anonyme, visibilité du profil).
// Tant que la base n'a pas ces vues, on lit la table elle-même.
const VUES = { profiles: 'profils', entretiens: 'entretiens_publics', avis_stage: 'avis_publics' };
export const CV_MAX = 2 * 1024 * 1024;
// Messagerie : photos et vocaux (5 Mo au plus, 2 minutes de vocal)
export const CHAT_MAX = 5 * 1024 * 1024;
export const VOCAL_MAX = 120;
// Qui voit quoi sur un profil : tous | laureats | contacts (personnes acceptées). Le CV est réservé aux lauréats par défaut.
export const VIS_DEFAUT = { travail: 'tous', lieu: 'tous', linkedin: 'tous', presentation: 'tous', cv: 'laureats' };
export const VIS_CHAMPS = { travail: ['entreprise', 'poste', 'secteur'], lieu: ['ville'], linkedin: ['linkedin'], presentation: ['bio', 'competences', 'disponibilite'], cv: ['cv_url', 'cv_path', 'cv_maj'] };

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
// Salle de visio Jitsi : gratuite, sans compte pour l'invité, nom impossible à deviner
export const jitsiLink = () => 'https://meet.jit.si/ReseauENSAM-' + Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
const demoEmail = p => (p?.full_name || 'membre').toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').trim().replace(/ +/g, '.') + '@exemple.ma';

function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeSet(key, v) { try { localStorage.setItem(key, v); } catch { /* stockage indisponible */ } }

class Base {
  constructor() { this.data = Object.fromEntries(TABLES.map(t => [t, []])); this.listeners = new Set(); this.me = null; this.reglages = {}; }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.data = { ...this.data }; for (const fn of this.listeners) fn(); }
  byId(table, id) { return this.data[table].find(r => r.id === id); }
  // En ligne, la base a déjà masqué ce qui ne doit pas être vu : ces deux aides servent surtout à la démo.
  voitChamp(p, champ) { return !!p; }
  coordonneesDe(id) { return this.byId('coordonnees', id) || null; }
  // Domaines de l'email de l'école (réglage de l'administration), en minuscules
  domainesEcole() { return Array.isArray(this.reglages.domaines_ecole) ? this.reglages.domaines_ecole.map(d => String(d).trim().toLowerCase()).filter(Boolean) : []; }
  // Messagerie : peut-on écrire à ce membre, combien de messages attendent
  peutDiscuter(id) { return peutDiscuter(this.data, this.me, id, x => this.byId('profiles', x)); }
  nonLus() { return this.me ? nonLus(this.data, this.me.id) : 0; }
  // Demande de contact entre moi et ce membre (dans un sens ou dans l'autre)
  contactAvec(id) {
    const me = this.me?.id;
    return this.data.demandes_contact.find(d => d.demandeur_id === me && d.cible_id === id) || this.data.demandes_contact.find(d => d.demandeur_id === id && d.cible_id === me) || null;
  }
}

// Mêmes règles que en_relation() dans la base : une demande de contact acceptée, ou une candidature à son offre
export function enRelation(data, viewer, owner) {
  if (!viewer || !owner) return false;
  return data.demandes_contact.some(d => d.status === 'acceptee' && ((d.demandeur_id === viewer && d.cible_id === owner) || (d.demandeur_id === owner && d.cible_id === viewer)))
    || data.applications.some(a => a.student_id === owner && a.offer_id && data.offers.some(o => o.id === a.offer_id && o.author_id === viewer));
}
export function voitChampDemo(data, me, p, champ) {
  if (!p || !me) return false;
  if (p.id === me.id || me.role === 'admin') return true;
  const a = (p.visibilite || {})[champ] || VIS_DEFAUT[champ] || 'tous';
  if (a === 'tous') return true;
  if (a === 'laureats' && me.role === 'laureat') return true;
  return enRelation(data, me.id, p.id);
}

// Petit PDF d'exemple (une page de texte) pour les CV de la démo
export function pdfSimple(lignes) {
  const esc = t => Array.from(String(t)).map(c => { const k = c.charCodeAt(0); if (c === '(' || c === ')' || c === '\\') return '\\' + c; if (k < 32) return ' '; if (k < 127) return c; const w = { '’': 146, '–': 150, '—': 151, '…': 133, 'œ': 156, '€': 128 }[c] ?? (k < 256 ? k : 63); return '\\' + w.toString(8).padStart(3, '0'); }).join('');
  const flux = ['BT', '/F1 11 Tf', '14 TL', '56 780 Td', ...lignes.flatMap((l, i) => [i === 0 ? '/F1 18 Tf' : i === 1 ? '/F1 11 Tf' : '', `(${esc(l)}) Tj T*`]).filter(Boolean), 'ET'].join('\n');
  const objets = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`];
  let out = '%PDF-1.4\n'; const pos = [];
  objets.forEach((o, i) => { pos.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n` + pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([Uint8Array.from(out, c => c.charCodeAt(0) & 255)], { type: 'application/pdf' });
}

// ---------------------------------------------------------------------------
// Démo : données d'exemple, gardées dans le navigateur du visiteur
// ---------------------------------------------------------------------------
const DEMO_KEY = 'ensam-demo-v10';
class DemoStore extends Base {
  constructor() { super(); this.mode = 'demo'; this.fichiers = new Map(); }
  async init() {
    let saved = null;
    try { saved = JSON.parse(safeGet(DEMO_KEY) || 'null'); } catch { saved = null; }
    this.data = saved?.data || await chargerSeed();
    for (const t of [...TABLES, 'guide_pays_historique', 'liste_officielle']) this.data[t] ||= [];
    this.reglages = saved?.reglages || {};
    const meId = saved?.meId || this.data.profiles.find(p => p.role === 'etudiant' && p._persona)?.id;
    this.me = this.byId('profiles', meId) || null;
    this.ready = true;
  }
  persist() { safeSet(DEMO_KEY, JSON.stringify({ data: this.data, meId: this.me?.id, reglages: this.reglages })); }
  personas() { const o = { etudiant: 0, laureat: 1, admin: 2 }; return this.data.profiles.filter(p => p._persona).sort((a, b) => o[a.role] - o[b.role]); }
  switchTo(id) { this.me = this.byId('profiles', id); this.persist(); this.emit(); }
  async reset() { this.data = await chargerSeed(); for (const t of ['guide_pays_historique', 'liste_officielle']) this.data[t] ||= []; this.reglages = {}; this.me = this.personas()[0]; this.persist(); this.emit(); }
  async insert(table, row) {
    const r = { id: uuid(), created_at: new Date().toISOString(), ...row };
    if (table === 'placements') applyPlacementRules(this, r, null);
    if (table === 'applications') applyApplicationRules(this, r, null);
    if (table === 'mentorships') applyMentorshipRules(this, r, null);
    if (table === 'liens_rdv') applyLienRules(this, r, null);
    if (table === 'annonces') { if (this.me?.role !== 'admin') throw new Error('Action non autorisée pour ton compte.'); r.author_id = this.me.id; }
    if (table === 'shortlists') { r.laureat_id = this.me?.id; if (this.data.shortlists.some(x => x.laureat_id === r.laureat_id && x.student_id === r.student_id)) return r; }
    if (table === 'kudos') { r.user_id = this.me?.id; if (this.data.kudos.some(x => x.placement_id === r.placement_id && x.user_id === r.user_id)) return r; }
    if (table === 'invitations') applyInvitationRules(this, r, null);
    if (MESSAGERIE.includes(table) && applyMessagerieRules(this, table, r, null) === false) return r;
    if (PHASE2.includes(table) && applyPhase2Rules(this, table, r, null) === false) return r;
    if (table === 'attestations') { if (this.me?.role !== 'laureat') throw new Error('Seul un lauréat peut obtenir une attestation.'); Object.assign(r, { laureat_id: this.me.id, stats: attestationStats(this.data, this.me.id) }); }
    limiteDemo(this, table, r);
    if (PHASE3.includes(table)) applyPhase3Rules(this, table, r, null);
    if (table === 'reactions' && this.data.reactions.some(x => x.offer_id === r.offer_id && x.user_id === r.user_id && x.kind === r.kind)) return r;
    if (table === 'votes' && this.data.votes.some(x => x.answer_id === r.answer_id && x.user_id === r.user_id)) return r;
    if (table === 'placements' && this.data.placements.some(x => x.student_id === r.student_id && x.saison === r.saison && x.status !== 'refuse')) throw new Error('Une réussite est déjà enregistrée pour cet étudiant cette saison.');
    this.data[table] = [r, ...this.data[table]];
    if (table === 'profiles' && r.id === this.me?.id) this.me = r;
    if (table === 'cafes') this.data.cafe_participants = [{ id: uuid(), cafe_id: r.id, user_id: r.organisateur_id, created_at: r.created_at }, ...this.data.cafe_participants];
    if (table === 'verifications_pairs') { const c = this.byId('profiles', r.laureat_id); if (c && !c.verified && pairsValides(this.data, c) >= 2) this.data.profiles = this.data.profiles.map(p => p.id === c.id ? { ...p, verified: true } : p); }
    if (table === 'profiles') demoParrains(this);
    this.persist(); this.emit();
    return r;
  }
  async update(table, id, patch) {
    const old = this.byId(table, id); if (!old) return null;
    const r = { ...old, ...patch };
    if (table === 'placements') applyPlacementRules(this, r, old);
    if (table === 'applications') applyApplicationRules(this, r, old);
    if (table === 'invitations') applyInvitationRules(this, r, old);
    if (table === 'mentorships') applyMentorshipRules(this, r, old);
    if (table === 'liens_rdv') applyLienRules(this, r, old);
    if (table === 'annonces' && this.me?.role !== 'admin') throw new Error('Action non autorisée pour ton compte.');
    if (MESSAGERIE.includes(table)) applyMessagerieRules(this, table, r, old);
    if (PHASE2.includes(table)) applyPhase2Rules(this, table, r, old);
    if (PHASE3.includes(table)) applyPhase3Rules(this, table, r, old);
    if (table === 'profiles' && this.me?.role !== 'admin') { r.verified = r.role !== old.role ? false : old.verified; if (!r.verified && verifieAuto(this, r)) r.verified = true; }
    if (table === 'profiles' && this.me?.role === 'admin' && old.verified && !r.verified) this.data.verifications_pairs = this.data.verifications_pairs.filter(v => v.laureat_id !== id);
    this.data[table] = this.data[table].map(x => x.id === id ? r : x);
    if (table === 'profiles' && id === this.me?.id) this.me = r;
    if (table === 'profiles' && r.parrain_dispo && !old.parrain_dispo) demoParrains(this);
    this.persist(); this.emit();
    return r;
  }
  async remove(table, id) {
    if (table === 'annonces' && this.me?.role !== 'admin') throw new Error('Action non autorisée pour ton compte.');
    const row = this.byId(table, id);
    if (PHASE2.includes(table) && row && this.me?.role !== 'admin') {
      const own = { groupe_messages: 'author_id', groupe_membres: 'user_id', cafes: 'organisateur_id', cafe_participants: 'user_id', startups: 'fondateur_id' }[table];
      if (!own || row[own] !== this.me?.id) throw new Error('Action non autorisée pour ton compte.');
    }
    if (MESSAGERIE.includes(table) && row && this.me?.role !== 'admin' && row[table === 'messages' ? 'author_id' : 'user_id'] !== this.me?.id) throw new Error('Action non autorisée pour ton compte.');
    if (PHASE3.includes(table) && row && this.me?.role !== 'admin') {
      const me = this.me?.id;
      const ok = {
        coordonnees: row.id === me, demandes_contact: row.demandeur_id === me && row.status === 'envoyee',
        relectures_cv: row.student_id === me && ['demandee', 'annulee'].includes(row.status), relecture_commentaires: row.author_id === me,
        entretiens: row.author_id === me, avis_stage: row.author_id === me, signalements: row.auteur_id === me && row.status === 'ouvert',
        enquetes_insertion: row.user_id === me, verifications_pairs: row.verificateur_id === me, evenement_participants: row.user_id === me,
      }[table];
      if (!ok) throw new Error('Action non autorisée pour ton compte.');
    }
    this.data[table] = this.data[table].filter(x => x.id !== id);
    this.persist(); this.emit();
  }
  async signOut() {}
  // Email de l'étudiant, pour le seul lauréat qui a fixé le rendez-vous (invitation Google Agenda)
  async emailRdv(id) {
    const m = this.byId('mentorships', id);
    return m && m.status === 'acceptee' && m.mentor_id === this.me?.id ? demoEmail(this.byId('profiles', m.student_id)) : null;
  }
  async adminComptes() {
    if (this.me?.role !== 'admin') throw new Error('Réservé à l’administration.');
    const rows = this.data.profiles.map((p, i) => ({ id: p.id, email: demoEmail(p), created_at: p.created_at, last_sign_in_at: new Date(Date.now() - (i % 9) * 864e5 - 36e5).toISOString(), a_profil: true }));
    return [{ id: 'sans-profil', email: 'nouveau.compte@exemple.ma', created_at: new Date(Date.now() - 5 * 36e5).toISOString(), last_sign_in_at: null, a_profil: false }, ...rows];
  }
  // Parrain d'un 3A : le lauréat volontaire de sa filière qui a le moins de filleuls (même règle que la base)
  async monParrain() { demoParrains(this, this.me?.id); this.persist(); this.emit(); }
  async attribuerParrains() { const n = demoParrains(this); this.persist(); this.emit(); return n; }
  async supprimerCompte() { throw new Error('En démo, aucun compte n’est supprimé. Sur la vraie plateforme, ton compte et tes données partent tout de suite.'); }
  async seDesabonner() { return true; }
  async pushKey() { return null; }
  async verifyAttestation(id) {
    const a = this.byId('attestations', id); if (!a) return null;
    const p = this.byId('profiles', a.laureat_id);
    return { id: a.id, full_name: p?.full_name, filiere: p?.filiere, promo: p?.promo, stats: a.stats, created_at: a.created_at };
  }
  // Phase 3
  voitChamp(p, champ) { return voitChampDemo(this.data, this.me, p, champ); }
  coordonneesDe(id) {
    const me = this.me; if (!me) return null;
    return id === me.id || me.role === 'admin' || enRelation(this.data, me.id, id) ? this.byId('coordonnees', id) || null : null;
  }
  async enregistrerCoordonnees(champs) {
    const id = this.me.id;
    return this.byId('coordonnees', id) ? this.update('coordonnees', id, champs) : this.insert('coordonnees', { id, ...champs });
  }
  // CV : en démo, le fichier reste dans l'onglet (pas de stockage réel)
  async deposerCV(file) {
    verifierPdf(file);
    const ancien = this.me.cv_path;
    const path = `${this.me.id}/cv-${Date.now()}.pdf`;
    this.fichiers.set(path, file);
    const r = await this.update('profiles', this.me.id, { cv_path: path, cv_maj: new Date().toISOString() });
    if (ancien && !cvReference(this.data, ancien)) this.fichiers.delete(ancien);
    return r;
  }
  async retirerCV() {
    const ancien = this.me.cv_path;
    const r = await this.update('profiles', this.me.id, { cv_path: null, cv_maj: null });
    if (ancien && !cvReference(this.data, ancien)) this.fichiers.delete(ancien);
    return r;
  }
  async lienCV(path) {
    if (!path) return null;
    const owner = this.byId('profiles', path.split('/')[0]);
    const relu = this.data.relectures_cv.some(r => r.cv_path === path && r.status !== 'annulee' && (r.reviewer_id === this.me?.id || (!r.reviewer_id && r.status === 'demandee' && this.me?.role === 'laureat')));
    if (!relu && !(owner && owner.cv_path === path && this.voitChamp(owner, 'cv'))) throw new Error('Ce CV n’est pas visible pour ton compte.');
    const f = this.fichiers.get(path) || pdfSimple(cvDemo(owner));
    return URL.createObjectURL(f);
  }
  async lireReglages() { return this.reglages; }
  async enregistrerReglage(cle, valeur) {
    if (this.me?.role !== 'admin') throw new Error('Réservé à l’administration.');
    this.reglages = { ...this.reglages, [cle]: valeur }; this.persist(); this.emit();
  }
  async rapportInsertion() {
    if (this.me?.role !== 'admin') throw new Error('Réservé à l’administration.');
    return rapportInsertion(this.data);
  }
  async historiqueGuide(guideId) { return this.data.guide_pays_historique.filter(h => h.guide_id === guideId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); }
  async statsInsertion() { return statsInsertion(this.data.enquetes_insertion).filter(g => this.me?.role === 'admin' || g.n >= 5); }
  async seDesabonnerAlertes() { return true; }
  async seDesabonnerMessages() { return true; }
  // Messagerie : en démo, les photos et vocaux restent dans l'onglet (pas de stockage réel)
  async envoyerMessage({ dest, type = 'texte', body = null, fichier: blob = null, ext = 'jpg', ...meta }) {
    let fichier = null;
    if (blob) { verifierFichierChat(blob); fichier = `${this.me.id}/${dest}/${uuid()}.${ext}`; this.fichiers.set(fichier, blob); }
    try { return await this.insert('messages', { author_id: this.me.id, dest_id: dest, type, body, fichier, ...meta }); }
    catch (e) { if (fichier) this.fichiers.delete(fichier); throw e; }
  }
  async lienChat(path) {
    const f = path && this.fichiers.get(path);
    if (!f) return null;
    this.urlsChat ||= new Map();
    if (!this.urlsChat.has(path)) this.urlsChat.set(path, URL.createObjectURL(f));
    return this.urlsChat.get(path);
  }
  async marquerLus(de) {
    const me = this.me?.id; const now = new Date().toISOString(); let n = 0;
    this.data.messages = this.data.messages.map(m => { if (m.author_id !== de || m.dest_id !== me || m.lu_at) return m; n++; return { ...m, lu_at: now }; });
    if (n) { this.persist(); this.emit(); }
    return n;
  }
  async supprimerMessage(id) {
    const m = this.byId('messages', id);
    await this.remove('messages', id);
    if (m?.fichier) this.fichiers.delete(m.fichier);
  }
  canal() { return { tape() {}, fermer() {} }; }
  // Liste officielle (administration)
  async importerListe(lignes, remplacer = false) {
    if (this.me?.role !== 'admin') throw new Error('Réservé à l’administration.');
    let L = this.data.liste_officielle; let importes = 0, rejetes = 0;
    if (remplacer) { const promos = new Set(lignes.map(x => +x.promo).filter(Boolean)); L = L.filter(x => !promos.has(x.promo)); }
    for (const x of lignes) {
      const nom = String(x.nom || '').trim().replace(/\s+/g, ' ').slice(0, 120); const promo = /^\d{4}$/.test(String(x.promo ?? '')) ? +x.promo : null;
      let email = String(x.email || '').trim().toLowerCase() || null; if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) email = null;
      if (nom.length < 2 || !cleNom(nom) || !promo || promo < 1990 || promo > 2040) { rejetes++; continue; }
      const old = L.find(l => l.promo === promo && cleNom(l.nom) === cleNom(nom));
      const champs = { email, filiere: String(x.filiere || '').trim() || null, matricule: String(x.matricule || '').trim() || null };
      if (old) { for (const [k, v] of Object.entries(champs)) if (v) old[k] = v; } else L = [...L, { id: uuid(), nom, promo, ...champs, created_at: new Date().toISOString() }];
      importes++;
    }
    this.data.liste_officielle = L;
    let verifies = 0;
    this.data.profiles = this.data.profiles.map(p => { if (p.verified || p.role === 'admin' || !dansListe(this.data, p, demoEmail(p))) return p; verifies++; return { ...p, verified: true }; });
    this.me = this.byId('profiles', this.me.id);
    this.persist(); this.emit();
    return { importes, rejetes, verifies };
  }
  async couvertureListe() {
    if (this.me?.role !== 'admin') throw new Error('Réservé à l’administration.');
    const g = new Map();
    for (const l of this.data.liste_officielle) {
      const k = l.promo + '|' + (l.filiere || ''); const x = g.get(k) || { promo: l.promo, filiere: l.filiere || '', total: 0, inscrits: 0 };
      x.total++; if (inscritDeListe(this.data, l)) x.inscrits++; g.set(k, x);
    }
    return [...g.values()].sort((a, b) => b.promo - a.promo || a.filiere.localeCompare(b.filiere));
  }
  async manquantsListe(promo) {
    if (this.me?.role !== 'admin') throw new Error('Réservé à l’administration.');
    return this.data.liste_officielle.filter(l => l.promo === +promo && !inscritDeListe(this.data, l)).map(({ nom, email, filiere }) => ({ nom, email, filiere }));
  }
  async viderListe(promo) {
    if (this.me?.role !== 'admin') throw new Error('Réservé à l’administration.');
    this.data.liste_officielle = this.data.liste_officielle.filter(l => promo != null && l.promo !== +promo);
    this.persist(); this.emit();
  }
}

function verifierPdf(file) {
  if (!file) throw new Error('Choisis un fichier PDF.');
  if (file.type && file.type !== 'application/pdf' || !/\.pdf$/i.test(file.name || 'cv.pdf')) throw new Error('Seuls les fichiers PDF sont acceptés.');
  if (file.size > CV_MAX) throw new Error('Le fichier dépasse 2 Mo. Exporte ton CV en PDF plus léger.');
}
// Un ancien CV reste gardé tant qu'une relecture en cours ou rendue s'y rapporte
const cvReference = (data, path) => data.relectures_cv.some(r => r.cv_path === path && r.status !== 'annulee');
const cvDemo = p => [p?.full_name || 'CV', `${p?.filiere || ''} · ENSAM Meknès · promo ${p?.promo || ''}`, '', 'CV de démonstration (données fictives).', '',
  'Formation', '  Cycle ingénieur, ENSAM Meknès', '  Classes préparatoires intégrées', '', 'Expériences', '  Stage ingénieur adjoint (2 mois)', '  Stage ouvrier (1 mois)', '',
  'Compétences', '  ' + ((p?.competences || []).join(', ') || 'Lean, Python, CAO'), '', 'Langues', '  Arabe, français, anglais'];
const pairsValides = (data, c) => data.verifications_pairs.filter(v => v.laureat_id === c.id).map(v => data.profiles.find(x => x.id === v.verificateur_id)).filter(x => x && x.role === 'laureat' && x.verified && x.promo === c.promo).length;
const emailEcole = (store, email) => store.domainesEcole().some(d => (email || '').toLowerCase().endsWith('@' + d) || (email || '').toLowerCase().endsWith('.' + d));
const verifieAuto = (store, p) => dansListe(store.data, p, demoEmail(p)) || (p.role === 'etudiant' && emailEcole(store, demoEmail(p))) || (p.role === 'laureat' && pairsValides(store.data, p) >= 2);
const dansListe = (data, p, email) => data.liste_officielle.some(l => (l.promo === p.promo && cleNom(l.nom) === cleNom(p.full_name)) || (l.email && l.email === (email || '').toLowerCase()));
const inscritDeListe = (data, l) => data.profiles.some(p => (l.email && demoEmail(p) === l.email) || (p.promo === l.promo && cleNom(p.full_name) === cleNom(l.nom)));

// Limites anti-spam : mêmes chiffres que limiter() dans la base
const LIMITES = {
  offers: ['author_id', 10, 864e5, 'titre'], comments: ['author_id', 40, 864e5, 'body'], questions: ['author_id', 5, 864e5, 'titre'],
  answers: ['author_id', 30, 864e5, 'body'], groupe_messages: ['author_id', 60, 864e5, 'body'], invitations: ['laureat_id', 30, 864e5],
  applications: ['student_id', 10, 864e5], evenement_participants: ['user_id', 30, 864e5], verifications_pairs: ['verificateur_id', 20, 864e5], mentorships: ['student_id', 6, 864e5], cafes: ['organisateur_id', 3, 864e5], startups: ['fondateur_id', 3, 864e5],
  entretiens: ['author_id', 10, 864e5], avis_stage: ['author_id', 10, 864e5], demandes_contact: ['demandeur_id', 5, 864e5],
  signalements: ['auteur_id', 10, 864e5], relectures_cv: ['student_id', 4, 864e5], relecture_commentaires: ['author_id', 60, 36e5],
  messages: ['author_id', 300, 864e5],
};
function limiteDemo(store, table, r) {
  const L = LIMITES[table]; const me = store.me;
  if (!L || !me || me.role === 'admin') return;
  const [col, max, ms, txt] = L; const now = Date.now();
  const miens = store.data[table].filter(x => x[col] === me.id);
  if (miens.filter(x => now - new Date(x.created_at) < ms).length >= max) throw new Error('Doucement : tu as beaucoup publié en peu de temps. Réessaie un peu plus tard.');
  const t = txt && String(r[txt] || '').trim().toLowerCase();
  if (t && miens.some(x => now - new Date(x.created_at) < 864e5 && String(x[txt] || '').trim().toLowerCase() === t)) throw new Error('Tu as déjà publié exactement ce texte.');
}

// Messagerie : mêmes règles que protect_message(), peut_discuter() et protect_blocage() dans la base
function applyMessagerieRules(store, table, r, old) {
  const me = store.me; const isAdmin = me?.role === 'admin';
  if (table === 'blocages') {
    if (old) throw new Error('Action non autorisée pour ton compte.');
    r.user_id = me.id;
    if (r.bloque_id === me.id) throw new Error('Choisis un autre membre que toi.');
    if (store.data.blocages.some(b => b.user_id === me.id && b.bloque_id === r.bloque_id)) return false;
    return;
  }
  if (!old) {
    r.author_id = me.id; r.lu_at = null; r.body = String(r.body || '').trim() || null;
    if (r.type === 'texte' && !r.body) throw new Error('Écris ton message.');
    if (r.body && r.body.length > 2000) throw new Error('Ton message est trop long (2 000 caractères au plus).');
    if (r.type !== 'texte' && !r.fichier) throw new Error('Fichier manquant.');
    if (r.type === 'vocal') r.body = null;
    if (!peutDiscuter(store.data, me, r.dest_id, x => store.byId('profiles', x))) throw new Error('Conversation pas encore ouverte : elle s’ouvre avec un mentorat, une candidature ou une demande de contact acceptée.');
    return;
  }
  const v = r.lu_at; Object.assign(r, old);
  if (isAdmin || me.id === old.dest_id) r.lu_at = old.lu_at || (v ? new Date().toISOString() : null);
}

function verifierFichierChat(f) {
  if (!f) throw new Error('Fichier manquant.');
  if (f.size > CHAT_MAX) throw new Error('Fichier trop lourd (5 Mo au plus).');
  if (f.type && !/^(image\/(jpeg|png|webp)|audio\/(webm|ogg|mp4|mpeg|aac))/.test(f.type)) throw new Error('Ce format n’est pas accepté : une photo ou un message vocal.');
}

// Phase 3 : mêmes règles que les triggers de la base (protect_relecture, protect_avis, protect_guide…)
function applyPhase3Rules(store, table, r, old) {
  const me = store.me; const isAdmin = me?.role === 'admin'; const now = new Date().toISOString();
  const deny = () => { throw new Error('Action non autorisée pour ton compte.'); };
  if (table === 'coordonnees') {
    if (!isAdmin && (old ? old.id : r.id) !== me.id) deny();
    r.updated_at = now; return;
  }
  if (table === 'demandes_contact') {
    if (!old) {
      if (isAdmin) return;
      r.demandeur_id = me.id; Object.assign(r, { status: 'envoyee', repondu_at: null });
      if (r.cible_id === me.id) throw new Error('Choisis un autre membre que toi.');
      if (store.data.demandes_contact.some(d => d.demandeur_id === me.id && d.cible_id === r.cible_id)) throw new Error('Tu as déjà envoyé une demande à ce membre.');
      return;
    }
    if (isAdmin) return;
    const v = r.status; Object.assign(r, old);
    if (me.id === old.cible_id && ['acceptee', 'refusee'].includes(v) && v !== old.status) { r.status = v; r.repondu_at = now; }
    return;
  }
  if (table === 'relectures_cv') {
    if (isAdmin) return;
    if (!old) {
      r.student_id = me.id; r.cv_path = store.byId('profiles', me.id)?.cv_path || null;
      if (!r.cv_path) throw new Error('Dépose d’abord ton CV en PDF dans ton profil.');
      if (r.reviewer_id === me.id) throw new Error('Choisis un autre lauréat que toi.');
      if (r.reviewer_id && store.byId('profiles', r.reviewer_id)?.role !== 'laureat') throw new Error('Choisis un lauréat.');
      if (store.data.relectures_cv.filter(x => x.student_id === me.id && ['demandee', 'en_cours'].includes(x.status)).length >= 2) throw new Error('Tu as déjà 2 relectures en cours. Attends un retour avant d’en demander une autre.');
      Object.assign(r, { reviewer_id: r.reviewer_id || null, status: 'demandee', synthese: null, merci: null, note: null, pris_at: null, rendue_at: null });
      return;
    }
    const v = { ...r }; Object.assign(r, old);
    if (!old.reviewer_id && old.status === 'demandee' && v.reviewer_id === me.id && me.id !== old.student_id) {
      if (me.role !== 'laureat') throw new Error('Seul un lauréat peut relire un CV.');
      r.reviewer_id = me.id;
    }
    if (r.reviewer_id === me.id && me.id !== old.student_id) {
      if (['demandee', 'en_cours'].includes(old.status)) {
        r.synthese = v.synthese;
        if (!v.reviewer_id) Object.assign(r, { reviewer_id: null, status: 'demandee', pris_at: null });
        else if (v.status === 'rendue') {
          if (!(v.synthese || '').trim() && !store.data.relecture_commentaires.some(c => c.relecture_id === old.id && c.author_id === me.id)) throw new Error('Ajoute au moins un commentaire avant de rendre la relecture.');
          Object.assign(r, { status: 'rendue', rendue_at: now, pris_at: old.pris_at || now });
        } else if (old.status === 'demandee') Object.assign(r, { status: 'en_cours', pris_at: now });
      }
      return;
    }
    if (me.id === old.student_id) {
      if (['demandee', 'en_cours'].includes(old.status) && v.status === 'annulee') r.status = 'annulee';
      if (old.status === 'demandee') r.message = v.message;
      if (old.status === 'rendue') { r.merci = v.merci; r.note = v.note; }
      return;
    }
    if (v.reviewer_id === me.id) throw new Error('Un autre lauréat vient de prendre cette demande.');
    return;
  }
  if (table === 'relecture_commentaires') {
    if (old) deny();
    if (isAdmin) return;
    const rel = store.byId('relectures_cv', r.relecture_id);
    r.author_id = me.id;
    if (!rel || rel.status === 'annulee') throw new Error('Cette relecture n’est plus ouverte.');
    if (me.id === rel.reviewer_id) return;
    if (me.id === rel.student_id && rel.reviewer_id) { r.section = 'general'; return; }
    throw new Error('Seuls l’étudiant et le lauréat qui relit peuvent commenter.');
  }
  if (table === 'entretiens') {
    r.questions = (r.questions || []).map(x => String(x).trim().slice(0, 300)).filter(Boolean).slice(0, 20);
    if (!r.questions.length) throw new Error('Ajoute au moins une question.');
    if (isAdmin) return;
    if (!old) { r.author_id = me.id; if (r.offer_id && !store.data.applications.some(a => a.offer_id === r.offer_id && a.student_id === me.id)) r.offer_id = null; return; }
    for (const k of ['author_id', 'entreprise', 'type', 'saison', 'offer_id', 'created_at']) r[k] = old[k];
    return;
  }
  if (table === 'avis_stage') {
    if (!isAdmin) {
      if (!old) r.author_id = me.id;
      else for (const k of ['author_id', 'entreprise', 'type', 'saison', 'placement_id', 'created_at']) r[k] = old[k];
    }
    if (!old && store.data.avis_stage.some(a => a.author_id === r.author_id && a.saison === r.saison && entKey(a.entreprise) === entKey(r.entreprise))) throw new Error('Tu as déjà donné ton avis sur cette entreprise pour cette saison.');
    if (r.placement_id && !store.data.placements.some(p => p.id === r.placement_id && p.student_id === r.author_id)) r.placement_id = null;
    if (!r.placement_id) r.placement_id = store.data.placements.filter(p => p.student_id === r.author_id && p.saison === r.saison && p.status !== 'refuse' && sameCompany(p.entreprise, r.entreprise)).sort((a, b) => (b.status === 'confirme') - (a.status === 'confirme'))[0]?.id || null;
    r.verifie = !!r.placement_id && store.byId('placements', r.placement_id)?.status === 'confirme';
    return;
  }
  if (table === 'guide_pays') {
    if (old) {
      r.pays = old.pays; r.section = old.section; r.created_at = old.created_at;
      if (r.contenu !== old.contenu) store.data.guide_pays_historique = [{ id: uuid(), guide_id: old.id, contenu: old.contenu, updated_by: old.updated_by, updated_at: old.updated_at, created_at: now }, ...store.data.guide_pays_historique];
    } else if (store.data.guide_pays.some(g => norm(g.pays) === norm(r.pays) && g.section === r.section)) throw new Error('Cette rubrique existe déjà : recharge la page pour la modifier.');
    if (!isAdmin && (norm(r.pays) === 'maroc' || me.role !== 'laureat' || norm(me.pays || '') !== norm(r.pays))) throw new Error('Seuls les lauréats qui vivent dans ce pays peuvent écrire son guide.');
    r.updated_by = me.id; r.updated_at = now;
    return;
  }
  if (table === 'signalements') {
    if (!old) {
      r.auteur_id = me.id; Object.assign(r, { status: 'ouvert', traite_par: null, traite_at: null });
      if (store.data.signalements.some(s => s.auteur_id === me.id && s.cible_type === r.cible_type && s.cible_id === r.cible_id)) throw new Error('Tu as déjà signalé ce contenu. Merci !');
      return;
    }
    if (!isAdmin) deny();
    if (r.status !== old.status) { r.traite_par = me.id; r.traite_at = now; }
    return;
  }
  if (table === 'verifications_pairs') {
    if (old) deny();
    if (!isAdmin) r.verificateur_id = me.id;
    const c = store.byId('profiles', r.laureat_id), v = store.byId('profiles', r.verificateur_id);
    if (c?.role !== 'laureat') throw new Error('Seul un profil de lauréat peut être confirmé.');
    if (v?.role !== 'laureat' || !v.verified || v.promo !== c.promo || v.id === c.id) throw new Error('Seul un lauréat vérifié de la même promo peut confirmer ce profil.');
    if (store.data.verifications_pairs.some(x => x.laureat_id === c.id && x.verificateur_id === v.id)) throw new Error('C’est déjà fait.');
    return;
  }
  if (table === 'evenements') {
    if (!isAdmin) deny();
    if (!old) r.author_id = me.id;
    if (r.lien && !/^https:\/\/\S+$/i.test(r.lien)) throw new Error('Le lien doit commencer par https://');
    r.annule = !!r.annule; r.public ||= 'tous'; r.type ||= 'autre';
    return;
  }
  if (table === 'evenement_participants') {
    if (old) deny();
    if (!isAdmin) r.user_id = me.id;
    const e = store.byId('evenements', r.evenement_id);
    if (!e) throw new Error('Cet événement n’existe plus.');
    if (e.annule) throw new Error('Cet événement est annulé.');
    if (new Date(e.fin || e.debut) < new Date()) throw new Error('Cet événement est déjà passé.');
    if (store.data.evenement_participants.some(x => x.evenement_id === r.evenement_id && x.user_id === r.user_id)) throw new Error('C’est déjà fait.');
    return;
  }
  if (table === 'enquetes_insertion') {
    if (old) { r.user_id = old.user_id; r.vague = old.vague; r.created_at = old.created_at; }
    if (!isAdmin) {
      if (!old) r.user_id = me.id;
      const p = store.byId('profiles', r.user_id);
      if (p?.role !== 'laureat' && niveauOf(p, seasonOf()) < 6) throw new Error('L’enquête s’adresse aux lauréats.');
      r.promo = p.promo; r.filiere = p.filiere;
      if (!old && store.data.enquetes_insertion.some(e => e.user_id === r.user_id && e.vague === r.vague)) throw new Error('Tu as déjà répondu à cette enquête.');
    }
    r.updated_at = now;
  }
}

// Mêmes règles que le serveur (supabase/schema.sql), pour que la démo se comporte comme la vraie plateforme.
// Un recrutement via une offre est déclaré par le lauréat auteur, puis confirmé par l'étudiant.
function applyPlacementRules(store, r, old) {
  const me = store.me; const isAdmin = me?.role === 'admin';
  if (!old) {
    if (isAdmin) { if (r.status === 'confirme') r.confirmed_at = new Date().toISOString(); return; }
    if (r.student_id === me?.id) { Object.assign(r, { source: 'autre', status: 'declare', offer_id: null, laureat_id: null }); return; }
    if (me?.role !== 'laureat') throw new Error('Seul un lauréat peut déclarer un recrutement.');
    if (r.offer_id && store.byId('offers', r.offer_id)?.author_id !== me.id) throw new Error('Seul l’auteur de l’offre peut déclarer ce recrutement.');
    Object.assign(r, { laureat_id: me.id, source: 'plateforme', status: 'en_attente', confirmed_at: null });
    return;
  }
  if (isAdmin) { if (r.status === 'confirme' && old.status !== 'confirme') r.confirmed_at = new Date().toISOString(); return; }
  if (old.student_id === me?.id) {
    if (r.status !== old.status && !(old.status === 'en_attente' && ['confirme', 'refuse'].includes(r.status))) r.status = old.status;
    if (r.status === 'confirme' && old.status !== 'confirme') r.confirmed_at = new Date().toISOString();
    if (old.source !== 'autre') for (const k of ['entreprise', 'ville', 'pays', 'type', 'offer_id', 'laureat_id', 'saison', 'niveau']) r[k] = old[k];
    return;
  }
  throw new Error('Seul l’étudiant concerné peut confirmer ce recrutement.');
}

function applyApplicationRules(store, r, old) {
  const me = store.me; if (me?.role === 'admin') return;
  if (!old) {
    if (r.offer_id) { const o = store.byId('offers', r.offer_id); if (o) { r.entreprise = o.entreprise; r.titre = o.titre; } r.status = 'postule'; }
    if (r.offer_id && store.data.applications.some(a => a.offer_id === r.offer_id && a.student_id === r.student_id)) throw new Error('Tu as déjà postulé à cette offre.');
    return;
  }
  const author = old.offer_id ? store.byId('offers', old.offer_id)?.author_id : null;
  if (author && author === me?.id) { for (const k of Object.keys(r)) if (!['status', 'updated_at'].includes(k)) r[k] = old[k]; return; }
  if (old.student_id === me?.id && old.offer_id && r.status !== old.status) r.status = old.status;
}

// Invitation à postuler : un lauréat invite un étudiant sur une de ses offres ; l'étudiant peut seulement la décliner.
function applyInvitationRules(store, r, old) {
  const me = store.me; if (me?.role === 'admin') return;
  if (!old) {
    if (me?.role !== 'laureat') throw new Error('Seul un lauréat peut inviter un étudiant.');
    if (store.byId('offers', r.offer_id)?.author_id !== me.id) throw new Error('Tu ne peux inviter que sur tes propres offres.');
    if (store.data.invitations.some(x => x.offer_id === r.offer_id && x.student_id === r.student_id)) throw new Error('Cet étudiant est déjà invité sur cette offre.');
    Object.assign(r, { laureat_id: me.id, status: 'envoyee' });
    return;
  }
  for (const k of Object.keys(r)) if (k !== 'status') r[k] = old[k];
  if (!(old.student_id === me?.id && r.status === 'declinee')) r.status = old.status;
}

// Mentorat en 3 étapes : l'étudiant demande avec ses horaires, un lauréat en choisit un (le premier l'emporte),
// la visio est créée, puis l'étudiant clôt et remercie.
function applyMentorshipRules(store, r, old) {
  const me = store.me; if (me?.role === 'admin') return;
  const now = new Date();
  const clean = c => [...new Set((c || []).filter(x => new Date(x) > now).map(x => new Date(x).toISOString()))].sort().slice(0, 3);
  if (!old) {
    r.student_id = me.id;
    if (r.mentor_id === me.id) throw new Error('Choisis un autre lauréat que toi.');
    if (r.mentor_id && store.byId('profiles', r.mentor_id)?.role !== 'laureat') throw new Error('Choisis un lauréat.');
    r.creneaux = clean(r.creneaux);
    if (!r.creneaux.length) throw new Error('Propose au moins un horaire à venir.');
    if (store.data.mentorships.filter(m => m.student_id === me.id && m.status === 'demande').length >= 3) throw new Error('Tu as déjà 3 demandes en attente. Attends une réponse avant d’en envoyer une autre.');
    Object.assign(r, { mentor_id: r.mentor_id || null, status: 'demande', rdv_at: null, reponse: null, merci: null, note: null, accepted_at: null });
    return;
  }
  const v = { ...r };
  Object.assign(r, old);
  if (!old.mentor_id && old.status === 'demande' && v.mentor_id === me.id && me.id !== old.student_id) {
    if (me.role !== 'laureat') throw new Error('Seul un lauréat peut accepter une demande.');
    r.mentor_id = me.id;
  }
  if (r.mentor_id === me.id) {
    r.reponse = v.reponse;
    if (old.status === 'demande' && !v.mentor_id && old.mentor_id) r.mentor_id = null;
    else if (v.status === 'acceptee' && ['demande', 'acceptee'].includes(old.status)) {
      if (!v.rdv_at) throw new Error('Choisis l’horaire du rendez-vous.');
      if (v.rdv_at !== old.rdv_at && new Date(v.rdv_at) < now) throw new Error('Choisis un moment à venir.');
      r.status = 'acceptee'; r.rdv_at = v.rdv_at;
      if (old.status === 'demande') r.accepted_at = now.toISOString();
      if (!store.byId('liens_rdv', old.id)) store.data.liens_rdv = [{ id: old.id, lien: jitsiLink(), created_at: now.toISOString() }, ...store.data.liens_rdv];
    } else if (v.status === 'refusee' && old.status === 'demande') r.status = 'refusee';
    else if (['terminee', 'annulee'].includes(v.status) && old.status === 'acceptee') r.status = v.status;
    return;
  }
  if (old.student_id === me.id) {
    r.merci = v.merci; r.note = v.note;
    if (old.status === 'demande') {
      r.besoin = v.besoin; r.sujet = v.sujet; r.message = v.message;
      if (JSON.stringify(v.creneaux) !== JSON.stringify(old.creneaux)) { r.creneaux = clean(v.creneaux); if (!r.creneaux.length) throw new Error('Propose au moins un horaire à venir.'); }
      if (v.status === 'annulee') r.status = 'annulee';
    } else if (old.status === 'acceptee' && ['terminee', 'annulee'].includes(v.status)) r.status = v.status;
    return;
  }
  if (v.mentor_id === me?.id) throw new Error('Un autre lauréat vient de prendre cette demande.');
}

// Lien de visio : seul le lauréat du rendez-vous le change, et seulement pour un lien https
function applyLienRules(store, r, old) {
  if (store.me?.role === 'admin') return;
  const m = store.byId('mentorships', (old || r).id);
  if (!m || m.mentor_id !== store.me?.id) throw new Error('Seul le lauréat du rendez-vous peut changer le lien.');
  if (!/^https:\/\/\S+$/i.test(r.lien || '') || r.lien.length > 300) throw new Error('Le lien doit commencer par https://');
}

// Phase 2 : groupes, cafés, startups, défis (mêmes règles que les triggers et RLS de la base)
function applyPhase2Rules(store, table, r, old) {
  const me = store.me; const isAdmin = me?.role === 'admin'; const now = new Date();
  const deny = () => { throw new Error('Action non autorisée pour ton compte.'); };
  if (table === 'groupe_messages') { if (old) deny(); r.author_id = me.id; return; }
  if (table === 'groupe_membres') { if (old) deny(); r.user_id = me.id; if (store.data.groupe_membres.some(g => g.groupe === r.groupe && g.user_id === me.id)) return false; return; }
  if (table === 'defis') { if (!isAdmin) deny(); return; }
  if (table === 'parrainages') { if (!isAdmin) deny(); return; }
  if (table === 'startups') {
    if (old) { if (old.fondateur_id !== me.id && !isAdmin) deny(); r.fondateur_id = old.fondateur_id; return; }
    if (!['laureat', 'admin'].includes(me?.role)) deny();
    r.fondateur_id = me.id;
    if (r.site && !/^https:\/\/\S+$/i.test(r.site)) throw new Error('Le lien doit commencer par https://');
    return;
  }
  if (table === 'cafes') {
    if (!old) {
      if (!isAdmin) r.organisateur_id = me.id;
      if (new Date(r.date_at) < now) throw new Error('Choisis une date à venir.');
      r.annule = false; return;
    }
    if (isAdmin) return;
    if (old.organisateur_id !== me.id) deny();
    for (const k of ['organisateur_id', 'ville', 'pays', 'created_at']) r[k] = old[k];
    if (r.date_at !== old.date_at && new Date(r.date_at) < now) throw new Error('Choisis une date à venir.');
    return;
  }
  if (table === 'cafe_participants') {
    if (old) deny();
    if (!isAdmin) r.user_id = me.id;
    if (store.data.cafe_participants.some(x => x.cafe_id === r.cafe_id && x.user_id === r.user_id)) return false;
    const c = store.byId('cafes', r.cafe_id);
    if (!c) throw new Error('Ce café n’existe plus.');
    if (c.organisateur_id === r.user_id) return;
    if (c.annule) throw new Error('Ce café est annulé.');
    if (new Date(c.date_at) < now) throw new Error('Ce café a déjà eu lieu.');
    if (c.places && store.data.cafe_participants.filter(x => x.cafe_id === c.id).length >= c.places) throw new Error('Ce café est complet.');
  }
}

function demoParrains(store, onlyId = null) {
  const S = seasonOf(); let n = 0;
  const count = id => store.data.parrainages.filter(x => x.parrain_id === id && x.saison === S).length;
  const waiting = store.data.profiles.filter(p => p.role === 'etudiant' && niveauOf(p, S) === 3 && (!onlyId || p.id === onlyId)
    && !store.data.parrainages.some(x => x.filleul_id === p.id && x.saison === S)).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  for (const st of waiting) {
    const l = store.data.profiles.filter(x => x.role === 'laureat' && x.parrain_dispo && x.filiere === st.filiere && count(x.id) < 3)
      .sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0) || count(a.id) - count(b.id))[0];
    if (!l) continue;
    store.data.parrainages = [{ id: uuid(), filleul_id: st.id, parrain_id: l.id, saison: S, created_at: new Date().toISOString() }, ...store.data.parrainages];
    n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Réel : Supabase (comptes, base partagée, temps réel)
// ---------------------------------------------------------------------------
class SupabaseStore extends Base {
  constructor(cfg) { super(); this.mode = 'live'; this.cfg = cfg; }
  async init() {
    await new Promise((ok, ko) => { const el = document.createElement('script'); el.src = 'vendor/supabase.js'; el.onload = ok; el.onerror = () => ko(new Error('Chargement de Supabase impossible')); document.head.appendChild(el); });
    const { createClient } = window.supabase;
    this.sb = createClient(this.cfg.supabaseUrl, this.cfg.supabaseAnonKey);
    const { data: { session } } = await this.sb.auth.getSession();
    this.session = session;
    this.sb.auth.onAuthStateChange(async (_e, s) => {
      const changed = (s?.user?.id || null) !== (this.session?.user?.id || null);
      this.session = s;
      if (changed) { await this.loadAll(); this.emit(); }
    });
    await this.lireReglages().catch(() => {});
    if (session) await this.loadAll();
    this.ready = true;
  }
  get userId() { return this.session?.user?.id || null; }
  async loadAll() {
    if (!this.userId) { this.data = Object.fromEntries(TABLES.map(t => [t, []])); this.me = null; return; }
    await Promise.all(TABLES.map(t => this.loadTable(t)));
    this.me = this.byId('profiles', this.userId) || null;
    this.subscribe();
  }
  async loadTable(t) {
    this.vues ||= {};
    const vue = VUES[t] && this.vues[t] !== false ? VUES[t] : null;
    const all = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.sb.from(vue || t).select('*').order('created_at', { ascending: false }).range(from, from + 999);
      if (error && vue && from === 0) { this.vues[t] = false; return this.loadTable(t); }  // base pas encore à jour : la table
      if (error && OPTIONAL.has(t)) { this.data[t] = []; return; }
      if (error) throw error;
      all.push(...data);
      if (data.length < 1000) break;
    }
    this.data[t] = all;
  }
  subscribe() {
    if (this.channel) return;
    const pending = new Set(); let timer = null;
    // Un accord de contact change ce que chacun voit des coordonnées et des profils de l'autre
    const LIES = { demandes_contact: ['coordonnees', 'profiles'] };
    this.channel = this.sb.channel('ensam-live');
    const recharger = t => {
      pending.add(t); for (const x of LIES[t] || []) pending.add(x); clearTimeout(timer);
      timer = setTimeout(async () => {
        const ts = [...pending]; pending.clear();
        await Promise.all(ts.map(x => this.loadTable(x)));
        this.me = this.byId('profiles', this.userId) || null;
        this.emit();
      }, 400);
    };
    for (const t of TABLES) if (t !== 'messages') this.channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => recharger(t));
    // Un message arrive tel quel, sans relire toute la table : la conversation suit en direct
    this.channel.on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, e => {
      if (e.eventType === 'DELETE') this.data.messages = this.data.messages.filter(x => x.id !== e.old?.id);
      else if (e.new?.id) this.data.messages = this.data.messages.some(x => x.id === e.new.id) ? this.data.messages.map(x => x.id === e.new.id ? e.new : x) : [e.new, ...this.data.messages];
      this.emit();
    });
    // Les vues (profils, entretiens, avis) n'ont pas de temps réel : la base signale leurs changements ici
    this.channel.on('postgres_changes', { event: '*', schema: 'public', table: 'maj_tables' }, e => { const t = e.new?.cle; if (TABLES.includes(t)) recharger(t); });
    this.channel.on('postgres_changes', { event: '*', schema: 'public', table: 'reglages' }, () => this.lireReglages().then(() => this.emit()).catch(() => {}));
    this.channel.subscribe();
  }
  async insert(table, row) {
    const { data, error } = await this.sb.from(table).insert(row).select().single();
    if (error) throw new Error(frError(error));
    this.data[table] = [data, ...this.data[table].filter(x => x.id !== data.id)];
    if (table === 'profiles') this.me = this.byId('profiles', this.userId);
    // L'organisateur d'un café y est inscrit d'office par la base
    if (table === 'cafes') await this.loadTable('cafe_participants').catch(() => {});
    this.emit(); return data;
  }
  async update(table, id, patch) {
    const { data, error } = await this.sb.from(table).update(patch).eq('id', id).select().single();
    // Aucune ligne modifiée : quelqu'un est passé avant (ex. demande prise entre-temps)
    if (error?.code === 'PGRST116') throw new Error(table === 'mentorships' ? 'Un autre lauréat vient de prendre cette demande.' : 'Cette action n’est plus possible. Recharge la page.');
    if (error) throw new Error(frError(error));
    this.data[table] = this.data[table].some(x => x.id === id) ? this.data[table].map(x => x.id === id ? data : x) : [data, ...this.data[table]];
    // Le lien de visio est créé côté base quand le lauréat accepte
    if (table === 'mentorships') await this.loadTable('liens_rdv').catch(() => {});
    if (table === 'profiles') this.me = this.byId('profiles', this.userId);
    this.emit(); return data;
  }
  async remove(table, id) {
    const { error } = await this.sb.from(table).delete().eq('id', id);
    if (error) throw new Error(frError(error));
    this.data[table] = this.data[table].filter(x => x.id !== id);
    this.emit();
  }
  async signUp(email, password, meta = {}) {
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { data: meta } });
    if (error) throw new Error(frError(error));
    return { needsConfirm: !data.session };
  }
  async signIn(email, password) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(frError(error));
  }
  async resetPassword(email) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw new Error(frError(error));
  }
  async setPassword(password) {
    const { error } = await this.sb.auth.updateUser({ password });
    if (error) throw new Error(frError(error));
  }
  async signOut() { await this.sb.auth.signOut(); }
  async verifyAttestation(id) {
    const { data, error } = await this.sb.rpc('attestation_publique', { p_id: id });
    if (error) return null;
    return (Array.isArray(data) ? data[0] : data) || null;
  }
  async emailRdv(id) {
    const { data, error } = await this.sb.rpc('email_rdv', { p_id: id });
    return error ? null : data || null;
  }
  async adminComptes() {
    const { data, error } = await this.sb.rpc('admin_comptes');
    if (error) throw new Error(frError(error));
    return data || [];
  }
  // Phase 2
  async monParrain() {
    const { error } = await this.sb.rpc('mon_parrain');
    if (!error) { await this.loadTable('parrainages'); this.emit(); }
  }
  async attribuerParrains() {
    const { data, error } = await this.sb.rpc('attribuer_parrains');
    if (error) throw new Error(frError(error));
    await this.loadTable('parrainages'); this.emit();
    return data || 0;
  }
  async supprimerCompte() {
    // Les fichiers du stockage ne partent pas avec la base : on retire d'abord ses CV
    const { data: f } = await this.sb.storage.from('cv').list(this.userId).catch(() => ({ data: null }));
    if (f?.length) await this.sb.storage.from('cv').remove(f.map(x => `${this.userId}/${x.name}`)).catch(() => {});
    // Photos et vocaux envoyés : un dossier par destinataire
    const { data: dossiers } = await this.sb.storage.from('chat').list(this.userId).catch(() => ({ data: null }));
    for (const d of dossiers || []) {
      const { data: g } = await this.sb.storage.from('chat').list(`${this.userId}/${d.name}`).catch(() => ({ data: null }));
      if (g?.length) await this.sb.storage.from('chat').remove(g.map(x => `${this.userId}/${d.name}/${x.name}`)).catch(() => {});
    }
    const { error } = await this.sb.rpc('supprimer_mon_compte');
    if (error) throw new Error(frError(error));
    await this.sb.auth.signOut().catch(() => {});
  }
  async seDesabonner(token) {
    const { data, error } = await this.sb.rpc('se_desabonner', { p_token: token });
    return !error && data === true;
  }
  // Notifications sur le téléphone : clé publique de la fonction « notifier », abonnement, test
  async pushKey() {
    const { data, error } = await this.sb.functions.invoke('notifier', { body: { job: 'cle' } });
    return error ? null : data?.publicKey || null;
  }
  async abonnerPush(sub) {
    const j = sub.toJSON();
    const { error } = await this.sb.rpc('abonner_push', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
    if (error) throw new Error(frError(error));
  }
  async desabonnerPush(endpoint) { await this.sb.from('push_subscriptions').delete().eq('endpoint', endpoint); }
  // Phase 3
  async enregistrerCoordonnees(champs) {
    const { data, error } = await this.sb.from('coordonnees').upsert({ id: this.userId, ...champs }).select().single();
    if (error) throw new Error(frError(error));
    this.data.coordonnees = [data, ...this.data.coordonnees.filter(x => x.id !== data.id)];
    this.emit(); return data;
  }
  async deposerCV(file) {
    verifierPdf(file);
    const ancien = this.me?.cv_path;
    const path = `${this.userId}/cv-${Date.now()}.pdf`;
    const { error } = await this.sb.storage.from('cv').upload(path, file, { contentType: 'application/pdf', upsert: false });
    if (error) throw new Error(frError(error));
    const r = await this.update('profiles', this.userId, { cv_path: path, cv_maj: new Date().toISOString() });
    if (ancien && ancien !== path && !cvReference(this.data, ancien)) await this.sb.storage.from('cv').remove([ancien]).catch(() => {});
    return r;
  }
  async retirerCV() {
    const ancien = this.me?.cv_path;
    const r = await this.update('profiles', this.userId, { cv_path: null, cv_maj: null });
    if (ancien && !cvReference(this.data, ancien)) await this.sb.storage.from('cv').remove([ancien]).catch(() => {});
    return r;
  }
  // Lien temporaire (10 minutes) vers un CV, si la base autorise ce compte à le lire
  async lienCV(path) {
    if (!path) return null;
    const { data, error } = await this.sb.storage.from('cv').createSignedUrl(path, 600);
    if (error || !data?.signedUrl) throw new Error('Ce CV n’est pas visible pour ton compte.');
    return data.signedUrl;
  }
  async lireReglages() {
    const { data, error } = await this.sb.from('reglages').select('cle, valeur');
    this.reglages = error ? {} : Object.fromEntries(data.map(x => [x.cle, x.valeur]));
    return this.reglages;
  }
  async enregistrerReglage(cle, valeur) {
    const { error } = await this.sb.from('reglages').upsert({ cle, valeur, updated_at: new Date().toISOString() });
    if (error) throw new Error(frError(error));
    this.reglages = { ...this.reglages, [cle]: valeur }; this.emit();
  }
  async rapportInsertion() {
    const { data, error } = await this.sb.rpc('rapport_insertion');
    if (error) throw new Error(frError(error));
    return data || [];
  }
  async historiqueGuide(guideId) {
    const { data, error } = await this.sb.from('guide_pays_historique').select('*').eq('guide_id', guideId).order('created_at', { ascending: false }).limit(20);
    return error ? [] : data;
  }
  async statsInsertion() {
    const { data, error } = await this.sb.rpc('stats_insertion');
    if (error) throw new Error(frError(error));
    return data || [];
  }
  async seDesabonnerAlertes(token) {
    const { data, error } = await this.sb.rpc('se_desabonner_alertes', { p_token: token });
    return !error && data === true;
  }
  async seDesabonnerMessages(token) {
    const { data, error } = await this.sb.rpc('se_desabonner_messages', { p_token: token });
    return !error && data === true;
  }
  // Messagerie : le fichier part d'abord dans le stockage privé, puis le message ; s'il échoue, le fichier est retiré
  async envoyerMessage({ dest, type = 'texte', body = null, fichier: blob = null, ext = 'jpg', ...meta }) {
    let fichier = null;
    if (blob) {
      verifierFichierChat(blob);
      fichier = `${this.userId}/${dest}/${uuid()}.${ext}`;
      const { error } = await this.sb.storage.from('chat').upload(fichier, blob, { contentType: (blob.type || '').split(';')[0] || undefined, upsert: false });
      if (error) {
        const m = (error.message || '').toLowerCase();
        throw new Error(m.includes('bucket not found') ? 'Les photos et vocaux arrivent bientôt : la base est en cours de mise à jour.'
          : m.includes('size') || m.includes('too large') ? 'Fichier trop lourd (5 Mo au plus).'
          : m.includes('mime') ? 'Ce format n’est pas accepté : une photo ou un message vocal.'
          : m.includes('row-level security') ? 'Conversation pas encore ouverte.' : 'Envoi du fichier impossible. Vérifie ta connexion et réessaie.');
      }
    }
    try { return await this.insert('messages', { author_id: this.userId, dest_id: dest, type, body, fichier, ...meta }); }
    catch (e) { if (fichier) this.sb.storage.from('chat').remove([fichier]).catch(() => {}); throw e; }
  }
  // Lien temporaire (1 heure) vers une photo ou un vocal, gardé pour ne pas le redemander à chaque affichage
  async lienChat(path) {
    if (!path) return null;
    this.urlsChat ||= new Map();
    const c = this.urlsChat.get(path);
    if (c && c.fin > Date.now()) return c.url;
    const { data, error } = await this.sb.storage.from('chat').createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return null;
    this.urlsChat.set(path, { url: data.signedUrl, fin: Date.now() + 3300e3 });
    return data.signedUrl;
  }
  async marquerLus(de) {
    const me = this.userId; const now = new Date().toISOString();
    if (!this.data.messages.some(m => m.author_id === de && m.dest_id === me && !m.lu_at)) return 0;
    this.data.messages = this.data.messages.map(m => m.author_id === de && m.dest_id === me && !m.lu_at ? { ...m, lu_at: now } : m);
    this.emit();
    const { data } = await this.sb.rpc('marquer_lus', { p_de: de });
    return data || 0;
  }
  async supprimerMessage(id) {
    const m = this.byId('messages', id);
    await this.remove('messages', id);
    if (m?.fichier) await this.sb.storage.from('chat').remove([m.fichier]).catch(() => {});
  }
  // « écrit… » : un signal éphémère entre les deux personnes de la conversation (rien n'est enregistré)
  canal(autre, onTape) {
    const ch = this.sb.channel('chat-' + [this.userId, autre].sort().join('-'), { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'tape' }, p => { if (p.payload?.de === autre) onTape(); }).subscribe();
    let dernier = 0;
    return {
      tape: () => { if (Date.now() - dernier < 2500) return; dernier = Date.now(); ch.send({ type: 'broadcast', event: 'tape', payload: { de: this.userId } }).catch(() => {}); },
      fermer: () => { this.sb.removeChannel(ch).catch(() => {}); },
    };
  }
  async importerListe(lignes, remplacer = false) {
    const { data, error } = await this.sb.rpc('importer_liste', { p_lignes: lignes, p_remplacer: remplacer });
    if (error) throw new Error(frError(error));
    await this.loadTable('profiles'); this.me = this.byId('profiles', this.userId); this.emit();
    return data;
  }
  async couvertureListe() {
    const { data, error } = await this.sb.rpc('couverture_liste');
    if (error) throw new Error(frError(error));
    return data || [];
  }
  async manquantsListe(promo) {
    const { data, error } = await this.sb.rpc('manquants_liste', { p_promo: +promo });
    if (error) throw new Error(frError(error));
    return data || [];
  }
  async viderListe(promo) {
    const { error } = await this.sb.from('liste_officielle').delete().eq('promo', +promo);
    if (error) throw new Error(frError(error));
  }
  async testPush() {
    const { data, error } = await this.sb.functions.invoke('notifier', { body: { job: 'test' } });
    if (error) throw new Error('La fonction de notifications ne répond pas encore.');
    return data?.sent || 0;
  }
}

function frError(e) {
  const m = (e?.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'Email ou mot de passe incorrect.';
  if (m.includes('already registered')) return 'Un compte existe déjà avec cet email. Connecte-toi.';
  if (m.includes('password should be')) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (m.includes('email not confirmed')) return "Confirme d'abord ton email (regarde ta boîte de réception).";
  if (m.includes('duplicate key') && m.includes('placements')) return 'Une réussite est déjà enregistrée pour cet étudiant cette saison.';
  if (m.includes('duplicate key') && m.includes('applications')) return 'Tu as déjà postulé à cette offre.';
  if (m.includes('duplicate key') && m.includes('invitations')) return 'Cet étudiant est déjà invité sur cette offre.';
  if (m.includes('duplicate key') && (m.includes('cafe_participants') || m.includes('groupe_membres'))) return 'C’est déjà fait.';
  if (m.includes('startups_site_check')) return 'Le lien doit commencer par https://';
  if (m.includes('avis_stage_un_par_saison')) return 'Tu as déjà donné ton avis sur cette entreprise pour cette saison.';
  if (m.includes('guide_pays_pays_cle_section')) return 'Cette rubrique existe déjà : recharge la page pour la modifier.';
  if (m.includes('demandes_contact_demandeur_id_cible_id')) return 'Tu as déjà envoyé une demande à ce membre.';
  if (m.includes('signalements_auteur_id_cible_type_cible_id')) return 'Tu as déjà signalé ce contenu. Merci !';
  if (m.includes('enquetes_insertion_user_id_vague')) return 'Tu as déjà répondu à cette enquête.';
  if (m.includes('duplicate key') && (m.includes('verifications_pairs') || m.includes('evenement_participants'))) return 'C’est déjà fait.';
  if (m.includes('evenements_lien_check')) return 'Le lien doit commencer par https://';
  if (m.includes('entretiens_questions_check')) return 'Ajoute au moins une question.';
  if (m.includes('maximum allowed size') || m.includes('payload too large') || m.includes('entity too large')) return 'Le fichier dépasse 2 Mo. Exporte ton CV en PDF plus léger.';
  if (m.includes('mime type')) return 'Seuls les fichiers PDF sont acceptés.';
  if (m.includes('bucket not found')) return 'Cette fonction arrive bientôt : la base est en cours de mise à jour.';
  if (m.includes('lien_check')) return 'Le lien doit commencer par https://';
  if (m.includes('could not find the') || m.includes('does not exist')) return 'Cette fonction arrive bientôt : la base est en cours de mise à jour.';
  if (m.includes('row-level security')) return "Action non autorisée pour ton compte.";
  if (m.includes('rate limit')) return 'Trop de tentatives. Réessaie dans quelques minutes.';
  return e?.message || 'Erreur inconnue.';
}

export async function createStore() {
  const cfg = window.ENSAM_CONFIG || {};
  const store = cfg.supabaseUrl && cfg.supabaseAnonKey ? new SupabaseStore(cfg) : new DemoStore();
  await store.init();
  return store;
}
