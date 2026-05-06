import { css, type Handle } from 'remix/ui'

export interface SparklineProps {
  label: string
  unit: string
  value: number
  formatValue?: (value: number) => string
  series: readonly { t: number; value: number }[]
  windowSeconds: number
  color?: string
  yMin?: number
  yMax?: number
  height?: number
}

export function Sparkline(handle: Handle<SparklineProps>) {
  return () => {
    let { label, unit, value, formatValue, series, windowSeconds, yMin, yMax } = handle.props
    let height = handle.props.height ?? 56
    let color = handle.props.color ?? 'var(--brand-blue)'
    let width = 360
    let pad = 4

    let last = series[series.length - 1]
    let endT = last?.t ?? 0
    let startT = endT - windowSeconds

    let visible = series.filter((s) => s.t >= startT)
    let values = visible.map((s) => s.value)
    let lo = yMin ?? Math.min(0, ...values)
    let hi = yMax ?? Math.max(1e-6, ...values)
    if (hi - lo < 1e-9) hi = lo + 1

    let xScale = (t: number) =>
      pad + ((t - startT) / Math.max(windowSeconds, 1e-9)) * (width - pad * 2)
    let yScale = (v: number) => height - pad - ((v - lo) / (hi - lo)) * (height - pad * 2)

    let pathD = visible
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.t).toFixed(1)} ${yScale(p.value).toFixed(1)}`)
      .join(' ')

    let displayValue = formatValue ? formatValue(value) : value.toFixed(2)

    return (
      <div mix={wrapStyle}>
        <div mix={headerStyle}>
          <span mix={labelStyle}>{label}</span>
          <span mix={valueStyle}>
            {displayValue} <span mix={unitStyle}>{unit}</span>
          </span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" mix={svgStyle(height)}>
          {pathD && <path d={pathD} stroke={color} stroke-width="2" fill="none" />}
          {last && (
            <circle cx={xScale(last.t)} cy={yScale(last.value)} r="3" fill={color} />
          )}
        </svg>
      </div>
    )
  }
}

const wrapStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  background: 'var(--surface-4)',
  borderRadius: '8px',
  padding: '10px 12px',
})

const headerStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
})

const labelStyle = css({
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-tertiary)',
})

const valueStyle = css({
  fontSize: '14px',
  fontWeight: 700,
  color: 'var(--text-primary)',
})

const unitStyle = css({
  fontSize: '10px',
  fontWeight: 400,
  color: 'var(--text-tertiary)',
  marginLeft: '2px',
})

function svgStyle(height: number) {
  return css({
    display: 'block',
    width: '100%',
    height: `${height}px`,
  })
}
