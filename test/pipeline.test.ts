import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'

import {
  BatchVsFlowLab,
  DEFAULT_LAB_CONFIG,
  Pipeline,
  type PipelineConfig,
} from '../app/controllers/batch-vs-flow/pipeline.ts'

function pipelineConfig(overrides: Partial<PipelineConfig> = {}): PipelineConfig {
  return {
    stages: [
      { name: 'A', cycleTime: 2, setupTime: 4, defectRate: 0 },
      { name: 'B', cycleTime: 2, setupTime: 4, defectRate: 0 },
      { name: 'C', cycleTime: 2, setupTime: 4, defectRate: 0 },
    ],
    batchSize: 10,
    varianceCV: 0,
    defectCorrelation: 0,
    unitCost: 10,
    ...overrides,
  }
}

describe('Pipeline', () => {
  it('does not crash on a zero-time step', () => {
    let p = new Pipeline(pipelineConfig(), 1)
    p.step(0)
    assert.equal(p.snapshot().time, 0)
  })

  it('is deterministic for the same seed', () => {
    let a = new Pipeline(pipelineConfig({ varianceCV: 0.3 }), 7)
    let b = new Pipeline(pipelineConfig({ varianceCV: 0.3 }), 7)
    for (let i = 0; i < 10; i++) {
      a.receiveUnit({ id: i, createdAt: 0, completedAt: null, defective: false })
      b.receiveUnit({ id: i, createdAt: 0, completedAt: null, defective: false })
    }
    a.step(120)
    b.step(120)
    assert.equal(a.snapshot().completedCount, b.snapshot().completedCount)
    assert.equal(a.snapshot().avgLeadTime, b.snapshot().avgLeadTime)
  })

  it('flow (batch size 1) finishes the first unit faster than batch=10', () => {
    let cfg = pipelineConfig({ batchSize: 1 })
    let flow = new Pipeline(cfg, 1)
    let batch = new Pipeline(pipelineConfig({ batchSize: 10 }), 2)

    for (let i = 0; i < 20; i++) {
      let u = { id: i, createdAt: 0, completedAt: null, defective: false }
      flow.receiveUnit({ ...u })
      batch.receiveUnit({ ...u })
    }
    flow.step(500)
    batch.step(500)

    let flowFirst = flow.snapshot().firstUnitOutAt!
    let batchFirst = batch.snapshot().firstUnitOutAt!
    assert.ok(
      flowFirst < batchFirst,
      `flow first=${flowFirst} should be < batch first=${batchFirst}`,
    )
  })

  it('large batches keep large WIP at the active station', () => {
    let p = new Pipeline(pipelineConfig({ batchSize: 20 }), 1)
    for (let i = 0; i < 20; i++) {
      p.receiveUnit({ id: i, createdAt: 0, completedAt: null, defective: false })
    }
    p.step(5)
    let snap = p.snapshot()
    let activeUnits = snap.stages.reduce((sum, s) => sum + s.currentSize + s.queueUnits, 0)
    assert.ok(activeUnits >= 20, `expected WIP ≥ 20, got ${activeUnits}`)
  })

  it('lead time matches the analytical formula with no variance and no setup', () => {
    let p = new Pipeline(
      pipelineConfig({
        batchSize: 5,
        stages: [
          { name: 'A', cycleTime: 2, setupTime: 0, defectRate: 0 },
          { name: 'B', cycleTime: 2, setupTime: 0, defectRate: 0 },
          { name: 'C', cycleTime: 2, setupTime: 0, defectRate: 0 },
        ],
      }),
      1,
    )
    for (let i = 0; i < 5; i++) {
      p.receiveUnit({ id: i, createdAt: 0, completedAt: null, defective: false })
    }
    p.step(200)
    let snap = p.snapshot()
    // Formula: stages * (setup + batch*cycle) = 3 * (0 + 5*2) = 30
    assert.equal(snap.completedCount, 5)
    assert.ok(
      Math.abs(snap.avgLeadTime - 30) < 1e-6,
      `expected lead time ~30, got ${snap.avgLeadTime}`,
    )
  })

  it('defect correlation produces lumpy defect counts in big batches', () => {
    let cfg = pipelineConfig({
      batchSize: 50,
      defectCorrelation: 1, // perfectly correlated
      stages: [
        { name: 'A', cycleTime: 0.1, setupTime: 0, defectRate: 0.5 },
        { name: 'B', cycleTime: 0.1, setupTime: 0, defectRate: 0 },
      ],
    })
    let p = new Pipeline(cfg, 1)
    for (let i = 0; i < 50; i++) {
      p.receiveUnit({ id: i, createdAt: 0, completedAt: null, defective: false })
    }
    p.step(200)
    let snap = p.snapshot()
    // With correlation=1 and rate=0.5: either all 50 or 0 defective.
    assert.ok(
      snap.defectsDiscovered === 0 || snap.defectsDiscovered === 50,
      `expected lumpy 0 or 50, got ${snap.defectsDiscovered}`,
    )
  })
})

describe('BatchVsFlowLab', () => {
  it('feeds the same demand stream to both pipelines', () => {
    let lab = new BatchVsFlowLab({ ...DEFAULT_LAB_CONFIG, demandRate: 1, batchSize: 20, seed: 5 })
    lab.step(60)
    let batch = lab.batchPipeline.snapshot()
    let flow = lab.flowPipeline.snapshot()
    // Both pipelines see the same arrivals (WIP+completed = total arrived).
    let batchTotal = batch.completedCount + batch.wip
    let flowTotal = flow.completedCount + flow.wip
    assert.equal(batchTotal, flowTotal)
  })

  it('flow line ships its first unit before the batch line', () => {
    let lab = new BatchVsFlowLab({
      ...DEFAULT_LAB_CONFIG,
      batchSize: 50,
      setupTime: 5,
      varianceCV: 0,
      seed: 9,
    })
    lab.step(600)
    let batch = lab.batchPipeline.snapshot()
    let flow = lab.flowPipeline.snapshot()
    if (flow.firstUnitOutAt != null && batch.firstUnitOutAt != null) {
      assert.ok(
        flow.firstUnitOutAt < batch.firstUnitOutAt,
        `flow=${flow.firstUnitOutAt} batch=${batch.firstUnitOutAt}`,
      )
    } else {
      assert.ok(flow.firstUnitOutAt != null, 'flow should ship at least once')
    }
  })

  it('reducing batch size flushes a partial accumulator', () => {
    let lab = new BatchVsFlowLab({ ...DEFAULT_LAB_CONFIG, batchSize: 20, demandRate: 0.5 })
    lab.step(20)
    // Drop batch size — any partial accumulator should flush downstream.
    lab.setBatchSize(1)
    lab.step(0.01)
    let snap = lab.batchPipeline.snapshot()
    // After a small step the first stage should at least see a batch in flight or done.
    let totalSeen = snap.stages.reduce(
      (sum, s) => sum + s.currentSize + s.queueUnits,
      snap.completedCount,
    )
    assert.ok(totalSeen > 0, 'expected the partial batch to be picked up')
  })

  it('runs deterministically for a fixed seed', () => {
    let a = new BatchVsFlowLab({ ...DEFAULT_LAB_CONFIG, seed: 42 })
    let b = new BatchVsFlowLab({ ...DEFAULT_LAB_CONFIG, seed: 42 })
    a.step(120)
    b.step(120)
    assert.equal(a.batchPipeline.snapshot().completedCount, b.batchPipeline.snapshot().completedCount)
    assert.equal(a.flowPipeline.snapshot().completedCount, b.flowPipeline.snapshot().completedCount)
  })
})
