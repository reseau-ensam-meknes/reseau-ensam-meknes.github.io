// Réseau vivant, à l'écran : pastilles de réactions (offres, demandes) et réponses sous une demande.
// Toucher une pastille montre qui a réagi ; « Réagir » ouvre les cinq émojis, la même émoji retire la réaction.
// Mise à jour tout de suite (store.reagirPublic), comme les réactions des messages. Pas de points pour une réaction.
// Les règles (qui lit, qui réagit, qui répond) sont dans reseau-vivant.js et dans la base.
import { html, useState, useEffect, useLayoutEffect, useRef } from './vendor/preact-htm.js';
import { Icon, Modal, Avatar, toast, injectCSS } from './ui.js';
import { addAR, getLang } from './i18n.js';
import { timeAgo } from './logic.js';
import { SignalerBtn } from './confiance.js';
import { EMOJIS_PUBLICS, REPONSE_MAX, reactionsSur, pastilles, auteurCible, quiAReagiTexte } from './reseau-vivant.js';

// Partout pareil (carte d'offre dans la liste, fiche, demande) : on réagit sans ouvrir la fiche.
// Toucher une pastille = réagir avec cette émoji (ou la retirer si c'est la mienne) ; le bouton souriant ouvre les cinq
// émojis à la place de la ligne (rien ne bouge autour, rien n'est coupé par la carte) ; « N réactions » montre qui.
// Sur sa propre publication : on voit les pastilles et qui a réagi, sans réagir.
export function Reactions({ ctx, cible, cls = '' }) {
  const { data, me, store } = ctx;
  const [barre, setBarre] = useState(false);
  const [qui, setQui] = useState(null);
  const ref = useRef(null);
  // Le choix se ferme en touchant ailleurs ou avec Échap (useLayoutEffect : écouté dès l'ouverture) ; le focus va sur une émoji
  useLayoutEffect(() => {
    if (!barre) return;
    ref.current?.querySelector('.rx-btn.on, .rx-btn')?.focus({ preventScroll: true });
    const dehors = e => { if (ref.current && !ref.current.contains(e.target)) setBarre(false); };
    const echap = e => { if (e.key === 'Escape') { e.stopPropagation(); setBarre(false); } };
    document.addEventListener('pointerdown', dehors, true); document.addEventListener('keydown', echap, true);
    return () => { document.removeEventListener('pointerdown', dehors, true); document.removeEventListener('keydown', echap, true); };
  }, [barre]);
  if (!store.peutReagirPublic?.()) return null;
  const liste = reactionsSur(data, cible);
  const ps = pastilles(liste);
  const peut = auteurCible(data, cible) !== me.id;
  const mienne = liste.find(r => r.user_id === me.id)?.emoji || null;
  if (!ps.length && !peut) return null;
  const reagir = e => {
    setBarre(false);
    try { if (e && navigator.vibrate) navigator.vibrate(8); } catch {}
    store.reagirPublic(cible, e).catch(err => toast(err.message || String(err), 'err'));
  };
  const total = liste.length;
  const stop = e => e.stopPropagation();
  if (barre) return html`<div ref=${ref} class=${'rx rx-choix' + (cls ? ' ' + cls : '')} role="group" aria-label="Choisir une réaction" onClick=${stop}>
    <div class="rx-bar">${EMOJIS_PUBLICS.map((e, i) => html`<button type="button" key=${e} class=${'rx-btn' + (mienne === e ? ' on' : '')} style=${`--i:${i}`}
      aria-pressed=${mienne === e} aria-label=${(mienne === e ? 'Retirer ma réaction ' : 'Réagir avec ') + e} onClick=${() => reagir(mienne === e ? null : e)}>${e}</button>`)}</div>
    <button type="button" class="icon-btn small rx-fermer" aria-label="Fermer" onClick=${() => setBarre(false)}><${Icon} name="x" size=${16}/></button>
  </div>`;
  return html`<div ref=${ref} class=${'rx' + (cls ? ' ' + cls : '')} role="group" aria-label="Réactions" onClick=${stop}>
    ${ps.map(p => {
      const moi = p.emoji === mienne;
      return html`<button type="button" key=${p.emoji} class=${'rx-pill' + (moi ? ' mien' : '')} aria-pressed=${peut ? moi : undefined}
        aria-label=${peut ? (moi ? `Retirer ma réaction ${p.emoji}` : `Réagir avec ${p.emoji}`) + ` (${p.qui.length})` : `${p.emoji} ${p.qui.length} : voir qui a réagi`}
        ...${peut ? appuiLong(() => setBarre(true)) : {}}
        onClick=${e => { if (e.currentTarget.dataset.long) { delete e.currentTarget.dataset.long; return; } peut ? reagir(moi ? null : p.emoji) : setQui(p.emoji); }}>${p.emoji}<span class="rx-n">${p.qui.length}</span></button>`;
    })}
    ${peut ? html`<button type="button" class=${'rx-ajouter' + (ps.length ? ' seul' : '')} aria-expanded="false" aria-label="Réagir" onClick=${() => setBarre(true)}>
      <${Icon} name="smile" size=${17}/>${ps.length ? html`<span class="rx-plus" aria-hidden="true">+</span>` : html`<span>Réagir</span>`}</button>` : null}
    ${total ? html`<button type="button" class="linkish rx-total" aria-label=${total === 1 ? '1 réaction : voir qui' : `${total} réactions : voir qui`}
      onClick=${() => setQui(mienne || ps[0].emoji)}><span translate="no" dir="auto">${quiAReagiTexte(liste, me.id, id => store.byId('profiles', id), getLang())}</span></button>` : null}
    ${qui ? html`<${QuiAReagi} ctx=${ctx} liste=${liste} premier=${qui} onRetirer=${() => { setQui(null); reagir(null); }} onClose=${() => setQui(null)}/>` : null}
  </div>`;
}

