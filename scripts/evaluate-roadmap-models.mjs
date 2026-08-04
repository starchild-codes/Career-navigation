import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { loadEnv } from 'vite'
import { createAiConfig } from '../server/ai/config.ts'
import { callOpenRouter, OpenRouterError } from '../server/ai/openrouter.ts'
import { ROADMAP_PROMPT_VERSION } from '../server/ai/prompt.ts'
import { compactEvidence } from '../server/ai/tokens.ts'
import { parseAndValidateRoadmap } from '../server/ai/validation.ts'

const HARNESS_VERSION = 'manyfolds-roadmap-eval-v2'
const SCHEMA_VERSION = 'manyfolds-roadmap-schema-v1'
const EXPECTED_PROFILE_IDS = [
  'class10-psych-biology',
  'class12-pcm-engineering',
  'psychology-computing',
  'history-chemistry',
  'limited-finances-local',
  'no-competitive-exams',
  'missing-compulsory-subject',
  'changing-interests',
  'diploma-employability',
  'insufficient-college-data',
]

const env = loadEnv('development', process.cwd(), '')
const config = createAiConfig(env)
const fixtures = JSON.parse(
  await readFile('scripts/fixtures/roadmap-evaluation-profiles.json', 'utf8'),
)
const runPaidEvaluation = process.argv.includes('--run')
const skippedModelIds = new Set(
  process.argv
    .filter((argument) => argument.startsWith('--skip-model='))
    .map((argument) => argument.slice('--skip-model='.length)),
)

const sha = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex')

const source = (fixture) => ({
  record_id: `career:${fixture.careerId}`,
  entity_type: 'career',
  entity_id: fixture.careerId,
  name: fixture.careerName,
  source_url: 'https://www.ncs.gov.in/',
  source_domain: 'ncs.gov.in',
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
    exam_willingness:
      fixture.id === 'no-competitive-exams' ? 'Unwilling to take competitive examinations' : 'Open',
    course_duration_preference: fixture.id === 'diploma-employability' ? '1–3 years' : '',
    degree_route_preferences: fixture.id === 'diploma-employability' ? ['Diploma'] : [],
    hard_constraints: fixture.constraints,
    missing_profile_fields:
      fixture.id === 'insufficient-college-data'
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
  missing_data: [
    'Verified institution-programme, eligibility, admission-cycle, fee, and scholarship records are unavailable.',
  ],
})

const price = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.POSITIVE_INFINITY
}

const catalogueResponse = await fetch('https://openrouter.ai/api/v1/models', {
  signal: AbortSignal.timeout(12_000),
})
if (!catalogueResponse.ok) {
  throw new Error(`OpenRouter model catalogue returned ${catalogueResponse.status}`)
}
const catalogue = (await catalogueResponse.json()).data || []
const catalogueById = new Map(catalogue.map((model) => [model.id, model]))

if (!config.apiKey) throw new Error('OPENROUTER_API_KEY is missing')
if (!config.allowedModels.length) throw new Error('No reviewed candidate model IDs are configured')
if (
  fixtures.length !== EXPECTED_PROFILE_IDS.length ||
  fixtures.some((fixture, index) => fixture.id !== EXPECTED_PROFILE_IDS[index])
) {
  throw new Error('The evaluation fixture set must contain the fixed ten profiles in the reviewed order')
}

const candidates = config.allowedModels.map((id) => {
  const model = catalogueById.get(id)
  if (!model) throw new Error(`Configured model ID is not in the current catalogue: ${id}`)
  const supported = new Set(model.supported_parameters || [])
  const valid =
    !id.includes(':free') &&
    !/(experimental|preview|beta)/i.test(id) &&
    (model.context_length || 0) >= config.maxTotalTokens &&
    supported.has('response_format') &&
    (supported.has('max_tokens') || supported.has('max_completion_tokens'))
  if (!valid) throw new Error(`Configured model does not meet roadmap parameter requirements: ${id}`)
  const promptPrice = price(model.pricing?.prompt)
  const completionPrice = price(model.pricing?.completion)
  const requestFee = Number.isFinite(price(model.pricing?.request))
    ? price(model.pricing?.request)
    : 0
  if (!Number.isFinite(promptPrice) || !Number.isFinite(completionPrice)) {
    throw new Error(`Configured model has no usable catalogue pricing: ${id}`)
  }
  return {
    id,
    displayName: model.name || id,
    promptPrice,
    completionPrice,
    requestFee,
    supportsReasoning: supported.has('reasoning'),
    maximumCostPerCall:
      promptPrice * config.maxInputTokens +
      completionPrice * config.maxOutputTokens +
      requestFee,
  }
})

