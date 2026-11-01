import { typeChart, engine } from "@/game/config";

export function effectiveness(moveType, defTypes) {
  const row = typeChart.attack[moveType] || {};
  return defTypes.reduce((m, t) => m * (row[t] ?? 1), 1);
}

export function effectiveStat(unit, key) {
  const base = unit.stats[key];
  return unit.buff && unit.buff.stat === key ? base * unit.buff.mult : base;
}

export function baseDamage(attacker, defender, move) {
  const physical = move.damageClass === "physical";
  const atk = effectiveStat(attacker, physical ? "atk" : "spa");
  const def = effectiveStat(defender, physical ? "def" : "spd");
  return (((2 * engine.LEVEL) / 5 + 2) * move.power * atk) / def / 50 + 2;
}

export function computeDamage(attacker, defender, move, terrainMult, roll) {
  const eff = effectiveness(move.type, defender.types);
  if (eff === 0) return { damage: 0, eff, stab: 1 };
  const stab = attacker.types.includes(move.type) ? engine.STAB : 1;
  const rand = engine.RANDOM_MIN + (engine.RANDOM_MAX - engine.RANDOM_MIN) * roll;
  const raw = baseDamage(attacker, defender, move) * stab * eff * terrainMult * rand * engine.DAMAGE_SCALE;
  return { damage: Math.max(1, Math.floor(raw)), eff, stab };
}

export function expectedDamage(attacker, defender, move, terrainMult = 1) {
  if (move.damageClass === "status" || !move.power) return 0;
  const eff = effectiveness(move.type, defender.types);
  if (eff === 0) return 0;
  const stab = attacker.types.includes(move.type) ? engine.STAB : 1;
  const acc = move.accuracy == null ? 1 : move.accuracy / 100;
  return baseDamage(attacker, defender, move) * stab * eff * terrainMult * engine.DAMAGE_SCALE * acc;
}
