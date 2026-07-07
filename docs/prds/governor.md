# The Governor

**Source:** *The Origins of Efficiency*, Ch 6 — Variability, Knowledge, and Control
**Status:** proposed
**Route:** `/governor` (suggested)

## Pitch

You are the stillman. A gasoline still runs in front of you: a burner knob on the left, a temperature gauge on the right, and a quality band painted on the gauge face. Keep the needle in the band and good gasoline flows into the tank. Run hot and the cut is contaminated — it drains to the slop tank for expensive rerunning. Run cold and gasoline stays in the still, unvaporized. The catch: the knob acts on the gauge with a lag, the process drifts, and the gauge jitters with noise that means nothing. Chase the needle by hand and you'll overcorrect your way into oscillation — *your corrections become the biggest source of variation in the process*. Then you bolt on a governor, tune one gain knob, and watch a dumb proportional loop beat your best shift. That flip — from skilled hands to feedback loop — is the chapter.

## Why this lab

Ch 6 gives three strategies for dealing with variation you can't design away: **eliminate** the source, **shield** the process from it, or **compensate** for it with a feedback control system. The Shewhart Sandbox already owns the "eliminate assignable causes" corner (and Red Beads owns the blame corner), but both come from the classics shelf — no lab covers the book's own Ch 6 material, and nothing in the whole project has a *closed loop*. Every existing lab is open-loop: set sliders, watch consequences. This one closes the loop and makes the player the controller first, so they feel why 75,000 flyball governors were running in England by 1868 and why Herbert Dow ranked automatic control with the steam engine.

It also teaches the chapter's sharpest counterintuitive point, the one Shewhart flagged: *trying to reduce variation beyond what the process is capable of only increases variation.* Reacting to chance-cause jitter through a lagged actuator amplifies it. The player will do this to themselves in the first ninety seconds, which is worth more than any paragraph about tampering.

The manual phase is genuinely fun in the way the Red Bead paddle is fun — a hand-skill game you slowly realize you cannot win with hand skill.

## Core mechanic

A single first-order thermal process, ticked at ~10 Hz, simple enough to unit-test as a pure function:

```
heat_in(t)   = burner position from `lag` ticks ago      // transport delay
temp(t+1)    = temp(t) + dt·( heat_in(t) − loss·(temp(t) − ambient(t)) ) + process_noise
reading(t)   = temp(t) + gauge_noise                      // what the player/controller sees
```

Disturbances move `ambient` and `loss` under the player: a cold snap, a fouled heat exchanger (slow drift), a change in feedstock (step change in where "in band" sits). Each tick the still produces one unit of *cut*, scored against the quality band:

