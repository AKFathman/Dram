-- =============================================================================
-- Dram — 0500: views and RPC functions
-- =============================================================================
-- Security model
--   * `security invoker` functions run under the caller's RLS (safe default).
--   * `security definer` functions are used only where the caller legitimately
--     needs rows RLS would hide (feed, leaderboards, join-by-code, taste match)
--     and each one re-checks authorization explicitly.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The ranked list, with overall rank across tiers
-- -----------------------------------------------------------------------------
create or replace view public.v_rankings
with (security_invoker = true) as
select r.user_id,
       r.whiskey_id,
       r.tier,
       r.position,
       r.score,
       r.first_rated_at,
       r.updated_at,
       rank() over (partition by r.user_id order by r.tier desc, r.position)  as overall_rank,
       count(*) over (partition by r.user_id)                                 as total
from public.rankings r;

-- -----------------------------------------------------------------------------
-- upsert_ranking: place a whiskey at `p_position` inside `p_tier` (0 = best).
-- Handles first-time inserts and re-ranks (moves) atomically, recomputes
-- derived scores, records the comparisons that led here, and posts activity.
-- Returns the resulting v_rankings row.
-- -----------------------------------------------------------------------------
create or replace function public.upsert_ranking(
  p_whiskey_id  uuid,
  p_tier        public.rating_tier,
  p_position    int default null,             -- null = append to the end of the tier
  p_event_id    uuid default null,
  p_comparisons jsonb default '[]'::jsonb     -- [{"winner": "<uuid>", "loser": "<uuid>"}, ...]
)
returns setof public.v_rankings
language plpgsql security invoker set search_path = public as $$
declare
  v_user     uuid := auth.uid();
  v_old_tier public.rating_tier;
  v_old_pos  int;
  v_first    timestamptz;
  v_n        int;
  v_pos      int;
  v_is_new   boolean;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_event_id is not null and not exists (
       select 1 from public.event_members m where m.event_id = p_event_id and m.user_id = v_user) then
    raise exception 'not a member of this event' using errcode = '42501';
  end if;
  if not exists (select 1 from public.whiskeys w where w.id = p_whiskey_id) then
    raise exception 'unknown whiskey' using errcode = 'P0002';
  end if;

  -- serialise concurrent edits to one user's list
  perform pg_advisory_xact_lock(hashtext('rankings:' || v_user::text));

  select tier, position, first_rated_at into v_old_tier, v_old_pos, v_first
    from public.rankings where user_id = v_user and whiskey_id = p_whiskey_id;
  v_is_new := not found;

  if not v_is_new then
    delete from public.rankings where user_id = v_user and whiskey_id = p_whiskey_id;
    update public.rankings set position = position - 1
     where user_id = v_user and tier = v_old_tier and position > v_old_pos;
  end if;

  select count(*) into v_n from public.rankings where user_id = v_user and tier = p_tier;
  v_pos := least(greatest(coalesce(p_position, v_n), 0), v_n);

  update public.rankings set position = position + 1
   where user_id = v_user and tier = p_tier and position >= v_pos;

  insert into public.rankings (user_id, whiskey_id, tier, position, first_rated_at, updated_at)
  values (v_user, p_whiskey_id, p_tier, v_pos, coalesce(v_first, now()), now());

  perform public.recompute_tier_scores(v_user, p_tier);
  if not v_is_new and v_old_tier <> p_tier then
    perform public.recompute_tier_scores(v_user, v_old_tier);
  end if;

  insert into public.comparisons (user_id, winner_whiskey_id, loser_whiskey_id, event_id)
  select v_user, (c ->> 'winner')::uuid, (c ->> 'loser')::uuid, p_event_id
    from jsonb_array_elements(coalesce(p_comparisons, '[]'::jsonb)) as c
   where (c ->> 'winner') is not null
     and (c ->> 'loser') is not null
     and (c ->> 'winner') <> (c ->> 'loser');

  if v_is_new or v_old_tier <> p_tier then
    insert into public.activities (actor_id, kind, whiskey_id, event_id, payload)
    select v_user, 'rated', p_whiskey_id, p_event_id,
           jsonb_build_object('tier', r.tier, 'score', r.score,
                              'overall_rank', r.overall_rank, 'total', r.total,
                              'is_new', v_is_new)
      from public.v_rankings r
     where r.user_id = v_user and r.whiskey_id = p_whiskey_id;
  end if;

  return query
    select * from public.v_rankings r
     where r.user_id = v_user and r.whiskey_id = p_whiskey_id;
