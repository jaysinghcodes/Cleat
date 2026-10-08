-- Cross tenant proof for Ticket 4.
-- Depends on the users and orgs inserted by cross_tenant_rls.sql.

\pset pager off
\echo ---- Cleat RAG and audit RLS ----

insert into public.kb_articles (id, org_id, title, category, body, created_by) values
  (
    'a1000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Rest days',
    'faq',
    'Rest on Wednesday and Sunday.',
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Quinn notes',
    'rules',
    'Other org notes stay in that org.',
    '33333333-3333-3333-3333-333333333333'
  );

insert into public.programs (id, org_id, client_id, name, start_date, status, created_by) values
  (
    '10000000-0000-4000-8000-000000000021',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '55555555-5555-5555-5555-555555555555',
    'Other client',
    current_date,
    'active',
    '11111111-1111-1111-1111-111111111111'
  );

insert into public.chunks (
  id, org_id, client_id, source, article_id, program_id, position, snippet, embedding, model
) values
  (
    'c1000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    null,
    'kb',
    'a1000000-0000-4000-8000-000000000001',
    null,
    0,
    'Rest on Wednesday and Sunday.',
    array_fill(1::float4, array[1536])::vector(1536),
    'text-embedding-3-small'
  ),
  (
    'c1000000-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'program',
    null,
    '10000000-0000-4000-8000-000000000001',
    0,
    'Client C back squat.',
    array_fill(1::float4, array[1536])::vector(1536),
    'text-embedding-3-small'
  ),
  (
    'c1000000-0000-4000-8000-000000000003',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '55555555-5555-5555-5555-555555555555',
    'program',
    null,
    '10000000-0000-4000-8000-000000000021',
    0,
    'Other client in org A.',
    array_fill(1::float4, array[1536])::vector(1536),
    'text-embedding-3-small'
  ),
  (
    'c1000000-0000-4000-8000-000000000004',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    null,
    'kb',
    'a1000000-0000-4000-8000-000000000002',
    null,
    0,
    'Other org knowledge.',
    array_fill(1::float4, array[1536])::vector(1536),
    'text-embedding-3-small'
  ),
  (
    'c1000000-0000-4000-8000-000000000005',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '44444444-4444-4444-4444-444444444444',
    'program',
    null,
    '10000000-0000-4000-8000-000000000011',
    0,
    'Client B program.',
    array_fill(1::float4, array[1536])::vector(1536),
    'text-embedding-3-small'
  );

insert into public.messages (id, thread_id, org_id, sender_id, body) values
  (
    'f1000000-0000-4000-8000-000000000001',
    'aaaa1111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'How many rest days are in the program?'
  );

insert into public.audit_events (
  id, org_id, client_id, message_id, chunks, draft_text, confidence, threshold,
  reason_codes, decision, template_id, delivered_at, trainer_edit, trainer_action,
  final_text, model, prompt_version
) values (
  'e1000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '22222222-2222-2222-2222-222222222222',
  'f1000000-0000-4000-8000-000000000001',
  '[{"id":"c1000000-0000-4000-8000-000000000001","snippet":"Rest on Wednesday and Sunday.","score":0.9}]'::jsonb,
  'Rest on Wednesday and Sunday.',
  0.91,
  0.85,
  array['ambiguous'],
  'auto_send',
  null,
  now(),
  null,
  null,
  'Rest on Wednesday and Sunday.',
  'cleat-canned-scorer',
  '4-rag-v1'
);

insert into public.inbox_items (
  id, org_id, client_id, audit_id, message_id, priority, emergency, reason_codes, title, status
) values (
  'a2000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '22222222-2222-2222-2222-222222222222',
  'e1000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'p0',
  true,
  array['emergency'],
  'Emergency',
  'open'
);

insert into public.held_drafts (
  id, org_id, client_id, thread_id, message_id, audit_id, inbox_item_id, draft_text, status
) values (
  'a4000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '22222222-2222-2222-2222-222222222222',
  'aaaa1111-1111-1111-1111-111111111111',
  'f1000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'Rest on Wednesday and Sunday.',
  'held'
);

insert into public.trainer_notices (id, org_id, client_id, inbox_item_id, title, body, emergency) values (
  'a3000000-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '22222222-2222-2222-2222-222222222222',
  'a2000000-0000-4000-8000-000000000001',
  'Emergency',
  'A client message needs you now. The safety reply was sent.',
  true
);

select public._rls_expect(
  'a new org starts with auto send off and threshold 0.85',
  (
    select auto_send = false and threshold = 0.85
    from public.ai_settings
    where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  )
);

select public._rls_expect(
  'there is no second threshold and no floor column',
  (
    select count(*) = 0
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_settings'
      and column_name in ('floor', 'low_threshold', 'medium_threshold', 'auto_send_threshold')
  )
);

select public._rls_expect(
  'chunks are vector(1536)',
  (
    select atttypmod = 1536
    from pg_attribute
    where attrelid = 'public.chunks'::regclass
      and attname = 'embedding'
  )
);

select public._rls_expect(
  'match_chunks for client C skips the other client and the other org',
  (
    select count(*) = 2
      and bool_and(id in (
        'c1000000-0000-4000-8000-000000000001',
        'c1000000-0000-4000-8000-000000000002'
      ))
    from public.match_chunks(
      array_fill(1::float4, array[1536])::vector(1536),
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '22222222-2222-2222-2222-222222222222',
      10
    )
  )
);

