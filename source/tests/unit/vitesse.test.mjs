// Plan · vitesse et ambiance : le ciel du soir (scene.js et le script du haut de page.html, qui doivent dire la même chose)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
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

// ---------------------------------------------------------------------------
// Photos de profil gardées par le service worker (sw.js : clePhoto, taillerPhotos) et liens gardés avec la copie du compte
// ---------------------------------------------------------------------------
const SW = (() => {
  const ecoutes = {};
  const ctx = { self: { addEventListener: (t, f) => { (ecoutes[t] ||= []).push(f); }, registration: { scope: 'https://site.ma/' } }, location: new URL('https://site.ma/'), URL, caches: {} };
  vm.runInNewContext(lireSrc('sw.js'), ctx);
  return { ...ctx, ecoutes };
})();

test('photos : la clé du cache est l’adresse sans le jeton, seulement pour le stockage « photos »', () => {
  const sb = 'https://abc.supabase.co/storage/v1/object/sign/';
  assert.equal(SW.clePhoto(sb + 'photos/u1/photo-1.jpg?token=eyJ.a.b'), 'https://abc.supabase.co/storage/v1/object/sign/photos/u1/photo-1.jpg');
  assert.equal(SW.clePhoto(sb + 'photos/u1/photo-1.jpg?token=autre'), SW.clePhoto(sb + 'photos/u1/photo-1.jpg?token=eyJ.a.b'));
  assert.notEqual(SW.clePhoto(sb + 'photos/u1/photo-2.jpg?token=x'), SW.clePhoto(sb + 'photos/u1/photo-1.jpg?token=x'));
  // Jamais les CV, la messagerie, les fichiers publics ni le site lui-même
  for (const u of [sb + 'cv/u1/cv.pdf?token=x', sb + 'chat/a/b.jpg?token=x', 'https://abc.supabase.co/storage/v1/object/public/photos/u1/p.jpg',
    'https://abc.supabase.co/rest/v1/profiles?select=*', 'https://site.ma/img/logo.png', sb + 'photos/', 'pas une adresse']) assert.equal(SW.clePhoto(u), null, u);
  // Le service worker écoute toujours ses évènements (installation, activation, messages, deux « fetch », notifications)
  assert.equal(SW.ecoutes.fetch.length, 2);
  for (const t of ['install', 'activate', 'message', 'push', 'notificationclick']) assert.ok(SW.ecoutes[t]?.length, t);
});

test('photos : le service worker ne répond qu’aux photos demandées en GET, et garde les 300 dernières', async () => {
  const [photos, site] = SW.ecoutes.fetch;
  const repondu = req => { let r = null; photos({ request: req, respondWith: p => { r = p; } }); return r; };
  assert.equal(repondu({ method: 'GET', url: 'https://abc.supabase.co/storage/v1/object/sign/cv/u/cv.pdf?token=x' }), null);
  assert.equal(repondu({ method: 'POST', url: 'https://abc.supabase.co/storage/v1/object/sign/photos/u/p.jpg?token=x' }), null);
  // Le cache : 305 photos gardées dans l'ordre d'arrivée, il en reste 300, les plus récentes
  const cles = Array.from({ length: 305 }, (_, i) => `https://abc.supabase.co/storage/v1/object/sign/photos/u/${i}.jpg`);
  const cache = { liste: [...cles], keys: async () => [...cache.liste], delete: async k => { cache.liste = cache.liste.filter(x => x !== k); return true; } };
  await SW.taillerPhotos(cache);
  assert.equal(cache.liste.length, 300);
  assert.deepEqual(cache.liste, cles.slice(5));
  await SW.taillerPhotos(cache);
  assert.equal(cache.liste.length, 300);
  assert.equal(typeof site, 'function');
});

