import { typeColors } from "@/game/config";

const STYLES = {
  fire: { shape: "ember", color2: "#fde047", gravity: -4, drag: 1.5, flicker: true, additive: true },
  water: { shape: "drop", color2: "#bfdbfe", gravity: 7 },
  electric: { shape: "spark", color2: "#ffffff", gravity: 0, additive: true },
  ice: { shape: "shard", color2: "#e0f2fe", gravity: 3, spin: 6 },
  grass: { shape: "leaf", color2: "#14532d", gravity: 1.5, spin: 8, drag: 2, sway: 6 },
  poison: { shape: "bubble", color2: "#e9d5ff", gravity: -1.5, drag: 2 },
  psychic: { shape: "sparkle", color2: "#ffffff", gravity: 0, additive: true },
  ghost: { shape: "wisp", color2: "#c4b5fd", gravity: -1, drag: 2, additive: true },
  rock: { shape: "chunk", color2: "#3f2a14", gravity: 9, spin: 5 },
  ground: { shape: "chunk", color2: "#92400e", gravity: 8, spin: 4 },
  dark: { shape: "smoke", color2: "#0f172a", gravity: -0.8, drag: 1.5 },
  steel: { shape: "shard", color2: "#f1f5f9", gravity: 5, spin: 10 },
  dragon: { shape: "sparkle", color2: "#c4b5fd", gravity: -0.5, additive: true },
  fighting: { shape: "spark", color2: "#fed7aa", gravity: 2 },
  flying: { shape: "feather", color2: "#f5f3ff", gravity: 1, drag: 2.5, spin: 3, sway: 4 },
  bug: { shape: "dot", color2: "#d9f99d", gravity: 0, additive: true },
  normal: { shape: "dot", color2: "#ffffff", gravity: 0 },
};

export const typeColor = (type) => typeColors[type]?.bg || "#94a3b8";
export const typeStyle = (type) => ({ shape: "dot", gravity: 0, color: typeColor(type), ...(STYLES[type] || {}) });
export const typeAccent = (type) => typeStyle(type).color2 || "#ffffff";

export function typeBurst(ps, type, x, y, n, opts = {}) {
  const st = typeStyle(type);
  ps.burst(x, y, n, { ...st, ...opts, gravity: opts.gravity ?? st.gravity });
}

export function typeTrail(ps, type, x, y, vx, vy, opts = {}) {
  const st = typeStyle(type);
  ps.spawn({ x, y, vx, vy, maxLife: 0.3, size: 2.5, ...st, ...opts });
}
