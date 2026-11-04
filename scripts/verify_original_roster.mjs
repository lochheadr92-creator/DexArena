#!/usr/bin/env node
// yarn verify:original-roster — validates the Original Creatures content.
// Checks counts, ids, distribution, evolution graph, ability/move refs,
// 4-usable-move battle loadouts, resolved move shapes, and sprite assets.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CONTENT = path.join(ROOT, "frontend", "src", "content", "original");
const CONFIG = path.join(ROOT, "frontend", "src", "game", "config");
const PUBLIC = path.join(ROOT, "frontend", "public", "original");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const creatures = read(path.join(CONTENT, "creatures.json"));
const moves = read(path.join(CONTENT, "moves.json"));
const abilityNames = read(path.join(CONTENT, "abilityNames.json"));
const shapeMapping = read(path.join(CONFIG, "shapeMapping.json"));
const engine = read(path.join(CONFIG, "engine.json"));
const abilityDefs = read(path.join(CONFIG, "abilities.json")).defs;
const typeChart = read(path.join(CONFIG, "typeChart.json"));
const ref = read(path.join(__dirname, "reference_distribution.json"));
const VALID_TYPES = new Set(typeChart.types);

const moveById = Object.fromEntries(moves.map((m) => [m.id, m]));
const byId = Object.fromEntries(creatures.map((c) => [c.id, c]));

const errors = [];
const warns = [];
const fail = (m) => errors.push(m);
const warn = (m) => warns.push(m);

// --- ported engine shape logic (must mirror game/moves.js against shapeMapping.json) ---
const includesAny = (s, keys) => keys.some((k) => s.includes(k));
function classifyShape(m) {
  const name = m.name.toLowerCase();
  const text = (m.effectText || "").toLowerCase();
  if (m.damageClass === "special") return (m.power || 0) >= shapeMapping.specialProjectilePower && includesAny(name, shapeMapping.projectileKeywords) ? "projectile" : "area";
  if (m.damageClass === "physical") return includesAny(name, shapeMapping.dashKeywords) ? "dash" : "melee";
  return includesAny(text, shapeMapping.shieldKeywords) ? "shield" : "buff";
}
const isDamaging = (m) => m.damageClass !== "status" && (m.power || 0) > 0;
function statusOf(m, shape) {
  const text = (m.effectText || "").toLowerCase();
  for (const kind of Object.keys(shapeMapping.statusKeywords)) {
    if (includesAny(text, shapeMapping.statusKeywords[kind])) {
      const chance = m.effectChance == null ? 100 : m.effectChance;
      return shape === "shield" || shape === "buff" ? { kind, chance, attaches: false } : { kind, chance, attaches: true };
    }
  }
  return null;
}
const byPowerDesc = (a, b) => (b.power || 0) - (a.power || 0) || a.id - b.id;
function buildMoveset(creature) {
  const learn = creature.moves.map((m) => moveById[m.id]).filter(Boolean);
  const damaging = learn.filter(isDamaging).sort(byPowerDesc);
  const statusMoves = [...creature.moves].filter((lm) => moveById[lm.id]?.damageClass === "status").sort((a, b) => b.level - a.level || a.id - b.id).map((lm) => moveById[lm.id]);
  const chosen = [];
  const take = (m) => m && !chosen.includes(m) && chosen.length < 4 && chosen.push(m);
  creature.types.forEach((t) => take(damaging.find((m) => m.type === t && !chosen.includes(m))));
  damaging.forEach(take);
  if (chosen.length < 4 && statusMoves.length) take(statusMoves[0]);
  if (chosen.length < 4) statusMoves.forEach(take);
  return chosen;
}

// --- 1. counts & identity ---
if (creatures.length !== 150) fail(`Expected 150 species, got ${creatures.length}`);
const seen = (arr, label) => { const s = new Set(); arr.forEach((v) => { if (s.has(v)) fail(`Duplicate ${label}: ${v}`); s.add(v); }); };
seen(creatures.map((c) => c.id), "id");
seen(creatures.map((c) => c.dexNo), "dexNo");
seen(creatures.map((c) => c.displayName), "displayName");
seen(creatures.map((c) => c.name), "slug");
const legendary = creatures.filter((c) => c.isLegendary).length;
const mythical = creatures.filter((c) => c.isMythical).length;
const ordinary = creatures.filter((c) => !c.isLegendary && !c.isMythical).length;
if (legendary !== 8) fail(`Expected 8 legendary, got ${legendary}`);
if (mythical !== 3) fail(`Expected 3 mythical, got ${mythical}`);
if (ordinary !== 139) fail(`Expected 139 ordinary, got ${ordinary}`);

