import { Layout } from '../../ui/layout.tsx'
import { BatchVsFlowLab } from './lab.tsx'

export function BatchVsFlowPage() {
  return () => (
    <Layout title="Batch vs. Flow — Efficiency Lab" slug="batch-vs-flow">
      <BatchVsFlowLab />
    </Layout>
  )
}
