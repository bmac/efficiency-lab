// Mulberry32: tiny seeded PRNG. Same seed → same stream.
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return function rand(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Draw `n` beads from a jar of `N` total with `K` red, without replacement.
// Returns the number of red beads drawn (a hypergeometric random variate).
export function drawHypergeometric(
  rand: () => number,
  N: number,
  K: number,
  n: number,
): number {
  let reds = K
  let total = N
  let successes = 0
  let take = Math.min(n, total)
  for (let i = 0; i < take; i++) {
    if (rand() * total < reds) {
      successes++
      reds--
    }
    total--
  }
  return successes
}

// With-replacement draw (binomial, n trials, prob p of red each).
export function drawBinomial(rand: () => number, n: number, p: number): number {
  let successes = 0
  for (let i = 0; i < n; i++) {
    if (rand() < p) successes++
  }
  return successes
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  let sum = 0
  for (let v of values) sum += v
  return sum / values.length
}

export function rangeOf(values: readonly number[]): number {
  if (values.length === 0) return 0
  let min = values[0]
  let max = values[0]
  for (let v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  return max - min
}

// Standard X-bar/R chart constants by subgroup size.
// Source: ASTM-style tables (A2, D3, D4) for n in [2..10].
const XBAR_R_CONSTANTS: Record<number, { A2: number; D3: number; D4: number }> = {
  2: { A2: 1.88, D3: 0, D4: 3.267 },
  3: { A2: 1.023, D3: 0, D4: 2.574 },
  4: { A2: 0.729, D3: 0, D4: 2.282 },
  5: { A2: 0.577, D3: 0, D4: 2.114 },
  6: { A2: 0.483, D3: 0, D4: 2.004 },
  7: { A2: 0.419, D3: 0.076, D4: 1.924 },
  8: { A2: 0.373, D3: 0.136, D4: 1.864 },
  9: { A2: 0.337, D3: 0.184, D4: 1.816 },
  10: { A2: 0.308, D3: 0.223, D4: 1.777 },
}

export interface XbarRLimits {
  xbar: number
  rbar: number
  uclX: number
  lclX: number
  uclR: number
  lclR: number
  hasLimits: boolean
}

export function xbarRLimits(subgroups: readonly (readonly number[])[]): XbarRLimits {
  let n = subgroups[0]?.length ?? 0
  let constants = XBAR_R_CONSTANTS[n]
  let means = subgroups.map((s) => mean(s))
  let ranges = subgroups.map((s) => rangeOf(s))
  let xbar = mean(means)
  let rbar = mean(ranges)
  if (!constants) {
    return { xbar, rbar, uclX: xbar, lclX: xbar, uclR: rbar, lclR: rbar, hasLimits: false }
  }
  let { A2, D3, D4 } = constants
  return {
    xbar,
    rbar,
    uclX: xbar + A2 * rbar,
    lclX: Math.max(0, xbar - A2 * rbar),
    uclR: D4 * rbar,
    lclR: D3 * rbar,
    hasLimits: true,
  }
}
