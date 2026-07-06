import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

import { DraftingButton, FieldSlider, Panel, Readout, SheetHeader, T } from '../../ui/shell.tsx'
import {
  CheapestTonWorks,
  DEFAULT_RECIPES,
  END_YEAR,
  FURNACES,
  MARKUP,
  START_YEAR,
  UPGRADES,
  YEARS,
  getFurnace,
  getProduct,
  getUpgrade,
  quoteRecipe,
  RIVAL_UPGRADE_YEARS,
  type BidDecision,
  type Contract,
  type ContractOutcome,
  type FurnaceId,
  type MarketYear,
  type OreGrade,
  type ProductId,
  type Quote,
  type Recipe,
  type UpgradeId,
  type YearOutcome,
} from './works.ts'

interface CheapestTonLabProps extends SerializableProps {}

// One fixed seed so every run is the same sixteen years — the game is about
// reading the landscape, and comparable runs make improvement visible.
const SEED = 7

type Phase = 'bid' | 'review'

interface CardState {
  recipe: Recipe
  pass: boolean
}

export const CheapestTonLab = clientEntry(
  '/assets/app/controllers/cheapest-ton/lab.tsx#CheapestTonLab',
  function CheapestTonLab(handle: Handle<CheapestTonLabProps>) {
    let game = new CheapestTonWorks(SEED)
    let phase: Phase = 'bid'
    let lastOutcome: YearOutcome | null = null
    let standing: Record<ProductId, Recipe> = { ...DEFAULT_RECIPES }
    let cards = new Map<string, CardState>()

    function initCards() {
      cards = new Map()
      for (let c of game.contractsNow()) {
        cards.set(c.id, { recipe: { ...standing[c.product] }, pass: false })
      }
    }
    initCards()

    function card(id: string): CardState {
      let s = cards.get(id)
      if (!s) throw new Error(`No card state for ${id}`)
      return s
    }

    function setFurnace(id: string, furnace: FurnaceId) {
      let s = card(id)
      let cap = getFurnace(furnace).scrapCap
      s.recipe = { ...s.recipe, furnace, scrapFrac: Math.min(s.recipe.scrapFrac, cap) }
      handle.update()
    }

    function setOre(id: string, ore: OreGrade) {
      let s = card(id)
      s.recipe = { ...s.recipe, ore }
      handle.update()
    }

    function setScrap(id: string, frac: number) {
      let s = card(id)
      s.recipe = { ...s.recipe, scrapFrac: frac }
      handle.update()
    }

    function togglePass(id: string) {
      let s = card(id)
      s.pass = !s.pass
      handle.update()
    }

    function buyUpgrade(id: UpgradeId) {
      if (game.canBuy(id)) {
        game.buy(id)
        handle.update()
      }
    }

    function allocation(): Record<FurnaceId, number> {
      let used: Record<FurnaceId, number> = { bessemer: 0, 'open-hearth': 0 }
      for (let c of game.contractsNow()) {
        let s = cards.get(c.id)
        if (s && !s.pass) used[s.recipe.furnace] += c.tons
      }
      return used
    }

    function overCapacity(): FurnaceId | null {
      let used = allocation()
      for (let f of FURNACES) {
        if (used[f.id] > f.capacityTons) return f.id
      }
      return null
    }

    function deliver() {
      if (phase !== 'bid' || game.done || overCapacity()) return
      let decisions: BidDecision[] = []
      for (let c of game.contractsNow()) {
        let s = card(c.id)
        if (!s.pass) {
          decisions.push({ contractId: c.id, recipe: { ...s.recipe } })
          standing[c.product] = { ...s.recipe }
        }
      }
      lastOutcome = game.resolve(decisions)
      phase = 'review'
      handle.update()
    }

    function nextYear() {
      if (phase !== 'review' || game.done) return
      phase = 'bid'
      lastOutcome = null
      initCards()
      handle.update()
    }

    function reset() {
      game = new CheapestTonWorks(SEED)
      phase = 'bid'
      lastOutcome = null
      standing = { ...DEFAULT_RECIPES }
      initCards()
      handle.update()
    }

    return () => {
      let done = game.done
      let market = phase === 'review' && lastOutcome ? lastOutcome.market : game.marketNow()
      let year = phase === 'review' && lastOutcome ? lastOutcome.year : game.year
      let contracts = game.contractsNow()
      let used = allocation()
      let over = overCapacity()
      let roundNo = Math.min(game.yearIndex + (phase === 'review' ? 0 : 1), YEARS)

      return (
        <article mix={pageStyle}>
          <SheetHeader
            fig="Fig. 6.0 — The trade-off has no right answer"
            title="The Cheapest Ton"
            subtitle="It's 1885 and you run a steelworks with two furnaces. The Bessemer converter is fast and burns no fuel, but it's picky about ore, barely takes scrap, and its steel carries nitrogen that quality buyers reject. The open hearth is slow and coal-hungry, but it eats cheap scrap and makes clean steel. Every year an order book arrives and you sealed-bid against Pittsburgh Consolidated: pick the furnace, the ore, and the scrap charge for each contract — then watch the ground move. Scrap collapses, specs tighten, coal strikes hit. The cheapest ton is a moving target."
          />

          <div mix={twoColStyle}>
            <div mix={mainColumnStyle}>
              {/* This panel is always mounted and swaps content with the
                  phase — replacing whole sibling panels confuses the
                  reconciler into re-appending them out of order. */}
              <Panel
                label={
                  phase === 'bid' && !done
                    ? `Fig. 6.1 — Order book · ${year} · ${contracts.length} contracts`
                    : `Fig. 6.1 — Awards · ${lastOutcome?.year ?? year}`
                }
                padding={16}
              >
                {phase === 'bid' && !done ? (
                  <div mix={bookGridStyle}>
                    {market.events.length > 0 && <EventBanner events={market.events} />}
                    <div mix={bookIntroStyle}>
                      Sealed bids at cost + {Math.round(MARKUP * 100)}% markup. Lowest bid that
                      meets spec wins; ties go to the incumbent. Tune each recipe — the readout
                      updates live.
                    </div>
                    {contracts.map((c) => (
                      <ContractCard
                        key={c.id}
                        contract={c}
                        state={card(c.id)}
                        market={market}
                        upgrades={[...game.upgrades]}
                        onFurnace={(f) => setFurnace(c.id, f)}
                        onOre={(o) => setOre(c.id, o)}
                        onScrap={(v) => setScrap(c.id, v)}
                        onPass={() => togglePass(c.id)}
                      />
                    ))}
                  </div>
                ) : lastOutcome ? (
                  <YearReview outcome={lastOutcome} />
                ) : null}
              </Panel>

              <Panel label="Fig. 6.2 — Cumulative profit ($)" padding={16}>
                <ProfitChart history={game.history} />
              </Panel>

              {done && lastOutcome ? <Retrospective game={game} /> : null}
            </div>

            <aside mix={asideStyle}>
              <Panel label="Works office" padding={16}>
                <div mix={yearRowStyle}>
                  <div mix={yearBigStyle}>{year}</div>
                  <div mix={yearMetaStyle}>
                    <span>
                      Round {roundNo} / {YEARS}
                    </span>
                    <span mix={phaseTagStyle}>
                      {done ? 'FINAL' : phase === 'bid' ? 'BIDS OPEN' : 'DELIVERED'}
                    </span>
                  </div>
                </div>
                {phase === 'bid' && !done && (
                  <DraftingButton primary full onClick={deliver} disabled={over != null}>
                    ⚒ Roll the heats · deliver {year}
                  </DraftingButton>
                )}
                {phase === 'review' && !done && (
                  <DraftingButton primary full onClick={nextYear}>
                    Open the {year + 1} book →
                  </DraftingButton>
                )}
                {over && (
                  <div mix={capacityWarnStyle}>
                    ⚠ {getFurnace(over).shortName} is over capacity — pass a contract or move
                    tonnage to the other furnace.
                  </div>
                )}
                <div mix={resetRowStyle}>
                  <DraftingButton onClick={reset}>Reset run</DraftingButton>
                </div>
                <Readout k="Cash" v={fmtUsd(game.cash)} accent />
                <Readout k="Cumulative profit" v={fmtUsd(game.cumProfit)} />
                <Readout k="Pittsburgh Consol." v={fmtUsd(game.rivalCumProfit)} />
              </Panel>

              <Panel label="Furnace allocation" padding={16}>
                {FURNACES.map((f) => (
                  <CapacityMeter
                    key={`cap-${f.id}`}
                    name={f.shortName}
                    used={used[f.id]}
                    cap={f.capacityTons}
                    active={phase === 'bid' && !done}
                  />
                ))}
              </Panel>

              <Panel label="Market sheet" padding={16}>
                <MarketStrip market={game.market} upTo={game.yearIndex + (phase === 'review' ? 0 : 1)} />
              </Panel>

              <Panel label="Improvements · capex" padding={16}>
                <div mix={upgradeGridStyle}>
                  {UPGRADES.map((u) => (
                    <UpgradeCard
                      key={`upg-${u.id}`}
                      upgradeId={u.id}
                      owned={game.upgrades.has(u.id)}
                      canBuy={!done && phase === 'bid' && game.canBuy(u.id)}
                      affordable={game.cash >= u.price}
                      year={game.year}
                      rivalYear={RIVAL_UPGRADE_YEARS[u.id]}
                      onBuy={() => buyUpgrade(u.id)}
                    />
                  ))}
                </div>
              </Panel>
            </aside>
          </div>

          <Panel label="Drafting note" padding={16}>
            <div mix={noteStyle}>
              Ch 3 of <em>The Origins of Efficiency</em>: the Bessemer converter vs. the
              open-hearth furnace was the canonical trade-off of late-19th-century steel —
              faster and fuel-free vs. flexible and cleaner — and which made the cheaper ton
              depended on scrap prices, ore prices, and what the steel was for. Cost can't be
              minimized item by item: the cheap ore ruins the acid furnace, the "wasted" capex
              on stoves and slag kilns pays only at volume, and the recipe that won last year
              quietly stops winning. Watch the market sheet, not your habits.
            </div>
          </Panel>
        </article>
      )
    }
  },
)

