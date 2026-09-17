-- =============================================================================
-- Dram — 0400: social graph, activity feed, likes, comments, notifications
-- =============================================================================

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  status      public.follow_status not null default 'accepted',
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id, status);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- Can the caller see `target`'s rankings/tastings/lists?
create or replace function public.can_view_profile(p_target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when auth.uid() = p_target then true
    when exists (select 1 from public.blocks b
                  where (b.blocker_id = p_target and b.blocked_id = auth.uid())
                     or (b.blocker_id = auth.uid() and b.blocked_id = p_target)) then false
    when (select visibility from public.profiles where id = p_target) = 'public' then true
    else exists (select 1 from public.follows f
                  where f.follower_id = auth.uid() and f.followee_id = p_target and f.status = 'accepted')
  end
$$;

-- Following a followers-only profile creates a request; public → accepted.
create or replace function public.follows_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.blocks b
              where (b.blocker_id = new.followee_id and b.blocked_id = new.follower_id)
                 or (b.blocker_id = new.follower_id and b.blocked_id = new.followee_id)) then
    raise exception 'cannot follow this user' using errcode = 'P0001';
  end if;
  new.status := case (select visibility from public.profiles where id = new.followee_id)
                  when 'followers' then 'pending'::public.follow_status
                  else 'accepted'::public.follow_status
                end;
  return new;
end $$;
create trigger follows_before_insert before insert on public.follows
  for each row execute function public.follows_before_insert();

create or replace function public.follows_counts_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_follower uuid := coalesce(new.follower_id, old.follower_id);
  v_followee uuid := coalesce(new.followee_id, old.followee_id);
begin
  update public.profiles p set
    following_count = (select count(*) from public.follows f where f.follower_id = p.id and f.status = 'accepted')
  where p.id = v_follower;
  update public.profiles p set
    followers_count = (select count(*) from public.follows f where f.followee_id = p.id and f.status = 'accepted')
  where p.id = v_followee;
  return null;
end $$;
create trigger follows_counts after insert or update or delete on public.follows
  for each row execute function public.follows_counts_trigger();

-- -----------------------------------------------------------------------------
-- Activity feed (append-only)
-- -----------------------------------------------------------------------------
create table public.activities (
  id             bigint generated always as identity primary key,
  actor_id       uuid not null references public.profiles (id) on delete cascade,
  kind           public.activity_kind not null,
  whiskey_id     uuid references public.whiskeys (id) on delete cascade,
  tasting_id     uuid references public.tastings (id) on delete cascade,
  event_id       uuid references public.events (id) on delete cascade,
  target_user_id uuid references public.profiles (id) on delete cascade,
  payload        jsonb not null default '{}'::jsonb,   -- e.g. {"tier":"loved","score":9.2,"overall_rank":3}
  created_at     timestamptz not null default now()
);
create index activities_actor_idx on public.activities (actor_id, created_at desc);
create index activities_created_idx on public.activities (created_at desc);

create table public.tasting_likes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  tasting_id uuid not null references public.tastings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tasting_id)
);
create index tasting_likes_tasting_idx on public.tasting_likes (tasting_id);

