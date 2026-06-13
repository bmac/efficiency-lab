import { css, type Handle } from 'remix/ui'

import { T } from '../../ui/shell.tsx'
import { formatMoney, formatUnits } from './format.ts'
import {
  learningExponent,
  type CurvePoint,
  type HistoricalSeries,
} from './learning.ts'

const W = 480
const H = 300
const PAD_L = 46
const PAD_R = 14
const PAD_T = 14
const PAD_B = 28

function plotX(frac: number): number {
  return PAD_L + frac * (W - PAD_L - PAD_R)
}
function plotY(frac: number): number {
  return PAD_T + (1 - frac) * (H - PAD_T - PAD_B)
}

function niceCeil(value: number): number {
  if (value <= 0) return 1
  let pow = Math.pow(10, Math.floor(Math.log10(value)))
  let n = value / pow
  let step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * pow
}

// ---------------------------------------------------------------------------
// Log-log: unit cost vs cumulative output. The straight line.
// ---------------------------------------------------------------------------

export function LogLogChart(
  handle: Handle<{ history: readonly CurvePoint[]; firstUnitCost: number }>,
) {
  return () => {
    let { history, firstUnitCost } = handle.props
    let last = history[history.length - 1]
    let maxN = Math.max(last?.n ?? 1, 10)
    let minCost = Math.min(...history.map((p) => p.cost), firstUnitCost)
    let xMax = Math.ceil(Math.log10(maxN))
    let yTop = Math.ceil(Math.log10(firstUnitCost))
    let yBot = Math.floor(Math.log10(Math.max(minCost, 1e-6)))
    let xSpan = Math.max(xMax, 1)
    let ySpan = Math.max(yTop - yBot, 1)

    let sx = (n: number) => plotX(Math.log10(Math.max(n, 1)) / xSpan)
    let sy = (c: number) => plotY((Math.log10(Math.max(c, 1e-9)) - yBot) / ySpan)

    let path = history
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.n).toFixed(1)} ${sy(p.cost).toFixed(1)}`)
      .join(' ')

    let xTicks = Array.from({ length: xMax + 1 }, (_, i) => i)
    let yTicks = Array.from({ length: yTop - yBot + 1 }, (_, i) => yBot + i)

    return (
      <ChartFrame
        title="Log-log · the straight line"
        caption="UNIT COST ↓ vs CUMULATIVE OUTPUT →"
      >
        <svg viewBox={`0 0 ${W} ${H}`} mix={svgStyle}>
          {yTicks.map((t) => (
            <g key={`yl-${t}`}>
              <line x1={PAD_L} y1={sy(10 ** t)} x2={W - PAD_R} y2={sy(10 ** t)} stroke={T.ink} stroke-width="0.4" opacity="0.18" />
              <text x={PAD_L - 6} y={sy(10 ** t) + 3} text-anchor="end" mix={tickStyle}>
                {formatMoney(10 ** t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <g key={`xl-${t}`}>
              <line x1={sx(10 ** t)} y1={PAD_T} x2={sx(10 ** t)} y2={H - PAD_B} stroke={T.ink} stroke-width="0.4" opacity="0.12" />
              <text x={sx(10 ** t)} y={H - PAD_B + 14} text-anchor="middle" mix={tickStyle}>
                {formatUnits(10 ** t)}
              </text>
            </g>
          ))}
          {history.length > 1 && <path d={path} fill="none" stroke={T.accent} stroke-width="2" />}
          {last && <circle cx={sx(last.n)} cy={sy(last.cost)} r="3.5" fill={T.accent} />}
        </svg>
      </ChartFrame>
    )
  }
}

// ---------------------------------------------------------------------------
// Linear-linear: same data, the asymptote illusion.
// ---------------------------------------------------------------------------

export function LinearChart(handle: Handle<{ history: readonly CurvePoint[] }>) {
  return () => {
    let { history } = handle.props
    let last = history[history.length - 1]
    let maxN = niceCeil(Math.max(last?.n ?? 1, 10))
    let maxCost = niceCeil(Math.max(...history.map((p) => p.cost), 1))

    let sx = (n: number) => plotX(n / maxN)
    let sy = (c: number) => plotY(c / maxCost)

    let path = history
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.n).toFixed(1)} ${sy(p.cost).toFixed(1)}`)
      .join(' ')

    let yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxCost)
    let xTicks = [0, 0.5, 1].map((f) => f * maxN)

    return (
      <ChartFrame
        title="Linear · the asymptote illusion"
        caption="The line that fools every business plan"
      >
        <svg viewBox={`0 0 ${W} ${H}`} mix={svgStyle}>
          {yTicks.map((t, i) => (
            <g key={`yn-${i}`}>
              <line x1={PAD_L} y1={sy(t)} x2={W - PAD_R} y2={sy(t)} stroke={T.ink} stroke-width="0.4" opacity="0.15" />
              <text x={PAD_L - 6} y={sy(t) + 3} text-anchor="end" mix={tickStyle}>
                {formatMoney(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text key={`xn-${i}`} x={sx(t)} y={H - PAD_B + 14} text-anchor="middle" mix={tickStyle}>
              {formatUnits(t)}
            </text>
          ))}
          {history.length > 1 && <path d={path} fill="none" stroke={T.ink} stroke-width="2" />}
          {last && <circle cx={sx(last.n)} cy={sy(last.cost)} r="3.5" fill={T.accent} />}
        </svg>
      </ChartFrame>
    )
  }
}

