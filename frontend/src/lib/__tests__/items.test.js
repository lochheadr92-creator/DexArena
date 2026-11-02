import { buildCatalog, optionsFor, rollDrop, applyEvolutionItem, isItemLocked, evolutionItemFor, consumeItem, addItem } from "@/lib/items";
import { creditBattle, pendingUnlocks } from "@/lib/progression";
import { encodeReplay, decodeReplay } from "@/lib/replay";

const mk = (id, name, from = null, evolution = null, extra = {}) => ({ id, name: name.toLowerCase(), displayName: name, evolvesFrom: from, evolvesTo: [], evolution, isLegendary: false, isMythical: false, bst: 300, ...extra });
const creatures = {
  25: mk(25, "Pikachu", 172, { trigger: "level-up", minHappiness: 220 }),
  26: mk(26, "Raichu", 25, { trigger: "use-item", item: "thunder-stone" }),
  133: mk(133, "Eevee"),
  134: mk(134, "Vaporeon", 133, { trigger: "use-item", item: "water-stone" }),
  196: mk(196, "Espeon", 133, { trigger: "level-up", minHappiness: 220, timeOfDay: "day" }),
  79: mk(79, "Slowpoke"),
  80: mk(80, "Slowbro", 79, { trigger: "level-up", minLevel: 37 }),
  199: mk(199, "Slowking", 79, { trigger: "trade", heldItem: "kings-rock" }),
  1: mk(1, "Bulbasaur"),
  2: mk(2, "Ivysaur", 1, { trigger: "level-up", minLevel: 16 }),
};
const unlocked = new Set([25, 133, 79, 1]);
const baseSave = { version: 1, totalWins: 0, totalBattles: 0, unlocked: [], team: [25, 133, 79, 1, 2, 80], speciesWins: {}, speciesKoCredit: {}, speciesStandingCredit: {}, lastCreditedBattle: null, items: {}, gauntlet: { runs: 0, clears: 0, bestStage: 0, active: null } };

