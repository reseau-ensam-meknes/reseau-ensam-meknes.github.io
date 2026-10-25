// Réseau vivant : chacun voit que le réseau bouge. Les demandes de sa promo (étudiants), des réactions publiques
// sur les offres et les demandes, des réponses courtes sous une demande. Règles pures, sans écran : les mêmes que
// la base (demande_lisible_promo, protect_reaction_publique, protect_reponse_demande dans schema.sql) ; la démo
// (store.js) les applique, le site s'en sert pour savoir quoi montrer. Pas de points pour une réaction.
import { niveauOf, seasonOf, bloque, demandeEnPause } from './logic.js';

// Quelques émojis calmes, les mêmes que la contrainte de la table reactions_publiques
export const EMOJIS_PUBLICS = ['👍', '❤️', '👏', '🙏', '💪'];
export const REPONSE_MAX = 500;
export const VIVANT = ['reactions_publiques', 'reponses_demandes'];
// Pas « match » : la ligne dirait quel lauréat aide, avant l'annonce de la réussite (comme demande_lisible_promo)
const STATUTS_PROMO = ['ouverte', 'pourvue'];

// Une demande que ce membre peut lire : la sienne ; toutes pour un lauréat ou l'administration ;
// pour un étudiant, celles des étudiants de son année (ouvertes ou pourvues), sauf blocage.
export function peutLireDemande(data, me, d, byId, saison = seasonOf()) {
  if (!me || !d) return false;
  if (d.auteur_id === me.id || me.role === 'admin' || me.role === 'laureat') return true;
  return demandeDeMaPromo(data, me, d, byId, saison);
}
export function demandeDeMaPromo(data, me, d, byId, saison = seasonOf()) {
  if (me?.role !== 'etudiant' || !d || d.auteur_id === me.id || !STATUTS_PROMO.includes(d.status)) return false;
  const a = byId(d.auteur_id);
  return a?.role === 'etudiant' && niveauOf(a, saison) === niveauOf(me, saison) && !bloque(data, me.id, a.id);
}
// Une offre lisible (règle « lecture membres » des offres) : pour les étudiants, ou réservée aux lauréats
export const peutLireOffre = (me, o) => !!me && !!o && ((o.audience || 'etudiants') === 'etudiants' || o.author_id === me.id || ['laureat', 'admin'].includes(me.role));

// « Demandes de ta promo » (sans celles en pause : 60 jours sans nouvelle) : celles qui attendent d'abord, puis les matchs, puis les réussites ; les plus récentes en tête
const ORDRE_PROMO = { ouverte: 0, match: 1, pourvue: 2 };
export const demandesPromo = (data, me, byId, saison = seasonOf()) => (data.demandes || [])
  .filter(d => demandeDeMaPromo(data, me, d, byId, saison) && !demandeEnPause(d))
  .sort((a, b) => ORDRE_PROMO[a.status] - ORDRE_PROMO[b.status] || new Date(b.created_at) - new Date(a.created_at));

// Combien de lauréats ont proposé leur aide (retirée : ne compte pas). En ligne, la base le donne (nb_aides) sans dire qui ;
// en démo, on le compte. Base pas encore à jour : ce que le membre voit lui-même (rien pour un autre étudiant).
export function aidesProposees(data, d) {
  if (typeof d?.nb_aides === 'number') return d.nb_aides;
  return new Set((data.propositions || []).filter(x => x.demande_id === d?.id && x.status !== 'retiree').map(x => x.laureat_id)).size;
}

// L'élément d'une réaction : { offer_id } ou { demande_id }
export const cleCible = c => (c.offer_id ? 'o:' + c.offer_id : 'd:' + c.demande_id);
export const memeCible = (r, c) => (c.offer_id ? r.offer_id === c.offer_id : !!c.demande_id && r.demande_id === c.demande_id);
export const reactionsSur = (data, c) => (data.reactions_publiques || []).filter(r => memeCible(r, c));
// Une pastille par émoji : qui a réagi (le plus récent d'abord) ; la plus fournie d'abord, puis l'ordre des émojis
export function pastilles(reactions) {
  const m = new Map();
  for (const r of [...reactions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))) {
    if (!m.has(r.emoji)) m.set(r.emoji, []);
    m.get(r.emoji).push(r.user_id);
  }
  return [...m].map(([emoji, qui]) => ({ emoji, qui }))
    .sort((a, b) => b.qui.length - a.qui.length || EMOJIS_PUBLICS.indexOf(a.emoji) - EMOJIS_PUBLICS.indexOf(b.emoji));
}
// L'auteur de l'élément (offre ou demande)
export function auteurCible(data, c) {
  if (c.offer_id) return (data.offers || []).find(o => o.id === c.offer_id)?.author_id || null;
  return (data.demandes || []).find(d => d.id === c.demande_id)?.auteur_id || null;
}
const elementDe = (data, c) => (c.offer_id ? (data.offers || []).find(o => o.id === c.offer_id) : (data.demandes || []).find(d => d.id === c.demande_id)) || null;
// Peut-on lire cet élément (donc y réagir) ?
export function peutLireCible(data, me, c, byId, saison) {
  const x = elementDe(data, c);
  return c.offer_id ? peutLireOffre(me, x) : peutLireDemande(data, me, x, byId, saison);
}

