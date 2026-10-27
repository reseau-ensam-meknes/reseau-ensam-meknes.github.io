// =====================================================================
//  Fonction Supabase « notifier » : notifications sur le téléphone (Web Push)
//  et résumé hebdomadaire par email (Gmail, sinon Brevo), pour le Réseau ENSAM Meknès.
//  À coller tel quel : Supabase > Edge Functions > Deploy a new function >
//  Via editor, nom « notifier ». Aucun import : fetch, WebCrypto et Deno (TLS).
//
//  Appel : POST, corps JSON { job } avec
//    cle    : clé publique VAPID, pour s'abonner depuis le site (public)
//    test   : notification d'essai sur les téléphones du membre connecté
//    push   : envoie les notifications en attente (appelé par la base)
//    resume : résumé de la semaine par email (appelé chaque matin par la base)
//    essai_email : le résumé des administrateurs, tout de suite (pour vérifier l'envoi)
//    alertes : nouvelles offres pour ta filière et ton année, par email (chaque heure)
//    enquetes : invitations à l'enquête d'insertion, 6 et 12 mois après le diplôme (chaque jour)
//    messages : email quand un message reste non lu 30 minutes (chaque heure)
//    relances : un seul rappel aux comptes créés depuis plus de 24 h sans profil (chaque jour)
//  Toutes sauf cle et test exigent l'en-tête x-notifier = app_secrets.notifier_secret.
// =====================================================================

const TZ = 'Africa/Casablanca';
const JOUR = 864e5;
const RDV_MIN = 20;            // durée d'un rendez-vous de mentorat (comme logic.js)
const PAGE = 1000;             // lignes par page PostgREST
const MORCEAU = 80;            // identifiants par filtre in.(…)
const SITE_DEFAUT = 'https://reseau-ensam-meknes.github.io/';
const NOM_DEFAUT = 'Réseau ENSAM Meknès';
const enc = new TextEncoder();

// deno-lint-ignore no-explicit-any
type Json = any;

// ---------------------------------------------------------------------
// Réglages (secrets de la fonction)
// ---------------------------------------------------------------------
export type Env = {
  url: string; cle: string; brevo: string; expediteur: string; nomExpediteur: string; site: string;
  gmail: string; gmailMdp: string;
};

function variable(nom: string): string {
  try { if (typeof Deno !== 'undefined') return (Deno.env.get(nom) || '').trim(); } catch { /* accès refusé */ }
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return (g.process?.env?.[nom] || '').trim();
}

// Adresse du site, toujours terminée par « / » (les liens ajoutent #route)
export function normaliserSite(s: string): string {
  let u = (s || '').trim().replace(/#.*$/, '');
  if (!u) u = SITE_DEFAUT;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u.replace(/^\/+/, '');
  try {
    const x = new URL(u);
    if (!x.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(x.pathname)) x.pathname += '/';
    return x.origin + x.pathname + x.search;
  } catch {
    return SITE_DEFAUT;
  }
}

export function lireEnv(): Env {
  return {
    url: variable('SUPABASE_URL').replace(/\/+$/, ''),
    cle: variable('SUPABASE_SERVICE_ROLE_KEY'),
    brevo: variable('BREVO_API_KEY'),
    expediteur: variable('SENDER_EMAIL'),
    nomExpediteur: variable('SENDER_NAME') || NOM_DEFAUT,
    site: normaliserSite(variable('SITE_URL')),
    gmail: variable('GMAIL_USER'),
    // Google affiche le mot de passe d'application en 4 groupes : les espaces ne comptent pas
    gmailMdp: variable('GMAIL_APP_PASSWORD').replace(/\s+/g, ''),
  };
}

// ---------------------------------------------------------------------
// Petits outils
// ---------------------------------------------------------------------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_INV = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < 64; i++) t[B64.charCodeAt(i)] = i;
  t[43] = 62; t[47] = 63;  // « + » et « / » du base64 classique
  return t;
})();

export function b64url(o: Uint8Array): string {
  let s = '', i = 0;
  for (; i + 2 < o.length; i += 3) {
    const n = (o[i] << 16) | (o[i + 1] << 8) | o[i + 2];
    s += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  if (i < o.length) {
    const n = (o[i] << 16) | ((i + 1 < o.length ? o[i + 1] : 0) << 8);
    s += B64[n >> 18] + B64[(n >> 12) & 63] + (i + 1 < o.length ? B64[(n >> 6) & 63] : '');
  }
  return s;
}

export function deB64url(s: string): Uint8Array {
  const t = String(s).replace(/[=\s]/g, '');
  const out = new Uint8Array(Math.floor((t.length * 3) / 4));
  let j = 0, acc = 0, bits = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i), v = c < 128 ? B64_INV[c] : -1;
    if (v < 0) throw new Error('base64 invalide');
    acc = ((acc << 6) | v) & 0xffffff; bits += 6;
    if (bits >= 8) { bits -= 8; out[j++] = (acc >> bits) & 255; }
  }
  return j === out.length ? out : out.slice(0, j);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const o = new Uint8Array(n);
  let k = 0;
  for (const p of parts) { o.set(p, k); k += p.length; }
  return o;
}

// WebCrypto accepte les vues Uint8Array ; ce cast calme seulement TypeScript
const bs = (u: Uint8Array) => u as unknown as ArrayBuffer;

// Comparaison en temps constant (le secret d'appel ne fuit pas par la durée)
export function egalConstant(a: string, b: string): boolean {
  const x = enc.encode(a), y = enc.encode(b);
  let d = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) d |= (i < x.length ? x[i] : 0) ^ (i < y.length ? y[i] : 0);
  return d === 0;
}

export async function parallele<T>(elements: T[], n: number, f: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  const ouvrier = async () => { while (i < elements.length) await f(elements[i++]); };
  await Promise.all(Array.from({ length: Math.max(0, Math.min(n, elements.length)) }, ouvrier));
}

function grouper<T>(liste: T[], cle: (x: T) => string | null | undefined): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of liste) {
    const k = cle(x);
    if (!k) continue;
    const l = m.get(k);
    if (l) l.push(x); else m.set(k, [x]);
  }
  return m;
}

function unique<T extends { id: string | number }>(l: T[]): T[] {
  const m = new Map<string | number, T>();
  for (const x of l) m.set(x.id, x);
  return [...m.values()];
}

const txt = (x: unknown): string => (x == null ? '' : String(x)).replace(/\s+/g, ' ').trim();
export function couper(s: string, n: number): string {
  const c = Array.from(s);
  return c.length <= n ? s : c.slice(0, n - 1).join('').trimEnd() + '…';
}
const ok = (statut: number) => statut >= 200 && statut < 300;
const estUuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const temps = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : NaN);
export const esc = (s: string): string => String(s).replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const prenomDe = (nom: string): string => txt(nom).split(' ')[0] || '';

// ---------------------------------------------------------------------
// Dates : saison et affichage à l'heure du Maroc
// ---------------------------------------------------------------------
type Langue = 'fr' | 'ar';
const langueDe = (l: unknown): Langue => (l === 'ar' ? 'ar' : 'fr');
// Le Maroc est revenu à l'heure GMT (UTC+0), pour de bon, le dimanche 20 septembre 2026. Si la base des
// fuseaux du serveur est plus ancienne (elle donnerait encore UTC+1), on applique nous-mêmes la nouvelle règle.
const RETOUR_GMT = Date.UTC(2026, 8, 20, 1);
let fuseauxAJour: boolean | undefined;
function zoneDe(d: Date): string {
  fuseauxAJour ??= new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(new Date(Date.UTC(2026, 9, 21, 12))) === '12';
  return !fuseauxAJour && d.getTime() >= RETOUR_GMT ? 'UTC' : TZ;
}
const formats = new Map<string, Intl.DateTimeFormat>();
function format(locale: string, o: Intl.DateTimeFormatOptions, d: Date): Intl.DateTimeFormat {
  const z = zoneDe(d), k = z + locale + JSON.stringify(o);
  let f = formats.get(k);
  if (!f) { f = new Intl.DateTimeFormat(locale, { timeZone: z, numberingSystem: 'latn', ...o }); formats.set(k, f); }
  return f;
}

// Une saison = une année universitaire, de septembre à août (2026 = 2026-2027)
export function saisonDe(now: Date): number {
  const p = format('en-US', { year: 'numeric', month: 'numeric' }, now).formatToParts(now);
  const an = Number(p.find(x => x.type === 'year')?.value), mois = Number(p.find(x => x.type === 'month')?.value);
  return mois >= 9 ? an : an - 1;
}

// Niveau pendant une saison, depuis la promo (année de diplôme) : 3, 4, 5 ; 6 = jeune diplômé
export function niveauDe(promo: number, saison: number): number {
  if (!promo) return 7;
  const n = 5 - (promo - (saison + 1));
  if (n <= 0) return 1;
  if (n <= 5) return n;
  return promo === saison ? 6 : 7;
}

// « mardi 21 octobre » et « 18:30 »
export function quand(iso: unknown, langue: Langue): { date: string; heure: string } | null {
  if (!iso) return null;
  const d = new Date(String(iso));
  if (isNaN(d.getTime())) return null;
  const loc = langue === 'ar' ? 'ar-MA' : 'fr-FR';
  return {
    date: format(loc, { weekday: 'long', day: 'numeric', month: 'long' }, d).format(d),
    heure: format(loc, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, d).format(d),
  };
}

