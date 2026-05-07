# Wright's Law Lab

**Source:** *The Origins of Efficiency*, Ch 7 — Learning Curves
**Status:** proposed
**Route:** `/wrights-law` (suggested)

## Pitch

Theodore Wright, 1936: every doubling of cumulative airframe output cut labor hours by a fixed percentage. Solar PV held the same shape from 1975 to 2021, falling from $100/W to $0.26/W. Pick a learning rate, run a production ramp, watch the curve refuse to flatten.

## Why this lab

The existing labs all live in a single time-step world (one round, one shift, one pass through a five-station line). The Lab has no pure *time / cumulative-experience* axis yet. Wright's Law is the cleanest one-knob simulation in the book and the framing that connects most of the other chapters (scale, step-removal, input cost — they all show up *as* movements on a learning curve).

## Core mechanic

Wright's Law:

```
C(N) = C(1) × N^b
where b = log₂(learning_rate)
```

`learning_rate` is the cost ratio after each doubling of cumulative output. 0.85 means unit N=2 costs 85% of unit N=1; unit N=4 costs 85% of unit N=2; etc. Industry observed values cluster between 0.70 (semiconductors, solar) and 0.95 (mature commodities).

On a log-log plot, this is a straight line. That's the punchline of the lab.

## Knobs

- **Learning rate** — slider, 0.70 to 0.95, default 0.85
- **First-unit cost** — number input, default $100
- **Production rate** — units per period, default 100/yr
- **One-shot interventions** (buttons that step the curve down):
  - "Process redesign" — instant 15% cost cut, then resume on the same learning rate
  - "Scale up plant" — doubles production rate, no immediate cost change
  - "Cheaper input" — instant 8% cost cut

Each intervention has a cooldown / budget so the user can't just spam them.

## What's on screen

- **Two charts side by side:**
  - Log-log: unit cost vs. cumulative output. The straight line.
  - Linear-linear: same data. The "asymptote" illusion that fools every business plan.
- **Counters:** cumulative units, current unit cost, total cost-to-date, time elapsed
- **Historical overlays** (toggleable, dimmed series on both charts):
  - Solar PV cells, 1975–2021 (~80% learning rate)
  - Ford Model T price, 1909–1923 (~85%)
  - DRAM cost per bit, 1971–2010 (~70%)
- **Run / pause / reset** controls

## Interaction loop

1. User picks a learning rate and starts the ramp.
2. Curve animates as cumulative production grows.
3. User triggers interventions; curve steps down or accelerates.
4. After a long enough run, the linear chart starts looking like an asymptote — but the log-log chart shows the line is still falling at the same slope. That's the lesson.

## Out of scope

- Multi-product portfolios (one product per session)
- Demand modeling — production rate is exogenous, set by the user
- Diminishing returns / floor cost — the book is clear that *empirically* the line just keeps going; we don't model a fundamental floor

## Open questions

- Should interventions be free, budgeted, or priced? Probably budgeted (a small "R&D spend" pool) to force trade-offs.
- Is one preset scenario ("Recreate the solar curve") worth shipping alongside the sandbox?
- Should the lab hint at why this works (input substitution, scale, step removal — i.e., the rest of the book), or stay agnostic and let it be one knob?

## Stretch

- "Forecast" overlay where the user predicts the cost at unit N=10,000 before running. Almost everyone underestimates, badly.
- Side-by-side compare two learning rates (0.85 vs 0.90) — a 5-point difference is not 5% more expensive at scale, it's 2× more expensive.
