// Membres fondateurs, côté membres : le bandeau en haut de l'accueil, la fête quand un lauréat le devient
// (par sa première aide aux étudiants, jamais par sa date d'inscription), la question « Ton nom sur la page d'entrée ? »
// posée une fois, et la case pour changer d'avis dans « Mon profil ».
// En ligne, le classement vient de la base (fondateurs_publics) : les aides proposées sur une demande ne sont lisibles que
// par les deux personnes concernées, et chacun doit voir les mêmes fondateurs. Base pas encore à jour : le même calcul
// sur ce que tout membre peut lire (offres et mentorats). En démo : le calcul sur toutes les données (classementFondateurs).
import { html, useState, useEffect, useMemo } from './vendor/preact-htm.js';
import { Icon, Avatar, Bouclier, Modal, toast, celebrate, ecranLibre, injectCSS } from './ui.js';
import { classementFondateurs, lignePlaces, NB_FONDATEURS } from './logic.js';
import { addAR, arCount } from './i18n.js';
import { MessageBtn } from './messages.js';
import { arriveeEnAttente } from './pouls.js';
import { CarteFondateur, TeteFondateurs } from './fondateurs-public.js';

// fondateurs_publics() pour un membre : tous les fondateurs (avec leur id), et le choix du membre lui-même
// (mon_choix : null = pas encore demandé). null tant que la réponse n'est pas là ; false : la base n'a pas la fonction.
const memoire = { uid: null, x: null };
function lireReponse(x) {
  const liste = (Array.isArray(x?.fondateurs) ? x.fondateurs : []).filter(f => f?.id)
    .map((f, i) => ({ id: f.id, at: f.at, type: f.type, rang: +f.rang || i + 1, nom: f.nom, filiere: f.filiere, promo: f.promo, photo_path: f.photo || null, verified: !!f.verifie }));
  return { liste, monChoix: x?.mon_choix ?? null };
}

// Le Set des fondateurs (badge « Membre fondateur ») ; .liste : dans l'ordre, { id, at, type, rang } ;
// .choix : ce que le membre a répondu (undefined : rien à demander, la base n'est pas prête)
export function useFondateurs(store, data) {
  const live = store.mode === 'live' && !!store.sb && !!store.userId;
  const uid = store.userId || null;
  const [rpc, setRpc] = useState(() => (memoire.uid === uid ? memoire.x : null));
  useEffect(() => {
    if (!live) return;
    let vivant = true;
    const t = setTimeout(() => {
      store.sb.rpc('fondateurs_publics').then(({ data: x, error }) => {
        const v = error || !x ? false : lireReponse(x);
        // Une erreur passagère ne remplace pas une réponse déjà là
        if (v === false && memoire.uid === uid && memoire.x) return;
        memoire.uid = uid; memoire.x = v;
        if (vivant) setRpc(v);
      }, () => {});
    }, memoire.uid === uid && memoire.x !== null ? 700 : 0);
    return () => { vivant = false; clearTimeout(t); };
  }, [live, uid, data.offers, data.propositions, data.mentorships]);
  return useMemo(() => {
    const liste = live && rpc ? rpc.liste : classementFondateurs(live ? { ...data, propositions: [] } : data);
    const s = new Set(liste.map(f => f.id));
    s.liste = liste;
    s.pret = !live || !!rpc;
    return s;
  }, [live, rpc, data.profiles, data.offers, data.propositions, data.mentorships, data.demandes]);
}

// Le choix du membre : son profil le porte après un changement (et toujours en démo) ; sinon, la réponse de la base.
// undefined : la question ne se pose pas (base pas encore à jour). En démo, un profil sans réponse n'est pas interrogé.
function choixDe(store, me) {
  if (me && 'fondateur_public' in me) return me.fondateur_public;
  if (store.mode !== 'live') return undefined;
  return memoire.uid === store.userId && memoire.x ? memoire.x.monChoix : undefined;
}

