import { engine, secToTicks } from "@/game/config";
import { expectedDamage, effectiveness } from "@/game/damage";
import { tileAt, moveDamageMult, damageTakenMult, findFavourableTile, projectileBlocked } from "@/game/terrain";
import { startCast, unitTopSpeed } from "@/game/combat";
import { aliveBench } from "@/game/state";
import { dist } from "@/game/physics";
import { isLoafing, isTrapped } from "@/game/abilities";

const terrainMultFor = (state, target, move) => {
  const tile = tileAt(state, target.pos.x, target.pos.y);
  return moveDamageMult(state, tile, move.type) * damageTakenMult(state, tile, target.types);
};

export const dashDistance = (unit, state = null) => unitTopSpeed(unit, state) * engine.shapes.dash.speedMult * (engine.shapes.dash.sec - engine.movement.accelSec / 2);

export function hasLineOfSight(state, from, to) {
  const d = dist(from, to);
  const steps = Math.max(1, Math.ceil(d / 0.25));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (projectileBlocked(tileAt(state, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t))) return false;
  }
  return true;
}

export function inRange(state, unit, enemy, move, d) {
  switch (move.shape) {
    case "projectile":
      return d <= engine.shapes.projectile.range && hasLineOfSight(state, unit.pos, enemy.pos);
    case "area":
      return d <= engine.shapes.area.range;
    case "melee":
      return d <= engine.shapes.melee.reach + enemy.radius;
    case "dash":
      return d <= dashDistance(unit, state) + unit.radius + enemy.radius;
    default:
      return true;
  }
}

function incomingThreat(state, unit, enemy) {
  const horizon = engine.ai.shieldHorizonSec;
  for (const p of state.projectiles) {
    if (p.side === unit.side || !p.hit) continue;
    const dx = unit.pos.x - p.pos.x;
    const dy = unit.pos.y - p.pos.y;
    const along = dx * p.dir.x + dy * p.dir.y;
    const lateral = Math.abs(p.dir.x * dy - p.dir.y * dx);
    if (along > 0 && lateral < unit.radius + p.radius + 0.3 && along / p.speed <= horizon) return true;
  }
  if (enemy.cast && enemy.moves[enemy.cast.idx].shape === "area" && dist(enemy.cast.target, unit.pos) <= engine.shapes.area.radius + unit.radius) return true;
  return false;
}

const engageDistance = (state, unit, enemy, move) => {
  const f = engine.ai.impatientRangeFraction;
  switch (move.shape) {
    case "projectile":
      return engine.shapes.projectile.range * f;
    case "area":
      return engine.shapes.area.range * f;
    case "dash":
      return (dashDistance(unit, state) + unit.radius + enemy.radius) * f;
    default:
      return engine.shapes.melee.reach + enemy.radius;
  }
};

export function aiThink(state, unit, enemy, team) {
  const ranked = unit.moves
    .map((m, i) => ({ m, i, v: expectedDamage(unit, enemy, m, terrainMultFor(state, enemy, m), state) }))
    .sort((a, b) => b.v - a.v || a.i - b.i);
  const top = ranked[0];
  const canHurt = ranked.some((r) => r.v > 0);
  unit.kite = !!top && (top.m.shape === "projectile" || top.m.shape === "area");
  unit.preferred = (unit.kite ? engine.ai.kiteDistance : engine.ai.closeDistance) / unit.aggression;
  unit.impatient = canHurt && state.tick - Math.max(unit.lastDealtTick, unit.enteredTick) >= secToTicks(engine.ai.patienceSec);
  if (unit.impatient) unit.preferred = Math.min(unit.preferred, engageDistance(state, unit, enemy, top.m));

  const d = dist(unit.pos, enemy.pos);
  const ready = ranked.filter((r) => state.tick >= r.m.cdUntil);
  const damaging = ready.filter((r) => r.v > 0);
  const usable = damaging.filter((r) => inRange(state, unit, enemy, r.m, d));
  let action = null;
  const shieldMove = ready.find((r) => r.m.shape === "shield");
  if (shieldMove && !unit.shield && incomingThreat(state, unit, enemy)) action = shieldMove;
  else if (usable.length) action = usable[0];
  else if (unit.hp >= unit.maxHp && !unit.buff) action = ready.find((r) => r.m.shape === "buff") || null;
  if (action && !unit.cast && !unit.burst && !isLoafing(state, unit)) startCast(state, unit, enemy, action.i);

  if (state.tick < unit.backoffUntil) unit.intent = { mode: "backoff" };
  else {
    const fav = findFavourableTile(state, unit);
    const mustClose = damaging.length && !usable.length;
    if (fav && !(mustClose && dist(fav, enemy.pos) > d)) unit.intent = { mode: "waypoint", x: fav.x, y: fav.y };
    else if (!canHurt) unit.intent = { mode: "hold" };
    else if (mustClose) unit.intent = { mode: "approach" };
    else if (d > unit.preferred + engine.movement.holdBand) unit.intent = { mode: "approach" };
    else if (d < unit.preferred - engine.movement.holdBand && !unit.impatient) unit.intent = { mode: "retreat" };
    else unit.intent = { mode: "hold" };
  }
  unit.nextThinkTick = state.tick + team.reactionTicks;
}

const maxEff = (moves, defTypes) => moves.reduce((m, mv) => (mv.power > 0 ? Math.max(m, effectiveness(mv.type, defTypes)) : m), 0);

export function bestMatchupIndex(state, team, enemy) {
  const bench = aliveBench(team);
  if (!bench.length) return -1;
  let best = null;
  for (const u of bench) {
    const score = maxEff(u.moves, enemy.types) - maxEff(enemy.moves, u.types);
    if (!best || score > best.score) best = { u, score };
  }
  return best.u.index;
}

export function npcSwitchDecision(state, team, enemy) {
  const active = team.units[team.activeIndex];
  if (active.state !== "active" || team.pendingPick) return -1;
  const bench = aliveBench(team);
  if (!bench.length || isTrapped(state, team)) return -1;
  const threat = maxEff(enemy.moves, active.types);
  if (threat >= 4) {
    const answer = bench.find((u) => maxEff(u.moves, enemy.types) >= 2 && maxEff(enemy.moves, u.types) < 4);
    if (answer) return answer.index;
  }
  if (active.hp < active.maxHp * engine.ai.switchHpFraction && !active.lowHpEvaluated) {
    active.lowHpEvaluated = true;
    if (state.rng.chance(team.params.switchWillingness)) return bestMatchupIndex(state, team, enemy);
  }
  return -1;
}

export const reactionTicksOf = (params) => Math.max(1, secToTicks(params.reactionDelaySec));
