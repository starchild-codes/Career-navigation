# Career Compass — Product Information and Build Specification

## 0. Mandatory Repository Instructions for Codex

This document is the source of truth for rebuilding Career Compass.

### Work in the existing repository only

The existing Git-connected project folder is:

```powershell
PS C:\Users\anshi\OneDrive\เอกสาร\Career-navigation>
```

Codex must:

- Work directly inside `C:\Users\anshi\OneDrive\เอกสาร\Career-navigation`.
- Inspect the current repository, files, package configuration, Git status, branches, and existing environment setup before changing anything.
- Rebuild the product in this existing folder.
- Preserve the existing `.git` directory, GitHub remote, commit history, and repository connection.
- Preserve existing secrets and environment-variable files unless a migration is explicitly required.
- Use the current repository root as the application root.
- Make logical commits to the existing repository.

Codex must **not**:

- Create a new root folder.
- Create a nested folder such as `career-compass`, `career-navigation-v2`, `app`, `frontend`, or another newly scaffolded project directory containing the real application.
- Initialize a new Git repository.
- disconnect, replace, or delete the existing `.git` directory.
- Run a framework scaffolding command in a child directory.
- Build a separate demo while leaving the existing application untouched.
- move the finished product to another path.
- overwrite environment files without first inspecting and preserving their required values.

If the existing codebase must be replaced, replace or refactor the application **in place** inside the existing repository. The final working product must run from:

```powershell
C:\Users\anshi\OneDrive\เอกสาร\Career-navigation
```

### One complete launch

Career Compass will be launched as one complete product, not as a sequence of public MVP releases.

Codex may implement the system in a logical internal order, but every feature marked **Required for Launch** in this specification must be complete, integrated, tested, and production-ready before the product is treated as finished.

Do not leave:

- placeholder pages;
- fake buttons;
- static mock dashboards;
- hard-coded demo data in production;
- forms that do not save;
- filters that do not work;
- export buttons that generate nothing;
- charts disconnected from real records;
- incomplete role permissions;
- `TODO` features presented as complete.

---

# 1. Product Summary

## Product name

**Career Compass**

## Product category

Counsellor-assistive career-guidance, student-record, intervention-management, and institutional reporting software for schools.

## One-sentence definition

Career Compass is a school-based career-guidance operating system that helps counsellors and designated senior teachers maintain longitudinal student records, conduct and document guidance sessions, build realistic education and career pathways, assign follow-ups, access verified opportunity information, manage cohort-level interventions, and measure guidance coverage and outcomes.

## Core positioning

Career Compass is **not** a student-facing career quiz.

It is a professional workflow and decision-support system used by counsellors, senior teachers, principals, and authorized school staff during the career-guidance process.

Students and parents do **not** receive software accounts and do **not** log in.

A counsellor may:

- show relevant screens to a student during a meeting;
- print or download an approved student summary;
- create a pathway report to discuss with a parent;
- record information provided by students and guardians;
- generate a follow-up sheet for offline use.

All interaction with the system remains mediated by authorized school staff.

## Existing context

Career Compass was created to address the lack of structured career-guidance access in schools, especially government and resource-constrained schools. The project has previously reached approximately 900 students across about five government schools.

The rebuilt product must convert that informal or limited deployment into a credible institutional system that schools can continue using without the founder personally managing every student.

---

# 2. The Problem

Many schools do not have a full-time professional career counsellor. Career guidance may be handled by:

- a senior teacher;
- a class teacher;
- a principal;
- a placement or activity coordinator;
- a visiting counsellor;
- a small counselling team responsible for hundreds of students.

Their information is usually fragmented across:

- paper forms;
- registers;
- spreadsheets;
- report cards;
- messaging groups;
- memory;
- isolated assessment documents;
- unofficial career websites;
- untracked one-time conversations.

This causes several operational failures:

1. Students receive advice, but there is no consistent follow-up.
2. Teachers cannot quickly identify which students need immediate attention.
3. Previous conversations and recommendations are forgotten.
4. Career, course, examination, scholarship, and institution information becomes outdated.
5. Schools cannot measure how many students received meaningful guidance.
6. Counsellors repeat the same administrative work for every student.
7. Guidance often ignores financial, geographic, linguistic, family, and access constraints.
8. Students are pushed toward one “best” career instead of building realistic primary and alternative pathways.
9. Schools cannot identify cohort-level needs and organize targeted workshops.
10. There is no reliable longitudinal record from early exploration through final outcomes.

Career Compass must solve these operational problems.

---

# 3. Product Principles

Every product and technical decision must follow these principles.

## 3.1 Human-led, software-assisted

The software supports professional judgment. It does not replace the counsellor.

Career Compass may organize information, surface overdue actions, suggest questions, calculate transparent status indicators, and generate draft summaries. It must not autonomously decide a student’s career.

## 3.2 No deterministic career verdicts

Never show statements such as:

- “You are 94% suited for medicine.”
- “Engineering is your ideal career.”
- “Your personality means you should choose law.”

Use language such as:

