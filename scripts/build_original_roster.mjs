// Build script: expands the blueprint into full Original Creatures content.
// Emits frontend/src/content/original/{creatures,moves,abilityNames,catalogue,manifest,distribution_report}.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { THREE, TWO, SINGLES, SEALED } from "./roster_blueprint.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "frontend", "src", "content", "original");
fs.mkdirSync(OUT, { recursive: true });

const TYPES = ["normal","fire","water","electric","grass","ice","fighting","poison","ground","flying","psychic","bug","rock","ghost","dragon","dark","steel"];

// deterministic hash → 0..1
const hash = (s) => { let h = 2166136261; for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h,16777619);} return ((h>>>0)%100000)/100000; };

// ---------------- MOVE POOL ----------------
const ADJ = { normal:"Echo", fire:"Flame", water:"Tidal", electric:"Volt", grass:"Thorn", ice:"Frost", fighting:"Combat", poison:"Venom", ground:"Terra", flying:"Gale", psychic:"Mind", bug:"Swarm", rock:"Boulder", ghost:"Phantom", dragon:"Draco", dark:"Shadow", steel:"Iron" };
const PROJ = { normal:"Shot", fire:"Bolt", water:"Cannon", electric:"Bolt", grass:"Ray", ice:"Beam", fighting:"Shot", poison:"Shot", ground:"Cannon", flying:"Shot", psychic:"Beam", bug:"Shot", rock:"Cannon", ghost:"Ray", dragon:"Pulse", dark:"Pulse", steel:"Cannon" };
const AREA = { normal:"Burst", fire:"Nova", water:"Flood", electric:"Storm", grass:"Bloom", ice:"Blizzard", fighting:"Barrage", poison:"Cloud", ground:"Quake", flying:"Gust", psychic:"Rift", bug:"Hive", rock:"Fracture", ghost:"Veil", dragon:"Tempest", dark:"Void", steel:"Field" };
const MELEE = { normal:"Pound", fire:"Claw", water:"Jab", electric:"Jab", grass:"Lash", ice:"Shard", fighting:"Strike", poison:"Jab", ground:"Swipe", flying:"Peck", psychic:"Smash", bug:"Pincer", rock:"Crush", ghost:"Claw", dragon:"Rend", dark:"Bite", steel:"Chop" };
const DASH = { normal:"Tackle", fire:"Charge", water:"Rush", electric:"Dash", grass:"Slam", ice:"Charge", fighting:"Rush", poison:"Slam", ground:"Slam", flying:"Rush", psychic:"Charge", bug:"Tackle", rock:"Slam", ghost:"Charge", dragon:"Rush", dark:"Charge", steel:"Slam" };
const STATUS_TYPE = { fire:"burn", electric:"paralyze" }; // which types' projectile may inflict a status

let MID = 20001;
const moves = [];
const poolByType = {};
const addMove = (m) => { const mv = { id: MID++, priority: 0, ...m }; moves.push(mv); return mv; };

for (const T of TYPES) {
  const burnTxt = STATUS_TYPE[T] === "burn" ? " and may leave the target with a burn" : "";
  const paraTxt = STATUS_TYPE[T] === "paralyze" ? " and may paralyze the target" : "";
  const statusTxt = burnTxt || paraTxt;
  const chance = statusTxt ? 20 : null;
  poolByType[T] = {
    projectile: addMove({ name: `${ADJ[T]} ${PROJ[T]}`, type: T, power: 85, accuracy: 100, damageClass: "special", effectChance: chance, effectText: `Fires a focused ${T} projectile${statusTxt}.` }),
    area: addMove({ name: `${ADJ[T]} ${AREA[T]}`, type: T, power: 70, accuracy: 95, damageClass: "special", effectChance: null, effectText: `Erupts a wide ${T} blast around the target zone.` }),
    melee: addMove({ name: `${ADJ[T]} ${MELEE[T]}`, type: T, power: 80, accuracy: 100, damageClass: "physical", effectChance: null, effectText: `A close-range ${T} blow.` }),
    dash: addMove({ name: `${ADJ[T]} ${DASH[T]}`, type: T, power: 72, accuracy: 95, damageClass: "physical", effectChance: null, effectText: `Charges the foe with a ${T}-powered rush.` }),
  };
}
// shared status moves
const SHIELD = addMove({ name: "Aegis Ward", type: "normal", power: 0, accuracy: null, damageClass: "status", effectChance: null, effectText: "Raises its Defense and forms a protective barrier." });
const BUFF = addMove({ name: "Battle Rouse", type: "normal", power: 0, accuracy: null, damageClass: "status", effectChance: null, effectText: "Sharply raises its Attack or Speed." });
const SHIELD2 = addMove({ name: "Stonewall", type: "normal", power: 0, accuracy: null, damageClass: "status", effectChance: null, effectText: "Hardens its guard behind a sturdy barrier." });
const BUFF2 = addMove({ name: "Adrenal Surge", type: "normal", power: 0, accuracy: null, damageClass: "status", effectChance: null, effectText: "Floods with adrenaline, sharply raising its edge." });

