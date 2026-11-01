import { engine, secToTicks, TICK_RATE } from "@/game/config";
import { tileAt, movementMult, frictionFor, unitBlockedAt } from "@/game/terrain";
import { pushEvent, logLine, activeUnit, enemyOf, aliveBench } from "@/game/state";
import { aiThink, npcSwitchDecision, bestMatchupIndex } from "@/game/ai";
import { releaseCast, applyHit, updateProjectiles, updateStatuses, detectDodges, unitTopSpeed, hittable } from "@/game/combat";
import { dist, norm, sub, add, scale, perp, len, angleOf, fromAngle, rotate, rotateToward, moveToward, clamp, angleDiff, overlaps } from "@/game/physics";

const DT = 1 / TICK_RATE;
const TURN = (engine.movement.turnRateDeg * Math.PI) / 180;

export function step(state) {
  if (state.phase !== "running") return;
  processInputs(state);
  if (state.teams.player.pendingPick && !state.autoPick) return;
  state.tick++;

  for (const side of ["player", "npc"]) updateTeamFlow(state, state.teams[side]);

  for (const side of ["player", "npc"]) {
    const team = state.teams[side];
    const enemyTeam = enemyOf(state, side);
    const unit = activeUnit(team);
    const enemy = activeUnit(enemyTeam);
    if (!unit || !enemy) continue;
    if (unit.state === "active" && enemy.state !== "fainted" && state.tick >= unit.nextThinkTick) {
      if (side === "npc") {
        const idx = npcSwitchDecision(state, team, enemy);
        if (idx >= 0) {
          beginSwitch(state, team, idx, "ai");
          continue;
        }
      }
      aiThink(state, unit, enemy, team);
    }
    detectDodges(state, unit, team);
  }

  for (const side of ["player", "npc"]) {
    const team = state.teams[side];
    const unit = activeUnit(team);
    const enemy = activeUnit(enemyOf(state, side));
    if (unit) updateMovement(state, unit, enemy);
  }
  resolveUnitCollision(state);

  for (const side of ["player", "npc"]) {
    const unit = activeUnit(state.teams[side]);
    const enemy = activeUnit(enemyOf(state, side));
    if (unit?.cast && state.tick >= unit.cast.releaseTick) {
      if (unit.state === "active") releaseCast(state, unit, enemy);
      else unit.cast = null;
    }
  }
  updateProjectiles(state);
  for (const side of ["player", "npc"]) for (const u of state.teams[side].units) if (u.hp > 0 || u.state === "active") updateStatuses(state, u);

  checkFaints(state);
  checkEnd(state);
  recordTrace(state);
  if (state.events.length > 400) state.events.splice(0, state.events.length - 400);
}

export function processInputs(state) {
  const inputs = state.inputs;
  state.inputs = [];
  for (const inp of inputs) {
    const team = state.teams[inp.side];
    if (!team) continue;
    const target = team.units[inp.index];
    if (!target || target.hp <= 0 || target.state !== "bench") continue;
    if (inp.type === "pick" && team.pendingPick) beginSwitch(state, team, inp.index, "pick");
    if (inp.type === "switch" && !team.pendingPick && activeUnit(team).state === "active") beginSwitch(state, team, inp.index, "manual");
  }
}

