# Batch vs. Flow

**Source:** *The Origins of Efficiency*, Ch 9 — Continuous Processes
**Status:** proposed
**Route:** `/batch-vs-flow` (suggested)

## Pitch

Two identical product lines, side by side. Same five stations, same cycle times, same defect rates. One processes in batches of 50. The other processes one unit at a time, continuous flow. Slide the batch size from 1 to 100 and watch lead time, work-in-process, capital tied up, and defect propagation diverge — sometimes by an order of magnitude.

## Why this lab

Pin Factory teaches the geometry of a serial line but defaults to single-unit flow. Nothing in the project answers the most common manufacturing question: *should we batch or shouldn't we?* The book's Ch 9 narrative — papermaking moving from 18th-century batch vats to the 19th-century Fourdrinier continuous machine — is the canonical case study, and the mechanics generalize to almost everything: chemical processing, food, electronics assembly, software deploys.

This is also the lab where the *graphs* do the teaching. Batch vs. flow trade-offs aren't intuitive in prose; they're obvious on a Gantt chart and a WIP-over-time line.

## Core mechanic

Two pipelines run the same product through five stages. Each stage has:

- `cycle_time` — seconds per unit
- `setup_time` — fixed cost paid once per batch (not per unit)
- `defect_rate` — probability a unit needs rework

**Batch pipeline:**
- Each station processes the entire batch before passing to the next
- Setup is paid once per batch
- Defects discovered at end-of-line inspection — entire batch may share a root cause, leading to large rework events
- WIP per station: up to one full batch sitting at any time

**Flow pipeline:**
- Each unit moves to the next stage as soon as ready
- Setup is paid per unit (or per small handoff)
- Defects discovered at next stage immediately — single-unit rework
- WIP per station: one unit at most

Lead time per unit:

```
batch_lead_time = sum_over_stages(setup + batch_size × cycle_time)
flow_lead_time  = sum_over_stages(setup + cycle_time)
```

WIP at steady state:

```
batch_WIP ≈ stages × batch_size
flow_WIP  ≈ stages
```

Capital tied up = WIP × unit_cost.

## Knobs

- **Batch size** — 1 to 200, log slider. The headline knob.
- **Setup time per stage** — varies the trade-off; high setup makes batching look attractive
- **Cycle-time variance** — adds randomness; batching hides variance under the batch wait, flow exposes it
- **Defect rate** — drives the rework difference between the two modes
- **Demand profile** — steady / bursty / declining — bursty demand penalizes the long lead time of large batches especially hard

## What's on screen

Two parallel diagrams, top and bottom, sharing the same time axis.

- **Top: Batch line** — five stations, animated. A "wave" of units sits at each station for the full batch duration, then advances. Visible WIP piles.
- **Bottom: Flow line** — same five stations. A continuous trickle of one-unit handoffs.
- **Live readouts (one per pipeline):**
  - Cumulative units completed
  - Average lead time per unit
  - Current WIP
  - Capital tied up
  - Defects discovered, defects shipped (escaped)
  - Setup time as % of total time
- **Combined chart strip:**
  - Lead-time histogram per pipeline
  - Cumulative output over time (the flow line gets first units out drastically faster)
  - WIP-over-time line
- **Slider for batch size**, with the upper pipeline reacting in real time. The lower pipeline (`batch_size = 1`) is the fixed reference.

## Interaction loop

1. User starts at `batch_size = 50`. Watches the batch line accumulate inventory while the flow line is already shipping units.
2. User pulls batch size down to 10. Lead time gap shrinks but doesn't vanish — setup overhead now dominates.
3. User pulls batch size to 1. Now the two lines look identical *unless* setup time is high — at which point flow loses badly to batches because it pays setup per unit.
4. User cranks setup time up. Suddenly batching wins on throughput. The "right" batch size now is the one that minimizes per-unit setup without inflating lead time.
5. User adds a defect spike. Batch line discovers the bad root cause too late and rejects 50 units. Flow line discovers at unit 3 and contains the damage.
6. User toggles "bursty demand." Long batch lead times mean the batch line misses demand spikes entirely. Flow keeps up.

The interaction is a kind of two-dimensional optimization the user discovers through the sliders: there's no universal answer, the right batch size depends on setup, defects, and demand variability.

## Out of scope

- Mixed-mode pipelines (some stations batch, others flow) — interesting but a follow-on lab, would need its own mental model
- Routing / branching products
- Setup-reduction techniques (SMED) — would dilute the trade-off message; mention in copy as the real-world lever
- Inventory carrying cost beyond simple capital tied up

## Open questions

- Should the lab include a "Fourdrinier mode" — a third pipeline that's truly continuous (no discrete units, just a measured rate)? Adds visual variety but might confuse the comparison. Lean: no, keep it two-pipeline. Mention papermaking history in copy.
- How realistic should defect-batch correlation be? Real batch defects often share a root cause; flow defects are more independent. Modeling this well shows batch's biggest weakness, but it's the kind of detail that needs honest calibration. Decide: include with a single "defect correlation within batch" parameter, default 0.6.
- Tone: the existing labs lean toward showing one principle dominantly. This lab is genuinely two-sided — batching wins under some conditions. Make sure copy doesn't preach flow-is-better; let the sliders decide.

## Stretch

- **Historical preset slider** — papermaking 18th century (high setup, batch wins big) → 19th century Fourdrinier (continuous, dominant) → reset to user-defined
- **Dollar-cost game mode** — given a demand pattern over a year, find the batch size that minimizes total cost (capital + setup + defects + missed sales). One number to optimize.
- **Connect to the Step-Removal Puzzle** — setup time is itself a candidate for step removal; a meta-link between the two labs is natural.
