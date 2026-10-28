// Messagerie : des conversations à deux, en texte, en photo ou en message vocal.
// Elles s'ouvrent quand un lien existe déjà (mentorat, candidature, coordonnées acceptées,
// parrainage, relecture de CV) ; l'administration peut écrire à tout le monde.
// Les règles sont dans la base (peut_discuter, protect_message) ; l'écran les reflète.
import { html, useState, useEffect, useLayoutEffect, useRef, useMemo } from './vendor/preact-htm.js';
import { Icon, Avatar, Empty, toast, injectCSS, roleTexte, Modal, lienDirect } from './ui.js';
import { useBrouillon, oublierBrouillon, lireBrouillon, ecrireBrouillon } from './ui.js';
import { conversations, lienAvec, mentorState, norm, matchEntre, etapeMatch, titreOffre, peutPostulerA } from './logic.js';
import { addAR, getLang } from './i18n.js';
import { VOCAL_MAX, REACTIONS, jitsiLink } from './store.js';
import { SignalerBtn } from './confiance.js';
import { OuvrirCV } from './cv.js';
import { gcalUrl, icsHref } from './mentorat.js';

const pad = n => String(n).padStart(2, '0');
const prenom = p => (p?.full_name || '').split(' ')[0] || 'Membre';
const heure = iso => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const minSec = s => `${Math.floor((s || 0) / 60)}:${pad(Math.round((s || 0) % 60))}`;
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const jour0 = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
function jourDe(iso, now = new Date()) {
  const d = new Date(iso); const diff = Math.round((jour0(now) - jour0(d)) / 864e5);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === 1) return 'Hier';
  if (diff > 1 && diff < 7) return JOURS[d.getDay()];
  return `${d.getDate()} ${MOIS[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : ''}`;
}
const quandCourt = iso => { const j = jourDe(iso); return j === 'Aujourd’hui' ? heure(iso) : j; };
const byDate = (a, b) => new Date(a.created_at) - new Date(b.created_at);
const entreNous = (m, a, b) => (m.author_id === a && m.dest_id === b) || (m.author_id === b && m.dest_id === a);

// Aperçus locaux des photos et vocaux qu'on vient d'envoyer : pas de rechargement après l'envoi
const apercus = new Map();

// ---------------------------------------------------------------------------
// Petits morceaux réutilisés ailleurs (profil, mentorat, candidatures, accueil)
// ---------------------------------------------------------------------------
// Message préparé (ex. l'administration demande un CV) : repris une seule fois à l'ouverture de la conversation
const brouillons = new Map();
// icone, compte : le « Merci » des membres fondateurs (accueil) a son cœur et ne compte pas les messages non lus
export function MessageBtn({ ctx, p, label = 'Écrire', cls = 'btn small', texte = '', icone = 'chat', compte = true }) {
  const id = p?.id || p;
  if (!id || !ctx.store.peutDiscuter?.(id)) return null;
  const n = compte ? (ctx.data.messages || []).filter(m => m.author_id === id && m.dest_id === ctx.me.id && !m.lu_at).length : 0;
  return html`<button type="button" class=${cls + ' msg-btn'} onClick=${e => { e.stopPropagation(); if (texte) brouillons.set(id, texte); ctx.ecrire ? ctx.ecrire(id) : ctx.go('messages/' + id); }}>
    <${Icon} name=${icone} size=${15}/> ${label}${n ? html` <span class="count">${n}</span>` : null}</button>`;
}

function Apercu({ m, me }) {
  const moi = m.author_id === me;
  return html`<span class="ci-prev apercu">${moi ? html`<span class="ci-moi ap-qui">Toi :</span>` : null}${m.type === 'photo' ? html`<span class="ci-media"><${Icon} name="image" size=${14}/> Photo</span>`
    : m.type === 'vocal' ? html`<span class="ci-media"><${Icon} name="mic" size=${14}/> Message vocal · <span class="mono">${minSec(m.duree)}</span></span>`
    : m.type === 'rdv' ? html`<span class="ci-media"><${Icon} name="calendar" size=${14}/> Entretien proposé</span>`
    : html`<span class="ap-txt" translate="no" dir="auto">${m.body}</span>`}</span>`;
}

// Sur l'accueil : les messages qui attendent une réponse
export function MessagesHome({ ctx, exclure }) {
  const { data, me, store, go } = ctx;
  // La conversation déjà mise en avant plus haut (prochaine étape) n'est pas redite
  const att = conversations(data, me.id).filter(c => c.nonLus && !exclure?.has(c.autre)).slice(0, 3);
  if (!att.length) return null;
  return html`<div class="panel msg-home">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="chat"/> On t’a écrit</h2><button class="btn tiny ghost" onClick=${() => go('messages')}>Tous les messages <${Icon} name="arrow" size=${14}/></button></div>
    <ul class="convs">${att.map(c => { const p = store.byId('profiles', c.autre); return html`<li key=${c.autre}>
      <a class="conv-item unread" href=${'#messages/' + c.autre} onClick=${e => { e.preventDefault(); go('messages/' + c.autre); }}>
        <${Avatar} p=${p} size=${40}/><span class="ci-main"><span class="ci-top"><span class="ci-name" translate="no">${p?.full_name || 'Membre'}</span><span class="ci-time">${quandCourt(c.dernier.created_at)}</span></span>
        <${Apercu} m=${c.dernier} me=${me.id}/></span><span class="ci-n">${c.nonLus}</span></a></li>`; })}</ul>
  </div>`;
}

// Un nouveau message pendant qu'on est ailleurs sur le site : un petit mot en bas de l'écran
export function useAlerteMessages(store, me, route) {
  const vus = useRef(null);
  useEffect(() => {
    if (!me) return;
    const recus = (store.data.messages || []).filter(m => m.dest_id === me.id);
    // Au premier affichage, ou quand on change de compte, rien n'est « nouveau »
    // Ni au passage des données gardées sur l'appareil aux données fraîches (ouverture instantanée)
    const avant = vus.current?.id === me.id && !vus.current.cache ? vus.current.ids : null;
    vus.current = { id: me.id, ids: new Set(recus.map(m => m.id)), cache: !!store.depuisCache };
    if (!avant) return;
    const m = recus.find(x => !x.lu_at && !avant.has(x.id));
    if (!m || (route.base === 'messages' && route.sub === m.author_id)) return;
    const p = store.byId('profiles', m.author_id);
    // Le nom isolé, puis le début du message dans son propre sens de lecture (français dans l'interface arabe, et l'inverse)
    toast(m.type === 'texte' ? html`<span class="toast-msg"><b><bdi translate="no">${prenom(p)}</bdi>${getLang() === 'ar' ? ':' : ' :'}</b> <span translate="no" dir="auto">${m.body.length > 70 ? m.body.slice(0, 69) + '…' : m.body}</span></span>` : m.type === 'photo' ? `${prenom(p)} t’a envoyé une photo.` : `${prenom(p)} t’a envoyé un message vocal.`);
  });
}

// ---------------------------------------------------------------------------
// La page : la liste des conversations, et la conversation ouverte
// ---------------------------------------------------------------------------
export function MessagesPage(ctx) {
  const { me, data, store, sub } = ctx;
  const convs = conversations(data, me.id);
  const autre = sub && sub !== me.id && store.byId('profiles', sub) ? sub : null;
  return html`<section class=${'chat-page' + (autre ? ' has-conv' : '')}>
    <${ConvList} ctx=${ctx} convs=${convs} actif=${autre}/>
    ${autre ? html`<${Conversation} ctx=${ctx} autre=${autre} key=${autre}/>` : html`<div class="chat-vide">
      <span class="chat-vide-ico"><${Icon} name="chat" size=${34}/></span>
      <h2>Tes conversations</h2>
      <p class="muted">Écris à un lauréat qui t’aide, à un étudiant qui a postulé, à ton parrain : en texte, en photo ou en message vocal.</p>
    </div>`}
  </section>`;
}

// Les personnes à qui j'ai le droit d'écrire, mais sans conversation encore
function suggestions({ data, me, store }, convs) {
  const deja = new Set(convs.map(c => c.autre)); const ids = [];
  const add = id => { if (id && id !== me.id && !deja.has(id) && !ids.includes(id)) ids.push(id); };
  for (const m of data.mentorships) if (m.mentor_id && ['acceptee', 'demande', 'terminee'].includes(m.status)) { if (m.student_id === me.id) add(m.mentor_id); else if (m.mentor_id === me.id) add(m.student_id); }
  for (const x of data.parrainages || []) { if (x.filleul_id === me.id) add(x.parrain_id); else if (x.parrain_id === me.id) add(x.filleul_id); }
  for (const r of data.relectures_cv || []) if (r.reviewer_id && r.status !== 'annulee') { if (r.student_id === me.id) add(r.reviewer_id); else if (r.reviewer_id === me.id) add(r.student_id); }
  const mesOffres = new Set(data.offers.filter(o => o.author_id === me.id).map(o => o.id));
  for (const a of data.applications) if (a.offer_id) { if (mesOffres.has(a.offer_id)) add(a.student_id); else if (a.student_id === me.id) add(data.offers.find(o => o.id === a.offer_id)?.author_id); }
  for (const d of data.demandes_contact || []) if (d.status === 'acceptee') add(d.demandeur_id === me.id ? d.cible_id : d.cible_id === me.id ? d.demandeur_id : null);
  return ids.filter(id => store.byId('profiles', id) && store.peutDiscuter(id)).slice(0, 10);
}

function ConvList({ ctx, convs, actif }) {
  const { me, data, store, go } = ctx;
  const [q, setQ] = useState('');
  const sugg = suggestions(ctx, convs);
  const nom = id => store.byId('profiles', id)?.full_name || 'Membre';
  const list = q.trim() ? convs.filter(c => norm(nom(c.autre)).includes(norm(q.trim()))) : convs;
  const total = convs.reduce((n, c) => n + c.nonLus, 0);
  const ouvrir = (e, id) => { e.preventDefault(); go('messages/' + id); };
  return html`<aside class="conv-list" aria-label="Conversations">
    <header class="conv-head"><h1>Messages</h1>${total ? html`<span class="count">${total}</span>` : null}</header>
    ${convs.length > 5 ? html`<div class="conv-search"><${Icon} name="search" size=${16}/><input id="conv-q" type="search" aria-label="Chercher une conversation" placeholder="Chercher un nom" value=${q} onInput=${e => setQ(e.target.value)}/></div>` : null}
    ${sugg.length ? html`<div class="conv-sugg"><p class="eyebrow">Écrire à</p>
      <div class="sugg-row">${sugg.map(id => { const p = store.byId('profiles', id); const l = lienAvec(data, me, id, x => store.byId('profiles', x)); return html`<a key=${id} class="sugg" href=${'#messages/' + id} onClick=${e => ouvrir(e, id)}>
        <${Avatar} p=${p} size=${48}/><span class="sugg-nom" translate="no">${prenom(p)}</span><span class="sugg-lien">${l?.label || roleTexte(p)}</span></a>`; })}</div></div>` : null}
    ${list.length ? html`<ul class="convs">${list.map(c => { const p = store.byId('profiles', c.autre); return html`<li key=${c.autre}>
      <a class=${'conv-item' + (c.autre === actif ? ' on' : '') + (c.nonLus ? ' unread' : '')} href=${'#messages/' + c.autre} aria-current=${c.autre === actif ? 'true' : undefined} onClick=${e => ouvrir(e, c.autre)}>
        <${Avatar} p=${p} size=${46}/>
        <span class="ci-main"><span class="ci-top"><span class="ci-name" translate="no">${p?.full_name || 'Membre'}</span><span class="ci-time">${quandCourt(c.dernier.created_at)}</span></span>
          <span class="ci-bas"><${Apercu} m=${c.dernier} me=${me.id}/>${c.nonLus ? html`<span class="ci-n"><span aria-hidden="true">${c.nonLus}</span><span class="sr-only">${c.nonLus > 1 ? `${c.nonLus} messages non lus` : '1 message non lu'}</span></span>` : c.dernier.author_id === me.id && c.dernier.lu_at ? html`<span class="ci-vu"><${Icon} name="checks" size=${15}/></span>` : null}</span></span>
      </a></li>`; })}</ul>`
    : !sugg.length && !q ? html`<div class="conv-empty"><${Empty} icon="chat" scene="messages" title="Pas encore de message">Une conversation s’ouvre avec un match, un mentorat, une candidature, ton parrain ou des coordonnées partagées.<//>
        <button class="btn small" onClick=${() => go('mentorat')}><${Icon} name="mentor" size=${15}/> ${me.role === 'laureat' ? 'Voir qui a besoin d’aide' : 'Demander un conseil'}</button></div>`
    : q ? html`<p class="small muted conv-none">Aucune conversation à ce nom.</p>` : null}
    <p class="small muted conv-note"><${Icon} name="lock" size=${13}/> Une conversation n’est visible que par vous deux.</p>
  </aside>`;
}

