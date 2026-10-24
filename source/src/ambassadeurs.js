// Ambassadeurs de promo, tout seuls : pour chaque promo × filière, la plateforme propose le rôle au membre le plus actif
// (carte « prochaine étape » et notification), il accepte ou dit « Pas pour moi » ; sans réponse en 7 jours, c'est le
// suivant. L'ambassadeur trouve sur l'accueil le lien de sa promo prêt pour WhatsApp, les réussites à relayer et les
// chiffres vrais de sa promo ce mois-ci ; ses camarades le remercient ; l'administration voit, retire et nomme.
// En ligne, la base décide (ambassadeurs_proposer, schema.sql) ; en démo, le même calcul (logic.js). Base pas encore à
// jour : la table manque, rien ne s'affiche.
import { html, useState, useEffect, useMemo } from './vendor/preact-htm.js';
import { Icon, Avatar, Bouclier, Embleme, toast, celebrate, injectCSS, lienWhatsApp } from './ui.js';
import { ambassadeurDuGroupe, ambassadeursActifs, proposerAmbassadeur, chiffresPromo, reussitesDuGroupe, texteReussite, filiereCourte, AMB_DELAI_JOURS, timeAgo } from './logic.js';
import { addAR, getLang } from './i18n.js';
import { MessageBtn } from './messages.js';
import { lienInvitation, messageInvitation } from './invitation.js';

const MEMBRES = ['etudiant', 'laureat'];
const groupeTxt = (promo, filiere) => `${filiereCourte(filiere)} ${promo}`;
const debutDuMois = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const jourMois = iso => { const d = new Date(iso); return `${d.getDate()} ${MOIS[d.getMonth()]}`; };

// Ma ligne en cours (proposée, moins de 7 jours ; ou acceptée)
export function maLigne(data, me) {
  if (!me || !MEMBRES.includes(me.role)) return null;
  const a = ambassadeurDuGroupe(data, me.promo, me.filiere);
  return a && a.user_id === me.id ? a : null;
}

// ---------------------------------------------------------------------------
// À l'ouverture de l'appli : la base expire les propositions de plus de 7 jours et propose le suivant (une fois par visite)
// ---------------------------------------------------------------------------
const lancees = new Set();
async function proposer(store, me) {
  if (store.mode === 'live') {
    if (!store.sb) return 0;
    const { data: n, error } = await store.sb.rpc('ambassadeurs_proposer');
    if (!error && n > 0 && store.loadTable) { await store.loadTable('ambassadeurs'); store.emit(); }
    return error ? 0 : n || 0;
  }
  // Démo : la même règle, sur le groupe du membre (tous les groupes pour l'administration)
  const vus = new Set(), groupes = [];
  for (const p of me.role === 'admin' ? store.data.profiles : [me]) {
    const k = p.promo + '|' + p.filiere;
    if (MEMBRES.includes(p.role) && p.filiere && !vus.has(k)) { vus.add(k); groupes.push([Number(p.promo), p.filiere]); }
  }
  let n = 0;
  const now = new Date().toISOString();
  store.ambSysteme = true; // la plateforme elle-même (comme ensam.amb_systeme dans la base)
  try {
    for (const [promo, filiere] of groupes) {
      try { // un groupe qui échoue n'arrête pas les autres
        const { expirees, candidat } = proposerAmbassadeur(store.data, promo, filiere);
        for (const a of expirees) { await store.update('ambassadeurs', a.id, { statut: 'expire', repondu_at: now }); n++; }
        if (candidat) { await store.insert('ambassadeurs', { promo, filiere, user_id: candidat, statut: 'propose', par: 'auto', propose_at: now, repondu_at: null }); n++; }
      } catch { /* suivant */ }
    }
  } finally { store.ambSysteme = false; }
  return n;
}

