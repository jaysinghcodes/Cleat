/** Ordered SQL files. Ticket 0 ships a stub; later tickets append migrations. */
export const MIGRATIONS = ["supabase/migrations/0001_init.sql"] as const;

export type MigrationPath = (typeof MIGRATIONS)[number];
