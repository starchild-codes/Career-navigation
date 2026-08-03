import { useEffect, useState } from 'react'
import './ManyfoldsLanding.css'

const possibilityExamples = [
  {
    number: '01',
    title: 'UX research',
    detail: 'People, behaviour + technology',
    fit: 'Strong fit',
  },
  {
    number: '02',
    title: 'Cognitive science',
    detail: 'Research, mind + computation',
    fit: 'Worth exploring',
  },
  {
    number: '03',
    title: 'Behavioural data',
    detail: 'Patterns, evidence + impact',
    fit: 'New connection',
  },
]

const interestExamples = [
  ['Psychology + computing', 'People, behaviour, and technology.'],
  ['History + chemistry', 'Research, science, and public impact.'],
  ['Economics + design', 'Creative, commercial, and product pathways.'],
]

const processSteps = [
  'Tell us what shapes your choices.',
  'See careers and courses that connect your interests.',
  'Compare eligibility, costs, location, and alternatives.',
  'Build a plan you can revisit and reshape.',
]

function Wordmark() {
  return (
    <span className="manyfolds-wordmark" aria-label="Manyfolds">
      many<span>folds</span>
    </span>
  )
}

export default function Landing({ openDashboard }: { openDashboard: () => void }) {
  const [showOpening, setShowOpening] = useState(true)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      setShowOpening(false)
      return
    }

    const timer = window.setTimeout(() => setShowOpening(false), 1550)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="manyfolds-landing">
      {showOpening && (
        <div className="manyfolds-opening" aria-hidden="true">
          <div className="opening-rule" />
          <Wordmark />
          <p>More than one way forward.</p>
        </div>
      )}

      <header className="manyfolds-nav">
        <a href="/" className="wordmark-link">
          <Wordmark />
        </a>
        <nav aria-label="Main navigation">
          <a href="#how">How it works</a>
          <a href="#counsellors">For counsellors</a>
        </nav>
        <button type="button" className="nav-sign-in" onClick={openDashboard}>
          Sign in
        </button>
      </header>

      <main>
        <section className="manyfolds-hero">
          <div className="hero-copy">
            <p className="eyebrow">Personalised pathway exploration</p>
            <h1>
              More than one interest.
              <em>More than one way forward.</em>
            </h1>
            <p className="hero-lead">
              Manyfolds brings together subjects, skills, academics, priorities, and
              circumstances—so students can explore careers, courses, colleges, and
              the pathways between them.
            </p>
            <div className="hero-actions">
              <button type="button" onClick={openDashboard}>
                Explore my possibilities <span>↗</span>
              </button>
              <a href="#how">See how it works</a>
            </div>
            <p className="hero-proof">
              Whole-student signals <i /> Connected pathways <i /> Realistic trade-offs
            </p>
          </div>

          <div className="pathway-preview" aria-label="Example personalised pathway">
            <div className="preview-heading">
              <div>
                <span>Example pattern</span>
                <strong>What could these interests become?</strong>
              </div>
              <span className="preview-status">Live map</span>
            </div>

            <article className="student-pattern">
              <small>Interests that meet</small>
              <h2>
                Psychology <span>+</span> Computer Science
              </h2>
              <p>Listening · research · coding · systems thinking</p>
            </article>

            <div className="pathway-connector" aria-hidden="true">
              <span />
            </div>

            <div className="possibility-list">
              {possibilityExamples.map((possibility) => (
                <article key={possibility.title}>
                  <span className="result-number">{possibility.number}</span>
                  <div>
                    <h3>{possibility.title}</h3>
                    <p>{possibility.detail}</p>
                  </div>
                  <small>{possibility.fit}</small>
                </article>
              ))}
            </div>

            <p className="preview-note">
              Three connected possibilities. No single prescribed answer.
            </p>
          </div>
        </section>

        <section className="manyfolds-statement">
          <p>Students are more complicated than one stream.</p>
          <h2>
            Different interests can belong together. Manyfolds keeps those combinations
            visible—without pretending there is one perfect answer.
          </h2>
        </section>

        <section className="manyfolds-examples">
          <div className="section-heading">
            <p className="eyebrow">Where interests can meet</p>
            <h2>From scattered interests to connected possibilities.</h2>
          </div>
          <div className="example-grid">
            {interestExamples.map(([title, description], index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
                <button type="button" onClick={openDashboard}>
                  Explore this combination <b>↗</b>
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="manyfolds-process" id="how">
          <div>
            <p className="eyebrow">A clearer process</p>
            <h2>From what matters to what’s possible.</h2>
            <p>
              A pathway is not a verdict. It is a set of informed options you can
              compare, test, and change.
            </p>
          </div>
          <ol>
            {processSteps.map((step, index) => (
              <li key={step}>
                <span>0{index + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="manyfolds-counsellor" id="counsellors">
          <div>
            <p className="eyebrow">For counsellors</p>
            <h2>More context. Less fragmented guidance.</h2>
            <p>
              Review profile signals, compare pathways, and keep the next useful step
              visible for every student.
            </p>
            <button type="button" onClick={openDashboard}>
              Explore the counsellor workspace
            </button>
          </div>
          <aside>
            <span>Student context</span>
            <div>
              <b>Interests</b>
              <b>Academic fit</b>
              <b>Eligibility</b>
              <b>Priorities</b>
            </div>
            <p>One connected guidance view.</p>
          </aside>
        </section>

        <section className="manyfolds-close">
          <p className="eyebrow">Manyfolds</p>
          <h2>Your future does not have to fit into one box.</h2>
          <button type="button" onClick={openDashboard}>
            Start exploring <span>↗</span>
          </button>
        </section>
      </main>

      <footer className="manyfolds-footer">
        <Wordmark />
        <p>More than one interest. More than one way forward.</p>
        <button type="button" onClick={openDashboard}>
          For counsellors
        </button>
      </footer>
    </div>
  )
}
