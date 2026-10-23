// Liens, preuves et chiffres : la langue d'un lien partagé, la recherche par lieu (« مكناس » = Meknès), les villes en
// arabe, la règle « peut te recommander », le seuil de 3 avis, les mercis montrés et le chiffre du Réseau
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { langueDuLien, avecLangue } from '../../src/regles-entree.js';
import { villeAR, villeAffichee, recherche, motsRecherche, plie } from '../../src/geo.js';
import { sameCompany, peutRecommander, noteSiAssez, AVIS_POUR_NOTE, mercisPublics, dernierMerciPour, chiffreReseau } from '../../src/logic.js';

test('langue d’un lien : ?lang=ar ouvre en arabe seulement si ce navigateur n’a rien choisi', () => {
  assert.equal(langueDuLien('?lang=ar', null), 'ar');
  assert.equal(langueDuLien('?promo=2019&lang=ar', null), 'ar', 'lien de promo');
  assert.equal(langueDuLien('?lang=ar', 'fr'), null, 'un choix déjà fait (français) n’est jamais écrasé');
  assert.equal(langueDuLien('?lang=ar', 'ar'), null, 'déjà en arabe par choix : rien à faire');
  assert.equal(langueDuLien('', null), null);
  assert.equal(langueDuLien('?lang=fr', null), null);
  assert.equal(langueDuLien(undefined, null), null);
});

test('lien partagé : la langue suit l’interface de celui qui partage', () => {
  assert.equal(avecLangue('https://r.io/', 'ar'), 'https://r.io/?lang=ar');
  assert.equal(avecLangue('https://r.io/', 'fr'), 'https://r.io/');
  assert.equal(avecLangue('https://r.io/?x=1', 'ar'), 'https://r.io/?x=1&lang=ar');
  assert.equal(avecLangue('https://r.io/', 'ar') + '#offre/abc', 'https://r.io/?lang=ar#offre/abc', 'le #route reste après la langue');
  assert.equal(langueDuLien(new URL(avecLangue('https://r.io/', 'ar') + '#offre/abc').search, null), 'ar', 'aller-retour');
});

test('villes : écrites en arabe dans l’interface arabe, quelle que soit l’orthographe du membre', () => {
  assert.equal(villeAR('Meknès'), 'مكناس');
  assert.equal(villeAR('meknes'), 'مكناس');
  assert.equal(villeAR('MEKNES'), 'مكناس');
  assert.equal(villeAR('Casa'), 'الدار البيضاء');
  assert.equal(villeAR('Fez'), 'فاس');
  assert.equal(villeAR('Paris'), 'باريس');
  assert.equal(villeAR('Ville de Kénitra'), 'القنيطرة');
  assert.equal(villeAR('Technopolis'), null, 'un quartier n’est pas remplacé par sa ville');
  assert.equal(villeAR('Silicon Valley'), null);
  assert.equal(villeAR('Trifouillis'), null, 'ville inconnue');
  assert.equal(villeAffichee('Meknès', 'ar'), 'مكناس');
  assert.equal(villeAffichee('Meknès', 'fr'), 'Meknès', 'en français, telle que le membre l’a écrite');
  assert.equal(villeAffichee('Trifouillis', 'ar'), 'Trifouillis');
  assert.equal(villeAffichee(null, 'ar'), '');
});

test('recherche : « مكناس » trouve Meknès, accents, casse et alias ignorés', () => {
  const ok = (q, texte, ...lieux) => recherche(q)(texte, ...lieux);
  assert.equal(recherche(''), null, 'rien de tapé : pas de filtre');
  assert.equal(recherche('   '), null);
  assert.ok(ok('مكناس', 'Salma Bennani', 'Meknès', 'Maroc'));
  assert.ok(ok('meknes', 'x', 'Meknès'));
  assert.ok(ok('MEKNÈS', 'x', 'meknes'));
  assert.ok(ok('Meknès', 'x', 'مكناس'), 'et dans l’autre sens');
  assert.ok(ok('مكن', 'x', 'Meknès'), 'début d’un nom arabe');
  assert.ok(!ok('مكناس', 'Hiba', 'Fès', 'Maroc'));
  assert.ok(ok('الدار البيضاء', 'x', 'Casa'), 'nom en deux mots');
  assert.ok(ok('casablanca', 'x', 'Casa'));
  assert.ok(ok('طنجة', 'x', 'Tanger'));
  assert.ok(ok('tangier', 'x', 'Tanger'));
  assert.ok(ok('فرنسا', '', 'France'));
  assert.ok(ok('usa', '', 'États-Unis'));
  assert.ok(ok('الإمارات', '', 'Émirats arabes unis'));
  assert.ok(ok('fra', '', 'France'), 'début de nom');
  assert.ok(ok('renault tanger', 'Renault Group Maroc', 'Tanger'), 'chaque mot, dans n’importe quel ordre');
  assert.ok(!ok('renault rabat', 'Renault Group Maroc', 'Tanger'));
  assert.ok(ok('génie', 'Genie Industriel'), 'accents ignorés hors lieux aussi');
  assert.ok(ok('dc', 'DC Consulting'), 'un alias court reste aussi ce qu’on a tapé');
  assert.deepEqual(motsRecherche('Casa'), [['casa', 'casablanca', plie('الدار البيضاء')]]);
  assert.equal(plie('Fès-la-Médina'), 'fes la medina');
  assert.equal(plie('مَكْنَاس'), 'مكناس', 'voyelles arabes ignorées');
});

