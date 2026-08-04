# Llama 3.3 70B grounding root-cause analysis

Original run: `6470d6ff-ef42-4f4c-b0b4-f4f8feb740a8` using `manyfolds-roadmap-v1` / `manyfolds-roadmap-schema-v1`.

## Rejected records

| Profile | Generated field | Generated text retained in safe output | Source IDs | Evidence | Validator rule | Classification |
|---|---|---|---|---|---|---|
| `class12-pcm-engineering` | `stages[0].target_date` | Stage: “Gather Information on Programmes and Eligibility”; description: “Research and gather verified records on programmes, eligibility, admission cycles, fees, and scholarships for Applied Engineering.” | `[]` | Only `career:career-engineering`; no programme, cycle, exam, cost, scholarship, or relationship record. | Any non-null `target_date` required an admission-cycle source. | Validator false positive / schema ambiguity. This was a general planning date, not an admissions fact. |
| `psychology-computing` | `stages[0].target_date` | Stage: “Gather Verified Programme Information”; description: “Collect verified institution-programme, eligibility, admission-cycle, fee, and scholarship records…” | `[career:career-ux]` | Only `career:career-ux`; no programme, cycle, exam, cost, scholarship, or relationship record. | Any non-null `target_date` required an admission-cycle source. | Validator false positive / schema ambiguity. This was a general planning date, not an admissions fact. |

The old evaluation store retained only sanitized structured output, so the exact original date string is not recoverable for these two historical calls. It did retain the original field context and rejection rule. New runs retain server-only `raw_output` and `validation_events`, including the original path, value, declared type, IDs, rule, decision, sanitized value, and cause classification.

## Audit findings and corrections

- Career, course, programme, and exam IDs were separate fields but their relationship was implicit. Evidence now carries explicit verified relationship records.
- Catalogue option and backup-route entries now require `relationship_ids`; validators require the correct relation type before accepting a course, programme, exam, or combined backup route.
- General student reasoning remains separate from catalogue claims. Empty catalogue sections and “insufficient verified relationship data” are permitted and preferred when relations are absent.
- The prior date field was ambiguous. It is now `suggested_target_date`, `verified_deadline`, and `date_type`.
- A date is grounded by its declared type, not merely by being non-null. Planning suggestions can be unsourced; verified deadlines must exactly match a supplied verified admission-cycle record and its source IDs.
- The validator rejects known deadline wording in the planning field and preserves the raw value for audit while removing it from safe output.

## Post-fix outcome

Targeted regression run `c6646b02-f687-4396-a1e0-11950098febe`: four calls, all 100% schema, grounding, constraints, missing-data handling, and token compliance.

Full run `09cc5bab-c92b-40e5-b0a2-4592147a4152`: grounding was 100%, but only 8/10 outputs were materially distinct. Llama remains rejected; no generation enablement was performed.
