import { readFile } from 'node:fs/promises'
import { loadEnv } from 'vite'
import pg from 'pg'
import { createAiConfig } from '../server/ai/config.ts'
import { callOpenRouterForEvaluation } from '../server/ai/evaluationProvider.ts'
import { OpenRouterError } from '../server/ai/openrouter.ts'
import { safelyParseRoadmapContent } from '../server/ai/validation.ts'
import { HARNESS_VERSION, PROFILE_IDS, ROADMAP_PROMPT_VERSION, SCHEMA_VERSION, aggregateRun, assessRoadmap, makeEvaluationItems, parseAndValidateRoadmap, sha } from './roadmap-evaluation-lib.mjs'

const { Pool } = pg
const env = loadEnv('development', process.cwd(), '')
const config = createAiConfig(env)
const runPaid = process.argv.includes('--run')
const priorRunId = process.argv.find((argument) => argument.startsWith('--run-id='))?.slice(9)
const fixtures = JSON.parse(await readFile('scripts/fixtures/roadmap-evaluation-profiles.json', 'utf8'))

const price = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.POSITIVE_INFINITY
}
if (!config.apiKey) throw new Error('OPENROUTER_API_KEY is missing')
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for durable evaluation persistence')
if (!config.allowedModels.length) throw new Error('Configure candidate model IDs first')

