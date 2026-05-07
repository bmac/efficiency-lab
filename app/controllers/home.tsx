import type { BuildAction } from 'remix/fetch-router'
import { css } from 'remix/ui'

import type { routes } from '../routes.ts'
import { Layout } from '../ui/layout.tsx'
import { render } from '../utils/render.tsx'

export const home: BuildAction<'GET', typeof routes.home> = {
  handler({ request }) {
    return render(<HomePage />, request)
  },
}

interface ToolEntry {
  href: string
  title: string
  status: 'live' | 'planned'
  blurb: string
}

const TOOLS: ToolEntry[] = [
  {
    href: '/red-beads',
    title: 'Red Bead Experiment',
    status: 'live',
    blurb:
      "Deming's defect-rate demo. Six workers, one jar, four rounds. Watch the leaderboard mean nothing.",
  },
  {
    href: '/shewhart',
    title: 'Shewhart Sandbox',
    status: 'live',
    blurb:
      'Inject special-cause variation into a stable process. Practice ignoring noise. Western Electric rules.',
  },
  {
    href: '/pin-factory',
    title: 'Pin Factory Simulator',
    status: 'live',
    blurb:
      'Five-station serial line. Slide variance up, watch buffers grow. Push vs. pull, live throughput.',
  },
]

function HomePage() {
  return () => (
    <Layout title="Origins of Efficiency Lab">
      <section mix={pageStyle}>
        <header mix={headerStyle}>
          <p mix={kickerStyle}>Origins of Efficiency Lab</p>
          <h1 mix={titleStyle}>Interactive demos for the things Potter writes about.</h1>
          <p mix={leadStyle}>
            Three small simulations exploring statistical process control, batch flow, and the
            mechanics of variation. Built to kick the tires on Remix 3.
          </p>
        </header>
        <ul mix={toolListStyle}>
          {TOOLS.map((t) => (
            <li key={t.href}>
              <a
                href={t.status === 'live' ? t.href : undefined}
                aria-disabled={t.status === 'planned' ? 'true' : undefined}
                mix={toolCardStyle(t.status)}
              >
                <div mix={toolHeaderStyle}>
                  <h2 mix={toolTitleStyle}>{t.title}</h2>
                  <span mix={toolStatusStyle(t.status)}>{t.status}</span>
                </div>
                <p mix={toolBlurbStyle}>{t.blurb}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  )
}

const pageStyle = css({
  '--surface-0': '#dee2e6',
  '--surface-3': '#f0f4f7',
  '--surface-4': '#f7fbff',
  '--text-primary': '#313539',
  '--text-tertiary': '#6f757b',
  '--brand-blue': '#2dacf9',
  '@media (prefers-color-scheme: dark)': {
    '--surface-0': '#1e2226',
    '--surface-3': '#3a4148',
    '--surface-4': '#4a525a',
    '--text-primary': '#e8ecef',
    '--text-tertiary': '#a8aeb3',
  },
  '& *, & *::before, & *::after': { boxSizing: 'border-box' },
  fontFamily:
    "'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
  color: 'var(--text-primary)',
  background: 'var(--surface-0)',
  minHeight: '100vh',
  margin: 0,
  padding: '48px clamp(16px, 4vw, 64px)',
  display: 'flex',
  flexDirection: 'column',
  gap: '32px',
})

const headerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  maxWidth: '720px',
})

const kickerStyle = css({
  margin: 0,
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--text-tertiary)',
})

const titleStyle = css({
  margin: 0,
  fontSize: '28px',
  fontWeight: 700,
  lineHeight: 1.25,
})

const leadStyle = css({
  margin: 0,
  fontSize: '14px',
  lineHeight: 1.6,
  color: 'var(--text-tertiary)',
})

const toolListStyle = css({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'grid',
  gap: '12px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  maxWidth: '960px',
})

function toolCardStyle(status: ToolEntry['status']) {
  return css({
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '20px',
    borderRadius: '12px',
    background: 'var(--surface-3)',
    color: 'var(--text-primary)',
    textDecoration: 'none',
    transition: 'background-color 120ms ease, transform 120ms ease',
    cursor: status === 'planned' ? 'not-allowed' : 'pointer',
    opacity: status === 'planned' ? 0.55 : 1,
    '&:hover': {
      background: status === 'planned' ? 'var(--surface-3)' : 'var(--surface-4)',
    },
  })
}

const toolHeaderStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
})

const toolTitleStyle = css({
  margin: 0,
  fontSize: '16px',
  fontWeight: 700,
})

function toolStatusStyle(status: ToolEntry['status']) {
  return css({
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '2px 8px',
    borderRadius: '999px',
    background: status === 'live' ? 'var(--brand-blue)' : 'var(--surface-0)',
    color: status === 'live' ? 'white' : 'var(--text-tertiary)',
  })
}

const toolBlurbStyle = css({
  margin: 0,
  fontSize: '13px',
  lineHeight: 1.5,
  color: 'var(--text-tertiary)',
})
