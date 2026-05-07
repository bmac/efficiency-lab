# Bessemer Cost Collapse

**Source:** *The Origins of Efficiency*, Ch 2 — New Processes
**Status:** proposed
**Route:** `/bessemer` (suggested)

## Pitch

Steel rails cost ~$170/ton in 1867. By 1898 they cost ~$32/ton — an 80% real-terms collapse in thirty years. The cause was a sequence of new processes (Bessemer 1856, Siemens-Martin open hearth 1865, Thomas-Gilchrist basic lining 1879) replacing a much older one (puddling). You run a steel mill from 1850 to 1910. Each new process arrives with a capex bill, a quality risk, and a constraint on which ores it can handle. Adopt early and you bet the company on a process that hasn't worked at scale yet. Adopt late and your competitors eat your rail demand. The lab makes the timing decision the lesson.

## Why this lab

Ch 2 is about how new processes displace old ones, and why the displacement looks slow until suddenly it isn't. Bessemer is the canonical case — it's the cost decline every other chapter implicitly references. The Lab needs an "adoption-under-uncertainty" mechanic to round out the set: existing labs all assume the technology is given. Bessemer Cost Collapse asks the harder question: *when do you switch?*

## Core mechanic

**Time axis:** 1850 → 1910, in yearly ticks. Demand for steel rails grows ~10×/decade (driven by railroad expansion, exogenous to the player). Demand for steel tools, structural steel, and ship plate grow more slowly.

**Available processes**, each with a year of historical availability and distinct profile:

| Process | Available | Cost/ton (mid-life) | Throughput | Quality | Ore constraint |
|---|---|---|---|---|---|
| Cementation | 1850 | very high | tiny | high | iron + carburization |
| Crucible | 1850 | very high | small | very high | low-S |
| Puddling | 1850 | high | moderate | medium | any |
| Bessemer (acid) | 1856 | low (after teething) | high | medium | **low-phosphorus only** |
| Open hearth (Siemens-Martin) | 1865 | low–medium | medium | high (better than Bessemer) | flexible, can use scrap |
| Bessemer + Thomas-Gilchrist (basic) | 1879 | low | high | medium | **handles high-P ores** |
| Basic open hearth | 1880s | medium | medium | high | very flexible |

Each process has a *teething period* after its availability date (3–6 years) during which `cost/ton` is 50–100% higher than its mid-life value and `defect_rate` is high. Adopters before the teething period ends pay tuition. Adopters after pay catch-up — by then the early adopters have descended their learning curve and built scale.

**Per-year sim:**

```
revenue   = ships_completed × (rail_price | tool_price | plate_price)
cost      = production × cost_per_ton(process, year_since_adoption)
defects   = production × defect_rate(process, year_since_adoption)
penalty   = defects × penalty_per_ton (return shipments, broken rails — a real Bessemer issue early on)
profit_y  = revenue − cost − penalty − capex_amortized
```

Market price falls over time as adoption spreads in the simulated industry (an exogenous decline curve calibrated to historical rail prices). A mill stuck on puddling sees its margin compress every year; eventually revenue ≤ cost and it bleeds.

## Knobs

- **Process** — pick one; switching mid-game costs capex and a 1–2-year retooling stoppage
- **Ore source** — domestic low-P (US Lake Superior — Bessemer-compatible) / domestic high-P (most European, US Pennsylvania — needs basic process or Open Hearth) / mixed
- **Scale** — small mill (5k tons/yr) / regional (50k) / Carnegie-scale (500k+)
- **Year you adopt** — the headline knob. Adopt Bessemer in 1857 (year after invention) or 1875 (after every kink is worked out)?
- **Capital posture** — conservative (limited capex, slow scaling) / aggressive (Carnegie-style: relentless capex, scrap and rebuild equipment that is still profitable)

## What's on screen

