import type { Pool } from 'pg'
import type { AuthContext } from './types.ts'
import { RoadmapServiceError } from './service.ts'

const TASK_STATUSES = new Set([
  'pending_review',
  'in_progress',
  'verified',
  'unavailable',
  'closed',
])
const RECORD_STATUSES = new Set([
  'pending_review',
  'verified',
  'stale',
  'conflicting',
  'archived',
])

const requireAdmin = (auth: AuthContext) => {
  if (auth.role !== 'owner' && auth.role !== 'admin') {
    throw new RoadmapServiceError('Only an organisation owner or admin can verify catalogue data.', 403)
  }
}

const officialUrl = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.toString()
  } catch {
    return null
  }
}

export class VerificationAdminService {
  private pool: Pool
  constructor(pool: Pool) {
    this.pool = pool
  }

  async list(auth: AuthContext) {
    requireAdmin(auth)
    const [tasks, programmes, queueCounts, events] = await Promise.all([
      this.pool.query(
        `select id,task_type,entity_type,entity_id,missing_field,official_domain,narrow_query,
                status,priority,claimed_by,claimed_at,reviewer_notes,conflict_notes,
                result_source_urls,created_at,updated_at
         from source_verification_tasks
         where organisation_id=$1
         order by case status when 'pending_review' then 0 when 'in_progress' then 1 else 2 end,
                  priority,created_at desc limit 100`,
        [auth.organisationId],
      ),
      this.pool.query(
        `select p.id,p.institution_id,i.institution_name,p.campus,p.programme_name,
                p.degree_level,p.course_id,p.duration,p.mode,p.verification_status,
                p.data_sufficient,p.official_programme_url,p.official_admissions_url,
                p.last_verified_at,s.id source_id,s.source_url,s.status source_status
         from institution_programmes p
         join institutions i on i.institution_id=p.institution_id
         left join lateral (
           select id,source_url,status from institution_programme_sources
           where institution_programme_id=p.id order by last_verified_at desc nulls last,id desc limit 1
         ) s on true
         where p.verification_status<>'verified' or not p.data_sufficient
         order by p.last_verified_at nulls first,p.programme_name limit 100`,
      ),
      this.pool.query(
        `select task_type,count(*)::int count
         from source_verification_tasks
         where organisation_id=$1 and status in ('pending_review','in_progress')
         group by task_type order by task_type`,
        [auth.organisationId],
      ),
      this.pool.query(
        `select id,record_type,record_id,action,previous_status,next_status,source_url,
                notes,created_at
         from catalogue_verification_events
         where organisation_id=$1 order by created_at desc limit 40`,
        [auth.organisationId],
      ),
    ])
    return {
      tasks: tasks.rows,
      programmes: programmes.rows,
      queueCounts: queueCounts.rows,
      events: events.rows,
    }
  }

