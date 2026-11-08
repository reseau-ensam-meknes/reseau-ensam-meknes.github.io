// La saison ensemble : défis collectifs, Coupe des promos, parrainage des 3A, « Ton année dans le réseau ».
import { html, useState, useMemo, useEffect } from './vendor/preact-htm.js';
import { Icon, Modal, Field, Empty, Person, Bar, Num, toast, useLocal } from './ui.js';
import { getLang, t as tr } from './i18n.js';
import { MessageBtn } from './messages.js';
import { MESURES, defiProgress, activeDefis, coupeDesPromos, computeScores, tonAnnee, niveauOf, seasonLabel, NIVEAUX, proximiteFiliere, filiereCourte, pourLEcoleVue, deMonEcole, NOMS_MEKNES, nomsAPartagerDe } from './logic.js';

const NIV_OPTS = [['', 'Toutes les années'], [3, '3A'], [4, '4A'], [5, '5A'], [6, 'Jeunes diplômés']];
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const MOIS_NOM = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// ---------------------------------------------------------------------------
// Défis de saison : une barre collective sur l'accueil
// ---------------------------------------------------------------------------
export function DefisPanel({ ctx }) {
  const { data, me, saison } = ctx;
  // Un étudiant ne voit que les défis de son année (ou ceux de tout le monde)
  const niv = me.role === 'etudiant' ? niveauOf(me, saison) : null;
  const list = deMonEcole(activeDefis(data), me).filter(d => !niv || !d.niveau || d.niveau === niv).map(d => ({ d, p: defiProgress(data, d) })).sort((a, b) => a.p.daysLeft - b.p.daysLeft);
  if (!list.length) return null;
  return html`<div class="panel defis">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="trophy"/> Défi${list.length > 1 ? 's' : ''} de l’année</h2></div>
    ${list.map(({ d, p }) => html`<div class=${'defi' + (p.done ? ' done' : '')} key=${d.id}>
      <div class="row"><strong class="grow">${d.titre}</strong><span class="mono">${p.n}/${p.cible}</span></div>
      <${Bar} value=${p.ratio} pace=${p.done ? undefined : p.elapsed} label=${`${p.n} sur ${p.cible}`}/>
      <span class="small muted">${p.done ? html`<span class="good-t"><${Icon} name="check" size=${13}/> Défi réussi, bravo à tous !</span>` : `${MESURES[d.mesure]?.label || ''}${d.niveau ? ' · ' + (NIVEAUX[d.niveau]?.short || '') : ''} · encore ${p.daysLeft} j`}</span>
    </div>`)}
    <p class="small muted">Chaque offre, chaque mentorat, chaque recrutement confirmé fait avancer la barre.</p>
  </div>`;
}

