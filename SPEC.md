Here are the spec sections verbatim. First, save this entire message as /app/SPEC.md (or the repo root if the path differs) and treat that file as the source of truth for all remaining phases, so a future fork does not lose it. The Phase 1 verification output (cold and warm load Network lists, fresh save lock check for Charmander, Charmeleon, Charizard, Mewtwo, Articuno) is still owed before Phase 2 starts.
### Movesets
- Each creature gets 4 moves chosen automatically from its learnset: the highest power move of each of its own types first, then the highest power remaining damaging moves, then one status move if a slot is left. If fewer than 4 damaging learnset moves exist, fill from TM moves and log it. The player can tap a slot in the popover to swap in any other learnable move.
- Move shapes come from a deterministic mapping table, never set by hand per move:
  - special, power 60 or above, name contains beam, blast, bolt, pulse, cannon, ray, shot, wave → projectile (straight line, speed, range).
  - special otherwise → area (circle at target point, 0.4 s wind-up).
  - physical, name contains tackle, charge, rush, slam, dash, take-down, body → dash (move burst, damage on contact).
  - physical otherwise → melee (short arc in facing direction).
  - status, effect text contains protect, defense, harden, barrier → shield (block next hit, 3 s).
  - status otherwise → buff (Speed or Attack up for 5 s, Speed if base speed is the higher stat).
