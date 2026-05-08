import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

import { DraftingButton, FieldSlider, Panel, Readout, SheetHeader, T } from '../../ui/shell.tsx'
import {
  BatchVsFlowLab as Simulator,
  DEFAULT_LAB_CONFIG,
  type DemandProfile,
  type PipelineSnapshot,
  type StageSnapshot,
} from './pipeline.ts'

interface BatchVsFlowLabProps extends SerializableProps {}

const SPEED_OPTIONS = [1, 4, 16, 64] as const
type Speed = (typeof SPEED_OPTIONS)[number]

const DEMAND_OPTIONS: { id: DemandProfile; label: string; hint: string }[] = [
  { id: 'steady', label: 'Steady', hint: 'Constant arrivals' },
  { id: 'bursty', label: 'Bursty', hint: '60s cycle, 3× spikes' },
  { id: 'declining', label: 'Declining', hint: 'Demand decays over 10 min' },
]

const PHASE_LABEL = { idle: 'IDLE', setup: 'SETUP', processing: 'WORK' }
const PHASE_COLOR = { idle: T.inkFaint, setup: T.warn, processing: T.accent }

export const BatchVsFlowLab = clientEntry(
  '/assets/app/controllers/batch-vs-flow/lab.tsx#BatchVsFlowLab',
  function BatchVsFlowLab(handle: Handle<BatchVsFlowLabProps>) {
    let sim = new Simulator(DEFAULT_LAB_CONFIG)
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
      sim = new Simulator({ ...sim.config, seed: sim.config.seed + 1 })
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
                  the bottom. Crank setup up: large batches start to win on throughput. Crank it
                  to zero: flow always wins. The right batch size depends on setup, defects, and
                  demand variability — there is no universal answer.
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
// Pipeline visualization
// -------------------------------------------------------------------------

function PipelineDiagram(handle: Handle<{ pipeline: PipelineSnapshot; modeLabel: string }>) {
  return () => {
    let { pipeline, modeLabel } = handle.props
    return (
      <div mix={pipelineWrapStyle}>
        <div mix={pipelineHeaderStyle}>
          <span>{modeLabel}</span>
          <span>
            WIP {pipeline.wip} · OUT {pipeline.completedCount}
          </span>
        </div>
        <div mix={lineRowStyle}>
          {pipeline.stages.map((s, i) => (
            <StageCard
              key={`stage-${i}`}
              stage={s}
              index={i}
              isLast={i === pipeline.stages.length - 1}
            />
          ))}
          <div mix={outArrowStyle}>→ out</div>
        </div>
      </div>
    )
  }
}

function StageCard(handle: Handle<{ stage: StageSnapshot; index: number; isLast: boolean }>) {
  return () => {
    let { stage, index } = handle.props
    return (
      <div mix={stationCardStyle}>
        <div mix={stationTopRowStyle}>
          <span mix={stationCodeStyle}>STG.{String(index + 1).padStart(2, '0')}</span>
          {index > 0 && <QueueChip batches={stage.queueBatches} units={stage.queueUnits} />}
        </div>
        <div mix={stationNameStyle}>{stage.name}</div>
        <div
          mix={stationPhaseStyle}
          style={{ color: PHASE_COLOR[stage.phase], borderColor: PHASE_COLOR[stage.phase] }}
        >
          {PHASE_LABEL[stage.phase]}
          {stage.currentSize > 0 ? ` · ${stage.currentSize}u` : ''}
        </div>
        <div mix={progressTrackStyle}>
          <div
            mix={progressFillStyle}
            style={{
              width: `${Math.round(stage.progress * 100)}%`,
              background: PHASE_COLOR[stage.phase],
            }}
          />
        </div>
        <BatchPile size={stage.currentSize} />
      </div>
    )
  }
}

function QueueChip(handle: Handle<{ batches: number; units: number }>) {
  return () => {
    let { batches, units } = handle.props
    if (batches === 0) return <span mix={queueChipEmptyStyle}>·</span>
    return (
      <span mix={queueChipStyle}>
        ← {batches}b / {units}u
      </span>
    )
  }
}

const PILE_MAX = 24

function BatchPile(handle: Handle<{ size: number }>) {
  return () => {
    let { size } = handle.props
    let shown = Math.min(size, PILE_MAX)
    let cells = []
    for (let i = 0; i < shown; i++) {
      cells.push(<span key={`u-${i}`} mix={pileCellStyle} />)
    }
    return (
      <div mix={pileWrapStyle}>
        <div mix={pileGridStyle}>{cells}</div>
        {size > PILE_MAX && <div mix={pileMoreStyle}>+{size - PILE_MAX}</div>}
      </div>
    )
  }
}

// -------------------------------------------------------------------------
// Metrics column
// -------------------------------------------------------------------------

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
        <Readout k="Defects discovered" v={snapshot.defectsDiscovered.toString()} />
        <Readout k="Setup time" v={`${(snapshot.setupFraction * 100).toFixed(0)}%`} />
      </div>
    )
  }
}

