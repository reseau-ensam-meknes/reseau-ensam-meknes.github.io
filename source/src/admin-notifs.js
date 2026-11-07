// Administration, Vue d'ensemble : le panneau « Santé des notifications », à part pour que la console de l'administration
// (route admin/notifs) le montre aussi. SanteNotifsAdmin({ ctx }) : ctx.store suffit (store.santeNotifs()).
import { html, useState, useEffect, useMemo, useRef } from './vendor/preact-htm.js';
import { Icon, Bar, injectCSS, Compteur, Anneau, Squelette } from './ui.js';
import { addAR, arCount } from './i18n.js';
import { pct, timeAgo } from './logic.js';
import { santeResume, raisonsNotifs, raisonsAvecPertes, dureeAttente, etatCronNotifs, TYPES_MAX_SN } from './sante-notifs.js';

// ---------------------------------------------------------------------------
// Santé des notifications : combien de membres les ont activées, ce que les services de notification acceptent et ce que
// les téléphones confirment afficher, ce qui se perd et pourquoi, en phrases simples. Des totaux seulement
// (admin_sante_notifs dans la base) : jamais un nom, une adresse ni un contenu. Lu à l'ouverture de la Vue d'ensemble et
// sur « Actualiser ». Base pas encore à jour : une phrase calme.
// ---------------------------------------------------------------------------
function useSanteNotifs(store) {
  const [n, setN] = useState(0);
  // fait : la lecture qui vient de finir (0 à l'ouverture, puis chaque « Actualiser » ou « Réessayer »)
  const [etat, setEtat] = useState({ charge: true, s: null, absent: false, err: null, fait: -1 });
  useEffect(() => {
    let on = true;
    setEtat(e => ({ ...e, charge: true }));
    Promise.resolve(store.santeNotifs ? store.santeNotifs() : null).then(
      s => on && setEtat({ charge: false, s, absent: !s, err: null, fait: n }),
      e => on && setEtat(x => ({ ...x, charge: false, err: e?.message || String(e), fait: n })));
    return () => { on = false; };
  }, [n]);
  // Pendant une lecture, un nouvel appui ne relance rien : le bouton reste là (aria-disabled) et garde le focus
  return [etat, () => { if (!etat.charge) setN(x => x + 1); }, n];
}
const ICONES_SN = { http: 'link', cron: 'clock', file: 'inbox', aucune_recue: 'phone', jetees: 'flag', trop_longues: 'flag', expirees: 'clock',
  refusees: 'block', abandonnees: 'clock', parties: 'phone', muets: 'phone', rien: 'check', vide: 'bell', sans_tel: 'phone', coupees: 'bell', echecs: 'send' };
const iconeSN = cle => ICONES_SN[cle] || (cle.startsWith('masse_') ? 'shield' : 'bell');
const ROLES_SN = { etudiant: 'Étudiants', laureat: 'Lauréats', admin: 'Administration' };
const accordSN = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const CRON_SN = { ok: 'Passage réussi', echec: 'Passage échoué', en_cours: 'En cours', inconnu: 'Passage terminé' };
function texteCronSN(c) {
  const e = etatCronNotifs(c);
  if (!e) return 'Illisible ici (pg_cron absent ou fermé à la lecture)';
  if (e === 'absente') return 'Absente de la base';
  if (e === 'jamais') return 'Pas encore lancée';
  return `${CRON_SN[e]} · ${timeAgo(c.at)}`;
}
function texteHttpSN(h) {
  if (!h) return 'Illisible ici (pg_net absent ou fermé à la lecture)';
  // pg_net ne garde ses réponses que 6 heures : une nuit calme ne veut pas dire « jamais appelée »
  if (h.vide) return 'Aucun appel ces 6 dernières heures (pg_net n’en garde pas plus)';
  const quoi = h.delai ? 'Délai dépassé' : h.erreur || !h.code ? 'Pas de réponse (réseau)' : `Réponse ${h.code}`;
  return h.at ? `${quoi} · ${timeAgo(h.at)}` : quoi;
}

