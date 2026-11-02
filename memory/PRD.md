# Arena Dex — PRD

## Original problem statement
Mobile-first web game: real-time 1v1 arena auto-battler using real Pokémon data from PokeAPI (Gen 1–4, species 1–493). 6-creature roster, hidden NPC teams, 4 terrains (Pitch, Shoreline, Cavern, Snowfield), trainer archetypes, six-trainer gauntlet, device-local progression (evolution + legendary unlocks).

Constraints
- FRONTEND ONLY (React). `/app/backend` scaffold is intentionally unused — no server code, no DB.
- Persistence: localStorage (save file `arenadex.save.v1`) + IndexedDB (`arenadex-cache` / store `creatures`, 30-day TTL, schema v2).
- No bundled franchise assets; everything (data + sprites) fetched from PokeAPI at runtime.
- Strict 3 phases — stop & report after each.
- User choices: baby forms AND their immediate next forms are starters; progressive first-load (loading bar, cards render as they arrive); design delegated to design agent (`/app/design_guidelines.json`).

## Architecture (frontend)
- `src/lib/pokeapi.js` – fetch w/ retry, `normalizeCreature` (Gen IV typings via `past_types`), `flattenChain`, level-up moves (platinum → hgss → dp fallback)
- `src/lib/dex.js` – `loadCachedCreatures`, `fetchCreatures` (10 workers, memoized chains), `clearCreatureCache`, `SCHEMA_VERSION`
- `src/lib/idb.js` – tiny IndexedDB wrapper
- `src/lib/save.js` – save file default/load/persist/clear (`TEAM_SIZE = 6`)
- `src/lib/unlocks.js` – `computeStarterIds`, `isSealed`, `lockReason`
- `src/lib/types.js`, `terrains.js`, `format.js`
- `src/context/GameContext.jsx` – creatures map, progress {status: idle|cache|fetching|done|error, failed[]}, save, unlockedIds, toggleTeam/clearTeam/setTerrain/resetSave/retryFailed/resyncDex
- Pages: `RosterPage` (/), `TerrainPage` (/arena), `SavePage` (/save); shell `AppShell` (header + sync chip + LoadingBar + bottom nav)
- Components: CreatureCard (tap = select, long-press 450ms / info btn = details), TeamTray, CreatureDetailSheet, EvolutionLine, StatBar, TypeBadge, SpriteImg, RosterFilters, TerrainCard
- Test IDs: `src/constants/testIds/dex.js`

## Save file schema (v1)
`{ version, createdAt, updatedAt, totalWins, totalBattles, unlocked[], team[], terrain, speciesWins{}, gauntlet{runs, clears, bestStage} }`

## Creature record (IDB schema 2)
`{ id, name, displayName, genus, types[], stats{hp,atk,def,spa,spd,spe}, bst, height, weight, sprite, artwork, moves[{id,name,level}], generation, isBaby, isLegendary, isMythical, captureRate, chainId, evolvesFrom, evolvesTo[], schema, cachedAt }`

## Implemented
### Phase 1 — DONE (2026-06) — tested via testing_agent (iteration_1, 93% → all issues fixed & re-verified)
- PokeAPI data layer + IndexedDB cache + progressive loading bar + retry on failures + re-sync
- Roster grid (493), search / gen / type / unlocked filters, locked silhouettes, sealed legendaries
- Team select (6), bottom tray, detail sheet (stats, evolution line, moves), long-press
- Terrain picker (4) with effect blurb, Start Battle stub (toast: Phase 2)
- Save page: stats, loadout, Dex cache info, reset w/ confirm
- Unlock rule: base-stage non-sealed = starter; baby base → next form also starter (232 unlocked, 35 sealed)

