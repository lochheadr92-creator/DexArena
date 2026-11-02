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
  const logText = state.log.join("\n");
  let h = 5381;
  for (let i = 0; i < logText.length; i++) h = ((h * 33) ^ logText.charCodeAt(i)) >>> 0;
  const line = `__smokeTest seed=${seed} speed=${speed}x animations=${opts.animations ?? prevAnim} animatedSprites=${opts.animatedSprites ?? prevSprites} → winner=${s.winner} remaining player=${s.remaining.player} npc=${s.remaining.npc} endTick=${s.endTick} (${s.durationSec}s, ${frames} frames) hp=[${s.hp.player.join(",")}|${s.hp.npc.join(",")}] log=${state.log.length} lines hash=${h.toString(16)}`;
  out(line);
  window.__lastSmokeLog = state.log;
  return { ...s, speed, frames, line, logHash: h.toString(16), logLines: state.log.length };
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
  const res = { n: durations.length, median: +median(durations).toFixed(2), min: Math.min(...durations), max: Math.max(...durations), damageScale: engine.DAMAGE_SCALE, cooldown: engine.cooldown, durations };
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
  const natural = await fixedBattle({ seed: 31337, playerIds: [25, 1, 4, 7, 133, 143], npcIds: [116, 179, 152, 155, 158, 163] });
  runHeadless(natural);
  const nat = natural.dodgeLog.map((d) => `  t${d.tick} ${d.side}/${d.unit}: lead ${d.leadSec.toFixed(2)}s → ${d.outcome}`);
  out(["__dodgeTest (controlled, Pitch, projectile fired straight down column 8, burst perpendicular +x): ", ...lines, `natural dodges in seeded 6v6 battle 31337 (Pikachu-led team vs Horsea/Mareep-led Tactician): ${natural.dodgeLog.length}`, ...nat.slice(0, 14)]);
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

async function spriteCheck(ids = [...FIXED_PLAYER, ...FIXED_NPC]) {
  const { ensureSprite, clearSpriteMemory, spriteReport } = await import("@/game/render/sprites");
  const { idbDelete, STORE_SPRITES } = await import("@/lib/idb");
  const cs = ids.map((id) => dex.creatures[id]);
  const pairs = cs.flatMap((c) => [[c, "front"], [c, "back"]]);
  clearSpriteMemory();
  for (const [c, f] of pairs) await idbDelete(STORE_SPRITES, `${c.id}:${f}`).catch(() => {});
  const cold = [];
  for (const [c, f] of pairs) cold.push(await ensureSprite(c, f));
  const coldLines = spriteReport.decoded.map((d) => `  ${d.name} ${d.facing}: ${d.frames} frames ${d.size} via ${d.source} in ${d.ms} ms`);
  const coldFallbacks = spriteReport.fallbacks.map((f) => `  ${f.name} ${f.facing}: ${f.reason}`);
  const coldTotal = cold.reduce((a, e) => a + e.ms, 0);
  clearSpriteMemory();
  const warm = [];
  for (const [c, f] of pairs) warm.push(await ensureSprite(c, f));
  const warmTotal = warm.reduce((a, e) => a + e.ms, 0);
  const warmSources = warm.map((e) => e.source);
  const lines = [
    `__spriteCheck: ${pairs.length} sprites (${cs.length} creatures × front/back), animated path = PokeAPI generation-v black-white animated GIF (front_default / back_default) decoded with gifuct-js into per-frame canvases, stored in IDB '${STORE_SPRITES}'`,
    `cold (IDB entries deleted → network fetch + decode): total ${coldTotal.toFixed(0)} ms, per sprite avg ${(coldTotal / pairs.length).toFixed(0)} ms`,
    ...coldLines,
    `fallbacks to static sprite: ${coldFallbacks.length}`,
    ...coldFallbacks,
    `warm (memory cleared, loaded from IDB): total ${warmTotal.toFixed(0)} ms, per sprite avg ${(warmTotal / pairs.length).toFixed(0)} ms, sources: ${[...new Set(warmSources)].join(",")}`,
    `example urls: front ${cs[0].animFront} | back ${cs[0].animBack} | static ${cs[0].sprite}`,
  ];
  out(lines);
  return { cold: spriteReport.decoded, warmTotal, coldTotal };
}