end $$;

create or replace function public.remove_ranking(p_whiskey_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_tier public.rating_tier;
  v_pos  int;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('rankings:' || v_user::text));
  delete from public.rankings
   where user_id = v_user and whiskey_id = p_whiskey_id
   returning tier, position into v_tier, v_pos;
  if found then
    update public.rankings set position = position - 1
     where user_id = v_user and tier = v_tier and position > v_pos;
    perform public.recompute_tier_scores(v_user, v_tier);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Catalog search (typo tolerant, alias aware). Pending whiskeys are returned
-- after approved ones so people don't create duplicates of unreviewed entries.
-- -----------------------------------------------------------------------------
create or replace function public.search_whiskeys(
  q            text,
  p_categories public.whiskey_category[] default null,
  p_country    text default null,
  p_region     text default null,
  p_limit      int  default 20,
  p_offset     int  default 0
)
returns setof public.whiskeys
language sql stable security invoker
set search_path = public, extensions
set pg_trgm.word_similarity_threshold = 0.4
as $$
  with params as (select public.normalize_text(q) as nq)
  select w.*
    from public.whiskeys w, params p
   where w.status in ('approved', 'pending')
     and (p_categories is null or w.category = any (p_categories))
     and (p_country is null or w.country = p_country)
     and (p_region is null or w.region ilike p_region)
     and (
       p.nq = ''
       or p.nq <% w.search_text
       or w.search_text like '%' || p.nq || '%'
       or exists (select 1 from public.whiskey_aliases a
                   where a.whiskey_id = w.id
                     and (p.nq <% a.normalized or a.normalized like '%' || p.nq || '%'))
     )
   order by
     (w.status = 'approved') desc,
     case when p.nq = '' then 0
          else greatest(
            word_similarity(p.nq, w.search_text),
            coalesce((select max(word_similarity(p.nq, a.normalized))
                        from public.whiskey_aliases a where a.whiskey_id = w.id), 0))
     end desc,
     w.ratings_count desc,
     w.name
   limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
$$;

-- Match free-text lines (organizer bulk paste, label OCR) to catalog rows.
create or replace function public.match_whiskey_lines(p_lines text[])
returns table (line text, whiskey_id uuid, whiskey_name text, similarity real)
language sql stable security invoker set search_path = public, extensions as $$
  select l.line,
         m.id,
         m.name,
         m.sim
    from unnest(p_lines) as l(line)
    left join lateral (
      select w.id, w.name,
             greatest(word_similarity(public.normalize_text(l.line), w.search_text),
                      similarity(public.normalize_text(l.line), w.search_text)) as sim
        from public.whiskeys w
       where w.status in ('approved', 'pending')
       order by sim desc, w.ratings_count desc
       limit 1
    ) m on true
   where length(trim(l.line)) > 0
$$;

-- -----------------------------------------------------------------------------
-- Discovery
-- -----------------------------------------------------------------------------
create or replace function public.trending_whiskeys(p_days int default 14, p_limit int default 20)
returns setof public.whiskeys
language sql stable security invoker set search_path = public as $$
  select w.*
    from public.whiskeys w
    join (select whiskey_id, count(*) as c
            from public.rankings
           where first_rated_at > now() - make_interval(days => greatest(p_days, 1))
           group by whiskey_id) r on r.whiskey_id = w.id
   where w.status = 'approved'
   order by r.c desc, w.avg_score desc nulls last, w.ratings_count desc
   limit least(greatest(p_limit, 1), 100)
$$;

