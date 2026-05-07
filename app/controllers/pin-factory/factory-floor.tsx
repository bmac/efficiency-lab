import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

import { routes } from '../../routes.ts'
import {
  SCENARIO_PRESETS,
  Simulator,
  type ScenarioPreset,
  type SimulatorConfig,
  type StationSnapshot,
} from './factory.ts'
import { Sparkline } from './sparkline.tsx'

interface FactoryFloorProps extends SerializableProps {}

const SPEED_OPTIONS = [1, 4, 16] as const
type Speed = (typeof SPEED_OPTIONS)[number]

const STATE_COLOR: Record<StationSnapshot['state'], string> = {
  working: '#80e464',
  blocked: '#ff5148',
  starved: '#ffdf5f',
}

const STATE_LABEL: Record<StationSnapshot['state'], string> = {
  working: 'Working',
  blocked: 'Blocked',
  starved: 'Starved',
}

export const FactoryFloor = clientEntry(
  '/assets/app/controllers/pin-factory/factory-floor.tsx#FactoryFloor',
  function FactoryFloor(handle: Handle<FactoryFloorProps>) {
    let activePresetId: string = SCENARIO_PRESETS[0].id
    let sim = new Simulator(SCENARIO_PRESETS[0].build())
    let speed: Speed = 4
    let paused = false
    let lastFrameTime: number | null = null

    if (typeof requestAnimationFrame !== 'undefined') {
      let frameId: number | null = null

      function tick(timestamp: number) {
        if (handle.signal.aborted) return
        if (paused) {
          lastFrameTime = timestamp
        } else if (lastFrameTime != null) {
          let dtMs = Math.min(timestamp - lastFrameTime, 250)
          lastFrameTime = timestamp
          sim.step((dtMs / 1000) * speed)
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

    function loadPreset(presetId: string) {
      let preset = SCENARIO_PRESETS.find((p) => p.id === presetId)
      if (!preset) return
      activePresetId = preset.id
      sim = new Simulator(preset.build())
      lastFrameTime = null
      handle.update()
    }

    function reset() {
      let current: SimulatorConfig = {
        ...sim.config,
        stations: sim.config.stations.map((s) => ({ ...s })),
      }
      sim = new Simulator(current)
      lastFrameTime = null
      handle.update()
    }

    function togglePause() {
      paused = !paused
      lastFrameTime = null
      handle.update()
    }

    function stepOnce() {
      paused = true
      sim.step(1)
      handle.update()
    }

    function setSpeed(s: Speed) {
      speed = s
      handle.update()
    }

    function setMode(mode: 'push' | 'pull') {
      sim.setMode(mode)
      handle.update()
    }

    function setReleaseRate(rate: number) {
      sim.setReleaseRate(rate)
      handle.update()
    }

    function setKanbanCap(cap: number) {
      sim.setKanbanCap(cap)
      handle.update()
    }

    function setStationMean(i: number, mean: number) {
      let cfg = sim.config.stations[i]
      sim.setStationParams(i, mean, cfg.sigma)
      handle.update()
    }

    function setStationSigma(i: number, sigma: number) {
      let cfg = sim.config.stations[i]
      sim.setStationParams(i, cfg.mean, sigma)
      handle.update()
    }

    return () => {
      let snap = sim.snapshot()
      let throughputSeries = snap.history.map((h) => ({ t: h.t, value: h.throughput }))
      let cycleSeries = snap.history.map((h) => ({ t: h.t, value: h.cycleTime }))
      let wipSeries = snap.history.map((h) => ({ t: h.t, value: h.wip }))
      let isPush = sim.config.mode === 'push'

      return (
        <article mix={pageStyle}>
          <header mix={headerStyle}>
            <a href={routes.home.href()} mix={backLinkStyle}>
              ← All tools
            </a>
            <h1 mix={titleStyle}>Pin Factory</h1>
            <p mix={subtitleStyle}>
              Five-station serial line. Slide variance up. Switch from push to pull. Watch
              throughput, cycle time, and WIP respond. Lower cycle-time variance is the prize.
            </p>
          </header>

          <section mix={controlBarStyle}>
            <button
              type="button"
              mix={[primaryButtonStyle, on('click', togglePause)]}
            >
              {paused ? 'Play' : 'Pause'}
            </button>
            <button type="button" mix={[secondaryButtonStyle, on('click', stepOnce)]}>
              Step 1s
            </button>
            <div mix={speedGroupStyle}>
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={`speed-${s}`}
                  type="button"
                  mix={[
                    speedButtonStyle(s === speed),
                    on('click', () => setSpeed(s)),
                  ]}
                >
                  {s}×
                </button>
              ))}
            </div>
            <span mix={timeStyle}>t = {snap.time.toFixed(1)}s</span>
            <button type="button" mix={[ghostButtonStyle, on('click', reset)]}>
              Reset
            </button>
          </section>

          <section mix={mainGridStyle}>
            <div mix={leftColumnStyle}>
              <FactoryLine stations={snap.stations} />

              <div mix={metricsRowStyle}>
                <Stat label="Throughput" value={`${snap.throughput.toFixed(3)} u/s`} />
                <Stat label="Cycle time (avg)" value={`${snap.avgCycleTime.toFixed(1)} s`} />
                <Stat label="WIP" value={String(snap.wip)} />
                <Stat label="Completed" value={String(snap.completedCount)} />
              </div>

              <div mix={sparklinesStyle}>
                <Sparkline
                  label="Throughput"
                  unit="units/sec"
                  value={snap.throughput}
                  formatValue={(v) => v.toFixed(3)}
                  series={throughputSeries}
                  windowSeconds={120}
                  color="var(--brand-blue)"
                />
                <Sparkline
                  label="Cycle time"
                  unit="seconds"
                  value={snap.avgCycleTime}
                  formatValue={(v) => v.toFixed(1)}
                  series={cycleSeries}
                  windowSeconds={120}
                  color="#ff65db"
                />
                <Sparkline
                  label="WIP"
                  unit="units in system"
                  value={snap.wip}
                  formatValue={(v) => Math.round(v).toString()}
                  series={wipSeries}
                  windowSeconds={120}
                  color="#ffdf5f"
                />
              </div>

              <StationStatsTable stations={snap.stations} />
            </div>

            <aside mix={rightColumnStyle}>
              <Panel title="Scenario">
                <div mix={presetGridStyle}>
                  {SCENARIO_PRESETS.map((p) => (
                    <PresetButton
                      key={`p-${p.id}`}
                      preset={p}
                      active={p.id === activePresetId}
                      onClick={() => loadPreset(p.id)}
                    />
                  ))}
                </div>
              </Panel>

              <Panel title="Mode">
                <div mix={modeRowStyle}>
                  <button
                    type="button"
                    mix={[
                      modeButtonStyle(isPush),
                      on('click', () => setMode('push')),
                    ]}
                  >
                    Push
                  </button>
                  <button
                    type="button"
                    mix={[
                      modeButtonStyle(!isPush),
                      on('click', () => setMode('pull')),
                    ]}
                  >
                    Pull
                  </button>
                </div>
                {isPush ? (
                  <Field
                    label={`Release rate: ${sim.config.releaseRate.toFixed(3)} u/s`}
                  >
                    <input
                      type="range"
                      min="0.01"
                      max="0.5"
                      step="0.005"
                      value={String(sim.config.releaseRate)}
                      mix={[
                        sliderStyle,
                        on('input', (event) => {
                          setReleaseRate(Number(event.currentTarget.value))
                        }),
                      ]}
                    />
                  </Field>
                ) : (
                  <Field label={`Kanban cap (K): ${sim.config.kanbanCap}`}>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={String(sim.config.kanbanCap)}
                      mix={[
                        sliderStyle,
                        on('input', (event) => {
                          setKanbanCap(Number(event.currentTarget.value))
                        }),
                      ]}
                    />
                  </Field>
                )}
              </Panel>

              <Panel title="Stations">
                <div mix={stationConfigListStyle}>
                  {sim.config.stations.map((s, i) => (
                    <StationConfigEditor
                      key={`s-${i}`}
                      index={i}
                      name={s.name}
                      mean={s.mean}
                      sigma={s.sigma}
                      onMeanChange={(v) => setStationMean(i, v)}
                      onSigmaChange={(v) => setStationSigma(i, v)}
                    />
                  ))}
                </div>
              </Panel>
            </aside>
          </section>
        </article>
      )
    }
  },
)

