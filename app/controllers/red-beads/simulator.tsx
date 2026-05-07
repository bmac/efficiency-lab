import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

import {
  drawBinomial,
  drawHypergeometric,
  mean,
  mulberry32,
  rangeOf,
  xbarRLimits,
} from '../../stats.ts'
import { ControlChart } from '../../ui/control-chart.tsx'
import {
  DraftingButton,
  FieldSlider,
  Panel,
  Readout,
  SheetHeader,
  T,
} from '../../ui/shell.tsx'
import { computeLeaderboard, type LeaderboardEntry } from './leaderboard.ts'

const DEFAULT_NAMES = ['ALEX', 'BAO', 'CRIS', 'DANI', 'ESAI', 'FADI']
const EAGER_WORKER_PREFIX = 'EAGER'

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

    function draw(): number {
      let N = config.totalBeads
      let K = Math.round(N * config.redFraction)
      let n = Math.min(config.paddleSize, N)
      return config.withReplacement
        ? drawBinomial(prng, n, config.redFraction)
        : drawHypergeometric(prng, N, K, n)
    }

    function runRound() {
      let next: Round = workers.map((w) => ({ workerName: w.name, redCount: draw() }))
      rounds = [...rounds, next]
      handle.update()
    }

    function runFour() {
      let next: Round[] = [...rounds]
      for (let i = 0; i < 4; i++) {
        next.push(workers.map((w) => ({ workerName: w.name, redCount: draw() })))
      }
      rounds = next
      handle.update()
    }

    function fireBottom() {
      if (workers.length === 0) return
      let board = computeLeaderboard(workers, rounds)
      let ranked = board.filter((e) => e.rank != null)
      if (ranked.length === 0) return
      let bottom = ranked[ranked.length - 1]
      let newName = `${EAGER_WORKER_PREFIX}-${eagerCounter++}`
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
        `Round ${rounds.length}: praised ${best.workerName} (only ${best.redCount} reds).`,
        'praise',
      )
    }

    function scoldWorst() {
      if (rounds.length === 0) return
      let last = rounds[rounds.length - 1]
      let worst = last.reduce((a, b) => (a.redCount >= b.redCount ? a : b))
      logIntervention(
        `Round ${rounds.length}: scolded ${worst.workerName} (${worst.redCount} reds). Try harder.`,
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
      let board = computeLeaderboard(workers, rounds)
      let totalScoops = rounds.length * workers.length
      let totalReds = rounds.reduce((s, r) => s + r.reduce((s2, d) => s2 + d.redCount, 0), 0)
      let observedRedFraction =
        totalScoops > 0 ? totalReds / (totalScoops * config.paddleSize) : 0
      let outOfControl = rounds.flatMap((_, i) =>
        perRoundMeans[i] > limits.uclX || perRoundMeans[i] < limits.lclX ? [i] : [],
      )
      let targetFailures = rounds.flatMap((r) =>
        r.filter((d) => d.redCount > config.target),
      ).length
      let lastRound = rounds[rounds.length - 1]
      let expectedReds = config.paddleSize * config.redFraction

      return (
        <article mix={pageStyle}>
          <SheetHeader
            fig="Fig. 1.0 — Deming apparatus"
            title="The Red Bead Experiment"
            subtitle={`Six willing workers each scoop ${config.paddleSize} beads from a jar of ${config.totalBeads.toLocaleString()} beads, ${Math.round(config.redFraction * 100)}% of which are red. Red beads are defects. The defect rate is a property of the jar, not the worker.`}
          />

          <div mix={twoColStyle}>
            <div mix={mainColumnStyle}>
              <Panel label="Jar · Section A-A" padding={20}>
                <Jar
                  redFraction={config.redFraction}
                  paddleSize={config.paddleSize}
                  totalBeads={config.totalBeads}
                />
              </Panel>

              <Panel label="Tally · Operators OP-01 … OP-06" padding={20}>
                <WorkerRow
                  workers={workers}
                  board={board}
                  lastRound={lastRound}
                  rounds={rounds}
                  expectedReds={expectedReds}
                />
                <div mix={tallyFootStyle}>
                  <span>
                    {rounds.length ? `${rounds.length} rounds run` : 'Awaiting first round'}
                  </span>
                  <span>Note — rank order is noise. Re-seed to re-rank.</span>
                </div>
              </Panel>

              {rounds.length > 0 && (
                <Panel label="Round table" padding={18}>
                  <RoundTable
                    rounds={rounds}
                    workerNames={workerNames}
                    perRoundMeans={perRoundMeans}
                    perRoundRanges={perRoundRanges}
                    target={config.target}
                  />
                </Panel>
              )}

              {rounds.length >= 2 && (
                <Panel label="Fig. 1.1 — Defects per round (X̄ chart)" padding={20}>
                  <ControlChart
                    title=""
                    points={perRoundMeans}
                    cl={limits.xbar}
                    ucl={limits.uclX}
                    lcl={limits.lclX}
                    yLabel="Mean reds"
                    xLabel="Round"
                  />
                </Panel>
              )}

              {rounds.length >= 2 && (
                <Panel label="Fig. 1.2 — Range per round (R chart)" padding={20}>
                  <ControlChart
                    title=""
                    points={perRoundRanges}
                    cl={limits.rbar}
                    ucl={limits.uclR}
                    lcl={limits.lclR}
                    yLabel="Range"
                    xLabel="Round"
                  />
                </Panel>
              )}

              {rounds.length >= 4 && (
                <Panel label="Verdict" padding={20}>
                  <Verdict
                    observedRedFraction={observedRedFraction}
                    configuredRedFraction={config.redFraction}
                    outOfControlCount={outOfControl.length}
                    totalRounds={rounds.length}
                    targetFailures={targetFailures}
                    target={config.target}
                    workerCount={workers.length}
                  />
                </Panel>
              )}
            </div>

            <aside mix={asideStyle}>
              <Panel label="Controls · Panel B" padding={16}>
                <FieldSlider
                  label="Paddle size"
                  unit="beads"
                  value={config.paddleSize}
                  min={10}
                  max={120}
                  step={1}
                  onChange={(v) => {
                    config.paddleSize = v
                    handle.update()
                  }}
                />
                <FieldSlider
                  label="Red fraction"
                  value={config.redFraction}
                  min={0.05}
                  max={0.6}
                  step={0.01}
                  format={(v) => `${(v * 100).toFixed(0)}%`}
                  onChange={(v) => {
                    config.redFraction = v
                    handle.update()
                  }}
                />
                <FieldSlider
                  label="Seed"
                  value={config.seed}
                  min={1}
                  max={9999}
                  step={1}
                  format={(v) => String(Math.round(v)).padStart(5, '0')}
                  onChange={(v) => setSeed(Math.round(v))}
                />
                <label mix={checkboxRowStyle}>
                  <input
                    type="checkbox"
                    checked={config.withReplacement}
                    mix={on('change', (event) => {
                      config.withReplacement = event.currentTarget.checked
                      handle.update()
                    })}
                  />
                  <span>With replacement (binomial)</span>
                </label>
                <DraftingButton primary full onClick={runRound}>
                  ▶ Run round
                </DraftingButton>
                <div mix={twoButtonRowStyle}>
                  <DraftingButton onClick={runFour}>Run × 4</DraftingButton>
                  <DraftingButton onClick={reset}>Reset</DraftingButton>
                </div>
              </Panel>

              <Panel label="Live readout" padding={16}>
                <Readout k="Rounds" v={rounds.length} />
                <Readout k="Observed" v={`${(observedRedFraction * 100).toFixed(2)}%`} accent />
                <Readout k="Expected" v={`${(config.redFraction * 100).toFixed(2)}%`} />
                <Readout k="Defects" v={`${totalReds} / ${totalScoops * config.paddleSize}`} />
                <Readout k="Over target" v={`${targetFailures} / ${totalScoops}`} />
              </Panel>

              <Panel label="Interventions" padding={16}>
                <FieldSlider
                  label="Target"
                  unit="reds/scoop"
                  value={config.target}
                  min={0}
                  max={40}
                  step={1}
                  onChange={(v) => {
                    config.target = v
                    handle.update()
                  }}
                />
                <div mix={twoButtonRowStyle}>
                  <DraftingButton onClick={praiseBest} disabled={rounds.length === 0}>
                    Praise best
                  </DraftingButton>
                  <DraftingButton onClick={scoldWorst} disabled={rounds.length === 0}>
                    Scold worst
                  </DraftingButton>
                  <DraftingButton onClick={fireBottom} disabled={rounds.length === 0}>
                    Fire last
                  </DraftingButton>
                  <DraftingButton onClick={postPoster}>Hang poster</DraftingButton>
                </div>
                <div mix={hintStyle}>⚠ None of these alter the math. Chart narrative only.</div>
              </Panel>

              {interventions.length > 0 && (
                <Panel label="Intervention log" padding={16}>
                  <ol mix={logListStyle}>
                    {interventions
                      .slice()
                      .reverse()
                      .map((iv, i) => (
                        <li key={`iv-${interventions.length - i}`} mix={logItemStyle}>
                          <span mix={logKindStyle(iv.kind)}>{iv.kind}</span>
                          <span>{iv.text}</span>
                        </li>
                      ))}
                  </ol>
                </Panel>
              )}

              <Panel label="Drafting note" padding={16}>
                <div mix={noteStyle}>
                  Whichever operator drew the most red beads this round is no better and no
                  worse than any other. The jar made them all. The lesson is to fix the jar.
                </div>
              </Panel>
            </aside>
          </div>
        </article>
      )
    }
  },
)

