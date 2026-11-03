import { typeChart, engine } from "@/game/config";
import { statMult, powerMult, damageTakenMult, stabFor, immunity, accuracyFor } from "@/game/abilities";

export function effectiveness(moveType, defTypes, attacker = null) {
  const row = typeChart.attack[moveType] || {};
  const types = attacker?.ability === "scrappy" && (moveType === "normal" || moveType === "fighting") ? defTypes.filter((t) => t !== "ghost") : defTypes;
  return types.reduce((m, t) => m * (row[t] ?? 1), 1);
}

export function effectiveStat(unit, key, state = null) {
  const base = unit.stats[key];
  const buffed = unit.buff && unit.buff.stat === key ? base * unit.buff.mult : base;
  return state ? buffed * statMult(state, unit, key) : buffed;
}

export function baseDamage(attacker, defender, move, state = null) {
  const physical = move.damageClass === "physical";
  const atk = effectiveStat(attacker, physical ? "atk" : "spa", state);
  const def = effectiveStat(defender, physical ? "def" : "spd", state);
  return (((2 * engine.LEVEL) / 5 + 2) * move.power * atk) / def / 50 + 2;
}

const abilityMult = (state, attacker, defender, move, eff) => (state ? powerMult(state, attacker, defender, move, eff) * damageTakenMult(state, attacker, defender, move, eff) : 1);

export function computeDamage(attacker, defender, move, terrainMult, roll, state = null) {
  const eff = effectiveness(move.type, defender.types, attacker);
  if (eff === 0) return { damage: 0, eff, stab: 1 };
  const stab = attacker.types.includes(move.type) ? stabFor(attacker) : 1;
  const rand = engine.RANDOM_MIN + (engine.RANDOM_MAX - engine.RANDOM_MIN) * roll;
  const raw = baseDamage(attacker, defender, move, state) * stab * eff * terrainMult * rand * engine.DAMAGE_SCALE * abilityMult(state, attacker, defender, move, eff);
  return { damage: Math.max(1, Math.floor(raw)), eff, stab };
}

export function expectedDamage(attacker, defender, move, terrainMult = 1, state = null) {
  if (move.damageClass === "status" || !move.power) return 0;
  if (state && immunity(state, attacker, defender, move)) return 0;
  const eff = effectiveness(move.type, defender.types, attacker);
  if (eff === 0) return 0;
  const stab = attacker.types.includes(move.type) ? stabFor(attacker) : 1;
  const accuracy = state ? accuracyFor(state, attacker, defender, move) : move.accuracy;
  const acc = accuracy == null ? 1 : accuracy / 100;
  return baseDamage(attacker, defender, move, state) * stab * eff * terrainMult * engine.DAMAGE_SCALE * acc * abilityMult(state, attacker, defender, move, eff);
}
