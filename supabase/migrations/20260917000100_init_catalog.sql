-- =============================================================================
-- Dram — 0100: extensions, enums, helpers, profiles, whiskey catalog
-- =============================================================================
-- Conventions
--   * Every table lives in `public`; extensions live in `extensions` (Supabase
--     default). Functions that must be immutable wrap extension calls with an
--     explicit schema so they work regardless of search_path.
--   * All timestamps are timestamptz. `updated_at` is maintained by trigger.
--   * IDs are uuid (gen_random_uuid) except append-only logs (bigint identity).
-- =============================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto  with schema extensions;
create extension if not exists pg_trgm   with schema extensions;
create extension if not exists unaccent  with schema extensions;
create extension if not exists citext    with schema extensions;
-- Supabase grants this already; repeated here so a vanilla Postgres behaves the same.
grant usage on schema extensions to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.whiskey_category as enum (
  'bourbon', 'rye', 'wheat', 'tennessee', 'american_single_malt', 'american_other',
  'scotch_single_malt', 'scotch_blended', 'scotch_blended_malt', 'scotch_grain',
  'irish', 'japanese', 'canadian', 'world', 'other'
);

create type public.catalog_status     as enum ('pending', 'approved', 'rejected', 'merged');
-- Ordered worst → best so `order by tier desc` yields the overall ranking.
create type public.rating_tier        as enum ('disliked', 'fine', 'liked', 'loved');
create type public.serving_style      as enum ('neat', 'rocks', 'water', 'highball', 'cocktail', 'other');
create type public.tasting_setting    as enum ('home', 'bar', 'restaurant', 'event', 'distillery', 'other');
create type public.profile_visibility as enum ('public', 'followers');
create type public.follow_status      as enum ('pending', 'accepted');
create type public.event_visibility   as enum ('public', 'code');
create type public.event_status       as enum ('draft', 'live', 'ended');
create type public.event_role         as enum ('organizer', 'host', 'attendee');
create type public.bottle_status      as enum ('sealed', 'open', 'finished');
create type public.activity_kind      as enum (
  'rated', 'tasting_added', 'whiskey_added', 'event_joined', 'event_created', 'followed'
);
create type public.notification_kind  as enum (
  'new_follower', 'follow_request', 'follow_accepted', 'like', 'comment',
  'event_starting', 'event_lineup_updated', 'whiskey_approved', 'whiskey_merged'
);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- unaccent() is only STABLE; wrapping it with an explicit dictionary lets us
-- use it in generated columns and indexes.
create or replace function public.immutable_unaccent(p text)
returns text language sql immutable parallel safe strict as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, p)
$$;

create or replace function public.normalize_text(p text)
returns text language sql immutable parallel safe as $$
  select regexp_replace(lower(public.immutable_unaccent(coalesce(p, ''))), '[^a-z0-9]+', ' ', 'g')
$$;

-- -----------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  username        extensions.citext not null unique
                  check (length(username) between 3 and 24 and username ~ '^[a-z0-9_]+$'),
  display_name    text not null default '' check (length(display_name) <= 60),
  avatar_url      text,
  bio             text check (length(bio) <= 280),
  home_country    text check (home_country ~ '^[A-Z]{2}$'),   -- ISO 3166-1 alpha-2
  home_region     text,
  visibility      public.profile_visibility not null default 'public',
  is_moderator    boolean not null default false,
  age_verified_at timestamptz,          -- set when DOB check passes at onboarding
  onboarded_at    timestamptz,
  rankings_count  int not null default 0,
  followers_count int not null default 0,
  following_count int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index profiles_username_trgm on public.profiles using gin (username extensions.gin_trgm_ops);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_moderator from public.profiles where id = auth.uid()), false)
$$;


-- Create a profile row whenever a user signs up. Username comes from the
-- sign-up metadata when present, otherwise a unique placeholder.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_username text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  v_display  text := coalesce(new.raw_user_meta_data ->> 'display_name',
                              new.raw_user_meta_data ->> 'full_name', '');
begin
  if v_username !~ '^[a-z0-9_]{3,24}$'
     or exists (select 1 from public.profiles where username = v_username) then
    v_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, left(v_display, 60));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Catalog: distilleries, whiskeys, aliases
