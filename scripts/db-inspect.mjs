import { readFile } from 'node:fs/promises'
import { Client } from 'pg'

const env = Object.fromEntries((await readFile('.env.local', 'utf8')).split(/\r?\n/).filter(line => /^[A-Z0-9_]+=/.test(line)).map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)] }))
if (!env.DATABASE_URL) throw new Error('DATABASE_URL is missing from .env.local')
const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()
const tables = await client.query("select table_name from information_schema.tables where table_schema = 'public' order by table_name")
console.table(tables.rows)
if (tables.rows.length) {
  const counts = []
  for (const { table_name } of tables.rows) {
    const result = await client.query(`select count(*)::text as rows from ${table_name}`)
    counts.push({ table: table_name, rows: result.rows[0].rows })
  }
  console.table(counts)
}
await client.end()
