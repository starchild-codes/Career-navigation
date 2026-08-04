import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { evaluateProgrammeEvidence } from '../server/ai/programmeRules.ts'

const fixtures = JSON.parse(
  await readFile('scripts/fixtures/programme-pilot-cases.json', 'utf8'),
)
assert.equal(fixtures.length, 10, 'The controlled programme pilot must retain ten cases')

const base = {
  verificationStatus: 'verified',
  sourceStatus: 'verified',
  dataSufficient: true,
  courseId: 'course-verified',
  officialProgrammeUrl: 'https://example.edu/programme',
  requiredSubjects: ['Mathematics'],
  studentSubjects: ['Mathematics'],
  requiredExamIds: [],
  examWillingness: 'Open',
  admissionCycleStatus: 'verified',
  feeStatus: 'verified',
  conflictingSource: false,
}

for (const fixture of fixtures) {
  const decision = evaluateProgrammeEvidence({ ...base, ...fixture.overrides })
  assert.equal(
    decision.includeInEvidence,
    fixture.expected.includeInEvidence,
    `${fixture.id}: evidence inclusion`,
  )
  assert.equal(
    decision.eligibilityStatus,
    fixture.expected.eligibilityStatus,
    `${fixture.id}: eligibility`,
  )
  if (fixture.expected.warningIncludes === 'Mathematics') {
    assert.ok(decision.missingSubjects.includes('Mathematics'), `${fixture.id}: missing subject`)
  } else if (fixture.expected.warningIncludes) {
    assert.ok(
      decision.warnings.some((warning) =>
        warning.toLowerCase().includes(fixture.expected.warningIncludes.toLowerCase()),
      ),
      `${fixture.id}: expected warning`,
    )
  }
  if (fixture.expected.warnings === 0) {
    assert.equal(decision.warnings.length, 0, `${fixture.id}: unexpected warning`)
  }
}

console.log(`Programme pilot validation passed: ${fixtures.map((fixture) => fixture.id).join(' | ')}`)
