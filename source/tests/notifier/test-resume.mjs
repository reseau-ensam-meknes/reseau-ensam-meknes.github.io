import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MODULE, SITE } from './banc.mjs';
import { ID, jeu, brut } from './donnees.mjs';

const N = await import(MODULE);
const NOW = new Date('2026-10-20T09:00:00Z');   // mardi
const J = jeu(NOW);
const D = N.indexer(brut(J), NOW);
const profil = id => D.profils.get(id);
const resume = id => N.resumeDe(profil(id), D);
const TOKEN = '6f1c2b8e-3d4a-4f5b-9c7d-0e1f2a3b4c5d';

test('étudiante 4A : à faire, offres, réponses, cafés', () => {
  assert.equal(J.S, 2026);
  const r = resume(ID.salma);
  assert.equal(r.role, 'etudiant');
  assert.equal(r.prenom, 'Salma');
  assert.deepEqual(r.aConfirmer, [{ entreprise: 'OCP', nom: 'Youssef Alami' }]);
  // Invitation sur une offre ouverte non postulée seulement (pas pourvue, pas déjà postulée, pas déclinée)
  assert.deepEqual(r.invitations, [{ nom: 'Youssef Alami', titre: 'Stage supply chain', entreprise: 'OCP' }]);
  assert.deepEqual(r.rdv.map(x => x.sujet), ['Préparer mon entretien chez Renault']);
  assert.equal(r.rdv[0].nom, 'Nadia Benali');
  assert.deepEqual(r.aClore, [{ nom: 'Youssef Alami', sujet: 'Relire mon CV' }]);
  // Offres : ouvertes, < 7 jours, audience étudiants, niveau 4, filière vide ou GI
  assert.equal(r.offres.total, 4);
  assert.deepEqual(r.offres.liste.map(o => o.titre), ['Stage lean manufacturing', 'Stage maintenance prédictive', 'Stage énergie solaire <PV> & stockage']);
  // Réponses des autres, des 7 derniers jours, y compris sur une vieille question
  assert.deepEqual(r.reponses.map(x => [x.titre, x.n]).sort(), [['Où trouver un stage ouvrier ?', 1], ['Quels logiciels apprendre avant un stage chez Renault ?', 2]]);
  assert.equal(r.parrain, '');
  // Cafés : « casablanca » avec espaces, ni annulé, ni dans 20 jours, ni à Rabat
  assert.deepEqual(r.cafes.map(c => c.lieu), ['Café Bianca, Maârif', 'Morocco Mall, terrasse']);
  assert.equal(r.candidatures, 0);
  assert.equal(r.talents.total, 0);
});

test('étudiant 3A : parrain de la semaine et café dans sa ville (accents ignorés)', () => {
  const r = resume(ID.amine);
  assert.equal(r.parrain, 'Youssef Alami');
  assert.deepEqual(r.cafes.map(c => c.lieu), ['Place El Hedim']);
  assert.equal(r.offres.total, 0);   // l'offre 3A/4A est pourvue
  const m = N.rendreResume(r, 'fr', SITE, TOKEN);
  assert.equal(m.sujet, 'Ton parrain cette année : Youssef Alami · Réseau ENSAM');
});

test('lauréat : candidatures, demandes, questions routées, relance, talents, impact, filleul', () => {
  const r = resume(ID.youssef);
  assert.equal(r.role, 'laureat');
  assert.equal(r.candidatures, 3);   // postule seulement, sur ses offres
  assert.deepEqual(r.demandes, [{ nom: 'Imane Chraibi', sujet: 'Relire mon CV avant le forum' }]);
  assert.deepEqual(r.aClore, [{ nom: 'Salma Idrissi', sujet: 'Relire mon CV' }]);
  // « OCP S.A. » rejoint « OCP Group » ; la question déjà répondue et la vieille question sont écartées
  assert.deepEqual(r.questions, [{ titre: 'Comment se passe le stage ouvrier chez OCP ?', cible: 'OCP S.A.' }]);
  assert.deepEqual(r.relances, ['Stage BI & reporting']);
  assert.equal(r.offres.total, 0);   // pas jeune diplômé
  // Talents GI : 3A-5A, vitrine, sans réussite cette saison ; nouveaux d'abord, puis ceux qui ont un CV
  assert.equal(r.talents.total, 5);
  assert.deepEqual(r.talents.liste.map(t => [t.prenom, t.niveau, t.nouveau]), [['Amine', 3, true], ['Leila', 3, false], ['Sara', 4, false]]);
  assert.deepEqual(r.talents.liste[2].competences, ['Python', 'Power BI', 'SQL']);
  // Demandes ouvertes d'étudiants GI, les plus anciennes d'abord
  assert.deepEqual(r.ouvertes, { total: 2, sujets: ['Choisir mon stage de 3A', 'Préparer un entretien technique'] });
  assert.equal(r.impact.recrutements, 1);
  assert.equal(r.impact.mercis, 2);
  assert.equal(r.impact.citation.prenom, 'Hiba');
  assert.deepEqual(r.filleuls, ['Amine Tazi']);
  assert.deepEqual(r.cafes.map(c => c.lieu), ['Café Bianca, Maârif']);   // pas son propre café
});