// -------------------------------------------------------------------------
// Order book
// -------------------------------------------------------------------------

function ContractCard(
  handle: Handle<{
    contract: Contract
    state: CardState
    market: MarketYear
    upgrades: UpgradeId[]
    onFurnace: (f: FurnaceId) => void
    onOre: (o: OreGrade) => void
    onScrap: (frac: number) => void
    onPass: () => void
  }>,
) {
  return () => {
    let { contract, state, market, upgrades, onFurnace, onOre, onScrap, onPass } = handle.props
    let upgradeSet = new Set(upgrades)
    let product = getProduct(contract.product)
    let furnace = getFurnace(state.recipe.furnace)
    let quote = quoteRecipe(state.recipe, contract, market, upgradeSet)
    let warnings = quoteWarnings(contract, state.recipe, quote, upgradeSet)
    let clears = quote.qualifies && !quote.failsInspection && quote.bidPerTon <= contract.listPrice

    return (
      <div mix={[contractCardStyle, state.pass ? contractCardPassedStyle : null]}>
        <div mix={contractHeadStyle}>
          <span mix={contractNameStyle}>{product.name}</span>
          <span mix={contractTonsStyle}>{fmtTons(contract.tons)}</span>
          <span mix={contractSpecStyle}>
            {contract.ohOnly ? 'OH-ONLY · ' : ''}
            {product.inspected ? 'INSPECTED · ' : ''}
            {product.spec.toUpperCase()}
          </span>
          <span mix={contractPriceStyle}>list ${contract.listPrice.toFixed(0)}/t</span>
        </div>
        <div mix={contractBlurbStyle}>{product.blurb}</div>

        {!state.pass && (
          <>
            <div mix={segmentRowStyle}>
              <SegmentGroup
                options={FURNACES.map((f) => ({ id: f.id, label: f.shortName.toUpperCase() }))}
                active={state.recipe.furnace}
                onPick={(id) => onFurnace(id as FurnaceId)}
              />
              <SegmentGroup
                options={[
                  { id: 'low-p', label: `LOW-P $${market.pigLowP.toFixed(0)}` },
                  { id: 'high-p', label: `HIGH-P $${market.pigHighP.toFixed(0)}` },
                ]}
                active={state.recipe.ore}
                onPick={(id) => onOre(id as OreGrade)}
              />
            </div>
            <FieldSlider
              label={`Scrap charge · scrap $${market.scrap.toFixed(0)}/t`}
              value={Math.round(state.recipe.scrapFrac * 100)}
              min={0}
              max={Math.round(furnace.scrapCap * 100)}
              step={5}
              unit="%"
              onChange={(v) => onScrap(v / 100)}
            />
            <div mix={quoteRowStyle}>
              <QuoteStat label="Cost" value={`$${quote.costPerTon.toFixed(1)}/t`} />
              <QuoteStat label="Defects" value={`${(quote.defectRate * 100).toFixed(1)}%`} />
              <QuoteStat label="Penalty" value={`$${quote.expectedPenaltyPerTon.toFixed(1)}/t`} />
              <QuoteStat label="Your bid" value={`$${quote.bidPerTon.toFixed(1)}/t`} accent={clears} />
            </div>
            {warnings.map((w, i) => (
              <div key={`warn-${i}`} mix={cardWarnStyle}>
                ⚠ {w}
              </div>
            ))}
          </>
        )}

        <div mix={passRowStyle}>
          <button type="button" mix={[passButtonStyle, on('click', onPass)]}>
            {state.pass ? '↩ Rejoin the bidding' : 'Pass on this contract'}
          </button>
          {state.pass && <span mix={passedTagStyle}>PASSED — idle capacity costs nothing but earns nothing</span>}
        </div>
      </div>
    )
  }
}

