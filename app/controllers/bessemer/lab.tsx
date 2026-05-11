import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

import { DraftingButton, FieldSlider, Panel, Readout, SheetHeader, T } from '../../ui/shell.tsx'
import {
  COMPETITORS,
  PROCESSES,
  SCALE_CAPACITY,
  SteelMill,
  getProcess,
  railDemandTons,
  railPriceUsd,
  simulateCompetitor,
  type CompetitorStrategy,
  type MillConfig,
  type OreType,
  type Posture,
  type ProcessId,
  type Scale,
  type YearReport,
} from './mill.ts'

interface BessemerLabProps extends SerializableProps {}

interface ScheduledSwitch {
  year: number
  process: ProcessId
}

const START_YEAR = 1850
const END_YEAR = 1910

const SPEED_OPTIONS = [1, 2, 5, 15] as const
type Speed = (typeof SPEED_OPTIONS)[number]

const ORE_OPTIONS: { id: OreType; label: string; hint: string }[] = [
  { id: 'low-p', label: 'Low-P', hint: 'Lake Superior · Bessemer-friendly' },
  { id: 'high-p', label: 'High-P', hint: 'Penn / European · needs basic process' },
  { id: 'mixed', label: 'Mixed', hint: 'Blended feedstock · partial penalty on acid' },
]

const SCALE_OPTIONS: { id: Scale; label: string }[] = [
  { id: 'small', label: 'Small · 5k t/y' },
  { id: 'regional', label: 'Regional · 50k t/y' },
  { id: 'carnegie', label: 'Carnegie · 500k t/y' },
]

const POSTURE_OPTIONS: { id: Posture; label: string; hint: string }[] = [
  { id: 'conservative', label: 'Conservative', hint: 'Limited capex; slow to scrap & rebuild' },
  { id: 'aggressive', label: 'Aggressive', hint: 'Carnegie posture · 1.5× capex per switch' },
]

function runSimFull(config: MillConfig, switches: readonly ScheduledSwitch[]): YearReport[] {
  let mill = new SteelMill(config)
  let pending = [...switches].sort((a, b) => a.year - b.year)
  while (mill.year <= END_YEAR) {
    while (pending.length > 0 && pending[0].year === mill.year) {
      let s = pending.shift()!
      let spec = getProcess(s.process)
      if (spec.availableFrom <= mill.year) mill.setProcess(s.process)
    }
    mill.tick()
  }
  return mill.history
}

function configKey(config: MillConfig, switches: readonly ScheduledSwitch[]): string {
  let head = `${config.startYear}|${config.process}|${config.ore}|${config.scale}|${config.posture}|${config.seed}`
  let tail = switches.map((s) => `${s.year}:${s.process}`).join(',')
  return `${head}#${tail}`
}

interface CompetitorRun {
  strategy: CompetitorStrategy
  history: readonly YearReport[]
}

function runCompetitors(): CompetitorRun[] {
  return COMPETITORS.map((s) => ({ strategy: s, history: simulateCompetitor(s, END_YEAR) }))
}

