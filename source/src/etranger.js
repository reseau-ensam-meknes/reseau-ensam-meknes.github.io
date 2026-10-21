// Guide de l'étranger par pays, tenu par les lauréats qui y vivent : visa, convention, logement, budget…
// Seuls les lauréats dont le profil indique ce pays (et l'administration) écrivent, comme protect_guide() dans la base.
import { html, useState, useEffect, useMemo } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Bar, toast, useLocal, injectCSS } from './ui.js';
import { GUIDE_SECTIONS, niveauOf, timeAgo, groupKey } from './logic.js';
import { canonPays, PAYS_AR } from './geo.js';
import { getLang, addAR } from './i18n.js';
import { arCount } from './i18n.js';
import { OfferCard, matchesMe } from './offers.js';
import { SignalerBtn } from './confiance.js';

// Même clé que cle_lieu() dans la base : minuscules, sans accents, espaces réduits
const cleLieu = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
// Clé d'affichage : « USA » et « États-Unis » tombent sur le même pays
const paysKey = p => cleLieu(canonPays(p));
const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const paysLabel = p => (getLang() === 'ar' && PAYS_AR[canonPays(p)]) || cap(canonPays(p));
const MAX = 4000;
const AVANT = ['campus_france', 'visa', 'convention', 'logement', 'budget'];
const TACHE = { campus_france: 'Vérifier l’admission ou Campus France', visa: 'Préparer le visa', convention: 'Faire signer la convention de stage', logement: 'Trouver un logement', budget: 'Prévoir son budget' };
const AIDE = {
  campus_france: 'Les étapes, le calendrier, les pièges à éviter…', visa: 'Quel visa, où le demander, les délais, les documents…',
  convention: 'Qui signe, les délais, la gratification…', logement: 'Où chercher, les prix, comment éviter les arnaques…',
  budget: 'Loyer, transport, nourriture : combien par mois ?', stage: 'Où trouver les offres, comment candidater…', vie: 'Banque, téléphone, santé, communauté marocaine…',
};

// Une offre ouverte que je peux voir (un étudiant ne voit que les offres de son année)
const offreVisible = (o, me, saison) => o.status === 'ouverte' && (me.role !== 'etudiant' || matchesMe(o, me, saison));

// Tous les pays connus du réseau : rubriques écrites, lauréats sur place, offres ouvertes
function indexPays(data, me, saison) {
  const m = new Map();
  const get = raw => {
    const k = paysKey(raw); if (!k || k === 'maroc') return null;
    if (!m.has(k)) m.set(k, { key: k, nom: cap(canonPays(raw)), rows: [], laureats: [], offres: [] });
    return m.get(k);
  };
  for (const g of data.guide_pays || []) get(g.pays)?.rows.push(g);
  for (const p of data.profiles) if (p.role === 'laureat' && p.pays) get(p.pays)?.laureats.push(p);
  for (const o of data.offers) if (o.pays && offreVisible(o, me, saison)) get(o.pays)?.offres.push(o);
  return m;
}
// La rubrique d'une section (la plus récente si le pays a été écrit sous deux orthographes)
const rubrique = (e, section) => e.rows.filter(r => r.section === section).sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))[0] || null;
const ecrites = e => GUIDE_SECTIONS.filter(([k]) => rubrique(e, k)).length;

// Qui peut écrire : l'administration, ou un lauréat dont le pays du profil est exactement celui de la rubrique
const habite = (me, pays) => me.role === 'laureat' && !!me.pays && cleLieu(me.pays) !== 'maroc' && cleLieu(me.pays) === cleLieu(pays);
const peutModifier = (me, row) => me.role === 'admin' || habite(me, row.pays);
// Orthographe du pays pour une nouvelle rubrique (la clé unique de la base est pays + rubrique)
function paysPourEcrire(me, e) {
  if (me.role === 'admin') return e.rows[0]?.pays || e.nom;
  if (me.role !== 'laureat' || !me.pays || paysKey(me.pays) !== e.key) return null;
  if (!e.rows.length) return me.pays.trim();
  return e.rows.find(r => habite(me, r.pays))?.pays || null;
}

