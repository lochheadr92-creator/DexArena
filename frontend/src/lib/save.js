export const SAVE_KEY = "arenadex.save.v1";
export const SAVE_VERSION = 1;
export const TEAM_SIZE = 6;

export function defaultSave() {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    totalWins: 0,
    totalBattles: 0,
    unlocked: [],
    team: [],
    terrain: "pitch",
    rivalLevel: 2,
    speciesWins: {},
    speciesKoCredit: {},
    speciesStandingCredit: {},
    lastCreditedBattle: null,
    items: {},
    abilities: {},
    gauntlet: { runs: 0, clears: 0, bestStage: 0, active: null, history: [] },
    daily: { key: null, attempts: 0, best: null, history: [] },
    presets: [],
    replays: [],
  };
}

export function validateSave(obj) {
  if (!obj || typeof obj !== "object") return "Not a save file";
  if (obj.version !== SAVE_VERSION) return `Unsupported save version (${obj.version ?? "none"})`;
  if (!Array.isArray(obj.team) || !Array.isArray(obj.unlocked) || typeof obj.totalWins !== "number" || typeof obj.totalBattles !== "number" || typeof obj.speciesWins !== "object") return "Malformed save file";
  return null;
}

const cleanItems = (items) =>
  Object.fromEntries(Object.entries(items && typeof items === "object" ? items : {}).filter(([id, n]) => /^[a-z0-9-]+$/.test(id) && Number.isInteger(n) && n > 0));

const cleanAbilities = (abilities) =>
  Object.fromEntries(Object.entries(abilities && typeof abilities === "object" ? abilities : {}).filter(([id, slot]) => /^\d+$/.test(id) && (slot === 0 || slot === 1)));

export const HISTORY_MAX = 20;
const cleanHistory = (history) =>
  (Array.isArray(history) ? history : []).filter((e) => e && typeof e === "object" && Array.isArray(e.team) && typeof e.outcome === "string").slice(0, HISTORY_MAX);

export const DAILY_HISTORY_MAX = 60;
const isDayKey = (k) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);
const cleanBest = (best) => (best && typeof best === "object" && Number.isFinite(best.score) ? best : null);
const cleanDaily = (daily, d) => {
  if (!daily || typeof daily !== "object") return d;
  const best = cleanBest(daily.best);
  const key = isDayKey(daily.key) ? daily.key : null;
  const attempts = Number.isInteger(daily.attempts) && daily.attempts > 0 ? daily.attempts : 0;
  let history = (Array.isArray(daily.history) ? daily.history : [])
    .filter((e) => e && typeof e === "object" && isDayKey(e.key) && cleanBest(e.best))
    .map((e) => ({ key: e.key, attempts: Number.isInteger(e.attempts) && e.attempts > 0 ? e.attempts : 1, best: e.best }));
  if (key && best && !history.some((e) => e.key === key)) history = [{ key, attempts: Math.max(1, attempts), best }, ...history];
  const seen = new Set();
  history = history
    .filter((e) => !seen.has(e.key) && seen.add(e.key))
    .sort((a, b) => (a.key < b.key ? 1 : -1))
    .slice(0, DAILY_HISTORY_MAX);
  return { key, attempts: key ? attempts : 0, best: key ? best : null, history };
};

const PRESET_LIMIT = 5;
const cleanPresets = (presets) =>
  (Array.isArray(presets) ? presets : [])
    .filter((p) => p && typeof p === "object" && typeof p.id === "string" && typeof p.name === "string" && Array.isArray(p.team) && p.team.length === TEAM_SIZE && p.team.every((id) => Number.isInteger(id) && id > 0))
    .map((p) => ({ id: p.id, name: p.name.slice(0, 20), team: [...p.team], abilities: cleanAbilities(p.abilities), savedAt: Number.isFinite(p.savedAt) ? p.savedAt : Date.now() }))
    .slice(0, PRESET_LIMIT);

const REPLAY_LIMIT = 20;
const cleanReplays = (replays) =>
  (Array.isArray(replays) ? replays : [])
    .filter((r) => r && typeof r === "object" && typeof r.id === "string" && typeof r.name === "string" && typeof r.code === "string" && r.code.length > 0 && r.code.length < 20000 && r.meta && typeof r.meta === "object")
    .map((r) => ({ id: r.id, name: r.name.slice(0, 20), code: r.code, meta: r.meta, savedAt: Number.isFinite(r.savedAt) ? r.savedAt : Date.now() }))
    .slice(0, REPLAY_LIMIT);

export function normalizeSave(parsed) {
  const d = defaultSave();
  const lvl = Math.round(Number(parsed.rivalLevel));
  return {
    ...d,
    ...parsed,
    rivalLevel: Number.isFinite(lvl) ? Math.min(6, Math.max(1, lvl)) : d.rivalLevel,
    items: cleanItems(parsed.items),
    abilities: cleanAbilities(parsed.abilities),
    gauntlet: { ...d.gauntlet, ...(parsed.gauntlet || {}), history: cleanHistory(parsed.gauntlet?.history) },
    daily: cleanDaily(parsed.daily, d.daily),
    presets: cleanPresets(parsed.presets),
    replays: cleanReplays(parsed.replays),
  };
}

export function loadSave(key = SAVE_KEY) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    if (parsed?.version !== SAVE_VERSION) return defaultSave();
    return normalizeSave(parsed);
  } catch {
    return defaultSave();
  }
}

export function persistSave(save, key = SAVE_KEY) {
  const next = { ...save, updatedAt: Date.now() };
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* storage full or blocked */
  }
  return next;
}

export function clearSave(key = SAVE_KEY) {
  localStorage.removeItem(key);
}