// ---------------------------------------------------------------------------
// Une conversation
// ---------------------------------------------------------------------------
const BRISE_GLACE = {
  etudiant: ['Bonjour, merci d’avoir accepté !', 'Je peux vous envoyer mon CV ici ?', 'Quelles questions préparer pour notre appel ?'],
  laureat: ['Bonjour ! Dis-moi comment je peux t’aider.', 'Envoie-moi ton CV ici avant notre appel.', 'Bravo pour ta démarche, on en parle quand tu veux.'],
  admin: ['Bonjour ! Bienvenue sur le réseau.', 'Merci pour ta participation.', 'Une question sur la plateforme ? Réponds ici.'],
};

function Conversation({ ctx, autre }) {
  const { me, data, store, go, act, openProfile } = ctx;
  const p = store.byId('profiles', autre);
  const fil = useMemo(() => (data.messages || []).filter(m => entreNous(m, me.id, autre)).sort(byDate), [data.messages, autre, me.id]);
  const lien = lienAvec(data, me, autre, x => store.byId('profiles', x));
  const ouvert = store.peutDiscuter(autre);
  const blocage = (data.blocages || []).find(b => b.user_id === me.id && b.bloque_id === autre);
  // Le message en cours et ceux qui n'ont pas pu partir restent sur l'appareil (session expirée, réseau, rechargement) ;
  // un mot préparé ailleurs (« Écrire » avec un texte) passe devant le brouillon
  const cleMsg = me.id + ':msg:' + autre;
  const cleEchecs = me.id + ':msg-echecs:' + autre;
  const [envois, setEnvois] = useState(() => lireBrouillon(cleEchecs, []).map((a, i) => ({ id: 'echec-' + i, args: a, ...a, fichier: null, url: null, etat: 'erreur', created_at: new Date().toISOString() })));
  const [pret] = useState(() => { const b = brouillons.get(autre) || ''; brouillons.delete(autre); if (b) oublierBrouillon(cleMsg); return b; });
  const [txt, setTxt] = useBrouillon(cleMsg, pret);
  const [tape, setTape] = useState(0);
  const [menu, setMenu] = useState(false);
  const [sel, setSel] = useState(null);
  const [vue, setVue] = useState(null);
  const [plusBas, setPlusBas] = useState(false);
  // Répondre à un message précis : il s'affiche au-dessus de la zone d'écriture jusqu'à l'envoi
  const [cite, setCite] = useState(null);
  // Un match (page Match) entre nous : le bandeau, et la feuille « Programmer un entretien » (ouverte : true)
  const mt = matchEntre(data, me.id, autre);
  const [entretien, setEntretien] = useState(false);
  const zone = useRef(); const canal = useRef(null); const enBas = useRef(true); const ouvertA = useRef(Date.now());

  // Discussion ouverte (souvent depuis une notification) : les messages sont relus, au cas où le temps réel en aurait manqué
  useEffect(() => { store.rattraperMessages?.(); }, [autre]);
  // « écrit… » : signal éphémère de l'autre personne
  useEffect(() => { canal.current = store.canal(autre, () => setTape(Date.now())); return () => canal.current?.fermer(); }, [autre]);
  useEffect(() => { if (!tape) return; const t = setTimeout(() => setTape(0), 4000); return () => clearTimeout(t); }, [tape]);
  // Ce qu'il m'a écrit est lu dès que la conversation est à l'écran
  const attente = fil.filter(m => m.author_id === autre && !m.lu_at).length;
  useEffect(() => {
    const lire = () => { if (document.visibilityState !== 'hidden' && fil.some(m => m.author_id === autre && !m.lu_at)) store.marquerLus(autre).catch(() => {}); };
    lire(); document.addEventListener('visibilitychange', lire);
    return () => document.removeEventListener('visibilitychange', lire);
  }, [attente, autre]);
  // Un message de l'autre efface son « écrit… »
  const dernierAutre = fil.filter(m => m.author_id === autre).pop()?.id;
  useEffect(() => { setTape(0); }, [dernierAutre]);
  // Défilement : en bas à l'ouverture, puis on suit les nouveaux messages si on était déjà en bas
  useLayoutEffect(() => { const z = zone.current; if (z && enBas.current) z.scrollTop = z.scrollHeight; }, [fil.length, envois.length, tape, autre]);
  // Téléphone : la zone visible rétrécit quand le clavier s'ouvre
  useEffect(() => {
    const vv = window.visualViewport; if (!vv) return;
    const f = () => { document.documentElement.style.setProperty('--vvh', vv.height + 'px'); const z = zone.current; if (z && enBas.current) z.scrollTop = z.scrollHeight; };
    f(); vv.addEventListener('resize', f);
    return () => { vv.removeEventListener('resize', f); document.documentElement.style.removeProperty('--vvh'); };
  }, []);
  useEffect(() => { if (!menu) return; const f = e => { if (!e.target.closest('.conv-menu')) setMenu(false); }; document.addEventListener('click', f); return () => document.removeEventListener('click', f); }, [menu]);
  const defile = e => { const z = e.currentTarget; enBas.current = z.scrollHeight - z.scrollTop - z.clientHeight < 90; if (enBas.current !== !plusBas) setPlusBas(!enBas.current); };
  const versLeBas = () => { const z = zone.current; enBas.current = true; setPlusBas(false); z?.scrollTo({ top: z.scrollHeight, behavior: 'smooth' }); };

  const envoyer = async args => {
    const tmp = 'envoi-' + Date.now() + Math.random().toString(36).slice(2);
    const url = args.fichier ? URL.createObjectURL(args.fichier) : null;
    enBas.current = true;
    setEnvois(x => [...x, { id: tmp, args, ...args, fichier: null, url, etat: 'envoi', created_at: new Date().toISOString() }]);
    try {
      const r = await store.envoyerMessage({ dest: autre, ...args });
      if (url && r?.fichier) apercus.set(r.fichier, url);
      setEnvois(x => x.filter(e => e.id !== tmp));
      if (args.type === 'texte') { const l = lireBrouillon(cleEchecs, []), i = l.findIndex(a => a.body === args.body); if (i >= 0) ecrireBrouillon(cleEchecs, l.filter((_, j) => j !== i)); }
    } catch (e) {
      setEnvois(x => x.map(m => (m.id === tmp ? { ...m, etat: 'erreur' } : m)));
      // Gardé sur l'appareil tout de suite : la session a pu se perdre et cet écran disparaître pendant l'envoi
      if (args.type === 'texte') { const l = lireBrouillon(cleEchecs, []); if (!l.some(a => a.body === args.body)) ecrireBrouillon(cleEchecs, [...l, { type: 'texte', body: args.body, ...(args.reponse_a ? { reponse_a: args.reponse_a } : {}) }]); }
      toast(e.message || String(e), 'err');
    }
  };
  const reessayer = e => { setEnvois(x => x.filter(m => m.id !== e.id)); envoyer(e.args); };
  const bloquer = () => ctx.confirm(`Bloquer ${prenom(p)} ? Vous ne pourrez plus vous écrire. Tu peux débloquer à tout moment.`, () => act(async () => { await store.insert('blocages', { user_id: me.id, bloque_id: autre }); toast('C’est fait. Vous ne pouvez plus vous écrire.'); }), 'Bloquer');
  const debloquer = () => act(async () => { await store.remove('blocages', blocage.id); toast('Le blocage est levé.'); });
  const retirerMatch = () => ctx.confirm(`Retirer le match avec ${prenom(p)} ? La carte ne reviendra pas dans Match.`, () => act(async () => { await store.retirerMatch(mt.id); toast('Le match est retiré.'); }), 'Retirer le match');
  const supprimer = m => ctx.confirm('Supprimer ce message pour vous deux ?', () => act(async () => { await store.supprimerMessage(m.id); setSel(null); }), 'Supprimer');
  const copier = async m => { try { await navigator.clipboard.writeText(m.body || ''); toast('Message copié.'); } catch { toast('Copie impossible sur cet appareil.', 'err'); } setSel(null); };
  // Le focus se donne pendant le geste lui-même : iOS n'ouvre le clavier qu'à cette condition
  const repondre = m => { document.getElementById('chat-txt')?.focus(); setCite(m); setSel(null); };
  // Au clavier, le focus revient sur le bouton « Actions du message » (les boutons de réaction disparaissent)
  const reagir = (m, emoji) => {
    const ici = document.getElementById('msg-' + m.id)?.contains(document.activeElement);
    setSel(null); store.reagir(m.id, emoji).catch(e => toast(e.message || String(e), 'err'));
    if (ici) requestAnimationFrame(() => document.querySelector('#msg-' + m.id + ' .msg-more')?.focus());
  };
  // Le message cité : on y va, il prend le focus (lecteur d'écran, clavier) et s'éclaire un instant, un seul à la fois
  const eclaire = useRef({});
  const allerA = id => {
    const el = document.getElementById('msg-' + id); if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    const e = eclaire.current; clearTimeout(e.t); e.el?.classList.remove('eclaire');
    el.classList.remove('eclaire'); void el.offsetWidth; el.classList.add('eclaire');
    el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true });
    eclaire.current = { el, t: setTimeout(() => el.classList.remove('eclaire'), 1600) };
  };
  useEffect(() => () => clearTimeout(eclaire.current.t), []);

  const tous = [...fil, ...envois.map(e => ({ ...e, author_id: me.id, dest_id: autre }))];
  const parId = new Map(fil.map(m => [m.id, m]));
  const reactions = new Map();
  for (const r of data.reactions_messages || []) if (parId.has(r.message_id)) reactions.set(r.message_id, [...(reactions.get(r.message_id) || []), r]);
  const actif = ouvert && !blocage;
  const options = { repondre: actif && store.peutRepondre?.(), reagir: actif && store.peutReagir?.() };
  const nomDe = id => (id === me.id ? html`<strong>Toi</strong>` : html`<strong translate="no">${prenom(store.byId('profiles', id))}</strong>`);
  const rdv = lien?.type === 'mentorat' && mentorState(lien.m) === 'rdv' && lien.m.rdv_at ? lien.m : null;
  const lienVisio = rdv && store.byId('liens_rdv', rdv.id)?.lien;
  const brise = BRISE_GLACE[me.role] || BRISE_GLACE.etudiant;

  let jour = null;
  return html`<section class="conv" aria-label=${'Conversation avec ' + (p?.full_name || '')}>
    <header class="conv-top">
      <button class="icon-btn conv-back" aria-label="Retour aux conversations" onClick=${() => go('messages', { remplacer: true })}><${Icon} name="back"/></button>
      <button type="button" class="conv-who" onClick=${() => openProfile(p)}>
        <${Avatar} p=${p} size=${40}/>
        <span class="conv-who-txt"><strong translate="no">${p?.full_name || 'Membre'}</strong>
          <span class="conv-sub">${tape ? html`<span class="tape-txt">écrit<span class="tape-dots" aria-hidden="true"><i></i><i></i><i></i></span></span>`
            : lien?.label ? html`<span>${lien.label}</span>${lien.detail && lien.type !== 'match' ? html` · <bdi translate="no">${lien.detail}</bdi>` : null}` : html`<span>${roleTexte(p)}</span>`}</span></span>
      </button>
      <div class="pop-wrap conv-menu"><button class="icon-btn" aria-label="Options de la conversation" aria-expanded=${menu} onClick=${() => setMenu(!menu)}><${Icon} name="more"/></button>
        ${menu ? html`<div class="menu-pop right" role="menu">
          <button onClick=${() => { setMenu(false); openProfile(p); }}><${Icon} name="user" size=${16}/> Voir le profil</button>
          ${mt ? html`<button onClick=${() => { setMenu(false); retirerMatch(); }}><${Icon} name="x" size=${16}/> Retirer le match</button>` : null}
          ${p?.role !== 'admin' && me.role !== 'admin' ? (blocage ? html`<button onClick=${() => { setMenu(false); debloquer(); }}><${Icon} name="block" size=${16}/> Débloquer</button>`
            : html`<button class="danger-t" onClick=${() => { setMenu(false); bloquer(); }}><${Icon} name="block" size=${16}/> Bloquer</button>`) : null}
        </div>` : null}
      </div>
    </header>
    ${mt && p ? html`<${MatchBandeau} ctx=${ctx} mt=${mt} p=${p} actif=${actif} onProgrammer=${() => setEntretien(true)}/>` : null}
    ${rdv ? html`<div class="conv-rdv"><${Icon} name="video" size=${16}/><span><span>Rendez-vous</span> <span>${jourDe(rdv.rdv_at)}</span> · <span class="mono">${heure(rdv.rdv_at)}</span></span><span class="spacer"></span>
      ${lienVisio ? html`<a class="btn tiny" href=${lienVisio} target="_blank" rel="noopener"><${Icon} name="video" size=${14}/> Rejoindre</a>` : null}</div>` : null}

    <div class="conv-fil" ref=${zone} onScroll=${defile} role="log" aria-live="polite" aria-label="Messages">
      <p class="conv-safe"><${Icon} name="lock" size=${13}/> Messages visibles seulement par vous deux. Un souci ? Signale un message en un clic.</p>
      ${!tous.length ? html`<div class="conv-start"><${Avatar} p=${p} size=${72}/><strong translate="no">${p?.full_name || ''}</strong>
        <span class="small muted">${lien?.label ? html`<span>${lien.label}</span>${lien.detail ? html` · <span translate="no" dir="auto">${lien.detail}</span>` : null}` : html`<span>${roleTexte(p)}</span>`}</span>
        ${ouvert && !blocage ? html`<p class="small">Pour briser la glace :</p><div class="chips brise">${brise.map(b => html`<button type="button" class="chip" onClick=${() => { setTxt(b); document.getElementById('chat-txt')?.focus(); }}>${b}</button>`)}</div>` : null}</div>` : null}
      ${tous.map((m, i) => {
        const j = jourDe(m.created_at); const sep = j !== jour; jour = j;
        const prev = tous[i - 1]; const suite = !sep && prev && prev.author_id === m.author_id && new Date(m.created_at) - new Date(prev.created_at) < 5 * 6e4;
        return html`${sep ? html`<p class="jour" key=${'j' + j}><span>${j}</span></p>` : null}
          <${Bulle} key=${m.id} ctx=${ctx} m=${m} mine=${m.author_id === me.id} suite=${suite} neuf=${new Date(m.created_at) > ouvertA.current - 1500}
            sel=${sel === m.id} onSel=${() => setSel(sel === m.id ? null : m.id)} onVoir=${setVue} onCopier=${copier} onSupprimer=${supprimer} onReessayer=${reessayer}
            cite=${m.reponse_a ? parId.get(m.reponse_a) || 'supprime' : null} nomDe=${nomDe} onAller=${allerA} reactions=${reactions.get(m.id) || []} options=${options}
            onRepondre=${repondre} onReagir=${reagir} onAutre=${actif ? () => setEntretien(true) : null}/>`;
      })}
      ${tape ? html`<div class="msg tape-bulle" aria-hidden="true"><div class="bulle"><span class="tape-dots"><i></i><i></i><i></i></span></div></div>` : null}
    </div>
    ${plusBas ? html`<div class="conv-bas-ancre"><button class="conv-bas" aria-label="Aller aux derniers messages" onClick=${versLeBas}><${Icon} name="arrow" size=${16}/></button></div>` : null}

    ${blocage ? html`<div class="composer ferme"><${Icon} name="block" size=${16}/><span>Tu as bloqué <span translate="no">${prenom(p)}</span>.</span><span class="spacer"></span><button class="btn small" onClick=${debloquer}>Débloquer</button></div>`
      : !ouvert ? html`<div class="composer ferme"><${Icon} name="lock" size=${16}/><span>Vous ne pouvez pas vous écrire pour l’instant. Une conversation s’ouvre avec un match, un mentorat, une candidature ou des coordonnées partagées.</span></div>`
      : html`<${Composer} txt=${txt} setTxt=${setTxt} onEnvoyer=${envoyer} onTape=${() => canal.current?.tape()}
          cite=${cite && fil.some(m => m.id === cite.id) ? cite : null} nomDe=${nomDe} onAnnulerCite=${() => setCite(null)}/>`}
    ${vue ? html`<${Visionneuse} url=${vue} onClose=${() => setVue(null)}/>` : null}
    ${entretien && p ? html`<${EntretienSheet} ctx=${ctx} p=${p} onClose=${() => setEntretien(false)}/>` : null}
  </section>`;
}

