// Rare recolored "shiny" variants. Deterministic per-save (seeded) and keyed by
// evolution family, so a whole line is shiny together and the set is stable across reloads.
export const SHINY_RATE = 14; // default: ~1 in 14 families
export const SHINY_FILTER = "hue-rotate(145deg) saturate(1.5) contrast(1.04) brightness(1.05)";

// User-tunable odds (families per shiny). 0 = off.
export const SHINY_PRESETS = [
  { value: 0, label: "Off" },
  { value: 30, label: "Rare" },
  { value: 14, label: "Normal" },
  { value: 6, label: "Common" },
  { value: 3, label: "Very common" },
];

const shinyKey = (creature) => (creature?.chainId ?? creature?.id ?? 0);

export function isShiny(creature, seed, rate = SHINY_RATE) {
  if (!creature || seed == null || !rate || rate <= 0) return false;
  const k = shinyKey(creature) >>> 0;
  let h = Math.imul(k ^ 0x9e3779b9, 2654435761) ^ Math.imul((seed >>> 0) || 1, 40503);
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) % rate === 0;
}
