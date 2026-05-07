import type { RemixNode } from 'remix/ui'

import { Document } from './document.tsx'
import { DraftingChrome } from './shell.tsx'

export interface LayoutProps {
  children?: RemixNode
  title?: string
  slug: string
}

export function Layout() {
  return ({ title, slug, children }: LayoutProps) => (
    <Document title={title}>
      <DraftingChrome slug={slug}>{children}</DraftingChrome>
    </Document>
  )
}