function quoteWarnings(
  contract: Contract,
  recipe: Recipe,
  quote: Quote,
  upgrades: ReadonlySet<UpgradeId>,
): string[] {
  let warnings: string[] = []
  if (!quote.qualifies) {
    warnings.push(
      'Spec calls for open-hearth steel only — a converter bid will not be considered.',
    )
  }
  if (recipe.ore === 'high-p' && !upgrades.has('basic-lining')) {
    warnings.push(
      'Phosphoric ore in an acid-lined furnace ruins heats wholesale. Bessemer refunded his first licensees over this. Buy the basic lining or use low-P.',
    )
  }
  if (quote.failsInspection) {
    warnings.push(
      `Predicted defects ${(quote.defectRate * 100).toFixed(1)}% exceed the ${(contract.inspectionMax * 100).toFixed(0)}% inspection gate — the lot WILL be rejected at the buyer's yard. Winning this bid is a dead loss.`,
    )
  } else if (quote.bidPerTon > contract.listPrice) {
    warnings.push('Your bid is above the buyer’s list price — they will walk before paying it.')
  }
  return warnings
}

function SegmentGroup(
  handle: Handle<{
    options: { id: string; label: string }[]
    active: string
    onPick: (id: string) => void
  }>,
) {
  return () => {
    let { options, active, onPick } = handle.props
    return (
      <div mix={segmentGroupStyle}>
        {options.map((o) => (
          <button
            key={`seg-${o.id}`}
            type="button"
            aria-pressed={o.id === active ? 'true' : 'false'}
            mix={[
              o.id === active ? segmentActiveStyle : segmentStyle,
              on('click', () => onPick(o.id)),
            ]}
          >
            {o.label}
          </button>
        ))}
      </div>
    )
  }
}

function QuoteStat(handle: Handle<{ label: string; value: string; accent?: boolean }>) {
  return () => {
    let { label, value, accent } = handle.props
    return (
      <div mix={quoteStatStyle}>
        <div mix={quoteStatLabelStyle}>{label}</div>
        <div mix={accent ? quoteStatValueAccentStyle : quoteStatValueStyle}>{value}</div>
      </div>
    )
  }
}

