export interface StageConfig {
  name: string
  cycleTime: number
  setupTime: number
  defectRate: number
}

export type DemandProfile = 'steady' | 'bursty' | 'declining'

export interface BatchFlowConfig {
  stages: StageConfig[]
  batchSize: number
  unitCost: number
  defectCorrelation: number
  demandProfile: DemandProfile
  units: number
}

export interface PipelineMetrics {
  leadTime: number
  firstUnitTime: number
  totalTime: number
  throughput: number
  wip: number
  capitalTiedUp: number
  setupOverhead: number
  defectsDiscovered: number
  defectsShipped: number
}

export interface OutputSample {
  t: number
  completed: number
}

export interface SimulationResult {
  batch: PipelineMetrics
  flow: PipelineMetrics
  batchOutputCurve: OutputSample[]
  flowOutputCurve: OutputSample[]
}

const FLOW_ESCAPE_RATE = 0.02
const BATCH_ESCAPE_RATE = 0.1
const SAMPLE_COUNT = 120

export const DEFAULT_STAGES: StageConfig[] = [
  { name: 'Pulp', cycleTime: 2, setupTime: 6, defectRate: 0.01 },
  { name: 'Press', cycleTime: 2, setupTime: 6, defectRate: 0.02 },
  { name: 'Dry', cycleTime: 3, setupTime: 6, defectRate: 0.02 },
  { name: 'Cut', cycleTime: 1.5, setupTime: 6, defectRate: 0.01 },
  { name: 'Inspect', cycleTime: 1, setupTime: 4, defectRate: 0 },
]

export function combinedDefectRate(stages: StageConfig[]): number {
  return 1 - stages.reduce((p, s) => p * (1 - s.defectRate), 1)
}

export function simulate(config: BatchFlowConfig): SimulationResult {
  let stages = config.stages
  let batchSize = Math.max(1, Math.round(config.batchSize))
  let units = Math.max(1, Math.round(config.units))
  let stageCount = stages.length
  let sumSetup = stages.reduce((s, x) => s + x.setupTime, 0)
  let sumCycle = stages.reduce((s, x) => s + x.cycleTime, 0)
  let maxSetup = stages.reduce((m, x) => Math.max(m, x.setupTime), 0)
  let maxCycle = stages.reduce((m, x) => Math.max(m, x.cycleTime), 0)
  let pDefect = combinedDefectRate(stages)
  let demandFactor = demandPenalty(config.demandProfile)

  let flow: PipelineMetrics = (() => {
    let leadTime = sumSetup + sumCycle
    let firstUnitTime = leadTime
    let perUnit = maxSetup + maxCycle
    let throughput = perUnit > 0 ? 1 / perUnit : 0
    let totalTime = firstUnitTime + Math.max(0, units - 1) * perUnit
    let wip = stageCount
    let capitalTiedUp = wip * config.unitCost
    let setupOverhead = sumSetup + sumCycle > 0 ? sumSetup / (sumSetup + sumCycle) : 0
    let defectsDiscovered = units * pDefect * (1 - FLOW_ESCAPE_RATE)
    let defectsShipped = units * pDefect * FLOW_ESCAPE_RATE * demandFactor
    return {
      leadTime,
      firstUnitTime,
      totalTime,
      throughput,
      wip,
      capitalTiedUp,
      setupOverhead,
      defectsDiscovered,
      defectsShipped,
    }
  })()

  let batch: PipelineMetrics = (() => {
    let leadTime = sumSetup + batchSize * sumCycle
    let firstUnitTime = leadTime
    let perBatch = maxSetup + batchSize * maxCycle
    let throughput = perBatch > 0 ? batchSize / perBatch : 0
    let numBatches = Math.ceil(units / batchSize)
    let totalTime = firstUnitTime + Math.max(0, numBatches - 1) * perBatch
    let wip = stageCount * batchSize
    let capitalTiedUp = wip * config.unitCost
    let setupOverhead =
      sumSetup + batchSize * sumCycle > 0
        ? sumSetup / (sumSetup + batchSize * sumCycle)
        : 0
    // End-of-line inspection is the only catch point. Correlation widens
    // rework events: when a defect is found, the rest of the batch is
    // suspect and rejected too.
    let baseDiscovered = units * pDefect * (1 - BATCH_ESCAPE_RATE)
    let defectsDiscovered = baseDiscovered * (1 + config.defectCorrelation)
    let defectsShipped = units * pDefect * BATCH_ESCAPE_RATE * demandFactor
    return {
      leadTime,
      firstUnitTime,
      totalTime,
      throughput,
      wip,
      capitalTiedUp,
      setupOverhead,
      defectsDiscovered,
      defectsShipped,
    }
  })()

  let totalTime = Math.max(batch.totalTime, flow.totalTime)
  let flowOutputCurve = sampleFlowCurve(
    flow.firstUnitTime,
    maxSetup + maxCycle,
    units,
    totalTime,
  )
  let batchOutputCurve = sampleBatchCurve(
    batch.firstUnitTime,
    maxSetup + batchSize * maxCycle,
    batchSize,
    units,
    totalTime,
  )

  return { batch, flow, batchOutputCurve, flowOutputCurve }
}