// Les ambassadeurs acceptés (Map membre → ligne), pour les badges et le merci ; lance la proposition une fois par visite
export function useAmbassadeurs(store, data) {
  const me = store.me;
  useEffect(() => {
    if (!me || !(MEMBRES.includes(me.role) || me.role === 'admin')) return;
    const cle = store.mode + ':' + me.id;
    if (lancees.has(cle)) return;
    const t = setTimeout(() => { lancees.add(cle); proposer(store, me).catch(() => {}); }, 1200);
    return () => clearTimeout(t);
  }, [me?.id, store.mode]);
  return useMemo(() => ambassadeursActifs(data), [data.ambassadeurs]);
}

// ---------------------------------------------------------------------------
// La proposition : la carte « prochaine étape » (un seul bouton plein, « Accepter ») et une ligne dans la cloche
// ---------------------------------------------------------------------------
const repondre = (ctx, a, statut) => ctx.store.update('ambassadeurs', a.id, { statut });
// « Annuler » après un refus ou un retrait : si la plateforme a déjà proposé le rôle au suivant, la place est prise
// (un seul en cours par promo × filière) ; on le dit calmement au lieu d'une erreur.
const TROP_TARD = 'Trop tard, c’est déjà proposé à quelqu’un d’autre.';
const placePrise = e => e?.code === '23505' || /duplicate key|ambassadeurs_un_en_cours|Déjà ambassadeur|^Trop tard/i.test(String(e?.message || e || ''));
async function annuler(store, a, fn) {
  const enCours = ambassadeurDuGroupe(store.data, a.promo, a.filiere);
  if (enCours && enCours.id !== a.id) return toast(TROP_TARD, 'ok');
  try { await fn(); } catch (e) { if (placePrise(e)) return toast(TROP_TARD, 'ok'); throw e; }
}
function accepter(ctx, a) {
  return ctx.act(async () => {
    await repondre(ctx, a, 'accepte');
    if (!celebrate({ cle: 'ambassadeur-' + a.id, icon: 'people', titre: 'Merci, ambassadeur de ta promo !',
      texte: `Ton badge « Ambassadeur promo ${a.promo} » est sur ton profil. Le lien de ta promo, ses réussites et ses chiffres t’attendent sur l’accueil.` }))
      toast('Merci ! Tu es ambassadeur de ta promo.', 'win');
  });
}
function refuser(ctx, a) {
  return ctx.act(async () => {
    await repondre(ctx, a, 'refuse');
    toast('C’est noté : la plateforme le proposera à quelqu’un d’autre.', 'ok', 0, { annuler: () => ctx.act(() => annuler(ctx.store, a, () => repondre(ctx, a, 'propose'))) });
  });
}

export function pasAmbassadeur(ctx) {
  const a = maLigne(ctx.data, ctx.me);
  if (!a || a.statut !== 'propose') return null;
  return { key: 'am' + a.id, ref: a.id, icon: 'people', eyebrow: 'Ta promo', titre: `Deviens ambassadeur de ta promo (${groupeTxt(a.promo, a.filiere)})`,
    detail: 'Tu es parmi les membres les plus actifs de ta promo. Partage son lien d’inscription et ses réussites dans votre groupe WhatsApp ; chaque mois, tu reçois ses chiffres.',
    cta: 'Accepter', ici: true, go: () => accepter(ctx, a), lien: { label: 'Pas pour moi', go: () => refuser(ctx, a) } };
}

export function notifsAmbassadeur({ data, me }) {
  const a = maLigne(data, me);
  if (!a || a.statut !== 'propose') return [];
  // sansToast : la proposition naît à l'ouverture de l'appli (pas venue d'un autre membre) ; la carte et la cloche suffisent
  return [{ key: 'am' + a.id, ref: a.id, action: true, sansToast: true, geste: 'Répondre', tone: 'brass', icon: 'people', to: 'accueil', at: a.propose_at || a.created_at,
    text: `La plateforme te propose d’être ambassadeur de ta promo (${groupeTxt(a.promo, a.filiere)}).` }];
}

