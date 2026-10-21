// Agenda de l'école : forum, conférences, portes ouvertes. L'administration publie,
// chacun indique s'il vient et l'ajoute à son agenda (Google Agenda ou fichier .ics).
import { html, useState, useEffect } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Avatar, Person, toast, injectCSS } from './ui.js';
import { addAR, getLang } from './i18n.js';
import { TYPES_EVENEMENT } from './logic.js';

addAR({
  'Agenda de l’école': 'مفكرة المدرسة', 'Forum, conférences, portes ouvertes : ce qui se passe à l’école et en ligne.': 'المنتدى، المحاضرات، الأبواب المفتوحة: ما يجري في المدرسة وعبر الإنترنت.',
  'Publier un événement': 'نشر حدث', 'Modifier l’événement': 'تعديل الحدث', 'Je participe': 'سأشارك', 'Je ne viens plus': 'لن أحضر', 'Inscrit(e)': 'مسجّل(ة)',
  'Google Agenda': 'تقويم Google', 'Autre agenda (.ics)': 'تقويم آخر (.ics)', 'Rejoindre en ligne': 'الانضمام عبر الإنترنت', 'En ligne': 'عبر الإنترنت',
  'Pour les étudiants': 'للطلبة', 'Pour les lauréats': 'للخريجين', 'Tout le monde': 'الجميع', 'Étudiants': 'الطلبة', 'Lauréats': 'الخريجون',
  'Annulé': 'ملغى', 'Terminé': 'انتهى', 'Annuler l’événement': 'إلغاء الحدث', 'Rétablir': 'إعادة تفعيل', 'Supprimer': 'حذف', 'Modifier': 'تعديل',
  'Aucun événement à venir': 'لا توجد أحداث قادمة', 'L’école publie ici ses forums, conférences et portes ouvertes.': 'تنشر المدرسة هنا منتدياتها ومحاضراتها وأيامها المفتوحة.',
  'Publie le premier : tous les membres concernés sont prévenus.': 'انشر الأول: يتم إشعار كل الأعضاء المعنيين.',
  'Titre': 'العنوان', 'Type': 'النوع', 'Début': 'البداية', 'Fin (facultatif)': 'النهاية (اختياري)', 'Lieu': 'المكان', 'Lien (facultatif)': 'الرابط (اختياري)',
  'Description': 'الوصف', 'Pour qui ?': 'لمن؟', 'Publier': 'نشر', 'Enregistrer': 'حفظ', 'Annuler': 'إلغاء',
  'Ex. Forum ENSAM Entreprises': 'مثال: منتدى ENSAM للمقاولات', 'Ex. ENSAM Meknès, grand hall': 'مثال: ENSAM مكناس، البهو الكبير',
  'Lien de la visio ou de l’inscription : https://…': 'رابط الاتصال المرئي أو التسجيل: https://…',
  'Le programme, ce qu’il faut apporter…': 'البرنامج، وما يجب إحضاره…',
  'Les membres concernés reçoivent une notification. S’il est annulé ou déplacé, les inscrits sont prévenus.': 'يتلقى الأعضاء المعنيون إشعارًا. إذا أُلغي أو أُجّل، يتم إخبار المسجلين.',
  'Événement publié. Les membres concernés sont prévenus.': 'نُشر الحدث. تم إشعار الأعضاء المعنيين.', 'Événement modifié.': 'تم تعديل الحدث.',
  'Événement annulé. Les inscrits sont prévenus.': 'أُلغي الحدث. تم إخبار المسجلين.', 'Événement rétabli.': 'أُعيد تفعيل الحدث.', 'Événement supprimé.': 'حُذف الحدث.',
  'Inscrit(e) ! Ajoute-le à ton agenda.': 'تم تسجيلك! أضفه إلى مفكرتك.', 'C’est noté, tu n’es plus inscrit(e).': 'تم، لم تعد مسجلًا.',
  'Le lien doit commencer par https://': 'يجب أن يبدأ الرابط بـ https://', 'La fin doit être après le début.': 'يجب أن تكون النهاية بعد البداية.',
  'Supprimer cet événement ? Les inscriptions partent avec lui.': 'حذف هذا الحدث؟ ستُحذف التسجيلات معه.',
  'Annuler cet événement ? Il reste visible, barré, et les inscrits sont prévenus.': 'إلغاء هذا الحدث؟ سيبقى ظاهرًا مشطوبًا، ويتم إخبار المسجلين.',
  'À l’agenda de l’école': 'في مفكرة المدرسة', 'Inscrits': 'المسجلون', 'Personne n’est encore inscrit.': 'لم يسجل أحد بعد.',
  'Tout voir': 'عرض الكل', 'Événements': 'الأحداث', 'Liste des inscrits (CSV)': 'لائحة المسجلين (CSV)', 'Événement': 'حدث',
  'Forum': 'منتدى', 'Conférence': 'محاضرة', 'Portes ouvertes': 'أبواب مفتوحة', 'Atelier': 'ورشة', 'Soutenances': 'مناقشات',
}, [
  [/^Événements passés \((\d+)\)$/, n => `الأحداث السابقة (${n})`],
  [/^(\d+) inscrits?$/, n => `${n} مسجل`],
  [/^(\d+) à venir$/, n => `${n} قادمة`],
  [/^jusqu’au (\d{1,2}) (\S+)$/, (j, m) => `إلى غاية ${j} ${m}`],
]);