test('peut te recommander : seulement s’il travaille dans l’entreprise de l’offre', () => {
  const offre = (entreprise, cooptation = true) => ({ entreprise, cooptation });
  // Comparaison robuste : casse, accents, formes juridiques, groupe et pays
  assert.ok(sameCompany('Yazaki Morocco', 'YAZAKI'));
  assert.ok(sameCompany('Lear Corporation', 'lear'));
  assert.ok(sameCompany('Société Générale Maroc', 'societe generale'));
  assert.ok(sameCompany('Renault Group Maroc', 'Renault SAS'));
  assert.ok(sameCompany('OCP S.A.', 'OCP Group'));
  assert.ok(sameCompany('Capgemini Engineering', 'Capgemini'));
  assert.ok(!sameCompany('Siemens Gamesa', 'Yazaki Morocco'));
  assert.ok(peutRecommander(offre('Yazaki Morocco'), { entreprise: 'Yazaki' }));
  assert.ok(peutRecommander(offre('Stellantis Kénitra'), { entreprise: 'STELLANTIS KENITRA' }));
  assert.ok(!peutRecommander(offre('Yazaki Morocco'), { entreprise: 'Siemens Gamesa' }), 'ailleurs : « Partagée par Nour » sans promesse');
  assert.ok(!peutRecommander(offre('Yazaki Morocco', false), { entreprise: 'Yazaki' }), 'cooptation non cochée');
  assert.ok(!peutRecommander(offre('Yazaki Morocco'), { entreprise: null }), 'entreprise cachée (« Qui voit quoi ») : on ne promet rien');
  assert.ok(!peutRecommander(offre('Yazaki Morocco'), null));
  assert.ok(!peutRecommander(null, { entreprise: 'Yazaki' }));
});

test('note : une moyenne seulement à partir de 3 avis', () => {
  assert.equal(AVIS_POUR_NOTE, 3);
  assert.equal(noteSiAssez([]), null);
  assert.equal(noteSiAssez([5]), null, 'un seul avis : pas de « 5,0 »');
  assert.equal(noteSiAssez([5, 4]), null);
  assert.equal(noteSiAssez([5, 4, 3]), 4);
  assert.equal(noteSiAssez([5, null, 4, undefined, 3]), 4, 'les avis sans cette note ne comptent pas');
  assert.equal(noteSiAssez([5, null, 4]), null);
  assert.equal(noteSiAssez(undefined), null);
});

test('mercis montrés : réussites confirmées et mentorats terminés, le plus récent d’abord', () => {
  const data = {
    placements: [
      { id: 'p1', student_id: 's1', laureat_id: 'l1', status: 'confirme', merci: 'Merci pour la cooptation', confirmed_at: '2026-10-10T10:00:00Z', entreprise: 'Stellantis' },
      { id: 'p2', student_id: 's2', laureat_id: 'l1', status: 'en_attente', merci: 'pas encore confirmé', created_at: '2026-10-20T10:00:00Z' },
      { id: 'p3', student_id: 's3', laureat_id: null, status: 'confirme', merci: 'trouvé seul', confirmed_at: '2026-10-21T10:00:00Z' },
      { id: 'p4', student_id: 's4', laureat_id: 'l2', status: 'confirme', merci: '   ', confirmed_at: '2026-10-22T10:00:00Z' },
    ],
    mentorships: [
      { id: 'm1', student_id: 's5', mentor_id: 'l1', status: 'terminee', merci: 'Merci pour tes conseils', rdv_at: '2026-10-15T10:00:00Z' },
      { id: 'm2', student_id: 's6', mentor_id: 'l2', status: 'acceptee', merci: 'pas fini', rdv_at: '2026-10-18T10:00:00Z' },
      { id: 'm3', student_id: 's7', mentor_id: 'l2', status: 'terminee', merci: null, rdv_at: '2026-10-19T10:00:00Z' },
    ],
  };
  const m = mercisPublics(data);
  assert.deepEqual(m.map(x => x.id), ['mm1', 'pp1']);
  assert.deepEqual(m[1], { id: 'pp1', from: 's1', to: 'l1', txt: 'Merci pour la cooptation', at: '2026-10-10T10:00:00Z', entreprise: 'Stellantis', confirme: true });
  assert.equal(dernierMerciPour(m, 'l1').txt, 'Merci pour tes conseils', 'le dernier reçu');
  assert.equal(dernierMerciPour(m, 'l2'), null, 'aucun merci montrable : rien');
  assert.deepEqual(mercisPublics({}), []);
});

test('chiffre du Réseau : un seul, vrai, adapté au lecteur', () => {
  const profils = (l, e) => [...Array(l)].map(() => ({ role: 'laureat' })).concat([...Array(e)].map(() => ({ role: 'etudiant' })), [{ role: 'admin' }]);
  assert.equal(chiffreReseau(profils(39, 3), { role: 'etudiant' }), '39 lauréats');
  assert.equal(chiffreReseau(profils(39, 3), { role: 'laureat' }), '39 lauréats', '« 3 étudiants » découragerait');
  assert.equal(chiffreReseau(profils(39, 25), { role: 'laureat' }), '39 lauréats · 25 étudiants');
  assert.equal(chiffreReseau(profils(39, 25), { role: 'etudiant' }), '39 lauréats');
  assert.equal(chiffreReseau(profils(1, 0), { role: 'etudiant' }), '1 lauréat', 'singulier');
  assert.equal(chiffreReseau(profils(0, 30), { role: 'admin' }), '', 'jamais « 0 lauréat »');
});
