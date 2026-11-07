// Accueil : la rangée « Réussites », des visages comme des histoires. Un appui ouvre la réussite en plein écran, et on dit bravo
// d'un geste. Seulement ce qui est vérifié des deux côtés (status « confirme »), jamais un chiffre inventé ni un classement.
// « Déjà vue » est gardé par membre dans ce navigateur : l'anneau s'éteint, rien d'autre ne change.
import { html, useState, useEffect, useRef } from './vendor/preact-htm.js';
import { Icon, Avatar, injectCSS, mouvementReduit, useFeuille } from './ui.js';
import { niveauOf, timeAgo, AIDES, ecoleDuContenu } from './logic.js';
import { addAR } from './i18n.js';

const MAX = 12, DUREE = 6000;
const WHAT = { stage: 'son stage', pfe: 'son PFE', etranger: 'son stage à l’étranger', emploi: 'son premier emploi' };
const cle = id => 'reussites-vues-' + id;
const lireVues = id => { try { return new Set(JSON.parse(localStorage.getItem(cle(id)) || '[]')); } catch { return new Set(); } };
const noterVues = (id, s) => { try { localStorage.setItem(cle(id), JSON.stringify([...s].slice(-200))); } catch { /* stockage indisponible */ } };
const vibrer = m => { try { navigator.vibrate?.(m); } catch { /* pas de vibreur */ } };

// Les réussites vérifiées de la saison ; un étudiant voit celles de son année, comme dans le fil
export function reussitesVisibles(data, me, saison) {
  const n = me.role === 'etudiant' ? niveauOf(me, saison) : null;
  return (data.placements || []).filter(p => p.saison === saison && p.status === 'confirme' && (n === null || p.niveau === n || p.student_id === me.id))
    .sort((a, b) => new Date(b.confirmed_at || b.created_at) - new Date(a.confirmed_at || a.created_at)).slice(0, MAX);
}

export function ReussitesRail({ ctx }) {
  const { data, me, saison, store } = ctx;
  const items = reussitesVisibles(data, me, saison);
  const [vues, setVues] = useState(() => lireVues(me.id));
  const [ouvert, setOuvert] = useState(-1);
  if (!items.length) return null;
  // Celles qu'on n'a pas encore vues d'abord
  const liste = [...items.filter(p => !vues.has(p.id)), ...items.filter(p => vues.has(p.id))];
  const vu = id => setVues(v => { if (v.has(id)) return v; const s = new Set(v); s.add(id); noterVues(me.id, s); return s; });
  return html`<section class="rs-rail" aria-label="Réussites">
    <ul class="rs-liste" role="list">${liste.map((p, i) => {
      const st = store.byId('profiles', p.student_id);
      return html`<li key=${p.id}><button type="button" class=${'rs-visage' + (vues.has(p.id) ? ' vue' : '')} aria-haspopup="dialog" onClick=${() => setOuvert(i)}>
        <span class="rs-anneau"><${Avatar} p=${st} size=${56}/></span>
        <span class="rs-nom" translate="no" dir="auto">${(st?.full_name || '').split(' ')[0]}</span>
      </button></li>`;
    })}</ul>
    ${ouvert >= 0 ? html`<${Histoire} ctx=${ctx} liste=${liste} debut=${ouvert} onVu=${vu} onClose=${() => setOuvert(-1)}/>` : null}
  </section>`;
}