function Jar(handle: Handle<{ redFraction: number; paddleSize: number; totalBeads: number }>) {
  return () => {
    let { redFraction, paddleSize, totalBeads } = handle.props
    let cols = 28
    let rows = 8
    let total = cols * rows
    let reds = Math.round(total * redFraction)
    let r = 6
    let gap = 4
    let cellSize = r * 2 + gap
    let w = cols * cellSize
    let h = rows * cellSize

    let rand = mulberry32(0xbead5)
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
      <div mix={jarRowStyle}>
        <div mix={jarMainStyle}>
          <svg viewBox={`0 0 ${w} ${h}`} mix={jarSvgStyle}>
            {Array.from({ length: total }).map((_, i) => {
              let col = i % cols
              let row = Math.floor(i / cols)
              return (
                <circle
                  key={`b-${i}`}
                  cx={col * cellSize + r}
                  cy={row * cellSize + r}
                  r={r - 1}
                  fill={isRed[i] ? T.accent : 'none'}
                  stroke={T.ink}
                  stroke-width="0.6"
                  opacity={isRed[i] ? 1 : 0.55}
                />
              )
            })}
          </svg>
          <div mix={dimensionRowStyle}>
            <div mix={dimensionLineStyle} />
            <div mix={dimensionTickLeftStyle} />
            <div mix={dimensionTickRightStyle} />
            <div mix={dimensionLabelStyle}>
              APPROX. {Math.round(redFraction * 100)}% RED · Ø3.0 mm typ.
            </div>
          </div>
        </div>
        <div mix={jarStatsStyle}>
          <div mix={jarStatLabelStyle}>Population</div>
          <div mix={jarStatValueStyle}>{Math.round(redFraction * totalBeads)}</div>
          <div mix={jarStatHintStyle}>red of {totalBeads}</div>
          <div mix={jarStatLabelTopStyle}>Paddle size</div>
          <div mix={jarStatValueSmStyle}>{paddleSize}</div>
          <div mix={jarStatHintStyle}>beads / scoop</div>
        </div>
      </div>
    )
  }
}

