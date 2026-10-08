-- Cleat 0004_chat
-- Ticket 3: one thread per client and trainer, messages, and push token storage.
-- Row level security is enabled in this migration. Policy list: ../RLS.md
--
-- Writes go through ensure_thread and post_message so a client cannot open
-- another client's thread. The Ticket 4 AI hook is not in SQL. The desk calls
-- onClientMessage after a client message is stored. This migration does not
-- send push notifications. Nudge copy from programs is a later ticket.

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint threads_org_client_unique unique (org_id, client_id)
);

create index threads_org_id_idx on public.threads (org_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  sender_id uuid not null references auth.users (id),
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_length check (char_length(btrim(body)) between 1 and 4000)
);

create index messages_thread_created_idx on public.messages (thread_id, created_at desc);

-- Stored per device for a later push sender. This ticket does not register tokens
-- and does not call the Expo push service.
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  device_id text not null,
  token text not null,
  platform text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_tokens_platform_check check (platform in ('ios', 'android')),
  constraint push_tokens_device_length check (char_length(btrim(device_id)) between 1 and 128),
  constraint push_tokens_token_length check (char_length(btrim(token)) between 1 and 512),
  constraint push_tokens_user_device_unique unique (user_id, device_id)
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

create trigger push_tokens_touch_updated_at
  before update on public.push_tokens
  for each row
  execute function public.touch_updated_at();

alter table public.messages replica identity full;

-- Local Supabase creates this publication before migrations run.
-- Plain Postgres used by test:rls does not, so skip there.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end
$$;

create or replace function public.can_read_thread(target_thread uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.threads t
    where t.id = target_thread
      and (
        public.is_trainer_of(t.org_id)
        or (t.client_id = auth.uid() and public.is_member_of(t.org_id))
      )
  );
$$;

create or replace function public.ensure_thread(target_client uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  caller_org uuid;
  caller_role text;
  resolved_client uuid;
  thread uuid;
begin
  if uid is null then
    raise exception 'Sign in before sending a message.';
  end if;

  select m.org_id, m.role into caller_org, caller_role
  from public.memberships m
  where m.user_id = uid;

  if caller_org is null then
    raise exception 'Sign in before sending a message.';
  end if;

  if caller_role = 'client' then
    if target_client is distinct from uid then
      raise exception 'You can only message your coach.';
    end if;
    resolved_client := uid;
  elsif caller_role = 'trainer' then
    if not exists (
      select 1
      from public.memberships m
      where m.org_id = caller_org
        and m.user_id = target_client
        and m.role = 'client'
    ) then
      raise exception 'That client is not on your roster.';
    end if;
    resolved_client := target_client;
  else
    raise exception 'Sign in before sending a message.';
  end if;

  insert into public.threads (org_id, client_id)
  values (caller_org, resolved_client)
  on conflict (org_id, client_id) do nothing;

  select t.id into thread
  from public.threads t
  where t.org_id = caller_org
    and t.client_id = resolved_client;

  return thread;
end;
$$;

-- Return columns are prefixed so they do not clash with table columns in plpgsql.
create or replace function public.post_message(target_client uuid, message_body text)
returns table (
  message_id uuid,
  message_thread_id uuid,
  message_org_id uuid,
  message_sender_id uuid,
  posted_body text,
  message_created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text := btrim(coalesce(message_body, ''));
  thread uuid;
begin
  if uid is null then
    raise exception 'Sign in before sending a message.';
  end if;
  if char_length(clean) < 1 then
    raise exception 'Write a message first.';
  end if;
  if char_length(clean) > 4000 then
    raise exception 'Keep the message under 4000 characters.';
  end if;

  thread := public.ensure_thread(target_client);

  return query
  insert into public.messages as inserted (thread_id, org_id, sender_id, body)
  select thread, t.org_id, uid, clean
  from public.threads t
  where t.id = thread
  returning
    inserted.id,
    inserted.thread_id,
    inserted.org_id,
    inserted.sender_id,
    inserted.body,
    inserted.created_at;
end;
$$;

create or replace function public.thread_previews()
returns table (
  thread_id uuid,
  client_id uuid,
  last_body text,
  last_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (t.id)
    t.id,
    t.client_id,
    m.body,
    m.created_at
  from public.threads t
  left join public.messages m on m.thread_id = t.id
  order by t.id, m.created_at desc nulls last;
$$;

alter table public.threads enable row level security;
alter table public.messages enable row level security;
alter table public.push_tokens enable row level security;

alter table public.threads force row level security;
alter table public.messages force row level security;
alter table public.push_tokens force row level security;

create policy threads_select on public.threads
  for select to authenticated
  using (
    public.is_trainer_of(org_id)
    or (client_id = auth.uid() and public.is_member_of(org_id))
  );

create policy messages_select on public.messages
  for select to authenticated
  using (public.can_read_thread(thread_id));

create policy push_tokens_select_own on public.push_tokens
  for select to authenticated
  using (user_id = auth.uid());

create policy push_tokens_insert_own on public.push_tokens
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_member_of(org_id));

create policy push_tokens_update_own on public.push_tokens
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_member_of(org_id));

create policy push_tokens_delete_own on public.push_tokens
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on table public.threads from public, anon, authenticated;
revoke all on table public.messages from public, anon, authenticated;
revoke all on table public.push_tokens from public, anon, authenticated;

grant select on table public.threads to authenticated;
grant select on table public.messages to authenticated;
grant select, insert, update, delete on table public.push_tokens to authenticated;

revoke all on function public.can_read_thread(uuid) from public;
revoke all on function public.ensure_thread(uuid) from public;
revoke all on function public.post_message(uuid, text) from public;
revoke all on function public.thread_previews() from public;

grant execute on function public.can_read_thread(uuid) to authenticated;
grant execute on function public.ensure_thread(uuid) to authenticated;
grant execute on function public.post_message(uuid, text) to authenticated;
grant execute on function public.thread_previews() to authenticated;
