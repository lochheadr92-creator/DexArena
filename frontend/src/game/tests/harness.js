import { engine, animations, archetypes as archetypeConfig, secToTicks, TICK_RATE } from "@/game/config";
import { prepareBattle, buildMovesets, mappingLines } from "@/game/prebattle";
import { createBattle, playerParams, difficultyParams } from "@/game/state";
import { step, runHeadless, summary } from "@/game/step";
import { startCast, unitTopSpeed } from "@/game/combat";
import { computeDamage, effectiveness } from "@/game/damage";
import { ensureMoves } from "@/game/moveData";
import { toBattleMove } from "@/game/moves";
import { tileAt } from "@/game/terrain";
import { isSealed } from "@/lib/unlocks";
import { makeRng } from "@/game/rng";
import { generateNpcTeam } from "@/game/teamgen";

const FIXED_PLAYER = [1, 4, 7, 25, 133, 143];
const FIXED_NPC = [152, 155, 158, 179, 163, 241];
let dex = { creatures: {}, unlockedIds: new Set() };
export const registerDex = (d) => {
  dex = d;
};

const out = (lines) => {
  const text = Array.isArray(lines) ? lines.join("\n") : lines;
  console.log(text);
  return text;
};
const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function fixedBattle({ seed, autoPick = true, trace = false, terrainId = "pitch", playerIds = FIXED_PLAYER, npcIds = FIXED_NPC, archetypeId = "tactician" }) {
  return prepareBattle({ creatures: dex.creatures, unlockedIds: dex.unlockedIds, playerIds, npcIds, archetypeId, terrainId, seed, autoPick, trace, decodeSprites: false });
}

async function smokeTest(opts = {}) {
  const seed = opts.seed ?? (typeof window.__seed === "number" ? window.__seed : 12345);
  const speed = opts.speed ?? 1;
  const prevAnim = animations.animationsEnabled;
  const prevSprites = animations.animatedSprites;
  if (opts.animations != null) animations.animationsEnabled = opts.animations;
  if (opts.animatedSprites != null) animations.animatedSprites = opts.animatedSprites;
  const state = await fixedBattle({ seed });
  let frames = 0;
  while (state.phase === "running" && state.tick < 60 * 600) {
    for (let i = 0; i < speed && state.phase === "running"; i++) step(state);
    frames++;
  }
  animations.animationsEnabled = prevAnim;
  animations.animatedSprites = prevSprites;
  const s = summary(state);
  const line = `__smokeTest seed=${seed} speed=${speed}x animations=${opts.animations ?? prevAnim} animatedSprites=${opts.animatedSprites ?? prevSprites} → winner=${s.winner} remaining player=${s.remaining.player} npc=${s.remaining.npc} endTick=${s.endTick} (${s.durationSec}s, ${frames} frames) hp=[${s.hp.player.join(",")}|${s.hp.npc.join(",")}]`;
  out(line);
  return { ...s, speed, frames, line };
}

async function pacingTest(n = 50) {
  const all = Object.values(dex.creatures);
  const basics = all.filter((c) => c.types.includes("normal") && c.evolvesFrom == null && !isSealed(c));
  const rng = makeRng(777);
  const pairs = [];
  let guard = 0;
  while (pairs.length < n && guard++ < 5000) {
    const a = rng.pick(basics);
    const b = rng.pick(basics);
    if (a.id === b.id) continue;
    if (Math.abs(a.bst - b.bst) / Math.max(a.bst, b.bst) > 0.1) continue;
    if (effectiveness("normal", a.types) !== 1 || effectiveness("normal", b.types) !== 1) continue;
    pairs.push([a, b]);
  }
  const durations = [];
  const lines = [];
  for (let i = 0; i < pairs.length; i++) {
    const [a, b] = pairs[i];
    const [ma, mb] = await buildMovesets([a, b]);
    const params = playerParams();
    const state = createBattle({ seed: 1000 + i, terrainId: "pitch", autoPick: true, player: { creatures: [a], movesets: [ma], params }, npc: { creatures: [b], movesets: [mb], params, archetypeId: "tactician", name: "Tactician" } });
    const s = runHeadless(state, 60 * 300);
    durations.push(s.durationSec);
    lines.push(`#${String(i + 1).padStart(2, "0")} ${a.displayName} vs ${b.displayName}: ${s.durationSec}s winner=${s.winner}`);
  }
  const res = { n: durations.length, median: median(durations), min: Math.min(...durations), max: Math.max(...durations), damageScale: engine.DAMAGE_SCALE, cooldown: engine.cooldown, durations };
  out([`__pacingTest: ${res.n} seeded 1v1 battles, basic-stage Normal types within 10% BST, Pitch, Tactician params both sides`, ...lines, `durations: ${durations.join(", ")}`, `median=${res.median}s min=${res.min}s max=${res.max}s DAMAGE_SCALE=${res.damageScale} cooldown=${JSON.stringify(res.cooldown)}`]);
  return res;
}

