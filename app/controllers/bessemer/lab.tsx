import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

import { DraftingButton, Panel, Readout, SheetHeader, T } from '../../ui/shell.tsx'
import { PriceChart, ProfitChart } from './charts.tsx'
import { MillDiagram } from './diagram.tsx'
import {
  COMPETITORS,
  Mill,
  PROCESSES,
  costPerTon,
  marketPriceForYear,
  runCompetitor,
  type MillConfig,
  type OreType,
  type Posture,
  type ProcessId,
  type Scale,
} from './mill.ts'

interface BessemerLabProps extends SerializableProps {}

const START_YEAR = 1850
const END_YEAR = 1910

const SPEED_OPTIONS = [1, 2, 4, 8] as const
type Speed = (typeof SPEED_OPTIONS)[number]

const ORE_OPTIONS: { id: OreType; label: string; hint: string }[] = [
  { id: 'low-p', label: 'Low-P', hint: 'Lake Superior, Bessemer-compatible' },
  { id: 'high-p', label: 'High-P', hint: 'Pennsylvania / Lorraine — needs basic process' },
  { id: 'mixed', label: 'Mixed', hint: 'Ore varies; partial penalty on acid Bessemer' },
]

const SCALE_OPTIONS: { id: Scale; label: string; hint: string }[] = [
  { id: 'small', label: 'Small', hint: '5k tons/yr — survives on specialty' },
  { id: 'regional', label: 'Regional', hint: '50k tons/yr — needs commodity demand' },
  { id: 'carnegie', label: 'Carnegie', hint: '500k tons/yr — eats every market' },
]

const POSTURE_OPTIONS: { id: Posture; label: string; hint: string }[] = [
  { id: 'conservative', label: 'Conservative', hint: 'Limited capex, slow scaling' },
  { id: 'aggressive', label: 'Aggressive', hint: 'Carnegie playbook: scrap-and-rebuild' },
]

const HISTORICAL_EVENTS: { year: number; label: string; note: string }[] = [
  { year: 1856, label: 'Bessemer patent', note: 'Acid converter unlocks. Teething period begins.' },
  { year: 1865, label: 'Open hearth', note: 'Siemens-Martin available. Higher quality, slower.' },
  { year: 1873, label: 'Panic of 1873', note: 'Demand stalls. Overcommitted mills are vulnerable.' },
  { year: 1879, label: 'Thomas-Gilchrist', note: 'Basic Bessemer unlocks high-P ores.' },
  { year: 1880, label: 'Basic open hearth', note: 'Best of both: tolerance + quality.' },
  { year: 1893, label: 'Rail boom peaks', note: 'Commodity prices pinned; volume mills dominate.' },
]

const DEFAULT_CONFIG: MillConfig = {
  startYear: START_YEAR,
  process: 'puddling',
  ore: 'low-p',
  scale: 'regional',
  posture: 'conservative',
  seed: 1,
}

function initialCashFor(scale: Scale): number {
  return scale === 'small' ? 50_000 : scale === 'regional' ? 300_000 : 3_000_000
}

function bankruptcyFor(scale: Scale): number {
  return scale === 'small' ? -50_000 : scale === 'regional' ? -250_000 : -2_500_000
}