// --- 2. types / stats / abilities / moves refs ---
for (const c of creatures) {
  if (!c.types.length || c.types.length > 2) fail(`${c.displayName}: bad type count`);
  c.types.forEach((t) => { if (!VALID_TYPES.has(t)) fail(`${c.displayName}: invalid type ${t}`); });
  if (new Set(c.types).size !== c.types.length) fail(`${c.displayName}: duplicate type`);
  const st = c.stats;
  for (const k of ["hp", "atk", "def", "spa", "spd", "spe"]) if (!(st[k] > 0)) fail(`${c.displayName}: bad stat ${k}`);
  const bst = Object.values(st).reduce((a, b) => a + b, 0);
  if (bst !== c.bst) fail(`${c.displayName}: bst mismatch ${bst} vs ${c.bst}`);
  if (!Array.isArray(c.abilities) || !c.abilities.length) fail(`${c.displayName}: no abilities`);
  c.abilities.forEach((a) => {
    if (!abilityDefs[a]) fail(`${c.displayName}: ability "${a}" is not an implemented engine ability`);
    if (!abilityNames[a]) warn(`${c.displayName}: ability "${a}" has no original display name`);
  });
  c.moves.forEach((m) => { if (!moveById[m.id]) fail(`${c.displayName}: unknown move id ${m.id}`); });
  if (!c.sprite.startsWith("/original/") || !c.spriteBack.startsWith("/original/")) fail(`${c.displayName}: sprite must be a bundled /original/ asset`);
  if (/pokeapi|githubusercontent|sprites\/pokemon/i.test(c.sprite + c.spriteBack + c.artwork)) fail(`${c.displayName}: uses a Pokémon sprite URL`);
  if (c.animFront || c.animBack) warn(`${c.displayName}: has animFront/Back (should be null)`);
}

// --- 3. evolution graph ---
for (const c of creatures) {
  if (c.evolvesFrom != null) {
    const pre = byId[c.evolvesFrom];
    if (!pre) fail(`${c.displayName}: evolvesFrom ${c.evolvesFrom} missing`);
    else if (!pre.evolvesTo.includes(c.id)) fail(`${c.displayName}: pre-evo ${pre.displayName} does not list it in evolvesTo`);
    if (c.isLegendary || c.isMythical) fail(`${c.displayName}: sealed species must not evolve`);
  }
  c.evolvesTo.forEach((id) => { if (!byId[id]) fail(`${c.displayName}: evolvesTo ${id} missing`); else if (byId[id].evolvesFrom !== c.id) fail(`${c.displayName}: evolvesTo ${byId[id].displayName} has wrong evolvesFrom`); });
  // cycle check
  let cur = c, hops = 0, s = new Set();
  while (cur && cur.evolvesFrom != null) { if (s.has(cur.id)) { fail(`${c.displayName}: evolution cycle`); break; } s.add(cur.id); cur = byId[cur.evolvesFrom]; if (++hops > 5) { fail(`${c.displayName}: evolution chain too long`); break; } }
}

