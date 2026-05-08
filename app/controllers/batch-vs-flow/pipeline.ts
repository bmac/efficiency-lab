import { mulberry32, sampleStandardNormal } from '../../stats.ts'

export interface StageConfig {
  name: string
  cycleTime: number
  setupTime: number
  defectRate: number
}

export interface PipelineConfig {
  stages: StageConfig[]
  batchSize: number
  varianceCV: number
  defectCorrelation: number
  unitCost: number
}

export interface UnitRecord {
  id: number
  createdAt: number
  completedAt: number | null
  defective: boolean
}

export type StagePhase = 'idle' | 'setup' | 'processing'

interface StageRuntime {
  current: UnitRecord[] | null
  phase: StagePhase
  phaseStart: number
  phaseEnd: number
  queue: UnitRecord[][]
  setupTime: number
  workTime: number
}

export interface StageSnapshot {
  name: string
  phase: StagePhase
  progress: number
  currentSize: number
  queueBatches: number
  queueUnits: number
  utilization: number
}

export interface PipelineSnapshot {
  time: number
  batchSize: number
  stages: StageSnapshot[]
  completedCount: number
  defectsDiscovered: number
  wip: number
  capitalTiedUp: number
  avgLeadTime: number
  firstUnitOutAt: number | null
  setupFraction: number
  cumulativeOut: readonly { t: number; value: number }[]
  wipHistory: readonly { t: number; value: number }[]
  leadTimes: readonly number[]
}

const MAX_HISTORY_POINTS = 240
const MAX_LEAD_TIMES = 4096

export class Pipeline {
  time = 0
  config: PipelineConfig
  private prng: () => number
  private stages: StageRuntime[]
  private accumulator: UnitRecord[] = []
  private wipCount = 0
  private firstUnitOutAt: number | null = null
  private totalLeadTime = 0
  private completedCount = 0
  private discovered = 0
  private cumulativeSeries: { t: number; value: number }[] = []
  private wipHistory: { t: number; value: number }[] = []
  private leadTimes: number[] = []

  constructor(config: PipelineConfig, seed: number) {
    this.config = config
    this.prng = mulberry32(seed)
    this.stages = config.stages.map(() => makeStage())
  }

  setBatchSize(size: number): void {
    this.config.batchSize = Math.max(1, Math.floor(size))
    if (this.accumulator.length >= this.config.batchSize) {
      this.flushAccumulator()
    }
  }

  setStageDefaults(cycleTime: number, setupTime: number, defectRate: number): void {
    for (let s of this.config.stages) {
      s.cycleTime = cycleTime
      s.setupTime = setupTime
      s.defectRate = defectRate
    }
  }

  setVarianceCV(cv: number): void {
    this.config.varianceCV = Math.max(0, cv)
  }

  receiveUnit(unit: UnitRecord): void {
    this.accumulator.push(unit)
    this.wipCount++
    if (this.accumulator.length >= this.config.batchSize) {
      this.flushAccumulator()
    }
  }

  flushAccumulator(): void {
    if (this.accumulator.length === 0) return
    let batch = this.accumulator
    this.accumulator = []
    this.stages[0].queue.push(batch)
    this.tryStartStages()
  }

  step(endTime: number): void {
    if (endTime <= this.time) return
    this.tryStartStages()
    for (let guard = 0; guard < 100_000; guard++) {
      let nextEvent = this.peekNextEvent()
      if (nextEvent == null || nextEvent > endTime) break
      this.advanceTo(nextEvent)
      this.processEvents()
      this.tryStartStages()
    }
    this.advanceTo(endTime)
    this.sampleMetrics()
  }

  snapshot(): PipelineSnapshot {
    let stages = this.stages.map((s, i) =>
      stageSnapshot(s, this.config.stages[i].name, this.time),
    )
    let avgLeadTime = this.completedCount > 0 ? this.totalLeadTime / this.completedCount : 0
    let setup = this.stages.reduce((sum, s) => sum + s.setupTime, 0)
    let work = this.stages.reduce((sum, s) => sum + s.workTime, 0)
    let setupFraction = setup + work > 0 ? setup / (setup + work) : 0
    return {
      time: this.time,
      batchSize: this.config.batchSize,
      stages,
      completedCount: this.completedCount,
      defectsDiscovered: this.discovered,
      wip: this.wipCount,
      capitalTiedUp: this.wipCount * this.config.unitCost,
      avgLeadTime,
      firstUnitOutAt: this.firstUnitOutAt,
      setupFraction,
      cumulativeOut: this.cumulativeSeries,
      wipHistory: this.wipHistory,
      leadTimes: this.leadTimes,
    }
  }

  private advanceTo(t: number): void {
    let dt = t - this.time
    if (dt <= 1e-12) return
    for (let s of this.stages) {
      if (s.phase === 'setup') s.setupTime += dt
      else if (s.phase === 'processing') s.workTime += dt
    }
    this.time = t
  }

