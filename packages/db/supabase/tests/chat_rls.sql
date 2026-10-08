-- Cross tenant proof for Ticket 3 threads, messages, and push tokens.
-- Seed runs as the table owner. Assertions run as anon or authenticated.

\pset pager off
\echo ---- Cleat chat RLS ----

insert into public.threads (id, org_id, client_id) values
  (
    'aaaa1111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222'
  ),
  (
    'bbbb1111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '44444444-4444-4444-4444-444444444444'
  );

insert into public.messages (id, thread_id, org_id, sender_id, body) values
  (
    'aaaa2222-2222-2222-2222-222222222222',
    'aaaa1111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'Starting lunges'
  ),
  (
    'bbbb2222-2222-2222-2222-222222222222',
    'bbbb1111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '44444444-4444-4444-4444-444444444444',
    'Org B secret'
  );

insert into public.push_tokens (id, user_id, org_id, device_id, token, platform) values
  (
    'aaaa3333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'device-a',
    'token-a',
    'ios'
  ),
  (
    'bbbb3333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'device-b',
    'token-b',
    'android'
  );

-- Trainer A sees org A chat only.
begin;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public._rls_expect(
  'trainer A sees only the org A thread',
  (
    select count(*) = 1
      and bool_and(id = 'aaaa1111-1111-1111-1111-111111111111')
    from public.threads
  )
);
select public._rls_expect(
  'trainer A sees the org A message only',
  (
    select count(*) = 1
      and bool_and(body = 'Starting lunges')
    from public.messages
  )
);
select public._rls_expect(
  'trainer A cannot read org B messages',
  (select count(*) = 0 from public.messages where body = 'Org B secret')
);
select public._rls_expect(
  'trainer A cannot read push tokens',
  (select count(*) = 0 from public.push_tokens)
);
select public._rls_expect(
  'trainer A thread preview is the org A message',
  (
    select count(*) = 1
      and bool_and(last_body = 'Starting lunges')
    from public.thread_previews()
  )
);
rollback;

-- Trainer B is the mirror.
begin;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select public._rls_expect(
  'trainer B sees only the org B thread',
  (
    select count(*) = 1
      and bool_and(id = 'bbbb1111-1111-1111-1111-111111111111')
    from public.threads
  )
);
select public._rls_expect(
  'trainer B cannot read org A messages',
  (select count(*) = 0 from public.messages where body = 'Starting lunges')
);
select public._rls_expect(
  'trainer B cannot read push tokens',
  (select count(*) = 0 from public.push_tokens)
);
rollback;

-- Client A sees their thread only, and only their own push token.
begin;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select public._rls_expect(
  'client A sees only their thread',
  (
    select count(*) = 1
      and bool_and(client_id = '22222222-2222-2222-2222-222222222222')
    from public.threads
  )
);
select public._rls_expect(
  'client A sees only their message',
  (
    select count(*) = 1
      and bool_and(body = 'Starting lunges')
    from public.messages
  )
);
select public._rls_expect(
  'client A cannot read client B messages',
  (select count(*) = 0 from public.messages where body = 'Org B secret')
);
select public._rls_expect(
  'client A reads only their push token',
  (
    select count(*) = 1
      and bool_and(token = 'token-a')
    from public.push_tokens
  )
);
select public._rls_expect(
  'client A cannot read client B push token',
  (select count(*) = 0 from public.push_tokens where token = 'token-b')
);
with inserted as (
  insert into public.push_tokens (user_id, org_id, device_id, token, platform)
  values (
    '22222222-2222-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'phone-1',
    'token-phone',
    'android'
  )
  returning 1
)
select public._rls_expect(
  'client A can store their own push token',
  (select count(*) = 1 from inserted)
);
select public._rls_expect_error(
  'client A cannot store a token for client B',
  $$insert into public.push_tokens (user_id, org_id, device_id, token, platform)
    values (
      '44444444-4444-4444-4444-444444444444',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'stolen',
      'nope',
      'ios'
    )$$,
  'row-level security'
);
select public._rls_expect_error(
  'client A cannot insert a message directly',
  $$insert into public.messages (thread_id, org_id, sender_id, body)
    values (
      'aaaa1111-1111-1111-1111-111111111111',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '22222222-2222-2222-2222-222222222222',
      'direct'
    )$$,
  'permission denied'
);
select public._rls_expect(
  'client A can post a message in their thread',
  (
    select posted_body = 'Hello coach'
    from public.post_message('22222222-2222-2222-2222-222222222222', 'Hello coach')
  )
);
select public._rls_expect_error(
  'client A cannot post into client B thread',
  $$select public.post_message('44444444-4444-4444-4444-444444444444', 'Hi')$$,
  'your coach'
);
rollback;

-- Client B cannot see client A.
begin;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
set local role authenticated;
select public._rls_expect(
  'client B cannot read client A thread',
  (select count(*) = 0 from public.threads where id = 'aaaa1111-1111-1111-1111-111111111111')
);
select public._rls_expect(
  'client B cannot read client A messages',
  (select count(*) = 0 from public.messages where body = 'Starting lunges')
);
select public._rls_expect(
  'client B cannot read client A push token',
  (select count(*) = 0 from public.push_tokens where token = 'token-a')
);
rollback;

-- Trainer A can reply to their client and cannot reach org B.
begin;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public._rls_expect(
  'trainer A can post to client A',
  (
    select posted_body = 'Keep the torso tall'
    from public.post_message('22222222-2222-2222-2222-222222222222', 'Keep the torso tall')
  )
);
select public._rls_expect_error(
  'trainer A cannot post to client B',
  $$select public.post_message('44444444-4444-4444-4444-444444444444', 'Hi')$$,
  'not on your roster'
);
select public._rls_expect_error(
  'trainer A cannot ensure a thread for client B',
  $$select public.ensure_thread('44444444-4444-4444-4444-444444444444')$$,
  'not on your roster'
);
rollback;

-- Anon has no chat access.
begin;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select public._rls_expect_error(
  'anon cannot read threads',
  'select count(*) from public.threads',
  'permission denied'
);
select public._rls_expect_error(
  'anon cannot read messages',
  'select count(*) from public.messages',
  'permission denied'
);
select public._rls_expect_error(
  'anon cannot read push tokens',
  'select count(*) from public.push_tokens',
  'permission denied'
);
select public._rls_expect_error(
  'anon cannot post a message',
  $$select public.post_message('22222222-2222-2222-2222-222222222222', 'Hi')$$,
  'permission denied'
);
rollback;

-- The seeded org B secret is still there after the rollbacks above.
select public._rls_expect(
  'org B secret message stayed stored',
  (select body = 'Org B secret' from public.messages where id = 'bbbb2222-2222-2222-2222-222222222222')
);

\echo ALL CHAT RLS CHECKS PASSED
