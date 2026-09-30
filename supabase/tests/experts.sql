-- Taste experts: who can grant the badge, the application flow, and the
-- queries people use to find experts and follow their picks.
-- Runs in one transaction and rolls back, like smoke.sql.
\set ON_ERROR_STOP on
begin;

-- ------------------------------------------------------------- fixtures ----
insert into auth.users (id, email, raw_user_meta_data) values
  ('d0000000-0000-0000-0000-00000000000d', 'mod@example.com',  '{"username":"mod"}'),
  ('e0000000-0000-0000-0000-00000000000e', 'erin@example.com', '{"username":"erin","display_name":"Erin"}'),
  ('f0000000-0000-0000-0000-00000000000f', 'pat@example.com',  '{"username":"pat","display_name":"Pat"}'),
  ('a0000000-0000-0000-0000-00000000000a', 'ron@example.com',  '{"username":"ron","display_name":"Ron"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'xan@example.com',  '{"username":"xan","display_name":"Xan"}');

-- Moderators are made by hand, as the table owner — which also shows the
-- guard only stops client roles.
update public.profiles set is_moderator = true where username = 'mod';
update public.profiles set visibility = 'followers' where username = 'pat';

insert into public.whiskeys (id, name, brand, category, country, region, abv, status) values
  ('22222222-0000-0000-0000-000000000001', 'Stagg Jr', 'Stagg', 'bourbon', 'US', 'Kentucky', 64.2, 'approved'),
  ('22222222-0000-0000-0000-000000000002', 'Ardbeg 10', 'Ardbeg', 'scotch_single_malt', 'GB', 'Islay', 46.0, 'approved'),
  ('22222222-0000-0000-0000-000000000003', 'Yamazaki 12', 'Yamazaki', 'japanese', 'JP', null, 43.0, 'approved');

create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true)
$$;

set local role authenticated;

-- ---------------------------------------------- nobody badges themselves ---
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  begin
    update public.profiles set expert_title = 'Self-declared', expert_since = now() where id = auth.uid();
    assert false, 'a user granted themselves the expert badge';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set followers_count = 100000 where id = auth.uid();
    assert false, 'a user inflated their own follower count';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set is_moderator = true where id = auth.uid();
    assert false, 'a user made themselves a moderator';
  exception when insufficient_privilege or check_violation then null;
  end;
end $$;

-- Ordinary edits are untouched by the guard.
update public.profiles set display_name = 'Ron W', bio = 'Rye guy' where id = auth.uid();
do $$ begin
  assert (select display_name from public.profiles where id = auth.uid()) = 'Ron W', 'normal self-edit still works';
end $$;

-- Counters still move when the database moves them (security definer).
insert into public.follows (follower_id, followee_id) values (auth.uid(), 'e0000000-0000-0000-0000-00000000000e');
do $$ begin
  assert (select followers_count from public.profiles where username = 'erin') = 1,
         'follower count still maintained by its trigger';
end $$;

-- ---------------------------------------------------- non-moderators ------
do $$ begin
  begin
    perform public.set_expert(auth.uid(), 'Me', '{rye}');
    assert false, 'non-moderator designated an expert';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.revoke_expert('e0000000-0000-0000-0000-00000000000e');
    assert false, 'non-moderator revoked a badge';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ----------------------------------------------------------- applying -----
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
do $$ begin
  begin
    perform public.apply_for_expert('Writer', '{}', repeat('x', 60));
    assert false, 'accepted an application with no specialties';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.apply_for_expert('Writer', '{bourbon}', 'too short');
    assert false, 'accepted an application with no real credentials';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.apply_for_expert('Writer', '{bourbon}', repeat('x', 60), '{javascript:alert(1)}');
    assert false, 'accepted a non-http link';
  exception when invalid_parameter_value then null;
  end;
end $$;

select public.apply_for_expert(
  'Bourbon writer',
  '{bourbon, rye, bourbon}',
  'Ten years covering Kentucky distilleries for regional press; judge at two spirits competitions.',
  '{https://example.com/erin}'
);
do $$ begin
  assert (select specialties from public.expert_applications where user_id = auth.uid())
         = '{bourbon,rye}'::public.whiskey_category[], 'specialties de-duplicated';
  begin
    perform public.apply_for_expert('Again', '{bourbon}', repeat('x', 60));
    assert false, 'second open application accepted';
  exception when raise_exception then null;
  end;
end $$;

-- Applicants see their own application; others don't.
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select count(*) from public.expert_applications) = 0, 'ron can see erin''s application';
  begin
    perform public.review_expert_application(
      (select id from public.expert_applications limit 1), true);
    -- ron can't even see the row, so this is "no such application"
    assert false, 'non-moderator reviewed an application';
  exception when insufficient_privilege or no_data_found then null;
  end;
end $$;

-- ---------------------------------------------------------- reviewing -----
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
do $$
declare v_app uuid;
begin
  select id into v_app from public.expert_applications where status = 'pending';
  assert v_app is not null, 'moderator sees the queue';
  perform public.review_expert_application(v_app, true, 'Bourbon & rye writer', 'Welcome aboard');
  begin
    perform public.review_expert_application(v_app, false);
    assert false, 'reviewed the same application twice';
  exception when raise_exception then null;
  end;
end $$;

