// Console d'administration : les messages prêts à copier (WhatsApp, email), en français et en arabe, et les chiffres qu'ils citent.
// Aucun nom ni contact d'étudiant ; des lauréats, le prénom seulement, et seulement là où ils ont dit oui (merci, fondateurs).
// Fonctions pures : pas d'écran ici, les rubriques (admin-animer.js, admin-ecoles.js, admin-partenaires.js, admin-outils.js) s'en servent.
import { niveauOf, seasonOf, laureatCompte, entKey, classementFondateurs, NB_FONDATEURS, reponses48h, NIVEAUX, PARCOURS, parcoursOf, daysUntil } from './logic.js';
import { estPartagee } from './origine.js';
import { ecoleDe, ECOLE_DEFAUT, FORMULES, dh } from './admin-donnees.js';

const J = 864e5;
export const prenomDe = p => String(p?.full_name || '').trim().split(/\s+/)[0] || '';
const t = x => (x ? new Date(x).getTime() : NaN);
const dans = (x, debut, fin) => { const v = t(x); return v >= debut && v <= fin; };

// Les données vues depuis une école : ses membres (et l'administration), donc ses offres, ses Demandes, ses aides.
// Sans école (null) : tout le réseau.
export function vueEcole(data, ecole = ECOLE_DEFAUT) {
  if (!ecole) return data;
  return { ...data, profiles: (data.profiles || []).filter(p => p.role === 'admin' || ecoleDe(p) === ecole) };
}
// Les membres qui comptent : étudiants et lauréats (jamais l'administration, ni en vue lauréat)
export const membresDe = data => (data.profiles || []).filter(p => p.role === 'etudiant' || laureatCompte(p));

// ---------------------------------------------------------------------------
// Les aides et les gestes
// ---------------------------------------------------------------------------
// Une aide d'un lauréat à un étudiant, comme poulsReseau : rendez-vous terminé, relecture rendue, recrutement confirmé,
// aide acceptée sur une Demande. { laureat, etudiant, at, k }
export function aidesEntre(data, debut, fin) {
  const role = new Map((data.profiles || []).map(p => [p.id, laureatCompte(p) ? 'laureat' : p.role]));
  const auteur = new Map((data.demandes || []).map(d => [d.id, d.auteur_id]));
  const out = [];
  const noter = (l, s, at, k) => { if (l && s && role.get(l) === 'laureat' && role.get(s) === 'etudiant' && dans(at, debut, fin)) out.push({ laureat: l, etudiant: s, at: t(at), k }); };
  for (const m of data.mentorships || []) if (m.status === 'terminee') noter(m.mentor_id, m.student_id, m.rdv_at || m.accepted_at, 'rdv');
  for (const r of data.relectures_cv || []) if (r.status === 'rendue') noter(r.reviewer_id, r.student_id, r.rendue_at, 'cv');
  for (const p of data.placements || []) if (p.status === 'confirme') noter(p.laureat_id, p.student_id, p.confirmed_at, 'recrute');
  for (const x of data.propositions || []) if (x.status === 'acceptee') noter(x.laureat_id, auteur.get(x.demande_id), x.repondu_at, 'match');
  return out;
}

// Ce que chaque lauréat a fait pour les étudiants ces 7 derniers jours (le merci de la semaine) : aides proposées sur une Demande,
// mentorats acceptés ou terminés, relectures de CV rendues, réponses aux questions, offres publiées pour les étudiants,
// recrutements confirmés. Le plus récent d'abord ; etudiants : les ids des étudiants aidés (comptés, jamais nommés).
export const GESTES = {
  aide: ['aide proposée sur une Demande', 'aides proposées sur des Demandes'],
  mentorat: ['mentorat', 'mentorats'],
  cv: ['relecture de CV', 'relectures de CV'],
  reponse: ['réponse à une question', 'réponses à des questions'],
  offre: ['offre publiée', 'offres publiées'],
  recrute: ['recrutement confirmé', 'recrutements confirmés'],
};
export function aidantsSemaine(data, now = Date.now()) {
  const debut = now - 7 * J;
  const prof = new Map((data.profiles || []).map(p => [p.id, p]));
  const lau = id => (laureatCompte(prof.get(id)) ? prof.get(id) : null);
  const etu = id => prof.get(id)?.role === 'etudiant';
  const par = new Map();
  const noter = (lid, k, sid, at) => {
    const p = lau(lid);
    if (!p || !dans(at, debut, now)) return;
    const x = par.get(lid) || { id: lid, p, prenom: prenomDe(p), langue: p.langue === 'ar' ? 'ar' : 'fr', gestes: {}, etudiants: new Set(), dernier: 0 };
    x.gestes[k] = (x.gestes[k] || 0) + 1;
    if (sid && etu(sid)) x.etudiants.add(sid);
    x.dernier = Math.max(x.dernier, t(at));
    par.set(lid, x);
  };
  const auteurD = new Map((data.demandes || []).map(d => [d.id, d.auteur_id]));
  const auteurQ = new Map((data.questions || []).map(q => [q.id, q.author_id]));
  for (const x of data.propositions || []) if (x.status !== 'retiree' && etu(auteurD.get(x.demande_id))) noter(x.laureat_id, 'aide', auteurD.get(x.demande_id), x.created_at);
  for (const m of data.mentorships || []) {
    if (m.status === 'acceptee' && etu(m.student_id)) noter(m.mentor_id, 'mentorat', m.student_id, m.accepted_at);
    if (m.status === 'terminee' && etu(m.student_id)) noter(m.mentor_id, 'mentorat', m.student_id, m.rdv_at || m.accepted_at);
  }
  for (const r of data.relectures_cv || []) if (r.status === 'rendue' && etu(r.student_id)) noter(r.reviewer_id, 'cv', r.student_id, r.rendue_at);
  for (const a of data.answers || []) if (etu(auteurQ.get(a.question_id))) noter(a.author_id, 'reponse', auteurQ.get(a.question_id), a.created_at);
  for (const o of data.offers || []) if ((o.audience || 'etudiants') === 'etudiants' && !estPartagee(o)) noter(o.author_id, 'offre', null, o.created_at);
  for (const p of data.placements || []) if (p.status === 'confirme' && etu(p.student_id)) noter(p.laureat_id, 'recrute', p.student_id, p.confirmed_at);
  return [...par.values()].sort((a, b) => b.dernier - a.dernier).map(x => ({ ...x, etudiants: [...x.etudiants] }));
}
// « 2 mentorats · 1 relecture de CV »
export const ligneGestes = g => Object.entries(GESTES).filter(([k]) => g[k]).map(([k, [un, plus]]) => `${g[k]} ${g[k] > 1 ? plus : un}`).join(' · ');

