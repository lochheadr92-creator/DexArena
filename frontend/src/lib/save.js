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
    gauntlet: { runs: 0, clears: 0, bestStage: 0, active: null },
  };
}

export function validateSave(obj) {
  if (!obj || typeof obj !== "object") return "Not a save file";
  if (obj.version !== SAVE_VERSION) return `Unsupported save version (${obj.version ?? "none"})`;
  if (!Array.isArray(obj.team) || !Array.isArray(obj.unlocked) || typeof obj.totalWins !== "number" || typeof obj.totalBattles !== "number" || typeof obj.speciesWins !== "object") return "Malformed save file";
  return null;
}

export function normalizeSave(parsed) {
  const d = defaultSave();
  return { ...d, ...parsed, gauntlet: { ...d.gauntlet, ...(parsed.gauntlet || {}) } };
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
