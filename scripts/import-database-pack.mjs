import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse } from 'csv-parse/sync'
import { Client } from 'pg'

const apply = process.argv.includes('--apply')
const env = Object.fromEntries((await readFile('.env.local','utf8')).split(/\r?\n/).filter(x=>/^[A-Z0-9_]+=/.test(x)).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]))
if (!env.DATABASE_URL) throw new Error('DATABASE_URL missing')
const root = 'imports/career_compass_database_pack/data'; const tables = ['sources','career_taxonomy','careers','universities','institutions','courses','exams','scholarships','subjects','course_subject_links','career_subject_links','career_course_links','exam_course_links']
const client = new Client({connectionString:env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); await client.connect()
if (apply) { const migration = await readFile('supabase/migrations/20260724_large_seed_database.sql','utf8'); await client.query(migration) }
const report=[]
try { if(apply) await client.query('begin'); for (const table of tables) { const file=join(root,`${table}.csv`); const rows=parse(await readFile(file,'utf8'),{columns:true,skip_empty_lines:true,bom:true}); let inserted=0,skipped=0; if(apply){const columns=Object.keys(rows[0]);for(let i=0;i<rows.length;i+=250){const batch=rows.slice(i,i+250);const values=batch.flatMap(r=>columns.map(c=>r[c]||null));const tuples=batch.map((_,n)=>`(${columns.map((_,j)=>'$'+(n*columns.length+j+1)).join(',')})`).join(',');const q=`insert into ${table} (${columns.join(',')}) values ${tuples} on conflict do nothing`;const result=await client.query(q,values);inserted+=result.rowCount;skipped+=batch.length-result.rowCount}} report.push({table,rows:rows.length,inserted,skipped}) } if(apply) await client.query('commit'); console.table(report) } catch(error){if(apply) await client.query('rollback');throw error} finally {await client.end()}
