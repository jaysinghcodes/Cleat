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

\echo ALL CROSS TENANT CHECKS PASSED
