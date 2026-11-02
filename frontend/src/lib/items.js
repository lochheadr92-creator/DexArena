import { items as ITEMS } from "@/game/config";
import { makeRng } from "@/game/rng";
import { isSealed } from "@/lib/unlocks";

export const ITEM_SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items";
export const ITEM_CATEGORIES = ITEMS.categories;
const CUSTOM = ITEMS.custom;
const customByTarget = Object.fromEntries(Object.entries(CUSTOM).map(([id, c]) => [c.to, id]));

const NAME_FIX = { "kings-rock": "King's Rock", "up-grade": "Up-Grade", "deep-sea-tooth": "Deep Sea Tooth", "deep-sea-scale": "Deep Sea Scale" };
export const prettyName = (slug) => NAME_FIX[slug] || slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
export const isRareItem = (id) => ITEMS.rare.includes(id);

export function evolutionItemFor(creature) {
  if (!creature || creature.evolvesFrom == null || isSealed(creature)) return null;
  if (customByTarget[creature.id]) return customByTarget[creature.id];
  return creature.evolution?.item || creature.evolution?.heldItem || null;
}

export const isItemLocked = (creature) => evolutionItemFor(creature) != null;

export function itemInfo(id) {
  const custom = CUSTOM[id];
  return custom
    ? { id, name: custom.name, source: "custom", sprite: null, icon: custom.icon, type: custom.type, rare: isRareItem(id), category: "evolution" }
    : { id, name: prettyName(id), source: "pokeapi", sprite: `${ITEM_SPRITE_BASE}/${id}.png`, icon: null, type: null, rare: isRareItem(id), category: "evolution" };
}

export function buildCatalog(creatures) {
  const map = new Map();
  for (const c of Object.values(creatures)) {
    const itemId = evolutionItemFor(c);
    if (!itemId || !creatures[c.evolvesFrom]) continue;
    if (!map.has(itemId)) map.set(itemId, { ...itemInfo(itemId), targets: [] });
    map.get(itemId).targets.push({ from: c.evolvesFrom, to: c.id });
  }
  for (const entry of map.values()) entry.targets.sort((a, b) => a.to - b.to);
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function optionsFor(creatureId, catalog) {
  const out = [];
  for (const item of catalog) for (const t of item.targets) if (t.from === creatureId) out.push({ itemId: item.id, item, to: t.to });
  return out;
}

export const bagCount = (save, itemId) => save.items?.[itemId] || 0;
export const bagTotal = (save) => Object.values(save.items || {}).reduce((a, b) => a + b, 0);

export function rollDrop({ seed, catalog, teamIds, unlockedIds, guaranteed = false, rareOnly = false }) {
  const rng = makeRng(((seed >>> 0) ^ 0x1d0f5e3) >>> 0);
  const hit = guaranteed || rng.chance(ITEMS.drop.winChance);
  if (!hit || !catalog.length) return null;
  const W = ITEMS.drop.weights;
  const weighted = catalog
    .filter((item) => !rareOnly || item.rare)
    .map((item) => {
      const open = item.targets.filter((t) => !unlockedIds.has(t.to));
      let w = W.exhausted;
      if (open.length) {
        if (open.some((t) => teamIds.includes(t.from))) w = W.team;
        else if (open.some((t) => unlockedIds.has(t.from))) w = W.unlocked;
        else w = W.other;
      }
      return { item, w };
    });
  const list = weighted.length ? weighted : catalog.map((item) => ({ item, w: 1 }));
  const total = list.reduce((s, x) => s + x.w, 0);
  let r = rng.range(0, total);
  for (const x of list) {
    r -= x.w;
    if (r <= 0) return x.item.id;
  }
  return list[list.length - 1].item.id;
}

export function addItem(save, itemId, n = 1) {
  const items = { ...(save.items || {}) };
  items[itemId] = (items[itemId] || 0) + n;
  return { ...save, items };
}

export function consumeItem(save, itemId) {
  const have = bagCount(save, itemId);
  if (have <= 0) return null;
  const items = { ...save.items };
  if (have === 1) delete items[itemId];
  else items[itemId] = have - 1;
  return { ...save, items };
}

export function applyEvolutionItem(save, { itemId, fromId, toId }, catalog) {
  const item = catalog.find((i) => i.id === itemId);
  if (!item || !item.targets.some((t) => t.from === fromId && t.to === toId)) return { save, error: "That item does not work on this creature" };
  const next = consumeItem(save, itemId);
  if (!next) return { save, error: "You do not have that item" };
  return { save: { ...next, unlocked: next.unlocked.includes(toId) ? next.unlocked : [...next.unlocked, toId] }, error: null };
}
