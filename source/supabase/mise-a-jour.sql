-- =====================================================================
--  Réseau ENSAM Meknès · Mise à jour de la base
--  Ajoute ce qui manque (Phase 2 : groupes, cafés, startups, défis, parrainage,
--  notifications, résumé par email ; Phase 3 : CV, entretiens, avis de stage, guide
--  étranger, alertes, contact, signalements, visibilité, limites, enquête d’insertion,
--  liste officielle, agenda, vérification par les pairs ; messagerie privée avec
--  photos et vocaux) sans toucher aux comptes, offres ni candidatures existants. Relançable sans risque.
--  Supabase > SQL Editor > New query : colle tout ce fichier, puis Run.
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
  if auth.uid() is null or public.is_admin() then
    -- L'administration retire une vérification : les confirmations des camarades de promo partent aussi
    if tg_op = 'UPDATE' and old.verified and not new.verified then
      begin delete from public.verifications_pairs where laureat_id = new.id; exception when others then null; end;
    end if;
    return new;
  end if;
  -- Email de l'école obligatoire pour les étudiants (si l'administration l'a demandé)
  if new.role = 'etudiant' and (tg_op = 'INSERT' or old.role <> 'etudiant') then
    begin
      if exists (select 1 from public.reglages where cle = 'email_ecole_obligatoire' and valeur = 'true'::jsonb)
         and cardinality(public.domaines_ecole()) > 0 and not public.email_ecole(new.id) then
        raise exception using message = 'Inscris-toi avec ton email de l’école (@' || array_to_string(public.domaines_ecole(), ', @') || ').', errcode = 'P0001', hint = 'email_ecole';
      end if;
    exception when others then
      if sqlerrm like 'Inscris-toi avec ton email%' then raise; end if;
    end;
  end if;
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
  -- Vérifié tout seul : présent dans la liste officielle de l'école (même email, ou même nom et même promo),
  -- étudiant inscrit avec l'email de l'école, ou lauréat confirmé par deux lauréats vérifiés de sa promo
  begin
    if not new.verified and (public.dans_liste(new.id, new.full_name, new.promo)
        or (new.role = 'etudiant' and public.email_ecole(new.id))
        or (new.role = 'laureat' and public.pairs_valides(new.id, new.promo) >= 2)) then
      new.verified := true;
    end if;
  exception when others then null;
  end;
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
-- Profils : la table complète n'est lisible que par soi-même et l'administration ;
-- les membres lisent la vue « profils » (Phase 3), qui respecte la visibilité choisie par chacun
create policy "lecture membres" on public.profiles     for select to authenticated using (id = auth.uid() or public.is_admin());
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
--  Phase 3 : CV en PDF et relecture, banque d'entretiens, avis de stage,
--  guide de l'étranger, alertes d'offres, coordonnées après accord,
--  visibilité du profil, signalements, limites anti-spam,
--  enquête d'insertion et liste officielle des étudiants.
-- =====================================================================

-- Profils : CV déposé (chemin dans le stockage privé « cv »), visibilité choisie, alertes
alter table public.profiles add column if not exists cv_path text;
alter table public.profiles add column if not exists cv_maj timestamptz;
alter table public.profiles add column if not exists visibilite jsonb not null default '{}';
alter table public.profiles add column if not exists alertes_offres boolean not null default true;
alter table public.profiles add column if not exists alertes_email boolean not null default true;
alter table public.profiles add column if not exists emails_messages boolean not null default true;

