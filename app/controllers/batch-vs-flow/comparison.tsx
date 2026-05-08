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
  DEFAULT_STAGES,
  SCENARIO_PRESETS,
  simulate,
  type BatchFlowConfig,
  type DemandProfile,
  type OutputSample,
  type PipelineMetrics,
  type ScenarioPreset,
  type StageConfig,
} from './simulation.ts'

interface ComparisonProps extends SerializableProps {}

const DEMAND_LABELS: Record<DemandProfile, string> = {
  steady: 'Steady',
  bursty: 'Bursty',
  declining: 'Declining',
}

const DEMAND_OPTIONS: DemandProfile[] = ['steady', 'bursty', 'declining']

function defaultConfig(): BatchFlowConfig {
  return {
    stages: DEFAULT_STAGES.map((s) => ({ ...s })),
    batchSize: 50,
    unitCost: 10,
    defectCorrelation: 0.6,
    demandProfile: 'steady',
    units: 200,
  }
}

export const Comparison = clientEntry(
  '/assets/app/controllers/batch-vs-flow/comparison.tsx#Comparison',
  function Comparison(handle: Handle<ComparisonProps>) {
    let activePresetId: string = 'balanced-default'
    let config: BatchFlowConfig = defaultConfig()

    function setBatchSize(v: number) {
      config = { ...config, batchSize: Math.max(1, Math.round(v)) }
      handle.update()
    }

    function setSetupTime(v: number) {
      config = {
        ...config,
        stages: config.stages.map((s) => ({ ...s, setupTime: v })),
      }
      handle.update()
    }

    function setDefectRate(v: number) {
      config = {
        ...config,
        stages: config.stages.map((s) => ({ ...s, defectRate: v })),
      }
      handle.update()
    }

    function setUnitCost(v: number) {
      config = { ...config, unitCost: v }
      handle.update()
    }

    function setDefectCorrelation(v: number) {
      config = { ...config, defectCorrelation: v }
      handle.update()
    }

    function setDemand(profile: DemandProfile) {
      config = { ...config, demandProfile: profile }
      handle.update()
    }

    function loadPreset(id: string) {
      let preset = SCENARIO_PRESETS.find((p) => p.id === id)
      if (!preset) return
      activePresetId = preset.id
      config = preset.build()
      handle.update()
    }

    function reset() {
      activePresetId = 'balanced-default'
      config = defaultConfig()
      handle.update()
    }

    return () => {
      let result = simulate(config)
      let avgSetup = avg(config.stages.map((s) => s.setupTime))
      let avgDefect = avg(config.stages.map((s) => s.defectRate))

      return (
        <article mix={pageStyle}>
          <SheetHeader
            fig="Fig. 4.0 — Continuous processes"
            title="Batch vs. Flow"
            subtitle="Two identical pipelines. The top line processes in batches; the bottom line moves one unit at a time. Slide batch size and watch lead time, work-in-process, capital tied up, and defect propagation diverge."
          />

          <div mix={twoColStyle}>
            <div mix={mainColumnStyle}>
              <Panel label="Fig. 4.1 — Pipelines (top: batch · bottom: flow)" padding={20}>
                <PipelineDiagram
                  stages={config.stages}
                  batchSize={config.batchSize}
                  batchMetrics={result.batch}
                  flowMetrics={result.flow}
                />
              </Panel>

              <div mix={metricsGridStyle}>
                <MetricColumn
                  title="Batch line"
                  metrics={result.batch}
                  unitCost={config.unitCost}
                  accent={T.warn}
                />
                <MetricColumn
                  title="Flow line"
                  metrics={result.flow}
                  unitCost={config.unitCost}
                  accent={T.accent}
                />
              </div>

              <Panel label="Fig. 4.2 — Cumulative units shipped" padding={16}>
                <OutputChart
                  batchCurve={result.batchOutputCurve}
                  flowCurve={result.flowOutputCurve}
                  units={config.units}
                />
                <div mix={legendRowStyle}>
                  <span mix={legendBatchStyle}>■ Batch</span>
                  <span mix={legendFlowStyle}>■ Flow</span>
                  <span mix={legendNoteStyle}>
                    Flow ships its first unit at t = {result.flow.firstUnitTime.toFixed(1)}s; batch
                    waits until t = {result.batch.firstUnitTime.toFixed(1)}s.
                  </span>
                </div>
              </Panel>

              <Panel label="Drafting note" padding={18}>
                <div mix={noteStyle}>
                  Both lines use the same five stages. The only difference is whether each station
                  passes single units (flow) or whole batches (batch). The "right" batch size is a
                  joint optimum across setup, defects, and demand variability — there is no
                  universal answer. Crank setup up: batching wins on throughput. Crank defects up:
                  flow contains the damage. Push demand bursty: flow keeps up; batch falls behind.
                </div>
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
                <DraftingButton full onClick={reset}>
                  Reset
                </DraftingButton>
              </Panel>

              <Panel label="Knobs" padding={16}>
                <FieldSlider
                  label="Batch size"
                  unit="units"
                  value={config.batchSize}
                  min={1}
                  max={200}
                  step={1}
                  format={(v) => Math.round(v).toString()}
                  onChange={setBatchSize}
                />
                <FieldSlider
                  label="Setup time per stage"
                  unit="s"
                  value={avgSetup}
                  min={0}
                  max={60}
                  step={1}
                  format={(v) => v.toFixed(0)}
                  onChange={setSetupTime}
                />
                <FieldSlider
                  label="Defect rate per stage"
                  unit="%"
                  value={avgDefect * 100}
                  min={0}
                  max={20}
                  step={0.5}
                  format={(v) => v.toFixed(1)}
                  onChange={(v) => setDefectRate(v / 100)}
                />
                <FieldSlider
                  label="Defect correlation in batch"
                  value={config.defectCorrelation}
                  min={0}
                  max={1}
                  step={0.05}
                  format={(v) => v.toFixed(2)}
                  onChange={setDefectCorrelation}
                />
                <FieldSlider
                  label="Unit cost"
                  unit="$"
                  value={config.unitCost}
                  min={1}
                  max={200}
                  step={1}
                  format={(v) => v.toFixed(0)}
                  onChange={setUnitCost}
                />
              </Panel>

              <Panel label="Demand profile" padding={16}>
                <div mix={demandRowStyle}>
                  {DEMAND_OPTIONS.map((d) => (
                    <DraftingButton
                      key={`d-${d}`}
                      primary={config.demandProfile === d}
                      onClick={() => setDemand(d)}
                    >
                      {DEMAND_LABELS[d]}
                    </DraftingButton>
                  ))}
                </div>
              </Panel>

              <Panel label="Live readout" padding={16}>
                <Readout k="Batch size" v={`${config.batchSize}`} accent />
                <Readout k="Stages" v={String(config.stages.length)} />
                <Readout k="Units run" v={String(config.units)} />
                <Readout k="Demand" v={DEMAND_LABELS[config.demandProfile]} />
                <Readout k="Defect (combined)" v={`${(combinedDefect(config.stages) * 100).toFixed(1)}%`} />
              </Panel>
            </aside>
          </div>
        </article>
      )
    }
  },
)