function SanteNotifs({ store }) {
  const [etat, relire, n] = useSanteNotifs(store);
  const r = useMemo(() => santeResume(etat.s), [etat.s]);
  const raisons = useMemo(() => raisonsNotifs(r), [r]);
  const [detail, setDetail] = useState(false);
  const ref = useRef(null);
  // Une lecture demandée (Actualiser, Réessayer) vient de finir : c'est annoncé, et le focus ne se perd pas
  const fini = n > 0 && !etat.charge && etat.fait === n;
  useEffect(() => {
    if (!fini || typeof document === 'undefined') return;
    const a = document.activeElement;
    // « Réessayer » disparaît avec l'erreur : le focus passe à « Actualiser »
    if (!a || a === document.body) ref.current?.querySelector('.sn-relire, .sn-reessayer')?.focus();
  }, [fini, etat.fait]);
  const annonce = html`<span class="sr-only sn-annonce" aria-live="polite">${fini ? etat.err || 'Chiffres actualisés.' : ''}</span>`;
  const occupe = etat.charge ? 'true' : null;
  const tete = html`<div class="section-head"><h2 class="h-ico"><${Icon} name="bell"/> Santé des notifications</h2>
    ${r ? html`<button type="button" class="btn small ghost sn-relire" onClick=${relire} aria-disabled=${occupe}>${etat.charge ? 'Actualisation…' : 'Actualiser'}</button>` : null}</div>`;
  if (!r && etat.charge && !etat.err) return html`<div class="panel sn" id="adm-notifs" ref=${ref} aria-busy="true">${tete}${annonce}
    <div class="sn-attente"><${Squelette} hauteur=${64}/><${Squelette} hauteur=${150}/></div><span class="sr-only">Chargement…</span></div>`;
  if (!r && etat.absent && !etat.err) return html`<div class="panel sn" id="adm-notifs" ref=${ref}>${tete}${annonce}<p class="muted sn-absent">Ce panneau apparaît après la mise à jour du serveur.</p></div>`;
  if (!r) return html`<div class="panel sn" id="adm-notifs" ref=${ref}>${tete}${annonce}<p class="muted sn-erreur">${etat.err}</p>
    <button type="button" class="btn small tonal sn-reessayer" onClick=${relire} aria-disabled=${occupe}>Réessayer</button></div>`;
  const s = r.semaine, t = r.telephones, envoi = s.envoyees + s.perdues, p = r.part === null ? null : Math.round(r.part * 100);
  // Sous le chiffre : les pertes, puis ce qui n'a pas pu partir faute de téléphone (pas une perte : rien ne pouvait partir)
  const sous = !envoi && !s.sansTel ? 'Aucune notification cette semaine'
    : [envoi ? (s.perdues ? `${accordSN(s.perdues, 'perdue', 'perdues')} sur ${envoi}` : 'aucune perdue') : null,
      s.sansTel ? `${s.sansTel} ${s.sansTel > 1 ? 'n’ont' : 'n’a'} pas pu partir (membre sans téléphone)` : null].filter(Boolean).join(' · ');
  // Envoyée veut dire acceptée par le service de notification : ce que les téléphones confirment avoir affiché, à côté
  const affiche = !t.servis7j ? null : !t.recus7j ? 'Aucun téléphone n’a confirmé afficher une notification cette semaine.'
    : `${accordSN(Math.min(t.recus7j, t.servis7j), 'téléphone', 'téléphones')} sur ${t.servis7j} ${t.recus7j > 1 ? 'ont' : 'a'} affiché une notification cette semaine.`;
  return html`<div class="panel sn" id="adm-notifs" ref=${ref}>
    ${tete}${annonce}
    <div class="sn-haut">
      ${p === null ? null : html`<div class="sn-stat sn-portee">
        <${Anneau} valeur=${p} max=${100} taille=${64} epaisseur=${6} decoratif><b class="sn-pct" dir="ltr">${p}<small>%</small></b><//>
        <div class="sn-stat-txt"><strong class="sn-phrase">${`${pct(r.part)} des membres ont activé les notifications`}</strong>
          <span class="small muted">${`${accordSN(r.avecTel, 'membre', 'membres')} sur ${r.membres} ${r.avecTel > 1 ? 'ont' : 'a'} au moins un téléphone abonné.`}</span></div>
      </div>`}
      <div class="sn-stat sn-semaine">
        <span class="sn-grand"><${Compteur} v=${s.envoyees}/></span>
        <div class="sn-stat-txt"><strong class="sn-phrase">${s.envoyees > 1 ? 'notifications envoyées cette semaine' : 'notification envoyée cette semaine'}</strong>
          <span class="small muted sn-sous">${sous}</span>
          ${affiche ? html`<span class="small sn-affiche"><${Icon} name="phone" size=${16}/><span>${affiche}</span></span>` : null}</div>
      </div>
    </div>
    <${GrapheNotifs} r=${r}/>
    <div class="sn-raisons">
      <h3>${raisonsAvecPertes(raisons) ? 'Pourquoi certaines n’arrivent pas' : 'Cette semaine'}</h3>
      <ul>${raisons.map(x => html`<li key=${x.cle} class=${'sn-r t-' + x.ton} data-cle=${x.cle}><span class="sn-r-ico" aria-hidden="true"><${Icon} name=${iconeSN(x.cle)} size=${16}/></span><span>${x.texte}</span></li>`)}</ul>
    </div>
    ${etat.err ? html`<p class="small muted sn-erreur">${etat.err}</p>` : null}
    <details class="sn-detail" open=${detail} onToggle=${e => setDetail(e.currentTarget.open)}>
      <summary>${detail ? 'Masquer le détail' : 'Voir le détail'} <${Icon} name="chevron" size=${16}/></summary>
      ${detail ? html`<${DetailNotifs} r=${r}/>` : null}
    </details>
    <p class="small muted sn-pied">Des totaux sur 7 jours, sans aucun nom ni contenu.</p>
  </div>`;
}

// Une colonne par jour : les envoyées en bas, les perdues posées dessus (hachurées : elles se distinguent sans la couleur).
// Au survol ou au clavier, le jour en clair. Les mêmes chiffres sont dans le tableau « Par jour » du détail, avec ce qui
// n'a pas pu partir faute de téléphone (hors du graphique : ce n'est pas une perte).
function GrapheNotifs({ r }) {
  const vide = !r.jours.some(j => j.envoyees + j.perdues);
  const n = r.jours.length;
  return html`<figure class="sn-graphe">
    <figcaption class="sn-graphe-tete"><span class="sn-graphe-titre">Les 7 derniers jours</span>
      <span class="sn-legende" aria-hidden="true"><span class="sn-cle"><i class="sn-pastille"></i>Envoyées</span><span class="sn-cle"><i class="sn-pastille perdu"></i>Perdues</span></span></figcaption>
    ${vide ? html`<p class="small muted sn-vide">Aucune notification envoyée ces 7 derniers jours.</p>` : html`<div class="sn-plot">
      <span class="sn-echelle" aria-hidden="true">${r.max}</span>
      <div class="sn-cols">${r.jours.map((j, i) => {
        const tot = j.envoyees + j.perdues, bord = i < 2 ? ' debut' : i >= n - 2 ? ' fin' : '';
        const dit = `${accordSN(j.envoyees, 'envoyée', 'envoyées')} · ${accordSN(j.perdues, 'perdue', 'perdues')}`;
        return html`<div key=${j.jour} class=${'sn-col' + bord} tabindex="0" role="img" aria-label=${`${j.long} : ${accordSN(j.envoyees, 'envoyée', 'envoyées')}, ${accordSN(j.perdues, 'perdue', 'perdues')}`}>
          <span class="sn-pile" style=${`block-size:${(tot / r.max) * 100}%`}>
            ${j.perdues ? html`<span class="sn-seg perdu" style=${`flex-grow:${j.perdues}`}></span>` : null}${j.envoyees ? html`<span class="sn-seg" style=${`flex-grow:${j.envoyees}`}></span>` : null}
          </span>
          <span class="sn-bulle" aria-hidden="true"><b>${j.long}</b><span>${dit}</span></span>
        </div>`;
      })}</div>
    </div>
    <div class="sn-jours" aria-hidden="true">${r.jours.map(j => html`<span key=${j.jour}>${j.court}</span>`)}</div>`}
  </figure>`;
}