test('lauréats : question routée par pays (hors Maroc), jeune diplômé, résumé vide', () => {
  assert.deepEqual(resume(ID.ghita).questions, [{ titre: 'Visa pour un stage en France : par où commencer ?', cible: 'France' }]);
  const k = resume(ID.kenza);
  assert.equal(k.offres.total, 1);
  assert.equal(k.offres.liste[0].titre, 'Ingénieur méthodes junior');
  const n = resume(ID.nadia);
  assert.equal(n.candidatures, 1);
  assert.equal(n.rdv.length, 1);
  assert.deepEqual(n.questions, []);   // elle a déjà répondu
  assert.equal(resume(ID.hamza), null);
  assert.equal(resume(ID.rachid), null);
});

test('arrivées : sa promo et sa filière, jamais une autre année ; jamais soi-même', () => {
  const p3 = profil(ID.amine).promo;
  assert.deepEqual(resume(ID.leila).arrivees, { total: 1, liste: [{ nom: 'Amine Tazi', promo: p3, niveau: 3 }], reseau: { laureats: 1, etudiants: 1 } });
  assert.equal(resume(ID.salma).arrivees.total, 0, 'une étudiante de 4A ne voit pas les 3A');
  assert.deepEqual(resume(ID.nadia).arrivees.liste, [{ nom: 'Ghita Berrada', promo: 2019, niveau: 0 }], 'même parcours (Génie Énergétique)');
  assert.ok(resume(ID.youssef).arrivees.liste.some(x => x.nom === 'Amine Tazi'), 'un lauréat voit les étudiants de sa filière');
  assert.ok(!resume(ID.amine).arrivees.liste.some(x => x.nom === 'Amine Tazi'));
  assert.equal(resume(ID.hamza), null);
});

test('arrivées seules : un résumé calme, qui nomme l’arrivée, sans ville ni email', () => {
  const m = N.rendreResume(resume(ID.leila), 'fr', SITE, TOKEN);
  assert.equal(m.sujet, 'Amine Tazi vient d’arriver sur le réseau · Réseau ENSAM');
  assert.equal(N.rendreResume(resume(ID.leila), 'ar', SITE, TOKEN).sujet, 'انضمام جديد إلى الشبكة: Amine Tazi · شبكة ENSAM');
  assert.ok(m.texte.includes('Rien à faire cette semaine. Voici qui vient d’arriver.'));
  assert.ok(m.texte.includes('Amine Tazi · 3A'));
  assert.ok(m.texte.includes('#reseau/annuaire'));
  assert.ok(m.texte.includes('Dans tout le réseau : 1 lauréat et 1 étudiant de plus cette semaine.'));
  // Rien d'autre sur la personne : ni sa ville (Meknès), ni son email, ni des points
  const section = m.texte.slice(m.texte.indexOf('NOUVEAUX SUR LE RÉSEAU'), m.texte.indexOf('Voir l’annuaire'));
  assert.doesNotMatch(section, /Meknès|@|points/);
  // Au plus 5 noms, puis « Et N de plus. »
  const j = jeu(NOW);
  const p3 = j.tables.profiles.find(p => p.id === ID.amine).promo;
  for (let i = 0; i < 7; i++) j.tables.profiles.push({ ...j.tables.profiles.find(p => p.id === ID.amine), id: `00000000-0000-4000-8000-0000000009${i}0`, full_name: `Nouveau ${i}`, promo: p3, created_at: new Date(NOW.getTime() - 864e5).toISOString() });
  const d = N.indexer(brut(j), NOW);
  const r = N.resumeDe(d.profils.get(ID.leila), d);
  assert.equal(r.arrivees.total, 8); assert.equal(r.arrivees.liste.length, 5);
  assert.ok(N.rendreResume(r, 'fr', SITE, TOKEN).texte.includes('Et 3 de plus.'));
});

