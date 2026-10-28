// Règles de la page d'entrée, sans aucune dépendance : la page d'entrée s'en sert avant que le reste
// du site ne soit chargé, logic.js les réexporte pour le reste de l'application et pour les tests.

// Saison en cours : elle commence en septembre (même règle que seasonOf dans logic.js, vérifiée par un test)
export const saisonActuelle = (d = new Date()) => (d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1);

// Promos acceptées dans un lien d'invitation (?promo=, pages promo/AAAA/ générées par outils/pages-promo.mjs)
export const PROMO_MIN = 1990, PROMO_MAX = 2040;
export const promoValide = n => Number.isInteger(n) && n >= PROMO_MIN && n <= PROMO_MAX;

// Rôle probable d'après la promo : diplôme pas encore obtenu = étudiant(e)
export const roleDePromo = (promo, saison = saisonActuelle()) => (promo > saison ? 'etudiant' : 'laureat');

// Ce que l'étape « Présente-toi » sait déjà : le rôle choisi sur la page d'entrée (sinon celui de la promo
// du lien d'invitation), et la promo du lien seulement si elle va avec ce rôle
export function presetInscription({ choisi, invite, saison = saisonActuelle() } = {}) {
  const deLien = invite ? roleDePromo(invite, saison) : null;
  const role = choisi === 'etudiant' || choisi === 'laureat' ? choisi : deLien;
  if (!role) return null;
  return invite && deLien === role ? { role, promo: invite } : { role };
}

// « 39 lauréats · 19 entreprises · 14 promos » : rien tant qu'il n'y a pas au moins un lauréat, et jamais un « 0 »
export function lignesChiffres(c) {
  const ok = n => Number.isInteger(n) && n >= 1;
  if (!c || !ok(c.laureats)) return null;
  const mot = (n, un, plusieurs) => `${n} ${n === 1 ? un : plusieurs}`;
  return [mot(c.laureats, 'lauréat', 'lauréats'), ok(c.entreprises) && mot(c.entreprises, 'entreprise', 'entreprises'), ok(c.promos) && mot(c.promos, 'promo', 'promos')].filter(Boolean);
}

// Email de l'école : « @ensam-umi.ac.ma » ou un sous-domaine (« @etu.ensam-umi.ac.ma »), jamais « @xensam-umi.ac.ma »
export function estEmailEcole(email, domaines = []) {
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(e)) return false;
  return domaines.some(d => e.endsWith('@' + d) || e.endsWith('.' + d));
}

// Le code reçu par email, tel qu'on l'a tapé ou collé : chiffres arabes acceptés, espaces et texte autour retirés
export function chiffresCode(s) {
  const t = String(s ?? '').replace(/[٠-٩]/g, c => c.charCodeAt(0) - 0x660).replace(/[۰-۹]/g, c => c.charCodeAt(0) - 0x6f0);
  const seul = t.match(/(?:^|\D)(\d{6})(?!\d)/);
  return seul ? seul[1] : t.replace(/\D/g, '').slice(0, 6);
}

// Ce que Supabase répond quand on demande ou vérifie un code (il ne donne pas toujours un code d'erreur :
// on lit le message, le code sert d'appoint)
export function casErreurAuth(e) {
  const m = String(e?.message || '').toLowerCase(); const code = e?.code || '';
  const attente = m.match(/after (\d+) seconds?/);
  if (attente) return { cas: 'trop_tot', attente: +attente[1] };
  if (/signups? not allowed|user not found/.test(m) || code === 'otp_disabled' || code === 'user_not_found') return { cas: 'pas_de_compte' };
  if (/token has expired or is invalid|email link is invalid|otp.*expired|invalid otp/.test(m) || code === 'otp_expired') return { cas: 'code_faux' };
  return { cas: '' };
}

