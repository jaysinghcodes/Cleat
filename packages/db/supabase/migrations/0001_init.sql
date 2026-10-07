-- Cleat 0001_init
-- Ticket 0 stub. No product tables yet.
-- Later tickets add orgs, memberships, programs, logs, messages, chunks, and audit rows.
-- Every product table enables row level security in the same migration that creates it.
-- Policy model: ../RLS.md
--
-- Applying this file needs a Postgres database with pgvector (Supabase provides both).
-- A fresh clone of this repo does not need a database.

create extension if not exists pgcrypto;
create extension if not exists vector;
