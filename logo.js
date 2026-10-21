// Logo de la plateforme, dessiné dans un carré de 512. Les couleurs passent par des variables CSS
// pour suivre la tuile (sombre ou claire) et le dessin de l'école : --lg-o orange, --lg-b bleu,
// --lg-k trait principal, --lg-in fond du disque, --lg-cap et --lg-cap2 la toque, --lg-bg la tuile.
// outils/generer-logos.mjs en tire les images (emails, icônes de l'application, favicon).
export const LOGO = 'roue';

const v = (n, d) => `var(--lg-${n},${d})`;
const f = (n, d) => `style="fill:${v(n, d)}"`;

function engrenage(cx, cy, ro, rr, n, trou) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2, w = Math.PI / n;
    [[rr, a - w * 0.62], [ro, a - w * 0.38], [ro, a + w * 0.38], [rr, a + w * 0.62]].forEach(([r, t], k) => {
      d += `${i === 0 && k === 0 ? 'M' : 'L'}${(cx + r * Math.cos(t)).toFixed(1)} ${(cy + r * Math.sin(t)).toFixed(1)}`;
    });
  }
  return d + `ZM${cx + trou} ${cy}A${trou} ${trou} 0 1 0 ${cx - trou} ${cy}A${trou} ${trou} 0 1 0 ${cx + trou} ${cy}Z`;
}

function etoile(cx, cy, r) {
  const carre = a => [0, 1, 2, 3].map(k => { const t = a + k * Math.PI / 2; return `${(cx + r * Math.cos(t)).toFixed(1)},${(cy + r * Math.sin(t)).toFixed(1)}`; }).join(' ');
  return `<polygon points="${carre(Math.PI / 4)}" ${f('k', '#1F3354')}/><polygon points="${carre(0)}" ${f('k', '#1F3354')}/>`;
}

export const GLYPHS = {
  // Roue des Arts et Métiers et toque des diplômés
  roue: `<path d="${engrenage(256, 258, 188, 156, 10, 122)}" fill-rule="evenodd" ${f('o', '#F39200')}/>`
    + `<circle cx="256" cy="258" r="122" ${f('in', '#1F3354')}/>`
    + `<path d="M256 190 358 232 256 274 154 232Z" ${f('cap', '#FFFFFF')}/>`
    + `<path d="M198 252V294Q256 326 314 294V252L256 276Z" ${f('cap2', '#E3EAF4')}/>`
    + `<path d="M256 232 338 250V302" fill="none" stroke-width="9" stroke-linecap="round" style="stroke:${v('b', '#4FA9E6')}"/>`
    + `<circle cx="338" cy="308" r="12" ${f('b', '#4FA9E6')}/>`,
  // La porte de Meknès (arc en fer à cheval) et l'étoile marocaine
  bab: `<path d="M180 400V316A112 112 0 1 1 332 316V400" fill="none" stroke-width="34" stroke-linejoin="round" style="stroke:${v('o', '#F39200')}"/>`
    + etoile(256, 236, 58)
    + `<circle cx="256" cy="236" r="16" ${f('bg', '#FFFFFF')}/>`
    + `<rect x="124" y="400" width="264" height="24" rx="12" ${f('b', '#1B7DBF')}/>`,
  // Un M (Meknès) fait de membres reliés
  reseau: `<polyline points="150,372 180,150 256,272 332,150 362,372" fill="none" stroke-width="30" stroke-linejoin="round" stroke-linecap="round" style="stroke:${v('k', '#1F3354')}"/>`
    + `<circle cx="150" cy="372" r="32" ${f('b', '#1B7DBF')}/><circle cx="362" cy="372" r="32" ${f('b', '#1B7DBF')}/>`
    + `<circle cx="180" cy="150" r="34" ${f('o', '#F39200')}/><circle cx="332" cy="150" r="34" ${f('o', '#F39200')}/>`
    + `<circle cx="256" cy="272" r="38" ${f('k', '#1F3354')}/><circle cx="256" cy="272" r="18" ${f('o', '#F39200')}/>`,
};

// Couleurs de la tuile sombre (logo principal) et de la tuile claire (en-tête des emails)
export const SOMBRE = '--lg-o:#F7A11A;--lg-b:#4FA9E6;--lg-k:#FFFFFF;--lg-in:transparent;--lg-cap:#FFFFFF;--lg-cap2:#DCE6F3;--lg-bg:#1D3150';
export const CLAIR = '--lg-o:#F39200;--lg-b:#1B7DBF;--lg-k:#1F3354;--lg-in:#1F3354;--lg-cap:#FFFFFF;--lg-cap2:#E3EAF4;--lg-bg:#FFFFFF';
export const TUILE_DEFS = '<defs><linearGradient id="lg-tuile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#27497A"/><stop offset="1" stop-color="#16253F"/></linearGradient></defs>';
export const TUILE = '<rect width="512" height="512" rx="116" fill="url(#lg-tuile)"/>';

export const glyph = (k = LOGO) => GLYPHS[k];
