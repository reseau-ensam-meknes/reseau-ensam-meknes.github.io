// Administration > Animer le réseau. Chaque semaine, des messages prêts à coller dans les groupes WhatsApp des promos,
// en français ou en arabe : le résumé de la semaine (lauréats, ou une promo d'étudiants), le merci aux lauréats qui ont aidé
// (seulement ceux qui ont dit oui), les membres fondateurs, les Demandes des 3A à 5A, une offre à demander aux lauréats,
// le rendez-vous du mois et le rappel des limites de Gmail.
// Jamais de nom ni de contact d'étudiant ; des lauréats, le prénom seulement. Les textes sont faits dans admin-textes.js.
// CarteMessage (un texte, Copier, Partager sur WhatsApp) sert aussi aux rubriques Écoles, Partenaires et Outils.
import { html, useState, useEffect } from './vendor/preact-htm.js';
import { Icon, toast, injectCSS, lienWhatsApp } from './ui.js';
import { PersonneLigne, useVoirPlus, VoirPlus } from './lignes.js';
import { addAR, getLang } from './i18n.js';
import { ajouterIcones } from './entree.js';
import { avecLangue, avecEcole } from './regles-entree.js';
import { MessageBtn } from './messages.js';
import { OfferComposer } from './offers.js';
import { publierEvenement } from './agenda.js';
import { lienInvitation } from './invitation.js';
import { NIVEAUX, classementFondateurs, lignePlaces, ecoleDe, ecoleDesTextes } from './logic.js';
import { resumeSemaine, aidantsSemaine, texteMerci, messageAccordMerci, texteFondateurs, textePromoDemande, laureatsSansOffre, messageOffreBoite,
  OBJECTIF_OFFRES, rendezVousDuMois, semaineISO, ligneGestes, vueEcole } from './admin-textes.js';

ajouterIcones({
  'porte-voix': '<path d="M4 10v4h3l8 4.5v-13L7 10z"/><path d="M18 9.2a4 4 0 0 1 0 5.6"/>',
});

