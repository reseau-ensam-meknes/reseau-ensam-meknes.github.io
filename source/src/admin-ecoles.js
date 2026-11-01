// Administration > Écoles. En tête, les deux règles : un réseau ne s'ouvre au nom d'une école qu'avec une personne de cette école
// et l'accord écrit pour son nom ; le dossier CNDP couvre l'ENSAM Meknès, chaque nouvelle école y est ajoutée avant d'ouvrir.
// Puis les réseaux (ouvrir, fermer, créer une école), le suivi des écoles à contacter (un tableau par étapes) et le message
// pour une école, en français ou en arabe.
// SuiviTableau et FicheSuivi servent aussi aux partenaires (admin-partenaires.js) : même table admin_suivi, autre type.
import { html, useState, useEffect } from './vendor/preact-htm.js';
import { Icon, Modal, Field, toast, injectCSS } from './ui.js';
import { addAR, arCount } from './i18n.js';
import { ajouterIcones } from './entree.js';
import { timeAgo } from './logic.js';
import { useTableAdmin, useEcoles, ecoleDe, ECOLE_DEFAUT, ETAPES, ETAPES_HORS, nomEtape, etapeVoisine, retardJours, grouperSuivi, CONDITIONS_ECOLE,
  pretAOuvrir, suiviDe, slugEcole, slugValide, lienContact, FORMULES, formule, dh } from './admin-donnees.js';
import { chiffresReseau, messageEcole, DESTINATAIRES, dateLongue } from './admin-textes.js';
import { CarteMessage, Puces, lienSite } from './admin-animer.js';

ajouterIcones({
  ecole: '<path d="M3 10.5 12 5l9 5.5"/><path d="M5 10v9.5h14V10"/><path d="M10 19.5V15h4v4.5"/><path d="M12 5V2.5h3.2"/>',
});

// Écoles d'ingénieurs à proposer en tapant le nom (de simples suggestions : rien n'est écrit tant qu'on n'enregistre pas)
const SUGGESTIONS = ['ENSAM Casablanca', 'ENSAM Rabat', 'ENSA Agadir', 'ENSA El Jadida', 'ENSA Fès', 'ENSA Kénitra', 'ENSA Marrakech', 'ENSA Oujda', 'ENSA Safi',
  'ENSA Tanger', 'ENSA Tétouan', 'ENSA Khouribga', 'ENSA Berrechid', 'ENSA Béni Mellal', 'ENSA Al Hoceima', 'EMI', 'EHTP', 'ENSEM', 'INPT', 'ENSIAS', 'ENIM', 'IAV Hassan II', 'ESITH'];

