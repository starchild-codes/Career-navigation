-- Manyfolds AI-assisted roadmap generation, organisation isolation, provenance and usage.
-- OpenRouter calls remain server-side. No prompt or hidden reasoning is stored.

create extension if not exists pgcrypto;

create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists organisation_memberships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','counsellor','teacher','viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organisation_id,user_id)
);

create or replace function public.current_organisation_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organisation_id
  from organisation_memberships
  where user_id = auth.uid() and active
  order by created_at
  limit 1
$$;

create or replace function public.current_organisation_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from organisation_memberships
  where user_id = auth.uid() and active
  order by created_at
  limit 1
$$;

create or replace function public.bootstrap_manyfolds_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into organisations(name,slug)
  values (
    coalesce(new.raw_user_meta_data->>'full_name',split_part(coalesce(new.email,'Manyfolds user'),'@',1)) || ' workspace',
    'workspace-' || replace(new.id::text,'-','')
  )
  returning id into new_org_id;
  insert into organisation_memberships(organisation_id,user_id,role)
  values(new_org_id,new.id,'owner');
  return new;
end
$$;

drop trigger if exists on_manyfolds_auth_user_created on auth.users;
create trigger on_manyfolds_auth_user_created
after insert on auth.users
for each row execute function public.bootstrap_manyfolds_user();

do $$
declare
  user_row record;
  new_org_id uuid;
begin
  for user_row in
    select id,email,raw_user_meta_data from auth.users u
    where not exists (
      select 1 from organisation_memberships m where m.user_id=u.id and m.active
    )
  loop
    insert into organisations(name,slug)
    values (
      coalesce(user_row.raw_user_meta_data->>'full_name',split_part(coalesce(user_row.email,'Manyfolds user'),'@',1)) || ' workspace',
      'workspace-' || replace(user_row.id::text,'-','')
    )
    returning id into new_org_id;
    insert into organisation_memberships(organisation_id,user_id,role)
    values(new_org_id,user_row.id,'owner');
  end loop;
end
$$;

create table if not exists ai_model_catalogue (
  model_id text primary key,
  display_name text,
  context_length integer,
  prompt_price_per_token numeric,
  completion_price_per_token numeric,
  request_fee numeric,
  supported_parameters text[] not null default '{}',
  architecture jsonb not null default '{}',
  estimated_roadmap_cost numeric,
  available boolean not null default true,
  fetched_at timestamptz not null default now(),
  raw_metadata jsonb not null default '{}'
);

create table if not exists ai_model_allowlist (
  model_id text primary key references ai_model_catalogue(model_id) on delete cascade,
  enabled boolean not null default false,
  review_status text not null default 'pending_review'
    check (review_status in ('pending_review','approved','rejected')),
  max_prompt_price_per_token numeric,
  max_completion_price_per_token numeric,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  notes text
);

