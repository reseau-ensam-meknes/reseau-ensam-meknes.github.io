// Page « Match » : la mise en relation entre étudiants et lauréats, une carte à la fois : « Plus tard » ou « Intéressé ».
// L'étudiant voit des offres de lauréats (et les lauréats qui s'intéressent à lui) ; le lauréat voit des étudiants,
// leur CV en grand (apercu-cv.js), lisible en entier avant de choisir.
// Quand les deux disent oui, c'est un match : la discussion s'ouvre (messages.js : bandeau, entretien).
// Règles : deckMatch, matchsDe (logic.js) ; choisirMatch, revenirMatch, vuMatch (store.js, comme la base). CSS : page.html, section « Match ».
// Cartes sponsorisées : une après chaque 10 cartes de la visite (avecSponsorises, logic.js), marquée « Sponsorisé » ; tout
// geste la passe sans rien enregistrer, « Revenir » ne la ramène pas. La base compte seulement une vue (carte du dessus) et
// un clic (« Voir ») par membre et par jour ; l'entreprise n'en reçoit que les totaux (admin.js, « Sponsorisés »).
import { html, useState, useEffect, useLayoutEffect, useRef, useMemo } from './vendor/preact-htm.js';
import { Icon, Avatar, AvatarPile, CompanyLogo, MentionLogos, toast, roleTexte, useFeuille, mouvementReduit, ecranLibre, injectCSS } from './ui.js';
import { ajouterIcones } from './entree.js';
import { deckMatch, matchsDe, titreOffre, resumeFilieres, filiereCourte, niveauOf, NIVEAUX, TYPES, demandesActives, typesDemande, DEMANDES_MAX, sponsorisesPour, avecSponsorises, decalageSponso } from './logic.js';
import { estPortee } from './origine.js';
import { TYPE_ICON } from './entree.js';
import { OfferComposer } from './offers.js';
import { addAR, getLang } from './i18n.js';
import { ApercuCV, LecteurCV } from './apercu-cv.js';

ajouterIcones({
  // Deux cartes l'une sur l'autre, une coche sur celle de devant
  match: '<rect x="8" y="3" width="12.5" height="16" rx="2.5"/><path d="M4.5 7.5v11A2.5 2.5 0 0 0 7 21h8.5"/><path d="m11.4 11.3 2 2 3.7-3.9"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
});

const prenom = p => (p?.full_name || '').split(' ')[0] || '';
// Le CV de l'étudiant s'affiche-t-il aux lauréats avant le match ? Son réglage « CV » (lauréats par défaut, ou tous)
const cvPourLaureats = me => ['laureats', 'tous'].includes((me.visibilite || {}).cv || 'laureats');
// Retour au toucher, si l'appareil sait vibrer
const vibrer = motif => { try { navigator.vibrate?.(motif); } catch { /* pas de vibreur */ } };
// Le logo d'une entreprise : un seul point d'entrée pour toute la page. LogoEntreprise (lot vitrine) prendra sa place ici,
// avec la même forme ({ nom, lien, taille }) ; en attendant, le logo local ou le monogramme coloré.
// domaine : celui que l'administration a donné pour une carte sponsorisée (son icône), sinon celui que le logo devine
const Logo = ({ nom, lien, taille = 56, domaine = null }) => html`<${CompanyLogo} name=${nom} size=${taille} lien=${lien} domaine=${domaine}/>`;
// Le site qu'ouvre « Voir » sur une carte sponsorisée, sans « www. »
const siteDe = lien => { try { return new URL(lien).hostname.replace(/^www\./, ''); } catch { return ''; } };

