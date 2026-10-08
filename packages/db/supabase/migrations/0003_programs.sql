-- Cleat 0003_programs
-- Ticket 2: programs, set logs, nudge events, and the client weight unit.
-- Seed friendly for Ticket 7. This file does not insert demo programs.
-- Push delivery is deferred: nudge_events.push_status stays 'deferred'.
-- Writes go through security definer functions. Direct inserts are not granted.

alter table public.profiles
  add column weight_unit text not null default 'lb';

alter table public.profiles
  add constraint profiles_weight_unit_check check (weight_unit in ('lb', 'kg'));

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  start_date date not null,
  status text not null default 'active',
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  replaced_at timestamptz,
  replaced_by uuid references public.programs (id),
  constraint programs_status_check check (status in ('active', 'replaced')),
  constraint programs_name_length check (char_length(btrim(name)) between 1 and 80)
);

create unique index programs_one_active_per_client
  on public.programs (client_id)
  where status = 'active';

create index programs_org_client_idx on public.programs (org_id, client_id);

create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  position int not null,
  name text not null,
  is_rest boolean not null default false,
  constraint program_days_position_unique unique (program_id, position),
  constraint program_days_position_check check (position >= 0 and position < 14),
  constraint program_days_name_length check (char_length(btrim(name)) between 1 and 80)
);

create index program_days_program_idx on public.program_days (program_id);

create table public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.program_days (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  position int not null,
  name text not null,
  sets int not null,
  reps text not null,
  notes text not null default '',
  video_url text,
  constraint program_exercises_position_unique unique (day_id, position),
  constraint program_exercises_sets_check check (sets between 1 and 20),
  constraint program_exercises_reps_length check (char_length(btrim(reps)) between 1 and 40),
  constraint program_exercises_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint program_exercises_notes_length check (char_length(notes) <= 280),
  constraint program_exercises_video_length check (video_url is null or char_length(video_url) <= 300),
  constraint program_exercises_video_url_check check (
    video_url is null or video_url ~* '^https?://'
  )
);

create index program_exercises_day_idx on public.program_exercises (day_id);
create index program_exercises_program_idx on public.program_exercises (program_id);

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  day_id uuid not null references public.program_days (id) on delete cascade,
  scheduled_on date not null,
  status text not null,
  skip_note text,
  flagged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_logs_status_check check (status in ('partial', 'done', 'skipped', 'missed')),
  constraint workout_logs_client_day_unique unique (client_id, scheduled_on),
  constraint workout_logs_skip_note_length check (skip_note is null or char_length(skip_note) <= 280)
);

create index workout_logs_client_date_idx on public.workout_logs (client_id, scheduled_on);
create index workout_logs_org_idx on public.workout_logs (org_id);

create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  day_id uuid not null references public.program_days (id) on delete cascade,
  exercise_id uuid not null references public.program_exercises (id) on delete cascade,
  scheduled_on date not null,
  status text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_logs_status_check check (status in ('partial', 'done')),
  constraint exercise_logs_unique unique (client_id, exercise_id, scheduled_on),
  constraint exercise_logs_note_length check (char_length(note) <= 280)
);

create index exercise_logs_client_date_idx on public.exercise_logs (client_id, scheduled_on);

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  exercise_log_id uuid not null references public.exercise_logs (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  set_index int not null,
  weight_kg numeric(10, 3) not null,
  reps int not null,
  created_at timestamptz not null default now(),
  constraint set_logs_unique unique (exercise_log_id, set_index),
  constraint set_logs_index_check check (set_index between 1 and 20),
  constraint set_logs_reps_check check (reps between 1 and 999),
  constraint set_logs_weight_check check (weight_kg >= 0 and weight_kg < 1000)
);

create index set_logs_client_idx on public.set_logs (client_id);

