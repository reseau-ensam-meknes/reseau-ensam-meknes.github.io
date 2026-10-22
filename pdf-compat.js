// pdf.js 6 se sert de fonctions JavaScript toutes récentes (2025-2026) : on les ajoute aux navigateurs
// qui ne les ont pas encore (téléphones pas à jour, Safari). Chargé avant pdf.js, dans la page et dans son worker.
const def = (o, k, f) => { if (o && !(k in o)) Object.defineProperty(o, k, { value: f, writable: true, configurable: true }); };
for (const C of [Map, WeakMap]) {
  def(C.prototype, 'getOrInsert', function (k, v) { if (!this.has(k)) this.set(k, v); return this.get(k); });
  def(C.prototype, 'getOrInsertComputed', function (k, f) { if (!this.has(k)) this.set(k, f(k)); return this.get(k); });
}
def(Promise, 'try', function (f, ...a) { return new Promise(ok => ok(f(...a))); });
def(Math, 'sumPrecise', function (liste) { let s = 0; for (const x of liste) s += x; return s; });
def(Uint8Array, 'fromBase64', function (t) { return Uint8Array.from(atob(String(t).replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); });
def(Uint8Array.prototype, 'toHex', function () { return Array.from(this, x => x.toString(16).padStart(2, '0')).join(''); });
