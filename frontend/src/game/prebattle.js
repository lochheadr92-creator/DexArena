import { archetypes as archetypeConfig, difficulty as difficultyConfig, engine } from "@/game/config";
import { makeRng } from "@/game/rng";
import { ensureMoves } from "@/game/moveData";
import { buildMoveset, toBattleMove, STRUGGLE_ID } from "@/game/moves";
import { generateNpcTeam } from "@/game/teamgen";
import { createBattle, difficultyParams, playerParams } from "@/game/state";
import { ensureSprite, spriteReport } from "@/game/render/sprites";

export const mappingLines = (creature, moves) =>
  moves.map((m) => `${creature.displayName}: ${m.name} [${m.type}/${m.damageClass} pow ${m.power}${m.accuracy != null ? ` acc ${m.accuracy}` : ""}] → ${m.shape}, cd ${m.cooldownSec.toFixed(1)}s${m.status ? `, ${m.status.kind} ${m.status.chance}%${m.status.attaches ? "" : " (not attached)"}` : ""}`);

export async function buildMovesets(creatures, overrides = {}, log = []) {
  const learnIds = creatures.flatMap((c) => c.moves.map((m) => m.id));
  const overrideIds = Object.values(overrides).flat();
  let moveMap = await ensureMoves([...learnIds, ...overrideIds, STRUGGLE_ID]);
  const needsTm = creatures.filter((c) => !overrides[c.id] && c.moves.filter((m) => moveMap[m.id] && moveMap[m.id].damageClass !== "status" && moveMap[m.id].power > 0).length < 4);
  if (needsTm.length) {
    const tmIds = needsTm.flatMap((c) => (c.tmMoves || []).map((m) => m.id));
    moveMap = { ...moveMap, ...(await ensureMoves(tmIds)) };
  }
  return creatures.map((c) => {
    if (overrides[c.id]) {
      const set = overrides[c.id].map((id) => moveMap[id]).filter(Boolean).map(toBattleMove);
      if (set.length === 4) return set;
    }
    return buildMoveset(c, moveMap, log);
  });
}

export async function prepareBattle({ creatures, unlockedIds, playerIds, terrainId, seed, movesetOverrides = {}, npcMovesetOverrides = {}, autoPick = false, archetypeId = null, npcIds = null, slot = null, initialHp = null, replayInputs = null, playerHasLegendary = false, trace = false, onProgress = () => {}, decodeSprites = true }) {
  const log = [];
  const rng = makeRng((seed ^ 0x9e3779b9) >>> 0);
  const archetype = archetypeConfig.archetypes[archetypeId || rng.pick(archetypeConfig.quickBattlePool)];
  onProgress("Scouting rival trainer");
  const playerCreatures = playerIds.map((id) => creatures[id]);
  const npcCreatures = npcIds ? npcIds.map((id) => creatures[id]) : await generateNpcTeam({ rng, creatures, unlockedIds, archetype, playerHasLegendary, log });

  onProgress("Fetching move data");
  const playerMovesets = await buildMovesets(playerCreatures, movesetOverrides, log);
  const npcMovesets = await buildMovesets(npcCreatures, npcMovesetOverrides, log);
  const mapping = [...playerCreatures.flatMap((c, i) => mappingLines(c, playerMovesets[i])), ...npcCreatures.flatMap((c, i) => mappingLines(c, npcMovesets[i]))];

  let spriteStats = null;
  if (decodeSprites) {
    onProgress("Decoding sprites");
    const t0 = performance.now();
    const before = spriteReport.decoded.length;
    await Promise.all([...playerCreatures.map((c) => ensureSprite(c, "back")), ...npcCreatures.map((c) => ensureSprite(c, "front"))]);
    const decoded = spriteReport.decoded.slice(before);
    spriteStats = { ms: +(performance.now() - t0).toFixed(0), decoded, fallbacks: [...spriteReport.fallbacks] };
  }

  const difficultySlot = slot || difficultyConfig.quickBattleSlot;
  const state = createBattle({
    seed,
    terrainId,
    autoPick,
    trace,
    player: { creatures: playerCreatures, movesets: playerMovesets, params: playerParams(), name: "You", initialHp },
    npc: { creatures: npcCreatures, movesets: npcMovesets, params: difficultyParams(archetype, difficultySlot), archetypeId: archetype.id, name: archetype.name },
  });
  if (replayInputs) state.replayInputs = replayInputs.map((x) => ({ ...x })).sort((a, b) => a.tick - b.tick);
  state.meta = { archetype: archetype.id, slot: difficultySlot, initialHp, mapping, log, spriteStats, damageScale: engine.DAMAGE_SCALE };
  return state;
}
