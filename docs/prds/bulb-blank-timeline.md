# Bulb Blank Timeline

**Source:** *The Origins of Efficiency*, Ch 1 — What Is a Production Process?
**Status:** proposed
**Route:** `/bulb-blanks` (suggested)

## Pitch

From 150 bulbs an hour to 33 a second. Drag the year slider through Corning's mechanization of the light-bulb blank — mold method (1880s) → Empire E semiautomatic (1912) → Westlake (1921) → Improved Westlake (1930s) → Ribbon machine (1980s, ~15 machines for the entire world). Watch the workers vanish.

## Why this lab

Pin Factory shows what happens *inside* a single production run. This shows what happens *across decades* of mechanization for a single product. Same five-station mental model the user already has — different time axis. It's the most legible "automation eats labor" story in the book because the unit (one bulb blank) is the same in 1880 and today.

## Core mechanic

Each era is a fixed configuration with hard-coded specs from the book:

| Era | Year | Output (blanks/hr) | Workers/machine | Notes |
|---|---|---|---|---|
| Hand / mold | 1880 | 150 | 3 | Three-person team per mold |
| Empire E | 1912 | 400 | ~2.7 | First semiautomatic |
| Westlake | 1921 | 1,000 | low | Fully automatic |
| Improved Westlake | 1930s | 5,000 | low | Same mech, better tolerances |
| Ribbon machine | 1980s+ | 120,000 | ~0.1 | One operator monitors several |

Given a target *demand* (bulbs/year), derive:

- **Machines required** = demand ÷ (output_per_hour × hours_per_year × utilization)
- **Headcount** = machines × workers/machine
- **Headcount per million bulbs** = the headline number that drops 10,000×
- **Cost per bulb** (rough) = (labor_cost × headcount + capex_amortized × machines) ÷ demand

## Knobs

- **Era slider** — discrete, 5 positions, snaps. The primary knob.
- **Annual demand** — log slider, 1M to 10B bulbs/year, default 1B (~world demand)
- **Hourly wage** — default $15, used for cost-per-bulb derivation
- **Utilization %** — default 80%

## What's on screen

- **Animation panel:** one machine of the chosen era, running at its actual cycle rate (slowed to a watchable pace with a "real time" toggle that runs at true ratio — ribbon machine just looks like a blur). Worker silhouettes show the headcount per machine.
- **Era card:** name, year, output rate, workers/machine, one-line description.
- **Big numbers:**
  - Machines required to meet demand
  - Total headcount
  - Workers per million bulbs/year
  - Cost per bulb
- **Comparison strip:** as you slide eras, the previous era's numbers stay ghosted next to the current era so the delta is visible. The "workers per million bulbs" number is the visceral one.

## Interaction loop

1. User sets demand (or accepts default world-scale demand).
2. User starts at the 1880 era — sees a small army of three-person teams.
3. Slides forward in time. Headcount falls; the machine animates faster.
4. At ribbon, the "workers per million bulbs" counter has dropped enough zeros to be silly.

## Out of scope

- Quality / defect rates per era (book mentions but doesn't quantify well enough)
- Capital cost detail — use a single rough capex number per era
- Other glassware (tubing, fiber) — bulb blanks only

## Open questions

- Should the slider be continuous (interpolated) or snap-to-era? Snap is more honest to the historical record. Continuous is more fun but invents data. → **Snap.**
- Demand at the world-scale default makes the early eras impossible (you'd need millions of teams). Is that a feature (showing why mechanization happened) or a bug (numbers are absurd)? → Feature. Add a "this is why someone invented the next machine" annotation when headcount exceeds plausibility.
- Should we show the *cumulative* labor saved across the timeline, not just the snapshot? Probably yes, as a small ticker.

## Stretch

- Overlay actual Corning / GE production volumes from the book to anchor the demand slider in real history.
- "Could the world run on hand-blown bulbs?" mode — sets demand to 1B and shows the headcount required at the 1880 era. The answer is: most of the global workforce.
