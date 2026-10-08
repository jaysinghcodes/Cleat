/** Ordered SQL files. Ticket 0 ships a stub; later tickets append migrations. */
export const MIGRATIONS = [
  "supabase/migrations/0001_init.sql",
  "supabase/migrations/0002_tenancy.sql",
  "supabase/migrations/0003_programs.sql",
] as const;

export type MigrationPath = (typeof MIGRATIONS)[number];
