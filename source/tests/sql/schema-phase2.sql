-- =====================================================================
--  ENSAM Meknès · Réseau Lauréats & Étudiants
--  Schéma Supabase complet : tables, sécurité (RLS), temps réel.
--  À coller tel quel dans Supabase > SQL Editor > New query > Run.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Profils (1 ligne par compte)
-- role    : etudiant | laureat | admin
-- promo   : année de diplôme (prévue pour un étudiant, réelle pour un lauréat)
--           -> le niveau (3A/4A/5A) est calculé automatiquement chaque saison
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  role text not null default 'etudiant' check (role in ('etudiant','laureat','admin')),
  filiere text not null,
  promo int not null check (promo between 1990 and 2040),
  entreprise text,
  poste text,
  ville text,
  pays text default 'Maroc',
  bio text check (char_length(bio) <= 600),
  competences text[] default '{}',
  linkedin text,
  contact text,
  cv_url text,
  disponibilite text constraint profiles_disponibilite_len check (char_length(disponibilite) <= 80),
  mentor_dispo boolean default false,
  mentor_sujets text,
  vitrine boolean default true,
  verified boolean default false,
  created_at timestamptz default now()
);
-- Bases installées avant la « Phase 1 »
alter table public.profiles add column if not exists disponibilite text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_disponibilite_len') then
    alter table public.profiles add constraint profiles_disponibilite_len check (char_length(disponibilite) <= 80);
  end if;
end $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Personne ne peut s'auto-proclamer admin ou "lauréat vérifié"
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if new.role = 'admin' then new.role := 'etudiant'; end if;
    new.verified := false;
  else
    new.role := case when old.role = 'admin' then 'admin'
                     when new.role = 'admin' then old.role
                     else new.role end;
    if new.role <> old.role then new.verified := false;
    else new.verified := old.verified; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_profile on public.profiles;
create trigger trg_protect_profile before insert or update on public.profiles
  for each row execute function public.protect_profile();

-- ---------------------------------------------------------------------
-- Offres publiées (surtout par les lauréats)
-- type : stage | pfe | etranger | emploi
-- annees : niveaux ciblés (3,4,5 ; 6 = jeunes diplômés)
-- ---------------------------------------------------------------------
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('stage','pfe','etranger','emploi')),
  titre text not null check (char_length(titre) between 4 and 140),
  entreprise text not null,
  ville text,
  pays text default 'Maroc',
  filieres text[] default '{}',
  annees int[] default '{}',
  description text not null check (char_length(description) <= 4000),
  contact text,
  lien text,
  deadline date,
  cooptation boolean default false,
  remunere boolean default false,
  duree text,
  status text not null default 'ouverte' check (status in ('ouverte','pourvue','fermee')),
  created_at timestamptz default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1500),
  created_at timestamptz default now()
);

-- kind : utile (= "ça m'aide") | save (= sauvegardée)
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('utile','save')),
  created_at timestamptz default now(),
  unique (offer_id, user_id, kind)
);

-- ---------------------------------------------------------------------
-- Candidatures
-- Sur une offre de la plateforme : l'étudiant postule, le LAURÉAT auteur de
-- l'offre fait avancer le statut (entretien, retenu, pas retenu).
-- Candidature externe (offer_id vide) : l'étudiant la suit lui-même.
-- ---------------------------------------------------------------------
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  offer_id uuid references public.offers(id) on delete set null,
  entreprise text not null,
  titre text,
  message text check (char_length(message) <= 1500),
  status text not null default 'postule' check (status in ('postule','entretien','retenu','refuse')),
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.applications add column if not exists message text;
create unique index if not exists applications_une_par_offre on public.applications (student_id, offer_id) where offer_id is not null;

create or replace function public.protect_application() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_status text; v_note text; v_message text;
begin
  if tg_op = 'INSERT' then
    if new.offer_id is not null then
      select author_id into v_author from public.offers where id = new.offer_id;
      select entreprise, titre into new.entreprise, new.titre from public.offers where id = new.offer_id;
      if auth.uid() is not null and not public.is_admin() then new.status := 'postule'; end if;
    end if;
    return new;
  end if;
  if auth.uid() is null or public.is_admin() then new.updated_at := now(); return new; end if;
  select author_id into v_author from public.offers where id = old.offer_id;
  v_status := new.status; v_note := new.note; v_message := new.message;
  new := old;
  new.updated_at := now();
  if old.offer_id is not null and auth.uid() = v_author and auth.uid() <> old.student_id then
    new.status := v_status;                         -- le lauréat fait avancer la candidature
  elsif auth.uid() = old.student_id then
    new.note := v_note; new.message := v_message;   -- l'étudiant garde ses notes
    if old.offer_id is null then new.status := v_status; end if;  -- et suit seul ses candidatures externes
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_application on public.applications;
create trigger trg_protect_application before insert or update on public.applications
  for each row execute function public.protect_application();