// La semaine ISO (lundi → dimanche) : la case « D'accord » du merci vaut pour une semaine
export function semaineISO(now = Date.now()) {
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); // le jeudi de la semaine donne son année
  const s1 = new Date(d.getFullYear(), 0, 4);
  const n = 1 + Math.round(((d - s1) / J - 3 + ((s1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(n).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Dates et listes, dans les deux langues
// ---------------------------------------------------------------------------
const JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const JOURS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'];
const deux = n => String(n).padStart(2, '0');
export const dateLongue = (x, langue = 'fr', annee = false) => {
  const d = new Date(x);
  return langue === 'ar' ? `${d.getDate()} ${MOIS_AR[d.getMonth()]}${annee ? ` ${d.getFullYear()}` : ''}` : `${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS_FR[d.getMonth()]}${annee ? ` ${d.getFullYear()}` : ''}`;
};
const quandEvenement = (x, langue) => {
  const d = new Date(x), h = `${deux(d.getHours())}:${deux(d.getMinutes())}`;
  return langue === 'ar' ? `${JOURS_AR[d.getDay()]} ${dateLongue(d, 'ar')}، الساعة ${h}` : `${JOURS_FR[d.getDay()]} ${dateLongue(d, 'fr')} à ${h.replace(':', 'h')}`;
};
// « Youssef, Nadia et Karim » / « Youssef، Nadia وKarim »
export function listeNoms(noms, langue = 'fr') {
  const l = noms.filter(Boolean);
  if (l.length < 2) return l[0] || '';
  return langue === 'ar' ? `${l.slice(0, -1).join('، ')} و${l[l.length - 1]}` : `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]}`;
}
const pl = (n, un, plus) => `${n} ${n > 1 ? plus : un}`;
// Accords en arabe : 1, 2, 3 à 10, 11 et plus (sujet, puis complément)
const AR = {
  etudiant: ['طالب واحد', 'طالبان', 'طلبة', 'طالبًا'], etudiantC: ['طالبًا واحدًا', 'طالبين', 'طلبة', 'طالبًا'],
  laureat: ['خريج واحد', 'خريجان', 'خريجين', 'خريجًا'], laureatC: ['خريجًا واحدًا', 'خريجين', 'خريجين', 'خريجًا'],
  offre: ['عرض واحد', 'عرضان', 'عروض', 'عرضًا'], demande: ['طلب واحد', 'طلبان', 'طلبات', 'طلبًا'],
  match: ['توافق واحد', 'توافقان', 'توافقات', 'توافقًا'], aide: ['مساعدة واحدة', 'مساعدتان', 'مساعدات', 'مساعدة'],
  entreprise: ['مقاولة واحدة', 'مقاولتان', 'مقاولات', 'مقاولة'], membre: ['عضو واحد', 'عضوان', 'أعضاء', 'عضوًا'],
  autre: ['واحد آخر', 'اثنان آخران', 'آخرين', 'آخرين'], autreOffre: ['عرض آخر', 'عرضان آخران', 'عروض أخرى', 'عرضًا آخر'],
};
// Comme arCount (i18n.js, qui touche au document dès son chargement) : ce fichier reste lisible hors du navigateur
const ar = (n, k) => { const [un, deuxF, peu, beaucoup] = AR[k]; n = +n; return n === 1 ? un : n === 2 ? deuxF : `${n} ${n >= 3 && n <= 10 ? peu : beaucoup}`; };

const TYPE_FR = { stage: ['stage', 'stages'], pfe: ['PFE', 'PFE'], etranger: ['stage à l’étranger', 'stages à l’étranger'], emploi: ['emploi', 'emplois'] };
const TYPE_AR = { stage: 'تدريب', pfe: 'مشروع نهاية الدراسة', etranger: 'تدريب بالخارج', emploi: 'عمل' };
// « 3A, 4A » / « Jeunes diplômés » / « Lauréats »
export function niveauOffre(o, langue = 'fr') {
  if (o.audience === 'laureats') return langue === 'ar' ? 'الخريجون' : 'Lauréats';
  const a = (o.annees || []).filter(n => NIVEAUX[n]).sort();
  if (!a.length) return '';
  return a.map(n => (n === 6 ? (langue === 'ar' ? 'الخريجون الجدد' : 'Jeunes diplômés') : n === 7 ? (langue === 'ar' ? 'الخريجون' : 'Lauréats') : NIVEAUX[n].short)).join(', ');
}
const ouverte = (o, now) => o.status === 'ouverte' && !(daysUntil(o.deadline, new Date(now)) < 0);

// ---------------------------------------------------------------------------
// a) Le résumé de la semaine : pour les lauréats (promo null), ou pour une promo d'étudiants (ses offres seulement)
// ---------------------------------------------------------------------------
export function resumeSemaine(data0, { now = Date.now(), saison = seasonOf(new Date(now)), lien = '', promo = null, ecole = ECOLE_DEFAUT } = {}) {
  const data = vueEcole(data0, ecole);
  const debut = now - 7 * J, ids = new Set((data.profiles || []).map(p => p.id));
  const membres = membresDe(data).filter(p => dans(p.created_at, debut, now));
  const nE = membres.filter(p => p.role === 'etudiant').length, nL = membres.filter(p => p.role === 'laureat').length;
  const niveau = promo ? niveauOf({ promo }, saison) : null;
  const offres = (data0.offers || []).filter(o => ouverte(o, now) && dans(o.created_at, debut, now) && (!ecole || ecoleDe(o) === ecole)
    && (niveau === null || (o.audience !== 'laureats' && (o.annees || []).includes(niveau))))
    .sort((a, b) => t(b.created_at) - t(a.created_at));
  const auteur = new Map((data.profiles || []).map(p => [p.id, p]));
  const demandes = niveau !== null ? [] : (data.demandes || []).filter(d => d.status === 'ouverte' && auteur.get(d.auteur_id)?.role === 'etudiant'
    && now - t(d.relancee_at || d.created_at) < 60 * J);
  const parType = Object.keys(TYPE_FR).map(k => [k, demandes.filter(d => d.type === k).length]).filter(([, n]) => n);
  const matchs = (data.matchs || []).filter(m => dans(m.created_at, debut, now) && ids.has(m.etudiant_id)).length;
  const aides = aidesEntre(data, debut, now);
  const nAidants = new Set(aides.map(a => a.laureat)).size, nAides = new Set(aides.map(a => a.etudiant)).size;
  const pub = niveau === null ? ['tous', 'laureats'] : ['tous', 'etudiants'];
  const evenements = (data0.evenements || []).filter(e => !e.annule && pub.includes(e.public || 'tous') && t(e.debut) >= now && t(e.debut) <= now + 14 * J)
    .sort((a, b) => t(a.debut) - t(b.debut)).slice(0, 3);
  const top = offres.slice(0, 5), reste = offres.length - top.length;
  const nomPromo = niveau !== null && NIVEAUX[niveau] ? `${promo} (${NIVEAUX[niveau].short})` : `${promo}`;

  const fr = [
    niveau === null ? '✅ Cette semaine dans le Réseau ENSAM Meknès' : `✅ Cette semaine pour la promo ${nomPromo}`,
    nE || nL ? `📌 Nouveaux membres : ${[nE ? pl(nE, 'étudiant', 'étudiants') : '', nL ? pl(nL, 'lauréat', 'lauréats') : ''].filter(Boolean).join(' et ')}` : '',
    offres.length ? [`📌 ${niveau === null ? pl(offres.length, 'nouvelle offre', 'nouvelles offres') : `${pl(offres.length, 'nouvelle offre', 'nouvelles offres')} pour les ${NIVEAUX[niveau]?.short || promo}`} :`,
      ...top.map(o => `• ${o.titre} · ${o.entreprise}`), reste ? `• et ${pl(reste, 'autre', 'autres')}` : ''].filter(Boolean).join('\n') : '',
    demandes.length ? `📌 ${demandes.length > 1 ? `${demandes.length} Demandes d’étudiants attendent un lauréat` : '1 Demande d’étudiant attend un lauréat'} : ${parType.map(([k, n]) => `${n} ${n > 1 ? TYPE_FR[k][1] : TYPE_FR[k][0]}`).join(', ')}` : '',
    matchs ? `📌 ${pl(matchs, 'match', 'matchs')} entre étudiants et lauréats` : '',
    nAidants ? `📌 ${nAidants > 1 ? `${nAidants} lauréats ont aidé` : '1 lauréat a aidé'} ${pl(nAides, 'étudiant', 'étudiants')}` : '',
    evenements.length ? ['📌 À venir :', ...evenements.map(e => `• ${quandEvenement(e.debut, 'fr')} · ${e.titre}`)].join('\n') : '',
    niveau === null ? `Pas encore inscrit ? Rejoins le réseau, et fais passer le lien aux lauréats de ta promo :\n${lien}` : `Pas encore inscrit ? Ta promo est déjà remplie avec ce lien :\n${lien}`,
  ].filter(Boolean).join('\n');

  const arTxt = [
    niveau === null ? '✅ هذا الأسبوع في شبكة ENSAM مكناس' : `✅ هذا الأسبوع لدفعة ${nomPromo}`,
    nE || nL ? `📌 أعضاء جدد: ${[nE ? ar(nE, 'etudiant') : '', nL ? ar(nL, 'laureat') : ''].filter(Boolean).join(' و')}` : '',
    offres.length ? [`📌 ${niveau === null ? `عروض جديدة: ${offres.length}` : `عروض جديدة لطلبة ${NIVEAUX[niveau]?.short || promo}: ${offres.length}`}`,
      ...top.map(o => `• ${o.titre} · ${o.entreprise}`), reste ? `• و${ar(reste, 'autreOffre')}` : ''].filter(Boolean).join('\n') : '',
    demandes.length ? `📌 ${ar(demandes.length, 'demande')} من الطلبة في انتظار خريج: ${parType.map(([k, n]) => `${n} ${TYPE_AR[k]}`).join('، ')}` : '',
    matchs ? `📌 ${ar(matchs, 'match')} بين الطلبة والخريجين` : '',
    nAidants ? `📌 ساعد ${ar(nAidants, 'laureat')} ${ar(nAides, 'etudiantC')}` : '',
    evenements.length ? ['📌 قريبًا:', ...evenements.map(e => `• ${quandEvenement(e.debut, 'ar')} · ${e.titre}`)].join('\n') : '',
    niveau === null ? `لم تسجّل بعد؟ انضم إلى الشبكة، وشارك الرابط مع خريجي دفعتك:\n${lien}` : `لم تسجّل بعد؟ دفعتك محدَّدة مسبقًا مع هذا الرابط:\n${lien}`,
  ].filter(Boolean).join('\n');
  return { fr, ar: arTxt, chiffres: { nE, nL, offres: offres.length, demandes: demandes.length, matchs, nAidants, nAides, evenements: evenements.length } };
}

// ---------------------------------------------------------------------------
// b) Le merci public : seulement les prénoms cochés (ceux qui ont dit oui), et combien d'étudiants ont été aidés
// ---------------------------------------------------------------------------
export function texteMerci(aidants, coches, { lien = '' } = {}) {
  const oui = new Set(coches || []);
  const noms = aidants.filter(a => oui.has(a.id)).map(a => a.prenom).filter(Boolean);
  // « ont aidé » : ceux qui ont aidé un étudiant ; les offres publiées sont comptées à part
  const nL = aidants.filter(a => a.etudiants.length).length, nE = new Set(aidants.flatMap(a => a.etudiants)).size;
  const nO = aidants.reduce((n, a) => n + (a.gestes.offre || 0), 0);
  const fr = [
    noms.length ? `🙏 Merci à ${listeNoms(noms, 'fr')} !` : '🙏 Merci aux lauréats qui ont aidé cette semaine !',
    nL && nE ? `Cette semaine, ${nL > 1 ? `${nL} lauréats ont aidé` : '1 lauréat a aidé'} ${pl(nE, 'étudiant', 'étudiants')} de l’ENSAM Meknès : conseils, relectures de CV, stages et PFE.` : '',
    nO ? `${nO > 1 ? `${nO} offres ont été publiées` : '1 offre a été publiée'} pour les étudiants.` : '',
    `Toi aussi, 20 minutes suffisent pour aider un étudiant :\n${lien}`,
  ].filter(Boolean).join('\n');
  const arTxt = [
    noms.length ? `🙏 شكرًا ${listeNoms(noms, 'ar')}!` : '🙏 شكرًا للخريجين الذين ساعدوا هذا الأسبوع!',
    nL && nE ? `هذا الأسبوع، ساعد ${ar(nL, 'laureat')} ${ar(nE, 'etudiantC')} من ENSAM مكناس: نصائح، ومراجعة السير الذاتية، وتداريب ومشاريع نهاية الدراسة.` : '',
    nO ? `ونُشر ${ar(nO, 'offre')} للطلبة.` : '',
    `أنت أيضًا، 20 دقيقة تكفي لمساعدة طالب:\n${lien}`,
  ].filter(Boolean).join('\n');
  return { fr, ar: arTxt, noms, nL, nE, nO };
}
// Le message qui demande l'accord du lauréat, dans sa langue
export const messageAccordMerci = (a, langue = a?.langue) => (langue === 'ar'
  ? `مرحبا ${a.prenom}، شكرًا على مساعدتك هذا الأسبوع 🙏 كل أسبوع نشكر علنًا الخريجين الذين ساعدوا، في مجموعات واتساب الخاصة بالدفعات، بالاسم الشخصي فقط. هل توافق على ذكر اسمك الشخصي؟ أجب فقط بنعم أو لا.`
  : `Bonjour ${a.prenom}, merci pour ton aide cette semaine 🙏 Chaque semaine, on remercie publiquement les lauréats qui ont aidé, dans les groupes WhatsApp des promos, avec le prénom seulement. Es-tu d’accord pour qu’on cite ton prénom ? Réponds simplement oui ou non.`);

// ---------------------------------------------------------------------------
// c) Membres fondateurs : les prénoms de ceux qui acceptent d'être montrés, et les places qui restent
// ---------------------------------------------------------------------------
// accords : en ligne, l'id → fondateur_public lu dans la table profiles (la vue des profils ne le donne pas) ; un fondateur
// qui n'y est pas encore n'est pas cité. Sans accords (démo), le profil le porte. Un « non » écarte toujours le prénom.
export function texteFondateurs(data, { liste = classementFondateurs(data), lien = '', max = 6, accords = null } = {}) {
  const prof = new Map((data.profiles || []).map(p => [p.id, p]));
  const tous = liste.map(f => prof.get(f.id)).filter(Boolean);
  const cite = p => (accords ? accords.has(p.id) && accords.get(p.id) !== false : p.fondateur_public !== false);
  const montres = tous.filter(cite).map(prenomDe).filter(Boolean).slice(0, max);
  const autres = tous.length - montres.length, reste = Math.max(0, NB_FONDATEURS - liste.length);
  const fr = [
    '⭐ Membres fondateurs du Réseau ENSAM Meknès',
    `Les ${NB_FONDATEURS} premiers lauréats qui aident un étudiant deviennent membres fondateurs, pour toujours.`,
    montres.length ? `Déjà : ${autres ? `${montres.join(', ')} et ${pl(autres, 'autre', 'autres')}` : listeNoms(montres, 'fr')}.` : '',
    reste ? `${reste > 1 ? `Il reste ${reste} places` : 'Il reste 1 place'}. Publie une offre, propose ton aide sur une Demande ou accepte un mentorat :\n${lien}` : `Les ${NB_FONDATEURS} places sont prises : merci à eux ! Le réseau continue :\n${lien}`,
  ].filter(Boolean).join('\n');
  const arTxt = [
    '⭐ الأعضاء المؤسسون لشبكة ENSAM مكناس',
    `أول ${NB_FONDATEURS} خريجًا يساعدون طالبًا يصبحون أعضاء مؤسسين، إلى الأبد.`,
    montres.length ? `حتى الآن: ${autres ? `${montres.join('، ')} و${ar(autres, 'autre')}` : listeNoms(montres, 'ar')}.` : '',
    reste ? `الأماكن المتبقية: ${reste} من ${NB_FONDATEURS}. انشر عرضًا، أو اقترح مساعدتك على طلب، أو اقبل مرافقة:\n${lien}` : `امتلأت الأماكن الـ${NB_FONDATEURS}: شكرًا لهم! والشبكة مستمرة:\n${lien}`,
  ].filter(Boolean).join('\n');
  return { fr, ar: arTxt, reste, total: liste.length };
}

// ---------------------------------------------------------------------------
// d) Une promo de 3A, 4A ou 5A : « publiez votre Demande avec votre CV », et pourquoi en deux lignes
// ---------------------------------------------------------------------------
export function textePromoDemande(promo, { saison = seasonOf(), lien = '' } = {}) {
  const n = niveauOf({ promo }, saison), an = NIVEAUX[n]?.short || '';
  const quoi = n === 5 ? ['votre PFE, un stage à l’étranger ou un premier emploi', 'مشروع نهاية الدراسة أو تدريب بالخارج أو أول عمل'] : ['un stage, au Maroc ou à l’étranger', 'تدريب، في المغرب أو بالخارج'];
  const fr = [
    `📌 Promo ${promo} (${an}) : publiez votre Demande avec votre CV`,
    `Vous cherchez ${quoi[0]} ? Les lauréats de votre filière voient votre Demande, et ceux qui peuvent aider vous répondent sur la plateforme.`,
    'Avec le CV joint, un lauréat sait tout de suite s’il peut vous recommander, vous encadrer ou vous prendre dans son équipe.',
    `Deux minutes suffisent :\n${lien}`,
  ].join('\n');
  const arTxt = [
    `📌 دفعة ${promo} (${an}): انشروا طلبكم مع سيرتكم الذاتية`,
    `تبحثون عن ${quoi[1]}؟ يرى خريجو شعبتكم طلبكم، ومن يستطيع المساعدة يجيبكم على المنصة.`,
    'مع السيرة الذاتية المرفقة، يعرف الخريج فورًا إن كان بإمكانه أن يوصي بكم أو يؤطركم أو يضمكم إلى فريقه.',
    `دقيقتان تكفيان:\n${lien}`,
  ].join('\n');
  return { fr, ar: arTxt, niveau: n };
}

// ---------------------------------------------------------------------------
// e) « Une offre de ta boîte » : les lauréats qui ont une entreprise et n'ont encore publié aucune offre
// ---------------------------------------------------------------------------
export function laureatsSansOffre(data) {
  const auteurs = new Set((data.offers || []).map(o => o.author_id));
  return membresDe(data).filter(p => p.role === 'laureat' && String(p.entreprise || '').trim() && !auteurs.has(p.id))
    .sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''), 'fr'));
}
export const messageOffreBoite = (p, lien = '', langue = p?.langue) => (langue === 'ar'
  ? `مرحبا ${prenomDe(p)} 👋\nيبحث طلبة ENSAM مكناس عن تداريب ومشاريع نهاية الدراسة، وربما يوجد مكان لأحدهم في ${p.entreprise}.\nعرض في 30 ثانية: الصق نص الإعلان، والمنصة تملأ الباقي.\n${lien}\nشكرًا 🙏`
  : `Bonjour ${prenomDe(p)} 👋\nLes étudiants de l’ENSAM Meknès cherchent des stages et des PFE, et il y a peut-être une place pour l’un d’eux chez ${p.entreprise}.\nUne offre en 30 secondes : colle le texte de l’annonce, la plateforme remplit le reste.\n${lien}\nMerci 🙏`);
export const OBJECTIF_OFFRES = 10;

// f) Le rendez-vous du mois : l'événement prérempli (en ligne, 30 minutes), dans 7 jours à 19 h, dans la langue de l'admin
export function rendezVousDuMois(now = Date.now(), langue = 'fr') {
  const debut = new Date(now); debut.setDate(debut.getDate() + 7); debut.setHours(19, 0, 0, 0);
  const ar = langue === 'ar';
  return {
    titre: ar ? 'موعد الشهر: خريج، مهنة' : 'Rendez-vous du mois : un lauréat, un métier', type: 'conference', lieu: ar ? 'عبر الإنترنت' : 'En ligne', public: 'tous',
    debut, fin: new Date(debut.getTime() + 30 * 6e4),
    description: ar ? 'كل شهر، يحكي خريج عن مهنته في 30 دقيقة، ثم يجيب عن أسئلة الطلبة. أضف رابط الاتصال المرئي قبل النشر.'
      : 'Chaque mois, un lauréat raconte son métier en 30 minutes, puis répond aux questions des étudiants. Ajoute le lien de la visio avant de publier.',
  };
}

// ---------------------------------------------------------------------------
// Les chiffres que citent les messages aux écoles et aux entreprises (toujours ceux du jour, jamais arrondis vers le haut)
// ---------------------------------------------------------------------------
export function chiffresReseau(data0, now = Date.now(), saison = seasonOf(new Date(now)), ecole = ECOLE_DEFAUT) {
  const data = vueEcole(data0, ecole);
  const m = membresDe(data), lau = m.filter(p => p.role === 'laureat'), etu = m.filter(p => p.role === 'etudiant');
  const parAnnee = Object.fromEntries([3, 4, 5].map(n => [n, etu.filter(p => niveauOf(p, saison) === n).length]));
  return {
    membres: m.length, laureats: lau.length, etudiants: etu.length,
    etudiants345: parAnnee[3] + parAnnee[4] + parAnnee[5], parAnnee,
    entreprises: new Set(lau.map(p => entKey(p.entreprise)).filter(Boolean)).size,
    aides30: aidesEntre(data, now - 30 * J, now).length,
  };
}

// Message pour une école : qui nous sommes, les vrais chiffres, la proposition, un appel de 20 minutes.
// a : association des étudiants, association des lauréats, ou direction (la formule d'appel change)
// « de l’ENSA Fès », « pour l’EMI » : l'article devant un nom qui commence par une voyelle (les sigles des écoles)
const voyelle = n => /^[aeiouyhàâéèêëîïôûü]/i.test(n);
export const deLEcoleNom = n => (voyelle(n) ? `de l’${n}` : `de ${n}`);
export const lEcoleNom = n => (voyelle(n) ? `l’${n}` : n);
export const DESTINATAIRES = [['etudiants', 'Association des étudiants'], ['laureats', 'Association des lauréats'], ['direction', 'Direction']];
export function messageEcole(c, { ecole = '', a = 'etudiants', signature = '', lien = '' } = {}) {
  const nom = String(ecole || '').trim() || 'votre école';
  const nomAr = String(ecole || '').trim() || 'مدرستكم';
  const appel = { etudiants: `Bonjour à l’équipe de l’association des étudiants ${deLEcoleNom(nom)},`, laureats: `Bonjour à l’équipe de l’association des lauréats ${deLEcoleNom(nom)},`, direction: 'Madame, Monsieur,' }[a] || 'Bonjour,';
  const appelAr = { etudiants: `السلام عليكم فريق جمعية طلبة ${nomAr}،`, laureats: `السلام عليكم فريق جمعية خريجي ${nomAr}،`, direction: `إلى إدارة ${nomAr} المحترمة،` }[a] || 'السلام عليكم،';
  const sign = [signature, `Réseau ENSAM Meknès · ${lien}`].filter(Boolean).join('\n');
  const signAr = [signature, `شبكة ENSAM مكناس · ${lien}`].filter(Boolean).join('\n');
  const fr = [
    appel, '',
    'Nous sommes des lauréats de l’ENSAM Meknès. Nous avons créé le Réseau ENSAM Meknès, une plateforme gratuite où les étudiants trouvent stages, PFE et conseils auprès des lauréats de leur école. C’est une initiative de lauréats, indépendante de l’administration de l’école.', '',
    `Aujourd’hui : ${pl(c.membres, 'membre', 'membres')}, dont ${pl(c.laureats, 'lauréat', 'lauréats')} dans ${pl(c.entreprises, 'entreprise', 'entreprises')}, et ${pl(c.aides30, 'aide donnée', 'aides données')} aux étudiants ces 30 derniers jours.`, '',
    'Notre proposition : ouvrir un réseau fermé pour votre école, sur la même plateforme. C’est gratuit, pour les étudiants comme pour les lauréats. Le nom de l’école n’est utilisé qu’avec votre accord écrit, et les données de chaque école restent séparées.', '',
    'Avez-vous 20 minutes pour un appel, cette semaine ou la suivante ?', '',
    'Bien cordialement,', sign,
  ].join('\n');
  const arTxt = [
    appelAr, '',
    'نحن خريجون من ENSAM مكناس. أنشأنا «شبكة ENSAM مكناس»، منصة مجانية يجد فيها الطلبة تداريب ومشاريع نهاية الدراسة ونصائح لدى خريجي مدرستهم. إنها مبادرة من الخريجين، مستقلة عن إدارة المدرسة.', '',
    `اليوم: ${ar(c.membres, 'membre')}، منهم ${ar(c.laureats, 'laureat')} في ${ar(c.entreprises, 'entreprise')}، و${ar(c.aides30, 'aide')} قُدّمت للطلبة خلال الثلاثين يومًا الماضية.`, '',
    'اقتراحنا: فتح شبكة مغلقة خاصة بمدرستكم على المنصة نفسها، مجانًا للطلبة والخريجين. لا يُستعمل اسم المدرسة إلا بموافقتكم المكتوبة، وتبقى معطيات كل مدرسة منفصلة.', '',
    'هل لديكم 20 دقيقة لمكالمة هذا الأسبوع أو الأسبوع المقبل؟', '',
    'مع خالص التحيات،', signAr,
  ].join('\n');
  return { fr, ar: arTxt, sujet: { fr: `Un réseau entre étudiants et lauréats pour ${nom === 'votre école' ? nom : lEcoleNom(nom)}`, ar: `شبكة بين الطلبة والخريجين لـ${nomAr}` } };
}

// Message pour une entreprise : les vrais chiffres (dont les étudiants de 3A, 4A et 5A), les règles (label, une carte sur 10, aucune donnée personnelle,
// l'argent vient des entreprises seulement) et les trois formules
export function messageEntreprise(c, { contact = '', signature = '', lien = '' } = {}) {
  const [v, p, s] = ['visibilite', 'partenaire', 'saison_pfe'].map(k => FORMULES.find(f => f.k === k));
  const sign = [signature, `Réseau ENSAM Meknès · ${lien}`].filter(Boolean).join('\n');
  const signAr = [signature, `شبكة ENSAM مكناس · ${lien}`].filter(Boolean).join('\n');
  const qui = String(contact || '').trim();
  // Les étudiants année par année (3A, 4A, 5A), dès qu'il y en a
  const parAn = c.etudiants345 && c.parAnnee ? c.parAnnee : null;
  const fr = [
    qui ? `Bonjour ${qui},` : 'Bonjour,', '',
    'Je vous écris pour le Réseau ENSAM Meknès, la plateforme gratuite qui relie les étudiants et les lauréats de l’ENSAM Meknès. C’est une initiative de lauréats, indépendante de l’administration de l’école.', '',
    `Aujourd’hui : ${pl(c.laureats, 'lauréat', 'lauréats')} et ${pl(c.etudiants345, 'étudiant', 'étudiants')} de 3e, 4e et 5e année${parAn ? ` (${parAn[3]} en 3A, ${parAn[4]} en 4A, ${parAn[5]} en 5A)` : ''}, qui cherchent stages, PFE et premier emploi ; des lauréats dans ${pl(c.entreprises, 'entreprise', 'entreprises')} ; ${pl(c.aides30, 'aide donnée', 'aides données')} ces 30 derniers jours.`, '',
    'Nous proposons aux entreprises de se faire connaître de ces étudiants, avec des règles claires :',
    '• tout ce qui est payé porte le label « Sponsorisé » ;',
    '• dans Match, une carte sponsorisée au plus toutes les 10 cartes ;',
    '• aucune donnée personnelle des membres n’est transmise, et aucun traceur ;',
    '• l’argent vient seulement des entreprises, jamais des membres.', '',
    'Trois formules, à des prix de départ :',
    `• ${v.nom} : une carte « Sponsorisé » dans Match pour les filières choisies, et un rapport chaque mois. ${dh(v.prix)} par mois.`,
    `• ${p.nom} : Visibilité, plus vos offres en tête de liste, une page entreprise et un événement par trimestre. ${dh(p.prix)} par mois.`,
    `• ${s.nom} : vos offres en tête et votre carte dans Match, de novembre à mars, avec un rapport à la fin. ${dh(s.prix)}.`, '',
    'Avez-vous 20 minutes pour en parler cette semaine ?', '',
    'Bien cordialement,', sign,
  ].join('\n');
  const arTxt = [
    qui ? `السلام عليكم ${qui}،` : 'السلام عليكم،', '',
    'أكتب إليكم باسم «شبكة ENSAM مكناس»، المنصة المجانية التي تربط طلبة وخريجي ENSAM مكناس. إنها مبادرة من الخريجين، مستقلة عن إدارة المدرسة.', '',
    `اليوم: ${ar(c.laureats, 'laureat')} و${ar(c.etudiants345, 'etudiant')} من السنوات الثالثة والرابعة والخامسة${parAn ? ` (${parAn[3]} في السنة الثالثة، ${parAn[4]} في الرابعة، ${parAn[5]} في الخامسة)` : ''} يبحثون عن تداريب ومشاريع نهاية الدراسة وأول عمل؛ وخريجون في ${ar(c.entreprises, 'entreprise')}؛ و${ar(c.aides30, 'aide')} خلال الثلاثين يومًا الماضية.`, '',
    'نقترح على المقاولات أن تعرّف بنفسها لدى هؤلاء الطلبة، بقواعد واضحة:',
    '• كل ما هو مدفوع يحمل علامة «مُموَّل»؛',
    '• في التوافق، بطاقة مُموَّلة واحدة على الأكثر كل 10 بطاقات؛',
    '• لا تُنقل أي معطيات شخصية للأعضاء، ولا أداة تتبع؛',
    '• المال يأتي من المقاولات فقط، أبدًا من الأعضاء.', '',
    'ثلاث صيغ، بأسعار أولية:',
    `• الظهور: بطاقة «مُموَّل» في التوافق للشعب المختارة، وتقرير كل شهر. ${dh(v.prix)} في الشهر.`,
    `• الشريك: الظهور، مع عروضكم في أعلى القائمة، وصفحة للمقاولة، وحدث كل ثلاثة أشهر. ${dh(p.prix)} في الشهر.`,
    `• حملة مشاريع نهاية الدراسة: عروضكم في الأعلى وبطاقتكم في التوافق، من نونبر إلى مارس، مع تقرير في النهاية. ${dh(s.prix)}.`, '',
    'هل لديكم 20 دقيقة للحديث عن ذلك هذا الأسبوع؟', '',
    'مع خالص التحيات،', signAr,
  ].join('\n');
  return { fr, ar: arTxt, sujet: { fr: 'Rencontrer les étudiants ingénieurs de l’ENSAM Meknès', ar: 'التعرّف على الطلبة المهندسين في ENSAM مكناس' } };
}

// ---------------------------------------------------------------------------
// Rapport pour l'école : les 30 derniers jours, sans aucun nom
// ---------------------------------------------------------------------------
// Les n dernières semaines (lundi → dimanche), la plus ancienne d'abord ; la dernière est la semaine en cours
export function parSemaine(dates, now = Date.now(), n = 12) {
  const lundi = new Date(now); lundi.setHours(0, 0, 0, 0); lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7));
  const semaines = Array.from({ length: n }, (_, i) => {
    const d = new Date(lundi); d.setDate(d.getDate() - 7 * (n - 1 - i));
    const f = new Date(d); f.setDate(f.getDate() + 7);
    return { debut: d.getTime(), fin: f.getTime(), n: 0 };
  });
  for (const x of dates) { const v = t(x); const s = semaines.find(w => v >= w.debut && v < w.fin); if (s) s.n++; }
  return semaines;
}
export function chiffresRapport(data0, now = Date.now(), saison = seasonOf(new Date(now)), ecole = ECOLE_DEFAUT) {
  const data = vueEcole(data0, ecole), debut = now - 30 * J;
  const m = membresDe(data), lau = m.filter(p => p.role === 'laureat'), etu = m.filter(p => p.role === 'etudiant');
  const ids = new Set(m.map(p => p.id));
  const parcours = PARCOURS.map(x => ({ code: x.code, nom: x.nom, n: m.filter(p => parcoursOf(p.filiere).includes(x.code)).length })).filter(x => x.n).sort((a, b) => b.n - a.n).slice(0, 3);
  const r = reponses48h(data, new Date(now)).parType.demande;
  return {
    debut, fin: now,
    membres: m.length, nouveaux: m.filter(p => dans(p.created_at, debut, now)).length,
    etudiants: etu.length, parAnnee: [1, 2, 3, 4, 5].map(n => ({ n, label: NIVEAUX[n].short, total: etu.filter(p => niveauOf(p, saison) === n).length })),
    laureats: lau.length, verifies: lau.filter(p => p.verified).length,
    entreprises: new Set(lau.map(p => entKey(p.entreprise)).filter(Boolean)).size,
    offres: (data0.offers || []).filter(o => ouverte(o, now) && (!ecole || ecoleDe(o) === ecole)).length,
    demandes: r.total, demandes48: r.a48, taux48: r.taux,
    aides: aidesEntre(data, debut, now).length,
    mentorats: (data.mentorships || []).filter(x => x.status === 'terminee' && ids.has(x.student_id) && dans(x.rdv_at || x.accepted_at, debut, now)).length,
    recrutements: (data.placements || []).filter(p => p.status === 'confirme' && p.saison === saison && ids.has(p.student_id)).length,
    parcours,
    inscriptions: parSemaine(m.map(p => p.created_at), now),
    aidesSemaines: parSemaine(aidesEntre(data, now - 13 * 7 * J, now).map(a => a.at), now),
  };
}

