import { mulberry32 } from '../../stats.ts'

// -------------------------------------------------------------------------
// Process catalog. Numbers are PRD-shaped, not the literal historical
// time-series. Mid-life cost is the floor each process descends to once its
// teething period is past; teething years control how steeply the cost and
// defect curves bleed back to that floor.
// -------------------------------------------------------------------------

export type ProcessId =
  | 'cementation'
  | 'crucible'
  | 'puddling'
  | 'bessemer-acid'
  | 'open-hearth'
  | 'bessemer-basic'
  | 'basic-open-hearth'

// 'low-p'   → must use low-phosphorus ore; high-P ruins the heat
// 'high-p-ok' → tolerates either; designed for high-P ores
// 'any'     → indifferent
export type OreConstraint = 'any' | 'low-p' | 'high-p-ok'

export type OreType = 'low-p' | 'high-p' | 'mixed'

export type Scale = 'small' | 'regional' | 'carnegie'

export type Posture = 'conservative' | 'aggressive'

export interface ProcessSpec {
  id: ProcessId
  name: string
  shortName: string
  availableYear: number
  midLifeCost: number
  midLifeDefectRate: number
  // Tons/year capacity at "regional" scale. Multiplied by the scale factor
  // for small / carnegie mills.
  throughput: number
  // 1 (low) → 5 (very high). Used in copy, not in the math.
  qualityLevel: 1 | 2 | 3 | 4 | 5
  oreConstraint: OreConstraint
  teethingYears: number
  capex: number
  description: string
}

export const PROCESSES: ProcessSpec[] = [
  {
    id: 'cementation',
    name: 'Cementation',
    shortName: 'CEM',
    availableYear: 1850,
    midLifeCost: 180,
    midLifeDefectRate: 0.04,
    throughput: 3_000,
    qualityLevel: 4,
    oreConstraint: 'any',
    teethingYears: 0,
    capex: 40_000,
    description: 'Carburised wrought iron in a sealed chest. Slow, expensive, niche.',
  },
  {
    id: 'crucible',
    name: 'Crucible',
    shortName: 'CRU',
    availableYear: 1850,
    midLifeCost: 240,
    midLifeDefectRate: 0.02,
    throughput: 5_000,
    qualityLevel: 5,
    oreConstraint: 'low-p',
    teethingYears: 0,
    capex: 60_000,
    description: 'Tool-grade steel one clay pot at a time. Survives by being the best.',
  },
  {
    id: 'puddling',
    name: 'Puddling',
    shortName: 'PUD',
    availableYear: 1850,
    midLifeCost: 110,
    midLifeDefectRate: 0.05,
    throughput: 30_000,
    qualityLevel: 3,
    oreConstraint: 'any',
    teethingYears: 0,
    capex: 50_000,
    description: 'A puddler stirs decarburising iron by hand. Moderate scale, tied to labour.',
  },
  {
    id: 'bessemer-acid',
    name: 'Bessemer (acid)',
    shortName: 'BES',
    availableYear: 1856,
    midLifeCost: 48,
    midLifeDefectRate: 0.03,
    throughput: 90_000,
    qualityLevel: 3,
    oreConstraint: 'low-p',
    teethingYears: 6,
    capex: 320_000,
    description: 'Air through molten iron. Cheap and fast, but acid lining hates phosphorus.',
  },
  {
    id: 'open-hearth',
    name: 'Open hearth',
    shortName: 'OH',
    availableYear: 1865,
    midLifeCost: 62,
    midLifeDefectRate: 0.02,
    throughput: 60_000,
    qualityLevel: 4,
    oreConstraint: 'any',
    teethingYears: 5,
    capex: 380_000,
    description: 'Siemens-Martin regenerative furnace. Slower, but takes scrap and yields better steel.',
  },
  {
    id: 'bessemer-basic',
    name: 'Basic Bessemer',
    shortName: 'BES-B',
    availableYear: 1879,
    midLifeCost: 50,
    midLifeDefectRate: 0.03,
    throughput: 90_000,
    qualityLevel: 3,
    oreConstraint: 'high-p-ok',
    teethingYears: 4,
    capex: 360_000,
    description: 'Thomas-Gilchrist basic lining. Unlocks high-phosphorus ores at Bessemer speed.',
  },
  {
    id: 'basic-open-hearth',
    name: 'Basic open hearth',
    shortName: 'BOH',
    availableYear: 1880,
    midLifeCost: 56,
    midLifeDefectRate: 0.015,
    throughput: 65_000,
    qualityLevel: 5,
    oreConstraint: 'high-p-ok',
    teethingYears: 4,
    capex: 420_000,
    description: 'The 20th-century default. Quality of open hearth, ore tolerance of basic.',
  },
]