// Démo : les mêmes règles que la base (protect_reaction_publique, protect_reponse_demande, les politiques d'accès)
const NON = 'Action non autorisée pour ton compte.';
export function regleVivant(store, table, r, old) {
  const me = store.me; const D = store.data; const byId = id => store.byId('profiles', id);
  if (table === 'reactions_publiques') {
    if (old) { Object.assign(r, { offer_id: old.offer_id, demande_id: old.demande_id, user_id: old.user_id, created_at: old.created_at }); if (old.user_id !== me?.id) throw new Error(NON); }
    else r.user_id = me?.id;
    if (!EMOJIS_PUBLICS.includes(r.emoji)) throw new Error('Réaction inconnue.');
    if (!!r.offer_id === !!r.demande_id) throw new Error(NON);
    const c = r.offer_id ? { offer_id: r.offer_id } : { demande_id: r.demande_id };
    if (old) return;
    if (!peutLireCible(D, me, c, byId)) throw new Error(NON);
    const auteur = auteurCible(D, c);
    if (auteur === me.id) throw new Error('Tu ne réagis pas à ta propre publication.');
    if (bloque(D, me.id, auteur)) throw new Error(NON);
    if (reactionsSur(D, c).some(x => x.user_id === me.id)) throw new Error('Tu as déjà réagi.');
    return;
  }
  if (table === 'reponses_demandes') {
    if (old) throw new Error(NON);
    r.author_id = me?.id; r.body = String(r.body || '').trim();
    if (r.body.length < 2 || r.body.length > REPONSE_MAX) throw new Error('Ta réponse fait entre 2 et 500 caractères.');
    const d = (D.demandes || []).find(x => x.id === r.demande_id);
    if (!peutLireDemande(D, me, d, byId)) throw new Error(NON);
    if (me.role === 'admin') return;
    if (d.status === 'fermee') throw new Error('Cette demande est fermée.');
    if (bloque(D, me.id, d.auteur_id)) throw new Error(NON);
  }
}
// Démo : qui peut supprimer (politiques « suppression proprietaire »)
export function peutSupprimerVivant(data, me, table, row) {
  if (!row || !me) return false;
  if (me.role === 'admin') return true;
  if (table === 'reactions_publiques') return row.user_id === me.id;
  if (table === 'reponses_demandes') return row.author_id === me.id || (data.demandes || []).some(d => d.id === row.demande_id && d.auteur_id === me.id);
  return true;
}
// Démo : une offre ou une demande supprimée emporte ses réactions et ses réponses (on delete cascade)
export function cascadeVivant(data, table, id) {
  if (table === 'offers') data.reactions_publiques = (data.reactions_publiques || []).filter(r => r.offer_id !== id);
  if (table === 'demandes') {
    data.reactions_publiques = (data.reactions_publiques || []).filter(r => r.demande_id !== id);
    data.reponses_demandes = (data.reponses_demandes || []).filter(r => r.demande_id !== id);
  }
}

// La cloche : les réactions sur mes offres et mes demandes (une ligne par élément), les réponses sous mes demandes
export function nouvellesVivant(data, me, name, now = Date.now()) {
  if (!me) return [];
  const recent = (iso, j) => now - new Date(iso).getTime() < j * 864e5;
  const out = [];
  const miennes = new Map([...(data.offers || []).filter(o => o.author_id === me.id).map(o => ['o:' + o.id, { o }]),
    ...(data.demandes || []).filter(d => d.auteur_id === me.id).map(d => ['d:' + d.id, { d }])]);
  const parCible = new Map();
  for (const r of data.reactions_publiques || []) {
    const k = r.offer_id ? 'o:' + r.offer_id : 'd:' + r.demande_id;
    if (!miennes.has(k) || r.user_id === me.id || !recent(r.created_at, 7)) continue;
    parCible.set(k, [...(parCible.get(k) || []), r]);
  }
  for (const [k, rs] of parCible) {
    const { o, d } = miennes.get(k); const titre = (o || d).titre;
    const last = rs.reduce((m, r) => (r.created_at > m.created_at ? r : m));
    const n = reactionsSur(data, o ? { offer_id: o.id } : { demande_id: d.id }).length;
    out.push({ key: 'rx' + k + '-' + n, icon: 'heart', tone: 'brass', ...(o ? { offer: o.id } : { to: 'offres/demandes/' + d.id }), at: last.created_at,
      text: rs.length > 1 ? `${n} réactions sur « ${titre} »` : `${name(last.user_id)} a réagi ${last.emoji} à « ${titre} »` });
  }
  for (const r of data.reponses_demandes || []) {
    const x = miennes.get('d:' + r.demande_id);
    if (!x || r.author_id === me.id || !recent(r.created_at, 14)) continue;
    out.push({ key: 'rp' + r.id, icon: 'comment', tone: 'brass', to: 'offres/demandes/' + r.demande_id, at: r.created_at,
      text: `${name(r.author_id)} a répondu à ta demande : « ${r.body.slice(0, 60)}${r.body.length > 60 ? '…' : ''} »` });
  }
  return out;
}
