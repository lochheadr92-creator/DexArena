export const API_BASE = "https://pokeapi.co/api/v2";
export const SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
export const MAX_ID = 493;

const STAT_KEYS = {
  hp: "hp",
  attack: "atk",
  defense: "def",
  "special-attack": "spa",
  "special-defense": "spd",
  speed: "spe",
};

const MOVE_GROUPS = ["platinum", "heartgold-soulsilver", "diamond-pearl"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson(url, retries = 3) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) throw Object.assign(new Error(`404 ${url}`), { fatal: true });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      if (err.fatal || attempt >= retries) throw err;
      await sleep(400 * 2 ** attempt);
    }
  }
}

export const idFromUrl = (url) => Number(url.replace(/\/$/, "").split("/").pop());

export function generationOf(id) {
  if (id <= 151) return 1;
  if (id <= 251) return 2;
  if (id <= 386) return 3;
  return 4;
}

function levelUpMoves(moves, group) {
  const out = [];
  for (const m of moves) {
    const detail = m.version_group_details.find(
      (v) => v.move_learn_method.name === "level-up" && (!group || v.version_group.name === group),
    );
    if (detail) out.push({ id: idFromUrl(m.move.url), name: m.move.name, level: detail.level_learned_at });
  }
  return out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

export function normalizeMoves(moves) {
  for (const group of MOVE_GROUPS) {
    const found = levelUpMoves(moves, group);
    if (found.length) return found;
  }
  return levelUpMoves(moves, null);
}

export function flattenChain(chainData) {
  const nodes = {};
  const walk = (node, fromId) => {
    const id = idFromUrl(node.species.url);
    const to = node.evolves_to.map((e) => idFromUrl(e.species.url)).filter((x) => x <= MAX_ID);
    nodes[id] = { from: fromId && fromId <= MAX_ID ? fromId : null, to };
    node.evolves_to.forEach((e) => walk(e, id));
  };
  walk(chainData.chain, null);
  return nodes;
}

const english = (arr, key) => arr?.find((n) => n.language.name === "en")?.[key] || "";

export function normalizeCreature(pokemon, species, chainNodes) {
  const stats = {};
  pokemon.stats.forEach((s) => {
    stats[STAT_KEYS[s.stat.name]] = s.base_stat;
  });
  const node = chainNodes[pokemon.id] || { from: null, to: [] };
  return {
    id: pokemon.id,
    name: pokemon.name,
    displayName: english(species.names, "name") || pokemon.name,
    genus: english(species.genera, "genus"),
    types: [...pokemon.types].sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
    stats,
    bst: Object.values(stats).reduce((a, b) => a + b, 0),
    height: pokemon.height,
    weight: pokemon.weight,
    sprite: pokemon.sprites.front_default || `${SPRITE_BASE}/${pokemon.id}.png`,
    artwork:
      pokemon.sprites.other?.["official-artwork"]?.front_default ||
      `${SPRITE_BASE}/other/official-artwork/${pokemon.id}.png`,
    moves: normalizeMoves(pokemon.moves),
    generation: generationOf(pokemon.id),
    isBaby: !!species.is_baby,
    isLegendary: !!species.is_legendary,
    isMythical: !!species.is_mythical,
    captureRate: species.capture_rate,
    chainId: idFromUrl(species.evolution_chain.url),
    evolvesFrom: node.from,
    evolvesTo: node.to,
  };
}