async function archetypeTest(n = 20, { fixedTeam = false } = {}) {
  const results = {};
  const lines = [];
  for (const id of ["brawler", "kiter"]) {
    const arch = archetypeConfig.archetypes[id];
    const p = { aggression: arch.aggression, dodgeChance: arch.dodgeChance, reactionDelaySec: arch.reactionDelaySec, switchWillingness: engine.switchWillingness[arch.switchWillingness] };
    let distSum = 0;
    let distCount = 0;
    let dodges = 0;
    let wins = 0;
    const teamLog = [];
    const team = fixedTeam ? FIXED_PLAYER : (await generateNpcTeam({ rng: makeRng(31337), creatures: dex.creatures, unlockedIds: dex.unlockedIds, archetype: arch, log: teamLog })).map((c) => c.id);
    for (let i = 0; i < n; i++) {
      const state = await fixedBattle({ seed: 5000 + i, playerIds: team });
      state.teams.player.params = p;
      state.teams.player.reactionTicks = Math.max(1, secToTicks(p.reactionDelaySec));
      for (const u of state.teams.player.units) {
        const ratio = u.stats.atk / (u.stats.atk + u.stats.def);
        u.aggression = Math.min(engine.ai.aggressionMax, Math.max(engine.ai.aggressionMin, ratio)) * p.aggression;
      }
      const s = runHeadless(state);
      for (const u of state.teams.player.units) {
        distSum += u.distSum;
        distCount += u.distCount;
        dodges += u.dodges;
      }
      if (s.winner === "player") wins++;
    }
    results[id] = { team: team.map((cid) => dex.creatures[cid].displayName), avgDistance: +(distSum / Math.max(1, distCount)).toFixed(2), dodges, dodgesPerBattle: +(dodges / n).toFixed(1), wins };
    lines.push(`${arch.name} (aggression ${arch.aggression}, dodge ${arch.dodgeChance}, reaction ${arch.reactionDelaySec}s) team [${results[id].team.join(", ")}]: avg distance to opponent ${results[id].avgDistance} tiles, dodges ${dodges} (${results[id].dodgesPerBattle}/battle), wins ${wins}/${n}`);
  }
  lines.push(`check: Brawler distance < Kiter distance → ${results.brawler.avgDistance < results.kiter.avgDistance}; Kiter dodges > Brawler dodges → ${results.kiter.dodges > results.brawler.dodges}`);
  out([`__archetypeTest: ${n} seeded battles each (seeds 5000+), player side runs the archetype's AI params with a team built by the archetype's team rule${fixedTeam ? " (fixed team override)" : " (seeded 31337)"}, same opponent: Tactician with fixed team [${FIXED_NPC.map((cid) => dex.creatures[cid].displayName).join(", ")}], Pitch`, ...lines]);
  return results;
}

async function traceTest(seconds = 20) {
  const state = await fixedBattle({ seed: 4242, trace: true, playerIds: [25], npcIds: [152] });
  const ticks = seconds * TICK_RATE;
  while (state.phase === "running" && state.tick < ticks) step(state);
  const u = state.teams.player.units[0];
  const samples = state.trace.filter((t) => t.tick % 15 === 0);
  let changes = 0;
  let last = null;
  let sampledDist = 0;
  for (let i = 1; i < samples.length; i++) {
    const dx = samples[i].x - samples[i - 1].x;
    const dy = samples[i].y - samples[i - 1].y;
    const d = Math.hypot(dx, dy);
    sampledDist += d;
    if (d < 0.05) continue;
    const a = Math.atan2(dy, dx);
    if (last != null) {
      let diff = Math.abs(a - last);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (diff > Math.PI / 3) changes++;
    }
    last = a;
  }
  const modes = {};
  state.trace.forEach((t) => (modes[t.mode] = (modes[t.mode] || 0) + 1));
  const res = { unit: u.name, seconds, totalDistance: +u.distanceMoved.toFixed(2), sampledDistance: +sampledDist.toFixed(2), directionChanges: changes, directionChangesTickLevel: u.directionChanges || 0, preferredDistance: +u.preferred.toFixed(2), avgDistance: +(u.distSum / Math.max(1, u.distCount)).toFixed(2), modes };
  out(`__traceTest (${u.name} vs ${state.teams.npc.units[0].name}, Pitch, ${seconds}s): total distance ${res.totalDistance} tiles (0.25s-sampled ${res.sampledDistance}), direction changes ${res.directionChanges} (>60° between 0.25s samples; tick-level ${res.directionChangesTickLevel}), preferred ${res.preferredDistance}, avg distance ${res.avgDistance}, intent modes ${JSON.stringify(modes)}`);
  return res;
}

