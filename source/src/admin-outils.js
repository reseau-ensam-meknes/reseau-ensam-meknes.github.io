// Administration > Affiches et rapport : de quoi faire venir les promos et rendre compte à l'école.
// a) une affiche A4 par promo (3A, 4A, 5A, lauréats) avec un grand QR code, en français et en arabe ;
// b) le mode événement : plein écran, le QR code et le compteur des inscrits du jour ;
// c) le rapport d'un mois pour l'école, à imprimer ou à enregistrer en PDF, sans aucun nom ;
// d) les offres des 14 derniers jours pour le bureau des relations entreprises ;
// e) les visuels des réussites (un recrutement confirmé), seulement avec l'accord des deux personnes, prénoms seulement.
// Le QR code (qr.js) se charge à la demande : il ne pèse rien sur le reste du site.
import { html, useState, useEffect, useRef } from './vendor/preact-htm.js';
import { Icon, injectCSS, toast } from './ui.js';
import { addAR, getLang } from './i18n.js';
import { ajouterIcones } from './entree.js';
import { glyph, SOMBRE, TUILE_DEFS, TUILE } from './logo.js';
import { MessageBtn } from './messages.js';
import { NIVEAUX, lienPromo, seasonLabel } from './logic.js';
import { CarteMessage, ChoixLangue, Puces, promosEtudiantes, lienSite } from './admin-animer.js';
import { vueEcole, membresDe, prenomDe, dateLongue, chiffresRapport, offresRecentes, texteOffresBRE, texteVisuel, consentementsDonnes,
  messageAccordVisuel, nomFichierVisuel, inscritsDepuis, adresseCourte, texteAffiche } from './admin-textes.js';

ajouterIcones({
  imprimante: '<path d="M7 8.5V3.5h10v5"/><rect x="3.5" y="8.5" width="17" height="8.5" rx="2"/><path d="M7 13.5h10v7H7z"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2.5v2.5M20 14v.01M17.5 17.5H20V20M14 20h.01"/>',
  'plein-ecran': '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
});

addAR({
  'Affiches et rapport': 'الملصقات والتقرير',
  'Pour faire venir les promos et rendre compte à l’école : des affiches avec QR code, un écran pour les événements, le rapport du mois, les offres récentes et les visuels des réussites. Aucun nom d’étudiant, sauf sur un visuel, avec son accord.': 'لاستقطاب الدفعات وإطلاع المدرسة: ملصقات برمز QR، وشاشة للأحداث، وتقرير الشهر، والعروض الأخيرة، وصور النجاحات. لا اسم لأي طالب، إلا في صورة نجاح، وبموافقته.',
  // Affiche
  'Affiche à imprimer': 'ملصق للطباعة',
  'Une affiche A4 par promo, en français et en arabe, avec un grand QR code qui ouvre l’inscription. À coller là où passent les étudiants, avec l’accord des lieux.': 'ملصق A4 لكل دفعة، بالفرنسية والعربية، مع رمز QR كبير يفتح التسجيل. يُعلَّق حيث يمر الطلبة، بموافقة المكان.',
  'Pour qui ?': 'لمن؟', 'Lauréats': 'الخريجون', 'Imprimer': 'طباعة', 'Copier le lien': 'نسخ الرابط', 'Lien copié.': 'تم نسخ الرابط.',
  'Aperçu de l’affiche A4': 'معاينة ملصق A4', 'Préparation du QR code…': 'جارٍ تحضير رمز QR…',
  'Copie impossible ici : sélectionne le texte et copie-le.': 'النسخ غير ممكن هنا: حدّد النص وانسخه.',
  // Mode événement
  'Mode événement': 'وضع الحدث',
  'Sur un écran ou un vidéoprojecteur pendant un événement : le QR code en grand et les inscrits du jour, qui montent en direct.': 'على شاشة أو جهاز عرض خلال حدث: رمز QR كبير، وتسجيلات اليوم تتزايد مباشرة.',
  'Promo dans le lien': 'الدفعة في الرابط', 'Toutes les promos': 'كل الدفعات',
  'Facultatif : la promo choisie est déjà remplie à l’inscription.': 'اختياري: الدفعة المختارة تكون محدَّدة مسبقًا عند التسجيل.',
  'Plein écran': 'ملء الشاشة', 'Fermer': 'إغلاق', 'Échap ou « Fermer » pour revenir à la console': 'زر Esc أو «إغلاق» للعودة إلى لوحة الإدارة',
  'Impression impossible ici.': 'الطباعة غير ممكنة هنا.',
  // Rapport
  'Rapport pour l’école': 'تقرير للمدرسة',
  'Un mois du réseau sur une page A4, sans aucun nom : pour la direction ou les associations. Il s’imprime dans la langue du site.': 'شهر من الشبكة في صفحة A4، دون أي اسم: للإدارة أو للجمعيات. يُطبع بلغة الموقع.',
  'Imprimer ou enregistrer en PDF': 'طباعة أو حفظ بصيغة PDF',
  'Membres': 'الأعضاء', 'Étudiants': 'الطلبة', 'Offres ouvertes': 'العروض المفتوحة',
  'Entreprises où travaillent des lauréats': 'مقاولات يعمل فيها خريجون', 'Demandes avec une réponse en 48 h': 'طلبات حصلت على جواب خلال 48 ساعة',
  'Aides de lauréats à des étudiants': 'مساعدات من خريجين لطلبة', 'Recrutements confirmés': 'توظيفات مؤكدة',
  'Pas encore de Demande': 'لا طلبات بعد', 'Inscriptions par semaine': 'التسجيلات في كل أسبوع', 'Aides par semaine': 'المساعدات في كل أسبوع',
  'Les 12 dernières semaines': 'الأسابيع الاثنا عشر الأخيرة', 'Semaine du': 'أسبوع', 'Nombre': 'العدد',
  'Parcours les plus représentés': 'المسارات الأكثر حضورًا', 'Étudiants par année': 'الطلبة حسب السنة',
  'Initiative de lauréats, indépendante de l’administration de l’école.': 'مبادرة من الخريجين، مستقلة عن إدارة المدرسة.',
  'Aucun nom dans ce rapport : seulement des chiffres.': 'لا أسماء في هذا التقرير: أرقام فقط.',
  // Offres pour le bureau des relations entreprises
  'Offres pour le bureau des relations entreprises': 'عروض لمكتب العلاقات مع المقاولات',
  'Les offres ouvertes publiées ces 14 derniers jours, avec leur lien : à envoyer au bureau des relations entreprises de l’école, qui peut les relayer.': 'العروض المفتوحة المنشورة خلال الأيام الأربعة عشر الماضية، مع روابطها: تُرسل إلى مكتب العلاقات مع المقاولات في المدرسة، الذي يمكنه نشرها.',
  // Visuels
  'Visuels des réussites': 'صور النجاحات',
  'Une image à partager quand un recrutement est confirmé : le prénom, l’entreprise, et le prénom du lauréat qui a aidé. Jamais de photo, et seulement si les deux sont d’accord.': 'صورة للمشاركة عند تأكيد توظيف: الاسم الشخصي، والمقاولة، والاسم الشخصي للخريج الذي ساعد. دون صورة شخصية أبدًا، وفقط إذا وافق الاثنان.',
  'Recrutement confirmé': 'توظيف مؤكد', 'Langue de l’image': 'لغة الصورة',
  'Aucun recrutement confirmé pour l’instant.': 'لا يوجد توظيف مؤكد حتى الآن.',
  'Demander son accord': 'طلب موافقته', 'Accord de': 'موافقة', 'Les deux ont coché « peut être montré ».': 'وضع الاثنان علامة على «يمكن إظهاره».',
  'Les deux doivent être d’accord avant de télécharger.': 'يجب أن يوافق الاثنان قبل التحميل.',
  'L’étudiant doit être d’accord avant de télécharger.': 'يجب أن يوافق الطالب قبل التحميل.',
  'Carré · 1080 × 1080': 'مربع · 1080 × 1080', 'Paysage · 1200 × 627': 'أفقي · 1200 × 627',
  'Télécharger le carré': 'تحميل الصورة المربعة', 'Télécharger le paysage': 'تحميل الصورة الأفقية',
  'Image téléchargée.': 'تم تحميل الصورة.', 'Image impossible à créer ici.': 'تعذّر إنشاء الصورة هنا.',
}, [
  [/^(\d+) offres? ces 14 derniers jours$/, n => `عروض خلال الأيام الأربعة عشر الماضية: ${n}`],
  [/^\+(\d+) ces 30 jours$/, n => `+${n} خلال 30 يومًا`],
  [/^(\d+) vérifiés?$/, n => `موثَّقون: ${n}`],
  [/^(\d+) sur (\d+)$/, (a, b) => `${a} من ${b}`],
  [/^(\d+) mentorats? terminés?$/, n => `جلسات إرشاد منتهية: ${n}`],
  [/^Année (\d{4}-\d{4})$/, a => `السنة ${a}`],
  [/^Semaine du ([\d/]+) : (\d+)$/, (d, n) => `أسبوع ${d}: ${n}`],
  [/^(\d+) membres?$/, n => `الأعضاء: ${n}`],
]);

