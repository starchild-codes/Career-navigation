import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { ROADMAP_PROMPT_VERSION } from '../server/ai/prompt.ts'
import { compactEvidence } from '../server/ai/tokens.ts'
import { parseAndValidateRoadmap } from '../server/ai/validation.ts'

export const HARNESS_VERSION = 'manyfolds-roadmap-eval-v5'
export const SCHEMA_VERSION = 'manyfolds-roadmap-schema-v2'
export const PROFILE_IDS = [
  'class10-psych-biology', 'class12-pcm-engineering', 'psychology-computing',
  'history-chemistry', 'limited-finances-local', 'no-competitive-exams',
  'missing-compulsory-subject', 'changing-interests', 'diploma-employability',
  'insufficient-college-data',
]

export const sha = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')

const source = (fixture) => ({
  record_id: `career:${fixture.careerId}`, entity_type: 'career', entity_id: fixture.careerId,
  name: fixture.careerName, source_url: 'https://www.ncs.gov.in/', source_domain: 'ncs.gov.in',
  verification_status: 'verified', admission_cycle: null, last_verified_at: '2026-08-01',
})

const evidence = (fixture) => ({
  student: {
    student_id: fixture.id, grade_level: fixture.grade, board: 'CBSE', current_subjects: fixture.subjects,
    subject_affinities: fixture.subjects, subject_avoidances: [], academic_band: fixture.id === 'insufficient-college-data' ? '' : '70–85%',
    skills: fixture.skills, work_preferences: [], values: [], budget_band: fixture.id === 'limited-finances-local' ? 'Under ₹50,000' : '',
    location_constraints: fixture.constraints, relocation_preference: fixture.id === 'limited-finances-local' ? 'No relocation' : '',
    exam_willingness: fixture.id === 'no-competitive-exams' ? 'Unwilling to take competitive examinations' : 'Open',
    course_duration_preference: fixture.id === 'diploma-employability' ? '1–3 years' : '',
    degree_route_preferences: fixture.id === 'diploma-employability' ? ['Diploma'] : [],
    hard_constraints: fixture.constraints,
    missing_profile_fields: fixture.id === 'insufficient-college-data' ? ['location', 'budget', 'academic_band', 'relocation'] : [],
  },
  primary_career: { career_id: fixture.careerId, name: fixture.careerName, fit_factors: [...fixture.subjects, ...fixture.skills].slice(0, 5), concerns: fixture.constraints, source_record_ids: [`career:${fixture.careerId}`] },
  alternative_careers: [], verified_courses: [], verified_programmes: [], verified_exams: [], verified_scholarships: [], verified_relationships: [], verified_admission_cycles: [], source_records: [source(fixture)],
  deterministic_eligibility: { status: 'insufficient_data', missing_requirements: ['Verified programme-level eligibility records'] },
  missing_data: ['Verified institution-programme, eligibility, admission-cycle, fee, and scholarship records are unavailable.'],
  personalisation: { hard_constraints: fixture.constraints, high_priority_preferences: [], mixed_interest_combinations: fixture.subjects.length > 1 ? [fixture.subjects.join(' + ')] : [], eligibility_risks: fixture.constraints.filter((x) => /missing|required/i.test(x)), financial_constraints: fixture.constraints.filter((x) => /tuition|budget|cost/i.test(x)), exam_constraints: fixture.constraints.filter((x) => /exam/i.test(x)), route_preferences: fixture.id === 'diploma-employability' ? ['Diploma and early employability'] : [], required_personalisation_effects: [{ profile_factor: fixture.id === 'insufficient-college-data' ? 'insufficient_profile_data' : `${fixture.grade}:${fixture.subjects.join('+')}:${fixture.skills.join('+')}`, roadmap_sections_affected: ['summary','why_it_fits','important_tradeoffs','next_actions'] }] },
})