- “Areas worth exploring.”
- “Possible pathways for discussion.”
- “These options align with some of the interests and constraints recorded.”
- “Counsellor review required.”

## 3.3 Longitudinal guidance, not one-time testing

The product must record development over time:

- changing interests;
- completed exposure activities;
- conversations;
- decisions;
- action plans;
- follow-ups;
- outcomes.

## 3.4 Actionable, not informational only

Every guidance interaction should lead to one or more of:

- a recorded decision;
- an assigned action;
- a resource;
- a pathway comparison;
- an exposure activity;
- a follow-up date;
- a referral;
- a documented outcome.

## 3.5 Practical constraints matter

Recommendations must consider more than marks and interests.

The system should allow the counsellor to record:

- affordability;
- willingness to relocate;
- language;
- transportation;
- device and internet access;
- family expectations;
- accessibility needs;
- caregiving or work responsibilities;
- preferred study duration;
- preference for academic, vocational, or mixed routes.

## 3.6 Evidence and source transparency

Career, course, examination, scholarship, and institution records must display:

- source;
- source type;
- date last checked;
- verification status;
- validity period where relevant;
- warning when the information may be stale.

## 3.7 Privacy by design

The software handles information about minors. Collect only what is necessary, restrict access, log sensitive actions, and separate private counsellor notes from shareable student summaries.

## 3.8 Low-friction school use

The product must work for schools with:

- limited counselling staff;
- lower digital literacy;
- inconsistent internet;
- older laptops;
- large student cohorts.

Use simple language, fast pages, clear forms, strong defaults, bulk actions, and minimal repetitive data entry.

---

# 4. Users and Roles

Students and parents are records and participants in the counselling process, but they are **not software users**.

## 4.1 Platform Super Admin

A Career Compass platform-level role.

Can:

- create and manage school organizations;
- activate or suspend school accounts;
- manage the central verified content database;
- manage global career clusters, courses, exams, scholarships, and resources;
- review content-update queues;
- view anonymized cross-school usage analytics;
- manage platform settings;
- inspect technical logs where authorized.

Must not casually browse identifiable student records.

Access to a school’s student data must be exceptional, justified, logged, and technically restricted.

## 4.2 School Admin / Principal

Organization-scoped role.

Can:

- manage school profile;
- manage academic years, classes, and sections;
- invite and deactivate staff;
- assign roles;
- configure permissions;
- upload student rosters;
- assign counsellors;
- view school-level reports;
- manage school-specific resources;
- manage consent and retention settings;
- view audit logs where permitted.

## 4.3 Lead Counsellor

Can:

- view students within the school;
- assign students to counsellors or guidance teachers;
- manage counselling workflows;
- conduct and review sessions;
- create templates and interventions;
- view school-wide counselling coverage;
- review escalations;
- access private counsellor records where policy permits;
- generate reports.

## 4.4 Counsellor

Can:

- view assigned students;
- view authorized unassigned students when school policy allows;
- create and edit student guidance records;
- conduct and document sessions;
- build pathways;
- create action plans;
- assign tasks and follow-ups;
- create approved student-facing summaries;
- access the verified information database;
- manage assigned interventions;
- view analytics for their caseload.

## 4.5 Senior Teacher / Guidance Teacher

A counsellor-assistive role for schools without full-time counsellors.

Can:

- manage assigned students;
- use guided session templates;
- record meetings;
- create action plans;
- assign follow-ups;
- access counsellor playbooks and the verified information database;
- refer a case to the lead counsellor or another authorized staff member.

May have restricted access to sensitive notes depending on school policy.

## 4.6 Class Teacher / Read-Limited Staff

Optional role.

Can:

- view basic guidance status for assigned students;
- submit teacher observations;
- view approved action items relevant to the classroom;
- flag a student for counsellor attention.

Cannot view private counselling notes unless explicitly authorized.

## 4.7 Data Entry Operator

Optional limited role.

Can:

- import or update approved demographic and academic data;
- resolve import errors;
- update class and section information.

Cannot view private counselling notes or make recommendations.

## 4.8 Read-Only Reviewer

Optional role for authorized school leadership or programme evaluation.

Can view selected reports and anonymized information, but cannot edit student records.

---

# 5. Access Model

## 5.1 No student accounts

Do not create:

- student login;
- student dashboard;
- student password flow;
- student self-service portal;
- student messaging inbox.

## 5.2 No parent accounts

Do not create:

- parent login;
- guardian dashboard;
- parent messaging portal;
- guardian password flow.

## 5.3 Counsellor-mediated sharing

Authorized staff can generate:

- printable student profile summary;
- counselling-session summary;
- pathway comparison;
- action plan;
- upcoming deadline sheet;
- parent-discussion summary;
- consent form;
- outcome summary.

Each generated document must clearly state:

- student name;
- school;
- date generated;
- generating staff member;
- whether the document is “Student/Parent Shareable” or “Internal Only.”

Private notes must never appear in shareable outputs.

---

# 6. Information Architecture

## Public website

