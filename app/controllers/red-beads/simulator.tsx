import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

import { routes } from '../../routes.ts'
import { ControlChart } from '../../ui/control-chart.tsx'
import {
  drawBinomial,
  drawHypergeometric,
  mean,
  mulberry32,
  rangeOf,
  xbarRLimits,
} from '../../stats.ts'

const DEFAULT_NAMES = ['Alex', 'Bao', 'Cris', 'Dani', 'Esai', 'Fadi']
const EAGER_WORKER_PREFIX = 'Eager Worker'

interface Worker {
  name: string
  origin: 'original' | 'replacement'
}

interface Draw {
  workerName: string
  redCount: number
}

type Round = Draw[]

interface Intervention {
  afterRound: number
  text: string
  kind: 'praise' | 'scold' | 'fire' | 'poster' | 'target'
}

interface SimConfig {
  totalBeads: number
  redFraction: number
  paddleSize: number
  withReplacement: boolean
  target: number
  seed: number
}

interface RedBeadSimulatorProps extends SerializableProps {
  initialSeed?: number
}

export const RedBeadSimulator = clientEntry(
  '/assets/app/controllers/red-beads/simulator.tsx#RedBeadSimulator',
  function RedBeadSimulator(handle: Handle<RedBeadSimulatorProps>) {
    let config: SimConfig = {
      totalBeads: 4000,
      redFraction: 0.2,
      paddleSize: 50,
      withReplacement: false,
      target: 8,
      seed: handle.props.initialSeed ?? 1,
    }
    let workers: Worker[] = DEFAULT_NAMES.map((name) => ({ name, origin: 'original' }))
    let rounds: Round[] = []
    let interventions: Intervention[] = []
    let eagerCounter = 1
    let prng = mulberry32(config.seed)

    function reseed() {
      prng = mulberry32(config.seed)
    }

    function reset() {
      rounds = []
      interventions = []
      eagerCounter = 1
      workers = DEFAULT_NAMES.map((name) => ({ name, origin: 'original' }))
      reseed()
      handle.update()
    }

    function runRound() {
      let N = config.totalBeads
      let K = Math.round(N * config.redFraction)
      let n = Math.min(config.paddleSize, N)
      let p = config.redFraction
      let draws: Draw[] = workers.map((w) => ({
        workerName: w.name,
        redCount: config.withReplacement
          ? drawBinomial(prng, n, p)
          : drawHypergeometric(prng, N, K, n),
      }))
      rounds = [...rounds, draws]
      handle.update()
    }

    function runFour() {
      let next: Round[] = [...rounds]
      let N = config.totalBeads
      let K = Math.round(N * config.redFraction)
      let n = Math.min(config.paddleSize, N)
      let p = config.redFraction
      for (let i = 0; i < 4; i++) {
        next.push(
          workers.map((w) => ({
            workerName: w.name,
            redCount: config.withReplacement
              ? drawBinomial(prng, n, p)
              : drawHypergeometric(prng, N, K, n),
          })),
        )
      }
      rounds = next
      handle.update()
    }

    function cumulativeReds(name: string): number {
      let total = 0
      for (let r of rounds) {
        for (let d of r) {
          if (d.workerName === name) total += d.redCount
        }
      }
      return total
    }

    function leaderboard(): { name: string; total: number; rank: number }[] {
      let entries = workers.map((w) => ({ name: w.name, total: cumulativeReds(w.name) }))
      entries.sort((a, b) => a.total - b.total)
      return entries.map((e, i) => ({ ...e, rank: i + 1 }))
    }

    function fireBottom() {
      if (workers.length === 0) return
      let board = leaderboard()
      let bottom = board[board.length - 1]
      let newName = `${EAGER_WORKER_PREFIX} ${eagerCounter++}`
      workers = workers.map((w) =>
        w.name === bottom.name ? { name: newName, origin: 'replacement' } : w,
      )
      interventions = [
        ...interventions,
        {
          afterRound: rounds.length,
          text: `Fired ${bottom.name} (${bottom.total} reds total). Hired ${newName}, who is very motivated.`,
          kind: 'fire',
        },
      ]
      handle.update()
    }

    function logIntervention(text: string, kind: Intervention['kind']) {
      interventions = [...interventions, { afterRound: rounds.length, text, kind }]
      handle.update()
    }

    function praiseBest() {
      if (rounds.length === 0) return
      let last = rounds[rounds.length - 1]
      let best = last.reduce((a, b) => (a.redCount <= b.redCount ? a : b))
      logIntervention(
        `Round ${rounds.length}: praised ${best.workerName} (only ${best.redCount} reds). Keep it up!`,
        'praise',
      )
    }

    function scoldWorst() {
      if (rounds.length === 0) return
      let last = rounds[rounds.length - 1]
      let worst = last.reduce((a, b) => (a.redCount >= b.redCount ? a : b))
      logIntervention(
        `Round ${rounds.length}: scolded ${worst.workerName} (${worst.redCount} reds). Try harder!`,
        'scold',
      )
    }

    function postPoster() {
      logIntervention(
        `Round ${rounds.length}: hung an inspirational poster: "Quality is everyone's job."`,
        'poster',
      )
    }

    function setSeed(s: number) {
      config.seed = s
      reset()
    }

    return () => {
      let workerNames = workers.map((w) => w.name)
      let perRoundMeans = rounds.map((r) => mean(r.map((d) => d.redCount)))
      let perRoundRanges = rounds.map((r) => rangeOf(r.map((d) => d.redCount)))
      let limits = xbarRLimits(rounds.map((r) => r.map((d) => d.redCount)))
      let board = leaderboard()
      let totalScoops = rounds.length * workers.length
      let totalReds = rounds.reduce((s, r) => s + r.reduce((s2, d) => s2 + d.redCount, 0), 0)
      let observedRedFraction = totalScoops > 0 ? totalReds / (totalScoops * config.paddleSize) : 0
      let outOfControl = rounds.flatMap((_, i) =>
        perRoundMeans[i] > limits.uclX || perRoundMeans[i] < limits.lclX ? [i] : [],
      )
      let targetFailures = rounds.flatMap((r) =>
        r.filter((d) => d.redCount > config.target),
      ).length

      return (
        <article mix={pageStyle}>
          <header mix={headerStyle}>
            <a href={routes.home.href()} mix={backLinkStyle}>
              ← All tools
            </a>
            <h1 mix={titleStyle}>The Red Bead Experiment</h1>
            <p mix={subtitleStyle}>
              Six "Willing Workers" each scoop {config.paddleSize} beads from a jar of{' '}
              {config.totalBeads.toLocaleString()} beads,{' '}
              {Math.round(config.redFraction * 100)}% of which are red. Red beads are defects.
              The defect rate is a property of the jar, not the worker.
            </p>
          </header>

          <section mix={controlBarStyle}>
            <div mix={buttonRowStyle}>
              <button
                type="button"
                mix={[primaryButtonStyle, on('click', runRound)]}
              >
                Run round
              </button>
              <button
                type="button"
                mix={[secondaryButtonStyle, on('click', runFour)]}
              >
                Run 4 rounds
              </button>
              <button
                type="button"
                mix={[ghostButtonStyle, on('click', reset)]}
              >
                Reset
              </button>
              <span mix={roundCounterStyle}>
                Round {rounds.length}
              </span>
            </div>
          </section>

          <section mix={mainGridStyle}>
            <div mix={leftColumnStyle}>
              <Jar redFraction={config.redFraction} />

              <WorkerRow workers={workers} board={board} lastRound={rounds[rounds.length - 1]} />

              {rounds.length > 0 && (
                <RoundTable
                  rounds={rounds}
                  workerNames={workerNames}
                  perRoundMeans={perRoundMeans}
                  perRoundRanges={perRoundRanges}
                  target={config.target}
                />
              )}

              {rounds.length >= 2 && (
                <div mix={chartGridStyle}>
                  <ControlChart
                    title={`X̄ chart — mean reds per round (n=${workers.length})`}
                    points={perRoundMeans}
                    cl={limits.xbar}
                    ucl={limits.uclX}
                    lcl={limits.lclX}
                    yLabel="Mean reds"
                  />
                  <ControlChart
                    title="R chart — range of reds per round"
                    points={perRoundRanges}
                    cl={limits.rbar}
                    ucl={limits.uclR}
                    lcl={limits.lclR}
                    yLabel="Range"
                  />
                </div>
              )}

              {rounds.length >= 4 && (
                <Verdict
                  observedRedFraction={observedRedFraction}
                  configuredRedFraction={config.redFraction}
                  outOfControlCount={outOfControl.length}
                  totalRounds={rounds.length}
                  targetFailures={targetFailures}
                  target={config.target}
                  paddleSize={config.paddleSize}
                />
              )}
            </div>

            <aside mix={rightColumnStyle}>
              <Panel title="Process parameters">
                <Field label={`Paddle size: ${config.paddleSize}`}>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="1"
                    value={String(config.paddleSize)}
                    mix={[
                      sliderStyle,
                      on('input', (event) => {
                        config.paddleSize = Number(event.currentTarget.value)
                        handle.update()
                      }),
                    ]}
                  />
                </Field>
                <Field
                  label={`Red fraction: ${(config.redFraction * 100).toFixed(0)}%`}
                >
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="1"
                    value={String(Math.round(config.redFraction * 100))}
                    mix={[
                      sliderStyle,
                      on('input', (event) => {
                        config.redFraction = Number(event.currentTarget.value) / 100
                        handle.update()
                      }),
                    ]}
                  />
                </Field>
                <Field label="Sampling">
                  <label mix={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={config.withReplacement}
                      mix={on('change', (event) => {
                        config.withReplacement = event.currentTarget.checked
                        handle.update()
                      })}
                    />
                    With replacement (binomial)
                  </label>
                </Field>
                <Field label={`Seed: ${config.seed}`}>
                  <input
                    type="number"
                    value={String(config.seed)}
                    mix={[
                      numberInputStyle,
                      on('change', (event) => {
                        let n = Number(event.currentTarget.value)
                        if (Number.isFinite(n)) setSeed(n)
                      }),
                    ]}
                  />
                </Field>
              </Panel>

              <Panel title="Management interventions">
                <p mix={panelHintStyle}>
                  Try them. None of these change the math — they only change the chart's narrative.
                </p>
                <div mix={interventionGridStyle}>
                  <button
                    type="button"
                    mix={[ghostButtonStyle, on('click', praiseBest)]}
                    disabled={rounds.length === 0}
                  >
                    Praise best
                  </button>
                  <button
                    type="button"
                    mix={[ghostButtonStyle, on('click', scoldWorst)]}
                    disabled={rounds.length === 0}
                  >
                    Scold worst
                  </button>
                  <button
                    type="button"
                    mix={[ghostButtonStyle, on('click', fireBottom)]}
                    disabled={rounds.length === 0}
                  >
                    Fire bottom worker
                  </button>
                  <button
                    type="button"
                    mix={[ghostButtonStyle, on('click', postPoster)]}
                  >
                    Hang inspirational poster
                  </button>
                </div>
                <Field label={`Target: ≤ ${config.target} reds per scoop`}>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="1"
                    value={String(config.target)}
                    mix={[
                      sliderStyle,
                      on('input', (event) => {
                        config.target = Number(event.currentTarget.value)
                        handle.update()
                      }),
                    ]}
                  />
                </Field>
                {rounds.length > 0 && (
                  <p mix={panelStatStyle}>
                    {targetFailures} of {totalScoops} scoops failed the target.
                  </p>
                )}
              </Panel>

              {interventions.length > 0 && (
                <Panel title="Intervention log">
                  <ol mix={logListStyle}>
                    {interventions.map((iv, i) => (
                      <li key={`iv-${i}`} mix={logItemStyle}>
                        <span mix={logKindStyle(iv.kind)}>{iv.kind}</span>
                        <span>{iv.text}</span>
                      </li>
                    ))}
                  </ol>
                </Panel>
              )}
            </aside>
          </section>
        </article>
      )
    }
  },
)

function Jar(handle: Handle<{ redFraction: number }>) {
  return () => {
    let { redFraction } = handle.props
    let cols = 24
    let rows = 8
    let total = cols * rows
    let reds = Math.round(total * redFraction)
    let r = 6
    let gap = 4
    let cellSize = r * 2 + gap
    let w = cols * cellSize
    let h = rows * cellSize
    let jitter = 3

    // Seeded so SSR and client hydration produce identical layouts. Calling the
    // same operations in the same order each render keeps positions stable; only
    // the red/white assignment moves when redFraction changes.
    let rand = mulberry32(0xbead5)
    let dx: number[] = []
    let dy: number[] = []
    for (let i = 0; i < total; i++) {
      dx.push((rand() * 2 - 1) * jitter)
      dy.push((rand() * 2 - 1) * jitter)
    }
    let order: number[] = Array.from({ length: total }, (_, i) => i)
    for (let i = total - 1; i > 0; i--) {
      let j = Math.floor(rand() * (i + 1))
      let tmp = order[i]
      order[i] = order[j]
      order[j] = tmp
    }
    let isRed: boolean[] = new Array(total).fill(false)
    for (let i = 0; i < reds; i++) isRed[order[i]] = true

    return (
      <div mix={jarWrapStyle}>
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" mix={jarSvgStyle}>
          {Array.from({ length: total }).map((_, i) => {
            let col = i % cols
            let row = Math.floor(i / cols)
            return (
              <circle
                key={`b-${i}`}
                cx={col * cellSize + r + dx[i]}
                cy={row * cellSize + r + dy[i]}
                r={r}
                fill={isRed[i] ? '#ff5148' : 'var(--surface-0)'}
                stroke="var(--text-tertiary)"
                stroke-opacity="0.25"
              />
            )
          })}
        </svg>
        <p mix={jarCaptionStyle}>
          The jar (illustrative; the simulation samples from {Math.round(redFraction * 100)}% red).
        </p>
      </div>
    )
  }
}

function WorkerRow(
  handle: Handle<{
    workers: Worker[]
    board: { name: string; total: number; rank: number }[]
    lastRound?: Round
  }>,
) {
  return () => {
    let { workers, board, lastRound } = handle.props
    let rankByName = new Map(board.map((b) => [b.name, b.rank]))
    let lastByName = new Map((lastRound ?? []).map((d) => [d.workerName, d.redCount]))
    return (
      <ul mix={workerRowStyle}>
        {workers.map((w) => {
          let rank = rankByName.get(w.name)
          let last = lastByName.get(w.name)
          return (
            <li key={`w-${w.name}`} mix={workerCardStyle}>
              <div mix={workerNameRowStyle}>
                <span mix={workerNameStyle}>{w.name}</span>
                {w.origin === 'replacement' && <span mix={tagStyle}>new</span>}
              </div>
              <div mix={workerStatsRowStyle}>
                <span>
                  Total: <strong>{board.find((b) => b.name === w.name)?.total ?? 0}</strong>
                </span>
                {rank != null && <span>Rank #{rank}</span>}
              </div>
              {last != null && (
                <div mix={workerLastStyle}>Last round: {last} reds</div>
              )}
            </li>
          )
        })}
      </ul>
    )
  }
}

function RoundTable(
  handle: Handle<{
    rounds: Round[]
    workerNames: string[]
    perRoundMeans: number[]
    perRoundRanges: number[]
    target: number
  }>,
) {
  return () => {
    let { rounds, workerNames, perRoundMeans, perRoundRanges, target } = handle.props
    return (
      <table mix={tableStyle}>
        <thead>
          <tr>
            <th mix={thStyle}>Round</th>
            {workerNames.map((n) => (
              <th key={`th-${n}`} mix={thStyle}>
                {n}
              </th>
            ))}
            <th mix={thStyle}>Mean</th>
            <th mix={thStyle}>Range</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((r, i) => {
            let byName = new Map(r.map((d) => [d.workerName, d.redCount]))
            return (
              <tr key={`r-${i}`}>
                <td mix={tdStyle}>{i + 1}</td>
                {workerNames.map((n) => {
                  let v = byName.get(n) ?? 0
                  return (
                    <td
                      key={`r-${i}-${n}`}
                      mix={tdStyle}
                      style={{ color: v > target ? '#ff5148' : undefined }}
                    >
                      {v}
                    </td>
                  )
                })}
                <td mix={tdStyle}>{perRoundMeans[i].toFixed(2)}</td>
                <td mix={tdStyle}>{perRoundRanges[i]}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }
}

function Verdict(
  handle: Handle<{
    observedRedFraction: number
    configuredRedFraction: number
    outOfControlCount: number
    totalRounds: number
    targetFailures: number
    target: number
    paddleSize: number
  }>,
) {
  return () => {
    let p = handle.props
    return (
      <section mix={verdictStyle}>
        <h2 mix={verdictTitleStyle}>Verdict after {p.totalRounds} rounds</h2>
        <p mix={verdictBodyStyle}>
          Observed defect rate:{' '}
          <strong>{(p.observedRedFraction * 100).toFixed(1)}%</strong>. Configured rate:{' '}
          <strong>{(p.configuredRedFraction * 100).toFixed(1)}%</strong>.{' '}
          {p.outOfControlCount === 0
            ? 'Every round mean sits inside the X̄ control limits.'
            : `${p.outOfControlCount} of ${p.totalRounds} rounds fell outside the control limits — try more rounds or a different seed.`}
        </p>
        <p mix={verdictBodyStyle}>
          {p.targetFailures} of {p.totalRounds * 6} scoops "failed" the target of ≤ {p.target}{' '}
          reds. Re-seed the run: the failures will follow the system, not the workers.
        </p>
        <p mix={verdictKickerStyle}>
          No worker's performance is statistically distinguishable from any other.
        </p>
      </section>
    )
  }
}

function Panel(handle: Handle<{ title: string; children?: unknown }>) {
  return () => (
    <section mix={panelStyle}>
      <h2 mix={panelTitleStyle}>{handle.props.title}</h2>
      <div mix={panelBodyStyle}>{handle.props.children as never}</div>
    </section>
  )
}

function Field(handle: Handle<{ label: string; children?: unknown }>) {
  return () => (
    <label mix={fieldStyle}>
      <span mix={fieldLabelStyle}>{handle.props.label}</span>
      {handle.props.children as never}
    </label>
  )
}

const pageStyle = css({
  '--surface-0': '#dee2e6',
  '--surface-3': '#f0f4f7',
  '--surface-4': '#f7fbff',
  '--text-primary': '#313539',
  '--text-tertiary': '#6f757b',
  '--brand-blue': '#2dacf9',
  '@media (prefers-color-scheme: dark)': {
    '--surface-0': '#1e2226',
    '--surface-3': '#3a4148',
    '--surface-4': '#4a525a',
    '--text-primary': '#e8ecef',
    '--text-tertiary': '#a8aeb3',
  },
  '& *, & *::before, & *::after': { boxSizing: 'border-box' },
  fontFamily:
    "'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
  color: 'var(--text-primary)',
  background: 'var(--surface-0)',
  minHeight: '100vh',
  margin: 0,
  padding: '32px clamp(16px, 4vw, 48px) 64px',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
})

const headerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  maxWidth: '720px',
})

const backLinkStyle = css({
  alignSelf: 'flex-start',
  fontSize: '12px',
  color: 'var(--text-tertiary)',
  textDecoration: 'none',
  transition: 'color 120ms ease',
  '&:hover, &:focus-visible': {
    color: 'var(--brand-blue)',
    outline: 'none',
  },
})

const titleStyle = css({
  margin: 0,
  fontSize: '24px',
  fontWeight: 700,
  letterSpacing: '0.02em',
})

const subtitleStyle = css({
  margin: 0,
  fontSize: '14px',
  lineHeight: 1.6,
  color: 'var(--text-tertiary)',
})

const controlBarStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  alignItems: 'center',
})

const buttonRowStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  alignItems: 'center',
})

