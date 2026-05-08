import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'

import {
  DEFAULT_STAGES,
  SCENARIO_PRESETS,
  combinedDefectRate,
  simulate,
  type BatchFlowConfig,
  type StageConfig,
} from '../app/controllers/batch-vs-flow/simulation.ts'

function uniformStages(
  count: number,
  cycleTime: number,
  setupTime: number,
  defectRate: number,
): StageConfig[] {
  let names = ['Cut', 'Form', 'Heat', 'Inspect', 'Pack']
  return Array.from({ length: count }, (_, i) => ({
    name: names[i] ?? `Stage ${i + 1}`,
    cycleTime,
    setupTime,
    defectRate,
  }))
}

function baseConfig(overrides: Partial<BatchFlowConfig> = {}): BatchFlowConfig {
  return {
    stages: uniformStages(5, 2, 4, 0.02),
    batchSize: 50,
    unitCost: 10,
    defectCorrelation: 0.6,
    demandProfile: 'steady',
    units: 200,
    ...overrides,
  }
}

describe('combinedDefectRate', () => {
  it('returns 0 when every stage is perfect', () => {
    let stages = uniformStages(5, 2, 1, 0)
    assert.equal(combinedDefectRate(stages), 0)
  })

  it('compounds independent defect rates correctly', () => {
    let stages: StageConfig[] = [
      { name: 'A', cycleTime: 1, setupTime: 0, defectRate: 0.1 },
      { name: 'B', cycleTime: 1, setupTime: 0, defectRate: 0.2 },
    ]
    // 1 - (1 - .1)(1 - .2) = 1 - 0.72 = 0.28
    assert.ok(Math.abs(combinedDefectRate(stages) - 0.28) < 1e-9)
  })
})

describe('simulate — flow pipeline', () => {
  it('lead time = sum(setup + cycle) per stage', () => {
    let stages = uniformStages(5, 2, 4, 0)
    let { flow } = simulate(baseConfig({ stages }))
    // 5 * (4 + 2) = 30
    assert.equal(flow.leadTime, 30)
  })

  it('first unit out matches lead time (single piece)', () => {
    let { flow } = simulate(baseConfig())
    assert.equal(flow.firstUnitTime, flow.leadTime)
  })

  it('average WIP equals number of stages', () => {
    let stages = uniformStages(5, 2, 4, 0)
    let { flow } = simulate(baseConfig({ stages }))
    assert.equal(flow.wip, stages.length)
  })

  it('capital tied up = WIP × unit cost', () => {
    let { flow } = simulate(baseConfig({ unitCost: 17 }))
    assert.equal(flow.capitalTiedUp, flow.wip * 17)
  })

  it('lead time independent of batch size', () => {
    let small = simulate(baseConfig({ batchSize: 5 })).flow.leadTime
    let large = simulate(baseConfig({ batchSize: 200 })).flow.leadTime
    assert.equal(small, large)
  })
})

describe('simulate — batch pipeline', () => {
  it('lead time = sum(setup + batch_size × cycle)', () => {
    let stages = uniformStages(5, 2, 4, 0)
    let { batch } = simulate(baseConfig({ stages, batchSize: 50 }))
    // 5 * (4 + 50 * 2) = 5 * 104 = 520
    assert.equal(batch.leadTime, 520)
  })

  it('lead time scales linearly with batch size', () => {
    let a = simulate(baseConfig({ batchSize: 10 })).batch.leadTime
    let b = simulate(baseConfig({ batchSize: 20 })).batch.leadTime
    let c = simulate(baseConfig({ batchSize: 40 })).batch.leadTime
    // (b - a) and (c - b) should both equal 10 * sum(cycle) and 20 * sum(cycle)
    let sumCycle = 5 * 2 // 5 stages × 2s each
    assert.equal(b - a, 10 * sumCycle)
    assert.equal(c - b, 20 * sumCycle)
  })

  it('average WIP ≈ stages × batch size', () => {
    let stages = uniformStages(5, 2, 4, 0)
    let { batch } = simulate(baseConfig({ stages, batchSize: 50 }))
    assert.equal(batch.wip, stages.length * 50)
  })

  it('first unit out is the whole batch (units exit together)', () => {
    let { batch } = simulate(baseConfig({ batchSize: 50 }))
    assert.equal(batch.firstUnitTime, batch.leadTime)
  })

  it('setup overhead share decreases as batch size grows', () => {
    let smallBatch = simulate(baseConfig({ batchSize: 1 })).batch.setupOverhead
    let bigBatch = simulate(baseConfig({ batchSize: 200 })).batch.setupOverhead
    assert.ok(bigBatch < smallBatch, `expected ${bigBatch} < ${smallBatch}`)
  })
})

