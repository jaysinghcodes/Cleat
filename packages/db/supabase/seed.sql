-- Cleat demo seed (Ticket 7). Idempotent: run it twice and the counts stay the same.
-- Org d1000000-0000-4000-8000-000000000001 is Rivera Strength.
-- Alex Rivera is the coach. Auto send turns on only for this org, via enable_demo_auto_send().
-- seed_inbox_tier() inserts the knee pain P0. It is owner and service_role only.
-- This file does not embed chunks. `pnpm seed` fills those with the same embedder the server uses.

create or replace function public.seed_demo_auth_user(uid uuid, user_email text)
returns void
language plpgsql
as $fn$
declare
  has_instance boolean;
  has_identities boolean;
  crypt_schema text;
  hash text;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = 'instance_id'
  ) into has_instance;

  if has_instance then
    select n.nspname into crypt_schema
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'crypt'
    order by case n.nspname when 'extensions' then 0 when 'public' then 1 else 2 end
    limit 1;

    if crypt_schema is null then
      raise exception 'pgcrypto crypt() is required to seed auth users.';
    end if;

    execute format('select %I.crypt($1, %I.gen_salt(''bf''))', crypt_schema, crypt_schema)
      into hash
      using user_email;

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      uid,
      'authenticated',
      'authenticated',
      user_email,
      hash,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    on conflict (id) do update
      set email = excluded.email,
          email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at);
  else
    insert into auth.users (id, email)
    values (uid, user_email)
    on conflict (id) do update
      set email = excluded.email;
  end if;

  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'auth'
      and table_name = 'identities'
  ) into has_identities;

  if has_identities then
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      uid,
      uid,
      jsonb_build_object('sub', uid::text, 'email', user_email, 'email_verified', true),
      'email',
      uid::text,
      now(),
      now(),
      now()
    )
    on conflict do nothing;
  end if;
end;
$fn$;

