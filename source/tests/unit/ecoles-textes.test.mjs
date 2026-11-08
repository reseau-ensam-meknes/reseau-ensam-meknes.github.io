// Écoles : les textes qu'un membre emporte hors de l'application disent son école (ou celle de l'événement, du café) :
// l'attestation de contribution (dessinée, imprimée, ajoutée à LinkedIn), la réussite à partager sur LinkedIn et ses
// mots-dièse, le résumé de Mon année, ce que reçoit l'agenda pour un événement, un café, un mentorat ou un entretien, le
// bilan de cooptation. Pour l'ENSAM Meknès, tout reste comme avant, à l'octet près, en français et en arabe ; une autre
// école n'y est jamais l'ENSAM Meknès, et une école pas encore ouverte n'y est jamais nommée (« ENSAM », sans ville).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Les dates de l'attestation (« Délivrée le 15 mars 2026 », le mois du lien LinkedIn) se lisent à l'heure de l'appareil :
// celle de Greenwich ici, pour la même empreinte partout
process.env.TZ = 'UTC';
// Le navigateur, juste ce qu'il faut pour charger ces modules
const stockage = new Map();
globalThis.window = globalThis;
globalThis.ENSAM_ENTREE = true;
globalThis.document = { documentElement: {}, addEventListener() {}, querySelector: () => null, head: { appendChild() {} }, createElement: () => ({ dataset: {}, style: {} }) };
globalThis.addEventListener = () => {};
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.localStorage = { getItem: k => (stockage.has(k) ? stockage.get(k) : null), setItem: (k, v) => stockage.set(k, String(v)), removeItem: k => stockage.delete(k) };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.location = { href: 'https://r.io/index.html#espace', origin: 'https://r.io', pathname: '/', search: '', hash: '' };

const L = await import('../../src/logic.js');
const G = await import('../../src/growth.js');
const S = await import('../../src/saison.js');
const AG = await import('../../src/agenda.js');
const GR = await import('../../src/groupes.js');
const MT = await import('../../src/mentorat.js');
const MS = await import('../../src/messages.js');
const R = await import('../../src/recrutement.js');
const { setLang, t, missing } = await import('../../src/i18n.js');

// Des écoles d'exemple (lignes de la table des écoles) : une ouverte qui s'élide (« de l'ENSA Fès »), une ouverte sans nom
// arabe qui ne s'élide pas (« de l'école FST Settat »), une autre ENSAM, une pas encore ouverte (jamais nommée)
const FES = { slug: 'ensa-fes', nom: 'ENSA Fès', nom_court: 'ENSA', ville: 'Fès', nom_ar: 'ENSA فاس', ouverte: true, created_at: '2026-10-01T00:00:00Z' };
const FST = { slug: 'fst-settat', nom: 'FST Settat', nom_court: 'FST', ville: 'Settat', ouverte: true, created_at: '2026-10-02T00:00:00Z' };
const CASA = { slug: 'ensam-casablanca', nom: 'ENSAM Casablanca', nom_court: 'ENSAM', ville: 'Casablanca', nom_ar: 'ENSAM الدار البيضاء', ouverte: true, created_at: '2026-10-04T00:00:00Z' };
const FERMEE = { slug: 'ecole-exemple', nom: 'École exemple', nom_court: 'EE', ville: 'Exempleville', nom_ar: 'مدرسة مثال', ouverte: false, created_at: '2026-10-03T00:00:00Z' };
const MEKNES = { slug: 'ensam-meknes', nom: 'ENSAM Meknès', ouverte: true, created_at: '2026-10-21T00:00:00Z' };
const ECOLES = [MEKNES, FES, FST, CASA, FERMEE];