export const BessemerLab = clientEntry(
  '/assets/app/controllers/bessemer/lab.tsx#BessemerLab',
  function BessemerLab(handle: Handle<BessemerLabProps>) {
    let config: MillConfig = { ...DEFAULT_CONFIG }
    let mill = new Mill(config)
    let competitorRuns = COMPETITORS.map((c) => ({
      name: c.name,
      history: runCompetitor(c, START_YEAR, END_YEAR, c.name.length),
    }))
    let speed: Speed = 2
    let paused = true
    let lastFrameTime: number | null = null
    let yearAccum = 0
    let pulse = 0

    if (typeof requestAnimationFrame !== 'undefined') {
      let frameId: number | null = null
      function tick(timestamp: number) {
        if (handle.signal.aborted) return
        if (lastFrameTime == null) {
          lastFrameTime = timestamp
        } else {
          let dtMs = Math.min(timestamp - lastFrameTime, 250)
          lastFrameTime = timestamp
          pulse = (pulse + dtMs / 1000) % 1
          if (!paused && mill.snapshot().year < END_YEAR && !mill.snapshot().bankrupt) {
            // 1 year per real second at 1×, then up.
            yearAccum += (dtMs / 1000) * speed
            while (yearAccum >= 1) {
              mill.tick()
              yearAccum -= 1
              if (mill.snapshot().year >= END_YEAR || mill.snapshot().bankrupt) {
                paused = true
                yearAccum = 0
                break
              }
            }
          }
          handle.update()
        }
        frameId = requestAnimationFrame(tick)
      }
      frameId = requestAnimationFrame(tick)
      handle.signal.addEventListener('abort', () => {
        if (frameId != null) cancelAnimationFrame(frameId)
      })
    }

    function reset() {
      mill = new Mill(config)
      yearAccum = 0
      paused = true
      handle.update()
    }

    function setOre(ore: OreType) {
      config = { ...config, ore }
      mill.setOre(ore)
      handle.update()
    }

    function setScale(scale: Scale) {
      config = { ...config, scale }
      mill = new Mill(config)
      yearAccum = 0
      paused = true
      handle.update()
    }

    function setPosture(posture: Posture) {
      config = { ...config, posture }
      mill = new Mill(config)
      yearAccum = 0
      paused = true
      handle.update()
    }

    function adopt(id: ProcessId) {
      let snap = mill.snapshot()
      let spec = PROCESSES.find((p) => p.id === id)!
      if (snap.year < spec.availableYear) return
      if (snap.bankrupt) return
      mill.adoptProcess(id)
      handle.update()
    }

    function togglePause() {
      let snap = mill.snapshot()
      if (snap.year >= END_YEAR || snap.bankrupt) return
      paused = !paused
      lastFrameTime = null
      handle.update()
    }

    function setSpeed(s: Speed) {
      speed = s
      handle.update()
    }

    return () => {
      let snap = mill.snapshot()
      let last = snap.history[snap.history.length - 1]
      let cumProfit = snap.cash - initialCashFor(snap.scale)
      let bankruptcy = bankruptcyFor(snap.scale)

      return (
        <article mix={pageStyle}>
          <SheetHeader
            fig="Fig. 5.0 — Bessemer cost collapse"
            title="Bessemer Cost Collapse"
            subtitle="Run a steel mill from 1850 to 1910. Each new process arrives with a capex bill, a teething period, and an ore constraint. Adopt early and bet the company on a furnace that hasn't worked at scale yet. Adopt late and your competitors eat the rail market. The lab makes the timing decision the lesson."
          />

          <YearTickerStrip
            year={snap.year}
            paused={paused}
            bankrupt={snap.bankrupt}
            speed={speed}
            onTogglePause={togglePause}
            onReset={reset}
            onSpeed={setSpeed}
          />

          <div mix={twoColStyle}>
            <div mix={mainColumnStyle}>
              <Panel label="Fig. 5.1 — Mill, live" padding={20}>
                <div mix={diagramHeaderStyle}>
                  <span mix={diagramHeaderLabelStyle}>
                    {PROCESSES.find((p) => p.id === snap.process)!.name.toUpperCase()}
                  </span>
                  <span mix={diagramHeaderHintStyle}>
                    {snap.retoolingYearsLeft > 0
                      ? `Retooling · ${snap.retoolingYearsLeft} yr`
                      : `Year ${snap.yearsSinceAdoption} since adoption`}
                  </span>
                </div>
                <MillDiagram
                  process={snap.process}
                  retooling={snap.retoolingYearsLeft > 0}
                  oreMismatch={last?.oreMismatch ?? false}
                  pulse={pulse}
                />
              </Panel>

              <Panel label="Fig. 5.2 — Steel price · market vs. your cost" padding={16}>
                <PriceChart
                  history={snap.history}
                  startYear={START_YEAR}
                  endYear={END_YEAR}
                />
                <div mix={priceFootStyle}>
                  Market price falls from $175/ton in 1850 to ≈ $32/ton by 1898 — an 80% real-terms
                  collapse. Your cost has to descend with it.
                </div>
              </Panel>

              <Panel label="Fig. 5.3 — Cumulative cash" padding={16}>
                <ProfitChart
                  history={snap.history}
                  competitors={competitorRuns}
                  startYear={START_YEAR}
                  endYear={END_YEAR}
                  bankruptcyThreshold={bankruptcy}
                  initialCash={initialCashFor(snap.scale)}
                />
              </Panel>

              <Panel label="Fig. 5.4 — Process catalog" padding={16}>
                <div mix={processGridStyle}>
                  {PROCESSES.map((p) => (
                    <ProcessCard
                      key={`pc-${p.id}`}
                      process={p}
                      year={snap.year}
                      ore={snap.ore}
                      active={snap.process === p.id}
                      onAdopt={() => adopt(p.id)}
                    />
                  ))}
                </div>
              </Panel>
            </div>

            <aside mix={asideStyle}>
              <Panel label="Live readout" padding={16}>
                <Readout k="Year" v={String(snap.year)} accent />
                <Readout
                  k="Process"
                  v={PROCESSES.find((p) => p.id === snap.process)!.shortName}
                />
                <Readout
                  k="Cost / ton"
                  v={last ? `$${last.costPerTon.toFixed(0)}` : '—'}
                />
                <Readout
                  k="Market / ton"
                  v={`$${marketPriceForYear(snap.year).toFixed(0)}`}
                />
                <Readout
                  k="Margin / ton"
                  v={
                    last
                      ? `$${(last.marketPrice - last.costPerTon).toFixed(0)}`
                      : '—'
                  }
                  accent
                />
                <Readout
                  k="Defect rate"
                  v={last ? `${(last.defectRate * 100).toFixed(1)}%` : '—'}
                />
                <Readout
                  k="Production"
                  v={last ? `${Math.round(last.production / 1000)}k t/yr` : '—'}
                />
                <Readout
                  k="Cash"
                  v={`$${Math.round(snap.cash).toLocaleString()}`}
                  accent={snap.cash < 0}
                />
                <Readout
                  k="Cumulative profit"
                  v={`$${Math.round(cumProfit).toLocaleString()}`}
                />
                <Readout k="State" v={snap.bankrupt ? 'BANKRUPT' : paused ? 'Paused' : 'Running'} />
              </Panel>

              <Panel label="Ore source" padding={16}>
                <div mix={profileGroupStyle}>
                  {ORE_OPTIONS.map((opt) => (
                    <PillButton
                      key={`ore-${opt.id}`}
                      label={opt.label}
                      hint={opt.hint}
                      active={snap.ore === opt.id}
                      onClick={() => setOre(opt.id)}
                    />
                  ))}
                </div>
              </Panel>

              <Panel label="Mill scale" padding={16}>
                <div mix={profileGroupStyle}>
                  {SCALE_OPTIONS.map((opt) => (
                    <PillButton
                      key={`sc-${opt.id}`}
                      label={opt.label}
                      hint={opt.hint}
                      active={snap.scale === opt.id}
                      onClick={() => setScale(opt.id)}
                    />
                  ))}
                </div>
              </Panel>

              <Panel label="Capital posture" padding={16}>
                <div mix={profileGroupStyle}>
                  {POSTURE_OPTIONS.map((opt) => (
                    <PillButton
                      key={`po-${opt.id}`}
                      label={opt.label}
                      hint={opt.hint}
                      active={snap.posture === opt.id}
                      onClick={() => setPosture(opt.id)}
                    />
                  ))}
                </div>
              </Panel>

              <Panel label="Historical events" padding={16}>
                {HISTORICAL_EVENTS.map((ev) => {
                  let fired = snap.year >= ev.year
                  return (
                    <div
                      key={`ev-${ev.year}`}
                      mix={[eventRowStyle, fired ? eventFiredStyle : null]}
                    >
                      <div mix={eventYearStyle}>{ev.year}</div>
                      <div>
                        <div mix={eventLabelStyle}>{ev.label}</div>
                        <div mix={eventNoteStyle}>{ev.note}</div>
                      </div>
                    </div>
                  )
                })}
              </Panel>

              <Panel label="Drafting note" padding={16}>
                <div mix={noteStyle}>
                  Steel rails fell from ≈ $170/ton in 1867 to ≈ $32 by 1898 — eighty per cent in
                  thirty years. Mills that stayed on puddling for the rail trade went bankrupt.
                  Mills that bet on Bessemer in the wrong year, or with the wrong ore, paid
                  tuition. The point of the lab is that the right answer depends on when, with
                  what ore, and at what scale.
                </div>
              </Panel>
            </aside>
          </div>
        </article>
      )
    }
  },
)

