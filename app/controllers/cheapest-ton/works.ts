// The Cheapest Ton — game engine.
//
// You run a two-furnace steelworks from 1885 to 1900. Each year an order book
// of contracts arrives; you build a recipe per bid (furnace, ore, scrap
// charge, fuel is implicit) and sealed-bid against a rival mill. Lowest bid
// that meets spec wins. Input prices move every year, so the cheapest recipe
// is a moving target — that is the lesson (Origins of Efficiency, Ch 3).
//
// All randomness is drawn from a seeded generator in the constructor, so a
// given seed always produces the same sixteen years. Resolution itself is
// deterministic.

export type FurnaceId = 'bessemer' | 'open-hearth'
export type OreGrade = 'low-p' | 'high-p'
export type ProductId = 'rails' | 'wire-rod' | 'axles' | 'bridge-plate'
export type SpecLevel = 'loose' | 'tight'
export type UpgradeId = 'cowper-stoves' | 'gas-engines' | 'slag-kiln' | 'basic-lining'

export const START_YEAR = 1885
export const END_YEAR = 1900
export const YEARS = END_YEAR - START_YEAR + 1

export const MARKUP = 0.12
const NITROGEN_TIGHT_MULT = 3
// Feeding phosphoric ore to an acid-lined furnace ruins heats wholesale —
// Bessemer refunded his first licensees over exactly this.
const HIGH_P_ACID_DEFECT: Record<FurnaceId, number> = {
  bessemer: 0.3,
  'open-hearth': 0.22,
}
const GAS_ENGINE_SAVING = 0.8
export const SLAG_THRESHOLD_TONS = 18_000
export const SLAG_CREDIT_PER_TON = 0.9
const INSPECTION_FLAT_PENALTY = 5
export const STARTING_CASH = 60_000

export interface FurnaceSpec {
  id: FurnaceId
  name: string
  shortName: string
  capacityTons: number
  scrapCap: number
  yieldFactor: number
  conversionCost: number
  fuelUnitsPerTon: number
  baseDefectRate: number
  nitrogenTaint: boolean
  description: string
}

// Stylized but shaped by the historical trade-off: the converter is fast and
// burns no fuel (the silicon in the pig iron IS the fuel) but is picky about
// ore and scrap and makes nitrogen-tainted steel; the hearth is slow and
// coal-hungry but eats scrap and makes clean steel.
export const FURNACES: readonly FurnaceSpec[] = [
  {
    id: 'bessemer',
    name: 'Bessemer converter (acid)',
    shortName: 'Bessemer',
    capacityTons: 30_000,
    scrapCap: 0.08,
    yieldFactor: 1.08,
    conversionCost: 4.0,
    fuelUnitsPerTon: 0,
    baseDefectRate: 0.025,
    nitrogenTaint: true,
    description: 'Minutes per heat, no fuel bill. Low-P ore only; scrap charge capped near 8%.',
  },
  {
    id: 'open-hearth',
    name: 'Open-hearth furnace (Siemens-Martin)',
    shortName: 'Open hearth',
    capacityTons: 20_000,
    scrapCap: 0.8,
    yieldFactor: 1.04,
    conversionCost: 5.0,
    fuelUnitsPerTon: 1.1,
    baseDefectRate: 0.01,
    nitrogenTaint: false,
    description: 'Hours per heat and a real coal bill, but it eats scrap and makes clean steel.',
  },
]

export function getFurnace(id: FurnaceId): FurnaceSpec {
  let f = FURNACES.find((f) => f.id === id)
  if (!f) throw new Error(`Unknown furnace: ${id}`)
  return f
}

export interface ProductSpec {
  id: ProductId
  name: string
  spec: SpecLevel
  priceFactor: number
  penaltyPerDefectTon: number
  inspected: boolean
  blurb: string
}