test('photos : les liens déjà obtenus partent avec la copie du compte, jamais ceux qui expirent bientôt ni les échecs', async () => {
  const { photosPourCache } = await import('../../src/store.js');
  const t = Date.UTC(2026, 10, 1, 12);
  const m = new Map([['u1/a.jpg', { url: 'https://x/a?token=1', fin: t + 4 * 3600e3 }], ['u2/b.jpg', { url: 'https://x/b?token=2', fin: t + 120e3 }],
    ['u3/c.jpg', { url: null, fin: t + 600e3 }], ['', { url: 'https://x/vide', fin: t + 3600e3 }]]);
  assert.deepEqual(photosPourCache(m, t), [['u1/a.jpg', { url: 'https://x/a?token=1', fin: t + 4 * 3600e3 }]]);
  assert.deepEqual(photosPourCache(undefined, t), []);
  assert.deepEqual(photosPourCache([['u1/a.jpg', { url: 'https://x/a', fin: t + 3600e3 }]], t).length, 1);
  const beaucoup = new Map(Array.from({ length: 450 }, (_, i) => [`u/${i}.jpg`, { url: `https://x/${i}`, fin: t + 3600e3 }]));
  const gardes = photosPourCache(beaucoup, t);
  assert.equal(gardes.length, 400); assert.equal(gardes[0][0], 'u/50.jpg');
});

// ---------------------------------------------------------------------------
// Données en deux temps (store.js) : d'abord l'accueil et la navigation, le reste juste après le premier affichage ;
// un écran qui lit une table pas encore arrivée l'attend, puis tout est là comme avant
// ---------------------------------------------------------------------------
const STORE = await import('../../src/store.js');

test('données en deux temps : PREMIERES et ENSUITE couvrent toutes les tables, chacune une seule fois ; les écrans qui les lisent', () => {
  const { TABLES, PREMIERES, ENSUITE, tablesEcran, tablesLien, pourCache } = STORE;
  assert.equal(new Set(TABLES).size, TABLES.length, 'TABLES sans doublon');
  assert.ok(ENSUITE.length > 0 && PREMIERES.length > 0);
  for (const t of ENSUITE) assert.ok(TABLES.includes(t), t);
  assert.deepEqual([...PREMIERES, ...ENSUITE].sort(), [...TABLES].sort());
  assert.equal(PREMIERES.filter(t => ENSUITE.includes(t)).length, 0);
  // Ce qui arrive en second n'est jamais gardé sur l'appareil : la copie de l'appareil n'a rien de moins qu'avant
  const pleine = Object.fromEntries(TABLES.map(t => [t, [{ id: t + '-1', author_id: 'moi', user_id: 'moi', student_id: 'moi', laureat_id: 'moi', created_at: '2026-10-01T10:00:00Z' }]]));
  const copie = pourCache(pleine, 'moi');
  for (const t of ENSUITE) assert.deepEqual(copie[t], [], `${t} n'est pas gardée sur l'appareil`);
  // Les écrans de l'application qui les attendent (app.js), et seulement eux
  const cas = [
    [['reseau', ''], ['groupe_messages']], [['reseau', 'groupes'], ['groupe_messages']],
    [['reseau', 'annuaire'], []], [['reseau', 'agenda'], []], [['reseau', 'entreprises'], []], [['reseau', 'etranger'], []], [['reseau', 'entraide'], []],
    [['messages', ''], ['reactions_messages']], [['messages', 'abc'], ['reactions_messages']],
    [['mentorat', 'cv'], ['relecture_commentaires']], [['mentorat', ''], []],
    [['admin', ''], ENSUITE], [['admin', 'moderation'], ENSUITE], [['profil', 'donnees'], []], [['profil', ''], []],
    [['accueil', ''], []], [['offres', ''], []], [['parcours', ''], []], [['espace', ''], []], [['suivi', ''], []], [['match', ''], []], [['confidentialite', ''], []],
  ];
  for (const [[page, sub], attendu] of cas) {
    const ts = tablesEcran(page, sub);
    assert.deepEqual(ts, attendu, `${page}/${sub}`);
    for (const t of ts) assert.ok(ENSUITE.includes(t), t);
  }
  // L'adresse de la page (un lien de notification) : ses tables viennent avec les premières
  assert.deepEqual(tablesLien('#messages/00000000-0000-4000-8000-0000000000b2'), ['reactions_messages']);
  assert.deepEqual(tablesLien('#reseau'), ['groupe_messages']);
  assert.deepEqual(tablesLien('#reseau/groupes/ville%3Ameknes'), ['groupe_messages']);
  assert.deepEqual(tablesLien('#mentorat/cv'), ['relecture_commentaires']);
  assert.deepEqual(tablesLien('#admin/moderation'), ENSUITE);
  for (const h of ['', '#', '#accueil', '#reseau/annuaire', '#offre/abc', '#%E0%A4%A', null, undefined]) assert.deepEqual(tablesLien(h), [], String(h));
});

