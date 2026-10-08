-- Ticket 6 booking checks. Runs after cross_tenant_rls.sql, same database.
-- Seed users: trainer A 1111..., client A 2222..., trainer B 3333..., client B 4444...

\pset pager off
\echo ---- Cleat booking RLS ----

insert into auth.users (id, email) values
  ('88888888-8888-8888-8888-888888888888', 'client-c@example.com');

insert into public.profiles (id, display_name, timezone) values
  ('88888888-8888-8888-8888-888888888888', 'Casey Ng', 'America/Chicago');

insert into public.memberships (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '88888888-8888-8888-8888-888888888888', 'client');

insert into public.availability_blocks (org_id, trainer_id, weekday, start_minute, end_minute, available)
select
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  day,
  17 * 60,
  20 * 60,
  true
from generate_series(1, 5) as day;

insert into public.availability_blocks (
  org_id, trainer_id, override_date, start_minute, end_minute, available
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  '2026-11-01',
  17 * 60,
  18 * 60,
  true
);

select public._rls_expect(
  'new trainer slot length defaults to 60',
  (
    select slot_minutes = 60
    from public.trainer_settings
    where user_id = '11111111-1111-1111-1111-111111111111'
  )
);

select public._rls_expect(
  'org cutoff defaults to 12 and primary calendar is ICS',
  (
    select cancel_cutoff_hours = 12 and primary_calendar = 'ics'
    from public.orgs
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  )
);

begin;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select public._rls_expect_error(
  '60 minute slots reject a 45 minute offset',
  $$select public.book_session('2026-10-30 22:45:00+00')$$,
  'That slot is not open.'
);
rollback;

begin;
update public.trainer_settings
set slot_minutes = 45
where user_id = '11111111-1111-1111-1111-111111111111';
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select public.book_session('2026-10-30 22:45:00+00');
select public._rls_expect(
  '45 minute slots accept 5:45 PM Chicago',
  (
    select (starts_at at time zone 'America/Chicago')::time = time '17:45'
    from public.sessions
    where client_id = '22222222-2222-2222-2222-222222222222'
      and status = 'booked'
  )
);
rollback;

select public._rls_expect(
  'trainer still has the default 60 after the rolled back change',
  (
    select slot_minutes = 60
    from public.trainer_settings
    where user_id = '11111111-1111-1111-1111-111111111111'
  )
);

begin;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select public.book_session('2026-10-30 22:00:00+00');
select public.book_session('2026-11-01 23:00:00+00');
commit;

select public._rls_expect(
  'Friday session is 5:00 PM Chicago before DST ends',
  (
    select (starts_at at time zone 'America/Chicago')::time = time '17:00'
    from public.sessions
    where starts_at = '2026-10-30 22:00:00+00'
  )
);

select public._rls_expect(
  'Sunday Nov 1 session is 5:00 PM Chicago after DST ends',
  (
    select (starts_at at time zone 'America/Chicago')::time = time '17:00'
    from public.sessions
    where starts_at = '2026-11-01 23:00:00+00'
  )
);

begin;
select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', true);
set local role authenticated;
select public._rls_expect_error(
  'second client booking the same slot is rejected',
  $$select public.book_session('2026-10-30 22:00:00+00')$$,
  'That slot was just booked. Pick another time.'
);
rollback;

begin;
select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', true);
set local role authenticated;
select public._rls_expect(
  'another client cannot read session rows',
  (select count(*) = 0 from public.sessions)
);
select public._rls_expect(
  'taken times are visible without names',
  (select count(*) = 2 from public.booked_ranges())
);
rollback;

begin;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select public._rls_expect(
  'client A sees only their own sessions',
  (
    select count(*) = 2
      and bool_and(client_id = '22222222-2222-2222-2222-222222222222')
    from public.sessions
  )
);
select public._rls_expect_error(
  'client cannot insert a session directly',
  $$insert into public.sessions (org_id, trainer_id, client_id, starts_at, ends_at, status)
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '2026-10-30 23:00:00+00',
      '2026-10-31 00:00:00+00',
      'booked'
    )$$,
  'permission denied'
);
rollback;

begin;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
set local role authenticated;
select public._rls_expect(
  'client B cannot see org A sessions',
  (select count(*) = 0 from public.sessions)
);
rollback;

