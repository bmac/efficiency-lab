import { css, type Handle } from 'remix/ui'

import { T } from '../../ui/shell.tsx'
import type { YearRecord } from './mill.ts'

export interface PriceChartProps {
  history: readonly YearRecord[]
  startYear: number
  endYear: number
}

// Two-line chart: market price/ton (exogenous, falling) vs the player's
// cost/ton. The gap between the two is the per-ton margin.
export function PriceChart(handle: Handle<PriceChartProps>) {
  return () => {
    let { history, startYear, endYear } = handle.props
    let width = 720
    let height = 200
    let pad = 28

    let allValues = history.flatMap((h) => [h.marketPrice, h.costPerTon])
    let maxV = Math.max(220, ...allValues)
    let minV = 0

    function xScale(year: number): number {
      let span = Math.max(1, endYear - startYear)
      return pad + ((year - startYear) / span) * (width - pad * 2)
    }
    function yScale(v: number): number {
      let span = Math.max(1, maxV - minV)
      return height - pad - ((v - minV) / span) * (height - pad * 2)
    }

    function path(getter: (h: YearRecord) => number): string {
      return history
        .map((h, i) => `${i === 0 ? 'M' : 'L'} ${xScale(h.year).toFixed(1)} ${yScale(getter(h)).toFixed(1)}`)
        .join(' ')
    }

    let last = history[history.length - 1]
    let yearTicks: number[] = []
    for (let y = Math.ceil(startYear / 10) * 10; y <= endYear; y += 10) yearTicks.push(y)

    return (
      <div mix={chartWrapStyle}>
        <div mix={chartLegendStyle}>
          <span>
            <span mix={legendSwatchInkStyle} /> Market price · ${last ? last.marketPrice.toFixed(0) : '—'}
            /ton
          </span>
          <span>
            <span mix={legendSwatchAccentStyle} /> Your cost · ${last ? last.costPerTon.toFixed(0) : '—'}
            /ton
          </span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} mix={chartSvgStyle}>
          {[50, 100, 150, 200].map((g) => (
            <g key={`g-${g}`}>
              <line
                x1={pad}
                y1={yScale(g)}
                x2={width - pad}
                y2={yScale(g)}
                stroke={T.ink}
                stroke-width="0.4"
                opacity="0.18"
              />
              <text
                x={pad - 4}
                y={yScale(g) + 3}
                font-size="9"
                font-family="IBM Plex Mono"
                fill={T.ink}
                opacity="0.6"
                text-anchor="end"
              >
                ${g}
              </text>
            </g>
          ))}
          {yearTicks.map((y) => (
            <g key={`ty-${y}`}>
              <line
                x1={xScale(y)}
                y1={pad}
                x2={xScale(y)}
                y2={height - pad}
                stroke={T.ink}
                stroke-width="0.3"
                opacity="0.15"
              />
              <text
                x={xScale(y)}
                y={height - 8}
                font-size="9"
                font-family="IBM Plex Mono"
                fill={T.ink}
                opacity="0.6"
                text-anchor="middle"
              >
                {y}
              </text>
            </g>
          ))}
          <path d={path((h) => h.marketPrice)} stroke={T.ink} stroke-width="1.4" fill="none" />
          <path d={path((h) => h.costPerTon)} stroke={T.accent} stroke-width="1.8" fill="none" />
        </svg>
      </div>
    )
  }
}

export interface ProfitChartProps {
  history: readonly YearRecord[]
  competitors: readonly { name: string; history: readonly YearRecord[] }[]
  startYear: number
  endYear: number
  bankruptcyThreshold: number
  initialCash: number
}

