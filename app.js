// Point d'entrée : coque de l'application, connexion, accueil, notifications.
import { getLang, setLang, chargerAR } from './i18n.js';
import { html, render, useState, useEffect, useMemo, useRef } from './vendor/preact-htm.js';
import { createStore } from './store.js';
import { Icon, Field, Empty, Person, Avatar, Bar, Toaster, toast, Confirm, LevelChip, BrandLogo, SchoolScene, Num, useLocal, Celebration, celebrate, voirRangs } from './ui.js';
import { seasonOf, seasonLabel, niveauOf, NIVEAUX, OBJECTIFS, FOUND, statutOf, seasonStats, computeScores, starOfMonth, fondateursOf, mentorState, requestsFor, timeAgo, pct, routedTo, needsRelance, myGroups, groupKey, enqueteDue, TYPES_EVENEMENT, conversations, offerMatch } from './logic.js';
import { OffersPage, OfferCard, OfferDetail, OfferComposer, RecoOffers, matchesMe, APP_STATUS } from './offers.js';
import { ParcoursPage, EspacePage, ConfirmRecruit, Journey, journeyStep } from './me.js';
import { DashboardPage } from './dashboard.js';
import { ReseauPage, ProfileModal, ProfileForm, AskQuestion } from './community.js';
import { AdminPage, AnnonceBanner } from './admin.js';
import { MentoratPage, AskHelp, NextRdv, HelpNeeded, slotWhen } from './mentorat.js';
import { SuccessFeed, VerifyPage } from './growth.js';
import { PrivacyPage, ConsentModal, MesDonnees, DesaboPage } from './privacy.js';
import { useInstall, IosInstallHelp } from './pwa.js';
import { NextCafe } from './groupes.js';
import { EntrepriseModal } from './pro.js';
import { DefisPanel, CoupePromos, ParrainCard, DevenirParrain, TonAnnee, TonAnneeStrip } from './saison.js';
import { AlerteTalents } from './recrutement.js';
import { CvCard, RelecturesHome } from './cv.js';
import { NudgeAvis } from './entreprises.js';
import { ConfianceHome } from './confiance.js';
import { EnquetePage, EnqueteCard } from './enquete.js';
import { NextEvent } from './agenda.js';
import { lireInvitation, promoInvitee, roleDePromo } from './invitation.js';
import { MessagesPage, MessagesHome, useAlerteMessages } from './messages.js';
import { PoulsReseau } from './pouls.js';

const ROUTES = ['accueil', 'offres', 'mentorat', 'messages', 'parcours', 'espace', 'reseau', 'suivi', 'profil', 'admin', 'verifier', 'confidentialite', 'desabo', 'enquete', 'offre'];
const ALIASES = { impact: 'espace', tableau: 'suivi', communaute: 'reseau', entraide: 'reseau/entraide', groupes: 'reseau/groupes', sujets: 'offres/sujets', 'reseau/mentorat': 'mentorat', 'reseau/mentorat/rdv': 'mentorat', agenda: 'reseau/agenda', entreprises: 'reseau/entreprises', etranger: 'reseau/etranger', relecture: 'mentorat/cv', cv: 'mentorat/cv', moderation: 'admin/moderation', message: 'messages', chat: 'messages' };

