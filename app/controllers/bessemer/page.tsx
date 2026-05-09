import { Layout } from '../../ui/layout.tsx'
import { BessemerLab } from './lab.tsx'

export function BessemerPage() {
  return () => (
    <Layout title="Bessemer Cost Collapse — Efficiency Lab" slug="bessemer">
      <BessemerLab />
    </Layout>
  )
}
