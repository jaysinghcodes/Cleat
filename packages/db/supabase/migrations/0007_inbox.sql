-- Cleat 0007_inbox
-- Ticket 5: priority inbox tiers P0 to P3, org unanswered window, seed hook.
-- P2 and P3 are derived at read time. This migration does not schedule cron.
-- Push delivery stays deferred. A nudge still writes nudge_events and now also
-- posts the same templated body into the client thread as a coach message.

alter table public.orgs
  add column unanswered_hours integer not null default 4;

alter table public.orgs
  add constraint orgs_unanswered_hours_check check (unanswered_hours between 1 and 168);

comment on column public.orgs.unanswered_hours is
  'Hours before an unanswered client message is a P2 inbox item. Default 4.';

alter table public.inbox_items drop constraint inbox_items_priority_check;
alter table public.inbox_items
  add constraint inbox_items_priority_check check (priority in ('p0', 'p1', 'p2', 'p3'));

alter table public.inbox_items alter column audit_id drop not null;
alter table public.inbox_items alter column message_id drop not null;

alter table public.inbox_items
  add column preview text not null default '',
  add column template_id text;

alter table public.inbox_items
  add constraint inbox_items_preview_length check (char_length(preview) <= 500);

alter table public.inbox_items
  add constraint inbox_items_template_check check (
    template_id is null or template_id in ('emergency', 'emergency_self_harm', 'medical_safety')
  );

drop index if exists public.inbox_items_org_sort_idx;
create index inbox_items_org_open_idx
  on public.inbox_items (org_id, status, emergency desc, priority, created_at);

create unique index inbox_items_open_message_idx
  on public.inbox_items (message_id)
  where status = 'open' and message_id is not null;

create unique index inbox_items_open_p3_client_idx
  on public.inbox_items (org_id, client_id)
  where status = 'open' and priority = 'p3';

