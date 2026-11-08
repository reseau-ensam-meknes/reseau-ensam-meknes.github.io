// Console d'administration : ce que l'administration voit d'un contenu signalé et ce qu'elle peut en faire (selon les règles
// de la base). Partagé par la Modération et « À traiter ». Les textes sont traduits avec la Modération (admin.js).
import { toast } from './ui.js';
import { addAR } from './i18n.js';
import { GUIDE_SECTIONS, adminDuReseau, RIEN_GUIDE, NOMS_MEKNES } from './logic.js';

addAR({ 'Contenu': 'محتوى', [RIEN_GUIDE]: 'لم يُحذف شيء: هذا القسم لم يعد موجودًا، أو لا يمكن لحسابك حذفه.' });

export const MOTIFS = { spam: 'Spam', arnaque: 'Arnaque', inapproprie: 'Inapproprié', faux: 'Faux ou trompeur', harcelement: 'Harcèlement', donnees: 'Données personnelles', autre: 'Autre' };
export const TYPES_CIBLE = { offre: ['Offre', 'feed'], commentaire: ['Commentaire', 'comment'], question: ['Question', 'qa'], reponse: ['Réponse', 'qa'], message: ['Message de groupe', 'people'], profil: ['Profil', 'user'], entretien: ['Entretien', 'briefcase'], avis: ['Avis de stage', 'star'], guide: ['Guide de l’étranger', 'flag'], cafe: ['Café ENSAM', 'clap'], startup: ['Startup', 'spark'], relecture: ['Relecture de CV', 'eye'], prive: ['Message privé', 'chat'], demande: ['Demande d’étudiant', 'send'], reponse_demande: ['Réponse à une demande', 'comment'] };
export const court = (t, n = 220) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const nomGroupe = g => String(g || '').split(':').slice(1).join(':');

