// Faux serveur SMTP Gmail (TLS direct) et adaptateur socket Node -> connexion façon Deno
import tlsNode from 'node:tls';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Certificats de test (une autorité et un certificat « smtp.gmail.com ») créés une fois avec openssl
const DOSSIER = path.join(os.tmpdir(), 'ensam-certs-test') + '/';
if (!fs.existsSync(DOSSIER + 'cle.pem')) {
  fs.mkdirSync(DOSSIER, { recursive: true });
  const o = (...a) => execFileSync('openssl', a, { cwd: DOSSIER, stdio: 'ignore' });
  fs.writeFileSync(DOSSIER + 'ext.cnf', 'subjectAltName=DNS:smtp.gmail.com,DNS:localhost,IP:127.0.0.1\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n');
  o('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca-cle.pem', '-out', 'ca.pem', '-days', '3650', '-subj', '/CN=CA de test');
  o('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'cle-tmp.pem', '-out', 'leaf.csr', '-subj', '/CN=smtp.gmail.com');
  o('x509', '-req', '-in', 'leaf.csr', '-CA', 'ca.pem', '-CAkey', 'ca-cle.pem', '-CAcreateserial', '-out', 'cert.pem', '-days', '3650', '-extfile', 'ext.cnf');
  fs.renameSync(DOSSIER + 'cle-tmp.pem', DOSSIER + 'cle.pem');
}
export const CERT = fs.readFileSync(DOSSIER + 'cert.pem', 'utf8');
export const CA = fs.readFileSync(DOSSIER + 'ca.pem', 'utf8');
const CLE = fs.readFileSync(DOSSIER + 'cle.pem', 'utf8');

export class FauxGmail {
  constructor({ user = 'reseau.test@gmail.com', mdp = 'abcdefghijklmnop' } = {}) {
    Object.assign(this, {
      user, mdp, messages: [], rejets: new Set(), limite: Infinity, couperApres: Infinity, delai: 0,
      ouvertes: 0, maxOuvertes: 0, connexions: 0, auths: 0, quits: 0, sockets: new Set(), commandes: [],
    });
  }
  demarrer() {
    this.serveur = tlsNode.createServer({ key: CLE, cert: CERT }, s => this.session(s));
    return new Promise(r => this.serveur.listen(0, '127.0.0.1', () => { this.port = this.serveur.address().port; r(this); }));
  }
  arreter() {
    for (const s of this.sockets) s.destroy();
    return new Promise(r => this.serveur.close(() => r()));
  }
  session(s) {
    const id = ++this.connexions;
    this.sockets.add(s);
    this.ouvertes++; this.maxOuvertes = Math.max(this.maxOuvertes, this.ouvertes);
    s.on('close', () => { this.ouvertes--; this.sockets.delete(s); });
    s.on('error', () => {});
    let tampon = '', data = null, auth = false, de = null, a = [], parConn = 0;
    const dire = t => { if (!s.destroyed) s.write(t + '\r\n'); };
    dire('220 smtp.gmail.com ESMTP faux');
    s.on('data', async morceau => {
      tampon += morceau.toString('utf8');
      for (;;) {
        if (data !== null) {
          const i = tampon.indexOf('\r\n.\r\n');
          if (i < 0) return;
          const brut = tampon.slice(0, i + 2);
          tampon = tampon.slice(i + 5);
          data = null;
          if (this.delai) await new Promise(r => setTimeout(r, this.delai));
          this.messages.push({ conn: id, de, a, brut: brut.replace(/^\.\./gm, '.') });
          parConn++;
          dire('250 2.0.0 OK faux');
          if (parConn >= this.couperApres) { s.destroy(); return; }
          continue;
        }
        const i = tampon.indexOf('\r\n');
        if (i < 0) return;
        const ligne = tampon.slice(0, i);
        tampon = tampon.slice(i + 2);
        this.commandes.push(ligne.startsWith('AUTH') ? 'AUTH' : ligne);
        const v = ligne.toUpperCase();
        if (v.startsWith('EHLO')) { dire('250-smtp.gmail.com à votre service'); dire('250-SIZE 35882577'); dire('250-AUTH LOGIN PLAIN XOAUTH2'); dire('250 SMTPUTF8'); }
        else if (v.startsWith('AUTH PLAIN ')) {
          this.auths++;
          const [, u, p] = Buffer.from(ligne.slice(11), 'base64').toString('utf8').split('\0');
          if (u === this.user && p === this.mdp) { auth = true; dire('235 2.7.0 Accepted'); }
          else dire('535-5.7.8 Username and Password not accepted.\r\n535 5.7.8 https://support.google.com/mail/?p=BadCredentials');
        }
        else if (v.startsWith('MAIL FROM:')) {
          if (!auth) dire('530 5.7.0 Authentication Required');
          else if ((this.acceptes || 0) >= this.limite) dire('550 5.4.5 Daily user sending limit exceeded.');
          else { this.acceptes = (this.acceptes || 0) + 1; de = ligne.slice(10).replace(/[<>]/g, ''); a = []; dire('250 2.1.0 OK'); }
        }
        else if (v.startsWith('RCPT TO:')) {
          const x = ligne.slice(8).replace(/[<>]/g, '');
          if (!de) dire('503 5.5.1 MAIL first');
          else if (this.rejets.has(x)) dire('550-5.1.1 The email account that you tried to reach does not exist.\r\n550 5.1.1 faux');
          else { a.push(x); dire('250 2.1.5 OK'); }
        }
        else if (v === 'DATA') { if (!a.length) dire('503 5.5.1 RCPT first'); else { data = ''; dire('354 Go ahead'); } }
        else if (v === 'RSET') { de = null; a = []; dire('250 2.1.5 Flushed'); }
        else if (v === 'QUIT') { this.quits++; dire('221 2.0.0 closing connection'); s.end(); return; }
        else dire('502 5.5.1 Unrecognized command.');
      }
    });
  }
}

export function adapter(socket) {
  const file = [];
  let fini = false, reveil = null;
  const reveiller = () => { const r = reveil; reveil = null; r?.(); };
  socket.on('data', d => { file.push(d); reveiller(); });
  socket.on('close', () => { fini = true; reveiller(); });
  socket.on('error', () => { fini = true; reveiller(); });
  return {
    async read(p) {
      while (!file.length && !fini) await new Promise(r => { reveil = r; });
      if (!file.length) return null;
      const d = file[0];
      const n = Math.min(p.length, d.length);
      p.set(d.subarray(0, n));
      if (n < d.length) file[0] = d.subarray(n); else file.shift();
      return n;
    },
    write(p) {
      if (fini || socket.destroyed) return Promise.reject(new Error('Broken pipe'));
      return new Promise((r, x) => socket.write(Buffer.from(p), e => (e ? x(e) : r(p.length))));
    },
    close() { socket.destroy(); },
  };
}

// Remplace tls.connecter du module : vérifie l'hôte et le port demandés, puis se branche au faux serveur
export function brancher(N, faux, vus = []) {
  N.tls.connecter = (hote, port) => {
    vus.push(`${hote}:${port}`);
    return new Promise((r, x) => {
      const s = tlsNode.connect({ host: '127.0.0.1', port: faux.port, ca: CA, servername: 'smtp.gmail.com' }, () => r(adapter(s)));
      s.once('error', x);
    });
  };
  return vus;
}

// Lecture d'un message MIME produit par messageMime
export function decoderMot(v) {
  return v.replace(/\r\n /g, '').replace(/=\?UTF-8\?B\?([^?]*)\?=/g, (_, b) => Buffer.from(b, 'base64').toString('utf8'));
}
export function lireMime(brut) {
  const [tete, ...reste] = brut.split('\r\n\r\n');
  const entetes = {};
  for (const l of tete.replace(/\r\n /g, '\u0000').split('\r\n')) {
    const i = l.indexOf(':');
    entetes[l.slice(0, i).toLowerCase()] = l.slice(i + 1).trim().replace(/\u0000/g, '\r\n ');
  }
  const corps = reste.join('\r\n\r\n');
  const f = /boundary="([^"]+)"/.exec(entetes['content-type'])[1];
  const parties = corps.split(`--${f}`).slice(1, -1).map(p => {
    const [t, ...c] = p.replace(/^\r\n/, '').split('\r\n\r\n');
    return { type: /Content-Type: ([^;]+)/.exec(t)[1], texte: Buffer.from(c.join('').replace(/\s+/g, ''), 'base64').toString('utf8') };
  });
  return { entetes, parties, fin: corps.trimEnd().endsWith(`--${f}--`) };
}