function Histoire({ ctx, liste, debut, onVu, onClose }) {
  const { data, me, store, act, openProfile } = ctx;
  const [i, setI] = useState(debut);
  const calme = mouvementReduit();
  const fermer = useRef(null);
  useFeuille(onClose);
  const p = liste[i];
  const suite = () => (i + 1 < liste.length ? setI(i + 1) : onClose());
  const avant = () => setI(Math.max(0, i - 1));
  useEffect(() => { fermer.current?.focus(); }, []);
  useEffect(() => { if (p) onVu(p.id); }, [p?.id]);
  useEffect(() => {
    const k = e => { if (e.key === 'ArrowRight') suite(); else if (e.key === 'ArrowLeft') avant(); else if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    if (calme) return () => document.removeEventListener('keydown', k);
    const t = setTimeout(suite, DUREE);
    return () => { clearTimeout(t); document.removeEventListener('keydown', k); };
  }, [i]);
  if (!p) return null;
  const st = store.byId('profiles', p.student_id), la = p.laureat_id ? store.byId('profiles', p.laureat_id) : null;
  const k = (data.kudos || []).filter(x => x.placement_id === p.id), mine = k.find(x => x.user_id === me.id);
  const bravo = () => { vibrer(12); act(() => (mine ? store.remove('kudos', mine.id) : store.insert('kudos', { placement_id: p.id, user_id: me.id, ...ecoleDuContenu(me, p) }))); };
  const voir = q => { onClose(); openProfile(q); };
  return html`<div class="rs-histoire" role="dialog" aria-modal="true" aria-label="Réussites">
    <div class="rs-barres" aria-hidden="true">${liste.map((x, n) => html`<i key=${x.id} class=${n < i ? 'faite' : n === i ? (calme ? 'faite' : 'cours') : ''} style=${`--d:${DUREE}ms`}></i>`)}</div>
    <button type="button" class="rs-fermer" ref=${fermer} aria-label="Fermer" onClick=${onClose}><${Icon} name="x" size=${22}/></button>
    <button type="button" class="rs-zone av" tabindex="-1" aria-label="Précédente" onClick=${avant}></button>
    <button type="button" class="rs-zone ap" tabindex="-1" aria-label="Suivante" onClick=${suite}></button>
    <div class="rs-corps" key=${p.id}>
      <p class="rs-oeil"><${Icon} name="trophy" size=${16}/> <span>Une réussite du réseau</span></p>
      <button type="button" class="rs-photo" onClick=${() => st && voir(st)}><${Avatar} p=${st} size=${120}/></button>
      <h2 class="rs-titre"><span translate="no" dir="auto">${st?.full_name || 'Un étudiant'}</span> a décroché ${WHAT[p.type]} chez <span translate="no">${p.entreprise}</span></h2>
      ${la ? html`<button type="button" class="rs-aide" onClick=${() => voir(la)}><${Avatar} p=${la} size=${34}/><span>${AIDES[p.aide]?.annonce || 'grâce à'} <span translate="no" dir="auto">${la.full_name}</span></span></button>` : null}
      <p class="rs-preuve"><${Icon} name="check" size=${15}/> <span>Vérifié des deux côtés · ${timeAgo(p.confirmed_at || p.created_at)}</span></p>
      <button type="button" class=${'rs-bravo' + (mine ? ' on' : '')} aria-pressed=${!!mine} disabled=${p.student_id === me.id} onClick=${bravo}><${Icon} name="clap" size=${22}/> <span>Bravo</span>${k.length ? html`<b>${k.length}</b>` : null}</button>
    </div>
  </div>`;
}

injectCSS('reussites', `
.rs-rail { min-inline-size: 0; margin-inline: calc(var(--sp-2, .5rem) * -1); }
.rs-liste { list-style: none; margin: 0; padding: 2px var(--sp-2, .5rem) 4px; display: flex; gap: .7rem; overflow-x: auto; scrollbar-width: none; scroll-snap-type: x proximity; }
.rs-liste::-webkit-scrollbar { display: none; }
.rs-liste li { flex: none; scroll-snap-align: start; }
.rs-visage { display: flex; flex-direction: column; align-items: center; gap: .3rem; inline-size: 72px; padding: 0; border: 0; background: none; color: var(--ink-2); cursor: pointer; font: inherit; }
.rs-anneau { display: grid; place-items: center; inline-size: 66px; block-size: 66px; border-radius: 50%; padding: 3px; background: conic-gradient(from 210deg, var(--blue, #1670a8), #58c0ef, #ffc65c, #f7941d, var(--blue, #1670a8)); transition: transform .18s ease; }
.rs-anneau > * { box-shadow: 0 0 0 2px var(--surface); }
.rs-visage.vue .rs-anneau { background: var(--line); }
.rs-visage:active .rs-anneau { transform: scale(.94); }
.rs-nom { max-inline-size: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--fs-2); font-weight: 600; }
.rs-histoire { position: fixed; inset: 0; z-index: 1000; display: flex; flex-direction: column; color: #fff; background: radial-gradient(120% 80% at 50% 12%, #124a7c 0%, transparent 62%), radial-gradient(90% 60% at 90% 100%, #7a4a12 0%, transparent 60%), #06122a; animation: rs-entree .22s ease both; }
@keyframes rs-entree { from { opacity: 0; transform: scale(.97); } }
.rs-barres { display: flex; gap: 4px; padding: calc(env(safe-area-inset-top, 0px) + 12px) 14px 0; }
.rs-barres i { position: relative; flex: 1; block-size: 3px; border-radius: 3px; overflow: hidden; background: rgba(255,255,255,.28); }
.rs-barres i::after { content: ""; position: absolute; inset: 0; background: #fff; transform: scaleX(0); transform-origin: left; }
[dir="rtl"] .rs-barres i::after { transform-origin: right; }
.rs-barres i.faite::after { transform: none; }
.rs-barres i.cours::after { animation: rs-barre var(--d) linear forwards; }
@keyframes rs-barre { to { transform: none; } }
.rs-fermer { position: absolute; inset-block-start: calc(env(safe-area-inset-top, 0px) + 24px); inset-inline-end: 10px; z-index: 3; inline-size: 44px; block-size: 44px; display: grid; place-items: center; border: 0; border-radius: 50%; background: rgba(255,255,255,.12); color: #fff; cursor: pointer; }
.rs-zone { position: absolute; inset-block: 72px 0; inline-size: 34%; border: 0; background: none; cursor: pointer; z-index: 1; }
.rs-zone.av { inset-inline-start: 0; } .rs-zone.ap { inset-inline-end: 0; }
.rs-corps { position: relative; z-index: 2; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 1.5rem 1.6rem 2.2rem; text-align: center; pointer-events: none; animation: rs-corps .42s cubic-bezier(.2,.9,.3,1.2) both; }
.rs-corps button { pointer-events: auto; }
@keyframes rs-corps { from { opacity: 0; transform: translateY(18px) scale(.97); } }
.rs-oeil { display: inline-flex; align-items: center; gap: .4rem; margin: 0; color: #ffc65c; font-weight: 700; font-size: var(--fs-3); }
.rs-photo { padding: 5px; border: 0; border-radius: 50%; background: linear-gradient(135deg, #58c0ef, #ffc65c); cursor: pointer; }
.rs-titre { margin: 0; max-inline-size: 22rem; color: #fff; font: 700 clamp(1.45rem, 6vw, 1.9rem)/1.22 var(--f-display); overflow-wrap: anywhere; }
.rs-aide { display: inline-flex; align-items: center; gap: .55rem; min-block-size: 44px; padding: .3rem .9rem .3rem .4rem; border: 0; border-radius: 999px; background: rgba(255,255,255,.12); color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
.rs-preuve { display: inline-flex; align-items: center; gap: .35rem; margin: 0; color: #b9cfe6; font-size: var(--fs-2); }
.rs-bravo { display: inline-flex; align-items: center; gap: .5rem; min-block-size: 52px; margin-block-start: .4rem; padding: 0 1.6rem; border: 0; border-radius: 999px; background: #fff; color: #0c2f55; font: inherit; font-weight: 700; font-size: var(--fs-4); cursor: pointer; transition: transform .16s ease; }
.rs-bravo:active { transform: scale(.94); }
.rs-bravo.on { background: #ffc65c; }
.rs-bravo[disabled] { opacity: .55; cursor: default; }
.rs-bravo b { font-size: var(--fs-3); }
@media (prefers-reduced-motion: reduce) { .rs-histoire, .rs-corps { animation: none; } .rs-anneau, .rs-bravo { transition: none; } }
`);
addAR({ 'Une réussite du réseau': 'نجاح من الشبكة', 'Précédente': 'السابقة', 'Suivante': 'التالية' });