// Garde-fou : un module qui se met à lire une table d'ENSUITE doit attendre qu'elle soit là (tablesEcran, store.attendre).
// Ceux-ci le font : leur écran attend dans app.js (messages, mentorat/cv, admin, Mes données) ou lui-même (groupes.js) ;
// logic.js ne les lit que pour l'administration (dernieresActions → parcoursInscription) ; le magasin et la démo les écrivent.
test('données en deux temps : seuls les écrans qui attendent lisent les tables d’ENSUITE', () => {
  const { ENSUITE } = STORE;
  const LISENT = { 'groupes.js': ['groupe_messages'], 'messages.js': ['reactions_messages'], 'cv.js': ['relecture_commentaires'], 'admin.js': ENSUITE,
    'privacy.js': ENSUITE, 'logic.js': ['groupe_messages'] };
  const ECRIVENT = /^(store|seed\d*|i18n-ar)\.js$/;
  let vus = 0;
  for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.js') && !ECRIVENT.test(f))) {
    const lues = ENSUITE.filter(t => new RegExp(`\\b${t}\\b`).test(lireSrc(f)));
    for (const t of lues) assert.ok((LISENT[f] || []).includes(t), `${f} lit ${t} : son écran doit l’attendre (tablesEcran ou store.attendre), puis ajoute-le ici`);
    vus += lues.length;
  }
  assert.ok(vus >= 6, 'les lectures connues sont bien trouvées');
  assert.match(lireSrc('groupes.js'), /store\.attendre\(\['groupe_messages'\]\)/);
  assert.match(lireSrc('app.js'), /store\.ecranEnAttente\(page, route\.sub\)/);
  assert.match(lireSrc('app.js'), /onglet === 'donnees' && store\.attendre\(ENSUITE\)/);
});

// Un faux client Supabase dont les lectures des tables d'ENSUITE attendent qu'on les lâche
function magasinEnDeux({ retenir = STORE.ENSUITE } = {}) {
  const s = new STORE.SupabaseStore({}); s.session = { user: { id: 'moi' } };
  const lus = [], tenues = new Map();
  const ligne = nom => (nom === 'profils' ? [{ id: 'moi', role: 'laureat', full_name: 'Moi' }] : nom === 'offers' ? [{ id: 'o1' }] : [{ id: nom + '-1', created_at: '2026-10-01T10:00:00Z' }]);
  s.sb = {
    from: nom => ({
      select: () => ({
        order: () => ({ range: () => {
          lus.push(nom);
          const rep = { data: ligne(nom), error: null };
          if (!retenir.includes(nom)) return Promise.resolve(rep);
          return new Promise(ok => tenues.set(nom, [...(tenues.get(nom) || []), (r = rep) => ok(r)]));
        } }),
        limit: async () => ({ error: null }),
      }),
    }),
    rpc: async () => ({ data: null, error: { message: 'pas dans ce test' } }),
    channel: () => { const c = { on: () => c, subscribe: () => c }; return c; },
  };
  let emis = 0; s.emit = () => { emis++; };
  // La plus ancienne lecture en attente (ou la plus récente)
  const lacher = (nom, r, { recente = false } = {}) => { const l = tenues.get(nom) || [], f = recente ? l.pop() : l.shift(); assert.ok(f, `lecture de ${nom} en attente`); f(r); };
  return { s, lus, lacher, emis: () => emis };
}
const tick = (ms = 0) => new Promise(ok => setTimeout(ok, ms));

