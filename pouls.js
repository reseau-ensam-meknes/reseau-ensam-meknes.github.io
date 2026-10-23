// « Cette semaine dans le réseau » : une ligne vraie, la même pour tout le monde.
// Dès qu'un lauréat a aidé un étudiant (30 derniers jours) : « N lauréats ont aidé N étudiants ».
// Avant, sur l'accueil seulement : qui est déjà là (« 39 lauréats sont déjà là, dont 5 de ta filière »).
// Pas de classement, pas de comparaison ; un appui ouvre exactement les personnes annoncées.
import { html, useState, useEffect } from './vendor/preact-htm.js';
import { Avatar, Icon, injectCSS, Modal, ensuite } from './ui.js';
import { addAR, arCount } from './i18n.js';
import { poulsReseau, presenceReseau, lignePresence, lignePouls, accueilArrivee, phrasesArrivee, NB_FONDATEURS } from './logic.js';

const VERS = { filiere: 'ma-filiere', parcours: 'mon-parcours', promo: 'ma-promo' };

// accueil : autorise la ligne de présence ; semaine : la ligne est déjà sous le titre « Cette semaine »
export function PoulsReseau({ ctx, onOpen, accueil = false, semaine = false }) {
  const { data, store, me, go } = ctx;
  const p = store.pouls ? store.pouls() : poulsReseau(data);
  const aide = p.nbAidants > 0 && p.nbAides > 0;
  const pr = !aide && accueil ? presenceReseau(data, me) : null;
  if (!aide && !pr) return null;
  const visages = (aide ? p.aidants : pr.visages).slice(0, 3).map(id => store.byId('profiles', id)).filter(Boolean);
  const ouvrir = aide ? onOpen : () => go('reseau/annuaire/' + (VERS[pr.cle] || 'laureats'));
  const quand = aide && !(semaine && p.jours === 7) ? (p.jours === 7 ? 'Cette semaine' : 'Ce mois-ci') : null;
  const Tag = ouvrir ? 'button' : 'div';
  return html`<${Tag} type=${ouvrir ? 'button' : undefined} class=${'pouls' + (ouvrir ? ' clickable' : '')} onClick=${ouvrir}>
    ${visages.length ? html`<span class="pouls-visages" aria-hidden="true">${visages.map(v => html`<${Avatar} key=${v.id} p=${v} size=${28}/>`)}</span>` : null}
    <span class="pouls-txt">${quand ? html`<strong>${quand}</strong> ` : null}<span>${aide ? lignePouls(p) : lignePresence(pr)}</span>${aide && p.recrutes ? html`<span class="pouls-sep"> · </span><span>${p.recrutes > 1 ? `${p.recrutes} recrutements confirmés` : '1 recrutement confirmé'}</span>` : null}</span>
    ${ouvrir ? html`<span class="pouls-go" aria-hidden="true"><${Icon} name="arrow" size=${16}/></span>` : null}
  </${Tag}>`;
}

