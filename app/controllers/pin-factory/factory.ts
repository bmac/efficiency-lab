import { mulberry32, sampleNormal } from '../../stats.ts'

export interface StationConfig {
  name: string
  mean: number
  sigma: number
}

export interface SimulatorConfig {
  stations: StationConfig[]
  mode: 'push' | 'pull'
  releaseRate: number // units per second (push mode)
  kanbanCap: number // max units in flight per station (pull mode)
  seed: number
}

export interface UnitRecord {
  id: number
  createdAt: number
  departedAt: number | null
}

export type StationState = 'working' | 'blocked' | 'starved'

interface Station {
  inputBuffer: UnitRecord[]
  current: UnitRecord | null
  finishTime: number | null
  blockedUnit: UnitRecord | null
  busyTime: number
  starvedTime: number
  blockedTime: number
}

export interface MetricSample {
  t: number
  throughput: number
  cycleTime: number
  wip: number
}

export interface StationSnapshot {
  name: string
  state: StationState
  bufferDepth: number
  current: UnitRecord | null
  blockedUnit: UnitRecord | null
  utilization: number
  starvedFraction: number
  blockedFraction: number
}

const SAMPLE_INTERVAL = 1
const METRIC_WINDOW = 30
const HISTORY_WINDOW = 120

export class Simulator {
  time = 0
  config: SimulatorConfig
  private stations: Station[]
  private prng: () => number
  private nextUnitId = 0
  private nextArrivalTime: number | null = null
  private units: UnitRecord[] = []
  private completed: UnitRecord[] = []
  private history: MetricSample[] = []
  private lastSampleT = 0

  constructor(config: SimulatorConfig) {
    this.config = config
    this.prng = mulberry32(config.seed)
    this.stations = config.stations.map(() => emptyStation())
    if (config.mode === 'push') {
      this.nextArrivalTime = this.sampleArrival()
    }
    this.propagate()
  }

  step(dt: number): void {
    if (dt <= 0) return
    let endTime = this.time + dt
    for (let guard = 0; guard < 10_000; guard++) {
      let nextT = this.peekNextEventTime()
      if (nextT == null || nextT > endTime) break
      this.advanceTo(nextT)
      this.handleEventsAtNow()
      this.propagate()
    }
    this.advanceTo(endTime)
    this.sampleHistoryUpTo(endTime)
  }

  setMode(mode: 'push' | 'pull'): void {
    this.config.mode = mode
    if (mode === 'push' && this.nextArrivalTime == null) {
      this.nextArrivalTime = this.sampleArrival()
    } else if (mode === 'pull') {
      this.nextArrivalTime = null
    }
    this.propagate()
  }

  setReleaseRate(rate: number): void {
    this.config.releaseRate = rate
    if (this.config.mode === 'push') {
      // Re-sample so the rate change takes effect immediately.
      this.nextArrivalTime = this.sampleArrival()
    }
  }

  setKanbanCap(cap: number): void {
    this.config.kanbanCap = cap
    if (this.config.mode === 'pull') this.propagate()
  }

  setStationParams(index: number, mean: number, sigma: number): void {
    let cfg = this.config.stations[index]
    if (!cfg) return
    cfg.mean = mean
    cfg.sigma = sigma
  }

  snapshot(): {
    time: number
    stations: StationSnapshot[]
    history: readonly MetricSample[]
    completedCount: number
    wip: number
    avgCycleTime: number
    throughput: number
  } {
    let stations: StationSnapshot[] = this.stations.map((s, i) => {
      let elapsed = Math.max(this.time, 1e-9)
      let state: StationState =
        s.current != null ? 'working' : s.blockedUnit != null ? 'blocked' : 'starved'
      return {
        name: this.config.stations[i].name,
        state,
        bufferDepth: s.inputBuffer.length,
        current: s.current,
        blockedUnit: s.blockedUnit,
        utilization: s.busyTime / elapsed,
        starvedFraction: s.starvedTime / elapsed,
        blockedFraction: s.blockedTime / elapsed,
      }
    })
    let recent = this.history[this.history.length - 1]
    return {
      time: this.time,
      stations,
      history: this.history,
      completedCount: this.completed.length,
      wip: this.units.length - this.completed.length,
      avgCycleTime: recent?.cycleTime ?? 0,
      throughput: recent?.throughput ?? 0,
    }
  }

  private sampleArrival(): number {
    let u = Math.max(this.prng(), 1e-12)
    let rate = Math.max(this.config.releaseRate, 1e-9)
    return this.time - Math.log(u) / rate
  }

  private capacity(): number {
    return this.config.mode === 'push' ? Infinity : this.config.kanbanCap
  }

  private inFlight(s: number): number {
    let st = this.stations[s]
    return st.inputBuffer.length + (st.current ? 1 : 0) + (st.blockedUnit ? 1 : 0)
  }

  private hasSpace(s: number): boolean {
    return this.inFlight(s) < this.capacity()
  }

  private peekNextEventTime(): number | null {
    let earliest: number | null = null
    if (this.nextArrivalTime != null) earliest = this.nextArrivalTime
    for (let s of this.stations) {
      if (s.finishTime != null) {
        if (earliest == null || s.finishTime < earliest) earliest = s.finishTime
      }
    }
    return earliest
  }

  private handleEventsAtNow(): void {
    if (this.nextArrivalTime != null && this.nextArrivalTime <= this.time + 1e-12) {
      this.handleArrival()
    }
    for (let i = 0; i < this.stations.length; i++) {
      let st = this.stations[i]
      if (st.finishTime != null && st.finishTime <= this.time + 1e-12) {
        this.handleFinish(i)
      }
    }
  }

