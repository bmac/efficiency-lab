import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'

import {
  detectWesternElectric,
  drawBinomial,
  drawHypergeometric,
  mean,
  mulberry32,
  rangeOf,
  sampleNormal,
  sampleStandardNormal,
  WESTERN_ELECTRIC_RULES,
  xbarRLimits,
} from '../app/stats.ts'

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    let a = mulberry32(42)
    let b = mulberry32(42)
    for (let i = 0; i < 50; i++) {
      assert.equal(a(), b())
    }
  })

  it('produces different streams for different seeds', () => {
    let a = mulberry32(1)
    let b = mulberry32(2)
    let same = 0
    for (let i = 0; i < 50; i++) {
      if (a() === b()) same++
    }
    assert.ok(same < 5, `streams should diverge; ${same}/50 matched`)
  })

  it('returns values in [0, 1)', () => {
    let r = mulberry32(123)
    for (let i = 0; i < 1000; i++) {
      let v = r()
      assert.ok(v >= 0 && v < 1, `value out of range: ${v}`)
    }
  })
})

describe('mean and rangeOf', () => {
  it('mean of empty array is 0', () => {
    assert.equal(mean([]), 0)
  })

  it('mean of [1,2,3,4,5] is 3', () => {
    assert.equal(mean([1, 2, 3, 4, 5]), 3)
  })

  it('rangeOf empty array is 0', () => {
    assert.equal(rangeOf([]), 0)
  })

  it('rangeOf [3,1,4,1,5] is 4', () => {
    assert.equal(rangeOf([3, 1, 4, 1, 5]), 4)
  })
})

describe('drawHypergeometric', () => {
  it('K=0 always returns 0', () => {
    let r = mulberry32(1)
    for (let i = 0; i < 50; i++) {
      assert.equal(drawHypergeometric(r, 100, 0, 10), 0)
    }
  })

  it('K=N always returns n', () => {
    let r = mulberry32(1)
    for (let i = 0; i < 50; i++) {
      assert.equal(drawHypergeometric(r, 100, 100, 10), 10)
    }
  })

  it('result is bounded by [0, min(K, n)]', () => {
    let r = mulberry32(7)
    for (let i = 0; i < 200; i++) {
      let v = drawHypergeometric(r, 100, 30, 20)
      assert.ok(v >= 0 && v <= 20, `out of range: ${v}`)
    }
  })

  it('long-run mean approximates n*K/N', () => {
    // Deming defaults: 4000 beads, 800 red, 50-bead paddle → expected mean = 10
    let r = mulberry32(99)
    let total = 0
    let trials = 5000
    for (let i = 0; i < trials; i++) total += drawHypergeometric(r, 4000, 800, 50)
    let observed = total / trials
    assert.ok(
      Math.abs(observed - 10) < 0.3,
      `expected ~10, got ${observed.toFixed(3)}`,
    )
  })
})

describe('drawBinomial', () => {
  it('p=0 always returns 0; p=1 always returns n', () => {
    let r = mulberry32(1)
    for (let i = 0; i < 20; i++) {
      assert.equal(drawBinomial(r, 50, 0), 0)
      assert.equal(drawBinomial(r, 50, 1), 50)
    }
  })

  it('long-run mean approximates n*p', () => {
    let r = mulberry32(11)
    let total = 0
    let trials = 5000
    for (let i = 0; i < trials; i++) total += drawBinomial(r, 50, 0.2)
    let observed = total / trials
    assert.ok(
      Math.abs(observed - 10) < 0.3,
      `expected ~10, got ${observed.toFixed(3)}`,
    )
  })
})