export const PRODUCTS: readonly ProductSpec[] = [
  {
    id: 'rails',
    name: 'Rails',
    spec: 'loose',
    priceFactor: 1.0,
    penaltyPerDefectTon: 15,
    inspected: false,
    blurb: 'High volume, thin price, forgiving spec. The converter’s home turf.',
  },
  {
    id: 'wire-rod',
    name: 'Wire rod',
    spec: 'loose',
    priceFactor: 1.12,
    penaltyPerDefectTon: 15,
    inspected: false,
    blurb: 'Feeds the wire-nail machines cheap Bessemer steel made possible.',
  },
  {
    id: 'axles',
    name: 'Axles & forgings',
    spec: 'tight',
    priceFactor: 1.9,
    penaltyPerDefectTon: 80,
    inspected: false,
    blurb: 'Small tonnage, rich price, nitrogen-sensitive. Converter steel gets rejected.',
  },
  {
    id: 'bridge-plate',
    name: 'Bridge plate',
    spec: 'tight',
    priceFactor: 1.65,
    penaltyPerDefectTon: 80,
    inspected: true,
    blurb: 'Inspected on delivery. A failed lot is a dead loss and a black mark.',
  },
]

export function getProduct(id: ProductId): ProductSpec {
  let p = PRODUCTS.find((p) => p.id === id)
  if (!p) throw new Error(`Unknown product: ${id}`)
  return p
}

export interface UpgradeSpec {
  id: UpgradeId
  name: string
  price: number
  availableFrom: number
  blurb: string
}

export const UPGRADES: readonly UpgradeSpec[] = [
  {
    id: 'cowper-stoves',
    name: 'Regenerative stoves',
    price: 30_000,
    availableFrom: 1885,
    blurb: 'Waste heat preheats the blast — open-hearth fuel burn drops ~30%.',
  },
  {
    id: 'gas-engines',
    name: 'Gas engine house',
    price: 25_000,
    availableFrom: 1886,
    blurb: 'Waste gas becomes free power: −$0.80/ton on everything you roll.',
  },
  {
    id: 'slag-kiln',
    name: 'Slag cement kiln',
    price: 45_000,
    availableFrom: 1886,
    blurb: `Slag disposal becomes slag revenue — but only pays above ${SLAG_THRESHOLD_TONS / 1000}k tons/yr.`,
  },
  {
    id: 'basic-lining',
    name: 'Basic lining (Thomas-Gilchrist)',
    price: 50_000,
    availableFrom: 1887,
    blurb: 'Dolomite lining tames phosphorus — cheap high-P ore becomes safe in both furnaces.',
  },
]

export function getUpgrade(id: UpgradeId): UpgradeSpec {
  let u = UPGRADES.find((u) => u.id === id)
  if (!u) throw new Error(`Unknown upgrade: ${id}`)
  return u
}

// -------------------------------------------------------------------------
// Market
// -------------------------------------------------------------------------

export interface MarketYear {
  year: number
  pigLowP: number
  pigHighP: number
  scrap: number
  coal: number
  railPrice: number
  demandFactor: number
  events: string[]
}

