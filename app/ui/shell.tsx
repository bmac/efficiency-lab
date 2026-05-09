import { css, on, type RemixNode } from 'remix/ui'

// Design tokens — single source of truth for the blueprint look.
export const T = {
  paper: '#e8e2d3',
  paperWarm: '#efe8d6',
  ink: '#0e2233',
  inkSoft: '#314b62',
  inkFaint: 'rgba(14,34,51,0.55)',
  rule: 'rgba(14,34,51,0.35)',
  ruleFaint: 'rgba(14,34,51,0.18)',
  accent: '#c44a2c',
  accentSoft: 'rgba(196,74,44,0.12)',
  warn: '#b58a16',
  grid: 'rgba(14,34,51,0.07)',
  gridStrong: 'rgba(14,34,51,0.14)',
  panel: 'rgba(255,255,255,0.42)',
  panelStrong: 'rgba(255,255,255,0.62)',
} as const

export const FONT_STACK =
  '"IBM Plex Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'

export interface LabMeta {
  slug: 'index' | 'red-beads' | 'shewhart' | 'pin-factory' | 'batch-vs-flow' | 'bessemer'
  href: string
  id: string
  code: string
  short: string
  name: string
  sub: string
  schema: 'jar' | 'chart' | 'line' | 'parallel' | 'collapse'
  fig: string
  source: string
  est: string
}

export const LABS: LabMeta[] = [
  {
    slug: 'red-beads',
    href: '/red-beads',
    id: '01',
    code: 'RB-001',
    short: 'Red Bead',
    name: 'The Red Bead Experiment',
    sub: "Defect rate as a property of the apparatus, not the operator.",
    schema: 'jar',
    fig: 'Fig. 1.0 — Deming apparatus',
    source: 'Deming, 1982',
    est: '4 min',
  },
  {
    slug: 'shewhart',
    href: '/shewhart',
    id: '02',
    code: 'SH-002',
    short: 'Shewhart',
    name: 'Shewhart Sandbox',
    sub: 'Stable processes, special causes, and the courage not to flinch.',
    schema: 'chart',
    fig: 'Fig. 2.0 — Process control sandbox',
    source: 'Shewhart, 1931',
    est: '6 min',
  },
  {
    slug: 'pin-factory',
    href: '/pin-factory',
    id: '03',
    code: 'PF-003',
    short: 'Pin Factory',
    name: 'Pin Factory',
    sub: 'Five-station serial line. Bottlenecks, buffers, push vs pull.',
    schema: 'line',
    fig: 'Fig. 3.0 — Serial line',
    source: 'Smith, 1776',
    est: '8 min',
  },
  {
    slug: 'batch-vs-flow',
    href: '/batch-vs-flow',
    id: '04',
    code: 'BF-004',
    short: 'Batch vs. Flow',
    name: 'Batch vs. Flow',
    sub: 'Two parallel lines. Slide batch size and watch lead time, WIP, and capital diverge.',
    schema: 'parallel',
    fig: 'Fig. 4.0 — Batch vs. flow',
    source: 'Potter, 2026',
    est: '7 min',
  },
  {
    slug: 'bessemer',
    href: '/bessemer',
    id: '05',
    code: 'BS-005',
    short: 'Bessemer',
    name: 'Bessemer Cost Collapse',
    sub: 'Run a steel mill 1850–1910. Adopt new processes early or late. Time the switch.',
    schema: 'collapse',
    fig: 'Fig. 5.0 — Bessemer cost collapse',
    source: 'Potter, Ch. 2',
    est: '9 min',
  },
]

export function findLab(slug: string): LabMeta | undefined {
  return LABS.find((l) => l.slug === slug)
}

// -------------------------------------------------------------------------
// Drafting chrome — fixed borders, sticky title block, footer.
// Used by Layout to wrap every page.
// -------------------------------------------------------------------------

export interface ChromeProps {
  slug: string
  children?: RemixNode
}

