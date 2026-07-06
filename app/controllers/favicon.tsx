import type { BuildAction } from 'remix/fetch-router'

import type { routes } from '../routes.ts'
import { T } from '../ui/shell.tsx'

// Blueprint favicon: an ink-framed sheet with an accent control-chart trace —
// the recurring motif of the lab. Uses the shared design tokens so the icon
// stays in sync with the rest of the drafting-room look.
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect x="1.5" y="1.5" width="29" height="29" rx="2.5" fill="${T.paper}" stroke="${T.ink}" stroke-width="2"/>
  <line x1="6" y1="16" x2="26" y2="16" stroke="${T.ink}" stroke-width="1" opacity="0.45"/>
  <polyline points="6,21 11,13 16,17 21,8 26,13" fill="none" stroke="${T.accent}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="21" cy="8" r="2.2" fill="${T.accent}"/>
</svg>`

export const favicon: BuildAction<'GET', typeof routes.favicon> = {
  handler() {
    return new Response(FAVICON, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  },
}