test('données en deux temps : l’accueil n’attend pas les messages des groupes ; le reste part après le premier affichage ; le Réseau les attend', async () => {
  const { ENSUITE, PREMIERES } = STORE;
  const { s, lus, lacher, emis } = magasinEnDeux();
  // loadAll se termine sans les tables d'ENSUITE (l'accueil s'affiche)
  await s.loadAll();
  assert.equal(s.me?.id, 'moi');
  for (const t of PREMIERES) assert.ok(s.charges.has(t), t);
  for (const t of ENSUITE) { assert.equal(s.charges.has(t), false, t); assert.deepEqual(s.data[t], [], t); }
  // Rien d'ENSUITE avant que l'application soit dessinée (elle s'abonne au magasin) : le réseau reste à l'accueil
  await tick(260);
  for (const t of ENSUITE) assert.equal(lus.includes(t), false, t);
  assert.equal(s.ecranEnAttente('accueil', ''), false);
  assert.equal(s.ecranEnAttente('reseau', 'annuaire'), false);
  assert.equal(s.attendre([]), false);
  // L'application dessinée s'abonne : le reste part juste après (sans requestIdleCallback ici : 200 ms)
  const off = s.on(() => {});
  await tick(20);
  for (const t of ENSUITE) assert.equal(lus.includes(t), false, `${t} : pas avant que le navigateur souffle`);
  await tick(260);
  for (const t of ENSUITE) assert.equal(lus.filter(n => n === t).length, 1, t);
  // Le Réseau ouvert avant leur arrivée : il attend, sans relire ce qui est en route (même redessiné)
  assert.equal(s.ecranEnAttente('reseau', 'groupes'), true);
  assert.equal(s.ecranEnAttente('reseau', ''), true);
  assert.equal(s.attendre(['groupe_messages']), true);
  assert.equal(lus.filter(n => n === 'groupe_messages').length, 1);
  const avant = emis();
  lacher('groupe_messages');
  await tick();
  assert.equal(s.ecranEnAttente('reseau', 'groupes'), false);
  assert.deepEqual(s.data.groupe_messages.map(m => m.id), ['groupe_messages-1']);
  assert.ok(emis() > avant, 'l’écran est redessiné à l’arrivée');
  assert.equal(s.ecranEnAttente('messages', ''), true);
  assert.equal(s.attendre(ENSUITE), true, 'Mes données attend tout');
  lacher('reactions_messages'); lacher('relecture_commentaires');
  await tick();
  for (const t of ENSUITE) assert.ok(s.charges.has(t), t);
  for (const [page, sub] of [['messages', ''], ['mentorat', 'cv'], ['admin', '']]) assert.equal(s.ecranEnAttente(page, sub), false, page);
  assert.equal(s.attendre(ENSUITE), false);
  // Rien n'est relu ensuite pour un écran déjà servi
  const n = lus.length; s.ecranEnAttente('reseau', 'groupes'); s.ecranEnAttente('admin', ''); s.attendre(ENSUITE); assert.equal(lus.length, n);
  off();
});

test('données en deux temps : un écran ouvert avant le reste le demande tout de suite ; un échec ne le fait pas attendre toujours', async () => {
  const { s, lus, lacher } = magasinEnDeux();
  await s.loadAll();
  // Mes données ouvert juste après l'accueil, avant que le navigateur souffle : tout part aussitôt, une fois
  assert.equal(s.attendre(STORE.ENSUITE), true);
  for (const t of STORE.ENSUITE) assert.equal(lus.filter(n => n === t).length, 1, t);
  s.on(() => {}); await tick(260);
  for (const t of STORE.ENSUITE) assert.equal(lus.filter(n => n === t).length, 1, `${t} : pas relue après le premier affichage`);
  // Réseau qui coupe (deux échecs) : la table reste vide, l'écran ne l'attend plus
  lacher('groupe_messages', { data: null, error: { message: 'Failed to fetch' } });
  await tick(1300);
  lacher('groupe_messages', { data: null, error: { message: 'Failed to fetch' } });
  await tick();
  assert.equal(s.attendre(['groupe_messages']), false);
  assert.deepEqual(s.data.groupe_messages, []);
});

