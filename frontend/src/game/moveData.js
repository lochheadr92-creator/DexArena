import { API_BASE, fetchJson } from "@/lib/pokeapi";
import { idbGet, idbPut, STORE_MOVES } from "@/lib/idb";
import { CACHE_TTL_MS } from "@/lib/dex";

const memory = new Map();
const inflight = new Map();
const CONCURRENCY = 10;

const english = (arr, key) => arr?.find((e) => e.language.name === "en")?.[key] || "";

export function normalizeMove(raw) {
  const eff = raw.effect_entries || [];
  const effectText = `${english(eff, "short_effect")} ${english(eff, "effect")}`.trim();
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type.name,
    power: raw.power,
    accuracy: raw.accuracy,
    damageClass: raw.damage_class.name,
    priority: raw.priority,
    effectChance: raw.effect_chance,
    effectText,
  };
}

async function loadOne(id) {
  if (memory.has(id)) return memory.get(id);
  if (inflight.has(id)) return inflight.get(id);
  const p = (async () => {
    try {
      const cached = await idbGet(STORE_MOVES, id);
      if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        memory.set(id, cached);
        return cached;
      }
    } catch {
      /* no cache */
    }
    const raw = await fetchJson(`${API_BASE}/move/${id}`);
    const move = normalizeMove(raw);
    memory.set(id, move);
    idbPut(STORE_MOVES, { ...move, cachedAt: Date.now() }).catch(() => {});
    return move;
  })();
  inflight.set(id, p);
  try {
    return await p;
  } finally {
    inflight.delete(id);
  }
}

export async function ensureMoves(ids, onProgress) {
  const unique = [...new Set(ids)];
  const queue = [...unique];
  let done = 0;
  const worker = async () => {
    while (queue.length) {
      await loadOne(queue.shift());
      done++;
      onProgress?.(done, unique.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length || 1) }, worker));
  const map = {};
  unique.forEach((id) => {
    if (memory.has(id)) map[id] = memory.get(id);
  });
  return map;
}

// Preload a batch of fully-normalized moves (e.g. the Original roster) so
// ensureMoves() resolves them from memory with no network request.
export function registerMoves(list) {
  for (const m of list) memory.set(m.id, m);
}

export const getMoveSync = (id) => memory.get(id);
export const moveMapSnapshot = () => Object.fromEntries(memory);
