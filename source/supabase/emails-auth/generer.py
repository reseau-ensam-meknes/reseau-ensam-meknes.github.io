import os, html
OUT = os.path.dirname(os.path.abspath(__file__))

def bloc(lang, titre, texte, bouton, apres, url):
    rtl = lang == 'ar'
    d = ' dir="rtl"' if rtl else ''
    al = 'right' if rtl else 'left'
    ff = "Tahoma, 'Segoe UI', Arial, sans-serif" if rtl else "'Segoe UI', Helvetica, Arial, sans-serif"
    btn = ''
    if bouton:
        btn = f'''<p style="margin:22px 0;text-align:{al}"><a href="{url}" style="display:inline-block;background:#1670A8;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">{bouton}</a></p>'''
    return f'''<div lang="{lang}"{d} style="text-align:{al};font-family:{ff}">
      <h1 style="margin:0 0 10px;font-size:20px;color:#1F3354">{titre}</h1>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#42506A">{texte}</p>
      {btn}
      <p style="margin:{'0' if bouton else '14px 0 0'};font-size:13px;line-height:1.6;color:#66748A">{apres}</p>
    </div>'''

def page(fr, ar, apercu='', code=False):
    cache = f'<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">{apercu}</div>' if apercu else ''
    ligne = f'''<tr><td style="padding:24px 26px 0;text-align:center">
      <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:#66748A">Ton code · <span lang="ar" dir="rtl" style="font-family:Tahoma,Arial,sans-serif">رمزك</span></div>
      <div dir="ltr" style="margin:6px auto 0;display:inline-block;padding:10px 18px;border:1px solid #D7DFE9;border-radius:12px;background:#F3F6FA;font-family:Consolas,'Courier New',monospace;font-size:34px;line-height:42px;letter-spacing:8px;font-weight:700;color:#1F3354">{T}</div>
    </td></tr>''' if code else ''
    return f'''<!doctype html>
<html><body style="margin:0;padding:0;background:#F3F6FA">{cache}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F6FA;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #D7DFE9">
    <tr><td style="background:#1F3354;padding:16px 24px;border-bottom:4px solid #F39200;border-radius:13px 13px 0 0">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle">
          <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:17px;line-height:22px;font-weight:700;color:#FFFFFF">Réseau ENSAM Meknès</div>
          <div dir="rtl" lang="ar" style="font-family:Tahoma,'Segoe UI',Arial,sans-serif;font-size:13px;line-height:19px;color:#C8D3E3;text-align:left">شبكة ENSAM مكناس</div>
        </td>
      </tr></table>
    </td></tr>{ligne}
    <tr><td style="padding:26px 26px 8px">{fr}</td></tr>
    <tr><td style="padding:0 26px"><hr style="border:none;border-top:1px solid #E9EEF4;margin:18px 0"></td></tr>
    <tr><td style="padding:8px 26px 26px">{ar}</td></tr>
  </table>
  <p style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#66748A;margin:14px 0 0">Réseau ENSAM Meknès · <a href="{{{{ .SiteURL }}}}" style="color:#1670A8">{{{{ .SiteURL }}}}</a></p>
</td></tr></table>
</body></html>
'''

