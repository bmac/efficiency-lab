export type ProcessId =
  | 'cementation'
  | 'crucible'
  | 'puddling'
  | 'bessemer-acid'
  | 'open-hearth'
  | 'bessemer-basic'
  | 'basic-open-hearth'

export type OreType = 'low-p' | 'high-p' | 'mixed'
export type Scale = 'small' | 'regional' | 'carnegie'
export type Posture = 'conservative' | 'aggressive'

export interface ProcessSpec {
  id: ProcessId
  name: string
  shortName: string
  availableFrom: number
  midLifeCostUsdPerTon: number
  midLifeDefectRate: number
  throughputFactor: number
  teethingYears: number
  oreCompat: { lowP: boolean; highP: boolean }
  description: string
}

// Cost, defect, throughput, and teething figures are stylized — calibrated to
// reproduce the headline historical shape (Bessemer's first commercial year is
// painful; Thomas-Gilchrist tames high-P ores; puddling cannot survive the
// price collapse) without overfitting to specific firms.
export const PROCESSES: readonly ProcessSpec[] = [
  {
    id: 'cementation',
    name: 'Cementation',
    shortName: 'Cementation',
    availableFrom: 1700,
    midLifeCostUsdPerTon: 200,
    midLifeDefectRate: 0.04,
    throughputFactor: 0.04,
    teethingYears: 0,
    oreCompat: { lowP: true, highP: false },
    description:
      'Carburizes wrought-iron bars in sealed boxes. High-quality blister steel; a workshop, not a mill.',
  },
  {
    id: 'crucible',
    name: 'Crucible',
    shortName: 'Crucible',
    availableFrom: 1740,
    midLifeCostUsdPerTon: 170,
    midLifeDefectRate: 0.02,
    throughputFactor: 0.10,
    teethingYears: 0,
    oreCompat: { lowP: true, highP: false },
    description:
      'Sealed-pot remelting. The quality benchmark of the era; small batches and very low sulphur input.',
  },
  {
    id: 'puddling',
    name: 'Puddling',
    shortName: 'Puddling',
    availableFrom: 1784,
    midLifeCostUsdPerTon: 60,
    midLifeDefectRate: 0.05,
    throughputFactor: 0.50,
    teethingYears: 0,
    oreCompat: { lowP: true, highP: true },
    description:
      'Reverberatory furnace, manual stirring. The 19c workhorse — handles any ore, scales linearly with bodies.',
  },
  {
    id: 'bessemer-acid',
    name: 'Bessemer (acid)',
    shortName: 'Bessemer',
    availableFrom: 1856,
    midLifeCostUsdPerTon: 36,
    midLifeDefectRate: 0.02,
    throughputFactor: 1.0,
    teethingYears: 6,
    oreCompat: { lowP: true, highP: false },
    description:
      'Pear-shaped converter; cold air through molten iron. Cheap, fast, brittle on phosphorus.',
  },
  {
    id: 'open-hearth',
    name: 'Open hearth (Siemens-Martin)',
    shortName: 'Open hearth',
    availableFrom: 1865,
    midLifeCostUsdPerTon: 42,
    midLifeDefectRate: 0.01,
    throughputFactor: 0.7,
    teethingYears: 5,
    oreCompat: { lowP: true, highP: false },
    description:
      'Regenerative gas furnace; long heats, flexible feedstock. Cleaner steel than acid Bessemer.',
  },
  {
    id: 'bessemer-basic',
    name: 'Bessemer + Thomas-Gilchrist',
    shortName: 'Basic Bessemer',
    availableFrom: 1879,
    midLifeCostUsdPerTon: 38,
    midLifeDefectRate: 0.02,
    throughputFactor: 1.0,
    teethingYears: 4,
    oreCompat: { lowP: true, highP: true },
    description:
      'Basic-lined converter. Finally tamed phosphoric ores — the unlock for European and Pennsylvanian mills.',
  },
  {
    id: 'basic-open-hearth',
    name: 'Basic open hearth',
    shortName: 'Basic OH',
    availableFrom: 1880,
    midLifeCostUsdPerTon: 40,
    midLifeDefectRate: 0.008,
    throughputFactor: 0.8,
    teethingYears: 4,
    oreCompat: { lowP: true, highP: true },
    description:
      'Open hearth on a basic lining. The 20c standard for structural and rail steel.',
  },
]

