import { engine, shapeMapping } from "@/game/config";

export const STRUGGLE_ID = 165;
const includesAny = (s, keys) => keys.some((k) => s.includes(k));

export function classifyShape(m) {
  const name = m.name.toLowerCase();
  const text = (m.effectText || "").toLowerCase();
  if (m.damageClass === "special") {
    return (m.power || 0) >= shapeMapping.specialProjectilePower && includesAny(name, shapeMapping.projectileKeywords) ? "projectile" : "area";
  }
  if (m.damageClass === "physical") return includesAny(name, shapeMapping.dashKeywords) ? "dash" : "melee";
  return includesAny(text, shapeMapping.shieldKeywords) ? "shield" : "buff";
}

export const isDamaging = (m) => m.damageClass !== "status" && (m.power || 0) > 0;
export const isStatusShape = (shape) => shape === "shield" || shape === "buff";

export function moveCooldownSec(m) {
  if (m.damageClass === "status") return engine.cooldown.status;
  const { divisor, min, max } = engine.cooldown;
  return Math.min(max, Math.max(min, (m.power || 0) / divisor));
}

export function statusOf(m, shape) {
  const text = (m.effectText || "").toLowerCase();
  for (const kind of Object.keys(shapeMapping.statusKeywords)) {
    if (includesAny(text, shapeMapping.statusKeywords[kind])) {
      const chance = m.effectChance == null ? 100 : m.effectChance;
      if (isStatusShape(shape)) return { kind, chance, attaches: false };
      return { kind, chance, attaches: true };
    }
  }
  return null;
}

export function toBattleMove(m) {
  const shape = classifyShape(m);
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    power: m.power || 0,
    accuracy: m.accuracy,
    damageClass: m.damageClass,
    shape,
    cooldownSec: moveCooldownSec(m),
    status: statusOf(m, shape),
  };
}

const byPowerDesc = (a, b) => (b.power || 0) - (a.power || 0) || a.id - b.id;

export function buildMoveset(creature, moveMap, log = []) {
  const learn = creature.moves.map((m) => moveMap[m.id]).filter(Boolean);
  const damaging = learn.filter(isDamaging).sort(byPowerDesc);
  const statusMoves = [...creature.moves]
    .filter((lm) => moveMap[lm.id]?.damageClass === "status")
    .sort((a, b) => b.level - a.level || a.id - b.id)
    .map((lm) => moveMap[lm.id]);
  const chosen = [];
  const take = (m) => m && !chosen.includes(m) && chosen.length < 4 && chosen.push(m);

  creature.types.forEach((t) => take(damaging.find((m) => m.type === t && !chosen.includes(m))));
  damaging.forEach(take);
  if (chosen.length < 4 && statusMoves.length) take(statusMoves[0]);
  if (chosen.length < 4) {
    const tms = (creature.tmMoves || []).map((m) => moveMap[m.id]).filter(Boolean).filter(isDamaging).sort(byPowerDesc);
    const before = chosen.length;
    tms.forEach(take);
    if (chosen.length > before) log.push(`${creature.name}: fewer than 4 damaging learnset moves — filled ${chosen.length - before} from TM: ${chosen.slice(before).map((m) => m.name).join(", ")}`);
  }
  if (chosen.length < 4) statusMoves.forEach(take);
  while (chosen.length < 4) {
    const struggle = moveMap[STRUGGLE_ID];
    if (!struggle) break;
    chosen.push(struggle);
    log.push(`${creature.name}: no learnable move left for slot ${chosen.length} — padded with Struggle`);
  }
  return chosen.map(toBattleMove);
}

export function learnableMoveIds(creature) {
  const ids = new Set(creature.moves.map((m) => m.id));
  (creature.tmMoves || []).forEach((m) => ids.add(m.id));
  return [...ids];
}
