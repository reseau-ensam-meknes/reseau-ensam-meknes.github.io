// Plan · partie membres : « 3 lauréats peuvent t'aider » sous une demande, l'invitation nommée, « Pionnier de sa promo »,
// « +1 depuis ta dernière visite », et ce que la page d'entrée montre avec l'accord des membres (visages, réussites).
// Les mêmes règles sont dans schema.sql (tests/sql/test-plan-membres.mjs) ; ici, la logique, la démo et le mode en ligne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  pionniersOf, NB_PIONNIERS, badgesOf, PIONNIER_MOI, haussesDepuisVisite, codeInvitationValide, lienAvecCode, ligneInvites, invitesDe,
  nomCourt, visagesPublics, reussitesPubliques, laureatsPourMesDemandes, laureatsPourDemande, BESOIN_DE_DEMANDE,
} from '../../src/logic.js';
import { buildSeed } from '../../src/seed.js';
import { SupabaseStore } from '../../src/store.js';

const jour = j => new Date(Date.UTC(2026, 9, j, 9)).toISOString();
const L = (id, promo, j, x = {}) => ({ id, role: 'laureat', full_name: `${id} Nom`, promo, filiere: 'Génie Mécanique', created_at: jour(j), ...x });

test('Pionnier : les 3 premiers lauréats de chaque promo et de chaque école, jamais l’administration ni un étudiant', () => {
  const profiles = [
    L('a', 2019, 5), L('b', 2019, 2), L('c', 2019, 9), L('d', 2019, 1, { admin_ok: true }), L('e', 2019, 12),
    { id: 'adm', role: 'admin', promo: 2019, created_at: jour(1) }, { id: 'etu', role: 'etudiant', promo: 2019, created_at: jour(1) },
    L('f', 2020, 20), L('g', 2019, 3, { ecole: 'ensa-fes' }), L('h', null, 1), L('i', 2019, 9, { id: 'b2' }),
  ];
  const p = pionniersOf(profiles);
  assert.equal(NB_PIONNIERS, 3);
  // 2019 à Meknès : b (2), a (5), puis c et b2 le même jour : l'id départage (« b2 » avant « c »)
  assert.deepEqual([...p].sort(), ['a', 'b', 'b2', 'f', 'g'].sort());
  assert.ok(!p.has('d') && !p.has('adm') && !p.has('etu') && !p.has('h') && !p.has('e') && !p.has('c'));
  assert.equal(pionniersOf(profiles), p, 'calculé une fois pour la même liste');
  assert.deepEqual([...pionniersOf(null)], []);
  // Un badge, rien d'autre : le nom vu par les autres, et « de ta promo » pour soi
  const b = badgesOf({ points: 0 }, profiles[0], { pionniers: p }).find(x => x.id === 'pionnier');
  assert.deepEqual([b.nom, b.desc], ['Pionnier de sa promo', 'Parmi les 3 premiers lauréats de sa promo à rejoindre le réseau']);
  assert.equal(PIONNIER_MOI.nom, 'Pionnier de ta promo');
  assert.ok(!badgesOf({ points: 0 }, profiles[2], { pionniers: p }).some(x => x.id === 'pionnier'));
  assert.doesNotMatch(JSON.stringify([b, PIONNIER_MOI]), /place|reste|point|\d+ jours/i);
});

test('« +1 depuis ta dernière visite » : rien la première fois, seulement ce qui a augmenté', () => {
  assert.deepEqual(haussesDepuisVisite(null, { mercis: 4 }), {});
  assert.deepEqual(haussesDepuisVisite(undefined, { mercis: 4 }), {});
  assert.deepEqual(haussesDepuisVisite([], { mercis: 4 }), {});
  assert.deepEqual(haussesDepuisVisite({ mercis: 3, recrutes: 2, mentorats: 5 }, { mercis: 4, recrutes: 2, mentorats: 4 }), { mercis: 1 });
  assert.deepEqual(haussesDepuisVisite({ mercis: '3', recrutes: null }, { mercis: 4, recrutes: 1, nouveau: 2 }), {}, 'illisible ou inconnu : rien');
  assert.deepEqual(haussesDepuisVisite({ recrutes: 0 }, { recrutes: 3 }), { recrutes: 3 });
});