  private handleArrival(): void {
    let unit: UnitRecord = { id: this.nextUnitId++, createdAt: this.time, departedAt: null }
    this.units.push(unit)
    this.stations[0].inputBuffer.push(unit)
    this.nextArrivalTime = this.sampleArrival()
  }

  private handleFinish(s: number): void {
    let st = this.stations[s]
    let unit = st.current
    if (!unit) return
    st.current = null
    st.finishTime = null
    let nextStation = s + 1
    if (nextStation === this.stations.length) {
      unit.departedAt = this.time
      this.completed.push(unit)
    } else if (this.hasSpace(nextStation)) {
      this.stations[nextStation].inputBuffer.push(unit)
    } else {
      st.blockedUnit = unit
    }
  }

  private propagate(): void {
    let changed = true
    let guard = 0
    while (changed && guard++ < 1000) {
      changed = false
      for (let s = this.stations.length - 2; s >= 0; s--) {
        let st = this.stations[s]
        if (st.blockedUnit != null && this.hasSpace(s + 1)) {
          this.stations[s + 1].inputBuffer.push(st.blockedUnit)
          st.blockedUnit = null
          changed = true
        }
      }
      for (let s = 0; s < this.stations.length; s++) {
        if (this.tryStart(s)) changed = true
      }
    }
  }

  private tryStart(s: number): boolean {
    let st = this.stations[s]
    if (st.current != null || st.blockedUnit != null) return false
    let unit: UnitRecord
    if (s === 0 && this.config.mode === 'pull') {
      if (this.inFlight(0) >= this.capacity()) return false
      unit = { id: this.nextUnitId++, createdAt: this.time, departedAt: null }
      this.units.push(unit)
    } else {
      if (st.inputBuffer.length === 0) return false
      unit = st.inputBuffer.shift()!
    }
    st.current = unit
    let cfg = this.config.stations[s]
    let dt = Math.max(0.01, sampleNormal(this.prng, cfg.mean, cfg.sigma))
    st.finishTime = this.time + dt
    return true
  }

  private advanceTo(t: number): void {
    let dt = t - this.time
    if (dt <= 1e-12) return
    for (let st of this.stations) {
      if (st.current != null) st.busyTime += dt
      else if (st.blockedUnit != null) st.blockedTime += dt
      else if (st.inputBuffer.length === 0) st.starvedTime += dt
    }
    this.time = t
  }

  private sampleHistoryUpTo(t: number): void {
    while (this.lastSampleT + SAMPLE_INTERVAL <= t) {
      this.lastSampleT += SAMPLE_INTERVAL
      let windowStart = this.lastSampleT - METRIC_WINDOW
      let recentCompleted = this.completed.filter(
        (u) =>
          u.departedAt != null &&
          u.departedAt >= windowStart &&
          u.departedAt <= this.lastSampleT,
      )
      let elapsedWindow = Math.min(METRIC_WINDOW, this.lastSampleT)
      let throughput = elapsedWindow > 0 ? recentCompleted.length / elapsedWindow : 0
      let avgCycle =
        recentCompleted.length > 0
          ? recentCompleted.reduce((sum, u) => sum + (u.departedAt! - u.createdAt), 0) /
            recentCompleted.length
          : 0
      let wip = this.units.length - this.completed.length
      this.history.push({ t: this.lastSampleT, throughput, cycleTime: avgCycle, wip })
      while (
        this.history.length > 0 &&
        this.history[0].t < this.lastSampleT - HISTORY_WINDOW
      ) {
        this.history.shift()
      }
    }
  }
}

function emptyStation(): Station {
  return {
    inputBuffer: [],
    current: null,
    finishTime: null,
    blockedUnit: null,
    busyTime: 0,
    starvedTime: 0,
    blockedTime: 0,
  }
}

export interface ScenarioPreset {
  id: string
  name: string
  description: string
  build: () => SimulatorConfig
}

const STATION_NAMES = ['Cut', 'Straighten', 'Sharpen', 'Head', 'Paint']

function uniformStations(mean: number, sigma: number): StationConfig[] {
  return STATION_NAMES.map((name) => ({ name, mean, sigma }))
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'balanced-low-variance',
    name: 'Balanced, low variance',
    description: 'All stations 10s mean, σ=1. Push at 0.10/s. Boring on purpose.',
    build: () => ({
      stations: uniformStations(10, 1),
      mode: 'push',
      releaseRate: 0.1,
      kanbanCap: 5,
      seed: 1,
    }),
  },
  {
    id: 'bottleneck-3',
    name: 'Bottleneck at #3',
    description: 'Station 3 is 15s mean (others 10s). Watch buffer pile up before it.',
    build: () => ({
      stations: [
        { name: 'Cut', mean: 10, sigma: 1 },
        { name: 'Straighten', mean: 10, sigma: 1 },
        { name: 'Sharpen', mean: 15, sigma: 1 },
        { name: 'Head', mean: 10, sigma: 1 },
        { name: 'Paint', mean: 10, sigma: 1 },
      ],
      mode: 'push',
      releaseRate: 0.1,
      kanbanCap: 5,
      seed: 2,
    }),
  },
  {
    id: 'high-variance-push',
    name: 'High variance (push)',
    description: '10s mean, σ=4. Push at 0.10/s. Cycle time fans out.',
    build: () => ({
      stations: uniformStations(10, 4),
      mode: 'push',
      releaseRate: 0.1,
      kanbanCap: 5,
      seed: 3,
    }),
  },
  {
    id: 'pull-cap-1',
    name: 'Pull, K=1 (single piece)',
    description: 'Same high variance, but pull with K=1. Throughput dips, cycle time tightens.',
    build: () => ({
      stations: uniformStations(10, 4),
      mode: 'pull',
      releaseRate: 0.1,
      kanbanCap: 1,
      seed: 3,
    }),
  },
]