const JOURS_AR = n => (n === 1 ? 'متأخر بيوم واحد' : n === 2 ? 'متأخر بيومين' : `متأخر بـ${n} ${n <= 10 ? 'أيام' : 'يومًا'}`);
addAR({
  'Avant d’ouvrir une école': 'قبل فتح مدرسة',
  'Un réseau ne s’ouvre au nom d’une école qu’avec une personne de cette école, et avec l’accord écrit de l’école ou de son association pour son nom.': 'لا تُفتح شبكة باسم مدرسة إلا مع شخص من هذه المدرسة، وبموافقة مكتوبة من المدرسة أو من جمعيتها على استعمال اسمها.',
  'Le dossier CNDP couvre l’ENSAM Meknès : chaque nouvelle école y est ajoutée avant d’ouvrir.': 'ملف اللجنة الوطنية لمراقبة حماية المعطيات ذات الطابع الشخصي يغطي ENSAM مكناس: تُضاف إليه كل مدرسة جديدة قبل الفتح.',
  'Réseaux': 'الشبكات', 'Ouvert': 'مفتوحة', 'Fermé': 'مغلقة', 'Créer une école': 'إنشاء مدرسة', 'Ouvrir le réseau': 'فتح الشبكة', 'Fermer le réseau': 'إغلاق الشبكة',
  'Compléter le suivi': 'إكمال المتابعة', 'Dernière inscription :': 'آخر تسجيل:', 'Pas encore de membre.': 'لا أعضاء بعد.',
  'Le réseau d’origine reste toujours ouvert.': 'الشبكة الأصلية تبقى مفتوحة دائمًا.',
  'Les réseaux des autres écoles arrivent avec la prochaine mise à jour de la base.': 'شبكات المدارس الأخرى تصل مع التحديث القادم لقاعدة البيانات.',
  'Pour ouvrir :': 'للفتح:',
  'Réseau ouvert : ses étudiants et ses lauréats peuvent s’inscrire.': 'فُتحت الشبكة: يمكن لطلبتها وخريجيها التسجيل.',
  'Réseau fermé aux nouvelles inscriptions. Les membres gardent leur compte.': 'أُغلقت الشبكة أمام التسجيلات الجديدة. يحتفظ الأعضاء بحساباتهم.',
  'Nom de l’école': 'اسم المدرسة', 'Identifiant': 'المعرّف', 'Ex. ENSA Fès': 'مثال: ENSA Fès',
  'Tiré du nom : lettres minuscules, chiffres et tirets (2 à 40). Il ne change plus ensuite.': 'مأخوذ من الاسم: حروف لاتينية صغيرة وأرقام وشرطات (من 2 إلى 40). لا يتغير بعد ذلك.',
  'Cet identifiant est déjà pris.': 'هذا المعرّف مستعمل من قبل.', 'Identifiant invalide.': 'معرّف غير صالح.',
  'Le réseau est créé fermé. Il s’ouvre une fois les trois conditions remplies dans le suivi.': 'تُنشأ الشبكة مغلقة. تُفتح بعد استيفاء الشروط الثلاثة في المتابعة.',
  'École créée, réseau fermé.': 'أُنشئت المدرسة، والشبكة مغلقة.', 'Créer': 'إنشاء',
  // Le suivi
  'Suivi des écoles': 'متابعة المدارس', 'Suivi des partenaires': 'متابعة الشركاء', 'Ajouter une école': 'إضافة مدرسة', 'Ajouter un partenaire': 'إضافة شريك',
  'À contacter': 'للتواصل', 'Contactée': 'تم التواصل', 'Intéressée': 'مهتمة', 'Accord écrit': 'موافقة مكتوبة', 'Prête': 'جاهزة', 'Réseau ouvert': 'مفتوحة',
  'Contacté': 'تم التواصل', 'Rendez-vous': 'الموعد', 'Proposition': 'العرض المقترح', 'Signé': 'تم التوقيع', 'Payé': 'تم الأداء',
  'En pause': 'متوقف مؤقتًا', 'Refus': 'رفض', 'En pause ou refus': 'متوقفة مؤقتًا أو مرفوضة',
  'Une personne de l’école porte le réseau': 'شخص من المدرسة يحمل الشبكة', 'Personne de l’école': 'شخص من المدرسة',
  'Accord écrit pour le nom': 'موافقة مكتوبة على الاسم', 'Ajoutée au dossier CNDP': 'أضيفت إلى ملف اللجنة الوطنية', 'Dossier CNDP': 'ملف اللجنة الوطنية',
  'Étape précédente': 'المرحلة السابقة', 'Étape suivante': 'المرحلة التالية', 'Modifier': 'تعديل', 'Étape enregistrée.': 'تم حفظ المرحلة.',
  'Aujourd’hui': 'اليوم', 'Rien ici pour l’instant.': 'لا شيء هنا حاليًا.',
  'Personne à contacter pour l’instant : ajoute une école.': 'لا أحد للتواصل معه حاليًا: أضف مدرسة.',
  'Aucune entreprise suivie pour l’instant : ajoute la première.': 'لا توجد مقاولة في المتابعة حاليًا: أضف الأولى.',
  'Le suivi arrive avec la prochaine mise à jour de la base.': 'تصل المتابعة مع التحديث القادم لقاعدة البيانات.',
  // La fiche
  'Nouvelle école': 'مدرسة جديدة', 'Nouveau partenaire': 'شريك جديد', 'Nom de l’entreprise': 'اسم المقاولة', 'Ville': 'المدينة',
  'Contact': 'التواصل', 'Nom du contact': 'اسم جهة الاتصال', 'Son rôle': 'دوره', 'Email ou téléphone': 'البريد الإلكتروني أو الهاتف', 'Étape': 'المرحلة',
  'Prochaine action': 'الإجراء التالي', 'Le': 'في', 'Ex. Relancer par WhatsApp': 'مثال: التذكير عبر واتساب', 'Conditions pour ouvrir': 'شروط الفتح',
  'Formule': 'الصيغة', 'Aucune': 'لا شيء', 'Montant (DH)': 'المبلغ (درهم)', 'Notes': 'ملاحظات', 'Enregistrer': 'حفظ', 'Annuler': 'إلغاء', 'Supprimer': 'حذف',
  'Suivi enregistré.': 'تم حفظ المتابعة.', 'Ligne supprimée.': 'حُذف السطر.', 'Supprimer cette ligne du suivi ?': 'حذف هذا السطر من المتابعة؟',
  '2 à 120 caractères.': 'من 2 إلى 120 حرفًا.', 'Un nombre entier, sans espace.': 'عدد صحيح، دون مسافات.', 'Choisir une formule remplit le montant.': 'اختيار صيغة يملأ المبلغ.',
  // Le message
  'Message pour une école': 'رسالة لمدرسة', 'École': 'المدرسة', 'Destinataire': 'المرسَل إليه',
  'Association des étudiants': 'جمعية الطلبة', 'Association des lauréats': 'جمعية الخريجين', 'Direction': 'الإدارة',
  'Qui nous sommes, les vrais chiffres du réseau, la proposition et un appel de 20 minutes.': 'من نحن، والأرقام الحقيقية للشبكة، والاقتراح، ومكالمة من 20 دقيقة.',
  'Visibilité': 'الظهور', 'Partenaire': 'الشريك', 'Campagne PFE': 'حملة مشاريع نهاية الدراسة',
}, [
  [/^(\d+) membres? · (\d+) lauréats? · (\d+) étudiants?$/, (a, b, c) => `${arCount(a, ['عضو واحد', 'عضوان', 'أعضاء', 'عضوًا'])} · ${arCount(b, ['خريج واحد', 'خريجان', 'خريجين', 'خريجًا'])} · ${arCount(c, ['طالب واحد', 'طالبان', 'طلبة', 'طالبًا'])}`],
  [/^en retard de (\d+) jours?$/, n => JOURS_AR(+n)],
  [/^Ouvrir le réseau « (.+) » \? Ses étudiants et ses lauréats pourront s’inscrire\.$/, n => `فتح شبكة «${n}»؟ سيتمكن طلبتها وخريجوها من التسجيل.`],
  [/^Fermer le réseau « (.+) » \? Les nouvelles inscriptions sont bloquées ; les membres déjà inscrits gardent leur compte\.$/, n => `إغلاق شبكة «${n}»؟ تُمنع التسجيلات الجديدة؛ ويحتفظ الأعضاء المسجلون بحساباتهم.`],
]);

