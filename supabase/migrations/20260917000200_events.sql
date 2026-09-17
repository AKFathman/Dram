-- =============================================================================
-- Dram — 0200: events (tastings, conferences, clubs' one-off nights)
-- =============================================================================

-- Join codes avoid ambiguous glyphs (0/O, 1/I).
create or replace function public.generate_join_code()
returns text language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
begin
  for i in 1..6 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return code;
end $$;

create table public.events (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(name) between 2 and 120),
  description     text check (length(description) <= 4000),
  venue_name      text,
  address         text,
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  timezone        text not null default 'UTC',
  visibility      public.event_visibility not null default 'code',
  status          public.event_status not null default 'live',
  join_code       text not null unique check (join_code ~ '^[A-Z2-9]{6}$'),
  cover_image_url text,
  is_blind        boolean not null default false,   -- V2: hide labels until reveal
  lineup_version  int not null default 1,           -- bumped when pours change; clients show "lineup updated"
  member_count    int not null default 0,
  created_by      uuid not null references public.profiles (id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index events_starts_at_idx on public.events (starts_at desc);
create index events_created_by_idx on public.events (created_by);
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

-- Assign a unique join code when none supplied.
create or replace function public.events_assign_join_code()
returns trigger language plpgsql as $$
begin
  if new.join_code is null then
    loop
      new.join_code := public.generate_join_code();
      exit when not exists (select 1 from public.events where join_code = new.join_code);
    end loop;
  end if;
  return new;
end $$;
create trigger events_assign_join_code before insert on public.events
  for each row execute function public.events_assign_join_code();

create table public.event_members (
  event_id  uuid not null references public.events (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      public.event_role not null default 'attendee',
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_members_user_idx on public.event_members (user_id);

-- The creator is automatically the organizer.
create or replace function public.events_add_creator_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.event_members (event_id, user_id, role)
  values (new.id, new.created_by, 'organizer')
  on conflict do nothing;
  return new;
end $$;
create trigger events_add_creator_member after insert on public.events
  for each row execute function public.events_add_creator_member();

create or replace function public.event_members_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.events e
     set member_count = (select count(*) from public.event_members m where m.event_id = e.id)
   where e.id = coalesce(new.event_id, old.event_id);
  return null;
end $$;
create trigger event_members_count after insert or delete on public.event_members
  for each row execute function public.event_members_count();

-- The lineup. `label` overrides the catalog name for the event (e.g. "Table 4 — Barrel Pick #2").
create table public.event_pours (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete cascade,
  whiskey_id     uuid not null references public.whiskeys (id) on delete cascade,
  label          text check (length(label) <= 120),
  flight         text check (length(flight) <= 60),      -- grouping: "Flight 1", "Bourbon table", ...
  table_location text check (length(table_location) <= 120),
  sort_order     int not null default 0,
  notes          text check (length(notes) <= 1000),
  added_by       uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (event_id, whiskey_id)
);
create index event_pours_event_idx on public.event_pours (event_id, sort_order);

create or replace function public.event_pours_bump_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.events set lineup_version = lineup_version + 1
   where id = coalesce(new.event_id, old.event_id);
  return null;
end $$;
create trigger event_pours_bump_version after insert or update or delete on public.event_pours
  for each row execute function public.event_pours_bump_version();
