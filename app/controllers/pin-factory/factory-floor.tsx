import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

import {
  DraftingButton,
  FieldSlider,
  Panel,
  Readout,
  SheetHeader,
  T,
} from '../../ui/shell.tsx'
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

const STATE_LABEL: Record<StationSnapshot['state'], string> = {
  working: '● WORKING',
  blocked: '● BLOCKED',
  starved: '● STARVED',
}

const STATE_COLOR: Record<StationSnapshot['state'], string> = {
  working: T.ink,
  blocked: T.warn,
  starved: T.warn,
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
          <SheetHeader
            fig="Fig. 3.0 — Serial line"
            title="Pin Factory"
            subtitle="Five stations in series. Slide variance up. Switch from push to pull. Watch where buffers swell, where stations starve, and how a single slow step paces the line."
          />

          <div mix={twoColStyle}>
            <div mix={mainColumnStyle}>
              <Panel label="Fig. 3.1 — Line diagram (live)" padding={20}>
                <FactoryLine stations={snap.stations} />
              </Panel>

              <div mix={metricsRowStyle}>
                <Metric label="Throughput" value={`${snap.throughput.toFixed(3)}`} unit="u/s" />
                <Metric
                  label="Cycle time"
                  value={`${snap.avgCycleTime.toFixed(1)}`}
                  unit="sec"
                />
                <Metric label="WIP" value={String(snap.wip)} unit="units" />
                <Metric label="Completed" value={String(snap.completedCount)} unit="units" />
              </div>

              <Panel label="Fig. 3.2 — Timeseries (last 120 s)" padding={16}>
                <div mix={sparkRowStyle}>
                  <Sparkline
                    label="Throughput"
                    unit="u/s"
                    value={snap.throughput}
                    formatValue={(v) => v.toFixed(3)}
                    series={throughputSeries}
                    windowSeconds={120}
                    color={T.accent}
                  />
                  <Sparkline
                    label="Cycle time"
                    unit="sec"
                    value={snap.avgCycleTime}
                    formatValue={(v) => v.toFixed(1)}
                    series={cycleSeries}
                    windowSeconds={120}
                    color={T.ink}
                  />
                  <Sparkline
                    label="WIP"
                    unit="units"
                    value={snap.wip}
                    formatValue={(v) => Math.round(v).toString()}
                    series={wipSeries}
                    windowSeconds={120}
                    color={T.warn}
                  />
                </div>
              </Panel>

              <Panel label="Station audit" padding={18}>
                <StationStatsTable stations={snap.stations} />
              </Panel>
            </div>

            <aside mix={asideStyle}>
              <Panel label="Scenario" padding={16}>
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

              <Panel label="Sim controls" padding={16}>
                <div mix={twoButtonRowStyle}>
                  <DraftingButton primary onClick={togglePause}>
                    {paused ? '▶ Run' : '‖ Pause'}
                  </DraftingButton>
                  <DraftingButton onClick={stepOnce}>Step 1s</DraftingButton>
                </div>
                <div mix={speedGroupStyle}>
                  {SPEED_OPTIONS.map((s) => (
                    <button
                      key={`speed-${s}`}
                      type="button"
                      mix={[
                        s === speed ? speedButtonActiveStyle : speedButtonStyle,
                        on('click', () => setSpeed(s)),
                      ]}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
                <DraftingButton full onClick={reset}>
                  Reset
                </DraftingButton>
              </Panel>

              <Panel label="Mode" padding={16}>
                <div mix={twoButtonRowStyle}>
                  <DraftingButton primary={isPush} onClick={() => setMode('push')}>
                    Push
                  </DraftingButton>
                  <DraftingButton primary={!isPush} onClick={() => setMode('pull')}>
                    Pull
                  </DraftingButton>
                </div>
                {isPush ? (
                  <FieldSlider
                    label="Release rate"
                    unit="u/s"
                    value={sim.config.releaseRate}
                    min={0.01}
                    max={0.5}
                    step={0.005}
                    format={(v) => v.toFixed(3)}
                    onChange={setReleaseRate}
                  />
                ) : (
                  <FieldSlider
                    label="Kanban cap (K)"
                    value={sim.config.kanbanCap}
                    min={1}
                    max={10}
                    step={1}
                    onChange={(v) => setKanbanCap(Math.round(v))}
                  />
                )}
              </Panel>

              <Panel label="Live readout" padding={16}>
                <Readout k="t" v={`${snap.time.toFixed(1)} s`} accent />
                <Readout k="Mode" v={sim.config.mode.toUpperCase()} />
                <Readout
                  k="Release"
                  v={isPush ? `${sim.config.releaseRate.toFixed(3)} u/s` : `K=${sim.config.kanbanCap}`}
                />
                <Readout k="Speed" v={`${speed}×`} />
                <Readout k="State" v={paused ? 'Paused' : 'Running'} />
              </Panel>

              <Panel label="Stations · Service times" padding={16}>
                <div mix={stationConfigListStyle}>
                  {sim.config.stations.map((s, i) => (
                    <div key={`s-${i}`} mix={stationConfigCardStyle}>
                      <div mix={stationConfigHeaderStyle}>
                        STN.{String(i + 1).padStart(2, '0')} · {s.name}
                      </div>
                      <FieldSlider
                        label="μ.svc"
                        unit="s"
                        value={s.mean}
                        min={1}
                        max={30}
                        step={0.5}
                        format={(v) => v.toFixed(1)}
                        onChange={(v) => setStationMean(i, v)}
                      />
                      <FieldSlider
                        label="σ.svc"
                        value={s.sigma}
                        min={0}
                        max={8}
                        step={0.1}
                        format={(v) => v.toFixed(1)}
                        onChange={(v) => setStationSigma(i, v)}
                      />
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel label="Drafting note" padding={16}>
                <div mix={noteStyle}>
                  Variance is the enemy. A balanced line with high σ behaves worse than an
                  unbalanced line with low σ. Pull mode trades throughput for predictability —
                  the K=1 case is single-piece flow.
                </div>
              </Panel>
            </aside>
          </div>
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
        {stations.map((s, i) => (
          <StationCard
            key={`fs-${i}`}
            station={s}
            index={i}
            isLast={i === stations.length - 1}
          />
        ))}
        <div mix={outArrowStyle}>→ out</div>
      </div>
    )
  }
}

function StationCard(
  handle: Handle<{ station: StationSnapshot; index: number; isLast: boolean }>,
) {
  return () => {
    let { station, index } = handle.props
    let bufN = station.bufferDepth
    let bufWarn = bufN > 5
    return (
      <div mix={stationCardStyle}>
        <div mix={stationTopStyle}>
          <span>STN.{String(index + 1).padStart(2, '0')}</span>
          {index > 0 && (
            <span mix={bufWarn ? bufferChipWarnStyle : bufferChipStyle}>← {bufN}</span>
          )}
        </div>
        <div mix={stationNameStyle}>{station.name}</div>
        <div
          mix={stationStateStyle}
          style={{ color: STATE_COLOR[station.state] }}
        >
          {STATE_LABEL[station.state]}
        </div>
        <div mix={stationUtilLabelStyle}>UTIL</div>
        <div mix={stationUtilValueStyle}>{(station.utilization * 100).toFixed(0)}%</div>
        <div mix={utilTrackStyle}>
          <div
            mix={utilFillStyle}
            style={{ width: `${Math.min(100, station.utilization * 100)}%` }}
          />
        </div>
      </div>
    )
  }
}

function StationStatsTable(handle: Handle<{ stations: StationSnapshot[] }>) {
  return () => (
    <div mix={tableScrollStyle}>
      <table mix={tableStyle}>
        <thead>
          <tr>
            <th mix={thStyle}>Stn</th>
            <th mix={thStyle}>Name</th>
            <th mix={thStyle}>State</th>
            <th mix={thStyle}>Buffer in</th>
            <th mix={thStyle}>Util</th>
            <th mix={thStyle}>Starved %</th>
            <th mix={thStyle}>Blocked %</th>
          </tr>
        </thead>
        <tbody>
          {handle.props.stations.map((s, i) => (
            <tr key={`st-${i}`}>
              <td mix={tdStyle}>{String(i + 1).padStart(2, '0')}</td>
              <td mix={tdStyle}>{s.name}</td>
              <td mix={tdStyle} style={{ color: STATE_COLOR[s.state], fontWeight: 700 }}>
                {STATE_LABEL[s.state]}
              </td>
              <td mix={tdStyle}>{s.bufferDepth}</td>
              <td mix={tdStyle}>{(s.utilization * 100).toFixed(0)}%</td>
              <td mix={tdStyle}>{(s.starvedFraction * 100).toFixed(0)}%</td>
              <td mix={tdStyle}>{(s.blockedFraction * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PresetButton(
  handle: Handle<{ preset: ScenarioPreset; active: boolean; onClick: () => void }>,
) {
  return () => {
    let { preset, active, onClick } = handle.props
    return (
      <button
        type="button"
        mix={[active ? presetActiveStyle : presetStyle, on('click', onClick)]}
      >
        <span mix={presetNameStyle}>{preset.name}</span>
        <span mix={presetDescStyle}>{preset.description}</span>
      </button>
    )
  }
}

function Metric(handle: Handle<{ label: string; value: string; unit: string }>) {
  return () => (
    <div mix={metricCardStyle}>
      <div mix={metricLabelStyle}>{handle.props.label}</div>
      <div mix={metricValueRowStyle}>
        <span mix={metricValueStyle}>{handle.props.value}</span>
        <span mix={metricUnitStyle}>{handle.props.unit}</span>
      </div>
    </div>
  )
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
  gap: '24px',
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

const lineWrapStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr)) auto',
  alignItems: 'stretch',
  gap: 0,
  overflowX: 'auto',
  '@media (max-width: 880px)': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr)) auto',
  },
  '@media (max-width: 520px)': {
    gridTemplateColumns: 'minmax(0, 1fr) auto',
  },
})

const stationCardStyle = css({
  border: `1px solid ${T.ink}`,
  marginRight: '-1px',
  padding: '12px',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  minWidth: '120px',
})

const stationTopStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '9px',
  letterSpacing: '0.14em',
  opacity: 0.7,
})

const bufferChipStyle = css({
  border: `1px solid ${T.ink}`,
  padding: '1px 6px',
  fontSize: '9px',
  letterSpacing: '0.1em',
  opacity: 0.85,
})

const bufferChipWarnStyle = css({
  border: `1px solid ${T.warn}`,
  background: `rgba(181,138,22,0.15)`,
  color: T.warn,
  padding: '1px 6px',
  fontSize: '9px',
  letterSpacing: '0.1em',
  fontWeight: 700,
})

const stationNameStyle = css({
  fontSize: '15px',
  fontWeight: 700,
  letterSpacing: '0.02em',
  marginTop: '2px',
})

const stationStateStyle = css({
  fontSize: '10px',
  letterSpacing: '0.14em',
  fontWeight: 700,
  marginTop: '4px',
})

const stationUtilLabelStyle = css({
  marginTop: '6px',
  fontSize: '9px',
  letterSpacing: '0.14em',
  opacity: 0.7,
})

const stationUtilValueStyle = css({
  fontSize: '20px',
  fontWeight: 700,
  lineHeight: 1,
  color: T.accent,
})

const utilTrackStyle = css({
  marginTop: '4px',
  height: '5px',
  border: `1px solid ${T.ink}`,
})

const utilFillStyle = css({
  height: '100%',
  background: T.accent,
  transition: 'width 200ms ease',
})

const outArrowStyle = css({
  borderTop: `1px solid ${T.ink}`,
  borderRight: `1px solid ${T.ink}`,
  borderBottom: `1px solid ${T.ink}`,
  padding: '12px',
  display: 'flex',
  alignItems: 'center',
  fontSize: '10px',
  letterSpacing: '0.14em',
  opacity: 0.7,
  whiteSpace: 'nowrap',
})

const metricsRowStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: '12px',
  '@media (max-width: 720px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
})

const metricCardStyle = css({
  border: `1px solid ${T.ink}`,
  padding: '12px',
  background: T.panel,
  position: 'relative',
})

const metricLabelStyle = css({
  fontSize: '10px',
  letterSpacing: '0.14em',
  fontWeight: 700,
  opacity: 0.7,
  textTransform: 'uppercase',
})

const metricValueRowStyle = css({
  display: 'flex',
  alignItems: 'baseline',
  gap: '6px',
  marginTop: '6px',
})

const metricValueStyle = css({
  fontSize: '30px',
  fontWeight: 700,
  lineHeight: 1,
  color: T.ink,
})

const metricUnitStyle = css({
  fontSize: '10px',
  letterSpacing: '0.14em',
  opacity: 0.6,
})

const sparkRowStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
})