const pad = n => String(n).padStart(2, '0');
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const heure = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const memeJour = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const finDe = e => new Date(e.fin || new Date(new Date(e.debut).getTime() + 2 * 36e5));
export const passe = e => new Date(e.fin || e.debut) < Date.now();
const PUBLICS = [['tous', 'Tout le monde'], ['etudiants', 'Étudiants'], ['laureats', 'Lauréats']];

// Ce que chacun voit : l'administration tout, sinon les événements ouverts à son rôle
export function eventsFor(data, me) {
  return (data.evenements || []).filter(e => me.role === 'admin' || e.public === 'tous' || (e.public === 'etudiants' && me.role === 'etudiant') || (e.public === 'laureats' && me.role === 'laureat'));
}

// ---------------------------------------------------------------------------
// Ajout à un agenda
// ---------------------------------------------------------------------------
const icsDate = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function textes(e) {
  const ar = getLang() === 'ar';
  const details = [e.description, e.lien ? (ar ? `الرابط : ${e.lien}` : `Lien : ${e.lien}`) : null, ar ? 'شبكة ENSAM مكناس' : 'Réseau ENSAM Meknès'].filter(Boolean).join('\n\n');
  return { title: e.titre, details, location: e.lieu || e.lien || '' };
}
function gcalUrl(e) {
  const t = textes(e);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: t.title, dates: `${icsDate(e.debut)}/${icsDate(finDe(e))}`, details: t.details, location: t.location });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}
function icsHref(e) {
  const t = textes(e);
  const esc = s => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, x => '\\' + x);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Reseau ENSAM Meknes//Agenda//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${e.id}@reseau-ensam`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(e.debut)}`, `DTEND:${icsDate(finDe(e))}`,
    `SUMMARY:${esc(t.title)}`, `DESCRIPTION:${esc(t.details)}`, t.location ? `LOCATION:${esc(t.location)}` : null, e.lien ? `URL:${e.lien}` : null,
    e.annule ? 'STATUS:CANCELLED' : null, 'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${esc(t.title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean);
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'));
}

// ---------------------------------------------------------------------------
// Petits éléments
// ---------------------------------------------------------------------------
function DateBloc({ iso, compact }) {
  const d = new Date(iso);
  return html`<span class=${'ev-date' + (compact ? ' compact' : '')} aria-hidden="true">
    <span class="ev-wd">${JOURS[d.getDay()]}</span><span class="ev-d mono">${d.getDate()}</span><span class="ev-m">${MOIS_COURT[d.getMonth()]}</span>
  </span>`;
}