function WorkerRow(
  handle: Handle<{
    workers: Worker[]
    board: LeaderboardEntry[]
    lastRound?: Round
    rounds: Round[]
    expectedReds: number
  }>,
) {
  return () => {
    let { workers, board, lastRound, rounds, expectedReds } = handle.props
    let rankByName = new Map(board.map((b) => [b.name, b.rank]))
    let totalByName = new Map(board.map((b) => [b.name, b.total]))
    let lastByName = new Map((lastRound ?? []).map((d) => [d.workerName, d.redCount]))
    let maxLast = Math.max(1, ...(lastRound ?? []).map((d) => d.redCount), expectedReds)

    return (
      <div mix={tallyGridStyle}>
        {workers.map((w, i) => {
          let rank = rankByName.get(w.name)
          let last = lastByName.get(w.name)
          let total = totalByName.get(w.name) ?? 0
          return (
            <div key={`w-${w.name}`} mix={tallyCardStyle}>
              <div mix={tallyHeaderStyle}>
                <span>OP-{String(i + 1).padStart(2, '0')}</span>
                {rank != null && <span mix={tallyRankStyle}>RANK #{rank}</span>}
              </div>
              <div mix={tallyNameStyle}>
                {w.name}
                {w.origin === 'replacement' && <span mix={tallyTagStyle}> · NEW</span>}
              </div>
              <div mix={tallyMicroLabelStyle}>TOTAL</div>
              <div mix={tallyTotalStyle}>{total}</div>
              <div mix={tallyMicroLabelStyle}>LAST</div>
              <div mix={tallyLastStyle}>{rounds.length ? (last ?? 0) : '—'}</div>
              <div mix={tallyHistRowStyle}>
                {Array.from({ length: 16 }).map((_, j) => {
                  let r = rounds[rounds.length - 16 + j]
                  let val = r?.find((d) => d.workerName === w.name)?.redCount
                  return (
                    <div
                      key={`h-${i}-${j}`}
                      mix={val == null ? tallyHistEmptyStyle : tallyHistBarStyle}
                      style={
                        val == null
                          ? undefined
                          : { height: `${Math.max(2, (val / maxLast) * 18)}px` }
                      }
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
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
      <div mix={tableScrollStyle}>
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
                        style={v > target ? { color: T.accent, fontWeight: 700 } : undefined}
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
      </div>
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
    workerCount: number
  }>,
) {
  return () => {
    let p = handle.props
    return (
      <div mix={verdictBodyStyle}>
        <p mix={verdictParaStyle}>
          Observed defect rate: <strong>{(p.observedRedFraction * 100).toFixed(1)}%</strong>.
          Configured rate: <strong>{(p.configuredRedFraction * 100).toFixed(1)}%</strong>.{' '}
          {p.outOfControlCount === 0
            ? 'Every round mean sits inside the X̄ control limits.'
            : `${p.outOfControlCount} of ${p.totalRounds} rounds fell outside the control limits — try more rounds or a different seed.`}
        </p>
        <p mix={verdictParaStyle}>
          {p.targetFailures} of {p.totalRounds * p.workerCount} scoops "failed" the target of ≤{' '}
          {p.target} reds. Re-seed the run: the failures will follow the system, not the workers.
        </p>
        <p mix={verdictKickerStyle}>
          No worker's performance is statistically distinguishable from any other.
        </p>
      </div>
    )
  }
}

// -------------------------------------------------------------------------
// Styles
// -------------------------------------------------------------------------

const pageStyle = css({
  fontFamily: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
  color: T.ink,
  display: 'flex',
  flexDirection: 'column',
  gap: '28px',
})

const twoColStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 320px',
  gap: '24px',
  alignItems: 'flex-start',
  '@media (max-width: 1100px)': {
    gridTemplateColumns: 'minmax(0, 1fr)',
  },
})

const mainColumnStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
  minWidth: 0,
})

const asideStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  position: 'sticky',
  top: '96px',
  '@media (max-width: 1100px)': {
    position: 'static',
    top: 'auto',
  },
})

const jarRowStyle = css({
  display: 'flex',
  gap: '20px',
  alignItems: 'flex-start',
  '@media (max-width: 720px)': { flexDirection: 'column' },
})

const jarMainStyle = css({ flex: 1, minWidth: 0 })

const jarSvgStyle = css({
  display: 'block',
  width: '100%',
  height: 'auto',
  maxHeight: '180px',
})

const dimensionRowStyle = css({
  marginTop: '14px',
  position: 'relative',
  height: '18px',
})

const dimensionLineStyle = css({
  position: 'absolute',
  left: 0,
  right: 0,
  top: '9px',
  borderTop: `1px solid ${T.ink}`,
  opacity: 0.6,
})

const dimensionTickLeftStyle = css({
  position: 'absolute',
  left: 0,
  top: '4px',
  height: '10px',
  borderLeft: `1px solid ${T.ink}`,
  opacity: 0.6,
})

const dimensionTickRightStyle = css({
  position: 'absolute',
  right: 0,
  top: '4px',
  height: '10px',
  borderRight: `1px solid ${T.ink}`,
  opacity: 0.6,
})

const dimensionLabelStyle = css({
  position: 'absolute',
  left: '50%',
  top: 0,
  transform: 'translateX(-50%)',
  background: T.paper,
  padding: '0 8px',
  fontSize: '10px',
  letterSpacing: '0.12em',
})

const jarStatsStyle = css({
  width: '120px',
  fontSize: '10px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  borderLeft: `1px dashed ${T.ink}`,
  paddingLeft: '14px',
  alignSelf: 'stretch',
})

const jarStatLabelStyle = css({ opacity: 0.7 })
const jarStatLabelTopStyle = css({ opacity: 0.7, marginTop: '14px' })

const jarStatValueStyle = css({
  fontSize: '28px',
  fontWeight: 700,
  color: T.accent,
  letterSpacing: 0,
  lineHeight: 1,
})

const jarStatValueSmStyle = css({
  fontSize: '24px',
  fontWeight: 700,
  color: T.accent,
  letterSpacing: 0,
  lineHeight: 1,
})

const jarStatHintStyle = css({ opacity: 0.6 })

const tallyGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 1fr)',
  gap: '8px',
  '@media (max-width: 880px)': { gridTemplateColumns: 'repeat(3, 1fr)' },
  '@media (max-width: 520px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
})

const tallyCardStyle = css({
  border: `1px solid ${T.ink}`,
  padding: '12px',
  position: 'relative',
})

const tallyHeaderStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '9px',
  opacity: 0.7,
  letterSpacing: '0.14em',
})