function YearTickerStrip(
  handle: Handle<{
    year: number
    paused: boolean
    bankrupt: boolean
    speed: Speed
    onTogglePause: () => void
    onReset: () => void
    onSpeed: (s: Speed) => void
  }>,
) {
  return () => {
    let { year, paused, bankrupt, speed, onTogglePause, onReset, onSpeed } = handle.props
    let pct = ((year - START_YEAR) / (END_YEAR - START_YEAR)) * 100
    return (
      <div mix={tickerStyle}>
        <div mix={tickerControlsStyle}>
          <DraftingButton primary onClick={onTogglePause} disabled={bankrupt}>
            {paused ? '▶ Run' : '‖ Pause'}
          </DraftingButton>
          <DraftingButton onClick={onReset}>↺ Reset</DraftingButton>
          <div mix={tickerSpeedRowStyle}>
            {SPEED_OPTIONS.map((s) => (
              <SpeedButton
                key={`spd-${s}`}
                speed={s}
                active={s === speed}
                onClick={() => onSpeed(s)}
              />
            ))}
          </div>
        </div>
        <div mix={tickerBarWrapStyle}>
          <div mix={tickerBarTrackStyle}>
            <div mix={tickerBarFillStyle} style={{ width: `${pct}%` }} />
            {HISTORICAL_EVENTS.map((ev) => {
              let p = ((ev.year - START_YEAR) / (END_YEAR - START_YEAR)) * 100
              return (
                <div key={`tk-${ev.year}`} mix={tickerNotchStyle} style={{ left: `${p}%` }}>
                  <span mix={tickerNotchLabelStyle}>{ev.year}</span>
                </div>
              )
            })}
          </div>
          <div mix={tickerYearLineStyle}>
            <span>{START_YEAR}</span>
            <span mix={tickerYearLiveStyle}>{year}</span>
            <span>{END_YEAR}</span>
          </div>
        </div>
      </div>
    )
  }
}