// -------------------------------------------------------------------------
// Review
// -------------------------------------------------------------------------

function YearReview(handle: Handle<{ outcome: YearOutcome }>) {
  return () => {
    let { outcome } = handle.props
    let won = outcome.contracts.filter((c) => c.winner === 'you')
    return (
      <div mix={reviewWrapStyle}>
        <div mix={reviewSummaryStyle}>
          Won {won.length} of {outcome.contracts.length} contracts ·{' '}
          {fmtTons(outcome.wonTons)} delivered · year profit{' '}
          <strong mix={outcome.playerYearProfit >= 0 ? profitGoodStyle : profitBadStyle}>
            {fmtUsd(outcome.playerYearProfit)}
          </strong>
          {outcome.slagCredit > 0 && <> · slag credit {fmtUsd(outcome.slagCredit)}</>}
        </div>
        <div mix={reviewGridStyle}>
          {outcome.contracts.map((c) => (
            <OutcomeCard key={`out-${c.contract.id}`} outcome={c} />
          ))}
        </div>
      </div>
    )
  }
}

function OutcomeCard(handle: Handle<{ outcome: ContractOutcome }>) {
  return () => {
    let { outcome } = handle.props
    let c = outcome.contract
    let product = getProduct(c.product)
    let stamp =
      outcome.winner === 'you'
        ? outcome.inspectionFailed
          ? 'REJECTED AT THE YARD'
          : 'ROLLED & DELIVERED'
        : outcome.winner === 'rival'
          ? 'LOST TO PITTSBURGH'
          : outcome.player
            ? 'NO AWARD'
            : 'PASSED'
    let stampStyle =
      outcome.winner === 'you'
        ? outcome.inspectionFailed
          ? outcomeStampFailStyle
          : outcomeStampWinStyle
        : outcomeStampLoseStyle

    return (
      <div mix={outcomeCardStyle}>
        <div mix={outcomeHeadStyle}>
          <span mix={contractNameStyle}>{product.name}</span>
          <span mix={contractTonsStyle}>{fmtTons(c.tons)}</span>
          <span mix={stampStyle}>{stamp}</span>
        </div>
        <div mix={outcomeBodyStyle}>
          {outcome.player ? (
            <div>
              You bid <strong>${outcome.player.bidPerTon.toFixed(1)}/t</strong> (
              {recipeLabel(outcome.player.recipe)} · cost ${outcome.player.costPerTon.toFixed(1)})
            </div>
          ) : (
            <div>You sat this one out.</div>
          )}
          {outcome.rival ? (
            <div>
              Pittsburgh bid <strong>${outcome.rival.bidPerTon.toFixed(1)}/t</strong> (
              {outcome.rival.summary}
              {outcome.rival.stale ? ' · priced off last year’s sheet' : ''})
            </div>
          ) : (
            <div>Pittsburgh walked — no profitable recipe at the list price.</div>
          )}
          {outcome.winner === 'you' && !outcome.inspectionFailed && (
            <div mix={profitGoodStyle}>
              Profit {fmtUsd(outcome.playerProfit)}
              {outcome.realizedPenalty > 0 && <> after {fmtUsd(outcome.realizedPenalty)} in defect claims</>}
            </div>
          )}
          {outcome.inspectionFailed && (
            <div mix={profitBadStyle}>
              The inspector condemned the lot: {fmtUsd(outcome.playerProfit)}. Tainted steel on an
              inspected contract is a dead loss.
            </div>
          )}
          {outcome.winner === 'rival' && outcome.player && (
            <div mix={outcomeMarginStyle}>
              Beaten by ${(outcome.player.bidPerTon - outcome.rival!.bidPerTon).toFixed(1)}/t.
            </div>
          )}
        </div>
      </div>
    )
  }
}

function recipeLabel(r: Recipe): string {
  let f = getFurnace(r.furnace)
  return `${f.shortName.toLowerCase()} · ${r.ore === 'low-p' ? 'low-P' : 'high-P'} · ${Math.round(
    r.scrapFrac * 100,
  )}% scrap`
}

// -------------------------------------------------------------------------
// Aside widgets
// -------------------------------------------------------------------------

function EventBanner(handle: Handle<{ events: string[] }>) {
  return () => {
    let { events } = handle.props
    return (
      <div mix={eventBannerStyle}>
        {events.map((e, i) => (
          <div key={`ev-${i}`} mix={eventLineStyle}>
            {eventCopy(e)}
          </div>
        ))}
      </div>
    )
  }
}

function eventCopy(e: string): string {
  switch (e) {
    case 'panic':
      return '⚡ PANIC OF 1893 — credit has collapsed. The book is thin, prices are down, and scrap is a fire sale. Fixed habits get expensive in a trough.'
    case 'coal-strike':
      return '⚡ COAL STRIKE — fuel prices have doubled. The converter burns no coal at all; the hearth burns it by the ton.'
    case 'coal-strike-drags':
      return '⚡ The coal strike drags into a second winter. Fuel is still double.'
    case 'spec-change':
      return '⚡ SPEC CHANGE — the railway engineering societies have rewritten the bridge specifications: open-hearth steel only, inspection gate tightened to 3%. Converter steel is out of that market for good.'
    default:
      return e
  }
}

