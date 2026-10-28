// Vitrine : règles pures (sans DOM), testées dans tests/unit/vitrine.test.mjs.
//  - Logo d'une entreprise : le domaine de son site, pour en montrer l'icône (le vrai logo gardé sur le site passe avant).
//  - Preuve sociale d'une offre, « Ça bouge cette semaine », « Grâce à toi » : des chiffres vrais, comptés seulement
//    dans ce que le membre peut lire (mêmes règles que la base), jamais un nom ou un détail privé.
import { niveauOf, seasonOf } from './logic.js';
import { peutLireCible, peutLireDemande } from './reseau-vivant.js';
import { partageExpire } from './origine.js';

// ---------------------------------------------------------------------------
// Logos : le domaine du site de l'entreprise, d'où vient son icône (https://icons.duckduckgo.com/ip3/<domaine>.ico).
// D'abord une table vérifiée des grandes entreprises présentes au Maroc ; sinon le domaine du lien de l'offre, s'il
// est bien celui de l'entreprise (pas LinkedIn, un formulaire ou un site de recrutement) et qu'il ressemble à son nom.
// ---------------------------------------------------------------------------
export const DOMAINES_ENTREPRISES = [
  ['ocpgroup.ma', ['ocp', 'ocp group', 'groupe ocp', 'ocp sa', 'office cherifien des phosphates']],
  ['stellantis.com', ['stellantis', 'psa', 'groupe psa']],
  ['lear.com', ['lear', 'lear corporation']],
  ['yazaki-group.com', ['yazaki']],
  ['atos.net', ['atos']],
  ['inwi.ma', ['inwi']],
  ['iam.ma', ['maroc telecom', 'iam', 'itissalat al maghrib']],
  ['attijariwafabank.com', ['attijariwafa', 'attijariwafa bank', 'attijari']],
  ['bankofafrica.ma', ['bank of africa', 'bmce', 'bmce bank', 'bmce bank of africa']],
  ['cihbank.ma', ['cih', 'cih bank']],
  ['groupebcp.com', ['banque populaire', 'groupe banque populaire', 'banque centrale populaire', 'bcp', 'chaabi bank']],
  ['bmci.ma', ['bmci']],
  ['sgmaroc.com', ['societe generale maroc', 'sg maroc']],
  ['societegenerale.com', ['societe generale']],
  ['creditagricole.ma', ['credit agricole du maroc']],
  ['cdg.ma', ['cdg', 'caisse de depot et de gestion']],
  ['lesieur-cristal.ma', ['lesieur', 'lesieur cristal']],
  ['cosumar.co.ma', ['cosumar']],
  ['lafargeholcim.ma', ['lafargeholcim', 'lafarge holcim', 'lafarge']],
  ['holcim.com', ['holcim']],
  ['cimentsdumaroc.com', ['ciments du maroc']],
  ['one.org.ma', ['onee', 'office national de l electricite et de l eau potable']],
  ['adm.co.ma', ['adm', 'autoroutes du maroc']],
  ['alstom.com', ['alstom']],
  ['siemensgamesa.com', ['siemens gamesa']],
  ['siemens-energy.com', ['siemens energy']],
  ['siemens.com', ['siemens']],
  ['dell.com', ['dell', 'dell technologies']],
  ['oracle.com', ['oracle']],
  ['deloitte.com', ['deloitte']],
  ['pwc.com', ['pwc', 'pricewaterhousecoopers']],
  ['ey.com', ['ey', 'ernst young', 'ernst and young']],
  ['kpmg.com', ['kpmg']],
  ['tangermed.ma', ['tanger med', 'tmsa']],
  ['managemgroup.com', ['managem']],
  ['tgcc.ma', ['tgcc']],
  ['royalairmaroc.com', ['royal air maroc', 'ram']],
  ['oncf.ma', ['oncf']],
  ['masen.ma', ['masen']],
  ['marsamaroc.co.ma', ['marsa maroc']],
  ['nexans.com', ['nexans']],
  ['leoni.com', ['leoni']],
  ['valeo.com', ['valeo']],
  ['aptiv.com', ['aptiv']],
  ['draexlmaier.com', ['draexlmaier', 'draxlmaier']],
  ['hutchinson.com', ['hutchinson']],
  ['forvia.com', ['forvia', 'faurecia']],
  ['thalesgroup.com', ['thales']],
  ['spiritaero.com', ['spirit aerosystems']],
  ['collinsaerospace.com', ['collins aerospace']],
  ['bombardier.com', ['bombardier']],
  ['daher.com', ['daher']],
  ['hexcel.com', ['hexcel']],
  ['alten.com', ['alten']],
  ['akkodis.com', ['akkodis']],
  ['expleo.com', ['expleo']],
  ['segulatechnologies.com', ['segula', 'segula technologies']],
  ['assystem.com', ['assystem']],
  ['bureauveritas.com', ['bureau veritas']],
  ['sgs.com', ['sgs']],
  ['jesagroup.com', ['jesa']],
  ['ibm.com', ['ibm']],
  ['microsoft.com', ['microsoft']],
  ['intelcia.com', ['intelcia']],
  ['sofrecom.com', ['sofrecom']],
  ['ericsson.com', ['ericsson']],
  ['nokia.com', ['nokia']],
  ['nttdata.com', ['ntt data']],
  ['inetum.com', ['inetum']],
  ['devoteam.com', ['devoteam']],
  ['sap.com', ['sap']],
  ['cisco.com', ['cisco']],
  ['hps-worldwide.com', ['hps', 'hps worldwide']],
  ['totalenergies.com', ['totalenergies', 'total maroc']],
  ['nestle.com', ['nestle']],
  ['danone.com', ['danone', 'centrale danone']],
  ['unilever.com', ['unilever']],
  ['pg.com', ['procter gamble', 'procter and gamble']],
  ['sanofi.com', ['sanofi']],
  ['airliquide.com', ['air liquide']],
  ['sonasid.ma', ['sonasid']],
  ['marjane.ma', ['marjane']],
  ['labelvie.ma', ['label vie', 'labelvie']],
  ['vinci.com', ['vinci']],
  ['saint-gobain.com', ['saint gobain']],
  ['michelin.com', ['michelin']],
  ['lydec.ma', ['lydec']],
  ['redal.ma', ['redal']],
  ['axa.com', ['axa']],
  ['allianz.com', ['allianz']],
];

