-- Smoke tests: exercised by scripts/local-check.sh (vanilla Postgres + stub)
-- and runnable against `supabase start` with `psql ... -f tests/smoke.sql`.
-- Everything runs in one transaction and rolls back.
\set ON_ERROR_STOP on
begin;

-- ------------------------------------------------------------- fixtures ----
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@example.com', '{"username":"alice","display_name":"Alice"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob@example.com',   '{"username":"bob","display_name":"Bob"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'carol@example.com', '{"username":"Alice"}');   -- clashes → placeholder

do $$ begin
  assert (select count(*) from public.profiles) = 3, 'profiles created by trigger';
  assert (select username from public.profiles where id = 'cccccccc-0000-0000-0000-000000000003') like 'user_%',
         'duplicate username falls back to placeholder';
end $$;

update public.profiles set visibility = 'followers', username = 'carol' where id = 'cccccccc-0000-0000-0000-000000000003';

insert into public.whiskeys (id, name, brand, category, country, region, abv, age_years, status) values
  ('11111111-0000-0000-0000-000000000001', 'Blanton''s Original Single Barrel', 'Blanton''s', 'bourbon', 'US', 'Kentucky', 46.5, null, 'approved'),
  ('11111111-0000-0000-0000-000000000002', 'Lagavulin 16 Year', 'Lagavulin', 'scotch_single_malt', 'GB', 'Islay', 43.0, 16, 'approved'),
  ('11111111-0000-0000-0000-000000000003', 'Redbreast 12 Year', 'Redbreast', 'irish', 'IE', 'Cork', 40.0, 12, 'approved'),
  ('11111111-0000-0000-0000-000000000004', 'Jim Beam White Label', 'Jim Beam', 'bourbon', 'US', 'Kentucky', 40.0, null, 'approved'),
  ('11111111-0000-0000-0000-000000000005', 'Blantons Single Barrel (dupe)', null, 'bourbon', 'US', 'Kentucky', 46.5, null, 'pending'),
  ('11111111-0000-0000-0000-000000000006', 'Eagle Rare 10 Year', 'Eagle Rare', 'bourbon', 'US', 'Kentucky', 45.0, 10, 'approved');
insert into public.whiskey_aliases (whiskey_id, alias) values ('11111111-0000-0000-0000-000000000001', 'Blantons');

create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true)
$$;

set local role authenticated;

-- ------------------------------------------------------------- ranking -----
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');

select * from public.upsert_ranking('11111111-0000-0000-0000-000000000001', 'loved', 0);
do $$ begin
  assert (select score from public.rankings where whiskey_id = '11111111-0000-0000-0000-000000000001') = 9.0,
         'single loved item sits mid-band (9.0)';
end $$;

select * from public.upsert_ranking('11111111-0000-0000-0000-000000000002', 'loved', 0);   -- Lag 16 beats Blanton's
select * from public.upsert_ranking('11111111-0000-0000-0000-000000000003', 'liked');       -- append
select * from public.upsert_ranking('11111111-0000-0000-0000-000000000004', 'disliked', 0);

do $$
declare r record;
begin
  select score into r from public.rankings where whiskey_id = '11111111-0000-0000-0000-000000000002';
  assert r.score = 9.5, format('lag16 expected 9.5 got %s', r.score);
  select score into r from public.rankings where whiskey_id = '11111111-0000-0000-0000-000000000001';
  assert r.score = 8.5, format('blantons expected 8.5 got %s', r.score);
  select score into r from public.rankings where whiskey_id = '11111111-0000-0000-0000-000000000003';
  assert r.score = 7.0, format('redbreast expected 7.0 got %s', r.score);
  select score into r from public.rankings where whiskey_id = '11111111-0000-0000-0000-000000000004';
  assert r.score = 2.5, format('beam expected 2.5 got %s', r.score);
  assert (select overall_rank from public.v_rankings where whiskey_id = '11111111-0000-0000-0000-000000000002') = 1;
  assert (select overall_rank from public.v_rankings where whiskey_id = '11111111-0000-0000-0000-000000000004') = 4;
  assert (select total from public.v_rankings limit 1) = 4;
end $$;

-- re-rank: move Blanton's down to Liked, top of tier
select * from public.upsert_ranking('11111111-0000-0000-0000-000000000001', 'liked', 0,
  null, '[{"winner":"11111111-0000-0000-0000-000000000001","loser":"11111111-0000-0000-0000-000000000003"}]');
