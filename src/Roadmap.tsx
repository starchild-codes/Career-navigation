import { useEffect, useMemo, useState } from 'react'
import {
  generateAiRoadmap,
  getLatestAiRoadmap,
  updateAiRoadmap,
  type AiRoadmap,
  type AiRoadmapGeneration,
} from './aiRoadmapApi'
import { buildMatches, type Profile } from './recommendationEngine'

type RecordItem = {
  id?: string
  name: string
  summary?: string
  field?: string
  verification_status?: string
  source_url?: string
  last_reviewed?: string
}
type Step = {
  id: string
  phase: 'Now' | 'Next 6–12 months' | 'After current qualification' | 'Long-term'
  title: string
  detail: string
  mandatory: boolean
  done: boolean
}

const profileKey = 'cc-personalised-profile-v1'
const roadmapKey = 'cc-student-roadmap-v1'
const phaseLabels: Record<AiRoadmap['stages'][number]['stage'], string> = {
  now: 'Now',
  next_6_months: 'Next 6 months',
  before_applications: 'Before applications',
  admissions: 'Admissions',
  during_course: 'During the course',
  early_career: 'Early career',
}

const stage = (grade: string) =>
  grade.includes('8') || grade.includes('9') || grade.includes('10')
    ? 'school'
    : grade.includes('11') || grade.includes('12')
      ? 'applications'
      : 'undergraduate'

function defaultSteps(profile: Profile, career: string): Step[] {
  const current = stage(profile.grade)
  return [
    {
      id: 'subjects',
      phase: 'Now',
      title: current === 'school' ? 'Keep relevant subject options open' : 'Confirm subject eligibility',
      detail: `Review your current ${Object.keys(profile.subjects).join(', ') || 'subjects'} against the selected course before committing.`,
      mandatory: false,
      done: false,
    },
    {
      id: 'explore',
      phase: 'Now',
      title: 'Test the work in a small way',
      detail: `Complete one low-cost project, conversation, or short course connected to ${career}.`,
      mandatory: false,
      done: false,
    },
    {
      id: 'courses',
      phase: 'Next 6–12 months',
      title: current === 'school' ? 'Choose a flexible subject combination' : 'Shortlist course routes',
      detail: 'Compare degree, diploma, vocational and local options; do not treat one route as the only route.',
      mandatory: false,
      done: false,
    },
    {
      id: 'exam',
      phase: 'Next 6–12 months',
      title: 'Research entrance and application routes',
      detail:
        profile.examWillingness === 'Avoid if possible'
          ? 'Prioritise verified exam-light routes, while recording any required exam as a constraint.'
          : 'Check each programme’s official admissions page before registering for an exam.',
      mandatory: false,
      done: false,
    },
    {
      id: 'admission',
      phase: 'After current qualification',
      title: 'Apply only when programme facts are verified',
      detail: 'Confirm exact programme, eligibility, current cycle, fees, documents and official application route.',
      mandatory: true,
      done: false,
    },
    {
      id: 'experience',
      phase: 'Long-term',
      title: 'Build experience and choose a next specialisation',
      detail: 'Seek internships, projects, certification or postgraduate study only after checking requirements for the chosen role.',
      mandatory: false,
      done: false,
    },
  ]
}