- Cooldown = clamp(power / 25, 1, 6) seconds for damaging moves, 8 s for status. Accuracy below 100 becomes a miss chance per use. Burn (damage over 4 s) and paralysis (Speed 50% for 2 s) attach only to moves whose effect text names them.
### Type chart and stats
- Gen IV era type matchup table (17 types, no Fairy, Steel resists Ghost and Dark) as a JSON constant, matching the past_types typings already applied in Phase 1. State the source you built the chart from.
- All creatures at level 50, neutral stats. HP = floor(2 * base_hp * 50 / 100) + 60. Other stats = floor(2 * base * 50 / 100) + 5.
### Terrains, each a 16x28 tile grid drawn to a 9:16 canvas
- Pitch: open grass, two low walls near centre. Baseline, no modifiers.
- Shoreline: left third water. Water types move 100% in water, all others 50%. Fire moves deal 75% on water tiles. Electric moves hitting a target standing in water deal 150%.
- Cavern: rock pillars block projectiles and movement. Rock and Ground types take 25% less damage. Flying types ignore pillars for movement but not projectiles.
- Snowfield: ice patches with reduced friction. Fire area moves melt the ice they land on for 10 s. Grass types move 75% on snow, Ice types keep full control on ice.
- Tile types: ground, water, rock, ice, snow, wall. All modifiers live in one lookup table keyed by (tile type, creature type) and (tile type, move type).
### Battle engine
- Fixed 60 Hz tick with accumulator, rendering via requestAnimationFrame. Circle collision for units; projectiles collide with walls, rock tiles, and units.
- Damage: ((2 * 50 / 5 + 2) * Power * Atk / Def) / 50 + 2, using attack and defense for physical and special-attack and special-defense for special, times STAB 1.5, times type effectiveness (0, 0.25, 0.5, 1, 2, 4), times terrain modifiers, times random 0.85 to 1.00, times DAMAGE_SCALE (a single tuning constant, start at 1.0), round down, minimum 1.
- Target pacing: a 1v1 between evenly matched basic forms with neutral typing on Pitch should last 25 to 40 seconds, median near 30. Tune DAMAGE_SCALE and cooldown bounds until the pacing test passes. Do not change the formula shape to hit the target.
- Switching: a Switch button on the HUD opens the team strip at any time. Switching takes 1.5 s during which the outgoing creature is withdrawn and the incoming one is invulnerable on entry. Switching never restores HP, clears status, or resets cooldowns; the withdrawn creature keeps its exact HP and its cooldowns keep ticking on the bench. A faint forces the switch (sim pauses until the player picks, or Auto pick decides). Auto pick is a toggle, off by default.
- Fainting: HP 0 plays a 0.5 s puff, then the switch flow, then a 1 s "GO <name>!" splash. Battle ends when one side has nothing left.
- Result screen: Win or Loss, time elapsed, remaining per side, per creature kills and damage dealt, then "Rematch" or "Back to roster". (Wins credited to lineages, unlocks earned and "Next trainer" are Phase 3; leave hooks, do not implement.)
### Movement feel
- Creatures move with acceleration and deceleration, not instant velocity changes: accel 0.15 s to full speed, decel 0.1 s, max turn rate 540 degrees per second. Speed stat sets top speed.
- When holding preferred distance a creature strafes in short arcs around the opponent (2 to 4 tiles of lateral movement every 1 to 2 s, direction chosen by RNG) rather than standing still. Between actions it drifts slightly and faces the opponent.
- Dodge is a short burst: 0.25 s at 2.5x top speed, perpendicular to the incoming projectile, 1.2 s cooldown, no invulnerability frames. The projectile misses only if the circle collision no longer overlaps. Dash moves use the same burst system with damage on contact.
- Melee and dash creatures close in at an angle, not straight on, and back off for 0.5 s after a melee swing before re-engaging.
- Sprites face left or right by flipping the image on the X axis based on movement direction. Idle creatures bob 2 px up and down on a 1 s cycle.
- Knockback: a melee hit pushes the target 0.5 tiles away, a dash hit 1 tile. Knockback is part of step(state), not the renderer.
### Creature AI, one shared routine for both sides, modified by archetype parameters
- Preferred distance from its highest value move (projectile and area kite, melee and dash close), scaled by the archetype's aggression.
- Steer to hold that distance with simple obstacle avoidance against rock and wall tiles.
- Dodge perpendicular when an enemy projectile will reach it within 1 s, subject to the archetype's dodge chance and reaction delay.
- Move onto a favourable tile when one is within 4 tiles and the current tile is worse (modifier table only).
- Use the move off cooldown with the highest expected damage (STAB, type chart, terrain); shield when a high damage move is incoming; buff at full HP with nothing better to do.
- Switch logic (NPC only, a separate function, player decides their own): switch out when at a 4x type disadvantage and a 2x or better answer is on the bench, or when HP is below 20% and the archetype's switch willingness allows it. On faint, send the remaining creature with the best type matchup.
- Base aggression = attack / (attack + defense), clamped 0.3 to 0.9, then multiplied by the archetype aggression factor.
- The same AI function drives both sides. Archetype parameters are the only difference. No NPC only or player only branches inside the AI.
### Trainer archetypes (JSON constants, each sets AI parameters and team building rules)
- Brawler: aggression 1.3, dodge chance 0.3, reaction delay 0.5 s, switch willingness low, team favours high attack physical creatures.
- Wall: aggression 0.6, dodge chance 0.5, reaction delay 0.4 s, switch willingness medium, team favours high HP and defense creatures, prefers shield and buff moves.
- Kiter: aggression 0.8, dodge chance 0.8, reaction delay 0.25 s, switch willingness medium, team favours high speed special attackers with projectile moves.
- Tactician: aggression 1.0, dodge chance 0.6, reaction delay 0.3 s, switch willingness high, team built for type coverage, switches aggressively for matchups.
- Specialist: aggression 1.0, dodge chance 0.5, reaction delay 0.35 s, mono-type team (type chosen at random), gym leader feel.
- Champion: aggression 1.1, dodge chance 0.85, reaction delay 0.2 s, switch willingness high, team drawn from the strongest unlocked tier including one legendary once the player has unlocked any.
- Difficulty scaling: each gauntlet slot applies a multiplier to dodge chance and divides reaction delay (slot 1: 0.8x dodge, 1.25x delay; slot 6: 1.0x dodge, 0.7x delay). Values in a constants table. (Gauntlet itself is Phase 3; build the table now, apply slot 1 values for Quick Battle.)
### NPC team generation
- NPC teams are drawn from the same evolution tier the player currently has unlocked, plus one creature from the next tier up, so the NPC is slightly ahead but never a wall. Legendaries only appear on NPC teams after the player has unlocked at least one. Quick Battle picks a random archetype. NPC teams are hidden until each creature is sent out; the 6 dot strip reveals them one at a time.
### Battle HUD and visuals
- Top bar: NPC active name, HP bar, type badges, archetype label, 6 dot team strip (unknown, alive, fainted). Bottom bar: player active the same way with numeric HP and a Switch button. Right edge: 1x / 2x / 4x speed toggle, pause, Auto pick toggle.
- Floating damage numbers, "Super effective!" and "Not very effective" popups, white flash on hit, cooldown rings beside each HP bar, burn and paralysis icons on the HP bar.
- NPC uses front sprites, player uses back sprites, scaled to about 48 px, drawn from cached images. Projectile colour by move type.
- Layout: viewport meta tag, canvas keeps 9:16 and fills the available height, HUD overlays the canvas, touch targets at least 48 px, works at 360 px wide, no horizontal scroll, touch-action none on the canvas.
### Animated sprites
- Replace the static front and back sprites with the Black and White era animated sprites from PokeAPI: sprites.versions["generation-v"]["black-white"].animated.front_default and back_default. Verify the exact path against the live API before relying on it and report what you find.
- Decode each GIF into frames once at load using gifuct-js (or an equivalent small decoder with no other dependencies), store the frame array and per frame delays in the IndexedDB cache alongside the species, and play frames on the canvas from the render clock. No img elements over the canvas, no DOM per sprite.
- Fall back to the existing static sprite when no animated sprite exists for a species, and log which species fell back.
- Sprite scale stays about 48 px on screen. Animated frames are larger than the static ones, so scale on draw, do not store rescaled copies. Flip on the X axis for facing as already specified; squash, lunge, afterimage and flash effects apply to the current frame.
- Frame playback is render only and never affects step(state). The animations-off config flag also freezes sprites on frame 0.
- Decode lazily: only the 12 creatures entering a battle get decoded, on the loading step before kickoff. The roster grid keeps using static sprites.
- Acceptance: a battle screenshot sequence over 0.5 s shows the active sprites changing frames; the smoke test result is unchanged with animated sprites on or off; the pre-battle decode step for 12 creatures completes in under 3 s on a warm cache.
- Verification, paste the actual output: the verified sprite path, the fallback species list, decoded frame counts for the 6 player creatures, pre-battle decode time on cold and warm cache, and the 4x throttled fps profile with animated sprit[es on — user message truncated here; completion to be confirmed]
### Optional amendment: roster scope (PENDING CONFIRMATION — apply only if confirmed)
- Limit the dex to species 1 to 251 (Gen 1 and 2). Legendary count becomes 11, sealed accordingly. All unlock thresholds and tier rules unchanged. Apply only if confirmed.
### Move animations, one per shape, coloured by move type (type colour table in config)
- Every move has three render phases driven by timers in state: wind-up (user sprite scales to 1.15x and flashes the type colour), release (the shape effect below), recovery (user sprite squashes to 0.9x for 0.1 s then returns).
- Projectile: a glowing orb of the type colour, 12 px, with a 6 particle trail fading over 0.3 s. On hit, a 20 px burst of 8 particles plus the target's white flash and a 0.2 s recoil of 0.3 tiles.
- Area: a ring of the type colour expands from the target point over the 0.4 s wind-up, then fills and flashes on detonation with 12 particles scattering outward.
- Melee: a 90 degree arc slash of the type colour sweeps in front of the user over 0.15 s; the user lunges 0.3 tiles forward and back.
- Dash: the user leaves 3 afterimages of its sprite at 50%, 30%, 10% opacity along the dash path, with a streak of the type colour.
- Shield: a translucent bubble of the type colour around the user for its duration; it cracks and shatters into 6 fragments when it blocks a hit.
- Buff: an upward particle stream of the type colour for 0.5 s and a small arrow icon above the HP bar for the buff duration.
- Status: burn shows small flame particles on the sprite every 0.5 s; paralysis shows yellow sparks every 0.4 s and a brief jitter of the sprite.
- Faint: sprite tints grey, drops 10 px, fades over 0.5 s with a puff of 10 grey particles.
- Switch out: sprite shrinks to 0 over 0.3 s into a point of light; switch in: a point of light expands into the sprite over 0.3 s, then the "GO <name>!" splash.
- Hit numbers float up 30 px over 0.6 s and fade; super effective numbers are larger and shake once.
- All animations are render only. They read timers and events from state and never change HP, position, cooldowns, or hit detection. Damage lands at the tick the sim says it lands, whether or not the animation has finished drawing.
- Particle counts and durations live in the config module. A particle cap of 300 live particles; when exceeded, new particles are skipped, never simulated later.
- Animations use canvas draw calls and image transforms on the cached sprites. No sprite sheets, no extra network assets, no DOM nodes per particle.
### Do NOT build in Phase 2
- Unlocks, lineage wins, gauntlet, streaks, save writes beyond the existing skeleton, export and import (all Phase 3).
- Entry hazards, weather, passive abilities, held items, natures, IVs, EVs, levelling, XP, catching, trading, generations past 4, mega or regional forms.
- Player movement controls or manual move triggering. Turn-based mode, multiplayer, backend of any kind. Sound, PWA, service worker.
- More than 4 terrains, 6 move shapes, or 6 archetypes.
### Invariants
- All game rules (type chart, terrain grids, modifier table, shape mapping table, archetype table, difficulty table, DAMAGE_SCALE, tick constants, type colour table, particle and animation constants) live in JSON constants in one config module.
- One battle state object (both teams, active indices, units, projectiles, timers, tick, RNG seed). All mutation goes through step(state). Rendering reads state only. The only player inputs that reach step are switch choice, replacement choice, speed, and pause.
- Seeded RNG. Same seed, same teams, same terrain, same archetype, same player choices replays identically, tick for tick. Expose window.__seed.
- Logic is frame rate independent: fixed step size, the speed toggle changes steps per frame only.
- Terrain effects come only from the modifier table. Move shapes only from the mapping table.
- HP bars, team strips, cooldown rings and result summaries derive from state, never tracked separately.
- Animations never affect simulation results. A config flag disables all animations and particles without changing any battle outcome.
- Network calls go only to pokeapi.co and its sprite host.
### Acceptance criteria for Phase 2
- NPC team dots show as unknown at battle start and reveal only on send out.
- A Water move on a Fire/Rock creature logs 4x; a Normal move on a Ghost logs 0x and deals no damage; a Fire move on a Water/Rock creature logs 0.25x.
- Every creature entering battle has exactly 4 moves and every move has a logged shape; no move unmapped.
- On Shoreline a non Water creature on water moves at 50% of open ground speed by logged tiles per second. On Cavern a projectile into a pillar despawns before the target. On Snowfield a Fire area move on ice converts those tiles to ground.
- A projectile-heavy creature keeps a larger logged average distance than a melee creature over 20 s on Pitch.
- A logged position trace over 20 s shows a creature holding preferred distance moves at least 15 tiles total and changes direction at least 8 times.
- A dodge burst logged against an incoming projectile shows the circle collision missing when started 0.4 s or more before impact and hitting when started 0.1 s before.
- Switching mid battle withdraws the creature with its HP unchanged; switching it back in shows the same HP and no cooldown reset.
- Fainting on the player side pauses until a pick is made unless Auto pick is on; the new creature logs 0 damage during its 1.5 s entry window.
- Pacing test: 50 seeded 1v1 battles between evenly matched basic forms with neutral typing on Pitch produce a median duration between 25 and 40 s.
- Archetype test: 20 seeded battles each for Brawler and Kiter against the same opponent show Brawler's logged average distance below Kiter's and Kiter's dodge count above Brawler's.
- With window.__seed = 12345, fixed teams, Pitch, Auto pick on, two separate headless runs produce the same winner, remaining counts and end tick. 1x, 2x and 4x finish on the same end tick. Animations on and animations off produce the same result.
- Each of the six move shapes plus burn, paralysis, faint and switch has a screenshot mid animation.
### Verification, run these and paste the actual output
- Device mode 360x780: screenshot the battle screen on each terrain, the result screen, and one mid animation screenshot for each of the six move shapes plus burn, paralysis, faint and switch.
- window.__smokeTest() twice (seeded, fixed teams, Pitch, Auto pick on, headless to completion): paste both outputs showing winner, remaining counts and end tick match; then at speed 1, 2 and 4 with end ticks; then with animations off showing identical results.
- window.__pacingTest(): 50 durations, median, min, max, and the DAMAGE_SCALE value used.
- window.__archetypeTest(): average distance and dodge counts per archetype.
- The 20 s position trace summary (total distance, direction changes) and the dodge timing log.
- Console output for the multiplier checks, the three terrain checks, the move mapping dump for the 6 player creatures, and the switch HP persistence check.
- A 10 s performance profile mid battle with 4x CPU throttling, once for a standard matchup and once for two projectile kiters on Pitch. Target 45 fps or above for both.
### On missing data or ambiguity
STOP and report the gap. Do not invent a rule, threshold, archetype value, animation timing or data field. List every assumption you had to make at the end of the phase. Stop and report when Phase 2 verification is pasted; do not start Phase 3.

