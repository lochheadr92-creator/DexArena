import { terrains as terrainConfig, modifiers, engine, secToTicks } from "@/game/config";

export function buildTerrain(id) {
  const t = terrainConfig.terrains[id];
  const legend = terrainConfig.legend;
  const tiles = t.grid.map((row) => [...row].map((ch) => legend[ch]));
  return { id, name: t.name, cols: terrainConfig.cols, rows: terrainConfig.rows, tiles, floor: t.floor, palette: t.palette };
}

const mods = (state) => modifiers.terrains[state.terrain.id] || {};

export function baseTileAt(state, x, y) {
  const c = Math.floor(x);
  const r = Math.floor(y);
  if (c < 0 || r < 0 || c >= state.terrain.cols || r >= state.terrain.rows) return "wall";
  return state.terrain.tiles[r][c];
}

export function tileAt(state, x, y) {
  const c = Math.floor(x);
  const r = Math.floor(y);
  const o = state.tileOverrides[`${c},${r}`];
  if (o && o.untilTick > state.tick) return o.tile;
  return baseTileAt(state, x, y);
}

function lookupByTypes(table, types, fallback) {
  if (!table) return fallback;
  let best = null;
  for (const t of types) if (table[t] != null) best = best == null ? table[t] : Math.max(best, table[t]);
  if (best != null) return best;
  return table["*"] ?? fallback;
}

export function movementMult(state, tile, types, hover = false) {
  if (hover && tile !== "wall") return 1;
  const blocked = modifiers.blockedTiles.includes(tile) ? 0 : 1;
  return lookupByTypes(mods(state).movement?.[tile], types, blocked);
}

export function damageTakenMult(state, tile, types) {
  const table = mods(state).damageTaken?.[tile];
  if (!table) return 1;
  let best = null;
  for (const t of types) if (table[t] != null) best = best == null ? table[t] : Math.min(best, table[t]);
  return best ?? table["*"] ?? 1;
}

export function moveDamageMult(state, tile, moveType) {
  return mods(state).moveDamage?.[tile]?.[moveType] ?? 1;
}

export function frictionFor(state, tile, types, hover = false) {
  const table = mods(state).friction?.[tile];
  const base = { accelSec: engine.movement.accelSec, decelSec: engine.movement.decelSec };
  if (!table || hover) return base;
  for (const t of types) if (table[t]) return table[t];
  return table["*"] || base;
}

export const projectileBlocked = (tile) => modifiers.projectileBlockedTiles.includes(tile);

export function unitBlockedAt(state, x, y, types, radius, hover = false) {
  const r = radius * 0.7;
  for (const [dx, dy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
    if (movementMult(state, tileAt(state, x + dx, y + dy), types, hover) === 0) return true;
  }
  return false;
}

export function applyMelt(state, cx, cy, radius, moveType) {
  const melt = mods(state).melt;
  if (!melt) return [];
  const changed = [];
  for (let r = Math.floor(cy - radius); r <= Math.floor(cy + radius); r++) {
    for (let c = Math.floor(cx - radius); c <= Math.floor(cx + radius); c++) {
      if ((c + 0.5 - cx) ** 2 + (r + 0.5 - cy) ** 2 > radius * radius) continue;
      const tile = tileAt(state, c + 0.5, r + 0.5);
      const rule = melt[tile]?.[moveType];
      if (!rule) continue;
      state.tileOverrides[`${c},${r}`] = { tile: rule.becomes, untilTick: state.tick + secToTicks(rule.sec), from: tile };
      changed.push({ c, r, from: tile, to: rule.becomes });
    }
  }
  return changed;
}

export function findFavourableTile(state, unit) {
  const range = engine.ai.favourableTileRange;
  const here = tileAt(state, unit.pos.x, unit.pos.y);
  const score = (tile) => movementMult(state, tile, unit.types, unit.hover) - damageTakenMult(state, tile, unit.types);
  const current = score(here);
  let best = null;
  for (let r = Math.floor(unit.pos.y - range); r <= Math.floor(unit.pos.y + range); r++) {
    for (let c = Math.floor(unit.pos.x - range); c <= Math.floor(unit.pos.x + range); c++) {
      const cx = c + 0.5;
      const cy = r + 0.5;
      const d2 = (cx - unit.pos.x) ** 2 + (cy - unit.pos.y) ** 2;
      if (d2 > range * range) continue;
      const tile = tileAt(state, cx, cy);
      const mult = movementMult(state, tile, unit.types, unit.hover);
      if (mult === 0) continue;
      const s = score(tile);
      if (s > current + 1e-6 && (!best || s > best.s || (s === best.s && d2 < best.d2))) best = { x: cx, y: cy, s, d2, tile };
    }
  }
  return best;
}
