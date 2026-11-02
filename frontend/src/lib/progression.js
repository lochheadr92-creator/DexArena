import { isSealed } from "@/lib/unlocks";

export const EVOLUTION_THRESHOLDS = { 2: 3, 3: 5 };
export const SEAL_KEY_WINS = 10;

export function stageOf(creature, creatures) {
  let stage = 1;
  let c = creature;
  while (c.evolvesFrom != null && creatures[c.evolvesFrom]) {
    c = creatures[c.evolvesFrom];
    stage++;
  }
  return stage;
}

export const evolutionThreshold = (creature, creatures) => EVOLUTION_THRESHOLDS[Math.min(3, Math.max(2, stageOf(creature, creatures)))];

export function evolutionProgress(creature, creatures, save) {
  if (isSealed(creature) || creature.evolvesFrom == null || !creatures[creature.evolvesFrom]) return null;
  const pre = creatures[creature.evolvesFrom];
  return { pre, have: save.speciesWins[pre.id] || 0, needed: evolutionThreshold(creature, creatures) };
}

export function sealKeys(save, creatures) {
  const earned = Math.floor(save.totalWins / SEAL_KEY_WINS);
  const spent = save.unlocked.filter((id) => creatures[id] && isSealed(creatures[id])).length;
  return { earned, spent, available: Math.max(0, earned - spent), nextIn: SEAL_KEY_WINS - (save.totalWins % SEAL_KEY_WINS) };
}

export function pendingUnlocks(creatures, unlockedIds, speciesWins) {
  return Object.values(creatures)
    .filter((c) => !unlockedIds.has(c.id) && !isSealed(c) && c.evolvesFrom != null && unlockedIds.has(c.evolvesFrom) && (speciesWins[c.evolvesFrom] || 0) >= evolutionThreshold(c, creatures))
    .map((c) => c.id)
    .sort((a, b) => a - b);
}

export function creditBattle(save, { win, playerIds }, creatures, unlockedIds) {
  const speciesWins = { ...save.speciesWins };
  if (win) for (const id of playerIds) speciesWins[id] = (speciesWins[id] || 0) + 1;
  const totalWins = save.totalWins + (win ? 1 : 0);
  const next = { ...save, totalBattles: save.totalBattles + 1, totalWins, speciesWins };
  const newUnlocks = win ? pendingUnlocks(creatures, unlockedIds, speciesWins) : [];
  if (newUnlocks.length) next.unlocked = [...new Set([...save.unlocked, ...newUnlocks])];
  const keysEarned = Math.floor(totalWins / SEAL_KEY_WINS) - Math.floor(save.totalWins / SEAL_KEY_WINS);
  return { save: next, newUnlocks, keysEarned };
}

export const playerHasLegendary = (unlockedIds, creatures) => [...unlockedIds].some((id) => creatures[id] && isSealed(creatures[id]));
