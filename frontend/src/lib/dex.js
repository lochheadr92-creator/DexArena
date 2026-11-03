import { API_BASE, fetchJson, flattenChain, normalizeCreature, gen4Abilities } from "@/lib/pokeapi";
import { idbGetAll, idbPut, idbClear, STORE_CREATURES } from "@/lib/idb";

export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SCHEMA_VERSION = 5;
const PATCHABLE_SCHEMAS = new Set([4]);
const CONCURRENCY = 10;

export const needsAbilityPatch = (c) => c.schema !== SCHEMA_VERSION;

export async function loadCachedCreatures() {
  try {
    const rows = await idbGetAll(STORE_CREATURES);
    const now = Date.now();
    return rows.filter((r) => (r.schema === SCHEMA_VERSION || PATCHABLE_SCHEMAS.has(r.schema)) && r.cachedAt && now - r.cachedAt < CACHE_TTL_MS);
  } catch {
    return [];
  }
}

export function patchAbilities(creatures, { onCreature, onError }) {
  const queue = [...creatures];
  const worker = async () => {
    while (queue.length) {
      const c = queue.shift();
      try {
        const pokemon = await fetchJson(`${API_BASE}/pokemon/${c.id}`);
        const patched = { ...c, abilities: gen4Abilities(pokemon), schema: SCHEMA_VERSION };
        idbPut(STORE_CREATURES, patched).catch(() => {});
        onCreature(patched);
      } catch (err) {
        onError(c.id, err);
      }
    }
  };
  return Promise.all(Array.from({ length: CONCURRENCY }, worker));
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
