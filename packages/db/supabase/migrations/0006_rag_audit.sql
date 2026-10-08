-- Cleat 0006_rag_audit
-- Ticket 4: knowledge base, program chunks, confidence gate settings, audit, held drafts.
-- Booking owns 0005. This migration does not read booking tables.
-- Row level security is enabled here. Policy list: ../RLS.md
--
-- Production embeddings are OpenAI text-embedding-3-small, vector(1536).
-- When the server has no OpenAI key it stores the same width from the offline hash embedder.
-- The service role writes chunks, audit rows, AI messages, inbox items, and notices.
-- Authenticated users do not get insert grants on those tables.

alter table public.messages
  add column kind text not null default 'human',
  add column sources jsonb not null default '[]'::jsonb;

alter table public.messages
  add constraint messages_kind_check check (kind in ('human', 'ai'));

create table public.ai_settings (
  org_id uuid primary key references public.orgs (id) on delete cascade,
  auto_send boolean not null default false,
  threshold numeric(3, 2) not null default 0.85,
  sign_off text not null default '',
  tone_notes text not null default '',
  updated_at timestamptz not null default now(),
  constraint ai_settings_threshold_range check (threshold >= 0.60 and threshold <= 0.95),
  constraint ai_settings_sign_off_length check (char_length(sign_off) <= 120),
  constraint ai_settings_tone_length check (char_length(tone_notes) <= 500)
);

create table public.kb_articles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  title text not null,
  category text not null,
  body text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kb_articles_category_check check (category in ('safety', 'faq', 'rules')),
  constraint kb_articles_title_length check (char_length(btrim(title)) between 1 and 120),
  constraint kb_articles_body_length check (char_length(btrim(body)) between 1 and 8000)
);

create index kb_articles_org_idx on public.kb_articles (org_id, updated_at desc);

create trigger kb_articles_touch_updated_at
  before update on public.kb_articles
  for each row
  execute function public.touch_updated_at();

create trigger ai_settings_touch_updated_at
  before update on public.ai_settings
  for each row
  execute function public.touch_updated_at();

-- client_id is null for knowledge base chunks and set for one client's program.
create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  client_id uuid references auth.users (id) on delete cascade,
  source text not null,
  article_id uuid references public.kb_articles (id) on delete cascade,
  program_id uuid references public.programs (id) on delete cascade,
  position int not null default 0,
  snippet text not null,
  embedding vector(1536) not null,
  model text not null,
  created_at timestamptz not null default now(),
  constraint chunks_source_check check (source in ('kb', 'program')),
  constraint chunks_position_check check (position >= 0),
  constraint chunks_snippet_length check (char_length(snippet) between 1 and 4000),
  constraint chunks_model_length check (char_length(model) between 1 and 80),
  constraint chunks_source_shape check (
    (source = 'kb' and article_id is not null and client_id is null and program_id is null)
    or (source = 'program' and program_id is not null and client_id is not null and article_id is null)
  )
);

create index chunks_org_client_idx on public.chunks (org_id, client_id);
create index chunks_article_idx on public.chunks (article_id);
create index chunks_program_idx on public.chunks (program_id);
create index chunks_embedding_hnsw on public.chunks using hnsw (embedding vector_cosine_ops);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  chunks jsonb not null default '[]'::jsonb,
  draft_text text not null default '',
  confidence double precision not null,
  threshold numeric(3, 2) not null,
  reason_codes text[] not null default '{}',
  decision text not null,
  template_id text,
  delivered_at timestamptz,
  trainer_edit boolean,
  trainer_action text,
  final_text text,
  model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  trainer_acted_at timestamptz,
  constraint audit_events_message_unique unique (message_id),
  constraint audit_events_decision_check check (decision in ('auto_send', 'escalate', 'hard_refuse')),
  constraint audit_events_template_check check (
    template_id is null or template_id in ('emergency', 'emergency_self_harm', 'medical_safety')
  ),
  constraint audit_events_action_check check (
    trainer_action is null or trainer_action in ('send_edited', 'send_as_is', 'dismiss')
  ),
  constraint audit_events_confidence_check check (confidence >= 0 and confidence <= 1),
  constraint audit_events_threshold_check check (threshold >= 0.60 and threshold <= 0.95)
);

create index audit_events_org_created_idx on public.audit_events (org_id, created_at desc);
create index audit_events_client_idx on public.audit_events (client_id, created_at desc);

create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  audit_id uuid not null references public.audit_events (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  priority text not null,
  emergency boolean not null default false,
  reason_codes text[] not null default '{}',
  title text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint inbox_items_priority_check check (priority in ('p0', 'p1')),
  constraint inbox_items_status_check check (status in ('open', 'sent', 'dismissed')),
  constraint inbox_items_title_length check (char_length(title) between 1 and 120)
);

create index inbox_items_org_sort_idx on public.inbox_items (org_id, emergency desc, priority, created_at desc);

