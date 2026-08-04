# Manyfolds roadmap model evaluation

Evaluation date: 2026-08-04  
Prompt: `manyfolds-roadmap-v1` · Schema: `manyfolds-roadmap-schema-v1` · Harness: `manyfolds-roadmap-eval-v2`

Paid calls: 30. Measured provider cost: $0.000631. The first model’s per-call measurements were not retained after a local report-aggregation failure; its catalogue maximum is $0.000790. The conservative total evaluation-cost upper bound is therefore $0.001421.

| Model | Schema pass | Grounding pass | Constraint pass | Distinct profiles | Avg tokens | Avg cost | Avg latency | Approved |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| inclusionai/ling-2.6-flash | Not retained | Not retained | Not retained | Not retained | Not retained | ≤$0.000079 | Not retained | No |
| mistralai/mistral-nemo | 20% | 10% | 60% | 1/10 | 210 | $0.000012 | 15,690 ms | No |
| sao10k/l3-lunaris-8b | 60% | 0% | 60% | 5/10 | 1,069 | $0.000051 | 7,398 ms | No |

Approved primary: **None**  
Approved fallback: **None**

## Candidate findings

### inclusionai/ling-2.6-flash

The ten bounded calls were made, but their in-memory measurements were lost when the first version of the local distinctiveness aggregator compared a successful value with an empty failure value. The calls were not repeated, preserving the original 30-call cap. Without retained evidence for every mandatory metric, this candidate is ineligible for approval.

### mistralai/mistral-nemo

Its strongest behaviour was low measured token use and very low cost. Reliability was unacceptable: six requests returned rate limits, two timed out, schema validity was 20%, grounding validity was 10%, only one profile was materially distinct, and missing-data handling passed once. One structured response created unsupported backup-route relationships. It cannot safely support students or counsellors.

### sao10k/l3-lunaris-8b

It was faster and returned the requested schema more often, but failed grounding on every profile. It invented course, programme and exam IDs; added unsupported target dates; produced blank IDs; contradicted insufficient-data boundaries; and sometimes returned incomplete or invalid JSON. It also inserted programme-like and elite-route content despite having no verified programme evidence. Its interdisciplinary output was more varied than Nemo’s, but still only five profiles met the distinctiveness test.

Both measured models correctly stayed below the configured token ceiling. Neither handled insufficient college data at the required 100% rate.

## Next low-cost evaluation set

Do not evaluate these automatically. The smallest useful next reviewed set is:

1. `mistralai/mistral-small-24b-instruct-2501` — current maximum catalogue estimate $0.000276 per roadmap.
2. `qwen/qwen3.7-flash` — current maximum catalogue estimate $0.000305 per roadmap.
3. `openai/gpt-oss-20b` — current maximum catalogue estimate $0.000305 per roadmap.

These are recommended for a new controlled evaluation because they remain inexpensive while offering materially greater instruction-following capacity than the rejected candidates. They are not approved or configured for production.

## Capability boundary

Verified career-fit explanations, career exploration, subject and skill connections, trade-offs, alternatives, counsellor questions, immediate actions, and missing-data warnings are supported.

Institution-programme offerings, exact eligibility, compulsory subjects, accepted exams, current cycles, deadlines, fees, scholarship eligibility, admission probability, competitiveness categories, and exact course-to-college relationships are not supported without verified programme-level records.

The JSON report contains per-profile validation, usage, cost, latency, constraint, grounding and distinctiveness metrics. It stores no prompts, chain-of-thought, raw provider responses, secrets, or private student records.
