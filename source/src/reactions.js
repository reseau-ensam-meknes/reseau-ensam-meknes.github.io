// Réseau vivant, à l'écran : pastilles de réactions (offres, demandes) et réponses sous une demande.
// Toucher une pastille montre qui a réagi ; « Réagir » ouvre les cinq émojis, la même émoji retire la réaction.
// Mise à jour tout de suite (store.reagirPublic), comme les réactions des messages. Pas de points pour une réaction.
// Les règles (qui lit, qui réagit, qui répond) sont dans reseau-vivant.js et dans la base.
import { html, useState, useEffect } from './vendor/preact-htm.js';
import { Icon, Modal, Avatar, toast, injectCSS } from './ui.js';
import { addAR } from './i18n.js';
import { timeAgo } from './logic.js';
import { SignalerBtn } from './confiance.js';
import { EMOJIS_PUBLICS, REPONSE_MAX, reactionsSur, pastilles, auteurCible } from './reseau-vivant.js';

// compact : sur une carte d'offre, les pastilles seulement (on réagit dans la fiche)
export function Reactions({ ctx, cible, compact = false, cls = '' }) {
  const { data, me, store } = ctx;
  const [barre, setBarre] = useState(false);
  const [qui, setQui] = useState(null);
  if (!store.peutReagirPublic?.()) return null;
  const liste = reactionsSur(data, cible);
  const ps = pastilles(liste);
  const peut = !compact && auteurCible(data, cible) !== me.id;
  const mienne = liste.find(r => r.user_id === me.id)?.emoji || null;
  if (!ps.length && !peut) return null;
  const reagir = e => { setBarre(false); store.reagirPublic(cible, e).catch(err => toast(err.message || String(err), 'err')); };
  return html`<div class=${'rx' + (compact ? ' rx-compact' : '') + (cls ? ' ' + cls : '')} role="group" aria-label="Réactions">
    ${ps.map(p => html`<button type="button" key=${p.emoji} class=${'rx-pill' + (p.qui.includes(me.id) ? ' mien' : '')}
      aria-label=${`${p.emoji} ${p.qui.length} : voir qui a réagi`} onClick=${e => { e.stopPropagation(); setQui(p.emoji); }}>${p.emoji}<span class="rx-n">${p.qui.length}</span></button>`)}
    ${peut ? html`<button type="button" class=${'rx-ajouter' + (mienne ? ' on' : '')} aria-expanded=${barre} onClick=${() => setBarre(!barre)}><${Icon} name="thumb" size=${15}/> Réagir</button>` : null}
    ${barre ? html`<div class="rx-bar" role="group" aria-label="Choisir une réaction">${EMOJIS_PUBLICS.map(e => html`<button type="button" key=${e} class=${'rx-btn' + (mienne === e ? ' on' : '')}
      aria-pressed=${mienne === e} aria-label=${(mienne === e ? 'Retirer ma réaction ' : 'Réagir avec ') + e} onClick=${() => reagir(e)}>${e}</button>`)}</div>` : null}
    ${qui ? html`<${QuiAReagi} ctx=${ctx} liste=${liste} premier=${qui} onRetirer=${() => { setQui(null); reagir(null); }} onClose=${() => setQui(null)}/>` : null}
  </div>`;
}

// Qui a réagi : l'émoji touché d'abord, puis les plus récents ; sa propre réaction se retire ici aussi
function QuiAReagi({ ctx, liste, premier, onRetirer, onClose }) {
  const { store, me, openProfile } = ctx;
  useEffect(() => { if (!liste.length) onClose(); }, [liste.length]);
  const ordre = [...liste].sort((a, b) => (b.emoji === premier) - (a.emoji === premier) || new Date(b.created_at) - new Date(a.created_at));
  return html`<${Modal} title="Réactions" onClose=${onClose} cls="rx-feuille">
    <ul class="rx-qui">${ordre.map(r => {
      const p = store.byId('profiles', r.user_id), moi = r.user_id === me.id;
      return html`<li key=${r.id}><${Avatar} p=${p} size=${36}/>
        ${moi ? html`<span class="rx-nom">Toi</span>` : html`<button type="button" class="linkish rx-nom" onClick=${() => { onClose(); if (p) openProfile(p); }}>${p ? html`<span translate="no" dir="auto">${p.full_name}</span>` : 'Un membre'}</button>`}
        <span class="rx-emo" aria-label=${r.emoji}>${r.emoji}</span>
        ${moi ? html`<button type="button" class="btn tiny ghost rx-retirer" onClick=${onRetirer}>Retirer</button>` : null}</li>`;
    })}</ul>
  <//>`;
}

