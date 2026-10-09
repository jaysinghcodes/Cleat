# @cleat/db

SQL migrations and the row-level security notes for Supabase Postgres.

- `supabase/migrations/0001_init.sql`: extensions (`pgcrypto`, `pgvector`)
- `supabase/migrations/0002_tenancy.sql`: orgs, profiles, memberships, invites, and RLS
- `supabase/migrations/0003_programs.sql`: programs, set logs, nudge events, weight unit, and RLS
- `supabase/migrations/0004_chat.sql`: threads, messages, push token storage, and RLS
- `supabase/migrations/0005_booking.sql`: availability, sessions, ICS tokens, optional Google credentials, and RLS
- `supabase/migrations/0006_rag_audit.sql`: knowledge articles, chunks, AI settings, audit, held drafts, inbox items, in app notices, and RLS
- `supabase/migrations/0007_inbox.sql`: unanswered window, P2 and P3 inbox tiers, nudge chat, seed hook, and RLS helpers
- `supabase/RLS.md`: the policy list
- `scripts/cross-tenant-rls.sh`: proves a trainer cannot read another org and a client cannot read another client's rows, including chat and bookings
- `supabase/seed.sql`: idempotent Rivera Strength demo rows. `src/seed.ts` runs that file, then writes embeddings.

Cloning and running the apps does not need a Supabase project. Apply migrations when you create one; steps are in the root README.

From the repo root, after local Postgres is up:

```sh
pnpm seed
```

`pnpm seed` is idempotent. Run it twice and the printed counts stay the same. It uses `DATABASE_URL` when set, otherwise `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Docker is required only for that default local URL (`127.0.0.1:54322` or `localhost:54322`). A hosted database or another port does not need Docker. Leave `OPENAI_API_KEY` unset and the chunks use the offline hash embedder. The service role key is not required for the seed.

```sh
pnpm --filter @cleat/db test:rls
```