-- ---------------------------------------------------------------------
-- Réussites (placements) : la base du tableau de bord.
-- saison : année de début de l'année universitaire (2026 = 2026-2027)
-- niveau : 3,4,5 ou 6 (jeune diplômé)
-- Deux façons d'arriver ici :
--   1. Le LAURÉAT déclare « j'ai recruté X » (depuis son offre)  -> en_attente
--      puis l'ÉTUDIANT confirme                                  -> confirme (vérifié des deux côtés)
--      ou dit que ce n'est pas le cas                            -> refuse
--   2. L'étudiant déclare avoir trouvé hors plateforme            -> declare (non vérifié)
-- ---------------------------------------------------------------------
create table if not exists public.placements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  offer_id uuid references public.offers(id) on delete set null,
  laureat_id uuid references public.profiles(id) on delete set null,
  saison int not null,
  niveau int not null check (niveau between 3 and 6),
  type text not null check (type in ('stage','pfe','etranger','emploi')),
  entreprise text not null,
  ville text,
  pays text default 'Maroc',
  source text not null default 'autre' check (source in ('plateforme','autre')),
  status text not null default 'declare' check (status in ('declare','en_attente','confirme','refuse')),
  merci text check (char_length(merci) <= 800),
  note int check (note between 1 and 5),
  partage_ok boolean default false,           -- l'étudiant accepte d'être cité sur LinkedIn
  created_at timestamptz default now(),
  confirmed_at timestamptz
);
alter table public.placements add column if not exists partage_ok boolean default false;
-- Une seule réussite par étudiant et par saison (une déclaration refusée par l'étudiant ne compte pas)
create unique index if not exists placements_une_par_saison on public.placements (student_id, saison) where status <> 'refuse';

create or replace function public.protect_placement() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_status text; v_merci text; v_note int; v_ent text; v_ville text; v_pays text; v_type text; v_partage boolean;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null or public.is_admin() then return new; end if;
    new.confirmed_at := null;
    if auth.uid() = new.student_id then
      -- l'étudiant ne peut déclarer qu'une réussite hors plateforme (non vérifiée)
      new.offer_id := null; new.laureat_id := null; new.source := 'autre'; new.status := 'declare';
      return new;
    end if;
    -- sinon c'est un lauréat qui déclare avoir recruté l'étudiant
    if not exists (select 1 from public.profiles where id = auth.uid() and role = 'laureat') then
      raise exception 'Seul un lauréat peut déclarer un recrutement.';
    end if;
    new.laureat_id := auth.uid();
    if new.offer_id is not null then
      select author_id into v_author from public.offers where id = new.offer_id;
      if v_author is distinct from auth.uid() then raise exception 'Seul l’auteur de l’offre peut déclarer ce recrutement.'; end if;
    end if;
    new.source := 'plateforme'; new.status := 'en_attente'; new.partage_ok := false;
    return new;
  end if;
  -- UPDATE
  if auth.uid() is null or public.is_admin() then
    if new.status = 'confirme' and old.status <> 'confirme' then new.confirmed_at := now(); end if;
    return new;
  end if;
  v_status := new.status; v_merci := new.merci; v_note := new.note; v_partage := new.partage_ok;
  v_ent := new.entreprise; v_ville := new.ville; v_pays := new.pays; v_type := new.type;
  new := old;
  if auth.uid() = old.student_id then
    new.merci := v_merci; new.note := v_note; new.partage_ok := coalesce(v_partage, false);
    if old.status = 'en_attente' and v_status in ('confirme','refuse') then
      new.status := v_status;
      if v_status = 'confirme' then new.confirmed_at := now(); end if;
    end if;
    if old.source = 'autre' then new.entreprise := v_ent; new.ville := v_ville; new.pays := v_pays; new.type := v_type; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_placement on public.placements;
create trigger trg_protect_placement before insert or update on public.placements
  for each row execute function public.protect_placement();

-- ---------------------------------------------------------------------
-- Mentorat en 3 étapes
--   1. L'étudiant dit de quoi il a besoin et propose 2 ou 3 horaires,
--      à un lauréat précis ou à tous les lauréats (mentor_id vide).
--   2. Un lauréat clique sur un horaire : le rendez-vous est fixé et le lien
--      de visio est créé tout seul (table liens_rdv, visible des deux seulement).
--   3. Après l'échange, l'étudiant note et dit merci.
-- ---------------------------------------------------------------------
create table if not exists public.mentorships (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  mentor_id uuid references public.profiles(id) on delete cascade,
  besoin text check (besoin in ('cv','stage','entretien','etranger','carriere')),
  sujet text not null check (char_length(sujet) between 3 and 140),
  message text check (char_length(message) <= 1500),
  creneaux timestamptz[] not null default '{}',
  status text not null default 'demande',
  rdv_at timestamptz,
  reponse text check (char_length(reponse) <= 1500),
  merci text check (char_length(merci) <= 800),
  note int check (note between 1 and 5),
  accepted_at timestamptz,
  created_at timestamptz default now()
);
-- Bases installées avant le mentorat en 3 étapes
alter table public.mentorships alter column mentor_id drop not null;
alter table public.mentorships add column if not exists besoin text check (besoin in ('cv','stage','entretien','etranger','carriere'));
alter table public.mentorships add column if not exists creneaux timestamptz[] not null default '{}';
alter table public.mentorships add column if not exists rdv_at timestamptz;
alter table public.mentorships add column if not exists note int check (note between 1 and 5);
alter table public.mentorships add column if not exists accepted_at timestamptz;
alter table public.mentorships drop constraint if exists mentorships_status_check;
alter table public.mentorships add constraint mentorships_status_check check (status in ('demande','acceptee','terminee','refusee','annulee'));
create index if not exists mentorships_ouvertes on public.mentorships (created_at) where mentor_id is null and status = 'demande';

-- Lien de visio d'un rendez-vous : lisible par l'étudiant et le lauréat concernés seulement
create table if not exists public.liens_rdv (
  id uuid primary key references public.mentorships(id) on delete cascade,
  lien text not null check (lien ~* '^https://[^\s]+$' and char_length(lien) <= 300),
  created_at timestamptz default now()
);

-- Horaires proposés : à venir, sans doublon, 3 au plus
create or replace function public.creneaux_valides(c timestamptz[]) returns timestamptz[]
language sql stable as $$
  select coalesce(array_agg(x order by x), '{}') from (
    select distinct x from unnest(coalesce(c, '{}')) x where x > now() order by x limit 3) t;
$$;

create or replace function public.protect_mentorship() returns trigger
language plpgsql security definer set search_path = public as $$
declare v public.mentorships%rowtype; v_role text;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  select role into v_role from public.profiles where id = auth.uid();
  if tg_op = 'INSERT' then
    new.student_id := auth.uid();
    if new.mentor_id = auth.uid() then raise exception 'Choisis un autre lauréat que toi.'; end if;
    if new.mentor_id is not null and not exists (select 1 from public.profiles where id = new.mentor_id and role = 'laureat') then
      raise exception 'Choisis un lauréat.';
    end if;
    new.creneaux := public.creneaux_valides(new.creneaux);
    if cardinality(new.creneaux) = 0 then raise exception 'Propose au moins un horaire à venir.'; end if;
    if (select count(*) from public.mentorships where student_id = auth.uid() and status = 'demande') >= 3 then
      raise exception 'Tu as déjà 3 demandes en attente. Attends une réponse avant d’en envoyer une autre.';
    end if;
    new.status := 'demande'; new.rdv_at := null; new.reponse := null; new.merci := null; new.note := null;
    new.accepted_at := null; new.created_at := now();
    return new;
  end if;
  v := new;
  new := old;
  -- Un lauréat prend une demande ouverte à tous
  if old.mentor_id is null and old.status = 'demande' and v.mentor_id = auth.uid() and auth.uid() <> old.student_id then
    if v_role is distinct from 'laureat' then raise exception 'Seul un lauréat peut accepter une demande.'; end if;
    new.mentor_id := auth.uid();
  end if;
  -- Le lauréat : fixer ou déplacer le rendez-vous, passer la main, clore
  if new.mentor_id = auth.uid() then
    new.reponse := v.reponse;
    if old.status = 'demande' and v.mentor_id is null and old.mentor_id is not null then
      new.mentor_id := null;                                 -- la demande devient ouverte à tous
    elsif v.status = 'acceptee' and old.status in ('demande','acceptee') then
      if v.rdv_at is null then raise exception 'Choisis l’horaire du rendez-vous.'; end if;
      if v.rdv_at is distinct from old.rdv_at and v.rdv_at < now() then raise exception 'Choisis un moment à venir.'; end if;
      new.status := 'acceptee'; new.rdv_at := v.rdv_at;
      if old.status = 'demande' then new.accepted_at := now(); end if;
      insert into public.liens_rdv (id, lien)
        values (old.id, 'https://meet.jit.si/ReseauENSAM-' || substr(md5(gen_random_uuid()::text), 1, 12))
        on conflict (id) do nothing;
    elsif v.status = 'refusee' and old.status = 'demande' then new.status := 'refusee';
    elsif v.status in ('terminee','annulee') and old.status = 'acceptee' then new.status := v.status;
    end if;
    return new;
  end if;
  -- L'étudiant : modifier sa demande en attente, annuler, dire que l'échange a eu lieu, noter, remercier
  if auth.uid() = old.student_id then
    new.merci := v.merci; new.note := v.note;
    if old.status = 'demande' then
      new.besoin := v.besoin; new.sujet := v.sujet; new.message := v.message;
      if v.creneaux is distinct from old.creneaux then
        new.creneaux := public.creneaux_valides(v.creneaux);
        if cardinality(new.creneaux) = 0 then raise exception 'Propose au moins un horaire à venir.'; end if;
      end if;
      if v.status = 'annulee' then new.status := 'annulee'; end if;
    elsif old.status = 'acceptee' and v.status in ('terminee','annulee') then
      new.status := v.status;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_mentorship on public.mentorships;
create trigger trg_protect_mentorship before insert or update on public.mentorships
  for each row execute function public.protect_mentorship();

-- Email de l'étudiant, donné au seul lauréat qui a fixé le rendez-vous
-- (pour l'invitation Google Agenda)
create or replace function public.email_rdv(p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select u.email::text from public.mentorships m join auth.users u on u.id = m.student_id
  where m.id = p_id and m.status = 'acceptee' and m.mentor_id = auth.uid();
$$;
revoke all on function public.email_rdv(uuid) from public;
grant execute on function public.email_rdv(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Entraide : questions / réponses / votes
-- ---------------------------------------------------------------------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  categorie text not null,
  titre text not null check (char_length(titre) between 5 and 160),
  body text check (char_length(body) <= 3000),
  best_answer_id uuid,
  created_at timestamptz default now()
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (answer_id, user_id)
);

-- ---------------------------------------------------------------------
-- Shortlist : les profils qu'un lauréat garde de côté (visible par lui seul)
-- ---------------------------------------------------------------------
create table if not exists public.shortlists (
  id uuid primary key default gen_random_uuid(),
  laureat_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  note text check (char_length(note) <= 300),
  created_at timestamptz default now(),
  unique (laureat_id, student_id)
);

-- ---------------------------------------------------------------------
-- Invitations à postuler : un lauréat invite un étudiant sur une de SES offres.
-- L'étudiant postule (candidature normale) ou décline.
-- ---------------------------------------------------------------------
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  laureat_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete cascade,
  message text check (char_length(message) <= 600),
  status text not null default 'envoyee' check (status in ('envoyee','declinee')),
  created_at timestamptz default now(),
  unique (offer_id, student_id)
);

create or replace function public.protect_invitation() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.profiles where id = auth.uid() and role = 'laureat') then
      raise exception 'Seul un lauréat peut inviter un étudiant.';
    end if;
    if not exists (select 1 from public.offers where id = new.offer_id and author_id = auth.uid()) then
      raise exception 'Tu ne peux inviter que sur tes propres offres.';
    end if;
    new.laureat_id := auth.uid(); new.status := 'envoyee'; new.created_at := now();
    return new;
  end if;
  v_status := new.status;
  new := old;
  if auth.uid() = old.student_id and v_status = 'declinee' then new.status := 'declinee'; end if;
  return new;
end $$;
drop trigger if exists trg_protect_invitation on public.invitations;
create trigger trg_protect_invitation before insert or update on public.invitations
  for each row execute function public.protect_invitation();

-- ---------------------------------------------------------------------
-- Annonces de l'administration (bandeau sur l'accueil)
-- ---------------------------------------------------------------------
create table if not exists public.annonces (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  texte text not null check (char_length(texte) between 3 and 280),
  lien text check (lien ~* '^https://[^\s]+$' and char_length(lien) <= 300),
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Comptes vus par l'administration : email, dernière connexion, profil rempli ou non
create or replace function public.admin_comptes()
returns table (id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, a_profil boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l’administration.'; end if;
  return query select u.id, u.email::text, u.created_at, u.last_sign_in_at, exists (select 1 from public.profiles p where p.id = u.id)
    from auth.users u order by u.created_at desc;
end $$;
revoke all on function public.admin_comptes() from public;
grant execute on function public.admin_comptes() to authenticated;

-- ---------------------------------------------------------------------
-- Bravos sur le fil des réussites
-- ---------------------------------------------------------------------
create table if not exists public.kudos (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (placement_id, user_id)
);

-- ---------------------------------------------------------------------
-- Attestations de contribution : les chiffres sont calculés par la base,
-- à partir des seules actions confirmées par les étudiants.
-- ---------------------------------------------------------------------
create table if not exists public.attestations (
  id uuid primary key default gen_random_uuid(),
  laureat_id uuid not null references public.profiles(id) on delete cascade,
  stats jsonb not null default '{}',
  created_at timestamptz default now()
);

create or replace function public.protect_attestation() returns trigger
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if auth.uid() is not null and not public.is_admin() then
    if not exists (select 1 from public.profiles where id = auth.uid() and role = 'laureat') then
      raise exception 'Seul un lauréat peut obtenir une attestation.';
    end if;
    new.laureat_id := auth.uid();
  end if;
  v := new.laureat_id;
  new.stats := jsonb_build_object(
    'mentorats', (select count(*) from public.mentorships where mentor_id = v and status = 'terminee'),
    'recrutes',  (select count(*) from public.placements where laureat_id = v and status = 'confirme'),
    'reponses',  (select count(*) from public.answers where author_id = v));
  new.created_at := now();
  return new;
end $$;
drop trigger if exists trg_protect_attestation on public.attestations;
create trigger trg_protect_attestation before insert on public.attestations
  for each row execute function public.protect_attestation();

-- Vérification publique d'une attestation par son lien (sans compte)
create or replace function public.attestation_publique(p_id uuid)
returns table (id uuid, full_name text, filiere text, promo int, stats jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, p.full_name, p.filiere, p.promo, a.stats, a.created_at
  from public.attestations a join public.profiles p on p.id = a.laureat_id
  where a.id = p_id;
$$;
revoke all on function public.attestation_publique(uuid) from public;
grant execute on function public.attestation_publique(uuid) to anon, authenticated;

-- =====================================================================
--  Phase 2 : réseau pro, recrutement, communauté, confidentialité,
--  notifications sur le téléphone et résumé hebdomadaire par email.
-- =====================================================================

-- Profils : secteur (annuaire pro), consentement, résumé par email, langue, parrainage
alter table public.profiles add column if not exists secteur text;
alter table public.profiles add column if not exists consent_at timestamptz;
alter table public.profiles add column if not exists emails_hebdo boolean not null default true;
alter table public.profiles add column if not exists langue text not null default 'fr';
alter table public.profiles add column if not exists parrain_dispo boolean not null default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_langue_check') then
    alter table public.profiles add constraint profiles_langue_check check (langue in ('fr','ar'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_secteur_len') then
    alter table public.profiles add constraint profiles_secteur_len check (char_length(secteur) <= 60);
  end if;
end $$;

-- Offres : réservées aux lauréats (audience), relance douce après 3 semaines sans activité
alter table public.offers add column if not exists audience text not null default 'etudiants';
alter table public.offers add column if not exists verifiee_at timestamptz;
alter table public.offers add column if not exists relance_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'offers_audience_check') then
    alter table public.offers add constraint offers_audience_check check (audience in ('etudiants','laureats'));
  end if;
end $$;

-- Questions routées : une question sur une entreprise ou un pays va d'abord aux lauréats concernés
alter table public.questions add column if not exists entreprise text;
alter table public.questions add column if not exists pays text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'questions_cible_len') then
    alter table public.questions add constraint questions_cible_len check (char_length(entreprise) <= 80 and char_length(pays) <= 60);
  end if;
end $$;

-- Nom d'entreprise comparable : « Renault Group Maroc » et « Renault » donnent « renault »
create or replace function public.cle_entreprise(t text) returns text
language sql immutable as $$
  select nullif(trim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    lower(translate(coalesce(t, ''), 'ÀÂÄÁÃÉÈÊËÍÎÏÌÓÔÖÒÕÚÛÜÙÇÑàâäáãéèêëíîïìóôöòõúûüùçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')),
    '\(.*?\)', ' ', 'g'), '[^a-z0-9]+', ' ', 'g'),
    '\m(group|groupe|maroc|morocco|sa|sas|sarl|ltd|inc|the|le|la|les|de|du|des|corporation|operations|international)\M', ' ', 'g'),
    '\s+', ' ', 'g')), '');
