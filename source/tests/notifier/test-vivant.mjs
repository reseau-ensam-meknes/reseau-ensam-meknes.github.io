// Réseau vivant : la notification d'une réaction (offre ou demande, une par élément sur le téléphone)
// et celle d'une réponse sous sa demande, en français et en arabe, avec le lien qui ouvre l'élément
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE, SITE } from './banc.mjs';

const N = await import(MODULE);
const O = '11111111-2222-4333-8444-555555555555', D = '66666666-7777-4888-8999-aaaaaaaaaaaa';
const FSI = '⁨', PDI = '⁩';

test('réaction sur mon offre : texte, compte, lien vers l’offre, une seule par offre sur le téléphone', () => {
  const un = N.texteNotif('reaction', { nom: 'Salma Bennani', emoji: '👏', n: 1, titre: 'PFE lean à Tanger', offre: O }, 'fr', SITE);
  assert.deepEqual([un.title, un.body], ['Ton offre fait réagir', 'Salma Bennani a réagi 👏 : PFE lean à Tanger']);
  assert.equal(un.url, `${SITE}#offre/${O}`);
  assert.equal(un.tag, `reaction-${O}`);
  const trois = N.texteNotif('reaction', { nom: 'Karim Tazi', emoji: '👍', n: 3, titre: 'PFE lean à Tanger', offre: O }, 'fr', SITE);
  assert.equal(trois.body, '3 réactions, la dernière de Karim Tazi : PFE lean à Tanger');
  assert.equal(trois.tag, un.tag, 'la nouvelle remplace l’ancienne');
  // Un émoji inconnu n'est pas recopié
  assert.equal(N.texteNotif('reaction', { nom: 'X', emoji: '<b>', n: 1, titre: 'T', offre: O }, 'fr', SITE).body, 'X a réagi : T');
});

test('réaction sur ma demande : ouvre sa carte ; en arabe, nom et titre isolés', () => {
  const fr = N.texteNotif('reaction', { nom: 'Youssef Amrani', emoji: '💪', n: 1, titre: 'PFE en supply chain', demande: D }, 'fr', SITE);
  assert.equal(fr.title, 'Ta demande fait réagir');
  assert.equal(fr.url, `${SITE}#offres/demandes/${D}`);
  assert.equal(fr.tag, `reaction-${D}`);
  const ar = N.texteNotif('reaction', { nom: 'Youssef Amrani', emoji: '💪', n: 4, titre: 'PFE en supply chain', demande: D }, 'ar', SITE);
  assert.equal(ar.title, 'تفاعل مع طلبك');
  assert.equal(ar.body, `عدد التفاعلات: 4، آخرها من ${FSI}Youssef Amrani${PDI}: ${FSI}PFE en supply chain${PDI}`);
  assert.equal(N.texteNotif('reaction', { nom: 'Y', n: 1, titre: 'T', offre: O }, 'ar', SITE).title, 'تفاعل مع عرضك');
  // Sans élément valable : la liste des offres
  assert.equal(N.texteNotif('reaction', { nom: 'Y', n: 1, titre: 'T', offre: 'x' }, 'fr', SITE).url, `${SITE}#offres`);
});

test('réponse sous ma demande : qui, sur quoi, le début de la réponse ; elle ouvre la carte de la demande', () => {
  const fr = N.texteNotif('demande_reponse', { nom: 'Youssef Amrani', titre: 'PFE en supply chain', texte: 'Regarde du côté de Tanger Med.', demande: D }, 'fr', SITE);
  assert.deepEqual([fr.title, fr.body], ['Une réponse à ta demande', 'Youssef Amrani sur « PFE en supply chain » : Regarde du côté de Tanger Med.']);
  assert.equal(fr.url, `${SITE}#offres/demandes/${D}`);
  assert.equal(fr.tag, `demande_reponse-${D}`);
  const ar = N.texteNotif('demande_reponse', { nom: 'Youssef', titre: 'PFE', texte: 'Bonne idée', demande: D }, 'ar', SITE);
  assert.equal(ar.title, 'رد على طلبك');
  assert.match(ar.body, /^رد من /);
  for (const n of [fr, ar]) assert.doesNotMatch(n.title + n.body, /undefined|null|NaN|\$\{/);
});
