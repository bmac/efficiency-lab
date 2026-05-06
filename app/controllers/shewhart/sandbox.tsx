import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

import {
  WESTERN_ELECTRIC_RULES,
  detectWesternElectric,
  mean,
  rangeOf,
  xbarRLimits,
} from '../../stats.ts'
import { ControlChart, type PointFlag } from '../../ui/control-chart.tsx'
import {
  describeInjection,
  generateSubgroups,
  type Injection,
  type InjectionKind,
  type ProcessConfig,
} from './process.ts'

interface ShewhartSandboxProps extends SerializableProps {}

const RULE_COLOR: Record<1 | 2 | 3 | 4, string> = {
  1: '#ff5148',
  2: '#ff65db',
  3: '#ffdf5f',
  4: '#80e464',
}

export const ShewhartSandbox = clientEntry(
  '/assets/app/controllers/shewhart/sandbox.tsx#ShewhartSandbox',
  function ShewhartSandbox(_handle: Handle<ShewhartSandboxProps>) {
    let handle = _handle
    let nextInjectionId = 1

    let config: ProcessConfig = {
      mu: 10,
      sigma: 1,
      subgroupSize: 5,
      subgroupCount: 30,
      seed: 1,
      injections: [],
    }
    let baselineCount = 25

    function update() {
      handle.update()
    }

    function addInjection(kind: InjectionKind) {
      let id = `inj-${nextInjectionId++}`
      let mid = Math.max(1, Math.floor(config.subgroupCount / 2))
      let next: Injection
      if (kind === 'meanShift') {
        next = { id, kind, startSubgroup: mid, delta: config.sigma }
      } else if (kind === 'varianceIncrease') {
        next = { id, kind, startSubgroup: mid, multiplier: 2 }
      } else {
        next = { id, kind, atSubgroup: mid, sigmas: 4 }
      }
      config.injections = [...config.injections, next]
      update()
    }

    function removeInjection(id: string) {
      config.injections = config.injections.filter((i) => i.id !== id)
      update()
    }

    function updateInjection(id: string, patch: Partial<Injection>) {
      config.injections = config.injections.map((i) =>
        i.id === id ? ({ ...i, ...patch } as Injection) : i,
      )
      update()
    }

    function reshuffle() {
      config.seed = Math.floor(Math.random() * 1_000_000)
      update()
    }

    function clearInjections() {
      config.injections = []
      update()
    }

    return () => {
      let subgroups = generateSubgroups(config)
      let means = subgroups.map(mean)
      let ranges = subgroups.map(rangeOf)

      let effectiveBaseline = Math.max(2, Math.min(config.subgroupCount - 1, baselineCount))
      let baseline = subgroups.slice(0, effectiveBaseline)
      let limits = xbarRLimits(baseline)

      let sigmaXbar = limits.hasLimits ? (limits.uclX - limits.xbar) / 3 : 0
      let violations = limits.hasLimits
        ? detectWesternElectric(means, limits.xbar, sigmaXbar)
        : means.map(() => [])

      let flags: (PointFlag | undefined)[] = means.map((_, i) => {
        let firedRules = violations[i]
        if (firedRules.length === 0) return undefined
        let primary = firedRules[0]
        let descriptions = firedRules.map(
          (n) => `Rule ${n}: ${WESTERN_ELECTRIC_RULES[n].description}`,
        )
        return {
          color: RULE_COLOR[primary],
          tooltip: descriptions.join(' | '),
        }
      })

      let pointTooltips = means.map((v, i) => {
        let firedRules = violations[i]
        let suffix =
          firedRules.length > 0
            ? ` — Rule${firedRules.length > 1 ? 's' : ''} ${firedRules.join(', ')}`
            : ''
        return `Subgroup ${i + 1}: x̄ = ${v.toFixed(3)}${suffix}`
      })

      let zones =
        sigmaXbar > 0
          ? [
              { inner: limits.xbar, outer: limits.xbar + sigmaXbar, label: '+1σ' },
              { inner: limits.xbar, outer: limits.xbar - sigmaXbar, label: '−1σ' },
              { inner: limits.xbar, outer: limits.xbar + 2 * sigmaXbar, label: '+2σ' },
              { inner: limits.xbar, outer: limits.xbar - 2 * sigmaXbar, label: '−2σ' },
            ]
          : []

      let totalViolations = violations.flat().length

      return (
        <article mix={pageStyle}>
          <header mix={headerStyle}>
            <h1 mix={titleStyle}>Shewhart Sandbox</h1>
            <p mix={subtitleStyle}>
              Generate a stable process. Inject special causes. Watch the chart over-react. The
              hardest part of SPC isn't the math — it's not reacting to common-cause variation.
            </p>
          </header>

          <section mix={mainGridStyle}>
            <div mix={leftColumnStyle}>
              <div mix={chartGridStyle}>
                <ControlChart
                  title={`X̄ chart — subgroup means (n=${config.subgroupSize})`}
                  points={means}
                  cl={limits.xbar}
                  ucl={limits.uclX}
                  lcl={limits.lclX}
                  yLabel="Mean"
                  xLabel="Subgroup"
                  zones={zones}
                  baselineCutoff={effectiveBaseline}
                  flags={flags}
                  pointTooltips={pointTooltips}
                />
                <ControlChart
                  title="R chart — subgroup ranges"
                  points={ranges}
                  cl={limits.rbar}
                  ucl={limits.uclR}
                  lcl={limits.lclR}
                  yLabel="Range"
                  xLabel="Subgroup"
                  baselineCutoff={effectiveBaseline}
                />
              </div>

              <RuleLegend totalViolations={totalViolations} />

              {config.injections.length > 0 && (
                <ScenarioSummary injections={config.injections} />
              )}
            </div>

            <aside mix={rightColumnStyle}>
              <Panel title="Process">
                <Field label={`μ (process mean) — ${config.mu.toFixed(2)}`}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.5"
                    value={String(config.mu)}
                    mix={[
                      sliderStyle,
                      on('input', (event) => {
                        config.mu = Number(event.currentTarget.value)
                        update()
                      }),
                    ]}
                  />
                </Field>
                <Field label={`σ (process sigma) — ${config.sigma.toFixed(2)}`}>
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={String(config.sigma)}
                    mix={[
                      sliderStyle,
                      on('input', (event) => {
                        config.sigma = Number(event.currentTarget.value)
                        update()
                      }),
                    ]}
                  />
                </Field>
                <Field label={`n (subgroup size) — ${config.subgroupSize}`}>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    step="1"
                    value={String(config.subgroupSize)}
                    mix={[
                      sliderStyle,
                      on('input', (event) => {
                        config.subgroupSize = Number(event.currentTarget.value)
                        update()
                      }),
                    ]}
                  />
                </Field>
                <Field label={`k (subgroup count) — ${config.subgroupCount}`}>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="1"
                    value={String(config.subgroupCount)}
                    mix={[
                      sliderStyle,
                      on('input', (event) => {
                        config.subgroupCount = Number(event.currentTarget.value)
                        update()
                      }),
                    ]}
                  />
                </Field>
                <Field label={`Baseline (control limits from first ${baselineCount})`}>
                  <input
                    type="range"
                    min="2"
                    max="100"
                    step="1"
                    value={String(baselineCount)}
                    mix={[
                      sliderStyle,
                      on('input', (event) => {
                        baselineCount = Number(event.currentTarget.value)
                        update()
                      }),
                    ]}
                  />
                </Field>
                <Field label={`Seed: ${config.seed}`}>
                  <div mix={inputRowStyle}>
                    <input
                      type="number"
                      value={String(config.seed)}
                      mix={[
                        numberInputStyle,
                        on('change', (event) => {
                          let n = Number(event.currentTarget.value)
                          if (Number.isFinite(n)) {
                            config.seed = n
                            update()
                          }
                        }),
                      ]}
                    />
                    <button
                      type="button"
                      mix={[ghostButtonStyle, on('click', reshuffle)]}
                    >
                      Re-shuffle
                    </button>
                  </div>
                </Field>
              </Panel>

              <Panel title="Inject special cause">
                <div mix={injectionButtonsStyle}>
                  <button
                    type="button"
                    mix={[secondaryButtonStyle, on('click', () => addInjection('meanShift'))]}
                  >
                    + Mean shift
                  </button>
                  <button
                    type="button"
                    mix={[
                      secondaryButtonStyle,
                      on('click', () => addInjection('varianceIncrease')),
                    ]}
                  >
                    + Variance ×
                  </button>
                  <button
                    type="button"
                    mix={[
                      secondaryButtonStyle,
                      on('click', () => addInjection('singleOutlier')),
                    ]}
                  >
                    + Outlier
                  </button>
                </div>
                {config.injections.length > 0 && (
                  <ul mix={injectionListStyle}>
                    {config.injections.map((injection) => (
                      <InjectionEditor
                        key={injection.id}
                        injection={injection}
                        maxSubgroup={config.subgroupCount}
                        onUpdate={(patch) => updateInjection(injection.id, patch)}
                        onRemove={() => removeInjection(injection.id)}
                      />
                    ))}
                  </ul>
                )}
                {config.injections.length > 0 && (
                  <button
                    type="button"
                    mix={[ghostButtonStyle, on('click', clearInjections)]}
                  >
                    Clear all
                  </button>
                )}
              </Panel>
            </aside>
          </section>
        </article>
      )
    }
  },
)

