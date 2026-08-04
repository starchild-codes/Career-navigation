import { loadEnv } from 'vite'
import pg from 'pg'

const { Client } = pg
const env = loadEnv('development', process.cwd(), '')
if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required for the RLS test')
const client = new Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
await client.connect()
try {
  const memberships = await client.query(
    `select user_id,organisation_id from organisation_memberships
     where active order by created_at limit 2`,
  )
  if (memberships.rowCount < 2) throw new Error('Two organisations are required for isolation testing')
  const [first, second] = memberships.rows
  await client.query('begin')
  await client.query('set local role authenticated')
  await client.query(`select set_config('request.jwt.claim.sub',$1,true)`, [first.user_id])
  const otherTasks = await client.query(
    'select count(*)::int count from source_verification_tasks where organisation_id=$1',
    [second.organisation_id],
  )
  const otherRoadmaps = await client.query(
    'select count(*)::int count from roadmap_generations where organisation_id=$1',
    [second.organisation_id],
  )
  const otherNotes = await client.query(
    'select count(*)::int count from catalogue_record_notes where organisation_id=$1',
    [second.organisation_id],
  )
  await client.query('rollback')
  if (otherTasks.rows[0].count || otherRoadmaps.rows[0].count || otherNotes.rows[0].count) {
    throw new Error('Cross-organisation rows were visible under the authenticated role')
  }
  console.log('RLS isolation passed for roadmap, verification task, and catalogue-note records')
} finally {
  await client.end()
}