// ---------------------------------------------------------------------------
// Le bandeau, tout en haut de l'accueil (étudiants, lauréats, administration). Pas de bouton plein : l'écran garde le sien.
// ---------------------------------------------------------------------------
export function FondateursBandeau({ ctx, onPublier }) {
  const { me, store, fondateurs, openProfile } = ctx;
  const liste = fondateurs?.liste || [];
  const lau = me.role === 'laureat';
  const moi = !!fondateurs?.has(me.id);
  const places = Math.max(0, NB_FONDATEURS - liste.length);
  const [ouvert, setOuvert] = useState(false);
  if (!liste.length && !lau) return null;
  const cartes = liste.map(f => {
    const p = store.byId('profiles', f.id) || { id: f.id, full_name: f.nom, filiere: f.filiere, promo: f.promo, photo_path: f.photo_path, verified: f.verified, role: 'laureat' };
    return { f: { ...f, nom: p.full_name, filiere: p.filiere, promo: p.promo }, p };
  });
  const remplie = Math.round(100 * Math.min(liste.length, NB_FONDATEURS) / NB_FONDATEURS);
  // Petit téléphone (moins de 700 px de haut) : une ligne, les visages et le titre ; un toucher ouvre le bandeau.
  // La carte « prochaine étape » et son bouton restent ainsi visibles sans défiler.
  return html`<section class=${'fondateurs fd-accueil' + (ouvert ? ' fd-ouvert' : '')} aria-labelledby="fd-titre">
    <button type="button" class="fd-resume" onClick=${() => setOuvert(true)}>
      ${cartes.length ? html`<span class="fd-resume-pile" aria-hidden="true">${cartes.slice(0, 4).map(({ p }) => html`<${Avatar} key=${p.id} p=${p} size=${32}/>`)}</span>`
        : html`<span class="fd-ico" aria-hidden="true"><${Icon} name="award" size=${18}/></span>`}
      <span class="fd-resume-t"><strong>Membres fondateurs</strong><span>Lauréats du mois</span></span>
      <${Icon} name="arrow" size=${16}/>
    </button>
    <${TeteFondateurs} id="fd-titre"/>
    ${cartes.length ? html`<ul class="fd-liste" role="list">${cartes.map(({ f, p }) => html`<${CarteFondateur} key=${f.id} f=${f}
      visage=${html`<${Avatar} p=${p} size=${72}/>`} apresNom=${html`<${Bouclier} p=${p}/>`} onOpen=${() => openProfile(p)}
      pied=${f.id !== me.id ? html`<${MessageBtn} ctx=${ctx} p=${f.id} label="Merci" cls="btn tiny ghost fd-merci" icone="heart" compte=${false} texte=${'Merci d’aider les étudiants de l’école !'}/>` : html`<span class="fd-toi">C’est toi</span>`}/>`)}</ul>` : null}
    <p class="fd-places"><span class="fd-jauge" aria-hidden="true"><i style=${`inline-size:${remplie}%`}></i></span><span>${lignePlaces(liste.length)}</span></p>
    ${lau && !moi && places > 0 ? html`<button type="button" class="linkish fd-cta" id="fd-rejoindre" onClick=${onPublier}><span>Publie une offre ou aide un étudiant pour en faire partie</span><${Icon} name="arrow" size=${16}/></button>` : null}
  </section>`;
}

// ---------------------------------------------------------------------------
// Un lauréat devient fondateur : la fête (une fois), puis, une fois la fête fermée, la question de la page d'entrée.
// Jamais par-dessus une autre fenêtre, ni juste après l'inscription (la feuille d'accueil passe d'abord).
// ---------------------------------------------------------------------------
const libre = ecranLibre;
const vuIci = id => { try { return localStorage.getItem('fondateur-question-' + id) === '1'; } catch { return false; } };
const noterVu = id => { try { localStorage.setItem('fondateur-question-' + id, '1'); } catch { /* stockage indisponible */ } };