// coverage affinity: sensible off-type damage per primary type
const COVER = {
  normal: ["fighting","rock"], fire: ["ground","rock"], water: ["ice","ground"], electric: ["steel","flying"],
  grass: ["ground","rock"], ice: ["flying","dragon"], fighting: ["rock","dark"], poison: ["ground","psychic"],
  ground: ["rock","fire"], flying: ["fighting","grass"], psychic: ["fighting","ghost"], bug: ["grass","dark"],
  rock: ["ground","fire"], ghost: ["psychic","dark"], dragon: ["fire","flying"], dark: ["ghost","fighting"], steel: ["rock","ice"],
};

// ---------------- ABILITY POOL ----------------
// implemented slug -> original display name + desc (mechanic preserved)
const ABILITY_NAMES = {
  blaze: { name: "Emberheart", desc: "Below ⅓ HP, Fire moves deal ×1.5 damage." },
  torrent: { name: "Tidecaller", desc: "Below ⅓ HP, Water moves deal ×1.5 damage." },
  overgrow: { name: "Verdant Fury", desc: "Below ⅓ HP, Grass moves deal ×1.5 damage." },
  swarm: { name: "Hivemind", desc: "Below ⅓ HP, Bug moves deal ×1.5 damage." },
  intimidate: { name: "Dreadroar", desc: "On entry, cows the foe — its Attack drops until it switches." },
  "huge-power": { name: "Titan Grip", desc: "Attack is doubled." },
  guts: { name: "Tenacity", desc: "Attack ×1.5 while burned or paralysed." },
  "iron-fist": { name: "Heavy Hands", desc: "Striking moves deal ×1.2 damage." },
  technician: { name: "Finesse", desc: "Weaker moves (60 power or less) deal ×1.5 damage." },
  adaptability: { name: "Zealot", desc: "Same-type attack bonus is ×2 instead of ×1.5." },
  "compound-eyes": { name: "Keen Eye", desc: "Move accuracy ×1.3." },
  "serene-grace": { name: "Twin Fate", desc: "Burn and paralysis chances are doubled." },
  "mold-breaker": { name: "Breaker", desc: "Moves ignore the foe's defensive abilities." },
  "no-guard": { name: "Deadeye", desc: "Every move by or against it lands — no misses, no dodges." },
  sturdy: { name: "Bedrock", desc: "Survives any single hit from full HP with 1 HP left." },
  levitate: { name: "Skyborne", desc: "Hovers: immune to Ground moves and tile effects." },
  "wonder-guard": { name: "Spectral Ward", desc: "Only super-effective moves can deal damage." },
  "thick-fat": { name: "Blubber", desc: "Fire and Ice damage taken ×0.5." },
  heatproof: { name: "Cinderproof", desc: "Fire damage taken ×0.5." },
  filter: { name: "Dampen", desc: "Super-effective damage taken ×0.75." },
  "solid-rock": { name: "Granite Hide", desc: "Super-effective damage taken ×0.75." },
  "water-absorb": { name: "Thirst", desc: "Immune to Water moves and heals ¼ HP when hit by one." },
  "volt-absorb": { name: "Conduct", desc: "Immune to Electric moves and heals ¼ HP when hit by one." },
  "flash-fire": { name: "Kindle", desc: "Immune to Fire; being hit by one powers up its Fire moves." },
  "motor-drive": { name: "Overclock", desc: "Immune to Electric; being hit by one raises its Speed." },
  "dry-skin": { name: "Porous", desc: "Absorbs Water, weak to Fire; heals in rain, hurts in sun." },
  "clear-body": { name: "Composure", desc: "Its stats cannot be lowered by Intimidate." },
  limber: { name: "Loose Joints", desc: "Cannot be paralysed." },
  "water-veil": { name: "Coolant", desc: "Cannot be burned." },
  static: { name: "Livewire", desc: "30% chance to paralyse attackers that make contact." },
  "flame-body": { name: "Cinderskin", desc: "30% chance to burn attackers that make contact." },
  "effect-spore": { name: "Spore Cloud", desc: "30% chance to burn or paralyse attackers on contact." },
  "rough-skin": { name: "Barbed Hide", desc: "Attackers that make contact lose ⅛ of their HP." },
  aftermath: { name: "Last Spite", desc: "When KO'd by a contact move, the attacker loses ¼ HP." },
  "speed-boost": { name: "Quickening", desc: "Speed rises every few seconds while out." },
  "marvel-scale": { name: "Scaleguard", desc: "Defence ×1.5 while burned or paralysed." },
  "quick-feet": { name: "Fleetfoot", desc: "Speed ×1.5 while burned or paralysed." },
  "natural-cure": { name: "Mend", desc: "Burn and paralysis are cured when it switches out." },
  "shed-skin": { name: "Molt", desc: "May shrug off burn or paralysis over time." },
  "magic-guard": { name: "Charmward", desc: "Only takes damage from direct attacks — no chip." },
  synchronize: { name: "Reflection", desc: "Passes any burn or paralysis it receives back to the foe." },
  chlorophyll: { name: "Sunchaser", desc: "Much faster in harsh sunlight or on the grass Pitch." },
  "swift-swim": { name: "Streamline", desc: "Much faster in rain or on water tiles." },
  "sand-veil": { name: "Dustveil", desc: "+20% dodge in sandstorms or the Cavern; immune to sand chip." },
  "snow-cloak": { name: "Frostveil", desc: "+20% dodge in hail or on snow; immune to hail chip." },
  "ice-body": { name: "Permafrost", desc: "Heals in hail or on snow and ice; immune to hail chip." },
  "rain-dish": { name: "Raincatch", desc: "Heals in rain or on water tiles." },
  hydration: { name: "Rinse", desc: "Cures burn and paralysis in rain or on water." },
  drizzle: { name: "Stormcall", desc: "Summons rain on entry: Water ×1.3, Fire ×0.7." },
  drought: { name: "Sunflare", desc: "Summons harsh sunlight on entry: Fire ×1.3, Water ×0.7." },
  "sand-stream": { name: "Sandcaller", desc: "Summons a sandstorm on entry." },
  "snow-warning": { name: "Snowcaller", desc: "Summons hail on entry." },
  pressure: { name: "Overbearing", desc: "The foe's move cooldowns are 25% longer." },
  frisk: { name: "Insight", desc: "On entry, reveals the rival's whole hidden team." },
  "leaf-guard": { name: "Sunward", desc: "Cannot be burned or paralysed in sun or on the Pitch." },
};

