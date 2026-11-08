// Chaque colonne qui vise une personne ou une ligne — une clé étrangère d'une colonne (sauf l'école de la ligne elle-même),
// ou un uuid sans clé — est relevée dans le catalogue. Dans une table que les membres écrivent, elle est gardée par un
// déclencheur de l'école : garde_ecole (aa_garde_ecole : la ligne visée est de l'école de qui écrit), garde_admin_ecole
// (ab_garde_admin_ecole : l'administration d'une école n'y met personne ni rien d'une autre école), ecole_du_parent
// (a0_ecole_du_parent : la ligne prend l'école de ce qu'elle vise) ; sinon elle figure ci-dessous avec la raison pour
// laquelle personne n'y met un id d'une autre école. Une colonne nouvelle, sans garde ni raison, fait échouer ce test :
// la garder, ou dire ici pourquoi elle n'a pas à l'être. (Les tables qu'aucune règle ne laisse écrire aux membres sont
// écrites par la base seule : rien à garder.)
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelleBase } from './banc-sql.mjs';

const SCHEMA = process.env.SCHEMA_SQL || new URL('../../supabase/schema.sql', import.meta.url).pathname;
let db;

const SOI = 'soi-même : la règle d’écriture impose l’id de qui écrit, et la ligne ne change plus de main';
const RAISONS = {
  'admin_suivi.created_by': 'le suivi n’est lu et écrit que par l’administration du réseau (règle « administration »)',
  'ambassadeurs.user_id': 'la ligne prend l’école du membre (protect_ambassadeur_insert) : « réseau de l’école » refuse un membre d’une autre école ; figé ensuite (protect_ambassadeur)',
  'answers.author_id': SOI,
  'applications.student_id': 'soi-même à l’insertion (règle), figé ensuite pour les membres (protect_application) ; l’administration d’une école : un membre de son école (règle « admin de son ecole »)',
  'attestations.laureat_id': 'soi-même pour un membre (protect_attestation) ; l’administration d’une école : un lauréat de son école (règle « admin de son ecole ») ; pas de modification',
  'blocages.bloque_id': 'un blocage n’engage que celui qui bloque (soi-même) : il ne donne rien à lire',
  'blocages.user_id': SOI,
  'comments.author_id': SOI,
  'coordonnees.id': 'ses propres coordonnées (règles : id = auth.uid())',
  'demandes.proposition_id': 'posée par la base quand l’étudiant accepte une aide (suite_proposition), vidée à la réouverture (protect_demande) ; l’administration d’une école : une aide de cette demande (protect_demande)',
  'demandes_contact.demandeur_id': 'soi-même (règle, protect_demande_contact), figé ensuite pour les membres ; l’administration d’une école : deux membres de son école (règle « admin de son ecole »)',
  'enquetes_insertion.user_id': 'soi-même à l’insertion (règle), figé ensuite pour tous (protect_enquete)',
  'groupe_membres.user_id': SOI,
  'groupe_messages.author_id': SOI,
  'guide_pays.updated_by': 'qui écrit (protect_guide) ; le guide est commun à toutes les écoles',
  'invitations.laureat_id': 'soi-même (règle, protect_invitation), figé ensuite pour les membres ; l’administration d’une école : deux membres de son école (règle « admin de son ecole »)',
  'kudos.user_id': SOI,
  'liens_rdv.id': 'le mentorat du mentor qui écrit (règles) ; l’administration d’une école : un mentorat de son école (règle « admin de son ecole »)',
  'match_choix.user_id': SOI,
  'matchs.etudiant_id': 'posé par la base (match_apres_choix) ; ensuite seules les dates de lecture changent, pour tous (protect_match)',
  'matchs.laureat_id': 'posé par la base (match_apres_choix) ; ensuite seules les dates de lecture changent, pour tous (protect_match)',
  'matchs.offre_id': 'posé par la base (match_apres_choix) ; ensuite seules les dates de lecture changent, pour tous (protect_match)',
  'messages.author_id': SOI,
  'messages.reponse_a': 'une citation d’une autre conversation est retirée (protect_message) ; pas de modification',
  'parrainages.filleul_id': 'posé par l’administration seule (règle) ; celle d’une école : deux membres de son école (règle « admin de son ecole ») ; pas de modification',
  'parrainages.parrain_id': 'posé par l’administration seule (règle) ; celle d’une école : deux membres de son école (règle « admin de son ecole ») ; pas de modification',
  'profiles.id': 'son propre compte',
  'questions.best_answer_id': 'seule une réponse de cette question compte (notif_meilleure_reponse, les points du site) : un autre id ne vise personne',
  'reactions.user_id': SOI,
  'reactions_messages.message_id': 'un message de sa propre conversation (protect_reaction_message, même pour l’administration), figé ensuite',
  'reactions_messages.user_id': SOI,
  'reactions_publiques.user_id': SOI,
  'relecture_commentaires.author_id': SOI,
  'relecture_commentaires.relecture_id': 'une relecture où il est l’étudiant ou le lauréat (protect_relecture_commentaire) ; l’administration d’une école : une relecture de son école (règle « admin de son ecole »)',
  'reponses_demandes.author_id': SOI,
  'retours_cv.auteur_id': 'soi-même (règle, protect_retour_cv), figé ensuite',
  'retours_cv.profil_id': 'son propre CV (règle) ; l’administration d’une école : un membre de son école (règle « admin de son ecole ») ; figé ensuite (protect_retour_cv)',
  'shortlists.laureat_id': SOI,
  'signalements.auteur_id': 'soi-même (règle, protect_signalement) ; l’administration d’une école : un auteur de son école (règle « admin de son ecole »)',
  'signalements.cible_id': 'ce que le membre signale : la ligne prévient l’administration de son école et du réseau, la cible ne lit rien',
  'sponsorises.created_by': 'qui écrit, figé ensuite (protect_sponsorise)',
  'votes.user_id': SOI,
};