async function wallCheck(seeds = [4242, 777, 31337]) {
  const { tileAt, movementMult } = await import("@/game/terrain");
  const lines = [];
  for (const terrainId of ["pitch", "cavern"]) {
    for (const seed of seeds) {
      const state = await fixedBattle({ seed, terrainId, autoPick: true });
      let inside = 0;
      const firsts = [];
      while (state.phase === "running" && state.tick < 20000) {
        step(state);
        for (const side of ["player", "npc"]) {
          const t = state.teams[side];
          const u = t.units[t.activeIndex];
          if (!u || (u.state !== "active" && u.state !== "entering")) continue;
          if (movementMult(state, tileAt(state, u.pos.x, u.pos.y), u.types) === 0) {
            inside++;
            if (firsts.length < 4) firsts.push(`t${state.tick} ${side}/${u.name} ${u.state} at (${u.pos.x.toFixed(2)},${u.pos.y.toFixed(2)}) tile=${tileAt(state, u.pos.x, u.pos.y)} kb=${!!u.knockback} burst=${u.burst?.kind || "-"} types=${u.types}`);
          }
        }
      }
      lines.push(`${terrainId} seed ${seed}: ${state.tick} ticks, unit-centre-inside-blocked-tile ticks: ${inside}${firsts.length ? "\n  " + firsts.join("\n  ") : ""}`);
    }
  }
  out(["__wallCheck:", ...lines]);
  return lines;
}

async function logDump({ seed = 5, playerIds, npcIds, terrainId = "pitch", toTick = 600, filter = "" } = {}) {
  const state = await fixedBattle({ seed, playerIds: playerIds || FIXED_PLAYER, npcIds: npcIds || FIXED_NPC, terrainId, autoPick: true });
  while (state.phase === "running" && state.tick < toTick) step(state);
  const re = new RegExp(filter, "i");
  const lines = state.log.filter((l) => re.test(l));
  out([`__logDump seed=${seed} to t${toTick} filter=/${filter}/: ${lines.length} lines`, ...lines.slice(0, 80)]);
  return lines;
}

async function replayTest(seed = 2024) {
  const { encodeReplay, decodeReplay } = await import("@/lib/replay");
  const original = await fixedBattle({ seed, autoPick: true });
  original.meta.initialHp = [null, 80, null, null, null, null];
  original.teams.player.units[1].hp = 80;
  const scripted = [
    { tick: 300, type: "switch", side: "player", index: 2 },
    { tick: 900, type: "switch", side: "player", index: 0 },
    { tick: 2000, type: "auto", side: "player", value: false },
    { tick: 7000, type: "auto", side: "player", value: true },
  ];
  let picks = 0;
  while (original.phase === "running" && original.tick < 60 * 600) {
    const due = scripted.find((s) => s.tick === original.tick);
    if (due) original.inputs.push({ ...due });
    if (original.teams.player.pendingPick && !original.autoPick) {
      const alive = original.teams.player.units.filter((u) => u.state === "bench" && u.hp > 0);
      original.inputs.push({ type: "pick", side: "player", index: alive[alive.length - 1].index });
      picks++;
    }
    step(original);
  }
  const code = encodeReplay(original);
  const setup = decodeReplay(code);
  const replay = await prepareBattle({ ...setup, creatures: dex.creatures, unlockedIds: dex.unlockedIds, decodeSprites: false });
  while (replay.phase === "running" && replay.tick < 60 * 600) step(replay);
  const a = summary(original);
  const b = summary(replay);
  const same = JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(replay.inputLog) === JSON.stringify(original.inputLog);
  out([
    `__replayTest seed=${seed}: original inputLog=${JSON.stringify(original.inputLog)} (auto-pick on at start, off at t2000, on at t7000; ${picks} manual picks, 2 scripted switches, unit[1] starts at 80 HP)`,
    `  replay code length ${code.length} chars → ${window.location.origin}/replay#${code.slice(0, 40)}…`,
    `  original: winner=${a.winner} endTick=${a.endTick} hp=[${a.hp.player.join(",")}|${a.hp.npc.join(",")}]`,
    `  replay:   winner=${b.winner} endTick=${b.endTick} hp=[${b.hp.player.join(",")}|${b.hp.npc.join(",")}] inputLog=${JSON.stringify(replay.inputLog)}`,
    `  identical end state: ${same}`,
  ]);
  return { same, code, original: a, replay: b };
}

