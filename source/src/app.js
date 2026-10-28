// Point d'entrée : coque de l'application, connexion, accueil, notifications.
import { getLang, setLang, chargerAR } from './i18n.js';
import { html, render, useState, useEffect, useLayoutEffect, useMemo, useRef } from './vendor/preact-htm.js';
import { createStore, texteErreur } from './store.js';
import { Icon, Person, Avatar, Bar, CompanyLogo, Toaster, toast, Confirm, LevelChip, BrandLogo, SchoolScene, useLocal, Celebration, celebrate, voirRangs, roleTexte, Pastille, brancherPhotos, Modal, LigneAFaire, LigneNouvelle, brancherHistorique, historiqueBranche, aller, ensuite, rendrePosition, Feuille, ecranLibre } from './ui.js';
import { matchsDe, seasonOf, seasonLabel, niveauOf, NIVEAUX, OBJECTIFS, FOUND, statutOf, seasonStats, computeScores, starOfMonth, mentorState, requestsFor, pct, routedTo, needsRelance, myGroups, groupKey, enqueteDue, TYPES_EVENEMENT, conversations, offerMatch, demandesPour, demandeEnPause, typesDemande, rdvALaUne, profilLaureatFait, petitesTaches, tachePhoto, besoinsDeMoi, demandeLargeLe, etatAide, AIDE_OUVERTE, peutPostulerA, presetInscription, mercisPublics, porteApresRefus, pointsRecrutement, nouvelleDemandeApres, filiereCourte, demandesActives, DEMANDES_MAX, annoncePour } from './logic.js';
import { OffersPage, OfferCard, OfferDetail, OfferComposer, recoFor, matchesMe, APP_STATUS } from './offers.js';
import { estPortee, estPartagee, partageExpire } from './origine.js';
import { nouvellesVivant } from './reseau-vivant.js';
import { ParcoursPage, EspacePage, Journey, journeyStep, confirmerRecrutement, refuserRecrutement, versMerci } from './me.js';
import { ReseauPage, ProfileModal, ProfileForm, AskQuestion } from './community.js';
import { MentoratPage, AskHelp, NextRdv, slotWhen, mentoratIgnorees, IlsOntBesoin, CoupDeMain, HoraireSheet, ICONE_BESOIN, VERBE_BESOIN, phraseBesoin, ouvrirBesoin, confirmerPresence, finirMentorat, lienVisio } from './mentorat.js';
import { SuccessFeed, VerifyPage, MerciDuo } from './growth.js';
import { PrivacyPage, ConsentModal, MesDonnees, DesaboPage } from './privacy.js';
import { useInstall, IosInstallHelp, PrevenirHote, PastilleApp } from './pwa.js';
import { NextCafe } from './groupes.js';
import { EntrepriseModal } from './pro.js';
import { DefisPanel, DevenirParrain, TonAnnee, TonAnneeStrip } from './saison.js';
import { CvCard } from './cv.js';
import { PhotoCard, PhotoProposee } from './photo.js';
import { NudgeAvis } from './entreprises.js';
import { ConfianceHome } from './confiance.js';
import { NextEvent } from './agenda.js';
import { Entree, LangToggle, magasinEntree, cacherEntree, marquerMembre, brancherSignal, promoInvitee, roleRetenu, lienRetenu, oublierLien, suiteLien, accordIci, roleAccord, oublierInvitation } from './entree.js';
import { MessagesPage, useAlerteMessages } from './messages.js';
import { MatchPage, MatchAccueil, MatchVisible } from './match.js';
import { PoulsReseau, marquerArrivee, useArrivee, ArriveeSheet } from './pouls.js';
import { CaBouge, GraceAToi } from './vitrine.js';
import { ProposerAide } from './demandes.js';
import { useFondateurs, FondateursBandeau, useFondateurMoi } from './fondateurs.js';
import { useAmbassadeurs, pasAmbassadeur, notifsAmbassadeur, AmbassadeurAccueil } from './ambassadeurs.js';

// Écrans lourds et peu ouverts (Suivi, Admin, Enquête) : chargés à la demande, pas au démarrage.
// Le temps qu'ils arrivent, la forme d'une page ; s'ils ne peuvent pas arriver (réseau), un mot calme et « Réessayer ».
// Certains navigateurs ne redemandent jamais un module qui a échoué : au deuxième échec, « Réessayer » recharge la page
// dès que le fichier répond (les brouillons et la page ouverte sont gardés).
function aLaDemande(charger, nom, fichier) {
  let Ecran = null, enCours = null, rates = 0;
  const venir = () => (enCours ||= charger().then(m => { Ecran = m[nom]; }, e => { enCours = null; rates++; throw e; }));
  const reessayer = async setEtat => {
    if (rates >= 2) { try { if ((await fetch(fichier, { cache: 'no-store' })).ok) return location.reload(); } catch { /* toujours pas de réseau */ } }
    setEtat('attente');
  };
  function AlaDemande(props) {
    const [etat, setEtat] = useState(Ecran ? 'pret' : 'attente');
    useEffect(() => {
      if (Ecran) return;
      let fini = false;
      venir().then(() => { if (!fini) setEtat('pret'); }, () => { if (!fini) setEtat('echec'); });
      return () => { fini = true; };
    }, [etat === 'attente']);
    if (Ecran) return html`<${Ecran} ...${props}/>`;
    if (etat === 'echec') return html`<section class="page"><div class="panel ecran-echec" role="alert"><p>Cette page n’a pas pu se charger. Vérifie ton réseau, puis réessaie.</p><p><button type="button" class="btn" onClick=${() => reessayer(setEtat)}>Réessayer</button></p></div></section>`;
    return html`<${PageEnChargement}/>`;
  }
  return AlaDemande;
}
// La forme d'une page qui arrive : un titre et deux blocs, sans texte ni animation qui insiste. Sans réseau, on le dit calmement.
function PageEnChargement({ horsLigne = false }) {
  return html`<section class="page page-attente" aria-busy=${horsLigne ? null : 'true'}>
    ${horsLigne ? html`<p class="muted small" role="status">Pas de réseau pour l’instant : cette page s’affiche dès qu’il revient.</p>` : html`<span class="sr-only" role="status">Chargement…</span>`}
    <div class="sq sq-titre" aria-hidden="true"></div><div class="sq sq-bloc" aria-hidden="true"></div><div class="sq sq-bloc court" aria-hidden="true"></div></section>`;
}
const DashboardPage = aLaDemande(() => import('./dashboard.js'), 'DashboardPage', './dashboard.js');
const AdminPage = aLaDemande(() => import('./admin.js'), 'AdminPage', './admin.js');
const EnquetePage = aLaDemande(() => import('./enquete.js'), 'EnquetePage', './enquete.js');

// L'annonce de l'administration sur l'accueil : une ligne discrète, pour son seul public ; un appui la déplie ;
// chacun la masque pour lui (ici et non dans admin.js, chargé seulement pour l'administration)
function AnnonceBanner({ ctx }) {
  const { data, me } = ctx;
  const a = annoncePour(data.annonces, me);
  const [off, setOff] = useLocal('annonce-off-' + me.id, '');
  const [ouverte, setOuverte] = useState(false);
  if (!a || off === a.id) return null;
  const lien = a.lien && /^https:\/\//i.test(a.lien) ? a.lien : null;
  return html`<div class=${'annonce-ligne' + (ouverte ? ' ouverte' : '')} role="note">
    <${Icon} name="spark" size=${16}/>
    <button type="button" class="annonce-txt" aria-expanded=${ouverte} onClick=${() => setOuverte(!ouverte)}><span dir="auto" translate="no">${a.texte}</span></button>
    <button type="button" class="icon-btn small" aria-label="Masquer l’annonce" onClick=${() => setOff(a.id)}><${Icon} name="x" size=${15}/></button>
    ${ouverte && lien ? html`<a class="annonce-lien" href=${lien} target="_blank" rel="noopener">En savoir plus</a>` : null}
  </div>`;
}

// Le dernier bouton touché, pour que act le retrouve même sans focus (iPhone)
let dernierBouton = { b: null, t: 0 };
document.addEventListener('click', e => { dernierBouton = { b: e.target?.closest?.('button.btn') || null, t: Date.now() }; }, true);

const ROUTES = ['accueil', 'offres', 'match', 'mentorat', 'messages', 'parcours', 'espace', 'reseau', 'suivi', 'profil', 'admin', 'verifier', 'confidentialite', 'desabo', 'enquete', 'offre', 'aider'];
const ALIASES = { impact: 'espace', tableau: 'suivi', communaute: 'reseau', entraide: 'reseau/entraide', groupes: 'reseau/groupes', sujets: 'offres/sujets', 'reseau/mentorat': 'mentorat', 'reseau/mentorat/rdv': 'mentorat', agenda: 'reseau/agenda', entreprises: 'reseau/entreprises', etranger: 'reseau/etranger', relecture: 'mentorat/cv', cv: 'mentorat/cv', moderation: 'admin/moderation', message: 'messages', chat: 'messages' };

// Libellés courts de la barre du bas et du rail (petit ordinateur) ; en arabe, le libellé entier est déjà court
const COURT = { 'Mon parcours': 'Parcours', 'Mon espace': 'Espace', 'Mon année': 'Année' };
const court = l => (getLang() === 'ar' ? l : COURT[l] || l);

function navFor(me, avecMatch = me.role !== 'admin') {
  const items = [['accueil', 'Accueil', 'home'], ['offres', 'Offres', 'feed'], ['mentorat', 'Mentorat', 'mentor'], ['messages', 'Messages', 'chat']];
  // Match (match.js) : pour les étudiants et les lauréats, juste après les offres
  if (avecMatch) items.splice(2, 0, ['match', 'Match', 'match']);
  if (me.role === 'etudiant') items.push(['parcours', 'Mon parcours', 'route']);
  else if (me.role === 'laureat') items.push(['espace', 'Mon espace', 'star']);
  items.push(['reseau', 'Réseau', 'network'], ['suivi', me.role === 'etudiant' ? 'Mon année' : 'Suivi', 'chart']);
  if (me.role === 'admin') items.push(['admin', 'Admin', 'shield']);
  return items;
}

// Filet de sécurité : si un bouton ou un formulaire plante juste après un geste du membre, on le lui dit
// au lieu de ne rien faire (il croirait que c'est enregistré). Les erreurs de fond (réseau, extensions) restent discrètes.
if (typeof window !== 'undefined') {
  let geste = 0, dit = 0;
  for (const ev of ['pointerdown', 'keydown', 'submit']) window.addEventListener(ev, () => { geste = Date.now(); }, true);
  const prevenir = () => {
    if (Date.now() - geste > 3000 || Date.now() - dit < 4000) return;
    dit = Date.now(); toast('Ça n’a pas marché. Réessaie, ou recharge la page.', 'err');
  };
  window.addEventListener('error', e => { if (e.error && !/ResizeObserver/.test(e.message || '')) prevenir(); });
  window.addEventListener('unhandledrejection', prevenir);
}

const dec = x => { try { return decodeURIComponent(x || ''); } catch { return x || ''; } };
function parseRoute(r) {
  const [base, sub, sub2] = (ALIASES[dec(r)] || r).split('/').map(dec);
  return ROUTES.includes(base) ? { base, sub: sub || '', sub2: sub2 || '' } : { base: 'accueil', sub: '', sub2: '' };
}
const readRoute = () => parseRoute((location.hash || '').slice(1));

