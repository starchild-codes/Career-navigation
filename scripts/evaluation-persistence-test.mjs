import { loadEnv } from 'vite'
import pg from 'pg'

const { Pool } = pg
const env = loadEnv('development', process.cwd(), '')
if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required for the persistence test')
const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1, allowExitOnIdle: true })
try {
  const run = await pool.query(`insert into ai_evaluation_runs(harness_version,prompt_version,schema_version,candidate_models,profile_ids,preflight,status) values('test','prompt','schema',array['test-model'],array['one','two','three'], '{}'::jsonb,'in_progress') returning id`)
  const runId = run.rows[0].id
  try {
    for (const [index, profile] of ['one', 'two', 'three'].entries()) {
      await pool.query(`insert into ai_evaluation_calls(run_id,model_id,profile_id,sequence,evidence_hash,evidence_input_estimate,status,native_schema_valid,repaired_schema_valid,factual_valid,completed_at) values($1,'test-model',$2,$3,$4,1,'complete',true,true,true,now())`, [runId, profile, index + 1, `hash-${profile}`])
    }
    throw new Error('Simulated aggregation crash after persisted calls')
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('Simulated aggregation crash')) throw error
  }
  const persisted = await pool.query('select count(*)::int count from ai_evaluation_calls where run_id=$1 and status=\'complete\'', [runId])
  if (persisted.rows[0].count !== 3) throw new Error('Completed calls were not retained after simulated aggregation crash')
  await pool.query('delete from ai_evaluation_runs where id=$1', [runId])
  console.log('Evaluation persistence crash-recovery check passed')
} finally {
  await pool.end()
}