create table public.held_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid not null references public.threads (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  audit_id uuid not null references public.audit_events (id) on delete cascade,
  inbox_item_id uuid not null references public.inbox_items (id) on delete cascade,
  draft_text text not null,
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'held',
  created_at timestamptz not null default now(),
  constraint held_drafts_status_check check (status in ('held', 'sent', 'dismissed')),
  constraint held_drafts_message_unique unique (message_id),
  constraint held_drafts_draft_length check (char_length(draft_text) between 1 and 4000)
);

create index held_drafts_org_client_idx on public.held_drafts (org_id, client_id, status);

create table public.trainer_notices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  inbox_item_id uuid references public.inbox_items (id) on delete cascade,
  title text not null,
  body text not null,
  emergency boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint trainer_notices_title_length check (char_length(title) between 1 and 120),
  constraint trainer_notices_body_length check (char_length(body) between 1 and 500)
);

create index trainer_notices_org_created_idx on public.trainer_notices (org_id, created_at desc);

-- New orgs start with auto send OFF and threshold 0.85. The floor 0.50 is not stored.
create or replace function public.create_ai_settings_for_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ai_settings (org_id)
  values (new.id)
  on conflict (org_id) do nothing;
  return new;
end;
$$;

create trigger orgs_create_ai_settings
  after insert on public.orgs
  for each row
  execute function public.create_ai_settings_for_org();

insert into public.ai_settings (org_id)
select id from public.orgs
on conflict (org_id) do nothing;

-- Ticket 7 inserts the demo org with this id. Only that org is turned ON.
create or replace function public.enable_demo_auto_send()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ai_settings
  set auto_send = true
  where org_id = 'd1000000-0000-4000-8000-000000000001';
end;
$$;

create or replace function public.match_chunks(
  query_embedding vector(1536),
  target_org uuid,
  target_client uuid,
  match_count int
)
returns table (
  id uuid,
  snippet text,
  score float8,
  article_id uuid,
  source text,
  client_id uuid,
  org_id uuid,
  title text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.snippet,
    (1 - (c.embedding <=> query_embedding))::float8 as score,
    c.article_id,
    c.source,
    c.client_id,
    c.org_id,
    a.title
  from public.chunks c
  left join public.kb_articles a on a.id = c.article_id
  where c.org_id = target_org
    and (c.client_id is null or c.client_id = target_client)
  order by c.embedding <=> query_embedding
  limit least(greatest(coalesce(match_count, 5), 1), 20);
$$;

alter table public.ai_settings enable row level security;
alter table public.kb_articles enable row level security;
alter table public.chunks enable row level security;
alter table public.audit_events enable row level security;
alter table public.inbox_items enable row level security;
alter table public.held_drafts enable row level security;
alter table public.trainer_notices enable row level security;

alter table public.ai_settings force row level security;
alter table public.kb_articles force row level security;
alter table public.chunks force row level security;
alter table public.audit_events force row level security;
alter table public.inbox_items force row level security;
alter table public.held_drafts force row level security;
alter table public.trainer_notices force row level security;

create policy ai_settings_select on public.ai_settings
  for select to authenticated
  using (public.is_trainer_of(org_id));

create policy ai_settings_update on public.ai_settings
  for update to authenticated
  using (public.is_trainer_of(org_id))
  with check (public.is_trainer_of(org_id));

create policy kb_articles_select on public.kb_articles
  for select to authenticated
  using (public.is_trainer_of(org_id));

create policy chunks_select on public.chunks
  for select to authenticated
  using (
    public.is_trainer_of(org_id)
    or (
      public.is_member_of(org_id)
      and (client_id is null or client_id = auth.uid())
    )
  );

create policy audit_events_select on public.audit_events
  for select to authenticated
  using (public.is_trainer_of(org_id));

create policy inbox_items_select on public.inbox_items
  for select to authenticated
  using (public.is_trainer_of(org_id));

create policy held_drafts_select on public.held_drafts
  for select to authenticated
  using (public.is_trainer_of(org_id));

create policy trainer_notices_select on public.trainer_notices
  for select to authenticated
  using (public.is_trainer_of(org_id));

create policy trainer_notices_update on public.trainer_notices
  for update to authenticated
  using (public.is_trainer_of(org_id))
  with check (public.is_trainer_of(org_id));

revoke all on table public.ai_settings from public, anon, authenticated;
revoke all on table public.kb_articles from public, anon, authenticated;
revoke all on table public.chunks from public, anon, authenticated;
revoke all on table public.audit_events from public, anon, authenticated;
revoke all on table public.inbox_items from public, anon, authenticated;
revoke all on table public.held_drafts from public, anon, authenticated;
revoke all on table public.trainer_notices from public, anon, authenticated;

grant select, update on table public.ai_settings to authenticated;
grant select on table public.kb_articles to authenticated;
grant select on table public.chunks to authenticated;
grant select on table public.audit_events to authenticated;
grant select on table public.inbox_items to authenticated;
grant select on table public.held_drafts to authenticated;
grant select, update on table public.trainer_notices to authenticated;

revoke all on function public.create_ai_settings_for_org() from public;
revoke all on function public.enable_demo_auto_send() from public;
revoke all on function public.match_chunks(vector(1536), uuid, uuid, int) from public;

grant execute on function public.match_chunks(vector(1536), uuid, uuid, int) to authenticated;
