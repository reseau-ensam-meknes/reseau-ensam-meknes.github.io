// Notifications pour tout : textes FR et AR, lien vers le bon écran et regroupement sur le téléphone (tag)
// des nouveaux types (demande ouverte à tous, nouveau membre de la promo, commentaire sous une offre, annonce,
// mentorat ouvert à tous) ; une notification par message avec le nombre de non lus ; offre à faire suivre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE, SITE, uid } from './banc.mjs';

const N = await import(MODULE);
const logic = await import('../../src/logic.js');
const DEM = uid(8101), OFFRE = uid(8102), DE = uid(8103);
const t = (k, d, l = 'fr') => N.texteNotif(k, d, l, SITE);

const NOUVEAUX = {
  demande_large: [{ nom: 'Hiba', titre: 'PFE supply chain', type: 'pfe', demande: DEM }, `aider/${DEM}`, `demande_large-${DEM}`],
  promo_nouveau: [{ nom: 'Chaimae', n: 1, promo: 2028 }, 'reseau/annuaire', 'promo_nouveau'],
  offre_commentaire: [{ nom: 'Salma Bennani', titre: 'Stage qualité', texte: 'Le stage est-il rémunéré ?', offre: OFFRE, pour: 'auteur' }, `offre/${OFFRE}`, `offre_commentaire-${OFFRE}`],
  annonce: [{ texte: 'Forum entreprises jeudi à 10 h, amphi A' }, 'accueil', 'annonce'],
  mentorat_ouvert: [{ nom: 'Hiba Alaoui', sujet: 'Préparer un entretien' }, 'mentorat', 'mentorat_ouvert'],
};