function MetricColumn(
  handle: Handle<{
    title: string
    metrics: PipelineMetrics
    unitCost: number
    accent: string
  }>,
) {
  return () => {
    let { title, metrics, accent } = handle.props
    return (
      <div mix={metricCardStyle}>
        <div mix={metricCardHeaderStyle} style={{ color: accent }}>
          {title}
        </div>
        <MetricRow label="Lead time / unit" value={`${metrics.leadTime.toFixed(1)}`} unit="s" />
        <MetricRow
          label="First unit out"
          value={`${metrics.firstUnitTime.toFixed(1)}`}
          unit="s"
        />
        <MetricRow label="Throughput" value={metrics.throughput.toFixed(3)} unit="u/s" />
        <MetricRow label="WIP" value={String(Math.round(metrics.wip))} unit="units" />
        <MetricRow label="Capital tied up" value={`$${metrics.capitalTiedUp.toFixed(0)}`} unit="" />
        <MetricRow
          label="Setup overhead"
          value={`${(metrics.setupOverhead * 100).toFixed(0)}`}
          unit="%"
        />
        <MetricRow
          label="Defects discovered"
          value={metrics.defectsDiscovered.toFixed(1)}
          unit="units"
        />
        <MetricRow
          label="Defects shipped"
          value={metrics.defectsShipped.toFixed(2)}
          unit="units"
          warn
        />
      </div>
    )
  }
}

