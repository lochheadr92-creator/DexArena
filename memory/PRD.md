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
`{ version, createdAt, updatedAt, totalWins, totalBattles, unlocked[], team[], terrain, rivalLevel, speciesWins{}, speciesKoCredit{}, speciesStandingCredit{}, lastCreditedBattle, items{itemId: count}, abilities{creatureId: 0|1}, gauntlet{runs, clears, bestStage, active, history[≤20]}, daily{key, attempts, best} }`

## Creature record (IDB schema 5)
`{ id, name, displayName, genus, types[], abilities[] (Gen IV non-hidden slugs, slot order), stats{hp,atk,def,spa,spd,spe}, bst, height, weight, sprite, artwork, moves[{id,name,level}], tmMoves[], generation, isBaby, isLegendary, isMythical, captureRate, chainId, evolvesFrom, evolvesTo[], evolution, schema, cachedAt }` — schema-4 rows (no abilities) are kept and patched in the background (`dex.patchAbilities`, 1 request/species).

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

### Task C/D/E — Rival Level slider, fallback visual overrides, Evolution Items — DONE (2026-06) — Jest 17/17 + testing_agent iteration_7 (~95%, all flows pass; polish items fixed after)
- C: `components/RivalLevelPicker.jsx` + `lib/rival.js` + `config/difficulty.json` (`rivalLevels` L1 Rookie 0.8 … L6 Legend 1.3; self power = avg BST + 2×wins cap 150; AI slot = level); `save.rivalLevel` (default 2, clamped in `normalizeSave`); prebattle drafts within budget band; `__rivalTest` harness
- D: `config/moveVisuals.json` `overrides` (71 moves; `pulse` archetype for Psychic/Confusion/etc., Thunderbolt → beam) → fallback damaging 0/265
- E: `lib/items.js` (catalog from PokeAPI evolution items + 12 custom items in `config/items.json`, `rollDrop` 35% / guaranteed gauntlet stage / rare on champion, `applyEvolutionItem`), `save.items` (sanitized on load/import), `components/battle/BagSheet.jsx` + HUD `bag-button` (openable while active; badge = usable options), engine `item` input → `evolveUnit` (keeps HP %, cooldowns, status; swaps stats/types/sprite/moves; logged in replay inputLog), BattlePage persists evolutions to save, `UnlockPanel` roster use, `components/BagPanel.jsx` on Save page, `ItemIcon`
- Post-test polish: splash text clamped inside canvas (clear of control column), bag-empty reachable, "Unlock X first" button label, King's Rock / Up-Grade names, bigger tick buttons, shorter evolve toast
- Known balance note (resolved by Wider Rival Pool): rival avg BST used to plateau ~527 at L4–L6 because the drafting pool ran out

### Wider Rival Pool + Ultra FX — DONE (2026-06) — Jest 22/22 + testing_agent iteration_8 (100% after crash fix)
- Rival pool per level (`difficulty.json rivalLevels[].pool/tierPicks`): L1–2 `unlocked`, L3 `nextTier`×1, L4 `nextTier`×2, L5 `line`×3 (any later form of a started line), L6 `all` (every non-sealed species merged, legendary if owned). `teamgen.tierCandidates`; `RivalLevelPicker` `rival-pool-text[data-pool]`; harness `__rivalTest` prints pool/fully-evolved. Measured (team avg 495): L1 430 · L2 484 · L3 527 · L5 559 · L6 604 avg BST
- Ultra FX (render-only, same-seed outcome identical across presets): `render/quality.js` (presets low/high/ultra in `animations.json quality`, localStorage `arenadex.gfx.v1`, `useGfx`, `FpsGovernor` auto step-down <45 fps ×3 s, `window.__gfx`), `render/particles.js` shaped/additive particles, `render/typeFx.js` per-type styles, `render/ambient.js` terrain ambience (pollen/glint/motes/snow), `render/archetypeFx.js` upgraded drawers + crack/scorch/slash/speedlines/starburst/vignette/lightColumn, renderer: hex shield, buff rune ring, typed hit bursts, SE starburst+vignette+shake, KO dim, melt steam, ground/air effect passes, damage-number pop; `components/GraphicsSettings.jsx` on Save page (`gfx-quality-*`, `gfx-auto-toggle`, `gfx-current`)
- Crash found by testing agent & fixed: aura effects for benched/fainted units produced NaN anchors → createRadialGradient threw inside rAF and froze the battle. Fix: `anchor()` caches last good position + aura/cloud effects carry fx/fy; BattleCanvas wraps `renderer.render` in try/catch so a render bug can never stall the simulation
- Reference: seed 9001 [6,94,25,143,130,65] vs [65,64,63,96,97,124] cavern autoPick, save rivalLevel 2 → player wins at tick 6690 (L3 7620, L4 7429); identical on low/ultra/reduced-motion