export const BessemerLab = clientEntry(
  '/assets/app/controllers/bessemer/lab.tsx#BessemerLab',
  function BessemerLab(handle: Handle<BessemerLabProps>) {
    let config: MillConfig = {
      startYear: START_YEAR,
      process: 'puddling',
      ore: 'low-p',
      scale: 'regional',
      posture: 'conservative',
      seed: 1,
    }
    let switches: ScheduledSwitch[] = []
    let targetYear = START_YEAR
    let paused = false
    let speed: Speed = 5
    let lastFrame: number | null = null
    let competitors = runCompetitors()
    let simCache: { key: string; full: YearReport[] } | null = null

    function simHistory(): YearReport[] {
      let key = configKey(config, switches)
      if (!simCache || simCache.key !== key) {
        simCache = { key, full: runSimFull(config, switches) }
      }
      return simCache.full
    }

    if (typeof requestAnimationFrame !== 'undefined') {
      let frameId: number | null = null
      function tick(now: number) {
        if (handle.signal.aborted) return
        if (paused || targetYear >= END_YEAR) {
          lastFrame = now
        } else if (lastFrame != null) {
          let dt = Math.min(now - lastFrame, 200) / 1000
          lastFrame = now
          let next = Math.min(END_YEAR, targetYear + dt * speed)
          if (Math.floor(next) !== Math.floor(targetYear)) {
            targetYear = next
            handle.update()
          } else {
            targetYear = next
          }
        } else {
          lastFrame = now
        }
        frameId = requestAnimationFrame(tick)
      }
      frameId = requestAnimationFrame(tick)
      handle.signal.addEventListener('abort', () => {
        if (frameId != null) cancelAnimationFrame(frameId)
      })
    }

    function reset() {
      switches = []
      targetYear = START_YEAR
      paused = false
      lastFrame = null
      handle.update()
    }

    function togglePause() {
      paused = !paused
      lastFrame = null
      handle.update()
    }

    function setSpeed(s: Speed) {
      speed = s
      handle.update()
    }

    function setOre(ore: OreType) {
      config = { ...config, ore }
      handle.update()
    }

    function setScale(scale: Scale) {
      config = { ...config, scale }
      handle.update()
    }

    function setPosture(posture: Posture) {
      config = { ...config, posture }
      handle.update()
    }

    function adoptProcess(id: ProcessId) {
      let year = Math.max(START_YEAR, Math.ceil(targetYear))
      let spec = getProcess(id)
      if (spec.availableFrom > year) return
      // Drop any prior switch scheduled at or after the current year, then add.
      switches = switches.filter((s) => s.year < year)
      switches.push({ year, process: id })
      handle.update()
    }

    function setTargetYear(y: number) {
      targetYear = Math.max(START_YEAR, Math.min(END_YEAR, y))
      // Discard scheduled switches that the player has rewound past.
      switches = switches.filter((s) => s.year <= Math.floor(targetYear))
      lastFrame = null
      handle.update()
    }

    return () => {
      let displayYear = Math.floor(targetYear)
      let fullHistory = simHistory()
      let history = fullHistory.filter((h) => h.year <= displayYear)
      let lastReport = history[history.length - 1]
      let activeProcess = lastReport?.process ?? config.process
      let recentEvents = history
        .slice(-3)
        .flatMap((h) => h.events.map((e) => ({ year: h.year, event: e })))
      let oreMismatch = lastReport?.oreMismatch ?? false
      let bankrupt = lastReport?.bankrupt ?? false
      let priceNow = railPriceUsd(displayYear)
      let demandNow = railDemandTons(displayYear)

      return (
        <article mix={pageStyle}>
          <SheetHeader
            fig="Fig. 5.0 — Adoption under uncertainty"
            title="Bessemer Cost Collapse"
            subtitle="You run a steel mill from 1850 to 1910. New processes unlock as the years tick by — Bessemer in 1856, open hearth in 1865, Thomas-Gilchrist's basic lining in 1879. Each one arrives with a capex bill, a quality risk, and an ore constraint. Adopt early and you bet the company on a process that hasn't worked at scale yet. Adopt late and the early descenders are already underselling you. Steel rails fell from $170/ton in 1867 to $32/ton in 1898 — the lab makes the timing decision the lesson."
          />

          <div mix={twoColStyle}>
            <div mix={mainColumnStyle}>
              <Panel label="Fig. 5.1 — Year ticker · 1850 → 1910" padding={20}>
                <YearTicker
                  year={displayYear}
                  paused={paused}
                  bankrupt={bankrupt}
                  events={recentEvents}
                />
                <input
                  type="range"
                  min={String(START_YEAR)}
                  max={String(END_YEAR)}
                  step="1"
                  value={String(displayYear)}
                  aria-label="Simulation year"
                  mix={[
                    yearSliderStyle,
                    on('input', (e) => setTargetYear(Number(e.currentTarget.value))),
                  ]}
                />
              </Panel>

              <Panel label={`Fig. 5.2 — Mill · ${getProcess(activeProcess).name}`} padding={20}>
                <MillDiagram process={activeProcess} bankrupt={bankrupt} />
                {oreMismatch && <OreWarning process={activeProcess} ore={config.ore} />}
              </Panel>

              <Panel label="Fig. 5.3 — Cost / ton vs. market price" padding={16}>
                <PriceCostChart history={history} competitors={competitors} />
              </Panel>

              <Panel label="Fig. 5.4 — Cumulative profit ($)" padding={16}>
                <ProfitChart history={history} competitors={competitors} />
              </Panel>

              <div mix={metricsGridStyle}>
                <MetricColumn title="This year" report={lastReport} accent />
                <MetricColumn title="Cumulative" report={lastReport} cumulative />
              </div>
            </div>

            <aside mix={asideStyle}>
              <Panel label="Sim controls" padding={16}>
                <div mix={twoButtonRowStyle}>
                  <DraftingButton primary onClick={togglePause}>
                    {paused ? '▶ Run' : '‖ Pause'}
                  </DraftingButton>
                  <DraftingButton onClick={reset}>Reset</DraftingButton>
                </div>
                <div mix={speedGroupStyle}>
                  {SPEED_OPTIONS.map((s) => (
                    <SpeedButton
                      key={`speed-${s}`}
                      speed={s}
                      active={s === speed}
                      onClick={() => setSpeed(s)}
                    />
                  ))}
                </div>
                <Readout k="Year" v={String(displayYear)} accent />
                <Readout k="Market price" v={`$${priceNow.toFixed(0)}/ton`} />
                <Readout
                  k="Industry demand"
                  v={`${(demandNow / 1000).toFixed(0)}k tons`}
                />
              </Panel>

              <Panel label="Process panel" padding={16}>
                <div mix={processGridStyle}>
                  {PROCESSES.map((p) => (
                    <ProcessCard
                      key={`p-${p.id}`}
                      process={p}
                      year={displayYear}
                      active={activeProcess === p.id}
                      onAdopt={() => adoptProcess(p.id)}
                    />
                  ))}
                </div>
              </Panel>

              <Panel label="Ore source" padding={16}>
                <div mix={profileGroupStyle}>
                  {ORE_OPTIONS.map((opt) => (
                    <ProfileButton
                      key={`ore-${opt.id}`}
                      label={opt.label}
                      hint={opt.hint}
                      active={config.ore === opt.id}
                      onClick={() => setOre(opt.id)}
                    />
                  ))}
                </div>
              </Panel>

              <Panel label="Scale" padding={16}>
                <div mix={profileGroupStyle}>
                  {SCALE_OPTIONS.map((opt) => (
                    <ProfileButton
                      key={`scale-${opt.id}`}
                      label={opt.label}
                      hint={`Capacity ${SCALE_CAPACITY[opt.id].toLocaleString()} tons`}
                      active={config.scale === opt.id}
                      onClick={() => setScale(opt.id)}
                    />
                  ))}
                </div>
              </Panel>

              <Panel label="Capital posture" padding={16}>
                <div mix={profileGroupStyle}>
                  {POSTURE_OPTIONS.map((opt) => (
                    <ProfileButton
                      key={`pos-${opt.id}`}
                      label={opt.label}
                      hint={opt.hint}
                      active={config.posture === opt.id}
                      onClick={() => setPosture(opt.id)}
                    />
                  ))}
                </div>
              </Panel>

              <Panel label="Drafting note" padding={16}>
                <div mix={noteStyle}>
                  Steel rails cost ~$170/ton in 1867; ~$32/ton in 1898. The lab plots
                  market price (exogenous) against your cost/ton (depends on process and
                  years since invention). The gap is your margin per ton. A mill stuck on
                  puddling will see that gap close, then invert. The ghost competitors —
                  Crucible Co., Bessemer Pioneer, Carnegie — run their own preset
                  strategies; their cumulative profit lines are the bar to clear.
                </div>
              </Panel>
            </aside>
          </div>
        </article>
      )
    }
  },
)

