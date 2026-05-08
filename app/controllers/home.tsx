import type { BuildAction } from 'remix/fetch-router'
import { css, type RemixNode } from 'remix/ui'

import type { routes } from '../routes.ts'
import { Layout } from '../ui/layout.tsx'
import { LABS, Panel, T, type LabMeta } from '../ui/shell.tsx'
import { render } from '../utils/render.tsx'

export const home: BuildAction<'GET', typeof routes.home> = {
  handler({ request }) {
    return render(<HomePage />, request)
  },
}

function HomePage() {
  return () => (
    <Layout title="Efficiency Lab" slug="index">
      <div mix={pageStyle}>
        <Hero />
        <Catalog />
        <BottomTriple />
      </div>
    </Layout>
  )
}

function Hero() {
  return () => (
    <section mix={heroGridStyle}>
      <div>
        <div mix={heroEyebrowStyle}>DOC. EFF-IDX-26 · SCALE 1:1 · DRAFTING ROOM</div>
        <h1 mix={heroTitleStyle}>
          A working
          <br />
          <span mix={heroAccentStyle}>laboratory</span>
          <br />
          for the
          <br />
          <span mix={heroFadedStyle}>
            study of
            <br />
            efficiency.
          </span>
        </h1>
        <p mix={heroBodyStyle}>
          Working models for the mechanics described in Brian Potter's writing on efficiency,
          plus other classics of process control. Pull a lever. Read the gauge. File the report.
          Each sheet is its own apparatus — open it, run a round, then look at the chart.
        </p>
        <div mix={heroButtonRowStyle}>
          <a href={LABS[0].href} mix={heroPrimaryButtonStyle}>
            ▶ Open first sheet
          </a>
          <a href="#catalog" mix={heroGhostButtonStyle}>
            ↓ Browse catalog
          </a>
        </div>
        <div mix={heroStatRowStyle}>
          <span>{LABS.length} sheets on file</span>
          <span>·</span>
          <span>More in drafting</span>
        </div>
      </div>

      <div>
        <Panel label="Drafting notes" padding={20}>
          <div mix={notesBodyStyle}>
            <p mix={notesParaStyle}>
              Each laboratory simulates a textbook scenario from the literature on process
              variation, flow, and incentives. The math isn't novel; the point is to feel the
              conclusions in your hands.
            </p>
            <p mix={notesParaTightStyle}>
              Tinker. Break it. Watch the chart over-react. Then read the drafting note in the
              corner of the sheet.
            </p>
          </div>
          <div mix={notesMetaStyle}>
            <div mix={notesMetaRowStyle}>
              <span>DRAWN</span>
              <span>S. POOLE</span>
            </div>
            <div mix={notesMetaRowStyle}>
              <span>CHK'D</span>
              <span>—</span>
            </div>
            <div mix={notesMetaRowStyle}>
              <span>DATE</span>
              <span>05.07.26</span>
            </div>
          </div>
        </Panel>

        <div mix={compassRowStyle}>
          <svg viewBox="0 0 60 60" width="56" height="56" mix={compassSvgStyle}>
            <circle cx="30" cy="30" r="28" fill="none" stroke={T.ink} stroke-width="0.6" />
            <circle
              cx="30"
              cy="30"
              r="20"
              fill="none"
              stroke={T.ink}
              stroke-width="0.4"
              opacity="0.5"
            />
            <line x1="30" y1="2" x2="30" y2="58" stroke={T.ink} stroke-width="0.4" />
            <line x1="2" y1="30" x2="58" y2="30" stroke={T.ink} stroke-width="0.4" />
            <polygon
              points="30,4 26,30 30,28 34,30"
              fill={T.accent}
              stroke={T.ink}
              stroke-width="0.4"
            />
            <polygon
              points="30,56 26,30 30,32 34,30"
              fill="none"
              stroke={T.ink}
              stroke-width="0.4"
            />
            <text
              x="30"
              y="14"
              text-anchor="middle"
              font-size="6"
              font-family="IBM Plex Mono"
              fill={T.paper}
              font-weight="700"
            >
              N
            </text>
          </svg>
          <div mix={compassTextStyle}>
            <div mix={compassMutedStyle}>True north</div>
            <div mix={compassAccentStyle}>The data, not the story</div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Catalog() {
  return () => (
    <section id="catalog" mix={catalogStyle}>
      <div mix={catalogHeaderStyle}>
        <h2 mix={catalogTitleStyle}>Catalog of sheets</h2>
        <span mix={catalogCountStyle}>{LABS.length} on file · drag to re-rack</span>
      </div>
      <div mix={catalogGridStyle}>
        {LABS.map((lab) => (
          <CatalogCard key={lab.slug} lab={lab} />
        ))}
        <DraftSlot />
      </div>
    </section>
  )
}

function CatalogCard() {
  return ({ lab }: { lab: LabMeta }) => (
    <a href={lab.href} mix={cardStyle}>
      <div mix={cardStripStyle}>
        <div mix={cardStripIdStyle}>{lab.id}</div>
        <div mix={cardStripCodeStyle}>{lab.code}</div>
        <div mix={cardStripOpenStyle}>OPEN →</div>
      </div>
      <div mix={cardBodyStyle}>
        <div>
          <div mix={cardShortStyle}>{lab.short}</div>
          <div mix={cardSubStyle}>{lab.sub}</div>
        </div>
        <CatalogSchema kind={lab.schema} />
      </div>
      <div mix={cardFootStyle}>
        <span>Source · {lab.source}</span>
        <span>≈ {lab.est}</span>
      </div>
    </a>
  )
}

function CatalogSchema() {
  return ({ kind }: { kind: LabMeta['schema'] }) => {
    if (kind === 'jar') {
      return (
        <svg viewBox="0 0 110 60" mix={schemaSvgStyle}>
          {Array.from({ length: 30 }).map((_, idx) => {
            let r = Math.floor(idx / 10)
            let c = idx % 10
            let red = (idx * 7) % 5 === 0
            return (
              <circle
                key={`b-${idx}`}
                cx={8 + c * 10.5}
                cy={10 + r * 14}
                r="3.5"
                fill={red ? T.accent : 'none'}
                stroke={T.ink}
                stroke-width="0.6"
              />
            )
          })}
        </svg>
      )
    }
    if (kind === 'chart') {
      let xs = [0, 11, 22, 33, 44, 55, 66, 77, 88, 99, 110]
      let ys = [28, 24, 32, 22, 34, 20, 38, 24, 30, 22, 32]
      return (
        <svg viewBox="0 0 110 60" mix={schemaSvgStyle}>
          <line
            x1="0"
            y1="12"
            x2="110"
            y2="12"
            stroke={T.accent}
            stroke-dasharray="2 2"
            stroke-width="0.6"
          />
          <line
            x1="0"
            y1="48"
            x2="110"
            y2="48"
            stroke={T.accent}
            stroke-dasharray="2 2"
            stroke-width="0.6"
          />
          <line
            x1="0"
            y1="30"
            x2="110"
            y2="30"
            stroke={T.ink}
            stroke-width="0.4"
            opacity="0.6"
          />
          <polyline
            points="0,28 11,24 22,32 33,22 44,34 55,20 66,38 77,24 88,30 99,22 110,32"
            fill="none"
            stroke={T.ink}
            stroke-width="1"
          />
          {xs.map((x, i) => (
            <rect key={`c-${i}`} x={x - 1.5} y={ys[i] - 1.5} width="3" height="3" fill={T.accent} />
          ))}
        </svg>
      )
    }
    if (kind === 'parallel') {
      return (
        <svg viewBox="0 0 110 60" mix={schemaSvgStyle}>
          {[0, 1].map((row) => (
            <g key={`pr-${row}`}>
              {[0, 1, 2, 3, 4].map((i) => (
                <g key={`pp-${row}-${i}`}>
                  <rect
                    x={4 + i * 21}
                    y={row === 0 ? 8 : 38}
                    width={row === 0 ? 16 : 6}
                    height="14"
                    fill={row === 0 ? T.accent : T.ink}
                    opacity={row === 0 ? 0.85 : 1}
                    stroke={T.ink}
                    stroke-width="0.6"
                  />
                  {i < 4 && (
                    <line
                      x1={row === 0 ? 20 + i * 21 : 10 + i * 21}
                      y1={row === 0 ? 15 : 45}
                      x2={25 + i * 21}
                      y2={row === 0 ? 15 : 45}
                      stroke={T.ink}
                      stroke-width="0.6"
                    />
                  )}
                </g>
              ))}
            </g>
          ))}
          <text
            x="2"
            y="32"
            font-size="5"
            font-family="IBM Plex Mono"
            fill={T.ink}
            opacity="0.7"
          >
            BATCH
          </text>
          <text
            x="2"
            y="58"
            font-size="5"
            font-family="IBM Plex Mono"
            fill={T.ink}
            opacity="0.7"
          >
            FLOW
          </text>
        </svg>
      )
    }
    return (
      <svg viewBox="0 0 110 60" mix={schemaSvgStyle}>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={`s-${i}`}>
            <rect
              x={4 + i * 21}
              y="22"
              width="16"
              height="16"
              fill="none"
              stroke={T.ink}
              stroke-width="0.8"
            />
            <text
              x={12 + i * 21}
              y="33"
              text-anchor="middle"
              font-size="6"
              font-family="IBM Plex Mono"
              fill={T.ink}
            >
              {i + 1}
            </text>
            {i < 4 && (
              <line
                x1={20 + i * 21}
                y1="30"
                x2={25 + i * 21}
                y2="30"
                stroke={T.ink}
                stroke-width="0.8"
              />
            )}
          </g>
        ))}
        <text
          x="55"
          y="14"
          text-anchor="middle"
          font-size="6"
          font-family="IBM Plex Mono"
          fill={T.ink}
          opacity="0.6"
        >
          SERIAL · 5 STN
        </text>
      </svg>
    )
  }
}

