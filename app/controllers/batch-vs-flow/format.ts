export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s'
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  let m = Math.floor(seconds / 60)
  let s = Math.round(seconds - m * 60)
  return `${m}m${s.toString().padStart(2, '0')}s`
}