-- Latest message per thread. Security invoker so RLS still hides other orgs.
create or replace function public.thread_heads()
returns table (
  thread_id uuid,
  client_id uuid,
  message_id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (t.id)
    t.id,
    t.client_id,
    m.id,
    m.sender_id,
    m.body,
    m.created_at
  from public.threads t
  join public.messages m on m.thread_id = t.id
  order by t.id, m.created_at desc;
$$;

create or replace function public.send_nudge(
  target_client uuid,
  nudge_kind text,
  body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  trainer_org uuid;
  clean_body text;
  new_id uuid;
  thread uuid;
begin
  if uid is null then
    raise exception 'Sign in before sending a nudge.';
  end if;

  select m.org_id into trainer_org
  from public.memberships m
  where m.user_id = uid
    and m.role = 'trainer';

  if trainer_org is null then
    raise exception 'Only a coach can send a nudge.';
  end if;

  if nudge_kind not in ('soft', 'nudge') then
    raise exception 'Choose a nudge type.';
  end if;

  clean_body := btrim(coalesce(body, ''));
  if char_length(clean_body) < 1 or char_length(clean_body) > 200 then
    raise exception 'Enter a nudge message.';
  end if;

  if not exists (
    select 1
    from public.memberships m
    where m.user_id = target_client
      and m.org_id = trainer_org
      and m.role = 'client'
  ) then
    raise exception 'That client is not on your roster.';
  end if;

  insert into public.nudge_events (org_id, client_id, trainer_id, kind, body, push_status)
  values (trainer_org, target_client, uid, nudge_kind, clean_body, 'deferred')
  returning id into new_id;

  thread := public.ensure_thread(target_client);
  insert into public.messages (thread_id, org_id, sender_id, body, kind)
  values (thread, trainer_org, uid, clean_body, 'human');

  return new_id;
end;
$$;

create or replace function public.resolve_inbox_item(
  item_id uuid,
  action text,
  reply_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  item public.inbox_items%rowtype;
  clean text;
  thread uuid;
begin
  if uid is null or not public.is_trainer_of(coalesce((
    select org_id from public.inbox_items where id = item_id
  ), '00000000-0000-0000-0000-000000000000')) then
    raise exception 'Sign in before replying.';
  end if;

  select * into item
  from public.inbox_items
  where id = item_id
    and status = 'open';

  if item.id is null then
    raise exception 'That inbox item is not open.';
  end if;

  if item.priority = 'p1' then
    raise exception 'Use the draft actions for this item.';
  end if;

  if action = 'dismiss' then
    update public.inbox_items
    set status = 'dismissed'
    where id = item.id;

    if item.audit_id is not null then
      update public.audit_events
      set trainer_action = 'dismiss',
          trainer_edit = false,
          trainer_acted_at = now()
      where id = item.audit_id
        and org_id = item.org_id;
    end if;
    return;
  end if;

  if action <> 'reply' then
    raise exception 'Choose reply or dismiss.';
  end if;

  clean := btrim(coalesce(reply_body, ''));
  if char_length(clean) < 1 then
    raise exception 'Write a reply first.';
  end if;
  if char_length(clean) > 4000 then
    raise exception 'Keep the message under 4000 characters.';
  end if;

  thread := public.ensure_thread(item.client_id);
  insert into public.messages (thread_id, org_id, sender_id, body, kind)
  values (thread, item.org_id, uid, clean, 'human');

  update public.inbox_items
  set status = 'sent'
  where id = item.id;
end;
$$;

-- Ticket 7 calls this to insert one open item of a tier.
-- Tiers: p0, p0_injury, p0_emergency, p0_self_harm, p1, p2, p3.
-- Not granted to authenticated. The service role and the migration owner can run it.
create or replace function public.seed_inbox_tier(
  target_org uuid,
  target_client uuid,
  tier text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing uuid;
  thread uuid;
  message uuid;
  audit uuid;
  item uuid;
  trainer uuid;
  emergency boolean := false;
  priority text;
  codes text[];
  title text;
  preview text;
  template text;
  draft text;
  decision text;
  confidence double precision := 0.2;
  template_body text;
  message_body text;
  item_at timestamptz := now();
begin
  if tier not in ('p0', 'p0_injury', 'p0_emergency', 'p0_self_harm', 'p1', 'p2', 'p3') then
    raise exception 'Choose an inbox tier.';
  end if;

  if not exists (
    select 1
    from public.memberships m
    where m.org_id = target_org
      and m.user_id = target_client
      and m.role = 'client'
  ) then
    raise exception 'That client is not on your roster.';
  end if;

  if tier = 'p3' then
    select i.id into existing
    from public.inbox_items i
    where i.org_id = target_org
      and i.client_id = target_client
      and i.priority = 'p3'
      and i.status = 'open'
    limit 1;
    if existing is not null then
      return existing;
    end if;
  end if;

  insert into public.threads (org_id, client_id)
  values (target_org, target_client)
  on conflict (org_id, client_id) do nothing;

  select t.id into thread
  from public.threads t
  where t.org_id = target_org
    and t.client_id = target_client;

  if tier in ('p0', 'p0_injury') then
    priority := 'p0';
    emergency := false;
    codes := array['refusal_keyword'];
    title := 'Injury';
    template := 'medical_safety';
    decision := 'hard_refuse';
    message_body := 'Sharp pain in my knee on lunges, what should I do?';
    template_body := 'I can''t help with that one. Please stop the exercise and check with a medical professional if you''re hurting. Your coach has been alerted and will reply.';
    preview := message_body;
    item_at := now() - interval '2 hours';
  elsif tier = 'p0_emergency' then
    priority := 'p0';
    emergency := true;
    codes := array['emergency'];
    title := 'Emergency';
    template := 'emergency';
    decision := 'hard_refuse';
    message_body := 'My chest hurts and feels tight after that set';
    template_body := 'This sounds urgent. Please call 911 or your local emergency number right now. Your coach has been alerted.';
    preview := message_body;
    item_at := now() - interval '1 hour';
  elsif tier = 'p0_self_harm' then
    priority := 'p0';
    emergency := true;
    codes := array['self_harm', 'emergency'];
    title := 'Emergency';
    template := 'emergency_self_harm';
    decision := 'hard_refuse';
    message_body := 'I''ve been thinking about hurting myself';
    template_body := 'This sounds urgent. Please call 911 or your local emergency number right now. Your coach has been alerted.'
      || E'\n'
      || 'In the US you can call or text 988 to reach the Suicide and Crisis Lifeline.';
    preview := message_body;
    item_at := now() - interval '30 minutes';
  elsif tier = 'p1' then
    priority := 'p1';
    emergency := false;
    codes := array['asks_for_coach'];
    title := 'Asked for you';
    template := null;
    decision := 'escalate';
    confidence := 0.62;
    message_body := 'Can I talk to you about swapping Thursday?';
    draft := 'Thursday can move to Friday. Tell me if that works.';
    template_body := draft;
    preview := message_body;
    item_at := now() - interval '3 hours';
  elsif tier = 'p2' then
    priority := 'p2';
    emergency := false;
    codes := array['unanswered'];
    title := 'Unanswered';
    message_body := 'Did you see my note about Friday?';
    preview := message_body;
    item_at := now() - interval '5 hours';
  else
    priority := 'p3';
    emergency := false;
    codes := array['missed'];
    title := 'Missed';
    preview := 'Lower A · no log yet';
    item_at := now() - interval '6 hours';
  end if;

  select m.user_id into trainer
  from public.memberships m
  where m.org_id = target_org
    and m.role = 'trainer'
  limit 1;

  if tier <> 'p3' then
    insert into public.messages (thread_id, org_id, sender_id, body, kind, created_at)
    values (thread, target_org, target_client, message_body, 'human', item_at)
    returning id into message;
  end if;

  if decision = 'hard_refuse' and trainer is not null then
    insert into public.messages (thread_id, org_id, sender_id, body, kind, created_at)
    values (thread, target_org, trainer, template_body, 'ai', item_at + interval '1 second');
  end if;

  if tier in ('p0', 'p0_injury', 'p0_emergency', 'p0_self_harm', 'p1') then
    insert into public.audit_events (
      org_id, client_id, message_id, chunks, draft_text, confidence, threshold,
      reason_codes, decision, template_id, delivered_at, final_text, model, prompt_version, created_at
    ) values (
      target_org,
      target_client,
      message,
      '[]'::jsonb,
      template_body,
      confidence,
      0.85,
      codes,
      decision,
      template,
      case when decision = 'hard_refuse' then item_at else null end,
      case when decision = 'hard_refuse' then template_body else null end,
      'cleat-canned-scorer',
      '4-rag-v1',
      item_at
    )
    returning id into audit;
  end if;

  insert into public.inbox_items (
    org_id, client_id, audit_id, message_id, priority, emergency, reason_codes,
    title, preview, template_id, status, created_at
  ) values (
    target_org,
    target_client,
    audit,
    message,
    priority,
    emergency,
    codes,
    title,
    preview,
    template,
    'open',
    item_at
  )
  returning id into item;

  if tier = 'p1' then
    insert into public.held_drafts (
      org_id, client_id, thread_id, message_id, audit_id, inbox_item_id, draft_text, sources, status
    ) values (
      target_org,
      target_client,
      thread,
      message,
      audit,
      item,
      draft,
      '[{"title":"Rest days","articleId":null}]'::jsonb,
      'held'
    );
    insert into public.trainer_notices (org_id, client_id, inbox_item_id, title, body, emergency)
    values (
      target_org,
      target_client,
      item,
      title,
      'A draft is held. The client has not received it.',
      false
    );
  elsif tier in ('p0', 'p0_injury', 'p0_emergency', 'p0_self_harm') then
    insert into public.trainer_notices (org_id, client_id, inbox_item_id, title, body, emergency)
    values (
      target_org,
      target_client,
      item,
      title,
      'A client message needs you now. The safety reply was sent.',
      emergency
    );
  end if;

  return item;
end;
$$;

revoke all on function public.thread_heads() from public;
revoke all on function public.resolve_inbox_item(uuid, text, text) from public;
revoke all on function public.seed_inbox_tier(uuid, uuid, text) from public;

grant execute on function public.thread_heads() to authenticated;
grant execute on function public.resolve_inbox_item(uuid, text, text) to authenticated;
