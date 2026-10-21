// Groupes (filière, ville, à l'étranger) et Cafés ENSAM : on se retrouve, en ligne puis en vrai.
import { html, useState } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Avatar, toast } from './ui.js';
import { myGroups, groupMembers, groupLabel, groupKey, autoGroups, timeAgo } from './logic.js';
import { SlotDate } from './mentorat.js';
import { SignalerBtn } from './confiance.js';

const KIND = { filiere: ['cap', 'Filière'], ville: ['pin', 'Ville'], pays: ['globe', 'À l’étranger'] };
const pad = n => String(n).padStart(2, '0');
const toInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const upcoming = c => !c.annule && new Date(c.date_at) > Date.now() - 2 * 3600e3;
// Les cafés d'un groupe : même ville (groupe ville), même pays (groupe à l'étranger)
const cafesOf = (data, key) => {
  const [kind] = key.split(':');
  if (kind === 'filiere') return [];
  return data.cafes.filter(c => (kind === 'ville' ? groupKey('ville', c.ville) : groupKey('pays', c.pays)) === key);
};
const go2 = (ctx, key) => ctx.go('reseau/groupes/' + encodeURIComponent(key));

export function GroupesPage({ ctx }) {
  const { sub2 } = ctx;
  if (sub2) return html`<${GroupView} ctx=${ctx} gkey=${sub2} key=${sub2}/>`;
  return html`<${GroupList} ctx=${ctx}/>`;
}