// ---------------------------------------------------------------------------
// Les offres ouvertes des 14 derniers jours, pour le bureau des relations entreprises de l'école
// ---------------------------------------------------------------------------
// Seulement les offres pour les étudiants : une offre « Entre lauréats » ne s'ouvre pas pour eux (politique de lecture des offres)
export function offresRecentes(data, now = Date.now(), ecole = ECOLE_DEFAUT) {
  return (data.offers || []).filter(o => (o.audience || 'etudiants') === 'etudiants' && ouverte(o, now) && dans(o.created_at, now - 14 * J, now) && (!ecole || ecoleDe(o) === ecole))
    .sort((a, b) => t(b.created_at) - t(a.created_at));
}
export function texteOffresBRE(offres, { base = '' } = {}) {
  const ligne = (o, l) => `• ${[o.titre, o.entreprise, o.ville, niveauOffre(o, l)].filter(Boolean).join(' · ')}\n  ${base}#offre/${o.id}`;
  const fr = offres.length
    ? [`Offres de stage, de PFE et d’emploi publiées sur le Réseau ENSAM Meknès ces 14 derniers jours (${offres.length}) :`, '', ...offres.map(o => ligne(o, 'fr')), '',
      'Les étudiants postulent sur la plateforme, gratuite. Initiative de lauréats, indépendante de l’administration de l’école.'].join('\n')
    : 'Aucune offre nouvelle ces 14 derniers jours.';
  const arTxt = offres.length
    ? [`عروض التداريب ومشاريع نهاية الدراسة والعمل المنشورة على شبكة ENSAM مكناس خلال الأيام الأربعة عشر الماضية (${offres.length}):`, '', ...offres.map(o => ligne(o, 'ar')), '',
      'يترشح الطلبة على المنصة مجانًا. مبادرة من الخريجين، مستقلة عن إدارة المدرسة.'].join('\n')
    : 'لا توجد عروض جديدة خلال الأيام الأربعة عشر الماضية.';
  return { fr, ar: arTxt };
}