// Appui long (450 ms) sur une pastille : le choix des cinq émojis, comme dans les messageries ; le clic qui suit est ignoré
function appuiLong(ouvrir) {
  let t = null;
  const fin = () => { clearTimeout(t); t = null; };
  return {
    onPointerDown: e => { const el = e.currentTarget; fin(); t = setTimeout(() => { el.dataset.long = '1'; try { navigator.vibrate?.(12); } catch {} ouvrir(); }, 450); },
    onPointerUp: fin, onPointerLeave: fin, onPointerCancel: fin,
    onContextMenu: e => e.preventDefault(),
  };
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
.rx { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem; min-width: 0; min-height: 44px; }
.rx-pill { display: inline-flex; align-items: center; gap: .3rem; min-height: 36px; min-width: 48px; justify-content: center; padding: 0 .6rem; border: 0; border-radius: 999px;
  background: var(--surface-2); color: var(--ink); font: inherit; font-size: 1rem; line-height: 1; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.rx-pill:hover { background: var(--tonal-hover, var(--surface-2)); }
.rx-pill.mien { background: var(--accent-soft); box-shadow: inset 0 0 0 1.5px var(--accent); }
.rx-pill.mien .rx-n { color: var(--tonal-ink, var(--ink)); }
.rx-n { font-size: var(--fs-1); font-weight: 600; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.rx-ajouter { display: inline-flex; align-items: center; gap: .3rem; min-height: 36px; min-width: 44px; justify-content: center; padding: 0 .7rem; border: 0; border-radius: 999px;
  background: none; color: var(--ink-2); font: inherit; font-size: var(--fs-2); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.rx-ajouter:hover { background: var(--surface-2); color: var(--ink); }
.rx-ajouter.seul { padding: 0 .55rem; }
.rx-plus { font-weight: 700; font-size: .85rem; margin-inline-start: -.2rem; }
.rx-total { margin-inline-start: auto; font-size: var(--fs-1); color: var(--muted); padding: .5rem .25rem; min-height: 36px; }
.rx-choix { flex-wrap: nowrap; justify-content: space-between; }
.rx-bar { display: flex; gap: 2px; padding: 0; border-radius: 999px; background: var(--raised); box-shadow: var(--sh2, var(--sh3)); min-width: 0; }
.rx-btn { width: 44px; height: 44px; flex: 0 0 auto; border-radius: 50%; border: 0; background: none; font-size: 1.4rem; line-height: 1; cursor: pointer; display: grid; place-items: center; -webkit-tap-highlight-color: transparent; }
.rx-btn:hover { background: var(--surface-2); }
.rx-btn.on { background: var(--accent-soft); box-shadow: inset 0 0 0 2px var(--accent); }
.rx-fermer { flex: 0 0 auto; }
@media (max-width: 359px) { .rx-btn { width: 40px; height: 40px; } }
@media (prefers-reduced-motion: no-preference) {
  .rx-pill { animation: rx-pop .28s var(--ease); transition: transform .12s var(--ease); }
  .rx-pill:active, .rx-ajouter:active { transform: scale(.92); }
  .rx-bar { animation: rx-in .2s var(--ease); }
  .rx-btn { animation: rx-btn .26s var(--ease) both; animation-delay: calc(var(--i, 0) * 28ms); transition: transform .15s var(--ease); }
  .rx-btn:hover { transform: translateY(-3px) scale(1.12); } .rx-btn:active { transform: scale(.88); }
}
@keyframes rx-pop { 0% { transform: scale(.5); opacity: 0; } 70% { transform: scale(1.12); } 100% { transform: none; opacity: 1; } }
@keyframes rx-in { from { opacity: 0; transform: scale(.92); } }
@keyframes rx-btn { from { opacity: 0; transform: translateY(6px) scale(.7); } }
.ocard-rx { padding: 0 .8rem; margin-bottom: .2rem; }
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
  'Réactions': 'التفاعلات', 'Réagir': 'تفاعل', 'Choisir une réaction': 'اختيار تفاعل', '1 réaction': 'تفاعل واحد',
  'Auteur de la demande': 'صاحب الطلب',
  'Pas encore de réponse. Les lauréats et les étudiants de ton année peuvent t’en laisser une.': 'لا يوجد رد بعد. يمكن للخريجين ولطلبة سنتك ترك رد لك.',
  'Pas encore de réponse. Un conseil, un contact : tout le monde la verra.': 'لا يوجد رد بعد. نصيحة أو جهة اتصال: سيراها الجميع.',
  'Un conseil, un contact ? Tout le monde verra ta réponse.': 'نصيحة أو جهة اتصال؟ سيرى الجميع ردك.',
  'Ta réponse fait entre 2 et 500 caractères.': 'يتراوح ردك بين حرفين و500 حرف.', 'Cette demande est fermée.': 'هذا الطلب مغلق.',
  'Tu ne réagis pas à ta propre publication.': 'لا يمكنك التفاعل مع منشورك.', 'Tu as déjà réagi.': 'سبق أن تفاعلت.',
}, [
  [/^(\S+) (\d+) : voir qui a réagi$/, (e, n) => `${e} ${n}: عرض من تفاعل`],
  [/^(\d+) réactions : voir qui$/, n => `التفاعلات: ${n}، عرض من تفاعل`],
  [/^Réagir avec (\S+) \((\d+)\)$/, (e, n) => `التفاعل بـ ${e} (${n})`],
  [/^Retirer ma réaction (\S+) \((\d+)\)$/, (e, n) => `سحب تفاعلي ${e} (${n})`],
  [/^Réponses \((\d+)\)$/, n => `الردود (${n})`],
  [/^(\d+) réactions sur « (.+) »$/, (n, t) => `عدد التفاعلات: ${n} على «${t}»`],
  [/^(.+?) a réagi (\S+) à « (.+) »$/, (x, e, t) => `تفاعل ${e} من ${x} مع «${t}»`],
  [/^(.+?) a répondu à ta demande : « (.+) »$/, (x, t) => `رد من ${x} على طلبك: «${t}»`],
]);
