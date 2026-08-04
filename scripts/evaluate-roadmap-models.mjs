import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createAiConfig } from '../server/ai/config.ts'
import { callOpenRouter } from '../server/ai/openrouter.ts'
import { compactEvidence } from '../server/ai/tokens.ts'
import { parseAndValidateRoadmap } from '../server/ai/validation.ts'

const env = Object.fromEntries(
  (await readFile('.env.local', 'utf8'))
    .split(/\r?\n/)
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
)
const config = createAiConfig(env)
const fixtures = JSON.parse(
  await readFile('scripts/fixtures/roadmap-evaluation-profiles.json', 'utf8'),
)
const runPaidEvaluation = process.argv.includes('--run')

if (!runPaidEvaluation) {
  console.log('Roadmap model harness is ready in dry-run mode.')
  console.log(`Profiles: ${fixtures.length}`)
  console.log(`Configured reviewed models: ${config.allowedModels.join(', ') || 'none'}`)
  console.log('No provider calls were made. Re-run with --run only after reviewing cost and models.')
  process.exit(0)
}
if (!config.apiKey) throw new Error('OPENROUTER_API_KEY is required for an explicit evaluation run')
if (!config.allowedModels.length) {
  throw new Error('Configure reviewed OPENROUTER_PRIMARY_MODEL / OPENROUTER_FALLBACK_MODELS first')
}

const source = (fixture) => ({
  record_id: `career:${fixture.careerId}`,
  entity_type: 'career',
  entity_id: fixture.careerId,
  name: fixture.careerName,
  source_url: 'https://example.edu/official-record',
  source_domain: 'example.edu',
  verification_status: 'verified',
  admission_cycle: null,
  last_verified_at: '2026-08-01',
})
const evidence = (fixture) => ({
  student: {
    student_id: fixture.id,
    grade_level: fixture.grade,
    board: 'CBSE',
    current_subjects: fixture.subjects,
    subject_affinities: fixture.subjects,
    subject_avoidances: [],
    academic_band: fixture.id === 'insufficient-college-data' ? '' : '70–85%',
    skills: fixture.skills,
    work_preferences: [],
    values: [],
    budget_band: fixture.id === 'limited-finances-local' ? 'Under ₹50,000' : '',
    location_constraints: fixture.constraints,
    relocation_preference: fixture.id === 'limited-finances-local' ? 'No relocation' : '',
    exam_willingness: fixture.id === 'no-competitive-exams' ? 'Avoid if possible' : 'Open',
    course_duration_preference: fixture.id === 'diploma-employability' ? '1–3 years' : '',
    degree_route_preferences: fixture.id === 'diploma-employability' ? ['Diploma'] : [],
    hard_constraints: fixture.constraints,
    missing_profile_fields: fixture.id === 'insufficient-college-data'
      ? ['location', 'budget', 'academic_band', 'relocation']
      : [],
  },
  primary_career: {
    career_id: fixture.careerId,
    name: fixture.careerName,
    fit_factors: [...fixture.subjects, ...fixture.skills].slice(0, 5),
    concerns: fixture.constraints,
    source_record_ids: [`career:${fixture.careerId}`],
  },
  alternative_careers: [],
  verified_courses: [],
  verified_programmes: [],
  verified_exams: [],
  verified_scholarships: [],
  verified_admission_cycles: [],
  source_records: [source(fixture)],
  deterministic_eligibility: {
    status: 'insufficient_data',
    missing_requirements: ['Verified programme-level eligibility records'],
  },
  missing_data: ['College and programme data is insufficient.'],
})

const report = {
  harnessVersion: 'manyfolds-roadmap-eval-v1',
  createdAt: new Date().toISOString(),
  models: [],
}
for (const model of config.allowedModels) {
  const modelReport = { model, profiles: [], passed: true }
  const summaries = []
  for (const fixture of fixtures) {
    const compacted = compactEvidence(evidence(fixture), config)
    const response = await callOpenRouter(
      config,
      model,
      compacted.evidence,
      config.maxOutputTokens,
      false,
    )
    const validation = parseAndValidateRoadmap(response.rawRoadmap, compacted.evidence)
    const serialized = validation.roadmap ? JSON.stringify(validation.roadmap).toLowerCase() : ''
    const mentionsSignal = serialized.includes(fixture.expectedSignal.toLowerCase())
    const missingHandled =
      fixture.id !== 'insufficient-college-data' ||
      validation.roadmap?.eligibility_summary.status === 'insufficient_data'
    const profilePassed =
      validation.schemaValid &&
      validation.factualValid &&
      mentionsSignal &&
      missingHandled &&
      response.usage.totalTokens <= config.maxTotalTokens
    modelReport.profiles.push({
      id: fixture.id,
      schemaValid: validation.schemaValid,
      factualValid: validation.factualValid,
      mentionsExpectedSignal: mentionsSignal,
      missingDataHandled: missingHandled,
      tokenUsage: response.usage,
      latencyMs: response.latencyMs,
      errors: validation.errors,
      passed: profilePassed,
    })
    if (validation.roadmap) summaries.push(validation.roadmap.summary)
    if (!profilePassed) modelReport.passed = false
  }
  const uniqueSummaries = new Set(
    summaries.map((summary) => createHash('sha256').update(summary).digest('hex')),
  ).size
  modelReport.distinctSummaryRate = uniqueSummaries / fixtures.length
  if (modelReport.distinctSummaryRate < 0.8) modelReport.passed = false
  report.models.push(modelReport)
}

await mkdir('reports', { recursive: true })
const path = `reports/roadmap-model-evaluation-${Date.now()}.json`
await writeFile(path, JSON.stringify(report, null, 2))
console.log(`Evaluation report written to ${path}`)
if (report.models.some((model) => !model.passed)) process.exitCode = 1