function DraftSlot() {
  return () => (
    <div mix={draftSlotStyle}>
      <div mix={draftSlotEyebrowStyle}>Next sheet · in drafting</div>
      <div mix={draftSlotDashStyle}>—</div>
      <div mix={draftSlotEyebrowStyle}>Reserve sheet</div>
    </div>
  )
}

function BottomTriple() {
  return () => (
    <section mix={bottomGridStyle}>
      <Panel label="Legend" padding={16}>
        <LegendRow
          k="Accent / live value"
          v="Anything currently being acted on, or computed from inputs."
        >
          <span mix={legendSwatchSolidStyle} />
        </LegendRow>
        <LegendRow k="Frame / static" v="Apparatus and chrome. Doesn't move while you work.">
          <span mix={legendSwatchOutlineStyle} />
        </LegendRow>
        <LegendRow k="Control limit" v="Calculated from the process, not chosen.">
          <svg width="16" height="6">
            <line
              x1="0"
              y1="3"
              x2="16"
              y2="3"
              stroke={T.accent}
              stroke-dasharray="3 2"
            />
          </svg>
        </LegendRow>
      </Panel>
      <Panel label="Reading list" padding={16}>
        <ListItem n="01" t="Out of the Crisis" a="W. Edwards Deming, 1982" />
        <ListItem
          n="02"
          t="Economic Control of Quality of Manufactured Product"
          a="Walter A. Shewhart, 1931"
        />
        <ListItem n="03" t="Thinking in Systems" a="Donella H. Meadows, 2008" />
        <ListItem n="04" t="The Origins of Efficiency" a="Brian Potter (Construction Physics)" />
      </Panel>
      <Panel label="Drafting room" padding={16}>
        <div mix={draftingRoomBodyStyle}>
          More sheets are in drafting. If a particular apparatus would be useful to you — Little's
          Law, Theory of Constraints, the Toyota Production System — scribble in the margin and
          we'll cut a new sheet.
        </div>
        <div mix={draftingRoomFootStyle}>Margin notes welcome</div>
      </Panel>
    </section>
  )
}

