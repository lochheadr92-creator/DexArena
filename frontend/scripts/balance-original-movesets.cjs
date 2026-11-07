// Balances the default move loadouts of the Original roster (Lot 1 and Lot 2).
//
// Problem it fixes: 105/150 Lot 1 creatures could only melee/dash and 35 could only shoot, so
// ranged-only creatures beat close-only ones ~96% of the time in 1v1, fire/water/grass
// creatures often had no fire/water/grass ranged move, and shield/buff/status effects were
// rare. Every creature now gets, by combat role:
//   - at least one own-type RANGED and one own-type CLOSE damaging move,
//   - a shield or buff move (3 damaging + 1 status),
// and burn/paralysis now ride on more types. Only data is changed: game/engine code,
// engine.json and the legacy Pokemon roster are untouched.
//
// Run from frontend/ AFTER build-original-lot2.cjs (that script regenerates Lot 2 learnsets):
//   node scripts/balance-original-movesets.cjs [--proj-acc N] [--area-acc N] [--melee-acc N] [--dash-acc N] [--check]
// It is idempotent: loadouts are derived from type + role only, never from earlier loadouts.
const fs = require("node:fs");
const path = require("node:path");

const dir = path.resolve(__dirname, "../src/content/original");
const cfgDir = path.resolve(__dirname, "../src/game/config");
const args = process.argv.slice(2);
const argNum = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};
const CHECK_ONLY = args.includes("--check");

// ---- calibration (accuracy is a hit chance in the engine; DPS per move is otherwise flat) ----
const ACC = {
  projectile: argNum("--proj-acc", 80),
  area: argNum("--area-acc", 75),
  melee: argNum("--melee-acc", 100),
  dash: argNum("--dash-acc", 100),
};
// Side effects: only burn and paralysis exist in the engine (shapeMapping.statusKeywords).
const EFFECTS = {
  fire: { kind: "burn", chance: 20, text: "May leave the target with a burn." },
  electric: { kind: "paralysis", chance: 20, text: "May paralyze the target, slowing it." },
  ice: { kind: "paralysis", chance: 15, text: "A numbing chill that may paralyze the target." },
  poison: { kind: "paralysis", chance: 15, text: "Numbing venom that may paralyze the target." },
  ghost: { kind: "paralysis", chance: 15, text: "A dread that may paralyze the target." },
};

const readRaw = (f) => fs.readFileSync(f, "utf8");
const load = (f) => {
  const raw = readRaw(f);
  return { file: f, data: JSON.parse(raw), eol: raw.includes("\r\n") ? "\r\n" : "\n" };
};
const ser = (o) => JSON.stringify(o.data, null, 2).replace(/\n/g, o.eol) + o.eol;
const lot1c = load(path.join(dir, "creatures.json"));
const lot1m = load(path.join(dir, "moves.json"));
const lot2c = load(path.join(dir, "lot2/creatures.json"));
const lot2m = load(path.join(dir, "lot2/moves.json"));
const shapeMapping = JSON.parse(readRaw(path.join(cfgDir, "shapeMapping.json")));

const includesAny = (s, keys) => keys.some((k) => s.includes(k));
function shapeOf(m) {
  const name = m.name.toLowerCase().replace(/-/g, " ");
  const text = (m.effectText || "").toLowerCase();
  if (m.damageClass === "special") return (m.power || 0) >= shapeMapping.specialProjectilePower && includesAny(name, shapeMapping.projectileKeywords) ? "projectile" : "area";
  if (m.damageClass === "physical") return includesAny(name, shapeMapping.dashKeywords) ? "dash" : "melee";
  return includesAny(text, shapeMapping.shieldKeywords) ? "shield" : "buff";
}
const isDamaging = (m) => m.damageClass !== "status" && (m.power || 0) > 0;

// ---- Lot 2: add the missing ranged moves (design naming: <prefix>-shot / <prefix>-bloom) ----
const PREFIX = { grass: "briar", fire: "cinder", water: "rill", electric: "arc", ground: "loam", flying: "zephyr", bug: "chitin", rock: "shale", dragon: "elder", steel: "rivet", normal: "hearth" };
const TYPE_WORD = { grass: "briar", fire: "cinder", water: "rill", electric: "arc", ground: "loam", flying: "zephyr", bug: "chitin", rock: "shale", dragon: "elder", steel: "rivet", normal: "hearth" };
let nextLot2Id = 200101;
const lot2Names = new Set(lot2m.data.map((m) => m.name));
const addLot2Move = (name, type, damageClass, power, accuracy, text, expectedShape) => {
  if (lot2Names.has(name)) return;
  while (lot2m.data.some((m) => m.id === nextLot2Id) || lot1m.data.some((m) => m.id === nextLot2Id)) nextLot2Id++;
  lot2m.data.push({ id: nextLot2Id++, priority: 0, name, type, power, accuracy, damageClass, effectChance: null, effectText: text, expectedShape, expectedStatus: null });
  lot2Names.add(name);
};
for (const [type, p] of Object.entries(PREFIX)) {
  const art = /^[aeiou]/.test(type) ? "An" : "A";
  addLot2Move(`${p}-shot`, type, "special", 60, 100, `${art} quick ${type} projectile.`, "projectile");
  addLot2Move(`${p}-bloom`, type, "special", 85, 100, `${art} ${type} burst around the target zone.`, "area");
}