-- visibilite : { travail, lieu, linkedin, presentation, cv } -> tous | laureats | contacts
create or replace function public.visibilite_valide(v jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(coalesce(v, '{}')) = 'object' and not exists (
    select 1 from jsonb_each(coalesce(v, '{}')) e
    where e.key not in ('travail','lieu','linkedin','presentation','cv') or e.value #>> '{}' not in ('tous','laureats','contacts'));
$$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_visibilite_check') then
    alter table public.profiles add constraint profiles_visibilite_check check (public.visibilite_valide(visibilite));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_cv_path_check') then
    alter table public.profiles add constraint profiles_cv_path_check check (cv_path is null or (split_part(cv_path, '/', 1) = id::text and cv_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}\.pdf$'));
  end if;
end $$;

-- Niveau d'un membre (même calcul que le site : 3, 4, 5 ; 6 = jeune diplômé ; 7 = plus ancien)
create or replace function public.niveau_de(p_promo int, p_saison int) returns int
language sql immutable as $$
  select case when p_promo is null then 7
    when p_saison + 6 - p_promo <= 0 then 1
    when p_saison + 6 - p_promo <= 5 then p_saison + 6 - p_promo
    when p_promo = p_saison then 6 else 7 end;
$$;

-- Nom comparable : « EL AMRANI Salma » et « Salma El-Amrani » donnent « amrani el salma »
create or replace function public.cle_nom(t text) returns text
language sql immutable as $$
  select nullif(array_to_string(array(
    select x from unnest(regexp_split_to_array(regexp_replace(lower(translate(coalesce(t, ''),
      'ÀÂÄÁÃÉÈÊËÍÎÏÌÓÔÖÒÕÚÛÜÙÇÑàâäáãéèêëíîïìóôöòõúûüùçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')), '[^a-z]+', ' ', 'g'), ' ')) x
    where x <> '' order by x), ' '), '');
$$;

-- ---------------------------------------------------------------------
-- Coordonnées personnelles : visibles seulement après accord
--   par soi-même, l'administration, et les personnes « en relation » :
--   une demande de contact acceptée (dans un sens ou dans l'autre),
--   ou l'auteur d'une offre à laquelle l'étudiant a postulé.
-- ---------------------------------------------------------------------
create table if not exists public.coordonnees (
  id uuid primary key references public.profiles(id) on delete cascade,
  telephone text check (char_length(telephone) <= 30),
  email text check (char_length(email) <= 120),
  contact text check (char_length(contact) <= 200),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.demandes_contact (
  id uuid primary key default gen_random_uuid(),
  demandeur_id uuid not null references public.profiles(id) on delete cascade,
  cible_id uuid not null references public.profiles(id) on delete cascade,
  message text check (char_length(message) <= 300),
  status text not null default 'envoyee' check (status in ('envoyee','acceptee','refusee')),
  created_at timestamptz default now(),
  repondu_at timestamptz,
  unique (demandeur_id, cible_id),
  check (demandeur_id <> cible_id)
);

create or replace function public.en_relation(p_viewer uuid, p_owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_viewer is not null and p_owner is not null and (
    exists (select 1 from public.demandes_contact d where d.status = 'acceptee'
      and ((d.demandeur_id = p_viewer and d.cible_id = p_owner) or (d.demandeur_id = p_owner and d.cible_id = p_viewer)))
    or exists (select 1 from public.applications a join public.offers o on o.id = a.offer_id
      where a.student_id = p_owner and o.author_id = p_viewer));
$$;

create or replace function public.protect_demande_contact() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.demandeur_id := auth.uid(); new.status := 'envoyee'; new.repondu_at := null; new.created_at := now();
    if new.cible_id = auth.uid() then raise exception 'Choisis un autre membre que toi.'; end if;
    return new;
  end if;
  v_status := new.status;
  new := old;
  -- Seule la personne contactée répond ; elle peut aussi retirer plus tard son accord
  if auth.uid() = old.cible_id and v_status in ('acceptee','refusee') and v_status <> old.status then
    new.status := v_status; new.repondu_at := now();
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_demande_contact on public.demandes_contact;
create trigger trg_protect_demande_contact before insert or update on public.demandes_contact
  for each row execute function public.protect_demande_contact();

-- Le champ « contact » du profil (lisible par tous) part dans les coordonnées privées,
-- y compris quand une ancienne version du site l'envoie encore.
insert into public.coordonnees (id, contact)
  select id, left(trim(contact), 200) from public.profiles where coalesce(trim(contact), '') <> ''
  on conflict (id) do nothing;
update public.profiles set contact = null where contact is not null;

create or replace function public.contact_vers_coordonnees() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(new.contact), '') <> '' then
    insert into public.coordonnees (id, contact) values (new.id, left(trim(new.contact), 200))
      on conflict (id) do update set contact = excluded.contact, updated_at = now();
  end if;
  if new.contact is not null then update public.profiles set contact = null where id = new.id; end if;
  return null;
end $$;
drop trigger if exists trg_contact_vers_coordonnees on public.profiles;
create trigger trg_contact_vers_coordonnees after insert or update of contact on public.profiles
  for each row when (new.contact is not null) execute function public.contact_vers_coordonnees();

create or replace function public.coordonnees_maj() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  return new;
end $$;
drop trigger if exists trg_coordonnees_maj on public.coordonnees;
create trigger trg_coordonnees_maj before insert or update on public.coordonnees
  for each row execute function public.coordonnees_maj();

-- ---------------------------------------------------------------------
-- Visibilité du profil : chaque membre choisit qui voit son travail, sa ville,
-- son LinkedIn, sa présentation et son CV. Le nom, le rôle, la filière, la promo
-- et le pays restent visibles des membres (le réseau en a besoin pour fonctionner).
-- La table profiles n'est plus lisible directement que par soi-même et l'administration :
-- les autres passent par la vue « profils », qui masque ce qui doit l'être.
-- ---------------------------------------------------------------------
create or replace function public.voit_champ(p_owner uuid, p_vis jsonb, p_champ text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare a text := coalesce(p_vis ->> p_champ, case p_champ when 'cv' then 'laureats' else 'tous' end);
begin
  if auth.uid() is null then return false; end if;
  if p_owner = auth.uid() or a = 'tous' then return true; end if;
  if public.is_admin() then return true; end if;
  if a = 'laureats' and exists (select 1 from public.profiles where id = auth.uid() and role = 'laureat') then return true; end if;
  return public.en_relation(auth.uid(), p_owner);
end $$;

create or replace view public.profils with (security_barrier = true) as
select p.id, p.full_name, p.role, p.filiere, p.promo,
  case when public.voit_champ(p.id, p.visibilite, 'travail') then p.entreprise end as entreprise,
  case when public.voit_champ(p.id, p.visibilite, 'travail') then p.poste end as poste,
  case when public.voit_champ(p.id, p.visibilite, 'lieu') then p.ville end as ville,
  p.pays,
  case when public.voit_champ(p.id, p.visibilite, 'presentation') then p.bio end as bio,
  case when public.voit_champ(p.id, p.visibilite, 'presentation') then p.competences else '{}'::text[] end as competences,
  case when public.voit_champ(p.id, p.visibilite, 'linkedin') then p.linkedin end as linkedin,
  null::text as contact,
  case when public.voit_champ(p.id, p.visibilite, 'cv') then p.cv_url end as cv_url,
  case when public.voit_champ(p.id, p.visibilite, 'presentation') then p.disponibilite end as disponibilite,
  p.mentor_dispo, p.mentor_sujets, p.vitrine, p.verified, p.created_at,
  case when public.voit_champ(p.id, p.visibilite, 'travail') then p.secteur end as secteur,
  case when p.id = auth.uid() then p.consent_at end as consent_at,
  case when p.id = auth.uid() then p.emails_hebdo end as emails_hebdo,
  p.langue, p.parrain_dispo,
  case when public.voit_champ(p.id, p.visibilite, 'cv') then p.cv_path end as cv_path,
  case when public.voit_champ(p.id, p.visibilite, 'cv') then p.cv_maj end as cv_maj,
  case when p.id = auth.uid() then p.visibilite else '{}'::jsonb end as visibilite,
  case when p.id = auth.uid() then p.alertes_offres end as alertes_offres,
  case when p.id = auth.uid() then p.alertes_email end as alertes_email,
  case when p.id = auth.uid() then p.emails_messages end as emails_messages
from public.profiles p
where auth.uid() is not null;
revoke all on public.profils from public, anon;
grant select on public.profils to authenticated;

-- Une ligne par table dont la vue publique change : le site s'abonne à cette petite table
-- (le temps réel ne passe pas par les vues) et recharge la vue concernée.
create table if not exists public.maj_tables (
  cle text primary key check (char_length(cle) <= 40),
  maj timestamptz not null default now()
);
create or replace function public.signaler_maj() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.maj_tables (cle, maj) values (tg_argv[0], now()) on conflict (cle) do update set maj = now();
  return null;
exception when others then return null;
end $$;
drop trigger if exists trg_maj_tables on public.profiles;
create trigger trg_maj_tables after insert or update or delete on public.profiles
  for each statement execute function public.signaler_maj('profiles');

-- ---------------------------------------------------------------------
-- Relecture de CV par un lauréat (à un lauréat précis ou à tous), avec des commentaires
-- ---------------------------------------------------------------------
create table if not exists public.relectures_cv (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  cv_path text not null check (char_length(cv_path) <= 200),
  message text check (char_length(message) <= 600),
  status text not null default 'demandee' check (status in ('demandee','en_cours','rendue','annulee')),
  synthese text check (char_length(synthese) <= 2000),
  merci text check (char_length(merci) <= 800),
  note int check (note between 1 and 5),
  created_at timestamptz default now(),
  pris_at timestamptz,
  rendue_at timestamptz
);
create index if not exists relectures_cv_ouvertes on public.relectures_cv (created_at) where reviewer_id is null and status = 'demandee';

create table if not exists public.relecture_commentaires (
  id uuid primary key default gen_random_uuid(),
  relecture_id uuid not null references public.relectures_cv(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  section text not null default 'general' check (section in ('general','profil','formation','experience','projets','competences','langues','mise_en_page')),
  body text not null check (char_length(body) between 1 and 1500),
  created_at timestamptz default now()
);
create index if not exists relecture_commentaires_relecture on public.relecture_commentaires (relecture_id);

create or replace function public.protect_relecture() returns trigger
language plpgsql security definer set search_path = public as $$
declare v public.relectures_cv%rowtype; v_role text;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  select role into v_role from public.profiles where id = auth.uid();
  if tg_op = 'INSERT' then
    new.student_id := auth.uid();
    select cv_path into new.cv_path from public.profiles where id = auth.uid();
    if new.cv_path is null then raise exception 'Dépose d’abord ton CV en PDF dans ton profil.'; end if;
    if new.reviewer_id = auth.uid() then raise exception 'Choisis un autre lauréat que toi.'; end if;
    if new.reviewer_id is not null and not exists (select 1 from public.profiles where id = new.reviewer_id and role = 'laureat') then
      raise exception 'Choisis un lauréat.';
    end if;
    if (select count(*) from public.relectures_cv where student_id = auth.uid() and status in ('demandee','en_cours')) >= 2 then
      raise exception 'Tu as déjà 2 relectures en cours. Attends un retour avant d’en demander une autre.';
    end if;
    new.status := 'demandee'; new.synthese := null; new.merci := null; new.note := null;
    new.pris_at := null; new.rendue_at := null; new.created_at := now();
    return new;
  end if;
  v := new;
  new := old;
  -- Un lauréat prend une demande ouverte à tous
  if old.reviewer_id is null and old.status = 'demandee' and v.reviewer_id = auth.uid() and auth.uid() <> old.student_id then
    if v_role is distinct from 'laureat' then raise exception 'Seul un lauréat peut relire un CV.'; end if;
    new.reviewer_id := auth.uid();
  end if;
  if new.reviewer_id = auth.uid() and auth.uid() <> old.student_id then
    if old.status in ('demandee','en_cours') then
      new.synthese := v.synthese;
      if v.reviewer_id is null then
        new.reviewer_id := null; new.status := 'demandee'; new.pris_at := null;   -- passer la main : la demande redevient ouverte à tous
      elsif v.status = 'rendue' then
        if coalesce(trim(v.synthese), '') = '' and not exists (select 1 from public.relecture_commentaires c where c.relecture_id = old.id and c.author_id = auth.uid()) then
          raise exception 'Ajoute au moins un commentaire avant de rendre la relecture.';
        end if;
        new.status := 'rendue'; new.rendue_at := now(); new.pris_at := coalesce(old.pris_at, now());
      elsif old.status = 'demandee' then
        new.status := 'en_cours'; new.pris_at := now();
      end if;
    end if;
    return new;
  end if;
  if auth.uid() = old.student_id then
    if old.status in ('demandee','en_cours') and v.status = 'annulee' then new.status := 'annulee'; end if;
    if old.status = 'demandee' then new.message := v.message; end if;
    if old.status = 'rendue' then new.merci := v.merci; new.note := v.note; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_relecture on public.relectures_cv;
create trigger trg_protect_relecture before insert or update on public.relectures_cv
  for each row execute function public.protect_relecture();

create or replace function public.protect_relecture_commentaire() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.relectures_cv%rowtype;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  select * into r from public.relectures_cv where id = new.relecture_id;
  new.author_id := auth.uid(); new.created_at := now();
  if r.id is null or r.status = 'annulee' then raise exception 'Cette relecture n’est plus ouverte.'; end if;
  if auth.uid() = r.reviewer_id and r.status in ('demandee','en_cours','rendue') then return new; end if;
  if auth.uid() = r.student_id and r.reviewer_id is not null then new.section := 'general'; return new; end if;
  raise exception 'Seuls l’étudiant et le lauréat qui relit peuvent commenter.';
end $$;
drop trigger if exists trg_protect_relecture_commentaire on public.relecture_commentaires;
create trigger trg_protect_relecture_commentaire before insert on public.relecture_commentaires
  for each row execute function public.protect_relecture_commentaire();

-- Lecture d'un CV déposé : soi-même, l'administration, le lauréat qui le relit (ou tout lauréat
-- pour une demande ouverte à tous), sinon selon la visibilité choisie pour « CV »
create or replace function public.peut_voir_cv(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_owner uuid; v_vis jsonb;
begin
  if auth.uid() is null then return false; end if;
  begin v_owner := split_part(p_name, '/', 1)::uuid; exception when others then return false; end;
  if v_owner = auth.uid() or public.is_admin() then return true; end if;
  if exists (select 1 from public.relectures_cv r where r.cv_path = p_name and r.status <> 'annulee'
      and (r.reviewer_id = auth.uid() or (r.reviewer_id is null and r.status = 'demandee'
        and exists (select 1 from public.profiles l where l.id = auth.uid() and l.role = 'laureat')))) then
    return true;
  end if;
  select visibilite into v_vis from public.profiles where id = v_owner and cv_path = p_name;
  if not found then return false; end if;
  return public.voit_champ(v_owner, v_vis, 'cv');
end $$;

-- ---------------------------------------------------------------------
-- Banque d'entretiens : les questions posées, par entreprise, partagées après l'entretien
-- Avis de stage : note et conseils pour les promos suivantes
-- (anonymes si l'auteur le souhaite : la vue publique masque alors l'auteur)
-- ---------------------------------------------------------------------
create table if not exists public.entretiens (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  entreprise text not null check (char_length(entreprise) between 2 and 80),
  poste text check (char_length(poste) <= 100),
  type text not null default 'stage' check (type in ('stage','pfe','etranger','emploi')),
  saison int check (saison between 2000 and 2100),
  format text check (format in ('presentiel','visio','telephone','test_ecrit','autre')),
  questions text[] not null default '{}' check (cardinality(questions) between 1 and 20 and char_length(array_to_string(questions, '')) <= 4000),
  deroulement text check (char_length(deroulement) <= 2000),
  conseils text check (char_length(conseils) <= 1500),
  difficulte int check (difficulte between 1 and 5),
  resultat text check (resultat in ('retenu','refuse','attente','inconnu')),
  anonyme boolean not null default false,
  offer_id uuid references public.offers(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists entretiens_entreprise on public.entretiens (public.cle_entreprise(entreprise));

create table if not exists public.avis_stage (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  entreprise text not null check (char_length(entreprise) between 2 and 80),
  ville text check (char_length(ville) <= 60),
  pays text default 'Maroc' check (char_length(pays) <= 60),
  type text not null default 'stage' check (type in ('stage','pfe','etranger','emploi')),
  saison int not null check (saison between 2000 and 2100),
  poste text check (char_length(poste) <= 100),
  note int not null check (note between 1 and 5),
  note_encadrement int check (note_encadrement between 1 and 5),
  note_apprentissage int check (note_apprentissage between 1 and 5),
  note_ambiance int check (note_ambiance between 1 and 5),
  gratification text check (gratification in ('non','symbolique','correcte','bonne')),
  conseils text check (char_length(conseils) <= 1500),
  recommande boolean,
  anonyme boolean not null default true,
  placement_id uuid references public.placements(id) on delete set null,
  verifie boolean not null default false,
  created_at timestamptz default now()
);
create unique index if not exists avis_stage_un_par_saison on public.avis_stage (author_id, coalesce(public.cle_entreprise(entreprise), lower(entreprise)), saison);

create or replace function public.protect_entretien() returns trigger
language plpgsql security definer set search_path = public as $$
declare v public.entretiens%rowtype;
begin
  new.questions := array(select left(trim(x), 300) from unnest(coalesce(new.questions, '{}')) x where trim(x) <> '' limit 20);
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.author_id := auth.uid(); new.created_at := now();
    if new.offer_id is not null and not exists (select 1 from public.applications a where a.offer_id = new.offer_id and a.student_id = auth.uid()) then
      new.offer_id := null;
    end if;
    return new;
  end if;
  v := new; new := old;
  new.poste := v.poste; new.format := v.format; new.questions := v.questions; new.deroulement := v.deroulement;
  new.conseils := v.conseils; new.difficulte := v.difficulte; new.resultat := v.resultat; new.anonyme := v.anonyme;
  return new;
end $$;
drop trigger if exists trg_protect_entretien on public.entretiens;
create trigger trg_protect_entretien before insert or update on public.entretiens
  for each row execute function public.protect_entretien();

-- Un avis est « vérifié » quand il correspond à une réussite confirmée par l'étudiant et le lauréat
create or replace function public.protect_avis() returns trigger
language plpgsql security definer set search_path = public as $$
declare v public.avis_stage%rowtype;
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.author_id := auth.uid(); new.created_at := now();
    else
      v := new; new := old;
      new.ville := v.ville; new.pays := v.pays; new.poste := v.poste; new.note := v.note;
      new.note_encadrement := v.note_encadrement; new.note_apprentissage := v.note_apprentissage; new.note_ambiance := v.note_ambiance;
      new.gratification := v.gratification; new.conseils := v.conseils; new.recommande := v.recommande; new.anonyme := v.anonyme;
    end if;
  end if;
  if new.placement_id is not null and not exists (select 1 from public.placements p where p.id = new.placement_id and p.student_id = new.author_id) then
    new.placement_id := null;
  end if;
  if new.placement_id is null then
    select p.id into new.placement_id from public.placements p
      where p.student_id = new.author_id and p.saison = new.saison and p.status <> 'refuse' and public.meme_entreprise(p.entreprise, new.entreprise)
      order by (p.status = 'confirme') desc limit 1;
  end if;
  new.verifie := exists (select 1 from public.placements p where p.id = new.placement_id and p.status = 'confirme');
  return new;
end $$;
drop trigger if exists trg_protect_avis on public.avis_stage;
create trigger trg_protect_avis before insert or update on public.avis_stage
  for each row execute function public.protect_avis();

create or replace view public.entretiens_publics with (security_barrier = true) as
select e.id,
  case when e.anonyme and e.author_id is distinct from auth.uid() and not public.is_admin() then null else e.author_id end as author_id,
  e.entreprise, e.poste, e.type, e.saison, e.format, e.questions, e.deroulement, e.conseils, e.difficulte, e.resultat, e.anonyme,
  case when e.anonyme and e.author_id is distinct from auth.uid() and not public.is_admin() then null else e.offer_id end as offer_id,
  e.created_at
from public.entretiens e
where auth.uid() is not null;
revoke all on public.entretiens_publics from public, anon;
grant select on public.entretiens_publics to authenticated;

create or replace view public.avis_publics with (security_barrier = true) as
select a.id,
  case when a.anonyme and a.author_id is distinct from auth.uid() and not public.is_admin() then null else a.author_id end as author_id,
  a.entreprise, a.ville, a.pays, a.type, a.saison, a.poste, a.note, a.note_encadrement, a.note_apprentissage, a.note_ambiance,
  a.gratification, a.conseils, a.recommande, a.anonyme,
  case when a.anonyme and a.author_id is distinct from auth.uid() and not public.is_admin() then null else a.placement_id end as placement_id,
  a.verifie, a.created_at
from public.avis_stage a
where auth.uid() is not null;
revoke all on public.avis_publics from public, anon;
grant select on public.avis_publics to authenticated;

drop trigger if exists trg_maj_tables on public.entretiens;
create trigger trg_maj_tables after insert or update or delete on public.entretiens
  for each statement execute function public.signaler_maj('entretiens');
drop trigger if exists trg_maj_tables on public.avis_stage;
create trigger trg_maj_tables after insert or update or delete on public.avis_stage
  for each statement execute function public.signaler_maj('avis_stage');

-- ---------------------------------------------------------------------
-- Guide de l'étranger : une page par pays et par rubrique, écrite par les lauréats
-- qui y vivent (pays du profil), avec l'historique des versions.
-- ---------------------------------------------------------------------
create table if not exists public.guide_pays (
  id uuid primary key default gen_random_uuid(),
  pays text not null check (char_length(pays) between 2 and 60),
  pays_cle text generated always as (public.cle_lieu(pays)) stored,
  section text not null check (section in ('campus_france','visa','convention','logement','budget','stage','vie')),
  contenu text not null check (char_length(contenu) between 1 and 4000),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (pays_cle, section)
);

create table if not exists public.guide_pays_historique (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.guide_pays(id) on delete cascade,
  contenu text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists guide_pays_historique_guide on public.guide_pays_historique (guide_id, created_at desc);

create or replace function public.protect_guide() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.pays := old.pays; new.section := old.section; new.created_at := old.created_at;
    if new.contenu is distinct from old.contenu then
      insert into public.guide_pays_historique (guide_id, contenu, updated_by, updated_at) values (old.id, old.contenu, old.updated_by, old.updated_at);
    end if;
  end if;
  if auth.uid() is not null and not public.is_admin() then
    if public.cle_lieu(new.pays) = 'maroc' or not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'laureat' and public.cle_lieu(p.pays) = public.cle_lieu(new.pays)) then
      raise exception 'Seuls les lauréats qui vivent dans ce pays peuvent écrire son guide.';
    end if;
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by); new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_protect_guide on public.guide_pays;
create trigger trg_protect_guide before insert or update on public.guide_pays
  for each row execute function public.protect_guide();

-- ---------------------------------------------------------------------
-- Signalements : n'importe quel membre signale un contenu ; l'administration décide
-- ---------------------------------------------------------------------
create table if not exists public.signalements (
  id uuid primary key default gen_random_uuid(),
  auteur_id uuid not null references public.profiles(id) on delete cascade,
  cible_type text not null check (cible_type in ('offre','commentaire','question','reponse','message','profil','entretien','avis','guide','cafe','startup','relecture')),
  cible_id uuid not null,
  motif text not null check (motif in ('spam','arnaque','inapproprie','faux','harcelement','donnees','autre')),
  details text check (char_length(details) <= 600),
  status text not null default 'ouvert' check (status in ('ouvert','traite','rejete')),
  traite_par uuid references public.profiles(id) on delete set null,
  traite_at timestamptz,
  created_at timestamptz default now(),
  unique (auteur_id, cible_type, cible_id)
);

create or replace function public.protect_signalement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.auteur_id := auth.uid(); end if;
    new.status := 'ouvert'; new.traite_par := null; new.traite_at := null; new.created_at := now();
    return new;
  end if;
  if new.status is distinct from old.status then new.traite_par := auth.uid(); new.traite_at := now(); end if;
  return new;
end $$;
drop trigger if exists trg_protect_signalement on public.signalements;
create trigger trg_protect_signalement before insert or update on public.signalements
  for each row execute function public.protect_signalement();

-- ---------------------------------------------------------------------
-- Réglages de l'administration : domaines de l'email de l'école
-- (ex. « edu.umi.ac.ma »), et s'il est obligatoire pour l'inscription des étudiants.
-- Lisibles sans compte (l'écran d'inscription les affiche).
-- ---------------------------------------------------------------------
create table if not exists public.reglages (
  cle text primary key check (cle in ('domaines_ecole','email_ecole_obligatoire')),
  valeur jsonb not null,
  updated_at timestamptz default now()
);

create or replace function public.domaines_ecole() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array(select lower(trim(x)) from jsonb_array_elements_text(
    (select valeur from public.reglages where cle = 'domaines_ecole' and jsonb_typeof(valeur) = 'array')) x where trim(x) <> ''), '{}');
$$;

create or replace function public.email_ecole(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth.users u, unnest(public.domaines_ecole()) d
    where u.id = p_id and (lower(u.email) like '%@' || d or lower(u.email) like '%.' || d));
$$;
revoke all on function public.email_ecole(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Vérification d'un lauréat par deux lauréats déjà vérifiés de la même promo
-- (l'administration peut toujours vérifier ou retirer la vérification)
-- ---------------------------------------------------------------------
create table if not exists public.verifications_pairs (
  id uuid primary key default gen_random_uuid(),
  laureat_id uuid not null references public.profiles(id) on delete cascade,
  verificateur_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (laureat_id, verificateur_id),
  check (laureat_id <> verificateur_id)
);

create or replace function public.pairs_valides(p_id uuid, p_promo int) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.verifications_pairs v join public.profiles x on x.id = v.verificateur_id
  where v.laureat_id = p_id and x.role = 'laureat' and x.verified and x.promo = p_promo;
$$;

create or replace function public.protect_verification_pair() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.profiles%rowtype; v public.profiles%rowtype;
begin
  if auth.uid() is not null and not public.is_admin() then new.verificateur_id := auth.uid(); end if;
  new.created_at := now();
  select * into c from public.profiles where id = new.laureat_id;
  select * into v from public.profiles where id = new.verificateur_id;
  if c.role is distinct from 'laureat' then raise exception 'Seul un profil de lauréat peut être confirmé.'; end if;
  if v.role is distinct from 'laureat' or not v.verified or v.promo <> c.promo then
    raise exception 'Seul un lauréat vérifié de la même promo peut confirmer ce profil.';
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_verification_pair on public.verifications_pairs;
create trigger trg_protect_verification_pair before insert on public.verifications_pairs
  for each row execute function public.protect_verification_pair();

-- Après chaque confirmation : la règle de vérification est réévaluée (dans protect_profile)
create or replace function public.apres_verification_pair() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set verified = verified where id = new.laureat_id and not verified;
  perform public.pousser(new.laureat_id, 'verification_pair', jsonb_build_object(
    'nom', (select full_name from public.profiles where id = new.verificateur_id),
    'n', public.pairs_valides(new.laureat_id, (select promo from public.profiles where id = new.laureat_id))));
  return null;
end $$;
drop trigger if exists trg_apres_verification_pair on public.verifications_pairs;
create trigger trg_apres_verification_pair after insert on public.verifications_pairs
  for each row execute function public.apres_verification_pair();

-- Un nouveau lauréat non vérifié : ses camarades de promo déjà vérifiés sont prévenus (5 au plus)
create or replace function public.nouveau_laureat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'laureat' and not new.verified then
    insert into public.push_queue (user_id, kind, data)
    select x.id, 'verifier_pair', jsonb_build_object('nom', new.full_name, 'promo', new.promo)
    from public.profiles x
    where x.role = 'laureat' and x.verified and x.promo = new.promo and x.id <> new.id
      and exists (select 1 from public.push_subscriptions s where s.user_id = x.id)
    limit 5;
  end if;
  return null;
exception when others then return null;
end $$;
drop trigger if exists trg_nouveau_laureat on public.profiles;
create trigger trg_nouveau_laureat after insert on public.profiles
  for each row execute function public.nouveau_laureat();

-- ---------------------------------------------------------------------
-- Agenda de l'école, publié par l'administration : forum, conférences, portes ouvertes…
-- Chacun peut dire « J'y vais ».
-- ---------------------------------------------------------------------
create table if not exists public.evenements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  titre text not null check (char_length(titre) between 3 and 140),
  type text not null default 'autre' check (type in ('forum','conference','portes_ouvertes','atelier','soutenance','autre')),
  debut timestamptz not null,
  fin timestamptz,
  lieu text check (char_length(lieu) <= 140),
  lien text check (lien ~* '^https://[^\s]+$' and char_length(lien) <= 300),
  description text check (char_length(description) <= 2000),
  public text not null default 'tous' check (public in ('tous','etudiants','laureats')),
  annule boolean not null default false,
  created_at timestamptz default now(),
  check (fin is null or fin >= debut)
);
create index if not exists evenements_debut on public.evenements (debut);

create table if not exists public.evenement_participants (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (evenement_id, user_id)
);

create or replace function public.protect_evenement_participant() returns trigger
language plpgsql security definer set search_path = public as $$
declare e public.evenements%rowtype;
begin
  if auth.uid() is not null and not public.is_admin() then new.user_id := auth.uid(); end if;
  select * into e from public.evenements where id = new.evenement_id;
  if e.annule then raise exception 'Cet événement est annulé.'; end if;
  if coalesce(e.fin, e.debut) < now() then raise exception 'Cet événement est déjà passé.'; end if;
  return new;
end $$;
drop trigger if exists trg_protect_evenement_participant on public.evenement_participants;
create trigger trg_protect_evenement_participant before insert on public.evenement_participants
  for each row execute function public.protect_evenement_participant();

create or replace function public.notif_evenement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or (not old.annule and new.annule) or new.debut is distinct from old.debut then
    insert into public.push_queue (user_id, kind, data)
    select p.id, case when tg_op = 'INSERT' then 'evenement' when new.annule then 'evenement_annule' else 'evenement_deplace' end,
      jsonb_build_object('titre', new.titre, 'debut', new.debut, 'lieu', new.lieu)
    from public.profiles p
    where p.id is distinct from new.author_id
      and (new.public = 'tous' or (new.public = 'etudiants' and p.role = 'etudiant') or (new.public = 'laureats' and p.role = 'laureat'))
      and (tg_op = 'INSERT' or exists (select 1 from public.evenement_participants x where x.evenement_id = new.id and x.user_id = p.id))
      and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
    limit 2000;
  end if;
  return null;
exception when others then return null;
end $$;
drop trigger if exists trg_notif on public.evenements;
create trigger trg_notif after insert or update on public.evenements for each row execute function public.notif_evenement();

-- ---------------------------------------------------------------------
-- Enquête d'insertion automatique : invitation (email + téléphone) à l'ouverture
-- de chaque vague, puis un seul rappel 3 semaines après si pas de réponse.
--   6 mois  : du 1er janvier au 30 juin qui suivent l'année du diplôme
--   12 mois : du 1er juillet qui suit jusqu'au 31 mars d'après
-- ---------------------------------------------------------------------
alter table public.notif_etat add column if not exists enquete_vague int;
alter table public.notif_etat add column if not exists enquete_at timestamptz;
alter table public.notif_etat add column if not exists enquete_rappel_at timestamptz;

create or replace function public.vague_ouverte(p_promo int, p_jour date default current_date) returns int
language sql immutable as $$
  select case when p_jour >= make_date(p_promo + 1, 1, 1) and p_jour < make_date(p_promo + 1, 7, 1) then 6
              when p_jour >= make_date(p_promo + 1, 7, 1) and p_jour < make_date(p_promo + 2, 4, 1) then 12 end;
$$;

create or replace function public.enquetes_a_inviter(p_max int default 100)
returns table (id uuid, email text, langue text, token uuid, vague int, rappel boolean, email_ok boolean)
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notif_etat (user_id) select p.id from public.profiles p on conflict (user_id) do nothing;
  return query
    select p.id, u.email::text, p.langue, n.token, public.vague_ouverte(p.promo),
      (n.enquete_vague is not distinct from public.vague_ouverte(p.promo)) as rappel,
      (p.emails_hebdo and u.email is not null) as email_ok
    from public.profiles p join auth.users u on u.id = p.id join public.notif_etat n on n.user_id = p.id
    where p.role <> 'admin' and (p.role = 'laureat' or public.niveau_de(p.promo, public.saison_courante()) >= 6)
      and public.vague_ouverte(p.promo) is not null
      and not exists (select 1 from public.enquetes_insertion e where e.user_id = p.id and e.vague = public.vague_ouverte(p.promo))
      and (n.enquete_vague is distinct from public.vague_ouverte(p.promo)
        or (n.enquete_rappel_at is null and n.enquete_at < now() - interval '21 days'))
    order by n.enquete_at nulls first
    limit greatest(0, least(p_max, 150));
end $$;
revoke all on function public.enquetes_a_inviter(int) from public, anon, authenticated;

-- Marque les invitations parties et prévient aussi sur le téléphone
create or replace function public.enquetes_invitees(p_lignes jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare x jsonb; n int := 0; v uuid; g int;
begin
  for x in select * from jsonb_array_elements(coalesce(p_lignes, '[]')) loop
    v := (x ->> 'id')::uuid; g := (x ->> 'vague')::int;
    if coalesce((x ->> 'rappel')::boolean, false) then
      update public.notif_etat set enquete_rappel_at = now() where user_id = v;
    else
      update public.notif_etat set enquete_vague = g, enquete_at = now(), enquete_rappel_at = null where user_id = v;
    end if;
    perform public.pousser(v, 'enquete', jsonb_build_object('vague', g));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.enquetes_invitees(jsonb) from public, anon, authenticated;

create or replace function public.taches_quotidiennes() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.relances_offres();
  perform public.attribuer_parrains();
  perform public.appeler_notifier('resume');
  perform public.appeler_notifier('enquetes');
end $$;
revoke all on function public.taches_quotidiennes() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.enquetes_a_inviter(int) to service_role;
    grant execute on function public.enquetes_invitees(jsonb) to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Taux d'insertion par promo et filière, pour les rapports officiels et l'accréditation
-- (administration seulement) : effectif de la liste officielle, inscrits, répondants à l'enquête,
-- en poste, en recherche, en études, à l'étranger, délai médian, satisfaction.
-- ---------------------------------------------------------------------
create or replace function public.rapport_insertion()
returns table (promo int, filiere text, vague int, effectif int, inscrits int, repondants int, en_poste int, recherche int, etudes int, etranger int,
  taux_insertion numeric, taux_reponse numeric, delai_median numeric, satisfaction numeric, lien_formation numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l’administration.'; end if;
  return query
  with cohortes as (
    select p.promo, p.filiere, count(*)::int as inscrits from public.profiles p
    where p.role <> 'admin' and p.promo <= extract(year from now())::int and p.promo >= extract(year from now())::int - 6
    group by p.promo, p.filiere),
  vagues as (select c.*, v.vague from cohortes c cross join (values (6), (12)) v(vague)),
  rep as (
    select e.promo, e.filiere, e.vague, count(*)::int n,
      count(*) filter (where e.situation in ('emploi','entrepreneur','volontariat'))::int ep,
      count(*) filter (where e.situation = 'recherche')::int rch,
      count(*) filter (where e.situation = 'etudes')::int etu,
      count(*) filter (where e.situation in ('emploi','entrepreneur','volontariat') and public.cle_lieu(e.pays) is not null and public.cle_lieu(e.pays) <> 'maroc')::int etr,
      (percentile_cont(0.5) within group (order by e.delai_mois))::numeric med,
      round(avg(e.satisfaction)::numeric, 1) sat, round(avg(e.lien_formation)::numeric, 1) lf
    from public.enquetes_insertion e group by e.promo, e.filiere, e.vague),
  liste as (select l.promo, public.cle_lieu(l.filiere) f, count(*)::int n from public.liste_officielle l group by l.promo, public.cle_lieu(l.filiere))
  select v.promo, v.filiere, v.vague, li.n, v.inscrits, coalesce(r.n, 0), coalesce(r.ep, 0), coalesce(r.rch, 0), coalesce(r.etu, 0), coalesce(r.etr, 0),
    case when coalesce(r.n, 0) - coalesce(r.etu, 0) > 0 then round(r.ep::numeric / (r.n - r.etu), 3) end,
    case when coalesce(li.n, v.inscrits) > 0 then round(coalesce(r.n, 0)::numeric / coalesce(li.n, v.inscrits), 3) end,
    r.med, r.sat, r.lf
  from vagues v
  left join rep r on r.promo = v.promo and r.filiere = v.filiere and r.vague = v.vague
  left join liste li on li.promo = v.promo and li.f = public.cle_lieu(v.filiere)
  where r.n is not null or v.promo <= extract(year from now())::int - 1
  order by v.promo desc, v.filiere, v.vague;
end $$;
revoke all on function public.rapport_insertion() from public, anon;
grant execute on function public.rapport_insertion() to authenticated;

-- ---------------------------------------------------------------------
-- Sécurité ligne par ligne (suite)
-- ---------------------------------------------------------------------
alter table public.reglages               enable row level security;
alter table public.verifications_pairs    enable row level security;
alter table public.evenements             enable row level security;
alter table public.evenement_participants enable row level security;

do $$
declare t text;
begin
  foreach t in array array['reglages','verifications_pairs','evenements','evenement_participants'] loop
    execute format('drop policy if exists "lecture membres" on public.%I', t);
    execute format('drop policy if exists "ecriture proprietaire" on public.%I', t);
    execute format('drop policy if exists "modif proprietaire" on public.%I', t);
    execute format('drop policy if exists "suppression proprietaire" on public.%I', t);
  end loop;
end $$;
-- Réglages : lisibles par tous (même sans compte), modifiés par l'administration
create policy "lecture membres" on public.reglages for select to anon, authenticated using (true);
create policy "ecriture proprietaire" on public.reglages for insert to authenticated with check (public.is_admin());
create policy "modif proprietaire" on public.reglages for update to authenticated using (public.is_admin());
create policy "suppression proprietaire" on public.reglages for delete to authenticated using (public.is_admin());
grant select on public.reglages to anon;
-- Confirmations entre lauréats : visibles des membres ; on retire la sienne
create policy "lecture membres" on public.verifications_pairs for select to authenticated using (true);
create policy "ecriture proprietaire" on public.verifications_pairs for insert to authenticated with check (verificateur_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.verifications_pairs for delete to authenticated using (verificateur_id = auth.uid() or public.is_admin());
-- Agenda : tout le monde lit, l'administration publie ; chacun s'inscrit et se désinscrit
create policy "lecture membres" on public.evenements for select to authenticated using (true);
create policy "ecriture proprietaire" on public.evenements for insert to authenticated with check (public.is_admin());
create policy "modif proprietaire" on public.evenements for update to authenticated using (public.is_admin());
create policy "suppression proprietaire" on public.evenements for delete to authenticated using (public.is_admin());
create policy "lecture membres" on public.evenement_participants for select to authenticated using (true);
create policy "ecriture proprietaire" on public.evenement_participants for insert to authenticated with check (user_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.evenement_participants for delete to authenticated using (user_id = auth.uid() or public.is_admin());

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['reglages','verifications_pairs','evenements','evenement_participants'] loop
      if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Limites anti-spam : nombre de publications par personne et par période,
-- et pas deux fois exactement le même texte en 24 h. L'administration n'est pas limitée.
-- limiter(colonne de l'auteur, maximum, période[, colonne du texte])
-- ---------------------------------------------------------------------
create or replace function public.limiter() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; v_col text := tg_argv[0]; v_max int := tg_argv[1]::int; v_par interval := tg_argv[2]::interval;
  v_txt text := case when tg_nargs > 3 then tg_argv[3] end;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  execute format('select count(*) from public.%I where %I = $1 and created_at > now() - $2', tg_table_name, v_col) into n using auth.uid(), v_par;
  if n >= v_max then raise exception 'Doucement : tu as beaucoup publié en peu de temps. Réessaie un peu plus tard.'; end if;
  if v_txt is not null and coalesce(trim(to_jsonb(new) ->> v_txt), '') <> '' then
    execute format('select count(*) from public.%I where %I = $1 and lower(trim(%I)) = lower(trim($2)) and created_at > now() - interval ''1 day''', tg_table_name, v_col, v_txt)
      into n using auth.uid(), to_jsonb(new) ->> v_txt;
    if n > 0 then raise exception 'Tu as déjà publié exactement ce texte.'; end if;
  end if;
  return new;
end $$;

do $$
declare r record;
begin
  for r in select * from (values
      ('offers', 'author_id', '10', '1 day', 'titre'),
      ('comments', 'author_id', '40', '1 day', 'body'),
      ('questions', 'author_id', '5', '1 day', 'titre'),
      ('answers', 'author_id', '30', '1 day', 'body'),
      ('groupe_messages', 'author_id', '60', '1 day', 'body'),
      ('invitations', 'laureat_id', '30', '1 day', null),
      ('applications', 'student_id', '10', '1 day', null),
      ('mentorships', 'student_id', '6', '1 day', null),
      ('cafes', 'organisateur_id', '3', '1 day', null),
      ('startups', 'fondateur_id', '3', '1 day', null),
      ('entretiens', 'author_id', '10', '1 day', null),
      ('avis_stage', 'author_id', '10', '1 day', null),
      ('demandes_contact', 'demandeur_id', '5', '1 day', null),
      ('signalements', 'auteur_id', '10', '1 day', null),
      ('relectures_cv', 'student_id', '4', '1 day', null),
      ('relecture_commentaires', 'author_id', '60', '1 hour', null),
      ('evenement_participants', 'user_id', '30', '1 day', null),
      ('verifications_pairs', 'verificateur_id', '20', '1 day', null)
    ) as t(tbl, col, mx, par, txt) loop
    execute format('drop trigger if exists trg_limite on public.%I', r.tbl);
    if r.txt is null then
      execute format('create trigger trg_limite before insert on public.%I for each row execute function public.limiter(%L, %L, %L)', r.tbl, r.col, r.mx, r.par);
    else
      execute format('create trigger trg_limite before insert on public.%I for each row execute function public.limiter(%L, %L, %L, %L)', r.tbl, r.col, r.mx, r.par, r.txt);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Enquête d'insertion des lauréats, à 6 et à 12 mois après le diplôme.
-- Réponses individuelles : la personne et l'administration seulement.
-- Résultats : agrégés par stats_insertion(), sans détail sous 5 réponses.
-- ---------------------------------------------------------------------
create table if not exists public.enquetes_insertion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vague int not null check (vague in (6, 12)),
  promo int not null check (promo between 1990 and 2040),
  filiere text,
  situation text not null check (situation in ('emploi','entrepreneur','recherche','etudes','volontariat','autre')),
  contrat text check (contrat in ('cdi','cdd','anapec','freelance','stage','autre')),
  secteur text check (char_length(secteur) <= 60),
  entreprise text check (char_length(entreprise) <= 80),
  pays text check (char_length(pays) <= 60),
  ville text check (char_length(ville) <= 60),
  delai_mois int check (delai_mois between 0 and 36),
  salaire text check (salaire in ('lt6','6_10','10_15','15_20','20_30','gt30','nsp')),
  lien_formation int check (lien_formation between 1 and 5),
  satisfaction int check (satisfaction between 1 and 5),
  canal text check (canal in ('reseau_ensam','plateforme','linkedin','stage','candidature','concours','autre')),
  commentaire text check (char_length(commentaire) <= 600),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, vague)
);

create or replace function public.protect_enquete() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profiles%rowtype;
begin
  if tg_op = 'UPDATE' then new.user_id := old.user_id; new.vague := old.vague; new.created_at := old.created_at; end if;
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then new.user_id := auth.uid(); new.created_at := now(); end if;
    select * into p from public.profiles where id = new.user_id;
    if p.role is distinct from 'laureat' and public.niveau_de(p.promo, public.saison_courante()) < 6 then raise exception 'L’enquête s’adresse aux lauréats.'; end if;
    new.promo := p.promo; new.filiere := p.filiere;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_protect_enquete on public.enquetes_insertion;
create trigger trg_protect_enquete before insert or update on public.enquetes_insertion
  for each row execute function public.protect_enquete();

create or replace function public.stats_insertion() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb; m int := case when public.is_admin() then 1 else 5 end;
begin
  if auth.uid() is null then raise exception 'Connecte-toi d’abord.'; end if;
  with e as (select * from public.enquetes_insertion),
  g as (
    select e.promo, e.vague, count(*) as n,
      count(*) filter (where situation in ('emploi','entrepreneur','volontariat')) as en_poste,
      count(*) filter (where situation = 'recherche') as recherche,
      count(*) filter (where situation = 'etudes') as etudes,
      count(*) filter (where situation in ('emploi','entrepreneur','volontariat') and public.cle_lieu(pays) is not null and public.cle_lieu(pays) <> 'maroc') as etranger,
      percentile_cont(0.5) within group (order by delai_mois) as delai_median,
      round(avg(lien_formation)::numeric, 1) as lien_formation,
      round(avg(satisfaction)::numeric, 1) as satisfaction
    from e group by e.promo, e.vague)
  select coalesce(jsonb_agg(jsonb_build_object(
      'promo', g.promo, 'vague', g.vague, 'n', g.n, 'en_poste', g.en_poste, 'recherche', g.recherche, 'etudes', g.etudes,
      'etranger', g.etranger, 'delai_median', g.delai_median, 'lien_formation', g.lien_formation, 'satisfaction', g.satisfaction,
      'canaux', (select jsonb_object_agg(c, k) from (select canal c, count(*) k from public.enquetes_insertion x where x.promo = g.promo and x.vague = g.vague and canal is not null group by canal) t),
      'secteurs', case when g.n >= m then (select jsonb_object_agg(s, k) from (select secteur s, count(*) k from public.enquetes_insertion x where x.promo = g.promo and x.vague = g.vague and secteur is not null group by secteur having count(*) >= least(m, 2)) t) end,
      'salaires', case when g.n >= m then (select jsonb_object_agg(s, k) from (select salaire s, count(*) k from public.enquetes_insertion x where x.promo = g.promo and x.vague = g.vague and salaire is not null and salaire <> 'nsp' group by salaire) t) end,
      'filieres', (select jsonb_object_agg(f, jsonb_build_object('n', k, 'en_poste', ep)) from (
          select filiere f, count(*) k, count(*) filter (where situation in ('emploi','entrepreneur','volontariat')) ep
          from public.enquetes_insertion x where x.promo = g.promo and x.vague = g.vague and filiere is not null group by filiere having count(*) >= m) t)
    ) order by g.promo desc, g.vague), '[]'::jsonb) into r
  from g where g.n >= m;  -- en dessous de 5 réponses, seuls les chiffres de l'administration existent
  return r;
end $$;
revoke all on function public.stats_insertion() from public, anon;
grant execute on function public.stats_insertion() to authenticated;

-- ---------------------------------------------------------------------
-- Liste officielle des étudiants (fournie par l'école, importée par l'administration).
-- Un membre qui y figure (même email, ou même nom et même promo) est vérifié tout seul.
-- ---------------------------------------------------------------------
create table if not exists public.liste_officielle (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(nom) between 2 and 120),
  email text check (char_length(email) <= 160),
  promo int not null check (promo between 1990 and 2040),
  filiere text check (char_length(filiere) <= 80),
  matricule text check (char_length(matricule) <= 40),
  created_at timestamptz default now()
);
create unique index if not exists liste_officielle_nom_promo on public.liste_officielle ((public.cle_nom(nom)), promo);
create index if not exists liste_officielle_email on public.liste_officielle (email);

create or replace function public.dans_liste(p_id uuid, p_nom text, p_promo int) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.liste_officielle l
    where (l.promo = p_promo and public.cle_nom(l.nom) = public.cle_nom(p_nom))
       or (l.email is not null and l.email = (select lower(u.email) from auth.users u where u.id = p_id)));
$$;
revoke all on function public.dans_liste(uuid, text, int) from public, anon, authenticated;

create or replace function public.importer_liste(p_lignes jsonb, p_remplacer boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare x jsonb; v_nom text; v_promo int; v_email text; n_ok int := 0; n_rej int := 0; n_verif int := 0; v_promos int[] := '{}';
begin
  if not public.is_admin() then raise exception 'Réservé à l’administration.'; end if;
  if jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) > 5000 then raise exception 'Liste invalide (5000 lignes au plus).'; end if;
  if p_remplacer then
    select coalesce(array_agg(distinct (e ->> 'promo')::int), '{}') into v_promos from jsonb_array_elements(p_lignes) e where (e ->> 'promo') ~ '^\d{4}$';
    delete from public.liste_officielle where promo = any(v_promos);
  end if;
  for x in select * from jsonb_array_elements(p_lignes) loop
    v_nom := left(regexp_replace(trim(coalesce(x ->> 'nom', '')), '\s+', ' ', 'g'), 120);
    v_promo := case when (x ->> 'promo') ~ '^\d{4}$' then (x ->> 'promo')::int end;
    v_email := nullif(lower(trim(coalesce(x ->> 'email', ''))), '');
    if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_email := null; end if;
    if char_length(v_nom) < 2 or public.cle_nom(v_nom) is null or v_promo is null or v_promo not between 1990 and 2040 then n_rej := n_rej + 1; continue; end if;
    insert into public.liste_officielle (nom, email, promo, filiere, matricule)
      values (v_nom, left(v_email, 160), v_promo, nullif(left(trim(coalesce(x ->> 'filiere', '')), 80), ''), nullif(left(trim(coalesce(x ->> 'matricule', '')), 40), ''))
      on conflict ((public.cle_nom(nom)), promo) do update set
        email = coalesce(excluded.email, liste_officielle.email),
        filiere = coalesce(excluded.filiere, liste_officielle.filiere),
        matricule = coalesce(excluded.matricule, liste_officielle.matricule);
    n_ok := n_ok + 1;
  end loop;
  update public.profiles p set verified = true
    where not p.verified and p.role <> 'admin' and public.dans_liste(p.id, p.full_name, p.promo);
  get diagnostics n_verif = row_count;
  return jsonb_build_object('importes', n_ok, 'rejetes', n_rej, 'verifies', n_verif);
end $$;
revoke all on function public.importer_liste(jsonb, boolean) from public, anon;
grant execute on function public.importer_liste(jsonb, boolean) to authenticated;

-- Couverture : combien d'étudiants de la liste sont inscrits, par promo et filière
create or replace function public.couverture_liste() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'Réservé à l’administration.'; end if;
  with m as (
    select l.promo, coalesce(l.filiere, '') as filiere, exists (
      select 1 from public.profiles p left join auth.users u on u.id = p.id
      where (l.email is not null and lower(u.email) = l.email) or (p.promo = l.promo and public.cle_nom(p.full_name) = public.cle_nom(l.nom))) as inscrit
    from public.liste_officielle l)
  select coalesce(jsonb_agg(jsonb_build_object('promo', promo, 'filiere', filiere, 'total', total, 'inscrits', inscrits) order by promo desc, filiere), '[]'::jsonb) into r
  from (select promo, filiere, count(*) total, count(*) filter (where inscrit) inscrits from m group by promo, filiere) t;
  return r;
end $$;
revoke all on function public.couverture_liste() from public, anon;
grant execute on function public.couverture_liste() to authenticated;

-- Qui manque encore (pour que les ambassadeurs de promo les invitent)
create or replace function public.manquants_liste(p_promo int) returns table (nom text, email text, filiere text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l’administration.'; end if;
  return query select l.nom, l.email, l.filiere from public.liste_officielle l
    where l.promo = p_promo and not exists (
      select 1 from public.profiles p left join auth.users u on u.id = p.id
      where (l.email is not null and lower(u.email) = l.email) or (p.promo = l.promo and public.cle_nom(p.full_name) = public.cle_nom(l.nom)))
    order by l.filiere nulls last, l.nom;
end $$;
revoke all on function public.manquants_liste(int) from public, anon;
grant execute on function public.manquants_liste(int) to authenticated;

-- ---------------------------------------------------------------------
-- Alertes d'offres : dès qu'une offre de son année et de sa filière est publiée,
-- notification sur le téléphone tout de suite, et email groupé (une fois par heure
-- au plus, 3 par jour au plus et par personne, 150 par jour pour toute la plateforme).
-- ---------------------------------------------------------------------
alter table public.notif_etat add column if not exists alerte_at timestamptz;
alter table public.notif_etat add column if not exists alertes_n int not null default 0;
alter table public.notif_etat add column if not exists alertes_jour date;

create or replace function public.offre_pour(o public.offers, p public.profiles, p_saison int) returns boolean
language sql stable as $$
  select o.status = 'ouverte' and coalesce(o.audience, 'etudiants') = 'etudiants' and o.author_id <> p.id
    and p.role in ('etudiant','laureat')
    and public.niveau_de(p.promo, p_saison) = any(coalesce(o.annees, '{}'))
    and (cardinality(coalesce(o.filieres, '{}')) = 0 or p.filiere = any(o.filieres));
$$;

create or replace function public.alerte_offre() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.push_queue (user_id, kind, data)
  select p.id, 'offre_alerte', jsonb_build_object('titre', new.titre, 'entreprise', new.entreprise, 'offre', new.id)
  from public.profiles p
  where p.alertes_offres and public.offre_pour(new, p, public.saison_courante())
    and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
  limit 500;
  return null;
exception when others then return null;
end $$;
drop trigger if exists trg_alerte_offre on public.offers;
create trigger trg_alerte_offre after insert on public.offers
  for each row execute function public.alerte_offre();

create or replace function public.alertes_a_envoyer(p_max int default 100)
returns table (id uuid, email text, langue text, token uuid, offres jsonb)
language plpgsql security definer set search_path = public as $$
declare v_s int := public.saison_courante(); v_reste int;
begin
  insert into public.notif_etat (user_id) select p.id from public.profiles p on conflict (user_id) do nothing;
  select 150 - coalesce(sum(n.alertes_n), 0) into v_reste from public.notif_etat n where n.alertes_jour = current_date;
  if v_reste <= 0 then return; end if;
  return query
    select x.id, x.email, x.langue, x.token, x.offres from (
      select p.id, u.email::text as email, p.langue, n.token, n.alerte_at,
        (select jsonb_agg(jsonb_build_object('id', o.id, 'titre', o.titre, 'entreprise', o.entreprise, 'type', o.type, 'ville', o.ville, 'pays', o.pays, 'deadline', o.deadline) order by o.created_at desc)
          from (select o2.* from public.offers o2
            where o2.created_at > greatest(coalesce(n.alerte_at, p.created_at), p.created_at, now() - interval '3 days')
              and public.offre_pour(o2, p, v_s)
            order by o2.created_at desc limit 5) o) as offres
      from public.profiles p join auth.users u on u.id = p.id join public.notif_etat n on n.user_id = p.id
      where p.alertes_email and u.email is not null
        and (n.alerte_at is null or n.alerte_at < now() - interval '50 minutes')
        and (n.alertes_jour is distinct from current_date or n.alertes_n < 3)) x
    where x.offres is not null
    order by x.alerte_at nulls first
    limit greatest(0, least(p_max, v_reste));
end $$;
revoke all on function public.alertes_a_envoyer(int) from public, anon, authenticated;

create or replace function public.alertes_envoyees(p_ids uuid[]) returns void
language sql security definer set search_path = public as $$
  update public.notif_etat set alerte_at = now(),
    alertes_n = case when alertes_jour = current_date then alertes_n + 1 else 1 end,
    alertes_jour = current_date
  where user_id = any(p_ids);
$$;
revoke all on function public.alertes_envoyees(uuid[]) from public, anon, authenticated;

create or replace function public.se_desabonner_alertes(p_token uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  select user_id into v from public.notif_etat where token = p_token;
  if v is null then return false; end if;
  update public.profiles set alertes_email = false where id = v;
  return true;
end $$;
revoke all on function public.se_desabonner_alertes(uuid) from public;
grant execute on function public.se_desabonner_alertes(uuid) to anon, authenticated;

create or replace function public.alertes_horaires() returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.offers where created_at > now() - interval '3 hours' and status = 'ouverte') then
    perform public.appeler_notifier('alertes');
  end if;
end $$;
revoke all on function public.alertes_horaires() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.alertes_a_envoyer(int) to service_role;
    grant execute on function public.alertes_envoyees(uuid[]) to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Notifications des nouveautés sur le téléphone
-- ---------------------------------------------------------------------
create or replace function public.notif_phase3() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_nom text;
begin
  if tg_table_name = 'demandes_contact' then
    if tg_op = 'INSERT' then
      perform public.pousser(new.cible_id, 'contact_demande', jsonb_build_object('nom', (select full_name from public.profiles where id = new.demandeur_id)));
    elsif old.status <> 'acceptee' and new.status = 'acceptee' then
      perform public.pousser(new.demandeur_id, 'contact_accepte', jsonb_build_object('nom', (select full_name from public.profiles where id = new.cible_id)));
    end if;
  elsif tg_table_name = 'relectures_cv' then
    v_nom := (select full_name from public.profiles where id = new.student_id);
    if tg_op = 'INSERT' then
      if new.reviewer_id is not null then
        perform public.pousser(new.reviewer_id, 'relecture_demande', jsonb_build_object('nom', v_nom));
      else
        insert into public.push_queue (user_id, kind, data)
        select l.id, 'relecture_demande', jsonb_build_object('nom', v_nom)
        from public.profiles l, public.profiles s
        where s.id = new.student_id and l.role = 'laureat' and l.mentor_dispo and l.filiere = s.filiere and l.id <> new.student_id
          and exists (select 1 from public.push_subscriptions x where x.user_id = l.id)
        limit 10;
      end if;
    elsif old.status = 'demandee' and new.status = 'en_cours' then
      perform public.pousser(new.student_id, 'relecture_prise', jsonb_build_object('nom', (select full_name from public.profiles where id = new.reviewer_id)));
    elsif old.status <> 'rendue' and new.status = 'rendue' then
      perform public.pousser(new.student_id, 'relecture_rendue', jsonb_build_object('nom', (select full_name from public.profiles where id = new.reviewer_id)));
    elsif old.merci is null and new.merci is not null and new.reviewer_id is not null then
      perform public.pousser(new.reviewer_id, 'merci', jsonb_build_object('nom', v_nom));
    end if;
  elsif tg_table_name = 'signalements' then
    insert into public.push_queue (user_id, kind, data)
    select a.id, 'signalement', jsonb_build_object('motif', new.motif)
    from public.profiles a where a.role = 'admin' and exists (select 1 from public.push_subscriptions x where x.user_id = a.id)
    limit 10;
  end if;
  return null;
exception when others then return null;
end $$;
drop trigger if exists trg_notif on public.demandes_contact;
create trigger trg_notif after insert or update on public.demandes_contact for each row execute function public.notif_phase3();
drop trigger if exists trg_notif on public.relectures_cv;
create trigger trg_notif after insert or update on public.relectures_cv for each row execute function public.notif_phase3();
drop trigger if exists trg_notif on public.signalements;
create trigger trg_notif after insert on public.signalements for each row execute function public.notif_phase3();

-- ---------------------------------------------------------------------
-- Sécurité ligne par ligne des nouveautés
-- ---------------------------------------------------------------------
alter table public.coordonnees            enable row level security;
alter table public.demandes_contact       enable row level security;
alter table public.maj_tables             enable row level security;
alter table public.relectures_cv          enable row level security;
alter table public.relecture_commentaires enable row level security;
alter table public.entretiens             enable row level security;
alter table public.avis_stage             enable row level security;
alter table public.guide_pays             enable row level security;
alter table public.guide_pays_historique  enable row level security;
alter table public.signalements           enable row level security;
alter table public.enquetes_insertion     enable row level security;
alter table public.liste_officielle       enable row level security;

do $$
declare t text;
begin
  foreach t in array array['coordonnees','demandes_contact','maj_tables','relectures_cv','relecture_commentaires','entretiens','avis_stage',
                       'guide_pays','guide_pays_historique','signalements','enquetes_insertion','liste_officielle'] loop
    execute format('drop policy if exists "lecture membres" on public.%I', t);
    execute format('drop policy if exists "ecriture proprietaire" on public.%I', t);
    execute format('drop policy if exists "modif proprietaire" on public.%I', t);
    execute format('drop policy if exists "suppression proprietaire" on public.%I', t);
  end loop;
end $$;

-- Coordonnées : soi-même, l'administration et les personnes en relation (demande acceptée, candidature)
create policy "lecture membres" on public.coordonnees for select to authenticated using (id = auth.uid() or public.is_admin() or public.en_relation(auth.uid(), id));
create policy "ecriture proprietaire" on public.coordonnees for insert to authenticated with check (id = auth.uid());
create policy "modif proprietaire" on public.coordonnees for update to authenticated using (id = auth.uid());
create policy "suppression proprietaire" on public.coordonnees for delete to authenticated using (id = auth.uid());
-- Demandes de contact : les deux personnes concernées
create policy "lecture membres" on public.demandes_contact for select to authenticated using (demandeur_id = auth.uid() or cible_id = auth.uid() or public.is_admin());
create policy "ecriture proprietaire" on public.demandes_contact for insert to authenticated with check (demandeur_id = auth.uid());
create policy "modif proprietaire" on public.demandes_contact for update to authenticated using (cible_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.demandes_contact for delete to authenticated using ((demandeur_id = auth.uid() and status = 'envoyee') or public.is_admin());
-- Signal de mise à jour des vues
create policy "lecture membres" on public.maj_tables for select to authenticated using (true);
-- Relectures : l'étudiant, le lauréat qui relit, et les lauréats pour les demandes ouvertes à tous
create policy "lecture membres" on public.relectures_cv for select to authenticated using (
  student_id = auth.uid() or reviewer_id = auth.uid() or public.is_admin()
  or (reviewer_id is null and status = 'demandee' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'laureat')));
create policy "ecriture proprietaire" on public.relectures_cv for insert to authenticated with check (student_id = auth.uid());
create policy "modif proprietaire" on public.relectures_cv for update to authenticated using (
  student_id = auth.uid() or reviewer_id = auth.uid() or public.is_admin() or (reviewer_id is null and status = 'demandee'));
create policy "suppression proprietaire" on public.relectures_cv for delete to authenticated using ((student_id = auth.uid() and status in ('demandee','annulee')) or public.is_admin());
create policy "lecture membres" on public.relecture_commentaires for select to authenticated using (
  public.is_admin() or exists (select 1 from public.relectures_cv r where r.id = relecture_id and (r.student_id = auth.uid() or r.reviewer_id = auth.uid())));
create policy "ecriture proprietaire" on public.relecture_commentaires for insert to authenticated with check (author_id = auth.uid());
create policy "suppression proprietaire" on public.relecture_commentaires for delete to authenticated using (author_id = auth.uid() or public.is_admin());
-- Entretiens et avis : la table est privée à l'auteur ; tout le monde lit les vues publiques
create policy "lecture membres" on public.entretiens for select to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "ecriture proprietaire" on public.entretiens for insert to authenticated with check (author_id = auth.uid());
create policy "modif proprietaire" on public.entretiens for update to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.entretiens for delete to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "lecture membres" on public.avis_stage for select to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "ecriture proprietaire" on public.avis_stage for insert to authenticated with check (author_id = auth.uid());
create policy "modif proprietaire" on public.avis_stage for update to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.avis_stage for delete to authenticated using (author_id = auth.uid() or public.is_admin());
-- Guide de l'étranger : tout le monde lit ; les lauréats du pays écrivent (contrôlé par protect_guide)
create policy "lecture membres" on public.guide_pays for select to authenticated using (true);
create policy "ecriture proprietaire" on public.guide_pays for insert to authenticated with check (true);
create policy "modif proprietaire" on public.guide_pays for update to authenticated using (true);
create policy "suppression proprietaire" on public.guide_pays for delete to authenticated using (public.is_admin());
create policy "lecture membres" on public.guide_pays_historique for select to authenticated using (true);
-- Signalements : l'auteur et l'administration
create policy "lecture membres" on public.signalements for select to authenticated using (auteur_id = auth.uid() or public.is_admin());
create policy "ecriture proprietaire" on public.signalements for insert to authenticated with check (auteur_id = auth.uid());
create policy "modif proprietaire" on public.signalements for update to authenticated using (public.is_admin());
create policy "suppression proprietaire" on public.signalements for delete to authenticated using ((auteur_id = auth.uid() and status = 'ouvert') or public.is_admin());
-- Enquête d'insertion : la personne et l'administration
create policy "lecture membres" on public.enquetes_insertion for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "ecriture proprietaire" on public.enquetes_insertion for insert to authenticated with check (user_id = auth.uid());
create policy "modif proprietaire" on public.enquetes_insertion for update to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "suppression proprietaire" on public.enquetes_insertion for delete to authenticated using (user_id = auth.uid() or public.is_admin());
-- Liste officielle : l'administration seulement
create policy "lecture membres" on public.liste_officielle for select to authenticated using (public.is_admin());
create policy "ecriture proprietaire" on public.liste_officielle for insert to authenticated with check (public.is_admin());
create policy "modif proprietaire" on public.liste_officielle for update to authenticated using (public.is_admin());
create policy "suppression proprietaire" on public.liste_officielle for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- Stockage privé des CV (PDF, 2 Mo au plus) : chacun dépose dans son dossier,
-- la lecture suit peut_voir_cv() et passe par des liens temporaires.
-- ---------------------------------------------------------------------
do $$ begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('cv', 'cv', false, 2097152, array['application/pdf'])
    on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['application/pdf'];
  drop policy if exists "cv lecture" on storage.objects;
  drop policy if exists "cv depot" on storage.objects;
  drop policy if exists "cv remplacement" on storage.objects;
  drop policy if exists "cv suppression" on storage.objects;
  create policy "cv lecture" on storage.objects for select to authenticated using (bucket_id = 'cv' and public.peut_voir_cv(name));
  create policy "cv depot" on storage.objects for insert to authenticated with check (
    bucket_id = 'cv' and (storage.foldername(name))[1] = auth.uid()::text and lower(storage.extension(name)) = 'pdf');
  create policy "cv remplacement" on storage.objects for update to authenticated using (bucket_id = 'cv' and (storage.foldername(name))[1] = auth.uid()::text);
  create policy "cv suppression" on storage.objects for delete to authenticated using (
    bucket_id = 'cv' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
exception when others then raise notice 'Stockage des CV non configuré : %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- Temps réel des nouveautés
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['coordonnees','demandes_contact','maj_tables','relectures_cv','relecture_commentaires','guide_pays','signalements','enquetes_insertion'] loop
      if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- Alertes d'offres par email : chaque heure (s'il y a des offres récentes)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ensam-alertes', '5 * * * *', 'select public.alertes_horaires()');
  end if;
end $$;

-- =====================================================================
-- Messagerie : texte, photos et messages vocaux entre deux membres déjà en lien
-- (mentorat, candidature à une offre, coordonnées acceptées, parrainage, relecture de CV),
-- ou avec l'administration. Les fichiers vont dans un stockage privé « chat »,
-- rangés par auteur puis destinataire : <auteur>/<destinataire>/<fichier>.
-- =====================================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  dest_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'texte' check (type in ('texte','photo','vocal')),
  body text check (char_length(body) <= 2000),
  fichier text check (char_length(fichier) <= 300),
  duree int check (duree between 0 and 180),
  largeur int check (largeur between 1 and 10000),
  hauteur int check (hauteur between 1 and 10000),
  onde text check (onde ~ '^[0-9]{0,64}$'),
  lu_at timestamptz,
  created_at timestamptz default now(),
  check (author_id <> dest_id),
  check (type <> 'texte' or char_length(btrim(coalesce(body, ''))) > 0),
  check (type = 'texte' or fichier is not null)
);
create index if not exists messages_dest_lu on public.messages (dest_id, lu_at);
create index if not exists messages_paire on public.messages (author_id, dest_id, created_at desc);

-- « Bloquer » : plus aucun message dans un sens ni dans l'autre
create table if not exists public.blocages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bloque_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, bloque_id),
  check (user_id <> bloque_id)
);

-- Deux membres peuvent s'écrire quand un lien existe déjà entre eux, ou quand l'autre
-- a écrit en premier. L'administration peut écrire à tout le monde. Un blocage ferme tout.
create or replace function public.peut_discuter(p_moi uuid, p_autre uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_moi is not null and p_autre is not null and p_moi <> p_autre
    and (auth.uid() is null or auth.uid() = p_moi)
    and exists (select 1 from public.profiles where id = p_autre)
    and not exists (select 1 from public.blocages b
      where (b.user_id = p_moi and b.bloque_id = p_autre) or (b.user_id = p_autre and b.bloque_id = p_moi))
    and (
      exists (select 1 from public.profiles a where a.id = p_moi and a.role = 'admin')
      or exists (select 1 from public.messages m where m.author_id = p_autre and m.dest_id = p_moi)
      or public.en_relation(p_moi, p_autre) or public.en_relation(p_autre, p_moi)
      or exists (select 1 from public.mentorships m where m.mentor_id is not null and m.status in ('demande','acceptee','terminee')
        and ((m.student_id = p_moi and m.mentor_id = p_autre) or (m.student_id = p_autre and m.mentor_id = p_moi)))
      or exists (select 1 from public.parrainages x
        where (x.parrain_id = p_moi and x.filleul_id = p_autre) or (x.parrain_id = p_autre and x.filleul_id = p_moi))
      or exists (select 1 from public.relectures_cv r where r.reviewer_id is not null and r.status <> 'annulee'
        and ((r.student_id = p_moi and r.reviewer_id = p_autre) or (r.student_id = p_autre and r.reviewer_id = p_moi))));
$$;
revoke all on function public.peut_discuter(uuid, uuid) from public, anon;
grant execute on function public.peut_discuter(uuid, uuid) to authenticated;

create or replace function public.uuid_ou_null(p text) returns uuid
language plpgsql immutable as $$
begin return p::uuid; exception when others then return null; end $$;

create or replace function public.protect_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare v public.messages;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.author_id := auth.uid(); end if;
    new.lu_at := null; new.created_at := now();
    new.body := nullif(btrim(new.body), '');
    if new.type = 'texte' then new.fichier := null; new.duree := null; new.largeur := null; new.hauteur := null; new.onde := null; end if;
    if new.type = 'photo' then new.duree := null; new.onde := null; end if;
    if new.type = 'vocal' then new.body := null; new.largeur := null; new.hauteur := null; end if;
    if new.fichier is not null and new.fichier not like new.author_id::text || '/' || new.dest_id::text || '/%' then
      raise exception 'Fichier invalide.';
    end if;
    if auth.uid() is not null and not public.peut_discuter(new.author_id, new.dest_id) then
      raise exception 'Conversation pas encore ouverte : elle s’ouvre avec un mentorat, une candidature ou une demande de contact acceptée.';
    end if;
    return new;
  end if;
  -- Ensuite, seule la date de lecture change, et seulement par le destinataire
  if auth.uid() is null or public.is_admin() then return new; end if;
  if auth.uid() <> old.dest_id then raise exception 'Action non autorisée pour ton compte.'; end if;
  v := old;
  v.lu_at := coalesce(old.lu_at, case when new.lu_at is not null then now() end);
  return v;
end $$;
drop trigger if exists trg_protect_message on public.messages;
create trigger trg_protect_message before insert or update on public.messages
  for each row execute function public.protect_message();
drop trigger if exists trg_limite on public.messages;
create trigger trg_limite before insert on public.messages
  for each row execute function public.limiter('author_id', '300', '1 day');

create or replace function public.protect_blocage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.user_id := auth.uid(); end if;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists trg_protect_blocage on public.blocages;
create trigger trg_protect_blocage before insert on public.blocages
  for each row execute function public.protect_blocage();

-- Tout ce que l'autre m'a écrit est lu (ouvrir la conversation)
create or replace function public.marquer_lus(p_de uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then return 0; end if;
  update public.messages set lu_at = now() where author_id = p_de and dest_id = auth.uid() and lu_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.marquer_lus(uuid) from public, anon;
grant execute on function public.marquer_lus(uuid) to authenticated;

-- Notification sur le téléphone : une seule pour une rafale de messages
create or replace function public.notif_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.messages m where m.author_id = new.author_id and m.dest_id = new.dest_id and m.id <> new.id
      and m.lu_at is null and m.created_at > now() - interval '10 minutes') then
    return null;
  end if;
  perform public.pousser(new.dest_id, 'message', jsonb_build_object(
    'nom', (select full_name from public.profiles where id = new.author_id), 'de', new.author_id,
    'type', new.type, 'texte', left(coalesce(new.body, ''), 140), 'duree', new.duree));
  return null;
exception when others then return null;
end $$;
drop trigger if exists trg_notif on public.messages;
create trigger trg_notif after insert on public.messages for each row execute function public.notif_message();

-- Signalement d'un message privé : l'administration le voit alors (et seulement alors)
alter table public.signalements drop constraint if exists signalements_cible_type_check;
alter table public.signalements add constraint signalements_cible_type_check
  check (cible_type in ('offre','commentaire','question','reponse','message','profil','entretien','avis','guide','cafe','startup','relecture','prive'));

create or replace function public.message_signale(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.signalements s where s.cible_type = 'prive' and s.cible_id = p_id);
$$;

alter table public.messages enable row level security;
alter table public.blocages enable row level security;
drop policy if exists "lecture membres" on public.messages;
drop policy if exists "ecriture proprietaire" on public.messages;
drop policy if exists "suppression proprietaire" on public.messages;
create policy "lecture membres" on public.messages for select to authenticated using (
  author_id = auth.uid() or dest_id = auth.uid() or (public.is_admin() and public.message_signale(id)));
create policy "ecriture proprietaire" on public.messages for insert to authenticated with check (author_id = auth.uid());
create policy "suppression proprietaire" on public.messages for delete to authenticated using (author_id = auth.uid() or public.is_admin());
drop policy if exists "lecture membres" on public.blocages;
drop policy if exists "ecriture proprietaire" on public.blocages;
drop policy if exists "suppression proprietaire" on public.blocages;
create policy "lecture membres" on public.blocages for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "ecriture proprietaire" on public.blocages for insert to authenticated with check (user_id = auth.uid());
create policy "suppression proprietaire" on public.blocages for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- Photos et vocaux : 5 Mo au plus ; lus par les deux personnes de la conversation seulement
create or replace function public.peut_lire_fichier_chat(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    (storage.foldername(p_name))[1] = auth.uid()::text or (storage.foldername(p_name))[2] = auth.uid()::text
    or (public.is_admin() and exists (select 1 from public.messages m where m.fichier = p_name and public.message_signale(m.id))));
$$;
do $$ begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('chat', 'chat', false, 5242880, array['image/jpeg','image/png','image/webp','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/aac'])
    on conflict (id) do update set public = false, file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/aac'];
  drop policy if exists "chat lecture" on storage.objects;
  drop policy if exists "chat depot" on storage.objects;
  drop policy if exists "chat suppression" on storage.objects;
  create policy "chat lecture" on storage.objects for select to authenticated using (bucket_id = 'chat' and public.peut_lire_fichier_chat(name));
  create policy "chat depot" on storage.objects for insert to authenticated with check (
    bucket_id = 'chat' and (storage.foldername(name))[1] = auth.uid()::text
    and public.peut_discuter(auth.uid(), public.uuid_ou_null((storage.foldername(name))[2])));
  create policy "chat suppression" on storage.objects for delete to authenticated using (
    bucket_id = 'chat' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
exception when others then raise notice 'Stockage de la messagerie non configuré : %', sqlerrm;
end $$;

-- Email quand un message attend depuis 30 minutes sans être lu (un toutes les 6 heures au plus)
alter table public.notif_etat add column if not exists messages_at timestamptz;

create or replace function public.messages_a_signaler(p_max int default 100)
returns table (id uuid, email text, langue text, token uuid, n int, noms jsonb)
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notif_etat (user_id) select p.id from public.profiles p on conflict (user_id) do nothing;
  return query
    select p.id, u.email::text, p.langue, ne.token, count(*)::int,
      (select jsonb_agg(x.full_name) from (select distinct a.full_name from public.messages m2 join public.profiles a on a.id = m2.author_id
         where m2.dest_id = p.id and m2.lu_at is null and m2.created_at > now() - interval '3 days' limit 3) x)
    from public.messages m
      join public.profiles p on p.id = m.dest_id
      join auth.users u on u.id = p.id
      join public.notif_etat ne on ne.user_id = p.id
    where m.lu_at is null and p.emails_messages and u.email is not null
      and m.created_at < now() - interval '30 minutes' and m.created_at > now() - interval '3 days'
      and m.created_at > coalesce(ne.messages_at, '-infinity'::timestamptz)
      and (ne.messages_at is null or ne.messages_at < now() - interval '6 hours')
    group by p.id, u.email, p.langue, ne.token
    order by min(m.created_at)
    limit greatest(0, least(p_max, 200));
end $$;
revoke all on function public.messages_a_signaler(int) from public, anon, authenticated;

create or replace function public.messages_signales(p_ids uuid[]) returns void
language sql security definer set search_path = public as $$
  update public.notif_etat set messages_at = now() where user_id = any(p_ids);
$$;
revoke all on function public.messages_signales(uuid[]) from public, anon, authenticated;

create or replace function public.se_desabonner_messages(p_token uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  select user_id into v from public.notif_etat where token = p_token;
  if v is null then return false; end if;
  update public.profiles set emails_messages = false where id = v;
  return true;
end $$;
revoke all on function public.se_desabonner_messages(uuid) from public;
grant execute on function public.se_desabonner_messages(uuid) to anon, authenticated;

-- Chaque heure : alertes d'offres, et emails des messages non lus
create or replace function public.alertes_horaires() returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.offers where created_at > now() - interval '3 hours' and status = 'ouverte') then
    perform public.appeler_notifier('alertes');
  end if;
  if exists (select 1 from public.messages where lu_at is null and created_at between now() - interval '3 days' and now() - interval '30 minutes') then
    perform public.appeler_notifier('messages');
  end if;
end $$;
revoke all on function public.alertes_horaires() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.messages_a_signaler(int) to service_role;
    grant execute on function public.messages_signales(uuid[]) to service_role;
  end if;
end $$;

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['messages','blocages'] loop
      if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- =====================================================================
-- APRÈS votre inscription sur la plateforme, devenez administrateur :
--   update public.profiles set role = 'admin', verified = true
--   where id = (select id from auth.users where email = 'VOTRE_EMAIL');
-- =====================================================================

-- Projet Supabase de la plateforme (adresse et clé publique, déjà visibles dans config.js)
insert into public.app_secrets (cle, valeur) values ('projet_url', 'https://xqrdnvelhmppkhcppwgm.supabase.co'), ('anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxcmRudmVsaG1wcGtoY3Bwd2dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNDUzMzcsImV4cCI6MjEwNzkyMTMzN30.x8XerTyxPYcQldFvzPUhYUhaAzxL2X4veMT_7W3keng')
  on conflict (cle) do update set valeur = excluded.valeur;

-- Résultat : 1 = activé
select (select count(*) from pg_extension where extname = 'pg_net') as envois_pg_net, (select count(*) from pg_extension where extname = 'pg_cron') as taches_pg_cron, (select count(*) from storage.buckets where id = 'cv') as stockage_cv, (select count(*) from storage.buckets where id = 'chat') as stockage_messagerie;