function InjectionEditor(
  handle: Handle<{
    injection: Injection
    maxSubgroup: number
    onUpdate: (patch: Partial<Injection>) => void
    onRemove: () => void
  }>,
) {
  return () => {
    let { injection, maxSubgroup, onUpdate, onRemove } = handle.props
    return (
      <li mix={injectionCardStyle}>
        <div mix={injectionHeaderStyle}>
          <span mix={injectionKindStyle}>{kindLabel(injection.kind)}</span>
          <button type="button" mix={[iconButtonStyle, on('click', onRemove)]}>
            ×
          </button>
        </div>
        <Field
          label={
            injection.kind === 'singleOutlier'
              ? `At subgroup ${injection.atSubgroup}`
              : `From subgroup ${injection.startSubgroup}`
          }
        >
          <input
            type="range"
            min="1"
            max={String(maxSubgroup)}
            step="1"
            value={String(
              injection.kind === 'singleOutlier'
                ? injection.atSubgroup
                : injection.startSubgroup,
            )}
            mix={[
              sliderStyle,
              on('input', (event) => {
                let v = Number(event.currentTarget.value)
                if (injection.kind === 'singleOutlier') {
                  onUpdate({ atSubgroup: v } as Partial<Injection>)
                } else {
                  onUpdate({ startSubgroup: v } as Partial<Injection>)
                }
              }),
            ]}
          />
        </Field>
        {injection.kind === 'meanShift' && (
          <Field label={`Δμ = ${injection.delta.toFixed(2)}`}>
            <input
              type="range"
              min="-10"
              max="10"
              step="0.1"
              value={String(injection.delta)}
              mix={[
                sliderStyle,
                on('input', (event) => {
                  onUpdate({ delta: Number(event.currentTarget.value) } as Partial<Injection>)
                }),
              ]}
            />
          </Field>
        )}
        {injection.kind === 'varianceIncrease' && (
          <Field label={`σ × ${injection.multiplier.toFixed(2)}`}>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.1"
              value={String(injection.multiplier)}
              mix={[
                sliderStyle,
                on('input', (event) => {
                  onUpdate({
                    multiplier: Number(event.currentTarget.value),
                  } as Partial<Injection>)
                }),
              ]}
            />
          </Field>
        )}
        {injection.kind === 'singleOutlier' && (
          <Field label={`Outlier magnitude: ${injection.sigmas.toFixed(1)}σ`}>
            <input
              type="range"
              min="-10"
              max="10"
              step="0.5"
              value={String(injection.sigmas)}
              mix={[
                sliderStyle,
                on('input', (event) => {
                  onUpdate({ sigmas: Number(event.currentTarget.value) } as Partial<Injection>)
                }),
              ]}
            />
          </Field>
        )}
      </li>
    )
  }
}