async function progressionTest() {
  const { creditBattle, pendingUnlocks, sealKeys, evolutionThreshold } = await import("@/lib/progression");
  const { newRun, runAfterBattle, applyRunToSave, GAUNTLET_STAGES } = await import("@/lib/gauntlet");
  const { defaultSave } = await import("@/lib/save");
  const { computeStarterIds } = await import("@/lib/unlocks");
  const creatures = dex.creatures;
  const starters = computeStarterIds(creatures);
  const unlockedOf = (save) => new Set([...starters, ...save.unlocked]);
  const lines = [];
  let save = defaultSave();
  save.team = [...FIXED_PLAYER];
  const fake = (win) => ({ winner: win ? "player" : "npc", teams: { player: { units: FIXED_PLAYER.map((id) => ({ creatureId: id })) } } });
  for (let i = 1; i <= 12; i++) {
    const res = creditBattle(save, { win: true, playerIds: FIXED_PLAYER }, creatures, unlockedOf(save));
    save = res.save;
    if (res.newUnlocks.length || res.keysEarned) lines.push(`  win ${i}: unlocked [${res.newUnlocks.map((id) => creatures[id].displayName).join(", ")}] keysEarned=${res.keysEarned}`);
  }
  lines.push(`  after 12 wins: totalWins=${save.totalWins} speciesWins(Bulbasaur)=${save.speciesWins[1]} unlocked=${save.unlocked.map((id) => creatures[id].displayName).join(", ")}`);
  lines.push(`  thresholds: Ivysaur(stage2)=${evolutionThreshold(creatures[2], creatures)} Venusaur(stage3)=${evolutionThreshold(creatures[3], creatures)} Raichu(stage3 via Pichu)=${evolutionThreshold(creatures[26], creatures)}; Venusaur pending now (needs Ivysaur wins)? ${pendingUnlocks(creatures, unlockedOf(save), save.speciesWins).includes(3)}`);
  const loss = creditBattle(save, { win: false, playerIds: FIXED_PLAYER }, creatures, unlockedOf(save));
  lines.push(`  loss: totalBattles ${save.totalBattles}→${loss.save.totalBattles}, totalWins ${save.totalWins}→${loss.save.totalWins}, unlocks ${loss.newUnlocks.length}`);
  const keys = sealKeys(save, creatures);
  lines.push(`  seal keys at 12 wins: earned=${keys.earned} spent=${keys.spent} available=${keys.available} nextIn=${keys.nextIn}`);
  let run = newRun(FIXED_PLAYER, 99);
  lines.push(`  gauntlet run: archetypes=${run.archetypes.join(">")} terrains=${run.terrains.join(">")} stage=${run.stage}`);
  const fakeEnd = (win, hps) => ({ ...fake(win), teams: { player: { units: FIXED_PLAYER.map((id, i) => ({ creatureId: id, hp: hps[i] })) } } });
  let g = { ...defaultSave(), gauntlet: { runs: 1, clears: 0, bestStage: 0, active: run } };
  for (let s = 1; s <= GAUNTLET_STAGES; s++) {
    const r = runAfterBattle(g.gauntlet.active, fakeEnd(true, [100 - s * 10, 0, 50, 60, 70, 80]));
    g = applyRunToSave(g, r);
    lines.push(`  stage ${s} win → outcome=${r.outcome} nextStage=${r.run?.stage ?? "-"} carriedHp=${JSON.stringify(r.hp)} bestStage=${g.gauntlet.bestStage} clears=${g.gauntlet.clears} active=${!!g.gauntlet.active}`);
  }
  let g2 = { ...defaultSave(), gauntlet: { runs: 1, clears: 0, bestStage: 0, active: newRun(FIXED_PLAYER, 5) } };
  g2 = applyRunToSave(g2, runAfterBattle(g2.gauntlet.active, fakeEnd(true, [1, 1, 1, 1, 1, 1])));
  const lost = runAfterBattle(g2.gauntlet.active, fakeEnd(false, [0, 0, 0, 0, 0, 0]));
  g2 = applyRunToSave(g2, lost);
  lines.push(`  second run: win stage 1 then lose stage 2 → outcome=${lost.outcome} bestStage=${g2.gauntlet.bestStage} active=${g2.gauntlet.active}`);
  out(["__progressionTest:", ...lines]);
  return lines;
}

