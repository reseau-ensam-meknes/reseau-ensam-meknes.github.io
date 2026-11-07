// Administration > Partenaires : les entreprises qui financent le réseau (jamais les membres). En haut : ce qui est signé,
// payé, en discussion, et les prochaines actions de la semaine ; puis le suivi par étapes (À contacter → Payé), les formules
// du plan (des prix de départ, à tester), le message pour une entreprise et le lien vers les cartes sponsorisées.
// Le tableau et la fiche sont ceux des écoles (admin-ecoles.js), sur la même table admin_suivi (type « partenaire »).
import { html, useState } from './vendor/preact-htm.js';
import { Icon, injectCSS } from './ui.js';
import { addAR } from './i18n.js';
import { useTableAdmin, FORMULES, resumePartenaires, dh, lienContact } from './admin-donnees.js';
import { chiffresReseau, messageEntreprise } from './admin-textes.js';
import { CarteMessage, lienSite } from './admin-animer.js';
import { SuiviTableau } from './admin-ecoles.js';

addAR({
  'Montant signé': 'المبلغ الموقّع', 'Signé ou payé': 'موقّع أو مدفوع', 'Déjà payé': 'المدفوع', 'En discussion': 'قيد النقاش',
  'Contacté, rendez-vous ou proposition': 'تم التواصل، أو موعد، أو عرض مقترح', 'Actions de la semaine': 'إجراءات الأسبوع', 'Les 7 prochains jours, retards compris': 'الأيام السبعة المقبلة، مع التأخيرات',
  'Formules': 'الصيغ', 'Ce qu’elle donne': 'ما تمنحه', 'Prix': 'الثمن',
  'Des prix de départ, à tester avec les premières entreprises. L’argent vient seulement des entreprises, jamais des membres.': 'أسعار أولية، تُجرَّب مع المقاولات الأولى. المال يأتي من المقاولات فقط، أبدًا من الأعضاء.',
  'Une carte « Sponsorisé » dans Match, pour les filières choisies': 'بطاقة «مُموَّل» في التوافق، للشعب المختارة', 'Un rapport chaque mois : vues et clics, jamais qui': 'تقرير كل شهر: المشاهدات والنقرات، دون ذكر من',
  'Tout ce que donne Visibilité': 'كل ما تمنحه صيغة الظهور', 'Ses offres en tête de liste': 'عروضها في أعلى القائمة', 'Une page entreprise': 'صفحة للمقاولة', 'Un événement par trimestre': 'حدث كل ثلاثة أشهر',
  'Ses offres en tête et sa carte dans Match, de novembre à mars': 'عروضها في الأعلى وبطاقتها في التوافق، من نونبر إلى مارس', 'Un rapport à la fin': 'تقرير في النهاية',
  'Message pour une entreprise': 'رسالة لمقاولة', 'Une entreprise du suivi, ou aucune': 'مقاولة من المتابعة، أو لا شيء', 'Aucune': 'لا شيء',
  'Les vrais chiffres du réseau, les règles (label « Sponsorisé », une carte sur 10 au plus dans Match, aucune donnée personnelle) et les trois formules.': 'الأرقام الحقيقية للشبكة، والقواعد (علامة «مُموَّل»، بطاقة واحدة على الأكثر من كل 10 في التوافق، دون أي معطيات شخصية)، والصيغ الثلاث.',
  'Cartes sponsorisées': 'البطاقات المموَّلة', 'Une entreprise a signé ? Crée sa carte dans « Sponsorisés » : elle porte le label « Sponsorisé » et ne voit jamais qui l’a vue.': 'وقّعت مقاولة؟ أنشئ بطاقتها في «المموَّلة»: تحمل علامة «مُموَّل» ولا ترى أبدًا من شاهدها.',
  'Ouvrir « Sponsorisés »': 'فتح «المموَّلة»', 'Créer sa carte sponsorisée': 'إنشاء بطاقتها المموَّلة',
  'Visibilité': 'الظهور', 'Partenaire': 'الشريك', 'Campagne PFE': 'حملة مشاريع نهاية الدراسة', 'Formule': 'الصيغة',
}, [
  [/^(\d[\d\s]*DH) en jeu$/, x => `${x} محتملة`],
  [/^(\d[\d\s]*DH) par mois$/, x => `${x} في الشهر`],
  [/^(\d[\d\s]*DH) la campagne$/, x => `${x} للحملة`],
]);

