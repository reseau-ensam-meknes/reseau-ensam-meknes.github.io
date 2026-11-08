// Le message WhatsApp d'une offre (#od-partage, et « Partager sur WhatsApp » juste après la publication) et d'une question
// (#q-partage) : le lien l'ouvre dans son école (celle de l'offre ou de la question, sinon celle du membre : &ecole=, après
// ?lang=ar), le texte la nomme (nomsAPartager : une école pas encore ouverte n'est jamais nommée, « ENSAM », sans ville).
// L'ENSAM Meknès : les messages d'avant, à l'octet, en français et en arabe.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Le navigateur, juste ce qu'il faut pour charger ces modules (sans démarrer la page)
const stockage = new Map();
globalThis.window = globalThis;
globalThis.ENSAM_ENTREE = true;
globalThis.document = { documentElement: {}, addEventListener() {}, querySelector: () => null, head: { appendChild() {} }, createElement: () => ({ dataset: {}, style: {} }) };
globalThis.addEventListener = () => {};
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.localStorage = { getItem: k => (stockage.has(k) ? stockage.get(k) : null), setItem: (k, v) => stockage.set(k, String(v)), removeItem: k => stockage.delete(k) };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.location = { href: 'https://r.io/#offres', origin: 'https://r.io', pathname: '/', search: '', hash: '#offres' };

const { texteOffre } = await import('../../src/offers.js');
const { texteQuestion } = await import('../../src/community.js');
const { lienDirect } = await import('../../src/ui.js');
const I = await import('../../src/i18n.js');

const CASA = { slug: 'ensam-casa', nom: 'ENSAM Casablanca', nom_court: 'ENSAM', ville: 'Casablanca', nom_ar: 'ENSAM الدار البيضاء', ouverte: true };
const FERMEE = { ...CASA, ouverte: false };
const OFFRE = { id: 'o1', type: 'emploi', titre: 'Ingénieur méthodes', entreprise: 'Renault', status: 'ouverte' };
const QUESTION = { id: 'q1', titre: 'Comment préparer un entretien chez OCP ?' };
const MEKNES = { id: 'm', role: 'laureat' }, DE_CASA = { id: 'c', role: 'laureat', ecole: 'ensam-casa' }, ADMIN = { id: 'a', role: 'admin' };
// Les deux langues de l'interface ; le français remis après
async function enLangue(l, f) { await I.setLang(l, { attendre: false, garder: false }); try { return f(); } finally { await I.setLang('fr', { garder: false }); } }
// Les deux messages (offre, question) en français puis en arabe, l'un après l'autre
async function textes(ctx, o = OFFRE, q = QUESTION) { const r = []; for (const l of ['fr', 'ar']) r.push(await enLangue(l, () => [texteOffre(o, ctx), texteQuestion(q, ctx)])); return r; }

test('ENSAM Meknès (un membre, l’administration du réseau ; l’offre ou la question avec ou sans école) : les messages d’avant, à l’octet', async () => {
  const AVANT = {
    fr: ['Emploi : Ingénieur méthodes · Renault\nOffre partagée sur le Réseau ENSAM Meknès. Ouvre-la ici : https://r.io/#offre/o1',
      'Question sur le Réseau ENSAM Meknès : « Comment préparer un entretien chez OCP ? »\nTu peux y répondre ici : https://r.io/#reseau/entraide/q1'],
    ar: ['وظيفة: Ingénieur méthodes · Renault\nعرض منشور على شبكة ENSAM مكناس. افتحه هنا: https://r.io/?lang=ar#offre/o1',
      'سؤال على شبكة ENSAM مكناس: « Comment préparer un entretien chez OCP ? »\nيمكنك الجواب هنا: https://r.io/?lang=ar#reseau/entraide/q1'],
  };
  for (const me of [MEKNES, ADMIN, { ...MEKNES, ecole: 'ensam-meknes' }]) {
    for (const [o, q] of [[OFFRE, QUESTION], [{ ...OFFRE, ecole: 'ensam-meknes' }, { ...QUESTION, ecole: 'ensam-meknes' }]]) {
      for (const ctx of [{ data: { ecoles: [CASA] }, me }, { data: { ecoles: [] }, me }, { store: { data: { ecoles: [CASA] } }, me }]) {
        const [fr, ar] = await textes(ctx, o, q);
        assert.deepEqual({ fr, ar }, AVANT, JSON.stringify([me, o.ecole]));
      }
    }
  }
  // Le lien seul, comme avant (sans école, ou l'ENSAM Meknès)
  assert.equal(lienDirect('offre/o1'), 'https://r.io/#offre/o1');
  assert.equal(lienDirect('offre/o1', 'ensam-meknes'), 'https://r.io/#offre/o1');
  assert.equal(await enLangue('ar', () => lienDirect('reseau/entraide/q1', 'ensam-meknes')), 'https://r.io/?lang=ar#reseau/entraide/q1');
});