// ---- effects + accuracy on the damaging moves of both lots ----
function tuneMoves(movesObj, lot) {
  for (const m of movesObj.data) {
    if (!isDamaging(m)) continue;
    const shape = lot === 2 ? m.expectedShape || shapeOf(m) : shapeOf(m);
    // Accuracy calibration only touches the catalogue shots/blasts; designed melee keeps its numbers.
    if (shape === "projectile" || shape === "area") m.accuracy = ACC[shape];
    if (lot === 1 && (shape === "melee" || shape === "dash")) m.accuracy = ACC[shape];
    const fx = EFFECTS[m.type];
    const base = (m.effectText || "")
      .replace(/\s*(May leave the target with a burn\.|May paralyze the target, slowing it\.|A numbing chill that may paralyze the target\.|Numbing venom that may paralyze the target\.|A dread that may paralyze the target\.)/g, "")
      .replace(/\s+and may (leave the target with a burn|paralyze the target)\.?/i, ".")
      .replace(/\b([Aa]) ([aeiou]\w*)/g, "$1n $2") // "a electric" -> "an electric"
      .trim();
    if (fx) {
      m.effectChance = fx.chance;
      m.effectText = `${base.replace(/\.?$/, ".")} ${fx.text}`;
      if (lot === 2) m.expectedStatus = fx.kind;
    } else {
      m.effectChance = null;
      m.effectText = base;
      if (lot === 2) m.expectedStatus = null;
    }
  }
}
tuneMoves(lot1m, 1);
tuneMoves(lot2m, 2);

// ---- loadouts ----
const LOT1_ROLE = { spec: "spec", phys: "phys", bal: "bal", bulk: "bulk", fast: "fast", util: "util" };
const LOT2_ROLE = { speed: "fast", physical: "phys", special: "spec", defense: "bulk" };
// slot wants: M/D/P/A = close melee/dash, ranged projectile/area; the digit picks the type (1 primary, 2 secondary).
// bal and fast keep all four slots for damage: their stats (flat 70s / speed-heavy) leave them
// well behind the other roles in 1v1 sims, and speed buys little in this engine.
const TEMPLATE = {
  phys: ["M1", "D2", "A1", "BUFF"],
  bal: ["M1", "P1", "D2", "A2"],
  bulk: ["M1", "A1", "D2", "SHIELD"],
  fast: ["P1", "D1", "M2", "A2"],
  spec: ["P1", "A2", "D1", "SHIELD"],
  util: ["A1", "P1", "D2", "SHIELD"],
};

function makeResolver(movesList, creature) {
  const own = new Set(creature.moves.map((x) => x.id));
  const damaging = movesList.filter(isDamaging).map((m) => ({ m, shape: movesList === lot2m.data ? m.expectedShape || shapeOf(m) : shapeOf(m) }));
  return (type, shapes, used) => {
    for (const shape of shapes) {
      const cands = damaging.filter((x) => x.m.type === type && x.shape === shape && !used.has(x.m.id));
      if (!cands.length) continue;
      // keep designed moves the creature already owns, otherwise the strongest catalogue move
      cands.sort((a, b) => (own.has(b.m.id) - own.has(a.m.id)) || b.m.power - a.m.power || a.m.id - b.m.id);
      return cands[0].m;
    }
    return null;
  };
}
const FALLBACK = { M: ["melee", "dash"], D: ["dash", "melee"], P: ["projectile", "area"], A: ["area", "projectile"] };