async function visualCoverage(maxId = 467) {
  const { resolveVisual, coverageReport } = await import("@/game/render/moveVisuals");
  const ids = Array.from({ length: maxId }, (_, i) => i + 1);
  const t0 = performance.now();
  const map = await ensureMoves(ids);
  const moves = ids.map((id) => map[id]).filter(Boolean).map(toBattleMove);
  const rep = coverageReport(moves);
  const lines = [
    `__visualCoverage: ${rep.total} moves (PokeAPI ids 1–${maxId}, Gen I–IV), ${rep.damaging} damaging — fetched/cached in ${(performance.now() - t0).toFixed(0)}ms`,
    `  counts per archetype: ${Object.entries(rep.counts).map(([k, v]) => `${k}=${v}`).join("  ")}`,
    `  fallback (burst) on damaging moves: ${rep.fallbackDamaging.length}/${rep.damaging} = ${rep.fallbackPct}%`,
    `  fallback damaging list: ${rep.fallbackDamaging.join(", ") || "none"}`,
    `  fallback non-damaging (status/0-power) list: ${rep.fallbackOther.join(", ") || "none"}`,
    `  rules skipped as incompatible with the move's gameplay shape (${rep.skipped.length}): ${rep.skipped.join("; ") || "none"}`,
    ...Object.keys(rep.byArchetype).map((k) => `  [${k}] ${rep.byArchetype[k].join(", ")}`),
  ];
  out(lines);
  window.__visualCoverageReport = rep;
  return { rep, resolveVisual };
}

function fxCount() {
  const r = window.__renderer;
  const n = r ? r.effectCount() : null;
  out(`__fxCount: ${n} (effects=${r?.effects.length} particles=${r?.particles.items.length} texts=${r?.texts.length} projVis=${Object.keys(r?.projVis || {}).length} pendingCasts=${r?.pendingCasts.length}) ambient=${r?.ambientCount()} quality=${r?.quality} cap=${r?.particles.cap} additive=${r?.particles.additive} reducedMotion=${r?.reducedMotion}`);
  return n;
}

async function rivalTest(playerIds = FIXED_PLAYER, totalWins = 0, seed = 2024) {
  const { rivalPlan } = await import("@/lib/rival");
  const team = playerIds.map((id) => dex.creatures[id]);
  const lines = [`__rivalTest: team [${team.map((c) => `${c.displayName} ${c.bst}`).join(", ")}] totalWins=${totalWins}`];
  for (let level = 1; level <= 6; level++) {
    const plan = rivalPlan(team, totalWins, level);
    const log = [];
    const rng = makeRng(seed + level);
    const npc = await generateNpcTeam({ rng, creatures: dex.creatures, unlockedIds: dex.unlockedIds, archetype: archetypeConfig.archetypes.tactician, budget: plan.budget, pool: plan.pool, tierPicks: plan.tierPicks, allowLegendary: plan.legendary, log });
    const avg = Math.round(npc.reduce((s, c) => s + c.bst, 0) / npc.length);
    const locked = npc.filter((c) => !dex.unlockedIds.has(c.id)).map((c) => c.displayName);
    const fullyEvolved = npc.filter((c) => !c.evolvesTo || c.evolvesTo.length === 0).length;
    lines.push(`  L${level} ${plan.name} [${plan.pool}]: power ${plan.power} → budget ${plan.budget} (slot ${plan.slot}) | rival avg BST ${avg} (${((avg / plan.power) * 100).toFixed(0)}% of you, ${((avg / plan.budget) * 100).toFixed(0)}% of budget) | fully evolved ${fullyEvolved}/6 | team ${npc.map((c) => `${c.displayName} ${c.bst}`).join(", ")} | locked picks: ${locked.join(", ") || "none"} | ${log[0]}`);
  }
  out(lines);
}