$$;
-- « Meknès » = « meknes » : villes et pays comparés sans accents ni majuscules
create or replace function public.cle_lieu(t text) returns text
language sql immutable as $$
  select nullif(regexp_replace(lower(trim(translate(coalesce(t, ''), 'ÀÂÄÁÃÉÈÊËÍÎÏÌÓÔÖÒÕÚÛÜÙÇÑàâäáãéèêëíîïìóôöòõúûüùçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'))), '\s+', ' ', 'g'), '');
$$;
create or replace function public.meme_entreprise(a text, b text) returns boolean
language sql immutable as $$
  select public.cle_entreprise(a) is not null and public.cle_entreprise(b) is not null and (
    public.cle_entreprise(a) = public.cle_entreprise(b)
    or public.cle_entreprise(a) like public.cle_entreprise(b) || ' %'
    or public.cle_entreprise(b) like public.cle_entreprise(a) || ' %');
$$;

create or replace function public.saison_courante() returns int
language sql stable as $$
  select case when extract(month from now()) >= 9 then extract(year from now())::int else extract(year from now())::int - 1 end;
$$;

-- ---------------------------------------------------------------------
-- Groupes : par filière, par ville et « à l'étranger » (par pays).
-- Chacun est membre des groupes de sa filière, de sa ville et de son pays,
-- et peut en suivre d'autres (ex. un étudiant qui vise la France).
-- groupe = 'filiere:…', 'ville:…' ou 'pays:…' (en minuscules, sans accents)
-- ---------------------------------------------------------------------
create table if not exists public.groupe_messages (
  id uuid primary key default gen_random_uuid(),
  groupe text not null check (groupe ~ '^(filiere|ville|pays):.+' and char_length(groupe) <= 80),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1500),
  created_at timestamptz default now()
);
create index if not exists groupe_messages_groupe on public.groupe_messages (groupe, created_at desc);

