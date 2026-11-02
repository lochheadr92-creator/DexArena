import { API_BASE, fetchJson, flattenChain, normalizeCreature } from "@/lib/pokeapi";
import { idbGetAll, idbPut, idbClear, STORE_CREATURES } from "@/lib/idb";

export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SCHEMA_VERSION = 4;
const CONCURRENCY = 10;

export async function loadCachedCreatures() {
  try {
    const rows = await idbGetAll(STORE_CREATURES);
    const now = Date.now();
    return rows.filter((r) => r.schema === SCHEMA_VERSION && r.cachedAt && now - r.cachedAt < CACHE_TTL_MS);
  } catch {
    return [];
  }
}

export async function clearCreatureCache() {
  try {
    await idbClear(STORE_CREATURES);
  } catch {
    /* cache unavailable */
  }
}

export function fetchCreatures(ids, { onCreature, onError }) {
  const chainCache = new Map();
  const getChain = (url) => {
    if (!chainCache.has(url)) {
      const p = fetchJson(url)
        .then(flattenChain)
        .catch((err) => {
          chainCache.delete(url);
          throw err;
        });
      chainCache.set(url, p);
    }
    return chainCache.get(url);
  };

  const queue = [...ids];
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift();
      try {
        const [pokemon, species] = await Promise.all([
          fetchJson(`${API_BASE}/pokemon/${id}`),
          fetchJson(`${API_BASE}/pokemon-species/${id}`),
        ]);
        const nodes = await getChain(species.evolution_chain.url);
        const creature = normalizeCreature(pokemon, species, nodes);
        idbPut(STORE_CREATURES, { ...creature, schema: SCHEMA_VERSION, cachedAt: Date.now() }).catch(() => {});
        onCreature(creature);
      } catch (err) {
        onError(id, err);
      }
    }
  };

  return Promise.all(Array.from({ length: CONCURRENCY }, worker));
}