begin;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select public._rls_expect(
  'trainer B cannot see org A sessions',
  (select count(*) = 0 from public.sessions)
);
select public._rls_expect(
  'trainer B cannot see org A availability',
  (select count(*) = 0 from public.availability_blocks)
);
rollback;

begin;
set local role anon;
select public._rls_expect_error(
  'anon cannot read sessions',
  'select count(*) from public.sessions',
  'permission denied'
);
select public._rls_expect_error(
  'anon cannot read calendar tokens',
  'select count(*) from public.calendar_tokens',
  'permission denied'
);
select public._rls_expect_error(
  'anon cannot read google credentials',
  'select count(*) from public.google_credentials',
  'permission denied'
);
rollback;

insert into public.sessions (
  id, org_id, trainer_id, client_id, starts_at, ends_at, status
) values (
  '99999999-9999-9999-9999-999999999999',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  now() + interval '1 hour',
  now() + interval '2 hours',
  'booked'
);

begin;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select public._rls_expect_error(
  'client cancel inside 12 hours is rejected',
  $$select public.cancel_session('99999999-9999-9999-9999-999999999999')$$,
  'You can cancel up to 12 hours before the session.'
);
rollback;

update public.orgs
set cancel_cutoff_hours = 0
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

begin;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select public.cancel_session('99999999-9999-9999-9999-999999999999');
select public._rls_expect(
  'lowering the cutoff lets the client cancel',
  (
    select status = 'cancelled'
    from public.sessions
    where id = '99999999-9999-9999-9999-999999999999'
  )
);
rollback;

update public.orgs
set cancel_cutoff_hours = 12
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

insert into public.sessions (
  id, org_id, trainer_id, client_id, starts_at, ends_at, status
) values (
  '99999999-9999-9999-9999-999999999991',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  now() + interval '3 hours',
  now() + interval '4 hours',
  'booked'
);

begin;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public.cancel_session('99999999-9999-9999-9999-999999999991');
select public._rls_expect(
  'trainer can cancel inside the client cutoff',
  (
    select status = 'cancelled' and cancelled_by = '11111111-1111-1111-1111-111111111111'
    from public.sessions
    where id = '99999999-9999-9999-9999-999999999991'
  )
);
rollback;

delete from public.sessions
where id in (
  '99999999-9999-9999-9999-999999999999',
  '99999999-9999-9999-9999-999999999991'
);

insert into public.calendar_tokens (user_id, org_id, nonce) values (
  '22222222-2222-2222-2222-222222222222',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  repeat('ab', 32)
);

begin;
set local role anon;
select public._rls_expect(
  'feed for client A names the trainer and hides other orgs',
  (
    select count(*) = 2
      and bool_and(person_name = 'Alex Rivera')
    from public.calendar_feed(repeat('ab', 32))
  )
);
select public._rls_expect_error(
  'unknown feed nonce returns no rows',
  $$select * from public.calendar_feed(repeat('cd', 32))$$,
  'calendar_token_missing'
);
rollback;

begin;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select public.issue_calendar_token(true);
commit;

select public._rls_expect(
  'regenerating a token revokes the previous nonce',
  (
    select revoked_at is not null
    from public.calendar_tokens
    where nonce = repeat('ab', 32)
  )
);

begin;
set local role anon;
select public._rls_expect_error(
  'revoked feed nonce is rejected',
  $$select * from public.calendar_feed(repeat('ab', 32))$$,
  'calendar_token_revoked'
);
rollback;

begin;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public._rls_expect_error(
  'google cannot be primary before it is connected',
  $$update public.orgs set primary_calendar = 'google' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'Connect Google Calendar before choosing it.'
);
select public.save_google_credentials('refresh-token-value', 'alex@example.com');
update public.orgs
set primary_calendar = 'google'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select public._rls_expect(
  'google connection does not expose the refresh token',
  (
    select connected = true and email is null
    from public.google_connection()
  )
);
select public._rls_expect_error(
  'trainer cannot read the google credentials table',
  'select refresh_token from public.google_credentials',
  'permission denied'
);
select public.disconnect_google();
select public._rls_expect(
  'disconnect resets primary calendar to ICS',
  (
    select primary_calendar = 'ics'
    from public.orgs
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  )
);
select public._rls_expect(
  'disconnect clears the google connection',
  (select connected = false from public.google_connection())
);
rollback;

\echo ALL BOOKING CHECKS PASSED
