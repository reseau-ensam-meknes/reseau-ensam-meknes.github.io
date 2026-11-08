// Après build.sh : une petite page par promo, dist/promo/AAAA/ (français) et dist/promo/AAAA/ar/ (arabe).
// WhatsApp, LinkedIn et Facebook lisent ses balises og sans exécuter de JavaScript : l'aperçu nomme la promo et
// montre l'entrée dessinée (img/apercu-promo.jpg, outils/generer-apercu.mjs). Une personne, elle, est envoyée
// tout de suite vers l'application avec ?promo=AAAA (et &lang=ar, et &de=… : le code de qui invite, invitation nommée,
// et &ecole=… : l'école du lien quand ce n'est pas l'ENSAM Meknès, écrite comme l'accepte ecoleValide). Ces pages
// nomment l'ENSAM Meknès. Les liens d'une autre école (avecEcole, regles-entree.js) mènent à leurs pages neutres,
// dist/promo/AAAA/e/ et dist/promo/AAAA/ar/e/ : les mêmes, sans nom d'école (« Réseau ENSAM », « de ton école »,
// img/apercu-promo-neutre.jpg : une entrée dont la porte dit « ENSAM »), qui envoient vers l'application de la même façon.
// Jamais sous un chemin qui finit par promo/AAAA/ : le service worker d'avant ces pages (sur les appareils qui ne sont pas
// revenus depuis) refait cette adresse sans &ecole=, et la personne arriverait à l'ENSAM Meknès.
// Les autres liens d'une autre école (une offre, une question, le site : avecEcole) mènent à dist/e.html, la page neutre du
// site, à côté d'index.html : le même aperçu, sans promo, qui envoie vers le site avec toute l'adresse (?…, #…).
// Les promos sont celles qu'accepte le lien d'invitation (regles-entree.js) : la sortie ne dépend pas de la date,
// la CI compare dist/ et la racine.
// Pas de meta refresh : certains robots le suivent et montreraient l'aperçu de la page d'accueil.
// L'image montre l'entrée de l'école : la description commence donc par dire que le Réseau est indépendant de l'école
// (WhatsApp n'en montre que le début).
import fs from 'node:fs'; import path from 'node:path';
import { PROMO_MIN as PREMIERE, PROMO_MAX as DERNIERE, ECOLE_MOTIF } from '../src/regles-entree.js';
const dist = path.resolve(process.argv[2] || 'dist');
// Adresse publique du site : celle de l'image d'aperçu de page.html (une seule source)
const page = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const site = (page.match(/property="og:image" content="(https:\/\/[^"]+?\/)img\//) || [])[1];
if (!site) throw new Error('pages-promo : og:image introuvable dans index.html');
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const TXT = {
  fr: { lang: 'fr', dir: 'ltr', locale: 'fr_FR', titre: a => `Promo ${a} · tes camarades sont sur le Réseau`,
    desc: 'Initiative de lauréats, indépendante de l’école : stages, PFE, emplois et conseils entre lauréats et étudiants de l’ENSAM Meknès. Inscription gratuite, ta promo est déjà indiquée.',
    site: 'Réseau ENSAM Meknès', alt: 'Dessin de l’entrée de l’ENSAM Meknès', ouvrir: 'Ouvrir le Réseau ENSAM Meknès' },
  ar: { lang: 'ar', dir: 'rtl', locale: 'ar_MA', titre: a => `دفعة ${a} · زملاؤك على الشبكة`,
    desc: 'مبادرة من الخريجين، مستقلة عن إدارة المدرسة: تداريب، مشاريع نهاية الدراسة، وظائف ونصائح بين خريجي وطلبة ENSAM مكناس. التسجيل مجاني، ودفعتك محدَّدة مسبقًا.',
    site: 'شبكة ENSAM مكناس', alt: 'رسم لمدخل ENSAM مكناس', ouvrir: 'فتح شبكة ENSAM مكناس' },
};
// Les pages neutres (liens d'une autre école que l'ENSAM Meknès) : aucun nom d'école, jamais celui d'une école pas encore ouverte
const NEUTRE = {
  fr: { ...TXT.fr, desc: 'Initiative de lauréats, indépendante de l’école : stages, PFE, emplois et conseils entre lauréats et étudiants de ton école. Inscription gratuite, ta promo est déjà indiquée.',
    site: 'Réseau ENSAM', alt: 'Dessin d’une entrée d’école', ouvrir: 'Ouvrir le Réseau ENSAM' },
  ar: { ...TXT.ar, desc: 'مبادرة من الخريجين، مستقلة عن إدارة المدرسة: تداريب، مشاريع نهاية الدراسة، وظائف ونصائح بين خريجي وطلبة مدرستك. التسجيل مجاني، ودفعتك محدَّدة مسبقًا.',
    site: 'شبكة ENSAM', alt: 'رسم لمدخل مدرسة', ouvrir: 'فتح شبكة ENSAM' },
};
function html(a, l, neutre = false) {
  const t = (neutre ? NEUTRE : TXT)[l], ici = `${site}promo/${a}/${l === 'ar' ? 'ar/' : ''}${neutre ? 'e/' : ''}`;
  const vers = `${'../'.repeat(2 + (l === 'ar') + neutre)}?promo=${a}${l === 'ar' ? '&lang=ar' : ''}`;
  return `<!doctype html>
<html lang="${t.lang}" dir="${t.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script>var q=location.search,d=/[?&]de=([a-z0-9]{8})(?:&|$)/.exec(q),e=/[?&]ecole=(${ECOLE_MOTIF})(?:&|$)/.exec(q);location.replace(${JSON.stringify(vers)}+(e?"&ecole="+e[1]:"")+(d?"&de="+d[1]:"")+location.hash)</script>
<title>${esc(t.titre(a))}</title>
<meta name="description" content="${esc(t.desc)}">
<meta name="robots" content="noindex">
<link rel="canonical" href="${ici}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${t.site}">
<meta property="og:url" content="${ici}">
<meta property="og:title" content="${esc(t.titre(a))}">
<meta property="og:description" content="${esc(t.desc)}">
<meta property="og:image" content="${site}img/${neutre ? 'apercu-promo-neutre' : 'apercu-promo'}.jpg">
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
for (let a = PREMIERE; a <= DERNIERE; a++) for (const l of ['fr', 'ar']) for (const neutre of [false, true]) {
  const d = path.join(dist, 'promo', String(a), l === 'ar' ? 'ar' : '', neutre ? 'e' : '');
  fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'index.html'), html(a, l, neutre)); n++;
}
console.log(`pages de promo : ${n} (${PREMIERE}-${DERNIERE}, fr et ar, celles de l'ENSAM Meknès et leurs pages neutres)`);

// La page neutre du site (e.html) : ce que montre l'aperçu d'un lien d'une autre école qui n'est pas celui d'une promo. Comme
// index.html, en français ; son script envoie vers le site avec toute l'adresse (l'école, la langue, la route en #).
const desc = 'Initiative de lauréats, indépendante de l’école : stages, PFE, emplois, conseils et entraide entre lauréats et étudiants de ton école.';
fs.writeFileSync(path.join(dist, 'e.html'), `<!doctype html>
<html lang="fr" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script>location.replace("./"+location.search+location.hash)</script>
<title>Réseau ENSAM</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex">
<link rel="canonical" href="${site}e.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Réseau ENSAM">
<meta property="og:url" content="${site}e.html">
<meta property="og:title" content="Réseau ENSAM">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${site}img/apercu-promo-neutre.jpg">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(NEUTRE.fr.alt)}">
<meta property="og:locale" content="fr_FR">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1670A8">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F3F6FA;color:#13213A;font:16px/1.5 system-ui,sans-serif}a{color:#135F8F;font-weight:600}@media (prefers-color-scheme:dark){body{background:#0B1320;color:#E6ECF5}a{color:#7DBBEA}}</style>
</head>
<body><p><a href="./">${esc(NEUTRE.fr.ouvrir)}</a></p></body>
</html>
`);
console.log('page neutre du site : e.html');
