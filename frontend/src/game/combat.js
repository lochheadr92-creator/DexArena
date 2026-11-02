import { engine, secToTicks, TICK_RATE } from "@/game/config";
import { computeDamage } from "@/game/damage";
import { tileAt, moveDamageMult, damageTakenMult, projectileBlocked, applyMelt } from "@/game/terrain";
import { pushEvent, logLine, activeUnit, enemyOf } from "@/game/state";
import { dist, norm, sub, add, scale, dot, cross, angleOf, angleDiff, overlaps } from "@/game/physics";
import { topSpeed } from "@/game/stats";

export const hittable = (u) => u.state === "active";
export const targetable = (u) => u.state === "active" || u.state === "entering";

export function startCast(state, unit, enemy, idx) {
  const m = unit.moves[idx];
  m.cdUntil = state.tick + secToTicks(m.cooldownSec);
  const hit = m.accuracy == null || m.accuracy >= 100 || state.rng.chance(m.accuracy / 100);
  const windup = m.shape === "area" ? secToTicks(engine.shapes.area.windupSec) : 0;
  unit.cast = { idx, startTick: state.tick, releaseTick: state.tick + windup, target: { x: enemy.pos.x, y: enemy.pos.y }, hit };
  unit.lastCastTick = state.tick;
  unit.facingX = enemy.pos.x >= unit.pos.x ? 1 : -1;
  pushEvent(state, { kind: "cast", unitId: unit.id, shape: m.shape, type: m.type, move: m.name, x: unit.pos.x, y: unit.pos.y, tx: enemy.pos.x, ty: enemy.pos.y, windupTicks: windup });
  if (!windup) releaseCast(state, unit, enemy);
}

export function releaseCast(state, unit, enemy) {
  const c = unit.cast;
  const m = unit.moves[c.idx];
  unit.cast = null;
  unit.releaseTick = state.tick;
  const toTarget = norm(sub(c.target, unit.pos));
  const dir = toTarget.x === 0 && toTarget.y === 0 ? { x: 0, y: -1 } : toTarget;
  if (!c.hit) logLine(state, `${unit.name} used ${m.name}: missed (accuracy ${m.accuracy})`);
  switch (m.shape) {
    case "projectile": {
      const p = engine.shapes.projectile;
      const proj = {
        id: state.nextId++,
        side: unit.side,
        ownerId: unit.id,
        moveIdx: c.idx,
        pos: add(unit.pos, scale(dir, unit.radius + 0.1)),
        dir,
        speed: p.speed,
        traveled: 0,
        range: p.range,
        radius: p.radius,
        type: m.type,
        hit: c.hit,
        noticed: {},
        dodgeLogIdx: null,
        spawnTick: state.tick,
      };
      state.projectiles.push(proj);
      pushEvent(state, { kind: "projectile-spawn", id: proj.id, type: m.type, x: proj.pos.x, y: proj.pos.y });
      break;
    }
    case "area": {
      const a = engine.shapes.area;
      pushEvent(state, { kind: "area-detonate", type: m.type, x: c.target.x, y: c.target.y, radius: a.radius });
      if (c.hit && hittable(enemy) && dist(enemy.pos, c.target) <= a.radius + enemy.radius) applyHit(state, unit, enemy, m, "area");
      else if (c.hit && enemy.state === "entering" && dist(enemy.pos, c.target) <= a.radius + enemy.radius) logEntryBlock(state, enemy, m);
      const melted = applyMelt(state, c.target.x, c.target.y, a.radius, m.type);
      if (melted.length) {
        state.meltLog.push({ tick: state.tick, move: m.name, tiles: melted });
        logLine(state, `${m.name} melted ${melted.length} ${melted[0].from} tile(s) → ${melted[0].to} at ${melted.map((t) => `(${t.c},${t.r})`).join(" ")}`);
        pushEvent(state, { kind: "melt", tiles: melted });
      }
      break;
    }
    case "melee": {
      const me = engine.shapes.melee;
      unit.backoffUntil = state.tick + secToTicks(engine.melee.backoffSec);
      pushEvent(state, { kind: "melee-swing", unitId: unit.id, type: m.type, x: unit.pos.x, y: unit.pos.y, dx: dir.x, dy: dir.y });
      const d = dist(unit.pos, enemy.pos);
      const within = d <= me.reach + enemy.radius && Math.abs(angleDiff(angleOf(dir), angleOf(sub(enemy.pos, unit.pos)))) <= (me.arcDeg / 2) * (Math.PI / 180);
      if (c.hit && within && hittable(enemy)) applyHit(state, unit, enemy, m, "melee");
      else if (c.hit && within && enemy.state === "entering") logEntryBlock(state, enemy, m);
      break;
    }
    case "dash": {
      const dsh = engine.shapes.dash;
      unit.burst = { kind: "dash", until: state.tick + secToTicks(dsh.sec), dir, speedMult: dsh.speedMult, moveIdx: c.idx, hitIds: [], hit: c.hit, path: [{ x: unit.pos.x, y: unit.pos.y }] };
      unit.backoffUntil = state.tick + secToTicks(dsh.sec + engine.melee.backoffSec);
      pushEvent(state, { kind: "dash-start", unitId: unit.id, type: m.type, x: unit.pos.x, y: unit.pos.y, dx: dir.x, dy: dir.y });
      break;
    }
    case "shield": {
      unit.shield = { until: state.tick + secToTicks(engine.shapes.shield.sec), type: m.type };
      pushEvent(state, { kind: "shield-up", unitId: unit.id, type: m.type });
      logLine(state, `${unit.name} used ${m.name}: shield up for ${engine.shapes.shield.sec}s`);
      break;
    }
    case "buff": {
      const stat = unit.base.spe >= unit.base.atk ? "spe" : "atk";
      unit.buff = { stat, mult: engine.shapes.buff.mult, until: state.tick + secToTicks(engine.shapes.buff.sec), type: m.type };
      pushEvent(state, { kind: "buff", unitId: unit.id, type: m.type, stat });
      logLine(state, `${unit.name} used ${m.name}: ${stat.toUpperCase()} x${engine.shapes.buff.mult} for ${engine.shapes.buff.sec}s${m.status ? ` (status '${m.status.kind}' not attached: self-buff)` : ""}`);
      break;
    }
    default:
      break;
  }
}