let colonnes;
before(async () => {
  db = await nouvelleBase(SCHEMA);
  colonnes = (await db.query(`
    with c as (
      select r.oid rel, r.relname t, a.attname col, k.confrelid::regclass::text ref
      from pg_class r join pg_attribute a on a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped
      left join pg_constraint k on k.conrelid = r.oid and k.contype = 'f' and k.conkey = array[a.attnum]
      where r.relnamespace = 'public'::regnamespace and r.relkind = 'r'
        and ((k.oid is not null and k.confrelid <> 'public.ecoles'::regclass)
          or (k.oid is null and a.atttypid in ('uuid'::regtype, 'uuid[]'::regtype)
            and not exists (select 1 from pg_constraint p where p.conrelid = r.oid and p.contype = 'p' and p.conkey = array[a.attnum])))
    ), g as (
      select tg.tgrelid rel, split_part(x, ':', 1) col, tg.tgname from pg_trigger tg,
        unnest(string_to_array(rtrim(replace(encode(tg.tgargs, 'escape'), '\\000', chr(1)), chr(1)), chr(1))) x
      where tg.tgname in ('aa_garde_ecole', 'ab_garde_admin_ecole', 'a0_ecole_du_parent') and not tg.tgisinternal
    )
    select c.t || '.' || c.col k, coalesce(c.ref, '') ref,
      (select string_agg(g.tgname, ' ' order by g.tgname) from g where g.rel = c.rel and g.col = c.col) garde,
      (has_table_privilege('authenticated', c.rel, 'insert') or has_table_privilege('authenticated', c.rel, 'update'))
        and (not (select relrowsecurity from pg_class where oid = c.rel) or exists (select 1 from pg_policies p
          where p.schemaname = 'public' and p.tablename = c.t and p.permissive = 'PERMISSIVE' and p.cmd in ('INSERT', 'UPDATE', 'ALL')
            and p.roles && array['authenticated', 'public']::name[])) ecrite
    from c order by 1`)).rows;
});

test('catalogue : chaque colonne qui vise une personne ou une ligne, dans une table écrite par les membres, est gardée ou a sa raison', () => {
  const sans = colonnes.filter(c => c.ecrite && !c.garde && !RAISONS[c.k]).map(c => `${c.k}${c.ref ? ' → ' + c.ref : ' (uuid sans clé)'}`);
  assert.deepEqual(sans, [], 'ni gardées ni expliquées :\n  ' + sans.join('\n  '));
});

test('catalogue : la liste des raisons reste juste (pas de colonne disparue, gardée entre-temps, ou écrite par la base seule)', () => {
  const par = new Map(colonnes.map(c => [c.k, c]));
  const fausses = Object.keys(RAISONS).filter(k => !par.has(k) || par.get(k).garde || !par.get(k).ecrite)
    .map(k => `${k} : ${!par.has(k) ? 'disparue' : par.get(k).garde ? 'gardée par ' + par.get(k).garde : 'écrite par la base seule'}`);
  assert.deepEqual(fausses, []);
});

test('catalogue : les colonnes gardées le sont toujours (aide, entretien, avis, recrutement, invité par, traité par)', () => {
  const garde = k => colonnes.find(c => c.k === k)?.garde || '';
  for (const [k, g] of [['propositions.laureat_id', 'ab_garde_admin_ecole'], ['entretiens.author_id', 'ab_garde_admin_ecole'],
    ['entretiens.offer_id', 'ab_garde_admin_ecole'], ['avis_stage.author_id', 'ab_garde_admin_ecole'], ['avis_stage.placement_id', 'ab_garde_admin_ecole'],
    ['placements.demande_id', 'aa_garde_ecole'], ['profiles.invite_par', 'ab_garde_admin_ecole'], ['signalements.traite_par', 'ab_garde_admin_ecole'],
    ['propositions.demande_id', 'aa_garde_ecole'], ['placements.student_id', 'aa_garde_ecole'], ['demandes.laureat_id', 'ab_garde_admin_ecole']]) {
    assert.match(garde(k), new RegExp(g), k);
  }
});
