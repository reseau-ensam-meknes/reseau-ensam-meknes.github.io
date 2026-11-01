// Console d'administration, rubriques Animer, Écoles, Partenaires, Affiches et rapport : les fonctions pures
// (admin-donnees.js, admin-textes.js). Jamais de nom d'étudiant dans les messages ; des lauréats, seulement les prénoms
// de ceux qui ont dit oui ; le suivi par étapes ; les slugs ; les chiffres du rapport, sans aucun nom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../../src/seed.js';
import { seasonOf, NB_FONDATEURS } from '../../src/logic.js';
import { ETAPES, etapeVoisine, retardJours, actionCetteSemaine, grouperSuivi, pretAOuvrir, suiviDe, slugEcole, slugValide, FORMULES, formule, dh,
  resumePartenaires, lienContact, nomEtape } from '../../src/admin-donnees.js';
import { resumeSemaine, aidantsSemaine, texteMerci, messageAccordMerci, texteFondateurs, textePromoDemande, rendezVousDuMois, semaineISO, parSemaine,
  chiffresRapport, chiffresReseau, offresRecentes, texteOffresBRE, texteVisuel, consentementsDonnes, messageAccordVisuel, nomFichierVisuel, inscritsDepuis,
  adresseCourte, texteAffiche, messageEcole, messageEntreprise, prenomDe } from '../../src/admin-textes.js';