// ---------------------------------------------------------------------------
// Match (match.js) : une discussion née d'un match a son bandeau (où en est-on, et les gestes utiles),
// et l'on peut y proposer un entretien (message de type 'rdv' : feuille, puis carte dans la discussion)
// ---------------------------------------------------------------------------
const ETAPES = [['match', 'Match'], ['entretien', 'Entretien'], ['retenu', 'Retenu']];
const jourMois = iso => { const d = new Date(iso); return `${d.getDate()} ${MOIS[d.getMonth()]}`; };
const httpsDe = u => (/^https?:\/\//i.test(u || '') ? u : 'https://' + u);
function MatchBandeau({ ctx, mt, p, actif, onProgrammer }) {
  const { data, me, store, act, saison } = ctx;
  const etape = etapeMatch(data, mt);
  const o = mt.offre_id ? store.byId('offers', mt.offre_id) : null;
  const etu = me.role === 'etudiant';
  const i = ETAPES.findIndex(([k]) => k === etape);
  // Le lauréat lit le CV de l'étudiant après le match ; l'étudiant envoie le sien, et postule à l'offre du match en un geste
  const cvLu = !etu && store.voitChamp(p, 'cv') ? (p.cv_path ? 'path' : p.cv_url ? 'url' : null) : null;
  const postulable = etu && actif && o && o.status === 'ouverte' && peutPostulerA(o, me, saison) && !data.applications.some(a => a.student_id === me.id && a.offer_id === o.id);
  const envoyerCV = () => {
    if (!me.cv_path && !me.cv_url) { toast('Dépose d’abord ton CV dans Mon profil.', 'info'); return ctx.go('profil'); }
    act(async () => { await store.envoyerMessage({ dest: p.id, type: 'texte', body: `${getLang() === 'ar' ? 'هذه سيرتي الذاتية:' : 'Voici mon CV :'}\n${lienDirect('cv/' + me.id)}` }); toast('CV envoyé.', 'envoi'); });
  };
  const postuler = () => act(async () => {
    await store.insert('applications', { student_id: me.id, offer_id: o.id, entreprise: o.entreprise, titre: o.titre, message: 'Suite à notre match sur le Réseau ENSAM, je postule à cette offre. Mon CV est sur mon profil.', status: 'postule' });
    toast('Candidature envoyée à ' + (p.full_name || 'au lauréat') + '.', 'envoi');
  });
  return html`<div class="mx-bandeau" role="region" aria-label="Match">
    <p class="mx-b-l1"><span class="mx-b-ico" aria-hidden="true"><${Icon} name="match" size=${16}/></span>
      <span class="mx-b-quoi"><strong>Match</strong><span aria-hidden="true">·</span><span>${jourMois(mt.created_at)}</span>${o ? html`<span aria-hidden="true">·</span><span class="mx-b-offre" translate="no" dir="auto">${titreOffre(o)}</span>` : null}</span></p>
    ${etape === 'pas_retenu' ? html`<p class="mx-b-pas small muted">Candidature pas retenue cette fois. La discussion reste ouverte.</p>`
      : html`<ol class="mx-etapes">${ETAPES.map(([k, l], j) => html`<li key=${k} class=${j < i ? 'fait' : j === i ? 'ici' : ''} aria-current=${j === i ? 'step' : null}>
          <span class="mx-e-pt" aria-hidden="true">${j < i || (j === i && k === 'retenu') ? html`<${Icon} name="check" size=${12}/>` : null}</span><span class="mx-e-lib">${l}</span></li>`)}</ol>`}
    ${actif ? html`<div class="mx-b-acts">
      <button type="button" class="btn small tonal" onClick=${onProgrammer}><${Icon} name="calendar" size=${16}/> Programmer un entretien</button>
      ${cvLu === 'path' ? html`<${OuvrirCV} store=${store} path=${p.cv_path} cls="btn small ghost"/>` : cvLu === 'url' ? html`<a class="btn small ghost" href=${httpsDe(p.cv_url)} target="_blank" rel="noopener"><${Icon} name="file" size=${14}/> Voir le CV</a>` : null}
      ${etu ? html`<button type="button" class="btn small ghost" onClick=${envoyerCV}><${Icon} name="file" size=${16}/> Envoyer mon CV</button>` : null}
      ${postulable ? html`<button type="button" class="btn small ghost" onClick=${postuler}><${Icon} name="send" size=${16}/> Postuler</button>` : null}
    </div>` : null}
  </div>`;
}

// Le CV envoyé dans la discussion : une ligne avec « Ouvrir » pour qui peut le lire (le lauréat du match, l'auteur)
function CvDansMessage({ ctx, id }) {
  const { store } = ctx;
  const p = store.byId('profiles', id);
  if (!p) return null;
  const voit = store.voitChamp(p, 'cv');
  return html`<span class="msg-cv"><${Icon} name="file" size=${16}/><span class="msg-cv-nom">${`CV de ${prenom(p)}`}</span>
    ${voit && p.cv_path ? html`<${OuvrirCV} store=${store} path=${p.cv_path} label="Ouvrir" cls="btn tiny tonal"/>`
      : voit && p.cv_url ? html`<a class="btn tiny tonal" href=${httpsDe(p.cv_url)} target="_blank" rel="noopener">Ouvrir</a>`
      : html`<span class="small muted">Lisible après un match</span>`}</span>`;
}

// Proposer un entretien : le jour, l'heure, la durée (15 min = un appel), en visio (lien Jitsi créé, ou un lien collé) ou sur place
const HEURES = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
const DUREES = [15, 30, 45, 60];
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dureeTexte = n => (n === 60 ? '1 h' : `${n} min`);
function joursProposes(now = new Date()) {
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Six jours à partir d'aujourd'hui (de demain après 17 h), sans les dimanches
  const l = [];
  for (let i = now.getHours() >= 17 ? 1 : 0; l.length < 6; i++) { const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + i); if (d.getDay() !== 0) l.push(d); }
  return l;
}
// « Aujourd’hui », « Demain », sinon « mardi 3 novembre »
const jourLong = (iso, now = new Date()) => { const d = new Date(iso), diff = Math.round((jour0(d) - jour0(now)) / 864e5); return diff === 0 ? 'Aujourd’hui' : diff === 1 ? 'Demain' : maj(`${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`); };
const nomJour = (d, now = new Date()) => { const diff = Math.round((jour0(d) - jour0(now)) / 864e5); return diff === 0 ? 'Aujourd’hui' : diff === 1 ? 'Demain' : maj(`${JOURS[d.getDay()]} ${d.getDate()}`); };
const maj = t => t.charAt(0).toUpperCase() + t.slice(1);
function EntretienSheet({ ctx, p, onClose }) {
  const { store, act } = ctx;
  const jours = useMemo(() => joursProposes(), []);
  const [jour, setJour] = useState(() => ymd(jours[Math.min(1, jours.length - 1)]));
  const [h, setH] = useState('10:00');
  const [duree, setDuree] = useState(30);
  const [mode, setMode] = useState('visio');
  const [lien, setLien] = useState('');
  const [lieu, setLieu] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const quand = new Date(`${jour}T${h || '00:00'}`);
  const valide = !isNaN(quand) && quand.getTime() > Date.now() && quand.getTime() <= Date.now() + 120 * 864e5;
  const max = ymd(new Date(Date.now() + 119 * 864e5));
  const autreJour = !jours.some(d => ymd(d) === jour), autreHeure = !HEURES.includes(h);
  const envoyer = e => {
    e?.preventDefault?.();
    const l = lien.trim(), li = lieu.trim().slice(0, 200);
    if (!valide) return setErr('Choisis une date à venir, dans les 4 prochains mois.');
    if (mode === 'visio' && l && !/^https:\/\/\S+$/i.test(l)) return setErr('Le lien de la visio doit commencer par https://');
    if (mode === 'lieu' && !li) return setErr('Indique le lieu de l’entretien.');
    setErr('');
    act(async () => {
      await store.envoyerMessage({ dest: p.id, type: 'rdv', body: note.trim() || null, rdv_at: quand.toISOString(), rdv_duree: duree, rdv_lieu: mode === 'lieu' ? li : null, rdv_lien: mode === 'visio' ? l || jitsiLink() : null });
      toast(`Entretien proposé à ${prenom(p)}.`, 'envoi');
      onClose();
    });
  };
  const resume = valide ? `${jourLong(quand.toISOString())} · ${heure(quand.toISOString())} · ${duree === 15 ? 'Appel de 15 min' : dureeTexte(duree)}` : null;
  return html`<${Modal} title="Programmer un entretien" onClose=${onClose} cls="mx-feuille" footer=${html`
    <button type="submit" form="mx-rdv-f" class="btn primary"><${Icon} name="send" size=${18}/> Proposer l’entretien</button>`}>
    <form id="mx-rdv-f" class="mx-rdv-form" onSubmit=${envoyer} noValidate>
      <p class="mx-avec"><${Avatar} p=${p} size=${32}/><span>${`Entretien avec ${p.full_name}`}</span></p>
      <fieldset class="mx-fs"><legend>Jour</legend>
        <div class="chips">${jours.map(d => html`<button type="button" key=${ymd(d)} class=${'chip' + (ymd(d) === jour ? ' on' : '')} aria-pressed=${ymd(d) === jour} onClick=${() => setJour(ymd(d))}>${nomJour(d)}</button>`)}</div>
        <label class=${'mx-autre' + (autreJour ? ' on' : '')}><span>Autre date</span><input type="date" id="mx-rdv-jour" min=${ymd(new Date())} max=${max} value=${jour} onInput=${e => e.target.value && setJour(e.target.value)}/></label>
      </fieldset>
      <fieldset class="mx-fs"><legend>Heure</legend>
        <div class="chips">${HEURES.map(x => html`<button type="button" key=${x} class=${'chip time mono' + (x === h ? ' on' : '')} aria-pressed=${x === h} onClick=${() => setH(x)}>${x}</button>`)}</div>
        <label class=${'mx-autre' + (autreHeure ? ' on' : '')}><span>Autre heure</span><input type="time" id="mx-rdv-heure" step="300" value=${h} onInput=${e => e.target.value && setH(e.target.value)}/></label>
      </fieldset>
      <fieldset class="mx-fs"><legend>Durée</legend>
        <div class="chips">${DUREES.map(n => html`<button type="button" key=${n} class=${'chip' + (n === duree ? ' on' : '')} aria-pressed=${n === duree} onClick=${() => setDuree(n)}>${n === 15 ? '15 min · appel' : dureeTexte(n)}</button>`)}</div>
      </fieldset>
      <fieldset class="mx-fs"><legend>Où</legend>
        <div class="seg" role="group"><button type="button" class=${mode === 'visio' ? 'on' : ''} aria-pressed=${mode === 'visio'} onClick=${() => setMode('visio')}><${Icon} name="video" size=${16}/> En visio</button>
          <button type="button" class=${mode === 'lieu' ? 'on' : ''} aria-pressed=${mode === 'lieu'} onClick=${() => setMode('lieu')}><${Icon} name="pin" size=${16}/> Sur place</button></div>
        ${mode === 'visio' ? html`<label class="field"><span class="field-label">Lien Meet ou Teams (facultatif)</span>
            <input type="url" id="mx-rdv-lien" inputmode="url" dir="ltr" placeholder="https://…" maxlength="300" value=${lien} onInput=${e => setLien(e.target.value)}/>
            <span class="small muted">Sans lien, une visio Jitsi est créée pour vous deux.</span></label>`
          : html`<label class="field"><span class="field-label">Lieu</span><input type="text" id="mx-rdv-lieu" maxlength="200" placeholder="Ex. : usine de Meknès, accueil principal" value=${lieu} onInput=${e => setLieu(e.target.value)}/></label>`}
      </fieldset>
      <label class="field"><span class="field-label">Un mot (facultatif)</span><textarea id="mx-rdv-note" rows="2" maxlength="500" placeholder="Ex. : prépare un exemple de projet." value=${note} onInput=${e => setNote(e.target.value)}></textarea></label>
      ${resume ? html`<p class="mx-resume"><${Icon} name="calendar" size=${16}/><span>${resume}</span></p>` : null}
      ${err ? html`<p class="mx-err" role="alert">${err}</p>` : null}
    </form>
  <//>`;
}