export function useFondateurMoi(ctx) {
  const { me, store, go, fondateurs } = ctx;
  const lau = me.role === 'laureat';
  const fondateur = lau && !!fondateurs?.has(me.id) && (store.mode !== 'live' || (!!me.consent_at && !!fondateurs.pret));
  const [question, setQuestion] = useState(false);
  const choix = choixDe(store, me);
  const aDemander = fondateur && choix === null && !vuIci(me.id);
  useEffect(() => {
    if (!fondateur) return;
    let t = 0, n = 0;
    const essayer = () => {
      t = setTimeout(() => {
        if (arriveeEnAttente(me.id) || !libre()) { if (++n < 40) essayer(); return; }
        // En ligne seulement : la démo garde ses parcours sans fête surprise
        if (store.mode === 'live' && celebrate({ cle: 'fondateur-aide-' + me.id, icon: 'award', titre: 'Tu es Membre fondateur !',
          texte: `Tu fais partie des ${NB_FONDATEURS} premiers lauréats à aider les étudiants. Merci ! Ce badge restera sur ton profil.`,
          action: { label: 'Voir mon badge', onClick: () => go('espace') } })) { if (aDemander) essayer(); return; }
        if (aDemander) setQuestion(true);
      }, n ? 1500 : 1200);
    };
    essayer();
    return () => clearTimeout(t);
  }, [fondateur, aDemander]);
  if (!question || !aDemander) return null;
  const fermer = () => { noterVu(me.id); setQuestion(false); };
  return html`<${FeuilleFondateur} ctx=${ctx} onClose=${fermer}/>`;
}

function FeuilleFondateur({ ctx, onClose }) {
  const { me, store, act } = ctx;
  const repondre = oui => act(async () => {
    // Non : la photo change aussi de nom (un lien déjà donné à un visiteur ne marche plus) ; voir masquerFondateur
    if (oui) await store.update('profiles', me.id, { fondateur_public: true }); else await store.masquerFondateur(false);
    onClose();
    toast(oui ? 'C’est noté : ton nom apparaît en haut de la page d’entrée.' : 'C’est noté. Tu peux changer d’avis dans Mon profil.');
  });
  const pied = html`<button type="button" class="btn ghost" id="fd-non" onClick=${() => repondre(false)}>Pas maintenant</button>
    <button type="button" class="btn primary" id="fd-oui" onClick=${() => repondre(true)}>Oui, me montrer</button>`;
  return html`<${Modal} title="Membre fondateur" cls="fd-feuille" footer=${pied} onClose=${onClose}>
    <span class="fd-photo fd-photo-feuille"><${Avatar} p=${me} size=${72}/></span>
    <p class="fd-feuille-txt">Tu es membre fondateur. Ton nom et ta photo peuvent apparaître en haut de la page d’entrée, pour donner envie aux autres.</p>
    <p class="small muted">Tu pourras changer d’avis dans Mon profil.</p>
  <//>`;
}

// « Mon profil » (Mes données) : la même question, à changer quand on veut. Seulement pour un fondateur, base à jour.
export function FondateurPublicCase({ ctx }) {
  const { me, store, act, fondateurs } = ctx;
  const choix = choixDe(store, me);
  if (me.role !== 'laureat' || !fondateurs?.has(me.id) || (store.mode === 'live' && choix === undefined)) return null;
  return html`<h3 class="md-titre">Page d’entrée</h3>
    <label class="check"><input id="md-fondateur" type="checkbox" checked=${choix === true} onChange=${e => act(async () => {
      const oui = e.target.checked;
      const r = oui ? await store.update('profiles', me.id, { fondateur_public: true }) : await store.masquerFondateur(false);
      toast(oui ? 'C’est noté : ton nom apparaît en haut de la page d’entrée.'
        : r?.photoRetiree ? 'Ton nom n’est plus sur la page d’entrée. Ta photo a été retirée : remets-la depuis Mon profil.'
        : 'Ton nom et ta photo ne sont plus sur la page d’entrée.');
    })}/> Montrer mon nom et ma photo de membre fondateur en haut de la page d’entrée (visible sans compte)</label>`;
}

