# AI roadmap capability matrix

The roadmap model may organise and explain only records supplied in the verified evidence package. It must not fill gaps from model memory.

## Supported with currently verified data

| Capability | Current status | Required evidence |
|---|---|---|
| Career-fit explanations | Supported | Verified career taxonomy record and student profile |
| Career exploration roadmap | Supported | Verified career record |
| Subject and skill connections | Supported | Student-reported subjects and skills |
| Broad course direction | Conditional | A verified course record linked to the career |
| Counsellor questions and next actions | Supported | Student context and explicit missing-data warnings |
| Career alternatives and trade-offs | Supported | Supplied verified alternatives |
| Missing-data warnings | Supported | Evidence-package completeness checks |

## Not safe without verified programme-level data

The system must not assert that an institution offers a programme, exact programme eligibility, compulsory school subjects, accepted entrance examinations, current admission cycles, deadlines, fees, scholarship eligibility, admission probability, competitiveness categories, or exact course-to-college relationships unless those facts and their official source records are supplied as verified evidence.

When programme evidence is incomplete, the interface must say:

- Career guidance is available, but verified course, college, and admission details are incomplete.
- This roadmap does not include programme-specific admission guidance until institution-course records are verified.
- A counsellor must review or add verified programme information before the section is used for an application decision.

Stale, conflicting, pending-review, unavailable, and archived records are excluded from AI evidence packages.