describe('simulate — comparison', () => {
  it('batch and flow agree at batch size = 1', () => {
    let cfg = baseConfig({ batchSize: 1 })
    let { batch, flow } = simulate(cfg)
    assert.equal(batch.leadTime, flow.leadTime)
    assert.equal(batch.wip, flow.wip)
    assert.equal(batch.capitalTiedUp, flow.capitalTiedUp)
  })

  it('batch lead time exceeds flow lead time once batch size > 1', () => {
    let { batch, flow } = simulate(baseConfig({ batchSize: 50 }))
    assert.ok(batch.leadTime > flow.leadTime)
  })

  it('high setup time makes batch throughput beat flow at large batch size', () => {
    let stages = uniformStages(5, 2, 30, 0) // setup of 30s, cycle 2s
    let { batch, flow } = simulate(baseConfig({ stages, batchSize: 200 }))
    assert.ok(
      batch.throughput > flow.throughput,
      `expected batch throughput ${batch.throughput} > flow ${flow.throughput}`,
    )
  })

  it('zero setup makes flow throughput at least batch throughput', () => {
    let stages = uniformStages(5, 2, 0, 0)
    let { batch, flow } = simulate(baseConfig({ stages, batchSize: 50 }))
    assert.ok(flow.throughput >= batch.throughput - 1e-9)
  })

  it('flow ships fewer defects than batch for the same defect rate', () => {
    let stages = uniformStages(5, 2, 4, 0.05)
    let { batch, flow } = simulate(baseConfig({ stages, batchSize: 50 }))
    assert.ok(
      flow.defectsShipped < batch.defectsShipped,
      `flow=${flow.defectsShipped} batch=${batch.defectsShipped}`,
    )
  })

  it('zero defect rate produces zero shipped defects on both lines', () => {
    let stages = uniformStages(5, 2, 4, 0)
    let { batch, flow } = simulate(baseConfig({ stages }))
    assert.equal(batch.defectsShipped, 0)
    assert.equal(flow.defectsShipped, 0)
    assert.equal(batch.defectsDiscovered, 0)
    assert.equal(flow.defectsDiscovered, 0)
  })

  it('higher defect correlation increases batch rework volume', () => {
    let stages = uniformStages(5, 2, 4, 0.05)
    let low = simulate(baseConfig({ stages, defectCorrelation: 0.0 })).batch.defectsDiscovered
    let high = simulate(baseConfig({ stages, defectCorrelation: 0.9 })).batch.defectsDiscovered
    assert.ok(high > low, `expected high=${high} > low=${low}`)
  })
})

describe('simulate — output curves', () => {
  it('flow line begins shipping units before the batch line', () => {
    let { batchOutputCurve, flowOutputCurve } = simulate(baseConfig({ batchSize: 50 }))
    let firstFlow = flowOutputCurve.find((p) => p.completed > 0)!
    let firstBatch = batchOutputCurve.find((p) => p.completed > 0)!
    assert.ok(
      firstFlow.t < firstBatch.t,
      `expected first flow=${firstFlow.t} < first batch=${firstBatch.t}`,
    )
  })

  it('output curves are monotonically non-decreasing', () => {
    let { batchOutputCurve, flowOutputCurve } = simulate(baseConfig())
    for (let curve of [batchOutputCurve, flowOutputCurve]) {
      for (let i = 1; i < curve.length; i++) {
        assert.ok(
          curve[i].completed >= curve[i - 1].completed,
          `non-monotone at i=${i}`,
        )
      }
    }
  })

  it('output curves end with all units processed', () => {
    let cfg = baseConfig({ units: 100 })
    let { batchOutputCurve, flowOutputCurve } = simulate(cfg)
    assert.equal(batchOutputCurve[batchOutputCurve.length - 1].completed, cfg.units)
    assert.equal(flowOutputCurve[flowOutputCurve.length - 1].completed, cfg.units)
  })
})

describe('SCENARIO_PRESETS', () => {
  it('every preset builds a valid config that simulates without error', () => {
    for (let preset of SCENARIO_PRESETS) {
      let cfg = preset.build()
      let result = simulate(cfg)
      assert.ok(result.batch.leadTime > 0, `${preset.id}: batch lead time invalid`)
      assert.ok(result.flow.leadTime > 0, `${preset.id}: flow lead time invalid`)
    }
  })

  it('exposes a default stage config of length 5', () => {
    assert.equal(DEFAULT_STAGES.length, 5)
  })
})