// « Sans tél. » à l'écran, « Sans téléphone » pour un lecteur d'écran (créé à chaque rendu : la traduction se fait alors)
const sansTelSN = () => html`<th scope="col"><span aria-hidden="true">Sans tél.</span><span class="sr-only">Sans téléphone</span></th>`;
function DetailNotifs({ r }) {
  const t = r.telephones;
  const tel = [['Téléphones abonnés', t.total], ['Visés par un envoi en 7 jours', t.servis7j], ['Ont affiché une notification en 24 h', t.recus24h],
    ['Ont affiché une notification en 7 jours', t.recus7j], ['Sans confirmation', t.muets], ['En refus', t.enRefus], ['Retirés cette semaine', t.retires7j]];
  const fonct = [
    ['File d’attente', r.file.n ? `${r.file.n} en attente · la plus ancienne depuis ${dureeAttente(r.file.ageS)}` : 'Vide : tout est parti'],
    ['Tâche de chaque minute, dernier passage', texteCronSN(r.cron)],
    ['Fonction notifier, dernier appel', texteHttpSN(r.http)],
    ['Dernière notification traitée', r.envoiAt ? timeAgo(r.envoiAt) : 'Aucune ces 7 derniers jours'],
  ];
  return html`<div class="sn-detail-corps">
    <section class="sn-bloc"><h3>Par rôle</h3>
      <ul class="sn-roles">${r.roles.map(x => html`<li key=${x.role}><span class="sn-roles-l">${ROLES_SN[x.role] || x.role}</span><${Bar} value=${x.part || 0}/>
        <span class="small"><b>${x.part === null ? '–' : pct(x.part)}</b></span><span class="small muted">${`${x.avecTel} sur ${x.membres}`}</span></li>`)}</ul></section>
    <section class="sn-bloc"><h3>Téléphones</h3>
      <dl class="sn-chiffres">${tel.map(([k, v]) => html`<div key=${k}><dt>${k}</dt><dd>${v}</dd></div>`)}</dl></section>
    ${r.services.length ? html`<section class="sn-bloc sn-services"><h3>Services de notification</h3>
      <table class="sn-table"><thead><tr><th scope="col">Service</th><th scope="col">Téléphones</th><th scope="col">Acceptent</th><th scope="col">Refusent</th></tr></thead>
        <tbody>${r.services.map(x => html`<tr key=${x.cle} data-cle=${x.cle}><th scope="row">${x.nom}</th><td>${x.n}</td><td>${x.ok}</td><td>${x.refus}</td></tr>`)}</tbody></table>
      <p class="small muted sn-note">Acceptent, refusent : d’après la dernière réponse de chaque téléphone ces 7 derniers jours.</p></section>` : null}
    <section class="sn-bloc"><h3>Par jour</h3>
      <table class="sn-table"><thead><tr><th scope="col">Jour</th><th scope="col">Envoyées</th><th scope="col">Perdues</th>${sansTelSN()}<th scope="col">Coupées</th></tr></thead>
        <tbody>${r.jours.map(j => html`<tr key=${j.jour}><th scope="row">${j.long}</th><td>${j.envoyees}</td><td>${j.perdues}</td><td>${j.sansTel}</td><td>${j.coupees}</td></tr>`)}</tbody></table></section>
    ${r.types.length ? html`<section class="sn-bloc sn-types"><h3>${r.typesPlein ? `Par type (les ${TYPES_MAX_SN} plus fréquents)` : 'Par type'}</h3>
      <table class="sn-table"><thead><tr><th scope="col">Type</th><th scope="col">Envoyées</th><th scope="col">Perdues</th>${sansTelSN()}<th scope="col">Coupées</th></tr></thead>
        <tbody>${r.types.map(x => html`<tr key=${x.kind}><th scope="row">${x.nom}${x.connu ? null : html` <span class="small muted" translate="no">${x.kind}</span>`}</th><td>${x.envoyees}</td><td>${x.perdues}</td><td>${x.sansTel}</td><td>${x.coupees}</td></tr>`)}</tbody></table></section>` : null}
    <section class="sn-bloc"><h3>Fonctionnement</h3>
      <dl class="sn-fonct">${fonct.map(([k, v]) => html`<div key=${k}><dt>${k}</dt><dd>${v}</dd></div>`)}</dl></section>
  </div>`;
}

