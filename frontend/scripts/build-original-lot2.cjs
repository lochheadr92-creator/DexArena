// Builds Original roster Lot 2 from the hand-designed creatures in
// docs/original-creatures/designs (the possible-designs work) that have
// finished, reviewed sprite sets. Lot 1 (content/original/creatures.json) is
// not touched. Run from frontend/: node scripts/build-original-lot2.cjs
const fs = require("node:fs");
const path = require("node:path");

const frontend = path.resolve(__dirname, "..");
const designs = path.resolve(frontend, "../docs/original-creatures/designs");
const outDir = path.join(frontend, "src/content/original/lot2");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const roster = read(path.join(designs, "roster.json"));
const designMoves = read(path.join(designs, "moves.json"));
const assets = read(path.join(designs, "assets.json"));
const lot1 = read(path.join(frontend, "src/content/original/creatures.json"));
const lot1Moves = read(path.join(frontend, "src/content/original/moves.json"));

// Explicit membership, so art finished later joins a later lot instead of
// silently changing this one. Order = Lot 2 dex order.
const LOT2 = [
  100001, 100002, 100003, // Reedlet line
  100004, 100005, 100006, // Cindrick line
  100007, 100008, 100009, // Rillip line
  100010, 100011, 100012, // Dewlume line
  100013, 100014, 100015, // Wickit line
  100016, 100018,         // Pipshore, Breakerbill (Stiltide not drawn yet)
  100024,                 // Bastilimp (Pebblip, Turretide not drawn yet)
  100048,                 // Drakarn (Skarnip, Cragore not drawn yet)
  100141,                 // Bathyridge (legendary)
];

// Provisional in-game sizes (decimetres, hectograms); the designs left them blank.
const SIZE = {
  reedlet: [2, 8], thimblereed: [5, 32], sedgewarden: [9, 140],
  cindrick: [3, 25], scorchant: [6, 120], hearthorn: [10, 420],
  rillip: [3, 30], spindriftel: [7, 150], weirwhisk: [11, 480],
  dewlume: [2, 5], veilace: [5, 20], prismantis: [10, 60],
  wickit: [2, 6], clackindle: [5, 45], voltrivet: [9, 210],
  pipshore: [3, 12], breakerbill: [12, 260],
  bastilimp: [13, 1200], drakarn: [18, 1450], bathyridge: [40, 9500],
};

const byId = new Map(roster.map((c) => [c.id, c]));
const assetById = new Map(assets.map((a) => [a.id, a]));
const members = new Set(LOT2);
const lot1Ids = new Set(lot1.map((c) => c.id));
const lot1MoveIds = new Set(lot1Moves.map((m) => m.id));
// Dex layout: the first LOT2_LEADING Lot 2 creatures (the Reedlet grass line) take dex
// #1-#3 so the opening nine are grass / fire / water three-stage lines; Lot 1's own
// first family (Mossplod, still water) was moved to #151-#153. Every other Lot 2
// creature follows Lot 1 from #154. Lot 1's data file is not touched by this script.
const LOT2_LEADING = 3;
const LOT1_COUNT = lot1.length;
const fail = (msg) => {
  throw new Error(`build-original-lot2: ${msg}`);
};

const creatures = LOT2.map((id, i) => {
  const d = byId.get(id);
  const a = assetById.get(id);
  if (!d) fail(`unknown design ${id}`);
  if (lot1Ids.has(id)) fail(`id ${id} collides with Lot 1`);
  if (!a || a.status !== "complete" || !a.visualReview) fail(`${d.name} has no reviewed art (status ${a?.status})`);
  if (!SIZE[d.name]) fail(`${d.name} has no size`);
  const v = `?v=${a.assetVersion}`;
  const evolvesFrom = members.has(d.evolvesFrom) ? d.evolvesFrom : null;
  const evolvesTo = (d.evolvesTo || []).filter((t) => members.has(t));
  return {
    id: d.id,
    dexNo: i < LOT2_LEADING ? i + 1 : LOT1_COUNT + 1 + i,
    name: d.name,
    displayName: d.displayName,
    genus: d.animal,
    types: d.types,
    role: d.role,
    stats: d.stats,
    bst: d.bst,
    abilities: d.abilities,
    moves: d.moves.map(({ id: mid, name, level }) => ({ id: mid, name, level })),
    tmMoves: [],
    isBaby: d.isBaby,
    isLegendary: d.isLegendary,
    isMythical: d.isMythical,
    captureRate: d.isLegendary || d.isMythical ? 3 : 45,
    chainId: d.chainId,
    evolvesFrom,
    evolvesTo,
    evolution: null,
    generation: 0,
    height: SIZE[d.name][0],
    weight: SIZE[d.name][1],
    sprite: a.front + v,
    spriteBack: a.back + v,
    animFront: a.animatedFront + v,
    animBack: a.animatedBack + v,
    artwork: a.front + v,
    roster: "original",
    contentVersion: 1,
    displayOrder: i < LOT2_LEADING ? i + 1 : LOT1_COUNT + 1 + i,
    framesFront: null,
    framesBack: null,
    lot: 2,
    designNumber: d.number,
    habitat: d.habitat,
    description: d.description,
    // Earlier forms that exist in the designs but have no art yet.
    awaitingForms: [d.evolvesFrom, ...(d.evolvesTo || [])].filter((t) => t != null && !members.has(t)),
  };
});

const moveIds = new Set(creatures.flatMap((c) => c.moves.map((m) => m.id)));
const moves = designMoves
  .filter((m) => moveIds.has(m.id))
  .map((m) => {
    if (lot1MoveIds.has(m.id)) fail(`move ${m.id} collides with Lot 1`);
    return {
      id: m.id,
      priority: m.priority,
      name: m.name,
      type: m.type,
      power: m.power,
      accuracy: m.accuracy,
      damageClass: m.damageClass,
      effectChance: m.effectChance,
      effectText: m.effectText,
      expectedShape: m.expectedShape,
      expectedStatus: m.expectedStatus,
    };
  });
if (moves.length !== moveIds.size) fail("a learnset references a missing design move");

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "creatures.json"), JSON.stringify(creatures, null, 2) + "\n");
fs.writeFileSync(path.join(outDir, "moves.json"), JSON.stringify(moves, null, 2) + "\n");
console.log(`Lot 2: ${creatures.length} creatures (#${creatures.slice(0, LOT2_LEADING).map((c) => c.dexNo).join(",#")} and #${creatures[LOT2_LEADING].dexNo}-#${creatures.at(-1).dexNo}), ${moves.length} moves.`);