// -------------------------------------------------------------------------
// Sub-components
// -------------------------------------------------------------------------

function YearTicker(
  handle: Handle<{
    year: number
    paused: boolean
    bankrupt: boolean
    events: readonly { year: number; event: string }[]
  }>,
) {
  return () => {
    let { year, paused, bankrupt, events } = handle.props
    let label = bankrupt ? 'BANKRUPT' : paused ? 'PAUSED' : 'RUNNING'
    return (
      <div mix={tickerWrapStyle}>
        <div mix={tickerYearStyle}>{year}</div>
        <div mix={tickerMetaStyle}>
          <span mix={tickerStateStyle}>{label}</span>
          <span mix={tickerSpanStyle}>
            {START_YEAR} ⟶ {END_YEAR}
          </span>
        </div>
        <div mix={tickerEventsStyle}>
          {events.length === 0 ? (
            <span mix={tickerEventEmptyStyle}>—</span>
          ) : (
            events.map((e, i) => (
              <span key={`evt-${i}`} mix={tickerEventStyle}>
                {e.year} · {humanEvent(e.event)}
              </span>
            ))
          )}
        </div>
      </div>
    )
  }
}

function humanEvent(e: string): string {
  switch (e) {
    case 'panic-1873':
      return 'Panic of 1873 · cash haircut'
    case 'ore-mismatch':
      return 'Ore-process mismatch · defects spike'
    case 'bankrupt':
      return 'Mill bankrupt'
    default:
      return e
  }
}