export default function Roadmap({ notify }: { notify: (message: string) => void }) {
  const [profile] = useState<Profile | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(profileKey) || 'null')
    } catch {
      return null
    }
  })
  const matches = useMemo(() => (profile ? buildMatches(profile) : []), [profile])
  const [selected, setSelected] = useState(0)
  const career = matches[selected]
  const [steps, setSteps] = useState<Step[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(roadmapKey) || '[]')
      return saved.length
        ? saved
        : profile
          ? defaultSteps(profile, matches[0]?.name || 'your selected pathway')
          : []
    } catch {
      return profile ? defaultSteps(profile, matches[0]?.name || 'your selected pathway') : []
    }
  })
  const [data, setData] = useState<Record<string, RecordItem[]>>({})
  const [generation, setGeneration] = useState<AiRoadmapGeneration | null>(null)
  const [generationState, setGenerationState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [generationError, setGenerationError] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => localStorage.setItem(roadmapKey, JSON.stringify(steps)), [steps])
  useEffect(() => {
    void getLatestAiRoadmap()
      .then((latest) => setGeneration(latest))
      .catch(() => {})
  }, [])
  useEffect(() => {
    if (!career) return
    const query = encodeURIComponent(career.name.split(/[,&]/)[0])
    void Promise.all(
      ['Course', 'Exam', 'Scholarship'].map((type) =>
        fetch(`/api/knowledge?type=${type}&q=${query}&limit=5`)
          .then((response) => response.json())
          .then((payload) => [type, payload.records || []]),
      ),
    )
      .then((records) => setData(Object.fromEntries(records)))
      .catch(() => setData({}))
  }, [career])

  if (!profile) {
    return (
      <div className="content diagnostic">
        <p className="eyebrow">Pathway planner</p>
        <h1>Start with a student profile</h1>
        <p className="diagnostic-note">
          Complete the Career Diagnostic first. It provides the grade, subjects, constraints
          and priorities that make a roadmap specific.
        </p>
      </div>
    )
  }

  const verifiedSources =
    generation?.sources.filter((source) => source.verification_status === 'verified') || []
  const verifiedSourceTypes = new Set(verifiedSources.map((source) => source.entity_type))
  const missingRecordTypes = ['course', 'programme', 'exam', 'scholarship', 'admission cycle']
    .filter((type) => !verifiedSourceTypes.has(type.replace(' ', '_')))
  const lastVerifiedTimestamp = verifiedSources.reduce((latest, source) => {
    const timestamp = source.last_verified_at ? new Date(source.last_verified_at).getTime() : 0
    return Math.max(latest, Number.isFinite(timestamp) ? timestamp : 0)
  }, 0)

  const generate = async (force = false) => {
    if (!career) return
    if (force && !window.confirm('Regenerate this draft using the current profile and verified data?')) return
    setGenerationState('loading')
    setGenerationError('')
    try {
      const next = await generateAiRoadmap({
        profile: profile as unknown as Record<string, unknown>,
        primaryCareer: {
          name: career.name,
          fitFactors: career.why,
          concerns: career.concerns,
        },
        alternativeCareers: matches
          .filter((_, index) => index !== selected)
          .slice(0, 3)
          .map((match) => ({
            name: match.name,
            fitFactors: match.why,
            concerns: match.concerns,
          })),
        force,
      })
      setGeneration(next)
      setGenerationState('idle')
      notify(next?.cached ? 'Existing roadmap reused — no new AI tokens consumed' : 'AI-assisted roadmap draft created')
    } catch (error) {
      setGenerationState('error')
      setGenerationError(error instanceof Error ? error.message : 'Roadmap generation failed.')
    }
  }

  const saveGeneration = async (
    roadmap: AiRoadmap,
    status = generation?.status || 'draft',
  ) => {
    if (!generation) return
    try {
      const updated = await updateAiRoadmap(generation.id, {
        roadmap,
        status,
        counsellorNotes: notes,
      })
      setGeneration(updated)
      notify('Roadmap review saved')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save the roadmap review')
    }
  }

  const editStage = async (index: number) => {
    if (!generation) return
    const current = generation.roadmap.stages[index]
    const title = window.prompt('Stage title', current.title)
    if (!title) return
    const description = window.prompt('Stage wording', current.description)
    if (!description) return
    const roadmap = {
      ...generation.roadmap,
      stages: generation.roadmap.stages.map((item, itemIndex) =>
        itemIndex === index ? { ...item, title, description } : item,
      ),
    }
    setGeneration({ ...generation, roadmap, status: 'reviewed' })
    await saveGeneration(roadmap, 'reviewed')
  }

  const removeCourse = async (courseId: string) => {
    if (!generation) return
    const roadmap = {
      ...generation.roadmap,
      course_options: generation.roadmap.course_options.filter(
        (course) => course.course_id !== courseId,
      ),
    }
    setGeneration({ ...generation, roadmap, status: 'reviewed' })
    await saveGeneration(roadmap, 'reviewed')
  }

  const setStatus = async (status: 'reviewed' | 'approved' | 'published') => {
    if (!generation) return
    try {
      const updated = await updateAiRoadmap(generation.id, {
        status,
        counsellorNotes: notes,
      })
      setGeneration(updated)
      notify(`Roadmap marked ${status}`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update roadmap status')
    }
  }

  const add = () => {
    const title = window.prompt('Custom roadmap step')
    if (!title) return
    setSteps((current) => [
      ...current,
      {
        id: String(Date.now()),
        phase: 'Now',
        title,
        detail: 'Counsellor-added step. Add a source and deadline before relying on it.',
        mandatory: false,
        done: false,
      },
    ])
    notify('Custom roadmap step saved locally')
  }

  const exportPlan = () => {
    const content = `Manyfolds roadmap\nTarget: ${career?.name}\n\n${steps
      .map((stepItem) => `[${stepItem.done ? 'x' : ' '}] ${stepItem.phase}: ${stepItem.title}\n${stepItem.detail}`)
      .join('\n\n')}\n\nCollege admissions: programme-level verification may be incomplete.`
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }))
    anchor.download = 'manyfolds-roadmap.txt'
    anchor.click()
    URL.revokeObjectURL(anchor.href)
  }

  return (
    <div className="content diagnostic roadmap">
      <p className="eyebrow">Student-specific pathway planner</p>
      <div className="diagnostic-top">
        <div>
          <h1>From exploration to next action</h1>
          <p>
            Adapted for {profile.grade || 'your stage'}, {profile.geography || 'your location preference'} and{' '}
            {profile.budget || 'your stated budget'}.
          </p>
        </div>
        <div className="roadmap-actions">
          <button className="secondary" onClick={add}>Add counsellor step</button>
          <button className="secondary" onClick={exportPlan}>Export roadmap</button>
          <button className="new" disabled={generationState === 'loading'} onClick={() => void generate(false)}>
            {generationState === 'loading' ? 'Building from verified data…' : 'Generate AI Roadmap'}
          </button>
        </div>
      </div>

      {generationError && <div className="ai-roadmap-error" role="alert">{generationError}</div>}

      <section className="roadmap-capability" aria-label="Roadmap data capability">
        <article>
          <p className="eyebrow">Available now</p>
          <h3>Career guidance from verified records</h3>
          <p>
            Career-fit explanations, subject and skill connections, alternatives, trade-offs,
            questions and immediate next actions can be organised from verified career evidence.
          </p>
        </article>
        <article>
          <p className="eyebrow">Verification boundary</p>
          <h3>Programme admissions are not yet complete</h3>
          <p>
            Career guidance is available, but verified course, college and admission details are
            incomplete. Ask an authorised counsellor to add and verify programme information
            before using this roadmap for an application decision.
          </p>
        </article>
      </section>

      <div className="roadmap-tabs">
        {matches.slice(0, 5).map((match, index) => (
          <button
            className={selected === index ? 'active' : ''}
            onClick={() => setSelected(index)}
            key={match.name}
          >
            {match.name}<small>{match.band}</small>
          </button>
        ))}
      </div>

      <section className="panel diagnostic-report deterministic-compare">
        <p className="eyebrow">Deterministic recommendation · comparison baseline</p>
        <h2>{career?.name}</h2>
        <p className="diagnostic-note">
          Why: {career?.why.join('; ')}. {career?.concerns.join(' ')}
        </p>
        <p className="review">
          This selection comes from the transparent scoring engine. AI may explain and organise
          supplied records, but it cannot change the verified eligibility result.
        </p>
      </section>

      {generation && (
        <section className="panel ai-roadmap-draft">
          <div className="ai-roadmap-meta">
            <div>
              <p className="eyebrow">AI-assisted draft · {generation.status}</p>
              <small>
                Created {new Date(generation.generatedAt).toLocaleString()}
                {generation.cached ? ' · Reused from cache' : ''}
              </small>
            </div>
            <div className="roadmap-actions">
              <button className="secondary" onClick={() => void generate(true)}>Regenerate</button>
              <button className="secondary" onClick={() => void setStatus('reviewed')}>Save review</button>
              <button className="new" onClick={() => void setStatus('approved')}>Approve</button>
              {generation.status === 'approved' && (
                <button className="new" onClick={() => void setStatus('published')}>Publish</button>
              )}
            </div>
          </div>
          <p className="ai-notice">{generation.notice}</p>
          <div className="roadmap-verification-summary">
            <span><b>{verifiedSources.length}</b> verified sources</span>
            <span>
              <b>{lastVerifiedTimestamp ? new Date(lastVerifiedTimestamp).toLocaleDateString() : 'Not recorded'}</b>
              latest verification
            </span>
            <span><b>{missingRecordTypes.join(', ') || 'None'}</b> missing record types</span>
            <span><b>{generation.status.replaceAll('_', ' ')}</b> counsellor review state</span>
          </div>
          <h2>{generation.roadmap.roadmap_title}</h2>
          <p className="diagnostic-note">{generation.roadmap.summary}</p>

          <div className={`eligibility-box ${generation.roadmap.eligibility_summary.status}`}>
            <b>Eligibility: {generation.roadmap.eligibility_summary.status.replaceAll('_', ' ')}</b>
            <p>{generation.roadmap.eligibility_summary.explanation}</p>
            {generation.roadmap.eligibility_summary.missing_requirements.map((item) => (
              <small key={item}>Missing: {item}</small>
            ))}
          </div>

          <div className="ai-roadmap-grid">
            <div>
              <h3>Why it fits</h3>
              {generation.roadmap.why_it_fits.map((item) => (
                <div className="ai-fact" key={`${item.factor}-${item.student_evidence}`}>
                  <b>{item.factor}</b><small>{item.student_evidence}</small>
                </div>
              ))}
            </div>
            <div>
              <h3>Important trade-offs</h3>
              {generation.roadmap.important_tradeoffs.map((item) => (
                <div className="ai-fact" key={item}><small>{item}</small></div>
              ))}
            </div>
          </div>

          <h3>Roadmap stages</h3>
          <div className="ai-stage-list">
            {generation.roadmap.stages.map((stageItem, index) => (
              <article key={`${stageItem.stage}-${index}`}>
                <div>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <small>{phaseLabels[stageItem.stage]} · {stageItem.status.replaceAll('_', ' ')}</small>
                </div>
                <h4>{stageItem.title}</h4>
                <p>{stageItem.description}</p>
                <div className="ai-stage-tags">
                  {stageItem.mandatory && <b>Mandatory</b>}
                  {stageItem.unverified && <b className="unverified">Unverified wording</b>}
                  <button onClick={() => void editStage(index)}>Edit wording</button>
                </div>
              </article>
            ))}
          </div>

          {generation.roadmap.course_options.length > 0 && (
            <>
              <h3>Verified course options supplied to AI</h3>
              <div className="ai-option-list">
                {generation.roadmap.course_options.map((courseOption) => (
                  <article key={courseOption.course_id}>
                    <b>{courseOption.course_id}</b>
                    <p>{courseOption.reason}</p>
                    <button onClick={() => void removeCourse(courseOption.course_id)}>Remove</button>
                  </article>
                ))}
              </div>
            </>
          )}

          <div className="ai-roadmap-grid">
            <div>
              <h3>Next actions</h3>
              {generation.roadmap.next_actions.map((action) => (
                <div className="ai-fact" key={action.action}>
                  <b>{action.priority} · {action.action}</b><small>{action.reason}</small>
                </div>
              ))}
            </div>
            <div>
              <h3>Questions for the counsellor</h3>
              {generation.roadmap.questions_for_counsellor.map((question) => (
                <div className="ai-fact" key={question}><small>{question}</small></div>
              ))}
            </div>
          </div>

          <label className="ai-review-notes">
            Counsellor review notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add context, wording changes, or follow-up notes. These notes are not sent to the model."
            />
          </label>

          <div className="ai-sources">
            <h3>Sources and verification</h3>
            {!generation.sources.length && (
              <p className="review">No verified source records were supplied to this draft.</p>
            )}
            {generation.sources.map((source) => (
              <article key={source.record_id}>
                <div>
                  <b>{source.name}</b>
                  <small>
                    {source.entity_type} · {source.verification_status.replaceAll('_', ' ')}
                    {source.admission_cycle ? ` · ${source.admission_cycle}` : ''}
                  </small>
                </div>
                <div>
                  <small>
                    Last verified: {source.last_verified_at ? new Date(source.last_verified_at).toLocaleDateString() : 'Not recorded'}
                  </small>
                  {source.source_url && (
                    <a href={source.source_url} target="_blank" rel="noreferrer">Official source ↗</a>
                  )}
                </div>
              </article>
            ))}
          </div>

          {(generation.missingData.length > 0 || generation.validationWarnings.length > 0) && (
            <div className="ai-missing-data">
              <h3>Missing or unverified data</h3>
              <p>
                This roadmap does not include programme-specific admission guidance because the
                required institution-course records have not been verified.
              </p>
              {[...generation.missingData, ...generation.validationWarnings].map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
        </section>
      )}

      {(['Now', 'Next 6–12 months', 'After current qualification', 'Long-term'] as const).map(
        (phase) => (
          <section className="panel diagnostic-report roadmap-phase" key={phase}>
            <p className="eyebrow">{phase} · deterministic plan</p>
            {steps.filter((stepItem) => stepItem.phase === phase).map((stepItem) => (
              <label className="roadmap-step" key={stepItem.id}>
                <input
                  type="checkbox"
                  checked={stepItem.done}
                  onChange={() =>
                    setSteps((current) =>
                      current.map((item) =>
                        item.id === stepItem.id ? { ...item, done: !item.done } : item,
                      ),
                    )
                  }
                />
                <span>
                  <b>{stepItem.title}{stepItem.mandatory && ' · Verify before acting'}</b>
                  <small>{stepItem.detail}</small>
                </span>
              </label>
            ))}
          </section>
        ),
      )}

      <section className="panel diagnostic-report">
        <p className="eyebrow">Connected route records</p>
        <h2>Courses, exams & funding to investigate</h2>
        {(['Course', 'Exam', 'Scholarship'] as const).map((type) => (
          <div className="recommendation" key={type}>
            <b>{type}s</b>
            {(data[type] || []).length ? (
              (data[type] || []).map((item) => (
                <small key={item.name}>
                  {item.name} · {item.verification_status?.replaceAll('_', ' ') || 'verify current details'}
                </small>
              ))
            ) : (
              <small>No direct verified record found for this wording.</small>
            )}
          </div>
        ))}
        <p className="review">
          Exact college programmes, cycles, eligibility, fees, documents and scholarship
          relationships are omitted until programme-level records are verified.
        </p>
      </section>
    </div>
  )
}
