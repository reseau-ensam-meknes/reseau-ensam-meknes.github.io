// Vitrine : le domaine dont on montre l'icône (table des entreprises connues, lien de l'offre), la preuve sociale vraie
// d'une offre, « Ça bouge dans le réseau » (des comptes lisibles, jamais qui) et « Grâce à toi » (accueil d'un lauréat)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonOf } from '../../src/logic.js';
import { domaineConnu, domaineDuLien, domaineRessemble, domaineEntreprise, lienFavicon, DOMAINES_ENTREPRISES, preuvesOffre, phraseSauvees, phraseCandidatures,
  caBouge, phraseBouge, graceAToi, phraseGrace } from '../../src/vitrine-regles.js';

test('domaine connu : les grandes entreprises du Maroc, leurs variantes et leurs sigles', () => {
  assert.equal(domaineConnu('OCP'), 'ocpgroup.ma');
  assert.equal(domaineConnu('OCP Group'), 'ocpgroup.ma');
  assert.equal(domaineConnu('Groupe OCP'), 'ocpgroup.ma', '« Groupe » devant le nom');
  assert.equal(domaineConnu('OCP SA Jorf Lasfar'), 'ocpgroup.ma', 'une ville après le sigle');
  assert.equal(domaineConnu('Yazaki Morocco'), 'yazaki-group.com');
  assert.equal(domaineConnu('Stellantis Kénitra'), 'stellantis.com', 'accents ignorés');
  assert.equal(domaineConnu('LafargeHolcim Maroc'), 'lafargeholcim.ma');
  assert.equal(domaineConnu('Holcim'), 'holcim.com');
  assert.equal(domaineConnu('BMCE Bank of Africa'), 'bankofafrica.ma');
  assert.equal(domaineConnu('Maroc Telecom'), 'iam.ma');
  assert.equal(domaineConnu('Siemens Gamesa'), 'siemensgamesa.com', 'la forme la plus longue l’emporte');
  assert.equal(domaineConnu('Siemens'), 'siemens.com');
  assert.equal(domaineConnu('EY'), 'ey.com');
  assert.equal(domaineConnu('EY Maroc'), 'ey.com');
  assert.equal(domaineConnu('ADM'), 'adm.co.ma');
  assert.equal(domaineConnu('ADM Logistics'), null, 'un sigle court suivi d’un autre mot : une autre société');
  assert.equal(domaineConnu('Rampe Industrie'), null, '« RAM » ne prend pas un mot qui commence pareil');
  assert.equal(domaineConnu('Atelier Dupont'), null);
  assert.equal(domaineConnu(''), null);
  // La table : des domaines simples, sans doublon de forme
  const formes = DOMAINES_ENTREPRISES.flatMap(([, f]) => f);
  assert.equal(new Set(formes).size, formes.length, 'chaque forme ne mène qu’à un domaine');
  for (const [d] of DOMAINES_ENTREPRISES) assert.match(d, /^[a-z0-9-]+(\.[a-z0-9-]+)+$/, d);
});

test('domaine du lien : le site de l’entreprise, jamais LinkedIn, un formulaire ou un site d’emploi', () => {
  assert.equal(domaineDuLien('https://careers.jesagroup.com/jobs/42?ref=x'), 'jesagroup.com');
  assert.equal(domaineDuLien('www.cosumar.co.ma/carrieres'), 'cosumar.co.ma', 'sans https et avec un second niveau .co.ma');
  assert.equal(domaineDuLien('https://recrutement.example.org.ma/'), 'example.org.ma');
  for (const l of ['https://www.linkedin.com/jobs/view/42', 'https://lnkd.in/abc', 'https://forms.gle/xyz', 'https://docs.google.com/forms/d/1',
    'https://ma.indeed.com/viewjob?jk=1', 'https://www.rekrute.com/offre.html', 'https://acme.wd3.myworkdayjobs.com/fr', 'https://jobs.lever.co/acme',
    'https://acme.github.io/', 'https://xyz.supabase.co/x', 'http://192.168.1.10/offre', 'mailto:rh@acme.ma', 'pas un lien', '', null]) {
    assert.equal(domaineDuLien(l), null, String(l));
  }
});

