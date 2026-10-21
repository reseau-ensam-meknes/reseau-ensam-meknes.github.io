// Mentorat en 3 étapes, sur une seule page : l'étudiant dit ce dont il a besoin et propose ses horaires,
// un lauréat clique sur un horaire, la visio et l'invitation d'agenda sont prêtes. Après l'échange : un merci.
// Ce qui compte d'abord : le prochain rendez-vous en haut, le mode d'emploi seulement pour qui découvre.
import { html, useState, useEffect, useRef } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Avatar, toast, celebrate, useLocal, injectCSS } from './ui.js';
import { BESOINS, RDV_MIN, mentorState, futureSlots, requestsFor, mentorsFor, timeAgo } from './logic.js';
import { getLang, addAR, arCount, t as tr } from './i18n.js';
import { RelecturesPage } from './cv.js';
import { MessageBtn } from './messages.js';
import { PoulsReseau } from './pouls.js';

const firstName = p => (p?.full_name || '').split(' ')[0];
const pad = n => String(n).padStart(2, '0');
const isHttps = u => /^https:\/\/\S+$/i.test(u || '');

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

// Compte à rebours doux : « Dans 25 min », « Demain · 18:30 », « Dans 3 jours »
function Countdown({ iso }) {
  const live = enDirect(iso);
  const min = Math.round((new Date(iso).getTime() - Date.now()) / 6e4);
  const w = slotWhen(iso);
  return html`<span class=${'m-countdown' + (live ? ' live' : '')}><${Icon} name=${live ? 'video' : 'clock'} size=${14}/>
    ${live ? 'En ce moment' : min > 0 && min < 60 ? `Dans ${min} min` : w.diff <= 1 ? html`<${When} iso=${iso}/>` : `Dans ${w.diff} jours`}</span>`;
}

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

function gcalUrl({ m, title, details, lien }, guest) {
  const start = new Date(m.rdv_at); const end = new Date(start.getTime() + RDV_MIN * 6e4);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${icsDate(start)}/${icsDate(end)}`, details, location: lien || '' });
  if (guest) q.set('add', guest);
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}

function icsHref({ m, title, details, lien }) {
  const esc = t => String(t).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, x => '\\' + x);
  const start = new Date(m.rdv_at); const end = new Date(start.getTime() + RDV_MIN * 6e4);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Reseau ENSAM Meknes//Mentorat//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${m.id}@reseau-ensam`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(details)}`, lien ? `LOCATION:${esc(lien)}` : null, lien ? `URL:${lien}` : null,
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

const STEPS = ['Demandé', 'Rendez-vous fixé', 'Terminé'];
function MStepper({ m }) {
  const st = mentorState(m);
  const done = st === 'terminee' ? 3 : ['rdv', 'apres'].includes(st) ? 2 : 1;
  return html`<ol class="stepper mstep">${STEPS.map((s, i) => html`<li class=${i < done ? 'done' : ''}><span class="step-dot">${i < done ? html`<${Icon} name="check" size=${13}/>` : i + 1}</span>${s}</li>`)}</ol>`;
}

const PILL = { ouverte: ['m-demande', 'Ouverte à tous les lauréats'], demande: ['m-demande', 'En attente'], rdv: ['m-acceptee', 'Rendez-vous fixé'], apres: ['m-acceptee', 'Rendez-vous passé'], terminee: ['m-terminee', 'Terminé'], annulee: ['m-refusee', 'Annulé'], refusee: ['m-refusee', 'Déclinée'] };

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

export function AskHelp({ ctx, mentor = null, besoin: b0 = '', onClose }) {
  const { store, me, act, go, scores, data } = ctx;
  const [besoin, setBesoin] = useState(b0 || '');
  const [sujet, setSujet] = useState('');
  const [msg, setMsg] = useState('');
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
      toast(to ? `Demande envoyée à ${firstName(target)}. Tu seras prévenu(e) dès qu’un horaire est choisi.` : 'Demande envoyée aux lauréats. Tu seras prévenu(e) dès qu’un horaire est choisi.', 'win');
      onClose(); go('mentorat');
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
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" disabled=${!ok}><${Icon} name="send" size=${16}/> Envoyer ma demande</button></div>
    </form>
  <//>`;
}

