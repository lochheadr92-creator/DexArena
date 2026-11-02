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

export function machineMoves(moves) {
  for (const group of MOVE_GROUPS) {
    const out = [];
    for (const m of moves) {
      if (m.version_group_details.some((v) => v.move_learn_method.name === "machine" && v.version_group.name === group)) {
        out.push({ id: idFromUrl(m.move.url), name: m.move.name });
      }
    }
    if (out.length) return out.sort((a, b) => a.id - b.id);
  }
  return [];
}

export const ANIM_BASE = `${SPRITE_BASE}/versions/generation-v/black-white/animated`;

function evolutionHow(details = []) {
  if (!details.length) return null;
  const pick = details.find((d) => d.item) || details.find((d) => d.held_item) || details[0];
  return {
    trigger: pick.trigger?.name || null,
    item: pick.item?.name || null,
    heldItem: pick.held_item?.name || null,
    gender: pick.gender ?? null,
    timeOfDay: pick.time_of_day || null,
    minLevel: pick.min_level ?? null,
    minHappiness: pick.min_happiness ?? null,
    minBeauty: pick.min_beauty ?? null,
    location: !!pick.location,
    knownMove: pick.known_move?.name || null,
    knownMoveType: pick.known_move_type?.name || null,
    relativePhysicalStats: pick.relative_physical_stats ?? null,
    partySpecies: pick.party_species?.name || null,
  };
}

export function flattenChain(chainData) {
  const nodes = {};
  const walk = (node, fromId, how) => {
    const id = idFromUrl(node.species.url);
    const to = node.evolves_to.map((e) => idFromUrl(e.species.url)).filter((x) => x <= MAX_ID);
    nodes[id] = { from: fromId && fromId <= MAX_ID ? fromId : null, to, how: fromId && fromId <= MAX_ID ? how : null };
    node.evolves_to.forEach((e) => walk(e, id, evolutionHow(e.evolution_details)));
  };
  walk(chainData.chain, null, null);
  return nodes;
}

const english = (arr, key) => arr?.find((n) => n.language.name === "en")?.[key] || "";

const GEN_ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };
const genNumber = (name) => GEN_ROMAN[name.replace("generation-", "")] || 99;

export function gen4Types(pokemon) {
  const past = (pokemon.past_types || [])
    .map((p) => ({ gen: genNumber(p.generation.name), types: p.types }))
    .filter((p) => p.gen >= 4)
    .sort((a, b) => a.gen - b.gen)[0];
  const source = past ? past.types : pokemon.types;
  return [...source].sort((a, b) => a.slot - b.slot).map((t) => t.type.name);
}

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
    types: gen4Types(pokemon),
    stats,
    bst: Object.values(stats).reduce((a, b) => a + b, 0),
    height: pokemon.height,
    weight: pokemon.weight,
    sprite: pokemon.sprites.front_default || `${SPRITE_BASE}/${pokemon.id}.png`,
    spriteBack: pokemon.sprites.back_default || `${SPRITE_BASE}/back/${pokemon.id}.png`,
    animFront: pokemon.sprites.versions?.["generation-v"]?.["black-white"]?.animated?.front_default || null,
    animBack: pokemon.sprites.versions?.["generation-v"]?.["black-white"]?.animated?.back_default || null,
    artwork:
      pokemon.sprites.other?.["official-artwork"]?.front_default ||
      `${SPRITE_BASE}/other/official-artwork/${pokemon.id}.png`,
    moves: normalizeMoves(pokemon.moves),
    tmMoves: machineMoves(pokemon.moves),
    generation: generationOf(pokemon.id),
    isBaby: !!species.is_baby,
    isLegendary: !!species.is_legendary,
    isMythical: !!species.is_mythical,
    captureRate: species.capture_rate,
    chainId: idFromUrl(species.evolution_chain.url),
    evolvesFrom: node.from,
    evolvesTo: node.to,
    evolution: node.how || null,
  };
}