export function EtrangerPage({ ctx }) {
  injectCSS('etranger', CSS);
  const { sub2 } = ctx;
  if (sub2) return html`<${PaysView} ctx=${ctx} cle=${cleLieu(sub2)} key=${sub2}/>`;
  return html`<${PaysList} ctx=${ctx}/>`;
}

const goPays = (ctx, k) => ctx.go('reseau/etranger/' + encodeURIComponent(k));

function PaysList({ ctx }) {
  const { data, me, saison } = ctx;
  const [q, setQ] = useState('');
  const idx = useMemo(() => indexPays(data, me, saison), [data.guide_pays, data.profiles, data.offers, me, saison]);
  const qq = cleLieu(q);
  const total = GUIDE_SECTIONS.length;
  const list = [...idx.values()]
    .filter(e => !qq || e.key.includes(qq) || cleLieu(paysLabel(e.nom)).includes(qq))
    .sort((a, b) => (ecrites(b) * 3 + b.laureats.length + b.offres.length) - (ecrites(a) * 3 + a.laureats.length + a.offres.length) || a.nom.localeCompare(b.nom));
  const monPays = me.role === 'laureat' && me.pays && paysKey(me.pays) !== 'maroc' ? idx.get(paysKey(me.pays)) : null;
  const reste = monPays ? total - ecrites(monPays) : 0;
  return html`<div class="sub-page etranger">
    <div class="callout gp-intro"><h2 class="h-ico"><${Icon} name="globe"/> Partir en stage ou en PFE à l’étranger</h2>
      <p>Ce que les lauréats sur place conseillent : admission, visa, convention, logement, budget. Chaque pays est tenu par ceux qui y vivent.</p></div>
    ${monPays ? html`<div class="hint-box gp-mine"><${Icon} name="flag" size=${16}/><span class="grow">Tu vis en <b translate="no">${paysLabel(monPays.nom)}</b> : ton expérience aide les étudiants. ${reste ? `Il reste ${reste} rubrique${reste > 1 ? 's' : ''} à écrire.` : 'Le guide est complet, merci !'}</span>
      <button class="btn tiny primary" onClick=${() => goPays(ctx, monPays.key)}>Ouvrir le guide</button></div>` : null}
    <label class="search"><${Icon} name="search" size=${16}/><input id="gp-q" placeholder="Chercher un pays…" value=${q} onInput=${e => setQ(e.target.value)}/></label>
    ${list.length ? html`<div class="group-grid gp-grid">${list.map(e => { const n = ecrites(e); return html`<button class="gcard gp-card" key=${e.key} onClick=${() => goPays(ctx, e.key)}>
      <span class="g-badge k-pays"><${Icon} name="flag" size=${20}/></span>
      <span class="gcard-txt"><strong translate="no">${paysLabel(e.nom)}</strong>
        <span class="small muted gp-facts"><span><${Icon} name="people" size=${13}/> ${e.laureats.length} lauréat${e.laureats.length > 1 ? 's' : ''} sur place</span>${e.offres.length ? html`<span><${Icon} name="feed" size=${13}/> ${e.offres.length} offre${e.offres.length > 1 ? 's' : ''}</span>` : null}</span>
        <span class="gp-prog"><${Bar} value=${n / total} label=${`${n}/${total}`}/><span class="small mono">${n}/${total}</span></span>
        <span class="small muted">${n ? `${n} rubrique${n > 1 ? 's' : ''} écrite${n > 1 ? 's' : ''} sur ${total}` : 'Guide pas encore commencé'}</span></span>
    </button>`; })}</div>`
      : html`<${Empty} icon="globe" title=${q ? 'Aucun pays ne correspond' : 'Aucun lauréat à l’étranger pour l’instant'}>${q ? 'Essaie un autre nom, en français.' : 'Dès qu’un lauréat indique un pays étranger sur son profil, son pays apparaît ici.'}<//>`}
  </div>`;
}

function PaysView({ ctx, cle }) {
  const { data, me, saison, go, openProfile } = ctx;
  const idx = useMemo(() => indexPays(data, me, saison), [data.guide_pays, data.profiles, data.offers, me, saison]);
  const [edit, setEdit] = useState(null); // rubrique en cours d'écriture
  const [tous, setTous] = useState(false);
  const k = paysKey(cle);
  const e = idx.get(k) || (k && k !== 'maroc' ? { key: k, nom: cap(canonPays(cle)), rows: [], laureats: [], offres: [] } : null);
  if (!e) return html`<div class="sub-page"><button class="btn ghost small back" onClick=${() => go('reseau/etranger')}>← Tous les pays</button><${Empty} icon="globe" title="Pays introuvable"/></div>`;
  const ecrire = paysPourEcrire(me, e);
  const ici = me.role === 'laureat' && !!me.pays && paysKey(me.pays) === e.key;
  const n = ecrites(e); const total = GUIDE_SECTIONS.length;
  const lau = [...e.laureats].sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0) || a.full_name.localeCompare(b.full_name));
  const niv = me.role === 'etudiant' ? niveauOf(me, saison) : 0;
  const gk = groupKey('pays', e.laureats[0]?.pays || e.nom);
  return html`<div class="sub-page etranger">
    <button class="btn ghost small back" onClick=${() => go('reseau/etranger')}>← Tous les pays</button>
    <div class="group-head gp-head">
      <span class="g-badge big k-pays"><${Icon} name="flag" size=${26}/></span>
      <div class="grow"><p class="eyebrow">Guide écrit par les lauréats sur place</p><h2 translate="no">${paysLabel(e.nom)}</h2>
        <p class="muted small">${n} rubrique${n > 1 ? 's' : ''} sur ${total} · ${e.laureats.length} lauréat${e.laureats.length > 1 ? 's' : ''} sur place</p></div>
    </div>

    ${ecrire ? html`<p class="hint-box small"><${Icon} name="heart" size=${15}/><span>${me.role === 'admin' ? 'En tant qu’administration, tu peux écrire, corriger ou supprimer chaque rubrique.' : 'Tu vis ici : complète ou corrige le guide. +10 points par rubrique, et toutes les versions restent dans l’historique.'}</span></p>`
      : ici ? html`<p class="hint-box small gp-mine"><${Icon} name="user" size=${15}/><span class="grow">Pour écrire ce guide, indique « <b translate="no">${e.rows[0]?.pays}</b> » comme pays sur ton profil.</span><button class="btn tiny" onClick=${() => go('profil')}>Mon profil</button></p>`
      : html`<p class="small muted gp-who"><${Icon} name="lock" size=${14}/><span>Seuls les lauréats qui vivent dans ce pays peuvent écrire ce guide. Vérifie toujours les règles officielles : elles changent.</span></p>`}

    ${me.role === 'etudiant' && (niv === 4 || niv === 5) ? html`<${AvantDePartir} ctx=${ctx} e=${e}/>` : null}

    <div class="home-grid gp-layout">
      <div class="home-main gp-sections">
        ${GUIDE_SECTIONS.map(([sec, label, ico]) => html`<${Rubrique} ctx=${ctx} key=${sec} sec=${sec} label=${label} ico=${ico} row=${rubrique(e, sec)} ecrire=${ecrire} editing=${edit === sec} onEdit=${() => setEdit(sec)} onDone=${() => setEdit(null)}/>`)}
      </div>
      <div class="home-side">
        <div class="panel">
          <div class="section-head"><h2 class="h-ico"><${Icon} name="people"/> Lauréats sur place <span class="count">${lau.length}</span></h2></div>
          ${lau.length ? html`<ul class="people-list gp-people">${lau.slice(0, tous ? 40 : 5).map(p => html`<li key=${p.id}><${Person} p=${p} onOpen=${openProfile} sub=${[p.poste, p.entreprise, p.ville].filter(Boolean).join(' · ') || `Promo ${p.promo}`}/></li>`)}</ul>
            ${lau.length > 5 ? html`<button class="linkish small" onClick=${() => setTous(!tous)}>${tous ? 'Voir moins' : `Voir les ${lau.length} lauréats`}</button>` : null}`
            : html`<p class="muted small">Aucun lauréat inscrit n’y vit encore.</p>`}
          ${me.role !== 'admin' && !ici ? html`<button class="btn primary small" onClick=${() => ctx.askQuestion({ pays: e.rows[0]?.pays || e.laureats[0]?.pays || e.nom })}><${Icon} name="qa" size=${15}/> Poser une question</button>
            <p class="small muted gp-note">${lau.length ? 'Elle arrive directement chez les lauréats qui vivent ici.' : 'Elle reste visible par tout le réseau.'}</p>` : null}
          ${gk && lau.length ? html`<button class="linkish small" onClick=${() => go('reseau/groupes/' + encodeURIComponent(gk))}>Voir le groupe des membres sur place</button>` : null}
        </div>
        ${e.offres.length ? html`<div class="section-head"><h2 class="h-ico"><${Icon} name="feed"/> Offres dans ce pays <span class="count">${e.offres.length}</span></h2></div>
          <div class="offer-grid one">${e.offres.slice(0, 4).map(o => html`<${OfferCard} key=${o.id} o=${o} ctx=${ctx} onOpen=${() => ctx.openOffer(o.id)}/>`)}</div>` : null}
      </div>
    </div>
  </div>`;
}

// « Avant de partir » (4A et 5A) : cinq étapes que l'étudiant coche, chacune renvoie vers sa rubrique
function AvantDePartir({ ctx, e }) {
  const { me } = ctx;
  const [faits, setFaits] = useLocal('depart-' + me.id + '-' + e.key, {});
  const n = AVANT.filter(k => faits[k]).length;
  const voir = sec => document.getElementById('gp-' + sec)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return html`<div class="panel gp-avant">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="route"/> Avant de partir</h2><span class="small mono muted">${n}/${AVANT.length}</span></div>
    <ul class="gp-check">${AVANT.map(sec => { const ok = !!faits[sec]; return html`<li class=${ok ? 'ok' : ''} key=${sec}>
      <label class="check"><input id=${'gp-av-' + sec} type="checkbox" checked=${ok} onChange=${ev => setFaits({ ...faits, [sec]: ev.target.checked })}/> <span>${TACHE[sec]}</span></label>
      ${rubrique(e, sec) ? html`<button class="linkish small" onClick=${() => voir(sec)}>Lire le conseil</button>` : html`<span class="small muted">Pas encore écrit</span>`}</li>`; })}</ul>
  </div>`;
}

function Rubrique({ ctx, sec, label, ico, row, ecrire, editing, onEdit, onDone }) {
  const { me, store, openProfile } = ctx;
  const [histo, setHisto] = useState(false);
  const peut = row ? peutModifier(me, row) : !!ecrire;
  const auteur = row?.updated_by ? store.byId('profiles', row.updated_by) : null;
  return html`<article class=${'panel gp-rub' + (row ? '' : ' vide')} id=${'gp-' + sec}>
    <div class="gp-rub-head"><span class="gp-ico"><${Icon} name=${ico} size=${18}/></span><h3>${label}</h3><span class="spacer"></span>
      ${row && !editing && peut ? html`<button class="btn tiny ghost" onClick=${onEdit}><${Icon} name="edit" size=${14}/> Modifier</button>` : null}
      ${row && me.role === 'admin' && !editing ? html`<button class="icon-btn small" aria-label="Supprimer la rubrique" onClick=${() => ctx.confirm('Supprimer cette rubrique ? Son historique part avec elle.', () => ctx.act(async () => { await store.remove('guide_pays', row.id); toast('Rubrique supprimée.'); }))}><${Icon} name="trash" size=${14}/></button>` : null}
    </div>
    ${editing ? html`<${Editeur} ctx=${ctx} sec=${sec} row=${row} pays=${row ? row.pays : ecrire} onDone=${onDone}/>`
      : row ? html`<${Texte} t=${row.contenu}/>
        <div class="gp-foot small muted"><span>Mis à jour par</span> ${auteur ? html`<button class="linkish" translate="no" onClick=${() => openProfile(auteur)}>${auteur.full_name}</button>` : html`<span>un lauréat</span>`}<span>·</span><span>${timeAgo(row.updated_at || row.created_at)}</span>
          <span class="spacer"></span><button class="linkish small" onClick=${() => setHisto(true)}>Historique</button>
          ${row.updated_by !== me.id ? html`<${SignalerBtn} ctx=${ctx} type="guide" id=${row.id} small/>` : null}</div>`
      : html`<p class="muted small gp-vide">${ecrire ? 'Personne n’a encore écrit cette rubrique. Ton expérience vaut de l’or pour les étudiants.' : 'Personne n’a encore écrit cette rubrique. Les lauréats qui vivent ici peuvent la compléter.'}</p>
        ${ecrire ? html`<div><button class="btn small" onClick=${onEdit}><${Icon} name="edit" size=${14}/> Écrire cette rubrique</button></div>` : null}`}
    ${histo ? html`<${Historique} ctx=${ctx} row=${row} label=${label} onClose=${() => setHisto(false)}/>` : null}
  </article>`;
}

function Editeur({ ctx, sec, row, pays, onDone }) {
  const { store, act } = ctx;
  const [txt, setTxt] = useState(row?.contenu || '');
  const [busy, setBusy] = useState(false);
  const t = txt.trim();
  const save = ev => {
    ev.preventDefault(); if (!t || busy) return;
    setBusy(true);
    act(async () => {
      try {
        if (row) await store.update('guide_pays', row.id, { contenu: t });
        else await store.insert('guide_pays', { pays, section: sec, contenu: t });
        toast(row ? 'Rubrique mise à jour. Merci !' : ctx.me.role === 'laureat' ? 'Rubrique publiée. +10 points, merci !' : 'Rubrique publiée.');
        onDone();
      } finally { setBusy(false); }
    });
  };
  return html`<form class="form gp-edit" onSubmit=${save}>
    <${Field} label="Ton conseil" hint="Une ligne qui commence par « - » devient une liste. Les liens https s’affichent tout seuls.">
      <textarea id=${'gp-txt-' + sec} rows="7" maxlength=${MAX} value=${txt} onInput=${ev => setTxt(ev.target.value)} placeholder=${AIDE[sec]} dir="auto"></textarea><//>
    <div class="row"><span class="small muted mono">${txt.length}/${MAX}</span><span class="spacer"></span>
      <button type="button" class="btn ghost small" onClick=${onDone}>Annuler</button>
      <button class="btn primary small" disabled=${!t || busy || t === (row?.contenu || '').trim()}>${row ? 'Enregistrer' : 'Publier'}</button></div>
  </form>`;
}

function Historique({ ctx, row, label, onClose }) {
  const { store } = ctx;
  const [list, setList] = useState(null);
  useEffect(() => { let on = true; store.historiqueGuide(row.id).then(r => on && setList(r || []), () => on && setList([])); return () => { on = false; }; }, [row.id, row.contenu]);
  const qui = id => store.byId('profiles', id)?.full_name;
  const date = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const versions = [{ ...row, actuelle: true }, ...(list || [])];
  return html`<${Modal} title=${'Historique · ' + label} onClose=${onClose} wide>
    ${list === null ? html`<p class="muted small">Chargement…</p>` : html`<ol class="gp-histo">${versions.map(v => html`<li key=${v.id}>
      <p class="small"><b>${v.actuelle ? 'Version actuelle' : 'Version précédente'}</b> <span class="muted">· ${date(v.updated_at || v.created_at)}</span>${qui(v.updated_by) ? html` <span class="muted">·</span> <span translate="no">${qui(v.updated_by)}</span>` : null}</p>
      <${Texte} t=${v.contenu}/></li>`)}</ol>
      ${!list.length ? html`<p class="muted small">Aucune version précédente : la rubrique n’a pas encore été modifiée.</p>` : null}`}
  <//>`;
}