// ---------------------------------------------------------------------------
// Sur l'accueil : la carte de l'ambassadeur (lien, réussites, chiffres), ou le merci à l'ambassadeur de sa promo
// ---------------------------------------------------------------------------
// pasKey : la carte « prochaine étape » de l'accueil. Si elle montre autre chose de plus pressé, la proposition attend
// ici, en carte tonale (sans bouton plein : l'écran garde le sien).
export function AmbassadeurAccueil({ ctx, pasKey }) {
  const { data, me } = ctx;
  if (!me || !MEMBRES.includes(me.role)) return null;
  const a = ambassadeurDuGroupe(data, me.promo, me.filiere);
  if (!a) return null;
  if (a.statut === 'propose') return a.user_id === me.id && pasKey !== 'am' + a.id ? html`<${PropositionCarte} ctx=${ctx} a=${a}/>` : null;
  return a.user_id === me.id ? html`<${CarteAmbassadeur} ctx=${ctx} a=${a}/>` : html`<${MerciAmbassadeur} ctx=${ctx} a=${a}/>`;
}

function PropositionCarte({ ctx, a }) {
  const pas = pasAmbassadeur(ctx);
  return html`<section class="amb-carte amb-proposition" id="amb-proposition" aria-labelledby="amb-prop-titre">
    <div class="amb-tete">
      <span class="amb-ico" aria-hidden="true"><${Embleme} id="ambassadeur" size=${22}/></span>
      <div class="grow"><p class="amb-oeil">Ta promo</p><h3 class="amb-titre" id="amb-prop-titre">${pas.titre}</h3></div>
    </div>
    <p class="small">${pas.detail}</p>
    <div class="amb-actions">
      <button type="button" class="btn small tonal" id="amb-accepter" onClick=${pas.go}><${Icon} name="check" size=${16}/> Accepter</button>
      <button type="button" class="btn small ghost" id="amb-refuser" onClick=${pas.lien.go}>Pas pour moi</button>
    </div>
  </section>`;
}

// Les chiffres du mois : la base les compte (les demandes des autres ne sont pas lisibles ici) ; en démo, logic.js
function useChiffres(ctx, a) {
  const { store, data } = ctx;
  const live = store.mode === 'live';
  const [x, setX] = useState(null);
  useEffect(() => {
    if (!live || !store.sb) return;
    let vivant = true;
    store.sb.rpc('chiffres_ma_promo', { p_debut: debutDuMois().toISOString() }).then(({ data: v, error }) => { if (vivant) setX(error || !v ? false : v); }, () => vivant && setX(false));
    return () => { vivant = false; };
  }, [live, a.id, data.placements, data.demandes]);
  return live ? x : chiffresPromo(data, a.promo, a.filiere, debutDuMois());
}