// Cumulative cash over time, with the bankruptcy threshold drawn as a red
// floor. The competitor strip is plotted in lighter strokes.
export function ProfitChart(handle: Handle<ProfitChartProps>) {
  return () => {
    let { history, competitors, startYear, endYear, bankruptcyThreshold, initialCash } =
      handle.props
    let width = 720
    let height = 200
    let pad = 36

    let cashSeries = (h: readonly YearRecord[]) => {
      let arr: { year: number; cash: number }[] = []
      let cash = initialCash
      for (let r of h) {
        cash = r.cash
        arr.push({ year: r.year, cash })
      }
      return arr
    }

    let me = cashSeries(history)
    let ghosts = competitors.map((c) => ({ name: c.name, series: cashSeries(c.history) }))

    let allCash = [
      bankruptcyThreshold,
      initialCash,
      ...me.map((p) => p.cash),
      ...ghosts.flatMap((g) => g.series.map((p) => p.cash)),
    ]
    let maxV = Math.max(...allCash)
    let minV = Math.min(...allCash)
    if (maxV === minV) maxV = minV + 1

    function xScale(year: number): number {
      let span = Math.max(1, endYear - startYear)
      return pad + ((year - startYear) / span) * (width - pad * 2)
    }
    function yScale(v: number): number {
      let span = Math.max(1, maxV - minV)
      return height - pad - ((v - minV) / span) * (height - pad * 2)
    }

    function path(series: { year: number; cash: number }[]): string {
      return series
        .map(
          (p, i) =>
            `${i === 0 ? 'M' : 'L'} ${xScale(p.year).toFixed(1)} ${yScale(p.cash).toFixed(1)}`,
        )
        .join(' ')
    }

    let last = me[me.length - 1]
    let yearTicks: number[] = []
    for (let y = Math.ceil(startYear / 10) * 10; y <= endYear; y += 10) yearTicks.push(y)

    let ghostColors = ['#314b62', '#7c5b1c', '#3d6a3a']

    return (
      <div mix={chartWrapStyle}>
        <div mix={chartLegendStyle}>
          <span>
            <span mix={legendSwatchAccentStyle} /> You · $
            {last ? Math.round(last.cash).toLocaleString() : '—'}
          </span>
          {ghosts.map((g, i) => (
            <span key={`leg-${i}`}>
              <span
                mix={legendSwatchSmallStyle}
                style={{ background: ghostColors[i % ghostColors.length] }}
              />{' '}
              {g.name}
            </span>
          ))}
          <span mix={chartAxisLabelStyle}>cumulative cash</span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} mix={chartSvgStyle}>
          {/* zero line */}
          <line
            x1={pad}
            y1={yScale(0)}
            x2={width - pad}
            y2={yScale(0)}
            stroke={T.ink}
            stroke-width="0.4"
            opacity="0.4"
          />
          {/* bankruptcy threshold */}
          <line
            x1={pad}
            y1={yScale(bankruptcyThreshold)}
            x2={width - pad}
            y2={yScale(bankruptcyThreshold)}
            stroke={T.accent}
            stroke-width="1"
            stroke-dasharray="4 3"
          />
          <text
            x={pad + 4}
            y={yScale(bankruptcyThreshold) - 3}
            font-size="9"
            font-family="IBM Plex Mono"
            fill={T.accent}
          >
            BANKRUPTCY
          </text>
          {yearTicks.map((y) => (
            <g key={`tt-${y}`}>
              <line
                x1={xScale(y)}
                y1={pad}
                x2={xScale(y)}
                y2={height - pad}
                stroke={T.ink}
                stroke-width="0.3"
                opacity="0.15"
              />
              <text
                x={xScale(y)}
                y={height - 8}
                font-size="9"
                font-family="IBM Plex Mono"
                fill={T.ink}
                opacity="0.6"
                text-anchor="middle"
              >
                {y}
              </text>
            </g>
          ))}
          {ghosts.map((g, i) => (
            <path
              key={`gh-${i}`}
              d={path(g.series)}
              stroke={ghostColors[i % ghostColors.length]}
              stroke-width="1"
              stroke-dasharray="2 2"
              fill="none"
              opacity="0.65"
            />
          ))}
          {me.length > 0 && (
            <path d={path(me)} stroke={T.accent} stroke-width="2" fill="none" />
          )}
        </svg>
      </div>
    )
  }
}

const chartWrapStyle = css({ width: '100%' })

const chartSvgStyle = css({
  width: '100%',
  height: 'auto',
  display: 'block',
})

const chartLegendStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '14px',
  fontSize: '10px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  marginBottom: '8px',
  alignItems: 'center',
})

const legendSwatchAccentStyle = css({
  display: 'inline-block',
  width: '10px',
  height: '10px',
  background: T.accent,
  marginRight: '4px',
  verticalAlign: 'middle',
})

const legendSwatchInkStyle = css({
  display: 'inline-block',
  width: '10px',
  height: '10px',
  background: T.ink,
  marginRight: '4px',
  verticalAlign: 'middle',
})

const legendSwatchSmallStyle = css({
  display: 'inline-block',
  width: '10px',
  height: '4px',
  marginRight: '4px',
  verticalAlign: 'middle',
})

const chartAxisLabelStyle = css({
  marginLeft: 'auto',
  opacity: 0.6,
})
