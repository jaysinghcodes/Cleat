-- Cleat 0005_booking
-- Ticket 6: availability, sessions, ICS tokens, optional Google credentials.
-- Sessions are stored in UTC. Availability windows are minutes in the trainer timezone.
-- ICS subscribe does not need Google. Google rows stay empty unless a coach connects.

alter table public.orgs
  add column cancel_cutoff_hours integer not null default 12,
  add column primary_calendar text not null default 'ics',
  add constraint orgs_cancel_cutoff_hours_check check (cancel_cutoff_hours between 0 and 168),
  add constraint orgs_primary_calendar_check check (primary_calendar in ('ics', 'google'));

create table public.trainer_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  slot_minutes integer not null default 60,
  constraint trainer_settings_slot_minutes_check check (
    slot_minutes between 15 and 180
    and slot_minutes % 15 = 0
  )
);

insert into public.trainer_settings (user_id, org_id)
select user_id, org_id
from public.memberships
where role = 'trainer'
on conflict (user_id) do nothing;

create or replace function public.memberships_trainer_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'trainer' then
    insert into public.trainer_settings (user_id, org_id)
    values (new.user_id, new.org_id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger memberships_trainer_settings
  after insert on public.memberships
  for each row
  execute function public.memberships_trainer_settings();

create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  trainer_id uuid not null references auth.users (id) on delete cascade,
  weekday smallint,
  override_date date,
  start_minute smallint not null,
  end_minute smallint not null,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  constraint availability_blocks_kind_check check (
    (weekday is not null and override_date is null)
    or (weekday is null and override_date is not null)
  ),
  constraint availability_blocks_weekday_check check (weekday is null or weekday between 0 and 6),
  constraint availability_blocks_minutes_check check (
    start_minute >= 0
    and end_minute <= 1440
    and start_minute < end_minute
  )
);

create unique index availability_weekly_day
  on public.availability_blocks (trainer_id, weekday)
  where override_date is null;

create unique index availability_override_day
  on public.availability_blocks (trainer_id, override_date)
  where override_date is not null;

create index availability_blocks_org_idx on public.availability_blocks (org_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  trainer_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'booked',
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id),
  google_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sessions_status_check check (status in ('booked', 'cancelled')),
  constraint sessions_range_check check (ends_at > starts_at),
  constraint sessions_cancel_pair_check check (
    (status = 'booked' and cancelled_at is null and cancelled_by is null)
    or (status = 'cancelled' and cancelled_at is not null and cancelled_by is not null)
  )
);

create index sessions_org_starts_idx on public.sessions (org_id, starts_at);
create index sessions_client_starts_idx on public.sessions (client_id, starts_at);
create index sessions_trainer_starts_idx on public.sessions (trainer_id, starts_at);

create unique index sessions_booked_start_unique
  on public.sessions (trainer_id, starts_at)
  where status = 'booked';

create trigger sessions_touch_updated_at
  before update on public.sessions
  for each row
  execute function public.touch_updated_at();

create table public.calendar_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  nonce text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint calendar_tokens_nonce_check check (nonce ~ '^[0-9a-f]{64}$')
);

create unique index calendar_tokens_one_active
  on public.calendar_tokens (user_id)
  where revoked_at is null;

create table public.google_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  refresh_token text not null,
  email text,
  connected_at timestamptz not null default now(),
  constraint google_credentials_token_length check (char_length(refresh_token) >= 8)
);