do $$
begin
  assert (select score from public.rankings where whiskey_id = '11111111-0000-0000-0000-000000000002') = 9.0, 'lag16 alone in loved → 9.0';
  assert (select score from public.rankings where whiskey_id = '11111111-0000-0000-0000-000000000001') = 7.5, 'blantons top of liked → 7.5';
  assert (select score from public.rankings where whiskey_id = '11111111-0000-0000-0000-000000000003') = 6.5, 'redbreast → 6.5';
  assert (select position from public.rankings where whiskey_id = '11111111-0000-0000-0000-000000000003') = 1;
  assert (select count(*) from public.comparisons) = 1, 'comparison logged';
  assert (select count(*) from public.activities where kind = 'rated') = 5, '4 new + 1 tier change';
  assert (select ratings_count from public.whiskeys where id = '11111111-0000-0000-0000-000000000001') = 1;
  assert (select avg_score from public.whiskeys where id = '11111111-0000-0000-0000-000000000001') = 7.5;
  assert (select liked_count from public.whiskeys where id = '11111111-0000-0000-0000-000000000001') = 1;
  assert (select rankings_count from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 4;
end $$;

-- remove
select public.remove_ranking('11111111-0000-0000-0000-000000000002');
do $$ begin
  assert (select count(*) from public.rankings where tier = 'loved') = 0;
  assert (select overall_rank from public.v_rankings where whiskey_id = '11111111-0000-0000-0000-000000000001') = 1, 'blantons now #1';
  assert (select ratings_count from public.whiskeys where id = '11111111-0000-0000-0000-000000000002') = 0;
end $$;

-- ------------------------------------------------------------- search ------
do $$ begin
  assert (select name from public.search_whiskeys('blantons') limit 1) = 'Blanton''s Original Single Barrel', 'typo/alias search: blantons';
  assert (select name from public.search_whiskeys('lag 16') limit 1) = 'Lagavulin 16 Year', 'abbrev search: lag 16';
  assert (select name from public.search_whiskeys('red breast') limit 1) = 'Redbreast 12 Year', 'split word search';
  assert exists (select 1 from public.search_whiskeys('', array['bourbon']::public.whiskey_category[], null, null, 100) where id = '11111111-0000-0000-0000-000000000005'), 'category filter incl. pending';
  assert not exists (select 1 from public.search_whiskeys('', array['rye']::public.whiskey_category[], null, null, 100) where category <> 'rye'), 'category filter excludes others';
  assert (select status from public.search_whiskeys('blanton') limit 1) = 'approved', 'approved ranks above pending dupe';
  assert (select whiskey_name from public.match_whiskey_lines(array['Eagle Rare 10'])) = 'Eagle Rare 10 Year', 'line match';
end $$;

-- ------------------------------------------------------------- social ------
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
insert into public.follows (follower_id, followee_id) values ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.follows (follower_id, followee_id) values ('bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003');
do $$ begin
  assert (select status from public.follows where followee_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'accepted', 'public → accepted';
  assert (select status from public.follows where followee_id = 'cccccccc-0000-0000-0000-000000000003') = 'pending', 'followers-only → pending';
  assert (select count(*) from public.rankings where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 3, 'bob sees alice''s rankings';
  assert (select count(*) from public.feed()) >= 5, 'bob''s feed shows alice''s activity';
end $$;

-- carol ranks something; bob can't see it until she accepts
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select * from public.upsert_ranking('11111111-0000-0000-0000-000000000001', 'loved', 0);
select * from public.upsert_ranking('11111111-0000-0000-0000-000000000005', 'fine', 0);
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
do $$ begin
  assert (select count(*) from public.rankings where user_id = 'cccccccc-0000-0000-0000-000000000003') = 0, 'pending follow hides rankings';
end $$;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
update public.follows set status = 'accepted' where followee_id = 'cccccccc-0000-0000-0000-000000000003';
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
do $$ begin
  assert (select count(*) from public.rankings where user_id = 'cccccccc-0000-0000-0000-000000000003') = 2, 'accepted follow reveals rankings';
  assert (select followers_count from public.profiles where id = 'cccccccc-0000-0000-0000-000000000003') = 1;
  assert (select following_count from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002') = 2;
end $$;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  assert (select count(*) from public.rankings where user_id = 'cccccccc-0000-0000-0000-000000000003') = 0, 'alice does not follow carol';
  assert (select count(*) from public.notifications where kind = 'new_follower') = 1, 'alice notified of follower';
end $$;

-- taste match
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select * from public.upsert_ranking('11111111-0000-0000-0000-000000000001', 'loved', 0);
select * from public.upsert_ranking('11111111-0000-0000-0000-000000000003', 'fine', 0);
select * from public.upsert_ranking('11111111-0000-0000-0000-000000000004', 'disliked', 0);
do $$
declare m record;
begin
  select * into m from public.taste_match('aaaaaaaa-0000-0000-0000-000000000001');
  assert m.common_count = 3, format('common expected 3 got %s', m.common_count);
  assert m.agreement_pct = 100, format('agreement expected 100 got %s', m.agreement_pct);
  assert (select friend_count from public.friends_loved() limit 1) = 1, 'friends_loved (carol loves blantons)';
end $$;

-- ------------------------------------------------------------- tastings ----
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.tastings (id, user_id, whiskey_id, note, serving, score_appearance, score_nose, score_palate, score_finish, score_balance)
values ('22222222-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
        'Classic. Caramel and citrus.', 'neat', 17, 18, 17, 16, 18);
insert into public.tasting_flavors (tasting_id, tag_slug, intensity) values
  ('22222222-0000-0000-0000-000000000001', 'caramel', 3),
  ('22222222-0000-0000-0000-000000000001', 'citrus', 2);
do $$ begin
  assert (select score_total from public.tastings where id = '22222222-0000-0000-0000-000000000001') = 86;
  assert (select count(*) from public.activities where tasting_id = '22222222-0000-0000-0000-000000000001') = 1, 'exactly one post per tasting';
  assert (select count(*) from public.whiskey_flavor_profile('11111111-0000-0000-0000-000000000001')) = 2;
end $$;

select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
insert into public.tasting_likes (user_id, tasting_id) values ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001');
insert into public.tasting_comments (tasting_id, user_id, body) values ('22222222-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Agreed!');
do $$ begin
  assert (select likes_count from public.tastings where id = '22222222-0000-0000-0000-000000000001') = 1;
  assert (select comments_count from public.tastings where id = '22222222-0000-0000-0000-000000000001') = 1;
  assert (select liked_by_me from public.feed() where tasting is not null limit 1) = true;
end $$;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  assert (select count(*) from public.notifications where kind in ('like', 'comment')) = 2, 'like + comment notifications';
end $$;

-- blocks: alice blocks bob → bob loses access
insert into public.blocks (blocker_id, blocked_id) values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
do $$ begin
  assert (select count(*) from public.rankings where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'blocked user sees nothing';
  assert (select count(*) from public.feed() where (actor ->> 'id')::uuid = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'blocked user out of feed';
end $$;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
delete from public.blocks where blocked_id = 'bbbbbbbb-0000-0000-0000-000000000002';

-- ------------------------------------------------------------- events ------
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.events (id, name, starts_at, created_by)
values ('33333333-0000-0000-0000-000000000001', 'Bourbon Night', now() + interval '1 day', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.event_pours (event_id, whiskey_id, flight, sort_order) values
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Flight 1', 1),
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000006', 'Flight 1', 2),
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000004', 'Flight 2', 3);
do $$
declare code text;
begin
  select join_code into code from public.events where id = '33333333-0000-0000-0000-000000000001';
  assert code ~ '^[A-Z2-9]{6}$', 'join code generated';
  assert (select role from public.event_members where event_id = '33333333-0000-0000-0000-000000000001' and user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'organizer';
  assert (select lineup_version from public.events where id = '33333333-0000-0000-0000-000000000001') = 4, 'lineup version bumps per pour';
end $$;

-- carol can't see a code-only event she hasn't joined; bob joins by code
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
do $$ begin
  assert (select count(*) from public.events) = 0, 'code-only event hidden from non-members';
  assert (select count(*) from public.event_pours) = 0, 'pours hidden too';
end $$;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
-- bob cannot read the code before joining (RLS), so fetch it as superuser
reset role;
select join_code as code from public.events where id = '33333333-0000-0000-0000-000000000001' \gset
set local role authenticated;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select id from public.join_event(lower(:'code'));    -- case-insensitive
do $$ begin
  assert (select count(*) from public.events where id = '33333333-0000-0000-0000-000000000001') = 1, 'bob sees the event after joining';
  assert (select count(*) from public.event_pours) = 3, 'bob sees the lineup';
  assert (select member_count from public.events where id = '33333333-0000-0000-0000-000000000001') = 2;
end $$;
-- bob is not a host: adding a pour must fail under RLS
do $$
begin
  insert into public.event_pours (event_id, whiskey_id) values ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003');
  raise exception 'attendee was able to edit the lineup';
exception when insufficient_privilege then
  null;
end $$;

-- bob rates two pours at the event
insert into public.tastings (user_id, whiskey_id, event_id, setting)
values ('bbbbbbbb-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000006', '33333333-0000-0000-0000-000000000001', 'event');
select * from public.upsert_ranking('11111111-0000-0000-0000-000000000006', 'loved', 1, '33333333-0000-0000-0000-000000000001');
insert into public.tastings (user_id, whiskey_id, event_id, setting)
values ('bbbbbbbb-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000001', 'event');

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.tastings (user_id, whiskey_id, event_id, setting)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000006', '33333333-0000-0000-0000-000000000001', 'event');
select * from public.upsert_ranking('11111111-0000-0000-0000-000000000006', 'loved', 0, '33333333-0000-0000-0000-000000000001');

do $$
declare l record;
begin
  select * into l from public.event_leaderboard('33333333-0000-0000-0000-000000000001') where whiskey_id = '11111111-0000-0000-0000-000000000006';
  assert l.ratings_count = 2, format('eagle rare expected 2 ratings got %s', l.ratings_count);
  assert l.loved = 2;
  assert l.my_tried = true and l.my_tier = 'loved';
  select * into l from public.event_leaderboard('33333333-0000-0000-0000-000000000001') where whiskey_id = '11111111-0000-0000-0000-000000000004';
  assert l.ratings_count = 1, 'beam: bob rated it before, logged at event → counts';
  select * into l from public.event_leaderboard('33333333-0000-0000-0000-000000000001') where whiskey_id = '11111111-0000-0000-0000-000000000001';
  assert l.ratings_count = 0, 'blantons: nobody logged it at the event';
  assert l.my_tried = false;
end $$;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
do $$ begin
  assert (select count(*) from public.event_leaderboard('33333333-0000-0000-0000-000000000001')) = 0, 'non-members get no leaderboard';
end $$;

-- ------------------------------------------------------------- moderation --
reset role;
update public.profiles set is_moderator = true where id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
-- carol ranked the dupe (w5) and the real one (w1); merging must drop her dupe ranking and keep w1
select public.merge_whiskeys('11111111-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001');
do $$ begin
  assert (select status from public.whiskeys where id = '11111111-0000-0000-0000-000000000005') = 'merged';
  assert (select count(*) from public.whiskey_aliases where whiskey_id = '11111111-0000-0000-0000-000000000001') = 2, 'dupe name became alias';
  assert not exists (select 1 from public.search_whiskeys('blanton') where id = '11111111-0000-0000-0000-000000000005'), 'merged rows leave search';
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.rankings where whiskey_id = '11111111-0000-0000-0000-000000000005') = 0, 'no rankings point at merged row';
  assert (select count(*) from public.rankings where user_id = 'cccccccc-0000-0000-0000-000000000003') = 1, 'carol keeps only the real one';
  assert (select ratings_count from public.whiskeys where id = '11111111-0000-0000-0000-000000000001') = 3, 'alice+bob+carol';
end $$;

-- ------------------------------------------------------------- account -----
set local role authenticated;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
do $$
declare j jsonb;
begin
  j := public.export_my_data();
  assert jsonb_array_length(j -> 'rankings') = 4, format('export rankings %s', jsonb_array_length(j -> 'rankings'));
  assert jsonb_array_length(j -> 'tastings') = 2;
  assert (j -> 'profile' ->> 'username') = 'alice';
end $$;
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select public.delete_my_account();
reset role;
do $$ begin
  assert (select count(*) from auth.users where id = 'cccccccc-0000-0000-0000-000000000003') = 0, 'auth user deleted';
  assert (select count(*) from public.profiles where id = 'cccccccc-0000-0000-0000-000000000003') = 0, 'profile cascaded';
  assert (select count(*) from public.rankings where user_id = 'cccccccc-0000-0000-0000-000000000003') = 0, 'rankings cascaded';
  assert (select ratings_count from public.whiskeys where id = '11111111-0000-0000-0000-000000000001') = 2, 'stats refreshed after cascade';
end $$;

rollback;
