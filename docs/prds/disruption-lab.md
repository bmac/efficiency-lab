# Disruption Lab

**Source:** *The Origins of Efficiency*, Ch 7 — Learning Curves (and the costs of resetting them)
**Status:** proposed
**Route:** `/disruption` (suggested)
**Related:** `wrights-law-lab.md` — this lab is the antagonist to that one

## Pitch

Wright's Law says every doubling of cumulative output cuts unit cost by a fixed percentage — *as long as the process holds still*. Real factories don't hold still. Designs change, suppliers swap, plants move, workforces turn over. Each disruption preserves some fraction of accumulated tacit knowledge and discards the rest. This lab makes you the operator deciding which improvements are worth the experience reset.

## Why this lab

The Wright's Law Lab teaches the curve. This lab teaches that the curve is brittle. The book is explicit that learning is *cumulative experience-driven*, not just calendar time, and that organizations routinely under-estimate how much accumulated know-how lives in habits, jigs, undocumented adjustments, and people. Disruption Lab puts a number on it.

The pedagogical point: improvement and learning are partly in tension. Always-improving organizations sometimes underperform organizations that hold still long enough to fully descend their learning curve.

## Core mechanic

Track **cumulative effective experience** `N_eff` separately from raw units produced `N_total`. Unit cost follows Wright's Law on `N_eff`:

```
C(t) = C(1) × N_eff(t)^b
```

When a disruption hits at time `t`, with reset fraction `r ∈ [0, 1]` and one-shot benefit `δ`:

```
N_eff      ← N_eff × (1 − r) + ε     (ε is a small floor representing residual general manufacturing know-how)
C(1)       ← C(1) × (1 − δ)          (the disruption did make the next unit cheaper if it had any benefit)
```

The unit cost trace shows a sawtooth: each disruption causes a jump up (because `N_eff` shrinks), partially offset by a step down from `δ`. Whether the disruption was worth it depends on whether the user descends the post-disruption curve far enough before the next disruption.

## Knobs

User-triggered improvements (each costs budget, has cooldown):

| Improvement | One-shot benefit `δ` | Experience reset `r` | Notes |
|---|---|---|---|
| Tooling tweak | 3% | 5% | Cheap, low risk |
| Supplier swap | 5% | 10% | Quality variance for a few periods |
| Process redesign | 12% | 35% | Big bet |
| Plant relocation | 18% | 70% | Two quarters offline |
| Workforce restructure | 8% (labor cost) | 40% | Loses tacit knowledge fastest |

External / non-optional disruptions fired by event log:

- Recession: demand cut → lower production rate, slower experience accumulation
- Supply shock: forced supplier swap, no `δ` benefit
- Pandemic: workforce restructure with no `δ` benefit
- Regulatory change: forced design rev with no `δ` benefit

These exist to keep the user honest — even a "hold still" strategy gets bumped sometimes.

## What's on screen

- **Cost-vs-cumulative-output chart** — log-log and linear-linear. Sawtooth pattern of disruptions visible as small/large jumps.
- **Two experience meters:**
  - `N_total` — units produced (monotonic)
  - `N_eff` — effective experience (drops on disruption)
- **Improvement panel** — buttons for the user-triggered improvements with budget, cooldown, expected `δ` and `r` shown in each tooltip
- **Event log** — chronological list of every disruption (user and external) with timestamp, type, and resulting cost step
- **Score** — total units produced × (final unit cost vs. a "no-change baseline" reference run shown as a dashed line)

The reference baseline runs invisibly behind the user's run with the same external disruptions but no user-triggered improvements. Final score is whether the user beat or trailed the do-nothing baseline.

## Interaction loop

1. User starts a 10-year run with a moderate learning rate (say 0.85).
2. After a few quarters of descent, a "Tooling tweak" looks free — small `r`, decent `δ`. User takes it. Cost ticks down. Experience barely moves. Good trade.
3. Mid-run, "Process redesign" tempts the user with 12% off — but `r=0.35` undoes years of descent. User accepts. Cost jumps. Whether the redesign pays back depends on how many units they produce before the next disruption.
4. External shock hits (pandemic). 40% experience reset, no benefit. User can either hold still and re-descend, or pile a "Workforce restructure" on top to chase short-term cost.
5. End of run, debrief: total cost vs. baseline, count of disruptions, biggest single experience reset, longest stable stretch.

The ending lesson varies by run. Sometimes "always improve" wins. Often "improve sparingly" wins. "Never improve" usually loses to external shocks alone. The lab doesn't argue for any one strategy — it makes the trade-off explicit and replayable.

## Out of scope

- Multi-product portfolios (one product per run)
- Demand modeling beyond exogenous production rate
- Specific industry calibration — values are illustrative, not "the actual coefficient for X industry"
- Distinguishing between *types* of tacit knowledge (process, equipment, supplier, workforce) — they're collapsed into one `N_eff`

A future lab could split those out; here, the point is that disruption resets *some* share of *something*.

## Open questions

- Should the user see `r` and `δ` for each improvement up front, or learn them by experience? Up front is more game-able. Hidden is more realistic — real managers don't know how much experience a redesign will cost. → Lean toward showing a *range* (e.g., "5–15% benefit, 25–45% reset") with the actual values rolled at trigger time.
- How aggressive should external disruptions be? If too frequent, holding still is impossible and the lab becomes pure damage control. If too rare, the user can run a no-change strategy unrealistically well. Calibrate so a "no-improvement" run still drifts upward in unit cost over time due to external resets.
- Should there be a *good* disruption — a `r=0` improvement (e.g., better lighting, training that doesn't reorganize)? Probably yes, rare and small, to teach that not all change resets.

## Stretch

- **Compare mode** — run two strategies side by side on the same external disruption seed. "Aggressive improver" vs. "Conservative steward." Watch their cost curves diverge.
- **Famous-failure presets** — companies that improved themselves out of their own learning curve (the book has examples; pick one or two with named knobs).
- **Hybrid with Wright's Law Lab:** offer this as a "hard mode" toggle on the existing Wright's Law Lab rather than a fully separate page. Single codebase, two framings. Decide based on whether the disruption mechanic feels like an add-on or a different lesson — leaning separate, because the *point* is different.