const compactedFixtures = fixtures.map((fixture) => {
  const compacted = compactEvidence(evidence(fixture), config)
  return {
    fixture,
    evidence: compacted.evidence,
    estimatedInputTokens: compacted.estimatedInputTokens,
    evidenceHash: sha(compacted.evidence),
  }
})
if (new Set(compactedFixtures.map((item) => item.evidenceHash)).size !== fixtures.length) {
  throw new Error('Materially different fixtures did not produce distinct evidence packages')
}

const maximumCalls = candidates.length * fixtures.length
const maximumRetries = 0
const maximumTokens = maximumCalls * config.maxTotalTokens
const maximumCost = candidates.reduce(
  (sum, candidate) => sum + candidate.maximumCostPerCall * fixtures.length,
  0,
)
const reportDate = new Date().toISOString().slice(0, 10)
const reportDirectory = 'docs/evaluation-results'
const reportStem = `${reportDirectory}/roadmap-model-evaluation-${reportDate}`

console.log('Manyfolds roadmap evaluation preflight passed.')
console.log(`Prompt: ${ROADMAP_PROMPT_VERSION}; schema: ${SCHEMA_VERSION}; harness: ${HARNESS_VERSION}`)
console.log(`Candidates: ${candidates.length}; profiles: ${fixtures.length}`)
console.log(`Maximum calls: ${maximumCalls}; maximum retries: ${maximumRetries}`)
console.log(
  `Limits per call: ${config.maxInputTokens} input / ${config.maxOutputTokens} output / ${config.maxTotalTokens} total`,
)
console.log(`Maximum possible tokens: ${maximumTokens}`)
for (const candidate of candidates) {
  console.log(
    `${candidate.id}: prompt $${candidate.promptPrice}/token, completion $${candidate.completionPrice}/token, maximum $${candidate.maximumCostPerCall.toFixed(6)}/call, $${(candidate.maximumCostPerCall * fixtures.length).toFixed(6)}/10 profiles`,
  )
}
console.log(`Maximum estimated evaluation cost: $${maximumCost.toFixed(6)}`)
console.log(`Report output: ${reportStem}.{json,md}`)
if (maximumCost > 1) {
  throw new Error('Projected evaluation cost exceeds the USD 1.00 stop limit')
}
if (!runPaidEvaluation) {
  console.log('No provider calls were made. Use npm run ai:evaluate:run for the controlled paid run.')
} else {
const words = (value) =>
  new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3),
  )
const jaccard = (a, b) => {
  const left = words(a)
  const right = words(b)
  const intersection = [...left].filter((word) => right.has(word)).length
  const union = new Set([...left, ...right]).size
  return union ? intersection / union : 1
}