function App({ store }) {
  const [, setTick] = useState(0);
  const [route, setRoute] = useState(readRoute);
  const [profile, setProfile] = useState(null);
  const [offerId, setOfferId] = useState(null);
  const [applyNow, setApplyNow] = useState(false);
  const [askMentor, setAskMentor] = useState(null);
  const [confirmBox, setConfirmBox] = useState(null);
  const [pop, setPop] = useState(null); // le menu du compte ('me')
  const [cloche, setCloche] = useState(false);
  // « Je peux aider » et « Choisir un horaire » s'ouvrent sur place : { demande: id } ou { mentorat: id }
  const [aide, setAide] = useState(null);
  // « Publier une offre » ouvert depuis la barre latérale (ordinateur), sur place : null ou les champs déjà remplis
  const [publierOffre, setPublierOffre] = useState(null);
  const seen = useRef(null); const lastAct = useRef(0);
  useEffect(() => store.on(() => setTick(t => t + 1)), []);
  // Pages publiques (attestation, désabonnement) : le lien « #… » suffit. Dans la coque, l'historique s'en charge (ui.js).
  useEffect(() => { const f = () => { if (!historiqueBranche()) setRoute(readRoute()); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => { if (!pop) return; const f = e => { if (!e.target.closest('.pop-wrap')) setPop(null); }; document.addEventListener('click', f); return () => document.removeEventListener('click', f); }, [pop]);
  // Changement d'écran. En avançant : un fondu court (View Transitions) là où le navigateur le permet.
  // Au Retour : pas de fondu (l'iPhone anime déjà son geste), et la page reprend sa place (y).
  const routeAct = useRef(route); routeAct.current = route;
  const aRendre = useRef(null);
  const versRoute = (r, { y = 0, doux = false } = {}) => {
    const changer = () => { setRoute(parseRoute(r)); setPop(null); setCloche(false); aRendre.current = y; };
    if (doux && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches && parseRoute(r).base !== routeAct.current.base) document.startViewTransition(() => new Promise(ok => { changer(); setTimeout(ok, 0); }));
    else changer();
  };
  const versRouteAct = useRef(versRoute); versRouteAct.current = versRoute;
  useLayoutEffect(() => { const y = aRendre.current; if (y == null) return; aRendre.current = null; rendrePosition(y); });
  // go(r) : un écran de plus. go(r, { remplacer: true }) : onglet d'une page, « ← Tous les … ».
  // go(r, { onglet: true }) : la barre du bas ou de côté. go(r, { exact: true }) : un lien direct normalisé, une redirection.
  const go = (r, o) => { if (!aller(r, o)) { try { history.replaceState(null, '', '#' + r); } catch { /* cadre */ } versRoute(r); } };
  // La coque de l'appli (pas les pages publiques ni la connexion) branche l'historique, une fois
  const coque = !['verifier', 'desabo'].includes(route.base) && !(route.base === 'confidentialite' && store.mode !== 'live') && (store.mode !== 'live' || (store.session && store.me));
  useEffect(() => { if (!coque) return; const brut = (location.hash || '').slice(1); brancherHistorique(parseRoute(brut).base === 'accueil' ? 'accueil' : brut, (r, o) => versRouteAct.current(r, o)); }, [coque]);
  // Les blocs arrivent en cascade au premier affichage seulement
  const [premier, setPremier] = useState(true);
  // Au premier changement d'écran seulement : un minuteur rejouait le fondu sur tout l'écran déjà affiché (et une feuille ouverte pâlissait)
  const ecranVu = useRef(null);
  useEffect(() => { const k = route.base + '/' + route.sub; if (ecranVu.current === null) ecranVu.current = k; else if (ecranVu.current !== k) setPremier(false); }, [route.base, route.sub]);
  const [entreprise, setEntreprise] = useState(null);
  const [askQ, setAskQ] = useState(null);
  const [annee, setAnnee] = useState(null);
  const [iosHelp, setIosHelp] = useState(false);
  const install = useInstall();
  // Le lien partagé gardé pendant l'inscription : ouvert dès que l'application s'affiche, puis oublié
  useEffect(() => { if (!coque) return; const l = lienRetenu(); oublierLien(); if (l && l.r !== (location.hash || '').slice(1)) go(l.r, { exact: true }); }, [coque]);
  // Un membre avec son profil : une invitation de promo gardée ici ne sert plus (après une déconnexion, « Se connecter » d'abord).
  // La démo n'a pas d'inscription : rien à oublier
  useEffect(() => { if (coque && store.mode === 'live') oublierInvitation(); }, [coque]);
  // Lien direct vers une offre (WhatsApp, alertes par email, notifications) : sans compte, l'adresse garde #offre/<id>
  useEffect(() => { if (coque && route.base === 'offre' && route.sub) { setOfferId(route.sub); setApplyNow(false); go('offres', { exact: true }); } }, [route.base, route.sub, coque]);
  // Lien direct « Je peux aider » (notification sur le téléphone, email) : #aider/<id> ouvre la feuille devant la demande
  useEffect(() => { if (route.base === 'aider' && route.sub && store.me) { setAide({ demande: route.sub }); go('offres/demandes/' + route.sub, { exact: true }); } }, [route.base, route.sub, !!store.me]);
  // Lien direct « Proposer d'autres horaires » (notification d'un rendez-vous annulé) : #mentorat/reprendre/<id>
  useEffect(() => {
    if (route.base !== 'mentorat' || route.sub !== 'reprendre' || !store.me) return;
    const m = store.byId('mentorships', route.sub2);
    if (m && m.student_id === store.me.id && m.status === 'annulee') setAskMentor({ p: store.byId('profiles', m.mentor_id) || null, besoin: m.besoin || '', sujet: m.sujet || '' });
    go('mentorat', { exact: true });
  }, [route.base, route.sub, route.sub2, !!store.me]);

  const data = store.data;
  const me = store.me;
  const saison = seasonOf();
  const scores = useMemo(() => computeScores(data), [data.offers, data.applications, data.comments, data.placements, data.mentorships, data.answers, data.questions, data.votes]);
  const monthScores = useMemo(() => computeScores(data, new Date(Date.now() - 30 * 864e5)), [data]);
  const star = useMemo(() => starOfMonth(data, monthScores), [data, monthScores]);
  // Membres fondateurs : les 25 premiers lauréats à aider les étudiants (fondateurs.js)
  const fondateurs = useFondateurs(store, data);
  // Ambassadeurs de promo : la proposition à l'ouverture, et ceux qui ont accepté (ambassadeurs.js)
  const ambassadeurs = useAmbassadeurs(store, data);

  // Temps réel : une nouvelle notification venue d'un autre membre s'affiche aussi en bas de l'écran
  const latest = useRef(null);
  useEffect(() => {
    const cur = latest.current; latest.current = null;
    if (!cur) return;
    const { notifs, todo, me: who } = cur;
    const keys = new Set(notifs.map(n => n.key).filter(Boolean));
    const prev = seen.current;
    // Au passage des données gardées sur l'appareil aux données fraîches, rien n'est « nouveau » : l'accueil se met à jour sans bruit
    if (prev && prev.id === who.id && !prev.cache && Date.now() - lastAct.current > 2500) {
      const fresh = notifs.find(n => n.key && !prev.keys.has(n.key) && !n.sansToast && (n.action || n.tone === 'good'));
      if (fresh) toast(fresh.text, 'ok', fresh.pts || 0);
    }
    seen.current = { id: who.id, keys, cache: !!store.depuisCache };
    const n = todo + (cur.msgs || 0);
    try { document.title = (n ? `(${n}) ` : '') + 'Réseau ENSAM Meknès'; } catch { /* */ }
  });

  // Un message reçu pendant qu'on est ailleurs : un petit mot en bas de l'écran
  useAlerteMessages(store, me, route);

  const relang = () => setTick(t => t + 1);
  // Pages publiques, sans compte : vérification d'une attestation, désabonnement des emails, confidentialité
  if (route.base === 'verifier') return html`<main class="auth verify-wrap"><div class="auth-lang"><${LangToggle} onChange=${relang}/></div><${VerifyPage} store=${store} id=${route.sub}/></main>`;
  if (route.base === 'desabo') return html`<main class="auth verify-wrap"><div class="auth-lang"><${LangToggle} onChange=${relang}/></div><${DesaboPage} store=${store} token=${route.sub} quoi=${route.sub2}/></main>`;
  if (route.base === 'confidentialite' && (store.mode !== 'live' || !store.session || !me)) return html`<main class="auth verify-wrap privacy-wrap"><div class="auth-lang"><${LangToggle} onChange=${relang}/></div><${PrivacyPage} onBack=${() => go('accueil')}/></main>`;
  // Pas de session : la page d'entrée, déjà à l'écran avant l'application, est reprise telle quelle
  if (store.mode === 'live' && !store.session) return html`<${Entree} store=${store}/>`;
  if (store.mode === 'live' && !me) return html`<${Onboarding} store=${store} relang=${relang}/>`;

  // Le bouton qui lance l'action attend sa fin (grisé, petit cercle) : pas de double envoi sur une connexion lente.
  // Sur iPhone, un bouton touché ne prend pas le focus : on se sert alors du dernier bouton touché.
  const act = async fn => {
    lastAct.current = Date.now();
    const b = document.activeElement?.closest?.('button.btn') || (Date.now() - dernierBouton.t < 800 ? dernierBouton.b : null);
    if (b?.getAttribute('aria-busy') === 'true') return;
    b?.setAttribute('aria-busy', 'true');
    try { await fn(); } catch (e) { toast(texteErreur(e), 'err'); } finally { b?.removeAttribute('aria-busy'); }
    lastAct.current = Date.now();
  };
  voirRangs(me.role !== 'etudiant');
  // L'administration regarde l'application comme un lauréat (son rôle le temps de cette vue), puis revient d'un appui.
  // Toutes les données sont relues avec les droits du nouveau rôle, puis l'accueil de ce rôle.
  const changerVue = role => act(async () => {
    setPop(null);
    await store.changerVue(role);
    go('accueil', { exact: true });
    toast(role === 'admin' ? 'Te revoilà en admin.' : 'Tu vois l’application comme un lauréat.');
  });
  const ctx = {
    store, data, me, saison, scores, go, act, sub: route.sub, sub2: route.sub2, star, starId: star?.p.id, fondateurs, ambassadeurs,
    openProfile: p => p && setProfile(p),
    openOffer: (id, apply = false) => { setOfferId(id); setApplyNow(apply); setPop(null); },
    confirm: (text, onYes, yes, { non, cls } = {}) => setConfirmBox({ text, onYes, yes, non, cls }),
    openEntreprise: name => name && setEntreprise(name),
    askQuestion: initial => setAskQ(initial || {}),
    askHelp: (p = null, besoin = '', sujet = '') => setAskMentor({ p, besoin, sujet }),
    // Un rendez-vous annulé : proposer d'autres horaires au même lauréat, avec le même besoin et le même sujet
    redemander: id => { const m = store.byId('mentorships', id); if (!m) return go('mentorat'); setAskMentor({ p: store.byId('profiles', m.mentor_id) || null, besoin: m.besoin || '', sujet: m.sujet || '' }); },
    openAnnee: s => setAnnee(s || saison),
    ouvrirCloche: () => { setPop(null); setCloche(true); },
    ecrire: id => { setProfile(null); setOfferId(null); setPop(null); go('messages/' + id); },
    // Un geste, sans changer d'écran ; si la demande n'attend plus d'aide, sa carte dit pourquoi
    proposerAide: id => { setPop(null); setCloche(false); AIDE_OUVERTE.includes(etatAide(data, me, (data.demandes || []).find(d => d.id === id))) ? setAide({ demande: id }) : go('offres/demandes/' + id); },
    choisirHoraire: id => {
      setPop(null); setCloche(false);
      const m = data.mentorships.find(x => x.id === id);
      m && m.status === 'demande' && m.student_id !== me.id && (!m.mentor_id || m.mentor_id === me.id) ? setAide({ mentorat: id }) : go('mentorat');
    },
  };
  const notifs = buildNotifs(ctx);
  // La cloche ne compte que ce qui attend un geste du membre (et disparaît une fois fait)
  const todo = notifs.filter(n => n.geste).length;
  ctx.todo = todo;
  const msgs = store.nonLus();
  latest.current = { notifs, todo, me, msgs };
  // Match : ni pour l'administration, ni en ligne tant que la base n'a pas ses tables (mise-a-jour.sql)
  const avecMatch = me.role !== 'admin' && store.peutMatch();
  const nav = navFor(me, avecMatch);
  // En bas sur le téléphone : cinq onglets au plus, Match au centre. Les messages ont leur bulle en haut ; le suivi,
  // Mon parcours et Mon espace passent dans le menu du compte (l'ordinateur garde tout dans la barre latérale).
  const navBas = nav.filter(([k]) => k !== 'messages' && k !== 'suivi' && !(avecMatch && (k === 'parcours' || k === 'espace')));
  let page = route.base === 'offre' || route.base === 'aider' ? 'offres' : route.base;
  if (page === 'parcours' && me.role !== 'etudiant') page = me.role === 'laureat' ? 'espace' : 'accueil';
  if (page === 'espace' && me.role !== 'laureat') page = me.role === 'etudiant' ? 'parcours' : 'accueil';
  if (page === 'admin' && me.role !== 'admin') page = 'accueil';
  if (page === 'match' && !avecMatch) page = 'accueil';
  // Ouverture depuis les données gardées sur l'appareil, mise à jour pas encore arrivée : les écrans qui ont besoin de ce
  // qui n'y est pas gardé (conversations entières, messages des groupes, commentaires de relecture, modération) l'attendent
  const attente = !!store.enAttente && (page === 'messages' || page === 'admin' || (page === 'reseau' && route.sub === 'groupes') || (page === 'mentorat' && route.sub === 'cv'));
  // L'accord (loi 09-08) pas encore donné : la fenêtre de l'accord, sauf sur Confidentialité et Mon profil ;
  // les feuilles de notifications attendent, quelle que soit la page
  const sansAccord = store.mode === 'live' && !me.consent_at;
  const needConsent = sansAccord && !['confidentialite', 'profil'].includes(page);
  const openNotif = n => {
    setPop(null); setCloche(false);
    if (n.redemander) return ctx.redemander(n.redemander);
    if (n.conseil) { go('mentorat'); return ctx.askHelp(); }
    if (n.aider) return ctx.proposerAide(n.aider);
    if (n.horaire) return ctx.choisirHoraire(n.horaire);
    if (n.offer) ctx.openOffer(n.offer); else if (n.profile) { const p = store.byId('profiles', n.profile); if (p) setProfile(p); else go(n.to || 'accueil'); } else go(n.to);
  };
  ctx.notifs = notifs; ctx.openNotif = openNotif;
  // Une chose à faire = une pastille, sur l'onglet où elle se fait (les fiches et le perso : Mon parcours, Mon espace)
  const perso = me.role === 'etudiant' ? 'parcours' : me.role === 'laureat' ? 'espace' : 'accueil';
  const ongletDe = n => { const b = (n.to || '').split('/')[0]; return n.offer || n.profile || !b || b === 'parcours' || b === 'espace' ? perso : b; };
  const ouAFaire = new Set(notifs.filter(n => n.geste).map(ongletDe));
  // Match : un match fait par l'autre et pas encore vu
  const matchNeuf = avecMatch && matchsDe(data, me).some(x => x.nouveau);
  const dotFor = k => ouAFaire.has(k) || (k === 'match' && matchNeuf);
  const neuf = x => (x > 9 ? '9+' : x);
  const plein = page === 'messages';
  // En haut de la barre latérale (ordinateur) : le formulaire de publication du rôle. Un étudiant qui ne peut pas
  // (avant la 3e année, ou déjà 2 demandes en cours) n'a pas de bouton ; l'admin publie un événement de l'agenda.
  // Sur l'onglet « Entre lauréats », l'offre est d'emblée pour les lauréats. Le même bouton dans la page se cache alors (page.html).
  const publier = me.role === 'laureat' ? { cle: 'offre', label: 'Publier une offre', icon: 'plus', faire: () => setPublierOffre(page === 'offres' && route.sub === 'laureats' ? { audience: 'laureats', type: 'emploi', annees: [] } : {}) }
    : me.role === 'etudiant' ? (typesDemande(me, saison).length && demandesActives(data, me.id).length < DEMANDES_MAX ? { cle: 'demande', label: 'Publier ma demande', icon: 'send', faire: () => go('offres/demandes/nouvelle') } : null)
    : me.role === 'admin' ? { cle: 'evenement', label: 'Publier un événement', icon: 'calendar', faire: () => go('reseau/agenda/nouveau') } : null;

  return html`<div class=${'shell' + (premier ? ' premier' : '')} data-publier=${publier?.cle || null}>
    <a class="skip" href="#contenu" onClick=${e => { e.preventDefault(); document.getElementById('contenu')?.focus(); }}>Aller au contenu</a>
    <aside class="side">
      <div class="side-in">
        <a class="brand" href="#accueil" onClick=${e => { e.preventDefault(); go('accueil'); }}><${BrandLogo} size=${40}/><span class="brand-txt"><strong>Réseau ENSAM</strong><span>Meknès · Lauréats & étudiants</span></span></a>
        ${publier ? html`<button type="button" class="btn primary side-pub" onClick=${() => { setPop(null); setCloche(false); publier.faire(); }}><${Icon} name=${publier.icon} size=${20}/><span class="side-lib">${publier.label}</span><span class="side-court" aria-hidden="true">Publier</span></button>` : null}
        <nav class="side-nav">${nav.map(([k, l, i]) => html`<a href=${'#' + k} class=${page === k ? 'on' : ''} aria-current=${page === k ? 'page' : null} onClick=${e => { e.preventDefault(); go(k, { onglet: true }); }}><span class="nav-ico"><${Icon} name=${i} size=${20}/></span><span class="side-lib">${l}</span><span class="side-court" aria-hidden="true">${court(l)}</span>${k === 'messages' && msgs ? html`<span class="nav-n"><span aria-hidden="true">${neuf(msgs)}</span><span class="sr-only">${msgs > 1 ? `${msgs} messages non lus` : '1 message non lu'}</span></span>` : dotFor(k) ? html`<span class="dotn" aria-hidden="true"></span><span class="sr-only">À faire ici</span>` : null}</a>`)}</nav>
        <div class="side-foot"><span class="small muted">Année ${seasonLabel(saison)}</span><a class="small muted" href="#confidentialite" onClick=${e => { e.preventDefault(); go('confidentialite'); }}>Confidentialité</a></div>
      </div>
    </aside>
    <div class=${'main' + (plein ? ' full' : '')}>
      <header class="top">
        <a class="brand mobile-only" href="#accueil" aria-label="Réseau ENSAM · Accueil" onClick=${e => { e.preventDefault(); go('accueil'); }}><${BrandLogo} size=${34}/><strong>Réseau ENSAM</strong></a>
        <span class="spacer"></span>
        ${store.mode === 'demo' ? html`<${PersonaSwitch} store=${store} go=${go}/>` : null}
        <${ThemeToggle} onChange=${relang}/>
        <a class=${'icon-btn chat-top mobile-only' + (page === 'messages' ? ' on' : '')} aria-current=${page === 'messages' ? 'page' : null} href="#messages" aria-label=${msgs ? `Messages (${msgs} non lus)` : 'Messages'} onClick=${e => { e.preventDefault(); go('messages', { onglet: true }); }}><${Icon} name="chat"/>${msgs ? html`<span class="badge-n" aria-hidden="true">${neuf(msgs)}</span>` : null}</a>
        <${LangToggle} onChange=${relang} store=${store} me=${me}/>
        <button class="icon-btn cloche-btn" aria-label=${todo ? `Notifications (${todo} à faire)` : 'Notifications'} aria-haspopup="dialog" onClick=${() => { setPop(null); setCloche(true); }}><${Icon} name="bell"/>${todo ? html`<span class="badge-n" aria-hidden="true">${neuf(todo)}</span>` : null}</button>
        <div class="pop-wrap"><button class="me-btn" onClick=${() => setPop(pop === 'me' ? null : 'me')} aria-label="Mon compte" aria-expanded=${pop === 'me'}><${Avatar} p=${me} size=${34}/>${avecMatch && dotFor(perso) ? html`<span class="dotn mobile-only" aria-hidden="true"></span>` : null}</button>
          ${pop === 'me' ? html`<div class="menu-pop right" role="group" aria-label="Mon compte">
            <div class="menu-who"><strong>${me.full_name}</strong><span class="muted small">${roleTexte(me)}</span></div>
            ${me.admin_ok ? html`<div class="vue-switch" role="group" aria-label="Voir l’application comme">${[['admin', 'Admin', 'shield'], ['laureat', 'Lauréat', 'star']].map(([r, l, i]) =>
              html`<button type="button" key=${r} class=${me.role === r ? 'on' : ''} aria-pressed=${me.role === r} onClick=${() => me.role !== r && changerVue(r)}><${Icon} name=${i} size=${15}/> ${l}</button>`)}</div>` : null}
            <button onClick=${() => go('profil')}><${Icon} name="user" size=${16}/> Mon profil</button>
            ${avecMatch ? html`<button class="menu-mobile" onClick=${() => go(perso)}><${Icon} name=${me.role === 'etudiant' ? 'route' : 'star'} size=${16}/> ${me.role === 'etudiant' ? 'Mon parcours' : 'Mon espace'}${dotFor(perso) ? html`<span class="dotn" aria-hidden="true"></span><span class="sr-only">À faire ici</span>` : null}</button>` : null}
            <button class="menu-mobile" onClick=${() => go('suivi')}><${Icon} name="chart" size=${16}/> ${me.role === 'etudiant' ? 'Mon année' : 'Suivi'}</button>
            ${me.role !== 'admin' ? html`<button onClick=${() => go('accueil/etapes')}><${Icon} name="route" size=${16}/> Comment ça marche ?</button>` : null}
            ${me.role !== 'admin' ? html`<button onClick=${() => { setPop(null); ctx.openAnnee(); }}><${Icon} name="award" size=${16}/> Ton année dans le réseau</button>` : null}
            ${install ? html`<button onClick=${() => { setPop(null); install.prompt ? install.prompt() : setIosHelp(install.android ? 'android' : 'ios'); }}><${Icon} name="download" size=${16}/> Installer l’application</button>` : null}
            <button onClick=${() => go('confidentialite')}><${Icon} name="shield" size=${16}/> Confidentialité</button>
            <button class="menu-theme" onClick=${() => { setTheme(themeActuel() === 'dark' ? 'light' : 'dark'); setPop(null); relang(); }}><${Icon} name=${themeActuel() === 'dark' ? 'sun' : 'moon'} size=${16}/> ${themeActuel() === 'dark' ? 'Mode clair' : 'Mode sombre'}</button>
            ${themeChoisi() ? html`<button onClick=${() => { setTheme(null); setPop(null); relang(); }}><${Icon} name="sun" size=${16}/> Thème automatique (comme l’appareil)</button>` : null}
            ${me.role === 'admin' ? html`<button onClick=${() => go('admin')}><${Icon} name="shield" size=${16}/> Administration</button>` : null}
            ${store.mode === 'live' ? html`<button onClick=${() => store.signOut()}><${Icon} name="logout" size=${16}/> Se déconnecter</button>` : html`<button onClick=${async () => { setPop(null); await store.reset(); toast('Démo réinitialisée.'); }}><${Icon} name="spark" size=${16}/> Réinitialiser la démo</button>`}
          </div>` : null}
        </div>
      </header>
      ${store.mode === 'demo' && !plein ? html`<section class="demo-band" aria-label="Démo"><${Icon} name="spark" size=${15}/><span>Démo avec des données fictives. Essaie le mentorat : <b translate="no">Salma</b> demande de l’aide, <b translate="no">Youssef</b> (lauréat) clique sur un horaire, la visio est prête. Change de rôle en haut.</span></section>` : null}
      ${me.admin_ok && me.role !== 'admin' && !plein ? html`<section class="vue-band" aria-label="Vue lauréat"><${Icon} name="star" size=${15}/><span>Tu vois l’application comme un lauréat.</span><button type="button" class="btn tiny" onClick=${() => changerVue('admin')}><${Icon} name="shield" size=${14}/> Revenir en admin</button></section>` : null}
      <main class=${'content' + (plein ? ' flush' : '')} id="contenu" tabindex="-1">
        ${page === 'accueil' ? html`<${Home} key=${me.id + me.role} ...${ctx}/>` : null}
        ${page === 'offres' ? html`<${OffersPage} ...${ctx}/>` : null}
        ${page === 'match' ? html`<${MatchPage} ...${ctx}/>` : null}
        ${attente ? html`<${PageEnChargement} horsLigne=${store.horsLigne}/>` : null}
        ${page === 'mentorat' && !attente ? html`<${MentoratPage} ...${ctx}/>` : null}
        ${page === 'messages' && !attente ? html`<${MessagesPage} ...${ctx}/>` : null}
        ${page === 'parcours' ? html`<${ParcoursPage} ...${ctx}/>` : null}
        ${page === 'espace' ? html`<${EspacePage} ...${ctx}/>` : null}
        ${page === 'reseau' && !attente ? html`<${ReseauPage} ...${ctx}/>` : null}
        ${page === 'suivi' ? html`<${DashboardPage} ...${ctx}/>` : null}
        ${page === 'admin' && !attente ? html`<${AdminPage} ...${ctx}/>` : null}
        ${page === 'profil' ? html`<${MyProfile} ctx=${ctx}/>` : null}
        ${page === 'confidentialite' ? html`<${PrivacyPage}/>` : null}
        ${page === 'enquete' ? html`<${EnquetePage} ...${ctx}/>` : null}
      </main>
    </div>
    <nav class=${'bottom-nav' + (plein && route.sub ? ' cache' : '')}>${navBas.map(([k, l, i]) => html`<a href=${'#' + k} class=${(page === k ? 'on' : '') + (k === 'match' ? ' bn-match' : '')} aria-current=${page === k ? 'page' : null} onClick=${e => { e.preventDefault(); go(k, { onglet: true }); }}><span class="bn-ico"><${Icon} name=${i}/>${dotFor(k) ? html`<span class="dotn" aria-hidden="true"></span>` : null}</span><span>${court(l)}</span>${dotFor(k) ? html`<span class="sr-only">À faire ici</span>` : null}</a>`)}</nav>
    ${cloche ? html`<${Cloche} notifs=${notifs} onGo=${openNotif} onClose=${() => setCloche(false)}/>` : null}
    ${publierOffre ? html`<${OfferComposer} ctx=${ctx} preset=${publierOffre} onClose=${() => setPublierOffre(null)}/>` : null}
    ${offerId ? html`<${OfferDetail} ctx=${ctx} id=${offerId} key=${offerId} apply=${applyNow} onClose=${() => setOfferId(null)}/>` : null}
    ${aide?.demande ? html`<${ProposerAide} ctx=${ctx} id=${aide.demande} key=${'aide-' + aide.demande} onClose=${() => setAide(null)}/>` : null}
    ${aide?.mentorat ? html`<${HoraireSheet} ctx=${ctx} id=${aide.mentorat} key=${'horaire-' + aide.mentorat} onClose=${() => setAide(null)}/>` : null}
    ${profile ? html`<${ProfileModal} ctx=${ctx} p=${profile} onClose=${() => setProfile(null)} onAskMentor=${p => { setProfile(null); setAskMentor({ p }); }}/>` : null}
    ${askMentor ? html`<${AskHelp} ctx=${ctx} mentor=${askMentor.p} besoin=${askMentor.besoin} sujet=${askMentor.sujet} onClose=${() => setAskMentor(null)}/>` : null}
    ${confirmBox ? html`<${Confirm} text=${confirmBox.text} onYes=${confirmBox.onYes} onClose=${() => setConfirmBox(null)} yes=${confirmBox.yes || 'Supprimer'} non=${confirmBox.non || 'Annuler'} cls=${confirmBox.cls || 'btn danger'}/>` : null}
    ${entreprise ? html`<${EntrepriseModal} ctx=${ctx} name=${entreprise} key=${entreprise} onClose=${() => setEntreprise(null)}/>` : null}
    ${askQ ? html`<${AskQuestion} ctx=${ctx} initial=${askQ} onClose=${() => setAskQ(null)} onDone=${id => { setAskQ(null); go('reseau/entraide/' + id); }}/>` : null}
    ${annee ? html`<${TonAnnee} ctx=${ctx} saison=${annee} onClose=${() => setAnnee(null)}/>` : null}
    ${iosHelp ? html`<${IosInstallHelp} android=${iosHelp === 'android'} onClose=${() => setIosHelp(false)}/>` : null}
    <${PastilleApp} ctx=${ctx} cache=${plein}/>
    ${needConsent ? html`<${ConsentModal} ctx=${ctx}/>` : null}
    ${pop ? html`<${Feuille} key=${pop} onClose=${() => setPop(null)}/>` : null}
    <${Toaster}/>
    <${Celebration}/>
    ${me.role === 'admin' ? null : html`<${PrevenirHote} ctx=${ctx} bloque=${sansAccord}/>`}
  </div>`;
}

// Thème clair ou sombre : suit l'appareil, sauf si le membre a choisi (gardé dans ce navigateur)
const THEME_KEY = 'ensam-theme';
const themeChoisi = () => { try { const t = localStorage.getItem(THEME_KEY); return t === 'light' || t === 'dark' ? t : null; } catch { return null; } };
const themeActuel = () => themeChoisi() || (matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function setTheme(t) {
  try { if (t) localStorage.setItem(THEME_KEY, t); else localStorage.removeItem(THEME_KEY); } catch { /* stockage indisponible */ }
  const root = document.documentElement;
  if (t) root.dataset.theme = t; else delete root.dataset.theme;
  const sombre = themeActuel() === 'dark';
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.content = t ? (sombre ? '#0B1320' : '#1670A8') : (m.media.includes('dark') ? '#0B1320' : '#1670A8'); });
}
function ThemeToggle({ onChange }) {
  const sombre = themeActuel() === 'dark';
  return html`<button class="icon-btn theme-btn" onClick=${() => { setTheme(sombre ? 'light' : 'dark'); onChange?.(); }} aria-label=${sombre ? 'Passer en mode clair' : 'Passer en mode sombre'} title=${sombre ? 'Mode clair' : 'Mode sombre'}><${Icon} name=${sombre ? 'sun' : 'moon'}/></button>`;
}


function PersonaSwitch({ store, go }) {
  const ps = store.personas();
  return html`<label class="persona"><span class="small muted">Voir en tant que</span>
    <select id="persona" aria-label="Voir en tant que" value=${store.me?.id} onChange=${e => { store.switchTo(e.target.value); go('accueil'); }}>${ps.map(p => html`<option value=${p.id}>${p._persona}</option>`)}</select></label>`;
}

// ---------------------------------------------------------------------------
// La cloche : une feuille (en bas sur téléphone, sous la cloche sur ordinateur), deux groupes.
// « À faire » : ce qui attend un geste du membre, chacun avec son bouton ; c'est le seul chiffre de la cloche.
// « Nouvelles » : les rappels d'abord, puis du plus récent au plus ancien (10 au plus). Rien n'y est compté, donc pas de « non lu ».
// ---------------------------------------------------------------------------
function Cloche({ notifs, onGo, onClose }) {
  const faire = notifs.filter(n => n.geste);
  const nouvelles = notifs.filter(n => !n.geste && !n.semaine).sort((a, b) => (b.rappel ? 1 : 0) - (a.rappel ? 1 : 0) || new Date(b.at) - new Date(a.at)).slice(0, 10);
  return html`<${Modal} title="Notifications" cls="cloche" onClose=${onClose}>
    ${!faire.length && !nouvelles.length ? html`<p class="cl-vide"><${Icon} name="check" size=${20}/><span><strong>Tout est à jour.</strong><span class="small muted">Ce qui te concerne arrivera ici.</span></span></p>` : html`
    <section class="cl-groupe" aria-labelledby="cl-faire">
      <h3 class="cl-titre" id="cl-faire">À faire${faire.length ? html` <span class="count">${faire.length}</span>` : null}</h3>
      ${faire.length ? html`<ul class="af-liste">${faire.map(n => html`<${LigneAFaire} key=${n.key} n=${n} onGo=${onGo}/>`)}</ul>`
        : html`<p class="cl-vide small"><${Icon} name="check" size=${16}/> Rien à faire pour l’instant.</p>`}
    </section>
    <section class="cl-groupe" aria-labelledby="cl-nouv">
      <h3 class="cl-titre" id="cl-nouv">Nouvelles</h3>
      ${nouvelles.length ? html`<ul class="nv-liste">${nouvelles.map(n => html`<${LigneNouvelle} key=${n.key || n.text} n=${n} onGo=${onGo}/>`)}</ul>`
        : html`<p class="cl-vide small muted">Rien de nouveau pour l’instant.</p>`}
    </section>`}
  <//>`;
}

// ---------------------------------------------------------------------------
// Notifications calculées à partir des données.
// geste : le verbe du bouton d'une chose qui attend le membre ; la cloche ne compte qu'elles, et elles disparaissent une fois faites.
// action : ce que l'accueil peut proposer de faire ; rappel : un rendez-vous ou un événement proche ;
// besoin : une demande faite aux lauréats (« Ils ont besoin de toi ») ; ref : l'élément concerné, pour ne le dire qu'une fois.
// ---------------------------------------------------------------------------
const recent = (iso, days) => Date.now() - new Date(iso) < days * 864e5;

function buildNotifs({ data, me, store, saison }) {
  const out = [];
  const name = id => store.byId('profiles', id)?.full_name || 'Un membre';
  const first = id => name(id).split(' ')[0];
  // Ce qui se confirme ou se remercie sur place : Mon parcours (étudiant) ou Mon espace (lauréat recruté)
  const perso = me.role === 'etudiant' ? 'parcours' : 'espace';
  // Étudiant : recrutement à confirmer, évolution des candidatures, nouvelles offres
  for (const p of data.placements) {
    if (p.student_id !== me.id) continue;
    if (p.status === 'en_attente') out.push({ key: 'pa' + p.id, ref: p.id, action: true, geste: 'Confirmer', tone: 'accent', icon: 'briefcase', to: perso, at: p.created_at, text: p.demande_id ? `${name(p.laureat_id)} indique que tu as commencé chez ${p.entreprise}. Confirme-le.` : `${name(p.laureat_id)} déclare ton recrutement chez ${p.entreprise}. Confirme-le.` });
    if (p.status === 'confirme' && p.laureat_id && !p.merci) out.push({ key: 'pm' + p.id, ref: p.id, action: true, geste: 'Dire merci', tone: 'brass', icon: 'heart', to: perso, at: p.confirmed_at || p.created_at, text: `Ta réussite chez ${p.entreprise} est confirmée. Laisse un merci à ${first(p.laureat_id)}.` });
  }
  for (const a of data.applications) if (a.student_id === me.id && a.offer_id && a.status !== 'postule' && recent(a.updated_at || a.created_at, 21)) {
    // Pas retenue : la ligne ouvre une porte vraie (le vrai nombre d'autres offres, sinon sa demande ou un conseil), pas l'offre refusée
    if (a.status === 'refuse') {
      const porte = porteApresRefus(data, me, saison);
      out.push({ key: 'as' + a.id + a.status, icon: porte.icon, to: porte.to, conseil: porte.conseil, at: a.updated_at || a.created_at, text: `Ta candidature « ${a.titre} » : pas retenue cette fois. ${porte.phrase}` });
    } else out.push({ key: 'as' + a.id + a.status, icon: a.status === 'entretien' ? 'people' : 'check', tone: 'good', offer: a.offer_id, at: a.updated_at || a.created_at, text: `Ta candidature « ${a.titre} » : ${APP_STATUS[a.status]}.` });
  }
  if (me.role === 'etudiant') {
    for (const o of data.offers) if (o.status === 'ouverte' && matchesMe(o, me, saison) && recent(o.created_at, 7)) out.push({ icon: 'feed', offer: o.id, at: o.created_at, text: `Nouvelle offre pour toi : ${o.titre} (${o.entreprise})` });
  }
  // Lauréat : candidatures reçues, une ligne par offre (elles se traitent toutes dans la fiche de l'offre), confirmations, commentaires
  const myOffers = new Map(data.offers.filter(o => o.author_id === me.id).map(o => [o.id, o]));
  const recues = new Map();
  for (const a of data.applications) if (myOffers.has(a.offer_id) && a.status === 'postule') recues.set(a.offer_id, [...(recues.get(a.offer_id) || []), a]);
  for (const [oid, as] of recues) {
    const o = myOffers.get(oid), last = as.reduce((m, a) => (a.created_at > m.created_at ? a : m));
    out.push({ key: 'ap' + oid + '-' + as.length, ref: oid, action: true, geste: as.length > 1 ? 'Voir les candidatures' : `Voir la candidature de ${first(last.student_id)}`, tone: 'accent', icon: 'inbox', offer: oid, at: last.created_at,
      text: as.length > 1 ? `${as.length} nouvelles candidatures : ${o.titre}` : `Nouvelle candidature de ${name(last.student_id)} : ${o.titre}` });
  }
  // Un recrutement confirmé : la personne d'abord (son merci), les points en petite pastille (vrais : +25 à l'étranger, +10 avec un merci)
  for (const p of data.placements) if (p.laureat_id === me.id && p.status === 'confirme' && recent(p.confirmed_at || p.created_at, 30)) {
    const mot = p.demande_id ? 'démarrage' : 'recrutement';
    out.push({ key: 'pc' + p.id + (p.merci ? 'm' : ''), icon: p.merci ? 'heart' : 'trophy', tone: 'brass', to: 'espace', at: p.confirmed_at || p.created_at, pts: pointsRecrutement(p) + (p.merci ? 10 : 0),
      text: p.merci ? `${name(p.student_id)} te remercie : son ${mot} chez ${p.entreprise} est confirmé.` : `${name(p.student_id)} a confirmé son ${mot} chez ${p.entreprise}.` });
  }
  for (const c of data.comments) if (myOffers.has(c.offer_id) && c.author_id !== me.id && recent(c.created_at, 14)) out.push({ icon: 'comment', offer: c.offer_id, at: c.created_at, text: `${name(c.author_id)} a posé une question sur ton offre : « ${c.body.slice(0, 60)}${c.body.length > 60 ? '…' : ''} »` });
  // Réseau vivant : réactions sur mes offres et mes demandes (une ligne par élément), réponses sous mes demandes
  out.push(...nouvellesVivant(data, me, name));
  // Mentorat : demande reçue, horaire choisi, rendez-vous proche, puis merci. Un rendez-vous = une seule ligne.
  for (const m of data.mentorships) {
    const st = mentorState(m);
    const w = st === 'rdv' && m.rdv_at ? slotWhen(m.rdv_at) : null;
    const soon = w && w.diff >= 0 && w.diff <= 1 ? `${w.diff === 0 ? 'aujourd’hui' : 'demain'} à ${w.time}` : null;
    const upcoming = m.rdv_at && new Date(m.rdv_at) > Date.now();
    if (m.mentor_id === me.id) {
      if (st === 'demande') out.push({ key: 'md' + m.id, ref: m.id, action: true, geste: 'Choisir un horaire', besoin: true, horaire: m.id, tone: 'accent', icon: 'mentor', to: 'mentorat', at: m.created_at, text: `${name(m.student_id)} te demande de l’aide : ${m.sujet}` });
      if (soon) out.push({ key: 'mr' + m.id, ref: m.id, rdv: true, rappel: true, action: true, tone: 'accent', icon: 'video', to: 'mentorat', at: m.accepted_at || m.created_at, text: `Rendez-vous avec ${name(m.student_id)} ${soon}` });
      if (st === 'rdv' && m.confirme_at && recent(m.confirme_at, 7)) out.push({ key: 'mc' + m.id + m.rdv_at, ref: m.id, tone: 'good', icon: 'checks', to: 'mentorat', at: m.confirme_at, text: `${first(m.student_id)} a confirmé sa présence : ${m.sujet}` });
      if (st === 'apres') out.push({ key: 'mf' + m.id, ref: m.id, action: true, geste: 'Marquer comme terminé', tone: 'brass', icon: 'check', to: 'mentorat', at: m.rdv_at, text: `Ton rendez-vous avec ${first(m.student_id)} a eu lieu ? Marque-le comme terminé.` });
      if (st === 'terminee' && m.merci && recent(m.rdv_at || m.created_at, 14)) out.push({ key: 'mm' + m.id, ref: m.id, tone: 'brass', icon: 'heart', to: 'espace', at: m.rdv_at || m.created_at, text: `${first(m.student_id)} te remercie pour le mentorat : ${m.sujet}` });
      if (st === 'annulee' && upcoming) out.push({ key: 'mx' + m.id, ref: m.id, icon: 'calendar', to: 'mentorat', at: m.accepted_at || m.created_at, text: `Ton rendez-vous avec ${first(m.student_id)} pour « ${m.sujet} » est annulé.` });
    }
    if (m.student_id === me.id) {
      // Rendez-vous fixé : confirmer sa présence est la chose à faire (base à jour) ; sinon une simple nouvelle, puis le rappel
      const aConfirmer = st === 'rdv' && 'confirme_at' in m && !m.confirme_at && upcoming;
      if (aConfirmer) out.push({ key: 'sc' + m.id + m.rdv_at, ref: m.id, action: true, geste: 'Confirmer ma présence', tone: 'accent', icon: 'calendar', to: 'mentorat', at: m.accepted_at || m.created_at, text: `${first(m.mentor_id)} a fixé ton rendez-vous. Confirme ta présence : ${m.sujet}` });
      else if (st === 'rdv' && !soon && recent(m.accepted_at || m.created_at, 10)) out.push({ key: 'sa' + m.id + m.rdv_at, ref: m.id, icon: 'mentor', tone: 'good', to: 'mentorat', at: m.accepted_at || m.created_at, text: `${name(m.mentor_id)} a choisi un de tes horaires : ${m.sujet}` });
      if (soon && !aConfirmer) out.push({ key: 'sr' + m.id + m.rdv_at, ref: m.id, rdv: true, rappel: true, action: true, tone: 'accent', icon: 'video', to: 'mentorat', at: m.accepted_at || m.created_at, text: `Rendez-vous avec ${name(m.mentor_id)} ${soon}` });
      if (st === 'apres') out.push({ key: 'sf' + m.id, ref: m.id, action: true, geste: 'Dire merci', tone: 'brass', icon: 'heart', to: 'mentorat', at: m.rdv_at, text: `Comment s’est passé ton échange avec ${first(m.mentor_id)} ? Dis-lui merci.` });
      // Rendez-vous annulé : d'autres horaires au même lauréat, en un geste (la ligne s'en va dès qu'ils sont envoyés)
      if (st === 'annulee' && upcoming && m.mentor_id && !nouvelleDemandeApres(data, m)) out.push({ key: 'sx' + m.id, ref: m.id, icon: 'calendar', to: 'mentorat', redemander: m.id, at: m.accepted_at || m.created_at, text: `Ton rendez-vous avec ${first(m.mentor_id)} pour « ${m.sujet} » est annulé. Tu peux lui proposer d’autres horaires.` });
    }
  }
  // Lauréat : demandes ouvertes à tous qui lui correspondent bien (deux au plus) ; elles s'ouvrent sur place avec leurs horaires
  const ignorees = mentoratIgnorees();
  if (me.role === 'laureat') for (const { m } of requestsFor(data, me, id => store.byId('profiles', id)).filter(x => !x.direct && x.score >= 3 && !ignorees.has(x.m.id)).slice(0, 2)) {
    out.push({ key: 'mo' + m.id, ref: m.id, besoin: true, horaire: m.id, tone: 'accent', icon: 'heart', to: 'mentorat', at: m.created_at, text: `${name(m.student_id)} cherche de l’aide : ${m.sujet}` });
  }
  // Invitations à postuler (étudiant)
  for (const i of data.invitations) if (i.student_id === me.id && i.status === 'envoyee' && !data.applications.some(a => a.offer_id === i.offer_id && a.student_id === me.id)) {
    const o = store.byId('offers', i.offer_id);
    // Une invitation reçue l'an dernier ne pousse pas une offre d'une autre année
    if (o && o.status === 'ouverte' && peutPostulerA(o, me, saison)) out.push({ key: 'in' + i.id, ref: o.id, action: true, geste: 'Voir l’offre', tone: 'accent', icon: 'send', offer: o.id, at: i.created_at, text: `${name(i.laureat_id)} t’invite à postuler : ${o.titre}` });
  }
  // Demandes des étudiants : aides reçues, match à faire avancer, demande en pause, nouvelles demandes de son parcours
  const dem = id => (data.demandes || []).find(d => d.id === id);
  const demarre = d => data.placements.some(p => p.demande_id === d.id && p.status !== 'refuse');
  for (const x of data.propositions || []) {
    const d = dem(x.demande_id); if (!d) continue;
    if (d.auteur_id === me.id && x.status === 'envoyee' && d.status === 'ouverte') out.push({ key: 'dp' + x.id, ref: d.id, action: true, geste: 'Voir sa proposition', tone: 'accent', icon: 'send', to: 'offres/demandes/' + d.id, at: x.created_at, text: `${name(x.laureat_id)} te propose son aide : ${d.titre}` });
    if (d.auteur_id === me.id && x.status === 'retiree' && d.status === 'ouverte' && recent(x.repondu_at || x.created_at, 7)) out.push({ key: 'dw' + x.id, ref: d.id, icon: 'send', to: 'offres/demandes/' + d.id, at: x.repondu_at || x.created_at, text: `${name(x.laureat_id)} a retiré sa proposition. Ta demande est de nouveau ouverte aux lauréats.` });
    // Le démarrage attend un événement extérieur, parfois des mois : l'accueil le propose, la cloche ne le compte pas
    if (x.laureat_id === me.id && x.status === 'acceptee' && d.status === 'match' && !demarre(d)) out.push({ key: 'dm' + x.id, ref: d.id, action: true, tone: 'accent', icon: 'heart', to: 'offres/demandes/' + d.id, at: x.repondu_at || x.created_at, text: `C’est un match avec ${name(d.auteur_id)} : déclare son démarrage dès qu’il a lieu.` });
    if (x.laureat_id === me.id && ['declinee', 'close'].includes(x.status) && recent(x.repondu_at || x.created_at, 7)) out.push({ key: 'dx' + x.id + x.status, ref: d.id, icon: 'heart', to: 'offres/demandes/' + d.id, at: x.repondu_at || x.created_at, text: `${first(d.auteur_id)} a choisi une autre voie pour « ${d.titre} ». Merci d’avoir proposé ton aide !` });
  }
  for (const d of data.demandes || []) if (d.auteur_id === me.id && demandeEnPause(d)) out.push({ key: 'dr' + d.id, ref: d.id, action: true, geste: 'Voir ma demande', icon: 'clock', to: 'offres/demandes/' + d.id, at: d.relancee_at || d.created_at, text: `Ta demande « ${d.titre} » est en pause. Relance-la si tu cherches toujours.` });
  if (me.role === 'laureat') for (const { d } of demandesPour(data, me, id => store.byId('profiles', id)).filter(x => !x.mienne && x.pourMoi && recent(x.large ? new Date(demandeLargeLe(x.d, x.a)).toISOString() : x.d.created_at, 4)).slice(0, 2)) {
    out.push({ key: 'dn' + d.id, ref: d.id, besoin: true, aider: d.id, tone: 'accent', icon: 'send', to: 'offres/demandes/' + d.id, at: d.created_at, text: `${name(d.auteur_id)} cherche : ${d.titre}` });
  }
  // Bravos reçus sur sa réussite
  for (const p of data.placements) if (p.student_id === me.id && FOUND.has(p.status)) {
    const k = data.kudos.filter(x => x.placement_id === p.id && x.user_id !== me.id);
    const last = k.reduce((m, x) => (x.created_at > m ? x.created_at : m), '');
    if (k.length && recent(last, 14)) out.push({ icon: 'clap', tone: 'brass', to: 'accueil', at: last, text: `${k.length} bravo${k.length > 1 ? 's' : ''} pour ta réussite chez ${p.entreprise}` });
  }
  const myQ = new Set(data.questions.filter(q => q.author_id === me.id).map(q => q.id));
  for (const a of data.answers) if (myQ.has(a.question_id) && a.author_id !== me.id) out.push({ key: 'an' + a.id, tone: 'good', icon: 'qa', to: 'reseau/entraide/' + a.question_id, at: a.created_at, text: `${name(a.author_id)} a répondu à ta question.` });
  // Questions routées vers ce lauréat (son entreprise ou son pays), sans réponse de sa part : envoyées à tout un groupe, donc pas comptées
  if (me.role === 'laureat') for (const q of data.questions) if (routedTo(q, me) && recent(q.created_at, 14) && !data.answers.some(a => a.question_id === q.id && a.author_id === me.id)) {
    out.push({ key: 'qr' + q.id, ref: q.id, action: true, besoin: true, tone: 'accent', icon: 'qa', to: 'reseau/entraide/' + q.id, at: q.created_at, text: `Une question pour toi sur ${q.entreprise || q.pays} : ${q.titre}` });
  }
  // Relance douce : mes offres ouvertes sans activité depuis 3 semaines
  for (const o of data.offers) if (o.author_id === me.id && needsRelance(data, o)) out.push({ key: 'ro' + o.id, ref: o.id, action: true, geste: 'Mettre à jour', icon: 'clock', offer: o.id, at: o.relance_at || o.created_at, text: `Ton offre « ${o.titre} » est-elle toujours ouverte ?` });
  // Parrainage
  for (const x of data.parrainages) if (x.saison === saison && recent(x.created_at, 14)) {
    if (x.parrain_id === me.id) out.push({ key: 'pf' + x.id, tone: 'brass', icon: 'heart', to: 'espace', at: x.created_at, text: `${name(x.filleul_id)} (3A) est ton filleul cette année. Fais-lui signe !` });
    if (x.filleul_id === me.id) out.push({ key: 'pp' + x.id, tone: 'brass', icon: 'heart', to: 'parcours', at: x.created_at, text: `Ton parrainage cette année : ${name(x.parrain_id)}, de ta filière.` });
  }
  // Un café ENSAM annoncé dans ma ville ou mon pays
  const groups = myGroups(data, me).all;
  for (const c of data.cafes) {
    const g = groups.includes(groupKey('ville', c.ville)) ? groupKey('ville', c.ville) : groups.includes(groupKey('pays', c.pays)) ? groupKey('pays', c.pays) : null;
    if (!g || c.annule || c.organisateur_id === me.id || new Date(c.date_at) < Date.now() || !recent(c.created_at, 10)) continue;
    if (data.cafe_participants.some(x => x.cafe_id === c.id && x.user_id === me.id)) continue;
    const w = new Date(c.date_at);
    out.push({ key: 'cf' + c.id, icon: 'clap', tone: 'good', to: 'reseau/groupes/' + encodeURIComponent(g), at: c.created_at, text: `Café ENSAM à ${c.ville} le ${w.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} : inscris-toi en un clic.` });
  }
  // Coordonnées : demandes reçues, puis réponse à mes demandes
  for (const d of data.demandes_contact || []) {
    if (d.cible_id === me.id && d.status === 'envoyee') out.push({ key: 'dc' + d.id, ref: d.id, action: true, geste: 'Répondre', tone: 'accent', icon: 'phone', profile: d.demandeur_id, to: 'accueil', at: d.created_at, text: `${name(d.demandeur_id)} aimerait avoir tes coordonnées.` });
    if (d.demandeur_id === me.id && d.status === 'acceptee' && recent(d.repondu_at || d.created_at, 14)) out.push({ key: 'da' + d.id, tone: 'good', icon: 'phone', profile: d.cible_id, at: d.repondu_at || d.created_at, text: `${name(d.cible_id)} a accepté : ses coordonnées sont sur son profil.` });
  }
  // Relecture de CV
  for (const r of data.relectures_cv || []) {
    if (r.student_id === me.id && r.status === 'rendue' && !r.merci && !r.note) out.push({ key: 'rr' + r.id, ref: r.id, action: true, geste: 'Lire ses conseils', tone: 'brass', icon: 'check', to: 'mentorat/cv', at: r.rendue_at || r.created_at, text: `${r.reviewer_id ? first(r.reviewer_id) : 'Un lauréat'} a relu ton CV. Lis ses conseils et dis merci.` });
    if (r.student_id === me.id && r.status === 'en_cours' && recent(r.pris_at || r.created_at, 7)) out.push({ key: 'rp' + r.id, ref: r.id, tone: 'good', icon: 'eye', to: 'mentorat/cv', at: r.pris_at || r.created_at, text: `${r.reviewer_id ? name(r.reviewer_id) : 'Un lauréat'} relit ton CV.` });
    // Relecture commencée : l'étudiant attend la suite, elle reste à faire jusqu'à ce qu'elle soit rendue
    if (r.reviewer_id === me.id && r.status === 'en_cours') out.push({ key: 'rc' + r.id, ref: r.id, action: true, geste: 'Continuer la relecture', tone: 'accent', icon: 'edit', to: 'mentorat/cv', at: r.pris_at || r.created_at, text: `Tu relis le CV de ${name(r.student_id)}` });
    if (r.reviewer_id === me.id && r.status === 'demandee') out.push({ key: 'rd' + r.id, ref: r.id, action: true, geste: `Relire le CV de ${first(r.student_id)}`, besoin: true, tone: 'accent', icon: 'eye', to: 'mentorat/cv', at: r.created_at, text: `${name(r.student_id)} te demande de relire son CV.` });
    if (r.reviewer_id === me.id && r.status === 'rendue' && r.merci && recent(r.rendue_at || r.created_at, 14)) out.push({ key: 'rm' + r.id, ref: r.id, tone: 'brass', icon: 'heart', to: 'mentorat/cv', at: r.rendue_at || r.created_at, text: `${first(r.student_id)} te remercie pour la relecture de son CV.` });
  }
  if (me.role === 'laureat') {
    const ouvertes = (data.relectures_cv || []).filter(r => r.status === 'demandee' && !r.reviewer_id && r.student_id !== me.id);
    if (ouvertes.length) out.push({ key: 'rq' + ouvertes.length, besoin: true, tone: 'accent', icon: 'eye', to: 'mentorat/cv', at: ouvertes.reduce((m, r) => (r.created_at > m ? r.created_at : m), ''), text: `${ouvertes.length} CV attend${ouvertes.length > 1 ? 'ent' : ''} une relecture.` });
  }
  // Vérification par deux lauréats de la même promo
  const pairs = data.verifications_pairs || [];
  if (me.role === 'laureat' && me.verified) {
    const attente = data.profiles.filter(p => p.role === 'laureat' && !p.verified && p.promo === me.promo && p.id !== me.id && !pairs.some(v => v.laureat_id === p.id && v.verificateur_id === me.id));
    if (attente.length) out.push({ key: 'vp' + attente.map(p => p.id).join(''), tone: 'accent', icon: 'shield', to: 'accueil', at: attente.reduce((m, p) => (p.created_at > m ? p.created_at : m), ''), text: attente.length > 1 ? `${attente.length} lauréats de ta promo attendent ta vérification.` : `${attente[0].full_name} (promo ${me.promo}) attend ta vérification.` });
  }
  if (me.role === 'laureat') for (const v of pairs) if (v.laureat_id === me.id && recent(v.created_at, 14)) out.push({ key: 'vv' + v.id, tone: 'good', icon: 'shield', profile: v.verificateur_id, at: v.created_at, text: me.verified ? `${name(v.verificateur_id)} a confirmé que tu es de la promo ${me.promo}.` : `${name(v.verificateur_id)} a confirmé que tu es de la promo ${me.promo}. Encore un lauréat et ton badge arrive.` });
  // Agenda de l'école : nouvel événement, puis rappel la veille et le jour même
  for (const e of data.evenements || []) {
    if (e.annule || new Date(e.fin || e.debut) < Date.now()) continue;
    if (e.public === 'etudiants' && me.role === 'laureat') continue;
    if (e.public === 'laureats' && me.role === 'etudiant') continue;
    const inscrit = (data.evenement_participants || []).some(x => x.evenement_id === e.id && x.user_id === me.id);
    const jours = Math.floor((new Date(e.debut).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5);
    const quand = new Date(e.debut).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    if (inscrit && jours >= 0 && jours <= 1) out.push({ key: 'ev' + e.id + jours, ref: e.id, action: true, rappel: true, tone: 'accent', icon: 'calendar', to: 'reseau/agenda/' + e.id, at: e.created_at, text: `${e.titre} : ${jours === 0 ? 'c’est aujourd’hui' : 'c’est demain'}.` });
    else if (!inscrit && recent(e.created_at, 10) && e.author_id !== me.id) out.push({ key: 'en' + e.id, ref: e.id, tone: 'good', icon: TYPES_EVENEMENT[e.type]?.[1] || 'calendar', to: 'reseau/agenda/' + e.id, at: e.created_at, text: `${TYPES_EVENEMENT[e.type]?.[0] || 'Événement'} à l’agenda du réseau : ${e.titre}, ${quand}.` });
  }
  // Enquête d'insertion (6 et 12 mois après le diplôme) : facultative, personne ne l'attend ; datée du début de sa vague
  const due = enqueteDue(me, data.enquetes_insertion);
  if (due) out.push({ key: 'eq' + due.vague, action: true, tone: 'brass', icon: 'chart', to: 'enquete', at: due.debut.toISOString(), text: `Enquête ${due.vague} mois après le diplôme : 2 minutes pour aider les promos suivantes.` });
  // Un lauréat sans photo : la petite tâche « Ajoute une photo » (vers Mon profil, où la carte photo vient en premier), en dernier
  const ph = tachePhoto(me, { live: store.mode === 'live' });
  if (ph) out.push(ph);
  // Administration : signalements à traiter
  if (me.role === 'admin') {
    const sig = (data.signalements || []).filter(x => x.status === 'ouvert');
    if (sig.length) out.push({ key: 'sg' + sig.length, action: true, geste: 'Voir les signalements', tone: 'accent', icon: 'shield', to: 'admin/moderation', at: sig.reduce((m, x) => (x.created_at > m ? x.created_at : m), ''), text: `${sig.length} signalement${sig.length > 1 ? 's' : ''} à traiter.` });
  }
  // Ambassadeur de promo : la proposition attend une réponse
  out.push(...notifsAmbassadeur({ data, me }));
  return out.sort((a, b) => (b.geste ? 1 : 0) - (a.geste ? 1 : 0) || (b.action ? 1 : 0) - (a.action ? 1 : 0) || new Date(b.at) - new Date(a.at));
}

// ---------------------------------------------------------------------------
// Accueil : « Bonsoir Salma », une seule carte « prochaine étape », où j'en suis, « À faire », puis « Pour toi » et « Dans le réseau ».
// Chaque chose n'y est dite qu'une fois (montres). Le ton reste doux : pas de comparaison qui stresse.
// ---------------------------------------------------------------------------
const MOMENT = h => (h < 5 ? 'Bonsoir' : h < 18 ? 'Bonjour' : 'Bonsoir');
const cleNotif = n => n.key || n.text;
// Quelqu'un attend ma réponse : ces notifications passent avant tout message, dans cet ordre
const ATTEND = { laureat: ['md', 'dm', 'rd', 'rc', 'ap', 'qr'], etudiant: ['dp', 'in'], admin: ['sg'] };
const OEIL = { md: 'Un étudiant t’attend', dm: 'Un étudiant t’attend', rd: 'Un étudiant t’attend', rc: 'Un étudiant t’attend', ap: 'Un étudiant t’attend', qr: 'Une question', dp: 'Une proposition d’aide', in: 'Une invitation', sg: 'À traiter' };
// Le CV se dépose dans Mon profil : on y va et le bouton de dépôt prend le focus (ouvrir le sélecteur à distance, l'iPhone le bloque)
const versCV = go => {
  go('profil');
  setTimeout(() => {
    const b = document.getElementById('cv-drop');
    if (!b) return;
    b.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    b.focus({ preventScroll: true });
  }, 350);
};

// La prochaine étape, une seule, la première qui convient : un rendez-vous qui commence, une confirmation de recrutement,
// quelqu'un qui attend ma réponse, un rendez-vous la veille ou le jour même, un message, une autre chose à faire,
// l'étape suivante des premiers pas, une offre faite pour moi, un étudiant que je peux aider, le CV, sinon le calme.
// Chaque carte a une clé stable (key) et dit ce qu'elle montre (ref, cles) pour que l'accueil ne le répète pas.
function prochainPas(ctx, notifs, etape, { plAttente, helper, besoins = [] } = {}) {
  const { data, me, store, saison, go, openOffer, setCompose } = ctx;
  const nom = id => store.byId('profiles', id)?.full_name || 'Un membre', prenom = id => nom(id).split(' ')[0], role = me.role;
  const rdvs = data.mentorships.map(m => ({ m, q: rdvALaUne(m, me.id) })).filter(x => x.q).sort((a, b) => new Date(a.m.rdv_at) - new Date(b.m.rdv_at));
  const rdv = q => rdvs.find(x => x.q === q)?.m;
  if (rdv('direct')) return pasRdv(ctx, rdv('direct'), 'direct');
  if (plAttente) return pasConfirmer(ctx, plAttente, helper);
  // Rôle et promo qui ne vont pas ensemble (ex. lauréat de la promo 2027) : on propose de corriger le profil
  if ((role === 'laureat' && me.promo > new Date().getFullYear()) || (role === 'etudiant' && me.promo <= saison))
    return { key: 'promo', icon: 'user', eyebrow: 'Ton profil', titre: role === 'laureat' ? `Promo ${me.promo} : tu es encore à l’école ? Mets ton profil à jour.` : `Promo ${me.promo} : tu as ton diplôme ? Passe ton profil côté lauréats.`, cta: 'Mettre à jour', go: () => go('profil') };
  if (rdv('confirmer')) return pasRdv(ctx, rdv('confirmer'), 'confirmer');
  for (const p of ATTEND[role] || []) {
    const n = notifs.filter(x => x.action && (x.key || '').startsWith(p) && (p !== 'dm' || recent(x.at, 7))).sort((a, b) => new Date(a.at) - new Date(b.at))[0];
    const r = n && pasNotif(ctx, n); if (r) return r;
  }
  if (rdv('proche')) return pasRdv(ctx, rdv('proche'), 'proche');
  // La plateforme lui propose d'être ambassadeur de sa promo (7 jours pour répondre)
  const amb = pasAmbassadeur(ctx); if (amb) return amb;
  // Un message de l'administration attend dans la bulle pendant les premiers pas
  const conv = conversations(data, me.id).find(c => c.nonLus && !(etape && store.byId('profiles', c.autre)?.role === 'admin'));
  if (conv) {
    const adm = store.byId('profiles', conv.autre)?.role === 'admin';
    return { key: 'msg' + conv.autre, ref: conv.autre, message: true, icon: 'chat', eyebrow: 'Un message t’attend', titre: conv.nonLus > 1 ? `${nom(conv.autre)} t’a écrit ${conv.nonLus} messages.` : `${nom(conv.autre)} t’a écrit.`, cta: adm ? 'Répondre' : `Répondre à ${prenom(conv.autre)}`, go: () => go('messages/' + conv.autre) };
  }
  const a = notifs.find(n => n.action && !n.rdv && !n.besoin && !/^(eq|dc|md|sc|pa|dm|ph)/.test(n.key || '') && !(role === 'etudiant' && n.icon === 'briefcase'));
  if (a) return pasNotif(ctx, a);
  // Un étudiant précis vaut mieux que l'étape « Aide un étudiant » ; une demande d'étudiant, ou ce qu'on lui demande
  // à lui, passe même avant toutes les étapes des premiers pas (profil, disponibilité, offre)
  const aide = role === 'laureat' && besoins[0] ? pasBesoin(ctx, besoins[0], besoins) : null;
  const urgent = role === 'laureat' && etape ? besoins.find(b => b.direct || b.kind === 'demande') : null;
  if (urgent) return pasBesoin(ctx, urgent, besoins);
  if (etape && !(etape.cle === 'aide' && aide)) return { key: 'guide-' + etape.cle, guide: true, icon: etape.icon, titre: etape.titre, detail: etape.texte, cta: etape.cta, go: etape.go, ici: etape.cle === 'dispo' };
  const deja = o => data.applications.some(y => y.offer_id === o.id && y.student_id === me.id);
  let o = null;
  if (role === 'etudiant') {
    const niv = niveauOf(me, saison);
    // Pas un partage (à postuler ailleurs) ; une offre portée par un lauréat, qui encadre, passe devant (comme « Recommandé pour toi »)
    o = data.offers.filter(x => x.status === 'ouverte' && !estPartagee(x) && (x.annees || []).includes(niv) && !deja(x)).map(x => ({ x, s: offerMatch(x, me).score + (estPortee(x) ? 3 : 0) })).sort((p, q) => q.s - p.s || new Date(q.x.created_at) - new Date(p.x.created_at))[0]?.x;
  }
  if (role === 'laureat' && me.en_recherche) o = data.offers.filter(x => x.status === 'ouverte' && x.author_id !== me.id && matchesMe(x, me, saison) && peutPostulerA(x, me, saison) && !deja(x)).sort((p, q) => new Date(q.created_at) - new Date(p.created_at))[0];
  if (o) return { key: 'offre' + o.id, ref: o.id, icon: 'spark', eyebrow: 'Pour toi', titre: o.titre, membre: true, detail: o.entreprise, detailMembre: true, cta: 'Voir l’offre', go: () => openOffer(o.id) };
  if (aide) return aide;
  if (role !== 'admin' && !(me.cv_path || me.cv_url)) return { key: 'cv', icon: 'file', eyebrow: 'Ton CV', titre: 'Ajoute ton CV en PDF', detail: role === 'etudiant' ? 'Ton profil se complète tout seul, et il part avec tes candidatures.' : 'Ton profil se complète tout seul.', cta: 'Ajouter mon CV', go: () => versCV(go) };
  const fin = role === 'admin' ? { cta: 'Ouvrir l’administration', go: () => go('admin') } : role === 'laureat' && !me.en_recherche ? { cta: 'Publier une offre', go: () => setCompose(true) } : { cta: role === 'laureat' ? 'Voir les offres pour moi' : 'Voir les offres', go: () => go('offres') };
  return { key: 'calme', icon: 'check', eyebrow: 'Rien en attente', titre: role === 'laureat' ? 'Merci pour ce que tu fais pour les étudiants.' : role === 'admin' ? 'Rien à traiter pour l’instant.' : 'Rien ne presse : avance à ton rythme.', ...fin };
}

function pasRdv(ctx, m, q) {
  const { store, me, go } = ctx;
  const autre = m.mentor_id === me.id ? m.student_id : m.mentor_id, w = slotWhen(m.rdv_at), lien = lienVisio(store, m.id);
  const eyebrow = q === 'direct' ? 'C’est l’heure' : w.diff === 0 ? `Rendez-vous aujourd’hui à ${w.time}` : w.diff === 1 ? `Rendez-vous demain à ${w.time}` : `Rendez-vous le ${w.date} à ${w.time}`;
  const voir = { label: 'Voir le rendez-vous', go: () => go('mentorat') };
  const base = { type: 'rdv', key: 'rdv' + m.id, ref: m.id, cles: ['sc' + m.id + m.rdv_at], icon: 'video', eyebrow, titre: m.sujet, membre: true, avec: store.byId('profiles', autre)?.full_name };
  if (q === 'confirmer') return { ...base, key: 'sc' + m.id + m.rdv_at, cta: 'Je serai là', ici: true, go: () => confirmerPresence(ctx, m), lien: voir };
  if (q === 'direct' && lien) return { ...base, cta: 'Rejoindre la visio', href: lien, lien: voir };
  return { ...base, cta: 'Voir le rendez-vous', go: voir.go };
}
function pasConfirmer(ctx, pl, helper) {
  const { data } = ctx, qui = helper?.full_name || 'Un lauréat';
  const sur = (pl.offer_id && data.offers.find(o => o.id === pl.offer_id)?.titre) || (pl.demande_id && (data.demandes || []).find(d => d.id === pl.demande_id)?.titre) || null;
  return { key: 'pa' + pl.id, ref: pl.id, icon: 'briefcase', eyebrow: 'À confirmer', titre: pl.demande_id ? `${qui} indique que tu as commencé chez ${pl.entreprise}` : `${qui} déclare ton recrutement chez ${pl.entreprise}`, detail: sur, detailMembre: true,
    cta: 'Oui, je confirme', ici: true, go: () => confirmerRecrutement(ctx, pl, helper), lien: { label: 'Ce n’est pas le cas', go: () => refuserRecrutement(ctx, pl) } };
}
// Une notification devient la carte : son geste est le bouton (jamais « Y aller »)
function pasNotif(ctx, n) {
  const { data, store, go, openNotif } = ctx;
  const p = (n.key || '').slice(0, 2);
  const nom = uid => store.byId('profiles', uid)?.full_name || 'Un membre', prenom = uid => nom(uid).split(' ')[0];
  const base = { key: cleNotif(n), ref: n.ref || n.offer, icon: n.icon, eyebrow: OEIL[p] || 'Ta prochaine étape', titre: n.text, cta: n.geste || 'Ouvrir', go: () => openNotif(n) };
  switch (p) {
    case 'dm': { const d = (data.demandes || []).find(y => y.id === n.ref); return d ? { ...base, titre: `${nom(d.auteur_id)} a accepté ton aide : ${d.titre}`, cta: `Écrire à ${prenom(d.auteur_id)}`, go: () => go('messages/' + d.auteur_id), lien: { label: 'Voir la demande', go: () => go('offres/demandes/' + d.id) } } : null; }
    case 'qr': return { ...base, cta: 'Répondre à la question' };
    case 'mf': { const m = data.mentorships.find(y => y.id === n.ref); return m ? { ...base, ici: true, go: () => finirMentorat(ctx, m), lien: { label: 'Il n’a pas eu lieu', go: () => go('mentorat') } } : base; }
    case 'pm': return { ...base, go: () => versMerci(ctx) };
    case 'ev': return { ...base, cta: 'Voir l’événement' };
    default: return base;
  }
}
// Lauréat : le premier étudiant qui attend une aide qu'il peut donner, ouvert sur place
function pasBesoin(ctx, b, besoins = [b]) {
  const nom = ctx.store.byId('profiles', b.who)?.full_name || 'Un membre';
  const cta = b.kind === 'cv' ? `Relire le CV de ${nom.split(' ')[0]}` : b.kind === 'question' ? 'Répondre à la question' : VERBE_BESOIN[b.kind];
  // Les autres demandes ouvertes qui lui sont adressées : leur nombre, dans le lien vers la liste (la carte reste courte sur téléphone)
  const n = besoins.filter(x => x.kind === 'demande').length;
  const plus = n > 1 ? { lien: { label: `Voir les ${n} demandes ouvertes`, go: () => ctx.go('offres/demandes') } } : {};
  return { key: 'besoin-' + b.kind + b.id, ref: b.id, icon: ICONE_BESOIN[b.kind], eyebrow: 'Tu peux aider', titre: phraseBesoin(b, nom), cta, go: () => ouvrirBesoin(ctx, b), ...plus };
}

// La carte « prochaine étape » : une seule forme, un seul bouton plein qui nomme l'action, au plus deux liens dessous.
// Les premiers pas y sont fondus : « Premiers pas · 2 sur 5 » ouvre la feuille des étapes.
function ProchainPas({ pas, progres, onEtapes, faite }) {
  if (!pas) return null;
  const anneau = progres ? html`<span class="pas-anneau" style=${`--p:${progres.done / progres.total}`} aria-hidden="true"></span>` : null;
  const etapes = progres ? `Premiers pas · ${progres.done} sur ${progres.total}` : '';
  // L'étape vue la dernière fois est faite : elle se coche en vert, l'anneau avance, puis la carte laisse la place à la suivante
  if (faite?.s && progres) return html`<section key="fait" class=${'pas pas-fait' + (faite.part ? ' part' : '')} aria-labelledby="pas-titre" data-pas=${'fait-' + faite.s.cle}>
    <div class="pas-txt">
      <p class="pas-oeil"><span class="pas-anneau" style=${`--p:${progres.done / progres.total};--p0:${Math.max(0, progres.done - 1) / progres.total}`} aria-hidden="true"></span><span>${etapes}</span></p>
      <h2 class="pas-titre" id="pas-titre">${faite.s.titre}</h2>
    </div>
    <div class="pas-act"><p class="pas-ok" role="status"><span class="pas-coche" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 12.5l4 4 8-9"/></svg></span><span>Fait</span></p></div>
  </section>`;
  const lien = pas.guide ? { label: 'Voir les étapes', go: onEtapes, dialog: true } : pas.lien;
  const membre = pas.membre ? { translate: 'no', dir: 'auto' } : {};
  return html`<section key="pas" class=${'pas' + (faite?.arrive ? ' pas-arrive' : '')} aria-labelledby="pas-titre" data-pas=${pas.key}>
    <div class="pas-txt">
      <p class="pas-oeil">${pas.guide ? anneau : html`<${Icon} name=${pas.icon || 'arrow'} size=${16}/>`}<span>${pas.guide ? etapes : pas.eyebrow}</span></p>
      <h2 class="pas-titre" id="pas-titre" ...${membre}>${pas.titre}</h2>
      ${pas.avec ? html`<p class="pas-detail">Avec <span translate="no">${pas.avec}</span></p>` : pas.detail ? html`<p class="pas-detail" translate=${pas.detailMembre ? 'no' : undefined} dir=${pas.detailMembre ? 'auto' : undefined}>${pas.detail}</p>` : null}
    </div>
    <div class="pas-act">
      ${pas.href ? html`<a class="btn primary pas-go" href=${pas.href} target="_blank" rel="noopener"><${Icon} name="video" size=${18}/> ${pas.cta}</a>`
        : html`<button type="button" class="btn primary pas-go" onClick=${pas.go}>${pas.ici ? html`<${Icon} name="check" size=${18}/>` : null}${pas.cta}${pas.ici ? null : html`<${Icon} name="arrow" size=${18}/>`}</button>`}
      ${lien || (progres && !pas.guide) ? html`<div class="pas-pied">
        ${lien ? html`<button type="button" class="linkish pas-lien" aria-haspopup=${lien.dialog ? 'dialog' : undefined} onClick=${lien.go}>${lien.label}</button>` : null}
        ${progres && !pas.guide ? html`<button type="button" class="linkish pas-etapes" aria-haspopup="dialog" onClick=${onEtapes}>${anneau}<span>${etapes}</span></button>` : null}
      </div>` : null}
    </div>
  </section>`;
}

// Les premiers pas en feuille : ce qui est fait, ce qui reste (chaque bouton ferme la feuille puis agit), puis « Ensuite »
function EtapesSheet({ me, g, onClose, onHide, historique }) {
  const ligne = s => html`<li key=${s.cle} class=${s.fait ? 'fait' : s.plusTard ? 'plus-tard' : ''}>
    <span class="e-ico"><${Icon} name=${s.fait ? 'check' : s.icon} size=${18}/></span><strong>${s.titre}</strong><span class="small muted">${s.texte}<${Pastille} n=${s.pts}/></span>
    ${!s.fait && s.go ? html`<button type="button" class="btn small" onClick=${() => { onClose(); ensuite(s.go); }}>${s.cta}</button>` : null}</li>`;
  return html`<${Modal} title="Premiers pas" onClose=${onClose} historique=${historique} footer=${g.fini ? null : html`<button type="button" class="linkish small" onClick=${onHide}>Ne plus afficher les premiers pas</button>`}>
    <div class="etapes-tete"><span class="pas-anneau grand" style=${`--p:${g.done / g.total}`} aria-hidden="true"></span>
      <p><strong>${me.role === 'etudiant' ? 'Trouver ton stage avec les lauréats' : 'Aider les étudiants de l’école'}</strong><span class="small muted">${`${g.done} sur ${g.total}`}</span></p></div>
    <ol class="etapes">${g.steps.filter(s => !s.plusTard).map(ligne)}</ol>
    ${g.steps.some(s => s.plusTard) ? html`<p class="etapes-ensuite">Ensuite</p><ul class="etapes">${g.steps.filter(s => s.plusTard).map(ligne)}</ul>` : null}
  <//>`;
}
// Premiers pas terminés (vus en cours auparavant) : on le fête une fois. Clés gardées dans ce navigateur, par membre.
function useFetePremiersPas(me, g) {
  const [etat, setEtat] = useLocal('guide-etat-' + me.id, null);
  useEffect(() => {
    if (!g) return;
    if (!g.fini && etat !== 'en-cours') setEtat('en-cours');
    if (g.fini && etat === 'en-cours') { setEtat('fini'); celebrate({ cle: 'premiers-pas-' + me.id, icon: 'award', titre: 'Premiers pas terminés !', texte: me.role === 'etudiant' ? 'Ton profil est prêt : les lauréats peuvent maintenant t’aider.' : 'Merci ! Les étudiants de l’école peuvent compter sur toi.' }); }
  }, [g?.fini]);
}

// La carte qui dit « Fait » : l'étape des premiers pas que la carte montrait (gardée par membre dans ce navigateur)
// est faite au retour sur l'accueil, ou sur place ? Elle se coche en vert, puis la suivante arrive en glissant.
// Pas quand les premiers pas se terminent : c'est alors la fête « Premiers pas terminés ! » qui le dit (useFetePremiersPas).
const lireLocal = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const ecrireLocal = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* pas de stockage */ } };
function useEtapeFaite(me, g, pas) {
  const k = 'guide-vu-' + me.id;
  const vu = useRef(undefined);
  if (vu.current === undefined) vu.current = lireLocal(k);
  const [phase, setPhase] = useState(0);   // 0 : rien · 1 : cochée · 2 : elle s'en va · 3 : la suivante arrive
  const minuteurs = useRef([]);
  useEffect(() => () => minuteurs.current.forEach(clearTimeout), []);
  const s = g && !g.fini && vu.current ? g.steps.find(x => x.cle === vu.current && x.fait) || null : null;
  const montree = pas?.guide ? pas.key.replace(/^guide-/, '') : null;
  useEffect(() => {
    if (s) {
      if (phase === 1 || phase === 2) return;
      setPhase(1);
      // Oubliée aussi sur l'appareil : la carte suivante peut ne pas être une étape (un étudiant qui attend), elle ne se recoche pas au retour
      minuteurs.current.push(setTimeout(() => setPhase(2), 1350), setTimeout(() => { vu.current = null; ecrireLocal(k, null); setPhase(3); }, 1620));
      return;
    }
    if (vu.current !== montree) { vu.current = montree; ecrireLocal(k, montree); }
  });
  return { s, part: phase === 2, arrive: phase === 3 };
}