---
## Appendix A — Approved resolutions of spec gaps (Phase 2, agreed in chat, June 2026)
Scope & data: roster amendment (1–251) NOT applied; truncated line read as "with animated sprites on"; learnset = all Platinum level-up moves regardless of level, TM = Platinum machine moves, learnable = union; player move swaps are session-only (no save write); status moves whose effect names burn/paralysis map to buff per the table (self-buff, status does not attach, logged); status chance = PokeAPI effect_chance (null → 100%); burn = 1/8 max HP over 4 s; buff multiplier 1.5x; shield blocks one hit or expires at 3 s.
Engine numbers: top speed tiles/s = 1.5 + speed/40 (level-50 stat); unit radius 0.45 tiles; projectile radius 0.2, speed 10 t/s, range 8; area radius 1.5 at target position at cast, range 8; melee reach 1.3 tiles, 90° arc; dash = 0.25 s × 2.5x burst; preferred distance projectile/area 5 ÷ aggression, melee/dash 1.0 ÷ aggression; expected damage = formula without random × accuracy/100; projectile despawns after range; dash stops at walls/rock.
Terrain: modifier table keyed terrain → tile → type; damage modifiers use the tile under the TARGET, movement modifiers the tile under the MOVER; ice friction accel 0.6 s / decel 0.5 s, Ice types exempt; layouts: Pitch two 4-tile walls rows 12/15 offset, Shoreline cols 0–4 water, Cavern six 2×2 pillars mirrored, Snowfield four 3×3 ice patches on snow; spawns player (8,24), NPC (8,3).
AI/archetypes: switch willingness low 0.2 / medium 0.5 / high 0.9 (probability, evaluated once on crossing 20% HP); difficulty slots dodge 0.80/0.84/0.88/0.92/0.96/1.00, delay 1.25/1.14/1.03/0.92/0.81/0.70; NPC pool = unlocked non-sealed, next tier = locked species whose pre-evolution is unlocked (one per team); Auto pick uses the same best-matchup function as NPC on-faint; Specialist mono-type chosen among types with ≥6 candidates.
Flow: manual Switch strip pauses the sim; GO splash runs inside the 1.5 s entry window; move-swap UI in the roster detail sheet; pacing pairs = basic-stage Normal-type species within 10% BST, 1v1, Tactician params both sides.
Defaults accepted without override: Specialist switch willingness medium (0.5); player-side AI params = Tactician values ("playerDefaults"); incoming creature is frozen (no move/cast) and invulnerable for the 1.5 s entry window, outgoing leaves at switch start; area range 8 tiles; buff = Speed if base Speed ≥ base Attack else Attack; double KO = Loss; accuracy rolled once at use (missed projectile flies for visuals, cannot hit); NPC bench "answer" = benched creature with a ≥2x move vs enemy that is not itself 4x weak.

