import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createAiConfig } from '../server/ai/config.ts'
import { assessSourceFreshness } from '../server/ai/currentData.ts'
import { summariseStudent } from '../server/ai/evidence.ts'
import { compactEvidence, remainingOutputBudget, TokenBudgetError } from '../server/ai/tokens.ts'
import { parseAndValidateRoadmap } from '../server/ai/validation.ts'

const config = createAiConfig({
  OPENROUTER_MAX_INPUT_TOKENS: '2800',
  OPENROUTER_MAX_OUTPUT_TOKENS: '1700',
  OPENROUTER_MAX_TOTAL_TOKENS: '5000',
  MANYFOLDS_LIVE_DATA_ENABLED: 'false',
})

const source = {
  record_id: 'career:c1',
  entity_type: 'career',
  entity_id: 'c1',
  name: 'Verified career',
  source_url: 'https://official.example/career',
  source_domain: 'official.example',
  verification_status: 'verified',
  admission_cycle: null,
  last_verified_at: '2026-08-01',
}
const evidence = {
  student: {
    student_id: 'student-test',
    grade_level: 'Class 12',
    board: 'CBSE',
    current_subjects: ['Psychology', 'Computer Science'],
    subject_affinities: ['Psychology', 'Computer Science'],
    subject_avoidances: [],
    academic_band: '70–85%',
    skills: ['Research', 'Coding'],
    work_preferences: ['Working with people'],
    values: ['Social impact'],
    budget_band: 'Under ₹50,000',
    location_constraints: ['Near home required'],
    relocation_preference: 'No',
    exam_willingness: 'Avoid if possible',
    course_duration_preference: '',
    degree_route_preferences: [],
    hard_constraints: ['Avoid competitive examinations'],
    missing_profile_fields: [],
  },
  primary_career: {
    career_id: 'c1',
    name: 'Verified career',
    fit_factors: ['Psychology', 'Research'],
    concerns: ['Exam constraint'],
    source_record_ids: ['career:c1'],
  },
  alternative_careers: [],
  verified_courses: [],
  verified_programmes: [],
  verified_exams: [],
  verified_scholarships: [],
  verified_admission_cycles: [],
  source_records: [source],
  deterministic_eligibility: {
    status: 'insufficient_data',
    missing_requirements: ['Verified programme eligibility'],
  },
  missing_data: ['Programme data is incomplete'],
}
const valid = {
  roadmap_title: 'A sourced roadmap',
  career_id: 'c1',
  summary: 'Connect psychology, computing, and research without assuming admissions facts.',
  why_it_fits: [{ factor: 'Research', student_evidence: 'Research is a supplied skill.' }],
  important_tradeoffs: ['Programme eligibility is not yet verified.'],
  eligibility_summary: {
    status: 'insufficient_data',
    explanation: 'Programme-level evidence is missing.',
    missing_requirements: ['Verified programme eligibility'],
    source_record_ids: ['career:c1'],
  },
  stages: [
    {
      stage: 'now',
      title: 'Explore the work',
      description: 'Complete a small research activity.',
      mandatory: false,
      status: 'not_started',
      target_date: null,
      source_record_ids: ['career:c1'],
      unverified: false,
    },
  ],
  course_options: [],
  college_programmes: [],
  exam_steps: [],
  backup_routes: [],
  next_actions: [
    {
      action: 'Discuss the missing programme evidence',
      priority: 'high',
      reason: 'Eligibility cannot be established.',
      source_record_ids: [],
    },
  ],
  questions_for_counsellor: ['Which verified local routes should be investigated?'],
  missing_or_unverified: [{ field: 'programmes', message: 'No verified records supplied.' }],
}

const compacted = compactEvidence(evidence, config)
assert.ok(compacted.estimatedInputTokens <= 2800, 'evidence must fit the input ceiling')
assert.equal(config.maxOutputTokens, 1700, 'OpenRouter output ceiling must be 1,700')
assert.equal(config.maxTotalTokens, 5000, 'session ceiling must be 5,000')
assert.equal(remainingOutputBudget(config, 0, 2800), 1700)
assert.equal(remainingOutputBudget(config, 3000, 1800), 200, 'retry must share session budget')

const oversized = structuredClone(evidence)
oversized.student.current_subjects = Array.from({ length: 16 }, () => 'x'.repeat(2000))
assert.throws(() => compactEvidence(oversized, config), TokenBudgetError)