function FactoryLine(handle: Handle<{ stations: StationSnapshot[] }>) {
  return () => {
    let { stations } = handle.props
    return (
      <div mix={lineWrapStyle}>
        <ol mix={lineStyle}>
          {stations.map((s, i) => (
            <li key={`fs-${i}`} mix={lineItemStyle}>
              <StationCard station={s} index={i} />
              {i < stations.length - 1 && (
                <BufferIndicator depth={stations[i + 1].bufferDepth} />
              )}
            </li>
          ))}
        </ol>
      </div>
    )
  }
}

function StationCard(handle: Handle<{ station: StationSnapshot; index: number }>) {
  return () => {
    let { station, index } = handle.props
    let color = STATE_COLOR[station.state]
    return (
      <div mix={stationCardStyle}>
        <div mix={stationHeaderStyle}>
          <span mix={stationIndexStyle}>#{index + 1}</span>
          <span mix={stationNameStyle}>{station.name}</span>
        </div>
        <div mix={stationBodyStyle}>
          <span mix={stateDotStyle(color)} />
          <span mix={stateLabelStyle}>{STATE_LABEL[station.state]}</span>
        </div>
        <div mix={stationFooterStyle}>
          <span>util {(station.utilization * 100).toFixed(0)}%</span>
        </div>
      </div>
    )
  }
}