// Arabe : les nombres s'accordent (1, 2, 3 à 10, 11 et plus) ; au génitif après « إرسال », « منذ »… ; à l'accusatif en complément
const NOTIFS_N = ['إشعار واحد', 'إشعاران', 'إشعارات', 'إشعارًا'], NOTIFS_G = ['إشعار واحد', 'إشعارين', 'إشعارات', 'إشعارًا'];
const NOTIFS_A = ['إشعارًا واحدًا', 'إشعارين', 'إشعارات', 'إشعارًا']; // complément d'objet
const TELS_N = ['هاتف واحد', 'هاتفان', 'هواتف', 'هاتفًا'], TELS_G = ['هاتف واحد', 'هاتفين', 'هواتف', 'هاتفًا'], MEMBRES_SN = ['عضو واحد', 'عضوان', 'أعضاء', 'عضوًا'];
const ENVOIS_N = ['محاولة إرسال واحدة', 'محاولتا إرسال', 'محاولات إرسال', 'محاولة إرسال'];
const ENVOIS_A = ['عملية إرسال واحدة', 'عمليتي إرسال', 'عمليات إرسال', 'عملية إرسال'];
const DUREES_G = { min: ['دقيقة واحدة', 'دقيقتين', 'دقائق', 'دقيقة'], h: ['ساعة واحدة', 'ساعتين', 'ساعات', 'ساعة'], jours: ['يوم واحد', 'يومين', 'أيام', 'يومًا'] };
const depuisAR = (n, u) => `منذ ${arCount(n, DUREES_G[u] || DUREES_G.min)}`;
const TACHE_AR = 'المهمة الدورية (كل دقيقة)';
// Les services de notification (SERVICES_PUSH), isolés dans la phrase arabe pour que leurs parenthèses restent en place
const SERVICES_AR = { 'Chrome et Android (Google)': 'Chrome وAndroid (Google)', 'iPhone et Mac (Apple)': 'iPhone وMac (Apple)', 'Firefox (Mozilla)': 'Firefox (Mozilla)',
  'Edge (Windows)': 'Edge (Windows)', 'Autre service': 'خدمة أخرى' };