// Lauréat : il vit aussi le match. À son retour sur l'accueil, « Salma a accepté ton aide » avec les deux visages
// (une fois par match), puis, le jour où il arrive, son tout premier merci d'un étudiant, cité en entier.
// Ce qui existait déjà à sa première visite dans ce navigateur n'est pas fêté, sauf s'il date de moins de deux jours.
// Jamais par-dessus une autre fenêtre : la fête attend alors la visite suivante.
function mercisRecus(data, id) {
  const ok = x => typeof x === 'string' && x.trim();
  return [
    ...data.placements.filter(p => p.laureat_id === id && p.status === 'confirme' && ok(p.merci)).map(p => ({ txt: p.merci, de: p.student_id, at: p.confirmed_at || p.created_at })),
    ...data.mentorships.filter(m => m.mentor_id === id && ok(m.merci)).map(m => ({ txt: m.merci, de: m.student_id, at: m.rdv_at || m.created_at })),
    ...(data.relectures_cv || []).filter(r => r.reviewer_id === id && ok(r.merci)).map(r => ({ txt: r.merci, de: r.student_id, at: r.rendue_at || r.created_at })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));
}
const dejaFete = cle => { try { return !!localStorage.getItem('fete-' + cle); } catch { return true; } };
function useFetesLaureat(ctx) {
  const { data, me, store, go } = ctx;
  const lau = me.role === 'laureat';
  const matchs = lau ? (data.propositions || []).filter(x => x.laureat_id === me.id && x.status === 'acceptee')
    .map(x => ({ x, d: (data.demandes || []).find(d => d.id === x.demande_id) })).filter(y => y.d && ['match', 'pourvue'].includes(y.d.status)) : [];
  const mercis = lau ? mercisRecus(data, me.id) : [];
  useEffect(() => {
    if (!lau) return;
    const kM = 'matchs-vus-' + me.id, kR = 'mercis-avant-' + me.id, frais = iso => !!iso && recent(iso, 2);
    let vus = lireLocal(kM);
    if (!Array.isArray(vus)) { vus = matchs.filter(y => !frais(y.x.repondu_at)).map(y => y.x.id); ecrireLocal(kM, vus); }
    let avant = lireLocal(kR);
    if (typeof avant !== 'number') { avant = mercis.filter(m => !frais(m.at)).length; ecrireLocal(kR, avant); }
    const nouveau = matchs.find(y => !vus.includes(y.x.id) && recent(y.x.repondu_at || y.x.created_at, 14) && !dejaFete(`match-${me.id}-${y.x.id}`));
    const premier = !avant && mercis[0] && !dejaFete('premier-merci-' + me.id) ? mercis[0] : null;
    if (!nouveau && !premier) return;
    const t = setTimeout(() => {
      if (!ecranLibre()) return; // le même test que les fêtes des fondateurs : une feuille qui s'en va ne compte pas
      if (nouveau) {
        const e = store.byId('profiles', nouveau.d.auteur_id), p = e?.full_name?.split(' ')[0] || 'Un étudiant';
        if (celebrate({ cle: `match-${me.id}-${nouveau.x.id}`, icon: 'check', visages: [me, e], titre: `${p} a accepté ton aide`, texte: `C’est un match pour « ${nouveau.d.titre} ». Écris-lui pour la suite, et déclare son démarrage dès qu’il a lieu.`,
          action: e ? { label: `Écrire à ${p}`, icon: 'chat', onClick: () => go('messages/' + e.id) } : null })) ecrireLocal(kM, [...vus, nouveau.x.id]);
        return;
      }
      const e = store.byId('profiles', premier.de);
      celebrate({ cle: 'premier-merci-' + me.id, icon: 'heart', titre: 'Ton premier merci', texte: 'Quelqu’un que tu as aidé t’a laissé ce mot :', citation: { txt: premier.txt, de: e }, ok: 'Avec plaisir' });
    }, 900);
    return () => clearTimeout(t);
  }, [matchs.map(y => y.x.id).join(), mercis.length]);
}

