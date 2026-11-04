import { MAX_ID } from "@/lib/pokeapi";
import { SAVE_KEY } from "@/lib/save";

// The two independent rosters. Each keeps its own save file so progress never collides.
export const ROSTERS = {
  pokemon: { id: "pokemon", name: "Pokémon", kind: "pokemon", total: MAX_ID, saveKey: SAVE_KEY, contentVersion: 5, hasGenerations: true },
  original: { id: "original", name: "Original", kind: "original", total: 150, saveKey: "arenadex.save.original.v1", contentVersion: 1, hasGenerations: false },
};

export const ROSTER_IDS = Object.keys(ROSTERS);
const ROSTER_KEY = "arenadex.roster.v1";

export function loadRosterId() {
  try {
    const v = localStorage.getItem(ROSTER_KEY);
    return ROSTERS[v] ? v : "pokemon";
  } catch {
    return "pokemon";
  }
}

export function saveRosterId(id) {
  try {
    localStorage.setItem(ROSTER_KEY, id);
  } catch {
    /* storage unavailable */
  }
}
