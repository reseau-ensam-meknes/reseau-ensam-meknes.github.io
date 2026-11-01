// Rappels de visite : après quelques jours sans visite, ce qui attend vraiment le membre (vrais chiffres),
// de plus en plus espacés. Ici, les mots de la case « Rappels et résumé du dimanche » de Mon profil, la ligne de la page
// Confidentialité et la page du lien « Ne plus recevoir ces rappels » des emails. La base choisit qui et quand (rappels_dus).
// Ce lien décoche toute la case (se_desabonner_rappels : notif_push.rappels = false) : le résumé du dimanche sur le
// téléphone (notification « semaine ») s'arrête aussi, et la page le dit avant et après.
import { html, useState } from './vendor/preact-htm.js';
import { Icon, BrandLogo } from './ui.js';
import { addAR } from './i18n.js';

// La case couvre aussi le résumé du dimanche (notification « semaine ») : ta semaine en une ligne, avec les vrais chiffres
const FIN = 'De plus en plus espacés ; sans notifications activées, par email une fois par semaine au plus. Le dimanche matin, ta semaine en une ligne.';
const TITRE = 'Rappels et résumé du dimanche';
export const RAPPELS_NOTIF = {
  etudiant: [TITRE, `Après quelques jours sans visite, ce qui t’attend : messages, Match, propositions d’aide, réponses à tes questions, événements, nouvelles offres. ${FIN}`],
  laureat: [TITRE, `Après quelques jours sans visite, ce qui t’attend : messages, Match, réponses à tes questions, événements, demandes d’étudiants, candidatures, mentorats qui attendent ta réponse. ${FIN}`],
};
export const PHRASE_VISITE = 'La date de ta dernière visite, pour ne t’envoyer un rappel qu’après quelques jours sans visite, et seulement si quelque chose t’attend.';

addAR({
  Rappels: 'التذكيرات',
  [TITRE]: 'التذكيرات وملخص الأحد',
  [RAPPELS_NOTIF.etudiant[1]]: 'بعد أيام دون زيارة، ما ينتظرك: الرسائل، التوافق، عروض المساعدة، الأجوبة على أسئلتك، الأنشطة، العروض الجديدة. تتباعد شيئًا فشيئًا؛ وإن لم تفعّل الإشعارات، عبر البريد مرة في الأسبوع على الأكثر. وصباح كل أحد، أسبوعك في سطر واحد.',
  [RAPPELS_NOTIF.laureat[1]]: 'بعد أيام دون زيارة، ما ينتظرك: الرسائل، التوافق، الأجوبة على أسئلتك، الأنشطة، طلبات الطلبة، الترشيحات، الإرشادات التي تنتظر ردك. تتباعد شيئًا فشيئًا؛ وإن لم تفعّل الإشعارات، عبر البريد مرة في الأسبوع على الأكثر. وصباح كل أحد، أسبوعك في سطر واحد.',
  [PHRASE_VISITE]: 'تاريخ زيارتك الأخيرة، كي لا يصلك تذكير إلا بعد أيام دون زيارة، وفقط إن كان شيء ينتظرك.',
  'Tu ne veux plus recevoir de rappels quand quelque chose t’attend ?': 'لا تريد تلقي تذكيرات عندما ينتظرك شيء؟',
  'Le résumé du dimanche sur le téléphone s’arrêtera aussi.': 'سيتوقف أيضًا ملخص الأحد على الهاتف.',
  'C’est fait : plus de rappels, ni par email ni sur le téléphone.': 'تم: لا تذكيرات بعد الآن، لا عبر البريد ولا على الهاتف.',
  'Le résumé du dimanche sur le téléphone s’arrête aussi ; les autres emails et notifications ne changent pas. Pour les réactiver : « Rappels et résumé du dimanche », dans « Mon profil ».': 'يتوقف أيضًا ملخص الأحد على الهاتف، ولا تتغير الرسائل والإشعارات الأخرى. لإعادتها: «التذكيرات وملخص الأحد» في «ملفي الشخصي».',
  'Ce lien n’est plus valable. Connecte-toi et décoche « Rappels et résumé du dimanche » dans « Mon profil ».': 'لم يعد هذا الرابط صالحًا. سجّل الدخول وألغِ تحديد «التذكيرات وملخص الأحد» من «ملفي الشخصي».',
});

// #desabo/<jeton>/rappels : page publique, un bouton, sans connexion
export function DesaboRappels({ store, token }) {
  const [state, setState] = useState(token ? 'ask' : 'ko'); // ask | busy | ok | ko
  const go = async () => { setState('busy'); setState(await store.seDesabonnerRappels(token).catch(() => false) ? 'ok' : 'ko'); };
  return html`<div class="auth-card desabo">
    <${BrandLogo} size=${52}/>
    <h1>Rappels</h1>
    ${state === 'ask' || state === 'busy' ? html`<p>Tu ne veux plus recevoir de rappels quand quelque chose t’attend ?</p>
      <p class="small muted">Le résumé du dimanche sur le téléphone s’arrêtera aussi.</p>
      <button class="btn primary" id="desabo-rappels" disabled=${state === 'busy'} onClick=${go}>${state === 'busy' ? '…' : 'Me désabonner'}</button>` : null}
    ${state === 'ok' ? html`<p class="verify-ok"><${Icon} name="check"/> C’est fait : plus de rappels, ni par email ni sur le téléphone.</p><p class="small muted">Le résumé du dimanche sur le téléphone s’arrête aussi ; les autres emails et notifications ne changent pas. Pour les réactiver : « Rappels et résumé du dimanche », dans « Mon profil ».</p>` : null}
    ${state === 'ko' ? html`<p class="verify-ko">Ce lien n’est plus valable. Connecte-toi et décoche « Rappels et résumé du dimanche » dans « Mon profil ».</p>` : null}
    <a class="btn ghost" href="#accueil">Aller sur la plateforme</a>
  </div>`;
}