create or replace function public.top_whiskeys(
  p_category    public.whiskey_category default null,
  p_country     text default null,
  p_region      text default null,
  p_min_ratings int  default 3,
  p_limit       int  default 20
)
returns setof public.whiskeys
language sql stable security invoker set search_path = public as $$
  select w.*
    from public.whiskeys w
   where w.status = 'approved'
     and w.ratings_count >= greatest(p_min_ratings, 1)
     and (p_category is null or w.category = p_category)
     and (p_country is null or w.country = p_country)
     and (p_region is null or w.region ilike p_region)
   order by w.avg_score desc nulls last, w.ratings_count desc, w.name
   limit least(greatest(p_limit, 1), 100)
$$;

-- Whiskeys the people you follow put in their Loved tier.
create or replace function public.friends_loved(p_limit int default 20)
returns table (whiskey jsonb, friend_count int, friends jsonb)
language sql stable security definer set search_path = public as $$
  select to_jsonb(w) as whiskey,
         count(*)::int as friend_count,
         jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username,
                                      'display_name', p.display_name, 'avatar_url', p.avatar_url,
                                      'score', r.score)
                   order by r.score desc) as friends
    from public.rankings r
    join public.follows f on f.followee_id = r.user_id and f.follower_id = auth.uid() and f.status = 'accepted'
    join public.profiles p on p.id = r.user_id
    join public.whiskeys w on w.id = r.whiskey_id
   where r.tier = 'loved'
     and w.status = 'approved'
     and not exists (select 1 from public.blocks b
                      where (b.blocker_id = auth.uid() and b.blocked_id = r.user_id)
                         or (b.blocker_id = r.user_id and b.blocked_id = auth.uid()))
   group by w.id
   order by count(*) desc, max(r.score) desc
   limit least(greatest(p_limit, 1), 100)
$$;

create or replace function public.similar_whiskeys(p_whiskey_id uuid, p_limit int default 10)
returns setof public.whiskeys
language sql stable security invoker set search_path = public as $$
  with src as (select * from public.whiskeys where id = p_whiskey_id)
  select w.*
    from public.whiskeys w, src
   where w.id <> src.id
     and w.status = 'approved'
     and (w.distillery_id = src.distillery_id
          or (w.category = src.category and w.region is not distinct from src.region)
          or (w.category = src.category and w.country = src.country))
   order by
     (w.distillery_id = src.distillery_id) desc nulls last,
     (w.region is not distinct from src.region) desc,
     abs(coalesce(w.abv, 45) - coalesce(src.abv, 45)) asc,
     w.ratings_count desc
   limit least(greatest(p_limit, 1), 50)
$$;

-- Aggregate flavor tags across all tastings of a whiskey (aggregate only, so
-- it is safe to expose regardless of individual tasting visibility).
create or replace function public.whiskey_flavor_profile(p_whiskey_id uuid)
returns table (tag_slug text, label text, group_slug text, group_label text, tasting_count int)
language sql stable security definer set search_path = public as $$
  select ft.slug, ft.label, ft.group_slug, ft.group_label, count(*)::int
    from public.tasting_flavors tf
    join public.tastings t on t.id = tf.tasting_id
    join public.flavor_tags ft on ft.slug = tf.tag_slug
   where t.whiskey_id = p_whiskey_id
   group by ft.slug, ft.label, ft.group_slug, ft.group_label, ft.sort
   order by count(*) desc, ft.sort
   limit 12
$$;

-- What the people I follow think of this whiskey (RLS applies).
create or replace function public.whiskey_friend_rankings(p_whiskey_id uuid)
returns table (user_id uuid, username text, display_name text, avatar_url text,
               tier public.rating_tier, score numeric, overall_rank bigint, total bigint)
language sql stable security invoker set search_path = public as $$
  select r.user_id, p.username::text, p.display_name, p.avatar_url,
         r.tier, r.score, r.overall_rank, r.total
    from public.v_rankings r
    join public.follows f on f.followee_id = r.user_id and f.follower_id = auth.uid() and f.status = 'accepted'
    join public.profiles p on p.id = r.user_id
   where r.whiskey_id = p_whiskey_id
   order by r.score desc
$$;