-- Replaces the Ticket 1 function so a new desk also gets a 60 minute slot length.
create or replace function public.create_trainer_org(
  display_name text,
  org_name text,
  timezone text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_name text := btrim(coalesce(display_name, ''));
  clean_org text := btrim(coalesce(org_name, ''));
  clean_zone text := btrim(coalesce(timezone, ''));
  existing uuid;
  new_org uuid;
begin
  if uid is null then
    raise exception 'Sign in before creating a desk.';
  end if;
  if char_length(clean_name) < 1 or char_length(clean_name) > 80 then
    raise exception 'Enter your name.';
  end if;
  if char_length(clean_org) < 1 or char_length(clean_org) > 80 then
    raise exception 'Enter your gym or brand name.';
  end if;
  if char_length(clean_zone) < 1 or char_length(clean_zone) > 64 then
    raise exception 'Enter a timezone.';
  end if;

  perform pg_advisory_xact_lock(hashtext(uid::text));

  select m.org_id into existing
  from public.memberships m
  where m.user_id = uid;

  if existing is not null then
    insert into public.trainer_settings (user_id, org_id)
    values (uid, existing)
    on conflict (user_id) do nothing;
    return existing;
  end if;

  insert into public.profiles (id, display_name, timezone)
  values (uid, clean_name, clean_zone)
  on conflict (id) do update
    set display_name = excluded.display_name,
        timezone = excluded.timezone;

  insert into public.orgs (name, created_by)
  values (clean_org, uid)
  returning id into new_org;

  insert into public.memberships (org_id, user_id, role)
  values (new_org, uid, 'trainer');

  return new_org;
end;
$$;

create or replace function public.sessions_guard_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'booked' and exists (
    select 1
    from public.sessions s
    where s.trainer_id = new.trainer_id
      and s.status = 'booked'
      and s.id is distinct from new.id
      and tstzrange(s.starts_at, s.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'That slot was just booked. Pick another time.';
  end if;
  return new;
end;
$$;

create trigger sessions_guard_overlap
  before insert or update on public.sessions
  for each row
  execute function public.sessions_guard_overlap();

create or replace function public.orgs_guard_calendar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.primary_calendar = 'google' and not exists (
    select 1
    from public.google_credentials g
    join public.memberships m on m.user_id = g.user_id
    where m.org_id = new.id
      and m.role = 'trainer'
  ) then
    raise exception 'Connect Google Calendar before choosing it.';
  end if;
  return new;
end;
$$;

create trigger orgs_guard_calendar
  before update of primary_calendar on public.orgs
  for each row
  execute function public.orgs_guard_calendar();

create or replace function public.book_session(slot_start timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  org uuid;
  trainer uuid;
  trainer_tz text;
  slot integer;
  slot_end timestamptz;
  local_ts timestamp;
  local_date date;
  minutes integer;
  dow integer;
  has_override boolean;
  fits boolean;
  new_id uuid;
begin
  if uid is null then
    raise exception 'Sign in before booking a session.';
  end if;

  select m.org_id into org
  from public.memberships m
  where m.user_id = uid
    and m.role = 'client';

  if org is null then
    raise exception 'Only a client can book a session.';
  end if;

  select m.user_id into trainer
  from public.memberships m
  where m.org_id = org
    and m.role = 'trainer';

  select p.timezone into trainer_tz
  from public.profiles p
  where p.id = trainer;

  select t.slot_minutes into slot
  from public.trainer_settings t
  where t.user_id = trainer;

  if slot is null then
    slot := 60;
  end if;

  if slot_start is null or slot_start <= now() then
    raise exception 'That slot is not open.';
  end if;

  slot_end := slot_start + make_interval(mins => slot);
  local_ts := slot_start at time zone trainer_tz;

  if local_ts <> date_trunc('minute', local_ts) then
    raise exception 'That slot is not open.';
  end if;

  local_date := local_ts::date;
  minutes := extract(hour from local_ts)::integer * 60 + extract(minute from local_ts)::integer;
  dow := extract(dow from local_ts)::integer;

  select exists (
    select 1
    from public.availability_blocks b
    where b.org_id = org
      and b.trainer_id = trainer
      and b.override_date = local_date
  ) into has_override;

  select exists (
    select 1
    from public.availability_blocks b
    where b.org_id = org
      and b.trainer_id = trainer
      and b.available
      and (
        (has_override and b.override_date = local_date)
        or (not has_override and b.weekday = dow and b.override_date is null)
      )
      and minutes >= b.start_minute
      and minutes + slot <= b.end_minute
      and ((minutes - b.start_minute) % slot = 0)
  ) into fits;

  if not fits then
    raise exception 'That slot is not open.';
  end if;

  perform pg_advisory_xact_lock(hashtext('book:' || trainer::text));

  if exists (
    select 1
    from public.sessions s
    where s.trainer_id = trainer
      and s.status = 'booked'
      and tstzrange(s.starts_at, s.ends_at, '[)') && tstzrange(slot_start, slot_end, '[)')
  ) then
    raise exception 'That slot was just booked. Pick another time.';
  end if;

  if exists (
    select 1
    from public.sessions s
    where s.client_id = uid
      and s.status = 'booked'
      and tstzrange(s.starts_at, s.ends_at, '[)') && tstzrange(slot_start, slot_end, '[)')
  ) then
    raise exception 'You already have a session then.';
  end if;

  begin
    insert into public.sessions (org_id, trainer_id, client_id, starts_at, ends_at, status)
    values (org, trainer, uid, slot_start, slot_end, 'booked')
    returning id into new_id;
  exception
    when unique_violation then
      raise exception 'That slot was just booked. Pick another time.';
  end;

  return new_id;
end;
$$;

create or replace function public.cancel_session(session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  sess public.sessions%rowtype;
  caller_role text;
  cutoff integer;
begin
  if uid is null then
    raise exception 'Sign in before booking a session.';
  end if;

  select * into sess
  from public.sessions
  where id = session_id
  for update;

  if not found then
    raise exception 'That session is not yours.';
  end if;

  if sess.status = 'cancelled' then
    raise exception 'This session is already cancelled.';
  end if;

  select m.role into caller_role
  from public.memberships m
  where m.user_id = uid
    and m.org_id = sess.org_id;

  if caller_role is null then
    raise exception 'That session is not yours.';
  end if;

  select o.cancel_cutoff_hours into cutoff
  from public.orgs o
  where o.id = sess.org_id;

  if caller_role = 'client' then
    if sess.client_id is distinct from uid then
      raise exception 'That session is not yours.';
    end if;
    if now() > sess.starts_at - make_interval(hours => cutoff) then
      raise exception 'You can cancel up to % hours before the session.', cutoff;
    end if;
  elsif caller_role is distinct from 'trainer' then
    raise exception 'That session is not yours.';
  end if;

  update public.sessions
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = uid
  where id = sess.id;
end;
$$;

create or replace function public.issue_calendar_token(regenerate boolean default false)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  org uuid;
  existing text;
  fresh text;
begin
  if uid is null then
    raise exception 'Sign in before syncing a calendar.';
  end if;

  select m.org_id into org
  from public.memberships m
  where m.user_id = uid;

  if org is null then
    raise exception 'Sign in before syncing a calendar.';
  end if;

  perform pg_advisory_xact_lock(hashtext('cal:' || uid::text));

  if coalesce(regenerate, false) then
    update public.calendar_tokens
    set revoked_at = now()
    where user_id = uid
      and revoked_at is null;
  end if;

  select t.nonce into existing
  from public.calendar_tokens t
  where t.user_id = uid
    and t.revoked_at is null;

  if existing is not null then
    return existing;
  end if;

  fresh := encode(gen_random_bytes(32), 'hex');
  insert into public.calendar_tokens (user_id, org_id, nonce)
  values (uid, org, fresh);
  return fresh;
end;
$$;

-- Anon may call this with the unguessable nonce from a signed subscribe URL.
-- A missing or revoked nonce raises and returns no session rows.
create or replace function public.calendar_feed(feed_nonce text)
returns table (
  session_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  person_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  token public.calendar_tokens%rowtype;
begin
  if feed_nonce is null or feed_nonce !~ '^[0-9a-f]{64}$' then
    raise exception 'calendar_token_missing';
  end if;

  select * into token
  from public.calendar_tokens t
  where t.nonce = feed_nonce;

  if not found then
    raise exception 'calendar_token_missing';
  end if;

  if token.revoked_at is not null then
    raise exception 'calendar_token_revoked';
  end if;

  return query
  select
    s.id,
    s.starts_at,
    s.ends_at,
    s.status,
    case
      when s.trainer_id = token.user_id then client_profile.display_name
      else trainer_profile.display_name
    end
  from public.sessions s
  join public.profiles client_profile on client_profile.id = s.client_id
  join public.profiles trainer_profile on trainer_profile.id = s.trainer_id
  where (s.trainer_id = token.user_id or s.client_id = token.user_id)
    and (
      (
        s.status = 'booked'
        and s.starts_at > now() - interval '1 day'
        and s.starts_at < now() + interval '120 days'
      )
      or (
        s.status = 'cancelled'
        and s.cancelled_at > now() - interval '30 days'
      )
    )
  order by s.starts_at;
end;
$$;

-- Times only. Clients need to know a slot is taken without learning who booked it.
create or replace function public.booked_ranges()
returns table (
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.starts_at, s.ends_at
  from public.sessions s
  join public.memberships m on m.org_id = s.org_id
  where m.user_id = auth.uid()
    and s.status = 'booked'
    and s.starts_at > now() - interval '1 day'
    and s.starts_at < now() + interval '120 days'
  order by s.starts_at;
$$;

create or replace function public.google_connection()
returns table (
  connected boolean,
  email text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.google_credentials g
      where g.user_id = auth.uid()
    ),
    (
      select g.email
      from public.google_credentials g
      where g.user_id = auth.uid()
    );
$$;

create or replace function public.save_google_credentials(
  new_refresh_token text,
  account_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  org uuid;
  clean_token text := btrim(coalesce(new_refresh_token, ''));
begin
  if uid is null then
    raise exception 'Sign in before syncing a calendar.';
  end if;

  select m.org_id into org
  from public.memberships m
  where m.user_id = uid
    and m.role = 'trainer';

  if org is null then
    raise exception 'Only a coach can connect Google Calendar.';
  end if;

  if char_length(clean_token) < 8 then
    raise exception 'Google did not return a calendar connection.';
  end if;

  insert into public.google_credentials (user_id, org_id, refresh_token, email)
  values (uid, org, clean_token, null)
  on conflict (user_id) do update
    set refresh_token = excluded.refresh_token,
        email = null,
        org_id = excluded.org_id,
        connected_at = now();
end;
$$;

create or replace function public.disconnect_google()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in before syncing a calendar.';
  end if;

  delete from public.google_credentials
  where user_id = uid;

  update public.orgs
  set primary_calendar = 'ics'
  where id in (
    select m.org_id
    from public.memberships m
    where m.user_id = uid
      and m.role = 'trainer'
  );
end;
$$;

create or replace function public.attach_google_event(session_id uuid, event_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or event_id is null or char_length(btrim(event_id)) < 1 then
    return;
  end if;

  update public.sessions s
  set google_event_id = btrim(event_id)
  where s.id = session_id
    and (
      s.client_id = uid
      or exists (
        select 1
        from public.memberships m
        where m.user_id = uid
          and m.org_id = s.org_id
          and m.role = 'trainer'
      )
    );
end;
$$;

create or replace function public.clear_google_event(session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;

  update public.sessions s
  set google_event_id = null
  where s.id = session_id
    and (
      s.client_id = uid
      or exists (
        select 1
        from public.memberships m
        where m.user_id = uid
          and m.org_id = s.org_id
          and m.role = 'trainer'
      )
    );
end;
$$;

alter table public.trainer_settings enable row level security;
alter table public.availability_blocks enable row level security;
alter table public.sessions enable row level security;
alter table public.calendar_tokens enable row level security;
alter table public.google_credentials enable row level security;

alter table public.trainer_settings force row level security;
alter table public.availability_blocks force row level security;
alter table public.sessions force row level security;
alter table public.calendar_tokens force row level security;
alter table public.google_credentials force row level security;

create policy trainer_settings_select on public.trainer_settings
  for select to authenticated
  using (public.is_member_of(org_id));

create policy trainer_settings_update on public.trainer_settings
  for update to authenticated
  using (user_id = auth.uid() and public.is_trainer_of(org_id))
  with check (user_id = auth.uid() and public.is_trainer_of(org_id));

create policy availability_select_member on public.availability_blocks
  for select to authenticated
  using (public.is_member_of(org_id));

create policy availability_write_trainer on public.availability_blocks
  for all to authenticated
  using (trainer_id = auth.uid() and public.is_trainer_of(org_id))
  with check (trainer_id = auth.uid() and public.is_trainer_of(org_id));

create policy sessions_select_own on public.sessions
  for select to authenticated
  using (
    client_id = auth.uid()
    or public.is_trainer_of(org_id)
  );

revoke all on table public.trainer_settings from public, anon, authenticated;
revoke all on table public.availability_blocks from public, anon, authenticated;
revoke all on table public.sessions from public, anon, authenticated;
revoke all on table public.calendar_tokens from public, anon, authenticated;
revoke all on table public.google_credentials from public, anon, authenticated;

grant select, update on table public.trainer_settings to authenticated;
grant select, insert, update, delete on table public.availability_blocks to authenticated;
grant select on table public.sessions to authenticated;

revoke all on function public.memberships_trainer_settings() from public;
revoke all on function public.sessions_guard_overlap() from public;
revoke all on function public.orgs_guard_calendar() from public;
revoke all on function public.book_session(timestamptz) from public;
revoke all on function public.cancel_session(uuid) from public;
revoke all on function public.issue_calendar_token(boolean) from public;
revoke all on function public.calendar_feed(text) from public;
revoke all on function public.booked_ranges() from public;
revoke all on function public.google_connection() from public;
revoke all on function public.save_google_credentials(text, text) from public;
revoke all on function public.disconnect_google() from public;
revoke all on function public.attach_google_event(uuid, text) from public;
revoke all on function public.clear_google_event(uuid) from public;

grant execute on function public.book_session(timestamptz) to authenticated;
grant execute on function public.cancel_session(uuid) to authenticated;
grant execute on function public.issue_calendar_token(boolean) to authenticated;
grant execute on function public.calendar_feed(text) to anon, authenticated;
grant execute on function public.booked_ranges() to authenticated;
grant execute on function public.google_connection() to authenticated;
grant execute on function public.save_google_credentials(text, text) to authenticated;
grant execute on function public.disconnect_google() to authenticated;
grant execute on function public.attach_google_event(uuid, text) to authenticated;
grant execute on function public.clear_google_event(uuid) to authenticated;