// ---------------------------------------------------------------------
// Base de données (PostgREST, clé de service)
// ---------------------------------------------------------------------
async function db(env: Env, chemin: string, init: RequestInit = {}): Promise<Json> {
  const r = await fetch(`${env.url}/rest/v1/${chemin}`, {
    ...init,
    headers: { apikey: env.cle, Authorization: `Bearer ${env.cle}`, 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`base ${r.status} sur ${chemin.split('?')[0]} : ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}

const rpc = (env: Env, fn: string, args: Record<string, unknown>) =>
  db(env, `rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });

// Toutes les lignes, 1000 par page
async function tout<T = Json>(env: Env, table: string, requete: string): Promise<T[]> {
  const ordre = /(^|&)order=/.test(requete) ? '' : '&order=id';
  const out: T[] = [];
  for (let page = 0; page < 100; page++) {
    const lignes = (await db(env, `${table}?${requete}${ordre}&limit=${PAGE}&offset=${page * PAGE}`)) as T[];
    for (const l of lignes) out.push(l);
    if (lignes.length < PAGE) break;
  }
  return out;
}

// Lignes dont la colonne vaut l'un des identifiants (par paquets, pour garder des URL courtes)
async function parIds<T = Json>(env: Env, table: string, requete: string, col: string, ids: string[]): Promise<T[]> {
  const u = [...new Set(ids.filter(estUuid))];
  const lots: string[][] = [];
  for (let i = 0; i < u.length; i += MORCEAU) lots.push(u.slice(i, i + MORCEAU));
  return (await Promise.all(lots.map(l => tout<T>(env, table, `${requete}&${col}=in.(${l.join(',')})`)))).flat();
}

async function supprimer(env: Env, table: string, ids: string[]): Promise<void> {
  const u = [...new Set(ids.filter(estUuid))];
  for (let i = 0; i < u.length; i += MORCEAU) {
    await db(env, `${table}?id=in.(${u.slice(i, i + MORCEAU).join(',')})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  }
}

const iso = (ms: number) => encodeURIComponent(new Date(ms).toISOString());

// ---------------------------------------------------------------------
// Web Push : chiffrement aes128gcm (RFC 8291) et signature VAPID (RFC 8292)
// ---------------------------------------------------------------------
async function hkdf(sel: Uint8Array, ikm: Uint8Array, info: Uint8Array, n: number): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', bs(ikm), 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: bs(sel), info: bs(info) }, k, n * 8));
}

export type CleEmetteur = { prive: CryptoKey; publique: Uint8Array };

// Un seul enregistrement (rs = 4096), délimiteur 0x02, sans remplissage.
// `sel` et `emetteur` ne servent qu'aux tests (vecteur de la RFC 8291).
export async function chiffrer(message: Uint8Array, p256dh: string, auth: string, sel?: Uint8Array, emetteur?: CleEmetteur): Promise<Uint8Array> {
  const uaPub = deB64url(p256dh), secret = deB64url(auth);
  if (uaPub.length !== 65 || uaPub[0] !== 4 || secret.length < 16) throw new Error('clés d’abonnement invalides');
  if (message.length > 3993) throw new Error('notification trop longue');
  const s = sel || crypto.getRandomValues(new Uint8Array(16));
  let em = emetteur;
  if (!em) {
    const kp = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
    em = { prive: kp.privateKey, publique: new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey)) };
  }
  const cleUa = await crypto.subtle.importKey('raw', bs(uaPub), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const partage = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: cleUa }, em.prive, 256));
  const ikm = await hkdf(secret, partage, concat(enc.encode('WebPush: info\0'), uaPub, em.publique), 32);
  const cek = await hkdf(s, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(s, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const cle = await crypto.subtle.importKey('raw', bs(cek), 'AES-GCM', false, ['encrypt']);
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bs(nonce), tagLength: 128 }, cle, bs(concat(message, new Uint8Array([2])))));
  const entete = new Uint8Array(21 + em.publique.length);
  entete.set(s, 0);
  new DataView(entete.buffer).setUint32(16, 4096);
  entete[20] = em.publique.length;
  entete.set(em.publique, 21);
  return concat(entete, chiffre);
}

// Jeton VAPID : JWT ES256, valable 12 h, pour l'origine du service de push
export async function jetonVapid(aud: string, sub: string, cle: CryptoKey, maintenant = Date.now()): Promise<string> {
  const h = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const c = b64url(enc.encode(JSON.stringify({ aud, exp: Math.floor(maintenant / 1000) + 12 * 3600, sub })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cle, bs(enc.encode(`${h}.${c}`)));
  return `${h}.${c}.${b64url(new Uint8Array(sig))}`;  // WebCrypto donne déjà r||s (64 octets)
}

// Clés VAPID gardées dans app_secrets ; créées au premier appel.
// Deux premiers appels simultanés : le second insert est ignoré, et les deux relisent la même paire.
async function clesVapid(env: Env): Promise<{ publique: string; prive: string } | null> {
  const lire = async () => {
    const l = (await db(env, 'app_secrets?select=cle,valeur&cle=in.(vapid_public,vapid_private_jwk)')) as { cle: string; valeur: string }[];
    const m = new Map(l.map(x => [x.cle, x.valeur]));
    return { publique: m.get('vapid_public') || '', prive: m.get('vapid_private_jwk') || '' };
  };
  let k = await lire();
  if (k.publique && k.prive) return k;
  if (k.publique || k.prive) {
    console.error('notifier : clés VAPID incomplètes, supprimer les lignes vapid_* de app_secrets');
    return null;
  }
  const kp = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const publique = b64url(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey)));
  const prive = JSON.stringify(await crypto.subtle.exportKey('jwk', kp.privateKey));
  await db(env, 'app_secrets', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify([{ cle: 'vapid_public', valeur: publique }, { cle: 'vapid_private_jwk', valeur: prive }]),
  });
  k = await lire();
  return k.publique && k.prive ? k : null;
}

type Vapid = { publique: string; cle: CryptoKey; sub: string; jetons: Map<string, Promise<string>> };

async function preparerVapid(env: Env): Promise<Vapid> {
  const k = await clesVapid(env);
  if (!k) throw new Error('clés VAPID indisponibles');
  const cle = await crypto.subtle.importKey('jwk', JSON.parse(k.prive), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return { publique: k.publique, cle, sub: env.site, jetons: new Map() };
}

type Abonnement = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
export type Notif = { title: string; body: string; url: string; tag: string; calme?: boolean };

export const urgence = (kind: string) => (kind === 'rappel_rdv' || kind === 'mentorat_accepte' || kind === 'message' ? 'high' : 'normal');

// Envoie une notification ; rend le code HTTP du service de push (0 si injoignable)
async function pousserUn(a: Abonnement, n: Notif, urg: string, v: Vapid): Promise<number> {
  try {
    const aud = new URL(a.endpoint).origin;
    let j = v.jetons.get(aud);
    if (!j) { j = jetonVapid(aud, v.sub, v.cle); v.jetons.set(aud, j); }
    const corps = await chiffrer(enc.encode(JSON.stringify(n)), a.p256dh, a.auth);
    const r = await fetch(a.endpoint, {
      method: 'POST',
      headers: {
        TTL: '86400', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
        Urgency: urg, Authorization: `vapid t=${await j}, k=${v.publique}`,
      },
      body: bs(corps),
      signal: AbortSignal.timeout(15000),
    });
    if (ok(r.status) || r.status === 404 || r.status === 410) await r.body?.cancel();
    else console.error('notifier : push refusé', r.status, aud, (await r.text()).slice(0, 200));
    return r.status;
  } catch (e) {
    console.error('notifier : push échoué', e instanceof Error ? e.message : String(e));
    return 0;
  }
}

// ---------------------------------------------------------------------
// Textes des notifications (fr / ar)
// ---------------------------------------------------------------------
type V = { nom: string; sujet: string; titre: string; entreprise: string; cible: string; ville: string; lieu: string; statut: string; date: string; heure: string; promo: string; n: number; vague: string; motif: string; texte: string; mtype: string; duree: number; aide: string; dtype: string; pour: string; origine?: string; emoji: string; quoi: string; reponse: string; sur: string };
// Réactions publiques : les mêmes émojis que la table reactions_publiques
const EMOJIS_PUBLICS = ['👍', '❤️', '👏', '🙏', '💪'];

// Aperçu d'un message privé : le début du texte, ou « Photo », « Message vocal (0:42) »
const minSec = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const apercuMessage = (v: V, l: Langue) => v.mtype === 'photo' ? (l === 'ar' ? '📷 صورة' : '📷 Photo')
  : v.mtype === 'vocal' ? (l === 'ar' ? '🎤 رسالة صوتية' : '🎤 Message vocal') + (v.duree ? ` (${minSec(v.duree)})` : '')
  : v.texte || (l === 'ar' ? 'رسالة جديدة' : 'Nouveau message');
type Texte = (v: V) => [string, string] | null;

const NOTIFS: Record<string, { route: string; fr: Texte; ar: Texte }> = {
  mentorat_demande: {
    route: 'mentorat',
    fr: v => ['Des horaires à choisir', `${v.nom} te demande de l’aide : ${v.sujet}`],
    ar: v => ['توقيتات بانتظار اختيارك', `مساعدتك مطلوبة من ${v.nom}: ${v.sujet}`],
  },
  // Une demande de mentorat ouverte à tous (sans lauréat choisi, ou passée aux autres) : les lauréats disponibles du parcours
  mentorat_ouvert: {
    route: 'mentorat',
    fr: v => ['Une demande de mentorat ouverte à tous', `${v.nom} propose ses horaires : ${v.sujet}`],
    ar: v => ['طلب إرشاد مفتوح لكل الخريجين', `توقيتات مقترحة من ${v.nom}: ${v.sujet}`],
  },
  mentorat_accepte: {
    route: 'mentorat',
    fr: v => ['Rendez-vous fixé', `${v.nom} a choisi un de tes horaires : ${v.sujet}${v.date ? `, ${v.date} à ${v.heure}` : ''}`],
    ar: v => ['تم تحديد الموعد', `تم تحديد موعدك مع ${v.nom}: ${v.sujet}${v.date ? `، ${v.date} على الساعة ${v.heure}` : ''}`],
  },
  mentorat_deplace: {
    route: 'mentorat',
    fr: v => ['Rendez-vous déplacé', v.date ? `${v.nom} propose ${v.date} à ${v.heure} : ${v.sujet}` : `${v.nom} propose un autre horaire : ${v.sujet}`],
    ar: v => ['تم تغيير الموعد', v.date ? `موعد جديد من ${v.nom}: ${v.date} على الساعة ${v.heure} · ${v.sujet}` : `موعد جديد من ${v.nom}: ${v.sujet}`],
  },
  mentorat_annule: {
    route: 'mentorat',
    fr: v => v.pour === 'demandeur' ? [`Rendez-vous annulé : ${v.sujet}`, `${v.nom} a annulé. Tu peux lui proposer d’autres horaires.`]
      : v.pour === 'mentor' ? [`Rendez-vous annulé : ${v.sujet}`, `${v.nom} a annulé le rendez-vous.`] : ['Rendez-vous annulé', v.sujet],
    ar: v => v.pour === 'demandeur' ? [`تم إلغاء الموعد: ${v.sujet}`, `أُلغي الموعد من طرف ${v.nom}. يمكنك اقتراح توقيتات أخرى.`]
      : v.pour === 'mentor' ? [`تم إلغاء الموعد: ${v.sujet}`, `أُلغي الموعد من طرف ${v.nom}.`] : ['تم إلغاء الموعد', v.sujet],
  },
  merci: {
    route: 'espace',
    fr: v => ['Un merci pour toi', `${v.nom} te remercie pour ton aide.`],
    ar: v => ['رسالة شكر لك', `وصلتك رسالة شكر من ${v.nom} على مساعدتك.`],
  },
  candidature: {
    route: 'espace',
    fr: v => ['Nouvelle candidature', `${v.nom} a postulé : ${v.titre}`],
    ar: v => ['ترشيح جديد', `ترشيح من ${v.nom} لعرض: ${v.titre}`],
  },
  candidature_statut: {
    route: 'parcours',
    fr: v => v.statut === 'entretien' ? ['Entretien proposé', `Ta candidature « ${v.titre} » avance : entretien.`]
      : v.statut === 'retenu' ? ['Bonne nouvelle !', `Ta candidature pour « ${v.titre} » est retenue.`] : null,
    ar: v => v.statut === 'entretien' ? ['مقابلة مقترحة', `ترشيحك لـ«${v.titre}» يتقدم: مقابلة.`]
      : v.statut === 'retenu' ? ['خبر سار!', `تم قبولك في «${v.titre}».`] : null,
  },
  // aide : la réussite vient d'une demande (le lauréat recrute, encadre ou recommande) : on parle de démarrage
  recrutement_a_confirmer: {
    route: 'parcours',
    fr: v => v.aide ? ['Confirme ton démarrage', `${v.nom} indique que tu as commencé chez ${v.entreprise}.`] : ['Confirme ton recrutement', `${v.nom} déclare ton recrutement chez ${v.entreprise}.`],
    ar: v => v.aide ? ['أكّد بدءك', `تصريح من ${v.nom} بأنك بدأت لدى ${v.entreprise}. أكّده بنقرة.`] : ['أكّد توظيفك', `تصريح من ${v.nom} بتوظيفك في ${v.entreprise}. أكّده بنقرة.`],
  },
  recrutement_confirme: {
    route: 'espace',
    fr: v => v.aide ? ['Démarrage confirmé', `${v.nom} a confirmé son démarrage chez ${v.entreprise}.`] : ['Recrutement confirmé', `${v.nom} a confirmé son recrutement chez ${v.entreprise}.`],
    ar: v => v.aide ? ['تم تأكيد البدء', `تم تأكيد بدء ${v.nom} لدى ${v.entreprise}.`] : ['تم تأكيد التوظيف', `تم تأكيد توظيف ${v.nom} لدى ${v.entreprise}.`],
  },
  // Demandes des étudiants : nouvelle demande du parcours (lauréats), aide proposée, match, fin du match
  demande_nouvelle: {
    route: 'offres/demandes',
    fr: v => [v.dtype === 'emploi' ? 'Quelqu’un du réseau cherche un emploi' : 'Un étudiant de ton parcours cherche', `${v.nom}${TYPES_OFFRE.fr[v.dtype] ? ` · ${TYPES_OFFRE.fr[v.dtype]}` : ''} : ${v.titre}`],
    ar: v => [v.dtype === 'emploi' ? 'شخص من الشبكة يبحث عن عمل' : 'طلب جديد من مسارك', `${v.nom}${TYPES_OFFRE.ar[v.dtype] ? ` · ${TYPES_OFFRE.ar[v.dtype]}` : ''}: ${v.titre}`],
  },
  // Une demande restée sans aide qui s'ouvre à tous les lauréats (24 h après) : les lauréats des autres parcours
  demande_large: {
    route: 'offres/demandes',
    fr: v => ['Une demande ouverte à tous les lauréats', `${v.nom}${TYPES_OFFRE.fr[v.dtype] ? ` · ${TYPES_OFFRE.fr[v.dtype]}` : ''} : ${v.titre}`],
    ar: v => ['طلب مفتوح لكل الخريجين', `${v.nom}${TYPES_OFFRE.ar[v.dtype] ? ` · ${TYPES_OFFRE.ar[v.dtype]}` : ''}: ${v.titre}`],
  },
  demande_proposition: {
    route: 'offres/demandes',
    fr: v => ['Un lauréat te propose son aide', `${v.nom}${v.entreprise ? ` (${v.entreprise})` : ''} : ${v.titre}`],
    ar: v => ['عرض مساعدة جديد', `${v.nom}${v.entreprise ? ` (${v.entreprise})` : ''}: ${v.titre}`],
  },
  demande_match: {
    route: 'offres/demandes',
    fr: v => ['C’est un match !', `${v.nom} a accepté ton aide : ${v.titre}. Déclare son démarrage dès qu’il a lieu.`],
    ar: v => ['تمّ الاتفاق!', `تم قبول مساعدتك من طرف ${v.nom}: ${v.titre}. صرّح بالبداية بمجرد حدوثها.`],
  },
  demande_rouverte: {
    route: 'offres/demandes',
    fr: v => v.pour === 'auteur' ? ['Ta demande est de nouveau ouverte', `${v.nom} a retiré sa proposition. D’autres lauréats peuvent t’aider : ${v.titre}`]
      : v.pour === 'aidant' ? ['Merci d’avoir proposé ton aide', `${v.nom} a choisi une autre voie : ${v.titre}`]
      : ['Changement sur une demande', `${v.nom} a mis fin au match : ${v.titre}.`],
    ar: v => v.pour === 'auteur' ? ['طلبك مفتوح من جديد', `سُحب اقتراح ${v.nom} للمساعدة. يمكن لخريجين آخرين مساعدتك: ${v.titre}`]
      : v.pour === 'aidant' ? ['شكرًا على اقتراح مساعدتك', `وقع اختيار ${v.nom} على طريق آخر: ${v.titre}`]
      : ['تغيير في طلب', `انتهى الاتفاق مع ${v.nom}: ${v.titre}.`],
  },
  // Une réponse sous ma demande (un conseil, un contact)
  demande_reponse: {
    route: 'offres/demandes',
    fr: v => ['Une réponse à ta demande', `${v.nom}${v.titre ? ` sur « ${v.titre} »` : ''} : ${v.texte}`],
    ar: v => ['رد على طلبك', `رد من ${v.nom}${v.titre ? ` على «${v.titre}»` : ''}: ${v.texte}`],
  },
  // Page Match (catégorie « Match ») : c'est un match (aux deux, ouvre la discussion) ; un oui qui me vise (au plus un par
  // jour pour une même paire) : sur mon offre (lauréat) ou sur mon profil (étudiant) ; un entretien proposé dans la
  // discussion, puis la réponse (« Je serai là » / « Autre horaire »). Prénoms seulement, comme sur l'écran du match.
  match: {
    route: 'match',
    fr: v => ['C’est un match !', `Toi et ${v.nom}, vous pouvez vous écrire.`],
    ar: v => ['تمّ التوافق!', `يمكنك الآن مراسلة ${v.nom}.`],
  },
  match_interet: {
    route: 'match',
    fr: v => v.sur === 'offre' ? ['Nouvel intérêt pour ton offre', `${v.nom} s’intéresse à ton offre${v.titre ? ` « ${v.titre} »` : ''}. Réponds dans Match.`]
      : ['Un lauréat s’intéresse à ton profil', `${v.nom}${v.entreprise ? ` (${v.entreprise})` : ''} s’intéresse à ton profil. Réponds dans Match.`],
    ar: v => v.sur === 'offre' ? ['اهتمام جديد بعرضك', `اهتمام من ${v.nom} بعرضك${v.titre ? ` «${v.titre}»` : ''}. يمكنك الرد في صفحة التوافق.`]
      : ['أحد الخريجين مهتم بملفك', `اهتمام بملفك من ${v.nom}${v.entreprise ? ` (${v.entreprise})` : ''}. يمكنك الرد في صفحة التوافق.`],
  },
  // 15 minutes : un appel ; sans lieu : en visio (le lien est dans la discussion)
  rdv_message: {
    route: 'messages',
    fr: v => [`${v.duree === 15 ? 'Appel proposé' : 'Entretien proposé'}${v.date ? ` : ${v.date} à ${v.heure}` : ''}`,
      `${v.nom} te propose ${v.duree === 15 ? 'un appel' : 'un entretien'}${v.duree ? ` de ${v.duree} min` : ''}${v.lieu ? ` · ${v.lieu}` : ' en visio'}.`],
    ar: v => [`${v.duree === 15 ? 'مكالمة مقترحة' : 'مقابلة مقترحة'}${v.date ? `: ${v.date} على الساعة ${v.heure}` : ''}`,
      `${v.duree === 15 ? 'اقتراح مكالمة' : 'اقتراح مقابلة'} من ${v.nom}${v.duree ? ` (${v.duree} دقيقة)` : ''}${v.lieu ? ` · ${v.lieu}` : ' عبر الفيديو'}.`],
  },
  rdv_reponse: {
    route: 'messages',
    fr: v => v.reponse === 'oui' ? [`${v.nom} sera là`, v.date ? `Entretien du ${v.date} à ${v.heure}.` : 'Ton entretien est confirmé.']
      : v.reponse === 'autre' ? [`${v.nom} propose un autre horaire`, `${v.date ? `Pour l’entretien du ${v.date} à ${v.heure} : c` : 'C'}onvenez d’un autre moment dans la discussion.`] : null,
    ar: v => v.reponse === 'oui' ? [`تأكيد الحضور من ${v.nom}`, v.date ? `مقابلة ${v.date} على الساعة ${v.heure}.` : 'تم تأكيد مقابلتك.']
      : v.reponse === 'autre' ? [`طلب توقيت آخر من ${v.nom}`, `${v.date ? `بخصوص مقابلة ${v.date} على الساعة ${v.heure}: ` : ''}اتفقا على توقيت آخر في المحادثة.`] : null,
  },
  // Réactions sur mon offre ou ma demande : une notification au plus par élément et par heure, le compte du moment
  reaction: {
    route: 'offres',
    fr: v => [v.quoi === 'demande' ? 'Ta demande fait réagir' : 'Ton offre fait réagir',
      v.n > 1 ? `${v.n} réactions, la dernière de ${v.nom}${v.titre ? ` : ${v.titre}` : ''}` : `${v.nom} a réagi${v.emoji ? ` ${v.emoji}` : ''}${v.titre ? ` : ${v.titre}` : ''}`],
    ar: v => [v.quoi === 'demande' ? 'تفاعل مع طلبك' : 'تفاعل مع عرضك',
      v.n > 1 ? `عدد التفاعلات: ${v.n}، آخرها من ${v.nom}${v.titre ? `: ${v.titre}` : ''}` : `تفاعل من ${v.nom}${v.emoji ? ` ${v.emoji}` : ''}${v.titre ? `: ${v.titre}` : ''}`],
  },
  invitation: {
    route: 'offres',
    fr: v => ['Invitation à postuler', `${v.nom} t’invite à postuler : ${v.titre}`],
    ar: v => ['دعوة للترشح', `دعوة من ${v.nom} للترشح: ${v.titre}`],
  },
  reponse: {
    route: 'reseau/entraide',
    fr: v => ['Nouvelle réponse', `${v.nom} a répondu à ta question : ${v.titre}`],
    ar: v => ['جواب جديد', `جواب من ${v.nom} على سؤالك: ${v.titre}`],
  },
  question_routee: {
    route: 'reseau/entraide',
    fr: v => ['Une question pour toi', `Question sur ${v.cible} : ${v.titre}`],
    ar: v => ['سؤال موجّه إليك', `سؤال حول ${v.cible}: ${v.titre}`],
  },
  filleul: {
    route: 'espace',
    fr: v => ['Ton nouveau filleul', `${v.nom} (3A) est ton filleul cette année. Fais-lui signe !`],
    ar: v => ['رعاية جديدة', `${v.nom} (3A) في رعايتك هذه السنة. بادر بالتواصل!`],
  },
  parrain: {
    route: 'accueil',
    fr: v => ['Ton parrain', `Ton parrainage cette année : ${v.nom}, de ta filière.`],
    ar: v => ['عرّابك في الشبكة', `عرّابك هذه السنة: ${v.nom}، من خريجي شعبتك.`],
  },
  cafe: {
    route: 'reseau/groupes',
    fr: v => [`Café ENSAM à ${v.ville}`, `${v.date ? `${v.date} à ${v.heure} · ` : ''}${v.lieu}. Inscris-toi en un clic.`],
    ar: v => [`مقهى ENSAM في ${v.ville}`, `${v.date ? `${v.date} على الساعة ${v.heure} · ` : ''}${v.lieu}. سجّل بنقرة واحدة.`],
  },
  rappel_rdv: {
    route: 'mentorat',
    fr: v => ['Rendez-vous bientôt', `Avec ${v.nom}${v.heure ? ` à ${v.heure}` : ''} : ${v.sujet}`],
    ar: v => ['موعدك قريبًا', `مع ${v.nom}${v.heure ? ` على الساعة ${v.heure}` : ''}: ${v.sujet}`],
  },
  relance_offre: {
    route: 'offres',
    fr: v => ['Ton offre est-elle toujours ouverte ?', `« ${v.titre} » : un clic pour confirmer, ou la marquer pourvue.`],
    ar: v => ['هل لا يزال عرضك مفتوحًا؟', `«${v.titre}»: أكّد بنقرة أنه لا يزال مفتوحًا، أو أشر إلى أنه تم شغله.`],
  },
  // Le texte dit d'où vient l'offre : portée par un lauréat (il encadre), ou partagée (vue ailleurs, à postuler sur le site d'origine)
  // Un lauréat reçoit aussi les offres de sa filière qui ne le visent pas (pour = relayer) : « dans ta filière »
  offre_alerte: {
    route: 'offres',
    fr: v => [v.pour === 'relayer' ? (v.origine === 'partagee' ? 'Offre partagée dans ta filière' : 'Nouvelle offre dans ta filière')
      : v.origine === 'partagee' ? 'Offre partagée pour toi' : 'Nouvelle offre pour toi', `${v.titre}${v.entreprise ? ` · ${v.entreprise}` : ''}${ORIGINE_ALERTE.fr[v.origine || ''] || ''}`],
    ar: v => [v.pour === 'relayer' ? (v.origine === 'partagee' ? 'عرض تمت مشاركته في شعبتك' : 'عرض جديد في شعبتك')
      : v.origine === 'partagee' ? 'عرض تمت مشاركته معك' : 'عرض جديد لك', `${v.titre}${v.entreprise ? ` · ${v.entreprise}` : ''}${ORIGINE_ALERTE.ar[v.origine || ''] || ''}`],
  },
  // Un commentaire sur mon offre ; la réponse de son auteur sous une offre où j'ai écrit
  offre_commentaire: {
    route: 'offres',
    fr: v => v.pour === 'fil' ? ['Réponse sous une offre', `${v.nom} a répondu${v.titre ? ` sous « ${v.titre} »` : ''} : ${v.texte}`]
      : ['Nouveau commentaire sur ton offre', `${v.nom}${v.titre ? ` sur « ${v.titre} »` : ''} : ${v.texte}`],
    ar: v => v.pour === 'fil' ? ['رد تحت عرض', `رد من ${v.nom}${v.titre ? ` تحت «${v.titre}»` : ''}: ${v.texte}`]
      : ['تعليق جديد على عرضك', `تعليق من ${v.nom}${v.titre ? ` على «${v.titre}»` : ''}: ${v.texte}`],
  },
  contact_demande: {
    route: 'accueil',
    fr: v => ['Partager tes coordonnées ?', `${v.nom} aimerait avoir tes coordonnées. Tu acceptes ou non, en un clic.`],
    ar: v => ['مشاركة معلومات الاتصال بك؟', `طلب من ${v.nom} للحصول على معلومات الاتصال بك. القبول أو الرفض بنقرة واحدة.`],
  },
  contact_accepte: {
    route: 'accueil',
    fr: v => ['Coordonnées partagées', `${v.nom} a accepté : ses coordonnées sont sur son profil.`],
    ar: v => ['تمت مشاركة معلومات الاتصال', `تمت الموافقة من ${v.nom}: معلومات الاتصال في الملف الشخصي.`],
  },
  relecture_demande: {
    route: 'mentorat/cv',
    fr: v => ['Un CV à relire', `${v.nom} cherche un lauréat pour relire son CV.`],
    ar: v => ['سيرة ذاتية للمراجعة', `طلب من ${v.nom}: مراجعة سيرة ذاتية.`],
  },
  relecture_prise: {
    route: 'mentorat/cv',
    fr: v => ['Relecture en cours', `${v.nom} relit ton CV.`],
    ar: v => ['المراجعة جارية', `مراجعة سيرتك الذاتية جارية مع ${v.nom}.`],
  },
  relecture_rendue: {
    route: 'mentorat/cv',
    fr: v => ['Ton CV a été relu', `${v.nom} t’a laissé ses conseils. Lis-les, puis dis merci.`],
    ar: v => ['تمت مراجعة سيرتك الذاتية', `نصائح جديدة من ${v.nom}. اطّلع عليها ثم قل شكرًا.`],
  },
  signalement: {
    route: 'admin/moderation',
    fr: v => ['Nouveau signalement', `Motif : ${MOTIFS.fr[v.motif] || MOTIFS.fr.autre}. À regarder dans la modération.`],
    ar: v => ['تبليغ جديد', `السبب: ${MOTIFS.ar[v.motif] || MOTIFS.ar.autre}. راجعه في صفحة الإشراف.`],
  },
  verification_pair: {
    route: 'profil',
    fr: v => v.n >= 2 ? ['Ton profil est vérifié', `${v.nom} a confirmé ta promo. Ton badge « Lauréat vérifié » est là.`]
      : ['Ta promo confirmée une fois', `${v.nom} a confirmé que tu es de sa promo. Encore un lauréat et ton badge arrive.`],
    ar: v => v.n >= 2 ? ['تم التحقق من حسابك', `تأكيد دفعتك من ${v.nom}. شارة «خريج موثَّق» صارت لك.`]
      : ['تأكيد أول لدفعتك', `تأكيد من ${v.nom}: أنتما من نفس الدفعة. تأكيد واحد آخر وتصلك الشارة.`],
  },
  verifier_pair: {
    route: 'accueil',
    fr: v => ['Un lauréat de ta promo', `${v.nom} vient de rejoindre le réseau${v.promo ? ` (promo ${v.promo})` : ''}. Confirme-le si tu le connais.`],
    ar: v => ['خريج من دفعتك', `انضمام جديد إلى الشبكة: ${v.nom}${v.promo ? ` (دفعة ${v.promo})` : ''}. أكّد الهوية إن كانت لك معرفة سابقة.`],
  },
  // Nouveaux membres de ma promo : au plus une par jour, avec le nombre d'arrivées depuis la précédente
  promo_nouveau: {
    route: 'reseau/annuaire',
    fr: v => [v.n > 1 ? `${v.nom} et ${v.n - 1} autre${v.n > 2 ? 's' : ''} ont rejoint ta promo` : `${v.nom} a rejoint ta promo`,
      `${v.promo ? `Promo ${v.promo} : retrouve` : 'Retrouve'} tes camarades dans l’annuaire.`],
    ar: v => v.n > 1 ? [`أعضاء جدد في دفعتك: ${v.n}`, `منهم ${v.nom}. تجد زملاء دفعتك${v.promo ? ` (${v.promo})` : ''} في الدليل.`]
      : [`انضمام جديد إلى دفعتك: ${v.nom}`, `تجد زملاء دفعتك${v.promo ? ` (${v.promo})` : ''} في الدليل.`],
  },
  annonce: {
    route: 'accueil',
    fr: v => v.texte ? ['Annonce du Réseau ENSAM', v.texte] : null,
    ar: v => v.texte ? ['إعلان من شبكة ENSAM', v.texte] : null,
  },
  evenement: {
    route: 'reseau/agenda',
    fr: v => [`À l’agenda : ${v.titre}`, [v.date ? `${v.date} à ${v.heure}` : '', v.lieu].filter(Boolean).join(' · ') || 'Nouvel événement.'],
    ar: v => [`في أجندة الشبكة: ${v.titre}`, [v.date ? `${v.date} على الساعة ${v.heure}` : '', v.lieu].filter(Boolean).join(' · ') || 'نشاط جديد.'],
  },
  evenement_annule: {
    route: 'reseau/agenda',
    fr: v => ['Événement annulé', v.titre],
    ar: v => ['تم إلغاء النشاط', v.titre],
  },
  evenement_deplace: {
    route: 'reseau/agenda',
    fr: v => ['Nouvelle date', v.date ? `${v.titre} : ${v.date} à ${v.heure}` : v.titre],
    ar: v => ['موعد جديد', v.date ? `${v.titre}: ${v.date} على الساعة ${v.heure}` : v.titre],
  },
  enquete: {
    route: 'enquete',
    fr: v => ['Enquête d’insertion', `${v.vague || 6} mois après ton diplôme : 2 minutes pour aider les promos suivantes.`],
    ar: v => ['استمارة الإدماج المهني', `${v.vague || 6} أشهر بعد تخرجك: دقيقتان لمساعدة الدفعات القادمة.`],
  },
  // Une notification par message, la même pour toute la conversation (tag) : le nombre de non lus, puis le dernier
  message: {
    route: 'messages',
    fr: v => [v.nom, v.n > 1 ? `${v.n} nouveaux messages · ${apercuMessage(v, 'fr')}` : apercuMessage(v, 'fr')],
    ar: v => [v.nom, v.n > 1 ? `رسائل جديدة: ${v.n} · ${apercuMessage(v, 'ar')}` : apercuMessage(v, 'ar')],
  },
  // Rappel de visite : texte écrit par notifRappel (les chiffres de chaque chose qui attend ne tiennent pas dans V)
  rappel_visite: {
    route: 'accueil',
    fr: () => null,
    ar: () => null,
  },
  test: {
    route: 'accueil',
    fr: () => ['Notifications activées', 'Tu recevras ici les nouvelles importantes du Réseau ENSAM.'],
    ar: () => ['تم تفعيل الإشعارات', 'ستصلك هنا أهم أخبار شبكة ENSAM.'],
  },
};

const ORIGINE_ALERTE: Record<Langue, Record<string, string>> = {
  fr: { portee: ' · portée par un lauréat, qui encadre', partagee: ' · vue ailleurs, partagée par un membre du réseau' },
  ar: { portee: ' · يقدّمه خريج مع التأطير', partagee: ' · منشور في موقع آخر، شاركه عضو في الشبكة' },
};

const MOTIFS: Record<Langue, Record<string, string>> = {
  fr: { spam: 'spam', arnaque: 'arnaque', inapproprie: 'contenu inapproprié', faux: 'fausse information', harcelement: 'harcèlement', donnees: 'données personnelles', autre: 'autre' },
  ar: { spam: 'رسائل مزعجة', arnaque: 'احتيال', inapproprie: 'محتوى غير لائق', faux: 'معلومة خاطئة', harcelement: 'تحرش', donnees: 'معطيات شخصية', autre: 'سبب آخر' },
};

// Notification prête à envoyer : { title, body, url, tag } ; null si le type est inconnu
export function texteNotif(kind: string, data: unknown, langue: unknown, site: string): Notif | null {
  if (!Object.prototype.hasOwnProperty.call(NOTIFS, kind)) return null;
  if (kind === 'rappel_visite') return notifRappel(data, langue, site);
  const g = NOTIFS[kind], l = langueDe(langue);
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  // En arabe, le contenu des membres (souvent en français) est isolé pour ne pas mélanger le sens de lecture
  const s = (k: string) => { const x = txt(d[k]); return x && l === 'ar' ? `\u2068${x}\u2069` : x; };
  const q = quand(d.rdv_at ?? d.date_at ?? d.debut, l);
  const v: V = {
    nom: s('nom') || (l === 'ar' ? 'عضو في الشبكة' : 'Un membre'), sujet: s('sujet'), titre: s('titre'),
    entreprise: s('entreprise'), cible: s('cible'), ville: s('ville'), lieu: s('lieu'), statut: txt(d.statut),
    date: q?.date || '', heure: q?.heure || '',
    promo: /^\d{4}$/.test(txt(d.promo)) ? txt(d.promo) : '', n: Number(d.n) || 0,
    vague: txt(d.vague) === '12' ? '12' : txt(d.vague) === '6' ? '6' : '', motif: txt(d.motif),
    texte: s('texte'), mtype: txt(d.type), duree: Math.max(0, Math.min(600, Number(d.duree) || 0)),
    aide: ['recrute', 'encadre', 'recommande'].includes(txt(d.aide)) ? txt(d.aide) : '', dtype: txt(d.type),
    pour: ['demandeur', 'mentor', 'auteur', 'aidant', 'fil', 'relayer'].includes(txt(d.pour)) ? txt(d.pour) : '',
    // Offre portée par un lauréat (il encadre) ou partagée (vue ailleurs) ; rien pour une offre classique
    origine: ['portee', 'partagee'].includes(txt(d.origine)) ? txt(d.origine) : '',
    emoji: EMOJIS_PUBLICS.includes(txt(d.emoji)) ? txt(d.emoji) : '', quoi: estUuid(d.demande) ? 'demande' : 'offre',
    // Entretien : la réponse du destinataire ; intérêt (Match) : sur une offre, sinon sur le profil
    reponse: ['oui', 'autre'].includes(txt(d.reponse)) ? txt(d.reponse) : '', sur: estUuid(d.offre) ? 'offre' : 'profil',
  };
  const t = g[l](v);
  if (!t) return null;
  // Une alerte ouvre directement l'offre, un message sa conversation (une notification par personne)
  // Une demande ouvre sa carte ; une nouvelle demande, pour un lauréat, ouvre directement « Je peux aider », prérempli
  const dem = kind.startsWith('demande_') && estUuid(d.demande) ? d.demande : null;
  const annule = kind === 'mentorat_annule' && estUuid(d.m) ? d.m : null;
  // Une réaction ouvre l'élément : l'offre, ou la carte de la demande ; une seule notification par élément sur le téléphone
  const rx = kind === 'reaction' ? (estUuid(d.offre) ? { route: `offre/${d.offre}`, id: d.offre } : estUuid(d.demande) ? { route: `offres/demandes/${d.demande}`, id: d.demande } : null) : null;
  // Un commentaire ouvre l'offre ; une notification par offre sur le téléphone
  const com = kind === 'offre_commentaire' && estUuid(d.offre) ? d.offre : null;
  // Match : un match et un entretien ouvrent la discussion avec l'autre personne (de) ; un intérêt, la page Match
  const disc = (kind === 'match' || kind === 'rdv_message' || kind === 'rdv_reponse') && estUuid(d.de) ? d.de : null;
  const mt = kind === 'match' && estUuid(d.match) ? d.match : (kind === 'rdv_message' || kind === 'rdv_reponse') && estUuid(d.m) ? d.m
    : kind === 'match_interet' && estUuid(d.de) ? d.de : null;
  const route = disc ? `messages/${disc}` : rx ? rx.route : kind === 'offre_alerte' && estUuid(d.offre) ? `offre/${d.offre}` : com ? `offre/${com}` : kind === 'message' && estUuid(d.de) ? `messages/${d.de}`
    : annule && v.pour === 'demandeur' ? `mentorat/reprendre/${annule}`
    : dem ? (kind === 'demande_nouvelle' || kind === 'demande_large' ? `aider/${dem}` : `offres/demandes/${dem}`) : g.route;
  const tag = rx ? `reaction-${rx.id}` : kind === 'offre_alerte' && estUuid(d.offre) ? `offre-${d.offre}` : com ? `${kind}-${com}`
    : kind === 'message' && estUuid(d.de) ? `message-${d.de}` : dem ? `${kind}-${dem}` : annule ? `${kind}-${annule}` : mt ? `${kind}-${mt}` : kind;
  // Message arrivé moins de 20 s après le précédent de la conversation : l'aperçu change sans sonner
  return { title: couper(t[0], 80), body: couper(t[1], 180), url: site + '#' + route, tag, ...(kind === 'message' && d.calme === true ? { calme: true } : {}) };
}

// ---------------------------------------------------------------------
// Résumé hebdomadaire : les données
// ---------------------------------------------------------------------
export type Profil = {
  id: string; full_name: string; role: string; filiere: string; promo: number;
  entreprise?: string | null; pays?: string | null; ville?: string | null; vitrine?: boolean | null;
  verified?: boolean | null; cv_url?: string | null; cv_path?: string | null; competences?: string[] | null; created_at: string;
  en_recherche?: boolean | null;
};
export type Offre = {
  id: string; author_id: string; titre: string; entreprise: string; filieres?: string[] | null; annees?: number[] | null;
  audience?: string | null; status: string; created_at: string; relance_at?: string | null;
};
export type Candidature = { id: string; student_id: string; offer_id: string | null; status: string };
export type Invitation = { id: string; laureat_id: string; student_id: string; offer_id: string; status: string };
export type Mentorat = { id: string; student_id: string; mentor_id: string | null; sujet: string; status: string; rdv_at: string | null; merci?: string | null; created_at?: string };
export type Question = { id: string; author_id: string; titre: string; entreprise?: string | null; pays?: string | null; created_at: string };
export type Reponse = { id: string; question_id: string; author_id: string; created_at: string };
export type Parrainage = { id: string; filleul_id: string; parrain_id: string; created_at: string };
export type Cafe = { id: string; organisateur_id: string; ville: string; lieu: string; date_at: string; annule?: boolean };
export type Placement = {
  id: string; student_id: string; laureat_id: string | null; saison: number; status: string;
  entreprise: string; type?: string | null; pays?: string | null; merci?: string | null; confirmed_at?: string | null;
};
// Points d'un recrutement confirmé, même barème que logic.js (pointsRecrutement) : 50, +25 à l'international
export const pointsRecrutement = (p: { type?: string | null; pays?: string | null }) => 50 + (p.type === 'etranger' || (!!p.pays && p.pays !== 'Maroc') ? 25 : 0);
export type Evenement = { id: string; titre: string; debut: string; lieu?: string | null; public: string; annule?: boolean };
export type Relecture = { id: string; student_id: string; reviewer_id: string | null; status: string };
export type DemandeContact = { id: string; demandeur_id: string; cible_id: string; status: string };
// Ambassadeur de promo et les chiffres de sa promo pour un mois (chiffres_ambassadeurs, schema.sql)
export type ChiffresPromo = {
  user_id: string; promo: number; filiere: string;
  chiffres: { inscrits: number; nouveaux: number; demandes: number; demandes_mois: number; stages: number; stages_mois: number };
};
export type Brut = {
  profils: Profil[]; offres: Offre[]; candidatures: Candidature[]; invitations: Invitation[]; mentorats: Mentorat[];
  questions: Question[]; reponses: Reponse[]; parrainages: Parrainage[]; cafes: Cafe[]; placements: Placement[];
  // Phase 3 (absents tant que la base n'est pas à jour)
  evenements?: Evenement[]; enquetes?: { user_id: string; vague: number }[]; relectures?: Relecture[];
  demandesContact?: DemandeContact[]; signalements?: number;
  // Ambassadeurs : seulement le premier résumé du mois (jours 1 à 7), avec les chiffres du mois précédent
  ambassadeurs?: ChiffresPromo[]; moisAmbassadeurs?: string;
};

// Nom d'entreprise comparable, comme cle_entreprise() en SQL : « Renault Group Maroc » -> « renault »
const ACCENTS = 'ÀÂÄÁÃÉÈÊËÍÎÏÌÓÔÖÒÕÚÛÜÙÇÑàâäáãéèêëíîïìóôöòõúûüùçñ';
const SANS = 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn';
export function cleEntreprise(t: string | null | undefined): string | null {
  let s = '';
  for (const c of t || '') { const i = ACCENTS.indexOf(c); s += i >= 0 ? SANS[i] : c; }
  s = s.toLowerCase()
    .replace(/\([\s\S]*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(group|groupe|maroc|morocco|sa|sas|sarl|ltd|inc|the|le|la|les|de|du|des|corporation|operations|international)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s || null;
}
export function memeEntreprise(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = cleEntreprise(a), y = cleEntreprise(b);
  return !!x && !!y && (x === y || x.startsWith(y + ' ') || y.startsWith(x + ' '));
}
const normVille = (s: string | null | undefined) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const normPays = (s: string | null | undefined) => (s || '').toLowerCase().trim();

const ACTIF = new Set(['declare', 'confirme', 'en_attente']);   // a trouvé, ou attend de confirmer

type Talent = { p: Profil; niveau: number; nouveau: boolean; cv: boolean };
export type Donnees = {
  now: number; depuis7: number; depuis14: number; saison: number;
  profils: Map<string, Profil>; offres: Map<string, Offre>; nouvellesOffres: Offre[];
  offresParAuteur: Map<string, Offre[]>; postuleParAuteur: Map<string, number>; dejaPostule: Set<string>;
  invitations: Map<string, Invitation[]>; mentoratsEtudiant: Map<string, Mentorat[]>; mentoratsMentor: Map<string, Mentorat[]>;
  ouvertes: Mentorat[]; questions: Map<string, Question>; questionsRecentes: Question[]; reponses: Reponse[]; repondues: Set<string>;
  parrainages: Parrainage[]; cafes: Cafe[]; placementsEtudiant: Map<string, Placement[]>; placementsLaureat: Map<string, Placement[]>;
  enAttente: number; talents: Talent[]; arrivees: Profil[];
  evenements: Evenement[]; enquetesFaites: Set<string>; relectures: Relecture[]; contactsEnAttente: Map<string, number>; signalements: number;
  ambassadeurs?: Map<string, ChiffresPromo>; moisAmbassadeurs?: string;
};

export function indexer(b: Brut, date: Date): Donnees {
  const now = date.getTime(), depuis7 = now - 7 * JOUR, depuis14 = now - 14 * JOUR, saison = saisonDe(date);
  const profils = new Map(b.profils.map(p => [p.id, p]));
  const offres = new Map(b.offres.map(o => [o.id, o]));
  const postuleParAuteur = new Map<string, number>();
  for (const a of b.candidatures) {
    const o = a.offer_id ? offres.get(a.offer_id) : undefined;
    if (a.status === 'postule' && o && o.author_id !== a.student_id) postuleParAuteur.set(o.author_id, (postuleParAuteur.get(o.author_id) || 0) + 1);
  }
  const placements = unique(b.placements);
  const placementsEtudiant = grouper(placements, x => x.student_id);
  // Talents : étudiants visibles de 3A à 5A sans stage trouvé cette saison (chaque lauréat reçoit ceux de son parcours)
  const talents: Talent[] = [];
  for (const p of b.profils) {
    if (p.role !== 'etudiant' || p.vitrine === false || !p.filiere) continue;
    const niveau = niveauDe(p.promo, saison);
    if (niveau < 3 || niveau > 5) continue;
    if ((placementsEtudiant.get(p.id) || []).some(x => x.saison === saison && ACTIF.has(x.status))) continue;
    const t = { p, niveau, nouveau: temps(p.created_at) >= depuis7, cv: !!txt(p.cv_url) || !!txt(p.cv_path) };
    talents.push(t);
  }
  talents.sort((x, y) => (+y.nouveau - +x.nouveau) || (+y.cv - +x.cv) || (temps(y.p.created_at) - temps(x.p.created_at)));
  const mentorats = unique(b.mentorats);
  const reponses = unique(b.reponses);
  return {
    now, depuis7, depuis14, saison, profils, offres,
    nouvellesOffres: b.offres.filter(o => o.status === 'ouverte' && temps(o.created_at) >= depuis7).sort((x, y) => temps(y.created_at) - temps(x.created_at)),
    offresParAuteur: grouper(b.offres, o => o.author_id),
    postuleParAuteur,
    dejaPostule: new Set(b.candidatures.map(a => `${a.student_id}|${a.offer_id}`)),
    invitations: grouper(b.invitations.filter(i => i.status === 'envoyee'), i => i.student_id),
    mentoratsEtudiant: grouper(mentorats, m => m.student_id),
    mentoratsMentor: grouper(mentorats, m => m.mentor_id),
    ouvertes: mentorats.filter(m => !m.mentor_id && m.status === 'demande').sort((x, y) => temps(x.created_at) - temps(y.created_at)),
    questions: new Map(b.questions.map(q => [q.id, q])),
    questionsRecentes: unique(b.questions).filter(q => temps(q.created_at) >= depuis14 && (txt(q.entreprise) || txt(q.pays))),
    reponses,
    repondues: new Set(reponses.map(r => `${r.author_id}|${r.question_id}`)),
    parrainages: b.parrainages.filter(x => temps(x.created_at) >= depuis7),
    cafes: b.cafes.filter(c => !c.annule && temps(c.date_at) >= now && temps(c.date_at) <= now + 14 * JOUR)
      .sort((x, y) => temps(x.date_at) - temps(y.date_at)),
    placementsEtudiant,
    placementsLaureat: grouper(placements, x => x.laureat_id),
    enAttente: placements.filter(x => x.status === 'en_attente').length,
    talents,
    // Nouveaux membres de la semaine (étudiants et lauréats), du plus récent au plus ancien
    arrivees: b.profils.filter(p => (p.role === 'etudiant' || p.role === 'laureat') && temps(p.created_at) >= depuis7 && temps(p.created_at) <= now)
      .sort((x, y) => temps(y.created_at) - temps(x.created_at)),
    evenements: (b.evenements || []).filter(e => !e.annule && temps(e.debut) >= now && temps(e.debut) <= now + 14 * JOUR)
      .sort((x, y) => temps(x.debut) - temps(y.debut)),
    enquetesFaites: new Set((b.enquetes || []).map(e => `${e.user_id}|${e.vague}`)),
    relectures: (b.relectures || []).filter(x => x.status === 'demandee'),
    contactsEnAttente: (() => { const m = new Map<string, number>(); for (const x of b.demandesContact || []) if (x.status === 'envoyee') m.set(x.cible_id, (m.get(x.cible_id) || 0) + 1); return m; })(),
    signalements: b.signalements || 0,
    ambassadeurs: new Map((b.ambassadeurs || []).filter(x => x && x.user_id && x.chiffres).map(x => [x.user_id, x])),
    moisAmbassadeurs: b.moisAmbassadeurs,
  };
}

// Le premier résumé du mois (il part une fois par semaine : les jours 1 à 7 n'en voient qu'un) porte les chiffres du
// mois précédent : son premier jour (UTC), ou null les autres jours
export function moisPrecedent(date: Date): string | null {
  if (date.getUTCDate() > 7) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1)).toISOString();
}

// Vague de l'enquête d'insertion ouverte pour une promo (comme vague_ouverte() en SQL), ou 0
export function vagueOuverte(promo: number, date: Date): number {
  const y = date.getUTCFullYear(), m = date.getUTCMonth();
  if (y === promo + 1 && m < 6) return 6;
  if ((y === promo + 1 && m >= 6) || (y === promo + 2 && m < 3)) return 12;
  return 0;
}

// Ce que le résumé d'un membre contient (sans la langue)
type Rdv = { nom: string; sujet: string; at: string };
export type Resume = {
  role: 'etudiant' | 'laureat' | 'admin'; prenom: string;
  aConfirmer: { entreprise: string; nom: string }[];
  invitations: { nom: string; titre: string; entreprise: string }[];
  candidatures: number;
  demandes: { nom: string; sujet: string }[];
  rdv: Rdv[];
  aClore: { nom: string; sujet: string }[];
  questions: { titre: string; cible: string }[];
  relances: string[];
  offres: { total: number; liste: { titre: string; entreprise: string }[] };
  reponses: { titre: string; n: number }[];
  parrain: string;
  talents: { total: number; liste: { prenom: string; niveau: number; competences: string[]; nouveau: boolean }[] };
  ouvertes: { total: number; sujets: string[] };
  impact: { mercis: number; recrutements: number; ptsRecrutements?: number; citation: { texte: string; prenom: string } | null };
  filleuls: string[];
  cafes: { ville: string; lieu: string; at: string }[];
  admin: { nonVerifies: number; nouveaux: number; enAttente: number; signalements?: number };
  // Phase 3 (facultatifs : un résumé construit sans eux reste valable)
  evenements?: { titre: string; at: string; lieu: string }[];
  enquete?: number; contacts?: number; relectures?: number;
  // Nouveaux de sa promo ou de sa filière (5 noms au plus) ; reseau : toutes les arrivées de la semaine
  arrivees?: { total: number; liste: Arrivee[]; reseau: { laureats: number; etudiants: number } };
  // Ambassadeur de promo : les chiffres vrais de sa promo le mois dernier (mois : 0 à 11)
  promo?: { promo: number; filiere: string; mois: number; inscrits: number; nouveaux: number; demandes: number; demandesMois: number; stages: number; stagesMois: number };
};
export type Arrivee = { nom: string; promo: number; niveau: number };

export function estVide(r: Resume): boolean {
  return !(r.aConfirmer.length || r.invitations.length || r.candidatures || r.demandes.length || r.rdv.length || r.aClore.length
    || r.questions.length || r.relances.length || r.offres.total || r.reponses.length || r.parrain || r.talents.total
    || r.ouvertes.total || r.impact.mercis || r.impact.recrutements || r.filleuls.length || r.cafes.length
    || r.admin.nonVerifies || r.admin.nouveaux || r.admin.enAttente || r.admin.signalements
    || r.evenements?.length || r.enquete || r.contacts || r.relectures || r.arrivees?.total || r.promo);
}

// Filières officielles (choix en 3A) groupées par parcours, et anciennes appellations des promos précédentes (même règle que logic.js)
const PARCOURS_FILIERE: Record<string, string[]> = {
  'Génie Industriel et Productique': ['PEI'], 'Génie Industriel : Excellence Opérationnelle': ['PEI'],
  'Génie Électromécanique : Digitalisation Industrielle': ['PEI'], 'Génie Électromécanique : Maintenance et Commande Industrielles': ['PEI'],
  'Génie Mécanique : Conception et Industrialisation des Systèmes Mécaniques': ['PM'], 'Génie Mécanique : Ingénierie Mécanique et Structures': ['PM'],
  'Génie Mécanique : Matériaux et Procédés de Fabrication': ['PM'], 'Génie Mécanique : Énergétique': ['PM'], 'Génie Civil': ['CIVIL'],
  'Intelligence Artificielle et Technologies des Données : Systèmes Industriels': ['IA'], 'Génie Informatique : Ingénierie Logicielle et Systèmes Intelligents': ['INFO'],
};
const ANCIENNES_FILIERES: Record<string, string[]> = {
  'Génie Mécanique': ['PM'], 'Génie Industriel': ['PEI'], 'Génie Électromécanique': ['PEI'], 'Génie Énergétique': ['PM'], 'Mécatronique': ['PEI'], 'Génie Informatique & IA': ['INFO', 'IA'],
};
const parcoursDe = (f?: string | null) => (f ? PARCOURS_FILIERE[f] || ANCIENNES_FILIERES[f] || [] : []);
// Même filière, ou même parcours
const procheFiliere = (a?: string | null, b?: string | null) => !!a && !!b && (a === b || parcoursDe(a).some(c => parcoursDe(b).includes(c)));
// Deux filières actuelles doivent être identiques ; une ancienne appellation couvre son parcours
export const filiereOk = (o: Pick<Offre, 'filieres'>, filiere: string) => {
  const l = o.filieres || [];
  if (!l.length) return true;
  if (!filiere) return false;
  if (l.includes(filiere)) return true;
  const mine = parcoursDe(filiere), vieille = !PARCOURS_FILIERE[filiere];
  return l.some(x => (vieille || !PARCOURS_FILIERE[x]) && parcoursDe(x).some(c => mine.includes(c)));
};

// entreLaureats : un lauréat qui cherche un emploi reçoit aussi les offres entre lauréats de sa filière
function offresPour(d: Donnees, p: Profil, niveau: number, audiences: string[], entreLaureats = false) {
  const l = d.nouvellesOffres.filter(o => o.author_id !== p.id && filiereOk(o, p.filiere)
    && ((entreLaureats && o.audience === 'laureats') || (audiences.includes(o.audience || 'etudiants') && (o.annees || []).includes(niveau))));
  return { total: l.length, liste: l.slice(0, 3).map(o => ({ titre: txt(o.titre), entreprise: txt(o.entreprise) })) };
}

// Résumé d'un membre ; null s'il n'y a rien à lui dire cette semaine
export function resumeVide(p: Profil): Resume {
  return {
    role: p.role === 'admin' ? 'admin' : p.role === 'laureat' ? 'laureat' : 'etudiant', prenom: prenomDe(p.full_name),
    aConfirmer: [], invitations: [], candidatures: 0, demandes: [], rdv: [], aClore: [], questions: [], relances: [],
    offres: { total: 0, liste: [] }, reponses: [], parrain: '', talents: { total: 0, liste: [] }, ouvertes: { total: 0, sujets: [] },
    impact: { mercis: 0, recrutements: 0, ptsRecrutements: 0, citation: null }, filleuls: [], cafes: [], admin: { nonVerifies: 0, nouveaux: 0, enAttente: 0, signalements: 0 },
    evenements: [], enquete: 0, contacts: 0, relectures: 0, arrivees: { total: 0, liste: [], reseau: { laureats: 0, etudiants: 0 } },
  };
}

export function resumeDe(p: Profil, d: Donnees): Resume | null {
  const nom = (id: string | null | undefined) => txt(id ? d.profils.get(id)?.full_name : '');
  const r = resumeVide(p);

  if (r.role === 'admin') {
    for (const x of d.profils.values()) {
      if (x.role === 'laureat' && !x.verified) r.admin.nonVerifies++;
      if (temps(x.created_at) >= d.depuis7) r.admin.nouveaux++;
    }
    r.admin.enAttente = d.enAttente;
    r.admin.signalements = d.signalements;
    return estVide(r) ? null : r;
  }

  const laureat = r.role === 'laureat';
  // Rendez-vous de mentorat : à venir (7 jours) et passés pas encore clos
  const mes = (laureat ? d.mentoratsMentor : d.mentoratsEtudiant).get(p.id) || [];
  for (const m of [...mes].sort((x, y) => temps(x.rdv_at) - temps(y.rdv_at))) {
    if (m.status !== 'acceptee' || !m.rdv_at) continue;
    const t = temps(m.rdv_at), autre = nom(laureat ? m.student_id : m.mentor_id);
    if (t + RDV_MIN * 6e4 < d.now) r.aClore.push({ nom: autre, sujet: txt(m.sujet) });
    else if (t >= d.now && t <= d.now + 7 * JOUR) r.rdv.push({ nom: autre, sujet: txt(m.sujet), at: m.rdv_at });
  }
  // Nouvelles réponses à ses questions
  const parQuestion = new Map<string, number>();
  for (const a of d.reponses) {
    if (a.author_id === p.id || temps(a.created_at) < d.depuis7) continue;
    if (d.questions.get(a.question_id)?.author_id === p.id) parQuestion.set(a.question_id, (parQuestion.get(a.question_id) || 0) + 1);
  }
  for (const [id, n] of parQuestion) r.reponses.push({ titre: txt(d.questions.get(id)?.titre), n });
  // Agenda de l'école (14 jours), enquête d'insertion ouverte, demandes de coordonnées
  r.evenements = (d.evenements || []).filter(e => e.public === 'tous' || (e.public === 'etudiants' && !laureat) || (e.public === 'laureats' && laureat))
    .slice(0, 3).map(e => ({ titre: txt(e.titre), at: e.debut, lieu: txt(e.lieu) }));
  const vague = laureat || niveauDe(p.promo, d.saison) >= 6 ? vagueOuverte(p.promo, new Date(d.now)) : 0;
  r.enquete = vague && !d.enquetesFaites?.has(`${p.id}|${vague}`) ? vague : 0;
  r.contacts = d.contactsEnAttente?.get(p.id) || 0;
  // Cafés ENSAM dans sa ville (14 jours)
  const ville = normVille(p.ville);
  if (ville) {
    r.cafes = d.cafes.filter(c => c.organisateur_id !== p.id && normVille(c.ville) === ville).slice(0, 3)
      .map(c => ({ ville: txt(c.ville), lieu: txt(c.lieu), at: c.date_at }));
  }

  // Qui vient d'arriver : un étudiant voit sa promo et les lauréats de sa filière ; un lauréat, sa promo et sa filière
  const autres = (d.arrivees || []).filter(x => x.id !== p.id);
  const proches = autres.filter(x => laureat
    ? (x.role === 'laureat' && x.promo === p.promo) || procheFiliere(x.filiere, p.filiere)
    : (x.role === 'etudiant' && x.promo === p.promo) || (x.role === 'laureat' && procheFiliere(x.filiere, p.filiere)));
  proches.sort((x, y) => +(y.promo === p.promo) - +(x.promo === p.promo));
  r.arrivees = {
    total: proches.length,
    liste: proches.slice(0, 5).map(x => {
      const n = x.role === 'etudiant' ? niveauDe(x.promo, d.saison) : 0;
      return { nom: couper(txt(x.full_name), 40), promo: x.promo, niveau: n >= 1 && n <= 5 ? n : 0 };
    }),
    reseau: { laureats: autres.filter(x => x.role === 'laureat').length, etudiants: autres.filter(x => x.role === 'etudiant').length },
  };
  // Ambassadeur de sa promo : ses chiffres du mois dernier, une fois par mois
  const amb = d.ambassadeurs?.get(p.id);
  if (amb && d.moisAmbassadeurs) {
    const c = amb.chiffres;
    r.promo = { promo: amb.promo, filiere: txt(amb.filiere), mois: new Date(d.moisAmbassadeurs).getUTCMonth(), inscrits: +c.inscrits || 0, nouveaux: +c.nouveaux || 0,
      demandes: +c.demandes || 0, demandesMois: +c.demandes_mois || 0, stages: +c.stages || 0, stagesMois: +c.stages_mois || 0 };
  }

  if (!laureat) {
    const niveau = niveauDe(p.promo, d.saison);
    for (const x of d.placementsEtudiant.get(p.id) || []) {
      if (x.status === 'en_attente') r.aConfirmer.push({ entreprise: txt(x.entreprise), nom: nom(x.laureat_id) });
    }
    for (const i of d.invitations.get(p.id) || []) {
      const o = d.offres.get(i.offer_id);
      if (!o || o.status !== 'ouverte' || d.dejaPostule.has(`${p.id}|${o.id}`)) continue;
      r.invitations.push({ nom: nom(i.laureat_id), titre: txt(o.titre), entreprise: txt(o.entreprise) });
    }
    r.offres = offresPour(d, p, niveau, ['etudiants']);
    const pr = d.parrainages.find(x => x.filleul_id === p.id);
    r.parrain = pr ? nom(pr.parrain_id) : '';
    return estVide(r) ? null : r;
  }

  // Lauréat
  r.candidatures = d.postuleParAuteur.get(p.id) || 0;
  r.demandes = mes.filter(m => m.status === 'demande').map(m => ({ nom: nom(m.student_id), sujet: txt(m.sujet) }));
  // Questions routées vers lui (même entreprise, ou même pays hors Maroc), sans réponse de sa part
  const pays = normPays(p.pays);
  for (const q of d.questionsRecentes) {
    if (q.author_id === p.id || d.repondues.has(`${p.id}|${q.id}`)) continue;
    const parEntreprise = !!txt(q.entreprise) && memeEntreprise(p.entreprise, q.entreprise);
    const parPays = !!pays && pays !== 'maroc' && normPays(q.pays) === pays;
    if (parEntreprise || parPays) r.questions.push({ titre: txt(q.titre), cible: txt(q.entreprise) || txt(q.pays) });
  }
  for (const o of d.offresParAuteur.get(p.id) || []) {
    if (o.status === 'ouverte' && temps(o.relance_at) >= d.depuis7) r.relances.push(txt(o.titre));
  }
  // Jeune diplômé de l'année, ou lauréat qui cherche un emploi : les offres pour les diplômés (niveau 6)
  if (p.promo === d.saison || p.en_recherche) r.offres = offresPour(d, p, 6, ['etudiants', 'laureats'], !!p.en_recherche);
  // Alerte talents de son parcours
  const t = d.talents.filter(x => procheFiliere(x.p.filiere, p.filiere));
  r.talents = {
    total: t.length,
    liste: t.slice(0, 3).map(x => ({
      prenom: prenomDe(x.p.full_name), niveau: x.niveau, nouveau: x.nouveau,
      competences: (x.p.competences || []).map(c => couper(txt(c), 30)).filter(Boolean).slice(0, 3),
    })),
  };
  // Demandes d'aide ouvertes à tous, venant d'étudiants de sa filière
  const ouv = d.ouvertes.filter(m => m.student_id !== p.id && procheFiliere(d.profils.get(m.student_id)?.filiere, p.filiere));
  r.ouvertes = { total: ouv.length, sujets: ouv.slice(0, 2).map(m => txt(m.sujet)) };
  // Impact de la semaine : mercis et recrutements confirmés
  let derniere = -Infinity;
  const merci = (texte: string | null | undefined, eleve: string, at: number) => {
    if (!txt(texte)) return;
    r.impact.mercis++;
    if (at > derniere) { derniere = at; r.impact.citation = { texte: couper(txt(texte), 140), prenom: prenomDe(nom(eleve)) }; }
  };
  for (const x of d.placementsLaureat.get(p.id) || []) {
    const at = temps(x.confirmed_at);
    if (!(at >= d.depuis7 && at <= d.now)) continue;
    if (x.status === 'confirme') { r.impact.recrutements++; r.impact.ptsRecrutements = (r.impact.ptsRecrutements || 0) + pointsRecrutement(x); }
    merci(x.merci, x.student_id, at);
  }
  for (const m of mes) {
    const at = temps(m.rdv_at);
    if (at >= d.depuis7 && at <= d.now) merci(m.merci, m.student_id, at);
  }
  r.filleuls = d.parrainages.filter(x => x.parrain_id === p.id).map(x => nom(x.filleul_id)).filter(Boolean);
  // CV à relire : ceux qui me sont adressés, et les demandes ouvertes des étudiants de ma filière
  r.relectures = (d.relectures || []).filter(x => x.student_id !== p.id
    && (x.reviewer_id === p.id || (!x.reviewer_id && procheFiliere(d.profils.get(x.student_id)?.filiere, p.filiere)))).length;
  return estVide(r) ? null : r;
}

// ---------------------------------------------------------------------
// Résumé hebdomadaire : les textes (fr / ar)
// ---------------------------------------------------------------------
type Fmt = { u: (s: string) => string; g: (s: string) => string; p: (s: string) => string };   // u : texte d'un membre ; g : en gras ; p : pastille des points
const pastille = (s: string) => ` <span style="display:inline-block;padding:0 8px;border-radius:999px;background:#FDEBD3;color:#A65400;font-size:12px;font-weight:600;line-height:18px;white-space:nowrap">${esc(s)}</span>`;
const HTML: Fmt = { u: esc, g: s => `<strong>${esc(s)}</strong>`, p: pastille };
const BRUT: Fmt = { u: s => s, g: s => s, p: s => ` (${s})` };
// En arabe, chaque contenu de membre est isolé (sens de lecture), en HTML comme en texte
const HTML_AR: Fmt = { u: s => `<span dir="auto">${esc(s)}</span>`, g: s => `<strong dir="auto">${esc(s)}</strong>`, p: pastille };
const BRUT_AR: Fmt = { u: s => `\u2068${s}\u2069`, g: s => `\u2068${s}\u2069`, p: s => ` (${s})` };
const pl = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
type PromoChiffres = NonNullable<Resume['promo']>;
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'];
// Accord en arabe : 1, 2, 3 à 10, 11 et plus (comme arCount dans i18n-ar.js)
const arN = (n: number, f: [string, string, string, string]) =>
  (n === 1 ? f[0] : n === 2 ? f[1] : n >= 3 && n <= 10 ? f[2] : f[3]).replace('{n}', String(n));
// « +75 نقطة » : le nombre isolé de gauche à droite, « نقاط » de 3 à 10
const ptsAR = (n: number) => `\u2066+${n}\u2069 ${n >= 3 && n <= 10 ? 'نقاط' : 'نقطة'}`;

type NomSujet = { nom: string; sujet: string };
const FR = {
  marque: 'Réseau ENSAM Meknès', suffixe: ' · Réseau ENSAM', defaut: 'Ta semaine sur le Réseau ENSAM Meknès',
  sousTitre: 'Ta semaine sur le réseau', sep: ' : ',
  bonjour: (p: string) => (p ? `Bonjour ${p},` : 'Bonjour,'),
  intro: 'Voici ce qui t’attend cette semaine.', introCalme: 'Rien à faire cette semaine. Voici qui vient d’arriver.', introAdmin: 'Voici le point de la semaine pour l’administration.',
  quand: (date: string, heure: string) => `${date} à ${heure}`,
  pied: 'Tu reçois ce résumé une fois par semaine parce que tu es membre du Réseau ENSAM Meknès.',
  ouvrir: 'Ouvrir la plateforme', desabo: 'Se désabonner',
  plus: (n: number) => `Et ${n} de plus.`,
  t: {
    aFaire: 'À faire cette semaine', offres: 'Nouvelles offres pour toi', reponses: 'Réponses à tes questions', parrain: 'Ton parrain',
    cafes: 'Cafés ENSAM près de chez toi', talents: 'Alerte talents', ouvertes: 'Ils demandent de l’aide', impact: 'Ton impact cette semaine',
    filleul: 'Ton nouveau filleul', filleuls: 'Tes nouveaux filleuls', admin: 'Administration', agenda: 'À l’agenda du réseau', enquete: 'Enquête d’insertion',
    arrivees: 'Nouveaux sur le réseau', promo: 'Ta promo le mois dernier',
  },
  routes: {
    enquete: 'Répondre à l’enquête', 'reseau/agenda': 'Voir l’agenda', 'mentorat/cv': 'Voir les CV à relire',
    parcours: 'Ouvrir mon parcours', offres: 'Voir les offres', mentorat: 'Ouvrir le mentorat', espace: 'Ouvrir mon espace',
    'reseau/entraide': 'Aller à l’Entraide', 'reseau/groupes': 'Voir les cafés', 'reseau/talents': 'Voir les talents',
    accueil: 'Ouvrir la plateforme', admin: 'Ouvrir l’administration', 'reseau/annuaire': 'Voir l’annuaire',
  } as Record<string, string>,
  l: {
    aConfirmer: (f: Fmt, x: { entreprise: string; nom: string }) => `Confirme ton recrutement chez ${f.g(x.entreprise)}${x.nom ? ` (déclaré par ${f.u(x.nom)})` : ''}.`,
    invitation: (f: Fmt, x: { nom: string; titre: string; entreprise: string }) => `${f.u(x.nom)} t’invite à postuler : ${f.g(x.titre)} · ${f.u(x.entreprise)}`,
    candidatures: (f: Fmt, n: number) => f.g(n > 1 ? `${n} candidatures attendent ta réponse.` : '1 candidature attend ta réponse.'),
    demande: (f: Fmt, x: NomSujet) => `${f.u(x.nom)} te demande de l’aide : ${f.g(x.sujet)}`,
    rdv: (f: Fmt, x: NomSujet, q: string) => `Rendez-vous avec ${f.u(x.nom)} ${f.g(q)} : ${f.u(x.sujet)}`,
    aCloreE: (f: Fmt, x: NomSujet) => `Ton rendez-vous avec ${f.u(x.nom)} a eu lieu ? Dis-lui merci : ${f.u(x.sujet)}`,
    aCloreL: (f: Fmt, x: NomSujet) => `Ton rendez-vous avec ${f.u(x.nom)} a eu lieu ? Marque-le terminé : ${f.u(x.sujet)}`,
    question: (f: Fmt, x: { titre: string; cible: string }) => `Question sur ${f.g(x.cible)} : ${f.u(x.titre)}`,
    relance: (f: Fmt, t: string) => `« ${f.g(t)} » est-elle toujours ouverte ? Un clic pour confirmer, ou la marquer pourvue.`,
    offresIntro: (f: Fmt, n: number) => `${f.g(pl(n, 'nouvelle offre', 'nouvelles offres'))} cette semaine pour ta filière et ton année.`,
    offre: (f: Fmt, x: { titre: string; entreprise: string }) => `${f.g(x.titre)} · ${f.u(x.entreprise)}`,
    reponse: (f: Fmt, x: { titre: string; n: number }) => `${pl(x.n, 'nouvelle réponse', 'nouvelles réponses')} à « ${f.g(x.titre)} »`,
    parrain: (f: Fmt, nom: string) => `Ton parrainage cette année : ${f.g(nom)}, de ta filière. Fais-lui signe !`,
    cafe: (f: Fmt, x: { ville: string; lieu: string }, q: string) => `${f.g(x.ville)} · ${q} · ${f.u(x.lieu)}`,
    talentsIntro: (f: Fmt, n: number) => f.g(n > 1 ? `${n} étudiants de ta filière cherchent encore un stage.` : '1 étudiant de ta filière cherche encore un stage.'),
    talent: (f: Fmt, x: { prenom: string; niveau: number; competences: string[]; nouveau: boolean }) =>
      `${f.g(x.prenom)} · ${x.niveau}A${x.competences.length ? ' · ' + f.u(x.competences.join(', ')) : ''}${x.nouveau ? ' · vient d’arriver' : ''}`,
    ouvertesIntro: (f: Fmt, n: number) => f.g(n > 1 ? `${n} étudiants de ta filière attendent un horaire.` : '1 étudiant de ta filière attend un horaire.'),
    ouverte: (f: Fmt, s: string) => `« ${f.u(s)} »`,
    mercis: (f: Fmt, n: number) => `${f.g(pl(n, 'merci reçu', 'mercis reçus'))} cette semaine.`,
    recrutements: (f: Fmt, n: number, pts: number) => `${f.g(pl(n, 'recrutement confirmé', 'recrutements confirmés'))} grâce à toi.${f.p(`+${pts} points`)}`,
    citation: (f: Fmt, x: { texte: string; prenom: string }) => `« ${f.u(x.texte)} »${x.prenom ? ` — ${f.u(x.prenom)}` : ''}`,
    filleul: (f: Fmt, nom: string) => `${f.g(nom)} (3A) est ton filleul cette année. Fais-lui signe !`,
    nonVerifies: (f: Fmt, n: number) => f.g(pl(n, 'lauréat à vérifier', 'lauréats à vérifier')),
    nouveaux: (f: Fmt, n: number) => `${f.g(pl(n, 'nouveau membre', 'nouveaux membres'))} cette semaine`,
    enAttente: (f: Fmt, n: number) => `${f.g(pl(n, 'recrutement attend', 'recrutements attendent'))} la confirmation de l’étudiant`,
    signalements: (f: Fmt, n: number) => `${f.g(pl(n, 'signalement', 'signalements'))} à traiter dans la modération`,
    contacts: (f: Fmt, n: number) => f.g(n > 1 ? `${n} membres aimeraient avoir tes coordonnées.` : 'Un membre aimerait avoir tes coordonnées.'),
    enquete: (f: Fmt, v: number) => `${f.g(`Enquête ${v} mois après le diplôme`)} : 2 minutes pour aider les promos suivantes.`,
    relectures: (f: Fmt, n: number) => f.g(n > 1 ? `${n} CV attendent une relecture.` : '1 CV attend une relecture.'),
    evenement: (f: Fmt, x: { titre: string; lieu: string }, q: string) => `${f.g(x.titre)} · ${q}${x.lieu ? ` · ${f.u(x.lieu)}` : ''}`,
    arriveesIntro: (f: Fmt, n: number, etu = false) => { const de = etu ? 'de ton année ou de ta filière' : 'de ta promo ou de ta filière'; return f.g(n > 1 ? `${n} membres ${de} ont rejoint le réseau cette semaine.` : `1 membre ${de} a rejoint le réseau cette semaine.`); },
    arrivee: (f: Fmt, x: Arrivee) => `${f.u(x.nom)} · ${x.niveau ? `${x.niveau}A` : `promo ${x.promo}`}`,
    promoIntro: (f: Fmt, x: PromoChiffres) => f.g(`Promo ${x.promo} · ${x.filiere}, en ${MOIS_FR[x.mois]}`),
    promoInscrits: (f: Fmt, x: PromoChiffres) => `${pl(x.inscrits, 'inscrit', 'inscrits')} sur le réseau${x.nouveaux ? `, dont ${x.nouveaux} ${x.nouveaux > 1 ? 'nouveaux' : 'nouveau'} ce mois-là` : ''}.`,
    promoDemandes: (f: Fmt, x: PromoChiffres) => `${pl(x.demandesMois, 'demande pourvue', 'demandes pourvues')} ce mois-là (${x.demandes} en tout).`,
    promoStages: (f: Fmt, x: PromoChiffres) => `${pl(x.stagesMois, 'stage ou emploi trouvé', 'stages et emplois trouvés')} ce mois-là (${x.stages} en tout).`,
    promoMerci: () => 'Merci de faire vivre ta promo : son lien d’inscription et les réussites à partager sont sur ton accueil.',
    reseau: (f: Fmt, l: number, e: number) => (l && e ? `Dans tout le réseau : ${pl(l, 'lauréat', 'lauréats')} et ${pl(e, 'étudiant', 'étudiants')} de plus cette semaine.`
      : `Dans tout le réseau : ${l ? pl(l, 'lauréat', 'lauréats') : pl(e, 'étudiant', 'étudiants')} de plus cette semaine.`),
  },
  s: {
    aConfirmer: (e: string) => `Confirme ton recrutement chez ${e}`,
    rdv: (q: string) => `Rendez-vous ${q}`,
    invitation: (n: number, nom: string) => (n > 1 ? `${n} invitations à postuler` : `${nom} t’invite à postuler`),
    offres: (n: number) => (n > 1 ? `${n} nouvelles offres pour toi` : '1 nouvelle offre pour toi'),
    reponses: (n: number, questions: number) => `${pl(n, 'nouvelle réponse', 'nouvelles réponses')} à ${questions > 1 ? 'tes questions' : 'ta question'}`,
    parrain: (nom: string) => `Ton parrain cette année : ${nom}`,
    aCloreE: (nom: string) => `Dis merci à ${nom}`,
    aCloreL: (nom: string) => `Ton rendez-vous avec ${nom} a eu lieu ?`,
    cafe: (ville: string) => `Café ENSAM à ${ville}`,
    candidatures: (n: number) => `${pl(n, 'candidature', 'candidatures')} à regarder`,
    demandes: (n: number, nom: string) => (n > 1 ? `${n} étudiants aimeraient ton avis` : `${nom} te demande de l’aide`),
    recrutements: (n: number) => `${pl(n, 'recrutement confirmé', 'recrutements confirmés')} grâce à toi`,
    mercis: (n: number) => `${pl(n, 'merci', 'mercis')} pour toi cette semaine`,
    questions: (n: number, cible: string) => (n > 1 ? `${n} questions pour toi` : `Une question pour toi sur ${cible}`),
    filleuls: (n: number, nom: string) => (n > 1 ? `${n} nouveaux filleuls` : `Ton nouveau filleul : ${nom}`),
    talents: (n: number) => (n > 1 ? `${n} étudiants de ta filière cherchent un stage` : '1 étudiant de ta filière cherche un stage'),
    ouvertes: (n: number) => (n > 1 ? `${n} étudiants de ta filière attendent un horaire` : '1 étudiant de ta filière attend un horaire'),
    relance: () => 'Ton offre est-elle toujours ouverte ?',
    nonVerifies: (n: number) => pl(n, 'lauréat à vérifier', 'lauréats à vérifier'),
    enAttente: (n: number) => pl(n, 'recrutement à confirmer', 'recrutements à confirmer'),
    nouveaux: (n: number) => `${pl(n, 'nouveau membre', 'nouveaux membres')} cette semaine`,
    signalements: (n: number) => `${pl(n, 'signalement', 'signalements')} à traiter`,
    contacts: (n: number) => (n > 1 ? `${n} membres aimeraient tes coordonnées` : 'Un membre aimerait tes coordonnées'),
    enquete: (v: number) => `Enquête d’insertion : où en es-tu ${v === 12 ? 'un an' : 'six mois'} après ton diplôme ?`,
    relectures: (n: number) => (n > 1 ? `${n} CV à relire` : '1 CV à relire'),
    evenement: (titre: string) => `À l’agenda : ${titre}`,
    arrivees: (n: number, nom: string, etu = false) => (n > 1 ? `${n} nouveaux ${etu ? 'de ton année' : 'de ta promo'} ou de ta filière` : `${nom} vient d’arriver sur le réseau`),
  },
};
type Dico = typeof FR;

const AR: Dico = {
  marque: 'شبكة ENSAM مكناس', suffixe: ' · شبكة ENSAM', defaut: 'أسبوعك على شبكة ENSAM مكناس',
  sousTitre: 'أسبوعك على الشبكة', sep: ': ',
  bonjour: p => (p ? `مرحبًا ${p}،` : 'مرحبًا،'),
  intro: 'إليك ما ينتظرك هذا الأسبوع.', introCalme: 'لا شيء ينتظرك هذا الأسبوع. إليك من انضم حديثًا.', introAdmin: 'إليك حصيلة الأسبوع للإدارة.',
  quand: (date, heure) => `${date} على الساعة ${heure}`,
  pied: 'يصلك هذا الملخص مرة في الأسبوع لأنك عضو في شبكة ENSAM مكناس.',
  ouvrir: 'فتح المنصة', desabo: 'إلغاء الاشتراك',
  plus: n => `و${n} أخرى.`,
  t: {
    aFaire: 'مهام هذا الأسبوع', offres: 'عروض جديدة لك', reponses: 'أجوبة على أسئلتك', parrain: 'عرّابك',
    cafes: 'مقاهي ENSAM قربك', talents: 'تنبيه المواهب', ouvertes: 'طلبة يحتاجون مساعدتك', impact: 'أثرك هذا الأسبوع',
    filleul: 'رعاية جديدة', filleuls: 'طلبة جدد في رعايتك', admin: 'الإدارة', agenda: 'في أجندة الشبكة', enquete: 'استمارة الإدماج المهني',
    arrivees: 'وجوه جديدة في الشبكة', promo: 'دفعتك في الشهر الماضي',
  },
  routes: {
    enquete: 'الإجابة على الاستمارة', 'reseau/agenda': 'عرض الأجندة', 'mentorat/cv': 'عرض السير الذاتية للمراجعة',
    parcours: 'فتح مساري', offres: 'عرض العروض', mentorat: 'فتح الإرشاد', espace: 'فتح فضائي',
    'reseau/entraide': 'الذهاب إلى التعاون', 'reseau/groupes': 'عرض المقاهي', 'reseau/talents': 'عرض المواهب',
    accueil: 'فتح المنصة', admin: 'فتح الإدارة', 'reseau/annuaire': 'عرض الدليل',
  },
  l: {
    aConfirmer: (f, x) => `أكّد توظيفك في ${f.g(x.entreprise)}${x.nom ? ` (بتصريح من ${f.u(x.nom)})` : ''}.`,
    invitation: (f, x) => `دعوة من ${f.u(x.nom)} للترشح: ${f.g(x.titre)} · ${f.u(x.entreprise)}`,
    candidatures: (f, n) => f.g(arN(n, ['ترشيح واحد ينتظر ردك.', 'ترشيحان ينتظران ردك.', '{n} ترشيحات تنتظر ردك.', '{n} ترشيحًا ينتظر ردك.'])),
    demande: (f, x) => `مساعدتك مطلوبة من ${f.u(x.nom)}: ${f.g(x.sujet)}`,
    rdv: (f, x, q) => `موعد مع ${f.u(x.nom)} ${f.g(q)}: ${f.u(x.sujet)}`,
    aCloreE: (f, x) => `هل تم موعدك مع ${f.u(x.nom)}؟ لا تنس رسالة الشكر: ${f.u(x.sujet)}`,
    aCloreL: (f, x) => `هل تم موعدك مع ${f.u(x.nom)}؟ أنهِ الإرشاد: ${f.u(x.sujet)}`,
    question: (f, x) => `سؤال حول ${f.g(x.cible)}: ${f.u(x.titre)}`,
    relance: (f, t) => `هل لا يزال عرض «${f.g(t)}» مفتوحًا؟ أكّد بنقرة، أو أشر إلى أنه تم شغله.`,
    offresIntro: (f, n) => `${f.g(arN(n, ['عرض جديد', 'عرضان جديدان', '{n} عروض جديدة', '{n} عرضًا جديدًا']))} هذا الأسبوع لشعبتك وسنتك.`,
    offre: (f, x) => `${f.g(x.titre)} · ${f.u(x.entreprise)}`,
    reponse: (f, x) => `${arN(x.n, ['جواب جديد', 'جوابان جديدان', '{n} أجوبة جديدة', '{n} جوابًا جديدًا'])} على «${f.g(x.titre)}»`,
    parrain: (f, nom) => `عرّابك هذه السنة: ${f.g(nom)}، من خريجي شعبتك. بادر بالتواصل!`,
    cafe: (f, x, q) => `${f.g(x.ville)} · ${q} · ${f.u(x.lieu)}`,
    talentsIntro: (f, n) => f.g(arN(n, ['طالب واحد من شعبتك يبحث عن تدريب.', 'طالبان من شعبتك يبحثان عن تدريب.', '{n} طلبة من شعبتك يبحثون عن تدريب.', '{n} طالبًا من شعبتك يبحثون عن تدريب.'])),
    talent: (f, x) => `${f.g(x.prenom)} · ${x.niveau}A${x.competences.length ? ' · ' + f.u(x.competences.join('، ')) : ''}${x.nouveau ? ' · انضمام حديث' : ''}`,
    ouvertesIntro: (f, n) => f.g(arN(n, ['طالب واحد من شعبتك في انتظار توقيت.', 'طالبان من شعبتك في انتظار توقيت.', '{n} طلبة من شعبتك في انتظار توقيت.', '{n} طالبًا من شعبتك في انتظار توقيت.'])),
    ouverte: (f, s) => `«${f.u(s)}»`,
    mercis: (f, n) => `${f.g(arN(n, ['رسالة شكر واحدة', 'رسالتا شكر', '{n} رسائل شكر', '{n} رسالة شكر']))} هذا الأسبوع.`,
    recrutements: (f, n, pts) => `${f.g(arN(n, ['توظيف مؤكَّد', 'توظيفان مؤكَّدان', '{n} توظيفات مؤكَّدة', '{n} توظيفًا مؤكَّدًا']))} بفضلك.${f.p(ptsAR(pts))}`,
    citation: (f, x) => `«${f.u(x.texte)}»${x.prenom ? ` — ${f.u(x.prenom)}` : ''}`,
    filleul: (f, nom) => `${f.g(nom)} (3A) في رعايتك هذه السنة. بادر بالتواصل!`,
    nonVerifies: (f, n) => f.g(arN(n, ['خريج واحد في انتظار التحقق', 'خريجان في انتظار التحقق', '{n} خريجين في انتظار التحقق', '{n} خريجًا في انتظار التحقق'])),
    nouveaux: (f, n) => `${f.g(arN(n, ['عضو جديد', 'عضوان جديدان', '{n} أعضاء جدد', '{n} عضوًا جديدًا']))} هذا الأسبوع`,
    enAttente: (f, n) => `${f.g(arN(n, ['توظيف واحد', 'توظيفان', '{n} توظيفات', '{n} توظيفًا']))} في انتظار تأكيد الطالب`,
    signalements: (f, n) => `${f.g(arN(n, ['تبليغ واحد', 'تبليغان', '{n} تبليغات', '{n} تبليغًا']))} في انتظار المعالجة في صفحة الإشراف`,
    contacts: (f, n) => f.g(n > 1 ? arN(n, ['', 'عضوان يرغبان في معلومات الاتصال بك.', '{n} أعضاء يرغبون في معلومات الاتصال بك.', '{n} عضوًا يرغبون في معلومات الاتصال بك.']) : 'عضو يرغب في معلومات الاتصال بك.'),
    enquete: (f, v) => `${f.g(`استمارة الإدماج بعد ${v === 12 ? 'سنة' : 'ستة أشهر'} من التخرج`)}: دقيقتان لمساعدة الدفعات القادمة.`,
    relectures: (f, n) => f.g(arN(n, ['سيرة ذاتية واحدة تنتظر المراجعة.', 'سيرتان ذاتيتان تنتظران المراجعة.', '{n} سير ذاتية تنتظر المراجعة.', '{n} سيرة ذاتية تنتظر المراجعة.'])),
    evenement: (f, x, q) => `${f.g(x.titre)} · ${q}${x.lieu ? ` · ${f.u(x.lieu)}` : ''}`,
    arriveesIntro: (f, n, etu = false) => f.g(`انضم إلى الشبكة هذا الأسبوع ${arN(n, ['عضو واحد', 'عضوان', '{n} أعضاء', '{n} عضوًا'])} ${etu ? 'من سنتك أو شعبتك' : 'من دفعتك أو شعبتك'}.`),
    arrivee: (f, x) => `${f.u(x.nom)} · ${x.niveau ? `${x.niveau}A` : `دفعة ${x.promo}`}`,
    promoIntro: (f, x) => f.g(`دفعة ${x.promo} · ${x.filiere}، في ${MOIS_AR[x.mois]}`),
    promoInscrits: (f, x) => `${arN(x.inscrits, ['عضو واحد مسجَّل', 'عضوان مسجَّلان', '{n} أعضاء مسجَّلين', '{n} عضوًا مسجَّلًا'])} في الشبكة${x.nouveaux ? `، منهم ${arN(x.nouveaux, ['عضو جديد', 'عضوان جديدان', '{n} أعضاء جدد', '{n} عضوًا جديدًا'])} في ذلك الشهر` : ''}.`,
    promoDemandes: (f, x) => `${arN(x.demandesMois, ['طلب واحد تحقّق', 'طلبان تحقّقا', '{n} طلبات تحقّقت', '{n} طلبًا تحقّق'])} في ذلك الشهر (${x.demandes} في المجموع).`,
    promoStages: (f, x) => `${arN(x.stagesMois, ['تدريب أو وظيفة واحدة', 'تدريبان أو وظيفتان', '{n} تداريب ووظائف', '{n} تدريبًا ووظيفة'])} في ذلك الشهر (${x.stages} في المجموع).`,
    promoMerci: () => 'شكرًا لأنك تُبقي دفعتك حاضرة: رابط التسجيل والنجاحات الجاهزة للمشاركة في صفحتك الرئيسية.',
    reseau: (f, l, e) => `في الشبكة كلها هذا الأسبوع: ${[l ? arN(l, ['خريج واحد جديد', 'خريجان جديدان', '{n} خريجين جدد', '{n} خريجًا جديدًا']) : '', e ? arN(e, ['طالب واحد جديد', 'طالبان جديدان', '{n} طلاب جدد', '{n} طالبًا جديدًا']) : ''].filter(Boolean).join(' و')}.`,
  },
  s: {
    aConfirmer: e => `أكّد توظيفك في ${e}`,
    rdv: q => `موعدك ${q}`,
    invitation: (n, nom) => (n > 1 ? arN(n, ['', 'دعوتان للترشح', '{n} دعوات للترشح', '{n} دعوة للترشح']) : `دعوة للترشح من ${nom}`),
    offres: n => arN(n, ['عرض جديد لك', 'عرضان جديدان لك', '{n} عروض جديدة لك', '{n} عرضًا جديدًا لك']),
    reponses: n => arN(n, ['جواب جديد على سؤالك', 'جوابان جديدان على أسئلتك', '{n} أجوبة جديدة على أسئلتك', '{n} جوابًا جديدًا على أسئلتك']),
    parrain: nom => `عرّابك هذه السنة: ${nom}`,
    aCloreE: nom => `هل تم موعدك مع ${nom}؟`,
    aCloreL: nom => `هل تم موعدك مع ${nom}؟`,
    cafe: ville => `مقهى ENSAM في ${ville}`,
    candidatures: n => arN(n, ['ترشيح واحد ينتظر ردك', 'ترشيحان ينتظران ردك', '{n} ترشيحات تنتظر ردك', '{n} ترشيحًا ينتظر ردك']),
    demandes: (n, nom) => (n > 1 ? arN(n, ['', 'طالبان ينتظران رأيك', '{n} طلبة ينتظرون رأيك', '{n} طالبًا ينتظرون رأيك']) : `مساعدتك مطلوبة من ${nom}`),
    recrutements: n => `${arN(n, ['توظيف مؤكَّد', 'توظيفان مؤكَّدان', '{n} توظيفات مؤكَّدة', '{n} توظيفًا مؤكَّدًا'])} بفضلك`,
    mercis: n => arN(n, ['رسالة شكر لك هذا الأسبوع', 'رسالتا شكر لك هذا الأسبوع', '{n} رسائل شكر لك هذا الأسبوع', '{n} رسالة شكر لك هذا الأسبوع']),
    questions: (n, cible) => (n > 1 ? arN(n, ['', 'سؤالان لك', '{n} أسئلة لك', '{n} سؤالًا لك']) : `سؤال لك حول ${cible}`),
    filleuls: (n, nom) => (n > 1 ? arN(n, ['', 'طالبان جديدان في رعايتك', '{n} طلبة جدد في رعايتك', '{n} طالبًا جديدًا في رعايتك']) : `رعاية جديدة: ${nom}`),
    talents: n => arN(n, ['طالب واحد من شعبتك يبحث عن تدريب', 'طالبان من شعبتك يبحثان عن تدريب', '{n} طلبة من شعبتك يبحثون عن تدريب', '{n} طالبًا من شعبتك يبحثون عن تدريب']),
    ouvertes: n => arN(n, ['طالب واحد من شعبتك في انتظار توقيت', 'طالبان من شعبتك في انتظار توقيت', '{n} طلبة من شعبتك في انتظار توقيت', '{n} طالبًا من شعبتك في انتظار توقيت']),
    relance: () => 'هل لا يزال عرضك مفتوحًا؟',
    nonVerifies: n => arN(n, ['خريج واحد في انتظار التحقق', 'خريجان في انتظار التحقق', '{n} خريجين في انتظار التحقق', '{n} خريجًا في انتظار التحقق']),
    enAttente: n => arN(n, ['توظيف واحد في انتظار التأكيد', 'توظيفان في انتظار التأكيد', '{n} توظيفات في انتظار التأكيد', '{n} توظيفًا في انتظار التأكيد']),
    nouveaux: n => `${arN(n, ['عضو جديد', 'عضوان جديدان', '{n} أعضاء جدد', '{n} عضوًا جديدًا'])} هذا الأسبوع`,
    signalements: n => `${arN(n, ['تبليغ واحد', 'تبليغان', '{n} تبليغات', '{n} تبليغًا'])} في انتظار المعالجة`,
    contacts: n => (n > 1 ? arN(n, ['', 'عضوان يرغبان في معلومات الاتصال بك', '{n} أعضاء يرغبون في معلومات الاتصال بك', '{n} عضوًا يرغبون في معلومات الاتصال بك']) : 'عضو يرغب في معلومات الاتصال بك'),
    enquete: v => `استمارة الإدماج: أين وصلت ${v === 12 ? 'بعد سنة' : 'بعد ستة أشهر'} من تخرجك؟`,
    relectures: n => arN(n, ['سيرة ذاتية للمراجعة', 'سيرتان ذاتيتان للمراجعة', '{n} سير ذاتية للمراجعة', '{n} سيرة ذاتية للمراجعة']),
    evenement: titre => `في الأجندة: ${titre}`,
    arrivees: (n, nom, etu = false) => (n > 1 ? arN(n, ['', 'عضوان جديدان', '{n} أعضاء جدد', '{n} عضوًا جديدًا']) + (etu ? ' من سنتك أو شعبتك' : ' من دفعتك أو شعبتك') : `انضمام جديد إلى الشبكة: ${nom}`),
  },
};

type Ligne = (f: Fmt) => string;
type Section = { titre: string; lignes: Ligne[]; route: string };

function sectionsDe(r: Resume, L: Dico, langue: Langue): Section[] {
  const q = (at: string) => { const x = quand(at, langue); return x ? L.quand(x.date, x.heure) : ''; };
  const max = <T>(l: T[], n: number, f: (x: T) => Ligne): Ligne[] => {
    const out = l.slice(0, n).map(f);
    if (l.length > n) out.push(() => L.plus(l.length - n));
    return out;
  };
  const out: Section[] = [];
  // À faire : le bouton mène à la première chose à faire
  const aFaire: Ligne[] = [];
  let route = '';
  const ajoute = (rt: string, lignes: Ligne[]) => { if (!lignes.length) return; if (!route) route = rt; aFaire.push(...lignes); };
  if (r.contacts) ajoute('accueil', [f => L.l.contacts(f, r.contacts || 0)]);
  if (r.role === 'etudiant') {
    ajoute('parcours', r.aConfirmer.map(x => f => L.l.aConfirmer(f, x)));
    ajoute('mentorat', max(r.rdv, 3, x => f => L.l.rdv(f, x, q(x.at))));
    ajoute('offres', max(r.invitations, 3, x => f => L.l.invitation(f, x)));
    ajoute('mentorat', max(r.aClore, 3, x => f => L.l.aCloreE(f, x)));
  } else if (r.role === 'laureat') {
    if (r.candidatures) ajoute('espace', [f => L.l.candidatures(f, r.candidatures)]);
    ajoute('mentorat', max(r.demandes, 2, x => f => L.l.demande(f, x)));
    ajoute('mentorat', max(r.rdv, 3, x => f => L.l.rdv(f, x, q(x.at))));
    ajoute('mentorat', max(r.aClore, 3, x => f => L.l.aCloreL(f, x)));
    ajoute('reseau/entraide', max(r.questions, 2, x => f => L.l.question(f, x)));
    ajoute('offres', max(r.relances, 2, x => f => L.l.relance(f, x)));
    if (r.relectures) ajoute('mentorat/cv', [f => L.l.relectures(f, r.relectures || 0)]);
  }
  if (aFaire.length) out.push({ titre: L.t.aFaire, lignes: aFaire, route });
  if (r.enquete) out.push({ titre: L.t.enquete, route: 'enquete', lignes: [f => L.l.enquete(f, r.enquete || 6)] });
  if (r.offres.total) {
    out.push({ titre: L.t.offres, route: 'offres', lignes: [f => L.l.offresIntro(f, r.offres.total), ...r.offres.liste.map(x => (f: Fmt) => L.l.offre(f, x))] });
  }
  if (r.talents.total) {
    out.push({ titre: L.t.talents, route: 'reseau/talents', lignes: [f => L.l.talentsIntro(f, r.talents.total), ...r.talents.liste.map(x => (f: Fmt) => L.l.talent(f, x))] });
  }
  if (r.ouvertes.total) {
    out.push({ titre: L.t.ouvertes, route: 'mentorat', lignes: [f => L.l.ouvertesIntro(f, r.ouvertes.total), ...r.ouvertes.sujets.map(s => (f: Fmt) => L.l.ouverte(f, s))] });
  }
  if (r.impact.mercis || r.impact.recrutements) {
    const l: Ligne[] = [];
    const c = r.impact.citation;
    if (c) l.push(f => L.l.citation(f, c));
    if (r.impact.mercis) l.push(f => L.l.mercis(f, r.impact.mercis));
    if (r.impact.recrutements) l.push(f => L.l.recrutements(f, r.impact.recrutements, r.impact.ptsRecrutements || 50 * r.impact.recrutements));
    out.push({ titre: L.t.impact, route: 'espace', lignes: l });
  }
  if (r.filleuls.length) out.push({ titre: r.filleuls.length > 1 ? L.t.filleuls : L.t.filleul, route: 'espace', lignes: r.filleuls.map(n => (f: Fmt) => L.l.filleul(f, n)) });
  if (r.reponses.length) out.push({ titre: L.t.reponses, route: 'reseau/entraide', lignes: max(r.reponses, 3, x => f => L.l.reponse(f, x)) });
  if (r.parrain) out.push({ titre: L.t.parrain, route: 'accueil', lignes: [f => L.l.parrain(f, r.parrain)] });
  if (r.cafes.length) out.push({ titre: L.t.cafes, route: 'reseau/groupes', lignes: r.cafes.map(x => (f: Fmt) => L.l.cafe(f, x, q(x.at))) });
  if (r.evenements?.length) out.push({ titre: L.t.agenda, route: 'reseau/agenda', lignes: r.evenements.map(x => (f: Fmt) => L.l.evenement(f, x, q(x.at))) });
  const a = r.arrivees;
  if (a?.total) {
    const l: Ligne[] = [f => L.l.arriveesIntro(f, a.total, r.role === 'etudiant'), ...a.liste.map(x => (f: Fmt) => L.l.arrivee(f, x))];
    if (a.total > a.liste.length) l.push(() => L.plus(a.total - a.liste.length));
    // La ligne du réseau seulement si elle dit plus que la liste
    if (a.reseau.laureats + a.reseau.etudiants > a.total) l.push(f => L.l.reseau(f, a.reseau.laureats, a.reseau.etudiants));
    out.push({ titre: L.t.arrivees, route: 'reseau/annuaire', lignes: l });
  }
  const pr = r.promo;
  if (pr) out.push({ titre: L.t.promo, route: 'accueil', lignes: [f => L.l.promoIntro(f, pr), f => L.l.promoInscrits(f, pr), f => L.l.promoDemandes(f, pr), f => L.l.promoStages(f, pr), () => L.l.promoMerci()] });
  if (r.role === 'admin') {
    const l: Ligne[] = [];
    const a = r.admin;
    if (a.nonVerifies) l.push(f => L.l.nonVerifies(f, a.nonVerifies));
    if (a.enAttente) l.push(f => L.l.enAttente(f, a.enAttente));
    if (a.nouveaux) l.push(f => L.l.nouveaux(f, a.nouveaux));
    if (a.signalements) l.push(f => L.l.signalements(f, a.signalements || 0));
    if (l.length) out.push({ titre: L.t.admin, route: 'admin', lignes: l });
  }
  return out;
}

// Objet de l'email : le fait le plus utile de la semaine
function sujetDe(r: Resume, L: Dico, langue: Langue): string {
  const s = L.s;
  const q = (at: string) => { const x = quand(at, langue); return x ? L.quand(x.date, x.heure) : ''; };
  const nbRep = r.reponses.reduce((n, x) => n + x.n, 0);
  const choix: [unknown, () => string][] = r.role === 'admin' ? [
    [r.admin.nonVerifies, () => s.nonVerifies(r.admin.nonVerifies)],
    [r.admin.enAttente, () => s.enAttente(r.admin.enAttente)],
    [r.admin.nouveaux, () => s.nouveaux(r.admin.nouveaux)],
    [r.admin.signalements, () => s.signalements(r.admin.signalements || 0)],
  ] : r.role === 'laureat' ? [
    [r.enquete, () => s.enquete(r.enquete || 6)],
    [r.candidatures, () => s.candidatures(r.candidatures)],
    [r.demandes.length, () => s.demandes(r.demandes.length, r.demandes[0].nom)],
    [r.rdv.length, () => s.rdv(q(r.rdv[0].at))],
    [r.impact.recrutements, () => s.recrutements(r.impact.recrutements)],
    [r.impact.mercis, () => s.mercis(r.impact.mercis)],
    [r.questions.length, () => s.questions(r.questions.length, r.questions[0].cible)],
    [r.filleuls.length, () => s.filleuls(r.filleuls.length, r.filleuls[0])],
    [r.offres.total, () => s.offres(r.offres.total)],
    [r.talents.total, () => s.talents(r.talents.total)],
    [r.ouvertes.total, () => s.ouvertes(r.ouvertes.total)],
    [r.aClore.length, () => s.aCloreL(r.aClore[0].nom)],
    [r.relances.length, () => s.relance()],
    [nbRep, () => s.reponses(nbRep, r.reponses.length)],
    [r.cafes.length, () => s.cafe(r.cafes[0].ville)],
    [r.contacts, () => s.contacts(r.contacts || 0)],
    [r.relectures, () => s.relectures(r.relectures || 0)],
    [r.enquete, () => s.enquete(r.enquete || 6)],
    [r.evenements?.length, () => s.evenement(r.evenements?.[0]?.titre || '')],
    [r.arrivees?.total, () => s.arrivees(r.arrivees?.total || 0, r.arrivees?.liste[0]?.nom || '', r.role === 'etudiant')],
  ] : [
    [r.aConfirmer.length, () => s.aConfirmer(r.aConfirmer[0].entreprise)],
    [r.rdv.length, () => s.rdv(q(r.rdv[0].at))],
    [r.invitations.length, () => s.invitation(r.invitations.length, r.invitations[0].nom)],
    [r.offres.total, () => s.offres(r.offres.total)],
    [nbRep, () => s.reponses(nbRep, r.reponses.length)],
    [r.parrain, () => s.parrain(r.parrain)],
    [r.aClore.length, () => s.aCloreE(r.aClore[0].nom)],
    [r.cafes.length, () => s.cafe(r.cafes[0].ville)],
    [r.contacts, () => s.contacts(r.contacts || 0)],
    [r.enquete, () => s.enquete(r.enquete || 6)],
    [r.evenements?.length, () => s.evenement(r.evenements?.[0]?.titre || '')],
    [r.arrivees?.total, () => s.arrivees(r.arrivees?.total || 0, r.arrivees?.liste[0]?.nom || '', r.role === 'etudiant')],
  ];
  const c = choix.find(([vrai]) => vrai);
  const t = c ? txt(c[1]()) : '';
  return t ? couper(t, 100) + L.suffixe : L.defaut;
}

// Les liens d'un email arabe ouvrent le site en arabe (?lang=ar), sauf si ce navigateur a déjà choisi sa langue
export const siteEn = (site: string, langue: Langue) => (langue === 'ar' ? `${site}?lang=ar` : site);

// desabo vide : email envoyé une seule fois, sans lien de désabonnement
export type Courriel = { sujet: string; html: string; texte: string; desabo: string };

export function rendreResume(r: Resume, langue: Langue, site: string, token: string): Courriel {
  site = siteEn(site, langue);
  const L = langue === 'ar' ? AR : FR, ar = langue === 'ar';
  const secs = sectionsDe(r, L, langue);
  const sujet = sujetDe(r, L, langue);
  const desabo = `${site}#desabo/${token}`;
  const salut = L.bonjour(r.prenom), seulementArrivees = secs.length === 1 && secs[0].route === 'reseau/annuaire';
  const intro = r.role === 'admin' ? L.introAdmin : seulementArrivees ? L.introCalme : L.intro;
  const debut = ar ? 'right' : 'left', dir = ar ? 'rtl' : 'ltr';
  const police = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Tahoma,Helvetica,Arial,sans-serif;";
  const fh = ar ? HTML_AR : HTML, ft = ar ? BRUT_AR : BRUT;
  const apercu = secs[0] ? couper(secs[0].lignes[0](ft), 110) : '';
  const lien = (route: string) => esc(`${site}#${route}`);

  const blocs = secs.map((s, i) => `
<tr><td style="padding:${i ? 22 : 6}px 28px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="border-${debut}:3px solid #F39200;padding-${debut}:10px;text-align:${debut};${police}font-size:16px;line-height:22px;font-weight:700;color:#1F3354;">${esc(s.titre)}</td></tr>
<tr><td style="padding-top:10px;text-align:${debut};${police}font-size:14px;line-height:21px;color:#2B2F36;">
${s.lignes.map(l => `<p style="margin:0 0 6px;"><span style="color:#F39200;">&#8226;</span>&nbsp; ${l(fh)}</p>`).join('\n')}
</td></tr>
<tr><td style="padding-top:8px;" align="${debut}">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:6px;background:#1670A8;">
<a href="${lien(s.route)}" style="display:inline-block;padding:10px 18px;${police}font-size:14px;line-height:18px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:6px;">${esc(L.routes[s.route] || L.ouvrir)}</a>
</td></tr></table>
</td></tr>
</table>
</td></tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="${langue}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(sujet)}</title>
</head>
<body style="margin:0;padding:0;background:#F1F3F6;" dir="${dir}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(apercu)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F3F6;" dir="${dir}">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border-radius:10px;" dir="${dir}">
<tr><td style="background:#1F3354;padding:18px 28px;border-bottom:4px solid #F39200;border-radius:10px 10px 0 0;text-align:${debut};${police}">
<div style="font-size:18px;line-height:24px;font-weight:700;color:#FFFFFF;">${esc(L.marque)}</div>
<div style="font-size:13px;line-height:18px;color:#C8D3E3;">${esc(L.sousTitre)}</div>
</td></tr>
<tr><td style="padding:24px 28px 14px;text-align:${debut};${police}font-size:15px;line-height:22px;color:#2B2F36;">
<p style="margin:0 0 6px;font-weight:600;">${esc(salut)}</p>
<p style="margin:0;">${esc(intro)}</p>
</td></tr>${blocs}
<tr><td style="padding:28px 28px 0;"><div style="border-top:1px solid #E3E7ED;height:1px;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>
<tr><td style="padding:14px 28px 26px;text-align:${debut};${police}font-size:12px;line-height:18px;color:#6B7280;">
${esc(L.pied)}<br>
<a href="${esc(site)}" style="color:#1670A8;">${esc(L.ouvrir)}</a> &nbsp;·&nbsp; <a href="${esc(desabo)}" style="color:#1670A8;">${esc(L.desabo)}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const texte = [`${L.marque} · ${L.sousTitre}`, '', salut, intro, '',
    ...secs.flatMap(s => [s.titre.toUpperCase(), ...s.lignes.map(l => `• ${l(ft)}`), `${L.routes[s.route] || L.ouvrir}${L.sep}${site}#${s.route}`, '']),
    '--', L.pied, `${L.ouvrir}${L.sep}${site}`, `${L.desabo}${L.sep}${desabo}`].join('\n');

  return { sujet, html, texte, desabo };
}

// ---------------------------------------------------------------------
// Emails courts (alerte d'offre, enquête d'insertion) : même présentation que le résumé
// ---------------------------------------------------------------------
type Bloc = { lignes: string[]; bouton?: { texte: string; url: string } };
type Cadre = { langue: Langue; sujet: string; apercu: string; sousTitre: string; intro: string[]; blocs: Bloc[]; pied: string; liens: [string, string][] };

function cadreEmail(c: Cadre): string {
  const ar = c.langue === 'ar', debut = ar ? 'right' : 'left', dir = ar ? 'rtl' : 'ltr';
  const police = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Tahoma,Helvetica,Arial,sans-serif;";
  const L = ar ? AR : FR;
  const bouton = (b: { texte: string; url: string }) => `
<tr><td style="padding-top:12px;" align="${debut}">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:6px;background:#1670A8;">
<a href="${esc(b.url)}" style="display:inline-block;padding:11px 20px;${police}font-size:14px;line-height:18px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:6px;">${esc(b.texte)}</a>
</td></tr></table>
</td></tr>`;
  const blocs = c.blocs.map(b => `
<tr><td style="padding:14px 28px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="text-align:${debut};${police}font-size:14px;line-height:21px;color:#2B2F36;">
${b.lignes.map(l => `<p style="margin:0 0 8px;">${l}</p>`).join('\n')}
</td></tr>${b.bouton ? bouton(b.bouton) : ''}
</table>
</td></tr>`).join('');
  return `<!DOCTYPE html>
<html lang="${c.langue}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(c.sujet)}</title>
</head>
<body style="margin:0;padding:0;background:#F1F3F6;" dir="${dir}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(c.apercu)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F3F6;" dir="${dir}">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border-radius:10px;" dir="${dir}">
<tr><td style="background:#1F3354;padding:18px 28px;border-bottom:4px solid #F39200;border-radius:10px 10px 0 0;text-align:${debut};${police}">
<div style="font-size:18px;line-height:24px;font-weight:700;color:#FFFFFF;">${esc(L.marque)}</div>
<div style="font-size:13px;line-height:18px;color:#C8D3E3;">${esc(c.sousTitre)}</div>
</td></tr>
<tr><td style="padding:24px 28px 0;text-align:${debut};${police}font-size:15px;line-height:22px;color:#2B2F36;">
${c.intro.map((l, i) => `<p style="margin:0 0 6px;${i === 0 ? 'font-weight:600;' : ''}">${l}</p>`).join('\n')}
</td></tr>${blocs}
<tr><td style="padding:26px 28px 0;"><div style="border-top:1px solid #E3E7ED;height:1px;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>
<tr><td style="padding:14px 28px 26px;text-align:${debut};${police}font-size:12px;line-height:18px;color:#6B7280;">
${esc(c.pied)}<br>
${c.liens.map(([t, u]) => `<a href="${esc(u)}" style="color:#1670A8;">${esc(t)}</a>`).join(' &nbsp;·&nbsp; ')}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export type OffreAlerte = { id: string; titre: string; entreprise: string; type?: string | null; ville?: string | null; pays?: string | null; deadline?: string | null; origine?: string | null };
// D'où vient l'offre, dans la ligne de l'alerte (rien pour une offre classique)
const ORIGINE_EMAIL: Record<Langue, Record<string, string>> = {
  fr: { portee: 'Portée par un lauréat, qui encadre', partagee: 'Offre partagée, vue ailleurs' },
  ar: { portee: 'يقدّمه خريج مع التأطير', partagee: 'عرض تمت مشاركته، منشور في موقع آخر' },
};
const TYPES_OFFRE: Record<Langue, Record<string, string>> = {
  fr: { stage: 'Stage', pfe: 'PFE', etranger: 'Stage à l’étranger', emploi: 'Emploi' },
  ar: { stage: 'تدريب', pfe: 'مشروع نهاية الدراسة', etranger: 'تدريب بالخارج', emploi: 'وظيفة' },
};

// Alerte : les nouvelles offres de son année et de sa filière (5 au plus)
export function rendreAlerte(offres: OffreAlerte[], langue: Langue, site: string, token: string): Courriel {
  site = siteEn(site, langue);
  const ar = langue === 'ar', f = ar ? HTML_AR : HTML, b = ar ? BRUT_AR : BRUT;
  const n = offres.length, o0 = offres[0];
  const desabo = `${site}#desabo/${token}/alertes`;
  const lieu = (o: OffreAlerte) => [txt(o.ville), txt(o.pays) && txt(o.pays) !== 'Maroc' ? txt(o.pays) : ''].filter(Boolean).join(', ');
  const limite = (o: OffreAlerte) => { const q = o.deadline ? quand(o.deadline, langue) : null; return q ? (ar ? `آخر أجل: ${q.date}` : `Avant le ${q.date}`) : ''; };
  const ligne = (o: OffreAlerte, F: Fmt) => [F.g(txt(o.titre)), F.u(txt(o.entreprise)), TYPES_OFFRE[langue][txt(o.type)] || '', F.u(lieu(o)), limite(o), ORIGINE_EMAIL[langue][txt(o.origine)] || ''].filter(Boolean).join(' · ');
  const sujet = couper(n > 1
    ? (ar ? `${arN(n, ['', 'عرضان جديدان', '{n} عروض جديدة', '{n} عرضًا جديدًا'])} لك` : `${n} nouvelles offres pour toi`) + (ar ? ' · شبكة ENSAM' : ' · Réseau ENSAM')
    : (ar ? `عرض جديد لك: ${txt(o0.titre)} · ${txt(o0.entreprise)}` : `Nouvelle offre pour toi : ${txt(o0.titre)} · ${txt(o0.entreprise)}`), 110);
  // Un partage peut venir d'un étudiant : l'introduction ne dit « des lauréats » que si toutes les offres viennent d'eux
  const partage = offres.some(o => txt(o.origine) === 'partagee');
  const intro = ar
    ? (partage ? (n > 1 ? 'عروض جديدة تناسب شعبتك وسنتك، نشرها أو شاركها أعضاء الشبكة:' : 'شارك عضو في الشبكة عرضًا يناسب شعبتك وسنتك:')
      : n > 1 ? 'نشر خريجو المدرسة عروضًا جديدة تناسب شعبتك وسنتك:' : 'نشر خريج من المدرسة عرضًا جديدًا يناسب شعبتك وسنتك:')
    : (partage ? (n > 1 ? 'De nouvelles offres pour ta filière et ton année, publiées ou partagées par des membres du réseau :' : 'Un membre du réseau vient de partager une offre pour ta filière et ton année :')
      : n > 1 ? 'Des lauréats de l’école viennent de publier des offres pour ta filière et ton année :' : 'Un lauréat de l’école vient de publier une offre pour ta filière et ton année :');
  const lien = (o: OffreAlerte) => `${site}#offre/${o.id}`;
  const html = cadreEmail({
    langue, sujet, apercu: ligne(o0, b), sousTitre: ar ? 'تنبيه العروض' : 'Alerte offres',
    intro: [esc(ar ? 'مرحبًا،' : 'Bonjour,'), esc(intro)],
    blocs: offres.map(o => ({ lignes: [`<span style="color:#F39200;">&#8226;</span>&nbsp; ${ligne(o, f)}`], bouton: { texte: ar ? 'عرض العرض' : 'Voir l’offre', url: lien(o) } })),
    pied: ar ? 'يصلك هذا التنبيه لأن العرض يناسب شعبتك وسنتك، ثلاث مرات في اليوم على الأكثر.' : 'Tu reçois cette alerte parce que l’offre correspond à ta filière et à ton année, 3 fois par jour au plus.',
    liens: [[ar ? 'فتح المنصة' : 'Ouvrir la plateforme', site], [ar ? 'إيقاف تنبيهات البريد' : 'Ne plus recevoir les alertes par email', desabo]],
  });
  const texte = [`${(ar ? AR : FR).marque} · ${ar ? 'تنبيه العروض' : 'Alerte offres'}`, '', ar ? 'مرحبًا،' : 'Bonjour,', intro, '',
    ...offres.flatMap(o => [`• ${ligne(o, b)}`, `  ${lien(o)}`]), '', '--',
    ar ? 'يصلك هذا التنبيه لأن العرض يناسب شعبتك وسنتك.' : 'Tu reçois cette alerte parce que l’offre correspond à ta filière et à ton année.',
    `${ar ? 'إيقاف تنبيهات البريد' : 'Ne plus recevoir les alertes par email'}${ar ? ': ' : ' : '}${desabo}`].join('\n');
  return { sujet, html, texte, desabo };
}

// Demandes des étudiants de son parcours (lauréats) : qui, ce qu'il cherche, et « Je peux aider »
// large : hors de son parcours, une demande restée sans aide et ouverte à tous les lauréats (absent avec une base plus ancienne)
export type DemandeAlerte = { id: string; titre: string; type?: string | null; lieu?: string | null; prenom?: string | null; niveau?: number | null; role?: string | null; large?: boolean | null };
const niveauCourt = (x: DemandeAlerte, l: Langue) => x.role === 'laureat' ? (l === 'ar' ? 'خريج' : 'Lauréat')
  : Number(x.niveau) >= 6 ? (l === 'ar' ? 'خريج جديد' : 'Jeune diplômé') : Number(x.niveau) >= 3 ? `${Number(x.niveau)}A` : '';
export function rendreDemandes(demandes: DemandeAlerte[], langue: Langue, site: string, token: string): Courriel {
  site = siteEn(site, langue);
  const ar = langue === 'ar', f = ar ? HTML_AR : HTML, b = ar ? BRUT_AR : BRUT;
  const n = demandes.length, d0 = demandes[0];
  const desabo = `${site}#desabo/${token}/alertes`;
  const qui = (x: DemandeAlerte) => txt(x.prenom) || (ar ? 'طالب' : 'Un étudiant');
  const ligne = (x: DemandeAlerte, F: Fmt) => [F.g(qui(x)), niveauCourt(x, langue), TYPES_OFFRE[langue][txt(x.type)] || '', F.u(txt(x.titre)), F.u(txt(x.lieu))].filter(Boolean).join(' · ');
  // Toutes de son parcours (le cas d'avant) ; toutes restées sans aide ailleurs ; ou un mélange des deux
  const larges = demandes.filter(x => x.large === true).length;
  const cas = larges === 0 ? 'parcours' : larges === n ? 'large' : 'mixte';
  const sujet = couper(n > 1
    ? (cas === 'parcours' ? (ar ? `${arN(n, ['', 'طلبان جديدان', '{n} طلبات جديدة', '{n} طلبًا جديدًا'])} من مسارك` : `${n} demandes d’étudiants de ton parcours`)
      : cas === 'large' ? (ar ? `${arN(n, ['', 'طلبان', '{n} طلبات', '{n} طلبًا'])} من الطلبة في انتظار مساعدة` : `${n} demandes d’étudiants attendent encore une aide`)
      : (ar ? `${arN(n, ['', 'طلبان', '{n} طلبات', '{n} طلبًا'])} من الطلبة` : `${n} demandes d’étudiants`)) + (ar ? ' · شبكة ENSAM' : ' · Réseau ENSAM')
    : (ar ? `${qui(d0)} · المطلوب: ${txt(d0.titre)}` : `${qui(d0)} cherche : ${txt(d0.titre)}`), 110);
  const appel = ar ? ' إن كنت تستطيع توظيف أحدهم أو تأطيره أو التوصية به، اقترح ذلك: القرار يبقى لهم.' : ' Si tu peux recruter, encadrer ou recommander l’un d’eux, propose-le : c’est lui qui choisit.';
  const intro = (cas === 'parcours'
    ? (ar ? 'قال طلبة من مسارك ما يبحثون عنه، مع سيرهم الذاتية.' : 'Des étudiants de ton parcours viennent de dire ce qu’ils cherchent, CV joint.')
    : cas === 'large'
      ? (ar ? 'قال طلبة من المدرسة ما يبحثون عنه، مع سيرهم الذاتية، ولم يتلقوا أي مساعدة بعد. ليسوا بالضرورة من شعبتك، لكن نصيحة أو اسمًا قد يكفي.' : 'Des étudiants de l’école ont dit ce qu’ils cherchent, CV joint, et n’ont encore reçu aucune aide. Ils ne sont pas forcément dans ta filière, mais un conseil ou un contact peut suffire.')
      : (ar ? 'قال طلبة من المدرسة ما يبحثون عنه، مع سيرهم الذاتية: بعضهم من مسارك، وآخرون ما زالوا ينتظرون أي مساعدة.' : 'Des étudiants de l’école ont dit ce qu’ils cherchent, CV joint : certains de ton parcours, d’autres encore sans aucune aide.')) + appel;
  const raison = cas === 'parcours'
    ? (ar ? 'لأن الطلب من مسارك' : 'parce que la demande vient de ton parcours')
    : (ar ? 'لأنك من خريجي المدرسة وهذه الطلبات تنتظر مساعدة' : 'parce que tu es lauréat de l’école et que ces demandes attendent une aide');
  const lien = (x: DemandeAlerte) => `${site}#aider/${x.id}`;   // « Je peux aider » ouvre la feuille préremplie
  const html = cadreEmail({
    langue, sujet, apercu: ligne(d0, b), sousTitre: ar ? 'طلبات الطلبة' : 'Demandes des étudiants',
    intro: [esc(ar ? 'مرحبًا،' : 'Bonjour,'), esc(intro)],
    blocs: demandes.map(x => ({ lignes: [`<span style="color:#F39200;">&#8226;</span>&nbsp; ${ligne(x, f)}`], bouton: { texte: ar ? 'أستطيع المساعدة' : 'Je peux aider', url: lien(x) } })),
    pied: ar ? `يصلك هذا البريد ${raison}، مرة في اليوم على الأكثر.` : `Tu reçois cet email ${raison}, une fois par jour au plus.`,
    liens: [[ar ? 'فتح المنصة' : 'Ouvrir la plateforme', site], [ar ? 'إيقاف تنبيهات البريد' : 'Ne plus recevoir les alertes par email', desabo]],
  });
  const texte = [`${(ar ? AR : FR).marque} · ${ar ? 'طلبات الطلبة' : 'Demandes des étudiants'}`, '', ar ? 'مرحبًا،' : 'Bonjour,', intro, '',
    ...demandes.flatMap(x => [`• ${ligne(x, b)}`, `  ${lien(x)}`]), '', '--',
    ar ? `يصلك هذا البريد ${raison}.` : `Tu reçois cet email ${raison}.`,
    `${ar ? 'إيقاف تنبيهات البريد' : 'Ne plus recevoir les alertes par email'}${ar ? ': ' : ' : '}${desabo}`].join('\n');
  return { sujet, html, texte, desabo };
}

// Messages non lus depuis 30 minutes : qui t'a écrit, et un bouton pour répondre (jamais le contenu)
export function rendreMessages(n: number, noms: string[], langue: Langue, site: string, token: string): Courriel {
  site = siteEn(site, langue);
  const ar = langue === 'ar', f = ar ? HTML_AR : HTML, b = ar ? BRUT_AR : BRUT;
  const desabo = `${site}#desabo/${token}/messages`;
  const url = `${site}#messages`;
  const qui = noms.map(txt).filter(Boolean).slice(0, 3);
  const liste = (F: Fmt) => qui.map(x => F.g(x)).join(ar ? ' و' : ', ');
  const sujet = couper(ar
    ? (qui.length === 1 ? `رسالة من ${qui[0]}` : arN(n, ['رسالة جديدة', 'رسالتان جديدتان', '{n} رسائل جديدة', '{n} رسالة جديدة'])) + ' · شبكة ENSAM'
    : (qui.length === 1 ? `${qui[0]} t’a écrit` : `${n} nouveaux messages`) + ' · Réseau ENSAM', 110);
  const ligne = (F: Fmt) => ar
    ? `${arN(n, ['رسالة واحدة', 'رسالتان', '{n} رسائل', '{n} رسالة'])} في انتظارك${qui.length ? ` من ${liste(F)}` : ''}.`
    : `${n > 1 ? `${n} messages t’attendent` : 'Un message t’attend'}${qui.length ? ` de la part de ${liste(F)}` : ''}.`;
  const html = cadreEmail({
    langue, sujet, apercu: ligne(b), sousTitre: ar ? 'الرسائل' : 'Messages',
    intro: [esc(ar ? 'مرحبًا،' : 'Bonjour,'), ligne(f)],
    blocs: [{ lignes: [esc(ar ? 'اقرأ وأجب من المنصة، بالكتابة أو بالصور أو برسالة صوتية.' : 'Lis et réponds depuis la plateforme : par écrit, en photo ou en message vocal.')], bouton: { texte: ar ? 'قراءة الرسائل' : 'Lire et répondre', url } }],
    pied: ar ? 'يصلك هذا البريد إذا بقيت رسالة غير مقروءة نصف ساعة، مرة كل 6 ساعات على الأكثر.' : 'Tu reçois cet email quand un message reste non lu 30 minutes, une fois toutes les 6 heures au plus.',
    liens: [[ar ? 'فتح المنصة' : 'Ouvrir la plateforme', site], [ar ? 'إيقاف بريد الرسائل' : 'Ne plus recevoir ces emails', desabo]],
  });
  const texte = [`${(ar ? AR : FR).marque} · ${ar ? 'الرسائل' : 'Messages'}`, '', ar ? 'مرحبًا،' : 'Bonjour,', ligne(b), '',
    `${ar ? 'قراءة الرسائل' : 'Lire et répondre'}${ar ? ': ' : ' : '}${url}`, '', '--',
    `${ar ? 'إيقاف بريد الرسائل' : 'Ne plus recevoir ces emails'}${ar ? ': ' : ' : '}${desabo}`].join('\n');
  return { sujet, html, texte, desabo };
}

// Enquête d'insertion : invitation, ou rappel trois semaines après
export function rendreEnquete(vague: number, rappel: boolean, langue: Langue, site: string, token: string): Courriel {
  site = siteEn(site, langue);
  const ar = langue === 'ar', v = vague === 12 ? 12 : 6;
  const desabo = `${site}#desabo/${token}`;
  const url = `${site}#enquete`;
  const sujet = ar
    ? `${rappel ? 'تذكير: ' : ''}أين وصلت ${v === 12 ? 'بعد سنة' : 'بعد ستة أشهر'} من تخرجك؟ استمارة الإدماج المهني`
    : `${rappel ? 'Rappel : où' : 'Où'} en es-tu ${v === 12 ? 'un an' : 'six mois'} après ton diplôme ? Enquête d’insertion`;
  const lignes = ar ? [
    'تتابع الشبكة ما يصير إليه خريجو كل دفعة. جوابك (دقيقتان) يساعد الطلبة والدفعات القادمة.',
    'لا تُنشر الأجوبة إلا في شكل أرقام إجمالية، ولا شيء تحت 5 أجوبة.',
  ] : [
    'Le réseau suit ce que devient chaque promo. Ta réponse (2 minutes) aide les étudiants et les promos suivantes.',
    'Les réponses ne sont publiées qu’en chiffres globaux, jamais en dessous de 5 réponses.',
  ];
  const html = cadreEmail({
    langue, sujet, apercu: lignes[0], sousTitre: ar ? 'استمارة الإدماج المهني' : 'Enquête d’insertion',
    intro: [esc(ar ? 'مرحبًا،' : 'Bonjour,')],
    blocs: [{ lignes: lignes.map(esc), bouton: { texte: ar ? 'الإجابة على الاستمارة' : 'Répondre à l’enquête', url } }],
    pied: ar ? 'يصلك هذا البريد مرة عند فتح الاستمارة، وتذكير واحد إن لم تجب.' : 'Tu reçois cet email une fois à l’ouverture de l’enquête, et un seul rappel si tu n’as pas répondu.',
    liens: [[ar ? 'فتح المنصة' : 'Ouvrir la plateforme', site], [ar ? 'إلغاء الاشتراك' : 'Se désabonner', desabo]],
  });
  const texte = [`${(ar ? AR : FR).marque} · ${ar ? 'استمارة الإدماج المهني' : 'Enquête d’insertion'}`, '', ar ? 'مرحبًا،' : 'Bonjour,', ...lignes, '',
    `${ar ? 'الإجابة على الاستمارة' : 'Répondre à l’enquête'}${ar ? ': ' : ' : '}${url}`, '', '--', `${ar ? 'إلغاء الاشتراك' : 'Se désabonner'}${ar ? ': ' : ' : '}${desabo}`].join('\n');
  return { sujet, html, texte, desabo };
}

// Rappel d'inscription : le compte existe, le profil pas encore (envoyé une seule fois)
export function rendreRelance(langue: Langue, site: string): Courriel {
  site = siteEn(site, langue);
  const ar = langue === 'ar';
  const sujet = ar ? 'ملفك ينتظرك على شبكة ENSAM مكناس' : 'Ton profil t’attend sur le Réseau ENSAM Meknès';
  const lignes = ar ? [
    'أنشأت حسابك على شبكة ENSAM مكناس، لكن ملفك لم يكتمل بعد. بقيت خطوة واحدة: اسمك وشعبتك ودفعتك، في دقيقة واحدة.',
    'بعدها ترى عروض التدريب ومشاريع نهاية الدراسة والوظائف التي ينشرها الخريجون، ويمكنك طلب المساعدة من خريج من شعبتك، أو مساعدة الطلبة إن كنت من الخريجين.',
  ] : [
    'Tu as créé ton compte sur le Réseau ENSAM Meknès, mais ton profil n’est pas encore rempli. Il reste une étape : ton nom, ta filière et ta promo, en une minute.',
    'Ensuite, tu vois les offres de stage, de PFE et d’emploi publiées par les lauréats, tu peux demander de l’aide à un lauréat de ta filière, ou aider les étudiants si tu es lauréat.',
  ];
  const bouton = ar ? 'إكمال ملفي' : 'Terminer mon profil';
  const pied = ar ? 'يصلك هذا التذكير مرة واحدة فقط. إن لم تنشئ هذا الحساب، تجاهل هذا البريد.' : 'Tu reçois ce rappel une seule fois. Si tu n’as pas créé ce compte, ignore simplement cet email.';
  const html = cadreEmail({
    langue, sujet, apercu: lignes[0], sousTitre: ar ? 'تسجيلك' : 'Ton inscription',
    intro: [esc(ar ? 'مرحبًا،' : 'Bonjour,')],
    blocs: [{ lignes: lignes.map(esc), bouton: { texte: bouton, url: site } }],
    pied, liens: [[ar ? 'فتح المنصة' : 'Ouvrir la plateforme', site]],
  });
  const texte = [`${(ar ? AR : FR).marque} · ${ar ? 'تسجيلك' : 'Ton inscription'}`, '', ar ? 'مرحبًا،' : 'Bonjour,', ...lignes, '',
    `${bouton}${ar ? ': ' : ' : '}${site}`, '', '--', pied].join('\n');
  return { sujet, html, texte, desabo: '' };
}

// ---------------------------------------------------------------------
// Rappels de visite : après quelques jours sans visite, ce qui attend vraiment le membre, avec les vrais chiffres.
// La base choisit qui et compte (rappels_dus, rappel_contenu dans schema.sql) ; ici, seulement les mots.
// ---------------------------------------------------------------------
export const RAPPEL_ORDRE = ['messages', 'propositions', 'mentorats', 'candidatures', 'demandes', 'offres'] as const;
type CleRappel = typeof RAPPEL_ORDRE[number];
const ROUTE_RAPPEL: Record<CleRappel, string> = {
  messages: 'messages', propositions: 'offres/demandes', mentorats: 'mentorat', candidatures: 'espace', demandes: 'offres/demandes', offres: 'offres',
};
// Ce qui attend, dans l'ordre où on le dit (le plus personnel d'abord) ; un chiffre douteux est ignoré
export function comptesRappel(data: unknown): [CleRappel, number][] {
  const o = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  return RAPPEL_ORDRE.map(k => [k, Number(o[k])] as [CleRappel, number]).filter(([, n]) => Number.isInteger(n) && n > 0 && n < 100000);
}
const MOTS_RAPPEL: Record<Langue, Record<CleRappel, (n: number) => string>> = {
  fr: {
    messages: n => (n > 1 ? `${n} messages non lus` : '1 message non lu'),
    propositions: n => (n > 1 ? `${n} lauréats te proposent leur aide` : 'un lauréat te propose son aide'),
    mentorats: n => (n > 1 ? `${n} mentorats attendent ta réponse` : '1 mentorat attend ta réponse'),
    candidatures: n => (n > 1 ? `${n} nouvelles candidatures sur tes offres` : '1 nouvelle candidature sur tes offres'),
    demandes: n => (n > 1 ? `${n} demandes d’étudiants depuis ta dernière visite` : '1 demande d’étudiant depuis ta dernière visite'),
    offres: n => (n > 1 ? `${n} nouvelles offres pour toi` : '1 nouvelle offre pour toi'),
  },
  ar: {
    messages: n => arN(n, ['رسالة غير مقروءة', 'رسالتان غير مقروءتين', '{n} رسائل غير مقروءة', '{n} رسالة غير مقروءة']),
    propositions: n => arN(n, ['عرض مساعدة من خريج', 'عرضا مساعدة من الخريجين', '{n} عروض مساعدة من الخريجين', '{n} عرض مساعدة من الخريجين']),
    mentorats: n => arN(n, ['إرشاد ينتظر ردك', 'إرشادان ينتظران ردك', '{n} إرشادات تنتظر ردك', '{n} إرشادًا ينتظر ردك']),
    candidatures: n => arN(n, ['ترشيح جديد على عروضك', 'ترشيحان جديدان على عروضك', '{n} ترشيحات جديدة على عروضك', '{n} ترشيحًا جديدًا على عروضك']),
    demandes: n => arN(n, ['طلب مساعدة جديد من الطلبة منذ زيارتك الأخيرة', 'طلبا مساعدة جديدان من الطلبة منذ زيارتك الأخيرة', '{n} طلبات مساعدة جديدة من الطلبة منذ زيارتك الأخيرة', '{n} طلب مساعدة جديدًا من الطلبة منذ زيارتك الأخيرة']),
    offres: n => arN(n, ['عرض جديد يخصك', 'عرضان جديدان يخصانك', '{n} عروض جديدة تخصك', '{n} عرضًا جديدًا يخصك']),
  },
};
const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export function phrasesRappel(data: unknown, langue: unknown): string[] {
  const l = langueDe(langue);
  return comptesRappel(data).map(([k, n]) => MOTS_RAPPEL[l][k](n));
}

// Notification : la chose la plus personnelle en titre, le reste dessous ; elle ouvre l'écran de la première
export function notifRappel(data: unknown, langue: unknown, site: string): Notif | null {
  const l = langueDe(langue), c = comptesRappel(data);
  if (!c.length) return null;
  const p = phrasesRappel(data, l);
  const corps = p.length > 1 ? (l === 'ar' ? `وأيضًا: ${p.slice(1).join('، ')}.` : `Aussi : ${p.slice(1).join(' · ')}.`)
    : (l === 'ar' ? 'ألقِ نظرة متى سمح وقتك.' : 'À voir quand tu as un moment.');
  return { title: couper(majuscule(p[0]), 80), body: couper(corps, 180), url: `${site}#${ROUTE_RAPPEL[c[0][0]]}`, tag: 'rappel_visite' };
}

// Email (sans téléphone abonné, ou absent depuis 5 jours) : les mêmes chiffres, un bouton, le lien pour ne plus les recevoir
export function rendreRappel(data: unknown, langue: Langue, site: string, token: string): Courriel {
  site = siteEn(site, langue);
  const ar = langue === 'ar', c = comptesRappel(data), p = phrasesRappel(data, langue).map(majuscule);
  const desabo = `${site}#desabo/${token}/rappels`;
  const url = c.length ? `${site}#${ROUTE_RAPPEL[c[0][0]]}` : site;
  const sujet = couper(`${p[0] || (ar ? 'شبكة ENSAM مكناس' : 'Réseau ENSAM Meknès')}${ar ? ' · شبكة ENSAM' : ' · Réseau ENSAM'}`, 110);
  const salut = ar ? 'مرحبًا،' : 'Bonjour,';
  const intro = ar ? 'إليك ما ينتظرك على شبكة ENSAM منذ زيارتك الأخيرة:' : 'Voici ce qui t’attend sur le Réseau ENSAM depuis ta dernière visite :';
  const bouton = ar ? 'عرض على المنصة' : 'Voir sur la plateforme';
  const pied = ar ? 'يصلك هذا التذكير حين ينتظرك شيء بعد أيام دون زيارة، مرة في الأسبوع على الأكثر عبر البريد.'
    : 'Tu reçois ce rappel quand quelque chose t’attend après quelques jours sans visite, une fois par semaine au plus par email.';
  const arret = ar ? 'إيقاف هذه التذكيرات' : 'Ne plus recevoir ces rappels';
  const html = cadreEmail({
    langue, sujet, apercu: p.join(' · '), sousTitre: ar ? 'ما ينتظرك' : 'Ce qui t’attend',
    intro: [esc(salut), esc(intro)],
    blocs: [{ lignes: p.map(x => `• ${esc(x)}`), bouton: { texte: bouton, url } }],
    pied, liens: [[ar ? 'فتح المنصة' : 'Ouvrir la plateforme', site], [arret, desabo]],
  });
  const texte = [`${(ar ? AR : FR).marque} · ${ar ? 'ما ينتظرك' : 'Ce qui t’attend'}`, '', salut, intro, ...p.map(x => `• ${x}`), '',
    `${bouton}${ar ? ': ' : ' : '}${url}`, '', '--', pied, `${arret}${ar ? ': ' : ' : '}${desabo}`].join('\n');
  return { sujet, html, texte, desabo };
}

// ---------------------------------------------------------------------
// Résumé hebdomadaire : lecture de la base
// ---------------------------------------------------------------------
export async function chargerDonnees(env: Env, ids: string[], date: Date): Promise<Brut> {
  const t = date.getTime(), s7 = iso(t - 7 * JOUR), s14 = iso(t - 14 * JOUR);
  const P = 'select=id,student_id,laureat_id,saison,status,entreprise,type,pays,merci,confirmed_at';
  const M = 'select=id,student_id,mentor_id,sujet,status,rdv_at,merci,created_at';
  const Q = 'select=id,author_id,titre,entreprise,pays,created_at';
  const C = 'select=id,student_id,offer_id,status';
  const [profils, offres, postule, invitations, m1, m2, reponses, questions, parrainages, cafes, p1, p2, p3] = await Promise.all([
    tout<Profil>(env, 'profiles', 'select=id,full_name,role,filiere,promo,entreprise,pays,ville,vitrine,verified,cv_url,cv_path,competences,created_at,en_recherche')
      .catch(() => tout<Profil>(env, 'profiles', 'select=id,full_name,role,filiere,promo,entreprise,pays,ville,vitrine,verified,cv_url,cv_path,competences,created_at'))
      .catch(() => tout<Profil>(env, 'profiles', 'select=id,full_name,role,filiere,promo,entreprise,pays,ville,vitrine,verified,cv_url,competences,created_at')),
    tout<Offre>(env, 'offers', 'select=id,author_id,titre,entreprise,filieres,annees,audience,status,created_at,relance_at'),
    tout<Candidature>(env, 'applications', `${C}&status=eq.postule&offer_id=not.is.null`),
    parIds<Invitation>(env, 'invitations', 'select=id,laureat_id,student_id,offer_id,status&status=eq.envoyee', 'student_id', ids),
    tout<Mentorat>(env, 'mentorships', `${M}&status=in.(demande,acceptee)`),
    tout<Mentorat>(env, 'mentorships', `${M}&merci=not.is.null&rdv_at=gte.${s7}`),
    tout<Reponse>(env, 'answers', `select=id,question_id,author_id,created_at&created_at=gte.${s14}`),
    tout<Question>(env, 'questions', `${Q}&created_at=gte.${s14}`),
    tout<Parrainage>(env, 'parrainages', `select=id,filleul_id,parrain_id,created_at&created_at=gte.${s7}`),
    tout<Cafe>(env, 'cafes', `select=id,organisateur_id,ville,lieu,date_at,annule&annule=is.false&date_at=gte.${iso(t)}&date_at=lte.${iso(t + 14 * JOUR)}`),
    tout<Placement>(env, 'placements', `${P}&saison=eq.${saisonDe(date)}`),
    tout<Placement>(env, 'placements', `${P}&status=eq.en_attente`),
    tout<Placement>(env, 'placements', `${P}&confirmed_at=gte.${s7}`),
  ]);
  // Questions des réponses récentes, et candidatures des étudiants invités
  const connues = new Set(questions.map(q => q.id));
  const [q2, c2] = await Promise.all([
    parIds<Question>(env, 'questions', Q, 'id', reponses.map(a => a.question_id).filter(id => !connues.has(id))),
    parIds<Candidature>(env, 'applications', `${C}&offer_id=not.is.null`, 'student_id', invitations.map(i => i.student_id)),
  ]);
  // Phase 3 : facultatif tant que la mise à jour de la base n'est pas passée
  const fac = <T>(p: Promise<T[]>): Promise<T[]> => p.catch(() => [] as T[]);
  const moisAmb = moisPrecedent(date);
  const [evenements, enquetes, relectures, demandesContact, signalements, ambassadeurs] = await Promise.all([
    fac(tout<Evenement>(env, 'evenements', `select=id,titre,debut,lieu,public,annule&annule=is.false&debut=gte.${iso(t)}&debut=lte.${iso(t + 14 * JOUR)}`)),
    fac(parIds<{ user_id: string; vague: number }>(env, 'enquetes_insertion', 'select=id,user_id,vague', 'user_id', ids)),
    fac(tout<Relecture>(env, 'relectures_cv', 'select=id,student_id,reviewer_id,status&status=eq.demandee')),
    fac(parIds<DemandeContact>(env, 'demandes_contact', 'select=id,demandeur_id,cible_id,status&status=eq.envoyee', 'cible_id', ids)),
    fac(tout<{ id: string }>(env, 'signalements', 'select=id&status=eq.ouvert')),
    moisAmb ? fac(rpc(env, 'chiffres_ambassadeurs', { p_debut: moisAmb }).then(x => (Array.isArray(x) ? x as ChiffresPromo[] : []))) : Promise.resolve([] as ChiffresPromo[]),
  ]);
  return {
    profils, offres, invitations, reponses, parrainages, cafes,
    evenements, enquetes, relectures, demandesContact, signalements: signalements.length,
    ambassadeurs, moisAmbassadeurs: moisAmb || undefined,
    candidatures: unique([...postule, ...c2]),
    mentorats: unique([...m1, ...m2]),
    questions: unique([...questions, ...q2]),
    placements: unique([...p1, ...p2, ...p3]),
  };
}

// ---------------------------------------------------------------------
// Les tâches
// ---------------------------------------------------------------------
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-notifier',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });
const refus = () => json({ error: 'Non autorisé' }, 401);

// Appel de la base : en-tête x-notifier = app_secrets.notifier_secret
async function appelAutorise(env: Env, req: Request): Promise<boolean> {
  const recu = req.headers.get('x-notifier') || '';
  if (!recu) return false;
  const l = (await db(env, 'app_secrets?select=valeur&cle=eq.notifier_secret')) as { valeur: string }[];
  const attendu = l[0]?.valeur || '';
  if (!attendu) { console.error('notifier : notifier_secret absent de app_secrets'); return false; }
  return egalConstant(recu, attendu);
}

async function jobCle(env: Env): Promise<Response> {
  const k = await clesVapid(env);
  if (!k) throw new Error('clés VAPID indisponibles');
  return json({ publicKey: k.publique });
}

type Bilan = { sent: number; failed: number; removed: number };

// Envoie à un téléphone les notifications de son membre, dans l'ordre ; s'arrête s'il n'existe plus
async function envoyerA(a: Abonnement, notifs: { n: Notif; urg: string }[], v: Vapid, b: Bilan, morts: string[]) {
  for (const x of notifs) {
    const st = await pousserUn(a, x.n, x.urg, v);
    if (ok(st)) b.sent++;
    else if (st === 404 || st === 410) { b.removed++; morts.push(a.id); return; }
    else b.failed++;
  }
}

async function jobPush(env: Env): Promise<Response> {
  const b: Bilan = { sent: 0, failed: 0, removed: 0 };
  let v: Vapid | null = null;
  const debut = Date.now();
  for (let tour = 0; tour < 5; tour++) {
    // Garde-fou (2 s de CPU, 150 s en tout) : au-delà, la suite reste en file pour l'appel suivant
    if (b.sent + b.failed + b.removed >= 900 || Date.now() - debut > 60_000) break;
    const lignes = (await rpc(env, 'prendre_push', { p_max: 300 })) as { id: number; user_id: string; kind: string; data: unknown; langue: string }[];
    if (!lignes?.length) break;
    v = v || (await preparerVapid(env));
    // Les notifications de chaque membre, puis ses téléphones (une seule lecture par tour)
    const parMembre = new Map<string, { n: Notif; urg: string }[]>();
    for (const l of lignes) {
      const n = texteNotif(l.kind, l.data, l.langue, env.site);
      if (!n) { console.error('notifier : notification ignorée (type ou statut inconnu)', l.kind); continue; }
      const liste = parMembre.get(l.user_id);
      if (liste) liste.push({ n, urg: urgence(l.kind) }); else parMembre.set(l.user_id, [{ n, urg: urgence(l.kind) }]);
    }
    const abos = await parIds<Abonnement>(env, 'push_subscriptions', 'select=id,user_id,endpoint,p256dh,auth', 'user_id', [...parMembre.keys()]);
    const morts: string[] = [];
    const vv = v;
    await parallele(abos, 10, a => envoyerA(a, parMembre.get(a.user_id) || [], vv, b, morts));
    await supprimer(env, 'push_subscriptions', morts);
  }
  return json(b);
}

async function jobTest(env: Env, req: Request): Promise<Response> {
  const jeton = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!jeton) return refus();
  const r = await fetch(`${env.url}/auth/v1/user`, { headers: { apikey: env.cle, Authorization: `Bearer ${jeton}` } });
  if (!r.ok) { await r.body?.cancel(); return refus(); }
  const u = (await r.json()) as { id?: string };
  if (!estUuid(u?.id)) return refus();
  const [abos, profil] = await Promise.all([
    tout<Abonnement>(env, 'push_subscriptions', `select=id,user_id,endpoint,p256dh,auth&user_id=eq.${u.id}`),
    db(env, `profiles?select=langue&id=eq.${u.id}`) as Promise<{ langue: string }[]>,
  ]);
  if (!abos.length) return json({ sent: 0 });
  const v = await preparerVapid(env);
  const n = texteNotif('test', {}, profil[0]?.langue, env.site) as Notif;
  const b: Bilan = { sent: 0, failed: 0, removed: 0 };
  const morts: string[] = [];
  await parallele(abos, 5, a => envoyerA(a, [{ n, urg: 'normal' }], v, b, morts));
  await supprimer(env, 'push_subscriptions', morts);
  return json({ sent: b.sent });
}

// ---------------------------------------------------------------------
// Email par Gmail : SMTP sur le port 465 (TLS direct ; Supabase bloque 25 et 587).
// L'expéditeur est le compte Gmail lui-même, donc sa photo de profil s'affiche.
// ---------------------------------------------------------------------
const GMAIL_HOTE = 'smtp.gmail.com';
const GMAIL_PORT = 465;
const PAR_CONNEXION = 40;      // messages avant de rouvrir la connexion
const ATTENTE_SMTP = 20000;

export type Conn = { read(p: Uint8Array): Promise<number | null>; write(p: Uint8Array): Promise<number>; close(): void };
// Remplaçable par les tests
export const tls = {
  connecter: (hote: string, port: number): Promise<Conn> => Deno.connectTls({ hostname: hote, port }),
};

function b64(u: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
const b64Lignes = (t: string): string => (b64(enc.encode(t)).match(/.{1,76}/g) || []).join('\r\n');

// En-tête lisible par tous les clients : ASCII tel quel, sinon mots encodés UTF-8 de 45 octets au plus
export function enteteMot(t: string): string {
  const v = t.replace(/[\r\n]+/g, ' ');
  if (/^[\x20-\x7e]*$/.test(v) && v.length <= 900) return v;
  const mots: string[] = [];
  let cur: number[] = [];
  for (const c of Array.from(v)) {
    const o = enc.encode(c);
    if (cur.length + o.length > 45) { mots.push(b64(new Uint8Array(cur))); cur = []; }
    cur.push(...o);
  }
  if (cur.length) mots.push(b64(new Uint8Array(cur)));
  return mots.map(m => `=?UTF-8?B?${m}?=`).join('\r\n ');
}

const adresseSure = (a: string): boolean => /^[^\s<>()",;:@\\]+@[^\s<>()",;:@\\]+\.[^\s<>()",;:@\\]+$/.test(a);

export function messageMime(de: { nom: string; email: string }, a: string, m: Courriel, date = new Date(), id = crypto.randomUUID()): string {
  const frontiere = 'ensam-' + id.replace(/-/g, '');
  const domaine = de.email.split('@')[1] || 'localhost';
  const lignes = [
    `From: ${enteteMot(de.nom)} <${de.email}>`,
    `To: <${a}>`,
    `Subject: ${enteteMot(m.sujet)}`,
    `Date: ${date.toUTCString().replace(/GMT$/, '+0000')}`,
    `Message-ID: <${id}@${domaine}>`,
    ...(m.desabo ? [`List-Unsubscribe: <${m.desabo}>`] : []),
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${frontiere}"`,
    '',
    `--${frontiere}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64Lignes(m.texte),
    `--${frontiere}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64Lignes(m.html),
    `--${frontiere}--`,
    '',
  ];
  return lignes.join('\r\n');
}

type ReponseSmtp = { code: number; texte: string };
class ErreurSmtp extends Error {
  code: number;
  constructor(code: number, texte: string) { super(`${code} ${texte}`.slice(0, 300)); this.code = code; }
}

class ClientSmtp {
  private tampon = '';
  private dec = new TextDecoder();
  private conn: Conn;
  envoyes = 0;
  private constructor(conn: Conn) { this.conn = conn; }

  static async ouvrir(user: string, mdp: string): Promise<ClientSmtp> {
    const c = new ClientSmtp(await tls.connecter(GMAIL_HOTE, GMAIL_PORT));
    try {
      await c.attendre([220]);
      await c.commande('EHLO reseau-ensam.supabase.co', [250]);
      await c.commande('AUTH PLAIN ' + b64(enc.encode(`\0${user}\0${mdp}`)), [235]);
      return c;
    } catch (e) {
      c.fermer();
      throw e;
    }
  }

  private async lire(): Promise<ReponseSmtp> {
    const fin = Date.now() + ATTENTE_SMTP;
    const morceau = new Uint8Array(4096);
    for (;;) {
      // Réponse complète : dernière ligne « NNN texte » (les précédentes sont « NNN-texte »)
      const lignes = this.tampon.split('\r\n');
      for (let i = 0; i < lignes.length - 1; i++) {
        if (/^\d{3}(?: |$)/.test(lignes[i])) {
          this.tampon = lignes.slice(i + 1).join('\r\n');
          return { code: Number(lignes[i].slice(0, 3)), texte: lignes.slice(0, i + 1).map(l => l.slice(4)).join(' ') };
        }
      }
      const reste = fin - Date.now();
      if (reste <= 0) throw new Error('SMTP : pas de réponse');
      let minuteur = 0;
      const n = await Promise.race([
        this.conn.read(morceau),
        new Promise<never>((_, non) => { minuteur = setTimeout(() => non(new Error('SMTP : pas de réponse')), reste); }),
      ]).finally(() => clearTimeout(minuteur));
      if (n === null) throw new Error('SMTP : connexion fermée');
      this.tampon += this.dec.decode(morceau.subarray(0, n), { stream: true });
    }
  }

  private async ecrire(t: string): Promise<void> {
    let o = enc.encode(t);
    while (o.length) o = o.subarray(await this.conn.write(o));
  }

  private async attendre(codes: number[]): Promise<ReponseSmtp> {
    const r = await this.lire();
    if (!codes.includes(r.code)) throw new ErreurSmtp(r.code, r.texte);
    return r;
  }

  async commande(ligne: string, codes: number[]): Promise<ReponseSmtp> {
    await this.ecrire(ligne + '\r\n');
    return this.attendre(codes);
  }

  // Un refus du destinataire laisse la connexion utilisable (RSET) ; une panne la ferme
  async envoyer(de: string, a: string, donnees: string): Promise<void> {
    try {
      await this.commande(`MAIL FROM:<${de}>`, [250]);
      await this.commande(`RCPT TO:<${a}>`, [250, 251]);
      await this.commande('DATA', [354]);
    } catch (e) {
      if (e instanceof ErreurSmtp) await this.commande('RSET', [250]);
      throw e;
    }
    // Transparence : un point en début de ligne est doublé
    await this.ecrire(donnees.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..').replace(/(\r\n)?$/, '\r\n') + '.\r\n');
    await this.attendre([250]);
    this.envoyes++;
  }

  async quitter(): Promise<void> {
    try { await this.commande('QUIT', [221]); } catch { /* déjà fermée */ }
    this.fermer();
  }

  fermer(): void {
    try { this.conn.close(); } catch { /* déjà fermée */ }
  }
}

// Quelques connexions partagées par les envois parallèles. Si Gmail refuse le compte
// (mot de passe) ou la limite du jour est atteinte, plus rien ne part par Gmail.
export class PosteGmail {
  private libres: ClientSmtp[] = [];
  private user: string;
  private mdp: string;
  casse = '';
  constructor(user: string, mdp: string) { this.user = user; this.mdp = mdp; }

  private bloquant(e: unknown): boolean {
    if (!(e instanceof ErreurSmtp)) return false;
    return e.code === 535 || e.code === 534 || /5\.4\.5|4\.7\.0|limit/i.test(e.message);
  }

  async envoyer(de: { nom: string; email: string }, a: string, m: Courriel): Promise<boolean> {
    if (this.casse) return false;
    if (!adresseSure(a)) { console.error('notifier : adresse email invalide'); return false; }
    const donnees = messageMime(de, a, m);
    for (let essai = 0; essai < 2; essai++) {
      // Le nouvel essai se fait sur une connexion neuve : une autre connexion gardée a pu être coupée elle aussi
      const reprise = essai === 0 ? this.libres.pop() : undefined;
      let c: ClientSmtp | undefined = reprise;
      try {
        if (!c) c = await ClientSmtp.ouvrir(this.user, this.mdp);
        await c.envoyer(this.user, a, donnees);
        if (c.envoyes >= PAR_CONNEXION) await c.quitter(); else this.libres.push(c);
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (this.bloquant(e)) {
          this.casse = msg;
          c?.fermer();
          console.error('notifier : Gmail refuse les envois', msg);
          return false;
        }
        if (e instanceof ErreurSmtp && e.code >= 500) {
          // destinataire refusé : la connexion reste bonne
          if (c) this.libres.push(c);
          console.error('notifier : Gmail a refusé un email', msg);
          return false;
        }
        c?.fermer();
        // Une connexion reprise a pu être coupée par Gmail entre deux envois : un seul nouvel essai
        if (reprise && essai === 0) continue;
        console.error('notifier : Gmail injoignable', msg);
        return false;
      }
    }
    return false;
  }

  async fermer(): Promise<void> {
    const l = this.libres.splice(0);
    await Promise.all(l.map(c => c.quitter()));
  }
}

async function envoyerBrevo(env: Env, a: string, m: Courriel): Promise<boolean> {
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.brevo, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: env.nomExpediteur, email: env.expediteur }, to: [{ email: a }],
        subject: m.sujet, htmlContent: m.html, textContent: m.texte,
        ...(m.desabo ? { headers: { 'List-Unsubscribe': `<${m.desabo}>` } } : {}),
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (r.ok) { await r.body?.cancel(); return true; }
    console.error('notifier : Brevo a refusé un email', r.status, (await r.text()).slice(0, 300));
    return false;
  } catch (e) {
    console.error('notifier : Brevo injoignable', e instanceof Error ? e.message : String(e));
    return false;
  }
}

// Gmail d'abord ; Brevo prend le relais si Gmail refuse le compte ou la limite du jour est atteinte
function facteur(env: Env) {
  const brevo = !!(env.brevo && env.expediteur);
  const poste = env.gmail && env.gmailMdp ? new PosteGmail(env.gmail, env.gmailMdp) : null;
  return {
    pret: !!poste || brevo,
    paralleles: poste ? 3 : 5,
    async envoyer(a: string, m: Courriel): Promise<boolean> {
      if (poste && !poste.casse) {
        const ok = await poste.envoyer({ nom: env.nomExpediteur, email: env.gmail }, a, m);
        if (ok || !poste.casse || !brevo) return ok;
      }
      return brevo ? envoyerBrevo(env, a, m) : false;
    },
    fermer: async () => { if (poste) await poste.fermer(); },
    via: () => (!poste ? 'brevo' : poste.casse && brevo ? 'gmail+brevo' : 'gmail'),
  };
}

// Essai : le résumé de la semaine des administrateurs, envoyé tout de suite (rien n'est marqué)
async function jobEssaiEmail(env: Env): Promise<Response> {
  const f = facteur(env);
  if (!f.pret) return json({ skipped: 'email' });
  const admins = ((await db(env, 'profiles?select=id,langue&role=eq.admin')) || []) as { id: string; langue: string }[];
  const b = { sent: 0, errors: 0, via: f.via() };
  if (!admins.length) return json(b);
  const date = new Date();
  const ids = admins.map(x => x.id);
  const [brut, etats] = await Promise.all([
    chargerDonnees(env, ids, date),
    // notif_etat n'a pas de colonne id : on trie par user_id
    parIds<{ user_id: string; token: string }>(env, 'notif_etat', 'select=user_id,token&order=user_id', 'user_id', ids),
  ]);
  const d = indexer(brut, date);
  for (const x of admins) {
    const p = d.profils.get(x.id);
    const r = await fetch(`${env.url}/auth/v1/admin/users/${x.id}`, { headers: { apikey: env.cle, Authorization: `Bearer ${env.cle}` } });
    const email = r.ok ? ((await r.json()) as { email?: string }).email : (await r.body?.cancel(), '');
    if (!p || !email) { b.errors++; continue; }
    const token = etats.find(e => e.user_id === x.id)?.token || '';
    const m = rendreResume(resumeDe(p, d) || resumeVide(p), langueDe(x.langue), env.site, token);
    if (await f.envoyer(email, m)) b.sent++; else b.errors++;
  }
  await f.fermer();
  b.via = f.via();
  return json(b);
}

async function jobResume(env: Env): Promise<Response> {
  const f = facteur(env);
  if (!f.pret) return json({ skipped: 'email' });
  const date = new Date();
  const dest = ((await rpc(env, 'destinataires_resume', { p_max: 150 })) || []) as { id: string; email: string; langue: string; token: string }[];
  const b: { sent: number; empty: number; errors: number; via?: string } = { sent: 0, empty: 0, errors: 0 };
  if (!dest.length) return json(b);
  const d = indexer(await chargerDonnees(env, dest.map(x => x.id), date), date);
  const traites: string[] = [];
  const limite = Date.now() + 100_000;   // marge sur les 150 s : le reste partira demain
  await parallele(dest, f.paralleles, async x => {
    if (Date.now() > limite) return;
    try {
      const p = d.profils.get(x.id);
      const r = p ? resumeDe(p, d) : null;
      if (!r) { b.empty++; traites.push(x.id); return; }
      if (!x.email || !x.token) { b.errors++; return; }
      if (await f.envoyer(x.email, rendreResume(r, langueDe(x.langue), env.site, x.token))) { b.sent++; traites.push(x.id); }
      else b.errors++;
    } catch (e) {
      b.errors++;
      console.error('notifier : résumé impossible', e instanceof Error ? e.message : String(e));
    }
  });
  await f.fermer();
  b.via = f.via();
  // Chacun n'est examiné qu'une fois par semaine (envoyé ou vide)
  const ids = traites.filter(estUuid);
  for (let i = 0; i < ids.length; i += MORCEAU) {
    await db(env, `notif_etat?user_id=in.(${ids.slice(i, i + MORCEAU).join(',')})`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ resume_at: new Date().toISOString() }),
    });
  }
  return json(b);
}

// Alertes d'offres par email : la base choisit qui (une par heure au plus, 3 par jour, 150 en tout)
async function jobAlertes(env: Env): Promise<Response> {
  const f = facteur(env);
  if (!f.pret) return json({ skipped: 'email' });
  const dest = ((await rpc(env, 'alertes_a_envoyer', { p_max: 100 })) || []) as { id: string; email: string; langue: string; token: string; offres: OffreAlerte[] }[];
  const b: { sent: number; errors: number; via?: string } = { sent: 0, errors: 0 };
  if (!dest.length) return json(b);
  const envoyes: string[] = [];
  const limite = Date.now() + 100_000;
  await parallele(dest, f.paralleles, async x => {
    if (Date.now() > limite) return;
    const offres = (Array.isArray(x.offres) ? x.offres : []).filter(o => estUuid(o?.id) && txt(o.titre)).slice(0, 5);
    if (!offres.length || !x.email || !x.token || !estUuid(x.id)) { b.errors++; return; }
    try {
      if (await f.envoyer(x.email, rendreAlerte(offres, langueDe(x.langue), env.site, x.token))) { b.sent++; envoyes.push(x.id); }
      else b.errors++;
    } catch (e) {
      b.errors++;
      console.error('notifier : alerte impossible', e instanceof Error ? e.message : String(e));
    }
  });
  await f.fermer();
  b.via = f.via();
  if (envoyes.length) await rpc(env, 'alertes_envoyees', { p_ids: envoyes });
  return json(b);
}

// Demandes des étudiants : un email aux lauréats du parcours, et à tous pour celles restées sans aide, une fois par jour au plus (la base choisit qui)
async function jobDemandes(env: Env): Promise<Response> {
  const f = facteur(env);
  if (!f.pret) return json({ skipped: 'email' });
  const dest = ((await rpc(env, 'demandes_a_signaler', { p_max: 100 })) || []) as { id: string; email: string; langue: string; token: string; demandes: DemandeAlerte[] }[];
  const b: { sent: number; errors: number; via?: string } = { sent: 0, errors: 0 };
  if (!dest.length) return json(b);
  const envoyes: string[] = [];
  const limite = Date.now() + 100_000;
  await parallele(dest, f.paralleles, async x => {
    if (Date.now() > limite) return;
    const demandes = (Array.isArray(x.demandes) ? x.demandes : []).filter(d => estUuid(d?.id) && txt(d.titre)).slice(0, 5);
    if (!demandes.length || !x.email || !x.token || !estUuid(x.id)) { b.errors++; return; }
    try {
      if (await f.envoyer(x.email, rendreDemandes(demandes, langueDe(x.langue), env.site, x.token))) { b.sent++; envoyes.push(x.id); }
      else b.errors++;
    } catch (e) {
      b.errors++;
      console.error('notifier : email de demandes impossible', e instanceof Error ? e.message : String(e));
    }
  });
  await f.fermer();
  b.via = f.via();
  if (envoyes.length) await rpc(env, 'demandes_signalees', { p_ids: envoyes });
  return json(b);
}

// Messages non lus depuis 30 minutes : un email, toutes les 6 heures au plus par personne
async function jobMessages(env: Env): Promise<Response> {
  const f = facteur(env);
  if (!f.pret) return json({ skipped: 'email' });
  const dest = ((await rpc(env, 'messages_a_signaler', { p_max: 100 })) || []) as { id: string; email: string; langue: string; token: string; n: number; noms: string[] | null }[];
  const b: { sent: number; errors: number; via?: string } = { sent: 0, errors: 0 };
  if (!dest.length) return json(b);
  const envoyes: string[] = [];
  const limite = Date.now() + 100_000;
  await parallele(dest, f.paralleles, async x => {
    if (Date.now() > limite) return;
    if (!x.email || !x.token || !estUuid(x.id) || !(Number(x.n) > 0)) { b.errors++; return; }
    try {
      if (await f.envoyer(x.email, rendreMessages(Number(x.n), Array.isArray(x.noms) ? x.noms : [], langueDe(x.langue), env.site, x.token))) { b.sent++; envoyes.push(x.id); }
      else b.errors++;
    } catch (e) {
      b.errors++;
      console.error('notifier : email de messages impossible', e instanceof Error ? e.message : String(e));
    }
  });
  await f.fermer();
  b.via = f.via();
  if (envoyes.length) await rpc(env, 'messages_signales', { p_ids: envoyes });
  return json(b);
}

// Rappel d'inscription : un seul email ; seuls les comptes servis sont notés (un échec est retenté le lendemain)
async function jobRelances(env: Env): Promise<Response> {
  const f = facteur(env);
  if (!f.pret) return json({ skipped: 'email' });
  const dest = ((await rpc(env, 'comptes_a_relancer', { p_max: 100 })) || []) as { id: string; email: string; langue: string }[];
  const b: { sent: number; errors: number; via?: string } = { sent: 0, errors: 0 };
  if (!dest.length) return json(b);
  const envoyes: string[] = [];
  const limite = Date.now() + 100_000;
  await parallele(dest, f.paralleles, async x => {
    if (Date.now() > limite) return;
    if (!x.email || !estUuid(x.id)) { b.errors++; return; }
    try {
      if (await f.envoyer(x.email, rendreRelance(langueDe(x.langue), env.site))) { b.sent++; envoyes.push(x.id); }
      else b.errors++;
    } catch (e) {
      b.errors++;
      console.error('notifier : rappel d’inscription impossible', e instanceof Error ? e.message : String(e));
    }
  });
  await f.fermer();
  b.via = f.via();
  if (envoyes.length) await rpc(env, 'relances_envoyees', { p_ids: envoyes });
  return json(b);
}

// Enquête d'insertion : invitation à l'ouverture de la vague, puis un rappel ; la notification
// sur le téléphone part avec enquetes_invitees, même sans email
async function jobEnquetes(env: Env): Promise<Response> {
  const dest = ((await rpc(env, 'enquetes_a_inviter', { p_max: 100 })) || []) as { id: string; email: string | null; langue: string; token: string; vague: number; rappel: boolean; email_ok: boolean }[];
  const b: { sent: number; push: number; errors: number; via?: string } = { sent: 0, push: 0, errors: 0 };
  if (!dest.length) return json(b);
  const f = facteur(env);
  const faits: { id: string; vague: number; rappel: boolean }[] = [];
  const limite = Date.now() + 100_000;
  await parallele(dest, f.paralleles, async x => {
    if (Date.now() > limite || !estUuid(x.id) || (x.vague !== 6 && x.vague !== 12)) return;
    const ligne = { id: x.id, vague: x.vague, rappel: !!x.rappel };
    if (!x.email_ok || !x.email || !x.token || !f.pret) { b.push++; faits.push(ligne); return; }
    try {
      if (await f.envoyer(x.email, rendreEnquete(x.vague, !!x.rappel, langueDe(x.langue), env.site, x.token))) { b.sent++; faits.push(ligne); }
      else b.errors++;
    } catch (e) {
      b.errors++;
      console.error('notifier : invitation à l’enquête impossible', e instanceof Error ? e.message : String(e));
    }
  });
  await f.fermer();
  b.via = f.via();
  if (faits.length) await rpc(env, 'enquetes_invitees', { p_lignes: faits });
  return json(b);
}

// Rappels de visite par email : la base choisit qui (sans téléphone abonné, ou absent depuis 5 jours ; une fois par
// semaine au plus ; « Rappels » coché ; 150 par jour pour toute la plateforme). Par sûreté, rien ne part si un autre
// email du réseau (résumé, demandes, alertes, messages, enquête) est parti dans les dernières 24 h.
export const RAPPELS_MAX = 150;
async function jobRappels(env: Env): Promise<Response> {
  const f = facteur(env);
  if (!f.pret) return json({ skipped: 'email' });
  const dest = (((await rpc(env, 'rappels_emails_a_envoyer', { p_max: RAPPELS_MAX })) || []) as { id: string; email: string; langue: string; token: string; contenu: unknown; dernier_email: string | null }[])
    .slice(0, RAPPELS_MAX);
  const b: { sent: number; skipped: number; errors: number; via?: string } = { sent: 0, skipped: 0, errors: 0 };
  if (!dest.length) return json(b);
  const envoyes: string[] = [];
  const limite = Date.now() + 100_000;
  await parallele(dest, f.paralleles, async x => {
    if (Date.now() > limite) return;
    if (Date.now() - temps(x.dernier_email) < JOUR || !comptesRappel(x.contenu).length) { b.skipped++; return; }
    if (!x.email || !x.token || !estUuid(x.id)) { b.errors++; return; }
    try {
      if (await f.envoyer(x.email, rendreRappel(x.contenu, langueDe(x.langue), env.site, x.token))) { b.sent++; envoyes.push(x.id); }
      else b.errors++;
    } catch (e) {
      b.errors++;
      console.error('notifier : email de rappel impossible', e instanceof Error ? e.message : String(e));
    }
  });
  await f.fermer();
  b.via = f.via();
  if (envoyes.length) await rpc(env, 'rappels_emails_envoyes', { p_ids: envoyes });
  return json(b);
}

// ---------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------
export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);
  let job: unknown;
  try { job = (await req.json())?.job; } catch { return json({ error: 'Requête invalide' }, 400); }
  if (typeof job !== 'string' || !['cle', 'test', 'push', 'resume', 'essai_email', 'alertes', 'enquetes', 'messages', 'relances', 'demandes', 'rappels'].includes(job)) return json({ error: 'Tâche inconnue' }, 400);
  const env = lireEnv();
  if (!env.url || !env.cle) {
    console.error('notifier : SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant');
    return json({ error: 'Configuration incomplète' }, 500);
  }
  try {
    if (job === 'cle') return await jobCle(env);
    if (job === 'test') return await jobTest(env, req);
    if (!(await appelAutorise(env, req))) return refus();
    if (job === 'essai_email') return await jobEssaiEmail(env);
    if (job === 'alertes') return await jobAlertes(env);
    if (job === 'enquetes') return await jobEnquetes(env);
    if (job === 'messages') return await jobMessages(env);
    if (job === 'relances') return await jobRelances(env);
    if (job === 'demandes') return await jobDemandes(env);
    if (job === 'rappels') return await jobRappels(env);
    return job === 'push' ? await jobPush(env) : await jobResume(env);
  } catch (e) {
    console.error(`notifier : échec de « ${job} »`, e instanceof Error ? e.message : String(e));
    return json({ error: 'Erreur interne' }, 500);
  }
}

if (typeof Deno !== 'undefined') Deno.serve((req: Request) => handler(req));