// ---------------------------------------------------------------------------
// L'accueil juste après l'inscription : une feuille, une fois par compte, sur le premier accueil.
// Le signal vient de la « Dernière étape » (cet onglet seulement) ; « déjà vu » est gardé par membre dans ce navigateur.
// ---------------------------------------------------------------------------
const CLE = 'ensam-arrivee';
let enMemoire = null;
const lireS = () => { try { return sessionStorage.getItem(CLE); } catch { return null; } };
const vu = uid => { try { return localStorage.getItem('accueil-vu-' + uid) === '1'; } catch { return false; } };
export function marquerArrivee(uid) {
  enMemoire = uid;
  try { sessionStorage.setItem(CLE, uid); } catch { /* stockage indisponible : la mémoire suffit pour cette visite */ }
  dispatchEvent(new Event(CLE));
}
export const arriveeEnAttente = uid => !!uid && (lireS() || enMemoire) === uid && !vu(uid);
function consommer(uid, fondateur) {
  enMemoire = null;
  try { sessionStorage.removeItem(CLE); } catch { /* */ }
  try {
    localStorage.setItem('accueil-vu-' + uid, '1');
    // Le badge « Membre fondateur » est annoncé ici : pas une deuxième fenêtre ensuite
    if (fondateur) localStorage.setItem('fete-fondateur-' + uid, '1');
  } catch { /* */ }
}
// Ouvre la feuille ~600 ms après le premier accueil (jamais par-dessus une autre fenêtre : elle attend le prochain accueil)
export function useArrivee({ store, me }) {
  const [a, setA] = useState(null);
  useEffect(() => {
    let t = 0, vivant = true;
    const essayer = () => {
      if (!arriveeEnAttente(me.id) || (store.mode === 'live' && !me.consent_at)) return;
      clearTimeout(t);
      t = setTimeout(async () => {
        // En ligne : les lauréats arrivés pendant que le formulaire se remplissait comptent aussi (2,5 s au plus)
        if (store.mode === 'live' && store.loadTable) await Promise.race([store.loadTable('profiles').catch(() => {}), new Promise(ok => setTimeout(ok, 2500))]);
        if (!vivant || !arriveeEnAttente(me.id) || document.querySelector('.modal-back, .fete-back')) return;
        const x = accueilArrivee(store.data, store.byId('profiles', me.id) || me);
        consommer(me.id, x?.fondateur);
        if (x) setA(x);
      }, 600);
    };
    essayer();
    addEventListener(CLE, essayer);
    return () => { vivant = false; clearTimeout(t); removeEventListener(CLE, essayer); };
  }, [me.id, !!me.consent_at]);
  return [a, () => setA(null)];
}
// Le bouton est celui de la carte « prochaine étape » : une seule action, la même qu'à l'accueil
export function ArriveeSheet({ a, pas, me, store, onClose }) {
  const ph = phrasesArrivee(a);
  const visages = a.visages.map(id => store.byId('profiles', id)).filter(Boolean);
  const membre = pas?.membre ? { translate: 'no', dir: 'auto' } : {};
  const bouton = !pas ? html`<button type="button" class="btn primary" id="arrivee-go" onClick=${onClose}>C’est parti</button>`
    : pas.href ? html`<a class="btn primary" id="arrivee-go" href=${pas.href} target="_blank" rel="noopener" onClick=${onClose}><${Icon} name="video" size=${18}/> ${pas.cta}</a>`
    : html`<button type="button" class="btn primary" id="arrivee-go" onClick=${() => { onClose(); ensuite(pas.go); }}>${pas.ici ? html`<${Icon} name="check" size=${18}/>` : null}${pas.cta}${pas.ici ? null : html`<${Icon} name="arrow" size=${18}/>`}</button>`;
  return html`<${Modal} title=${'Bienvenue, ' + (me.full_name || '').split(' ')[0]} cls="arrivee" footer=${bouton} onClose=${onClose}>
    ${visages.length ? html`<span class="arrivee-visages" aria-hidden="true">${visages.map(v => html`<${Avatar} key=${v.id} p=${v} size=${44}/>`)}</span>` : null}
    <p class="arrivee-titre">${ph.titre}</p>
    ${ph.sous ? html`<p class="arrivee-sous">${ph.sous}</p>` : null}
    ${a.fondateur ? html`<p class="arrivee-fondateur"><${Icon} name="award" size=${16}/><span>${`Tu fais partie des ${NB_FONDATEURS} premiers lauréats : le badge « Membre fondateur » est sur ton profil.`}</span></p>` : null}
    ${!pas ? null : pas.guide ? html`<p class="arrivee-pas"><strong class="arrivee-pas-t">${pas.titre}</strong><span>${pas.detail}</span></p>`
      : html`<p class="arrivee-pas" ...${membre}>${pas.titre}</p>`}
  <//>`;
}