export function makeEvaluationItems(fixtures, config) {
  if (fixtures.length !== PROFILE_IDS.length || fixtures.some((item, index) => item.id !== PROFILE_IDS[index])) {
    throw new Error('The evaluation fixture set must contain the fixed ten profiles in the reviewed order')
  }
  const items = fixtures.map((fixture) => {
    const compacted = compactEvidence(evidence(fixture), config)
    return { fixture, evidence: compacted.evidence, evidenceHash: sha(compacted.evidence), estimatedInputTokens: compacted.estimatedInputTokens }
  })
  if (new Set(items.map((item) => item.evidenceHash)).size !== items.length) throw new Error('Distinct profiles produced duplicate evidence packages')
  return items
}

const textValue = (value) => JSON.stringify(value || {}).toLowerCase()
export function assessRoadmap(raw, item, validation) {
  const output = raw && typeof raw === 'object' ? raw : {}
  const text = textValue(output)
  const sourceIds = new Set(item.evidence.source_records.map((record) => record.record_id))
  const unsupported = []
  if (output.career_id && output.career_id !== item.evidence.primary_career.career_id) unsupported.push(output.career_id)
  for (const collection of ['course_options', 'college_programmes', 'exam_steps']) {
    for (const record of Array.isArray(output[collection]) ? output[collection] : []) {
      if (record.course_id || record.programme_id || record.exam_id) unsupported.push(record.course_id || record.programme_id || record.exam_id)
    }
  }
  const suppliedIds = new Set([item.evidence.primary_career.career_id])
  const unsupportedIds = [...new Set(unsupported.filter((id) => !suppliedIds.has(id)))]
  const collectedSources = []
  const collect = (value) => {
    if (!value || typeof value !== 'object') return
    for (const [key, nested] of Object.entries(value)) {
      if (key === 'source_record_ids' && Array.isArray(nested)) collectedSources.push(...nested)
      else collect(nested)
    }
  }
  collect(output)
  unsupportedIds.push(...collectedSources.filter((id) => !sourceIds.has(id)))
  const status = output.eligibility_summary?.status
  const eligibilityContradiction = status !== 'insufficient_data'
  const patterns = {
    'limited-finances-local': /(budget|cost|afford|local|near home|public option)/,
    'no-competitive-exams': /(unwilling|avoid|alternative|without.*exam|exam.*constraint)/,
    'missing-compulsory-subject': /(missing|required).*mathematics|mathematics.*(missing|required)/,
    'changing-interests': /(interdisciplinary|literature|mathematics|fine arts|biology)/,
    'diploma-employability': /(diploma|employability|technical training)/,
    'insufficient-college-data': /(insufficient|unverified|missing|not yet verified)/,
  }
  const pattern = patterns[item.fixture.id]
  const ignoredHardConstraints = pattern && !pattern.test(text) ? item.evidence.student.hard_constraints : []
  const missingDataHandled = status === 'insufficient_data' && Array.isArray(output.missing_or_unverified) && output.missing_or_unverified.length > 0 && (!Array.isArray(output.college_programmes) || output.college_programmes.length === 0)
  const unverifiedAdmissionsFact = /\b(iit|aiims|nlu|university of|college of)\b/.test(text) || /(?:₹|inr)\s?\d/.test(text) || /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(text) || /\b(eligible for|accepts (?:jee|neet|cuet)|admission deadline is)\b/.test(text)
  return {
    unsupportedRecordIds: [...new Set(unsupportedIds.filter(Boolean))],
    inventedEntityCount: [...new Set(unsupportedIds.filter(Boolean))].length,
    eligibilityContradiction,
    ignoredHardConstraints,
    missingDataHandled,
    unverifiedAdmissionsFact,
    nativeFactualValid: validation.factualValid,
    outputFingerprint: validation.roadmap ? sha(validation.roadmap) : null,
  }
}