// Un grand écran : le tableau en colonnes ; sinon, la liste étape par étape
export function useLarge(q = '(min-width: 1100px)') {
  const lire = () => { try { return matchMedia(q).matches; } catch { return false; } };
  const [ok, setOk] = useState(lire);
  useEffect(() => {
    let m = null; try { m = matchMedia(q); } catch { return undefined; }
    const f = () => setOk(m.matches);
    m.addEventListener?.('change', f);
    return () => m.removeEventListener?.('change', f);
  }, [q]);
  return ok;
}

// ---------------------------------------------------------------------------
// Le suivi : tableau par étapes (écoles ou partenaires)
// ---------------------------------------------------------------------------
// La prochaine action : « Relancer par WhatsApp », sa date, et le retard en orange doux (jamais en rouge)
function ProchaineAction({ l, now }) {
  if (!l.prochaine_action && !l.prochaine_le) return null;
  const r = retardJours(l, now);
  const auj = l.prochaine_le && !r && new Date(l.prochaine_le + 'T00:00:00').toDateString() === new Date(now).toDateString();
  return html`<p class=${'sv-action small' + (r ? ' retard' : '')}>
    <${Icon} name="clock" size=${14}/>
    <span class="sv-action-txt">${l.prochaine_action ? html`<span translate="no" dir="auto">${l.prochaine_action}</span>` : null}
      ${l.prochaine_le ? html`<span class="sv-date">${auj ? 'Aujourd’hui' : dateLongue(l.prochaine_le + 'T12:00:00', 'fr')}</span>` : null}
      ${r ? html`<span class="sv-retard">${`en retard de ${r} jour${r > 1 ? 's' : ''}`}</span>` : null}</span>
  </p>`;
}

// Les trois conditions d'une école, en interrupteurs (un appui coche ou décoche)
function Conditions({ l, onBasculer, court }) {
  return html`<div class="sv-checks" role="group" aria-label="Conditions pour ouvrir">${CONDITIONS_ECOLE.map(([k, long, petit]) => html`
    <button type="button" role="switch" aria-checked=${!!l[k]} class=${'sv-check' + (l[k] ? ' ok' : '')} aria-label=${court ? long : null} onClick=${() => onBasculer(l, k)}>
      <span class="sv-check-ico" aria-hidden="true">${l[k] ? html`<${Icon} name="check" size=${14}/>` : null}</span><span>${court ? petit : long}</span>
    </button>`)}</div>`;
}

function CarteSuivi({ l, type, compact, now, onOuvrir, onDeplacer, onBasculer, extra }) {
  const lien = lienContact(l.contact);
  const f = l.formule ? formule(l.formule) : null;
  const prev = etapeVoisine(type, l.etape, -1), next = etapeVoisine(type, l.etape, 1);
  const contact = [l.contact_nom, compact ? null : l.contact_role].filter(Boolean).join(' · ');
  return html`<article class=${'sv-carte' + (compact ? ' compact' : '')} data-id=${l.id} aria-labelledby=${'sv-n-' + l.id}>
    <div class="sv-tete"><button type="button" class="linkish sv-nom" id=${'sv-n-' + l.id} onClick=${() => onOuvrir(l)} translate="no" dir="auto">${l.nom}</button>
      ${l.ville ? html`<span class="small muted" translate="no" dir="auto">${l.ville}</span>` : null}</div>
    ${contact || l.contact ? html`<p class="sv-contact small">${contact ? html`<span translate="no" dir="auto">${contact}</span>` : null}
      ${l.contact ? (lien ? html`<a href=${lien} dir="ltr" translate="no" class="sv-lien">${l.contact}</a>` : html`<span translate="no" dir="auto">${l.contact}</span>`) : null}</p>` : null}
    ${type === 'partenaire' && (f || l.montant_dh != null) ? html`<p class="sv-formule small">${f ? html`<span class="tag sv-tag">${f.nom}</span>` : null}${l.montant_dh != null ? html`<span class="mono strong">${dh(l.montant_dh)}</span>` : null}</p>` : null}
    <${ProchaineAction} l=${l} now=${now}/>
    ${type === 'ecole' ? html`<${Conditions} l=${l} onBasculer=${onBasculer} court=${compact}/>` : null}
    ${l.notes && !compact ? html`<p class="sv-notes small muted" translate="no" dir="auto">${l.notes}</p>` : null}
    ${extra?.(l) || null}
    <div class="sv-act">
      <button type="button" class="icon-btn sv-prec" aria-label="Étape précédente" title="Étape précédente" disabled=${!prev} onClick=${() => onDeplacer(l, -1)}><${Icon} name="back"/></button>
      <button type="button" class="icon-btn sv-modif" aria-label="Modifier" title="Modifier" onClick=${() => onOuvrir(l)}><${Icon} name="edit"/></button>
      <button type="button" class="icon-btn sv-suiv" aria-label="Étape suivante" title="Étape suivante" disabled=${!next} onClick=${() => onDeplacer(l, 1)}><${Icon} name="arrow"/></button>
    </div>
  </article>`;
}

