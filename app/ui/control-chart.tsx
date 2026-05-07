import { css, type Handle } from 'remix/ui'

import { T } from './shell.tsx'

export interface ChartZone {
  // Inner edge of the zone (closer to CL).
  inner: number
  // Outer edge of the zone (further from CL).
  outer: number
  // Optional zone label (e.g., "1σ"). Drawn at the right edge if provided.
  label?: string
}

export interface PointFlag {
  color: string
  // One-line summary shown in the SVG <title> hover tooltip.
  tooltip: string
}

export interface ControlChartProps {
  title: string
  points: readonly number[]
  cl: number
  ucl: number
  lcl: number
  yLabel?: string
  width?: number
  height?: number
  yMin?: number
  yMax?: number
  // Optional 1σ/2σ zone bands (drawn as dashed lines, lighter than control limits).
  zones?: readonly ChartZone[]
  // Optional vertical separator at this x-index (for splitting baseline vs. live points).
  baselineCutoff?: number
  // Optional flag per point. Index aligns with `points`. Undefined = no flag.
  flags?: readonly (PointFlag | undefined)[]
  // Optional tooltip text per point (overrides default).
  pointTooltips?: readonly string[]
  // Label for the x-axis tick marks (e.g., "Round" or "Subgroup"). Defaults to no prefix.
  xLabel?: string
}

