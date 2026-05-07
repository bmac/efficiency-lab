# Liberty Ship Yard

**Source:** *The Origins of Efficiency*, Ch 3 — Reducing Input Costs
**Status:** proposed
**Route:** `/liberty-ships` (suggested)

## Pitch

It's 1942. U-boats are sinking British supply tonnage faster than UK shipyards can replace it. You run a US emergency-construction yard. Pick your inputs — rivets or welds, skilled or green labor, custom or standardized hulls — and try to keep the North Atlantic supply line ahead of the sinkings. The cheap choices are cheap for a reason. Some of them crack in cold water.

## Why this lab

Ch 3 is about input substitution: swap an expensive input for a cheaper one and accept the trade-off. The Liberty ship program is the textbook case because every category of substitution shows up in one product (materials, labor, design, work organization), the trade-offs are real (welded hulls actually did crack in cold water, ~1,500 of them), and there's a built-in scoring function (tonnage delivered vs. tonnage sunk). The lab teaches that input cost reduction isn't free — every cheap input has a downstream consequence — but that the right substitution at the right time can still win.

## Core mechanic

A yard produces ships per quarter. Each ship has:

```
build_cost   = materials + labor + tooling_amortized
build_time   = base_time × (1 / standardization) × labor_skill_factor × method_factor
failure_rate = f(steel_grade, joining_method, weather_zone)
tonnage      = 10,800 dwt (fixed per Liberty design)
```

A North Atlantic crossing has a per-voyage attrition rate (U-boat losses + structural failures). Net tonnage delivered = ships built × voyages survived × tonnage per ship.

The win condition is **cumulative net tonnage delivered to UK ≥ target by end of 1944**. The target is set so a "safe traditional" strategy (riveted, skilled-labor, custom design) loses by a wide margin — the user is forced to accept *some* cost reduction, the question is which.

## Knobs

Each knob is a small set of mutually exclusive options. Switching mid-game is allowed but has a one-quarter changeover cost.

- **Hull joining**
  - Riveted (slow, robust, requires skilled riveters)
  - Welded (fast, cheap, brittle in cold weather → failure rate up in winter North Atlantic)
  - Hybrid welded with riveted crack-arrestor strakes (post-1943 fix; available only after a research milestone)
- **Steel grade**
  - Standard (cheap, brittle below freezing)
  - Notch-tough (more expensive, no cold-weather penalty) — historically not specified until late in the program
- **Hull design**
  - Custom per yard (slow, expensive, no learning across yards)
  - Standardized EC2-S-C1 (Liberty design — adopted from a UK tramp design specifically because it was simple and weldable)
- **Subassembly strategy**
  - Build hull on the ways from keel up (traditional)
  - Prefabricate sections in shop, weld on the ways (Kaiser method — cuts time on the ways by ~60%)
- **Labor mix** — slider, % skilled
  - 80% skilled: slow, expensive, low rework
  - 20% skilled (Kaiser's actual mix): fast, cheap, more rework, requires standardized design to work at all

## What's on screen

- **Yard view** — animated SVG of a single yard with N ways (slipways). Ships under construction visibly progress. Faster strategies show more concurrent ways active.
- **North Atlantic strip** — a horizontal map. Ships icons leave the yard, cross, some get sunk (U-boat icon) or break (crack icon), the rest reach UK. Updated per quarter.
- **Quarterly readouts:**
  - Ships completed this quarter
  - Cost per ship
  - Voyages survived
  - Net tonnage delivered (cumulative bar with target line)
  - Sinkings + structural failures, broken out
- **Year ticker** Q1 1942 → Q4 1944
- **Event log** with historical milestones firing at calibrated dates ("January 1943 — first Liberty ship breaks in two off Aleutians", "March 1943 — notch-tough steel research available", etc.)

## Interaction loop

1. User opens at Q1 1942 with a "traditional" preset selected. Cost/ship is high, output is low. The U-boat strip shows tonnage falling behind early.
2. User switches to welded + standardized + Kaiser prefab + 30% skilled labor. Output triples. Cost/ship halves.
3. Winter 1942 hits. The first welded ships start cracking in cold water. The event log fires. Net tonnage delivered drops.
4. User has options: switch to notch-tough steel (expensive, undoes some of the cost gain) / wait for crack-arrestor research / accept attrition and just build more.
5. Game ends Q4 1944. Win or lose against the tonnage target. Debrief screen shows: which substitutions were worth it, which weren't, and what the historical program actually did (mostly: welded + standardized + Kaiser, accepted ~1,500 cracked hulls, won anyway).

## Out of scope

- Multiple yards / yard-network logistics (single composite yard)
- Weapons / armament
- Crew training
- Detailed financials — cost per ship is a single composite number
- Other WWII shipbuilding programs (T2 tankers, Victory ships) — could be presets in stretch

## Open questions

- How punishing should the cold-weather failure mode be? Historically ~1,500 of ~2,710 ships had cracks but only ~12 broke catastrophically. The lab needs the failure mode visible enough to teach the trade-off without making welding obviously the wrong choice (it wasn't — the program won). Calibrate so welding-without-crack-arrestors loses some net tonnage but not the game.
- Should the user know about notch-tough steel from the start, or only after the historical research milestone fires? Lean toward time-gated — the lesson is partly that real engineers didn't know the answer in advance.
- Tone: this is wartime context. Match the existing deadpan tone — no glorification, no moralizing. The lab is about input economics, not the war itself. Copy should treat the U-boat strip as an attrition function, not a battle.

## Stretch

- **Historical preset slider:** "Run the actual Kaiser strategy" / "Run the cautious British strategy" / "Run an all-skilled-labor traditional yard" — pre-fills knobs to recreate documented programs and shows the historical outcome.
- **Compare mode:** two yards side by side with different input choices, same external attrition. Direct visual on the cost/risk trade-off.
- **Other-product presets** drawn from Ch 3:
  - Stamped vs. forged firearm components (abstracted; no specific weapons depicted)
  - Concrete vs. steel hulls (briefly attempted in WWI/WWII)
  - Welded vs. seamless steel pipe