// ---------------------------------------------------------------------------
// Petits outils de la rubrique
// ---------------------------------------------------------------------------
// Le QR code, chargé une seule fois et seulement ici
let moduleQR = null;
function useQR() {
  const [m, setM] = useState(moduleQR);
  useEffect(() => { if (!m) import('./qr.js').then(x => { moduleQR = x; setM(x); }).catch(() => {}); }, []);
  return m;
}

// Le logo à plat (sans dégradé, donc sans identifiant à dupliquer) : affiche, rapport, et sa copie imprimée
const LOGO_PLAT = `<rect width="512" height="512" rx="116" fill="#1D3150"/>${glyph()}`;
const LogoPlat = ({ cls = '' }) => html`<svg class=${'logo-plat ' + cls} viewBox="0 0 512 512" style=${SOMBRE} aria-hidden="true" dangerouslySetInnerHTML=${{ __html: LOGO_PLAT }}></svg>`;

// Imprimer une seule feuille : sa copie, seule dans la page imprimée (le reste du site est masqué). La copie part un peu
// après l'impression (certains téléphones lisent la page juste après « afterprint »), ou quand on quitte la rubrique.
let minuteurImpression = 0;
function nettoyerImpression() {
  clearTimeout(minuteurImpression);
  document.querySelectorAll('.adm-impression').forEach(x => x.remove());
  document.body.classList.remove('print-adm', 'print-affiche', 'print-rapport');
}
const apresImpression = () => { clearTimeout(minuteurImpression); minuteurImpression = setTimeout(nettoyerImpression, 1000); };
function imprimer(el, classe) {
  if (!el) return;
  nettoyerImpression();
  const boite = document.createElement('div');
  boite.className = 'adm-impression';
  const copie = el.cloneNode(true);
  for (const x of [copie, ...copie.querySelectorAll('[id]')]) x.removeAttribute('id');
  boite.appendChild(copie);
  document.body.appendChild(boite);
  document.body.classList.add('print-adm', classe);
  addEventListener('afterprint', apresImpression, { once: true });
  try { window.print(); } catch { nettoyerImpression(); toast('Impression impossible ici.', 'err'); }
}

async function copierLien(texte) {
  try { await navigator.clipboard.writeText(texte); toast('Lien copié.'); } catch { toast('Copie impossible ici : sélectionne le texte et copie-le.', 'err'); }
}

const deux = n => String(n).padStart(2, '0');
const jourMois = d => { const x = new Date(d); return `${deux(x.getDate())}/${deux(x.getMonth() + 1)}`; };

// ---------------------------------------------------------------------------
// La rubrique
// ---------------------------------------------------------------------------
export function OutilsAdmin({ ctx }) {
  const qr = useQR();
  useEffect(() => nettoyerImpression, []);
  return html`<div class="adm-outils">
    <section class="panel adm-tete">
      <h2 class="h-ico"><${Icon} name="imprimante"/> Affiches et rapport</h2>
      <p class="small muted">Pour faire venir les promos et rendre compte à l’école : des affiches avec QR code, un écran pour les événements, le rapport du mois, les offres récentes et les visuels des réussites. Aucun nom d’étudiant, sauf sur un visuel, avec son accord.</p>
    </section>
    <div class="adm-cartes">
      <${Affiche} ctx=${ctx} qr=${qr}/>
      <div class="adm-pile">
        <${ModeEvenement} ctx=${ctx} qr=${qr}/>
        <${OffresBRE} ctx=${ctx}/>
      </div>
    </div>
    <${Rapport} ctx=${ctx}/>
    <${Visuels} ctx=${ctx}/>
  </div>`;
}

// ---------------------------------------------------------------------------
// a) L'affiche A4 d'une promo
// ---------------------------------------------------------------------------
function Affiche({ ctx, qr }) {
  const { saison } = ctx;
  const [pour, setPour] = useState(saison + 1);
  const feuille = useRef();
  const items = [...promosEtudiantes(saison), ['laureats', 'Lauréats']];
  // L'adresse du QR code : la page de la promo (courte à recopier, elle ouvre l'inscription avec la promo remplie)
  const lien = pour === 'laureats' ? lienSite('fr') : lienPromo(pour, 'fr', true, location.href);
  return html`<section class="panel adm-carte" id="ou-affiche" aria-labelledby="ou-affiche-t">
    <h3 class="h-ico adm-carte-t" id="ou-affiche-t"><${Icon} name="qr"/> <span>Affiche à imprimer</span></h3>
    <p class="small muted">Une affiche A4 par promo, en français et en arabe, avec un grand QR code qui ouvre l’inscription. À coller là où passent les étudiants, avec l’accord des lieux.</p>
    <${Puces} items=${items} value=${pour} onChange=${setPour} label="Pour qui ?" id="ou-affiche-pour"/>
    <figure class="ou-affiche-cadre" ref=${feuille}>
      <${AfficheA4} a=${texteAffiche(pour, saison)} lien=${lien} qr=${qr}/>
      <figcaption class="sr-only">Aperçu de l’affiche A4</figcaption>
    </figure>
    <div class="adm-msg-act">
      <button type="button" class="btn small tonal" id="ou-affiche-imprimer" disabled=${!qr} onClick=${() => imprimer(feuille.current, 'print-affiche')}><${Icon} name="imprimante" size=${15}/> Imprimer</button>
      <button type="button" class="btn small ghost" id="ou-affiche-lien" onClick=${() => copierLien(lien)}><${Icon} name="link" size=${15}/> Copier le lien</button>
    </div>
  </section>`;
}