function MillDiagram(handle: Handle<{ process: ProcessId; bankrupt: boolean }>) {
  return () => {
    let { process, bankrupt } = handle.props
    return (
      <div mix={diagramWrapStyle} style={{ opacity: bankrupt ? 0.35 : 1 }}>
        {process === 'puddling' && <PuddlingFurnace />}
        {process === 'cementation' && <CementationFurnace />}
        {process === 'crucible' && <CrucibleFurnace />}
        {(process === 'bessemer-acid' || process === 'bessemer-basic') && <BessemerConverter />}
        {(process === 'open-hearth' || process === 'basic-open-hearth') && <OpenHearth />}
        <div mix={diagramCaptionStyle}>{getProcess(process).description}</div>
      </div>
    )
  }
}

function PuddlingFurnace() {
  return () => (
    <svg viewBox="0 0 400 120" mix={diagramSvgStyle}>
      <rect x="40" y="50" width="180" height="50" fill="none" stroke={T.ink} stroke-width="1.2" />
      <line x1="60" y1="50" x2="60" y2="100" stroke={T.ink} stroke-width="0.6" />
      <line x1="200" y1="50" x2="200" y2="100" stroke={T.ink} stroke-width="0.6" />
      <rect x="80" y="60" width="100" height="20" fill={T.accentSoft} stroke={T.accent} stroke-width="0.8" />
      <line x1="100" y1="40" x2="100" y2="60" stroke={T.ink} stroke-width="1" />
      <circle cx="100" cy="36" r="5" fill="none" stroke={T.ink} stroke-width="0.8" />
      <text x="130" y="115" font-size="10" font-family="IBM Plex Mono" fill={T.ink} text-anchor="middle">
        REVERBERATORY · PUDDLER STIRS
      </text>
      <line x1="220" y1="74" x2="280" y2="74" stroke={T.ink} stroke-width="0.6" />
      <polygon points="280,70 290,74 280,78" fill={T.ink} />
      <rect x="295" y="60" width="60" height="30" fill="none" stroke={T.ink} stroke-width="0.8" />
      <text x="325" y="79" font-size="9" text-anchor="middle" font-family="IBM Plex Mono" fill={T.ink}>BLOOM</text>
    </svg>
  )
}

function CementationFurnace() {
  return () => (
    <svg viewBox="0 0 400 120" mix={diagramSvgStyle}>
      <rect x="80" y="40" width="240" height="60" fill="none" stroke={T.ink} stroke-width="1.2" />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={`bar-${i}`}
          x={100 + i * 50}
          y="55"
          width="32"
          height="30"
          fill={T.accentSoft}
          stroke={T.accent}
          stroke-width="0.8"
        />
      ))}
      <text x="200" y="115" font-size="10" font-family="IBM Plex Mono" fill={T.ink} text-anchor="middle">
        SEALED CHEST · CARBON DIFFUSES INTO IRON BARS
      </text>
    </svg>
  )
}

function CrucibleFurnace() {
  return () => (
    <svg viewBox="0 0 400 120" mix={diagramSvgStyle}>
      {[0, 1, 2, 3].map((i) => (
        <g key={`pot-${i}`}>
          <ellipse cx={70 + i * 70} cy="80" rx="22" ry="8" fill="none" stroke={T.ink} stroke-width="0.8" />
          <path
            d={`M ${48 + i * 70} 80 Q ${48 + i * 70} 50 ${70 + i * 70} 50 Q ${92 + i * 70} 50 ${92 + i * 70} 80`}
            fill="none"
            stroke={T.ink}
            stroke-width="0.8"
          />
          <ellipse cx={70 + i * 70} cy="50" rx="22" ry="6" fill={T.accent} opacity="0.7" />
        </g>
      ))}
      <text x="200" y="115" font-size="10" font-family="IBM Plex Mono" fill={T.ink} text-anchor="middle">
        SEALED POTS · BENCHMARK QUALITY · TINY OUTPUT
      </text>
    </svg>
  )
}