test('domaine de l’entreprise : la table d’abord, sinon le lien s’il ressemble au nom ; l’icône chez DuckDuckGo', () => {
  assert.equal(domaineRessemble('JESA', 'jesagroup.com'), true);
  assert.equal(domaineRessemble('Tanger Med', 'tangermed.ma'), true);
  assert.equal(domaineRessemble('Atelier Dupont', 'linkedin.com'), false);
  assert.equal(domaineRessemble('Atelier Dupont', 'ateliers-martin.ma'), false, 'un mot commun ne suffit pas');
  assert.equal(domaineRessemble('Spirit AeroSystems', 'spiritaero.com'), true);
  assert.equal(domaineRessemble('Industrie Dupont Services', 'dupont.ma'), true);
  assert.equal(domaineEntreprise('OCP Group', 'https://www.linkedin.com/jobs/view/1'), 'ocpgroup.ma');
  assert.equal(domaineEntreprise('Dupont Mécanique', 'https://www.dupont-mecanique.ma/emplois'), 'dupont-mecanique.ma');
  assert.equal(domaineEntreprise('Dupont Mécanique', 'https://www.autre-societe.ma/emplois'), null, 'un lien vers un autre site : le monogramme');
  assert.equal(domaineEntreprise('Dupont Mécanique', ''), null);
  assert.equal(lienFavicon('ocpgroup.ma'), 'https://icons.duckduckgo.com/ip3/ocpgroup.ma.ico');
});

const S = seasonOf();
const NOW = Date.now(), il = j => new Date(NOW - j * 864e5).toISOString();
const P = {
  salma: { id: 'salma', role: 'etudiant', promo: S + 1, full_name: 'Salma Bennani', created_at: il(200) },
  hiba: { id: 'hiba', role: 'etudiant', promo: S + 1, full_name: 'Hiba Alaoui', created_at: il(2) },
  amine: { id: 'amine', role: 'etudiant', promo: S + 3, full_name: 'Amine Talbi', created_at: il(300) },
  youssef: { id: 'youssef', role: 'laureat', promo: 2016, full_name: 'Youssef El Amrani', created_at: il(400) },
  nadia: { id: 'nadia', role: 'laureat', promo: 2024, full_name: 'Nadia Idrissi', created_at: il(1) },
  admin: { id: 'admin', role: 'admin', promo: 2010, full_name: 'Admin', created_at: il(500) },
};
const byId = id => P[id];
const offre = (id, o = {}) => ({ id, author_id: 'youssef', status: 'ouverte', audience: 'etudiants', annees: [5], type: 'pfe', titre: 'Offre ' + id, entreprise: 'OCP', created_at: il(10), ...o });
const save = (offer_id, user_id, j = 1) => ({ id: offer_id + user_id, offer_id, user_id, kind: 'save', created_at: il(j) });

