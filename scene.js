// Illustration de l'entrée de l'école : la porte triangulaire, les massifs fleuris, les bâtiments blancs.
// Dessin original en SVG. Les couleurs viennent du CSS (.sky, thème clair ou sombre) et le mouvement
// aussi (nuages, oiseaux, arbres, étudiants qui marchent vers la porte), coupé si l'appareil le demande.

import { glyph } from './logo.js';

const r1 = n => Math.round(n * 10) / 10;

function building(x, y, w, h, rows = 2) {
  let s = `<rect class="b-body" x="${x}" y="${y}" width="${w}" height="${h}"/><rect class="b-shade" x="${x + w - 10}" y="${y}" width="10" height="${h}"/><rect class="b-top" x="${x - 3}" y="${y - 5}" width="${w + 6}" height="6" rx="1"/>`;
  const n = Math.max(1, Math.floor((w - 14) / 20));
  const gap = (w - 14) / n;
  const wh = Math.min(24, (h - 14) / rows - 9);
  for (let r = 0; r < rows; r++) for (let c = 0; c < n; c++) {
    const wx = x + 4 + c * gap + (gap - 9) / 2, wy = y + 9 + r * (wh + 9);
    s += `<path class="b-win" d="M${r1(wx)} ${r1(wy + wh)}V${r1(wy + 4.5)}a4.5 4.5 0 0 1 9 0V${r1(wy + wh)}Z"/>`;
  }
  return s;
}

const cypress = (x, h) => `<g class="sc-tree" style="animation-delay:${r1(-(x % 7))}s"><rect class="t-trunk" x="${x - 1.5}" y="292" width="3" height="8"/><ellipse class="t-2" cx="${x}" cy="${292 - h / 2}" rx="${r1(h * 0.17)}" ry="${h / 2}"/><ellipse class="t-hi" cx="${x - h * 0.05}" cy="${292 - h / 2}" rx="${r1(h * 0.07)}" ry="${r1(h * 0.4)}"/></g>`;

const roundTree = (x, s = 1) => `<g class="sc-tree" style="animation-delay:${r1(-(x % 5))}s"><rect class="t-trunk" x="${x - 2.5 * s}" y="${300 - 24 * s}" width="${5 * s}" height="${24 * s}"/>`
  + `<circle class="t-2" cx="${x - 12 * s}" cy="${300 - 26 * s}" r="${12 * s}"/><circle class="t-2" cx="${x + 12 * s}" cy="${300 - 27 * s}" r="${12 * s}"/><circle class="t-1" cx="${x}" cy="${300 - 36 * s}" r="${17 * s}"/><circle class="t-hi" cx="${x - 5 * s}" cy="${300 - 42 * s}" r="${6 * s}"/></g>`;

function palm(x, h, lean = 1) {
  const tx = x + 10 * lean, ty = 300 - h;
  const fronds = [[-30, -6], [-24, 10], [-12, 16], [14, 15], [26, 9], [31, -5], [2, -14]]
    .map(([dx, dy]) => `<path class="t-palm" d="M${tx} ${ty}q${r1(dx * 0.5)} ${r1(dy * 0.5 - 10)} ${dx} ${dy}"/>`).join('');
  return `<g class="sc-tree palm" style="animation-delay:${r1(-(x % 6))}s"><path class="t-stem" d="M${x} 300Q${x + 2 * lean} ${300 - h * 0.6} ${tx} ${ty}"/>${fronds}<circle class="t-2" cx="${tx}" cy="${ty + 1}" r="3"/></g>`;
}