reset role;
do $$
declare p public.profiles;
begin
  select * into p from public.profiles where username = 'erin';
  assert p.expert_title = 'Bourbon & rye writer', format('title override applied, got %s', p.expert_title);
  assert p.expert_specialties = '{bourbon,rye}'::public.whiskey_category[], 'specialties carried over';
  assert p.expert_since is not null, 'badge granted';
  assert p.expert_verified_by = 'd0000000-0000-0000-0000-00000000000d', 'records who verified';
  assert (select kind from public.notifications where user_id = p.id order by id desc limit 1) = 'expert_approved',
         'applicant notified';
end $$;
set local role authenticated;

-- An expert can't apply again.
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
do $$ begin
  begin
    perform public.apply_for_expert('More', '{bourbon}', repeat('x', 60));
    assert false, 'an existing expert applied again';
  exception when raise_exception then null;
  end;
end $$;

-- Direct designation, and a second (private) expert.
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select public.set_expert('f0000000-0000-0000-0000-00000000000f', 'Islay specialist', '{scotch_single_malt}');
select public.set_expert('b0000000-0000-0000-0000-00000000000b', 'Japanese whisky educator', '{japanese}');

-- --------------------------------------------------------------- picks ----
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
select * from public.upsert_ranking('22222222-0000-0000-0000-000000000001', 'loved', 0);
insert into public.tastings (user_id, whiskey_id, note)
  values (auth.uid(), '22222222-0000-0000-0000-000000000001', 'Cherry cola and oak, hot but worth it.');

select pg_temp.as_user('f0000000-0000-0000-0000-00000000000f');
select * from public.upsert_ranking('22222222-0000-0000-0000-000000000002', 'loved', 0);

select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select * from public.upsert_ranking('22222222-0000-0000-0000-000000000003', 'loved', 0);
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), 'a0000000-0000-0000-0000-00000000000a');   -- xan blocks ron

-- Ron: follows erin, not pat (private), and is blocked by xan.
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$
declare n int;
begin
  -- Directory
  select count(*) into n from public.list_experts();
  assert n = 2, format('ron sees erin and pat, not xan who blocked him; saw %s', n);
  assert (select follow_status from public.list_experts() where username = 'erin') = 'accepted',
         'directory shows ron already follows erin';
  assert (select count(*) from public.list_experts('{rye}')) = 1, 'specialty filter by overlap';
  assert (select count(*) from public.list_experts(null, 'islay')) = 1, 'search matches the title';

  -- Picks respect visibility: pat is private and ron doesn't follow her.
  select count(*) into n from public.expert_picks();
  assert n = 1, format('ron should see only erin''s pick, saw %s', n);
  assert (select expert_count from public.expert_picks() where name = 'Stagg Jr') = 1;
  assert (select experts -> 0 ->> 'username' from public.expert_picks() where name = 'Stagg Jr') = 'erin',
         'pick names the expert';
  assert (select count(*) from public.expert_picks('{scotch_single_malt}')) = 0, 'category filter';

  -- One whiskey's expert takes, with the note.
  assert (select note from public.whiskey_expert_takes('22222222-0000-0000-0000-000000000001'))
         like 'Cherry cola%', 'expert take carries their note';
  assert (select count(*) from public.whiskey_expert_takes('22222222-0000-0000-0000-000000000002')) = 0,
         'private expert''s take hidden from non-followers';

  -- Experts feed: erin's rating shows even for someone who wouldn't otherwise
  -- see it; pat's (private) and xan's (blocked) don't.
  -- Erin's rating and her note are two activities; nothing of pat's or xan's.
  select count(*) into n from public.feed(30, null, null, true);
  assert n = 2, format('experts feed should have erin''s rating and note, had %s', n);
  assert (select bool_and(actor ->> 'username' = 'erin') from public.feed(30, null, null, true)),
         'experts feed leaked a private or blocking expert';
  assert (select actor ->> 'expert_title' from public.feed(30, null, null, true) limit 1) = 'Bourbon & rye writer',
         'feed carries the badge';
end $$;

-- The ordinary feed is still people I follow, and still works when called
-- with the old three arguments.
do $$ begin
  assert (select count(*) from public.feed(30, null, null)) >= 1, 'ron''s feed has erin (followed)';
  assert (select count(*) from public.feed(30)) >= 1, 'one-argument call still resolves';
end $$;

-- A follower of the private expert does see her pick.
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
insert into public.follows (follower_id, followee_id) values (auth.uid(), 'f0000000-0000-0000-0000-00000000000f');   -- a request: pat is private
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000f');
update public.follows set status = 'accepted'
 where follower_id = 'e0000000-0000-0000-0000-00000000000e' and followee_id = auth.uid();
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
do $$ begin
  -- Her own, pat's now that she follows her, and xan's (public; xan only blocked ron).
  assert (select count(*) from public.expert_picks()) = 3,
         format('erin should see all three picks, saw %s', (select count(*) from public.expert_picks()));
end $$;

-- -------------------------------------------------------------- revoke ----
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select public.revoke_expert('f0000000-0000-0000-0000-00000000000f');
reset role;
do $$ begin
  assert (select expert_since from public.profiles where username = 'pat') is null, 'badge revoked';
  assert (select expert_title from public.profiles where username = 'pat') is null;
end $$;

rollback;