export function getProcess(id: ProcessId): ProcessSpec {
  let p = PROCESSES.find((p) => p.id === id)
  if (!p) throw new Error(`Unknown process: ${id}`)
  return p
}

export function availableProcesses(year: number): ProcessSpec[] {
  return PROCESSES.filter((p) => p.availableFrom <= year)
}

export const SCALE_CAPACITY: Record<Scale, number> = {
  small: 5_000,
  regional: 50_000,
  carnegie: 500_000,
}

export const SCALE_LABEL: Record<Scale, string> = {
  small: 'Small mill · 5k tons/yr',
  regional: 'Regional · 50k tons/yr',
  carnegie: 'Carnegie-scale · 500k tons/yr',
}

// Vertical integration and scale bargaining cut Carnegie's per-ton input cost
// well below a regional mill's. The historical record is unambiguous on this;
// the multipliers below produce the right end-of-period ranking without
// importing every line item from Carnegie's books.
export const SCALE_COST_MULTIPLIER: Record<Scale, number> = {
  small: 1.1,
  regional: 1.0,
  carnegie: 0.55,
}

// Historical anchors for US steel-rail prices. Linearly interpolated between.
const PRICE_ANCHORS: readonly [number, number][] = [
  [1850, 90],
  [1860, 105],
  [1867, 170],
  [1872, 110],
  [1875, 70],
  [1880, 67],
  [1885, 50],
  [1890, 36],
  [1898, 32],
  [1905, 30],
  [1910, 28],
]

export function railPriceUsd(year: number): number {
  if (year <= PRICE_ANCHORS[0][0]) return PRICE_ANCHORS[0][1]
  let last = PRICE_ANCHORS[PRICE_ANCHORS.length - 1]
  if (year >= last[0]) return last[1]
  for (let i = 0; i < PRICE_ANCHORS.length - 1; i++) {
    let [y1, p1] = PRICE_ANCHORS[i]
    let [y2, p2] = PRICE_ANCHORS[i + 1]
    if (year >= y1 && year <= y2) {
      let t = (year - y1) / (y2 - y1)
      return p1 + (p2 - p1) * t
    }
  }
  return last[1]
}

// Exogenous US rail-steel demand (tons/yr). Geometric interpolation between
// anchors so the 10×/decade growth in the early period is smooth.
const DEMAND_ANCHORS: readonly [number, number][] = [
  [1850, 5_000],
  [1860, 50_000],
  [1870, 500_000],
  [1880, 1_500_000],
  [1890, 2_000_000],
  [1900, 2_500_000],
  [1910, 3_000_000],
]

export function railDemandTons(year: number): number {
  if (year <= DEMAND_ANCHORS[0][0]) return DEMAND_ANCHORS[0][1]
  let last = DEMAND_ANCHORS[DEMAND_ANCHORS.length - 1]
  if (year >= last[0]) return last[1]
  for (let i = 0; i < DEMAND_ANCHORS.length - 1; i++) {
    let [y1, d1] = DEMAND_ANCHORS[i]
    let [y2, d2] = DEMAND_ANCHORS[i + 1]
    if (year >= y1 && year <= y2) {
      let t = (year - y1) / (y2 - y1)
      return d1 * Math.pow(d2 / d1, t)
    }
  }
  return last[1]
}

export function teethingMultiplier(yearsSinceAvailable: number, teethingYears: number): number {
  if (teethingYears <= 0 || yearsSinceAvailable < 0) return 1
  if (yearsSinceAvailable >= teethingYears) return 1
  return 1 + 0.75 * (1 - yearsSinceAvailable / teethingYears)
}

export function defectTeethingMultiplier(
  yearsSinceAvailable: number,
  teethingYears: number,
): number {
  if (teethingYears <= 0 || yearsSinceAvailable < 0) return 1
  if (yearsSinceAvailable >= teethingYears) return 1
  return 1 + 4 * (1 - yearsSinceAvailable / teethingYears)
}

export function processCost(processId: ProcessId, year: number): number {
  let p = getProcess(processId)
  return p.midLifeCostUsdPerTon * teethingMultiplier(year - p.availableFrom, p.teethingYears)
}

