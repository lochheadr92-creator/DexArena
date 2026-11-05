// Rare recolored "shiny" variants. Deterministic per-save (seeded) and keyed by
// evolution family, so a whole line is shiny together and the set is stable across reloads.
export const SHINY_RATE = 14; // ~1 in 14 families
export const SHINY_FILTER = "hue-rotate(145deg) saturate(1.5) contrast(1.04) brightness(1.05)";

const shinyKey = (creature) => (creature?.chainId ?? creature?.id ?? 0);

export function isShiny(creature, seed) {
  if (!creature || seed == null) return false;
  const k = shinyKey(creature) >>> 0;
  let h = Math.imul(k ^ 0x9e3779b9, 2654435761) ^ Math.imul((seed >>> 0) || 1, 40503);
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) % SHINY_RATE === 0;
}
