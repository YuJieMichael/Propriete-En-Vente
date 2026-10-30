-- Applied through the connected migration tool as 20261016153220.
-- Hosted Supabase extensions; these are not available in disposable PGlite.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