// Tout le texte de l'affiche est écrit dans ses deux langues : rien n'y est traduit (translate="no" sur chaque texte).
// Sa mise en page ne change pas avec la langue du site (dir="ltr") : c'est la même affiche pour tout le monde.
const Deux = ({ f, r }) => html`<span class="af-fr" lang="fr" dir="ltr" translate="no">${f}</span><span class="af-ar" lang="ar" dir="rtl" translate="no">${r}</span>`;
function AfficheA4({ a, lien, qr }) {
  const { fr, ar } = a, court = adresseCourte(lien);
  const titreQR = getLang() === 'ar' ? `رمز QR: ${court}` : `QR code : ${court}`;
  return html`<div class="affiche" dir="ltr">
    <div class="af-tete">
      <${LogoPlat} cls="af-logo"/>
      <p class="af-marque"><${Deux} f="Réseau ENSAM Meknès" r="شبكة ENSAM مكناس"/></p>
      <p class="af-gratuit"><${Deux} f=${fr.gratuit} r=${ar.gratuit}/></p>
    </div>
    <div class="af-corps">
      <div class="af-titres">
        <p class="af-titre" lang="fr" dir="ltr" translate="no">${fr.titre}</p>
        <p class="af-titre-ar" lang="ar" dir="rtl" translate="no">${ar.titre}</p>
        <span class="af-trait" aria-hidden="true"></span>
        <p class="af-pour"><${Deux} f=${fr.pour} r=${ar.pour}/></p>
      </div>
      <ol class="af-avantages">${fr.avantages.map((x, i) => html`<li><span class="af-n" aria-hidden="true">${i + 1}</span><${Deux} f=${x} r=${ar.avantages[i]}/></li>`)}</ol>
      <div class="af-qr-bloc">
        ${qr ? html`<div class="af-qr" dangerouslySetInnerHTML=${{ __html: qr.qrSVG(lien, { titre: titreQR }) }}></div>`
          : html`<div class="af-qr af-qr-attente" role="status"><span class="small muted">Préparation du QR code…</span></div>`}
        <p class="af-scan"><${Deux} f=${fr.scan} r=${ar.scan}/></p>
        <p class="af-url" dir="ltr" translate="no">${court}</p>
      </div>
    </div>
    <p class="af-pied"><${Deux} f=${fr.pied} r=${ar.pied}/></p>
  </div>`;
}

// ---------------------------------------------------------------------------
// b) Le mode événement
// ---------------------------------------------------------------------------
function ModeEvenement({ ctx, qr }) {
  const { saison } = ctx;
  const [promo, setPromo] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const bouton = useRef();
  const promos = [5, 4, 3, 2, 1].map(n => [saison + 1 + (5 - n), `${NIVEAUX[n].short} · ${saison + 1 + (5 - n)}`]);
  const fermer = () => { setOuvert(false); requestAnimationFrame(() => bouton.current?.focus()); };
  return html`<section class="panel adm-carte" id="ou-evenement" aria-labelledby="ou-evenement-t">
    <h3 class="h-ico adm-carte-t" id="ou-evenement-t"><${Icon} name="plein-ecran"/> <span>Mode événement</span></h3>
    <p class="small muted">Sur un écran ou un vidéoprojecteur pendant un événement : le QR code en grand et les inscrits du jour, qui montent en direct.</p>
    <label class="field"><span class="field-label">Promo dans le lien</span>
      <select id="ou-ev-promo" value=${promo} onChange=${e => setPromo(e.target.value)} aria-describedby="ou-ev-promo-aide">
        <option value="">Toutes les promos</option>${promos.map(([p, l]) => html`<option value=${p}>${l}</option>`)}
      </select>
      <span class="field-hint" id="ou-ev-promo-aide">Facultatif : la promo choisie est déjà remplie à l’inscription.</span></label>
    <div class="adm-msg-act">
      <button type="button" class="btn small tonal" id="ou-ev-ouvrir" ref=${bouton} disabled=${!qr} onClick=${() => setOuvert(true)}><${Icon} name="plein-ecran" size=${15}/> Plein écran</button>
    </div>
    ${ouvert && qr ? html`<${EcranEvenement} ctx=${ctx} qr=${qr} promo=${promo ? Number(promo) : null} onClose=${fermer}/>` : null}
  </section>`;
}

// L'écran est le même dans les deux langues (dir="ltr") : le QR code à gauche, le compteur à droite
function EcranEvenement({ ctx, qr, promo, onClose }) {
  const ecran = useRef(), fermerBtn = useRef();
  const [now, setNow] = useState(Date.now());
  const fermer = useRef(onClose);
  fermer.current = onClose;
  useEffect(() => {
    const el = ecran.current;
    // Le vrai plein écran quand le navigateur le permet ; sinon (iPhone, cadre), l'écran couvre déjà toute la fenêtre
    try { el?.requestFullscreen?.({ navigationUI: 'hide' })?.catch?.(() => {}); } catch { /* refusé : on reste dans la fenêtre */ }
    fermerBtn.current?.focus();
    const touche = e => {
      if (e.key === 'Escape') { e.preventDefault(); fermer.current(); }
      else if (e.key === 'Tab') { e.preventDefault(); fermerBtn.current?.focus(); } // un seul bouton : le focus ne repart pas dans la console
    };
    const sortie = () => { if (!document.fullscreenElement) fermer.current(); };
    document.addEventListener('keydown', touche);
    document.addEventListener('fullscreenchange', sortie);
    const avant = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    // L'heure avance (minuit remet le compteur à zéro) ; les profils sont relus de temps en temps, au cas où le direct décroche
    const tic = setInterval(() => setNow(Date.now()), 20e3);
    const releve = setInterval(async () => {
      try { if (typeof ctx.store.loadTable === 'function') { await ctx.store.loadTable('profiles'); ctx.store.emit?.(); } } catch { /* hors ligne : on garde le chiffre */ }
    }, 90e3);
    return () => {
      document.removeEventListener('keydown', touche);
      document.removeEventListener('fullscreenchange', sortie);
      document.documentElement.style.overflow = avant;
      clearInterval(tic); clearInterval(releve);
      if (document.fullscreenElement) document.exitFullscreen?.().catch?.(() => {});
    };
  }, []);
  const lien = promo ? lienPromo(promo, 'fr', false, location.href) : lienSite('fr');
  const court = adresseCourte(lien);
  const { aujourdhui, semaine } = inscritsDepuis(ctx.data, Math.max(now, Date.now()));
  const titreQR = getLang() === 'ar' ? `رمز QR: ${court}` : `QR code : ${court}`;
  return html`<div class="ev-ecran" id="ou-ev-ecran" ref=${ecran} role="dialog" aria-modal="true" aria-labelledby="ou-ev-titre" dir="ltr">
    <button type="button" class="btn small ev-fermer" id="ou-ev-fermer" ref=${fermerBtn} onClick=${() => fermer.current()}><${Icon} name="x" size=${16}/> Fermer</button>
    <div class="ev-marque"><${LogoPlat} cls="ev-logo"/><span class="ev-marque-t"><span lang="fr" dir="ltr" translate="no">Réseau ENSAM Meknès</span><span lang="ar" dir="rtl" translate="no">شبكة ENSAM مكناس</span></span></div>
    <h2 class="ev-titre" id="ou-ev-titre"><span lang="fr" dir="ltr" translate="no">Rejoins le Réseau ENSAM Meknès</span><span class="ev-titre-ar" lang="ar" dir="rtl" translate="no">انضم إلى شبكة ENSAM مكناس</span></h2>
    <div class="ev-centre">
      <div class="ev-qr-bloc">
        <div class="ev-qr" dangerouslySetInnerHTML=${{ __html: qr.qrSVG(lien, { titre: titreQR }) }}></div>
        <p class="ev-url" dir="ltr" translate="no">${court}</p>
      </div>
      <div class="ev-compteur" role="status" aria-live="polite">
        <span class="ev-n" key=${aujourdhui}>${aujourdhui}</span>
        <span class="ev-l" lang="fr" dir="ltr" translate="no">${aujourdhui > 1 ? 'inscriptions aujourd’hui' : 'inscription aujourd’hui'}</span>
        <span class="ev-l" lang="ar" dir="rtl" translate="no">تسجيلات اليوم</span>
        <span class="ev-semaine" translate="no"><span lang="fr" dir="ltr" translate="no">${semaine} cette semaine</span> · <span lang="ar" dir="rtl" translate="no">${semaine} هذا الأسبوع</span></span>
      </div>
    </div>
    <p class="ev-aide small" dir="auto">Échap ou « Fermer » pour revenir à la console</p>
  </div>`;
}