create table if not exists ai_model_health (
  model_id text primary key,
  healthy boolean not null default true,
  last_successful_call timestamptz,
  recent_schema_validity_rate numeric,
  recent_latency_ms integer,
  recent_failure_rate numeric,
  consecutive_failures integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists ai_model_evaluations (
  id uuid primary key default gen_random_uuid(),
  model_id text not null,
  harness_version text not null,
  report jsonb not null,
  passed boolean not null,
  total_tokens integer,
  estimated_cost numeric,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists roadmap_evidence_snapshots (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  student_external_id text not null,
  recommendation_run_id uuid references recommendation_runs(id) on delete set null,
  evidence_hash text not null,
  evidence jsonb not null,
  input_token_estimate integer not null,
  created_at timestamptz not null default now(),
  unique (organisation_id,student_external_id,evidence_hash)
);

create table if not exists roadmap_generations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  student_external_id text not null,
  counsellor_id uuid not null references auth.users(id),
  recommendation_run_id uuid references recommendation_runs(id) on delete set null,
  student_roadmap_id uuid references student_roadmaps(id) on delete set null,
  evidence_snapshot_id uuid not null references roadmap_evidence_snapshots(id),
  generation_hash text not null,
  prompt_version text not null,
  engine_version text not null,
  roadmap jsonb not null,
  status text not null default 'draft'
    check (status in ('draft','reviewed','approved','published','rejected','failed')),
  counsellor_notes text,
  model_generated_notice text not null,
  source_status_summary jsonb not null default '{}',
  schema_valid boolean not null,
  factual_validation_valid boolean not null,
  validation_errors jsonb not null default '[]',
  generated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (organisation_id,student_external_id,generation_hash)
);

create table if not exists ai_generation_sessions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  student_external_id text not null,
  counsellor_id uuid not null references auth.users(id),
  roadmap_generation_id uuid references roadmap_generations(id) on delete set null,
  model_requested text,
  model_used text,
  provider text,
  prompt_version text not null,
  evidence_snapshot_id uuid references roadmap_evidence_snapshots(id),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  reasoning_tokens integer not null default 0,
  total_tokens integer not null default 0 check (total_tokens <= 5000),
  estimated_cost numeric,
  reported_cost numeric,
  live_search_used boolean not null default false,
  live_search_count integer not null default 0 check (live_search_count between 0 and 1),
  schema_valid boolean,
  factual_validation_valid boolean,
  validation_errors jsonb not null default '[]',
  retry_count integer not null default 0 check (retry_count between 0 and 1),
  latency_ms integer,
  status text not null,
  generated_at timestamptz not null default now()
);

