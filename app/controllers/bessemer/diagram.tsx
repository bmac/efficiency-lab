import { css, type Handle } from 'remix/ui'

import { T } from '../../ui/shell.tsx'
import type { ProcessId } from './mill.ts'

export interface MillDiagramProps {
  process: ProcessId
  retooling: boolean
  oreMismatch: boolean
  pulse: number // 0..1, animates the active vessel
}

// Process-specific SVG. Each is a stylised cross-section: puddling has a
// hand-stirred hearth, Bessemer has the pear-shaped converter showering
// sparks, open hearth is a long shallow tank.
export function MillDiagram(handle: Handle<MillDiagramProps>) {
  return () => {
    let { process, retooling, oreMismatch, pulse } = handle.props
    let body =
      process === 'bessemer-acid' || process === 'bessemer-basic'
        ? bessemerConverter(pulse, process === 'bessemer-basic')
        : process === 'open-hearth' || process === 'basic-open-hearth'
          ? openHearth(pulse, process === 'basic-open-hearth')
          : process === 'puddling'
            ? puddling(pulse)
            : process === 'crucible'
              ? crucible(pulse)
              : cementation(pulse)
    return (
      <div mix={diagramWrapStyle}>
        <svg viewBox="0 0 360 200" mix={diagramSvgStyle}>
          <rect x="0" y="0" width="360" height="200" fill="none" />
          <g opacity={retooling ? 0.25 : 1}>{body}</g>
          {retooling && (
            <text
              x="180"
              y="105"
              text-anchor="middle"
              font-family="IBM Plex Mono"
              font-size="12"
              fill={T.warn}
              font-weight="700"
              letter-spacing="0.18em"
            >
              RETOOLING
            </text>
          )}
        </svg>
        {oreMismatch && !retooling && (
          <div mix={warningStyle}>
            ⚠ Acid lining on high-P ore — output is brittle. Defect rate spikes.
          </div>
        )}
      </div>
    )
  }
}

function bessemerConverter(pulse: number, basic: boolean) {
  let tilt = Math.sin(pulse * Math.PI * 2) * 4
  let sparkY = 30 + (1 - Math.sin(pulse * Math.PI * 2)) * 20
  let sparks = []
  for (let i = 0; i < 8; i++) {
    let sx = 180 + (Math.sin(pulse * 7 + i) * 50)
    let sy = sparkY + i * 2 + Math.cos(pulse * 6 + i) * 8
    sparks.push(<circle key={`sp-${i}`} cx={sx} cy={sy} r="1.5" fill={T.accent} opacity="0.7" />)
  }
  return (
    <g>
      {/* spark column */}
      {sparks}
      <text x="20" y="22" font-family="IBM Plex Mono" font-size="10" fill={T.ink} opacity="0.55">
        BESSEMER {basic ? '· BASIC LINING' : '· ACID'}
      </text>
      <g transform={`translate(180 130) rotate(${tilt})`}>
        {/* pear-shaped converter */}
        <path
          d="M -38 0 Q -42 -50 -22 -70 L 22 -70 Q 42 -50 38 0 Q 36 28 0 32 Q -36 28 -38 0 Z"
          fill={T.panelStrong}
          stroke={T.ink}
          stroke-width="1.4"
        />
        {/* mouth */}
        <ellipse
          cx="0"
          cy="-70"
          rx="22"
          ry="6"
          fill={T.ink}
          stroke={T.ink}
          stroke-width="0.6"
        />
        {/* glow inside */}
        <ellipse cx="0" cy="-30" rx="20" ry="36" fill={T.accent} opacity="0.35" />
        {/* trunnion bearings */}
        <circle cx="-44" cy="-10" r="6" fill={T.panel} stroke={T.ink} stroke-width="1" />
        <circle cx="44" cy="-10" r="6" fill={T.panel} stroke={T.ink} stroke-width="1" />
      </g>
      {/* support cradle */}
      <line x1="100" y1="120" x2="260" y2="120" stroke={T.ink} stroke-width="1" />
      <line x1="120" y1="120" x2="100" y2="170" stroke={T.ink} stroke-width="0.8" />
      <line x1="240" y1="120" x2="260" y2="170" stroke={T.ink} stroke-width="0.8" />
      <line x1="60" y1="170" x2="300" y2="170" stroke={T.ink} stroke-width="1.2" />
    </g>
  )
}