// Massifs de fleurs jaunes et orange de part et d'autre de l'allée (comme devant la vraie entrée).
function flowerBeds() {
  const pathX = y => 372 - (y - 300) * (172 / 120); // bord gauche de l'allée
  const gap = y => 3 + (y - 300) * 0.06;
  const width = y => 24 + (y - 300) * 1.55;
  const soil = [[300, 300], [430, 420]].map(([y]) => [pathX(y) - gap(y) + 1, pathX(y) - gap(y) - width(y) - 4, y]);
  const polyL = `${r1(soil[0][0])},300 ${r1(soil[0][1])},300 ${r1(soil[1][1])},420 ${r1(soil[1][0])},420`;
  const polyR = polyL.split(' ').map(p => { const [a, b] = p.split(','); return `${r1(800 - a)},${b}`; }).join(' ');
  let s = `<polygon class="bed" points="${polyL}"/><polygon class="bed" points="${polyR}"/>`;
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const y = 303 + 99 * t * (0.55 + 0.45 * t);
    const d = y - 300, r = 1.7 + d * 0.042, step = r * 2.25;
    const n = Math.floor(width(y) / step);
    let row = '';
    for (let k = 0; k < n; k++) {
      const x = pathX(y) - gap(y) - r - k * step - (i % 2 ? step / 2 : 0);
      const c = 'fl' + (((k * 7 + i * 3) % 5) % 3 + 1);
      row += `<circle class="${c}" cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}"/><circle class="${c}" cx="${r1(800 - x)}" cy="${r1(y)}" r="${r1(r)}"/>`;
    }
    s += `<g class="sc-row" style="animation-delay:${(0.25 + t * 0.9).toFixed(2)}s">${row}</g>`;
  }
  return s;
}

// Étudiants vus de dos, qui remontent l'allée vers la porte (sac orange, pull bleu, et inversement).
const walker = (cls, delay) => `<g class="sc-walk ${cls}" style="animation-delay:${delay}s"><g class="sc-step">`
  + '<rect class="w-leg l1" x="-5" y="-12" width="4" height="12" rx="2"/><rect class="w-leg l2" x="1" y="-12" width="4" height="12" rx="2"/>'
  + '<rect class="w-body" x="-7" y="-29" width="14" height="19" rx="5.5"/><rect class="w-bag" x="-5" y="-27" width="10" height="12" rx="3"/>'
  + '<circle class="w-head" cx="0" cy="-35" r="6.2"/></g></g>';

const STARS = [[40, 40, 1.4], [120, 90, 1], [190, 30, 1.6], [260, 120, 1], [330, 60, 1.2], [470, 24, 1.5], [520, 110, 1], [590, 40, 1.1], [730, 140, 1.3], [770, 50, 1], [-120, 70, 1.3], [-260, 30, 1], [-420, 100, 1.4], [880, 90, 1.2], [960, 30, 1.5], [1100, 110, 1], [-600, 50, 1.2], [1250, 60, 1.3],
  [90, -60, 1.2], [230, -150, 1.5], [380, -40, 1], [520, -210, 1.3], [640, -90, 1.1], [760, -170, 1.4], [30, -230, 1], [300, -260, 1.2], [700, -280, 1], [450, -120, 1.6]];