// ---------------------------------------------------------------------------
// Visuels des réussites : un recrutement confirmé, les deux personnes d'accord, les prénoms seulement
// ---------------------------------------------------------------------------
export function texteVisuel(pl0, etudiant, laureat, langue = 'fr') {
  const e = prenomDe(etudiant), l = laureat ? prenomDe(laureat) : '';
  // En arabe, un titre sans accord (on ne connaît pas le genre) : « انضمام X إلى Y »
  const titre = langue === 'ar' ? `انضمام ${e} إلى ${pl0.entreprise}` : `${e} a rejoint ${pl0.entreprise}`;
  const aide = l ? (langue === 'ar' ? `بمساعدة ${l}${laureat?.promo ? `، دفعة ${laureat.promo}` : ''}` : `avec l’aide de ${l}${laureat?.promo ? `, promo ${laureat.promo}` : ''}`) : '';
  return { titre, aide, signature: langue === 'ar' ? 'شبكة ENSAM مكناس' : 'Réseau ENSAM Meknès' };
}
// Les deux personnes ont coché « peut être montré » (colonnes à venir dans la base) ; sans lauréat, l'étudiant suffit
export const consentementsDonnes = pl0 => pl0?.public_etudiant === true && (pl0?.public_laureat === true || !pl0?.laureat_id);
// Le message qui demande l'accord, dans la langue de la personne. Au lauréat, on rappelle qui il a aidé (le prénom).
export function messageAccordVisuel(pl0, p, role, langue = p?.langue, etudiant = null) {
  const pr = prenomDe(p), e = prenomDe(etudiant), ent = pl0?.entreprise || '';
  if (role === 'laureat') {
    return langue === 'ar'
      ? `مرحبا ${pr} 👋 شكرًا مرة أخرى على مساعدتك ${e || 'طالبنا'} في الالتحاق بـ${ent}! نودّ مشاركة هذا النجاح في صورة على مجموعات الشبكة وصفحاتها، مع اسمك الشخصي ودفعتك فقط، دون صورة. هل توافق؟ أجب فقط بنعم أو لا.`
      : `Bonjour ${pr} 👋 Merci encore d’avoir aidé ${e || 'notre étudiant'} à rejoindre ${ent} ! Nous aimerions partager cette réussite en image dans les groupes et sur les pages du réseau, avec ton prénom et ta promo seulement, sans photo. Es-tu d’accord ? Réponds simplement oui ou non.`;
  }
  return langue === 'ar'
    ? `مرحبا ${pr} 👋 تهانينا مرة أخرى على ${ent}! نودّ مشاركة هذا النجاح في صورة على مجموعات الشبكة وصفحاتها: اسمك الشخصي واسم المقاولة فقط، دون صورة. هل توافق؟ أجب فقط بنعم أو لا.`
    : `Bonjour ${pr} 👋 Encore bravo pour ${ent} ! Nous aimerions partager cette réussite en image dans les groupes et sur les pages du réseau : ton prénom et l’entreprise seulement, sans photo. Es-tu d’accord ? Réponds simplement oui ou non.`;
}
// Le nom du fichier téléchargé : « reussite-yasmine-renault-group-maroc-1080x1080.png »
export const nomFichierVisuel = (pl0, etudiant, w, h) => `reussite-${[prenomDe(etudiant), pl0?.entreprise].filter(Boolean).join(' ')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'reseau'}-${w}x${h}.png`;

