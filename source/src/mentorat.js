// Mentorat en 3 étapes, sur une seule page : l'étudiant dit ce dont il a besoin et propose ses horaires,
// un lauréat clique sur un horaire, la visio et l'invitation d'agenda sont prêtes. Après l'échange : un merci.
// Ce qui compte d'abord : le prochain rendez-vous en haut, le mode d'emploi seulement pour qui découvre.
import { html, useState, useEffect, useLayoutEffect, useRef } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Avatar, toast, celebrate, useLocal, injectCSS, roleTexte } from './ui.js';
import { useBrouillon, EnTetePage, Rangee, Coche, vibrer, mouvementReduit } from './ui.js';
import { PucesNav } from './lignes.js';
import { proposerPrevenir } from './pwa.js';
import { BESOINS, RDV_MIN, mentorState, futureSlots, requestsFor, mentorsFor, timeAgo, helpMatch, niveauOf, coupDeMain, alerteTalents, mercisPublics, dernierMerciPour, nouvelleDemandeApres, joursAvant } from './logic.js';
import { getLang, addAR, arCount, t as tr } from './i18n.js';
import { RelecturesPage, DemandeRelecture } from './cv.js';
import { MessageBtn } from './messages.js';
import { MerciDuo } from './growth.js';

const firstName = p => (p?.full_name || '').split(' ')[0];
// Demandes ouvertes à tous qu'un lauréat a écartées sur cet appareil : elles ne reviennent plus dans ses listes
const CLE_IGNOREES = 'ensam-mentorat-ignorees';
export function mentoratIgnorees() { try { return new Set(JSON.parse(localStorage.getItem(CLE_IGNOREES) || '[]')); } catch { return new Set(); } }
const pad = n => String(n).padStart(2, '0');
const isHttps = u => /^https:\/\/\S+$/i.test(u || '');
// Le lien de visio d'un rendez-vous, s'il est sûr
export const lienVisio = (store, id) => { const l = (store.data.liens_rdv || []).find(x => x.id === id)?.lien; return isHttps(l) ? l : null; };
// L'étudiant confirme sa présence : le lauréat est prévenu
export const confirmerPresence = (ctx, m) => ctx.act(async () => { await ctx.store.update('mentorships', m.id, { confirme_at: new Date().toISOString() }); toast(`C’est confirmé. On prévient ${firstName(ctx.store.byId('profiles', m.mentor_id))}.`, 'win'); });
// Le lauréat choisi n'est pas disponible : les horaires de l'étudiant partent aux autres lauréats
export function passerDemande(ctx, m, apres) {
  const { store, act } = ctx;
  ctx.confirm('Tu n’es pas disponible ? Ses horaires seront proposés aux autres lauréats.', () => act(async () => { await store.update('mentorships', m.id, { mentor_id: null }); toast('Horaires proposés aux autres lauréats.'); apres?.(); }), 'Proposer aux autres');
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function slotWhen(iso, now = new Date()) {
  const d = new Date(iso);
  const day0 = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day0(d) - day0(now)) / 864e5);
  return { diff, day: diff === 0 ? 'Aujourd’hui' : diff === 1 ? 'Demain' : diff === -1 ? 'Hier' : JOURS[d.getDay()], date: `${d.getDate()} ${MOIS[d.getMonth()]}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

export function SlotDate({ iso }) {
  const w = slotWhen(iso);
  return html`<span class=${'slot-date' + (w.diff === 0 ? ' today' : '')}><span class="sd-day">${w.day}</span><span class="sd-date">${w.date}</span><span class="sd-time mono">${w.time}</span></span>`;
}

// « Demain · 18:30 », « vendredi · 12:30 » (cette semaine, le jour suffit), « mardi 3 novembre · 12:30 »
function When({ iso }) {
  const w = slotWhen(iso);
  return html`<span class="when"><span>${w.day}</span>${w.diff > 6 || w.diff < -6 ? html` <span>${w.date}</span>` : null}<span class="mono"> · ${w.time}</span></span>`;
}

// Dans une phrase : « demain à 18:30 », « vendredi 23 octobre à 12:30 »
function quand(iso) {
  const w = slotWhen(iso);
  return `${w.diff === 0 ? 'aujourd’hui' : w.diff === 1 ? 'demain' : `${w.day} ${w.date}`} à ${w.time}`;
}

const enDirect = (iso, now = Date.now()) => { const t = new Date(iso).getTime(); return now > t - 15 * 6e4 && now < t + 60 * 6e4; };

const toInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
// Horaires proposés par défaut : les trois prochains jours (sauf dimanche), en fin de journée ou à midi
function defaultSlots(now = new Date()) {
  const out = []; const d = new Date(now);
  while (out.length < 3) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) continue;
    const x = new Date(d); x.setHours(out.length === 1 ? 12 : 18, 30, 0, 0); out.push(toInput(x));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Agenda : Google Agenda (avec l'étudiant en invité côté lauréat) et fichier .ics
// ---------------------------------------------------------------------------
const icsDate = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function rdvTexts(m, store, lien) {
  const st = store.byId('profiles', m.student_id); const la = store.byId('profiles', m.mentor_id);
  const ar = getLang() === 'ar';
  const title = ar ? `إرشاد · شبكة ENSAM مكناس : ${m.sujet}` : `Mentorat Réseau ENSAM : ${m.sujet}`;
  const details = ar
    ? `موعد مدته ${RDV_MIN} دقيقة بين ${la?.full_name || ''} (خريج) و${st?.full_name || ''}.${lien ? `\nالاتصال المرئي : ${lien}` : ''}\nشبكة ENSAM مكناس`
    : `Rendez-vous de ${RDV_MIN} min entre ${la?.full_name || ''} (lauréat) et ${st?.full_name || ''}.${lien ? `\nVisio : ${lien}` : ''}\nRéseau ENSAM Meknès`;
  return { m, title, details, lien };
}

// Aussi pour un entretien proposé dans la discussion (messages.js) : sa durée (m.rdv_duree) et son lieu (lieu) s'il n'est pas en visio
export function gcalUrl({ m, title, details, lien, lieu }, guest) {
  const start = new Date(m.rdv_at); const end = new Date(start.getTime() + (m.rdv_duree || RDV_MIN) * 6e4);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${icsDate(start)}/${icsDate(end)}`, details, location: lien || lieu || '' });
  if (guest) q.set('add', guest);
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}

export function icsHref({ m, title, details, lien, lieu }) {
  const esc = t => String(t).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, x => '\\' + x);
  const start = new Date(m.rdv_at); const end = new Date(start.getTime() + (m.rdv_duree || RDV_MIN) * 6e4);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Reseau ENSAM Meknes//Mentorat//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${m.id}@reseau-ensam`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(details)}`, lien || lieu ? `LOCATION:${esc(lien || lieu)}` : null, lien ? `URL:${lien}` : null,
    'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean);
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'));
}

// ---------------------------------------------------------------------------
// Petits éléments
// ---------------------------------------------------------------------------
// Deux pictos propres à cette page (même tracé que ceux de ui.js)
const PICTOS = { info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.01"/>', chev: '<path d="M6 9.5l6 6 6-6"/>' };
function Picto({ name, size = 16 }) {
  return html`<svg class=${'ico ico-' + name} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: PICTOS[name] }}></svg>`;
}

// Menu « ⋯ » : les actions rares (déplacer, annuler) restent à portée sans être toujours sous les yeux
function MoreMenu({ items, label = 'Plus d’options' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const away = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const key = e => { if (e.key === 'Escape') { setOpen(false); ref.current?.querySelector('.m-more-btn')?.focus(); } };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', key);
    ref.current?.querySelector('[role="menuitem"]')?.focus();
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key); };
  }, [open]);
  if (!items.length) return null;
  return html`<span class="menu-wrap m-more" ref=${ref}>
    <button type="button" class="icon-btn m-more-btn" aria-label=${label} aria-haspopup="menu" aria-expanded=${open} onClick=${() => setOpen(!open)}><${Icon} name="more" size=${18}/></button>
    ${open ? html`<div class="menu-pop m-more-pop" role="menu">${items.map(it => html`<button type="button" role="menuitem" class=${it.danger ? 'm-danger' : ''} onClick=${() => { setOpen(false); it.onClick(); }}><${Icon} name=${it.icon} size=${16}/> ${it.label}</button>`)}</div>` : null}
  </span>`;
}

const STEPS = ['Horaires proposés', 'Rendez-vous fixé', 'Terminé'];
function MStepper({ m }) {
  const st = mentorState(m);
  const done = st === 'terminee' ? 3 : ['rdv', 'apres'].includes(st) ? 2 : 1;
  return html`<ol class="stepper mstep">${STEPS.map((s, i) => html`<li class=${i < done ? 'done' : ''}><span class="step-dot">${i < done ? html`<${Icon} name="check" size=${13}/>` : i + 1}</span>${s}</li>`)}</ol>`;
}

const PILL = { ouverte: ['m-demande', 'Ouverte à tous les lauréats'], demande: ['m-demande', 'En attente d’un horaire'], rdv: ['m-acceptee', 'Rendez-vous fixé'], apres: ['m-acceptee', 'Rendez-vous passé'], terminee: ['m-terminee', 'Terminé'], annulee: ['m-refusee', 'Annulé'], refusee: ['m-refusee', 'Déclinée'] };

function BesoinTag({ k }) {
  const b = BESOINS[k];
  return b ? html`<span class="mini besoin"><${Icon} name=${b.icon} size=${12}/> ${b.label}</span>` : null;
}

export function HowItWorks({ role }) {
  const steps = role === 'laureat'
    ? [['people', 'Un étudiant demande de l’aide'], ['clock', 'Tu cliques sur un horaire qui t’arrange'], ['video', 'La visio et l’invitation sont prêtes']]
    : [['spark', 'Tu dis ce dont tu as besoin'], ['clock', 'Un lauréat choisit un de tes horaires'], ['video', `Vous vous parlez ${RDV_MIN} min en visio`]];
  return html`<ol class="how">${steps.map(([ic, t], i) => html`<li><span class="how-n">${i + 1}</span><${Icon} name=${ic} size=${18}/><span>${t}</span></li>`)}</ol>`;
}

// ---------------------------------------------------------------------------
// Demander de l'aide : besoin, une phrase, 2 ou 3 horaires, et à qui
// ---------------------------------------------------------------------------
const EXEMPLES = {
  cv: 'Ex. Relire mon CV pour un PFE en méthodes',
  stage: 'Ex. Trouver un PFE en énergie à Casablanca',
  entretien: 'Ex. Préparer mon entretien chez Renault',
  etranger: 'Ex. Les étapes pour un stage en France',
  carriere: 'Ex. Choisir entre qualité et méthodes',
};

export function AskHelp({ ctx, mentor = null, besoin: b0 = '', sujet: s0 = '', onClose }) {
  const { store, me, act, go, scores, data } = ctx;
  // La demande en cours d'écriture reste sur l'appareil (session expirée, rechargement), pour ce lauréat ou pour tous
  const cle = me.id + ':aide-mentorat:' + (mentor?.id || 'tous');
  const [besoin, setBesoin, oublierBesoin] = useBrouillon(b0 ? null : cle + ':besoin', b0 || '');
  const [sujet, setSujet, oublierSujet] = useBrouillon(s0 ? null : cle + ':sujet', s0 || '');
  const [msg, setMsg, oublierMsg] = useBrouillon(cle + ':message', '');
  const [slots, setSlots] = useState(() => [...defaultSlots().slice(0, 2), '']);
  const [to, setTo] = useState(mentor?.id || '');
  const reco = mentor ? [] : mentorsFor(data, me, besoin, scores).slice(0, 3);
  const valid = slots.filter(x => x && new Date(x) > new Date());
  const ok = besoin && sujet.trim().length >= 3 && valid.length > 0;
  const target = to ? store.byId('profiles', to) : null;
  const submit = e => {
    e.preventDefault(); if (!ok) return;
    act(async () => {
      await store.insert('mentorships', { student_id: me.id, mentor_id: to || null, besoin, sujet: sujet.trim(), message: msg.trim() || null, creneaux: valid.map(x => new Date(x).toISOString()) });
      oublierBesoin(); oublierSujet(); oublierMsg();
      onClose(); go('mentorat');
      if (!proposerPrevenir('mentorat', to ? `Horaires envoyés à ${firstName(target)}.` : 'Horaires envoyés aux lauréats.'))
        toast(to ? `Horaires envoyés à ${firstName(target)}. On te prévient dès qu’un horaire est choisi.` : 'Horaires envoyés aux lauréats. On te prévient dès qu’un horaire est choisi.', 'envoi');
    });
  };
  return html`<${Modal} title=${mentor ? `Demander à ${mentor.full_name}` : 'Demander de l’aide'} onClose=${onClose}>
    <form class="form ask" novalidate onSubmit=${submit}>
      ${mentor?.mentor_sujets ? html`<p class="muted small">Peut t’aider sur : <span translate="no" dir="auto">${mentor.mentor_sujets}</span></p>` : null}
      <fieldset class="need-pick"><legend class="field-label">1. De quoi as-tu besoin ?</legend>
        <div class="chips">${Object.entries(BESOINS).map(([k, v]) => html`<button type="button" class=${'chip' + (besoin === k ? ' on' : '')} aria-pressed=${besoin === k} onClick=${() => setBesoin(k)}><${Icon} name=${v.icon} size=${15}/> ${v.label}</button>`)}</div></fieldset>
      <${Field} label="2. En une phrase"><input id="ah-sujet" maxlength="140" value=${sujet} onInput=${e => setSujet(e.target.value)} placeholder=${EXEMPLES[besoin] || 'Ex. Relire mon CV pour un PFE en méthodes'}/><//>
      <fieldset class="slot-pick"><legend class="field-label">3. Quand es-tu disponible ?</legend>
        <p class="field-hint">Propose 2 ou 3 moments. Le lauréat en choisit un, l’appel dure ${RDV_MIN} minutes.</p>
        <div class="slot-inputs">${slots.map((v, i) => html`<input type="datetime-local" id=${'ah-slot-' + i} aria-label=${`Horaire ${i + 1}`} step="900" value=${v} onInput=${e => setSlots(slots.map((x, j) => (j === i ? e.target.value : x)))}/>`)}</div></fieldset>
      ${!mentor ? html`<fieldset class="pick-list"><legend class="field-label">4. À qui ?</legend>
        <label class=${'pick' + (!to ? ' on' : '')}><input type="radio" name="ah-to" checked=${!to} onChange=${() => setTo('')}/><span><strong>Tous les lauréats qui peuvent aider</strong><span class="small muted">Le plus rapide : le premier disponible choisit un horaire.</span></span></label>
        ${reco.map(({ p, why }) => html`<label class=${'pick' + (to === p.id ? ' on' : '')} key=${p.id}><input type="radio" name="ah-to" checked=${to === p.id} onChange=${() => setTo(p.id)}/>
          <${Avatar} p=${p} size=${30}/><span><strong translate="no">${p.full_name}</strong><span class="small muted" translate="no" dir="auto">${[p.poste, p.entreprise].filter(Boolean).join(' · ')}</span>${why.length ? html`<span class="why">${why.map(w => html`<span class="mini good">${w}</span>`)}</span>` : null}</span></label>`)}
      </fieldset>` : null}
      <${Field} label="Plus de détails (facultatif)"><textarea id="ah-msg" rows="2" maxlength="1500" value=${msg} onInput=${e => setMsg(e.target.value)} placeholder="Lien vers ton CV, entreprise visée…"></textarea><//>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" disabled=${!ok}><${Icon} name="send" size=${16}/> Envoyer ces horaires</button></div>
    </form>
  <//>`;
}

