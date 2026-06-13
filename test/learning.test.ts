import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'

import {
  DEFAULT_CONFIG,
  FORECAST_TARGET,
  HISTORICAL_SERIES,
  INTERVENTIONS,
  LearningRamp,
  RAMP_CEILING,
  SCENARIO_PRESETS,
  STARTING_CREDITS,
  getIntervention,
  learningExponent,
  type LearningConfig,
} from '../app/controllers/wrights-law/learning.ts'

function config(overrides: Partial<LearningConfig> = {}): LearningConfig {
  return { ...DEFAULT_CONFIG, ...overrides }
}

describe('learningExponent', () => {
  it('maps an 85% learning rate to the canonical exponent', () => {
    // b = log2(0.85) ≈ -0.2345
    assert.ok(Math.abs(learningExponent(0.85) - -0.234465) < 1e-5)
  })

  it('a 50% learning rate has exponent exactly -1', () => {
    assert.ok(Math.abs(learningExponent(0.5) - -1) < 1e-9)
  })
})

describe('LearningRamp unit cost', () => {
  it('the first unit costs exactly the first-unit cost', () => {
    let ramp = new LearningRamp(config())
    assert.equal(ramp.unitCostAt(1), DEFAULT_CONFIG.firstUnitCost)
  })

  it('doubling cumulative output multiplies cost by the learning rate', () => {
    let ramp = new LearningRamp(config({ learningRate: 0.8, firstUnitCost: 100 }))
    let c1 = ramp.unitCostAt(1000)
    let c2 = ramp.unitCostAt(2000)
    assert.ok(Math.abs(c2 / c1 - 0.8) < 1e-9)
  })

  it('reproduces the solar headline: ~26 doublings at 80% lands near pennies', () => {
    let ramp = new LearningRamp(config({ learningRate: 0.8, firstUnitCost: 100 }))
    let n = Math.pow(2, 26)
    let cost = ramp.unitCostAt(n)
    // 100 × 0.8^26 ≈ $0.27 — the famous $100/W → $0.26/W collapse.
    assert.ok(cost > 0.2 && cost < 0.35, `expected ~$0.27, got ${cost}`)
  })
})

describe('LearningRamp ramp progression', () => {
  it('advances cumulative output by rate × time', () => {
    let ramp = new LearningRamp(config({ productionRate: 100 }))
    ramp.step(10)
    // started at 1 unit, +1000
    assert.ok(Math.abs(ramp.snapshot().cumUnits - 1001) < 1e-6)
  })

  it('a zero-length step is a no-op', () => {
    let ramp = new LearningRamp(config())
    let before = ramp.snapshot()
    ramp.step(0)
    let after = ramp.snapshot()
    assert.equal(after.cumUnits, before.cumUnits)
    assert.equal(after.totalCost, before.totalCost)
  })

  it('total cost-to-date is monotonic and at least the first-unit cost', () => {
    let ramp = new LearningRamp(config())
    assert.equal(ramp.snapshot().totalCost, DEFAULT_CONFIG.firstUnitCost)
    let prev = ramp.snapshot().totalCost
    for (let i = 0; i < 20; i++) {
      ramp.step(1)
      let now = ramp.snapshot().totalCost
      assert.ok(now >= prev)
      prev = now
    }
  })

  it('the closed-form integral tracks a brute-force unit sum within a percent', () => {
    let ramp = new LearningRamp(config({ productionRate: 1000 }))
    ramp.step(5) // 5000 units produced this run
    let snap = ramp.snapshot()
    let brute = 0
    for (let n = 1; n <= Math.round(snap.cumUnits); n++) brute += ramp.unitCostAt(n)
    assert.ok(
      Math.abs(snap.totalCost - brute) / brute < 0.01,
      `integral ${snap.totalCost} vs sum ${brute}`,
    )
  })

  it('parks at the ceiling and stops advancing', () => {
    let ramp = new LearningRamp(config({ productionRate: RAMP_CEILING }))
    ramp.step(5)
    assert.ok(ramp.atCeiling())
    assert.equal(ramp.snapshot().cumUnits, RAMP_CEILING)
    ramp.step(5)
    assert.equal(ramp.snapshot().cumUnits, RAMP_CEILING)
  })
})

describe('interventions', () => {
  it('redesign cuts unit cost by 15% instantly', () => {
    let ramp = new LearningRamp(config())
    ramp.step(2)
    let before = ramp.snapshot().unitCost
    assert.ok(ramp.apply('redesign'))
    let after = ramp.snapshot().unitCost
    assert.ok(Math.abs(after / before - 0.85) < 1e-9)
  })

  it('scale up doubles the live rate without an instant cost change', () => {
    let ramp = new LearningRamp(config({ productionRate: 100 }))
    ramp.step(1)
    let before = ramp.snapshot().unitCost
    ramp.apply('scaleUp')
    let snap = ramp.snapshot()
    assert.equal(snap.rate, 200)
    assert.equal(snap.unitCost, before)
  })

  it('spends credits and refuses once the budget is gone', () => {
    let ramp = new LearningRamp(config())
    assert.equal(ramp.snapshot().credits, STARTING_CREDITS)
    // redesign costs 2; two of them exhaust the 4-credit pool.
    assert.ok(ramp.apply('redesign'))
    assert.ok(ramp.apply('redesign'))
    assert.equal(ramp.snapshot().credits, 0)
    assert.equal(ramp.canApply('redesign'), false)
    assert.equal(ramp.apply('redesign'), false)
  })

  it('every catalogued intervention is resolvable by id', () => {
    for (let lever of INTERVENTIONS) {
      assert.equal(getIntervention(lever.id).id, lever.id)
    }
    assert.throws(() => getIntervention('nope' as never))
  })
})

describe('forecast game', () => {
  it('locks a guess and reveals the actual once the target is crossed', () => {
    let ramp = new LearningRamp(config({ productionRate: 100_000 }))
    ramp.forecastFor(50)
    assert.equal(ramp.snapshot().forecast.locked, true)
    assert.equal(ramp.snapshot().forecast.actual, null)
    ramp.step(1) // blow past FORECAST_TARGET
    let f = ramp.snapshot().forecast
    assert.ok(f.actual != null)
    assert.ok(Math.abs((f.actual as number) - ramp.unitCostAt(FORECAST_TARGET)) < 1e-9)
  })

  it('ignores a second forecast once locked', () => {
    let ramp = new LearningRamp(config())
    ramp.forecastFor(40)
    ramp.forecastFor(10)
    assert.equal(ramp.snapshot().forecast.guess, 40)
  })
})

describe('catalogue integrity', () => {
  it('ships a sandbox plus the three historical presets', () => {
    let ids = SCENARIO_PRESETS.map((p) => p.id)
    assert.deepEqual(ids, ['sandbox', 'solar', 'model-t', 'dram'])
  })

  it('historical series all have sane learning rates and spans', () => {
    for (let s of HISTORICAL_SERIES) {
      assert.ok(s.learningRate > 0 && s.learningRate < 1)
      assert.ok(s.doublings > 0)
    }
  })
})