1. Home
2. For Schools
3. For Counsellors and Teachers
4. How It Works
5. Impact
6. Resources
7. Privacy and Data Safety
8. Contact / Request a Demo
9. Staff Login

## Authenticated application navigation

### Main sidebar

1. Today
2. Students
3. Guidance Pipeline
4. Sessions
5. Tasks & Follow-ups
6. Calendar
7. Interventions
8. Career Database
9. Courses & Pathways
10. Exams & Deadlines
11. Scholarships
12. Institutions
13. Resources & Playbooks
14. Reports
15. School Administration
16. Audit & Data Safety
17. Settings

The sidebar must adapt to user permissions.

---

# 7. Required Public Website

## 7.1 Home

Required sections:

- hero statement focused on counsellor capacity;
- core problem;
- how Career Compass works;
- student-record continuity;
- counsellor workflow;
- verified data promise;
- school analytics;
- privacy and safety;
- existing pilot reach;
- request-demo call to action;
- staff-login call to action.

Suggested hero:

> One guidance system for every student conversation, pathway, deadline, and follow-up.

Supporting line:

> Career Compass helps school counsellors and senior teachers manage career guidance across entire cohorts without relying on scattered spreadsheets, paper forms, and memory.

## 7.2 For Schools

Explain:

- organization-level data isolation;
- staff permissions;
- roster imports;
- counselling coverage;
- reports;
- implementation;
- school-specific configuration;
- academic-year rollover.

## 7.3 For Counsellors and Teachers

Explain:

- daily priority queue;
- student profiles;
- guided session templates;
- follow-up tracking;
- career and opportunity database;
- pathway planning;
- cohort interventions;
- printable summaries.

## 7.4 How It Works

Use a clear sequence:

1. School setup
2. Staff onboarding
3. Student roster import
4. Profile and academic data collection
5. Counselling session
6. Pathway creation
7. Tasks and follow-ups
8. Intervention tracking
9. Outcome reporting

## 7.5 Impact

Only display metrics connected to real records.

Possible metrics:

- schools onboarded;
- students represented in the system;
- student profiles completed;
- counselling sessions recorded;
- active action plans;
- follow-ups completed;
- interventions conducted;
- outcomes recorded.

Never call account creation or profile import “impact.”

## 7.6 Resources

Public general-purpose guidance resources may be published here, but no student-specific data.

## 7.7 Privacy and Data Safety

Provide plain-language explanations of:

- data collected;
- purpose;
- authorized access;
- retention;
- correction;
- deletion;
- incident reporting;
- contact information.

---

# 8. Authenticated Product Requirements

# 8.1 Today Dashboard

The dashboard must answer:

> What requires my attention today?

## Required cards

- total assigned students;
- profiles awaiting review;
- sessions scheduled today;
- overdue follow-ups;
- tasks due this week;
- students without an active pathway;
- students with incomplete records;
- upcoming examination deadlines;
- upcoming scholarship deadlines;
- recent changes to student records;
- intervention attendance awaiting entry.

## Priority queue

Every queue item should include:

- student;
- class and section;
- reason;
- priority;
- assigned staff;
- due date;
- recommended next action;
- link to relevant record.

Priority must be transparent.

Example rules:

- deadline within seven days;
- overdue follow-up;
- no post-school plan for a final-year student;
- counsellor request recorded;
- no session after profile completion;
- action plan blocked;
- repeated missed actions;
- outdated pathway information.

Counsellors must be able to:

- mark reviewed;
- reschedule;
- reassign;
- snooze with reason;
- open the student profile.

## Dashboard charts

Use live database records.

Include:

- guidance-stage distribution;
- counselling coverage by class;
- overdue follow-ups;
- active pathways by career cluster;
- intervention participation;
- action-plan completion.

No decorative charts disconnected from actual data.

---

# 8.2 Student Registry

## Required table fields

- student ID;
- full name;
- class;
- section;
- academic year;
- assigned counsellor;
- guidance stage;
- profile completion;
- last session;
- next follow-up;
- primary pathway;
- action-plan status;
- priority flags;
- consent status;
- record status.

## Required filters

- academic year;
- class;
- section;
- counsellor;
- stage;
- pathway;
- career cluster;
- stream;
- profile completeness;
- last interaction;
- follow-up status;
- active/inactive;
- consent status;
- priority;
- outcome status.

## Required actions

- open record;
- create session;
- assign counsellor;
- add task;
- schedule follow-up;
- add to intervention;
- generate summary;
- export selected records;
- archive;
- restore.

## Bulk actions

- assign counsellor;
- update class/section;
- attach resource;
- create group follow-up;
- add to intervention;
- export;
- archive after confirmation.

---

# 8.3 Student Profile

Each student must have one longitudinal record per school organization, with academic-year history preserved.

## A. Overview

- name;
- internal student ID;
- class and section;
- academic year;
- date of birth or age band where needed;
- preferred language;
- guardian details;
- assigned counsellor;
- status;
- guidance stage;
- active flags;
- profile completion;
- last interaction;
- next action;
- upcoming deadlines.

## B. Academic history

Support multiple terms and years.