async function itemTest(seed = 4242) {
  const { buildCatalog, optionsFor, rollDrop, applyEvolutionItem, isItemLocked } = await import("@/lib/items");
  const { creditBattle } = await import("@/lib/progression");
  const { encodeReplay, decodeReplay } = await import("@/lib/replay");
  const catalog = buildCatalog(dex.creatures);
  const locked = Object.values(dex.creatures).filter(isItemLocked);
  const lines = [`__itemTest: catalog ${catalog.length} items covering ${locked.length} item-locked forms`];
  for (const it of catalog) lines.push(`  ${it.name}${it.rare ? " (rare)" : ""} [${it.source}]: ${it.targets.map((t) => `${dex.creatures[t.from].displayName}→${dex.creatures[t.to].displayName}`).join(", ")}`);
  const team = [25, 133, 44, 61, 79, 236];
  let hits = 0;
  const counts = {};
  for (let s = 0; s < 200; s++) {
    const d = rollDrop({ seed: s, catalog, teamIds: team, unlockedIds: dex.unlockedIds });
    if (d) {
      hits++;
      counts[d] = (counts[d] || 0) + 1;
    }
  }
  const same = rollDrop({ seed: 7, catalog, teamIds: team, unlockedIds: dex.unlockedIds }) === rollDrop({ seed: 7, catalog, teamIds: team, unlockedIds: dex.unlockedIds });
  lines.push(`  drops over 200 seeded wins (team Pikachu/Eevee/Gloom/Poliwhirl/Slowpoke/Tyrogue): ${hits} drops (${((hits / 200) * 100).toFixed(0)}%, target 35%) · deterministic for same seed: ${same}`);
  lines.push(`  drop distribution: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  const guaranteed = rollDrop({ seed: 99, catalog, teamIds: team, unlockedIds: dex.unlockedIds, guaranteed: true });
  const rare = rollDrop({ seed: 99, catalog, teamIds: team, unlockedIds: dex.unlockedIds, guaranteed: true, rareOnly: true });
  lines.push(`  gauntlet guaranteed drop: ${guaranteed} · champion rare drop: ${rare} (rare=${catalog.find((c) => c.id === rare)?.rare})`);

  const save = { version: 1, totalWins: 0, totalBattles: 0, unlocked: [], team, speciesWins: {}, speciesKoCredit: {}, speciesStandingCredit: {}, lastCreditedBattle: null, items: {}, gauntlet: { runs: 0, clears: 0, bestStage: 0, active: null } };
  const credited = creditBattle(save, { win: true, playerIds: team, battleId: "x-1", bonuses: [], seed: 99, catalog, drop: { guaranteed: true } }, dex.creatures, dex.unlockedIds);
  lines.push(`  creditBattle with guaranteed drop → items ${JSON.stringify(credited.save.items)} drop=${credited.drop}; Raichu in newUnlocks after 5 Pikachu wins? ${creditBattle({ ...save, speciesWins: { 25: 4 } }, { win: true, playerIds: team, battleId: "x-2", bonuses: [], seed: 1, catalog }, dex.creatures, dex.unlockedIds).newUnlocks.includes(26)} (expected false: Raichu is Thunder Stone-locked)`);
  const withStone = { ...save, items: { "thunder-stone": 1 } };
  const used = applyEvolutionItem(withStone, { itemId: "thunder-stone", fromId: 25, toId: 26 }, catalog);
  const wrong = applyEvolutionItem(withStone, { itemId: "thunder-stone", fromId: 1, toId: 2 }, catalog);
  lines.push(`  roster use: Thunder Stone on Pikachu → unlocked ${JSON.stringify(used.save.unlocked)} items ${JSON.stringify(used.save.items)} error=${used.error}; on Bulbasaur → error="${wrong.error}"`);

  const state = await prepareBattle({ creatures: dex.creatures, unlockedIds: dex.unlockedIds, playerIds: team, npcIds: FIXED_NPC, terrainId: "pitch", seed, autoPick: true, decodeSprites: false });
  const opts = Object.entries(state.evolutions).map(([from, list]) => `${dex.creatures[from].displayName}: ${list.map((o) => `${o.itemId}→${o.creature.displayName} [${o.moveset.map((m) => m.name).join("/")}]`).join(", ")}`);
  lines.push(`  in-battle evolution options preloaded: ${opts.join(" | ")}`);
  while (state.tick < 300) step(state);
  const u = state.teams.player.units[0];
  const before = { name: u.name, hp: u.hp, maxHp: u.maxHp, cds: u.moves.map((m) => Math.max(0, m.cdUntil - state.tick)), types: u.types.join("/"), spe: u.stats.spe };
  state.inputs.push({ type: "item", side: "player", index: 0, itemId: "thunder-stone" });
  step(state);
  const after = { name: u.name, hp: u.hp, maxHp: u.maxHp, cds: u.moves.map((m) => Math.max(0, m.cdUntil - state.tick)), types: u.types.join("/"), spe: u.stats.spe, moves: u.moves.map((m) => m.name).join("/") };
  lines.push(`  t${state.tick} item input: ${before.name} HP ${before.hp}/${before.maxHp} (${((before.hp / before.maxHp) * 100).toFixed(1)}%) cds ${before.cds.join("/")} spe ${before.spe} → ${after.name} HP ${after.hp}/${after.maxHp} (${((after.hp / after.maxHp) * 100).toFixed(1)}%) cds ${after.cds.join("/")} spe ${after.spe} types ${after.types} moves ${after.moves}`);
  lines.push(`  log: ${state.log.filter((l) => l.includes("evolved")).join(" | ")} · evolved=${JSON.stringify(state.evolved)}`);
  state.inputs.push({ type: "item", side: "player", index: 0, itemId: "thunder-stone" });
  step(state);
  lines.push(`  second stone on Raichu ignored: evolved count ${state.evolved.length}, inputLog items ${state.inputLog.filter((x) => x.type === "item").length}`);
  runHeadless(state);
  const s1 = summary(state);
  state.meta.archetype = state.meta.archetype || "tactician";
  const code = encodeReplay(state);
  const setup = decodeReplay(code);
  const replay = await prepareBattle({ creatures: dex.creatures, unlockedIds: dex.unlockedIds, ...setup, decodeSprites: false });
  runHeadless(replay);
  const s2 = summary(replay);
  lines.push(`  replay with item input: payload p=${JSON.stringify(setup.playerIds)} inputs=${JSON.stringify(setup.replayInputs)} → original winner=${s1.winner} endTick=${s1.endTick} hp=[${s1.hp.player}|${s1.hp.npc}] · replay winner=${s2.winner} endTick=${s2.endTick} hp=[${s2.hp.player}|${s2.hp.npc}] · identical=${JSON.stringify(s1) === JSON.stringify(s2)} · replay unit0 now ${replay.teams.player.units[0].name}`);
  out(lines);
  return { catalog, state };
}

export function installHarness() {
  Object.assign(window, {
    __itemTest: itemTest,
    __rivalTest: rivalTest,
    __visualCoverage: visualCoverage,
    __fxCount: fxCount,
    __replayTest: replayTest,
    __progressionTest: progressionTest,
    __logDump: logDump,
    __wallCheck: wallCheck,
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
    __spriteCheck: spriteCheck,
    __config: { engine, animations, difficultyParams },
  });
}
