import { isSealed } from "@/lib/unlocks";

export const EVOLUTION_THRESHOLDS = { 2: 3, 3: 5 };
export const SEAL_KEY_WINS = 10;
export const KO_BONUS = 1;
export const STANDING_BONUS = 1;

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

export function battleBonuses(state) {
  const win = state.winner === "player";
  const enemies = state.teams.npc.units;
  return state.teams.player.units.map((u) => {
    const kos = enemies.filter((e) => e.hp <= 0 && e.lastHitBy === u.id && !e.lastHitIndirect).length;
    const entered = (u.entries || 0) > 0;
    return { speciesId: u.creatureId, name: u.name, entered, kos: win ? kos : 0, standing: win && entered && u.hp > 0 };
  });
}

export function speciesCredit(save, id) {
  const wins = save.speciesWins[id] || 0;
  const koCredit = save.speciesKoCredit?.[id] || 0;
  const standingCredit = save.speciesStandingCredit?.[id] || 0;
  return { wins, koCredit, standingCredit, totalCredit: wins + koCredit + standingCredit };
}

export function creditBattle(save, { win, playerIds, battleId = null, bonuses = [] }, creatures, unlockedIds) {
  if (battleId && save.lastCreditedBattle === battleId) return { save, newUnlocks: [], keysEarned: 0, credited: false, rows: [] };
  const speciesWins = { ...save.speciesWins };
  const speciesKoCredit = { ...(save.speciesKoCredit || {}) };
  const speciesStandingCredit = { ...(save.speciesStandingCredit || {}) };
  const rows = [];
  if (win) {
    for (const id of playerIds) speciesWins[id] = (speciesWins[id] || 0) + 1;
    for (const b of bonuses) {
      const ko = b.kos * KO_BONUS;
      const standing = b.standing ? STANDING_BONUS : 0;
      if (ko) speciesKoCredit[b.speciesId] = (speciesKoCredit[b.speciesId] || 0) + ko;
      if (standing) speciesStandingCredit[b.speciesId] = (speciesStandingCredit[b.speciesId] || 0) + standing;
      rows.push({ speciesId: b.speciesId, name: b.name, win: 1, ko, standing, total: 1 + ko + standing });
    }
  }
  const totalWins = save.totalWins + (win ? 1 : 0);
  const next = { ...save, totalBattles: save.totalBattles + 1, totalWins, speciesWins, speciesKoCredit, speciesStandingCredit, lastCreditedBattle: battleId };
  const newUnlocks = win ? pendingUnlocks(creatures, unlockedIds, speciesWins) : [];
  if (newUnlocks.length) next.unlocked = [...new Set([...save.unlocked, ...newUnlocks])];
  const keysEarned = Math.floor(totalWins / SEAL_KEY_WINS) - Math.floor(save.totalWins / SEAL_KEY_WINS);
  return { save: next, newUnlocks, keysEarned, credited: true, rows };
}

export const playerHasLegendary = (unlockedIds, creatures) => [...unlockedIds].some((id) => creatures[id] && isSealed(creatures[id]));
