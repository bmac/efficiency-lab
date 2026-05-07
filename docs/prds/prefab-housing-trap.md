# Prefab Housing Trap

**Source:** *The Origins of Efficiency*, Ch 10 — Failures to Improve
**Status:** proposed
**Route:** `/prefab` (suggested)

## Pitch

Lustron (1947), Stirling Homex (1967), Katerra (2015) — different decades, same factory, same bankruptcy. Run a modular-home plant for ten simulated years and find out why the math doesn't close. The lab is a cautionary tale: every other simulation in this project rewards optimization. This one shows where optimization runs out of road.

## Why this lab

The book's tenth chapter is the only one about *failure*, and it's the most counterintuitive. The existing labs all reward turning knobs the right way. This one rewards turning the knobs the right way and *still losing*, which is a more useful lesson about why some industries don't get disrupted on the schedule that bench-scale economics suggests they should.

## Core mechanic

Yearly tick. Each year:

- Factory produces N modules at unit cost = (labor + materials + capex_amortized + overhead) / N
- Per-module shipping cost = shipping_rate × distance × module_oversize_multiplier
- Site assembly cost adds a fixed amount per module
- Customer pays = market price (capped by site-built comparable in their region)
- Profit = (market price − all-in cost) × units sold

**Site-built baseline** is exogenous: $X/sqft, set as a market constant. The user is competing against it implicitly — sales fall off when their delivered price exceeds site-built comparable.

**Demand model** (rough):

```
demand_at_radius_r = catchment_population(r) × addressable_share
                   × sigmoid((site_built_price − delivered_price) / sensitivity)
```

The trap: scaling production lowers unit cost but also forces a wider shipping radius, which raises delivered price superlinearly because of permit / oversize / escort costs on large modules. There's a sweet spot well below the volume needed to amortize the factory.

## Knobs

- **Module size** — small box / medium / large multi-section
  - Larger modules: fewer site assembly steps, but exponentially worse shipping (over-width permits, escort vehicles, route restrictions)
- **Annual factory throughput** — units/year (1k to 100k)
- **Factory location** — rural cheap-labor / suburban / urban-near-market
- **Capex commitment** — affects fixed cost per year and ceiling throughput
- **Wage strategy** — pay site-built rates / pay 70% of site-built (high turnover) / pay 50% (constant retraining loss)

## What's on screen

- **Map** — factory location pin, sales radius circle, site-built competitor density heatmap
- **Per-module cost waterfall** — labor / materials / capex / shipping / site assembly, with the site-built comparable price drawn as a horizontal "ceiling" line
- **Annual P&L** — running over the simulated years, with cumulative profit/loss
- **Year ticker** with pause / step / fast-forward
- **Failure modes** that fire as on-screen events:
  - "Module exceeds 14 ft width — escort vehicles required, +$8k/unit"
  - "Local building code rejects standard module — redesign or skip market"
  - "Site labor strike — assembly cost +40% this year"
- **Game over** screen on bankruptcy with the breakdown of which line item killed you

## Interaction loop

1. User picks a module size, throughput target, location. Sets capex commitment.
2. Sim runs year by year. Early years usually positive: small radius, manageable shipping.
3. To grow, user increases throughput. Shipping radius widens. Delivered price climbs.
4. User tries bigger modules to cut site labor. Shipping cost explodes.
5. User tries smaller modules. Site labor cost no longer differentiates from site-built.
6. By year 7 or so, cumulative P&L turns red regardless of strategy. Game over.
7. Some configurations *do* survive — small modules, dense market, modest throughput. But none win on cost vs. site-built at scale.

## Out of scope

- Manufactured-home (HUD-code) market — book notes these *do* work for small single-section units. Could be a separate lab; here we focus on the failed multi-section / modular case.
- International markets where site-built labor is more expensive (Japan's Toyota Housing makes this work-ish). Mention in copy, don't model.
- Financing / interest rates — single capital structure assumed.

## Open questions

- How honest should "winnable" feel? The book's claim is roughly *unwinnable at scale against US site-built*. The lab should reflect that — but a 100% game-over rate makes it feel scripted. Resolution: a few configurations should eke out modest profits, none should beat site-built outright on cost. The lesson is "you can survive, you can't dominate."
- Should we let the user *not* compete against site-built — e.g., serve markets where site-built is unavailable (remote locations)? Probably yes, as a small "specialty" mode. Reinforces that prefab works in niches.
- Tone: this is the only "failure" lab. Copy should be deadpan, not preachy. Match the existing tone, don't moralize.

## Stretch

- "Pick a real company" presets: Lustron / Stirling Homex / Katerra, each with their actual historical knob settings. Show the cumulative loss to date, then hand control to the user. Let them try to save the company. They can't.
- "Manufactured homes work" companion mini-mode that flips the same engine to single-wide HUD-code units in rural markets, and shows positive economics. Demonstrates the niche.
