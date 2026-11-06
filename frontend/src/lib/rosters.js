import { MAX_ID } from "@/lib/pokeapi";
import { SAVE_KEY } from "@/lib/save";
import lot1 from "@/content/original/creatures.json";
import lot2 from "@/content/original/lot2/creatures.json";

export const ORIGINAL_TOTAL = lot1.length + lot2.length;

// The two independent rosters. Each keeps its own save file so progress never collides.
export const ROSTERS = {
  pokemon: { id: "pokemon", name: "Pokémon", kind: "pokemon", total: MAX_ID, saveKey: SAVE_KEY, contentVersion: 5, hasGenerations: true },
  original: { id: "original", name: "Original", kind: "original", total: ORIGINAL_TOTAL, lots: [1, 2], saveKey: "arenadex.save.original.v1", contentVersion: 1, hasGenerations: false },
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
