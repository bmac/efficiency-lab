import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

import { DraftingButton, Panel, Readout, SheetHeader, T } from '../../ui/shell.tsx'
import {
  COMPETITORS,
  PROCESSES,
  SCALE_COST_MULTIPLIER,
  SteelMill,
  adoptionCapexUsd,
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

const SPEED_OPTIONS = [1, 2, 5] as const
type Speed = (typeof SPEED_OPTIONS)[number]

const DEFAULT_ORE: OreType = 'low-p'
const DEFAULT_SCALE: Scale = 'regional'
const DEFAULT_POSTURE: Posture = 'conservative'

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

type PendingDecision =
  | { kind: 'unlock'; year: number; processId: ProcessId; deferred?: boolean }
  | { kind: 'panic'; year: number }
  | { kind: 'mismatch'; year: number; processId: ProcessId }
  | { kind: 'bankrupt'; year: number }

interface DeferredCheckIn {
  year: number
  processId: ProcessId
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
      ore: DEFAULT_ORE,
      scale: DEFAULT_SCALE,
      posture: DEFAULT_POSTURE,
      seed: 1,
    }
    let switches: ScheduledSwitch[] = []
    let targetYear = START_YEAR
    let paused = false
    let speed: Speed = 1
    let lastFrame: number | null = null
    let competitors = runCompetitors()
    let simCache: { key: string; full: YearReport[] } | null = null
    let lastAutoPauseYear = START_YEAR - 1
    let pendingDecision: PendingDecision | null = null
    let deferred: DeferredCheckIn[] = []

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
          let prevFloor = Math.floor(targetYear)
          let next = Math.min(END_YEAR, targetYear + dt * speed)
          let nextFloor = Math.floor(next)
          if (nextFloor !== prevFloor) {
            targetYear = next
            let decision = checkAutoPause(prevFloor, nextFloor)
            if (decision && nextFloor !== lastAutoPauseYear) {
              paused = true
              pendingDecision = decision
              lastAutoPauseYear = nextFloor
              lastFrame = null
            }
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

    function checkAutoPause(prevYear: number, newYear: number): PendingDecision | null {
      for (let d of deferred) {
        if (d.year > prevYear && d.year <= newYear) {
          let alreadyAdopted = switches.some(
            (s) => s.process === d.processId && s.year <= newYear,
          )
          let activeNow = switches.length > 0 && switches[switches.length - 1].process === d.processId
          if (!alreadyAdopted && !activeNow) {
            return { kind: 'unlock', year: d.year, processId: d.processId, deferred: true }
          }
        }
      }
      for (let p of PROCESSES) {
        if (p.availableFrom > prevYear && p.availableFrom <= newYear) {
          return { kind: 'unlock', year: p.availableFrom, processId: p.id }
        }
      }
      let full = simHistory()
      for (let y = prevYear + 1; y <= newYear; y++) {
        let rep = full.find((h) => h.year === y)
        if (!rep) continue
        if (rep.events.includes('bankrupt')) return { kind: 'bankrupt', year: y }
        if (rep.events.includes('panic-1873')) return { kind: 'panic', year: y }
        let prev = full.find((h) => h.year === y - 1)
        if (rep.oreMismatch && !(prev?.oreMismatch ?? false)) {
          return { kind: 'mismatch', year: y, processId: rep.process }
        }
      }
      return null
    }

    function decisionLabel(d: PendingDecision): string {
      switch (d.kind) {
        case 'unlock':
          return d.deferred
            ? `Revisit · ${getProcess(d.processId).shortName} (deferred)`
            : `${getProcess(d.processId).shortName} unlocked · ${d.year}`
        case 'panic':
          return `Panic of 1873 · cash haircut`
        case 'mismatch':
          return `Ore mismatch · ${getProcess(d.processId).shortName} defects spiking`
        case 'bankrupt':
          return `Mill bankrupt · ${d.year}`
      }
    }

    function reset() {
      switches = []
      targetYear = START_YEAR
      paused = false
      lastFrame = null
      lastAutoPauseYear = START_YEAR - 1
      pendingDecision = null
      deferred = []
      handle.update()
    }

    function togglePause() {
      paused = !paused
      lastFrame = null
      if (!paused) pendingDecision = null
      handle.update()
    }

    function setSpeed(s: Speed) {
      speed = s
      handle.update()
    }

    function adoptProcess(id: ProcessId) {
      let year = Math.max(START_YEAR, Math.ceil(targetYear))
      let spec = getProcess(id)
      if (spec.availableFrom > year) return
      switches = switches.filter((s) => s.year < year)
      switches.push({ year, process: id })
      handle.update()
    }

    function adoptFromModal(id: ProcessId) {
      adoptProcess(id)
      pendingDecision = null
      paused = false
      lastFrame = null
      handle.update()
    }

    function deferDecision(years: number) {
      let current = pendingDecision
      if (current?.kind === 'unlock') {
        let from = Math.floor(targetYear)
        let target = Math.min(END_YEAR, from + years)
        deferred = [
          ...deferred.filter((d) => d.processId !== current.processId),
          { year: target, processId: current.processId },
        ]
      }
      pendingDecision = null
      paused = false
      lastFrame = null
      handle.update()
    }

    function dismissDecision() {
      pendingDecision = null
      paused = false
      lastFrame = null
      handle.update()
    }

    function setTargetYear(y: number) {
      targetYear = Math.max(START_YEAR, Math.min(END_YEAR, y))
      switches = switches.filter((s) => s.year <= Math.floor(targetYear))
      lastFrame = null
      lastAutoPauseYear = Math.floor(targetYear)
      pendingDecision = null
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
      let costNow = lastReport?.costPerTon ?? 0
      let pricePerTonNow = lastReport?.pricePerTon ?? priceNow * 0.7
      let marginNow = pricePerTonNow - costNow
      let adoptionCapex = adoptionCapexUsd(config.scale, config.posture)
      let gameOver = displayYear >= END_YEAR

      let modalDecision = paused && pendingDecision ? pendingDecision : null
      let scaleMultiplierNow = SCALE_COST_MULTIPLIER[config.scale]

      return (
        <article mix={pageStyle}>
          {modalDecision && (
            <EventModal
              decision={modalDecision}
              currentProcess={activeProcess}
              costNow={costNow}
              marketPrice={priceNow}
              pricePerTon={pricePerTonNow}
              capex={adoptionCapex}
              scaleMultiplier={scaleMultiplierNow}
              onAdopt={adoptFromModal}
              onDefer={() => deferDecision(5)}
              onDismiss={dismissDecision}
            />
          )}
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
                  reason={pendingDecision ? decisionLabel(pendingDecision) : null}
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

              {paused && !gameOver && (
                <Panel label="Decision · pause snapshot" padding={16}>
                  <DecisionSnapshot
                    year={displayYear}
                    activeProcess={activeProcess}
                    costNow={costNow}
                    pricePerTonNow={pricePerTonNow}
                    marketPriceNow={priceNow}
                    marginNow={marginNow}
                    capex={adoptionCapex}
                  />
                </Panel>
              )}

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
                <Readout k="Your cost/ton" v={`$${costNow.toFixed(0)}/ton`} />
                <Readout
                  k="Margin/ton"
                  v={`${marginNow >= 0 ? '' : '−'}$${Math.abs(marginNow).toFixed(0)}`}
                />
                <Readout
                  k="Industry demand"
                  v={`${(demandNow / 1000).toFixed(0)}k tons`}
                />
              </Panel>

              <Panel label="Process panel" padding={16}>
                <div mix={processGridStyle}>
                  {PROCESSES.filter((p) => p.availableFrom <= displayYear).map((p) => (
                    <ProcessCard
                      key={`p-${p.id}`}
                      process={p}
                      year={displayYear}
                      active={activeProcess === p.id}
                      costNow={costNow}
                      capex={adoptionCapex}
                      scaleMultiplier={scaleMultiplierNow}
                      onAdopt={() => adoptProcess(p.id)}
                    />
                  ))}
                </div>
                <ComingUp year={displayYear} />
              </Panel>
            </aside>
          </div>

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

          {gameOver && (
            <Retrospective
              playerHistory={fullHistory}
              playerSwitches={switches}
              competitors={competitors}
            />
          )}
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
    reason: string | null
  }>,
) {
  return () => {
    let { year, paused, bankrupt, events, reason } = handle.props
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
        {paused && reason && (
          <div mix={tickerReasonStyle}>↻ Auto-pause · {reason}</div>
        )}
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

function DecisionSnapshot(
  handle: Handle<{
    year: number
    activeProcess: ProcessId
    costNow: number
    pricePerTonNow: number
    marketPriceNow: number
    marginNow: number
    capex: number
  }>,
) {
  return () => {
    let { year, activeProcess, costNow, pricePerTonNow, marketPriceNow, marginNow, capex } =
      handle.props
    let active = getProcess(activeProcess)
    let unlocked = PROCESSES.filter((p) => p.availableFrom <= year && p.id !== activeProcess)
    return (
      <div mix={decisionWrapStyle}>
        <div mix={decisionHeadStyle}>
          Year {year} · Running on <strong>{active.shortName}</strong>
        </div>
        <div mix={decisionGridStyle}>
          <DecisionStat label="Your cost/ton" value={`$${costNow.toFixed(0)}`} />
          <DecisionStat label="Market price" value={`$${marketPriceNow.toFixed(0)}`} />
          <DecisionStat
            label="Margin/ton"
            value={`${marginNow >= 0 ? '' : '−'}$${Math.abs(marginNow).toFixed(0)}`}
            accent={marginNow < 0}
          />
          <DecisionStat label="Capex to switch" value={fmtUsd(capex)} />
        </div>
        <div mix={decisionNoteStyle}>
          Switching costs <strong>{fmtUsd(capex)}</strong> in capex (amortized over 10 years).
          New processes start <strong>teething</strong> — 75% higher costs and ~5× defects
          until they settle. Pick one of the cards below to schedule the switch at this year,
          or hit ▶ Run to keep going.
        </div>
        {unlocked.length === 0 && (
          <div mix={decisionNoteStyle}>
            Nothing else is unlocked yet — let the clock advance.
          </div>
        )}
        <div mix={decisionPriceNoteStyle}>
          You capture <strong>${pricePerTonNow.toFixed(0)}/ton</strong> of the
          ${marketPriceNow.toFixed(0)} market price (70% capture rate after dealer cuts).
        </div>
      </div>
    )
  }
}

function DecisionStat(handle: Handle<{ label: string; value: string; accent?: boolean }>) {
  return () => {
    let { label, value, accent } = handle.props
    return (
      <div mix={accent ? decisionStatAccentStyle : decisionStatStyle}>
        <div mix={decisionStatLabelStyle}>{label}</div>
        <div mix={decisionStatValueStyle}>{value}</div>
      </div>
    )
  }
}

function EventModal(
  handle: Handle<{
    decision: PendingDecision
    currentProcess: ProcessId
    costNow: number
    marketPrice: number
    pricePerTon: number
    capex: number
    scaleMultiplier: number
    onAdopt: (id: ProcessId) => void
    onDefer: () => void
    onDismiss: () => void
  }>,
) {
  return () => {
    let {
      decision,
      currentProcess,
      costNow,
      marketPrice,
      pricePerTon,
      capex,
      scaleMultiplier,
      onAdopt,
      onDefer,
      onDismiss,
    } = handle.props
    return (
      <div mix={modalBackdropStyle}>
        <div mix={modalCardStyle} role="dialog" aria-modal="true">
          <div mix={modalTagStyle}>
            {decision.kind === 'unlock'
              ? decision.deferred
                ? 'Deferred check-in'
                : 'New process unlocked'
              : decision.kind === 'panic'
                ? 'Macro event'
                : decision.kind === 'mismatch'
                  ? 'Process failure'
                  : 'End of the line'}
          </div>
          {decision.kind === 'unlock' && (
            <UnlockBody
              decision={decision}
              currentProcess={currentProcess}
              costNow={costNow}
              capex={capex}
              scaleMultiplier={scaleMultiplier}
            />
          )}
          {decision.kind === 'panic' && (
            <PanicBody year={decision.year} costNow={costNow} marketPrice={marketPrice} />
          )}
          {decision.kind === 'mismatch' && (
            <MismatchBody decision={decision} currentProcess={currentProcess} />
          )}
          {decision.kind === 'bankrupt' && <BankruptBody year={decision.year} />}

          <div mix={modalActionsStyle}>
            {decision.kind === 'unlock' && (
              <>
                <DraftingButton primary onClick={() => onAdopt(decision.processId)}>
                  Adopt {getProcess(decision.processId).shortName} now
                </DraftingButton>
                <DraftingButton onClick={onDefer}>Defer 5 years</DraftingButton>
                <DraftingButton onClick={onDismiss}>Stay on {getProcess(currentProcess).shortName}</DraftingButton>
              </>
            )}
            {decision.kind === 'mismatch' && (
              <>
                <DraftingButton primary onClick={onDismiss}>
                  Continue running
                </DraftingButton>
                <DraftingButton onClick={onDefer}>Revisit in 5 years</DraftingButton>
              </>
            )}
            {decision.kind === 'panic' && (
              <DraftingButton primary onClick={onDismiss}>
                Acknowledge
              </DraftingButton>
            )}
            {decision.kind === 'bankrupt' && (
              <DraftingButton primary onClick={onDismiss}>
                Watch the rest play out
              </DraftingButton>
            )}
          </div>

          <div mix={modalFootnoteStyle}>
            You capture <strong>${pricePerTon.toFixed(0)}/ton</strong> of the
            ${marketPrice.toFixed(0)} market price right now · charter: regional mill (50k t/y),
            conservative capex.
          </div>
        </div>
      </div>
    )
  }
}

function UnlockBody(
  handle: Handle<{
    decision: { kind: 'unlock'; year: number; processId: ProcessId; deferred?: boolean }
    currentProcess: ProcessId
    costNow: number
    capex: number
    scaleMultiplier: number
  }>,
) {
  return () => {
    let { decision, currentProcess, costNow, capex, scaleMultiplier } = handle.props
    let spec = getProcess(decision.processId)
    let yearsSince = decision.year - spec.availableFrom
    let teething = spec.teethingYears > 0 && yearsSince < spec.teethingYears
    let teethingRemaining = teething ? spec.teethingYears - Math.max(0, yearsSince) : 0
    let midCost = spec.midLifeCostUsdPerTon * scaleMultiplier
    let initialCost = midCost * (teething ? 1.75 : 1)
    let delta = midCost - costNow
    return (
      <>
        <h2 mix={modalTitleStyle}>
          {decision.year} — {spec.name}
        </h2>
        <p mix={modalBlurbStyle}>
          {decision.deferred
            ? `You deferred this decision five years ago. The clock has reached ${decision.year} and ${spec.shortName} is still on the table.`
            : `${spec.shortName} just became commercially available. ${spec.description}`}
        </p>
        <div mix={modalStatsStyle}>
          <DecisionStat label="Capex to adopt" value={fmtUsd(capex)} />
          <DecisionStat
            label="Online in"
            value={teething ? `${teethingRemaining} yrs teething` : 'immediately'}
          />
          <DecisionStat
            label="Mid-life cost/ton"
            value={`$${midCost.toFixed(0)}`}
            accent={delta < 0}
          />
          <DecisionStat label="Your cost now" value={`$${costNow.toFixed(0)}`} />
        </div>
        {teething && (
          <p mix={modalWarnStyle}>
            ⚠ First year ~${initialCost.toFixed(0)}/t · defect rate ~5× until teething settles.
            Early adopters pay tuition; late adopters chase a moving curve.
          </p>
        )}
        {!spec.oreCompat.highP && (
          <p mix={modalBlurbStyle}>
            Requires low-phosphorus ore (which you have). High-P ore will not work in this
            process until Thomas-Gilchrist's basic lining arrives in 1879.
          </p>
        )}
        <p mix={modalBlurbStyle}>
          Compared to {getProcess(currentProcess).shortName} at ${costNow.toFixed(0)}/t,
          this is{' '}
          <strong>
            {delta >= 0 ? '+' : ''}${delta.toFixed(0)}/t {delta < 0 ? 'cheaper' : 'more expensive'}
          </strong>{' '}
          at mid-life.
        </p>
      </>
    )
  }
}

function PanicBody(
  handle: Handle<{ year: number; costNow: number; marketPrice: number }>,
) {
  return () => {
    let { year, costNow, marketPrice } = handle.props
    return (
      <>
        <h2 mix={modalTitleStyle}>{year} — Panic of 1873</h2>
        <p mix={modalBlurbStyle}>
          A continental credit panic just wiped 30% off your cash balance. Rail demand softens
          for the rest of the decade and the price of steel rails enters its long collapse. You
          are running at <strong>${costNow.toFixed(0)}/t</strong> against a market price of{' '}
          <strong>${marketPrice.toFixed(0)}/t</strong>.
        </p>
      </>
    )
  }
}

function MismatchBody(
  handle: Handle<{
    decision: { kind: 'mismatch'; year: number; processId: ProcessId }
    currentProcess: ProcessId
  }>,
) {
  return () => {
    let { decision, currentProcess } = handle.props
    let spec = getProcess(decision.processId)
    return (
      <>
        <h2 mix={modalTitleStyle}>
          {decision.year} — {spec.shortName} rejecting your ore
        </h2>
        <p mix={modalBlurbStyle}>
          {spec.shortName} is acid-lined and cannot tolerate phosphorus. Your defect rate
          spiked roughly tenfold and the penalty bill is gutting margin. Historically, this is
          exactly what killed Bessemer's first commercial run — until Thomas-Gilchrist's basic
          lining solved it in 1879.
        </p>
        {currentProcess === decision.processId && (
          <p mix={modalBlurbStyle}>
            Waiting for the basic process to unlock is one strategy. Switching back to
            something ore-tolerant is the other.
          </p>
        )}
      </>
    )
  }
}

function BankruptBody(handle: Handle<{ year: number }>) {
  return () => {
    let { year } = handle.props
    return (
      <>
        <h2 mix={modalTitleStyle}>{year} — Mill bankrupt</h2>
        <p mix={modalBlurbStyle}>
          Cash on hand went negative. Production has stopped and the ledger is frozen for the
          rest of the run. Hit reset to try a different sequence.
        </p>
      </>
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
    costNow: number
    capex: number
    scaleMultiplier: number
    onAdopt: () => void
  }>,
) {
  return () => {
    let { process, year, active, costNow, capex, scaleMultiplier, onAdopt } = handle.props
    let unlocked = process.availableFrom <= year
    let yearsSince = year - process.availableFrom
    let teethingRemaining =
      unlocked && process.teethingYears > 0
        ? Math.max(0, process.teethingYears - Math.max(0, yearsSince))
        : 0
    let teething = unlocked && yearsSince < process.teethingYears
    let midCost = process.midLifeCostUsdPerTon * scaleMultiplier
    let initialCost = midCost * (1 + 0.75 * (teething ? 1 : 0))
    let delta = midCost - costNow
    let yearsUntil = Math.max(0, process.availableFrom - year)
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
            {unlocked
              ? active
                ? 'IN USE'
                : teething
                  ? `TEETHING ${teethingRemaining}y`
                  : 'READY'
              : `${process.availableFrom} · ${yearsUntil}y`}
          </span>
        </div>
        {active ? (
          <div mix={processCardStatsStyle}>
            Running at <strong>${costNow.toFixed(0)}/t</strong> ·{' '}
            {process.oreCompat.highP ? 'any ore' : 'low-P only'}
          </div>
        ) : unlocked ? (
          <div mix={processCardDetailsStyle}>
            <div>
              Adopt: <strong>{fmtUsd(capex)}</strong> capex
            </div>
            <div>
              Online: <strong>{teething ? `${teethingRemaining} yrs teething` : 'immediately'}</strong>
            </div>
            <div>
              At mid-life: <strong>${midCost.toFixed(0)}/t</strong>
              {costNow > 0 && (
                <span mix={delta < 0 ? processCardDeltaGoodStyle : processCardDeltaBadStyle}>
                  {' '}
                  ({delta >= 0 ? '+' : ''}${delta.toFixed(0)} vs now)
                </span>
              )}
            </div>
            {teething && (
              <div mix={processCardWarnStyle}>
                Starts at ~${initialCost.toFixed(0)}/t · defects ~5× until settled
              </div>
            )}
          </div>
        ) : (
          <div mix={processCardStatsStyle}>
            Locked · ${process.midLifeCostUsdPerTon}/t mid-life ·{' '}
            {process.oreCompat.highP ? 'any ore' : 'low-P only'}
          </div>
        )}
      </button>
    )
  }
}

function ComingUp(handle: Handle<{ year: number }>) {
  return () => {
    let { year } = handle.props
    let locked = PROCESSES.filter((p) => p.availableFrom > year)
    if (locked.length === 0) return null
    return (
      <div mix={comingUpStyle}>
        <div mix={comingUpHeaderStyle}>Coming up</div>
        {locked.map((p) => (
          <div key={`coming-${p.id}`} mix={comingUpRowStyle}>
            <span mix={comingUpNameStyle}>{p.shortName}</span>
            <span mix={comingUpYearStyle}>
              {p.availableFrom} · {p.availableFrom - year}y
            </span>
          </div>
        ))}
      </div>
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

function Retrospective(
  handle: Handle<{
    playerHistory: readonly YearReport[]
    playerSwitches: readonly ScheduledSwitch[]
    competitors: readonly CompetitorRun[]
  }>,
) {
  return () => {
    let { playerHistory, playerSwitches, competitors } = handle.props
    let playerFinal = playerHistory[playerHistory.length - 1]
    let playerProfit = playerFinal?.cumulativeProfit ?? 0
    let playerBankrupt = playerFinal?.bankrupt ?? false

    return (
      <section mix={retroWrapStyle}>
        <div mix={retroHeaderStyle}>
          <div mix={retroFigStyle}>Fig. 5.5 — Sixty years later</div>
          <h2 mix={retroTitleStyle}>How it played out</h2>
          <p mix={retroBlurbStyle}>
            The clock has run to 1910. Here is your final ledger against the three ghost
            mills — and what they actually did during the price collapse.
          </p>
        </div>

        <div mix={retroPlayerStyle}>
          <div mix={retroPlayerHeadStyle}>YOU</div>
          <div mix={retroPlayerStatsStyle}>
            <Readout
              k="Cumulative profit"
              v={fmtUsd(playerProfit)}
              accent
            />
            <Readout k="Status" v={playerBankrupt ? 'BANKRUPT' : 'Operating'} />
            <Readout
              k="Switches made"
              v={playerSwitches.length === 0 ? 'none' : String(playerSwitches.length)}
            />
          </div>
          {playerSwitches.length > 0 && (
            <div mix={retroTimelineStyle}>
              {playerSwitches.map((s, i) => (
                <span key={`ps-${i}`} mix={retroChipStyle}>
                  {s.year} → {getProcess(s.process).shortName}
                </span>
              ))}
            </div>
          )}
        </div>

        <div mix={retroGridStyle}>
          {competitors.map((c) => (
            <CompetitorCard
              key={`retro-${c.strategy.id}`}
              strategy={c.strategy}
              history={c.history}
              playerProfit={playerProfit}
              playerSwitches={playerSwitches}
            />
          ))}
        </div>
      </section>
    )
  }
}

function CompetitorCard(
  handle: Handle<{
    strategy: CompetitorStrategy
    history: readonly YearReport[]
    playerProfit: number
    playerSwitches: readonly ScheduledSwitch[]
  }>,
) {
  return () => {
    let { strategy, history, playerProfit, playerSwitches } = handle.props
    let final = history[history.length - 1]
    let theirProfit = final?.cumulativeProfit ?? 0
    let delta = theirProfit - playerProfit
    let won = delta > 0
    let narrative = retroNarrative(strategy, playerSwitches, delta)
    return (
      <div mix={retroCardStyle}>
        <div mix={retroCardHeadStyle}>
          <span mix={retroCardNameStyle}>{strategy.name}</span>
          <span mix={won ? retroCardBadgeWinStyle : retroCardBadgeLoseStyle}>
            {won ? 'AHEAD' : 'BEHIND'}
          </span>
        </div>
        <div mix={retroCardProfitStyle}>{fmtUsd(theirProfit)}</div>
        <div mix={retroCardDeltaStyle}>
          {delta >= 0 ? '+' : '−'}
          {fmtUsd(Math.abs(delta))} vs you
        </div>
        <div mix={retroTimelineStyle}>
          <span mix={retroChipStyle}>
            {strategy.config.startYear} · founded on {getProcess(strategy.config.process).shortName}
          </span>
          {strategy.switches.map((s, i) => (
            <span key={`sw-${i}`} mix={retroChipStyle}>
              {s.year} → {getProcess(s.process).shortName}
            </span>
          ))}
        </div>
        <p mix={retroNarrativeStyle}>{narrative}</p>
      </div>
    )
  }
}

function retroNarrative(
  strategy: CompetitorStrategy,
  playerSwitches: readonly ScheduledSwitch[],
  delta: number,
): string {
  let firstSwitchYear = strategy.switches[0]?.year ?? null
  let playerFirstYear = playerSwitches[0]?.year ?? null
  let yearGap =
    firstSwitchYear != null && playerFirstYear != null
      ? firstSwitchYear - playerFirstYear
      : null

  let comparison = ''
  if (yearGap != null) {
    if (yearGap === 0) comparison = 'They moved the same year you did.'
    else if (yearGap < 0)
      comparison = `They committed ${Math.abs(yearGap)} years before you — and ate the teething tuition while you watched.`
    else
      comparison = `They waited ${yearGap} years longer than you did before committing.`
  } else if (firstSwitchYear != null && playerFirstYear == null) {
    comparison = `They moved off their starting process in ${firstSwitchYear}; you never did.`
  } else if (firstSwitchYear == null && playerFirstYear != null) {
    comparison = `They never switched; you did.`
  } else {
    comparison = `Neither of you switched.`
  }

  let verdict =
    delta > 0
      ? 'They ended ahead — the lab is unforgiving on this kind of inertia.'
      : delta < 0
        ? 'You ended ahead. The decision tree they followed cost them.'
        : 'You ended in a dead heat.'

  switch (strategy.id) {
    case 'crucible-co':
      return `Crucible Co. refused to chase rails — staying on small-batch crucible steel for the whole period. ${comparison} ${verdict}`
    case 'bessemer-pioneer':
      return `Bessemer Pioneer adopted the converter in 1857, the year after it was patented — one of the first commercial Bessemer mills in the world. The early heats failed badly (the original "Bessemer" steel was famously brittle for the first half-decade), but riding the descent of the cost curve from 1865 onward paid the tuition back several times over. ${comparison} ${verdict}`
    case 'carnegie-style':
      return `Carnegie-style entered late (1872) and big — a Carnegie-scale Bessemer plant from day one, ten times your capacity, then a Basic OH rebuild in 1885. Aggressive capex (1.5× a conservative mill) and that scale advantage drove per-ton costs to roughly half of yours. ${comparison} ${verdict} Your charter was always a regional mill (50k t/y, conservative capex) — you couldn't have matched this play even with perfect foresight. The lesson here isn't "you should have moved sooner," it's that some moats require the right ambition from the start. The historical Carnegie did exactly this and became the largest steel producer on earth.`
    default:
      return `${comparison} ${verdict}`
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
  gridTemplateColumns: 'repeat(3, 1fr)',
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

const cardBaseStyle = {
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

const processGridStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
})

const processCardStyle = css({
  ...cardBaseStyle,
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

const modalBackdropStyle = css({
  position: 'fixed',
  inset: 0,
  background: 'rgba(14,34,51,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  zIndex: 100,
  backdropFilter: 'blur(2px)',
})

const modalCardStyle = css({
  background: T.paperWarm,
  border: `2px solid ${T.ink}`,
  boxShadow: '6px 6px 0 rgba(14,34,51,0.25)',
  padding: '24px 24px 20px',
  maxWidth: '560px',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  fontFamily: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
  color: T.ink,
})

const modalTagStyle = css({
  fontSize: '10px',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: T.accent,
})

const modalTitleStyle = css({
  fontSize: '22px',
  margin: 0,
  fontWeight: 700,
  letterSpacing: '0.02em',
  lineHeight: 1.15,
})

const modalBlurbStyle = css({
  fontSize: '12px',
  lineHeight: 1.55,
  margin: 0,
})

const modalWarnStyle = css({
  fontSize: '11px',
  lineHeight: 1.5,
  margin: 0,
  border: `1px solid ${T.accent}`,
  background: T.accentSoft,
  padding: '8px 10px',
  fontWeight: 700,
  letterSpacing: '0.02em',
})

const modalStatsStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: '8px',
  '@media (max-width: 540px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
})

const modalActionsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginTop: '4px',
})

const modalFootnoteStyle = css({
  fontSize: '10px',
  lineHeight: 1.5,
  opacity: 0.65,
  marginTop: '2px',
})

const tickerReasonStyle = css({
  marginTop: '4px',
  border: `1px dashed ${T.accent}`,
  background: T.accentSoft,
  padding: '6px 10px',
  fontSize: '10px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: T.accent,
})

const decisionWrapStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
})

const decisionHeadStyle = css({
  fontSize: '12px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  opacity: 0.85,
})

const decisionGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: '8px',
  '@media (max-width: 720px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
})

const decisionStatBase = {
  border: `1px solid ${T.ink}`,
  padding: '8px 10px',
  background: T.panel,
} as const

const decisionStatStyle = css({ ...decisionStatBase })

const decisionStatAccentStyle = css({
  ...decisionStatBase,
  borderColor: T.accent,
  background: T.accentSoft,
})

const decisionStatLabelStyle = css({
  fontSize: '9px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  opacity: 0.7,
  marginBottom: '4px',
})

const decisionStatValueStyle = css({
  fontSize: '18px',
  fontWeight: 700,
  letterSpacing: '0.02em',
})

const decisionNoteStyle = css({
  fontSize: '11px',
  lineHeight: 1.5,
  opacity: 0.85,
})

const decisionPriceNoteStyle = css({
  fontSize: '10px',
  lineHeight: 1.5,
  opacity: 0.65,
  fontStyle: 'italic',
})

const processCardDetailsStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  fontSize: '10px',
  lineHeight: 1.45,
  marginTop: '2px',
})

