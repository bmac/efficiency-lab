import { Layout } from '../../ui/layout.tsx'
import { RedBeadSimulator } from './simulator.tsx'

export function RedBeadsPage() {
  return () => (
    <Layout title="Red Bead Experiment — Efficiency Lab" slug="red-beads">
      <RedBeadSimulator initialSeed={1} />
    </Layout>
  )
}
