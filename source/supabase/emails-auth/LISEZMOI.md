# Emails de compte Supabase (FR + AR)

Supabase > Authentication > Emails > Templates. Pour chaque modèle : coller le sujet, puis tout le contenu du fichier HTML dans « Message body », puis Save.

| Modèle Supabase | Sujet | Fichier |
|---|---|---|
| Reset Password | Choisis un nouveau mot de passe · إعادة تعيين كلمة المرور | reset-password.html |
| Confirm signup | {{ .Token }} est ton code d’inscription · رمز التسجيل | confirm-signup.html |
| Magic Link | {{ .Token }} est ton code de connexion · رمز الدخول | magic-link.html |
| Change Email Address | Confirme ta nouvelle adresse · أكّد بريدك الجديد | change-email.html |
| Invite user | Tu es invité(e) sur Réseau ENSAM Meknès · دعوة إلى شبكة ENSAM مكناس | invite.html |
| Reauthentication | Ton code de confirmation · رمز التأكيد | reauthentication.html |

## Inscription et connexion par code à 6 chiffres

Les emails « Magic Link » et « Confirm signup » contiennent le code, sans aucun lien (un antivirus de messagerie qui ouvre les liens rendrait le code inutilisable). Les coller avant de publier le site.

- Authentication > Sign In / Providers > Email : Confirm email OFF (inchangé), Email OTP Length = 6, Email OTP Expiration = 3600 (les emails disent « 1 heure »).
- Authentication > Rate Limits : emails envoyés 100 par heure ; vérifications de code et connexions au moins 150 par 5 minutes et par IP (toute une classe sur le Wi-Fi de l’école a la même IP).
- Authentication > SMTP Settings : expéditeur « Réseau ENSAM Meknès », intervalle minimum par adresse 60 secondes.