export function getProcess(id: ProcessId): ProcessSpec {
  let p = PROCESSES.find((p) => p.id === id)
  if (!p) throw new Error(`unknown process: ${id}`)
  return p
}

// -------------------------------------------------------------------------
// Cost / defect curves. yearsSinceAdoption is 0 on the first year of running
// the process; the teething penalty drops linearly to zero at teethingYears,
// then a small post-teething learning slope continues to chip cost down.
// -------------------------------------------------------------------------

const TEETHING_PENALTY = 0.7 // start at 1.7× mid-life cost
const LEARNING_FLOOR = 0.85
const LEARNING_PER_YEAR = 0.01

export function costPerTon(id: ProcessId, yearsSinceAdoption: number): number {
  let p = getProcess(id)
  let mid = p.midLifeCost
  if (p.teethingYears <= 0) {
    return mid * Math.max(LEARNING_FLOOR, 1 - LEARNING_PER_YEAR * yearsSinceAdoption)
  }
  if (yearsSinceAdoption < p.teethingYears) {
    let t = Math.max(0, yearsSinceAdoption) / p.teethingYears
    return mid * (1 + TEETHING_PENALTY * (1 - t))
  }
  let post = yearsSinceAdoption - p.teethingYears
  return mid * Math.max(LEARNING_FLOOR, 1 - LEARNING_PER_YEAR * post)
}

const TEETHING_DEFECT_BONUS = 0.12

export function defectRateFor(id: ProcessId, yearsSinceAdoption: number): number {
  let p = getProcess(id)
  let base = p.midLifeDefectRate
  if (p.teethingYears <= 0) return base
  if (yearsSinceAdoption < p.teethingYears) {
    let t = yearsSinceAdoption / p.teethingYears
    return base + TEETHING_DEFECT_BONUS * (1 - t)
  }
  return base
}

const MISMATCH_DEFECT_BONUS = 0.25

export function effectiveDefectRate(
  id: ProcessId,
  ore: OreType,
  yearsSinceAdoption: number,
): number {
  let base = defectRateFor(id, yearsSinceAdoption)
  let p = getProcess(id)
  if (p.oreConstraint === 'low-p' && ore === 'high-p') return base + MISMATCH_DEFECT_BONUS
  if (p.oreConstraint === 'low-p' && ore === 'mixed') return base + MISMATCH_DEFECT_BONUS * 0.5
  return base
}

// -------------------------------------------------------------------------
// Market: rail price falls exponentially; rail demand grows ~10×/decade.
// -------------------------------------------------------------------------

export function marketPriceForYear(year: number): number {
  // Anchors: 1850 ≈ $175, 1898 ≈ $32. exp(-0.0356 * (y-1850)) * 175.
  let p = 175 * Math.exp(-0.0356 * (year - 1850))
  return Math.max(28, p)
}

export function railDemandForYear(year: number): number {
  // 1850 ≈ 50k tons; ×10/decade until ~1890, then plateaus.
  let yearsFrom1850 = year - 1850
  let growth = Math.pow(10, Math.min(yearsFrom1850, 40) / 10)
  return 50_000 * growth
}

