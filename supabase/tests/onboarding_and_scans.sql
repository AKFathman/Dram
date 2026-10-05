-- The server-side drinking-age check and the label-scan allowance: the two
-- rules a client used to be trusted with. Runs in one transaction and rolls
-- back, like smoke.sql.
\set ON_ERROR_STOP on
begin;

-- ------------------------------------------------------------- fixtures ----
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'kid@example.com',   '{"username":"kid"}'),
  ('10000000-0000-0000-0000-000000000002', 'adult@example.com', '{"username":"adult"}'),
  ('10000000-0000-0000-0000-000000000003', 'taken@example.com', '{"username":"taken"}');

create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true)
$$;

set local role authenticated;

-- ---------------------------------------------- legal age by country ------
do $$ begin
  assert public.legal_drinking_age('US') = 21, 'US is 21';
  assert public.legal_drinking_age('us') = 21, 'country code is case-insensitive';
  assert public.legal_drinking_age('GB') = 18, 'UK is 18';
  assert public.legal_drinking_age(null) = 18, 'unknown country falls back to 18';
end $$;

-- ------------------------------- a client cannot mark itself verified -----
select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
do $$ begin
  begin
    update public.profiles set age_verified_at = now() where id = auth.uid();
    assert false, 'a user set age_verified_at directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set onboarded_at = now() where id = auth.uid();
    assert false, 'a user set onboarded_at directly';
  exception when insufficient_privilege then null;
  end;
  -- Ordinary profile edits still work.
  update public.profiles set bio = 'peat and smoke' where id = auth.uid();
  assert (select bio from public.profiles where id = auth.uid()) = 'peat and smoke';
end $$;

-- ------------------------------------------------- under age is refused ---
do $$ begin
  -- 20 in the US: old enough almost anywhere else, not there.
  begin
    perform public.complete_onboarding('kid', 'Kid', (current_date - interval '20 years')::date, 'US');
    assert false, 'a 20-year-old onboarded in the US';
  exception when raise_exception then
    assert sqlerrm like 'You must be 21 or older%', format('unexpected message: %s', sqlerrm);
  end;
  begin
    perform public.complete_onboarding('kid', 'Kid', (current_date - interval '17 years')::date, 'GB');
    assert false, 'a 17-year-old onboarded in the UK';
  exception when raise_exception then
    assert sqlerrm like 'You must be 18 or older%', format('unexpected message: %s', sqlerrm);
  end;
  -- Nonsense dates are a typo, not a verification.
  begin
    perform public.complete_onboarding('kid', 'Kid', (current_date + 1)::date, 'GB');
    assert false, 'a future birthday was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.complete_onboarding('kid', 'Kid', null, 'GB');
    assert false, 'a missing birthday was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.complete_onboarding('k', 'Kid', (current_date - interval '30 years')::date, 'GB');
    assert false, 'a one-letter username was accepted';
  exception when invalid_parameter_value then null;
  end;
  assert (select age_verified_at from public.profiles where id = auth.uid()) is null, 'refusals leave the profile untouched';
  assert (select onboarded_at from public.profiles where id = auth.uid()) is null;
end $$;

-- The same person is old enough in the UK; the exact birthday counts.
do $$
declare r public.profiles;
begin
  -- Turned 20 today: fine for GB. The check is on the real age, not the year.
  r := public.complete_onboarding('Kid_One', '  ', (current_date - interval '20 years')::date, 'gb');
  assert r.username = 'kid_one', 'username is lower-cased';
  assert r.display_name = 'kid_one', 'blank display name falls back to the username';
  assert r.home_country = 'GB', 'country is upper-cased';
  assert r.age_verified_at is not null, 'age verified';
  assert r.onboarded_at is not null, 'onboarded';
end $$;

-- ------------------------------------------------- the happy US case ------
select pg_temp.as_user('10000000-0000-0000-0000-000000000002');
do $$
declare r public.profiles; first_onboarded timestamptz;
begin
  -- 21st birthday is today: just old enough.
  r := public.complete_onboarding('adult', 'Adult', (current_date - interval '21 years')::date, 'US');
  assert r.age_verified_at is not null and r.onboarded_at is not null, 'a 21-year-old onboards in the US';
  first_onboarded := r.onboarded_at;

  -- Running it again (say, after a network retry) keeps the first onboarding time.
  r := public.complete_onboarding('adult', 'Adult', (current_date - interval '21 years')::date, 'US');
  assert r.onboarded_at = first_onboarded, 'onboarded_at is set once';

  -- A taken username is reported as the usual unique violation the app already handles.
  begin
    perform public.complete_onboarding('taken', 'Adult', (current_date - interval '21 years')::date, 'US');
    assert false, 'a taken username was accepted';
  exception when unique_violation then null;
  end;
end $$;

-- ------------------------------------------------- label-scan allowance ---
do $$
declare r jsonb; i int;
begin
  -- Rows are invisible to clients even though they exist.
  begin
    perform count(*) from public.label_scans;
    assert false, 'a client could read label_scans';
  exception when insufficient_privilege then null;
  end;

  for i in 1..3 loop
    r := public.record_label_scan(3);
    assert (r ->> 'allowed')::boolean, format('scan %s should be allowed', i);
    assert (r ->> 'used')::int = i, format('used should be %s, got %s', i, r ->> 'used');
    assert (r ->> 'limit')::int = 3;
  end loop;

  r := public.record_label_scan(3);
  assert not (r ->> 'allowed')::boolean, 'the fourth scan is refused';
  assert (r ->> 'used')::int = 3, 'a refused scan is not counted';
  assert (r ->> 'resets_at')::timestamptz > now(), 'a reset time is given';

  -- A refusal does not count, so raising the allowance lets the next one through.
  r := public.record_label_scan(4);
  assert (r ->> 'allowed')::boolean and (r ->> 'used')::int = 4, 'the allowance is whatever the caller passes';

  -- The default allowance applies when nothing is passed.
  r := public.record_label_scan();
  assert (r ->> 'limit')::int = 20, 'default is 20 a day';
end $$;

-- Each user has their own allowance.
select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
do $$
declare r jsonb;
begin
  r := public.record_label_scan(3);
  assert (r ->> 'allowed')::boolean and (r ->> 'used')::int = 1, 'another user starts from zero';
end $$;

-- Scans older than a day no longer count.
reset role;
update public.label_scans set created_at = now() - interval '25 hours'
 where user_id = '10000000-0000-0000-0000-000000000002';
set local role authenticated;
select pg_temp.as_user('10000000-0000-0000-0000-000000000002');
do $$
declare r jsonb;
begin
  r := public.record_label_scan(3);
  assert (r ->> 'allowed')::boolean and (r ->> 'used')::int = 1, 'yesterday''s scans have expired';
end $$;

-- Signed-out callers get nothing.
reset role;
set local role anon;
do $$ begin
  begin
    perform public.record_label_scan();
    assert false, 'anon could record a scan';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.complete_onboarding('anon', 'Anon', '1990-01-01', 'US');
    assert false, 'anon could onboard';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Deleting the account takes its scan history with it.
set local role authenticated;
select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
select public.delete_my_account();
reset role;
do $$ begin
  assert (select count(*) from public.label_scans where user_id = '10000000-0000-0000-0000-000000000001') = 0,
         'scan rows follow the profile';
end $$;

rollback;