// ---------------------------------------------------------------------------
// La page
// ---------------------------------------------------------------------------
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
  const [hist, setHist] = useState([]);          // les choix de cette visite (« Revenir »)
  const [devant, setDevant] = useState(null);    // la carte revenue reste devant
  const [fete, setFete] = useState(null);
  const [compose, setCompose] = useState(false);
  const [lire, setLire] = useState(null);        // le CV ouvert en grand (la carte du dessus)
  const [annonce, setAnnonce] = useState('');
  const pile = useRef();
  const cartes = useMemo(() => {
    const l = deck.filter(c => c.cle !== vol?.c.cle);
    const i = devant ? l.findIndex(c => c.cle === devant) : -1;
    return i > 0 ? [l[i], ...l.slice(0, i), ...l.slice(i + 1)] : l;
  }, [deck, vol, devant]);
  const top = cartes[0] || null;

  const choisir = (choix, from = null) => {
    if (!top || vol) return;
    const c = top;
    setVol({ c, choix, from, t: Date.now() }); setDevant(null);
    pile.current?.style.setProperty('--avance', '0');
    vibrer(10);
    const fin = () => setTimeout(() => setVol(v => (v?.c.cle === c.cle ? null : v)), mouvementReduit() ? 180 : 430);
    // Une carte sponsorisée : quel que soit le geste, elle passe ; rien n'est enregistré (pas de choix, pas de « Revenir »)
    if (c.sorte === 'sponsorise') { setSautes(l => [...l, c.creneau]); setAnnonce('Carte sponsorisée passée.'); fin(); return; }
    setAnnonce(`${choix === 'oui' ? 'Intéressé' : 'Plus tard'} : ${c.offre ? titreOffre(c.offre) : c.profil?.full_name || ''}`);
    setHist(h => [...h, c.cle]); setPassees(n => n + 1);
    store.choisirMatch(c.offre ? { offre: c.offre.id } : { profil: c.profil.id }, choix).then(r => {
      if (!r?.match) return;
      const autre = store.byId('profiles', r.match.etudiant_id === me.id ? r.match.laureat_id : r.match.etudiant_id) || c.profil;
      setTimeout(() => { vibrer([30, 60, 30]); setFete({ m: r.match, autre, offre: (r.match.offre_id && store.byId('offers', r.match.offre_id)) || null }); }, mouvementReduit() ? 0 : 260);
    }, e => { setHist(h => h.filter(x => x !== c.cle)); setPassees(n => Math.max(0, n - 1)); setDevant(c.cle); toast(e.message || String(e), 'err'); });
    fin();
  };
  const revenir = () => {
    if (!hist.length || vol) return;
    store.revenirMatch().then(r => {
      setHist(h => h.slice(0, -1));
      if (!r) return toast('Ce choix a mené à un match : il reste.', 'info');
      setPassees(n => Math.max(0, n - 1));
      const cle = r.offre ? 'o:' + r.offre : 'p:' + r.profil;
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
      const haut = z.getBoundingClientRect().top + scrollY;
      const acts = z.parentElement?.querySelector('.mx-acts')?.offsetHeight || 90;
      const bas = document.querySelector('.bottom-nav')?.offsetHeight || 0;
      const h = Math.round(innerHeight - haut - acts - bas - 22 - 16 - 14);
      z.style.setProperty('--h', Math.max(330, Math.min(580, h)) + 'px');
    };
    ajuste(); addEventListener('resize', ajuste);
    return () => removeEventListener('resize', ajuste);
  }, [plein]);
  // Une carte sponsorisée devenue la carte du dessus : une vue (la base n'en compte qu'une par membre et par jour)
  useEffect(() => { if (top?.sorte === 'sponsorise') Promise.resolve(store.vueSponsorise?.(top.sponsorise.id)).catch(() => {}); }, [top?.cle]);
  const voir = c => Promise.resolve(store.clicSponsorise?.(c.sponsorise.id)).catch(() => {});
  const finFete = () => { if (fete) store.vuMatch(fete.m.id).catch(() => {}); setFete(null); };
  const ecrire = () => { const f = fete; finFete(); if (f?.autre) (ctx.ecrire ? ctx.ecrire(f.autre.id) : go('messages/' + f.autre.id)); };
  const logos = cartes.slice(0, 3).filter(c => c.offre).map(c => c.offre.entreprise);

  return html`<section class="page mx-page">
    <header class="mx-tete">
      <div class="mx-tete-txt"><h1>Match</h1>
        <p class="muted">${etu ? 'Des offres de lauréats, une carte à la fois.' : 'Des étudiants de l’école, une carte à la fois.'}</p></div>
      <${MesMatchs} ctx=${ctx}/>
    </header>
    ${top || vol ? html`<div class="mx-zone">
      <div class="mx-pile" ref=${pile} style=${`--sens:${sens}`}>
        ${cartes.slice(0, 3).reverse().map((c, i, l) => html`<${Carte} key=${c.cle} ctx=${ctx} carte=${c} rang=${l.length - 1 - i} sens=${sens}
          onChoix=${choisir} onLire=${() => setLire(c)} onVoir=${() => voir(c)} revenue=${c.cle === devant}/>`)}
        ${vol ? html`<${Carte} key=${'vol-' + vol.c.cle + vol.t} ctx=${ctx} carte=${vol.c} rang=${0} sens=${sens} vol=${vol}/>` : null}
      </div>
      <div class="mx-acts" role="group" aria-label="Ton choix">
        <button type="button" class="mx-rond mx-non" onClick=${() => choisir('plus_tard')} disabled=${!top}><span class="mx-rond-ico"><${Icon} name="x" size=${26}/></span><span class="mx-rond-lib">Plus tard</span></button>
        <button type="button" class="mx-rond mx-retour" onClick=${revenir} disabled=${!hist.length}><span class="mx-rond-ico"><${Icon} name="undo" size=${20}/></span><span class="mx-rond-lib">Revenir</span></button>
        <button type="button" class="mx-rond mx-oui" onClick=${() => choisir('oui')} disabled=${!top}><span class="mx-rond-ico"><${Icon} name="check" size=${30}/></span><span class="mx-rond-lib">Intéressé</span></button>
      </div>
      <p class="mx-aide muted small">Si c’est oui des deux côtés, c’est un match : vous pouvez vous écrire.</p>
      <p class="mx-clavier muted small" aria-hidden="true">${sens > 0 ? 'Clavier : ← Plus tard · → Intéressé · Z pour revenir' : 'Clavier : → Plus tard · ← Intéressé · Z pour revenir'}</p>
      <${MentionLogos} noms=${logos}/>
    </div>` : html`<${PileVide} ctx=${ctx} onPublier=${() => setCompose(true)} revenir=${hist.length ? revenir : null}/>`}
    ${etu && me.match_visible !== false ? html`<p class="mx-visible small muted"><${Icon} name="eye" size=${15}/> <span>${!me.cv_path ? 'Les lauréats voient aussi ta carte. Ajoute ton CV : il s’affiche en grand, et les cartes avec CV passent en premier.'
      : cvPourLaureats(me) ? 'Les lauréats voient aussi ta carte, avec ton CV en grand.' : 'Les lauréats voient aussi ta carte. Ton CV reste privé jusqu’au match.'}</span> <button type="button" class="linkish small" onClick=${() => go('profil')}>${me.cv_path ? 'Modifier' : 'Ajouter mon CV'}</button></p>` : null}
    <p class="sr-only" aria-live="polite">${annonce}</p>
    ${fete ? html`<${FeteMatch} f=${fete} me=${me} onEcrire=${ecrire} onClose=${finFete}/>` : null}
    ${lire ? html`<${LecteurCV} store=${store} p=${lire.profil} path=${lire.profil.cv_path} onClose=${() => setLire(null)}
      onChoix=${top?.cle === lire.cle ? c => { setLire(null); choisir(c); } : null}/>` : null}
    ${compose ? html`<${OfferComposer} ctx=${ctx} onClose=${() => setCompose(false)}/>` : null}
  </section>`;
}