create table if not exists public.groupe_membres (
  id uuid primary key default gen_random_uuid(),
  groupe text not null check (groupe ~ '^(filiere|ville|pays):.+' and char_length(groupe) <= 80),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (groupe, user_id)
);

-- ---------------------------------------------------------------------
-- Cafés ENSAM : une rencontre dans une ville, on s'inscrit en un clic
-- ---------------------------------------------------------------------
create table if not exists public.cafes (
  id uuid primary key default gen_random_uuid(),
  organisateur_id uuid not null references public.profiles(id) on delete cascade,
  ville text not null check (char_length(ville) between 2 and 60),
  pays text not null default 'Maroc' check (char_length(pays) between 2 and 60),
  lieu text not null check (char_length(lieu) between 2 and 140),
  date_at timestamptz not null,
  message text check (char_length(message) <= 600),
  places int check (places between 2 and 200),
  annule boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists public.cafe_participants (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (cafe_id, user_id)
);

create or replace function public.protect_cafe() returns trigger
language plpgsql security definer set search_path = public as $$
declare v public.cafes%rowtype;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.organisateur_id := auth.uid(); new.annule := false; new.created_at := now();
    if new.date_at < now() then raise exception 'Choisis une date à venir.'; end if;
    return new;
  end if;
  v := new; new := old;
  if auth.uid() = old.organisateur_id then
    new.lieu := v.lieu; new.message := v.message; new.places := v.places; new.annule := v.annule;
    if v.date_at is distinct from old.date_at then
      if v.date_at < now() then raise exception 'Choisis une date à venir.'; end if;
      new.date_at := v.date_at;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_cafe on public.cafes;
create trigger trg_protect_cafe before insert or update on public.cafes
  for each row execute function public.protect_cafe();

-- L'organisateur est inscrit d'office à son café
create or replace function public.cafe_organisateur() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.cafe_participants (cafe_id, user_id) values (new.id, new.organisateur_id) on conflict do nothing;
  return null;
end $$;
drop trigger if exists trg_cafe_organisateur on public.cafes;
create trigger trg_cafe_organisateur after insert on public.cafes
  for each row execute function public.cafe_organisateur();

create or replace function public.protect_cafe_participant() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.cafes%rowtype;
begin
  if auth.uid() is not null and not public.is_admin() then new.user_id := auth.uid(); end if;
  select * into c from public.cafes where id = new.cafe_id;
  if c.organisateur_id = new.user_id then return new; end if;
  if c.annule then raise exception 'Ce café est annulé.'; end if;
  if c.date_at < now() then raise exception 'Ce café a déjà eu lieu.'; end if;
  if c.places is not null and (select count(*) from public.cafe_participants where cafe_id = c.id) >= c.places then
    raise exception 'Ce café est complet.';
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_cafe_participant on public.cafe_participants;
create trigger trg_protect_cafe_participant before insert on public.cafe_participants
  for each row execute function public.protect_cafe_participant();

-- ---------------------------------------------------------------------
-- Vitrine des startups fondées par des lauréats
-- ---------------------------------------------------------------------
create table if not exists public.startups (
  id uuid primary key default gen_random_uuid(),
  fondateur_id uuid not null references public.profiles(id) on delete cascade,
  nom text not null check (char_length(nom) between 2 and 80),
  pitch text not null check (char_length(pitch) between 10 and 400),
  secteur text check (char_length(secteur) <= 60),
  ville text check (char_length(ville) <= 60),
  pays text default 'Maroc' check (char_length(pays) <= 60),
  site text check (site ~* '^https://[^\s]+$' and char_length(site) <= 300),
  recrute boolean not null default false,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- Défis de saison, lancés par l'administration (« Octobre : 50 stages pour les 4A »).
-- La progression est calculée à partir des réussites, mentorats, offres et réponses.
-- mesure : reussites | stages | pfe | etranger | emplois | mentorats | offres | reponses
-- ---------------------------------------------------------------------
create table if not exists public.defis (
  id uuid primary key default gen_random_uuid(),
  titre text not null check (char_length(titre) between 4 and 120),
  mesure text not null check (mesure in ('reussites','stages','pfe','etranger','emplois','mentorats','offres','reponses')),
  niveau int check (niveau between 3 and 6),
  cible int not null check (cible between 1 and 10000),
  debut date not null,
  fin date not null,
  created_at timestamptz default now(),
  check (fin >= debut)
);

-- ---------------------------------------------------------------------
-- Parrainage : chaque 3A reçoit un parrain lauréat volontaire de sa filière
-- (3 filleuls au plus par saison). Attribution automatique : à l'inscription,
-- quand un lauréat se porte volontaire, et chaque matin.
-- ---------------------------------------------------------------------
create table if not exists public.parrainages (
  id uuid primary key default gen_random_uuid(),
  filleul_id uuid not null references public.profiles(id) on delete cascade,
  parrain_id uuid not null references public.profiles(id) on delete cascade,
  saison int not null,
  created_at timestamptz default now(),
  unique (filleul_id, saison)
);

create or replace function public.donner_parrain(p_etudiant uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_s int := public.saison_courante(); v_p public.profiles%rowtype; v_parrain uuid;
begin
  select * into v_p from public.profiles where id = p_etudiant;
  if v_p.id is null or v_p.role <> 'etudiant' or v_p.promo <> v_s + 3 then return null; end if;
  select parrain_id into v_parrain from public.parrainages where filleul_id = p_etudiant and saison = v_s;
  if v_parrain is not null then return v_parrain; end if;
  select l.id into v_parrain from public.profiles l
    where l.role = 'laureat' and l.parrain_dispo and l.filiere = v_p.filiere
      and (select count(*) from public.parrainages x where x.parrain_id = l.id and x.saison = v_s) < 3
    order by l.verified desc, (select count(*) from public.parrainages x where x.parrain_id = l.id and x.saison = v_s), random()
    limit 1;
  if v_parrain is null then return null; end if;
  insert into public.parrainages (filleul_id, parrain_id, saison) values (p_etudiant, v_parrain, v_s)
    on conflict (filleul_id, saison) do nothing;
  return (select parrain_id from public.parrainages where filleul_id = p_etudiant and saison = v_s);
end $$;
revoke all on function public.donner_parrain(uuid) from public, anon, authenticated;

-- Appelé par un étudiant de 3A qui n'a pas encore de parrain
create or replace function public.mon_parrain() returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return null; end if;
  return public.donner_parrain(auth.uid());
end $$;
revoke all on function public.mon_parrain() from public, anon;
grant execute on function public.mon_parrain() to authenticated;

create or replace function public.attribuer_parrains() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; v_s int := public.saison_courante();
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Réservé à l’administration.'; end if;
  for r in select p.id from public.profiles p where p.role = 'etudiant' and p.promo = v_s + 3
      and not exists (select 1 from public.parrainages x where x.filleul_id = p.id and x.saison = v_s)
      order by p.created_at loop
    if public.donner_parrain(r.id) is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function public.attribuer_parrains() from public, anon;
grant execute on function public.attribuer_parrains() to authenticated;

-- Nouveau 3A : un parrain tout de suite ; nouveau volontaire : les 3A qui attendent sont servis
create or replace function public.parrainage_auto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'etudiant' and (tg_op = 'INSERT' or new.promo is distinct from old.promo or new.filiere is distinct from old.filiere) then
    perform public.donner_parrain(new.id);
  elsif new.role = 'laureat' and new.parrain_dispo and (tg_op = 'INSERT' or not coalesce(old.parrain_dispo, false)) then
    perform public.donner_parrain(p.id) from public.profiles p
      where p.role = 'etudiant' and p.filiere = new.filiere and p.promo = public.saison_courante() + 3
        and not exists (select 1 from public.parrainages x where x.filleul_id = p.id and x.saison = public.saison_courante());
  end if;
  return null;
exception when others then return null;  -- l'attribution ne doit jamais bloquer l'enregistrement d'un profil
end $$;
drop trigger if exists trg_parrainage_auto on public.profiles;
create trigger trg_parrainage_auto after insert or update of role, promo, filiere, parrain_dispo on public.profiles
  for each row execute function public.parrainage_auto();

-- ---------------------------------------------------------------------
-- Confidentialité : supprimer son compte soi-même (toutes ses données partent avec)
-- ---------------------------------------------------------------------
create or replace function public.supprimer_mon_compte() returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'Connecte-toi d’abord.'; end if;
  delete from public.profiles where id = v;
  delete from auth.users where id = v;
end $$;
revoke all on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;

-- ---------------------------------------------------------------------
-- Notifications sur le téléphone (Web Push) et résumé hebdomadaire par email.
-- Les envois sont faits par la fonction Supabase « notifier » (supabase/functions/notifier).
-- Tables privées : aucune règle de lecture, seule la fonction (clé de service) y accède.
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (endpoint ~* '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table if not exists public.push_queue (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  data jsonb not null default '{}',
  created_at timestamptz default now()
);

-- Réglages internes : adresse du projet, clé publique, secret d'appel de la fonction, clés VAPID
create table if not exists public.app_secrets (
  cle text primary key,
  valeur text not null
);
insert into public.app_secrets (cle, valeur)
  values ('notifier_secret', md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text))
  on conflict (cle) do nothing;

-- Lien de désabonnement et date du dernier résumé envoyé, par membre
create table if not exists public.notif_etat (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  resume_at timestamptz
);

create table if not exists public.rappels_envoyes (
  id uuid primary key references public.mentorships(id) on delete cascade,
  rdv_at timestamptz,
  created_at timestamptz default now()
);

-- S'abonner depuis un téléphone (un même téléphone ne sert qu'un compte à la fois)
create or replace function public.abonner_push(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connecte-toi d’abord.'; end if;
  if p_endpoint !~* '^https://' then raise exception 'Abonnement invalide.'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), p_endpoint, p_p256dh, p_auth);