const processCardDeltaGoodStyle = css({
  color: T.accent,
  fontWeight: 700,
})

const processCardDeltaBadStyle = css({
  opacity: 0.7,
  fontWeight: 700,
})

const comingUpStyle = css({
  marginTop: '8px',
  borderTop: `1px dashed ${T.rule}`,
  paddingTop: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
})

const comingUpHeaderStyle = css({
  fontSize: '9px',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  fontWeight: 700,
  opacity: 0.6,
  marginBottom: '2px',
})

const comingUpRowStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  fontSize: '10px',
  opacity: 0.7,
})

const comingUpNameStyle = css({
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
})

const comingUpYearStyle = css({
  fontSize: '9px',
  letterSpacing: '0.12em',
  opacity: 0.85,
})

const processCardWarnStyle = css({
  marginTop: '3px',
  fontSize: '9px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: T.accent,
  fontWeight: 700,
})

const retroWrapStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
  borderTop: `2px solid ${T.ink}`,
  paddingTop: '24px',
  marginTop: '8px',
})

const retroHeaderStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
})

const retroFigStyle = css({
  fontSize: '10px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  opacity: 0.65,
  fontWeight: 700,
})

const retroTitleStyle = css({
  fontSize: '24px',
  margin: 0,
  fontWeight: 700,
  letterSpacing: '0.02em',
  color: T.accent,
})