// ---------------------------------------------------------------------------
// c) Le rapport pour l'école : les 30 derniers jours, en une page A4, dans la langue du site
// ---------------------------------------------------------------------------
function Rapport({ ctx }) {
  const feuille = useRef();
  const now = Date.now();
  const c = chiffresRapport(ctx.data, now, ctx.saison);
  const lg = getLang() === 'ar' ? 'ar' : 'fr';
  const periode = lg === 'ar' ? `من ${dateLongue(c.debut, 'ar', true)} إلى ${dateLongue(c.fin, 'ar', true)}` : `Du ${dateLongue(c.debut, 'fr', true)} au ${dateLongue(c.fin, 'fr', true)}`;
  const arrete = lg === 'ar' ? `أرقام ${dateLongue(now, 'ar', true)}.` : `Chiffres du ${dateLongue(now, 'fr', true)}.`;
  const chiffres = [
    ['membres', 'Membres', c.membres, `+${c.nouveaux} ces 30 jours`],
    ['etudiants', 'Étudiants', c.etudiants, null], // par année : la liste du bas
    ['laureats', 'Lauréats', c.laureats, `${c.verifies} vérifiés`],
    ['entreprises', 'Entreprises où travaillent des lauréats', c.entreprises, null],
    ['offres', 'Offres ouvertes', c.offres, null],
    ['reponses', 'Demandes avec une réponse en 48 h', c.taux48 == null ? '–' : `${Math.round(c.taux48 * 100)}%`, c.demandes ? `${c.demandes48} sur ${c.demandes}` : 'Pas encore de Demande'],
    ['aides', 'Aides de lauréats à des étudiants', c.aides, `${c.mentorats} mentorats terminés`],
    ['recrutements', 'Recrutements confirmés', c.recrutements, `Année ${seasonLabel(ctx.saison)}`],
  ];
  return html`<section class="panel" id="ou-rapport" aria-labelledby="ou-rapport-t">
    <div class="section-head"><h3 class="h-ico adm-carte-t" id="ou-rapport-t"><${Icon} name="chart"/> <span>Rapport pour l’école</span></h3>
      <button type="button" class="btn small tonal" id="ou-rapport-imprimer" onClick=${() => imprimer(feuille.current, 'print-rapport')}><${Icon} name="imprimante" size=${15}/> Imprimer ou enregistrer en PDF</button></div>
    <p class="small muted">Un mois du réseau sur une page A4, sans aucun nom : pour la direction ou les associations. Il s’imprime dans la langue du site.</p>
    <div class="ou-feuille-cadre">
      <article class="rp-feuille" ref=${feuille} aria-labelledby="ou-rp-titre">
        <header class="rp-tete">
          <${LogoPlat} cls="rp-logo"/>
          <div class="rp-tete-t"><p class="rp-marque">Réseau ENSAM Meknès</p><h4 class="rp-titre" id="ou-rp-titre">Rapport pour l’école</h4><p class="rp-periode">${periode}</p></div>
        </header>
        <div class="rp-chiffres">${chiffres.map(([k, l, v, s]) => html`<div class="rp-chiffre" data-k=${k}><span class="rp-v">${v}</span><span class="rp-l">${l}</span>${s ? html`<span class="rp-s">${s}</span>` : null}</div>`)}</div>
        <div class="rp-graphes">
          <${Graphe} titre="Inscriptions par semaine" serie=${c.inscriptions}/>
          <${Graphe} titre="Aides par semaine" serie=${c.aidesSemaines}/>
        </div>
        <div class="rp-bas">
          <div><h5 class="rp-h">Parcours les plus représentés</h5>
            <ol class="rp-parcours">${c.parcours.map(x => html`<li><span>${x.nom}</span><span class="rp-n">${x.n}</span></li>`)}</ol></div>
          <div><h5 class="rp-h">Étudiants par année</h5>
            <ol class="rp-parcours">${c.parAnnee.filter(x => x.total).map(x => html`<li><span>${x.label}</span><span class="rp-n">${x.total}</span></li>`)}</ol></div>
        </div>
        <footer class="rp-pied"><p>Initiative de lauréats, indépendante de l’administration de l’école.</p><p>Aucun nom dans ce rapport : seulement des chiffres.</p><p>${arrete}</p></footer>
      </article>
    </div>
  </section>`;
}

