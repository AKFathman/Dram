-- =============================================================================
-- Dram — 0300: rankings (one opinion per user per whiskey), comparisons,
--               tastings (individual logged pours), wishlist, collection
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Rankings: the user's ordered list. Each whiskey sits in exactly one tier at a
-- dense 0-based position. `score` is DERIVED from tier + position (see
-- recompute_tier_scores) and never written by clients.
-- -----------------------------------------------------------------------------
create table public.rankings (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  whiskey_id     uuid not null references public.whiskeys (id) on delete cascade,
  tier           public.rating_tier not null,
  position       int not null check (position >= 0),
  score          numeric(3,1) not null default 0 check (score between 0 and 10),
  first_rated_at timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (user_id, whiskey_id),
  -- deferrable so the "shift everything down by one" update can't trip it mid-statement
  unique (user_id, tier, position) deferrable initially deferred
);
create index rankings_whiskey_idx on public.rankings (whiskey_id);
create index rankings_user_order_idx on public.rankings (user_id, tier desc, position);

-- Score bands per tier. Within a tier, position 0 (best) gets the top of the band.
create or replace function public.tier_band(p_tier public.rating_tier, out lo numeric, out hi numeric)
language sql immutable as $$
  select case p_tier
           when 'loved'    then 8.0
           when 'liked'    then 6.0
           when 'fine'     then 4.0
           else                 1.0
         end,
         case p_tier
           when 'loved'    then 10.0
           when 'liked'    then 8.0
           when 'fine'     then 6.0
           else                 4.0
         end
$$;

create or replace function public.recompute_tier_scores(p_user uuid, p_tier public.rating_tier)
returns void language plpgsql as $$
declare
  v_lo numeric; v_hi numeric; v_n numeric;
begin
  select lo, hi into v_lo, v_hi from public.tier_band(p_tier);
  select count(*) into v_n from public.rankings where user_id = p_user and tier = p_tier;
  if v_n = 0 then return; end if;
  update public.rankings
     set score = round(v_hi - (v_hi - v_lo) * (position + 0.5) / v_n, 1)
   where user_id = p_user and tier = p_tier;
end $$;

