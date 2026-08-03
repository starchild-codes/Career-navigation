import { useEffect, useState } from 'react'
import './ManyfoldsLanding.css'

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

function FoldMark({ large = false }: { large?: boolean }) {
  return (
    <svg
      className={large ? 'fold-mark fold-mark-large' : 'fold-mark'}
      viewBox="0 0 72 72"
      role="img"
      aria-label="Manyfolds branching pathways symbol"
    >
      <path className="branch-route branch-route-top" d="M8 36h13c5 0 7-2 11-7l11-11c3-3 6-4 11-4h11" />
      <path className="branch-route branch-route-middle" d="M8 36h57" />
      <path className="branch-route branch-route-bottom" d="M8 36h13c5 0 7 2 11 7l11 11c3 3 6 4 11 4h11" />
      <circle className="branch-origin" cx="8" cy="36" r="5" />
      <circle className="branch-end branch-end-top" cx="65" cy="14" r="3.5" />
      <circle className="branch-end branch-end-middle" cx="65" cy="36" r="3.5" />
      <circle className="branch-end branch-end-bottom" cx="65" cy="58" r="3.5" />
    </svg>
  )
}

function Wordmark({ withMark = true }: { withMark?: boolean }) {
  return (
    <span className="manyfolds-lockup">
      {withMark && <FoldMark />}
      <span className="manyfolds-wordmark" aria-label="Manyfolds">
        many<span>folds</span>
      </span>
    </span>
  )
}

function PossibilityMap() {
  return (
    <div className="possibility-map" aria-label="Animated example of interests becoming pathways">
      <svg viewBox="0 0 560 540" aria-hidden="true">
        <defs>
          <linearGradient id="route-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#b7d6a7" />
            <stop offset="1" stopColor="#77a58f" />
          </linearGradient>
          <filter id="node-glow">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path className="map-route route-one" d="M102 92C170 120 177 225 278 268S402 347 452 438" />
        <path className="map-route route-two" d="M280 70C274 139 230 191 278 268S285 393 268 464" />
        <path className="map-route route-three" d="M461 110C401 140 393 220 278 268S155 348 100 430" />
        <path className="map-route route-four" d="M82 260C148 256 205 284 278 268S409 242 481 266" />
        <circle className="map-pulse" cx="278" cy="268" r="22" />
        <circle className="map-core" cx="278" cy="268" r="9" filter="url(#node-glow)" />
      </svg>

      <span className="map-label source source-one">psychology</span>
      <span className="map-label source source-two">coding</span>
      <span className="map-label source source-three">research</span>
      <span className="map-label source source-four">context</span>
      <span className="map-label source source-five">priorities</span>

      <div className="map-centre">
        <FoldMark />
        <span>Your pattern</span>
      </div>

      <article className="map-result result-one">
        <small>01 · strong fit</small>
        <strong>UX research</strong>
        <span>people + technology</span>
      </article>
      <article className="map-result result-two">
        <small>02 · explore</small>
        <strong>Cognitive science</strong>
        <span>mind + computation</span>
      </article>
      <article className="map-result result-three">
        <small>03 · new link</small>
        <strong>Behavioural data</strong>
        <span>patterns + impact</span>
      </article>
    </div>
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

    const timer = window.setTimeout(() => setShowOpening(false), 2850)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="manyfolds-landing">
      {showOpening && (
        <div className="manyfolds-opening" aria-hidden="true">
          <div className="opening-stage">
            <FoldMark large />
            <div>
              <Wordmark withMark={false} />
              <p>possibilities, unfolded.</p>
            </div>
          </div>
          <div className="opening-paths">
            <i />
            <i />
            <i />
          </div>
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
                <span>Possibility map · live example</span>
                <strong>One student. Many connected directions.</strong>
              </div>
              <span className="preview-status"><i /> Mapping</span>
            </div>
            <PossibilityMap />
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
