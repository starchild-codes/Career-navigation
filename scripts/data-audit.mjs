import { readFile } from 'node:fs/promises';
const text = await readFile(new URL('../src/knowledge.ts', import.meta.url), 'utf8');
for (const name of ['Career','Course','College','Exam','Scholarship']) console.log(`${name}: ${(text.match(new RegExp(`type:'${name}'`, 'g')) || []).length}`);
console.log(`Verified: ${text.split('\n').filter(line => line.includes("status:'verified'") && line.includes("{id:")).length}`);
