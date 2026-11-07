import fs from "fs";
import path from "path";
import { ORIGINAL_CREATURES, ORIGINAL_MOVES, ORIGINAL_ABILITY_NAMES, ORIGINAL_LOTS, loadOriginalCreatures } from "@/content/original";
import { ROSTERS, ORIGINAL_TOTAL } from "@/lib/rosters";
import { computeStarterIds, isSealed } from "@/lib/unlocks";
import { classifyShape, statusOf, buildMoveset } from "@/game/moves";
import { isImplemented } from "@/game/abilities";
import { registerMoves } from "@/game/moveData";
import { prepareBattle } from "@/game/prebattle";
import { runHeadless } from "@/game/step";

const lot1 = ORIGINAL_CREATURES.filter((c) => c.lot === 1);
const lot2 = ORIGINAL_CREATURES.filter((c) => c.lot === 2);
const moveById = new Map(ORIGINAL_MOVES.map((m) => [m.id, m]));
const lot2MoveIds = new Set(lot2.flatMap((c) => c.moves.map((m) => m.id)));
const publicDir = path.resolve(__dirname, "../../../public");

describe("Original roster Lot 2", () => {
  test("adds 20 creatures after Lot 1 without disturbing it", () => {
    expect(lot1).toHaveLength(150);
    expect(lot2).toHaveLength(20);
    expect(ORIGINAL_LOTS).toEqual([1, 2]);
    expect(ORIGINAL_TOTAL).toBe(170);
    expect(ROSTERS.original.total).toBe(170);
    // The Reedlet grass line holds dex #1-#3; Lot 1's first family (Mossplod) moved to #151-#153.
    const dexOf = (list) => list.map((c) => c.dexNo).sort((a, b) => a - b);
    expect(dexOf(lot2)).toEqual([1, 2, 3, ...Array.from({ length: 17 }, (_, i) => i + 154)]);
    expect(dexOf(lot1)).toEqual(Array.from({ length: 150 }, (_, i) => i + 4));
    expect(dexOf(ORIGINAL_CREATURES)).toEqual(Array.from({ length: 170 }, (_, i) => i + 1));
    const ids = ORIGINAL_CREATURES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const orders = ORIGINAL_CREATURES.map((c) => c.displayOrder);
    expect(new Set(orders).size).toBe(orders.length);
    expect(Object.keys(loadOriginalCreatures())).toHaveLength(170);
  });

  test("every learnset move resolves and keeps its designed battle shape and status", () => {
    const moveIds = ORIGINAL_MOVES.map((m) => m.id);
    expect(new Set(moveIds).size).toBe(moveIds.length);
    for (const id of lot2MoveIds) {
      const m = moveById.get(id);
      expect(m).toBeDefined();
      expect(classifyShape(m)).toBe(m.expectedShape);
      expect(statusOf(m, m.expectedShape)?.kind ?? null).toBe(m.expectedStatus ?? null);
    }
  });

  test("abilities are implemented and use Original display names", () => {
    for (const c of lot2) {
      expect(c.abilities.some(isImplemented)).toBe(true);
      for (const a of c.abilities) expect(ORIGINAL_ABILITY_NAMES[a]?.name).toBeTruthy();
    }
  });

  test("evolution links stay inside the roster and point both ways", () => {
    const byId = loadOriginalCreatures();
    for (const c of lot2) {
      if (c.evolvesFrom != null) expect(byId[c.evolvesFrom].evolvesTo).toContain(c.id);
      for (const to of c.evolvesTo) expect(byId[to].evolvesFrom).toBe(c.id);
      expect([c.evolvesFrom, ...c.evolvesTo].filter((x) => x != null).every((x) => byId[x]?.lot === 2)).toBe(true);
    }
    const name = (id) => byId[id].displayName;
    expect(byId[100001].evolvesTo.map(name)).toEqual(["Thimblereed"]);
    expect(byId[100014].evolvesFrom).toBe(100013);
    expect(byId[100015].evolvesFrom).toBe(100014);
  });

  test("starters and sealed species follow the shared unlock rules", () => {
    const starters = computeStarterIds(loadOriginalCreatures());
    const names = lot2.filter((c) => starters.has(c.id)).map((c) => c.displayName);
    expect(names).toEqual(expect.arrayContaining(["Reedlet", "Cindrick", "Rillip", "Dewlume", "Wickit", "Pipshore", "Breakerbill", "Bastilimp", "Drakarn"]));
    expect(starters.has(100003)).toBe(false); // Sedgewarden is earned by evolving
    const bathyridge = lot2.find((c) => c.name === "bathyridge");
    expect(isSealed(bathyridge)).toBe(true);
    expect(starters.has(bathyridge.id)).toBe(false);
  });

  test("every Lot 2 creature has its packaged pixel-art files", () => {
    for (const c of lot2) {
      for (const url of [c.sprite, c.spriteBack, c.animFront, c.animBack]) {
        expect(url).toMatch(/^\/originals\/v1\/[a-z]+\/(front|back)\.(png|gif)\?v=[0-9a-f]{16}$/);
        expect(fs.existsSync(path.join(publicDir, url.split("?")[0]))).toBe(true);
      }
      expect(c.framesFront).toBeNull();
    }
  });

  test("default loadouts fill four slots without Struggle", () => {
    const moveMap = Object.fromEntries(ORIGINAL_MOVES.map((m) => [m.id, m]));
    for (const c of lot2) {
      const set = buildMoveset(c, moveMap);
      expect(set).toHaveLength(4);
      expect(set.every((m) => lot2MoveIds.has(m.id))).toBe(true);
    }
  });

  test("a headless battle between Lot 2 and Lot 1 runs to a result", async () => {
    registerMoves([{ id: 165, name: "struggle", type: "normal", power: 50, accuracy: null, damageClass: "physical", priority: 0, effectChance: null, effectText: "" }]);
    const creatures = loadOriginalCreatures();
    const playerIds = [100003, 100006, 100009, 100012, 100015, 100141];
    const npcIds = lot1.slice(0, 6).map((c) => c.id);
    const unlockedIds = new Set(Object.keys(creatures).map(Number));
    const state = await prepareBattle({ creatures, unlockedIds, playerIds, npcIds, terrainId: "pitch", seed: 4242, autoPick: true, decodeSprites: false, roster: "original", contentVersion: 1 });
    expect(state.teams.player.units.map((u) => u.creatureId)).toEqual(playerIds);
    const result = runHeadless(state);
    expect(state.phase).toBe("ended");
    expect(["player", "npc"]).toContain(state.winner);
    expect(result).toBeDefined();
  });
});