  async updateTask(
    auth: AuthContext,
    taskId: string,
    payload: {
      action?: string
      status?: string
      reviewerNotes?: string
      conflictNotes?: string
      resultSourceUrls?: string[]
    },
  ) {
    requireAdmin(auth)
    const existing = await this.pool.query(
      `select * from source_verification_tasks where id=$1 and organisation_id=$2`,
      [taskId, auth.organisationId],
    )
    if (!existing.rowCount) throw new RoadmapServiceError('Verification task not found.', 404)
    const row = existing.rows[0]
    const claim = payload.action === 'claim'
    const status = claim
      ? 'in_progress'
      : payload.status && TASK_STATUSES.has(payload.status)
        ? payload.status
        : row.status
    const sourceUrls = Array.isArray(payload.resultSourceUrls)
      ? payload.resultSourceUrls.map(officialUrl).filter(Boolean).slice(0, 10)
      : row.result_source_urls
    if (status === 'verified' && sourceUrls.length === 0) {
      throw new RoadmapServiceError('A verified task must retain at least one official source URL.', 422)
    }
    const updated = await this.pool.query(
      `update source_verification_tasks set
        status=$3,
        claimed_by=case when $4 then $5 else claimed_by end,
        claimed_at=case when $4 then now() else claimed_at end,
        reviewer_notes=coalesce($6,reviewer_notes),
        conflict_notes=coalesce($7,conflict_notes),
        result_source_urls=$8,
        resolved_at=case when $3 in ('verified','unavailable','closed') then now() else null end,
        updated_at=now()
       where id=$1 and organisation_id=$2 returning *`,
      [
        taskId,
        auth.organisationId,
        status,
        claim,
        auth.userId,
        typeof payload.reviewerNotes === 'string'
          ? payload.reviewerNotes.slice(0, 4000)
          : null,
        typeof payload.conflictNotes === 'string'
          ? payload.conflictNotes.slice(0, 4000)
          : null,
        sourceUrls,
      ],
    )
    await this.pool.query(
      `insert into catalogue_verification_events
       (organisation_id,actor_id,record_type,record_id,action,previous_status,next_status,
        source_url,notes,change_payload)
       values($1,$2,'verification_task',$3,$4,$5,$6,$7,$8,$9)`,
      [
        auth.organisationId,
        auth.userId,
        taskId,
        claim ? 'claimed' : 'status_changed',
        row.status,
        status,
        sourceUrls[0] || null,
        payload.reviewerNotes?.slice(0, 4000) || null,
        { taskType: row.task_type, conflictNotes: payload.conflictNotes || null },
      ],
    )
    return updated.rows[0]
  }

  async saveProgramme(auth: AuthContext, payload: Record<string, unknown>) {
    requireAdmin(auth)
    const institutionId =
      typeof payload.institutionId === 'string' ? payload.institutionId.trim() : ''
    const programmeName =
      typeof payload.programmeName === 'string' ? payload.programmeName.trim() : ''
    const sourceUrl = officialUrl(payload.officialProgrammeUrl)
    const admissionsUrl = officialUrl(payload.officialAdmissionsUrl)
    if (!institutionId || !programmeName || !sourceUrl) {
      throw new RoadmapServiceError(
        'Institution, exact programme name, and an official programme URL are required.',
        422,
      )
    }
    const institution = await this.pool.query(
      'select institution_id from institutions where institution_id=$1',
      [institutionId],
    )
    if (!institution.rowCount) throw new RoadmapServiceError('Institution record not found.', 404)
    if (typeof payload.courseId === 'string' && payload.courseId.trim()) {
      const course = await this.pool.query('select course_id from courses where course_id=$1', [
        payload.courseId.trim(),
      ])
      if (!course.rowCount) throw new RoadmapServiceError('Course record not found.', 404)
    }
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      const programme = await client.query(
        `insert into institution_programmes
         (institution_id,campus,programme_name,degree_level,course_id,duration,mode,
          official_programme_url,official_admissions_url,source_domain,source_date,
          verification_status,data_sufficient,verification_notes)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,current_date,'needs_review',false,$11)
         on conflict(institution_id,programme_name) do update set
          campus=excluded.campus,degree_level=excluded.degree_level,course_id=excluded.course_id,
          duration=excluded.duration,mode=excluded.mode,
          official_programme_url=excluded.official_programme_url,
          official_admissions_url=excluded.official_admissions_url,
          source_domain=excluded.source_domain,source_date=excluded.source_date,
          verification_status='needs_review',data_sufficient=false,
          verification_notes=excluded.verification_notes
         returning id,verification_status`,
        [
          institutionId,
          typeof payload.campus === 'string' ? payload.campus.trim() || null : null,
          programmeName,
          typeof payload.degreeType === 'string' ? payload.degreeType.trim() || null : null,
          typeof payload.courseId === 'string' ? payload.courseId.trim() || null : null,
          typeof payload.duration === 'string' ? payload.duration.trim() || null : null,
          typeof payload.studyMode === 'string' ? payload.studyMode.trim() || null : null,
          sourceUrl,
          admissionsUrl,
          new URL(sourceUrl).hostname,
          typeof payload.notes === 'string' ? payload.notes.slice(0, 4000) : null,
        ],
      )
      const programmeId = programme.rows[0].id as string
      await client.query(
        `insert into institution_programme_sources
         (institution_programme_id,source_name,source_url,source_year,status)
         values($1,$2,$3,$4,'needs_review')`,
        [programmeId, new URL(sourceUrl).hostname, sourceUrl, String(new Date().getFullYear())],
      )
      await client.query(
        `insert into catalogue_verification_events
         (organisation_id,actor_id,record_type,record_id,action,next_status,source_url,notes)
         values($1,$2,'programme',$3,'imported_or_corrected','needs_review',$4,$5)`,
        [
          auth.organisationId,
          auth.userId,
          programmeId,
          sourceUrl,
          typeof payload.notes === 'string' ? payload.notes.slice(0, 4000) : null,
        ],
      )
      await client.query('commit')
      return { id: programmeId, verificationStatus: 'needs_review', dataSufficient: false }
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }

  async reviewProgramme(
    auth: AuthContext,
    programmeId: string,
    payload: { status?: string; sourceStatus?: string; dataSufficient?: boolean; notes?: string },
  ) {
    requireAdmin(auth)
    const existing = await this.pool.query(
      `select p.*,s.id source_id,s.source_url,s.status source_status
       from institution_programmes p
       left join lateral (
         select id,source_url,status from institution_programme_sources
         where institution_programme_id=p.id order by id desc limit 1
       ) s on true where p.id=$1`,
      [programmeId],
    )
    if (!existing.rowCount) throw new RoadmapServiceError('Programme record not found.', 404)
    const row = existing.rows[0]
    const status =
      payload.status && RECORD_STATUSES.has(payload.status) ? payload.status : row.verification_status
    const sourceStatus =
      payload.sourceStatus && RECORD_STATUSES.has(payload.sourceStatus)
        ? payload.sourceStatus
        : row.source_status
    const dataSufficient =
      typeof payload.dataSufficient === 'boolean' ? payload.dataSufficient : row.data_sufficient
    if (
      status === 'verified' &&
      (!dataSufficient ||
        sourceStatus !== 'verified' ||
        !row.course_id ||
        !row.official_programme_url)
    ) {
      throw new RoadmapServiceError(
        'Verification requires a linked course, verified official source, programme URL, and complete-data confirmation.',
        422,
      )
    }
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      if (row.source_id && sourceStatus) {
        await client.query(
          `update institution_programme_sources set status=$2,
            last_verified_at=case when $2='verified' then now() else last_verified_at end
           where id=$1`,
          [row.source_id, sourceStatus === 'pending_review' ? 'needs_review' : sourceStatus],
        )
      }
      await client.query(
        `update institution_programmes set verification_status=$2,data_sufficient=$3,
          verified_by=case when $2='verified' then $4 else verified_by end,
          last_verified_at=case when $2='verified' then now() else last_verified_at end,
          verification_notes=coalesce($5,verification_notes)
         where id=$1`,
        [
          programmeId,
          status === 'pending_review' ? 'needs_review' : status,
          dataSufficient,
          auth.userId,
          typeof payload.notes === 'string' ? payload.notes.slice(0, 4000) : null,
        ],
      )
      await client.query(
        `insert into catalogue_verification_events
         (organisation_id,actor_id,record_type,record_id,action,previous_status,next_status,
          source_url,notes,change_payload)
         values($1,$2,'programme',$3,'reviewed',$4,$5,$6,$7,$8)`,
        [
          auth.organisationId,
          auth.userId,
          programmeId,
          row.verification_status,
          status,
          row.source_url,
          typeof payload.notes === 'string' ? payload.notes.slice(0, 4000) : null,
          { sourceStatus, dataSufficient },
        ],
      )
      await client.query('commit')
      return { id: programmeId, verificationStatus: status, sourceStatus, dataSufficient }
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }
}