function BufferIndicator(handle: Handle<{ depth: number }>) {
  return () => {
    let { depth } = handle.props
    let visible = Math.min(depth, 8)
    return (
      <div mix={bufferStyle}>
        <div mix={bufferStackStyle}>
          {Array.from({ length: visible }).map((_, i) => (
            <span key={`b-${i}`} mix={bufferDotStyle} />
          ))}
        </div>
        <span mix={bufferCountStyle}>{depth > 0 ? `→ ${depth}` : '→'}</span>
      </div>
    )
  }
}

function StationStatsTable(handle: Handle<{ stations: StationSnapshot[] }>) {
  return () => (
    <table mix={statTableStyle}>
      <thead>
        <tr>
          <th mix={thStyle}>Station</th>
          <th mix={thStyle}>State</th>
          <th mix={thStyle}>Buffer</th>
          <th mix={thStyle}>Utilization</th>
          <th mix={thStyle}>Starved %</th>
          <th mix={thStyle}>Blocked %</th>
        </tr>
      </thead>
      <tbody>
        {handle.props.stations.map((s, i) => (
          <tr key={`st-${i}`}>
            <td mix={tdStyle}>
              {i + 1}. {s.name}
            </td>
            <td mix={tdStyle}>
              <span mix={stateDotStyle(STATE_COLOR[s.state])} /> {STATE_LABEL[s.state]}
            </td>
            <td mix={tdStyle}>{s.bufferDepth}</td>
            <td mix={tdStyle}>{(s.utilization * 100).toFixed(0)}%</td>
            <td mix={tdStyle}>{(s.starvedFraction * 100).toFixed(0)}%</td>
            <td mix={tdStyle}>{(s.blockedFraction * 100).toFixed(0)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function StationConfigEditor(
  handle: Handle<{
    index: number
    name: string
    mean: number
    sigma: number
    onMeanChange: (v: number) => void
    onSigmaChange: (v: number) => void
  }>,
) {
  return () => {
    let p = handle.props
    return (
      <div mix={stationConfigStyle}>
        <div mix={stationConfigHeaderStyle}>
          <span mix={stationConfigIndexStyle}>#{p.index + 1}</span>
          <span mix={stationConfigNameStyle}>{p.name}</span>
        </div>
        <Field label={`μ ${p.mean.toFixed(1)} s`}>
          <input
            type="range"
            min="1"
            max="30"
            step="0.5"
            value={String(p.mean)}
            mix={[
              sliderStyle,
              on('input', (event) => p.onMeanChange(Number(event.currentTarget.value))),
            ]}
          />
        </Field>
        <Field label={`σ ${p.sigma.toFixed(1)}`}>
          <input
            type="range"
            min="0"
            max="8"
            step="0.1"
            value={String(p.sigma)}
            mix={[
              sliderStyle,
              on('input', (event) => p.onSigmaChange(Number(event.currentTarget.value))),
            ]}
          />
        </Field>
      </div>
    )
  }
}

function PresetButton(
  handle: Handle<{ preset: ScenarioPreset; active: boolean; onClick: () => void }>,
) {
  return () => {
    let { preset, active, onClick } = handle.props
    return (
      <button type="button" mix={[presetButtonStyle(active), on('click', onClick)]}>
        <span mix={presetNameStyle}>{preset.name}</span>
        <span mix={presetDescStyle}>{preset.description}</span>
      </button>
    )
  }
}

function Stat(handle: Handle<{ label: string; value: string }>) {
  return () => (
    <div mix={statStyle}>
      <span mix={statLabelStyle}>{handle.props.label}</span>
      <span mix={statValueStyle}>{handle.props.value}</span>
    </div>
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
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
})

const baseButtonStyle = {
  appearance: 'none',
  font: 'inherit',
  fontSize: '13px',
  cursor: 'pointer',
  padding: '8px 14px',
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

const speedGroupStyle = css({
  display: 'inline-flex',
  borderRadius: '8px',
  overflow: 'hidden',
  border: '1px solid var(--surface-3)',
})

function speedButtonStyle(active: boolean) {
  return css({
    ...baseButtonStyle,
    padding: '6px 10px',
    borderRadius: 0,
    background: active ? 'var(--brand-blue)' : 'transparent',
    color: active ? 'white' : 'var(--text-primary)',
    fontWeight: active ? 700 : 400,
    '&:hover:not(:disabled)': {
      background: active ? 'var(--brand-blue)' : 'var(--surface-4)',
    },
  })
}

const timeStyle = css({
  fontSize: '12px',
  color: 'var(--text-tertiary)',
  marginLeft: 'auto',
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

const lineWrapStyle = css({
  background: 'var(--surface-3)',
  borderRadius: '12px',
  padding: '16px',
  overflowX: 'auto',
})

const lineStyle = css({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  alignItems: 'stretch',
  gap: '0',
  minWidth: 'fit-content',
})

const lineItemStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0',
})

const stationCardStyle = css({
  width: '120px',
  background: 'var(--surface-4)',
  borderRadius: '8px',
  padding: '10px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
})

const stationHeaderStyle = css({
  display: 'flex',
  alignItems: 'baseline',
  gap: '6px',
})

const stationIndexStyle = css({
  fontSize: '10px',
  color: 'var(--text-tertiary)',
  fontWeight: 700,
})

const stationNameStyle = css({
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--text-primary)',
})

const stationBodyStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
})

function stateDotStyle(color: string) {
  return css({
    display: 'inline-block',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: color,
    flex: '0 0 auto',
  })
}

const stateLabelStyle = css({
  fontSize: '11px',
  color: 'var(--text-primary)',
})

const stationFooterStyle = css({
  fontSize: '10px',
  color: 'var(--text-tertiary)',
})

const bufferStyle = css({
  width: '60px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  padding: '0 8px',
})

const bufferStackStyle = css({
  display: 'flex',
  flexDirection: 'column-reverse',
  alignItems: 'center',
  gap: '2px',
  minHeight: '32px',
})

const bufferDotStyle = css({
  width: '8px',
  height: '4px',
  background: 'var(--brand-blue)',
  borderRadius: '2px',
})

const bufferCountStyle = css({
  fontSize: '10px',
  color: 'var(--text-tertiary)',
})

const metricsRowStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: '8px',
})

const statStyle = css({
  background: 'var(--surface-3)',
  borderRadius: '8px',
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
})

const statLabelStyle = css({
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-tertiary)',
})

const statValueStyle = css({
  fontSize: '15px',
  fontWeight: 700,
  color: 'var(--text-primary)',
})

const sparklinesStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '8px',
})

