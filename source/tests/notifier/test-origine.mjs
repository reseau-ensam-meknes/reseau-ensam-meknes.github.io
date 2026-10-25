// Alertes d'offres : le texte dit d'où vient l'offre. Portée par un lauréat (il encadre), ou partagée (vue ailleurs) ;
// rien de plus pour une offre classique. En français et en arabe, sur le téléphone et par email.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE, SITE, uid } from './banc.mjs';

const N = await import(MODULE);
const OFFRE = uid(5101);
const t = (d, l = 'fr') => N.texteNotif('offre_alerte', { titre: 'PFE lean', entreprise: 'OCP', offre: OFFRE, ...d }, l, SITE);

test('notification : une offre classique ne change pas', () => {
  assert.deepEqual(t({}), { title: 'Nouvelle offre pour toi', body: 'PFE lean · OCP', url: `${SITE}#offre/${OFFRE}`, tag: `offre-${OFFRE}` });
  assert.equal(t({ origine: 'autre chose' }).body, 'PFE lean · OCP', 'une origine inconnue n’affirme rien');
});

test('notification : portée par un lauréat, ou partagée, en français et en arabe', () => {
  const p = t({ origine: 'portee' });
  assert.equal(p.title, 'Nouvelle offre pour toi');
  assert.equal(p.body, 'PFE lean · OCP · portée par un lauréat, qui encadre');
  assert.equal(p.url, `${SITE}#offre/${OFFRE}`);
  const s = t({ origine: 'partagee' });
  assert.equal(s.title, 'Offre partagée pour toi');
  assert.equal(s.body, 'PFE lean · OCP · vue ailleurs, partagée par un membre du réseau');
  assert.equal(s.url, `${SITE}#offre/${OFFRE}`, 'le lien ouvre la fiche de l’offre');
  const pa = t({ origine: 'portee' }, 'ar'), sa = t({ origine: 'partagee' }, 'ar');
  assert.equal(pa.title, 'عرض جديد لك');
  assert.match(pa.body, /يقدّمه خريج مع التأطير$/);
  assert.equal(sa.title, 'عرض تمت مشاركته معك');
  assert.match(sa.body, /منشور في موقع آخر، شاركه عضو في الشبكة$/);
  for (const n of [p, s, pa, sa]) assert.ok(n.body.length <= 180 && !/undefined|null/.test(n.body));
});

test('email d’alerte : chaque ligne dit l’origine ; un partage ne fait pas dire « un lauréat a publié »', () => {
  const porte = { id: 'o1', titre: 'PFE lean', entreprise: 'OCP', type: 'pfe', origine: 'portee' };
  const partage = { id: 'o2', titre: 'Stage qualité', entreprise: 'Renault', type: 'stage', origine: 'partagee' };
  const classique = { id: 'o3', titre: 'Stage méthodes', entreprise: 'Safran', type: 'stage' };
  const seul = N.rendreAlerte([porte], 'fr', SITE, 'jeton');
  assert.match(seul.texte, /Un lauréat de l’école vient de publier une offre/);
  assert.match(seul.texte, /PFE lean · OCP · PFE · Portée par un lauréat, qui encadre/);
  const p = N.rendreAlerte([partage], 'fr', SITE, 'jeton');
  assert.match(p.texte, /Un membre du réseau vient de partager une offre pour ta filière et ton année/);
  assert.doesNotMatch(p.texte, /Un lauréat de l’école vient de publier/);
  assert.match(p.texte, /Stage qualité · Renault · Stage · Offre partagée, vue ailleurs/);
  assert.match(p.html, /Offre partagée, vue ailleurs/);
  const tous = N.rendreAlerte([porte, partage, classique], 'fr', SITE, 'jeton');
  assert.match(tous.texte, /publiées ou partagées par des membres du réseau/);
  assert.match(tous.texte, /Stage méthodes · Safran · Stage\n/, 'une offre classique : rien de plus');
  const ar = N.rendreAlerte([porte, partage], 'ar', SITE, 'jeton');
  assert.match(ar.texte, /نشرها أو شاركها أعضاء الشبكة/);
  assert.match(ar.texte, /يقدّمه خريج مع التأطير/);
  assert.match(ar.texte, /عرض تمت مشاركته، منشور في موقع آخر/);
  assert.match(N.rendreAlerte([partage], 'ar', SITE, 'jeton').texte, /شارك عضو في الشبكة عرضًا يناسب شعبتك وسنتك/);
});