test('invitation nommée : un code de 8 caractères, ajouté au lien de la promo ; jamais un code mal formé', () => {
  for (const c of ['nadia219', 'abcd2345']) assert.ok(codeInvitationValide(c), c);
  for (const c of ['Nadia219', 'abc', 'abcd23456', 'abcd-234', '', null, 12345678]) assert.ok(!codeInvitationValide(c), String(c));
  assert.equal(lienAvecCode('https://r.io/promo/2019/', 'nadia219'), 'https://r.io/promo/2019/?de=nadia219');
  assert.equal(lienAvecCode('https://r.io/?promo=2019&lang=ar', 'nadia219'), 'https://r.io/?promo=2019&lang=ar&de=nadia219');
  assert.equal(lienAvecCode('https://r.io/promo/2019/?de=autre234', 'nadia219'), 'https://r.io/promo/2019/?de=nadia219', 'un seul code');
  assert.equal(lienAvecCode('https://r.io/promo/2019/', null), 'https://r.io/promo/2019/');
  assert.equal(lienAvecCode('https://r.io/promo/2019/', 'pas bon'), 'https://r.io/promo/2019/');
  assert.equal(ligneInvites(0), '');
  assert.equal(ligneInvites(1), '1 camarade est arrivé grâce à toi');
  assert.equal(ligneInvites(3), '3 camarades sont arrivés grâce à toi');
});

test('camarades arrivés grâce à un membre : combien, et les prénoms des 20 derniers, de la même école', () => {
  const moi = { id: 'moi', full_name: 'Nadia Ferhat', role: 'laureat' };
  const invites = Array.from({ length: 22 }, (_, i) => ({ id: 'i' + i, full_name: `Prenom${i} Nom`, invite_par: 'moi', created_at: jour(1 + i) }));
  const r = invitesDe([moi, ...invites, { id: 'x', full_name: 'Autre École', invite_par: 'moi', ecole: 'ensa-fes', created_at: jour(30) }, { id: 'y', full_name: 'Pas Invité', created_at: jour(30) }], 'moi');
  assert.equal(r.n, 22);
  assert.equal(r.prenoms.length, 20);
  assert.equal(r.prenoms[0], 'Prenom21', 'le plus récent d’abord');
  assert.deepEqual(invitesDe([moi], 'moi'), { n: 0, prenoms: [] });
  assert.deepEqual(invitesDe([], 'inconnu'), { n: 0, prenoms: [] });
});

test('page d’entrée : seulement les lauréats qui ont dit oui, de l’école du visiteur ; « Nadia F. », la photo d’abord', () => {
  assert.equal(nomCourt('Nadia Ferhat'), 'Nadia F.');
  assert.equal(nomCourt('  nadia   el ferhat '), 'nadia E.');
  assert.equal(nomCourt('Nadia'), 'Nadia');
  assert.equal(nomCourt(''), '');
  const profiles = [
    L('sans-photo', 2019, 1, { full_name: 'Amal Idrissi', vitrine_publique: true, entreprise: ' OCP ' }),
    L('photo', 2020, 9, { full_name: 'Nadia Ferhat', vitrine_publique: true, photo_path: 'photo/p.webp' }),
    L('non', 2019, 1, { full_name: 'Non Merci', vitrine_publique: false, photo_path: 'non/p.webp' }),
    L('pas-repondu', 2019, 1, { full_name: 'Pas Repondu', vitrine_publique: null }),
    L('adm', 2019, 1, { full_name: 'Admin Vue', vitrine_publique: true, admin_ok: true }),
    { id: 'etu', role: 'etudiant', full_name: 'Etu Diant', vitrine_publique: true },
    L('fes', 2019, 1, { full_name: 'Fes Lau', vitrine_publique: true, ecole: 'ensa-fes' }),
  ];
  assert.deepEqual(visagesPublics(profiles), [
    { nom: 'Nadia F.', promo: 2020, entreprise: null, photo: 'photo/p.webp' },
    { nom: 'Amal I.', promo: 2019, entreprise: 'OCP', photo: null },
  ]);
  assert.deepEqual(visagesPublics(profiles, 'ensa-fes').map(v => v.nom), ['Fes L.']);
  const beaucoup = Array.from({ length: 30 }, (_, i) => L('v' + i, 2019, 1, { vitrine_publique: true }));
  assert.equal(visagesPublics(beaucoup).length, 24);
});