function ProcessCard(
  handle: Handle<{
    process: (typeof PROCESSES)[number]
    year: number
    ore: OreType
    active: boolean
    onAdopt: () => void
  }>,
) {
  return () => {
    let { process: p, year, ore, active, onAdopt } = handle.props
    let locked = year < p.availableYear
    let oreWarn =
      p.oreConstraint === 'low-p' && (ore === 'high-p' || ore === 'mixed')
    let cost0 = costPerTon(p.id, 0)
    let costMid = costPerTon(p.id, p.teethingYears + 4)

    return (
      <div mix={[processCardStyle, active ? processCardActiveStyle : null, locked ? processCardLockedStyle : null]}>
        <div mix={processCardHeadStyle}>
          <div>
            <div mix={processCardNameStyle}>{p.name}</div>
            <div mix={processCardYearStyle}>
              {locked ? `Locks until ${p.availableYear}` : `Available · ${p.availableYear}`}
            </div>
          </div>
          {active ? (
            <span mix={processBadgeActiveStyle}>ACTIVE</span>
          ) : locked ? (
            <span mix={processBadgeLockedStyle}>LOCKED</span>
          ) : (
            <button type="button" mix={[processAdoptButtonStyle, on('click', onAdopt)]}>
              ADOPT
            </button>
          )}
        </div>
        <div mix={processCardBodyStyle}>
          <Readout
            k="Mid cost"
            v={`$${costMid.toFixed(0)}/ton`}
          />
          <Readout
            k="Teething"
            v={p.teethingYears > 0 ? `${p.teethingYears} yr · $${cost0.toFixed(0)} y0` : '—'}
          />
          <Readout
            k="Throughput"
            v={`${(p.throughput / 1000).toFixed(0)}k t @ regional`}
          />
          <Readout
            k="Ore"
            v={
              p.oreConstraint === 'low-p'
                ? 'low-P only'
                : p.oreConstraint === 'high-p-ok'
                ? 'high-P ok'
                : 'any'
            }
          />
        </div>
        <div mix={processCardDescStyle}>{p.description}</div>
        {oreWarn && !locked && (
          <div mix={oreWarnStyle}>
            ⚠ Acid lining hates {ore === 'mixed' ? 'mixed' : 'high-P'} ore — defects spike.
          </div>
        )}
      </div>
    )
  }
}

function PillButton(
  handle: Handle<{ label: string; hint: string; active: boolean; onClick: () => void }>,
) {
  return () => {
    let { label, hint, active, onClick } = handle.props
    return (
      <button
        type="button"
        mix={[active ? pillActiveStyle : pillStyle, on('click', onClick)]}
      >
        <span mix={pillLabelStyle}>{label}</span>
        <span mix={pillHintStyle}>{hint}</span>
      </button>
    )
  }
}

function SpeedButton(handle: Handle<{ speed: Speed; active: boolean; onClick: () => void }>) {
  return () => {
    let { speed, active, onClick } = handle.props
    return (
      <button
        type="button"
        mix={[active ? speedButtonActiveStyle : speedButtonStyle, on('click', onClick)]}
      >
        {speed}×
      </button>
    )
  }
}

const pageStyle = css({
  fontFamily: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
  color: T.ink,
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
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

const tickerStyle = css({
  border: `1px solid ${T.ink}`,
  background: T.panel,
  padding: '14px 16px',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, auto) 1fr',
  gap: '20px',
  alignItems: 'center',
  '@media (max-width: 760px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
})

const tickerControlsStyle = css({
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  flexWrap: 'wrap',
})

const tickerSpeedRowStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 36px)',
  border: `1px solid ${T.ink}`,
})

const tickerBarWrapStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  minWidth: 0,
})

const tickerBarTrackStyle = css({
  position: 'relative',
  height: '14px',
  border: `1px solid ${T.ink}`,
  background: 'transparent',
})

const tickerBarFillStyle = css({
  position: 'absolute',
  inset: 0,
  background: T.accentSoft,
  pointerEvents: 'none',
})

const tickerNotchStyle = css({
  position: 'absolute',
  top: '-2px',
  bottom: '-2px',
  width: '1px',
  background: T.ink,
})

const tickerNotchLabelStyle = css({
  position: 'absolute',
  top: '-16px',
  left: '-14px',
  fontSize: '8px',
  letterSpacing: '0.1em',
  color: T.ink,
  opacity: 0.55,
})

const tickerYearLineStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '10px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  opacity: 0.7,
})

const tickerYearLiveStyle = css({
  color: T.accent,
  fontWeight: 700,
})

const diagramHeaderStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '8px',
  fontSize: '10px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
})

const diagramHeaderLabelStyle = css({ fontWeight: 700 })
const diagramHeaderHintStyle = css({ opacity: 0.65 })

const priceFootStyle = css({
  marginTop: '8px',
  fontSize: '11px',
  lineHeight: 1.5,
  opacity: 0.75,
})

const processGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: '12px',
})

const processCardStyle = css({
  border: `1px solid ${T.ink}`,
  padding: '12px',
  background: T.panel,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
})

const processCardActiveStyle = css({
  borderColor: T.accent,
  borderWidth: '2px',
  background: T.accentSoft,
})

const processCardLockedStyle = css({
  opacity: 0.55,
})

const processCardHeadStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '8px',
})

const processCardNameStyle = css({
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
})

const processCardYearStyle = css({
  fontSize: '10px',
  opacity: 0.65,
  marginTop: '2px',
  letterSpacing: '0.06em',
})

const processCardBodyStyle = css({
  display: 'block',
})

const processCardDescStyle = css({
  fontSize: '10px',
  opacity: 0.7,
  lineHeight: 1.5,
})

const processBadgeActiveStyle = css({
  background: T.accent,
  color: T.paper,
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.16em',
  padding: '4px 6px',
})

const processBadgeLockedStyle = css({
  border: `1px solid ${T.ink}`,
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.16em',
  padding: '4px 6px',
  opacity: 0.7,
})

const processAdoptButtonStyle = css({
  appearance: 'none',
  fontFamily: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
  cursor: 'pointer',
  padding: '4px 8px',
  background: T.ink,
  color: T.paper,
  border: 0,
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.16em',
  transition: 'background-color 120ms ease',
  '&:hover': { background: T.inkSoft },
})

const oreWarnStyle = css({
  border: `1px solid ${T.accent}`,
  background: T.accentSoft,
  padding: '6px 8px',
  fontSize: '10px',
  color: T.accent,
  fontWeight: 700,
  letterSpacing: '0.04em',
})

const profileGroupStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  marginTop: '4px',
})

const pillBaseStyle = {
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

const pillStyle = css({
  ...pillBaseStyle,
  background: 'transparent',
  color: T.ink,
  '&:hover': { background: T.panelStrong },
})

const pillActiveStyle = css({
  ...pillBaseStyle,
  background: T.ink,
  color: T.paper,
})

const pillLabelStyle = css({
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
})

const pillHintStyle = css({
  fontSize: '10px',
  opacity: 0.7,
})

const speedBaseStyle = {
  appearance: 'none',
  fontFamily: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
  cursor: 'pointer',
  padding: '6px 4px',
  border: 0,
  borderRight: `1px solid ${T.ink}`,
  fontSize: '11px',
  letterSpacing: '0.1em',
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

const eventRowStyle = css({
  display: 'grid',
  gridTemplateColumns: '50px 1fr',
  gap: '8px',
  padding: '6px 0',
  borderTop: `1px dashed ${T.ink}`,
  opacity: 0.5,
  '&:first-child': { borderTop: 'none' },
})

const eventFiredStyle = css({
  opacity: 1,
})

const eventYearStyle = css({
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: T.accent,
})

const eventLabelStyle = css({
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.04em',
})

const eventNoteStyle = css({
  fontSize: '10px',
  opacity: 0.7,
  marginTop: '2px',
  lineHeight: 1.4,
})

const noteStyle = css({
  fontSize: '11px',
  lineHeight: 1.55,
})