injectCSS('fondateurs-membres', `
.fd-accueil { margin-block-end: var(--sp-4); }
.fd-resume { display: none; }
@media (max-width: 899px) and (max-height: 700px) {
  .fd-accueil:not(.fd-ouvert) { padding: var(--sp-2) var(--sp-3); }
  .fd-accueil:not(.fd-ouvert) > :not(.fd-resume) { display: none; }
  .fd-accueil:not(.fd-ouvert) .fd-resume { display: flex; align-items: center; gap: var(--sp-3); inline-size: 100%; min-block-size: 44px; padding: 0; border: 0; background: none; color: var(--ink); font: inherit; text-align: start; cursor: pointer; }
  .fd-resume-pile { display: inline-flex; flex: none; }
  .fd-resume-pile .avatar { box-shadow: 0 0 0 2px var(--surface); }
  .fd-resume-pile .avatar + .avatar { margin-inline-start: -8px; }
  .fd-resume-t { display: flex; flex-direction: column; flex: 1; min-inline-size: 0; line-height: 1.25; }
  .fd-resume-t strong { font-size: var(--fs-3); }
  .fd-resume-t span { color: var(--brass); font-size: var(--fs-1); font-weight: 600; }
  .fd-resume > .ico { flex: none; color: var(--muted); transform: rotate(90deg); }
}
.fd-toi { margin-block-start: auto; color: var(--muted); font-size: var(--fs-1); font-weight: 600; }
.fd-merci .ico { color: var(--brass); }
.modal.fd-feuille .modal-body { align-items: center; text-align: center; gap: var(--sp-2); padding-block: var(--sp-5) var(--sp-4); }
.fd-photo-feuille { margin-block-end: var(--sp-1); }
.fd-feuille-txt { margin: 0; max-inline-size: 34ch; color: var(--ink); font-size: var(--fs-4); line-height: 1.45; text-wrap: pretty; }
@media (min-width: 761px) { .fd-accueil { margin-block-end: var(--sp-5); } }
`);

// Arabe : خريجين, jamais القدامى ; formulations neutres
const PLACES = ['مكان واحد متبقٍّ', 'مكانان متبقيان', 'أماكن متبقية', 'مكانًا متبقيًا'];
addAR({
  'Publie une offre ou aide un étudiant pour en faire partie': 'انشر عرضًا أو ساعد طالبًا للانضمام إليهم',
  'C’est toi': 'هذا أنت',
  'Merci': 'شكرًا',
  'Membre fondateur': 'عضو مؤسس',
  'Tu es membre fondateur. Ton nom et ta photo peuvent apparaître en haut de la page d’entrée, pour donner envie aux autres.': 'أنت من الأعضاء المؤسسين. يمكن أن يظهر اسمك وصورتك في أعلى صفحة الدخول، لتشجيع الآخرين.',
  'Tu pourras changer d’avis dans Mon profil.': 'يمكنك تغيير رأيك لاحقًا من «ملفي الشخصي».',
  'Pas maintenant': 'ليس الآن', 'Oui, me montrer': 'نعم، إظهار اسمي',
  'C’est noté : ton nom apparaît en haut de la page d’entrée.': 'تم الحفظ: اسمك يظهر الآن في أعلى صفحة الدخول.',
  'C’est noté. Tu peux changer d’avis dans Mon profil.': 'تم الحفظ. يمكنك تغيير رأيك من «ملفي الشخصي».',
  'Page d’entrée': 'صفحة الدخول',
  'Montrer mon nom et ma photo de membre fondateur en haut de la page d’entrée (visible sans compte)': 'إظهار اسمي وصورتي كعضو مؤسس في أعلى صفحة الدخول (مرئي دون حساب)',
  'Ton nom et ta photo ne sont plus sur la page d’entrée.': 'لم يعد اسمك وصورتك في صفحة الدخول.',
  'Ton nom n’est plus sur la page d’entrée. Ta photo a été retirée : remets-la depuis Mon profil.': 'لم يعد اسمك في صفحة الدخول. وأُزيلت صورتك: أعد إضافتها من «ملفي الشخصي».',
  'Tu es Membre fondateur !': 'أنت عضو مؤسس!',
  [`Tu fais partie des ${NB_FONDATEURS} premiers lauréats à aider les étudiants. Merci ! Ce badge restera sur ton profil.`]: `أنت من بين أول ${NB_FONDATEURS} خريجًا ساعدوا الطلبة. شكرًا! ستبقى هذه الشارة على ملفك.`,
  'Voir mon badge': 'عرض شارتي',
  'Parmi les 25 premiers lauréats à aider les étudiants': 'من بين أول 25 خريجًا ساعدوا الطلبة',
  [`Les ${NB_FONDATEURS} places de membre fondateur sont prises`]: `امتلأت أماكن الأعضاء المؤسسين الـ${NB_FONDATEURS}`,
  [`1 place de membre fondateur restante sur ${NB_FONDATEURS}`]: `بقي مكان واحد للأعضاء المؤسسين من أصل ${NB_FONDATEURS}`,
}, [
  [/^(\d+) places de membre fondateur restantes sur (\d+)$/, (n, m) => `${arCount(n, PLACES)} للأعضاء المؤسسين من أصل ${m}`],
]);