function logEntryBlock(state, target, m) {
  target.entryDamage += 0;
  logLine(state, `${m.name} → ${target.name}: 0 dmg (entry window, invulnerable)`);
  pushEvent(state, { kind: "hit", targetId: target.id, damage: 0, eff: 1, type: m.type, x: target.pos.x, y: target.pos.y, blocked: "entry" });
}

export function applyHit(state, attacker, target, move, source) {
  if (!hittable(target)) return false;
  if (target.shield) {
    target.shield = null;
    pushEvent(state, { kind: "shield-break", unitId: target.id, x: target.pos.x, y: target.pos.y, type: move.type });
    logLine(state, `${attacker.name} ${move.name} → ${target.name}: blocked by shield`);
    return false;
  }
  const tile = tileAt(state, target.pos.x, target.pos.y);
  const terrainMult = moveDamageMult(state, tile, move.type) * damageTakenMult(state, tile, target.types);
  const { damage, eff } = computeDamage(attacker, target, move, terrainMult, state.rng.next());
  target.hp = Math.max(0, target.hp - damage);
  attacker.damageDealt += damage;
  if (damage > 0) {
    target.lastHitBy = attacker.id;
    target.lastHitIndirect = false;
  }
  logLine(state, `${attacker.name} ${move.name} [${move.type}/${source}] → ${target.name} [${target.types.join("/")}]: ${eff}x, ${damage} dmg${terrainMult !== 1 ? ` (terrain x${terrainMult} on ${tile})` : ""}`);
  pushEvent(state, { kind: "hit", targetId: target.id, attackerId: attacker.id, damage, eff, type: move.type, source, x: target.pos.x, y: target.pos.y });
  if (eff === 0) return true;
  const kb = source === "melee" ? engine.knockback.melee : source === "dash" ? engine.knockback.dash : 0;
  if (kb > 0) target.knockback = { dir: norm(sub(target.pos, attacker.pos)), remaining: kb };
  if (move.status?.attaches && damage > 0 && state.rng.chance(move.status.chance / 100)) applyStatus(state, attacker, target, move.status.kind);
  return true;
}

export function applyStatus(state, attacker, target, kind) {
  const cfg = engine.status[kind];
  if (kind === "burn") target.burn = { until: state.tick + secToTicks(cfg.sec), by: attacker.id, perTick: (target.maxHp * cfg.fraction) / (cfg.sec * TICK_RATE) };
  if (kind === "paralysis") target.paralysis = { until: state.tick + secToTicks(cfg.sec) };
  pushEvent(state, { kind: "status", unitId: target.id, status: kind, x: target.pos.x, y: target.pos.y });
  logLine(state, `${target.name} is ${kind === "burn" ? "burned" : "paralysed"}`);
}