addAR({
  'Animer le réseau': 'تنشيط الشبكة',
  'Chaque semaine, des messages prêts à coller dans les groupes WhatsApp des promos. Jamais de nom d’étudiant ; des lauréats, le prénom seulement, et avec leur accord.': 'كل أسبوع، رسائل جاهزة للصق في مجموعات واتساب الخاصة بالدفعات. لا اسم لأي طالب أبدًا؛ ومن الخريجين، الاسم الشخصي فقط، وبموافقتهم.',
  'Cette semaine': 'هذا الأسبوع', 'Message à copier': 'رسالة للنسخ', 'Pour qui ?': 'لمن؟',
  'Résumé de la semaine': 'ملخص الأسبوع',
  'Les 7 derniers jours : nouveaux membres, offres, Demandes qui attendent, matchs et aides, puis l’agenda des 14 jours à venir. Pour une promo d’étudiants, seulement les offres de son année.': 'الأيام السبعة الأخيرة: الأعضاء الجدد، والعروض، والطلبات التي تنتظر، والتوافقات، والمساعدات، ثم مفكرة الأيام الأربعة عشر المقبلة. لدفعة من الطلبة، عروض سنتها فقط.',
  'Merci de la semaine': 'شكر الأسبوع',
  'Les lauréats qui ont aidé ces 7 derniers jours. Demande d’abord son accord à chacun, puis coche « D’accord » : seuls les prénoms cochés sont dans le message.': 'الخريجون الذين ساعدوا خلال الأيام السبعة الأخيرة. اطلب أولًا موافقة كل واحد منهم، ثم ضع علامة على «موافق»: الأسماء الشخصية المحددة فقط تظهر في الرسالة.',
  'D’accord': 'موافق', 'Demander son accord': 'طلب موافقته', 'Personne n’a encore aidé cette semaine.': 'لم يساعد أحد بعد هذا الأسبوع.',
  'Membres fondateurs': 'الأعضاء المؤسسون',
  'Pour donner envie aux lauréats : les prénoms des fondateurs qui acceptent d’être montrés, et les places qui restent.': 'لتشجيع الخريجين: الأسماء الشخصية للمؤسسين الذين يقبلون الظهور، والأماكن المتبقية.',
  'Publier sa Demande avec son CV': 'نشر الطلب مع السيرة الذاتية',
  'Un message par promo, et deux lignes pour dire pourquoi : les lauréats de la filière voient la Demande, et le CV leur dit tout de suite s’ils peuvent aider.': 'رسالة لكل دفعة، وسطران لشرح السبب: يرى خريجو الشعبة الطلب، والسيرة الذاتية تخبرهم فورًا إن كان بإمكانهم المساعدة.',
  'Une offre de ta boîte': 'عرض من شركتك',
  'Les lauréats qui ont une entreprise sur leur profil et n’ont encore publié aucune offre. Le message est prêt, dans leur langue.': 'الخريجون الذين ذكروا شركة في ملفهم ولم ينشروا أي عرض بعد. الرسالة جاهزة، بلغتهم.',
  'Aucun lauréat avec une entreprise et sans offre pour l’instant.': 'لا يوجد حاليًا خريج له شركة دون عرض.',
  'Publier une offre': 'نشر عرض', 'Écrire': 'مراسلة',
  'Rendez-vous du mois': 'موعد الشهر',
  'Un lauréat raconte son métier en 30 minutes, en ligne, puis répond aux questions. Le formulaire de l’agenda s’ouvre déjà rempli : choisis la date et ajoute le lien de la visio.': 'يحكي خريج عن مهنته في 30 دقيقة عبر الإنترنت، ثم يجيب عن الأسئلة. يُفتح نموذج المفكرة معبأً مسبقًا: اختر التاريخ وأضف رابط الاتصال المرئي.',
  'Préparer l’événement': 'تحضير الحدث',
  'Envois par Gmail': 'الإرسال عبر Gmail',
  'Gmail envoie 500 emails par jour au plus, et environ 100 par heure. Invite les promos petit à petit, une ou deux par jour : les liens et les messages sont dans « Inviter ».': 'يرسل Gmail خمسمئة رسالة في اليوم على الأكثر، وحوالي مئة في الساعة. ادعُ الدفعات شيئًا فشيئًا، دفعة أو دفعتين في اليوم: الروابط والرسائل موجودة في «دعوة».',
  'Ouvrir « Inviter »': 'فتح «دعوة»',
  'Copier': 'نسخ', 'Partager sur WhatsApp': 'مشاركة على واتساب', 'Langue du message': 'لغة الرسالة', 'Lauréats': 'الخريجون', 'Email': 'البريد الإلكتروني',
  'Message copié.': 'تم نسخ الرسالة.', 'Copie impossible ici : sélectionne le texte et copie-le.': 'النسخ غير ممكن هنا: حدّد النص وانسخه.',
}, [
  [/^Offres publiées par toi : (\d+) \/ (\d+)$/, (n, m) => `العروض التي نشرتها: ${n} من ${m}`],
  [/^(\d+) aides? proposées? sur (?:une|des) Demandes?$/, n => `مساعدات مقترحة على طلبات: ${n}`],
  [/^(\d+) mentorats?$/, n => `جلسات إرشاد: ${n}`],
  [/^(\d+) relectures? de CV$/, n => `مراجعات السيرة الذاتية: ${n}`],
  [/^(\d+) réponses? à (?:une question|des questions)$/, n => `أجوبة على أسئلة: ${n}`],
  [/^(\d+) offres? publiées?$/, n => `عروض منشورة: ${n}`],
  [/^(\d+) recrutements? confirmés?$/, n => `توظيفات مؤكدة: ${n}`],
]);

// ---------------------------------------------------------------------------
// Petits morceaux communs aux rubriques de la console
// ---------------------------------------------------------------------------
// L'adresse du site, dans la langue du message (?lang=ar ouvre le site en arabe) ; ecole : celle des messages de la console
// (ecoleDesTextes), dite dans le lien quand ce n'est pas l'ENSAM Meknès (&ecole=…)
export const lienSite = (langue = 'fr', ecole) => avecEcole(avecLangue(location.origin + location.pathname, langue), ecole);