end $$;
revoke all on function public.abonner_push(text, text, text) from public, anon;
grant execute on function public.abonner_push(text, text, text) to authenticated;

-- Lien « Se désabonner » des emails : marche sans être connecté
create or replace function public.se_desabonner(p_token uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  select user_id into v from public.notif_etat where token = p_token;
  if v is null then return false; end if;
  update public.profiles set emails_hebdo = false where id = v;
  return true;
end $$;
revoke all on function public.se_desabonner(uuid) from public;
grant execute on function public.se_desabonner(uuid) to anon, authenticated;

-- Membres à qui envoyer le résumé aujourd'hui (une fois par semaine chacun, 250 par jour au plus)
create or replace function public.destinataires_resume(p_max int default 250)
returns table (id uuid, email text, langue text, token uuid)
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notif_etat (user_id) select p.id from public.profiles p on conflict (user_id) do nothing;
  return query
    select p.id, u.email::text, p.langue, n.token
    from public.profiles p join auth.users u on u.id = p.id join public.notif_etat n on n.user_id = p.id
    where p.emails_hebdo and u.email is not null
      and (n.resume_at is null or n.resume_at < now() - interval '6 days 12 hours')
      and p.created_at < now() - interval '2 days'
    order by n.resume_at nulls first, p.created_at
    limit greatest(1, least(p_max, 290));
end $$;
revoke all on function public.destinataires_resume(int) from public, anon, authenticated;

-- Appel de la fonction « notifier » (si l'extension pg_net et l'adresse du projet sont là)
create or replace function public.appeler_notifier(p_job text) returns void
language plpgsql security definer set search_path = public as $$
declare v_url text; v_key text; v_secret text;
begin
  select valeur into v_url from public.app_secrets where cle = 'projet_url';
  select valeur into v_key from public.app_secrets where cle = 'anon_key';
  select valeur into v_secret from public.app_secrets where cle = 'notifier_secret';
  if v_url is null or v_key is null then return; end if;
  perform net.http_post(
    url := v_url || '/functions/v1/notifier',
    body := jsonb_build_object('job', p_job),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key, 'x-notifier', v_secret));
exception when others then null;  -- pas de pg_net, ou fonction pas encore déployée : rien n'est bloqué
end $$;
revoke all on function public.appeler_notifier(text) from public, anon, authenticated;

-- Met une notification en file pour un membre, seulement s'il l'a activée sur un téléphone
create or replace function public.pousser(p_user uuid, p_kind text, p_data jsonb default '{}') returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = auth.uid() then return; end if;
  if exists (select 1 from public.push_subscriptions where user_id = p_user) then
    insert into public.push_queue (user_id, kind, data) values (p_user, p_kind, coalesce(p_data, '{}'));
  end if;