function demandPenalty(profile: DemandProfile): number {
  if (profile === 'bursty') return 1.5
  if (profile === 'declining') return 0.7
  return 1
}

function sampleFlowCurve(
  firstOut: number,
  perUnit: number,
  units: number,
  totalTime: number,
): OutputSample[] {
  let samples: OutputSample[] = []
  let span = Math.max(totalTime, firstOut + perUnit)
  let dt = span / Math.max(1, SAMPLE_COUNT - 1)
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    let t = i * dt
    let completed = 0
    if (t >= firstOut && perUnit > 0) {
      completed = Math.min(units, 1 + Math.floor((t - firstOut) / perUnit + 1e-9))
    }
    samples.push({ t, completed })
  }
  samples[SAMPLE_COUNT - 1] = { t: span, completed: units }
  return samples
}

function sampleBatchCurve(
  firstOut: number,
  perBatch: number,
  batchSize: number,
  units: number,
  totalTime: number,
): OutputSample[] {
  let samples: OutputSample[] = []
  let numBatches = Math.ceil(units / batchSize)
  let span = Math.max(totalTime, firstOut + perBatch)
  let dt = span / Math.max(1, SAMPLE_COUNT - 1)
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    let t = i * dt
    let completed = 0
    if (t >= firstOut && perBatch > 0) {
      let k = 1 + Math.floor((t - firstOut) / perBatch + 1e-9)
      completed = Math.min(units, Math.min(k, numBatches) * batchSize)
    } else if (t >= firstOut) {
      completed = Math.min(units, batchSize)
    }
    samples.push({ t, completed })
  }
  samples[SAMPLE_COUNT - 1] = { t: span, completed: units }
  return samples
}

export interface ScenarioPreset {
  id: string
  name: string
  description: string
  build: () => BatchFlowConfig
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'papermaking-vats',
    name: 'Papermaking · 18C vats',
    description: 'High setup, modest defect rate. Big batches look attractive.',
    build: () => ({
      stages: [
        { name: 'Pulp', cycleTime: 2, setupTime: 30, defectRate: 0.02 },
        { name: 'Vat', cycleTime: 4, setupTime: 30, defectRate: 0.03 },
        { name: 'Press', cycleTime: 2, setupTime: 20, defectRate: 0.02 },
        { name: 'Dry', cycleTime: 3, setupTime: 20, defectRate: 0.02 },
        { name: 'Trim', cycleTime: 1, setupTime: 10, defectRate: 0.01 },
      ],
      batchSize: 80,
      unitCost: 12,
      defectCorrelation: 0.6,
      demandProfile: 'steady',
      units: 400,
    }),
  },
  {
    id: 'fourdrinier',
    name: 'Fourdrinier · continuous',
    description: 'Setup is negligible, units flow. Batch loses on lead time, ties on throughput.',
    build: () => ({
      stages: [
        { name: 'Pulp', cycleTime: 2, setupTime: 1, defectRate: 0.01 },
        { name: 'Wire', cycleTime: 2, setupTime: 1, defectRate: 0.01 },
        { name: 'Press', cycleTime: 2, setupTime: 1, defectRate: 0.01 },
        { name: 'Dry', cycleTime: 2, setupTime: 1, defectRate: 0.01 },
        { name: 'Reel', cycleTime: 1, setupTime: 1, defectRate: 0 },
      ],
      batchSize: 1,
      unitCost: 8,
      defectCorrelation: 0.3,
      demandProfile: 'steady',
      units: 400,
    }),
  },
  {
    id: 'fragile-electronics',
    name: 'Fragile electronics',
    description: 'High per-stage defect rate. Batch rework events are large; flow contains damage.',
    build: () => ({
      stages: [
        { name: 'Place', cycleTime: 3, setupTime: 4, defectRate: 0.06 },
        { name: 'Solder', cycleTime: 4, setupTime: 4, defectRate: 0.05 },
        { name: 'Reflow', cycleTime: 5, setupTime: 4, defectRate: 0.04 },
        { name: 'Test', cycleTime: 2, setupTime: 2, defectRate: 0.02 },
        { name: 'Pack', cycleTime: 1, setupTime: 2, defectRate: 0 },
      ],
      batchSize: 40,
      unitCost: 60,
      defectCorrelation: 0.8,
      demandProfile: 'bursty',
      units: 200,
    }),
  },
  {
    id: 'balanced-default',
    name: 'Balanced default',
    description: 'Five stages, mid setup, mid defect. Slide batch size and watch trade-offs.',
    build: () => ({
      stages: DEFAULT_STAGES.map((s) => ({ ...s })),
      batchSize: 50,
      unitCost: 10,
      defectCorrelation: 0.6,
      demandProfile: 'steady',
      units: 200,
    }),
  },
]
