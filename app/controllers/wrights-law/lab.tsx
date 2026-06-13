import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

import { DraftingButton, FieldSlider, Panel, Readout, SheetHeader, T } from '../../ui/shell.tsx'
import { LinearChart, LogLogChart, ShapeChart } from './charts.tsx'
import { formatMoney, formatRatio, formatUnits, formatYears } from './format.ts'
import {
  DEFAULT_CONFIG,
  FORECAST_TARGET,
  HISTORICAL_SERIES,
  INTERVENTIONS,
  LearningRamp,
  SCENARIO_PRESETS,
  STARTING_CREDITS,
  type InterventionId,
  type LearningConfig,
  type ScenarioPreset,
} from './learning.ts'

interface WrightsLawLabProps extends SerializableProps {}

// Years of production advanced per real-time second.
const SPEED_OPTIONS = [2, 10, 40] as const
type Speed = (typeof SPEED_OPTIONS)[number]

export const WrightsLawLab = clientEntry(
  '/assets/app/controllers/wrights-law/lab.tsx#WrightsLawLab',
  function WrightsLawLab(handle: Handle<WrightsLawLabProps>) {
    let ramp = new LearningRamp(DEFAULT_CONFIG)
    let activePresetId = 'sandbox'
    let speed: Speed = 10
    let running = false
    let showHistorical = true
    let guessValue = Math.round(DEFAULT_CONFIG.firstUnitCost * 0.4)
    let lastFrameTime: number | null = null

    if (typeof requestAnimationFrame !== 'undefined') {
      let frameId: number | null = null
      function tick(timestamp: number) {
        if (handle.signal.aborted) return
        if (!running) {
          lastFrameTime = timestamp
        } else if (lastFrameTime != null) {
          let dtMs = Math.min(timestamp - lastFrameTime, 250)
          lastFrameTime = timestamp
          ramp.step((dtMs / 1000) * speed)
          if (ramp.atCeiling()) running = false
          handle.update()
        } else {
          lastFrameTime = timestamp
        }
        frameId = requestAnimationFrame(tick)
      }
      frameId = requestAnimationFrame(tick)
      handle.signal.addEventListener('abort', () => {
        if (frameId != null) cancelAnimationFrame(frameId)
      })
    }

    function rebuild(config: LearningConfig) {
      ramp = new LearningRamp(config)
      running = false
      lastFrameTime = null
      guessValue = Math.round(config.firstUnitCost * 0.4)
      handle.update()
    }

    function reset() {
      rebuild(ramp.config)
    }

    function loadPreset(preset: ScenarioPreset) {
      activePresetId = preset.id
      rebuild(preset.config)
    }

    function setConfig(patch: Partial<LearningConfig>) {
      activePresetId = 'custom'
      rebuild({ ...ramp.config, ...patch })
    }

    function toggleRun() {
      running = !running
      lastFrameTime = null
      handle.update()
    }

    function setSpeed(s: Speed) {
      speed = s
      handle.update()
    }

    function applyLever(id: InterventionId) {
      ramp.apply(id)
      handle.update()
    }

    function lockForecast() {
      ramp.forecastFor(guessValue)
      handle.update()
    }

    return () => {
      let snap = ramp.snapshot()
      let started = snap.years > 0 || snap.forecast.locked

      return (
        <article mix={pageStyle}>
          <SheetHeader
            fig="Fig. 6.0 — Wright's Law"
            title="Wright's Law Lab"
            subtitle="Theodore Wright, 1936: every doubling of cumulative output cut airframe labour by a fixed percentage. Solar PV held the same shape for half a century, $100/W to pennies. Pick a learning rate, run the ramp, and watch the line refuse to flatten — even as the linear chart swears that it has."
          />

          <div mix={twoColStyle}>
            <div mix={mainColumnStyle}>
              <Panel label="Fig. 6.1 — The two faces of the same data" padding={20}>
                <div mix={chartPairStyle}>
                  <LogLogChart history={snap.history} firstUnitCost={snap.config.firstUnitCost} />
                  <LinearChart history={snap.history} />
                </div>
              </Panel>

              <Panel label="Fig. 6.2 — Shape comparison" padding={20}>
                <ShapeChart
                  history={snap.history}
                  firstUnitCost={snap.config.firstUnitCost}
                  learningRate={snap.config.learningRate}
                  series={HISTORICAL_SERIES}
                  showHistorical={showHistorical}
                />
              </Panel>

              <div mix={counterGridStyle}>
                <Counter k="Cumulative units" v={formatUnits(snap.cumUnits)} />
                <Counter k="Doublings" v={snap.doublings.toFixed(1)} />
                <Counter k="Current unit cost" v={formatMoney(snap.unitCost)} accent />
                <Counter k="Cost-to-date" v={formatMoney(snap.totalCost)} />
                <Counter k="Time elapsed" v={formatYears(snap.years)} />
                <Counter k="R&D credits" v={`${snap.credits} / ${STARTING_CREDITS}`} />
              </div>
            </div>

            <aside mix={asideStyle}>
              <Panel label="Ramp controls" padding={16}>
                <div mix={twoButtonRowStyle}>
                  <DraftingButton primary onClick={toggleRun} disabled={snap.atCeiling}>
                    {running ? '‖ Pause' : snap.atCeiling ? 'At ceiling' : '▶ Run ramp'}
                  </DraftingButton>
                  <DraftingButton onClick={reset}>Reset</DraftingButton>
                </div>
                <div mix={speedGroupStyle}>
                  {SPEED_OPTIONS.map((s) => (
                    <SpeedButton key={`sp-${s}`} speed={s} active={s === speed} onClick={() => setSpeed(s)} />
                  ))}
                </div>
                <div mix={speedHintStyle}>years advanced per second</div>
              </Panel>

              <Panel label="Forecast game" padding={16}>
                {snap.forecast.actual != null ? (
                  <Verdict guess={snap.forecast.guess ?? 0} actual={snap.forecast.actual} />
                ) : snap.forecast.locked ? (
                  <div mix={forecastPendingStyle}>
                    Forecast locked at <strong>{formatMoney(snap.forecast.guess ?? 0)}</strong>. Run
                    the ramp to unit {formatUnits(FORECAST_TARGET)} to see how badly you did.
                  </div>
                ) : (
                  <>
                    <div mix={forecastPromptStyle}>
                      Before you run: what will one unit cost at{' '}
                      <strong>{formatUnits(FORECAST_TARGET)}</strong> cumulative units?
                    </div>
                    <FieldSlider
                      label="Your forecast"
                      value={guessValue}
                      min={1}
                      max={Math.max(2, Math.round(snap.config.firstUnitCost))}
                      step={1}
                      format={(v) => formatMoney(v)}
                      onChange={(v) => {
                        guessValue = v
                        handle.update()
                      }}
                    />
                    <DraftingButton full onClick={lockForecast} disabled={started}>
                      Lock in forecast
                    </DraftingButton>
                  </>
                )}
              </Panel>

              <Panel label="Interventions" padding={16}>
                <div mix={leverGroupStyle}>
                  {INTERVENTIONS.map((lever) => (
                    <LeverButton
                      key={`lv-${lever.id}`}
                      name={lever.name}
                      blurb={lever.blurb}
                      cost={lever.cost}
                      used={snap.used[lever.id]}
                      disabled={!ramp.canApply(lever.id)}
                      onClick={() => applyLever(lever.id)}
                    />
                  ))}
                </div>
              </Panel>

              <Panel label="Scenario" padding={16}>
                <div mix={presetGroupStyle}>
                  {SCENARIO_PRESETS.map((p) => (
                    <PresetButton
                      key={`pr-${p.id}`}
                      name={p.name}
                      blurb={p.blurb}
                      active={p.id === activePresetId}
                      onClick={() => loadPreset(p)}
                    />
                  ))}
                </div>
              </Panel>

              <Panel label="Knobs" padding={16}>
                <FieldSlider
                  label="Learning rate"
                  unit="/doubling"
                  value={Math.round(snap.config.learningRate * 100)}
                  min={70}
                  max={95}
                  step={1}
                  format={(v) => `${v}%`}
                  onChange={(v) => setConfig({ learningRate: v / 100 })}
                />
                <FieldSlider
                  label="First-unit cost"
                  value={snap.config.firstUnitCost}
                  min={10}
                  max={1000}
                  step={10}
                  format={(v) => formatMoney(v)}
                  onChange={(v) => setConfig({ firstUnitCost: v })}
                />
                <FieldSlider
                  label="Production rate"
                  unit="/yr"
                  value={snap.config.productionRate}
                  min={20}
                  max={500}
                  step={10}
                  format={(v) => formatUnits(v)}
                  onChange={(v) => setConfig({ productionRate: v })}
                />
              </Panel>

              <Panel label="Overlays" padding={16}>
                <ToggleRow
                  label="Historical curves"
                  hint="Solar · Model T · DRAM"
                  on={showHistorical}
                  onClick={() => {
                    showHistorical = !showHistorical
                    handle.update()
                  }}
                />
              </Panel>

              <Panel label="Drafting note" padding={16}>
                <div mix={noteStyle}>
                  The linear chart on the right will, given a long enough run, appear to flatten
                  into a floor. It is lying. The log-log chart on the left shows the same data
                  falling at the same slope it always had. The book is blunt about this: the line
                  has never been observed to stop. Every business plan that drew the asymptote was
                  wrong, and in the same direction.
                </div>
              </Panel>
            </aside>
          </div>
        </article>
      )
    }
  },
)

