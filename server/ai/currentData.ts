import type { Pool } from 'pg'
import type { AuthContext, RoadmapEvidencePackage } from './types.ts'
import type { AiConfig } from './config.ts'

export type CurrentDataNeed = {
  taskType:
    | 'missing_programme_relationship'
    | 'missing_eligibility'
    | 'missing_exam'
    | 'missing_admission_cycle'
    | 'missing_fee'
    | 'missing_scholarship'
    | 'stale_record'
    | 'conflicting_source'
  entityType: string
  entityId: string | null
  field: string
  officialDomain: string | null
  narrowQuery: string
}

export interface CurrentDataProvider {
  readonly id: string
  retrieve(need: CurrentDataNeed): Promise<{
    status: 'pending_review' | 'unavailable'
    urls: string[]
    checkedAt: string
  }>
}

export function assessSourceFreshness(
  source: {
    verification_status: string
    expires_at?: string | null
    last_verified_at?: string | null
  },
  now = new Date(),
) {
  if (source.verification_status !== 'verified') return 'review_required' as const
  if (source.expires_at && new Date(source.expires_at).getTime() < now.getTime()) {
    return 'stale' as const
  }
  if (
    source.last_verified_at &&
    now.getTime() - new Date(source.last_verified_at).getTime() > 180 * 24 * 60 * 60 * 1000
  ) {
    return 'stale' as const
  }
  return 'fresh' as const
}

export class DisabledLiveDataProvider implements CurrentDataProvider {
  readonly id = 'disabled'
  async retrieve() {
    return { status: 'unavailable' as const, urls: [], checkedAt: new Date().toISOString() }
  }
}

export function deriveCurrentDataNeeds(evidence: RoadmapEvidencePackage): CurrentDataNeed[] {
  const needs: CurrentDataNeed[] = []
  if (!evidence.verified_programmes.length) {
    needs.push({
      taskType: 'missing_programme_relationship',
      entityType: 'programme',
      entityId: null,
      field: 'verified programme offering and eligibility',
      officialDomain: null,
      narrowQuery: `Official programme and eligibility records for career ${evidence.primary_career.career_id}`,
    })
  }
  if (!evidence.verified_admission_cycles.length) {
    needs.push({
      taskType: 'missing_admission_cycle',
      entityType: 'admission_cycle',
      entityId: null,
      field: 'current admission cycle',
      officialDomain: null,
      narrowQuery: `Official current admission cycle for supplied verified programmes`,
    })
  }
  return needs.slice(0, 2)
}

export async function queueVerificationNeeds(
  pool: Pool,
  auth: AuthContext,
  config: AiConfig,
  evidence: RoadmapEvidencePackage,
) {
  const needs = deriveCurrentDataNeeds(evidence)
  for (const need of needs) {
    const exists = await pool.query(
      `select 1 from source_verification_tasks
       where organisation_id=$1 and entity_type=$2
         and coalesce(entity_id,'')=coalesce($3,'') and missing_field=$4
         and status in ('pending_review','in_progress')
       limit 1`,
      [auth.organisationId, need.entityType, need.entityId, need.field],
    )
    if (!exists.rowCount) {
      await pool.query(
        `insert into source_verification_tasks
         (organisation_id,requested_by,task_type,entity_type,entity_id,missing_field,
          official_domain,narrow_query,status,live_lookup_used)
         values($1,$2,$3,$4,$5,$6,$7,$8,'pending_review',false)`,
        [
          auth.organisationId,
          auth.userId,
          need.taskType,
          need.entityType,
          need.entityId,
          need.field,
          need.officialDomain,
          need.narrowQuery,
        ],
      )
    }
  }
  return {
    liveDataEnabled: config.liveDataEnabled,
    liveSearchUsed: false,
    liveSearchCount: 0,
    queuedTasks: needs.length,
  }
}