function MetricRow(
  handle: Handle<{ label: string; value: string; unit: string; warn?: boolean }>,
) {
  return () => {
    let { label, value, unit, warn } = handle.props
    return (
      <div mix={metricRowStyle}>
        <span mix={metricLabelStyle}>{label}</span>
        <span mix={warn ? metricValueWarnStyle : metricValueStyle}>
          {value}
          {unit && <span mix={metricUnitStyle}>{unit}</span>}
        </span>
      </div>
    )
  }
}

function PipelineDiagram(
  handle: Handle<{
    stages: StageConfig[]
    batchSize: number
    batchMetrics: PipelineMetrics
    flowMetrics: PipelineMetrics
  }>,
) {
  return () => {
    let { stages, batchSize, batchMetrics, flowMetrics } = handle.props
    return (
      <div mix={diagramWrapStyle}>
        <PipelineRow
          label="BATCH"
          stages={stages}
          fillCount={Math.min(8, Math.max(1, Math.round(batchSize / 8)))}
          accent={T.warn}
          subtitle={`Whole batch waits at each station · WIP ≈ ${Math.round(batchMetrics.wip)} units`}
        />
        <PipelineRow
          label="FLOW"
          stages={stages}
          fillCount={1}
          accent={T.accent}
          subtitle={`One unit per station · WIP ≈ ${Math.round(flowMetrics.wip)} units`}
        />
      </div>
    )
  }
}

