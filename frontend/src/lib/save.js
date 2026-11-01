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
    speciesWins: {},
    gauntlet: { runs: 0, clears: 0, bestStage: 0 },
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    if (parsed?.version !== SAVE_VERSION) return defaultSave();
    return { ...defaultSave(), ...parsed, gauntlet: { ...defaultSave().gauntlet, ...parsed.gauntlet } };
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