// -------------------------------------------------------------------------
// Mill simulation
// -------------------------------------------------------------------------

export interface MillConfig {
  startYear: number
  process: ProcessId
  ore: OreType
  scale: Scale
  posture: Posture
  seed: number
}

export interface YearRecord {
  year: number
  process: ProcessId
  production: number
  costPerTon: number
  defectRate: number
  marketPrice: number
  revenue: number
  cost: number
  penalty: number
  capex: number
  profit: number
  cash: number
  retooling: boolean
  oreMismatch: boolean
}

export interface MillSnapshot {
  year: number
  process: ProcessId
  ore: OreType
  scale: Scale
  posture: Posture
  yearsSinceAdoption: number
  retoolingYearsLeft: number
  cash: number
  bankrupt: boolean
  history: readonly YearRecord[]
}

const SCALE_FACTOR: Record<Scale, number> = {
  small: 0.1,
  regional: 1,
  carnegie: 10,
}

const SCALE_INITIAL_CASH: Record<Scale, number> = {
  small: 50_000,
  regional: 300_000,
  carnegie: 3_000_000,
}

const SCALE_BANKRUPTCY: Record<Scale, number> = {
  small: -50_000,
  regional: -250_000,
  carnegie: -2_500_000,
}

const PENALTY_PER_DEFECT_TON = 30

export class Mill {
  private year: number
  private process: ProcessId
  private ore: OreType
  private scale: Scale
  private posture: Posture
  private yearsSinceAdoption = 0
  private retoolingYearsLeft = 0
  private cash: number
  private bankrupt = false
  private history: YearRecord[] = []
  // PRNG retained for future stochastic events (1873 panic, etc).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private prng: () => number

  constructor(config: MillConfig) {
    this.year = config.startYear
    this.process = config.process
    this.ore = config.ore
    this.scale = config.scale
    this.posture = config.posture
    this.cash = SCALE_INITIAL_CASH[config.scale]
    this.prng = mulberry32(config.seed)
  }

  snapshot(): MillSnapshot {
    return {
      year: this.year,
      process: this.process,
      ore: this.ore,
      scale: this.scale,
      posture: this.posture,
      yearsSinceAdoption: this.yearsSinceAdoption,
      retoolingYearsLeft: this.retoolingYearsLeft,
      cash: this.cash,
      bankrupt: this.bankrupt,
      history: this.history,
    }
  }

  adoptProcess(id: ProcessId): void {
    let spec = getProcess(id)
    if (this.year < spec.availableYear) {
      throw new Error(
        `${spec.name} is not yet available (year ${this.year} < ${spec.availableYear})`,
      )
    }
    if (id === this.process && this.yearsSinceAdoption > 0) return
    let capex = spec.capex * SCALE_FACTOR[this.scale]
    if (this.posture === 'aggressive') capex *= 1.2
    this.cash -= capex
    this.process = id
    this.yearsSinceAdoption = 0
    // Switching mid-game stops production for one year of retooling. Keeping
    // the existing puddling line going at year 0 (the constructor case) does
    // not retool; only an explicit adoptProcess call after start does.
    this.retoolingYearsLeft = 1
  }

  setOre(ore: OreType): void {
    this.ore = ore
  }

  tick(): void {
    if (this.bankrupt) return
    let record = this.simulateYear()
    this.history.push(record)
    this.cash += record.profit - record.capex
    if (this.cash < SCALE_BANKRUPTCY[this.scale]) {
      this.bankrupt = true
    }
    this.year += 1
    if (this.retoolingYearsLeft > 0) {
      this.retoolingYearsLeft -= 1
    } else {
      this.yearsSinceAdoption += 1
    }
  }

