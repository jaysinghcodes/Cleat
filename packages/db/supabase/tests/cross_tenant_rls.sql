-- Cross tenant proof for Ticket 1.
-- Seed runs as the table owner. Assertions run as anon or authenticated
-- with request.jwt.claim.sub set, which is what auth.uid() reads.

\pset pager off
\echo ---- Cleat cross tenant RLS ----

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trainer-a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'client-a@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'trainer-b@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'client-b@example.com'),
  ('55555555-5555-5555-5555-555555555555', 'late@example.com'),
  ('66666666-6666-6666-6666-666666666666', 'new-coach@example.com'),
  ('77777777-7777-7777-7777-777777777777', 'new-client@example.com');

insert into public.profiles (id, display_name, timezone) values
  ('11111111-1111-1111-1111-111111111111', 'Alex Rivera', 'America/Chicago'),
  ('22222222-2222-2222-2222-222222222222', 'Sam Lee', 'America/Chicago'),
  ('33333333-3333-3333-3333-333333333333', 'Blair Quinn', 'America/New_York'),
  ('44444444-4444-4444-4444-444444444444', 'Riley Wong', 'America/New_York');

insert into public.orgs (id, name, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Rivera Strength', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Quinn Athletic', '33333333-3333-3333-3333-333333333333');

insert into public.memberships (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'trainer'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'client'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'trainer'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', 'client');

insert into public.programs (id, org_id, client_id, name, start_date, status, created_by) values
  (
    '10000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'Foundation',
    current_date,
    'active',
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    '10000000-0000-4000-8000-000000000011',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '44444444-4444-4444-4444-444444444444',
    'Quinn Plan',
    current_date,
    'active',
    '33333333-3333-3333-3333-333333333333'
  );

insert into public.program_days (id, program_id, org_id, client_id, position, name, is_rest) values
  (
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    0,
    'Lower A',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000012',
    '10000000-0000-4000-8000-000000000011',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '44444444-4444-4444-4444-444444444444',
    0,
    'Upper',
    false
  );

insert into public.program_exercises (
  id, day_id, program_id, org_id, client_id, position, name, sets, reps, notes
) values
  (
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    0,
    'Back squat',
    3,
    '5',
    'RPE 7'
  ),
  (
    '10000000-0000-4000-8000-000000000013',
    '10000000-0000-4000-8000-000000000012',
    '10000000-0000-4000-8000-000000000011',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '44444444-4444-4444-4444-444444444444',
    0,
    'Bench press',
    3,
    '8',
    ''
  );

insert into public.exercise_logs (
  id, org_id, client_id, program_id, day_id, exercise_id, scheduled_on, status, note
) values
  (
    '10000000-0000-4000-8000-000000000021',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
    current_date - 1,
    'done',
    ''
  ),
  (
    '10000000-0000-4000-8000-000000000022',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '44444444-4444-4444-4444-444444444444',
    '10000000-0000-4000-8000-000000000011',
    '10000000-0000-4000-8000-000000000012',
    '10000000-0000-4000-8000-000000000013',
    current_date - 1,
    'done',
    ''
  );

insert into public.set_logs (id, exercise_log_id, org_id, client_id, set_index, weight_kg, reps) values
  (
    '10000000-0000-4000-8000-000000000031',
    '10000000-0000-4000-8000-000000000021',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    1,
    61.235,
    5
  ),
  (
    '10000000-0000-4000-8000-000000000032',
    '10000000-0000-4000-8000-000000000022',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '44444444-4444-4444-4444-444444444444',
    1,
    40,
    8
  );

insert into public.nudge_events (id, org_id, client_id, trainer_id, kind, body) values
  (
    '10000000-0000-4000-8000-0000000000b1',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '44444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333333',
    'nudge',
    'Time to log.'
  );

insert into public.invites (id, org_id, created_by, created_at, expires_at) values
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    now(),
    now() + interval '7 days'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    now() - interval '8 days',
    now() - interval '1 day'
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '33333333-3333-3333-3333-333333333333',
    now(),
    now() + interval '7 days'
  );

do $$
begin
  insert into public.invites (org_id, created_by, expires_at)
  values (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    now() + interval '8 days'
  );
  raise exception 'FAIL invite longer than 7 days was inserted';
