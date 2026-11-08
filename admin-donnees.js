// Console d'administration : les tables que l'administration seule lit (écoles, suivi des écoles et des partenaires).
// Elles ne sont pas chargées pour tout le monde au démarrage : la page qui en a besoin les lit ici, en direct ou dans la démo.
// En ligne, une table que la base n'a pas encore (mise à jour pas encore passée) donne une liste vide et absente = true.
import { useState, useEffect } from './vendor/preact-htm.js';
// L'école d'une ligne (ENSAM Meknès par défaut, comme dans la base) : définie une seule fois, dans logic.js
import { ECOLE_DEFAUT, ecoleDe, adminDuReseau } from './logic.js';
export { ECOLE_DEFAUT, ecoleDe };

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36));
const absente = e => /does not exist|relation .* does not exist|schema cache|PGRST20[05]|42P01/i.test(`${e?.code || ''} ${e?.message || ''}`);
// Le suivi des écoles et des partenaires (admin_suivi) n'est qu'à l'administration du réseau (super_admin() dans la base) :
// pour celle d'une école, il n'est pas lu (la base ne rendrait rien) et la démo fait comme la base (rien à lire, une ligne
// ajoutée refusée, une ligne modifiée introuvable, une suppression qui ne touche rien)
export const reserveeAuReseau = (table, me) => table === 'admin_suivi' && !adminDuReseau(me);
const AUCUNE_LIGNE = [];

// cle : la colonne qui identifie une ligne (« id », ou « slug » pour les écoles) ; ordre : la colonne de tri, la plus récente d'abord
export function useTableAdmin(ctx, table, { cle = 'id', ordre = 'created_at', croissant = false } = {}) {
  const { store, data } = ctx;
  const demo = store.mode !== 'live';
  const reservee = reserveeAuReseau(table, ctx.me);
  const [etat, setEtat] = useState({ lignes: [], pret: demo || reservee, absente: false });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (demo || reservee) return;
    let on = true;
    Promise.resolve(store.sb?.from(table).select('*').order(ordre, { ascending: croissant }).limit(2000)).then(r => {
      if (!on) return;
      if (r?.error) setEtat({ lignes: [], pret: true, absente: absente(r.error), erreur: absente(r.error) ? null : r.error.message });
      else setEtat({ lignes: r?.data || [], pret: true, absente: false });
    }, e => on && setEtat({ lignes: [], pret: true, absente: absente(e), erreur: absente(e) ? null : String(e?.message || e) }));
    return () => { on = false; };
  }, [table, version, demo, reservee]);
  const trier = l => [...l].sort((a, b) => (croissant ? 1 : -1) * String(a[ordre] ?? '').localeCompare(String(b[ordre] ?? '')));
  const lignes = reservee ? AUCUNE_LIGNE : demo ? trier(data[table] || []) : etat.lignes;
  const majDemo = f => { store.data[table] = f(store.data[table] || []); store.persist?.(); store.emit?.(); };
  const majLive = f => setEtat(x => ({ ...x, lignes: f(x.lignes) }));
  return {
    lignes, pret: demo || etat.pret, absente: !demo && etat.absente, erreur: !demo ? etat.erreur : null,
    recharger: () => setVersion(v => v + 1),
    async inserer(row) {
      if (reservee && demo) throw new Error('Action non autorisée pour ton compte.');
      if (demo) { const r = { ...(cle === 'id' ? { id: uuid() } : {}), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: store.me?.id || null, ...row }; majDemo(l => [r, ...l]); return r; }
      const { data: r, error } = await store.sb.from(table).insert(row).select().single();
      if (error) throw new Error(error.message);
      majLive(l => [r, ...l.filter(x => x[cle] !== r[cle])]); return r;
    },
    async modifier(id, patch) {
      if (reservee && demo) throw new Error('Cette ligne n’existe plus. Recharge la page.');
      if (demo) { let r = null; majDemo(l => l.map(x => (x[cle] === id ? (r = { ...x, ...patch, updated_at: new Date().toISOString() }) : x))); return r; }
      const { data: r, error } = await store.sb.from(table).update(patch).eq(cle, id).select().single();
      if (error) throw new Error(error.code === 'PGRST116' ? 'Cette ligne n’existe plus. Recharge la page.' : error.message);
      majLive(l => l.map(x => (x[cle] === id ? r : x))); return r;
    },
    async supprimer(id) {
      if (reservee && demo) return;
      if (demo) { majDemo(l => l.filter(x => x[cle] !== id)); return; }
      const { error } = await store.sb.from(table).delete().eq(cle, id);
      if (error) throw new Error(error.message);
      majLive(l => l.filter(x => x[cle] !== id));
    },
  };
}

// Les écoles (table du lot « Écoles », public.ecoles : slug, nom, ouverte) ; l'ENSAM Meknès est toujours là, ouverte,
// même tant que la base n'a pas encore la table
export function useEcoles(ctx) {
  const t = useTableAdmin(ctx, 'ecoles', { cle: 'slug', ordre: 'created_at', croissant: true });
  const ecoles = t.lignes.some(e => e.slug === ECOLE_DEFAUT) ? t.lignes : [{ slug: ECOLE_DEFAUT, nom: 'ENSAM Meknès', ouverte: true, created_at: '2026-10-21T00:00:00Z' }, ...t.lignes];
  return { ...t, ecoles };
}