test('preuve sociale : les mises de côté vraies (2 au moins, ni l’auteur ni un autre public), les candidatures pour l’auteur seulement', () => {
  const o = offre('o1');
  const data = { profiles: Object.values(P), reactions: [save('o1', 'salma'), save('o1', 'hiba'), save('o1', 'youssef'), save('o1', 'nadia')], applications: [{ id: 'a', offer_id: 'o1', student_id: 'salma' }] };
  const vu = preuvesOffre(data, o, P.amine);
  assert.equal(vu.sauvees, 2, 'deux étudiantes ; ni l’auteur ni une lauréate');
  assert.equal(vu.candidatures, null, 'un étudiant ne voit pas les candidatures des autres');
  assert.equal(preuvesOffre(data, o, P.youssef).candidatures, 1, 'l’auteur voit les siennes');
  assert.equal(preuvesOffre(data, o, P.admin).candidatures, 1);
  assert.equal(preuvesOffre({ ...data, reactions: [save('o1', 'salma')] }, o, P.amine).sauvees, 0, 'une seule : on ne dit rien');
  assert.equal(preuvesOffre(data, offre('o2', { created_at: il(1) }), P.salma).nouvelle, true);
  assert.equal(preuvesOffre(data, offre('o2', { created_at: il(1) }), P.youssef).nouvelle, false, 'pas « Nouvelle » pour son auteur');
  assert.equal(preuvesOffre(data, offre('o2', { created_at: il(1), status: 'pourvue' }), P.salma).nouvelle, false);
  const entre = preuvesOffre({ ...data, reactions: [save('o3', 'nadia'), save('o3', 'admin'), save('o3', 'salma')] }, offre('o3', { audience: 'laureats' }), P.nadia);
  assert.equal(entre.sauvees, 0, 'une offre entre lauréats : seuls les lauréats comptent (une seule ici)');
  assert.equal(phraseSauvees(3, 'etudiant'), '3 étudiants l’ont mise de côté');
  assert.equal(phraseSauvees(2, 'laureat'), '2 lauréats l’ont mise de côté');
  assert.equal(phraseCandidatures(1), '1 candidature');
  assert.equal(phraseCandidatures(4), '4 candidatures');
});

const reseau = x => ({ profiles: Object.values(P), blocages: [], offers: [], reactions: [], reactions_publiques: [], reponses_demandes: [], answers: [], demandes: [], ...x });

test('« Ça bouge » : des comptes vrais et lisibles, sur 7 jours, sinon 30, sinon rien', () => {
  const data = reseau({
    offers: [offre('o1', { created_at: il(2) }), offre('o2', { created_at: il(3), annees: [3] }), offre('o3', { created_at: il(1), audience: 'laureats', annees: [] })],
    reactions_publiques: [{ id: 'r1', offer_id: 'o1', user_id: 'hiba', emoji: '👍', created_at: il(1) }, { id: 'r2', offer_id: 'o3', user_id: 'nadia', emoji: '👏', created_at: il(1) }],
    demandes: [{ id: 'd1', auteur_id: 'hiba', status: 'ouverte', created_at: il(4) }, { id: 'd2', auteur_id: 'amine', status: 'ouverte', created_at: il(4) }],
    reponses_demandes: [{ id: 'x1', demande_id: 'd1', author_id: 'youssef', created_at: il(1) }, { id: 'x2', demande_id: 'd2', author_id: 'youssef', created_at: il(1) }],
  });
  const salma = caBouge(data, P.salma, byId, NOW, S);
  assert.equal(salma.jours, 7);
  // Salma (5A) : l'offre de son année (pas celle de 3A, ni celle entre lauréats), la réaction sur l'offre qu'elle lit,
  // la réponse sous la demande de sa promo (pas celle d'Amine) ; trois faits au plus, dans l'ordre
  assert.deepEqual(salma.faits, [{ cle: 'offres', n: 1 }, { cle: 'reactions', n: 1 }, { cle: 'reponses', n: 1 }]);
  const youssef = caBouge(data, P.youssef, byId, NOW, S);
  assert.deepEqual(youssef.faits, [{ cle: 'offres', n: 3 }, { cle: 'reactions', n: 2 }, { cle: 'reponses', n: 2 }], 'un lauréat lit tout');
  // Le réseau calme : 30 jours, puis rien (jamais « 0 »)
  const calme = reseau({ offers: [offre('o1', { created_at: il(20) })], profiles: Object.values(P).map(p => ({ ...p, created_at: il(300) })) });
  assert.deepEqual(caBouge(calme, P.salma, byId, NOW, S), { jours: 30, faits: [{ cle: 'offres', n: 1 }], total: 1 });
  assert.equal(caBouge(reseau({ profiles: calme.profiles }), P.salma, byId, NOW, S), null);
  // Les nouveaux membres (étudiants et lauréats, pas soi-même)
  assert.deepEqual(caBouge(reseau({}), P.youssef, byId, NOW, S), { jours: 30, faits: [{ cle: 'membres', n: 2 }], total: 2 }, 'deux arrivées seulement : moins de 3 gestes en 7 jours, donc 30 jours');
  assert.deepEqual(caBouge(reseau({}), P.hiba, byId, NOW, S).faits, [{ cle: 'membres', n: 1 }], 'pas soi-même');
  const mois = caBouge(reseau({ answers: [{ id: 'a1', created_at: il(2) }] }), P.youssef, byId, NOW, S);
  assert.deepEqual(mois.faits, [{ cle: 'reponses', n: 1 }, { cle: 'membres', n: 2 }]);
  assert.equal(phraseBouge({ cle: 'membres', n: 2 }), '2 nouveaux membres');
  assert.equal(phraseBouge({ cle: 'offres', n: 1 }), '1 nouvelle offre');
  assert.equal(phraseBouge({ cle: 'reactions', n: 17 }), '17 réactions');
});