Fields:

- subject;
- marks or grade;
- grading scale;
- term;
- academic year;
- teacher comment;
- strength indicator;
- difficulty indicator;
- attendance where relevant;
- stream;
- school-provided predicted or internal marks where used.

Include:

- trend view;
- subject comparison;
- manual entry;
- CSV import;
- source label;
- edit history.

Marks must not automatically determine a career.

## C. Interests and preferences

Counsellor-entered based on discussion.

Fields:

- enjoyed subjects;
- disliked subjects;
- activities;
- hobbies;
- types of problems enjoyed;
- preferred working style;
- preferred work environment;
- values;
- causes;
- career interests;
- careers rejected;
- reasons;
- confidence level;
- uncertainty level;
- open questions.

## D. Skills and evidence

Record:

- skills;
- confidence;
- evidence;
- project;
- competition;
- course;
- teacher observation;
- counsellor observation;
- date recorded.

Separate self-reported skill from externally demonstrated evidence.

## E. Constraints and practical considerations

Permission-controlled fields:

- affordability band;
- scholarship need;
- willingness to relocate;
- preferred geography;
- commute restrictions;
- device access;
- internet access;
- preferred language;
- accessibility needs;
- family expectations;
- study-duration preference;
- preference for degree, diploma, vocational, apprenticeship, or mixed routes;
- other relevant responsibilities.

Avoid collecting unnecessary sensitive personal information.

## F. Guardian and family conversation record

Store:

- guardian name;
- relationship;
- contact information;
- meeting dates;
- concerns raised;
- constraints shared;
- approved shareable summary;
- acknowledgement status where used.

Private student information must not be copied into guardian summaries automatically.

## G. Career exploration history

Record:

- career explored;
- date;
- resource used;
- activity type;
- reflection;
- counsellor comment;
- outcome;
- next step.

Activity types:

- career conversation;
- alumni interaction;
- workplace visit;
- webinar;
- workshop;
- job shadow;
- course;
- project;
- competition;
- reading;
- interview with a professional;
- vocational exposure.

## H. Counselling timeline

Chronological display of:

- sessions;
- notes;
- pathway changes;
- tasks;
- follow-ups;
- resources shared;
- interventions;
- parent meetings;
- decisions;
- referrals;
- outcomes.

## I. Pathways

Every student can have:

- primary pathway;
- alternative pathway;
- exploratory pathway;
- archived pathways.

Each pathway must include:

- career or field;
- intended course;
- potential institutions or institution types;
- school-subject requirements;
- entrance examinations;
- eligibility;
- duration;
- cost considerations;
- scholarships;
- location;
- timeline;
- risks;
- assumptions;
- information still needed;
- next steps;
- counsellor confidence;
- student interest level as reported to the counsellor;
- status.

## J. Action plan

Action-plan fields:

- title;
- goal;
- start date;
- target date;
- owner;
- current status;
- milestones;
- tasks;
- dependencies;
- notes;
- review dates;
- completion summary.

## K. Documents

Support upload and permissioned storage for:

- consent forms;
- academic records;
- counsellor-created summaries;
- pathway comparisons;
- student work;
- meeting records;
- approved institutional documents.

Do not collect government identity documents unless clearly required.

## L. Audit history

Show authorized users:

- what changed;
- previous value;
- new value;
- who changed it;
- when;
- reason where required.

---

# 8.4 Counselling Sessions

## Session types

- initial intake;
- career exploration;
- stream selection;
- subject selection;
- academic planning;
- vocational pathway;
- college planning;
- entrance-exam planning;
- scholarship and affordability;
- parent meeting;
- follow-up;
- application planning;
- post-result revision;
- outcome recording;
- referral;
- group counselling.

## Pre-session briefing

Generate from live records:

- profile snapshot;
- prior session;
- open actions;
- pathway status;
- recent academic changes;
- stated interests;
- constraints;
- upcoming deadlines;
- unresolved questions;
- flags.

## Session form

Required fields:

- date and time;
- staff member;
- session type;
- attendees;
- reason;
- topics discussed;
- questions asked;
- student-reported concerns;
- observations;
- options explored;
- information shared;
- decisions;
- actions assigned;
- counsellor actions;
- follow-up date;
- session status;
- private notes;
- shareable summary.

## Notes visibility

Every note must be marked as one of:

- internal counsellor only;
- counselling team;
- school leadership where authorized;
- shareable with student/guardian.

The interface must clearly distinguish these categories.

## Session completion

A completed session should require at least one of:

- action assigned;
- next session scheduled;
- pathway updated;
- resource shared;
- decision recorded;
- referral recorded;
- case closed with reason.

## Generated documents

- session summary;
- parent meeting summary;
- student action sheet;
- internal case note.

---

# 8.5 Guidance Pipeline

Default stages:

1. Not onboarded
2. Basic record created
3. Profile incomplete
4. Ready for review
5. Initial session required
6. Initial session completed
7. Exploring pathways
8. Pathways shortlisted
9. Action plan active
10. Applications or examinations in progress
11. Outcome pending
12. Outcome recorded
13. Alumni follow-up
14. Archived