export type OreMismatchLevel = 'none' | 'partial' | 'full'

// 'mixed' ore (a blend of low- and high-P feedstocks) is partially compatible
// with acid processes — fewer ruined heats than feeding pure phosphoric ore,
// but still markedly worse than a clean low-P stream.
const MISMATCH_DEFECT_MULTIPLIER: Record<OreMismatchLevel, number> = {
  none: 1,
  partial: 10,
  full: 30,
}

export function oreMismatchLevel(processId: ProcessId, ore: OreType): OreMismatchLevel {
  let p = getProcess(processId)
  if (p.oreCompat.highP) return 'none'
  if (ore === 'high-p') return 'full'
  if (ore === 'mixed') return 'partial'
  return 'none'
}

export function processDefectRate(
  processId: ProcessId,
  year: number,
  mismatch: OreMismatchLevel,
): number {
  let p = getProcess(processId)
  let base = p.midLifeDefectRate * defectTeethingMultiplier(year - p.availableFrom, p.teethingYears)
  return Math.min(0.95, base * MISMATCH_DEFECT_MULTIPLIER[mismatch])
}

export function checkOreMismatch(processId: ProcessId, ore: OreType): boolean {
  return oreMismatchLevel(processId, ore) !== 'none'
}

const PRICE_CAPTURE = 0.7
const PENALTY_PER_DEFECT_TON = 60
const STARTING_CASH_PER_TON_CAPACITY = 12
const CAPEX_PER_TON_CAPACITY = 30
const CAPEX_AMORT_YEARS = 10
const PANIC_CASH_HAIRCUT = 0.7

export interface MillConfig {
  startYear: number
  process: ProcessId
  ore: OreType
  scale: Scale
  posture: Posture
  seed: number
}

export interface YearReport {
  year: number
  process: ProcessId
  production: number
  costPerTon: number
  pricePerTon: number
  marketPricePerTon: number
  defectRate: number
  defects: number
  revenue: number
  cost: number
  penalty: number
  capexAmortized: number
  profit: number
  cumulativeProfit: number
  cash: number
  events: string[]
  oreMismatch: boolean
  oreMismatchLevel: OreMismatchLevel
  bankrupt: boolean
}

// Mills founded before this year are assumed to have raised capital and built
// their starting plant before the simulation begins; mills founded after must
// book the initial plant against amortized capex like any other switch.
const GREENFIELD_THRESHOLD_YEAR = 1850

interface CapexLot {
  yearsRemaining: number
  perYear: number
}

export class SteelMill {
  config: MillConfig
  year: number
  process: ProcessId
  ore: OreType
  scale: Scale
  posture: Posture
  cash: number
  cumulativeProfit = 0
  bankrupt = false
  history: YearReport[] = []
  private capexLots: CapexLot[] = []

  constructor(config: MillConfig) {
    this.config = config
    this.year = config.startYear
    this.process = config.process
    this.ore = config.ore
    this.scale = config.scale
    this.posture = config.posture
    this.cash = SCALE_CAPACITY[config.scale] * STARTING_CASH_PER_TON_CAPACITY
    // Greenfield mills built mid-simulation pay capex on their starting plant;
    // mills present at the 1850 baseline are assumed pre-built.
    if (config.startYear > GREENFIELD_THRESHOLD_YEAR) this.bookCapexLot()
  }

  private bookCapexLot(): void {
    let capacity = SCALE_CAPACITY[this.scale]
    let total = capacity * CAPEX_PER_TON_CAPACITY * (this.posture === 'aggressive' ? 1.5 : 1)
    this.capexLots.push({
      yearsRemaining: CAPEX_AMORT_YEARS,
      perYear: total / CAPEX_AMORT_YEARS,
    })
  }

  setProcess(newProcess: ProcessId): void {
    let spec = getProcess(newProcess)
    if (spec.availableFrom > this.year) {
      throw new Error(
        `Process ${newProcess} not available until ${spec.availableFrom} (current year ${this.year})`,
      )
    }
    if (newProcess === this.process) return
    this.process = newProcess
    this.bookCapexLot()
  }