// --- 4. battle loadouts: exactly 4 usable moves, valid resolved shapes ---
const shapeTally = {};
let maxLoadout = 0;
for (const c of creatures) {
  const set = buildMoveset(c);
  if (set.length !== 4) fail(`${c.displayName}: buildMoveset produced ${set.length} moves (need 4) — learnset too thin`);
  set.forEach((m) => { const sh = classifyShape(m); shapeTally[sh] = (shapeTally[sh] || 0) + 1; if (!["projectile", "area", "melee", "dash", "shield", "buff"].includes(sh)) fail(`${c.displayName}: move ${m.name} bad shape ${sh}`); });
  maxLoadout = Math.max(maxLoadout, set.length);
}
// every move's declared damageClass must be consistent with its resolved shape family
for (const m of moves) {
  const sh = classifyShape(m);
  const ok = (sh === "projectile" || sh === "area") ? m.damageClass === "special" : (sh === "melee" || sh === "dash") ? m.damageClass === "physical" : m.damageClass === "status";
  if (!ok) fail(`move ${m.name}: shape ${sh} inconsistent with damageClass ${m.damageClass}`);
  const status = statusOf(m, sh);
  if (status && !["burn", "paralysis"].includes(status.kind)) fail(`move ${m.name}: unsupported status ${status.kind}`);
}
// shields/buffs must be reachable by at least some creatures
const anyStatusUser = creatures.some((c) => buildMoveset(c).some((m) => ["shield", "buff"].includes(classifyShape(m))));
if (!anyStatusUser) fail("No creature's generated loadout includes a shield/buff move");

// --- 5. distribution table ---
const n = creatures.length;
const typeCount = {}; typeChart.types.forEach((t) => (typeCount[t] = 0));
creatures.forEach((c) => c.types.forEach((t) => typeCount[t]++));
const refType = Object.fromEntries(ref.typeTable.map((r) => [r.type, r.target150]));
const single = creatures.filter((c) => c.types.length === 1).length;
const dual = n - single;
const stageOf = (c) => { let s = 1, cur = c; while (cur.evolvesFrom != null && byId[cur.evolvesFrom]) { cur = byId[cur.evolvesFrom]; s++; } return s; };
const stageCount = { 1: 0, 2: 0, 3: 0 }; creatures.forEach((c) => stageCount[stageOf(c)]++);
console.log("\n=== Reference vs Target vs Actual ===");
console.log(`species: 150 | single ${single}/${ref.scaledTargets.single} dual ${dual}/${ref.scaledTargets.dual} | sealed ${legendary + mythical}/11 (leg ${legendary}/8 myth ${mythical}/3)`);
console.log(`stages: s1 ${stageCount[1]}/${ref.scaledTargets.stageCount[1]} s2 ${stageCount[2]}/${ref.scaledTargets.stageCount[2]} s3 ${stageCount[3]}/${ref.scaledTargets.stageCount[3]}`);
console.log("type            target  actual  dev");
let typeOut = 0;
Object.entries(typeCount).sort((a, b) => b[1] - a[1]).forEach(([t, a]) => {
  const dev = a - (refType[t] ?? 0);
  if (Math.abs(dev) > 2) typeOut++;
  console.log(`  ${t.padEnd(12)} ${String(refType[t] ?? 0).padStart(5)} ${String(a).padStart(6)} ${(dev > 0 ? "+" + dev : dev).toString().padStart(5)}${Math.abs(dev) > 2 ? "  <-- >2" : ""}`);
});
console.log("shape coverage across all loadouts:", JSON.stringify(shapeTally));
if (typeOut > 0) warn(`${typeOut} type(s) deviate by more than 2 from scaled target`);

// --- 6. sprite assets ---
let present = 0;
const missing = [];
for (const c of creatures) {
  const ok = ["front", "back"].every((f) => {
    const p = path.join(PUBLIC, `o${String(c.dexNo).padStart(3, "0")}-${f}.png`);
    try { return fs.statSync(p).size > 0; } catch { return false; }
  });
  if (ok) present++; else missing.push(c.dexNo);
}
console.log(`\nART: ${present}/150 species have both front+back sprites present`);
if (present < 150) warn(`ART incomplete — ${150 - present} species missing sprite assets (dex ${missing.slice(0, 20).join(",")}${missing.length > 20 ? "…" : ""})`);

// --- summary ---
console.log("\n=== RESULT ===");
warns.forEach((w) => console.log("  WARN: " + w));
if (errors.length) { errors.forEach((e) => console.log("  FAIL: " + e)); console.log(`\n${errors.length} hard failure(s).`); process.exit(1); }
console.log(`PASS — 150 species, ${moves.length} moves, all data/shape/evolution/ability/move checks green.${warns.length ? ` (${warns.length} warning(s))` : ""}`);
