// Après build.sh : une petite page par promo, dist/promo/AAAA/ (français) et dist/promo/AAAA/ar/ (arabe).
// WhatsApp, LinkedIn et Facebook lisent ses balises og sans exécuter de JavaScript : l'aperçu nomme la promo et
// montre l'entrée dessinée (img/apercu-promo.jpg, outils/generer-apercu.mjs). Une personne, elle, est envoyée
// tout de suite vers l'application avec ?promo=AAAA (et &lang=ar). Les promos sont celles qu'accepte le lien
// d'invitation (regles-entree.js) : la sortie ne dépend pas de la date, la CI compare dist/ et la racine.
// Pas de meta refresh : certains robots le suivent et montreraient l'aperçu de la page d'accueil.
import fs from 'node:fs'; import path from 'node:path';
import { PROMO_MIN as PREMIERE, PROMO_MAX as DERNIERE } from '../src/regles-entree.js';
const dist = path.resolve(process.argv[2] || 'dist');
// Adresse publique du site : celle de l'image d'aperçu de page.html (une seule source)
const page = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const site = (page.match(/property="og:image" content="(https:\/\/[^"]+?\/)img\//) || [])[1];
if (!site) throw new Error('pages-promo : og:image introuvable dans index.html');
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const TXT = {
  fr: { lang: 'fr', dir: 'ltr', locale: 'fr_FR', titre: a => `Promo ${a} · tes camarades sont sur le Réseau`,
    desc: 'Le réseau des lauréats et des étudiants de l’ENSAM Meknès : stages, PFE, emplois et conseils entre nous. Inscription gratuite, ta promo est déjà indiquée.',
    site: 'Réseau ENSAM Meknès', alt: 'Dessin de l’entrée de l’ENSAM Meknès', ouvrir: 'Ouvrir le Réseau ENSAM Meknès' },
  ar: { lang: 'ar', dir: 'rtl', locale: 'ar_MA', titre: a => `دفعة ${a} · زملاؤك على الشبكة`,
    desc: 'شبكة خريجي وطلبة ENSAM مكناس: تداريب، مشاريع نهاية الدراسة، وظائف ونصائح بيننا. التسجيل مجاني، ودفعتك محدَّدة مسبقًا.',
    site: 'شبكة ENSAM مكناس', alt: 'رسم لمدخل ENSAM مكناس', ouvrir: 'فتح شبكة ENSAM مكناس' },
};
function html(a, l) {
  const t = TXT[l], ici = `${site}promo/${a}/${l === 'ar' ? 'ar/' : ''}`, vers = `${l === 'ar' ? '../../../' : '../../'}?promo=${a}${l === 'ar' ? '&lang=ar' : ''}`;
  return `<!doctype html>
<html lang="${t.lang}" dir="${t.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script>location.replace(${JSON.stringify(vers)}+location.hash)</script>
<title>${esc(t.titre(a))}</title>
<meta name="description" content="${esc(t.desc)}">
<meta name="robots" content="noindex">
<link rel="canonical" href="${ici}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${t.site}">
<meta property="og:url" content="${ici}">
<meta property="og:title" content="${esc(t.titre(a))}">
<meta property="og:description" content="${esc(t.desc)}">
<meta property="og:image" content="${site}img/apercu-promo.jpg">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(t.alt)}">
<meta property="og:locale" content="${t.locale}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1670A8">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F3F6FA;color:#13213A;font:16px/1.5 system-ui,sans-serif}a{color:#135F8F;font-weight:600}@media (prefers-color-scheme:dark){body{background:#0B1320;color:#E6ECF5}a{color:#7DBBEA}}</style>
</head>
<body><p><a href="${esc(vers)}">${esc(t.ouvrir)}</a></p></body>
</html>
`;
}
fs.rmSync(path.join(dist, 'promo'), { recursive: true, force: true });
let n = 0;
for (let a = PREMIERE; a <= DERNIERE; a++) for (const l of ['fr', 'ar']) {
  const d = path.join(dist, 'promo', String(a), l === 'ar' ? 'ar' : '');
  fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'index.html'), html(a, l)); n++;
}
console.log(`pages de promo : ${n} (${PREMIERE}-${DERNIERE}, fr et ar)`);
