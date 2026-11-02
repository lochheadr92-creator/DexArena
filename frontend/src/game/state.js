import { engine, archetypes as archetypeConfig, difficulty as difficultyConfig, secToTicks } from "@/game/config";
import { makeRng } from "@/game/rng";
import { battleStats } from "@/game/stats";
import { buildTerrain } from "@/game/terrain";

export function difficultyParams(archetype, slot) {
  const d = difficultyConfig.slots.find((s) => s.slot === slot) || difficultyConfig.slots[0];
  return {
    aggression: archetype.aggression,
    dodgeChance: archetype.dodgeChance * d.dodgeMult,
    reactionDelaySec: archetype.reactionDelaySec * d.reactionDelayMult,
    switchWillingness: engine.switchWillingness[archetype.switchWillingness] ?? engine.switchWillingness.medium,
  };
}

export function playerParams() {
  const p = archetypeConfig.playerDefaults;
  return { aggression: p.aggression, dodgeChance: p.dodgeChance, reactionDelaySec: p.reactionDelaySec, switchWillingness: engine.switchWillingness[p.switchWillingness] };
}

function makeUnit(creature, moves, side, index, params, spawn) {
  const stats = battleStats(creature.stats);
  const ratio = stats.atk / (stats.atk + stats.def);
  const aggression = Math.min(engine.ai.aggressionMax, Math.max(engine.ai.aggressionMin, ratio)) * params.aggression;
  return {
    id: `${side}-${index}`,
    side,
    index,
    creatureId: creature.id,
    name: creature.displayName,
    types: creature.types,
    base: creature.stats,
    stats,
    maxHp: stats.hp,
    hp: stats.hp,
    radius: engine.unit.radius,
    aggression,
    moves: moves.map((m) => ({ ...m, cdUntil: 0 })),
    pos: { x: spawn.x, y: spawn.y },
    vel: { x: 0, y: 0 },
    heading: side === "player" ? -Math.PI / 2 : Math.PI / 2,
    facingX: 1,
    state: "bench",
    entryUntil: 0,
    faintUntil: 0,
    nextThinkTick: 0,
    intent: { mode: "hold" },
    strafe: { dir: 1, until: 0, pausing: true, length: 0, start: null },
    drift: { x: 0, y: 0, until: 0 },
    cast: null,
    burst: null,
    knockback: null,
    shield: null,
    buff: null,
    burn: null,
    paralysis: null,
    burnAcc: 0,
    backoffUntil: 0,
    dodgeCooldownUntil: 0,
    lowHpEvaluated: false,
    revealed: false,
    lastHitBy: null,
    lastCastTick: -999,
    kills: 0,
    damageDealt: 0,
    dodges: 0,
    distanceMoved: 0,
    distSum: 0,
    distCount: 0,
    entryDamage: 0,
    preferred: 3,
    kite: false,
  };
}

export function createBattle({ seed, terrainId, player, npc, autoPick = false, trace = false }) {
  const terrain = buildTerrain(terrainId);
  const spawns = { player: { x: 8, y: 24 }, npc: { x: 8, y: 3 } };
  const mkTeam = (side, cfg) => {
    const params = cfg.params;
    const units = cfg.creatures.map((c, i) => makeUnit(c, cfg.movesets[i], side, i, params, spawns[side]));
    if (cfg.initialHp) {
      units.forEach((u, i) => {
        if (cfg.initialHp[i] == null) return;
        u.hp = Math.max(0, Math.min(u.maxHp, Math.floor(cfg.initialHp[i])));
        if (u.hp <= 0) u.state = "fainted";
      });
    }
    return {
      side,
      name: cfg.name || (side === "player" ? "You" : "Rival"),
      archetypeId: cfg.archetypeId || null,
      params,
      reactionTicks: Math.max(1, secToTicks(params.reactionDelaySec)),
      units,
      activeIndex: Math.max(0, units.findIndex((u) => u.hp > 0)),
      pendingPick: false,
      defeated: false,
    };
  };
  const state = {
    seed: seed >>> 0,
    rng: makeRng(seed >>> 0),
    tick: 0,
    phase: "running",
    winner: null,
    endTick: null,
    terrain,
    tileOverrides: {},
    teams: { player: mkTeam("player", player), npc: mkTeam("npc", npc) },
    projectiles: [],
    nextId: 1,
    events: [],
    nextEventId: 1,
    log: [],
    inputs: [],
    inputLog: [],
    replayInputs: null,
    autoPick,
    trace: trace ? [] : null,
    dodgeLog: [],
    meltLog: [],
  };
  for (const side of ["player", "npc"]) {
    const team = state.teams[side];
    const u = team.units[team.activeIndex];
    u.state = "entering";
    u.entryUntil = secToTicks(engine.switching.sec);
    u.revealed = true;
    pushEvent(state, { kind: "switch-in", unitId: u.id, side, name: u.name, x: u.pos.x, y: u.pos.y });
  }
  return state;
}

export function pushEvent(state, ev) {
  state.events.push({ id: state.nextEventId++, tick: state.tick, ...ev });
}

export function logLine(state, line) {
  state.log.push(`[t${state.tick}] ${line}`);
  if (state.log.length > 4000) state.log.splice(0, 1000);
}

export const activeUnit = (team) => team.units[team.activeIndex];
export const enemyOf = (state, side) => state.teams[side === "player" ? "npc" : "player"];
export const aliveBench = (team) => team.units.filter((u) => u.state === "bench" && u.hp > 0);
