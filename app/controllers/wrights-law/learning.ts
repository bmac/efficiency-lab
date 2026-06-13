// Wright's Law: every doubling of cumulative output cuts unit cost by a fixed
// percentage. Theodore Wright noticed it in airframes in 1936; solar PV, the
// Ford Model T, and DRAM have all held the same shape for decades.
//
//   C(N) = C(1) × N^b      where b = log2(learningRate)
//
// `learningRate` is the cost ratio after each doubling of cumulative output.
// 0.85 means unit N=2 costs 85% of unit N=1; unit N=4 costs 85% of unit N=2.
// On a log-log plot this is a straight line — that is the entire punchline.

export interface LearningConfig {
  /** Cost ratio per doubling of cumulative output (0 < lr < 1). */
  learningRate: number
  /** Cost of the very first unit, in dollars. */
  firstUnitCost: number
  /** Exogenous production rate, in units per year. */
  productionRate: number
}

export const DEFAULT_CONFIG: LearningConfig = {
  learningRate: 0.85,
  firstUnitCost: 100,
  productionRate: 100,
}

/** Cumulative production at which the ramp parks itself, to keep arrays sane. */
export const RAMP_CEILING = 1_000_000

/** The cumulative-output target the forecast game asks you to guess. */
export const FORECAST_TARGET = 10_000

export type InterventionId = 'redesign' | 'scaleUp' | 'cheaperInput'

export interface Intervention {
  id: InterventionId
  name: string
  blurb: string
  /** R&D credits spent. */
  cost: number
  /** Instant multiplier applied to unit cost (1 = no change). */
  costFactor: number
  /** Multiplier applied to the production rate (1 = no change). */
  rateFactor: number
}

export const INTERVENTIONS: readonly Intervention[] = [
  {
    id: 'redesign',
    name: 'Process redesign',
    blurb: 'Instant 15% cost cut. The line keeps learning at the same rate.',
    cost: 2,
    costFactor: 0.85,
    rateFactor: 1,
  },
  {
    id: 'scaleUp',
    name: 'Scale up plant',
    blurb: 'Double the production rate. No instant cost change — but you climb the curve twice as fast.',
    cost: 1,
    costFactor: 1,
    rateFactor: 2,
  },
  {
    id: 'cheaperInput',
    name: 'Cheaper input',
    blurb: 'Instant 8% cost cut. A one-time substitution, then back to learning.',
    cost: 1,
    costFactor: 0.92,
    rateFactor: 1,
  },
]

export const STARTING_CREDITS = 4

export function getIntervention(id: InterventionId): Intervention {
  let found = INTERVENTIONS.find((i) => i.id === id)
  if (!found) throw new Error(`unknown intervention: ${id}`)
  return found
}

export interface ScenarioPreset {
  id: string
  name: string
  blurb: string
  config: LearningConfig
}

// Historical learning rates are the textbook values; first-unit costs and rates
// are stylised so each preset reaches a watchable range of cumulative output.
export const SCENARIO_PRESETS: readonly ScenarioPreset[] = [
  {
    id: 'sandbox',
    name: 'Sandbox',
    blurb: 'A blank airframe line at the canonical 85%.',
    config: { learningRate: 0.85, firstUnitCost: 100, productionRate: 100 },
  },
  {
    id: 'solar',
    name: 'Recreate the solar curve',
    blurb: 'Photovoltaic cells, 1975–2021. ~80% per doubling, $100/W to pennies.',
    config: { learningRate: 0.8, firstUnitCost: 100, productionRate: 120 },
  },
  {
    id: 'model-t',
    name: 'Ford Model T',
    blurb: '1909–1923. ~85% as the assembly line found its legs.',
    config: { learningRate: 0.85, firstUnitCost: 850, productionRate: 200 },
  },
  {
    id: 'dram',
    name: 'DRAM cost per bit',
    blurb: 'Semiconductors, 1971–2010. A brutal ~70% — the steepest line in the book.',
    config: { learningRate: 0.7, firstUnitCost: 100, productionRate: 150 },
  },
]

export interface HistoricalSeries {
  id: string
  label: string
  learningRate: number
  /** How many cumulative-output doublings the real series spanned. */
  doublings: number
}

// For the shape-comparison chart we only need each series' slope (its learning
// rate) and how far it ran. Drawn normalised: every series starts at cost 1.0
// at its first unit, so the chart shows pure *shape*, not absolute dollars.
export const HISTORICAL_SERIES: readonly HistoricalSeries[] = [
  { id: 'solar', label: 'Solar PV · 1975–2021', learningRate: 0.8, doublings: 26 },
  { id: 'model-t', label: 'Ford Model T · 1909–1923', learningRate: 0.85, doublings: 8 },
  { id: 'dram', label: 'DRAM · 1971–2010', learningRate: 0.7, doublings: 20 },
]