test('« Grâce à toi » : la plus belle nouvelle vraie née de ses offres, une fois par étudiant', () => {
  const o = offre('o1');
  const app = (student_id, status, j, offer_id = 'o1') => ({ id: student_id + offer_id, offer_id, student_id, status, updated_at: il(j), created_at: il(20) });
  const data = { profiles: Object.values(P), offers: [o, offre('o2', { author_id: 'nadia' })], placements: [], reactions: [],
    applications: [app('salma', 'entretien', 1), app('hiba', 'postule', 0), app('amine', 'entretien', 20), app('hiba', 'entretien', 0, 'o2')] };
  assert.deepEqual(graceAToi(data, P.youssef, NOW), { quoi: 'entretien', etudiant: 'salma', type: 'pfe', offre: 'o1', at: il(1), autres: 0 });
  assert.equal(graceAToi(data, P.salma, NOW), null, 'seulement pour un lauréat');
  assert.equal(graceAToi(data, P.nadia, NOW).etudiant, 'hiba', 'l’offre de Nadia : sa propre nouvelle');
  // Un recrutement confirmé passe devant un entretien ; le même étudiant n'est dit qu'une fois
  const avec = { ...data, placements: [{ id: 'p', laureat_id: 'youssef', student_id: 'salma', status: 'confirme', type: 'pfe', offer_id: 'o1', confirmed_at: il(3) }],
    applications: [...data.applications, app('hiba', 'retenu', 2)] };
  const g = graceAToi(avec, P.youssef, NOW);
  assert.equal(g.quoi, 'recrute'); assert.equal(g.etudiant, 'salma'); assert.equal(g.autres, 1, 'Hiba, retenue, est l’autre nouvelle');
  assert.equal(phraseGrace(g, 'Salma'), 'Grâce à toi, Salma a décroché son PFE');
  assert.equal(phraseGrace({ quoi: 'entretien' }, 'Salma'), 'Grâce à toi, Salma a décroché un entretien');
  assert.equal(phraseGrace({ quoi: 'retenu', type: 'emploi' }, 'Karim'), 'Grâce à toi, Karim a décroché son poste');
  // Personne n'a encore avancé : ses offres que des étudiants ont mises de côté (2 au moins, 14 jours)
  const interet = { ...data, applications: [], reactions: [save('o1', 'salma', 2), save('o1', 'hiba', 3), save('o1', 'nadia', 1), save('o1', 'amine', 30)] };
  assert.deepEqual(graceAToi(interet, P.youssef, NOW), { quoi: 'interet', offre: 'o1', n: 2, at: null });
  assert.equal(phraseGrace({ quoi: 'interet', n: 2 }), '2 étudiants ont mis ton offre de côté');
  assert.equal(graceAToi({ ...interet, reactions: [save('o1', 'salma', 2)] }, P.youssef, NOW), null, 'une seule : rien');
});