function Verdict(handle: Handle<{ guess: number; actual: number }>) {
  return () => {
    let { guess, actual } = handle.props
    let ratio = actual > 0 ? guess / actual : 0
    let high = guess > actual
    let verdict =
      ratio >= 2
        ? `You overestimated by ${formatRatio(ratio)}. You are in good company — almost nobody guesses low.`
        : high
          ? `A touch high — off by ${formatRatio(ratio)}. The curve still beat your instinct.`
          : ratio === 0
            ? 'No prediction on file.'
            : `You guessed low, by ${formatRatio(actual / guess)}. That is genuinely rare. File a report.`
    return (
      <div mix={verdictStyle}>
        <div mix={verdictRowStyle}>
          <span>You said</span>
          <span>{formatMoney(guess)}</span>
        </div>
        <div mix={verdictRowAccentStyle}>
          <span>Reality</span>
          <span>{formatMoney(actual)}</span>
        </div>
        <div mix={verdictTextStyle}>{verdict}</div>
      </div>
    )
  }
}

function Counter(handle: Handle<{ k: string; v: string; accent?: boolean }>) {
  return () => {
    let { k, v, accent } = handle.props
    return (
      <div mix={counterStyle}>
        <div mix={counterKeyStyle}>{k}</div>
        <div mix={accent ? counterValueAccentStyle : counterValueStyle}>{v}</div>
      </div>
    )
  }
}

