// Page « Match » : la mise en relation entre étudiants et lauréats, une carte à la fois : « Plus tard » ou « Intéressé ».
// L'étudiant voit des offres de lauréats (et les lauréats qui s'intéressent à lui) ; le lauréat voit des étudiants,
// leur CV en grand (apercu-cv.js), lisible en entier avant de choisir.
// Quand les deux disent oui, c'est un match : la discussion s'ouvre (messages.js : bandeau, entretien).
// Règles : deckMatch, matchsDe (logic.js) ; choisirMatch, revenirMatch, vuMatch (store.js, comme la base).
// CSS : page.html, section « Match » (la page, la pile, les gestes, la fête) ; ici (injectCSS) le contenu des cartes,
// la progression, la fin de la pile, le guide et le panneau « En bref » des grands écrans.
// Anatomie d'une carte : en haut, d'un bord à l'autre, ce qui se reconnaît d'un coup d'œil (le logo sur un voile à la couleur
// de l'entreprise, le CV, ou le visage) ; puis le titre, une ligne de méta, au plus trois puces ; au pied, « Pourquoi toi » :
// des raisons vraies (filière, parcours, compétences en commun, demande), jamais un score.
// Cartes sponsorisées : une après chaque 10 cartes de la visite (avecSponsorises, logic.js), marquée « Sponsorisé » ; tout
// geste la passe sans rien enregistrer, « Revenir » ne la ramène pas. La base compte seulement une vue (carte du dessus) et
// un clic (« Voir ») par membre et par jour ; l'entreprise n'en reçoit que les totaux (admin.js, « Sponsorisés »).
import { html, useState, useEffect, useLayoutEffect, useRef, useMemo } from './vendor/preact-htm.js';
import { Icon, Avatar, AvatarPile, CompanyLogo, MentionLogos, toast, roleTexte, useFeuille, mouvementReduit, ecranLibre, injectCSS, styleEntreprise } from './ui.js';
import { ajouterIcones } from './entree.js';
import { deckMatch, matchsDe, titreOffre, resumeFilieres, filiereCourte, niveauOf, NIVEAUX, TYPES, demandesActives, typesDemande, DEMANDES_MAX, sponsorisesPour, avecSponsorises, decalageSponso,
  proximiteFiliere, logoEntreprise, MATCH_PLUS_TARD_JOURS, fmtDate, TOUR_JOUR, etatTour, avancerTour, jourLocal } from './logic.js';
import { estPortee } from './origine.js';
import { TYPE_ICON } from './entree.js';
import { OfferComposer } from './offers.js';
import { addAR, getLang } from './i18n.js';
import { ApercuCV, LecteurCV } from './apercu-cv.js';
import { proposerPrevenir, LignePrevenir } from './pwa.js';

ajouterIcones({
  // Deux cartes l'une sur l'autre, une coche sur celle de devant
  match: '<rect x="8" y="3" width="12.5" height="16" rx="2.5"/><path d="M4.5 7.5v11A2.5 2.5 0 0 0 7 21h8.5"/><path d="m11.4 11.3 2 2 3.7-3.9"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
});

const prenom = p => (p?.full_name || '').split(' ')[0] || '';
// La demande en cours la plus récente d'un étudiant : celle que disent sa carte, « En bref » et son CV de démonstration (store.js)
const derniereDemande = (data, id) => demandesActives(data, id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
// Ce que cherche un étudiant (sa demande en cours), dit sur sa carte
const CHERCHE = { stage: 'Cherche un stage', pfe: 'Cherche un PFE', etranger: 'Cherche un stage à l’étranger', emploi: 'Cherche un emploi' };
// Le CV de l'étudiant s'affiche-t-il aux lauréats avant le match ? Son réglage « CV » (lauréats par défaut, ou tous)
const cvPourLaureats = me => ['laureats', 'tous'].includes((me.visibilite || {}).cv || 'laureats');
// Retour au toucher, si l'appareil sait vibrer (léger : un geste validé, un vrai succès)
const vibrer = motif => { try { navigator.vibrate?.(motif); } catch { /* pas de vibreur */ } };
// Le logo d'une entreprise : un seul point d'entrée pour toute la page (le logo local, l'icône du site, ou le monogramme coloré).
// domaine : celui que l'administration a donné pour une carte sponsorisée (son icône), sinon celui que le logo devine
const Logo = ({ nom, lien, taille = 56, domaine = null }) => html`<${CompanyLogo} name=${nom} size=${taille} lien=${lien} domaine=${domaine}/>`;
// Le site qu'ouvre « Voir » sur une carte sponsorisée, sans « www. »
const siteDe = lien => { try { return new URL(lien).hostname.replace(/^www\./, ''); } catch { return ''; } };

// ---------------------------------------------------------------------------
// La couleur d'une entreprise pour le voile de sa carte : celle de son vrai logo (lue une fois dans l'image, qui est sur le
// site), sinon la teinte de son monogramme. Un logo gris ou noir garde la teinte du monogramme.
// ---------------------------------------------------------------------------
const TEINTES_LOGO = new Map();
function teinteDuLogo(src) {
  if (TEINTES_LOGO.has(src)) return TEINTES_LOGO.get(src);
  const p = new Promise(ok => {
    const im = new Image(); im.decoding = 'async';
    im.onload = () => {
      try {
        const n = 24, cv = document.createElement('canvas'); cv.width = cv.height = n;
        const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, n, n);
        const d = x.getImageData(0, 0, n, n).data; let sx = 0, sy = 0, ss = 0, poids = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 160) continue;
          const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, e = mx - mn;
          if (e < 0.2 || l < 0.12 || l > 0.9) continue;           // gris, noir, blanc : pas une couleur de marque
          const s = e / (1 - Math.abs(2 * l - 1));
          let h = mx === r ? ((g - b) / e) % 6 : mx === g ? (b - r) / e + 2 : (r - g) / e + 4; h = (h * 60 + 360) % 360;
          const w = s * e; sx += Math.cos(h * Math.PI / 180) * w; sy += Math.sin(h * Math.PI / 180) * w; ss += s * w; poids += w;
        }
        ok(poids < 1.2 ? null : { h: Math.round((Math.atan2(sy, sx) * 180 / Math.PI + 360) % 360), s: Math.round(Math.min(72, Math.max(34, (ss / poids) * 80))) });
      } catch { ok(null); }
    };
    im.onerror = () => ok(null); im.src = src;
  });
  TEINTES_LOGO.set(src, p);
  return p;
}
// Le voile en haut d'une carte : la teinte de l'entreprise (ou de la personne), deux cercles discrets, ce qu'on y pose
// Le voile d'une personne assez haut pour son visage au-dessus de son nom (la place que la carte lui laisse) : le visage
// passe au centre, comme l'en-tête d'un profil. Mesuré sur le texte côte à côte, plus haut que centré : rien ne déborde.
function Voile({ nom, teinte = null, cls = '', children }) {
  const src = nom ? logoEntreprise(nom) : null;
  const [lue, setLue] = useState(null);
  const ref = useRef(); const [haut, setHaut] = useState(false);
  const perso = cls.includes('mx-v-perso');
  useEffect(() => { let vivant = true; setLue(null); if (src) teinteDuLogo(src).then(t => vivant && setLue(t)); return () => { vivant = false; }; }, [src]);
  useLayoutEffect(() => {
    const v = ref.current; if (!perso || !v || typeof ResizeObserver !== 'function') return;
    // On essaie la mise en page centrée le temps d'une mesure (rien n'est peint entre-temps) et on la garde si elle tient :
    // le texte y a toute la largeur, il prend donc moins de lignes qu'à côté du visage
    const ent = v.querySelector('.mx-v-ent'); if (!ent) return;
    const mesure = () => {
      const avant = v.classList.contains('haut');
      if (!avant) v.classList.add('haut');
      const cs = getComputedStyle(v);
      // offsetHeight : la hauteur de mise en page, que la carte tirée (penchée) ne gonfle pas comme getBoundingClientRect
      const tient = ent.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + 6 <= v.clientHeight;
      if (!avant) v.classList.remove('haut');
      setHaut(tient);
    };
    // Le voile change de taille (écran, carte) ou son texte change (langue, police chargée)
    const ro = new ResizeObserver(mesure); ro.observe(v); ro.observe(ent);
    return () => ro.disconnect();
  }, []);
  const style = lue ? `--h:${lue.h};--s:${lue.s}%` : teinte || styleEntreprise(nom || '');
  return html`<div ref=${ref} class=${'mx-voile' + (cls ? ' ' + cls : '') + (haut ? ' haut' : '')} style=${style}>${children}</div>`;
}

// ---------------------------------------------------------------------------
// Pourquoi cette carte : quelques raisons vraies, celle de pourquoiCarte (logic.js) d'abord, puis ce qu'on a vraiment en
// commun (filière, parcours, compétences visibles). Jamais un score, jamais une raison inventée.
// ---------------------------------------------------------------------------
const cleComp = x => String(x).trim().toLowerCase();
// Une compétence citée dans un texte (titre, description d'offre) : mot entier, sans accents ni casse (« power bi » dans « Power BI »)
const plat = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function citees(competences, texte) {
  const t = plat(texte);
  if (!t) return [];
  return [...new Set(competences)].filter(c => {
    const k = plat(c).trim();
    if (k.length < 2) return false;
    return new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(t);
  }).slice(0, 2);
}
const et = l => (l.length > 1 ? `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]}` : l[0]);
const texteOffre = o => (o ? `${o.titre || ''} ${o.description || ''}` : '');
const proxOffreMoi = (o, me) => (!o.filieres?.length ? -1 : o.filieres.includes(me.filiere) ? 2 : o.filieres.some(f => proximiteFiliere(f, me.filiere) >= 1) ? 1 : 0);
function raisonsCarte(carte, me, store, data) {
  const out = []; const ajoute = t => { if (t && !out.includes(t)) out.push(t); };
  const p = carte.profil;
  const voit = c => (p ? store?.voitChamp?.(p, c) ?? true : false);
  const miennes = new Set((me.competences || []).map(cleComp));
  const communes = () => (voit('presentation') ? (p?.competences || []).filter(x => miennes.has(cleComp(x))).slice(0, 2) : []);
  // Sur la carte d'un étudiant, sa recherche est déjà dite au-dessus (« Cherche un PFE ») : elle ne revient au pied que seule
  if (!(carte.sorte === 'etudiant' && /^Cherche /.test(carte.raison || ''))) ajoute(carte.raison);
  if (carte.sorte === 'offre') {
    const o = carte.offre;
    const px = proxOffreMoi(o, me);
    ajoute(px === 2 ? 'Pour ta filière' : px === 1 ? 'Pour ton parcours' : px === -1 ? 'Ouverte à toutes les filières' : null);
    // Ce que l'offre demande et que tu as déclaré (tes compétences, dans son titre ou sa description)
    const c1 = citees(me.competences || [], texteOffre(o)); if (c1.length) ajoute(`${et(c1)}, dans ton profil`);
    if (p) {
      const pf = proximiteFiliere(me.filiere, p.filiere);
      ajoute(pf === 2 ? `${prenom(p)} vient de ta filière` : pf === 1 ? `${prenom(p)} vient de ton parcours` : null);
      const c = communes(); if (c.length) ajoute(`${c.join(', ')}, comme ${prenom(p)}`);
    }
  } else if (p) {
    const pf = proximiteFiliere(me.filiere, p.filiere);
    ajoute(pf === 2 ? 'Même filière que toi' : pf === 1 ? 'Même parcours que toi' : null);
    if (carte.sorte === 'laureat') {
      // Son offre ouverte pour toi : ta filière, et ce qu'elle demande que tu as déclaré
      const o = carte.interet?.offre;
      if (o) {
        const c1 = citees(me.competences || [], texteOffre(o)); if (c1.length) ajoute(`${et(c1)}, dans ton profil`);
        const px = proxOffreMoi(o, me);
        ajoute(px === 2 ? 'Son offre vise ta filière' : px === 1 ? 'Son offre vise ton parcours' : null);
      }
    } else if (voit('presentation')) {
      // Un étudiant : ses compétences que demandent tes offres ouvertes (celle qui l'intéresse d'abord)
      const miennesOffres = [carte.interet?.offre, ...(data?.offers || []).filter(o => o.author_id === me.id && o.status === 'ouverte' && (o.audience || 'etudiants') === 'etudiants')].filter(Boolean);
      const c1 = citees(p.competences || [], miennesOffres.map(texteOffre).join(' \n '));
      if (c1.length) ajoute(`${et(c1)}, dans ton offre`);
    }
    const c = communes(); if (c.length) ajoute(`${c.join(', ')}, comme toi`);
  }
  if (!out.length) ajoute(carte.raison);
  return out.slice(0, 3);
}

