import { moveVisuals, typeColors } from "@/game/config";

const ARCH = moveVisuals.archetypes;
const rules = moveVisuals.rules.map((r) => ({ ...r, nameRe: r.name ? new RegExp(r.name) : null, effectRe: r.effect ? new RegExp(r.effect, "i") : null }));
const cache = new Map();

export const typeColor = (type) => typeColors[type]?.bg || "#94a3b8";
const compatible = (archetype, shape) => !!ARCH[archetype] && ARCH[archetype].shapes.includes(shape);

function matches(rule, m) {
  if (rule.nameRe && !rule.nameRe.test(m.name)) return false;
  if (rule.damageClass && !rule.damageClass.includes(m.damageClass)) return false;
  if (rule.types && !rule.types.includes(m.type)) return false;
  if (rule.effectRe && !rule.effectRe.test(m.effectText || "")) return false;
  return true;
}

export function resolveVisual(m) {
  if (!m) return { archetype: "burst", color: typeColor(null), source: "fallback" };
  const key = `${m.id}:${m.shape}`;
  if (cache.has(key)) return cache.get(key);
  let result = null;
  const skipped = [];
  const override = moveVisuals.overrides[m.name];
  if (override) {
    if (compatible(override, m.shape)) result = { archetype: override, source: "override" };
    else skipped.push(`override ${override}`);
  }
  if (!result) {
    for (const rule of rules) {
      if (!matches(rule, m)) continue;
      if (compatible(rule.archetype, m.shape)) {
        result = { archetype: rule.archetype, source: "rule" };
        break;
      }
      skipped.push(`rule ${rule.archetype}`);
    }
  }
  if (!result) result = { archetype: "burst", source: "fallback" };
  const out = { ...result, color: typeColor(m.type), skipped, sec: ARCH[result.archetype].sec };
  cache.set(key, out);
  return out;
}

export function coverageReport(battleMoves) {
  const counts = Object.fromEntries(Object.keys(ARCH).map((k) => [k, 0]));
  const byArchetype = Object.fromEntries(Object.keys(ARCH).map((k) => [k, []]));
  const fallbackDamaging = [];
  const fallbackOther = [];
  const skipped = [];
  let damaging = 0;
  for (const m of battleMoves) {
    const v = resolveVisual(m);
    counts[v.archetype]++;
    byArchetype[v.archetype].push(m.name);
    const isDamaging = m.damageClass !== "status" && (m.power || 0) > 0;
    if (isDamaging) damaging++;
    if (v.source === "fallback") (isDamaging ? fallbackDamaging : fallbackOther).push(`${m.name} [${m.type}/${m.damageClass}/${m.shape}]`);
    if (v.skipped.length) skipped.push(`${m.name} (${m.shape}): skipped ${v.skipped.join(", ")} → ${v.archetype}`);
  }
  return { total: battleMoves.length, damaging, counts, byArchetype, fallbackDamaging, fallbackOther, skipped, fallbackPct: damaging ? +((fallbackDamaging.length / damaging) * 100).toFixed(1) : 0 };
}
