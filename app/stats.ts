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

// Standard normal sample using Box-Muller. Returns one variate per call;
// pairs are not reused to keep determinism trivial under the seeded PRNG.
export function sampleStandardNormal(rand: () => number): number {
  let u1 = Math.max(rand(), 1e-12)
  let u2 = rand()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

export function sampleNormal(rand: () => number, mu: number, sigma: number): number {
  return mu + sigma * sampleStandardNormal(rand)
}

// Western Electric Run Rules for an X-bar chart, applied to the series of
// subgroup means against control-limit-derived 1σ/2σ/3σ zones.
//
// Conventions:
// - sigmaXbar = (UCL - CL) / 3
// - Rule 1: a single point beyond ±3σ
// - Rule 2: 2 of 3 consecutive on the same side, beyond ±2σ
// - Rule 3: 4 of 5 consecutive on the same side, beyond ±1σ
// - Rule 4: 8 consecutive on the same side of CL
//
// Each result is the set of rule numbers that fired *at* index i (i is the
// most-recent point of the violating window). An empty set means in-control.
export interface WesternElectricRule {
  number: 1 | 2 | 3 | 4
  description: string
}

export const WESTERN_ELECTRIC_RULES: Record<1 | 2 | 3 | 4, WesternElectricRule> = {
  1: { number: 1, description: '1 point beyond 3σ' },
  2: { number: 2, description: '2 of 3 beyond 2σ on the same side' },
  3: { number: 3, description: '4 of 5 beyond 1σ on the same side' },
  4: { number: 4, description: '8 in a row on the same side of CL' },
}

export function detectWesternElectric(
  means: readonly number[],
  cl: number,
  sigmaXbar: number,
): (1 | 2 | 3 | 4)[][] {
  let result: (1 | 2 | 3 | 4)[][] = means.map(() => [])
  if (sigmaXbar <= 0) return result

  let upper3 = cl + 3 * sigmaXbar
  let lower3 = cl - 3 * sigmaXbar
  let upper2 = cl + 2 * sigmaXbar
  let lower2 = cl - 2 * sigmaXbar
  let upper1 = cl + sigmaXbar
  let lower1 = cl - sigmaXbar

  for (let i = 0; i < means.length; i++) {
    let v = means[i]
    if (v > upper3 || v < lower3) result[i].push(1)

    if (i >= 2) {
      let win = means.slice(i - 2, i + 1)
      let above = win.filter((x) => x > upper2).length
      let below = win.filter((x) => x < lower2).length
      if (above >= 2 || below >= 2) result[i].push(2)
    }

    if (i >= 4) {
      let win = means.slice(i - 4, i + 1)
      let above = win.filter((x) => x > upper1).length
      let below = win.filter((x) => x < lower1).length
      if (above >= 4 || below >= 4) result[i].push(3)
    }

    if (i >= 7) {
      let win = means.slice(i - 7, i + 1)
      if (win.every((x) => x > cl) || win.every((x) => x < cl)) result[i].push(4)
    }
  }

  return result
}