exception when others then null;  -- une notification ne doit jamais bloquer l'action du membre
end $$;
revoke all on function public.pousser(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.push_queue_envoi() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Un seul appel par transaction : la fonction vide toute la file d'un coup, après la validation
  if coalesce(current_setting('ensam.push_appele', true), '') = '1' then return null; end if;
  perform set_config('ensam.push_appele', '1', true);
  perform public.appeler_notifier('push');
  return null;
end $$;
drop trigger if exists trg_push_queue on public.push_queue;
create trigger trg_push_queue after insert on public.push_queue
  for each statement execute function public.push_queue_envoi();

-- La fonction « notifier » prend les notifications en attente (sans doublon si deux envois se croisent)
create or replace function public.prendre_push(p_max int default 300)
returns table (id bigint, user_id uuid, kind text, data jsonb, langue text)
language sql security definer set search_path = public as $$
  with pris as (
    delete from public.push_queue q where q.id in (select x.id from public.push_queue x order by x.id limit p_max for update skip locked)
    returning q.*)
  select pris.id, pris.user_id, pris.kind, pris.data, coalesce(p.langue, 'fr') from pris left join public.profiles p on p.id = pris.user_id order by pris.id;
$$;
revoke all on function public.prendre_push(int) from public, anon, authenticated;

-- Ce qui déclenche une notification sur le téléphone
create or replace function public.notif_evenements() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_nom text; v_auteur uuid; v_titre text; r record;
begin
  if tg_table_name = 'mentorships' then
    if tg_op = 'INSERT' then
      if new.mentor_id is not null then
        perform public.pousser(new.mentor_id, 'mentorat_demande', jsonb_build_object('nom', (select full_name from public.profiles where id = new.student_id), 'sujet', new.sujet));
      end if;
    else
      if old.status = 'demande' and new.status = 'acceptee' then
        perform public.pousser(new.student_id, 'mentorat_accepte', jsonb_build_object('nom', (select full_name from public.profiles where id = new.mentor_id), 'sujet', new.sujet, 'rdv_at', new.rdv_at));
      elsif old.status = 'acceptee' and new.status = 'acceptee' and new.rdv_at is distinct from old.rdv_at then
        perform public.pousser(new.student_id, 'mentorat_deplace', jsonb_build_object('nom', (select full_name from public.profiles where id = new.mentor_id), 'sujet', new.sujet, 'rdv_at', new.rdv_at));
      elsif old.status = 'acceptee' and new.status = 'annulee' then
        perform public.pousser(case when auth.uid() = new.student_id then new.mentor_id else new.student_id end, 'mentorat_annule', jsonb_build_object('sujet', new.sujet));
      end if;
      if old.merci is null and new.merci is not null and new.mentor_id is not null then
        perform public.pousser(new.mentor_id, 'merci', jsonb_build_object('nom', (select full_name from public.profiles where id = new.student_id)));
      end if;
    end if;
  elsif tg_table_name = 'applications' then
    if tg_op = 'INSERT' and new.offer_id is not null then
      select author_id into v_auteur from public.offers where id = new.offer_id;
      perform public.pousser(v_auteur, 'candidature', jsonb_build_object('nom', (select full_name from public.profiles where id = new.student_id), 'titre', new.titre));
    elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('entretien', 'retenu') then
      perform public.pousser(new.student_id, 'candidature_statut', jsonb_build_object('titre', new.titre, 'statut', new.status));
    end if;
  elsif tg_table_name = 'placements' then
    if tg_op = 'INSERT' and new.status = 'en_attente' then
      perform public.pousser(new.student_id, 'recrutement_a_confirmer', jsonb_build_object('nom', (select full_name from public.profiles where id = new.laureat_id), 'entreprise', new.entreprise));
    elsif tg_op = 'UPDATE' and old.status = 'en_attente' and new.status = 'confirme' then
      perform public.pousser(new.laureat_id, 'recrutement_confirme', jsonb_build_object('nom', (select full_name from public.profiles where id = new.student_id), 'entreprise', new.entreprise));
    end if;
  elsif tg_table_name = 'invitations' then
    perform public.pousser(new.student_id, 'invitation', jsonb_build_object('nom', (select full_name from public.profiles where id = new.laureat_id), 'titre', (select titre from public.offers where id = new.offer_id)));
  elsif tg_table_name = 'answers' then
    select author_id, titre into v_auteur, v_titre from public.questions where id = new.question_id;
    perform public.pousser(v_auteur, 'reponse', jsonb_build_object('nom', (select full_name from public.profiles where id = new.author_id), 'titre', v_titre));
  elsif tg_table_name = 'questions' then
    if coalesce(new.entreprise, '') <> '' or coalesce(new.pays, '') <> '' then
      insert into public.push_queue (user_id, kind, data)
      select p.id, 'question_routee', jsonb_build_object('cible', coalesce(nullif(new.entreprise, ''), new.pays), 'titre', new.titre)
      from public.profiles p
      where p.role = 'laureat' and p.id <> new.author_id
        and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
        and ((coalesce(new.entreprise, '') <> '' and public.meme_entreprise(p.entreprise, new.entreprise))
          or (public.cle_lieu(new.pays) <> 'maroc' and public.cle_lieu(p.pays) = public.cle_lieu(new.pays)))
      limit 40;
    end if;
  elsif tg_table_name = 'parrainages' then
    perform public.pousser(new.parrain_id, 'filleul', jsonb_build_object('nom', (select full_name from public.profiles where id = new.filleul_id)));
    perform public.pousser(new.filleul_id, 'parrain', jsonb_build_object('nom', (select full_name from public.profiles where id = new.parrain_id)));
  elsif tg_table_name = 'cafes' then
    insert into public.push_queue (user_id, kind, data)
    select p.id, 'cafe', jsonb_build_object('ville', new.ville, 'lieu', new.lieu, 'date_at', new.date_at)
    from public.profiles p
    where p.id <> new.organisateur_id and public.cle_lieu(p.ville) = public.cle_lieu(new.ville)
      and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
    limit 200;
  end if;
  return null;
exception when others then return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['mentorships','applications','placements','invitations','answers','questions','parrainages','cafes'] loop
    execute format('drop trigger if exists trg_notif on public.%I', t);
  end loop;
end $$;
create trigger trg_notif after insert or update on public.mentorships for each row execute function public.notif_evenements();
create trigger trg_notif after insert or update on public.applications for each row execute function public.notif_evenements();
create trigger trg_notif after insert or update on public.placements for each row execute function public.notif_evenements();
create trigger trg_notif after insert on public.invitations for each row execute function public.notif_evenements();
create trigger trg_notif after insert on public.answers for each row execute function public.notif_evenements();
create trigger trg_notif after insert on public.questions for each row execute function public.notif_evenements();
create trigger trg_notif after insert on public.parrainages for each row execute function public.notif_evenements();
create trigger trg_notif after insert on public.cafes for each row execute function public.notif_evenements();

-- Rappel une heure avant chaque rendez-vous de mentorat (toutes les 10 minutes)
create or replace function public.rappels_rdv() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select m.id, m.student_id, m.mentor_id, m.sujet, m.rdv_at from public.mentorships m
      where m.status = 'acceptee' and m.rdv_at between now() + interval '5 minutes' and now() + interval '65 minutes'
        and not exists (select 1 from public.rappels_envoyes x where x.id = m.id and x.rdv_at = m.rdv_at) loop
    insert into public.rappels_envoyes (id, rdv_at) values (r.id, r.rdv_at) on conflict (id) do update set rdv_at = excluded.rdv_at, created_at = now();
    perform public.pousser(r.student_id, 'rappel_rdv', jsonb_build_object('nom', (select full_name from public.profiles where id = r.mentor_id), 'sujet', r.sujet, 'rdv_at', r.rdv_at));
    perform public.pousser(r.mentor_id, 'rappel_rdv', jsonb_build_object('nom', (select full_name from public.profiles where id = r.student_id), 'sujet', r.sujet, 'rdv_at', r.rdv_at));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.rappels_rdv() from public, anon, authenticated;

-- Relance douce : « Ton offre est-elle toujours ouverte ? » après 3 semaines sans activité
create or replace function public.relances_offres() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select o.id, o.author_id, o.titre from public.offers o
      where o.status = 'ouverte'
        and greatest(o.created_at, coalesce(o.verifiee_at, o.created_at),
              coalesce((select max(a.created_at) from public.applications a where a.offer_id = o.id), o.created_at),
              coalesce((select max(c.created_at) from public.comments c where c.offer_id = o.id), o.created_at)) < now() - interval '21 days'
        and (o.relance_at is null or o.relance_at < now() - interval '21 days') loop
    update public.offers set relance_at = now() where id = r.id;
    perform public.pousser(r.author_id, 'relance_offre', jsonb_build_object('titre', r.titre));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.relances_offres() from public, anon, authenticated;

create or replace function public.taches_quotidiennes() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.relances_offres();
  perform public.attribuer_parrains();
  perform public.appeler_notifier('resume');
end $$;
revoke all on function public.taches_quotidiennes() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.destinataires_resume(int) to service_role;
    grant execute on function public.prendre_push(int) to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Sécurité ligne par ligne (RLS)
-- Règle générale : tout membre connecté lit, chacun écrit ce qui lui appartient,
-- l'admin modère tout.
-- ---------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.offers             enable row level security;
alter table public.comments           enable row level security;
alter table public.reactions          enable row level security;
alter table public.applications       enable row level security;
alter table public.placements         enable row level security;
alter table public.mentorships        enable row level security;
alter table public.questions          enable row level security;
alter table public.answers            enable row level security;
alter table public.votes              enable row level security;
alter table public.shortlists         enable row level security;
alter table public.invitations        enable row level security;
alter table public.liens_rdv          enable row level security;
alter table public.annonces           enable row level security;
alter table public.kudos              enable row level security;
alter table public.attestations       enable row level security;
alter table public.groupe_messages    enable row level security;
alter table public.groupe_membres     enable row level security;
alter table public.cafes              enable row level security;
alter table public.cafe_participants  enable row level security;
alter table public.startups           enable row level security;
alter table public.defis              enable row level security;
alter table public.parrainages        enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_queue         enable row level security;
alter table public.app_secrets        enable row level security;
alter table public.notif_etat         enable row level security;
alter table public.rappels_envoyes    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles','offers','comments','reactions','applications','placements','mentorships','questions','answers','votes',
                       'shortlists','invitations','kudos','attestations','liens_rdv','annonces',
                       'groupe_messages','groupe_membres','cafes','cafe_participants','startups','defis','parrainages','push_subscriptions'] loop
    execute format('drop policy if exists "lecture membres" on public.%I', t);
    execute format('drop policy if exists "ecriture proprietaire" on public.%I', t);
    execute format('drop policy if exists "modif proprietaire" on public.%I', t);
    execute format('drop policy if exists "suppression proprietaire" on public.%I', t);
  end loop;
