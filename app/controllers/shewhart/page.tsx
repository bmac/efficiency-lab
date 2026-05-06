import { Document } from '../../ui/document.tsx'
import { ShewhartSandbox } from './sandbox.tsx'

export function ShewhartPage() {
  return () => (
    <Document title="Shewhart Sandbox — Efficiency Lab">
      <ShewhartSandbox />
    </Document>
  )
}
