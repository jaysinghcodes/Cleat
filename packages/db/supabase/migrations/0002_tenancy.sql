-- CoachLoop 0002_tenancy
-- Ticket 1: orgs, profiles, memberships, and invites.
-- Row level security is enabled in this migration. Policy list: ../RLS.md
--
-- v1: one org is one trainer. A user belongs to one org.
-- Writes that cross tables go through security definer functions so a client
-- cannot insert a membership for an org they do not hold an invite for.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 80),
  constraint profiles_timezone_length check (char_length(btrim(timezone)) between 1 and 64)
);

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint orgs_name_length check (char_length(btrim(name)) between 1 and 80)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  constraint memberships_role_check check (role in ('trainer', 'client')),
  constraint memberships_org_user_unique unique (org_id, user_id),
  constraint memberships_one_org_per_user unique (user_id)
);

create unique index memberships_one_trainer_per_org
  on public.memberships (org_id)
  where role = 'trainer';

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id),
  constraint invites_expire_within_7_days check (expires_at <= created_at + interval '7 days'),
  constraint invites_accepted_pair check (
    (accepted_at is null and accepted_by is null)
    or (accepted_at is not null and accepted_by is not null)
  )
);

create index invites_org_id_idx on public.invites (org_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row
  execute function public.touch_updated_at();

-- Helpers are security definer so policies can read memberships without
-- recursing through membership RLS. They only answer questions about auth.uid().

create or replace function public.is_trainer_of(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships
    where user_id = auth.uid()
      and org_id = target_org
      and role = 'trainer'
  );
$$;

create or replace function public.is_member_of(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships
    where user_id = auth.uid()
      and org_id = target_org
  );
$$;

-- Own row, everyone in the org when the caller is the trainer, or the trainer
-- when the caller is a client. Never another client.
create or replace function public.can_read_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      target = auth.uid()
      or exists (
        select 1
        from public.memberships mine
        join public.memberships theirs on theirs.org_id = mine.org_id
        where mine.user_id = auth.uid()
          and theirs.user_id = target
          and (mine.role = 'trainer' or theirs.role = 'trainer')
      )
    );
$$;

create or replace function public.current_membership()
returns table (
  org_id uuid,
  org_name text,
  role text,
  display_name text,
  timezone text
)
language sql
stable
security definer
set search_path = public
as $$
  select m.org_id, o.name, m.role, p.display_name, p.timezone
  from public.memberships m
  join public.orgs o on o.id = m.org_id
  join public.profiles p on p.id = m.user_id
  where m.user_id = auth.uid();
$$;