function kindLabel(kind: InjectionKind): string {
  switch (kind) {
    case 'meanShift':
      return 'Mean shift'
    case 'varianceIncrease':
      return 'Variance ×'
    case 'singleOutlier':
      return 'Single outlier'
  }
}

function RuleLegend(handle: Handle<{ totalViolations: number }>) {
  return () => (
    <section mix={legendStyle}>
      <h2 mix={legendTitleStyle}>
        Western Electric rules — {handle.props.totalViolations} violation
        {handle.props.totalViolations === 1 ? '' : 's'}
      </h2>
      <ul mix={legendListStyle}>
        {([1, 2, 3, 4] as const).map((n) => (
          <li key={`r-${n}`} mix={legendItemStyle}>
            <span mix={legendDotStyle(RULE_COLOR[n])} />
            <span mix={legendTextStyle}>
              <strong>Rule {n}</strong> — {WESTERN_ELECTRIC_RULES[n].description}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ScenarioSummary(handle: Handle<{ injections: Injection[] }>) {
  return () => (
    <section mix={summaryStyle}>
      <h2 mix={summaryTitleStyle}>Active injections</h2>
      <ul mix={summaryListStyle}>
        {handle.props.injections.map((inj) => (
          <li key={inj.id} mix={summaryItemStyle}>
            {describeInjection(inj)}
          </li>
        ))}
      </ul>
    </section>
  )
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
    '--surface-3': '#313539',
    '--surface-4': '#363a3e',
    '--text-primary': '#dee2e6',
    '--text-tertiary': '#94989c',
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

const mainGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 320px',
  gap: '24px',
  '@media (max-width: 960px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
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

const chartGridStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
})

const baseButtonStyle = {
  appearance: 'none',
  font: 'inherit',
  fontSize: '13px',
  cursor: 'pointer',
  padding: '8px 12px',
  borderRadius: '8px',
  border: 0,
  transition: 'background-color 120ms ease, color 120ms ease',
  '&:disabled': { opacity: 0.4, cursor: 'not-allowed' },
} as const

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

const iconButtonStyle = css({
  ...baseButtonStyle,
  width: '24px',
  height: '24px',
  padding: 0,
  background: 'transparent',
  color: 'var(--text-tertiary)',
  border: '1px solid var(--surface-0)',
  '&:hover': { color: '#ff5148', borderColor: '#ff5148' },
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

const fieldStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
})

const fieldLabelStyle = css({
  fontSize: '12px',
  color: 'var(--text-primary)',
})

const sliderStyle = css({ width: '100%' })

const numberInputStyle = css({
  appearance: 'none',
  font: 'inherit',
  fontSize: '13px',
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid var(--surface-0)',
  background: 'var(--surface-4)',
  color: 'var(--text-primary)',
  flex: '1 1 0',
  minWidth: 0,
})

const inputRowStyle = css({
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
})

const injectionButtonsStyle = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: '8px',
})

const injectionListStyle = css({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
})

const injectionCardStyle = css({
  background: 'var(--surface-4)',
  borderRadius: '8px',
  padding: '10px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
})

const injectionHeaderStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
})

const injectionKindStyle = css({
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--brand-blue)',
})

const legendStyle = css({
  background: 'var(--surface-3)',
  borderRadius: '12px',
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
})

const legendTitleStyle = css({
  margin: 0,
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-tertiary)',
})

const legendListStyle = css({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '6px 16px',
})

const legendItemStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
})

function legendDotStyle(color: string) {
  return css({
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: color,
    flex: '0 0 auto',
  })
}

const legendTextStyle = css({
  fontSize: '12px',
  color: 'var(--text-primary)',
})

const summaryStyle = css({
  background: 'var(--surface-3)',
  borderRadius: '12px',
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
})

const summaryTitleStyle = css({
  margin: 0,
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-tertiary)',
})

const summaryListStyle = css({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
})

const summaryItemStyle = css({
  fontSize: '12px',
  color: 'var(--text-primary)',
})
