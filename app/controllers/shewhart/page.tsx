import { Layout } from '../../ui/layout.tsx'
import { ShewhartSandbox } from './sandbox.tsx'

export function ShewhartPage() {
  return () => (
    <Layout title="Shewhart Sandbox — Efficiency Lab" slug="shewhart">
      <ShewhartSandbox />
    </Layout>
  )
}