export function ControlChart(handle: Handle<ControlChartProps>) {
  return () => {
    let { title, points, cl, ucl, lcl, yLabel, zones, baselineCutoff, flags, pointTooltips, xLabel } =
      handle.props
    let width = handle.props.width ?? 640
    let height = handle.props.height ?? 220
    let pad = { top: 32, right: 80, bottom: 28, left: 48 }
    let plotW = width - pad.left - pad.right
    let plotH = height - pad.top - pad.bottom

    let allValues: number[] = [...points]
    if (Number.isFinite(ucl)) allValues.push(ucl)
    if (Number.isFinite(cl)) allValues.push(cl)
    if (Number.isFinite(lcl)) allValues.push(lcl)
    if (zones) {
      for (let z of zones) {
        allValues.push(z.inner, z.outer)
      }
    }
    let dataMin = allValues.length ? Math.min(...allValues) : 0
    let dataMax = allValues.length ? Math.max(...allValues) : 1
    let span = dataMax - dataMin
    let lo = handle.props.yMin ?? Math.min(0, dataMin - span * 0.1)
    let hi = handle.props.yMax ?? dataMax + span * 0.1
    if (hi - lo < 1e-9) hi = lo + 1

    let yScale = (v: number) => pad.top + plotH - ((v - lo) / (hi - lo)) * plotH
    let xScale = (i: number) => {
      if (points.length <= 1) return pad.left + plotW / 2
      return pad.left + (i / (points.length - 1)) * plotW
    }

    let pathD = points.length
      ? points
          .map(
            (v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(v).toFixed(1)}`,
          )
          .join(' ')
      : ''

    let yTicks: number[] = []
    let stepCount = 4
    for (let i = 0; i <= stepCount; i++) yTicks.push(lo + (hi - lo) * (i / stepCount))

    // Compact x-axis labels: at most ~10 ticks for readability.
    let xTickStride = Math.max(1, Math.ceil(points.length / 12))

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        mix={css({
          display: 'block',
          maxWidth: `${width}px`,
          background: 'transparent',
        })}
      >
        <text x={pad.left} y={20} font-size="11" fill={T.ink} font-weight="700" letter-spacing="0.06em">
          {title.toUpperCase()}
        </text>

        {yTicks.map((t) => (
          <g key={`tick-${t.toFixed(4)}`}>
            <line
              x1={pad.left}
              y1={yScale(t)}
              x2={pad.left + plotW}
              y2={yScale(t)}
              stroke={T.ink}
              stroke-opacity="0.14"
              stroke-width="0.4"
            />
            <text
              x={pad.left - 6}
              y={yScale(t) + 4}
              font-size="10"
              text-anchor="end"
              fill={T.ink}
              opacity="0.7"
            >
              {t.toFixed(1)}
            </text>
          </g>
        ))}

        {zones?.map((z, zi) => (
          <g key={`zone-${zi}`}>
            <line
              x1={pad.left}
              y1={yScale(z.outer)}
              x2={pad.left + plotW}
              y2={yScale(z.outer)}
              stroke={T.ink}
              stroke-dasharray="2 4"
              stroke-opacity="0.45"
              stroke-width="0.6"
            />
            {z.label && (
              <text
                x={pad.left + plotW + 6}
                y={yScale(z.outer) + 3}
                font-size="10"
                fill={T.ink}
                opacity="0.7"
              >
                {z.label}
              </text>
            )}
          </g>
        ))}

        <line
          x1={pad.left}
          y1={yScale(ucl)}
          x2={pad.left + plotW}
          y2={yScale(ucl)}
          stroke={T.accent}
          stroke-dasharray="6 3"
          stroke-width="0.9"
        />
        <text x={pad.left + plotW + 6} y={yScale(ucl) + 3} font-size="10" fill={T.accent} font-weight="700">
          UCL {ucl.toFixed(2)}
        </text>

        <line
          x1={pad.left}
          y1={yScale(cl)}
          x2={pad.left + plotW}
          y2={yScale(cl)}
          stroke={T.ink}
          stroke-opacity="0.8"
          stroke-width="0.7"
        />
        <text x={pad.left + plotW + 6} y={yScale(cl) + 3} font-size="10" fill={T.ink} opacity="0.8">
          CL {cl.toFixed(2)}
        </text>

        <line
          x1={pad.left}
          y1={yScale(lcl)}
          x2={pad.left + plotW}
          y2={yScale(lcl)}
          stroke={T.accent}
          stroke-dasharray="6 3"
          stroke-width="0.9"
        />
        <text x={pad.left + plotW + 6} y={yScale(lcl) + 3} font-size="10" fill={T.accent} font-weight="700">
          LCL {lcl.toFixed(2)}
        </text>

        {baselineCutoff != null && baselineCutoff > 0 && baselineCutoff < points.length && (
          <line
            x1={xScale(baselineCutoff - 0.5)}
            y1={pad.top}
            x2={xScale(baselineCutoff - 0.5)}
            y2={pad.top + plotH}
            stroke={T.ink}
            stroke-dasharray="2 3"
            stroke-opacity="0.4"
          />
        )}

        {pathD && <path d={pathD} stroke={T.ink} stroke-width="1.2" fill="none" />}
        {points.map((v, i) => {
          let flag = flags?.[i]
          let outOfControl = v > ucl + 1e-9 || v < lcl - 1e-9
          let fill = flag?.color ?? (outOfControl ? T.accent : T.accent)
          let tooltip =
            pointTooltips?.[i] ??
            `${xLabel ?? '#'} ${i + 1}: ${v.toFixed(2)}${flag ? ` — ${flag.tooltip}` : ''}`
          let size = flag || outOfControl ? 4 : 3
          return (
            <g key={`pt-${i}`}>
              <rect
                x={xScale(i) - size}
                y={yScale(v) - size}
                width={size * 2}
                height={size * 2}
                fill={fill}
                stroke={T.ink}
                stroke-width="0.6"
              />
              {(flag || outOfControl) && (
                <circle
                  cx={xScale(i)}
                  cy={yScale(v)}
                  r="9"
                  fill="none"
                  stroke={flag?.color ?? T.accent}
                  stroke-width="1.2"
                />
              )}
              <title>{tooltip}</title>
            </g>
          )
        })}

        {points.map((_, i) => {
          if (i % xTickStride !== 0 && i !== points.length - 1) return null
          return (
            <text
              key={`xl-${i}`}
              x={xScale(i)}
              y={pad.top + plotH + 14}
              font-size="10"
              text-anchor="middle"
              fill={T.ink}
              opacity="0.7"
            >
              {i + 1}
            </text>
          )
        })}

        {yLabel && (
          <text
            x={12}
            y={pad.top + plotH / 2}
            transform={`rotate(-90 12 ${pad.top + plotH / 2})`}
            font-size="10"
            text-anchor="middle"
            fill={T.ink}
            opacity="0.7"
            letter-spacing="0.1em"
          >
            {yLabel.toUpperCase()}
          </text>
        )}
      </svg>
    )
  }
}