test('réussites montrées : confirmées, les deux cases cochées, la même école ; l’entreprise, deux prénoms, la promo, le mois', () => {
  const profiles = [
    { id: 's1', role: 'etudiant', full_name: 'Salma Bennani' }, { id: 'l1', role: 'laureat', full_name: 'Youssef El Amrani', promo: 2016 },
    { id: 's2', role: 'etudiant', full_name: 'Amine Talbi', ecole: 'ensa-fes' },
  ];
  const pl = (id, x) => ({ id, student_id: 's1', laureat_id: 'l1', status: 'confirme', entreprise: 'OCP', public_etudiant: true, public_laureat: true, confirmed_at: '2026-10-12T10:00:00Z', ...x });
  const data = { profiles, placements: [
    pl('ok'), pl('un-seul', { public_laureat: false }), pl('attente', { status: 'en_attente' }), pl('sans-laureat', { laureat_id: null }),
    pl('autre-ecole', { student_id: 's2' }), pl('plus-recent', { entreprise: ' Renault ', confirmed_at: '2026-10-20T10:00:00Z' }),
  ] };
  assert.deepEqual(reussitesPubliques(data), [
    { entreprise: 'Renault', etudiant: 'Salma', laureat: 'Youssef', promo: 2016, mois: '2026-10' },
    { entreprise: 'OCP', etudiant: 'Salma', laureat: 'Youssef', promo: 2016, mois: '2026-10' },
  ]);
  assert.deepEqual(reussitesPubliques({ profiles, placements: [] }), []);
});

test('« 3 lauréats peuvent t’aider » : sous chaque demande ouverte d’un étudiant, jamais deux fois le même lauréat', () => {
  const d = buildSeed();
  const etu = d.profiles.find(p => p.full_name === 'Douae Idrissi');
  const ouverte = d.demandes.find(x => x.auteur_id === etu.id && x.status === 'ouverte');
  const deux = { ...ouverte, id: 'dm-deux', type: 'stage', titre: 'Stage d’été', created_at: ouverte.created_at };
  const pourvue = { ...ouverte, id: 'dm-fin', status: 'pourvue' };
  const pause = { ...ouverte, id: 'dm-pause', created_at: '2020-01-01T00:00:00Z', relancee_at: null };
  const data = { ...d, demandes: [...d.demandes, deux, pourvue, pause] };
  const r = laureatsPourMesDemandes(data, etu, [ouverte, deux, pourvue, pause]);
  assert.deepEqual([...r.keys()], [ouverte.id, deux.id], 'ni une demande pourvue, ni une demande en pause');
  const a = r.get(ouverte.id).map(x => x.p.id), b = r.get(deux.id).map(x => x.p.id);
  assert.ok(a.length > 0 && a.length <= 3 && b.length <= 3);
  assert.deepEqual(a.filter(id => b.includes(id)), [], 'jamais deux fois le même');
  for (const x of [...r.get(ouverte.id), ...r.get(deux.id)]) {
    assert.equal(x.p.role, 'laureat'); assert.ok(!x.p.admin_ok); assert.ok(Array.isArray(x.why));
  }
  // Un lauréat déjà sollicité (conseil en attente) laisse sa place au suivant
  const premier = r.get(ouverte.id)[0].p;
  const avec = { ...data, mentorships: [...data.mentorships, { id: 'm-x', student_id: etu.id, mentor_id: premier.id, status: 'demande', created_at: new Date().toISOString() }] };
  assert.ok(!laureatsPourMesDemandes(avec, etu, [ouverte]).get(ouverte.id).some(x => x.p.id === premier.id));
  // Moins de 3 : ceux qui existent ; aucun : rien
  const seul = { ...data, profiles: data.profiles.filter(p => p.role !== 'laureat' || p.id === premier.id) };
  assert.ok(laureatsPourMesDemandes(seul, etu, [ouverte]).get(ouverte.id).length <= 1);
  // Un lauréat qui a sa propre demande d'emploi ne reçoit pas ce bloc ; le besoin du conseil suit le type de la demande
  const lau = d.profiles.find(p => p.role === 'laureat');
  assert.equal(laureatsPourMesDemandes(data, lau, [{ ...ouverte, auteur_id: lau.id }]).size, 0);
  assert.deepEqual(BESOIN_DE_DEMANDE, { stage: 'stage', pfe: 'stage', etranger: 'etranger', emploi: 'carriere' });
  assert.ok(laureatsPourDemande(data, ouverte, 3).length <= 3);
});