// « À faire » sur l'accueil : une seule ligne pour les messages qui attendent une réponse
// (la conversation déjà sur la carte du haut n'est pas redite) ; le nombre de messages non lus en pastille
function ligneMessages({ data, me, store, go }, exclure) {
  const att = conversations(data, me.id).filter(c => c.nonLus && !exclure.has(c.autre));
  if (!att.length) return null;
  // Le prénom d'un membre ; l'administration de l'école garde son nom entier (« Bureau des relations entreprises »)
  const p = c => { const x = store.byId('profiles', c.autre); return !x?.full_name ? 'Un membre' : x.role === 'admin' ? x.full_name : x.full_name.split(' ')[0]; };
  const reste = att.length - 2;
  const text = att.length === 1 ? `${p(att[0])} t’a écrit` : att.length === 2 ? `${p(att[0])} et ${p(att[1])} t’ont écrit` : `${p(att[0])}, ${p(att[1])} et ${reste > 1 ? `${reste} autres` : '1 autre'} t’ont écrit`;
  return { key: 'msgs', icon: 'chat', tone: 'accent', text, n: att.reduce((t, c) => t + c.nonLus, 0), onClick: () => go(att.length === 1 ? 'messages/' + att[0].autre : 'messages') };
}

// « Pour toi » : combien d'offres m'attendent, avec les logos des premières ; les offres elles-mêmes sont dans Offres
function OffresPourToi({ ctx, offres, jeunes }) {
  if (!offres.length) return null;
  const n = offres.length, neuves = offres.filter(o => Date.now() - new Date(o.created_at) < 7 * 864e5).length;
  const noms = [...new Set(offres.map(o => o.entreprise).filter(Boolean))].slice(0, 3);
  return html`<button type="button" class="impact-strip clickable pto" onClick=${() => ctx.go('offres')}>
    <span class="pto-logos" aria-hidden="true">${noms.map(e => html`<${CompanyLogo} key=${e} name=${e} size=${34}/>`)}</span>
    <span class="grow pto-txt"><strong>${n > 1 ? `${n} offres pour toi` : '1 offre pour toi'}</strong>
      <span class="small muted">${neuves ? (neuves > 1 ? `Dont ${neuves} nouvelles cette semaine` : 'Dont 1 nouvelle cette semaine') : jeunes ? 'Faites pour les jeunes diplômés' : 'Tu n’y as pas encore postulé'}</span></span>
    <${Icon} name="arrow" size=${18}/></button>`;
}