exception
  when check_violation then
    raise notice 'PASS invite cannot last longer than 7 days';
end
$$;

create or replace function public._rls_expect(label text, ok boolean)
returns void
language plpgsql
security invoker
as $$
begin
  if ok is not true then
    raise exception 'FAIL %', label;
  end if;
  raise notice 'PASS %', label;
end;
$$;

create or replace function public._rls_expect_error(label text, sql text, needle text)
returns void
language plpgsql
security invoker
as $$
declare
  failed boolean := false;
  caught text := '';
begin
  begin
    execute sql;
  exception
    when others then
      failed := true;
      caught := sqlerrm;
  end;
  if not failed then
    raise exception 'FAIL % (no error)', label;
  end if;
  if position(needle in caught) = 0 then
    raise exception 'FAIL % (%)', label, caught;
  end if;
  raise notice 'PASS %', label;
end;
$$;

revoke all on function public._rls_expect(text, boolean) from public;
revoke all on function public._rls_expect_error(text, text, text) from public;
grant execute on function public._rls_expect(text, boolean) to anon, authenticated;
grant execute on function public._rls_expect_error(text, text, text) to anon, authenticated;

-- Trainer A: own org only.
begin;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public._rls_expect(
  'trainer A sees 1 org',
  (select count(*) = 1 from public.orgs)
);
select public._rls_expect(
  'trainer A sees Rivera Strength',
  (select name = 'Rivera Strength' from public.orgs)
);
select public._rls_expect(
  'trainer A cannot read org B',
  (select count(*) = 0 from public.orgs where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
);
select public._rls_expect(
  'trainer A sees own membership and client A only',
  (select count(*) = 2 from public.memberships)
);
select public._rls_expect(
  'trainer A cannot read org B memberships',
  (select count(*) = 0 from public.memberships where org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
);
select public._rls_expect(
  'trainer A sees own profile and client A only',
  (
    select count(*) = 2
      and bool_and(id in (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222'
      ))
    from public.profiles
  )
);
select public._rls_expect(
  'trainer A can read client A profile',
  (select display_name = 'Sam Lee' from public.profiles where id = '22222222-2222-2222-2222-222222222222')
);
select public._rls_expect(
  'trainer A cannot read client B profile',
  (select count(*) = 0 from public.profiles where id = '44444444-4444-4444-4444-444444444444')
);
select public._rls_expect(
  'trainer A sees only org A invites',
  (
    select count(*) = 2
      and count(*) filter (where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') = 0
    from public.invites
  )
);
with inserted as (
  insert into public.invites (org_id, created_by)
  values (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111'
  )
  returning 1
)
select public._rls_expect(
  'trainer A can create an invite in org A',
  (select count(*) = 1 from inserted)
);
select public._rls_expect_error(
  'trainer A cannot invite into org B',
  $$insert into public.invites (org_id, created_by) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111')$$,
  'row-level security'
);
rollback;

select public._rls_expect(
  'client B display name is unchanged',
  (
    select display_name = 'Riley Wong'
    from public.profiles
    where id = '44444444-4444-4444-4444-444444444444'
  )
);

begin;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
with updated as (
  update public.profiles
  set display_name = 'Hacked'
  where id = '44444444-4444-4444-4444-444444444444'
  returning 1
)
select public._rls_expect(
  'trainer A update of client B changes 0 rows',
  (select count(*) = 0 from updated)
);
rollback;

-- Trainer B is the mirror, so a filter hardcoded to org A cannot pass.
begin;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select public._rls_expect(
  'trainer B sees Quinn Athletic only',
  (select count(*) = 1 and bool_and(name = 'Quinn Athletic') from public.orgs)
);
select public._rls_expect(
  'trainer B cannot read org A',
  (select count(*) = 0 from public.orgs where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
);
select public._rls_expect(
  'trainer B sees own profile and client B only',
  (
    select count(*) = 2
      and bool_and(id in (
        '33333333-3333-3333-3333-333333333333',
        '44444444-4444-4444-4444-444444444444'
      ))
    from public.profiles
  )
);
select public._rls_expect(
  'trainer B cannot read client A profile',
  (select count(*) = 0 from public.profiles where id = '22222222-2222-2222-2222-222222222222')
);
rollback;

-- Client A: own rows plus the trainer, never client B.
begin;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select public._rls_expect(
  'client A sees 1 org',
  (select count(*) = 1 and bool_and(id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') from public.orgs)
);
select public._rls_expect(
  'client A cannot read org B',
  (select count(*) = 0 from public.orgs where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
);
select public._rls_expect(
  'client A sees only their membership',
  (select count(*) = 1 and bool_and(user_id = '22222222-2222-2222-2222-222222222222') from public.memberships)
);
select public._rls_expect(
  'client A sees own profile and the trainer only',
  (
    select count(*) = 2
      and bool_and(id in (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222'
      ))
    from public.profiles
  )
);
select public._rls_expect(
  'client A cannot read client B profile',
  (select count(*) = 0 from public.profiles where id = '44444444-4444-4444-4444-444444444444')
);
select public._rls_expect(
  'client A cannot read trainer B profile',
  (select count(*) = 0 from public.profiles where id = '33333333-3333-3333-3333-333333333333')
);
select public._rls_expect(
  'client A sees no invites',
  (select count(*) = 0 from public.invites)
);
with updated as (
  update public.profiles
  set timezone = 'Europe/London'
  where id = '22222222-2222-2222-2222-222222222222'
  returning timezone
)
select public._rls_expect(
  'client A can update own timezone',
  (select timezone = 'Europe/London' from updated)
);
with blocked as (
  update public.profiles
  set display_name = 'Hacked'
  where id = '44444444-4444-4444-4444-444444444444'
  returning 1
)
select public._rls_expect(
  'client A cannot update client B profile',
  (select count(*) = 0 from blocked)
);
select public._rls_expect_error(
  'client A cannot create an invite',
  $$insert into public.invites (org_id, created_by) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222')$$,
  'row-level security'
);
select public._rls_expect_error(
  'client A cannot accept an invite for another org',
  $$select public.accept_invite('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Sam Lee', 'America/Chicago')$$,
  'another org'
);
rollback;

-- Client B mirror.
begin;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
set local role authenticated;
select public._rls_expect(
  'client B sees own profile and trainer B only',
  (
    select count(*) = 2
      and bool_and(id in (
        '33333333-3333-3333-3333-333333333333',
        '44444444-4444-4444-4444-444444444444'
      ))
    from public.profiles
  )
);
select public._rls_expect(
  'client B cannot read client A profile',
  (select count(*) = 0 from public.profiles where id = '22222222-2222-2222-2222-222222222222')
);
rollback;

-- Anon can preview one invite and cannot read tables.
begin;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select public._rls_expect(
  'anon preview of an active invite returns the coach and org',
  (
    select org_name = 'Rivera Strength'
      and trainer_name = 'Alex Rivera'
      and status = 'active'
    from public.invite_preview('cccccccc-cccc-cccc-cccc-cccccccccccc')
  )
);
select public._rls_expect(
  'anon preview of an expired invite is expired',
  (select status = 'expired' from public.invite_preview('dddddddd-dddd-dddd-dddd-dddddddddddd'))
);
select public._rls_expect(
  'anon preview of an unknown invite is missing',
  (select status = 'missing' from public.invite_preview('00000000-0000-0000-0000-000000000000'))
);
select public._rls_expect_error(
  'anon cannot read orgs',
  'select count(*) from public.orgs',
  'permission denied'
);
select public._rls_expect_error(
  'anon cannot read profiles',
  'select count(*) from public.profiles',
  'permission denied'
);
select public._rls_expect_error(
  'anon cannot read invites',
  'select count(*) from public.invites',
  'permission denied'
);
rollback;

-- Expired invite, signup function, and a real accept.
begin;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true);
set local role authenticated;
select public._rls_expect_error(
  'expired invite is rejected',
  $$select public.accept_invite('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Late Client', 'UTC')$$,
  'expired'
);
rollback;

begin;
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', true);
set local role authenticated;
select public._rls_expect(
  'create_trainer_org returns an org',
  (select public.create_trainer_org('Casey Coach', 'Casey Gym', 'America/Chicago') is not null)
);
select public._rls_expect(
  'new trainer sees only the org they created',
  (select count(*) = 1 and bool_and(name = 'Casey Gym') from public.orgs)
);
select public._rls_expect(
  'new trainer cannot read Rivera Strength',
  (select count(*) = 0 from public.orgs where name = 'Rivera Strength')
);
select public._rls_expect(
  'new trainer membership is trainer',
  (select role = 'trainer' from public.memberships)
);
rollback;

begin;
select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', true);
set local role authenticated;
select public._rls_expect(
  'accept_invite returns org A',
  (
    select public.accept_invite(
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'New Client',
      'America/Chicago'
    ) = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  )
);
select public._rls_expect(
  'accepted user is a client of org A only',
  (
    select count(*) = 1
      and bool_and(role = 'client')
      and bool_and(org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    from public.memberships
  )
);
select public._rls_expect(
  'accepted client cannot read org B',
  (select count(*) = 0 from public.orgs where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
);
select public._rls_expect(
  'accepted client cannot read client A profile',
  (select count(*) = 0 from public.profiles where id = '22222222-2222-2222-2222-222222222222')
);
select public._rls_expect(
  'accepted client can read the trainer profile',
  (select display_name = 'Alex Rivera' from public.profiles where id = '11111111-1111-1111-1111-111111111111')
);
rollback;

select public._rls_expect(
  'client B display name stayed Riley Wong',
  (
    select display_name = 'Riley Wong'
    from public.profiles
    where id = '44444444-4444-4444-4444-444444444444'
  )
);

-- Ticket 2: programs, logs, and nudges stay inside the org.
select public._rls_expect(
  'weight unit defaults to lb',
  (
    select weight_unit = 'lb'
    from public.profiles
    where id = '22222222-2222-2222-2222-222222222222'
  )
);

begin;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select public._rls_expect(
  'client A sees only their active program',
  (
    select count(*) = 1
      and bool_and(name = 'Foundation')
    from public.programs
  )
);
select public._rls_expect(
  'client A cannot read client B program',
  (select count(*) = 0 from public.programs where name = 'Quinn Plan')
);
select public._rls_expect(
  'client A sees only their exercise',
  (select count(*) = 1 and bool_and(name = 'Back squat') from public.program_exercises)
);
select public._rls_expect(
  'client A cannot read client B nudges',
  (select count(*) = 0 from public.nudge_events)
);
select public._rls_expect(
  'client A cannot read client B sets',
  (select count(*) = 0 from public.set_logs where client_id = '44444444-4444-4444-4444-444444444444')
);
select public._rls_expect_error(
  'client A cannot insert a program directly',
  $$insert into public.programs (org_id, client_id, name, start_date, created_by) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'Nope', current_date, '22222222-2222-2222-2222-222222222222')$$,
  'permission denied'
);
select public._rls_expect_error(
  'client A cannot log client B exercise',
  $$select public.apply_client_log(jsonb_build_object(
    'clientKey', '10000000-0000-4000-8000-0000000000c1',
    'kind', 'save_sets',
    'exerciseId', '10000000-0000-4000-8000-000000000013',
    'scheduledOn', to_char(current_date, 'YYYY-MM-DD'),
    'markDone', false,
    'note', '',
    'sets', jsonb_build_array(jsonb_build_object('index', 1, 'weightKg', 20, 'reps', 5))
  ))$$,
  'not on your program'
);
select public.apply_client_log(jsonb_build_object(
  'clientKey', '10000000-0000-4000-8000-0000000000aa',
  'kind', 'save_sets',
  'exerciseId', '10000000-0000-4000-8000-000000000003',
  'scheduledOn', to_char(current_date, 'YYYY-MM-DD'),
  'markDone', false,
  'note', '',
  'sets', jsonb_build_array(jsonb_build_object('index', 1, 'weightKg', 61.235, 'reps', 5))
));
select public.apply_client_log(jsonb_build_object(
  'clientKey', '10000000-0000-4000-8000-0000000000aa',
  'kind', 'save_sets',
  'exerciseId', '10000000-0000-4000-8000-000000000003',
  'scheduledOn', to_char(current_date, 'YYYY-MM-DD'),
  'markDone', false,
  'note', '',
  'sets', jsonb_build_array(jsonb_build_object('index', 1, 'weightKg', 61.235, 'reps', 5))
));
select public._rls_expect(
  'replaying a log flushes once',
  (
    select count(*) = 1
    from public.set_logs
    where exercise_log_id in (
      select id
      from public.exercise_logs
      where client_id = '22222222-2222-2222-2222-222222222222'
        and scheduled_on = current_date
    )
  )
);
select public._rls_expect(
  'the same client key is stored once',
  (
    select count(*) = 1
    from public.log_operations
    where client_key = '10000000-0000-4000-8000-0000000000aa'
  )
);
with updated as (
  update public.profiles
  set weight_unit = 'kg'
  where id = '22222222-2222-2222-2222-222222222222'
  returning weight_unit
)
select public._rls_expect(
  'client A can set their own unit to kg',
  (select weight_unit = 'kg' from updated)
);
with blocked as (
  update public.profiles
  set weight_unit = 'kg'
  where id = '44444444-4444-4444-4444-444444444444'
  returning 1
)
select public._rls_expect(
  'client A cannot change client B unit',
  (select count(*) = 0 from blocked)
);
rollback;

begin;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
set local role authenticated;
select public._rls_expect(
  'client B cannot read client A sets',
  (
    select count(*) = 1
      and bool_and(client_id = '44444444-4444-4444-4444-444444444444')
    from public.set_logs
  )
);
select public._rls_expect(
  'client B sees their own nudge',
  (select count(*) = 1 and bool_and(body = 'Time to log.') from public.nudge_events)
);
select public._rls_expect(
  'client B cannot read client A program days',
  (select count(*) = 0 from public.program_days where name = 'Lower A')
);
rollback;

begin;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public._rls_expect(
  'trainer A sees only org A programs',
  (
    select count(*) = 1
      and bool_and(name = 'Foundation')
    from public.programs
  )
);
select public._rls_expect(
  'trainer A cannot read org B exercises',
  (select count(*) = 0 from public.program_exercises where name = 'Bench press')
);
select public._rls_expect_error(
  'trainer A cannot nudge a client in org B',
  $$select public.send_nudge('44444444-4444-4444-4444-444444444444', 'nudge', 'Log today.')$$,
  'not on your roster'
);
select public._rls_expect(
  'trainer A can record a nudge for client A',
  (
    select public.send_nudge(
      '22222222-2222-2222-2222-222222222222',
      'nudge',
      'Alex sent a nudge. Open today and log your sets.'
    ) is not null
  )
);
select public._rls_expect(
  'trainer A sees the nudge they sent',
  (select count(*) = 1 from public.nudge_events where client_id = '22222222-2222-2222-2222-222222222222')
);
select public._rls_expect(
  'a nudge posts the templated coach chat message',
  (
    select count(*) = 1
      and bool_and(kind = 'human')
      and bool_and(body = 'Alex sent a nudge. Open today and log your sets.')
    from public.messages
    where sender_id = '11111111-1111-1111-1111-111111111111'
  )
);
select public._rls_expect(
  'assign replaces the active program',
  (
    select public.assign_program(jsonb_build_object(
      'clientId', '22222222-2222-2222-2222-222222222222',
      'name', 'Replacement',
      'startDate', to_char(current_date, 'YYYY-MM-DD'),
      'days', jsonb_build_array(jsonb_build_object(
        'name', 'Day 1',
        'rest', false,
        'exercises', jsonb_build_array(jsonb_build_object(
          'name', 'Row',
          'sets', 3,
          'reps', '8',
          'notes', '',
          'videoUrl', ''
        ))
      ))
    )) is not null
  )
);
select public._rls_expect(
  'trainer A sees one active program after assign',
  (
    select count(*) filter (where status = 'active') = 1
      and count(*) filter (where status = 'replaced') = 1
    from public.programs
    where client_id = '22222222-2222-2222-2222-222222222222'
  )
);
rollback;

begin;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select public._rls_expect(
  'trainer B cannot read org A programs',
  (select count(*) = 0 from public.programs where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
);
rollback;

begin;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select public._rls_expect_error(
  'anon cannot read programs',
  'select count(*) from public.programs',
  'permission denied'
);
select public._rls_expect_error(
  'anon cannot read nudges',
  'select count(*) from public.nudge_events',
  'permission denied'
);
rollback;

\echo ALL CROSS TENANT CHECKS PASSED