-- -----------------------------------------------------------------------------
create table public.distilleries (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(name) between 2 and 120),
  country      text not null check (country ~ '^[A-Z]{2}$'),
  region       text,
  city         text,
  founded_year smallint check (founded_year between 1600 and 2100),
  website      text,
  description  text,
  status       public.catalog_status not null default 'approved',
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index distilleries_name_country_key
  on public.distilleries (public.normalize_text(name), country);
create trigger distilleries_updated_at before update on public.distilleries
  for each row execute function public.set_updated_at();

create table public.whiskeys (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(name) between 2 and 120),
  brand           text,
  distillery_id   uuid references public.distilleries (id) on delete set null,
  distillery_name text,                       -- free text when unknown / independent bottling
  bottler         text,
  category        public.whiskey_category not null,
  subcategory     text,                       -- 'bottled in bond', 'single pot still', 'cask strength', ...
  country         text not null check (country ~ '^[A-Z]{2}$'),
  region          text,                       -- 'Kentucky', 'Islay', 'Speyside', ...
  age_years       numeric(4,1) check (age_years >= 0 and age_years < 100),  -- null = no age statement
  abv             numeric(4,1) check (abv > 0 and abv <= 99),
  cask_type       text,
  finish          text,
  mash_bill       text,
  release_year    smallint check (release_year between 1800 and 2100),
  is_limited      boolean not null default false,
  description     text check (length(description) <= 2000),
  image_url       text,
  upc             text,
  status          public.catalog_status not null default 'pending',
  merged_into     uuid references public.whiskeys (id) on delete set null,
  created_by      uuid references public.profiles (id) on delete set null,
  reviewed_by     uuid references public.profiles (id) on delete set null,
  reviewed_at     timestamptz,
  -- denormalised community stats (maintained by trigger in 0300)
  ratings_count   int not null default 0,
  avg_score       numeric(4,2),
  loved_count     int not null default 0,
  liked_count     int not null default 0,
  fine_count      int not null default 0,
  disliked_count  int not null default 0,
  wishlist_count  int not null default 0,
  search_text     text generated always as (
                    public.normalize_text(
                      name || ' ' || coalesce(brand, '') || ' ' || coalesce(distillery_name, '')
                           || ' ' || coalesce(region, '') || ' ' || coalesce(subcategory, '')
                    )
                  ) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index whiskeys_search_trgm on public.whiskeys using gin (search_text extensions.gin_trgm_ops);
create index whiskeys_category_idx on public.whiskeys (category, country, region);
create index whiskeys_status_idx   on public.whiskeys (status);
create index whiskeys_distillery_idx on public.whiskeys (distillery_id);
create index whiskeys_avg_score_idx on public.whiskeys (avg_score desc nulls last) where status = 'approved';
create index whiskeys_upc_idx on public.whiskeys (upc) where upc is not null;
create trigger whiskeys_updated_at before update on public.whiskeys
  for each row execute function public.set_updated_at();

-- Fill distillery_name from the linked distillery when the caller only set the id.
create or replace function public.whiskeys_fill_distillery_name()
returns trigger language plpgsql as $$
begin
  if new.distillery_id is not null and new.distillery_name is null then
    select name into new.distillery_name from public.distilleries where id = new.distillery_id;
  end if;
  return new;
end $$;
create trigger whiskeys_fill_distillery_name before insert or update of distillery_id on public.whiskeys
  for each row execute function public.whiskeys_fill_distillery_name();

create table public.whiskey_aliases (
  whiskey_id uuid not null references public.whiskeys (id) on delete cascade,
  alias      text not null check (length(alias) between 2 and 120),
  normalized text generated always as (public.normalize_text(alias)) stored,
  primary key (whiskey_id, alias)
);
create index whiskey_aliases_trgm on public.whiskey_aliases using gin (normalized extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Flavor wheel
-- -----------------------------------------------------------------------------
create table public.flavor_tags (
  slug        text primary key,
  label       text not null,
  group_slug  text not null,
  group_label text not null,
  sort        smallint not null default 0
);