async function dodgeTest() {
  const lines = [];
  const results = {};
  for (const lead of [0.4, 0.1]) {
    const state = await fixedBattle({ seed: 99, playerIds: [1], npcIds: [152] });
    const target = state.teams.player.units[0];
    const shooter = state.teams.npc.units[0];
    target.state = "active";
    shooter.state = "active";
    target.pos = { x: 8, y: 20 };
    shooter.pos = { x: 8, y: 6 };
    target.nextThinkTick = 1e9;
    shooter.nextThinkTick = 1e9;
    target.intent = { mode: "none" };
    const speed = engine.shapes.projectile.speed;
    const proj = { id: 900, side: "npc", ownerId: shooter.id, moveIdx: 0, pos: { x: 8, y: 20 - lead * speed - target.radius }, dir: { x: 0, y: 1 }, speed, traveled: 0, range: 7, radius: engine.shapes.projectile.radius, type: "normal", hit: true, noticed: {}, dodgeLogIdx: 0 };
    state.projectiles.push(proj);
    target.burst = { kind: "dodge", until: state.tick + secToTicks(engine.dodge.sec), dir: { x: 1, y: 0 }, speedMult: engine.dodge.speedMult };
    state.dodgeLog.push({ tick: state.tick, unit: target.name, side: "player", projectileId: 900, leadSec: lead, outcome: "pending" });
    const hpBefore = target.hp;
    const entry = state.dodgeLog[0];
    let offsetAtSettle = null;
    let settleTick = null;
    for (let i = 0; i < 90 && entry.outcome === "pending"; i++) {
      step(state);
      if (entry.outcome !== "pending") {
        offsetAtSettle = target.pos.x - 8;
        settleTick = state.tick;
      }
    }
    results[lead] = entry.outcome;
    lines.push(`dodge started ${lead}s before impact (${target.name}, top speed ${unitTopSpeed(target).toFixed(2)} t/s, burst ${(unitTopSpeed(target) * engine.dodge.speedMult).toFixed(2)} t/s for ${engine.dodge.sec}s): projectile ${entry.outcome} after ${settleTick} ticks (target HP ${hpBefore}→${target.hp}, lateral offset at resolution ${offsetAtSettle?.toFixed(2)} tiles vs collision radius sum ${(target.radius + proj.radius).toFixed(2)})`);
  }
  const natural = await fixedBattle({ seed: 31337 });
  runHeadless(natural);
  const nat = natural.dodgeLog.map((d) => `  t${d.tick} ${d.side}/${d.unit}: lead ${d.leadSec.toFixed(2)}s → ${d.outcome}`);
  out(["__dodgeTest (controlled, Pitch, projectile fired straight down column 8, burst perpendicular +x): ", ...lines, `natural dodges in seeded 6v6 battle 31337: ${natural.dodgeLog.length}`, ...nat.slice(0, 12)]);
  return { controlled: results, natural: natural.dodgeLog };
}

async function multiplierChecks() {
  const c = dex.creatures;
  const byTypes = (t1, t2) => Object.values(c).find((x) => x.types.includes(t1) && (t2 ? x.types.includes(t2) : x.types.length === 1));
  const fireRock = byTypes("fire", "rock");
  const ghost = byTypes("ghost", "poison") || byTypes("ghost");
  const waterRock = byTypes("water", "rock");
  const attacker = c[7];
  const moves = await ensureMoves([55, 33, 52]);
  const [waterGun, tackle, ember] = [55, 33, 52].map((id) => toBattleMove(moves[id]));
  const mk = (cr) => ({ name: cr.displayName, types: cr.types, stats: { atk: 80, def: 80, spa: 80, spd: 80 }, buff: null });
  const att = mk(attacker);
  const checks = [
    [waterGun, fireRock, 4],
    [tackle, ghost, 0],
    [ember, waterRock, 0.25],
  ];
  const lines = checks.map(([m, def, expect]) => {
    const r = computeDamage(att, mk(def), m, 1, 1);
    return `${m.name} (${m.type}) → ${def.displayName} [${def.types.join("/")}]: ${r.eff}x (expected ${expect}x) damage=${r.damage} ${r.eff === expect ? "OK" : "FAIL"}`;
  });
  out(["__multiplierChecks:", ...lines]);
  return lines;
}

