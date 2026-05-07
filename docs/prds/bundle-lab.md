# Bundle Lab (Ford's Compounding Improvements)

**Source:** *The Origins of Efficiency*, Ch 8 — Bundles, Chains, and Feedback Loops
**Status:** proposed
**Route:** `/bundle` (suggested)
**Related:** `pin-factory` (extends the serial-line model with improvement interdependence)

## Pitch

Ford's competitors knew every one of Ford's techniques. None of them caught up for years. The reason is in this chapter: assembly-line improvements aren't additive — they're *bundled*. Standardized parts only pay off if assembly is interchangeable. Interchangeable assembly only pays off if worker stations are fixed. Fixed stations only pay off if cycle times are synchronized. And so on. Apply one in isolation, you get nothing or worse. Apply the right bundle in the right order, and the compounding kicks off a feedback loop with demand. This lab makes the order matter.

## Why this lab

Pin Factory shows a serial line as geometry. Bundle Lab shows it as a *system of dependencies* — and adds the volume-cost feedback loop that drove Model T price from $850 in 1908 to $260 in 1925 (and demand from a luxury good to half the cars in America). It's the lab that explains why "best practice" diffuses slowly even when nothing is secret: because copying a single practice without its bundle does not work.

## Core mechanic

A roster of ~14 candidate improvements, each with:

- `cost` — capital and disruption cost to apply
- `base_benefit` — naive cost-per-unit reduction in isolation
- `prerequisites[]` — improvements whose presence multiplies this improvement's benefit
- `realized_benefit = base_benefit × Π(prereq_present ? full : penalty)`

If prerequisites are missing, `penalty < 1` (often `< 0` — the improvement actively hurts). A "fixed worker station" applied without "interchangeable parts" just creates idle workers waiting for unique components. A "moving conveyor" applied without synchronized cycle times produces piles of WIP at the slowest station.

Example bundle (truncated):

| Improvement | Prerequisites | Without prereqs | With prereqs |
|---|---|---|---|
| Standardize parts | — | +5% | +5% |
| Interchangeable assembly | Standardized parts | −3% | +12% |
| Fixed worker stations | Interchangeable assembly | −8% | +10% |
| Motion study | Fixed stations | +2% | +18% |
| Cycle-time sync | Motion study, fixed stations | 0% | +15% |
| Moving conveyor | Cycle-time sync | −20% (chaos) | +25% |
| Conveyor at waist height | Moving conveyor | +1% | +8% |
| Single-task specialization | Cycle-time sync | −5% (boredom + skill loss) | +12% |
| Training-time reduction | Single-task specialization | 0% | +6% |

Once the bundle is mostly in place, a **feedback loop** activates:

```
unit_cost ↓ → price ↓ → demand ↑ → volume ↑ → tooling investment justified ↑ → unit_cost ↓ ↓
```

The loop is visualized as a closed circle on screen with values updating each year. Once it spins up, the user's cost-per-unit curve bends sharply.

## Knobs / interactions

- **Improvement panel** — cards for each candidate improvement. User clicks to apply (paying cost). Tooltip shows base benefit; realized benefit is revealed only after application.
- **Order matters** — improvements applied out of order log a "negative compounding" event in the timeline.
- **Undo budget** — limited rollbacks (3 per run) to recover from bad ordering. Real factories couldn't easily un-disrupt either.
- **Demand sensitivity** — slider for how strongly price cuts pull in demand. Low sensitivity (industrial goods) makes the feedback loop weak; high sensitivity (consumer goods like Model T) makes it the dominant force.
- **Time horizon** — 10-year run by default, year tick.

## What's on screen

- **Assembly line view** — top of screen, similar to Pin Factory. Visual state updates as improvements apply (workers spread out, conveyor appears, heights adjust, etc.). Animated indicators of WIP / idleness reflect the realized benefit.
- **Improvement panel** — left side. Cards grouped by category (parts / layout / motion / flow / labor). Locked cards greyed out with prerequisite hints visible on hover.
- **Dependency graph** — collapsible panel. Shows the full improvement DAG with edges weighted by compounding strength. Applied improvements light up. Highlights which paths the user has and hasn't taken.
- **Feedback loop diagram** — small closed-cycle widget showing cost → price → demand → volume → cost. Activates visually (animated arrows) once cost falls below a threshold.
- **Big numbers:**
  - Unit cost, current and historical low
  - Annual production volume
  - Selling price
  - Cumulative units (drives Wright's-Law-style learning, runs in background)
  - Market share against a static "competitor" baseline
- **Timeline** at the bottom listing improvements as they were applied, with realized benefit per item — so the user can see in retrospect which ones flopped and why.

## Interaction loop

1. User opens at year 1, traditional craft assembly. Unit cost high, volume low.
2. User applies "moving conveyor" first because it sounds high-impact. Penalty fires (no cycle-time sync). Cost goes *up*. They learn the lesson.
3. User reverts (uses an undo) and applies "standardize parts" → "interchangeable assembly" → "fixed stations" → "motion study" → "cycle-time sync" → "moving conveyor." Each step compounds. Cost falls.
4. Around year 5, the feedback loop activates. Volume jumps, price drops, demand surges. The cost curve bends.
5. By year 10, the user is producing 10× the initial volume at 1/3 the unit cost. Or, if they sequenced badly, they've produced about 2× the volume at 80% of the original cost — visible improvement, but a fraction of what's possible.

## Out of scope

- Branching product lines (single SKU)
- Supply-chain effects beyond raw input cost
- Worker welfare / turnover modeling — the book mentions Ford's $5/day wage was part of the bundle (it stabilized the workforce that single-task specialization required), but modeling it well needs care; mention in copy, don't simulate.
- Multi-factory networks

## Open questions

- Should the dependency DAG be visible from the start, or revealed as the user discovers it through trial and error? Discovery is more pedagogically powerful but more frustrating. Lean toward: edges visible (so the user can plan), realized-benefit numbers hidden until application (so the user has to commit).
- The negative-benefit cases ("conveyor without sync = chaos") are the lab's punchline. They need to fire often enough that the user encounters them, but not so often that the user can't make progress. Calibrate so a "reasonable" first run hits 1–2 negative-compounding events.
- Should the feedback loop be optional (industrial-goods mode where it doesn't activate) or always-on? Probably a mode toggle — the loop is the chapter's biggest idea but it's not universal. Some processes don't have demand-elastic feedback.
- How explicit should the historical framing be? The book is explicit about Ford. Copy can name Ford and the Model T price points; the underlying engine is general enough that the lab works as a generic assembly study too.

## Stretch

- **Historical replay** — preset that applies improvements in the order Ford actually did, year by year, with the historical Model T price overlay. User watches the curve match.
- **Competitor mode** — a second factory runs in the background trying to copy your improvements one at a time, in random order. Demonstrates why imitation diffuses slowly.
- **Connection to Wright's Law Lab** — the underlying volume-driven cost decline can use Wright's curve; bundles set `C(1)` and the learning rate. A meta-narrative across the two labs.
- **Connection to Disruption Lab** — applying a new improvement is itself a disruption; high-bundle players who keep applying improvements late could trip the experience-reset trap. A reach, but the labs share an engine.
