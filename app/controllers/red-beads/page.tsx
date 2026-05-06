import { Document } from '../../ui/document.tsx'
import { RedBeadSimulator } from './simulator.tsx'

export function RedBeadsPage() {
  return () => (
    <Document title="Red Bead Experiment — Efficiency Lab">
      <RedBeadSimulator initialSeed={1} />
    </Document>
  )
}