// ---------------------------------------------------------------------------
// Côté lauréat : choisir un horaire (ou un autre moment), avec son propre lien s'il le souhaite
// ---------------------------------------------------------------------------
// fin : un geste de plus au bout de la ligne du titre (« Ignorer », « Pas disponible cette fois »), sur la page Mentorat
function TimeChoice({ ctx, m, compact }) {
  const { store, me, act } = ctx;
  const slots = futureSlots(m);
  const [pick, setPick] = useState(null);
  const [autre, setAutre] = useState(() => defaultSlots()[0]);
  const [lien, setLien] = useState('');
  const [msg, setMsg] = useState('');
  const confirm = () => act(async () => {
    const at = pick === 'autre' ? new Date(autre) : new Date(pick);
    if (!(at > new Date())) throw new Error('Choisis un moment à venir.');
    if (lien.trim() && !isHttps(lien.trim())) throw new Error('Le lien doit commencer par https://');
    const premier = !m.rdv_at;
    await store.update('mentorships', m.id, { mentor_id: me.id, status: 'acceptee', rdv_at: at.toISOString(), reponse: msg.trim() || m.reponse || null });
    if (lien.trim()) await store.update('liens_rdv', m.id, { lien: lien.trim() });
    if (!premier) { toast('Rendez-vous déplacé. On prévient l’étudiant.', 'win'); return; }
    // Premier rendez-vous fixé avec cet étudiant : un vrai moment, une seule fois
    const s = store.byId('profiles', m.student_id); const prenom = firstName(s);
    const fete = prenom && celebrate({
      cle: 'rdv-fixe-' + m.id, icon: 'calendar', titre: 'Rendez-vous fixé !', pts: 10,
      texte: `${prenom} reçoit l’invitation pour ${quand(at.toISOString())}. Merci de lui ouvrir ta porte !`,
      action: store.peutDiscuter?.(m.student_id) ? { label: `Écrire à ${prenom}`, icon: 'chat', onClick: () => ctx.ecrire(m.student_id) } : null,
    });
    if (!fete) toast('Rendez-vous fixé ! On prévient l’étudiant.', 'win', 10);
  });
  return html`<div class="tchoice">
    <p class="small"><strong>${m.rdv_at ? 'Nouvel horaire :' : slots.length ? 'Choisis un horaire qui t’arrange :' : 'Propose un moment :'}</strong></p>
    <div class="chips">${slots.map(c => html`<button type="button" class=${'chip time' + (pick === c ? ' on' : '')} aria-pressed=${pick === c} onClick=${() => setPick(c)}><${Icon} name="clock" size=${14}/> <${When} iso=${c}/></button>`)}
      <button type="button" class=${'chip' + (pick === 'autre' ? ' on' : '')} aria-pressed=${pick === 'autre'} onClick=${() => setPick('autre')}>${slots.length ? 'Autre moment' : 'Choisir le moment'}</button></div>
    ${pick === 'autre' ? html`<input type="datetime-local" id=${'tc-autre-' + m.id} aria-label="Autre moment" step="900" value=${autre} onInput=${e => setAutre(e.target.value)}/>` : null}
    ${pick ? html`<div class="tconfirm">
      <p class="small muted"><${Icon} name="video" size=${14}/> ${compact ? 'Une salle de visio est créée automatiquement.' : 'Une salle de visio est créée automatiquement. Tu peux mettre ton lien Google Meet ou Teams à la place.'}</p>
      ${!compact ? html`<div class="grid2"><input id=${'tc-lien-' + m.id} value=${lien} onInput=${e => setLien(e.target.value)} placeholder="Ton lien Meet ou Teams (facultatif)" dir="ltr"/>
        <input id=${'tc-msg-' + m.id} maxlength="300" value=${msg} onInput=${e => setMsg(e.target.value)} placeholder="Un mot pour l’étudiant (facultatif)"/></div>` : null}
      <div class="row-end"><button type="button" class="btn primary" onClick=${confirm}><${Icon} name="check" size=${16}/> Confirmer le rendez-vous</button></div>
    </div>` : null}
  </div>`;
}

// ---------------------------------------------------------------------------
// Le rendez-vous, comme un billet : le talon (jour, date, heure), qui, quoi et un compte à rebours vrai.
// Dessous, une seule action pleine à la fois : confirmer sa présence, puis « Rejoindre la visio » quand c'est l'heure.
// L'agenda s'ouvre dans une feuille ; le reste (déplacer, annuler) attend dans « ⋯ ».
// ---------------------------------------------------------------------------
const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// L'heure qui passe : un nouveau rendu toutes les 30 s tant que le billet est à l'écran (le texte change, rien ne bouge)
function useMaintenant(pas = 3e4) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const h = setInterval(() => setNow(Date.now()), pas); return () => clearInterval(h); }, [pas]);
  return now;
}

// Le compte à rebours, vrai et calme : « Dans 3 jours », « Demain », « Dans 20 h », « Dans 2 h 05 », « Dans 12 min », « En ce moment ».
// live : du quart d'heure avant jusqu'à l'heure après le début (la visio devient alors l'action pleine)
function rebours(iso, now = Date.now()) {
  const t = new Date(iso).getTime(), min = Math.ceil((t - now) / 6e4);
  if (now >= t) return { live: now < t + 60 * 6e4, txt: 'En ce moment' };
  if (min <= 15) return { live: true, txt: `Dans ${min} min` };
  if (min < 60) return { live: false, txt: `Dans ${min} min` };
  const h = Math.floor(min / 60), j = joursAvant(iso, new Date(now));
  if (h < 24) return { live: false, txt: h < 6 && min % 60 ? `Dans ${h} h ${pad(min % 60)}` : `Dans ${h} h` };
  if (j <= 1) return { live: false, txt: 'Demain' };
  return { live: false, txt: `Dans ${j} jours` };
}

// Le talon du billet : le jour, la date en grand, le mois, l'heure ; dessous, « Agenda » (le talon qu'on garde pour soi)
function Talon({ iso, onAgenda }) {
  const d = new Date(iso);
  return html`<div class="billet-talon"><time class="bt-date" datetime=${iso}><span class="bt-jour">${JOURS_COURTS[d.getDay()]}</span><span class="bt-num">${d.getDate()}</span><span class="bt-mois">${MOIS_COURTS[d.getMonth()]}</span><span class="bt-heure mono">${pad(d.getHours())}:${pad(d.getMinutes())}</span></time>
    <button type="button" class="bt-agenda" aria-haspopup="dialog" aria-label="Ajouter à mon agenda" title="Ajouter à mon agenda" onClick=${onAgenda}><${Icon} name="calendar" size=${16}/><span>Agenda</span></button></div>`;
}

// Un texte long replié sur quelques lignes ; « Lire la suite » seulement s'il dépasse vraiment (mesuré, pas deviné)
function Repliable({ lignes = 2, cls = '', children }) {
  const ref = useRef();
  const [ouvert, setOuvert] = useState(false);
  const [deborde, setDeborde] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || ouvert) return;
    const mesurer = () => setDeborde(el.scrollHeight > el.clientHeight + 2);
    mesurer();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(mesurer); ro.observe(el);
    return () => ro.disconnect();
  }, [ouvert]);
  return html`<p class=${'m-repli' + (cls ? ' ' + cls : '') + (ouvert ? ' ouvert' : '')} style=${`--lignes:${lignes}`} ref=${ref} translate="no" dir="auto">${children}</p>${deborde || ouvert
    ? html`<button type="button" class="linkish small m-repli-btn" aria-expanded=${ouvert} onClick=${() => setOuvert(!ouvert)}>${ouvert ? 'Réduire' : 'Lire la suite'}</button>` : null}`;
}

// Ajouter à son agenda : une feuille, deux choix (Google Agenda, avec l'étudiant en invité côté lauréat ; ou un fichier .ics)
function FeuilleAgendaRdv({ txt, side, guest, other, onClose }) {
  const invite = side === 'mentor' && !!guest;
  return html`<${Modal} title="Ajouter à mon agenda" onClose=${onClose} cls="m-agenda">
    <p class="m-agenda-quoi"><strong translate="no" dir="auto">${txt.m.sujet}</strong><span class="small muted"><${When} iso=${txt.m.rdv_at}/><span aria-hidden="true"> · </span><span>${`${RDV_MIN} min en visio`}</span></span></p>
    <div class="m-agenda-choix">
      <a class="btn" href=${gcalUrl(txt, invite ? guest : null)} target="_blank" rel="noopener" onClick=${onClose}><${Icon} name="calendar" size=${16}/> ${invite ? 'Inviter via Google Agenda' : 'Ajouter à Google Agenda'}</a>
      <a class="btn" href=${icsHref(txt)} download="rendez-vous-ensam.ics" onClick=${onClose}><${Icon} name="download" size=${16}/> Autre agenda (.ics)</a>
    </div>
    ${invite ? html`<p class="small muted">${`Google Agenda ajoute ${firstName(other)} à l’événement : enregistre-le puis choisis « Envoyer » pour lui envoyer l’invitation par email.`}</p>` : null}
  <//>`;
}

// L'action pleine d'un billet, s'il en a une : « Je serai là » avant l'heure, tant que l'étudiant n'a pas confirmé ;
// « Rejoindre la visio » à l'heure, s'il y a un lien. Sinon aucune : la page donne la sienne à la carte suivante (le merci d'un rendez-vous passé)
function pleinDuBillet(m, side, lien, now) {
  const r = rebours(m.rdv_at, now);
  if (side === 'student' && 'confirme_at' in m && !m.confirme_at && !r.live && now < new Date(m.rdv_at).getTime()) return 'confirmer';
  return lien && r.live ? 'visio' : null;
}