const retroBlurbStyle = css({
  fontSize: '12px',
  lineHeight: 1.5,
  margin: 0,
  maxWidth: '60ch',
  opacity: 0.85,
})

const retroPlayerStyle = css({
  border: `2px solid ${T.accent}`,
  padding: '16px',
  background: T.accentSoft,
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
})

const retroPlayerHeadStyle = css({
  fontSize: '10px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: T.accent,
})

const retroPlayerStatsStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '8px',
  '@media (max-width: 720px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
})

const retroGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '14px',
})

const retroCardStyle = css({
  border: `1px solid ${T.ink}`,
  padding: '14px',
  background: T.panel,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
})

const retroCardHeadStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: '8px',
})

const retroCardNameStyle = css({
  fontSize: '13px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
})

const retroBadgeBase = {
  fontSize: '9px',
  letterSpacing: '0.14em',
  fontWeight: 700,
  padding: '3px 6px',
  border: `1px solid ${T.ink}`,
} as const

const retroCardBadgeWinStyle = css({
  ...retroBadgeBase,
  borderColor: T.accent,
  color: T.accent,
})

const retroCardBadgeLoseStyle = css({
  ...retroBadgeBase,
  opacity: 0.6,
})

const retroCardProfitStyle = css({
  fontSize: '22px',
  fontWeight: 700,
  letterSpacing: '0.02em',
})

const retroCardDeltaStyle = css({
  fontSize: '10px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  opacity: 0.7,
  fontWeight: 700,
})

const retroTimelineStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
})

const retroChipStyle = css({
  border: `1px solid ${T.ink}`,
  padding: '3px 7px',
  fontSize: '9px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  fontWeight: 700,
  background: T.panelStrong,
})

const retroNarrativeStyle = css({
  fontSize: '11px',
  lineHeight: 1.55,
  margin: 0,
  opacity: 0.9,
})