-- Pairwise answers from the comparison flow. Kept for taste-match and V2 recs.
create table public.comparisons (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  winner_whiskey_id uuid not null references public.whiskeys (id) on delete cascade,
  loser_whiskey_id  uuid not null references public.whiskeys (id) on delete cascade,
  event_id          uuid references public.events (id) on delete set null,
  created_at        timestamptz not null default now(),
  check (winner_whiskey_id <> loser_whiskey_id)
);
create index comparisons_user_idx on public.comparisons (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Tastings: every logged pour. Many per user per whiskey (different bottles,
-- events, years). Notes and the expert scoresheet live here.
-- -----------------------------------------------------------------------------
create table public.tastings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  whiskey_id       uuid not null references public.whiskeys (id) on delete cascade,
  event_id         uuid references public.events (id) on delete set null,
  tasted_at        timestamptz not null default now(),
  note             text check (length(note) <= 4000),
  nose             text check (length(nose) <= 1000),
  palate           text check (length(palate) <= 1000),
  finish           text check (length(finish) <= 1000),
  serving          public.serving_style,
  setting          public.tasting_setting,
  location_name    text check (length(location_name) <= 120),
  price_paid       numeric(10,2) check (price_paid >= 0),
  currency         char(3) check (currency ~ '^[A-Z]{3}$'),
  pour_size_ml     smallint check (pour_size_ml between 1 and 1000),
  bottle_batch     text check (length(bottle_batch) <= 60),
  bottle_number    text check (length(bottle_number) <= 60),
  store_pick       text check (length(store_pick) <= 120),
  is_blind         boolean not null default false,
  -- Optional structured scoresheet: five categories × 0–20 = 0–100.
  score_appearance smallint check (score_appearance between 0 and 20),
  score_nose       smallint check (score_nose between 0 and 20),
  score_palate     smallint check (score_palate between 0 and 20),
  score_finish     smallint check (score_finish between 0 and 20),
  score_balance    smallint check (score_balance between 0 and 20),
  score_total      smallint generated always as (
                     case when score_appearance is not null and score_nose is not null
                           and score_palate is not null and score_finish is not null
                           and score_balance is not null
                          then score_appearance + score_nose + score_palate + score_finish + score_balance
                     end
                   ) stored,
  likes_count      int not null default 0,
  comments_count   int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index tastings_user_idx    on public.tastings (user_id, tasted_at desc);
create index tastings_whiskey_idx on public.tastings (whiskey_id, tasted_at desc);
create index tastings_event_idx   on public.tastings (event_id) where event_id is not null;
create trigger tastings_updated_at before update on public.tastings
  for each row execute function public.set_updated_at();

create table public.tasting_flavors (
  tasting_id uuid not null references public.tastings (id) on delete cascade,
  tag_slug   text not null references public.flavor_tags (slug),
  intensity  smallint check (intensity between 1 and 3),
  primary key (tasting_id, tag_slug)
);
create index tasting_flavors_tag_idx on public.tasting_flavors (tag_slug);

create table public.tasting_photos (
  id           uuid primary key default gen_random_uuid(),
  tasting_id   uuid not null references public.tastings (id) on delete cascade,
  storage_path text not null,               -- object key in the `tasting-photos` bucket
  width        int,
  height       int,
  sort         smallint not null default 0,
  created_at   timestamptz not null default now()
);
create index tasting_photos_tasting_idx on public.tasting_photos (tasting_id, sort);

-- -----------------------------------------------------------------------------
-- Wishlist and "My Bar"
-- -----------------------------------------------------------------------------
create table public.wishlist (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  whiskey_id uuid not null references public.whiskeys (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, whiskey_id)
);

create table public.collection_bottles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  whiskey_id   uuid not null references public.whiskeys (id) on delete cascade,
  status       public.bottle_status not null default 'sealed',
  fill_percent smallint not null default 100 check (fill_percent between 0 and 100),
  purchased_at date,
  price_paid   numeric(10,2) check (price_paid >= 0),
  currency     char(3) check (currency ~ '^[A-Z]{3}$'),
  store_name   text check (length(store_name) <= 120),
  notes        text check (length(notes) <= 1000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index collection_bottles_user_idx on public.collection_bottles (user_id);
create trigger collection_bottles_updated_at before update on public.collection_bottles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Denormalised stats (statement-level triggers with transition tables so a
-- tier recompute touching 50 rows costs one aggregate, not fifty)
-- -----------------------------------------------------------------------------
create or replace function public.refresh_whiskey_stats(p_ids uuid[])
returns void language sql security definer set search_path = public as $$
  update public.whiskeys w
     set ratings_count  = s.cnt,
         avg_score      = s.avg,
         loved_count    = s.loved,
         liked_count    = s.liked,
         fine_count     = s.fine,
         disliked_count = s.disliked
    from (
      select x.id,
             count(r.*)::int                                       as cnt,
             round(avg(r.score), 2)                                as avg,
             count(*) filter (where r.tier = 'loved')::int         as loved,
             count(*) filter (where r.tier = 'liked')::int         as liked,
             count(*) filter (where r.tier = 'fine')::int          as fine,
             count(*) filter (where r.tier = 'disliked')::int      as disliked
        from unnest(p_ids) as x(id)
        left join public.rankings r on r.whiskey_id = x.id
       group by x.id
    ) s
   where w.id = s.id
$$;

create or replace function public.rankings_stats_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ids uuid[];
  v_users uuid[];
begin
  -- Transition tables only exist for the operation that fired the trigger, so
  -- branch on TG_OP (plpgsql parses each branch lazily).
  if tg_op = 'INSERT' then
    select array_agg(distinct whiskey_id), array_agg(distinct user_id) into v_ids, v_users from new_rows;
  elsif tg_op = 'DELETE' then
    select array_agg(distinct whiskey_id), array_agg(distinct user_id) into v_ids, v_users from old_rows;
  else
    select array_agg(distinct whiskey_id), array_agg(distinct user_id) into v_ids, v_users
      from (select whiskey_id, user_id from new_rows union select whiskey_id, user_id from old_rows) t;
  end if;
  if v_ids is not null then
    perform public.refresh_whiskey_stats(v_ids);
  end if;
  if v_users is not null then
    update public.profiles p
       set rankings_count = (select count(*) from public.rankings r where r.user_id = p.id)
     where p.id = any (v_users);
  end if;
  return null;
end $$;

create trigger rankings_stats_ins after insert on public.rankings
  referencing new table as new_rows
  for each statement execute function public.rankings_stats_trigger();
create trigger rankings_stats_upd after update on public.rankings
  referencing old table as old_rows new table as new_rows
  for each statement execute function public.rankings_stats_trigger();
create trigger rankings_stats_del after delete on public.rankings
  referencing old table as old_rows
  for each statement execute function public.rankings_stats_trigger();

create or replace function public.wishlist_count_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.whiskeys w
     set wishlist_count = (select count(*) from public.wishlist x where x.whiskey_id = w.id)
   where w.id = coalesce(new.whiskey_id, old.whiskey_id);
  return null;
end $$;
create trigger wishlist_count after insert or delete on public.wishlist
  for each row execute function public.wishlist_count_trigger();