function Home(ctx) {
  const { data, me, saison, scores, store, go, openProfile, openOffer, notifs = [], openNotif } = ctx;
  const n = niveauOf(me, saison);
  const st = useMemo(() => seasonStats(data, saison), [data, saison]);
  const first = me.full_name.split(' ')[0];
  const [compose, setCompose] = useState(false);
  const [plus, setPlus] = useState(false);
  // Une instance par membre (key) : ce qui est gardé dans ce navigateur ne passe jamais d'un compte à l'autre
  const [off, setOff] = useLocal('guide-off-' + me.id, false);
  const [voirEtapes, setVoirEtapes] = useState(false);
  // Ordinateur : la colonne de droite reste en vue, collée sous la barre du haut si elle tient dans l'écran,
  // sinon par le bas une fois lue jusqu'au bout (sa hauteur et celle de la barre du haut sont mesurées ici)
  const cote = useRef(null);
  useEffect(() => {
    const el = cote.current, haut = document.querySelector('.top');
    if (!el || typeof ResizeObserver === 'undefined') return;
    const mesurer = () => { el.style.setProperty('--cote-h', el.offsetHeight + 'px'); if (haut) el.style.setProperty('--haut-h', haut.offsetHeight + 'px'); };
    const ro = new ResizeObserver(mesurer); ro.observe(el); if (haut) ro.observe(haut);
    return () => ro.disconnect();
  }, []);
  // 1080 px et plus : « Lauréat du mois » et « L'école en ce moment » passent sous « Pour toi » (colonnes équilibrées)
  const [large, setLarge] = useState(() => typeof matchMedia === 'function' && matchMedia('(min-width: 1080px)').matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    // Un peu d'attente : une largeur qui ne fait que passer (capture, rotation) ne déplace rien
    let t = 0;
    const m = matchMedia('(min-width: 1080px)'), f = () => { clearTimeout(t); t = setTimeout(() => setLarge(m.matches), 200); };
    m.addEventListener?.('change', f);
    return () => { clearTimeout(t); m.removeEventListener?.('change', f); };
  }, []);
  const isStudent = me.role === 'etudiant', isLaureat = me.role === 'laureat';
  const enRecherche = isLaureat && !!me.en_recherche;
  const guide = guideEtapes(ctx, setCompose);
  useFetePremiersPas(me, guide);
  // Menu « Comment ça marche ? » (#accueil/etapes) : les premiers pas reviennent ; l'écran est la feuille, Retour ou la croix ramènent à l'accueil
  const parRoute = ctx.sub === 'etapes';
  useEffect(() => { if (parRoute) setOff(false); }, [parRoute]);
  const enCours = !off && guide && !guide.fini ? guide : null;
  const stu = isStudent ? statutOf(data, me, saison) : null;
  // Un lauréat qui cherchait un emploi confirme aussi son recrutement
  const plAttente = isStudent ? (stu.pl?.status === 'en_attente' ? stu.pl : null) : isLaureat ? data.placements.find(p => p.student_id === me.id && p.status === 'en_attente') : null;
  const helper = plAttente?.laureat_id ? store.byId('profiles', plAttente.laureat_id) : null;
  const besoins = isLaureat ? besoinsDeMoi(data, me, id => store.byId('profiles', id), { ignorees: mentoratIgnorees() }) : [];
  const pas = prochainPas({ ...ctx, setCompose }, notifs, enCours?.suivante || null, { plAttente, helper, besoins });
  const faite = useEtapeFaite(me, enCours, pas);
  useFetesLaureat(ctx);
  // Juste après la « Dernière étape » : une feuille d'accueil, une fois, avec le même bouton que la carte
  const [arrivee, finArrivee] = useArrivee(ctx);
  // « À faire » : les messages qui attendent une réponse (une ligne), puis les petites tâches, trois lignes au plus,
  // jamais ce que montre la carte ; pas « Ajoute une photo » quand l'accueil propose déjà la photo trouvée dans le CV
  const [photoCV, setPhotoCV] = useState(false);
  const taches = petitesTaches(notifs, pas).filter(t => !photoCV || t.key !== 'ph');
  const lignes = [ligneMessages(ctx, new Set([pas.ref].filter(Boolean))), ...taches].filter(Boolean).slice(0, 3);
  // Ce que l'accueil a déjà dit : les blocs suivants le sautent
  const montres = new Set([pas.ref, ...lignes.flatMap(t => [t.ref, t.offer])].filter(Boolean));
  const meta = isStudent ? [NIVEAUX[n]?.label, filiereCourte(me.filiere)].filter(Boolean).join(' · ') : isLaureat ? `Promo ${me.promo}` : '';
  // « Pour toi » : les offres de mon année où je n'ai pas postulé (étudiant), ou faites pour moi (lauréat qui cherche un emploi)
  const pourToi = isStudent ? recoFor(ctx, 99).map(x => x.o) : enRecherche ? data.offers.filter(o => o.status === 'ouverte' && !partageExpire(o) && matchesMe(o, me, saison)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) : [];
  const star = ctx.star;
  const starHelped = star ? data.placements.filter(p => p.laureat_id === star.p.id && p.status === 'confirme' && !p.demande_id).length : 0;
  const merci = mercisPublics(data)[0];
  const obj = OBJECTIFS[n];
  const s = scores.get(me.id);
  const myApps = data.applications.filter(a => a.student_id === me.id);
  const h = new Date().getHours();
  // Un lauréat devient membre fondateur par sa première aide aux étudiants : la fête, puis « Ton nom sur la page d'entrée ? »
  const feuilleFondateur = useFondateurMoi(ctx);

  // Le réseau en chiffres (lauréats et admin) : sur ordinateur, sous « Pour toi » ; ailleurs, avec le reste du réseau
  const ecole = isStudent ? [] : [
    star && star.pts ? html`<div class="panel star" key="star">
            <p class="eyebrow"><${Icon} name="trophy" size=${14}/> Lauréat du mois</p>
            <${Person} p=${star.p} score=${scores.get(star.p.id)} onOpen=${openProfile} size=${48}/>
            <p class="small">${starHelped > 1 ? `${starHelped} étudiants recrutés grâce à ses offres. Merci !` : starHelped === 1 ? '1 étudiant recruté grâce à ses offres. Merci !' : 'Merci pour son aide ce mois-ci.'}</p>
          </div>` : null,
    st.viaTotal ? html`<button class="panel pulse clickable" key="pulse" onClick=${() => go('suivi')}>
            <div class="section-head"><h3>L’école en ce moment</h3><${Icon} name="arrow" size=${16}/></div>
            ${st.rows.map(r => html`<div class="pulse-row"><span class="niv-badge">${NIVEAUX[r.n].short}</span><div class="pulse-bar"><div class="row small"><span>${r.objectif.court}</span><span class="spacer"></span><span class="mono">${pct(r.rate)}</span></div><${Bar} value=${r.rate}/></div></div>`)}
            <p class="small muted">${st.viaTotal > 1 ? `${st.viaTotal} réussites vérifiées grâce aux lauréats cette année.` : '1 réussite vérifiée grâce aux lauréats cette année.'}</p>
          </button>` : null,
  ];
  // Chaque chose à sa place, de haut en bas : bonjour, la prochaine étape, où j'en suis, « À faire » (ce qui m'attend,
  // trois lignes au plus, le reste dans la cloche), les fondateurs, « Pour toi » (ce qui me concerne), puis « Dans le réseau »
  // (ce qui se passe pour tout le monde). Rien n'est dit deux fois ; un bloc vide disparaît avec son titre.
  return html`<section class="page home">
    <div class="home-cols">
    <div class="home-col">
      <header class="hello home-hero sky">
        <div class="hello-txt">
          <h1>${MOMENT(h)} ${first}</h1>
          ${meta ? html`<p class="hello-meta">${meta}</p>` : null}
          <p class="hello-sub">${isStudent ? 'Les lauréats de l’école sont là pour t’aider.' : isLaureat ? (enRecherche ? 'Le réseau t’aide à trouver ton poste, et ton expérience aide déjà les étudiants.' : 'Merci de garder la porte ouverte aux étudiants de l’école.') : 'Tout le réseau de l’école, en un coup d’œil.'}</p>
        </div>
        <${SchoolScene} align=${getLang() === 'ar' ? 'xMinYMax' : 'xMaxYMax'} pose=${10000}/>
      </header>

      <${ProchainPas} pas=${pas} progres=${enCours} faite=${faite} onEtapes=${() => setVoirEtapes(true)}/>
      ${isStudent && obj ? html`<button class=${'objective compact clickable avancement st-' + stu.key} onClick=${() => go('parcours')}>
        <div class="objective-top"><span class="obj-ico"><${Icon} name="route" size=${22}/></span>
          <div class="objective-main"><p class="eyebrow">Mon objectif de l’année</p><h2>${obj.titre}</h2></div>
          <span class=${'state-pill s-' + stu.key}>${stu.label}</span></div>
        <${Journey} step=${journeyStep(stu, myApps)}/>
      </button>` : null}
      ${isLaureat && s && s.recrutes + s.mentorats ? html`<button class="impact-strip clickable avancement" onClick=${() => go('espace')}><span class="obj-ico brass"><${Icon} name="heart" size=${20}/></span><span class="grow" style="min-width:0">${s.recrutes + s.mentorats > 1 ? `Tu as aidé ${s.recrutes + s.mentorats} étudiants` : 'Tu as aidé 1 étudiant'}</span><${LevelChip} points=${s.points}/><${Icon} name="arrow" size=${18}/></button>` : null}
      <section class="bloc af-accueil" aria-labelledby="h-afaire">
        <h2 class="h-sec" id="h-afaire">À faire</h2>
        <div class="bloc-corps">${lignes.length ? html`<ul class="todo">${lignes.map(a => html`<li key=${a.key}><button type="button" class="notif act" onClick=${a.onClick || (() => openNotif(a))}><span class=${'n-ico ' + (a.tone || '')} aria-hidden="true"><${Icon} name=${a.icon} size=${16}/></span><span>${a.text}</span>${a.n ? html`<span class="af-n" aria-hidden="true">${a.n}</span>` : null}<${Icon} name="arrow" size=${16}/></button></li>`)}</ul>
          ${ctx.todo > lignes.length ? html`<button type="button" class="linkish af-tout" aria-haspopup="dialog" onClick=${ctx.ouvrirCloche}>${`Tout voir (${ctx.todo})`}</button>` : null}` : null}</div>
      </section>
      <${AnnonceBanner} key=${'an-' + me.id} ctx=${ctx}/>
      <${FondateursBandeau} ctx=${ctx} onPublier=${() => setCompose(true)}/>
    </div>

    <div class="home-grid">
      <div class="home-main bloc">
        <h2 class="h-sec">Pour toi</h2>
        <div class="bloc-corps">
        <${GraceAToi} ctx=${ctx}/>
        <${PhotoProposee} ctx=${ctx} onTrouvee=${setPhotoCV}/>
        <${IlsOntBesoin} ctx=${ctx} besoins=${besoins.filter(b => !montres.has(b.id))}/>
        <${NextRdv} ctx=${ctx} exclure=${montres}/>
        <${MatchAccueil} ctx=${ctx}/>
        <${ConfianceHome} ctx=${ctx}/>
        <${AmbassadeurAccueil} ctx=${ctx} pasKey=${pas.key}/>
        <${CoupDeMain} ctx=${ctx} exclure=${montres} cle=${{ 'guide-demande': 'demande', 'guide-conseil': 'conseil' }[pas.key] || null}/>
        <${OffresPourToi} ctx=${ctx} offres=${pourToi} jeunes=${enRecherche}/>
        <${TonAnneeStrip} ctx=${ctx} onOpen=${ctx.openAnnee}/>
        <${NudgeAvis} ctx=${ctx}/>
        <${DevenirParrain} ctx=${ctx}/>
        </div>
      </div>
      <div class="home-side" ref=${cote}>
        <section class="bloc reseau-semaine" aria-labelledby="h-reseau">
          <h2 class="h-sec" id="h-reseau">Dans le réseau</h2>
          <div class="bloc-corps">
          <${PoulsReseau} ctx=${ctx} accueil onOpen=${() => go(isStudent || isLaureat ? 'mentorat' : 'suivi')}/>
          <${CaBouge} ctx=${ctx}/>
          ${merci ? html`<div class="panel merci-une"><p class="eyebrow"><${Icon} name="heart" size=${13}/> Un merci récent</p>
            <blockquote class="merci"><p translate="no" dir="auto">« ${merci.txt} »</p><${MerciDuo} ctx=${ctx} m=${merci}/></blockquote></div>` : html`<${SuccessFeed} ctx=${ctx} max=${1}/>`}
          </div>
        </section>
        <div class=${'bloc plus' + (plus ? ' ouvert' : '')}>
          <button type="button" class="btn ghost plus-reseau" aria-expanded=${plus} onClick=${() => setPlus(!plus)}>${plus ? 'Moins' : 'Plus du réseau'} <${Icon} name=${plus ? 'x' : 'plus'} size=${15}/></button>
          <div class="en-plus bloc-corps">
          <${NextEvent} ctx=${ctx}/>
          <${NextCafe} ctx=${ctx}/>
          ${merci ? html`<${SuccessFeed} ctx=${ctx} max=${2}/>` : null}
          ${!isStudent ? html`<${DefisPanel} ctx=${ctx}/>` : null}
          ${large ? null : ecole}
          </div>
        </div>
      </div>
      ${large && ecole.some(Boolean) ? html`<div class="home-plus">${ecole}</div>` : null}
    </div>
    </div>
    ${compose ? html`<${OfferComposer} ctx=${ctx} onClose=${() => setCompose(false)}/>` : null}
    ${feuilleFondateur}
    ${arrivee ? html`<${ArriveeSheet} a=${arrivee} pas=${pas} me=${me} store=${store} onClose=${finArrivee}/>` : null}
    ${(voirEtapes || parRoute) && guide ? html`<${EtapesSheet} me=${me} g=${guide} historique=${!parRoute} onClose=${() => { setVoirEtapes(false); if (parRoute) go('accueil'); }}
      onHide=${() => { setOff(true); setVoirEtapes(false); if (parRoute) go('accueil'); toast('C’est noté. Tu retrouves les premiers pas dans ton menu : « Comment ça marche ? ».'); }}/>` : null}
  </section>`;
}

