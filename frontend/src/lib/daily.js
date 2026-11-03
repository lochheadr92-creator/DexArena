import { archetypes as archetypeConfig, difficulty, TICK_RATE } from "@/game/config";
import { makeRng } from "@/game/rng";
import { TERRAINS } from "@/lib/terrains";
import { generateNpcTeam } from "@/game/teamgen";
import { randomAbility } from "@/game/abilities";
import { legendWeather } from "@/lib/rival";

export const DAILY = difficulty.daily;

export const dailyKey = (d = new Date()) => d.toISOString().slice(0, 10);

export function dailySeed(key) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h ^ 0xda11) >>> 0;
}

export const attemptSeed = (seed, attempt) => (seed + Math.imul(attempt, 0x9e3779b1)) >>> 0;

export function msUntilReset(now = new Date()) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime();
}

export async function buildDaily(creatures, key = dailyKey()) {
  const seed = dailySeed(key);
  const rng = makeRng(seed);
  const terrainId = rng.pick(TERRAINS).id;
  const archetypeId = rng.pick(DAILY.archetypes);
  const log = [];
  const team = await generateNpcTeam({ rng, creatures, unlockedIds: new Set(), archetype: archetypeConfig.archetypes[archetypeId], budget: DAILY.budget, pool: "all", tierPicks: 6, allowLegendary: false, log });
  const npcAbilityIds = team.map((c) => randomAbility(c, rng));
  return { key, seed, terrainId, archetypeId, npcIds: team.map((c) => c.id), npcAbilityIds, weather: legendWeather(terrainId, DAILY.level), log };
}

export const todaysDaily = (save, key) => (save.daily?.key === key ? save.daily : { key, attempts: 0, best: null });

export function dailySetup(daily, save) {
  const attempts = todaysDaily(save, daily.key).attempts;
  return { playerIds: save.team, terrainId: daily.terrainId, seed: attemptSeed(daily.seed, attempts), archetypeId: daily.archetypeId, npcIds: daily.npcIds, npcAbilityIds: daily.npcAbilityIds, rivalLevel: DAILY.level, totalWins: save.totalWins, initialWeather: daily.weather };
}

export function dailyResult(state) {
  const win = state.winner === "player";
  const standing = state.teams.player.units.filter((u) => u.hp > 0).length;
  const kos = state.teams.npc.units.filter((u) => u.hp <= 0).length;
  const seconds = +(state.endTick / TICK_RATE).toFixed(1);
  const score = (win ? 1000 : 0) + standing * 100 + kos * 50 + (win ? Math.max(0, 300 - Math.round(seconds)) : 0);
  return { win, standing, kos, seconds, score, at: Date.now() };
}

export function recordDaily(save, key, result) {
  const cur = todaysDaily(save, key);
  const isBest = !cur.best || result.score > cur.best.score;
  return { save: { ...save, daily: { key, attempts: cur.attempts + 1, best: isBest ? result : cur.best } }, isBest };
}

export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export const shareText = (key, r) => `Arena Dex Daily ${key} · ${r.win ? "WIN" : "LOSS"} in ${fmtTime(r.seconds)} · ${r.standing} standing · ${r.kos} KOs · score ${r.score}`;
