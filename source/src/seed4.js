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