function CapacityMeter(
  handle: Handle<{ name: string; used: number; cap: number; active: boolean }>,
) {
  return () => {
    let { name, used, cap, active } = handle.props
    let pct = Math.min(1.25, used / cap)
    let over = used > cap
    return (
      <div mix={meterWrapStyle}>
        <div mix={meterHeadStyle}>
          <span>{name}</span>
          <span mix={over ? meterOverStyle : null}>
            {active ? `${fmtTons(used)} / ${fmtTons(cap)}` : `cap ${fmtTons(cap)}`}
          </span>
        </div>
        <div mix={meterTrackStyle}>
          <div
            mix={over ? meterFillOverStyle : meterFillStyle}
            style={{ width: `${Math.min(100, pct * 100)}%` }}
          />
        </div>
      </div>
    )
  }
}

function MarketStrip(handle: Handle<{ market: MarketYear[]; upTo: number }>) {
  return () => {
    let { market, upTo } = handle.props
    let visible = market.slice(0, Math.max(1, Math.min(upTo, market.length)))
    let series: { label: string; pick: (m: MarketYear) => number }[] = [
      { label: 'Pig iron (low-P)', pick: (m) => m.pigLowP },
      { label: 'Scrap', pick: (m) => m.scrap },
      { label: 'Coal', pick: (m) => m.coal },
      { label: 'Rail list price', pick: (m) => m.railPrice },
    ]
    return (
      <div mix={marketStripStyle}>
        {series.map((s, i) => (
          <Sparkline
            key={`spark-${i}`}
            label={s.label}
            values={visible.map(s.pick)}
            now={s.pick(visible[visible.length - 1])}
          />
        ))}
        <div mix={marketNoteStyle}>
          Prices walk every year. The long slide in scrap is the story of the period — watch
          when it crosses under pig iron.
        </div>
      </div>
    )
  }
}

function Sparkline(handle: Handle<{ label: string; values: number[]; now: number }>) {
  return () => {
    let { label, values, now } = handle.props
    let w = 132
    let h = 26
    let min = Math.min(...values)
    let max = Math.max(...values)
    let range = max - min || 1
    let step = values.length > 1 ? w / (values.length - 1) : 0
    let points = values
      .map((v, i) => `${(i * step).toFixed(1)},${(h - 3 - ((v - min) / range) * (h - 6)).toFixed(1)}`)
      .join(' ')
    return (
      <div mix={sparkRowStyle}>
        <div mix={sparkLabelStyle}>
          <span>{label}</span>
          <span mix={sparkValueStyle}>${now.toFixed(2)}</span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} mix={sparkSvgStyle} aria-hidden="true">
          {values.length > 1 ? (
            <polyline points={points} fill="none" stroke={T.accent} stroke-width="1.2" />
          ) : (
            <circle cx="2" cy={h / 2} r="1.5" fill={T.accent} />
          )}
        </svg>
      </div>
    )
  }
}

function UpgradeCard(
  handle: Handle<{
    upgradeId: UpgradeId
    owned: boolean
    canBuy: boolean
    affordable: boolean
    year: number
    rivalYear: number
    onBuy: () => void
  }>,
) {
  return () => {
    let { upgradeId, owned, canBuy, affordable, year, rivalYear, onBuy } = handle.props
    let u = getUpgrade(upgradeId)
    let locked = year < u.availableFrom
    return (
      <div mix={[upgradeCardStyle, owned ? upgradeOwnedStyle : null]}>
        <div mix={upgradeHeadStyle}>
          <span mix={upgradeNameStyle}>{u.name}</span>
          <span mix={upgradeTagStyle}>
            {owned ? 'INSTALLED' : locked ? `${u.availableFrom}` : fmtUsd(u.price)}
          </span>
        </div>
        <div mix={upgradeBlurbStyle}>{u.blurb}</div>
        {!owned && rivalYear < 3000 && (
          <div mix={upgradeRivalNoteStyle}>
            {year >= rivalYear
              ? 'Pittsburgh already runs this.'
              : `Pittsburgh installs this in ${rivalYear}.`}
          </div>
        )}
        {!owned && !locked && (
          <DraftingButton full disabled={!canBuy} onClick={onBuy}>
            {canBuy || affordable ? `Install · ${fmtUsd(u.price)}` : 'Insufficient cash'}
          </DraftingButton>
        )}
      </div>
    )
  }
}

// -------------------------------------------------------------------------
// Charts & retrospective
// -------------------------------------------------------------------------