-- One row per offline flush. Replaying the same client_key is a no-op.
create table public.log_operations (
  client_key uuid primary key,
  org_id uuid not null references public.orgs (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  applied_at timestamptz not null default now(),
  constraint log_operations_kind_check check (kind in ('save_sets', 'skip_day'))
);

create table public.nudge_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  trainer_id uuid not null references auth.users (id),
  kind text not null,
  body text not null,
  push_status text not null default 'deferred',
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint nudge_events_kind_check check (kind in ('soft', 'nudge')),
  constraint nudge_events_push_check check (push_status = 'deferred'),
  constraint nudge_events_body_length check (char_length(btrim(body)) between 1 and 200)
);

create index nudge_events_client_idx on public.nudge_events (client_id, created_at desc);

create trigger workout_logs_touch_updated_at
  before update on public.workout_logs
  for each row
  execute function public.touch_updated_at();

create trigger exercise_logs_touch_updated_at
  before update on public.exercise_logs
  for each row
  execute function public.touch_updated_at();

comment on table public.programs is
  'One active program per client. Ticket 7 seeds demo programs. Assigning marks the previous row replaced.';
comment on column public.profiles.weight_unit is
  'Client preference. Set weights are stored in kilograms.';
comment on column public.nudge_events.push_status is
  'Always deferred in Ticket 2. Push delivery lands with chat.';