// ---------------------------------------------------------------------------
// Une carte : glisser au doigt ou à la souris (pointer events), ressort au relâchement ; appui = le détail
// ---------------------------------------------------------------------------
const SEUIL = 0.3;          // part de la largeur à dépasser pour choisir
const VITESSE = 0.55;       // ou un geste vif (px/ms)
function Carte({ ctx, carte, rang, sens, onChoix, onLire, onVoir, vol, revenue }) {
  const el = useRef(); const g = useRef(null);
  // Le dernier appui fini : glissé ou long, le clic qui le suit n'ouvre pas le détail
  const fini = useRef(null);
  const dessus = rang === 0 && !vol;
  const sponso = carte.sorte === 'sponsorise';
  // Une carte sponsorisée n'a pas de détail : seul « Voir » ouvre son lien
  const detail = () => (sponso ? null : carte.offre ? ctx.openOffer(carte.offre.id) : ctx.openProfile(carte.profil));
  const poser = (dx, dy) => {
    const e = el.current; if (!e) return;
    e.style.transform = dx || dy ? `translate3d(${dx}px, ${dy}px, 0) rotate(${(dx / (g.current?.w || 320)) * 9}deg)` : '';
    const p = Math.max(-1, Math.min(1, (dx * sens) / ((g.current?.w || 320) * SEUIL)));
    e.style.setProperty('--p', p.toFixed(3));
    e.parentElement?.style.setProperty('--avance', Math.abs(p).toFixed(3));
  };
  const down = e => {
    if (!dessus || (e.pointerType === 'mouse' && e.button !== 0) || e.target.closest('button, a')) return;
    const r = el.current.getBoundingClientRect();
    fini.current = null;
    g.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), w: r.width, dx: 0, dy: 0, bouge: false, pas: [[e.clientX, performance.now()]] };
    el.current.classList.add('tenue');
  };
  const move = e => {
    const s = g.current; if (!s || e.pointerId !== s.id) return;
    s.dx = e.clientX - s.x0; s.dy = e.clientY - s.y0;
    s.pas.push([e.clientX, performance.now()]); if (s.pas.length > 6) s.pas.shift();
    if (!s.bouge) {
      if (Math.hypot(s.dx, s.dy) < 7) return;
      // Un geste surtout vertical laisse défiler la page
      if (Math.abs(s.dy) > Math.abs(s.dx) * 1.2 && e.pointerType !== 'mouse') { g.current = null; fini.current = { bouge: true }; el.current.classList.remove('tenue'); return; }
      s.bouge = true; try { el.current.setPointerCapture(e.pointerId); } catch { /* */ }
    }
    poser(s.dx, s.dy * 0.25);
  };
  const up = e => {
    const s = g.current; if (!s || e.pointerId !== s.id) return;
    g.current = null; el.current.classList.remove('tenue');
    fini.current = { bouge: s.bouge, long: performance.now() - s.t0 >= 600 };
    // Un simple appui : le détail s'ouvre au clic qui suit (voir clic), pas ici. Ouvert au relâchement, la feuille
    // arrivait sous le doigt et le clic du téléphone tombait sur son fond, qui la refermait aussitôt.
    if (!s.bouge) return;
    const [x1, t1] = s.pas[0]; const v = (e.clientX - x1) / Math.max(1, performance.now() - t1);
    const dir = Math.abs(s.dx) > s.w * SEUIL || (Math.abs(v) > VITESSE && Math.abs(s.dx) > 24 && Math.sign(v) === Math.sign(s.dx)) ? Math.sign(s.dx) : 0;
    if (dir && e.type === 'pointerup') { onChoix(dir * sens > 0 ? 'oui' : 'plus_tard', { dx: s.dx, dy: s.dy * 0.25, w: s.w }); return; }
    // Pas assez loin : la carte revient au centre, avec un léger rebond
    el.current.classList.add('ressort');
    poser(0, 0);
    setTimeout(() => el.current?.classList.remove('ressort'), 520);
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
  if (sponso) return html`<article ref=${el} class=${'mx-carte sponso' + (dessus ? ' dessus' : ' derriere') + (vol ? ' vol' : '')}
    style=${style} aria-hidden=${dessus ? null : 'true'} inert=${dessus ? null : true} aria-labelledby=${dessus ? `${tid}-m ${tid}` : null}
    onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up} onClick=${clic}>
    <${CorpsSponsorise} s=${carte.sponsorise} tid=${tid}/>
    <${PiedSponsorise} s=${carte.sponsorise} onVoir=${dessus ? onVoir : null}/>
  </article>`;
  return html`<article ref=${el} class=${'mx-carte' + (dessus ? ' dessus' : ' derriere') + (vol ? ' vol' : '') + (revenue && dessus ? ' revenue' : '') + (carte.interet ? ' avec-interet' : '')}
    style=${style} aria-hidden=${dessus ? null : 'true'} inert=${dessus ? null : true} aria-labelledby=${dessus ? tid : null}
    onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up} onClick=${clic}>
    <span class="mx-tampon mx-t-oui" aria-hidden="true">Intéressé</span>
    <span class="mx-tampon mx-t-non" aria-hidden="true">Plus tard</span>
    ${carte.interet ? html`<p class="mx-interet"><${Avatar} p=${p} size=${26}/>${carte.sorte === 'laureat' ? html`<span>${`${prenom(p)} s’intéresse à ton profil`}</span>`
      : html`<span class="mx-int-txt"><span>Ton offre l’intéresse</span><span class="mx-int-o" translate="no" dir="auto">${titreOffre(carte.interet.offre)}</span></span>`}</p>` : null}
    ${carte.sorte === 'offre' ? html`<${CorpsOffre} ctx=${ctx} carte=${carte} tid=${tid}/>` : carte.sorte === 'etudiant' ? html`<${CorpsEtudiant} ctx=${ctx} carte=${carte} tid=${tid} onLire=${dessus ? onLire : null}/>` : html`<${CorpsLaureat} ctx=${ctx} carte=${carte} tid=${tid}/>`}
    <footer class="mx-c-pied">
      <p class="mx-raison"><${Icon} name="spark" size=${16}/><span>${carte.raison}</span></p>
      ${dessus ? html`<button type="button" class="btn tiny ghost mx-detail" onClick=${detail}>${o ? 'Voir l’offre' : 'Voir le profil'} <${Icon} name="arrow" size=${14}/></button>` : null}
    </footer>
  </article>`;
}

