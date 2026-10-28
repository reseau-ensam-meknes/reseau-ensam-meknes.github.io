// Banc d'essai : faux Supabase (PostgREST + Auth), faux services de push, faux Brevo.
import nodeCrypto from 'node:crypto';
import fs from 'node:fs';

export const MODULE = process.env.NOTIFIER_TS || new URL('../../supabase/functions/notifier/index.ts', import.meta.url).pathname;
export const URL_PROJET = 'https://projet-test.supabase.co';
export const CLE_SERVICE = 'cle-service-de-test';
export const SITE = 'https://reseau-ensam-meknes.github.io/';

export const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const pause = ms => new Promise(r => setTimeout(r, ms));

// Colonnes de chaque table, lues dans schema.sql : comme le vrai PostgREST, le faux refuse une colonne
// qui n'existe pas (erreur 42703), dans select, order ou un filtre.
const SCHEMA = fs.readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8');
export const COLONNES = {};
for (const [, t, corps] of SCHEMA.matchAll(/create table if not exists public\.(\w+)\s*\(([\s\S]*?)\n\);/g)) {
  COLONNES[t] = new Set(corps.split('\n').map(l => /^\s*(\w+)\s/.exec(l)?.[1]).filter(c => c && !/^(constraint|primary|unique|check|foreign)$/i.test(c)));
}
for (const [, t, c] of SCHEMA.matchAll(/alter table public\.(\w+)\s+add column if not exists (\w+)/g)) COLONNES[t]?.add(c);
function colonneInconnue(table, url) {
  const connues = COLONNES[table];
  if (!connues) return null;
  const cols = [];
  for (const [k, v] of url.searchParams.entries()) {
    if (k === 'select') { if (v !== '*') cols.push(...v.split(',')); }
    else if (k === 'order') cols.push(...v.split(',').map(o => o.split('.')[0]));
    else if (!['limit', 'offset', 'on_conflict', 'or', 'and'].includes(k)) cols.push(k);
  }
  return cols.find(c => !connues.has(c)) || null;
}

export function configurerEnv(extra = {}) {
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'BREVO_API_KEY', 'SENDER_EMAIL', 'SENDER_NAME', 'SITE_URL', 'GMAIL_USER', 'GMAIL_APP_PASSWORD']) delete process.env[k];
  Object.assign(process.env, { SUPABASE_URL: URL_PROJET, SUPABASE_SERVICE_ROLE_KEY: CLE_SERVICE }, extra);
}

// --- Récepteur Web Push indépendant (node:crypto, pas WebCrypto) -------------
export function nouveauRecepteur() {
  const ecdh = nodeCrypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = nodeCrypto.randomBytes(16);
  return { ecdh, auth, p256dh: ecdh.getPublicKey().toString('base64url'), authB64: auth.toString('base64url') };
}