function BessemerConverter() {
  return () => (
    <svg viewBox="0 0 400 140" mix={diagramSvgStyle}>
      <line x1="60" y1="120" x2="340" y2="120" stroke={T.ink} stroke-width="0.6" />
      <g transform="rotate(-25 200 90)">
        <path
          d="M 170 30 Q 160 40 160 60 L 170 100 Q 200 110 230 100 L 240 60 Q 240 40 230 30 Z"
          fill={T.accentSoft}
          stroke={T.ink}
          stroke-width="1.2"
        />
        <ellipse cx="200" cy="30" rx="15" ry="4" fill={T.accent} />
      </g>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line
          key={`spark-${i}`}
          x1={250 + i * 5}
          y1={30 - i * 4}
          x2={258 + i * 5}
          y2={20 - i * 4}
          stroke={T.accent}
          stroke-width="1"
        />
      ))}
      <text x="200" y="135" font-size="10" font-family="IBM Plex Mono" fill={T.ink} text-anchor="middle">
        PEAR CONVERTER · COLD BLAST · MINUTES PER HEAT
      </text>
    </svg>
  )
}

function OpenHearth() {
  return () => (
    <svg viewBox="0 0 400 120" mix={diagramSvgStyle}>
      <rect x="40" y="55" width="320" height="35" fill="none" stroke={T.ink} stroke-width="1.2" />
      <rect x="60" y="65" width="280" height="15" fill={T.accentSoft} stroke={T.accent} stroke-width="0.8" />
      {[0, 1].map((i) => (
        <g key={`reg-${i}`}>
          <rect
            x={i === 0 ? 30 : 360}
            y="40"
            width="20"
            height="60"
            fill="none"
            stroke={T.ink}
            stroke-width="0.8"
          />
          <line
            x1={i === 0 ? 50 : 360}
            y1="55"
            x2={i === 0 ? 60 : 360}
            y2="55"
            stroke={T.ink}
            stroke-width="0.6"
          />
        </g>
      ))}
      <text x="200" y="115" font-size="10" font-family="IBM Plex Mono" fill={T.ink} text-anchor="middle">
        REGENERATIVE · LONG SHALLOW HEARTH · CLEAN STEEL
      </text>
    </svg>
  )
}

function OreWarning(handle: Handle<{ process: ProcessId; ore: OreType }>) {
  return () => {
    let { process, ore } = handle.props
    return (
      <div mix={oreWarnStyle}>
        ⚠ Ore mismatch — {getProcess(process).shortName} cannot handle {ore.toUpperCase()} ore.
        Defects are spiking; penalty cost is crushing margin. Bessemer's first commercial run
        failed for exactly this reason.
      </div>
    )
  }
}