export function DraftingChrome() {
  return ({ slug, children }: ChromeProps) => {
    let lab = findLab(slug)
    let isIndex = slug === 'index' || !lab
    let sheetCode = isIndex ? 'EFF-IDX-26' : lab!.code
    let sheetName = isIndex ? 'Drafting Room' : lab!.short
    let sheetNum = isIndex ? '00' : lab!.id
    let sheetOf = String(LABS.length).padStart(2, '0')

    return (
      <div mix={chromeRootStyle}>
        <div mix={borderOuterStyle} aria-hidden="true" />
        <div mix={borderInnerStyle} aria-hidden="true" />

        <div mix={titleBlockStyle}>
          <a href="/" mix={titleCellStyle}>
            <span mix={cellLabelStyle}>Project</span>
            <span mix={cellValueStyle}>Efficiency Lab</span>
          </a>
          {isIndex ? (
            <div mix={titleCellMutedStyle}>Drafting room</div>
          ) : (
            <a href="/" mix={titleCellLinkStyle}>
              ← Index
            </a>
          )}
          <div mix={titleSpacerStyle} />
          <div mix={titleCellStyle}>
            <span mix={cellLabelStyle}>Sheet</span>
            <span mix={cellValueStyle}>
              {sheetCode} — {sheetName}
            </span>
          </div>
          <div mix={titleCellStyle}>
            <span mix={cellLabelStyle}>Rev</span>
            <span mix={cellValueStyle}>2026.05</span>
          </div>
          <div mix={titleCellLastStyle}>
            <span mix={cellLabelStyle}>Sheet</span>
            <span mix={cellValueStyle}>
              {sheetNum} / {sheetOf}
            </span>
          </div>
        </div>

        <main mix={mainStyle}>{children}</main>

        <footer mix={footerStyle}>
          <span>Efficiency Lab · Drafting room</span>
          <span>After Potter, Deming, Shewhart, Smith</span>
          <span>
            Sheet {sheetNum} / {sheetOf}
          </span>
        </footer>
      </div>
    )
  }
}

// -------------------------------------------------------------------------
// Panel — bordered box with offset notch label that breaks the top border.
// -------------------------------------------------------------------------

export interface PanelProps {
  label?: string
  padding?: number
  children?: RemixNode
}

export function Panel() {
  return ({ label, padding = 18, children }: PanelProps) => (
    <section mix={panelStyle} style={{ padding: `${padding}px` }}>
      {label && <div mix={panelLabelStyle}>{label}</div>}
      {children}
    </section>
  )
}

// -------------------------------------------------------------------------
// SheetHeader — eyebrow figure number + huge uppercase title + subtitle.
// -------------------------------------------------------------------------

export interface SheetHeaderProps {
  fig: string
  title: string
  subtitle?: string
}

export function SheetHeader() {
  return ({ fig, title, subtitle }: SheetHeaderProps) => (
    <header mix={sheetHeaderStyle}>
      <div mix={sheetEyebrowStyle}>{fig.toUpperCase()}</div>
      <h1 mix={sheetTitleStyle}>{title}</h1>
      {subtitle && <p mix={sheetSubtitleStyle}>{subtitle}</p>}
      <div mix={sheetRuleStyle} />
    </header>
  )
}

// -------------------------------------------------------------------------
// DraftingButton — square outline / inverse-fill mono button.
// -------------------------------------------------------------------------

export interface DraftingButtonProps {
  primary?: boolean
  full?: boolean
  disabled?: boolean
  children?: RemixNode
  onClick?: (event: MouseEvent) => void
}

export function DraftingButton() {
  return ({ primary, full, disabled, onClick, children }: DraftingButtonProps) => (
    <button
      type="button"
      disabled={disabled}
      mix={[
        primary ? primaryButtonStyle : ghostButtonStyle,
        full ? buttonFullStyle : null,
        onClick ? on('click', (event) => onClick(event)) : null,
      ]}
    >
      {children}
    </button>
  )
}

// -------------------------------------------------------------------------
// FieldSlider — labeled accent-filled slider with right-aligned live value.
// Must render inside a clientEntry context (uses on('input', ...)).
// -------------------------------------------------------------------------

export interface FieldSliderProps {
  label: string
  unit?: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  format?: (value: number) => string
}