function loadoutFor(creature, lot, idx) {
  const movesList = lot === 1 ? lot1m.data : lot2m.data;
  const role = lot === 1 ? LOT1_ROLE[creature.role] : LOT2_ROLE[creature.role];
  if (!role) throw new Error(`${creature.displayName}: unknown role ${creature.role}`);
  const resolve = makeResolver(movesList, creature);
  const t1 = creature.types[0];
  const t2 = creature.types[1] || creature.types[0];
  const used = new Set();
  const dmg = [];
  const statusWant = [];
  for (const want of TEMPLATE[role]) {
    if (want === "BUFF" || want === "SHIELD") { statusWant.push(want); continue; }
    const kind = want[0];
    const types = want[1] === "2" ? [t2, t1] : [t1, t2];
    let m = null;
    for (const t of types) { m = resolve(t, FALLBACK[kind], used); if (m) break; }
    if (!m) m = resolve("normal", FALLBACK[kind], used);
    if (!m) throw new Error(`${creature.displayName}: no move for ${want}`);
    used.add(m.id);
    dmg.push(m);
  }
  return { role, dmg, status: statusWant[0], idx };
}

function statusMoves(lot) {
  const list = (lot === 1 ? lot1m : lot2m).data.filter((m) => m.damageClass === "status");
  return {
    buff: list.filter((m) => shapeOf(m) === "buff"),
    shield: list.filter((m) => shapeOf(m) === "shield"),
  };
}

const report = { lots: {} };
function applyLot(creatures, lot) {
  const st = statusMoves(lot);
  const nameOf = (m) => m.name;
  creatures.forEach((c, idx) => {
    const { dmg, status } = loadoutFor(c, lot, idx);
    const pool = status === "BUFF" ? st.buff : st.shield;
    const other = status === "BUFF" ? st.shield : st.buff;
    const chosen = status ? pool[idx % pool.length] : null;
    let moves;
    if (lot === 1) {
      const levels = [8, 14, 20, 26];
      moves = [...dmg, ...(chosen ? [chosen] : [])].map((m, i) => ({ id: m.id, name: nameOf(m), level: levels[i] }));
    } else {
      // Lot 2 keeps its 6-move learnset shape. With three damaging moves, buildMoveset takes the
      // highest-level status move as the default 4th slot; with four, both stay as optional extras.
      const levels = dmg.length === 4 ? [1, 9, 17, 25] : [1, 9, 17];
      moves = dmg.map((m, i) => ({ id: m.id, name: nameOf(m), level: levels[i] }));
      const first = chosen ? other[0] : st.shield[0];
      const second = chosen ?? st.buff[0];
      moves.push({ id: first.id, name: nameOf(first), level: 33 });
      moves.push({ id: second.id, name: nameOf(second), level: 41 });
    }
    c.moves = moves;
  });
}
applyLot(lot1c.data, 1);
applyLot(lot2c.data, 2);

// ---- self-check: every loadout must have own-type-friendly ranged AND close damage + a status move ----
const moveById = new Map([...lot1m.data, ...lot2m.data].map((m) => [m.id, m]));
const shapeById = (id) => {
  const m = moveById.get(id);
  return lot2m.data.includes(m) ? m.expectedShape || shapeOf(m) : shapeOf(m);
};
let bad = 0;
const tally = { ranged: 0, close: 0, buff: 0, shield: 0, burn: 0, para: 0 };
for (const c of [...lot1c.data, ...lot2c.data]) {
  const shapes = c.moves.map((m) => shapeById(m.id));
  const hasR = shapes.some((s) => s === "projectile" || s === "area");
  const hasC = shapes.some((s) => s === "melee" || s === "dash");
  const stabR = c.moves.some((m) => (shapeById(m.id) === "projectile" || shapeById(m.id) === "area") && c.types.includes(moveById.get(m.id).type));
  if (!hasR || !hasC || !stabR) { bad++; console.log("LOADOUT PROBLEM", c.displayName, c.types.join("/"), shapes.join(",")); }
  if (hasR) tally.ranged++;
  if (hasC) tally.close++;
  if (shapes.includes("buff")) tally.buff++;
  if (shapes.includes("shield")) tally.shield++;
}
for (const m of moveById.values()) if (isDamaging(m) && m.effectChance) EFFECTS[m.type]?.kind === "burn" ? tally.burn++ : tally.para++;
console.log(`balance: ${lot1c.data.length + lot2c.data.length} creatures | ranged ${tally.ranged} | close ${tally.close} | buff ${tally.buff} | shield ${tally.shield} | effect moves burn ${tally.burn} / paralysis ${tally.para} | problems ${bad}`);
console.log(`accuracy: projectile ${ACC.projectile}, area ${ACC.area}, melee ${ACC.melee}, dash ${ACC.dash}`);
if (bad) process.exit(1);
if (!CHECK_ONLY) {
  for (const o of [lot1c, lot1m, lot2c, lot2m]) fs.writeFileSync(o.file, ser(o));
  console.log("written.");
}
