-- Private counsellor-owned drafts. These are intentionally separate from the shared verified knowledge base.
create table if not exists counsellor_private_records (
  id uuid primary key default gen_random_uuid(),
  counsellor_external_id text not null,
  record_type text not null check (record_type in ('student','course','college','scholarship')),
  external_key text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(counsellor_external_id,record_type,external_key)
);
create index if not exists counsellor_private_records_scope_idx on counsellor_private_records(counsellor_external_id,record_type,updated_at desc);