  tick(): YearReport {
    let year = this.year
    let events: string[] = []
    let mismatch = oreMismatchLevel(this.process, this.ore)
    let oreMismatch = mismatch !== 'none'

    let capacity = SCALE_CAPACITY[this.scale]
    let throughput = getProcess(this.process).throughputFactor
    let production = this.bankrupt ? 0 : capacity * throughput

    let costPerTon = processCost(this.process, year) * SCALE_COST_MULTIPLIER[this.scale]
    let defectRate = processDefectRate(this.process, year, mismatch)
    let defects = production * defectRate

    let marketPrice = railPriceUsd(year)
    let pricePerTon = marketPrice * PRICE_CAPTURE
    let revenue = production * pricePerTon
    let cost = production * costPerTon
    let penalty = defects * PENALTY_PER_DEFECT_TON

    let capexAmortized = 0
    for (let lot of this.capexLots) {
      if (lot.yearsRemaining > 0) {
        capexAmortized += lot.perYear
        lot.yearsRemaining--
      }
    }

    let profit = this.bankrupt ? 0 : revenue - cost - penalty - capexAmortized
    if (oreMismatch) events.push('ore-mismatch')

    if (year === 1873 && !this.bankrupt) {
      events.push('panic-1873')
      this.cash *= PANIC_CASH_HAIRCUT
    }

    this.cumulativeProfit += profit
    this.cash += profit

    if (!this.bankrupt && this.cash < 0) {
      this.bankrupt = true
      events.push('bankrupt')
    }

    let report: YearReport = {
      year,
      process: this.process,
      production,
      costPerTon,
      pricePerTon,
      marketPricePerTon: marketPrice,
      defectRate,
      defects,
      revenue,
      cost,
      penalty,
      capexAmortized,
      profit,
      cumulativeProfit: this.cumulativeProfit,
      cash: this.cash,
      events,
      oreMismatch,
      oreMismatchLevel: mismatch,
      bankrupt: this.bankrupt,
    }
    this.history.push(report)
    this.year++
    return report
  }

  runUntil(targetYear: number): YearReport[] {
    while (this.year <= targetYear) this.tick()
    return this.history
  }
}

// -------------------------------------------------------------------------
// Competitor presets — three named ghost mills the player races against.
// -------------------------------------------------------------------------

export interface CompetitorStrategy {
  id: string
  name: string
  description: string
  config: MillConfig
  // Sequence of (year, process) switches the ghost performs at the start of
  // the year listed.
  switches: { year: number; process: ProcessId }[]
}

export const COMPETITORS: readonly CompetitorStrategy[] = [
  {
    id: 'crucible-co',
    name: 'Crucible Co.',
    description: 'Stays on crucible/puddling; refuses to chase rails.',
    config: {
      startYear: 1850,
      process: 'crucible',
      ore: 'low-p',
      scale: 'small',
      posture: 'conservative',
      seed: 11,
    },
    switches: [],
  },
  {
    id: 'bessemer-pioneer',
    name: 'Bessemer Pioneer',
    description: 'Adopts Bessemer in 1857 — first to descend the curve, first to pay the tuition.',
    config: {
      startYear: 1850,
      process: 'puddling',
      ore: 'low-p',
      scale: 'regional',
      posture: 'conservative',
      seed: 22,
    },
    switches: [{ year: 1857, process: 'bessemer-acid' }],
  },
  {
    id: 'carnegie-style',
    name: 'Carnegie-style',
    description: 'Aggressive capex; rebuilds at scale on every new process.',
    config: {
      startYear: 1872,
      process: 'bessemer-acid',
      ore: 'low-p',
      scale: 'carnegie',
      posture: 'aggressive',
      seed: 33,
    },
    switches: [{ year: 1885, process: 'basic-open-hearth' }],
  },
]

export function simulateCompetitor(strategy: CompetitorStrategy, endYear: number): YearReport[] {
  let mill = new SteelMill(strategy.config)
  let switches = [...strategy.switches].sort((a, b) => a.year - b.year)
  while (mill.year <= endYear) {
    let due = switches[0]
    if (due && due.year === mill.year) {
      let spec = getProcess(due.process)
      if (spec.availableFrom <= mill.year) mill.setProcess(due.process)
      switches.shift()
    }
    mill.tick()
  }
  return mill.history
}