function ProfitChart(handle: Handle<{ history: readonly YearOutcome[] }>) {
  return () => {
    let { history } = handle.props
    let width = 720
    let height = 150
    let pad = 28

    let mine = history.map((h) => ({ y: h.year, v: h.playerCumProfit }))
    let theirs = history.map((h) => ({ y: h.year, v: h.rivalCumProfit }))
    let all = [...mine.map((p) => p.v), ...theirs.map((p) => p.v), 0]
    let maxV = Math.max(...all, 1)
    let minV = Math.min(...all, 0)
    let range = maxV - minV || 1

    let xScale = (yr: number) =>
      pad + ((yr - START_YEAR) / (END_YEAR - START_YEAR)) * (width - pad * 2)
    let yScale = (v: number) => height - pad - ((v - minV) / range) * (height - pad * 2)
    let mkPath = (pts: { y: number; v: number }[]) =>
      pts
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.y).toFixed(1)} ${yScale(p.v).toFixed(1)}`)
        .join(' ')

    return (
      <div mix={chartWrapStyle}>
        <div mix={chartLegendStyle}>
          <span>
            <span mix={legendAccentStyle} /> Your works
          </span>
          <span>
            <span mix={legendInkStyle} /> Pittsburgh Consolidated
          </span>
        </div>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          mix={chartSvgStyle}
          role="img"
          aria-label="Cumulative profit, you vs. Pittsburgh Consolidated"
        >
          <title>Cumulative profit, {START_YEAR}–{END_YEAR}</title>
          <line
            x1={pad}
            y1={yScale(0)}
            x2={width - pad}
            y2={yScale(0)}
            stroke={T.ink}
            stroke-width="0.6"
            opacity="0.5"
          />
          <text x={pad} y={height - 6} font-size="9" font-family="IBM Plex Mono" fill={T.ink} opacity="0.6">
            {START_YEAR}
          </text>
          <text x={width - pad} y={height - 6} font-size="9" text-anchor="end" font-family="IBM Plex Mono" fill={T.ink} opacity="0.6">
            {END_YEAR}
          </text>
          <text x={width - pad} y={pad - 4} font-size="9" text-anchor="end" font-family="IBM Plex Mono" fill={T.ink} opacity="0.6">
            {fmtUsd(maxV)}
          </text>
          {theirs.length > 0 && (
            <path d={mkPath(theirs)} stroke={T.ink} stroke-width="0.9" opacity="0.5" fill="none" />
          )}
          {mine.length > 0 && (
            <path d={mkPath(mine)} stroke={T.accent} stroke-width="1.8" fill="none" />
          )}
          {history.length === 0 && (
            <text
              x={width / 2}
              y={height / 2}
              text-anchor="middle"
              font-size="10"
              font-family="IBM Plex Mono"
              fill={T.ink}
              opacity="0.5"
            >
              NO HEATS ROLLED YET — DELIVER {START_YEAR} TO START THE LEDGER
            </text>
          )}
        </svg>
      </div>
    )
  }
}

function Retrospective(handle: Handle<{ game: CheapestTonWorks }>) {
  return () => {
    let { game } = handle.props
    let all = game.history.flatMap((h) => h.contracts)
    let wonAll = all.filter((c) => c.winner === 'you')
    let bid = all.filter((c) => c.player != null)
    let tonsDelivered = game.history.reduce((s, h) => s + h.wonTons, 0)
    let cheapestYears = game.history.filter((h) => h.cheapestTon).length
    let ahead = game.cumProfit > game.rivalCumProfit
    let delta = Math.abs(game.cumProfit - game.rivalCumProfit)

    let earlyWins = game.history.filter((h) => h.year <= 1889 && h.contracts.some((c) => c.winner === 'you')).length
    let lateWins = game.history.filter((h) => h.year >= 1896 && h.contracts.some((c) => c.winner === 'you')).length

    let byProduct = ['rails', 'wire-rod', 'axles', 'bridge-plate'].map((p) => {
      let of = all.filter((c) => c.contract.product === p)
      let won = of.filter((c) => c.winner === 'you')
      return { product: getProduct(p as ProductId).name, won: won.length, total: of.length }
    })

    return (
      <section mix={retroWrapStyle}>
        <div mix={retroFigStyle}>Fig. 6.3 — Sixteen years later</div>
        <h2 mix={retroTitleStyle}>How the ledger closed</h2>
        <div mix={retroStatsStyle}>
          <Readout k="Your cumulative profit" v={fmtUsd(game.cumProfit)} accent />
          <Readout k="Pittsburgh Consolidated" v={fmtUsd(game.rivalCumProfit)} />
          <Readout k="Verdict" v={ahead ? `AHEAD by ${fmtUsd(delta)}` : `BEHIND by ${fmtUsd(delta)}`} />
          <Readout k="Tons delivered" v={fmtTons(tonsDelivered)} />
          <Readout k="Contracts won" v={`${wonAll.length} of ${bid.length} bid (${all.length} offered)`} />
          <Readout k="Years you rolled the cheapest ton" v={`${cheapestYears} / ${YEARS}`} />
          <Readout k="Capex installed" v={fmtUsd(game.capexSpent)} />
        </div>
        <div mix={retroProductRowStyle}>
          {byProduct.map((b, i) => (
            <span key={`bp-${i}`} mix={retroChipStyle}>
              {b.product}: {b.won}/{b.total}
            </span>
          ))}
        </div>
        <p mix={retroNarrativeStyle}>
          {ahead
            ? 'You beat the combine. '
            : 'The combine beat you. '}
          {lateWins >= earlyWins
            ? 'You kept winning as the landscape moved — the mark of a mill that reads the market sheet instead of trusting its habits.'
            : 'You won the early book and lost the late one. Nothing about your furnaces changed — the prices, the specs, and the rival moved. The recipe that wins 1885 quietly stops winning by the mid-1890s; the only question is whether you notice.'}
        </p>
        <p mix={retroNarrativeStyle}>
          What actually happened: American open-hearth tonnage passed Bessemer tonnage around
          1908, driven by exactly the forces in this sim — collapsing scrap prices, quality
          specifications that wrote converter steel out of structural work, and phosphoric ores
          the basic lining unlocked. Bessemer rails hung on for decades because on loose-spec,
          low-P work the converter really was the cheapest ton. Neither furnace was "better."
          That is the point.
        </p>
      </section>
    )
  }
}

// -------------------------------------------------------------------------
// Formatting
// -------------------------------------------------------------------------

function fmtUsd(n: number): string {
  let abs = Math.abs(n)
  let sign = n < 0 ? '−' : ''
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}k`
  return `${sign}$${abs.toFixed(0)}`
}