injectCSS('pouls', `
.modal.arrivee .modal-body { align-items: center; text-align: center; gap: .5rem; padding-block: 1.4rem 1rem; }
.arrivee-visages { display: flex; justify-content: center; margin-block-end: .25rem; }
.arrivee-visages .avatar { box-shadow: 0 0 0 3px var(--surface); }
.arrivee-visages .avatar + .avatar { margin-inline-start: -10px; }
.arrivee-titre { margin: 0; font-family: var(--f-display); font-weight: 700; font-size: 1.3rem; line-height: 1.25; color: var(--ink); text-wrap: balance; }
.arrivee-sous, .arrivee-fondateur { margin: 0; color: var(--ink-2); }
.arrivee-fondateur { font-size: var(--fs-2); display: flex; gap: .4rem; align-items: flex-start; text-align: start; }
.arrivee-fondateur .ico { flex: none; margin-block-start: .15rem; color: var(--accent); }
.arrivee-pas { margin: .5rem 0 0; color: var(--muted); font-size: var(--fs-2); max-inline-size: 36ch; text-wrap: pretty; }
.arrivee-pas-t { display: block; color: var(--ink); font-weight: 600; }

.pouls { display: flex; align-items: center; gap: .7rem; padding: .55rem .8rem .55rem .6rem; border-radius: var(--r-pill); background: color-mix(in srgb, var(--good-soft) 70%, var(--surface)); border: 1px solid color-mix(in srgb, var(--good) 22%, var(--line)); color: var(--ink-2); font-size: var(--fs-2); text-align: start; width: 100%; }
button.pouls { cursor: pointer; font: inherit; font-size: var(--fs-2); }
button.pouls:hover { border-color: color-mix(in srgb, var(--good) 45%, var(--line)); }
.pouls-visages { display: flex; flex: none; }
.pouls-visages .avatar { box-shadow: 0 0 0 2px var(--surface); }
.pouls-visages .avatar + .avatar { margin-inline-start: -5px; }
.pouls-txt { flex: 1; min-width: 0; text-wrap: pretty; }
.pouls-txt strong { color: var(--good); font-weight: 600; }
.pouls-go { flex: none; display: inline-flex; align-self: center; color: var(--muted); }
@media (max-width: 420px) { .pouls { border-radius: var(--r-lg); align-items: flex-start; } }
`);

// Arabe : accord du nombre (1, 2, 3-10, 11 et plus) et du verbe ; الخريجين, jamais القدامى
const LAU = ['خريج واحد', 'خريجان', 'خريجين', 'خريجًا'];
const ETU_ACC = ['طالبًا واحدًا', 'طالبَين', 'طلاب', 'طالبًا'];
const SAIDE = n => (+n === 1 ? 'ساعد' : +n === 2 ? 'ساعدا' : 'ساعدوا');
const DE_AR = { 'ta filière': 'من شعبتك', 'ton parcours': 'من مسارك', 'ta promo': 'من دفعتك' };
const NB_AR = n => (+n === 1 ? 'واحد' : +n === 2 ? 'اثنان' : n);
addAR({ 'Cette semaine': 'هذا الأسبوع', 'Ce mois-ci': 'هذا الشهر', '1 recrutement confirmé': 'توظيف واحد مؤكَّد',
  'Le réseau des lauréats commence avec toi': 'شبكة الخريجين تبدأ معك', 'C’est parti': 'لننطلق',
  [`Tu fais partie des ${NB_FONDATEURS} premiers lauréats : le badge « Membre fondateur » est sur ton profil.`]: `أنت من بين أول ${NB_FONDATEURS} خريجًا في الشبكة: شارة «عضو مؤسس» على ملفك.` }, [
  [/^Te voilà (\d+)e lauréat\(e\) du réseau$/, n => `أنت الآن رقم ${n} بين خريجي الشبكة`],
  [/^(\d+) lauréats? (?:ont|a) aidé (\d+) étudiants?$/, (a, b) => `${arCount(a, LAU)} ${SAIDE(a)} ${arCount(b, ETU_ACC)}`],
  [/^(\d+) recrutements? confirmés?$/, n => arCount(n, ['توظيف واحد مؤكَّد', 'توظيفان مؤكَّدان', 'توظيفات مؤكَّدة', 'توظيفًا مؤكَّدًا'])],
  [/^(\d+) lauréats? (?:sont|est) déjà là$/, t => `انضمّ إلى الشبكة ${arCount(t, LAU)}`],
  [/^(\d+) lauréats? de (ta filière|ton parcours|ta promo) (?:sont|est) déjà là$/, (t, x) => `انضمّ إلى الشبكة ${arCount(t, LAU)} ${DE_AR[x]}`],
  [/^(\d+) lauréats sont déjà là, dont (\d+) de (ta filière|ton parcours|ta promo)$/, (t, n, x) => `انضمّ إلى الشبكة ${arCount(t, LAU)}، ${+t === 2 ? 'منهما' : 'منهم'} ${NB_AR(n)} ${DE_AR[x]}`],
]);