// Les arguments : des membres, un magasin, une attestation, des réussites, des années, des événements, des cafés, des
// mentorats, des entretiens et des bilans
const LAU = { id: 'lau', full_name: 'Karim Alaoui', role: 'laureat', filiere: 'Génie Industriel', promo: 2016, entreprise: 'OCP' };
const LAU2 = { id: 'lau2', full_name: 'Nadia Tazi', role: 'laureat', filiere: 'Génie Mécanique', promo: 2012, entreprise: null };
const ETU = { id: 'etu', full_name: 'Salma Bennani', role: 'etudiant', filiere: 'Génie Mécanique', promo: 2027 };
const store = { byId: (t, id) => [LAU, LAU2, ETU].find(p => p.id === id) || null, data: { ecoles: [] } };
const A = { id: 'a1b2c3d4-0000-4000-8000-000000000001', laureat_id: 'lau', created_at: '2026-03-15T12:00:00Z', stats: { mentorats: 2, recrutes: 1, reponses: 3 } };
const A1 = { id: 'ffee0011-0000-4000-8000-000000000002', laureat_id: 'lau', created_at: '2025-12-15T12:00:00Z', stats: { mentorats: 1, recrutes: 0, reponses: 1 } };
const PL = [
  { id: 'p1', student_id: 'etu', laureat_id: 'lau', status: 'confirme', type: 'pfe', entreprise: 'OCP', ville: 'Jorf Lasfar', partage_ok: true },
  { id: 'p2', student_id: 'etu', laureat_id: null, status: 'declare', type: 'stage', entreprise: 'Lear', ville: null, partage_ok: false },
  { id: 'p3', student_id: 'etu', laureat_id: 'lau', status: 'en_attente', type: 'emploi', entreprise: 'Renault', ville: 'Tanger', partage_ok: false },
  { id: 'p4', student_id: 'etu', laureat_id: 'lau', status: 'confirme', type: 'etranger', entreprise: 'Airbus', ville: 'Toulouse', partage_ok: true },
];
const ANNEES = [
  [{ role: 'etudiant', reussite: { entreprise: 'OCP' } }, [['send', 3, 'candidature', 'candidatures'], ['mentor', 1, 'mentorat', 'mentorats']]],
  [{ role: 'etudiant', reussite: null }, []],
  [{ role: 'laureat' }, [['star', 40, 'point d’impact', 'points d’impact'], ['briefcase', 1, 'recruté grâce à toi', 'recrutés grâce à toi']]],
  [{ role: 'laureat' }, []],
];
const EVENEMENTS = [
  { id: 'e1', titre: 'Forum entreprises', description: 'Venez nombreux.', lien: 'https://meet.exemple.ma/forum', lieu: 'Grand hall', debut: '2026-11-20T09:00:00Z', fin: '2026-11-20T17:00:00Z' },
  { id: 'e2', titre: 'Conférence en ligne', description: null, lien: null, lieu: null, debut: '2026-12-02T18:00:00Z', fin: null },
];
const CAFES = [
  { id: 'c1', date_at: '2026-11-21T10:00:00Z', ville: 'Casablanca', lieu: 'Café de France', pays: 'Maroc', message: 'On parle stages.' },
  { id: 'c2', date_at: '2026-12-05T15:30:00Z', ville: 'Paris', lieu: 'Le Procope', pays: 'France', message: null },
];
const MENTORATS = [[{ id: 'm1', sujet: 'Préparer mon entretien', student_id: 'etu', mentor_id: 'lau', rdv_at: '2026-11-22T17:00:00Z' }, 'https://meet.jit.si/ensam-x'], [{ id: 'm2', sujet: 'Choisir mon PFE', student_id: 'etu', mentor_id: 'inconnu', rdv_at: '2026-11-23T17:00:00Z' }, null]];
const ENTRETIENS = [
  [{ id: 'r1', rdv_at: '2026-11-24T10:00:00Z', rdv_duree: 30, rdv_lien: 'https://meet.exemple.ma/y', rdv_lieu: null, body: 'Prépare un exemple de projet.' }, LAU],
  [{ id: 'r2', rdv_at: '2026-11-25T10:00:00Z', rdv_duree: 15, rdv_lien: null, rdv_lieu: 'Usine, accueil principal', body: null }, null],
];
const BILANS = [[LAU, { laureats: 1 }, true], [LAU, { laureats: 3 }, true], [LAU, { laureats: 3 }, false], [LAU2, { laureats: 2 }, true]];
// Les textes d'un arbre de vnodes, tels qu'ils s'affichent (les composants imbriqués, comme le logo, ne sont pas dessinés)
const textes = v => (v == null || typeof v === 'boolean' ? [] : typeof v === 'string' || typeof v === 'number' ? [String(v)] : Array.isArray(v) ? v.flatMap(textes) : typeof v.type === 'string' ? textes(v.props?.children) : []);
const empreinte = o => createHash('sha256').update(JSON.stringify(o)).digest('hex');