export function beginSwitch(state, team, inIndex, reason) {
  const out = activeUnit(team);
  if (out.state === "active" || out.state === "entering") {
    out.state = "bench";
    out.cast = null;
    out.burst = null;
    out.knockback = null;
    out.vel = { x: 0, y: 0 };
    pushEvent(state, { kind: "switch-out", unitId: out.id, side: team.side, x: out.pos.x, y: out.pos.y });
    logLine(state, `${team.side} withdrew ${out.name} (HP ${out.hp}/${out.maxHp}, cooldowns: ${out.moves.map((m) => Math.max(0, m.cdUntil - state.tick)).join("/")} ticks) [${reason}]`);
  }
  const inUnit = team.units[inIndex];
  inUnit.state = "entering";
  inUnit.entryUntil = state.tick + secToTicks(engine.switching.sec);
  inUnit.pos = { x: out.pos.x, y: out.pos.y };
  inUnit.vel = { x: 0, y: 0 };
  inUnit.revealed = true;
  inUnit.nextThinkTick = inUnit.entryUntil;
  team.activeIndex = inIndex;
  team.pendingPick = false;
  pushEvent(state, { kind: "switch-in", unitId: inUnit.id, side: team.side, name: inUnit.name, x: inUnit.pos.x, y: inUnit.pos.y });
  logLine(state, `${team.side} sent out ${inUnit.name} (HP ${inUnit.hp}/${inUnit.maxHp}, cooldowns: ${inUnit.moves.map((m) => Math.max(0, m.cdUntil - state.tick)).join("/")} ticks) [${reason}]`);
}

function updateTeamFlow(state, team) {
  const u = activeUnit(team);
  if (u.state === "entering" && state.tick >= u.entryUntil) {
    u.state = "active";
    u.nextThinkTick = state.tick;
  }
  if (u.state === "fainting" && state.tick >= u.faintUntil) {
    u.state = "fainted";
    const bench = aliveBench(team);
    if (!bench.length) team.defeated = true;
    else if (team.side === "npc" || state.autoPick) {
      const enemy = activeUnit(enemyOf(state, team.side));
      beginSwitch(state, team, bestMatchupIndex(state, team, enemy), team.side === "npc" ? "ai-faint" : "auto-pick");
    } else {
      team.pendingPick = true;
      pushEvent(state, { kind: "pending-pick", side: team.side });
    }
  }
}

function desiredDirection(state, unit, enemy) {
  const toEnemy = norm(sub(enemy.pos, unit.pos));
  const d = dist(unit.pos, enemy.pos);
  const it = unit.intent;
  let dir = { x: 0, y: 0 };
  let speedMult = 1;
  switch (it.mode) {
    case "backoff":
    case "retreat":
      dir = scale(toEnemy, -1);
      break;
    case "waypoint": {
      const to = sub({ x: it.x, y: it.y }, unit.pos);
      if (len(to) < 0.3) unit.intent = { mode: "hold" };
      else dir = norm(to);
      break;
    }
    case "approach": {
      const ang = (engine.movement.approachAngleDeg * Math.PI) / 180;
      dir = unit.kite ? toEnemy : rotate(toEnemy, ang * unit.strafe.dir);
      break;
    }
    default: {
      const s = unit.strafe;
      if (state.tick >= s.until) {
        if (s.pausing) {
          s.pausing = false;
          s.dir = state.rng.chance(0.5) ? 1 : -1;
          s.length = state.rng.range(engine.strafe.minTiles, engine.strafe.maxTiles);
          s.start = { x: unit.pos.x, y: unit.pos.y };
          s.until = state.tick + secToTicks(engine.strafe.maxSec);
        } else {
          s.pausing = true;
          s.until = state.tick + secToTicks(state.rng.range(engine.strafe.minSec, engine.strafe.maxSec));
          unit.drift = { x: state.rng.range(-1, 1), y: state.rng.range(-1, 1), until: s.until };
        }
      }
      if (!s.pausing && dist(unit.pos, s.start) >= s.length) {
        s.pausing = true;
        s.until = state.tick + secToTicks(state.rng.range(engine.strafe.minSec, engine.strafe.maxSec));
        unit.drift = { x: state.rng.range(-1, 1), y: state.rng.range(-1, 1), until: s.until };
      }
      if (s.pausing) {
        dir = norm(unit.drift);
        speedMult = engine.movement.driftSpeedMult;
      } else {
        dir = perp(toEnemy, s.dir);
      }
      const radial = clamp(d - unit.preferred, -1, 1);
      dir = norm(add(dir, scale(toEnemy, radial * 0.6)));
    }
  }
  if (dir.x === 0 && dir.y === 0) return { dir, speedMult };
  const look = unit.radius + 0.6;
  const probe = (v) => !unitBlockedAt(state, unit.pos.x + v.x * look, unit.pos.y + v.y * look, unit.types, unit.radius);
  if (probe(dir)) return { dir, speedMult };
  for (const deg of [45, -45, 90, -90, 135, -135]) {
    const alt = rotate(dir, (deg * Math.PI) / 180);
    if (probe(alt)) return { dir: alt, speedMult };
  }
  return { dir: { x: 0, y: 0 }, speedMult };
}

