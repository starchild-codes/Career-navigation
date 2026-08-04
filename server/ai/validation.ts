import { Ajv } from 'ajv'
import { ROADMAP_JSON_SCHEMA } from './schema.ts'
import type { RoadmapEvidencePackage, RoadmapOutput } from './types.ts'

const ajv = new Ajv({ allErrors: true, strict: true })
const validateSchema = ajv.compile(ROADMAP_JSON_SCHEMA)

export type ValidationResult = {
  roadmap: RoadmapOutput | null
  schemaValid: boolean
  factualValid: boolean
  repaired: boolean
  errors: string[]
}

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, Math.max(0, max - 1))}…` : value

export function parseAndValidateRoadmap(
  raw: unknown,
  evidence: RoadmapEvidencePackage,
): ValidationResult {
  const errors: string[] = []
  if (!validateSchema(raw)) {
    const details = (validateSchema.errors || [])
      .slice(0, 12)
      .map((error: { instancePath?: string; message?: string }) =>
        `${error.instancePath || '/'} ${error.message || 'is invalid'}`,
      )
    return {
      roadmap: null,
      schemaValid: false,
      factualValid: false,
      repaired: false,
      errors: details,
    }
  }

  const roadmap = structuredClone(raw) as RoadmapOutput
  let repaired = false
  const careerIds = new Set([
    evidence.primary_career.career_id,
    ...evidence.alternative_careers.map((career) => career.career_id),
  ])
  const courseIds = new Set(evidence.verified_courses.map((course) => course.course_id))
  const programmeIds = new Set(evidence.verified_programmes.map((programme) => programme.programme_id))
  const examIds = new Set(evidence.verified_exams.map((exam) => exam.exam_id))
  const sourceIds = new Set(evidence.source_records.map((source) => source.record_id))

  if (!careerIds.has(roadmap.career_id)) {
    errors.push(`Unsupported career ID: ${roadmap.career_id}`)
    return { roadmap: null, schemaValid: true, factualValid: false, repaired: false, errors }
  }

  const filterSourceIds = (ids: string[], context: string) => {
    const invalid = ids.filter((id) => !sourceIds.has(id))
    if (invalid.length) {
      repaired = true
      errors.push(`${context} referenced unsupported source IDs: ${invalid.join(', ')}`)
    }
    return ids.filter((id) => sourceIds.has(id))
  }

  roadmap.eligibility_summary.source_record_ids = filterSourceIds(
    roadmap.eligibility_summary.source_record_ids,
    'Eligibility summary',
  )
  roadmap.stages = roadmap.stages.slice(0, 8).map((stage) => {
    const source_record_ids = filterSourceIds(stage.source_record_ids, `Stage "${stage.title}"`)
    const hasVerifiedCycle = source_record_ids.some((id) =>
      evidence.verified_admission_cycles.some((cycle) => cycle.source_record_ids.includes(id)),
    )
    if (stage.target_date && !hasVerifiedCycle) {
      errors.push(`Stage "${stage.title}" supplied an unsupported target date`)
      repaired = true
    }
    return {
      ...stage,
      title: truncate(stage.title, 100),
      description: truncate(stage.description, 420),
      target_date: hasVerifiedCycle ? stage.target_date : null,
      source_record_ids,
      unverified: stage.unverified || source_record_ids.length === 0,
    }
  })

  roadmap.course_options = roadmap.course_options
    .filter((course) => {
      if (courseIds.has(course.course_id)) return true
      errors.push(`Removed unsupported course ID: ${course.course_id}`)
      repaired = true
      return false
    })
    .slice(0, 5)
    .map((course) => ({
      ...course,
      reason: truncate(course.reason, 300),
      concerns: course.concerns.slice(0, 5).map((item) => truncate(item, 180)),
      source_record_ids: filterSourceIds(course.source_record_ids, `Course ${course.course_id}`),
    }))

  roadmap.college_programmes = roadmap.college_programmes
    .filter((programme) => {
      if (programmeIds.has(programme.programme_id)) return true
      errors.push(`Removed fabricated or unsupported programme ID: ${programme.programme_id}`)
      repaired = true
      return false
    })
    .slice(0, 8)
    .map((programme) => ({
      ...programme,
      reason: truncate(programme.reason, 300),
      admission_route_summary: truncate(programme.admission_route_summary, 280),
      source_record_ids: filterSourceIds(
        programme.source_record_ids,
        `Programme ${programme.programme_id}`,
      ),
    }))

  roadmap.exam_steps = roadmap.exam_steps
    .filter((exam) => {
      if (examIds.has(exam.exam_id)) return true
      errors.push(`Removed unsupported examination ID: ${exam.exam_id}`)
      repaired = true
      return false
    })
    .slice(0, 8)
    .map((exam) => ({
      ...exam,
      reason: truncate(exam.reason, 260),
      source_record_ids: filterSourceIds(exam.source_record_ids, `Exam ${exam.exam_id}`),
    }))

  roadmap.backup_routes = roadmap.backup_routes.slice(0, 4).map((route) => {
    const invalidCourses = route.course_ids.filter((id) => !courseIds.has(id))
    const invalidProgrammes = route.programme_ids.filter((id) => !programmeIds.has(id))
    if (invalidCourses.length || invalidProgrammes.length) {
      repaired = true
      errors.push(`Backup route "${route.title}" contained unsupported record IDs`)
    }
    return {
      ...route,
      title: truncate(route.title, 100),
      description: truncate(route.description, 360),
      course_ids: route.course_ids.filter((id) => courseIds.has(id)),
      programme_ids: route.programme_ids.filter((id) => programmeIds.has(id)),
      source_record_ids: filterSourceIds(route.source_record_ids, `Backup route "${route.title}"`),
    }
  })

  roadmap.next_actions = roadmap.next_actions.slice(0, 8).map((action) => ({
    ...action,
    action: truncate(action.action, 180),
    reason: truncate(action.reason, 260),
    source_record_ids: filterSourceIds(action.source_record_ids, `Action "${action.action}"`),
  }))
  roadmap.summary = truncate(roadmap.summary, 700)
  roadmap.important_tradeoffs = roadmap.important_tradeoffs.slice(0, 8).map((item) => truncate(item, 220))
  roadmap.questions_for_counsellor = roadmap.questions_for_counsellor.slice(0, 8).map((item) => truncate(item, 220))
  roadmap.missing_or_unverified = roadmap.missing_or_unverified.slice(0, 12).map((item) => ({
    field: truncate(item.field, 100),
    message: truncate(item.message, 260),
  }))

  if (
    evidence.deterministic_eligibility.status === 'insufficient_data' &&
    roadmap.eligibility_summary.status !== 'insufficient_data'
  ) {
    errors.push('Eligibility status contradicted deterministic insufficient-data result')
    roadmap.eligibility_summary.status = 'insufficient_data'
    roadmap.eligibility_summary.missing_requirements = [
      ...new Set([
        ...roadmap.eligibility_summary.missing_requirements,
        ...evidence.deterministic_eligibility.missing_requirements,
      ]),
    ]
    repaired = true
  }

  const classificationText = JSON.stringify(roadmap)
  if (/\b(aspirational|target|safer)\b/i.test(classificationText)) {
    errors.push('Roadmap added an unsupported competitiveness classification')
  }

  return {
    roadmap,
    schemaValid: true,
    factualValid: errors.length === 0,
    repaired,
    errors,
  }
}