// Une série par semaine, en colonnes : une seule série (le titre la nomme, pas de légende), colonnes de 16 unités au plus,
// bout arrondi de 4 posé sur une ligne de base fine, la valeur écrite seulement sur la plus haute et la dernière semaine,
// un <title> par semaine au survol, et le tableau des valeurs pour les lecteurs d'écran
function Graphe({ titre, serie }) {
  const W = 340, H = 150, T = 20, B = 24, n = serie.length, slot = W / n, bw = Math.min(16, slot * 0.6);
  const max = Math.max(1, ...serie.map(s => s.n)), base = H - B;
  const y = v => base - (base - T) * (v / max);
  const iMax = serie.reduce((k, s, i) => (s.n >= serie[k].n ? i : k), 0), der = n - 1;
  const colonne = (x, haut) => { const h = base - haut, r = Math.min(4, h, bw / 2); return `M${x} ${base}V${haut + r}a${r} ${r} 0 0 1 ${r} ${-r}H${x + bw - r}a${r} ${r} 0 0 1 ${r} ${r}V${base}Z`; };
  const reperes = new Set([0, Math.floor((n - 1) / 2), n - 1]);
  return html`<figure class="rp-graphe">
    <figcaption class="rp-h">${titre} <span class="rp-sous">Les 12 dernières semaines</span></figcaption>
    <div class="rp-svg" dir="ltr">
      <svg class="rp-colonnes" viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${titre}>
        ${serie.map((s, i) => { const x = i * slot + (slot - bw) / 2; return html`<g class="rp-col">
          <title>${`Semaine du ${jourMois(s.debut)} : ${s.n}`}</title>
          <rect x=${i * slot} y="0" width=${slot} height=${H} fill="transparent"/>
          ${s.n ? html`<path class="rp-barre" d=${colonne(x, y(s.n))}/>` : null}
          ${s.n && (i === iMax || i === der) ? html`<text class="rp-val" x=${x + bw / 2} y=${y(s.n) - 6} text-anchor="middle">${s.n}</text>` : null}
          ${reperes.has(i) ? html`<text class="rp-axe" x=${i === 0 ? x : i === der ? x + bw : x + bw / 2} y=${H - 7} text-anchor=${i === 0 ? 'start' : i === der ? 'end' : 'middle'}>${jourMois(s.debut)}</text>` : null}
        </g>`; })}
        <line class="rp-base" x1="0" x2=${W} y1=${base} y2=${base}/>
      </svg>
    </div>
    <table class="sr-only"><caption>${titre}</caption>
      <thead><tr><th scope="col">Semaine du</th><th scope="col">Nombre</th></tr></thead>
      <tbody>${serie.map(s => html`<tr><th scope="row">${jourMois(s.debut)}</th><td>${s.n}</td></tr>`)}</tbody>
    </table>
  </figure>`;
}

// ---------------------------------------------------------------------------
// d) Les offres des 14 derniers jours, pour le bureau des relations entreprises
// ---------------------------------------------------------------------------
function OffresBRE({ ctx }) {
  const offres = offresRecentes(ctx.data, Date.now());
  const textes = lg => texteOffresBRE(offres, { base: lienSite(lg) });
  return html`<${CarteMessage} id="ou-bre" titre="Offres pour le bureau des relations entreprises" icone="briefcase" textes=${textes}
    email=${{ a: '', sujet: { fr: 'Offres récentes pour les étudiants de l’ENSAM Meknès', ar: 'عروض حديثة لطلبة ENSAM مكناس' } }}
    aide="Les offres ouvertes publiées ces 14 derniers jours, avec leur lien : à envoyer au bureau des relations entreprises de l’école, qui peut les relayer.">
    <p class="small strong">${`${offres.length} offre${offres.length > 1 ? 's' : ''} ces 14 derniers jours`}</p>
  <//>`;
}