const serviceAR = nom => `⁨${SERVICES_AR[nom] || nom}⁩`;
addAR({
  'Santé des notifications': 'صحة الإشعارات', 'Actualiser': 'تحديث', 'Actualisation…': 'جارٍ التحديث…', 'Chiffres actualisés.': 'تم تحديث الأرقام.',
  'Ce panneau apparaît après la mise à jour du serveur.': 'تظهر هذه اللوحة بعد تحديث الخادم.',
  'notifications envoyées cette semaine': 'إشعارات أُرسلت هذا الأسبوع', 'notification envoyée cette semaine': 'إشعار أُرسل هذا الأسبوع',
  'aucune perdue': 'لم يضع أي إشعار', 'Aucune notification cette semaine': 'لا إشعارات هذا الأسبوع',
  'Aucun téléphone n’a confirmé afficher une notification cette semaine.': 'لم يؤكّد أي هاتف عرض إشعار هذا الأسبوع.',
  'Les 7 derniers jours': 'آخر 7 أيام', 'Envoyées': 'المُرسَلة', 'Perdues': 'الضائعة', 'Coupées': 'الموقوفة', 'Sans tél.': 'دون هاتف', 'Sans téléphone': 'دون هاتف',
  'Aucune notification envoyée ces 7 derniers jours.': 'لم يُرسَل أي إشعار خلال آخر 7 أيام.',
  'Pourquoi certaines n’arrivent pas': 'لماذا لا تصل بعض الإشعارات',
  'Des totaux sur 7 jours, sans aucun nom ni contenu.': 'مجاميع على مدى 7 أيام، دون أي اسم أو محتوى.',
  // Pourquoi (raisonsNotifs)
  'La fonction notifier refuse les appels de la base (erreur 401) : désactive « Verify JWT » dans Supabase (Edge Functions > notifier > Details).': 'ترفض دالة notifier طلبات قاعدة البيانات (الخطأ 401): عطّل «Verify JWT» في Supabase (Edge Functions > notifier > Details).',
  'La fonction notifier est introuvable (erreur 404) : déploie-la dans Supabase (Edge Functions).': 'دالة notifier غير موجودة (الخطأ 404): انشرها في Supabase (Edge Functions).',
  'Le dernier appel à la fonction notifier n’a pas abouti (délai dépassé ou réseau) : la base réessaie toute seule chaque minute.': 'لم يكتمل آخر طلب لدالة notifier (انتهت المهلة أو مشكلة في الشبكة): تعيد قاعدة البيانات المحاولة تلقائيًا كل دقيقة.',
  'La tâche de chaque minute n’existe pas dans la base : active pg_cron (Database > Extensions), puis relance supabase/mise-a-jour.sql.': `${TACHE_AR} غير موجودة في قاعدة البيانات: فعّل pg_cron (Database > Extensions)، ثم أعد تشغيل supabase/mise-a-jour.sql.`,
  'La tâche de chaque minute a échoué à son dernier passage : regarde Logs > Postgres dans Supabase.': `فشلت ${TACHE_AR} في آخر تشغيل لها: راجع Logs > Postgres في Supabase.`,
  'La tâche de chaque minute n’a encore jamais tourné : vérifie pg_cron dans Supabase (Database > Cron).': `لم تشتغل ${TACHE_AR} بعد: تحقّق من pg_cron في Supabase (Database > Cron).`,
  'Aucune notification envoyée ne s’est perdue cette semaine.': 'لم يضع أي إشعار مُرسَل هذا الأسبوع.', 'Aucune notification n’est partie cette semaine.': 'لم يُرسَل أي إشعار هذا الأسبوع.',
  // Détail
  'Par rôle': 'حسب الدور', 'Téléphones': 'الهواتف', 'Téléphones abonnés': 'الهواتف المسجَّلة', 'Visés par un envoi en 7 jours': 'استُهدفت بإرسال خلال 7 أيام',
  'Ont affiché une notification en 24 h': 'عرضت إشعارًا خلال 24 ساعة', 'Ont affiché une notification en 7 jours': 'عرضت إشعارًا خلال 7 أيام',
  'Sans confirmation': 'دون تأكيد', 'En refus': 'في حالة رفض', 'Retirés cette semaine': 'أُزيلت هذا الأسبوع',
  'Services de notification': 'خدمات الإشعارات', 'Service': 'الخدمة', 'Acceptent': 'تقبل', 'Refusent': 'ترفض',
  'Acceptent, refusent : d’après la dernière réponse de chaque téléphone ces 7 derniers jours.': 'تقبل، ترفض: حسب آخر رد لكل هاتف خلال آخر 7 أيام.',
  ...SERVICES_AR,
  'Par jour': 'حسب اليوم', 'Par type': 'حسب النوع', [`Par type (les ${TYPES_MAX_SN} plus fréquents)`]: `حسب النوع (الأنواع الـ${TYPES_MAX_SN} الأكثر تكرارًا)`, 'Fonctionnement': 'طريقة العمل',
  'File d’attente': 'قائمة الانتظار', 'Vide : tout est parti': 'فارغة: أُرسل كل شيء',
  'Tâche de chaque minute, dernier passage': `${TACHE_AR}، آخر تشغيل`, 'Illisible ici (pg_cron absent ou fermé à la lecture)': 'غير مقروءة هنا (pg_cron غير موجود أو مغلق أمام القراءة)',
  'Absente de la base': 'غير موجودة في قاعدة البيانات', 'Pas encore lancée': 'لم تشتغل بعد',
  'Passage réussi': 'تشغيل ناجح', 'Passage échoué': 'تشغيل فاشل', 'Passage terminé': 'تشغيل منتهٍ',
  'Fonction notifier, dernier appel': 'دالة notifier، آخر طلب', 'Illisible ici (pg_net absent ou fermé à la lecture)': 'غير مقروء هنا (pg_net غير موجود أو مغلق أمام القراءة)',
  'Aucun appel ces 6 dernières heures (pg_net n’en garde pas plus)': 'لا طلبات خلال آخر 6 ساعات (لا يحتفظ pg_net بأكثر من ذلك)',
  'Délai dépassé': 'انتهت المهلة', 'Pas de réponse (réseau)': 'لا رد (الشبكة)',
  'Dernière notification traitée': 'آخر إشعار تمت معالجته', 'Aucune ces 7 derniers jours': 'لا شيء خلال آخر 7 أيام',
  // Les types de notification (NOMS_NOTIF) et leurs catégories
  'Réponse à un entretien': 'رد على مقابلة', 'Rappel d’entretien': 'تذكير بمقابلة',
  'Intérêt reçu': 'اهتمام وارد', 'Match du jour': 'توافق اليوم', 'Demande ouverte à tous': 'طلب مفتوح للجميع', 'Proposition d’aide': 'اقتراح مساعدة',
  'Aide acceptée': 'مساعدة مقبولة', 'Demande rouverte': 'طلب أُعيد فتحه', 'Suite d’une candidature': 'مستجدّ ترشيح',
  'Invitation à postuler': 'دعوة للترشح', 'Recrutement à confirmer': 'توظيف للتأكيد', 'Recrutement confirmé': 'توظيف مؤكد', 'Relance d’une offre': 'تذكير بعرض',
  'Demande de mentorat': 'طلب إرشاد', 'Mentorat ouvert à tous': 'إرشاد مفتوح للجميع', 'Mentorat déplacé': 'إرشاد بموعد جديد',
  'Mentorat annulé': 'إرشاد ملغى', 'Rappel de rendez-vous': 'تذكير بموعد', 'Merci reçu': 'شكر وارد',
  'Relecture de CV demandée': 'طلب مراجعة سيرة ذاتية', 'Relecture de CV prise': 'مراجعة سيرة ذاتية قيد الإنجاز', 'Relecture de CV rendue': 'مراجعة سيرة ذاتية منجزة',
  'Coordonnées demandées': 'طلب معلومات الاتصال', 'Coordonnées partagées': 'معلومات اتصال مشتركة', 'Nouveau filleul': 'طالب جديد في الرعاية', 'Nouveau parrain': 'عرّاب جديد',
  'Nouvelle offre': 'عرض جديد', 'Rappel du soir': 'تذكير المساء', 'Réponse à une question': 'جواب على سؤال', 'Question à toi': 'سؤال موجَّه إليك',
  'Événement annulé': 'حدث ملغى', 'Événement déplacé': 'حدث بموعد جديد',
  'Vérification par la promo': 'تحقق من طرف الدفعة', 'Camarade à confirmer': 'زميل في انتظار التأكيد', 'Réaction': 'تفاعل', 'Nouveau de la promo': 'عضو جديد في الدفعة',
  'Commentaire sur une offre': 'تعليق على عرض', 'Annonce': 'إعلان', 'Signalement': 'تبليغ', 'Essai (Tester)': 'تجربة (زر «تجربة»)',
  'Rendez-vous demain': 'موعد غدًا', 'Entretien demain': 'مقابلة غدًا', 'Événement ou café demain': 'حدث أو مقهى غدًا', 'Après un rendez-vous': 'بعد موعد',
  'Présence confirmée': 'الحضور مؤكَّد', 'Intérêts en attente': 'اهتمامات في الانتظار', 'Offre qui ferme bientôt': 'عرض يُغلق قريبًا',
  'Demande toujours ouverte': 'طلب لا يزال مفتوحًا', 'Demande en pause': 'طلب متوقف مؤقتًا', 'Résumé de la semaine': 'ملخص الأسبوع', 'Réponse utile': 'جواب مفيد',
  'Bravo reçu': 'تهنئة واردة', 'Messages des groupes': 'رسائل المجموعات',
  'Candidatures': 'الترشيحات', 'Vie du réseau': 'حياة الشبكة', 'Rappels': 'التذكيرات',
}, [
  [/^(\d+)\s?% des membres ont activé les notifications$/, x => `${x}% من الأعضاء فعّلوا الإشعارات`],
  [/^(\d+) membres? sur (\d+) (?:a|ont) au moins un téléphone abonné\.$/, (a, b) => `${arCount(a, MEMBRES_SN)} من أصل ${b} ${+a === 1 ? 'لديه' : +a === 2 ? 'لديهما' : 'لديهم'} هاتف مسجَّل واحد على الأقل.`],
  [/^(\d+) perdues? sur (\d+)$/, (a, b) => `${a} ضائعة من أصل ${b}`],
  [/^(\d+) n’(?:a|ont) pas pu partir \(membre sans téléphone\)$/, n => `تعذّر إرسال ${arCount(n, NOTIFS_G)} (عضو دون هاتف)`],
  [/^(\d+) téléphones? sur (\d+) (?:a|ont) affiché une notification cette semaine\.$/,
    (a, b) => `${arCount(a, TELS_N)} من أصل ${b} ${+a === 1 ? 'عرض' : +a === 2 ? 'عرضا' : 'عرضت'} إشعارًا هذا الأسبوع.`],
  [/^(\d{1,2}) (\S+) : (\d+) envoyées?, (\d+) perdues?$/, (j, m, a, x) => `${j} ${m}: ${a} مُرسَلة، ${x} ضائعة`],
  [/^(\d+) envoyées? · (\d+) perdues?$/, (a, x) => `${a} مُرسَلة · ${x} ضائعة`],
  [/^La fonction notifier a répondu par une erreur au dernier appel \(erreur (\d+)\) : regarde ses Logs dans Supabase \(Edge Functions > notifier > Logs\)\.$/,
    c => `أجابت دالة notifier بخطأ في آخر طلب (الخطأ ${c}): راجع سجلاتها في Supabase (Edge Functions > notifier > Logs).`],
  [/^La tâche de chaque minute n’a pas tourné depuis (\d+) (min|h|jours) : vérifie pg_cron dans Supabase \(Database > Cron\)\.$/,
    (n, u) => `لم تشتغل ${TACHE_AR} ${depuisAR(n, u)}: تحقّق من pg_cron في Supabase (Database > Cron).`],
  [/^(\d+) notifications? attend(?:ent)? depuis (\d+) (min|h|jours) au lieu de partir tout de suite : la tâche de chaque minute ou la fonction notifier est bloquée \(voir Fonctionnement, dans le détail\)\.$/,
    (n, d, u) => `${arCount(n, NOTIFS_N)} في الانتظار ${depuisAR(d, u)} بدل الإرسال الفوري: ${TACHE_AR} أو دالة notifier متوقفة (انظر «طريقة العمل» في التفاصيل).`],
  [/^Le service « (.+) » refuse les notifications de (\d+) téléphones et n’en accepte aucun : la clé de la plateforme est en cause, pas les membres\. Regarde les Logs de la fonction notifier \(Edge Functions > notifier > Logs\)\.$/,
    (nom, n) => `ترفض خدمة «${serviceAR(nom)}» الإشعارات على ${arCount(n, TELS_G)} ولا تقبل أيًّا منها: المشكلة في مفتاح المنصة، لا في الأعضاء. راجع سجلات دالة notifier (Edge Functions > notifier > Logs).`],
  [/^Les services de notification ont accepté (\d+) envois? cette semaine, mais aucun téléphone ne confirme les avoir affichés : essaie « Tester » sur un vrai téléphone \(Mon profil > Notifications\)\.$/,
    n => `قبلت خدمات الإشعارات ${arCount(n, ENVOIS_A)} هذا الأسبوع، لكن لا يؤكّد أي هاتف عرضها: جرّب «تجربة» على هاتف حقيقي (ملفي الشخصي > الإشعارات).`],
  [/^(\d+) notifications? (?:a|ont) été écartées? par le serveur \(type inconnu\) : un défaut à signaler\.$/, n => `استبعد الخادم ${arCount(n, NOTIFS_A)} (نوع غير معروف): خلل يجب التبليغ عنه.`],
  [/^(\d+) notifications? (?:a|ont) été refusées? parce que trop longues? \(erreur 413\) : un défaut à signaler\.$/,
    n => `${+n === 1 ? 'رُفض إشعار واحد لأنه طويل جدًا' : +n === 2 ? 'رُفض إشعاران لأنهما طويلان جدًا' : `رُفضت ${arCount(n, NOTIFS_N)} لأنها طويلة جدًا`} (الخطأ 413): خلل يجب التبليغ عنه.`],
  [/^(\d+) notifications? (?:a|ont) expiré sans aucun essai d’envoi, après un jour d’attente : la fonction notifier ou la tâche de chaque minute ne tournait pas \(voir Fonctionnement, dans le détail\)\.$/,
    n => `انتهت صلاحية ${arCount(n, NOTIFS_G)} دون أي محاولة إرسال، بعد يوم من الانتظار: لم تكن دالة notifier أو ${TACHE_AR} تعمل (انظر «طريقة العمل» في التفاصيل).`],
  [/^(\d+) notifications? (?:a|ont) été refusées? par le service de notification du téléphone\. Après 3 refus de suite, le téléphone est retiré, sauf si tout ce service refuse \(la clé de la plateforme serait alors en cause\)\.$/,
    n => `رفضت خدمة إشعارات الهاتف ${arCount(n, NOTIFS_A)}. بعد 3 رفضات متتالية يُزال الهاتف، إلا إذا كانت الخدمة كلها ترفض (فتكون المشكلة حينها في مفتاح المنصة).`],
  [/^(\d+) notifications? (?:a|ont) été abandonnées? après 3 essais ou un jour d’attente : le service du téléphone ne répondait pas\.$/,
    n => `توقفت محاولة إرسال ${arCount(n, NOTIFS_G)} بعد 3 محاولات أو يوم من الانتظار: لم تكن خدمة الهاتف تستجيب.`],
  [/^(\d+) notifications? n’(?:a|ont) pas pu arriver : le téléphone n’était plus abonné \(application désinstallée, téléphone changé ou notifications retirées\)\. Son abonnement est retiré ; le membre devra réactiver les notifications\.$/,
    n => `تعذّر وصول ${arCount(n, NOTIFS_G)}: لم يعد الهاتف مسجَّلًا (تطبيق محذوف، أو هاتف جديد، أو إشعارات أُلغيت). يُزال تسجيله، وسيحتاج العضو إلى إعادة تفعيل الإشعارات.`],
  [/^(\d+) notifications? n’(?:a|ont) pas pu partir : le membre n’a activé les notifications sur aucun téléphone \(ses emails l’invitent à le faire\)\.$/,
    n => `تعذّر إرسال ${arCount(n, NOTIFS_G)}: لم يفعّل العضو الإشعارات على أي هاتف (رسائل البريد التي تصله تدعوه إلى ذلك).`],
  [/^(\d+) téléphones? accepte(?:nt)? les notifications sans confirmer les afficher : économie d’énergie, notifications du navigateur coupées, ou ancienne version de l’application\.$/,
    n => `${arCount(n, TELS_N)} ${+n === 1 ? 'يقبل' : +n === 2 ? 'يقبلان' : 'تقبل'} الإشعارات دون تأكيد عرضها: وضع توفير الطاقة، أو إشعارات المتصفح متوقفة، أو نسخة قديمة من التطبيق.`],
  [/^(\d+) notifications? n’(?:a|ont) pas été envoyées? : le membre a coupé ce type dans Mon profil\. C’est son choix\.$/,
    n => `لم يُرسَل ${arCount(n, NOTIFS_N)}: أوقف العضو هذا النوع في ملفه الشخصي. هذا اختياره.`],
  [/^(\d+) envois? (?:a|ont) échoué un moment \(service du téléphone injoignable\), puis (?:a|ont) été réessayés?\.$/,
    n => `فشلت ${arCount(n, ENVOIS_N)} مؤقتًا (خدمة الهاتف غير متاحة)، ثم أُعيدت المحاولة.`],
  [/^(\d+) en attente · la plus ancienne depuis (\d+) (min|h|jours)$/, (n, d, u) => `${n} في الانتظار · أقدمها ${depuisAR(d, u)}`],
  [/^Réponse (\d{3})$/, c => `الرد ${c}`],
]);