### Ability System — DONE (2026-06) — Jest 34/34 + testing_agent iteration_9 (~95%; all 4 action items fixed & self-verified)
- Data: `pokeapi.gen4Abilities` (past_abilities gen ≥ 4, hidden dropped) → `creature.abilities`; Dex schema 5 with background patch of schema-4 rows (LoadingBar `ability-patch-status`). Coverage: 493/493 species, 126 distinct abilities, 75 implemented, 401 species with ≥1 implemented ability.
- Picks: `AbilityPicker` in the detail sheet (`ability-section[data-chosen]`, `ability-option-<id>`), default = first implemented slot, saved `save.abilities[id]`, sanitized on import. Rivals: seeded random implemented ability. Unimplemented abilities shown greyed "No effect in Arena".
- Engine `game/abilities.js` + `config/abilities.json` (defs/params/weather): entry (Intimidate, Download, Pressure, Frisk, Slow Start, Arena Trap/Shadow Tag/Magnet Pull, Drizzle/Drought/Sand Stream/Snow Warning, Forecast, Cloud Nine/Air Lock), pinch (Blaze/Torrent/Overgrow/Swarm), offense (Huge/Pure Power, Hustle, Guts, Technician, Iron Fist, Adaptability, Tinted Lens, Scrappy, Mold Breaker, Compound Eyes, No Guard, Serene Grace, Truant, Solar Power, Flower Gift), defense (Levitate hover, Wonder Guard, Sturdy, Thick Fat, Heatproof, Solid Rock/Filter, Water/Volt Absorb, Flash Fire, Motor Drive, Dry Skin, Shield Dust, Limber, Water Veil, Leaf Guard, Suction Cups, Magic Guard, Color Change, Hyper Cutter/Clear Body/White Smoke, Sand Veil, Snow Cloak), contact/status (Static, Flame Body, Effect Spore, Rough Skin, Aftermath, Synchronize, Shed Skin, Natural Cure, Hydration, Speed Boost, Marvel Scale, Quick Feet, Ice Body, Rain Dish, Swift Swim, Chlorophyll). Weather: permanent, rain/sun ×1.3/×0.7, sand/hail chip 1/16 per 2 s; weather abilities also have terrain-tile variants (water tiles, Pitch, snow/ice, Cavern).
- Presentation: `ability` events → canvas banners (side-aware placement, stacking, width-fit) + per-fx effects (`render/abilityFx.js`), passive auras/hover/trap ring, `WeatherFx` full-screen overlay, HUD `hud-ability-<side>` chips with live labels, `weather-chip`, `status-icon-intimidated`, Switch → "Trapped".
- Replay v2 (`pa`/`na`/`ab`); v1 links play with abilities off. Unknown ability ids in links → null. Desynced replays no longer deadlock on a pending pick (BattleCanvas applies the next recorded pick / auto-picks).
- Harness: `__abilityTest({seed, playerIds, npcIds, terrainId})`, `__abilityCoverage()`. Reference: seed 9001 fixed teams → npc wins tick 11910 (hash cdbea4b0).