function PipelineRow(
  handle: Handle<{
    label: string
    stages: StageConfig[]
    fillCount: number
    accent: string
    subtitle: string
  }>,
) {
  return () => {
    let { label, stages, fillCount, accent, subtitle } = handle.props
    return (
      <div mix={pipelineRowStyle}>
        <div mix={pipelineLabelColStyle}>
          <div mix={pipelineLabelStyle} style={{ color: accent }}>
            {label}
          </div>
          <div mix={pipelineSubtitleStyle}>{subtitle}</div>
        </div>
        <div mix={stationsRowStyle}>
          {stages.map((s, i) => (
            <div key={`stn-${label}-${i}`} mix={stationCellStyle}>
              <div mix={stationCellTitleStyle}>{s.name}</div>
              <div mix={cellStackStyle}>
                {Array.from({ length: 8 }).map((_, k) => {
                  let filled = k < fillCount
                  return (
                    <span
                      key={`fill-${label}-${i}-${k}`}
                      mix={cellPipStyle}
                      style={{ background: filled ? accent : 'transparent' }}
                    />
                  )
                })}
              </div>
              <div mix={stationMetaStyle}>
                {s.cycleTime.toFixed(1)}s · su {s.setupTime.toFixed(0)}s
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
}

function OutputChart(
  handle: Handle<{
    batchCurve: OutputSample[]
    flowCurve: OutputSample[]
    units: number
  }>,
) {
  return () => {
    let { batchCurve, flowCurve, units } = handle.props
    let lastT = Math.max(
      batchCurve[batchCurve.length - 1]?.t ?? 0,
      flowCurve[flowCurve.length - 1]?.t ?? 0,
    )
    let width = 720
    let height = 180
    let pad = 18

    let xScale = (t: number) =>
      pad + (lastT > 0 ? (t / lastT) * (width - pad * 2) : 0)
    let yScale = (v: number) =>
      height - pad - (units > 0 ? (v / units) * (height - pad * 2) : 0)

    function path(curve: OutputSample[]): string {
      if (curve.length === 0) return ''
      return curve
        .map(
          (p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.t).toFixed(1)} ${yScale(p.completed).toFixed(1)}`,
        )
        .join(' ')
    }

    return (
      <svg viewBox={`0 0 ${width} ${height}`} mix={chartSvgStyle}>
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke={T.ink} stroke-width="0.6" />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke={T.ink} stroke-width="0.6" />
        <text x={width - pad} y={height - 4} text-anchor="end" font-size="9" fill={T.ink} opacity="0.6">
          t = {lastT.toFixed(0)}s
        </text>
        <text x={pad + 4} y={pad + 4} font-size="9" fill={T.ink} opacity="0.6">
          {units} u
        </text>
        <path d={path(batchCurve)} fill="none" stroke={T.warn} stroke-width="2" />
        <path d={path(flowCurve)} fill="none" stroke={T.accent} stroke-width="2" />
      </svg>
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
        mix={[active ? presetActiveStyle : presetStyle, on('click', onClick)]}
      >
        <span mix={presetNameStyle}>{preset.name}</span>
        <span mix={presetDescStyle}>{preset.description}</span>
      </button>
    )
  }
}

function combinedDefect(stages: StageConfig[]): number {
  return 1 - stages.reduce((p, s) => p * (1 - s.defectRate), 1)
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
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

const diagramWrapStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
})

const pipelineRowStyle = css({
  display: 'grid',
  gridTemplateColumns: '120px minmax(0, 1fr)',
  gap: '12px',
  alignItems: 'stretch',
  '@media (max-width: 720px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
})

const pipelineLabelColStyle = css({
  borderRight: `1px dashed ${T.ink}`,
  padding: '4px 12px 4px 0',
  '@media (max-width: 720px)': { borderRight: 'none', borderBottom: `1px dashed ${T.ink}`, paddingBottom: '6px' },
})

const pipelineLabelStyle = css({
  fontSize: '14px',
  fontWeight: 700,
  letterSpacing: '0.18em',
})

const pipelineSubtitleStyle = css({
  fontSize: '10px',
  letterSpacing: '0.06em',
  opacity: 0.7,
  marginTop: '4px',
  lineHeight: 1.4,
})

const stationsRowStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: '0',
})

const stationCellStyle = css({
  border: `1px solid ${T.ink}`,
  marginRight: '-1px',
  padding: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  minWidth: 0,
})

const stationCellTitleStyle = css({
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.04em',
})

const cellStackStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
})

const cellPipStyle = css({
  display: 'block',
  height: '4px',
  border: `1px solid ${T.ink}`,
})

const stationMetaStyle = css({
  fontSize: '9px',
  letterSpacing: '0.06em',
  opacity: 0.65,
})

const metricsGridStyle = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '16px',
  '@media (max-width: 720px)': { gridTemplateColumns: '1fr' },
})

const metricCardStyle = css({
  border: `1px solid ${T.ink}`,
  background: T.panel,
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
})

const metricCardHeaderStyle = css({
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  borderBottom: `1px solid ${T.ink}`,
  paddingBottom: '6px',
  marginBottom: '4px',
})

const metricRowStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  fontSize: '11px',
  letterSpacing: '0.04em',
  padding: '4px 0',
  borderTop: `1px dashed ${T.ink}`,
  '&:nth-child(2)': { borderTop: 'none' },
})

const metricLabelStyle = css({
  opacity: 0.7,
  textTransform: 'uppercase',
})

const metricValueStyle = css({
  fontWeight: 700,
  color: T.ink,
  fontVariantNumeric: 'tabular-nums',
})

const metricValueWarnStyle = css({
  fontWeight: 700,
  color: T.accent,
  fontVariantNumeric: 'tabular-nums',
})

const metricUnitStyle = css({
  fontSize: '9px',
  fontWeight: 400,
  opacity: 0.6,
  marginLeft: '4px',
  letterSpacing: '0.1em',
})

const chartSvgStyle = css({
  width: '100%',
  display: 'block',
})

const legendRowStyle = css({
  display: 'flex',
  alignItems: 'baseline',
  gap: '14px',
  marginTop: '8px',
  fontSize: '10px',
  letterSpacing: '0.06em',
  flexWrap: 'wrap',
})

const legendBatchStyle = css({
  color: T.warn,
  fontWeight: 700,
})

const legendFlowStyle = css({
  color: T.accent,
  fontWeight: 700,
})

const legendNoteStyle = css({
  opacity: 0.7,
})

const presetGridStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  marginBottom: '8px',
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

const demandRowStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '6px',
})

const noteStyle = css({
  fontSize: '11px',
  lineHeight: 1.55,
})
