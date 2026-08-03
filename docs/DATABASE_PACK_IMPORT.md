# Manyfolds large database-pack import

Imported on 24 July 2026 from `career_compass_large_database_pack`.

## Commands

```powershell
npm run data:import-pack              # validate only
npm run data:import-pack -- --apply   # transactional, idempotent import
node scripts/db-inspect.mjs           # live schema and row counts
```

The importer reads `DATABASE_URL` only from the ignored `.env.local` file. It uses CSV headers as explicit field mappings, imports parents before relationship tables, chunks inserts in groups of 250, and rolls the transaction back on a failure. Primary/composite keys prevent duplicate imports.

## Production data states

- Career taxonomy: official NCO title data; enrichment remains editorial work.
- Institutions: legacy AISHE-origin discovery data; all records retain `needs_current_reverification` and must not make current recognition claims.
- Courses: structured pathway seeds; availability and eligibility are not institution-level claims.
- Exams and scholarships: cycle dates remain blank until a staff editor verifies a current official source.
- Links: discovery suggestions, never deterministic recommendations.