export function FieldSlider() {
  return ({ label, unit, value, min, max, step = 1, onChange, format }: FieldSliderProps) => {
    let span = max - min
    let pct = span > 0 ? ((value - min) / span) * 100 : 0
    return (
      <label mix={sliderRowStyle}>
        <div mix={sliderHeaderStyle}>
          <span mix={sliderLabelStyle}>{label}</span>
          <span mix={sliderValueStyle}>
            {format ? format(value) : value}
            {unit && <span mix={sliderUnitStyle}>{unit}</span>}
          </span>
        </div>
        <div mix={sliderTrackStyle}>
          <div mix={sliderFillStyle} style={{ width: `${pct}%` }} />
          <div mix={sliderThumbStyle} style={{ left: `calc(${pct}% - 1px)` }} />
          <input
            type="range"
            min={String(min)}
            max={String(max)}
            step={String(step)}
            value={String(value)}
            mix={[
              sliderInputStyle,
              on('input', (event) => onChange(Number(event.currentTarget.value))),
            ]}
          />
        </div>
      </label>
    )
  }
}

// -------------------------------------------------------------------------
// Readout — labeled value row with a dashed top divider.
// -------------------------------------------------------------------------

export interface ReadoutProps {
  k: string
  v: string | number
  accent?: boolean
}

export function Readout() {
  return ({ k, v, accent }: ReadoutProps) => (
    <div mix={readoutStyle}>
      <span mix={readoutKeyStyle}>{k}</span>
      <span mix={accent ? readoutValueAccentStyle : readoutValueStyle}>{v}</span>
    </div>
  )
}

// -------------------------------------------------------------------------
// Styles
// -------------------------------------------------------------------------

const chromeRootStyle = css({
  minHeight: '100vh',
  background: T.paper,
  color: T.ink,
  fontFamily: FONT_STACK,
  position: 'relative',
  backgroundImage: `linear-gradient(${T.grid} 1px, transparent 1px), linear-gradient(90deg, ${T.grid} 1px, transparent 1px)`,
  backgroundSize: '24px 24px',
  '& *, & *::before, & *::after': { boxSizing: 'border-box' },
})

const borderOuterStyle = css({
  position: 'fixed',
  inset: '16px',
  border: `1px solid ${T.ink}`,
  opacity: 0.4,
  pointerEvents: 'none',
  zIndex: 1,
})

const borderInnerStyle = css({
  position: 'fixed',
  inset: '20px',
  border: `1px solid ${T.ink}`,
  opacity: 0.15,
  pointerEvents: 'none',
  zIndex: 1,
})

const titleBlockStyle = css({
  position: 'sticky',
  top: '16px',
  zIndex: 5,
  margin: '16px 16px 0',
  display: 'grid',
  gridTemplateColumns: 'minmax(220px, 280px) 160px 1fr minmax(280px, auto) 110px 110px',
  background: T.paper,
  borderTop: `1px solid ${T.ink}`,
  borderBottom: `1px solid ${T.ink}`,
  fontSize: '10px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  '@media (max-width: 880px)': {
    gridTemplateColumns: 'minmax(0, 1fr) 1fr',
    '& > *:nth-child(3), & > *:nth-child(5)': { display: 'none' },
  },
})

const titleCellStyle = css({
  padding: '12px 16px',
  borderRight: `1px solid ${T.ink}`,
  color: T.ink,
  textDecoration: 'none',
  display: 'block',
})

const titleCellLastStyle = css({
  padding: '12px 16px',
  color: T.ink,
  textDecoration: 'none',
  display: 'block',
})

const titleCellMutedStyle = css({
  padding: '12px 16px',
  borderRight: `1px solid ${T.ink}`,
  opacity: 0.5,
  display: 'flex',
  alignItems: 'center',
})

const titleCellLinkStyle = css({
  padding: '12px 16px',
  borderRight: `1px solid ${T.ink}`,
  color: T.ink,
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  letterSpacing: '0.14em',
  fontWeight: 700,
  '&:hover': { background: T.panelStrong },
})

const titleSpacerStyle = css({})

const cellLabelStyle = css({
  display: 'block',
  opacity: 0.6,
  fontSize: '8px',
})