// suivi : useTableAdmin(ctx, 'admin_suivi') ; fiche : l'état de la fiche ouverte, tenu par la page (pour l'ouvrir d'ailleurs) ;
// extra : ce qu'une carte montre de plus (un partenaire signé : « Créer sa carte sponsorisée »)
export function SuiviTableau({ ctx, type, suivi, id, titre, icone, ajouter, vide, fiche, setFiche, extra }) {
  const large = useLarge();
  const now = Date.now();
  const { colonnes, hors } = grouperSuivi(suivi.lignes, type);
  const total = colonnes.reduce((n, c) => n + c.lignes.length, 0) + hors.length;
  const deplacer = (l, sens) => { const k = etapeVoisine(type, l.etape, sens); if (k) ctx.act(async () => { await suivi.modifier(l.id, { etape: k }); toast('Étape enregistrée.'); }); };
  const basculer = (l, k) => ctx.act(() => suivi.modifier(l.id, { [k]: !l[k] }));
  const carte = (l, compact) => html`<${CarteSuivi} key=${l.id} l=${l} type=${type} compact=${compact} now=${now} onOuvrir=${setFiche} onDeplacer=${deplacer} onBasculer=${basculer} extra=${extra}/>`;
  return html`<section class="panel sv" id=${id} aria-labelledby=${id + '-t'}>
    <div class="section-head"><h2 class="h-ico" id=${id + '-t'}><${Icon} name=${icone}/> <span>${titre}</span> <span class="count">${total}</span></h2>
      ${suivi.absente ? null : html`<button type="button" class="btn small tonal" id=${id + '-ajouter'} onClick=${() => setFiche({})}><${Icon} name="plus" size=${15}/> ${ajouter}</button>`}</div>
    ${suivi.absente ? html`<p class="small muted">Le suivi arrive avec la prochaine mise à jour de la base.</p>`
      : !total ? html`<p class="small hint-box"><${Icon} name="info" size=${15}/> <span>${vide}</span></p>`
      : large ? html`<div class="sv-tableau" role="list">${colonnes.map(c => html`<div class="sv-col" role="listitem" aria-labelledby=${`${id}-c-${c.k}`} data-etape=${c.k}>
          <h3 class="sv-col-t" id=${`${id}-c-${c.k}`}><span>${c.label}</span> <span class="count">${c.lignes.length}</span></h3>
          <div class="sv-col-l">${c.lignes.map(l => carte(l, true))}</div></div>`)}</div>`
      : html`<div class="sv-liste">${colonnes.filter(c => c.lignes.length).map(c => html`<section class="sv-etape" aria-labelledby=${`${id}-e-${c.k}`} data-etape=${c.k}>
          <h3 class="sv-col-t" id=${`${id}-e-${c.k}`}><span>${c.label}</span> <span class="count">${c.lignes.length}</span></h3>
          ${c.lignes.map(l => carte(l, false))}</section>`)}</div>`}
    ${hors.length ? html`<details class="sv-hors"><summary class="small strong"><span>En pause ou refus</span> <span class="count">${hors.length}</span></summary>
      <div class="sv-hors-l">${hors.map(l => html`<div class="sv-hors-i" key=${l.id}><span class="tag done">${nomEtape(type, l.etape)}</span>${carte(l, false)}</div>`)}</div></details>` : null}
    ${fiche ? html`<${FicheSuivi} key=${fiche.id || 'nouvelle'} ctx=${ctx} type=${type} suivi=${suivi} ligne=${fiche.id ? fiche : null} preset=${fiche.id ? {} : fiche} onClose=${() => setFiche(null)}/>` : null}
  </section>`;
}

// La fiche d'une ligne : créer, modifier, changer d'étape, supprimer
const VIDE = { nom: '', ecole_slug: '', ville: '', contact_nom: '', contact_role: '', contact: '', etape: 'a_contacter', prochaine_action: '', prochaine_le: '',
  formule: '', montant_dh: '', referent_ok: false, accord_nom: false, cndp_ok: false, notes: '' };
