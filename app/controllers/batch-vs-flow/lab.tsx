import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

import { DraftingButton, FieldSlider, Panel, Readout, SheetHeader, T } from '../../ui/shell.tsx'
import { DualSeries, LeadTimeHistogram } from './charts.tsx'
import { PipelineDiagram } from './diagram.tsx'
import { formatSeconds } from './format.ts'
import {
  BatchVsFlowSimulation,
  DEFAULT_LAB_CONFIG,
  SCENARIO_PRESETS,
  type DemandProfile,
  type LabConfig,
  type PipelineSnapshot,
  type ScenarioPreset,
} from './pipeline.ts'

interface BatchVsFlowLabProps extends SerializableProps {}

const SPEED_OPTIONS = [1, 4, 16, 64] as const
type Speed = (typeof SPEED_OPTIONS)[number]

const DEMAND_OPTIONS: { id: DemandProfile; label: string; hint: string }[] = [
  { id: 'steady', label: 'Steady', hint: 'Constant arrivals' },
  { id: 'bursty', label: 'Bursty', hint: '60s cycle, 4× spikes' },
  { id: 'declining', label: 'Declining', hint: 'Demand decays over 10 min' },
]

export const BatchVsFlowLab = clientEntry(
  '/assets/app/controllers/batch-vs-flow/lab.tsx#BatchVsFlowLab',
  function BatchVsFlowLab(handle: Handle<BatchVsFlowLabProps>) {
    let sim = new BatchVsFlowSimulation(DEFAULT_LAB_CONFIG)
    let activePresetId = 'balanced'
    let speed: Speed = 16
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

    function reset() {
      sim = new BatchVsFlowSimulation({ ...sim.config, seed: sim.config.seed + 1 })
      lastFrameTime = null
      handle.update()
    }

    function loadPreset(preset: ScenarioPreset) {
      activePresetId = preset.id
      sim = new BatchVsFlowSimulation({ ...preset.config, seed: sim.config.seed + 1 })
      lastFrameTime = null
      handle.update()
    }

    function togglePause() {
      paused = !paused
      lastFrameTime = null
      handle.update()
    }

    function setSpeed(s: Speed) {
      speed = s
      handle.update()
    }

    return () => {
      let batch = sim.batchPipeline.snapshot()
      let flow = sim.flowPipeline.snapshot()

      return (
        <article mix={pageStyle}>
          <SheetHeader
            fig="Fig. 4.0 — Batch vs. flow"
            title="Batch vs. Flow"
            subtitle="Two identical five-stage lines. Top runs in batches; bottom runs one unit at a time. Slide batch size and watch lead time, work-in-process, and tied-up capital diverge — sometimes by an order of magnitude. The right answer depends on setup, defects, and demand."
          />

          <div mix={twoColStyle}>
            <div mix={mainColumnStyle}>
              <Panel label="Fig. 4.1 — Batch line · live" padding={20}>
                <PipelineDiagram
                  pipeline={batch}
                  modeLabel={`BATCH · N = ${batch.batchSize}`}
                />
              </Panel>

              <Panel label="Fig. 4.2 — Flow line · reference (N = 1)" padding={20}>
                <PipelineDiagram pipeline={flow} modeLabel="FLOW · N = 1" />
              </Panel>

              <div mix={metricsGridStyle}>
                <MetricColumn title="Batch line" snapshot={batch} accent />
                <MetricColumn title="Flow line" snapshot={flow} />
              </div>

              <Panel label="Fig. 4.3 — Cumulative output" padding={16}>
                <DualSeries
                  windowSeconds={240}
                  batchSeries={batch.cumulativeOut}
                  flowSeries={flow.cumulativeOut}
                  unit="units"
                  format={(v) => Math.round(v).toString()}
                />
              </Panel>

              <Panel label="Fig. 4.4 — Work in process over time" padding={16}>
                <DualSeries
                  windowSeconds={240}
                  batchSeries={batch.wipHistory}
                  flowSeries={flow.wipHistory}
                  unit="units"
                  format={(v) => Math.round(v).toString()}
                />
              </Panel>

              <Panel label="Fig. 4.5 — Lead-time histogram" padding={16}>
                <div mix={histRowStyle}>
                  <LeadTimeHistogram label="Batch" leadTimes={batch.leadTimes} color={T.accent} />
                  <LeadTimeHistogram label="Flow" leadTimes={flow.leadTimes} color={T.ink} />
                </div>
              </Panel>
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
              </Panel>

              <Panel label="Scenario" padding={16}>
                <div mix={presetGroupStyle}>
                  {SCENARIO_PRESETS.map((p) => (
                    <PresetButton
                      key={`preset-${p.id}`}
                      preset={p}
                      active={p.id === activePresetId}
                      onClick={() => loadPreset(p)}
                    />
                  ))}
                </div>
              </Panel>

              <Panel label="Headline knob" padding={16}>
                <FieldSlider
                  label="Batch size"
                  unit="units"
                  value={sim.config.batchSize}
                  min={1}
                  max={100}
                  step={1}
                  format={(v) => Math.round(v).toString()}
                  onChange={(v) => {
                    sim.setBatchSize(v)
                    handle.update()
                  }}
                />
                <Readout
                  k="Batch lead (theory)"
                  v={`${formatSeconds(theoreticalBatchLead(sim.config))}`}
                  accent
                />
                <Readout
                  k="Flow lead (theory)"
                  v={`${formatSeconds(theoreticalFlowLead(sim.config))}`}
                />
              </Panel>

              <Panel label="Process knobs" padding={16}>
                <FieldSlider
                  label="Setup per stage"
                  unit="s"
                  value={sim.config.setupTime}
                  min={0}
                  max={60}
                  step={0.5}
                  format={(v) => v.toFixed(1)}
                  onChange={(v) => {
                    sim.setSetupTime(v)
                    handle.update()
                  }}
                />
                <FieldSlider
                  label="Cycle time CV"
                  value={sim.config.varianceCV}
                  min={0}
                  max={0.6}
                  step={0.01}
                  format={(v) => v.toFixed(2)}
                  onChange={(v) => {
                    sim.setVarianceCV(v)
                    handle.update()
                  }}
                />
                <FieldSlider
                  label="Defect rate"
                  unit="%/stage"
                  value={sim.config.defectRate * 100}
                  min={0}
                  max={5}
                  step={0.1}
                  format={(v) => v.toFixed(1)}
                  onChange={(v) => {
                    sim.setDefectRate(v / 100)
                    handle.update()
                  }}
                />
              </Panel>

              <Panel label="Demand" padding={16}>
                <FieldSlider
                  label="Arrival rate"
                  unit="u/s"
                  value={sim.config.demandRate}
                  min={0.05}
                  max={2}
                  step={0.05}
                  format={(v) => v.toFixed(2)}
                  onChange={(v) => {
                    sim.setDemandRate(v)
                    handle.update()
                  }}
                />
                <div mix={profileGroupStyle}>
                  {DEMAND_OPTIONS.map((opt) => (
                    <ProfileButton
                      key={`prof-${opt.id}`}
                      label={opt.label}
                      hint={opt.hint}
                      active={sim.config.demandProfile === opt.id}
                      onClick={() => {
                        sim.setDemandProfile(opt.id)
                        handle.update()
                      }}
                    />
                  ))}
                </div>
              </Panel>

              <Panel label="Live readout" padding={16}>
                <Readout k="t" v={`${batch.time.toFixed(1)} s`} accent />
                <Readout k="Speed" v={`${speed}×`} />
                <Readout k="State" v={paused ? 'Paused' : 'Running'} />
                <Readout k="Stages" v={String(sim.config.stageCount)} />
                <Readout
                  k="Defect corr."
                  v={`${(sim.config.defectCorrelation * 100).toFixed(0)}% within batch`}
                />
              </Panel>

              <Panel label="Drafting note" padding={16}>
                <div mix={noteStyle}>
                  Setup time per stage is paid once per batch on the top line, once per unit on
                  the bottom. The flow line scraps defective units at the stage where they
                  fail; the batch line carries every defect through to inspection — that's why
                  batches show lumpy rework events. Crank setup up, batches start to win on
                  throughput; crank it to zero, flow always wins.
                </div>
              </Panel>
            </aside>
          </div>
        </article>
      )
    }
  },
)