const statTableStyle = css({
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

const presetGridStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
})

function presetButtonStyle(active: boolean) {
  return css({
    appearance: 'none',
    font: 'inherit',
    cursor: 'pointer',
    padding: '10px 12px',
    borderRadius: '8px',
    background: active ? 'var(--brand-blue)' : 'var(--surface-4)',
    color: active ? 'white' : 'var(--text-primary)',
    border: 0,
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    transition: 'background-color 120ms ease',
    '&:hover': {
      background: active ? 'var(--brand-blue)' : 'var(--surface-0)',
    },
  })
}

const presetNameStyle = css({
  fontSize: '13px',
  fontWeight: 700,
})

const presetDescStyle = css({
  fontSize: '11px',
  opacity: 0.85,
  lineHeight: 1.4,
})

const modeRowStyle = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px',
})

function modeButtonStyle(active: boolean) {
  return css({
    ...baseButtonStyle,
    background: active ? 'var(--brand-blue)' : 'var(--surface-4)',
    color: active ? 'white' : 'var(--text-primary)',
    fontWeight: active ? 700 : 400,
    '&:hover': {
      background: active ? 'var(--brand-blue)' : 'var(--surface-0)',
    },
  })
}

const stationConfigListStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
})

const stationConfigStyle = css({
  background: 'var(--surface-4)',
  borderRadius: '8px',
  padding: '10px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
})

const stationConfigHeaderStyle = css({
  display: 'flex',
  alignItems: 'baseline',
  gap: '6px',
})

const stationConfigIndexStyle = css({
  fontSize: '10px',
  color: 'var(--text-tertiary)',
  fontWeight: 700,
})

const stationConfigNameStyle = css({
  fontSize: '13px',
  fontWeight: 700,
})

const fieldStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
})

const fieldLabelStyle = css({
  fontSize: '11px',
  color: 'var(--text-primary)',
})

const sliderStyle = css({ width: '100%' })
