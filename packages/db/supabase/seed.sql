-- Local seed applied by `supabase db reset` after the migrations.
-- Ticket 1 creates the trainer, the invite, and the client through the apps.
-- Ticket 2 leaves programs, logs, and nudges empty.
-- Ticket 7 (#9) seeds demo programs into programs, program_days, and program_exercises.
-- Ticket 7 must insert the demo org as d1000000-0000-4000-8000-000000000001
-- (Alex Rivera, Rivera Strength). This turns auto send ON for that org only.
-- Orgs created in the app stay OFF.
select public.enable_demo_auto_send();