function integrate(state, unit, vel) {
  const nx = unit.pos.x + vel.x * DT;
  const ny = unit.pos.y + vel.y * DT;
  let blocked = false;
  if (!unitBlockedAt(state, nx, unit.pos.y, unit.types, unit.radius)) unit.pos.x = nx;
  else {
    vel.x = 0;
    blocked = true;
  }
  if (!unitBlockedAt(state, unit.pos.x, ny, unit.types, unit.radius)) unit.pos.y = ny;
  else {
    vel.y = 0;
    blocked = true;
  }
  unit.pos.x = clamp(unit.pos.x, unit.radius, state.terrain.cols - unit.radius);
  unit.pos.y = clamp(unit.pos.y, unit.radius, state.terrain.rows - unit.radius);
  return blocked;
}

function updateMovement(state, unit, enemy) {
  const prev = { x: unit.pos.x, y: unit.pos.y };
  const tile = tileAt(state, unit.pos.x, unit.pos.y);
  const tileMult = movementMult(state, tile, unit.types) || 1;
  const vmax = unitTopSpeed(unit) * tileMult;

  if (unit.knockback) {
    const kb = unit.knockback;
    const stepLen = Math.min(kb.remaining, engine.knockback.speed * DT);
    integrate(state, unit, scale(kb.dir, stepLen / DT));
    kb.remaining -= stepLen;
    if (kb.remaining <= 1e-6) unit.knockback = null;
    unit.vel = { x: 0, y: 0 };
  } else if (unit.burst && state.tick < unit.burst.until) {
    const b = unit.burst;
    unit.vel = scale(b.dir, vmax * b.speedMult);
    const blocked = integrate(state, unit, unit.vel);
    if (b.kind === "dash") {
      b.path.push({ x: unit.pos.x, y: unit.pos.y });
      if (b.hit && enemy && hittable(enemy) && !b.hitIds.includes(enemy.id) && overlaps(unit, enemy)) {
        b.hitIds.push(enemy.id);
        applyHit(state, unit, enemy, unit.moves[b.moveIdx], "dash");
      }
      if (blocked) b.until = state.tick;
    }
  } else {
    if (unit.burst) {
      if (unit.burst.kind === "dash") pushEvent(state, { kind: "dash-end", unitId: unit.id, path: unit.burst.path, type: unit.moves[unit.burst.moveIdx].type });
      unit.burst = null;
    }
    const friction = frictionFor(state, tile, unit.types);
    let target = { x: 0, y: 0 };
    let active = false;
    if (unit.state === "active" && enemy) {
      const { dir, speedMult } = desiredDirection(state, unit, enemy);
      if (dir.x !== 0 || dir.y !== 0) {
        unit.heading = rotateToward(unit.heading, angleOf(dir), TURN * DT);
        target = scale(fromAngle(unit.heading), vmax * speedMult);
        active = true;
      }
    }
    const rate = active ? vmax / friction.accelSec : vmax / friction.decelSec;
    unit.vel = moveToward(unit.vel, target, rate * DT);
    integrate(state, unit, unit.vel);
  }

  if (unit.state === "active") {
    const moved = dist(prev, unit.pos);
    unit.distanceMoved += moved;
    if (enemy) {
      unit.distSum += dist(unit.pos, enemy.pos);
      unit.distCount++;
    }
    const speed = len(unit.vel);
    if (Math.abs(unit.vel.x) > 0.3) unit.facingX = unit.vel.x > 0 ? 1 : -1;
    else if (enemy && speed < 0.3) unit.facingX = enemy.pos.x >= unit.pos.x ? 1 : -1;
    if (speed > 0.5) {
      const a = angleOf(unit.vel);
      if (unit.lastMoveAngle != null && Math.abs(angleDiff(unit.lastMoveAngle, a)) > Math.PI / 3 && state.tick - (unit.lastTurnTick || -99) >= 6) {
        unit.directionChanges = (unit.directionChanges || 0) + 1;
        unit.lastTurnTick = state.tick;
      }
      unit.lastMoveAngle = a;
    }
  }
}