Requirements:

- Kanban view;
- table view;
- cohort filters;
- drag-and-drop with validation;
- bulk stage update;
- stage history;
- automatic suggested transitions;
- manual override with reason;
- school-configurable labels without breaking underlying status logic.

---

# 8.6 Tasks and Follow-ups

## Task fields

- title;
- description;
- student;
- assigned staff;
- responsible party;
- task category;
- due date;
- priority;
- status;
- dependency;
- evidence or attachment;
- verification status;
- comments;
- completion date.

Responsible party may be:

- counsellor;
- guidance teacher;
- student, tracked offline by counsellor;
- guardian, tracked offline by counsellor;
- school administrator;
- external contact.

Students and guardians still do not log in. Staff record progress based on follow-up.

## Task categories

- research;
- document collection;
- examination registration;
- scholarship application;
- course exploration;
- institution comparison;
- parent discussion;
- professional conversation;
- exposure activity;
- skill building;
- project;
- appointment;
- follow-up;
- referral.

## Views

- today;
- this week;
- overdue;
- by student;
- by staff member;
- blocked;
- awaiting evidence;
- completed.

## Follow-up automation

Create internal reminders for:

- overdue task;
- upcoming session;
- missed follow-up;
- approaching exam deadline;
- scholarship deadline;
- stale pathway;
- no student interaction for a configured period.

No direct student or parent notifications are required for launch.

---

# 8.7 Calendar

Required:

- day, week, and month views;
- counselling sessions;
- group interventions;
- follow-ups;
- examination dates;
- scholarship deadlines;
- school events;
- staff availability;
- filters by counsellor and event type;
- conflict warnings;
- recurring events;
- calendar export where practical.

Optional integration may be added with Google Calendar only if it is reliable and does not block core functionality.

---

# 8.8 Interventions and Programmes

Support cohort-level guidance.

## Intervention types

- career-awareness workshop;
- stream-selection session;
- scholarship clinic;
- parent orientation;
- alumni panel;
- professional interaction;
- workplace visit;
- vocational-pathway session;
- entrance-exam briefing;
- application workshop;
- portfolio workshop;
- subject-choice session;
- financial-planning session.

## Intervention fields

- title;
- objective;
- target cohort;
- selection criteria;
- organizer;
- date;
- venue;
- resources;
- attendees;
- attendance status;
- pre-session measure;
- post-session measure;
- reflections;
- follow-up tasks;
- outcome notes;
- cost;
- partner organization.

## Required functionality

- add students individually or in bulk;
- attendance;
- generate attendance sheet;
- record feedback;
- attach resources;
- assign follow-up;
- compare pre/post responses;
- report reach by cohort.

---

# 8.9 Career Database

The central database must be structured and maintainable.

## Career record

Fields:

- canonical title;
- alternate titles;
- career cluster;
- description;
- typical responsibilities;
- work environments;
- relevant interests;
- relevant school subjects;
- skills;
- education routes;
- vocational routes;
- apprenticeship routes;
- related careers;
- progression;
- common misconceptions;
- accessibility considerations;
- labour-market notes;
- salary data with geography, experience level, source, and date;
- official or authoritative sources;
- verification status;
- last reviewed date;
- reviewer;
- archive status.

## Content statuses

- draft;
- pending review;
- verified;
- published;
- update required;
- stale;
- archived.

## Source requirements

Each record must support multiple sources.

Source fields:

- title;
- organization;
- URL;
- source type;
- publication date where available;
- date accessed;
- geographic relevance;
- notes;
- active/broken status.

---

# 8.10 Courses and Education Pathways

## Course fields

- name;
- aliases;
- qualification level;
- stream or subject requirements;
- duration;
- curriculum overview;
- eligibility;
- entrance routes;
- typical cost band;
- delivery mode;
- progression options;
- associated careers;
- vocational alternatives;
- institutions offering it;
- sources;
- last verified date;
- status.

Support:

- degrees;
- diplomas;
- certificates;
- vocational programmes;
- apprenticeships;
- integrated programmes;
- alternative pathways.

---

# 8.11 Examinations and Deadlines

## Examination fields

- name;
- conducting body;
- purpose;
- eligible class or qualification;
- courses served;
- official eligibility;
- application start;
- application deadline;
- examination date;
- fee;
- required documents;
- official URL;
- status;
- last verified date;
- change history.

## Deadline rules

- deadlines must be linked to an official source;
- stale records must display a warning;
- date changes must be logged;
- changes should require human review before publication;
- counsellors may attach an examination to a student pathway;
- upcoming deadlines must surface on dashboards.

---

# 8.12 Scholarships and Financial Support

## Scholarship fields

- name;
- provider;
- description;
- eligibility;
- income criteria where applicable;
- geography;
- qualification or class;
- amount or coverage;
- application period;
- required documents;
- official URL;
- recurring or one-time;
- last verified;
- status.

Support attaching a scholarship to:

- a student;
- a pathway;
- an institution;
- a course.

