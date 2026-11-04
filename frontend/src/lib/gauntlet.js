import { makeRng } from "@/game/rng";
import { TERRAINS } from "@/lib/terrains";
import { HISTORY_MAX } from "@/lib/save";

export const GAUNTLET_STAGES = 6;
const ROTATION = ["brawler", "wall", "kiter", "tactician", "specialist"];

export const randomSeed = () => (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;

export function newRun(team, seed = randomSeed()) {
  const rng = makeRng(seed);
  const archetypes = [...rng.shuffle(ROTATION), "champion"];
  const terrains = Array.from({ length: GAUNTLET_STAGES }, () => rng.pick(TERRAINS).id);
  return { seed, stage: 1, archetypes, terrains, team: [...team], hp: null, items: [], startedAt: Date.now() };
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

export function runAfterBattle(run, state, drop = null) {
  const hp = {};
  const team = state.teams.player.units.map((u) => u.creatureId);
  state.teams.player.units.forEach((u) => {
    hp[u.creatureId] = Math.max(0, u.hp);
  });
  const items = drop ? [...(run.items || []), drop] : [...(run.items || [])];
  const lost = state.winner !== "player";
  const cleared = !lost && run.stage >= GAUNTLET_STAGES;
  const next = { ...run, team, items, hp };
  return {
    outcome: lost ? "lost" : cleared ? "cleared" : "advance",
    stageReached: run.stage,
    hp,
    items,
    run: lost || cleared ? null : { ...next, stage: run.stage + 1 },
    ended: lost || cleared ? next : null,
  };
}

export function historyEntry(run, outcome, stageReached) {
  const cleared = outcome === "cleared" ? GAUNTLET_STAGES : stageReached - 1;
  return { seed: run.seed, startedAt: run.startedAt, endedAt: Date.now(), outcome, cleared, stageReached, team: [...run.team], items: [...(run.items || [])], archetypes: [...run.archetypes], terrains: [...run.terrains] };
}

const pushHistory = (g, entry) => [entry, ...(g.history || [])].slice(0, HISTORY_MAX);

export function applyRunToSave(save, result) {
  const g = save.gauntlet;
  const clearedStages = result.outcome === "lost" ? result.stageReached - 1 : result.stageReached;
  const history = result.ended ? pushHistory(g, historyEntry(result.ended, result.outcome, result.stageReached)) : g.history || [];
  return { ...save, gauntlet: { ...g, active: result.run, history, clears: g.clears + (result.outcome === "cleared" ? 1 : 0), bestStage: Math.max(g.bestStage, clearedStages) } };
}

export function abandonRun(save) {
  const g = save.gauntlet;
  if (!g.active) return save;
  return { ...save, gauntlet: { ...g, active: null, history: pushHistory(g, historyEntry(g.active, "abandoned", g.active.stage)) } };
}
