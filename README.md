# Manyfolds

Manyfolds is a counsellor-led school career-guidance workspace. This repository contains the staff-facing interface, with a daily priority queue, longitudinal student registry, follow-up surface, verified opportunity deadlines, and privacy-safe student summaries.

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