function PriceCostChart(
  handle: Handle<{ history: readonly YearReport[]; competitors: readonly CompetitorRun[] }>,
) {
  return () => {
    let { history, competitors } = handle.props
    let width = 720
    let height = 160
    let pad = 28

    let years: number[] = []
    for (let y = START_YEAR; y <= END_YEAR; y++) years.push(y)

    let priceLine = years.map((y) => ({ y, v: railPriceUsd(y) }))
    let costLine = history.map((h) => ({ y: h.year, v: h.costPerTon }))
    let compLines = competitors.map((c) => ({
      strategy: c.strategy,
      points: c.history.map((h) => ({ y: h.year, v: h.costPerTon })),
    }))

    let allValues = [
      ...priceLine.map((p) => p.v),
      ...costLine.map((p) => p.v),
      ...compLines.flatMap((c) => c.points.map((p) => p.v)),
      0,
    ]
    let maxV = Math.max(...allValues, 1)

    let xScale = (yr: number) =>
      pad + ((yr - START_YEAR) / (END_YEAR - START_YEAR)) * (width - pad * 2)
    let yScale = (v: number) => height - pad - (v / maxV) * (height - pad * 2)

    let mkPath = (pts: { y: number; v: number }[]) =>
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.y).toFixed(1)} ${yScale(p.v).toFixed(1)}`).join(' ')

    return (
      <div mix={chartWrapStyle}>
        <div mix={chartLegendStyle}>
          <span>
            <span mix={legendDashedStyle} /> Market price
          </span>
          <span>
            <span mix={legendAccentStyle} /> Your cost/ton
          </span>
          {competitors.length > 0 && (
            <span>
              <span mix={legendInkStyle} /> Competitor cost/ton
            </span>
          )}
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} mix={chartSvgStyle} role="img" aria-label="Cost per ton vs. market price over time">
          <title>Cost per ton vs. market price, {START_YEAR}–{END_YEAR}</title>
          {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
            <line
              key={`gl-${i}`}
              x1={pad}
              y1={pad + f * (height - pad * 2)}
              x2={width - pad}
              y2={pad + f * (height - pad * 2)}
              stroke={T.ink}
              stroke-width="0.4"
              opacity="0.18"
            />
          ))}
          <text x={width - pad} y={pad - 4} font-size="9" text-anchor="end" font-family="IBM Plex Mono" fill={T.ink} opacity="0.6">${maxV.toFixed(0)}/t</text>
          <text x={pad} y={height - 6} font-size="9" font-family="IBM Plex Mono" fill={T.ink} opacity="0.6">{START_YEAR}</text>
          <text x={width - pad} y={height - 6} font-size="9" text-anchor="end" font-family="IBM Plex Mono" fill={T.ink} opacity="0.6">{END_YEAR}</text>
          <path d={mkPath(priceLine)} stroke={T.ink} stroke-width="1" stroke-dasharray="4 3" fill="none" />
          {compLines.map((c, i) => (
            <path
              key={`comp-${i}`}
              d={mkPath(c.points)}
              stroke={T.ink}
              stroke-width="0.8"
              fill="none"
              opacity="0.4"
            />
          ))}
          {costLine.length > 0 && (
            <path d={mkPath(costLine)} stroke={T.accent} stroke-width="1.8" fill="none" />
          )}
        </svg>
      </div>
    )
  }
}

function ProfitChart(
  handle: Handle<{ history: readonly YearReport[]; competitors: readonly CompetitorRun[] }>,
) {
  return () => {
    let { history, competitors } = handle.props
    let width = 720
    let height = 160
    let pad = 28

    let mine = history.map((h) => ({ y: h.year, v: h.cumulativeProfit }))
    let compLines = competitors.map((c) => ({
      strategy: c.strategy,
      points: c.history.map((h) => ({ y: h.year, v: h.cumulativeProfit })),
    }))

    let all = [
      ...mine.map((p) => p.v),
      ...compLines.flatMap((c) => c.points.map((p) => p.v)),
      0,
    ]
    let maxV = Math.max(...all, 1)
    let minV = Math.min(...all, 0)
    let range = maxV - minV || 1

    let xScale = (yr: number) =>
      pad + ((yr - START_YEAR) / (END_YEAR - START_YEAR)) * (width - pad * 2)
    let yScale = (v: number) => height - pad - ((v - minV) / range) * (height - pad * 2)
    let mkPath = (pts: { y: number; v: number }[]) =>
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.y).toFixed(1)} ${yScale(p.v).toFixed(1)}`).join(' ')

    return (
      <div mix={chartWrapStyle}>
        <div mix={chartLegendStyle}>
          <span>
            <span mix={legendAccentStyle} /> Your cumulative profit
          </span>
          {compLines.map((c, i) => (
            <span key={`cl-${i}`}>
              <span mix={legendInkThinStyle} /> {c.strategy.name}
            </span>
          ))}
          <span mix={chartAxisLabelStyle}>$M nominal</span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} mix={chartSvgStyle} role="img" aria-label="Cumulative profit vs. competitor strategies">
          <title>Cumulative profit, {START_YEAR}–{END_YEAR}</title>
          <line
            x1={pad}
            y1={yScale(0)}
            x2={width - pad}
            y2={yScale(0)}
            stroke={T.ink}
            stroke-width="0.6"
            opacity="0.5"
          />
          {compLines.map((c, i) => (
            <path
              key={`pc-${i}`}
              d={mkPath(c.points)}
              stroke={T.ink}
              stroke-width="0.8"
              opacity="0.45"
              fill="none"
            />
          ))}
          {mine.length > 0 && (
            <path d={mkPath(mine)} stroke={T.accent} stroke-width="1.8" fill="none" />
          )}
          <text x={width - pad} y={pad - 4} font-size="9" text-anchor="end" font-family="IBM Plex Mono" fill={T.ink} opacity="0.6">
            ${(maxV / 1e6).toFixed(1)}M
          </text>
          <text x={width - pad} y={height - pad + 12} font-size="9" text-anchor="end" font-family="IBM Plex Mono" fill={T.ink} opacity="0.6">
            ${(minV / 1e6).toFixed(1)}M
          </text>
        </svg>
      </div>
    )
  }
}

