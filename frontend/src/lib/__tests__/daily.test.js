import { dailyKey, dailySeed, attemptSeed, dailyResult, recordDaily, shareText, fmtTime, todaysDaily, msUntilReset } from "@/lib/daily";
import { TICK_RATE } from "@/game/config";

const mkState = ({ winner, playerHp, npcHp, endTick }) => ({
  winner,
  endTick,
  teams: { player: { units: playerHp.map((hp) => ({ hp })) }, npc: { units: npcHp.map((hp) => ({ hp })) } },
});

describe("daily challenge", () => {
  test("dailyKey is a UTC YYYY-MM-DD", () => {
    expect(dailyKey(new Date(Date.UTC(2026, 5, 14, 23, 59)))).toBe("2026-06-14");
    expect(dailyKey(new Date(Date.UTC(2026, 5, 15, 0, 0)))).toBe("2026-06-15");
  });
  test("seed is deterministic per key and differs across days", () => {
    expect(dailySeed("2026-06-14")).toBe(dailySeed("2026-06-14"));
    expect(dailySeed("2026-06-14")).not.toBe(dailySeed("2026-06-15"));
    expect(attemptSeed(123, 0)).toBe(123);
    expect(attemptSeed(123, 1)).not.toBe(attemptSeed(123, 2));
  });
  test("msUntilReset counts to next UTC midnight", () => {
    expect(msUntilReset(new Date(Date.UTC(2026, 5, 14, 23, 0)))).toBe(3600000);
  });
  test("score rewards wins, standing creatures, KOs and speed", () => {
    const win = dailyResult(mkState({ winner: "player", playerHp: [10, 0, 5, 0, 0, 0], npcHp: [0, 0, 0, 0, 0, 0], endTick: 92 * TICK_RATE }));
    expect(win).toMatchObject({ win: true, standing: 2, kos: 6, seconds: 92 });
    expect(win.score).toBe(1000 + 200 + 300 + (300 - 92));
    const loss = dailyResult(mkState({ winner: "npc", playerHp: [0, 0, 0, 0, 0, 0], npcHp: [3, 0, 0, 9, 1, 0], endTick: 60 * TICK_RATE }));
    expect(loss).toMatchObject({ win: false, standing: 0, kos: 3 });
    expect(loss.score).toBe(150);
  });
  test("recordDaily keeps the best score and counts attempts, resetting on a new day", () => {
    const save = { daily: { key: null, attempts: 0, best: null } };
    const r1 = recordDaily(save, "2026-06-14", { score: 400, win: false });
    expect(r1.isBest).toBe(true);
    expect(r1.save.daily).toMatchObject({ key: "2026-06-14", attempts: 1, best: { score: 400 } });
    const r2 = recordDaily(r1.save, "2026-06-14", { score: 300, win: false });
    expect(r2.isBest).toBe(false);
    expect(r2.save.daily).toMatchObject({ attempts: 2, best: { score: 400 } });
    const r3 = recordDaily(r2.save, "2026-06-15", { score: 100, win: false });
    expect(r3.save.daily).toMatchObject({ key: "2026-06-15", attempts: 1, best: { score: 100 } });
    expect(todaysDaily(r3.save, "2026-06-16")).toEqual({ key: "2026-06-16", attempts: 0, best: null });
  });
  test("share text", () => {
    expect(fmtTime(92.4)).toBe("1:32");
    expect(shareText("2026-06-14", { win: true, seconds: 92.4, standing: 3, kos: 6, score: 1508 })).toBe("Arena Dex Daily 2026-06-14 · WIN in 1:32 · 3 standing · 6 KOs · score 1508");
  });
});
