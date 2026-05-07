import { css, type RemixNode } from 'remix/ui'

import { routes } from '../routes.ts'

export interface DocumentProps {
  children?: RemixNode
  title?: string
}

const DEFAULT_TITLE = decodeURIComponent('Efficiency%20Lab')

export function Document() {
  return ({ title = DEFAULT_TITLE, children }: DocumentProps) => (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
      </head>
      <body mix={bodyStyle}>
        {children}
        <script type="module" src={routes.assets.href({ path: 'app/assets/entry.ts' })}></script>
      </body>
    </html>
  )
}

const bodyStyle = css({
  margin: 0,
  background: '#dee2e6',
  '@media (prefers-color-scheme: dark)': {
    background: '#1e2226',
  },
})
