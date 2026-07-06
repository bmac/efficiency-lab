import { Layout } from '../../ui/layout.tsx'
import { CheapestTonLab } from './lab.tsx'

export function CheapestTonPage() {
  return () => (
    <Layout title="The Cheapest Ton — Efficiency Lab" slug="cheapest-ton">
      <CheapestTonLab />
    </Layout>
  )
}
