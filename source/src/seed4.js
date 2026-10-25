// Données de démonstration de la messagerie (fictives) : quelques conversations déjà commencées.
export function seedMessages(base, now = new Date()) {
  let n = 0; const id = () => `msg4-${(++n).toString(36).padStart(4, '0')}`;
  const ago = (d, h = 0, m = 0) => new Date(now.getTime() - d * 864e5 - h * 36e5 - m * 6e4).toISOString();
  const P = base.profiles;
  const persona = k => P.find(p => p._persona && p._persona.includes(k));
  const salma = persona('Salma'), youssef = persona('Youssef'), nadia = persona('Nadia'), admin = P.find(p => p.role === 'admin');
  const messages = [];
  const dit = (de, a, body, at, lu = true) => messages.push({ id: id(), author_id: de.id, dest_id: a.id, type: 'texte', body, fichier: null, duree: null, largeur: null, hauteur: null, onde: null, lu_at: lu ? at : null, created_at: at });

  // Salma et Youssef : coordonnées acceptées, ils préparent son PFE
  if (salma && youssef) {
    dit(salma, youssef, 'Bonjour Youssef, merci d’avoir accepté ! Je prépare un PFE en méthodes, je peux vous envoyer mon CV ici ?', ago(11, 3));
    dit(youssef, salma, 'Avec plaisir Salma. Mets-le à jour dans ton profil, je le lis ce soir.', ago(11, 1));
    dit(salma, youssef, 'C’est fait, merci beaucoup 🙏', ago(10, 22));
    dit(youssef, salma, 'Je l’ai lu. Mets tes résultats chiffrés en premier : « −18 % de temps de cycle », ça parle tout de suite à un recruteur.', ago(1, 5));
    dit(youssef, salma, 'Et pour l’entretien chez Renault, prépare un exemple de chantier 5S. On en reparle quand tu veux.', ago(0, 2), false);
  }
  // Youssef et l'étudiant dont il a fixé le rendez-vous (relecture de CV pour l'automobile)
  const rdv = youssef && base.mentorships.find(m => m.mentor_id === youssef.id && m.status === 'acceptee');
  const etu = rdv && P.find(p => p.id === rdv.student_id);
  if (etu) {
    dit(etu, youssef, 'Bonjour, merci pour le rendez-vous ! Je peux préparer quelque chose avant ?', ago(4, 2));
    dit(youssef, etu, 'Oui : deux offres qui t’intéressent, on regarde ton CV face à elles.', ago(4, 1));
    dit(etu, youssef, 'Parfait, je vous les envoie demain.', ago(0, 1, 20), false);
  }
  // L'administration souhaite la bienvenue à la nouvelle lauréate
  if (admin && nadia) dit(admin, nadia, 'Bienvenue Nadia ! Merci de rejoindre le réseau. Si tu as une question sur la plateforme, réponds simplement ici.', ago(0, 6), false);
  return { messages, blocages: [] };
}

// Réseau vivant (données fictives) : des réactions sur quelques offres ouvertes pour les 5A et sur les demandes,
// et deux réponses sous la demande ouverte d'un étudiant de 5A. Jamais sur une publication de son auteur.
export function seedVivant(base, now = new Date()) {
  let n = 0; const id = p => `${p}-${(++n).toString(36).padStart(4, '0')}`;
  const ago = (d, h = 0) => new Date(now.getTime() - d * 864e5 - h * 36e5).toISOString();
  const P = base.profiles;
  const gens = P.filter(p => !p._persona && ['etudiant', 'laureat'].includes(p.role));
  // Les étudiants qui réagissent sont de 5A, comme les offres et les demandes choisies (un étudiant ne lit que son année)
  const promo5 = P.find(p => p._persona && p._persona.includes('Salma'))?.promo;
  const lau = gens.filter(p => p.role === 'laureat'), etu = gens.filter(p => p.role === 'etudiant' && p.promo === promo5);
  const reactions_publiques = [], reponses_demandes = [];
  const reagir = (cible, auteur, qui, emojis, j0) => qui.filter(p => p.id !== auteur).forEach((p, i) =>
    reactions_publiques.push({ id: id('rxp'), offer_id: null, demande_id: null, ...cible, user_id: p.id, emoji: emojis[i % emojis.length], created_at: ago(j0 - i * 0.3, i) }));
  const offres = (base.offers || []).filter(o => o.status === 'ouverte' && o.audience !== 'laureats' && (o.annees || []).includes(5)).slice(0, 3);
  offres.forEach((o, k) => reagir({ offer_id: o.id }, o.author_id, [...etu.slice(k * 3, k * 3 + 3), ...lau.slice(k, k + 1)], ['👏', '👍', '👏', '❤️'], 2 + k));
  const ouverte = (base.demandes || []).find(d => d.status === 'ouverte' && d.type === 'pfe');
  const reussie = (base.demandes || []).find(d => d.status === 'pourvue');
  if (ouverte) {
    reagir({ demande_id: ouverte.id }, ouverte.auteur_id, lau.slice(2, 4), ['💪', '👍'], 1);
    if (lau[4]) reponses_demandes.push({ id: id('rep'), demande_id: ouverte.id, author_id: lau[4].id, body: 'Regarde aussi les audits énergétiques des cimenteries : elles prennent des PFE chaque année. Je peux te donner un contact.', created_at: ago(0, 20) });
  }
  if (reussie) reagir({ demande_id: reussie.id }, reussie.auteur_id, [...lau.slice(5, 7), ...etu.slice(9, 10)], ['👏', '❤️'], 5);
  return { reactions_publiques, reponses_demandes };
}
