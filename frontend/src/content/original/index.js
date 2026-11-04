import creaturesArr from "./creatures.json";
import movesArr from "./moves.json";
import abilityNames from "./abilityNames.json";
import { registerMoves } from "@/game/moveData";

// Original-roster content is bundled with the app — no PokeAPI fetch required.
export const ORIGINAL_ABILITY_NAMES = abilityNames;
export const ORIGINAL_CREATURES = creaturesArr;
export const ORIGINAL_MOVES = movesArr;

let installed = false;

// Seed the shared move cache so ensureMoves() resolves original moves instantly (offline).
export function installOriginalContent() {
  if (installed) return;
  registerMoves(movesArr);
  installed = true;
}

export function loadOriginalCreatures() {
  installOriginalContent();
  const map = {};
  for (const c of creaturesArr) map[c.id] = c;
  return map;
}