const PINCH = { fire: "blaze", water: "torrent", grass: "overgrow", bug: "swarm" };
const TYPE_ABIL = {
  normal: ["technician", "adaptability", "guts"],
  fire: ["flash-fire", "flame-body", "drought"],
  water: ["swift-swim", "water-absorb", "rain-dish", "hydration"],
  electric: ["static", "volt-absorb", "motor-drive"],
  grass: ["chlorophyll", "natural-cure", "leaf-guard"],
  ice: ["snow-cloak", "ice-body", "thick-fat"],
  fighting: ["guts", "iron-fist", "no-guard"],
  poison: ["effect-spore", "shed-skin", "synchronize"],
  ground: ["sand-veil", "sand-stream", "solid-rock"],
  flying: ["speed-boost", "compound-eyes"],
  psychic: ["magic-guard", "synchronize", "levitate"],
  bug: ["compound-eyes", "swarm", "rough-skin"],
  rock: ["sturdy", "solid-rock", "sand-veil"],
  ghost: ["levitate", "magic-guard", "pressure"],
  dragon: ["marvel-scale", "sturdy", "mold-breaker"],
  dark: ["intimidate", "quick-feet", "frisk"],
  steel: ["sturdy", "clear-body", "heatproof"],
};
const ROLE_ABIL = {
  phys: ["huge-power", "guts", "iron-fist", "intimidate"],
  spec: ["adaptability", "technician", "serene-grace"],
  bulk: ["sturdy", "thick-fat", "marvel-scale", "filter"],
  fast: ["speed-boost", "quick-feet", "motor-drive"],
  bal: ["technician", "intimidate", "marvel-scale"],
  util: ["natural-cure", "shed-skin", "magic-guard", "frisk"],
};