const rawSafetyChecks = (raw, item) => {
  const roadmap = raw && typeof raw === 'object' ? raw : {}
  const text = JSON.stringify(roadmap).toLowerCase()
  const allowedSources = new Set(item.evidence.source_records.map((entry) => entry.record_id))
  const unsupportedRecordIds = []
  if (roadmap.career_id && roadmap.career_id !== item.evidence.primary_career.career_id) {
    unsupportedRecordIds.push(roadmap.career_id)
  }
  for (const course of Array.isArray(roadmap.course_options) ? roadmap.course_options : []) {
    if (!item.evidence.verified_courses.some((entry) => entry.course_id === course.course_id)) {
      unsupportedRecordIds.push(course.course_id)
    }
  }
  for (const programme of Array.isArray(roadmap.college_programmes)
    ? roadmap.college_programmes
    : []) {
    if (
      !item.evidence.verified_programmes.some(
        (entry) => entry.programme_id === programme.programme_id,
      )
    ) {
      unsupportedRecordIds.push(programme.programme_id)
    }
  }
  for (const exam of Array.isArray(roadmap.exam_steps) ? roadmap.exam_steps : []) {
    if (!item.evidence.verified_exams.some((entry) => entry.exam_id === exam.exam_id)) {
      unsupportedRecordIds.push(exam.exam_id)
    }
  }
  const sourceIds = []
  const collectSourceIds = (value) => {
    if (!value || typeof value !== 'object') return
    for (const [key, nested] of Object.entries(value)) {
      if (key === 'source_record_ids' && Array.isArray(nested)) sourceIds.push(...nested)
      else if (typeof nested === 'object') collectSourceIds(nested)
    }
  }
  collectSourceIds(roadmap)
  unsupportedRecordIds.push(...sourceIds.filter((id) => !allowedSources.has(id)))

  const status = roadmap.eligibility_summary?.status
  const eligibilityContradiction =
    (item.evidence.deterministic_eligibility.status === 'insufficient_data' &&
      status !== 'insufficient_data') ||
    (item.fixture.id === 'missing-compulsory-subject' && status === 'eligible')
  const hardConstraintPatterns = {
    'limited-finances-local': /(budget|cost|afford|local|near home|public option)/,
    'no-competitive-exams': /(unwilling|avoid|alternative|without.*exam|exam.*constraint)/,
    'missing-compulsory-subject': /(missing|required).*mathematics|mathematics.*(missing|required)/,
    'changing-interests': /(interdisciplinary|literature|mathematics|fine arts|biology)/,
    'diploma-employability': /(diploma|employability|technical training)/,
    'insufficient-college-data': /(insufficient|unverified|missing|not yet verified)/,
  }
  const requiredPattern = hardConstraintPatterns[item.fixture.id]
  const ignoredHardConstraints = requiredPattern && !requiredPattern.test(text)
    ? item.evidence.student.hard_constraints
    : []
  const missingDataHandled =
    status === 'insufficient_data' &&
    Array.isArray(roadmap.missing_or_unverified) &&
    roadmap.missing_or_unverified.length > 0 &&
    (!Array.isArray(roadmap.college_programmes) || roadmap.college_programmes.length === 0)
  const unverifiedAdmissionsFact =
    /\b(iit|aiims|nlu|university of|college of)\b/.test(text) ||
    /(?:₹|inr)\s?\d/.test(text) ||
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(text) ||
    /\b(eligible for|accepts (?:jee|neet|cuet)|admission deadline is)\b/.test(text)
  const overRecommendsElite = /\b(iit|aiims|iim|nlu)\b/.test(text)
  const preservesInterdisciplinaryInterests =
    item.fixture.id !== 'psychology-computing' && item.fixture.id !== 'changing-interests'
      ? true
      : item.fixture.subjects.filter((subject) => text.includes(subject.toLowerCase())).length >= 2

  return {
    unsupportedRecordIds: [...new Set(unsupportedRecordIds.filter(Boolean))],
    inventedEntityCount: [...new Set(unsupportedRecordIds.filter(Boolean))].length,
    eligibilityContradiction,
    ignoredHardConstraints,
    missingDataHandled,
    unverifiedAdmissionsFact,
    overRecommendsElite,
    preservesInterdisciplinaryInterests,
    mentionsExpectedSignal: text.includes(item.fixture.expectedSignal.toLowerCase()),
  }
}

const report = {
  harnessVersion: HARNESS_VERSION,
  promptVersion: ROADMAP_PROMPT_VERSION,
  schemaVersion: SCHEMA_VERSION,
  createdAt: new Date().toISOString(),
  preflight: {
    candidateCount: candidates.length,
    profileCount: fixtures.length,
    maximumCalls,
    maximumRetries,
    maxInputTokensPerCall: config.maxInputTokens,
    maxOutputTokensPerCall: config.maxOutputTokens,
    maxTotalTokensPerCall: config.maxTotalTokens,
    maximumPossibleTokens: maximumTokens,
    maximumEstimatedCostUsd: maximumCost,
    evidencePackagesDistinct: true,
    liveDataEnabled: config.liveDataEnabled,
  },
  models: [],
  approval: { primary: null, fallback: null },
  priorPaidCallsWithoutRetainedMetrics: skippedModelIds.size * fixtures.length,
}