export function FicheSuivi({ ctx, type, suivi, ligne, preset = {}, onClose }) {
  const nouvelle = !ligne;
  const [f, setF] = useState(() => {
    const x = { ...VIDE, ...preset };
    for (const k of Object.keys(VIDE)) if (ligne && ligne[k] !== undefined && ligne[k] !== null) x[k] = typeof VIDE[k] === 'string' ? String(ligne[k]) : ligne[k];
    return x;
  });
  const [slugLibre, setSlugLibre] = useState(!!(ligne?.ecole_slug || preset.ecole_slug));
  const set = (k, v) => setF(x => {
    const n = { ...x, [k]: v };
    if (k === 'nom' && type === 'ecole' && !slugLibre) n.ecole_slug = slugEcole(v);
    if (k === 'formule' && formule(v)) n.montant_dh = String(formule(v).prix);
    return n;
  });
  const nomOk = f.nom.trim().length >= 2 && f.nom.trim().length <= 120;
  const slugOk = type !== 'ecole' || !f.ecole_slug || slugValide(f.ecole_slug);
  const montantOk = f.montant_dh === '' || (/^\d+$/.test(String(f.montant_dh).trim()) && Number(f.montant_dh) <= 1000000);
  const ok = nomOk && slugOk && montantOk;
  const etapes = [...ETAPES[type], ...ETAPES_HORS];
  const enregistrer = e => {
    e.preventDefault();
    if (!ok) return;
    const txt = k => String(f[k] || '').trim() || null;
    const row = { nom: f.nom.trim(), ville: txt('ville'), contact_nom: txt('contact_nom'), contact_role: txt('contact_role'), contact: txt('contact'), etape: f.etape,
      prochaine_action: txt('prochaine_action'), prochaine_le: f.prochaine_le || null, notes: txt('notes'),
      ...(type === 'ecole' ? { ecole_slug: f.ecole_slug || null, referent_ok: !!f.referent_ok, accord_nom: !!f.accord_nom, cndp_ok: !!f.cndp_ok }
        : { formule: f.formule || null, montant_dh: f.montant_dh === '' ? null : Number(f.montant_dh) }) };
    ctx.act(async () => {
      if (nouvelle) await suivi.inserer({ type, ...row }); else await suivi.modifier(ligne.id, row);
      toast('Suivi enregistré.'); onClose();
    });
  };
  const supprimer = () => ctx.confirm('Supprimer cette ligne du suivi ?', () => ctx.act(async () => { await suivi.supprimer(ligne.id); toast('Ligne supprimée.'); onClose(); }), 'Supprimer');
  const titre = nouvelle ? (type === 'ecole' ? 'Nouvelle école' : 'Nouveau partenaire') : ligne.nom;
  const pied = html`<div class="row sv-pied">${nouvelle ? null : html`<button type="button" class="btn ghost sv-suppr" onClick=${supprimer}><${Icon} name="trash" size=${16}/> Supprimer</button>`}
    <span class="spacer"></span><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button type="submit" form="sv-fiche" class="btn primary" id="sv-ok" disabled=${!ok}>Enregistrer</button></div>`;
  return html`<${Modal} title=${titre} onClose=${onClose} footer=${pied}>
    <form class="form" id="sv-fiche" onSubmit=${enregistrer}>
      <${Field} label=${type === 'ecole' ? 'Nom de l’école' : 'Nom de l’entreprise'} err=${nomOk || !f.nom ? null : '2 à 120 caractères.'}>
        <input id="sv-nom" required minlength="2" maxlength="120" list=${type === 'ecole' ? 'sv-suggestions' : null} value=${f.nom} onInput=${e => set('nom', e.target.value)} placeholder=${type === 'ecole' ? 'Ex. ENSA Fès' : ''}/>
      <//>
      ${type === 'ecole' ? html`<datalist id="sv-suggestions">${SUGGESTIONS.map(n => html`<option value=${n}/>`)}</datalist>
        <${Field} label="Identifiant" err=${slugOk ? null : 'Identifiant invalide.'} hint="Tiré du nom : lettres minuscules, chiffres et tirets (2 à 40). Il ne change plus ensuite.">
          <input id="sv-slug" dir="ltr" maxlength="40" value=${f.ecole_slug} onInput=${e => { setSlugLibre(true); set('ecole_slug', e.target.value.toLowerCase()); }}/><//>` : null}
      <div class="grid2">
        <${Field} label="Ville"><input id="sv-ville" maxlength="80" value=${f.ville} onInput=${e => set('ville', e.target.value)}/><//>
        <${Field} label="Étape"><select id="sv-etape" value=${f.etape} onChange=${e => set('etape', e.target.value)}>${etapes.map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select><//>
      </div>
      <fieldset class="sv-groupe"><legend class="field-label">Contact</legend>
        <div class="grid2">
          <${Field} label="Nom du contact"><input id="sv-contact-nom" maxlength="120" value=${f.contact_nom} onInput=${e => set('contact_nom', e.target.value)}/><//>
          <${Field} label="Son rôle"><input id="sv-contact-role" maxlength="120" value=${f.contact_role} onInput=${e => set('contact_role', e.target.value)}/><//>
        </div>
        <${Field} label="Email ou téléphone"><input id="sv-contact" dir="ltr" maxlength="200" value=${f.contact} onInput=${e => set('contact', e.target.value)}/><//>
      </fieldset>
      ${type === 'partenaire' ? html`<div class="grid2">
        <${Field} label="Formule" hint="Choisir une formule remplit le montant."><select id="sv-formule" value=${f.formule} onChange=${e => set('formule', e.target.value)}>
          <option value="">Aucune</option>${FORMULES.map(x => html`<option value=${x.k}>${x.nom}</option>`)}</select><//>
        <${Field} label="Montant (DH)" err=${montantOk ? null : 'Un nombre entier, sans espace.'}><input id="sv-montant" inputmode="numeric" dir="ltr" value=${f.montant_dh} onInput=${e => set('montant_dh', e.target.value)}/><//>
      </div>` : null}
      <div class="grid2">
        <${Field} label="Prochaine action"><input id="sv-action" maxlength="200" value=${f.prochaine_action} onInput=${e => set('prochaine_action', e.target.value)} placeholder="Ex. Relancer par WhatsApp"/><//>
        <${Field} label="Le"><input id="sv-date" type="date" value=${f.prochaine_le} onInput=${e => set('prochaine_le', e.target.value)}/><//>
      </div>
      ${type === 'ecole' ? html`<fieldset class="sv-groupe"><legend class="field-label">Conditions pour ouvrir</legend>
        ${CONDITIONS_ECOLE.map(([k, l]) => html`<label class="sv-case"><input type="checkbox" id=${'sv-' + k} checked=${!!f[k]} onChange=${e => set(k, e.target.checked)}/> <span>${l}</span></label>`)}
      </fieldset>` : null}
      <${Field} label="Notes"><textarea id="sv-notes" rows="3" maxlength="2000" value=${f.notes} onInput=${e => set('notes', e.target.value)}></textarea><//>
    </form>
  <//>`;
}

// ---------------------------------------------------------------------------
// Les réseaux des écoles
// ---------------------------------------------------------------------------
function CarteReseau({ ctx, e, membres, suivi, absente, onSuivi }) {
  const siens = membres.filter(p => ecoleDe(p) === e.slug);
  const lau = siens.filter(p => p.role === 'laureat').length, etu = siens.filter(p => p.role === 'etudiant').length;
  const dernier = siens.map(p => p.created_at).filter(Boolean).sort().pop();
  const s = suiviDe(suivi.lignes, e.slug);
  const pret = pretAOuvrir(s);
  const origine = e.slug === ECOLE_DEFAUT;
  const ouvrir = () => ctx.confirm(`Ouvrir le réseau « ${e.nom} » ? Ses étudiants et ses lauréats pourront s’inscrire.`, () => ctx.act(async () => {
    await ctx.ecoles.modifier(e.slug, { ouverte: true });
    if (s && s.etape !== 'ouvert') await suivi.modifier(s.id, { etape: 'ouvert' });
    toast('Réseau ouvert : ses étudiants et ses lauréats peuvent s’inscrire.');
  }), 'Ouvrir le réseau', { cls: 'btn primary' });
  const fermer = () => ctx.confirm(`Fermer le réseau « ${e.nom} » ? Les nouvelles inscriptions sont bloquées ; les membres déjà inscrits gardent leur compte.`, () => ctx.act(async () => {
    await ctx.ecoles.modifier(e.slug, { ouverte: false });
    toast('Réseau fermé aux nouvelles inscriptions. Les membres gardent leur compte.');
  }), 'Fermer le réseau');
  return html`<article class="ec-reseau" data-slug=${e.slug} aria-labelledby=${'ec-r-' + e.slug}>
    <div class="ec-reseau-tete"><strong id=${'ec-r-' + e.slug} translate="no" dir="auto">${e.nom}</strong>
      <span class=${'tag ' + (e.ouverte ? 'ec-ouvert' : 'ec-ferme')}>${e.ouverte ? 'Ouvert' : 'Fermé'}</span></div>
    ${siens.length ? html`<p class="small ec-chiffres">${`${siens.length} membre${siens.length > 1 ? 's' : ''} · ${lau} lauréat${lau > 1 ? 's' : ''} · ${etu} étudiant${etu > 1 ? 's' : ''}`}</p>
      ${dernier ? html`<p class="small muted ec-dernier"><span>Dernière inscription :</span> <span>${timeAgo(dernier)}</span></p>` : null}`
      : html`<p class="small muted">Pas encore de membre.</p>`}
    ${origine ? html`<p class="small muted">Le réseau d’origine reste toujours ouvert.</p>`
      : absente ? null
      : e.ouverte ? html`<div class="adm-msg-act"><button type="button" class="btn small ghost ec-fermer" onClick=${fermer}><${Icon} name="lock" size=${15}/> Fermer le réseau</button></div>`
      : html`<div class="ec-ouvrir">
          ${pret ? null : html`<p class="small strong ec-pour">Pour ouvrir :</p><ul class="ec-manque" id=${'ec-manque-' + e.slug}>${CONDITIONS_ECOLE.map(([k, l]) => html`<li class=${s?.[k] ? 'ok' : ''}><span class="sv-check-ico" aria-hidden="true">${s?.[k] ? html`<${Icon} name="check" size=${14}/>` : null}</span><span>${l}</span></li>`)}</ul>`}
          <div class="adm-msg-act">
            <button type="button" class="btn small tonal ec-ouvrir-btn" id=${'ec-ouvrir-' + e.slug} disabled=${!pret} aria-describedby=${pret ? null : 'ec-manque-' + e.slug} onClick=${ouvrir}><${Icon} name="check" size=${15}/> Ouvrir le réseau</button>
            ${pret ? null : html`<button type="button" class="btn small ghost ec-completer" onClick=${() => onSuivi(e, s)}>Compléter le suivi</button>`}
          </div></div>`}
  </article>`;
}

function CreerEcole({ ctx, ecoles, suivi, onClose }) {
  const [nom, setNom] = useState('');
  const [slug, setSlug] = useState(null); // null : tiré du nom
  const s = slug ?? slugEcole(nom);
  const pris = ecoles.ecoles.some(e => e.slug === s);
  const ok = nom.trim().length >= 2 && nom.trim().length <= 120 && slugValide(s) && !pris;
  const creer = ev => {
    ev.preventDefault();
    if (!ok) return;
    ctx.act(async () => {
      await ecoles.inserer({ slug: s, nom: nom.trim(), ouverte: false });
      if (!suiviDe(suivi.lignes, s)) await suivi.inserer({ type: 'ecole', nom: nom.trim(), ecole_slug: s, etape: 'a_contacter' });
      toast('École créée, réseau fermé.'); onClose();
    });
  };
  const pied = html`<div class="row-end"><button type="button" class="btn ghost" onClick=${onClose}>Annuler</button><button type="submit" form="ec-creer-f" class="btn primary" id="ec-creer-ok" disabled=${!ok}>Créer</button></div>`;
  return html`<${Modal} title="Créer une école" onClose=${onClose} footer=${pied}>
    <form class="form" id="ec-creer-f" onSubmit=${creer}>
      <${Field} label="Nom de l’école"><input id="ec-nom" required minlength="2" maxlength="120" list="ec-suggestions" value=${nom} onInput=${e => setNom(e.target.value)} placeholder="Ex. ENSA Fès"/><//>
      <datalist id="ec-suggestions">${SUGGESTIONS.map(n => html`<option value=${n}/>`)}</datalist>
      <${Field} label="Identifiant" err=${pris ? 'Cet identifiant est déjà pris.' : s && !slugValide(s) ? 'Identifiant invalide.' : null} hint="Tiré du nom : lettres minuscules, chiffres et tirets (2 à 40). Il ne change plus ensuite.">
        <input id="ec-slug" dir="ltr" maxlength="40" value=${s} onInput=${e => setSlug(e.target.value.toLowerCase())}/><//>
      <p class="small hint-box"><${Icon} name="lock" size=${15}/> <span>Le réseau est créé fermé. Il s’ouvre une fois les trois conditions remplies dans le suivi.</span></p>
    </form>
  <//>`;
}

function MessageEcole({ ctx, suivi }) {
  const [a, setA] = useState('etudiants');
  const [nom, setNom] = useState('');
  const cle = nom.trim().toLowerCase();
  const ligne = cle ? (suivi.lignes || []).find(l => l.type === 'ecole' && l.nom.trim().toLowerCase() === cle) : null;
  const email = ligne && lienContact(ligne.contact)?.startsWith('mailto:') ? ligne.contact.trim() : '';
  const c = chiffresReseau(ctx.data, Date.now(), ctx.saison);
  const noms = [...new Set([...(suivi.lignes || []).filter(l => l.type === 'ecole').map(l => l.nom), ...SUGGESTIONS])];
  const textes = l => messageEcole(c, { ecole: nom, a, signature: ctx.me?.full_name || '', lien: lienSite(l) });
  return html`<${CarteMessage} id="ec-message" titre="Message pour une école" icone="mail" textes=${textes} email=${{ a: email, sujet: textes('fr').sujet }}
    aide="Qui nous sommes, les vrais chiffres du réseau, la proposition et un appel de 20 minutes.">
    <${Field} label="École"><input id="ec-msg-ecole" list="ec-msg-noms" maxlength="120" value=${nom} onInput=${e => setNom(e.target.value)} placeholder="Ex. ENSA Fès"/><//>
    <datalist id="ec-msg-noms">${noms.map(n => html`<option value=${n}/>`)}</datalist>
    <${Puces} items=${DESTINATAIRES} value=${a} onChange=${setA} label="Destinataire" id="ec-msg-dest"/>
  <//>`;
}

export function EcolesAdmin({ ctx }) {
  const ecoles = useEcoles(ctx);
  const suivi = useTableAdmin(ctx, 'admin_suivi');
  const [creer, setCreer] = useState(false);
  const [fiche, setFiche] = useState(null);
  const membres = (ctx.data.profiles || []).filter(p => p.role !== 'admin');
  // « Compléter le suivi » : la fiche de l'école, ou une nouvelle fiche déjà remplie avec son nom
  const completer = (e, s) => { setFiche(s || { nom: e.nom, ecole_slug: e.slug }); document.getElementById('ec-suivi')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
  const c = { ...ctx, ecoles };
  return html`<div class="adm-ecoles">
    <section class="panel adm-tete" id="ec-regles">
      <h2 class="h-ico"><${Icon} name="ecole"/> Avant d’ouvrir une école</h2>
      <ul class="ec-regles">
        <li><${Icon} name="people" size=${18}/><span>Un réseau ne s’ouvre au nom d’une école qu’avec une personne de cette école, et avec l’accord écrit de l’école ou de son association pour son nom.</span></li>
        <li><${Icon} name="lock" size=${18}/><span>Le dossier CNDP couvre l’ENSAM Meknès : chaque nouvelle école y est ajoutée avant d’ouvrir.</span></li>
      </ul>
    </section>
    <section class="panel" id="ec-reseaux" aria-labelledby="ec-reseaux-t">
      <div class="section-head"><h2 class="h-ico" id="ec-reseaux-t"><${Icon} name="network"/> Réseaux <span class="count">${ecoles.ecoles.length}</span></h2>
        ${ecoles.absente ? null : html`<button type="button" class="btn small tonal" id="ec-creer" onClick=${() => setCreer(true)}><${Icon} name="plus" size=${15}/> Créer une école</button>`}</div>
      ${ecoles.absente ? html`<p class="small muted" id="ec-absente">Les réseaux des autres écoles arrivent avec la prochaine mise à jour de la base.</p>` : null}
      <div class="ec-grille">${ecoles.ecoles.map(e => html`<${CarteReseau} key=${e.slug} ctx=${c} e=${e} membres=${membres} suivi=${suivi} absente=${ecoles.absente} onSuivi=${completer}/>`)}</div>
    </section>
    <${SuiviTableau} ctx=${ctx} type="ecole" suivi=${suivi} id="ec-suivi" titre="Suivi des écoles" icone="route" ajouter="Ajouter une école"
      vide="Personne à contacter pour l’instant : ajoute une école." fiche=${fiche} setFiche=${setFiche}/>
    <${MessageEcole} ctx=${ctx} suivi=${suivi}/>
    ${creer ? html`<${CreerEcole} ctx=${ctx} ecoles=${ecoles} suivi=${suivi} onClose=${() => setCreer(false)}/>` : null}
  </div>`;
}

injectCSS('admin-ecoles', `
.ec-regles { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .5rem; }
.ec-regles li { display: flex; gap: .6rem; align-items: flex-start; color: var(--ink-2); font-size: var(--fs-3); line-height: 1.5; }
.ec-regles li > .ico { flex: none; margin-top: .15rem; color: var(--accent); }
.ec-grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: var(--sp-3); }
.ec-reseau { display: flex; flex-direction: column; gap: .45rem; padding: .9rem 1rem; border-radius: var(--r-md); background: var(--surface-2); min-width: 0; }
.ec-reseau p { margin: 0; }
.ec-reseau-tete { display: flex; align-items: center; justify-content: space-between; gap: .5rem; min-width: 0; }
.ec-reseau-tete strong { min-width: 0; overflow-wrap: anywhere; }
.tag.ec-ouvert { background: var(--good-soft); color: var(--good); }
.tag.ec-ferme { background: var(--surface); color: var(--muted); box-shadow: inset 0 0 0 1px var(--line); }
.ec-manque { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .3rem; font-size: var(--fs-2); color: var(--ink-2); }
.ec-manque li { display: flex; gap: .45rem; align-items: flex-start; }
.ec-manque li.ok { color: var(--good); }
.ec-ouvrir { display: flex; flex-direction: column; gap: .45rem; }
.sv-check-ico { flex: none; display: inline-grid; place-items: center; inline-size: 18px; block-size: 18px; border-radius: 5px; box-shadow: inset 0 0 0 1.5px var(--line-strong); background: var(--surface); color: var(--good); }
.ok > .sv-check-ico, .sv-check.ok .sv-check-ico { box-shadow: inset 0 0 0 1.5px var(--good); background: var(--good-soft); }
/* Le suivi */
.sv-tableau { display: grid; grid-template-columns: repeat(6, minmax(150px, 1fr)); gap: .5rem; overflow-x: auto; min-width: 0; padding-bottom: .2rem; }
.sv-col { display: flex; flex-direction: column; gap: .45rem; padding: .55rem; border-radius: var(--r-md); background: var(--surface-2); min-width: 0; }
.sv-col-t { display: flex; align-items: center; justify-content: space-between; gap: .4rem; margin: 0; font-size: var(--fs-2); font-weight: 650; color: var(--ink-2); }
.sv-col-l { display: flex; flex-direction: column; gap: .45rem; }
.sv-liste { display: flex; flex-direction: column; gap: .9rem; }
.sv-etape { display: flex; flex-direction: column; gap: .5rem; }
.sv-carte { display: flex; flex-direction: column; gap: .35rem; padding: .65rem .7rem; border-radius: var(--r-md); background: var(--surface); box-shadow: var(--sh1); min-width: 0; }
.sv-liste .sv-carte, .sv-hors .sv-carte { background: var(--surface-2); box-shadow: none; }
.sv-carte p { margin: 0; }
.sv-tete { display: flex; flex-direction: column; gap: .05rem; min-width: 0; }
.sv-nom { font-size: var(--fs-3); overflow-wrap: anywhere; text-align: start; min-height: 0; }
.sv-contact { display: flex; flex-direction: column; gap: .05rem; color: var(--ink-2); min-width: 0; overflow-wrap: anywhere; }
.sv-lien { color: var(--blue-text); text-decoration: none; font-weight: 600; overflow-wrap: anywhere; }
.sv-formule { display: flex; flex-wrap: wrap; gap: .3rem .5rem; align-items: center; }
.tag.sv-tag { background: var(--accent-soft); color: var(--sel-ink); }
.sv-action { display: flex; gap: .35rem; align-items: flex-start; color: var(--ink-2); }
.sv-action > .ico { flex: none; margin-top: .1rem; color: var(--muted); }
.sv-action-txt { display: flex; flex-direction: column; gap: .05rem; min-width: 0; overflow-wrap: anywhere; }
.sv-date { color: var(--muted); font-weight: 600; }
.sv-action.retard > .ico, .sv-retard { color: var(--warn); }
.sv-retard { font-weight: 650; }
.sv-checks { display: flex; flex-direction: column; gap: .2rem; }
.sv-check { display: flex; align-items: center; gap: .45rem; min-height: 32px; padding: .15rem .3rem; border: 0; border-radius: var(--r-sm); background: transparent; color: var(--ink-2); font-size: var(--fs-2); text-align: start; cursor: pointer; }
.sv-check:hover { background: color-mix(in srgb, var(--surface-2) 70%, transparent); }
.sv-check.ok { color: var(--good); }
.sv-carte:not(.compact) .sv-check { min-height: 40px; }
.sv-notes { white-space: pre-wrap; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.sv-act { display: flex; justify-content: space-between; align-items: center; gap: .2rem; margin-top: .1rem; }
.sv-carte:not(.compact) .sv-act .icon-btn { width: 44px; height: 44px; }
.sv-act .icon-btn:disabled { opacity: .35; cursor: default; }
.sv-hors { border-top: 1px solid var(--line); padding-top: .6rem; }
.sv-hors > summary { cursor: pointer; display: flex; align-items: center; gap: .4rem; min-height: 40px; }
.sv-hors-l { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: .5rem; margin-top: .5rem; }
.sv-hors-i { display: flex; flex-direction: column; gap: .3rem; align-items: flex-start; }
.sv-hors-i > .sv-carte { align-self: stretch; }
.sv-groupe { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .6rem; min-width: 0; }
.sv-case { display: flex; align-items: center; gap: .55rem; min-height: 44px; cursor: pointer; }
.sv-case input { inline-size: 20px; block-size: 20px; }
.sv-pied { inline-size: 100%; gap: .5rem; flex-wrap: wrap; }
.sv-suppr { color: var(--bad); }
`);