// Un nombre qui compte jusqu'à sa valeur à l'arrivée (sans mouvement demandé : la valeur tout de suite)
function Compte({ n }) {
  const [v, setV] = useState(() => (mouvementReduit() ? n : 0));
  useEffect(() => {
    if (mouvementReduit() || !n) { setV(n); return; }
    let f = 0; const t0 = performance.now(), d = 400;
    const pas = t => { const k = Math.min(1, (t - t0) / d); setV(Math.round(n * (1 - Math.pow(1 - k, 3)))); if (k < 1) f = requestAnimationFrame(pas); };
    f = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(f);
  }, [n]);
  return html`<span class="mx-compte">${v}</span>`;
}

// ---------------------------------------------------------------------------
// La page
// ---------------------------------------------------------------------------
// Le tour du jour, par membre et dans ce navigateur (logic.js : avancerTour)
const cleTour = id => 'match-tour-' + id;
const lireTour = id => { try { return JSON.parse(localStorage.getItem(cleTour(id)) || 'null'); } catch { return null; } };
const noterTour = (id, t) => { try { localStorage.setItem(cleTour(id), JSON.stringify(t)); } catch { /* stockage indisponible */ } };

export function MatchPage(ctx) {
  const { data, me, store, go } = ctx;
  const etu = me.role === 'etudiant';
  // Sens de lecture : en arabe, « Intéressé » est à gauche (le glisser et les flèches suivent)
  const sens = getLang() === 'ar' ? -1 : 1;
  const base = useMemo(() => deckMatch(data, me), [data.match_choix, data.matchs, data.offers, data.profiles, data.applications, data.blocages, data.demandes, me]);
  const sponsors = useMemo(() => sponsorisesPour(data.sponsorises, me), [data.sponsorises, me]);
  const [passees, setPassees] = useState(0);     // les cartes ordinaires passées pendant cette visite
  const [sautes, setSautes] = useState([]);      // les cartes sponsorisées passées (leurs créneaux)
  const deck = useMemo(() => avecSponsorises(base, sponsors, { passees, sautes, decalage: decalageSponso(me.id) }), [base, sponsors, passees, sautes, me.id]);
  const [vol, setVol] = useState(null);          // la carte qui s'en va : { c, choix, from }
  const [hist, setHist] = useState([]);          // les choix de cette visite qu'on peut défaire (« Revenir »)
  const [bilan, setBilan] = useState([]);        // les choix de cette visite : { cle, choix } (le bilan de la fin)
  const [devant, setDevant] = useState(null);    // la carte revenue reste devant
  const [fete, setFete] = useState(null);
  const [compose, setCompose] = useState(false);
  const [lire, setLire] = useState(null);        // le CV ouvert en grand (la carte du dessus)
  const [annonce, setAnnonce] = useState('');
  const [tour, setTour] = useState(() => etatTour(lireTour(me.id), jourLocal()));
  // Le premier passage : le geste montré une fois, cinq secondes, sans rien bloquer (par membre, dans ce navigateur)
  const [guide, setGuide] = useState(() => { try { return !localStorage.getItem('match-guide-' + me.id); } catch { return false; } });
  const pile = useRef();
  const cartes = useMemo(() => {
    const l = deck.filter(c => c.cle !== vol?.c.cle);
    const i = devant ? l.findIndex(c => c.cle === devant) : -1;
    return i > 0 ? [l[i], ...l.slice(0, i), ...l.slice(i + 1)] : l;
  }, [deck, vol, devant]);
  const top = cartes[0] || null;
  // Les cartes ordinaires qui restent (les sponsorisées ne comptent pas)
  const restantes = base.filter(c => !hist.includes(c.cle)).length;
  // Le tour du jour : TOUR_JOUR cartes, ou moins quand la pile est plus courte (une pile finie, c'est un tour fait)
  const jour = jourLocal(), tourFait = tour.fait === jour;
  const objectif = Math.min(TOUR_JOUR, tour.n + restantes);

  const choisir = (choix, from = null) => {
    if (!top || vol) return;
    // Choisi au bouton ou au clavier pendant le geste montré : la carte part d'où elle penche, sans sauter au centre
    if (!from && guide) {
      const e = pile.current?.querySelector('.mx-carte.dessus'), t = e ? getComputedStyle(e).transform : 'none';
      const m = t && t !== 'none' ? new DOMMatrixReadOnly(t) : null;
      if (m && Math.abs(m.e) > 1) from = { dx: m.e, dy: m.f, w: e.offsetWidth };
    }
    setGuide(false);
    const c = top;
    setVol({ c, choix, from, t: Date.now() }); setDevant(null);
    pile.current?.style.setProperty('--avance', '0');
    vibrer(10);
    const fin = () => setTimeout(() => setVol(v => (v?.c.cle === c.cle ? null : v)), mouvementReduit() ? 180 : 400);
    // Une carte sponsorisée : quel que soit le geste, elle passe ; rien n'est enregistré (pas de choix, pas de « Revenir »)
    if (c.sorte === 'sponsorise') { setSautes(l => [...l, c.creneau]); setAnnonce('Carte sponsorisée passée.'); fin(); return; }
    setAnnonce(`${choix === 'oui' ? 'Intéressé' : 'Plus tard'} : ${c.offre ? titreOffre(c.offre) : c.profil?.full_name || ''}`);
    setHist(h => [...h, c.cle]); setPassees(n => n + 1); setBilan(b => [...b, { cle: c.cle, choix }]);
    // Le tour du jour avance (logic.js : avancerTour) ; une pile plus courte que le tour le termine aussi
    const jour = jourLocal(), avant = lireTour(me.id);
    const t = avancerTour(avant, jour, Math.min(TOUR_JOUR, etatTour(avant, jour).n + restantes));
    noterTour(me.id, t); setTour(t);
    if (t.fini) { vibrer([12, 40, 12]); toast(t.serie > 1 ? `Tour du jour fait : ${t.serie} jours de suite` : 'Tour du jour fait', 'win'); }
    const parti = Date.now();
    store.choisirMatch(c.offre ? { offre: c.offre.id } : { profil: c.profil.id }, choix).then(r => {
      // Un « Intéressé » qui ne fait pas de match tout de suite : « Me prévenir » le propose, la carte une fois partie
      if (!r?.match) { if (choix === 'oui') proposerPrevenir('match', null, Math.max(0, (mouvementReduit() ? 180 : 420) - (Date.now() - parti))); return; }
      const autre = store.byId('profiles', r.match.etudiant_id === me.id ? r.match.laureat_id : r.match.etudiant_id) || c.profil;
      setTimeout(() => setFete({ m: r.match, autre, offre: (r.match.offre_id && store.byId('offers', r.match.offre_id)) || null }), mouvementReduit() ? 0 : 260);
    }, e => { setHist(h => h.filter(x => x !== c.cle)); setBilan(b => b.filter(x => x.cle !== c.cle)); setPassees(n => Math.max(0, n - 1)); setDevant(c.cle); toast(e.message || String(e), 'err'); });
    fin();
  };
  const revenir = () => {
    if (!hist.length || vol) return;
    store.revenirMatch().then(r => {
      setHist(h => h.slice(0, -1));
      if (!r) return toast('Ce choix a mené à un match : il reste.', 'info');
      setPassees(n => Math.max(0, n - 1));
      const cle = r.offre ? 'o:' + r.offre : 'p:' + r.profil;
      setBilan(b => { const i = b.map(x => x.cle).lastIndexOf(cle); return i < 0 ? b : [...b.slice(0, i), ...b.slice(i + 1)]; });
      setDevant(cle); setAnnonce('La carte est revenue.');
      vibrer(8);
    }, e => toast(e.message || String(e), 'err'));
  };
  // Clavier : ← → choisissent (dans le sens de lecture), Z ou Retour arrière reviennent. Jamais dans un champ ni sous une fenêtre.
  useLayoutEffect(() => {
    const k = e => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || fete || compose || lire) return;
      if (e.target?.closest?.('input, textarea, select, [contenteditable="true"]') || !ecranLibre()) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (!top) return;
        e.preventDefault();
        choisir((e.key === 'ArrowRight' ? 1 : -1) * sens > 0 ? 'oui' : 'plus_tard');
      } else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') {
        if (!hist.length) return;
        e.preventDefault(); revenir();
      }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });
  // La pile tient dans l'écran avec ses boutons (sous la barre du haut, au-dessus de celle du bas) ; la page défile seulement sur un très petit écran
  const plein = !!(top || vol);
  useLayoutEffect(() => {
    const z = pile.current; if (!z) return;
    const ajuste = () => {
      // La position dans la mise en page (offsetTop), pas à l'écran : l'arrivée de la page glisse de quelques pixels
      let haut = 0; for (let e = z; e; e = e.offsetParent) haut += e.offsetTop;
      const acts = z.parentElement?.querySelector('.mx-acts')?.offsetHeight || 90;
      const bas = document.querySelector('.bottom-nav')?.offsetHeight || 0;
      // Sous les boutons, l'écart de la zone puis l'aide : l'aide commence juste sous la barre du bas (jamais à moitié visible)
      const ecart = parseFloat(getComputedStyle(z.parentElement).rowGap) || 12;
      const h = Math.round(innerHeight - haut - acts - bas - 22 - 2 * ecart);
      z.style.setProperty('--h', Math.max(330, Math.min(600, h)) + 'px');
    };
    ajuste(); addEventListener('resize', ajuste);
    // Les polices arrivées (l'arabe surtout) changent la hauteur de ce qui est au-dessus : on remesure une fois
    let vivant = true; document.fonts?.ready.then(() => vivant && ajuste());
    return () => { vivant = false; removeEventListener('resize', ajuste); };
  }, [plein]);
  // Une carte sponsorisée devenue la carte du dessus : une vue (la base n'en compte qu'une par membre et par jour)
  useEffect(() => { if (top?.sorte === 'sponsorise') Promise.resolve(store.vueSponsorise?.(top.sponsorise.id)).catch(() => {}); }, [top?.cle]);
  const voir = c => Promise.resolve(store.clicSponsorise?.(c.sponsorise.id)).catch(() => {});
  const finFete = () => { if (fete) store.vuMatch(fete.m.id).catch(() => {}); setFete(null); };
  const ecrire = () => { const f = fete; finFete(); if (f?.autre) (ctx.ecrire ? ctx.ecrire(f.autre.id) : go('messages/' + f.autre.id)); };
  const logos = cartes.slice(0, 3).filter(c => c.offre).map(c => c.offre.entreprise);
  useEffect(() => {
    if (!guide || !top) return;
    try { localStorage.setItem('match-guide-' + me.id, '1'); } catch { /* stockage indisponible */ }
    const t = setTimeout(() => setGuide(false), 5000);
    return () => clearTimeout(t);
  }, [guide, !!top]);
  const detail = c => (!c || c.sorte === 'sponsorise' ? null : c.offre ? ctx.openOffer(c.offre.id) : ctx.openProfile(c.profil));

  return html`<section class=${'page mx-page' + (plein ? '' : ' fini')}>
    <header class="mx-tete">
      <div class="mx-tete-txt">
        ${tourFait || (plein && objectif > 0) ? html`<${TourDuJour} n=${Math.min(tour.n, objectif)} objectif=${objectif} fait=${tourFait} serie=${tour.serie}/>` : html`<span class="en-tete-place" aria-hidden="true"></span>`}
        <h1>Match</h1>
        <p class="muted mx-sous">${etu ? 'Des offres de lauréats, une carte à la fois.' : 'Des étudiants de l’école, une carte à la fois.'}</p>
      </div>
      <${MesMatchs} ctx=${ctx}/>
    </header>
    ${plein ? html`<div class="mx-zone">
      <div class=${'mx-pile' + (guide && top && !vol ? ' montre' : '')} ref=${pile} style=${`--sens:${sens}`}>
        ${cartes.slice(0, 3).reverse().map((c, i, l) => html`<${Carte} key=${c.cle} ctx=${ctx} carte=${c} rang=${l.length - 1 - i} sens=${sens}
          onChoix=${choisir} onLire=${() => setLire(c)} onVoir=${() => voir(c)} revenue=${c.cle === devant}
          onTouche=${guide ? () => setGuide(false) : null}/>`)}
        ${vol ? html`<${Carte} key=${'vol-' + vol.c.cle + vol.t} ctx=${ctx} carte=${vol.c} rang=${0} sens=${sens} vol=${vol}/>` : null}
        ${guide && top && !vol ? html`<${Guide} sens=${sens}/>` : null}
      </div>
      <div class="mx-acts" role="group" aria-label="Ton choix">
        <button type="button" class="mx-rond mx-non" onClick=${() => choisir('plus_tard')} disabled=${!top}><span class="mx-rond-ico"><${Icon} name="x" size=${26}/></span><span class="mx-rond-lib">Plus tard</span></button>
        <button type="button" class="mx-rond mx-retour" onClick=${revenir} disabled=${!hist.length}><span class="mx-rond-ico"><${Icon} name="undo" size=${20}/></span><span class="mx-rond-lib">Revenir</span></button>
        <button type="button" class="mx-rond mx-oui" onClick=${() => choisir('oui')} disabled=${!top}><span class="mx-rond-ico"><${Icon} name="check" size=${30}/></span><span class="mx-rond-lib">Intéressé</span></button>
      </div>
      <p class="mx-aide muted small">Si c’est oui des deux côtés, c’est un match : vous pouvez vous écrire.</p>
      <p class="mx-clavier muted small" aria-hidden="true">${sens > 0 ? 'Clavier : ← Plus tard · → Intéressé · Z pour revenir' : 'Clavier : → Plus tard · ← Intéressé · Z pour revenir'}</p>
      <${MentionLogos} noms=${logos}/>
    </div>
    <${EnBref} ctx=${ctx} carte=${vol ? null : top} onDetail=${() => detail(top)}/>`
    : html`<${PileVide} ctx=${ctx} bilan=${bilan} onPublier=${() => setCompose(true)} revenir=${hist.length ? revenir : null}/>`}
    ${etu && me.match_visible !== false ? html`<p class="mx-visible small muted"><${Icon} name="eye" size=${15}/> <span>${!me.cv_path ? 'Les lauréats voient aussi ta carte. Ajoute ton CV : il s’affiche en grand, et les cartes avec CV passent en premier.'
      : cvPourLaureats(me) ? 'Les lauréats voient aussi ta carte, avec ton CV en grand.' : 'Les lauréats voient aussi ta carte. Ton CV reste privé jusqu’au match.'}</span> <button type="button" class="linkish small" onClick=${() => go('profil')}>${me.cv_path ? 'Modifier' : 'Ajouter mon CV'}</button></p>` : null}
    <p class="sr-only" aria-live="polite">${annonce}</p>
    ${fete ? html`<${FeteMatch} f=${fete} me=${me} onEcrire=${ecrire} onClose=${finFete}/>` : null}
    ${lire ? html`<${LecteurCV} store=${store} p=${lire.profil} path=${lire.profil.cv_path} onClose=${() => setLire(null)}
      onChoix=${top?.cle === lire.cle ? c => { setLire(null); choisir(c); } : null}/>` : null}
    ${compose ? html`<${OfferComposer} ctx=${ctx} onClose=${() => setCompose(false)}/>` : null}
  </section>`;
}