function GroupList({ ctx }) {
  const { data, me, store, act } = ctx;
  const [cafe, setCafe] = useState(false);
  const mine = myGroups(data, me);
  // Autres groupes : à l'étranger d'abord (les lauréats hors du Maroc), puis les villes, par nombre de membres
  const all = new Map();
  for (const p of data.profiles) if (p.role !== 'admin') for (const k of autoGroups(p)) all.set(k, (all.get(k) || 0) + 1);
  for (const g of data.groupe_membres) if (!autoGroups(store.byId('profiles', g.user_id)).includes(g.groupe)) all.set(g.groupe, (all.get(g.groupe) || 0) + 1);
  const others = kind => [...all.entries()].filter(([k, n]) => k.startsWith(kind + ':') && !mine.all.includes(k) && n >= 2).sort((a, b) => b[1] - a[1]);
  const abroad = others('pays').slice(0, 8);
  const villes = others('ville').slice(0, 8);
  const cafes = data.cafes.filter(upcoming).sort((a, b) => new Date(a.date_at) - new Date(b.date_at));
  const near = cafes.filter(c => mine.all.includes(groupKey('ville', c.ville)) || mine.all.includes(groupKey('pays', c.pays)));
  const follow = k => act(async () => { await store.insert('groupe_membres', { groupe: k, user_id: me.id }); toast(`Tu suis maintenant le groupe ${groupLabel(data, k)}.`); });
  return html`<div class="sub-page">
    <p class="muted small">Tu fais partie des groupes de ta filière et de ta ville. Suis aussi les groupes des lauréats à l’étranger pour poser tes questions.</p>
    <div class="group-grid">${mine.all.map(k => html`<${GroupCard} ctx=${ctx} gkey=${k} key=${k}/>`)}</div>

    <div class="section-head"><h2 class="h-ico"><${Icon} name="clap"/> Cafés ENSAM</h2><button class="btn small" onClick=${() => setCafe(true)}><${Icon} name="plus" size=${15}/> Organiser un café</button></div>
    <p class="muted small">Une heure autour d’un café avec les lauréats et les étudiants de ta ville. Inscription en un clic.</p>
    ${cafes.length ? html`<div class="cafe-list">${[...near, ...cafes.filter(c => !near.includes(c))].slice(0, 6).map(c => html`<${CafeCard} ctx=${ctx} c=${c} key=${c.id} showCity/>`)}</div>`
      : html`<${Empty} icon="clap" title="Aucun café prévu pour l’instant">Lance le premier dans ta ville : les membres de ta ville sont prévenus.<//>`}

    ${abroad.length ? html`<div class="section-head"><h2 class="h-ico"><${Icon} name="globe"/> Lauréats à l’étranger</h2></div>
      <ul class="group-follow">${abroad.map(([k, n]) => html`<li key=${k}><button class="linkish strong" onClick=${() => go2(ctx, k)}>${groupLabel(data, k)}</button><span class="muted small">${n} membre${n > 1 ? 's' : ''}</span><span class="spacer"></span><button class="btn tiny" onClick=${() => follow(k)}>Suivre</button></li>`)}</ul>` : null}
    ${villes.length ? html`<div class="section-head"><h2 class="h-ico"><${Icon} name="pin"/> Autres villes</h2></div>
      <ul class="group-follow">${villes.map(([k, n]) => html`<li key=${k}><button class="linkish strong" onClick=${() => go2(ctx, k)}>${groupLabel(data, k)}</button><span class="muted small">${n} membre${n > 1 ? 's' : ''}</span><span class="spacer"></span><button class="btn tiny" onClick=${() => follow(k)}>Suivre</button></li>`)}</ul>` : null}
    ${cafe ? html`<${CafeComposer} ctx=${ctx} onClose=${() => setCafe(false)}/>` : null}
  </div>`;
}

function GroupCard({ ctx, gkey }) {
  const { data, store } = ctx;
  const [kind] = gkey.split(':');
  const [ico, lbl] = KIND[kind];
  const n = groupMembers(data, gkey).length;
  const last = data.groupe_messages.filter(m => m.groupe === gkey).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const nc = cafesOf(data, gkey).filter(upcoming).length;
  return html`<button class="gcard clickable" onClick=${() => go2(ctx, gkey)}>
    <span class=${'g-badge k-' + kind}><${Icon} name=${ico} size=${20}/></span>
    <span class="gcard-txt"><span class="eyebrow">${lbl}</span><strong>${groupLabel(data, gkey)}</strong>
      <span class="muted small">${n} membre${n > 1 ? 's' : ''}${nc ? html` · <span class="good-t">${nc} café${nc > 1 ? 's' : ''} prévu${nc > 1 ? 's' : ''}</span>` : null}</span>
      ${last ? html`<span class="gcard-last small"><b>${store.byId('profiles', last.author_id)?.full_name?.split(' ')[0] || 'Membre'} :</b> <span translate="no" dir="auto">${last.body.slice(0, 70)}${last.body.length > 70 ? '…' : ''}</span></span>` : html`<span class="gcard-last small muted">Pas encore de message. Dis bonjour !</span>`}</span>
  </button>`;
}

function GroupView({ ctx, gkey }) {
  const { data, me, store, act, openProfile, go } = ctx;
  const [txt, setTxt] = useState('');
  const [more, setMore] = useState(false);
  const [cafe, setCafe] = useState(false);
  if (!/^(filiere|ville|pays):.+/.test(gkey)) return html`<div class="sub-page"><button class="btn ghost small back" onClick=${() => go('reseau/groupes')}>← Tous les groupes</button><${Empty} title="Groupe introuvable"/></div>`;
  const [kind] = gkey.split(':');
  const [ico, lbl] = KIND[kind];
  const auto = autoGroups(me).includes(gkey);
  const follow = data.groupe_membres.find(g => g.groupe === gkey && g.user_id === me.id);
  const members = groupMembers(data, gkey).sort((a, b) => (b.role === 'laureat') - (a.role === 'laureat') || a.full_name.localeCompare(b.full_name));
  const msgs = data.groupe_messages.filter(m => m.groupe === gkey).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const cafes = cafesOf(data, gkey).filter(upcoming).sort((a, b) => new Date(a.date_at) - new Date(b.date_at));
  const label = groupLabel(data, gkey);
  const canPost = auto || follow;
  const post = e => { e.preventDefault(); if (!txt.trim()) return; act(async () => { await store.insert('groupe_messages', { groupe: gkey, author_id: me.id, body: txt.trim() }); setTxt(''); }); };
  return html`<div class="sub-page">
    <button class="btn ghost small back" onClick=${() => go('reseau/groupes')}>← Tous les groupes</button>
    <div class="group-head">
      <span class=${'g-badge big k-' + kind}><${Icon} name=${ico} size=${26}/></span>
      <div class="grow"><p class="eyebrow">${lbl}</p><h2>${label}</h2><p class="muted small">${members.length} membre${members.length > 1 ? 's' : ''} · ${members.filter(p => p.role === 'laureat').length} lauréat${members.filter(p => p.role === 'laureat').length > 1 ? 's' : ''}</p></div>
      ${auto ? html`<span class="mini good"><${Icon} name="check" size=${12}/> ${kind === 'filiere' ? 'Ta filière' : kind === 'ville' ? 'Ta ville' : 'Ton pays'}</span>`
        : follow ? html`<button class="btn small ghost" onClick=${() => act(() => store.remove('groupe_membres', follow.id))}>Ne plus suivre</button>`
        : html`<button class="btn small primary" onClick=${() => act(async () => { await store.insert('groupe_membres', { groupe: gkey, user_id: me.id }); toast('Tu suis ce groupe.'); })}>Suivre</button>`}
    </div>
    <div class="avatar-strip">${members.slice(0, 18).map(p => html`<button class="av-btn" title=${p.full_name} aria-label=${p.full_name} onClick=${() => openProfile(p)}><${Avatar} p=${p} size=${34}/></button>`)}${members.length > 18 ? html`<span class="muted small">+${members.length - 18}</span>` : null}</div>

    ${kind !== 'filiere' ? html`<div class="section-head"><h3 class="h-ico"><${Icon} name="clap" size=${16}/> Cafés</h3><button class="btn tiny" onClick=${() => setCafe(true)}><${Icon} name="plus" size=${14}/> Organiser</button></div>
      ${cafes.length ? html`<div class="cafe-list">${cafes.map(c => html`<${CafeCard} ctx=${ctx} c=${c} key=${c.id}/>`)}</div>` : html`<p class="muted small">Aucun café prévu. Propose le premier : les membres de ${label} sont prévenus.</p>`}` : null}

    <div class="section-head"><h3 class="h-ico"><${Icon} name="comment" size=${16}/> Discussion</h3></div>
    ${canPost ? html`<form class="comment-form" onSubmit=${post}>
      <input id="g-msg" placeholder=${kind === 'pays' ? 'Une question sur la vie, les stages ou le travail ici ?' : 'Une info, une question, un bon plan…'} value=${txt} onInput=${e => setTxt(e.target.value)} maxlength="1500"/>
      <button class="btn small primary" disabled=${!txt.trim()}>Publier</button></form>` : html`<p class="small muted">Suis le groupe pour écrire.</p>`}
    <div class="wall">${msgs.length ? (more ? msgs : msgs.slice(0, 20)).map(m => { const a = store.byId('profiles', m.author_id); return html`<div class="comment" key=${m.id}>
      <${Avatar} p=${a} size=${30}/>
      <div class="comment-body"><button class="linkish" onClick=${() => openProfile(a)}>${a?.full_name || 'Membre'}</button> <span class="muted small">${a?.role === 'laureat' ? `Promo ${a.promo}` : ''} · ${timeAgo(m.created_at)}</span><p translate="no" dir="auto">${m.body}</p></div>
      ${(m.author_id === me.id || me.role === 'admin') ? html`<button class="icon-btn small" aria-label="Supprimer" onClick=${() => act(() => store.remove('groupe_messages', m.id))}><${Icon} name="x" size=${14}/></button>` : html`<${SignalerBtn} ctx=${ctx} type="message" id=${m.id} small/>`}
    </div>`; }) : html`<p class="muted small">Pas encore de message dans ce groupe.</p>`}</div>
    ${msgs.length > 20 && !more ? html`<button class="btn ghost small" onClick=${() => setMore(true)}>Voir les messages plus anciens</button>` : null}
    ${cafe ? html`<${CafeComposer} ctx=${ctx} onClose=${() => setCafe(false)} preset=${kind === 'ville' ? { ville: label } : { pays: label }}/>` : null}
  </div>`;
}

// ---------------------------------------------------------------------------
// Cafés ENSAM
// ---------------------------------------------------------------------------
function gcalCafe(c) {
  const fmt = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = new Date(new Date(c.date_at).getTime() + 90 * 6e4);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: `Café ENSAM · ${c.ville}`, dates: `${fmt(c.date_at)}/${fmt(end)}`, details: (c.message ? c.message + '\n\n' : '') + 'Rencontre du Réseau ENSAM Meknès', location: `${c.lieu}, ${c.ville}${c.pays && c.pays !== 'Maroc' ? ', ' + c.pays : ''}` });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}

export function CafeCard({ ctx, c, showCity }) {
  const { data, me, store, act, openProfile } = ctx;
  const parts = data.cafe_participants.filter(x => x.cafe_id === c.id).map(x => store.byId('profiles', x.user_id)).filter(Boolean);
  const mineP = data.cafe_participants.find(x => x.cafe_id === c.id && x.user_id === me.id);
  const org = store.byId('profiles', c.organisateur_id);
  const isOrg = c.organisateur_id === me.id;
  const full = c.places && parts.length >= c.places;
  const past = new Date(c.date_at) < Date.now();
  return html`<article class=${'cafe' + (c.annule ? ' off' : '')}>
    <${SlotDate} iso=${c.date_at}/>
    <div class="cafe-main">
      <strong>Café ENSAM${showCity ? ` · ${c.ville}` : ''}</strong>
      <span class="small"><${Icon} name="pin" size=${13}/> <span translate="no" dir="auto">${c.lieu}</span>${showCity && c.pays && c.pays !== 'Maroc' ? `, ${c.pays}` : ''}</span>
      ${c.message ? html`<span class="small muted" translate="no" dir="auto">${c.message}</span>` : null}
      <span class="cafe-who">
        <span class="av-stack">${parts.slice(0, 5).map(p => html`<button class="av-btn" title=${p.full_name} aria-label=${p.full_name} onClick=${() => openProfile(p)}><${Avatar} p=${p} size=${24}/></button>`)}</span>
        <span class="small muted">${parts.length}${c.places ? `/${c.places}` : ''} inscrit${parts.length > 1 ? 's' : ''} · par ${org?.full_name?.split(' ')[0] || 'un membre'}</span>
      </span>
    </div>
    <div class="cafe-act">
      ${c.annule ? html`<span class="tag done">Annulé</span>` : past ? html`<span class="tag done">Terminé</span>` : mineP ? html`
        <span class="mini good"><${Icon} name="check" size=${12}/> Inscrit(e)</span>
        <a class="btn tiny ghost" href=${gcalCafe(c)} target="_blank" rel="noopener"><${Icon} name="calendar" size=${14}/> Agenda</a>
        ${isOrg ? html`<button class="btn tiny ghost danger-t" onClick=${() => ctx.confirm('Annuler ce café ? Les inscrits le verront annulé.', () => act(() => store.update('cafes', c.id, { annule: true })), 'Annuler le café')}>Annuler</button>`
          : html`<button class="btn tiny ghost" onClick=${() => act(() => store.remove('cafe_participants', mineP.id))}>Je ne viens plus</button>`}`
        : full ? html`<span class="tag done">Complet</span>` : html`<button class="btn small primary" onClick=${() => act(async () => { await store.insert('cafe_participants', { cafe_id: c.id, user_id: me.id }); toast('Inscrit(e) ! Ajoute-le à ton agenda.'); })}>Je viens</button>`}
      ${!isOrg && !c.annule ? html`<${SignalerBtn} ctx=${ctx} type="cafe" id=${c.id} small/>` : null}
    </div>
  </article>`;
}

function nextSaturday() {
  const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); d.setHours(10, 0, 0, 0); return d;
}

function CafeComposer({ ctx, onClose, preset = {} }) {
  const { store, me, act } = ctx;
  const [f, setF] = useState({ ville: me.ville || '', pays: me.pays || 'Maroc', lieu: '', when: toInput(nextSaturday()), places: 12, message: '', ...preset });
  const set = (k, v) => setF({ ...f, [k]: v });
  const ok = f.ville.trim().length >= 2 && f.lieu.trim().length >= 2 && f.when && new Date(f.when) > new Date();
  return html`<${Modal} title="Organiser un Café ENSAM" onClose=${onClose}>
    <form class="form" onSubmit=${e => { e.preventDefault(); if (!ok) return; act(async () => {
      await store.insert('cafes', { organisateur_id: me.id, ville: f.ville.trim(), pays: f.pays.trim() || 'Maroc', lieu: f.lieu.trim(), date_at: new Date(f.when).toISOString(), places: +f.places || null, message: f.message.trim() || null });
      toast('Café publié. Les membres de la ville sont prévenus.'); onClose(); }); }}>
      <p class="small muted">Un lieu simple et central, une heure, sans programme : on se présente, on échange, c’est tout.</p>
      <div class="grid2"><${Field} label="Ville"><input id="cf-ville" required value=${f.ville} onInput=${e => set('ville', e.target.value)}/><//><${Field} label="Pays"><input id="cf-pays" value=${f.pays} onInput=${e => set('pays', e.target.value)}/><//></div>
      <${Field} label="Lieu" hint="Le nom du café et le quartier"><input id="cf-lieu" required maxlength="140" value=${f.lieu} onInput=${e => set('lieu', e.target.value)} placeholder="Ex. Café Bianca, Maârif"/><//>
      <div class="grid2"><${Field} label="Date et heure"><input id="cf-when" type="datetime-local" required value=${f.when} onInput=${e => set('when', e.target.value)}/><//>
        <${Field} label="Places"><input id="cf-places" type="number" min="2" max="200" value=${f.places} onInput=${e => set('places', e.target.value)}/><//></div>
      <${Field} label="Un mot (facultatif)"><textarea id="cf-msg" rows="2" maxlength="600" value=${f.message} onInput=${e => set('message', e.target.value)} placeholder="Ex. Spécial stages à l’étranger, venez avec vos questions !"></textarea><//>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button class="btn primary" disabled=${!ok}>Publier le café</button></div>
    </form>
  <//>`;
}

// Accueil : le prochain café de ma ville
export function NextCafe({ ctx }) {
  const { data, me } = ctx;
  const mine = myGroups(data, me).all;
  const c = data.cafes.filter(x => upcoming(x) && new Date(x.date_at) > Date.now() && (mine.includes(groupKey('ville', x.ville)) || mine.includes(groupKey('pays', x.pays))))
    .sort((a, b) => new Date(a.date_at) - new Date(b.date_at))[0];
  return c ? html`<div class="panel"><div class="section-head"><h2 class="h-ico"><${Icon} name="clap"/> Café ENSAM près de toi</h2><button class="btn tiny ghost" onClick=${() => ctx.go('reseau/groupes')}>Groupes <${Icon} name="arrow" size=${14}/></button></div><${CafeCard} ctx=${ctx} c=${c} showCity/></div>` : null;
}

