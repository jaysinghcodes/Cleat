# Row level security

Ticket 1 enables RLS in `migrations/0002_tenancy.sql`. Later tables follow the same rules.

## Model (v1)

One org is one trainer. There is no franchise or team RBAC. A user belongs to exactly one org. Clients do not see other clients.

| Role | What they can see |
| --- | --- |
| `trainer` | Rows in their own org, from the web desk |
| `client` | Their own profile, their own membership, their org, and the trainer profile in that org. Not another client's profile, membership, logs, chat, program, or bookings |
| `anon` | No table access. `invite_preview(invite_id)` returns the coach name, org name, expiry, and status for one token |
| `system` | Background jobs. Uses the service role on the server, never the anon key |

`SUPABASE_SERVICE_ROLE` bypasses RLS. Keep it in server env only. Never put it in `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`. The web and mobile apps do not read it.

## Tables

| Table | RLS | Policies |
| --- | --- | --- |
| `profiles` | on, forced | `profiles_select` (`can_read_profile`), `profiles_update_own` (`id = auth.uid()`) |
| `orgs` | on, forced | `orgs_select_member` (`is_member_of`), `orgs_update_trainer` (`is_trainer_of` and `created_by = auth.uid()`) |
| `memberships` | on, forced | `memberships_select_own` (`user_id = auth.uid()`), `memberships_select_trainer` (`is_trainer_of`) |
| `invites` | on, forced | `invites_select_trainer`, `invites_insert_trainer` (`is_trainer_of` and `created_by = auth.uid()`) |
| `programs` | on, forced | `programs_select` (trainer of `org_id`, or the client when `status = active`) |
| `program_days` | on, forced | `program_days_select` (trainer, or the client on the active program) |
| `program_exercises` | on, forced | `program_exercises_select` (trainer, or the client on the active program) |
| `workout_logs` | on, forced | `workout_logs_select` (trainer, or `client_id = auth.uid()`) |
| `exercise_logs` | on, forced | `exercise_logs_select` (trainer, or `client_id = auth.uid()`) |
| `set_logs` | on, forced | `set_logs_select` (trainer, or `client_id = auth.uid()`) |
| `log_operations` | on, forced | `log_operations_select` (trainer, or `client_id = auth.uid()`) |
| `nudge_events` | on, forced | `nudge_events_select` (trainer, or `client_id = auth.uid()`) |
| `threads` | on, forced | `threads_select` (trainer of `org_id`, or `client_id = auth.uid()` in that org) |
| `messages` | on, forced | `messages_select` (`can_read_thread`). No insert grant. `post_message` writes |
| `push_tokens` | on, forced | `push_tokens_select_own`, `push_tokens_insert_own`, `push_tokens_update_own`, `push_tokens_delete_own` (`user_id = auth.uid()`). A trainer cannot read a client's token |

There is no insert policy on `profiles`, `orgs`, or `memberships`. Those writes go through `create_trainer_org` and `accept_invite`, which are `security definer` and granted to `authenticated` only. Invites expire within 7 days (`invites_expire_within_7_days`). There is no update or delete grant on `invites`, so a trainer cannot extend a link. `accept_invite` marks a link used.

`can_read_profile` allows:

- the signed in user to read their own profile
- a trainer to read profiles of members in their org
- a client to read the trainer profile in their org

A client cannot read another client's profile. Helper functions are `security definer` so policy checks do not recurse through membership RLS. They only answer questions about `auth.uid()`.

## Functions

| Function | Who can execute | Purpose |
| --- | --- | --- |
| `create_trainer_org(display_name, org_name, timezone)` | `authenticated` | Creates the profile, org, and `role = trainer` membership. Returns the existing org if the user already belongs to one |
| `accept_invite(invite_id, display_name, timezone)` | `authenticated` | Rejects missing, expired, and used links. Creates `role = client` in that org only |
| `invite_preview(invite_id)` | `anon`, `authenticated` | Invite screen data for one token |
| `current_membership()` | `authenticated` | The caller's org, role, display name, and timezone |
| `my_coach()` | `authenticated` | The trainer name and org name for a client |
| `is_trainer_of`, `is_member_of`, `can_read_profile` | `authenticated` | Policy helpers |
| `assign_program(payload)` | `authenticated` | Trainer replaces the client's active program |
| `apply_client_log(payload)` | `authenticated` | Client saves sets or skips a day. The same `clientKey` applies once |
| `send_nudge(target_client, nudge_kind, body)` | `authenticated` | Trainer writes a nudge. `push_status` stays `deferred` |
| `dismiss_nudge(nudge_id)` | `authenticated` | Client hides their own nudge banner |
| `can_read_thread(thread_id)` | `authenticated` | True for the trainer of that thread's org, or the client who owns it |
| `ensure_thread(target_client)` | `authenticated` | Opens the one thread for a roster client. A client can only open their own |
| `post_message(target_client, message_body)` | `authenticated` | Stores one plain text message in that thread. Rejects an empty body and a body over 4000 characters |
| `thread_previews()` | `authenticated` | Latest message per visible thread. Runs as the caller so RLS applies |

User facing exceptions from these functions:

- `Sign in before creating a desk.`
- `Sign in before accepting an invite.`
- `Enter your name.`
- `Enter your gym or brand name.`
- `Enter a timezone.`
- `This invite link is not valid.`
- `This invite has expired. Ask your coach for a new link.`
- `This invite has already been used.`
- `Trainer accounts cannot join a roster as a client.`
- `This account already belongs to another org.`
- `Sign in before sending a message.`
- `Write a message first.`
- `Keep the message under 4000 characters.`
- `You can only message your coach.`
- `That client is not on your roster.`

## Rules for later migrations

1. Enable RLS on every table in the migration that creates it. Do not add a table and leave policies for a follow-up.
2. Trainer policies match `org_id` to the signed in trainer's membership (`auth.uid()`).
3. Client policies match the signed in user to their own rows only. A client cannot read another client's logs, chat, program, or bookings.
4. RAG chunk queries filter `org_id` to the current org. Program chunks also filter `client_id` to the asking client. No cross tenant vector search.
5. Storage paths stay under `org/{org_id}/kb/...` and `org/{org_id}/clients/{client_id}/...`.
6. Prefer `security definer` helpers when a policy would otherwise read a table that also has RLS.

## Proof

`scripts/cross-tenant-rls.sh` applies every file in `migrations/` in order (`0001_init.sql`, `0002_tenancy.sql`, `0003_programs.sql`, `0004_chat.sql`), then `tests/cross_tenant_rls.sql` and `tests/chat_rls.sql`. On a machine without Docker it uses plain Postgres and `tests/plain_postgres_auth_stub.sql` so `auth.uid()` still drives the policies. Chat reads are limited to the caller's thread. `messages` is added to the `supabase_realtime` publication when that publication exists. Push token rows are readable only by the user who owns the device. This migration does not send push notifications.