// Un entretien proposé, dans la discussion : la date en grand, la durée, la visio ou le lieu ; le destinataire répond
// (« Je serai là » / « Autre horaire »), chacun l'ajoute à son agenda ; « Rejoindre » paraît 10 minutes avant.
function CarteRdv({ ctx, m, mine, onAutre }) {
  const { store, me, act } = ctx;
  const [, tic] = useState(0);
  const debut = new Date(m.rdv_at).getTime(), fin = debut + (m.rdv_duree || 30) * 6e4;
  useEffect(() => { if (Date.now() > fin) return; const t = setInterval(() => tic(x => x + 1), 30e3); return () => clearInterval(t); }, [m.rdv_at, m.rdv_duree]);
  const now = Date.now(), passe = now > fin, direct = !passe && now >= debut - 10 * 6e4;
  const autre = store.byId('profiles', mine ? m.dest_id : m.author_id);
  const nom = prenom(autre);
  const visio = !m.rdv_lieu;
  const repondre = r => act(async () => {
    await store.repondreRdv(m.id, r);
    if (r === 'oui') toast(`C’est noté : ${nom} sait que tu seras là.`);
    else { toast('Propose un autre horaire qui te convient.', 'info'); onAutre?.(); }
  });
  const ar = getLang() === 'ar';
  const txt = { m, lien: m.rdv_lien, lieu: m.rdv_lieu,
    title: ar ? `مقابلة · شبكة ENSAM مكناس: ${autre?.full_name || ''}` : `Entretien Réseau ENSAM : ${autre?.full_name || ''}`,
    details: [ar ? `${m.rdv_duree} دقيقة` : `${m.rdv_duree} min`, m.rdv_lien ? (ar ? `الاتصال المرئي: ${m.rdv_lien}` : `Visio : ${m.rdv_lien}`) : null, m.rdv_lieu ? (ar ? `المكان: ${m.rdv_lieu}` : `Lieu : ${m.rdv_lieu}`) : null, m.body, ar ? 'شبكة ENSAM مكناس' : 'Réseau ENSAM Meknès'].filter(Boolean).join('\n') };
  const r = m.rdv_reponse;
  return html`<div class=${'rdv-carte' + (passe ? ' passe' : '') + (direct ? ' direct' : '')}>
    <p class="rdv-c-oeil"><${Icon} name="calendar" size=${14}/> <span>${mine ? 'Tu proposes un entretien' : 'Entretien proposé'}</span></p>
    <p class="rdv-c-quand"><span class="rdv-c-jour">${jourLong(m.rdv_at)}</span><span class="rdv-c-h mono">${heure(m.rdv_at)}</span></p>
    <p class="rdv-c-quoi"><span>${m.rdv_duree === 15 ? 'Appel de 15 min' : dureeTexte(m.rdv_duree)}</span> · ${visio ? html`<span>En visio</span>` : html`<span translate="no" dir="auto">${m.rdv_lieu}</span>`}</p>
    ${visio && m.rdv_lien ? html`<p class="rdv-c-lien mono" dir="ltr" translate="no">${m.rdv_lien.replace(/^https:\/\//, '')}</p>` : null}
    ${m.body ? html`<p class="rdv-c-note" translate="no" dir="auto">${m.body}</p>` : null}
    ${passe ? html`<p class="rdv-c-etat muted"><${Icon} name="clock" size=${15}/> <span>Entretien passé</span></p>`
      : html`
      ${direct && m.rdv_lien ? html`<a class="btn small primary rdv-c-go" href=${m.rdv_lien} target="_blank" rel="noopener"><${Icon} name="video" size=${16}/> Rejoindre</a>` : null}
      ${r === 'oui' ? html`<p class="rdv-c-etat bon"><${Icon} name="checks" size=${15}/> <span>${mine ? `${nom} sera là` : 'Tu as dit que tu serais là.'}</span></p>`
        : r === 'autre' ? html`<p class="rdv-c-etat"><${Icon} name="clock" size=${15}/> <span>${mine ? `${nom} propose un autre horaire` : 'Tu as demandé un autre horaire.'}</span></p>`
        : mine ? html`<p class="rdv-c-etat muted"><${Icon} name="clock" size=${15}/> <span>${`En attente de la réponse de ${nom}`}</span></p>` : null}
      ${!mine ? html`<div class="rdv-c-acts">
        ${r !== 'oui' ? html`<button type="button" class="btn small tonal" onClick=${() => repondre('oui')}><${Icon} name="check" size=${16}/> Je serai là</button>` : null}
        ${r !== 'autre' ? html`<button type="button" class="btn small ghost" onClick=${() => repondre('autre')}>Autre horaire</button>` : null}
      </div>` : null}
      <details class="rdv-cal mx-cal"><summary class="btn tiny ghost"><${Icon} name="calendar" size=${14}/> Ajouter à l’agenda</summary>
        <div class="rdv-cal-body"><a class="btn tiny ghost" href=${gcalUrl(txt)} target="_blank" rel="noopener">Google Agenda</a><a class="btn tiny ghost" href=${icsHref(txt)} download="entretien-reseau-ensam.ics"><${Icon} name="download" size=${14}/> Autre agenda (.ics)</a></div></details>`}
  </div>`;
}

// Les liens écrits dans un message deviennent cliquables ; le lien « mon CV » (#cv/<id>, bouton « Envoyer mon CV ») devient le CV lui-même
const LIEN_CV = /#cv\/([0-9a-z-]{6,})$/i;
function Texte({ body, ctx }) {
  const parts = String(body || '').split(/(https?:\/\/[^\s<>"]+)/g);
  return html`<p class="msg-txt" translate="no" dir="auto">${parts.map((x, i) => (i % 2 ? (ctx && LIEN_CV.test(x) ? html`<${CvDansMessage} ctx=${ctx} id=${LIEN_CV.exec(x)[1]}/>` : html`<a href=${x} target="_blank" rel="noopener nofollow ugc">${x}</a>`) : x))}</p>`;
}

// Ce que montre un message cité : sa première ligne, ou « Photo » / « Message vocal »
function ExtraitCite({ m }) {
  const ligne = String(m.body || '').split('\n').find(x => x.trim()) || '';
  if (m.type === 'vocal') return html`<span class="cite-extrait"><${Icon} name="mic" size=${13}/> <span>Message vocal</span></span>`;
  if (m.type === 'rdv') return html`<span class="cite-extrait"><${Icon} name="calendar" size=${13}/> <span>Entretien proposé</span></span>`;
  if (m.type === 'photo') return html`<span class="cite-extrait"><${Icon} name="image" size=${13}/> ${ligne ? html`<span translate="no" dir="auto">${ligne}</span>` : html`<span>Photo</span>`}</span>`;
  return html`<span class="cite-extrait" translate="no" dir="auto">${ligne}</span>`;
}

// Téléphone : glisser une bulle vers l'intérieur répond, un appui long ouvre les actions
const SEUIL_GLISSE = 56;
function useGeste({ onRepondre, onSel }) {
  const g = useRef({});
  const fin = e => {
    const s = g.current; if (!s.el) return;
    clearTimeout(s.long);
    s.el.style.transform = ''; s.el.parentElement?.style.removeProperty('--g');
    if (s.glisse && s.dx >= SEUIL_GLISSE && e.type === 'pointerup' && onRepondre) { navigator.vibrate?.(8); onRepondre(); }
    g.current = {};
  };
  return {
    onPointerDown: e => {
      if (e.pointerType !== 'touch') return;
      const el = e.currentTarget;
      g.current = { el, id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, glisse: null, sens: getComputedStyle(el).direction === 'rtl' ? -1 : 1,
        long: setTimeout(() => { if (g.current.el === el && !g.current.glisse) { g.current.glisse = false; navigator.vibrate?.(8); onSel(); } }, 480) };
    },
    onPointerMove: e => {
      const s = g.current; if (!s.el || e.pointerId !== s.id) return;
      const dx = (e.clientX - s.x) * s.sens, dy = e.clientY - s.y;
      if (s.glisse === null && Math.hypot(dx, dy) > 8) { clearTimeout(s.long); s.glisse = !!onRepondre && dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.4; }
      if (!s.glisse) return;
      s.dx = Math.max(0, Math.min(84, dx));
      s.el.style.transform = `translateX(${s.sens * s.dx}px)`;
      s.el.parentElement?.style.setProperty('--g', Math.min(1, s.dx / SEUIL_GLISSE).toFixed(2));
    },
    onPointerUp: fin, onPointerCancel: fin,
  };
}

function Bulle({ ctx, m, mine, suite, neuf, sel, onSel, onVoir, onCopier, onSupprimer, onReessayer, cite, nomDe, onAller, reactions = [], options = {}, onRepondre, onReagir, onAutre }) {
  const envoi = m.etat === 'envoi', erreur = m.etat === 'erreur', pret = !envoi && !erreur;
  const peutRepondre = pret && options.repondre, peutReagir = pret && options.reagir;
  const geste = useGeste({ onRepondre: peutRepondre ? () => onRepondre(m) : null, onSel: pret ? onSel : () => {} });
  const moi = ctx.me.id;
  const mienne = reactions.find(r => r.user_id === moi)?.emoji;
  // Les actions ouvertes sous le dernier message restent à l'écran
  const racine = useRef();
  useEffect(() => { if (sel) racine.current?.querySelector('.msg-actions')?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  // Une pastille par emoji (deux personnes au plus dans une conversation)
  const pastilles = [];
  for (const r of reactions) { const x = pastilles.find(p => p.emoji === r.emoji); if (x) x.qui.push(r.user_id); else pastilles.push({ emoji: r.emoji, qui: [r.user_id] }); }
  return html`<div id=${'msg-' + m.id} ref=${racine} class=${'msg' + (mine ? ' mine' : '') + (suite ? ' suite' : '') + (neuf ? ' neuf' : '') + (envoi ? ' envoi' : '') + (erreur ? ' erreur' : '') + (sel ? ' sel' : '') + (pastilles.length ? ' a-react' : '')}>
    ${peutRepondre ? html`<span class="glisse-ico" aria-hidden="true"><${Icon} name="reply" size=${18}/></span>` : null}
    <div class=${'bulle t-' + (m.type || 'texte') + (cite ? ' avec-cite' : '')} ...${geste}>
      ${cite === 'supprime' ? html`<span class="msg-cite supprime"><span>Message supprimé</span></span>`
        : cite ? html`<button type="button" class="msg-cite" onClick=${() => onAller(cite.id)}>${nomDe(cite.author_id)}<${ExtraitCite} m=${cite}/></button>` : null}
      ${m.type === 'photo' ? html`<${Photo} ctx=${ctx} m=${m} onVoir=${onVoir}/>` : null}
      ${m.type === 'vocal' ? html`<${Vocal} ctx=${ctx} m=${m}/>` : null}
      ${m.type === 'rdv' ? html`<${CarteRdv} ctx=${ctx} m=${m} mine=${mine} onAutre=${onAutre}/>` : null}
      ${m.body && m.type !== 'vocal' && m.type !== 'rdv' ? html`<${Texte} body=${m.body} ctx=${ctx}/>` : null}
      <span class="msg-meta"><span class="mono">${heure(m.created_at)}</span>${mine ? html`<span class=${'msg-etat' + (m.lu_at ? ' lu' : '')} title=${erreur ? 'Non envoyé' : envoi ? 'Envoi en cours' : m.lu_at ? 'Vu' : 'Envoyé'}><span class="sr-only">${erreur ? 'Non envoyé' : envoi ? 'Envoi en cours' : m.lu_at ? 'Vu' : 'Envoyé'}</span>
        <${Icon} name=${erreur ? 'x' : envoi ? 'clock' : m.lu_at ? 'checks' : 'check'} size=${14}/></span>` : null}</span>
      ${pastilles.length ? html`<span class="msg-reacts">${pastilles.map(p => {
        const aMoi = p.qui.includes(moi);
        const n = p.qui.length > 1 ? html`<span class="react-n">${p.qui.length}</span>` : null;
        // Le nom accessible dit aussi quand l'autre personne a choisi le même emoji (le « 2 » affiché)
        const autre = p.qui.find(u => u !== moi), nomAutre = autre ? prenom(ctx.store.byId('profiles', autre)) : null;
        return aMoi && peutReagir
          ? html`<button type="button" key=${p.emoji} class="react-pill mien" aria-label=${'Retirer ma réaction ' + p.emoji + (nomAutre ? ' (' + nomAutre + ' aussi)' : '')} title=${'Retirer ma réaction ' + p.emoji} onClick=${() => onReagir(m, p.emoji)}>${p.emoji}${n}</button>`
          : html`<span key=${p.emoji} class=${'react-pill' + (aMoi ? ' mien' : '')} role="img" aria-label=${aMoi ? (nomAutre ? 'Toi et ' + nomAutre + ' : ' + p.emoji : 'Ta réaction ' + p.emoji) : 'Réaction de ' + nomAutre + ' : ' + p.emoji}>${p.emoji}${n}</span>`;
      })}</span>` : null}
    </div>
    ${erreur ? html`<button type="button" class="linkish small msg-retry" onClick=${() => onReessayer(m)}>Non envoyé · Réessayer</button>`
      : envoi ? null : html`<button type="button" class="icon-btn small msg-more" aria-label="Actions du message" aria-expanded=${sel} onClick=${onSel}><${Icon} name="more" size=${16}/></button>`}
    ${sel ? html`<div class="msg-actions" role="group" aria-label="Actions du message">
      ${peutReagir ? html`<div class="react-bar" role="group" aria-label="Réagir à ce message">${REACTIONS.map(e => html`<button type="button" class=${'react-btn' + (mienne === e ? ' on' : '')} aria-pressed=${mienne === e} aria-label=${'Réagir avec ' + e} onClick=${() => onReagir(m, e)}>${e}</button>`)}</div>` : null}
      <div class="msg-acts-row">
        ${peutRepondre ? html`<button type="button" class="btn tiny ghost" onClick=${() => onRepondre(m)}><${Icon} name="reply" size=${14}/> ${getLang() === 'ar' ? 'رد' : 'Répondre'}</button>` : null}
        ${m.body && m.type !== 'vocal' ? html`<button type="button" class="btn tiny ghost" onClick=${() => onCopier(m)}><${Icon} name="copy" size=${14}/> Copier</button>` : null}
        ${mine ? html`<button type="button" class="btn tiny ghost danger-t" onClick=${() => onSupprimer(m)}><${Icon} name="trash" size=${14}/> Supprimer</button>` : html`<${SignalerBtn} ctx=${ctx} type="prive" id=${m.id}/>`}
      </div>
    </div>` : null}
  </div>`;
}

function useFichier(ctx, m) {
  const [url, setUrl] = useState(() => m.url || apercus.get(m.fichier) || null);
  const [ko, setKo] = useState(false);
  const charger = async () => {
    if (url) return url;
    if (!m.fichier) return null;
    const u = await ctx.store.lienChat(m.fichier).catch(() => null);
    if (u) setUrl(u); else setKo(true);
    return u;
  };
  return { url, ko, setKo, charger };
}

function Photo({ ctx, m, onVoir }) {
  const f = useFichier(ctx, m);
  const [pret, setPret] = useState(false);
  useEffect(() => { f.charger(); }, [m.fichier]);
  const ratio = m.largeur && m.hauteur ? Math.max(.5, Math.min(2, m.largeur / m.hauteur)) : 4 / 3;
  return html`<button type="button" class=${'msg-photo' + (pret ? ' pret' : '')} style=${`aspect-ratio:${ratio}`} aria-label="Agrandir la photo" onClick=${() => f.url && onVoir(f.url)}>
    ${f.url && !f.ko ? html`<img src=${f.url} alt="" decoding="async" onLoad=${() => setPret(true)} onError=${() => f.setKo(true)}/>` : null}
    ${f.ko ? html`<span class="small photo-ko"><${Icon} name="image" size=${20}/> Photo indisponible</span>` : null}
  </button>`;
}

// Hauteurs des barres du vocal : enregistrées avec le message (0 à 9), sinon une forme douce
function barresDe(onde, id = '') {
  if (onde && /^\d+$/.test(onde)) return [...onde].map(c => Math.max(1, +c));
  let h = 7; return Array.from({ length: 32 }, (_, i) => { for (const c of id + i) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 2 + (h % 7); });
}
function ondeDe(niveaux, n = 36) {
  if (!niveaux.length) return '';
  const max = Math.max(...niveaux) || 1; const out = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * niveaux.length / n), b = Math.max(a + 1, Math.floor((i + 1) * niveaux.length / n));
    const v = niveaux.slice(a, b).reduce((x, y) => x + y, 0) / (b - a);
    out.push(Math.max(1, Math.min(9, Math.round(v / max * 9))));
  }
  return out.join('');
}

function Vocal({ ctx, m }) {
  const f = useFichier(ctx, m);
  const audio = useRef();
  const [joue, setJoue] = useState(false);
  const [pos, setPos] = useState(0);
  const barres = useMemo(() => barresDe(m.onde, m.id), [m.onde, m.id]);
  const total = m.duree || 0;
  const basculer = async () => {
    const a = audio.current; if (!a) return;
    if (joue) { a.pause(); return; }
    const u = await f.charger(); if (!u) return;
    if (a.getAttribute('src') !== u) a.src = u;
    document.querySelectorAll('audio.vocal-audio').forEach(x => { if (x !== a) x.pause(); });
    a.play().catch(() => f.setKo(true));
  };
  const chercher = e => {
    const a = audio.current; if (!a || !total || !a.src) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(total, (e.clientX - r.left) / r.width * total));
  };
  return html`<div class="vocal" dir="ltr">
    <button type="button" class="vocal-play" aria-label=${joue ? 'Pause' : 'Écouter le message vocal'} onClick=${basculer}><${Icon} name=${joue ? 'pause' : 'play'} size=${18}/></button>
    <span class="vocal-onde" aria-hidden="true" onClick=${chercher}>${barres.map((h, i) => html`<i style=${`--h:${h}`} class=${(i + .5) / barres.length <= pos ? 'on' : ''}></i>`)}</span>
    <span class="vocal-t mono">${f.ko ? html`<span class="small">Lecture impossible</span>` : minSec(joue || pos ? Math.min(total, pos * total) : total)}</span>
    <audio class="vocal-audio" ref=${audio} preload="none"
      onPlay=${() => setJoue(true)} onPause=${() => setJoue(false)} onEnded=${() => { setJoue(false); setPos(0); }}
      onTimeUpdate=${e => setPos(Math.min(1, e.target.currentTime / (Number.isFinite(e.target.duration) && e.target.duration ? e.target.duration : total || 1)))} onError=${() => audio.current?.getAttribute('src') && f.setKo(true)}></audio>
  </div>`;
}

// Photo en grand, par-dessus tout
function Visionneuse({ url, onClose }) {
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  return html`<div class="visionneuse" role="dialog" aria-modal="true" aria-label="Photo" onClick=${onClose}>
    <img src=${url} alt=""/>
    <button class="icon-btn" aria-label="Fermer" onClick=${onClose}><${Icon} name="x"/></button>
  </div>`;
}

// ---------------------------------------------------------------------------
// Écrire : texte, photo (réduite avant l'envoi), message vocal (2 minutes au plus)
// ---------------------------------------------------------------------------
async function compresserImage(file, max = 1600) {
  if (!/^image\//.test(file.type || 'image/')) throw new Error('Choisis une photo.');
  let img;
  try { img = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Format de photo non reconnu. Essaie en JPEG ou PNG.')); i.src = URL.createObjectURL(file); });
  }
  const w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', .82));
  if (!blob) throw new Error('Format de photo non reconnu. Essaie en JPEG ou PNG.');
  return { blob, largeur: c.width, hauteur: c.height };
}

function useEnregistreur(onFini) {
  const [etat, setEtat] = useState('pret');
  const [sec, setSec] = useState(0);
  const [niv, setNiv] = useState([]);
  const r = useRef({});
  const possible = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
  const nettoyer = () => { const x = r.current; clearInterval(x.timer); x.stream?.getTracks().forEach(t => t.stop()); x.ac?.close?.().catch?.(() => {}); r.current = {}; };
  useEffect(() => () => { if (r.current.rec?.state === 'recording') { r.current.rec.onstop = null; r.current.rec.stop(); } nettoyer(); }, []);
  const arreter = envoyer => {
    const x = r.current; if (!x.rec) return;
    clearInterval(x.timer);
    x.rec.onstop = () => {
      const type = (x.rec.mimeType || 'audio/webm').split(';')[0];
      const blob = new Blob(x.morceaux, { type });
      const duree = Math.min(VOCAL_MAX, Math.round((Date.now() - x.t0) / 1000));
      const onde = ondeDe(x.niveaux);
      nettoyer(); setEtat('pret'); setSec(0);
      if (envoyer && duree >= 1 && blob.size) onFini({ type: 'vocal', fichier: blob, ext: type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : type.includes('mpeg') ? 'mp3' : 'webm', duree, onde });
      else if (envoyer) toast('Message trop court : garde le micro au moins une seconde.', 'err');
    };
    x.rec.stop();
  };
  const demarrer = async () => {
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { toast('Autorise le micro pour envoyer un message vocal.', 'err'); return; }
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported?.(t)) || '';
    let rec;
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : {}); } catch { rec = new MediaRecorder(stream); }
    const x = { stream, rec, morceaux: [], niveaux: [], t0: Date.now() };
    rec.ondataavailable = e => { if (e.data?.size) x.morceaux.push(e.data); };
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      x.ac = new AC(); x.an = x.ac.createAnalyser(); x.an.fftSize = 512; x.ac.createMediaStreamSource(stream).connect(x.an); x.buf = new Uint8Array(x.an.fftSize);
    } catch { /* pas de niveaux : le vocal part quand même */ }
    x.timer = setInterval(() => {
      const s = (Date.now() - x.t0) / 1000; setSec(s);
      if (x.an) {
        x.an.getByteTimeDomainData(x.buf); let q = 0;
        for (const v of x.buf) { const d = (v - 128) / 128; q += d * d; }
        x.niveaux.push(Math.min(1, Math.sqrt(q / x.buf.length) * 4)); setNiv(x.niveaux.slice(-30));
      }
      if (s >= VOCAL_MAX) arreter(true);
    }, 100);
    r.current = x; rec.start(250); setSec(0); setNiv([]); setEtat('rec');
  };
  return { possible, etat, sec, niv, demarrer, arreter };
}

function Composer({ txt, setTxt, onEnvoyer, onTape, cite, nomDe, onAnnulerCite }) {
  const ta = useRef(); const fichierIn = useRef();
  // Ce qui part pendant qu'un message est cité lui répond (texte, photo ou vocal)
  const citeRef = useRef(cite); citeRef.current = cite;
  const partir = a => { const c = citeRef.current; onEnvoyer(c ? { ...a, reponse_a: c.id } : a); if (c) onAnnulerCite(); };
  const rec = useEnregistreur(partir);
  const ajuster = () => { const t = ta.current; if (!t) return; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 140) + 'px'; };
  useEffect(ajuster, [txt]);
  const envoyerTexte = () => { const b = txt.trim(); if (!b) return; partir({ type: 'texte', body: b }); setTxt(''); ta.current?.focus(); };
  // Ordinateur : Entrée envoie, Maj+Entrée va à la ligne. Téléphone : Entrée va à la ligne.
  const clavier = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia?.('(pointer: fine)').matches) { e.preventDefault(); envoyerTexte(); } };
  const photo = async e => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    try { const { blob, largeur, hauteur } = await compresserImage(f); partir({ type: 'photo', fichier: blob, ext: 'jpg', largeur, hauteur, body: txt.trim() || null }); setTxt(''); }
    catch (err) { toast(err.message || 'Photo impossible à envoyer.', 'err'); }
  };
  // Le message cité reste affiché (et annulable) pendant l'enregistrement d'un vocal : le vocal lui répondra
  const bandeau = cite ? html`<div class="comp-cite" role="group" aria-label="Tu réponds à ce message">
    <${Icon} name="reply" size=${16}/><span class="comp-cite-txt">${nomDe(cite.author_id)}<${ExtraitCite} m=${cite}/></span>
    <button type="button" class="icon-btn small" aria-label="Annuler la réponse" onClick=${() => { onAnnulerCite(); if (rec.etat !== 'rec') ta.current?.focus(); }}><${Icon} name="x" size=${16}/></button></div>` : null;
  if (rec.etat === 'rec') return html`<div class="composer rec ecrire" role="group" aria-label="Enregistrement d’un message vocal">
    ${bandeau}
    <div class="comp-row">
      <button type="button" class="icon-btn" aria-label="Annuler l’enregistrement" onClick=${() => rec.arreter(false)}><${Icon} name="trash"/></button>
      <span class="rec-dot" aria-hidden="true"></span><span class="mono rec-t">${minSec(rec.sec)}</span>
      <span class="rec-niv" aria-hidden="true">${rec.niv.map(v => html`<i style=${`--h:${Math.max(.08, v)}`}></i>`)}</span>
      <span class="small muted rec-max">${minSec(VOCAL_MAX)} max</span>
      <button type="button" class="send-btn" aria-label="Envoyer le message vocal" onClick=${() => rec.arreter(true)}><${Icon} name="send" size=${19}/></button>
    </div>
  </div>`;
  return html`<div class="composer ecrire">
    ${bandeau}
    <div class="comp-row">
      <button type="button" class="icon-btn comp-photo" aria-label="Envoyer une photo" title="Photo" onClick=${() => fichierIn.current?.click()}><${Icon} name="image"/></button>
      <input type="file" accept="image/*" class="sr-file" tabindex="-1" aria-hidden="true" ref=${fichierIn} onChange=${photo}/>
      <textarea id="chat-txt" ref=${ta} rows="1" maxlength="2000" aria-label="Ton message" placeholder="Écris un message…" value=${txt}
        onInput=${e => { setTxt(e.target.value); onTape(); }} onKeyDown=${clavier}></textarea>
      ${txt.trim() || !rec.possible ? html`<button type="button" class="send-btn" aria-label="Envoyer" disabled=${!txt.trim()} onClick=${envoyerTexte}><${Icon} name="send" size=${19}/></button>`
        : html`<button type="button" class="send-btn mic" aria-label="Enregistrer un message vocal" title="Message vocal" onClick=${rec.demarrer}><${Icon} name="mic" size=${20}/></button>`}
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
injectCSS('messagerie', `
.main.full { height: 100vh; height: 100dvh; }
.main.full .content.flush { flex: 1; min-height: 0; padding: 0; display: flex; }
.chat-page { flex: 1; min-height: 0; min-width: 0; display: grid; grid-template-columns: minmax(280px, 340px) minmax(0, 1fr); background: var(--surface); }
.conv-list { min-width: 0; display: flex; flex-direction: column; min-height: 0; border-inline-end: 1px solid var(--line); background: var(--surface); }
.conv-head { display: flex; align-items: center; gap: .6rem; padding: 1.1rem 1.1rem .5rem; }
.conv-head h1 { font-size: 1.5rem; }
.conv-search { margin: .2rem 1rem .5rem; display: flex; align-items: center; gap: .4rem; padding: 0 .7rem; border-radius: 999px; background: var(--surface-2); color: var(--muted); }
.conv-search input { border: 0; background: transparent; padding: .5rem 0; }
.conv-sugg { padding: .3rem 0 .6rem; border-bottom: 1px solid var(--line); }
.conv-sugg .eyebrow { padding: 0 1.1rem; }
.sugg-row { display: flex; gap: .3rem; overflow-x: auto; padding: .2rem .8rem .2rem; scrollbar-width: none; }
.sugg { display: flex; flex-direction: column; align-items: center; gap: .2rem; width: 76px; flex: none; padding: .4rem .2rem; border-radius: 12px; text-decoration: none; color: var(--ink); text-align: center; }
.sugg:hover { background: var(--surface-2); }
.sugg-nom { font-size: .8rem; font-weight: 600; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sugg-lien { font-size: var(--fs-1); color: var(--muted); }
.convs { list-style: none; margin: 0; padding: .3rem .45rem; overflow-y: auto; flex: 1; min-height: 0; }
.conv-item { display: flex; align-items: center; gap: .75rem; padding: .6rem .65rem; border-radius: 14px; color: var(--ink); text-decoration: none; transition: background .15s; }
.conv-item:hover { background: var(--surface-2); }
.conv-item.on { background: var(--accent-soft); }
.ci-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.ci-top, .ci-bas { display: flex; align-items: center; gap: .5rem; min-width: 0; }
.ci-name { flex: 1; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ci-time { font-size: var(--fs-1); color: var(--muted); flex: none; }
.ci-prev { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: .3rem; color: var(--muted); font-size: .88rem; overflow: hidden; white-space: nowrap; }
.ci-prev > span { white-space: nowrap; }
.ci-prev > :not(.ci-moi) { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.ci-moi { flex: none; }
.ci-media { display: inline-flex; align-items: center; gap: .25rem; vertical-align: middle; }
.conv-item.unread .ci-prev { color: var(--ink); font-weight: 500; }
.conv-item.unread .ci-time { color: var(--accent); font-weight: 600; }
.ci-n { min-width: 22px; height: 22px; padding: 0 6px; border-radius: 11px; background: var(--accent); color: var(--accent-ink); font: 600 var(--fs-1)/22px var(--f-body); text-align: center; flex: none; font-variant-numeric: tabular-nums; }
.ci-vu { color: var(--accent); display: inline-flex; flex: none; }
.conv-note { padding: .7rem 1.1rem 1rem; display: flex; align-items: center; gap: .35rem; }
.conv-empty { padding: 1rem; display: flex; flex-direction: column; align-items: center; gap: .6rem; }
.conv-none { padding: .5rem 1.1rem; }
.chat-vide { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .6rem; padding: 2rem; text-align: center; background: color-mix(in srgb, var(--accent-soft) 40%, var(--bg)); }
.chat-vide p { max-width: 38ch; }
.chat-vide-ico { width: 84px; height: 84px; border-radius: 50%; display: grid; place-items: center; background: var(--surface); color: var(--blue-text); box-shadow: var(--sh2); margin-bottom: .3rem; }

.conv { position: relative; display: flex; flex-direction: column; min-height: 0; min-width: 0; background: color-mix(in srgb, var(--accent-soft) 38%, var(--bg)); }
.conv-top { display: flex; align-items: center; gap: .4rem; padding: .5rem .7rem; background: var(--surface); border-bottom: 1px solid var(--line); }
.conv-back { display: none; }
.conv-who { flex: 1; min-width: 0; display: flex; align-items: center; gap: .65rem; border: 0; background: none; padding: .2rem; border-radius: 10px; cursor: pointer; text-align: start; }
.conv-who:hover { background: var(--surface-2); }
.conv-who-txt { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
.conv-who-txt strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conv-sub { font-size: .8rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tape-txt { color: var(--accent); font-weight: 600; display: inline-flex; align-items: center; gap: .3rem; }
.tape-dots { display: inline-flex; gap: 3px; align-items: center; }
.tape-dots i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: .5; animation: tape 1.2s infinite ease-in-out; }
.tape-dots i:nth-child(2) { animation-delay: .15s; } .tape-dots i:nth-child(3) { animation-delay: .3s; }
@keyframes tape { 0%, 60%, 100% { transform: translateY(0); opacity: .45; } 30% { transform: translateY(-4px); opacity: 1; } }
.conv-rdv { display: flex; align-items: center; gap: .5rem; padding: .45rem .9rem; background: var(--accent-soft); color: var(--blue-text); font-size: .86rem; font-weight: 500; border-bottom: 1px solid var(--line); }
.conv-fil { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: .8rem clamp(.7rem, 3vw, 2rem) 1rem; display: flex; flex-direction: column; }
.conv-safe { align-self: center; max-width: 34rem; margin: .2rem auto .6rem; padding: .45rem .85rem; border-radius: var(--r-md); background: var(--surface); border: 0; box-shadow: var(--sh1); color: var(--muted); font-size: var(--fs-1); text-align: center; display: flex; gap: .35rem; align-items: center; }
.conv-start { display: flex; flex-direction: column; align-items: center; gap: .35rem; margin: auto 0; padding: 1.5rem 0; text-align: center; }
.conv-start strong { font-family: var(--f-display); font-size: 1.15rem; }
.chips.brise { justify-content: center; max-width: 30rem; }
.jour { align-self: center; margin: .9rem 0 .35rem; position: sticky; top: 0; z-index: 1; }
.jour span { display: inline-block; padding: .2rem .8rem; border-radius: var(--r-pill); background: var(--surface); border: 0; font-size: var(--fs-1); font-weight: 600; color: var(--muted); box-shadow: var(--sh1); }

.msg { display: flex; align-items: center; gap: .15rem; margin-top: .55rem; flex-wrap: wrap; }
.msg.suite { margin-top: 3px; }
.msg.mine { flex-direction: row-reverse; }
.bulle { position: relative; max-width: min(80%, 34rem); padding: .45rem .7rem .35rem; border-radius: 18px; background: var(--surface); color: var(--ink); border: 0; box-shadow: 0 0 0 1px var(--hair), 0 1px 2px rgb(19 33 58 / .06); min-width: 0; }
.msg:not(.suite):not(.mine) .bulle { border-start-start-radius: 6px; }
.msg.mine .bulle { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.msg.mine:not(.suite) .bulle { border-start-end-radius: 6px; }
.msg-txt { white-space: pre-wrap; overflow-wrap: anywhere; display: inline; }
.msg-txt a { color: inherit; text-decoration: underline; }
.msg-meta { float: inline-end; display: inline-flex; align-items: center; gap: 3px; margin-inline-start: .55rem; margin-top: .35rem; font-size: var(--fs-1); line-height: 1; color: var(--muted); position: relative; top: .2rem; }
.msg.mine .msg-meta { color: var(--accent-ink); }
.msg-etat { display: inline-flex; }
.msg.mine .msg-etat.lu { color: var(--accent-ink); }
.msg.envoi .bulle { opacity: .75; }
.msg.erreur .bulle { background: var(--bad-soft); border-color: var(--bad); color: var(--ink); }
.msg.erreur .msg-meta { color: var(--bad); }
.msg-retry { color: var(--bad); flex-basis: 100%; text-align: end; padding: .15rem .3rem; }
.msg-more { opacity: 0; transition: opacity .15s; color: var(--muted); }
.msg:hover .msg-more, .msg-more:focus-visible, .msg.sel .msg-more { opacity: 1; }
@media (hover: none) { .msg-more { opacity: .6; } }
.msg-actions { flex-basis: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: .35rem; padding: .3rem .2rem 0; }
.msg.mine .msg-actions { align-items: flex-end; }
.msg-acts-row { display: flex; flex-wrap: wrap; gap: .3rem; }
.msg.mine .msg-acts-row { justify-content: flex-end; }
.react-bar { display: flex; gap: 2px; padding: 3px; border-radius: 999px; background: var(--raised); border: 0; box-shadow: var(--sh3); animation: react-bar-in .2s var(--ease); }
@keyframes react-bar-in { from { opacity: 0; transform: translateY(6px) scale(.94); } }
.react-btn { width: 40px; height: 40px; border-radius: 50%; border: 0; background: none; font-size: 1.3rem; line-height: 1; cursor: pointer; display: grid; place-items: center; transition: transform .15s var(--ease), background .15s; }
.react-btn:hover { transform: scale(1.18); background: var(--surface-2); }
.react-btn:active { transform: scale(.9); }
.react-btn.on { background: var(--accent-soft); box-shadow: inset 0 0 0 2px var(--accent); }
.msg.a-react { margin-bottom: 18px; }
.msg.a-react .msg-actions { padding-top: 18px; }
.msg-reacts { position: absolute; bottom: -15px; inset-inline-start: 10px; display: flex; gap: 3px; z-index: 1; }
.react-pill { display: inline-flex; align-items: center; gap: 2px; height: 24px; padding: 0 6px; border-radius: 12px; background: var(--raised); border: 0; box-shadow: var(--sh2); font-size: .9rem; line-height: 1; color: var(--ink); animation: react-pop .28s var(--ease); }
button.react-pill { cursor: pointer; font-family: inherit; }
.react-pill.mien { border-color: var(--accent); background: var(--accent-soft); }
.react-n { font-size: var(--fs-1); font-weight: 600; color: var(--muted); }
@keyframes react-pop { 0% { transform: scale(.3); opacity: 0; } 70% { transform: scale(1.12); } }
.msg-cite { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; width: 100%; min-width: 0; margin: 0 0 .3rem; padding: .3rem .6rem; border: 0; border-inline-start: 3px solid var(--accent); border-radius: 10px; background: color-mix(in srgb, var(--accent) 9%, var(--surface-2)); color: var(--ink); font: inherit; font-size: .82rem; text-align: start; cursor: pointer; }
.msg-cite strong { font-size: .78rem; color: var(--blue-text); }
.msg.mine .msg-cite { background: color-mix(in srgb, var(--accent) 80%, var(--ink)); border-inline-start-color: var(--accent-ink); color: var(--accent-ink); }
.msg.mine .msg-cite strong { color: var(--accent-ink); }
.msg-cite.supprime { cursor: default; font-style: italic; opacity: .8; }
.t-photo .msg-cite { margin-bottom: 4px; }
.cite-extrait { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cite-extrait .ico { vertical-align: -2px; }
.bulle.avec-cite { min-width: min(220px, 70vw); }
@keyframes eclaire { 0%, 35% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 35%, transparent); } }
.glisse-ico { position: absolute; inset-inline-start: 0; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--surface); color: var(--blue-text); box-shadow: var(--sh2); opacity: var(--g, 0); transform: scale(calc(.5 + var(--g, 0) / 2)); pointer-events: none; }
.msg { position: relative; }
.msg .bulle { transition: transform .18s var(--ease); }
@media (hover: none) { .bulle { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: pan-y pinch-zoom; } }
.msg.neuf .bulle { animation: msg-in .32s var(--ease) backwards; }
/* Après l'arrivée (« neuf ») : l'éclat du message cité passe devant, et l'arrivée ne rejoue pas quand il s'éteint */
.msg.eclaire .bulle { animation: eclaire 1.6s ease; }
.msg.neuf.eclaire .bulle { animation: msg-in .32s var(--ease) backwards, eclaire 1.6s ease; }
.msg:focus { outline: none; }
.msg:focus-visible > .bulle { outline: 2px solid var(--accent); outline-offset: 2px; }
@keyframes msg-in { from { opacity: 0; transform: translateY(10px) scale(.96); } }
.msg.mine.neuf .bulle { transform-origin: 100% 100%; }
.tape-bulle .bulle { padding: .7rem .9rem; color: var(--muted); }

.t-photo { padding: 4px; }
.t-photo .msg-txt { display: block; padding: .35rem .4rem .1rem; }
.t-photo .msg-meta { margin-inline-end: .3rem; }
.msg-photo { display: grid; place-items: center; width: min(260px, 62vw); max-height: 340px; border: 0; padding: 0; border-radius: 14px; overflow: hidden; cursor: zoom-in; background: linear-gradient(100deg, var(--surface-2) 30%, color-mix(in srgb, var(--surface-2) 50%, var(--surface)) 50%, var(--surface-2) 70%) 0 0 / 300% 100%; animation: shimmer 1.4s linear infinite; }
.msg-photo.pret { animation: none; background: none; }
.msg-photo img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0; transition: opacity .25s; }
.msg-photo.pret img { opacity: 1; }
.photo-ko { color: var(--muted); display: flex; flex-direction: column; align-items: center; gap: .2rem; padding: 1rem; }
@keyframes shimmer { to { background-position: -300% 0; } }

.vocal { display: flex; align-items: center; gap: .55rem; min-width: min(240px, 60vw); padding: .1rem 0; }
.vocal-play { width: 38px; height: 38px; border-radius: 50%; border: 0; display: grid; place-items: center; flex: none; cursor: pointer; background: var(--accent); color: var(--accent-ink); }
.msg.mine .vocal-play { background: var(--accent-ink); color: var(--accent); }
.vocal-onde { flex: 1; display: flex; align-items: center; gap: 2px; height: 30px; cursor: pointer; }
.vocal-onde i { flex: 1; min-width: 2px; max-width: 4px; height: calc(var(--h) * 10%); border-radius: 2px; background: currentColor; opacity: .35; transition: opacity .15s; }
.vocal-onde i.on { opacity: 1; }
.vocal-t { font-size: var(--fs-1); font-variant-numeric: tabular-nums; min-width: 2.4rem; }

/* Accrochée au haut de la zone d'écriture, quelle que soit sa hauteur (message cité, texte sur plusieurs lignes) */
.conv-bas-ancre { position: relative; height: 0; flex: none; z-index: 2; }
.conv-bas { position: absolute; inset-inline-end: 1rem; bottom: .9rem; width: 40px; height: 40px; border-radius: 50%; border: 0; background: var(--raised); color: var(--ink-2); box-shadow: var(--sh3); display: grid; place-items: center; cursor: pointer; z-index: 2; }
.conv-bas .ico { transform: rotate(90deg); }

.composer { display: flex; align-items: center; gap: .5rem; padding: .55rem .65rem; padding-bottom: calc(.55rem + env(safe-area-inset-bottom, 0px)); background: var(--surface); border-top: 1px solid var(--line); }
.comp-row { flex: 1; display: flex; align-items: flex-end; gap: .4rem; }
.composer.ecrire { flex-direction: column; align-items: stretch; gap: .4rem; }
.composer.ecrire .comp-row { flex: none; }
.comp-cite { display: flex; align-items: center; gap: .5rem; padding-block: .35rem; padding-inline: .7rem .3rem; border-radius: 12px; border-inline-start: 3px solid var(--accent); background: var(--surface-2); color: var(--accent); animation: fade-in .18s ease; }
.comp-cite-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; color: var(--ink); font-size: .84rem; }
.comp-cite-txt strong { color: var(--blue-text); font-size: .78rem; }
.comp-row textarea { flex: 1; resize: none; min-height: 42px; max-height: 140px; padding: .6rem .95rem; border-radius: 21px; line-height: 1.4; background: var(--surface-2); border-color: transparent; }
.comp-row textarea:focus { border-color: var(--accent); background: var(--surface); }
.comp-photo { width: 42px; height: 42px; border-radius: 50%; flex: none; }
.sr-file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.send-btn { width: 44px; height: 44px; border-radius: 50%; border: 0; flex: none; display: grid; place-items: center; cursor: pointer; background: var(--accent); color: var(--accent-ink); transition: transform .15s var(--ease), filter .15s; }
.send-btn:hover { filter: brightness(1.08); }
.send-btn:active { transform: scale(.9); }
.send-btn:disabled { opacity: .45; cursor: default; }
.send-btn .ico-send { margin-inline-start: -2px; }
.composer.ferme { color: var(--muted); font-size: .88rem; padding: .9rem 1rem; padding-bottom: calc(.9rem + env(safe-area-inset-bottom, 0px)); }
.composer.rec .comp-row { align-items: center; gap: .6rem; }
.rec-dot { width: 11px; height: 11px; border-radius: 50%; background: var(--bad); animation: rec 1s ease-in-out infinite; flex: none; }
@keyframes rec { 50% { opacity: .3; } }
.rec-t { font-weight: 600; min-width: 2.6rem; }
.rec-niv { flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: 2px; height: 32px; overflow: hidden; color: var(--accent); }
.rec-niv i { width: 3px; flex: none; height: calc(var(--h) * 100%); border-radius: 2px; background: currentColor; }
.rec-max { flex: none; }

.visionneuse { position: fixed; inset: 0; z-index: 70; background: rgb(5 10 18 / .92); display: grid; place-items: center; padding: 1rem; animation: fade-in .2s ease; cursor: zoom-out; }
.visionneuse img { max-width: 100%; max-height: 100%; border-radius: 8px; }
.visionneuse .icon-btn { position: absolute; top: calc(.8rem + env(safe-area-inset-top, 0px)); inset-inline-end: .8rem; color: #fff; background: rgb(255 255 255 / .12); }

.msg-home .convs { padding: 0; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.chat-top.mobile-only, .menu-pop .menu-mobile { display: none; }
.chat-top.on { color: var(--accent); }
.parrain-acts { display: flex; flex-wrap: wrap; gap: .4rem; }
.mrow-head, .cand-head { flex-wrap: wrap; }
.nav-n { margin-inline-start: auto; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; background: var(--accent); color: var(--accent-ink); font: 600 var(--fs-1)/20px var(--f-body); text-align: center; font-variant-numeric: tabular-nums; }
.msg-btn .count { margin-inline-start: .2rem; }

@media (max-width: 760px) {
  .chat-top.mobile-only { display: inline-grid; }
  .menu-pop .menu-mobile { display: flex; }
  .bottom-nav.cache { display: none; }
  .chat-page { grid-template-columns: minmax(0, 1fr); }
  .chat-vide { display: none; }
  .conv-list { border: 0; padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px)); }
  .chat-page.has-conv .conv-list { display: none; }
  .chat-page.has-conv .conv { position: fixed; inset: 0 0 auto; height: var(--vvh, 100dvh); z-index: 45; }
  .conv-top { padding-top: calc(.5rem + env(safe-area-inset-top, 0px)); }
  .conv-back { display: inline-grid; }
  .bulle { max-width: 84%; }
}
@media (prefers-reduced-motion: reduce) { .tape-dots i { animation: none !important; opacity: .8; } .react-pill, .react-bar, .comp-cite { animation: none; } .msg .bulle { transition: none; } .msg.eclaire .bulle, .msg.neuf.eclaire .bulle { animation-duration: .01s; box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 35%, transparent); } }
`);

addAR({
  'Écrire': 'مراسلة', 'Message': 'الرسالة', 'Messages': 'الرسائل', 'Écrire à': 'راسل', 'Toi :': 'أنت:', 'Photo': 'صورة', 'Message vocal': 'رسالة صوتية',
  'On t’a écrit': 'وصلتك رسائل', 'Tous les messages': 'كل الرسائل', 'Conversations': 'المحادثات', 'Chercher une conversation': 'البحث عن محادثة', 'Chercher un nom': 'ابحث عن اسم',
  'Tes conversations': 'محادثاتك', 'Écris à un lauréat qui t’aide, à un étudiant qui a postulé, à ton parrain : en texte, en photo ou en message vocal.': 'راسل خريجًا يساعدك، أو طالبًا ترشّح لعرضك، أو عرّابك: كتابةً أو بصورة أو برسالة صوتية.',
  'Pas encore de message': 'لا رسائل بعد', 'Une conversation s’ouvre avec un match, un mentorat, une candidature, ton parrain ou des coordonnées partagées.': 'تُفتح المحادثة بعد اتفاق في صفحة التوافق، أو مع إرشاد أو ترشّح أو عرّابك، أو بعد مشاركة معلومات الاتصال.',
  'Voir qui a besoin d’aide': 'من يحتاج مساعدتك', 'Demander un conseil': 'اطلب نصيحة', 'Aucune conversation à ce nom.': 'لا محادثة بهذا الاسم.',
  'Une conversation n’est visible que par vous deux.': 'لا يرى المحادثة غيركما.',
  'Mentorat': 'الإرشاد', 'Candidature': 'ترشيح', 'Relecture de CV': 'مراجعة السيرة الذاتية', 'Parrainage': 'العرّاب', 'Contact accepté': 'اتصال مقبول', 'Administration': 'الإدارة', 'Conversation': 'محادثة',
  'Retour aux conversations': 'العودة إلى المحادثات', 'Options de la conversation': 'خيارات المحادثة', 'Voir le profil': 'عرض الملف', 'Bloquer': 'حظر', 'Débloquer': 'إلغاء الحظر',
  'écrit': 'يكتب', 'Rendez-vous': 'الموعد', 'Rejoindre': 'انضم', 'Messages visibles seulement par vous deux. Un souci ? Signale un message en un clic.': 'لا يرى الرسائل غيركما. مشكلة؟ بلّغ عن رسالة بنقرة.',
  'Pour briser la glace :': 'لكسر الجليد:', 'Aller aux derniers messages': 'إلى آخر الرسائل',
  'Vous ne pouvez pas vous écrire pour l’instant. Une conversation s’ouvre avec un match, un mentorat, une candidature ou des coordonnées partagées.': 'لا يمكنكما المراسلة الآن. تُفتح المحادثة بعد اتفاق في صفحة التوافق، أو مع إرشاد أو ترشّح، أو بعد مشاركة معلومات الاتصال.',
  'Tu as bloqué': 'لقد حظرت', 'Non envoyé · Réessayer': 'لم تُرسل · أعد المحاولة', 'Non envoyé': 'لم تُرسل', 'Envoi en cours': 'جارٍ الإرسال', 'Vu': 'تمت المشاهدة', 'Envoyé': 'أُرسلت',
  'Actions du message': 'خيارات الرسالة', 'Copier': 'نسخ', 'Supprimer': 'حذف', 'Agrandir la photo': 'تكبير الصورة', 'Photo indisponible': 'الصورة غير متاحة',
  'Pause': 'إيقاف مؤقت', 'Écouter le message vocal': 'استمع إلى الرسالة الصوتية', 'Lecture impossible': 'تعذّر التشغيل', 'Fermer': 'إغلاق',
  'Enregistrement d’un message vocal': 'تسجيل رسالة صوتية', 'Annuler l’enregistrement': 'إلغاء التسجيل', 'Envoyer le message vocal': 'إرسال الرسالة الصوتية',
  'Envoyer une photo': 'إرسال صورة', 'Ton message': 'رسالتك', 'Écris un message…': 'اكتب رسالة…', 'Envoyer': 'إرسال', 'Enregistrer un message vocal': 'تسجيل رسالة صوتية',
  'Message copié.': 'تم نسخ الرسالة.', 'Copie impossible sur cet appareil.': 'تعذّر النسخ على هذا الجهاز.', 'Supprimer ce message pour vous deux ?': 'حذف هذه الرسالة لديكما معًا؟',
  'C’est fait. Vous ne pouvez plus vous écrire.': 'تم. لم يعد بإمكانكما المراسلة.', 'Le blocage est levé.': 'رُفع الحظر.',
  'Autorise le micro pour envoyer un message vocal.': 'اسمح باستعمال الميكروفون لإرسال رسالة صوتية.', 'Message trop court : garde le micro au moins une seconde.': 'رسالة قصيرة جدًا: سجّل ثانية على الأقل.',
  'Choisis une photo.': 'اختر صورة.', 'Format de photo non reconnu. Essaie en JPEG ou PNG.': 'صيغة الصورة غير معروفة. جرّب JPEG أو PNG.', 'Photo impossible à envoyer.': 'تعذّر إرسال الصورة.',
  'Bonjour, merci d’avoir accepté !': 'مرحبًا، شكرًا على قبول طلبي!', 'Je peux vous envoyer mon CV ici ?': 'هل أرسل لك سيرتي الذاتية هنا؟', 'Quelles questions préparer pour notre appel ?': 'ما الأسئلة التي أحضّرها لمكالمتنا؟',
  'Bonjour ! Dis-moi comment je peux t’aider.': 'مرحبًا! قل لي كيف أساعدك.', 'Envoie-moi ton CV ici avant notre appel.': 'أرسل لي سيرتك الذاتية هنا قبل مكالمتنا.', 'Bravo pour ta démarche, on en parle quand tu veux.': 'أحسنت على هذه الخطوة، نتحدث متى شئت.',
  'Bonjour ! Bienvenue sur le réseau.': 'مرحبًا! أهلًا بك في الشبكة.', 'Merci pour ta participation.': 'شكرًا على مشاركتك.', 'Une question sur la plateforme ? Réponds ici.': 'سؤال عن المنصة؟ أجب هنا.',
  'Les photos et vocaux arrivent bientôt : la base est en cours de mise à jour.': 'الصور والرسائل الصوتية قريبًا: قاعدة البيانات قيد التحديث.', 'Fichier trop lourd (5 Mo au plus).': 'الملف ثقيل جدًا (5 ميغابايت كحد أقصى).',
  'Ce format n’est pas accepté : une photo ou un message vocal.': 'هذه الصيغة غير مقبولة: صورة أو رسالة صوتية فقط.', 'Conversation pas encore ouverte.': 'المحادثة غير مفتوحة بعد.',
  'Envoi du fichier impossible. Vérifie ta connexion et réessaie.': 'تعذّر إرسال الملف. تحقق من اتصالك وأعد المحاولة.', 'Fichier manquant.': 'الملف مفقود.', 'Écris ton message.': 'اكتب رسالتك.',
  'Ton message est trop long (2 000 caractères au plus).': 'رسالتك طويلة جدًا (2000 حرف كحد أقصى).',
  'Conversation pas encore ouverte : elle s’ouvre avec un mentorat, une candidature ou des coordonnées partagées.': 'المحادثة غير مفتوحة بعد: تُفتح بإرشاد أو ترشّح أو بعد مشاركة معلومات الاتصال.',
  // Ancien message de la base (protect_message), tant que la mise à jour SQL n'a pas tourné : à retirer après migration
  'Conversation pas encore ouverte : elle s’ouvre avec un mentorat, une candidature ou une demande de contact acceptée.': 'المحادثة غير مفتوحة بعد: تُفتح بإرشاد أو ترشّح أو بعد مشاركة معلومات الاتصال.',
  '1 message non lu': 'رسالة واحدة غير مقروءة', 'Lui écrire': 'مراسلة', 'Voir la photo': 'عرض الصورة',
  'Toi': 'أنت', 'Message supprimé': 'رسالة محذوفة', 'Annuler la réponse': 'إلغاء الرد', 'Tu réponds à ce message': 'أنت ترد على هذه الرسالة',
  'Réagir à ce message': 'التفاعل مع هذه الرسالة', 'Équipe du réseau': 'فريق الشبكة', 'Réaction inconnue.': 'تفاعل غير معروف.',
  'Tu as déjà réagi à ce message.': 'لقد تفاعلت مع هذه الرسالة من قبل.', 'Vous ne pouvez plus vous écrire.': 'لم يعد بإمكانكما المراسلة.',
  // Match : bandeau, entretien proposé (feuille et carte), CV envoyé ; refus de la base (protect_message, repondre_rdv)
  'Entretien proposé': 'مقابلة مقترحة', 'Tu proposes un entretien': 'تقترح مقابلة', 'Retenu': 'مقبول', 'Retirer le match': 'إلغاء التوافق', 'Le match est retiré.': 'تم إلغاء التوافق.',
  'Candidature pas retenue cette fois. La discussion reste ouverte.': 'لم يُقبل الترشيح هذه المرة. تبقى المحادثة مفتوحة.',
  'Programmer un entretien': 'برمجة مقابلة', 'Envoyer mon CV': 'أرسل سيرتي الذاتية', 'Dépose d’abord ton CV dans Mon profil.': 'ضع سيرتك الذاتية أولًا في ملفك.', 'CV envoyé.': 'تم إرسال السيرة الذاتية.',
  'Lisible après un match': 'تُقرأ بعد التوافق', 'Où': 'المكان', 'Autre date': 'تاريخ آخر', 'Autre heure': 'ساعة أخرى', '15 min · appel': '15 دقيقة · مكالمة', '1 h': 'ساعة',
  'En visio': 'عن بعد بالفيديو', 'Lien Meet ou Teams (facultatif)': 'رابط Meet أو Teams (اختياري)', 'Sans lien, une visio Jitsi est créée pour vous deux.': 'بدون رابط، يُنشأ لكما اتصال مرئي على Jitsi.',
  'Ex. : usine de Meknès, accueil principal': 'مثال: مصنع مكناس، الاستقبال الرئيسي', 'Un mot (facultatif)': 'كلمة (اختياري)', 'Ex. : prépare un exemple de projet.': 'مثال: حضّر مثالًا عن مشروع.',
  'Proposer l’entretien': 'اقترح المقابلة',
  'Le lien de la visio doit commencer par https://': 'يجب أن يبدأ رابط الاتصال المرئي بـ https://', 'Indique le lieu de l’entretien.': 'حدّد مكان المقابلة.',
  'Appel de 15 min': 'مكالمة 15 دقيقة', 'Entretien passé': 'انتهت المقابلة', 'Tu as dit que tu serais là.': 'قلت إنك ستحضر.', 'Tu as demandé un autre horaire.': 'طلبت موعدًا آخر.',
  'Autre horaire': 'موعد آخر', 'Ajouter à l’agenda': 'أضف إلى الأجندة', 'Propose un autre horaire qui te convient.': 'اقترح موعدًا آخر يناسبك.',
  'Choix invalide.': 'اختيار غير صالح.', 'Réponse invalide.': 'رد غير صالح.', 'Cet entretien est déjà passé.': 'هذه المقابلة انتهت.', 'Choisis la durée de l’entretien.': 'اختر مدة المقابلة.',
  'La durée va de 15 à 120 minutes.': 'المدة من 15 إلى 120 دقيقة.', 'Le lieu est trop long (200 caractères au plus).': 'المكان طويل جدًا (200 حرف كحد أقصى).',
  'La note est trop longue (500 caractères au plus).': 'الملاحظة طويلة جدًا (500 حرف كحد أقصى).', 'Choisis une date à venir, dans les 4 prochains mois.': 'اختر تاريخًا قادمًا خلال الأشهر الأربعة المقبلة.',
}, [
  [/^(\d+) messages non lus$/, n => `${n} رسائل غير مقروءة`],
  [/^Conversation avec (.+)$/, x => `محادثة مع ${x}`],
  [/^Messages \((\d+) non lus\)$/, n => `الرسائل (${n} غير مقروءة)`],
  [/^(.+) t’a envoyé une photo\.$/, x => `صورة من ${x}.`],
  [/^(.+) t’a envoyé un message vocal\.$/, x => `رسالة صوتية من ${x}.`],
  [/^Bloquer (.+) \? Vous ne pourrez plus vous écrire\. Tu peux débloquer à tout moment\.$/, x => `حظر ${x}؟ لن يعود بإمكانكما المراسلة. يمكنك إلغاء الحظر في أي وقت.`],
  [/^(\d+):(\d\d) max$/, (m, s) => `${m}:${s} كحد أقصى`],
  [/^Réagir avec (.+)$/, x => `التفاعل بـ ${x}`],
  [/^Retirer ma réaction (\S+) \((.+) aussi\)$/, (e, x) => `إزالة تفاعلي ${e} (${x} أيضًا)`],
  [/^Toi et (.+) : (\S+)$/, (x, e) => `أنت و${x}: ${e}`],
  [/^Retirer ma réaction (.+)$/, x => `إزالة تفاعلي ${x}`],
  [/^Ta réaction (.+)$/, x => `تفاعلك ${x}`],
  [/^Réaction de (.+) : (.+)$/, (x, y) => `تفاعل ${x}: ${y}`],
  [/^Retirer le match avec (.+) \? La carte ne reviendra pas dans Match\.$/, x => `إلغاء التوافق مع ${x}؟ لن تعود البطاقة في صفحة التوافق.`],
  [/^Entretien avec (.+)$/, x => `مقابلة مع ${x}`],
  [/^Entretien proposé à (.+)\.$/, x => `اقترحت المقابلة على ${x}.`],
  [/^C’est noté : (.+) sait que tu seras là\.$/, x => `تم: وصل ردّك إلى ${x}.`],
  [/^(.+) sera là$/, x => `حضور ${x} مؤكد`],
  [/^(.+) propose un autre horaire$/, x => `اقتراح موعد آخر من ${x}`],
  [/^En attente de la réponse de (.+)$/, x => `في انتظار رد ${x}`],
  [/^CV de (.+)$/, x => `السيرة الذاتية لـ${x}`],
  [/^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) (\d{1,2})$/i, (j, d) => `${JOURS_AR[j.toLowerCase()]} ${d}`],
  [/^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) (\d{1,2}) (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)$/i, (j, d, m) => `${JOURS_AR[j.toLowerCase()]} ${d} ${MOIS_AR[m]}`],
]);
const JOURS_AR = { lundi: 'الإثنين', mardi: 'الثلاثاء', mercredi: 'الأربعاء', jeudi: 'الخميس', vendredi: 'الجمعة', samedi: 'السبت', dimanche: 'الأحد' };
const MOIS_AR = { janvier: 'يناير', février: 'فبراير', mars: 'مارس', avril: 'أبريل', mai: 'ماي', juin: 'يونيو', juillet: 'يوليوز', août: 'غشت', septembre: 'شتنبر', octobre: 'أكتوبر', novembre: 'نونبر', décembre: 'دجنبر' };