function CarteAmbassadeur({ ctx, a }) {
  const { data, me, store, act } = ctx;
  const langue = getLang() === 'ar' ? 'ar' : 'fr';
  const lien = lienInvitation(a.promo, langue, true);
  const chiffres = useChiffres(ctx, a);
  const reussites = reussitesDuGroupe(data, a.promo, a.filiere).slice(0, 3);
  const mois = new Date();
  const retirer = () => act(async () => {
    await repondre(ctx, a, 'retire');
    toast('C’est noté : tu n’es plus ambassadeur de ta promo.', 'ok', 0, { annuler: () => act(() => annuler(ctx.store, a, () => repondre(ctx, a, 'accepte'))) });
  });
  const copier = async () => { try { await navigator.clipboard.writeText(lien); toast('Lien copié.'); } catch { toast('Copie impossible ici : sélectionne le texte et copie-le.', 'err'); } };
  const ligne = (n, mot, plus) => html`<li><b class="mono">${n}</b><span>${mot}</span>${plus ? html`<small>${plus}</small>` : null}</li>`;
  return html`<section class="amb-carte" id="amb-carte" aria-labelledby="amb-titre">
    <div class="amb-tete">
      <span class="amb-ico" aria-hidden="true"><${Embleme} id="ambassadeur" size=${22}/></span>
      <div class="grow"><p class="amb-oeil">Ambassadeur de ta promo</p><h3 class="amb-titre" id="amb-titre">${`Promo ${a.promo} · ${filiereCourte(a.filiere)}`}</h3></div>
    </div>
    ${chiffres ? html`<div class="amb-bloc">
      <p class="amb-mois">${`En ${MOIS[mois.getMonth()]} ${mois.getFullYear()}`}</p>
      <ul class="amb-chiffres" role="list">
        ${ligne(chiffres.inscrits, chiffres.inscrits > 1 ? 'inscrits' : 'inscrit', chiffres.nouveaux ? `+${chiffres.nouveaux} ce mois-ci` : '')}
        ${ligne(chiffres.demandes, chiffres.demandes > 1 ? 'demandes pourvues' : 'demande pourvue', chiffres.demandes_mois ? `+${chiffres.demandes_mois} ce mois-ci` : '')}
        ${ligne(chiffres.stages, chiffres.stages > 1 ? 'stages et emplois trouvés' : 'stage ou emploi trouvé', chiffres.stages_mois ? `+${chiffres.stages_mois} ce mois-ci` : '')}
      </ul></div>` : null}
    <div class="amb-bloc">
      <p class="amb-sous">Le lien de ta promo</p>
      <div class="amb-actions">
        <a class="btn small tonal" id="amb-wa" href=${lienWhatsApp(messageInvitation(a.promo, langue, lien))} target="_blank" rel="noopener"><${Icon} name="send" size=${16}/> Envoyer sur WhatsApp</a>
        <button type="button" class="btn small ghost" id="amb-copier" onClick=${copier}><${Icon} name="link" size=${16}/> Copier le lien</button>
      </div>
    </div>
    <div class="amb-bloc">
      <p class="amb-sous">Réussites à partager</p>
      ${reussites.length ? html`<ul class="amb-reussites" role="list">${reussites.map(pl => {
        const e = store.byId('profiles', pl.student_id);
        return html`<li key=${pl.id}><span class="grow"><span translate="no" dir="auto">${pl.entreprise}</span><small>${TYPE[pl.type] || TYPE.stage}${' · '}${timeAgo(pl.confirmed_at || pl.created_at)}${pl.partage_ok ? null : ' · sans nom'}</small></span>
          <a class="btn tiny ghost amb-partager" href=${lienWhatsApp(texteReussite(pl, e, langue, lienInvitation(e?.promo || a.promo, langue, true)))} target="_blank" rel="noopener"><${Icon} name="share" size=${14}/> Partager</a></li>`;
      })}</ul>` : html`<p class="small muted">Quand quelqu’un de ta promo trouve un stage grâce au réseau, sa réussite arrive ici, prête à partager.</p>`}
      <p class="small muted">Seulement les réussites vérifiées des deux côtés. Le prénom n’apparaît que si la personne a accepté d’être citée.</p>
    </div>
    <p class="amb-pied"><span class="small muted">Merci de faire vivre ta promo !</span><button type="button" class="linkish small" id="amb-retirer" onClick=${retirer}>Ne plus être ambassadeur</button></p>
  </section>`;
}
const TYPE = { stage: 'Stage', pfe: 'PFE', etranger: 'Stage à l’étranger', emploi: 'Premier emploi' };