  private peekNextEvent(): number | null {
    let earliest: number | null = null
    for (let s of this.stages) {
      if (s.phase !== 'idle') {
        if (earliest == null || s.phaseEnd < earliest) earliest = s.phaseEnd
      }
    }
    return earliest
  }

  private processEvents(): void {
    for (let i = 0; i < this.stages.length; i++) {
      let s = this.stages[i]
      if (s.phase === 'idle' || s.phaseEnd > this.time + 1e-9) continue
      if (s.phase === 'setup') {
        let cfg = this.config.stages[i]
        let units = s.current!.length
        let dur = this.sampleProcessingTime(cfg.cycleTime * units)
        s.phase = 'processing'
        s.phaseStart = this.time
        s.phaseEnd = this.time + dur
      } else if (s.phase === 'processing') {
        this.applyDefects(s.current!, this.config.stages[i].defectRate)
        let batch = s.current!
        s.current = null
        s.phase = 'idle'
        if (i === this.stages.length - 1) {
          this.completeBatch(batch)
        } else {
          this.stages[i + 1].queue.push(batch)
        }
      }
    }
  }

  private tryStartStages(): void {
    for (let i = 0; i < this.stages.length; i++) {
      let s = this.stages[i]
      if (s.phase !== 'idle' || s.queue.length === 0) continue
      let batch = s.queue.shift()!
      s.current = batch
      let cfg = this.config.stages[i]
      let setupDur = Math.max(0, cfg.setupTime)
      if (setupDur > 0) {
        s.phase = 'setup'
        s.phaseStart = this.time
        s.phaseEnd = this.time + setupDur
      } else {
        let dur = this.sampleProcessingTime(cfg.cycleTime * batch.length)
        s.phase = 'processing'
        s.phaseStart = this.time
        s.phaseEnd = this.time + dur
      }
    }
  }

  private sampleProcessingTime(base: number): number {
    if (base <= 0) return 0.05
    let cv = this.config.varianceCV
    if (cv <= 0) return base
    let z = sampleStandardNormal(this.prng)
    return Math.max(0.05, base * (1 + cv * z))
  }

  private applyDefects(batch: UnitRecord[], rate: number): void {
    if (rate <= 0) return
    let c = this.config.defectCorrelation
    if (c > 0 && batch.length > 1 && this.prng() < c) {
      if (this.prng() < rate) {
        for (let u of batch) u.defective = true
      }
    } else {
      for (let u of batch) {
        if (this.prng() < rate) u.defective = true
      }
    }
  }

  private completeBatch(batch: UnitRecord[]): void {
    for (let u of batch) {
      u.completedAt = this.time
      let lt = this.time - u.createdAt
      this.totalLeadTime += lt
      this.completedCount++
      this.wipCount--
      this.leadTimes.push(lt)
      if (u.defective) this.discovered++
      if (this.firstUnitOutAt == null) this.firstUnitOutAt = this.time
    }
    if (this.leadTimes.length > MAX_LEAD_TIMES) {
      this.leadTimes.splice(0, this.leadTimes.length - MAX_LEAD_TIMES)
    }
  }

  private sampleMetrics(): void {
    let nextT = this.cumulativeSeries.length === 0
      ? Math.floor(this.time)
      : this.cumulativeSeries[this.cumulativeSeries.length - 1].t + 1
    while (nextT <= this.time) {
      this.cumulativeSeries.push({ t: nextT, value: this.completedCount })
      this.wipHistory.push({ t: nextT, value: this.wipCount })
      nextT += 1
    }
    while (this.cumulativeSeries.length > MAX_HISTORY_POINTS) this.cumulativeSeries.shift()
    while (this.wipHistory.length > MAX_HISTORY_POINTS) this.wipHistory.shift()
  }
}

function makeStage(): StageRuntime {
  return {
    current: null,
    phase: 'idle',
    phaseStart: 0,
    phaseEnd: 0,
    queue: [],
    setupTime: 0,
    workTime: 0,
  }
}

function stageSnapshot(s: StageRuntime, name: string, now: number): StageSnapshot {
  let progress = 0
  let dur = s.phaseEnd - s.phaseStart
  if (s.phase !== 'idle' && dur > 0) {
    progress = Math.max(0, Math.min(1, (now - s.phaseStart) / dur))
  }
  let queueUnits = s.queue.reduce((sum, b) => sum + b.length, 0)
  return {
    name,
    phase: s.phase,
    progress,
    currentSize: s.current?.length ?? 0,
    queueBatches: s.queue.length,
    queueUnits,
    utilization: now > 0 ? (s.setupTime + s.workTime) / now : 0,
  }
}

// -------------------------------------------------------------------------
// Lab — pairs a batch pipeline against a flow (batch_size=1) reference,
// fed by a shared demand stream.
// -------------------------------------------------------------------------