function LegendRow() {
  return ({ k, v, children }: { k: string; v: string; children?: RemixNode }) => (
    <div mix={legendRowStyle}>
      <div mix={legendSwatchCellStyle}>{children}</div>
      <div>
        <div mix={legendKStyle}>{k}</div>
        <div mix={legendVStyle}>{v}</div>
      </div>
    </div>
  )
}

function ListItem() {
  return ({ n, t, a }: { n: string; t: string; a: string }) => (
    <div mix={listItemStyle}>
      <div mix={listItemNumStyle}>{n}</div>
      <div>
        <div mix={listItemTitleStyle}>{t}</div>
        <div mix={listItemAuthorStyle}>{a}</div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------------
// Styles
// -------------------------------------------------------------------------

const pageStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '64px',
})

const heroGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
  gap: '64px',
  alignItems: 'flex-start',
  '@media (max-width: 960px)': {
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '32px',
  },
})

const heroEyebrowStyle = css({
  fontSize: '10px',
  letterSpacing: '0.18em',
  opacity: 0.6,
  marginBottom: '14px',
  textTransform: 'uppercase',
})

const heroTitleStyle = css({
  fontFamily: 'inherit',
  fontSize: 'clamp(56px, 7vw, 96px)',
  fontWeight: 700,
  lineHeight: 0.92,
  margin: 0,
  letterSpacing: '-0.02em',
  textTransform: 'uppercase',
  color: T.ink,
})