// Le merci public : chaque membre de la promo voit qui la fait vivre, et peut lui dire merci
function MerciAmbassadeur({ ctx, a }) {
  const { store, openProfile } = ctx;
  const p = store.byId('profiles', a.user_id);
  if (!p) return null;
  return html`<div class="amb-merci" id="amb-merci">
    <button type="button" class="amb-qui" onClick=${() => openProfile(p)}><${Avatar} p=${p} size=${44}/>
      <span class="grow"><span class="amb-oeil">Ambassadeur de ta promo</span><span class="amb-nom"><span translate="no" dir="auto">${p.full_name}</span><${Bouclier} p=${p}/></span>
      <span class="small muted">Fait venir la promo et relaie ses réussites. Merci !</span></span></button>
    <${MessageBtn} ctx=${ctx} p=${p.id} label="Merci" cls="btn tiny ghost amb-merci-btn" icone="heart" compte=${false} texte=${'Merci de faire vivre notre promo sur le réseau !'}/>
  </div>`;
}

// ---------------------------------------------------------------------------
// Administration > Inviter : les ambassadeurs, retirer, nommer à la main, proposer maintenant
// ---------------------------------------------------------------------------
export function AmbassadeursAdmin({ ctx }) {
  const { data, store, act } = ctx;
  const [q, setQ] = useState('');
  const lignes = (data.ambassadeurs || []).filter(a => a.statut === 'accepte' || (a.statut === 'propose' && ambassadeurDuGroupe(data, a.promo, a.filiere)?.id === a.id))
    .sort((x, y) => (x.statut === 'accepte' ? 0 : 1) - (y.statut === 'accepte' ? 0 : 1) || y.promo - x.promo || String(x.filiere).localeCompare(String(y.filiere)));
  const nom = id => store.byId('profiles', id)?.full_name || 'Un membre';
  const retirer = a => act(async () => {
    const avant = a.statut;
    await store.update('ambassadeurs', a.id, { statut: 'retire' });
    toast(`${nom(a.user_id)} n’est plus ambassadeur.`, 'ok', 0, { annuler: () => act(() => annuler(store, a, () => store.update('ambassadeurs', a.id, { statut: avant }))) });
  });
  const nommer = p => act(async () => {
    const deja = ambassadeurDuGroupe(data, p.promo, p.filiere);
    if (deja?.user_id === p.id) return toast(`${p.full_name} est déjà proposé ou ambassadeur.`, 'err');
    if (deja) await store.update('ambassadeurs', deja.id, { statut: 'retire' });
    // Une proposition comme une autre : la personne l'accepte (ou non) depuis son accueil
    const vieille = (data.ambassadeurs || []).find(a => a.statut === 'propose' && a.promo === Number(p.promo) && a.filiere === p.filiere && a.id !== deja?.id);
    if (vieille) await store.update('ambassadeurs', vieille.id, { statut: 'expire' }).catch(() => {});
    await store.insert('ambassadeurs', { promo: Number(p.promo), filiere: p.filiere, user_id: p.id, statut: 'propose', par: 'admin', propose_at: new Date().toISOString(), repondu_at: null });
    setQ('');
    toast(`Proposé à ${p.full_name} : la proposition l’attend sur son accueil.`);
  });
  const lancer = () => act(async () => {
    lancees.clear();
    const n = await proposer(store, ctx.me);
    toast(n ? (n > 1 ? `${n} changements : propositions faites ou expirées.` : '1 changement : proposition faite ou expirée.') : 'Rien à proposer pour l’instant.');
  });
  const mots = q.trim().toLowerCase();
  const trouves = mots.length >= 2 ? data.profiles.filter(p => MEMBRES.includes(p.role) && p.full_name.toLowerCase().includes(mots)).slice(0, 5) : [];
  return html`<div class="panel amb-admin" id="amb-admin">
    <div class="section-head"><h2 class="h-ico"><${Embleme} id="ambassadeur" size=${20}/> Ambassadeurs de promo</h2>
      <button type="button" class="btn tiny ghost" id="amb-lancer" onClick=${lancer}><${Icon} name="spark" size=${14}/> Proposer maintenant</button></div>
    <p class="small muted">${`La plateforme propose le rôle au membre le plus actif de chaque promo et filière ; sans réponse en ${AMB_DELAI_JOURS} jours ou après un refus, au suivant. Un seul ambassadeur par promo et filière.`}</p>
    ${lignes.length ? html`<ul class="amb-liste" role="list">${lignes.map(a => {
      const p = store.byId('profiles', a.user_id);
      return html`<li key=${a.id}><${Avatar} p=${p} size=${36}/>
        <span class="grow"><strong translate="no" dir="auto">${nom(a.user_id)}</strong>
          <small>${`Promo ${a.promo} · ${filiereCourte(a.filiere)}`}${' · '}${a.statut === 'accepte' ? `Ambassadeur depuis le ${jourMois(a.repondu_at || a.created_at)}` : `Proposé, réponse attendue avant le ${jourMois(new Date(new Date(a.propose_at || a.created_at).getTime() + AMB_DELAI_JOURS * 864e5).toISOString())}`}${a.par === 'admin' ? ' · nommé par l’administration' : null}</small></span>
        <button type="button" class="btn tiny ghost amb-retirer" onClick=${() => retirer(a)}>Retirer</button></li>`;
    })}</ul>` : html`<p class="small muted">Aucun ambassadeur pour l’instant.</p>`}
    <div class="amb-nommer">
      <label class="small" for="amb-qui">Nommer à la main</label>
      <input id="amb-qui" type="search" placeholder="Nom d’un étudiant ou d’un lauréat" value=${q} onInput=${e => setQ(e.target.value)} autocomplete="off"/>
      ${trouves.length ? html`<ul class="amb-trouves" role="list">${trouves.map(p => html`<li key=${p.id}><span class="grow"><span translate="no" dir="auto">${p.full_name}</span><small>${`Promo ${p.promo} · ${filiereCourte(p.filiere)}`}</small></span>
        <button type="button" class="btn tiny tonal amb-nommer-btn" onClick=${() => nommer(p)}>Nommer</button></li>`)}</ul>` : null}
    </div>
  </div>`;
}