const tallyRankStyle = css({ color: T.accent, opacity: 1 })

const tallyNameStyle = css({
  fontSize: '15px',
  fontWeight: 700,
  marginTop: '4px',
  letterSpacing: '0.02em',
})

const tallyTagStyle = css({
  fontSize: '9px',
  opacity: 0.7,
  letterSpacing: '0.14em',
})

const tallyMicroLabelStyle = css({
  marginTop: '8px',
  fontSize: '9px',
  letterSpacing: '0.14em',
  opacity: 0.7,
})

const tallyTotalStyle = css({ fontSize: '20px', fontWeight: 700, lineHeight: 1 })
const tallyLastStyle = css({ fontSize: '13px', fontWeight: 700, color: T.accent })

const tallyHistRowStyle = css({
  marginTop: '8px',
  display: 'flex',
  gap: '1px',
  alignItems: 'flex-end',
  height: '20px',
  borderBottom: `1px solid ${T.ink}`,
})

const tallyHistBarStyle = css({ flex: 1, background: T.ink })
const tallyHistEmptyStyle = css({ flex: 1, height: '1px', background: T.ruleFaint })

const tallyFootStyle = css({
  marginTop: '14px',
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '10px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  opacity: 0.7,
  gap: '12px',
  flexWrap: 'wrap',
})