function openHearth(pulse: number, basic: boolean) {
  let glow = 0.25 + 0.25 * Math.sin(pulse * Math.PI * 2)
  return (
    <g>
      <text x="20" y="22" font-family="IBM Plex Mono" font-size="10" fill={T.ink} opacity="0.55">
        OPEN HEARTH {basic ? '· BASIC' : '· SIEMENS-MARTIN'}
      </text>
      {/* shallow tank */}
      <rect
        x="60"
        y="80"
        width="240"
        height="60"
        fill={T.panelStrong}
        stroke={T.ink}
        stroke-width="1.4"
      />
      {/* molten pool */}
      <rect x="70" y="100" width="220" height="34" fill={T.accent} opacity={glow} />
      {/* arched roof */}
      <path
        d="M 60 80 Q 180 30 300 80"
        fill="none"
        stroke={T.ink}
        stroke-width="1.4"
      />
      {/* regenerative chambers */}
      <rect x="20" y="120" width="36" height="50" fill={T.panel} stroke={T.ink} stroke-width="1" />
      <rect x="304" y="120" width="36" height="50" fill={T.panel} stroke={T.ink} stroke-width="1" />
      <line x1="56" y1="135" x2="60" y2="120" stroke={T.ink} stroke-width="0.8" />
      <line x1="304" y1="120" x2="300" y2="120" stroke={T.ink} stroke-width="0.8" />
      {/* tap */}
      <line x1="180" y1="140" x2="180" y2="170" stroke={T.ink} stroke-width="1.4" />
      <circle cx="180" cy="172" r="3" fill={T.accent} opacity={glow + 0.4} />
    </g>
  )
}

function puddling(pulse: number) {
  let stirX = 170 + Math.sin(pulse * Math.PI * 2) * 12
  return (
    <g>
      <text x="20" y="22" font-family="IBM Plex Mono" font-size="10" fill={T.ink} opacity="0.55">
        PUDDLING FURNACE
      </text>
      {/* furnace body */}
      <rect
        x="80"
        y="90"
        width="200"
        height="60"
        fill={T.panelStrong}
        stroke={T.ink}
        stroke-width="1.4"
      />
      {/* hearth */}
      <rect x="120" y="110" width="120" height="28" fill={T.accent} opacity="0.4" />
      {/* chimney */}
      <rect
        x="40"
        y="40"
        width="20"
        height="50"
        fill={T.panel}
        stroke={T.ink}
        stroke-width="1.2"
      />
      {/* smoke */}
      <circle cx={50} cy={32 + Math.sin(pulse * 3) * 4} r="6" fill={T.ink} opacity="0.18" />
      <circle cx={56} cy={20 + Math.cos(pulse * 4) * 3} r="4" fill={T.ink} opacity="0.12" />
      {/* puddler stirring */}
      <line
        x1={stirX}
        y1="140"
        x2={stirX + 70}
        y2="170"
        stroke={T.ink}
        stroke-width="1.6"
      />
      <circle cx={stirX + 76} cy="172" r="6" fill={T.ink} />
      {/* worker stick figure */}
      <line x1={stirX + 80} y1="172" x2={stirX + 80} y2="178" stroke={T.ink} stroke-width="1.2" />
    </g>
  )
}

function crucible(pulse: number) {
  let glow = 0.4 + 0.3 * Math.sin(pulse * Math.PI * 2)
  return (
    <g>
      <text x="20" y="22" font-family="IBM Plex Mono" font-size="10" fill={T.ink} opacity="0.55">
        CRUCIBLE BANK
      </text>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={`c-${i}`} transform={`translate(${60 + i * 50} 110)`}>
          <path
            d="M -16 0 Q -16 36 0 38 Q 16 36 16 0 Z"
            fill={T.panelStrong}
            stroke={T.ink}
            stroke-width="1.2"
          />
          <ellipse cx="0" cy="0" rx="16" ry="5" fill={T.ink} stroke={T.ink} stroke-width="0.8" />
          <ellipse cx="0" cy="2" rx="13" ry="3" fill={T.accent} opacity={glow} />
        </g>
      ))}
      <line x1="40" y1="160" x2="320" y2="160" stroke={T.ink} stroke-width="1.2" />
    </g>
  )
}

function cementation(pulse: number) {
  let glow = 0.25 + 0.2 * Math.sin(pulse * Math.PI * 2)
  return (
    <g>
      <text x="20" y="22" font-family="IBM Plex Mono" font-size="10" fill={T.ink} opacity="0.55">
        CEMENTATION CHEST
      </text>
      <rect
        x="80"
        y="60"
        width="200"
        height="100"
        fill={T.panel}
        stroke={T.ink}
        stroke-width="1.4"
      />
      {/* chest within */}
      <rect
        x="110"
        y="85"
        width="140"
        height="50"
        fill={T.panelStrong}
        stroke={T.ink}
        stroke-width="1"
      />
      {[0, 1, 2, 3].map((i) => (
        <line
          key={`bar-${i}`}
          x1={120 + i * 32}
          y1="92"
          x2={120 + i * 32}
          y2="128"
          stroke={T.ink}
          stroke-width="1.2"
        />
      ))}
      <ellipse cx="180" cy="155" rx="80" ry="5" fill={T.accent} opacity={glow} />
    </g>
  )
}

const diagramWrapStyle = css({
  width: '100%',
})

const diagramSvgStyle = css({
  width: '100%',
  height: 'auto',
  display: 'block',
})

const warningStyle = css({
  marginTop: '10px',
  border: `1px solid ${T.accent}`,
  background: T.accentSoft,
  padding: '8px 10px',
  fontSize: '11px',
  letterSpacing: '0.04em',
  color: T.accent,
  fontWeight: 700,
})
