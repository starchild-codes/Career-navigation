import { loadEnv } from 'vite'
import pg from 'pg'
import { aggregateRun } from './roadmap-evaluation-lib.mjs'

const { Pool } = pg
const env = loadEnv('development', process.cwd(), '')
if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const requestedRunId = process.argv.find((argument) => argument.startsWith('--run-id='))?.slice(9)
const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1, allowExitOnIdle: true })
try {
  const runId = requestedRunId || (await pool.query(`select id from ai_evaluation_runs order by created_at desc limit 1`)).rows[0]?.id
  if (!runId) throw new Error('No persisted evaluation run exists')
  const { reportPath, report } = await aggregateRun(pool, runId)
  console.log(`Aggregation-only report written to ${reportPath}.json`)
  console.log(`Approved primary: ${report.approval.primary || 'none'}; fallback: ${report.approval.fallback || 'none'}`)
} finally {
  await pool.end()
}
