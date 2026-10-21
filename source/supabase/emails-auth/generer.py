import os, html
OUT = '/mnt/project-files/plateforme-ensam/supabase/emails-auth'

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

def page(fr, ar):
    return f'''<!doctype html>
<html><body style="margin:0;padding:0;background:#F3F6FA">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F6FA;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #D7DFE9">
    <tr><td style="background:#1F3354;padding:16px 24px;border-bottom:4px solid #F39200;border-radius:13px 13px 0 0">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle">
          <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:17px;line-height:22px;font-weight:700;color:#FFFFFF">Réseau ENSAM Meknès</div>
          <div dir="rtl" lang="ar" style="font-family:Tahoma,'Segoe UI',Arial,sans-serif;font-size:13px;line-height:19px;color:#C8D3E3;text-align:left">شبكة ENSAM مكناس</div>
        </td>
      </tr></table>
    </td></tr>
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
  'Bienvenue ! Confirme ton adresse · مرحبا! أكّد بريدك',
  bloc('fr', 'Bienvenue dans le réseau', 'Merci de t’être inscrit(e). Confirme ton adresse email pour activer ton compte.', 'Confirmer mon adresse', 'Tu ne t’es pas inscrit(e) ? Ignore cet email.', U),
  bloc('ar', 'مرحبا بك في الشبكة', 'شكرا على تسجيلك. أكّد بريدك الإلكتروني لتفعيل حسابك.', 'تأكيد بريدي', 'لم تسجّل؟ تجاهل هذه الرسالة.', U)),
 ('magic-link', 'Magic Link',
  'Ton lien de connexion · رابط الدخول',
  bloc('fr', 'Ton lien de connexion', 'Clique sur le bouton pour te connecter. Le lien ne marche qu’une fois.', 'Me connecter', 'Ce n’est pas toi ? Ignore cet email.', U),
  bloc('ar', 'رابط الدخول', 'اضغط على الزر لتسجيل الدخول. الرابط صالح لمرة واحدة.', 'تسجيل الدخول', 'لست أنت؟ تجاهل هذه الرسالة.', U)),
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
for slug, tpl, sujet, fr, ar in mails:
    open(os.path.join(OUT, slug + '.html'), 'w').write(page(fr, ar))
    idx.append(f'| {tpl} | {sujet} | {slug}.html |')
open(os.path.join(OUT, 'LISEZMOI.md'), 'w').write('\n'.join(idx) + '\n')
print('\n'.join(idx))