const tableScrollStyle = css({
  overflowX: 'auto',
})

const tableStyle = css({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '11px',
  fontVariantNumeric: 'tabular-nums',
})

const thStyle = css({
  textAlign: 'left',
  padding: '6px 8px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  fontSize: '10px',
  borderBottom: `1px solid ${T.ink}`,
})

const tdStyle = css({
  padding: '5px 8px',
  borderBottom: `1px dashed ${T.ink}`,
})

const checkboxRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '11px',
  letterSpacing: '0.04em',
  marginBottom: '12px',
  cursor: 'pointer',
})

const twoButtonRowStyle = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '4px',
  marginTop: '6px',
})

const hintStyle = css({
  marginTop: '12px',
  fontSize: '10px',
  opacity: 0.65,
  lineHeight: 1.5,
  letterSpacing: '0.04em',
})

const noteStyle = css({
  fontSize: '11px',
  lineHeight: 1.55,
})

const logListStyle = css({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  maxHeight: '220px',
  overflowY: 'auto',
})

const logItemStyle = css({
  display: 'grid',
  gridTemplateColumns: '64px 1fr',
  gap: '8px',
  fontSize: '11px',
  lineHeight: 1.4,
  paddingTop: '6px',
  borderTop: `1px dashed ${T.ink}`,
  '&:first-child': { borderTop: 'none', paddingTop: 0 },
})

function logKindStyle(kind: Intervention['kind']) {
  let color =
    kind === 'fire'
      ? T.accent
      : kind === 'praise'
        ? T.ink
        : kind === 'scold'
          ? T.warn
          : kind === 'poster'
            ? T.inkSoft
            : T.ink
  return css({
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color,
    fontWeight: 700,
    paddingTop: '2px',
  })
}

const verdictBodyStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
})

const verdictParaStyle = css({
  margin: 0,
  fontSize: '12px',
  lineHeight: 1.6,
})

const verdictKickerStyle = css({
  margin: '4px 0 0',
  fontSize: '13px',
  fontWeight: 700,
  color: T.accent,
  letterSpacing: '0.02em',
})
