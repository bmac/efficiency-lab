# Blast Furnace / Square-Cube Lab

**Source:** *The Origins of Efficiency*, Ch 4 — Production Rate and Economies of Scale
**Status:** proposed
**Route:** `/blast-furnace` (suggested)

## Pitch

Twenty feet to a hundred. Volume cubes, losses square. The math that ate the iron industry. Resize a blast furnace from 16th-century English (~250 tons/yr) to modern Korean (3M+ tons/yr) and watch cost/ton fall as a direct consequence of geometry.

## Why this lab

None of the existing labs teach **scale** as a primary mechanism. The book is emphatic that scale was the *largest* cost-reduction factor in 20th-century iron — bigger than process changes, bigger than labor, bigger than ore quality. The square-cube law is the cleanest physical reason for that, and a furnace is a textbook case where the math is visible.

## Core mechanic

Treat the furnace stack as a cylinder of height `h` and radius `r`.

- **Volume** `V = π r² h` — drives throughput (combustion mass × residence time)
- **Lateral surface** `S = 2π r h + 2π r²` — drives heat loss to the surroundings
- **Wall mass / capex** ≈ proportional to `S × wall_thickness`, with `wall_thickness` scaling weakly with `h` for structural reasons

Per-ton derivation (rough but honest):

```
throughput_tons_per_year = V × air_blast_rate × ore_grade × utilization × campaign_days
heat_loss_GJ_per_year    = S × loss_per_m²
fuel_GJ_per_year         = throughput × fuel_intensity + heat_loss
cost_per_ton             = (fuel + ore + labor + capex_amortized) / throughput
```

The headline result: as you scale `r` and `h` together, throughput grows as `r²h` while heat losses grow as `rh`. Cost/ton trends down until structural / metallurgical limits kick in.

## Knobs

- **Furnace height** — 20 ft to 300 ft, slider
- **Hearth diameter** — 4 ft to 50 ft, slider
- **Ore grade** — 30% to 65% Fe content
- **Air blast** — cold blast / warm / hot blast (Neilson, 1828)
- **Fuel** — charcoal / raw coal / coke
- **Wage rate** — for labor cost line

## What's on screen

- **Furnace silhouette** — drawn to scale alongside a human, a five-story building, and the Statue of Liberty for reference. Visceral when the user pushes height past 200 ft.
- **Live readouts:**
  - Throughput (tons/year)
  - Cost/ton, broken into fuel / ore / labor / capex stacked bar
  - Heat loss as % of fuel input
  - Capacity in "stoves per year" (84× US growth from 1830 to 1870 — gives the number meaning)
- **Historical pin markers** on the height/diameter sliders:
  - 1500s English (~20 ft, 250 tons/yr)
  - 1870 American (~80 ft)
  - Modern Korean (~110 ft, 3M+ tons/yr)
- **Warning indicators** when knobs hit physical / historical limits (e.g., charcoal furnaces couldn't go past ~50 ft tall before the column collapsed under its own weight — that's why coke mattered).

## Interaction loop

1. User starts at the 16th-century preset. Sees a small furnace, high cost/ton.
2. Pushes height. Cost/ton falls. Fuel intensity drops. Heat loss as a fraction shrinks.
3. At some point, charcoal column collapse warning fires. User has to switch to coke to keep going.
4. Pushes ore grade up — cost falls again. Pushes air blast to "hot" — fuel cost drops 30%.
5. Stops at ~110 ft / hot blast / coke / 60% ore and reads the cost/ton, then compares to where they started.

## Out of scope

- Full thermodynamic accuracy — this is a teaching toy, not a metallurgical sim. Calibrate the constants so the historical pins land in the right cost/ton band, then leave it alone.
- Steel (Bessemer, BOF, EAF) — pig iron only. Bessemer deserves its own lab.
- Logistics / coal supply chain
- Pollution / externalities (worth noting in copy, but not modeled)

## Open questions

- How aggressively should the lab punish historically impossible combinations (charcoal + 200 ft)? A hard error is annoying; a soft warning + degraded yield feels right.
- Should the lab include a "year" slider that *implies* the available technology (only coke after 1709, only hot blast after 1828)? Probably yes — it makes the historical pins feel earned rather than arbitrary.
- Is capex modeling honest enough to be worth showing as a line item, or should we hide it and only show operating cost? Lean toward including it — it's part of why furnaces couldn't scale before steel rolling was solved.

## Stretch

- "Recreate Andrew Carnegie's 1880 cost curve" preset and challenge.
- Side-by-side compare two furnaces at different scales for the same target output — small/many vs. large/few.