// Le tour du jour : « 2 sur 5 aujourd’hui » et un point par carte (le point en cours est plus long). Fait : une coche,
// et les jours de suite quand il y en a plusieurs ; jamais de série perdue affichée ni de reproche.
function TourDuJour({ n, objectif, fait, serie }) {
  if (fait) {
    const texte = serie > 1 ? `Tour du jour fait · ${serie} jours de suite` : 'Tour du jour fait';
    return html`<p class="mx-tour fini" role="img" aria-label=${texte}>
      <span class="mx-tour-coche" aria-hidden="true"><${Icon} name="check" size=${13}/></span><span aria-hidden="true">Tour du jour fait</span>
      ${serie > 1 ? html`<span class="mx-tour-serie" aria-hidden="true">${serie} jours de suite</span>` : null}
    </p>`;
  }
  // Une image pour les lecteurs d'écran (aria-label n'est pas permis sur un simple paragraphe)
  return html`<p class="mx-tour" role="img" aria-label=${`Tour du jour : ${n} sur ${objectif}`}>
    <span class="mx-tour-txt" aria-hidden="true"><strong class="mx-tour-n">${n}</strong> sur ${objectif} aujourd’hui</span>
    <span class="mx-tour-pts" aria-hidden="true">${Array.from({ length: objectif }, (_, i) => html`<i class=${i < n ? 'fait' : i === n ? 'ici' : ''}></i>`)}</span>
  </p>`;
}

// Le premier passage : de quel côté glisser, montré une fois (« Intéressé » est du côté de la fin de ligne)
function Guide({ sens }) {
  return html`<p class="mx-guide" role="status">
    <span class="sr-only">${sens > 0 ? 'À droite : Intéressé · À gauche : Plus tard' : 'À gauche : Intéressé · À droite : Plus tard'}</span>
    <span class="mx-g-cote mx-g-non" aria-hidden="true"><${Icon} name="arrow" size=${15}/><span>Plus tard</span></span>
    <span class="mx-guide-doigt" aria-hidden="true"></span>
    <span class="mx-g-cote mx-g-oui" aria-hidden="true"><span>Intéressé</span><${Icon} name="arrow" size=${15}/></span>
  </p>`;
}

// ---------------------------------------------------------------------------
// Une carte : glisser au doigt ou à la souris (pointer events), ressort au relâchement ; appui = le détail
// ---------------------------------------------------------------------------
const SEUIL = 0.3;          // part de la largeur à dépasser pour choisir
const VITESSE = 0.55;       // ou un geste vif (px/ms)
// Un titre resté en français est aligné à droite en arabe ; coupé à deux ou trois lignes, Chrome placerait ses points de
// suspension hors de la ligne. On marque donc les titres coupés (data-coupe) : ils gardent l'alignement du français et
// leurs points de suspension (voir « match-cartes »). Remesuré quand leur place change (écran, carte, voile centré).
const COUPABLES = '.mx-c-titre, .mx-so-t, .mx-v-txt > [dir="auto"]';
function useCoupes(ref, cle) {
  useLayoutEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver !== 'function') return;
    const l = [...el.querySelectorAll(COUPABLES)];
    const ro = new ResizeObserver(() => l.forEach(e => e.toggleAttribute('data-coupe', e.scrollHeight > e.clientHeight + 1)));
    l.forEach(e => ro.observe(e));
    return () => ro.disconnect();
  }, [cle]);
}
function Carte({ ctx, carte, rang, sens, onChoix, onLire, onVoir, vol, revenue, onTouche }) {
  const el = useRef(); const g = useRef(null);
  // Le dernier appui fini : glissé ou long, le clic qui le suit n'ouvre pas le détail
  const fini = useRef(null);
  useCoupes(el, carte.cle);
  const dessus = rang === 0 && !vol;
  const sponso = carte.sorte === 'sponsorise';
  const cls = 'mx-carte' + (sponso ? ' sponso' : '') + (dessus ? ' dessus' : ' derriere') + (vol ? ' vol' : '');
  // Une carte sponsorisée n'a pas de détail : seul « Voir » ouvre son lien
  const detail = () => (sponso ? null : carte.offre ? ctx.openOffer(carte.offre.id) : ctx.openProfile(carte.profil));
  const poser = (dx, dy) => {
    const e = el.current; if (!e) return;
    e.style.transform = dx || dy ? `translate3d(${dx}px, ${dy}px, 0) rotate(${(dx / (g.current?.w || 320)) * 9}deg)` : '';
    const p = Math.max(-1, Math.min(1, (dx * sens) / ((g.current?.w || 320) * SEUIL)));
    e.style.setProperty('--p', p.toFixed(3));
    e.parentElement?.style.setProperty('--avance', Math.abs(p).toFixed(3));
    // Le seuil franchi : un tout petit retour au toucher, une fois par passage (la carte partira si on lâche ici)
    const s = g.current; if (!s) return;
    const arme = Math.abs(p) >= 1 ? Math.sign(p) : 0;
    if (arme && arme !== s.arme) vibrer(8);
    s.arme = arme;
  };
  // La carte revient au centre, avec un léger rebond
  const ramener = () => {
    const e = el.current; if (!e) return;
    e.classList.add('ressort'); poser(0, 0);
    setTimeout(() => el.current?.classList.remove('ressort'), 400);
  };
  const down = e => {
    if (!dessus || (e.pointerType === 'mouse' && e.button !== 0) || e.target.closest('button, a')) return;
    const c = el.current;
    // Prise pendant le geste montré (onTouche, voir « match-guide ») : elle reste où elle penchait, le doigt la reprend de
    // là (ox). Lu avant « tenue », qui arrête la démonstration ; la largeur sans la rotation, comme au repos.
    const t = onTouche ? getComputedStyle(c).transform : 'none';
    const ox = t && t !== 'none' ? new DOMMatrixReadOnly(t).e : 0;
    fini.current = null;
    g.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), w: c.offsetWidth, ox, dx: 0, dy: 0, bouge: false, arme: 0, pas: [[e.clientX, performance.now()]] };
    c.classList.add('tenue');
    if (ox) poser(ox, 0);
    // La carte est à toi dès que tu la touches : le geste montré au premier passage s'arrête (glissé, appui ou défilement).
    // Le nouveau rendu ne touche qu'à la pile : la classe de la carte (et « tenue ») ne change pas.
    onTouche?.();
  };
  const move = e => {
    const s = g.current; if (!s || e.pointerId !== s.id) return;
    s.dx = e.clientX - s.x0; s.dy = e.clientY - s.y0;
    s.pas.push([e.clientX, performance.now()]); if (s.pas.length > 6) s.pas.shift();
    if (!s.bouge) {
      if (Math.hypot(s.dx, s.dy) < 7) return;
      // Un geste surtout vertical laisse défiler la page
      if (Math.abs(s.dy) > Math.abs(s.dx) * 1.2 && e.pointerType !== 'mouse') { g.current = null; fini.current = { bouge: true }; el.current.classList.remove('tenue'); if (s.ox) ramener(); return; }
      s.bouge = true; try { el.current.setPointerCapture(e.pointerId); } catch { /* */ }
    }
    poser(s.ox + s.dx, s.dy * 0.25);
  };
  const up = e => {
    const s = g.current; if (!s || e.pointerId !== s.id) return;
    g.current = null; el.current.classList.remove('tenue');
    fini.current = { bouge: s.bouge, long: performance.now() - s.t0 >= 600 };
    // Un simple appui : le détail s'ouvre au clic qui suit (voir clic), pas ici. Ouvert au relâchement, la feuille
    // arrivait sous le doigt et le clic du téléphone tombait sur son fond, qui la refermait aussitôt.
    if (!s.bouge) { if (s.ox) ramener(); return; }
    const [x1, t1] = s.pas[0]; const v = (e.clientX - x1) / Math.max(1, performance.now() - t1);
    // Où est la carte (prise en route, elle partait de ox) ; un geste vif compte dans le sens du doigt
    const dx = s.ox + s.dx;
    const dir = Math.abs(dx) > s.w * SEUIL ? Math.sign(dx) : Math.abs(v) > VITESSE && Math.abs(s.dx) > 24 && Math.sign(v) === Math.sign(s.dx) ? Math.sign(s.dx) : 0;
    if (dir && e.type === 'pointerup') { onChoix(dir * sens > 0 ? 'oui' : 'plus_tard', { dx, dy: s.dy * 0.25, w: s.w }); return; }
    // Pas assez loin : la carte revient au centre
    ramener();
  };
  const clic = e => {
    const f = fini.current; fini.current = null;
    if (!dessus || e.target.closest('button, a') || f?.bouge || f?.long) return;
    // Un appui sur l'aperçu du CV l'ouvre en grand ; ailleurs, le profil
    if (e.target.closest('[data-lire]') && onLire) onLire(); else detail();
  };
  // La carte qui part : depuis là où le doigt l'a lâchée, vers le côté choisi
  const depart = vol ? (vol.choix === 'oui' ? 1 : -1) * sens : 0;
  const style = vol ? `--x0:${vol.from?.dx || 0}px;--y0:${vol.from?.dy || 0}px;--r0:${((vol.from?.dx || 0) / (vol.from?.w || 320)) * 9}deg;--dir:${depart};--p:${(vol.choix === 'oui' ? 1 : -1) * (vol.from ? 1 : 0.6)}` : `--rang:${rang}`;
  const o = carte.offre, p = carte.profil;
  const tid = 'mx-t-' + carte.cle.replace(/:/g, '-') + (vol ? '-vol' : '');
  if (sponso) return html`<article ref=${el} class=${cls}
    style=${style} aria-hidden=${dessus ? null : 'true'} inert=${dessus ? null : true} aria-labelledby=${dessus ? `${tid}-m ${tid}` : null}
    onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up} onClick=${clic}>
    <${Tampons}/>
    <${CorpsSponsorise} s=${carte.sponsorise} tid=${tid}/>
    <${PiedSponsorise} s=${carte.sponsorise} onVoir=${dessus ? onVoir : null}/>
  </article>`;
  const cv = carte.sorte === 'etudiant' && p?.cv_path && (ctx.store.voitChamp?.(p, 'cv') ?? true);
  return html`<article ref=${el} class=${cls + (revenue && dessus ? ' revenue' : '') + (carte.interet ? ' avec-interet' : '') + (cv ? ' avec-cv' : '')}
    style=${style} aria-hidden=${dessus ? null : 'true'} inert=${dessus ? null : true} aria-labelledby=${dessus ? tid : null}
    onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up} onClick=${clic}>
    <${Tampons}/>
    ${carte.interet ? html`<p class="mx-interet"><${Icon} name=${carte.sorte === 'laureat' ? 'spark' : 'check'} size=${16}/>${carte.sorte === 'laureat' ? html`<span>${`${prenom(p)} s’intéresse à ton profil`}</span>`
      : html`<span class="mx-int-txt"><span>Ton offre l’intéresse</span><span class="mx-int-o" translate="no" dir="auto">${titreOffre(carte.interet.offre)}</span></span>`}</p>` : null}
    ${carte.sorte === 'offre' ? html`<${CorpsOffre} ctx=${ctx} carte=${carte} tid=${tid}/>` : carte.sorte === 'etudiant' ? html`<${CorpsEtudiant} ctx=${ctx} carte=${carte} tid=${tid} onLire=${dessus ? onLire : null}/>` : html`<${CorpsLaureat} ctx=${ctx} carte=${carte} tid=${tid}/>`}
    <${PiedCarte} ctx=${ctx} carte=${carte} onDetail=${dessus ? detail : null} libelle=${o ? 'Voir l’offre' : 'Voir le profil'}/>
  </article>`;
}