function pickAbilities(c) {
  const [p, s] = c.types;
  const cands = [];
  if (PINCH[p]) cands.push(PINCH[p]);
  (TYPE_ABIL[p] || []).forEach((a) => cands.push(a));
  if (s) (TYPE_ABIL[s] || []).forEach((a) => cands.push(a));
  (ROLE_ABIL[c.role] || []).forEach((a) => cands.push(a));
  // dedupe preserving order, keep only ones we have original names for
  const uniq = [...new Set(cands)].filter((a) => ABILITY_NAMES[a]);
  if (!uniq.length) uniq.push("technician");
  const r = hash(c.name + "ab");
  const first = uniq[Math.floor(r * uniq.length) % uniq.length];
  const rest = uniq.filter((a) => a !== first);
  // ~55% of creatures get a 2nd ability choice
  const two = rest.length && hash(c.name + "two") > 0.45;
  return two ? [first, rest[Math.floor(hash(c.name + "ab2") * rest.length) % rest.length]] : [first];
}

// ---------------- STATS ----------------
const WEIGHTS = {
  phys: { hp: .17, atk: .26, def: .17, spa: .07, spd: .13, spe: .20 },
  spec: { hp: .17, atk: .07, def: .13, spa: .26, spd: .17, spe: .20 },
  bulk: { hp: .22, atk: .15, def: .22, spa: .11, spd: .20, spe: .10 },
  fast: { hp: .13, atk: .18, def: .11, spa: .18, spd: .12, spe: .28 },
  bal: { hp: .17, atk: .17, def: .17, spa: .17, spd: .16, spe: .16 },
  util: { hp: .20, atk: .12, def: .18, spa: .16, spd: .20, spe: .14 },
};
function bstFor(kind, name) {
  const base = { s1_3: 310, s2_3: 405, s3_3: 520, s1_2: 320, s2_2: 450, single: 450, legendary: 620, mythical: 600 }[kind];
  return base + Math.round((hash(name + "bst") - 0.5) * 30);
}
function statsFor(role, bst, name) {
  const w = WEIGHTS[role] || WEIGHTS.bal;
  const out = {};
  for (const k of ["hp", "atk", "def", "spa", "spd", "spe"]) {
    const jitter = 1 + (hash(name + k) - 0.5) * 0.14;
    out[k] = Math.max(25, Math.round(bst * w[k] * jitter));
  }
  return out;
}

