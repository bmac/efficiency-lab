import { Layout } from '../../ui/layout.tsx'
import { WrightsLawLab } from './lab.tsx'

export function WrightsLawPage() {
  return () => (
    <Layout title="Wright's Law — Efficiency Lab" slug="wrights-law">
      <WrightsLawLab />
    </Layout>
  )
}