const baseButtonStyle = {
  appearance: 'none',
  font: 'inherit',
  fontSize: '14px',
  cursor: 'pointer',
  padding: '10px 16px',
  borderRadius: '8px',
  border: 0,
  transition: 'background-color 120ms ease, color 120ms ease',
  '&:disabled': { opacity: 0.4, cursor: 'not-allowed' },
} as const

const primaryButtonStyle = css({
  ...baseButtonStyle,
  background: 'var(--brand-blue)',
  color: 'white',
  fontWeight: 700,
  '&:hover:not(:disabled)': { filter: 'brightness(1.05)' },
})

const secondaryButtonStyle = css({
  ...baseButtonStyle,
  background: 'var(--surface-3)',
  color: 'var(--text-primary)',
  '&:hover:not(:disabled)': { background: 'var(--surface-4)' },
})

const ghostButtonStyle = css({
  ...baseButtonStyle,
  background: 'transparent',
  color: 'var(--text-primary)',
  border: '1px solid var(--surface-3)',
  '&:hover:not(:disabled)': { background: 'var(--surface-4)' },
})

const roundCounterStyle = css({
  marginLeft: '8px',
  fontSize: '12px',
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
})

const mainGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 320px',
  gap: '24px',
  '@media (max-width: 960px)': {
    gridTemplateColumns: 'minmax(0, 1fr)',
  },
})

const leftColumnStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
  minWidth: 0,
})

const rightColumnStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
})

const jarWrapStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  background: 'var(--surface-3)',
  padding: '12px',
  borderRadius: '12px',
})

const jarSvgStyle = css({ display: 'block', maxWidth: '420px' })

const jarCaptionStyle = css({
  margin: 0,
  fontSize: '11px',
  color: 'var(--text-tertiary)',
})

const workerRowStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: '8px',
  margin: 0,
  padding: 0,
  listStyle: 'none',
})

const workerCardStyle = css({
  background: 'var(--surface-3)',
  borderRadius: '8px',
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
})

const workerNameRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
})

const workerNameStyle = css({
  fontWeight: 700,
  fontSize: '13px',
})

const tagStyle = css({
  fontSize: '9px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  background: 'var(--brand-blue)',
  color: 'white',
  padding: '2px 6px',
  borderRadius: '999px',
})

const workerStatsRowStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '11px',
  color: 'var(--text-tertiary)',
})

const workerLastStyle = css({
  fontSize: '11px',
  color: 'var(--text-tertiary)',
})

const tableStyle = css({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '12px',
  background: 'var(--surface-4)',
  borderRadius: '8px',
  overflow: 'hidden',
})

const thStyle = css({
  textAlign: 'left',
  padding: '8px 10px',
  fontWeight: 700,
  background: 'var(--surface-3)',
  borderBottom: '1px solid var(--surface-0)',
})

