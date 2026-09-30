-- =============================================================================
-- Taste experts
--
-- A taste expert is someone a moderator has vouched for: a distiller, a
-- writer, a certified educator, a long-serving bartender. The badge tells
-- other people this person's rankings are worth following, so only a
-- moderator can grant it, either directly or by approving an application.
-- =============================================================================

alter table public.profiles
  add column expert_title       text check (length(expert_title) between 2 and 60),
  add column expert_specialties public.whiskey_category[] not null default '{}'
                                check (cardinality(expert_specialties) <= 6),
  add column expert_since       timestamptz,
  add column expert_verified_by uuid references public.profiles (id) on delete set null,
  -- A title with no start date, or the reverse, is a half-granted badge.
  add constraint profiles_expert_consistent check ((expert_since is null) = (expert_title is null));

create index profiles_experts_idx on public.profiles (followers_count desc)
  where expert_since is not null;
create index profiles_expert_specialties_idx on public.profiles using gin (expert_specialties)
  where expert_since is not null;

-- -----------------------------------------------------------------------------
-- Fields a user must not set on their own profile.
--
-- The update policy lets people edit their own row, and until now it only
-- protected is_moderator. The counters and the expert badge are claims other
-- people rely on — an expert directory ranked by followers is only as honest
-- as the follower counts — so a direct write from a client is refused. The
-- functions that maintain these run as the table owner (security definer),
-- so current_user is not a client role and they pass.
-- -----------------------------------------------------------------------------
create or replace function public.profiles_guard_managed_columns()
returns trigger language plpgsql as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.is_moderator       is distinct from old.is_moderator
  or new.rankings_count     is distinct from old.rankings_count
  or new.followers_count    is distinct from old.followers_count
  or new.following_count    is distinct from old.following_count
  or new.expert_title       is distinct from old.expert_title
  or new.expert_specialties is distinct from old.expert_specialties
  or new.expert_since       is distinct from old.expert_since
  or new.expert_verified_by is distinct from old.expert_verified_by then
    raise exception 'that profile field is managed by Dram and cannot be changed directly'
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger profiles_guard_managed_columns before update on public.profiles
  for each row execute function public.profiles_guard_managed_columns();

-- -----------------------------------------------------------------------------
-- Applications
-- -----------------------------------------------------------------------------
create type public.expert_application_status as enum ('pending', 'approved', 'declined', 'withdrawn');

create table public.expert_applications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  requested_title text not null check (length(requested_title) between 2 and 60),
  specialties     public.whiskey_category[] not null check (cardinality(specialties) between 1 and 6),
  credentials     text not null check (length(credentials) between 40 and 1500),
  links           text[] not null default '{}' check (cardinality(links) <= 5),
  status          public.expert_application_status not null default 'pending',
  reviewer_note   text check (length(reviewer_note) <= 500),
  reviewed_by     uuid references public.profiles (id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);
-- One open application per person at a time.
create unique index expert_applications_one_pending on public.expert_applications (user_id)
  where status = 'pending';
create index expert_applications_queue on public.expert_applications (created_at)
  where status = 'pending';

alter table public.expert_applications enable row level security;
-- Applicants see their own; moderators see the queue. Every write goes
-- through the functions below, so there are no write policies.
create policy expert_applications_select on public.expert_applications for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());

-- Normalises a specialty list: no duplicates, stable order.
create or replace function public.expert_specialty_set(p public.whiskey_category[])
returns public.whiskey_category[] language sql immutable as $$
  select coalesce(array_agg(distinct s order by s), '{}') from unnest(p) s
$$;