const sansAccents = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const normaliser = s => sansAccents(s).toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
// Après un sigle court (OCP, EY, ADM), seuls ces mots peuvent suivre : « OCP Group », « EY Maroc », pas « ADM Logistics »
const APRES_SIGLE = new Set(['group', 'groupe', 'maroc', 'morocco', 'sa', 'sarl', 'sas', 'holding', 'international', 'casablanca', 'rabat', 'tanger', 'kenitra', 'meknes', 'fes', 'agadir', 'jorf', 'lasfar', 'safi', 'khouribga', 'benguerir', 'nouaceur']);
const EN_TETE = new Set(['groupe', 'group', 'the', 'ste', 'societe', 'la', 'le', 'les']);
function correspond(n, forme) {
  if (n === forme) return true;
  if (!n.startsWith(forme + ' ')) return false;
  if (forme.length > 3) return true;
  return n.slice(forme.length + 1).split(' ').every(m => APRES_SIGLE.has(m));
}
// Le domaine de la table pour ce nom (la forme la plus longue l'emporte : « Siemens Gamesa » avant « Siemens »)
export function domaineConnu(nom) {
  let n = normaliser(nom);
  const essais = [n];
  while (n.includes(' ') && EN_TETE.has(n.split(' ')[0])) { n = n.slice(n.indexOf(' ') + 1); essais.push(n); }
  let mieux = null, long = 0;
  for (const x of essais) for (const [d, formes] of DOMAINES_ENTREPRISES) for (const f of formes) if (f.length > long && correspond(x, f)) { mieux = d; long = f.length; }
  return mieux;
}

