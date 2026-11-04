import { useSyncExternalStore } from "react";
import { animations } from "@/game/config";

const KEY = "arenadex.gfx.v1";
const Q = animations.quality;
export const GFX_LEVELS = Object.keys(Q.levels);
export const GFX_STEP_DOWN_FPS = Q.autoStepDownFps;
const listeners = new Set();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && Q.levels[raw.level]) return { level: raw.level, auto: raw.auto !== false };
  } catch {
    /* ignore */
  }
  return { level: Q.default, auto: true };
}

let current = load();

export const getGfx = () => current;
export const gfxConfig = (level = current.level) => Q.levels[level] || Q.levels[Q.default];

export function setGfx(patch) {
  const next = { ...current, ...patch };
  if (!Q.levels[next.level]) next.level = Q.default;
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(current));
  return current;
}

export function subscribeGfx(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const useGfx = () => useSyncExternalStore(subscribeGfx, getGfx, getGfx);

export class FpsGovernor {
  constructor() {
    this.low = 0;
  }

  sample(fps) {
    if (!current.auto || fps <= 0) return null;
    this.low = fps < Q.autoStepDownFps ? this.low + 1 : 0;
    if (this.low < Q.autoStepDownSec) return null;
    this.low = 0;
    const i = GFX_LEVELS.indexOf(current.level);
    if (i <= 0) return null;
    return setGfx({ level: GFX_LEVELS[i - 1] }).level;
  }
}

if (typeof window !== "undefined") {
  window.__gfx = { get: getGfx, set: (level, auto) => setGfx({ level, ...(auto == null ? {} : { auto }) }), config: gfxConfig, levels: GFX_LEVELS };
}
