# Manyfolds AI-assisted roadmap architecture

## Boundary

The deterministic diagnostic and `buildMatches` recommendation engine remain the selection layer. AI does not choose colleges from memory and does not replace the existing roadmap. It receives a compact evidence package and returns a strict structured draft for counsellor review.

## Pipeline

1. Authenticated profile and selected deterministic recommendation
2. Server-derived organisation and role check
3. PII-minimised student summary
4. Verified career, course, programme, exam and scholarship retrieval
5. Deterministic eligibility result
6. Freshness assessment and verification-task queue
7. Evidence compaction and conservative token estimate
8. Cache lookup by profile/evidence/prompt/engine hash
9. Cheapest healthy model within the reviewed configured allowlist
10. One OpenRouter structured-output call
11. JSON-schema and factual-reference validation
12. Local removal or marking of unsupported content
13. Generation, usage, provenance and validation persistence
14. Counsellor edit, review, approval and publication

## Server-only secrets

`OPENROUTER_API_KEY` is read only by the Vite server plugin and server modules under `server/ai`. Browser code calls `/api/ai-roadmaps` with the current Supabase access token. No OpenRouter key, raw provider error, prompt, or hidden reasoning is returned.

## Budgets

- Maximum estimated input: 2,800 tokens
- Maximum completion: 1,700 tokens
- Absolute session total: 5,000 tokens
- Reserve: 500 tokens at the default limits
- Retry: at most one, using the same evidence and remaining combined session budget

The input estimator counts the system prompt, strict schema, and compact evidence. Reported reasoning tokens are included in total usage. The database also rejects a stored session above 5,000 tokens.

## Current-data policy

Database records are preferred. A record is fresh only when it is verified and neither expired nor older than the configured freshness window. Missing programme or cycle data creates an organisation-scoped verification task. `MANYFOLDS_LIVE_DATA_ENABLED` defaults to `false`; no general web search provider is active. Search snippets are never promoted to verified facts.

## Model governance

The OpenRouter catalogue is cached for 18 hours. Candidates must support structured output, an output-token limit, text input/output, and at least 5,000 context tokens. Free routers and non-text architectures are excluded. Only models named in the reviewed server configuration are eligible; catalogue price changes reorder that allowlist but cannot add a new model automatically.

Run `npm run ai:evaluate` to inspect the harness without provider calls. An explicit `npm run ai:evaluate:run` evaluates the configured models against ten fixed profiles and writes a local JSON report under `reports/`.

## Present data limitation

The imported database contains thousands of source-backed career/course/institution rows, but the verified institution-programme, eligibility, admission-route, fee and application-cycle tables are currently empty. Manyfolds therefore returns an insufficient-data eligibility result and does not ask AI to invent programme recommendations.