test('données en deux temps : tout d’un coup (copie de l’appareil, longue absence, changement de vue), lien d’une conversation, compte changé, démo', async () => {
  const { ENSUITE } = STORE;
  // ensemble : tout part en même temps, et loadAll attend tout (rafraichir, auRetour, changerVue)
  {
    const { s, lus, lacher } = magasinEnDeux();
    let fini = false;
    const p = s.loadAll({ ensemble: true }).then(() => { fini = true; });
    await tick();
    for (const t of ENSUITE) assert.equal(lus.filter(n => n === t).length, 1, t);
    assert.equal(fini, false);
    for (const t of ENSUITE) lacher(t);
    await p;
    for (const t of ENSUITE) assert.ok(s.charges.has(t), t);
    s.on(() => {}); await tick(260);
    for (const t of ENSUITE) assert.equal(lus.filter(n => n === t).length, 1, `${t} : une seule lecture`);
  }
  // Ouverture depuis la copie de l'appareil, mise à jour pas arrivée (enAttente) : rien de plus que d'habitude (app.js fait
  // attendre ses écrans, comme avant), rien n'est demandé
  {
    const { s, lus } = magasinEnDeux();
    s.enAttente = true;
    assert.equal(s.ecranEnAttente('reseau', 'groupes'), false);
    assert.equal(s.attendre(ENSUITE), false);
    assert.equal(lus.length, 0);
  }
  // Une conversation ouverte d'un lien (notification) : ses réactions viennent avec les premières, rien n'attend après
  {
    globalThis.location = { hash: '#messages/00000000-0000-4000-8000-0000000000b2' };
    try {
      const { s, lus, lacher } = magasinEnDeux({ retenir: ['reactions_messages'] });
      let fini = false;
      const p = s.loadAll().then(() => { fini = true; });
      await tick();
      assert.equal(lus.filter(n => n === 'reactions_messages').length, 1);
      assert.equal(fini, false, 'l’écran attend ses réactions avec le reste');
      lacher('reactions_messages'); await p;
      assert.equal(s.ecranEnAttente('messages', ''), false);
      s.on(() => {}); await tick(260);
      assert.equal(lus.filter(n => n === 'reactions_messages').length, 1, 'pas relue ensuite');
      for (const t of ['groupe_messages', 'relecture_commentaires']) assert.equal(lus.filter(n => n === t).length, 1, t);
    } finally { delete globalThis.location; }
  }
  // Compte changé pendant la lecture : les lignes de l'ancien compte ne sont jamais écrites, sa lecture ne bloque pas le nouveau
  {
    const { s, lus, lacher } = magasinEnDeux();
    await s.loadAll();
    assert.equal(s.ecranEnAttente('reseau', 'groupes'), true);
    s.generation = (s.generation || 0) + 1; s.charges = new Set(); s.enCours = new Map();
    lacher('groupe_messages');
    await tick();
    assert.deepEqual(s.data.groupe_messages, []);
    assert.equal(s.charges.has('groupe_messages'), false);
    assert.equal(s.attendre(['groupe_messages']), true);
    assert.equal(lus.filter(n => n === 'groupe_messages').length, 2, 'relue pour le nouveau compte');
  }
  // La démo a tout tout de suite
  globalThis.window ??= {};
  window.ENSAM_CONFIG = {};
  const demo = await STORE.createStore();
  assert.equal(demo.mode, 'demo');
  for (const [page, sub] of [['reseau', 'groupes'], ['messages', ''], ['mentorat', 'cv'], ['admin', '']]) assert.equal(demo.ecranEnAttente(page, sub), false);
  assert.equal(demo.attendre(ENSUITE), false);
  await demo.charger(ENSUITE);
});

