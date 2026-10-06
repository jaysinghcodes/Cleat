# Row level security (placeholder)

Ticket 0 does not create product tables, so this migration has no policies. Ticket 1 adds the first tables and turns RLS on in that migration.

## Model (v1)

One org is one trainer. There is no franchise or team RBAC. Every product row carries `org_id`. A client belongs to exactly one org.

| Role | What they can see |
| --- | --- |
| `trainer` | Rows in their own org, from the web desk |
| `client` | Their profile, assigned program, own logs, own chat thread, and own bookings, from the mobile app |
| `system` | Background jobs. Uses the service role on the server, never the anon key |

## Rules for later migrations

1. Enable RLS on every table in the migration that creates it. Do not add a table and leave policies for a follow-up.
2. Trainer policies match `org_id` to the signed-in trainer's membership (`auth.uid()`).
3. Client policies match the signed-in user to their own rows only. A client cannot read another client's logs, chat, program, or bookings.
4. RAG chunk queries filter `org_id` to the current org. Program chunks also filter `client_id` to the asking client. No cross-tenant vector search.
5. Storage paths stay under `org/{org_id}/kb/...` and `org/{org_id}/clients/{client_id}/...`.
6. `SUPABASE_SERVICE_ROLE` bypasses RLS. Keep it in server env only. Never put it in `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`.

## Not in `0001_init.sql`

No `create table` and no `create policy` until Ticket 1. The init migration only enables `pgcrypto` and `pgvector` so later tickets have a starting point.