-- -----------------------------------------------------------------------------
-- Feed. Without p_actor: me + people I follow. With p_actor: that user's
-- activity (for profile pages), subject to can_view_profile.
-- -----------------------------------------------------------------------------
create or replace function public.feed(
  p_limit     int    default 30,
  p_before_id bigint default null,
  p_actor     uuid   default null
)
returns table (
  id bigint, kind public.activity_kind, created_at timestamptz,
  actor jsonb, whiskey jsonb, tasting jsonb, event jsonb, target_user jsonb,
  payload jsonb, liked_by_me boolean
)
language sql stable security definer set search_path = public as $$
  select a.id, a.kind, a.created_at,
         jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name,
                            'avatar_url', p.avatar_url) as actor,
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
                              'avatar_url', tu.avatar_url)
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

-- -----------------------------------------------------------------------------
-- Taste match: pairwise agreement over whiskeys both users ranked.
-- -----------------------------------------------------------------------------
create or replace function public.taste_match(p_other uuid)
returns table (common_count int, agreement_pct numeric, avg_score_diff numeric)
language sql stable security definer set search_path = public as $$
  with common as (
    select m.whiskey_id, m.score as s1, t.score as s2
      from public.rankings m
      join public.rankings t on t.whiskey_id = m.whiskey_id and t.user_id = p_other
     where m.user_id = auth.uid()
       and public.can_view_profile(p_other)
     limit 500
  ),
  pairs as (
    select a.s1 as a1, a.s2 as a2, b.s1 as b1, b.s2 as b2
      from common a join common b on a.whiskey_id < b.whiskey_id
  )
  select (select count(*) from common)::int,
         (select round(100.0 * avg(case when sign(a1 - b1) = sign(a2 - b2) then 1 else 0 end), 0) from pairs),
         (select round(avg(abs(s1 - s2)), 2) from common)
$$;

-- -----------------------------------------------------------------------------
-- Events
-- -----------------------------------------------------------------------------
create or replace function public.join_event(p_code text)
returns setof public.events
language plpgsql security definer set search_path = public as $$
declare
  v_event public.events;
  v_user  uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into v_event from public.events
   where join_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if not found then
    raise exception 'no event with that code' using errcode = 'P0002';
  end if;
  insert into public.event_members (event_id, user_id, role)
  values (v_event.id, v_user, 'attendee')
  on conflict do nothing;
  return query select * from public.events e where e.id = v_event.id;
end $$;

-- Crowd leaderboard for one event. Counts each member's current ranking of a
-- pour, but only if they logged a tasting of it at this event.
create or replace function public.event_leaderboard(p_event_id uuid)
returns table (
  pour_id uuid, whiskey_id uuid, whiskey_name text, label text, flight text,
  table_location text, sort_order int,
  ratings_count int, avg_score numeric,
  loved int, liked int, fine int, disliked int,
  my_tier public.rating_tier, my_score numeric, my_tried boolean
)
language sql stable security definer set search_path = public as $$
  select ep.id, w.id, w.name, ep.label, ep.flight, ep.table_location, ep.sort_order,
         count(r.user_id)::int,
         round(avg(r.score), 1),
         count(*) filter (where r.tier = 'loved')::int,
         count(*) filter (where r.tier = 'liked')::int,
         count(*) filter (where r.tier = 'fine')::int,
         count(*) filter (where r.tier = 'disliked')::int,
         (select mr.tier  from public.rankings mr where mr.user_id = auth.uid() and mr.whiskey_id = w.id),
         (select mr.score from public.rankings mr where mr.user_id = auth.uid() and mr.whiskey_id = w.id),
         exists (select 1 from public.tastings t
                  where t.event_id = ep.event_id and t.user_id = auth.uid() and t.whiskey_id = w.id)
    from public.event_pours ep
    join public.whiskeys w on w.id = ep.whiskey_id
    left join public.rankings r
      on r.whiskey_id = ep.whiskey_id
     and exists (select 1 from public.event_members m
                  where m.event_id = ep.event_id and m.user_id = r.user_id)
     and exists (select 1 from public.tastings t
                  where t.event_id = ep.event_id and t.user_id = r.user_id and t.whiskey_id = r.whiskey_id)
   where ep.event_id = p_event_id
     and exists (select 1 from public.event_members m
                  where m.event_id = p_event_id and m.user_id = auth.uid())
   group by ep.id, w.id, w.name, ep.label, ep.flight, ep.table_location, ep.sort_order, ep.event_id
   order by (count(r.user_id) >= 3) desc, avg(r.score) desc nulls last, count(r.user_id) desc, ep.sort_order