const tdStyle = css({
  padding: '6px 10px',
  borderBottom: '1px solid var(--surface-3)',
})

const chartGridStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
})

const verdictStyle = css({
  background: 'var(--surface-3)',
  borderRadius: '12px',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  borderLeft: '4px solid var(--brand-blue)',
})

const verdictTitleStyle = css({
  margin: 0,
  fontSize: '16px',
  fontWeight: 700,
})

const verdictBodyStyle = css({
  margin: 0,
  fontSize: '13px',
  lineHeight: 1.6,
})

const verdictKickerStyle = css({
  margin: '4px 0 0',
  fontSize: '14px',
  fontWeight: 700,
  color: 'var(--brand-blue)',
})

const panelStyle = css({
  background: 'var(--surface-3)',
  borderRadius: '12px',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
})

const panelTitleStyle = css({
  margin: 0,
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-tertiary)',
})

const panelBodyStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
})

const panelHintStyle = css({
  margin: 0,
  fontSize: '12px',
  lineHeight: 1.5,
  color: 'var(--text-tertiary)',
})

const panelStatStyle = css({
  margin: 0,
  fontSize: '12px',
  color: 'var(--text-primary)',
})

const interventionGridStyle = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px',
})

const fieldStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
})

const fieldLabelStyle = css({
  fontSize: '12px',
  color: 'var(--text-primary)',
})

const sliderStyle = css({
  width: '100%',
})

const numberInputStyle = css({
  appearance: 'none',
  font: 'inherit',
  fontSize: '13px',
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid var(--surface-0)',
  background: 'var(--surface-4)',
  color: 'var(--text-primary)',
})

const checkboxLabelStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '12px',
  color: 'var(--text-primary)',
})

const logListStyle = css({
  margin: 0,
  paddingLeft: '0',
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  maxHeight: '180px',
  overflowY: 'auto',
})

const logItemStyle = css({
  display: 'flex',
  gap: '8px',
  fontSize: '11px',
  lineHeight: 1.4,
  color: 'var(--text-primary)',
})

function logKindStyle(kind: Intervention['kind']) {
  let color =
    kind === 'fire'
      ? '#ff5148'
      : kind === 'praise'
        ? '#80e464'
        : kind === 'scold'
          ? '#ffdf5f'
          : kind === 'poster'
            ? '#ff65db'
            : 'var(--brand-blue)'
  return css({
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color,
    fontWeight: 700,
    flex: '0 0 auto',
    paddingTop: '2px',
  })
}