Assumptions added during Phase 2 verification (2026-06): dodge and dash bursts ramp to their burst speed with the standard 0.15 s movement acceleration (instant 2.5x would let any creature faster than ~2.6 tiles/s clear a projectile with a 0.1 s lead); unit-unit separation never pushes a creature into a blocked tile; the AI only counts a projectile move as usable when the straight line to the target is clear of wall/rock tiles; the archetype test builds the player team with the archetype's team rule (Brawler physical / Kiter projectile specialists) since with identical melee movesets both archetypes close to the same distance; the battle canvas is laid out between the two HUD cards (not under them) so no arena row is hidden.
Animated sprites: path verified for all 493 species (front and back); decoder gifuct-js 2.1.2 (one dependency: js-binary-schema-parser, zero deps).

### Phase 3 rules (confirmed by user, 2026-06)
- Species win credit: every creature on the player's team receives +1 species win when the battle is won (participation; KO or last-standing give no extra credit). Losses credit nothing except totalBattles.
- Evolution unlocks: a locked, non-sealed form unlocks when its direct pre-evolution is unlocked and has 3 species wins (stage 2 target) or 5 species wins (stage 3 target). Stage = number of evolutions from the chain base (Pichu→Pikachu→Raichu: Raichu is stage 3 → 5 Pikachu wins). All branches of a split evolution unlock together (Eevee at 3 wins → all seven).
- Legendaries: every 10 total wins earns one Seal Key (keys available = floor(totalWins/10) − sealed species already unlocked). A key is spent from the creature detail sheet on any sealed species.
- Gauntlet: slots 1–5 are a random non-repeating order of Brawler/Wall/Kiter/Tactician/Specialist, slot 6 is Champion; terrain per fight random (seeded per run); difficulty slot = stage; HP and faints carry over (cooldowns reset each fight, short statuses do not carry); a loss or a clear ends the run; run state lives in save.gauntlet.active; wins inside the gauntlet credit species wins normally. bestStage = most stages cleared in one run.
- Export/Import: JSON download of the save object; import validates version 1 + shape, asks for confirmation, then replaces the save on the device.
- Replay link: /replay#<base64url JSON> with seed, terrain, archetype, difficulty slot, both teams, all 12 movesets (move ids), initial HP (gauntlet), initial auto-pick flag and the player input log (tick + switch / pick / auto-toggle). Replays run read-only (speed/pause only), credit nothing, and reproduce the exact battle.
