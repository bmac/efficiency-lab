# The Cheapest Ton

**Source:** *The Origins of Efficiency*, Ch 3 — Reducing Input Costs
**Status:** proposed
**Route:** `/cheapest-ton` (suggested)

## Pitch

It's 1885 and you run a steelworks with two furnaces: an acid Bessemer converter and an open-hearth furnace. Neither one is "better." The Bessemer is fast and burns no fuel, but it's picky about ore, can barely take scrap, and its steel carries nitrogen impurities that quality buyers reject. The open hearth is slow and hungry for coal, but it eats cheap scrap and makes cleaner steel. Every year an order book arrives — rails, wire rod, axles, bridge plate — and you bid against a rival mill. You pick the furnace, the ore, the scrap charge, and the fuel for each contract, and you find out immediately whether your ton was cheaper than theirs. Then the ground moves: scrap gets cheaper, quality specs get stricter, coal strikes hit, and the recipe that won last year starts losing. The cheapest ton is a moving target — the lab makes chasing it the game.

## Why this lab

Bessemer Cost Collapse (Ch 2) teaches *when to adopt*. It's one decision followed by sixty years of watching, and the sim's own economics guarantee everyone bleeds at the end — a fair depiction of adoption inertia, but a weak game. Ch 3 is about a different, more interesting problem: given a palette of processes, *the cheapest bundle of inputs is a search problem that never finishes*. The book's own centerpiece example is Bessemer vs. open hearth — faster and fuel-free vs. flexible and cleaner, with the winner decided by scrap availability, ore prices, and what the steel would be used for. That's a decision with no dominant strategy, which is exactly what a lab wants: something to re-decide every round, a reason the player can lose while doing something locally sensible, and feedback within seconds instead of decades.

Three chapter ideas carry the design:

1. **Trade-offs and coupling** — cost can't be minimized item by item. The cheapest ore ruins the acid Bessemer's heats; skipping an "unnecessary" expense raises total cost downstream.
2. **Increasing the value of outputs** — slag and waste gas are disposal costs until capex turns them into revenue (slag cement, Cowper stoves, gas engines). By-product plays only pay at volume.
3. **A dynamic landscape** — the lowest-cost method today isn't the lowest-cost method tomorrow. Historically, open hearth overtook Bessemer as scrap got cheap and structural buyers wrote Bessemer steel out of their specs. The player should feel that flip happen under their feet.

## Core mechanic

**Time axis:** 1885 → 1900, one round per year, 16 rounds, each ~30 seconds of decision. A full run is a five-minute session, replayable.

**Each round:**

1. **Order book deals 4–6 contract cards.** Each has tonnage, price/ton, and a quality spec:

   | Contract | Volume | Price | Quality spec | Notes |
   |---|---|---|---|---|
   | Rails | high | low | loose | Bessemer's home turf |
   | Wire rod | medium | low–medium | loose | cheap steel made wire nails possible |
   | Axles & forgings | low | high | tight | nitrogen-sensitive; Bessemer steel often rejected |
   | Bridge plate | medium | high | tight + inspection | failed inspection = penalty and reputation hit |

2. **Player builds a recipe per bid:** furnace (Bessemer / open hearth), ore (low-P premium / high-P cheap), scrap fraction (Bessemer caps at ~10%, open hearth up to ~50%), fuel purchase (open hearth only). The recipe implies a cost/ton and a quality distribution, both shown live as the player adjusts.

3. **Sealed-bid against the rival.** "Pittsburgh Consolidated" bids each contract at its own cost plus a fixed markup. Lowest bid that meets spec wins. The player sees the rival's winning bid after the fact — so a loss always teaches ("they made rails at $21; your Bessemer charge cost $24 because you bought premium ore you didn't need").

