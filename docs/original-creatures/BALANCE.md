# Original roster: move balance pass (7 November 2026)

Scope: the default move loadouts and side effects of all 170 Original creatures (Lot 1 and Lot 2). Data only. `game/`, `engine.json` and the legacy Pokémon roster are unchanged.

## Problem

- 122 of 170 creatures could only melee/dash, 45 could only shoot, and 3 could do both. Role decided it: phys/bal/bulk were all close-range, spec/util all ranged.
- In 1v1 sims, a creature that shoots beat one that only melees 96% of the time (kiting is free: ranged moves work at point-blank, melee must close 8 tiles under fire). Fire, water and grass creatures often had no fire, water or grass ranged move.
- Burn or paralysis landed in 2.9% of battles (only Flame Bolt and Volt Bolt carried an effect, and `statusOf` treats a missing chance as 100%).

## What changed

`frontend/scripts/balance-original-movesets.cjs` (idempotent, run after `build-original-lot2.cjs`) rewrites loadouts from each creature's types and role:

| Role | Default loadout |
|---|---|
| phys | melee, dash, ranged area, buff |
| bulk | melee, ranged area, dash, shield |
| spec | projectile, area, dash ("quick step"), shield |
| util | area, projectile, dash, shield |
| bal, fast / speed | melee, projectile, dash, area (all four slots damaging) |

- Every creature has an own-type ranged move and a close move; dual types use both types.
- Lot 2 gets 18 new `<element>-shot` / `<element>-bloom` moves (IDs 200101+, one projectile and one area per type it uses), and keeps its designed melee/dash moves. Both status moves stay in each learnset.
- Effects: burn on fire moves (20%), paralysis on electric (20%), ice, poison and ghost (15%). Every effect move has an explicit chance. Only burn and paralysis exist in the engine, so poison and ice borrow paralysis.
- Calibration: projectile accuracy 85 to 80, area 95 to 75, melee/dash 100. Accuracy is the only lever that cuts ranged DPS, because cooldown scales with power and DPS per move is flat.
- bal and fast keep four damaging slots because they were far behind (about 30% win rate). Speed buys little in this engine.

`frontend/scripts/set-original-opening-order.cjs` puts the grass (Reedlet), fire (Cindcub) and water (Rivpup) lines at #1-#9 in Variety order, and `dexNo` has them at #1-#9 too. The old first family (Mossplod, water) moved to #151-#153.

## Result (4,066 seeded 1v1 battles, same sample before and after)

| | Before | After |
|---|---|---|
| Creatures with both ranged and close damage | 3 | 170 |
| Kiter-style vs brawler-style win rate | 94% / 6% | 49% / 51% |
| Per-creature win-rate spread (sd) | 25.4 pts | 13.9 pts |
| Creatures under 30% / over 70% | 49 / 42 | 15 / 14 |
| Median fight length | 30.5 s | 30.4 s |
| Battles with a burn or paralysis | 2.9% | 39.2% |
| Battles where a buff fired / a shield fired | 38% / 14% | 46% / 65% |

Reproduce with `frontend/scripts/balance-sim.harness.js` and `balance-sim-summary.cjs` (instructions in the harness header).

## Known limits and follow-ups

- Sims are 1v1 on Pitch with abilities off, opponents within 12% BST. They are not 6v6 games, and rival AI archetypes were not simulated.
- Remaining skews: fire, dragon, ghost and steel win about 60-64%; grass, bug, flying and normal about 41-44%. Lot 2's `speed` role (about 36%) and `defense` (65%) follow its hand-set stats.
- Buffs are cast by the AI only at full HP when nothing is in range (`game/ai.js`), so they mostly fire once before contact. A fix belongs in the AI and would change legacy battles, so it was not made here.
- The Lot 1 verifier (`scripts/verify_original_roster.mjs`) only reads Lot 1, so its "grass 13 vs target 17" warning predates this pass.