// Texte d'un membre : paragraphes, listes « - », liens https cliquables. Jamais de HTML interprété.
const URL_RE = /https:\/\/[^\s<>"'`]+/g;
function liens(s) {
  const out = []; let last = 0;
  for (const m of s.matchAll(URL_RE)) {
    const u = m[0].replace(/[.,;:!?»)\]]+$/, '');
    out.push(s.slice(last, m.index));
    out.push(html`<a href=${u} target="_blank" rel="noopener noreferrer nofollow" translate="no" dir="ltr">${u.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 48)}${u.length > 60 ? '…' : ''}</a>`);
    last = m.index + u.length;
  }
  out.push(s.slice(last));
  return out;
}
function Texte({ t }) {
  const blocs = [];
  for (const l of String(t || '').replace(/\r/g, '').split('\n')) {
    const s = l.trim(); const puce = /^[-•*]\s+/.test(s);
    if (!s) { blocs.push(null); continue; }
    const last = blocs[blocs.length - 1];
    const txt = puce ? s.replace(/^[-•*]\s+/, '') : s;
    if (last && last.ul === puce) last.lines.push(txt); else blocs.push({ ul: puce, lines: [txt] });
  }
  return html`<div class="gp-texte" translate="no" dir="auto">${blocs.filter(Boolean).map(b => b.ul
    ? html`<ul translate="no">${b.lines.map(l => html`<li translate="no">${liens(l)}</li>`)}</ul>`
    : html`<p translate="no">${b.lines.map((l, i) => html`${i ? html`<br/>` : null}${liens(l)}`)}</p>`)}</div>`;
}

