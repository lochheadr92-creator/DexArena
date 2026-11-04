import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MAX_ID } from "@/lib/pokeapi";
import { clearCreatureCache, fetchCreatures, loadCachedCreatures, patchAbilities, needsAbilityPatch } from "@/lib/dex";
import { clearSave, defaultSave, loadSave, normalizeSave, persistSave, validateSave, TEAM_SIZE } from "@/lib/save";
import { computeStarterIds, isSealed } from "@/lib/unlocks";
import { creditBattle, battleBonuses, sealKeys } from "@/lib/progression";
import { applyRunToSave, newRun, runAfterBattle, abandonRun } from "@/lib/gauntlet";
import { buildDaily, dailyKey, dailyResult, recordDaily } from "@/lib/daily";
import { addPreset, overwritePreset, renamePreset, deletePreset, loadPreset } from "@/lib/presets";
import { addReplay, renameReplay, deleteReplay, replayMeta } from "@/lib/replays";
import { encodeReplay } from "@/lib/replay";
import { clampLevel } from "@/lib/rival";
import { buildCatalog, applyEvolutionItem as applyItemToSave } from "@/lib/items";
import { registerDex, installHarness } from "@/game/tests/harness";
import { setAbilityDisplay } from "@/game/abilities";
import { ROSTERS, loadRosterId, saveRosterId } from "@/lib/rosters";
import { loadOriginalCreatures, ORIGINAL_ABILITY_NAMES } from "@/content/original";

const GameContext = createContext(null);
const ALL_IDS = Array.from({ length: MAX_ID }, (_, i) => i + 1);
installHarness();