export async function copier(texte, fait = 'Message copié.', zone = null) {
  try { await navigator.clipboard.writeText(texte); toast(fait); }
  catch { zone?.select?.(); toast('Copie impossible ici : sélectionne le texte et copie-le.', 'err'); }
}

// Français · العربية : chaque langue écrite dans la sienne
export function ChoixLangue({ value, onChange, id, label = 'Langue du message' }) {
  return html`<div class="seg small-seg" role="group" aria-label=${label} id=${id}>
    ${[['fr', 'Français'], ['ar', 'العربية']].map(([k, l]) => html`<button type="button" class=${value === k ? 'on' : ''} aria-pressed=${value === k} lang=${k} translate="no" onClick=${() => onChange(k)}>${l}</button>`)}
  </div>`;
}

// La zone du message prend la hauteur de son texte, longues lignes comprises : tout le message se lit avant de le copier,
// sans défiler dans la zone. Le CSS s'en charge (field-sizing: content) ; sinon (Firefox, anciens Safari), on la mesure
// quand le texte ou la largeur de la fenêtre change, sans faire sauter la page.
const HAUTEUR_CSS = typeof CSS !== 'undefined' && !!CSS.supports?.('field-sizing', 'content');
function useHauteurTexte(zone, txt) {
  useEffect(() => {
    if (!zone || HAUTEUR_CSS) return undefined;
    const ajuster = () => {
      const y = scrollY;
      zone.style.height = 'auto';
      zone.style.height = `${zone.scrollHeight + zone.offsetHeight - zone.clientHeight}px`;
      if (scrollY !== y) scrollTo(scrollX, y);
    };
    ajuster();
    addEventListener('resize', ajuster);
    return () => removeEventListener('resize', ajuster);
  }, [zone, txt]);
}

// Une carte de message : titre, une ligne qui dit à quoi il sert, des choix (children), le texte en lecture seule dans la
// langue choisie, puis « Copier » et « Partager sur WhatsApp ». email : { a, sujet } ajoute « Email » (mailto, sujet compris).
// textes : { fr, ar } ou une fonction de la langue ; actions : des boutons de plus, à la fin
export function CarteMessage({ id, titre, icone = 'send', aide, textes, children, email, actions }) {
  const [langue, setLangue] = useState(getLang() === 'ar' ? 'ar' : 'fr');
  const [zone, setZone] = useState(null);
  const t = typeof textes === 'function' ? textes(langue) : textes;
  const txt = (langue === 'ar' ? t?.ar : t?.fr) || '';
  useHauteurTexte(zone, txt);
  const sujet = email ? (typeof email.sujet === 'object' ? email.sujet?.[langue] : email.sujet) || '' : '';
  const mailto = email ? `mailto:${email.a || ''}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(txt)}` : null;
  return html`<section class="panel adm-carte" id=${id} aria-labelledby=${id + '-t'}>
    <div class="section-head"><h3 class="h-ico adm-carte-t" id=${id + '-t'}><${Icon} name=${icone}/> <span>${titre}</span></h3><${ChoixLangue} value=${langue} onChange=${setLangue} id=${id + '-langue'}/></div>
    ${aide ? html`<p class="small muted">${aide}</p>` : null}
    ${children}
    <textarea class="adm-msg" readonly ref=${setZone} rows=${Math.min(18, Math.max(4, txt.split('\n').length + 1))} dir=${langue === 'ar' ? 'rtl' : 'ltr'} lang=${langue} value=${txt} aria-label="Message à copier"></textarea>
    <div class="adm-msg-act">
      <button type="button" class="btn small tonal adm-copier" onClick=${() => copier(txt, 'Message copié.', zone)}><${Icon} name="copy" size=${15}/> Copier</button>
      <a class="btn small ghost adm-wa" href=${lienWhatsApp(txt)} target="_blank" rel="noopener"><${Icon} name="send" size=${15}/> Partager sur WhatsApp</a>
      ${mailto ? html`<a class="btn small ghost adm-mail" href=${mailto}><${Icon} name="mail" size=${15}/> Email</a>` : null}
      ${actions}
    </div>
  </section>`;
}