export function cible(ctx, type, id) {
  const { store, openOffer, openProfile, go, me } = ctx;
  const by = t => store.byId(t, id);
  const rm = t => () => store.remove(t, id);
  switch (type) {
    case 'offre': { const r = by('offers'); return r && { r, titre: `${r.titre} · ${r.entreprise}`, texte: r.description, auteur: r.author_id, voir: ['Ouvrir', () => openOffer(id)], actions: [r.status === 'ouverte' ? ['Masquer l’offre', () => store.update('offers', id, { status: 'fermee' })] : null, ['Supprimer l’offre', rm('offers'), true]].filter(Boolean) }; }
    case 'commentaire': { const r = by('comments'); const o = r && store.byId('offers', r.offer_id); return r && { r, titre: o ? `${o.titre} · ${o.entreprise}` : '', texte: r.body, auteur: r.author_id, voir: o ? ['Ouvrir', () => openOffer(o.id)] : null, actions: [['Supprimer le commentaire', rm('comments'), true]] }; }
    case 'question': { const r = by('questions'); return r && { r, titre: r.titre, texte: r.body, auteur: r.author_id, voir: ['Voir la question', () => go('reseau/entraide/' + id)], actions: [['Supprimer la question', rm('questions'), true]] }; }
    case 'reponse': { const r = by('answers'); const q = r && store.byId('questions', r.question_id); return r && { r, titre: q?.titre || '', texte: r.body, auteur: r.author_id, voir: q ? ['Voir la question', () => go('reseau/entraide/' + q.id)] : null, actions: [['Supprimer la réponse', rm('answers'), true]] }; }
    case 'message': { const r = by('groupe_messages'); return r && { r, titre: nomGroupe(r.groupe), texte: r.body, auteur: r.author_id, actions: [['Supprimer le message', rm('groupe_messages'), true]] }; }
    case 'profil': { const r = by('profiles'); return r && { r, photo: r.photo_path ? r : null, titre: r.full_name, texte: [r.role === 'laureat' ? `Promo ${r.promo}` : r.filiere, r.entreprise, r.bio].filter(Boolean).join(' · '), auteur: null, voir: ['Voir le profil', () => openProfile(r)],
      actions: [...(r.photo_path ? [['Retirer la photo', () => store.retirerPhoto(r), true]] : []), ...(r.role === 'laureat' && r.verified ? [['Retirer le badge vérifié', () => store.update('profiles', id, { verified: false }), true]] : [])] }; }
    case 'entretien': { const r = by('entretiens'); return r && { r, titre: [r.entreprise, r.poste].filter(Boolean).join(' · '), texte: [...(r.questions || []), r.deroulement, r.conseils].filter(Boolean).join(' · '), auteur: r.author_id, actions: [['Supprimer l’entretien', rm('entretiens'), true]] }; }
    case 'avis': { const r = by('avis_stage'); return r && { r, titre: [r.entreprise, r.ville].filter(Boolean).join(' · '), texte: r.conseils, auteur: r.author_id, actions: [['Supprimer l’avis', rm('avis_stage'), true]] }; }
    // Le guide, commun à toutes les écoles : seule l'administration du réseau en supprime une rubrique (celle d'une école le
    // lit, la base ne la laisserait rien supprimer) ; une rubrique que la base ne supprime pas n'est pas dite supprimée
    case 'guide': { const r = by('guide_pays'); const s = r && GUIDE_SECTIONS.find(x => x[0] === r.section); return r && { r, titre: `${r.pays}${s ? ' · ' + s[1] : ''}`, texte: r.contenu, auteur: r.updated_by, actions: adminDuReseau(me) ? [['Supprimer la rubrique', () => store.remove('guide_pays', id, { exiger: RIEN_GUIDE }), true]] : [] }; }
    case 'cafe': { const r = by('cafes'); return r && { r, titre: `${r.ville} · ${r.lieu}`, texte: r.message, auteur: r.organisateur_id, actions: r.annule ? [] : [['Annuler le café', () => store.update('cafes', id, { annule: true }), true]] }; }
    case 'startup': { const r = by('startups'); return r && { r, titre: r.nom, texte: r.pitch, auteur: r.fondateur_id, actions: [['Retirer la startup', rm('startups'), true]] }; }
    case 'demande': { const r = by('demandes'); return r && { r, titre: r.titre, texte: r.details, auteur: r.auteur_id, voir: ['Voir la demande', () => go('offres/demandes/' + id)], actions: ['ouverte', 'match'].includes(r.status) ? [['Retirer la demande', () => store.update('demandes', id, { status: 'fermee' }), true]] : [] }; }
    case 'reponse_demande': { const r = by('reponses_demandes'); const d = r && store.byId('demandes', r.demande_id); return r && { r, titre: d?.titre || '', texte: r.body, auteur: r.author_id, voir: d ? ['Voir la demande', () => go('offres/demandes/' + d.id)] : null, actions: [['Supprimer la réponse', rm('reponses_demandes'), true]] }; }
    case 'relecture': { const r = by('relectures_cv'); const s = r && store.byId('profiles', r.student_id); return r && { r, titre: s?.full_name || '', texte: r.synthese || r.message, auteur: r.reviewer_id, actions: r.status === 'annulee' ? [] : [['Annuler la relecture', () => store.update('relectures_cv', id, { status: 'annulee' }), true]] }; }
    case 'prive': {
      const r = by('messages'); const nom = x => store.byId('profiles', x)?.full_name || '?';
      // L'onglet s'ouvre tout de suite (sinon le navigateur le bloque), le lien temporaire arrive ensuite
      const ouvrir = async () => { const w = window.open('', '_blank'); if (w) w.opener = null; const u = await store.lienChat(r.fichier).catch(() => null); if (u && w) w.location.href = u; else { w?.close(); toast('Fichier indisponible.', 'err'); } };
      return r && { r, titre: `${nom(r.author_id)} → ${nom(r.dest_id)}`, texte: r.body, auteur: r.author_id, voir: r.fichier ? [r.type === 'vocal' ? 'Écouter le message vocal' : 'Voir la photo', ouvrir] : null, actions: [['Supprimer le message', () => store.supprimerMessage(id), true]] };
    }
    default: return null;
  }
}

// Message prêt à envoyer au lauréat sans CV, dans sa langue ; l'administration le relit avant d'envoyer. noms : l'école du
// réseau qu'il rejoint (nomsEcole, logic.js ; celle de l'administration d'une école), l'ENSAM Meknès sinon
export const demandeCV = (p, noms = NOMS_MEKNES) => {
  const prenom = (p.full_name || '').split(' ')[0];
  return p.langue === 'ar'
    ? `مرحبًا ${prenom}، أهلًا بك في شبكة ${noms.nomAr}! للتحقق من ملفك، هل يمكنك رفع سيرتك الذاتية بصيغة PDF في « ملفي » (أو إضافة رابط LinkedIn)؟ لن يستغرق ذلك سوى دقيقة. شكرًا!`
    : `Bonjour ${prenom}, bienvenue sur le Réseau ${noms.nom} ! Pour vérifier ton profil, peux-tu déposer ton CV en PDF dans « Mon profil » (ou ajouter ton lien LinkedIn) ? Ça prend une minute. Merci !`;
};