4. **Input prices move.** Scrap trends downward over the sixteen years (old iron rails flooding the market) with yearly noise; ore and coal random-walk; events spike them (1893 panic craters demand, a coal strike doubles fuel for two rounds, and mid-game the railroads' engineering societies begin writing "open-hearth steel only" into bridge specs — which really happened).

**Capex cards** (one-time purchases, amortized over remaining rounds):

- **Cowper stoves** — cut open-hearth fuel use ~30%
- **Slag cement kiln** — slag disposal fee becomes slag revenue, but only nets out above a tonnage threshold
- **Gas engine house** — waste gas becomes free power, small cost/ton reduction on everything
- **Basic lining (Thomas-Gilchrist)** — lets either furnace take cheap high-P ore safely

Each is a coupling lesson in miniature: whether it pays depends on the volume and recipe choices around it, not on the card itself.

**Score:** cumulative profit, plus a per-contract "cheapest ton" tally (rounds where your winning cost/ton beat the rival's). Losing a bid costs nothing directly — idle furnace capacity is the cost.

## What's on screen

- **Order book** — the round's contract cards, with spec badges. Won cards stamp "ROLLED & DELIVERED"; lost cards show the rival's winning price.
- **Two furnace panels** — the pear converter and the long shallow hearth, visibly busy or idle. Recipe controls live on the panel: ore selector, scrap slider, fuel buy.
- **Live recipe readout** — cost/ton and predicted defect risk update as the player drags the scrap slider or swaps ore. This is the core toy; it should feel like tuning a machine.
- **Market strip** — sparklines for scrap, ore, and coal prices. The scrap line's long slide is the story of the period.
- **Rival ticker** — one line per round: what Pittsburgh Consolidated bid, won, and roughly how ("heavy scrap charge, open hearth"). The rival adapts to prices, so watching them is a legitimate strategy.
- **End screen** — cost/ton by contract type, you vs. rival, over all sixteen years; overlaid with the real US data (Bessemer output peaking ~1890s, open hearth overtaking it by ~1908). "Your cheapest ton in 1885 was a Bessemer rail ton. Your cheapest ton in 1900 was an open-hearth scrap ton. Nothing about your mill changed — the landscape did."

## Interaction loop

1. Round 1: rails are plentiful, scrap is dear. Bessemer + low-P ore wins easily. Player learns the recipe controls.
2. Round 3: player tries cheap high-P ore in the acid Bessemer to shave $2/ton. Defect risk spikes, bridge plate fails inspection. First coupling lesson: the cheap input wasn't cheap.
3. Round 5–7: scrap price slides below pig iron. The rival's open-hearth bids start winning rails — *rails*, Bessemer's home turf. Player either notices the market strip or loses three bids in a row.
4. Round 8: the 1893 panic guts the order book. Fixed costs bite. Capex bought at the peak hurts; capex bought in the trough is cheap. (The book's Chrysler-in-the-Depression lesson, in miniature.)
5. Round 10: bridge specs go open-hearth-only. The Bessemer converter is now a rails-and-wire machine. Players who bought the slag kiln and gas engines can still make it the cheapest rails-and-wire machine in the region.
6. Round 16: end screen. Multiple builds win — OH generalist, Bessemer volume specialist with by-product capture, basic-lining cheap-ore play — but "set one recipe in 1885 and never touch it" loses every time. That is the chapter's thesis.

## Out of scope

- Adoption timing — that's Bessemer Cost Collapse's lesson; here both furnaces exist from round 1
- Bankruptcy / cash-flow death spirals — losing here means losing bids, not watching a mandatory bleed-out; the sim should stay winnable and re-runnable
- Vertical integration and make-vs-buy (the chapter's other half) — big enough to be its own lab
- Labor, location, transport costs — folded into the cost constants
- Steel chemistry beyond phosphorus and nitrogen-as-quality-penalty

## Open questions

- Sealed-bid vs. posted-price: sealed bids give the "beaten by $0.80/ton" sting that makes losses informative, but posted prices are simpler to read. Lean sealed-bid with full reveal after each round.
- Should the rival be fallible? A rival that occasionally misreads the market (overpays for ore, late to scrap) makes wins feel earned rather than impossible. Lean yes, with a fixed seed per run so runs are comparable.
- How heavy should the quality model be? A full distribution is overkill; a per-recipe "reject risk %" with a dice roll at delivery is probably enough, and the roll gives rounds a moment of tension.
- Does 16 rounds × 4 bids overwhelm? If playtests drag, cut to 12 rounds or auto-carry recipes forward so the player only touches what they want to change ("standing orders" — itself a real mill practice).

## Stretch

- **Epilogue rounds (1950–1975)** — the chapter's coda: basic oxygen arrives and kills the open hearth in twenty years, then electric arc + cheap scrap kills basic oxygen's margin. Three bonus rounds where the player's hard-won OH instincts betray them. Same lesson, one octave higher.
- **Recipe replay** — after the run, scrub through your sixteen recipes as a timeline and watch cost/ton respond, chess-review style (shared mechanic with Step-Removal's time-travel mode).
- **By-product economy expansion** — coal tar → dyes, gasoline-from-kerosene-waste as alternate skins; the "waste becomes the product" Leblanc story could be its own micro-lab.
- **Cross-lab hook** — the scrap price series this lab generates is exactly what a future mini-mill/electric-arc lab needs as an input.