// Premiers pas : les étapes se cochent toutes seules. « Crée ton compte » est faite d'emblée ; celles qui arrivent
// d'elles-mêmes plus tard (le merci, le recrutement) ne comptent pas. Une étape qui n'a rien à proposer aujourd'hui n'est pas montrée.
const E = (cle, icon, titre, texte, fait, go, cta, plusTard = false, pts = 0) => ({ cle, icon, titre, texte, fait: !!fait, go, cta, plusTard, pts });
function guideEtapes(ctx, setCompose) {
  const { data, me, saison, go, store, act } = ctx;
  if (me.role === 'admin') return null;
  const n = niveauOf(me, saison);
  const myApps = data.applications.filter(a => a.student_id === me.id);
  const myOffers = data.offers.filter(o => o.author_id === me.id);
  const aPostule = myApps.some(a => a.offer_id);
  const compte = E('compte', 'check', 'Crée ton compte', 'C’est fait : bienvenue dans le réseau.', true, null, '');
  let steps;
  if (me.role === 'etudiant') {
    const offresOuvertes = data.offers.some(o => o.status === 'ouverte' && o.audience !== 'laureats' && (o.annees || []).includes(n));
    steps = [compte,
      E('cv', 'file', 'Dépose ton CV en PDF', 'Il sera joint à chaque candidature, et un lauréat peut le relire pour toi.', me.cv_path || me.cv_url, () => versCV(go), 'Ajouter mon CV'),
      typesDemande(me, saison).length ? E('demande', 'send', 'Dis aux lauréats ce que tu cherches', 'Ta demande et ton CV arrivent chez les lauréats de ton parcours.', (data.demandes || []).some(d => d.auteur_id === me.id), () => go('offres/demandes/nouvelle'), 'Publier ma demande') : null,
      aPostule || offresOuvertes ? E('postule', 'feed', 'Postule à une offre', `Tu ne vois que les offres de ${NIVEAUX[n]?.short || 'ton année'}. Un message de deux phrases suffit.`, aPostule, () => go('offres'), 'Voir les offres') : null,
      E('conseil', 'mentor', 'Demande un conseil', 'Un lauréat choisit un de tes horaires et t’appelle 20 minutes en visio.', data.mentorships.some(m => m.student_id === me.id), () => ctx.askHelp(), 'Demander un conseil'),
      E('merci', 'heart', 'Confirme et dis merci', 'Quand il déclare ton recrutement, tu confirmes en un clic et tu lui laisses un mot.', data.placements.some(p => p.student_id === me.id && p.status === 'confirme' && p.merci), null, '', true),
    ];
  } else {
    const byId = id => store.byId('profiles', id);
    const cherche = !!me.en_recherche;
    const aAide = data.mentorships.some(m => m.mentor_id === me.id && m.status !== 'demande') || (data.propositions || []).some(x => x.laureat_id === me.id);
    const demandes = demandesPour(data, me, byId).filter(x => !x.mienne && x.pourMoi && AIDE_OUVERTE.includes(etatAide(data, me, x.d)));
    const aAider = requestsFor(data, me, byId).length || demandes.length;
    const pourMoi = data.offers.some(o => o.status === 'ouverte' && o.author_id !== me.id && matchesMe(o, me, saison) && peutPostulerA(o, me, saison));
    steps = [compte,
      // Jamais bloqué faute d'employeur : en poste ou en recherche, dire où il en est suffit
      E('profil', 'user', 'Complète ton profil', cherche ? 'Le poste que tu cherches : les lauréats qui recrutent te trouvent plus vite.' : 'En poste ou en recherche d’emploi : dis-le, et le réseau te trouve plus facilement.', profilLaureatFait(me), () => go('profil'), 'Compléter mon profil'),
      E('dispo', 'mentor', 'Rends-toi disponible', 'Les étudiants de ta filière pourront te demander 20 minutes de conseil.', me.mentor_dispo,
        () => act(async () => { await store.update('profiles', me.id, { mentor_dispo: true }); toast('C’est noté : les étudiants de ta filière te verront dans Mentorat.'); }), 'Me rendre disponible'),
      // Aider un étudiant qui attend avant de publier une offre : le geste le plus simple d'abord
      aAide || aAider ? E('aide', 'heart', 'Aide un étudiant', demandes.length ? (demandes[0].prox >= 1 ? 'Un étudiant de ton parcours a dit ce qu’il cherche : propose ton aide.' : 'Un étudiant de l’école attend encore une réponse : propose ton aide.') : 'Clique sur un de ses horaires : la visio et l’invitation sont prêtes.', aAide,
        demandes.length ? () => ctx.proposerAide(demandes[0].d.id) : () => go('mentorat'), demandes.length ? 'Je peux aider' : 'Voir leurs horaires') : null,
      cherche ? (aPostule || pourMoi ? E('offres', 'feed', 'Regarde les offres pour toi', 'Les offres « Jeunes diplômés » et celles partagées entre lauréats.', aPostule, () => go('offres'), 'Voir les offres pour moi') : null)
        : E('offre', 'plus', 'Publie une offre', 'Une minute suffit. Seuls les étudiants de l’année concernée la voient.', myOffers.length > 0, () => setCompose(true), 'Publier une offre'),
      cherche ? null : E('recrute', 'check', 'Déclare le recrutement', 'L’étudiant confirme en un clic et peut te laisser un mot de remerciement.', data.placements.some(p => p.laureat_id === me.id && p.status === 'confirme'), null, '', true, 50),
    ];
  }
  steps = steps.filter(Boolean);
  const comptees = steps.filter(s => !s.plusTard);
  const done = comptees.filter(s => s.fait).length, total = comptees.length, fini = done === total;
  return { steps, done, total, fini, suivante: fini ? null : comptees.find(s => !s.fait && s.go) || null };
}

