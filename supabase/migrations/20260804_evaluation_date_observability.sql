alter table ai_evaluation_calls
  add column if not exists raw_output text,
  add column if not exists validation_events jsonb not null default '[]';

comment on column ai_evaluation_calls.raw_output is 'Server-only pre-validation model response retained for evaluation audit; never client-exposed.';
comment on column ai_evaluation_calls.validation_events is 'Structured validator decisions retaining original and sanitised values.';
