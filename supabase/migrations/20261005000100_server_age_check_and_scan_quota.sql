-- =============================================================================
-- Two things a client must not be trusted with:
--
--  1. The drinking-age check. Until now the app compared the birth date with
--     the legal age itself and then wrote age_verified_at straight into the
--     profile, so anyone with the anon key could skip it. Onboarding now goes
--     through complete_onboarding(), which does the check here and is the
--     only thing that can set age_verified_at / onboarded_at.
--
--  2. Label scans. Every call to the identify-label edge function spends the
--     owner's model credit, and any signed-in user could call it as often as
--     they liked. Each scan is now recorded in label_scans and refused once a
--     user has used their daily allowance.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Drinking age
-- -----------------------------------------------------------------------------

-- Minimum age to buy spirits, by ISO 3166-1 alpha-2 country. Must stay in step
-- with legalDrinkingAge() in apps/mobile/src/lib/api.ts, which the onboarding
-- screen uses to show the right number before the user submits.
create or replace function public.legal_drinking_age(p_country text)
returns int language sql immutable as $$
  select case upper(coalesce(p_country, '')) when 'US' then 21 else 18 end
$$;

-- Finishes onboarding in one step: picks the username and display name,
-- records the home country and, if the birth date clears that country's
-- legal age, marks the profile age-verified and onboarded. The birth date is
-- used for the check and not stored.
--
-- Security definer so the managed-column guard below lets the write through;
-- the function only ever touches the caller's own row.
create or replace function public.complete_onboarding(
  p_username     text,
  p_display_name text,
  p_birthdate    date,
  p_home_country text
)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  v_user     uuid := auth.uid();
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_country  text := upper(btrim(coalesce(p_home_country, '')));
  v_min_age  int;
  v_age      int;
  v_row      public.profiles;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if v_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Pick a username of 3–24 letters, numbers or underscores.' using errcode = '22023';
  end if;
  if v_country !~ '^[A-Z]{2}$' then
    raise exception 'Pick your country.' using errcode = '22023';
  end if;
  if p_birthdate is null then
    raise exception 'Enter your birthday.' using errcode = '22023';
  end if;
  -- A birthday in the future, or more than 120 years ago, is a typo.
  if p_birthdate > current_date or p_birthdate < current_date - interval '120 years' then
    raise exception 'That birthday does not look right.' using errcode = '22023';
  end if;

  v_min_age := public.legal_drinking_age(v_country);
  v_age     := extract(year from age(current_date, p_birthdate))::int;
  if v_age < v_min_age then
    raise exception 'You must be % or older to use Dram.', v_min_age using errcode = 'P0001';
  end if;

  update public.profiles
     set username        = v_username,
         display_name    = left(coalesce(nullif(btrim(p_display_name), ''), v_username), 60),
         home_country    = v_country,
         age_verified_at = now(),
         onboarded_at    = coalesce(onboarded_at, now())
   where id = v_user
   returning * into v_row;

  if v_row.id is null then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
  return v_row;
end $$;

revoke all on function public.legal_drinking_age(text) from public, anon;
revoke all on function public.complete_onboarding(text, text, date, text) from public, anon;
grant execute on function public.legal_drinking_age(text) to authenticated;
grant execute on function public.complete_onboarding(text, text, date, text) to authenticated;

-- age_verified_at and onboarded_at join the list of fields a client may not
-- write directly. complete_onboarding() runs as the table owner and passes.
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
  or new.expert_verified_by is distinct from old.expert_verified_by
  or new.age_verified_at    is distinct from old.age_verified_at
  or new.onboarded_at       is distinct from old.onboarded_at then
    raise exception 'that profile field is managed by Dram and cannot be changed directly'
      using errcode = '42501';
  end if;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Label-scan allowance
-- -----------------------------------------------------------------------------

-- One row per attempt to read a label, successful or not: the model is paid
-- for either way. Rows older than a day no longer count and can be pruned.
create table public.label_scans (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index label_scans_user_recent on public.label_scans (user_id, created_at desc);

-- No client policies at all: the only way in is record_label_scan(), and the
-- app never needs to read the rows back.
alter table public.label_scans enable row level security;
revoke all on public.label_scans from anon, authenticated;

-- Spends one scan from the caller's rolling 24-hour allowance, or explains
-- why it cannot. The edge function calls this before it touches the model.
--
--   { allowed: boolean, used: int, "limit": int, resets_at: timestamptz | null }
--
-- p_limit lets the deployment choose the allowance (the edge function reads
-- it from LABEL_SCANS_PER_DAY); 20 a day is plenty for a tasting evening and
-- bounds the worst case at a few dollars per user.
create or replace function public.record_label_scan(p_limit int default 20)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := auth.uid();
  v_limit  int  := greatest(coalesce(p_limit, 20), 0);
  v_since  timestamptz := now() - interval '24 hours';
  v_used   int;
  v_oldest timestamptz;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Serialise per user so two scans fired together cannot both squeeze in
  -- under the limit.
  perform pg_advisory_xact_lock(hashtext('label_scans:' || v_user::text));

  select count(*), min(created_at)
    into v_used, v_oldest
    from public.label_scans
   where user_id = v_user and created_at > v_since;

  if v_used >= v_limit then
    return jsonb_build_object(
      'allowed',   false,
      'used',      v_used,
      'limit',     v_limit,
      'resets_at', v_oldest + interval '24 hours'
    );
  end if;

  insert into public.label_scans (user_id) values (v_user);
  return jsonb_build_object(
    'allowed',   true,
    'used',      v_used + 1,
    'limit',     v_limit,
    'resets_at', coalesce(v_oldest, now()) + interval '24 hours'
  );
end $$;

revoke all on function public.record_label_scan(int) from public, anon;
grant execute on function public.record_label_scan(int) to authenticated;