// Sous le titre, les puces qui mènent à chaque partie (photo et CV, infos, coordonnées, qui voit quoi, notifications, données)
// (import gardé ici, avec Mon profil : le haut du fichier appartient à l'accueil)
import { SautsProfil } from './community.js';
function MyProfile({ ctx }) {
  const { me, store } = ctx;
  return html`<section class="page narrow">
    <header class="page-head"><div><p class="eyebrow">Jamais public</p><h1>Mon profil</h1></div>
      ${store.mode === 'live' ? html`<button class="btn ghost" onClick=${() => store.signOut()}><${Icon} name="logout"/> Se déconnecter</button>` : null}</header>
    <${SautsProfil} key=${me.id}/>
    <${PhotoCard} ctx=${ctx}/>
    <${CvCard} ctx=${ctx}/>
    <${MatchVisible} ctx=${ctx}/>
    <${ProfileForm} ctx=${ctx} initial=${me} key=${me.id}/>
    <${MesDonnees} ctx=${ctx}/>
  </section>`;
}

// ---------------------------------------------------------------------------
// Connexion et inscription (mode réel)
// ---------------------------------------------------------------------------

function Onboarding({ store, relang }) {
  const act = async fn => { try { await fn(); } catch (e) { toast(texteErreur(e), 'err'); } };
  const ctx = { store, act };
  // Le dernier rôle touché sur cet appareil, sinon celui donné avec la demande de code faite ici, sinon celui du lien de la promo
  const meta = store.session?.user?.user_metadata || {};
  const email = store.session?.user?.email;
  const preset = presetInscription({ choisi: roleRetenu() || roleAccord(email) || (accordIci(email) && meta.role_choisi), invite: promoInvitee(), saison: seasonOf() });
  const lien = lienRetenu();
  // La langue se change dans l'en-tête (un bouton fixe recouvrirait le titre sur téléphone)
  return html`<main class="auth"><div class="auth-card wide onb">
    <div class="row onb-tete"><${BrandLogo} size=${44}/><div><p class="eyebrow">Dernière étape</p><h2>Présente-toi à la communauté</h2></div><${LangToggle} onChange=${relang}/></div>
    ${lien ? html`<p class="lien-suite small" id="onb-lien"><${Icon} name="arrow" size=${15}/><span>${suiteLien(lien)}</span></p>` : null}
    <p class="muted">Quelques secondes, et tu es dans le réseau.</p>
    <${ProfileForm} ctx=${ctx} preset=${preset} onboarding onInscrit=${() => marquerArrivee(store.userId)} onDone=${() => marquerArrivee(store.userId)}/>
    <button class="linkish small" onClick=${() => store.signOut()}>Se déconnecter</button>
  </div><${Toaster}/></main>`;
}