Do not store sensitive financial documents unless necessary and authorized.

---

# 8.13 Institution Database

## Institution fields

- official name;
- aliases;
- institution type;
- ownership type;
- location;
- website;
- courses;
- admissions route;
- recognition or accreditation source;
- hostel;
- accessibility;
- scholarships;
- approximate cost band with date and source;
- notes;
- last verified;
- status.

Avoid building a simplistic ranking system.

Allow counsellors to compare institutions based on:

- eligibility;
- cost;
- location;
- programme;
- admissions route;
- accommodation;
- scholarship availability;
- student constraints.

---

# 8.14 Resources and Counsellor Playbooks

## Resource types

- counsellor guide;
- session template;
- question bank;
- worksheet;
- parent discussion guide;
- stream-selection guide;
- vocational-pathway guide;
- scholarship checklist;
- exam checklist;
- career-exploration activity;
- referral guide;
- ethical boundary guide.

## Required playbooks

- first student conversation;
- supporting an undecided student;
- stream selection;
- discussing affordability;
- handling parent disagreement;
- avoiding gender stereotypes;
- presenting vocational routes;
- building primary and backup pathways;
- referring concerns outside career guidance;
- closing a counselling cycle;
- recording outcomes.

---

# 8.15 Reports and Analytics

All reports must use real database records and respect permissions.

## Operational reports

- student onboarding;
- profile completion;
- counselling coverage;
- sessions by type;
- sessions by counsellor;
- average caseload;
- overdue follow-ups;
- task completion;
- intervention reach;
- pathway coverage;
- outcome coverage.

## Career-readiness indicators

- students with at least one active pathway;
- students with primary and alternative pathways;
- students with documented next actions;
- students with at least one career conversation;
- students with at least one exposure activity;
- students with an upcoming deadline plan;
- students with unresolved decisions;
- students with completed follow-ups.

## Cohort reports

Filter by:

- class;
- section;
- academic year;
- counsellor;
- career cluster;
- stream;
- pathway status;
- intervention participation;
- outcome.

## Equity and access reports

Only use fields that are collected lawfully and intentionally.

Possible measures:

- counselling coverage by gender;
- access by class or school;
- scholarship support;
- digital-access constraints;
- exposure-activity participation;
- vocational-route awareness.

Do not use demographic traits to predict ability or limit recommendations.

## Exports

Support:

- CSV;
- printable PDF;
- selected student report;
- cohort report;
- school annual report;
- counsellor activity report.

---

# 8.16 Outcome Tracking

Possible outcomes:

- stream selected;
- subject combination selected;
- course shortlisted;
- entrance examination registered;
- college application submitted;
- admission received;
- scholarship received;
- degree programme entered;
- diploma or vocational programme entered;
- apprenticeship entered;
- employment entered;
- gap year;
- preparing again;
- outcome unknown;
- school transfer;
- left school.

Fields:

- outcome;
- date;
- institution or provider;
- programme;
- verification source;
- notes;
- follow-up date;
- confidence level;
- final status.

Never claim that Career Compass caused an outcome merely because the student used the platform.

---

# 8.17 School Administration

## School profile

- official name;
- code;
- address;
- board;
- grades served;
- academic year;
- school contact;
- logo;
- counselling model;
- default workflow;
- retention settings.

## Staff management

- invite;
- deactivate;
- assign role;
- assign class or caseload;
- reset access;
- audit login;
- remove permissions immediately.

## Academic structure

- academic years;
- classes;
- sections;
- streams;
- subjects;
- grading scales;
- terms.

## Assignment

Support:

- counsellor by class;
- counsellor by section;
- counsellor by student;
- lead counsellor;
- temporary reassignment;
- workload balancing.

## Academic-year rollover

Required workflow:

1. preview current records;
2. promote students;
3. move class and section;
4. preserve history;
5. transfer active pathways;
6. transfer open tasks;
7. archive departed students;
8. maintain alumni outcomes;
9. generate rollover report;
10. allow rollback before final confirmation.

---

# 8.18 Data Import and Export

## CSV import types

- student roster;
- guardian information;
- academic marks;
- class assignments;
- staff assignments;
- historical counselling records where feasible.

## Import process

1. upload;
2. detect headers;
3. map fields;
4. validate;
5. identify duplicates;
6. preview;
7. show errors;
8. confirm;
9. import;
10. generate result report;
11. allow safe rollback.

## Duplicate handling

Match using configurable combinations such as:

- internal student ID;
- name + date of birth;
- name + class + guardian contact.

Never silently merge ambiguous records.

---

# 8.19 Internal Search

Global search must cover:

- students;
- staff;
- careers;
- courses;
- exams;
- scholarships;
- institutions;
- sessions;
- tasks;
- interventions;
- resources.

Search results must be permission-aware.

---

# 8.20 Internal Notifications

Required notification types:

- upcoming session;
- overdue follow-up;
- task due;
- examination deadline;
- scholarship deadline;
- assigned student;
- reassigned task;
- record awaiting review;
- stale information source;
- intervention attendance pending;
- data-import error.