- `reading` irrelevant — scoring uses **true** temp (the gauge can lie a little; that matters)
- in band → gallons of gasoline (revenue)
- above band → slop tank (rework cost, per the stillman's lament in the book)
- below band → under-vaporized (yield loss)
- fuel burned = integral of burner position (efficiency term, so "run it hot to be safe" loses)

**Control modes**, unlocked in order:

1. **Hands** — the player drags the burner knob. Human reaction time plus transport lag does the teaching.
2. **Governor (P)** — `burner = clamp(bias + gain·(setpoint − reading))`. One gain slider. Low gain lets drift through; high gain rings; the sweet spot is discoverable in seconds.
3. **Deadband** — a second slider: respond only when `|error| > deadband`. This is the Shewhart idea wearing a control-theory hat — don't react to noise, react to signal. Deadband 0 with high gain tampers; a sensible deadband quiets the loop.
4. **Reset (PI)** — optional integral term sold as "reset windup crank," fixes the standing offset that P leaves under sustained drift. Kept optional so the lab never requires control-theory vocabulary.

## Knobs

- **Burner knob** — the manual actuator; the whole game in mode 1
- **Gain** — the headline knob once the governor is on
- **Deadband** — the tampering lesson
- **Transport lag** — 0 to ~3 s; at 0 even hand control works, which is exactly the point
- **Gauge noise** — how much jitter the sensor adds; interacts with deadband
- **Disturbance schedule** — calm / weather / fouling / feedstock steps, or "dealer's choice" which rolls them randomly
- **Setpoint** — where in the band you aim; aiming high "for safety" burns fuel and risks slop

## What's on screen

- **The still** — a tall vessel with animated flame sized to burner position, a big analog gauge with the quality band painted on the dial, two output pipes: gasoline tank filling (good) and slop tank filling (bad). Slop should *hurt* visually.
- **Strip chart** — true temp and gauge reading over the last 60 s, band shaded, disturbances annotated when revealed. This is where oscillation becomes undeniable.
- **Control chart of the cut** — reuse `app/ui/control-chart.tsx`: per-batch quality points with limits computed from the calm process. Hand-mode tampering shows up here as limits blowing out, tying the lab back to the Shewhart Sandbox with the same visual language.
- **Shift ledger** — gallons shipped, gallons slopped, fuel burned, net dollars for the shift. One number to beat.
- **Mode switch** — HANDS / GOVERNOR, with gain, deadband, and reset controls that only appear once the governor is engaged.

## Interaction loop

1. **Calm shift, hands mode.** Process is stable; the winning move is to barely touch the knob. Most players fiddle anyway and watch the control chart widen — tampering, learned by doing.
2. **Cold snap.** Now the knob *must* move. Player chases the lagged gauge, overshoots, corrects, overshoots the other way. The strip chart shows a tidy sine wave of their own making. Ledger bleeds slop and fuel.
3. **Engage the governor.** Default gain is mediocre on purpose. Player tunes: too low and the cold snap walks the needle out of band; too high and the loop rings just like their hands did. There's a discoverable middle.
4. **Turn gauge noise up.** The well-tuned governor starts passing jitter into the flame. Deadband slider fixes it. The lesson lands: *a controller that reacts to everything is a tampering machine that never sleeps.*
5. **Fouling drift.** P-only leaves a standing offset; player either rides the bias by hand (a human doing the integral term — worth a drafting note) or engages reset.
6. **Dealer's choice shift.** Full disturbance schedule, governor tuned, hands off. The end screen compares best hand shift vs. governor shift on the same schedule: dollars, slop, fuel, and variance of the cut.

## Out of scope

- Derivative control and formal PID tuning (Ziegler–Nichols etc.) — the lab teaches *why feedback*, not how to be a controls engineer
- Multi-loop / cascade control, multiple interacting variables
- The eliminate/shield strategies as playable mechanics — they appear in copy (insulate the still, buy better feedstock) but building them as a budget-allocation round dilutes the closed-loop lesson; candidate for a follow-on lab
- Model-predictive anything

## Open questions

- **Framing: still vs. kiln vs. windmill.** The gasoline still has the best primary-source quote and a natural two-sided failure (slop vs. under-vaporized). The clay kiln (20% waste under manual control) and windmill tentering are cleaner mechanically but one-sided. Lean: still for v1, windmill as a stretch preset since the sim core is identical.
- **Should hands mode use pointer drag or discrete nudge buttons?** Drag is more fun but frame-rate and input-device dependent; nudge buttons make runs comparable across players and make the leaderboard honest. Lean: drag for feel, but score only governor shifts if a leaderboard ships.
- **How much control-theory vocabulary to surface?** The chapter says "measure, compare, adjust" and never says PID. Lean: the UI says GAIN, DEADBAND, RESET in blueprint-speak; the drafting note in the corner can name-drop proportional/integral for the curious.
- **Does true temp vs. gauge reading earn its complexity?** It enables the deadband lesson and the "gauge can lie" beat, but it's a second hidden variable. Lean: keep it, with gauge noise defaulting low so it only matters when the player raises it.

## Stretch

- **Watt governor animation** — the score dial rendered as a spinning flyball governor whose balls fly out as variance rises; pure decoration, maximum blueprint energy
- **Historical presets** — windmill tentering (Mead 1787, lag ≈ 0, wind gusts as disturbance), cement kiln 1950s (huge lag, the case where automatic control enabled kilns "far larger than had previously been thought possible")
- **Funnel experiment easter egg** — a toggle that replays Deming's funnel rules as burner policies and charts the resulting variance
- **Shift leaderboard** — reuse the Red Beads leaderboard pattern for best net-dollar governor shift on the fixed "dealer's choice" seed