let paidCalls = report.priorPaidCallsWithoutRetainedMetrics
for (const candidate of candidates) {
  const modelReport = {
    model: candidate.id,
    cataloguePricing: {
      promptPerToken: candidate.promptPrice,
      completionPerToken: candidate.completionPrice,
      requestFee: candidate.requestFee,
    },
    profiles: [],
  }
  if (skippedModelIds.has(candidate.id)) {
    modelReport.profiles = compactedFixtures.map((item) => ({
      id: item.fixture.id,
      evidenceHash: item.evidenceHash,
      evidenceInputEstimate: item.estimatedInputTokens,
      requestedModel: candidate.id,
      actualModelUsed: null,
      schemaValid: false,
      factualValid: false,
      unsupportedRecordIds: [],
      inventedEntityCount: 0,
      eligibilityContradiction: false,
      ignoredHardConstraints: item.evidence.student.hard_constraints,
      missingDataHandled: false,
      unverifiedAdmissionsFact: false,
      preservesInterdisciplinaryInterests: false,
      overRecommendsElite: false,
      mentionsExpectedSignal: false,
      promptTokens: 0,
      completionTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
      tokenLimitViolation: false,
      reportedCostUsd: null,
      estimatedCostUsd: candidate.maximumCostPerCall,
      costMeasurementRetained: false,
      latencyMs: 0,
      retryCount: 0,
      errorStatus: 'local_report_aggregation_failure',
      validationErrors: ['Measurements were not retained after a local aggregation failure.'],
      outputFingerprint: null,
      distinctivenessText: '',
      passed: false,
    }))
  } else {
  for (const item of compactedFixtures) {
    const started = Date.now()
    try {
      paidCalls += 1
      const response = await callOpenRouter(
        config,
        candidate.id,
        item.evidence,
        config.maxOutputTokens,
        candidate.supportsReasoning,
      )
      const validation = parseAndValidateRoadmap(response.rawRoadmap, item.evidence)
      const safety = rawSafetyChecks(response.rawRoadmap, item)
      const estimatedCost =
        candidate.promptPrice * response.usage.inputTokens +
        candidate.completionPrice * response.usage.outputTokens +
        candidate.requestFee
      const tokenLimitViolation =
        response.usage.inputTokens > config.maxInputTokens ||
        response.usage.outputTokens > config.maxOutputTokens ||
        response.usage.totalTokens > config.maxTotalTokens
      const passed =
        validation.schemaValid &&
        validation.factualValid &&
        safety.unsupportedRecordIds.length === 0 &&
        safety.inventedEntityCount === 0 &&
        !safety.eligibilityContradiction &&
        safety.ignoredHardConstraints.length === 0 &&
        safety.missingDataHandled &&
        !safety.unverifiedAdmissionsFact &&
        !tokenLimitViolation
      modelReport.profiles.push({
        id: item.fixture.id,
        evidenceHash: item.evidenceHash,
        evidenceInputEstimate: item.estimatedInputTokens,
        requestedModel: candidate.id,
        actualModelUsed: response.modelUsed,
        schemaValid: validation.schemaValid,
        factualValid: validation.factualValid,
        unsupportedRecordIds: safety.unsupportedRecordIds,
        inventedEntityCount: safety.inventedEntityCount,
        eligibilityContradiction: safety.eligibilityContradiction,
        ignoredHardConstraints: safety.ignoredHardConstraints,
        missingDataHandled: safety.missingDataHandled,
        unverifiedAdmissionsFact: safety.unverifiedAdmissionsFact,
        preservesInterdisciplinaryInterests: safety.preservesInterdisciplinaryInterests,
        overRecommendsElite: safety.overRecommendsElite,
        mentionsExpectedSignal: safety.mentionsExpectedSignal,
        promptTokens: response.usage.inputTokens,
        completionTokens: response.usage.outputTokens,
        reasoningTokens: response.usage.reasoningTokens,
        totalTokens: response.usage.totalTokens,
        tokenLimitViolation,
        reportedCostUsd: response.usage.reportedCost,
        estimatedCostUsd: estimatedCost,
        costMeasurementRetained: true,
        latencyMs: response.latencyMs,
        retryCount: 0,
        errorStatus: null,
        validationErrors: validation.errors,
        outputFingerprint: validation.roadmap ? sha(validation.roadmap) : null,
        distinctivenessText: validation.roadmap
          ? [
              validation.roadmap.roadmap_title,
              validation.roadmap.summary,
              ...validation.roadmap.why_it_fits.map((factor) => factor.student_evidence),
              ...validation.roadmap.stages.map((stage) => stage.description),
            ].join(' ')
          : '',
        passed,
      })
    } catch (error) {
      modelReport.profiles.push({
        id: item.fixture.id,
        evidenceHash: item.evidenceHash,
        evidenceInputEstimate: item.estimatedInputTokens,
        requestedModel: candidate.id,
        actualModelUsed: null,
        schemaValid: false,
        factualValid: false,
        unsupportedRecordIds: [],
        inventedEntityCount: 0,
        eligibilityContradiction: false,
        ignoredHardConstraints: item.evidence.student.hard_constraints,
        missingDataHandled: false,
        unverifiedAdmissionsFact: false,
        preservesInterdisciplinaryInterests: false,
        overRecommendsElite: false,
        mentionsExpectedSignal: false,
        promptTokens: 0,
        completionTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
        tokenLimitViolation: false,
        reportedCostUsd: null,
        estimatedCostUsd: 0,
        costMeasurementRetained: true,
        latencyMs: Date.now() - started,
        retryCount: 0,
        errorStatus: error instanceof OpenRouterError ? error.statusCode : null,
        validationErrors: [error instanceof Error ? error.message : 'Unknown provider error'],
        outputFingerprint: null,
        distinctivenessText: '',
        passed: false,
      })
    }
  }
  }

  for (const profile of modelReport.profiles) {
    const comparisons = modelReport.profiles
      .filter(
        (other) =>
          other.id !== profile.id &&
          profile.distinctivenessText &&
          other.distinctivenessText,
      )
      .map((other) => jaccard(profile.distinctivenessText, other.distinctivenessText))
    profile.maximumSimilarity = comparisons.length ? Math.max(...comparisons) : 1
    profile.materiallyDistinct = Boolean(profile.distinctivenessText) && profile.maximumSimilarity < 0.75
    delete profile.distinctivenessText
  }

  const profiles = modelReport.profiles
  const sum = (field) => profiles.reduce((total, profile) => total + Number(profile[field] || 0), 0)
  const sortedLatency = profiles.map((profile) => profile.latencyMs).sort((a, b) => a - b)
  const p95Index = Math.max(0, Math.ceil(sortedLatency.length * 0.95) - 1)
  const measuredProfiles = profiles.filter((profile) => profile.costMeasurementRetained)
  const actualTotalCost = measuredProfiles.reduce(
    (total, profile) => total + (profile.reportedCostUsd ?? profile.estimatedCostUsd),
    0,
  )
  const unmeasuredCostUpperBound = profiles
    .filter((profile) => !profile.costMeasurementRetained)
    .reduce((total, profile) => total + profile.estimatedCostUsd, 0)
  const mandatory = {
    schemaValidity: profiles.every((profile) => profile.schemaValid),
    grounding: profiles.every(
      (profile) =>
        profile.factualValid &&
        profile.unsupportedRecordIds.length === 0 &&
        profile.inventedEntityCount === 0,
    ),
    eligibility: profiles.every((profile) => !profile.eligibilityContradiction),
    hardConstraints: profiles.every((profile) => profile.ignoredHardConstraints.length === 0),
    tokenLimits: profiles.every((profile) => !profile.tokenLimitViolation),
    verifiedAdmissionsOnly: profiles.every((profile) => !profile.unverifiedAdmissionsFact),
    missingDataHandling: profiles.every((profile) => profile.missingDataHandled),
    distinctiveness: profiles.filter((profile) => profile.materiallyDistinct).length >= 9,
  }
  modelReport.metrics = {
    schemaPassRate: profiles.filter((profile) => profile.schemaValid).length / profiles.length,
    groundingPassRate:
      profiles.filter(
        (profile) =>
          profile.factualValid &&
          profile.unsupportedRecordIds.length === 0 &&
          profile.inventedEntityCount === 0,
      ).length / profiles.length,
    constraintPassRate:
      profiles.filter(
        (profile) =>
          !profile.eligibilityContradiction && profile.ignoredHardConstraints.length === 0,
      ).length / profiles.length,
    missingDataPassRate:
      profiles.filter((profile) => profile.missingDataHandled).length / profiles.length,
    distinctProfiles: profiles.filter((profile) => profile.materiallyDistinct).length,
    averageInputTokens: sum('promptTokens') / profiles.length,
    averageOutputTokens: sum('completionTokens') / profiles.length,
    averageTotalTokens: sum('totalTokens') / profiles.length,
    totalTokens: sum('totalTokens'),
    averageLatencyMs: sum('latencyMs') / profiles.length,
    p95LatencyMs: sortedLatency[p95Index],
    actualTotalCostUsd: actualTotalCost,
    unmeasuredCostUpperBoundUsd: unmeasuredCostUpperBound,
    averageCostPerRoadmapUsd:
      measuredProfiles.length > 0 ? actualTotalCost / measuredProfiles.length : null,
    projectedCostPer1000Usd:
      measuredProfiles.length > 0 ? (actualTotalCost / measuredProfiles.length) * 1000 : null,
    projectedCostPer10000Usd:
      measuredProfiles.length > 0 ? (actualTotalCost / measuredProfiles.length) * 10000 : null,
  }
  modelReport.mandatoryThresholds = mandatory
  modelReport.approved = Object.values(mandatory).every(Boolean)
  report.models.push(modelReport)
}