export function GameProvider({ children }) {
  const initialRoster = loadRosterId();
  const [rosterId, setRosterId] = useState(initialRoster);
  const saveKeyRef = useRef(ROSTERS[initialRoster].saveKey);
  const [creatures, setCreatures] = useState({});
  const [progress, setProgress] = useState({ status: "idle", failed: [], patch: null });
  const [save, setSave] = useState(() => loadSave(ROSTERS[initialRoster].saveKey));
  const [movesetOverrides, setMovesetOverrides] = useState({});
  const saveRef = useRef(save);
  saveRef.current = save;
  const pendingRef = useRef({});
  const flushTimer = useRef(null);
  const unlockedRef = useRef(new Set());

  const persist = useCallback((s) => persistSave(s, saveKeyRef.current), []);

  const flush = useCallback(() => {
    flushTimer.current = null;
    const batch = pendingRef.current;
    pendingRef.current = {};
    setCreatures((prev) => ({ ...prev, ...batch }));
  }, []);

  const queueCreature = useCallback(
    (c) => {
      pendingRef.current[c.id] = c;
      if (!flushTimer.current) flushTimer.current = setTimeout(flush, 120);
    },
    [flush],
  );

  const sync = useCallback(
    async (ids) => {
      setProgress((p) => ({ ...p, status: "fetching", failed: [] }));
      const failed = [];
      await fetchCreatures(ids, { onCreature: queueCreature, onError: (id) => failed.push(id) });
      flush();
      setProgress((p) => ({ ...p, status: failed.length ? "error" : "done", failed }));
    },
    [queueCreature, flush],
  );

  const patch = useCallback(
    async (stale) => {
      if (!stale.length) return;
      let done = 0;
      setProgress((p) => ({ ...p, patch: { done, total: stale.length } }));
      const tick = () => {
        done++;
        if (done % 10 === 0 || done === stale.length) setProgress((p) => ({ ...p, patch: { done, total: stale.length } }));
      };
      await patchAbilities(stale, {
        onCreature: (c) => {
          queueCreature(c);
          tick();
        },
        onError: tick,
      });
      flush();
      setProgress((p) => ({ ...p, patch: null }));
    },
    [queueCreature, flush],
  );

  // Load the active roster's creatures + save whenever the roster changes.
  useEffect(() => {
    let cancelled = false;
    const roster = ROSTERS[rosterId];
    saveKeyRef.current = roster.saveKey;
    const loaded = loadSave(roster.saveKey);
    saveRef.current = loaded;
    setSave(loaded);
    setMovesetOverrides({});
    setAbilityDisplay(rosterId === "original" ? ORIGINAL_ABILITY_NAMES : {});
    pendingRef.current = {};
    setCreatures({});

    if (rosterId === "original") {
      setCreatures(loadOriginalCreatures());
      setProgress({ status: "done", failed: [], patch: null });
      return () => {
        cancelled = true;
      };
    }

    setProgress({ status: "cache", failed: [], patch: null });
    (async () => {
      const cached = await loadCachedCreatures();
      if (cancelled) return;
      const map = {};
      cached.forEach((c) => {
        map[c.id] = c;
      });
      setCreatures(map);
      const missing = ALL_IDS.filter((id) => !map[id]);
      if (missing.length) await sync(missing);
      else setProgress((p) => ({ ...p, status: "done", failed: [] }));
      patch(cached.filter(needsAbilityPatch));
    })();
    return () => {
      cancelled = true;
    };
  }, [rosterId, sync, patch]);

  const setRoster = useCallback(
    (id) => {
      if (!ROSTERS[id] || id === rosterId) return;
      saveRosterId(id);
      setRosterId(id);
    },
    [rosterId],
  );

  const retryFailed = useCallback(() => sync(progress.failed), [sync, progress.failed]);

  const resyncDex = useCallback(async () => {
    if (rosterId === "original") {
      setCreatures(loadOriginalCreatures());
      setProgress({ status: "done", failed: [], patch: null });
      return;
    }
    await clearCreatureCache();
    setCreatures({});
    await sync(ALL_IDS);
  }, [sync, rosterId]);

  const updateSave = useCallback((fn) => {
    setSave((prev) => persist(fn(prev)));
  }, [persist]);

  const list = useMemo(() => Object.values(creatures).sort((a, b) => (a.dexNo ?? a.id) - (b.dexNo ?? b.id)), [creatures]);
  const starterIds = useMemo(() => computeStarterIds(creatures), [creatures]);
  const unlockedIds = useMemo(() => {
    const s = new Set(starterIds);
    save.unlocked.forEach((id) => s.add(id));
    return s;
  }, [starterIds, save.unlocked]);
  unlockedRef.current = unlockedIds;
  useEffect(() => {
    registerDex({ creatures, unlockedIds });
  }, [creatures, unlockedIds]);

  const setMovesetOverride = useCallback((creatureId, ids) => {
    setMovesetOverrides((prev) => {
      const next = { ...prev };
      if (ids) next[creatureId] = ids;
      else delete next[creatureId];
      return next;
    });
  }, []);

  const toggleTeam = useCallback(
    (id) => {
      if (!unlockedRef.current.has(id)) return "locked";
      const team = saveRef.current.team;
      if (team.includes(id)) {
        updateSave((prev) => ({ ...prev, team: prev.team.filter((x) => x !== id) }));
        return "removed";
      }
      if (team.length >= TEAM_SIZE) return "full";
      updateSave((prev) => (prev.team.length >= TEAM_SIZE || prev.team.includes(id) ? prev : { ...prev, team: [...prev.team, id] }));
      return "added";
    },
    [updateSave],
  );

  const clearTeam = useCallback(() => updateSave((prev) => ({ ...prev, team: [] })), [updateSave]);
  const setTerrain = useCallback((terrain) => updateSave((prev) => ({ ...prev, terrain })), [updateSave]);
  const setRivalLevel = useCallback((rivalLevel) => updateSave((prev) => ({ ...prev, rivalLevel: clampLevel(rivalLevel) })), [updateSave]);
  const setAbility = useCallback((creatureId, slot) => updateSave((prev) => ({ ...prev, abilities: { ...prev.abilities, [creatureId]: slot === 1 ? 1 : 0 } })), [updateSave]);
  const resetSave = useCallback(() => {
    clearSave(saveKeyRef.current);
    const fresh = persist(defaultSave());
    saveRef.current = fresh;
    setSave(fresh);
  }, [persist]);

  const creaturesRef = useRef(creatures);
  creaturesRef.current = creatures;

  const importSave = useCallback((obj) => {
    const error = validateSave(obj);
    if (error) return error;
    const next = persist(normalizeSave(obj));
    saveRef.current = next;
    setSave(next);
    return null;
  }, [persist]);

  const catalog = useMemo(() => buildCatalog(creatures), [creatures]);
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;

  const creditResult = useCallback(
    (state, opts = {}) => {
      const res = creditBattle(
        saveRef.current,
        { win: state.winner === "player", playerIds: state.teams.player.units.map((u) => u.creatureId), battleId: state.battleId, bonuses: battleBonuses(state), seed: state.seed, catalog: catalogRef.current, drop: opts.drop || null },
        creaturesRef.current,
        unlockedRef.current,
      );
      if (!res.credited) return { newUnlocks: [], keysEarned: 0, credited: false, rows: [], drop: null };
      const saved = persist(res.save);
      setSave(saved);
      saveRef.current = saved;
      return { newUnlocks: res.newUnlocks, keysEarned: res.keysEarned, credited: true, rows: res.rows, drop: res.drop };
    },
    [persist],
  );

  const applyEvolutionItem = useCallback((opts) => {
    const res = applyItemToSave(saveRef.current, opts, catalogRef.current);
    if (res.error) return res.error;
    const saved = persist(res.save);
    setSave(saved);
    saveRef.current = saved;
    return null;
  }, [persist]);

  const spendSealKey = useCallback((id) => {
    const c = creaturesRef.current[id];
    if (!c || !isSealed(c) || unlockedRef.current.has(id) || sealKeys(saveRef.current, creaturesRef.current).available <= 0) return false;
    updateSave((prev) => ({ ...prev, unlocked: [...prev.unlocked, id] }));
    return true;
  }, [updateSave]);

  const startGauntlet = useCallback(() => {
    const run = newRun(saveRef.current.team);
    updateSave((prev) => ({ ...prev, gauntlet: { ...prev.gauntlet, runs: prev.gauntlet.runs + 1, active: run } }));
    return run;
  }, [updateSave]);

  const finishGauntletStage = useCallback((state, drop = null) => {
    const run = saveRef.current.gauntlet.active;
    if (!run) return null;
    const result = runAfterBattle(run, state, drop);
    const next = persist(applyRunToSave(saveRef.current, result));
    setSave(next);
    saveRef.current = next;
    return result;
  }, [persist]);

  const abandonGauntlet = useCallback(() => updateSave(abandonRun), [updateSave]);

  const [daily, setDaily] = useState(null);
  const dailyRef = useRef(null);
  dailyRef.current = daily;
  const dexComplete = progress.status === "done" && !progress.patch;
  useEffect(() => {
    if (!dexComplete) return undefined;
    let cancelled = false;
    const build = () =>
      buildDaily(creaturesRef.current)
        .then((d) => {
          if (!cancelled) setDaily(d);
        })
        .catch((e) => console.error("daily build failed", e));
    build();
    const id = setInterval(() => {
      if (dailyRef.current && dailyRef.current.key !== dailyKey()) build();
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [dexComplete, rosterId]);

  const recordDailyResult = useCallback((state) => {
    const key = dailyRef.current?.key || dailyKey();
    const result = dailyResult(state);
    const res = recordDaily(saveRef.current, key, result);
    const saved = persist(res.save);
    setSave(saved);
    saveRef.current = saved;
    return { key, result, isBest: res.isBest, best: saved.daily.best, attempts: saved.daily.attempts };
  }, [persist]);

  const presets = useMemo(
    () => ({
      add: (name) => updateSave((prev) => addPreset(prev, name)),
      overwrite: (id) => updateSave((prev) => overwritePreset(prev, id)),
      rename: (id, name) => updateSave((prev) => renamePreset(prev, id, name)),
      remove: (id) => updateSave((prev) => deletePreset(prev, id)),
      load: (preset) => updateSave((prev) => loadPreset(prev, preset)),
    }),
    [updateSave],
  );

  const saveReplay = useCallback((state, name, mode) => {
    const res = addReplay(saveRef.current, { name, code: encodeReplay(state), meta: replayMeta(state, mode) });
    if (res.status !== "duplicate") {
      const saved = persist(res.save);
      setSave(saved);
      saveRef.current = saved;
    }
    return res.status;
  }, [persist]);

  const replays = useMemo(
    () => ({
      add: (entry) => {
        const res = addReplay(saveRef.current, entry);
        if (res.status !== "duplicate") {
          const saved = persist(res.save);
          setSave(saved);
          saveRef.current = saved;
        }
        return res.status;
      },
      rename: (id, name) => updateSave((prev) => renameReplay(prev, id, name)),
      remove: (id) => updateSave((prev) => deleteReplay(prev, id)),
    }),
    [updateSave, persist],
  );

  const roster = ROSTERS[rosterId];
  const value = useMemo(
    () => ({
      creatures,
      list,
      loaded: list.length,
      total: roster.total,
      rosterId,
      roster,
      setRoster,
      progress,
      save,
      starterIds,
      unlockedIds,
      toggleTeam,
      clearTeam,
      setTerrain,
      setRivalLevel,
      setAbility,
      resetSave,
      retryFailed,
      resyncDex,
      movesetOverrides,
      setMovesetOverride,
      importSave,
      creditResult,
      catalog,
      applyEvolutionItem,
      spendSealKey,
      startGauntlet,
      finishGauntletStage,
      abandonGauntlet,
      daily,
      recordDailyResult,
      presets,
      saveReplay,
      replays,
    }),
    [creatures, list, roster, rosterId, setRoster, progress, save, starterIds, unlockedIds, toggleTeam, clearTeam, setTerrain, setRivalLevel, setAbility, resetSave, retryFailed, resyncDex, movesetOverrides, setMovesetOverride, importSave, creditResult, catalog, applyEvolutionItem, spendSealKey, startGauntlet, finishGauntletStage, abandonGauntlet, daily, recordDailyResult, presets, saveReplay, replays],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}
