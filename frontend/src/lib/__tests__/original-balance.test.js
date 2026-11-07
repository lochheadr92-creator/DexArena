import { ORIGINAL_CREATURES, ORIGINAL_MOVES, loadOriginalCreatures } from "@/content/original";
import { buildMoveset, statusOf } from "@/game/moves";

const moveMap = Object.fromEntries(ORIGINAL_MOVES.map((m) => [m.id, m]));
const RANGED = new Set(["projectile", "area"]);
const CLOSE = new Set(["melee", "dash"]);
const loadouts = ORIGINAL_CREATURES.map((c) => ({ c, set: buildMoveset(c, moveMap, []) }));

describe("Original roster opening nine", () => {
  const byDex = [...ORIGINAL_CREATURES].sort((a, b) => a.dexNo - b.dexNo);

  // The roster opens in Variety order (displayOrder); Numeric order uses dexNo. Both must open
  // with three-stage grass, fire and water lines.
  test.each(["dexNo", "displayOrder"])("the first nine by %s are three-stage grass, fire and water lines", (key) => {
    const ordered = [...ORIGINAL_CREATURES].sort((a, b) => a[key] - b[key]);
    for (const [start, type] of [[0, "grass"], [3, "fire"], [6, "water"]]) {
      const line = ordered.slice(start, start + 3);
      expect(line.map((c) => c.types[0])).toEqual([type, type, type]);
      expect(line[0].evolvesFrom).toBeNull();
      expect(line[0].evolvesTo).toEqual([line[1].id]);
      expect(line[1].evolvesTo).toEqual([line[2].id]);
      expect(line[2].evolvesTo).toEqual([]);
    }
    expect(ordered.slice(0, 3).map((c) => c.displayName)).toEqual(["Reedlet", "Thimblereed", "Sedgewarden"]);
  });

  test("the displaced Mossplod line moved to #151-#153 and is still water", () => {
    const moved = byDex.filter((c) => c.dexNo >= 151 && c.dexNo <= 153);
    expect(moved.map((c) => c.displayName)).toEqual(["Mossplod", "Mosshull", "Bathyward"]);
    expect(moved.map((c) => c.types[0])).toEqual(["water", "water", "water"]);
  });

  test("dex numbers and display order are unique and gapless", () => {
    expect(byDex.map((c) => c.dexNo)).toEqual(Array.from({ length: byDex.length }, (_, i) => i + 1));
    const orders = ORIGINAL_CREATURES.map((c) => c.displayOrder).sort((a, b) => a - b);
    expect(orders).toEqual(Array.from({ length: orders.length }, (_, i) => i + 1));
    expect(Object.keys(loadOriginalCreatures())).toHaveLength(ORIGINAL_CREATURES.length);
  });
});

describe("Original roster move balance", () => {
  test("every creature's default loadout has an own-type ranged and a close damaging move", () => {
    for (const { c, set } of loadouts) {
      expect(set).toHaveLength(4);
      const dmg = set.filter((m) => m.power > 0);
      expect(dmg.some((m) => RANGED.has(m.shape) && c.types.includes(m.type))).toBe(true);
      expect(dmg.some((m) => CLOSE.has(m.shape))).toBe(true);
    }
  });

  test("elemental creatures can use their own element at range", () => {
    for (const { c, set } of loadouts) {
      const own = set.filter((m) => RANGED.has(m.shape) && m.type === c.types[0]);
      expect(own.length).toBeGreaterThan(0);
    }
  });

  test("shield and buff moves are common, not rare", () => {
    const withStatus = loadouts.filter(({ set }) => set.some((m) => m.shape === "shield" || m.shape === "buff"));
    expect(withStatus.length).toBeGreaterThanOrEqual(100);
    expect(withStatus.some(({ set }) => set.some((m) => m.shape === "shield"))).toBe(true);
    expect(withStatus.some(({ set }) => set.some((m) => m.shape === "buff"))).toBe(true);
  });

  test("burn and paralysis ride on explicit, modest chances across several types", () => {
    const effectMoves = ORIGINAL_MOVES.filter((m) => m.damageClass !== "status" && statusOf(m, m.expectedShape === "projectile" || m.expectedShape === "area" ? "area" : "melee"));
    expect(effectMoves.length).toBeGreaterThanOrEqual(25);
    for (const m of effectMoves) {
      expect(m.effectChance).not.toBeNull(); // null would mean a guaranteed status
      expect(m.effectChance).toBeGreaterThanOrEqual(10);
      expect(m.effectChance).toBeLessThanOrEqual(30);
      expect(["burn", "paralysis"]).toContain(statusOf(m, "area").kind);
    }
    expect(new Set(effectMoves.map((m) => m.type)).size).toBeGreaterThanOrEqual(5);
  });

  test("fire creatures carry a burning move in their default loadout", () => {
    for (const { c, set } of loadouts.filter(({ c }) => c.types[0] === "fire")) {
      expect(set.some((m) => m.type === "fire" && m.status?.kind === "burn")).toBe(true);
    }
  });
});