function fmtTons(n: number): string {
  return `${(n / 1000).toFixed(n >= 10_000 || n % 1000 === 0 ? 0 : 1)}k t`
}

// -------------------------------------------------------------------------
// Styles
// -------------------------------------------------------------------------

const pageStyle = css({
  fontFamily: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
  color: T.ink,
  display: 'flex',
  flexDirection: 'column',
  gap: '28px',
})

const twoColStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 320px',
  gap: '24px',
  alignItems: 'flex-start',
  '@media (max-width: 1100px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
})

const mainColumnStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
  minWidth: 0,
})

const asideStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  position: 'sticky',
  top: '96px',
  '@media (max-width: 1100px)': { position: 'static', top: 'auto' },
})

const eventBannerStyle = css({
  border: `2px solid ${T.accent}`,
  background: T.accentSoft,
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
})

const eventLineStyle = css({
  fontSize: '11px',
  lineHeight: 1.5,
  fontWeight: 700,
  letterSpacing: '0.04em',
})

const bookIntroStyle = css({
  fontSize: '11px',
  lineHeight: 1.5,
  opacity: 0.8,
  marginBottom: '14px',
})

const bookGridStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
})

const contractCardStyle = css({
  border: `1px solid ${T.ink}`,
  background: T.panelStrong,
  padding: '12px 14px',
})

const contractCardPassedStyle = css({ opacity: 0.55, background: T.panel })

const contractHeadStyle = css({
  display: 'flex',
  alignItems: 'baseline',
  gap: '10px',
  flexWrap: 'wrap',
})

const contractNameStyle = css({
  fontSize: '14px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
})

const contractTonsStyle = css({
  fontSize: '12px',
  fontWeight: 700,
  color: T.accent,
})

const contractSpecStyle = css({
  fontSize: '9px',
  letterSpacing: '0.12em',
  border: `1px solid ${T.ink}`,
  padding: '2px 6px',
  opacity: 0.8,
})

const contractPriceStyle = css({
  marginLeft: 'auto',
  fontSize: '12px',
  fontWeight: 700,
})

const contractBlurbStyle = css({
  fontSize: '10px',
  opacity: 0.65,
  margin: '4px 0 10px',
  lineHeight: 1.5,
})

const segmentRowStyle = css({
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  marginBottom: '10px',
})

const segmentGroupStyle = css({
  display: 'inline-flex',
  border: `1px solid ${T.ink}`,
})

const segmentBase = {
  appearance: 'none',
  fontFamily: 'inherit',
  fontSize: '9px',
  letterSpacing: '0.1em',
  padding: '6px 9px',
  border: 'none',
  cursor: 'pointer',
  transition: 'background-color 120ms ease, color 120ms ease',
  '& + &': { borderLeft: `1px solid ${T.ink}` },
} as const

const segmentStyle = css({
  ...segmentBase,
  background: 'transparent',
  color: T.ink,
  '&:hover': { background: T.panelStrong },
})

const segmentActiveStyle = css({
  ...segmentBase,
  background: T.ink,
  color: T.paper,
  fontWeight: 700,
})

const quoteRowStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: '8px',
  marginTop: '2px',
  '@media (max-width: 720px)': { gridTemplateColumns: '1fr 1fr' },
})

const quoteStatStyle = css({
  border: `1px dashed ${T.ink}`,
  padding: '6px 8px',
})

const quoteStatLabelStyle = css({
  fontSize: '8px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  opacity: 0.6,
})

const quoteStatValueStyle = css({
  fontSize: '13px',
  fontWeight: 700,
  marginTop: '2px',
})

const quoteStatValueAccentStyle = css({
  fontSize: '13px',
  fontWeight: 700,
  marginTop: '2px',
  color: T.accent,
})

const cardWarnStyle = css({
  marginTop: '8px',
  border: `1px solid ${T.accent}`,
  background: T.accentSoft,
  padding: '7px 10px',
  fontSize: '10px',
  lineHeight: 1.5,
  fontWeight: 700,
})

const passRowStyle = css({
  marginTop: '10px',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
})

const passButtonStyle = css({
  appearance: 'none',
  fontFamily: 'inherit',
  fontSize: '9px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  padding: '5px 8px',
  border: `1px dashed ${T.ink}`,
  background: 'transparent',
  color: T.ink,
  cursor: 'pointer',
  '&:hover': { background: T.panelStrong },
})

const passedTagStyle = css({
  fontSize: '9px',
  letterSpacing: '0.08em',
  opacity: 0.7,
  textTransform: 'uppercase',
})

const reviewWrapStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
})

const reviewSummaryStyle = css({
  fontSize: '12px',
  lineHeight: 1.5,
  borderBottom: `1px dashed ${T.ink}`,
  paddingBottom: '10px',
})

const reviewGridStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
})

const outcomeCardStyle = css({
  border: `1px solid ${T.ink}`,
  background: T.panelStrong,
  padding: '10px 12px',
})

const outcomeHeadStyle = css({
  display: 'flex',
  alignItems: 'baseline',
  gap: '10px',
  flexWrap: 'wrap',
})