// Tous ces textes, avec les noms d'une école (sans noms : les arguments d'avant), en français puis en arabe
async function sorties(noms) {
  const o = {};
  for (const lang of ['fr', 'ar']) {
    await setLang(lang);
    for (const [i, e] of EVENEMENTS.entries()) o[`agenda ${lang} ${i}`] = AG.textesAgenda(e, noms);
    for (const [i, [m, lien]] of MENTORATS.entries()) o[`mentorat ${lang} ${i}`] = MT.rdvTexts(m, store, lien, noms);
    for (const [i, [m, autre]] of ENTRETIENS.entries()) o[`entretien ${lang} ${i}`] = MS.texteEntretien(m, autre, noms);
    for (const [i, [a, shown]] of ANNEES.entries()) o[`annee ${lang} ${i}`] = S.resumeAnnee(a, 2025, shown, lang, noms);
  }
  await setLang('fr');
  for (const [i, c] of CAFES.entries()) o[`cafe ${i}`] = GR.gcalCafe(c, noms);
  for (const [i, a] of [A, A1].entries()) o[`linkedin ${i}`] = G.linkedinCertUrl(a, noms);
  const attestation = () => [textes(G.Certificate({ p: LAU, a: A, code: 'A1B2-C3D4', url: 'https://r.io/#verifier/a1b2', noms })), textes(G.Certificate({ p: LAU, a: A1, noms }))];
  o.attestation = attestation();
  for (const me of [ETU, LAU]) for (const pl of PL) o[`partage ${me.id} ${pl.id}`] = G.shareText(store, me, pl, noms);
  for (const [i, [me, b, eq]] of BILANS.entries()) o[`bilan ${i}`] = R.enTeteBilan(me, b, eq, noms);
  // En arabe, dans l'application : l'attestation dessinée, l'en-tête du bilan traduit
  await setLang('ar');
  o['attestation ar'] = attestation();
  for (const [i, [me, b, eq]] of BILANS.entries()) { const x = R.enTeteBilan(me, b, eq, noms); o[`bilan ar ${i}`] = { org: t(x.org), titre: t(x.titre) }; }
  await setLang('fr');
  return o;
}
// Empreinte des 42 sorties calculée sur le code d'avant (55b6752, ses fonctions exposées telles quelles), mêmes arguments
const AVANT = '626106a0953104f4e05f5d8426d5b5dba3bee2043a8259a5e113b51570871ecb';

// Pour comparer : les adresses (Google Agenda, LinkedIn) lues en clair, et chaque texte d'un objet
const surTextes = (v, f) => (typeof v === 'string' ? f(v) : Array.isArray(v) ? v.map(x => surTextes(x, f)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, surTextes(x, f)])) : v);
const lisible = o => surTextes(o, s => (s.startsWith('https://') ? decodeURIComponent(s.replaceAll('+', '%20')) : s));
const tousLesTextes = o => { const out = []; surTextes(lisible(o), s => out.push(s)); return out; };
// Le texte de l'ENSAM Meknès avec les noms d'une autre école : seuls ses noms changent, et ses mots-dièse
const avecNoms = (s, c) => s.replaceAll('#ENSAM #ENSAMMeknès #ArtsEtMétiers', c.dieses).replaceAll('de l’ENSAM Meknès', c.de)
  .replaceAll('Mentorat Réseau ENSAM :', `Mentorat Réseau ${c.nom} :`).replaceAll('Entretien Réseau ENSAM :', `Entretien Réseau ${c.nom} :`)
  .replaceAll('ENSAM Meknès', c.nom).replaceAll('ENSAM مكناس', c.nomAr);