// Une carte sponsorisée : marquée « Sponsorisé », le logo et le nom de l'entreprise, son titre et son texte (écrits par
// l'administration, gardés tels quels en arabe). Même allure que les autres cartes : rien qui clignote ni qui crie.
export function CorpsSponsorise({ s, tid }) {
  return html`<div class="mx-corps mx-sponso">
    <p class="mx-s-marque" id=${tid ? tid + '-m' : null}>Sponsorisé</p>
    <div class="mx-c-ent"><${Logo} nom=${s.entreprise} lien=${s.lien} domaine=${s.domaine} taille=${60}/>
      <span class="mx-c-ent-txt"><strong translate="no" dir="auto">${s.entreprise}</strong></span></div>
    <h2 class="mx-c-titre" id=${tid} translate="no" dir="auto">${s.titre}</h2>
    <p class="mx-c-desc mx-s-texte" translate="no" dir="auto">${s.texte}</p>
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
  return html`<div class="mx-apercu"><article class="mx-carte sponso dessus" aria-label="Aperçu dans Match">
    <${CorpsSponsorise} s=${s}/><${PiedSponsorise} s=${s}/>
  </article></div>`;
}

function CorpsOffre({ ctx, carte, tid }) {
  const o = carte.offre, p = carte.profil;
  const fil = o.filieres?.length ? resumeFilieres(o.filieres).join(' · ') : 'Toutes les filières';
  const lieu = [o.ville, o.pays && o.pays !== 'Maroc' ? o.pays : null].filter(Boolean).join(' · ');
  return html`<div class="mx-corps">
    <div class="mx-c-ent"><${Logo} nom=${o.entreprise} lien=${o.lien} taille=${60}/>
      <span class="mx-c-ent-txt"><strong translate="no" dir="auto">${o.entreprise}</strong>${lieu ? html`<span class="muted" translate="no" dir="auto">${lieu}</span>` : null}</span></div>
    <h2 class="mx-c-titre" id=${tid} translate="no" dir="auto">${titreOffre(o)}</h2>
    <div class="mx-puces">
      <span class=${'mx-puce fort t-' + o.type}><${Icon} name=${TYPE_ICON[o.type] || 'briefcase'} size=${16}/> ${TYPES[o.type]?.label || o.type}</span>
      ${o.duree ? html`<span class="mx-puce" translate="no" dir="auto">${o.duree}</span>` : null}
      ${o.remunere ? html`<span class="mx-puce">Rémunéré</span>` : null}
    </div>
    <p class="mx-c-fil"><${Icon} name="cap" size=${16}/><span>${fil}</span></p>
    ${o.description ? html`<p class="mx-c-desc" translate="no" dir="auto">${o.description}</p>` : null}
    ${p ? html`<p class="mx-c-qui"><${Avatar} p=${p} size=${30}/><span>${estPortee(o) ? `Portée par ${prenom(p)}, qui encadre` : `Proposée par ${prenom(p)}`}</span><span class="muted">${roleTexte(p, true)}</span></p>` : null}
  </div>`;
}

// L'étudiant vu par un lauréat : son CV en grand quand il le partage (la place de la grande photo), puis qui il est,
// ce qu'il cherche et ses compétences. Sans CV partagé, son visage et un encadré sobre.
function CorpsEtudiant({ ctx, carte, tid, onLire }) {
  const { data, store, saison } = ctx; const p = carte.profil;
  const n = niveauOf(p, saison);
  const voit = c => store.voitChamp?.(p, c) ?? true;
  const d = demandesActives(data, p.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const comp = voit('presentation') ? (p.competences || []).slice(0, 5) : [];
  const pdf = voit('cv') ? p.cv_path : null;
  const lien = !pdf && voit('cv') ? p.cv_url : null;
  const meta = html`<p class="mx-c-meta"><span>${NIVEAUX[n]?.short || ''}</span> · <span title=${p.filiere}>${filiereCourte(p.filiere)}</span>${voit('lieu') && p.ville ? html` · <span translate="no">${p.ville}</span>` : null}</p>`;
  const cherche = d ? html`<div class="mx-cherche"><p class="eyebrow">Sa recherche</p>
      <p><span class=${'mx-puce fort t-' + d.type}><${Icon} name=${TYPE_ICON[d.type] || 'briefcase'} size=${16}/> ${TYPES[d.type]?.label || d.type}</span> <span class="mx-cherche-t" translate="no" dir="auto">${d.titre}</span></p></div>` : null;
  if (pdf) return html`<div class="mx-corps mx-personne avec-cv">
    <${ApercuCV} store=${store} path=${pdf} nom=${p.full_name} onLire=${onLire}/>
    <div class="mx-p-ligne"><${Avatar} p=${p} size=${44}/><div class="mx-p-id">
      <h2 class="mx-c-nom" id=${tid} translate="no">${p.full_name}</h2>${meta}</div></div>
    ${cherche}
    ${comp.length ? html`<div class="mx-puces mx-une-ligne">${comp.map(c => html`<span class="mx-puce" translate="no" dir="auto">${c}</span>`)}</div>` : null}
  </div>`;
  return html`<div class="mx-corps mx-personne">
    <div class="mx-p-tete"><${Avatar} p=${p} size=${84}/><div class="mx-p-id">
      <h2 class="mx-c-nom" id=${tid} translate="no">${p.full_name}</h2>${meta}
    </div></div>
    ${cherche}
    ${comp.length ? html`<div class="mx-puces centre">${comp.map(c => html`<span class="mx-puce" translate="no" dir="auto">${c}</span>`)}</div>` : null}
    ${voit('presentation') && p.bio ? html`<p class="mx-c-desc" translate="no" dir="auto">${p.bio}</p>` : null}
    ${lien ? html`<a class="mx-cv-absent lien" href=${/^https?:\/\//i.test(lien) ? lien : 'https://' + lien} target="_blank" rel="noopener"><${Icon} name="file" size=${16}/><span>Voir son CV (lien)</span></a>`
      : html`<p class="mx-cv-absent"><${Icon} name="file" size=${16}/><span>CV pas encore partagé</span></p>`}
  </div>`;
}

function CorpsLaureat({ ctx, carte, tid }) {
  const { store } = ctx; const p = carte.profil; const o = carte.interet?.offre;
  const voit = c => store.voitChamp?.(p, c) ?? true;
  const travail = voit('travail') ? [p.poste, p.entreprise].filter(Boolean).join(' · ') : '';
  return html`<div class="mx-corps mx-personne">
    <div class="mx-p-tete"><${Avatar} p=${p} size=${84}/><div class="mx-p-id">
      <h2 class="mx-c-nom" id=${tid} translate="no">${p.full_name}</h2>
      ${travail ? html`<p class="mx-c-meta"><span translate="no" dir="auto">${travail}</span></p>` : null}
      <p class="muted small mx-c-promo">${`Promo ${p.promo}`}${p.filiere ? html` · <span title=${p.filiere}>${filiereCourte(p.filiere)}</span>` : null}</p>
    </div></div>
    ${o ? html`<div class="mx-son-offre"><${Logo} nom=${o.entreprise} lien=${o.lien} taille=${36}/><span><span class="eyebrow">Son offre</span><span class="mx-so-t" translate="no" dir="auto">${titreOffre(o)}</span></span></div>` : null}
    ${voit('presentation') && p.bio ? html`<p class="mx-c-desc" translate="no" dir="auto">${p.bio}</p>` : null}
  </div>`;
}

// ---------------------------------------------------------------------------
// « Tes matchs » : les visages, le plus récent d'abord ; un anneau qui respire sur un match pas encore vu
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
        <span class="mx-anneau"><${Avatar} p=${x.autre} size=${46}/></span>
        <span class="mx-v-nom" translate="no">${prenom(x.autre)}</span>
        ${x.nouveau ? html`<span class="sr-only">Nouveau match</span>` : null}
      </button></li>`)}</ul>
  </section>`;
}

// Plus de carte : une scène calme et une seule action
function PileVide({ ctx, onPublier, revenir }) {
  const { me, data, saison, go } = ctx;
  const etu = me.role === 'etudiant';
  const demande = etu && typesDemande(me, saison).length && demandesActives(data, me.id).length < DEMANDES_MAX;
  return html`<div class="mx-vide">
    <div class="mx-vide-scene" aria-hidden="true"><span></span><span></span><span><${Icon} name="check" size=${30}/></span></div>
    <h2>Tu as tout vu pour l’instant</h2>
    <p class="muted">${etu ? 'Les nouvelles offres de lauréats arriveront ici. Dis ce que tu cherches : les lauréats viennent aussi vers toi.' : 'Les nouveaux étudiants arriveront ici. Une offre publiée fait venir les étudiants vers toi.'}</p>
    ${etu ? (demande ? html`<button type="button" class="btn primary" onClick=${() => go('offres/demandes/nouvelle')}><${Icon} name="send" size=${18}/> Publier ma demande</button>`
      : html`<button type="button" class="btn primary" onClick=${() => go('offres')}><${Icon} name="feed" size=${18}/> Voir les offres</button>`)
      : html`<button type="button" class="btn primary" onClick=${onPublier}><${Icon} name="plus" size=${18}/> Publier une offre</button>`}
    ${revenir ? html`<button type="button" class="linkish small" onClick=${revenir}><${Icon} name="undo" size=${15}/> Revenir sur mon dernier choix</button>` : null}
  </div>`;
}

// ---------------------------------------------------------------------------
// La fête du match, plein écran : les deux visages se rejoignent, « C'est un match ! », une seule action pleine
// ---------------------------------------------------------------------------
const COULEURS = ['var(--accent)', 'var(--orange)', 'var(--em-b)', 'var(--good)'];
// Entre les deux visages, une coche : la mise en relation est faite
const SCEAU = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5.5 12.5 4.2 4.2 8.8-9.2"/></svg>';
function FeteMatch({ f, me, onEcrire, onClose }) {
  const ref = useRef();
  useFeuille(onClose);
  const calme = mouvementReduit();
  const morceaux = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ x: Math.round(Math.random() * 100), dx: Math.round(Math.random() * 140 - 70), d: (1.3 + Math.random() * 1.1).toFixed(2), w: (0.45 + Math.random() * 0.5).toFixed(2), r: Math.round(Math.random() * 720 - 360), c: COULEURS[i % COULEURS.length], rond: i % 3 === 0 })), []);
  useLayoutEffect(() => {
    const avant = document.activeElement;
    ref.current?.querySelector('.mx-fete-ecrire')?.focus();
    const k = e => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      // La fête garde le focus (Tab tourne entre ses deux boutons)
      if (e.key === 'Tab') { const b = [...ref.current.querySelectorAll('button')]; const i = b.indexOf(document.activeElement); e.preventDefault(); b[(i + (e.shiftKey ? b.length - 1 : 1)) % b.length]?.focus(); }
    };
    document.addEventListener('keydown', k);
    document.documentElement.classList.add('mx-fige');
    return () => { document.removeEventListener('keydown', k); document.documentElement.classList.remove('mx-fige'); if (avant?.isConnected) avant.focus?.(); };
  }, []);
  const o = f.offre;
  return html`<div class=${'mx-fete' + (calme ? ' calme' : '')} role="dialog" aria-modal="true" aria-labelledby="mx-fete-t" aria-describedby="mx-fete-d" ref=${ref}>
    ${calme ? null : html`<div class="fete-pluie" aria-hidden="true">${morceaux.map(m => html`<i class=${m.rond ? 'rond' : ''} style=${`--x:${m.x}%;--dx:${m.dx}px;--d:${m.d}s;--w:${m.w}s;--r:${m.r}deg;--c:${m.c}`}></i>`)}</div>`}
    <div class="mx-fete-in">
      <div class="mx-duo" aria-hidden="true">
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

