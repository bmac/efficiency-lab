import { css, type Handle } from 'remix/ui'

import { T } from '../../ui/shell.tsx'
import type { PipelineSnapshot, StageSnapshot } from './pipeline.ts'

const PHASE_LABEL = { idle: 'IDLE', setup: 'SETUP', processing: 'WORK' }
const PHASE_COLOR = { idle: T.inkFaint, setup: T.warn, processing: T.accent }

const PILE_MAX = 24

export function PipelineDiagram(
  handle: Handle<{ pipeline: PipelineSnapshot; modeLabel: string }>,
) {
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
          <QueueChip batches={stage.queueBatches} units={stage.queueUnits} />
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
        <BatchPile current={stage.currentSize} queued={stage.queueUnits} />
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

// Solid cells are units on the machine; faint cells are units queued in
// front of it. Together they account for all WIP at the station, so the
// piles visually sum to the WIP readout in the header.
function BatchPile(handle: Handle<{ current: number; queued: number }>) {
  return () => {
    let { current, queued } = handle.props
    let size = current + queued
    let shown = Math.min(size, PILE_MAX)
    let cells = []
    for (let i = 0; i < shown; i++) {
      cells.push(<span key={`u-${i}`} mix={i < current ? pileCellStyle : pileCellQueuedStyle} />)
    }
    return (
      <div mix={pileWrapStyle}>
        <div mix={pileGridStyle}>{cells}</div>
        {size > PILE_MAX && <div mix={pileMoreStyle}>+{size - PILE_MAX}</div>}
      </div>
    )
  }
}

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

const pileCellQueuedStyle = css({
  display: 'block',
  width: '6px',
  height: '6px',
  background: T.ink,
  opacity: 0.3,
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