// Des puces à choix unique (promo, destinataire…) : aria-pressed, comme les filtres du site
export function Puces({ items, value, onChange, label, id }) {
  return html`<div class="chips adm-puces" role="group" aria-label=${label} id=${id}>
    ${items.map(([k, l]) => html`<button type="button" class=${'chip' + (value === k ? ' on' : '')} aria-pressed=${value === k} onClick=${() => onChange(k)}>${l}</button>`)}
  </div>`;
}

// Les promos d'étudiants de 3A, 4A et 5A cette année, la plus avancée d'abord : [[promo, « 5A · 2027 »], …]
export const promosEtudiantes = saison => [saison + 1, saison + 2, saison + 3].map(p => [p, `${NIVEAUX[5 - (p - saison - 1)].short} · ${p}`]);

// ---------------------------------------------------------------------------
// La rubrique
// ---------------------------------------------------------------------------
export function AnimerAdmin({ ctx }) {
  const { data, saison } = ctx;
  const now = Date.now();
  // L'école des messages et des liens : celle que regarde la console quand elle est ouverte, sinon celle de l'administration
  // (ses textes d'avant). Une autre école : ses membres seulement, ses chiffres, son nom, ses liens (&ecole=…).
  const ecoleTextes = ecoleDesTextes(ctx);
  const { slug: ecole, autre } = ecoleTextes;
  const inscrites = new Set((autre ? (data.profiles || []).filter(p => ecoleDe(p) === ecole) : data.profiles || []).map(p => Number(p.promo)));
  // Lien d'une promo : sa page d'aperçu dès qu'elle a un inscrit (comme dans « Inviter »)
  const lienPromo = (promo, l) => lienInvitation(promo, l, inscrites.has(promo), ecole);
  return html`<div class="adm-animer">
    <section class="panel adm-tete">
      <h2 class="h-ico"><${Icon} name="porte-voix"/> Animer le réseau</h2>
      <p class="small muted">Chaque semaine, des messages prêts à coller dans les groupes WhatsApp des promos. Jamais de nom d’étudiant ; des lauréats, le prénom seulement, et avec leur accord.</p>
    </section>
    <h2 class="eyebrow adm-eyebrow">Cette semaine</h2>
    <div class="adm-cartes">
      <${Resume} ctx=${ctx} now=${now} lienPromo=${lienPromo} ecoleTextes=${ecoleTextes}/>
      <${Merci} ctx=${ctx} now=${now} ecoleTextes=${ecoleTextes}/>
      <${Fondateurs} ctx=${ctx} ecoleTextes=${ecoleTextes}/>
      <${DemandesPromo} saison=${saison} lienPromo=${lienPromo}/>
      <${OffreBoite} ctx=${ctx} ecoleTextes=${ecoleTextes}/>
      <div class="adm-pile">
        <${RendezVous} ctx=${ctx}/>
        <${Gmail} ctx=${ctx}/>
      </div>
    </div>
  </div>`;
}

// a) Le résumé de la semaine : pour les lauréats, ou pour une promo d'étudiants (3A, 4A, 5A)
function Resume({ ctx, now, lienPromo, ecoleTextes: { slug: ecole, noms } }) {
  const { data, saison } = ctx;
  const [pour, setPour] = useState('laureats');
  const items = [['laureats', 'Lauréats'], ...promosEtudiantes(saison)];
  const promo = pour === 'laureats' ? null : pour;
  const textes = l => resumeSemaine(data, { now, saison, promo, lien: promo ? lienPromo(promo, l) : lienSite(l, ecole), ecole, noms });
  return html`<${CarteMessage} id="adm-resume" titre="Résumé de la semaine" icone="chart" textes=${l => ({ [l]: textes(l)[l] })}
    aide="Les 7 derniers jours : nouveaux membres, offres, Demandes qui attendent, matchs et aides, puis l’agenda des 14 jours à venir. Pour une promo d’étudiants, seulement les offres de son année.">
    <${Puces} items=${items} value=${pour} onChange=${setPour} label="Pour qui ?" id="adm-resume-pour"/>
  <//>`;
}

