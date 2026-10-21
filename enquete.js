// Enquête d'insertion à 6 et 12 mois après le diplôme : le questionnaire (2 minutes), la carte d'accueil,
// et les aides partagées avec le tableau de bord (chiffres agrégés, jamais en dessous de 5 réponses).
import { html, useState, useEffect } from './vendor/preact-htm.js';
import { Icon, Field, Bar, toast, useLocal, injectCSS } from './ui.js';
import { addAR } from './i18n.js';
import { enqueteDue, niveauOf, seasonOf, pct, SITUATIONS, SALAIRES, CANAUX, SECTEURS } from './logic.js';

export const EN_POSTE = new Set(['emploi', 'entrepreneur', 'volontariat']);
const SIT_ICON = { emploi: 'briefcase', entrepreneur: 'spark', volontariat: 'globe', recherche: 'search', etudes: 'cap', autre: 'more' };
export const CONTRATS = { cdi: 'CDI', cdd: 'CDD', anapec: 'Contrat ANAPEC', freelance: 'Freelance', stage: 'Stage', autre: 'Autre' };
const LIEN = ['Aucun lien', 'Un peu', 'Moyennement', 'Beaucoup', 'Exactement mon domaine'];
const SATIS = ['Pas satisfait(e)', 'Peu satisfait(e)', 'Moyennement', 'Satisfait(e)', 'Très satisfait(e)'];
const DELAIS = Array.from({ length: 37 }, (_, i) => i);
const MOIS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'];
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// Les deux vagues de la promo P : 6 mois (janvier à juin de P+1), 12 mois (juillet de P+1 à mars de P+2)
export function vaguesDe(promo) {
  return [[6, new Date(promo + 1, 0, 1), new Date(promo + 1, 6, 1)], [12, new Date(promo + 1, 6, 1), new Date(promo + 2, 3, 1)]];
}
export function vagueOuverte(promo, now = new Date()) {
  if (!promo) return null;
  const t = now.getTime();
  for (const [v, debut, fin] of vaguesDe(promo)) if (t >= debut && t < fin) return { vague: v, debut, fin };
  return null;
}
const eligible = (me, now = new Date()) => !!me && me.role !== 'admin' && !!me.promo && (me.role === 'laureat' || niveauOf(me, seasonOf(now)) >= 6);
const moisAn = d => `${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
const mois = v => (+v === 12 ? '12 شهراً' : `${v} أشهر`);

// Taux d'insertion d'une ligne agrégée : en poste / (répondants − poursuite d'études)
export const tauxInsertion = r => (r && r.n - r.etudes > 0 ? r.en_poste / (r.n - r.etudes) : null);

// Chiffres agrégés (stats_insertion côté base), rechargés quand une réponse arrive
export function useStatsInsertion(store, dep) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let on = true;
    Promise.resolve(store.statsInsertion?.()).then(r => on && setRows(Array.isArray(r) ? r : []), () => on && setRows([]));
    return () => { on = false; };
  }, [dep]);
  return rows;
}

addAR({
  'Enquête d’insertion': 'استطلاع الإدماج المهني',
  'Où en es-tu aujourd’hui ?': 'أين وصلت اليوم؟',
  'Deux minutes pour aider l’école à suivre chaque promo, et les étudiants à se projeter. Tes réponses restent confidentielles : seuls des chiffres agrégés sont publiés, jamais en dessous de 5 réponses.': 'دقيقتان لمساعدة المدرسة على تتبع كل دفعة، ومساعدة الطلبة على تصور مستقبلهم. أجوبتك سرية: لا تُنشر إلا أرقام مجمّعة، وأبداً تحت 5 أجوبة.',
  'Ta situation': 'وضعيتك',
  'Ton poste': 'منصبك',
  'Ton avis': 'رأيك',
  'Poursuite d’études': 'متابعة الدراسة',
  'En emploi': 'في وظيفة',
  'Création d’entreprise': 'إنشاء مقاولة',
  'Volontariat ou VIE': 'تطوع أو VIE',
  'Type de contrat': 'نوع العقد',
  'Contrat ANAPEC': 'عقد ANAPEC',
  'Freelance': 'عمل حر',
  'Combien de mois après le diplôme as-tu commencé ?': 'بعد كم شهراً من التخرج بدأت؟',
  'Dès le diplôme (ou avant)': 'مباشرة عند التخرج (أو قبله)',
  'Salaire net mensuel (facultatif)': 'الراتب الشهري الصافي (اختياري)',
  'Comment as-tu trouvé ?': 'كيف وجدت هذا المنصب؟',
  'Ton poste correspond-il à ta formation ?': 'هل يتوافق منصبك مع تكوينك؟',
  'Aucun lien': 'لا علاقة',
  'Un peu': 'قليلاً',
  'Moyennement': 'متوسط',
  'Beaucoup': 'كثيراً',
  'Exactement mon domaine': 'مجالي بالضبط',
  'Es-tu satisfait(e) de ta formation à l’ENSAM ?': 'هل أنت راضٍ عن تكوينك في ENSAM؟',
  'Pas satisfait(e)': 'غير راضٍ',
  'Peu satisfait(e)': 'قليل الرضا',
  'Satisfait(e)': 'راضٍ',
  'Très satisfait(e)': 'راضٍ جداً',
  'Un mot pour l’école (facultatif)': 'كلمة للمدرسة (اختياري)',
  'Seule l’administration le lit.': 'لا تقرؤها إلا الإدارة.',
  'Établissement, master, doctorat…': 'المؤسسة، الماستر، الدكتوراه…',
  'Mettre aussi à jour mon profil (entreprise, poste, ville, pays)': 'تحديث ملفي أيضاً (المقاولة، المنصب، المدينة، البلد)',
  'Poste (pour ton profil)': 'المنصب (لملفك)',
  'Envoyer ma réponse': 'إرسال جوابي',
  'Choisis ta situation pour continuer.': 'اختر وضعيتك للمتابعة.',
  'Merci, ta réponse est enregistrée.': 'شكراً، تم حفظ جوابك.',
  'Merci !': 'شكراً!',
  'Ta réponse aide l’école à suivre l’insertion de chaque promo, et les étudiants à se projeter.': 'جوابك يساعد المدرسة على تتبع إدماج كل دفعة، ويساعد الطلبة على تصور مستقبلهم.',
  'Ta réponse est enregistrée.': 'تم حفظ جوابك.',
  'Réponse mise à jour.': 'تم تحديث الجواب.',
  'Modifier ma réponse': 'تعديل جوابي',
  'Voir l’insertion de toutes les promos': 'عرض إدماج كل الدفعات',
  'Retour à l’accueil': 'العودة إلى الرئيسية',
  'Ce que disent les promos': 'ماذا تقول الدفعات',
  'Les résultats de ta promo s’affichent dès 5 réponses, pour protéger l’anonymat.': 'تظهر نتائج دفعتك ابتداءً من 5 أجوبة، حمايةً لسرية المشاركين.',
  'L’enquête arrive après le diplôme': 'الاستطلاع يأتي بعد التخرج',
  'Elle s’adresse aux diplômés : une première fois 6 mois après le diplôme (de janvier à juin), puis 12 mois après (de juillet à mars). Tu recevras un email le moment venu.': 'يخص الخريجين: مرة أولى بعد 6 أشهر من التخرج (من يناير إلى يونيو)، ثم بعد 12 شهراً (من يوليوز إلى مارس). ستتوصل برسالة في الوقت المناسب.',
  'Pas d’enquête ouverte pour ta promo en ce moment': 'لا يوجد استطلاع مفتوح لدفعتك حالياً',
  'L’enquête est envoyée automatiquement aux diplômés': 'يُرسل الاستطلاع تلقائياً إلى الخريجين',
  'Chaque diplômé reçoit un email 6 mois puis 12 mois après le diplôme, avec un rappel trois semaines plus tard. Les résultats sont dans le rapport d’insertion.': 'يتوصل كل خريج برسالة بعد 6 أشهر ثم بعد 12 شهراً من التخرج، مع تذكير بعد ثلاثة أسابيع. النتائج موجودة في تقرير الإدماج.',
  'Voir le rapport d’insertion': 'عرض تقرير الإدماج',
  'L’enquête suit chaque promo 6 mois puis 12 mois après le diplôme : pour ta promo, ces deux étapes sont passées. Garder ton profil à jour (entreprise, poste, ville) aide tout autant les étudiants.': 'يتتبع الاستطلاع كل دفعة بعد 6 أشهر ثم بعد 12 شهراً من التخرج: بالنسبة لدفعتك، مرت المرحلتان. تحديث ملفك (المقاولة، المنصب، المدينة) يساعد الطلبة بالقدر نفسه.',
  'Mes réponses': 'أجوبتي',
  'Taux d’insertion': 'نسبة الإدماج',
  'Satisfaction': 'الرضا',
  'délai médian après le diplôme': 'المدة الوسيطة بعد التخرج',
  'des diplômés en poste': 'من الخريجين العاملين',
  'formation reçue, sur 5': 'التكوين المتلقى، من 5',
  'Masquer pour 7 jours': 'إخفاء لمدة 7 أيام',
  '2 minutes pour aider l’école et les promos suivantes.': 'دقيقتان لمساعدة المدرسة والدفعات القادمة.',
  'Cette plateforme': 'هذه المنصة',
  'Suite au stage ou PFE': 'بعد التدريب أو مشروع التخرج',
  'Candidature spontanée': 'ترشيح تلقائي',
  'Concours': 'مباراة',
  'Moins de 6 000 DH': 'أقل من 6000 درهم',
  '6 000 à 10 000 DH': 'من 6000 إلى 10000 درهم',
  '10 000 à 15 000 DH': 'من 10000 إلى 15000 درهم',
  '15 000 à 20 000 DH': 'من 15000 إلى 20000 درهم',
  '20 000 à 30 000 DH': 'من 20000 إلى 30000 درهم',
  'Plus de 30 000 DH': 'أكثر من 30000 درهم',
  'Je préfère ne pas dire': 'أفضل عدم الإفصاح',
}, [
  [/^Enquête (6|12) mois après le diplôme$/, v => `استطلاع ${mois(v)} بعد التخرج`],
  [/^Enquête (6|12) mois après le diplôme : 2 minutes pour aider l’école et les promos suivantes\.$/, v => `استطلاع ${mois(v)} بعد التخرج: دقيقتان لمساعدة المدرسة والدفعات القادمة.`],
  [/^Promo (\d{4}) · (6|12) mois après le diplôme$/, (p, v) => `دفعة ${p} · ${mois(v)} بعد التخرج`],
  [/^(\d+) mois$/, n => (+n === 1 ? 'شهر واحد' : +n === 2 ? 'شهران' : +n <= 10 ? `${n} أشهر` : `${n} شهراً`)],
  [/^(\d+,\d+) mois$/, n => `${n} أشهر`],
  [/^(\d+(?:,\d+)?) \/ 5$/, n => `${n} / 5`],
  [/^Réponse à (6|12) mois$/, v => `الجواب بعد ${mois(v)}`],
  [/^La prochaine s’ouvre en (\S+) (\d{4})\.$/, (m, y) => `يُفتح الاستطلاع القادم في ${MOIS_AR[MOIS_FR.indexOf(m)] || m} ${y}.`],
  [/^(\d+) en poste sur (\d+)$/, (a, b) => `${a} يعملون من أصل ${b}`],
]);

injectCSS('enquete', `
.enq-sits { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .55rem; }
.enq-sit { display: flex; flex-direction: column; align-items: center; gap: .45rem; padding: .9rem .5rem; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: 600 .88rem/1.25 var(--f-body); text-align: center; cursor: pointer; transition: transform .25s var(--ease), box-shadow .25s, border-color .2s, background .2s; }
.enq-sit:hover { transform: translateY(-2px); box-shadow: var(--shadow-lift); border-color: var(--accent); }
.enq-sit.on { border-color: var(--accent); background: var(--accent-soft); box-shadow: 0 0 0 1px var(--accent); }
.enq-sit .need-ico { width: 42px; height: 42px; }
.enq-step h2 { display: flex; align-items: center; gap: .5rem; font-size: 1.05rem; margin: 0; }
.enq-step h2 .n { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--accent); color: var(--accent-ink); font: 600 .82rem var(--f-mono); flex: none; }
.enq-rate { display: flex; align-items: center; gap: .6rem; flex-wrap: wrap; }
.enq-rate .lbl { font-size: .85rem; color: var(--ink-2); }
.enq-ok { display: flex; gap: 1rem; align-items: flex-start; padding: 1.2rem; border-radius: 14px; background: linear-gradient(135deg, var(--good-soft), var(--surface) 80%); border: 1px solid var(--line); }
.enq-ok .obj-ico { background: var(--good-soft); color: var(--good); }
.enq-ok h2 { margin: 0 0 .2rem; }
.enq-ok p { margin: 0; }
.enq-card { display: flex; gap: .9rem; align-items: center; padding: .9rem 1rem; border-radius: 14px; background: linear-gradient(135deg, var(--brass-soft), var(--surface) 85%); border: 1px solid var(--line); }
.enq-card .grow { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .15rem; }
.enq-answer + .enq-answer { border-top: 1px solid var(--line); padding-top: .7rem; }
.enq-answer .eyebrow { margin: 0 0 .4rem; }
.enq-mine { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: .3rem .9rem; margin: 0; font-size: .9rem; }
.enq-mine dt { color: var(--muted); }
.enq-mine dd { margin: 0; }
.enq-form { gap: 1rem; }
.ins-kpis .kpi-val { font-size: 1.7rem; }
.ins-kpis .bar { margin-top: .3rem; }
@media (max-width: 760px) {
  .enq-sits { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .enq-card { flex-wrap: wrap; }
  .enq-card .grow { flex-basis: calc(100% - 60px); }
  .enq-card .btn { flex: 1; }
}
`);

// ---------------------------------------------------------------------------
// Page #enquete (lien des emails)
// ---------------------------------------------------------------------------
export function EnquetePage(ctx) {
  const { data, me, go } = ctx;
  const [edit, setEdit] = useState(null);
  const [merci, setMerci] = useState(false);
  const enquetes = data.enquetes_insertion || [];
  const mine = enquetes.filter(e => e.user_id === me.id).sort((a, b) => b.vague - a.vague);
  const due = enqueteDue(me, enquetes);

  if (me.role === 'admin') return html`<section class="page narrow">
    <header class="page-head"><div><p class="eyebrow">Enquête d’insertion</p><h1>L’enquête est envoyée automatiquement aux diplômés</h1></div></header>
    <div class="panel"><p>Chaque diplômé reçoit un email 6 mois puis 12 mois après le diplôme, avec un rappel trois semaines plus tard. Les résultats sont dans le rapport d’insertion.</p>
      <div class="row-end"><button class="btn primary" onClick=${() => go('suivi/insertion')}><${Icon} name="chart" size=${16}/> Voir le rapport d’insertion</button></div></div>
  </section>`;

  if (!eligible(me)) return html`<section class="page narrow">
    <header class="page-head"><div><p class="eyebrow">Enquête d’insertion</p><h1>L’enquête arrive après le diplôme</h1></div></header>
    <div class="panel"><p>Elle s’adresse aux diplômés : une première fois 6 mois après le diplôme (de janvier à juin), puis 12 mois après (de juillet à mars). Tu recevras un email le moment venu.</p>
      <div class="row-end"><button class="btn" onClick=${() => go('suivi/insertion')}><${Icon} name="chart" size=${16}/> Voir l’insertion de toutes les promos</button></div></div>
  </section>`;

  if (edit || (due && !merci)) {
    const vague = edit ? edit.vague : due.vague;
    return html`<section class="page narrow enquete">
      <header class="page-head"><div><p class="eyebrow">Promo ${me.promo} · ${vague} mois après le diplôme</p><h1>Où en es-tu aujourd’hui ?</h1></div></header>
      <p class="muted">Deux minutes pour aider l’école à suivre chaque promo, et les étudiants à se projeter. Tes réponses restent confidentielles : seuls des chiffres agrégés sont publiés, jamais en dessous de 5 réponses.</p>
      <${EnqueteForm} ctx=${ctx} vague=${vague} initial=${edit} key=${edit?.id || 'new' + vague}
        onDone=${() => { setEdit(null); setMerci(true); window.scrollTo?.(0, 0); }} onCancel=${edit ? () => setEdit(null) : null}/>
    </section>`;
  }

  const ouverte = vagueOuverte(me.promo);
  const prochaine = vaguesDe(me.promo).map(([, d]) => d).find(d => d > Date.now());
  return html`<section class="page narrow enquete">
    <header class="page-head"><div><p class="eyebrow">Enquête d’insertion</p><h1>${mine.length ? 'Merci !' : 'Pas d’enquête ouverte pour ta promo en ce moment'}</h1></div></header>
    ${mine.length ? html`<div class="enq-ok"><span class="obj-ico"><${Icon} name="check" size=${24}/></span><div>
        <h2>${merci ? 'Merci, ta réponse est enregistrée.' : 'Ta réponse est enregistrée.'}</h2>
        <p class="muted">Ta réponse aide l’école à suivre l’insertion de chaque promo, et les étudiants à se projeter.</p></div></div>`
      : html`<div class="panel">${prochaine || ouverte ? html`<p>Elle s’adresse aux diplômés : une première fois 6 mois après le diplôme (de janvier à juin), puis 12 mois après (de juillet à mars). Tu recevras un email le moment venu.</p>
        ${!ouverte && prochaine ? html`<p class="small muted">La prochaine s’ouvre en ${moisAn(prochaine)}.</p>` : null}`
        : html`<p>L’enquête suit chaque promo 6 mois puis 12 mois après le diplôme : pour ta promo, ces deux étapes sont passées. Garder ton profil à jour (entreprise, poste, ville) aide tout autant les étudiants.</p>`}</div>`}
    ${mine.length ? html`<div class="panel"><div class="section-head"><h2>Mes réponses</h2></div>
      ${mine.map(e => html`<div class="enq-answer" key=${e.id}>
        <p class="eyebrow">Réponse à ${e.vague} mois</p>
        <dl class="enq-mine">
          <dt>Ta situation</dt><dd>${SITUATIONS[e.situation] || e.situation}</dd>
          ${e.entreprise ? html`<dt>${e.situation === 'etudes' ? 'Poursuite d’études' : 'Entreprise'}</dt><dd translate="no" dir="auto">${e.entreprise}</dd>` : null}
          ${e.ville || e.pays ? html`<dt>Lieu</dt><dd translate="no" dir="auto">${[e.ville, e.pays].filter(Boolean).join(', ')}</dd>` : null}
          ${e.satisfaction ? html`<dt>Satisfaction</dt><dd>${SATIS[e.satisfaction - 1]}</dd>` : null}
        </dl>
        <div class="row-end"><button class="btn small ghost" onClick=${() => setEdit(e)}><${Icon} name="edit" size=${15}/> Modifier ma réponse</button></div>
      </div>`)}</div>` : null}
    <${ResultatsPromo} ctx=${ctx} promo=${me.promo}/>
    <div class="row-end"><button class="btn ghost" onClick=${() => go('accueil')}>Retour à l’accueil</button><button class="btn primary" onClick=${() => go('suivi/insertion')}><${Icon} name="chart" size=${16}/> Voir l’insertion de toutes les promos</button></div>
  </section>`;
}

function Note({ id, value, onChange, labels, label }) {
  return html`<div class="field"><span class="field-label">${label}</span><div class="enq-rate">
    <span class="stars" role="group" aria-label=${label} id=${id}>${[1, 2, 3, 4, 5].map(v => html`<button type="button" class=${v <= (value || 0) ? 'on' : ''} aria-label=${labels[v - 1]} title=${labels[v - 1]} onClick=${() => onChange(v === value ? null : v)}>★</button>`)}</span>
    ${value ? html`<span class="lbl">${labels[value - 1]}</span>` : null}</div></div>`;
}

function EnqueteForm({ ctx, vague, initial, onDone, onCancel }) {
  const { store, me, act } = ctx;
  const [f, setF] = useState(() => ({
    situation: '', contrat: '', secteur: SECTEURS.includes(me.secteur) ? me.secteur : '', entreprise: me.entreprise || '', pays: me.pays || 'Maroc', ville: me.ville || '',
    delai_mois: '', salaire: '', lien_formation: null, satisfaction: null, canal: '', commentaire: '',
    ...(initial ? Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v ?? (['lien_formation', 'satisfaction'].includes(k) ? null : '')])) : {}),
  }));
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const [maj, setMaj] = useState(true);
  const [poste, setPoste] = useState(me.poste || '');
  const [busy, setBusy] = useState(false);
  const enPoste = EN_POSTE.has(f.situation);
  const etudes = f.situation === 'etudes';
  const proposeMaj = enPoste && !!f.entreprise.trim() && f.entreprise.trim() !== (me.entreprise || '');

  const submit = e => {
    e.preventDefault();
    if (!f.situation) { toast('Choisis ta situation pour continuer.', 'err'); return; }
    const txt = (v, n) => (String(v ?? '').trim().slice(0, n) || null);
    const row = {
      situation: f.situation,
      contrat: enPoste ? f.contrat || null : null,
      secteur: enPoste ? f.secteur || null : null,
      entreprise: enPoste || etudes ? txt(f.entreprise, 80) : null,
      pays: enPoste || etudes ? txt(f.pays, 60) : null,
      ville: enPoste || etudes ? txt(f.ville, 60) : null,
      delai_mois: enPoste && f.delai_mois !== '' && f.delai_mois != null ? +f.delai_mois : null,
      salaire: enPoste ? f.salaire || null : null,
      lien_formation: enPoste ? f.lien_formation || null : null,
      satisfaction: f.satisfaction || null,
      canal: enPoste ? f.canal || null : null,
      commentaire: txt(f.commentaire, 600),
    };
    setBusy(true);
    let ok = false;
    act(async () => {
      if (initial) await store.update('enquetes_insertion', initial.id, row);
      else await store.insert('enquetes_insertion', { vague, promo: me.promo, filiere: me.filiere, ...row });
      ok = true;
      if (maj && proposeMaj) await store.update('profiles', me.id, { entreprise: row.entreprise, poste: txt(poste, 100) || me.poste || null, ville: row.ville, pays: row.pays || 'Maroc' });
      toast(initial ? 'Réponse mise à jour.' : 'Merci, ta réponse est enregistrée.');
    }).then(() => { setBusy(false); if (ok) onDone?.(); });
  };

  let n = 1;
  return html`<form class="form enq-form" onSubmit=${submit}>
    <div class="panel enq-step"><h2><span class="n">${n++}</span> Ta situation</h2>
      <div class="enq-sits" role="radiogroup" aria-label="Ta situation">${Object.entries(SITUATIONS).map(([k, l]) => html`<button type="button" role="radio" aria-checked=${f.situation === k} id=${'enq-sit-' + k} class=${'enq-sit' + (f.situation === k ? ' on' : '')} onClick=${() => set('situation', k)}>
        <span class="need-ico"><${Icon} name=${SIT_ICON[k]} size=${21}/></span><span>${l}</span></button>`)}</div>
    </div>

    ${enPoste ? html`<div class="panel enq-step"><h2><span class="n">${n++}</span> Ton poste</h2>
      <div class="field"><span class="field-label">Type de contrat</span><div class="chips">${Object.entries(CONTRATS).map(([k, l]) => html`<button type="button" class=${'chip' + (f.contrat === k ? ' on' : '')} aria-pressed=${f.contrat === k} onClick=${() => set('contrat', f.contrat === k ? '' : k)}>${l}</button>`)}</div></div>
      <div class="grid2">
        <${Field} label="Entreprise"><input id="enq-ent" dir="auto" maxlength="80" value=${f.entreprise} onInput=${e => set('entreprise', e.target.value)}/><//>
        <${Field} label="Secteur"><select id="enq-sect" value=${f.secteur} onChange=${e => set('secteur', e.target.value)}><option value="">—</option>${SECTEURS.map(x => html`<option value=${x}>${x}</option>`)}</select><//>
      </div>
      <div class="grid2">
        <${Field} label="Ville"><input id="enq-ville" dir="auto" maxlength="60" value=${f.ville} onInput=${e => set('ville', e.target.value)}/><//>
        <${Field} label="Pays"><input id="enq-pays" dir="auto" maxlength="60" value=${f.pays} onInput=${e => set('pays', e.target.value)}/><//>
      </div>
      <div class="grid2">
        <${Field} label="Combien de mois après le diplôme as-tu commencé ?"><select id="enq-delai" value=${f.delai_mois} onChange=${e => set('delai_mois', e.target.value)}><option value="">—</option>${DELAIS.map(d => html`<option value=${d}>${d === 0 ? 'Dès le diplôme (ou avant)' : `${d} mois`}</option>`)}</select><//>
        <${Field} label="Salaire net mensuel (facultatif)"><select id="enq-sal" value=${f.salaire} onChange=${e => set('salaire', e.target.value)}><option value="">—</option>${Object.entries(SALAIRES).map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select><//>
      </div>
      <div class="field"><span class="field-label">Comment as-tu trouvé ?</span><div class="chips">${Object.entries(CANAUX).map(([k, l]) => html`<button type="button" class=${'chip' + (f.canal === k ? ' on' : '')} aria-pressed=${f.canal === k} onClick=${() => set('canal', f.canal === k ? '' : k)}>${l}</button>`)}</div></div>
      <${Note} id="enq-lien" label="Ton poste correspond-il à ta formation ?" labels=${LIEN} value=${f.lien_formation} onChange=${v => set('lien_formation', v)}/>
      ${proposeMaj ? html`<label class="check"><input id="enq-maj" type="checkbox" checked=${maj} onChange=${e => setMaj(e.target.checked)}/> Mettre aussi à jour mon profil (entreprise, poste, ville, pays)</label>
        ${maj ? html`<${Field} label="Poste (pour ton profil)"><input id="enq-poste" dir="auto" maxlength="100" value=${poste} onInput=${e => setPoste(e.target.value)}/><//>` : null}` : null}
    </div>` : null}

    ${etudes ? html`<div class="panel enq-step"><h2><span class="n">${n++}</span> Poursuite d’études</h2>
      <${Field} label="Établissement, master, doctorat…"><input id="enq-etab" dir="auto" maxlength="80" value=${f.entreprise} onInput=${e => set('entreprise', e.target.value)}/><//>
      <div class="grid2">
        <${Field} label="Ville"><input id="enq-ville" dir="auto" maxlength="60" value=${f.ville} onInput=${e => set('ville', e.target.value)}/><//>
        <${Field} label="Pays"><input id="enq-pays" dir="auto" maxlength="60" value=${f.pays} onInput=${e => set('pays', e.target.value)}/><//>
      </div>
    </div>` : null}

    ${f.situation ? html`<div class="panel enq-step"><h2><span class="n">${n++}</span> Ton avis</h2>
      <${Note} id="enq-satis" label="Es-tu satisfait(e) de ta formation à l’ENSAM ?" labels=${SATIS} value=${f.satisfaction} onChange=${v => set('satisfaction', v)}/>
      <${Field} label="Un mot pour l’école (facultatif)" hint="Seule l’administration le lit."><textarea id="enq-com" dir="auto" rows="3" maxlength="600" value=${f.commentaire} onInput=${e => set('commentaire', e.target.value)}></textarea><//>
    </div>` : null}

    <div class="row-end">${onCancel ? html`<button type="button" class="btn ghost" onClick=${onCancel}>Annuler</button>` : null}
      <button id="enq-send" class="btn primary" disabled=${busy || !f.situation}>${initial ? 'Enregistrer' : 'Envoyer ma réponse'}</button></div>
  </form>`;
}

// Résultats agrégés de ma promo (après avoir répondu)
function ResultatsPromo({ ctx, promo }) {
  const { store, data } = ctx;
  const stats = useStatsInsertion(store, data.enquetes_insertion);
  if (!stats) return null;
  const ok = stats.filter(x => x.n >= 5).sort((a, b) => b.promo - a.promo || b.vague - a.vague);
  const r = ok.find(x => x.promo === promo) || (vaguesDe(promo).some(([, d]) => d > Date.now()) ? null : ok[0]);
  return html`<div class="panel"><div class="section-head"><h2 class="h-ico"><${Icon} name="chart"/> Ce que disent les promos</h2>${r ? html`<span class="muted small">Promo ${r.promo} · ${r.vague} mois après le diplôme</span>` : null}</div>
    ${r ? html`<${KpisInsertion} r=${r}/>` : html`<p class="muted">Les résultats de ta promo s’affichent dès 5 réponses, pour protéger l’anonymat.</p>`}
  </div>`;
}

// Quatre chiffres clés d'une ligne agrégée (partagés avec le tableau de bord)
export const virgule = v => (v == null ? '—' : String(v).replace('.', ','));
export function KpisInsertion({ r }) {
  const t = tauxInsertion(r);
  return html`<div class="kpis ins-kpis">
    <div class="kpi"><span class="kpi-label">Taux d’insertion</span><span class="kpi-val mono">${t == null ? '—' : pct(t)}</span><span class="small muted">${r.en_poste} en poste sur ${r.n - r.etudes}</span><${Bar} value=${t || 0}/></div>
    <div class="kpi"><span class="kpi-label">À l’étranger</span><span class="kpi-val mono">${r.en_poste ? pct(r.etranger / r.en_poste) : '—'}</span><span class="small muted">des diplômés en poste</span></div>
    <div class="kpi"><span class="kpi-label">Premier emploi</span><span class="kpi-val mono">${r.delai_median == null ? '—' : `${virgule(r.delai_median)} mois`}</span><span class="small muted">délai médian après le diplôme</span></div>
    <div class="kpi"><span class="kpi-label">Satisfaction</span><span class="kpi-val mono">${r.satisfaction == null ? '—' : `${virgule(r.satisfaction)} / 5`}</span><span class="small muted">formation reçue, sur 5</span></div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Carte d'accueil quand l'enquête est ouverte pour moi
// ---------------------------------------------------------------------------
export function EnqueteCard({ ctx }) {
  const { data, me, go } = ctx;
  const [off, setOff] = useLocal('enquete-off-' + (me?.id || ''), 0);
  const due = enqueteDue(me, data.enquetes_insertion || []);
  if (!due || (off && Date.now() - off < 7 * 864e5)) return null;
  return html`<div class="enq-card" role="region" aria-label="Enquête d’insertion">
    <span class="obj-ico brass"><${Icon} name="chart" size=${20}/></span>
    <div class="grow"><strong>Enquête ${due.vague} mois après le diplôme</strong><span class="small muted">2 minutes pour aider l’école et les promos suivantes.</span></div>
    <button class="btn primary small" id="enq-go" onClick=${() => go('enquete')}>Répondre</button>
    <button class="icon-btn small" aria-label="Masquer pour 7 jours" title="Masquer pour 7 jours" onClick=${() => setOff(Date.now())}><${Icon} name="x" size=${16}/></button>
  </div>`;
}
