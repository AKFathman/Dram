-- =============================================================================
-- Dram — 0800: V2 hooks — price tracking
-- =============================================================================
-- Shipped now so the client types and RLS exist; no UI until V2.

create table public.price_observations (
  id           bigint generated always as identity primary key,
  whiskey_id   uuid not null references public.whiskeys (id) on delete cascade,
  user_id      uuid references public.profiles (id) on delete set null,   -- null = retailer feed
  source       text not null default 'user' check (source in ('user', 'retailer_feed', 'affiliate')),
  store_name   text check (length(store_name) <= 120),
  store_url    text,
  price        numeric(10,2) not null check (price >= 0),
  currency     char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  size_ml      smallint not null default 750 check (size_ml between 50 and 5000),
  country      text check (country ~ '^[A-Z]{2}$'),
  region       text,
  lat          double precision,
  lng          double precision,
  observed_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index price_observations_whiskey_idx on public.price_observations (whiskey_id, observed_at desc);

alter table public.price_observations enable row level security;
create policy price_observations_select on public.price_observations for select to authenticated using (true);
create policy price_observations_insert on public.price_observations for insert to authenticated
  with check (user_id = auth.uid() and source = 'user');
create policy price_observations_delete on public.price_observations for delete to authenticated
  using (user_id = auth.uid() or public.is_moderator());

-- Latest observed price per whiskey (per currency/size), for list badges.
create or replace view public.v_latest_prices
with (security_invoker = true) as
select distinct on (whiskey_id, currency, size_ml)
       whiskey_id, currency, size_ml, price, store_name, observed_at
  from public.price_observations
 order by whiskey_id, currency, size_ml, observed_at desc;

grant select on public.v_latest_prices to authenticated;
grant select, insert, delete on public.price_observations to authenticated;
grant usage, select on all sequences in schema public to authenticated;