injectCSS('match-sponso', `
.mx-s-marque { align-self: flex-start; margin: 0; padding: .2rem .65rem; border-radius: var(--r-pill); background: var(--surface-2); color: var(--ink-2); font-size: var(--fs-1); font-weight: 650; line-height: 1.4; }
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

addAR({
  // Cartes sponsorisées
  'Sponsorisé': 'مُموَّل', 'Carte sponsorisée passée.': 'تم تجاوز البطاقة المموَّلة.', 'Aperçu dans Match': 'معاينة في صفحة التوافق',
  'Tes matchs': 'توافقاتك', 'Ton offre l’intéresse': 'اهتمام بعرضك', 'Nouveau match': 'توافق جديد', 'Ton choix': 'اختيارك',
  'Des offres de lauréats, une carte à la fois.': 'عروض من الخريجين، بطاقة واحدة في كل مرة.',
  'Des étudiants de l’école, une carte à la fois.': 'طلبة المدرسة، بطاقة واحدة في كل مرة.',
  'Revenir': 'تراجع', 'Intéressé': 'يهمّني',
  'Si c’est oui des deux côtés, c’est un match : vous pouvez vous écrire.': 'إذا قال الطرفان نعم، فهو توافق: يمكنكما المراسلة.',
  'Clavier : ← Plus tard · → Intéressé · Z pour revenir': 'لوحة المفاتيح: ← لاحقًا · → يهمّني · Z للتراجع',
  'Clavier : → Plus tard · ← Intéressé · Z pour revenir': 'لوحة المفاتيح: → لاحقًا · ← يهمّني · Z للتراجع',
  'Les lauréats voient aussi ta carte.': 'يرى الخريجون بطاقتك أيضًا.', 'Rémunéré': 'مدفوع الأجر',
  'Sa recherche': 'الطلب الحالي', 'Son offre': 'العرض',
  'CV pas encore partagé': 'لم تتم مشاركة السيرة الذاتية بعد', 'Voir son CV (lien)': 'عرض سيرته الذاتية (رابط)', 'Ajouter mon CV': 'إضافة سيرتي الذاتية',
  'Les lauréats voient aussi ta carte. Ajoute ton CV : il s’affiche en grand, et les cartes avec CV passent en premier.': 'يرى الخريجون بطاقتك أيضًا. أضف سيرتك الذاتية: تظهر بحجم كبير، والبطاقات التي فيها سيرة ذاتية تُعرض أولًا.',
  'Les lauréats voient aussi ta carte, avec ton CV en grand.': 'يرى الخريجون بطاقتك أيضًا، مع سيرتك الذاتية بحجم كبير.',
  'Les lauréats voient aussi ta carte. Ton CV reste privé jusqu’au match.': 'يرى الخريجون بطاقتك أيضًا. تبقى سيرتك الذاتية خاصة حتى التوافق.',
  'Ce choix a mené à un match : il reste.': 'أدى هذا الاختيار إلى توافق: يبقى كما هو.', 'La carte est revenue.': 'عادت البطاقة.',
  'Tu as tout vu pour l’instant': 'شاهدت كل شيء حاليًا',
  'Les nouvelles offres de lauréats arriveront ici. Dis ce que tu cherches : les lauréats viennent aussi vers toi.': 'ستصل هنا العروض الجديدة للخريجين. قل ما تبحث عنه: الخريجون يأتون إليك أيضًا.',
  'Les nouveaux étudiants arriveront ici. Une offre publiée fait venir les étudiants vers toi.': 'سيصل هنا الطلبة الجدد. عرض منشور يجعل الطلبة يأتون إليك.',
  'Revenir sur mon dernier choix': 'التراجع عن آخر اختيار',
  'C’est un match !': 'تمّ الاتفاق!',
  'Réponds dans Match : si c’est oui des deux côtés, vous pouvez vous écrire.': 'أجب في صفحة التوافق: إذا قال الطرفان نعم، يمكنكما المراسلة.',
  // Pourquoi cette carte (pourquoiCarte, logic.js)
  'Pour ta filière': 'لشعبتك', 'Pour ton parcours': 'لمسارك', 'Pour ton année': 'لسنتك', 'Ouverte à toutes les filières': 'مفتوح لكل الشعب', 'Correspond à ta demande': 'يوافق طلبك',
  'Même filière que toi': 'نفس شعبتك', 'Même parcours que toi': 'نفس مسارك', 'Étudiant à l’école': 'بالمدرسة حاليًا',
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
  [/^En (\d)A à l’école$/, n => `في السنة ${n} بالمدرسة`],
  [/^Cherche un PFE en (.+)$/, x => `البحث عن مشروع نهاية الدراسة في ${x}`],
  [/^Cherche un stage en (.+)$/, x => `البحث عن تدريب في ${x}`],
  [/^Cherche un stage à l’étranger en (.+)$/, x => `البحث عن تدريب بالخارج في ${x}`],
  [/^Cherche un emploi en (.+)$/, x => `البحث عن وظيفة في ${x}`],
  [/^(Intéressé|Plus tard) : (.+)$/, (c, x) => `${c === 'Intéressé' ? 'يهمّني' : 'لاحقًا'}: ${x}`],
]);
