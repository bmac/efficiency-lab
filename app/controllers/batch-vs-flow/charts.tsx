import { css, type Handle } from 'remix/ui'

import { T } from '../../ui/shell.tsx'
import { formatSeconds } from './format.ts'

export function DualSeries(
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

export function LeadTimeHistogram(
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

function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return 0
  let sorted = [...values].sort((a, b) => a - b)
  let idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))
  return sorted[idx]
}

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
