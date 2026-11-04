import { tierCandidates } from "@/game/teamgen";
import { rivalPlan, RIVAL_LEVELS } from "@/lib/rival";

const mk = (id, bst, evolvesFrom = null, extra = {}) => ({ id, bst, evolvesFrom, evolvesTo: [], types: ["normal"], stats: {}, moves: [], ...extra });
const creatures = {
  1: mk(1, 318),
  2: mk(2, 405, 1),
  3: mk(3, 525, 2),
  10: mk(10, 195),
  11: mk(11, 205, 10),
  12: mk(12, 395, 11),
  150: mk(150, 680, null, { isLegendary: true }),
};
const all = Object.values(creatures);
const unlocked = new Set([1]);
const ids = (list) => list.map((c) => c.id).sort((a, b) => a - b);

describe("rival pool modes", () => {
  test("unlocked mode adds nothing", () => {
    expect(tierCandidates(all, creatures, unlocked, "unlocked")).toEqual([]);
  });
  test("nextTier only allows the immediate next form of an unlocked species", () => {
    expect(ids(tierCandidates(all, creatures, unlocked, "nextTier"))).toEqual([2]);
  });
  test("line allows every later form of a started line", () => {
    expect(ids(tierCandidates(all, creatures, unlocked, "line"))).toEqual([2, 3]);
  });
  test("all opens every non-sealed locked species", () => {
    expect(ids(tierCandidates(all, creatures, unlocked, "all"))).toEqual([2, 3, 10, 11, 12]);
  });
  test("level config maps L5 → line/3 picks and L6 → all/legendary", () => {
    expect(RIVAL_LEVELS.map((l) => l.pool)).toEqual(["unlocked", "unlocked", "nextTier", "nextTier", "line", "all"]);
    const p5 = rivalPlan([creatures[3], creatures[2]], 0, 5);
    expect(p5).toMatchObject({ level: 5, pool: "line", tierPicks: 3, legendary: false, power: 465, budget: 558 });
    expect(rivalPlan([creatures[3]], 100, 6)).toMatchObject({ level: 6, pool: "all", legendary: true, power: 675, budget: 878 });
  });
});
