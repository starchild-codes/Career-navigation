# Manyfolds

Manyfolds is a counsellor-led school career-guidance workspace. This repository contains the staff-facing interface, with a daily priority queue, longitudinal student registry, follow-up surface, verified opportunity deadlines, and privacy-safe student summaries.

## AI-assisted roadmaps

Manyfolds can organise the existing deterministic recommendation and verified database evidence into a structured counsellor-reviewed roadmap through a server-only OpenRouter integration.

- Copy the documented variables from `.env.example` into `.env.local`.
- Keep `OPENROUTER_API_KEY` server-side. Never create a `VITE_OPENROUTER_API_KEY`.
- Configure only models that have passed the roadmap evaluation harness.
- Run `npm run ai:evaluate` for a zero-cost dry run.
- Run `npm run ai:evaluate:run` only after explicitly reviewing the configured models and expected cost.
- Apply `supabase/migrations/20260804_ai_roadmap_architecture.sql` before using generation.

The generator enforces 2,800 estimated input tokens, 1,700 output tokens, and a 5,000-token absolute session ceiling. Live retrieval is disabled by default. Missing or stale current data creates a verification task rather than becoming an unsourced claim.

## Run locally

```powershell
npm install
npm run dev
```

Use `npm run build` for a production bundle and `npm run lint` for static checks.

## Product boundaries

- Staff only: students and parents do not get accounts.
- Private counsellor notes must not appear in shareable summaries.
- Career information must be verified, sourced, and date-stamped before production publication.
- No deterministic career verdicts: the product supports counsellor judgement.

## Current implementation

The responsive React application runs at repository root and includes working navigation, student search, student creation, record detail, follow-up completion feedback, and shareable-summary feedback. It is set up as a UI foundation for the database-backed production workflows described in [Product_info.md](./Product_info.md).

## Production backend checklist

Before deploying real student records, add a relational database and enforce school-level isolation in database policies; implement staff authentication, audit logs, encrypted/signed document storage, CSV import validation and rollback, report exports, and the verified-content review workflow. Never put student data into front-end source files.
