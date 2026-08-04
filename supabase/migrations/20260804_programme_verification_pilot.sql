-- Manyfolds controlled programme-data verification pilot.
-- Imports remain pending until an authorised reviewer verifies official provenance.

alter table institution_programmes
  add column if not exists campus text,
  add column if not exists official_programme_url text,
  add column if not exists official_admissions_url text,
  add column if not exists source_domain text,
  add column if not exists source_date date,
  add column if not exists verified_by uuid references auth.users(id),
  add column if not exists verification_notes text;

alter table institution_programme_eligibility
  add column if not exists admission_cycle text,
  add column if not exists board_rules jsonb not null default '{}',
  add column if not exists age_rules text,
  add column if not exists domicile_rules text,
  add column if not exists nationality_rules text,
  add column if not exists category_specific_rules jsonb not null default '{}',
  add column if not exists portfolio_interview_audition text,
  add column if not exists official_source text,
  add column if not exists last_verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id);

alter table college_program_admission_routes
  add column if not exists direct_application_required boolean,
  add column if not exists counselling_body text,
  add column if not exists application_steps jsonb not null default '[]',
  add column if not exists admission_cycle text,
  add column if not exists last_verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id);

create table if not exists examination_cycles (
  id uuid primary key default gen_random_uuid(),
  exam_id text not null references exams(exam_id) on delete cascade,
  cycle_year text not null,
  registration_opening date,
  registration_deadline date,
  examination_date date,
  result_date date,
  counselling_dates jsonb not null default '[]',
  official_source text not null,
  verification_status text not null default 'pending_review'
    check (verification_status in ('pending_review','verified','stale','conflicting','archived')),
  last_verified_at timestamptz,
  verified_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id,cycle_year)
);

alter table college_program_costs
  add column if not exists hostel_amount numeric,
  add column if not exists mandatory_fees numeric,
  add column if not exists application_fee numeric,
  add column if not exists last_verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id);

alter table college_program_scholarships
  add column if not exists cycle_year text,
  add column if not exists last_verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id);

alter table source_verification_tasks
  add column if not exists task_type text,
  add column if not exists priority smallint not null default 3 check (priority between 1 and 5),
  add column if not exists claimed_by uuid references auth.users(id),
  add column if not exists claimed_at timestamptz,
  add column if not exists reviewer_notes text,
  add column if not exists conflict_notes text,
  add column if not exists updated_at timestamptz not null default now();

update source_verification_tasks
set task_type=case
  when lower(missing_field) like '%institution%course%' or lower(missing_field) like '%programme%' then 'missing_programme_relationship'
  when lower(missing_field) like '%eligib%' then 'missing_eligibility'
  when lower(missing_field) like '%exam%' then 'missing_exam'
  when lower(missing_field) like '%cycle%' or lower(missing_field) like '%deadline%' then 'missing_admission_cycle'
  when lower(missing_field) like '%fee%' or lower(missing_field) like '%cost%' then 'missing_fee'
  when lower(missing_field) like '%scholar%' then 'missing_scholarship'
  when lower(missing_field) like '%stale%' then 'stale_record'
  when lower(missing_field) like '%conflict%' then 'conflicting_source'
  else 'missing_programme_relationship'
end
where task_type is null;

alter table source_verification_tasks alter column task_type set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='source_verification_tasks_task_type_check'
  ) then
    alter table source_verification_tasks add constraint source_verification_tasks_task_type_check
      check (task_type in (
        'missing_programme_relationship','missing_eligibility','missing_exam',
        'missing_admission_cycle','missing_fee','missing_scholarship',
        'stale_record','conflicting_source'
      ));
  end if;
end
$$;

create table if not exists catalogue_verification_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  record_type text not null,
  record_id text not null,
  action text not null,
  previous_status text,
  next_status text,
  source_url text,
  notes text,
  change_payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists catalogue_record_notes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  record_type text not null,
  record_id text not null,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists verification_tasks_queue_idx
  on source_verification_tasks(organisation_id,task_type,status,priority,created_at);
create index if not exists verification_events_record_idx
  on catalogue_verification_events(record_type,record_id,created_at desc);
create index if not exists catalogue_notes_org_idx
  on catalogue_record_notes(organisation_id,record_type,record_id,created_at desc);
create index if not exists examination_cycles_freshness_idx
  on examination_cycles(exam_id,cycle_year,verification_status,last_verified_at);

alter table catalogue_verification_events enable row level security;
alter table catalogue_record_notes enable row level security;

drop policy if exists "organisation source task isolation" on source_verification_tasks;
drop policy if exists "members read verification tasks" on source_verification_tasks;
create policy "members read verification tasks" on source_verification_tasks
for select using (organisation_id=public.current_organisation_id());
drop policy if exists "admins manage verification tasks" on source_verification_tasks;
create policy "admins manage verification tasks" on source_verification_tasks
for all using (
  organisation_id=public.current_organisation_id()
  and public.current_organisation_role() in ('owner','admin')
) with check (
  organisation_id=public.current_organisation_id()
  and public.current_organisation_role() in ('owner','admin')
);

drop policy if exists "admins read verification events" on catalogue_verification_events;
create policy "admins read verification events" on catalogue_verification_events
for select using (
  organisation_id=public.current_organisation_id()
  and public.current_organisation_role() in ('owner','admin')
);

drop policy if exists "organisation catalogue notes" on catalogue_record_notes;
create policy "organisation catalogue notes" on catalogue_record_notes
for all using (organisation_id=public.current_organisation_id())
with check (organisation_id=public.current_organisation_id());

grant select on source_verification_tasks,catalogue_verification_events,catalogue_record_notes
  to authenticated;
grant insert,update on source_verification_tasks,catalogue_record_notes to authenticated;