test('données en deux temps : deux lectures de la même table en même temps, la plus récente reste (temps réel)', async () => {
  const { s, lacher } = magasinEnDeux({ retenir: ['groupe_messages'] });
  // La lecture d'ENSUITE est en route quand un message est posté : le temps réel relit la table (plus récente)
  const ancienne = s.loadTable('groupe_messages'), recente = s.loadTable('groupe_messages');
  await tick();
  // La plus récente répond d'abord (avec le nouveau message), l'ancienne ensuite (sans lui) : elle n'efface rien
  lacher('groupe_messages', { data: [{ id: 'g2' }, { id: 'g1' }], error: null }, { recente: true });
  await recente;
  lacher('groupe_messages', { data: [{ id: 'g1' }], error: null });
  await ancienne;
  assert.deepEqual(s.data.groupe_messages.map(m => m.id), ['g2', 'g1']);
  assert.ok(s.charges.has('groupe_messages'));
  // Dans l'ordre : l'ancienne d'abord, puis la plus récente, qui reste
  const a = s.loadTable('groupe_messages'), r = s.loadTable('groupe_messages');
  await tick();
  lacher('groupe_messages', { data: [{ id: 'g2' }], error: null });
  await a;
  assert.deepEqual(s.data.groupe_messages.map(m => m.id), ['g2']);
  lacher('groupe_messages', { data: [{ id: 'g3' }, { id: 'g2' }], error: null });
  await r;
  assert.deepEqual(s.data.groupe_messages.map(m => m.id), ['g3', 'g2']);
});