Allow:

- mark read;
- mark all read;
- filter by type;
- link to relevant record;
- notification preferences.

---

# 9. Data Architecture

Use a relational database.

Every school-owned record must include an organization or school identifier.

## Core tables

Suggested entities:

- organizations
- organization_settings
- academic_years
- classes
- sections
- subjects
- staff_profiles
- staff_roles
- staff_assignments
- students
- student_guardians
- student_enrollments
- student_academic_records
- student_interests
- student_preferences
- student_constraints
- student_skills
- student_flags
- student_documents
- consent_records
- counselling_sessions
- session_attendees
- session_notes
- session_actions
- pathways
- pathway_courses
- pathway_institutions
- pathway_exams
- pathway_scholarships
- action_plans
- tasks
- task_comments
- follow_ups
- interventions
- intervention_students
- intervention_attendance
- intervention_feedback
- careers
- career_sources
- career_relationships
- career_skills
- courses
- course_sources
- institutions
- institution_sources
- institution_courses
- examinations
- examination_sources
- scholarships
- scholarship_sources
- resources
- resource_sources
- outcomes
- notifications
- imports
- import_errors
- exports
- generated_documents
- audit_logs
- content_reviews
- data_access_logs

## Required data rules

- all school-owned records are organization-scoped;
- no cross-school access;
- soft delete where historical integrity matters;
- created_at and updated_at timestamps;
- created_by and updated_by where appropriate;
- status and archive fields;
- audit trail for sensitive changes;
- foreign-key integrity;
- unique constraints for organization-scoped identifiers;
- database indexes for common filters;
- timezone-aware timestamps.

---

# 10. Security and Privacy Requirements

## Authentication

- staff-only authentication;
- secure password or approved OAuth flow;
- email verification;
- password reset;
- session expiration;
- account deactivation;
- optional multi-factor authentication if supported.

## Authorization

Enforce authorization in both:

- application logic;
- database policies.

Never rely only on hidden UI controls.

## Organization isolation

A staff member from one school must never access another school’s:

- students;
- sessions;
- notes;
- pathways;
- tasks;
- reports;
- documents;
- guardians;
- outcomes.

## Sensitive-data controls

- least-privilege access;
- private-note visibility;
- document access control;
- signed storage URLs;
- audit logs;
- secure deletion and retention workflows;
- no public student URLs;
- no personally identifiable data in analytics events;
- no advertising;
- no sale of student data.

## Audit events

Log:

- login;
- failed access;
- student record viewed where required;
- record created;
- sensitive record changed;
- document downloaded;
- role changed;
- staff deactivated;
- export generated;
- bulk import;
- record archived;
- privacy setting changed.

## Data minimization

Do not collect unnecessary:

- Aadhaar;
- biometric information;
- detailed medical information;
- psychological diagnoses;
- religion;
- caste;
- exact family income;
- family-conflict details.

Where a sensitive field is genuinely required for a defined scholarship or support process, restrict it, explain its purpose, and log access.

---

# 11. Content Verification System

The real-time information database must have a visible maintenance system.

## Content workflow

1. Draft
2. Source attached
3. Pending review
4. Verified
5. Published
6. Update detected
7. Re-verification required
8. Stale
9. Archived

## Required fields on information pages

- verified badge;
- last checked;
- source organization;
- source link;
- geographic relevance;
- warning when stale;
- content owner;
- change history.

## Preferred source hierarchy

1. official government or conducting-body source;
2. official institution source;
3. regulator or recognized authority;
4. authoritative professional body;
5. reputable secondary source only when necessary.

Do not populate production with invented records.

Seed data must come from traceable sources and be clearly attributable.

---

# 12. UX and Design Requirements

## General style

- professional;
- trustworthy;
- calm;
- modern;
- suitable for schools;
- not childish;
- not corporate-finance styled;
- not overloaded with gradients or animations.

## Interface

- desktop-first, fully responsive;
- accessible on tablets;
- clear sidebar;
- sticky page headers where useful;
- breadcrumbs;
- command/search access;
- consistent empty states;
- clear confirmation dialogs;
- helpful validation;
- autosave only where safe;
- visible unsaved-change warning.

## Accessibility

- keyboard navigation;
- semantic HTML;
- labels for all form inputs;
- sufficient contrast;
- visible focus states;
- accessible tables;
- readable text sizes;
- no information conveyed only through color;
- screen-reader-friendly status labels.

## Low-bandwidth performance

- avoid giant assets;
- lazy-load large tables;
- paginate or virtualize;
- compress images;
- cache stable content;
- keep primary workflows fast;
- show useful loading and retry states.

## Language

Launch UI may be English-first, but architecture must support future localization.

Do not hard-code text in a way that makes translation impossible.

---

# 13. Technical Direction

Codex must inspect the current repository before deciding on migrations.

## Preferred architecture, where compatible

- TypeScript;
- modern React-based frontend;
- Supabase or equivalent PostgreSQL backend;
- database-enforced organization isolation;
- secure object storage;
- real-time subscriptions where useful;
- schema validation;
- robust form handling;
- server-side protection for sensitive actions;
- automated tests.