function MetricColumn(
  handle: Handle<{ title: string; snapshot: PipelineSnapshot; accent?: boolean }>,
) {
  return () => {
    let { title, snapshot, accent } = handle.props
    return (
      <div mix={accent ? metricColAccentStyle : metricColStyle}>
        <div mix={metricColTitleStyle}>{title}</div>
        <Readout k="Avg lead time" v={formatSeconds(snapshot.avgLeadTime)} accent={accent} />
        <Readout
          k="First unit out"
          v={snapshot.firstUnitOutAt == null ? '—' : formatSeconds(snapshot.firstUnitOutAt)}
        />
        <Readout k="Completed" v={snapshot.completedCount.toString()} />
        <Readout k="WIP" v={snapshot.wip.toString()} />
        <Readout k="Capital tied up" v={`$${Math.round(snapshot.capitalTiedUp).toLocaleString()}`} />
        <Readout k="Defects scrapped" v={snapshot.defectsScrapped.toString()} />
        <Readout k="Defects shipped" v={snapshot.defectsDiscovered.toString()} />
        <Readout k="Setup time" v={`${(snapshot.setupFraction * 100).toFixed(0)}%`} />
      </div>
    )
  }
}

function SpeedButton(handle: Handle<{ speed: number; active: boolean; onClick: () => void }>) {
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

function ProfileButton(
  handle: Handle<{ label: string; hint: string; active: boolean; onClick: () => void }>,
) {
  return () => {
    let { label, hint, active, onClick } = handle.props
    return (
      <button
        type="button"
        mix={[active ? profileButtonActiveStyle : profileButtonStyle, on('click', onClick)]}
      >
        <span mix={profileLabelStyle}>{label}</span>
        <span mix={profileHintStyle}>{hint}</span>
      </button>
    )
  }
}

function PresetButton(
  handle: Handle<{ preset: ScenarioPreset; active: boolean; onClick: () => void }>,
) {
  return () => {
    let { preset, active, onClick } = handle.props
    return (
      <button
        type="button"
        mix={[active ? presetButtonActiveStyle : presetButtonStyle, on('click', onClick)]}
      >
        <span mix={presetNameStyle}>{preset.name}</span>
        <span mix={presetDescStyle}>{preset.description}</span>
      </button>
    )
  }
}

function theoreticalBatchLead(config: LabConfig): number {
  return config.stageCount * (config.setupTime + config.batchSize * config.cycleTime)
}

function theoreticalFlowLead(config: LabConfig): number {
  return config.stageCount * (config.setupTime + config.cycleTime)
}

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

const histRowStyle = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
  '@media (max-width: 720px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
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
  marginTop: '8px',
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

const presetGroupStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
})

const presetButtonStyle = css({
  ...profileBaseStyle,
  background: 'transparent',
  color: T.ink,
  '&:hover': { background: T.panelStrong },
})

const presetButtonActiveStyle = css({
  ...profileBaseStyle,
  background: T.ink,
  color: T.paper,
})

const presetNameStyle = css({
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
})

const presetDescStyle = css({
  fontSize: '10px',
  opacity: 0.75,
  lineHeight: 1.4,
})

const noteStyle = css({
  fontSize: '11px',
  lineHeight: 1.55,
})
