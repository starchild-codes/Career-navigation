-- Durable, per-call checkpointing for paid roadmap-model evaluations.
-- These server-side operational records are intentionally not exposed to client roles.

create table if not exists ai_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  harness_version text not null,
  prompt_version text not null,
  schema_version text not null,
  candidate_models text[] not null,
  profile_ids text[] not null,
  preflight jsonb not null,
  status text not null default 'in_progress'
    check (status in ('in_progress','complete','failed','aggregated')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  aggregated_at timestamptz,
  report_path text
);

create table if not exists ai_evaluation_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references ai_evaluation_runs(id) on delete cascade,
  model_id text not null,
  profile_id text not null,
  sequence integer not null,
  status text not null default 'in_progress'
    check (status in ('in_progress','complete','failed')),
  evidence_hash text not null,
  evidence_input_estimate integer not null,
  actual_model_used text,
  raw_provider_usage jsonb not null default '{}',
  structured_output jsonb,
  raw_output_hash text,
  native_schema_valid boolean,
  repaired_schema_valid boolean,
  factual_valid boolean,
  validation_errors jsonb not null default '[]',
  safety jsonb not null default '{}',
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  reasoning_tokens integer not null default 0,
  total_tokens integer not null default 0,
  reported_cost numeric,
  estimated_cost numeric,
  latency_ms integer,
  retry_count integer not null default 0 check (retry_count = 0),
  provider_error_status integer,
  provider_error text,
  completed_at timestamptz,
  unique (run_id,model_id,profile_id)
);

create index if not exists ai_evaluation_calls_run_idx
  on ai_evaluation_calls(run_id,sequence);