// La démo applique les règles de la base : chaque membre a son code ; personne ne choisit qui l'a invité ;
// seul le lauréat lui-même dit oui pour la page d'entrée ; chacun ne coche que sa case d'une réussite
async function demo() {
  globalThis.window ??= {};
  globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const { createStore } = await import('../../src/store.js');
  return createStore();
}
test('démo · invitation nommée : le code de chaque persona, qui invite (même école), et les camarades arrivés', async () => {
  const s = await demo();
  const youssef = s.data.profiles.find(p => p.full_name === 'Youssef El Amrani');
  s.switchTo(youssef.id);
  assert.equal(await s.monCodeInvitation(), 'youssef6');
  assert.deepEqual(await s.invitationDe('youssef6'), { prenom: 'Youssef', promo: 2016, role: 'laureat' });
  assert.equal(await s.invitationDe('youssef6', 'ensa-fes'), null, 'une autre école ne le trouve pas');
  assert.equal(await s.invitationDe('inconnu2'), null);
  const inv = await s.mesInvites();
  assert.equal(inv.n, 2);
  assert.equal(new Set(s.data.profiles.filter(p => p.code_invitation).map(p => p.code_invitation)).size, s.data.profiles.filter(p => p.code_invitation).length, 'des codes uniques');
  // Un membre sans code en reçoit un, stable ensuite ; il ne choisit ni son code ni qui l'a invité
  const autre = s.data.profiles.find(p => p.role === 'laureat' && !p._persona && !p.code_invitation);
  s.switchTo(autre.id);
  const c = await s.monCodeInvitation();
  assert.ok(codeInvitationValide(c) && !/[lo01]/.test(c));
  assert.equal(await s.monCodeInvitation(), c);
  await s.update('profiles', autre.id, { code_invitation: 'choisi22', invite_par: youssef.id });
  assert.equal(s.byId('profiles', autre.id).code_invitation, c);
  assert.equal(s.byId('profiles', autre.id).invite_par, null);
});

test('démo · page d’entrée : oui du lauréat lui-même seulement ; une réussite, chacun sa case, confirmée seulement', async () => {
  const s = await demo();
  const youssef = s.data.profiles.find(p => p.full_name === 'Youssef El Amrani');
  const salma = s.data.profiles.find(p => p.full_name === 'Salma Bennani');
  s.switchTo(salma.id);
  await s.changerVitrine(true);
  assert.notEqual(s.byId('profiles', salma.id).vitrine_publique, true, 'un étudiant ne le donne pas');
  s.switchTo(youssef.id);
  await s.changerVitrine(true);
  assert.equal(await s.monAccordVitrine(), true);
  assert.ok((await s.visagesPublics()).some(v => v.nom === 'Youssef E.'));
  await s.changerVitrine(false, true);
  assert.equal(await s.monAccordVitrine(), false);
  // Les recrues de Youssef : sa case, jamais celle de l'étudiant
  const pl = s.data.placements.find(p => p.laureat_id === youssef.id && p.status === 'confirme');
  assert.deepEqual(await s.montrerReussite(pl.id, true), { public_etudiant: false, public_laureat: true });
  await s.update('placements', pl.id, { public_etudiant: true }).catch(() => {});
  assert.equal(s.byId('placements', pl.id).public_etudiant, false, 'personne ne coche la case de l’autre');
  const attente = s.data.placements.find(p => p.laureat_id === youssef.id && p.status === 'en_attente');
  await assert.rejects(s.montrerReussite(attente.id, true), /confirmée/);
  s.switchTo(salma.id);
  await assert.rejects(s.montrerReussite(pl.id, true), /revient à l’étudiant et au lauréat/);
  // Une réussite créée naît sans case cochée
  const r = await s.insert('placements', { student_id: salma.id, laureat_id: youssef.id, entreprise: 'OCP', type: 'stage', saison: 2026, status: 'en_attente', public_etudiant: true, public_laureat: true });
  assert.deepEqual([r.public_etudiant, r.public_laureat], [false, false]);
  assert.equal((await s.reussitesPubliques()).length, 3, 'les trois réussites de démonstration');
});

