import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'

import {
  SCENARIO_PRESETS,
  Simulator,
  type SimulatorConfig,
} from '../app/controllers/pin-factory/factory.ts'

function balanced(overrides: Partial<SimulatorConfig> = {}): SimulatorConfig {
  return {
    stations: [
      { name: 'A', mean: 10, sigma: 0 },
      { name: 'B', mean: 10, sigma: 0 },
      { name: 'C', mean: 10, sigma: 0 },
    ],
    mode: 'push',
    releaseRate: 0.1,
    kanbanCap: 5,
    seed: 1,
    ...overrides,
  }
}

describe('Simulator', () => {
  it('does not crash on a zero-length step', () => {
    let sim = new Simulator(balanced())
    sim.step(0)
    let s = sim.snapshot()
    assert.equal(s.time, 0)
  })

  it('advances time by exactly dt with no events', () => {
    // Push at zero rate and zero processing — no events should fire
    let sim = new Simulator(balanced({ releaseRate: 1e-12 }))
    sim.step(50)
    assert.ok(Math.abs(sim.snapshot().time - 50) < 1e-6)
  })

  it('completes units with deterministic processing times', () => {
    // σ=0 makes everything deterministic except arrivals.
    let sim = new Simulator(balanced({ releaseRate: 0.05 })) // 1 every 20s
    sim.step(600)
    let s = sim.snapshot()
    assert.ok(s.completedCount > 0, `expected completions, got ${s.completedCount}`)
  })

  it('deterministic from same seed', () => {
    let a = new Simulator(balanced({ seed: 7 }))
    let b = new Simulator(balanced({ seed: 7 }))
    a.step(300)
    b.step(300)
    let sa = a.snapshot()
    let sb = b.snapshot()
    assert.equal(sa.completedCount, sb.completedCount)
    assert.equal(sa.wip, sb.wip)
  })

  it('different seeds diverge', () => {
    let a = new Simulator(balanced({ seed: 1 }))
    let b = new Simulator(balanced({ seed: 2 }))
    a.step(300)
    b.step(300)
    // Throughputs are bounded by release rate; allow equality on integer
    // counts but require divergence somewhere observable.
    let sa = a.snapshot()
    let sb = b.snapshot()
    let stationsDiffer = sa.stations.some((st, i) =>
      Math.abs(st.utilization - sb.stations[i].utilization) > 0.001,
    )
    assert.ok(stationsDiffer, 'utilizations should diverge across seeds')
  })

  it('conserves units (created = completed + in flight)', () => {
    let sim = new Simulator(balanced({ releaseRate: 0.1 }))
    sim.step(300)
    let s = sim.snapshot()
    let inFlight = s.stations.reduce(
      (sum, st) => sum + st.bufferDepth + (st.current ? 1 : 0) + (st.blockedUnit ? 1 : 0),
      0,
    )
    assert.equal(s.completedCount + inFlight, s.completedCount + s.wip)
  })

  it('bottleneck station has the highest queue', () => {
    let sim = new Simulator({
      ...balanced(),
      stations: [
        { name: 'A', mean: 10, sigma: 0.1 },
        { name: 'B', mean: 30, sigma: 0.1 }, // bottleneck
        { name: 'C', mean: 10, sigma: 0.1 },
      ],
      releaseRate: 0.1,
    })
    sim.step(600)
    let s = sim.snapshot()
    let bufferDepths = s.stations.map((st) => st.bufferDepth)
    let maxIdx = bufferDepths.indexOf(Math.max(...bufferDepths))
    assert.equal(maxIdx, 1, `expected queue to pile up at #2; depths=${bufferDepths.join(',')}`)
  })

  it('pull mode K=1 keeps WIP small', () => {
    let cfg: SimulatorConfig = {
      ...balanced(),
      stations: [
        { name: 'A', mean: 10, sigma: 4 },
        { name: 'B', mean: 10, sigma: 4 },
        { name: 'C', mean: 10, sigma: 4 },
      ],
      mode: 'pull',
      kanbanCap: 1,
      seed: 5,
    }
    let sim = new Simulator(cfg)
    sim.step(600)
    let s = sim.snapshot()
    // With K=1 across 3 stations the system holds at most 3 units in flight.
    assert.ok(s.wip <= 3, `pull K=1 WIP should stay ≤3, got ${s.wip}`)
  })

  it('pull mode produces blocked time upstream', () => {
    let cfg: SimulatorConfig = {
      ...balanced(),
      stations: [
        { name: 'A', mean: 5, sigma: 0 }, // fast
        { name: 'B', mean: 20, sigma: 0 }, // slow → A gets blocked
      ],
      mode: 'pull',
      kanbanCap: 1,
      seed: 1,
    }
    let sim = new Simulator(cfg)
    sim.step(300)
    let s = sim.snapshot()
    assert.ok(
      s.stations[0].blockedFraction > 0.4,
      `expected A blocked >40%, got ${(s.stations[0].blockedFraction * 100).toFixed(0)}%`,
    )
  })

  it('hot-tunes station mean without resetting', () => {
    let sim = new Simulator(balanced())
    sim.step(60)
    sim.setStationParams(0, 30, 0)
    sim.step(60)
    let s = sim.snapshot()
    // Just confirms no exception and time advanced.
    assert.ok(s.time >= 120 - 1e-6)
  })

  it('records throughput history once per simulated second', () => {
    let sim = new Simulator(balanced({ releaseRate: 0.1 }))
    sim.step(60)
    let s = sim.snapshot()
    // History samples are taken every 1s; after 60s we expect ~60 samples
    assert.ok(s.history.length >= 50 && s.history.length <= 60, `history=${s.history.length}`)
  })
})

describe('SCENARIO_PRESETS', () => {
  it('every preset builds a valid config and can run for 5 minutes', () => {
    for (let preset of SCENARIO_PRESETS) {
      let sim = new Simulator(preset.build())
      sim.step(300)
      let s = sim.snapshot()
      assert.ok(s.time >= 299, `${preset.id}: time stuck at ${s.time}`)
    }
  })

  it('pull-cap-1 has lower or equal cycle time vs the high-variance push it pairs with', () => {
    let push = SCENARIO_PRESETS.find((p) => p.id === 'high-variance-push')!
    let pull = SCENARIO_PRESETS.find((p) => p.id === 'pull-cap-1')!
    let pushSim = new Simulator(push.build())
    let pullSim = new Simulator(pull.build())
    pushSim.step(600)
    pullSim.step(600)
    let pushCycle = pushSim.snapshot().avgCycleTime
    let pullCycle = pullSim.snapshot().avgCycleTime
    assert.ok(
      pullCycle <= pushCycle,
      `expected pull cycle ≤ push cycle; pull=${pullCycle.toFixed(1)} push=${pushCycle.toFixed(1)}`,
    )
  })
})