const heroAccentStyle = css({ color: T.accent })

const heroFadedStyle = css({ opacity: 0.55 })

const heroBodyStyle = css({
  marginTop: '32px',
  fontSize: '14px',
  lineHeight: 1.65,
  maxWidth: '560px',
})

const heroButtonRowStyle = css({
  marginTop: '28px',
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
})

const heroBaseButtonStyle = {
  display: 'inline-block',
  padding: '10px 14px',
  border: `1px solid ${T.ink}`,
  fontFamily: 'inherit',
  fontSize: '11px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  cursor: 'pointer',
} as const

const heroPrimaryButtonStyle = css({
  ...heroBaseButtonStyle,
  background: T.ink,
  color: T.paper,
  fontWeight: 700,
  '&:hover': { background: T.inkSoft },
})

const heroGhostButtonStyle = css({
  ...heroBaseButtonStyle,
  background: 'transparent',
  color: T.ink,
  fontWeight: 500,
  '&:hover': { background: T.panelStrong },
})

const heroStatRowStyle = css({
  marginTop: '28px',
  display: 'flex',
  gap: '18px',
  fontSize: '10px',
  letterSpacing: '0.14em',
  opacity: 0.55,
  textTransform: 'uppercase',
})

const notesBodyStyle = css({
  fontSize: '12px',
  lineHeight: 1.6,
})

const notesParaStyle = css({ margin: '0 0 12px' })
const notesParaTightStyle = css({ margin: 0 })

const notesMetaStyle = css({
  marginTop: '18px',
  paddingTop: '14px',
  borderTop: `1px dashed ${T.ink}`,
  fontSize: '10px',
  letterSpacing: '0.12em',
  opacity: 0.7,
})

const notesMetaRowStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: '4px',
  '&:first-child': { marginTop: 0 },
})

const compassRowStyle = css({
  marginTop: '18px',
  border: `1px solid ${T.ink}`,
  padding: '14px',
  background: T.panel,
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
})

const compassSvgStyle = css({ flex: '0 0 auto' })

const compassTextStyle = css({
  fontSize: '10px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  lineHeight: 1.6,
})

const compassMutedStyle = css({ opacity: 0.7 })

const compassAccentStyle = css({ fontWeight: 700, color: T.accent })

const catalogStyle = css({})

const catalogHeaderStyle = css({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  borderBottom: `1px solid ${T.ink}`,
  paddingBottom: '12px',
  marginBottom: '24px',
  flexWrap: 'wrap',
  gap: '12px',
})

const catalogTitleStyle = css({
  margin: 0,
  fontSize: '16px',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  fontWeight: 700,
})

const catalogCountStyle = css({
  fontSize: '10px',
  letterSpacing: '0.14em',
  opacity: 0.6,
  textTransform: 'uppercase',
})

const catalogGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
  gap: '18px',
})