const accepted = parseAndValidateRoadmap(valid, evidence)
assert.equal(accepted.schemaValid, true)
assert.equal(accepted.factualValid, true)

const invalidSchema = parseAndValidateRoadmap({ summary: 'not a roadmap' }, evidence)
assert.equal(invalidSchema.schemaValid, false)

const fabricated = structuredClone(valid)
fabricated.college_programmes.push({
  programme_id: 'invented-programme',
  reason: 'Fabricated',
  eligibility_status: 'eligible',
  admission_route_summary: 'Invented',
  source_record_ids: ['invented-source'],
})
const fabricatedResult = parseAndValidateRoadmap(fabricated, evidence)
assert.equal(fabricatedResult.roadmap.college_programmes.length, 0)
assert.equal(fabricatedResult.factualValid, false)

const contradictory = structuredClone(valid)
contradictory.eligibility_summary.status = 'eligible'
const contradictionResult = parseAndValidateRoadmap(contradictory, evidence)
assert.equal(contradictionResult.roadmap.eligibility_summary.status, 'insufficient_data')
assert.equal(contradictionResult.factualValid, false)

const profileA = summariseStudent('a', {
  grade: 'Class 12',
  subjects: { Psychology: 'love', Biology: 'like' },
  skills: { Listening: 'good' },
  nearHome: false,
})
const profileB = summariseStudent('b', {
  grade: 'Class 10',
  subjects: { Mathematics: 'love', 'Vocational Subjects': 'like' },
  skills: { 'Fixing systems': 'enjoy' },
  nearHome: true,
  examWillingness: 'Avoid if possible',
})
assert.notDeepEqual(profileA, profileB, 'materially different profiles must produce different summaries')
assert.ok(profileB.hard_constraints.includes('Must study near home'))
assert.ok(profileB.hard_constraints.some((item) => item.includes('competitive examinations')))

assert.equal(config.liveDataEnabled, false, 'live retrieval must be disabled by default')
assert.equal(
  assessSourceFreshness(
    { verification_status: 'verified', last_verified_at: '2026-08-01' },
    new Date('2026-08-04'),
  ),
  'fresh',
)
assert.equal(
  assessSourceFreshness(
    { verification_status: 'verified', expires_at: '2025-12-31' },
    new Date('2026-08-04'),
  ),
  'stale',
)
assert.equal(
  assessSourceFreshness({ verification_status: 'pending_review' }),
  'review_required',
)

const clientSource = await readFile('src/aiRoadmapApi.ts', 'utf8')
const authSource = await readFile('server/ai/auth.ts', 'utf8')
const serviceSource = await readFile('server/ai/service.ts', 'utf8')
const providerSource = await readFile('server/ai/openrouter.ts', 'utf8')
const modelSource = await readFile('server/ai/models.ts', 'utf8')
const migration = await readFile(
  'supabase/migrations/20260804_ai_roadmap_architecture.sql',
  'utf8',
)
assert.ok(!clientSource.includes('OPENROUTER_API_KEY'), 'API key name must not enter client code')
assert.ok(authSource.includes("header.startsWith('Bearer ')"), 'generation must require bearer auth')
assert.ok(authSource.includes('organisation_memberships'), 'organisation access must be checked server-side')
assert.ok(serviceSource.includes('organisation_id=$1'), 'queries must filter by server-derived organisation')
assert.ok(serviceSource.includes('generationHash'), 'unchanged roadmap requests must use a cache hash')
assert.ok(serviceSource.includes('models.slice(0, 2)'), 'fallback attempts must be capped at one retry')
assert.ok(serviceSource.includes('remainingOutputBudget'), 'fallback must share the total session budget')
assert.ok(providerSource.includes('max_tokens: maxOutputTokens'), 'provider must receive the output ceiling')
assert.ok(providerSource.includes("type: 'json_schema'"), 'provider must receive the strict schema format')
assert.ok(providerSource.includes('require_parameters: true'), 'provider routing must require all parameters')
assert.ok(modelSource.includes('estimated_roadmap_cost'), 'model ranking must use total estimated cost')
assert.ok(modelSource.includes('config.allowedModels'), 'catalogue changes must not bypass the reviewed allowlist')
assert.ok(migration.includes('enable row level security'), 'new tables must enable RLS')
assert.ok(migration.includes('organisation generation isolation'), 'generation RLS policy must exist')
assert.ok(migration.includes('total_tokens <= 5000'), 'database must enforce the token ceiling')

console.log('AI roadmap architecture checks passed')