test('filières officielles : talents et offres rapprochés par parcours', () => {
  // Un lauréat « Mécatronique » (ancienne appellation, parcours électro-industriel) reçoit les talents de Génie Industriel
  const j = jeu(NOW);
  j.tables.profiles.find(p => p.id === ID.hamza).filiere = 'Mécatronique';
  // Une offre pour une seule filière actuelle : vue par les anciennes appellations du parcours, pas par une autre filière actuelle
  const d = N.indexer(brut(j), NOW);
  const h = N.resumeDe(d.profils.get(ID.hamza), d);
  assert.ok(h && h.talents.total >= 3, 'talents du parcours');
  const o = { filieres: ['Génie Industriel : Excellence Opérationnelle'] };
  const ok = N.filiereOk;
  assert.equal(ok(o, 'Génie Industriel : Excellence Opérationnelle'), true);
  assert.equal(ok(o, 'Génie Industriel'), true, 'ancienne appellation du même parcours');
  assert.equal(ok(o, 'Génie Industriel et Productique'), false, 'autre filière actuelle');
  assert.equal(ok(o, 'Génie Mécanique'), false, 'autre parcours');
  assert.equal(ok({ filieres: ['Génie Industriel'] }, 'Génie Électromécanique : Digitalisation Industrielle'), true, 'offre ancienne, étudiant actuel du parcours');
  assert.equal(ok({ filieres: [] }, 'Classes préparatoires intégrées'), true);
});