function Quand({ e, court }) {
  const d = new Date(e.debut); const f = e.fin ? new Date(e.fin) : null;
  const h = html`<span class="mono" dir="ltr">${heure(d)}${f && memeJour(d, f) ? ` – ${heure(f)}` : ''}</span>`;
  return html`<span class="ev-when"><${Icon} name="clock" size=${14}/>
    ${court ? h : html`<span>${JOURS[d.getDay()]}</span> <span>${`${d.getDate()} ${MOIS[d.getMonth()]}`}</span> <span class="nowrap">· ${h}</span>`}
    ${f && !memeJour(d, f) ? html` · <span>${`jusqu’au ${f.getDate()} ${MOIS[f.getMonth()]}`}</span>` : null}</span>`;
}

function TypeTag({ type }) {
  const [label, icon] = TYPES_EVENEMENT[type] || TYPES_EVENEMENT.autre;
  return html`<span class=${'tag ev-type ev-' + type}><${Icon} name=${icon} size=${13}/> ${label}</span>`;
}

function useParticipants(ctx, e) {
  const { data, store, me } = ctx;
  const rows = (data.evenement_participants || []).filter(x => x.evenement_id === e.id);
  return { rows, gens: rows.map(x => store.byId('profiles', x.user_id)).filter(Boolean), mine: rows.find(x => x.user_id === me.id) };
}

function Participer({ ctx, e, small }) {
  const { store, me, act } = ctx;
  const { mine } = useParticipants(ctx, e);
  if (me.role === 'admin' || e.annule || passe(e)) return null;
  if (mine) return html`<span class="mini good"><${Icon} name="check" size=${12}/> Inscrit(e)</span>
    <button class="btn tiny ghost" onClick=${() => act(async () => { await store.remove('evenement_participants', mine.id); toast('C’est noté, tu n’es plus inscrit(e).'); })}>Je ne viens plus</button>`;
  return html`<button class=${'btn primary ' + (small ? 'tiny' : 'small')} onClick=${() => act(async () => { await store.insert('evenement_participants', { evenement_id: e.id, user_id: me.id }); toast('Inscrit(e) ! Ajoute-le à ton agenda.'); })}><${Icon} name="check" size=${14}/> Je participe</button>`;
}

function AjoutAgenda({ e }) {
  if (e.annule || passe(e)) return null;
  return html`<a class="btn tiny ghost" href=${gcalUrl(e)} target="_blank" rel="noopener"><${Icon} name="calendar" size=${14}/> Google Agenda</a>
    <a class="btn tiny ghost" href=${icsHref(e)} download="evenement-ensam.ics"><${Icon} name="download" size=${14}/> Autre agenda (.ics)</a>`;
}

function AdminActions({ ctx, e, onEdit, onDone }) {
  const { store, act, confirm } = ctx;
  return html`<span class="ev-admin">
    <button class="btn tiny ghost" onClick=${onEdit}><${Icon} name="edit" size=${14}/> Modifier</button>
    ${e.annule ? html`<button class="btn tiny ghost" onClick=${() => act(async () => { await store.update('evenements', e.id, { annule: false }); toast('Événement rétabli.'); })}>Rétablir</button>`
      : passe(e) ? null : html`<button class="btn tiny ghost danger-t" onClick=${() => confirm('Annuler cet événement ? Il reste visible, barré, et les inscrits sont prévenus.', () => act(async () => { await store.update('evenements', e.id, { annule: true }); toast('Événement annulé. Les inscrits sont prévenus.'); }), 'Annuler l’événement')}>Annuler l’événement</button>`}
    <button class="btn tiny ghost danger-t" aria-label="Supprimer" title="Supprimer" onClick=${() => confirm('Supprimer cet événement ? Les inscriptions partent avec lui.', () => act(async () => { await store.remove('evenements', e.id); toast('Événement supprimé.'); onDone?.(); }), 'Supprimer')}><${Icon} name="trash" size=${14}/></button>
  </span>`;
}

function PublicTag({ e }) {
  return e.public === 'etudiants' ? html`<span class="mini">Pour les étudiants</span>` : e.public === 'laureats' ? html`<span class="mini">Pour les lauréats</span>` : null;
}

function Etat({ e }) {
  return e.annule ? html`<span class="tag done">Annulé</span>` : passe(e) ? html`<span class="tag done">Terminé</span>` : null;
}