test('une autre école : le lien la dit (&ecole=, après ?lang=ar), le texte la nomme ; pas encore ouverte, « ENSAM » sans ville ; l’école de l’offre ou de la question d’abord, sinon celle du membre', async () => {
  const CASA_FR = ['Emploi : Ingénieur méthodes · Renault\nOffre partagée sur le Réseau ENSAM Casablanca. Ouvre-la ici : https://r.io/?ecole=ensam-casa#offre/o1',
    'Question sur le Réseau ENSAM Casablanca : « Comment préparer un entretien chez OCP ? »\nTu peux y répondre ici : https://r.io/?ecole=ensam-casa#reseau/entraide/q1'];
  const CASA_AR = ['وظيفة: Ingénieur méthodes · Renault\nعرض منشور على شبكة ENSAM الدار البيضاء. افتحه هنا: https://r.io/?lang=ar&ecole=ensam-casa#offre/o1',
    'سؤال على شبكة ENSAM الدار البيضاء: « Comment préparer un entretien chez OCP ? »\nيمكنك الجواب هنا: https://r.io/?lang=ar&ecole=ensam-casa#reseau/entraide/q1'];
  const DE_CASA_O = { ...OFFRE, ecole: 'ensam-casa' }, DE_CASA_Q = { ...QUESTION, ecole: 'ensam-casa' };
  // Un membre de l'ENSAM Casablanca (ouverte) ; l'administration du réseau sous l'offre de l'ENSAM Casablanca ; l'offre
  // d'avant, sans école, partagée par un membre de l'ENSAM Casablanca (la sienne) ; après la publication (store.data)
  for (const [ctx, o, q] of [[{ data: { ecoles: [CASA] }, me: DE_CASA }, DE_CASA_O, DE_CASA_Q], [{ data: { ecoles: [CASA] }, me: ADMIN }, DE_CASA_O, DE_CASA_Q],
    [{ data: { ecoles: [CASA] }, me: DE_CASA }, OFFRE, QUESTION], [{ store: { data: { ecoles: [CASA] } }, me: DE_CASA }, DE_CASA_O, DE_CASA_Q]]) {
    const [fr, ar] = await textes(ctx, o, q);
    assert.deepEqual({ fr, ar }, { fr: CASA_FR, ar: CASA_AR }, JSON.stringify([ctx.me, o.ecole]));
  }
  // Pas encore ouverte (ou sa ligne pas là) : « ENSAM », sans ville, ni en français ni en arabe ; le lien dit quand même son école
  for (const ecoles of [[FERMEE], []]) {
    const [fr, ar] = await textes({ data: { ecoles }, me: DE_CASA }, DE_CASA_O, DE_CASA_Q);
    assert.deepEqual(fr, ['Emploi : Ingénieur méthodes · Renault\nOffre partagée sur le Réseau ENSAM. Ouvre-la ici : https://r.io/?ecole=ensam-casa#offre/o1',
      'Question sur le Réseau ENSAM : « Comment préparer un entretien chez OCP ? »\nTu peux y répondre ici : https://r.io/?ecole=ensam-casa#reseau/entraide/q1']);
    assert.deepEqual(ar, ['وظيفة: Ingénieur méthodes · Renault\nعرض منشور على شبكة ENSAM. افتحه هنا: https://r.io/?lang=ar&ecole=ensam-casa#offre/o1',
      'سؤال على شبكة ENSAM: « Comment préparer un entretien chez OCP ? »\nيمكنك الجواب هنا: https://r.io/?lang=ar&ecole=ensam-casa#reseau/entraide/q1']);
    for (const x of [...fr, ...ar]) assert.doesNotMatch(x, /Casablanca|البيضاء|Meknès|مكناس/, x);
  }
  // Une école de la base, mal formée : rien dans le lien (jamais une adresse cassée), et jamais l'ENSAM Meknès nommée
  const [fr] = await textes({ data: { ecoles: [] }, me: MEKNES }, { ...OFFRE, ecole: 'X Y' }, { ...QUESTION, ecole: 'X Y' });
  assert.equal(fr[0], 'Emploi : Ingénieur méthodes · Renault\nOffre partagée sur le Réseau ENSAM. Ouvre-la ici : https://r.io/#offre/o1');
});