// b) Le merci public : la case « D'accord » est gardée sur cet appareil, pour cet admin et cette semaine
const cleMerci = (uid, now) => `ensam-admin-merci:${uid}:${semaineISO(now)}`;
const lireCoches = k => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
function Merci({ ctx, now, ecoleTextes: { slug: ecole, noms } }) {
  const { data, me, openProfile } = ctx;
  const aidants = aidantsSemaine(data, now, ecole);
  const cle = cleMerci(me?.id, now);
  const [coches, setCoches] = useState(() => lireCoches(cle));
  useEffect(() => setCoches(lireCoches(cle)), [cle]);
  const basculer = id => {
    const n = coches.includes(id) ? coches.filter(x => x !== id) : [...coches, id];
    setCoches(n);
    try { localStorage.setItem(cle, JSON.stringify(n)); } catch { /* stockage indisponible : la case vaut pour cette visite */ }
  };
  const { vus: visibles, reste, plus } = useVoirPlus(aidants, 5);
  const textes = l => texteMerci(aidants, coches, { lien: lienSite(l, ecole), ecoleNoms: noms });
  return html`<${CarteMessage} id="adm-merci" titre="Merci de la semaine" icone="heart" textes=${l => ({ [l]: textes(l)[l] })}
    aide="Les lauréats qui ont aidé ces 7 derniers jours. Demande d’abord son accord à chacun, puis coche « D’accord » : seuls les prénoms cochés sont dans le message.">
    ${aidants.length ? html`<ul class="adm-lignes" id="adm-merci-liste">${visibles.map(a => html`<li key=${a.id} class="adm-ligne" data-id=${a.id}>
        <${PersonneLigne} p=${a.p} onOpen=${openProfile} meta=${ligneGestes(a.gestes)}/>
        <span class="adm-ligne-act">
          <label class="adm-ok"><input type="checkbox" checked=${coches.includes(a.id)} onChange=${() => basculer(a.id)}/> <span>D’accord</span></label>
          <${MessageBtn} ctx=${ctx} p=${a.p} label="Demander son accord" cls="btn tiny ghost" texte=${messageAccordMerci(a)}/>
        </span>
      </li>`)}</ul>
      <${VoirPlus} reste=${reste} onPlus=${plus}/>`
      : html`<p class="small hint-box"><${Icon} name="info" size=${15}/> <span>Personne n’a encore aidé cette semaine.</span></p>`}
  <//>`;
}

// En ligne, la vue profils ne donne pas fondateur_public (le « non » du fondateur) : l'administration le lit dans la table
// profiles, que sa politique de lecture lui ouvre. Tant que la réponse n'est pas là, ou si elle échoue, aucun prénom n'est cité.
// En démo : null, le profil porte la réponse.
function useAccordsFondateurs(store, liste) {
  const live = store?.mode === 'live' && !!store.sb;
  const ids = liste.map(f => f.id).filter(Boolean).join(',');
  const [accords, setAccords] = useState(() => new Map());
  useEffect(() => {
    if (!live || !ids) return undefined;
    let on = true;
    Promise.resolve(store.sb.from('profiles').select('id, fondateur_public').in('id', ids.split(','))).then(r => {
      if (on && !r?.error) setAccords(new Map((r?.data || []).map(p => [p.id, p.fondateur_public])));
    }, () => {});
    return () => { on = false; };
  }, [live, ids]);
  return live ? accords : null;
}

// c) Les membres fondateurs : le classement du site (useFondateurs, déjà dans ctx), sinon le calcul sur les données ;
// pour une autre école que celle de l'administration, le calcul sur ses membres
function Fondateurs({ ctx, ecoleTextes: { slug: ecole, noms, autre } }) {
  const { data, fondateurs, store } = ctx;
  const liste = autre ? classementFondateurs(vueEcole(data, ecole)) : fondateurs?.liste || classementFondateurs(data);
  const accords = useAccordsFondateurs(store, liste);
  const textes = l => texteFondateurs(data, { liste, lien: lienSite(l, ecole), accords, noms });
  return html`<${CarteMessage} id="adm-fondateurs" titre="Membres fondateurs" icone="star" textes=${l => ({ [l]: textes(l)[l] })}
    aide="Pour donner envie aux lauréats : les prénoms des fondateurs qui acceptent d’être montrés, et les places qui restent.">
    <p class="small strong adm-places">${lignePlaces(liste.length)}</p>
  <//>`;
}

