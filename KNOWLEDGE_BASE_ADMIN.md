# Knowledge-base administration

1. Create a source-backed draft, including official URL and explicit cycle year where applicable.
2. Check duplicate candidates by name, aliases and source URL.
3. Attach relationships instead of duplicating descriptive text.
4. Publish only after an authorised reviewer checks the source; set `last_verified_at` and `next_review_at`.
5. Import annual examination and scholarship updates into `exam_cycles`; never overwrite a previous cycle.
6. Organisation records remain private. Duplicate a system record to customise it—do not edit system records.

CSV imports should validate source URLs, scopes, dates and duplicate slugs before a confirmed batch. The frontend currently provides a local-first prototype only; apply the database migration and an authenticated server service before handling real student data.