const SANS_MEKNES = /Meknès|Meknes|مكناس/i;
// Le membre (ou l'événement, le café) de chaque école, ses noms et ce qu'on attend
const CAS = [
  { qui: { ecole: 'ensa-fes' }, nom: 'ENSA Fès', nomAr: 'ENSA فاس', de: 'de l’ENSA Fès', dieses: '#ENSAFès' },
  { qui: { ecole: 'fst-settat', role: 'laureat' }, nom: 'FST Settat', nomAr: 'FST Settat', de: 'de l’école FST Settat', dieses: '#FSTSettat' },
  { qui: { ecole: 'ensam-casablanca' }, nom: 'ENSAM Casablanca', nomAr: 'ENSAM الدار البيضاء', de: 'de l’ENSAM Casablanca', dieses: '#ENSAM #ENSAMCasablanca #ArtsEtMétiers' },
  // Pas encore ouverte, ou sa ligne pas (encore) là : « ENSAM », sans ville
  { qui: { ecole: 'ecole-exemple' }, nom: 'ENSAM', nomAr: 'ENSAM', de: 'de l’ENSAM', dieses: '#ENSAM' },
  { qui: { ecole: 'ecole-inconnue', id: 'e9' }, nom: 'ENSAM', nomAr: 'ENSAM', de: 'de l’ENSAM', dieses: '#ENSAM' },
];