end $$;

-- Lecture
create policy "lecture membres" on public.profiles     for select to authenticated using (true);
-- Les offres « entre lauréats » ne sont visibles que des lauréats (et de l'administration)
create policy "lecture membres" on public.offers       for select to authenticated using (
  audience = 'etudiants' or author_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('laureat','admin')));
create policy "lecture membres" on public.comments     for select to authenticated using (exists (select 1 from public.offers o where o.id = comments.offer_id));
create policy "lecture membres" on public.reactions    for select to authenticated using (true);
create policy "lecture membres" on public.placements   for select to authenticated using (true);
create policy "lecture membres" on public.mentorships  for select to authenticated using (true);
create policy "lecture membres" on public.questions    for select to authenticated using (true);
create policy "lecture membres" on public.answers      for select to authenticated using (true);
create policy "lecture membres" on public.votes        for select to authenticated using (true);
-- Les candidatures sont privées : l'étudiant, l'auteur de l'offre et l'admin
create policy "lecture membres" on public.applications for select to authenticated using (
  student_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.offers o where o.id = offer_id and o.author_id = auth.uid())
);

-- Création
create policy "ecriture proprietaire" on public.profiles     for insert to authenticated with check (id = auth.uid());
create policy "ecriture proprietaire" on public.offers       for insert to authenticated with check (author_id = auth.uid());
create policy "ecriture proprietaire" on public.comments     for insert to authenticated with check (author_id = auth.uid());
create policy "ecriture proprietaire" on public.reactions    for insert to authenticated with check (user_id = auth.uid());
create policy "ecriture proprietaire" on public.applications for insert to authenticated with check (student_id = auth.uid());
create policy "ecriture proprietaire" on public.placements   for insert to authenticated with check (student_id = auth.uid() or laureat_id = auth.uid() or public.is_admin());
create policy "ecriture proprietaire" on public.mentorships  for insert to authenticated with check (student_id = auth.uid());
create policy "ecriture proprietaire" on public.questions    for insert to authenticated with check (author_id = auth.uid());
create policy "ecriture proprietaire" on public.answers      for insert to authenticated with check (author_id = auth.uid());
create policy "ecriture proprietaire" on public.votes        for insert to authenticated with check (user_id = auth.uid());

