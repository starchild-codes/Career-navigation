import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const app=readFileSync('src/App.tsx','utf8'),roadmap=readFileSync('src/Roadmap.tsx','utf8'),detail=readFileSync('src/RecommendationDetail.tsx','utf8'),knowledge=readFileSync('src/KnowledgeDatabase.tsx','utf8')
for(const label of ['New student','Complete follow-up','Download summary','Export selected','Add counsellor step','Export roadmap','Add to student plan','Save to My Plan'])assert.ok(`${app}${roadmap}${detail}${knowledge}`.includes(label),`missing action: ${label}`)
assert.ok(app.includes("setStudents(v=>v.map(s=>({...s,priority:undefined})))"),'Mark all reviewed must update stored priority state')
assert.ok(detail.includes('savePath(')&&detail.includes('replaceSavedPaths'),'saved pathways must persist and be removable')
assert.ok(roadmap.includes("localStorage.setItem(roadmapKey"),'roadmap completion must persist')
console.log('Dashboard interaction integrity checks passed')
