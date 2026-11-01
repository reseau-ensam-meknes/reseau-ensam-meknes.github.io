// Plan · vitesse et ambiance : le ciel du soir (scene.js et le script du haut de page.html, qui doivent dire la même chose)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { COUCHER, soirDe, coucherDu, minutesSoleil } from '../../src/scene.js';

const SRC = new URL('../../src/', import.meta.url);
const lireSrc = f => fs.readFileSync(new URL(f, SRC), 'utf8');
const utc = s => new Date(s + 'Z');

// Une date vue d'un téléphone réglé ailleurs (décalage en minutes, comme getTimezoneOffset : 240 = UTC-4, Montréal en été)
const ailleurs = (d, decalage) => {
  const local = new Date(d.getTime() - decalage * 60e3);
  return Object.assign(Object.create(Date.prototype), {
    getTime: () => d.getTime(), getTimezoneOffset: () => decalage,
    getHours: () => local.getUTCHours(), getMinutes: () => local.getUTCMinutes(),
    getUTCHours: () => d.getUTCHours(), getUTCMinutes: () => d.getUTCMinutes(), getUTCMonth: () => d.getUTCMonth(), getUTCDate: () => d.getUTCDate(),
    getUTCFullYear: () => d.getUTCFullYear(), toISOString: () => `${d.toISOString()} (décalage ${decalage})`,
  });
};

test('ciel du soir : une heure avant le coucher du soleil à Meknès, tenu une demi-heure, puis retour au jour à la nuit', () => {
  // 15 juin : coucher à 19 h 34 UTC (20 h 34 au Maroc)
  assert.equal(COUCHER.length, 12);
  assert.equal(coucherDu(utc('2026-06-15T12:00:00')), 1174);
  const a = h => soirDe(utc(`2026-06-15T${h}:00`));
  assert.equal(a('12:00'), 0);
  assert.equal(a('18:20'), 0);
  assert.equal(a('18:34'), 0);
  assert.equal(a('19:04'), 0.5);
  assert.equal(a('19:34'), 1);
  assert.equal(a('20:00'), 1);
  assert.equal(a('20:34'), 0.5);
  assert.equal(a('21:04'), 0);
  assert.equal(a('23:30'), 0);
  assert.equal(a('03:00'), 0);
  // En décembre, le soleil se couche à 17 h 15 UTC : à 17 h 15, le ciel du soir ; à 19 h 15, plus rien
  assert.equal(soirDe(utc('2026-12-15T17:15:00')), 1);
  assert.equal(soirDe(utc('2026-12-15T19:15:00')), 0);
  assert.ok(soirDe(utc('2026-12-15T16:40:00')) > 0 && soirDe(utc('2026-12-15T16:40:00')) < 0.5);
});

test('ciel du soir : aucun saut, ni d’une minute à l’autre, ni d’un mois à l’autre', () => {
  // Coucher entre deux mois : quelques minutes d'écart d'un jour à l'autre, jamais le saut du tableau
  for (let j = 0; j < 365; j++) {
    const d = new Date(Date.UTC(2026, 0, 1 + j, 12)), e = new Date(Date.UTC(2026, 0, 2 + j, 12));
    assert.ok(Math.abs(coucherDu(e) - coucherDu(d)) < 1.5, `coucher du ${d.toISOString().slice(0, 10)}`);
  }
  // Minute par minute autour du coucher : la valeur avance par petits pas (au plus 0,03 par minute)
  for (const jour of ['2026-01-31', '2026-03-20', '2026-06-21', '2026-09-22', '2026-12-31']) {
    let avant = soirDe(utc(`${jour}T15:00:00`));
    for (let m = 1; m < 6 * 60; m++) {
      const s = soirDe(new Date(utc(`${jour}T15:00:00`).getTime() + m * 60e3));
      assert.ok(s >= 0 && s <= 1);
      assert.ok(Math.abs(s - avant) <= 0.03, `${jour} + ${m} min : ${avant} → ${s}`);
      avant = s;
    }
  }
});

test('ciel du soir : l’heure du Maroc (UTC, ramadan compris) ; loin du Maroc, l’heure du téléphone', () => {
  const coucher = utc('2026-06-15T19:34:00');
  // Maroc (UTC+1, ou UTC+0 pendant le ramadan), France (UTC+2) : le soleil de Meknès, à l'heure UTC
  for (const decalage of [-60, 0, -120]) assert.equal(soirDe(ailleurs(coucher, decalage)), 1);
  assert.equal(minutesSoleil(ailleurs(coucher, -60)), 1174);
  // Montréal (UTC-4) : à 19 h 34 UTC il est 15 h 34, plein jour ; le soir vient à 20 h 34 sur le téléphone
  assert.equal(soirDe(ailleurs(coucher, 240)), 0);
  assert.equal(soirDe(ailleurs(utc('2026-06-16T00:34:00'), 240)), 1);
  // Tokyo (UTC+9) : à 20 h 34 sur le téléphone
  assert.equal(soirDe(ailleurs(utc('2026-06-15T11:34:00'), -540)), 1);
});

test('ciel du soir : le script du haut de page.html pose la même valeur que scene.js, avant l’affichage', () => {
  const page = lireSrc('page.html');
  const script = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('Le ciel du soir'));
  assert.ok(script, 'script du ciel introuvable dans page.html');
  const essayer = d => {
    const pose = {}; const racine = { style: { setProperty: (k, v) => { pose[k] = v; } }, dataset: {} };
    const FausseDate = Object.assign(function () { return d; }, { UTC: Date.UTC });
    vm.runInNewContext(script, { Date: FausseDate, Math, String, document: { documentElement: racine } });
    return { soir: pose['--soir'], ciel: racine.dataset.ciel };
  };
  let soirs = 0;
  for (let i = 0; i < 4000; i++) {
    // Des instants du soir de toute l'année (et quelques-uns ailleurs dans la journée)
    const jour = Date.UTC(2026, 0, 1) + Math.floor(i * 365 / 4000) * 86400e3;
    const d = new Date(jour + (i % 5 === 0 ? (i * 37) % 1440 : 16 * 60 + (i * 7) % 300) * 60e3);
    for (const date of [d, ailleurs(d, 240), ailleurs(d, -60)]) {
      const s = soirDe(date), h = essayer(date);
      if (s > 0) { soirs++; assert.deepEqual(h, { soir: String(s), ciel: 'soir' }, date.toISOString()); } else assert.deepEqual(h, { soir: undefined, ciel: undefined }, date.toISOString());
    }
  }
  assert.ok(soirs > 1000);
});

test('ciel du soir : seulement en thème clair ; le thème sombre garde sa nuit (--soir remis à 0)', () => {
  const page = lireSrc('page.html');
  assert.match(page, /:root\[data-ciel="soir"\] \.sky \{/);
  // Les deux règles du thème sombre (appareil en sombre, ou choix « sombre ») remettent --soir à 0
  const sombres = [...page.matchAll(/(?::root:not\(\[data-theme="light"\]\) \.sky|:root\[data-theme="dark"\] \.sky) \{([^}]*)\}/g)];
  assert.equal(sombres.length, 2);
  for (const [, corps] of sombres) assert.match(corps, /--soir: 0;/);
  // Le soir vient avant les règles sombres (même poids : la dernière l'emporte)
  assert.ok(page.indexOf(':root[data-ciel="soir"] .sky') < page.indexOf(':root[data-theme="dark"] .sky'));
});