// ---------------------------------------------------------------------------
// Affiches et mode événement
// ---------------------------------------------------------------------------
// Les inscrits du jour (depuis minuit, heure de l'appareil) et de la semaine (depuis lundi) : étudiants et lauréats
export function inscritsDepuis(data0, now = Date.now(), ecole = ECOLE_DEFAUT) {
  const minuit = new Date(now); minuit.setHours(0, 0, 0, 0);
  const lundi = new Date(minuit); lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7));
  const m = membresDe(vueEcole(data0, ecole));
  const depuis = d => m.filter(p => { const v = t(p.created_at); return v >= d.getTime() && v <= now; }).length;
  return { aujourdhui: depuis(minuit), semaine: depuis(lundi) };
}
// L'adresse sans « https:// » ni barre finale, à recopier à la main sous le QR code
export const adresseCourte = u => String(u || '').replace(/^https?:\/\//, '').replace(/#.*$/, '').replace(/\/+$/, '');
const ANNEE_AR = { 1: 'السنة الأولى', 2: 'السنة الثانية', 3: 'السنة الثالثة', 4: 'السنة الرابعة', 5: 'السنة الخامسة' };
// Les textes de l'affiche, en français et en arabe côte à côte. pour : une promo d'étudiants (3A à 5A), ou « laureats »
export function texteAffiche(pour, saison = seasonOf()) {
  const etu = pour !== 'laureats', n = etu ? niveauOf({ promo: pour }, saison) : 7, an = NIVEAUX[n]?.short || '';
  return {
    etudiants: etu, niveau: n,
    fr: {
      titre: 'Rejoins le Réseau ENSAM Meknès',
      pour: etu ? `Étudiants de ${an} · promo ${pour}` : 'Lauréats de toutes les promos',
      avantages: etu
        ? ['Stages, PFE et premiers emplois proposés par des lauréats', 'Ta Demande avec ton CV : les lauréats de ta filière te répondent', '20 minutes de conseil avec un lauréat']
        : ['Publie une offre de stage ou d’emploi en 30 secondes', 'Aide un étudiant de ta filière, 20 minutes quand tu peux', 'Retrouve ta promo et les lauréats de ta filière'],
      scan: etu ? 'Scanne pour t’inscrire : ta promo est déjà indiquée' : 'Scanne pour t’inscrire',
      gratuit: 'Gratuit',
      pied: 'Initiative de lauréats, indépendante de l’administration de l’école.',
    },
    ar: {
      titre: 'انضم إلى شبكة ENSAM مكناس',
      pour: etu ? `طلبة ${ANNEE_AR[n] || an} · دفعة ${pour}` : 'خريجو جميع الدفعات',
      avantages: etu
        ? ['تداريب ومشاريع نهاية الدراسة وأول وظيفة، يقترحها الخريجون', 'طلبك مع سيرتك الذاتية: يجيبك خريجو شعبتك', 'عشرون دقيقة من النصح مع خريج']
        : ['انشر عرض تدريب أو عمل في 30 ثانية', 'ساعد طالبًا من شعبتك، عشرون دقيقة متى استطعت', 'تواصل مع دفعتك ومع خريجي شعبتك'],
      scan: etu ? 'امسح الرمز للتسجيل: دفعتك محدَّدة مسبقًا' : 'امسح الرمز للتسجيل',
      gratuit: 'مجاني',
      pied: 'مبادرة من الخريجين، مستقلة عن إدارة المدرسة.',
    },
  };
}