export function dechiffrer(corps, recepteur) {
  const b = Buffer.from(corps);
  const sel = b.subarray(0, 16), rs = b.readUInt32BE(16), idlen = b[20];
  const asPub = b.subarray(21, 21 + idlen), chiffre = b.subarray(21 + idlen);
  const uaPub = recepteur.ecdh.getPublicKey();
  const partage = recepteur.ecdh.computeSecret(asPub);
  const info = Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]);
  const ikm = Buffer.from(nodeCrypto.hkdfSync('sha256', partage, recepteur.auth, info, 32));
  const cek = Buffer.from(nodeCrypto.hkdfSync('sha256', ikm, sel, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(nodeCrypto.hkdfSync('sha256', ikm, sel, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = nodeCrypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(chiffre.subarray(chiffre.length - 16));
  let clair = Buffer.concat([d.update(chiffre.subarray(0, chiffre.length - 16)), d.final()]);
  let i = clair.length - 1;
  while (i >= 0 && clair[i] === 0) i--;
  if (clair[i] !== 2) throw new Error('délimiteur de fin absent');
  return { rs, idlen, asPub, clair: clair.subarray(0, i).toString('utf8'), taille: b.length };
}

// Vérifie un JWT ES256 avec la clé publique brute (65 octets, base64url)
export function verifierJwt(jwt, publiqueB64) {
  const [h, c, s] = jwt.split('.');
  const brut = Buffer.from(publiqueB64, 'base64url');
  const cle = nodeCrypto.createPublicKey({
    format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: brut.subarray(1, 33).toString('base64url'), y: brut.subarray(33, 65).toString('base64url') },
  });
  const sig = Buffer.from(s, 'base64url');
  const valide = nodeCrypto.verify('sha256', Buffer.from(`${h}.${c}`), { key: cle, dsaEncoding: 'ieee-p1363' }, sig);
  return { valide, entete: JSON.parse(Buffer.from(h, 'base64url')), claims: JSON.parse(Buffer.from(c, 'base64url')), tailleSig: sig.length };
}

// --- Faux PostgREST -----------------------------------------------------------
function comparer(a, b) {
  const da = Date.parse(a), dbb = Date.parse(b);
  if (typeof a === 'string' && /^\d{4}-\d\d-\d\d/.test(a) && !isNaN(da) && !isNaN(dbb)) return da - dbb;
  const na = Number(a), nb = Number(b);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function condition(val, expr) {
  let neg = false;
  if (expr.startsWith('not.')) { neg = true; expr = expr.slice(4); }
  const i = expr.indexOf('.');
  const op = expr.slice(0, i), arg = expr.slice(i + 1);
  let r;
  switch (op) {
    case 'eq': r = val != null && String(val) === arg; break;
    case 'is': r = arg === 'null' ? val == null : arg === 'true' ? val === true : arg === 'false' ? val === false : false; break;
    case 'in': r = arg.replace(/^\(|\)$/g, '').split(',').includes(String(val)); break;
    case 'gte': r = val != null && comparer(val, arg) >= 0; break;
    case 'lte': r = val != null && comparer(val, arg) <= 0; break;
    case 'gt': r = val != null && comparer(val, arg) > 0; break;
    case 'lt': r = val != null && comparer(val, arg) < 0; break;
    default: throw new Error('opérateur non géré dans le faux PostgREST : ' + op);
  }
  return neg ? !r : r;
}

export class Banc {
  constructor() {
    this.tables = {
      profiles: [], offers: [], applications: [], invitations: [], mentorships: [], questions: [], answers: [],
      parrainages: [], cafes: [], placements: [], push_subscriptions: [], push_queue: [], app_secrets: [], notif_etat: [],
    };
    this.emails = new Map();          // id -> email (auth.users)
    this.jetons = new Map();          // jeton utilisateur -> id
    this.statutsPush = new Map();     // endpoint -> code HTTP
    this.recepteurs = new Map();      // endpoint -> récepteur
    this.echecsBrevo = new Set();     // emails refusés par Brevo
    this.journal = [];                // toutes les requêtes
    this.push = [];                   // requêtes reçues par les services de push
    this.brevo = [];                  // corps reçus par Brevo
    this.rendezVous = 0;              // courses : les N premières lectures s'attendent, puis repartent ensemble
    this.enAttente = [];
    this.panne = null;                // message d'erreur PostgREST forcé
    this.appelsRpc = { prendre_push: 0, destinataires_resume: 0 };
  }

  abonner(userId, n, hote = 'https://push.example.net') {
    const r = nouveauRecepteur();
    const endpoint = `${hote}/s/${userId.slice(-4)}-${n}`;
    const id = uid(900000 + this.tables.push_subscriptions.length + 1);
    this.tables.push_subscriptions.push({ id, user_id: userId, endpoint, p256dh: r.p256dh, auth: r.authB64, created_at: new Date().toISOString() });
    this.recepteurs.set(endpoint, r);
    return { id, endpoint };
  }

  fetch = async (entree, init = {}) => {
    const url = new URL(typeof entree === 'string' ? entree : entree.url);
    const methode = (init.method || 'GET').toUpperCase();
    const entetes = new Headers(init.headers || {});
    this.journal.push({ url: url.toString(), methode, entetes, corps: init.body });
    if (url.origin === URL_PROJET) return this.supabase(url, methode, entetes, init.body);
    if (url.origin === 'https://api.brevo.com') return this.serviceBrevo(url, entetes, init.body);
    if (this.recepteurs.has(url.toString())) return this.servicePush(url, methode, entetes, init.body);
    throw new TypeError('réseau : hôte inconnu ' + url.origin);
  };

  json(corps, statut = 200, extra = {}) {
    return new Response(corps === null ? null : JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json', ...extra } });
  }

  async supabase(url, methode, entetes, corps) {
    if (url.pathname === '/auth/v1/user') {
      const jeton = (entetes.get('authorization') || '').replace(/^Bearer /, '');
      const id = this.jetons.get(jeton);
      return id ? this.json({ id, email: this.emails.get(id) }) : this.json({ msg: 'invalid JWT' }, 401);
    }
    if (entetes.get('apikey') !== CLE_SERVICE || entetes.get('authorization') !== `Bearer ${CLE_SERVICE}`) return this.json({ message: 'clé absente' }, 401);
    if (this.panne) return this.json({ message: this.panne }, 500);
    const admin = /^\/auth\/v1\/admin\/users\/([0-9a-f-]+)$/.exec(url.pathname);
    if (admin) return this.emails.has(admin[1]) ? this.json({ id: admin[1], email: this.emails.get(admin[1]) }) : this.json({ msg: 'User not found' }, 404);
    const chemin = url.pathname.replace('/rest/v1/', '');
    if (chemin.startsWith('rpc/')) return this.rpc(chemin.slice(4), JSON.parse(corps || '{}'));
    const table = this.tables[chemin];
    if (!table) return this.json({ message: 'table inconnue ' + chemin }, 404);
    const inconnue = colonneInconnue(chemin, url);
    if (inconnue) return this.json({ code: '42703', message: `column ${chemin}.${inconnue} does not exist` }, 400);
    const p = [...url.searchParams.entries()];
    const filtres = p.filter(([k]) => !['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k));
    const garder = r => filtres.every(([k, v]) => condition(r[k], v));
    if (methode === 'GET') {
      if (this.rendezVous) await new Promise(ok => {
        this.enAttente.push(ok);
        if (this.enAttente.length >= this.rendezVous) { this.rendezVous = 0; for (const f of this.enAttente.splice(0)) f(); }
      });
      let l = table.filter(garder);
      const ordre = url.searchParams.get('order');
      if (ordre) { const col = ordre.split('.')[0]; l = [...l].sort((a, b) => comparer(a[col], b[col])); }
      const off = Number(url.searchParams.get('offset') || 0), lim = Number(url.searchParams.get('limit') || 1e9);
      l = l.slice(off, off + lim);
      const select = url.searchParams.get('select');
      if (select && select !== '*') { const cols = select.split(','); l = l.map(r => Object.fromEntries(cols.map(c => [c, r[c] ?? null]))); }
      return this.json(l);
    }
    if (methode === 'POST') {
      const lignes = [].concat(JSON.parse(corps));
      const ignorer = /resolution=ignore-duplicates/.test(entetes.get('prefer') || '');
      for (const l of lignes) {
        const cle = chemin === 'app_secrets' ? 'cle' : 'id';
        if (table.some(x => x[cle] === l[cle])) { if (ignorer) continue; return this.json({ message: 'doublon' }, 409); }
        table.push({ ...l });
      }
      return new Response(null, { status: 201 });
    }
    if (methode === 'PATCH') {
      if (!filtres.length) return this.json({ message: 'PATCH sans filtre' }, 400);
      const maj = JSON.parse(corps);
      for (const r of table) if (garder(r)) Object.assign(r, maj);
      return new Response(null, { status: 204 });
    }
    if (methode === 'DELETE') {
      if (!filtres.length) return this.json({ message: 'DELETE sans filtre' }, 400);
      this.tables[chemin] = table.filter(r => !garder(r));
      return new Response(null, { status: 204 });
    }
    return this.json({ message: 'méthode' }, 405);
  }

  rpc(fn, args) {
    this.appelsRpc[fn] = (this.appelsRpc[fn] || 0) + 1;
    // Fonctions SQL simulées par un test : this.rpcs[fn] = args => résultat
    if (this.rpcs?.[fn]) { (this.argsRpc ||= {})[fn] = [...(this.argsRpc[fn] || []), args]; const r = this.rpcs[fn](args); return r === undefined ? new Response(null, { status: 204 }) : this.json(r); }
    if (fn === 'prendre_push') {
      const q = this.tables.push_queue.sort((a, b) => a.id - b.id);
      const pris = q.splice(0, args.p_max ?? 300);
      return this.json(pris.map(x => ({ id: x.id, user_id: x.user_id, kind: x.kind, data: x.data, langue: this.tables.profiles.find(p => p.id === x.user_id)?.langue || 'fr' })));
    }
    if (fn === 'destinataires_resume') {
      // Comme la fonction SQL : une fois par semaine, comptes de plus de 2 jours, emails_hebdo
      (this.argsRpc ||= {})[fn] = [...(this.argsRpc[fn] || []), args];
      const now = Date.now();
      for (const p of this.tables.profiles) {
        if (!this.tables.notif_etat.some(n => n.user_id === p.id)) this.tables.notif_etat.push({ user_id: p.id, token: nodeCrypto.randomUUID(), resume_at: null });
      }
      const l = this.tables.profiles
        .filter(p => p.emails_hebdo !== false && this.emails.get(p.id) && Date.parse(p.created_at) < now - 2 * 864e5)
        .map(p => ({ p, n: this.tables.notif_etat.find(n => n.user_id === p.id) }))
        .filter(({ n }) => !n.resume_at || Date.parse(n.resume_at) < now - 6.5 * 864e5)
        .slice(0, Math.max(1, Math.min(args.p_max ?? 250, 290)));
      return this.json(l.map(({ p, n }) => ({ id: p.id, email: this.emails.get(p.id), langue: p.langue || 'fr', token: n.token })));
    }
    return this.json({ message: 'rpc inconnue' }, 404);
  }

  async servicePush(url, methode, entetes, corps) {
    const r = this.recepteurs.get(url.toString());
    const octets = new Uint8Array(corps instanceof ArrayBuffer ? corps : corps.buffer.slice(corps.byteOffset, corps.byteOffset + corps.byteLength));
    const d = dechiffrer(octets, r);
    const statut = this.statutsPush.get(url.toString()) ?? 201;
    this.push.push({ endpoint: url.toString(), methode, entetes: Object.fromEntries(entetes), message: JSON.parse(d.clair), dechiffre: d, statut });
    return new Response(statut === 201 ? null : 'gone', { status: statut });
  }

  async serviceBrevo(url, entetes, corps) {
    if (url.pathname !== '/v3/smtp/email' || !entetes.get('api-key')) return this.json({ message: 'non autorisé' }, 401);
    const b = JSON.parse(corps);
    this.brevo.push({ entetes: Object.fromEntries(entetes), corps: b });
    this.enVol = (this.enVol || 0) + 1;
    this.maxEnVol = Math.max(this.maxEnVol || 0, this.enVol);
    if (this.delaiBrevo) await pause(this.delaiBrevo);
    this.enVol--;
    if (this.echecsBrevo.has(b.to?.[0]?.email)) return this.json({ code: 'invalid_parameter', message: 'email refusé' }, 400);
    return this.json({ messageId: '<' + nodeCrypto.randomUUID() + '@smtp-relay.mailin.fr>' }, 201);
  }
}

export function installer(banc) {
  globalThis.fetch = banc.fetch;
  return banc;
}

export const requete = (corps, entetes = {}, methode = 'POST') =>
  new Request('https://projet-test.supabase.co/functions/v1/notifier', {
    method: methode, headers: { 'Content-Type': 'application/json', ...entetes }, body: methode === 'POST' || methode === 'PUT' ? (typeof corps === 'string' ? corps : JSON.stringify(corps)) : undefined,
  });