// ---------------------------------------------------------------------------
// e) Les visuels des réussites
// ---------------------------------------------------------------------------
const FORMATS = [['carre', 1080, 1080, 'Carré · 1080 × 1080', 'Télécharger le carré'], ['paysage', 1200, 627, 'Paysage · 1200 × 627', 'Télécharger le paysage']];
const cleAccord = (uid, id) => `ensam-admin-visuel:${uid}:${id}`;
const lireAccord = k => { try { const v = JSON.parse(localStorage.getItem(k) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };

function Visuels({ ctx }) {
  const { data, me } = ctx;
  const parId = new Map((data.profiles || []).map(p => [p.id, p]));
  const miens = new Set(membresDe(vueEcole(data)).map(p => p.id));
  const reussites = (data.placements || []).filter(p => p.status === 'confirme' && miens.has(p.student_id) && p.entreprise)
    .sort((a, b) => String(b.confirmed_at || b.created_at || '').localeCompare(String(a.confirmed_at || a.created_at || '')));
  const [choix, setChoix] = useState('');
  const [langue, setLangue] = useState(getLang() === 'ar' ? 'ar' : 'fr');
  const pl = reussites.find(x => x.id === choix) || reussites[0] || null;
  const cle = pl ? cleAccord(me?.id, pl.id) : '';
  const [accord, setAccord] = useState(() => (cle ? lireAccord(cle) : {}));
  useEffect(() => setAccord(cle ? lireAccord(cle) : {}), [cle]);
  const lgDate = getLang() === 'ar' ? 'ar' : 'fr';
  if (!pl) {
    return html`<section class="panel" id="ou-visuels" aria-labelledby="ou-visuels-t">
      <h3 class="h-ico adm-carte-t" id="ou-visuels-t"><${Icon} name="image"/> <span>Visuels des réussites</span></h3>
      <p class="small hint-box"><${Icon} name="info" size=${15}/> <span>Aucun recrutement confirmé pour l’instant.</span></p>
    </section>`;
  }
  const etu = parId.get(pl.student_id) || null, lau = pl.laureat_id ? parId.get(pl.laureat_id) || null : null;
  const publics = consentementsDonnes(pl);
  const ok = publics || (!!accord.etudiant && (!lau || !!accord.laureat));
  const basculer = k => {
    const n = { ...accord, [k]: !accord[k] };
    setAccord(n);
    try { localStorage.setItem(cle, JSON.stringify(n)); } catch { /* stockage indisponible : la case vaut pour cette visite */ }
  };
  const v = texteVisuel(pl, etu, lau, langue);
  const personnes = [['etudiant', etu], ...(lau ? [['laureat', lau]] : [])];
  return html`<section class="panel" id="ou-visuels" aria-labelledby="ou-visuels-t">
    <div class="section-head"><h3 class="h-ico adm-carte-t" id="ou-visuels-t"><${Icon} name="image"/> <span>Visuels des réussites</span></h3>
      <${ChoixLangue} value=${langue} onChange=${setLangue} id="ou-visuels-langue" label="Langue de l’image"/></div>
    <p class="small muted">Une image à partager quand un recrutement est confirmé : le prénom, l’entreprise, et le prénom du lauréat qui a aidé. Jamais de photo, et seulement si les deux sont d’accord.</p>
    <div class="ou-vis">
      <div class="ou-vis-choix">
        <label class="field"><span class="field-label">Recrutement confirmé</span>
          <select id="ou-vis-choix" value=${pl.id} onChange=${e => setChoix(e.target.value)}>
            ${reussites.map(x => html`<option value=${x.id} translate="no">${[prenomDe(parId.get(x.student_id)), x.entreprise, x.confirmed_at ? dateLongue(x.confirmed_at, lgDate) : ''].filter(Boolean).join(' · ')}</option>`)}
          </select></label>
        <ul class="adm-lignes ou-vis-accords" id="ou-vis-accords">
          ${personnes.map(([role, p]) => html`<li class="adm-ligne" data-role=${role}>
            <label class="adm-ok"><input type="checkbox" checked=${publics || !!accord[role]} disabled=${publics} onChange=${() => basculer(role)}/> <span>Accord de <span translate="no">${prenomDe(p) || '?'}</span></span></label>
            ${!publics && p ? html`<span class="adm-ligne-act"><${MessageBtn} ctx=${ctx} p=${p} label="Demander son accord" cls="btn tiny ghost" texte=${messageAccordVisuel(pl, p, role, p.langue, etu)}/></span>` : null}
          </li>`)}
        </ul>
        ${publics ? html`<p class="small tag done">Les deux ont coché « peut être montré ».</p>` : null}
        <p class="small muted" id="ou-vis-regle">${lau ? 'Les deux doivent être d’accord avant de télécharger.' : 'L’étudiant doit être d’accord avant de télécharger.'}</p>
      </div>
      <div class="ou-vis-apercus">
        ${FORMATS.map(([k, w, h, nom, action]) => html`<${ApercuVisuel} key=${k + pl.id + langue} k=${k} w=${w} h=${h} nom=${nom} action=${action} v=${v} langue=${langue} ok=${ok}
          fichier=${nomFichierVisuel(pl, etu, w, h)}/>`)}
      </div>
    </div>
  </section>`;
}

function ApercuVisuel({ k, w, h, nom, action, v, langue, ok, fichier }) {
  const toile = useRef();
  const [pret, setPret] = useState(false);
  useEffect(() => {
    let fini = false;
    setPret(false);
    dessinerVisuel(toile.current, v, w, h, langue).then(() => { if (!fini) setPret(true); }).catch(() => {});
    return () => { fini = true; };
  }, [v.titre, v.aide, langue, w, h]);
  const telecharger = () => {
    const c = toile.current;
    if (!c) return;
    const lancer = url => { const a = document.createElement('a'); a.href = url; a.download = fichier; document.body.appendChild(a); a.click(); a.remove(); toast('Image téléchargée.'); };
    try {
      if (c.toBlob) c.toBlob(b => { if (!b) return toast('Image impossible à créer ici.', 'err'); const u = URL.createObjectURL(b); lancer(u); setTimeout(() => URL.revokeObjectURL(u), 4000); }, 'image/png');
      else lancer(c.toDataURL('image/png'));
    } catch { toast('Image impossible à créer ici.', 'err'); }
  };
  return html`<figure class=${'ou-vis-apercu ou-vis-' + k} data-format=${k}>
    <canvas ref=${toile} width=${w} height=${h} class="ou-vis-toile" role="img" translate="no" aria-label=${[v.titre, v.aide, v.signature].filter(Boolean).join(' · ')}></canvas>
    <figcaption class="small muted">${nom}</figcaption>
    <button type="button" class="btn small tonal ou-vis-dl" disabled=${!ok || !pret} aria-describedby="ou-vis-regle" onClick=${telecharger}><${Icon} name="download" size=${15}/> ${action}</button>
  </figure>`;
}

// Le dessin : fond bleu nuit, un trait orange, le titre en grand, la ligne d'aide, puis le logo et « Réseau ENSAM Meknès ».
// Les polices du site sont attendues avant de dessiner (sinon le canvas prendrait une police de secours).
const POLICE_TITRE = '"Titres ENSAM", "Texte ENSAM arabe", "Segoe UI", system-ui, sans-serif';
const POLICE_TEXTE = '"Texte ENSAM", "Texte ENSAM arabe", "Segoe UI", system-ui, sans-serif';
let imageLogo = null;
function logoImage() {
  imageLogo ||= new Promise((ok, ko) => {
    const i = new Image();
    i.onload = () => ok(i); i.onerror = ko;
    i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" style="${SOMBRE}">${TUILE_DEFS}${TUILE}<g>${glyph()}</g></svg>`);
  });
  return imageLogo;
}
function couper(c, texte, largeur) {
  const out = []; let l = '';
  for (const mot of String(texte || '').split(/\s+/).filter(Boolean)) {
    const essai = l ? `${l} ${mot}` : mot;
    if (!l || c.measureText(essai).width <= largeur) l = essai; else { out.push(l); l = mot; }
  }
  if (l) out.push(l);
  return out;
}
async function dessinerVisuel(toile, v, w, h, langue) {
  if (!toile) return;
  const c = toile.getContext('2d');
  if (!c) return;
  const ar = langue === 'ar', carre = w === h;
  try {
    await Promise.all([
      document.fonts?.load(`bold 64px ${POLICE_TITRE}`, v.titre), document.fonts?.load(`normal 32px ${POLICE_TEXTE}`, v.aide || 'a'),
      document.fonts?.load(`600 32px ${POLICE_TEXTE}`, v.signature),
    ]);
    await document.fonts?.ready;
  } catch { /* police de secours */ }
  let logo = null;
  try { logo = await logoImage(); } catch { /* sans logo */ }
  toile.width = w; toile.height = h;
  const fond = c.createLinearGradient(0, 0, w, h);
  fond.addColorStop(0, '#27497A'); fond.addColorStop(1, '#14223A');
  c.fillStyle = fond; c.fillRect(0, 0, w, h);
  const halo = c.createRadialGradient(ar ? w * 0.12 : w * 0.88, h * 0.1, 0, ar ? w * 0.12 : w * 0.88, h * 0.1, Math.max(w, h) * 0.62);
  halo.addColorStop(0, 'rgba(79,169,230,0.30)'); halo.addColorStop(1, 'rgba(79,169,230,0)');
  c.fillStyle = halo; c.fillRect(0, 0, w, h);

  const m = carre ? 96 : 64, large = w - 2 * m, xd = ar ? w - m : m;
  c.direction = ar ? 'rtl' : 'ltr'; c.textAlign = ar ? 'right' : 'left'; c.textBaseline = 'top';
  // Le titre : la plus grande taille qui tient en 4 lignes (3 en paysage)
  const maxL = carre ? 4 : 3;
  let taille = carre ? 96 : 66, lignes = [];
  for (; taille >= (carre ? 52 : 38); taille -= 4) {
    c.font = `bold ${taille}px ${POLICE_TITRE}`;
    lignes = couper(c, v.titre, large);
    if (lignes.length <= maxL && lignes.every(l => c.measureText(l).width <= large)) break;
  }
  const hl = Math.round(taille * (ar ? 1.35 : 1.12));
  const tAide = carre ? 40 : 30;
  c.font = `normal ${tAide}px ${POLICE_TEXTE}`;
  const lignesAide = v.aide ? couper(c, v.aide, large).slice(0, 2) : [];
  const hAide = Math.round(tAide * 1.4);
  const tLogo = carre ? 88 : 64, pied = h - m - tLogo;
  const trait = carre ? 14 : 10, gap = carre ? 40 : 26;
  const hauteur = trait + gap + lignes.length * hl + (lignesAide.length ? gap * 0.8 + lignesAide.length * hAide : 0);
  let yy = Math.max(m, Math.round(m + (pied - gap - m - hauteur) / 2));
  // Le trait orange
  const lt = carre ? 128 : 96;
  c.fillStyle = '#F39200';
  c.beginPath(); c.roundRect ? c.roundRect(ar ? w - m - lt : m, yy, lt, trait, trait / 2) : c.rect(ar ? w - m - lt : m, yy, lt, trait); c.fill();
  yy += trait + gap;
  c.fillStyle = '#FFFFFF'; c.font = `bold ${taille}px ${POLICE_TITRE}`;
  for (const l of lignes) { c.fillText(l, xd, yy); yy += hl; }
  if (lignesAide.length) {
    yy += gap * 0.8;
    c.fillStyle = '#C9D8EC'; c.font = `normal ${tAide}px ${POLICE_TEXTE}`;
    for (const l of lignesAide) { c.fillText(l, xd, yy); yy += hAide; }
  }
  // Le pied : une ligne fine, le logo et la signature
  c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(m, pied - (carre ? 36 : 22), large, 2);
  const xLogo = ar ? w - m - tLogo : m;
  if (logo) c.drawImage(logo, xLogo, pied, tLogo, tLogo);
  c.fillStyle = '#FFFFFF'; c.font = `600 ${carre ? 38 : 28}px ${POLICE_TEXTE}`; c.textBaseline = 'middle';
  c.fillText(v.signature, ar ? xLogo - (carre ? 24 : 18) : xLogo + tLogo + (carre ? 24 : 18), pied + tLogo / 2);
}

// ---------------------------------------------------------------------------
injectCSS('admin-outils', `
.ou-affiche-cadre { container-type: inline-size; width: min(100%, 460px); margin: 0 auto; }
.affiche { --af-nuit: #1F3354; --af-bleu: #1670A8; --af-orange: #F39200; --af-encre: #13203A; --af-gris: #46546D; --af-fond: #EEF3F9;
  position: relative; aspect-ratio: 210 / 297; width: 100%; overflow: hidden; display: flex; flex-direction: column;
  font-size: 10px; font-size: 2.35cqw; line-height: 1.3; color: var(--af-encre); background: #FFFFFF; border-radius: 6px;
  box-shadow: 0 1px 2px rgb(0 0 0 / .08), 0 10px 30px rgb(19 32 58 / .14); font-family: var(--f-body);
  -webkit-print-color-adjust: exact; print-color-adjust: exact; text-align: start; }
.affiche p { margin: 0; }
.affiche [lang="ar"] { font-family: "Texte ENSAM arabe", var(--f-body); }
.af-fr, .af-ar { display: block; }
.af-avantages .af-ar, .af-avantages .af-fr { text-align: start; }
.af-tete { display: flex; align-items: center; gap: .9em; padding: 1.5em 2em; background: var(--af-nuit); color: #FFFFFF; }
.logo-plat { display: block; flex: none; }
.af-logo { width: 3.6em; height: 3.6em; }
.af-marque { display: flex; flex-direction: column; gap: .1em; min-width: 0; }
.af-marque .af-fr { font: 750 1.4em/1.15 var(--f-display); }
.af-marque .af-ar { font-size: 1.15em; font-weight: 600; color: #DCE6F3; }
.af-gratuit { margin-inline-start: auto; display: flex; flex-direction: column; align-items: center; padding: .4em .9em; border-radius: .7em; background: var(--af-orange); color: #2A1A00; font-weight: 700; line-height: 1.15; text-align: center; }
.af-corps { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 1.1em; padding: 1.6em 2em 1em; }
.af-titres { display: flex; flex-direction: column; align-items: center; gap: .25em; text-align: center; }
.af-trait { display: block; width: 4em; height: .32em; margin: .35em 0 .15em; border-radius: .16em; background: var(--af-orange); }
.af-titre { font: 750 2.55em/1.06 var(--f-display); color: var(--af-nuit); letter-spacing: -.01em; }
.af-titre-ar { font-size: 2.05em; font-weight: 700; line-height: 1.3; color: var(--af-nuit); }
.af-pour { display: flex; flex-wrap: wrap; justify-content: center; gap: .1em 1.2em; font-weight: 700; font-size: 1.2em; color: var(--af-bleu); }
.af-avantages { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .8em; }
.af-avantages li { display: flex; flex-direction: column; gap: .3em; padding: .75em .8em; border-radius: .7em; background: var(--af-fond); font-size: .9em; line-height: 1.25; }
.af-avantages .af-fr { font-weight: 600; }
.af-avantages .af-ar { color: var(--af-gris); }
.af-n { display: grid; place-items: center; width: 1.8em; height: 1.8em; border-radius: 50%; background: var(--af-nuit); color: #FFFFFF; font-weight: 700; }
.af-qr-bloc { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .45em; }
.af-qr { flex: 1 1 0; min-height: 0; aspect-ratio: 1 / 1; max-width: 62%; }
.af-qr svg { display: block; width: 100%; height: 100%; }
.af-qr-attente { display: grid; place-items: center; width: 40%; background: var(--af-fond); border-radius: .6em; }
.af-scan { display: flex; flex-direction: column; align-items: center; text-align: center; font-weight: 700; font-size: 1.1em; line-height: 1.25; }
.af-url { font: 700 1.25em/1.2 var(--f-mono); color: var(--af-bleu); letter-spacing: .01em; overflow-wrap: anywhere; text-align: center; }
.af-pied { display: flex; flex-direction: column; align-items: center; gap: .1em; padding: .8em 2em 1.1em; border-top: 1px solid #DCE3EC; font-size: .85em; color: var(--af-gris); text-align: center; }

/* Mode événement */
.ev-ecran { position: fixed; inset: 0; z-index: 120; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: clamp(.6rem, 2.4vh, 1.8rem); padding: clamp(3.4rem, 6vh, 4rem) clamp(1rem, 4vw, 3rem) clamp(1rem, 4vh, 2.5rem); overflow: auto;
  color: #FFFFFF; background: radial-gradient(110% 80% at 85% 0%, #2C5F95 0%, transparent 58%), linear-gradient(160deg, #1F3354, #0F1A2C); }
.ev-fermer { position: absolute; inset-block-start: 1rem; inset-inline-end: 1rem; min-height: 44px; background: rgb(255 255 255 / .12); color: #FFFFFF; border-color: rgb(255 255 255 / .28); }
.ev-fermer:hover { background: rgb(255 255 255 / .2); }
.ev-marque { display: flex; align-items: center; gap: .8rem; }
.ev-logo { width: clamp(40px, 6vh, 64px); height: clamp(40px, 6vh, 64px); }
.ev-marque-t { display: flex; flex-direction: column; font-weight: 700; line-height: 1.2; }
.ev-marque-t [lang="ar"], .ev-titre-ar, .ev-l[lang="ar"], .ev-semaine [lang="ar"] { font-family: "Texte ENSAM arabe", var(--f-body); }
.ev-titre { margin: 0; display: flex; flex-direction: column; align-items: center; gap: .2em; text-align: center; font: 750 clamp(1.5rem, 4.4vmin, 3.4rem)/1.12 var(--f-display); color: #FFFFFF; }
.ev-titre-ar { font-size: .82em; font-weight: 700; line-height: 1.35; color: #DCE6F3; }
.ev-centre { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: clamp(1rem, 6vw, 5rem); }
.ev-qr-bloc { display: flex; flex-direction: column; align-items: center; gap: .7rem; }
.ev-qr { width: min(50vh, 70vw); aspect-ratio: 1 / 1; border-radius: 1.1rem; overflow: hidden; background: #FFFFFF;
  box-shadow: 0 0 0 .45rem rgb(255 255 255 / .08), 0 24px 60px rgb(0 0 0 / .35); animation: ev-souffle 6s ease-in-out infinite; }
.ev-qr svg { display: block; width: 100%; height: 100%; }
.ev-url { margin: 0; font: 700 clamp(1rem, 2.6vmin, 1.7rem)/1.2 var(--f-mono); color: #A9D6F7; overflow-wrap: anywhere; text-align: center; }
.ev-compteur { display: flex; flex-direction: column; align-items: center; gap: .25rem; text-align: center; min-width: 12rem; }
.ev-n { font: 750 clamp(4rem, 16vmin, 10rem)/1 var(--f-display); color: #FFFFFF; font-variant-numeric: tabular-nums; animation: ev-arrivee .8s var(--ease, ease-out) both; }
.ev-n::after { content: ""; display: block; width: .9em; height: .08em; margin: .12em auto 0; border-radius: .04em; background: #F39200; }
.ev-l { font-size: clamp(1rem, 2.6vmin, 1.7rem); color: #DCE6F3; }
.ev-semaine { margin-top: .6rem; padding: .35rem 1rem; border-radius: 999px; background: rgb(255 255 255 / .1); font-weight: 600; }
.ev-aide { margin: 0; color: #9DB0CA; }
@keyframes ev-arrivee { from { opacity: 0; transform: translateY(.25em) scale(.96); } }
@keyframes ev-souffle { 50% { box-shadow: 0 0 0 1.1rem rgb(243 146 0 / .13), 0 24px 60px rgb(0 0 0 / .35); } }
@media (prefers-reduced-motion: reduce) { .ev-qr, .ev-n { animation: none; } }

/* Rapport */
.ou-feuille-cadre { overflow: hidden; }
.rp-feuille { display: flex; flex-direction: column; gap: 1.1rem; max-width: 820px; margin: 0 auto; padding: clamp(1rem, 3vw, 2rem); border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface); }
.rp-feuille p, .rp-feuille h4, .rp-feuille h5 { margin: 0; }
.rp-tete { display: flex; align-items: center; gap: .9rem; padding-bottom: .9rem; border-bottom: 2px solid var(--orange); }
.rp-logo { width: 52px; height: 52px; }
.rp-tete-t { display: flex; flex-direction: column; gap: .1rem; min-width: 0; }
.rp-marque { font-size: var(--fs-2); color: var(--muted); font-weight: 600; }
.rp-titre { font: 750 var(--fs-5, 1.4rem)/1.15 var(--f-display); }
.rp-periode { font-size: var(--fs-2); color: var(--ink-2); }
.rp-chiffres { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .6rem; }
.rp-chiffre { display: flex; flex-direction: column; gap: .15rem; padding: .7rem .8rem; border-radius: var(--r-md); background: var(--surface-2); min-width: 0; }
.rp-v { font: 750 1.55rem/1.1 var(--f-display); color: var(--ink); font-variant-numeric: tabular-nums; }
.rp-l { font-size: var(--fs-2); font-weight: 600; color: var(--ink-2); line-height: 1.25; }
.rp-s { font-size: var(--fs-1, .78rem); color: var(--muted); overflow-wrap: anywhere; }
.rp-graphes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem 1.4rem; }
.rp-graphe { margin: 0; display: flex; flex-direction: column; gap: .35rem; min-width: 0; }
.rp-h { font-size: var(--fs-3, 1rem); font-weight: 700; }
.rp-sous { display: block; font-size: var(--fs-1, .78rem); font-weight: 400; color: var(--muted); }
.rp-svg { max-width: 340px; }
.rp-colonnes { display: block; width: 100%; height: auto; overflow: visible; }
.rp-barre { fill: var(--s1); }
.rp-col:hover .rp-barre { fill: color-mix(in srgb, var(--s1) 78%, var(--ink)); }
.rp-base { stroke: var(--line-strong); stroke-width: 1; vector-effect: non-scaling-stroke; }
.rp-axe { fill: var(--muted); font: 11px var(--f-body); }
.rp-val { fill: var(--ink-2); font: 600 11px var(--f-body); }
.rp-bas { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem 1.4rem; }
.rp-parcours { margin: .4rem 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
.rp-parcours li { display: flex; justify-content: space-between; gap: .8rem; padding: .3rem 0; border-bottom: 1px solid var(--line); font-size: var(--fs-2); }
.rp-n { font-weight: 700; font-variant-numeric: tabular-nums; }
.rp-pied { display: flex; flex-direction: column; gap: .15rem; padding-top: .7rem; border-top: 1px solid var(--line); font-size: var(--fs-1, .78rem); color: var(--muted); }
.rp-pied p:first-child { font-weight: 600; color: var(--ink-2); }
@media (max-width: 760px) {
  .rp-chiffres, .rp-graphes, .rp-bas { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rp-graphes, .rp-bas { grid-template-columns: minmax(0, 1fr); }
  .rp-v { font-size: 1.3rem; }
}

/* Visuels */
.ou-vis { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: var(--sp-4); align-items: start; }
.ou-vis-choix { display: flex; flex-direction: column; gap: .6rem; min-width: 0; }
.ou-vis-choix select { width: 100%; }
.ou-vis-apercus { display: flex; flex-wrap: wrap; gap: var(--sp-4); align-items: flex-start; min-width: 0; }
.ou-vis-apercu { margin: 0; display: flex; flex-direction: column; gap: .4rem; min-width: 0; }
.ou-vis-carre { flex: 1 1 220px; max-width: 300px; }
.ou-vis-paysage { flex: 1.6 1 300px; max-width: 420px; }
.ou-vis-toile { display: block; width: 100%; height: auto; border-radius: var(--r-md); background: #1F3354; box-shadow: 0 1px 3px rgb(0 0 0 / .15); }
.ou-vis-dl { align-self: flex-start; min-height: 44px; }
@media (max-width: 900px) { .ou-vis { grid-template-columns: minmax(0, 1fr); } }

/* Impression : seule la copie de la feuille est imprimée */
.adm-impression { display: none; }
@media print {
  body.print-adm > *:not(.adm-impression) { display: none !important; }
  body.print-adm { margin: 0 !important; padding: 0 !important; background: #FFFFFF !important; }
  body.print-adm::before, body.print-adm::after { display: none !important; }
  body.print-adm .adm-impression { display: block !important;
    --ink: #13203A; --ink-2: #33415A; --muted: #56637A; --line: #D5DCE6; --line-strong: #AEB9C8; --surface: #FFFFFF; --surface-2: #F1F4F8; --bg: #FFFFFF; --s1: #1670A8; --orange: #F39200;
    color: #13203A; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body.print-affiche .adm-impression { page: affiche; }
  body.print-affiche .ou-affiche-cadre { width: 210mm; margin: 0; }
  body.print-affiche .affiche { width: 210mm; height: 296mm; aspect-ratio: auto; border-radius: 0; box-shadow: none; break-inside: avoid; }
  body.print-rapport .adm-impression { page: rapport; }
  body.print-rapport .rp-feuille { max-width: none; border: 0; border-radius: 0; padding: 0; gap: 5mm; }
  body.print-rapport .rp-chiffres { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  body.print-rapport .rp-graphes, body.print-rapport .rp-bas { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  body.print-rapport .rp-col:hover .rp-barre { fill: var(--s1); }
  @page affiche { size: A4 portrait; margin: 0; }
  @page rapport { size: A4 portrait; margin: 14mm; }
}
`);
