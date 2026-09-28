-- TEST DOUBLE ONLY. This file is for disposable PostgreSQL/PGlite databases.
-- Never run against a Supabase project: auth/storage already exist there.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
grant usage on schema auth, storage, public to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key,
  email varchar(255),
  email_confirmed_at timestamptz
);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt()->>'sub', '')::uuid;
$$;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  owner_id text,
  metadata jsonb,
  unique(bucket_id, name)
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
grant all on storage.objects, storage.buckets to service_role;
grant select on storage.buckets to authenticated;

-- This test double represents Storage's SQL tables, not its HTTP implementation:
-- MIME/byte upload enforcement and signed URLs must additionally be smoke-tested
-- against real local/staging Supabase Storage before a production launch.