const NOW = new Date(2026, 10, 1, 17, 0).getTime(); // dimanche 1er novembre 2026, 17 h (heure de l'appareil)
const J = 864e5;
const iso = ms => new Date(ms).toISOString();
const jour = n => { const d = new Date(NOW + n * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const seed = await buildSeed(new Date(NOW));
const saison = seasonOf(new Date(NOW));

// Les textes générés ne disent jamais « saison » ni « (e) » (lexique du site)
const PROPRE = s => { assert.doesNotMatch(s, /\bsaisons?\b/i); assert.doesNotMatch(s, /موسم|\(e\)|\(ة\)/); };

test('résumé de la semaine : aucun nom ni prénom d’étudiant, pour les lauréats comme pour une promo', () => {
  const etudiants = seed.profiles.filter(p => p.role === 'etudiant');
  // Les prénoms qui peuvent paraître pour une autre raison (un lauréat, un titre d'offre ou d'événement) ne prouvent rien
  const ailleurs = [...seed.profiles.filter(p => p.role !== 'etudiant').map(p => p.full_name), ...seed.offers.flatMap(o => [o.titre, o.entreprise]), ...(seed.evenements || []).map(e => e.titre)].join(' ');
  const prenoms = [...new Set(etudiants.map(prenomDe))].filter(x => x.length > 2 && !ailleurs.includes(x));
  assert.ok(prenoms.length >= 5, `prénoms d’étudiants à chercher : ${prenoms.length}`);
  for (const promo of [null, saison + 1, saison + 2, saison + 3]) {
    const r = resumeSemaine(seed, { now: NOW, saison, promo, lien: 'https://exemple.ma/' });
    for (const txt of [r.fr, r.ar]) {
      for (const p of etudiants) assert.ok(!txt.includes(p.full_name), `${p.full_name} dans le résumé`);
      for (const x of prenoms) assert.doesNotMatch(txt, new RegExp(`(^|[^\\p{L}])${x}([^\\p{L}]|$)`, 'u'), `${x} dans le résumé`);
      PROPRE(txt);
      assert.match(txt, /https:\/\/exemple\.ma\//);
    }
  }
});

test('merci de la semaine : seulement les prénoms cochés, jamais un nom de famille', () => {
  const aidants = aidantsSemaine(seed, NOW);
  assert.ok(aidants.length >= 2, 'des lauréats ont aidé cette semaine dans la démo');
  const [a, b] = aidants;
  const r = texteMerci(aidants, [a.id], { lien: 'L' });
  assert.deepEqual(r.noms, [a.prenom]);
  assert.match(r.fr, new RegExp(`Merci à ${a.prenom} !`));
  if (b.prenom !== a.prenom) assert.ok(!r.fr.includes(b.prenom) && !r.ar.includes(b.prenom));
  for (const x of aidants) { const nom = x.p.full_name.split(/\s+/).slice(1).join(' '); if (nom) assert.ok(!r.fr.includes(nom) && !r.ar.includes(nom)); }
  // Personne de coché : un merci sans prénom
  const vide = texteMerci(aidants, [], { lien: 'L' });
  assert.deepEqual(vide.noms, []);
  assert.match(vide.fr, /^🙏 Merci aux lauréats qui ont aidé cette semaine !/);
  for (const x of aidants) assert.ok(!vide.fr.includes(x.p.full_name));
  // « ont aidé » : les lauréats qui ont aidé un étudiant ; les offres sont comptées à part
  assert.equal(r.nL, aidants.filter(x => x.etudiants.length).length);
  // La demande d'accord, dans la langue du lauréat
  assert.match(messageAccordMerci({ ...a, langue: 'fr' }), /Es-tu d’accord/);
  assert.match(messageAccordMerci({ ...a, langue: 'ar' }), /هل توافق/);
  PROPRE(r.fr); PROPRE(r.ar);
});

test('membres fondateurs : ceux qui ont dit non ne sont pas cités', () => {
  const liste = [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }];
  const data = { profiles: [{ id: 'l1', full_name: 'Youssef Alami' }, { id: 'l2', full_name: 'Nadia Berrada', fondateur_public: false }, { id: 'l3', full_name: 'Karim Chraibi' }] };
  const r = texteFondateurs(data, { liste, lien: 'L' });
  assert.match(r.fr, /Déjà : Youssef, Karim et 1 autre\./);
  assert.ok(!r.fr.includes('Nadia') && !r.ar.includes('Nadia') && !r.fr.includes('Alami'));
  assert.equal(r.reste, NB_FONDATEURS - 3);
});

test('Demande avec CV par promo, rendez-vous du mois : les bons mots et le bon niveau', () => {
  const d5 = textePromoDemande(saison + 1, { saison, lien: 'L' }), d3 = textePromoDemande(saison + 3, { saison, lien: 'L' });
  assert.equal(d5.niveau, 5); assert.equal(d3.niveau, 3);
  assert.match(d5.fr, /PFE/); assert.match(d3.fr, /stage/);
  for (const x of [d5.fr, d5.ar, d3.fr, d3.ar]) PROPRE(x);
  const rv = rendezVousDuMois(NOW, 'fr');
  assert.equal(rv.type, 'conference');
  assert.equal(new Date(rv.debut).getHours(), 19);
  assert.equal(new Date(rv.fin) - new Date(rv.debut), 30 * 60e3);
  assert.equal(rendezVousDuMois(NOW, 'ar').lieu, 'عبر الإنترنت');
});

test('semaine ISO (la case « D’accord » vaut pour une semaine) et semaines du rapport', () => {
  assert.equal(semaineISO(NOW), '2026-W44');
  assert.equal(semaineISO(new Date(2026, 0, 1, 12)), '2026-W01');
  assert.equal(semaineISO(new Date(2027, 0, 1, 12)), '2026-W53');
  assert.equal(semaineISO(new Date(2026, 10, 2, 9)), '2026-W45'); // lundi : nouvelle semaine
  const s = parSemaine([NOW - 3600e3, NOW - 2 * J, NOW - 8 * J, NOW - 400 * J, 'pas une date'], NOW, 12);
  assert.equal(s.length, 12);
  assert.equal(new Date(s[11].debut).getDay(), 1, 'chaque semaine commence un lundi');
  assert.ok(s[11].debut <= NOW && NOW < s[11].fin, 'la dernière est la semaine en cours');
  assert.deepEqual(s.slice(-2).map(x => x.n), [1, 2]);
  assert.equal(s.reduce((n, x) => n + x.n, 0), 3);
});

test('suivi par étapes : colonnes dans l’ordre, la prochaine action d’abord, pause et refus à part', () => {
  const l = [
    { id: 'a', type: 'ecole', etape: 'contacte', prochaine_le: jour(5) },
    { id: 'b', type: 'ecole', etape: 'contacte', prochaine_le: jour(-2) },
    { id: 'c', type: 'ecole', etape: 'contacte' },
    { id: 'd', type: 'ecole', etape: 'pause', prochaine_le: jour(1) },
    { id: 'e', type: 'ecole', etape: 'refus' },
    { id: 'f', type: 'partenaire', etape: 'contacte' },
  ];
  const g = grouperSuivi(l, 'ecole');
  assert.deepEqual(g.colonnes.map(c => c.k), ETAPES.ecole.map(([k]) => k));
  assert.deepEqual(g.colonnes.find(c => c.k === 'contacte').lignes.map(x => x.id), ['b', 'a', 'c']);
  assert.deepEqual(g.hors.map(x => x.id), ['d', 'e']);
  assert.equal(grouperSuivi(l, 'partenaire').colonnes.find(c => c.k === 'contacte').lignes.length, 1);
  // Retards : jamais pour une ligne refusée ni sans date
  assert.equal(retardJours(l[1], NOW), 2);
  assert.equal(retardJours(l[0], NOW), 0);
  assert.equal(retardJours(l[2], NOW), 0);
  assert.equal(retardJours({ etape: 'refus', prochaine_le: jour(-9) }, NOW), 0);
  assert.equal(actionCetteSemaine(l[0], NOW), true);
  assert.equal(actionCetteSemaine({ etape: 'contacte', prochaine_le: jour(8) }, NOW), false);
  assert.equal(actionCetteSemaine({ etape: 'refus', prochaine_le: jour(1) }, NOW), false);
  // Étape suivante et précédente ; de pause ou refus, « suivante » remet au début
  assert.equal(etapeVoisine('ecole', 'contacte', 1), 'interesse');
  assert.equal(etapeVoisine('ecole', 'contacte', -1), 'a_contacter');
  assert.equal(etapeVoisine('ecole', 'a_contacter', -1), null);
  assert.equal(etapeVoisine('ecole', 'ouvert', 1), null);
  assert.equal(etapeVoisine('partenaire', 'pause', 1), 'a_contacter');
  assert.equal(etapeVoisine('partenaire', 'signe', 1), 'paye');
  assert.equal(nomEtape('ecole', 'ouvert'), 'Réseau ouvert');
  assert.equal(nomEtape('partenaire', 'refus'), 'Refus');
});

test('ouvrir le réseau d’une école : les trois conditions, la ligne de suivi la plus récente', () => {
  const base = { type: 'ecole', ecole_slug: 'institut-exemple', referent_ok: true, accord_nom: true, cndp_ok: false, updated_at: '2026-10-01' };
  assert.equal(pretAOuvrir(base), false);
  assert.equal(pretAOuvrir({ ...base, cndp_ok: true }), true);
  assert.equal(pretAOuvrir(null), false);
  const recente = { ...base, id: 'r', cndp_ok: true, updated_at: '2026-10-20' };
  assert.equal(suiviDe([{ ...base, id: 'v' }, recente, { ...recente, id: 'p', type: 'partenaire' }], 'institut-exemple').id, 'r');
  assert.equal(suiviDe([recente], 'autre'), null);
});

test('slug d’une école : tiré du nom, même règle que la base', () => {
  assert.equal(slugEcole('ENSAM Casablanca'), 'ensam-casablanca');
  assert.equal(slugEcole('École Mohammadia d’Ingénieurs'), 'ecole-mohammadia-d-ingenieurs');
  assert.equal(slugEcole('Arts & Métiers  Rabat!'), 'arts-et-metiers-rabat');
  assert.equal(slugEcole('  --ENSA   Fès--  '), 'ensa-fes');
  const long = slugEcole('Institut national des postes et télécommunications de Rabat et de Casablanca');
  assert.ok(long.length <= 40 && !long.endsWith('-'), long);
  for (const s of ['ensam-casablanca', 'ab', 'a-1']) assert.equal(slugValide(s), true, s);
  for (const s of ['a', 'Ensam', 'ensam casablanca', 'é', 'x'.repeat(41), '', null]) assert.equal(slugValide(s), false, String(s));
});

test('partenaires : formules, montants en dirhams, résumé du haut', () => {
  assert.deepEqual(FORMULES.map(f => [f.k, f.prix]), [['visibilite', 1000], ['partenaire', 2500], ['saison_pfe', 5000]]);
  assert.equal(formule('saison_pfe').nom, 'Campagne PFE');
  for (const f of FORMULES) for (const x of [f.nom, f.unite, ...f.contenu]) PROPRE(x);
  // Espaces insécables : « 2 500 » reste d'un tenant dans une phrase arabe et ne se sépare pas de « DH »
  assert.equal(dh(2500), '2 500 DH');
  assert.equal(dh(1234567.4), '1 234 567 DH');
  assert.equal(dh(null), '0 DH');
  const l = [
    { type: 'partenaire', etape: 'signe', montant_dh: 1000, prochaine_le: jour(1) },
    { type: 'partenaire', etape: 'paye', montant_dh: 2500 },
    { type: 'partenaire', etape: 'proposition', montant_dh: 5000, prochaine_le: jour(-3) },
    { type: 'partenaire', etape: 'rdv' },
    { type: 'partenaire', etape: 'refus', montant_dh: 9999, prochaine_le: jour(2) },
    { type: 'ecole', etape: 'contacte', prochaine_le: jour(1) },
  ];
  assert.deepEqual(resumePartenaires(l, NOW), { signe: 3500, paye: 2500, discussion: 2, enJeu: 5000, actions: 2 });
  assert.equal(lienContact('rh@entreprise.example'), 'mailto:rh@entreprise.example');
  assert.equal(lienContact('06 00 00 00 00'), 'tel:0600000000');
  assert.equal(lienContact('+212 6 00 00 00 00'), 'tel:+212600000000');
  assert.equal(lienContact('Contact exemple'), null);
});

test('messages aux écoles et aux entreprises : les vrais chiffres, les règles, l’indépendance', () => {
  const c = chiffresReseau(seed, NOW, saison);
  assert.ok(c.membres > 0 && c.laureats > 0 && c.etudiants345 > 0);
  const e = messageEcole(c, { ecole: 'ENSA Fès', a: 'etudiants', lien: 'L' });
  assert.match(e.fr, /^Bonjour à l’équipe de l’association des étudiants de l’ENSA Fès,/);
  assert.match(e.fr, new RegExp(`${c.membres} membres`));
  assert.match(e.fr, /indépendante de l’administration de l’école/);
  assert.match(e.fr, /accord écrit/);
  assert.match(messageEcole(c, { ecole: 'ENSA Fès', a: 'direction' }).fr, /^Madame, Monsieur,/);
  assert.equal(messageEcole(c, { ecole: 'EMI' }).sujet.fr, 'Un réseau entre étudiants et lauréats pour l’EMI');
  const m = messageEntreprise(c, { contact: 'Contact exemple', lien: 'L' });
  assert.match(m.fr, /^Bonjour Contact exemple,/);
  assert.match(m.fr, /label « Sponsorisé »/);
  assert.match(m.fr, /une carte sponsorisée au plus toutes les 10 cartes/);
  assert.match(m.fr, /aucune donnée personnelle/);
  assert.match(m.fr, /jamais des membres/);
  assert.match(m.fr, new RegExp(`${c.laureats} lauréats`));
  assert.ok(m.fr.includes(dh(2500)) && m.ar.includes(dh(5000)));
  for (const x of [e.fr, e.ar, m.fr, m.ar]) PROPRE(x);
});

test('rapport pour l’école : 30 jours de chiffres, aucun nom', () => {
  const c = chiffresRapport(seed, NOW, saison);
  assert.equal(c.fin - c.debut, 30 * J);
  assert.equal(c.inscriptions.length, 12);
  assert.equal(c.aidesSemaines.length, 12);
  assert.ok(c.membres >= c.etudiants + c.laureats - 0 && c.etudiants > 0 && c.laureats > 0);
  assert.equal(c.parAnnee.reduce((n, x) => n + x.total, 0) <= c.etudiants, true);
  assert.ok(c.parcours.length <= 3 && c.parcours.every((x, i, l) => !i || l[i - 1].n >= x.n));
  assert.ok(c.taux48 === null || (c.taux48 >= 0 && c.taux48 <= 1));
  const tout = JSON.stringify(c);
  for (const p of seed.profiles) assert.ok(!tout.includes(p.full_name), `${p.full_name} dans le rapport`);
});

test('offres pour le bureau des relations entreprises : 14 jours, ouvertes, un lien chacune', () => {
  const o = offresRecentes(seed, NOW);
  assert.ok(o.every(x => x.status === 'ouverte' && NOW - new Date(x.created_at) <= 14 * J));
  const t = texteOffresBRE(o, { base: 'https://exemple.ma/' });
  if (o.length) {
    assert.match(t.fr, new RegExp(`ces 14 derniers jours \\(${o.length}\\) :`));
    for (const x of o) assert.ok(t.fr.includes(`https://exemple.ma/#offre/${x.id}`) && t.ar.includes(`https://exemple.ma/#offre/${x.id}`));
  }
  assert.match(t.fr, /indépendante de l’administration de l’école/);
  assert.equal(texteOffresBRE([], {}).fr, 'Aucune offre nouvelle ces 14 derniers jours.');
  PROPRE(t.fr); PROPRE(t.ar);
});

test('visuels des réussites : prénoms seulement, et l’accord des deux', () => {
  const pl = { id: 'p1', entreprise: 'Entreprise exemple', laureat_id: 'l1' };
  const etu = { id: 'e1', full_name: 'Sara Exemple', langue: 'fr' }, lau = { id: 'l1', full_name: 'Meryem Essai', promo: 2012, langue: 'ar' };
  const v = texteVisuel(pl, etu, lau, 'fr');
  assert.deepEqual(v, { titre: 'Sara a rejoint Entreprise exemple', aide: 'avec l’aide de Meryem, promo 2012', signature: 'Réseau ENSAM Meknès' });
  const va = texteVisuel(pl, etu, lau, 'ar');
  assert.equal(va.titre, 'انضمام Sara إلى Entreprise exemple');
  assert.ok(![v.titre, v.aide, va.titre, va.aide].join(' ').match(/Exemple\b(?! exemple)|Essai/));
  assert.equal(texteVisuel({ ...pl, laureat_id: null }, etu, null, 'fr').aide, '');
  // Les deux ont coché « peut être montré » (colonnes à venir) ; sans lauréat, l'étudiant suffit
  assert.equal(consentementsDonnes(pl), false);
  assert.equal(consentementsDonnes({ ...pl, public_etudiant: true }), false);
  assert.equal(consentementsDonnes({ ...pl, public_etudiant: true, public_laureat: true }), true);
  assert.equal(consentementsDonnes({ ...pl, laureat_id: null, public_etudiant: true }), true);
  // La demande d'accord : à l'étudiant son entreprise, au lauréat le prénom de celui qu'il a aidé
  assert.match(messageAccordVisuel(pl, etu, 'etudiant', 'fr'), /^Bonjour Sara 👋 Encore bravo pour Entreprise exemple !.*oui ou non\.$/);
  assert.match(messageAccordVisuel(pl, lau, 'laureat', 'fr', etu), /^Bonjour Meryem 👋 Merci encore d’avoir aidé Sara à rejoindre Entreprise exemple/);
  assert.match(messageAccordVisuel(pl, lau, 'laureat', 'ar', etu), /مساعدتك Sara/);
  assert.ok(!messageAccordVisuel(pl, lau, 'laureat', 'fr', etu).includes('Exemple '));
  assert.equal(nomFichierVisuel(pl, etu, 1080, 1080), 'reussite-sara-entreprise-exemple-1080x1080.png');
  assert.equal(nomFichierVisuel({ entreprise: 'Société Générale' }, { full_name: 'Aïcha B' }, 1200, 627), 'reussite-aicha-societe-generale-1200x627.png');
});

test('affiche et mode événement : les deux langues, la promo, l’indépendance, les inscrits du jour et de la semaine', () => {
  const a = texteAffiche(saison + 1, saison), l = texteAffiche('laureats', saison);
  assert.equal(a.niveau, 5);
  assert.equal(a.fr.pour, `Étudiants de 5A · promo ${saison + 1}`);
  assert.match(a.ar.pour, new RegExp(`السنة الخامسة · دفعة ${saison + 1}`));
  assert.equal(texteAffiche(saison + 3, saison).niveau, 3);
  assert.equal(l.etudiants, false);
  for (const x of [a, l]) {
    assert.equal(x.fr.avantages.length, 3); assert.equal(x.ar.avantages.length, 3);
    assert.equal(x.fr.pied, 'Initiative de lauréats, indépendante de l’administration de l’école.');
    assert.match(x.ar.pied, /مستقلة عن إدارة المدرسة/);
    for (const s of [...Object.values(x.fr).flat(), ...Object.values(x.ar).flat()]) PROPRE(s);
  }
  assert.equal(adresseCourte('https://reseau-ensam-meknes.github.io/promo/2027/'), 'reseau-ensam-meknes.github.io/promo/2027');
  assert.equal(adresseCourte('https://reseau-ensam-meknes.github.io/?promo=2027#accueil'), 'reseau-ensam-meknes.github.io/?promo=2027');
  // Inscrits : depuis minuit (heure de l'appareil) et depuis lundi ; jamais l'administration
  const mercredi = new Date(2026, 10, 4, 15, 0).getTime();
  const p = (id, role, d, extra = {}) => ({ id, role, created_at: iso(d), full_name: id, ...extra });
  const data = { profiles: [
    p('a', 'etudiant', new Date(2026, 10, 4, 0, 5)), p('b', 'laureat', new Date(2026, 10, 4, 14, 59)), p('c', 'admin', new Date(2026, 10, 4, 9)),
    p('d', 'etudiant', new Date(2026, 10, 3, 23, 59)), p('e', 'etudiant', new Date(2026, 10, 2, 0, 1)), p('f', 'etudiant', new Date(2026, 10, 1, 23, 0)),
    p('g', 'etudiant', new Date(2026, 10, 4, 16, 0)), // plus tard que « maintenant » : pas encore compté
  ] };
  assert.deepEqual(inscritsDepuis(data, mercredi), { aujourdhui: 2, semaine: 4 });
  assert.deepEqual(inscritsDepuis(data, new Date(2026, 10, 2, 8).getTime()), { aujourdhui: 1, semaine: 1 }); // lundi matin
});