function resolveUnitCollision(state) {
  const a = activeUnit(state.teams.player);
  const b = activeUnit(state.teams.npc);
  if (!a || !b || a.state === "fainted" || b.state === "fainted" || a.state === "bench" || b.state === "bench") return;
  if (!overlaps(a, b)) return;
  const d = dist(a.pos, b.pos);
  const push = (a.radius + b.radius - d) / 2 + 0.001;
  const dir = d < 1e-6 ? { x: 0, y: 1 } : norm(sub(a.pos, b.pos));
  a.pos = add(a.pos, scale(dir, push));
  b.pos = sub(b.pos, scale(dir, push));
}

function checkFaints(state) {
  for (const side of ["player", "npc"]) {
    const team = state.teams[side];
    for (const b of team.units) {
      if (b.state === "bench" && b.hp <= 0) {
        b.state = "fainted";
        logLine(state, `${b.name} fainted on the bench (burn)`);
      }
    }
    const u = activeUnit(team);
    if (u.hp <= 0 && (u.state === "active" || u.state === "entering")) {
      u.state = "fainting";
      u.faintUntil = state.tick + secToTicks(engine.switching.faintPuffSec);
      u.cast = null;
      u.burst = null;
      u.knockback = null;
      u.vel = { x: 0, y: 0 };
      const killer = u.lastHitBy ? findUnitById(state, u.lastHitBy) : null;
      if (killer) killer.kills++;
      pushEvent(state, { kind: "faint", unitId: u.id, side, x: u.pos.x, y: u.pos.y });
      logLine(state, `${u.name} fainted${killer ? ` (by ${killer.name})` : ""}`);
    }
  }
}

function findUnitById(state, id) {
  for (const side of ["player", "npc"]) for (const u of state.teams[side].units) if (u.id === id) return u;
  return null;
}

function checkEnd(state) {
  const p = state.teams.player.defeated;
  const n = state.teams.npc.defeated;
  if (!p && !n) return;
  state.phase = "ended";
  state.endTick = state.tick;
  state.winner = p && n ? engine.doubleKoWinner : p ? "npc" : "player";
  pushEvent(state, { kind: "end", winner: state.winner });
  logLine(state, `battle ended: winner ${state.winner} at tick ${state.tick} (${(state.tick / TICK_RATE).toFixed(1)}s)`);
}

function recordTrace(state) {
  if (!state.trace) return;
  const u = activeUnit(state.teams.player);
  state.trace.push({ tick: state.tick, x: u.pos.x, y: u.pos.y, unit: u.id, mode: u.intent.mode });
  if (state.trace.length > 3600) state.trace.shift();
}

export function remainingCount(team) {
  return team.units.filter((u) => u.hp > 0 && u.state !== "fainted" && u.state !== "fainting").length;
}

export function runHeadless(state, maxTicks = 60 * 600) {
  while (state.phase === "running" && state.tick < maxTicks) step(state);
  return summary(state);
}

export function summary(state) {
  const rem = (team) => team.units.filter((u) => u.hp > 0 && u.state !== "fainted" && u.state !== "fainting").length;
  return {
    seed: state.seed,
    winner: state.winner,
    endTick: state.endTick ?? state.tick,
    durationSec: +((state.endTick ?? state.tick) / TICK_RATE).toFixed(2),
    remaining: { player: rem(state.teams.player), npc: rem(state.teams.npc) },
    hp: { player: state.teams.player.units.map((u) => u.hp), npc: state.teams.npc.units.map((u) => u.hp) },
  };
}
