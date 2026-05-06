import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'

import {
  describeInjection,
  generateSubgroups,
  type ProcessConfig,
} from '../app/controllers/shewhart/process.ts'
import { mean, rangeOf } from '../app/stats.ts'

function baseConfig(): ProcessConfig {
  return {
    mu: 10,
    sigma: 1,
    subgroupSize: 5,
    subgroupCount: 30,
    seed: 1,
    injections: [],
  }
}

describe('generateSubgroups', () => {
  it('emits the configured shape', () => {
    let out = generateSubgroups(baseConfig())
    assert.equal(out.length, 30)
    for (let s of out) assert.equal(s.length, 5)
  })

  it('is deterministic for a given seed', () => {
    let a = generateSubgroups(baseConfig())
    let b = generateSubgroups(baseConfig())
    assert.deepEqual(a, b)
  })

  it('mean shift moves the mean from the start subgroup onward', () => {
    let cfg = baseConfig()
    cfg.subgroupCount = 60
    cfg.injections = [
      { id: 'm', kind: 'meanShift', startSubgroup: 31, delta: 5 },
    ]
    let out = generateSubgroups(cfg)
    let before = mean(out.slice(0, 30).map(mean))
    let after = mean(out.slice(30).map(mean))
    assert.ok(Math.abs(before - 10) < 0.5, `before=${before.toFixed(2)}`)
    assert.ok(Math.abs(after - 15) < 0.7, `after=${after.toFixed(2)}`)
  })

  it('variance increase widens the range from the start subgroup onward', () => {
    let cfg = baseConfig()
    cfg.subgroupCount = 100
    cfg.injections = [
      { id: 'v', kind: 'varianceIncrease', startSubgroup: 51, multiplier: 5 },
    ]
    let out = generateSubgroups(cfg)
    let beforeRange = mean(out.slice(0, 50).map(rangeOf))
    let afterRange = mean(out.slice(50).map(rangeOf))
    assert.ok(
      afterRange > beforeRange * 2,
      `expected range to roughly double+; before=${beforeRange.toFixed(2)} after=${afterRange.toFixed(2)}`,
    )
  })

  it('single outlier inflates one observation in the target subgroup', () => {
    let cfg = baseConfig()
    cfg.subgroupCount = 30
    cfg.sigma = 1
    cfg.injections = [{ id: 'o', kind: 'singleOutlier', atSubgroup: 10, sigmas: 8 }]
    let out = generateSubgroups(cfg)
    let target = out[9] // 0-based
    let neighbor = out[8]
    assert.ok(
      Math.max(...target) > 15,
      `expected outlier observation > 15, got max=${Math.max(...target).toFixed(2)}`,
    )
    assert.ok(
      Math.max(...neighbor) < 15,
      `neighbor should be tame, got max=${Math.max(...neighbor).toFixed(2)}`,
    )
  })

  it('without injections, baseline mean drifts close to μ', () => {
    let cfg = baseConfig()
    cfg.subgroupCount = 200
    let out = generateSubgroups(cfg)
    let m = mean(out.map(mean))
    assert.ok(Math.abs(m - 10) < 0.2, `drift: ${m.toFixed(3)}`)
  })
})

describe('describeInjection', () => {
  it('formats a mean shift', () => {
    let s = describeInjection({
      id: 'a',
      kind: 'meanShift',
      startSubgroup: 5,
      delta: 1.5,
    })
    assert.match(s, /Mean shift Δμ=1.50.*subgroup 5/)
  })

  it('formats a variance multiplier', () => {
    let s = describeInjection({
      id: 'b',
      kind: 'varianceIncrease',
      startSubgroup: 12,
      multiplier: 2,
    })
    assert.match(s, /Variance ×2.*subgroup 12/)
  })

  it('formats a single outlier', () => {
    let s = describeInjection({
      id: 'c',
      kind: 'singleOutlier',
      atSubgroup: 7,
      sigmas: 4,
    })
    assert.match(s, /Outlier \(4σ\).*subgroup 7/)
  })
})