const CSS = `
.etranger .gp-intro p { margin: 0; color: var(--ink-2); }
.etranger .gp-mine { align-items: center; flex-wrap: wrap; }
.etranger .gp-mine .grow { flex: 1 1 220px; min-width: 0; }
.gp-card { text-align: start; cursor: pointer; font: inherit; color: inherit; width: 100%; }
.gp-facts { display: flex; flex-wrap: wrap; gap: .2rem .8rem; }
.gp-facts span { display: inline-flex; align-items: center; gap: .25rem; }
.gp-prog { display: flex; align-items: center; gap: .5rem; margin-top: .35rem; }
.gp-prog .bar { flex: 1; height: 6px; }
.gp-prog .bar-fill { background: var(--brass); }
.gp-head h2 { margin: 0; }
.gp-who { display: flex; align-items: flex-start; gap: .4rem; margin: 0; }
.gp-who svg { flex: none; margin-top: .15rem; }
.gp-sections { gap: .7rem; }
.gp-rub { gap: .55rem; scroll-margin-top: 80px; }
.gp-rub.vide { background: var(--surface-2); border-style: dashed; }
.gp-rub-head { display: flex; align-items: center; gap: .55rem; }
.gp-rub-head h3 { margin: 0; font-size: 1.02rem; }
.gp-ico { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; background: var(--brass-soft); color: var(--brass); flex: none; }
.gp-texte { display: flex; flex-direction: column; gap: .45rem; line-height: 1.55; color: var(--ink); overflow-wrap: anywhere; }
.gp-texte p, .gp-texte ul { margin: 0; }
.gp-texte ul { padding-inline-start: 1.2rem; display: flex; flex-direction: column; gap: .2rem; }
.gp-texte a { color: var(--accent); }
.gp-foot { display: flex; align-items: center; flex-wrap: wrap; gap: .3rem; padding-top: .45rem; border-top: 1px dashed var(--line); }
.gp-vide, .gp-note { margin: 0; }
.gp-edit textarea { min-height: 140px; }
.gp-avant .section-head { margin: 0; }
.gp-check { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: .45rem; }
.gp-check li { display: flex; flex-direction: column; align-items: flex-start; gap: .15rem; padding: .55rem .7rem; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
.gp-check li.ok { background: var(--good-soft); border-color: transparent; }
.gp-check li.ok label span { color: var(--ink-2); text-decoration: line-through; }
.gp-check .check { font-weight: 500; }
.gp-check .linkish, .gp-check .muted { margin-inline-start: 1.6rem; }
.gp-people li { justify-content: flex-start; }
.gp-histo { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .9rem; }
.gp-histo li { padding-bottom: .8rem; border-bottom: 1px solid var(--line); display: flex; flex-direction: column; gap: .35rem; }
.gp-histo li:last-child { border-bottom: 0; }
.gp-histo p { margin: 0; }
@media (max-width: 760px) { .gp-layout { grid-template-columns: minmax(0, 1fr); } }
`;