injectCSS('ambassadeurs', `
.amb-carte { display: flex; flex-direction: column; gap: var(--sp-3); padding: 1rem 1.1rem; border-radius: var(--r-lg); background: var(--tonal-bg); color: var(--ink); }
.amb-tete { display: flex; align-items: center; gap: var(--sp-3); }
.amb-ico { display: inline-grid; place-items: center; inline-size: 44px; block-size: 44px; border-radius: 50%; background: var(--surface); color: var(--tonal-ink); flex: none; }
.amb-oeil { margin: 0; color: var(--tonal-ink); font-size: var(--fs-2); font-weight: 600; }
.amb-titre { margin: 0; font-size: var(--fs-4); }
.amb-bloc { display: flex; flex-direction: column; gap: var(--sp-2); }
.amb-mois, .amb-sous { margin: 0; font-size: var(--fs-2); font-weight: 600; color: var(--ink-2); }
.amb-chiffres { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--sp-2); }
.amb-chiffres li { display: flex; flex-direction: column; gap: 2px; min-inline-size: 0; }
.amb-chiffres b { font-size: var(--fs-5, 1.4rem); line-height: 1.1; color: var(--tonal-ink); }
.amb-chiffres span { font-size: var(--fs-2); line-height: 1.3; }
.amb-chiffres small, .amb-reussites small, .amb-liste small, .amb-trouves small { display: block; color: var(--muted); font-size: var(--fs-1); }
.amb-actions { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.amb-carte .btn.tonal { background: var(--surface); }
.amb-reussites, .amb-liste, .amb-trouves { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.amb-reussites li, .amb-liste li, .amb-trouves li { display: flex; align-items: center; gap: var(--sp-2); padding-block: var(--sp-2); min-inline-size: 0; }
.amb-reussites li + li, .amb-liste li + li, .amb-trouves li + li { border-block-start: 1px solid var(--line); }
.amb-reussites .grow, .amb-liste .grow, .amb-trouves .grow { flex: 1; min-inline-size: 0; overflow-wrap: anywhere; }
.amb-pied { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--sp-2); margin: 0; }
.amb-merci { display: flex; align-items: center; gap: var(--sp-2); padding: .8rem .9rem; border-radius: var(--r-lg); background: var(--surface); box-shadow: var(--sh1); }
.amb-qui { display: flex; align-items: center; gap: var(--sp-3); flex: 1; min-inline-size: 0; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: start; cursor: pointer; }
.amb-qui .grow { display: flex; flex-direction: column; min-inline-size: 0; }
.amb-nom { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; }
.amb-merci-btn .ico { color: var(--brass); }
.amb-nommer { display: flex; flex-direction: column; gap: var(--sp-1); }
.badge.has .badge-medal.m-ambassadeur { background: var(--tonal-bg); color: var(--tonal-ink); }
`);