- **Year ticker** 1850 → 1910, with a play/pause control. Major historical events fire as ticker reaches them: Bessemer's 1856 patent, the 1873 panic, Thomas-Gilchrist 1879, the 1890s rail boom.
- **Mill diagram** — animated SVG of the chosen process. Visibly different per process: a puddling furnace (single hearth, single puddler stirring), a Bessemer converter (the iconic pear-shaped vessel tilting and showering sparks), an open hearth (long shallow furnace).
- **Two charts:**
  - Steel price/ton over time, with **market price** (exogenous, falling) and **your cost/ton** (depends on your process and year-since-adoption) plotted together. The gap is your margin per ton.
  - Cumulative profit, with bankruptcy threshold drawn as a red line.
- **Process panel** — cards for each process. Locked until historical availability date. Hover shows expected cost, ore constraint, teething period.
- **Ore-compatibility warning** — fires if the user adopts Bessemer (acid) on a high-P ore source. Output is brittle, defect rate spikes, penalty cost crushes margin. A real historical issue — Bessemer's first commercial run failed because of exactly this.
- **Competitor strip** — three named ghost mills (Crucible Co., Bessemer Pioneer, Carnegie-style) running their own preset strategies. Their cost curves are visible. The user is implicitly racing them.

## Interaction loop

1. User starts in 1850 with puddling. Profitable but boring. Demand for rails is small.
2. 1856: Bessemer card unlocks. User can adopt now (early — high teething cost, no proven scale-up) or wait.
3. If user adopts immediately: 1857-1860 are painful. Costs are higher than puddling because of teething. Some users bail back to puddling.
4. If user waited until 1865: lower teething cost, but Bessemer Pioneer ghost has already descended its curve and is selling rails below your cost.
5. 1873 panic fires. Cash matters. Mills that overcommitted on capex during the boom are vulnerable.
6. 1879: Thomas-Gilchrist available. Mills on high-P ore can finally adopt the basic process.
7. By 1900, puddling-only mills are bankrupt. Bessemer mills are profitable but pressured by Open Hearth on quality. Carnegie-style aggressive scalers dominate volume markets.
8. End of run: cumulative profit, market share, list of decisions and what each cost or earned.

The game is winnable from multiple paths — early Bessemer adoption with good ore, late Open Hearth adoption with quality positioning, even staying on puddling if you exit the rail market and serve specialty demand. But staying on puddling *and* serving rails loses every time, which is the historical lesson.

## Out of scope

- Iron-ore mining economics — ore sources are a knob, not a sub-game
- Coal/coke supply — implicit in cost/ton
- Trade and tariffs — US/UK/German rivalry was real but a distraction here
- Labor relations — Homestead and similar events were significant historically; mention in copy, don't simulate
- Steel chemistry detail beyond the phosphorus constraint — keep the knob set tight

## Open questions

- How much should the lab penalize the obvious "wait until 1885 and adopt mature basic Open Hearth" play? Historically that was actually a good play for some mills. The lab should let it work but not dominate — competitors who scaled on Bessemer in 1870-1885 had a head start that's hard to overcome on cumulative volume even with a better process.
- Should ore source be a binary (low-P vs high-P) or a continuous P content slider? Lean binary — the historical decision was binary in practice.
- Tone: the chapter is about *new processes*, plural. Should the lab include the nail-manufacturing transition (hand-forged → cut nails → wire nails) as a second preset? It's a cleaner story but less consequential. Lean: stick to steel for v1, add a "nail mill" preset as a stretch since it shares the same engine.
- The competitor ghosts add pressure but also clutter. Maybe make them a toggle.

## Stretch

- **Nail-mill preset** — same engine, different processes (hand-forged / cut / wire) and a different demand curve (1810–1900). Demonstrates the same dynamic in a different industry.
- **Andrew Carnegie historical-replay mode** — preset that mimics his actual capex and scrap-and-rebuild cadence at Edgar Thomson Works. User watches the playbook and the cost curve.
- **Connection to Blast Furnace Lab** — Bessemer needs cheap pig iron to work. A future combined lab could couple a blast furnace's output cost to this lab's input cost.
- **Connection to Wright's Law / Disruption Labs** — every process adoption is a disruption that resets some cumulative experience. Players who adopt aggressively could trip the experience-reset trap. Cross-lab mechanic if the engines unify later.