test('administration : comptes à vérifier, nouveaux membres, recrutements en attente', () => {
  const r = resume(ID.admin);
  assert.deepEqual(r.admin, { nonVerifies: 2, nouveaux: 2, enAttente: 1, signalements: 0 });
  const m = N.rendreResume(r, 'fr', SITE, TOKEN);
  assert.equal(m.sujet, '2 lauréats à vérifier · Réseau ENSAM');
  assert.match(m.html, /#admin/);
  // Rien à signaler : pas de résumé
  const vide = N.indexer({ ...brut(J), profils: [profil(ID.admin)], placements: [] }, NOW);
  assert.equal(N.resumeDe(profil(ID.admin), vide), null);
});

test('email français : objet, structure, échappement, désabonnement, version texte', () => {
  const m = N.rendreResume(resume(ID.salma), 'fr', SITE, TOKEN);
  assert.equal(m.sujet, 'Confirme ton recrutement chez OCP · Réseau ENSAM');
  assert.match(m.html, /^<!DOCTYPE html>/);
  assert.match(m.html, /<html lang="fr" dir="ltr">/);
  assert.match(m.html, /max-width:560px/);
  assert.match(m.html, /background:#1F3354/);
  assert.match(m.html, /background:#1670A8/);
  assert.match(m.html, /#F39200/);
  assert.match(m.html, /Bonjour Salma,/);
  assert.doesNotMatch(m.html, /<style|<script|class=|<PV>/i);
  // aucune image : le logo est la photo du compte expéditeur, pas une image dans l'email
  assert.doesNotMatch(m.html, /<img/i);
  assert.match(m.html, /Stage énergie solaire &lt;PV&gt; &amp; stockage/);
  assert.match(m.html, /mardi 20 octobre|jeudi 22 octobre à 17:30/);
  assert.match(m.html, new RegExp(`href="${SITE}#parcours"`));   // À faire : d'abord la confirmation
  for (const route of ['offres', 'reseau/entraide', 'reseau/groupes']) assert.ok(m.html.includes(`href="${SITE}#${route}"`), route);
  assert.equal(m.desabo, `${SITE}#desabo/${TOKEN}`);
  assert.ok(m.html.includes(`href="${SITE}#desabo/${TOKEN}"`));
  assert.match(m.html, />Se désabonner</);
  // Version texte
  assert.match(m.texte, /À FAIRE CETTE SEMAINE/);
  assert.match(m.texte, /Stage énergie solaire <PV> & stockage/);
  assert.ok(m.texte.includes(`Se désabonner : ${SITE}#desabo/${TOKEN}`));
  assert.ok(m.texte.includes(`Voir les offres : ${SITE}#offres`));
  assert.doesNotMatch(m.texte, /<strong>|&amp;/);
});

test('email arabe : rtl, textes arabes, contenu des membres tel quel', () => {
  const m = N.rendreResume(resume(ID.youssef), 'ar', SITE, TOKEN);
  assert.equal(m.sujet, '3 ترشيحات تنتظر ردك · شبكة ENSAM');
  assert.match(m.html, /<html lang="ar" dir="rtl">/);
  assert.match(m.html, /<body[^>]*dir="rtl"/);
  assert.match(m.html, /border-right:3px solid #F39200/);
  assert.match(m.html, /text-align:right/);
  assert.match(m.html, /مرحبًا Youssef،/);
  assert.match(m.html, /شبكة ENSAM مكناس/);
  assert.match(m.html, /تنبيه المواهب/);
  assert.match(m.html, /إلغاء الاشتراك/);
  assert.match(m.html, /<strong dir="auto">Amine<\/strong> · 3A · <span dir="auto">SolidWorks، Python<\/span> · انضم حديثًا/);
  // Contenu des membres isolé (sens de lecture) dans la version texte aussi
  assert.ok(m.texte.includes('سؤال حول \u2068OCP S.A.\u2069: \u2068Comment se passe le stage ouvrier chez OCP ?\u2069'));
  assert.doesNotMatch(N.rendreResume(resume(ID.salma), 'fr', SITE, TOKEN).texte, /[\u2068\u2069]/);
  // Les liens d'un email arabe ouvrent le site en arabe (pour qui n'a pas encore choisi sa langue)
  assert.ok(m.html.includes(`href="${SITE}?lang=ar#desabo/${TOKEN}"`));
  assert.ok(m.html.includes(`href="${SITE}?lang=ar#espace"`));
  assert.ok(m.html.includes(`href="${SITE}?lang=ar#reseau/talents"`));
  assert.ok(!N.rendreResume(resume(ID.salma), 'fr', SITE, TOKEN).html.includes('lang=ar'));
  assert.ok(N.rendreAlerte([{ id: 'o1', titre: 'PFE', entreprise: 'OCP', type: 'pfe' }], 'ar', SITE, TOKEN).html.includes(`href="${SITE}?lang=ar#offre/o1"`));
  assert.ok(N.rendreAlerte([{ id: 'o1', titre: 'PFE', entreprise: 'OCP', type: 'pfe' }], 'fr', SITE, TOKEN).html.includes(`href="${SITE}#offre/o1"`));
  assert.match(m.texte, /إلغاء الاشتراك: https/);
});

test('objets : pluriels français et accords arabes', () => {
  const base = resume(ID.youssef);
  const avec = (x, l) => N.rendreResume({ ...base, ...x }, l, SITE, TOKEN).sujet;
  assert.equal(avec({ candidatures: 1 }, 'fr'), '1 candidature à regarder · Réseau ENSAM');
  assert.equal(avec({ candidatures: 2 }, 'fr'), '2 candidatures à regarder · Réseau ENSAM');
  assert.equal(avec({ candidatures: 1 }, 'ar'), 'ترشيح واحد ينتظر ردك · شبكة ENSAM');
  assert.equal(avec({ candidatures: 2 }, 'ar'), 'ترشيحان ينتظران ردك · شبكة ENSAM');
  assert.equal(avec({ candidatures: 11 }, 'ar'), '11 ترشيحًا ينتظر ردك · شبكة ENSAM');
  const talents = { candidatures: 0, demandes: [], rdv: [], impact: { mercis: 0, recrutements: 0, citation: null }, questions: [], filleuls: [] };
  assert.equal(avec(talents, 'fr'), '5 étudiants de ta filière cherchent un stage · Réseau ENSAM');
  assert.equal(avec(talents, 'ar'), '5 طلبة من شعبتك يبحثون عن تدريب · شبكة ENSAM');
  const s = resume(ID.salma);
  assert.equal(N.rendreResume({ ...s, aConfirmer: [], rdv: [], invitations: [] }, 'fr', SITE, TOKEN).sujet, '4 nouvelles offres pour toi · Réseau ENSAM');
  assert.equal(N.rendreResume({ ...s, aConfirmer: [], rdv: [], invitations: [] }, 'ar', SITE, TOKEN).sujet, '4 عروض جديدة لك · شبكة ENSAM');
  // Rien de marquant : objet par défaut
  const r = { ...s, aConfirmer: [], rdv: [], invitations: [], offres: { total: 0, liste: [] }, reponses: [], aClore: [], cafes: [], parrain: '' };
  assert.equal(N.rendreResume(r, 'fr', SITE, TOKEN).sujet, 'Ta semaine sur le Réseau ENSAM Meknès');
});

test('aperçus : étudiante en français, lauréat en arabe', () => {
  const dossier = process.env.APERCU_DIR || path.join(os.tmpdir(), 'ensam-apercus');
  fs.mkdirSync(dossier, { recursive: true });
  const fr = N.rendreResume(resume(ID.salma), 'fr', SITE, TOKEN);
  const ar = N.rendreResume(resume(ID.youssef), 'ar', SITE, TOKEN);
  fs.writeFileSync(path.join(dossier, 'apercu-resume-fr.html'), fr.html);
  fs.writeFileSync(path.join(dossier, 'apercu-resume-ar.html'), ar.html);
  fs.writeFileSync(path.join(dossier, 'apercus-texte.txt'), `${fr.sujet}\n\n${fr.texte}\n\n==========\n\n${ar.sujet}\n\n${ar.texte}\n`);
  assert.ok(fr.html.length < 20000 && ar.html.length < 20000);
});

test('lauréat qui cherche un emploi : les offres pour jeunes diplômés et entre lauréats arrivent dans son résumé', () => {
  const n = profil(ID.nadia);
  assert.equal(N.resumeDe(n, D)?.offres.total || 0, 0, 'en poste : pas d’offres');
  const r = N.resumeDe({ ...n, en_recherche: true }, D);
  assert.ok(r.offres.liste.some(o => o.titre === 'Ingénieur méthodes junior'));
});