// L'école que l'administration regarde, gardée sur l'appareil pour ce compte : la console et le suivi la partagent.
// Seulement quand le réseau compte au moins deux écoles ; sinon '' (la console montre alors tout, le suivi l'école du compte).
// nomDe(slug) : le nom d'une école (son identifiant si elle n'est pas dans la liste).
export const CLE_ECOLE_ADMIN = id => 'ensam-admin-ecole:' + (id || '');
// L'administration d'une école (pas celle du réseau) ne regarde que la sienne : la base ne lui donne qu'elle. Rien à
// choisir ni à garder (ni la console ni le suivi ne lui montrent de choix) ; un choix tenté revient à son école.
export function useEcoleRegardee(ctx) {
  const t = useEcoles(ctx);
  const cle = CLE_ECOLE_ADMIN(ctx.me?.id);
  const sienne = adminDuReseau(ctx.me) ? null : ecoleDe(ctx.me);
  const lire = () => { try { const v = JSON.parse(localStorage.getItem(cle) || '""'); return typeof v === 'string' ? v : ''; } catch { return ''; } };
  const [choix, setChoix] = useState(lire);
  const [, redessiner] = useState(0);
  // Une autre page (la console, le suivi) a pu changer le choix depuis : relu à chaque arrivée sur la page
  useEffect(() => { const v = lire(); if (v !== choix) setChoix(v); }, [cle]);
  const changer = v => { if (sienne) { redessiner(n => n + 1); return; } setChoix(v); try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* pas de stockage */ } };
  const ecole = sienne || (t.ecoles.length > 1 && t.ecoles.some(e => e.slug === choix) ? choix : '');
  const nomDe = slug => t.ecoles.find(e => e.slug === slug)?.nom || slug || '';
  return { ...t, ecole, changer, nomDe };
}

// Le dossier CNDP de son école, pour l'administration d'une école (pas celle du réseau) dont le réseau n'est pas encore
// ouvert : elle ne lit pas le suivi des écoles (admin_suivi, au réseau) ; la base le dit (dossier_cndp_de_mon_ecole,
// store.dossierCndpDeMonEcole). Une base pas encore à jour (fonction absente) ou une erreur : pas au dossier.
// demander faux : rien n'est demandé (pret reste faux).
export function useDossierCndp(store, demander) {
  const [etat, setEtat] = useState({ pret: false, ok: false });
  useEffect(() => {
    if (!demander) return undefined;
    let on = true;
    Promise.resolve(store.dossierCndpDeMonEcole?.()).then(ok => on && setEtat({ pret: true, ok: ok === true }), () => on && setEtat({ pret: true, ok: false }));
    return () => { on = false; };
  }, [demander]);
  return etat;
}

// Les lignes d'une table qui sont de cette école (null : toutes les écoles)
export const deLEcole = (lignes, slug) => (!slug ? lignes : (lignes || []).filter(r => ecoleDe(r) === slug));

// ---------------------------------------------------------------------------
// Suivi des écoles et des partenaires (table admin_suivi) : les étapes (l'école au féminin, le partenaire au masculin),
// les colonnes du tableau, les retards
// ---------------------------------------------------------------------------
export const ETAPES = {
  ecole: [['a_contacter', 'À contacter'], ['contacte', 'Contactée'], ['interesse', 'Intéressée'], ['accord', 'Accord écrit'], ['pret', 'Prête'], ['ouvert', 'Réseau ouvert']],
  partenaire: [['a_contacter', 'À contacter'], ['contacte', 'Contacté'], ['rdv', 'Rendez-vous'], ['proposition', 'Proposition'], ['signe', 'Signé'], ['paye', 'Payé']],
};
// Hors du chemin : repliées sous le tableau
export const ETAPES_HORS = [['pause', 'En pause'], ['refus', 'Refus']];
export const nomEtape = (type, k) => [...(ETAPES[type] || []), ...ETAPES_HORS].find(([x]) => x === k)?.[1] || k;
export function etapeVoisine(type, k, sens = 1) {
  const l = ETAPES[type] || [], i = l.findIndex(([x]) => x === k);
  if (i < 0) return sens > 0 ? l[0]?.[0] || null : null; // en pause ou refusée : « étape suivante » la remet au début du chemin
  return l[i + sens]?.[0] || null;
}

// Le jour local d'une date « AAAA-MM-JJ » (prochaine_le), à minuit
const jourDe = s => { const [a, m, j] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, j).getTime(); };
const minuit = now => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); };
// Jours de retard de la prochaine action (0 : à temps, ou rien de prévu) ; une ligne refusée n'est jamais en retard
export function retardJours(l, now = Date.now()) {
  if (!l?.prochaine_le || l.etape === 'refus') return 0;
  return Math.max(0, Math.round((minuit(now) - jourDe(l.prochaine_le)) / 864e5));
}
// La prochaine action tombe dans les 7 jours qui viennent (retards compris)
export const actionCetteSemaine = (l, now = Date.now()) => !!l?.prochaine_le && l.etape !== 'refus' && jourDe(l.prochaine_le) <= minuit(now) + 7 * 864e5;

