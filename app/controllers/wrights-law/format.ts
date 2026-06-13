// Money and big-number formatting for the learning-curve readouts.

export function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1000) return `$${Math.round(value).toLocaleString()}`
  if (value >= 1) return `$${value.toFixed(2)}`
  if (value >= 0.01) return `$${value.toFixed(3)}`
  // Sub-cent values: show enough digits that the number is still legible.
  return `$${value.toPrecision(2)}`
}

export function formatUnits(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return Math.round(value).toString()
}

export function formatYears(value: number): string {
  if (value < 1) return `${(value * 12).toFixed(0)} mo`
  return `${value.toFixed(1)} yr`
}

export function formatRatio(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return `${value.toFixed(1)}×`
}