// Sous une demande : ses réactions, et « Réponses » qui s'ouvre sur place
export function DemandeSocial({ ctx, d, ouvrir = false, fin = null }) {
  const { data, store } = ctx;
  const [ouvert, setOuvert] = useState(ouvrir);
  const n = (data.reponses_demandes || []).filter(r => r.demande_id === d.id).length;
  const avecRep = store.peutRepondreDemande?.() && (n > 0 || d.status !== 'fermee');
  const rx = html`<${Reactions} ctx=${ctx} cible=${{ demande_id: d.id }}/>`;
  return html`<div class="dm-social">${rx}<span class="spacer"></span>
      <span class="dm-social-fin">${avecRep ? html`<button type="button" class="btn tiny ghost dm-rep-btn" aria-expanded=${ouvert} onClick=${() => setOuvert(!ouvert)}><${Icon} name="comment" size=${14}/> ${n ? `Réponses (${n})` : 'Répondre'}</button>` : null}${fin}</span></div>
    ${ouvert && avecRep ? html`<${Reponses} ctx=${ctx} d=${d}/>` : null}`;
}

// Réponses courtes, lues par ceux qui lisent la demande : un conseil, un contact. Même allure que les questions d'une offre.
export function Reponses({ ctx, d }) {
  const { data, me, store, act, openProfile } = ctx;
  const [txt, setTxt] = useState('');
  const liste = (data.reponses_demandes || []).filter(r => r.demande_id === d.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const auteur = d.auteur_id === me.id;
  const peut = d.status !== 'fermee';
  const envoyer = e => {
    e.preventDefault();
    const t = txt.trim(); if (t.length < 2) return;
    act(async () => { await store.insert('reponses_demandes', { demande_id: d.id, author_id: me.id, body: t }); setTxt(''); });
  };
  return html`<div class="comments dm-reponses">
    ${liste.length ? null : html`<p class="small muted">${auteur ? 'Pas encore de réponse. Les lauréats et les étudiants de ton année peuvent t’en laisser une.' : 'Pas encore de réponse. Un conseil, un contact : tout le monde la verra.'}</p>`}
    ${liste.map(r => {
      const a = store.byId('profiles', r.author_id);
      const retirer = r.author_id === me.id || auteur || me.role === 'admin';
      return html`<div class="comment" key=${r.id} id=${'rep-' + r.id}>
        <${Avatar} p=${a} size=${28}/>
        <div class="comment-body"><button type="button" class="linkish" onClick=${() => a && openProfile(a)}>${a ? html`<span translate="no" dir="auto">${a.full_name}</span>` : 'Membre'}</button>${r.author_id === d.auteur_id ? html` <span class="mini">Auteur de la demande</span>` : null} <span class="muted small">${timeAgo(r.created_at)}</span><p translate="no" dir="auto">${r.body}</p></div>
        ${retirer ? html`<button type="button" class="icon-btn small" aria-label="Supprimer" onClick=${() => act(() => store.remove('reponses_demandes', r.id))}><${Icon} name="x" size=${14}/></button>` : html`<${SignalerBtn} ctx=${ctx} type="reponse_demande" id=${r.id} small/>`}
      </div>`;
    })}
    ${peut ? html`<form class="comment-form dm-rep-form" onSubmit=${envoyer}>
      <input id=${'rep-txt-' + d.id} aria-label="Ta réponse" placeholder=${auteur ? 'Répondre…' : 'Un conseil, un contact ? Tout le monde verra ta réponse.'} value=${txt} onInput=${e => setTxt(e.target.value)} maxlength=${REPONSE_MAX}/>
      <button class="btn small" type="submit" disabled=${txt.trim().length < 2}>Envoyer</button>
    </form>` : null}
  </div>`;
}

injectCSS('reactions', `
.rx { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem; min-width: 0; }
.rx-pill { display: inline-flex; align-items: center; gap: .25rem; min-height: 32px; min-width: 44px; justify-content: center; padding: 0 .55rem; border: 0; border-radius: 999px;
  background: var(--surface-2); color: var(--ink); font: inherit; font-size: .95rem; line-height: 1; cursor: pointer; }
.rx-pill.mien { background: var(--accent-soft); box-shadow: inset 0 0 0 1.5px var(--accent); }
.rx-n { font-size: var(--fs-1); font-weight: 600; color: var(--ink-2); }
.rx-ajouter { display: inline-flex; align-items: center; gap: .3rem; min-height: 32px; padding: 0 .65rem; border: 1px dashed var(--line-strong); border-radius: 999px; background: none; color: var(--ink-2); font: inherit; font-size: var(--fs-2); cursor: pointer; }
.rx-ajouter.on { border-style: solid; }
.rx-bar { flex-basis: 100%; display: flex; flex-wrap: wrap; gap: 2px; padding: 3px; border-radius: 999px; background: var(--raised); box-shadow: var(--sh3); width: max-content; max-width: 100%; }
.rx-btn { width: 44px; height: 44px; border-radius: 50%; border: 0; background: none; font-size: 1.3rem; line-height: 1; cursor: pointer; display: grid; place-items: center; }
.rx-btn:hover { background: var(--surface-2); }
.rx-btn.on { background: var(--accent-soft); box-shadow: inset 0 0 0 2px var(--accent); }
@media (prefers-reduced-motion: no-preference) {
  .rx-pill { animation: rx-pop .25s var(--ease); }
  .rx-bar { animation: rx-in .18s var(--ease); }
  .rx-btn { transition: transform .15s var(--ease); } .rx-btn:active { transform: scale(.9); }
}
@keyframes rx-pop { from { transform: scale(.6); opacity: 0; } }
@keyframes rx-in { from { opacity: 0; transform: translateY(4px); } }
.ocard-rx { padding: 0 1.05rem .55rem; }
.od-rx { margin-block: var(--sp-2, .5rem); }
.rx-qui { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .5rem; }
.rx-qui li { display: flex; align-items: center; gap: .6rem; min-height: 44px; min-width: 0; }
.rx-nom { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: start; }
.rx-emo { font-size: 1.2rem; }
.dm-social { display: flex; align-items: center; flex-wrap: wrap; gap: .4rem; padding-top: var(--sp-2, .5rem); border-top: 1px solid var(--line); min-width: 0; }
.dm-social > .rx { flex: 1 1 auto; }
.dm-social > .rx + .spacer { display: none; }
.dm-social-fin { display: inline-flex; align-items: center; gap: .25rem; margin-inline-start: auto; flex-shrink: 0; }
.dm-social-fin:empty { display: none; }
.dm-reponses { padding-top: .5rem; }
.dm-reponses > p { margin: 0; }
.dm-rep-form input { flex: 1; min-width: 0; font-size: 16px; }
.dm-nb-aides { display: flex; align-items: center; gap: .35rem; margin: 0; color: var(--good, inherit); }
`);

addAR({
  'Réactions': 'التفاعلات', 'Réagir': 'تفاعل', 'Choisir une réaction': 'اختيار تفاعل',
  'Auteur de la demande': 'صاحب الطلب',
  'Pas encore de réponse. Les lauréats et les étudiants de ton année peuvent t’en laisser une.': 'لا يوجد رد بعد. يمكن للخريجين ولطلبة سنتك ترك رد لك.',
  'Pas encore de réponse. Un conseil, un contact : tout le monde la verra.': 'لا يوجد رد بعد. نصيحة أو جهة اتصال: سيراها الجميع.',
  'Un conseil, un contact ? Tout le monde verra ta réponse.': 'نصيحة أو جهة اتصال؟ سيرى الجميع ردك.',
  'Ta réponse fait entre 2 et 500 caractères.': 'يتراوح ردك بين حرفين و500 حرف.', 'Cette demande est fermée.': 'هذا الطلب مغلق.',
  'Tu ne réagis pas à ta propre publication.': 'لا يمكنك التفاعل مع منشورك.', 'Tu as déjà réagi.': 'سبق أن تفاعلت.',
}, [
  [/^(\S+) (\d+) : voir qui a réagi$/, (e, n) => `${e} ${n}: عرض من تفاعل`],
  [/^Réponses \((\d+)\)$/, n => `الردود (${n})`],
  [/^(\d+) réactions sur « (.+) »$/, (n, t) => `عدد التفاعلات: ${n} على «${t}»`],
  [/^(.+?) a réagi (\S+) à « (.+) »$/, (x, e, t) => `تفاعل ${e} من ${x} مع «${t}»`],
  [/^(.+?) a répondu à ta demande : « (.+) »$/, (x, t) => `رد من ${x} على طلبك: «${t}»`],
]);