### Ability Dex Filter · Run History · Daily Challenge · Weather Terrain Tie-in — DONE (2026-06) — Jest 46/46 + testing_agent iteration_10 (100%)
- Ability filter: `components/AbilityFilter.jsx` (Popover + cmdk; groups "Arena-effective"/"No effect in Arena", species counts, search by name/slug; `ability-filter-button/-search/-option-<slug>/-clear`, `ability-filter-desc` note), `filters.ability` in RosterPage/RosterFilters (`EMPTY_FILTERS` exported), combines with gen/type/unlocked
- Run history: `save.gauntlet.history[]` (max `HISTORY_MAX` 20, sanitized on load/import) — entry `{seed, startedAt, endedAt, outcome cleared|lost|abandoned, cleared, stageReached, team[6], items[], archetypes[6], terrains[6]}`; runs carry `items[]` (gauntlet drops passed via `finishGauntletStage(state, drop)`), `abandonRun` writes an entry; `components/RunHistory.jsx` collapsible on the Gauntlet page (`gauntlet-history*` test ids)
- Daily challenge: `lib/daily.js` — UTC `dailyKey`, FNV `dailySeed`, `buildDaily(creatures)` drafts the rival from the full non-sealed pool at `difficulty.daily.budget` 560 (Legend slot 6, seeded abilities, terrain + archetype), identical for everyone; `attemptSeed(seed, attempts)` varies the battle RNG per attempt while the rival stays fixed; score = win 1000 + standing×100 + rival KOs×50 + win speed bonus max(0, 300 − s); `save.daily {key, attempts, best}`; `/battle?mode=daily`; `components/DailyCard.jsx` on the Arena tab (rival hidden until first attempt, best result, reset countdown, share text `Arena Dex Daily <key> · WIN in m:ss · N standing · K KOs · score S`); ResultScreen `result-daily` + Retry/Share result. GameContext builds `daily` once the Dex (incl. ability patch) is complete and rebuilds on UTC rollover (30 s poll)
- Weather tie-in: `difficulty.legendWeather {level 6, shoreline→rain, snowfield→hail}`; `rival.legendWeather(terrainId, level)`; prebattle derives `initialWeather` (level = rivalLevel ?? slot) → `createBattle` calls `startWeather` at tick 0 (banner from `abilities.json weather[].ambient`, `state.initialWeather`, `meta.weather`); applies to quick L6, gauntlet stage 6, daily; replay payload `w` (absent/null = none, so older links don't desync). UI hints: `terrain-legend-weather` (Arena), `rival-legend-weather` (picker at L6), `gauntlet-stage-weather-6`, `daily-weather`
- Engine fixes found by testing: Specialist rival with a tiny budget drafted an empty team (`rng.pick([])`) → crash; now falls back to the most common type and tops up to 6. Infinite stall (grass types on Snowfield kept walking back to "favourable" ice tiles instead of approaching) → `aiThink` ignores a favourable tile that is farther from the enemy when it must close distance. Safety nets: `engine.suddenDeath` (after 300 s damage ×(1 + 0.5/min), `notice` event + HUD `sudden-death-chip`) and `engine.timeLimitSec` 600 → winner by remaining HP fraction (`state.timedOut`, result-meta text). Reference seed 9001 unchanged (npc · 11910 · cdbea4b0)
- Harness: `__dailyTest({key?, playerIds?, attempt?})`, `__weatherStartTest({terrainId, rivalLevel})`, `__stallSweep({seeds|n, playerIds, archetypeId, terrainId, rivalLevel, maxTicks})`, `__step`

### Next (not started)

## Backlog
### Phase 2/3 follow-ups (only if user asks)
- Status moves rarely appear (most creatures have ≥4 damaging level-up moves) → shield/buff shapes mostly seen on Metapod/Abra-like creatures
- Right-side control column still overlays arena cols 13–15 (translucent); could move into HUD on request
- Wall archetype vs faster no-attack units (e.g. Wynaut) can run to the 600 s time limit; AI tuning if it shows up in play
### Ideas (P2)
- Replay gallery of saved links, daily leaderboard / streaks, daily history by day
### Nice-to-have (P2)
- Sprite blob caching in IDB for full offline; virtualized grid
