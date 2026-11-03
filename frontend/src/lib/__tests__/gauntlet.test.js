import { newRun, runAfterBattle, applyRunToSave, abandonRun, GAUNTLET_STAGES } from "@/lib/gauntlet";
import { normalizeSave, defaultSave, HISTORY_MAX } from "@/lib/save";
import { legendWeather } from "@/lib/rival";

const TEAM = [1, 4, 7, 25, 133, 143];
const mkState = (winner, hp = 50) => ({ winner, teams: { player: { units: TEAM.map((id) => ({ creatureId: id, hp })) } } });
const baseSave = () => ({ ...defaultSave(), team: TEAM });

describe("gauntlet run history", () => {
  test("new runs start with an empty item list", () => {
    expect(newRun(TEAM, 1).items).toEqual([]);
  });
  test("drops accumulate on the run and a loss writes a history entry with items + team", () => {
    let save = baseSave();
    let run = newRun(TEAM, 42);
    save = { ...save, gauntlet: { ...save.gauntlet, runs: 1, active: run } };
    const r1 = runAfterBattle(run, mkState("player"), "fire-stone");
    expect(r1.outcome).toBe("advance");
    expect(r1.run.items).toEqual(["fire-stone"]);
    save = applyRunToSave(save, r1);
    expect(save.gauntlet.history).toEqual([]);
    const r2 = runAfterBattle(save.gauntlet.active, mkState("npc", 0), "water-stone");
    expect(r2.outcome).toBe("lost");
    expect(r2.run).toBeNull();
    save = applyRunToSave(save, r2);
    expect(save.gauntlet.active).toBeNull();
    expect(save.gauntlet.bestStage).toBe(1);
    expect(save.gauntlet.history).toHaveLength(1);
    expect(save.gauntlet.history[0]).toMatchObject({ seed: 42, outcome: "lost", cleared: 1, stageReached: 2, team: TEAM, items: ["fire-stone", "water-stone"] });
  });
  test("clearing all stages records cleared=6", () => {
    let save = baseSave();
    let run = { ...newRun(TEAM, 7), stage: GAUNTLET_STAGES };
    save = { ...save, gauntlet: { ...save.gauntlet, runs: 1, active: run } };
    const r = runAfterBattle(run, mkState("player"), null);
    expect(r.outcome).toBe("cleared");
    save = applyRunToSave(save, r);
    expect(save.gauntlet.clears).toBe(1);
    expect(save.gauntlet.history[0]).toMatchObject({ outcome: "cleared", cleared: 6, items: [] });
  });
  test("abandoning records an entry and clears the active run; history is capped", () => {
    let save = baseSave();
    save = { ...save, gauntlet: { ...save.gauntlet, runs: 1, active: { ...newRun(TEAM, 9), stage: 3 }, history: Array.from({ length: HISTORY_MAX }, (_, i) => ({ seed: i, outcome: "lost", cleared: 0, team: TEAM, items: [] })) } };
    const next = abandonRun(save);
    expect(next.gauntlet.active).toBeNull();
    expect(next.gauntlet.history).toHaveLength(HISTORY_MAX);
    expect(next.gauntlet.history[0]).toMatchObject({ seed: 9, outcome: "abandoned", cleared: 2, stageReached: 3 });
    expect(abandonRun(next)).toBe(next);
  });
  test("normalizeSave sanitizes history and daily", () => {
    const s = normalizeSave({ ...defaultSave(), gauntlet: { runs: 2, history: [null, { team: "x" }, { outcome: "lost", team: [1], items: [] }] }, daily: { key: 5 } });
    expect(s.gauntlet.history).toEqual([{ outcome: "lost", team: [1], items: [] }]);
    expect(s.gauntlet.active).toBeNull();
    expect(s.daily).toEqual({ key: null, attempts: 0, best: null });
    const s2 = normalizeSave({ ...defaultSave(), daily: { key: "2026-06-14", attempts: 3, best: { score: 900 } } });
    expect(s2.daily).toEqual({ key: "2026-06-14", attempts: 3, best: { score: 900 } });
  });
});

describe("legend weather tie-in", () => {
  test("only Shoreline/Snowfield at level 6", () => {
    expect(legendWeather("shoreline", 6)).toBe("rain");
    expect(legendWeather("snowfield", 6)).toBe("hail");
    expect(legendWeather("pitch", 6)).toBeNull();
    expect(legendWeather("cavern", 6)).toBeNull();
    expect(legendWeather("shoreline", 5)).toBeNull();
    expect(legendWeather("snowfield", 1)).toBeNull();
  });
});