// ---------------------------------------------------------------------------
// Page d'entrée plus légère : le CSS de page.html raccourci au build (outils/minifier-css.mjs, appelé par precharger.mjs)
// ---------------------------------------------------------------------------
test('CSS raccourci : sans commentaires ni espaces inutiles ; chaînes, url(), « a :hover », calc() et conditions intacts', async () => {
  const { minifierCss } = await import('../../outils/minifier-css.mjs');
  const m = minifierCss;
  assert.equal(m('a  { color : red ; }\n\n/* note */ b , c > d { margin: 0 auto; }'), 'a{color : red}b,c>d{margin: 0 auto}');
  // Les espaces qui comptent restent : descendant + pseudo-classe, calc(), « and ( » des requêtes média, valeurs à plusieurs mots
  assert.equal(m('.x :hover { inline-size: calc(100% - 2px); }'), '.x :hover{inline-size: calc(100% - 2px)}');
  assert.equal(m('@media (max-width: 760px) and (min-width: 1px) { .a { padding: 0 .55rem; } }'), '@media (max-width: 760px) and (min-width: 1px){.a{padding: 0 .55rem}}');
  assert.equal(m('.p:has(> :nth-child(2)) { gap: 1rem 2rem }'), '.p:has(>:nth-child(2)){gap: 1rem 2rem}');
  // Chaînes et url() telles quelles, même avec { } ; , > ou /* dedans, guillemets échappés compris
  assert.equal(m('a::after { content: "a  { b } ; c , > /* d */"; }'), 'a::after{content: "a  { b } ; c , > /* d */"}');
  assert.equal(m(`b::before { content: 'l\\'été  ,  ici'; }`), `b::before{content: 'l\\'été  ,  ici'}`);
  assert.equal(m('i { background: url( img/a  b.png ) no-repeat , url("x ; y.svg"); }'), 'i{background: url(img/a  b.png) no-repeat,url("x ; y.svg")}');
  assert.equal(m('@font-face { src: url(polices/t.woff2) format("woff2"); unicode-range: U+0600-06FF, U+FE70-FEFF; }'),
    '@font-face{src: url(polices/t.woff2) format("woff2");unicode-range: U+0600-06FF,U+FE70-FEFF}');
  // Un commentaire collé des deux côtés garde la séparation (« a/**/b » n'est pas « ab »)
  assert.equal(m('a/**/b{x:1}'), 'a/**/b{x:1}');
  assert.equal(m('a /* x */ b{x:1}'), 'a b{x:1}');
  assert.equal(m('--x: 1px; --y:2px'), '--x: 1px;--y:2px');
  // Mal fermé : le build s'arrête plutôt que de casser la page
  assert.throws(() => m('a { x: 1 } /* jamais fermé'), /commentaire/);
  assert.throws(() => m('a::after { content: "pas fermé }'), /chaîne/);
  assert.throws(() => m('a { content: "deux\nlignes" }'), /chaîne/);
  assert.throws(() => m('a { background: url(sans-fin }'), /url/);
  // Le CSS du site : toujours le même résultat, stable si on le refait, et nettement plus court
  const page = lireSrc('page.html');
  const styles = [...page.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(x => x[1]);
  assert.ok(styles.length >= 1);
  for (const css of styles) {
    const court = m(css);
    assert.equal(m(court), court, 'refaire ne change rien');
    assert.equal(m(css), court, 'même résultat à chaque build');
    assert.equal(court.includes('/*'), css.includes('/**/') && /\S\/\*\*\/\S/.test(css), 'plus de commentaires');
  }
  // Compressé comme sur GitHub Pages (gzip) : au moins un cinquième de moins (environ 54 → 40 Ko aujourd'hui)
  const gz = t => zlib.gzipSync(t).length;
  const avant = gz(styles.join('')), apres = gz(styles.map(m).join(''));
  assert.ok(apres < avant * 0.8, `CSS compressé ${avant} → ${apres} octets`);
});

// ---------------------------------------------------------------------------
// Page d'entrée plus légère : son CSS tiré au build du CSS complet (outils/css-critique.mjs, appelé par precharger.mjs)
// ---------------------------------------------------------------------------
test('CSS de l’entrée : découpage sûr (chaînes, parenthèses), mots des modules, sélecteurs possibles', async () => {
  const { decouper, motsDe, selecteurs, selecteurPossible } = await import('../../outils/css-critique.mjs');
  assert.deepEqual(decouper('a{x:1}@media (min-width:1px){b{y:2}}@layer l;'), [{ prelude: 'a', corps: 'x:1' }, { prelude: '@media (min-width:1px)', corps: 'b{y:2}' }, { prelude: '@layer l', corps: null }]);
  // { } ; dans une chaîne ou entre parenthèses ne coupent rien
  assert.deepEqual(decouper('a::after{content:"}{;"}b[x="{"]{y:url(a;b)}'), [{ prelude: 'a::after', corps: 'content:"}{;"' }, { prelude: 'b[x="{"]', corps: 'y:url(a;b)' }]);
  for (const mal of ['a{x:1', 'a{x:1}}', 'a{content:"x}']) assert.throws(() => decouper(mal), /CSS/, mal);
  // Les mots : classes et id possibles ; « ico-${nom} » rend possible toute classe ico-… ; jamais les commentaires
  const connu = motsDe(['const x = html`<div class="auth-card wide">`;\n  // pas-ceci\n/* ni-cela */ const i = `ico-${n}`;', '<span id="entree-x">']);
  for (const m of ['auth-card', 'wide', 'ico-', 'ico-cap', 'ico-n-importe', 'entree-x']) assert.ok(connu(m), m);
  for (const m of ['pas-ceci', 'ni-cela', 'shell', 'auth']) assert.equal(connu(m), false, m);
  assert.deepEqual(selecteurs('a, b:is(.c, .d) > e, [data-x="1,2"] f'), ['a', 'b:is(.c, .d) > e', '[data-x="1,2"] f']);
  const c = motsDe(['auth btn']);
  for (const s of ['.auth .btn', 'html[data-theme=dark] .btn:hover', '.btn:not(.inconnue)', 'button', ':root', '.auth:has(.autre)', '.btn::after']) assert.ok(selecteurPossible(s, c), s);
  for (const s of ['.shell .btn', '#app .auth', '.btn.inconnue', '.auth > .x:hover']) assert.equal(selecteurPossible(s, c), false, s);
});

test('CSS de l’entrée : les règles possibles, dans leur ordre, @media et @supports filtrés, animations citées seulement', async () => {
  const { cssCritique, motsDe } = await import('../../outils/css-critique.mjs');
  const css = [
    ':root{--a:1}', 'html,body{margin:0}', '.auth{color:red}', '.shell{color:blue}', '.auth,.shell{gap:1px}', '.x::-webkit-thumb,.auth{all:unset}',
    '@font-face{font-family:F;src:url(f.woff2)}', '@property --p{syntax:"<number>";inherits:false;initial-value:0}',
    '@media (max-width:760px){.auth{padding:0}.shell{padding:1px}}', '@media print{.shell{display:none}}',
    '@supports (color:color-mix(in oklch,red 50%,blue)){@media (min-width:1px){.auth{color:green}}}',
    '.auth{animation:rise .7s var(--ease) backwards}', '@keyframes rise{from{opacity:0}}', '@keyframes inutile{to{opacity:1}}',
    '@media (prefers-reduced-motion:no-preference){.shell{animation:glisse 1s}}', '@keyframes glisse{to{opacity:1}}',
  ].join('');
  const out = cssCritique(css, motsDe(['class="auth"']));
  assert.equal(out, [
    ':root{--a:1}', 'html,body{margin:0}', '.auth{color:red}', '.auth{gap:1px}', '.x::-webkit-thumb,.auth{all:unset}',
    '@font-face{font-family:F;src:url(f.woff2)}', '@property --p{syntax:"<number>";inherits:false;initial-value:0}',
    '@media (max-width:760px){.auth{padding:0}}',
    '@supports (color:color-mix(in oklch,red 50%,blue)){@media (min-width:1px){.auth{color:green}}}',
    '.auth{animation:rise .7s var(--ease) backwards}', '@keyframes rise{from{opacity:0}}',
  ].join(''));
  assert.equal(cssCritique(css, motsDe(['class="auth"'])), out, 'toujours le même résultat');
});

test('CSS de l’entrée : sur le vrai site, un morceau du CSS complet dans le même ordre, bien plus petit, qui garde la forme de l’accueil', async () => {
  const { minifierCss } = await import('../../outils/minifier-css.mjs');
  const { cssCritique, motsDe, decouper } = await import('../../outils/css-critique.mjs');
  const page = lireSrc('page.html');
  const fin = page.indexOf('<div id="app">');
  const styles = [...page.slice(0, fin).matchAll(/<style>([\s\S]*?)<\/style>/g)].map(x => x[1]);
  assert.equal(styles.length, 2, 'deux <style> dans <head> : les polices, puis tout le site');
  const complet = minifierCss(styles[1]);
  const modules = ['entree.js', 'i18n.js', 'logo.js', 'regles-entree.js', 'fondateurs-public.js', 'scene.js'].map(lireSrc);
  const critique = cssCritique(complet, motsDe([...modules, page.slice(fin)]));
  // Chaque instruction gardée est une instruction du CSS complet (ou sa liste de sélecteurs raccourcie), dans le même ordre
  const tete = b => b.prelude.split(',')[0];
  const tous = decouper(complet), garde = decouper(critique);
  let k = 0;
  for (const b of garde) {
    while (k < tous.length && !(tete(tous[k]) === tete(b) || tous[k].prelude.split(',').includes(b.prelude.split(',')[0]))) k++;
    assert.ok(k < tous.length, `${b.prelude.slice(0, 80)} : introuvable dans l’ordre du CSS complet`);
    k++;
  }
  // La forme de l'accueil d'un membre (page.html, #squelette) et la page d'entrée ont leurs règles ; pas l'application
  for (const s of ['.squelette .side-nav', '.home-hero', '.entree-form', '.auth-card', '.bottom-nav', '#app>.boot']) assert.ok(critique.includes(s), s);
  for (const s of ['.gcard', '.cloche', '.demo-band', '.page-attente']) { assert.ok(complet.includes(s), s); assert.equal(critique.includes(s), false, s); }
  const gz = t => zlib.gzipSync(t).length;
  assert.ok(gz(critique) < gz(complet) * 0.45, `CSS de l’entrée ${gz(critique)} octets compressés, complet ${gz(complet)}`);
});