create or replace function public.apply_for_expert(
  p_title       text,
  p_specialties public.whiskey_category[],
  p_credentials text,
  p_links       text[] default '{}'
)
returns public.expert_applications
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_row  public.expert_applications;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = v_user and expert_since is not null) then
    raise exception 'you are already a taste expert' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.expert_applications where user_id = v_user and status = 'pending') then
    raise exception 'you already have an application under review' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_title, ''))) < 2 then
    raise exception 'add the title you''d like shown on your badge' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_specialties), 0) = 0 then
    raise exception 'pick at least one specialty' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_credentials, ''))) < 40 then
    raise exception 'tell us a little more about your experience (40 characters or more)' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(coalesce(p_links, '{}')) l where l !~* '^https?://\S+$') then
    raise exception 'links must start with http:// or https://' using errcode = '22023';
  end if;

  insert into public.expert_applications (user_id, requested_title, specialties, credentials, links)
  values (v_user, btrim(p_title), public.expert_specialty_set(p_specialties),
          btrim(p_credentials), coalesce(p_links, '{}'))
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.withdraw_expert_application()
returns void language sql security definer set search_path = public as $$
  update public.expert_applications set status = 'withdrawn'
   where user_id = auth.uid() and status = 'pending'
$$;

-- -----------------------------------------------------------------------------
-- Moderator actions. The grant is written out in each function rather than
-- shared through a helper: anything in this schema is callable over the API
-- unless execute is revoked, and a stray helper that grants the badge is
-- exactly the hole this whole feature has to avoid.
-- -----------------------------------------------------------------------------
create or replace function public.review_expert_application(
  p_application uuid,
  p_approve     boolean,
  p_title       text default null,   -- overrides the requested title on approval
  p_note        text default null    -- shown to the applicant
)
returns public.expert_applications
language plpgsql security definer set search_path = public as $$
declare
  v_app   public.expert_applications;
  v_title text;
begin
  if not public.is_moderator() then
    raise exception 'only moderators can review expert applications' using errcode = '42501';
  end if;
  select * into v_app from public.expert_applications where id = p_application for update;
  if not found then
    raise exception 'no such application' using errcode = 'P0002';
  end if;
  if v_app.status <> 'pending' then
    raise exception 'that application was already %', v_app.status using errcode = 'P0001';
  end if;

  v_title := coalesce(nullif(btrim(p_title), ''), v_app.requested_title);
  update public.expert_applications
     set status        = case when p_approve then 'approved' else 'declined' end::public.expert_application_status,
         reviewer_note = nullif(btrim(p_note), ''),
         reviewed_by   = auth.uid(),
         reviewed_at   = now()
   where id = p_application
  returning * into v_app;

  if p_approve then
    update public.profiles
       set expert_title       = v_title,
           expert_specialties = v_app.specialties,
           expert_since       = coalesce(expert_since, now()),
           expert_verified_by = auth.uid()
     where id = v_app.user_id;
  end if;

  insert into public.notifications (user_id, kind, payload)
  values (v_app.user_id,
          case when p_approve then 'expert_approved' else 'expert_declined' end::public.notification_kind,
          jsonb_strip_nulls(jsonb_build_object('title', v_title, 'note', v_app.reviewer_note)));
  return v_app;
end $$;

-- Designate someone directly, with no application — for people a moderator
-- already knows. Also used to change an existing expert's title or specialties.
create or replace function public.set_expert(
  p_user        uuid,
  p_title       text,
  p_specialties public.whiskey_category[]
)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  v_row public.profiles;
  v_new boolean;
begin
  if not public.is_moderator() then
    raise exception 'only moderators can designate taste experts' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_title, ''))) < 2 then
    raise exception 'an expert needs a title' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_specialties), 0) = 0 then
    raise exception 'pick at least one specialty' using errcode = '22023';
  end if;
  select expert_since is null into v_new from public.profiles where id = p_user;
  if not found then
    raise exception 'no such user' using errcode = 'P0002';
  end if;

  update public.profiles
     set expert_title       = btrim(p_title),
         expert_specialties = public.expert_specialty_set(p_specialties),
         expert_since       = coalesce(expert_since, now()),
         expert_verified_by = auth.uid()
   where id = p_user
  returning * into v_row;

  -- Anything they had pending is moot now.
  update public.expert_applications
     set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
   where user_id = p_user and status = 'pending';

  if v_new then
    insert into public.notifications (user_id, kind, payload)
    values (p_user, 'expert_approved', jsonb_build_object('title', btrim(p_title)));
  end if;
  return v_row;
end $$;