// En ligne : le oui retiré pour la page d'entrée renomme la photo, comme pour un fondateur
function magasinPhoto({ copieOk = true } = {}) {
  const U = '11111111-1111-4111-8111-111111111111';
  const s = new SupabaseStore({ supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k' });
  const journal = [];
  s.session = { user: { id: U } };
  s.data.profiles = [{ id: U, full_name: 'Lauréat Visage', role: 'laureat', photo_path: `${U}/photo-1.webp` }];
  s.me = s.data.profiles[0];
  s.sb = {
    from: () => ({ update: patch => ({ eq: () => ({ select: () => ({ single: async () => { journal.push(['profil', patch]); return { data: { ...s.data.profiles[0], ...patch }, error: null }; } }) }) }) }),
    storage: { from: b => ({
      copy: async (de, vers) => { journal.push(['copie', b, de, vers]); return copieOk ? { data: { path: vers }, error: null } : { data: null, error: { message: 'Object not found' } }; },
      remove: async l => { journal.push(['suppression', b, ...l]); return { data: l, error: null }; },
    }) },
    rpc: async (nom, args) => { journal.push(['rpc', nom, args]); return nom === 'montrer_reussite' ? { data: { public_etudiant: false, public_laureat: !!args.p_oui }, error: null } : nom === 'mon_code_invitation' ? { data: 'abcd2345', error: null } : nom === 'mes_invites' ? { data: { n: 2, prenoms: ['Rachid', 7] }, error: null } : { data: null, error: { message: 'x' } }; },
  };
  s.emit = () => {};
  return { s, journal, U };
}
test('en ligne : retirer son oui renomme la photo (l’ancien lien ne mène plus à rien) ; sans oui avant, rien à renommer', async () => {
  const a = magasinPhoto();
  await a.s.changerVitrine(false, true);
  const [copie, profil, suppression] = a.journal;
  assert.equal(copie[0], 'copie');
  assert.deepEqual(profil, ['profil', { vitrine_publique: false, photo_path: copie[3] }]);
  assert.deepEqual(suppression, ['suppression', 'photos', `${a.U}/photo-1.webp`]);
  const b = magasinPhoto();
  await b.s.changerVitrine(false, false);
  assert.deepEqual(b.journal, [['profil', { vitrine_publique: false }]]);
  const c = magasinPhoto();
  await c.s.changerVitrine(true);
  assert.deepEqual(c.journal, [['profil', { vitrine_publique: true }]]);
});

test('en ligne : le code (une seule fois par visite), les camarades, la case d’une réussite par la fonction de la base', async () => {
  const { s, journal } = magasinPhoto();
  s.data.placements = [{ id: 'pl1', status: 'confirme', public_etudiant: false, public_laureat: false }];
  assert.equal(await s.monCodeInvitation(), 'abcd2345');
  assert.equal(await s.monCodeInvitation(), 'abcd2345');
  assert.equal(journal.filter(x => x[1] === 'mon_code_invitation').length, 1);
  assert.deepEqual(await s.mesInvites(), { n: 2, prenoms: ['Rachid'] });
  assert.deepEqual(await s.montrerReussite('pl1', true), { public_etudiant: false, public_laureat: true });
  assert.deepEqual(journal.find(x => x[1] === 'montrer_reussite'), ['rpc', 'montrer_reussite', { p_id: 'pl1', p_oui: true }]);
  assert.equal(s.data.placements[0].public_laureat, true);
});

test('page de la promo : le code de qui invite suit le lien vers le site (jamais un code mal formé)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-'));
  fs.writeFileSync(path.join(tmp, 'index.html'), '<meta property="og:image" content="https://r.io/img/apercu.jpg">');
  execFileSync('node', ['outils/pages-promo.mjs', tmp], { cwd: new URL('../../', import.meta.url).pathname, stdio: 'pipe' });
  const page = fs.readFileSync(path.join(tmp, 'promo/2019/ar/index.html'), 'utf8');
  fs.rmSync(tmp, { recursive: true, force: true });
  const script = page.match(/<script>([\s\S]*?)<\/script>/)[1];
  const vers = search => { let url = null; new Function('location', script)({ search, hash: '#x', replace: u => { url = u; } }); return url; };
  assert.equal(vers('?de=nadia219'), '../../../?promo=2019&lang=ar&de=nadia219#x');
  assert.equal(vers('?utm=1&de=nadia219'), '../../../?promo=2019&lang=ar&de=nadia219#x');
  assert.equal(vers('?de=<script>'), '../../../?promo=2019&lang=ar#x');
  assert.equal(vers(''), '../../../?promo=2019&lang=ar#x');
  // Le service worker, qui remplace cette page pour un visiteur déjà venu, le garde aussi
  const sw = fs.readFileSync(new URL('../../src/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /searchParams\.get\('de'\)/);
});

test('page d’entrée : « Invitation de Nadia · promo 2019 », les réussites et le mois, en français et en arabe (prénoms tels qu’écrits)', async () => {
  globalThis.window ??= {}; window.ENSAM_ENTREE = true;
  globalThis.document ??= { documentElement: {} };
  document.querySelector ??= () => true;
  const { ligneInvitation } = await import('../../src/entree.js');
  const v = await import('../../src/entree-vitrine.js');
  assert.equal(ligneInvitation({ prenom: 'Nadia', promo: 2019 }, false), 'Invitation de Nadia · promo 2019');
  assert.equal(ligneInvitation({ prenom: 'Nadia', promo: 2019 }, true), 'دعوة من ⁨Nadia⁩ · دفعة 2019');
  assert.equal(ligneInvitation({ prenom: 'نادية', promo: null }, true), 'دعوة من ⁨نادية⁩');
  assert.equal(ligneInvitation(null), '');
  assert.equal(v.moisReussite('2026-10'), 'octobre 2026');
  assert.equal(v.moisReussite('2026-10', true), 'أكتوبر 2026');
  assert.equal(v.moisReussite('n’importe'), '');
  const r = { etudiant: 'Salma', laureat: 'Youssef', promo: 2016 };
  assert.equal(v.phraseReussite(r), 'Salma, avec l’aide de Youssef (promo 2016)');
  assert.equal(v.phraseReussite(r, true), '⁨Salma⁩، بمساعدة ⁨Youssef⁩ (دفعة 2016)');
  // Ce que la base rend est relu : une ligne incomplète ne s'affiche pas
  assert.deepEqual(v.lireVisages([{ nom: ' Nadia F. ', promo: 2019, entreprise: ' ', photo: 'p/1.webp' }, { nom: '' }, null, 'x', { nom: 'Amal I.', promo: 1800 }]),
    [{ nom: 'Nadia F.', promo: 2019, entreprise: null, photo: 'p/1.webp' }, { nom: 'Amal I.', promo: null, entreprise: null, photo: null }]);
  assert.deepEqual(v.lireReussites([{ entreprise: 'OCP', etudiant: 'Salma', laureat: 'Youssef', promo: 2016, mois: '2026-10' }, { entreprise: 'OCP', etudiant: 'Salma' }]).length, 1);
  assert.deepEqual(v.lireVisages(null), []);
});