// Les tampons, qui paraissent avec le geste : « Intéressé » (coche) et « Plus tard » (horloge)
const Tampons = () => html`<span class="mx-tampon mx-t-oui" aria-hidden="true"><${Icon} name="check" size=${20}/><span>Intéressé</span></span>
  <span class="mx-tampon mx-t-non" aria-hidden="true"><${Icon} name="clock" size=${19}/><span>Plus tard</span></span>`;

// Le pied : « Pourquoi toi » (des raisons vraies), et le détail
function PiedCarte({ ctx, carte, onDetail, libelle }) {
  const raisons = useMemo(() => raisonsCarte(carte, ctx.me, ctx.store, ctx.data), [carte, ctx.me]);
  return html`<footer class="mx-c-pied">
    ${raisons.length ? html`<div class="mx-pourquoi">
      <p class="mx-pq-t">${carte.sorte === 'offre' ? 'Pourquoi toi' : 'Pourquoi ce profil'}</p>
      <ul class="mx-pq">${raisons.map(r => html`<li><${Icon} name="check" size=${14}/><span>${r}</span></li>`)}</ul>
    </div>` : html`<span class="mx-pourquoi"></span>`}
    ${onDetail ? html`<button type="button" class="btn tiny ghost mx-detail" onClick=${onDetail}>${libelle} <${Icon} name="arrow" size=${14}/></button>` : null}
  </footer>`;
}

// Une carte sponsorisée : marquée « Sponsorisé », le logo et le nom de l'entreprise sur son voile, son titre et son texte
// (écrits par l'administration, gardés tels quels en arabe). Même allure que les autres cartes : rien qui clignote ni qui crie.
export function CorpsSponsorise({ s, tid }) {
  return html`<div class="mx-corps mx-sponso">
    <${Voile} nom=${s.entreprise}>
      <p class="mx-s-marque" id=${tid ? tid + '-m' : null}>Sponsorisé</p>
      <div class="mx-v-ent"><${Logo} nom=${s.entreprise} lien=${s.lien} domaine=${s.domaine} taille=${64}/>
        <span class="mx-v-txt"><strong translate="no" dir="auto">${s.entreprise}</strong></span></div>
    <//>
    <div class="mx-txt">
      <h2 class="mx-c-titre" id=${tid} translate="no" dir="auto">${s.titre}</h2>
      <p class="mx-c-desc mx-s-texte" translate="no" dir="auto">${s.texte}</p>
    </div>
  </div>`;
}
// Son pied : le site qu'ouvre « Voir » (dans un nouvel onglet), et « Voir », sans fond plein (« Intéressé » reste le seul)
function PiedSponsorise({ s, onVoir }) {
  const site = siteDe(s.lien);
  return html`<footer class="mx-c-pied">
    <p class="mx-s-site">${site ? html`<${Icon} name="link" size=${15}/><span dir="ltr" translate="no">${site}</span>` : null}</p>
    ${onVoir !== null ? html`<a class="btn tiny ghost mx-detail mx-s-voir" href=${s.lien} target="_blank" rel="noopener sponsored" onClick=${() => onVoir?.()}>Voir <${Icon} name="arrow" size=${14}/></a>` : null}
  </footer>`;
}
// L'aperçu de l'administration (admin.js) : la carte telle qu'elle paraît dans Match, « Voir » ouvre le lien sans rien compter
export function ApercuSponsorise({ s }) {
  const ref = useRef(); useCoupes(ref, s);
  return html`<div class="mx-apercu" ref=${ref}><article class="mx-carte sponso dessus" aria-label="Aperçu dans Match">
    <${CorpsSponsorise} s=${s}/><${PiedSponsorise} s=${s}/>
  </article></div>`;
}

// Une offre : le logo en grand sur le voile de l'entreprise (avec son nom et sa ville), le titre, au plus trois puces,
// puis qui la propose (visage, nom, promo)
function CorpsOffre({ carte, tid }) {
  const o = carte.offre, p = carte.profil;
  const lieu = [o.ville, o.pays && o.pays !== 'Maroc' ? o.pays : null].filter(Boolean).join(', ');
  return html`<div class="mx-corps mx-c-offre">
    <${Voile} nom=${o.entreprise}>
      <div class="mx-v-ent"><${Logo} nom=${o.entreprise} lien=${o.lien} taille=${68}/>
        <span class="mx-v-txt"><strong translate="no" dir="auto">${o.entreprise}</strong>${lieu ? html`<span translate="no" dir="auto">${lieu}</span>` : null}</span></div>
    <//>
    <div class="mx-txt">
      <h2 class="mx-c-titre" id=${tid} translate="no" dir="auto">${titreOffre(o)}</h2>
      <div class="mx-puces">
        <span class=${'mx-puce fort t-' + o.type}><${Icon} name=${TYPE_ICON[o.type] || 'briefcase'} size=${15}/> ${TYPES[o.type]?.label || o.type}</span>
        ${o.duree ? html`<span class="mx-puce" translate="no" dir="auto">${o.duree}</span>` : null}
        ${o.remunere ? html`<span class="mx-puce">Rémunéré</span>` : null}
      </div>
      ${p ? html`<p class="mx-c-qui"><${Avatar} p=${p} size=${36}/><span class="mx-qui-txt">
        <span class="mx-qui-n">${estPortee(o) ? `Portée par ${prenom(p)}, qui encadre` : `Proposée par ${prenom(p)}`}</span>
        <span class="mx-qui-m">${roleTexte(p, true)}${p.filiere ? html` · <span title=${p.filiere}>${filiereCourte(p.filiere)}</span>` : null}</span></span></p>` : null}
      ${o.description ? html`<p class="mx-c-desc mx-o-desc" translate="no" dir="auto">${o.description}</p>` : null}
    </div>
  </div>`;
}

