# Verified programme-data pilot

## Purpose

This pilot creates a reviewable official-source dataset large enough to test complete career-to-admission roadmaps without attempting to verify the full institution catalogue.

## Target scope

- 10–15 careers from the existing taxonomy
- 30–50 linked course records
- 100–200 exact institution-programme records
- Major connected Indian entrance examinations
- Relevant scholarships
- Current admission cycles where an official source is available

Priority domains are engineering and computer science, psychology, medicine and allied health, law, commerce/finance/economics, design, humanities and social sciences, and environmental/interdisciplinary programmes. Exact institutions are selected only after reviewing current product priorities, existing records, official-source accessibility, and the initial schools’ needs.

## Import rules

The CSV templates in `data/templates` are staging formats. An importer must:

1. accept only official institution, examination authority, government, counselling-body, or scholarship-provider URLs;
2. record source URL, domain, source date, and import timestamp;
3. create every imported fact as `pending_review`;
4. retain changes in `catalogue_verification_events`;
5. respect robots.txt, terms, rate limits, authentication, and CAPTCHAs;
6. never use search snippets or unofficial rankings as admissions truth;
7. never publish or enter AI evidence automatically.

## Review queues

The admin workflow separates missing programme relationships, eligibility, exams, admission cycles, fees, scholarships, stale records, and conflicting sources. An owner or admin can claim a task, open its official source, add notes, correct the relationship, and mark the result pending, verified, stale, conflicting, unavailable, or closed as appropriate.

Global catalogue facts remain separate from organisation-specific reviewer notes. Only verified, sufficiently complete, fresh records may enter an AI evidence package.

## Pilot completion gate

The pilot is ready for application-decision testing only when all ten programme fixtures pass: eligible PCM, missing subject, psychology alternatives, low-budget/local route, exam unwillingness, interdisciplinary route, stale cycle, missing fees, conflicting eligibility, and a complete career-to-admission journey.