// ---------------------------------------------------------------------------
(async () => {
  const root = document.getElementById('app');
  try {
    // Le magasin déjà prêt pour la page d'entrée, sinon on le crée ; l'arabe se charge en même temps que les données
    // (sur la page d'entrée, ses phrases sont déjà traduites : on ne repasse pas en français pour une coupure)
    const [store] = await Promise.all([magasinEntree() || createStore(), getLang() === 'ar' ? chargerAR().catch(() => { if (!document.getElementById('entree')) return setLang('fr', { garder: false }); }) : null]);
    brancherPhotos(path => store.photo(path));
    brancherSignal(m => toast(m, 'err'));
    // Connecté : ce qui avait été tapé sur la page d'entrée ne doit jamais revenir après une déconnexion
    if (store.session) { marquerMembre(); cacherEntree(true); try { sessionStorage.removeItem('ensam-entree-saisie'); } catch { /* */ } }
    try { sessionStorage.removeItem('ensam-essais'); sessionStorage.removeItem('ensam-rechargements'); } catch { /* */ }
    root.innerHTML = '';
    render(html`<${App} store=${store}/>`, root);
    window.ENSAM_APP = true;
  } catch (e) {
    console.error(e);
    const reseau = !navigator.onLine || texteErreur(e).startsWith('Pas de réseau');
    // Fichiers gardés sur le téléphone abîmés ou d'une ancienne version (une erreur de code, pas une coupure réseau) :
    // on les oublie et on recharge, une seule fois
    try {
      if (!reseau && /^(SyntaxError|TypeError|ReferenceError)$/.test(e?.name) && 'serviceWorker' in navigator && navigator.serviceWorker.controller && !sessionStorage.getItem('ensam-reprise')) {
        sessionStorage.setItem('ensam-reprise', '1');
        for (const k of await caches.keys()) await caches.delete(k);
        for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
        return location.reload();
      }
    } catch { /* on affiche l'écran calme */ }
    // Jamais de message technique : un écran calme, et on réessaie tout seul quand le réseau revient (3 fois au plus)
    root.innerHTML = '';
    render(html`<div class="fatal" role="alert"><${BrandLogo} size=${56}/><h1>Pas de connexion pour l’instant</h1><p>Vérifie ton réseau : on réessaie tout seul dans un instant.</p><p><button class="btn primary" onClick=${() => location.reload()}>Réessayer</button></p></div>`, root);
    addEventListener('online', () => location.reload(), { once: true });
    try {
      const n = +(sessionStorage.getItem('ensam-essais') || 0);
      if (n < 3) setTimeout(() => { try { sessionStorage.setItem('ensam-essais', n + 1); } catch { /* */ } location.reload(); }, 15000);
    } catch { /* */ }
  }
})();