describe('xbarRLimits', () => {
  it('classic 5-subgroup-of-5 example with A2=0.577', () => {
    // Two subgroups, each of size 5
    let subgroups = [
      [10, 11, 9, 10, 10], // mean 10, range 2
      [12, 10, 11, 9, 13], // mean 11, range 4
    ]
    let limits = xbarRLimits(subgroups)
    assert.ok(limits.hasLimits)
    assert.equal(limits.xbar, 10.5)
    assert.equal(limits.rbar, 3)
    // UCL_x = X̄ + A2 * R̄ = 10.5 + 0.577 * 3 = 12.231
    assert.ok(Math.abs(limits.uclX - (10.5 + 0.577 * 3)) < 1e-9)
    // UCL_r = D4 * R̄ = 2.114 * 3 = 6.342
    assert.ok(Math.abs(limits.uclR - 2.114 * 3) < 1e-9)
  })

  it('subgroup size outside table reports hasLimits=false', () => {
    let limits = xbarRLimits([[1], [2]])
    assert.equal(limits.hasLimits, false)
  })

  it('LCL_x is clamped at 0', () => {
    let limits = xbarRLimits([
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 100],
    ])
    assert.ok(limits.lclX >= 0)
  })
})

describe('sampleStandardNormal', () => {
  it('long-run mean ≈ 0 and stddev ≈ 1', () => {
    let r = mulberry32(2024)
    let n = 20_000
    let sum = 0
    let sumSq = 0
    for (let i = 0; i < n; i++) {
      let v = sampleStandardNormal(r)
      sum += v
      sumSq += v * v
    }
    let mu = sum / n
    let sigma = Math.sqrt(sumSq / n - mu * mu)
    assert.ok(Math.abs(mu) < 0.05, `mean drift: ${mu.toFixed(4)}`)
    assert.ok(Math.abs(sigma - 1) < 0.05, `sigma drift: ${sigma.toFixed(4)}`)
  })

  it('sampleNormal scales and shifts', () => {
    let r = mulberry32(7)
    let n = 20_000
    let sum = 0
    for (let i = 0; i < n; i++) sum += sampleNormal(r, 100, 5)
    let mu = sum / n
    assert.ok(Math.abs(mu - 100) < 0.5, `mean drift: ${mu.toFixed(2)}`)
  })
})

describe('detectWesternElectric', () => {
  let cl = 10
  let sigma = 1

  it('Rule 1 fires on a single 3σ excursion', () => {
    let means = [10, 10, 10, 14, 10, 10] // index 3 is +4σ
    let v = detectWesternElectric(means, cl, sigma)
    assert.deepEqual(v[3], [1])
    assert.equal(v[0].length, 0)
  })

  it('Rule 2 fires on 2-of-3 beyond 2σ same side', () => {
    // 2 of 3 above +2σ at index 2
    let means = [10, 12.5, 12.5, 10, 10]
    let v = detectWesternElectric(means, cl, sigma)
    assert.ok(v[2].includes(2), `expected rule 2 at i=2, got ${v[2].join(',')}`)
  })

  it('Rule 3 fires on 4-of-5 beyond 1σ same side', () => {
    let means = [10, 11.5, 11.5, 10, 11.5, 11.5, 10]
    let v = detectWesternElectric(means, cl, sigma)
    // by index 5 we have 4 of last 5 (indexes 1,2,4,5) above +1σ
    assert.ok(v[5].includes(3), `expected rule 3 at i=5, got ${v[5].join(',')}`)
  })

  it('Rule 4 fires on 8 in a row above CL', () => {
    let means = [10.1, 10.1, 10.1, 10.1, 10.1, 10.1, 10.1, 10.1]
    let v = detectWesternElectric(means, cl, sigma)
    assert.ok(v[7].includes(4), `expected rule 4 at i=7, got ${v[7].join(',')}`)
  })

  it('returns empty array for stable process', () => {
    let r = mulberry32(99)
    let means: number[] = []
    for (let i = 0; i < 30; i++) means.push(cl + 0.4 * (r() - 0.5)) // tiny noise inside 1σ
    let v = detectWesternElectric(means, cl, sigma)
    let total = v.flat().length
    assert.equal(total, 0, `expected no violations on stable process, got ${total}`)
  })

  it('exposes the same rule numbers as WESTERN_ELECTRIC_RULES', () => {
    for (let n of [1, 2, 3, 4] as const) {
      assert.equal(WESTERN_ELECTRIC_RULES[n].number, n)
    }
  })
})