// ---------------------------------------------------------------------------
// Carte d'un événement
// ---------------------------------------------------------------------------
function EventCard({ ctx, e, onOpen, onEdit }) {
  const { me, openProfile } = ctx;
  const { gens } = useParticipants(ctx, e);
  const fini = passe(e);
  return html`<article class=${'ev-card' + (e.annule ? ' off' : '') + (fini ? ' past' : '')} id=${'ev-' + e.id}>
    <${DateBloc} iso=${e.debut}/>
    <div class="ev-main">
      <div class="ev-tags"><${TypeTag} type=${e.type}/><${PublicTag} e=${e}/><${Etat} e=${e}/></div>
      <h3 class="ev-title"><button class="linkish strong" onClick=${() => onOpen(e)} translate="no" dir="auto">${e.titre}</button></h3>
      <${Quand} e=${e}/>
      ${e.lieu ? html`<span class="ev-line small"><${Icon} name="pin" size=${14}/> <span translate="no" dir="auto">${e.lieu}</span></span>` : null}
      ${e.lien && !e.annule && !fini ? html`<span class="ev-line small"><${Icon} name="video" size=${14}/> <a href=${e.lien} target="_blank" rel="noopener">${e.lieu ? 'Rejoindre en ligne' : 'En ligne'}</a></span>` : null}
      ${e.description ? html`<p class="ev-desc small muted" translate="no" dir="auto">${e.description}</p>` : null}
      ${gens.length ? html`<span class="cafe-who"><span class="av-stack">${gens.slice(0, 5).map(p => html`<button class="av-btn" title=${p.full_name} aria-label=${p.full_name} onClick=${() => openProfile(p)}><${Avatar} p=${p} size=${24}/></button>`)}</span><span class="small muted">${gens.length} inscrit${gens.length > 1 ? 's' : ''}</span></span>` : null}
    </div>
    ${(me.role !== 'admin' && !e.annule && !fini) || me.role === 'admin' ? html`<div class="ev-act">
      <${Participer} ctx=${ctx} e=${e}/>
      <span class="spacer"></span>
      <${AjoutAgenda} e=${e}/>
      ${me.role === 'admin' ? html`<${AdminActions} ctx=${ctx} e=${e} onEdit=${() => onEdit(e)}/>` : null}
    </div>` : null}
  </article>`;
}

