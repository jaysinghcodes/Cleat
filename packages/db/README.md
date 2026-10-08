# @cleat/db

SQL migrations and the row-level security notes for Supabase Postgres.

- `supabase/migrations/0001_init.sql`: extensions (`pgcrypto`, `pgvector`)
- `supabase/migrations/0002_tenancy.sql`: orgs, profiles, memberships, invites, and RLS
- `supabase/migrations/0004_chat.sql`: threads, messages, push token storage, and RLS
- `supabase/RLS.md`: the policy list
- `scripts/cross-tenant-rls.sh`: proves a trainer cannot read another org and a client cannot read another client's rows, including chat

Cloning and running the apps does not need a Supabase project. Apply migrations when you create one; steps are in the root README.

```sh
pnpm --filter @cleat/db test:rls
```