// ---------------- LEARNSET ----------------
// Produces a learnset that, through buildMoveset, yields exactly 4 usable moves
// with varied shapes — and guarantees shield/buff usage on bulk/util/fast roles.
function learnset(c) {
  const [p, s] = c.types;
  const special = c.role === "spec" || c.role === "util" || (c.role === "fast" && hash(c.name) > 0.5);
  const dmg = [];
  const pushd = (m) => { if (m && !dmg.includes(m)) dmg.push(m); };
  if (special) { pushd(poolByType[p].projectile); pushd(poolByType[p].area); }
  else { pushd(poolByType[p].melee); pushd(poolByType[p].dash); }
  if (s) pushd(special ? poolByType[s].projectile : poolByType[s].melee);
  const cov = COVER[p] || ["normal", "normal"];
  pushd(special ? poolByType[cov[0]].projectile : poolByType[cov[0]].melee);
  pushd(special ? poolByType[cov[1]].area : poolByType[cov[1]].dash);
  const target = c.role === "util" ? 2 : (c.role === "bulk" || c.role === "fast") ? 3 : 4;
  const picks = dmg.slice(0, Math.max(2, target));
  if (c.role === "util") picks.push(SHIELD, BUFF);
  else if (c.role === "bulk") picks.push(hash(c.name) > 0.5 ? SHIELD : SHIELD2);
  else if (c.role === "fast") picks.push(hash(c.name) > 0.5 ? BUFF : BUFF2);
  return picks.map((m, i) => ({ id: m.id, name: m.name, level: 8 + i * 6 }));
}

// ---------------- ASSEMBLE ----------------
let CID = 10001;
let dex = 0;
const creatures = [];
function emit(stageDef, role, { rarity = null, evolvesFrom = null, isFinalPlaceholder = false } = {}) {
  dex += 1;
  const id = CID++;
  const name = stageDef.n;
  const c = {
    id, dexNo: dex,
    name: name.toLowerCase(),
    displayName: name,
    genus: stageDef.base || "",
    types: [...stageDef.t],
    role,
    bstKind: stageDef.bstKind,
    stats: null, bst: 0,
    abilities: [],
    moves: [],
    tmMoves: [],
    isBaby: false,
    isLegendary: rarity === "legendary",
    isMythical: rarity === "mythical",
    captureRate: rarity ? 3 : 45,
    chainId: stageDef.chainId,
    evolvesFrom,
    evolvesTo: [],
    evolution: null,
    generation: 0,
    height: 10 + Math.round(hash(name + "h") * 40),
    weight: 50 + Math.round(hash(name + "w") * 2000),
    sprite: `/original/o${String(dex).padStart(3, "0")}-front.png`,
    spriteBack: `/original/o${String(dex).padStart(3, "0")}-back.png`,
    animFront: null,
    animBack: null,
    artwork: `/original/o${String(dex).padStart(3, "0")}-front.png`,
    roster: "original",
    contentVersion: 1,
  };
  const bst = bstFor(stageDef.bstKind, name);
  c.stats = statsFor(role, bst, name);
  c.bst = Object.values(c.stats).reduce((a, b) => a + b, 0);
  creatures.push(c);
  return c;
}

let chain = 0;
for (const fam of THREE) {
  chain += 1;
  const kinds = ["s1_3", "s2_3", "s3_3"];
  const made = [];
  fam.stages.forEach((st, i) => { st.bstKind = kinds[i]; st.base = fam.base; st.chainId = chain; made.push(emit(st, fam.role, { evolvesFrom: i ? made[i - 1].id : null })); });
  made[0].evolvesTo = [made[1].id]; made[1].evolvesTo = [made[2].id];
}
for (const fam of TWO) {
  chain += 1;
  const kinds = ["s1_2", "s2_2"];
  const made = [];
  fam.stages.forEach((st, i) => { st.bstKind = kinds[i]; st.base = fam.base; st.chainId = chain; made.push(emit(st, fam.role, { evolvesFrom: i ? made[i - 1].id : null })); });
  made[0].evolvesTo = [made[1].id];
}
for (const s of SINGLES) { chain += 1; emit({ n: s.n, t: s.t, base: s.base, bstKind: "single", chainId: chain }, s.role, {}); }
for (const s of SEALED) { chain += 1; emit({ n: s.n, t: s.t, base: s.lore, bstKind: s.rarity, chainId: chain }, s.role, { rarity: s.rarity }); }

// abilities + learnsets (needs full map for evolve lookups)
for (const c of creatures) { c.abilities = pickAbilities(c); c.moves = learnset(c); }