export function learningExponent(learningRate: number): number {
  return Math.log(learningRate) / Math.log(2)
}

export interface CurvePoint {
  n: number
  cost: number
}

export interface RampSnapshot {
  config: LearningConfig
  /** Live production rate (interventions can raise it above config). */
  rate: number
  cumUnits: number
  years: number
  unitCost: number
  totalCost: number
  doublings: number
  credits: number
  used: Record<InterventionId, number>
  history: readonly CurvePoint[]
  atCeiling: boolean
  forecast: ForecastState
}

export interface ForecastState {
  /** The cost the operator predicted for unit N = FORECAST_TARGET. */
  guess: number | null
  /** The actual cost once the ramp crossed the target (null until then). */
  actual: number | null
  locked: boolean
}

// Sample the curve at geometric spacing so the log axes get evenly spread
// points without the array growing without bound.
const SAMPLE_RATIO = 1.06

export class LearningRamp {
  config: LearningConfig
  private rate: number
  private cumUnits = 1
  private years = 0
  private costMultiplier = 1
  private totalCost: number
  private credits = STARTING_CREDITS
  private used: Record<InterventionId, number> = { redesign: 0, scaleUp: 0, cheaperInput: 0 }
  private history: CurvePoint[]
  private nextSample: number
  private forecast: ForecastState = { guess: null, actual: null, locked: false }

  constructor(config: LearningConfig) {
    this.config = config
    this.rate = config.productionRate
    // Unit 1 is, by definition, the first-unit cost. Total-to-date starts there.
    this.totalCost = config.firstUnitCost
    this.history = [{ n: 1, cost: config.firstUnitCost }]
    this.nextSample = SAMPLE_RATIO
  }

  /** Unit cost at cumulative output `n`, including any interventions banked. */
  unitCostAt(n: number): number {
    let b = learningExponent(this.config.learningRate)
    return this.config.firstUnitCost * this.costMultiplier * Math.pow(Math.max(n, 1), b)
  }

  /** Predict cost at N = FORECAST_TARGET before any interventions land. */
  forecastFor(guess: number): void {
    if (this.forecast.locked) return
    this.forecast = { guess, actual: null, locked: true }
  }

  lockForecastReveal(): void {
    if (this.cumUnits >= FORECAST_TARGET && this.forecast.locked && this.forecast.actual == null) {
      this.forecast = { ...this.forecast, actual: this.unitCostAt(FORECAST_TARGET) }
    }
  }

  canApply(id: InterventionId): boolean {
    return !this.atCeiling() && this.credits >= getIntervention(id).cost
  }

  apply(id: InterventionId): boolean {
    if (!this.canApply(id)) return false
    let lever = getIntervention(id)
    this.credits -= lever.cost
    this.costMultiplier *= lever.costFactor
    this.rate *= lever.rateFactor
    this.used[id]++
    // Record the step so the cut shows as a visible drop on the curve.
    this.history.push({ n: this.cumUnits, cost: this.unitCostAt(this.cumUnits) })
    return true
  }

  atCeiling(): boolean {
    return this.cumUnits >= RAMP_CEILING
  }

  /** Advance the ramp by `dtYears` of production. */
  step(dtYears: number): void {
    if (dtYears <= 0 || this.atCeiling()) return
    let b = learningExponent(this.config.learningRate)
    let n0 = this.cumUnits
    let n1 = Math.min(n0 + this.rate * dtYears, RAMP_CEILING)
    this.years += dtYears

    // Closed-form integral of C1·mult·n^b over [n0, n1] = total cost of the
    // run of units produced this step (the multiplier is constant between
    // interventions, so this is exact).
    let exp = b + 1
    let added =
      this.config.firstUnitCost *
      this.costMultiplier *
      (Math.pow(n1, exp) - Math.pow(n0, exp)) /
      exp
    this.totalCost += added
    this.cumUnits = n1

    while (this.nextSample <= this.cumUnits) {
      this.history.push({ n: this.nextSample, cost: this.unitCostAt(this.nextSample) })
      this.nextSample *= SAMPLE_RATIO
    }
    this.history.push({ n: this.cumUnits, cost: this.unitCostAt(this.cumUnits) })
    if (this.history.length > 600) {
      // Thin oldest-but-one points; keep first and last anchors.
      this.history = this.history.filter((_, i) => i === 0 || i % 2 === 1 || i === this.history.length - 1)
    }

    this.lockForecastReveal()
  }

  snapshot(): RampSnapshot {
    return {
      config: this.config,
      rate: this.rate,
      cumUnits: this.cumUnits,
      years: this.years,
      unitCost: this.unitCostAt(this.cumUnits),
      totalCost: this.totalCost,
      doublings: Math.log2(Math.max(this.cumUnits, 1)),
      credits: this.credits,
      used: { ...this.used },
      history: this.history,
      atCeiling: this.atCeiling(),
      forecast: { ...this.forecast },
    }
  }
}