// now : l'heure de la page quand elle la donne (la page et le billet changent d'action pleine au même moment)
function Billet({ ctx, m, side, focus, onFini, calme = false, now: nowPage = null }) {
  const { store, act, openProfile } = ctx;
  const tic = useMaintenant();
  const now = nowPage ?? tic;
  const other = store.byId('profiles', side === 'mentor' ? m.student_id : m.mentor_id);
  const lien = lienVisio(store, m.id);
  const [guest, setGuest] = useState(null);
  const [edit, setEdit] = useState(false);
  const [agenda, setAgenda] = useState(false);
  const [newLien, setNewLien] = useState('');
  // L'astuce Jitsi s'affiche d'elle-même une seule fois (sur le prochain rendez-vous), puis derrière le petit « i »
  const jitsi = side === 'mentor' && !!lien && lien.includes('meet.jit.si');
  const [astuceVue, setAstuceVue] = useLocal('ensam-astuce-jitsi', false);
  const [astuce, setAstuce] = useState(() => !!focus && !astuceVue);
  // La coche de la présence : posée si c'était déjà confirmé en arrivant, elle se dessine quand on vient de confirmer
  const dejaConfirme = useRef(!!m.confirme_at);
  useEffect(() => { let on = true; if (side === 'mentor') Promise.resolve(store.emailRdv?.(m.id)).then(g => on && setGuest(g || null), () => {}); return () => { on = false; }; }, [m.id, m.status, side]);
  useEffect(() => { if (astuce && jitsi && !astuceVue) setAstuceVue(true); }, [astuce, jitsi]);
  const r = rebours(m.rdv_at, now);
  const commence = now >= new Date(m.rdv_at).getTime();
  const confirmable = 'confirme_at' in m;
  // Confirmer tant que ce n'est pas l'heure ; à l'heure, rejoindre passe devant
  const aConfirmer = pleinDuBillet(m, side, lien, now) === 'confirmer';
  const txt = rdvTexts(m, store, lien);
  const saveLien = () => act(async () => {
    if (!isHttps(newLien.trim())) throw new Error('Le lien doit commencer par https://');
    await store.update('liens_rdv', m.id, { lien: newLien.trim() }); setNewLien(''); setEdit(false); toast('Lien enregistré.');
  });
  const annuler = () => ctx.confirm(side === 'mentor' ? `Annuler le rendez-vous ? On prévient ${firstName(other)}.` : 'Annuler le rendez-vous ? On prévient le lauréat.', () => act(async () => { await store.update('mentorships', m.id, { status: 'annulee' }); toast('Rendez-vous annulé.'); }), 'Annuler le rendez-vous');
  const confirmer = async () => { await confirmerPresence(ctx, m); if (store.byId('mentorships', m.id)?.confirme_at) vibrer(10); };
  const menu = [
    side === 'mentor' ? { label: 'Changer l’horaire ou le lien', icon: 'clock', onClick: () => setEdit(true) } : null,
    { label: 'Annuler le rendez-vous', icon: 'x', danger: true, onClick: annuler },
  ].filter(Boolean);
  return html`<article class=${'mreq billet st-rdv' + (r.live ? ' live' : '') + (focus ? ' m-focus-card' : '')}>
    <div class="billet-haut">
      <${Talon} iso=${m.rdv_at} onAgenda=${() => setAgenda(true)}/>
      <div class="billet-corps">
        <div class="billet-qui">${other ? html`<${Person} p=${other} onOpen=${openProfile} size=${36}/>` : html`<span class="spacer"></span>`}<${MoreMenu} items=${menu}/></div>
        <p class="mreq-subject"><${BesoinTag} k=${m.besoin}/><strong translate="no" dir="auto">${m.sujet}</strong></p>
        <p class="billet-quand"><span class=${'m-rebours' + (r.live ? ' live' : '')}><${Icon} name=${r.live ? 'video' : 'clock'} size=${14}/><span>${r.txt}</span></span><span class="billet-duree">${`${RDV_MIN} min en visio`}</span></p>
      </div>
    </div>
    <div class="billet-bas">
      ${focus && side === 'mentor' && m.message ? html`<${Repliable} cls="quote" lignes=${2}>${m.message}<//>` : null}
      ${m.reponse && side === 'student' ? html`<p class="small billet-mot"><span class="muted"><span translate="no">${firstName(other)}</span> :</span> <span translate="no" dir="auto">${m.reponse}</span></p>` : null}
      ${aConfirmer ? html`<div class="m-confirm"><p class="small"><strong>Tu seras là ?</strong> ${`Confirme pour rassurer ${firstName(other)}.`}</p>
          <div class="m-confirm-acts"><button type="button" class=${'btn small ' + (calme ? 'tonal' : 'primary')} onClick=${confirmer}><${Icon} name="check" size=${15}/> Je serai là</button>
            <button type="button" class="linkish small m-quiet" onClick=${annuler}>Je ne peux pas</button></div></div>`
        : side === 'student' && m.confirme_at ? html`<p class="small m-ok good-t"><${Coche} taille=${22} pose=${dejaConfirme.current}/> Tu as confirmé ta présence.</p>`
        : side === 'mentor' && confirmable ? (m.confirme_at ? html`<p class="small m-ok good-t"><${Coche} taille=${22} pose/> ${`${firstName(other)} a confirmé sa présence.`}</p>`
          : html`<p class="small m-ok muted"><${Icon} name="clock" size=${15}/> ${`${firstName(other)} n’a pas encore confirmé.`}</p>`) : null}
      ${!aConfirmer ? html`<div class="billet-acts">
        ${lien ? html`<a class=${'btn rdv-join ' + (r.live && !calme ? 'primary' : 'tonal')} href=${lien} target="_blank" rel="noopener"><${Icon} name="video" size=${16}/> Rejoindre la visio</a>`
          : html`<span class="small muted billet-prep">Lien de visio en préparation…</span>`}
        ${jitsi ? html`<button type="button" class="icon-btn m-info" aria-label="Astuce Jitsi" aria-expanded=${astuce} onClick=${() => setAstuce(!astuce)}><${Picto} name="info" size=${16}/></button>` : null}
      </div>` : null}
      ${jitsi && astuce ? html`<p class="rdv-tip small"><span>Jitsi est gratuit. La première personne qui entre se connecte avec Google pour ouvrir la salle.</span><button type="button" class="linkish small" onClick=${() => setAstuce(false)}>Compris</button></p>` : null}
      ${commence && onFini ? html`<div class="m-fini"><span class="small muted">L’échange est terminé ?</span><button type="button" class="btn small m-done" onClick=${onFini}><${Icon} name="check" size=${15}/> C’est fait</button></div>` : null}
      ${edit ? html`<div class="rdv-edit"><${TimeChoice} ctx=${ctx} m=${{ ...m, creneaux: [] }} compact/>
        <div class="row"><input id=${'rdv-lien-' + m.id} class="grow" dir="ltr" value=${newLien} onInput=${e => setNewLien(e.target.value)} placeholder="Nouveau lien : https://meet.google.com/…"/><button class="btn small" disabled=${!newLien.trim()} onClick=${saveLien}>Enregistrer le lien</button></div>
        <div class="row"><span class="spacer"></span><button type="button" class="linkish small" onClick=${() => setEdit(false)}>Fermer</button></div></div>` : null}
    </div>
  </article>${agenda ? html`<${FeuilleAgendaRdv} txt=${txt} side=${side} guest=${guest} other=${other} onClose=${() => setAgenda(false)}/>` : null}`;
}

// Après le rendez-vous, côté étudiant : une note, un merci, et c'est terminé.
// plein : « Terminer » est l'action pleine de la page, sauf si une autre carte l'a déjà (le billet du haut qui attend un geste)
function AfterBox({ ctx, m, plein = true }) {
  const { store, act } = ctx;
  const mentor = store.byId('profiles', m.mentor_id);
  const [note, setNote] = useState(5); const [merci, setMerci] = useState('');
  return html`<form class="merci-box" onSubmit=${e => { e.preventDefault(); act(async () => { await store.update('mentorships', m.id, { status: 'terminee', note, merci: merci.trim() || null }); toast(merci.trim() ? 'Merci envoyé ! Il apparaît sur le mur des mercis.' : 'C’est noté, merci !', 'win'); }); }}>
    <p><${Icon} name="heart" size=${16}/> <strong>Comment s’est passé l’échange avec ${firstName(mentor)} ?</strong></p>
    <span class="stars" role="radiogroup" aria-label="Aide reçue">${[1, 2, 3, 4, 5].map(v => html`<button type="button" role="radio" aria-checked=${v === note} class=${v <= note ? 'on' : ''} aria-label=${v + ' sur 5'} onClick=${() => setNote(v)}>★</button>`)}</span>
    <textarea id=${'am-merci-' + m.id} rows="2" maxlength="800" placeholder="Un mot de remerciement…" value=${merci} onInput=${e => setMerci(e.target.value)}></textarea>
    <div class="row"><button type="button" class="linkish small m-quiet" onClick=${() => act(() => store.update('mentorships', m.id, { status: 'annulee' }))}>L’échange n’a pas eu lieu</button><span class="spacer"></span><button class=${'btn small ' + (plein ? 'primary' : 'tonal')}>${merci.trim() ? 'Envoyer mon merci' : 'Terminer'}</button></div>
  </form>`;
}

// Après le rendez-vous, côté lauréat : une question, une action. S'il n'a pas eu lieu : un autre moment, ou on clôt.
// Le lauréat clôt le mentorat : un vrai merci, une seule fois
export function finirMentorat(ctx, m) {
  const { store, act, go } = ctx;
  const s = store.byId('profiles', m.student_id);
  return act(async () => {
    await store.update('mentorships', m.id, { status: 'terminee' });
    const fete = firstName(s) && celebrate({
      cle: 'mentorat-fini-' + m.id, icon: 'heart', titre: 'Merci pour ce mentorat !',
      texte: `Grâce à tes ${RDV_MIN} minutes, ${firstName(s)} avance plus sereinement.`, pts: 20,
      action: { label: 'Voir mes mercis', icon: 'heart', onClick: () => go('espace') },
    });
    if (!fete) toast('Mentorat terminé.', 'win', 20);
  });
}

function AfterMentor({ ctx, m }) {
  const { store, act } = ctx;
  const [non, setNon] = useState(false);
  const finir = () => finirMentorat(ctx, m);
  return html`<div class="m-after">
    <p class="m-after-q"><strong>Le rendez-vous a eu lieu ?</strong> <span class="small muted"><${When} iso=${m.rdv_at}/></span></p>
    <div class="m-after-acts"><button type="button" class="btn small m-done" onClick=${finir}><${Icon} name="check" size=${15}/> Marquer comme terminé</button>
      <button type="button" class="linkish small m-quiet" aria-expanded=${non} onClick=${() => setNon(!non)}>Il n’a pas eu lieu</button></div>
    ${non ? html`<div class="m-after-non"><p class="small">Pas de souci, ça arrive. Propose un autre moment, ou clôture sans rendez-vous.</p>
      <${TimeChoice} ctx=${ctx} m=${{ ...m, creneaux: [] }} compact/>
      <button type="button" class="linkish small m-quiet" onClick=${() => act(async () => { await store.update('mentorships', m.id, { status: 'annulee' }); toast('C’est noté.'); })}>Clôturer sans rendez-vous</button></div>` : null}
  </div>`;
}

// Mes horaires sont passés : en proposer d'autres
function NewSlots({ ctx, m, onDone }) {
  const { store, act } = ctx;
  const [slots, setSlots] = useState(() => [...defaultSlots().slice(0, 2), '']);
  const valid = slots.filter(x => x && new Date(x) > new Date());
  return html`<div class="tconfirm">
    <div class="slot-inputs">${slots.map((v, i) => html`<input type="datetime-local" id=${'ns-' + m.id + '-' + i} aria-label=${`Horaire ${i + 1}`} step="900" value=${v} onInput=${e => setSlots(slots.map((x, j) => (j === i ? e.target.value : x)))}/>`)}</div>
    <div class="row-end"><button class="btn small primary" disabled=${!valid.length} onClick=${() => act(async () => { await store.update('mentorships', m.id, { creneaux: valid.map(x => new Date(x).toISOString()) }); toast('Nouveaux horaires envoyés.'); onDone(); })}>Envoyer ces horaires</button></div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Un mentorat, du début à la fin. Une carte compacte : qui (et « Écrire », « ⋯ ») sur une ligne, puis l'état et le besoin,
// le sujet, son message replié, et ce qu'il y a à faire. Un rendez-vous fixé devient un billet.
// ---------------------------------------------------------------------------
// calme : l'action pleine de la page est sur une autre carte ; celles de cette carte restent tonales. now : l'heure de la page
export function RequestCard({ ctx, m, side, why = [], focus = false, onIgnore = null, calme = false, now = null }) {
  const { store, act, openProfile } = ctx;
  const st = mentorState(m);
  const other = store.byId('profiles', side === 'student' ? m.mentor_id : m.student_id);
  const [reslot, setReslot] = useState(false);
  const [fin, setFin] = useState(false); // « C'est fait » pendant le rendez-vous : on passe tout de suite au merci
  // Acceptée sans horaire (une ancienne demande, ou fixée par l'administration) : pas de billet, le lauréat fixe d'abord le moment
  const sansHeure = st === 'rdv' && !m.rdv_at;
  if (st === 'rdv' && !sansHeure && !fin && side !== 'admin') return html`<${Billet} ctx=${ctx} m=${m} side=${side} focus=${focus} calme=${calme} now=${now} onFini=${() => (side === 'mentor' ? finirMentorat(ctx, m) : setFin(true))}/>`;
  const slots = futureSlots(m);
  const [cls, label] = side === 'mentor' && (st === 'demande' || sansHeure) ? ['m-demande', 'Pour toi'] : sansHeure ? PILL.demande : PILL[st] || PILL.demande;
  const waiting = st === 'ouverte' || st === 'demande';
  const apres = st === 'apres' || (st === 'rdv' && fin);
  // Pas d'étiquette qui répète ce que la carte dit déjà : côté lauréat, « ouverte à tous » (la phrase d'accueil de la section) ;
  // côté étudiant, l'attente (« Tous les lauréats » en tête, « En attente de Zakaria… » en bas, et les étapes)
  const pill = (side === 'mentor' && st === 'ouverte') || (side === 'student' && (waiting || sansHeure)) ? null : html`<span class=${'state-pill ' + cls}>${label}</span>`;
  // « Pourquoi toi » : le besoin est déjà écrit sur son étiquette, on ne le répète pas
  const raisons = why.filter(w => w !== BESOINS[m.besoin]?.label);
  const annulerDemande = () => ctx.confirm('Retirer tes horaires ? Les lauréats ne les verront plus.', () => act(() => store.update('mentorships', m.id, { status: 'annulee' })), 'Retirer');
  // L'administration retire des horaires restés sans suite (un test, un doublon) ; l'étudiant ne reçoit pas de message
  const clore = () => ctx.confirm(`Retirer « ${m.sujet} » ? Ces horaires ne seront plus proposés aux lauréats.`, () => act(async () => { await store.update('mentorships', m.id, { status: 'annulee' }); toast('C’est retiré.'); }), 'Retirer');
  const passer = () => passerDemande(ctx, m);
  const mentorAdmin = side === 'admin' && st === 'rdv' ? store.byId('profiles', m.mentor_id) : null;
  // Une demande ouverte à tous s'écarte d'un geste (« Ignorer ») ; une demande adressée se décline dans « ⋯ » (plus rare)
  const decliner = side === 'mentor' && waiting && st !== 'demande' && onIgnore ? html`<button type="button" class="icon-btn m-ignorer" title="Ignorer" onClick=${onIgnore}><${Icon} name="x" size=${18}/><span class="sr-only">Ignorer</span></button>` : null;
  const menu = [
    side === 'student' && waiting ? { label: 'Retirer mes horaires', icon: 'x', danger: true, onClick: annulerDemande } : null,
    side === 'admin' && waiting ? { label: 'Retirer ces horaires', icon: 'x', danger: true, onClick: clore } : null,
    side === 'mentor' && st === 'demande' ? { label: 'Pas disponible cette fois', icon: 'x', onClick: passer } : null,
  ].filter(Boolean);
  // Le suivi de l'école : sous « Rendez-vous à venir », l'état et le message n'ajoutent rien
  const suivi = side === 'admin' && st === 'rdv' && !sansHeure;
  return html`<article class=${'mreq st-' + st + (focus ? ' m-focus-card' : '') + (apres ? ' m-compact' : '')}>
    <div class="mrow-head m-tete">
      ${other ? html`<${Person} p=${other} onOpen=${openProfile} size=${40}/>` : html`<span class="open-to"><span class="open-ico"><${Icon} name="people" size=${18}/></span><span><strong>Tous les lauréats</strong><span class="small muted">Le premier disponible choisit un horaire</span></span></span>`}
      <span class="mrow-acts">${other ? html`<${MessageBtn} ctx=${ctx} p=${other} label="" cls="icon-btn m-ecrire" aria=${`Écrire à ${firstName(other)}`}/>` : null}${decliner}<${MoreMenu} items=${menu}/></span></div>
    <p class="m-tags">${suivi ? null : pill}<${BesoinTag} k=${m.besoin}/>${waiting ? raisons.map(w => html`<span class="mini good">${w}</span>`) : null}${waiting ? html`<span class="muted small m-ago">${timeAgo(m.created_at)}</span>` : null}</p>
    <p class="mreq-subject"><strong translate="no" dir="auto">${m.sujet}</strong></p>
    ${m.message && !apres && !suivi ? html`<${Repliable} cls="quote" lignes=${2}>${m.message}<//>` : null}
    ${(side === 'student' && waiting) || st === 'terminee' ? html`<${MStepper} m=${m}/>` : null}
    ${m.reponse && side === 'student' && st !== 'ouverte' && !apres ? html`<p class="small"><span class="muted"><span translate="no">${firstName(other)}</span> :</span> <span translate="no" dir="auto">${m.reponse}</span></p>` : null}

    ${side === 'student' && waiting ? html`<div class="mreq-body">
      ${slots.length ? html`<p class="small muted">Tes horaires : ${slots.map(c => html`<span class="mini"><${When} iso=${c}/></span>`)}</p>` : html`<p class="small warn-t">Tes horaires sont passés. Propose-en d’autres pour qu’un lauréat puisse choisir.</p>`}
      ${reslot || !slots.length ? html`<${NewSlots} ctx=${ctx} m=${m} onDone=${() => setReslot(false)}/>` : null}
      <div class="row"><span class="small muted">${st === 'ouverte' ? 'En attente d’un lauréat…' : `En attente de ${firstName(other)}…`}</span><span class="spacer"></span>
        ${slots.length ? html`<button class="linkish small" onClick=${() => setReslot(!reslot)}>${reslot ? 'Fermer' : 'Changer mes horaires'}</button>` : null}</div>
    </div>` : null}

    ${side === 'mentor' && (waiting || sansHeure) ? html`<${TimeChoice} ctx=${ctx} m=${m}/>` : null}
    ${side === 'student' && sansHeure ? html`<p class="small muted">${`${firstName(other)} va fixer l’horaire du rendez-vous.`}</p>` : null}
    ${mentorAdmin ? html`<p class="small muted m-avec"><${Icon} name="video" size=${15}/> <span>Avec</span> <bdi translate="no">${mentorAdmin.full_name}</bdi>${m.rdv_at ? html`<span aria-hidden="true"> · </span><${When} iso=${m.rdv_at}/>` : null}${m.confirme_at ? html`<span aria-hidden="true"> · </span><span class="good-t m-avec-ok"><${Icon} name="checks" size=${14}/> Présence confirmée</span>` : null}</p>` : null}
    ${apres && side === 'student' ? html`<${AfterBox} ctx=${ctx} m=${m} plein=${!calme}/>` : null}
    ${apres && side === 'mentor' ? html`<${AfterMentor} ctx=${ctx} m=${m}/>` : null}
    ${st === 'annulee' && side === 'student' && m.mentor_id && m.rdv_at && other && !nouvelleDemandeApres(ctx.data, m) ? html`<div class="row m-reprendre"><span class="spacer"></span><button type="button" class="linkish small" onClick=${() => ctx.askHelp(other, m.besoin || '', m.sujet)}>Proposer d’autres horaires</button></div>` : null}
    ${st === 'terminee' && (m.merci || m.note) ? html`<p class="small merci-inline">${m.note ? html`<span class="stars-ro" role="img" aria-label=${m.note + ' sur 5'}>${'★'.repeat(m.note)}</span>` : null}${m.merci ? html`<${Icon} name="heart" size=${14}/> <span translate="no" dir="auto">${m.merci}</span>` : null}</p>` : null}
  </article>`;
}

// L'historique : une ligne par mentorat (visage, sujet, état, date, le merci reçu), replié par défaut
function LigneHisto({ ctx, m, side }) {
  const { store } = ctx;
  const st = mentorState(m);
  const other = store.byId('profiles', side === 'mentor' ? m.student_id : m.mentor_id);
  const [cls, label] = PILL[st] || PILL.demande;
  const w = slotWhen(m.rdv_at || m.created_at);
  const reprendre = st === 'annulee' && side === 'student' && m.mentor_id && m.rdv_at && other && !nouvelleDemandeApres(ctx.data, m);
  return html`<li class="m-histo-ligne">
    ${other ? html`<${Avatar} p=${other} size=${36}/>` : html`<span class="open-ico"><${Icon} name="people" size=${18}/></span>`}
    <span class="mh-txt">
      <span class="mh-l1"><strong class="mh-sujet" translate="no" dir="auto">${m.sujet}</strong><span class=${'state-pill ' + cls}>${label}</span></span>
      <span class="small muted mh-l2">${other ? html`<bdi translate="no" dir="auto">${other.full_name}</bdi><span aria-hidden="true"> · </span>` : null}<span>${w.date}</span></span>
      ${st === 'terminee' && (m.merci || m.note) ? html`<span class="small merci-inline mh-merci">${m.note ? html`<span class="stars-ro" role="img" aria-label=${m.note + ' sur 5'}>${'★'.repeat(m.note)}</span>` : null}${m.merci ? html`<span class="mh-merci-txt" translate="no" dir="auto">${m.merci}</span>` : null}</span>` : null}
      ${reprendre ? html`<button type="button" class="linkish small mh-reprendre" onClick=${() => ctx.askHelp(other, m.besoin || '', m.sujet)}>Proposer d’autres horaires</button>` : null}
    </span>
  </li>`;
}

// ---------------------------------------------------------------------------
// La page Mentorat
// ---------------------------------------------------------------------------
const ACTIVE = ['rdv', 'apres', 'ouverte', 'demande'];
const byRdv = (a, b) => new Date(a.rdv_at || a.created_at) - new Date(b.rdv_at || b.created_at);
// Combien d'étudiants ce lauréat a aidés (recrutés grâce à lui, mentorats terminés), comme sur sa ligne
const aidesDe = s => (s?.recrutes || 0) + (s?.mentorats || 0);

// Deux onglets : les rendez-vous en visio et la relecture de CV (la rangée de puces du Socle)
function MentorOnglets({ ctx }) {
  const { data, me, sub, go } = ctx;
  const R = data.relectures_cv || [];
  const aFaire = R.filter(r => (r.reviewer_id === me.id && ['demandee', 'en_cours'].includes(r.status)) || (r.student_id === me.id && r.status === 'rendue' && !r.merci && !r.note)).length;
  return html`<${PucesNav} label="Mentorat" actif=${sub === 'cv' ? 'cv' : 'rdv'} onChoisir=${k => go(k === 'cv' ? 'mentorat/cv' : 'mentorat', { remplacer: true })}
    items=${[{ k: 'rdv', label: 'Rendez-vous', icon: 'video' }, { k: 'cv', label: 'Relecture de CV', icon: 'file', n: aFaire }]}/>`;
}

// « Comment ça marche ? » replié, pour celles et ceux qui connaissent déjà
function HowMore({ role }) {
  return html`<details class="m-how"><summary>Comment ça marche ?</summary><${HowItWorks} role=${role}/></details>`;
}

// « Disponible pour aider » : un interrupteur clair, et ce qu'il change, en une phrase
function Dispo({ ctx }) {
  const { me, store, act } = ctx;
  const on = !!me.mentor_dispo;
  const [vient, setVient] = useState(false);
  const basculer = e => {
    const v = e.target.checked;
    act(async () => { await store.update('profiles', me.id, { mentor_dispo: v }); if (v) { vibrer(10); setVient(true); } });
  };
  return html`<div class=${'m-dispo' + (on ? ' on' : '') + (on && vient ? ' vient' : '')}>
    <span class="m-dispo-point" aria-hidden="true"></span>
    <span class="m-dispo-txt"><label for="mentor-dispo">Disponible pour aider</label>
      <span class="small" id="mentor-dispo-aide">${on ? 'Les étudiants de ton parcours peuvent te proposer leurs horaires.' : 'Les étudiants ne te voient pas encore.'}</span></span>
    <label class="mx-switch"><input id="mentor-dispo" type="checkbox" role="switch" checked=${on} aria-describedby="mentor-dispo-aide" onChange=${basculer}/><span class="mx-switch-piste" aria-hidden="true"></span></label>
  </div>`;
}

// Besoin d'un conseil : cinq tuiles aux couleurs douces, un toucher ouvre la demande sur ce besoin
const SOUS_BESOIN = { cv: 'Un regard neuf avant d’envoyer', stage: 'Où chercher, comment postuler', entretien: 'S’entraîner avec un lauréat', etranger: 'Les étapes, pas à pas', carriere: 'Choisir sa voie, sereinement' };
function TuilesBesoin({ titre, onChoisir }) {
  return html`<section class="m-section m-besoins" aria-labelledby="m-besoins-h">
    <div class="m-head"><h2 id="m-besoins-h">${titre}</h2></div>
    <div class="need-tuiles">${Object.entries(BESOINS).map(([k, v]) => html`<button type="button" class=${'need-tuile nt-' + k} onClick=${() => onChoisir(k)}>
      <span class="nt-ico"><${Icon} name=${v.icon} size=${20}/></span><span class="nt-txt"><strong>${v.label}</strong><span class="nt-sous">${SOUS_BESOIN[k]}</span></span></button>`)}</div>
  </section>`;
}

// « … dernier mot » : le dernier mot et le guillemet fermant restent ensemble (le texte lu reste « texte »)
function citation(txt) {
  const t = String(txt || '').trim(), r = /^([\s\S]*\s)?(\S*[\p{L}\p{N}]\S*(?:\s+[^\p{L}\p{N}\s]+)*)$/u.exec(t);
  return !r || !r[1] ? html`<span class="m-insec" translate="no">«\u00a0${t}\u00a0»</span>` : html`«\u00a0${r[1]}<span class="m-insec" translate="no">${r[2]}\u00a0»</span>`;
}

// Un lauréat qui peut aider, en carte compacte : visage, nom, promo et entreprise, son poste, le sceau « A aidé N étudiants »,
// son dernier merci (replié sur deux lignes) et « Lui demander »
function CarteMentor({ ctx, p, why, merci, onDemander }) {
  const n = aidesDe(ctx.scores?.get(p.id));
  return html`<article class="mcard m-mentor">
    <${Person} p=${p} onOpen=${ctx.openProfile} size=${48} sub=${roleTexte(p)}/>
    ${p.poste ? html`<p class="mm-poste"><${Icon} name="briefcase" size=${14}/><span translate="no" dir="auto">${p.poste}</span></p>` : null}
    ${n || why.length ? html`<p class="mm-sceaux">${n ? html`<span class="m-sceau"><${Icon} name="heart" size=${12}/><span>${n > 1 ? `A aidé ${n} étudiants` : 'A aidé 1 étudiant'}</span></span>` : null}${why.map(w => html`<span class="mini">${w}</span>`)}</p>` : null}
    ${merci ? html`<blockquote class="merci mcard-merci"><${Repliable} lignes=${2}>${citation(merci.txt)}<//><${MerciDuo} ctx=${ctx} m=${merci} size=${22} seul/></blockquote>` : null}
    <div class="mm-pied"><button type="button" class="btn small tonal" onClick=${onDemander}>Lui demander</button></div>
  </article>`;
}

// Une demande acceptée récemment (côté étudiant), pas encore fêtée
function acceptee(data, me) {
  return data.mentorships.filter(m => m.student_id === me.id && m.mentor_id && mentorState(m) === 'rdv' && m.rdv_at && (!m.accepted_at || Date.now() - new Date(m.accepted_at) < 7 * 864e5)).sort(byRdv)[0] || null;
}

export function MentoratPage(ctx) {
  const { data, me, store, act, scores } = ctx;
  const [ask, setAsk] = useState(null); // { mentor, besoin }
  const [past, setPast] = useState(false);
  const [more, setMore] = useState(false);
  const [ignorees, setIgnorees] = useLocal(CLE_IGNOREES, []);
  // L'heure de la page : l'action pleine passe d'une carte à l'autre quand l'heure du rendez-vous approche
  const now = useMaintenant();
  const isLaureat = me.role === 'laureat';
  const isAdmin = me.role === 'admin';
  const feter = me.role !== 'admin' && ctx.sub !== 'cv' ? acceptee(data, me) : null;
  // Un lauréat a accepté ma demande : on le fête une fois, avec une seule prochaine étape. Les deux visages se rejoignent.
  // Elle arrive une seconde après la page (on voit d'abord son rendez-vous), et part avec elle si on s'en va.
  useEffect(() => {
    if (!feter) return;
    const mentor = store.byId('profiles', feter.mentor_id); const prenom = firstName(mentor);
    if (!prenom) return;
    const titre = `${prenom} a accepté !`;
    const h = setTimeout(() => celebrate({
      cle: 'rdv-accepte-' + feter.id, icon: 'calendar', titre, visages: [me, mentor],
      texte: `Rendez-vous ${quand(feter.rdv_at)}, ${RDV_MIN} min en visio. Note deux ou trois questions : c’est tout ce qu’il faut.`,
      action: store.peutDiscuter?.(feter.mentor_id) ? { label: 'Lui écrire', icon: 'chat', onClick: () => ctx.ecrire(feter.mentor_id) } : null,
    }), 1000);
    return () => {
      clearTimeout(h);
      const ti = document.getElementById('fete-titre');
      if (ti && ti.textContent === tr(titre)) ti.closest('.fete')?.querySelector('.fete-acts .btn:last-child')?.click();
    };
  }, [feter?.id]);

  const mine = data.mentorships.filter(m => m.student_id === me.id);
  const mineActive = mine.filter(m => ACTIVE.includes(mentorState(m))).sort((a, b) => ACTIVE.indexOf(mentorState(a)) - ACTIVE.indexOf(mentorState(b)) || byRdv(a, b));
  const minePast = mine.filter(m => !ACTIVE.includes(mentorState(m))).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const asMentor = data.mentorships.filter(m => m.mentor_id === me.id);
  const rdvs = asMentor.filter(m => ['rdv', 'apres'].includes(mentorState(m))).sort((a, b) => (mentorState(b) === 'apres') - (mentorState(a) === 'apres') || byRdv(a, b));
  const done = asMentor.filter(m => m.status === 'terminee').sort((a, b) => new Date(b.rdv_at || b.created_at) - new Date(a.rdv_at || a.created_at));
  // Demandes pour moi : toutes celles qui me vont (lauréat), ou celles qu'un étudiant m'a adressées (administration)
  const need = isLaureat || isAdmin ? requestsFor(data, me, id => store.byId('profiles', id)).filter(x => x.direct || (isLaureat && !ignorees.includes(x.m.id))) : [];
  const ignorer = m => { setIgnorees([...ignorees.filter(id => id !== m.id), m.id].slice(-200)); toast('C’est masqué : tu ne le reverras plus dans ta liste.'); };
  const seRendreDispo = () => act(async () => { await store.update('profiles', me.id, { mentor_dispo: true }); vibrer(10); });
  // « Voir les autres étudiants » : la rangée s'allonge et glisse jusqu'à la première carte qu'on n'avait pas vue
  const voirAutres = () => {
    const ouvrir = !more; setMore(ouvrir);
    if (ouvrir) requestAnimationFrame(() => { const c = document.querySelector('.m-avis-liste .rangee-cartes'); const x = c?.children[2]; if (c && x && c.scrollWidth > c.clientWidth) c.scrollTo({ left: x.offsetLeft - c.firstElementChild.offsetLeft, behavior: mouvementReduit() ? 'auto' : 'smooth' }); });
  };
  const busy = new Set(mineActive.map(m => m.mentor_id));
  const dispos = me.role === 'etudiant' ? mentorsFor(data, me, '', scores) : [];
  const reco = dispos.filter(x => !busy.has(x.p.id)).slice(0, 3);
  // Sur chaque carte : le dernier merci reçu, s'il est déjà sur le mur des mercis (sinon rien)
  const mercis = reco.length ? mercisPublics(data) : [];
  // Sur-titre : un chiffre vrai et utile (les lauréats prêts à aider un étudiant), sinon la ligne reste réservée
  const surTitre = dispos.length > 1 ? `${dispos.length} lauréats disponibles` : dispos.length ? '1 lauréat disponible' : null;
  const entete = html`<${EnTetePage} surTitre=${surTitre} garderPlace titre="Mentorat"><${MentorOnglets} ctx=${ctx}/><//>`;

  if (ctx.sub === 'cv') return html`<section class="page mentorat">
    ${entete}
    <${RelecturesPage} ctx=${ctx}/>
  </section>`;

  // Administration : d'abord ce qui la concerne elle-même (une demande adressée, un rendez-vous fixé), puis le suivi de l'école
  if (isAdmin) {
    const miens = new Set([...need.map(x => x.m.id), ...rdvs.map(m => m.id)]);
    // Une demande acceptée sans horaire attend encore son moment : elle est avec les demandes, pas avec les rendez-vous
    const open = data.mentorships.filter(m => (m.status === 'demande' || (mentorState(m) === 'rdv' && !m.rdv_at)) && !miens.has(m.id)).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const soon = data.mentorships.filter(m => mentorState(m) === 'rdv' && m.rdv_at && !miens.has(m.id)).sort(byRdv);
    return html`<section class="page mentorat">
      ${entete}
      ${rdvs.length ? html`<section class="m-section"><div class="m-head"><h2 class="h-ico"><${Icon} name="video"/> Tes rendez-vous</h2></div>
        <div class="list">${rdvs.map((m, i) => html`<${RequestCard} key=${m.id} ctx=${ctx} m=${m} side="mentor" focus=${i === 0}/>`)}</div></section>` : null}
      ${need.length ? html`<section class="m-section"><div class="m-head"><h2 class="h-ico"><${Icon} name="heart"/> Ils aimeraient ton avis <span class="count">${need.length}</span></h2></div>
        <div class="list">${need.map(({ m, why }) => html`<${RequestCard} key=${m.id} ctx=${ctx} m=${m} side="mentor" why=${why}/>`)}</div></section>` : null}
      <section class="m-section m-suivi"><div class="m-head"><h2 class="h-ico"><${Icon} name="chart"/> Suivi de l’école</h2></div>
        ${soon.length ? html`<h3 class="m-sub">Rendez-vous à venir <span class="count">${soon.length}</span></h3>
          <${Rangee} label="Rendez-vous à venir" grille cls="m-cartes">${soon.map(m => html`<${RequestCard} key=${m.id} ctx=${ctx} m=${m} side="admin"/>`)}<//>` : null}
        <h3 class="m-sub">En attente d’un horaire <span class="count">${open.length}</span></h3>
        ${open.length ? html`<${Rangee} label="En attente d’un horaire" grille cls="m-cartes">${open.map(m => html`<${RequestCard} key=${m.id} ctx=${ctx} m=${m} side="admin"/>`)}<//>`
          : html`<div class="list"><${Empty} icon="mentor" title="Personne n’attend d’horaire">Chaque étudiant a trouvé un lauréat.<//></div>`}
      </section>
    </section>`;
  }

  // Ce qui est en cours, d'abord : le prochain rendez-vous, puis le reste (rendez-vous passés à clore, horaires en attente)
  const role = isLaureat ? 'laureat' : 'etudiant';
  const nouveau = !data.mentorships.some(m => m.student_id === me.id || m.mentor_id === me.id);
  const actifs = [...mineActive.map(m => ({ m, side: 'student' })), ...rdvs.map(m => ({ m, side: 'mentor' }))];
  // Le billet ne porte qu'un rendez-vous qui a son heure ; un rendez-vous accepté sans horaire attend avec les autres
  const next = actifs.filter(x => mentorState(x.m) === 'rdv' && x.m.rdv_at).sort((a, b) => byRdv(a.m, b.m))[0] || null;
  const RANG = { apres: 0, rdv: 1, demande: 2, ouverte: 2 };
  const autres = actifs.filter(x => x !== next).sort((a, b) => RANG[mentorState(a.m)] - RANG[mentorState(b.m)] || byRdv(a.m, b.m));
  // Le titre dit ce que sont les cartes dessous : des horaires qui attendent, des rendez-vous passés à clore, ou les deux
  const passes = autres.filter(x => mentorState(x.m) === 'apres').length;
  const titreAutres = next ? 'Aussi en cours' : !passes ? 'En attente d’un horaire' : passes === autres.length ? 'Mes rendez-vous' : 'En cours';
  // Une seule action pleine sur la page : celle de la première carte qui en a une (le billet du haut s'il attend un geste,
  // sinon le merci d'un rendez-vous passé, ou un autre billet) ; les autres cartes restent tonales
  const aUnPlein = ({ m, side }) => mentorState(m) === 'apres' ? side === 'student'
    : mentorState(m) === 'rdv' && !!m.rdv_at && !!pleinDuBillet(m, side, lienVisio(store, m.id), now);
  const pleine = [next, ...autres].find(x => x && aUnPlein(x)) || null;
  const hist = isLaureat ? done : minePast;
  const enCours = autres.length ? html`<section class="m-section m-autres">
      <div class="m-head"><h2>${titreAutres} <span class="count">${autres.length}</span></h2></div>
      <div class="list">${autres.map(x => html`<${RequestCard} key=${x.m.id} ctx=${ctx} m=${x.m} side=${x.side} now=${now} calme=${x !== pleine}/>`)}</div>
    </section>` : null;

  return html`<section class="page mentorat">
    ${entete}
    ${isLaureat && (me.mentor_dispo || need.length) ? html`<${Dispo} ctx=${ctx}/>` : null}
    ${nouveau ? html`<${HowItWorks} role=${role}/>` : null}

    ${next ? html`<section class="m-section m-next" aria-labelledby="m-next-h">
      <div class="m-head"><h2 id="m-next-h">Ton prochain rendez-vous</h2></div>
      <${RequestCard} key=${next.m.id} ctx=${ctx} m=${next.m} side=${next.side} focus now=${now} calme=${!!pleine && pleine !== next}/>
    </section>` : null}

    ${!isLaureat ? enCours : null}
    ${!isLaureat ? html`<${TuilesBesoin} titre=${mine.length ? 'Besoin d’un autre conseil ?' : 'Besoin d’un conseil ?'} onChoisir=${k => setAsk({ besoin: k })}/>` : null}

    ${isLaureat ? html`<section class="m-section m-avis" aria-labelledby="m-avis-h">
      <div class="m-head"><h2 id="m-avis-h" class="h-ico"><${Icon} name="heart"/> Ils aimeraient ton avis${need.length ? html` <span class="count">${need.length}</span>` : null}</h2></div>
      ${need.length ? html`<p class="small muted m-invite">Choisis l’étudiant que tu peux aider, à ton rythme. Les autres lauréats s’occupent du reste.</p>` : null}
      ${need.length ? html`<${Rangee} label="Ils aimeraient ton avis" grille cls="m-cartes m-avis-liste">${(more ? need : need.slice(0, 2)).map(({ m, why, direct }) => html`<${RequestCard} key=${m.id} ctx=${ctx} m=${m} side="mentor" why=${why} onIgnore=${direct ? null : () => ignorer(m)}/>`)}<//>`
        : html`<div class="list">${!me.mentor_dispo
        // Mentorat calme : une seule action, se rendre disponible
        ? html`<${Empty} icon="mentor" title="Tout est calme pour l’instant" action=${{ label: 'Me rendre disponible', icon: 'check', onClick: seRendreDispo }}>Rends-toi disponible : les étudiants de ton parcours pourront te demander conseil directement.<//>`
        : html`<${Empty} icon="mentor" title="Tout est calme pour l’instant">On te prévient dès qu’un étudiant demande de l’aide.<//>`}</div>`}
      ${need.length > 2 ? html`<button type="button" class="linkish small past-toggle" aria-expanded=${more} onClick=${voirAutres}>${more ? 'Voir moins' : `Voir les autres étudiants (${need.length - 2})`}</button>` : null}
    </section>` : null}
    ${isLaureat ? enCours : null}

    ${!isLaureat && reco.length ? html`<${Rangee} titre="Des lauréats qui peuvent t’aider" sousTitre="Ou choisis toi-même à qui demander" grille cls="m-mentors">
      ${reco.map(({ p, why }) => html`<${CarteMentor} key=${p.id} ctx=${ctx} p=${p} why=${why} merci=${dernierMerciPour(mercis, p.id)} onDemander=${() => setAsk({ mentor: p })}/>`)}
    <//>` : null}

    ${hist.length ? html`<div class="m-histo">
      <button type="button" class="linkish small past-toggle" aria-expanded=${past} onClick=${() => setPast(!past)}>${past ? 'Masquer l’historique' : `Voir l’historique (${hist.length})`}</button>
      ${past ? html`<ul class="m-histo-liste">${hist.slice(0, 10).map(m => html`<${LigneHisto} key=${m.id} ctx=${ctx} m=${m} side=${isLaureat ? 'mentor' : 'student'}/>`)}</ul>` : null}
    </div>` : null}

    ${isLaureat && me.en_recherche ? html`<div class="callout"><p><strong>Tu cherches un emploi ?</strong> Un lauréat plus expérimenté peut relire ton CV, te préparer à un entretien ou te parler salaire.</p><div><button class="btn small tonal" id="mt-demande-laureat" onClick=${() => setAsk({ besoin: 'entretien' })}><${Icon} name="heart" size=${15}/> Demander conseil</button></div></div>`
      : isLaureat ? html`<p class="small muted center m-aussi">Toi aussi, tu cherches un conseil ? <button type="button" class="linkish" onClick=${() => setAsk({})}>Demande à un lauréat plus expérimenté</button></p>` : null}
    ${!nouveau ? html`<${HowMore} role=${role}/>` : null}
    ${ask ? html`<${AskHelp} ctx=${ctx} mentor=${ask.mentor} besoin=${ask.besoin} sujet=${ask.sujet} onClose=${() => setAsk(null)}/>` : null}
  </section>`;
}

// ---------------------------------------------------------------------------
// Sur l'accueil : le prochain rendez-vous (sauf celui que la carte du haut montre déjà)
// ---------------------------------------------------------------------------
export function NextRdv({ ctx, exclure }) {
  const { data, me, store, go } = ctx;
  const next = data.mentorships.filter(m => (m.student_id === me.id || m.mentor_id === me.id) && mentorState(m) === 'rdv' && m.rdv_at && !exclure?.has(m.id)).sort(byRdv)[0];
  if (!next) return null;
  const other = store.byId('profiles', next.mentor_id === me.id ? next.student_id : next.mentor_id);
  const lien = lienVisio(store, next.id);
  const live = enDirect(next.rdv_at);
  const aConfirmer = next.student_id === me.id && 'confirme_at' in next && !next.confirme_at && !live;
  return html`<div class=${'next-rdv' + (live ? ' live' : '')}>
    <${SlotDate} iso=${next.rdv_at}/>
    <span class="next-main"><span class="eyebrow"><${Icon} name="video" size=${13}/> Prochain rendez-vous</span><strong dir="auto" translate="no">${next.sujet}</strong><span class="small muted">Avec <span translate="no">${other?.full_name || ''}</span></span></span>
    <span class="next-act">${aConfirmer ? html`<button class="btn small" onClick=${() => confirmerPresence(ctx, next)}><${Icon} name="check" size=${15}/> Je serai là</button>` : null}
      ${lien && !aConfirmer ? html`<a class="btn small" href=${lien} target="_blank" rel="noopener"><${Icon} name="video" size=${15}/> Rejoindre</a>` : null}
      <button class="btn small ghost" onClick=${() => go('mentorat')}>Détails</button></span>
  </div>`;
}

// ---------------------------------------------------------------------------
// Accueil d'un lauréat : « Ils ont besoin de toi », un seul bloc, trois lignes au plus.
// Chaque ligne : qui, ce qu'il attend, le sujet, et un seul geste qui s'ouvre sur place.
// ---------------------------------------------------------------------------
export const ICONE_BESOIN = { conseil: 'mentor', cv: 'eye', demande: 'send', question: 'qa' };
export const VERBE_BESOIN = { conseil: 'Choisir un horaire', cv: 'Relire', demande: 'Je peux aider', question: 'Répondre' };
const CHERCHE = { stage: 'Cherche un stage', pfe: 'Cherche un PFE', etranger: 'Cherche un stage à l’étranger', emploi: 'Cherche un emploi' };
export const quoiBesoin = b => (b.kind === 'conseil' ? (b.direct ? 'Te demande un conseil' : 'Cherche un conseil')
  : b.kind === 'cv' ? (b.direct ? 'Te demande de relire son CV' : 'Attend une relecture de CV')
  : b.kind === 'demande' ? CHERCHE[b.type] || 'Cherche un stage' : `Question sur ${b.cible}`);
// Phrases de la carte du haut : celles des notifications, déjà traduites
export const phraseBesoin = (b, nom) => (b.kind === 'conseil' ? `${nom} ${b.direct ? 'te demande' : 'cherche'} de l’aide : ${b.sujet}`
  : b.kind === 'cv' ? (b.direct ? `${nom} te demande de relire son CV.` : `${nom} attend une relecture de son CV.`)
  : b.kind === 'demande' ? `${nom} cherche : ${b.sujet}` : `Une question pour toi sur ${b.cible} : ${b.sujet}`);
// Le geste d'une ligne : la feuille sur place (demande, conseil), sinon la page où il se fait
export const ouvrirBesoin = (ctx, b) => (b.kind === 'demande' ? ctx.proposerAide(b.id) : b.kind === 'conseil' ? ctx.choisirHoraire(b.id)
  : ctx.go(b.kind === 'cv' ? 'mentorat/cv' : 'reseau/entraide/' + b.id));

function LigneBesoin({ ctx, b, onOpen }) {
  const p = ctx.store.byId('profiles', b.who);
  return html`<li><button type="button" class="bs-ligne" onClick=${() => onOpen(b)}>
    <${Avatar} p=${p} size=${40}/>
    <span class="bs-txt"><span class="bs-l1"><strong class="bs-nom" translate="no" dir="auto">${p?.full_name || 'Un membre'}</strong><span class="bs-verbe">${VERBE_BESOIN[b.kind]}<${Icon} name="arrow" size=${16}/></span></span>
      <span class="bs-quoi">${quoiBesoin(b)}</span>${b.sujet ? html`<span class="bs-sujet" translate="no" dir="auto">${b.sujet}</span>` : null}</span></button></li>`;
}
export function IlsOntBesoin({ ctx, besoins }) {
  const { data, me, saison, go } = ctx;
  const [tout, setTout] = useState(false);
  if (me.role !== 'laureat') return null;
  const ouvrir = b => ouvrirBesoin(ctx, b);
  // Réseau encore calme : les étudiants de sa filière qui cherchent encore, en une ligne
  if (!besoins.length) {
    const { list, nouveaux } = alerteTalents(data, me, saison);
    if (!list.length) return null;
    return html`<section class="besoins" aria-labelledby="bs-h"><div class="section-head"><h3 id="bs-h">Ils ont besoin de toi</h3></div>
      <button class="impact-strip clickable talents-strip" onClick=${() => go('reseau/talents')}>
        <span class="obj-ico"><${Icon} name="spark" size=${20}/></span>
        <span class="grow"><strong>${list.length > 1 ? `${list.length} étudiants de ${me.filiere} cherchent encore` : `1 étudiant de ${me.filiere} cherche encore`}</strong>${nouveaux ? html`<span class="mini hit">${nouveaux > 1 ? `${nouveaux} nouveaux cette semaine` : '1 nouveau cette semaine'}</span>` : null}
          <span class="small muted">Un stage, un PFE ou un premier emploi dans ton équipe ? Invite-les à postuler en un clic.</span></span>
        <span class="av-stack">${list.slice(0, 3).map(({ p }) => html`<${Avatar} p=${p} size=${28}/>`)}</span>
        <${Icon} name="arrow" size=${18}/>
      </button></section>`;
  }
  return html`<section class="besoins" aria-labelledby="bs-h">
    <div class="section-head"><h3 id="bs-h">Ils ont besoin de toi</h3>
      ${besoins.length > 3 ? html`<button type="button" class="btn tiny ghost bs-tout" aria-haspopup="dialog" onClick=${() => setTout(true)}>${`Tout voir (${besoins.length})`}</button>` : null}</div>
    <ul class="bs-liste">${besoins.slice(0, 3).map(b => html`<${LigneBesoin} key=${b.kind + b.id} ctx=${ctx} b=${b} onOpen=${ouvrir}/>`)}</ul>
    ${tout ? html`<${Modal} title="Ils ont besoin de toi" onClose=${() => setTout(false)}><ul class="bs-liste">${besoins.map(b => html`<${LigneBesoin} key=${b.kind + b.id} ctx=${ctx} b=${b} onOpen=${x => { setTout(false); ouvrir(x); }}/>`)}</ul><//>` : null}
  </section>`;
}

// Une demande de conseil touchée (accueil, cloche) s'ouvre sur place avec ses horaires.
// Elle se ferme dès que l'horaire est choisi (la fête prend le relais) ; prise par un autre, elle le dit.
export function HoraireSheet({ ctx, id, onClose }) {
  const { store, me, data, go } = ctx;
  const m = data.mentorships.find(x => x.id === id);
  const s = m ? store.byId('profiles', m.student_id) : null;
  const libre = !!m && m.status === 'demande' && m.student_id !== me.id && (!m.mentor_id || m.mentor_id === me.id);
  const fixe = !!m && m.mentor_id === me.id && mentorState(m) === 'rdv';
  const [ign, setIgn] = useLocal(CLE_IGNOREES, []);
  useEffect(() => { if (fixe) onClose(); }, [fixe]);
  if (fixe) return null;
  const why = libre && s ? helpMatch(m, me, s).why : [];
  const autres = requestsFor(data, me, x => store.byId('profiles', x)).filter(x => x.m.id !== id).length;
  const voirAutres = autres ? { label: 'Voir les autres étudiants', onClick: () => { onClose(); go('mentorat'); } } : null;
  const ignorer = () => { setIgn([...ign.filter(k => k !== id), id].slice(-200)); toast('C’est masqué : tu ne le reverras plus dans ta liste.'); onClose(); };
  return html`<${Modal} title=${s ? `Aider ${firstName(s)}` : 'Mentorat'} onClose=${onClose}>
    ${libre ? html`<div class="hn-card">
      <${Person} p=${s} onOpen=${ctx.openProfile} size=${40}/>
      <p class="mreq-subject"><${BesoinTag} k=${m.besoin}/><strong translate="no" dir="auto">${m.sujet}</strong></p>
      ${m.message ? html`<p class="quote" translate="no" dir="auto">${m.message}</p>` : null}
      ${why.length ? html`<p class="why"><span class="small muted">Pourquoi toi :</span> ${why.map(w => html`<span class="mini good">${w}</span>`)}</p>` : null}
      <${TimeChoice} ctx=${ctx} m=${m} compact/>
      <div class="row m-decline"><span class="spacer"></span>${m.mentor_id === me.id
        ? html`<button type="button" class="btn tiny ghost" onClick=${() => passerDemande(ctx, m, onClose)}><${Icon} name="x" size=${14}/> Pas disponible cette fois</button>`
        : html`<button type="button" class="btn tiny ghost" onClick=${ignorer}><${Icon} name="x" size=${14}/> Ignorer</button>`}</div>
    </div>` : html`<${Empty} icon="heart" title="Plus besoin d’horaire ici" action=${voirAutres}>Un autre lauréat a choisi un horaire, ou l’étudiant a retiré les siens. Merci d’avoir voulu aider !<//>`}
  <//>`;
}

// ---------------------------------------------------------------------------
// Accueil d'un étudiant : « Besoin d'un coup de main ? », une seule carte.
// Une porte en bouton (demande, conseil ou CV), les autres en liens, et ce qui est déjà en route.
// ---------------------------------------------------------------------------
export function CoupDeMain({ ctx, exclure, cle }) {
  const { data, me, saison, store, go } = ctx;
  const [relire, setRelire] = useState(false);
  const [demande, setDemande] = useState(false);
  const n = niveauOf(me, saison);
  const pr = me.role === 'etudiant' ? (data.parrainages || []).find(x => x.filleul_id === me.id && x.saison === saison) : null;
  // Un 3A reçoit son parrain à son premier passage à l'accueil
  useEffect(() => { if (me.role === 'etudiant' && n === 3 && !pr && !demande) { setDemande(true); store.monParrain?.().catch(() => {}); } }, [n, !!pr]);
  if (me.role !== 'etudiant') return null;
  const { principal, autres, suivi } = coupDeMain(data, me, saison, { exclure, cle });
  if (!principal && !suivi) return null;
  const parrain = pr ? store.byId('profiles', pr.parrain_id) : null;
  const P = {
    demande: ['Publier ma demande', 'Dis aux lauréats ce que tu cherches : ta demande et ton CV arrivent chez ceux de ton parcours.', () => go('offres/demandes/nouvelle')],
    conseil: [parrain ? `Demander conseil à ${firstName(parrain)}, ton parrain` : 'Demander un conseil', 'CV, stage, entretien, étranger : un lauréat te parle 20 minutes en visio.', () => ctx.askHelp(parrain)],
    cv: ['Faire relire mon CV', 'Un lauréat relit ton CV et te laisse ses conseils, rubrique par rubrique.', () => setRelire(true)],
  };
  return html`<section class="coup-de-main" id="coup-de-main" aria-labelledby="cm-h">
    <div class="cm-head"><span class="obj-ico"><${Icon} name="heart" size=${22}/></span>
      <span class="cm-txt"><h3 id="cm-h" class="cm-titre">Besoin d’un coup de main ?</h3>${principal ? html`<span class="small muted">${P[principal][1]}</span>` : null}</span></div>
    ${suivi ? html`<${SuiviAide} ctx=${ctx} s=${suivi}/>` : null}
    ${principal ? html`<div class="cm-acts"><button type="button" id="cm-go" class="btn small" onClick=${P[principal][2]}>${P[principal][0]}</button></div>` : null}
    ${autres.length ? html`<p class="cm-ou small"><span class="muted">Ou</span> ${autres.map((k, i) => html`${i ? html`<span class="muted" aria-hidden="true"> · </span>` : null}<button type="button" class="linkish small" onClick=${P[k][2]}>${P[k][0]}</button>`)}</p>` : null}
    ${relire ? html`<${DemandeRelecture} ctx=${ctx} onClose=${() => setRelire(false)}/>` : null}
  </section>`;
}
function SuiviAide({ ctx, s }) {
  const { data, store, go } = ctx;
  const ligne = (ico, route, txt, etat) => html`<button type="button" class="cm-suivi" onClick=${() => go(route)}><${Icon} name=${ico} size=${16}/><span class="cm-suivi-txt">${txt}</span>${etat ? html`<span class="small">${etat}</span>` : null}<${Icon} name="arrow" size=${16}/></button>`;
  if (s.kind === 'demande') {
    const d = (data.demandes || []).find(x => x.id === s.id); if (!d) return null;
    const n = (data.propositions || []).filter(x => x.demande_id === d.id && x.status === 'envoyee').length;
    return ligne('send', 'offres/demandes/' + d.id, html`<span class="small muted">Ma demande</span> <bdi translate="no" dir="auto">${d.titre}</bdi>`, d.status === 'match' ? 'Match' : n > 1 ? `${n} propositions` : n ? '1 proposition' : 'En attente');
  }
  if (s.kind === 'cv') {
    const r = (data.relectures_cv || []).find(x => x.id === s.id); if (!r) return null;
    return ligne('eye', 'mentorat/cv', `${firstName(store.byId('profiles', r.reviewer_id)) || 'Un lauréat'} relit ton CV`);
  }
  const m = data.mentorships.find(x => x.id === s.id); if (!m) return null;
  return ligne('mentor', 'mentorat', html`<span class="small muted">En attente d’un horaire</span> <bdi translate="no" dir="auto">${m.sujet}</bdi>`);
}

// ---------------------------------------------------------------------------
// Styles de la passe UX (après ceux de page.html, qu'ils complètent)
// ---------------------------------------------------------------------------
injectCSS('mentorat-ux', `
/* Confirmation de présence, « c'est fait », refus poli */
.m-confirm { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2) var(--sp-3); }
.m-confirm p { margin: 0; flex: 1 1 16rem; }
.m-confirm-acts { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
.m-confirm-acts .btn { min-height: 44px; }
.m-ok { display: flex; align-items: center; gap: .45rem; margin: 0; }
.m-ok > .coche { flex: none; }
.m-fini { display: flex; align-items: center; justify-content: flex-end; gap: var(--sp-3); flex-wrap: wrap; padding-top: var(--sp-3); border-top: 1px solid var(--line); }
.m-decline { margin-top: calc(-1 * var(--sp-1)); }
.m-sub { margin: var(--sp-2) 0 0; font-size: var(--fs-3, 1rem); display: flex; align-items: center; gap: .5rem; }
/* Sections : un titre, puis le contenu */
.m-section { display: flex; flex-direction: column; gap: var(--sp-3); min-width: 0; }
.m-head { display: flex; align-items: center; gap: var(--sp-2) var(--sp-3); flex-wrap: wrap; }
.m-head h2 { margin: 0; }
.m-invite { margin: calc(-1 * var(--sp-1)) 0 0; max-width: 60ch; }
.mreq.m-focus-card { box-shadow: var(--sh2); }

/* Le besoin au-dessus, comme un sur-titre ; puis le sujet coule comme une phrase (aussi dans la feuille de l'accueil) */
.mreq-subject { display: block; line-height: 1.5; }
.mreq-subject > .mini.besoin { display: flex; width: fit-content; margin: 0 0 .3rem; }
.mreq-subject > .m-ago { white-space: nowrap; }
/* En arabe, un sujet écrit en français garde sa propre boîte (sinon ses lignes se croisent avec le texte arabe) ;
   le besoin reste seul sur sa ligne (le ::before vide passe à la ligne entre les deux) */
[dir="rtl"] .mreq-subject { display: flex; flex-wrap: wrap; align-items: center; gap: .15rem .45rem; }
[dir="rtl"] .mreq-subject > .mini.besoin { margin: 0; order: -2; }
[dir="rtl"] .mreq-subject::before { content: ""; order: -1; flex-basis: 100%; height: 0; }
@media (max-width: 480px) {
  .mstep, .mstep li { gap: .3rem; }
  .mstep li { font-size: .76rem; }
  .mstep li + li::before { width: 12px; }
  .mstep .step-dot { width: 20px; height: 20px; font-size: .75rem; }
}

/* En-tête d'une carte de relecture (cv.js) : le nom garde sa ligne, l'état et « Écrire » passent dessous sur téléphone */
.mrow-head { flex-wrap: wrap; row-gap: var(--sp-2); }
.mrow-head > .person, .mrow-head > .open-to { flex: 0 1 auto; min-width: 0; }
.mrow-head .person-name { overflow-wrap: anywhere; }
.mrow-head > .m-more { margin-inline-start: -.2rem; }
@media (max-width: 480px) {
  .mrow-head > .person, .mrow-head > .open-to { flex: 1 1 100%; }
  .mrow-head > .spacer { display: none; }
  .mrow-head > .state-pill { margin-inline-start: calc(36px + .6rem); }
  .mrow-head > .msg-btn, .mrow-head > .state-pill + .m-more { margin-inline-start: auto; }
}

/* ---- Page Mentorat : des cartes compactes ---- */
.mentorat .mreq:not(.billet) { gap: .6rem; padding: .9rem 1rem 1rem; }
/* Qui, sur une ligne : le visage et le nom à gauche, « Écrire » et « ⋯ » au bout ; la ligne d'année se coupe, jamais l'action */
.mrow-head.m-tete { display: flex; align-items: center; gap: .5rem; flex-wrap: nowrap; min-width: 0; }
.mrow-head.m-tete > .person, .mrow-head.m-tete > .open-to { flex: 1 1 auto; min-width: 0; }
.mrow-head.m-tete .role-line { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* En arabe, « دفعة 2012 · Renault Group Maroc » coupé en « … » perdrait le début du nom latin : la ligne passe à la ligne
   (deux lignes au plus sur une carte de demande, où une longue filière en arabe se coupe à sa fin) */
[dir="rtl"] .mrow-head.m-tete .role-line { white-space: normal; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
[dir="rtl"] .m-mentor .role-line { white-space: normal; }
.m-avec { margin: 0; line-height: 1.55; }
.m-avec > svg { vertical-align: -3px; margin-inline-end: .1rem; }
.m-avec-ok { white-space: nowrap; }
.m-avec-ok > svg { vertical-align: -2px; }
.mrow-acts { flex: none; display: inline-flex; align-items: center; gap: .15rem; margin-inline-end: -.4rem; }
.mrow-acts:empty { display: none; }
.icon-btn.m-ecrire { position: relative; width: 40px; height: 40px; border-radius: 50%; color: var(--blue-text); }
.icon-btn.m-ecrire::before { content: ""; position: absolute; inset: -2px; }
.icon-btn.m-ecrire:hover { background: var(--tonal-bg); color: var(--tonal-ink); }
.icon-btn.m-ecrire .count { position: absolute; top: 0; inset-inline-end: -2px; min-width: 1.15rem; padding: 0 .25rem; background: var(--accent); color: var(--accent-ink); font-size: .68rem; line-height: 1.15rem; }
/* L'état, le besoin, ce qui le rapproche de toi et depuis quand, sur une ligne de petites étiquettes */
.m-tags { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem .4rem; margin: 0; min-width: 0; }
.m-tags:empty { display: none; }
.m-tags .mini, .m-tags .state-pill { margin: 0; }
.m-tags .m-ago { white-space: nowrap; margin-inline-start: .1rem; }
.mentorat .mreq-subject { font-size: var(--fs-4); line-height: 1.4; }
.mentorat .mreq-subject strong { font-weight: 650; overflow-wrap: anywhere; }
/* Un message long se replie sur deux ou trois lignes : « Lire la suite » s'il dépasse vraiment */
.m-repli { margin: 0; overflow-wrap: anywhere; }
.m-repli:not(.ouvert) { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: var(--lignes, 2); overflow: hidden; }
.m-repli-btn { align-self: flex-start; min-height: 32px; margin-top: -.35rem; font-weight: 600; }
.mentorat .mreq .quote { font-size: var(--fs-3); line-height: 1.5; }
/* Choisir un horaire : le titre et « Ignorer » sur une ligne, les horaires en puces */
.icon-btn.m-ignorer { width: 44px; height: 44px; border-radius: 50%; color: var(--ink-2); }
.icon-btn.m-ignorer:hover { background: var(--surface-2); color: var(--ink); }
.mentorat .tchoice .chips { gap: .4rem; }
.mentorat .tchoice .chip { min-height: 40px; }
.mentorat .mreq-body > .row { flex-wrap: wrap; gap: .2rem .6rem; }
.mrow-acts > .m-more { margin-inline-start: -.1rem; }

/* Les deux onglets tiennent à 360 px, pastille comprise (sans leurs pictogrammes, sous le fondu sinon) */
@media (max-width: 380px) { .mentorat > .page-head .puces-nav [role="tab"] > .ico { display: none; } }

/* Les demandes, côte à côte : une carte par étudiant, on glisse de l'un à l'autre (en grille sur ordinateur) */
.m-cartes .rangee-cartes { --rangee-l: min(88%, 22rem); --rangee-min: 330px; }
.m-cartes .mreq { height: 100%; animation: none; }

/* ---- Le billet du rendez-vous ---- */
.mreq.billet { padding: 0; gap: 0; }
.billet-haut { display: flex; align-items: stretch; min-width: 0; }
.billet-talon { flex: none; inline-size: 4.6rem; display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: .45rem; padding: .85rem .3rem .45rem;
  border-start-start-radius: var(--r-lg); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); color: var(--blue-text); text-align: center;
  border-inline-end: 2px dashed color-mix(in srgb, var(--accent) 26%, transparent); transition: background-color .3s, color .3s; }
.bt-date { display: flex; flex-direction: column; align-items: center; gap: .05rem; margin-block: auto; }
.bt-agenda { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: .12rem; min-inline-size: 48px; min-block-size: 44px; padding: .3rem .35rem; border: 0; border-radius: var(--r-md);
  background: none; color: var(--blue-text); font: 600 var(--fs-1)/1.15 var(--f-body); cursor: pointer; transition: background-color .2s; }
.bt-agenda:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.bt-agenda:active { transform: scale(.95); }
.billet.live .bt-agenda { color: var(--good); }
.bt-jour { font: 600 var(--fs-1)/1.25 var(--f-body); text-transform: capitalize; }
.bt-num { font: 750 2rem/1.02 var(--f-display); letter-spacing: -.02em; color: var(--ink); font-variant-numeric: tabular-nums; }
.bt-mois { font: 600 var(--fs-2)/1.25 var(--f-body); }
.bt-heure { margin-top: .45rem; padding: .16rem .5rem; border-radius: var(--r-pill); background: var(--surface); color: var(--ink); font-weight: 650; font-size: var(--fs-2); box-shadow: var(--sh1); }
.billet-corps { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .5rem; padding-block: .85rem .9rem; padding-inline: .95rem .8rem; }
.billet-qui { display: flex; align-items: flex-start; gap: .3rem; min-width: 0; }
.billet-qui > .person { flex: 1 1 auto; min-width: 0; }
/* Sur le billet, la promo et l'entreprise se lisent en entier (deux lignes s'il le faut, jamais « Renault Grou… ») */
.billet-qui .role-line { display: block; }
.billet-qui > .m-more { margin: -.25rem -.35rem 0 0; }
[dir="rtl"] .billet-qui > .m-more { margin: -.25rem 0 0 -.35rem; }
.billet .mreq-subject { margin: 0; font-size: var(--fs-4); line-height: 1.4; }
.billet .mreq-subject strong { font-weight: 650; }
.billet-quand { display: flex; align-items: center; flex-wrap: wrap; gap: .35rem .6rem; margin: 0; }
.m-rebours { display: inline-flex; align-items: center; gap: .35rem; padding: .28rem .65rem; border-radius: var(--r-pill); background: var(--accent-soft); color: var(--blue-text); font-weight: 650; font-size: var(--fs-2); line-height: 1.3; white-space: nowrap; }
.m-rebours.live { background: var(--good-soft); color: var(--good); }
.billet-duree { color: var(--muted); font-size: var(--fs-2); }
/* Le bas du billet, après la ligne pointillée : ce qu'il y a à faire */
.billet-bas { display: flex; flex-direction: column; gap: .7rem; padding: .85rem .95rem .95rem; border-top: 2px dashed color-mix(in srgb, var(--accent) 22%, transparent); }
.billet-bas > p { margin: 0; }
.billet-mot { color: var(--ink-2); }
.billet-acts { display: flex; align-items: center; flex-wrap: wrap; gap: .4rem .9rem; }
.billet-acts .rdv-join { min-height: 44px; padding-inline: 1.1rem; }
.billet-acts > .m-info { margin-inline-start: -.3rem; }
.billet-prep { flex: 1 1 100%; }
@media (max-width: 480px) { .billet-acts .rdv-join { flex: 1 1 auto; justify-content: center; } }
/* C'est l'heure : le talon passe au vert, la visio est l'action pleine */
.billet.live { box-shadow: 0 0 0 2px color-mix(in srgb, var(--good) 55%, transparent), var(--sh2); }
.billet.live .billet-talon { background: color-mix(in srgb, var(--good) 12%, var(--surface)); color: var(--good); border-inline-end-color: color-mix(in srgb, var(--good) 34%, transparent); }
.icon-btn.m-info { position: relative; width: 32px; height: 32px; flex: none; border-radius: 50%; color: var(--ink-2); }
.icon-btn.m-info::before { content: ""; position: absolute; inset: -6px; }
.icon-btn.m-info[aria-expanded="true"] { background: var(--surface-2); color: var(--accent); }
.rdv-tip { display: flex; align-items: baseline; gap: var(--sp-3); margin: 0; color: var(--ink-2); }
.rdv-tip > span { flex: 1; }
.rdv-tip .linkish { flex: none; }
/* Ajouter à mon agenda : une feuille, deux choix */
.m-agenda .m-agenda-quoi { display: flex; flex-direction: column; gap: .15rem; margin: 0 0 .9rem; }
.m-agenda-choix { display: flex; flex-direction: column; gap: .5rem; }
.m-agenda-choix .btn { justify-content: center; min-height: 48px; }
.m-agenda .modal-body > p.small { margin: .8rem 0 0; }
/* Dans « Ajouter à mon agenda » des discussions (messages.js) */
.rdv-cal > summary { list-style: none; cursor: pointer; }
.rdv-cal > summary::-webkit-details-marker { display: none; }
.rdv-cal-body { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-2); }
.rdv-cal-body > p { flex-basis: 100%; margin: 0; }

/* ---- « Disponible pour aider » : un interrupteur, et ce qu'il change ---- */
.m-dispo { display: flex; align-items: center; gap: .75rem; padding: .6rem .45rem .6rem .9rem; border-radius: var(--r-lg); background: var(--surface); box-shadow: var(--sh1); min-width: 0; }
[dir="rtl"] .m-dispo { padding: .6rem .9rem .6rem .45rem; }
.m-dispo-point { position: relative; flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--line-strong); transition: background-color .25s; }
.m-dispo.on .m-dispo-point { background: var(--good); }
.m-dispo-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .1rem; line-height: 1.35; }
.m-dispo-txt > label { font-weight: 650; color: var(--ink); cursor: pointer; }
.m-dispo-txt > .small { color: var(--ink-2); }
.m-dispo.on .m-dispo-txt > .small { color: var(--good); }
/* Elle vient de se rendre disponible : le point envoie une onde, une seule fois */
@media (prefers-reduced-motion: no-preference) {
  .m-dispo.vient .m-dispo-point::after { content: ""; position: absolute; inset: 0; border-radius: 50%; box-shadow: 0 0 0 2px var(--good); animation: m-onde .4s ease-out 1 forwards; }
}
@keyframes m-onde { from { opacity: .8; transform: scale(1); } to { opacity: 0; transform: scale(2.6); } }

/* ---- Besoin d'un conseil : cinq tuiles aux couleurs douces ---- */
.need-tuiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .55rem; }
.need-tuile { --t: var(--accent); position: relative; display: flex; align-items: center; gap: .7rem; min-height: 64px; padding: .7rem .8rem; border: 0; border-radius: var(--r-lg);
  background: color-mix(in srgb, var(--t) 8%, var(--surface)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--t) 16%, transparent);
  color: var(--ink); font: inherit; text-align: start; cursor: pointer; transition: background-color .2s, transform .2s var(--ease), box-shadow .2s; -webkit-tap-highlight-color: transparent; }
.need-tuile:last-child:nth-child(odd) { grid-column: 1 / -1; }
.need-tuile:hover { background: color-mix(in srgb, var(--t) 13%, var(--surface)); }
.need-tuile:active { transform: scale(.97); transition-duration: .08s; }
.nt-cv { --t: var(--accent); } .nt-stage { --t: var(--orange); } .nt-entretien { --t: var(--teal); } .nt-etranger { --t: var(--indigo); } .nt-carriere { --t: var(--navy); }
.nt-ico { flex: none; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; background: color-mix(in srgb, var(--t) 16%, var(--surface)); color: color-mix(in srgb, var(--t) 82%, var(--ink)); transition: transform .25s var(--ease); }
.need-tuile:hover .nt-ico { transform: translateY(-2px); }
.nt-txt { display: flex; flex-direction: column; gap: .1rem; min-width: 0; }
.nt-txt strong { font-weight: 650; font-size: var(--fs-3); line-height: 1.25; }
@media (max-width: 380px) { .need-tuile { gap: .55rem; padding: .65rem .65rem; } .nt-ico { width: 34px; height: 34px; border-radius: 10px; } .nt-txt strong { font-size: .95rem; } }
.nt-sous { display: none; color: var(--ink-2); font-size: var(--fs-2); line-height: 1.35; }
@media (min-width: 761px) {
  .need-tuiles { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .need-tuile:last-child:nth-child(odd) { grid-column: auto; }
  .need-tuile { flex-direction: column; align-items: flex-start; gap: .55rem; min-height: 0; padding: .9rem .9rem 1rem; }
  .nt-sous { display: block; }
}

/* ---- Des lauréats qui peuvent t'aider : cartes compactes ---- */
/* Les cartes d'une rangée ont toutes la même hauteur : « Lui demander » s'aligne d'une carte à l'autre */
.m-mentors .rangee-cartes { --rangee-l: min(84%, 19rem); }
.mcard.m-mentor { gap: .55rem; padding: .95rem 1rem 1rem; height: 100%; }
.m-mentor > .person { align-self: stretch; }
.m-mentor .role-line { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mm-poste { display: flex; align-items: center; gap: .35rem; margin: 0; color: var(--ink-2); font-size: var(--fs-2); min-width: 0; align-self: stretch; }
.mm-poste > svg { flex: none; color: var(--muted); }
.mm-poste > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mm-sceaux { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem; margin: 0; }
.mm-sceaux .mini { margin: 0; }
.m-sceau { display: inline-flex; align-items: center; gap: .3rem; padding-block: .18rem; padding-inline: .4rem .55rem; border-radius: var(--r-pill); background: var(--good-soft); color: var(--good); font-size: var(--fs-1); font-weight: 650; line-height: 1.35; }
.m-sceau > svg { flex: none; }
.m-mentor .mcard-merci { margin: .1rem 0 0; padding: .1rem 0 .1rem .75rem; align-self: stretch; gap: .35rem; }
[dir="rtl"] .m-mentor .mcard-merci { padding: .1rem .75rem .1rem 0; }
.m-mentor .mcard-merci p { font-size: var(--fs-3); line-height: 1.45; }
.m-mentor .mcard-merci p.ouvert { display: block; }
.m-mentor .m-repli-btn { margin-top: -.2rem; }
.m-mentor .merci-duo .md-quand { flex-basis: auto; }
.m-mentor .merci-duo .md-quand::before { content: "· "; }
.m-insec { white-space: nowrap; }
.mm-pied { margin-top: auto; align-self: stretch; display: flex; padding-top: .25rem; }
.mm-pied .btn { flex: 1; justify-content: center; min-height: 44px; }

/* ---- L'historique : une ligne par mentorat ---- */
.m-histo { display: flex; flex-direction: column; gap: .5rem; min-width: 0; }
.past-toggle { min-height: 40px; }
.m-histo-liste { list-style: none; margin: 0; padding: .2rem .9rem; border-radius: var(--r-lg); background: var(--surface); box-shadow: var(--sh1); animation: m-ouvre .22s var(--ease) backwards; }
.m-histo-ligne { display: flex; align-items: flex-start; gap: .7rem; padding: .7rem 0; min-width: 0; }
.m-histo-ligne + .m-histo-ligne { border-top: 1px solid var(--line); }
.mh-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .15rem; }
.mh-l1 { display: flex; align-items: center; gap: .5rem; min-width: 0; }
.mh-sujet { flex: 1; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mh-l1 > .state-pill { flex: none; }
.mh-merci { flex-wrap: nowrap; min-width: 0; }
.mh-merci-txt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mh-reprendre { align-self: flex-start; min-height: 36px; }
.m-aussi .linkish { min-height: 40px; }

/* Mode d'emploi replié */
.m-how { align-self: flex-start; max-width: 100%; }
.m-how > summary { display: inline-flex; align-items: center; gap: .4rem; min-height: 40px; cursor: pointer; list-style: none; color: var(--ink-2); font-weight: 600; font-size: var(--fs-2); padding: .35rem 0; border-radius: var(--r-sm); }
.m-how > summary::-webkit-details-marker { display: none; }
/* « i » rond avant, chevron après : dessinés en CSS pour servir aussi au volet « Relecture de CV » */
.m-how > summary::before { content: "i"; display: inline-grid; place-items: center; width: 16px; height: 16px; border: 1.6px solid currentColor; border-radius: 50%; font: 700 10px/1 var(--f-body); }
.m-how > summary::after { content: ""; width: 6px; height: 6px; margin-inline-start: .15rem; border: solid currentColor; border-width: 0 1.6px 1.6px 0; transform: translateY(-2px) rotate(45deg); transition: transform .2s var(--ease); }
.m-how[open] > summary::after { transform: translateY(1px) rotate(-135deg); }
.m-how > summary:hover { color: var(--accent); }
.m-how[open] > summary { margin-bottom: var(--sp-2); }
.m-how[open] > .how, .m-more-pop, .m-after-non, .rdv-tip, .rdv-cal-body { animation: m-ouvre .22s var(--ease) backwards; }
@keyframes m-ouvre { from { opacity: 0; transform: translateY(-4px); } }

/* Horaires à choisir : deux par ligne sur téléphone */
@media (max-width: 420px) {
  .tchoice .chips { gap: .35rem; }
  .tchoice .chip { padding: .38rem .6rem; font-size: .82rem; min-height: 38px; }
  .tchoice .chip .when { gap: .12rem; }
}

/* Menu « ⋯ » */
.m-more { display: inline-flex; flex: none; position: relative; }
.m-more-btn { width: 40px; height: 40px; border-radius: 50%; }
.m-more-btn:hover, .m-more-btn[aria-expanded="true"] { background: var(--surface-2); color: var(--ink); }
.m-more-pop { min-width: 200px; width: max-content; max-width: min(320px, calc(100vw - 48px)); }
.m-more-pop button { color: var(--ink); }
.m-more-pop button.m-danger { color: var(--bad); }

/* Après le rendez-vous : une question, une action */
.mreq .merci-box > p:first-child { flex-wrap: nowrap; align-items: flex-start; }
.mreq .merci-box > p:first-child > svg { flex: none; margin-top: .2em; color: var(--brass); }
.mreq.m-compact { gap: var(--sp-2); }
.m-after { display: flex; flex-direction: column; gap: var(--sp-2); padding-top: var(--sp-3); border-top: 1px dashed var(--line); }
.m-after-q { display: flex; align-items: baseline; gap: .3rem .6rem; flex-wrap: wrap; margin: 0; }
.m-after-acts { display: flex; align-items: center; gap: var(--sp-2) var(--sp-4); flex-wrap: wrap; }
.btn.m-done { background: var(--good-soft); border-color: color-mix(in srgb, var(--good) 35%, transparent); color: var(--good); }
.btn.m-done:hover { background: color-mix(in srgb, var(--good) 18%, var(--surface)); }
.m-after-non { display: flex; flex-direction: column; gap: var(--sp-2); padding-top: var(--sp-2); border-top: 1px solid var(--line); }
.m-after-non > p { margin: 0; }
.m-after-non > .linkish { align-self: flex-start; }
.linkish.m-quiet { color: var(--ink-2); font-weight: 500; text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor 35%, transparent); text-underline-offset: 3px; }
.linkish.m-quiet:hover { color: var(--ink); }

/* Une demande de conseil ouverte sur place (feuille) */
.hn-card { display: flex; flex-direction: column; gap: var(--sp-2); min-width: 0; }
.hn-card > .person { align-self: flex-start; }
.hn-card > p { margin: 0; }
.hn-card .tchoice > p { color: var(--ink-2); }

/* Accueil (lauréat) : « Ils ont besoin de toi », trois lignes au plus */
.besoins { display: flex; flex-direction: column; gap: var(--sp-2); min-width: 0; }
.besoins > .section-head { margin: 0; }
.bs-tout { min-height: 40px; }
.bs-liste { list-style: none; margin: 0; padding: var(--sp-1); background: var(--surface); border: 0; box-shadow: var(--sh1); border-radius: var(--r-lg); }
.modal .bs-liste { border: 0; padding: 0; background: none; }
.bs-liste li + li { border-top: 1px solid var(--line); }
.bs-ligne { display: flex; align-items: flex-start; gap: var(--sp-3); width: 100%; min-height: 56px; padding: var(--sp-3) var(--sp-2); border: 0; background: none; border-radius: var(--r-md); color: var(--ink); font: inherit; text-align: start; cursor: pointer; }
.bs-ligne:hover { background: var(--surface-2); }
.bs-txt { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.bs-l1 { display: flex; align-items: center; gap: var(--sp-2); min-width: 0; }
.bs-nom { font-weight: 650; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bs-verbe { margin-inline-start: auto; flex: none; display: inline-flex; align-items: center; gap: .25rem; color: var(--accent); font-size: var(--fs-2); font-weight: 600; white-space: nowrap; }
.bs-quoi { color: var(--ink-2); font-size: var(--fs-2); line-height: 1.35; }
.bs-sujet { color: var(--muted); font-size: var(--fs-2); line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Accueil (étudiant) : « Besoin d'un coup de main ? », une seule carte */
.coup-de-main { display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-4); border-radius: var(--r-lg); background: var(--surface); border: 0; box-shadow: var(--sh1); min-width: 0; }
.cm-head { display: flex; align-items: flex-start; gap: var(--sp-3); }
.cm-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cm-titre { margin: 0; font-size: var(--fs-3, 1rem); font-weight: 650; }
.cm-acts .btn { min-height: 44px; }
.cm-ou { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: .15rem .4rem; }
.cm-ou .linkish { min-height: 40px; text-align: start; }
.cm-suivi { display: flex; align-items: center; gap: var(--sp-2); width: 100%; min-height: 44px; padding: var(--sp-2) var(--sp-3); border: 0; border-radius: var(--r-md); background: var(--surface-2); color: var(--ink); font: inherit; text-align: start; cursor: pointer; }
.cm-suivi-txt { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

@media (prefers-reduced-motion: reduce) {
  @keyframes m-ouvre { from { opacity: 0; } }
  .m-how > summary::after, .need-tuile, .nt-ico, .billet-talon { transition: none; }
  .need-tuile:hover .nt-ico { transform: none; }
}
`);

// ---------------------------------------------------------------------------
// Arabe : les nouveaux textes de cette page
// ---------------------------------------------------------------------------
const JOURS_AR = { dimanche: 'الأحد', lundi: 'الإثنين', mardi: 'الثلاثاء', mercredi: 'الأربعاء', jeudi: 'الخميس', vendredi: 'الجمعة', samedi: 'السبت' };
// « demain à 18:30 » → « غدًا على الساعة 18:30 » (les mois sont traduits ensuite par i18n.js)
const quandAR = q => {
  const x = /^(.+) à (\d\d:\d\d)$/.exec(q);
  if (!x) return q;
  const j = x[1] === 'aujourd’hui' ? 'اليوم' : x[1] === 'demain' ? 'غدًا' : x[1].replace(/^\S+/, d => JOURS_AR[d] || d);
  return `${j} على الساعة ${x[2]}`;
};
addAR({
  'Ton prochain rendez-vous': 'موعدك القادم',
  'Aussi en cours': 'جارٍ أيضًا',
  'En cours': 'قيد الإنجاز',
  'Rendez-vous passé': 'موعد مضى',
  'En ce moment': 'الآن',
  'Besoin d’un autre conseil ?': 'تحتاج نصيحة أخرى؟',
  'Choisis l’étudiant que tu peux aider, à ton rythme. Les autres lauréats s’occupent du reste.': 'اختر الطالب الذي يمكنك مساعدته، على راحتك. يتكفّل باقي الخريجين بالبقية.',
  'Les étudiants ne te voient pas encore : rends-toi disponible, ils pourront te proposer leurs horaires directement.': 'لا يراك الطلبة بعد: فعّل توفرك ليقترحوا عليك توقيتاتهم مباشرة.',
  'On te prévient dès qu’un étudiant demande de l’aide.': 'سيصلك إشعار بمجرد أن يطلب طالب المساعدة.',
  'Ils aimeraient ton avis': 'يودّون رأيك',
  'En attente d’un horaire': 'في انتظار توقيت',
  'Horaires proposés': 'تم اقتراح التوقيتات',
  'Personne n’attend d’horaire': 'لا أحد في انتظار توقيت',
  'Chaque étudiant a trouvé un lauréat.': 'وجد كل طالب خريجًا.',
  'Voir les autres étudiants': 'عرض الطلبة الآخرين',
  'Retirer tes horaires ? Les lauréats ne les verront plus.': 'سحب توقيتاتك؟ لن يراها الخريجون بعد الآن.',
  'Retirer': 'سحب',
  'Retirer mes horaires': 'سحب توقيتاتي',
  'Retirer ces horaires': 'سحب هذه التوقيتات',
  'C’est retiré.': 'تم السحب.',
  'C’est masqué : tu ne le reverras plus dans ta liste.': 'تم الإخفاء: لن يظهر في قائمتك بعد الآن.',
  'Tu n’es pas disponible ? Ses horaires seront proposés aux autres lauréats.': 'الوقت لا يناسبك؟ ستُعرض التوقيتات المقترحة على باقي الخريجين.',
  'Horaires proposés aux autres lauréats.': 'عُرضت التوقيتات على باقي الخريجين.',
  'Horaires envoyés aux lauréats.': 'أُرسلت توقيتاتك إلى الخريجين.',
  'Horaires envoyés aux lauréats. On te prévient dès qu’un horaire est choisi.': 'أُرسلت توقيتاتك إلى الخريجين. سيصلك إشعار بمجرد اختيار توقيت.',
  'Proposer d’autres horaires': 'اقتراح توقيتات أخرى',
  'Rendez-vous fixé ! On prévient l’étudiant.': 'تم تحديد الموعد! سيصل إشعار إلى الطالب.',
  'Rendez-vous déplacé. On prévient l’étudiant.': 'تم تغيير الموعد. سيصل إشعار إلى الطالب.',
  'Annuler le rendez-vous ? On prévient le lauréat.': 'إلغاء الموعد؟ سيصل إشعار إلى الخريج.',
  'Mentorat terminé.': 'انتهى الإرشاد.',
  'Tout est calme pour l’instant': 'كل شيء هادئ حاليًا',
  'Rends-toi disponible : les étudiants de ton parcours pourront te demander conseil directement.': 'فعّل توفرك: سيتمكن طلبة مسارك من طلب النصح منك مباشرة.',
  'Pas cette fois': 'ليس هذه المرة',
  'Ajouter à mon agenda': 'إضافة إلى أجندتي',
  'Plus d’options': 'خيارات أخرى',
  'Astuce Jitsi': 'نصيحة حول Jitsi',
  'Compris': 'فهمت',
  'Il n’a pas eu lieu': 'لم يتم',
  'Pas de souci, ça arrive. Propose un autre moment, ou clôture sans rendez-vous.': 'لا بأس، هذا يحدث. اقترح موعدًا آخر، أو أنهِ دون موعد.',
  'Clôturer sans rendez-vous': 'إغلاق دون موعد',
  'C’est noté.': 'تم التسجيل.',
  'Une salle de visio est créée automatiquement.': 'تُنشأ غرفة الاتصال المرئي تلقائيًا.',
  'Rendez-vous fixé !': 'تم تحديد الموعد!',
  'Merci pour ce mentorat !': 'شكرًا على هذا الإرشاد!',
  'Voir mes mercis': 'عرض رسائل الشكر',
  'Tu seras là ?': 'هل ستحضر؟',
  'Je serai là': 'سأحضر',
  'Je ne peux pas': 'لا أستطيع',
  'Tu as confirmé ta présence.': 'لقد أكّدت حضورك.',
  'L’échange est terminé ?': 'هل انتهى اللقاء؟',
  'C’est fait': 'تمّ',
  'Pas disponible cette fois': 'لا يناسبني الوقت هذه المرة',
  'Ignorer': 'تجاهل',
  'Tes rendez-vous': 'مواعيدك',
  'Suivi de l’école': 'متابعة المدرسة',
  'Rendez-vous à venir': 'المواعيد القادمة',
  'Ton rendez-vous est fixé': 'تم تحديد موعدك',
  'Confirmer ma présence': 'تأكيد حضوري',
  'Présence confirmée': 'الحضور مؤكَّد',
  'Te demande un conseil': 'بحاجة إلى نصيحتك',
  'Cherche un conseil': 'بحث عن نصيحة',
  'Te demande de relire son CV': 'بحاجة إلى مراجعتك للسيرة الذاتية',
  'Attend une relecture de CV': 'في انتظار مراجعة السيرة الذاتية',
  'Cherche un stage': 'بحث عن تدريب',
  'Cherche un PFE': 'بحث عن مشروع نهاية الدراسة',
  'Cherche un stage à l’étranger': 'بحث عن تدريب في الخارج',
  'Cherche un emploi': 'بحث عن عمل',
  'Relire': 'مراجعة',
  'Un membre': 'عضو',
  'Un lauréat': 'خريج',
  'Besoin d’un coup de main ?': 'تحتاج إلى مساعدة؟',
  'Dis aux lauréats ce que tu cherches : ta demande et ton CV arrivent chez ceux de ton parcours.': 'قل للخريجين ما تبحث عنه: يصل طلبك وسيرتك الذاتية إلى خريجي مسارك.',
  'CV, stage, entretien, étranger : un lauréat te parle 20 minutes en visio.': 'السيرة الذاتية، التدريب، المقابلة، الخارج: يتحدث معك خريج 20 دقيقة عبر اتصال مرئي.',
  'Faire relire mon CV': 'مراجعة سيرتي الذاتية',
  'Un lauréat relit ton CV et te laisse ses conseils, rubrique par rubrique.': 'يراجع خريج سيرتك الذاتية ويترك لك نصائحه، قسمًا بقسم.',
  'Ou': 'أو',
  'Plus besoin d’horaire ici': 'لم يعد هذا بحاجة إلى توقيت',
  'Un autre lauréat a choisi un horaire, ou l’étudiant a retiré les siens. Merci d’avoir voulu aider !': 'اختار خريج آخر توقيتًا، أو سُحبت التوقيتات. شكرًا على رغبتك في المساعدة!',
  // Le talon du billet : le jour en entier (l'arabe n'abrège pas les jours)
  'dim.': 'الأحد', 'lun.': 'الإثنين', 'mar.': 'الثلاثاء', 'mer.': 'الأربعاء', 'jeu.': 'الخميس', 'ven.': 'الجمعة', 'sam.': 'السبت',
  'Les étudiants de ton parcours peuvent te proposer leurs horaires.': 'يمكن لطلبة مسارك أن يقترحوا عليك توقيتاتهم.',
  'Les étudiants ne te voient pas encore.': 'لا يراك الطلبة بعد.',
  'Un regard neuf avant d’envoyer': 'نظرة جديدة قبل الإرسال',
  'Où chercher, comment postuler': 'أين تبحث وكيف تترشح',
  'S’entraîner avec un lauréat': 'التدرّب مع خريج',
  'Les étapes, pas à pas': 'الخطوات، خطوة بخطوة',
  'Choisir sa voie, sereinement': 'اختيار طريقك بهدوء',
  'Ou choisis toi-même à qui demander': 'أو اختر بنفسك من تسأل',
  '1 lauréat disponible': 'خريج واحد متاح',
}, [
  [/^Demander conseil à (.+), ton parrain$/, n => `اطلب نصيحة من ${n}، عرّابك`],
  [/^(.+) attend une relecture de son CV\.$/, n => `سيرة ${n} الذاتية في انتظار المراجعة.`],
  [/^Confirme pour rassurer (.+)\.$/, n => `أكّد حضورك لطمأنة ${n}.`],
  [/^(.+) a confirmé sa présence\.$/, n => `تأكيد الحضور من ${n}.`],
  [/^(.+) a confirmé sa présence : (.+)$/, (n, x) => `تأكيد الحضور من ${n}: ${x}`],
  [/^(.+) n’a pas encore confirmé\.$/, n => `${n} لم يؤكّد حضوره بعد.`],
  [/^C’est confirmé\. On prévient (.+)\.$/, n => `تم التأكيد. سيصل إشعار إلى ${n}.`],
  [/^(.+) a fixé ton rendez-vous\. Confirme ta présence : (.+)$/, (n, x) => `موعدك محدَّد مع ${n}. أكّد حضورك: ${x}`],
  [/^Dans (\d+) min$/, n => `بعد ${arCount(n, ['دقيقة واحدة', 'دقيقتين', 'دقائق', 'دقيقة'])}`],
  [/^Dans (\d+) jours$/, n => `بعد ${arCount(n, ['يوم واحد', 'يومين', 'أيام', 'يومًا'])}`],
  [/^Dans (\d+) h$/, n => `بعد ${arCount(n, ['ساعة واحدة', 'ساعتين', 'ساعات', 'ساعة'])}`],
  // « Dans 2 h 05 » : en toutes lettres, « بعد ساعتين و5 دقائق » (pas d'abréviation en arabe)
  [/^Dans (\d+) h (\d\d)$/, (h, m) => `بعد ${arCount(h, ['ساعة واحدة', 'ساعتين', 'ساعات', 'ساعة'])} و${arCount(+m, ['دقيقة واحدة', 'دقيقتين', 'دقائق', 'دقيقة'])}`],
  [/^(\d+) lauréats disponibles$/, n => arCount(n, ['خريج واحد متاح', 'خريجان متاحان', 'خريجين متاحين', 'خريجًا متاحًا'])],
  [/^Voir les autres étudiants \((\d+)\)$/, n => `عرض الطلبة الآخرين (${n})`],
  [/^Horaires envoyés à (.+?)\.$/, n => `أُرسلت توقيتاتك إلى ${n}.`],
  [/^Horaires envoyés à (.+?)\. On te prévient dès qu’un horaire est choisi\.$/, n => `أُرسلت توقيتاتك إلى ${n}. سيصلك إشعار بمجرد اختيار توقيت.`],
  [/^Annuler le rendez-vous \? On prévient (.+)\.$/, n => `إلغاء الموعد؟ سيصل إشعار إلى ${n}.`],
  [/^Google Agenda ajoute (.+?) à l’événement : enregistre-le puis choisis « Envoyer » pour lui envoyer l’invitation par email\.$/, n => `يضيف تقويم Google ${n} إلى الحدث: احفظه ثم اختر «إرسال» لإرسال الدعوة بالبريد الإلكتروني.`],
  [/^Retirer « (.+) » \? Ces horaires ne seront plus proposés aux lauréats\.$/, s => `سحب «${s}»؟ لن تُعرض هذه التوقيتات على الخريجين بعد الآن.`],
  [/^Écrire à (.+)$/, n => `مراسلة ${n}`],
  [/^(.+) a accepté !$/, n => `موعدك مع ${n} مؤكَّد!`],
  [/^(.+) reçoit l’invitation pour (.+)\. Merci de lui ouvrir ta porte !$/, (n, q) => `أُرسلت الدعوة إلى ${n}: ${quandAR(q)}. شكرًا لأنك تفتح بابك!`],
  [/^Rendez-vous (.+), (\d+) min en visio\. Note deux ou trois questions : c’est tout ce qu’il faut\.$/, (q, d) => `الموعد ${quandAR(q)}، ${d} دقيقة عبر الفيديو. دوّن سؤالين أو ثلاثة: هذا كل ما تحتاجه.`],
  [/^Grâce à tes (\d+) minutes, (.+) avance plus sereinement\.$/, (d, n) => `بفضل ${d} دقيقة من وقتك، صار طريق ${n} أوضح.`],
]);