// ---------------------------------------------------------------------------
// Shape comparison: every curve normalised to cost 1.0 at its first unit, drawn
// against doublings of cumulative output. They are all the same family of line.
// ---------------------------------------------------------------------------

export function ShapeChart(
  handle: Handle<{
    history: readonly CurvePoint[]
    firstUnitCost: number
    learningRate: number
    series: readonly HistoricalSeries[]
    showHistorical: boolean
  }>,
) {
  return () => {
    let { history, firstUnitCost, learningRate, series, showHistorical } = handle.props
    let userDoublings = Math.log2(Math.max(history[history.length - 1]?.n ?? 1, 1))
    let maxDoublings = Math.max(
      userDoublings,
      ...(showHistorical ? series.map((s) => s.doublings) : []),
      8,
    )
    // Cost fraction floor across everything we draw, in log10 space.
    let minFraction = Math.min(
      Math.pow(learningRate, maxDoublings),
      ...(showHistorical ? series.map((s) => Math.pow(s.learningRate, s.doublings)) : [1]),
      Math.pow(learningRate, userDoublings),
    )
    let yBot = Math.floor(Math.log10(Math.max(minFraction, 1e-6)))

    let sx = (d: number) => plotX(d / Math.max(maxDoublings, 1))
    let sy = (frac: number) => plotY((Math.log10(Math.max(frac, 1e-9)) - yBot) / Math.max(-yBot, 1))

    function straightLine(lr: number, doublings: number): string {
      let b = learningExponent(lr)
      // log10(fraction) = b·log2(2^d) — sample a few points so the SVG line is exact.
      return [0, doublings]
        .map((d, i) => `${i === 0 ? 'M' : 'L'} ${sx(d).toFixed(1)} ${sy(Math.pow(2, b * d)).toFixed(1)}`)
        .join(' ')
    }

    let userPath = history
      .map((p, i) => {
        let d = Math.log2(Math.max(p.n, 1))
        return `${i === 0 ? 'M' : 'L'} ${sx(d).toFixed(1)} ${sy(p.cost / firstUnitCost).toFixed(1)}`
      })
      .join(' ')

    let yTicks = Array.from({ length: -yBot + 1 }, (_, i) => yBot + i)

    return (
      <ChartFrame
        title="Same shape, every industry"
        caption="COST (fraction of first unit) ↓ vs DOUBLINGS →"
      >
        <svg viewBox={`0 0 ${W} ${H}`} mix={svgStyle}>
          {yTicks.map((t) => (
            <g key={`ys-${t}`}>
              <line x1={PAD_L} y1={sy(10 ** t)} x2={W - PAD_R} y2={sy(10 ** t)} stroke={T.ink} stroke-width="0.4" opacity="0.15" />
              <text x={PAD_L - 6} y={sy(10 ** t) + 3} text-anchor="end" mix={tickStyle}>
                {t === 0 ? '1×' : `10^${t}`}
              </text>
            </g>
          ))}
          {Array.from({ length: Math.floor(maxDoublings) + 1 }, (_, d) => (
            <text key={`xs-${d}`} x={sx(d)} y={H - PAD_B + 14} text-anchor="middle" mix={tickStyle}>
              {d}
            </text>
          ))}
          {showHistorical &&
            series.map((s) => (
              <path
                key={`h-${s.id}`}
                d={straightLine(s.learningRate, s.doublings)}
                fill="none"
                stroke={T.ink}
                stroke-width="1.1"
                stroke-dasharray="4 3"
                opacity="0.45"
              />
            ))}
          {history.length > 1 && <path d={userPath} fill="none" stroke={T.accent} stroke-width="2" />}
        </svg>
        {showHistorical && (
          <div mix={legendStyle}>
            {series.map((s) => (
              <span key={`lg-${s.id}`} mix={legendItemStyle}>
                <span mix={legendDashStyle} /> {s.label} · {Math.round(s.learningRate * 100)}%
              </span>
            ))}
            <span mix={legendItemStyle}>
              <span mix={legendSolidStyle} /> Your run · {Math.round(learningRate * 100)}%
            </span>
          </div>
        )}
      </ChartFrame>
    )
  }
}

// ---------------------------------------------------------------------------

function ChartFrame(handle: Handle<{ title: string; caption: string; children?: unknown }>) {
  return () => {
    let { title, caption, children } = handle.props
    return (
      <div mix={frameStyle}>
        <div mix={frameHeadStyle}>
          <span mix={frameTitleStyle}>{title}</span>
          <span mix={frameCaptionStyle}>{caption}</span>
        </div>
        {children as never}
      </div>
    )
  }
}

const frameStyle = css({ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 })

const frameHeadStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
})

const frameTitleStyle = css({
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
})

const frameCaptionStyle = css({
  fontSize: '9px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  opacity: 0.6,
})

const svgStyle = css({ display: 'block', width: '100%', height: 'auto', overflow: 'visible' })

const tickStyle = css({
  fontSize: '8px',
  fontFamily: 'inherit',
  fill: T.ink,
  opacity: 0.6,
  letterSpacing: '0.04em',
})

const legendStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  fontSize: '9px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  opacity: 0.8,
})

const legendItemStyle = css({ display: 'flex', alignItems: 'center', gap: '5px' })

const legendDashBase = {
  display: 'inline-block',
  width: '14px',
  height: '0',
  verticalAlign: 'middle',
} as const

const legendDashStyle = css({ ...legendDashBase, borderTop: `1.5px dashed ${T.ink}`, opacity: 0.6 })
const legendSolidStyle = css({ ...legendDashBase, borderTop: `2px solid ${T.accent}` })