// ---------------- DISTRIBUTION REPORT ----------------
const ref = JSON.parse(fs.readFileSync(path.join(__dirname, "reference_distribution.json"), "utf8"));
const typeCount = {}; TYPES.forEach((t) => (typeCount[t] = 0));
creatures.forEach((c) => c.types.forEach((t) => typeCount[t]++));
const single = creatures.filter((c) => c.types.length === 1).length;
const dual = creatures.filter((c) => c.types.length === 2).length;
const sealed = creatures.filter((c) => c.isLegendary || c.isMythical).length;
const legendary = creatures.filter((c) => c.isLegendary).length;
const mythical = creatures.filter((c) => c.isMythical).length;
const stageOf = (c) => { let s = 1, cur = c; const byId = Object.fromEntries(creatures.map((x) => [x.id, x])); while (cur.evolvesFrom && byId[cur.evolvesFrom]) { cur = byId[cur.evolvesFrom]; s++; } return s; };
const stageCount = {}; creatures.forEach((c) => { const s = stageOf(c); stageCount[s] = (stageCount[s] || 0) + 1; });
const bstByTier = {};
const bucket = (k, v) => ((bstByTier[k] ||= []).push(v));
creatures.forEach((c) => { if (c.isLegendary || c.isMythical) bucket("rare", c.bst); else bucket(`stage${stageOf(c)}`, c.bst); });
const summ = (a) => { if (!a) return null; const s = [...a].sort((x, y) => x - y); return { n: s.length, min: s[0], max: s[s.length - 1], median: s[Math.floor(s.length / 2)], mean: Math.round(s.reduce((x, y) => x + y, 0) / s.length) }; };
const refType = Object.fromEntries(ref.typeTable.map((r) => [r.type, r.target150]));
const typeTable = TYPES.map((t) => ({ type: t, target: refType[t] ?? 0, actual: typeCount[t], dev: typeCount[t] - (refType[t] ?? 0) })).sort((a, b) => b.actual - a.actual);
const report = {
  species: creatures.length,
  single, dual, singleTarget: ref.scaledTargets.single, dualTarget: ref.scaledTargets.dual,
  sealed, legendary, mythical, sealedTarget: 11,
  stageCount, stageTarget: ref.scaledTargets.stageCount,
  typeTable,
  bstByTier: Object.fromEntries(Object.entries(bstByTier).map(([k, v]) => [k, summ(v)])),
  bstTarget: ref.bstByTier,
  moves: moves.length,
};

// ---------------- CATALOGUE + MANIFEST ----------------
const byId = Object.fromEntries(creatures.map((c) => [c.id, c]));
const catalogue = creatures.map((c) => ({
  dexNo: c.dexNo, name: c.displayName, types: c.types,
  family: c.chainId, stage: stageOf(c),
  rarity: c.isLegendary ? "legendary" : c.isMythical ? "mythical" : "ordinary",
  bst: c.bst, stats: c.stats,
  abilities: c.abilities.map((a) => ABILITY_NAMES[a]?.name || a),
  evolvesFrom: c.evolvesFrom ? byId[c.evolvesFrom].displayName : null,
  evolvesTo: c.evolvesTo.map((id) => byId[id].displayName),
}));
const manifest = creatures.map((c) => ({ dexNo: c.dexNo, name: c.displayName, front: c.sprite, back: c.spriteBack, hasArt: false }));

fs.writeFileSync(path.join(OUT, "creatures.json"), JSON.stringify(creatures, null, 2));
fs.writeFileSync(path.join(OUT, "moves.json"), JSON.stringify(moves, null, 2));
fs.writeFileSync(path.join(OUT, "abilityNames.json"), JSON.stringify(ABILITY_NAMES, null, 2));
fs.writeFileSync(path.join(OUT, "catalogue.json"), JSON.stringify(catalogue, null, 2));
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(OUT, "distribution_report.json"), JSON.stringify(report, null, 2));

console.log(JSON.stringify(report, null, 2));
console.log(`\nWrote ${creatures.length} creatures, ${moves.length} moves to ${OUT}`);