const catalogueResponse = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(12_000) })
if (!catalogueResponse.ok) throw new Error(`OpenRouter model catalogue returned ${catalogueResponse.status}`)
const catalogue = (await catalogueResponse.json()).data || []
const catalogueById = new Map(catalogue.map((model) => [model.id, model]))
const candidates = config.allowedModels.map((id) => {
  const model = catalogueById.get(id)
  if (!model) throw new Error(`Configured model ID is unavailable: ${id}`)
  const supported = new Set(model.supported_parameters || [])
  const architecture = JSON.stringify(model.architecture || {}).toLowerCase()
  const valid = !id.includes(':free') && !['openrouter/auto', 'openrouter/free'].includes(id) && !/(experimental|preview|beta|roleplay|uncensored)/i.test(id) && !/(image|audio|embedding|moderation)/.test(architecture) && (model.context_length || 0) >= config.maxTotalTokens && supported.has('response_format') && supported.has('structured_outputs') && (supported.has('max_tokens') || supported.has('max_completion_tokens'))
  if (!valid) throw new Error(`Configured model does not meet strict structured-output evaluation requirements: ${id}`)
  const promptPrice = price(model.pricing?.prompt), completionPrice = price(model.pricing?.completion), requestFee = Number.isFinite(price(model.pricing?.request)) ? price(model.pricing?.request) : 0
  if (!Number.isFinite(promptPrice) || !Number.isFinite(completionPrice)) throw new Error(`Missing current catalogue pricing: ${id}`)
  return { id, promptPrice, completionPrice, requestFee, supportsReasoning: supported.has('reasoning'), maximumCostPerCall: promptPrice * config.maxInputTokens + completionPrice * config.maxOutputTokens + requestFee }
})
const items = makeEvaluationItems(fixtures, config)
const maximumCost = candidates.reduce((sum, candidate) => sum + candidate.maximumCostPerCall * items.length, 0)
const preflight = { candidateCount: candidates.length, profileCount: items.length, maximumCalls: candidates.length * items.length, maximumRetries: 0, maxInputTokensPerCall: config.maxInputTokens, maxOutputTokensPerCall: config.maxOutputTokens, maxTotalTokensPerCall: config.maxTotalTokens, maximumPossibleTokens: candidates.length * items.length * config.maxTotalTokens, maximumEstimatedCostUsd: maximumCost, candidates: candidates.map((candidate) => ({ ...candidate, structuredOutputs: true })), evidencePackagesDistinct: new Set(items.map((item) => item.evidenceHash)).size === items.length, liveDataEnabled: config.liveDataEnabled }
console.log(`Candidates: ${candidates.map((candidate) => candidate.id).join(', ')}`)
console.log(`Profiles: ${items.length}; maximum calls: ${preflight.maximumCalls}; maximum retries: 0`)
console.log(`Limits: ${config.maxInputTokens}/${config.maxOutputTokens}/${config.maxTotalTokens}; maximum batch cost: $${maximumCost.toFixed(6)}`)
if (maximumCost > .25) throw new Error('Projected batch cost exceeds the USD 0.25 stop limit')
if (!runPaid) { console.log('Preflight only. No OpenRouter calls were made.'); process.exitCode = 0 } else {
  const pool = new Pool({ connectionString: config.databaseUrl, ssl: { rejectUnauthorized: false }, max: 1, allowExitOnIdle: true })
  try {
    let runId = priorRunId
    if (!runId) {
      const created = await pool.query(`insert into ai_evaluation_runs(harness_version,prompt_version,schema_version,candidate_models,profile_ids,preflight) values($1,$2,$3,$4,$5,$6) returning id`, [HARNESS_VERSION, ROADMAP_PROMPT_VERSION, SCHEMA_VERSION, candidates.map((candidate) => candidate.id), PROFILE_IDS, preflight])
      runId = created.rows[0].id
    }
    for (const [candidateIndex, candidate] of candidates.entries()) for (const [profileIndex, item] of items.entries()) {
      const existing = await pool.query('select status from ai_evaluation_calls where run_id=$1 and model_id=$2 and profile_id=$3', [runId, candidate.id, item.fixture.id])
      if (existing.rowCount) continue
      const sequence = candidateIndex * items.length + profileIndex + 1
      await pool.query(`insert into ai_evaluation_calls(run_id,model_id,profile_id,sequence,evidence_hash,evidence_input_estimate,status) values($1,$2,$3,$4,$5,$6,'in_progress')`, [runId, candidate.id, item.fixture.id, sequence, item.evidenceHash, item.estimatedInputTokens])
      const started = Date.now()
      try {
        const response = await callOpenRouterForEvaluation(config, candidate.id, item.evidence, config.maxOutputTokens, candidate.supportsReasoning)
        let native = null
        try { native = JSON.parse(response.rawContent) } catch {}
        const repaired = safelyParseRoadmapContent(response.rawContent)
        const nativeValidation = native === null ? { schemaValid: false, factualValid: false } : parseAndValidateRoadmap(native, item.evidence)
        const validation = repaired.value === null ? { roadmap: null, schemaValid: false, factualValid: false, errors: [repaired.error || 'Invalid JSON'] } : parseAndValidateRoadmap(repaired.value, item.evidence)
        const safety = assessRoadmap(repaired.value, item, validation)
        const estimatedCost = candidate.promptPrice * response.usage.inputTokens + candidate.completionPrice * response.usage.outputTokens + candidate.requestFee
        await pool.query(`update ai_evaluation_calls set status='complete',actual_model_used=$4,raw_provider_usage=$5::jsonb,structured_output=$6::jsonb,raw_output_hash=$7,native_schema_valid=$8,repaired_schema_valid=$9,factual_valid=$10,validation_errors=$11::jsonb,safety=$12::jsonb,prompt_tokens=$13,completion_tokens=$14,reasoning_tokens=$15,total_tokens=$16,reported_cost=$17,estimated_cost=$18,latency_ms=$19,completed_at=now() where run_id=$1 and model_id=$2 and profile_id=$3`, [runId, candidate.id, item.fixture.id, response.modelUsed, JSON.stringify({ inputTokens: response.usage.inputTokens, completionTokens: response.usage.outputTokens, reasoningTokens: response.usage.reasoningTokens, totalTokens: response.usage.totalTokens, reportedCost: response.usage.reportedCost }), JSON.stringify(validation.roadmap), sha(response.rawContent), nativeValidation.schemaValid, validation.schemaValid, validation.factualValid, JSON.stringify(validation.errors), JSON.stringify(safety), response.usage.inputTokens, response.usage.outputTokens, response.usage.reasoningTokens, response.usage.totalTokens, response.usage.reportedCost, estimatedCost, response.latencyMs])
      } catch (error) {
        await pool.query(`update ai_evaluation_calls set status='failed',provider_error_status=$4,provider_error=$5,latency_ms=$6,validation_errors=$7::jsonb,completed_at=now() where run_id=$1 and model_id=$2 and profile_id=$3`, [runId, candidate.id, item.fixture.id, error instanceof OpenRouterError ? error.statusCode : null, error instanceof Error ? error.message : 'Unknown provider error', Date.now() - started, JSON.stringify([error instanceof Error ? error.message : 'Unknown provider error'])])
      }
    }
    await pool.query(`update ai_evaluation_runs set status='complete',completed_at=now() where id=$1`, [runId])
    const { report, reportPath } = await aggregateRun(pool, runId)
    console.log(`Run ${runId} persisted and aggregated at ${reportPath}.json`)
    console.log(`Approved primary: ${report.approval.primary || 'none'}; fallback: ${report.approval.fallback || 'none'}`)
    if (!report.approval.primary) process.exitCode = 1
  } finally { await pool.end() }
}
