import { makeRng } from "@/game/rng";
import { TERRAINS } from "@/lib/terrains";

export const GAUNTLET_STAGES = 6;
const ROTATION = ["brawler", "wall", "kiter", "tactician", "specialist"];

export const randomSeed = () => (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;

export function newRun(team, seed = randomSeed()) {
  const rng = makeRng(seed);
  const archetypes = [...rng.shuffle(ROTATION), "champion"];
  const terrains = Array.from({ length: GAUNTLET_STAGES }, () => rng.pick(TERRAINS).id);
  return { seed, stage: 1, archetypes, terrains, team: [...team], hp: null, startedAt: Date.now() };
}

export function stageSetup(run) {
  const i = run.stage - 1;
  return {
    playerIds: run.team,
    terrainId: run.terrains[i],
    archetypeId: run.archetypes[i],
    slot: run.stage,
    rivalLevel: run.stage,
    initialHp: run.hp ? run.team.map((id) => run.hp[id]) : null,
  };
}

export function runAfterBattle(run, state) {
  const hp = {};
  const team = state.teams.player.units.map((u) => u.creatureId);
  state.teams.player.units.forEach((u) => {
    hp[u.creatureId] = Math.max(0, u.hp);
  });
  const lost = state.winner !== "player";
  const cleared = !lost && run.stage >= GAUNTLET_STAGES;
  return {
    outcome: lost ? "lost" : cleared ? "cleared" : "advance",
    stageReached: run.stage,
    hp,
    run: lost || cleared ? null : { ...run, team, stage: run.stage + 1, hp },
  };
}

export function applyRunToSave(save, result) {
  const g = save.gauntlet;
  const clearedStages = result.outcome === "lost" ? result.stageReached - 1 : result.stageReached;
  return { ...save, gauntlet: { ...g, active: result.run, clears: g.clears + (result.outcome === "cleared" ? 1 : 0), bestStage: Math.max(g.bestStage, clearedStages) } };
}