export function updateProjectiles(state) {
  const dt = 1 / TICK_RATE;
  const keep = [];
  for (const p of state.projectiles) {
    p.pos = add(p.pos, scale(p.dir, p.speed * dt));
    p.traveled += p.speed * dt;
    const tile = tileAt(state, p.pos.x, p.pos.y);
    const owner = findUnit(state, p.ownerId);
    const move = owner.moves[p.moveIdx];
    const enemy = activeUnit(enemyOf(state, p.side));
    if (projectileBlocked(tile)) {
      pushEvent(state, { kind: "projectile-blocked", id: p.id, type: p.type, x: p.pos.x, y: p.pos.y });
      logLine(state, `${owner.name}'s ${move.name} projectile hit ${tile} at (${Math.floor(p.pos.x)},${Math.floor(p.pos.y)}) — despawned, ${enemy ? `target ${dist(p.pos, enemy.pos).toFixed(1)} tiles away` : ""}`);
      settleDodge(state, p, "miss (flew past into terrain)");
      continue;
    }
    if (p.traveled >= p.range) {
      pushEvent(state, { kind: "projectile-expire", id: p.id, type: p.type, x: p.pos.x, y: p.pos.y });
      settleDodge(state, p, "miss");
      continue;
    }
    if (enemy && targetable(enemy) && overlaps(p, enemy)) {
      if (!p.hit) {
        logLine(state, `${owner.name}'s ${move.name} projectile passed through ${enemy.name} (missed roll)`);
        pushEvent(state, { kind: "projectile-expire", id: p.id, type: p.type, x: p.pos.x, y: p.pos.y });
        settleDodge(state, p, "miss");
        continue;
      }
      if (enemy.state === "entering") logEntryBlock(state, enemy, move);
      else applyHit(state, owner, enemy, move, "projectile");
      pushEvent(state, { kind: "projectile-hit", id: p.id, type: p.type, x: p.pos.x, y: p.pos.y });
      settleDodge(state, p, "hit");
      continue;
    }
    keep.push(p);
  }
  state.projectiles = keep;
}

function settleDodge(state, p, outcome) {
  if (p.dodgeLogIdx == null) return;
  const entry = state.dodgeLog[p.dodgeLogIdx];
  entry.outcome = outcome;
  entry.settledTick = state.tick;
  logLine(state, `dodge #${p.dodgeLogIdx} by ${entry.unit}: started ${entry.leadSec.toFixed(2)}s before impact → projectile ${outcome}`);
}

export function detectDodges(state, unit, team) {
  if (unit.state !== "active") return;
  const horizon = engine.dodge.horizonSec;
  for (const p of state.projectiles) {
    if (p.side === unit.side || !p.hit) continue;
    const rel = sub(unit.pos, p.pos);
    const along = dot(rel, p.dir);
    if (along <= 0) continue;
    const lateral = Math.abs(cross(p.dir, rel));
    if (lateral > unit.radius + p.radius + 0.15) continue;
    const eta = along / p.speed;
    if (eta > horizon) continue;
    let n = p.noticed[unit.id];
    if (!n) {
      n = p.noticed[unit.id] = { at: state.tick + team.reactionTicks, dodge: state.rng.chance(team.params.dodgeChance), done: false };
    }
    if (n.done || !n.dodge || state.tick < n.at) continue;
    if (state.tick < unit.dodgeCooldownUntil || unit.burst) continue;
    n.done = true;
    const side = cross(p.dir, rel) >= 0 ? 1 : -1;
    const dir = { x: -p.dir.y * side, y: p.dir.x * side };
    unit.burst = { kind: "dodge", until: state.tick + secToTicks(engine.dodge.sec), dir, speedMult: engine.dodge.speedMult };
    unit.dodgeCooldownUntil = state.tick + secToTicks(engine.dodge.cooldownSec);
    unit.dodges++;
    p.dodgeLogIdx = state.dodgeLog.length;
    state.dodgeLog.push({ tick: state.tick, unit: unit.name, side: unit.side, projectileId: p.id, leadSec: eta, outcome: "pending" });
    pushEvent(state, { kind: "dodge", unitId: unit.id, x: unit.pos.x, y: unit.pos.y });
    return;
  }
}

export function updateStatuses(state, unit) {
  if (unit.burn) {
    if (state.tick >= unit.burn.until) unit.burn = null;
    else if (unit.hp > 0) {
      unit.burnAcc += unit.burn.perTick;
      const whole = Math.floor(unit.burnAcc);
      if (whole > 0) {
        unit.burnAcc -= whole;
        const dealt = Math.min(unit.hp, whole);
        unit.hp -= dealt;
        const by = findUnit(state, unit.burn.by);
        if (by) by.damageDealt += dealt;
        if (unit.hp === 0) {
          unit.lastHitBy = unit.burn.by;
          unit.lastHitIndirect = true;
        }
      }
    }
  }
  if (unit.paralysis && state.tick >= unit.paralysis.until) unit.paralysis = null;
  if (unit.buff && state.tick >= unit.buff.until) unit.buff = null;
  if (unit.shield && state.tick >= unit.shield.until) unit.shield = null;
}

export function findUnit(state, id) {
  for (const side of ["player", "npc"]) for (const u of state.teams[side].units) if (u.id === id) return u;
  return null;
}

export function unitTopSpeed(unit) {
  let v = topSpeed(unit.stats.spe);
  if (unit.buff?.stat === "spe") v *= unit.buff.mult;
  if (unit.paralysis) v *= engine.status.paralysis.speedMult;
  return v;
}
