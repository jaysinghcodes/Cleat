/** Ordered SQL files. Ticket 0 ships a stub; later tickets append migrations. */
export const MIGRATIONS = [
  "supabase/migrations/0001_init.sql",
  "supabase/migrations/0002_tenancy.sql",
  "supabase/migrations/0003_programs.sql",
  "supabase/migrations/0004_chat.sql",
  "supabase/migrations/0005_booking.sql",
  "supabase/migrations/0006_rag_audit.sql",
  "supabase/migrations/0007_inbox.sql",
] as const;

/** Ticket 7 inserts the demo org with this id. enable_demo_auto_send() turns auto send on for it only. */
export const DEMO_ORG_ID = "d1000000-0000-4000-8000-000000000001";

export type MigrationPath = (typeof MIGRATIONS)[number];