If the existing repository already uses a suitable stack, preserve it and improve it rather than creating a parallel application.

If the repository is empty, severely broken, or unsuitable, set up the new application **in the existing repository root**, not a new folder.

## Environment handling

- inspect existing `.env*` files;
- provide `.env.example` without secrets;
- never commit secrets;
- document required variables;
- validate missing variables at startup;
- preserve existing production integrations where still used.

## Database migrations

- use version-controlled migrations;
- do not rely on manual undocumented database changes;
- make migrations idempotent where possible;
- include seed scripts for development;
- do not seed fake production data.

---

# 14. Quality Requirements

## Every feature must include

- loading state;
- empty state;
- error state;
- success feedback;
- permission handling;
- input validation;
- responsive behavior;
- database persistence;
- audit behavior where relevant.

## Testing

Required test coverage should include:

- authentication;
- organization isolation;
- role permissions;
- student creation;
- CSV import;
- session creation;
- private-note visibility;
- pathway creation;
- task and follow-up workflow;
- report generation;
- export;
- academic-year rollover;
- archive and restore;
- stale content warnings.

Use:

- unit tests for business logic;
- integration tests for data access;
- end-to-end tests for critical user journeys.

## Critical end-to-end journeys

1. School admin configures a school.
2. School admin imports students.
3. Lead counsellor assigns students.
4. Counsellor opens a student profile.
5. Counsellor records an initial session.
6. Counsellor creates primary and alternative pathways.
7. Counsellor creates an action plan.
8. Counsellor assigns and later completes follow-ups.
9. Counsellor adds the student to a group intervention.
10. Counsellor generates a shareable summary.
11. School admin views coverage and outcome reports.
12. Another school’s user is blocked from all records.
13. Private notes do not appear in shareable output.
14. Academic-year rollover preserves history correctly.

---

# 15. Non-Goals

Do not build these as core features for this launch unless they are already required by an existing contract:

- student portal;
- parent portal;
- student mobile app;
- parent mobile app;
- public social network;
- student leaderboard;
- autonomous AI counsellor;
- deterministic aptitude verdict;
- mental-health diagnosis;
- admission-chance calculator;
- nationwide college ranking;
- job marketplace;
- course-selling platform;
- advertising system;
- public student profiles;
- direct student chat;
- direct parent chat.

An internal counsellor assistant may eventually help summarize or organize information, but no AI output may be treated as final without human review.

---

# 16. Required Launch Dataset

The product must launch with a credible, curated information base rather than an empty shell.

At minimum, include a manageable verified set of:

- career clusters;
- representative careers across academic and vocational routes;
- common undergraduate courses;
- diploma and vocational pathways;
- major Indian entrance examinations relevant to school students;
- major scholarship categories and official sources;
- institution types;
- counsellor playbooks;
- session templates;
- pathway templates;
- student-summary templates.

Quality and traceability are more important than claiming to contain every career or institution in India.

Every launch record must include a source and verification date.

---

# 17. Definition of Done

Career Compass is complete only when all of the following are true.

## Repository

- application runs from the existing repository root;
- no new root or nested product folder was created;
- existing GitHub connection is preserved;
- changes are committed logically;
- setup documentation is updated.

## Functionality

- all required pages exist;
- all buttons work;
- forms save real data;
- filters work;
- exports work;
- reports use live records;
- permissions are enforced;
- organization isolation is tested;
- no student or parent login exists;
- counsellor-mediated printable/shareable documents work;
- private notes remain private;
- academic-year rollover works;
- content verification works;
- no fake production data remains.

## Production readiness

- build succeeds;
- linting succeeds;
- tests pass;
- environment variables are documented;
- database migrations are included;
- database policies are included;
- loading and error states exist;
- accessibility basics pass;
- core pages are responsive;
- deployment documentation exists;
- production deployment is verified.

## Documentation

The repository must contain:

- `README.md`;
- `product_info.md`;
- setup instructions;
- architecture overview;
- database schema overview;
- roles and permissions table;
- environment-variable guide;
- migration instructions;
- deployment instructions;
- test instructions;
- content-verification workflow;
- privacy and data-handling notes.

---

# 18. Final Instruction to Codex

Do not treat this as a visual redesign exercise.

The objective is to build a real institutional product that a counsellor or senior teacher can use to manage hundreds of students continuously and responsibly.

Before coding:

1. Inspect the existing repository at:

```powershell
C:\Users\anshi\OneDrive\เอกสาร\Career-navigation
```

2. Review the current stack, structure, Git status, remotes, database integrations, and environment variables.
3. Produce an implementation checklist mapped to this specification.
4. Rebuild in place.
5. Preserve Git and the existing connected repository.
6. Do not create a new project folder.
7. Do not ship partial or fake functionality.
8. Continue until the complete launch scope is implemented, tested, documented, and deployable.

The final product must make this question easy for a school to answer:

> Which students need guidance, what has already been done, what should happen next, who is responsible, and did the intervention help?