const cellValueStyle = css({
  display: 'block',
  fontWeight: 700,
  marginTop: '2px',
  letterSpacing: '0.04em',
})

const mainStyle = css({
  padding: '32px 32px 64px',
  position: 'relative',
  zIndex: 2,
  '@media (max-width: 720px)': {
    padding: '24px 24px 48px',
  },
})

const footerStyle = css({
  margin: '0 16px 16px',
  borderTop: `1px solid ${T.ink}`,
  padding: '14px 16px',
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '10px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  opacity: 0.7,
  position: 'relative',
  zIndex: 2,
  gap: '12px',
  flexWrap: 'wrap',
})

const panelStyle = css({
  border: `1px solid ${T.ink}`,
  background: T.panel,
  position: 'relative',
})

const panelLabelStyle = css({
  position: 'absolute',
  top: '-8px',
  left: '14px',
  padding: '0 8px',
  background: T.paper,
  fontSize: '10px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: T.ink,
})

const sheetHeaderStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
})

const sheetEyebrowStyle = css({
  fontSize: '10px',
  letterSpacing: '0.18em',
  opacity: 0.6,
})

const sheetTitleStyle = css({
  fontFamily: 'inherit',
  fontSize: 'clamp(40px, 5vw, 64px)',
  fontWeight: 700,
  margin: '6px 0 0',
  letterSpacing: '-0.01em',
  textTransform: 'uppercase',
  lineHeight: 0.95,
})

const sheetSubtitleStyle = css({
  margin: '12px 0 0',
  fontSize: '13px',
  lineHeight: 1.55,
  maxWidth: '720px',
  opacity: 0.85,
})

const sheetRuleStyle = css({
  marginTop: '16px',
  height: '1px',
  background: T.ink,
  opacity: 0.4,
})

const baseButtonStyle = {
  appearance: 'none',
  fontFamily: FONT_STACK,
  fontSize: '11px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  padding: '10px 14px',
  border: `1px solid ${T.ink}`,
  cursor: 'pointer',
  transition: 'background-color 120ms ease, color 120ms ease',
  '&:disabled': { opacity: 0.4, cursor: 'not-allowed' },
} as const

const ghostButtonStyle = css({
  ...baseButtonStyle,
  background: 'transparent',
  color: T.ink,
  fontWeight: 500,
  '&:hover:not(:disabled)': { background: T.panelStrong },
})

const primaryButtonStyle = css({
  ...baseButtonStyle,
  background: T.ink,
  color: T.paper,
  fontWeight: 700,
  '&:hover:not(:disabled)': { background: T.inkSoft },
})

const buttonFullStyle = css({ width: '100%' })

const sliderRowStyle = css({
  display: 'block',
  marginBottom: '14px',
  fontSize: '11px',
})

const sliderHeaderStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '6px',
  letterSpacing: '0.06em',
})

const sliderLabelStyle = css({
  opacity: 0.7,
  textTransform: 'uppercase',
})

const sliderValueStyle = css({
  color: T.accent,
  fontWeight: 700,
})

const sliderUnitStyle = css({
  opacity: 0.6,
  marginLeft: '4px',
})

const sliderTrackStyle = css({
  position: 'relative',
  height: '16px',
  border: `1px solid ${T.ink}`,
  background: 'transparent',
})

const sliderFillStyle = css({
  position: 'absolute',
  inset: 0,
  left: 0,
  background: T.accentSoft,
  pointerEvents: 'none',
})

const sliderThumbStyle = css({
  position: 'absolute',
  top: '-3px',
  bottom: '-3px',
  width: '2px',
  background: T.accent,
  pointerEvents: 'none',
})

const sliderInputStyle = css({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  cursor: 'ew-resize',
  margin: 0,
})

const readoutStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '6px 0',
  borderTop: `1px dashed ${T.ink}`,
  fontSize: '11px',
  letterSpacing: '0.06em',
})

const readoutKeyStyle = css({
  opacity: 0.7,
  textTransform: 'uppercase',
})

const readoutValueStyle = css({
  fontWeight: 700,
  color: T.ink,
})

const readoutValueAccentStyle = css({
  fontWeight: 700,
  color: T.accent,
})
