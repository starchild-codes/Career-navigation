-- Run in a Supabase/PostgreSQL project after the existing organisations and profiles tables exist.
create type knowledge_scope as enum ('system','organisation');
create type knowledge_status as enum ('draft','published','archived');
create type verification_state as enum ('verified','needs_review','community_added');
create type knowledge_kind as enum ('career','course','college','exam','scholarship');

create table knowledge_records (
  id uuid primary key default gen_random_uuid(), kind knowledge_kind not null, slug text not null,
  name text not null, short_description text, full_description text,
  record_scope knowledge_scope not null default 'organisation', organisation_id uuid references organisations(id),
  status knowledge_status not null default 'draft', verification_status verification_state not null default 'community_added',
  source_name text, source_url text, additional_sources jsonb not null default '[]', last_verified_at timestamptz,
  next_review_at timestamptz, created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
  search_keywords text, notes text, is_featured boolean not null default false, metadata jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
  check ((record_scope = 'system' and organisation_id is null) or (record_scope = 'organisation' and organisation_id is not null)),
  unique (record_scope, organisation_id, slug)
);
create table knowledge_relationships (from_id uuid references knowledge_records(id) on delete cascade, to_id uuid references knowledge_records(id) on delete cascade, relationship_type text not null, primary key(from_id,to_id,relationship_type));
create table exam_cycles (id uuid primary key default gen_random_uuid(), exam_id uuid not null references knowledge_records(id) on delete cascade, cycle_year integer not null, application_open date, application_close date, exam_dates daterange, result_date date, official_notification_url text, status knowledge_status not null default 'draft', last_verified_at timestamptz, unique(exam_id,cycle_year));
create table student_knowledge_plans (id uuid primary key default gen_random_uuid(), student_id uuid not null references students(id) on delete cascade, knowledge_id uuid not null references knowledge_records(id), organisation_id uuid not null references organisations(id), status text not null check(status in ('exploring','interested','shortlisted','applying','completed','not_pursuing')), counsellor_note text, target_date date, created_by uuid references auth.users(id), created_at timestamptz not null default now());
create index knowledge_records_search_idx on knowledge_records using gin (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(search_keywords,'') || ' ' || coalesce(short_description,'')));
create index knowledge_records_scope_idx on knowledge_records(record_scope, organisation_id, status, verification_status);
create index knowledge_review_idx on knowledge_records(next_review_at) where archived_at is null;

alter table knowledge_records enable row level security;
-- Replace public.current_organisation_id() with the existing authenticated-org helper before production.
create policy "system and own organisation records are readable" on knowledge_records for select using (record_scope='system' or organisation_id = public.current_organisation_id());
create policy "organisation staff create own records" on knowledge_records for insert with check (record_scope='organisation' and organisation_id = public.current_organisation_id());
create policy "organisation staff update own records" on knowledge_records for update using (record_scope='organisation' and organisation_id = public.current_organisation_id()) with check (record_scope='organisation' and organisation_id = public.current_organisation_id());
create policy "organisation staff read own plans" on student_knowledge_plans for all using (organisation_id = public.current_organisation_id()) with check (organisation_id = public.current_organisation_id());