test('ENSAM Meknès : les 42 textes de l’attestation, du partage, de Mon année, des agendas et du bilan, à l’octet près ceux d’avant, en français et en arabe', async () => {
  const avant = await sorties(undefined);
  assert.equal(Object.keys(avant).length, 42);
  assert.equal(empreinte(avant), AVANT);
  // Les noms que l'application passe pour un membre (ou un événement, un café) de l'ENSAM Meknès, avec ou sans son école,
  // avec ou sans la table des écoles (même une ligne de l'ENSAM Meknès aux autres noms) : les textes d'avant
  for (const [data, x] of [[{ ecoles: ECOLES }, LAU], [{ ecoles: ECOLES }, { ecole: 'ensam-meknes' }], [{ ecoles: [] }, { ecole: null }], [undefined, undefined],
    [{ ecoles: [{ ...MEKNES, nom: 'Autre nom', nom_court: 'AN', ville: 'Ailleurs', nom_ar: 'اسم آخر' }] }, { ecole: 'ensam-meknes' }]]) {
    const noms = L.nomsAPartagerDe(data, x);
    assert.equal(noms, L.NOMS_MEKNES, JSON.stringify(x));
    assert.equal(empreinte(await sorties(noms)), AVANT);
  }
  // Quelques-uns en clair
  assert.equal(avant['agenda fr 0'].details, 'Venez nombreux.\n\nLien : https://meet.exemple.ma/forum\n\nRéseau ENSAM Meknès');
  assert.equal(avant['agenda ar 1'].details, 'شبكة ENSAM مكناس');
  assert.equal(avant['mentorat fr 0'].title, 'Mentorat Réseau ENSAM : Préparer mon entretien');
  assert.equal(avant['mentorat fr 0'].details, 'Rendez-vous de 20 min entre Karim Alaoui (lauréat) et Salma Bennani.\nVisio : https://meet.jit.si/ensam-x\nRéseau ENSAM Meknès');
  assert.equal(avant['mentorat ar 0'].title, 'إرشاد · شبكة ENSAM مكناس : Préparer mon entretien');
  assert.equal(avant['entretien fr 0'].title, 'Entretien Réseau ENSAM : Karim Alaoui');
  assert.equal(avant['entretien ar 0'].details, '30 دقيقة\nالاتصال المرئي: https://meet.exemple.ma/y\nPrépare un exemple de projet.\nشبكة ENSAM مكناس');
  assert.equal(avant['annee fr 0'], 'Mon année 2025-2026 sur le Réseau ENSAM Meknès : 3 candidatures, 1 mentorat, et une réussite chez OCP. Merci aux lauréats de l’école !');
  assert.equal(avant['annee ar 0'], 'سنتي 2025-2026 في شبكة ENSAM مكناس: 3 ترشيحات، 1 جلسة إرشاد، ونجاح لدى OCP. شكرًا لخريجي المدرسة!');
  assert.match(avant['cafe 0'], /&details=On\+parle\+stages\.%0A%0ARencontre\+du\+R%C3%A9seau\+ENSAM\+Mekn%C3%A8s&/);
  assert.match(avant['linkedin 0'], /&name=Attestation%20de%20contribution%20%C2%B7%20R%C3%A9seau%20ENSAM%20Mekn%C3%A8s&organizationName=R%C3%A9seau%20ENSAM%20Mekn%C3%A8s&issueYear=2026&issueMonth=3&/);
  assert.deepEqual(avant.attestation[0].slice(0, 4), ['Réseau ENSAM Meknès', 'Lauréats & étudiants', 'Attestation de contribution', 'La plateforme Réseau ENSAM Meknès atteste que']);
  assert.deepEqual(avant['attestation ar'][0].slice(0, 4), ['شبكة ENSAM مكناس', 'الخريجون والطلبة', 'شهادة مساهمة', 'تشهد منصة شبكة ENSAM مكناس أن']);
  assert.equal(avant['partage etu p1'], 'Une belle nouvelle : je rejoins OCP à Jorf Lasfar pour mon projet de fin d’études !\n\nMerci à Karim Alaoui (ENSAM Meknès), qui m’a ouvert la porte grâce au Réseau ENSAM Meknès.\n\n#ENSAM #ENSAMMeknès #ArtsEtMétiers');
  assert.match(avant['partage lau p2'], /^C’est une joie d’accueillir un talent de l’ENSAM Meknès chez Lear pour son stage\.\n\nSur le Réseau ENSAM Meknès, .*\n\n#ENSAM #ENSAMMeknès #ArtsEtMétiers$/);
  assert.deepEqual(avant['bilan 1'], { org: 'Réseau ENSAM Meknès', titre: 'OCP · 3 lauréats de l’ENSAM Meknès' });
  assert.deepEqual(avant['bilan ar 1'], { org: 'شبكة ENSAM مكناس', titre: '⁨OCP⁩ · 3 خريجين من ENSAM مكناس' });
});

test('une autre école : son nom (en arabe, son nom arabe), jamais l’ENSAM Meknès ; pas encore ouverte : « ENSAM », sans ville ; seuls les noms changent', async () => {
  const avant = lisible(await sorties(undefined));
  for (const c of CAS) {
    const noms = L.nomsAPartagerDe({ ecoles: ECOLES }, c.qui);
    assert.deepEqual([noms.nom, noms.nomAr, noms.meknes], [c.nom, c.nomAr, false], c.qui.ecole);
    const o = await sorties(noms);
    // Seuls les noms et les mots-dièse changent, en français et en arabe, dans l'application et dans les adresses
    assert.deepEqual(lisible(o), surTextes(avant, s => avecNoms(s, c)), c.qui.ecole);
    for (const s of tousLesTextes(o)) {
      assert.doesNotMatch(s, SANS_MEKNES, `${c.qui.ecole} : ${s}`);
      assert.doesNotMatch(s, /École exemple|Exempleville|مدرسة مثال/, `${c.qui.ecole} : ${s}`);
    }
  }
  // En clair, pour l'ENSA Fès (et ce que l'arabe n'a pas su traduire, relevé à partir d'ici)
  missing.clear();
  const fes = await sorties(L.nomsAPartagerDe({ ecoles: ECOLES }, { ecole: 'ensa-fes' }));
  assert.equal(fes['agenda fr 0'].details, 'Venez nombreux.\n\nLien : https://meet.exemple.ma/forum\n\nRéseau ENSA Fès');
  assert.equal(fes['mentorat fr 0'].title, 'Mentorat Réseau ENSA Fès : Préparer mon entretien');
  assert.equal(fes['entretien ar 0'].title, 'مقابلة · شبكة ENSA فاس: Karim Alaoui');
  assert.equal(fes['annee fr 2'], 'Mon année 2025-2026 sur le Réseau ENSA Fès : 40 points d’impact, 1 recruté grâce à toi. Fier d’aider les étudiants de l’école.');
  assert.match(lisible(fes)['linkedin 0'], /&name=Attestation de contribution · Réseau ENSA Fès&organizationName=Réseau ENSA Fès&/);
  assert.deepEqual(fes.attestation[0].slice(0, 4), ['Réseau ENSA Fès', 'Lauréats & étudiants', 'Attestation de contribution', 'La plateforme Réseau ENSA Fès atteste que']);
  assert.match(fes['partage etu p4'], /\n\nMerci à Karim Alaoui \(ENSA Fès\), qui m’a ouvert la porte grâce au Réseau ENSA Fès\.\n\n#ENSAFès$/);
  assert.match(fes['partage lau p2'], /^C’est une joie d’accueillir un talent de l’ENSA Fès chez Lear/);
  assert.deepEqual(fes['bilan 1'], { org: 'Réseau ENSA Fès', titre: 'OCP · 3 lauréats de l’ENSA Fès' });
  // En arabe, dans l'application : le nom arabe de l'école, traduit sans rien laisser en français
  assert.deepEqual(fes['attestation ar'][0].slice(0, 4), ['شبكة ENSA فاس', 'الخريجون والطلبة', 'شهادة مساهمة', 'تشهد منصة شبكة ENSA فاس أن']);
  assert.deepEqual(fes['bilan ar 1'], { org: 'شبكة ENSA فاس', titre: '⁨OCP⁩ · 3 خريجين من ENSA فاس' });
  assert.equal(fes['bilan ar 0'].titre, '⁨OCP⁩ · خريج واحد من ENSA فاس');
  const fst = await sorties(L.nomsAPartagerDe({ ecoles: ECOLES }, { ecole: 'fst-settat' }));
  assert.deepEqual(fst['bilan 3'], { org: 'Réseau FST Settat', titre: 'Nadia Tazi' });
  assert.deepEqual(fst['bilan ar 1'], { org: 'شبكة FST Settat', titre: '⁨OCP⁩ · 3 خريجين من FST Settat' });
  const fermee = await sorties(L.nomsAPartagerDe({ ecoles: ECOLES }, { ecole: 'ecole-exemple' }));
  assert.deepEqual(fermee['attestation ar'][1].slice(0, 4), ['شبكة ENSAM', 'الخريجون والطلبة', 'شهادة مساهمة', 'تشهد منصة شبكة ENSAM أن']);
  assert.deepEqual(fermee['bilan ar 3'], { org: 'شبكة ENSAM', titre: 'Nadia Tazi' });
  assert.deepEqual([...missing].filter(s => /Réseau|atteste|lauréats? de l’/.test(s)), []);
});

test('mots-dièse d’une réussite partagée : ceux d’avant pour l’ENSAM Meknès ; son nom en un mot pour une autre école ; jamais #ENSAMMeknès', () => {
  assert.equal(L.diesesEcole(), '#ENSAM #ENSAMMeknès #ArtsEtMétiers');
  assert.equal(L.diesesEcole(L.NOMS_MEKNES), '#ENSAM #ENSAMMeknès #ArtsEtMétiers');
  const d = (ecoles, slug) => L.diesesEcole(L.nomsAPartager(ecoles, slug));
  assert.equal(d(ECOLES, 'ensam-meknes'), '#ENSAM #ENSAMMeknès #ArtsEtMétiers');
  assert.equal(d(ECOLES, 'ensa-fes'), '#ENSAFès');
  assert.equal(d(ECOLES, 'fst-settat'), '#FSTSettat');
  assert.equal(d(ECOLES, 'ensam-casablanca'), '#ENSAM #ENSAMCasablanca #ArtsEtMétiers');
  assert.equal(d([{ slug: 'x-y', nom: 'Institut d’ingénierie exemple', ouverte: true }], 'x-y'), '#InstitutDIngénierieExemple');
  assert.equal(d([{ slug: 'x-y', nom_court: 'EST', ville: 'Oujda', ouverte: true }], 'x-y'), '#ESTOujda');
  for (const [e, slug] of [[ECOLES, 'ecole-exemple'], [ECOLES, 'ecole-inconnue'], [[], 'ensa-fes'], [undefined, 'ensa-fes'], [[{ ...FES, ouverte: false }], 'ensa-fes']]) assert.equal(d(e, slug), '#ENSAM', slug);
});

test('les textes de l’ENSAM Meknès ne bougent pas après ceux d’autres écoles (leur arabe n’est donné qu’à leurs noms)', async () => {
  for (const c of CAS) await sorties(L.nomsAPartagerDe({ ecoles: ECOLES }, c.qui));
  assert.equal(empreinte(await sorties(undefined)), AVANT);
  await setLang('ar');
  assert.equal(t('Réseau ENSAM'), 'شبكة ENSAM');
  assert.equal(t('Réseau ENSAM Meknès'), 'شبكة ENSAM مكناس');
  assert.equal(t('La plateforme Réseau ENSAM Meknès atteste que'), 'تشهد منصة شبكة ENSAM مكناس أن');
  await setLang('fr');
});