export function PartenairesAdmin({ ctx }) {
  const suivi = useTableAdmin(ctx, 'admin_suivi');
  const [fiche, setFiche] = useState(null);
  const r = resumePartenaires(suivi.lignes);
  const kpis = [
    ['Montant signé', dh(r.signe), 'Signé ou payé', 'pa-signe'],
    ['Déjà payé', dh(r.paye), null, 'pa-paye'],
    ['En discussion', r.discussion, r.enJeu ? `${dh(r.enJeu)} en jeu` : 'Contacté, rendez-vous ou proposition', 'pa-discussion'],
    ['Actions de la semaine', r.actions, 'Les 7 prochains jours, retards compris', 'pa-actions'],
  ];
  const signe = l => (['signe', 'paye'].includes(l.etape) ? html`<button type="button" class="btn tiny tonal pa-carte-sponso" onClick=${() => ctx.go('admin/sponsorises')}><${Icon} name="etiquette" size=${14}/> Créer sa carte sponsorisée</button>` : null);
  return html`<div class="adm-partenaires">
    <div class="kpis pa-kpis">${kpis.map(([l, v, sous, id]) => html`<div class="kpi" id=${id}><span class="kpi-label">${l}</span><span class="kpi-val">${v}</span>${sous ? html`<span class="small muted">${sous}</span>` : null}</div>`)}</div>
    <${SuiviTableau} ctx=${ctx} type="partenaire" suivi=${suivi} id="pa-suivi" titre="Suivi des partenaires" icone="briefcase" ajouter="Ajouter un partenaire"
      vide="Aucune entreprise suivie pour l’instant : ajoute la première." fiche=${fiche} setFiche=${setFiche} extra=${signe}/>
    <div class="adm-cartes">
      <${Formules}/>
      <div class="adm-pile">
        <${MessageEntreprise} ctx=${ctx} suivi=${suivi}/>
        <section class="panel adm-carte" id="pa-sponso" aria-labelledby="pa-sponso-t">
          <h3 class="h-ico adm-carte-t" id="pa-sponso-t"><${Icon} name="etiquette"/> <span>Cartes sponsorisées</span></h3>
          <p class="small muted">Une entreprise a signé ? Crée sa carte dans « Sponsorisés » : elle porte le label « Sponsorisé » et ne voit jamais qui l’a vue.</p>
          <div class="adm-msg-act"><button type="button" class="btn small ghost" id="pa-sponso-ok" onClick=${() => ctx.go('admin/sponsorises')}><${Icon} name="arrow" size=${15}/> Ouvrir « Sponsorisés »</button></div>
        </section>
      </div>
    </div>
  </div>`;
}

// Les trois formules du plan, côte à côte : à quoi elles donnent droit et leur prix de départ
function Formules() {
  return html`<section class="panel adm-carte" id="pa-formules" aria-labelledby="pa-formules-t">
    <h3 class="h-ico adm-carte-t" id="pa-formules-t"><${Icon} name="file"/> <span>Formules</span></h3>
    <div class="pa-formules">${FORMULES.map(f => html`<article class="pa-formule" data-formule=${f.k}>
      <div class="pa-formule-tete"><strong>${f.nom}</strong><span class="mono strong pa-prix">${`${dh(f.prix)} ${f.unite}`}</span></div>
      <ul>${f.contenu.map(c => html`<li>${c}</li>`)}</ul>
    </article>`)}</div>
    <p class="small muted">Des prix de départ, à tester avec les premières entreprises. L’argent vient seulement des entreprises, jamais des membres.</p>
  </section>`;
}

function MessageEntreprise({ ctx, suivi }) {
  const partenaires = (suivi.lignes || []).filter(l => l.type === 'partenaire').sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const [pour, setPour] = useState('');
  const l = partenaires.find(x => x.id === pour) || null;
  const email = l && lienContact(l.contact)?.startsWith('mailto:') ? l.contact.trim() : '';
  const c = chiffresReseau(ctx.data, Date.now(), ctx.saison);
  const textes = lg => messageEntreprise(c, { contact: l?.contact_nom || '', signature: ctx.me?.full_name || '', lien: lienSite(lg) });
  return html`<${CarteMessage} id="pa-message" titre="Message pour une entreprise" icone="mail" textes=${textes} email=${{ a: email, sujet: textes('fr').sujet }}
    aide="Les vrais chiffres du réseau, les règles (label « Sponsorisé », une carte sur 10 au plus dans Match, aucune donnée personnelle) et les trois formules.">
    ${partenaires.length ? html`<label class="field"><span class="field-label">Pour</span>
      <select id="pa-msg-pour" value=${pour} onChange=${e => setPour(e.target.value)} aria-describedby="pa-msg-pour-aide">
        <option value="">Aucune</option>${partenaires.map(x => html`<option value=${x.id} translate="no">${x.nom}</option>`)}</select>
      <span class="field-hint" id="pa-msg-pour-aide">Une entreprise du suivi, ou aucune</span></label>` : null}
  <//>`;
}

injectCSS('admin-partenaires', `
.pa-kpis .kpi-val { font-size: 1.6rem; white-space: nowrap; }
.pa-kpis .kpi { text-align: start; }
.pa-formules { display: flex; flex-direction: column; gap: .6rem; }
.pa-formule { display: flex; flex-direction: column; gap: .35rem; padding: .75rem .85rem; border-radius: var(--r-md); background: var(--surface-2); }
.pa-formule-tete { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .3rem .8rem; }
.pa-prix { color: var(--ink); white-space: nowrap; }
.pa-formule ul { margin: 0; padding-inline-start: 1.1rem; display: flex; flex-direction: column; gap: .15rem; font-size: var(--fs-2); color: var(--ink-2); }
.pa-carte-sponso { align-self: flex-start; min-height: 32px; white-space: normal; text-align: start; }
@media (max-width: 760px) { .pa-kpis .kpi-val { font-size: 1.3rem; } }
`);