async function terrainChecks() {
  const lines = [];
  const measure = async (terrainId, x, y) => {
    const state = await fixedBattle({ seed: 7, terrainId, playerIds: [4], npcIds: [152] });
    const u = state.teams.player.units[0];
    const e = state.teams.npc.units[0];
    u.state = "active";
    e.state = "active";
    u.pos = { x, y };
    e.pos = { x, y: 1 };
    u.nextThinkTick = 1e9;
    e.nextThinkTick = 1e9;
    u.intent = { mode: "approach" };
    u.kite = true;
    e.intent = { mode: "none" };
    for (let i = 0; i < 30; i++) step(state);
    const start = { ...u.pos };
    const t0 = state.tick;
    for (let i = 0; i < 60; i++) step(state);
    const d = Math.hypot(u.pos.x - start.x, u.pos.y - start.y);
    return { tps: +(d / ((state.tick - t0) / TICK_RATE)).toFixed(2), tile: tileAt(state, start.x, start.y), unit: u.name };
  };
  const water = await measure("shoreline", 2.5, 22);
  const ground = await measure("shoreline", 10.5, 22);
  lines.push(`Shoreline: ${water.unit} (${dex.creatures[4].types.join("/")}) on ${water.tile}: ${water.tps} tiles/s; on ${ground.tile}: ${ground.tps} tiles/s; ratio ${(water.tps / ground.tps).toFixed(2)} (expected 0.50)`);

  const cav = await fixedBattle({ seed: 7, terrainId: "cavern", playerIds: [25], npcIds: [152] });
  const shooter = cav.teams.player.units[0];
  const tgt = cav.teams.npc.units[0];
  shooter.state = "active";
  tgt.state = "active";
  shooter.pos = { x: 4, y: 12 };
  tgt.pos = { x: 4, y: 4 };
  shooter.nextThinkTick = 1e9;
  tgt.nextThinkTick = 1e9;
  shooter.intent = { mode: "none" };
  tgt.intent = { mode: "none" };
  const projIdx = shooter.moves.findIndex((m) => m.shape === "projectile");
  const projMove = projIdx >= 0 ? shooter.moves[projIdx] : null;
  if (projMove) {
    shooter.moves[projIdx].accuracy = 100;
    startCast(cav, shooter, tgt, projIdx);
    const hpBefore = tgt.hp;
    for (let i = 0; i < 120 && cav.projectiles.length; i++) step(cav);
    const blocked = cav.log.filter((l) => l.includes("projectile hit rock")).pop();
    lines.push(`Cavern: ${shooter.name} fired ${projMove.name} from (4,12) at ${tgt.name} (4,4) through pillar rows 7-8 → ${blocked ? blocked.replace(/^\[t\d+\] /, "") : "NOT BLOCKED"}; target HP ${hpBefore}→${tgt.hp}`);
  } else lines.push("Cavern: no projectile move on Pikachu's moveset (unexpected)");

  const snow = await fixedBattle({ seed: 7, terrainId: "snowfield", playerIds: [4], npcIds: [152] });
  const fireUser = snow.teams.player.units[0];
  const victim = snow.teams.npc.units[0];
  fireUser.state = "active";
  victim.state = "active";
  fireUser.pos = { x: 3.5, y: 12 };
  victim.pos = { x: 3.5, y: 7.5 };
  fireUser.nextThinkTick = 1e9;
  victim.nextThinkTick = 1e9;
  fireUser.intent = { mode: "none" };
  victim.intent = { mode: "none" };
  const areaIdx = fireUser.moves.findIndex((m) => m.shape === "area" && m.type === "fire");
  if (areaIdx >= 0) {
    const before = tileAt(snow, 3.5, 7.5);
    startCast(snow, fireUser, victim, areaIdx);
    for (let i = 0; i < 30; i++) step(snow);
    const after = tileAt(snow, 3.5, 7.5);
    const melted = snow.meltLog[0];
    for (let i = 0; i < 10 * TICK_RATE + 5; i++) step(snow);
    const reverted = tileAt(snow, 3.5, 7.5);
    lines.push(`Snowfield: ${fireUser.name} ${fireUser.moves[areaIdx].name} (fire/area) on ice patch → tile (3,7) ${before} → ${after}; melted ${melted ? melted.tiles.length : 0} tiles ${melted ? melted.tiles.map((t) => `(${t.c},${t.r})`).join(" ") : ""}; after 10s: ${reverted}`);
  } else lines.push("Snowfield: no fire area move on Charmander's moveset (unexpected)");
  out(["__terrainChecks:", ...lines]);
  return lines;
}