do $seed$
declare
  demo_org uuid := 'd1000000-0000-4000-8000-000000000001';
  demo_trainer uuid := 'd1100000-0000-4000-8000-000000000001';
  sam_id uuid := 'd1200000-0000-4000-8000-000000000001';
  jordan_id uuid := 'd1200000-0000-4000-8000-000000000002';
  morgan_id uuid := 'd1200000-0000-4000-8000-000000000003';
  casey_id uuid := 'd1200000-0000-4000-8000-000000000004';
  riley_id uuid := 'd1200000-0000-4000-8000-000000000005';
  invite_id uuid := 'd1300000-0000-4000-8000-000000000001';
  sam_program uuid := 'd1400000-0000-4000-8000-000000000001';
  jordan_program uuid := 'd1400000-0000-4000-8000-000000000002';
  casey_program uuid := 'd1400000-0000-4000-8000-000000000003';
  morgan_program uuid := 'd1400000-0000-4000-8000-000000000004';
  riley_program uuid := 'd1400000-0000-4000-8000-000000000005';
  session_id uuid := 'd1700000-0000-4000-8000-000000000001';
  audit_id uuid := 'd1900000-0000-4000-8000-000000000001';
  sam_message uuid := 'd1800000-0000-4000-8000-000000000001';
  sam_reply uuid := 'd1800000-0000-4000-8000-000000000002';
  jordan_message uuid := 'd1800000-0000-4000-8000-000000000003';
  jordan_reply uuid := 'd1800000-0000-4000-8000-000000000004';
  morgan_message uuid := 'd1800000-0000-4000-8000-000000000005';
  morgan_reply uuid := 'd1800000-0000-4000-8000-000000000006';
  thread_sam uuid := 'd1600000-0000-4000-8000-000000000001';
  thread_jordan uuid := 'd1600000-0000-4000-8000-000000000002';
  thread_morgan uuid := 'd1600000-0000-4000-8000-000000000003';
  thread_casey uuid := 'd1600000-0000-4000-8000-000000000004';
  thread_riley uuid := 'd1600000-0000-4000-8000-000000000005';
  demo_today date;
  stamp timestamptz := now();
  session_start timestamptz;
  foundation jsonb := $json$[
    {"name":"Lower A","exercises":[
      {"name":"Back squat","sets":3,"reps":"8","notes":"Brace before you descend."},
      {"name":"Romanian deadlift","sets":3,"reps":"8","notes":"Soft knees, flat back."},
      {"name":"Walking lunge","sets":2,"reps":"10","notes":"Short steps."}
    ]},
    {"name":"Upper","exercises":[
      {"name":"Bench press","sets":3,"reps":"8","notes":"Feet planted."},
      {"name":"Barbell row","sets":3,"reps":"8","notes":"Pause at the hip."},
      {"name":"Overhead press","sets":3,"reps":"6","notes":"Ribs down."}
    ]},
    {"name":"Full body","exercises":[
      {"name":"Goblet squat","sets":3,"reps":"10","notes":"Elbows inside the knees."},
      {"name":"Push up","sets":3,"reps":"8","notes":"Body in one line."},
      {"name":"Hip hinge","sets":3,"reps":"10","notes":"Light and smooth."}
    ]}
  ]$json$::jsonb;
  hypertrophy jsonb := $json$[
    {"name":"Upper A","exercises":[
      {"name":"Bench press","sets":4,"reps":"8","notes":"Control the descent."},
      {"name":"Incline dumbbell press","sets":3,"reps":"10","notes":"Stop short of lockout."},
      {"name":"Lateral raise","sets":3,"reps":"12","notes":"Soft elbows."}
    ]},
    {"name":"Lower A","exercises":[
      {"name":"Back squat","sets":4,"reps":"8","notes":"Even stance."},
      {"name":"Leg press","sets":3,"reps":"10","notes":"Do not lock the knees hard."},
      {"name":"Leg curl","sets":3,"reps":"12","notes":"Pause at the bottom."}
    ]},
    {"name":"Upper B","exercises":[
      {"name":"Overhead press","sets":4,"reps":"8","notes":"Glutes tight."},
      {"name":"Lat pulldown","sets":3,"reps":"10","notes":"Chest up."},
      {"name":"Face pull","sets":3,"reps":"15","notes":"Hands finish by the ears."}
    ]},
    {"name":"Lower B","exercises":[
      {"name":"Romanian deadlift","sets":4,"reps":"8","notes":"Hinge, do not squat it."},
      {"name":"Split squat","sets":3,"reps":"8","notes":"Front heel stays down."},
      {"name":"Calf raise","sets":3,"reps":"12","notes":"Pause at the top."}
    ]}
  ]$json$::jsonb;
  plan record;
  day_item jsonb;
  exercise_item jsonb;
  day_index int;
  exercise_index int;
  new_day uuid;
  new_exercise uuid;
  log_id uuid;
  ai_body text := $ai$From your coach's notes: Open Today for the day name, sets, and reps.$ai$;
  client_count int;
  invite_count int;
  done_count int;
  skip_count int;
  partial_count int;
  article_count int;
  session_count int;
  block_count int;
  message_count int;
  injury_count int;