$$;

-- -----------------------------------------------------------------------------
-- Moderation
-- -----------------------------------------------------------------------------
create or replace function public.merge_whiskeys(p_source uuid, p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_src public.whiskeys;
  r record;
begin
  if not public.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  if p_source = p_target then
    raise exception 'source and target are the same';
  end if;
  select * into v_src from public.whiskeys where id = p_source;
  if not found then raise exception 'unknown source'; end if;

  -- rankings: keep the target's ranking when a user has both, otherwise repoint.
  for r in select user_id, tier, position from public.rankings where whiskey_id = p_source loop
    if exists (select 1 from public.rankings where user_id = r.user_id and whiskey_id = p_target) then
      delete from public.rankings where user_id = r.user_id and whiskey_id = p_source;
      update public.rankings set position = position - 1
       where user_id = r.user_id and tier = r.tier and position > r.position;
      perform public.recompute_tier_scores(r.user_id, r.tier);
    else
      update public.rankings set whiskey_id = p_target
       where user_id = r.user_id and whiskey_id = p_source;
    end if;
  end loop;

  update public.tastings set whiskey_id = p_target where whiskey_id = p_source;
  update public.comparisons set winner_whiskey_id = p_target where winner_whiskey_id = p_source;
  update public.comparisons set loser_whiskey_id  = p_target where loser_whiskey_id  = p_source;
  delete from public.comparisons where winner_whiskey_id = loser_whiskey_id;
  update public.collection_bottles set whiskey_id = p_target where whiskey_id = p_source;
  update public.activities set whiskey_id = p_target where whiskey_id = p_source;
  update public.notifications set whiskey_id = p_target where whiskey_id = p_source;

  insert into public.wishlist (user_id, whiskey_id, created_at)
  select user_id, p_target, created_at from public.wishlist where whiskey_id = p_source
  on conflict do nothing;
  delete from public.wishlist where whiskey_id = p_source;

  -- lineups: drop the source pour if the target is already in the lineup
  delete from public.event_pours s
   where s.whiskey_id = p_source
     and exists (select 1 from public.event_pours t where t.event_id = s.event_id and t.whiskey_id = p_target);
  update public.event_pours set whiskey_id = p_target where whiskey_id = p_source;

  insert into public.whiskey_aliases (whiskey_id, alias) values (p_target, v_src.name)
  on conflict do nothing;
  insert into public.whiskey_aliases (whiskey_id, alias)
  select p_target, alias from public.whiskey_aliases where whiskey_id = p_source
  on conflict do nothing;

  update public.whiskeys
     set status = 'merged', merged_into = p_target, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_source;

  perform public.refresh_whiskey_stats(array[p_source, p_target]);

  if v_src.created_by is not null then
    insert into public.notifications (user_id, kind, whiskey_id, payload)
    values (v_src.created_by, 'whiskey_merged', p_target, jsonb_build_object('merged_name', v_src.name));
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Account: export and delete (self-serve GDPR/CCPA)
-- -----------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile',     (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'rankings',    (select coalesce(jsonb_agg(to_jsonb(r) order by r.overall_rank), '[]'::jsonb)
                      from public.v_rankings r where r.user_id = auth.uid()),
    'tastings',    (select coalesce(jsonb_agg(to_jsonb(t) order by t.tasted_at), '[]'::jsonb)
                      from public.tastings t where t.user_id = auth.uid()),
    'flavors',     (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb)
                      from public.tasting_flavors f
                      join public.tastings t on t.id = f.tasting_id where t.user_id = auth.uid()),
    'comparisons', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
                      from public.comparisons c where c.user_id = auth.uid()),
    'wishlist',    (select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb)
                      from public.wishlist w where w.user_id = auth.uid()),
    'collection',  (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
                      from public.collection_bottles c where c.user_id = auth.uid()),
    'follows',     (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb)
                      from public.follows f where f.follower_id = auth.uid()),
    'events',      (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
                      from public.event_members m where m.user_id = auth.uid())
  )
$$;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();   -- cascades to profiles and everything below
end $$;