// mulberry32 — tiny seeded PRNG, good enough for a drafting-room sim.
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// Long trends are historical in shape: pig iron drifts down, scrap collapses
// as the railroads scrap their first generation of iron rails, rail prices
// slide with a boom bump at the end of the 1880s. Noise is a bounded walk.
export function buildMarket(seed: number): MarketYear[] {
  let rng = makeRng(seed)
  let strikeYear = 1888 + Math.floor(rng() * 4)
  let specChangeYear = 1892 + Math.floor(rng() * 2)

  let pigWalk = 0
  let scrapWalk = 0
  let coalWalk = 0
  let railWalk = 0

  let years: MarketYear[] = []
  for (let i = 0; i < YEARS; i++) {
    let year = START_YEAR + i
    let t = i / (YEARS - 1)

    pigWalk = clamp(pigWalk + (rng() - 0.5) * 1.2, -1.8, 1.8)
    scrapWalk = clamp(scrapWalk + (rng() - 0.5) * 1.6, -2.2, 2.2)
    coalWalk = clamp(coalWalk + (rng() - 0.5) * 0.7, -1.0, 1.0)
    railWalk = clamp(railWalk + (rng() - 0.5) * 1.8, -2.5, 2.5)

    let panic = year === 1893 || year === 1894
    let recovery = year === 1895
    let boom = year === 1889 || year === 1890
    let lateBoom = year >= 1899

    let events: string[] = []
    if (year === 1893) events.push('panic')
    if (year === strikeYear) events.push('coal-strike')
    if (year === strikeYear + 1) events.push('coal-strike-drags')
    if (year === specChangeYear) events.push('spec-change')

    let pigLowP = Math.max(8, lerp(16, 11.5, t) + pigWalk - (panic ? 1.2 : 0))
    let scrap = Math.max(
      3.5,
      (lerp(20, 5.5, t) + scrapWalk) * (panic ? 0.55 : recovery ? 0.85 : 1),
    )
    let strike = year === strikeYear || year === strikeYear + 1
    let coal = Math.max(2.5, (4 + coalWalk) * (strike ? 2.1 : 1))
    let railPrice = Math.max(
      14,
      (lerp(29, 21, t) + railWalk + (boom ? 2.5 : 0) + (lateBoom ? 3 : 0)) *
        (panic ? 0.78 : 1),
    )
    let demandFactor = panic ? (year === 1893 ? 0.5 : 0.6) : recovery ? 0.8 : lateBoom ? 1.15 : 1

    years.push({
      year,
      pigLowP: round2(pigLowP),
      pigHighP: round2(pigLowP * 0.88),
      scrap: round2(scrap),
      coal: round2(coal),
      railPrice: round2(railPrice),
      demandFactor,
      events,
    })
  }
  return years
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

// -------------------------------------------------------------------------
// Contracts
// -------------------------------------------------------------------------

export interface Contract {
  id: string
  year: number
  product: ProductId
  tons: number
  listPrice: number
  // Set on bridge plate once the engineering societies write Bessemer steel
  // out of their specifications (mid-1890s, historically).
  ohOnly: boolean
  inspectionMax: number
  defectJitter: number
}

function roundTons(v: number): number {
  return Math.max(500, Math.round(v / 500) * 500)
}

function generateContracts(
  m: MarketYear,
  rng: () => number,
  specChanged: boolean,
): Contract[] {
  let contracts: Contract[] = []
  let n = 0
  let push = (product: ProductId, tons: number, opts?: Partial<Contract>) => {
    let spec = getProduct(product)
    contracts.push({
      id: `${m.year}-${product}-${++n}`,
      year: m.year,
      product,
      tons: roundTons(tons * m.demandFactor),
      listPrice: round2(m.railPrice * spec.priceFactor),
      ohOnly: false,
      inspectionMax: 0.08,
      defectJitter: 0.6 + rng(),
      ...opts,
    })
  }

  push('rails', 13_000 + rng() * 5_000)
  if (m.demandFactor >= 1 && rng() < 0.5) push('rails', 9_000 + rng() * 4_000)
  push('wire-rod', 5_000 + rng() * 3_000)
  push('axles', 2_500 + rng() * 1_500)
  if (m.year >= 1887) {
    push('bridge-plate', 4_000 + rng() * 3_000, {
      ohOnly: specChanged,
      inspectionMax: specChanged ? 0.03 : 0.08,
    })
  }
  return contracts
}

// -------------------------------------------------------------------------
// Recipes — cost and quality
// -------------------------------------------------------------------------

export interface Recipe {
  furnace: FurnaceId
  ore: OreGrade
  scrapFrac: number
}

export function clampScrap(recipe: Recipe): number {
  return clamp(recipe.scrapFrac, 0, getFurnace(recipe.furnace).scrapCap)
}

export function recipeCostPerTon(
  recipe: Recipe,
  m: MarketYear,
  upgrades: ReadonlySet<UpgradeId>,
  oreMarkup = 1,
): number {
  let f = getFurnace(recipe.furnace)
  let pig = (recipe.ore === 'low-p' ? m.pigLowP : m.pigHighP) * oreMarkup
  let scrapFrac = clampScrap(recipe)
  let charge = (1 - scrapFrac) * pig * f.yieldFactor + scrapFrac * m.scrap
  let fuelMult = upgrades.has('cowper-stoves') ? 0.7 : 1
  let fuel = f.fuelUnitsPerTon * fuelMult * m.coal
  let gas = upgrades.has('gas-engines') ? GAS_ENGINE_SAVING : 0
  return round2(charge + f.conversionCost + fuel - gas)
}

export function recipeDefectRate(
  recipe: Recipe,
  spec: SpecLevel,
  upgrades: ReadonlySet<UpgradeId>,
): number {
  let f = getFurnace(recipe.furnace)
  let rate = f.baseDefectRate
  if (spec === 'tight' && f.nitrogenTaint) rate *= NITROGEN_TIGHT_MULT
  if (recipe.ore === 'high-p' && !upgrades.has('basic-lining')) {
    rate += HIGH_P_ACID_DEFECT[f.id]
  }
  return Math.min(rate, 0.5)
}

export interface Quote {
  costPerTon: number
  defectRate: number
  expectedPenaltyPerTon: number
  bidPerTon: number
  failsInspection: boolean
  qualifies: boolean
}

export function quoteRecipe(
  recipe: Recipe,
  contract: Contract,
  m: MarketYear,
  upgrades: ReadonlySet<UpgradeId>,
  oreMarkup = 1,
): Quote {
  let product = getProduct(contract.product)
  let costPerTon = recipeCostPerTon(recipe, m, upgrades, oreMarkup)
  let defectRate = recipeDefectRate(recipe, product.spec, upgrades)
  let expectedPenaltyPerTon = round2(defectRate * product.penaltyPerDefectTon)
  let bidPerTon = round2((costPerTon + expectedPenaltyPerTon) * (1 + MARKUP))
  let failsInspection = product.inspected && defectRate > contract.inspectionMax
  let qualifies = !(contract.ohOnly && recipe.furnace !== 'open-hearth')
  return { costPerTon, defectRate, expectedPenaltyPerTon, bidPerTon, failsInspection, qualifies }
}

// -------------------------------------------------------------------------
// Rival — "Pittsburgh Consolidated"
// -------------------------------------------------------------------------
//
// The rival searches the same recipe space you do, with two handicaps: its
// integrated ore contracts run ~3% over market, and some years it prices off
// last year's market sheet (a big combine is slow to reprice). It adopts
// improvements on a fixed historical-ish schedule.

const RIVAL_ORE_MARKUP = 1.04
export const RIVAL_UPGRADE_YEARS: Record<UpgradeId, number> = {
  'cowper-stoves': 1889,
  'basic-lining': 1891,
  'gas-engines': 1893,
  'slag-kiln': 9999,
}

export function rivalUpgrades(year: number): Set<UpgradeId> {
  let set = new Set<UpgradeId>()
  for (let u of UPGRADES) {
    if (year >= RIVAL_UPGRADE_YEARS[u.id]) set.add(u.id)
  }
  return set
}

export interface RivalBid {
  recipe: Recipe
  quote: Quote
  bidPerTon: number
  summary: string
  stale: boolean
}

export function rivalBid(
  contract: Contract,
  m: MarketYear,
  viewMarket: MarketYear,
  stale: boolean,
): RivalBid | null {
  let upgrades = rivalUpgrades(m.year)
  let best: { recipe: Recipe; viewQuote: Quote } | null = null
  for (let furnace of FURNACES) {
    for (let ore of ['low-p', 'high-p'] as OreGrade[]) {
      for (let frac of [0, furnace.scrapCap / 2, furnace.scrapCap]) {
        let recipe: Recipe = { furnace: furnace.id, ore, scrapFrac: frac }
        let viewQuote = quoteRecipe(recipe, contract, viewMarket, upgrades, RIVAL_ORE_MARKUP)
        if (!viewQuote.qualifies || viewQuote.failsInspection) continue
        if (!best || viewQuote.bidPerTon < best.viewQuote.bidPerTon) {
          best = { recipe, viewQuote }
        }
      }
    }
  }
  if (!best) return null
  // The bid is set from the (possibly stale) view; if it can't clear the
  // buyer's list price, the rival walks away.
  if (best.viewQuote.bidPerTon > contract.listPrice) return null
  // True economics use this year's actual prices.
  let quote = quoteRecipe(best.recipe, contract, m, upgrades, RIVAL_ORE_MARKUP)
  let f = getFurnace(best.recipe.furnace)
  let scrapPct = Math.round(clampScrap(best.recipe) * 100)
  let summary = `${f.shortName.toLowerCase()} · ${best.recipe.ore === 'low-p' ? 'low-P' : 'high-P'} · ${scrapPct}% scrap`
  return { recipe: best.recipe, quote, bidPerTon: best.viewQuote.bidPerTon, summary, stale }
}

// -------------------------------------------------------------------------
// Game
// -------------------------------------------------------------------------

export interface BidDecision {
  contractId: string
  recipe: Recipe
}

export interface ContractOutcome {
  contract: Contract
  player: (Quote & { recipe: Recipe }) | null
  rival: RivalBid | null
  winner: 'you' | 'rival' | 'none'
  playerProfit: number
  rivalProfit: number
  realizedPenalty: number
  inspectionFailed: boolean
}

export interface YearOutcome {
  year: number
  market: MarketYear
  contracts: ContractOutcome[]
  wonTons: number
  slagCredit: number
  playerYearProfit: number
  playerCash: number
  playerCumProfit: number
  rivalYearProfit: number
  rivalCumProfit: number
  cheapestTon: boolean
}

export class CheapestTonWorks {
  seed: number
  market: MarketYear[]
  contractsByYear: Contract[][]
  rivalStale: boolean[]
  yearIndex = 0
  upgrades = new Set<UpgradeId>()
  cash = STARTING_CASH
  cumProfit = 0
  rivalCumProfit = 0
  capexSpent = 0
  history: YearOutcome[] = []

  constructor(seed: number) {
    this.seed = seed
    this.market = buildMarket(seed)
    let rng = makeRng(seed ^ 0x9e3779b9)
    let specChangeYear = this.market.find((m) => m.events.includes('spec-change'))?.year ?? 9999
    this.contractsByYear = this.market.map((m) =>
      generateContracts(m, rng, m.year >= specChangeYear),
    )
    this.rivalStale = this.market.map((m, i) => i > 0 && rng() < 0.25)
  }

  get done(): boolean {
    return this.yearIndex >= YEARS
  }

  get year(): number {
    return START_YEAR + this.yearIndex
  }

  marketNow(): MarketYear {
    return this.market[Math.min(this.yearIndex, YEARS - 1)]
  }

  contractsNow(): Contract[] {
    return this.done ? [] : this.contractsByYear[this.yearIndex]
  }

  canBuy(id: UpgradeId): boolean {
    let u = getUpgrade(id)
    return !this.upgrades.has(id) && this.year >= u.availableFrom && this.cash >= u.price
  }

  buy(id: UpgradeId): void {
    if (!this.canBuy(id)) throw new Error(`Cannot buy upgrade: ${id}`)
    let u = getUpgrade(id)
    this.upgrades.add(id)
    this.cash -= u.price
    this.capexSpent += u.price
  }

  // Resolve the current year's bids and advance the clock.
  resolve(decisions: readonly BidDecision[]): YearOutcome {
    if (this.done) throw new Error('The run is over — reset to play again.')
    let m = this.market[this.yearIndex]
    let contracts = this.contractsByYear[this.yearIndex]
    let stale = this.rivalStale[this.yearIndex]
    let viewMarket = stale ? this.market[this.yearIndex - 1] : m

    let byId = new Map(decisions.map((d) => [d.contractId, d]))

    // Capacity check across the whole book before anything is awarded.
    let allocated: Record<FurnaceId, number> = { bessemer: 0, 'open-hearth': 0 }
    for (let c of contracts) {
      let d = byId.get(c.id)
      if (d) allocated[d.recipe.furnace] += c.tons
    }
    for (let f of FURNACES) {
      if (allocated[f.id] > f.capacityTons) {
        throw new Error(
          `${f.shortName} is over capacity: ${allocated[f.id]} > ${f.capacityTons} tons`,
        )
      }
    }

    let outcomes: ContractOutcome[] = []
    let wonTons = 0
    let playerYearProfit = 0
    let rivalYearProfit = 0
    let cheapestTon = false

    for (let contract of contracts) {
      let product = getProduct(contract.product)
      let d = byId.get(contract.id)
      let player = d
        ? { ...quoteRecipe(d.recipe, contract, m, this.upgrades), recipe: d.recipe }
        : null
      let rival = rivalBid(contract, m, viewMarket, stale)

      let playerInRunning =
        player != null && player.qualifies && player.bidPerTon <= contract.listPrice
      let rivalInRunning = rival != null

      // Ties go to the rival — the buyer already knows the incumbent.
      let winner: 'you' | 'rival' | 'none' = 'none'
      if (playerInRunning && rivalInRunning) {
        winner = player!.bidPerTon < rival!.bidPerTon ? 'you' : 'rival'
      } else if (playerInRunning) {
        winner = 'you'
      } else if (rivalInRunning) {
        winner = 'rival'
      }

      let playerProfit = 0
      let rivalProfit = 0
      let realizedPenalty = 0
      let inspectionFailed = false

      if (winner === 'you' && player) {
        if (player.failsInspection) {
          // The lot is rolled, delivered, and rejected at the buyer's yard.
          inspectionFailed = true
          playerProfit = -(player.costPerTon + INSPECTION_FLAT_PENALTY) * contract.tons
        } else {
          realizedPenalty =
            player.defectRate *
            contract.defectJitter *
            product.penaltyPerDefectTon *
            contract.tons
          playerProfit =
            (player.bidPerTon - player.costPerTon) * contract.tons - realizedPenalty
          if (player.costPerTon < (rival?.quote.costPerTon ?? Infinity)) cheapestTon = true
        }
        wonTons += contract.tons
      } else if (winner === 'rival' && rival) {
        rivalProfit =
          (rival.bidPerTon - rival.quote.costPerTon - rival.quote.expectedPenaltyPerTon) *
          contract.tons
      }

      playerYearProfit += playerProfit
      rivalYearProfit += rivalProfit
      outcomes.push({
        contract,
        player,
        rival,
        winner,
        playerProfit: Math.round(playerProfit),
        rivalProfit: Math.round(rivalProfit),
        realizedPenalty: Math.round(realizedPenalty),
        inspectionFailed,
      })
    }

    let slagCredit =
      this.upgrades.has('slag-kiln') && wonTons >= SLAG_THRESHOLD_TONS
        ? Math.round(SLAG_CREDIT_PER_TON * wonTons)
        : 0
    playerYearProfit = Math.round(playerYearProfit + slagCredit)
    rivalYearProfit = Math.round(rivalYearProfit)

    this.cumProfit += playerYearProfit
    this.cash += playerYearProfit
    this.rivalCumProfit += rivalYearProfit

    let outcome: YearOutcome = {
      year: m.year,
      market: m,
      contracts: outcomes,
      wonTons,
      slagCredit,
      playerYearProfit,
      playerCash: Math.round(this.cash),
      playerCumProfit: Math.round(this.cumProfit),
      rivalYearProfit,
      rivalCumProfit: Math.round(this.rivalCumProfit),
      cheapestTon,
    }
    this.history.push(outcome)
    this.yearIndex++
    return outcome
  }
}

// Default recipes per product — a sane opening book for 1885.
export const DEFAULT_RECIPES: Record<ProductId, Recipe> = {
  rails: { furnace: 'bessemer', ore: 'low-p', scrapFrac: 0.05 },
  'wire-rod': { furnace: 'bessemer', ore: 'low-p', scrapFrac: 0.05 },
  axles: { furnace: 'open-hearth', ore: 'low-p', scrapFrac: 0.1 },
  'bridge-plate': { furnace: 'open-hearth', ore: 'low-p', scrapFrac: 0.1 },
}