create or replace function public.revoke_expert(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then
    raise exception 'only moderators can revoke expert status' using errcode = '42501';
  end if;
  update public.profiles
     set expert_title = null, expert_specialties = '{}', expert_since = null, expert_verified_by = null
   where id = p_user;
end $$;

-- -----------------------------------------------------------------------------
-- Finding experts
-- -----------------------------------------------------------------------------
create or replace function public.list_experts(
  p_specialties public.whiskey_category[] default null,
  p_query       text default null,
  p_limit       int  default 30,
  p_offset      int  default 0
)
returns table (
  id uuid, username text, display_name text, avatar_url text, bio text,
  expert_title text, expert_specialties public.whiskey_category[], expert_since timestamptz,
  followers_count int, rankings_count int, follow_status public.follow_status
)
language sql stable security definer set search_path = public as $$
  select p.id, p.username::text, p.display_name, p.avatar_url, p.bio,
         p.expert_title, p.expert_specialties, p.expert_since,
         p.followers_count, p.rankings_count,
         (select f.status from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
    from public.profiles p
   where auth.uid() is not null
     and p.expert_since is not null
     and (coalesce(cardinality(p_specialties), 0) = 0 or p.expert_specialties && p_specialties)
     and (coalesce(btrim(p_query), '') = ''
          or p.username::text ilike '%' || btrim(p_query) || '%'
          or p.display_name   ilike '%' || btrim(p_query) || '%'
          or p.expert_title   ilike '%' || btrim(p_query) || '%')
     and not exists (select 1 from public.blocks b
                      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
                         or (b.blocker_id = p.id and b.blocked_id = auth.uid()))
   order by p.followers_count desc, p.rankings_count desc, p.expert_since
   limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
$$;

-- Whiskeys experts rank highest: ones at least one expert put in Loved or
-- Liked, ordered by how many experts did, then by their average score.
-- Runs as the caller, so an expert with a followers-only profile only counts
-- toward what their followers see.
create or replace function public.expert_picks(
  p_categories public.whiskey_category[] default null,
  p_limit      int default 20
)
returns table (
  whiskey_id uuid, name text, brand text, category public.whiskey_category,
  region text, country text, age_years numeric, abv numeric, image_url text,
  expert_count int, expert_avg_score numeric, experts jsonb
)
language sql stable security invoker set search_path = public as $$
  with takes as (
    select r.whiskey_id, r.score,
           jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name,
                              'avatar_url', p.avatar_url, 'expert_title', p.expert_title,
                              'score', r.score) as expert,
           row_number() over (partition by r.whiskey_id order by r.score desc, p.followers_count desc) as rn
      from public.rankings r
      join public.profiles p on p.id = r.user_id and p.expert_since is not null
     where r.tier in ('loved', 'liked')
  )
  select w.id, w.name, w.brand, w.category, w.region, w.country, w.age_years, w.abv, w.image_url,
         count(*)::int,
         round(avg(t.score), 1),
         coalesce(jsonb_agg(t.expert order by t.rn) filter (where t.rn <= 3), '[]'::jsonb)
    from takes t
    join public.whiskeys w on w.id = t.whiskey_id and w.status = 'approved'
   where coalesce(cardinality(p_categories), 0) = 0 or w.category = any (p_categories)
   group by w.id
   order by count(*) desc, avg(t.score) desc, w.name
   limit least(greatest(p_limit, 1), 50)
$$;

-- What experts think of one whiskey, with their latest note if they left one.
create or replace function public.whiskey_expert_takes(p_whiskey_id uuid)
returns table (user_id uuid, username text, display_name text, avatar_url text, expert_title text,
               tier public.rating_tier, score numeric, overall_rank bigint, total bigint,
               note text, tasted_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select r.user_id, p.username::text, p.display_name, p.avatar_url, p.expert_title,
         r.tier, r.score, r.overall_rank, r.total,
         t.note, t.tasted_at
    from public.v_rankings r
    join public.profiles p on p.id = r.user_id and p.expert_since is not null
    left join lateral (
      select tt.note, tt.tasted_at from public.tastings tt
       where tt.user_id = r.user_id and tt.whiskey_id = r.whiskey_id and tt.note is not null
       order by tt.tasted_at desc
       limit 1
    ) t on true
   where r.whiskey_id = p_whiskey_id
   order by r.score desc, p.followers_count desc
   limit 20
$$;

-- -----------------------------------------------------------------------------
-- Feed: carry the badge on every person it shows, and add an experts view —
-- what verified experts are rating and noting, whether or not you follow them.
-- The argument list changes, so the old signature goes first; leaving both
-- would make a call with only the old arguments ambiguous.
-- -----------------------------------------------------------------------------
drop function if exists public.feed(int, bigint, uuid);

create function public.feed(
  p_limit        int     default 30,
  p_before_id    bigint  default null,
  p_actor        uuid    default null,
  p_experts_only boolean default false
)
returns table (
  id bigint, kind public.activity_kind, created_at timestamptz,
  actor jsonb, whiskey jsonb, tasting jsonb, event jsonb, target_user jsonb,
  payload jsonb, liked_by_me boolean
)
language sql stable security definer set search_path = public as $$
  select a.id, a.kind, a.created_at,
         jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name,
                            'avatar_url', p.avatar_url, 'expert_title', p.expert_title) as actor,
         case when w.id is not null then
           jsonb_build_object('id', w.id, 'name', w.name, 'brand', w.brand,
                              'distillery_name', w.distillery_name, 'category', w.category,
                              'region', w.region, 'country', w.country, 'age_years', w.age_years,
                              'abv', w.abv, 'image_url', w.image_url, 'avg_score', w.avg_score,
                              'ratings_count', w.ratings_count)
         end as whiskey,
         case when t.id is not null then
           jsonb_build_object('id', t.id, 'note', t.note, 'nose', t.nose, 'palate', t.palate,
                              'finish', t.finish, 'serving', t.serving, 'setting', t.setting,
                              'score_total', t.score_total, 'likes_count', t.likes_count,
                              'comments_count', t.comments_count, 'tasted_at', t.tasted_at,
                              'flavors', (select coalesce(jsonb_agg(f.tag_slug), '[]'::jsonb)
                                            from public.tasting_flavors f where f.tasting_id = t.id),
                              'photos', (select coalesce(jsonb_agg(ph.storage_path order by ph.sort), '[]'::jsonb)
                                           from public.tasting_photos ph where ph.tasting_id = t.id))
         end as tasting,
         case when e.id is null then null
              when e.visibility = 'public'
                or exists (select 1 from public.event_members m where m.event_id = e.id and m.user_id = auth.uid())
              then jsonb_build_object('id', e.id, 'name', e.name, 'starts_at', e.starts_at,
                                      'venue_name', e.venue_name, 'member_count', e.member_count,
                                      'visibility', e.visibility)
              else jsonb_build_object('id', null, 'name', 'a private event', 'visibility', e.visibility)
         end as event,
         case when tu.id is not null then
           jsonb_build_object('id', tu.id, 'username', tu.username, 'display_name', tu.display_name,
                              'avatar_url', tu.avatar_url, 'expert_title', tu.expert_title)
         end as target_user,
         a.payload,
         exists (select 1 from public.tasting_likes l
                  where l.tasting_id = a.tasting_id and l.user_id = auth.uid()) as liked_by_me
    from public.activities a
    join public.profiles p on p.id = a.actor_id
    left join public.whiskeys w on w.id = a.whiskey_id
    left join public.tastings t on t.id = a.tasting_id
    left join public.events   e on e.id = a.event_id
    left join public.profiles tu on tu.id = a.target_user_id
   where auth.uid() is not null
     and case
           when p_actor is not null then a.actor_id = p_actor and public.can_view_profile(p_actor)
           -- Experts: their tasting activity only, not who they followed or
           -- which events they joined, and only what their visibility allows.
           when p_experts_only then p.expert_since is not null
                and a.kind in ('rated', 'tasting_added')
                and public.can_view_profile(a.actor_id)
           else a.actor_id = auth.uid()
                or a.actor_id in (select f.followee_id from public.follows f
                                   where f.follower_id = auth.uid() and f.status = 'accepted')
         end
     and not exists (select 1 from public.blocks b
                      where (b.blocker_id = auth.uid() and b.blocked_id = a.actor_id)
                         or (b.blocker_id = a.actor_id and b.blocked_id = auth.uid()))
     and (p_before_id is null or a.id < p_before_id)
   order by a.id desc
   limit least(greatest(p_limit, 1), 100)
$$;