export type DemandProfile = 'steady' | 'bursty' | 'declining'

export interface LabConfig {
  stageCount: number
  cycleTime: number
  setupTime: number
  defectRate: number
  varianceCV: number
  defectCorrelation: number
  batchSize: number
  demandRate: number
  demandProfile: DemandProfile
  unitCost: number
  seed: number
}

export const STAGE_NAMES = ['Cut', 'Form', 'Bond', 'Cure', 'Inspect']

export const DEFAULT_LAB_CONFIG: LabConfig = {
  stageCount: 5,
  cycleTime: 4,
  setupTime: 12,
  defectRate: 0.01,
  varianceCV: 0.15,
  defectCorrelation: 0.6,
  batchSize: 50,
  demandRate: 0.4,
  demandProfile: 'steady',
  unitCost: 25,
  seed: 1,
}

export class BatchVsFlowLab {
  time = 0
  config: LabConfig
  batchPipeline: Pipeline
  flowPipeline: Pipeline
  private prng: () => number
  private nextArrivalTime: number
  private nextUnitId = 0

  constructor(config: LabConfig) {
    this.config = { ...config }
    this.prng = mulberry32(config.seed)
    this.batchPipeline = new Pipeline(this.makePipelineConfig(config.batchSize), config.seed + 11)
    this.flowPipeline = new Pipeline(this.makePipelineConfig(1), config.seed + 23)
    this.nextArrivalTime = this.sampleArrival(0)
  }

  step(dt: number): void {
    if (dt <= 0) return
    let endTime = this.time + dt
    while (this.nextArrivalTime <= endTime) {
      this.batchPipeline.step(this.nextArrivalTime)
      this.flowPipeline.step(this.nextArrivalTime)
      this.dispatchArrival(this.nextArrivalTime)
      this.nextArrivalTime = this.sampleArrival(this.nextArrivalTime)
    }
    this.batchPipeline.step(endTime)
    this.flowPipeline.step(endTime)
    this.time = endTime
  }

  setBatchSize(size: number): void {
    this.config.batchSize = Math.max(1, Math.round(size))
    this.batchPipeline.setBatchSize(this.config.batchSize)
  }

  setSetupTime(setupTime: number): void {
    this.config.setupTime = Math.max(0, setupTime)
    this.batchPipeline.setStageDefaults(this.config.cycleTime, this.config.setupTime, this.config.defectRate)
    this.flowPipeline.setStageDefaults(this.config.cycleTime, this.config.setupTime, this.config.defectRate)
  }

  setVarianceCV(cv: number): void {
    this.config.varianceCV = Math.max(0, cv)
    this.batchPipeline.setVarianceCV(this.config.varianceCV)
    this.flowPipeline.setVarianceCV(this.config.varianceCV)
  }

  setDefectRate(rate: number): void {
    this.config.defectRate = Math.max(0, rate)
    this.batchPipeline.setStageDefaults(this.config.cycleTime, this.config.setupTime, this.config.defectRate)
    this.flowPipeline.setStageDefaults(this.config.cycleTime, this.config.setupTime, this.config.defectRate)
  }

  setDemandProfile(profile: DemandProfile): void {
    this.config.demandProfile = profile
  }

  setDemandRate(rate: number): void {
    this.config.demandRate = Math.max(1e-4, rate)
  }

  private makePipelineConfig(batchSize: number): PipelineConfig {
    let stages: StageConfig[] = []
    for (let i = 0; i < this.config.stageCount; i++) {
      stages.push({
        name: STAGE_NAMES[i] ?? `S${i + 1}`,
        cycleTime: this.config.cycleTime,
        setupTime: this.config.setupTime,
        defectRate: this.config.defectRate,
      })
    }
    return {
      stages,
      batchSize,
      varianceCV: this.config.varianceCV,
      defectCorrelation: this.config.defectCorrelation,
      unitCost: this.config.unitCost,
    }
  }

  private dispatchArrival(t: number): void {
    let id = this.nextUnitId++
    this.batchPipeline.receiveUnit({ id, createdAt: t, completedAt: null, defective: false })
    this.flowPipeline.receiveUnit({ id, createdAt: t, completedAt: null, defective: false })
  }

  private sampleArrival(from: number): number {
    let rate = this.demandRateAt(from)
    let u = Math.max(this.prng(), 1e-12)
    return from - Math.log(u) / Math.max(rate, 1e-9)
  }

  private demandRateAt(t: number): number {
    let r = Math.max(this.config.demandRate, 1e-9)
    if (this.config.demandProfile === 'bursty') {
      let phase = (t % 60) / 60
      return phase < 0.25 ? r * 3 : r * 0.4
    }
    if (this.config.demandProfile === 'declining') {
      return r * Math.max(0.1, 1 - t / 600)
    }
    return r
  }
}