### Phase 2 — BUILT, verification outputs delivered (2026-06) — awaiting user acceptance
- Deterministic 60 Hz engine (`/src/game/*`), config-driven (`/src/game/config/*.json`), seeded RNG, canvas renderer, gifuct-js animated sprites cached in IDB
- HUD, Switch strip (manual + forced pick), pause/1x/2x/4x, AUTO pick, result screen, rematch
- Harness on `window.__*` (`/src/game/tests/harness.js`): smokeTest, pacingTest, archetypeTest, traceTest, dodgeTest, multiplierChecks, terrainChecks, switchCheck, moveMappingDump, spriteCheck, wallCheck, logDump, fpsSample
- Fixes this session: forced-pick deadlock (inputs now processed while paused), rematch double-start (startedRef), unit pushed into walls by unit-unit collision (now wall-aware), AI projectile line-of-sight, dodge/dash bursts accelerate (0.15 s) so a 0.1 s dodge is too late, canvas laid out between HUD cards (nothing hidden), translucent controls
- Tuning: DAMAGE_SCALE 0.12, cooldown min 1.5 s / max 6 s / status 8 s → pacing median 27.5 s (50 seeded 1v1s)
- Tested: testing_agent iteration_2 (faint-pick fix verified) + iteration_3 (rematch fix, switch, pause/speed, layout, result screen — all pass)

### Phase 3 — DONE (2026-06) — tested via testing_agent iteration_4 (95%) + iteration_5 (100%) after fixes
- `src/lib/progression.js`: species-win credit, evolution thresholds (3 / 5), Seal Keys (1 per 10 wins), `creditBattle`
- `src/lib/gauntlet.js` + `pages/GauntletPage.jsx` + `/battle?mode=gauntlet`: 6-trainer run, HP/faint carry-over via `initialHp`, stage badge, Next trainer / run over flows, abandon
- `src/lib/replay.js` + `/replay#code`: deterministic replay links (teams, movesets, inputs incl. auto-pick toggles), read-only HUD, Share button (navigator.share → clipboard)
- `components/SaveTransfer.jsx`: export/import JSON with validation + confirm; `components/UnlockPanel.jsx`: progress bar / Seal Key spend in detail sheet
- Engine: `state.inputLog`, `replayInputs` injection in `processInputs`, `auto` input type, auto-pick resolves a pending pick immediately; TeamStrip has an "Auto pick" button during forced picks
- Harness: `__progressionTest`, `__replayTest(seed)`

### Task A — KO/standing bonus credit — DONE (2026-06) — Jest 9/9 + testing_agent iteration_6 (all pass)
- `progression.js`: `KO_BONUS`/`STANDING_BONUS`, `battleBonuses(state)`, `speciesCredit()`, idempotent `creditBattle` (`lastCreditedBattle`); save fields `speciesKoCredit`, `speciesStandingCredit`
- Engine (mechanics-neutral): `unit.lastHitIndirect`, `unit.entries`, `state.battleId`; ResultScreen `CreditBreakdown`; CreatureDetailSheet `SpeciesRecord`; Jest config in craco (`src/lib/__tests__/credit.test.js`)

### Task B — Archetype move visuals — DONE (2026-06) — testing_agent iteration_6 (all pass), same-seed log hash unchanged (18d26607 / c96842ec)
- `config/moveVisuals.json` + `render/moveVisuals.js` (resolver, coverage) + `render/archetypeFx.js` (drawers); renderer: `onCast/onDetonate/onSwing/playImpact/onProjectileEnd/onSelfMove`, reduced-motion path, screen shake, `effectCount()`
- Coverage: 467 moves, 265 damaging, fallback 18/265 = 6.8%; harness `__visualCoverage()`, `__fxCount()`; `__pauseOnEvent.move` filter
- Fixed: `pushEvent` projectile id collision (projectile events were skipped by the renderer); result screen now scrolls from the top on 360×780

### Next (approved by user, not started): Task C — Rival Level slider
- Arena page slider L1–6 (saved, quick battles only). Self power = avg team BST + 2×totalWins (cap +150). Rival budget = self power × [0.8,0.9,1.0,1.1,1.2,1.3]; archetype scoring kept but draft within ±10% of budget; next-tier evolutions only from L3; legendary only at L6 if owned; AI skill slot = level; default L2; pre-battle card shows both numbers. Constants in `difficulty.json`.

## Backlog
### Phase 2/3 follow-ups (only if user asks)
- Status moves rarely appear (most creatures have ≥4 damaging level-up moves) → shield/buff shapes mostly seen on Metapod/Abra-like creatures
- Right-side control column still overlays arena cols 13–15 (translucent); could move into HUD on request
### Ideas (P2)
- Gauntlet leaderboard / run history, replay gallery of saved links, daily seeded challenge
### Nice-to-have (P2)
- Sprite blob caching in IDB for full offline; virtualized grid