describe("evolution items", () => {
  const catalog = buildCatalog(creatures);

  test("catalog derives PokeAPI use-item, trade-held and custom branch items", () => {
    const ids = catalog.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["thunder-stone", "water-stone", "kings-rock", "sun-shard"]));
    expect(catalog.find((c) => c.id === "kings-rock").targets).toEqual([{ from: 79, to: 199 }]);
    expect(catalog.find((c) => c.id === "sun-shard").source).toBe("custom");
    expect(evolutionItemFor(creatures[196])).toBe("sun-shard");
    expect(isItemLocked(creatures[2])).toBe(false);
    expect(isItemLocked(creatures[80])).toBe(false);
    expect(optionsFor(133, catalog).map((o) => o.to).sort()).toEqual([134, 196]);
  });

  test("item-locked forms never unlock through win thresholds", () => {
    expect(pendingUnlocks(creatures, unlocked, { 25: 99, 133: 99, 79: 99, 1: 99 })).toEqual([2, 80]);
  });

  test("drop roll is seeded, respects chance, guarantee and rare-only", () => {
    const a = rollDrop({ seed: 7, catalog, teamIds: [25], unlockedIds: unlocked });
    const b = rollDrop({ seed: 7, catalog, teamIds: [25], unlockedIds: unlocked });
    expect(a).toBe(b);
    let hits = 0;
    for (let s = 0; s < 400; s++) if (rollDrop({ seed: s, catalog, teamIds: [25], unlockedIds: unlocked })) hits++;
    expect(hits / 400).toBeGreaterThan(0.25);
    expect(hits / 400).toBeLessThan(0.45);
    expect(rollDrop({ seed: 3, catalog, teamIds: [25], unlockedIds: unlocked, guaranteed: true })).toBeTruthy();
    const rare = rollDrop({ seed: 3, catalog, teamIds: [25], unlockedIds: unlocked, guaranteed: true, rareOnly: true });
    expect(catalog.find((c) => c.id === rare).rare).toBe(true);
  });

  test("weighting favours items the current team can use", () => {
    const counts = {};
    for (let s = 0; s < 300; s++) {
      const d = rollDrop({ seed: s, catalog, teamIds: [25], unlockedIds: new Set([25]), guaranteed: true });
      counts[d] = (counts[d] || 0) + 1;
    }
    expect(counts["thunder-stone"]).toBeGreaterThan(counts["kings-rock"] || 0);
  });

  test("creditBattle adds the drop once and never on a loss", () => {
    const win = creditBattle(baseSave, { win: true, playerIds: [25], battleId: "b1", seed: 3, catalog, drop: { guaranteed: true } }, creatures, unlocked);
    expect(win.drop).toBeTruthy();
    expect(win.save.items[win.drop]).toBe(1);
    const again = creditBattle(win.save, { win: true, playerIds: [25], battleId: "b1", seed: 3, catalog, drop: { guaranteed: true } }, creatures, unlocked);
    expect(again.credited).toBe(false);
    const loss = creditBattle(baseSave, { win: false, playerIds: [25], battleId: "b2", seed: 3, catalog, drop: { guaranteed: true } }, creatures, unlocked);
    expect(loss.drop).toBeNull();
    expect(loss.save.items).toEqual({});
  });

  test("using an item consumes it and unlocks exactly the chosen branch", () => {
    const save = addItem(baseSave, "thunder-stone");
    const ok = applyEvolutionItem(save, { itemId: "thunder-stone", fromId: 25, toId: 26 }, catalog);
    expect(ok.error).toBeNull();
    expect(ok.save.unlocked).toEqual([26]);
    expect(ok.save.items).toEqual({});
    expect(applyEvolutionItem(save, { itemId: "thunder-stone", fromId: 1, toId: 2 }, catalog).error).toMatch(/does not work/);
    expect(applyEvolutionItem(baseSave, { itemId: "thunder-stone", fromId: 25, toId: 26 }, catalog).error).toMatch(/do not have/);
    expect(consumeItem(addItem(baseSave, "water-stone", 2), "water-stone").items).toEqual({ "water-stone": 1 });
  });

  test("replay payload encodes item inputs and original species", () => {
    const unit = (id, from = null) => ({ creatureId: id, evolvedFrom: from, moves: [{ id: 1 }], originalMoves: from ? [{ id: 2 }] : undefined });
    const state = {
      seed: 5,
      terrain: { id: "pitch" },
      meta: { archetype: "brawler", slot: 2 },
      teams: { player: { units: [unit(26, 25), unit(1), unit(1), unit(1), unit(1), unit(1)] }, npc: { units: Array(6).fill(unit(4)) } },
      initialAutoPick: true,
      inputLog: [{ tick: 120, type: "item", index: 0, itemId: "thunder-stone" }],
    };
    const d = decodeReplay(encodeReplay(state));
    expect(d.playerIds[0]).toBe(25);
    expect(d.movesetOverrides[25]).toEqual([2]);
    expect(d.replayInputs).toEqual([{ tick: 120, type: "item", side: "player", index: 0, itemId: "thunder-stone" }]);
  });
});

describe("normalizeSave sanitizes new fields", () => {
  const { normalizeSave } = require("@/lib/save");
  test("clamps rivalLevel and drops bad items", () => {
    const s = normalizeSave({ version: 1, rivalLevel: 99, items: { "thunder-stone": -5, "fake item": 2, "water-stone": 2, "fire-stone": 1.5 } });
    expect(s.rivalLevel).toBe(6);
    expect(s.items).toEqual({ "water-stone": 2 });
    expect(normalizeSave({ version: 1 }).rivalLevel).toBe(2);
    expect(normalizeSave({ version: 1, rivalLevel: "0" }).rivalLevel).toBe(1);
  });
});
