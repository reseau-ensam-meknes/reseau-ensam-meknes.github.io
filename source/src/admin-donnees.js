// Console d'administration : les tables que l'administration seule lit (écoles, suivi des écoles et des partenaires).
// Elles ne sont pas chargées pour tout le monde au démarrage : la page qui en a besoin les lit ici, en direct ou dans la démo.
// En ligne, une table que la base n'a pas encore (mise à jour pas encore passée) donne une liste vide et absente = true.
import { useState, useEffect } from './vendor/preact-htm.js';
// L'école d'une ligne (ENSAM Meknès par défaut, comme dans la base) : définie une seule fois, dans logic.js
import { ECOLE_DEFAUT, ecoleDe } from './logic.js';
export { ECOLE_DEFAUT, ecoleDe };

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36));
const absente = e => /does not exist|relation .* does not exist|schema cache|PGRST20[05]|42P01/i.test(`${e?.code || ''} ${e?.message || ''}`);

// cle : la colonne qui identifie une ligne (« id », ou « slug » pour les écoles) ; ordre : la colonne de tri, la plus récente d'abord
export function useTableAdmin(ctx, table, { cle = 'id', ordre = 'created_at', croissant = false } = {}) {
  const { store, data } = ctx;
  const demo = store.mode !== 'live';
  const [etat, setEtat] = useState({ lignes: [], pret: demo, absente: false });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (demo) return;
    let on = true;
    Promise.resolve(store.sb?.from(table).select('*').order(ordre, { ascending: croissant }).limit(2000)).then(r => {
      if (!on) return;
      if (r?.error) setEtat({ lignes: [], pret: true, absente: absente(r.error), erreur: absente(r.error) ? null : r.error.message });
      else setEtat({ lignes: r?.data || [], pret: true, absente: false });
    }, e => on && setEtat({ lignes: [], pret: true, absente: absente(e), erreur: absente(e) ? null : String(e?.message || e) }));
    return () => { on = false; };
  }, [table, version, demo]);
  const trier = l => [...l].sort((a, b) => (croissant ? 1 : -1) * String(a[ordre] ?? '').localeCompare(String(b[ordre] ?? '')));
  const lignes = demo ? trier(data[table] || []) : etat.lignes;
  const majDemo = f => { store.data[table] = f(store.data[table] || []); store.persist?.(); store.emit?.(); };
  const majLive = f => setEtat(x => ({ ...x, lignes: f(x.lignes) }));
  return {
    lignes, pret: demo || etat.pret, absente: !demo && etat.absente, erreur: !demo ? etat.erreur : null,
    recharger: () => setVersion(v => v + 1),
    async inserer(row) {
      if (demo) { const r = { ...(cle === 'id' ? { id: uuid() } : {}), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: store.me?.id || null, ...row }; majDemo(l => [r, ...l]); return r; }
      const { data: r, error } = await store.sb.from(table).insert(row).select().single();
      if (error) throw new Error(error.message);
      majLive(l => [r, ...l.filter(x => x[cle] !== r[cle])]); return r;
    },
    async modifier(id, patch) {
      if (demo) { let r = null; majDemo(l => l.map(x => (x[cle] === id ? (r = { ...x, ...patch, updated_at: new Date().toISOString() }) : x))); return r; }
      const { data: r, error } = await store.sb.from(table).update(patch).eq(cle, id).select().single();
      if (error) throw new Error(error.code === 'PGRST116' ? 'Cette ligne n’existe plus. Recharge la page.' : error.message);
      majLive(l => l.map(x => (x[cle] === id ? r : x))); return r;
    },
    async supprimer(id) {
      if (demo) { majDemo(l => l.filter(x => x[cle] !== id)); return; }
      const { error } = await store.sb.from(table).delete().eq(cle, id);
      if (error) throw new Error(error.message);
      majLive(l => l.filter(x => x[cle] !== id));
    },
  };
}

// Les écoles (table du lot « Écoles », public.ecoles : slug, nom, ouverte) ; l'ENSAM Meknès est toujours là, ouverte,
// même tant que la base n'a pas encore la table
export function useEcoles(ctx) {
  const t = useTableAdmin(ctx, 'ecoles', { cle: 'slug', ordre: 'created_at', croissant: true });
  const ecoles = t.lignes.some(e => e.slug === ECOLE_DEFAUT) ? t.lignes : [{ slug: ECOLE_DEFAUT, nom: 'ENSAM Meknès', ouverte: true, created_at: '2026-10-21T00:00:00Z' }, ...t.lignes];
  return { ...t, ecoles };
}

// Les lignes d'une table qui sont de cette école (null : toutes les écoles)
export const deLEcole = (lignes, slug) => (!slug ? lignes : (lignes || []).filter(r => ecoleDe(r) === slug));