test('nouveaux types : un texte en français et en arabe, le bon écran, un tag qui regroupe ; chacun a sa catégorie', () => {
  for (const [kind, [data, route, tag]] of Object.entries(NOUVEAUX)) {
    assert.ok(Object.prototype.hasOwnProperty.call(logic.PUSH_KINDS, kind), `${kind} sans catégorie`);
    for (const langue of ['fr', 'ar']) {
      const n = t(kind, data, langue);
      assert.ok(n, `${kind} ${langue}`);
      assert.equal(n.url, SITE + '#' + route, `${kind} ${langue}`);
      assert.equal(n.tag, tag, kind);
      assert.ok(n.title.length > 3 && n.body.length > 3, kind);
      assert.doesNotMatch(n.title + n.body, /undefined|null|NaN|\$\{/, kind);
      if (langue === 'ar') assert.match(n.title + n.body, /[؀-ۿ]/, kind + ' en arabe');
    }
  }
  assert.equal(logic.pushCategorie('demande_large'), 'demandes');
  assert.equal(logic.pushCategorie('mentorat_ouvert'), 'mentorat');
  for (const k of ['promo_nouveau', 'offre_commentaire', 'annonce']) assert.equal(logic.pushCategorie(k), 'reseau');
});

test('textes exacts : demande ouverte à tous, promo, commentaires, annonce, mentorat ouvert', () => {
  const d = NOUVEAUX.demande_large[0];
  assert.deepEqual([t('demande_large', d).title, t('demande_large', d).body], ['Une demande ouverte à tous les lauréats', 'Hiba · PFE : PFE supply chain']);
  assert.equal(t('demande_large', d, 'ar').title, 'طلب مفتوح لكل الخريجين');
  // Promo : une arrivée, puis plusieurs depuis la précédente notification
  assert.deepEqual([t('promo_nouveau', { nom: 'Chaimae', n: 1, promo: 2028 }).title, t('promo_nouveau', { nom: 'Chaimae', n: 1, promo: 2028 }).body],
    ['Chaimae a rejoint ta promo', 'Promo 2028 : retrouve tes camarades dans l’annuaire.']);
  assert.equal(t('promo_nouveau', { nom: 'Elias', n: 2 }).title, 'Elias et 1 autre ont rejoint ta promo');
  assert.equal(t('promo_nouveau', { nom: 'Elias', n: 4 }).title, 'Elias et 3 autres ont rejoint ta promo');
  assert.equal(t('promo_nouveau', { nom: 'Elias', n: 4 }).body, 'Retrouve tes camarades dans l’annuaire.');
  assert.equal(t('promo_nouveau', { nom: 'Elias', n: 4, promo: 2028 }, 'ar').title, 'أعضاء جدد في دفعتك: 4');
  assert.match(t('promo_nouveau', { nom: 'Elias', n: 4, promo: 2028 }, 'ar').body, /Elias/);
  // Commentaire sur mon offre ; réponse de l'auteur sous une offre où j'ai écrit
  const c = NOUVEAUX.offre_commentaire[0];
  assert.deepEqual([t('offre_commentaire', c).title, t('offre_commentaire', c).body],
    ['Nouveau commentaire sur ton offre', 'Salma Bennani sur « Stage qualité » : Le stage est-il rémunéré ?']);
  const r = { ...c, nom: 'Youssef Amrani', texte: 'Oui, 3000 DH par mois.', pour: 'fil' };
  assert.deepEqual([t('offre_commentaire', r).title, t('offre_commentaire', r).body], ['Réponse sous une offre', 'Youssef Amrani a répondu sous « Stage qualité » : Oui, 3000 DH par mois.']);
  assert.equal(t('offre_commentaire', r, 'ar').title, 'رد تحت عرض');
  assert.equal(t('offre_commentaire', c, 'ar').title, 'تعليق جديد على عرضك');
  assert.deepEqual([t('annonce', NOUVEAUX.annonce[0]).title, t('annonce', NOUVEAUX.annonce[0]).body], ['Annonce du Réseau ENSAM', 'Forum entreprises jeudi à 10 h, amphi A']);
  assert.equal(t('annonce', {}), null, 'une annonce sans texte ne part pas');
  assert.deepEqual([t('mentorat_ouvert', NOUVEAUX.mentorat_ouvert[0]).title, t('mentorat_ouvert', NOUVEAUX.mentorat_ouvert[0]).body],
    ['Une demande de mentorat ouverte à tous', 'Hiba Alaoui propose ses horaires : Préparer un entretien']);
});

test('message : une par message, même tag pour la conversation ; plusieurs non lus : leur nombre, puis le dernier', () => {
  const un = t('message', { nom: 'Salma Bennani', de: DE, type: 'texte', texte: 'Bonjour', n: 1 });
  const trois = t('message', { nom: 'Salma Bennani', de: DE, type: 'texte', texte: 'Tu as vu mon CV ?', n: 3 });
  assert.equal(un.tag, `message-${DE}`);
  assert.equal(trois.tag, un.tag, 'le téléphone remplace la précédente au lieu d’empiler');
  assert.equal(trois.url, `${SITE}#messages/${DE}`);
  assert.equal(un.body, 'Bonjour');
  assert.equal(trois.body, '3 nouveaux messages · Tu as vu mon CV ?');
  assert.equal(t('message', { nom: 'Salma', de: DE, type: 'vocal', duree: 42, n: 2 }).body, '2 nouveaux messages · 🎤 Message vocal (0:42)');
  const ar = t('message', { nom: 'Salma Bennani', de: DE, type: 'texte', texte: 'Tu as vu mon CV ?', n: 3 }, 'ar');
  assert.match(ar.body, /^رسائل جديدة: 3 · /);
  assert.equal(ar.tag, un.tag);
  assert.equal(t('message', { nom: 'Salma', de: DE, type: 'texte', texte: 'x' }).body, 'x', 'sans compte (ancienne file) : le message seul');
  // Moins de 20 s après la précédente : l'aperçu change sans sonner ; calme seulement pour un message
  assert.equal(un.calme, undefined);
  assert.equal(t('message', { nom: 'Salma', de: DE, type: 'texte', texte: 'x', n: 2, calme: true }).calme, true);
  assert.equal(t('message', { nom: 'Salma', de: DE, type: 'texte', texte: 'x', calme: 'oui' }).calme, undefined);
  // Un autre expéditeur : une autre notification
  assert.notEqual(t('message', { nom: 'Youssef', de: uid(8104), type: 'texte', texte: 'x' }).tag, un.tag);
});

test('nouvelle offre : pour lui, ou « dans ta filière » pour un lauréat qu’elle ne vise pas ; une notification par offre', () => {
  const o = { titre: 'PFE Lean', entreprise: 'Renault', offre: OFFRE, origine: 'portee' };
  assert.equal(t('offre_alerte', o).title, 'Nouvelle offre pour toi');
  const rel = t('offre_alerte', { ...o, pour: 'relayer' });
  assert.equal(rel.title, 'Nouvelle offre dans ta filière');
  assert.equal(rel.body, 'PFE Lean · Renault · portée par un lauréat, qui encadre');
  assert.equal(rel.url, `${SITE}#offre/${OFFRE}`);
  assert.equal(rel.tag, `offre-${OFFRE}`);
  assert.equal(t('offre_alerte', { ...o, origine: 'partagee', pour: 'relayer' }).title, 'Offre partagée dans ta filière');
  assert.equal(t('offre_alerte', { ...o, pour: 'relayer' }, 'ar').title, 'عرض جديد في شعبتك');
  assert.equal(t('offre_alerte', { ...o, pour: 'autre-chose' }).title, 'Nouvelle offre pour toi', 'une valeur inconnue ne change rien');
});