// Fiche complète (ouverte par #reseau/agenda/<id>, ex. depuis une notification)
function EventDetail({ ctx, e, onClose, onEdit }) {
  const { me, openProfile } = ctx;
  const { gens } = useParticipants(ctx, e);
  return html`<${Modal} title=${TYPES_EVENEMENT[e.type]?.[0] || 'Événement'} onClose=${onClose}>
    <div class="ev-detail">
      <div class="row"><${DateBloc} iso=${e.debut}/><div class="grow ev-main">
        <div class="ev-tags"><${TypeTag} type=${e.type}/><${PublicTag} e=${e}/><${Etat} e=${e}/></div>
        <h3 class=${'ev-title' + (e.annule ? ' struck' : '')} translate="no" dir="auto">${e.titre}</h3>
        <${Quand} e=${e}/>
      </div></div>
      ${e.lieu ? html`<p class="ev-line"><${Icon} name="pin" size=${15}/> <span translate="no" dir="auto">${e.lieu}</span></p>` : null}
      ${e.lien && !e.annule ? html`<p class="ev-line"><${Icon} name="video" size=${15}/> <a href=${e.lien} target="_blank" rel="noopener" dir="ltr" translate="no">${e.lien.replace(/^https:\/\//, '').slice(0, 60)}</a></p>` : null}
      ${e.description ? html`<p class="ev-full" translate="no" dir="auto">${e.description}</p>` : null}
      <div class="row"><${Participer} ctx=${ctx} e=${e}/><span class="spacer"></span><${AjoutAgenda} e=${e}/></div>
      <div class="section-head"><h2 class="h-ico"><${Icon} name="people"/> Inscrits <span class="count">${gens.length}</span></h2></div>
      ${gens.length ? html`<div class="ev-people">${gens.slice(0, 40).map(p => html`<${Person} p=${p} onOpen=${openProfile} size=${30}/>`)}</div>` : html`<p class="small muted">Personne n’est encore inscrit.</p>`}
      ${me.role === 'admin' ? html`<div class="row-end"><${AdminActions} ctx=${ctx} e=${e} onEdit=${() => onEdit(e)} onDone=${onClose}/></div>` : null}
    </div>
  <//>`;
}

// ---------------------------------------------------------------------------
// Formulaire de l'administration
// ---------------------------------------------------------------------------
function dansUneSemaine(h) { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(h, 0, 0, 0); return d; }

function EventForm({ ctx, e, onClose }) {
  const { store, act } = ctx;
  const [f, setF] = useState(() => e ? { titre: e.titre, type: e.type, debut: toInput(new Date(e.debut)), fin: e.fin ? toInput(new Date(e.fin)) : '', lieu: e.lieu || '', lien: e.lien || '', description: e.description || '', public: e.public }
    : { titre: '', type: 'conference', debut: toInput(dansUneSemaine(10)), fin: toInput(dansUneSemaine(12)), lieu: '', lien: '', description: '', public: 'tous' });
  const set = (k, v) => setF({ ...f, [k]: v });
  const lienOk = !f.lien.trim() || /^https:\/\/\S+$/i.test(f.lien.trim());
  const finOk = !f.fin || !f.debut || new Date(f.fin) >= new Date(f.debut);
  const ok = f.titre.trim().length >= 3 && f.debut && lienOk && finOk;
  const submit = ev => {
    ev.preventDefault(); if (!ok) return;
    const row = { titre: f.titre.trim(), type: f.type, debut: new Date(f.debut).toISOString(), fin: f.fin ? new Date(f.fin).toISOString() : null, lieu: f.lieu.trim() || null, lien: f.lien.trim() || null, description: f.description.trim() || null, public: f.public };
    act(async () => {
      if (e) { await store.update('evenements', e.id, row); toast('Événement modifié.'); }
      else { await store.insert('evenements', row); toast('Événement publié. Les membres concernés sont prévenus.', 'win'); }
      onClose();
    });
  };
  return html`<${Modal} title=${e ? 'Modifier l’événement' : 'Publier un événement'} onClose=${onClose}>
    <form class="form" onSubmit=${submit}>
      <${Field} label="Titre"><input id="ev-titre" required minlength="3" maxlength="140" value=${f.titre} onInput=${x => set('titre', x.target.value)} placeholder="Ex. Forum ENSAM Entreprises"/><//>
      <div class="ev-types" role="radiogroup" aria-label="Type">${Object.entries(TYPES_EVENEMENT).map(([k, [l, i]]) => html`<button type="button" role="radio" aria-checked=${f.type === k} class=${'chip' + (f.type === k ? ' on' : '')} onClick=${() => set('type', k)}><${Icon} name=${i} size=${14}/> ${l}</button>`)}</div>
      <div class="grid2"><${Field} label="Début"><input id="ev-debut" type="datetime-local" required value=${f.debut} onInput=${x => set('debut', x.target.value)}/><//>
        <${Field} label="Fin (facultatif)" hint=${finOk ? '' : 'La fin doit être après le début.'}><input id="ev-fin" type="datetime-local" value=${f.fin} min=${f.debut} onInput=${x => set('fin', x.target.value)}/><//></div>
      <${Field} label="Lieu"><input id="ev-lieu" maxlength="140" value=${f.lieu} onInput=${x => set('lieu', x.target.value)} placeholder="Ex. ENSAM Meknès, grand hall"/><//>
      <${Field} label="Lien (facultatif)" hint=${lienOk ? '' : 'Le lien doit commencer par https://'}><input id="ev-lien" dir="ltr" maxlength="300" value=${f.lien} onInput=${x => set('lien', x.target.value)} placeholder="Lien de la visio ou de l’inscription : https://…"/><//>
      <${Field} label="Description"><textarea id="ev-desc" rows="3" maxlength="2000" value=${f.description} onInput=${x => set('description', x.target.value)} placeholder="Le programme, ce qu’il faut apporter…"></textarea><//>
      <div class="field"><span class="field-label">Pour qui ?</span><div class="seg" role="radiogroup" aria-label="Pour qui ?">${PUBLICS.map(([k, l]) => html`<button type="button" role="radio" aria-checked=${f.public === k} class=${f.public === k ? 'on' : ''} onClick=${() => set('public', k)}>${l}</button>`)}</div></div>
      ${!e ? html`<p class="small muted">Les membres concernés reçoivent une notification. S’il est annulé ou déplacé, les inscrits sont prévenus.</p>` : null}
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" id="ev-ok" disabled=${!ok}>${e ? 'Enregistrer' : 'Publier'}</button></div>
    </form>
  <//>`;
}

// ---------------------------------------------------------------------------
// Page Réseau > Agenda
// ---------------------------------------------------------------------------
export function AgendaPage({ ctx }) {
  const { data, me, sub2, go } = ctx;
  const [edit, setEdit] = useState(null); // null | 'new' | événement
  const [old, setOld] = useState(false);
  const isAdmin = me.role === 'admin';
  useEffect(() => { if (sub2 === 'nouveau' && isAdmin) { setEdit('new'); go('reseau/agenda'); } }, [sub2]);
  const mine = eventsFor(data, me);
  const avenir = mine.filter(e => !passe(e)).sort((a, b) => new Date(a.debut) - new Date(b.debut));
  const passes = mine.filter(passe).sort((a, b) => new Date(b.debut) - new Date(a.debut));
  const ouvert = sub2 && sub2 !== 'nouveau' ? mine.find(e => e.id === sub2) : null;
  const mois = [];
  for (const e of avenir) { const d = new Date(e.debut); const k = d.getFullYear() * 12 + d.getMonth(); const last = mois[mois.length - 1]; if (last?.k === k) last.items.push(e); else mois.push({ k, d, items: [e] }); }
  const open = e => go('reseau/agenda/' + e.id);
  return html`<div class="sub-page agenda">
    <div class="section-head"><div class="ag-head"><h2 class="h-ico"><${Icon} name="calendar"/> Agenda de l’école</h2><p class="small muted">Forum, conférences, portes ouvertes : ce qui se passe à l’école et en ligne.</p></div>
      ${isAdmin ? html`<button class="btn primary small" id="ev-new" onClick=${() => setEdit('new')}><${Icon} name="plus" size=${15}/> Publier un événement</button>` : null}</div>
    ${avenir.length ? mois.map(m => html`<section class="ev-month"><h3 class="ev-month-h"><span>${MOIS[m.d.getMonth()]}</span> <span class="mono">${m.d.getFullYear()}</span></h3>
      <div class="ev-list">${m.items.map(e => html`<${EventCard} key=${e.id} ctx=${ctx} e=${e} onOpen=${open} onEdit=${x => setEdit(x)}/>`)}</div></section>`)
      : html`<${Empty} icon="calendar" title="Aucun événement à venir">${isAdmin ? 'Publie le premier : tous les membres concernés sont prévenus.' : 'L’école publie ici ses forums, conférences et portes ouvertes.'}<//>`}
    ${passes.length ? html`<button class="linkish small past-toggle" aria-expanded=${old} onClick=${() => setOld(!old)}>${`Événements passés (${passes.length})`}</button>
      ${old ? html`<div class="ev-list">${passes.slice(0, 20).map(e => html`<${EventCard} key=${e.id} ctx=${ctx} e=${e} onOpen=${open} onEdit=${x => setEdit(x)}/>`)}</div>` : null}` : null}
    ${ouvert ? html`<${EventDetail} ctx=${ctx} e=${ouvert} key=${ouvert.id} onClose=${() => go('reseau/agenda')} onEdit=${x => setEdit(x)}/>` : null}
    ${edit ? html`<${EventForm} ctx=${ctx} e=${edit === 'new' ? null : edit} key=${edit === 'new' ? 'new' : edit.id} onClose=${() => setEdit(null)}/>` : null}
  </div>`;
}

// Administration > Agenda : tous les événements, avec le nombre d'inscrits et leur liste à télécharger
export function AgendaAdmin({ ctx }) {
  const { data, store, go } = ctx;
  const all = data.evenements || [];
  const evs = [...all].sort((a, b) => (passe(a) - passe(b)) || (passe(a) ? new Date(b.debut) - new Date(a.debut) : new Date(a.debut) - new Date(b.debut))).slice(0, 15);
  const inscrits = id => (data.evenement_participants || []).filter(x => x.evenement_id === id);
  const csv = e => {
    const rows = inscrits(e.id).map(x => store.byId('profiles', x.user_id)).filter(Boolean);
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const txt = '\ufeff' + [['Nom', 'Rôle', 'Filière', 'Promo'].join(';'), ...rows.map(p => [p.full_name, p.role === 'etudiant' ? 'Étudiant(e)' : 'Lauréat(e)', p.filiere, p.promo].map(q).join(';'))].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
    a.download = `inscrits-${e.titre.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const avenir = all.filter(e => !passe(e) && !e.annule).length;
  return html`<div class="panel">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="calendar"/> Événements <span class="count">${`${avenir} à venir`}</span></h2>
      <span class="row"><button class="btn tiny ghost" onClick=${() => go('reseau/agenda')}>Tout voir <${Icon} name="arrow" size=${14}/></button><button class="btn small primary" id="adm-ev-new" onClick=${() => go('reseau/agenda/nouveau')}><${Icon} name="plus" size=${15}/> Publier un événement</button></span></div>
    ${evs.length ? html`<ul class="people-list ev-admin-list">${evs.map(e => { const n = inscrits(e.id).length; return html`<li key=${e.id} class=${e.annule || passe(e) ? 'dim' : ''}>
      <${DateBloc} iso=${e.debut} compact/>
      <span class="grow"><button class=${'linkish strong' + (e.annule ? ' struck' : '')} onClick=${() => go('reseau/agenda/' + e.id)} translate="no" dir="auto">${e.titre}</button>
        <span class="ev-tags small muted"><${TypeTag} type=${e.type}/><${Etat} e=${e}/><span>${n} inscrit${n > 1 ? 's' : ''}</span></span></span>
      ${n ? html`<button class="btn tiny ghost" onClick=${() => csv(e)}><${Icon} name="download" size=${14}/> Liste des inscrits (CSV)</button>` : null}
    </li>`; })}</ul>` : html`<${Empty} icon="calendar" title="Aucun événement à venir">Publie le premier : tous les membres concernés sont prévenus.<//>`}
  </div>`;
}

// ---------------------------------------------------------------------------
// Accueil : le prochain événement qui me concerne
// ---------------------------------------------------------------------------
export function NextEvent({ ctx }) {
  const { data, me, go } = ctx;
  const e = eventsFor(data, me).filter(x => !x.annule && !passe(x)).sort((a, b) => new Date(a.debut) - new Date(b.debut))[0];
  if (!e) return null;
  return html`<div class="panel next-ev">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="calendar"/> À l’agenda de l’école</h2><button class="btn tiny ghost" onClick=${() => go('reseau/agenda')}>Agenda <${Icon} name="arrow" size=${14}/></button></div>
    <div class="next-ev-row"><${DateBloc} iso=${e.debut} compact/>
      <div class="ev-main"><${TypeTag} type=${e.type}/>
        <button class="linkish strong ev-title-s" onClick=${() => go('reseau/agenda/' + e.id)} translate="no" dir="auto">${e.titre}</button>
        <${Quand} e=${e} court/>
        ${e.lieu ? html`<span class="ev-line small"><${Icon} name="pin" size=${13}/> <span translate="no" dir="auto">${e.lieu}</span></span>` : null}
      </div></div>
    ${me.role !== 'admin' ? html`<div class="row"><${Participer} ctx=${ctx} e=${e} small/></div>` : null}
  </div>`;
}

injectCSS('agenda', `
.ag-head { display: flex; flex-direction: column; gap: .15rem; }
.ag-head p { margin: 0; }
.ev-month { display: flex; flex-direction: column; gap: .6rem; margin-top: .4rem; }
.ev-month-h { margin: .4rem 0 0; font-size: .8rem; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); font-weight: 650; }
.ev-list { display: flex; flex-direction: column; gap: .6rem; }
.ev-card { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: .6rem .9rem; padding: .9rem 1rem; border-radius: 14px; background: var(--surface); border: 1px solid var(--line); }
.ev-card.off .ev-title button, .struck { text-decoration: line-through; color: var(--muted) !important; }
.ev-card.off, .ev-card.past { background: color-mix(in srgb, var(--surface) 65%, var(--surface-2)); }
.ev-card.past .ev-date, .ev-card.off .ev-date { background: var(--surface-2); color: var(--ink-2); }
.ev-date { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; min-width: 4.2rem; padding: .45rem .5rem .5rem; border-radius: 12px; background: var(--accent-soft); color: var(--accent); line-height: 1.15; align-self: start; flex: none; }
.ev-date .ev-wd { font-size: .7rem; font-weight: 650; text-transform: capitalize; }
.ev-date .ev-d { font-size: 1.65rem; font-weight: 600; }
.ev-date .ev-m { font-size: .76rem; font-weight: 650; text-transform: uppercase; letter-spacing: .04em; }
.ev-date.compact { min-width: 3.4rem; padding: .35rem .4rem; }
.ev-date.compact .ev-d { font-size: 1.3rem; }
.ev-main { min-width: 0; display: flex; flex-direction: column; gap: .25rem; align-items: flex-start; }
.ev-tags { display: flex; flex-wrap: wrap; gap: .3rem; align-items: center; }
.ev-tags .mini { margin: 0; }
.ev-title { margin: .1rem 0 0; font-size: 1.05rem; font-family: var(--f-display); }
.ev-title .linkish { text-align: start; font-size: inherit; font-family: inherit; }
.ev-title-s { text-align: start; font-family: var(--f-display); font-size: .98rem; }
.ev-when { display: inline-flex; flex-wrap: wrap; align-items: center; gap: .25rem; font-size: .86rem; color: var(--ink-2); }
.ev-when .nowrap { white-space: nowrap; }
.ev-when svg, .ev-line svg { color: var(--muted); flex: none; }
.ev-line { display: inline-flex; align-items: center; gap: .3rem; overflow-wrap: anywhere; margin: 0; }
.ev-desc { margin: .15rem 0 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ev-full { white-space: pre-line; margin: 0; }
.ev-act { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: .4rem; padding-top: .55rem; border-top: 1px dashed var(--line); }
.ev-act .mini { margin: 0; }
.ev-admin { display: inline-flex; flex-wrap: wrap; gap: .2rem; align-items: center; }
.ev-type { --c: var(--accent); color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent); }
.ev-forum { --c: var(--brass); } .ev-conference { --c: var(--indigo); } .ev-portes_ouvertes { --c: var(--good); } .ev-atelier { --c: var(--teal); } .ev-soutenance { --c: var(--accent); } .ev-autre { --c: var(--ink-2); }
.ev-types { display: flex; flex-wrap: wrap; gap: .35rem; }
.ev-detail { display: flex; flex-direction: column; gap: .7rem; }
.ev-detail > .row:first-child { align-items: flex-start; flex-wrap: nowrap; }
.ev-people { display: flex; flex-wrap: wrap; gap: .4rem .9rem; }
.next-ev-row { display: flex; gap: .7rem; align-items: flex-start; }
.ev-admin-list li { flex-wrap: nowrap; }
.ev-admin-list li.dim .ev-date { background: var(--surface-2); color: var(--ink-2); }
.ev-admin-list .grow { min-width: 0; flex: 1 1 200px; display: flex; flex-direction: column; gap: .2rem; align-items: flex-start; }
.ev-admin-list li > .btn { margin-inline-start: auto; }
@media (max-width: 640px) {
  .ev-card { grid-template-columns: minmax(0, 1fr); padding: .8rem; }
  .ev-card > .ev-date { flex-direction: row; gap: .4rem; justify-self: start; align-items: baseline; padding: .3rem .65rem; }
  .ev-card > .ev-date .ev-d { font-size: 1.15rem; }
  .ev-act .spacer { display: none; }
  .ev-admin-list li { flex-wrap: wrap; }
}
`);
