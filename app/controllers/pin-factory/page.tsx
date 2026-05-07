import { Layout } from '../../ui/layout.tsx'
import { FactoryFloor } from './factory-floor.tsx'

export function PinFactoryPage() {
  return () => (
    <Layout title="Pin Factory — Efficiency Lab" slug="pin-factory">
      <FactoryFloor />
    </Layout>
  )
}
