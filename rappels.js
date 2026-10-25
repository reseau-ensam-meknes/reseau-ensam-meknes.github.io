// Rappels de visite : après quelques jours sans visite, ce qui attend vraiment le membre (vrais chiffres),
// de plus en plus espacés. Ici, les mots de la case « Rappels » de Mon profil, la ligne de la page Confidentialité
// et la page du lien « Ne plus recevoir ces rappels » des emails. La base choisit qui et quand (rappels_dus).
import { html, useState } from './vendor/preact-htm.js';
import { Icon, BrandLogo } from './ui.js';
import { addAR } from './i18n.js';

const FIN = 'De plus en plus espacés ; sans notifications activées, par email une fois par semaine au plus.';
export const RAPPELS_NOTIF = {
  etudiant: ['Rappels', `Après quelques jours sans visite, ce qui t’attend : messages, propositions d’aide, nouvelles offres. ${FIN}`],
  laureat: ['Rappels', `Après quelques jours sans visite, ce qui t’attend : messages, demandes d’étudiants, candidatures, mentorats qui attendent ta réponse. ${FIN}`],
};
export const PHRASE_VISITE = 'La date de ta dernière visite, pour ne t’envoyer un rappel qu’après quelques jours sans visite, et seulement si quelque chose t’attend.';

addAR({
  Rappels: 'التذكيرات',
  [RAPPELS_NOTIF.etudiant[1]]: 'بعد أيام دون زيارة، ما ينتظرك: الرسائل، عروض المساعدة، العروض الجديدة. تتباعد شيئًا فشيئًا؛ وإن لم تفعّل الإشعارات، عبر البريد مرة في الأسبوع على الأكثر.',
  [RAPPELS_NOTIF.laureat[1]]: 'بعد أيام دون زيارة، ما ينتظرك: الرسائل، طلبات الطلبة، الترشيحات، الإرشادات التي تنتظر ردك. تتباعد شيئًا فشيئًا؛ وإن لم تفعّل الإشعارات، عبر البريد مرة في الأسبوع على الأكثر.',
  [PHRASE_VISITE]: 'تاريخ زيارتك الأخيرة، كي لا يصلك تذكير إلا بعد أيام دون زيارة، وفقط إن كان شيء ينتظرك.',
  'Tu ne veux plus recevoir de rappels quand quelque chose t’attend ?': 'لا تريد تلقي تذكيرات عندما ينتظرك شيء؟',
  'C’est fait : plus de rappels, ni par email ni sur le téléphone.': 'تم: لا تذكيرات بعد الآن، لا عبر البريد ولا على الهاتف.',
  'Les autres emails et notifications ne changent pas. Tu peux réactiver les rappels dans « Mon profil ».': 'لا تتغير الرسائل والإشعارات الأخرى. يمكنك إعادة تفعيل التذكيرات من «ملفي الشخصي».',
  'Ce lien n’est plus valable. Connecte-toi et décoche « Rappels » dans « Mon profil ».': 'لم يعد هذا الرابط صالحًا. سجّل الدخول وألغِ تحديد «التذكيرات» من «ملفي الشخصي».',
});

// #desabo/<jeton>/rappels : page publique, un bouton, sans connexion
export function DesaboRappels({ store, token }) {
  const [state, setState] = useState(token ? 'ask' : 'ko'); // ask | busy | ok | ko
  const go = async () => { setState('busy'); setState(await store.seDesabonnerRappels(token).catch(() => false) ? 'ok' : 'ko'); };
  return html`<div class="auth-card desabo">
    <${BrandLogo} size=${52}/>
    <h1>Rappels</h1>
    ${state === 'ask' || state === 'busy' ? html`<p>Tu ne veux plus recevoir de rappels quand quelque chose t’attend ?</p>
      <button class="btn primary" id="desabo-rappels" disabled=${state === 'busy'} onClick=${go}>${state === 'busy' ? '…' : 'Me désabonner'}</button>` : null}
    ${state === 'ok' ? html`<p class="verify-ok"><${Icon} name="check"/> C’est fait : plus de rappels, ni par email ni sur le téléphone.</p><p class="small muted">Les autres emails et notifications ne changent pas. Tu peux réactiver les rappels dans « Mon profil ».</p>` : null}
    ${state === 'ko' ? html`<p class="verify-ko">Ce lien n’est plus valable. Connecte-toi et décoche « Rappels » dans « Mon profil ».</p>` : null}
    <a class="btn ghost" href="#accueil">Aller sur la plateforme</a>
  </div>`;
}
