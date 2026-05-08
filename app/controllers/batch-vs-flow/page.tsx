import { Layout } from '../../ui/layout.tsx'
import { Comparison } from './comparison.tsx'

export function BatchVsFlowPage() {
  return () => (
    <Layout title="Batch vs. Flow — Efficiency Lab" slug="batch-vs-flow">
      <Comparison />
    </Layout>
  )
}
