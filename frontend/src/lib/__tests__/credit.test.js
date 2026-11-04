import { battleBonuses, creditBattle, speciesCredit, KO_BONUS, STANDING_BONUS } from "@/lib/progression";
import { defaultSave, normalizeSave } from "@/lib/save";

const unit = (id, creatureId, over = {}) => ({ id, creatureId, name: `u${creatureId}`, hp: 100, maxHp: 100, entries: 1, lastHitBy: null, lastHitIndirect: false, ...over });

function makeState({ winner = "player", player, npc }) {
  return { winner, battleId: "b1", teams: { player: { units: player }, npc: { units: npc } } };
}

const creatures = {};
const unlockedIds = new Set();
const credit = (save, state) =>
  creditBattle(save, { win: state.winner === "player", playerIds: state.teams.player.units.map((u) => u.creatureId), battleId: state.battleId, bonuses: battleBonuses(state) }, creatures, unlockedIds);

describe("battleBonuses", () => {
  test("one KO by a winner → +1 KO credit, standing", () => {
    const state = makeState({ player: [unit("player-0", 1)], npc: [unit("npc-0", 50, { hp: 0, lastHitBy: "player-0" })] });
    expect(battleBonuses(state)[0]).toMatchObject({ speciesId: 1, kos: 1, standing: true });
  });

  test("three KOs by one creature", () => {
    const npc = [0, 1, 2].map((i) => unit(`npc-${i}`, 50 + i, { hp: 0, lastHitBy: "player-0" }));
    const state = makeState({ player: [unit("player-0", 1)], npc });
    const res = credit(defaultSave(), state);
    expect(res.save.speciesKoCredit[1]).toBe(3 * KO_BONUS);
    expect(res.save.speciesStandingCredit[1]).toBe(STANDING_BONUS);
    expect(speciesCredit(res.save, 1)).toEqual({ wins: 1, koCredit: 3, standingCredit: 1, totalCredit: 5 });
  });

  test("winner that scored a KO then fainted → KO credit, no standing", () => {
    const state = makeState({
      player: [unit("player-0", 1, { hp: 0, lastHitBy: "npc-0" }), unit("player-1", 2)],
      npc: [unit("npc-0", 50, { hp: 0, lastHitBy: "player-0" })],
    });
    const [a, b] = battleBonuses(state);
    expect(a).toMatchObject({ kos: 1, standing: false });
    expect(b).toMatchObject({ kos: 0, standing: true });
  });

  test("never-entered benched creature gets nothing (not standing)", () => {
    const state = makeState({ player: [unit("player-0", 1), unit("player-1", 2, { entries: 0 })], npc: [unit("npc-0", 50, { hp: 0, lastHitBy: "player-0" })] });
    const res = credit(defaultSave(), state);
    expect(battleBonuses(state)[1]).toMatchObject({ entered: false, kos: 0, standing: false });
    expect(speciesCredit(res.save, 2)).toEqual({ wins: 1, koCredit: 0, standingCredit: 0, totalCredit: 1 });
  });

  test("indirect (burn) faint gives no KO credit", () => {
    const state = makeState({ player: [unit("player-0", 1)], npc: [unit("npc-0", 50, { hp: 0, lastHitBy: "player-0", lastHitIndirect: true })] });
    expect(battleBonuses(state)[0].kos).toBe(0);
  });

  test("losing-side KO scorer gets 0", () => {
    const state = makeState({ winner: "npc", player: [unit("player-0", 1, { hp: 0, lastHitBy: "npc-1" }), unit("player-1", 2, { hp: 0, lastHitBy: "npc-1" })], npc: [unit("npc-0", 50, { hp: 0, lastHitBy: "player-0" }), unit("npc-1", 51)] });
    expect(battleBonuses(state)[0]).toMatchObject({ kos: 0, standing: false });
    const res = credit(defaultSave(), state);
    expect(res.save.speciesKoCredit).toEqual({});
    expect(res.save.speciesWins).toEqual({});
    expect(res.save.totalBattles).toBe(1);
    expect(res.save.totalWins).toBe(0);
  });

  test("double KO resolves as a loss (engine rule) → no win, no bonus; no draw/forfeit states exist", () => {
    const state = makeState({ winner: "npc", player: [unit("player-0", 1, { hp: 0, lastHitBy: "npc-0" })], npc: [unit("npc-0", 50, { hp: 0, lastHitBy: "player-0" })] });
    const res = credit(defaultSave(), state);
    expect(res.save.totalWins).toBe(0);
    expect(res.rows).toEqual([]);
    expect(speciesCredit(res.save, 1).totalCredit).toBe(0);
  });

  test("same battle submitted twice is credited once", () => {
    const state = makeState({ player: [unit("player-0", 1)], npc: [unit("npc-0", 50, { hp: 0, lastHitBy: "player-0" })] });
    const first = credit(defaultSave(), state);
    const second = credit(first.save, state);
    expect(first.credited).toBe(true);
    expect(second.credited).toBe(false);
    expect(second.save).toBe(first.save);
    expect(speciesCredit(second.save, 1)).toEqual({ wins: 1, koCredit: 1, standingCredit: 1, totalCredit: 3 });
    expect(second.save.totalBattles).toBe(1);
  });

  test("bonuses never change wins or battles; old saves read new fields as 0", () => {
    const old = normalizeSave({ version: 1, totalWins: 4, totalBattles: 9, unlocked: [], team: [], speciesWins: { 1: 4 } });
    expect(speciesCredit(old, 1)).toEqual({ wins: 4, koCredit: 0, standingCredit: 0, totalCredit: 4 });
    const state = makeState({ player: [unit("player-0", 1)], npc: [unit("npc-0", 50, { hp: 0, lastHitBy: "player-0" })] });
    const res = credit(old, state);
    expect(res.save.totalWins / res.save.totalBattles).toBeCloseTo(5 / 10);
    expect(res.save.speciesWins[1]).toBe(5);
  });
});