begin
  demo_today := (timezone('America/Chicago', now()))::date;
  session_start := ((demo_today+1)::timestamp+time '09:00') at time zone 'America/Chicago';

  perform public.seed_demo_auth_user(demo_trainer, 'alex.rivera@cleat.demo');
  perform public.seed_demo_auth_user(sam_id, 'sam.lee@cleat.demo');
  perform public.seed_demo_auth_user(jordan_id, 'jordan.kim@cleat.demo');
  perform public.seed_demo_auth_user(morgan_id, 'morgan.patel@cleat.demo');
  perform public.seed_demo_auth_user(casey_id, 'casey.torres@cleat.demo');
  perform public.seed_demo_auth_user(riley_id, 'riley.wong@cleat.demo');

  insert into public.profiles (id, display_name, timezone)
  values
    (demo_trainer, 'Alex Rivera', 'America/Chicago'),
    (sam_id, 'Sam Lee', 'America/Chicago'),
    (jordan_id, 'Jordan Kim', 'America/Chicago'),
    (morgan_id, 'Morgan Patel', 'America/Chicago'),
    (casey_id, 'Casey Torres', 'America/Chicago'),
    (riley_id, 'Riley Wong', 'America/Chicago')
  on conflict (id) do update
    set display_name = excluded.display_name,
        timezone = excluded.timezone;

  insert into public.orgs (id, name, created_by)
  values (demo_org, 'Rivera Strength', demo_trainer)
  on conflict (id) do update
    set name = excluded.name;

  insert into public.memberships (org_id, user_id, role)
  values
    (demo_org, demo_trainer, 'trainer'),
    (demo_org, sam_id, 'client'),
    (demo_org, jordan_id, 'client'),
    (demo_org, morgan_id, 'client'),
    (demo_org, casey_id, 'client'),
    (demo_org, riley_id, 'client')
  on conflict (user_id) do nothing;

  perform public.enable_demo_auto_send();

  update public.trainer_settings
  set slot_minutes = 45
  where user_id = demo_trainer;

  insert into public.invites (id, org_id, created_by, created_at, expires_at)
  values (invite_id, demo_org, demo_trainer, stamp, stamp+interval '7 days')
  on conflict (id) do update
    set created_by = excluded.created_by,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at,
        accepted_at = null,
        accepted_by = null;

  create temporary table demo_program_plan (
    program_id uuid,
    client_id uuid,
    program_name text,
    start_on date,
    days jsonb
  ) on commit drop;

  insert into demo_program_plan (program_id, client_id, program_name, start_on, days)
  values
    (sam_program, sam_id, 'Foundation 3-day', demo_today, foundation),
    (jordan_program, jordan_id, 'Foundation 3-day', demo_today, foundation),
    (casey_program, casey_id, 'Foundation 3-day', demo_today, foundation),
    (morgan_program, morgan_id, 'Hypertrophy 4-day', demo_today, hypertrophy),
    (riley_program, riley_id, 'Hypertrophy 4-day', demo_today-4, hypertrophy);

  for plan in select * from demo_program_plan loop
    insert into public.programs (id, org_id, client_id, name, start_date, status, created_by)
    values (plan.program_id, demo_org, plan.client_id, plan.program_name, plan.start_on, 'active', demo_trainer)
    on conflict (id) do update
      set name = excluded.name,
          start_date = excluded.start_date,
          status = 'active',
          client_id = excluded.client_id;
  end loop;

  -- Reset rehearsal state for this org only, then rebuild the same demo rows.
  delete from public.held_drafts where org_id = demo_org;
  delete from public.trainer_notices where org_id = demo_org;
  delete from public.inbox_items where org_id = demo_org;
  delete from public.audit_events where org_id = demo_org;
  delete from public.messages where org_id = demo_org;
  delete from public.sessions where org_id = demo_org;
  delete from public.nudge_events where org_id = demo_org;
  delete from public.log_operations where org_id = demo_org;
  delete from public.set_logs where org_id = demo_org;
  delete from public.exercise_logs where org_id = demo_org;
  delete from public.workout_logs where org_id = demo_org;
  delete from public.program_exercises where org_id = demo_org;
  delete from public.program_days where org_id = demo_org;

  for plan in select * from demo_program_plan loop
    day_index := 0;
    for day_item in select value from jsonb_array_elements(plan.days) loop
      insert into public.program_days (program_id, org_id, client_id, position, name, is_rest)
      values (plan.program_id, demo_org, plan.client_id, day_index, day_item->>'name', false)
      returning id into new_day;

      exercise_index := 0;
      for exercise_item in select value from jsonb_array_elements(day_item->'exercises') loop
        insert into public.program_exercises (
          day_id, program_id, org_id, client_id, position, name, sets, reps, notes
        ) values (
          new_day,
          plan.program_id,
          demo_org,
          plan.client_id,
          exercise_index,
          exercise_item->>'name',
          (exercise_item->>'sets')::int,
          exercise_item->>'reps',
          coalesce(exercise_item->>'notes', '')
        );
        exercise_index := exercise_index+1;
      end loop;
      day_index := day_index+1;
    end loop;
  end loop;

  insert into public.workout_logs (org_id, client_id, program_id, day_id, scheduled_on, status, skip_note, flagged)
  select org_id, client_id, program_id, id, demo_today, 'done', null, false
  from public.program_days
  where program_id in (sam_program, morgan_program)
    and position = 0;

  insert into public.workout_logs (org_id, client_id, program_id, day_id, scheduled_on, status, skip_note, flagged)
  select org_id, client_id, program_id, id, demo_today, 'partial', null, false
  from public.program_days
  where program_id = casey_program
    and position = 0;

  insert into public.workout_logs (org_id, client_id, program_id, day_id, scheduled_on, status, skip_note, flagged)
  select org_id, client_id, program_id, id, demo_today, 'skipped', 'Travel day', true
  from public.program_days
  where program_id = jordan_program
    and position = 0;

  for new_exercise in
    select e.id
    from public.program_exercises e
    join public.program_days d on d.id = e.day_id
    where d.program_id in (sam_program, morgan_program)
      and d.position = 0
  loop
    insert into public.exercise_logs (
      org_id, client_id, program_id, day_id, exercise_id, scheduled_on, status
    )
    select e.org_id, e.client_id, e.program_id, e.day_id, e.id, demo_today, 'done'
    from public.program_exercises e
    where e.id = new_exercise
    returning id into log_id;

    insert into public.set_logs (exercise_log_id, org_id, client_id, set_index, weight_kg, reps)
    select log_id, e.org_id, e.client_id, g.set_index, 60, 8
    from public.program_exercises e
    cross join lateral generate_series(1, e.sets) as g(set_index)
    where e.id = new_exercise;
  end loop;

  insert into public.exercise_logs (
    org_id, client_id, program_id, day_id, exercise_id, scheduled_on, status
  )
  select e.org_id, e.client_id, e.program_id, e.day_id, e.id, demo_today, 'done'
  from public.program_exercises e
  join public.program_days d on d.id = e.day_id
  where d.program_id = casey_program
    and d.position = 0
    and e.position = 0
  returning id into log_id;

  insert into public.set_logs (exercise_log_id, org_id, client_id, set_index, weight_kg, reps)
  select log_id, e.org_id, e.client_id, g.set_index, 40, 8
  from public.program_exercises e
  cross join lateral generate_series(1, e.sets) as g(set_index)
  where e.day_id = (
    select id from public.program_days where program_id = casey_program and position = 0
  )
    and e.position = 0;

  insert into public.kb_articles (id, org_id, title, category, body, created_by)
  values
    (
      'd1500000-0000-4000-8000-000000000001',
      demo_org,
      'Injury and pain policy',
      'safety',
      $kb$If a set causes pain, stop that exercise. Do not keep loading a painful joint. Cleat does not diagnose injuries or tell you how to treat them. Message your coach and check with a medical professional if you are hurting.$kb$,
      demo_trainer
    ),
    (
      'd1500000-0000-4000-8000-000000000002',
      demo_org,
      'What is on my program today',
      'faq',
      $kb$What is on my program today? Open Today for the day name, sets, and reps.$kb$,
      demo_trainer
    ),
    (
      'd1500000-0000-4000-8000-000000000003',
      demo_org,
      'How to book or cancel',
      'faq',
      $kb$How do I book or cancel a session? Open the Book tab, pick an open slot, and cancel from that session before the cutoff.$kb$,
      demo_trainer
    ),
    (
      'd1500000-0000-4000-8000-000000000004',
      demo_org,
      'How does a deload week work',
      'faq',
      $kb$How does a deload week work? Keep the same exercises and use lighter weights. Your coach assigns the deload week.$kb$,
      demo_trainer
    ),
    (
      'd1500000-0000-4000-8000-000000000005',
      demo_org,
      'Hard refusal rule',
      'rules',
      $kb$The assistant refuses injury, pain, medication, and emergency messages. It sends a fixed safety reply and alerts the coach. It does not invent treatment advice.$kb$,
      demo_trainer
    )
  on conflict (id) do update
    set title = excluded.title,
        category = excluded.category,
        body = excluded.body;

  insert into public.availability_blocks (
    id, org_id, trainer_id, weekday, start_minute, end_minute, available
  )
  select
    ('d1710000-0000-4000-8000-00000000000' || g.weekday::text)::uuid,
    demo_org,
    demo_trainer,
    g.weekday,
    480,
    1080,
    true
  from generate_series(0, 6) as g(weekday)
  on conflict (id) do update
    set start_minute = excluded.start_minute,
        end_minute = excluded.end_minute,
        available = excluded.available,
        weekday = excluded.weekday;

  insert into public.sessions (
    id, org_id, trainer_id, client_id, starts_at, ends_at, status
  ) values (
    session_id,
    demo_org,
    demo_trainer,
    sam_id,
    session_start,
    session_start+interval '45 minutes',
    'booked'
  )
  on conflict (id) do update
    set starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        status = 'booked',
        cancelled_at = null,
        cancelled_by = null,
        client_id = excluded.client_id;

  insert into public.calendar_tokens (id, user_id, org_id, nonce)
  values
    (
      'd1720000-0000-4000-8000-000000000001',
      demo_trainer,
      demo_org,
      'd1000000d1000000d1000000d1000000d1000000d1000000d1000000d1000000'
    ),
    (
      'd1720000-0000-4000-8000-000000000002',
      sam_id,
      demo_org,
      'd1200000d1200000d1200000d1200000d1200000d1200000d1200000d1200000'
    )
  on conflict (id) do nothing;

  insert into public.threads (id, org_id, client_id)
  values
    (thread_sam, demo_org, sam_id),
    (thread_jordan, demo_org, jordan_id),
    (thread_morgan, demo_org, morgan_id),
    (thread_casey, demo_org, casey_id),
    (thread_riley, demo_org, riley_id)
  on conflict (org_id, client_id) do nothing;

  insert into public.messages (id, thread_id, org_id, sender_id, body, kind, sources, created_at)
  values
    (
      sam_message,
      thread_sam,
      demo_org,
      sam_id,
      'What is on my program today?',
      'human',
      '[]'::jsonb,
      stamp-interval '2 hours'
    ),
    (
      sam_reply,
      thread_sam,
      demo_org,
      demo_trainer,
      ai_body,
      'ai',
      jsonb_build_array(jsonb_build_object(
        'title', 'What is on my program today',
        'articleId', 'd1500000-0000-4000-8000-000000000002'
      )),
      stamp-interval '2 hours'+interval '1 second'
    ),
    (
      jordan_message,
      thread_jordan,
      demo_org,
      jordan_id,
      'Still training today, just later than planned.',
      'human',
      '[]'::jsonb,
      stamp-interval '90 minutes'
    ),
    (
      jordan_reply,
      thread_jordan,
      demo_org,
      demo_trainer,
      'Log the sets when you finish. No rush.',
      'human',
      '[]'::jsonb,
      stamp-interval '80 minutes'
    ),
    (
      morgan_message,
      thread_morgan,
      demo_org,
      morgan_id,
      'Upper day felt strong.',
      'human',
      '[]'::jsonb,
      stamp-interval '50 minutes'
    ),
    (
      morgan_reply,
      thread_morgan,
      demo_org,
      demo_trainer,
      'Nice work. Keep the same weights next time.',
      'human',
      '[]'::jsonb,
      stamp-interval '40 minutes'
    )
  on conflict (id) do update
    set body = excluded.body,
        kind = excluded.kind,
        sources = excluded.sources;

  insert into public.audit_events (
    id, org_id, client_id, message_id, chunks, draft_text, confidence, threshold,
    reason_codes, decision, template_id, delivered_at, final_text, model, prompt_version, created_at
  ) values (
    audit_id,
    demo_org,
    sam_id,
    sam_message,
    '[]'::jsonb,
    ai_body,
    0.91,
    0.85,
    '{}',
    'auto_send',
    null,
    stamp-interval '2 hours'+interval '1 second',
    ai_body,
    'cleat-canned-scorer',
    '4-rag-v1',
    stamp-interval '2 hours'+interval '1 second'
  )
  on conflict (message_id) do update
    set draft_text = excluded.draft_text,
        final_text = excluded.final_text,
        decision = excluded.decision,
        confidence = excluded.confidence;

  if not exists (
    select 1
    from public.inbox_items
    where org_id = demo_org
      and client_id = casey_id
      and priority = 'p0'
      and status = 'open'
      and template_id = 'medical_safety'
  ) then
    perform public.seed_inbox_tier(demo_org, casey_id, 'p0_injury');
  end if;

  select count(*) into client_count
  from public.memberships
  where org_id = demo_org and role = 'client';
  if client_count <> 5 then
    raise exception 'demo roster count is %', client_count;
  end if;

  select count(*) into invite_count
  from public.invites
  where org_id = demo_org and accepted_at is null;
  if invite_count <> 1 then
    raise exception 'demo pending invite count is %', invite_count;
  end if;

  if not exists (
    select 1 from public.ai_settings where org_id = demo_org and auto_send = true
  ) then
    raise exception 'demo auto send is off';
  end if;

  if not exists (
    select 1 from public.trainer_settings where user_id = demo_trainer and slot_minutes = 45
  ) then
    raise exception 'demo slots are not 45 minutes';
  end if;

  select count(*) into article_count from public.kb_articles where org_id = demo_org;
  if article_count <> 5 then
    raise exception 'demo article count is %', article_count;
  end if;

  select count(*) into done_count
  from public.workout_logs
  where org_id = demo_org and scheduled_on = demo_today and status = 'done';
  if done_count <> 2 then
    raise exception 'demo done count is %', done_count;
  end if;

  select count(*) into skip_count
  from public.workout_logs
  where org_id = demo_org and scheduled_on = demo_today and status = 'skipped' and flagged;
  if skip_count <> 1 then
    raise exception 'demo skipped count is %', skip_count;
  end if;

  select count(*) into partial_count
  from public.workout_logs
  where client_id = casey_id and scheduled_on = demo_today and status = 'partial';
  if partial_count <> 1 then
    raise exception 'demo partial count is %', partial_count;
  end if;

  if exists (
    select 1 from public.workout_logs where client_id = riley_id and scheduled_on = demo_today
  ) then
    raise exception 'Riley should have no log today';
  end if;

  select count(*) into session_count
  from public.sessions
  where org_id = demo_org and status = 'booked';
  if session_count <> 1 then
    raise exception 'demo booked session count is %', session_count;
  end if;

  select count(*) into block_count
  from public.availability_blocks blocks
  where blocks.trainer_id = demo_trainer and blocks.available;
  if block_count <> 7 then
    raise exception 'demo availability count is %', block_count;
  end if;

  select count(*) into message_count from public.messages where org_id = demo_org;
  if message_count <> 8 then
    raise exception 'demo message count is %', message_count;
  end if;

  select count(*) into injury_count
  from public.inbox_items
  where org_id = demo_org
    and client_id = casey_id
    and priority = 'p0'
    and status = 'open'
    and template_id = 'medical_safety';
  if injury_count <> 1 then
    raise exception 'demo injury inbox count is %', injury_count;
  end if;

  if (
    select count(*) from public.programs where org_id = demo_org and name = 'Foundation 3-day' and status = 'active'
  ) <> 3 then
    raise exception 'Foundation 3-day count drifted';
  end if;

  if (
    select count(*) from public.programs where org_id = demo_org and name = 'Hypertrophy 4-day' and status = 'active'
  ) <> 2 then
    raise exception 'Hypertrophy 4-day count drifted';
  end if;

  if (select display_name from public.profiles where id = demo_trainer) <> 'Alex Rivera' then
    raise exception 'trainer name drifted';
  end if;

  if (select name from public.orgs where id = demo_org) <> 'Rivera Strength' then
    raise exception 'org name drifted';
  end if;
end;
$seed$;

revoke all on function public.seed_demo_auth_user(uuid, text) from public;
drop function public.seed_demo_auth_user(uuid, text);
