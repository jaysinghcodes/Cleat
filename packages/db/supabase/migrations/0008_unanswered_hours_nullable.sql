-- Cleat 0008_unanswered_hours_nullable
-- NULL means the org has not saved a window. The server then uses
-- INBOX_UNANSWERED_HOURS, then 4. Rows still equal to the old default of 4
-- become NULL so that env value can apply. A trainer who deliberately saved 4
-- is cleared too. That is acceptable for this prototype.

alter table public.orgs alter column unanswered_hours drop default;
alter table public.orgs alter column unanswered_hours drop not null;

update public.orgs
set unanswered_hours = null
where unanswered_hours = 4;

comment on column public.orgs.unanswered_hours is
  'Hours before an unanswered client message is a P2 inbox item. NULL uses the server default.';