create table if not exists ai_usage_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  session_id uuid not null references ai_generation_sessions(id) on delete cascade,
  model_id text,
  attempt smallint not null check (attempt between 1 and 2),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  reasoning_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost numeric,
  reported_cost numeric,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists ai_validation_failures (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  session_id uuid references ai_generation_sessions(id) on delete cascade,
  roadmap_generation_id uuid references roadmap_generations(id) on delete cascade,
  validation_stage text not null,
  errors jsonb not null,
  repaired_locally boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists source_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references organisations(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  source_url text not null,
  source_domain text not null,
  source_type text not null,
  admission_cycle text,
  effective_from date,
  expires_at date,
  last_checked_at timestamptz,
  last_verified_at timestamptz,
  verified_by uuid references auth.users(id),
  verification_status text not null
    check (verification_status in ('verified','pending_review','stale','conflicting','unavailable','archived')),
  content_hash text,
  supersedes_record_id uuid references source_records(id),
  confidence numeric check (confidence between 0 and 1),
  notes text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (organisation_id,entity_type,entity_id,source_url,admission_cycle)
);

create table if not exists roadmap_generation_sources (
  roadmap_generation_id uuid not null references roadmap_generations(id) on delete cascade,
  source_record_id uuid not null references source_records(id),
  supplied_record_id text not null,
  primary key (roadmap_generation_id,source_record_id,supplied_record_id)
);

create table if not exists source_verification_tasks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  entity_type text not null,
  entity_id text,
  missing_field text not null,
  official_domain text,
  narrow_query text,
  status text not null default 'pending_review'
    check (status in ('pending_review','in_progress','verified','unavailable','closed')),
  live_lookup_used boolean not null default false,
  result_source_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists organisation_memberships_user_idx on organisation_memberships(user_id,active);
create index if not exists roadmap_generation_cache_idx on roadmap_generations(organisation_id,student_external_id,generation_hash);
create index if not exists ai_sessions_org_idx on ai_generation_sessions(organisation_id,generated_at desc);
create index if not exists source_records_freshness_idx on source_records(entity_type,entity_id,verification_status,expires_at);
create index if not exists source_tasks_org_idx on source_verification_tasks(organisation_id,status,created_at desc);

alter table organisations enable row level security;
alter table organisation_memberships enable row level security;
alter table roadmap_evidence_snapshots enable row level security;
alter table roadmap_generations enable row level security;
alter table ai_generation_sessions enable row level security;
alter table ai_usage_records enable row level security;
alter table ai_validation_failures enable row level security;
alter table source_records enable row level security;
alter table roadmap_generation_sources enable row level security;
alter table source_verification_tasks enable row level security;
alter table student_profiles enable row level security;
alter table student_roadmaps enable row level security;
alter table student_roadmap_steps enable row level security;
alter table student_roadmap_notes enable row level security;

drop policy if exists "members read own organisation" on organisations;
create policy "members read own organisation" on organisations
for select using (id=public.current_organisation_id());

drop policy if exists "members read own membership" on organisation_memberships;
create policy "members read own membership" on organisation_memberships
for select using (user_id=auth.uid());

drop policy if exists "organisation evidence isolation" on roadmap_evidence_snapshots;
create policy "organisation evidence isolation" on roadmap_evidence_snapshots
for all using (organisation_id=public.current_organisation_id())
with check (organisation_id=public.current_organisation_id());

drop policy if exists "organisation generation isolation" on roadmap_generations;
create policy "organisation generation isolation" on roadmap_generations
for all using (organisation_id=public.current_organisation_id())
with check (organisation_id=public.current_organisation_id());

drop policy if exists "organisation session isolation" on ai_generation_sessions;
create policy "organisation session isolation" on ai_generation_sessions
for select using (organisation_id=public.current_organisation_id());

drop policy if exists "organisation usage isolation" on ai_usage_records;
create policy "organisation usage isolation" on ai_usage_records
for select using (organisation_id=public.current_organisation_id());

drop policy if exists "organisation validation isolation" on ai_validation_failures;
create policy "organisation validation isolation" on ai_validation_failures
for select using (organisation_id=public.current_organisation_id());

drop policy if exists "source records own or global" on source_records;
create policy "source records own or global" on source_records
for select using (organisation_id is null or organisation_id=public.current_organisation_id());

drop policy if exists "organisation source task isolation" on source_verification_tasks;
create policy "organisation source task isolation" on source_verification_tasks
for all using (organisation_id=public.current_organisation_id())
with check (organisation_id=public.current_organisation_id());

drop policy if exists "student profiles organisation isolation" on student_profiles;
create policy "student profiles organisation isolation" on student_profiles
for all using (organisation_id=public.current_organisation_id()::text)
with check (organisation_id=public.current_organisation_id()::text);

drop policy if exists "student roadmaps organisation isolation" on student_roadmaps;
create policy "student roadmaps organisation isolation" on student_roadmaps
for all using (organisation_id=public.current_organisation_id()::text)
with check (organisation_id=public.current_organisation_id()::text);

drop policy if exists "roadmap steps organisation isolation" on student_roadmap_steps;
create policy "roadmap steps organisation isolation" on student_roadmap_steps
for all using (
  exists (
    select 1 from student_roadmaps r
    where r.id=student_roadmap_steps.roadmap_id
      and r.organisation_id=public.current_organisation_id()::text
  )
) with check (
  exists (
    select 1 from student_roadmaps r
    where r.id=student_roadmap_steps.roadmap_id
      and r.organisation_id=public.current_organisation_id()::text
  )
);

drop policy if exists "roadmap notes organisation isolation" on student_roadmap_notes;
create policy "roadmap notes organisation isolation" on student_roadmap_notes
for all using (
  exists (
    select 1 from student_roadmaps r
    where r.id=student_roadmap_notes.roadmap_id
      and r.organisation_id=public.current_organisation_id()::text
  )
) with check (
  exists (
    select 1 from student_roadmaps r
    where r.id=student_roadmap_notes.roadmap_id
      and r.organisation_id=public.current_organisation_id()::text
  )
);

grant select on organisations,organisation_memberships to authenticated;
grant select,insert,update on roadmap_generations,roadmap_evidence_snapshots,source_verification_tasks to authenticated;
grant select on source_records to authenticated;