// Sites qui ne sont pas celui de l'entreprise : réseaux sociaux, sites d'emploi, outils de recrutement, formulaires, raccourcis
const PAS_ENTREPRISE = ['linkedin.com', 'lnkd.in', 'indeed.com', 'rekrute.com', 'welcometothejungle.com', 'emploi.ma', 'anapec.org', 'glassdoor.com', 'glassdoor.fr',
  'google.com', 'forms.gle', 'goo.gl', 'bit.ly', 'tinyurl.com', 't.co', 'ow.ly', 'buff.ly', 'linktr.ee', 'myworkdayjobs.com', 'workday.com', 'smartrecruiters.com',
  'lever.co', 'greenhouse.io', 'taleo.net', 'successfactors.com', 'successfactors.eu', 'sapsf.com', 'sapsf.eu', 'icims.com', 'workable.com', 'teamtailor.com',
  'recruitee.com', 'jobvite.com', 'bamboohr.com', 'breezy.hr', 'zohorecruit.com', 'jobteaser.com', 'hellowork.com', 'monster.com', 'monster.fr', 'apec.fr',
  'francetravail.fr', 'pole-emploi.fr', 'bayt.com', 'dreamjob.ma', 'marocannonces.com', 'avito.ma', 'facebook.com', 'fb.com', 'instagram.com', 'x.com',
  'twitter.com', 'whatsapp.com', 'wa.me', 't.me', 'telegram.me', 'youtube.com', 'youtu.be', 'tiktok.com', 'notion.site', 'notion.so', 'typeform.com',
  'jotform.com', 'office.com', 'sharepoint.com', 'live.com', 'outlook.com', 'gmail.com', 'dropbox.com', 'wetransfer.com', 'github.com', 'github.io',
  'gitlab.com', 'medium.com', 'canva.com', 'calendly.com', 'supabase.co', 'jit.si'];
// « cosumar.co.ma », « bankofafrica.ma », « careers.ocpgroup.ma » → « ocpgroup.ma »
const SECOND_NIVEAU = new Set(['co', 'com', 'org', 'net', 'gov', 'gouv', 'ac', 'edu']);
export function domaineDuLien(lien) {
  const s = String(lien || '').trim();
  if (!s || s.length > 500) return null;
  // http(s) seulement (pas mailto:, tel:…), sans identifiant ni mot de passe devant le domaine
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) return null;
  let u;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch { return null; }
  if (u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h) || /^\d+(\.\d+)+$/.test(h)) return null;
  const p = h.split('.').filter(Boolean);
  const d = (p.length >= 3 && p[p.length - 1].length === 2 && SECOND_NIVEAU.has(p[p.length - 2]) ? p.slice(-3) : p.slice(-2)).join('.');
  if (PAS_ENTREPRISE.some(x => d === x || h === x || h.endsWith('.' + x)) || /^(indeed|glassdoor|monster)\./.test(d)) return null;
  return d;
}
// Le domaine ressemble-t-il au nom ? « jesagroup.com » pour « JESA », « tangermed.ma » pour « Tanger Med ». Le premier mot
// propre au nom doit s'y lire (les mots communs, « Atelier », « Industrie », « Services »…, ne suffisent pas)
const MOTS_NEUTRES = new Set([...APRES_SIGLE, 'de', 'du', 'des', 'd', 'l', 'et', 'and', 'of', 'the', 'company', 'corporation', 'corp', 'operations', 'ltd', 'inc', 'llc', 'gmbh', 'plc', 'ag',
  ...EN_TETE, 'atelier', 'ateliers', 'industrie', 'industries', 'industriel', 'industrial', 'service', 'services', 'solution', 'solutions', 'technologie', 'technologies', 'technology',
  'tech', 'engineering', 'ingenierie', 'consulting', 'conseil', 'system', 'systems', 'systemes', 'automotive', 'energie', 'energy', 'bank', 'banque', 'entreprise', 'cabinet',
  'bureau', 'etudes', 'mecanique', 'electrique', 'electric', 'construction', 'btp', 'logistics', 'logistique', 'transport', 'digital', 'data', 'software', 'agence', 'centre',
  'center', 'africa', 'afrique', 'global', 'manufacturing', 'production', 'plastique', 'plastic', 'metal', 'aero', 'aerospace', 'aeronautique', 'nord', 'sud', 'new', 'smart']);
export function domaineRessemble(nom, domaine) {
  const etiquette = String(domaine || '').split('.')[0].replace(/[^a-z0-9]/g, '');
  const n = normaliser(nom);
  if (etiquette.length < 2 || !n) return false;
  const propre = n.split(' ').find(m => m.length >= 3 && !MOTS_NEUTRES.has(m));
  if (propre && etiquette.includes(propre)) return true;
  return etiquette.length >= 4 && n.replace(/ /g, '').includes(etiquette);
}
// Le domaine dont on montre l'icône, ou null (le monogramme reste)
export function domaineEntreprise(nom, lien) {
  const connu = domaineConnu(nom);
  if (connu) return connu;
  const d = domaineDuLien(lien);
  return d && domaineRessemble(nom, d) ? d : null;
}
export const lienFavicon = domaine => `https://icons.duckduckgo.com/ip3/${domaine}.ico`;