create or replace function public.assign_program(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  trainer_org uuid;
  target uuid;
  program_name text;
  start_on date;
  new_id uuid;
  old_id uuid;
  day_count int;
  day_index int;
  day_record jsonb;
  day_name text;
  day_rest boolean;
  new_day uuid;
  exercise_count int;
  exercise_index int;
  exercise_record jsonb;
  exercise_name text;
  exercise_sets int;
  exercise_reps text;
  exercise_notes text;
  exercise_video text;
begin
  if uid is null then
    raise exception 'Sign in before assigning a program.';
  end if;

  select m.org_id into trainer_org
  from public.memberships m
  where m.user_id = uid
    and m.role = 'trainer';

  if trainer_org is null then
    raise exception 'Only a coach can assign a program.';
  end if;

  begin
    target := (payload->>'clientId')::uuid;
  exception
    when others then
      raise exception 'That client is not on your roster.';
  end;

  program_name := btrim(coalesce(payload->>'name', ''));
  if char_length(program_name) < 1 or char_length(program_name) > 80 then
    raise exception 'Enter a program name.';
  end if;

  begin
    start_on := (payload->>'startDate')::date;
  exception
    when others then
      start_on := null;
  end;
  if start_on is null then
    raise exception 'Enter a start date.';
  end if;

  if not exists (
    select 1
    from public.memberships m
    where m.user_id = target
      and m.org_id = trainer_org
      and m.role = 'client'
  ) then
    raise exception 'That client is not on your roster.';
  end if;

  if jsonb_typeof(payload->'days') is distinct from 'array' then
    raise exception 'Add between 1 and 14 days.';
  end if;

  day_count := jsonb_array_length(payload->'days');
  if day_count < 1 or day_count > 14 then
    raise exception 'Add between 1 and 14 days.';
  end if;

  select p.id into old_id
  from public.programs p
  where p.client_id = target
    and p.status = 'active'
  for update;

  if old_id is not null then
    update public.programs
    set status = 'replaced',
        replaced_at = now()
    where id = old_id;
  end if;

  insert into public.programs (org_id, client_id, name, start_date, status, created_by)
  values (trainer_org, target, program_name, start_on, 'active', uid)
  returning id into new_id;

  for day_index in 0 .. day_count - 1 loop
    day_record := payload->'days'->day_index;
    day_name := btrim(coalesce(day_record->>'name', ''));
    day_rest := coalesce((day_record->>'rest')::boolean, false);
    if char_length(day_name) < 1 or char_length(day_name) > 80 then
      raise exception 'Enter a day name.';
    end if;

    if jsonb_typeof(day_record->'exercises') is distinct from 'array' then
      exercise_count := 0;
    else
      exercise_count := jsonb_array_length(day_record->'exercises');
    end if;

    if not day_rest and exercise_count < 1 then
      raise exception 'Add an exercise to each training day.';
    end if;

    insert into public.program_days (program_id, org_id, client_id, position, name, is_rest)
    values (new_id, trainer_org, target, day_index, day_name, day_rest)
    returning id into new_day;

    if day_rest then
      continue;
    end if;

    for exercise_index in 0 .. exercise_count - 1 loop
      exercise_record := day_record->'exercises'->exercise_index;
      exercise_name := btrim(coalesce(exercise_record->>'name', ''));
      exercise_reps := btrim(coalesce(exercise_record->>'reps', ''));
      exercise_notes := coalesce(exercise_record->>'notes', '');
      exercise_video := nullif(btrim(coalesce(exercise_record->>'videoUrl', '')), '');
      begin
        exercise_sets := (exercise_record->>'sets')::int;
      exception
        when others then
          exercise_sets := 0;
      end;

      if char_length(exercise_name) < 1 or char_length(exercise_name) > 80 then
        raise exception 'Enter an exercise name.';
      end if;
      if exercise_sets < 1 or exercise_sets > 20 then
        raise exception 'Sets must be between 1 and 20.';
      end if;
      if char_length(exercise_reps) < 1 or char_length(exercise_reps) > 40 then
        raise exception 'Enter the reps.';
      end if;
      if char_length(exercise_notes) > 280 then
        raise exception 'Keep notes under 280 characters.';
      end if;
      if exercise_video is not null and exercise_video !~* '^https?://' then
        raise exception 'Enter a video link that starts with https.';
      end if;
      if exercise_video is not null and char_length(exercise_video) > 300 then
        raise exception 'Enter a video link that starts with https.';
      end if;

      insert into public.program_exercises (
        day_id, program_id, org_id, client_id, position, name, sets, reps, notes, video_url
      ) values (
        new_day,
        new_id,
        trainer_org,
        target,
        exercise_index,
        exercise_name,
        exercise_sets,
        exercise_reps,
        exercise_notes,
        exercise_video
      );
    end loop;
  end loop;

  if old_id is not null then
    update public.programs
    set replaced_by = new_id
    where id = old_id;
  end if;

  return new_id;
end;
$$;

create or replace function public.apply_client_log(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  client_org uuid;
  key uuid;
  kind text;
  scheduled date;
  day uuid;
  program uuid;
  exercise uuid;
  prescribed int;
  note text;
  mark_done boolean;
  log_id uuid;
  set_count int;
  set_pos int;
  set_row jsonb;
  set_no int;
  set_reps int;
  set_weight numeric;
  filled int := 0;
  exercise_status text;
  day_exercise_count int;
  day_done_count int;
  workout_status text;
begin
  if uid is null then
    raise exception 'Sign in as a client to log a workout.';
  end if;

  select m.org_id into client_org
  from public.memberships m
  where m.user_id = uid
    and m.role = 'client';

  if client_org is null then
    raise exception 'Sign in as a client to log a workout.';
  end if;

  begin
    key := (payload->>'clientKey')::uuid;
  exception
    when others then
      key := null;
  end;

  kind := payload->>'kind';
  begin
    scheduled := (payload->>'scheduledOn')::date;
  exception
    when others then
      scheduled := null;
  end;

  if key is null or scheduled is null or kind not in ('save_sets', 'skip_day') then
    raise exception 'That log could not be saved.';
  end if;

  if exists (select 1 from public.log_operations where client_key = key) then
    return key;
  end if;

  note := btrim(coalesce(payload->>'note', ''));
  if char_length(note) > 280 then
    raise exception 'Keep the note under 280 characters.';
  end if;

  if kind = 'skip_day' then
    begin
      day := (payload->>'dayId')::uuid;
    exception
      when others then
        day := null;
    end;

    select d.program_id into program
    from public.program_days d
    join public.programs p on p.id = d.program_id
    where d.id = day
      and d.client_id = uid
      and p.status = 'active'
      and p.client_id = uid;

    if program is null then
      raise exception 'That day is not on your program.';
    end if;

    insert into public.workout_logs (
      org_id, client_id, program_id, day_id, scheduled_on, status, skip_note, flagged
    ) values (
      client_org, uid, program, day, scheduled, 'skipped', nullif(note, ''), true
    )
    on conflict (client_id, scheduled_on) do update
      set status = 'skipped',
          skip_note = excluded.skip_note,
          flagged = true,
          program_id = excluded.program_id,
          day_id = excluded.day_id,
          org_id = excluded.org_id;

    insert into public.log_operations (client_key, org_id, client_id, kind)
    values (key, client_org, uid, kind);

    return key;
  end if;

  begin
    exercise := (payload->>'exerciseId')::uuid;
  exception
    when others then
      exercise := null;
  end;

  mark_done := coalesce((payload->>'markDone')::boolean, false);

  select e.day_id, e.program_id, e.sets
    into day, program, prescribed
  from public.program_exercises e
  join public.programs p on p.id = e.program_id
  where e.id = exercise
    and e.client_id = uid
    and p.status = 'active'
    and p.client_id = uid;

  if day is null then
    raise exception 'That exercise is not on your program.';
  end if;

  if jsonb_typeof(payload->'sets') is distinct from 'array' then
    set_count := 0;
  else
    set_count := jsonb_array_length(payload->'sets');
  end if;

  insert into public.exercise_logs (
    org_id, client_id, program_id, day_id, exercise_id, scheduled_on, status, note
  ) values (
    client_org, uid, program, day, exercise, scheduled, 'partial', note
  )
  on conflict (client_id, exercise_id, scheduled_on) do update
    set note = excluded.note,
        program_id = excluded.program_id,
        day_id = excluded.day_id
  returning id into log_id;

  delete from public.set_logs where exercise_log_id = log_id;

  for set_pos in 0 .. greatest(set_count - 1, -1) loop
    exit when set_count = 0;
    set_row := payload->'sets'->set_pos;
    begin
      set_no := (set_row->>'index')::int;
      set_reps := (set_row->>'reps')::int;
      set_weight := (set_row->>'weightKg')::numeric;
    exception
      when others then
        raise exception 'That log could not be saved.';
    end;

    if set_reps < 1 then
      continue;
    end if;
    if set_no < 1 or set_no > prescribed then
      raise exception 'That set is not on this exercise.';
    end if;
    if set_weight is null or set_weight < 0 or set_weight >= 1000 then
      raise exception 'Enter a weight between 0 and 999.';
    end if;

    delete from public.set_logs as existing
    where existing.exercise_log_id = log_id
      and existing.set_index = set_no;

    insert into public.set_logs (exercise_log_id, org_id, client_id, set_index, weight_kg, reps)
    values (log_id, client_org, uid, set_no, set_weight, set_reps);
  end loop;

  select count(*) into filled
  from public.set_logs
  where exercise_log_id = log_id;

  if filled = 0 and not mark_done then
    raise exception 'Enter reps for at least one set.';
  end if;

  if mark_done or filled >= prescribed then
    exercise_status := 'done';
  else
    exercise_status := 'partial';
  end if;

  update public.exercise_logs
  set status = exercise_status
  where id = log_id;

  select count(*) into day_exercise_count
  from public.program_exercises
  where day_id = day;

  select count(*) into day_done_count
  from public.exercise_logs el
  where el.day_id = day
    and el.client_id = uid
    and el.scheduled_on = scheduled
    and el.status = 'done';

  if day_exercise_count > 0 and day_done_count >= day_exercise_count then
    workout_status := 'done';
  else
    workout_status := 'partial';
  end if;

  insert into public.workout_logs (
    org_id, client_id, program_id, day_id, scheduled_on, status, skip_note, flagged
  ) values (
    client_org, uid, program, day, scheduled, workout_status, null, false
  )
  on conflict (client_id, scheduled_on) do update
    set status = excluded.status,
        flagged = false,
        skip_note = null,
        program_id = excluded.program_id,
        day_id = excluded.day_id,
        org_id = excluded.org_id;

  insert into public.log_operations (client_key, org_id, client_id, kind)
  values (key, client_org, uid, kind);

  return key;
end;
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

  return new_id;
end;
$$;

create or replace function public.dismiss_nudge(nudge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  updated uuid;
begin
  if uid is null then
    raise exception 'That nudge is not on your account.';
  end if;

  update public.nudge_events
  set dismissed_at = coalesce(dismissed_at, now())
  where id = nudge_id
    and client_id = uid
  returning id into updated;

  if updated is null then
    raise exception 'That nudge is not on your account.';
  end if;
end;
$$;

alter table public.programs enable row level security;
alter table public.program_days enable row level security;
alter table public.program_exercises enable row level security;
alter table public.workout_logs enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.set_logs enable row level security;
alter table public.log_operations enable row level security;
alter table public.nudge_events enable row level security;

alter table public.programs force row level security;
alter table public.program_days force row level security;
alter table public.program_exercises force row level security;
alter table public.workout_logs force row level security;
alter table public.exercise_logs force row level security;
alter table public.set_logs force row level security;
alter table public.log_operations force row level security;
alter table public.nudge_events force row level security;

create policy programs_select on public.programs
  for select to authenticated
  using (
    public.is_trainer_of(org_id)
    or (client_id = auth.uid() and status = 'active')
  );

create policy program_days_select on public.program_days
  for select to authenticated
  using (
    public.is_trainer_of(org_id)
    or (
      client_id = auth.uid()
      and exists (
        select 1
        from public.programs p
        where p.id = program_id
          and p.status = 'active'
          and p.client_id = auth.uid()
      )
    )
  );

create policy program_exercises_select on public.program_exercises
  for select to authenticated
  using (
    public.is_trainer_of(org_id)
    or (
      client_id = auth.uid()
      and exists (
        select 1
        from public.programs p
        where p.id = program_id
          and p.status = 'active'
          and p.client_id = auth.uid()
      )
    )
  );

create policy workout_logs_select on public.workout_logs
  for select to authenticated
  using (public.is_trainer_of(org_id) or client_id = auth.uid());

create policy exercise_logs_select on public.exercise_logs
  for select to authenticated
  using (public.is_trainer_of(org_id) or client_id = auth.uid());

create policy set_logs_select on public.set_logs
  for select to authenticated
  using (public.is_trainer_of(org_id) or client_id = auth.uid());

create policy log_operations_select on public.log_operations
  for select to authenticated
  using (public.is_trainer_of(org_id) or client_id = auth.uid());

create policy nudge_events_select on public.nudge_events
  for select to authenticated
  using (public.is_trainer_of(org_id) or client_id = auth.uid());

revoke all on table public.programs from public, anon, authenticated;
revoke all on table public.program_days from public, anon, authenticated;
revoke all on table public.program_exercises from public, anon, authenticated;
revoke all on table public.workout_logs from public, anon, authenticated;
revoke all on table public.exercise_logs from public, anon, authenticated;
revoke all on table public.set_logs from public, anon, authenticated;
revoke all on table public.log_operations from public, anon, authenticated;
revoke all on table public.nudge_events from public, anon, authenticated;

grant select on table public.programs to authenticated;
grant select on table public.program_days to authenticated;
grant select on table public.program_exercises to authenticated;
grant select on table public.workout_logs to authenticated;
grant select on table public.exercise_logs to authenticated;
grant select on table public.set_logs to authenticated;
grant select on table public.log_operations to authenticated;
grant select on table public.nudge_events to authenticated;

revoke all on function public.assign_program(jsonb) from public;
revoke all on function public.apply_client_log(jsonb) from public;
revoke all on function public.send_nudge(uuid, text, text) from public;
revoke all on function public.dismiss_nudge(uuid) from public;

grant execute on function public.assign_program(jsonb) to authenticated;
grant execute on function public.apply_client_log(jsonb) to authenticated;
grant execute on function public.send_nudge(uuid, text, text) to authenticated;
grant execute on function public.dismiss_nudge(uuid) to authenticated;