// Adresse de contact du réseau (pied de la page d'entrée, page Confidentialité) : config.js peut la changer
export const adresseContact = (cfg = (typeof window !== 'undefined' && window.ENSAM_CONFIG) || {}) => cfg.contactEmail || 'reseau.ensam.meknes@gmail.com';
// Responsable du traitement (loi 09-08), nommé sur la page Confidentialité ; config.js peut le changer
export const responsableTraitement = (cfg = (typeof window !== 'undefined' && window.ENSAM_CONFIG) || {}) => cfg.responsable || 'Oussama Ouafik';
// Version du texte de la case d'accord à l'inscription, gardée avec la date dans le compte
export const VERSION_ACCORD = '2026-10-28';

// Lien partagé (offre, question, « Je peux aider ») : gardé pendant l'inscription, puis ouvert.
// Seules ces trois formes sont reconnues : jamais une route libre.
const FORME_LIEN = /^(offre|reseau\/entraide|aider)\/([\w-]{1,64})$/;
export function lienPartage(r) {
  const m = FORME_LIEN.exec(String(r || '').replace(/^#/, ''));
  return m ? { k: m[1] === 'offre' ? 'offre' : m[1] === 'aider' ? 'aider' : 'question', id: m[2], r: `${m[1]}/${m[2]}` } : null;
}
export const LIEN_DUREE = 24 * 36e5;
export const lienEncoreBon = (x, now = Date.now()) => (x && typeof x.t === 'number' && now >= x.t && now - x.t < LIEN_DUREE ? lienPartage(x.r) : null);
export const estUuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || '');
// Une seule phrase par cas. infos : { type, audience, ouverte } | null (l'offre n'existe plus) | undefined (on ne sait pas)
const TETE_OFFRE = { stage: 'Une offre de stage t’attend', pfe: 'Une offre de PFE t’attend', etranger: 'Une offre de stage à l’étranger t’attend', emploi: 'Une offre d’emploi t’attend' };
// role : celui choisi sur la page d'entrée (une offre entre lauréats ne s'ouvre pas pour un étudiant)
export const offreFermeePour = (infos, role) => infos?.audience === 'laureats' && role === 'etudiant';
export function phraseLien(lien, infos, inscrire = true, role = '') {
  if (!lien) return '';
  const verbe = inscrire ? 'crée ton compte' : 'connecte-toi';
  if (lien.k === 'question') return `Une question t’attend : ${verbe} pour y répondre.`;
  if (lien.k === 'aider') return 'Connecte-toi pour voir la demande de l’étudiant.';
  if (infos === null) return 'Cette offre n’est plus en ligne.';
  if (infos?.ouverte === false) return 'Cette offre n’accepte plus de candidatures.';
  if (offreFermeePour(infos, role)) return 'Cette offre est réservée aux lauréats.';
  const tete = infos?.audience === 'laureats' ? 'Une offre entre lauréats t’attend' : TETE_OFFRE[infos?.type] || 'On t’a partagé une offre';
  return `${tete} : ${verbe} pour la voir.`;
}
export const suiteLien = l => (!l ? '' : l.k === 'offre' ? 'Après cette étape, l’offre qu’on t’a partagée s’ouvre.'
  : l.k === 'question' ? 'Après cette étape, la question qu’on t’a partagée s’ouvre.' : 'Après cette étape, la demande de l’étudiant s’ouvre.');

// Langue d'un lien partagé depuis l'interface arabe (?lang=ar) : l'arabe pour cette visite seulement, et jamais
// par-dessus un choix déjà fait dans ce navigateur (un francophone qui ouvre un lien de son groupe reste en français)
export const langueDuLien = (search, choix) => (!choix && new URLSearchParams(search || '').get('lang') === 'ar' ? 'ar' : null);
// Adresse d'un lien à partager : la langue suit l'interface de celui qui partage
export const avecLangue = (adresse, langue) => (langue === 'ar' ? adresse.replace(/^([^?#]*)(\?[^#]*)?/, (_, a, q) => `${a}${q ? q + '&' : '?'}lang=ar`) : adresse);