// ecoleTag : le nom de l'école des défis montrés (console, plusieurs écoles) ; les données reçues sont celles de cette école
export function DefisAdmin({ ctx, ecoleTag = null, plusieursEcoles = false }) {
  const { data, store, act } = ctx;
  const now = new Date();
  const fin = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const [f, setF] = useState(null);
  const sugg = [
    [`${MOIS_NOM[now.getMonth()]} : 15 stages pour les 4A`, 'stages', 4, 15],
    [`${MOIS_NOM[now.getMonth()]} : 20 mentorats terminés`, 'mentorats', '', 20],
    [`${MOIS_NOM[now.getMonth()]} : 30 offres partagées`, 'offres', '', 30],
  ];
  const list = [...data.defis].sort((a, b) => b.fin.localeCompare(a.fin));
  const start = ([titre, mesure, niveau, cible]) => setF({ titre, mesure, niveau, cible, debut: iso(now), fin: iso(fin) });
  const save = e => { e.preventDefault(); act(async () => {
    // Depuis la console, pour l'école qu'elle regarde (sinon celle de l'administration, par défaut dans la base)
    await store.insert('defis', { titre: f.titre.trim(), mesure: f.mesure, niveau: f.niveau ? +f.niveau : null, cible: +f.cible, debut: f.debut, fin: f.fin, ...pourLEcoleVue(ctx) });
    toast(plusieursEcoles ? 'Défi lancé : il apparaît sur l’accueil de tous les membres de l’école.' : 'Défi lancé : il apparaît sur l’accueil de tous.'); setF(null);
  }); };
  return html`<div class="panel">
    <div class="section-head"><h2 class="h-ico"><${Icon} name="trophy"/> Défis de l’année ${ecoleTag}</h2><button class="btn small" onClick=${() => start(['', 'reussites', '', 20])}><${Icon} name="plus" size=${15}/> Nouveau défi</button></div>
    <p class="muted small">Un objectif collectif affiché sur l’accueil, avec une barre qui avance toute seule.</p>
    ${f ? html`<form class="form defi-form" onSubmit=${save}>
      <${Field} label="Titre"><input id="df-titre" required minlength="4" maxlength="120" value=${f.titre} onInput=${e => setF({ ...f, titre: e.target.value })} placeholder="Ex. Novembre : 15 stages pour les 4A"/><//>
      <div class="grid3"><${Field} label="On compte"><select id="df-mes" value=${f.mesure} onChange=${e => setF({ ...f, mesure: e.target.value })}>${Object.entries(MESURES).map(([k, m]) => html`<option value=${k}>${m.label}</option>`)}</select><//>
        <${Field} label="Année"><select id="df-niv" value=${f.niveau} onChange=${e => setF({ ...f, niveau: e.target.value })}>${NIV_OPTS.map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select><//>
        <${Field} label="Objectif"><input id="df-cible" type="number" min="1" max="10000" required value=${f.cible} onInput=${e => setF({ ...f, cible: e.target.value })}/><//></div>
      <div class="grid2"><${Field} label="Début"><input id="df-debut" type="date" required value=${f.debut} onInput=${e => setF({ ...f, debut: e.target.value })}/><//><${Field} label="Fin"><input id="df-fin" type="date" required min=${f.debut} value=${f.fin} onInput=${e => setF({ ...f, fin: e.target.value })}/><//></div>
      <div class="row-end"><button type="button" class="btn ghost" onClick=${() => setF(null)}>Annuler</button><button class="btn primary" disabled=${f.titre.trim().length < 4 || !(+f.cible > 0) || f.fin < f.debut}>Lancer le défi</button></div>
    </form>` : html`<div class="chips">${sugg.map(s => html`<button class="chip" onClick=${() => start(s)}><${Icon} name="plus" size=${13}/> ${s[0]}</button>`)}</div>`}
    ${list.length ? html`<ul class="people-list">${list.map(d => { const p = defiProgress(data, d); const past = new Date(d.fin + 'T23:59:59') < now; return html`<li key=${d.id}>
      <span class="grow"><strong>${d.titre}</strong><span class="small muted"> · ${p.n}/${p.cible}${past ? ' · terminé' : ` · jusqu’au ${new Date(d.fin + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}</span></span>
      <button class="icon-btn small" aria-label="Supprimer" onClick=${() => ctx.confirm('Supprimer ce défi ?', () => act(() => store.remove('defis', d.id)))}><${Icon} name="trash" size=${14}/></button></li>`; })}</ul>` : null}
  </div>`;
}

// ---------------------------------------------------------------------------
// Coupe des promos : les promos de lauréats qui aident le plus cette saison
// ---------------------------------------------------------------------------
export function CoupePromos({ ctx, compact = false }) {
  const { data, me, saison } = ctx;
  const scores = useMemo(() => computeScores(data, new Date(saison, 8, 1)), [data, saison]);
  const board = coupeDesPromos(data, saison, scores);
  const myRank = board.findIndex(x => x.promo === me.promo) + 1;
  if (compact) {
    if (!board.length) return null;
    return html`<button class="panel clickable coupe-mini" onClick=${() => ctx.go('reseau/classement/promos')}>
      <div class="section-head"><h2 class="h-ico"><${Icon} name="trophy"/> Coupe des promos</h2><${Icon} name="arrow" size=${16}/></div>
      <ol class="coupe-top">${board.slice(0, 3).map((x, i) => html`<li class=${x.promo === me.promo ? 'me' : ''}><span class=${'medal m' + (i + 1)}>${i + 1}</span> Promo ${x.promo}<span class="spacer"></span><span class="mono">${x.pts} pts</span></li>`)}</ol>
      ${me.role === 'laureat' ? html`<p class="small muted">${myRank ? (myRank <= 3 ? 'Ta promo est sur le podium. Continuez !' : `Ta promo est ${myRank}e sur ${board.length}.`) : 'Ta promo n’a pas encore de points cette année. Lance-la !'}</p>` : null}
    </button>`;
  }
  return html`<div class="sub-page">
    <p class="muted small">Les points d’impact de l’année ${seasonLabel(saison)}, additionnés par promo de lauréats. Remise à zéro chaque 1er septembre.</p>
    ${board.length ? html`<ol class="board">${board.map((x, i) => html`<li key=${x.promo} class=${(i < 3 ? 'podium p' + (i + 1) : '') + (x.promo === me.promo ? ' me' : '')}>
      <span class="rank-n mono">${i < 3 ? html`<span class=${'medal m' + (i + 1)}>${i + 1}</span>` : i + 1}</span>
      <span class="grow"><strong>Promo ${x.promo}</strong><span class="small muted"> · ${x.actifs} lauréat${x.actifs > 1 ? 's' : ''} actif${x.actifs > 1 ? 's' : ''} sur ${x.membres}</span></span>
      <span class="mono pts">${x.pts} pts</span></li>`)}</ol>` : html`<${Empty} icon="trophy" title="La coupe démarre">La première offre ou le premier mentorat de l’année ouvre le classement.<//>`}
  </div>`;
}

// ---------------------------------------------------------------------------
// Parrainage : chaque 3A a un lauréat de sa filière pour l'année
// ---------------------------------------------------------------------------
export function ParrainCard({ ctx, plein = true }) {
  const { data, me, saison, store, openProfile } = ctx;
  const n = niveauOf(me, saison);
  const pr = data.parrainages.find(x => x.filleul_id === me.id && x.saison === saison);
  const [asked, setAsked] = useState(false);
  useEffect(() => { if (n === 3 && !pr && !asked) { setAsked(true); store.monParrain?.().catch(() => {}); } }, [n, pr]);
  if (me.role !== 'etudiant' || n !== 3 || !pr) return null;
  const p = store.byId('profiles', pr.parrain_id);
  if (!p) return null;
  // Une carte : qui il est, pourquoi lui écrire, deux gestes. « Lui écrire » est le bouton plein de la page,
  // sauf si une carte à confirmer (ou un merci) l'a déjà au-dessus : il passe alors en tonal, le conseil en discret.
  return html`<section class="parrain-card" aria-label="Ton parrain">
    <p class="eyebrow"><${Icon} name="heart" size=${14}/> Ton parrain</p>
    <${Person} p=${p} onOpen=${openProfile} size=${48}/>
    <p class="parrain-txt">De ta filière, avec quelques années d’avance. Pose-lui tes questions sur les stages, la 4A, la vie après l’école.</p>
    <div class="parrain-acts"><${MessageBtn} ctx=${ctx} p=${p} label="Lui écrire" cls=${plein ? 'btn primary' : 'btn tonal'}/>
      <button type="button" class=${plein ? 'btn tonal' : 'btn ghost'} onClick=${() => ctx.askHelp(p)}><${Icon} name="mentor" size=${16}/> Lui demander un conseil</button></div>
  </section>`;
}

export function DevenirParrain({ ctx }) {
  const { me, store, act, data, saison } = ctx;
  const [off, setOff] = useLocal('parrain-off-' + me.id, false);
  if (me.role !== 'laureat' || me.parrain_dispo || off) return null;
  const n3 = data.profiles.filter(p => p.role === 'etudiant' && proximiteFiliere(p.filiere, me.filiere) > 0 && niveauOf(p, saison) === 3).length;
  return html`<div class="help-cta parrain-cta"><span class="obj-ico brass"><${Icon} name="heart" size=${20}/></span>
    <div class="grow"><strong>Deviens parrain d’un 3A de ta filière</strong><span class="small muted">${n3 ? `${n3} étudiant${n3 > 1 ? 's' : ''} de 3A dans ton parcours cette année. ` : ''}Un message de bienvenue, un conseil de temps en temps : trois filleuls au plus.</span></div>
    <button class="btn small tonal" onClick=${() => act(async () => { await store.update('profiles', me.id, { parrain_dispo: true }); toast('Merci ! Tes filleuls te sont attribués automatiquement.'); })}>Je deviens parrain</button>
    <button class="icon-btn small" aria-label="Plus tard" onClick=${() => setOff(true)}><${Icon} name="x" size=${15}/></button></div>`;
}

export function Filleuls({ ctx }) {
  const { data, me, saison, store, openProfile, act } = ctx;
  if (me.role !== 'laureat') return null;
  const list = data.parrainages.filter(x => x.parrain_id === me.id && x.saison === saison).map(x => store.byId('profiles', x.filleul_id)).filter(Boolean);
  if (!list.length && !me.parrain_dispo) return null;
  // Mon espace > Impact : les filleuls en lignes compactes (année et filière en code court), un mot de bienvenue à portée de main
  const stop = me.parrain_dispo ? html`<button type="button" class="linkish esp-note-act" onClick=${() => act(async () => { await store.update('profiles', me.id, { parrain_dispo: false }); toast('Tu ne recevras plus de nouveaux filleuls.'); })}>Plus de nouveaux filleuls</button>` : null;
  return html`<section class="esp-bloc esp-filleuls" aria-labelledby="esp-filleuls-titre">
    <h2 class="esp-h" id="esp-filleuls-titre">Mes filleuls${list.length ? html` <span class="count">${list.length}</span>` : null}</h2>
    ${list.length ? html`<ul class="esp-lignes">${list.map(p => html`<li key=${p.id}><div class="esp-ligne">
      <${Person} p=${p} onOpen=${openProfile} size=${44} sub=${html`<span>${NIVEAUX[niveauOf(p, saison)]?.short || ''}</span> · <span translate="no">${filiereCourte(p.filiere)}</span>`}/>
      <${MessageBtn} ctx=${ctx} p=${p} cls="btn tiny tonal" aria=${`Écrire à ${(p.full_name || '').split(' ')[0]}`}/></div></li>`)}</ul>` : null}
    <div class="esp-note"><p>${list.length ? 'Envoie-leur un mot de bienvenue : c’est souvent le seul lauréat qu’ils connaissent.' : 'Tu es parrain disponible. Dès qu’un 3A de ton parcours s’inscrit, il te sera confié.'}</p>${stop}</div>
  </section>`;
}

// ---------------------------------------------------------------------------
// « Ton année dans le réseau » : le bilan personnel de la saison
// ---------------------------------------------------------------------------
export function bilanSaison(saison, now = new Date()) {
  const m = now.getMonth();
  if (m >= 5 && m <= 7) return saison; // juin à août : la saison qui se termine
  if (m === 8) return saison - 1; // septembre : celle qui vient de finir
  return null;
}

export function TonAnneeStrip({ ctx, onOpen }) {
  const { me, saison } = ctx;
  const s = bilanSaison(saison);
  const [off, setOff] = useLocal(`annee-off-${me.id}-${s}`, false);
  if (s === null || off || me.role === 'admin') return null;
  return html`<div class="annonce annee-strip"><${Icon} name="award" size=${20}/><span class="grow"><strong>Ton année dans le réseau</strong> · ${seasonLabel(s)} : ce que tu as vécu, en un coup d’œil.</span>
    <button class="btn small tonal" onClick=${() => onOpen(s)}>Voir mon année</button><button class="icon-btn small" aria-label="Masquer" onClick=${() => setOff(true)}><${Icon} name="x" size=${15}/></button></div>`;
}

// Le résumé à copier, dans la langue de l'interface (langue). noms : ceux de l'école du membre (nomsAPartager) ;
// l'ENSAM Meknès par défaut, avec ses textes d'avant.
export function resumeAnnee(t, saison, shown, langue, noms = NOMS_MEKNES) {
  if (langue === 'ar') {
    const faits = shown.map(([, n, a, b]) => `${n} ${tr(n > 1 ? b : a)}`).join('، ') || 'بداية جيدة';
    return t.role === 'etudiant'
      ? `سنتي ${seasonLabel(saison)} في شبكة ${noms.nomAr}: ${faits}${t.reussite ? `، ونجاح لدى ${t.reussite.entreprise}` : ''}. شكرًا لخريجي المدرسة!`
      : `سنتي ${seasonLabel(saison)} في شبكة ${noms.nomAr}: ${faits}. فخور بمساعدة طلبة المدرسة.`;
  }
  const faits = shown.map(([, n, a, b]) => `${n} ${n > 1 ? b : a}`).join(', ') || 'un bon début';
  return t.role === 'etudiant'
    ? `Mon année ${seasonLabel(saison)} sur le Réseau ${noms.nom} : ${faits}${t.reussite ? `, et une réussite chez ${t.reussite.entreprise}` : ''}. Merci aux lauréats de l’école !`
    : `Mon année ${seasonLabel(saison)} sur le Réseau ${noms.nom} : ${faits}. Fier d’aider les étudiants de l’école.`;
}

export function TonAnnee({ ctx, saison, onClose }) {
  const { data, me, store } = ctx;
  const t = useMemo(() => tonAnnee(data, me, saison), [data, me, saison]);
  const first = me.full_name.split(' ')[0];
  const facts = t.role === 'etudiant' ? [
    ['send', t.candidatures, 'candidature', 'candidatures'], ['people', t.entretiens, 'entretien', 'entretiens'],
    ['mentor', t.mentorats, 'mentorat', 'mentorats'], ['star', t.laureats, 'lauréat rencontré', 'lauréats rencontrés'],
    ['qa', t.questions, 'question posée', 'questions posées'], ['comment', t.reponses, 'réponse reçue', 'réponses reçues'],
    ['clap', t.cafes, 'café ENSAM', 'cafés ENSAM'], ['heart', t.bravos, 'bravo reçu', 'bravos reçus'],
  ] : [
    ['star', t.points, 'point d’impact', 'points d’impact'], ['briefcase', t.recrutes, 'recruté grâce à toi', 'recrutés grâce à toi'],
    ['mentor', t.mentorats, 'mentorat', 'mentorats'], ['feed', t.offres, 'offre partagée', 'offres partagées'],
    ['inbox', t.candidatures, 'candidature reçue', 'candidatures reçues'], ['qa', t.reponses, 'réponse donnée', 'réponses données'],
    ['heart', t.filleuls, 'filleul', 'filleuls'], ['clap', t.mercis.length, 'merci reçu', 'mercis reçus'],
  ];
  const shown = facts.filter(f => f[1] > 0);
  const resume = resumeAnnee(t, saison, shown, getLang(), nomsAPartagerDe(data, me));
  const copy = () => { try { navigator.clipboard.writeText(resume).then(() => toast('Texte copié : colle-le où tu veux.'), () => toast('Copie impossible ici.', 'err')); } catch { toast('Copie impossible ici.', 'err'); } };
  return html`<${Modal} title="Ton année dans le réseau" onClose=${onClose} wide>
    <div class="annee">
      <div class="annee-head sky"><p class="eyebrow">Année ${seasonLabel(saison)}</p><h2>${first}, voici ton année</h2>
        ${t.role === 'etudiant' && t.reussite ? html`<p class="annee-win"><${Icon} name="trophy" size=${18}/> Réussite confirmée chez <strong>${t.reussite.entreprise}</strong></p>` : null}
        ${t.role !== 'etudiant' && t.rangPromo ? html`<p class="annee-win"><${Icon} name="trophy" size=${18}/> Ta promo ${me.promo} est ${t.rangPromo === 1 ? '1re' : t.rangPromo + 'e'} sur ${t.promos} à la Coupe des promos</p>` : null}</div>
      ${shown.length ? html`<div class="annee-grid">${shown.map(([ic, n, a, b]) => html`<div class="annee-fact"><span class="fact-ico"><${Icon} name=${ic} size=${18}/></span><span class="big mono"><${Num} v=${n}/></span><span>${n > 1 ? b : a}</span></div>`)}</div>`
        : html`<${Empty} icon="spark" title="Ton année commence ici">Une candidature, un mentorat, une réponse : chaque geste compte et apparaîtra ici.<//>`}
      ${t.role !== 'etudiant' && t.mercis.length ? html`<div class="mercis">${t.mercis.slice(0, 3).map(m => html`<blockquote class="merci"><p>« ${m} »</p></blockquote>`)}</div>` : null}
      <div class="row-end"><button class="btn ghost" onClick=${copy}><${Icon} name="copy" size=${15}/> Copier le résumé</button><button class="btn primary" onClick=${onClose}>Fermer</button></div>
    </div>
  <//>`;
}