// ---------------------------------------------------------------------------
// Preuve sociale d'une offre : seulement ce que ce membre peut lire.
//  - les « mises de côté » (table reactions, lisible par tous) des autres membres du public visé ; à partir de 2 ;
//  - les candidatures, pour l'auteur et l'administration seulement (elles sont privées pour les autres) ;
//  - « Nouvelle » : publiée il y a moins de 3 jours (pas pour son auteur).
// ---------------------------------------------------------------------------
export const SAUVEES_MIN = 2;
export function preuvesOffre(data, o, me, now = Date.now()) {
  if (!o || !me) return { sauvees: 0, candidatures: null, nouvelle: false, public: 'etudiant' };
  const role = new Map((data.profiles || []).map(p => [p.id, p.role]));
  const publicVise = o.audience === 'laureats' ? 'laureat' : 'etudiant';
  const qui = new Set((data.reactions || []).filter(r => r.offer_id === o.id && r.kind === 'save' && r.user_id !== o.author_id && role.get(r.user_id) === publicVise).map(r => r.user_id));
  const voitCandidatures = o.author_id === me.id || me.role === 'admin';
  return {
    sauvees: qui.size >= SAUVEES_MIN ? qui.size : 0,
    candidatures: voitCandidatures ? (data.applications || []).filter(a => a.offer_id === o.id).length : null,
    nouvelle: o.status === 'ouverte' && o.author_id !== me.id && now - new Date(o.created_at).getTime() < 3 * 864e5,
    public: publicVise,
  };
}
export const phraseSauvees = (n, publicVise) => (publicVise === 'laureat' ? `${n} lauréats l’ont mise de côté` : `${n} étudiants l’ont mise de côté`);
export const phraseCandidatures = n => (n > 1 ? `${n} candidatures` : '1 candidature');

// ---------------------------------------------------------------------------
// « Ça bouge cette semaine » : des comptes, jamais qui. Sur 7 jours s'il s'y passe assez (3 gestes au moins),
// sinon sur 30 jours ; rien du tout si le réseau est calme (pas de « 0 »). Trois faits au plus, toujours dans cet ordre.
// Chaque fait se compte dans ce que le membre peut lire : les offres de son année (étudiant), les réponses
// sur ce qu'il peut lire (règles de reseau-vivant.js, comme la base), les membres de l'annuaire.
// Les réactions disent que le réseau vit (elles comptent pour choisir 7 ou 30 jours) mais ne sont pas un fait à montrer.
// ---------------------------------------------------------------------------
export function caBouge(data, me, byId, now = Date.now(), saison = seasonOf()) {
  if (!me) return null;
  const etudiant = me.role === 'etudiant';
  const niveau = etudiant ? niveauOf(me, saison) : null;
  const offreVue = o => o.status === 'ouverte' && !partageExpire(o, now)
    && (!etudiant || ((o.audience || 'etudiants') === 'etudiants' && (o.annees || []).includes(niveau)));
  const demandes = new Map((data.demandes || []).map(d => [d.id, d]));
  const calc = jours => {
    const debut = now - jours * 864e5;
    const dans = iso => { const t = iso ? new Date(iso).getTime() : NaN; return t >= debut && t <= now; };
    const n = {
      offres: (data.offers || []).filter(o => dans(o.created_at) && offreVue(o)).length,
      reactions: (data.reactions_publiques || []).filter(r => dans(r.created_at) && peutLireCible(data, me, r.offer_id ? { offer_id: r.offer_id } : { demande_id: r.demande_id }, byId, saison)).length,
      reponses: (data.reponses_demandes || []).filter(r => dans(r.created_at) && peutLireDemande(data, me, demandes.get(r.demande_id), byId, saison)).length
        + (data.answers || []).filter(a => dans(a.created_at)).length,
      membres: (data.profiles || []).filter(p => p.id !== me.id && ['laureat', 'etudiant'].includes(p.role) && dans(p.created_at)).length,
    };
    const faits = ['offres', 'reponses', 'membres'].filter(k => n[k] > 0).map(k => ({ cle: k, n: n[k] }));
    return { jours, faits, total: Object.values(n).reduce((a, b) => a + b, 0) };
  };
  const semaine = calc(7);
  if (semaine.total >= 3 && semaine.faits.length) return semaine;
  const mois = calc(30);
  return mois.faits.length ? mois : null;
}
const PHRASES_BOUGE = {
  offres: n => (n > 1 ? `${n} nouvelles offres` : '1 nouvelle offre'),
  reactions: n => (n > 1 ? `${n} réactions` : '1 réaction'),
  reponses: n => (n > 1 ? `${n} réponses` : '1 réponse'),
  membres: n => (n > 1 ? `${n} nouveaux membres` : '1 nouveau membre'),
};
export const phraseBouge = f => PHRASES_BOUGE[f.cle](f.n);