const cardStyle = css({
  display: 'block',
  textDecoration: 'none',
  color: T.ink,
  border: `1px solid ${T.ink}`,
  background: T.panel,
  position: 'relative',
  transition: 'background 0.15s',
  '&:hover': { background: T.panelStrong },
})

const cardStripStyle = css({
  display: 'grid',
  gridTemplateColumns: '54px 1fr 90px',
  borderBottom: `1px solid ${T.ink}`,
  fontSize: '10px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
})

const cardStripIdStyle = css({
  padding: '8px 10px',
  borderRight: `1px solid ${T.ink}`,
  opacity: 0.7,
})

const cardStripCodeStyle = css({
  padding: '8px 12px',
  borderRight: `1px solid ${T.ink}`,
  fontWeight: 700,
})

const cardStripOpenStyle = css({
  padding: '8px 10px',
  textAlign: 'right',
  color: T.accent,
  fontWeight: 700,
})

const cardBodyStyle = css({
  padding: '20px 18px',
  display: 'grid',
  gridTemplateColumns: '1fr 110px',
  gap: '16px',
  alignItems: 'center',
})

const cardShortStyle = css({
  fontSize: '22px',
  fontWeight: 700,
  letterSpacing: '0.01em',
  textTransform: 'uppercase',
})

const cardSubStyle = css({
  fontSize: '11px',
  opacity: 0.7,
  marginTop: '6px',
  lineHeight: 1.5,
})

const cardFootStyle = css({
  borderTop: `1px dashed ${T.ink}`,
  padding: '8px 14px',
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '9px',
  letterSpacing: '0.14em',
  opacity: 0.65,
  textTransform: 'uppercase',
  gap: '8px',
})

const schemaSvgStyle = css({ width: '110px', height: '60px' })

const draftSlotStyle = css({
  border: `1px dashed ${T.ink}`,
  padding: '20px 18px',
  background: 'transparent',
  minHeight: '158px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  opacity: 0.55,
})

const draftSlotEyebrowStyle = css({
  fontSize: '10px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  opacity: 0.8,
})

const draftSlotDashStyle = css({
  fontSize: '22px',
  fontWeight: 700,
  letterSpacing: '0.01em',
  textTransform: 'uppercase',
})

const bottomGridStyle = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: '18px',
  '@media (max-width: 880px)': { gridTemplateColumns: '1fr' },
})

const legendRowStyle = css({
  display: 'grid',
  gridTemplateColumns: '20px 1fr',
  gap: '10px',
  alignItems: 'flex-start',
  padding: '8px 0',
  borderTop: `1px dashed ${T.ink}`,
  '&:first-child': { borderTop: 'none' },
})

const legendSwatchCellStyle = css({ paddingTop: '2px' })

const legendSwatchSolidStyle = css({
  display: 'inline-block',
  width: '12px',
  height: '12px',
  background: T.accent,
})

const legendSwatchOutlineStyle = css({
  display: 'inline-block',
  width: '12px',
  height: '12px',
  border: `1px solid ${T.ink}`,
})

const legendKStyle = css({ fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em' })
const legendVStyle = css({ fontSize: '12px', opacity: 0.7, marginTop: '2px', lineHeight: 1.4 })

const listItemStyle = css({
  padding: '8px 0',
  borderTop: `1px dashed ${T.ink}`,
  display: 'grid',
  gridTemplateColumns: '36px 1fr',
  gap: '8px',
  '&:first-child': { borderTop: 'none' },
})

const listItemNumStyle = css({
  fontSize: '10px',
  letterSpacing: '0.14em',
  opacity: 0.6,
  paddingTop: '2px',
})

const listItemTitleStyle = css({ fontSize: '12px', fontWeight: 700, letterSpacing: '0.02em' })
const listItemAuthorStyle = css({ fontSize: '11px', opacity: 0.7, marginTop: '2px' })

const draftingRoomBodyStyle = css({ fontSize: '12px', lineHeight: 1.55 })

const draftingRoomFootStyle = css({
  marginTop: '14px',
  fontSize: '10px',
  letterSpacing: '0.14em',
  opacity: 0.7,
  textTransform: 'uppercase',
})