export async function aggregateRun(pool, runId) {
  const runResult = await pool.query('select * from ai_evaluation_runs where id=$1', [runId])
  if (!runResult.rowCount) throw new Error('Evaluation run not found')
  const run = runResult.rows[0]
  const calls = (await pool.query('select * from ai_evaluation_calls where run_id=$1 order by sequence', [runId])).rows
  const models = []
  for (const model of run.candidate_models) {
    const profiles = calls.filter((call) => call.model_id === model).map((call) => ({
      id: call.profile_id, status: call.status, nativeSchemaValid: Boolean(call.native_schema_valid), repairedSchemaValid: Boolean(call.repaired_schema_valid), factualValid: Boolean(call.factual_valid),
      safety: call.safety || {}, promptTokens: call.prompt_tokens, completionTokens: call.completion_tokens, reasoningTokens: call.reasoning_tokens, totalTokens: call.total_tokens,
      reportedCostUsd: call.reported_cost === null ? null : Number(call.reported_cost), estimatedCostUsd: call.estimated_cost === null ? 0 : Number(call.estimated_cost), latencyMs: call.latency_ms || 0,
      errorStatus: call.provider_error_status, errors: call.validation_errors || [], output: call.structured_output,
    }))
    for (const profile of profiles) {
      const prose = profile.output ? JSON.stringify(profile.output) : ''
      const fixture = PROFILE_IDS.includes(profile.id) ? profile.id : ''
      const expected = { 'class10-psych-biology': /psychology|biology|class 10/i, 'class12-pcm-engineering': /physics|chemistry|mathematics|engineering/i, 'psychology-computing': /psychology|computer|coding|ux/i, 'history-chemistry': /history|chemistry|environment/i, 'limited-finances-local': /budget|cost|near home|local/i, 'no-competitive-exams': /exam|competitive|alternative/i, 'missing-compulsory-subject': /missing|required.*mathematics/i, 'changing-interests': /interdisciplinary|literature|fine arts|biology/i, 'diploma-employability': /diploma|employability|technical/i, 'insufficient-college-data': /insufficient|missing|unverified/i }[fixture]
      profile.materiallyDistinct = Boolean(prose) && Boolean(expected?.test(prose))
    }
    const every = (predicate) => profiles.length === 10 && profiles.every(predicate)
    const avg = (field) => profiles.reduce((sum, item) => sum + Number(item[field] || 0), 0) / Math.max(1, profiles.length)
    const sortedLatency = profiles.map((item) => item.latencyMs).sort((a, b) => a - b)
    const thresholds = {
      safeRepairSchemaValidity: every((item) => item.repairedSchemaValid),
      grounding: every((item) => item.factualValid && item.safety.inventedEntityCount === 0 && (item.safety.unsupportedRecordIds || []).length === 0),
      constraints: every((item) => !item.safety.eligibilityContradiction && (item.safety.ignoredHardConstraints || []).length === 0),
      tokenLimits: every((item) => item.promptTokens <= run.preflight.maxInputTokensPerCall && item.completionTokens <= run.preflight.maxOutputTokensPerCall && item.totalTokens <= run.preflight.maxTotalTokensPerCall),
      verifiedAdmissionsOnly: every((item) => !item.safety.unverifiedAdmissionsFact),
      missingData: every((item) => item.safety.missingDataHandled),
      distinctness: profiles.filter((item) => item.materiallyDistinct).length >= 9,
    }
    models.push({
      model, profiles, thresholds, approved: Object.values(thresholds).every(Boolean),
      metrics: { nativeSchemaPassRate: profiles.filter((item) => item.nativeSchemaValid).length / Math.max(1, profiles.length), safeRepairSchemaPassRate: profiles.filter((item) => item.repairedSchemaValid).length / Math.max(1, profiles.length), groundingPassRate: profiles.filter((item) => item.factualValid && item.safety.inventedEntityCount === 0 && (item.safety.unsupportedRecordIds || []).length === 0).length / Math.max(1, profiles.length), constraintPassRate: profiles.filter((item) => !item.safety.eligibilityContradiction && (item.safety.ignoredHardConstraints || []).length === 0).length / Math.max(1, profiles.length), missingDataPassRate: profiles.filter((item) => item.safety.missingDataHandled).length / Math.max(1, profiles.length), distinctProfiles: profiles.filter((item) => item.materiallyDistinct).length, averageInputTokens: avg('promptTokens'), averageOutputTokens: avg('completionTokens'), averageTotalTokens: avg('totalTokens'), totalTokens: profiles.reduce((sum, item) => sum + item.totalTokens, 0), averageLatencyMs: avg('latencyMs'), p95LatencyMs: sortedLatency[Math.max(0, Math.ceil(sortedLatency.length * .95) - 1)] || 0, totalCostUsd: profiles.reduce((sum, item) => sum + (item.reportedCostUsd ?? item.estimatedCostUsd), 0) },
    })
  }
  const approved = models.filter((model) => model.approved).sort((a, b) => a.metrics.totalCostUsd - b.metrics.totalCostUsd)
  const stamp = new Date().toISOString().slice(0, 10)
  const reportPath = `docs/evaluation-results/roadmap-model-evaluation-${stamp}-${runId.slice(0, 8)}`
  const report = { harnessVersion: run.harness_version, promptVersion: run.prompt_version, schemaVersion: run.schema_version, runId, createdAt: run.created_at, preflight: run.preflight, actualCalls: calls.length, actualTotalCostUsd: models.reduce((sum, model) => sum + model.metrics.totalCostUsd, 0), models, approval: { primary: approved[0]?.model || null, fallback: approved[1]?.model || null } }
  const pct = (value) => `${Math.round(value * 100)}%`
  const markdown = ['# Manyfolds roadmap model evaluation', '', `Run: \`${runId}\``, `Paid calls: ${report.actualCalls} · Cost: $${report.actualTotalCostUsd.toFixed(6)}`, '', '| Model | Native schema | Safe repair | Grounding | Constraints | Missing data | Distinct | Avg tokens | Avg latency | Approved |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|', ...models.map((model) => `| ${model.model} | ${pct(model.metrics.nativeSchemaPassRate)} | ${pct(model.metrics.safeRepairSchemaPassRate)} | ${pct(model.metrics.groundingPassRate)} | ${pct(model.metrics.constraintPassRate)} | ${pct(model.metrics.missingDataPassRate)} | ${model.metrics.distinctProfiles}/10 | ${model.metrics.averageTotalTokens.toFixed(0)} | ${model.metrics.averageLatencyMs.toFixed(0)} ms | ${model.approved ? 'Yes' : 'No'} |`), '', `Approved primary: ${report.approval.primary || 'None'}`, `Approved fallback: ${report.approval.fallback || 'None'}`, ''].join('\n')
  await mkdir('docs/evaluation-results', { recursive: true })
  await writeFile(`${reportPath}.json`, JSON.stringify(report, null, 2))
  await writeFile(`${reportPath}.md`, markdown)
  for (const model of models) {
    await pool.query(`insert into ai_model_evaluations(model_id,harness_version,report,passed,total_tokens,estimated_cost) values($1,$2,$3,$4,$5,$6)`, [model.model, run.harness_version, { reportReference: `${reportPath}.json`, promptVersion: run.prompt_version, schemaVersion: run.schema_version, metrics: model.metrics, thresholds: model.thresholds }, model.approved, model.metrics.totalTokens, model.metrics.totalCostUsd])
    await pool.query(`insert into ai_model_allowlist(model_id,enabled,review_status,reviewed_at,notes) values($1,$2,$3,now(),$4) on conflict(model_id) do update set enabled=excluded.enabled,review_status=excluded.review_status,reviewed_at=excluded.reviewed_at,notes=excluded.notes`, [model.model, model.approved, model.approved ? 'approved' : 'rejected', `Tested for ${run.prompt_version}/${run.schema_version}; ${reportPath}.json`])
  }
  await pool.query(`update ai_evaluation_runs set status='aggregated',aggregated_at=now(),report_path=$2 where id=$1`, [runId, `${reportPath}.json`])
  return { report, reportPath }
}

export { ROADMAP_PROMPT_VERSION, parseAndValidateRoadmap }
