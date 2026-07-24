import { readFile } from 'node:fs/promises'
import { Client } from 'pg'
const path = process.argv[2]
if (!path) throw new Error('Pass a migration path')
const env = Object.fromEntries((await readFile('.env.local','utf8')).split(/\r?\n/).filter(x=>/^[A-Z0-9_]+=/.test(x)).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]))
const client = new Client({connectionString:env.DATABASE_URL,ssl:{rejectUnauthorized:false}})
await client.connect(); await client.query(await readFile(path,'utf8')); await client.end(); console.log(`Applied ${path}`)