// ---------------------------------------------------------------------------
// Côté lauréat : choisir un horaire (ou un autre moment), avec son propre lien s'il le souhaite
// ---------------------------------------------------------------------------
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
    if (!premier) { toast('Rendez-vous déplacé. L’étudiant est prévenu.', 'win'); return; }
    // Premier rendez-vous fixé avec cet étudiant : un vrai moment, une seule fois
    const s = store.byId('profiles', m.student_id); const prenom = firstName(s);
    const fete = prenom && celebrate({
      cle: 'rdv-fixe-' + m.id, icon: 'calendar', titre: 'Rendez-vous fixé !',
      texte: `${prenom} reçoit l’invitation pour ${quand(at.toISOString())}. Merci de lui ouvrir ta porte !`,
      action: store.peutDiscuter?.(m.student_id) ? { label: `Écrire à ${prenom}`, icon: 'chat', onClick: () => ctx.ecrire(m.student_id) } : null,
    });
    if (!fete) toast('Rendez-vous fixé ! L’étudiant est prévenu. +10 points', 'win');
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
// Le rendez-vous : une action claire (rejoindre), l'agenda à la demande, le reste dans « ⋯ »
// ---------------------------------------------------------------------------
function RdvBox({ ctx, m, side, focus }) {
  const { store, act } = ctx;
  const lienRow = store.byId('liens_rdv', m.id);
  const lien = isHttps(lienRow?.lien) ? lienRow.lien : null;
  const other = store.byId('profiles', side === 'mentor' ? m.student_id : m.mentor_id);
  const [guest, setGuest] = useState(null);
  const [edit, setEdit] = useState(false);
  const [newLien, setNewLien] = useState('');
  // L'astuce Jitsi s'affiche d'elle-même une seule fois (sur le prochain rendez-vous), puis derrière le petit « i »
  const jitsi = side === 'mentor' && !!lien && lien.includes('meet.jit.si');
  const [astuceVue, setAstuceVue] = useLocal('ensam-astuce-jitsi', false);
  const [astuce, setAstuce] = useState(() => !!focus && !astuceVue);
  useEffect(() => { let on = true; if (side === 'mentor') Promise.resolve(store.emailRdv?.(m.id)).then(g => on && setGuest(g || null), () => {}); return () => { on = false; }; }, [m.id, m.status, side]);
  useEffect(() => { if (astuce && jitsi && !astuceVue) setAstuceVue(true); }, [astuce, jitsi]);
  if (!m.rdv_at) return side === 'mentor' ? html`<${TimeChoice} ctx=${ctx} m=${m}/>` : html`<p class="small muted">${firstName(other)} va fixer l’horaire du rendez-vous.</p>`;
  const live = enDirect(m.rdv_at);
  const txt = rdvTexts(m, store, lien);
  const saveLien = () => act(async () => {
    if (!isHttps(newLien.trim())) throw new Error('Le lien doit commencer par https://');
    await store.update('liens_rdv', m.id, { lien: newLien.trim() }); setNewLien(''); setEdit(false); toast('Lien enregistré.');
  });
  const annuler = () => ctx.confirm(side === 'mentor' ? `Annuler le rendez-vous ? ${firstName(other)} sera prévenu(e).` : 'Annuler le rendez-vous ? Le lauréat sera prévenu.', () => act(async () => { await store.update('mentorships', m.id, { status: 'annulee' }); toast('Rendez-vous annulé.'); }), 'Annuler le rendez-vous');
  const menu = [
    side === 'mentor' ? { label: 'Changer l’horaire ou le lien', icon: 'clock', onClick: () => setEdit(true) } : null,
    side !== 'admin' ? { label: 'Annuler le rendez-vous', icon: 'x', danger: true, onClick: annuler } : null,
  ].filter(Boolean);
  return html`<div class=${'rdv-box' + (live ? ' live' : '')}>
    <div class="rdv-top"><${SlotDate} iso=${m.rdv_at}/><span class="rdv-what"><strong>${live ? 'C’est le moment !' : `${RDV_MIN} min en visio`}</strong>
      ${lien ? html`<span class="rdv-link-row"><span class="small muted mono rdv-link" dir="ltr" translate="no">${lien.replace(/^https:\/\//, '')}</span>
        ${jitsi ? html`<button type="button" class="icon-btn m-info" aria-label="Astuce Jitsi" aria-expanded=${astuce} onClick=${() => setAstuce(!astuce)}><${Picto} name="info" size=${16}/></button>` : null}</span>`
        : html`<span class="small muted">Lien de visio en préparation…</span>`}</span>
      <${MoreMenu} items=${menu}/></div>
    <div class="rdv-actions">
      ${lien ? html`<a class=${'btn rdv-join' + (live || focus ? ' primary' : '')} href=${lien} target="_blank" rel="noopener"><${Icon} name="video" size=${16}/> Rejoindre la visio</a>` : null}
      <details class="rdv-cal"><summary class="btn ghost small"><${Icon} name="calendar" size=${15}/> Ajouter à mon agenda <${Picto} name="chev" size=${15}/></summary>
        <div class="rdv-cal-body">
          <a class="btn ghost small" href=${gcalUrl(txt, side === 'mentor' ? guest : null)} target="_blank" rel="noopener"><${Icon} name="calendar" size=${15}/> ${side === 'mentor' && guest ? 'Inviter via Google Agenda' : 'Ajouter à Google Agenda'}</a>
          <a class="btn ghost small" href=${icsHref(txt)} download="rendez-vous-ensam.ics"><${Icon} name="download" size=${15}/> Autre agenda (.ics)</a>
          ${side === 'mentor' && guest ? html`<p class="small muted">Google Agenda ajoute ${firstName(other)} comme invité(e) : enregistre l’événement puis choisis « Envoyer » pour lui envoyer l’invitation par email.</p>` : null}
        </div></details>
    </div>
    ${jitsi && astuce ? html`<p class="rdv-tip small"><span>Jitsi est gratuit. La première personne qui entre se connecte avec Google pour ouvrir la salle.</span><button type="button" class="linkish small" onClick=${() => setAstuce(false)}>Compris</button></p>` : null}
    ${edit ? html`<div class="rdv-edit"><${TimeChoice} ctx=${ctx} m=${{ ...m, creneaux: [] }} compact/>
      <div class="row"><input id=${'rdv-lien-' + m.id} class="grow" dir="ltr" value=${newLien} onInput=${e => setNewLien(e.target.value)} placeholder="Nouveau lien : https://meet.google.com/…"/><button class="btn small" disabled=${!newLien.trim()} onClick=${saveLien}>Enregistrer le lien</button></div>
      <div class="row"><span class="spacer"></span><button type="button" class="linkish small" onClick=${() => setEdit(false)}>Fermer</button></div></div>` : null}
  </div>`;
}

// Après le rendez-vous, côté étudiant : une note, un merci, et c'est terminé
function AfterBox({ ctx, m }) {
  const { store, act } = ctx;
  const mentor = store.byId('profiles', m.mentor_id);
  const [note, setNote] = useState(5); const [merci, setMerci] = useState('');
  return html`<form class="merci-box" onSubmit=${e => { e.preventDefault(); act(async () => { await store.update('mentorships', m.id, { status: 'terminee', note, merci: merci.trim() || null }); toast(merci.trim() ? 'Merci envoyé ! Il apparaît sur le mur des mercis.' : 'C’est noté, merci !', 'win'); }); }}>
    <p><${Icon} name="heart" size=${16}/> <strong>Comment s’est passé l’échange avec ${firstName(mentor)} ?</strong></p>
    <span class="stars" role="group" aria-label="Aide reçue">${[1, 2, 3, 4, 5].map(v => html`<button type="button" class=${v <= note ? 'on' : ''} aria-label=${v + ' sur 5'} onClick=${() => setNote(v)}>★</button>`)}</span>
    <textarea id=${'am-merci-' + m.id} rows="2" maxlength="800" placeholder="Un mot de remerciement…" value=${merci} onInput=${e => setMerci(e.target.value)}></textarea>
    <div class="row"><button type="button" class="linkish small m-quiet" onClick=${() => act(() => store.update('mentorships', m.id, { status: 'annulee' }))}>L’échange n’a pas eu lieu</button><span class="spacer"></span><button class="btn primary small">${merci.trim() ? 'Envoyer mon merci' : 'Terminer'}</button></div>
  </form>`;
}

// Après le rendez-vous, côté lauréat : une question, une action. S'il n'a pas eu lieu : un autre moment, ou on clôt.
function AfterMentor({ ctx, m }) {
  const { store, act, go } = ctx;
  const s = store.byId('profiles', m.student_id);
  const [non, setNon] = useState(false);
  const finir = () => act(async () => {
    await store.update('mentorships', m.id, { status: 'terminee' });
    const fete = firstName(s) && celebrate({
      cle: 'mentorat-fini-' + m.id, icon: 'heart', titre: 'Merci pour ce mentorat !',
      texte: `Grâce à tes ${RDV_MIN} minutes, ${firstName(s)} avance plus sereinement. +20 points d’impact.`,
      action: { label: 'Voir mes mercis', icon: 'heart', onClick: () => go('espace') },
    });
    if (!fete) toast('Mentorat terminé. +20 points', 'win');
  });
  return html`<div class="m-after">
    <p class="m-after-q"><strong>Le rendez-vous a eu lieu ?</strong> <span class="small muted"><${When} iso=${m.rdv_at}/></span></p>
    <div class="m-after-acts"><button type="button" class="btn small m-done" onClick=${finir}><${Icon} name="check" size=${15}/> Marquer comme terminé</button>
      <button type="button" class="linkish small m-quiet" aria-expanded=${non} onClick=${() => setNon(!non)}>Il n’a pas eu lieu</button></div>
    ${non ? html`<div class="m-after-non"><p class="small">Pas de souci, ça arrive. Propose un autre moment, ou clôture la demande.</p>
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
// Une demande, du début à la fin
// ---------------------------------------------------------------------------
export function RequestCard({ ctx, m, side, why = [], focus = false }) {
  const { store, act, openProfile } = ctx;
  const st = mentorState(m);
  const other = store.byId('profiles', side === 'student' ? m.mentor_id : m.student_id);
  const [reslot, setReslot] = useState(false);
  const slots = futureSlots(m);
  const [cls, label] = side === 'mentor' && st === 'demande' ? ['m-demande', 'Demande pour toi'] : PILL[st] || PILL.demande;
  const waiting = st === 'ouverte' || st === 'demande';
  const apres = st === 'apres';
  const annulerDemande = () => ctx.confirm('Annuler cette demande ?', () => act(() => store.update('mentorships', m.id, { status: 'annulee' })), 'Annuler la demande');
  return html`<article class=${'mreq st-' + st + (focus ? ' m-focus-card' : '') + (apres ? ' m-compact' : '')}>
    <div class="mrow-head">
      ${other ? html`<${Person} p=${other} onOpen=${openProfile} size=${36}/>` : html`<span class="open-to"><span class="open-ico"><${Icon} name="people" size=${18}/></span><span><strong>Tous les lauréats</strong><span class="small muted">Le premier disponible choisit un horaire</span></span></span>`}
      <span class="spacer"></span><span class=${'state-pill ' + cls}>${label}</span>${other ? html`<${MessageBtn} ctx=${ctx} p=${other} cls="btn tiny ghost"/>` : null}
      ${side === 'student' && waiting ? html`<${MoreMenu} items=${[{ label: 'Annuler la demande', icon: 'x', danger: true, onClick: annulerDemande }]}/>` : null}</div>
    <p class="mreq-subject"><${BesoinTag} k=${m.besoin}/><strong translate="no" dir="auto">${m.sujet}</strong>${waiting ? html` <span class="muted small m-ago">· ${timeAgo(m.created_at)}</span>` : null}</p>
    ${m.message && !apres ? html`<p class="quote" translate="no" dir="auto">${m.message}</p>` : null}
    ${why.length && waiting ? html`<p class="why"><span class="small muted">Pourquoi toi :</span> ${why.map(w => html`<span class="mini good">${w}</span>`)}</p>` : null}
    ${(side === 'student' && waiting) || st === 'terminee' ? html`<${MStepper} m=${m}/>` : null}
    ${m.reponse && side === 'student' && st !== 'ouverte' && !apres ? html`<p class="small"><span class="muted"><span translate="no">${firstName(other)}</span> :</span> <span translate="no" dir="auto">${m.reponse}</span></p>` : null}

    ${side === 'student' && waiting ? html`<div class="mreq-body">
      ${slots.length ? html`<p class="small muted">Tes horaires : ${slots.map(c => html`<span class="mini"><${When} iso=${c}/></span>`)}</p>` : html`<p class="small warn-t">Tes horaires sont passés. Propose-en d’autres pour qu’un lauréat puisse choisir.</p>`}
      ${reslot || !slots.length ? html`<${NewSlots} ctx=${ctx} m=${m} onDone=${() => setReslot(false)}/>` : null}
      <div class="row"><span class="small muted">${st === 'ouverte' ? 'En attente d’un lauréat…' : `En attente de ${firstName(other)}…`}</span><span class="spacer"></span>
        ${slots.length ? html`<button class="linkish small" onClick=${() => setReslot(!reslot)}>${reslot ? 'Fermer' : 'Changer mes horaires'}</button>` : null}</div>
    </div>` : null}

    ${side === 'mentor' && waiting ? html`<${TimeChoice} ctx=${ctx} m=${m}/>
      ${st === 'demande' ? html`<div class="row"><span class="spacer"></span><button class="linkish small m-quiet" onClick=${() => ctx.confirm('Tu n’es pas disponible ? La demande sera proposée aux autres lauréats.', () => act(async () => { await store.update('mentorships', m.id, { mentor_id: null }); toast('Demande proposée aux autres lauréats.'); }), 'Proposer aux autres')}>Pas cette fois</button></div>` : null}` : null}

    ${st === 'rdv' ? html`<${RdvBox} ctx=${ctx} m=${m} side=${side} focus=${focus}/>` : null}
    ${apres && side === 'student' ? html`<${AfterBox} ctx=${ctx} m=${m}/>` : null}
    ${apres && side === 'mentor' ? html`<${AfterMentor} ctx=${ctx} m=${m}/>` : null}
    ${st === 'terminee' && (m.merci || m.note) ? html`<p class="small merci-inline">${m.note ? html`<span class="stars-ro" aria-label=${m.note + ' sur 5'}>${'★'.repeat(m.note)}</span>` : null}${m.merci ? html`<${Icon} name="heart" size=${14}/> <span translate="no" dir="auto">${m.merci}</span>` : null}</p>` : null}
  </article>`;
}

// ---------------------------------------------------------------------------
// La page Mentorat
// ---------------------------------------------------------------------------
const ACTIVE = ['rdv', 'apres', 'ouverte', 'demande'];
const byRdv = (a, b) => new Date(a.rdv_at || a.created_at) - new Date(b.rdv_at || b.created_at);

// Deux volets : les rendez-vous en visio et la relecture de CV
function MentorSeg({ ctx }) {
  const { data, me, sub, go } = ctx;
  const cv = sub === 'cv';
  const R = data.relectures_cv || [];
  const aFaire = R.filter(r => (r.reviewer_id === me.id && ['demandee', 'en_cours'].includes(r.status)) || (r.student_id === me.id && r.status === 'rendue' && !r.merci && !r.note)).length;
  return html`<div class="seg mentor-seg" role="tablist" aria-label="Mentorat">
    <button role="tab" aria-selected=${!cv} class=${!cv ? 'on' : ''} onClick=${() => go('mentorat')}><${Icon} name="video" size=${15}/> Rendez-vous</button>
    <button role="tab" aria-selected=${cv} class=${cv ? 'on' : ''} onClick=${() => go('mentorat/cv')}><${Icon} name="file" size=${15}/> Relecture de CV${aFaire ? html` <span class="count">${aFaire}</span>` : null}</button></div>`;
}

// « Comment ça marche ? » replié, pour celles et ceux qui connaissent déjà
function HowMore({ role }) {
  return html`<details class="m-how"><summary>Comment ça marche ?</summary><${HowItWorks} role=${role}/></details>`;
}

// Une demande acceptée récemment (côté étudiant), pas encore fêtée
function acceptee(data, me) {
  return data.mentorships.filter(m => m.student_id === me.id && m.mentor_id && mentorState(m) === 'rdv' && m.rdv_at && (!m.accepted_at || Date.now() - new Date(m.accepted_at) < 7 * 864e5)).sort(byRdv)[0] || null;
}

export function MentoratPage(ctx) {
  const { data, me, store, act, scores, openProfile } = ctx;
  const [ask, setAsk] = useState(null); // { mentor, besoin }
  const [past, setPast] = useState(false);
  const [more, setMore] = useState(false);
  const isLaureat = me.role === 'laureat';
  const feter = me.role !== 'admin' && ctx.sub !== 'cv' ? acceptee(data, me) : null;
  // Un lauréat a accepté ma demande : on le fête une fois, avec une seule prochaine étape.
  // Elle arrive une seconde après la page (on voit d'abord son rendez-vous), et part avec elle si on s'en va.
  useEffect(() => {
    if (!feter) return;
    const mentor = store.byId('profiles', feter.mentor_id); const prenom = firstName(mentor);
    if (!prenom) return;
    const titre = `${prenom} a accepté !`;
    const h = setTimeout(() => celebrate({
      cle: 'rdv-accepte-' + feter.id, icon: 'calendar', titre,
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
  const need = isLaureat ? requestsFor(data, me, id => store.byId('profiles', id)) : [];
  const busy = new Set(mineActive.map(m => m.mentor_id));
  const reco = me.role === 'etudiant' ? mentorsFor(data, me, '', scores).filter(x => !busy.has(x.p.id)).slice(0, 3) : [];

  if (ctx.sub === 'cv') return html`<section class="page mentorat">
    <header class="page-head"><div><p class="eyebrow">${me.role === 'admin' ? 'Le suivi des relectures de CV' : isLaureat ? 'Relire le CV d’un étudiant, rubrique par rubrique' : 'Un lauréat relit ton CV et te conseille'}</p><h1>Mentorat</h1></div></header>
    <${MentorSeg} ctx=${ctx}/>
    <${RelecturesPage} ctx=${ctx}/>
  </section>`;

  if (me.role === 'admin') {
    const open = data.mentorships.filter(m => m.status === 'demande').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const soon = data.mentorships.filter(m => mentorState(m) === 'rdv');
    return html`<section class="page">
      <header class="page-head"><div><p class="eyebrow">${open.length} demande${open.length > 1 ? 's' : ''} en attente · ${soon.length} rendez-vous à venir</p><h1>Mentorat</h1></div></header>
      <${MentorSeg} ctx=${ctx}/>
      <${HowItWorks} role="etudiant"/>
      <div class="list">${open.length ? open.map(m => html`<${RequestCard} key=${m.id} ctx=${ctx} m=${m} side="admin"/>`) : html`<${Empty} icon="mentor" title="Aucune demande en attente">Toutes les demandes ont trouvé un lauréat.<//>`}</div>
    </section>`;
  }

  // Ce qui est en cours, d'abord : le prochain rendez-vous, puis le reste (rendez-vous passés à clore, demandes en attente)
  const role = isLaureat ? 'laureat' : 'etudiant';
  const nouveau = !data.mentorships.some(m => m.student_id === me.id || m.mentor_id === me.id);
  const actifs = [...mineActive.map(m => ({ m, side: 'student' })), ...rdvs.map(m => ({ m, side: 'mentor' }))];
  const next = actifs.filter(x => mentorState(x.m) === 'rdv').sort((a, b) => byRdv(a.m, b.m))[0] || null;
  const RANG = { apres: 0, rdv: 1, demande: 2, ouverte: 2 };
  const autres = actifs.filter(x => x !== next).sort((a, b) => RANG[mentorState(a.m)] - RANG[mentorState(b.m)] || byRdv(a.m, b.m));
  const titreAutres = next ? 'Aussi en cours' : autres.every(x => x.side === 'student') ? 'Mes demandes' : 'Mes rendez-vous';
  const hist = isLaureat ? done : minePast;

  return html`<section class="page mentorat">
    <header class="page-head"><div><p class="eyebrow">${isLaureat ? 'Aider un étudiant, en 20 minutes' : `Un lauréat, ${RDV_MIN} minutes, en visio`}</p><h1>Mentorat</h1></div>
      ${isLaureat ? html`<label class="switch"><input id="mentor-dispo" type="checkbox" checked=${!!me.mentor_dispo} onChange=${e => act(() => store.update('profiles', me.id, { mentor_dispo: e.target.checked }))}/> Disponible pour aider</label>` : null}</header>
    <${MentorSeg} ctx=${ctx}/>

    ${nouveau ? html`<${PoulsReseau} ctx=${ctx}/><${HowItWorks} role=${role}/>` : null}

    ${next ? html`<section class="m-section m-next" aria-labelledby="m-next-h">
      <div class="m-head"><h2 id="m-next-h" class="h-ico"><${Icon} name="video"/> Ton prochain rendez-vous</h2><${Countdown} iso=${next.m.rdv_at}/></div>
      <${RequestCard} key=${next.m.id} ctx=${ctx} m=${next.m} side=${next.side} focus/>
    </section>` : null}

    ${autres.length ? html`<section class="m-section">
      <div class="m-head"><h2>${titreAutres} <span class="count">${autres.length}</span></h2></div>
      <div class="list">${autres.map(({ m, side }) => html`<${RequestCard} key=${m.id} ctx=${ctx} m=${m} side=${side}/>`)}</div>
    </section>` : null}

    ${!nouveau ? html`<${PoulsReseau} ctx=${ctx}/>` : null}

    ${!isLaureat ? html`<div class="need-card">
      <h2>${mine.length ? 'Besoin d’un autre conseil ?' : 'De quoi as-tu besoin ?'}</h2>
      <div class="need-grid">${Object.entries(BESOINS).map(([k, v]) => html`<button class="need-btn" onClick=${() => setAsk({ besoin: k })}><span class="need-ico"><${Icon} name=${v.icon} size=${22}/></span><span>${v.label}</span></button>`)}</div>
    </div>` : null}

    ${isLaureat ? html`<section class="m-section">
      <div class="m-head"><h2 class="h-ico"><${Icon} name="heart"/> ${`Quand tu as ${RDV_MIN} minutes`}</h2></div>
      ${need.length ? html`<p class="small muted m-invite">Prends la demande qui te parle, à ton rythme. Les autres lauréats s’occupent du reste.</p>` : null}
      ${!me.mentor_dispo ? html`<p class="small muted">Active « Disponible pour aider » pour recevoir des demandes directes.</p>` : null}
      <div class="list">${need.length ? need.slice(0, more ? 12 : 2).map(({ m, why }) => html`<${RequestCard} key=${m.id} ctx=${ctx} m=${m} side="mentor" why=${why}/>`) : html`<${Empty} icon="mentor" title="Tout est calme pour l’instant">Tu seras prévenu(e) dès qu’un étudiant demande de l’aide.<//>`}</div>
      ${need.length > 2 ? html`<button class="linkish small past-toggle" onClick=${() => setMore(!more)}>${more ? 'Voir moins' : `Voir les autres demandes (${need.length - 2})`}</button>` : null}
    </section>` : null}

    ${!isLaureat && reco.length ? html`<div class="section-head"><h2>Des lauréats qui peuvent t’aider</h2><span class="muted small">Ou choisis toi-même</span></div>
      <div class="cards">${reco.map(({ p, why }) => html`<div class="mcard" key=${p.id}>
        <${Person} p=${p} score=${scores.get(p.id)} onOpen=${openProfile} size=${44}/>
        ${p.poste ? html`<p class="small"><${Icon} name="briefcase" size=${14}/> <span translate="no" dir="auto">${p.poste}${p.entreprise ? ' · ' + p.entreprise : ''}</span></p>` : null}
        ${p.mentor_sujets ? html`<p class="topics"><span class="muted small">Peut t’aider sur :</span> <span translate="no" dir="auto">${p.mentor_sujets}</span></p>` : null}
        <div class="row"><span class="why">${why.map(w => html`<span class="mini good">${w}</span>`)}</span><span class="spacer"></span><button class="btn small" onClick=${() => setAsk({ mentor: p })}>Lui demander</button></div>
      </div>`)}</div>` : null}

    ${hist.length ? html`<button class="linkish small past-toggle" onClick=${() => setPast(!past)}>${past ? 'Masquer l’historique' : `Voir l’historique (${hist.length})`}</button>
      ${past ? html`<div class="list">${hist.slice(0, 10).map(m => html`<${RequestCard} key=${m.id} ctx=${ctx} m=${m} side=${isLaureat ? 'mentor' : 'student'}/>`)}</div>` : null}` : null}

    ${isLaureat ? html`<p class="small muted center">Toi aussi, tu cherches un conseil ? <button class="linkish" onClick=${() => setAsk({})}>Demande à un lauréat plus expérimenté</button></p>` : null}
    ${!nouveau ? html`<${HowMore} role=${role}/>` : null}
    ${ask ? html`<${AskHelp} ctx=${ctx} mentor=${ask.mentor} besoin=${ask.besoin} onClose=${() => setAsk(null)}/>` : null}
  </section>`;
}

// ---------------------------------------------------------------------------
// Sur l'accueil : le prochain rendez-vous, et (lauréat) les demandes qui l'attendent
// ---------------------------------------------------------------------------
export function NextRdv({ ctx }) {
  const { data, me, store, go } = ctx;
  const next = data.mentorships.filter(m => (m.student_id === me.id || m.mentor_id === me.id) && mentorState(m) === 'rdv' && m.rdv_at).sort(byRdv)[0];
  if (!next) return null;
  const other = store.byId('profiles', next.mentor_id === me.id ? next.student_id : next.mentor_id);
  const lien = store.byId('liens_rdv', next.id)?.lien;
  const live = enDirect(next.rdv_at);
  return html`<div class=${'next-rdv' + (live ? ' live' : '')}>
    <${SlotDate} iso=${next.rdv_at}/>
    <span class="next-main"><span class="eyebrow"><${Icon} name="video" size=${13}/> Prochain rendez-vous</span><strong dir="auto" translate="no">${next.sujet}</strong><span class="small muted">Avec <span translate="no">${other?.full_name || ''}</span></span></span>
    <span class="next-act">${isHttps(lien) ? html`<a class=${'btn small' + (live ? ' primary' : '')} href=${lien} target="_blank" rel="noopener"><${Icon} name="video" size=${15}/> Rejoindre</a>` : null}
      <button class="btn small ghost" onClick=${() => go('mentorat')}>Détails</button></span>
  </div>`;
}

// Demandes qui attendent un lauréat.
//   max     : nombre de demandes affichées (2 par défaut)
//   compact : version légère pour l'accueil (qui, quel besoin, les horaires à accepter d'un geste,
//             puis « Voir les N autres demandes »). Sans ces options, l'affichage reste celui d'avant.
export function HelpNeeded({ ctx, max = 2, compact = false }) {
  const { data, me, store, go } = ctx;
  if (me.role !== 'laureat') return null;
  const all = requestsFor(data, me, id => store.byId('profiles', id));
  const need = all.filter(x => x.direct || x.score >= 2);
  if (!need.length) return null;
  if (compact) {
    const shown = need.slice(0, Math.max(1, max));
    const reste = all.length - shown.length;
    return html`<section class="help-needed hn-compact" aria-labelledby="hn-h">
      <div class="m-head"><h2 id="hn-h" class="h-ico"><${Icon} name="heart"/> ${`Quand tu as ${RDV_MIN} minutes`}</h2></div>
      ${shown.map(({ m }) => html`<article class="hn-card" key=${m.id}>
        <${Person} p=${store.byId('profiles', m.student_id)} onOpen=${ctx.openProfile} size=${36}/>
        <p class="mreq-subject"><${BesoinTag} k=${m.besoin}/><strong translate="no" dir="auto">${m.sujet}</strong></p>
        <${TimeChoice} ctx=${ctx} m=${m} compact/>
      </article>`)}
      ${reste > 0 ? html`<button type="button" class="linkish small hn-more" onClick=${() => go('mentorat')}>${reste > 1 ? `Voir les ${reste} autres demandes` : 'Voir l’autre demande'} <${Icon} name="arrow" size=${14}/></button>` : null}
    </section>`;
  }
  return html`<div class="help-needed">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="heart"/> Ces étudiants ont besoin de toi</h2>${need.length > max ? html`<button class="btn tiny ghost" onClick=${() => go('mentorat')}>Tout voir (${need.length}) <${Icon} name="arrow" size=${14}/></button>` : null}</div>
    <div class="list">${need.slice(0, max).map(({ m, why }) => html`<${RequestCard} key=${m.id} ctx=${ctx} m=${m} side="mentor" why=${why}/>`)}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Styles de la passe UX (après ceux de page.html, qu'ils complètent)
// ---------------------------------------------------------------------------
injectCSS('mentorat-ux', `
/* Sections : un titre, puis le contenu */
.m-section { display: flex; flex-direction: column; gap: var(--sp-3); min-width: 0; }
.m-head { display: flex; align-items: center; gap: var(--sp-2) var(--sp-3); flex-wrap: wrap; }
.m-head h2 { margin: 0; }
.m-invite { margin: calc(-1 * var(--sp-1)) 0 0; max-width: 60ch; }
.m-countdown { display: inline-flex; align-items: center; gap: .35rem; padding: .3rem .75rem; border-radius: var(--r-pill); background: var(--accent-soft); color: var(--accent); font-weight: 600; font-size: var(--fs-2); line-height: 1.3; white-space: nowrap; }
.m-countdown.live { background: var(--good-soft); color: var(--good); }
.m-countdown .when { gap: .25rem; }
.mreq.m-focus-card { box-shadow: var(--shadow-lift); border-color: color-mix(in srgb, var(--brass) 28%, var(--line)); border-inline-start-color: var(--brass); }

/* En-tête d'une demande : le nom garde sa ligne, l'état et « Écrire » passent dessous sur téléphone */
.mrow-head { flex-wrap: wrap; row-gap: var(--sp-2); }
.mrow-head > .person, .mrow-head > .open-to { flex: 0 1 auto; min-width: 0; }
.mrow-head .person-name { overflow-wrap: anywhere; }
@media (max-width: 480px) {
  .mrow-head > .person, .mrow-head > .open-to { flex: 1 1 100%; }
  .mrow-head > .spacer { display: none; }
  .mrow-head > .state-pill { margin-inline-start: calc(36px + .6rem); }
  .mrow-head > .msg-btn, .mrow-head > .state-pill + .m-more { margin-inline-start: auto; }
  .mstep, .mstep li { gap: .3rem; }
  .mstep li { font-size: .76rem; }
  .mstep li + li::before { width: 12px; }
  .mstep .step-dot { width: 18px; height: 18px; font-size: .68rem; }
}
/* Le sujet coule comme une phrase : « · il y a 2 j » suit le dernier mot au lieu de partir seul à la ligne */
.mreq-subject { display: block; line-height: 1.5; }
.mreq-subject > .mini.besoin { margin: 0; margin-inline-end: .45rem; vertical-align: .08em; }
.mreq-subject > .m-ago { white-space: nowrap; }
/* En arabe, un sujet écrit en français garde sa propre boîte (sinon ses lignes se croisent avec le texte arabe) */
[dir="rtl"] .mreq-subject { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem .45rem; }
[dir="rtl"] .mreq-subject > .mini.besoin { margin: 0; }
.mrow-head > .m-more { margin-inline-start: -.2rem; }

/* Mode d'emploi replié */
.m-how { align-self: flex-start; max-width: 100%; }
.m-how > summary { display: inline-flex; align-items: center; gap: .4rem; cursor: pointer; list-style: none; color: var(--ink-2); font-weight: 600; font-size: var(--fs-2); padding: .35rem 0; border-radius: var(--r-sm); }
.m-how > summary::-webkit-details-marker, .rdv-cal > summary::-webkit-details-marker { display: none; }
/* « i » rond avant, chevron après : dessinés en CSS pour servir aussi au volet « Relecture de CV » */
.m-how > summary::before { content: "i"; display: inline-grid; place-items: center; width: 16px; height: 16px; border: 1.6px solid currentColor; border-radius: 50%; font: 700 10px/1 var(--f-body); }
.m-how > summary::after { content: ""; width: 6px; height: 6px; margin-inline-start: .15rem; border: solid currentColor; border-width: 0 1.6px 1.6px 0; transform: translateY(-2px) rotate(45deg); transition: transform .2s var(--ease); }
.m-how[open] > summary::after { transform: translateY(1px) rotate(-135deg); }
.m-how > summary:hover { color: var(--accent); }
.m-how[open] > summary { margin-bottom: var(--sp-2); }
.rdv-cal .ico-chev { transition: transform .2s var(--ease); }
.rdv-cal[open] > summary .ico-chev { transform: rotate(180deg); }
.m-how[open] > .how, .rdv-cal-body, .m-more-pop, .m-after-non, .rdv-tip { animation: m-ouvre .22s var(--ease) backwards; }
@keyframes m-ouvre { from { opacity: 0; transform: translateY(-4px); } }

/* Horaires à choisir : deux par ligne sur téléphone */
@media (max-width: 420px) {
  .tchoice .chips { gap: .35rem; }
  .tchoice .chip { padding: .38rem .6rem; font-size: .82rem; min-height: 38px; }
  .tchoice .chip .when { gap: .12rem; }
}

/* Choix du besoin : 5 tuiles, sans tuile orpheline sur téléphone (3 puis 2, centrées) */
@media (max-width: 420px) {
  .need-card { padding: var(--sp-4); }
  .need-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: var(--sp-2); }
  .need-grid > .need-btn { grid-column: span 2; padding: .7rem .25rem .65rem; font-size: .8rem; gap: .35rem; }
  .need-grid > .need-btn:nth-child(4) { grid-column: 2 / span 2; }
  .need-grid .need-ico { width: 38px; height: 38px; }
}

/* Le rendez-vous */
.rdv-box { position: relative; gap: var(--sp-3); }
.rdv-top { padding-inline-end: 2.5rem; }
.rdv-top > .m-more { position: absolute; top: .4rem; inset-inline-end: .4rem; }
.rdv-what { flex: 1 1 13rem; }
.rdv-link-row { display: flex; align-items: center; gap: .2rem; min-width: 0; }
.rdv-link { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; overflow-wrap: normal; min-width: 0; }
.rdv-box.live .slot-date .sd-date { color: inherit; opacity: .9; }
.icon-btn.m-info { width: 28px; height: 28px; flex: none; border-radius: 50%; color: var(--ink-2); }
.icon-btn.m-info::before { content: ""; position: absolute; inset: -6px; }
.icon-btn.m-info[aria-expanded="true"] { background: var(--surface); color: var(--accent); }
.rdv-tip { display: flex; align-items: flex-start; gap: var(--sp-3); padding: .55rem .75rem; border-radius: var(--r-md); background: var(--surface); color: var(--ink-2); }
.rdv-tip > span { flex: 1; }
.rdv-tip .linkish { flex: none; }
.rdv-actions { align-items: flex-start; gap: var(--sp-2); }
.rdv-cal { flex: 1 1 auto; min-width: 0; }
.rdv-cal > summary { list-style: none; cursor: pointer; }
.rdv-cal-body { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-2); }
.rdv-cal-body > p { flex-basis: 100%; margin: 0; }
@media (max-width: 760px) {
  .rdv-actions { flex-direction: column; align-items: stretch; }
  .rdv-actions > .btn, .rdv-cal > summary { width: 100%; }
  .rdv-actions > .rdv-join { min-height: 46px; }
}

/* Sombre : une surface chaude mais claire, au lieu du brun épais (seulement ici, sans toucher au jeton partagé) */
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .rdv-box:not(.live) { background: color-mix(in srgb, var(--brass) 8%, var(--surface)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--brass) 22%, transparent); } }
:root[data-theme="dark"] .rdv-box:not(.live) { background: color-mix(in srgb, var(--brass) 8%, var(--surface)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--brass) 22%, transparent); }

/* Menu « ⋯ » */
.m-more { display: inline-flex; flex: none; }
.m-more-btn { width: 34px; height: 34px; border-radius: 50%; }
.m-more-btn:hover, .m-more-btn[aria-expanded="true"] { background: var(--surface-2); color: var(--ink); }
.rdv-box .m-more-btn:hover, .rdv-box .m-more-btn[aria-expanded="true"] { background: var(--surface); }
.m-more-pop { min-width: 200px; width: max-content; max-width: min(320px, calc(100vw - 48px)); }
.m-more-pop button { color: var(--ink); }
.m-more-pop button.m-danger { color: var(--bad); }

/* Après le rendez-vous : une question, une action */
.mreq .merci-box > p:first-child { flex-wrap: nowrap; align-items: flex-start; }
.mreq .merci-box > p:first-child > svg { flex: none; margin-top: .2em; color: var(--brass); }
.mreq.m-compact { gap: var(--sp-2); }
.m-after { display: flex; flex-direction: column; gap: var(--sp-2); padding: .7rem .85rem; border-radius: var(--r-md); background: var(--surface-2); }
.m-after-q { display: flex; align-items: baseline; gap: .3rem .6rem; flex-wrap: wrap; margin: 0; }
.m-after-acts { display: flex; align-items: center; gap: var(--sp-2) var(--sp-4); flex-wrap: wrap; }
.btn.m-done { background: var(--good-soft); border-color: color-mix(in srgb, var(--good) 35%, transparent); color: var(--good); }
.btn.m-done:hover { background: color-mix(in srgb, var(--good) 18%, var(--surface)); }
.m-after-non { display: flex; flex-direction: column; gap: var(--sp-2); padding-top: var(--sp-2); border-top: 1px solid var(--line); }
.m-after-non > p { margin: 0; }
.m-after-non > .linkish { align-self: flex-start; }
.linkish.m-quiet { color: var(--ink-2); font-weight: 500; text-decoration: underline; text-decoration-color: color-mix(in srgb, currentColor 35%, transparent); text-underline-offset: 3px; }
.linkish.m-quiet:hover { color: var(--ink); }

/* Accueil (lauréat) : une demande, légère */
.hn-compact { display: flex; flex-direction: column; gap: var(--sp-3); }
.hn-card { display: flex; flex-direction: column; gap: var(--sp-2); padding: .9rem 1rem; border-radius: var(--r-lg); background: var(--surface); border: 1px solid var(--line); border-inline-start: 4px solid var(--accent); min-width: 0; }
.hn-card > .person { align-self: flex-start; }
.hn-card > p { margin: 0; }
.hn-card .tchoice > p { color: var(--ink-2); }
.hn-more { align-self: flex-start; display: inline-flex; align-items: center; gap: .3rem; }

@media (prefers-reduced-motion: reduce) {
  @keyframes m-ouvre { from { opacity: 0; } }
  .m-how > summary::after, .rdv-cal .ico-chev { transition: none; }
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
  'Rendez-vous passé': 'موعد مضى',
  'Demande pour toi': 'طلب موجَّه إليك',
  'En ce moment': 'الآن',
  'Besoin d’un autre conseil ?': 'تحتاج نصيحة أخرى؟',
  'Prends la demande qui te parle, à ton rythme. Les autres lauréats s’occupent du reste.': 'اختر الطلب الذي يناسبك، على راحتك. باقي الخريجين يتكفّلون بالبقية.',
  'Tout est calme pour l’instant': 'كل شيء هادئ حاليًا',
  'Pas cette fois': 'ليس هذه المرة',
  'Ajouter à mon agenda': 'إضافة إلى أجندتي',
  'Plus d’options': 'خيارات أخرى',
  'Astuce Jitsi': 'نصيحة حول Jitsi',
  'Compris': 'فهمت',
  'Il n’a pas eu lieu': 'لم يتم',
  'Pas de souci, ça arrive. Propose un autre moment, ou clôture la demande.': 'لا بأس، هذا يحدث. اقترح موعدًا آخر، أو أغلق الطلب.',
  'Clôturer sans rendez-vous': 'إغلاق دون موعد',
  'C’est noté.': 'تم التسجيل.',
  'Une salle de visio est créée automatiquement.': 'تُنشأ غرفة الاتصال المرئي تلقائيًا.',
  'Voir l’autre demande': 'عرض الطلب الآخر',
  'Rendez-vous fixé !': 'تم تحديد الموعد!',
  'Merci pour ce mentorat !': 'شكرًا على هذا الإرشاد!',
  'Voir mes mercis': 'عرض رسائل الشكر',
}, [
  [/^Quand tu as (\d+) minutes$/, n => `حين تجد ${n} دقيقة`],
  [/^Dans (\d+) min$/, n => `بعد ${arCount(n, ['دقيقة واحدة', 'دقيقتين', 'دقائق', 'دقيقة'])}`],
  [/^Dans (\d+) jours$/, n => `بعد ${arCount(n, ['يوم واحد', 'يومين', 'أيام', 'يومًا'])}`],
  [/^Voir les (\d+) autres demandes$/, n => `عرض الطلبات الأخرى (${n})`],
  [/^Écrire à (.+)$/, n => `راسل ${n}`],
  [/^(.+) a accepté !$/, n => `موعدك مع ${n} مؤكَّد!`],
  [/^(.+) reçoit l’invitation pour (.+)\. Merci de lui ouvrir ta porte !$/, (n, q) => `أُرسلت الدعوة إلى ${n}: ${quandAR(q)}. شكرًا لأنك تفتح بابك!`],
  [/^Rendez-vous (.+), (\d+) min en visio\. Note deux ou trois questions : c’est tout ce qu’il faut\.$/, (q, d) => `الموعد ${quandAR(q)}، ${d} دقيقة عبر الفيديو. دوّن سؤالين أو ثلاثة: هذا كل ما تحتاجه.`],
  [/^Grâce à tes (\d+) minutes, (.+) avance plus sereinement\. \+20 points d’impact\.$/, (d, n) => `بفضل ${d} دقيقة من وقتك، يتقدّم ${n} بثقة أكبر. ‎+20 نقطة تأثير.`],
]);