// d) Une promo de 3A, 4A ou 5A : publier sa Demande avec son CV
function DemandesPromo({ saison, lienPromo }) {
  const [promo, setPromo] = useState(saison + 1);
  return html`<${CarteMessage} id="adm-demande" titre="Publier sa Demande avec son CV" icone="file" textes=${l => ({ [l]: textePromoDemande(promo, { saison, lien: lienPromo(promo, l) })[l] })}
    aide="Un message par promo, et deux lignes pour dire pourquoi : les lauréats de la filière voient la Demande, et le CV leur dit tout de suite s’ils peuvent aider.">
    <${Puces} items=${promosEtudiantes(saison)} value=${promo} onChange=${setPromo} label="Pour qui ?" id="adm-demande-pour"/>
  <//>`;
}

// e) Les lauréats qui ont une entreprise et pas encore d'offre ; le compteur des offres publiées par l'admin
function OffreBoite({ ctx, ecoleTextes: { slug: ecole, noms } }) {
  const { data, me, openProfile } = ctx;
  const [compose, setCompose] = useState(false);
  const liste = laureatsSansOffre(data, ecole);
  const { vus: visibles, reste, plus } = useVoirPlus(liste, 8);
  const miennes = (data.offers || []).filter(o => o.author_id === me?.id).length;
  const lien = l => lienSite(l, ecole) + '#offres';
  return html`<section class="panel adm-carte" id="adm-offre-boite" aria-labelledby="adm-offre-boite-t">
    <div class="section-head"><h3 class="h-ico adm-carte-t" id="adm-offre-boite-t"><${Icon} name="briefcase"/> <span>Une offre de ta boîte</span></h3>
      <button type="button" class="btn small tonal" id="adm-publier" onClick=${() => setCompose(true)}><${Icon} name="plus" size=${15}/> Publier une offre</button></div>
    <p class="small muted">Les lauréats qui ont une entreprise sur leur profil et n’ont encore publié aucune offre. Le message est prêt, dans leur langue.</p>
    <div class="adm-jauge"><span class="small strong" id="adm-mes-offres">${`Offres publiées par toi : ${miennes} / ${OBJECTIF_OFFRES}`}</span>
      <span class="adm-jauge-barre" aria-hidden="true"><span style=${`inline-size:${Math.min(100, Math.round(miennes / OBJECTIF_OFFRES * 100))}%`}></span></span></div>
    ${liste.length ? html`<ul class="adm-lignes" id="adm-sans-offre">${visibles.map(p => html`<li key=${p.id} class="adm-ligne">
        <${PersonneLigne} p=${p} onOpen=${openProfile}/>
        <span class="adm-ligne-act"><${MessageBtn} ctx=${ctx} p=${p} label="Écrire" cls="btn tiny ghost" texte=${messageOffreBoite(p, lien(p.langue === 'ar' ? 'ar' : 'fr'), undefined, noms)}/></span>
      </li>`)}</ul>
      <${VoirPlus} reste=${reste} onPlus=${plus}/>`
      : html`<p class="small hint-box"><${Icon} name="check" size=${15}/> <span>Aucun lauréat avec une entreprise et sans offre pour l’instant.</span></p>`}
    ${compose ? html`<${OfferComposer} ctx=${ctx} onClose=${() => setCompose(false)}/>` : null}
  </section>`;
}