const passing = report.models
  .filter((model) => model.approved)
  .sort((left, right) => {
    const leftCandidate = candidates.find((candidate) => candidate.id === left.model)
    const rightCandidate = candidates.find((candidate) => candidate.id === right.model)
    return leftCandidate.maximumCostPerCall - rightCandidate.maximumCostPerCall
  })
report.approval.primary = passing[0]?.model || null
report.approval.fallback = passing[1]?.model || null
report.paidCalls = paidCalls
report.actualTotalCostUsd = report.models.reduce(
  (total, model) => total + model.metrics.actualTotalCostUsd,
  0,
)
report.unmeasuredCostUpperBoundUsd = report.models.reduce(
  (total, model) => total + model.metrics.unmeasuredCostUpperBoundUsd,
  0,
)

const percentage = (value) => `${Math.round(value * 100)}%`
const markdown = [
  '# Manyfolds roadmap model evaluation',
  '',
  `Evaluation date: ${reportDate}`,
  `Prompt: \`${ROADMAP_PROMPT_VERSION}\` · Schema: \`${SCHEMA_VERSION}\` · Harness: \`${HARNESS_VERSION}\``,
  `Paid calls: ${paidCalls} · Actual total cost: $${report.actualTotalCostUsd.toFixed(6)}`,
  '',
  '| Model | Schema pass | Grounding pass | Constraint pass | Distinct profiles | Avg tokens | Avg cost | Avg latency | Approved |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---|',
  ...report.models.map(
    (model) =>
      `| ${model.model} | ${percentage(model.metrics.schemaPassRate)} | ${percentage(model.metrics.groundingPassRate)} | ${percentage(model.metrics.constraintPassRate)} | ${model.metrics.distinctProfiles}/10 | ${model.metrics.averageTotalTokens.toFixed(0)} | ${model.metrics.averageCostPerRoadmapUsd === null ? 'Not retained' : `$${model.metrics.averageCostPerRoadmapUsd.toFixed(6)}`} | ${model.metrics.averageLatencyMs.toFixed(0)} ms | ${model.approved ? 'Yes' : 'No'} |`,
  ),
  '',
  `Approved primary: ${report.approval.primary || 'None'}`,
  `Approved fallback: ${report.approval.fallback || 'None'}`,
  '',
  '## Capability boundary',
  '',
  'Verified career-fit explanations, career exploration, subject and skill connections, trade-offs, alternatives, counsellor questions, immediate actions, and missing-data warnings are supported.',
  '',
  'Institution-programme offerings, exact eligibility, compulsory subjects, accepted exams, current cycles, deadlines, fees, scholarship eligibility, admission probability, competitiveness categories, and exact course-to-college relationships are not supported without verified programme-level records.',
  '',
  'The JSON report contains the per-profile validation, usage, cost, latency, constraint, grounding, and distinctiveness results. It stores no prompts, chain-of-thought, raw provider responses, secrets, or private student records.',
  '',
].join('\n')

await mkdir(reportDirectory, { recursive: true })
await writeFile(`${reportStem}.json`, JSON.stringify(report, null, 2))
await writeFile(`${reportStem}.md`, markdown)

console.log(`Evaluation report written to ${reportStem}.{json,md}`)
console.log(`Paid calls: ${paidCalls}; actual total cost: $${report.actualTotalCostUsd.toFixed(6)}`)
console.log(`Approved primary: ${report.approval.primary || 'none'}`)
console.log(`Approved fallback: ${report.approval.fallback || 'none'}`)
if (!passing.length) process.exitCode = 1
}