// Arabe : « سفير الدفعة » est le nom du rôle (comme « عضو مؤسس ») ; خريجين pour les lauréats ; jamais القدامى
const AR_MOIS = { janvier: 'يناير', février: 'فبراير', mars: 'مارس', avril: 'أبريل', mai: 'ماي', juin: 'يونيو', juillet: 'يوليوز', août: 'غشت', septembre: 'شتنبر', octobre: 'أكتوبر', novembre: 'نونبر', décembre: 'دجنبر' };
addAR({
  'Ta promo': 'دفعتك', 'Accepter': 'قبول', 'Pas pour moi': 'ليس لي', 'Répondre': 'أجب',
  'Tu es parmi les membres les plus actifs de ta promo. Partage son lien d’inscription et ses réussites dans votre groupe WhatsApp ; chaque mois, tu reçois ses chiffres.': 'أنت من أكثر أعضاء دفعتك نشاطًا. شارك رابط التسجيل ونجاحات الدفعة في مجموعة واتساب الخاصة بكم؛ وتصلك أرقامها كل شهر.',
  'Merci, ambassadeur de ta promo !': 'شكرًا، أنت الآن سفير دفعتك!',
  'Merci ! Tu es ambassadeur de ta promo.': 'شكرًا! أنت الآن سفير دفعتك.',
  'C’est noté : la plateforme le proposera à quelqu’un d’autre.': 'تم الحفظ: ستقترح المنصة الدور على شخص آخر.',
  'C’est noté : tu n’es plus ambassadeur de ta promo.': 'تم الحفظ: لم تعد سفير دفعتك.',
  'Ambassadeur de ta promo': 'سفير دفعتك', 'Le lien de ta promo': 'رابط دفعتك', 'Envoyer sur WhatsApp': 'إرسال عبر واتساب', 'Copier le lien': 'نسخ الرابط',
  'Lien copié.': 'تم نسخ الرابط.', 'Copie impossible ici : sélectionne le texte et copie-le.': 'النسخ غير ممكن هنا: حدّد النص وانسخه.',
  'Réussites à partager': 'نجاحات للمشاركة', 'Partager': 'مشاركة',
  'Quand quelqu’un de ta promo trouve un stage grâce au réseau, sa réussite arrive ici, prête à partager.': 'عندما يجد أحد أفراد دفعتك تدريبًا بفضل الشبكة، يظهر نجاحه هنا جاهزًا للمشاركة.',
  'Seulement les réussites vérifiées des deux côtés. Le prénom n’apparaît que si la personne a accepté d’être citée.': 'فقط النجاحات المؤكَّدة من الطرفين. لا يظهر الاسم إلا إذا وافق صاحبه على ذكره.',
  'Merci de faire vivre ta promo !': 'شكرًا لأنك تُبقي دفعتك حاضرة!', 'Ne plus être ambassadeur': 'التوقف عن دور السفير',
  'inscrit': 'مسجَّل', 'inscrits': 'مسجَّلون', 'demande pourvue': 'طلب تحقّق', 'demandes pourvues': 'طلبات تحقّقت',
  'stage ou emploi trouvé': 'تدريب أو وظيفة', 'stages et emplois trouvés': 'تداريب ووظائف',
  'Fait venir la promo et relaie ses réussites. Merci !': 'يدعو الدفعة وينقل نجاحاتها. شكرًا!',
  'Merci': 'شكرًا',
  'Trop tard, c’est déjà proposé à quelqu’un d’autre.': 'فات الأوان: اقتُرح الدور على شخص آخر.',
  'Ambassadeurs de promo': 'سفراء الدفعات', 'Proposer maintenant': 'اقتراح الآن', 'Retirer': 'سحب', 'Nommer': 'تعيين', 'Nommer à la main': 'تعيين يدوي',
  'Nom d’un étudiant ou d’un lauréat': 'اسم طالب أو خريج', 'Aucun ambassadeur pour l’instant.': 'لا يوجد سفراء حاليًا.',
  'Rien à proposer pour l’instant.': 'لا شيء للاقتراح حاليًا.', '1 changement : proposition faite ou expirée.': 'تغيير واحد: اقتراح جديد أو منتهٍ.',
  ' · nommé par l’administration': ' · بتعيين من الإدارة', ' · sans nom': ' · دون اسم',
  'Ambassadeur de promo': 'سفير الدفعة', 'Fait venir sa promo et relaie ses réussites': 'يدعو دفعته وينقل نجاحاتها',
  [`La plateforme propose le rôle au membre le plus actif de chaque promo et filière ; sans réponse en ${AMB_DELAI_JOURS} jours ou après un refus, au suivant. Un seul ambassadeur par promo et filière.`]: `تقترح المنصة الدور على العضو الأكثر نشاطًا في كل دفعة وشعبة؛ وإن لم يأتِ رد خلال ${AMB_DELAI_JOURS} أيام أو جاء رفض، فعلى من يليه. سفير واحد لكل دفعة وشعبة.`,
}, [
  [/^Deviens ambassadeur de ta promo \((.+)\)$/, g => `كن سفير دفعتك (${g})`],
  [/^La plateforme te propose d’être ambassadeur de ta promo \((.+)\)\.$/, g => `تقترح عليك المنصة أن تكون سفير دفعتك (${g}).`],
  [/^Ton badge « Ambassadeur promo (\d{4}) » est sur ton profil\. Le lien de ta promo, ses réussites et ses chiffres t’attendent sur l’accueil\.$/, y => `شارة «سفير دفعة ${y}» على ملفك الآن. رابط دفعتك ونجاحاتها وأرقامها تنتظرك في الرئيسية.`],
  [/^Ambassadeur promo (\d{4})$/, y => `سفير دفعة ${y}`],
  [/^Fait venir la promo (\d{4}) \((.+)\) et relaie ses réussites$/, (y, f) => `يدعو دفعة ${y} (${f}) وينقل نجاحاتها`],
  [/^Promo (\d{4}) · (.+)$/, (y, f) => `دفعة ${y} · ${f}`],
  [/^En (\S+) (\d{4})$/, (m, y) => `في ${AR_MOIS[m] || m} ${y}`],
  [/^\+(\d+) ce mois-ci$/, n => `+${n} هذا الشهر`],
  [/^Ambassadeur depuis le (.+)$/, j => `سفير منذ ${j}`],
  [/^Proposé, réponse attendue avant le (.+)$/, j => `في انتظار الرد قبل ${j}`],
  [/^(.+) n’est plus ambassadeur\.$/, n => `لم يعد ${n} سفيرًا للدفعة.`],
  [/^(.+) est déjà proposé ou ambassadeur\.$/, n => `${n} مقترح عليه الدور أو سفير بالفعل.`],
  [/^Proposé à (.+) : la proposition l’attend sur son accueil\.$/, n => `تم الاقتراح على ${n}: ينتظره الاقتراح في صفحته الرئيسية.`],
  [/^(\d+) changements : propositions faites ou expirées\.$/, n => `${n} تغييرات: اقتراحات جديدة أو منتهية.`],
]);