U = '{{ .ConfirmationURL }}'
T = '{{ .Token }}'
mails = [
 ('reset-password', 'Reset Password',
  'Choisis un nouveau mot de passe · إعادة تعيين كلمة المرور',
  bloc('fr', 'Nouveau mot de passe', 'Tu as demandé à changer ton mot de passe. Clique sur le bouton pour en choisir un nouveau.', 'Choisir un nouveau mot de passe', 'Ce n’est pas toi ? Ignore simplement cet email, ton mot de passe reste le même.', U),
  bloc('ar', 'كلمة مرور جديدة', 'طلبت تغيير كلمة المرور. اضغط على الزر لاختيار كلمة مرور جديدة.', 'اختيار كلمة مرور جديدة', 'لست أنت؟ تجاهل هذه الرسالة، وستبقى كلمة المرور كما هي.', U)),
 ('confirm-signup', 'Confirm signup',
  '{{ .Token }} est ton code d’inscription · رمز التسجيل',
  bloc('fr', 'Bienvenue dans le réseau', 'Voici ton code pour créer ton compte. Entre-le sur la page du Réseau restée ouverte. Il marche une seule fois, pendant 1 heure.', None, 'Tu ne t’es pas inscrit(e) ? Ignore cet email.', U),
  bloc('ar', 'مرحبًا بك في الشبكة', 'هذا رمزك لإنشاء حسابك. أدخله في صفحة الشبكة التي بقيت مفتوحة. يعمل مرة واحدة فقط، لمدة ساعة.', None, 'لم تسجّل؟ تجاهل هذه الرسالة.', U),
  'Ton code : {{ .Token }} · رمزك: {{ .Token }}', True),
 ('magic-link', 'Magic Link',
  '{{ .Token }} est ton code de connexion · رمز الدخول',
  bloc('fr', 'Ton code de connexion', 'Entre ce code sur la page du Réseau restée ouverte. Il marche une seule fois, pendant 1 heure.', None, 'Tu n’as rien demandé ? Ignore cet email : sans ce code, personne ne peut entrer sur ton compte.', U),
  bloc('ar', 'رمز الدخول', 'أدخل هذا الرمز في صفحة الشبكة التي بقيت مفتوحة. يعمل مرة واحدة فقط، لمدة ساعة.', None, 'لم تطلب شيئًا؟ تجاهل هذه الرسالة: لا أحد يستطيع دخول حسابك بدون هذا الرمز.', U),
  'Ton code : {{ .Token }} · رمزك: {{ .Token }}', True),
 ('change-email', 'Change Email Address',
  'Confirme ta nouvelle adresse · أكّد بريدك الجديد',
  bloc('fr', 'Nouvelle adresse email', 'Confirme le passage de {{ .Email }} à {{ .NewEmail }} en cliquant sur le bouton.', 'Confirmer la nouvelle adresse', 'Ce n’est pas toi ? Ignore cet email, rien ne change.', U),
  bloc('ar', 'بريد إلكتروني جديد', 'أكّد تغيير بريدك من <span dir="ltr">{{ .Email }}</span> إلى <span dir="ltr">{{ .NewEmail }}</span> بالضغط على الزر.', 'تأكيد البريد الجديد', 'لست أنت؟ تجاهل هذه الرسالة، ولن يتغير شيء.', U)),
 ('invite', 'Invite user',
  'Tu es invité(e) sur Réseau ENSAM Meknès · دعوة إلى شبكة ENSAM مكناس',
  bloc('fr', 'Tu es invité(e)', 'On t’invite à rejoindre Réseau ENSAM Meknès, le réseau des lauréats et des étudiants. Clique pour créer ton compte.', 'Rejoindre le réseau', 'Tu ne connais pas ce réseau ? Ignore cet email.', U),
  bloc('ar', 'أنت مدعو', 'ندعوك للانضمام إلى شبكة ENSAM مكناس، شبكة الخريجين والطلبة. اضغط لإنشاء حسابك.', 'الانضمام إلى الشبكة', 'لا تعرف هذه الشبكة؟ تجاهل هذه الرسالة.', U)),
 ('reauthentication', 'Reauthentication',
  'Ton code de confirmation · رمز التأكيد',
  bloc('fr', 'Ton code de confirmation', f'Saisis ce code pour confirmer : <strong style="font-size:20px;letter-spacing:3px;color:#1F3354">{T}</strong>', None, 'Ce n’est pas toi ? Ignore cet email.', U),
  bloc('ar', 'رمز التأكيد', f'أدخل هذا الرمز للتأكيد: <strong dir="ltr" style="font-size:20px;letter-spacing:3px;color:#1F3354">{T}</strong>', None, 'لست أنت؟ تجاهل هذه الرسالة.', U)),
]
idx = ['# Emails de compte Supabase (FR + AR)', '', 'Supabase > Authentication > Emails > Templates. Pour chaque modèle : coller le sujet, puis tout le contenu du fichier HTML dans « Message body », puis Save.', '', '| Modèle Supabase | Sujet | Fichier |', '|---|---|---|']
for slug, tpl, sujet, fr, ar, *opt in mails:
    open(os.path.join(OUT, slug + '.html'), 'w').write(page(fr, ar, *opt))
    idx.append(f'| {tpl} | {sujet} | {slug}.html |')
idx += ['', '## Inscription et connexion par code à 6 chiffres', '',
        'Les emails « Magic Link » et « Confirm signup » contiennent le code, sans aucun lien (un antivirus de messagerie qui ouvre les liens rendrait le code inutilisable). Les coller avant de publier le site.', '',
        '- Authentication > Sign In / Providers > Email : Confirm email OFF (inchangé), Email OTP Length = 6, Email OTP Expiration = 3600 (les emails disent « 1 heure »).',
        '- Authentication > Rate Limits : emails envoyés 100 par heure ; vérifications de code et connexions au moins 150 par 5 minutes et par IP (toute une classe sur le Wi-Fi de l’école a la même IP).',
        '- Authentication > SMTP Settings : expéditeur « Réseau ENSAM Meknès », intervalle minimum par adresse 60 secondes.']
open(os.path.join(OUT, 'LISEZMOI.md'), 'w').write('\n'.join(idx) + '\n')
print('\n'.join(idx))
