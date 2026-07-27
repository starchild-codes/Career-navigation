import assert from 'node:assert/strict'
import { buildMatches } from '../src/recommendationEngine.ts'

const base={grade:'Class 12',stream:'Undecided',country:'India',state:'',city:'',geography:'Anywhere in India',relocate:'Maybe',mode:'On-campus',subjects:{},bestSubjects:[],enjoyWeak:[],avoidSubjects:[],scoreBand:'80–89%',consistency:'Stable',mathComfort:3,writingComfort:3,labComfort:3,examComfort:3,skills:{},activities:[],work:[],values:[],budget:'₹50,000–₹1 lakh',scholarship:'Helpful',nearHome:false,examWillingness:'Open',duration:'3 years',route:['Any route'],ideas:['Exploring broadly'],exclusions:[]}
const profiles=[
 ['PCM engineering', {subjects:{Mathematics:'love',Physics:'love','Computer Science':'like'},skills:{Coding:'enjoy','Analytical reasoning':'good'},work:['Working with machines'],values:['Job availability']}],
 ['history chemistry', {subjects:{History:'love',Chemistry:'love',Geography:'like'},skills:{Writing:'enjoy',Research:'good'},work:['Creating public impact'],values:['Social impact']}],
 ['psychology computing', {subjects:{Psychology:'love','Computer Science':'love',Biology:'like'},skills:{Empathy:'enjoy',Coding:'good',Research:'enjoy'},work:['Working with people','Working with ideas'],values:['Creativity']}],
 ['commerce design', {subjects:{Economics:'love','Business Studies':'like',Design:'love'},skills:{'Visual design':'enjoy',Entrepreneurship:'good'},work:['Designing things','Building businesses'],values:['Income potential','Creativity']}],
 ['vocational local', {subjects:{'Vocational Subjects':'love','Engineering Drawing':'like'},skills:{'Building physical things':'enjoy','Fixing systems':'good'},work:['Working with machines','Active work'],values:['Job stability'],nearHome:true,budget:'Under ₹50,000'}]
]
const leaders=profiles.map(([name,patch])=>{const ranked=buildMatches({...base,...patch});assert.ok(ranked.length>=8,`${name}: catalogue too small`);assert.ok(ranked[0].why.length>0,`${name}: no explanation`);return [name,ranked[0].name]})
assert.ok(new Set(leaders.map(([,name])=>name)).size>=4,'profiles should not receive the same lead recommendation')
console.log('Recommendation quality profiles passed:', leaders.map(x=>x.join(' → ')).join(' | '))