function ProcessCard(
  handle: Handle<{
    process: (typeof PROCESSES)[number]
    year: number
    active: boolean
    onAdopt: () => void
  }>,
) {
  return () => {
    let { process, year, active, onAdopt } = handle.props
    let unlocked = process.availableFrom <= year
    let teething = unlocked && year - process.availableFrom < process.teethingYears
    return (
      <button
        type="button"
        disabled={!unlocked || active}
        mix={[
          processCardStyle,
          active ? processCardActiveStyle : null,
          !unlocked ? processCardLockedStyle : null,
          unlocked && !active ? on('click', onAdopt) : null,
        ]}
      >
        <div mix={processCardHeadStyle}>
          <span mix={processCardNameStyle}>{process.shortName}</span>
          <span mix={processCardYearStyle}>
            {unlocked ? (active ? 'IN USE' : teething ? 'TEETHING' : 'READY') : process.availableFrom}
          </span>
        </div>
        <div mix={processCardStatsStyle}>
          ${process.midLifeCostUsdPerTon}/t mid · {process.oreCompat.highP ? 'any ore' : 'low-P only'}
        </div>
      </button>
    )
  }
}

function MetricColumn(
  handle: Handle<{
    title: string
    report: YearReport | undefined
    accent?: boolean
    cumulative?: boolean
  }>,
) {
  return () => {
    let { title, report, accent, cumulative } = handle.props
    if (!report) {
      return (
        <div mix={accent ? metricColAccentStyle : metricColStyle}>
          <div mix={metricColTitleStyle}>{title}</div>
          <Readout k="—" v="—" />
        </div>
      )
    }
    return (
      <div mix={accent ? metricColAccentStyle : metricColStyle}>
        <div mix={metricColTitleStyle}>{title}</div>
        {cumulative ? (
          <>
            <Readout k="Cumulative profit" v={fmtUsd(report.cumulativeProfit)} accent />
            <Readout k="Cash on hand" v={fmtUsd(report.cash)} />
            <Readout k="Bankrupt" v={report.bankrupt ? 'YES' : 'no'} />
          </>
        ) : (
          <>
            <Readout k="Process" v={getProcess(report.process).shortName} accent={accent} />
            <Readout k="Production" v={`${(report.production / 1000).toFixed(0)}k tons`} />
            <Readout k="Cost / ton" v={`$${report.costPerTon.toFixed(0)}`} />
            <Readout k="Price / ton" v={`$${report.marketPricePerTon.toFixed(0)}`} />
            <Readout k="Defect rate" v={`${(report.defectRate * 100).toFixed(1)}%`} />
            <Readout k="Profit" v={fmtUsd(report.profit)} />
          </>
        )}
      </div>
    )
  }
}

