// Match (données fictives) : des « Intéressé » déjà donnés, pour que la page Match vive dès l'ouverture.
//   · Salma (5A) a dit oui au PFE de Youssef ; une autre 5A aussi : Youssef les voit en tête de ses cartes.
//   · Youssef a dit oui au profil d'Amine (3A) ; une lauréate d'OCP au profil de Salma : chacun la voit en premier.
//   · Salma et la lauréate de LafargeHolcim ont déjà un match : une courte discussion et un entretien proposé.
//   · Youssef a déjà un match avec un 4A (son stage d'été) : la rangée « Tes matchs » n'est pas vide.
// Mêmes formes que les tables match_choix et matchs de la base.
export function seedMatch(base, now = new Date()) {
  let n = 0; const id = p => `${p}-${(++n).toString(36).padStart(4, '0')}`;
  const ago = (d, h = 0) => new Date(now.getTime() - d * 864e5 - h * 36e5).toISOString();
  const P = base.profiles, O = base.offers;
  const persona = k => P.find(p => p._persona && p._persona.includes(k));
  const salma = persona('Salma'), youssef = persona('Youssef'), amine = persona('Amine');
  const match_choix = [], matchs = [], messages = [...(base.messages || [])];
  const choix = (qui, cible, at, c = 'oui') => match_choix.push({ id: id('mc'), user_id: qui.id, cible_profil: cible.profil || null, cible_offre: cible.offre || null, choix: c, created_at: at, updated_at: at });
  const match = (etu, lau, offre, at) => { const m = { id: id('mt'), etudiant_id: etu.id, laureat_id: lau.id, offre_id: offre?.id || null, created_at: at, vu_etudiant_at: at, vu_laureat_at: at }; matchs.push(m); return m; };
  const dit = (de, a, body, at, extra = {}) => messages.push({ id: id('mx'), author_id: de.id, dest_id: a.id, type: 'texte', body, fichier: null, duree: null, largeur: null, hauteur: null, onde: null, lu_at: at, created_at: at, ...extra });
  const postule = (st, o) => (base.applications || []).some(a => a.student_id === st.id && a.offer_id === o.id);
  const ouvertes = O.filter(o => o.status === 'ouverte');

  const pfeY = youssef && ouvertes.find(o => o.author_id === youssef.id && o.type === 'pfe');
  const stageY = youssef && ouvertes.find(o => o.author_id === youssef.id && o.type === 'stage');
  // Salma et une autre 5A disent oui au PFE de Youssef
  if (salma && pfeY) {
    choix(salma, { offre: pfeY.id }, ago(2, 3));
    const autre = P.find(p => p.role === 'etudiant' && !p._persona && p.promo === salma.promo && pfeY.filieres.includes(p.filiere) && !postule(p, pfeY));
    if (autre) choix(autre, { offre: pfeY.id }, ago(0, 6));
  }
  // Youssef dit oui au profil d'Amine (3A, même parcours)
  if (youssef && amine) choix(youssef, { profil: amine.id }, ago(1, 2));
  // Une lauréate d'OCP s'intéresse au profil de Salma (elle a un sujet de PFE Power BI)
  const ocp = salma && ouvertes.find(o => o.titre.startsWith('PFE : tableau de bord'));
  const zineb = ocp && P.find(p => p.id === ocp.author_id);
  if (zineb && zineb.role === 'laureat' && zineb !== youssef) choix(zineb, { profil: salma.id }, ago(0, 9));

  // Un match déjà fait : Salma et la lauréate qui porte le PFE de LafargeHolcim (elle l'avait invitée à postuler)
  const laf = salma && ouvertes.find(o => o.titre.startsWith('PFE : optimisation'));
  const meryem = laf && P.find(p => p.id === laf.author_id);
  if (meryem && meryem.role === 'laureat' && ![youssef, zineb].includes(meryem)) {
    choix(salma, { offre: laf.id }, ago(5, 4));
    choix(meryem, { profil: salma.id }, ago(4, 6));
    match(salma, meryem, laf, ago(4, 6));
    dit(meryem, salma, 'Bonjour Salma ! Ravie de ce match. Ton expérience en VSM colle bien au sujet du four.', ago(4, 5));
    dit(salma, meryem, 'Merci beaucoup ! Le sujet m’intéresse vraiment, surtout la valorisation de la chaleur perdue.', ago(4, 2));
    dit(meryem, salma, 'On en parle de vive voix ? Je te propose un premier échange.', ago(0, 4));
    // L'entretien proposé : après-demain à 10 h, 30 minutes en visio ; Salma n'a pas encore répondu
    const rdv = new Date(now.getTime() + 2 * 864e5); rdv.setHours(10, 0, 0, 0);
    dit(meryem, salma, 'Premier échange : ton parcours, le sujet, et tes questions.', ago(0, 4), {
      type: 'rdv', lu_at: null, rdv_at: rdv.toISOString(), rdv_duree: 30, rdv_lieu: null, rdv_lien: 'https://meet.jit.si/ReseauENSAM-7c41e9a2d05b', rdv_reponse: null,
    });
  }
  // Youssef et un 4A qui a dit oui à son stage d'été : un match de la semaine dernière
  const quatre = stageY && P.find(p => p.role === 'etudiant' && !p._persona && stageY.filieres.includes(p.filiere) && Number(p.promo) === Number(salma?.promo) + 1 && !postule(p, stageY));
  if (quatre) {
    choix(quatre, { offre: stageY.id }, ago(7, 2));
    choix(youssef, { profil: quatre.id }, ago(6, 5));
    match(quatre, youssef, stageY, ago(6, 5));
    dit(youssef, quatre, 'Bonjour ! Content de ce match. Le stage commence début juillet, tu es disponible ?', ago(6, 4));
    dit(quatre, youssef, 'Bonjour, oui, dès le 1er juillet. Merci beaucoup !', ago(5, 20));
    dit(youssef, quatre, 'Parfait. Envoie-moi ton CV ici, je le transmets au responsable maintenance.', ago(5, 18));
  }
  return { match_choix, matchs, messages };
}