function navFor(me) {
  const items = [['accueil', 'Accueil', 'home'], ['offres', 'Offres', 'feed'], ['mentorat', 'Mentorat', 'mentor'], ['messages', 'Messages', 'chat']];
  if (me.role === 'etudiant') items.push(['parcours', 'Mon parcours', 'route']);
  else if (me.role === 'laureat') items.push(['espace', 'Mon espace', 'star']);
  items.push(['reseau', 'Réseau', 'network'], ['suivi', me.role === 'etudiant' ? 'Ma promo' : 'Suivi', 'chart']);
  if (me.role === 'admin') items.push(['admin', 'Admin', 'shield']);
  return items;
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
  const [pop, setPop] = useState(null); // 'bell' | 'me'
  const seen = useRef(null); const lastAct = useRef(0);
  useEffect(() => store.on(() => setTick(t => t + 1)), []);
  useEffect(() => { const f = () => setRoute(readRoute()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => { if (!pop) return; const f = e => { if (!e.target.closest('.pop-wrap')) setPop(null); }; document.addEventListener('click', f); return () => document.removeEventListener('click', f); }, [pop]);
  // Changement d'écran : un fondu court (View Transitions) là où le navigateur le permet
  const go = r => {
    try { history.replaceState(null, '', '#' + r); } catch { /* cadre */ }
    const changer = () => { setRoute(parseRoute(r)); setPop(null); window.scrollTo?.(0, 0); };
    const doux = document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches && parseRoute(r).base !== route.base;
    if (doux) document.startViewTransition(() => new Promise(ok => { changer(); setTimeout(ok, 0); }));
    else changer();
  };
  // Les blocs arrivent en cascade au premier affichage seulement
  const [premier, setPremier] = useState(true);
  useEffect(() => { const t = setTimeout(() => setPremier(false), 1600); return () => clearTimeout(t); }, []);
  const [entreprise, setEntreprise] = useState(null);
  const [askQ, setAskQ] = useState(null);
  const [annee, setAnnee] = useState(null);
  const [iosHelp, setIosHelp] = useState(false);
  const install = useInstall();
  // Lien direct vers une offre (alertes par email et notifications) : #offre/<id>
  useEffect(() => { if (route.base === 'offre' && route.sub) { setOfferId(route.sub); setApplyNow(false); go('offres'); } }, [route.base, route.sub]);

  const data = store.data;
  const me = store.me;
  const saison = seasonOf();
  const scores = useMemo(() => computeScores(data), [data.offers, data.applications, data.comments, data.placements, data.mentorships, data.answers, data.questions, data.votes]);
  const monthScores = useMemo(() => computeScores(data, new Date(Date.now() - 30 * 864e5)), [data]);
  const star = useMemo(() => starOfMonth(data, monthScores), [data, monthScores]);
  const fondateurs = useMemo(() => fondateursOf(data.profiles), [data]);

  // Temps réel : une nouvelle notification venue d'un autre membre s'affiche aussi en bas de l'écran
  const latest = useRef(null);
  useEffect(() => {
    const cur = latest.current; latest.current = null;
    if (!cur) return;
    const { notifs, todo, me: who } = cur;
    const keys = new Set(notifs.map(n => n.key).filter(Boolean));
    const prev = seen.current;
    if (prev && prev.id === who.id && Date.now() - lastAct.current > 2500) {
      const fresh = notifs.find(n => n.key && !prev.keys.has(n.key) && (n.action || n.tone === 'good'));
      if (fresh) toast(fresh.text);
    }
    seen.current = { id: who.id, keys };
    const n = todo + (cur.msgs || 0);
    try { document.title = (n ? `(${n}) ` : '') + 'Réseau ENSAM Meknès'; } catch { /* */ }
  });

  // Un message reçu pendant qu'on est ailleurs : un petit mot en bas de l'écran
  useAlerteMessages(store, me, route);

  const relang = () => setTick(t => t + 1);
  // Pages publiques, sans compte : vérification d'une attestation, désabonnement des emails, confidentialité
  if (route.base === 'verifier') return html`<main class="auth verify-wrap"><div class="auth-lang"><${LangToggle} onChange=${relang}/></div><${VerifyPage} store=${store} id=${route.sub}/></main>`;
  if (route.base === 'desabo') return html`<main class="auth verify-wrap"><div class="auth-lang"><${LangToggle} onChange=${relang}/></div><${DesaboPage} store=${store} token=${route.sub} quoi=${route.sub2}/></main>`;
  if (route.base === 'confidentialite' && (store.mode !== 'live' || !store.session || !me)) return html`<main class="auth verify-wrap privacy-wrap"><div class="auth-lang"><${LangToggle} onChange=${relang}/></div><${PrivacyPage} onBack=${() => { history.back(); setTimeout(() => setRoute(readRoute()), 50); }}/></main>`;
  if (store.mode === 'live' && !store.session) return html`<${AuthScreen} store=${store} relang=${relang}/>`;
  if (store.mode === 'live' && !me) return html`<${Onboarding} store=${store} relang=${relang}/>`;

  // Le bouton qui lance l'action attend sa fin (grisé, petit cercle) : pas de double envoi sur une connexion lente
  const act = async fn => {
    lastAct.current = Date.now();
    const b = document.activeElement?.closest?.('button.btn');
    if (b?.getAttribute('aria-busy') === 'true') return;
    b?.setAttribute('aria-busy', 'true');
    try { await fn(); } catch (e) { toast(e.message || String(e), 'err'); } finally { b?.removeAttribute('aria-busy'); }
    lastAct.current = Date.now();
  };
  voirRangs(me.role !== 'etudiant');
  const ctx = {
    store, data, me, saison, scores, go, act, sub: route.sub, sub2: route.sub2, star, starId: star?.p.id, fondateurs,
    openProfile: p => p && setProfile(p),
    openOffer: (id, apply = false) => { setOfferId(id); setApplyNow(apply); setPop(null); },
    confirm: (text, onYes, yes) => setConfirmBox({ text, onYes, yes }),
    openEntreprise: name => name && setEntreprise(name),
    askQuestion: initial => setAskQ(initial || {}),
    askHelp: p => setAskMentor(p),
    openAnnee: s => setAnnee(s || saison),
    ecrire: id => { setProfile(null); setOfferId(null); setPop(null); go('messages/' + id); },
  };
  const notifs = buildNotifs(ctx);
  const todo = notifs.filter(n => n.action).length;
  const msgs = store.nonLus();
  latest.current = { notifs, todo, me, msgs };
  const nav = navFor(me);
  // En bas sur le téléphone : cinq onglets au plus. Les messages ont leur bulle en haut, le suivi passe dans le menu.
  const navBas = nav.filter(([k]) => k !== 'messages' && k !== 'suivi');
  let page = route.base === 'offre' ? 'offres' : route.base;
  if (page === 'parcours' && me.role !== 'etudiant') page = me.role === 'laureat' ? 'espace' : 'accueil';
  if (page === 'espace' && me.role !== 'laureat') page = me.role === 'etudiant' ? 'parcours' : 'accueil';
  if (page === 'admin' && me.role !== 'admin') page = 'accueil';
  const needConsent = store.mode === 'live' && !me.consent_at && !['confidentialite', 'profil'].includes(page);
  const openNotif = n => { setPop(null); if (n.offer) ctx.openOffer(n.offer); else if (n.profile) { const p = store.byId('profiles', n.profile); if (p) setProfile(p); else go(n.to || 'accueil'); } else go(n.to); };
  const dotFor = k => ((k === 'parcours' || k === 'espace') && notifs.some(n => n.action && n.mine)) || (k === 'mentorat' && notifs.some(n => n.action && n.to === 'mentorat'));
  const plein = page === 'messages';

  return html`<div class=${'shell' + (premier ? ' premier' : '')}>
    <a class="skip" href="#contenu" onClick=${e => { e.preventDefault(); document.getElementById('contenu')?.focus(); }}>Aller au contenu</a>
    <aside class="side">
      <a class="brand" href="#accueil" onClick=${e => { e.preventDefault(); go('accueil'); }}><${BrandLogo} size=${40}/><span class="brand-txt"><strong>Réseau ENSAM</strong><span>Meknès · Lauréats & étudiants</span></span></a>
      <nav class="side-nav">${nav.map(([k, l, i]) => html`<a href=${'#' + k} class=${page === k ? 'on' : ''} onClick=${e => { e.preventDefault(); go(k); }}><span class="nav-ico"><${Icon} name=${i}/></span> ${l}${k === 'messages' && msgs ? html`<span class="nav-n"><span aria-hidden="true">${msgs}</span><span class="sr-only">${msgs > 1 ? `${msgs} messages non lus` : '1 message non lu'}</span></span>` : dotFor(k) ? html`<span class="dotn"></span>` : null}</a>`)}</nav>
      <div class="side-foot"><span class="mono small muted">Saison ${seasonLabel(saison)}</span><a class="small muted" href="#confidentialite" onClick=${e => { e.preventDefault(); go('confidentialite'); }}>Confidentialité</a></div>
    </aside>
    <div class=${'main' + (plein ? ' full' : '')}>
      <header class="top">
        <a class="brand mobile-only" href="#accueil" aria-label="Réseau ENSAM · Accueil" onClick=${e => { e.preventDefault(); go('accueil'); }}><${BrandLogo} size=${34}/><strong>Réseau ENSAM</strong></a>
        <span class="spacer"></span>
        ${store.mode === 'demo' ? html`<${PersonaSwitch} store=${store} go=${go}/>` : null}
        <${ThemeToggle} onChange=${relang}/>
        <a class=${'icon-btn chat-top mobile-only' + (page === 'messages' ? ' on' : '')} href="#messages" aria-label=${msgs ? `Messages (${msgs} non lus)` : 'Messages'} onClick=${e => { e.preventDefault(); go('messages'); }}><${Icon} name="chat"/>${msgs ? html`<span class="badge-n">${msgs}</span>` : null}</a>
        <${LangToggle} onChange=${relang} store=${store} me=${me}/>
        <div class="pop-wrap"><button class="icon-btn" aria-label=${`Notifications (${todo} à traiter)`} aria-expanded=${pop === 'bell'} onClick=${() => setPop(pop === 'bell' ? null : 'bell')}><${Icon} name="bell"/>${todo ? html`<span class="badge-n">${todo}</span>` : null}</button>
          ${pop === 'bell' ? html`<div class="bell-pop" role="menu"><h3>Notifications</h3>${notifs.length ? notifs.slice(0, 14).map(n => html`<button class=${'notif' + (n.action ? ' act' : '')} onClick=${() => openNotif(n)}><span class=${'n-ico ' + (n.tone || '')}><${Icon} name=${n.icon} size=${16}/></span><span>${n.text}<span class="muted small">${timeAgo(n.at)}</span></span></button>`) : html`<p class="muted small">Rien de nouveau.</p>`}</div>` : null}
        </div>
        <div class="pop-wrap"><button class="me-btn" onClick=${() => setPop(pop === 'me' ? null : 'me')} aria-label="Mon compte" aria-expanded=${pop === 'me'}><${Avatar} p=${me} size=${34}/></button>
          ${pop === 'me' ? html`<div class="menu-pop right" role="menu">
            <div class="menu-who"><strong>${me.full_name}</strong><span class="muted small">${me.role === 'etudiant' ? 'Étudiant(e)' : me.role === 'laureat' ? 'Lauréat(e)' : 'Administration'}</span></div>
            <button onClick=${() => go('profil')}><${Icon} name="user" size=${16}/> Mon profil</button>
            <button class="menu-mobile" onClick=${() => go('suivi')}><${Icon} name="chart" size=${16}/> ${me.role === 'etudiant' ? 'Ma promo' : 'Suivi'}</button>
            <button onClick=${() => { try { localStorage.removeItem('guide-off-' + me.id); } catch { /* */ } go('accueil'); }}><${Icon} name="route" size=${16}/> Comment ça marche ?</button>
            ${me.role !== 'admin' ? html`<button onClick=${() => { setPop(null); ctx.openAnnee(); }}><${Icon} name="award" size=${16}/> Ton année dans le réseau</button>` : null}
            ${install ? html`<button onClick=${() => { setPop(null); install.ios ? setIosHelp(true) : install.prompt(); }}><${Icon} name="download" size=${16}/> Installer l’application</button>` : null}
            <button onClick=${() => go('confidentialite')}><${Icon} name="shield" size=${16}/> Confidentialité</button>
            <button class="menu-theme" onClick=${() => { setTheme(themeActuel() === 'dark' ? 'light' : 'dark'); setPop(null); relang(); }}><${Icon} name=${themeActuel() === 'dark' ? 'sun' : 'moon'} size=${16}/> ${themeActuel() === 'dark' ? 'Mode clair' : 'Mode sombre'}</button>
            ${themeChoisi() ? html`<button onClick=${() => { setTheme(null); setPop(null); relang(); }}><${Icon} name="sun" size=${16}/> Thème automatique (comme l’appareil)</button>` : null}
            ${me.role === 'admin' ? html`<button onClick=${() => go('admin')}><${Icon} name="shield" size=${16}/> Administration</button>` : null}
            ${store.mode === 'live' ? html`<button onClick=${() => store.signOut()}><${Icon} name="logout" size=${16}/> Se déconnecter</button>` : html`<button onClick=${async () => { setPop(null); await store.reset(); toast('Démo réinitialisée.'); }}><${Icon} name="spark" size=${16}/> Réinitialiser la démo</button>`}
          </div>` : null}
        </div>
      </header>
      ${store.mode === 'demo' && !plein ? html`<section class="demo-band" aria-label="Démo"><${Icon} name="spark" size=${15}/><span>Démo avec des données fictives. Essaie le mentorat : <b translate="no">Salma</b> demande de l’aide, <b translate="no">Youssef</b> (lauréat) clique sur un horaire, la visio est prête. Change de rôle en haut.</span></section>` : null}
      <main class=${'content' + (plein ? ' flush' : '')} id="contenu" tabindex="-1">
        ${page === 'accueil' ? html`<${Home} ...${ctx} notifs=${notifs} openNotif=${openNotif}/>` : null}
        ${page === 'offres' ? html`<${OffersPage} ...${ctx}/>` : null}
        ${page === 'mentorat' ? html`<${MentoratPage} ...${ctx}/>` : null}
        ${page === 'messages' ? html`<${MessagesPage} ...${ctx}/>` : null}
        ${page === 'parcours' ? html`<${ParcoursPage} ...${ctx}/>` : null}
        ${page === 'espace' ? html`<${EspacePage} ...${ctx}/>` : null}
        ${page === 'reseau' ? html`<${ReseauPage} ...${ctx}/>` : null}
        ${page === 'suivi' ? html`<${DashboardPage} ...${ctx}/>` : null}
        ${page === 'admin' ? html`<${AdminPage} ...${ctx}/>` : null}
        ${page === 'profil' ? html`<${MyProfile} ctx=${ctx}/>` : null}
        ${page === 'confidentialite' ? html`<${PrivacyPage}/>` : null}
        ${page === 'enquete' ? html`<${EnquetePage} ...${ctx}/>` : null}
      </main>
    </div>
    <nav class=${'bottom-nav' + (plein && route.sub ? ' cache' : '')}>${navBas.map(([k, l, i]) => html`<a href=${'#' + k} class=${page === k ? 'on' : ''} onClick=${e => { e.preventDefault(); go(k); }}><span class="bn-ico"><${Icon} name=${i}/>${dotFor(k) ? html`<span class="dotn"></span>` : null}</span><span>${{ 'Mon parcours': 'Parcours', 'Mon espace': 'Espace', 'Ma promo': 'Promo' }[l] || l}</span></a>`)}</nav>
    ${offerId ? html`<${OfferDetail} ctx=${ctx} id=${offerId} key=${offerId} apply=${applyNow} onClose=${() => setOfferId(null)}/>` : null}
    ${profile ? html`<${ProfileModal} ctx=${ctx} p=${profile} onClose=${() => setProfile(null)} onAskMentor=${p => { setProfile(null); setAskMentor(p); }}/>` : null}
    ${askMentor ? html`<${AskHelp} ctx=${ctx} mentor=${askMentor} onClose=${() => setAskMentor(null)}/>` : null}
    ${confirmBox ? html`<${Confirm} text=${confirmBox.text} onYes=${confirmBox.onYes} onClose=${() => setConfirmBox(null)} yes=${confirmBox.yes || 'Supprimer'}/>` : null}
    ${entreprise ? html`<${EntrepriseModal} ctx=${ctx} name=${entreprise} key=${entreprise} onClose=${() => setEntreprise(null)}/>` : null}
    ${askQ ? html`<${AskQuestion} ctx=${ctx} initial=${askQ} onClose=${() => setAskQ(null)} onDone=${id => { setAskQ(null); go('reseau/entraide/' + id); }}/>` : null}
    ${annee ? html`<${TonAnnee} ctx=${ctx} saison=${annee} onClose=${() => setAnnee(null)}/>` : null}
    ${iosHelp ? html`<${IosInstallHelp} onClose=${() => setIosHelp(false)}/>` : null}
    ${needConsent ? html`<${ConsentModal} ctx=${ctx}/>` : null}
    <${Toaster}/>
    <${Celebration}/>
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

// Bouton français / arabe, en haut à côté des notifications
export function LangToggle({ onChange, store, me }) {
  const ar = getLang() === 'ar';
  const save = l => { if (store?.mode === 'live' && me && me.langue !== l && 'langue' in me) store.update('profiles', me.id, { langue: l }).catch(() => {}); };
  return html`<button class="lang-btn" onClick=${async () => { try { await setLang(ar ? 'fr' : 'ar'); } catch { toast('Connexion trop lente : réessaie dans un instant.', 'err'); return; } save(ar ? 'fr' : 'ar'); onChange?.(); }} aria-label=${ar ? 'Passer en français' : 'التبديل إلى العربية'} lang=${ar ? 'fr' : 'ar'}>
    <${Icon} name="globe" size=${16}/><span>${ar ? 'FR' : 'ع'}</span><span class="lang-long">${ar ? 'Français' : 'العربية'}</span></button>`;
}

function PersonaSwitch({ store, go }) {
  const ps = store.personas();
  return html`<label class="persona"><span class="small muted">Voir en tant que</span>
    <select id="persona" aria-label="Voir en tant que" value=${store.me?.id} onChange=${e => { store.switchTo(e.target.value); go('accueil'); }}>${ps.map(p => html`<option value=${p.id}>${p._persona}</option>`)}</select></label>`;
}

// ---------------------------------------------------------------------------
// Notifications calculées à partir des données
// ---------------------------------------------------------------------------
const recent = (iso, days) => Date.now() - new Date(iso) < days * 864e5;

function buildNotifs({ data, me, store, saison }) {
  const out = [];
  const name = id => store.byId('profiles', id)?.full_name || 'Un membre';
  const first = id => name(id).split(' ')[0];
  // Étudiant : recrutement à confirmer, évolution des candidatures, nouvelles offres
  for (const p of data.placements) {
    if (p.student_id !== me.id) continue;
    if (p.status === 'en_attente') out.push({ key: 'pa' + p.id, action: true, mine: true, tone: 'accent', icon: 'briefcase', to: 'parcours', at: p.created_at, text: `${name(p.laureat_id)} indique t’avoir recruté(e) chez ${p.entreprise}. Confirme-le.` });
    if (p.status === 'confirme' && p.laureat_id && !p.merci) out.push({ action: true, mine: true, tone: 'brass', icon: 'heart', to: 'parcours', at: p.confirmed_at || p.created_at, text: `Ta réussite chez ${p.entreprise} est confirmée. Laisse un merci à ${first(p.laureat_id)}.` });
  }
  for (const a of data.applications) if (a.student_id === me.id && a.offer_id && a.status !== 'postule' && recent(a.updated_at || a.created_at, 21)) {
    out.push({ key: 'as' + a.id + a.status, icon: a.status === 'refuse' ? 'x' : a.status === 'entretien' ? 'people' : 'check', tone: a.status === 'refuse' ? '' : 'good', offer: a.offer_id, at: a.updated_at || a.created_at, text: `Ta candidature « ${a.titre} » : ${APP_STATUS[a.status]}.` });
  }
  if (me.role === 'etudiant') {
    for (const o of data.offers) if (o.status === 'ouverte' && matchesMe(o, me, saison) && recent(o.created_at, 7)) out.push({ icon: 'feed', offer: o.id, at: o.created_at, text: `Nouvelle offre pour toi : ${o.titre} (${o.entreprise})` });
  }
  // Lauréat : candidatures reçues, confirmations, commentaires
  const myOffers = new Map(data.offers.filter(o => o.author_id === me.id).map(o => [o.id, o]));
  for (const a of data.applications) if (myOffers.has(a.offer_id) && a.status === 'postule') out.push({ key: 'ap' + a.id, action: true, mine: true, tone: 'accent', icon: 'inbox', offer: a.offer_id, at: a.created_at, text: `Nouvelle candidature de ${name(a.student_id)} : ${myOffers.get(a.offer_id).titre}` });
  for (const p of data.placements) if (p.laureat_id === me.id && p.status === 'confirme' && recent(p.confirmed_at || p.created_at, 30)) out.push({ key: 'pc' + p.id, icon: 'trophy', tone: 'brass', to: 'espace', at: p.confirmed_at || p.created_at, text: `${name(p.student_id)} a confirmé son recrutement chez ${p.entreprise}. +50 points${p.merci ? ' et un merci' : ''}.` });
  for (const c of data.comments) if (myOffers.has(c.offer_id) && c.author_id !== me.id && recent(c.created_at, 14)) out.push({ icon: 'comment', offer: c.offer_id, at: c.created_at, text: `${name(c.author_id)} a posé une question sur ton offre : « ${c.body.slice(0, 60)}${c.body.length > 60 ? '…' : ''} »` });
  // Mentorat : demande reçue, horaire choisi, rendez-vous proche, puis merci
  for (const m of data.mentorships) {
    const st = mentorState(m);
    const w = st === 'rdv' && m.rdv_at ? slotWhen(m.rdv_at) : null;
    const soon = w && w.diff >= 0 && w.diff <= 1 ? `${w.diff === 0 ? 'aujourd’hui' : 'demain'} à ${w.time}` : null;
    const upcoming = m.rdv_at && new Date(m.rdv_at) > Date.now();
    if (m.mentor_id === me.id) {
      if (st === 'demande') out.push({ key: 'md' + m.id, action: true, tone: 'accent', icon: 'mentor', to: 'mentorat', at: m.created_at, text: `${name(m.student_id)} te demande de l’aide : ${m.sujet}` });
      if (soon) out.push({ key: 'mr' + m.id, rdv: true, action: true, tone: 'accent', icon: 'video', to: 'mentorat', at: m.accepted_at || m.created_at, text: `Rendez-vous avec ${name(m.student_id)} ${soon}` });
      if (st === 'apres') out.push({ key: 'mf' + m.id, action: true, tone: 'brass', icon: 'check', to: 'mentorat', at: m.rdv_at, text: `Ton rendez-vous avec ${first(m.student_id)} a eu lieu ? Marque-le comme terminé.` });
      if (st === 'terminee' && m.merci && recent(m.rdv_at || m.created_at, 14)) out.push({ key: 'mm' + m.id, tone: 'brass', icon: 'heart', to: 'espace', at: m.rdv_at || m.created_at, text: `${first(m.student_id)} te remercie pour le mentorat : ${m.sujet}` });
      if (st === 'annulee' && upcoming) out.push({ key: 'mx' + m.id, icon: 'x', to: 'mentorat', at: m.accepted_at || m.created_at, text: `Rendez-vous annulé : ${m.sujet}` });
    }
    if (m.student_id === me.id) {
      if (st === 'rdv' && !soon && recent(m.accepted_at || m.created_at, 10)) out.push({ key: 'sa' + m.id + m.rdv_at, icon: 'mentor', tone: 'good', to: 'mentorat', at: m.accepted_at || m.created_at, text: `${name(m.mentor_id)} a accepté ta demande : ${m.sujet}` });
      if (soon) out.push({ key: 'sr' + m.id + m.rdv_at, rdv: true, action: true, mine: true, tone: 'accent', icon: 'video', to: 'mentorat', at: m.accepted_at || m.created_at, text: `Rendez-vous avec ${name(m.mentor_id)} ${soon}` });
      if (st === 'apres') out.push({ key: 'sf' + m.id, action: true, mine: true, tone: 'brass', icon: 'heart', to: 'mentorat', at: m.rdv_at, text: `Comment s’est passé ton échange avec ${first(m.mentor_id)} ? Dis-lui merci.` });
      if (st === 'annulee' && upcoming && m.mentor_id) out.push({ key: 'sx' + m.id, icon: 'x', to: 'mentorat', at: m.accepted_at || m.created_at, text: `Rendez-vous annulé : ${m.sujet}` });
    }
  }
  // Lauréat : demandes ouvertes à tous qui lui correspondent bien (deux au plus)
  if (me.role === 'laureat') for (const { m } of requestsFor(data, me, id => store.byId('profiles', id)).filter(x => !x.direct && x.score >= 3).slice(0, 2)) {
    out.push({ key: 'mo' + m.id, tone: 'accent', icon: 'heart', to: 'mentorat', at: m.created_at, text: `${name(m.student_id)} cherche de l’aide : ${m.sujet}` });
  }
  // Invitations à postuler (étudiant)
  for (const i of data.invitations) if (i.student_id === me.id && i.status === 'envoyee' && !data.applications.some(a => a.offer_id === i.offer_id && a.student_id === me.id)) {
    const o = store.byId('offers', i.offer_id);
    if (o && o.status === 'ouverte') out.push({ key: 'in' + i.id, action: true, mine: true, tone: 'accent', icon: 'send', offer: o.id, at: i.created_at, text: `${name(i.laureat_id)} t’invite à postuler : ${o.titre}` });
  }
  // Bravos reçus sur sa réussite
  for (const p of data.placements) if (p.student_id === me.id && FOUND.has(p.status)) {
    const k = data.kudos.filter(x => x.placement_id === p.id && x.user_id !== me.id);
    const last = k.reduce((m, x) => (x.created_at > m ? x.created_at : m), '');
    if (k.length && recent(last, 14)) out.push({ icon: 'clap', tone: 'brass', to: 'accueil', at: last, text: `${k.length} bravo${k.length > 1 ? 's' : ''} pour ta réussite chez ${p.entreprise}` });
  }
  const myQ = new Set(data.questions.filter(q => q.author_id === me.id).map(q => q.id));
  for (const a of data.answers) if (myQ.has(a.question_id) && a.author_id !== me.id) out.push({ key: 'an' + a.id, tone: 'good', icon: 'qa', to: 'reseau/entraide/' + a.question_id, at: a.created_at, text: `${name(a.author_id)} a répondu à ta question.` });
  // Questions routées vers ce lauréat (son entreprise ou son pays), sans réponse de sa part
  if (me.role === 'laureat') for (const q of data.questions) if (routedTo(q, me) && recent(q.created_at, 14) && !data.answers.some(a => a.question_id === q.id && a.author_id === me.id)) {
    out.push({ key: 'qr' + q.id, action: true, tone: 'accent', icon: 'qa', to: 'reseau/entraide/' + q.id, at: q.created_at, text: `Une question pour toi sur ${q.entreprise || q.pays} : ${q.titre}` });
  }
  // Relance douce : mes offres ouvertes sans activité depuis 3 semaines
  for (const o of data.offers) if (o.author_id === me.id && needsRelance(data, o)) out.push({ key: 'ro' + o.id, action: true, mine: true, icon: 'clock', offer: o.id, at: o.relance_at || o.created_at, text: `Ton offre « ${o.titre} » est-elle toujours ouverte ?` });
  // Parrainage
  for (const x of data.parrainages) if (x.saison === saison && recent(x.created_at, 14)) {
    if (x.parrain_id === me.id) out.push({ key: 'pf' + x.id, tone: 'brass', icon: 'heart', to: 'espace', at: x.created_at, text: `${name(x.filleul_id)} (3A) est ton filleul cette année. Fais-lui signe !` });
    if (x.filleul_id === me.id) out.push({ key: 'pp' + x.id, tone: 'brass', icon: 'heart', to: 'accueil', at: x.created_at, text: `${name(x.parrain_id)}, lauréat(e) de ta filière, est ton parrain cette année.` });
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
    if (d.cible_id === me.id && d.status === 'envoyee') out.push({ key: 'dc' + d.id, action: true, mine: true, tone: 'accent', icon: 'phone', profile: d.demandeur_id, to: 'accueil', at: d.created_at, text: `${name(d.demandeur_id)} aimerait avoir tes coordonnées.` });
    if (d.demandeur_id === me.id && d.status === 'acceptee' && recent(d.repondu_at || d.created_at, 14)) out.push({ key: 'da' + d.id, tone: 'good', icon: 'phone', profile: d.cible_id, at: d.repondu_at || d.created_at, text: `${name(d.cible_id)} a accepté : ses coordonnées sont sur son profil.` });
  }
  // Relecture de CV
  for (const r of data.relectures_cv || []) {
    if (r.student_id === me.id && r.status === 'rendue' && !r.merci) out.push({ key: 'rr' + r.id, action: true, mine: true, tone: 'brass', icon: 'check', to: 'mentorat/cv', at: r.rendue_at || r.created_at, text: `${r.reviewer_id ? first(r.reviewer_id) : 'Un lauréat'} a relu ton CV. Lis ses conseils et dis merci.` });
    if (r.student_id === me.id && r.status === 'en_cours' && recent(r.pris_at || r.created_at, 7)) out.push({ key: 'rp' + r.id, tone: 'good', icon: 'eye', to: 'mentorat/cv', at: r.pris_at || r.created_at, text: `${r.reviewer_id ? name(r.reviewer_id) : 'Un lauréat'} relit ton CV.` });
    if (r.reviewer_id === me.id && r.status === 'demandee') out.push({ key: 'rd' + r.id, action: true, tone: 'accent', icon: 'eye', to: 'mentorat/cv', at: r.created_at, text: `${name(r.student_id)} te demande de relire son CV.` });
    if (r.reviewer_id === me.id && r.status === 'rendue' && r.merci && recent(r.rendue_at || r.created_at, 14)) out.push({ key: 'rm' + r.id, tone: 'brass', icon: 'heart', to: 'mentorat/cv', at: r.rendue_at || r.created_at, text: `${first(r.student_id)} te remercie pour la relecture de son CV.` });
  }
  if (me.role === 'laureat') {
    const ouvertes = (data.relectures_cv || []).filter(r => r.status === 'demandee' && !r.reviewer_id && r.student_id !== me.id);
    if (ouvertes.length) out.push({ key: 'rq' + ouvertes.length, tone: 'accent', icon: 'eye', to: 'mentorat/cv', at: ouvertes.reduce((m, r) => (r.created_at > m ? r.created_at : m), ''), text: `${ouvertes.length} CV attend${ouvertes.length > 1 ? 'ent' : ''} une relecture.` });
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
    if (inscrit && jours >= 0 && jours <= 1) out.push({ key: 'ev' + e.id + jours, action: true, tone: 'accent', icon: 'calendar', to: 'reseau/agenda/' + e.id, at: e.created_at, text: `${e.titre} : ${jours === 0 ? 'c’est aujourd’hui' : 'c’est demain'}.` });
    else if (!inscrit && recent(e.created_at, 10) && e.author_id !== me.id) out.push({ key: 'en' + e.id, tone: 'good', icon: TYPES_EVENEMENT[e.type]?.[1] || 'calendar', to: 'reseau/agenda/' + e.id, at: e.created_at, text: `${TYPES_EVENEMENT[e.type]?.[0] || 'Événement'} à l’agenda de l’école : ${e.titre}, ${quand}.` });
  }
  // Enquête d'insertion (6 et 12 mois après le diplôme)
  const due = enqueteDue(me, data.enquetes_insertion);
  if (due) out.push({ key: 'eq' + due.vague, action: true, mine: true, tone: 'brass', icon: 'chart', to: 'enquete', at: new Date().toISOString(), text: `Enquête ${due.vague} mois après le diplôme : 2 minutes pour aider l’école et les promos suivantes.` });
  // Administration : signalements à traiter
  if (me.role === 'admin') {
    const sig = (data.signalements || []).filter(x => x.status === 'ouvert');
    if (sig.length) out.push({ key: 'sg' + sig.length, action: true, tone: 'accent', icon: 'shield', to: 'admin/moderation', at: sig.reduce((m, x) => (x.created_at > m ? x.created_at : m), ''), text: `${sig.length} signalement${sig.length > 1 ? 's' : ''} à traiter.` });
  }
  return out.sort((a, b) => (b.action ? 1 : 0) - (a.action ? 1 : 0) || new Date(b.at) - new Date(a.at));
}

// ---------------------------------------------------------------------------
// Accueil : une seule prochaine étape en haut, puis « Pour toi » et « Dans le réseau ».
// Le ton reste doux : pas de liste de devoirs, pas de comparaison qui stresse.
// ---------------------------------------------------------------------------
const MOMENT = h => (h < 5 ? 'Bonsoir' : h < 18 ? 'Bonjour' : 'Bonsoir');

// La prochaine étape, une seule, choisie dans cet ordre : un rendez-vous proche, une demande d'aide qui m'est adressée,
// un message qui attend, une action à faire, puis l'étape suivante des premiers pas, puis une offre faite pour moi.
function prochainPas(ctx, notifs, guide) {
  const { data, me, store, saison, go, openOffer, openNotif } = ctx;
  const nom = id => store.byId('profiles', id)?.full_name || 'Un membre';
  const prenom = id => nom(id).split(' ')[0];
  const rdv = data.mentorships.filter(m => (m.student_id === me.id || m.mentor_id === me.id) && mentorState(m) === 'rdv' && m.rdv_at && new Date(m.rdv_at) - Date.now() < 48 * 36e5 && new Date(m.rdv_at) - Date.now() > -60 * 6e4)
    .sort((a, b) => new Date(a.rdv_at) - new Date(b.rdv_at))[0];
  if (rdv) return { type: 'rdv' };
  const md = notifs.find(n => /^md/.test(n.key || ''));
  if (md) return { icon: 'mentor', tone: 'accent', eyebrow: 'Une demande pour toi', texte: md.text, cta: 'Choisir un horaire', go: () => go('mentorat'), key: md.key };
  const conv = conversations(data, me.id).find(c => c.nonLus);
  if (conv) return { icon: 'chat', tone: 'accent', eyebrow: 'Un message t’attend', texte: conv.nonLus > 1 ? `${nom(conv.autre)} t’a écrit ${conv.nonLus} messages.` : `${nom(conv.autre)} t’a écrit.`, cta: store.byId('profiles', conv.autre)?.role === 'admin' ? 'Répondre' : `Répondre à ${prenom(conv.autre)}`, go: () => go('messages/' + conv.autre), message: true };
  const a = notifs.find(n => n.action && !n.rdv && !/^(eq|dc|md)/.test(n.key || '') && !(me.role === 'etudiant' && n.icon === 'briefcase'));
  if (a) return { icon: a.icon, tone: a.tone, eyebrow: 'Ta prochaine étape', texte: a.text, cta: 'Y aller', go: () => openNotif(a), key: a.key };
  if (guide) return { icon: guide[0], tone: 'accent', eyebrow: 'Premiers pas', texte: guide[1], detail: guide[2], cta: guide[5], go: guide[4], guide: true };
  if (me.role === 'etudiant') {
    const n = niveauOf(me, saison);
    const o = data.offers.filter(x => x.status === 'ouverte' && (x.annees || []).includes(n) && !data.applications.some(y => y.offer_id === x.id && y.student_id === me.id))
      .map(x => ({ x, s: offerMatch(x, me).score })).sort((p, q) => q.s - p.s || new Date(q.x.created_at) - new Date(p.x.created_at))[0]?.x;
    if (o) return { icon: 'spark', tone: 'accent', eyebrow: 'Une offre faite pour toi', texte: o.titre, detail: o.entreprise, cta: 'Voir l’offre', go: () => openOffer(o.id), membre: true };
  }
  if (me.role === 'laureat') {
    const n = requestsFor(data, me, id => store.byId('profiles', id)).length;
    if (n) return { icon: 'heart', tone: 'brass', eyebrow: 'Quand tu as 20 minutes', texte: n > 1 ? `${n} étudiants aimeraient un conseil.` : 'Un étudiant aimerait un conseil.', cta: 'Voir qui', go: () => go('mentorat') };
  }
  return { calme: true };
}

function Focus({ ctx, pas }) {
  if (!pas) return null;
  if (pas.type === 'rdv') return html`<div class="focus-slot"><${NextRdv} ctx=${ctx}/></div>`;
  if (pas.calme) return html`<div class="focus calme"><span class="focus-ico"><${Icon} name="check" size=${20}/></span><span class="focus-txt"><strong>Tout est à jour.</strong><span class="small muted">${ctx.me.role === 'laureat' ? 'Merci pour ce que tu fais pour les étudiants.' : 'Rien ne presse : avance à ton rythme.'}</span></span></div>`;
  return html`<div class=${'focus t-' + (pas.tone || 'accent')}>
    <span class="focus-ico"><${Icon} name=${pas.icon || 'arrow'} size=${22}/></span>
    <span class="focus-txt"><span class="eyebrow">${pas.eyebrow}</span><strong translate=${pas.membre ? 'no' : undefined} dir=${pas.membre ? 'auto' : undefined}>${pas.texte}</strong>${pas.detail ? html`<span class="small muted" translate=${pas.membre ? 'no' : undefined}>${pas.detail}</span>` : null}</span>
    <button class="btn primary" onClick=${pas.go}>${pas.cta} <${Icon} name="arrow" size=${16}/></button>
  </div>`;
}

function Home(ctx) {
  const { data, me, saison, scores, store, go, openProfile, openOffer, notifs, openNotif } = ctx;
  const n = niveauOf(me, saison);
  const st = useMemo(() => seasonStats(data, saison), [data, saison]);
  const first = me.full_name.split(' ')[0];
  const [compose, setCompose] = useState(false);
  const [plus, setPlus] = useState(false);
  const isStudent = me.role === 'etudiant', isLaureat = me.role === 'laureat';
  const guide = guideEtapes(ctx, setCompose);
  const prochaine = guide && !guide.fini ? guide.steps.find(x => !x[3] && x[4]) : null;
  const pas = prochainPas({ ...ctx, openNotif }, notifs, prochaine);
  // « Quand tu as 5 minutes » : trois petites choses au plus, sans la prochaine étape déjà en haut
  const actions = notifs.filter(x => x.action && !x.rdv && !/^(md|eq|dc)/.test(x.key || '') && !(isStudent && x.icon === 'briefcase') && x.key !== pas.key).slice(0, 3);
  const star = ctx.star;
  const starHelped = star ? data.placements.filter(p => p.laureat_id === star.p.id && p.status === 'confirme').length : 0;
  const merci = [
    ...data.placements.filter(p => p.merci && p.laureat_id).map(p => ({ from: p.student_id, to: p.laureat_id, txt: p.merci, at: p.confirmed_at || p.created_at })),
    ...data.mentorships.filter(m => m.merci && m.mentor_id).map(m => ({ from: m.student_id, to: m.mentor_id, txt: m.merci, at: m.rdv_at || m.created_at })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at))[0];
  const stu = isStudent ? statutOf(data, me, saison) : null;
  const obj = OBJECTIFS[n];
  const s = scores.get(me.id);
  const myApps = data.applications.filter(a => a.student_id === me.id);
  const helper = stu?.pl?.laureat_id ? store.byId('profiles', stu.pl.laureat_id) : null;
  const asking = data.mentorships.some(m => m.student_id === me.id && ['demande', 'acceptee'].includes(m.status));
  const h = new Date().getHours();
  // Les 25 premiers lauréats : on leur dit une fois qu'ils sont membres fondateurs (pas par-dessus une autre fenêtre)
  const fondateur = store.mode === 'live' && isLaureat && !!me.consent_at && !!ctx.fondateurs?.has(me.id);
  useEffect(() => {
    if (!fondateur) return;
    const t = setTimeout(() => {
      if (document.querySelector('.modal-back, .fete-back')) return;
      celebrate({ cle: 'fondateur-' + me.id, icon: 'award', titre: 'Tu es Membre fondateur !', texte: 'Tu fais partie des 25 premiers lauréats du réseau. Ce badge restera sur ton profil.', action: { label: 'Voir mon badge', onClick: () => go('espace') } });
    }, 1200);
    return () => clearTimeout(t);
  }, [fondateur]);

  return html`<section class="page home">
    <header class="hello home-hero sky">
      <div class="hello-txt">
        <p class="eyebrow">Saison ${seasonLabel(saison)}${isStudent ? ` · ${NIVEAUX[n]?.label} · ${me.filiere}` : isLaureat ? ` · Promo ${me.promo}` : ''}</p>
        <h1>${MOMENT(h)} ${first}</h1>
        <p class="hello-sub">${isStudent ? 'Les lauréats de l’école t’ouvrent leurs portes. Avance à ton rythme.' : isLaureat ? 'Merci de garder la porte ouverte aux étudiants de l’école.' : 'Tout le réseau de l’école, en un coup d’œil.'}</p>
      </div>
      <${SchoolScene} align=${getLang() === 'ar' ? 'xMinYMax' : 'xMaxYMax'}/>
    </header>

    ${isStudent && stu.pl?.status === 'en_attente' ? html`<${ConfirmRecruit} ctx=${ctx} pl=${stu.pl} helper=${helper}/>` : html`<${Focus} ctx=${ctx} pas=${pas}/>`}
    <${PoulsReseau} ctx=${ctx} onOpen=${() => go(isLaureat ? 'mentorat' : 'reseau')}/>

    <${AnnonceBanner} ctx=${ctx}/>
    <${TonAnneeStrip} ctx=${ctx} onOpen=${ctx.openAnnee}/>
    <${EnqueteCard} ctx=${ctx}/>
    ${pas.type === 'rdv' ? null : html`<${NextRdv} ctx=${ctx}/>`}
    ${pas.message ? null : html`<${MessagesHome} ctx=${ctx}/>`}
    <${ConfianceHome} ctx=${ctx}/>

    ${actions.length ? html`<div class="petits"><h2 class="h-sec">${isLaureat ? 'Quand tu as 5 minutes' : 'Pour avancer'}</h2><ul class="todo">${actions.map(a => html`<li><button class="notif act" onClick=${() => openNotif(a)}><span class=${'n-ico ' + (a.tone || '')}><${Icon} name=${a.icon} size=${16}/></span><span>${a.text}</span><${Icon} name="arrow" size=${16}/></button></li>`)}</ul></div>` : null}

    <${Guide} ctx=${ctx} g=${guide}/>

    <div class="home-grid">
      <div class="home-main">
        <h2 class="h-sec">Pour toi</h2>
        ${isStudent && obj ? html`<button class=${'objective compact clickable st-' + stu.key} onClick=${() => go('parcours')}>
          <div class="objective-top"><span class="obj-ico"><${Icon} name="route" size=${22}/></span>
            <div class="objective-main"><p class="eyebrow">Mon objectif de l’année</p><h2>${obj.titre}</h2></div>
            <span class=${'state-pill s-' + stu.key}>${stu.label}</span></div>
          <${Journey} step=${journeyStep(stu, myApps)}/>
        </button>` : null}
        <${ParrainCard} ctx=${ctx}/>
        <${HelpNeeded} ctx=${ctx} max=${1} compact/>
        <${RelecturesHome} ctx=${ctx}/>
        <${AlerteTalents} ctx=${ctx}/>
        ${isStudent ? html`<${RecoOffers} ctx=${ctx} max=${2}/>` : html`<div class="section-head"><h3>Dernières offres</h3><button class="btn tiny ghost" onClick=${() => go('offres')}>Tout voir <${Icon} name="arrow" size=${14}/></button></div>
          <div class="offer-grid one">${data.offers.filter(o => o.status === 'ouverte').sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 2).map(o => html`<${OfferCard} key=${o.id} o=${o} ctx=${ctx} onOpen=${() => openOffer(o.id)}/>`)}</div>`}
        ${isStudent && !asking ? html`<div class="help-cta"><span class="obj-ico"><${Icon} name="mentor" size=${22}/></span>
          <div class="grow"><strong>Besoin d’un conseil ?</strong><span class="small muted">CV, stage, entretien, étranger : un lauréat te parle 20 minutes en visio.</span></div>
          <button class="btn small" onClick=${() => go('mentorat')}>Demander de l’aide</button></div>` : null}
        <${NudgeAvis} ctx=${ctx}/>
        <${DevenirParrain} ctx=${ctx}/>
        ${isLaureat && s && s.points ? html`<button class="impact-strip clickable" onClick=${() => go('espace')}><span class="obj-ico brass"><${Icon} name="heart" size=${20}/></span><span>${s.recrutes + s.mentorats > 1 ? `Tu as aidé ${s.recrutes + s.mentorats} étudiants` : s.recrutes + s.mentorats === 1 ? 'Tu as aidé 1 étudiant' : 'Ton espace et tes mercis'}</span><span class="spacer"></span><${LevelChip} points=${s.points}/><${Icon} name="arrow" size=${18}/></button>` : null}
      </div>
      <div class="home-side">
        <h2 class="h-sec">Dans le réseau</h2>
        ${merci ? html`<div class="panel merci-une"><p class="eyebrow"><${Icon} name="heart" size=${13}/> Un merci récent</p>
          <blockquote class="merci"><p translate="no" dir="auto">« ${merci.txt} »</p><footer><span class="small"><span translate="no">${store.byId('profiles', merci.from)?.full_name?.split(' ')[0] || 'Un étudiant'}</span> → <button class="linkish" translate="no" onClick=${() => openProfile(store.byId('profiles', merci.to))}>${store.byId('profiles', merci.to)?.full_name}</button></span></footer></blockquote></div>` : null}
        <${NextEvent} ctx=${ctx}/>
        <${SuccessFeed} ctx=${ctx} max=${3}/>
        ${isStudent ? html`<${NextCafe} ctx=${ctx}/>` : html`<button type="button" class="btn ghost plus-reseau" aria-expanded=${plus} onClick=${() => setPlus(!plus)}>${plus ? 'Moins' : 'Plus du réseau'} <${Icon} name=${plus ? 'x' : 'plus'} size=${15}/></button>`}
        <div class=${'en-plus' + (plus ? ' ouvert' : '')}>
        ${!isStudent ? html`<${NextCafe} ctx=${ctx}/>` : null}
        ${!isStudent ? html`<${DefisPanel} ctx=${ctx}/>` : null}
        ${!isStudent && star && star.pts ? html`<div class="panel star">
          <p class="eyebrow"><${Icon} name="trophy" size=${14}/> Lauréat du mois</p>
          <${Person} p=${star.p} score=${scores.get(star.p.id)} onOpen=${openProfile} size=${48}/>
          <p class="small">${starHelped > 1 ? `${starHelped} étudiants recrutés grâce à ses offres. Merci !` : starHelped === 1 ? '1 étudiant recruté grâce à ses offres. Merci !' : 'Merci pour son aide ce mois-ci.'}</p>
        </div>` : null}
        ${!isStudent ? html`<button class="panel pulse clickable" onClick=${() => go('suivi')}>
          <div class="section-head"><h3>L’école en ce moment</h3><${Icon} name="arrow" size=${16}/></div>
          ${st.rows.map(r => html`<div class="pulse-row"><span class="niv-badge">${NIVEAUX[r.n].short}</span><div class="pulse-bar"><div class="row small"><span>${r.objectif.court}</span><span class="spacer"></span><span class="mono">${pct(r.rate)}</span></div><${Bar} value=${r.rate}/></div></div>`)}
          <p class="small muted">${st.viaTotal > 1 ? `${st.viaTotal} réussites vérifiées grâce aux lauréats cette saison.` : st.viaTotal === 1 ? '1 réussite vérifiée grâce aux lauréats cette saison.' : 'Les premières réussites de la saison arrivent.'}</p>
        </button>` : null}
        </div>
      </div>
    </div>
    ${compose ? html`<${OfferComposer} ctx=${ctx} onClose=${() => setCompose(false)}/>` : null}
  </section>`;
}

// Premiers pas : les étapes se cochent toutes seules. Le guide disparaît quand tout ce qui dépend de moi est fait.
function guideEtapes(ctx, setCompose) {
  const { data, me, saison, go } = ctx;
  if (me.role === 'admin') return null;
  const n = niveauOf(me, saison);
  const myApps = data.applications.filter(a => a.student_id === me.id);
  const myOffers = data.offers.filter(o => o.author_id === me.id);
  const steps = me.role === 'etudiant' ? [
    ['user', 'Dépose ton CV en PDF', 'Il sera joint à chaque candidature, et un lauréat peut le relire pour toi.', !!(me.cv_path || me.cv_url), () => go('profil'), 'Mon profil'],
    ['feed', 'Postule à une offre', `Tu ne vois que les offres de ${NIVEAUX[n]?.short || 'ton année'}. Un message de deux phrases suffit.`, myApps.some(a => a.offer_id), () => go('offres'), 'Voir les offres'],
    ['mentor', 'Demande un conseil', 'Un lauréat choisit un de tes horaires et t’appelle 20 minutes en visio.', data.mentorships.some(m => m.student_id === me.id), () => go('mentorat'), 'Mentorat'],
    ['heart', 'Confirme et dis merci', 'Quand il te marque recruté(e), tu confirmes en un clic et tu lui laisses un mot.', data.placements.some(p => p.student_id === me.id && p.status === 'confirme' && p.merci), null, ''],
  ] : [
    ['user', 'Complète ton profil', 'Entreprise, poste, sujets sur lesquels tu peux aider : les étudiants te trouvent plus facilement.', !!(me.entreprise && me.poste), () => go('profil'), 'Mon profil'],
    ['plus', 'Publie une offre', 'Une minute suffit. Seuls les étudiants de l’année concernée la voient.', myOffers.length > 0, () => setCompose(true), 'Publier'],
    ['mentor', 'Aide un étudiant', 'Clique sur un de ses horaires : la visio et l’invitation sont prêtes.', data.mentorships.some(m => m.mentor_id === me.id && m.status !== 'demande'), () => go('mentorat'), 'Mentorat'],
    ['check', 'Marque « Recruté(e) »', 'L’étudiant confirme, et tu reçois ses remerciements et 50 points.', data.placements.some(p => p.laureat_id === me.id && p.status === 'confirme'), null, ''],
  ];
  const done = steps.filter(x => x[3]).length;
  // Fini quand toutes les étapes qui dépendent de moi sont faites (la dernière arrive toute seule, plus tard)
  const fini = steps.filter(x => x[4]).every(x => x[3]);
  return { steps, done, fini };
}

function Guide({ ctx, g }) {
  const { me } = ctx;
  const [off, setOff] = useLocal('guide-off-' + me.id, false);
  const [ouvert, setOuvert] = useState(false);
  // Premiers pas terminés (le guide avait été vu en cours) : on le fête une fois, puis le guide s'efface
  const [etat, setEtat] = useLocal('guide-etat-' + me.id, null);
  useEffect(() => {
    if (!g) return;
    if (!g.fini && etat !== 'en-cours') setEtat('en-cours');
    if (g.fini && etat === 'en-cours') { setEtat('fini'); celebrate({ cle: 'premiers-pas-' + me.id, icon: 'award', titre: 'Premiers pas terminés !', texte: me.role === 'etudiant' ? 'Ton profil est prêt et les lauréats peuvent t’aider. Bravo pour ta démarche.' : 'Merci ! Les étudiants de l’école peuvent compter sur toi.' }); }
  }, [g?.fini]);
  if (!g || off || g.fini) return null;
  const { steps, done } = g;
  const pctFait = done / steps.length;
  return html`<div class=${'guide compact' + (ouvert ? ' ouvert' : '')}>
    <div class="guide-head">
      <span class="guide-ring" style=${`--p:${pctFait}`} aria-hidden="true"><span class="mono">${done}/${steps.length}</span></span>
      <div><p class="eyebrow">Premiers pas</p><h2 class="guide-titre">${me.role === 'etudiant' ? 'Trouver ton stage avec les lauréats' : 'Aider les étudiants de l’école'}</h2></div>
      <button class="btn tiny ghost" aria-expanded=${ouvert} onClick=${() => setOuvert(!ouvert)}>${ouvert ? 'Fermer' : 'Voir les étapes'}</button>
      <button class="icon-btn small" aria-label="Masquer le guide" onClick=${() => setOff(true)}><${Icon} name="x" size=${16}/></button></div>
    ${ouvert ? html`<ol class="guide-steps">${steps.map(([ic, t, d, ok, fn, cta], i) => html`<li class=${ok ? 'ok' : ''}>
      <span class="g-ico"><${Icon} name=${ok ? 'check' : ic} size=${20}/></span>
      <strong>${i + 1}. ${t}</strong><span class="small muted">${d}</span>
      ${!ok && fn ? html`<button class="btn tiny" onClick=${fn}>${cta}</button>` : null}</li>`)}</ol>` : null}
  </div>`;
}

function MyProfile({ ctx }) {
  const { me, store } = ctx;
  return html`<section class="page narrow">
    <header class="page-head"><div><p class="eyebrow">Visible par les membres connectés</p><h1>Mon profil</h1></div>
      ${store.mode === 'live' ? html`<button class="btn ghost" onClick=${() => store.signOut()}><${Icon} name="logout"/> Se déconnecter</button>` : null}</header>
    <${CvCard} ctx=${ctx}/>
    <${ProfileForm} ctx=${ctx} initial=${me} key=${me.id}/>
    <${MesDonnees} ctx=${ctx}/>
  </section>`;
}

// ---------------------------------------------------------------------------
// Connexion et inscription (mode réel)
// ---------------------------------------------------------------------------
function AuthScreen({ store, relang }) {
  const recovery = /type=recovery/.test(location.hash);
  // Arrivé(e) par le lien d'invitation d'une promo : on commence par « Créer mon compte »
  const invite = promoInvitee();
  const [mode, setMode] = useState(recovery ? 'nouveau' : invite ? 'inscription' : 'connexion');
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [ok, setOk] = useState(false); const [mails, setMails] = useState(true);
  const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false);
  const run = async fn => { setBusy(true); setMsg(null); try { await fn(); } catch (e) { setMsg({ err: true, t: e.message }); } setBusy(false); };
  const ecole = store.domainesEcole?.() || [];
  const submit = e => {
    e.preventDefault();
    if (mode === 'connexion') run(() => store.signIn(email.trim(), pw));
    else if (mode === 'inscription') run(async () => { const r = await store.signUp(email.trim(), pw, { consent_at: new Date().toISOString(), emails_hebdo: mails, langue: getLang() }); if (r.needsConfirm) setMsg({ t: 'Compte créé. Ouvre l’email de confirmation reçu, puis reviens te connecter.' }); });
    else if (mode === 'oubli') run(async () => { await store.resetPassword(email.trim()); setMsg({ t: 'Si un compte existe, un lien de réinitialisation vient d’être envoyé.' }); });
    else run(async () => { await store.setPassword(pw); setMsg({ t: 'Mot de passe changé.' }); });
  };
  return html`<main class="auth">
    <div class="auth-lang"><${LangToggle} onChange=${relang}/></div>
    <section class="auth-hero sky">
      <div class="auth-hero-txt">
        <${BrandLogo} size=${64} draw/>
        <h1>Réseau ENSAM Meknès</h1>
        <p>Les lauréats y recrutent leurs stagiaires et donnent un coup de main à l’école. Les étudiants y trouvent stage, PFE et premier emploi plus vite, avec l’aide des anciens.</p>
      </div>
      <${SchoolScene} fit="slice"/>
    </section>
    <div class="auth-right">
    <form class="auth-card form" onSubmit=${submit}>
      <h2>${{ connexion: 'Se connecter', inscription: 'Créer mon compte', oubli: 'Mot de passe oublié', nouveau: 'Nouveau mot de passe' }[mode]}</h2>
      ${invite && mode === 'inscription' ? html`<p class="invite-band"><${Icon} name="send" size=${18}/><span><strong>Bienvenue, promo ${invite} !</strong> Ta promo est déjà remplie : crée ton compte, puis vérifie tes informations.</span></p>` : null}
      ${mode !== 'nouveau' ? html`<${Field} label="Email" hint=${mode === 'inscription' && ecole.length ? `Étudiant(e) : ${store.reglages?.email_ecole_obligatoire ? 'inscris-toi' : 'de préférence'} avec ton email de l’école (${ecole.map(d => '@' + d).join(', ')}). Ton compte est alors vérifié tout de suite.` : ''}><input id="au-email" type="email" required autocomplete="email" value=${email} onInput=${e => setEmail(e.target.value)}/><//>` : null}
      ${mode !== 'oubli' ? html`<${Field} label="Mot de passe" hint=${mode === 'connexion' ? '' : '6 caractères minimum'}><input id="au-pw" type="password" required minlength="6" autocomplete=${mode === 'connexion' ? 'current-password' : 'new-password'} value=${pw} onInput=${e => setPw(e.target.value)}/><//>` : null}
      ${mode === 'inscription' ? html`<label class="check small"><input id="au-ok" type="checkbox" required checked=${ok} onChange=${e => setOk(e.target.checked)}/> <span>J’accepte que mes données servent au réseau (<a href="#confidentialite">Confidentialité</a>)</span></label>
        <label class="check small"><input id="au-mail" type="checkbox" checked=${mails} onChange=${e => setMails(e.target.checked)}/> Recevoir un résumé par email chaque semaine</label>` : null}
      ${msg ? html`<p class=${'auth-msg' + (msg.err ? ' err' : '')} role="alert">${msg.t}</p>` : null}
      <button class="btn primary wide" disabled=${busy || (mode === 'inscription' && !ok)}>${busy ? '…' : { connexion: 'Se connecter', inscription: 'Créer mon compte', oubli: 'Envoyer le lien', nouveau: 'Enregistrer' }[mode]}</button>
      <div class="auth-links">
        ${mode !== 'connexion' ? html`<button type="button" class="linkish" onClick=${() => { setMode('connexion'); setMsg(null); }}>J’ai déjà un compte</button>` : html`<button type="button" class="linkish" onClick=${() => { setMode('inscription'); setMsg(null); }}>Créer un compte</button>`}
        ${mode === 'connexion' ? html`<button type="button" class="linkish" onClick=${() => { setMode('oubli'); setMsg(null); }}>Mot de passe oublié ?</button>` : null}
      </div>
    </form>
    <div class=${'auth-pour' + (invite && roleDePromo(invite) === 'etudiant' ? ' etu-avant' : '')}>
      <section><h2 class="eyebrow">Pour les lauréats</h2><ul class="auth-points">
        <li><span class="sc-ico"><${Icon} name="briefcase"/></span> Recrute tes stagiaires parmi les étudiants de ton école</li>
        <li><span class="sc-ico"><${Icon} name="mentor"/></span> Aide un étudiant en 20 minutes de visio, quand tu as le temps</li>
        <li><span class="sc-ico"><${Icon} name="award"/></span> Badges, mercis et « Membre fondateur » pour les 25 premiers lauréats</li>
      </ul></section>
      <section><h2 class="eyebrow">Pour les étudiants</h2><ul class="auth-points">
        <li><span class="sc-ico"><${Icon} name="feed"/></span> Offres de stage, de PFE et d’emploi partagées par les anciens</li>
        <li><span class="sc-ico"><${Icon} name="chat"/></span> Un lauréat te conseille : CV, entretien, départ à l’étranger</li>
        <li><span class="sc-ico"><${Icon} name="check"/></span> Recrutements vérifiés : le lauréat déclare, tu confirmes</li>
      </ul></section>
    </div>
    <p class="small muted center"><a href="#confidentialite">Confidentialité</a></p>
    </div>
  </main>`;
}

function Onboarding({ store, relang }) {
  const act = async fn => { try { await fn(); } catch (e) { toast(e.message, 'err'); } };
  const ctx = { store, act };
  const invite = promoInvitee();
  const preset = invite ? { promo: invite, role: roleDePromo(invite) } : null;
  return html`<main class="auth"><div class="auth-lang"><${LangToggle} onChange=${relang}/></div><div class="auth-card wide">
    <div class="row"><${BrandLogo} size=${44}/><div><p class="eyebrow">Dernière étape</p><h2>Présente-toi à la communauté</h2></div></div>
    <p class="muted">Ces informations permettent de te proposer les bonnes offres et de suivre ta promo.</p>
    <${ProfileForm} ctx=${ctx} preset=${preset} onboarding/>
    <button class="linkish small" onClick=${() => store.signOut()}>Se déconnecter</button>
  </div><${Toaster}/></main>`;
}

// ---------------------------------------------------------------------------
(async () => {
  const root = document.getElementById('app');
  lireInvitation();
  try {
    // L'arabe se charge en même temps que les données, seulement si c'est la langue choisie
    const [store] = await Promise.all([createStore(), getLang() === 'ar' ? chargerAR().catch(() => setLang('fr')) : null]);
    root.innerHTML = '';
    render(html`<${App} store=${store}/>`, root);
  } catch (e) {
    // Fichiers gardés sur le téléphone abîmés ou d'une ancienne version : on les oublie et on recharge, une seule fois
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller && !sessionStorage.getItem('ensam-reprise')) {
        sessionStorage.setItem('ensam-reprise', '1');
        for (const k of await caches.keys()) await caches.delete(k);
        for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
        return location.reload();
      }
    } catch { /* on affiche l'erreur */ }
    root.innerHTML = '';
    render(html`<div class="fatal"><h1>Impossible de charger la plateforme</h1><p>${e.message}</p><p class="muted">Vérifie ta connexion internet puis recharge la page.</p></div>`, root);
  }
})();
