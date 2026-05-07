# Step-Removal Puzzle

**Source:** *The Origins of Efficiency*, Ch 5 — Removing a Step
**Status:** proposed
**Route:** `/step-removal` (suggested)

## Pitch

Twenty-three steps in a frozen-pea processing line. Two of them are value-adding. Find the other twenty-one and delete them. Cycle time and cost respond live; if you delete a load-bearing step, the line breaks.

## Why this lab

Pin Factory teaches *adding* stations to a line. This teaches *removing* them — the actual job of process improvement. The book's pea-processing example (23 → 16 steps, 222 ft → 190 ft of travel, $51 capex → $464/yr savings) is the canonical work-simplification case study, and it works as a puzzle because the user has to learn to recognize *categories* of waste (Toyota's seven), not memorize answers.

## Core mechanic

Each step on the line has:

- `id`, `name` (e.g., "operator walks to scale", "weigh 4 lb tray", "wait for elevator")
- `duration_s` — cycle-time contribution
- `cost_per_unit` — direct cost contribution
- `category` — one of `transform | move | wait | inspect | rework | setup`
- `dependencies` — IDs of steps that must remain for output to be valid

Only `transform` steps actually change the product. Everything else is candidate for removal — but some non-transform steps are still load-bearing (e.g., "weighing" enables a downstream "package to spec" transform).

The line state is valid iff all `transform` steps remain *and* all dependencies of remaining steps are present.

**Score** = baseline cycle time / current cycle time, minus a penalty for each invalid state attempted.

## Knobs / interaction

- **Click any step** to delete it. If it's load-bearing, downstream steps highlight red and the line shows a "broken" state until the user undoes.
- **Hover any step** to see its category, duration, cost, and what depends on it.
- **Undo / redo** stack.
- **Hint button** — reveals one piece of waste, costs score points.
- **Reset** to the original 23-step line.

## What's on screen

- **Conveyor diagram** — 23 stations in sequence, animated dots representing pea trays moving through. Travel distance shown as a literal line length above.
- **Per-station cards** under the conveyor. Each card is clickable / deletable. Color-coded by category (transform = green, everything else = a shade of grey).
- **Live counters:**
  - Steps remaining
  - Cycle time per tray
  - Travel distance (ft)
  - Cost per ton
  - "Value-adding ratio" — fraction of cycle time spent on transforms
- **Score panel** with current score, best score, hint count
- **Line status indicator** — "Producing" (green) / "Broken — missing dependency" (red)

## Interaction loop

1. User sees a 23-station line that's clearly absurd (peas weighed three times, multiple inspections, an elevator ride between two adjacent rooms).
2. User clicks the first obviously-redundant inspection. Cycle time drops. Score ticks up.
3. User clicks something load-bearing. Line breaks. They learn that "weighing" looks like waste but feeds the packager.
4. User keeps trimming until they can't get the line below ~16 steps without breaking it.
5. Ending screen: shows their final count, the book's count (16), and a breakdown of which categories they spotted vs. missed.

## Out of scope

- Adding new steps — this is removal-only. (A future "redesign" lab could add.)
- Multiple SKUs / changeover modeling
- Actual physics of pea processing — the durations and costs are calibrated to feel right, not to model real industrial peas.

## Open questions

- Should the puzzle have one canonical solution, or multiple valid optima? Probably multiple — work simplification is judgement, not a single-pass optimization. Show "best known" rather than "correct."
- Should we include the original Frank Gilbreth bricklaying example as a second level? It's compact and visually different. Worth considering as a follow-on level, not the v1.
- How explicit should the seven-wastes vocabulary be? The book doesn't lean hard on Toyota terminology. Lean toward not naming the categories until a post-game debrief screen.

## Stretch

- Multi-level: pea line → bricklaying → office paperwork (purely informational, same mechanic)
- Time-travel mode: replay a recorded optimization run as an animation, like a chess game review
- Leaderboard / shareable score (this might violate the existing "leaderboard means nothing" tone of the Red Bead lab — handle carefully)