// ---------------------------------------------------------------------------
// « Grâce à toi » (accueil d'un lauréat) : la plus belle nouvelle vraie de ces derniers jours, sur ses offres.
//  recrute : un recrutement confirmé par l'étudiant (30 jours) ; retenu / entretien : une candidature sur son offre
//  passée à ce statut (14 jours, updated_at) ; sinon interet : des étudiants ont mis son offre de côté (14 jours, 2 au moins).
// Un même étudiant n'est dit qu'une fois, avec sa meilleure nouvelle.
// ---------------------------------------------------------------------------
const FORCE = { recrute: 3, retenu: 2, entretien: 1 };
export const DECROCHE = { stage: 'son stage', pfe: 'son PFE', etranger: 'son stage à l’étranger', emploi: 'son poste' };
export function graceAToi(data, me, now = Date.now()) {
  if (me?.role !== 'laureat') return null;
  const recent = (iso, j) => { const t = iso ? new Date(iso).getTime() : NaN; return t <= now && now - t < j * 864e5; };
  const mesOffres = new Map((data.offers || []).filter(o => o.author_id === me.id).map(o => [o.id, o]));
  const parEtudiant = new Map();
  const garder = ev => {
    const avant = parEtudiant.get(ev.etudiant);
    if (!avant || FORCE[ev.quoi] > FORCE[avant.quoi] || (FORCE[ev.quoi] === FORCE[avant.quoi] && ev.at > avant.at)) parEtudiant.set(ev.etudiant, ev);
  };
  for (const p of data.placements || []) {
    if (p.laureat_id === me.id && p.status === 'confirme' && p.student_id && recent(p.confirmed_at, 30)) garder({ quoi: 'recrute', etudiant: p.student_id, type: p.type, offre: p.offer_id && mesOffres.has(p.offer_id) ? p.offer_id : null, at: p.confirmed_at });
  }
  for (const a of data.applications || []) {
    const o = mesOffres.get(a.offer_id);
    if (!o || !['entretien', 'retenu'].includes(a.status) || !recent(a.updated_at, 14)) continue;
    garder({ quoi: a.status, etudiant: a.student_id, type: o.type, offre: o.id, at: a.updated_at });
  }
  const evs = [...parEtudiant.values()].sort((a, b) => FORCE[b.quoi] - FORCE[a.quoi] || new Date(b.at) - new Date(a.at));
  if (evs.length) return { ...evs[0], autres: evs.length - 1 };
  // Personne n'a encore avancé : ses offres qui intéressent (mises de côté récentes par des étudiants)
  const role = new Map((data.profiles || []).map(p => [p.id, p.role]));
  let mieux = null;
  for (const o of mesOffres.values()) {
    if (o.status !== 'ouverte') continue;
    const qui = new Set((data.reactions || []).filter(r => r.offer_id === o.id && r.kind === 'save' && recent(r.created_at, 14) && role.get(r.user_id) === 'etudiant').map(r => r.user_id));
    if (qui.size >= SAUVEES_MIN && (!mieux || qui.size > mieux.n)) mieux = { quoi: 'interet', offre: o.id, n: qui.size, at: null };
  }
  return mieux;
}
export function phraseGrace(ev, prenom) {
  if (ev.quoi === 'interet') return `${ev.n} étudiants ont mis ton offre de côté`;
  if (ev.quoi === 'entretien') return `Grâce à toi, ${prenom} a décroché un entretien`;
  return `Grâce à toi, ${prenom} a décroché ${DECROCHE[ev.type] || 'sa place'}`;
}