// L'étudiant vu par un lauréat : son CV en grand quand il le partage (la place de la grande photo), puis qui il est,
// ce qu'il cherche et trois compétences. Sans CV partagé, son visage sur un voile, sa présentation, et un encadré sobre.
function CorpsEtudiant({ ctx, carte, tid, onLire }) {
  const { data, store, saison } = ctx; const p = carte.profil;
  const n = niveauOf(p, saison);
  const voit = c => store.voitChamp?.(p, c) ?? true;
  const d = derniereDemande(data, p.id);
  const comp = voit('presentation') ? (p.competences || []).slice(0, 3) : [];
  const pdf = voit('cv') ? p.cv_path : null;
  const lien = !pdf && voit('cv') ? p.cv_url : null;
  const meta = html`<p class="mx-c-meta"><span>${NIVEAUX[n]?.short || ''}</span> · <span title=${p.filiere}>${filiereCourte(p.filiere)}</span>${voit('lieu') && p.ville ? html` · <span translate="no">${p.ville}</span>` : null}</p>`;
  const cherche = d ? html`<p class="mx-cherche"><span class=${'mx-ch-ico t-' + d.type}><${Icon} name=${TYPE_ICON[d.type] || 'briefcase'} size=${15}/></span>
      <span class="mx-ch-txt"><span class="mx-ch-l">${CHERCHE[d.type] || 'Sa recherche'}</span><span class="mx-cherche-t" translate="no" dir="auto">${d.titre}</span></span></p>` : null;
  const puces = comp.length ? html`<div class="mx-puces">${comp.map(c => html`<span class="mx-puce" translate="no" dir="auto">${c}</span>`)}</div>` : null;
  if (pdf) return html`<div class="mx-corps mx-personne avec-cv">
    <${ApercuCV} store=${store} path=${pdf} nom=${p.full_name} onLire=${onLire}/>
    <div class="mx-txt">
      <div class="mx-p-ligne"><${Avatar} p=${p} size=${40}/><div class="mx-p-id">
        <h2 class="mx-c-nom" id=${tid} translate="no">${p.full_name}</h2>${meta}</div></div>
      ${cherche}${puces}
    </div>
  </div>`;
  return html`<div class="mx-corps mx-personne">
    <${Voile} teinte=${styleEntreprise(p.id)} cls="mx-v-perso">
      <div class="mx-v-ent"><span class="mx-v-visage"><${Avatar} p=${p} size=${72}/></span><span class="mx-v-txt">
        <h2 class="mx-c-nom" id=${tid} translate="no">${p.full_name}</h2>${meta}</span></div>
    <//>
    <div class="mx-txt">
      ${cherche}${puces}
      ${voit('presentation') && p.bio ? html`<p class="mx-c-desc" translate="no" dir="auto">${p.bio}</p>` : null}
      ${lien ? html`<a class="mx-cv-absent lien" href=${/^https?:\/\//i.test(lien) ? lien : 'https://' + lien} target="_blank" rel="noopener"><${Icon} name="file" size=${16}/><span>Voir son CV (lien)</span></a>`
        : html`<p class="mx-cv-absent"><${Icon} name="file" size=${16}/><span>CV pas encore partagé</span></p>`}
    </div>
  </div>`;
}

// Un lauréat qui s'intéresse à l'étudiant : son visage sur le voile de son entreprise (et le logo en pastille), son poste
// et sa promo ; puis son offre ouverte pour toi s'il en a une (type, ville, durée, et ce qu'elle dit), trois compétences ;
// sans offre, sa présentation ou ce sur quoi il aide (mentorat)
function CorpsLaureat({ ctx, carte, tid }) {
  const { store } = ctx; const p = carte.profil; const o = carte.interet?.offre;
  const voit = c => store.voitChamp?.(p, c) ?? true;
  const ent = voit('travail') ? p.entreprise : '';
  // Une espace insécable avant le point : sur deux lignes, le point reste à la fin de la première, jamais en tête de la seconde
  const travail = voit('travail') ? [p.poste, p.entreprise].filter(Boolean).join('\u00a0· ') : '';
  const comp = voit('presentation') ? (p.competences || []).slice(0, 3) : [];
  const offreLieu = o ? [o.ville, o.duree].filter(Boolean).join(' · ') : '';
  return html`<div class="mx-corps mx-personne">
    <${Voile} nom=${ent || null} teinte=${ent ? null : styleEntreprise(p.id)} cls="mx-v-perso">
      <div class="mx-v-ent"><span class="mx-v-visage"><${Avatar} p=${p} size=${72}/>${ent ? html`<span class="mx-v-badge"><${Logo} nom=${ent} taille=${28}/></span>` : null}</span>
        <span class="mx-v-txt"><h2 class="mx-c-nom" id=${tid} translate="no">${p.full_name}</h2>
          ${travail ? html`<span translate="no" dir="auto">${travail}</span>` : null}
          <span class="mx-v-promo">${`Promo ${p.promo}`}${p.filiere ? html` · <span title=${p.filiere}>${filiereCourte(p.filiere)}</span>` : null}</span></span></div>
    <//>
    <div class="mx-txt">
      ${o ? html`<div class="mx-son-offre"><${Logo} nom=${o.entreprise} lien=${o.lien} taille=${44}/><span><span class="mx-so-l">Son offre pour toi</span>
        <span class="mx-so-t" translate="no" dir="auto">${titreOffre(o)}</span>
        <span class="mx-so-m"><span>${TYPES[o.type]?.label || o.type}</span>${offreLieu ? html` · <span translate="no" dir="auto">${offreLieu}</span>` : null}</span></span></div>` : null}
      ${comp.length ? html`<div class="mx-puces">${comp.map(c => html`<span class="mx-puce" translate="no" dir="auto">${c}</span>`)}</div>` : null}
      ${o?.description ? html`<p class="mx-c-desc mx-o-desc" translate="no" dir="auto">${o.description}</p>`
        : voit('presentation') && p.bio ? html`<p class="mx-c-desc" translate="no" dir="auto">${p.bio}</p>`
        : p.mentor_dispo && p.mentor_sujets ? html`<p class="mx-c-aide"><${Icon} name="mentor" size=${16}/><span><span class="mx-ca-l">Aide les étudiants sur</span> <span translate="no" dir="auto">${p.mentor_sujets}</span></span></p>` : null}
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Sur grand écran, à côté de la pile : « En bref », ce que la carte du dessus ne dit pas en entier (la description,
// la recherche, la présentation), pour choisir sans ouvrir la fiche. Caché sur téléphone (la fiche s'ouvre d'un appui).
// ---------------------------------------------------------------------------
function EnBref({ ctx, carte, onDetail }) {
  const { data, store, saison } = ctx;
  if (!carte || carte.sorte === 'sponsorise') return html`<aside class="mx-bref vide" aria-hidden="true"></aside>`;
  const p = carte.profil, voit = c => (p ? store.voitChamp?.(p, c) ?? true : false);
  // Une offre en quelques lignes : filières, années, durée, date limite
  const fiche = o => {
    const lignes = [['Filières', o.filieres?.length ? resumeFilieres(o.filieres).join(' · ') : 'Toutes les filières'],
      ['Pour', (o.annees || []).map(n => NIVEAUX[n]?.short).filter(Boolean).join(', ')], ['Durée', o.duree], ['Date limite', o.deadline ? fmtDate(o.deadline + 'T12:00:00') : '']].filter(([, v]) => v);
    return html`<dl class="mx-bref-dl">${lignes.map(([k, v]) => html`<div><dt>${k}</dt><dd translate=${k === 'Durée' ? 'no' : null} dir=${k === 'Durée' ? 'auto' : null}>${v}</dd></div>`)}</dl>`;
  };
  let corps;
  if (carte.sorte === 'offre') {
    const o = carte.offre;
    corps = html`${o.description ? html`<p class="mx-bref-texte" translate="no" dir="auto">${o.description}</p>` : null}${fiche(o)}`;
  } else {
    const d = carte.sorte === 'etudiant' ? derniereDemande(data, p.id) : null;
    const o = carte.interet?.offre;
    corps = html`${d ? html`<div class="mx-bref-bloc"><p class="mx-bref-l">Sa recherche</p><p class="mx-bref-fort" translate="no" dir="auto">${d.titre}</p>
        ${d.details ? html`<p class="mx-bref-texte" translate="no" dir="auto">${d.details}</p>` : null}
        ${d.lieu || d.duree ? html`<p class="mx-bref-meta" translate="no" dir="auto">${[d.lieu, d.duree].filter(Boolean).join('\u00a0· ')}</p>` : null}</div>` : null}
      ${carte.sorte === 'laureat' && o ? html`<div class="mx-bref-bloc"><p class="mx-bref-l">Son offre</p><p class="mx-bref-fort" translate="no" dir="auto">${titreOffre(o)}</p>
        ${o.description ? html`<p class="mx-bref-texte" translate="no" dir="auto">${o.description}</p>` : null}</div>${fiche(o)}` : null}
      ${voit('presentation') && p.bio ? html`<div class="mx-bref-bloc"><p class="mx-bref-l">Présentation</p><p class="mx-bref-texte" translate="no" dir="auto">${p.bio}</p></div>` : null}
      ${carte.sorte === 'etudiant' ? html`<dl class="mx-bref-dl">${[
        ['Filière', p.filiere], ['Année', NIVEAUX[niveauOf(p, saison)]?.label], ['Ville', voit('lieu') ? p.ville : '', true],
        ['Disponibilité', voit('presentation') ? p.disponibilite : '', true],
        ['Compétences', voit('presentation') && (p.competences || []).length > 3 ? p.competences.join(' · ') : '', true],
      ].filter(([, v]) => v).map(([k, v, membre]) => html`<div><dt>${k}</dt><dd translate=${membre ? 'no' : null} dir=${membre ? 'auto' : null}>${v}</dd></div>`)}</dl>`
      : html`${voit('presentation') && (p.competences || []).length > 3 ? html`<div class="mx-bref-bloc"><p class="mx-bref-l">Compétences</p><p class="mx-bref-texte" translate="no" dir="auto">${p.competences.join(' · ')}</p></div>` : null}`}`;
  }
  return html`<aside class="mx-bref" aria-label="En bref">
    <p class="mx-bref-t">En bref</p>
    ${corps}
    <button type="button" class="btn small tonal mx-bref-voir" onClick=${onDetail}>${carte.offre ? 'Voir l’offre en entier' : 'Voir le profil en entier'} <${Icon} name="arrow" size=${15}/></button>
  </aside>`;
}

// ---------------------------------------------------------------------------
// « Tes matchs » : les visages, le plus récent d'abord, toujours au même endroit (l'en-tête, avec ou sans cartes) ; un
// anneau orange sur un match pas encore vu, qui s'annonce une fois en arrivant.
// ---------------------------------------------------------------------------
export function MesMatchs({ ctx }) {
  const { data, me, store, go } = ctx;
  const ms = matchsDe(data, me);
  if (!ms.length) return null;
  const ouvrir = x => { if (x.nouveau) store.vuMatch(x.m.id).catch(() => {}); ctx.ecrire ? ctx.ecrire(x.autre.id) : go('messages/' + x.autre.id); };
  return html`<section class="mx-matchs" aria-labelledby="mx-h-matchs">
    <h2 class="mx-h" id="mx-h-matchs">Tes matchs <span class="count">${ms.length}</span></h2>
    <ul class="mx-rangee">${ms.map(x => html`<li key=${x.m.id}>
      <button type="button" class=${'mx-visage' + (x.nouveau ? ' nouveau' : '')} onClick=${() => ouvrir(x)}>
        <span class="mx-anneau"><${Avatar} p=${x.autre} size=${42}/></span>
        <span class="mx-v-nom" translate="no">${prenom(x.autre)}</span>
        ${x.nouveau ? html`<span class="sr-only">Nouveau match</span>` : null}
      </button></li>`)}</ul>
  </section>`;
}

// ---------------------------------------------------------------------------
// Plus de carte : « Tu as tout vu », le bilan vrai de la visite, ce qui va arriver (et quand), une seule action. Tes matchs
// restent dans l'en-tête, là où ils étaient pendant la pile : la fin tient dans l'écran, sans défiler.
// ---------------------------------------------------------------------------
function PileVide({ ctx, bilan, onPublier, revenir }) {
  const { me, data, saison, go } = ctx;
  const etu = me.role === 'etudiant';
  // Sur téléphone, la fin prend la place de la pile : jusqu'au-dessus de la barre du bas, son contenu au milieu ; ce qui
  // suit (« Les lauréats voient aussi ta carte ») commence sous la barre, jamais à moitié caché derrière
  const ref = useRef();
  useLayoutEffect(() => {
    const v = ref.current; if (!v) return;
    const ajuste = () => {
      const bas = document.querySelector('.bottom-nav')?.offsetHeight || 0;
      if (!bas) return v.style.removeProperty('--h-fin');
      let haut = 0; for (let e = v; e; e = e.offsetParent) haut += e.offsetTop;
      const ecart = parseFloat(getComputedStyle(v.parentElement).rowGap) || 16;
      v.style.setProperty('--h-fin', Math.round(innerHeight - haut - bas - ecart) + 'px');
    };
    ajuste(); addEventListener('resize', ajuste);
    let vivant = true; document.fonts?.ready.then(() => vivant && ajuste());
    return () => { vivant = false; removeEventListener('resize', ajuste); };
  }, []);
  const demande = etu && typesDemande(me, saison).length && demandesActives(data, me.id).length < DEMANDES_MAX;
  const oui = bilan.filter(x => x.choix === 'oui').length, tard = bilan.length - oui;
  const suite = [
    ['clock', `Les cartes « Plus tard » reviennent ${MATCH_PLUS_TARD_JOURS} jours après ton choix.`],
    ['spark', etu ? 'Chaque nouvelle offre de lauréat pour ton année arrive ici.' : 'Chaque nouvel étudiant du cycle ingénieur arrive ici dès son inscription.'],
    ['check', etu ? 'Un lauréat qui s’intéresse à ton profil passe avant tout le reste.' : 'Une offre publiée fait venir les étudiants : ceux qui disent oui passent en premier.'],
  ];
  return html`<section class="mx-vide" ref=${ref} aria-labelledby="mx-vide-t">
    <div class="mx-vide-scene" aria-hidden="true"><span></span><span></span><span><svg viewBox="0 0 24 24" width="32" height="32"><path class="mx-trait" d="m5.5 12.5 4.2 4.2 8.8-9.2"/></svg></span></div>
    <h2 id="mx-vide-t">Tu as tout vu</h2>
    ${bilan.length ? html`<div class="mx-bilan" role="group" aria-label="Cette visite">
      <p class="mx-bl-t">Cette visite</p>
      <p class="mx-bl-n"><span class=${'mx-bl-oui' + (oui ? ' vif' : '')}><${Compte} n=${oui}/><span>Intéressé</span></span><span class="mx-bl-tard"><${Compte} n=${tard}/><span>Plus tard</span></span></p>
    </div>` : null}
    <${LignePrevenir} ctx=${ctx} raison="match" fil="match" attente=${oui > 0}/>
    <ul class="mx-suite">${suite.map(([i, t]) => html`<li><span class="mx-s-ico"><${Icon} name=${i} size=${16}/></span><span>${t}</span></li>`)}</ul>
    <div class="mx-vide-acts">
      ${etu ? (demande ? html`<button type="button" class="btn primary" onClick=${() => go('offres/demandes/nouvelle')}><${Icon} name="send" size=${18}/> Publier ma demande</button>`
        : html`<button type="button" class="btn primary" onClick=${() => go('offres')}><${Icon} name="feed" size=${18}/> Voir les offres</button>`)
        : html`<button type="button" class="btn primary" onClick=${onPublier}><${Icon} name="plus" size=${18}/> Publier une offre</button>`}
      ${revenir ? html`<button type="button" class="linkish small" onClick=${revenir}><${Icon} name="undo" size=${15}/> Revenir sur mon dernier choix</button>` : null}
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// La fête du match, plein écran : les deux visages se rejoignent, le sceau se pose et sa coche se dessine (un léger
// retour au toucher à ce moment-là), « C'est un match ! », une seule action pleine. Sans mouvement : tout paraît d'un coup.
// ---------------------------------------------------------------------------
const COULEURS = ['var(--accent)', 'var(--orange)', 'var(--em-b)', 'var(--good)'];
// Entre les deux visages, une coche : la mise en relation est faite
const SCEAU = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path class="mx-trait" d="m5.5 12.5 4.2 4.2 8.8-9.2"/></svg>';
function FeteMatch({ f, me, onEcrire, onClose }) {
  const ref = useRef();
  useFeuille(onClose);
  const calme = mouvementReduit();
  const morceaux = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ x: Math.round(Math.random() * 100), dx: Math.round(Math.random() * 120 - 60), d: (1.1 + Math.random() * 0.7).toFixed(2), w: (0.45 + Math.random() * 0.4).toFixed(2), r: Math.round(Math.random() * 540 - 270), c: COULEURS[i % COULEURS.length], rond: i % 3 === 0 })), []);
  useLayoutEffect(() => {
    const avant = document.activeElement;
    ref.current?.querySelector('.mx-fete-ecrire')?.focus();
    // Le petit retour au toucher arrive quand le sceau se pose (tout de suite sans mouvement)
    const t = setTimeout(() => vibrer([12, 60, 12]), calme ? 0 : 420);
    const k = e => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      // La fête garde le focus (Tab tourne entre ses deux boutons)
      if (e.key === 'Tab') { const b = [...ref.current.querySelectorAll('button')]; const i = b.indexOf(document.activeElement); e.preventDefault(); b[(i + (e.shiftKey ? b.length - 1 : 1)) % b.length]?.focus(); }
    };
    document.addEventListener('keydown', k);
    document.documentElement.classList.add('mx-fige');
    return () => { clearTimeout(t); document.removeEventListener('keydown', k); document.documentElement.classList.remove('mx-fige'); if (avant?.isConnected) avant.focus?.(); };
  }, []);
  const o = f.offre;
  return html`<div class=${'mx-fete' + (calme ? ' calme' : '')} role="dialog" aria-modal="true" aria-labelledby="mx-fete-t" aria-describedby="mx-fete-d" ref=${ref}>
    ${calme ? null : html`<div class="fete-pluie" aria-hidden="true">${morceaux.map(m => html`<i class=${m.rond ? 'rond' : ''} style=${`--x:${m.x}%;--dx:${m.dx}px;--d:${m.d}s;--w:${m.w}s;--r:${m.r}deg;--c:${m.c}`}></i>`)}</div>`}
    <div class="mx-fete-in">
      <div class="mx-duo" aria-hidden="true">
        <span class="mx-duo-halo"></span>
        <span class="mx-duo-v mx-duo-a"><${Avatar} p=${me} size=${104}/></span>
        <span class="mx-duo-sceau" dangerouslySetInnerHTML=${{ __html: SCEAU }}></span>
        <span class="mx-duo-v mx-duo-b"><${Avatar} p=${f.autre} size=${104}/></span>
      </div>
      <h2 id="mx-fete-t">C’est un match !</h2>
      <p id="mx-fete-d">${`Toi et ${prenom(f.autre)} pouvez maintenant vous écrire.`}</p>
      ${o ? html`<p class="mx-fete-offre"><${Logo} nom=${o.entreprise} lien=${o.lien} taille=${32}/><span translate="no" dir="auto">${titreOffre(o)}</span></p>` : null}
      <div class="mx-fete-acts">
        <button type="button" class="btn primary mx-fete-ecrire" onClick=${onEcrire}><${Icon} name="chat" size=${18}/> Écrire</button>
        <button type="button" class="btn ghost mx-fete-plus" onClick=${onClose}>Continuer</button>
      </div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Ailleurs sur le site : l'entrée de l'accueil (seulement quand quelqu'un attend une réponse). Apparaître dans Match se
// règle dans Mon profil › Visibilité (« Visible par les lauréats », community.js), avec la Vitrine des talents.
// ---------------------------------------------------------------------------
export function MatchAccueil({ ctx }) {
  const { data, me, go } = ctx;
  const inter = useMemo(() => (['etudiant', 'laureat'].includes(me.role) ? deckMatch(data, me).filter(c => c.interet) : []), [data.match_choix, data.matchs, data.offers, data.profiles, me]);
  if (!inter.length) return null;
  const n = inter.length, p = inter[0].profil, etu = me.role === 'etudiant';
  const titre = etu ? (n === 1 ? `${prenom(p)} s’intéresse à ton profil` : `${n} lauréats s’intéressent à ton profil`)
    : (n === 1 ? `${prenom(p)} s’intéresse à ton offre` : `${n} étudiants s’intéressent à tes offres`);
  return html`<button type="button" class="panel clickable mx-accueil" onClick=${() => go('match')}>
    <${AvatarPile} gens=${inter.map(c => c.profil)} size=${36}/>
    <span class="mx-acc-txt"><strong>${titre}</strong><span class="small muted">Réponds dans Match : si c’est oui des deux côtés, vous pouvez vous écrire.</span></span>
    <${Icon} name="arrow" size=${18}/>
  </button>`;
}

// ---------------------------------------------------------------------------
// Le contenu des cartes : le voile (d'un bord à l'autre), le texte, le pied « Pourquoi toi »
// ---------------------------------------------------------------------------
injectCSS('match-cartes', `
.mx-corps { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; padding-block-end: 14px; margin-block-end: -14px;
  -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 22px), transparent); mask-image: linear-gradient(to bottom, #000 calc(100% - 22px), transparent); }
/* Rien ne se tasse : une ligne coupée à mi-hauteur se lit mal ; sur une carte basse, la description part d'abord */
.mx-corps > * { flex-shrink: 0; }
.mx-corps > .mx-cv-apercu { flex: 1 1 auto; }
/* Le voile prend la place qui reste : une carte n'a jamais de trou blanc sous son texte */
.mx-corps > .mx-voile { flex: 1 0 auto; }
/* Le voile : la couleur de l'entreprise (son logo, sinon son monogramme) ou de la personne, très douce, deux cercles discrets */
.mx-voile { --vc: hsl(var(--h, 210) var(--s, 50%) 48%); position: relative; isolation: isolate; display: flex; flex-direction: column; justify-content: center; gap: .65rem;
  min-block-size: clamp(108px, 29cqh, 178px); padding: 1rem 1.15rem; overflow: hidden;
  background: linear-gradient(155deg, color-mix(in srgb, var(--vc) 30%, var(--surface)) 0%, color-mix(in srgb, var(--vc) 13%, var(--surface)) 58%, color-mix(in srgb, var(--vc) 6%, var(--surface)) 100%); }
.mx-voile::before, .mx-voile::after { content: ""; position: absolute; z-index: -1; border-radius: 50%; pointer-events: none; }
.mx-voile::before { inline-size: 240px; block-size: 240px; inset-block-start: -150px; inset-inline-end: -72px; background: color-mix(in srgb, var(--vc) 17%, transparent); }
.mx-voile::after { inline-size: 132px; block-size: 132px; inset-block-end: -86px; inset-inline-end: 62px; border: 1.5px solid color-mix(in srgb, var(--vc) 26%, transparent); }
.mx-v-ent { display: flex; align-items: center; gap: .95rem; min-width: 0; }
.mx-v-ent > .clogo, .mx-v-visage > .avatar { flex: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--surface) 82%, transparent), 0 12px 26px -12px color-mix(in srgb, var(--vc) 70%, #000); }
.mx-v-ent > .clogo { border-radius: 24%; }
.mx-v-txt { display: flex; flex-direction: column; gap: .2rem; min-width: 0; }
.mx-v-txt > strong { color: var(--ink); font: 700 var(--fs-5)/1.2 var(--f-display); overflow: hidden; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.mx-v-txt > span { color: var(--ink-2); font-size: var(--fs-3); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mx-v-visage { position: relative; flex: none; display: grid; }
.mx-v-badge { position: absolute; inset-block-end: -4px; inset-inline-end: -6px; display: grid; }
.mx-v-badge > .clogo { box-shadow: 0 0 0 2.5px var(--surface); }
/* Un poste long (« Ingénieure maintenance · OCP Group ») passe à la ligne plutôt que d'être coupé */
.mx-v-perso .mx-v-txt > span:not(.mx-v-promo) { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.3; }
/* Un titre sur deux ou trois lignes : des lignes de longueur voisine, jamais un mot seul en dessous */
.mx-c-titre, .mx-so-t, .mx-c-nom, .mx-v-txt > strong, .mx-v-perso .mx-v-txt > span:not(.mx-v-promo) { text-wrap: balance; }
/* Quelqu'un attend ta réponse : un bandeau d'un bord à l'autre, au-dessus de tout */
.mx-interet { flex: none; display: flex; align-items: center; gap: .5rem; margin: 0; padding: .55rem 1.15rem; background: var(--brass-soft); color: var(--brass); font-size: var(--fs-3); font-weight: 650; line-height: 1.3;
  border-block-end: 1px solid color-mix(in srgb, var(--brass) 22%, transparent); }
.mx-interet > .ico { flex: none; }
.mx-interet > span:last-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mx-interet > span.mx-int-txt { display: flex; flex-direction: column; }
.mx-int-o { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--fs-2); font-weight: 600; color: var(--ink-2); }
/* Le texte */
.mx-txt { display: flex; flex-direction: column; gap: .62rem; min-width: 0; padding: .95rem 1.15rem .3rem; }
.mx-txt > * { flex-shrink: 0; }
.mx-c-titre { margin: 0; color: var(--ink); font: 700 var(--fs-6)/1.22 var(--f-display); letter-spacing: -.005em; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.mx-puces { display: flex; flex-wrap: wrap; gap: .4rem; }
.mx-puce { display: inline-flex; align-items: center; gap: .3rem; padding: .3rem .7rem; border-radius: var(--r-pill); background: var(--surface-2); color: var(--ink-2); font-size: var(--fs-2); font-weight: 600; line-height: 1.3; max-width: 100%; }
.mx-puce.fort { background: var(--tonal-bg); color: var(--tonal-ink); }
.mx-c-desc { margin: 0; color: var(--ink-2); font-size: var(--fs-3); line-height: 1.5; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.mx-c-qui { display: flex; align-items: center; gap: .65rem; margin: .1rem 0 0; min-width: 0; }
.mx-c-qui > .avatar { flex: none; }
.mx-qui-txt { display: flex; flex-direction: column; gap: .05rem; min-width: 0; }
.mx-qui-n { color: var(--ink); font-size: var(--fs-3); font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mx-qui-m { color: var(--muted); font-size: var(--fs-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mx-c-nom { margin: 0; color: var(--ink); font: 700 var(--fs-5)/1.2 var(--f-display); overflow-wrap: anywhere; }
.mx-v-txt > .mx-c-nom { font-size: var(--fs-6); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.mx-c-meta { margin: 0; color: var(--ink-2); font-size: var(--fs-3); font-weight: 600; }
.mx-p-ligne { display: flex; align-items: center; gap: .7rem; min-width: 0; }
.mx-p-ligne > .avatar { flex: none; }
.mx-p-id { display: flex; flex-direction: column; gap: .12rem; min-width: 0; }
.mx-p-id .mx-c-nom { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Ce que l'étudiant cherche : une ligne, l'icône du type à côté */
.mx-cherche { display: flex; align-items: center; gap: .6rem; margin: 0; min-width: 0; }
.mx-ch-ico { flex: none; display: grid; place-items: center; inline-size: 32px; block-size: 32px; border-radius: 50%; background: var(--tonal-bg); color: var(--tonal-ink); }
.mx-ch-txt { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
.mx-ch-l { color: var(--muted); font-size: var(--fs-1); font-weight: 650; }
.mx-cherche-t { color: var(--ink); font-size: var(--fs-3); font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Son offre (un lauréat) : le logo, le titre, le type, la ville et la durée, sans encadré */
.mx-son-offre { display: flex; align-items: center; gap: .7rem; min-width: 0; }
.mx-son-offre > .clogo { flex: none; }
.mx-son-offre > span:last-child { display: flex; flex-direction: column; gap: .08rem; min-width: 0; }
.mx-so-l { color: var(--muted); font-size: var(--fs-1); font-weight: 650; }
.mx-so-t { font-weight: 650; color: var(--ink); line-height: 1.3; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.mx-so-m { color: var(--ink-2); font-size: var(--fs-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* La promo sur le voile : --ink-2, car --muted sur la teinte du voile passe sous 4,5:1 la nuit */
.mx-v-txt > .mx-v-promo { color: var(--ink-2); font-size: var(--fs-2); font-weight: 600; }
/* Ce sur quoi un lauréat aide (mentorat), quand il n'a pas écrit de présentation */
.mx-c-aide { display: flex; align-items: flex-start; gap: .5rem; margin: 0; color: var(--ink-2); font-size: var(--fs-3); line-height: 1.45; }
.mx-c-aide > .ico { flex: none; margin-block-start: .1rem; color: var(--blue-text); }
.mx-ca-l { color: var(--muted); }
/* Pas de CV partagé : un encadré sobre (ou le lien vers son CV) */
.mx-cv-absent { align-self: flex-start; display: inline-flex; align-items: center; gap: .45rem; margin: 0; padding: .45rem .8rem; border: 1.5px dashed var(--line-strong); border-radius: var(--r-md); color: var(--muted); font-size: var(--fs-2); font-weight: 600; }
a.mx-cv-absent.lien { min-height: 44px; border-style: solid; color: var(--blue-text); text-decoration: none; }
/* Le pied : « Pourquoi toi », des raisons vraies, et le détail */
.mx-c-pied { flex: none; display: flex; align-items: center; justify-content: space-between; gap: .6rem; margin: 0 1.15rem; padding: .7rem 0 .8rem; border-block-start: 1px solid var(--line); }
.mx-pourquoi { min-width: 0; }
.mx-pq-t { margin: 0 0 .3rem; color: var(--muted); font-size: var(--fs-1); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.mx-pq { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .22rem; }
.mx-pq li { display: flex; align-items: center; gap: .4rem; min-width: 0; color: var(--ink); font-size: var(--fs-2); font-weight: 600; line-height: 1.35; }
.mx-pq li .ico { flex: none; color: var(--good); }
/* Une raison longue (« Lean et VSM, dans ton profil » à 360 px) passe à la ligne plutôt que d'être coupée */
.mx-pq li { align-items: flex-start; }
.mx-pq li .ico { margin-block-start: .12rem; }
.mx-pq li > span { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.mx-detail { flex: none; min-height: 44px; }
/* Une carte haute (grand écran) : le logo et le visage grandissent avec leur voile */
@container carte (min-height: 520px) { .mx-v-ent > .clogo, .mx-v-visage { zoom: 1.15; } .mx-v-ent { gap: 1.15rem; } }
/* Le visage d'une personne au centre de son voile, quand il est assez haut (Voile) : comme l'en-tête d'un profil */
.mx-v-perso.haut .mx-v-ent { flex-direction: column; gap: .75rem; text-align: center; }
.mx-v-perso.haut .mx-v-txt { align-items: center; }
/* Sur le voile d'une personne, le petit cercle descend dans le coin, sous le visage : loin du texte qu'il barrerait sinon */
.mx-v-perso::after { inset-inline-end: auto; inset-inline-start: -64px; inset-block-end: -74px; }
/* En arabe, un texte resté en français (dir="auto") garde son sens (la ponctuation à sa place) et rejoint le bord droit
   avec le reste de la carte, sur une ou deux lignes comme sur trois. Deux exceptions gardent l'alignement du français :
   un paragraphe (la description, plus lisible ainsi sur plusieurs lignes), et un titre trop long, coupé (data-coupe,
   voir useCoupes) — Chrome perd les points de suspension d'une ligne coupée alignée à droite. Au centre sur un voile
   centré. De même dans « En bref ». */
[dir="rtl"] :is(.mx-carte, .mx-bref) [dir="auto"]:not(.mx-c-desc, .mx-bref-texte, [data-coupe]) { text-align: right; }
[dir="rtl"] .mx-v-perso.haut .mx-v-txt > [dir="auto"] { text-align: center; }
/* Une carte basse (petit écran) : tout se resserre pour que l'essentiel reste visible */
@container carte (max-height: 560px) { .avec-cv .mx-puces { display: none; } }
@container carte (max-height: 500px) {
  .mx-pq li:nth-child(n+3) { display: none; }
  .mx-voile { min-block-size: 100px; padding-block: .8rem; }
}
/* Jusqu'à 480 px (la carte d'un téléphone de 390 × 844 avec le bandeau de démo, sous la coque compacte du Socle) : le texte
   reste court pour que le voile d'une personne garde la place de son visage au centre ; plus haute, la carte dit davantage */
@container carte (max-height: 480px) {
  .mx-pq-t { display: none; }
  .mx-c-desc { -webkit-line-clamp: 2; }
  .mx-c-titre { -webkit-line-clamp: 2; font-size: var(--fs-5); }
  .mx-txt { gap: .45rem; padding-block-start: .75rem; }
  .mx-c-pied { padding-block: .5rem .6rem; }
}
@container carte (max-height: 390px) {
  .mx-pq li:nth-child(n+2) { display: none; }
  .mx-c-desc, .mx-c-aide { display: none; }
  .mx-v-ent > .clogo, .mx-v-visage { zoom: .8; }
  .mx-voile { min-block-size: 88px; }
}
`);

injectCSS('match-sponso', `
.mx-s-marque { align-self: flex-start; margin: 0; padding: .2rem .65rem; border-radius: var(--r-pill); background: color-mix(in srgb, var(--surface) 84%, transparent); color: var(--ink-2); font-size: var(--fs-1); font-weight: 650; line-height: 1.4; }
.mx-sponso .mx-s-texte { -webkit-line-clamp: 7; }
.mx-s-site { display: flex; align-items: center; gap: .35rem; margin: 0; min-width: 0; color: var(--muted); font-size: var(--fs-2); }
.mx-s-site > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mx-s-site .ico { flex: none; }
.mx-apercu { position: relative; block-size: 380px; max-inline-size: 420px; }
.mx-apercu .mx-carte { cursor: default; box-shadow: var(--sh2); }
/* Le texte de l'entreprise est tout ce que dit la carte : il garde ses lignes tant que la carte le permet */
@container carte (max-height: 470px) { .mx-sponso .mx-s-texte { -webkit-line-clamp: 5; } }
@container carte (max-height: 420px) { .mx-sponso .mx-s-texte { display: -webkit-box; -webkit-line-clamp: 4; } }
@container carte (max-height: 360px) { .mx-sponso .mx-s-texte { -webkit-line-clamp: 2; } }
`);

// Le premier passage : la carte du dessus montre le geste elle-même — elle penche vers « Intéressé » et son tampon paraît,
// puis vers « Plus tard », puis revient (chaque mouvement 0,4 s au plus, une seule fois, rien sans mouvement) ; en bas,
// une étiquette pleine (jamais transparente sur le texte) dit les deux côtés, et sa pastille suit la carte.
// Ses couleurs sont celles de la page inversées : foncée le jour, claire la nuit (comme une infobulle).
// La pile bouge exactement comme sous le doigt (voir poser) : --mx-montre est la part du seuil (30 % de la largeur), d'où
// le penché (× 9° par largeur), le tampon (--p) et les cartes de derrière qui avancent (--avance). Touchée en route, la
// carte reste donc où elle est (voir down), et choisie au bouton, elle part de là (voir choisir).
injectCSS('match-guide', `
@property --mx-montre { syntax: '<number>'; inherits: true; initial-value: 0; }
/* Sans transition pendant ce temps : elle traînerait derrière le geste (Chrome la relance à chaque image) */
.mx-pile.montre { --avance: max(var(--mx-montre), -1 * var(--mx-montre)); }
.mx-pile.montre > .mx-carte { transition: none; }
.mx-pile.montre > .mx-carte.dessus:not(.tenue) { --p: var(--mx-montre);
  transform: translateX(calc(var(--mx-montre) * var(--sens, 1) * 30%)) rotate(calc(var(--mx-montre) * var(--sens, 1) * 2.7deg)); }
.mx-pile.montre .mx-guide-doigt::after { translate: calc(var(--mx-montre) * var(--sens, 1) * 43px); }
@keyframes mx-montre { 0% { --mx-montre: 0; } 19%, 40% { --mx-montre: .7; } 61%, 80% { --mx-montre: -.7; } 100% { --mx-montre: 0; } }
@media (prefers-reduced-motion: no-preference) { .mx-pile.montre { animation: mx-montre 1.9s cubic-bezier(.45, 0, .25, 1) .7s both; } }
.mx-guide { position: absolute; inset-inline: 14px; inset-block-end: 14px; z-index: 6; margin: 0; padding: .6rem .85rem; display: flex; align-items: center; justify-content: space-between; gap: .7rem;
  border-radius: 16px; background: var(--ink); color: var(--surface); font-size: var(--fs-2); font-weight: 650; pointer-events: none;
  box-shadow: 0 16px 34px -14px rgb(0 0 0 / .55), 0 0 0 1px color-mix(in srgb, var(--surface) 10%, transparent); animation: mx-guide-in .3s ease both; }
.mx-g-cote { display: inline-flex; align-items: center; gap: .3rem; white-space: nowrap; }
.mx-g-non { color: color-mix(in srgb, var(--surface) 82%, var(--ink)); }
.mx-g-oui { color: color-mix(in srgb, var(--good) 36%, var(--surface)); }
.mx-g-non .ico { transform: scaleX(-1); }
[dir="rtl"] .mx-g-non .ico { transform: none; }
[dir="rtl"] .mx-g-oui .ico { transform: scaleX(-1); }
.mx-guide-doigt { position: relative; flex: 1; max-inline-size: 104px; block-size: 20px; border-radius: 10px; background: color-mix(in srgb, var(--surface) 18%, transparent); }
.mx-guide-doigt::after { content: ""; position: absolute; inset-block-start: 2px; inset-inline-start: calc(50% - 8px); inline-size: 16px; block-size: 16px; border-radius: 50%;
  background: var(--surface); box-shadow: 0 0 0 4px color-mix(in srgb, var(--surface) 22%, transparent); }
@keyframes mx-guide-in { from { opacity: 0; transform: translateY(8px); } }
@media (prefers-reduced-motion: reduce) { .mx-guide { animation: none; } }
`);

// La progression, la fin de la pile, « En bref » et la mise en page des grands écrans
injectCSS('match-page', `
.mx-tour { display: flex; align-items: center; gap: .6rem; margin: 0; color: var(--muted); font-size: var(--fs-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
.mx-tour-n { color: var(--ink); font-weight: 700; }
.mx-tour-pts { display: inline-flex; align-items: center; gap: 4px; }
.mx-tour-pts i { inline-size: 6px; block-size: 6px; border-radius: 3px; background: var(--line-strong); transition: inline-size .25s var(--ease), background-color .25s; }
.mx-tour-pts i.fait { background: color-mix(in srgb, var(--accent) 50%, var(--surface)); }
.mx-tour-pts i.ici { inline-size: 16px; background: var(--accent); }
.mx-tour.fini { gap: .45rem; color: var(--good); font-weight: 650; animation: mx-tour-pop .4s cubic-bezier(.34, 1.56, .64, 1) both; }
.mx-tour-coche { display: inline-grid; place-items: center; inline-size: 20px; block-size: 20px; border-radius: 50%; background: var(--good); color: var(--surface); }
.mx-tour-serie { color: var(--muted); font-weight: 500; }
.mx-tour-serie::before { content: "·"; margin-inline-end: .45rem; }
@keyframes mx-tour-pop { from { transform: scale(.94); opacity: .5; } }
@media (prefers-reduced-motion: reduce) { .mx-tour-pts i { transition: none; } .mx-tour.fini { animation: none; } }
/* Dans l'en-tête, le tour du jour tient la place du sur-titre des autres pages : même hauteur de ligne, même bleu,
   pour que « Match » tombe à la hauteur des autres titres ; vert une fois le tour fait */
.mx-tete .mx-tour { block-size: calc(var(--fs-2) * 1.35); line-height: 1.35; color: var(--blue-text); font-weight: 600; }
.mx-tete .mx-tour-n { color: inherit; }
.mx-tete .mx-tour.fini { color: var(--good); font-weight: 650; }
.mx-tete .mx-tour-coche { inline-size: 16px; block-size: 16px; }
[dir="rtl"] .mx-tete .mx-tour:not(.fini) { font-weight: 500; }

/* Plus de carte : trois cartes posées (la dernière coche se dessine), le bilan vrai de la visite, la suite, l'action */
/* Tout tient au-dessus de la barre du bas d'un téléphone (390 × 844 comme 360 px de large), sans défiler ; la carte va
   jusqu'à la barre (--h-fin, PileVide), son contenu au milieu */
.mx-vide { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .75rem; min-block-size: var(--h-fin, auto); padding: 1.5rem 1.25rem 1.1rem;
  text-align: center; border-radius: var(--r-xl); background: var(--surface); box-shadow: var(--sh1); }
.mx-vide > h2 { margin: 0; color: var(--ink); font: 700 var(--fs-6)/1.25 var(--f-display); text-wrap: balance; }
.mx-vide-scene { position: relative; inline-size: 124px; block-size: 92px; }
.mx-vide-scene > span { position: absolute; inset-block-start: 6px; inset-inline-start: 31px; inline-size: 62px; block-size: 82px; border-radius: 13px; background: var(--surface-2); box-shadow: var(--sh1); }
.mx-vide-scene > span:nth-child(1) { rotate: -13deg; translate: -18px 4px; }
.mx-vide-scene > span:nth-child(2) { rotate: 10deg; translate: 18px 2px; background: var(--brass-soft); }
.mx-vide-scene > span:nth-child(3) { display: grid; place-items: center; background: var(--accent); color: var(--accent-ink); box-shadow: var(--sh2); }
.mx-vide-scene svg { fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
@media (prefers-reduced-motion: no-preference) {
  .mx-vide-scene > span:nth-child(1) { animation: mx-pose .38s cubic-bezier(.2, 1.2, .4, 1) .05s backwards; }
  .mx-vide-scene > span:nth-child(2) { animation: mx-pose .38s cubic-bezier(.2, 1.2, .4, 1) .1s backwards; }
  .mx-vide-scene .mx-trait { stroke-dasharray: 20; stroke-dashoffset: 20; animation: mx-trait .32s ease-out .38s forwards; }
}
@keyframes mx-pose { from { rotate: 0deg; translate: 0 0; } }
.mx-bilan { display: flex; flex-direction: column; align-items: center; gap: .4rem; margin: 0; }
.mx-bl-t, .mx-bref-t { margin: 0; color: var(--muted); font-size: var(--fs-1); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.mx-bl-n { display: flex; gap: 2.4rem; margin: 0; }
.mx-bl-n > span { display: flex; flex-direction: column; align-items: center; gap: .15rem; color: var(--ink-2); font-size: var(--fs-2); font-weight: 600; }
.mx-compte { color: var(--ink); font: 700 var(--fs-7)/1 var(--f-display); font-variant-numeric: tabular-nums; }
/* « Intéressé » en couleur seulement s'il y en a eu : un zéro reste neutre */
.mx-bl-oui.vif .mx-compte { color: var(--blue-text); }
.mx-suite { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .55rem; inline-size: 100%; max-inline-size: 38ch; text-align: start; }
.mx-suite li { display: flex; align-items: flex-start; gap: .65rem; color: var(--ink-2); font-size: var(--fs-3); line-height: 1.45; text-wrap: pretty; }
.mx-s-ico { flex: none; display: grid; place-items: center; inline-size: 28px; block-size: 28px; margin-block-start: -.15rem; border-radius: 50%; background: var(--accent-soft); color: var(--blue-text); }
.mx-vide-acts { display: flex; flex-direction: column; align-items: center; gap: .2rem; }
.mx-vide .linkish { min-height: 44px; display: inline-flex; align-items: center; gap: .3rem; }

/* « En bref », à côté de la pile, sur grand écran seulement */
.mx-bref { display: none; }
.mx-bref-bloc { display: flex; flex-direction: column; gap: .3rem; }
.mx-bref-l { margin: 0; color: var(--ink-2); font-size: var(--fs-2); font-weight: 700; }
.mx-bref-fort { margin: 0; color: var(--ink); font-size: var(--fs-4); font-weight: 650; line-height: 1.35; }
.mx-bref-texte { margin: 0; color: var(--ink-2); font-size: var(--fs-3); line-height: 1.6; white-space: pre-line; overflow-wrap: anywhere; }
.mx-bref-meta { margin: 0; color: var(--muted); font-size: var(--fs-2); }
.mx-bref-dl { display: grid; gap: .6rem; margin: 0; }
.mx-bref-dl > div { display: grid; grid-template-columns: 7rem minmax(0, 1fr); gap: .8rem; }
.mx-bref-dl dt { color: var(--muted); font-size: var(--fs-2); font-weight: 600; }
.mx-bref-dl dd { margin: 0; color: var(--ink); font-size: var(--fs-3); }
.mx-bref-voir { align-self: flex-start; }
@media (min-width: 1100px) {
  .mx-page:not(.fini) { max-width: 1000px; display: grid; grid-template-columns: minmax(0, 470px) minmax(0, 1fr); column-gap: clamp(32px, 4vw, 56px); row-gap: var(--sp-4); align-items: start; }
  .mx-page:not(.fini) > :not(.mx-zone):not(.mx-bref) { grid-column: 1 / -1; }
  .mx-bref { display: flex; flex-direction: column; gap: 1.1rem; position: sticky; inset-block-start: 96px; max-block-size: calc(100dvh - 140px); overflow: auto; margin-block-start: 0;
    padding: 1.4rem 1.5rem; border-radius: var(--r-xl); background: var(--surface); box-shadow: var(--sh1); }
  .mx-bref.vide { visibility: hidden; }
  .mx-page.fini { max-width: 560px; }
}
`);

addAR({
  'Tour du jour fait': 'تمت جولة اليوم', 'aujourd’hui': 'اليوم',
  'À droite : Intéressé · À gauche : Plus tard': 'إلى اليمين: يهمّني · إلى اليسار: لاحقًا',
  'À gauche : Intéressé · À droite : Plus tard': 'إلى اليسار: يهمّني · إلى اليمين: لاحقًا',
  // Cartes sponsorisées
  'Sponsorisé': 'مُموَّل', 'Carte sponsorisée passée.': 'تم تجاوز البطاقة المموَّلة.', 'Aperçu dans Match': 'معاينة في صفحة التوافق',
  'Tes matchs': 'توافقاتك', 'Ton offre l’intéresse': 'اهتمام بعرضك', 'Nouveau match': 'توافق جديد', 'Ton choix': 'اختيارك',
  'Des offres de lauréats, une carte à la fois.': 'عروض من الخريجين، بطاقة واحدة في كل مرة.',
  'Des étudiants de l’école, une carte à la fois.': 'طلبة المدرسة، بطاقة واحدة في كل مرة.',
  'Revenir': 'تراجع', 'Intéressé': 'يهمّني', 'Plus tard': 'لاحقًا', 'sur': 'من',
  'Si c’est oui des deux côtés, c’est un match : vous pouvez vous écrire.': 'إذا قال الطرفان نعم، فهو توافق: يمكنكما المراسلة.',
  'Clavier : ← Plus tard · → Intéressé · Z pour revenir': 'لوحة المفاتيح: ← لاحقًا · → يهمّني · Z للتراجع',
  'Clavier : → Plus tard · ← Intéressé · Z pour revenir': 'لوحة المفاتيح: → لاحقًا · ← يهمّني · Z للتراجع',
  'Les lauréats voient aussi ta carte.': 'يرى الخريجون بطاقتك أيضًا.', 'Rémunéré': 'مدفوع الأجر',
  'Sa recherche': 'الطلب الحالي', 'Son offre': 'العرض', 'Son offre pour toi': 'عرضه لك', 'Aide les étudiants sur': 'يساعد الطلبة في',
  'Cherche un stage': 'بحث عن تدريب', 'Cherche un PFE': 'بحث عن مشروع نهاية الدراسة', 'Cherche un stage à l’étranger': 'بحث عن تدريب في الخارج', 'Cherche un emploi': 'بحث عن عمل',
  'Pourquoi toi': 'لماذا أنت', 'Pourquoi ce profil': 'لماذا هذا الملف', 'Voir le profil': 'عرض الملف',
  'CV pas encore partagé': 'لم تتم مشاركة السيرة الذاتية بعد', 'Voir son CV (lien)': 'عرض سيرته الذاتية (رابط)', 'Ajouter mon CV': 'إضافة سيرتي الذاتية', 'Modifier': 'تعديل',
  'Les lauréats voient aussi ta carte. Ajoute ton CV : il s’affiche en grand, et les cartes avec CV passent en premier.': 'يرى الخريجون بطاقتك أيضًا. أضف سيرتك الذاتية: تظهر بحجم كبير، والبطاقات التي فيها سيرة ذاتية تُعرض أولًا.',
  'Les lauréats voient aussi ta carte, avec ton CV en grand.': 'يرى الخريجون بطاقتك أيضًا، مع سيرتك الذاتية بحجم كبير.',
  'Les lauréats voient aussi ta carte. Ton CV reste privé jusqu’au match.': 'يرى الخريجون بطاقتك أيضًا. تبقى سيرتك الذاتية خاصة حتى التوافق.',
  'Ce choix a mené à un match : il reste.': 'أدى هذا الاختيار إلى توافق: يبقى كما هو.', 'La carte est revenue.': 'عادت البطاقة.',
  // La fin de la pile
  'Tu as tout vu': 'شاهدت كل شيء', 'Cette visite': 'هذه الزيارة',
  'Chaque nouvelle offre de lauréat pour ton année arrive ici.': 'كل عرض جديد من الخريجين لسنتك يصل إلى هنا.',
  'Chaque nouvel étudiant du cycle ingénieur arrive ici dès son inscription.': 'كل طالب جديد في سلك المهندسين يصل إلى هنا فور تسجيله.',
  'Un lauréat qui s’intéresse à ton profil passe avant tout le reste.': 'الخريج المهتم بملفك يظهر قبل أي بطاقة أخرى.',
  'Une offre publiée fait venir les étudiants : ceux qui disent oui passent en premier.': 'عرض منشور يجلب الطلبة: من يقول نعم يظهر أولًا.',
  'Publier ma demande': 'نشر طلبي', 'Voir les offres': 'عرض العروض', 'Publier une offre': 'نشر عرض',
  'Revenir sur mon dernier choix': 'التراجع عن آخر اختيار',
  // La fête
  'C’est un match !': 'تمّ الاتفاق!', 'Écrire': 'مراسلة', 'Continuer': 'متابعة',
  'Réponds dans Match : si c’est oui des deux côtés, vous pouvez vous écrire.': 'أجب في صفحة التوافق: إذا قال الطرفان نعم، يمكنكما المراسلة.',
  // En bref (grand écran)
  'En bref': 'باختصار', 'Filières': 'الشعب', 'Durée': 'المدة', 'Date limite': 'آخر أجل', 'Toutes les filières': 'كل الشعب',
  'Présentation': 'تقديم', 'Compétences': 'الكفاءات', 'Disponibilité': 'التوفر',
  'Voir l’offre en entier': 'عرض العرض كاملًا', 'Voir le profil en entier': 'عرض الملف كاملًا',
  // Pourquoi cette carte (pourquoiCarte, logic.js, et raisonsCarte ci-dessus)
  'Pour ta filière': 'لشعبتك', 'Pour ton parcours': 'لمسارك', 'Pour ton année': 'لسنتك', 'Ouverte à toutes les filières': 'مفتوح لكل الشعب', 'Correspond à ta demande': 'يوافق طلبك',
  'Même filière que toi': 'نفس شعبتك', 'Même parcours que toi': 'نفس مسارك', 'Étudiant à l’école': 'بالمدرسة حاليًا',
  'Son offre vise ta filière': 'عرضه موجّه لشعبتك', 'Son offre vise ton parcours': 'عرضه موجّه لمسارك',
  // Les refus de la base (protect_match_choix), mêmes mots en démo
  'Match est réservé aux étudiants et aux lauréats.': 'صفحة التوافق مخصصة للطلبة والخريجين.', 'Cette offre n’existe plus.': 'هذا العرض لم يعد موجودًا.',
  'C’est ta propre offre.': 'هذا عرضك أنت.', 'Dans Match, les offres sont proposées aux étudiants.': 'في صفحة التوافق، تُعرض العروض على الطلبة.',
  'Cette offre n’est plus ouverte.': 'هذا العرض لم يعد مفتوحًا.', 'Cette offre n’est pas proposée à ton année.': 'هذا العرض غير موجّه لسنتك.',
  'Choisis un autre membre que toi.': 'اختر عضوًا غيرك.', 'Ce membre n’est plus sur le réseau.': 'هذا العضو لم يعد في الشبكة.',
  'Ici, tu réponds aux lauréats qui s’intéressent à ton profil.': 'هنا تجيب الخريجين المهتمين بملفك.', 'Ce profil n’est pas proposé dans Match.': 'هذا الملف غير معروض في صفحة التوافق.',
  'Tu as déjà fait 80 choix aujourd’hui. La suite demain !': 'قمت بـ 80 اختيارًا اليوم. البقية غدًا!',
}, [
  [/^(.+) s’intéresse à ton profil$/, x => `اهتمام من ${x} بملفك`],
  [/^(.+) s’intéresse à ton offre$/, x => `اهتمام من ${x} بعرضك`],
  [/^(\d+) lauréats s’intéressent à ton profil$/, n => `${n} خريجين مهتمون بملفك`],
  [/^(\d+) étudiants s’intéressent à tes offres$/, n => `${n} طلبة مهتمون بعروضك`],
  [/^Toi et (.+) pouvez maintenant vous écrire\.$/, x => `يمكنك أنت و${x} المراسلة الآن.`],
  [/^Portée par (.+), qui encadre$/, x => `بتأطير من ${x}`],
  [/^Proposée par (.+)$/, x => `عرض من ${x}`],
  [/^Travaille chez (.+)$/, x => `العمل لدى ${x}`],
  [/^(.+), comme toi$/, x => `${x}، مثلك`],
  [/^(.+), comme (.+)$/, (x, y) => `${x}، مثل ${y}`],
  // « Lean et VSM, dans ton profil » : chaque compétence isolée (FSI…PDI), reliées par « و »
  [/^(.+), dans ton profil$/, x => `${x.split(' et ').map(n => `\u2068${n}\u2069`).join(' و')}، في ملفك`],
  [/^(.+), dans ton offre$/, x => `${x.split(' et ').map(n => `\u2068${n}\u2069`).join(' و')}، في عرضك`],
  [/^(.+) vient de ta filière$/, x => `${x} من شعبتك`],
  [/^(.+) vient de ton parcours$/, x => `${x} من مسارك`],
  [/^En (\d)A à l’école$/, n => `في السنة ${n} بالمدرسة`],
  [/^Cherche un PFE en (.+)$/, x => `البحث عن مشروع نهاية الدراسة في ${x}`],
  [/^Cherche un stage en (.+)$/, x => `البحث عن تدريب في ${x}`],
  [/^Cherche un stage à l’étranger en (.+)$/, x => `البحث عن تدريب بالخارج في ${x}`],
  [/^Cherche un emploi en (.+)$/, x => `البحث عن وظيفة في ${x}`],
  [/^(\d+) jours de suite$/, n => `${n} أيام متتالية`],
  [/^Tour du jour fait : (\d+) jours de suite$/, n => `تمت جولة اليوم: ${n} أيام متتالية`],
  [/^(\d+) sur (\d+) aujourd’hui$/, (a, b) => `${a} من ${b} اليوم`],
  [/^(Intéressé|Plus tard) : (.+)$/, (c, x) => `${c === 'Intéressé' ? 'يهمّني' : 'لاحقًا'}: ${x}`],
  [/^Tour du jour : (\d+) sur (\d+)$/, (a, b) => `جولة اليوم: ${a} من ${b}`],
  [/^Tour du jour fait · (\d+) jours de suite$/, n => `تمت جولة اليوم · ${n} أيام متتالية`],
  [/^Les cartes « Plus tard » reviennent (\d+) jours après ton choix\.$/, n => `تعود بطاقات «لاحقًا» بعد ${n} يومًا من اختيارك.`],
]);