const tableScrollStyle = css({ overflowX: 'auto' })

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

const presetGridStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
})

const presetBaseStyle = {
  appearance: 'none',
  fontFamily: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
  cursor: 'pointer',
  padding: '10px 12px',
  border: `1px solid ${T.ink}`,
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  transition: 'background-color 120ms ease',
} as const

const presetStyle = css({
  ...presetBaseStyle,
  background: 'transparent',
  color: T.ink,
  '&:hover': { background: T.panelStrong },
})

const presetActiveStyle = css({
  ...presetBaseStyle,
  background: T.ink,
  color: T.paper,
})

const presetNameStyle = css({
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
})

const presetDescStyle = css({
  fontSize: '11px',
  opacity: 0.85,
  lineHeight: 1.4,
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
  marginBottom: '8px',
  border: `1px solid ${T.ink}`,
})

const speedBaseStyle = {
  appearance: 'none',
  fontFamily: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
  cursor: 'pointer',
  padding: '6px 8px',
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

const stationConfigListStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
})

const stationConfigCardStyle = css({
  border: `1px dashed ${T.ink}`,
  padding: '10px',
})

const stationConfigHeaderStyle = css({
  fontSize: '10px',
  letterSpacing: '0.14em',
  fontWeight: 700,
  marginBottom: '8px',
})

const noteStyle = css({
  fontSize: '11px',
  lineHeight: 1.55,
})
