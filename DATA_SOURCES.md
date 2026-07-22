# Knowledge-base data sources

Accessed 22 July 2026. The initial core uses only official sources and intentionally avoids copying volatile eligibility, fees, rankings and deadlines.

| Source | Used for | Update expectation | Limitation |
|---|---|---|---|
| [UGC university directory](https://www.ugc.gov.in/universitydetails/university) | Institution verification/discovery | Periodic | Does not replace each institution’s admissions notice. |
| [National Testing Agency](https://nta.ac.in/) | NTA examination ownership | Every admission cycle | Cycle dates must be imported as `exam_cycles`. |
| [JEE Advanced](https://jeeadv.ac.in/) | JEE Advanced cycle/official links | Every cycle | Organising institute and rules change annually. |
| [National Scholarship Portal](https://scholarships.gov.in/) | Scholarship scheme discovery | Each application cycle | Scheme eligibility and deadlines are volatile. |
| [AICTE](https://www.aicte-india.org/) | Technical education context | Periodic | Institution/course approval must be checked at source. |
| [Indian Nursing Council](https://www.indiannursingcouncil.org/) | Nursing pathway context | Periodic | Regulatory requirements require current confirmation. |
| [ICAR](https://icar.gov.in/) | Agriculture pathway context | Periodic | Programme-specific admissions are institution-controlled. |

No scraped or synthetic records are represented as verified. Records lacking a fresh programme-level official source are marked `needs_review`.