// f) Le rendez-vous du mois : le formulaire de l'agenda, déjà rempli, pour l'école que regarde la console (agenda.js, publierEvenement)
function RendezVous({ ctx }) {
  const ouvrir = () => publierEvenement(ctx.go, rendezVousDuMois(Date.now(), getLang() === 'ar' ? 'ar' : 'fr'));
  return html`<section class="panel adm-carte" id="adm-rdv" aria-labelledby="adm-rdv-t">
    <h3 class="h-ico adm-carte-t" id="adm-rdv-t"><${Icon} name="calendar"/> <span>Rendez-vous du mois</span></h3>
    <p class="small muted">Un lauréat raconte son métier en 30 minutes, en ligne, puis répond aux questions. Le formulaire de l’agenda s’ouvre déjà rempli : choisis la date et ajoute le lien de la visio.</p>
    <div class="adm-msg-act"><button type="button" class="btn small tonal" id="adm-rdv-ok" onClick=${ouvrir}><${Icon} name="calendar" size=${15}/> Préparer l’événement</button></div>
  </section>`;
}

// g) Les limites de Gmail : inviter les promos petit à petit
function Gmail({ ctx }) {
  return html`<section class="panel adm-carte" id="adm-gmail" aria-labelledby="adm-gmail-t">
    <h3 class="h-ico adm-carte-t" id="adm-gmail-t"><${Icon} name="mail"/> <span>Envois par Gmail</span></h3>
    <p class="small muted">Gmail envoie 500 emails par jour au plus, et environ 100 par heure. Invite les promos petit à petit, une ou deux par jour : les liens et les messages sont dans « Inviter ».</p>
    <div class="adm-msg-act"><button type="button" class="btn small ghost" id="adm-gmail-inviter" onClick=${() => ctx.go('admin/inviter')}><${Icon} name="send" size=${15}/> Ouvrir « Inviter »</button></div>
  </section>`;
}

injectCSS('admin-animer', `
.adm-animer, .adm-ecoles, .adm-partenaires, .adm-outils { display: flex; flex-direction: column; gap: var(--sp-4); min-width: 0; }
.adm-tete { gap: .4rem; }
.adm-tete h2 { margin: 0; }
.adm-eyebrow { margin: .4rem 0 -.4rem; }
.adm-cartes { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 440px), 1fr)); gap: var(--sp-4); align-items: start; }
.adm-pile { display: flex; flex-direction: column; gap: var(--sp-4); min-width: 0; }
.adm-carte { min-width: 0; }
.adm-carte .section-head { align-items: flex-start; }
.adm-carte-t { font-size: var(--fs-4); margin: 0; min-width: 0; }
.adm-carte-t > span { min-width: 0; overflow-wrap: anywhere; }
/* Chaque ligne prend le sens de son premier mot, comme dans WhatsApp (un titre d'offre en français dans un message arabe) */
.adm-msg { width: 100%; min-height: 8rem; field-sizing: content; resize: none; font-size: var(--fs-2); line-height: 1.55; background: var(--surface-2); border-color: var(--line); white-space: pre-wrap; overflow-wrap: anywhere; unicode-bidi: plaintext; }
.adm-msg-act { display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; }
.adm-msg-act .btn { min-height: 44px; }
.adm-puces .chip { min-height: 38px; }
.adm-lignes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.adm-ligne { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem .7rem; padding: .45rem 0; border-bottom: 1px solid var(--line); min-width: 0; }
.adm-ligne:last-child { border-bottom: 0; }
.adm-ligne > .person { flex: 1 1 200px; min-width: 0; min-height: 44px; }
.adm-ligne > .person .person-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.adm-ligne-act { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem .6rem; margin-inline-start: auto; }
.adm-ligne-act .btn { min-height: 38px; }
.adm-ok { display: inline-flex; align-items: center; gap: .4rem; min-height: 44px; padding-inline: .3rem; font-size: var(--fs-2); font-weight: 600; cursor: pointer; }
.adm-ok input { inline-size: 20px; block-size: 20px; }
.adm-places { margin: 0; }
.adm-jauge { display: flex; flex-direction: column; gap: .35rem; }
.adm-jauge-barre { display: block; block-size: 8px; border-radius: var(--r-pill); background: var(--surface-2); overflow: hidden; }
.adm-jauge-barre > span { display: block; block-size: 100%; border-radius: var(--r-pill); background: var(--accent); }
@media (max-width: 760px) {
  .adm-ligne-act { margin-inline-start: 0; inline-size: 100%; }
}
`);