// Les colonnes du tableau, dans l'ordre du chemin ; dans chaque colonne, la prochaine action la plus proche d'abord
// (sans date : à la fin), puis la ligne modifiée le plus récemment. hors : en pause, refusées (et toute étape d'un autre chemin).
export function grouperSuivi(lignes, type) {
  const l = (lignes || []).filter(x => x.type === type);
  const quand = x => String(x.updated_at || x.created_at || '');
  const tri = (a, b) => (a.prochaine_le || '9999-12-31').localeCompare(b.prochaine_le || '9999-12-31') || quand(b).localeCompare(quand(a));
  const chemin = ETAPES[type] || [];
  return {
    colonnes: chemin.map(([k, label]) => ({ k, label, lignes: l.filter(x => x.etape === k).sort(tri) })),
    hors: l.filter(x => !chemin.some(([k]) => k === x.etape)).sort(tri),
  };
}

// Les trois conditions avant d'ouvrir le réseau d'une école : [colonne, libellé, libellé court (contenu dans le libellé)]
export const CONDITIONS_ECOLE = [
  ['referent_ok', 'Une personne de l’école porte le réseau', 'Personne de l’école'],
  ['accord_nom', 'Accord écrit pour le nom', 'Accord écrit'],
  ['cndp_ok', 'Ajoutée au dossier CNDP', 'Dossier CNDP'],
];
export const pretAOuvrir = l => !!l && CONDITIONS_ECOLE.every(([k]) => l[k] === true);
// La ligne de suivi d'une école (la plus récente si plusieurs)
export const suiviDe = (lignes, slug) => (lignes || []).filter(x => x.type === 'ecole' && x.ecole_slug === slug)
  .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))[0] || null;

// Le slug d'une école, tiré de son nom : « ENSAM Casablanca » -> « ensam-casablanca » (même règle que la base : ^[a-z0-9-]{2,40}$)
export const SLUG_ECOLE = /^[a-z0-9-]{2,40}$/;
export const slugValide = s => SLUG_ECOLE.test(String(s || ''));
export function slugEcole(nom) {
  return String(nom || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 40).replace(/-+$/, '');
}

// Les formules du plan pour les entreprises : des prix de départ, à tester. La formule « saison_pfe » (nom gardé par la base)
// s'appelle « Campagne PFE » à l'écran.
export const FORMULES = [
  { k: 'visibilite', nom: 'Visibilité', prix: 1000, unite: 'par mois', contenu: ['Une carte « Sponsorisé » dans Match, pour les filières choisies', 'Un rapport chaque mois : vues et clics, jamais qui'] },
  { k: 'partenaire', nom: 'Partenaire', prix: 2500, unite: 'par mois', contenu: ['Tout ce que donne Visibilité', 'Ses offres en tête de liste', 'Une page entreprise', 'Un événement par trimestre'] },
  { k: 'saison_pfe', nom: 'Campagne PFE', prix: 5000, unite: 'la campagne', contenu: ['Ses offres en tête et sa carte dans Match, de novembre à mars', 'Un rapport à la fin'] },
];
export const formule = k => FORMULES.find(f => f.k === k) || null;
// Les montants en dirhams, écrits à la française : « 2 500 DH », avec des espaces insécables : le nombre reste d'un seul
// tenant dans une phrase en arabe (une espace simple le couperait en « 500 2 ») et ne se sépare jamais de « DH »
export const dh = n => `${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}\u00a0DH`;

// La ligne du haut des partenaires : signé (signé ou payé), payé, en discussion (contacté, rendez-vous, proposition),
// prochaines actions des 7 jours qui viennent (retards compris)
export function resumePartenaires(lignes, now = Date.now()) {
  const l = (lignes || []).filter(x => x.type === 'partenaire');
  const somme = ks => l.filter(x => ks.includes(x.etape)).reduce((s, x) => s + (Number(x.montant_dh) || 0), 0);
  const discussion = l.filter(x => ['contacte', 'rdv', 'proposition'].includes(x.etape));
  return {
    signe: somme(['signe', 'paye']), paye: somme(['paye']),
    discussion: discussion.length, enJeu: discussion.reduce((s, x) => s + (Number(x.montant_dh) || 0), 0),
    actions: l.filter(x => actionCetteSemaine(x, now)).length,
  };
}

// Un contact écrit tel quel : une adresse email ou un numéro de téléphone devient un lien
export function lienContact(c) {
  const s = String(c || '').trim();
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s)) return 'mailto:' + s;
  const tel = s.replace(/[\s.()-]/g, '');
  if (/^\+?\d{8,15}$/.test(tel)) return 'tel:' + tel;
  return null;
}