-- Modification
create policy "modif proprietaire" on public.profiles     for update to authenticated using (id = auth.uid() or public.is_admin());
create policy "modif proprietaire" on public.offers       for update to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "modif proprietaire" on public.comments     for update to authenticated using (author_id = auth.uid());
create policy "modif proprietaire" on public.applications for update to authenticated using (
  student_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.offers o where o.id = offer_id and o.author_id = auth.uid())
);
create policy "modif proprietaire" on public.placements   for update to authenticated using (student_id = auth.uid() or laureat_id = auth.uid() or public.is_admin());
-- Une demande ouverte à tous peut être prise par un lauréat (le premier qui choisit un horaire l'emporte)
create policy "modif proprietaire" on public.mentorships  for update to authenticated using (student_id = auth.uid() or mentor_id = auth.uid() or public.is_admin() or (mentor_id is null and status = 'demande'));
create policy "modif proprietaire" on public.questions    for update to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "modif proprietaire" on public.answers      for update to authenticated using (author_id = auth.uid());

-- Suppression
create policy "suppression proprietaire" on public.profiles     for delete to authenticated using (id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.offers       for delete to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.comments     for delete to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.reactions    for delete to authenticated using (user_id = auth.uid());
create policy "suppression proprietaire" on public.applications for delete to authenticated using (student_id = auth.uid());
create policy "suppression proprietaire" on public.placements   for delete to authenticated using (student_id = auth.uid() or (laureat_id = auth.uid() and status = 'en_attente') or public.is_admin());
create policy "suppression proprietaire" on public.mentorships  for delete to authenticated using (student_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.questions    for delete to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.answers      for delete to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.votes        for delete to authenticated using (user_id = auth.uid());

-- Nouvelles tables : vivier, bravos, attestations, liens de visio, annonces
-- Shortlist : privée au lauréat
create policy "lecture membres" on public.shortlists for select to authenticated using (laureat_id = auth.uid() or public.is_admin());
create policy "ecriture proprietaire" on public.shortlists for insert to authenticated with check (laureat_id = auth.uid());
create policy "modif proprietaire" on public.shortlists for update to authenticated using (laureat_id = auth.uid());
create policy "suppression proprietaire" on public.shortlists for delete to authenticated using (laureat_id = auth.uid());
-- Invitations : le lauréat qui invite et l'étudiant invité
create policy "lecture membres" on public.invitations for select to authenticated using (laureat_id = auth.uid() or student_id = auth.uid() or public.is_admin());
create policy "ecriture proprietaire" on public.invitations for insert to authenticated with check (laureat_id = auth.uid());
create policy "modif proprietaire" on public.invitations for update to authenticated using (student_id = auth.uid() or laureat_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.invitations for delete to authenticated using (laureat_id = auth.uid() or public.is_admin());
-- Liens de visio : l'étudiant et le lauréat du rendez-vous ; le lauréat peut mettre son propre lien (Meet, Teams…)
create policy "lecture membres" on public.liens_rdv for select to authenticated using (public.is_admin()
  or exists (select 1 from public.mentorships m where m.id = liens_rdv.id and (m.student_id = auth.uid() or m.mentor_id = auth.uid())));
create policy "ecriture proprietaire" on public.liens_rdv for insert to authenticated with check (
  exists (select 1 from public.mentorships m where m.id = liens_rdv.id and m.mentor_id = auth.uid()));
create policy "modif proprietaire" on public.liens_rdv for update to authenticated using (
  exists (select 1 from public.mentorships m where m.id = liens_rdv.id and m.mentor_id = auth.uid()));
-- Annonces : tout le monde les lit, l'administration les écrit
create policy "lecture membres" on public.annonces for select to authenticated using (true);
create policy "ecriture proprietaire" on public.annonces for insert to authenticated with check (public.is_admin());
create policy "modif proprietaire" on public.annonces for update to authenticated using (public.is_admin());
create policy "suppression proprietaire" on public.annonces for delete to authenticated using (public.is_admin());
-- Bravos
create policy "lecture membres" on public.kudos for select to authenticated using (true);
create policy "ecriture proprietaire" on public.kudos for insert to authenticated with check (user_id = auth.uid());
create policy "suppression proprietaire" on public.kudos for delete to authenticated using (user_id = auth.uid());
-- Attestations : le lauréat ; la vérification publique passe par attestation_publique()
create policy "lecture membres" on public.attestations for select to authenticated using (laureat_id = auth.uid() or public.is_admin());
create policy "ecriture proprietaire" on public.attestations for insert to authenticated with check (laureat_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.attestations for delete to authenticated using (laureat_id = auth.uid() or public.is_admin());

-- Phase 2
-- Groupes : tout le monde lit, chacun écrit ses messages et choisit les groupes qu'il suit
create policy "lecture membres" on public.groupe_messages for select to authenticated using (true);
create policy "ecriture proprietaire" on public.groupe_messages for insert to authenticated with check (author_id = auth.uid());
create policy "suppression proprietaire" on public.groupe_messages for delete to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "lecture membres" on public.groupe_membres for select to authenticated using (true);
create policy "ecriture proprietaire" on public.groupe_membres for insert to authenticated with check (user_id = auth.uid());
create policy "suppression proprietaire" on public.groupe_membres for delete to authenticated using (user_id = auth.uid());
-- Cafés : l'organisateur gère son café, chacun s'inscrit et se désinscrit
create policy "lecture membres" on public.cafes for select to authenticated using (true);
create policy "ecriture proprietaire" on public.cafes for insert to authenticated with check (organisateur_id = auth.uid() or public.is_admin());
create policy "modif proprietaire" on public.cafes for update to authenticated using (organisateur_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.cafes for delete to authenticated using (organisateur_id = auth.uid() or public.is_admin());
create policy "lecture membres" on public.cafe_participants for select to authenticated using (true);
create policy "ecriture proprietaire" on public.cafe_participants for insert to authenticated with check (user_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.cafe_participants for delete to authenticated using (user_id = auth.uid() or public.is_admin());
-- Startups : publiées par des lauréats
create policy "lecture membres" on public.startups for select to authenticated using (true);
create policy "ecriture proprietaire" on public.startups for insert to authenticated with check (
  fondateur_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('laureat','admin')));
create policy "modif proprietaire" on public.startups for update to authenticated using (fondateur_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.startups for delete to authenticated using (fondateur_id = auth.uid() or public.is_admin());
-- Défis : lancés par l'administration
create policy "lecture membres" on public.defis for select to authenticated using (true);
create policy "ecriture proprietaire" on public.defis for insert to authenticated with check (public.is_admin());
create policy "modif proprietaire" on public.defis for update to authenticated using (public.is_admin());
create policy "suppression proprietaire" on public.defis for delete to authenticated using (public.is_admin());
-- Parrainages : visibles du parrain et du filleul ; créés par la base (mon_parrain, attribuer_parrains)
create policy "lecture membres" on public.parrainages for select to authenticated using (filleul_id = auth.uid() or parrain_id = auth.uid() or public.is_admin());
create policy "ecriture proprietaire" on public.parrainages for insert to authenticated with check (public.is_admin());
create policy "suppression proprietaire" on public.parrainages for delete to authenticated using (public.is_admin());
-- Abonnements aux notifications : chacun voit et retire les siens (l'ajout passe par abonner_push)
create policy "lecture membres" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "suppression proprietaire" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());
-- push_queue, app_secrets, notif_etat, rappels_envoyes : aucune règle, donc inaccessibles depuis le site

-- ---------------------------------------------------------------------
-- Temps réel : la plateforme se met à jour toute seule chez tout le monde
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['profiles','offers','comments','reactions','applications','placements','mentorships','questions','answers','votes',
                       'shortlists','invitations','kudos','attestations','liens_rdv','annonces',
                       'groupe_messages','groupe_membres','cafes','cafe_participants','startups','defis','parrainages'] loop
      if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Tâches automatiques (Supabase : extensions pg_net et pg_cron)
--   toutes les 10 min : rappel une heure avant chaque rendez-vous
--   chaque matin      : relance douce des offres, parrains des 3A, résumé hebdomadaire par email
-- Sans ces extensions, la plateforme marche normalement, sans ces envois.
-- ---------------------------------------------------------------------
do $$ begin
  begin create extension if not exists pg_net; exception when others then raise notice 'pg_net indisponible : %', sqlerrm; end;
  begin create extension if not exists pg_cron; exception when others then raise notice 'pg_cron indisponible : %', sqlerrm; end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ensam-rappels', '*/10 * * * *', 'select public.rappels_rdv()');
    perform cron.schedule('ensam-quotidien', '0 8 * * *', 'select public.taches_quotidiennes()');
  end if;
end $$;

-- =====================================================================
-- APRÈS votre inscription sur la plateforme, devenez administrateur :
--   update public.profiles set role = 'admin', verified = true
--   where id = (select id from auth.users where email = 'VOTRE_EMAIL');
-- =====================================================================
