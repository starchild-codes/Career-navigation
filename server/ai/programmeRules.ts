export type ProgrammeEvidenceCandidate = {
  verificationStatus: string
  sourceStatus: string
  dataSufficient: boolean
  courseId: string | null
  officialProgrammeUrl: string | null
  requiredSubjects: string[]
  studentSubjects: string[]
  requiredExamIds: string[]
  examWillingness: string
  admissionCycleStatus: string
  feeStatus: string
  conflictingSource: boolean
}

export type ProgrammeEvidenceDecision = {
  includeInEvidence: boolean
  eligibilityStatus:
    | 'eligible'
    | 'conditionally_eligible'
    | 'currently_ineligible'
    | 'insufficient_data'
  missingSubjects: string[]
  warnings: string[]
}

export function evaluateProgrammeEvidence(
  candidate: ProgrammeEvidenceCandidate,
): ProgrammeEvidenceDecision {
  const warnings: string[] = []
  if (candidate.verificationStatus !== 'verified') warnings.push('Programme record is not verified.')
  if (candidate.sourceStatus !== 'verified') warnings.push('Official source is not verified.')
  if (!candidate.dataSufficient) warnings.push('Programme relationship is incomplete.')
  if (!candidate.courseId) warnings.push('Course relationship is missing.')
  if (!candidate.officialProgrammeUrl) warnings.push('Official programme URL is missing.')
  if (candidate.admissionCycleStatus === 'stale') warnings.push('Admission cycle is stale.')
  if (candidate.admissionCycleStatus === 'conflicting') {
    warnings.push('Admission-cycle sources conflict.')
  }
  if (candidate.feeStatus !== 'verified') warnings.push('Current fee data is unavailable.')
  if (candidate.conflictingSource) warnings.push('Eligibility sources conflict.')

  const includeInEvidence =
    candidate.verificationStatus === 'verified' &&
    candidate.sourceStatus === 'verified' &&
    candidate.dataSufficient &&
    Boolean(candidate.courseId) &&
    Boolean(candidate.officialProgrammeUrl) &&
    candidate.admissionCycleStatus === 'verified' &&
    !candidate.conflictingSource

  const currentSubjects = new Set(
    candidate.studentSubjects.map((subject) => subject.trim().toLowerCase()),
  )
  const missingSubjects = candidate.requiredSubjects.filter(
    (subject) => !currentSubjects.has(subject.trim().toLowerCase()),
  )
  let eligibilityStatus: ProgrammeEvidenceDecision['eligibilityStatus'] = 'insufficient_data'
  if (includeInEvidence) {
    if (missingSubjects.length) {
      eligibilityStatus = 'currently_ineligible'
    } else if (
      candidate.requiredExamIds.length &&
      /unwilling|avoid/i.test(candidate.examWillingness)
    ) {
      eligibilityStatus = 'currently_ineligible'
      warnings.push('Student is unwilling to take a required entrance examination.')
    } else if (candidate.requiredSubjects.length || candidate.requiredExamIds.length) {
      eligibilityStatus = 'eligible'
    }
  }

  return { includeInEvidence, eligibilityStatus, missingSubjects, warnings }
}