function fmtUsd(n: number): string {
  let abs = Math.abs(n)
  let sign = n < 0 ? '-' : ''
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}k`
  return `${sign}$${abs.toFixed(0)}`
}

function SpeedButton(handle: Handle<{ speed: number; active: boolean; onClick: () => void }>) {
  return () => {
    let { speed, active, onClick } = handle.props
    return (
      <button
        type="button"
        aria-pressed={active ? 'true' : 'false'}
        mix={[active ? speedButtonActiveStyle : speedButtonStyle, on('click', onClick)]}
      >
        {speed}y/s
      </button>
    )
  }
}

function ProfileButton(
  handle: Handle<{ label: string; hint: string; active: boolean; onClick: () => void }>,
) {
  return () => {
    let { label, hint, active, onClick } = handle.props
    return (
      <button
        type="button"
        aria-pressed={active ? 'true' : 'false'}
        mix={[active ? profileButtonActiveStyle : profileButtonStyle, on('click', onClick)]}
      >
        <span mix={profileLabelStyle}>{label}</span>
        <span mix={profileHintStyle}>{hint}</span>
      </button>
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
  '@media (max-width: 1100px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
})

const mainColumnStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
  minWidth: 0,
})

const asideStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  position: 'sticky',
  top: '96px',
  '@media (max-width: 1100px)': { position: 'static', top: 'auto' },
})

const tickerWrapStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
})

const tickerYearStyle = css({
  fontSize: '64px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  color: T.accent,
  lineHeight: 1,
})

const tickerMetaStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '10px',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  opacity: 0.7,
})

const tickerStateStyle = css({ fontWeight: 700 })
const tickerSpanStyle = css({})

const tickerEventsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  fontSize: '10px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginTop: '4px',
})

const tickerEventStyle = css({
  border: `1px solid ${T.ink}`,
  padding: '3px 8px',
  background: T.panelStrong,
  fontWeight: 700,
})

const tickerEventEmptyStyle = css({ opacity: 0.5 })

const yearSliderStyle = css({
  width: '100%',
  marginTop: '12px',
  cursor: 'ew-resize',
})

const diagramWrapStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
})

const diagramSvgStyle = css({ width: '100%', height: 'auto', display: 'block' })

const diagramCaptionStyle = css({
  fontSize: '11px',
  lineHeight: 1.5,
  opacity: 0.8,
})

const oreWarnStyle = css({
  marginTop: '8px',
  border: `2px solid ${T.accent}`,
  padding: '10px 12px',
  background: T.accentSoft,
  fontSize: '11px',
  lineHeight: 1.5,
  fontWeight: 700,
  letterSpacing: '0.04em',
})

const chartWrapStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
})

const chartLegendStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '14px',
  fontSize: '10px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  opacity: 0.85,
})

const chartAxisLabelStyle = css({
  marginLeft: 'auto',
  opacity: 0.6,
})

const legendSwatchBase = {
  display: 'inline-block',
  width: '14px',
  height: '2px',
  marginRight: '5px',
  verticalAlign: 'middle',
} as const

const legendAccentStyle = css({ ...legendSwatchBase, background: T.accent })
const legendInkStyle = css({ ...legendSwatchBase, background: T.ink, opacity: 0.45 })
const legendInkThinStyle = css({ ...legendSwatchBase, background: T.ink, opacity: 0.6 })
const legendDashedStyle = css({
  ...legendSwatchBase,
  background: 'transparent',
  borderTop: `2px dashed ${T.ink}`,
  height: '0px',
  marginTop: '6px',
})

const chartSvgStyle = css({
  display: 'block',
  width: '100%',
  height: 'auto',
})

const metricsGridStyle = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
  '@media (max-width: 720px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
})

const metricColBase = {
  border: `1px solid ${T.ink}`,
  padding: '14px',
  background: T.panel,
} as const

const metricColStyle = css({ ...metricColBase })

const metricColAccentStyle = css({
  ...metricColBase,
  borderColor: T.accent,
  borderWidth: '2px',
})

const metricColTitleStyle = css({
  fontSize: '10px',
  letterSpacing: '0.14em',
  fontWeight: 700,
  textTransform: 'uppercase',
  marginBottom: '8px',
  opacity: 0.8,
})

const twoButtonRowStyle = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '6px',
})

const speedGroupStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  marginTop: '8px',
  marginBottom: '12px',
  border: `1px solid ${T.ink}`,
})

const speedBaseStyle = {
  appearance: 'none',
  fontFamily: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
  cursor: 'pointer',
  padding: '6px 4px',
  border: 0,
  borderRight: `1px solid ${T.ink}`,
  fontSize: '10px',
  letterSpacing: '0.08em',
  fontWeight: 700,
  transition: 'background-color 120ms ease',
  '&:last-child': { borderRight: 0 },
} as const

const speedButtonStyle = css({
  ...speedBaseStyle,
  background: 'transparent',
  color: T.ink,
  '&:hover': { background: T.panelStrong },
})

const speedButtonActiveStyle = css({
  ...speedBaseStyle,
  background: T.ink,
  color: T.paper,
})

const profileGroupStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
})

const profileBaseStyle = {
  appearance: 'none',
  fontFamily: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
  cursor: 'pointer',
  padding: '8px 10px',
  border: `1px solid ${T.ink}`,
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  transition: 'background-color 120ms ease',
} as const

const profileButtonStyle = css({
  ...profileBaseStyle,
  background: 'transparent',
  color: T.ink,
  '&:hover': { background: T.panelStrong },
})

const profileButtonActiveStyle = css({
  ...profileBaseStyle,
  background: T.ink,
  color: T.paper,
})

const profileLabelStyle = css({
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
})

const profileHintStyle = css({
  fontSize: '10px',
  opacity: 0.7,
})

const processGridStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
})

const processCardStyle = css({
  ...profileBaseStyle,
  background: 'transparent',
  color: T.ink,
  '&:hover:not(:disabled)': { background: T.panelStrong },
  '&:disabled': { cursor: 'not-allowed' },
})

const processCardActiveStyle = css({
  background: T.accent,
  color: T.paper,
  borderColor: T.accent,
})

const processCardLockedStyle = css({
  opacity: 0.4,
  borderStyle: 'dashed',
})

const processCardHeadStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: '8px',
})

const processCardNameStyle = css({
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
})

const processCardYearStyle = css({
  fontSize: '9px',
  letterSpacing: '0.14em',
  opacity: 0.85,
  fontWeight: 700,
})

const processCardStatsStyle = css({
  fontSize: '10px',
  opacity: 0.8,
})

const noteStyle = css({
  fontSize: '11px',
  lineHeight: 1.55,
})