function cloud(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path class="cl" d="M-58 0C-62-14-44-22-32-16-28-34-2-38 8-22 16-32 36-28 38-14 52-16 62-6 58 0Z"/></g>`;
}

const cache = {};
export function sceneMarkup(align = 'xMidYMax', fit = 'meet') {
  const key = align + fit;
  if (cache[key]) return cache[key];
  const bars = x0 => Array.from({ length: 11 }, (_, i) => `<rect class="iron" x="${x0 + 3 + i * 6.4}" y="237" width="2" height="58"/><path class="iron" d="M${x0 + 2 + i * 6.4} 238l2-5 2 5z"/>`).join('');
  const svg = `<svg viewBox="0 0 800 400" preserveAspectRatio="${align} ${fit}" focusable="false">
<defs>
  <radialGradient id="ss-glow"><stop offset="0" class="sun-st" stop-opacity=".55"/><stop offset="1" class="sun-st" stop-opacity="0"/></radialGradient>
  <radialGradient id="ss-lamp"><stop offset="0" stop-color="#FFD98A" stop-opacity=".9"/><stop offset="1" stop-color="#FFD98A" stop-opacity="0"/></radialGradient>
  <linearGradient id="ss-lawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="lawn-1"/><stop offset="1" class="lawn-2"/></linearGradient>
</defs>
<g class="sc-stars">${STARS.map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" style="animation-delay:${r1(-(i * 0.7) % 4)}s"/>`).join('')}</g>
<g class="sc-sun"><circle class="sc-halo" cx="655" cy="86" r="92" fill="url(#ss-glow)"/><circle class="sun" cx="655" cy="86" r="30"/><circle class="crater" cx="645" cy="78" r="6"/><circle class="crater" cx="664" cy="96" r="4.5"/><circle class="crater" cx="662" cy="74" r="3"/></g>
<g class="sc-cloud c1">${cloud(140, 70, 1)}</g><g class="sc-cloud c2">${cloud(420, 118, 0.7)}</g><g class="sc-cloud c3">${cloud(-60, 140, 0.85)}</g><g class="sc-cloud c4">${cloud(300, -48, 0.9)}</g>
<g class="sc-birds"><g class="sc-flock"><path class="bird" d="M0 0q5-5 10 0q5-5 10 0"/><path class="bird" d="M24 10q4-4 8 0q4-4 8 0"/><path class="bird" d="M-14 14q3.5-3.5 7 0q3.5-3.5 7 0"/></g></g>
<path class="mtn" d="M-1300 262L-1120 222-980 244-820 206-640 240-470 214-300 246-120 210 40 238 180 216 330 244 470 220 620 248 780 212 940 240 1100 218 1280 246 1460 222 1640 250 2100 236V320H-1300Z"/>
<path class="hill-1" d="M-1300 268C-1000 246-760 262-520 252S-120 236 120 254 520 236 760 250 1300 240 1600 256 2000 248 2100 252V320H-1300Z"/>
${building(-560, 226, 260, 74)}${building(-270, 218, 170, 82)}${roundTree(-320, 1.1)}${cypress(-90, 64)}
${building(30, 198, 230, 102)}${palm(10, 108, 1)}
${building(600, 152, 82, 148, 4)}${building(530, 196, 238, 104)}
${building(790, 214, 230, 86)}${building(1040, 224, 300, 76)}${roundTree(1030, 1.1)}${palm(790, 104, -1)}
${building(352, 244, 96, 56, 1)}
<rect class="hedge" x="-1300" y="288" width="1660" height="13" rx="6.5"/><rect class="hedge" x="440" y="288" width="1660" height="13" rx="6.5"/>
${roundTree(150, 0.95)}${roundTree(710, 1)}${cypress(268, 74)}${cypress(532, 70)}
<rect x="-1300" y="296" width="3400" height="140" fill="url(#ss-lawn)"/>
<path class="lawn-line" d="M-1300 330H2100M-1300 372H2100"/>
<path class="walk" d="M372 300H428L600 430H200Z"/><path class="walk-edge" d="M372 300 200 430M428 300 600 430"/>
<g class="gate-house"><rect class="b-body" x="230" y="250" width="44" height="50"/><rect class="b-shade" x="266" y="250" width="8" height="50"/><rect class="roof" x="226" y="245" width="52" height="6" rx="1"/><rect class="b-win" x="238" y="262" width="22" height="13" rx="1.5"/></g>
<g class="lamp"><circle class="lamp-glow" cx="566" cy="220" r="30" fill="url(#ss-lamp)"/><rect class="iron" x="564.5" y="222" width="3" height="78"/><path class="iron" d="M559 222h14l-3-7h-8z"/><rect class="lamp-bulb" x="563" y="216" width="6" height="5" rx="1.5"/></g>
<g class="sc-gate">
  <polygon class="g-frame" points="400,34 274,206 526,206"/><polygon class="g-in" points="400,66 300,196 500,196"/>
  <g class="g-logo" transform="translate(356.5 106.1) scale(.17)">${glyph()}</g>
  <rect class="g-pillar" x="306" y="222" width="20" height="78"/><rect class="g-pillar" x="474" y="222" width="20" height="78"/>
  <rect class="g-band" x="288" y="203" width="224" height="21"/><text class="g-txt" x="400" y="218" text-anchor="middle">ENSAM · MEKNÈS</text>
  <g class="sc-leaf l"><rect class="iron" x="326" y="236" width="74" height="3"/><rect class="iron" x="326" y="291" width="74" height="3"/>${bars(326)}</g>
  <g class="sc-leaf r"><rect class="iron" x="400" y="236" width="74" height="3"/><rect class="iron" x="400" y="291" width="74" height="3"/>${bars(400)}</g>
</g>
${flowerBeds()}
${walker('w1', 0)}${walker('w2', -9)}
</svg>`;
  return (cache[key] = svg);
}
