-- One-time setup for the optional Supabase backend.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- The app stores customers, items and services as three JSONB rows in this
-- single kv_store table (mirrors the local JSON files, so no schema changes
-- are ever needed when the app's data model grows).

create table if not exists kv_store (
  key   text primary key,
  value jsonb not null
);

-- The app uses the service_role key (SUPABASE_SERVICE_ROLE_KEY env var),
-- which bypasses RLS by default, so no policies are required.