const LAU = ['خريج واحد', 'خريجان', 'خريجين', 'خريجًا'], OFF = ['عرض واحد', 'عرضان', 'عروض', 'عرضًا'], RUB = ['قسم واحد', 'قسمان', 'أقسام', 'قسمًا'];
addAR({
  'Partir en stage ou en PFE à l’étranger': 'السفر إلى الخارج من أجل تدريب أو مشروع نهاية الدراسة',
  'Ce que les lauréats sur place conseillent : admission, visa, convention, logement, budget. Chaque pays est tenu par ceux qui y vivent.': 'نصائح الخريجين المقيمين هناك: القبول، التأشيرة، اتفاقية التدريب، السكن، الميزانية. دليل كل بلد يكتبه من يعيشون فيه.',
  'Tu vis en': 'أنت تعيش في',
  ': ton expérience aide les étudiants.': ': تجربتك تساعد الطلبة.',
  'Le guide est complet, merci !': 'الدليل مكتمل، شكرًا!',
  'Ouvrir le guide': 'افتح الدليل',
  'Chercher un pays…': 'ابحث عن بلد…',
  'Guide pas encore commencé': 'الدليل لم يبدأ بعد',
  'Aucun pays ne correspond': 'لا يوجد بلد مطابق',
  'Aucun lauréat à l’étranger pour l’instant': 'لا يوجد خريج في الخارج حاليًا',
  'Essaie un autre nom, en français.': 'جرّب اسمًا آخر بالفرنسية.',
  'Dès qu’un lauréat indique un pays étranger sur son profil, son pays apparaît ici.': 'بمجرد أن يذكر خريج بلدًا أجنبيًا في ملفه، يظهر هذا البلد هنا.',
  '← Tous les pays': '→ كل البلدان',
  'Pays introuvable': 'البلد غير موجود',
  'Guide écrit par les lauréats sur place': 'دليل يكتبه الخريجون المقيمون هناك',
  'En tant qu’administration, tu peux écrire, corriger ou supprimer chaque rubrique.': 'بصفتك الإدارة، يمكنك كتابة كل قسم أو تصحيحه أو حذفه.',
  'Tu vis ici : complète ou corrige le guide. +10 points par rubrique, et toutes les versions restent dans l’historique.': 'أنت تعيش هنا: أكمل الدليل أو صحّحه. +10 نقاط لكل قسم، وتبقى كل النسخ في السجل.',
  'Pour écrire ce guide, indique «': 'لكتابة هذا الدليل، اكتب «',
  '» comme pays sur ton profil.': '» كبلد في ملفك الشخصي.',
  'Seuls les lauréats qui vivent dans ce pays peuvent écrire ce guide. Vérifie toujours les règles officielles : elles changent.': 'وحدهم الخريجون المقيمون في هذا البلد يمكنهم كتابة هذا الدليل. تحقّق دائمًا من القواعد الرسمية لأنها تتغير.',
  'Lauréats sur place': 'خريجون هناك',
  'Aucun lauréat inscrit n’y vit encore.': 'لا يعيش هناك أي خريج مسجّل بعد.',
  'Elle arrive directement chez les lauréats qui vivent ici.': 'يصل مباشرة إلى الخريجين المقيمين هنا.',
  'Elle reste visible par tout le réseau.': 'يبقى ظاهرًا لكل الشبكة.',
  'Voir le groupe des membres sur place': 'عرض مجموعة الأعضاء هناك',
  'Offres dans ce pays': 'عروض في هذا البلد',
  'Avant de partir': 'قبل السفر',
  'Vérifier l’admission ou Campus France': 'التحقق من القبول أو Campus France',
  'Préparer le visa': 'تحضير التأشيرة',
  'Faire signer la convention de stage': 'توقيع اتفاقية التدريب',
  'Trouver un logement': 'إيجاد سكن',
  'Prévoir son budget': 'تحديد الميزانية',
  'Lire le conseil': 'اقرأ النصيحة',
  'Pas encore écrit': 'لم يُكتب بعد',
  'Supprimer la rubrique': 'حذف القسم',
  'Supprimer cette rubrique ? Son historique part avec elle.': 'حذف هذا القسم؟ سيُحذف سجلّه معه.',
  'Rubrique supprimée.': 'تم حذف القسم.',
  'Mis à jour par': 'آخر تحديث من',
  'un lauréat': 'خريج',
  'Historique': 'السجل',
  'Personne n’a encore écrit cette rubrique. Ton expérience vaut de l’or pour les étudiants.': 'لم يكتب أحد هذا القسم بعد. تجربتك كنز للطلبة.',
  'Personne n’a encore écrit cette rubrique. Les lauréats qui vivent ici peuvent la compléter.': 'لم يكتب أحد هذا القسم بعد. يمكن للخريجين المقيمين هنا إكماله.',
  'Écrire cette rubrique': 'اكتب هذا القسم',
  'Ton conseil': 'نصيحتك',
  'Une ligne qui commence par « - » devient une liste. Les liens https s’affichent tout seuls.': 'السطر الذي يبدأ بـ « - » يصبح قائمة. روابط https تظهر تلقائيًا.',
  'Les étapes, le calendrier, les pièges à éviter…': 'المراحل، الجدول الزمني، الأخطاء التي يجب تجنبها…',
  'Quel visa, où le demander, les délais, les documents…': 'أي تأشيرة، أين تُطلب، الآجال، الوثائق…',
  'Qui signe, les délais, la gratification…': 'من يوقّع، الآجال، المنحة…',
  'Où chercher, les prix, comment éviter les arnaques…': 'أين تبحث، الأسعار، كيف تتجنب الاحتيال…',
  'Loyer, transport, nourriture : combien par mois ?': 'الكراء، النقل، الأكل: كم في الشهر؟',
  'Où trouver les offres, comment candidater…': 'أين تجد العروض، كيف تترشح…',
  'Banque, téléphone, santé, communauté marocaine…': 'البنك، الهاتف، الصحة، الجالية المغربية…',
  'Rubrique mise à jour. Merci !': 'تم تحديث القسم. شكرًا!',
  'Rubrique publiée. +10 points, merci !': 'تم نشر القسم. +10 نقاط، شكرًا!',
  'Rubrique publiée.': 'تم نشر القسم.',
  'Chargement…': 'جارٍ التحميل…',
  'Version actuelle': 'النسخة الحالية',
  'Version précédente': 'نسخة سابقة',
  'Aucune version précédente : la rubrique n’a pas encore été modifiée.': 'لا توجد نسخة سابقة: لم يُعدَّل هذا القسم بعد.',
  'Campus France et admission': 'Campus France والقبول',
  'Visa et titre de séjour': 'التأشيرة وبطاقة الإقامة',
  'Convention de stage': 'اتفاقية التدريب',
  'Logement': 'السكن',
  'Budget et coût de la vie': 'الميزانية وتكلفة المعيشة',
  'Trouver un stage ou un emploi': 'إيجاد تدريب أو عمل',
  'Vie sur place': 'الحياة هناك',
  'Seuls les lauréats qui vivent dans ce pays peuvent écrire son guide.': 'وحدهم الخريجون المقيمون في هذا البلد يمكنهم كتابة دليله.',
  'Cette rubrique existe déjà : recharge la page pour la modifier.': 'هذا القسم موجود مسبقًا: أعد تحميل الصفحة لتعديله.',
}, [
  [/^Il reste (\d+) rubriques? à écrire\.$/, n => `بقي ${arCount(n, RUB)} للكتابة.`],
  [/^(\d+) lauréats? sur place$/, n => `${arCount(n, LAU)} هناك`],
  [/^(\d+) offres?$/, n => arCount(n, OFF)],
  [/^(\d+) rubriques? écrites? sur (\d+)$/, (n, t) => `${n} من ${t} أقسام مكتوبة`],
  [/^(\d+) rubriques? sur (\d+) · (\d+) lauréats? sur place$/, (n, t, l) => `${n} من ${t} أقسام · ${arCount(l, LAU)} هناك`],
  [/^Voir les (\d+) lauréats$/, n => `عرض كل الخريجين (${n})`],
]);
