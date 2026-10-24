// Un faux site « en ligne » pour les tests : dist/ servi avec un config.js qui pointe vers un faux Supabase local.
// Il répond juste assez pour la page d'entrée, le code à 6 chiffres (123456 est le bon code), la « Dernière étape »,
// le lien d'une offre partagée et l'abonnement d'un appareil aux notifications. Chaque appel est noté (appels) pour
// vérifier ce qui part vers la base.
// Jetons (jetons) : comme PostgREST, un jeton expiré (exp passé) est refusé (401 « JWT expired ») ; jetons.depuis
// (secondes) périme d'un coup tous les jetons émis avant ; jetons.renouveler dit si /auth/v1/token?grant_type=refresh_token
// rend une nouvelle session ou la refuse (400 invalid_grant, comme un jeton de renouvellement révoqué ou trop ancien).
// tables : d'autres lignes rendues telles quelles (mentorats, propositions…).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg' };
export const UID = '00000000-0000-4000-8000-0000000000a1';

export async function fauxSite(SITE, { chiffres = { laureats: 39, entreprises: 19, promos: 14 }, reglages = [{ cle: 'domaines_ecole', valeur: ['ensam-umi.ac.ma'] }], offres = [], partagees = {}, profils = [], tables = {} } = {}) {
  let port; const appels = []; const meta = {}; const inscrits = []; const jetons = { renouveler: false, depuis: 0, n: 0 };
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
  const json = (r, code, body) => { r.writeHead(code, { 'content-type': 'application/json', ...cors }); r.end(body === undefined ? '' : JSON.stringify(body)); };
  const session = email => {
    const now = Math.floor(Date.now() / 1000);
    return { access_token: 'x.' + Buffer.from(JSON.stringify({ sub: UID, exp: now + 3600, iat: now, n: ++jetons.n })).toString('base64url') + '.y', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'r' + jetons.n,
      user: { id: UID, aud: 'authenticated', role: 'authenticated', email, user_metadata: meta[email] || {}, app_metadata: {}, created_at: new Date().toISOString() } };
  };
  const srv = http.createServer((q, r) => {
    const url = new URL(q.url, 'http://x'); const u = decodeURIComponent(url.pathname);
    if (u.startsWith('/sb/')) {
      let b = ''; q.on('data', c => { b += c; }); q.on('end', () => {
        if (q.method === 'OPTIONS') return json(r, 204);
        const corps = b ? JSON.parse(b) : null;
        appels.push({ u, m: q.method, corps });
        if (u === '/sb/auth/v1/otp') {
          if (corps.email === 'vite@exemple.ma') return json(r, 429, { code: 'over_email_send_rate_limit', msg: 'For security purposes, you can only request this after 42 seconds.' });
          if (corps.email === 'inconnu@exemple.ma' && corps.create_user === false) return json(r, 422, { code: 'otp_disabled', msg: 'Signups not allowed for otp' });
          // Comme Supabase : les données ne sont gardées qu'à la création du compte
          if (corps.data && !meta[corps.email]) meta[corps.email] = { ...corps.data };
          return json(r, 200, {});
        }
        if (u === '/sb/auth/v1/verify') return corps.token === '123456' ? json(r, 200, session(corps.email)) : json(r, 403, { code: 'otp_expired', msg: 'Token has expired or is invalid' });
        if (u === '/sb/auth/v1/user') {
          const email = Object.keys(meta).pop() || 'membre@exemple.ma';
          if (q.method === 'PUT') meta[email] = { ...(meta[email] || {}), ...(corps?.data || {}) };
          return json(r, 200, session(email).user);
        }
        if (u === '/sb/auth/v1/logout') return json(r, 204);
        if (u === '/sb/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
          return jetons.renouveler ? json(r, 200, session(Object.keys(meta).pop() || 'membre@exemple.ma')) : json(r, 400, { code: 'refresh_token_not_found', error: 'invalid_grant', error_description: 'Invalid Refresh Token: Refresh Token Not Found' });
        }
        if (u === '/sb/auth/v1/token') return json(r, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
        // La base refuse un jeton expiré, comme PostgREST
        if (u.startsWith('/sb/rest/v1/')) {
          const jeton = (q.headers.authorization || '').replace(/^Bearer\s+/i, '');
          let p = null; try { p = JSON.parse(Buffer.from(jeton.split('.')[1] || '', 'base64url').toString()); } catch { /* clé publique */ }
          if (p && (p.exp < Date.now() / 1000 || (jetons.depuis && !(p.iat >= jetons.depuis)))) { appels[appels.length - 1].refuse = true; return json(r, 401, { code: 'PGRST301', details: null, hint: null, message: 'JWT expired' }); }
        }
        if (u === '/sb/rest/v1/rpc/chiffres_publics') return chiffres ? json(r, 200, chiffres) : json(r, 404, { code: 'PGRST202', message: 'Could not find the function' });
        if (u === '/sb/rest/v1/rpc/offre_partagee') {
          const x = partagees[corps?.p_id];
          return x === undefined || x === 404 ? json(r, 404, { code: 'PGRST202', message: 'Could not find the function' }) : json(r, 200, x);
        }
        // Notifications : la clé publique de la plateforme, puis l'abonnement d'un appareil
        if (u === '/sb/functions/v1/notifier' && corps?.job === 'cle') return json(r, 200, { publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' });
        if (u === '/sb/rest/v1/rpc/abonner_push') return json(r, 204);
        if (u.startsWith('/sb/rest/v1/rpc/')) return json(r, 404, { code: 'PGRST202', message: 'Could not find the function' });
        if (u === '/sb/rest/v1/reglages') return json(r, 200, reglages);
        if (u === '/sb/rest/v1/offers' && q.method === 'GET') return json(r, 200, offres);
        if ((u === '/sb/rest/v1/profils' || u === '/sb/rest/v1/profiles') && q.method === 'GET') return json(r, 200, [...profils, ...inscrits]);
        if (u === '/sb/rest/v1/profiles' && q.method === 'POST') {
          const row = { created_at: new Date().toISOString(), verified: false, ...(Array.isArray(corps) ? corps[0] : corps) };
          inscrits.push(row);
          return json(r, 201, /vnd\.pgrst\.object/.test(q.headers.accept || '') ? row : [row]);
        }
        const t = u.slice('/sb/rest/v1/'.length);
        if ((q.method === 'GET' || q.method === 'HEAD') && tables[t]) return json(r, 200, tables[t]);
        if (q.method === 'GET' || q.method === 'HEAD') return json(r, 200, []);
        return json(r, 201, /vnd\.pgrst\.object/.test(q.headers.accept || '') ? (Array.isArray(corps) ? corps[0] : corps) : []);
      });
      return;
    }
    const f = u.endsWith('/') ? u + 'index.html' : u;
    if (f === '/config.js') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(`window.ENSAM_CONFIG = { supabaseUrl: 'http://127.0.0.1:${port}/sb', supabaseAnonKey: 'cle' };`); }
    const fichier = path.join(SITE, path.normalize(f));
    if (!fichier.startsWith(SITE)) { r.writeHead(403); return r.end(); }
    fs.readFile(fichier, (e, b) => {
      if (e) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b);
    });
  });
  srv.on('upgrade', (_q, s) => s.destroy()); // temps réel : absent ici
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); port = srv.address().port;
  // Chaque test repart d'une base vide (personne d'inscrit, aucun appel noté)
  const vider = () => { appels.length = 0; inscrits.length = 0; for (const k of Object.keys(meta)) delete meta[k]; for (const k of Object.keys(tables)) delete tables[k]; Object.assign(jetons, { renouveler: false, depuis: 0 }); };
  return { adresse: `http://127.0.0.1:${port}/`, appels, inscrits, tables, jetons, vider, fermer: () => srv.close() };
}