// -------------------------------------------------------------------------
// Charts
// -------------------------------------------------------------------------

function DualSeries(
  handle: Handle<{
    windowSeconds: number
    batchSeries: readonly { t: number; value: number }[]
    flowSeries: readonly { t: number; value: number }[]
    unit: string
    format: (value: number) => string
  }>,
) {
  return () => {
    let { batchSeries, flowSeries, windowSeconds, unit, format } = handle.props
    let width = 720
    let height = 110
    let pad = 8

    let lastB = batchSeries[batchSeries.length - 1]
    let lastF = flowSeries[flowSeries.length - 1]
    let endT = Math.max(lastB?.t ?? 0, lastF?.t ?? 0)
    let startT = Math.max(0, endT - windowSeconds)

    let visB = batchSeries.filter((p) => p.t >= startT)
    let visF = flowSeries.filter((p) => p.t >= startT)

    let allValues = [...visB.map((p) => p.value), ...visF.map((p) => p.value), 0]
    let maxV = Math.max(...allValues, 1)

    function xScale(t: number): number {
      return pad + ((t - startT) / Math.max(windowSeconds, 1e-9)) * (width - pad * 2)
    }
    function yScale(v: number): number {
      return height - pad - (v / maxV) * (height - pad * 2)
    }
    function path(series: readonly { t: number; value: number }[]): string {
      return series
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.t).toFixed(1)} ${yScale(p.value).toFixed(1)}`)
        .join(' ')
    }

    return (
      <div mix={chartWrapStyle}>
        <div mix={chartLegendStyle}>
          <span>
            <span mix={legendSwatchAccentStyle} /> Batch · {format(lastB?.value ?? 0)} {unit}
          </span>
          <span>
            <span mix={legendSwatchInkStyle} /> Flow · {format(lastF?.value ?? 0)} {unit}
          </span>
          <span mix={chartAxisLabelStyle}>last {windowSeconds}s</span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} mix={chartSvgStyle}>
          <line
            x1={pad}
            y1={height - pad}
            x2={width - pad}
            y2={height - pad}
            stroke={T.ink}
            stroke-width="0.6"
            opacity="0.4"
          />
          {visF.length > 0 && (
            <path d={path(visF)} stroke={T.ink} stroke-width="1.6" fill="none" />
          )}
          {visB.length > 0 && (
            <path d={path(visB)} stroke={T.accent} stroke-width="1.8" fill="none" />
          )}
        </svg>
      </div>
    )
  }
}

function LeadTimeHistogram(
  handle: Handle<{ label: string; leadTimes: readonly number[]; color: string }>,
) {
  return () => {
    let { label, leadTimes, color } = handle.props
    let width = 360
    let height = 110
    let pad = 8
    let buckets = 24

    if (leadTimes.length === 0) {
      return (
        <div mix={histCardStyle}>
          <div mix={histTitleStyle}>{label}</div>
          <div mix={histEmptyStyle}>no completions yet</div>
        </div>
      )
    }

    let maxT = Math.max(...leadTimes, 1)
    let bucketSize = maxT / buckets
    let counts = new Array(buckets).fill(0)
    for (let t of leadTimes) {
      let idx = Math.min(buckets - 1, Math.floor(t / bucketSize))
      counts[idx]++
    }
    let maxCount = Math.max(...counts, 1)
    let barW = (width - pad * 2) / buckets
    let mean = leadTimes.reduce((s, v) => s + v, 0) / leadTimes.length
    let p95 = quantile(leadTimes, 0.95)

    return (
      <div mix={histCardStyle}>
        <div mix={histTitleRowStyle}>
          <span mix={histTitleStyle}>{label}</span>
          <span mix={histStatStyle}>
            μ {formatSeconds(mean)} · p95 {formatSeconds(p95)}
          </span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} mix={chartSvgStyle}>
          {counts.map((c, i) => {
            let h = (c / maxCount) * (height - pad * 2)
            return (
              <rect
                key={`b-${i}`}
                x={pad + i * barW}
                y={height - pad - h}
                width={Math.max(1, barW - 1)}
                height={h}
                fill={color}
                opacity="0.85"
              />
            )
          })}
        </svg>
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

function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return 0
  let sorted = [...values].sort((a, b) => a - b)
  let idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))
  return sorted[idx]
}

function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s'
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  let m = Math.floor(seconds / 60)
  let s = Math.round(seconds - m * 60)
  return `${m}m${s.toString().padStart(2, '0')}s`
}

function theoreticalBatchLead(config: {
  stageCount: number
  setupTime: number
  cycleTime: number
  batchSize: number
}): number {
  return config.stageCount * (config.setupTime + config.batchSize * config.cycleTime)
}

function theoreticalFlowLead(config: {
  stageCount: number
  setupTime: number
  cycleTime: number
}): number {
  return config.stageCount * (config.setupTime + config.cycleTime)
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

const pipelineWrapStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
})

const pipelineHeaderStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '10px',
  letterSpacing: '0.14em',
  fontWeight: 700,
  textTransform: 'uppercase',
  opacity: 0.85,
})

const lineRowStyle = css({
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
  padding: '10px',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  minWidth: '120px',
})

const stationTopRowStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '6px',
})

const stationCodeStyle = css({
  fontSize: '9px',
  letterSpacing: '0.14em',
  opacity: 0.7,
})

const stationNameStyle = css({
  fontSize: '13px',
  fontWeight: 700,
  letterSpacing: '0.02em',
})

const stationPhaseStyle = css({
  display: 'inline-block',
  alignSelf: 'flex-start',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.14em',
  padding: '2px 6px',
  border: '1px solid currentColor',
  borderRadius: '0',
  marginTop: '2px',
})

const progressTrackStyle = css({
  marginTop: '4px',
  height: '4px',
  border: `1px solid ${T.ink}`,
})

const progressFillStyle = css({
  height: '100%',
  transition: 'width 80ms linear',
})

const queueChipStyle = css({
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  padding: '2px 5px',
  border: `1px solid ${T.warn}`,
  color: T.warn,
  background: 'rgba(181,138,22,0.12)',
})

const queueChipEmptyStyle = css({
  fontSize: '12px',
  opacity: 0.3,
})

const pileWrapStyle = css({
  marginTop: '4px',
  minHeight: '24px',
  display: 'flex',
  alignItems: 'flex-end',
  gap: '4px',
})

const pileGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(8, 6px)',
  gap: '1px',
})

const pileCellStyle = css({
  display: 'block',
  width: '6px',
  height: '6px',
  background: T.ink,
})

const pileMoreStyle = css({
  fontSize: '9px',
  fontWeight: 700,
  opacity: 0.7,
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
  opacity: 0.8,
})

const chartAxisLabelStyle = css({
  marginLeft: 'auto',
  opacity: 0.6,
})

const legendSwatchBase = {
  display: 'inline-block',
  width: '10px',
  height: '2px',
  marginRight: '5px',
  verticalAlign: 'middle',
} as const

const legendSwatchAccentStyle = css({ ...legendSwatchBase, background: T.accent })
const legendSwatchInkStyle = css({ ...legendSwatchBase, background: T.ink })

const chartSvgStyle = css({
  display: 'block',
  width: '100%',
  height: 'auto',
})

const histRowStyle = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
  '@media (max-width: 720px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
})

const histCardStyle = css({
  border: `1px solid ${T.ink}`,
  background: T.panel,
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
})

const histTitleRowStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
})

const histTitleStyle = css({
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  opacity: 0.8,
})

const histStatStyle = css({
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: T.accent,
})

const histEmptyStyle = css({
  height: '110px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '10px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  opacity: 0.5,
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

const noteStyle = css({
  fontSize: '11px',
  lineHeight: 1.55,
})