const outcomeStampBase = {
  marginLeft: 'auto',
  fontSize: '9px',
  letterSpacing: '0.12em',
  fontWeight: 700,
  padding: '3px 8px',
  border: '1px solid',
} as const

const outcomeStampWinStyle = css({
  ...outcomeStampBase,
  color: T.paper,
  background: T.ink,
  borderColor: T.ink,
})

const outcomeStampLoseStyle = css({
  ...outcomeStampBase,
  color: T.ink,
  borderColor: T.ink,
  opacity: 0.65,
})

const outcomeStampFailStyle = css({
  ...outcomeStampBase,
  color: T.paper,
  background: T.accent,
  borderColor: T.accent,
})

const outcomeBodyStyle = css({
  marginTop: '6px',
  fontSize: '11px',
  lineHeight: 1.6,
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
})

const outcomeMarginStyle = css({ opacity: 0.7 })

const profitGoodStyle = css({ color: T.ink, fontWeight: 700 })
const profitBadStyle = css({ color: T.accent, fontWeight: 700 })

const yearRowStyle = css({ marginBottom: '12px' })

const yearBigStyle = css({
  fontSize: '52px',
  fontWeight: 700,
  lineHeight: 1,
  color: T.accent,
})

const yearMetaStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '10px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  opacity: 0.75,
  marginTop: '6px',
})

const phaseTagStyle = css({ fontWeight: 700 })

const capacityWarnStyle = css({
  marginTop: '10px',
  border: `1px solid ${T.accent}`,
  background: T.accentSoft,
  padding: '8px 10px',
  fontSize: '10px',
  lineHeight: 1.5,
  fontWeight: 700,
})

const resetRowStyle = css({ margin: '10px 0 12px' })

const meterWrapStyle = css({ marginBottom: '12px', '&:last-child': { marginBottom: 0 } })

const meterHeadStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '10px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: '4px',
})

const meterOverStyle = css({ color: T.accent, fontWeight: 700 })

const meterTrackStyle = css({
  height: '10px',
  border: `1px solid ${T.ink}`,
  position: 'relative',
})

const meterFillStyle = css({
  position: 'absolute',
  inset: 0,
  right: 'auto',
  background: T.accentSoft,
  borderRight: `2px solid ${T.accent}`,
})

const meterFillOverStyle = css({
  position: 'absolute',
  inset: 0,
  right: 'auto',
  background: T.accent,
})

const marketStripStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
})

const sparkRowStyle = css({})

const sparkLabelStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '9px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  opacity: 0.8,
  marginBottom: '2px',
})

const sparkValueStyle = css({ color: T.accent, fontWeight: 700 })

const sparkSvgStyle = css({
  display: 'block',
  width: '100%',
  height: '26px',
})

const marketNoteStyle = css({
  fontSize: '9px',
  lineHeight: 1.5,
  opacity: 0.6,
  borderTop: `1px dashed ${T.ink}`,
  paddingTop: '8px',
})

const upgradeGridStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
})

const upgradeCardStyle = css({
  border: `1px solid ${T.ink}`,
  padding: '10px 12px',
  background: T.panel,
})

const upgradeOwnedStyle = css({ background: T.accentSoft, borderColor: T.accent })

const upgradeHeadStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: '8px',
})

const upgradeNameStyle = css({
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
})

const upgradeTagStyle = css({
  fontSize: '10px',
  fontWeight: 700,
  color: T.accent,
  whiteSpace: 'nowrap',
})

const upgradeBlurbStyle = css({
  fontSize: '10px',
  lineHeight: 1.5,
  opacity: 0.75,
  margin: '4px 0 8px',
})

const upgradeRivalNoteStyle = css({
  fontSize: '9px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  opacity: 0.6,
  marginBottom: '8px',
})

const chartWrapStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
})

const chartLegendStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '14px',
  fontSize: '10px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  opacity: 0.85,
})

const legendSwatchBase = {
  display: 'inline-block',
  width: '14px',
  height: '2px',
  marginRight: '5px',
  verticalAlign: 'middle',
} as const

const legendAccentStyle = css({ ...legendSwatchBase, background: T.accent })
const legendInkStyle = css({ ...legendSwatchBase, background: T.ink, opacity: 0.5 })

const chartSvgStyle = css({
  display: 'block',
  width: '100%',
  height: 'auto',
})

const retroWrapStyle = css({
  border: `2px solid ${T.accent}`,
  background: T.accentSoft,
  padding: '20px',
})

const retroFigStyle = css({
  fontSize: '10px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  opacity: 0.7,
})

const retroTitleStyle = css({
  fontFamily: 'inherit',
  fontSize: '28px',
  fontWeight: 700,
  textTransform: 'uppercase',
  margin: '6px 0 14px',
  color: T.accent,
})

const retroStatsStyle = css({ marginBottom: '12px' })

const retroProductRowStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginBottom: '12px',
})

const retroChipStyle = css({
  border: `1px solid ${T.ink}`,
  background: T.panelStrong,
  padding: '3px 8px',
  fontSize: '10px',
  letterSpacing: '0.06em',
  fontWeight: 700,
  textTransform: 'uppercase',
})

const retroNarrativeStyle = css({
  fontSize: '12px',
  lineHeight: 1.65,
  margin: '0 0 10px',
  maxWidth: '720px',
})

const noteStyle = css({
  fontSize: '11px',
  lineHeight: 1.6,
  opacity: 0.85,
  maxWidth: '860px',
})