injectCSS('sante-notifs', `
/* Santé des notifications (Vue d'ensemble) : couleurs du graphique vérifiées (contraste, daltonisme), jour et nuit ;
   les perdues sont aussi hachurées, pour se lire sans la couleur (niveaux de gris, daltonisme) */
.sn { --sn-ok: #1670A8; --sn-perdu: #B0222E; --sn-hachure: color-mix(in srgb, var(--sn-perdu) 40%, var(--surface-2)); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .sn { --sn-ok: #3A93CF; --sn-perdu: #D9555F; } }
:root[data-theme="dark"] .sn { --sn-ok: #3A93CF; --sn-perdu: #D9555F; }
.sn .section-head { flex-wrap: nowrap; }
.sn .section-head h2 { min-width: 0; }
.sn-relire { flex: none; }
.sn-relire[aria-disabled="true"], .sn-reessayer[aria-disabled="true"] { cursor: progress; }
.sn-attente { display: flex; flex-direction: column; gap: .75rem; }
.sn-attente .squelette { padding: 0; }
.sn-absent, .sn-erreur { margin: 0; }
.sn-reessayer { align-self: flex-start; }
.sn-haut { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap: .9rem 1.4rem; }
.sn-stat { display: flex; align-items: center; gap: .85rem; min-width: 0; }
.sn-stat-txt { display: flex; flex-direction: column; gap: .15rem; min-width: 0; }
.sn-phrase { font: 650 var(--fs-4)/1.3 var(--f-display); color: var(--ink); }
.sn-pct { font: 750 var(--fs-4)/1 var(--f-display); }
.sn-pct small { font-size: .68em; font-weight: 650; }
.sn-grand { flex: none; min-inline-size: 64px; text-align: center; font: 750 2rem/1 var(--f-display); font-variant-numeric: tabular-nums; letter-spacing: -.01em; color: var(--ink); }
.sn-affiche { display: inline-flex; align-items: flex-start; gap: .3rem; margin-top: .15rem; color: var(--ink-2); }
.sn-affiche > .ico { flex: none; margin-top: .1em; color: var(--muted); }
/* Le graphique : la légende au-dessus, une colonne par jour (24 px au plus, coins ronds en haut, base droite) */
.sn-graphe { margin: 0; display: flex; flex-direction: column; gap: .45rem; padding: .8rem .9rem .55rem; border-radius: var(--r-md); background: var(--surface-2); }
.sn-graphe-tete { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .25rem .8rem; }
.sn-graphe-titre { font-weight: 600; font-size: var(--fs-2); color: var(--ink-2); }
.sn-legende { display: inline-flex; flex-wrap: wrap; gap: .2rem .8rem; font-size: var(--fs-2); color: var(--ink-2); }
.sn-cle { display: inline-flex; align-items: center; gap: .35rem; }
.sn-pastille { display: inline-block; inline-size: 12px; block-size: 12px; border-radius: 3px; background: var(--sn-ok); }
.sn-pastille.perdu, .sn-seg.perdu { background-color: var(--sn-perdu); background-image: repeating-linear-gradient(-45deg, transparent 0 3px, var(--sn-hachure) 3px 5px); }
.sn-plot { position: relative; block-size: 116px; border-block-end: 1px solid var(--line-strong); }
.sn-plot::before { content: ""; position: absolute; inset-inline: 1.6rem 0; inset-block-start: 1.1rem; border-block-start: 1px solid var(--line); }
.sn-echelle { position: absolute; inset-block-start: calc(1.1rem - .45em); inset-inline-start: 0; font-size: var(--fs-1); line-height: 1; color: var(--muted); font-variant-numeric: tabular-nums; }
.sn-cols, .sn-jours { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; margin-inline-start: 1.6rem; }
.sn-cols { position: absolute; inset: 1.1rem 0 0; }
.sn-col { position: relative; display: flex; align-items: flex-end; justify-content: center; min-width: 0; border-radius: var(--r-sm) var(--r-sm) 0 0; outline: none; cursor: default; }
.sn-col:hover { background: color-mix(in srgb, var(--ink) 5%, transparent); }
.sn-col:focus-visible { box-shadow: var(--anneau-focus); }
.sn-pile { display: flex; flex-direction: column; gap: 2px; inline-size: min(24px, 64%); min-block-size: 2px; }
.sn-seg { flex: 1 1 0; min-block-size: 2px; background: var(--sn-ok); }
.sn-pile > .sn-seg:first-child { border-start-start-radius: 4px; border-start-end-radius: 4px; }
.sn-jours { font-size: var(--fs-1); color: var(--muted); text-align: center; font-variant-numeric: tabular-nums; }
.sn-vide { margin: .2rem 0; }
/* L'infobulle : seulement au survol ou au clavier, jamais hors de l'écran (les colonnes du bord s'alignent sur le bord) */
.sn-bulle { display: none; position: absolute; z-index: 3; inset-block-end: calc(100% + 6px); left: 50%; transform: translateX(-50%);
  flex-direction: column; gap: .1rem; padding: .4rem .6rem; border-radius: var(--r-sm); background: var(--raised); box-shadow: var(--sh3);
  font-size: var(--fs-2); line-height: 1.35; color: var(--ink); white-space: nowrap; pointer-events: none; }
.sn-col.debut .sn-bulle { left: auto; right: auto; inset-inline-start: 0; transform: none; }
.sn-col.fin .sn-bulle { left: auto; right: auto; inset-inline-end: 0; transform: none; }
.sn-col:hover .sn-bulle, .sn-col:focus-visible .sn-bulle { display: flex; }
.sn-bulle b { font-weight: 650; }
/* Pourquoi : une phrase par cause, son icône teintée selon ce qu'elle demande (à régler, à surveiller, normal) */
.sn-raisons h3 { margin: 0 0 .4rem; font-size: var(--fs-3); }
.sn-raisons ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .55rem; }
.sn-r { display: flex; align-items: flex-start; gap: .6rem; font-size: var(--fs-3); line-height: 1.45; color: var(--ink); }
.sn-r > span:last-child { min-width: 0; overflow-wrap: anywhere; }
.sn-r-ico { flex: none; display: inline-grid; place-items: center; inline-size: 28px; block-size: 28px; border-radius: 9px; background: var(--surface-2); color: var(--muted); }
.sn-r.t-bad .sn-r-ico { background: var(--bad-soft); color: var(--bad); }
.sn-r.t-warn .sn-r-ico { background: var(--warn-soft); color: var(--warn); }
.sn-r.t-bien .sn-r-ico { background: var(--good-soft); color: var(--good); }
/* Ce qui n'est pas une perte (catégorie coupée par le membre, envoi réessayé) : plus discret */
.sn-r.t-note { font-size: var(--fs-2); color: var(--ink-2); }
.sn-r.t-note .sn-r-ico { inline-size: 24px; block-size: 24px; border-radius: 8px; margin-inline: 2px; background: transparent; }
/* Le détail, replié */
.sn-detail { border-top: 1px solid var(--line); padding-top: .2rem; }
.sn-detail > summary { display: inline-flex; align-items: center; gap: .35rem; min-height: 44px; padding: .3rem .1rem; cursor: pointer; list-style: none; font-weight: 600; color: var(--tonal-ink); }
.sn-detail > summary::-webkit-details-marker { display: none; }
.sn-detail > summary .ico { transition: transform .2s var(--ease); }
.sn-detail[open] > summary .ico { transform: rotate(180deg); }
@media (prefers-reduced-motion: reduce) { .sn-detail > summary .ico { transition: none; } }
.sn-detail-corps { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 1.1rem 1.6rem; padding: .4rem 0 .3rem; }
.sn-bloc { display: flex; flex-direction: column; gap: .45rem; min-width: 0; }
.sn-bloc h3 { margin: 0; font-size: var(--fs-3); }
.sn-roles { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: auto minmax(50px, 1fr) auto auto; gap: .45rem .7rem; align-items: center; }
.sn-roles li { display: contents; }
.sn-roles-l { font-weight: 600; font-size: var(--fs-2); }
.sn-chiffres, .sn-fonct { margin: 0; display: flex; flex-direction: column; }
.sn-chiffres > div, .sn-fonct > div { display: flex; justify-content: space-between; align-items: baseline; gap: .8rem; padding: .35rem 0; border-bottom: 1px solid var(--line); }
.sn-chiffres dt, .sn-fonct dt { font-size: var(--fs-2); color: var(--ink-2); min-width: 0; }
.sn-chiffres dd { margin: 0; font-weight: 650; font-variant-numeric: tabular-nums; }
.sn-fonct > div { flex-direction: column; align-items: stretch; gap: .1rem; }
.sn-fonct dd { margin: 0; font-size: var(--fs-3); }
.sn-note { margin: 0; }
/* Les tableaux : cinq colonnes tiennent à 360 px (les en-têtes passent à la ligne, les nombres jamais) */
.sn-table { inline-size: 100%; border-collapse: collapse; font-size: var(--fs-2); }
.sn-table th, .sn-table td { padding: .32rem .3rem; border-bottom: 1px solid var(--line); text-align: end; }
.sn-table thead th { color: var(--muted); font-weight: 600; vertical-align: bottom; line-height: 1.25; }
.sn-table th[scope="row"], .sn-table thead th:first-child { text-align: start; font-weight: 500; color: var(--ink); overflow-wrap: anywhere; padding-inline-start: 0; }
.sn-table thead th:first-child { color: var(--muted); font-weight: 600; }
.sn-table td { font-variant-numeric: tabular-nums; white-space: nowrap; }
.sn-table td:last-child, .sn-table th:last-child { padding-inline-end: 0; }
.sn-pied { margin: 0; }
`);

// Le panneau tel que l'administration le montre (Vue d'ensemble, après « À traiter » ; console : admin/notifs)
export function SanteNotifsAdmin({ ctx }) {
  return html`<${SanteNotifs} store=${ctx.store}/>`;
}
