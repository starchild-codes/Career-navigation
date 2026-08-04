import { readFile } from 'node:fs/promises'
import { loadEnv } from 'vite'
import pg from 'pg'

const { Pool } = pg
const reportPath =
  process.argv[2] || 'docs/evaluation-results/roadmap-model-evaluation-2026-08-04.json'
const report = JSON.parse(await readFile(reportPath, 'utf8'))
const env = loadEnv('development', process.cwd(), '')
if (!env.DATABASE_URL) throw new Error('DATABASE_URL is missing')

const catalogueResponse = await fetch('https://openrouter.ai/api/v1/models', {
  signal: AbortSignal.timeout(12_000),
})
if (!catalogueResponse.ok) throw new Error('OpenRouter model catalogue is unavailable')
const catalogue = (await catalogueResponse.json()).data || []
const catalogueById = new Map(catalogue.map((model) => [model.id, model]))
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
  allowExitOnIdle: true,
})

try {
  for (const modelReport of report.models) {
    const model = catalogueById.get(modelReport.model)
    if (!model) throw new Error(`Evaluated model is absent from the catalogue: ${modelReport.model}`)
    const promptPrice = Number(model.pricing?.prompt)
    const completionPrice = Number(model.pricing?.completion)
    const requestFee = Number(model.pricing?.request || 0)
    const estimatedRoadmapCost =
      promptPrice * report.preflight.maxInputTokensPerCall +
      completionPrice * report.preflight.maxOutputTokensPerCall +
      requestFee
    await pool.query(
      `insert into ai_model_catalogue
       (model_id,display_name,context_length,prompt_price_per_token,
        completion_price_per_token,request_fee,supported_parameters,architecture,
        estimated_roadmap_cost,available,fetched_at,raw_metadata)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,true,now(),$10)
       on conflict(model_id) do update set
        display_name=excluded.display_name,context_length=excluded.context_length,
        prompt_price_per_token=excluded.prompt_price_per_token,
        completion_price_per_token=excluded.completion_price_per_token,
        request_fee=excluded.request_fee,supported_parameters=excluded.supported_parameters,
        architecture=excluded.architecture,estimated_roadmap_cost=excluded.estimated_roadmap_cost,
        available=true,fetched_at=now(),raw_metadata=excluded.raw_metadata`,
      [
        modelReport.model,
        model.name || modelReport.model,
        model.context_length,
        promptPrice,
        completionPrice,
        requestFee,
        model.supported_parameters || [],
        model.architecture || {},
        estimatedRoadmapCost,
        model,
      ],
    )
    await pool.query(
      `insert into ai_model_evaluations
       (model_id,harness_version,report,passed,total_tokens,estimated_cost)
       values($1,$2,$3,$4,$5,$6)`,
      [
        modelReport.model,
        report.harnessVersion,
        {
          reportReference: reportPath,
          evaluationDate: report.createdAt,
          promptVersion: report.promptVersion,
          schemaVersion: report.schemaVersion,
          metrics: modelReport.metrics,
          mandatoryThresholds: modelReport.mandatoryThresholds,
        },
        modelReport.approved,
        modelReport.metrics.totalTokens,
        modelReport.metrics.actualTotalCostUsd,
      ],
    )
    await pool.query(
      `insert into ai_model_allowlist
       (model_id,enabled,review_status,reviewed_at,notes)
       values($1,$2,$3,now(),$4)
       on conflict(model_id) do update set
        enabled=excluded.enabled,review_status=excluded.review_status,
        reviewed_at=excluded.reviewed_at,notes=excluded.notes`,
      [
        modelReport.model,
        modelReport.approved,
        modelReport.approved ? 'approved' : 'rejected',
        `Tested only for ${report.promptVersion}/${report.schemaVersion}; ${reportPath}`,
      ],
    )
  }
  console.log(`Persisted ${report.models.length} evaluated model decisions without provider calls.`)
} finally {
  await pool.end()
}