create table public.tasting_comments (
  id         uuid primary key default gen_random_uuid(),
  tasting_id uuid not null references public.tastings (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index tasting_comments_tasting_idx on public.tasting_comments (tasting_id, created_at);

create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       public.notification_kind not null,
  actor_id   uuid references public.profiles (id) on delete cascade,
  tasting_id uuid references public.tastings (id) on delete cascade,
  event_id   uuid references public.events (id) on delete cascade,
  whiskey_id uuid references public.whiskeys (id) on delete cascade,
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.push_tokens (
  token      text primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  platform   text not null check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('tasting', 'profile', 'whiskey', 'comment', 'event')),
  target_id   uuid not null,
  reason      text not null check (reason in ('spam', 'abuse', 'inaccurate', 'duplicate', 'other')),
  details     text check (length(details) <= 1000),
  status      text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Triggers that fan out to the feed and notifications
-- -----------------------------------------------------------------------------
create or replace function public.tasting_likes_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  update public.tastings t
     set likes_count = (select count(*) from public.tasting_likes l where l.tasting_id = t.id)
   where t.id = coalesce(new.tasting_id, old.tasting_id)
   returning user_id into v_owner;
  if tg_op = 'INSERT' and v_owner <> new.user_id then
    insert into public.notifications (user_id, kind, actor_id, tasting_id)
    values (v_owner, 'like', new.user_id, new.tasting_id);
  end if;
  return null;
end $$;
create trigger tasting_likes_after after insert or delete on public.tasting_likes
  for each row execute function public.tasting_likes_trigger();

create or replace function public.tasting_comments_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  update public.tastings t
     set comments_count = (select count(*) from public.tasting_comments c where c.tasting_id = t.id)
   where t.id = coalesce(new.tasting_id, old.tasting_id)
   returning user_id into v_owner;
  if tg_op = 'INSERT' and v_owner <> new.user_id then
    insert into public.notifications (user_id, kind, actor_id, tasting_id, payload)
    values (v_owner, 'comment', new.user_id, new.tasting_id, jsonb_build_object('preview', left(new.body, 120)));
  end if;
  return null;
end $$;
create trigger tasting_comments_after after insert or delete on public.tasting_comments
  for each row execute function public.tasting_comments_trigger();

create or replace function public.follows_notify_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, kind, actor_id)
    values (new.followee_id,
            case when new.status = 'pending' then 'follow_request' else 'new_follower' end::public.notification_kind,
            new.follower_id);
    if new.status = 'accepted' then
      insert into public.activities (actor_id, kind, target_user_id)
      values (new.follower_id, 'followed', new.followee_id);
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    insert into public.notifications (user_id, kind, actor_id)
    values (new.follower_id, 'follow_accepted', new.followee_id);
    insert into public.activities (actor_id, kind, target_user_id)
    values (new.follower_id, 'followed', new.followee_id);
  end if;
  return null;
end $$;
create trigger follows_notify after insert or update on public.follows
  for each row execute function public.follows_notify_trigger();

-- A tasting posts to the feed once it carries something worth reading (a note,
-- a scoresheet, or flavor tags). A bare log is covered by the 'rated' activity
-- that upsert_ranking emits. Idempotent: at most one post per tasting.
create or replace function public.post_tasting_activity(p_tasting_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  t public.tastings;
begin
  select * into t from public.tastings where id = p_tasting_id;
  if not found then return; end if;
  if t.note is null and t.score_total is null
     and not exists (select 1 from public.tasting_flavors f where f.tasting_id = t.id) then
    return;
  end if;
  if exists (select 1 from public.activities a where a.tasting_id = t.id) then
    return;
  end if;
  insert into public.activities (actor_id, kind, whiskey_id, tasting_id, event_id)
  values (t.user_id, 'tasting_added', t.whiskey_id, t.id, t.event_id);
end $$;

create or replace function public.tastings_activity_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.post_tasting_activity(new.id);
  return null;
end $$;
create trigger tastings_activity after insert or update of note, score_appearance, score_nose,
  score_palate, score_finish, score_balance on public.tastings
  for each row execute function public.tastings_activity_trigger();

create or replace function public.tasting_flavors_activity_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.post_tasting_activity(new.tasting_id);
  return null;
end $$;
create trigger tasting_flavors_activity after insert on public.tasting_flavors
  for each row execute function public.tasting_flavors_activity_trigger();

create or replace function public.whiskeys_activity_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.created_by is not null then
    insert into public.activities (actor_id, kind, whiskey_id)
    values (new.created_by, 'whiskey_added', new.id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'approved' and new.created_by is not null then
    insert into public.notifications (user_id, kind, whiskey_id)
    values (new.created_by, 'whiskey_approved', new.id);
  end if;
  return null;
end $$;
create trigger whiskeys_activity after insert or update of status on public.whiskeys
  for each row execute function public.whiskeys_activity_trigger();

create or replace function public.events_activity_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activities (actor_id, kind, event_id)
  values (new.created_by, 'event_created', new.id);
  return null;
end $$;
create trigger events_activity after insert on public.events
  for each row execute function public.events_activity_trigger();

create or replace function public.event_members_activity_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'attendee' then
    insert into public.activities (actor_id, kind, event_id)
    values (new.user_id, 'event_joined', new.event_id);
  end if;
  return null;
end $$;
create trigger event_members_activity after insert on public.event_members
  for each row execute function public.event_members_activity_trigger();