function SpeedButton(handle: Handle<{ speed: number; active: boolean; onClick: () => void }>) {
  return () => {
    let { speed, active, onClick } = handle.props
    return (
      <button type="button" mix={[active ? speedButtonActiveStyle : speedButtonStyle, on('click', onClick)]}>
        {speed}×
      </button>
    )
  }
}

function LeverButton(
  handle: Handle<{
    name: string
    blurb: string
    cost: number
    used: number
    disabled: boolean
    onClick: () => void
  }>,
) {
  return () => {
    let { name, blurb, cost, used, disabled, onClick } = handle.props
    return (
      <button
        type="button"
        disabled={disabled}
        mix={[leverButtonStyle, on('click', onClick)]}
      >
        <span mix={leverHeadStyle}>
          <span mix={leverNameStyle}>{name}</span>
          <span mix={leverCostStyle}>
            {cost} cr{used > 0 ? ` · ×${used}` : ''}
          </span>
        </span>
        <span mix={leverBlurbStyle}>{blurb}</span>
      </button>
    )
  }
}

function PresetButton(
  handle: Handle<{ name: string; blurb: string; active: boolean; onClick: () => void }>,
) {
  return () => {
    let { name, blurb, active, onClick } = handle.props
    return (
      <button type="button" mix={[active ? presetButtonActiveStyle : presetButtonStyle, on('click', onClick)]}>
        <span mix={presetNameStyle}>{name}</span>
        <span mix={presetBlurbStyle}>{blurb}</span>
      </button>
    )
  }
}

function ToggleRow(
  handle: Handle<{ label: string; hint: string; on: boolean; onClick: () => void }>,
) {
  return () => {
    let { label, hint, on: isOn, onClick } = handle.props
    return (
      <button type="button" mix={[isOn ? toggleActiveStyle : toggleStyle, on('click', onClick)]}>
        <span mix={toggleLabelStyle}>
          <span mix={toggleNameStyle}>{label}</span>
          <span mix={toggleHintStyle}>{hint}</span>
        </span>
        <span mix={isOn ? toggleDotOnStyle : toggleDotStyle}>{isOn ? 'ON' : 'OFF'}</span>
      </button>
    )
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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

const chartPairStyle = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '20px',
  '@media (max-width: 720px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
})

const asideStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  position: 'sticky',
  top: '96px',
  '@media (max-width: 1100px)': { position: 'static', top: 'auto' },
})

const counterGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '12px',
  '@media (max-width: 720px)': { gridTemplateColumns: '1fr 1fr' },
})

const counterStyle = css({
  border: `1px solid ${T.ink}`,
  background: T.panel,
  padding: '12px 14px',
})

const counterKeyStyle = css({
  fontSize: '9px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  opacity: 0.65,
})

const counterValueStyle = css({
  fontSize: '20px',
  fontWeight: 700,
  marginTop: '4px',
  letterSpacing: '0.01em',
})

const counterValueAccentStyle = css({
  fontSize: '20px',
  fontWeight: 700,
  marginTop: '4px',
  letterSpacing: '0.01em',
  color: T.accent,
})

const twoButtonRowStyle = css({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' })

const speedGroupStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  marginTop: '8px',
  border: `1px solid ${T.ink}`,
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

const speedButtonStyle = css({ ...speedBaseStyle, background: 'transparent', color: T.ink, '&:hover': { background: T.panelStrong } })
const speedButtonActiveStyle = css({ ...speedBaseStyle, background: T.ink, color: T.paper })

const speedHintStyle = css({
  marginTop: '6px',
  fontSize: '9px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  opacity: 0.55,
  textAlign: 'center',
})

const forecastPromptStyle = css({ fontSize: '11px', lineHeight: 1.5, marginBottom: '10px' })

const forecastPendingStyle = css({ fontSize: '11px', lineHeight: 1.55 })

const verdictStyle = css({ display: 'flex', flexDirection: 'column', gap: '4px' })

const verdictRowBase = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '6px 0',
  borderTop: `1px dashed ${T.ink}`,
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.04em',
} as const

const verdictRowStyle = css({ ...verdictRowBase })
const verdictRowAccentStyle = css({ ...verdictRowBase, color: T.accent })

const verdictTextStyle = css({ marginTop: '8px', fontSize: '11px', lineHeight: 1.55 })

const leverGroupStyle = css({ display: 'flex', flexDirection: 'column', gap: '6px' })

const buttonStackBase = {
  appearance: 'none',
  fontFamily: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
  cursor: 'pointer',
  padding: '8px 10px',
  border: `1px solid ${T.ink}`,
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
  background: 'transparent',
  color: T.ink,
  transition: 'background-color 120ms ease',
  '&:hover:not(:disabled)': { background: T.panelStrong },
  '&:disabled': { opacity: 0.4, cursor: 'not-allowed' },
} as const

const leverButtonStyle = css({ ...buttonStackBase })

const leverHeadStyle = css({ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' })

const leverNameStyle = css({ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' })

const leverCostStyle = css({ fontSize: '10px', fontWeight: 700, color: T.accent, whiteSpace: 'nowrap' })

const leverBlurbStyle = css({ fontSize: '10px', opacity: 0.7, lineHeight: 1.45 })

const presetGroupStyle = css({ display: 'flex', flexDirection: 'column', gap: '6px' })

const presetButtonStyle = css({ ...buttonStackBase })
const presetButtonActiveStyle = css({ ...buttonStackBase, background: T.ink, color: T.paper, '&:hover:not(:disabled)': { background: T.inkSoft } })

const presetNameStyle = css({ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' })
const presetBlurbStyle = css({ fontSize: '10px', opacity: 0.75, lineHeight: 1.4 })

const toggleBase = {
  ...buttonStackBase,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
} as const

const toggleStyle = css({ ...toggleBase })
const toggleActiveStyle = css({ ...toggleBase })

const toggleLabelStyle = css({ display: 'flex', flexDirection: 'column', gap: '2px' })
const toggleNameStyle = css({ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' })
const toggleHintStyle = css({ fontSize: '10px', opacity: 0.7 })

const toggleDotBase = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  padding: '3px 8px',
  border: `1px solid ${T.ink}`,
} as const

const toggleDotStyle = css({ ...toggleDotBase, opacity: 0.5 })
const toggleDotOnStyle = css({ ...toggleDotBase, background: T.accent, color: T.paper, borderColor: T.accent })

const noteStyle = css({ fontSize: '11px', lineHeight: 1.55 })
