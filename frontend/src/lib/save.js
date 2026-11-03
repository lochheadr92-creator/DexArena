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
    daily: { key: null, attempts: 0, best: null },
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

const cleanDaily = (daily, d) => {
  if (!daily || typeof daily !== "object" || typeof daily.key !== "string") return d;
  const best = daily.best && typeof daily.best === "object" && Number.isFinite(daily.best.score) ? daily.best : null;
  return { key: daily.key, attempts: Number.isInteger(daily.attempts) && daily.attempts > 0 ? daily.attempts : 0, best };
};

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
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    if (parsed?.version !== SAVE_VERSION) return defaultSave();
    return normalizeSave(parsed);
  } catch {
    return defaultSave();
  }
}

export function persistSave(save) {
  const next = { ...save, updatedAt: Date.now() };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked */
  }
  return next;
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
