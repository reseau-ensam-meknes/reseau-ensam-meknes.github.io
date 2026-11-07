// Santé des notifications, le panneau de l'administration : admin_sante_notifs() (ou la démo) mis en forme, et ses
// phrases. Seul le panneau (admin-notifs.js, chargé avec l'administration) importe ce module : la mise en forme ne pèse
// pas dans logic.js, que chaque membre connecté charge. « Tester » (Mon profil) reste dans logic.js (bilanTestPush).
import { pushCategorie } from './logic.js';

const entierSN = x => (Number.isFinite(Number(x)) && Number(x) > 0 ? Math.round(Number(x)) : 0);
const plurielSN = (n, un, plusieurs) => (n > 1 ? plusieurs : un);

// Une attente lisible : « 9 min », « 3 h », « 2 jours » (jamais « 1 jours » : les jours commencent à 48 h)
export function dureeAttente(sec) {
  const s = Math.max(0, Number(sec) || 0);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`;
  if (s < 48 * 3600) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} jours`;
}

// Le jour d'une colonne (admin_sante_notifs compte en jours UTC, 'AAAA-MM-JJ') : « 26 » sous la colonne, « 26 octobre » en clair
export function jourNotif(jour) {
  const d = new Date(`${jour}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(jour || '')) || Number.isNaN(d.getTime())) return { court: '', long: '' };
  return { court: String(d.getUTCDate()), long: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }) };
}

// Le nom de chaque type de notification, pour le tableau « Par type » ; un type inconnu prend le nom de sa catégorie
export const NOMS_NOTIF = {
  message: 'Message', rdv_message: 'Entretien proposé', rdv_reponse: 'Réponse à un entretien', rappel_entretien: 'Rappel d’entretien',
  match: 'Nouveau match', match_interet: 'Intérêt reçu', match_jour: 'Match du jour',
  demande_nouvelle: 'Nouvelle demande', demande_large: 'Demande ouverte à tous', demande_proposition: 'Proposition d’aide', demande_match: 'Aide acceptée',
  demande_rouverte: 'Demande rouverte', demande_reponse: 'Réponse à une demande',
  candidature: 'Candidature reçue', candidature_statut: 'Suite d’une candidature', invitation: 'Invitation à postuler',
  recrutement_a_confirmer: 'Recrutement à confirmer', recrutement_confirme: 'Recrutement confirmé', relance_offre: 'Relance d’une offre',
  mentorat_demande: 'Demande de mentorat', mentorat_ouvert: 'Mentorat ouvert à tous', mentorat_accepte: 'Mentorat accepté', mentorat_deplace: 'Mentorat déplacé',
  mentorat_annule: 'Mentorat annulé', rappel_rdv: 'Rappel de rendez-vous', merci: 'Merci reçu',
  relecture_demande: 'Relecture de CV demandée', relecture_prise: 'Relecture de CV prise', relecture_rendue: 'Relecture de CV rendue',
  contact_demande: 'Coordonnées demandées', contact_accepte: 'Coordonnées partagées', filleul: 'Nouveau filleul', parrain: 'Nouveau parrain',
  offre_alerte: 'Nouvelle offre', rappel_visite: 'Rappel du soir',
  reponse: 'Réponse à une question', question_routee: 'Question à toi', cafe: 'Café ENSAM', evenement: 'Événement', evenement_annule: 'Événement annulé',
  evenement_deplace: 'Événement déplacé', enquete: 'Enquête d’insertion', verification_pair: 'Vérification par la promo', verifier_pair: 'Camarade à confirmer',
  reaction: 'Réaction', promo_nouveau: 'Nouveau de la promo', offre_commentaire: 'Commentaire sur une offre', annonce: 'Annonce', signalement: 'Signalement',
  // Les notifications programmées et les nouvelles notifications entre personnes (chantier « nouvelles notifications ») :
  // nommées ici pour que le tableau les dise en clair dès la fusion
  rdv_demain: 'Rendez-vous demain', entretien_demain: 'Entretien demain', agenda_demain: 'Événement ou café demain', apres_rdv: 'Après un rendez-vous',
  mentorat_presence: 'Présence confirmée', match_attente: 'Intérêts en attente', offre_bientot: 'Offre qui ferme bientôt',
  demande_attente: 'Demande toujours ouverte', demande_pause: 'Demande en pause', semaine: 'Résumé de la semaine', reponse_utile: 'Réponse utile',
  bravo: 'Bravo reçu', groupe_jour: 'Messages des groupes',
  test: 'Essai (Tester)',
};
export const NOMS_CATEGORIES_NOTIF = { messages: 'Messages', match: 'Match', demandes: 'Demandes', candidatures: 'Candidatures', mentorat: 'Mentorat',
  offres: 'Offres', reseau: 'Vie du réseau', rappels: 'Rappels', admin: 'Administration' };
export const nomTypeNotif = kind => (Object.prototype.hasOwnProperty.call(NOMS_NOTIF, kind)
  ? { nom: NOMS_NOTIF[kind], connu: true } : { nom: NOMS_CATEGORIES_NOTIF[pushCategorie(kind)] || 'Vie du réseau', connu: false });
// Les services de push (service_push dans la base), du plus courant au plus rare
export const SERVICES_PUSH = [['fcm', 'Chrome et Android (Google)'], ['apple', 'iPhone et Mac (Apple)'], ['mozilla', 'Firefox (Mozilla)'], ['windows', 'Edge (Windows)'], ['autre', 'Autre service']];

// Le panneau « Santé des notifications » : admin_sante_notifs() (ou la démo) mis en forme. Des totaux seulement.
// « Envoyée » : acceptée par le service de notification du téléphone (2xx). Ce n'est pas encore « affichée » : le téléphone
// le confirme à part (telephones.recus_7j, « ont affiché une notification »), et le panneau montre les deux.
// « Perdue » : partie vers un téléphone sans l'atteindre : téléphone parti (404, 410), refusée par son service (autres 4xx,
// sauf 413 et 429), trop longue (413), abandonnée après au moins un essai (-3), expirée sans avoir jamais été essayée (-5 :
// la fonction ou la tâche de chaque minute ne tournait pas), écartée par la fonction (-4). Ce qui n'est pas une perte est
// compté à part : membre sans téléphone abonné (-1 : rien ne pouvait partir, ses emails l'invitent à activer), catégorie
// coupée par le membre (-2 : son choix), échec passager (0, 429, 5xx : réessayé, il finit envoyé ou abandonné).
// Le cercle : la part des membres (étudiants et lauréats, sans l'administration) qui ont au moins un téléphone abonné.
const ORDRE_ROLES_SN = ['etudiant', 'laureat', 'admin'];
export const PERTES_SN = ['parties', 'refusees', 'tropLongues', 'abandonnees', 'expirees', 'jetees'];
// « Par type » : la base n'en rend que les plus fréquents
export const TYPES_MAX_SN = 12;
// Tout un service refuse, pour au moins autant de membres, sans accepter aucun téléphone : la clé de la plateforme est en
// cause, pas les téléphones (même seuil que REFUS_EN_MASSE dans la fonction notifier)
export const REFUS_EN_MASSE_SN = 3;
export function santeResume(s) {
  if (!s || typeof s !== 'object') return null;
  const roles = (Array.isArray(s.roles) ? s.roles : []).map(r => {
    const membres = entierSN(r?.membres), avecTel = Math.min(entierSN(r?.avec_tel), membres);
    return { role: String(r?.role || ''), membres, avecTel, part: membres ? avecTel / membres : null };
  }).sort((a, b) => (ORDRE_ROLES_SN.indexOf(a.role) + 1 || 9) - (ORDRE_ROLES_SN.indexOf(b.role) + 1 || 9));
  const hors = roles.filter(r => r.role !== 'admin');
  const membres = hors.reduce((a, r) => a + r.membres, 0), avecTel = hors.reduce((a, r) => a + r.avecTel, 0);
  const jours = (Array.isArray(s.jours) ? s.jours : []).map(j => {
    const x = { envoyees: entierSN(j?.envoyees), parties: entierSN(j?.parties), refusees: entierSN(j?.refusees), tropLongues: entierSN(j?.trop_longues),
      abandonnees: entierSN(j?.abandonnees), expirees: entierSN(j?.expirees), jetees: entierSN(j?.jetees),
      sansTel: entierSN(j?.sans_tel), coupees: entierSN(j?.coupees), echecs: entierSN(j?.echecs) };
    return { jour: String(j?.jour || ''), ...jourNotif(j?.jour), ...x, perdues: PERTES_SN.reduce((a, k) => a + x[k], 0) };
  });
  const somme = k => jours.reduce((a, j) => a + j[k], 0);
  const t = s.telephones && typeof s.telephones === 'object' ? s.telephones : {};
  const sv = s.services && typeof s.services === 'object' ? s.services : {};
  const f = s.file && typeof s.file === 'object' ? s.file : {};
  const c = s.cron && typeof s.cron === 'object' ? s.cron : null, h = s.http && typeof s.http === 'object' ? s.http : null;
  // Un service : { n, ok, refus, refus_membres } (téléphones abonnés ; dernière réponse en 7 jours acceptée, refusée ; membres
  // distincts qui refusent). Un simple nombre (forme plus ancienne) ne dit que les abonnés.
  const service = v => (v && typeof v === 'object' ? v : { n: v });
  const types = (Array.isArray(s.types) ? s.types : []).map(x => ({ kind: String(x?.kind || ''), ...nomTypeNotif(String(x?.kind || '')), total: entierSN(x?.total),
    envoyees: entierSN(x?.envoyees), perdues: entierSN(x?.perdues), sansTel: entierSN(x?.sans_tel), coupees: entierSN(x?.coupees), echecs: entierSN(x?.echecs) }));
  return {
    at: s.at || null, membres, avecTel, part: membres ? avecTel / membres : null, roles,
    jours, max: Math.max(1, ...jours.map(j => j.envoyees + j.perdues)),
    semaine: Object.fromEntries(['envoyees', 'perdues', ...PERTES_SN, 'sansTel', 'coupees', 'echecs'].map(k => [k, somme(k)])),
    telephones: { total: entierSN(t.total), servis7j: entierSN(t.servis_7j), recus24h: entierSN(t.recus_24h), recus7j: entierSN(t.recus_7j), muets: entierSN(t.muets),
      enRefus: entierSN(t.en_refus), retires7j: entierSN(t.retires_7j) },
    services: SERVICES_PUSH.map(([k, nom]) => {
      const v = service(sv[k]), refus = entierSN(v.refus);
      return { cle: k, nom, n: entierSN(v.n), ok: entierSN(v.ok), refus, refusMembres: v.refus_membres === undefined ? refus : entierSN(v.refus_membres) };
    }).filter(x => x.n > 0).sort((a, b) => b.n - a.n),
    types, typesPlein: types.length >= TYPES_MAX_SN,
    file: { n: entierSN(f.n), ageS: entierSN(f.age_s) },
    // La dernière notification traitée par la fonction (journal de 7 jours) ; null : aucune
    envoiAt: s.envoi_at ? String(s.envoi_at) : null,
    cron: c ? { existe: c.existe !== false, at: c.at || null, statut: c.statut ? String(c.statut) : null } : null,
    // vide : pg_net est lisible mais n'a plus aucune réponse (il ne les garde que 6 h) ; null : illisible
    http: !h ? null : h.vide === true ? { vide: true, code: null, at: null, delai: false, erreur: false }
      : { vide: false, code: Number.isFinite(Number(h.code)) && h.code !== null ? Number(h.code) : null, at: h.at || null, delai: h.delai === true, erreur: h.erreur === true },
  };
}

// L'état de la tâche de chaque minute (pg_cron) en un mot ; null : rien à en dire
const CRON_EN_COURS = ['running', 'starting', 'sending', 'connecting'];
export const etatCronNotifs = c => (!c ? null : !c.existe ? 'absente' : !c.at ? 'jamais' : c.statut === 'failed' ? 'echec' : CRON_EN_COURS.includes(c.statut) ? 'en_cours' : c.statut === 'succeeded' ? 'ok' : 'inconnu');

// « Pourquoi certaines n'arrivent pas » : des phrases simples avec les vrais nombres, la plus urgente d'abord.
// ton : 'bad' (à régler), 'warn' (à surveiller), 'info' (normal, expliqué), 'note' (pas une perte : choix du membre, envoi
// réessayé), 'bien' (rien ne s'est perdu).
// D'abord la chaîne elle-même (fonction notifier, tâche de chaque minute, file), puis un service qui refuse tout (la clé de la
// plateforme), des envois acceptés que personne ne confirme, les pertes de la semaine (un défaut d'abord, puis ce qui est à
// surveiller, chacun du plus fréquent au plus rare), les téléphones qui ne confirment pas, les pertes normales (téléphone
// parti), enfin ce qui n'est pas une perte (sans téléphone, catégorie coupée, envoi réessayé).
const RANG_TON_SN = { bad: 0, warn: 1, info: 2 };
export function raisonsNotifs(r, now = Date.now()) {
  if (!r) return [];
  const out = [], s = r.semaine, t = r.telephones, ajoute = (cle, ton, texte) => out.push({ cle, ton, texte });
  const h = r.http?.vide ? null : r.http, depuis = iso => (now - new Date(iso || 0).getTime()) / 1000;
  if (h?.code === 401) ajoute('http', 'bad', 'La fonction notifier refuse les appels de la base (erreur 401) : désactive « Verify JWT » dans Supabase (Edge Functions > notifier > Details).');
  else if (h?.code === 404) ajoute('http', 'bad', 'La fonction notifier est introuvable (erreur 404) : déploie-la dans Supabase (Edge Functions).');
  else if (h?.code >= 400) ajoute('http', 'bad', `La fonction notifier a répondu par une erreur au dernier appel (erreur ${h.code}) : regarde ses Logs dans Supabase (Edge Functions > notifier > Logs).`);
  else if (h && (h.delai || h.erreur || !h.code) && depuis(h.at) < 86400) ajoute('http', 'warn', 'Le dernier appel à la fonction notifier n’a pas abouti (délai dépassé ou réseau) : la base réessaie toute seule chaque minute.');
  const ec = etatCronNotifs(r.cron);
  if (ec === 'absente') ajoute('cron', 'bad', 'La tâche de chaque minute n’existe pas dans la base : active pg_cron (Database > Extensions), puis relance supabase/mise-a-jour.sql.');
  else if (ec === 'echec') ajoute('cron', 'bad', 'La tâche de chaque minute a échoué à son dernier passage : regarde Logs > Postgres dans Supabase.');
  else if (ec === 'jamais') ajoute('cron', 'warn', 'La tâche de chaque minute n’a encore jamais tourné : vérifie pg_cron dans Supabase (Database > Cron).');
  else if (r.cron?.at && depuis(r.cron.at) > 600) ajoute('cron', 'warn', `La tâche de chaque minute n’a pas tourné depuis ${dureeAttente(depuis(r.cron.at))} : vérifie pg_cron dans Supabase (Database > Cron).`);
  if (r.file.n > 0 && r.file.ageS > 300) {
    ajoute('file', 'warn', `${r.file.n} ${plurielSN(r.file.n, 'notification attend', 'notifications attendent')} depuis ${dureeAttente(r.file.ageS)} au lieu de partir tout de suite : la tâche de chaque minute ou la fonction notifier est bloquée (voir Fonctionnement, dans le détail).`);
  }
  // Tout un service refuse et n'accepte personne : la clé de la plateforme (rien n'est retiré, la fonction le dit dans ses Logs)
  for (const x of r.services) {
    if (!x.ok && x.refus && x.refusMembres >= REFUS_EN_MASSE_SN) {
      ajoute('masse_' + x.cle, 'bad', `Le service « ${x.nom} » refuse les notifications de ${x.refus} téléphones et n’en accepte aucun : la clé de la plateforme est en cause, pas les membres. Regarde les Logs de la fonction notifier (Edge Functions > notifier > Logs).`);
    }
  }
  // Les services acceptent, mais aucun téléphone ne dit avoir affiché quoi que ce soit
  const aucuneRecue = s.envoyees > 0 && t.servis7j > 0 && t.recus7j === 0;
  if (aucuneRecue) {
    ajoute('aucune_recue', 'bad', `Les services de notification ont accepté ${s.envoyees} ${plurielSN(s.envoyees, 'envoi', 'envois')} cette semaine, mais aucun téléphone ne confirme les avoir affichés : essaie « Tester » sur un vrai téléphone (Mon profil > Notifications).`);
  }
  const pertes = [
    ['jetees', 'bad', s.jetees, n => `${n} ${plurielSN(n, 'notification a été écartée', 'notifications ont été écartées')} par le serveur (type inconnu) : un défaut à signaler.`],
    ['trop_longues', 'bad', s.tropLongues, n => `${n} ${plurielSN(n, 'notification a été refusée parce que trop longue', 'notifications ont été refusées parce que trop longues')} (erreur 413) : un défaut à signaler.`],
    ['expirees', 'warn', s.expirees, n => `${n} ${plurielSN(n, 'notification a expiré', 'notifications ont expiré')} sans aucun essai d’envoi, après un jour d’attente : la fonction notifier ou la tâche de chaque minute ne tournait pas (voir Fonctionnement, dans le détail).`],
    ['refusees', 'warn', s.refusees, n => `${n} ${plurielSN(n, 'notification a été refusée', 'notifications ont été refusées')} par le service de notification du téléphone. Après 3 refus de suite, le téléphone est retiré, sauf si tout ce service refuse (la clé de la plateforme serait alors en cause).`],
    ['abandonnees', 'warn', s.abandonnees, n => `${n} ${plurielSN(n, 'notification a été abandonnée', 'notifications ont été abandonnées')} après 3 essais ou un jour d’attente : le service du téléphone ne répondait pas.`],
    ['parties', 'info', s.parties, n => `${n} ${plurielSN(n, 'notification n’a', 'notifications n’ont')} pas pu arriver : le téléphone n’était plus abonné (application désinstallée, téléphone changé ou notifications retirées). Son abonnement est retiré ; le membre devra réactiver les notifications.`],
  ].filter(x => x[2] > 0).sort((a, b) => RANG_TON_SN[a[1]] - RANG_TON_SN[b[1]] || b[2] - a[2]);
  // Ce qui est à régler ou à surveiller, puis les téléphones qui ne confirment pas, puis les pertes normales (téléphone parti)
  for (const [cle, ton, n, texte] of pertes.filter(x => x[1] !== 'info')) ajoute(cle, ton, texte(n));
  const m = t.muets;
  if (m && !aucuneRecue) ajoute('muets', 'warn', `${m} ${plurielSN(m, 'téléphone accepte', 'téléphones acceptent')} les notifications sans confirmer les afficher : économie d’énergie, notifications du navigateur coupées, ou ancienne version de l’application.`);
  for (const [cle, ton, n, texte] of pertes.filter(x => x[1] === 'info')) ajoute(cle, ton, texte(n));
  // La bonne nouvelle avant ce qui n'est pas une perte : seulement si rien ne manque, que les téléphones confirment, et que
  // la chaîne elle-même va bien (une fonction en panne ne perd rien tout de suite : ses notifications expirent un jour après)
  if (!pertes.length && !m && !aucuneRecue) {
    if (s.envoyees) { if (!out.some(x => x.ton === 'bad' || x.ton === 'warn')) ajoute('rien', 'bien', 'Aucune notification envoyée ne s’est perdue cette semaine.'); }
    else if (!s.coupees && !s.echecs) ajoute('vide', 'info', 'Aucune notification n’est partie cette semaine.');
  }
  if (s.sansTel) ajoute('sans_tel', 'info', `${s.sansTel} ${plurielSN(s.sansTel, 'notification n’a', 'notifications n’ont')} pas pu partir : le membre n’a activé les notifications sur aucun téléphone (ses emails l’invitent à le faire).`);
  if (s.coupees) ajoute('coupees', 'note', `${s.coupees} ${plurielSN(s.coupees, 'notification n’a pas été envoyée', 'notifications n’ont pas été envoyées')} : le membre a coupé ce type dans Mon profil. C’est son choix.`);
  if (s.echecs) ajoute('echecs', 'note', `${s.echecs} ${plurielSN(s.echecs, 'envoi a échoué un moment (service du téléphone injoignable), puis a été réessayé.', 'envois ont échoué un moment (service du téléphone injoignable), puis ont été réessayés.')}`);
  return out;
}
// Une perte ou un souci à montrer (le titre « Pourquoi certaines n'arrivent pas »), ou seulement des nouvelles calmes
const CLES_PERTES_SN = ['parties', 'refusees', 'trop_longues', 'abandonnees', 'expirees', 'jetees'];
export const raisonsAvecPertes = l => (l || []).some(x => x.ton === 'bad' || x.ton === 'warn' || CLES_PERTES_SN.includes(x.cle));
