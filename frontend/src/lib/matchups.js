import { typeChart } from "@/game/config";

// Single authoritative matrix — the same `typeChart` the battle engine uses in game/damage.js.
const ALL = Object.keys(typeChart.attack);

export const allTypes = () => [...ALL];

// Multiplier of a single attacking type vs a creature's (1-2) type combo.
export function multiplierAgainst(attackType, defTypes) {
  const row = typeChart.attack[attackType] || {};
  return defTypes.reduce((m, t) => m * (row[t] ?? 1), 1);
}

// Incoming damage categories for a creature's type combo against every attacking type.
export function defenseMatchups(types) {
  const mult = {};
  for (const a of ALL) mult[a] = multiplierAgainst(a, types);
  return {
    weak4: ALL.filter((a) => mult[a] === 4),
    weak2: ALL.filter((a) => mult[a] === 2),
    neutral: ALL.filter((a) => mult[a] === 1),
    resist2: ALL.filter((a) => mult[a] === 0.5),
    resist4: ALL.filter((a) => mult[a] === 0.25),
    immune: ALL.filter((a) => mult[a] === 0),
  };
}

// Types that a set of (move or STAB) types hit super-effectively against a single defender type.
export function superEffectiveTargets(types) {
  const set = new Set();
  for (const t of types) {
    const row = typeChart.attack[t] || {};
    for (const d of ALL) if ((row[d] ?? 1) === 2) set.add(d);
  }
  return [...set].sort();
}

// Offensive STAB coverage = super-effective targets of the creature's own types.
export const offenseStrengths = (types) => superEffectiveTargets(types);
