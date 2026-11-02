import { difficulty } from "@/game/config";

export const RIVAL_LEVELS = difficulty.rivalLevels;
export const MIN_LEVEL = RIVAL_LEVELS[0].level;
export const MAX_LEVEL = RIVAL_LEVELS[RIVAL_LEVELS.length - 1].level;

export const clampLevel = (n) => Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(Number(n) || difficulty.defaultRivalLevel)));
export const levelConfig = (level) => RIVAL_LEVELS.find((l) => l.level === clampLevel(level));

export function selfPower(teamCreatures, totalWins) {
  const list = teamCreatures.filter(Boolean);
  if (!list.length) return 0;
  const avgBst = list.reduce((s, c) => s + c.bst, 0) / list.length;
  const winPart = Math.min(difficulty.selfPower.winCap, difficulty.selfPower.winWeight * (totalWins || 0));
  return Math.round(avgBst + winPart);
}

export function rivalBudget(power, level) {
  return Math.round(power * levelConfig(level).mult);
}

export function rivalPlan(teamCreatures, totalWins, level) {
  const cfg = levelConfig(level);
  const power = selfPower(teamCreatures, totalWins);
  return { level: cfg.level, name: cfg.name, slot: cfg.slot, power, budget: rivalBudget(power, cfg.level), pool: cfg.pool, tierPicks: cfg.tierPicks, legendary: cfg.legendary };
}