begin;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select public._rls_expect(
  'trainer A sees only org A articles',
  (
    select count(*) = 1 and bool_and(title = 'Rest days')
    from public.kb_articles
  )
);
select public._rls_expect(
  'trainer A sees org A chunks including both clients',
  (select count(*) = 3 from public.chunks)
);
select public._rls_expect(
  'trainer A sees the audit row',
  (select count(*) = 1 from public.audit_events)
);
select public._rls_expect(
  'trainer A sees the inbox item and its emergency flag',
  (select count(*) = 1 and bool_and(emergency) from public.inbox_items)
);
select public._rls_expect(
  'trainer A sees the held draft',
  (select count(*) = 1 from public.held_drafts)
);
select public._rls_expect(
  'trainer A sees the in app notice',
  (select count(*) = 1 from public.trainer_notices)
);
update public.ai_settings
set threshold = 0.60
where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select public._rls_expect(
  'trainer A can set the threshold to 0.60',
  (
    select threshold = 0.60
    from public.ai_settings
    where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  )
);
update public.ai_settings
set threshold = 0.95
where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select public._rls_expect(
  'trainer A can set the threshold to 0.95',
  (
    select threshold = 0.95
    from public.ai_settings
    where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  )
);
select public._rls_expect_error(
  'trainer A cannot set the threshold to the floor 0.50',
  $$update public.ai_settings set threshold = 0.50 where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'check'
);
select public._rls_expect_error(
  'trainer A cannot set the threshold above 0.95',
  $$update public.ai_settings set threshold = 0.96 where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'check'
);
rollback;

begin;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select public._rls_expect(
  'trainer B cannot read org A articles',
  (select count(*) = 0 from public.kb_articles where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
);
select public._rls_expect(
  'trainer B cannot read org A chunks',
  (select count(*) = 0 from public.chunks where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
);
select public._rls_expect(
  'trainer B cannot read org A audits',
  (select count(*) = 0 from public.audit_events where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
);
select public._rls_expect(
  'trainer B cannot read org A drafts',
  (select count(*) = 0 from public.held_drafts where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
);
select public._rls_expect(
  'trainer B cannot read org A notices',
  (select count(*) = 0 from public.trainer_notices where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
);
rollback;

begin;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;
select public._rls_expect(
  'client C cannot read knowledge articles',
  (select count(*) = 0 from public.kb_articles)
);
select public._rls_expect(
  'client C sees org KB and their own program chunks only',
  (
    select count(*) = 2
      and bool_and(id in (
        'c1000000-0000-4000-8000-000000000001',
        'c1000000-0000-4000-8000-000000000002'
      ))
    from public.chunks
  )
);
select public._rls_expect(
  'client C cannot read audit rows',
  (select count(*) = 0 from public.audit_events)
);
select public._rls_expect(
  'client C cannot read held drafts',
  (select count(*) = 0 from public.held_drafts)
);
select public._rls_expect(
  'client C cannot read inbox items',
  (select count(*) = 0 from public.inbox_items)
);
select public._rls_expect(
  'client C cannot read trainer notices',
  (select count(*) = 0 from public.trainer_notices)
);
do $$
declare
  changed integer;
begin
  update public.ai_settings
  set auto_send = true
  where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  get diagnostics changed = row_count;
  if changed <> 0 then
    raise exception 'client C changed auto send';
  end if;
  raise notice 'PASS client C cannot change auto send';
end
$$;
rollback;

begin;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
set local role authenticated;
select public._rls_expect(
  'client B cannot read org A program chunks',
  (select count(*) = 0 from public.chunks where snippet = 'Client C back squat.')
);
rollback;

begin;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select public._rls_expect_error(
  'anon cannot read chunks',
  'select count(*) from public.chunks',
  'permission denied'
);
select public._rls_expect_error(
  'anon cannot read audits',
  'select count(*) from public.audit_events',
  'permission denied'
);
rollback;

begin;
insert into public.orgs (id, name, created_by) values
  (
    'd1000000-0000-4000-8000-000000000001',
    'Rivera Strength Demo',
    '11111111-1111-1111-1111-111111111111'
  );
select public._rls_expect(
  'demo org starts off before the seed helper',
  (
    select auto_send = false
    from public.ai_settings
    where org_id = 'd1000000-0000-4000-8000-000000000001'
  )
);
select public.enable_demo_auto_send();
select public._rls_expect(
  'demo seed org has auto send on',
  (
    select auto_send = true
    from public.ai_settings
    where org_id = 'd1000000-0000-4000-8000-000000000001'
  )
);
select public._rls_expect(
  'the helper does not turn other orgs on',
  (
    select auto_send = false
    from public.ai_settings
    where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  )
);
rollback;

begin;
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', true);
set local role authenticated;
create temp table created_org (id uuid);
insert into created_org
select public.create_trainer_org('New Coach', 'New Gym', 'UTC');
select public._rls_expect(
  'create trainer org leaves auto send off',
  (
    select s.auto_send = false and s.threshold = 0.85
    from created_org c
    join public.ai_settings s on s.org_id = c.id
  )
);
rollback;

\echo ALL RAG CHECKS PASSED