  private simulateYear(): YearRecord {
    let spec = getProcess(this.process)
    let retooling = this.retoolingYearsLeft > 0
    let scaleFactor = SCALE_FACTOR[this.scale]
    let throughput = spec.throughput * scaleFactor
    let postureBoost = this.posture === 'aggressive' ? 1.1 : 1.0
    let production = retooling ? 0 : throughput * postureBoost
    let cpt = costPerTon(this.process, this.yearsSinceAdoption)
    let defect = effectiveDefectRate(this.process, this.ore, this.yearsSinceAdoption)
    let oreMismatch =
      spec.oreConstraint === 'low-p' && (this.ore === 'high-p' || this.ore === 'mixed')
    let price = priceFor(this.process, this.year)
    let goodTons = production * (1 - defect)
    let revenue = goodTons * price
    let cost = production * cpt
    let penalty = production * defect * PENALTY_PER_DEFECT_TON
    let profit = revenue - cost - penalty
    return {
      year: this.year,
      process: this.process,
      production,
      costPerTon: cpt,
      defectRate: defect,
      marketPrice: price,
      revenue,
      cost,
      penalty,
      capex: 0,
      profit,
      cash: this.cash + profit,
      retooling,
      oreMismatch,
    }
  }
}

// Specialty processes (cementation, crucible) sell into a quality market that
// holds price; commodity processes are stuck taking the falling rail price.
function priceFor(process: ProcessId, year: number): number {
  if (process === 'crucible' || process === 'cementation') {
    let mp = marketPriceForYear(year)
    return Math.max(mp, 220)
  }
  return marketPriceForYear(year)
}

// -------------------------------------------------------------------------
// Competitor ghosts. Three preset strategies the player runs against.
// -------------------------------------------------------------------------

export interface CompetitorStrategy {
  name: string
  description: string
  startProcess: ProcessId
  scale: Scale
  ore: OreType
  posture: Posture
  chooseProcess(year: number, current: ProcessId): ProcessId
}

export const COMPETITORS: CompetitorStrategy[] = [
  {
    name: 'Crucible Co.',
    description: 'Stays on crucible. Specialty quality, no rail volume.',
    startProcess: 'crucible',
    scale: 'small',
    ore: 'low-p',
    posture: 'conservative',
    chooseProcess(_year, current) {
      return current
    },
  },
  {
    name: 'Bessemer Pioneer',
    description: 'Adopts Bessemer the year it ships. Pays tuition; descends the curve.',
    startProcess: 'puddling',
    scale: 'regional',
    ore: 'low-p',
    posture: 'aggressive',
    chooseProcess(year, current) {
      if (current === 'puddling' && year >= 1857) return 'bessemer-acid'
      return current
    },
  },
  {
    name: 'Carnegie-style',
    description: 'Bessemer in 1872, scrap-and-rebuild to basic open hearth in 1888.',
    startProcess: 'puddling',
    scale: 'carnegie',
    ore: 'low-p',
    posture: 'aggressive',
    chooseProcess(year, current) {
      if (current === 'puddling' && year >= 1872) return 'bessemer-acid'
      if (current === 'bessemer-acid' && year >= 1888) return 'basic-open-hearth'
      return current
    },
  },
]

// Run a competitor through the time horizon, returning a mill snapshot per
// year. Used by the UI to draw the cost-curve strip alongside the player.
export function runCompetitor(
  strategy: CompetitorStrategy,
  startYear: number,
  endYear: number,
  seed: number,
): YearRecord[] {
  let mill = new Mill({
    startYear,
    process: strategy.startProcess,
    ore: strategy.ore,
    scale: strategy.scale,
    posture: strategy.posture,
    seed,
  })
  while (mill.snapshot().year < endYear && !mill.snapshot().bankrupt) {
    let snap = mill.snapshot()
    let next = strategy.chooseProcess(snap.year, snap.process)
    if (next !== snap.process) {
      let spec = getProcess(next)
      if (snap.year >= spec.availableYear) {
        mill.adoptProcess(next)
      }
    }
    mill.tick()
  }
  return [...mill.snapshot().history]
}