create or replace function public.my_coach()
returns table (
  display_name text,
  org_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.display_name, o.name
  from public.memberships mine
  join public.memberships trainer
    on trainer.org_id = mine.org_id
   and trainer.role = 'trainer'
  join public.profiles p on p.id = trainer.user_id
  join public.orgs o on o.id = mine.org_id
  where mine.user_id = auth.uid()
    and mine.role = 'client';
$$;

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

create or replace function public.accept_invite(
  invite_id uuid,
  display_name text,
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
  clean_zone text := btrim(coalesce(timezone, ''));
  invite public.invites%rowtype;
  existing_org uuid;
  existing_role text;
begin
  if uid is null then
    raise exception 'Sign in before accepting an invite.';
  end if;
  if char_length(clean_name) < 1 or char_length(clean_name) > 80 then
    raise exception 'Enter your name.';
  end if;
  if char_length(clean_zone) < 1 or char_length(clean_zone) > 64 then
    raise exception 'Enter a timezone.';
  end if;

  perform pg_advisory_xact_lock(hashtext(uid::text));

  select * into invite
  from public.invites
  where id = invite_id
  for update;

  if not found then
    raise exception 'This invite link is not valid.';
  end if;

  if invite.expires_at <= now() then
    raise exception 'This invite has expired. Ask your coach for a new link.';
  end if;

  if invite.accepted_by is not null and invite.accepted_by is distinct from uid then
    raise exception 'This invite has already been used.';
  end if;

  select m.org_id, m.role into existing_org, existing_role
  from public.memberships m
  where m.user_id = uid;

  if existing_role = 'trainer' then
    raise exception 'Trainer accounts cannot join a roster as a client.';
  end if;

  if existing_org is not null and existing_org is distinct from invite.org_id then
    raise exception 'This account already belongs to another org.';
  end if;

  if existing_org is not null and existing_org = invite.org_id then
    return existing_org;
  end if;

  insert into public.profiles (id, display_name, timezone)
  values (uid, clean_name, clean_zone)
  on conflict (id) do update
    set display_name = excluded.display_name,
        timezone = excluded.timezone;

  insert into public.memberships (org_id, user_id, role)
  values (invite.org_id, uid, 'client');

  update public.invites
  set accepted_at = now(),
      accepted_by = uid
  where id = invite.id;

  return invite.org_id;
end;
$$;

-- Token lookup for the invite screen before the visitor has a membership.
-- Returns the coach name, org name, expiry, and a status. Nothing else.
create or replace function public.invite_preview(invite_id uuid)
returns table (
  org_name text,
  trainer_name text,
  expires_at timestamptz,
  status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  invite public.invites%rowtype;
  org_label text;
  trainer_label text;
  invite_status text;
begin
  select * into invite
  from public.invites
  where id = invite_id;

  if not found then
    return query select null::text, null::text, null::timestamptz, 'missing'::text;
    return;
  end if;

  select o.name into org_label
  from public.orgs o
  where o.id = invite.org_id;

  select p.display_name into trainer_label
  from public.profiles p
  join public.memberships m on m.user_id = p.id
  where m.org_id = invite.org_id
    and m.role = 'trainer'
  limit 1;

  if invite.accepted_at is not null then
    invite_status := 'accepted';
  elsif invite.expires_at <= now() then
    invite_status := 'expired';
  else
    invite_status := 'active';
  end if;

  return query select org_label, trainer_label, invite.expires_at, invite_status;
end;
$$;

alter table public.profiles enable row level security;
alter table public.orgs enable row level security;
alter table public.memberships enable row level security;
alter table public.invites enable row level security;

alter table public.profiles force row level security;
alter table public.orgs force row level security;
alter table public.memberships force row level security;
alter table public.invites force row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (public.can_read_profile(id));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy orgs_select_member on public.orgs
  for select to authenticated
  using (public.is_member_of(id));

create policy orgs_update_trainer on public.orgs
  for update to authenticated
  using (public.is_trainer_of(id))
  with check (public.is_trainer_of(id) and created_by = auth.uid());

create policy memberships_select_own on public.memberships
  for select to authenticated
  using (user_id = auth.uid());

create policy memberships_select_trainer on public.memberships
  for select to authenticated
  using (public.is_trainer_of(org_id));

create policy invites_select_trainer on public.invites
  for select to authenticated
  using (public.is_trainer_of(org_id));

create policy invites_insert_trainer on public.invites
  for insert to authenticated
  with check (public.is_trainer_of(org_id) and created_by = auth.uid());

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.orgs from public, anon, authenticated;
revoke all on table public.memberships from public, anon, authenticated;
revoke all on table public.invites from public, anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select, update on table public.profiles to authenticated;
grant select, update on table public.orgs to authenticated;
grant select on table public.memberships to authenticated;
grant select, insert on table public.invites to authenticated;

revoke all on function public.touch_updated_at() from public;
revoke all on function public.is_trainer_of(uuid) from public;
revoke all on function public.is_member_of(uuid) from public;
revoke all on function public.can_read_profile(uuid) from public;
revoke all on function public.current_membership() from public;
revoke all on function public.my_coach() from public;
revoke all on function public.create_trainer_org(text, text, text) from public;
revoke all on function public.accept_invite(uuid, text, text) from public;
revoke all on function public.invite_preview(uuid) from public;

grant execute on function public.touch_updated_at() to authenticated;
grant execute on function public.is_trainer_of(uuid) to authenticated;
grant execute on function public.is_member_of(uuid) to authenticated;
grant execute on function public.can_read_profile(uuid) to authenticated;
grant execute on function public.current_membership() to authenticated;
grant execute on function public.my_coach() to authenticated;
grant execute on function public.create_trainer_org(text, text, text) to authenticated;
grant execute on function public.accept_invite(uuid, text, text) to authenticated;
grant execute on function public.invite_preview(uuid) to anon, authenticated;
