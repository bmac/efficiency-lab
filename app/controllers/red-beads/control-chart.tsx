import { css, type Handle } from 'remix/ui'

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
}

export function ControlChart(handle: Handle<ControlChartProps>) {
  return () => {
    let { title, points, cl, ucl, lcl, yLabel } = handle.props
    let width = handle.props.width ?? 640
    let height = handle.props.height ?? 220
    let pad = { top: 32, right: 80, bottom: 28, left: 48 }
    let plotW = width - pad.left - pad.right
    let plotH = height - pad.top - pad.bottom

    let allValues: number[] = [...points]
    if (Number.isFinite(ucl)) allValues.push(ucl)
    if (Number.isFinite(cl)) allValues.push(cl)
    if (Number.isFinite(lcl)) allValues.push(lcl)
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

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        mix={css({
          display: 'block',
          maxWidth: `${width}px`,
          background: 'var(--surface-4)',
          borderRadius: '8px',
        })}
      >
        <text
          x={pad.left}
          y={20}
          font-size="12"
          fill="var(--text-primary)"
          font-weight="700"
        >
          {title}
        </text>

        {yTicks.map((t) => (
          <g key={`tick-${t.toFixed(4)}`}>
            <line
              x1={pad.left}
              y1={yScale(t)}
              x2={pad.left + plotW}
              y2={yScale(t)}
              stroke="var(--text-tertiary)"
              stroke-opacity="0.18"
            />
            <text
              x={pad.left - 6}
              y={yScale(t) + 4}
              font-size="10"
              text-anchor="end"
              fill="var(--text-tertiary)"
            >
              {t.toFixed(1)}
            </text>
          </g>
        ))}

        <line
          x1={pad.left}
          y1={yScale(ucl)}
          x2={pad.left + plotW}
          y2={yScale(ucl)}
          stroke="#ff5148"
          stroke-dasharray="4 4"
          stroke-width="1"
        />
        <text x={pad.left + plotW + 6} y={yScale(ucl) + 3} font-size="10" fill="#ff5148">
          UCL {ucl.toFixed(2)}
        </text>

        <line
          x1={pad.left}
          y1={yScale(cl)}
          x2={pad.left + plotW}
          y2={yScale(cl)}
          stroke="var(--text-tertiary)"
          stroke-width="1"
        />
        <text
          x={pad.left + plotW + 6}
          y={yScale(cl) + 3}
          font-size="10"
          fill="var(--text-tertiary)"
        >
          CL {cl.toFixed(2)}
        </text>

        <line
          x1={pad.left}
          y1={yScale(lcl)}
          x2={pad.left + plotW}
          y2={yScale(lcl)}
          stroke="#ff5148"
          stroke-dasharray="4 4"
          stroke-width="1"
        />
        <text x={pad.left + plotW + 6} y={yScale(lcl) + 3} font-size="10" fill="#ff5148">
          LCL {lcl.toFixed(2)}
        </text>

        {pathD && <path d={pathD} stroke="var(--brand-blue)" stroke-width="2" fill="none" />}
        {points.map((v, i) => (
          <circle
            key={`pt-${i}`}
            cx={xScale(i)}
            cy={yScale(v)}
            r="4"
            fill={v > ucl + 1e-9 || v < lcl - 1e-9 ? '#ff5148' : 'var(--brand-blue)'}
          >
            <title>
              Round {i + 1}: {v.toFixed(2)}
            </title>
          </circle>
        ))}

        {points.map((_, i) => (
          <text
            key={`xl-${i}`}
            x={xScale(i)}
            y={pad.top + plotH + 14}
            font-size="10"
            text-anchor="middle"
            fill="var(--text-tertiary)"
          >
            {i + 1}
          </text>
        ))}

        {yLabel && (
          <text
            x={12}
            y={pad.top + plotH / 2}
            transform={`rotate(-90 12 ${pad.top + plotH / 2})`}
            font-size="11"
            text-anchor="middle"
            fill="var(--text-tertiary)"
          >
            {yLabel}
          </text>
        )}
      </svg>
    )
  }
}
