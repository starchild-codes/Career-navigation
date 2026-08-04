import { useEffect, useMemo, useState } from 'react'
import {
  getVerificationWorkspace,
  reviewProgrammeCandidate,
  saveProgrammeCandidate,
  updateVerificationTask,
  type VerificationWorkspace,
} from './verificationApi'

const queueLabels: Record<string, string> = {
  missing_programme_relationship: 'Programme relationships',
  missing_eligibility: 'Eligibility',
  missing_exam: 'Examinations',
  missing_admission_cycle: 'Admission cycles',
  missing_fee: 'Fees',
  missing_scholarship: 'Scholarships',
  stale_record: 'Stale records',
  conflicting_source: 'Source conflicts',
}

export default function VerificationAdmin({ notify }: { notify: (message: string) => void }) {
  const [workspace, setWorkspace] = useState<VerificationWorkspace | null>(null)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const refresh = async () => {
    try {
      setError('')
      setWorkspace(await getVerificationWorkspace())
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load verification data.')
    }
  }
  useEffect(() => {
    void refresh()
  }, [])

  const tasks = useMemo(
    () =>
      (workspace?.tasks || []).filter(
        (task) => filter === 'all' || task.task_type === filter,
      ),
    [workspace, filter],
  )

  const taskAction = async (
    id: string,
    body: Parameters<typeof updateVerificationTask>[1],
  ) => {
    setBusy(id)
    try {
      await updateVerificationTask(id, body)
      await refresh()
      notify('Verification task updated')
    } catch (nextError) {
      notify(nextError instanceof Error ? nextError.message : 'Could not update task')
    } finally {
      setBusy('')
    }
  }

  const reviewProgramme = async (
    id: string,
    status: 'verified' | 'stale' | 'conflicting',
  ) => {
    const notes = window.prompt('Reviewer note (retained in source history)') || ''
    setBusy(id)
    try {
      await reviewProgrammeCandidate(id, {
        status,
        sourceStatus: status,
        dataSufficient: status === 'verified',
        notes,
      })
      await refresh()
      notify(`Programme marked ${status}`)
    } catch (nextError) {
      notify(nextError instanceof Error ? nextError.message : 'Could not review programme')
    } finally {
      setBusy('')
    }
  }

  const addProgramme = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form).entries()) as Record<string, string>
    setBusy('new-programme')
    try {
      await saveProgrammeCandidate(values)
      form.reset()
      await refresh()
      notify('Programme saved as pending review')
    } catch (nextError) {
      notify(nextError instanceof Error ? nextError.message : 'Could not save programme')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="content verification-admin">
      <section className="verification-hero">
        <div>
          <p className="eyebrow">Official-source verification</p>
          <h1>Programme data pilot</h1>
          <p>
            Imports stay out of AI evidence until an owner or admin verifies the exact
            relationship, official source, freshness and completeness.
          </p>
        </div>
        <div className="verification-guard">
          <b>Publication gate</b>
          <span>Pending, stale and conflicting records are never supplied to the model.</span>
        </div>
      </section>

      {error && <div className="ai-roadmap-error" role="alert">{error}</div>}

      <section className="verification-queues" aria-label="Verification queues">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          <b>{workspace?.tasks.length || 0}</b><span>All tasks</span>
        </button>
        {Object.entries(queueLabels).map(([key, label]) => {
          const count = workspace?.queueCounts.find((item) => item.task_type === key)?.count || 0
          return (
            <button className={filter === key ? 'active' : ''} onClick={() => setFilter(key)} key={key}>
              <b>{count}</b><span>{label}</span>
            </button>
          )
        })}
      </section>

      <section className="verification-layout">
        <div className="panel verification-list">
          <div className="panel-heading">
            <div><p className="eyebrow">Review queue</p><h2>{filter === 'all' ? 'All verification tasks' : queueLabels[filter]}</h2></div>
            <span className="count">{tasks.length} shown</span>
          </div>
          {!tasks.length && <p className="review">No tasks in this queue yet.</p>}
          {tasks.map((task) => {
            const source = task.result_source_urls?.[0] ||
              (task.official_domain ? `https://${task.official_domain}` : '')
            return (
              <article className="verification-task" key={task.id}>
                <div>
                  <small>{queueLabels[task.task_type] || task.task_type} · priority {task.priority}</small>
                  <b>{task.missing_field}</b>
                  <p>{task.narrow_query || `${task.entity_type} ${task.entity_id || ''}`}</p>
                </div>
                <span className={`verification-status ${task.status}`}>{task.status.replaceAll('_', ' ')}</span>
                <div className="verification-actions">
                  {source && <a href={source} target="_blank" rel="noreferrer">Open official source ↗</a>}
                  <button disabled={busy === task.id} onClick={() => void taskAction(task.id, { action: 'claim' })}>Claim</button>
                  <button
                    disabled={busy === task.id}
                    onClick={() => {
                      const reviewerNotes = window.prompt('Reviewer notes') || ''
                      const sourceUrl = window.prompt('Official source URL', source) || ''
                      void taskAction(task.id, {
                        status: 'verified',
                        reviewerNotes,
                        resultSourceUrls: sourceUrl ? [sourceUrl] : [],
                      })
                    }}
                  >Resolve</button>
                  <button
                    disabled={busy === task.id}
                    onClick={() => void taskAction(task.id, {
                      status: 'in_progress',
                      conflictNotes: window.prompt('Describe the source conflict') || '',
                    })}
                  >Record conflict</button>
                </div>
              </article>
            )
          })}
        </div>

        <form className="panel verification-form" onSubmit={addProgramme}>
          <p className="eyebrow">Pending-review import</p>
          <h2>Add or correct a programme</h2>
          <p className="review">Nothing entered here becomes verified automatically.</p>
          <label>Institution ID<input name="institutionId" required /></label>
          <label>Campus<input name="campus" /></label>
          <label>Exact programme name<input name="programmeName" required /></label>
          <div className="verification-field-pair">
            <label>Degree type<input name="degreeType" /></label>
            <label>Course ID<input name="courseId" /></label>
          </div>
          <div className="verification-field-pair">
            <label>Duration<input name="duration" /></label>
            <label>Study mode<input name="studyMode" /></label>
          </div>
          <label>Official programme URL<input name="officialProgrammeUrl" type="url" required /></label>
          <label>Official admissions URL<input name="officialAdmissionsUrl" type="url" /></label>
          <label>Reviewer note<textarea name="notes" /></label>
          <button className="new" disabled={busy === 'new-programme'}>Save pending record</button>
        </form>
      </section>

      <section className="panel verification-programmes">
        <div className="panel-heading">
          <div><p className="eyebrow">Programme records</p><h2>Awaiting complete verification</h2></div>
          <span className="count">{workspace?.programmes.length || 0} records</span>
        </div>
        {(workspace?.programmes || []).map((programme) => (
          <article key={programme.id}>
            <div>
              <b>{programme.institution_name} · {programme.programme_name}</b>
              <small>
                {programme.course_id || 'Course link missing'} · source {programme.source_status || 'missing'} ·
                record {programme.verification_status}
              </small>
            </div>
            <div className="verification-actions">
              {programme.source_url && <a href={programme.source_url} target="_blank" rel="noreferrer">Official source ↗</a>}
              <button disabled={busy === programme.id} onClick={() => void reviewProgramme(programme.id, 'verified')}>Verify complete record</button>
              <button disabled={busy === programme.id} onClick={() => void reviewProgramme(programme.id, 'stale')}>Mark stale</button>
              <button disabled={busy === programme.id} onClick={() => void reviewProgramme(programme.id, 'conflicting')}>Mark conflict</button>
            </div>
          </article>
        ))}
      </section>

      <section className="panel verification-history">
        <p className="eyebrow">Change history</p>
        <h2>Who reviewed what and when</h2>
        {(workspace?.events || []).map((event) => (
          <div key={event.id}>
            <b>{event.record_type} · {event.action}</b>
            <span>{event.previous_status || 'new'} → {event.next_status || 'unchanged'}</span>
            <small>{new Date(event.created_at).toLocaleString()}{event.notes ? ` · ${event.notes}` : ''}</small>
          </div>
        ))}
      </section>
    </div>
  )
}