async function switchCheck() {
  const state = await fixedBattle({ seed: 2024, autoPick: true });
  const team = state.teams.player;
  while (state.tick < 240 || (state.tick < 1800 && !team.units[team.activeIndex].moves.some((m) => m.cdUntil > state.tick))) step(state);
  const a = team.units[team.activeIndex];
  state.inputs.push({ type: "switch", side: "player", index: 1 });
  step(state);
  const snapshot = { name: a.name, hp: a.hp, cds: a.moves.map((m) => m.cdUntil) };
  const switchTick = state.tick;
  while (state.tick < switchTick + 180) step(state);
  const incoming = team.units[team.activeIndex];
  const entryDamage = incoming.entryDamage;
  state.inputs.push({ type: "switch", side: "player", index: a.index });
  step(state);
  const back = team.units[team.activeIndex];
  const line = `__switchCheck: withdrew ${snapshot.name} at t${switchTick} with HP ${snapshot.hp} and cdUntil ${snapshot.cds.join("/")} → switched back at t${state.tick}: ${back.name} HP ${back.hp} (unchanged: ${back.hp === snapshot.hp}), cdUntil ${back.moves.map((m) => m.cdUntil).join("/")} (unchanged absolute ticks, i.e. kept ticking on bench: ${back.moves.every((m, i) => m.cdUntil === snapshot.cds[i])}), incoming ${incoming.name} entry-window damage logged: ${entryDamage}`;
  out(line);
  return line;
}

async function moveMappingDump(ids) {
  const playerIds = ids || (window.__battle ? window.__battle.teams.player.units.map((u) => u.creatureId) : FIXED_PLAYER);
  const cs = playerIds.map((id) => dex.creatures[id]);
  const log = [];
  const sets = await buildMovesets(cs, {}, log);
  const lines = cs.flatMap((c, i) => mappingLines(c, sets[i]));
  const unmapped = sets.flat().filter((m) => !m.shape).length;
  out(["__moveMappingDump:", ...lines, ...log, `moves: ${sets.flat().length} (${cs.length} creatures × 4 = ${cs.length * 4}), unmapped shapes: ${unmapped}`]);
  return lines;
}

function fpsSample(seconds = 10) {
  return new Promise((resolve) => {
    let frames = 0;
    let min = Infinity;
    let last = performance.now();
    const t0 = last;
    const tick = (now) => {
      frames++;
      const inst = 1000 / Math.max(1, now - last);
      if (now - last > 0 && inst < min && frames > 2) min = inst;
      last = now;
      if (now - t0 < seconds * 1000) requestAnimationFrame(tick);
      else {
        const res = { seconds, frames, avgFps: +(frames / ((now - t0) / 1000)).toFixed(1), minInstantFps: +min.toFixed(1), tick: window.__battle?.tick, phase: window.__battle?.phase };
        out(`__fpsSample: ${res.avgFps} fps avg over ${seconds}s (${frames} frames, min instantaneous ${res.minInstantFps}), battle tick ${res.tick}, phase ${res.phase}`);
        resolve(res);
      }
    };
    requestAnimationFrame(tick);
  });
}

export function installHarness() {
  Object.assign(window, {
    __smokeTest: smokeTest,
    __pacingTest: pacingTest,
    __archetypeTest: archetypeTest,
    __traceTest: traceTest,
    __dodgeTest: dodgeTest,
    __multiplierChecks: multiplierChecks,
    __terrainChecks: terrainChecks,
    __switchCheck: switchCheck,
    __moveMappingDump: moveMappingDump,
    __fpsSample: fpsSample,
    __config: { engine, animations, difficultyParams },
  });
}
